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

      // 3. User interaction triggers (pointermove, wheel, mouseup)
      window.addEventListener('wheel', () => checkUpdate(), { passive: true });
      window.addEventListener('pointerup', () => {
        checkUpdate();
        setTimeout(() => checkUpdate(), 10);
        setTimeout(() => checkUpdate(), 50);
        setTimeout(() => checkUpdate(), 120);
        setTimeout(() => checkUpdate(), 300);
      }, { passive: true });
      window.addEventListener('pointermove', (e) => {
        if (e.buttons > 0) {
          checkUpdate();
        }
      }, { passive: true });

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
        // If distance is omitted, in 2D nadir view distance equals altitude or default 1000m
        const distance = distMatch ? parseFloat(distMatch[1]) : (altitude > 0 ? altitude : 1000);
        const fov = fovMatch ? parseFloat(fovMatch[1]) : 35;
        const heading = headingMatch ? parseFloat(headingMatch[1]) : 0;
        const pitch = tiltMatch ? parseFloat(tiltMatch[1]) : 0; // 't' is tilt in Google Earth
        const roll = rollMatch ? parseFloat(rollMatch[1]) : 0;

        const earthView: GoogleEarthViewState = {
          latitude: lat,
          longitude: lon,
          altitude,
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
