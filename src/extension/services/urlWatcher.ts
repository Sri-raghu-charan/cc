/**
 * Real-time URL and View State Watcher for Google Earth Web.
 * Detects authoritative URL, parses camera perspective / zoom, provides kinematic prediction during drag,
 * rebases prediction on authoritative URL updates, and emits immutable ViewportState snapshots.
 *
 * Enforces strict separation between Earth ViewportState and CameraAnchor.
 * Viewport changes must NEVER modify camera geographic anchors.
 */

import { GoogleEarthViewState, GoogleMapsViewState } from '../../geo/projection';
import { isGoogleEarthUrl } from '../utils/urlHelper';

export type MapPlatform = 'earth' | 'maps' | 'standalone';

export interface CurrentMapState {
  readonly platform: MapPlatform;
  readonly earthView?: Readonly<GoogleEarthViewState>;
  readonly mapsView?: Readonly<GoogleMapsViewState>;
  readonly centerLat: number;
  readonly centerLon: number;
  readonly altitudeOrZoom: number;
  readonly isPredicted?: boolean;
}

export type ViewStateListener = (state: CurrentMapState) => void;

class MapUrlWatcher {
  private listeners: Set<ViewStateListener> = new Set();
  private lastHref: string = '';
  private pollInterval: number | null = null;
  private rafId: number | null = null;
  private authoritativeState: CurrentMapState;
  private currentState: CurrentMapState;
  private isInteracting: boolean = false;
  private lastPointerPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    this.authoritativeState = this.parseCurrentUrl();
    this.currentState = this.authoritativeState;
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
        this.authoritativeState = this.parseCurrentUrl(currentHref);
        // Authoritative URL update always rebases current viewport state
        this.currentState = this.authoritativeState;
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
    if (typeof window === 'undefined') return;

    this.lastHref = window.location.href;

    const checkUpdate = (forcedHref?: string) => {
      if (typeof window === 'undefined') return;
      const currentHref = forcedHref || window.location.href;
      if (currentHref !== this.lastHref) {
        this.lastHref = currentHref;
        const newAuth = this.parseCurrentUrl(currentHref);
        this.authoritativeState = newAuth;
        // Rebase current state against the new authoritative URL state
        this.currentState = newAuth;
        this.notify();
      }
    };

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

    window.addEventListener('popstate', () => checkUpdate(), { passive: true });
    window.addEventListener('hashchange', () => checkUpdate(), { passive: true });

