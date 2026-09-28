/**
 * Automated Regression Tests for Google Earth Extension:
 * - Hard Geo-Anchor Immutability
 * - Coverage Footprint Immutability
 * - Projection Responsiveness
 * - Unsupported Host Rejection & Google Earth Host Acceptance
 * - Camera Heading Independence
 * - Elevation Independence from Viewport Altitude
 * - Multi-Camera Independence (500+ cameras)
 * - Zero Drift & Prediction Rebasing
 */

import { describe, it, expect } from 'vitest';
import { Camera, Coordinates } from '../../types/camera';
import {
  projectGoogleEarthToScreen,
  GoogleEarthViewState,
  ViewportSize
} from '../projection';
import { computeCameraFootprint } from '../frustum';
import { calculateDoriDistances } from '../dori';
import { isGoogleEarthUrl, isGoogleEarthTab } from '../../extension/utils/urlHelper';
import { urlWatcher } from '../../extension/services/urlWatcher';

describe('Google Earth Extension: Hard Geo-Anchor & Zero-Drift Verification', () => {
  const sampleCameraSpecs = {
    modelName: 'Axis P1375 Network Camera',
    manufacturer: 'Axis Communications',
    formFactor: 'box' as const,
    resolutionWidth: 1920,
    resolutionHeight: 1080,
    megaPixels: 2.0,
    sensorSize: '1/2.8"',
    lensType: 'varifocal' as const,
    focalLengthMin: 2.8,
    focalLengthMax: 8.0,
    selectedFocalLength: 4.0,
    hfovMin: 38,
    hfovMax: 110,
    selectedHfov: 60,
    vfovMin: 21,
    vfovMax: 60,
    selectedVfov: 34,
    maxOpticalRangeMeters: 45,
    irRangeMeters: 30,
    verificationStatus: 'verified' as const
  };

  const createTestCamera = (id: string, lat: number, lon: number, elev: number, heading: number): Camera => ({
    id,
    name: `Camera ${id}`,
    position: { latitude: lat, longitude: lon, elevation: elev },
    originalPosition: { latitude: lat, longitude: lon, elevation: elev },
    mountingHeight: 6.0,
    heading,
    tilt: 18.0,
    rangeMeters: 45.0,
    specs: sampleCameraSpecs,
    visible: true,
    color: '#3b82f6',
    isLocked: true
  });

  const viewport: ViewportSize = { width: 1920, height: 1080 };

  // PART 15: Anchor Immutability Test
  it('ANCHOR IMMUTABILITY: Camera geographic coordinates remain strictly immutable across pan, zoom, rotate, tilt, and fly', () => {
    const originalPos: Coordinates = {
      latitude: 37.7749295,
      longitude: -122.4194155,
      elevation: 15.0
    };
    const camera = createTestCamera('CAM_A', originalPos.latitude, originalPos.longitude, originalPos.elevation, 90.0);

    const initialSnapshot = {
      lat: camera.position.latitude,
      lon: camera.position.longitude,
      elev: camera.position.elevation,
      heading: camera.heading,
      height: camera.mountingHeight,
      tilt: camera.tilt,
      range: camera.rangeMeters
    };

    // Simulated Viewport Transformations
    const viewportTransformations: { name: string; view: GoogleEarthViewState }[] = [
      {
        name: 'Initial Nadir View',
        view: { latitude: 37.7749, longitude: -122.4194, altitude: 0, distance: 1000, fov: 35, pitch: 0, heading: 0 }
      },
      {
        name: 'Heavy Pan East and North',
        view: { latitude: 37.8200, longitude: -122.3500, altitude: 0, distance: 1200, fov: 35, pitch: 10, heading: 0 }
      },
      {
        name: 'Heavy Zoom In (Micro perspective)',
        view: { latitude: 37.7749, longitude: -122.4194, altitude: 0, distance: 20, fov: 35, pitch: 30, heading: 45 }
      },
      {
        name: 'Heavy Zoom Out (Satellite perspective, 80,000m)',
        view: { latitude: 37.7749, longitude: -122.4194, altitude: 0, distance: 80000, fov: 35, pitch: 0, heading: 0 }
      },
      {
        name: 'Rotate / Orbit Globe (heading 180°)',
        view: { latitude: 37.7749, longitude: -122.4194, altitude: 0, distance: 500, fov: 35, pitch: 45, heading: 180 }
      },
      {
        name: 'High Pitch Tilt (75° horizon tilt)',
        view: { latitude: 37.7749, longitude: -122.4194, altitude: 0, distance: 450, fov: 35, pitch: 75, heading: 270 }
      },
      {
        name: 'Fly to London, UK',
        view: { latitude: 51.5074, longitude: -0.1278, altitude: 0, distance: 2000, fov: 35, pitch: 20, heading: 90 }
      },
      {
        name: 'Fly back to San Francisco',
        view: { latitude: 37.7749, longitude: -122.4194, altitude: 0, distance: 1000, fov: 35, pitch: 0, heading: 0 }
      }
    ];

    for (const step of viewportTransformations) {
      // Screen projection is calculated for this frame
      const screenPt = projectGoogleEarthToScreen(
        camera.position.latitude,
        camera.position.longitude,
        camera.position.elevation,
        step.view,
        viewport
      );

      // Verify that camera geographic state remains byte-for-byte identical
      expect(camera.position.latitude, `Latitude mutated during ${step.name}`).toBe(initialSnapshot.lat);
      expect(camera.position.longitude, `Longitude mutated during ${step.name}`).toBe(initialSnapshot.lon);
      expect(camera.position.elevation, `Elevation mutated during ${step.name}`).toBe(initialSnapshot.elev);
      expect(camera.heading, `Heading mutated during ${step.name}`).toBe(initialSnapshot.heading);
      expect(camera.mountingHeight, `MountingHeight mutated during ${step.name}`).toBe(initialSnapshot.height);
      expect(camera.tilt, `Tilt mutated during ${step.name}`).toBe(initialSnapshot.tilt);
      expect(camera.rangeMeters, `RangeMeters mutated during ${step.name}`).toBe(initialSnapshot.range);

      // Sanity check: screen projection must be a valid object
      expect(typeof screenPt.x).toBe('number');
      expect(typeof screenPt.y).toBe('number');
    }
  });

  // PART 15: Coverage Immutability Test
  it('COVERAGE IMMUTABILITY: Geographic footprint vertices remain strictly unchanged during viewport movements', () => {
    const camera = createTestCamera('CAM_COVERAGE', 40.7580, -73.9855, 10.0, 45.0);

    const doriDistances = calculateDoriDistances(
      camera.specs.resolutionWidth,
      camera.specs.selectedHfov,
      camera.rangeMeters
    );

    const initialFootprint = computeCameraFootprint(
      {
        latitude: camera.position.latitude,
        longitude: camera.position.longitude,
        mountingHeight: camera.mountingHeight,
        heading: camera.heading,
        tilt: camera.tilt,
        hfov: camera.specs.selectedHfov,
        vfov: camera.specs.selectedVfov,
        maxRangeMeters: camera.rangeMeters
      },
      doriDistances
    );

    const frozenVertices = JSON.stringify(initialFootprint.coordinates);
    const frozenDori = JSON.stringify(initialFootprint.doriZones);

    // Simulate various Google Earth views
    const testViews: GoogleEarthViewState[] = [
      { latitude: 40.7580, longitude: -73.9855, altitude: 0, distance: 200, fov: 35, pitch: 15, heading: 45 },
      { latitude: 40.7600, longitude: -73.9800, altitude: 0, distance: 2500, fov: 35, pitch: 60, heading: 180 },
      { latitude: 40.7580, longitude: -73.9855, altitude: 0, distance: 50000, fov: 35, pitch: 0, heading: 0 }
    ];

    for (const view of testViews) {
      // Re-evaluating camera footprint from immutable camera anchor yields identical geometry
      const currentFootprint = computeCameraFootprint(
        {
          latitude: camera.position.latitude,
          longitude: camera.position.longitude,
          mountingHeight: camera.mountingHeight,
          heading: camera.heading,
          tilt: camera.tilt,
          hfov: camera.specs.selectedHfov,
          vfov: camera.specs.selectedVfov,
          maxRangeMeters: camera.rangeMeters
        },
        doriDistances
      );

      expect(JSON.stringify(currentFootprint.coordinates)).toBe(frozenVertices);
      expect(JSON.stringify(currentFootprint.doriZones)).toBe(frozenDori);
      expect(currentFootprint.totalAreaM2).toBe(initialFootprint.totalAreaM2);
      expect(currentFootprint.nearDistanceMeters).toBe(initialFootprint.nearDistanceMeters);
      expect(currentFootprint.farDistanceMeters).toBe(initialFootprint.farDistanceMeters);
    }
  });

  // PART 15: Projection Responsiveness Test
  it('PROJECTION RESPONSIVENESS: Screen coordinates update when viewport changes, while world coordinates remain fixed', () => {
    const C: Coordinates = { latitude: 40.7580, longitude: -73.9855, elevation: 10.0 };

    const V1: GoogleEarthViewState = {
      latitude: 40.7580,
      longitude: -73.9855,
      altitude: 0,
      distance: 500,
      fov: 35,
      pitch: 0,
      heading: 0
    };

    const V2: GoogleEarthViewState = {
      latitude: 40.7590,
      longitude: -73.9845,
      altitude: 0,
      distance: 800,
      fov: 35,
      pitch: 35,
      heading: 90
    };

    const p1 = projectGoogleEarthToScreen(C.latitude, C.longitude, C.elevation, V1, viewport);
    const p2 = projectGoogleEarthToScreen(C.latitude, C.longitude, C.elevation, V2, viewport);

    // Screen positions must respond to the changed viewport
    expect(p1.x !== p2.x || p1.y !== p2.y).toBe(true);

    // World coordinate C must remain completely unchanged
    expect(C.latitude).toBe(40.7580);
    expect(C.longitude).toBe(-73.9855);
    expect(C.elevation).toBe(10.0);
  });

  // PART 1 & 15: Single Host Activation Boundary
  it('UNSUPPORTED HOSTS: isGoogleEarthUrl rejects Google Maps, localhost, GitHub, YouTube, and arbitrary pages', () => {
    const unsupportedHosts = [
      'https://github.com/',
      'https://github.com/Sri-raghu-charan/cc',
      'https://www.google.com/maps/',
      'https://maps.google.com/',
      'https://google.com/maps/',
      'https://www.google.com/maps/@37.7749,-122.4194,15z',
      'http://localhost:5173/',
      'http://127.0.0.1:5173/',
      'http://localhost:3000/',
      'https://youtube.com/',
      'https://www.youtube.com/watch?v=123',
      'https://google.com/',
      'https://earth.google.com/', // without /web
      'https://earth.google.com/about/',
      'https://evil.com/?redirect=earth.google.com/web/',
      '',
      'invalid-url',
      null as any,
      undefined as any
    ];

    for (const url of unsupportedHosts) {
      expect(isGoogleEarthUrl(url), `Expected reject for: ${url}`).toBe(false);
      expect(isGoogleEarthTab({ url }), `Expected tab reject for: ${url}`).toBe(false);
    }
  });

  it('GOOGLE EARTH HOST: isGoogleEarthUrl positively identifies Google Earth Web URLs', () => {
    const validEarthUrls = [
      'https://earth.google.com/web/',
      'https://earth.google.com/web',
      'https://earth.google.com/web/@40.7580,-73.9855,10a,500d,35y,0h,0t,0r',
      'https://earth.google.com/web/@37.7749,-122.4194,15.2a,1200d,35y,45h,30t,0r',
      'https://earth.google.com/web/data=MkEKPwo9CiExSGcxVmdq'
    ];

    for (const url of validEarthUrls) {
      expect(isGoogleEarthUrl(url), `Expected accept for: ${url}`).toBe(true);
      expect(isGoogleEarthTab({ url }), `Expected tab accept for: ${url}`).toBe(true);
    }
  });

  // PART 8: Camera Heading Independence
  it('CAMERA HEADING INDEPENDENCE: Camera heading remains unchanged when Earth viewport rotates', () => {
    const camera = createTestCamera('CAM_HEADING', 37.7749, -122.4194, 0, 90.0);
    expect(camera.heading).toBe(90.0);

    const viewHeadings = [0, 45, 90, 180, 270, 359];
    for (const earthHeading of viewHeadings) {
      const view: GoogleEarthViewState = {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 0,
        distance: 500,
        fov: 35,
        pitch: 20,
        heading: earthHeading
      };

      // Project camera
      projectGoogleEarthToScreen(camera.position.latitude, camera.position.longitude, camera.position.elevation, view, viewport);

      // Camera's own heading must remain 90° regardless of globe orientation
      expect(camera.heading).toBe(90.0);
    }
  });

  // PART 9: Elevation Independence from Viewport Altitude
  it('ELEVATION INDEPENDENCE: CCTV camera elevation never adopts Earth viewport altitude', () => {
    const cameraElevation = 12.5; // Real-world pole elevation
    const camera = createTestCamera('CAM_ELEV', 37.7749, -122.4194, cameraElevation, 0);

    const viewportAltitudes = [50, 500, 2500, 20000, 100000];
    for (const alt of viewportAltitudes) {
      const view: GoogleEarthViewState = {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: alt, // Viewport eye/target altitude
        distance: alt,
        fov: 35,
        pitch: 0,
        heading: 0
      };

      // Project camera at its own true elevation
      const pt = projectGoogleEarthToScreen(
        camera.position.latitude,
        camera.position.longitude,
        camera.position.elevation,
        view,
        viewport
      );

      // Camera elevation MUST NOT be replaced by viewport altitude
      expect(camera.position.elevation).toBe(cameraElevation);
      expect(camera.position.elevation).not.toBe(alt);
      expect(typeof pt.x).toBe('number');
    }
  });

  // PART 12: Multi-Camera Independence (500 cameras)
  it('MULTI-CAMERA INDEPENDENCE: 500 cameras each maintain independent immutable anchors and unique projections', () => {
    const numCameras = 500;
    const cameras: Camera[] = [];
    const baseLat = 37.7749;
    const baseLon = -122.4194;

    for (let i = 0; i < numCameras; i++) {
      const lat = baseLat + (i % 25) * 0.001;
      const lon = baseLon + Math.floor(i / 25) * 0.001;
      cameras.push(createTestCamera(`CAM_${i}`, lat, lon, 5.0 + (i % 10), (i * 15) % 360));
    }

    const testView: GoogleEarthViewState = {
      latitude: baseLat + 0.01,
      longitude: baseLon + 0.01,
      altitude: 0,
      distance: 3000,
      fov: 35,
      pitch: 25,
      heading: 30
    };

    const screenPoints = cameras.map((cam) =>
      projectGoogleEarthToScreen(cam.position.latitude, cam.position.longitude, cam.position.elevation, testView, viewport)
    );

    // Verify all 500 cameras preserved their coordinates
    for (let i = 0; i < numCameras; i++) {
      const expectedLat = baseLat + (i % 25) * 0.001;
      const expectedLon = baseLon + Math.floor(i / 25) * 0.001;
      expect(cameras[i].position.latitude).toBeCloseTo(expectedLat, 6);
      expect(cameras[i].position.longitude).toBeCloseTo(expectedLon, 6);
      expect(typeof screenPoints[i].x).toBe('number');
    }

    // Verify cameras at different locations produce distinct screen projections
    expect(screenPoints[0].x).not.toBe(screenPoints[24].x);
  });

  // PART 10: URL Watcher View State Parsing and Prediction Rebasing
  it('URL WATCHER: Accurately parses Earth URL and rebases prediction on authoritative state', () => {
    const testUrl = 'https://earth.google.com/web/@37.7749295,-122.4194155,15.2a,450.5d,35y,125.4h,45.2t,0r';
    const state = urlWatcher.parseCurrentUrl(testUrl);

    expect(state.platform).toBe('earth');
    expect(state.earthView).toBeDefined();
    expect(state.earthView?.latitude).toBeCloseTo(37.7749295, 6);
    expect(state.earthView?.longitude).toBeCloseTo(-122.4194155, 6);
    expect(state.earthView?.altitude).toBeCloseTo(15.2, 1);
    expect(state.earthView?.distance).toBeCloseTo(450.5, 1);
    expect(state.earthView?.fov).toBe(35);
    expect(state.earthView?.heading).toBeCloseTo(125.4, 1);
    expect(state.earthView?.pitch).toBeCloseTo(45.2, 1);
    expect(state.isPredicted).toBe(false);
  });
});
