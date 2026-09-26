/**
 * Real-time URL and View State Watcher for Google Earth and Google Maps.
 * Detects host, parses live camera perspective / zoom, and notifies subscribers.
 */

import { GoogleEarthViewState, GoogleMapsViewState } from '../../geo/projection';

export type MapPlatform = 'earth' | 'maps' | 'standalone';

export interface CurrentMapState {
  platform: MapPlatform;
  earthView?: GoogleEarthViewState;
  mapsView?: GoogleMapsViewState;
  centerLat: number;
  centerLon: number;
  altitudeOrZoom: number;
}

export type ViewStateListener = (state: CurrentMapState) => void;

class MapUrlWatcher {
  private listeners: Set<ViewStateListener> = new Set();
  private lastHref: string = '';
  private pollInterval: number | null = null;
  private rafId: number | null = null;
  private currentState: CurrentMapState;
  private isInteracting: boolean = false;
  private lastPointerPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    this.currentState = this.parseCurrentUrl();
    this.startWatching();
  }

  public getState(): CurrentMapState {
    return this.currentState;
  }

  public forceCheck(): CurrentMapState {
    if (typeof window !== 'undefined') {
      const currentHref = window.location.href;
      if (currentHref !== this.lastHref) {
        this.lastHref = currentHref;
        this.currentState = this.parseCurrentUrl();
        this.notify();
      }
    }
    return this.currentState;
  }

  public subscribe(listener: ViewStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startWatching(): void {
    this.lastHref = typeof window !== 'undefined' ? window.location.href : '';

    const checkUpdate = (forcedHref?: string) => {
      if (typeof window === 'undefined') return;
      const currentHref = forcedHref || window.location.href;
      if (currentHref !== this.lastHref) {
        this.lastHref = currentHref;
        const newState = this.parseCurrentUrl(currentHref);
        this.currentState = newState;
        this.notify();
      }
    };

    if (typeof window !== 'undefined') {
      // 1. Hook CustomEvent from main-world page bridge (zero latency on history.replaceState/pushState)
      window.addEventListener('__cctv_url_change__', (e: Event) => {
        const customEvt = e as CustomEvent<{ href?: string }>;
        const href = customEvt.detail?.href || (typeof customEvt.detail === 'string' ? customEvt.detail : undefined);
        checkUpdate(href);
      });

      // 2. Hook isolated-world history as secondary layer
      try {
        const originalPushState = history.pushState;
        history.pushState = function (...args) {
          originalPushState.apply(this, args);
          checkUpdate();
        };

        const originalReplaceState = history.replaceState;
        history.replaceState = function (...args) {
          originalReplaceState.apply(this, args);
          checkUpdate();
        };
      } catch {
        // Ignored
      }

      window.addEventListener('popstate', () => checkUpdate());
      window.addEventListener('hashchange', () => checkUpdate());

      // 3. REAL-TIME INTERACTION GESTURE TRACKING (Zero-lag 60fps pan/zoom/tilt synchronization)
      const isExtensionUi = (target: EventTarget | null): boolean => {
        const el = target as HTMLElement | null;
        return !!el?.closest?.(
          '.cctv-floating-bar-wrapper, .cctv-interactive-layer, .cctv-streetview-modal, .cctv-project-modal, button, input, select, textarea'
        );
      };

      window.addEventListener(
        'pointerdown',
        (e: PointerEvent) => {
          if (isExtensionUi(e.target)) return;
          this.isInteracting = true;
          this.lastPointerPos = { x: e.clientX, y: e.clientY };
        },
        { passive: true }
      );

      window.addEventListener(
        'pointermove',
        (e: PointerEvent) => {
          if (!this.isInteracting || e.buttons === 0) {
            this.isInteracting = false;
            return;
          }
          if (isExtensionUi(e.target)) return;

          const dx = e.clientX - this.lastPointerPos.x;
          const dy = e.clientY - this.lastPointerPos.y;
          this.lastPointerPos = { x: e.clientX, y: e.clientY };

          if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;

          // A. Google Earth Kinematic Tracking
          if (this.currentState.platform === 'earth' && this.currentState.earthView) {
            const ev = this.currentState.earthView;

            if (e.buttons === 1 && !e.shiftKey && !e.ctrlKey) {
              // Left Mouse Drag: Pan across Earth surface
              const dist = Math.max(10, ev.distance || 1000);
              const fov = ((ev.fov || 35) * Math.PI) / 180;
              const h = window.innerHeight || 800;
              const mPerPx = (2 * dist * Math.tan(fov / 2)) / h;
              const tiltRad = ((ev.pitch || 0) * Math.PI) / 180;
              const headingRad = ((ev.heading || 0) * Math.PI) / 180;
              const tiltCos = Math.max(0.18, Math.cos(tiltRad));

              const dCamX = -dx * mPerPx;
              const dCamY = (dy * mPerPx) / tiltCos;

              const dEast = dCamX * Math.cos(headingRad) - dCamY * Math.sin(headingRad);
              const dNorth = dCamX * Math.sin(headingRad) + dCamY * Math.cos(headingRad);

              const latRad = (ev.latitude * Math.PI) / 180;
              const dLat = dNorth / 111320;
              const dLon = dEast / (111320 * Math.max(0.01, Math.cos(latRad)));

              ev.latitude = Number((ev.latitude + dLat).toFixed(7));
              ev.longitude = Number((ev.longitude + dLon).toFixed(7));
              this.currentState.centerLat = ev.latitude;
              this.currentState.centerLon = ev.longitude;
              this.notify();
            } else if (e.buttons === 2 || (e.buttons === 1 && (e.shiftKey || e.ctrlKey))) {
              // Right Mouse Drag or Shift-Drag: Tilt (pitch) & Heading (yaw)
              const dPitch = -dy * 0.25;
              const dHeading = dx * 0.25;
              ev.pitch = Math.max(0, Math.min(85, (ev.pitch || 0) + dPitch));
              ev.heading = ((ev.heading || 0) + dHeading + 360) % 360;
              this.notify();
            }
          } else if (this.currentState.platform === 'maps') {
            // Google Maps 2D / 2.5D Mercator Kinematic Drag
            const zoom = this.currentState.altitudeOrZoom || 17;
            const scale = 256 * Math.pow(2, zoom);
            const dLon = (-dx / scale) * 360;
            const latRad = (this.currentState.centerLat * Math.PI) / 180;
            const dLat = (dy / scale) * 360 * Math.cos(latRad);

            this.currentState.centerLat = Number((this.currentState.centerLat + dLat).toFixed(7));
            this.currentState.centerLon = Number((this.currentState.centerLon + dLon).toFixed(7));
            if (this.currentState.mapsView) {
              this.currentState.mapsView.latitude = this.currentState.centerLat;
              this.currentState.mapsView.longitude = this.currentState.centerLon;
            }
            this.notify();
          }
        },
        { passive: true }
      );

      window.addEventListener(
        'pointerup',
        () => {
          this.isInteracting = false;
          checkUpdate();
          setTimeout(() => checkUpdate(), 20);
          setTimeout(() => checkUpdate(), 80);
          setTimeout(() => checkUpdate(), 200);
          setTimeout(() => checkUpdate(), 500);
        },
        { passive: true }
      );

      window.addEventListener(
        'wheel',
        (e: WheelEvent) => {
          if (isExtensionUi(e.target)) return;

          if (this.currentState.platform === 'earth' && this.currentState.earthView) {
            const ev = this.currentState.earthView;
            const factor = e.deltaY > 0 ? 1.08 : 0.92;
            ev.distance = Math.max(8, Number(((ev.distance || 1000) * factor).toFixed(1)));
            this.currentState.altitudeOrZoom = ev.distance;
            this.notify();
          }
          checkUpdate();
        },
        { passive: true }
      );

      // 4. Per-frame check before each browser paint (guarantees 0-frame delay during active 3D pans)
      const rafLoop = () => {
        checkUpdate();
        this.rafId = requestAnimationFrame(rafLoop);
      };
      this.rafId = requestAnimationFrame(rafLoop);

      // 5. Fast 16ms interval as reliable fallback
      this.pollInterval = window.setInterval(() => checkUpdate(), 16);
    }
  }

  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public parseCurrentUrl(customHref?: string): CurrentMapState {
    if (typeof window === 'undefined' && !customHref) {
      return {
        platform: 'standalone',
        centerLat: 40.7580,
        centerLon: -73.9855,
        altitudeOrZoom: 18
      };
    }

    const href = customHref || (typeof window !== 'undefined' ? window.location.href : '');
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

    // 1. Google Earth Web
    if (hostname.includes('earth.google.com') || href.includes('earth.google.com') || href.includes('/earth')) {
      // Robust Google Earth URL parsing: @lat,lon followed by comma-separated tags
      // Syntax: @<lat>,<lon>,<alt>a,<dist>d,<fov>y,<heading>h,<tilt>t,<roll>r
      const earthMatch = href.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,([^/?#]+))?/);
      if (earthMatch) {
        const lat = parseFloat(earthMatch[1]);
        const lon = parseFloat(earthMatch[2]);
        const rest = earthMatch[3] || '';

        // Extract individual letter-tagged tokens with optional negative sign and scientific notation
        const numPattern = '([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)';
        const altMatch = rest.match(new RegExp(`${numPattern}a`));
        const distMatch = rest.match(new RegExp(`${numPattern}d`));
        const fovMatch = rest.match(new RegExp(`${numPattern}y`));
        const headingMatch = rest.match(new RegExp(`${numPattern}h`));
        const tiltMatch = rest.match(new RegExp(`${numPattern}t`));
        const rollMatch = rest.match(new RegExp(`${numPattern}r`));

        const altitude = altMatch ? parseFloat(altMatch[1]) : 0;
        // CRUCIAL: In Google Earth URL syntax:
        // When 'd' exists: 'a' is ground target elevation (meters MSL), 'd' is camera distance.
        // When 'd' is absent (2D nadir view): 'a' is camera eye altitude above ground, and ground target elevation is 0.
        const groundElevation = distMatch ? altitude : 0;
        const distance = distMatch ? parseFloat(distMatch[1]) : (altitude > 0 ? altitude : 1000);
        const fov = fovMatch ? parseFloat(fovMatch[1]) : 35;
        const heading = headingMatch ? parseFloat(headingMatch[1]) : 0;
        const pitch = tiltMatch ? parseFloat(tiltMatch[1]) : 0; // 't' is tilt in Google Earth
        const roll = rollMatch ? parseFloat(rollMatch[1]) : 0;

        const earthView: GoogleEarthViewState = {
          latitude: lat,
          longitude: lon,
          altitude: groundElevation,
          distance,
          fov: fov > 0 ? fov : 35,
          pitch,
          heading,
          roll
        };

        return {
          platform: 'earth',
          earthView,
          centerLat: lat,
          centerLon: lon,
          altitudeOrZoom: distance
        };
      }
    }

    // 2. Google Maps
    if (hostname.includes('google.com') && (window.location.pathname.includes('/maps') || hostname.includes('maps.google.com'))) {
      const mapsRegex = /@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/;
      const match = href.match(mapsRegex);

      if (match) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        const zoom = parseFloat(match[3]);

        return {
          platform: 'maps',
          mapsView: {
            latitude: lat,
            longitude: lon,
            zoom
          },
          centerLat: lat,
          centerLon: lon,
          altitudeOrZoom: zoom
        };
      }

      // Google Maps with 3D bearing and tilt: @lat,lon,zoom z,data=...
      const simpleMaps = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const simpleMatch = href.match(simpleMaps);
      if (simpleMatch) {
        const lat = parseFloat(simpleMatch[1]);
        const lon = parseFloat(simpleMatch[2]);
        return {
          platform: 'maps',
          mapsView: {
            latitude: lat,
            longitude: lon,
            zoom: 17
          },
          centerLat: lat,
          centerLon: lon,
          altitudeOrZoom: 17
        };
      }
    }

    // 3. Standalone / Dev Server
    return {
      platform: 'standalone',
      centerLat: 40.7580,
      centerLon: -73.9855,
      altitudeOrZoom: 18,
      mapsView: {
        latitude: 40.7580,
        longitude: -73.9855,
        zoom: 18
      }
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error('URL listener error:', err);
      }
    }
  }
}

export const urlWatcher = new MapUrlWatcher();

