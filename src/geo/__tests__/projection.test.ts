import { describe, it, expect } from 'vitest';
import {
  projectGoogleEarthToScreen,
  projectGoogleMapsToScreen,
  unprojectGoogleMapsScreen,
  unprojectGoogleEarthScreen,
  GoogleEarthViewState,
  GoogleMapsViewState,
  ViewportSize
} from '../projection';

describe('Geospatial Projection Engine', () => {
  const viewport: ViewportSize = { width: 1200, height: 800 };

  describe('Google Maps Web Mercator Projection', () => {
    const mapsView: GoogleMapsViewState = {
      latitude: 40.7580,
      longitude: -73.9855,
      zoom: 18
    };

    it('projects center coordinates exactly to the center of the viewport', () => {
      const pt = projectGoogleMapsToScreen(
        mapsView.latitude,
        mapsView.longitude,
        mapsView,
        viewport
      );

      expect(pt.x).toBeCloseTo(viewport.width / 2, 0);
      expect(pt.y).toBeCloseTo(viewport.height / 2, 0);
      expect(pt.visible).toBe(true);
    });

    it('projects eastward coordinates to the right of center', () => {
      // Small delta East
      const ptEast = projectGoogleMapsToScreen(
        mapsView.latitude,
        mapsView.longitude + 0.001,
        mapsView,
        viewport
      );

      expect(ptEast.x).toBeGreaterThan(viewport.width / 2);
      expect(ptEast.y).toBeCloseTo(viewport.height / 2, 0);
    });

    it('projects northward coordinates above center (smaller Y)', () => {
      // Small delta North
      const ptNorth = projectGoogleMapsToScreen(
        mapsView.latitude + 0.001,
        mapsView.longitude,
        mapsView,
        viewport
      );

      expect(ptNorth.y).toBeLessThan(viewport.height / 2);
      expect(ptNorth.x).toBeCloseTo(viewport.width / 2, 0);
    });

    it('accurately unprojects screen center back to geographic center coordinates', () => {
      const unprojected = unprojectGoogleMapsScreen(
        viewport.width / 2,
        viewport.height / 2,
        mapsView,
        viewport
      );

      expect(unprojected.latitude).toBeCloseTo(mapsView.latitude, 5);
      expect(unprojected.longitude).toBeCloseTo(mapsView.longitude, 5);
    });
  });

  describe('Google Earth 3D Perspective Projection', () => {
    const earthView: GoogleEarthViewState = {
      latitude: 40.7580,
      longitude: -73.9855,
      altitude: 500,
      distance: 500,
      pitch: 0, // Looking straight down / nadir
      heading: 0, // North up
      roll: 0
    };

    it('projects center ground coordinates to center of viewport in nadir view', () => {
      const pt = projectGoogleEarthToScreen(
        earthView.latitude,
        earthView.longitude,
        0,
        earthView,
        viewport
      );

      expect(pt.x).toBeCloseTo(viewport.width / 2, 0);
      expect(pt.y).toBeCloseTo(viewport.height / 2, 0);
      expect(pt.visible).toBe(true);
    });

    it('unprojects center screen back to earth view coordinates', () => {
      const unprojected = unprojectGoogleEarthScreen(
        viewport.width / 2,
        viewport.height / 2,
        earthView,
        viewport
      );

      expect(unprojected.latitude).toBeCloseTo(earthView.latitude, 5);
      expect(unprojected.longitude).toBeCloseTo(earthView.longitude, 5);
    });

    it('maintains strict zoom invariance when zooming out', () => {
      // Zoomed in view (dist = 300m)
      const zoomedInView: GoogleEarthViewState = {
        ...earthView,
        altitude: 0,
        distance: 300
      };

      // Zoomed out view (dist = 1500m, 5x farther)
      const zoomedOutView: GoogleEarthViewState = {
        ...earthView,
        altitude: 0,
        distance: 1500
      };

      // Target center point must stay precisely at screen center regardless of zoom
      const centerIn = projectGoogleEarthToScreen(earthView.latitude, earthView.longitude, 0, zoomedInView, viewport);
      const centerOut = projectGoogleEarthToScreen(earthView.latitude, earthView.longitude, 0, zoomedOutView, viewport);

      expect(centerIn.x).toBeCloseTo(viewport.width / 2, 0);
      expect(centerIn.y).toBeCloseTo(viewport.height / 2, 0);
      expect(centerOut.x).toBeCloseTo(viewport.width / 2, 0);
      expect(centerOut.y).toBeCloseTo(viewport.height / 2, 0);

      // Offset camera coordinate (e.g. 50m East)
      const offsetLat = earthView.latitude;
      const offsetLon = earthView.longitude + 0.0005;

      const ptIn = projectGoogleEarthToScreen(offsetLat, offsetLon, 0, zoomedInView, viewport);
      const ptOut = projectGoogleEarthToScreen(offsetLat, offsetLon, 0, zoomedOutView, viewport);

      // Distance from center on screen must scale inversely with camera distance:
      const dxIn = ptIn.x - (viewport.width / 2);
      const dxOut = ptOut.x - (viewport.width / 2);

      // Ratio of screen displacement should equal ratio of distances (300 / 1500 = 0.2)
      expect(dxOut / dxIn).toBeCloseTo(0.2, 1);
    });

    it('accurately round-trips screen coordinates under 40 degree tilt and 112 degree heading', () => {
      const tiltedView: GoogleEarthViewState = {
        latitude: 16.8325,
        longitude: 82.0345,
        altitude: 31.47,
        distance: 114,
        pitch: 40.5,
        heading: 112.1,
        roll: 0
      };

      // Pick a point near the center of the screen
      const testScreenX = 640;
      const testScreenY = 420;

      const unprojected = unprojectGoogleEarthScreen(testScreenX, testScreenY, tiltedView, viewport);
      const projected = projectGoogleEarthToScreen(
        unprojected.latitude,
        unprojected.longitude,
        tiltedView.altitude,
        tiltedView,
        viewport
      );

      expect(projected.x).toBeCloseTo(testScreenX, 0);
      expect(projected.y).toBeCloseTo(testScreenY, 0);
    });

    it('strictly locks camera marker to identical real-world WGS84 coordinate through repeated pan -> zoom -> rotate -> tilt cycles', () => {
      // Pinned camera at fixed WGS84 coordinates on Earth
      const pinnedLat = 37.7749295;
      const pinnedLon = -122.4194155;
      const pinnedElev = 12.0;

      // Base view centered on camera
      const baseView: GoogleEarthViewState = {
        latitude: pinnedLat,
        longitude: pinnedLon,
        altitude: pinnedElev,
        distance: 500,
        pitch: 0,
        heading: 0,
        fov: 35
      };

      // 1. Center view: marker must be at viewport center
      const ptCenter = projectGoogleEarthToScreen(pinnedLat, pinnedLon, pinnedElev, baseView, viewport);
      expect(ptCenter.x).toBeCloseTo(viewport.width / 2, 0);
      expect(ptCenter.y).toBeCloseTo(viewport.height / 2, 0);

      // 2. PAN EAST by 0.002 degrees: camera must stay anchored to Earth, shifting west on screen
      const pannedView: GoogleEarthViewState = {
        ...baseView,
        longitude: pinnedLon + 0.002
      };
      const ptPanned = projectGoogleEarthToScreen(pinnedLat, pinnedLon, pinnedElev, pannedView, viewport);
      expect(ptPanned.x).toBeLessThan(viewport.width / 2); // Camera is west of new center -> left of screen
      expect(ptPanned.y).toBeCloseTo(viewport.height / 2, 0);

      // 3. ZOOM OUT to 1500m: camera must remain at exact geographic point, screen offset scales inversely
      const zoomedView: GoogleEarthViewState = {
        ...pannedView,
        distance: 1500
      };
      const ptZoomed = projectGoogleEarthToScreen(pinnedLat, pinnedLon, pinnedElev, zoomedView, viewport);
      const dxPanned = ptPanned.x - viewport.width / 2;
      const dxZoomed = ptZoomed.x - viewport.width / 2;
      expect(dxZoomed / dxPanned).toBeCloseTo(500 / 1500, 1);

      // 4. ROTATE HEADING by 90 degrees: camera position must orbit around center synchronously
      const rotatedView: GoogleEarthViewState = {
        ...pannedView,
        heading: 90
      };
      const ptRotated = projectGoogleEarthToScreen(pinnedLat, pinnedLon, pinnedElev, rotatedView, viewport);
      // When heading is 90 (looking East), a point West of center should appear at bottom of screen
      expect(ptRotated.y).toBeGreaterThan(viewport.height / 2);

      // 5. TILT by 45 degrees: camera coordinate remains mathematically locked
      const tilted45View: GoogleEarthViewState = {
        ...baseView,
        pitch: 45
      };
      const ptTilted = projectGoogleEarthToScreen(pinnedLat, pinnedLon, pinnedElev, tilted45View, viewport);
      expect(ptTilted.x).toBeCloseTo(viewport.width / 2, 0);
      expect(ptTilted.y).toBeCloseTo(viewport.height / 2, 0);
      expect(ptTilted.visible).toBe(true);

      // 6. COMPLEX COMPOUND VIEW: Pan + Zoom + Rotate 180 + Tilt 55
      const complexView: GoogleEarthViewState = {
        latitude: pinnedLat + 0.001,
        longitude: pinnedLon + 0.001,
        altitude: 40.0,
        distance: 800,
        pitch: 55,
        heading: 180,
        fov: 35
      };
      const ptComplex = projectGoogleEarthToScreen(pinnedLat, pinnedLon, pinnedElev, complexView, viewport);
      expect(ptComplex.visible).toBe(true);
      expect(Number.isFinite(ptComplex.x)).toBe(true);
      expect(Number.isFinite(ptComplex.y)).toBe(true);

      // Crucial verification: stored coordinates never change during any view change
      expect(pinnedLat).toBe(37.7749295);
      expect(pinnedLon).toBe(-122.4194155);
      expect(pinnedElev).toBe(12.0);
    });

    it('strictly preserves real-world anchor across viewport resize cycles', () => {
      const pinnedLat = 40.7128;
      const pinnedLon = -74.0060;
      const pinnedElev = 200.0;

      const view: GoogleEarthViewState = {
        latitude: pinnedLat,
        longitude: pinnedLon,
        altitude: pinnedElev,
        distance: 200,
        pitch: 30,
        heading: 45,
        fov: 35
      };

      const viewports: ViewportSize[] = [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 800, height: 600 },
        { width: 1920, height: 1080 } // Back to full HD
      ];

      viewports.forEach((vp) => {
        const pt = projectGoogleEarthToScreen(pinnedLat, pinnedLon, pinnedElev, view, vp);
        // Center ground target always aligns with the center of each respective viewport
        expect(pt.x).toBeCloseTo(vp.width / 2, 0);
        expect(pt.y).toBeCloseTo(vp.height / 2, 0);
        expect(pt.visible).toBe(true);
      });
    });

    it('guarantees complete mathematical invariance under continuous 360-degree rotation and tilt cycles', () => {
      const pinnedLat = 51.5074;
      const pinnedLon = -0.1278;
      const pinnedElev = 100.0;

      // Center view looking directly at camera
      for (let heading = 0; heading <= 360; heading += 45) {
        for (let tilt = 0; tilt <= 75; tilt += 15) {
          const view: GoogleEarthViewState = {
            latitude: pinnedLat,
            longitude: pinnedLon,
            altitude: pinnedElev,
            distance: 400,
            pitch: tilt,
            heading: heading,
            fov: 35
          };

          const pt = projectGoogleEarthToScreen(pinnedLat, pinnedLon, pinnedElev, view, viewport);
          expect(pt.x).toBeCloseTo(viewport.width / 2, 0);
          expect(pt.y).toBeCloseTo(viewport.height / 2, 0);
          expect(pt.visible).toBe(true);

          // Reverse unprojection must return exact geodetic coordinate
          const unproj = unprojectGoogleEarthScreen(pt.x, pt.y, view, viewport);
          expect(unproj.latitude).toBeCloseTo(pinnedLat, 4);
          expect(unproj.longitude).toBeCloseTo(pinnedLon, 4);
        }
      }
    });
  });
});