    // 3. Temporary Kinematic Pointer Tracking for Smooth Rendering during mouse drag
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
          if (this.isInteracting) {
            this.isInteracting = false;
            this.currentState = this.authoritativeState;
            this.notify();
          }
          return;
        }
        if (isExtensionUi(e.target)) return;

        const dx = e.clientX - this.lastPointerPos.x;
        const dy = e.clientY - this.lastPointerPos.y;
        this.lastPointerPos = { x: e.clientX, y: e.clientY };

        if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;

        // Kinematic tracking for Google Earth Web
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

            const newLat = Number((ev.latitude + dLat).toFixed(7));
            const newLon = Number((ev.longitude + dLon).toFixed(7));

            const nextEarthView: GoogleEarthViewState = {
              ...ev,
              latitude: newLat,
              longitude: newLon
            };

            // Fresh immutable snapshot to avoid cumulative object mutation
            this.currentState = {
              platform: 'earth',
              earthView: Object.freeze(nextEarthView),
              centerLat: newLat,
              centerLon: newLon,
              altitudeOrZoom: nextEarthView.distance,
              isPredicted: true
            };
            this.notify();
          } else if (e.buttons === 2 || (e.buttons === 1 && (e.shiftKey || e.ctrlKey))) {
            // Right Mouse Drag or Shift-Drag: Tilt (pitch) & Heading (yaw)
            const dPitch = -dy * 0.25;
            const dHeading = dx * 0.25;
            const newPitch = Math.max(0, Math.min(85, (ev.pitch || 0) + dPitch));
            const newHeading = ((ev.heading || 0) + dHeading + 360) % 360;

            const nextEarthView: GoogleEarthViewState = {
              ...ev,
              pitch: newPitch,
              heading: newHeading
            };

            this.currentState = {
              platform: 'earth',
              earthView: Object.freeze(nextEarthView),
              centerLat: ev.latitude,
              centerLon: ev.longitude,
              altitudeOrZoom: ev.distance,
              isPredicted: true
            };
            this.notify();
          }
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'pointerup',
      () => {
        if (this.isInteracting) {
          this.isInteracting = false;
          // Instantly rebase predicted viewport to authoritative state
          this.currentState = this.authoritativeState;
          this.notify();
          checkUpdate();
          setTimeout(() => checkUpdate(), 20);
          setTimeout(() => checkUpdate(), 80);
          setTimeout(() => checkUpdate(), 200);
        }
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
          const newDistance = Math.max(8, Number(((ev.distance || 1000) * factor).toFixed(1)));

          const nextEarthView: GoogleEarthViewState = {
            ...ev,
            distance: newDistance
          };

          this.currentState = {
            platform: 'earth',
            earthView: Object.freeze(nextEarthView),
            centerLat: ev.latitude,
            centerLon: ev.longitude,
            altitudeOrZoom: newDistance,
            isPredicted: true
          };
          this.notify();
        }
        checkUpdate();
      },
      { passive: true }
    );

    // 4. Per-frame check before each browser paint
    const rafLoop = () => {
      checkUpdate();
      this.rafId = requestAnimationFrame(rafLoop);
    };
    this.rafId = requestAnimationFrame(rafLoop);

    // 5. Fast 16ms interval as reliable fallback
    this.pollInterval = window.setInterval(() => checkUpdate(), 16);
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
    const href = customHref || (typeof window !== 'undefined' ? window.location.href : '');

    // 1. Google Earth Web (Strict Host & Path Check)
    if (isGoogleEarthUrl(href)) {
      // Syntax: @<lat>,<lon>,<alt>a,<dist>d,<fov>y,<heading>h,<tilt>t,<roll>r
      const earthMatch = href.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,([^/?#]+))?/);
      if (earthMatch) {
        const lat = parseFloat(earthMatch[1]);
        const lon = parseFloat(earthMatch[2]);
        const rest = earthMatch[3] || '';

        const numPattern = '([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)';
        const altMatch = rest.match(new RegExp(`${numPattern}a`));
        const distMatch = rest.match(new RegExp(`${numPattern}d`));
        const fovMatch = rest.match(new RegExp(`${numPattern}y`));
        const headingMatch = rest.match(new RegExp(`${numPattern}h`));
        const tiltMatch = rest.match(new RegExp(`${numPattern}t`));
        const rollMatch = rest.match(new RegExp(`${numPattern}r`));

        const altitude = altMatch ? parseFloat(altMatch[1]) : 0;
        // In Google Earth URL syntax:
        // When 'd' exists: 'a' is ground target elevation (meters MSL), 'd' is camera distance.
        // When 'd' is absent: 'a' is camera eye altitude, ground target elevation is 0.
        const groundElevation = distMatch ? altitude : 0;
        const distance = distMatch ? parseFloat(distMatch[1]) : (altitude > 0 ? altitude : 1000);
        const fov = fovMatch ? parseFloat(fovMatch[1]) : 35;
        const heading = headingMatch ? parseFloat(headingMatch[1]) : 0;
        const pitch = tiltMatch ? parseFloat(tiltMatch[1]) : 0;
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
          earthView: Object.freeze(earthView),
          centerLat: lat,
          centerLon: lon,
          altitudeOrZoom: distance,
          isPredicted: false
        };
      }
    }

    // 2. Standalone fallback (for local development outside Google Earth)
    return {
      platform: 'standalone',
      centerLat: 40.7580,
      centerLon: -73.9855,
      altitudeOrZoom: 18
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
