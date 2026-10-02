import { Camera, FootprintGeometry } from '../types/camera';
import { computeDistance } from '../geo/coordinates';

/**
 * Development-Only Debug Utility for Real-World CCTV Ground Coverage Verification
 * Logs real-world meters, geographic coordinates, and measured boundary distance
 * to verify zero-drift and zoom-independent physical units.
 */
export function logCameraCoverageDebug(camera: Camera, footprint?: FootprintGeometry | null): void {
  // Only log in development environment or when window.__CCTV_DEBUG__ is enabled
  const isDev = (typeof window !== 'undefined' && (Boolean((window as any).__CCTV_DEBUG__) || Boolean((import.meta as any).env?.DEV)));

  if (!isDev) return;

  const lat = camera.position.latitude;
  const lon = camera.position.longitude;
  const modelName = camera.specs?.modelName || camera.specs?.model || 'Unknown Camera';
  const rangeM = camera.rangeMeters;
  const fovDeg = camera.specs?.selectedHfov ?? camera.specs?.horizontalFovDegrees ?? 60;
  const headingDeg = camera.heading;

  let boundaryDistanceStr = `~${rangeM}m`;
  if (footprint && footprint.coordinates.length > 2) {
    // Find the midpoint of the far arc
    const midIdx = Math.floor(footprint.coordinates.length / 2);
    const midPt = footprint.coordinates[midIdx];
    if (midPt) {
      const measuredMeters = computeDistance(lat, lon, midPt.latitude, midPt.longitude);
      boundaryDistanceStr = `~${measuredMeters.toFixed(2)}m (measured geodetic distance from camera origin)`;
    }
  }

  console.groupCollapsed(`[CCTV Coverage Engine Debug] ${modelName} — ${rangeM}m real-world reach`);
  console.log(`Camera Model: ${modelName}`);
  console.log(`Latitude: ${lat.toFixed(7)}°`);
  console.log(`Longitude: ${lon.toFixed(7)}°`);
  console.log(`Elevation: ${camera.position.elevation || 0}m`);
  console.log(`Range: ${rangeM}m`);
  console.log(`FOV: ${fovDeg}°`);
  console.log(`Heading: ${headingDeg}°`);
  console.log(`Coverage Boundary Distance: ${boundaryDistanceStr}`);
  console.log(`Form Factor / Type: ${camera.specs?.type || camera.specs?.formFactor || 'bullet'}`);
  console.log(`Geo-Anchored: ${camera.isLocked ? 'Strictly Locked' : 'Unlocked'}`);
  console.groupEnd();
}
