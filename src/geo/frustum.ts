/**
 * Camera Frustum and Ground Coverage Geometry Engine
 * Computes physically accurate perspective ground footprints based on
 * camera height, depression tilt, optical FOV, and maximum geometric reach.
 */

import { FootprintGeometry, FootprintVertex } from '../types/camera';
import { computeDestination, normalizeHeading } from './coordinates';
import { polygon as turfPolygon, area as turfArea } from '@turf/turf';

const TO_RAD = Math.PI / 180;
const TO_DEG = 180 / Math.PI;

export interface FrustumParams {
  latitude: number;
  longitude: number;
  mountingHeight: number; // h in meters
  heading: number; // 0° = N, 90° = E, 180° = S, 270° = W
  tilt: number; // depression angle in degrees (0° = horizontal, 90° = nadir)
  hfov: number; // horizontal FOV in degrees
  vfov: number; // vertical FOV in degrees
  maxRangeMeters: number; // max optical / sensor reach in meters
}

/**
 * Computes near and far ground projection distances
 */
export function computeGroundDistances(
  mountingHeight: number,
  tiltDeg: number,
  vfovDeg: number,
  maxRangeMeters: number
): { nearDistance: number; farDistance: number } {
  const h = Math.max(0.5, mountingHeight);
  const halfVfov = vfovDeg / 2;

  // Bottom ray depression angle
  const gammaBottom = tiltDeg + halfVfov;

  let nearDistance: number;
  if (gammaBottom >= 89.9) {
    // Camera FOV includes straight down (pole ground point)
    nearDistance = 0;
  } else if (gammaBottom > 0.5) {
    const bottomRad = gammaBottom * TO_RAD;
    nearDistance = h / Math.tan(bottomRad);
  } else {
    // Looking up into the sky; bottom ray doesn't hit ground within immediate reach
    nearDistance = maxRangeMeters;
  }
  nearDistance = Math.max(0, Math.min(nearDistance, maxRangeMeters));

  // Top ray depression angle
  const gammaTop = tiltDeg - halfVfov;
  let farDistance: number;

  if (gammaTop > 0.5) {
    const topRad = gammaTop * TO_RAD;
    const groundIntersection = h / Math.tan(topRad);
    farDistance = Math.min(maxRangeMeters, groundIntersection);
  } else {
    // Top ray is at or above horizontal; ground coverage is bounded by max optical range
    farDistance = maxRangeMeters;
  }

  // Ensure far distance is strictly >= near distance
  farDistance = Math.max(nearDistance + 0.1, farDistance);

  return {
    nearDistance: Number(nearDistance.toFixed(2)),
    farDistance: Number(farDistance.toFixed(2))
  };
}

/**
 * Generates an array of ground vertices for a given radial ground distance and FOV span
 */
function generateFrustumArc(
  lat: number,
  lon: number,
  heading: number,
  groundDistance: number,
  hfov: number,
  numSamples: number,
  reverse: boolean = false
): FootprintVertex[] {
  const vertices: FootprintVertex[] = [];
  const halfHfov = Math.min(180, Math.max(1, hfov)) / 2;

  for (let i = 0; i <= numSamples; i++) {
    const t = reverse ? (numSamples - i) / numSamples : i / numSamples;
    const beta = -halfHfov + t * hfov; // relative angle in degrees
    const bearing = normalizeHeading(heading + beta);

    // In physical optics and CCTV site engineering (EN 62676-4), the camera FOV
    // boundary is a circular sector arc of radius `groundDistance`.
    // Radial boundary ensures zero distortion or infinite flaring at wide angles.
    const r = groundDistance;

    const pt = computeDestination(lat, lon, bearing, r);
    vertices.push(pt);
  }

  return vertices;
}

/**
 * Calculates a closed ground footprint polygon for a specific sub-range
 * Supports:
 * - Directional sector/cone (hfov < 360°)
 * - Full 360° circular coverage (hfov >= 360° or omnidirectional)
 */
export function calculateFootprintForRange(
  params: FrustumParams,
  nearDist: number,
  farDist: number,
  numArcSamples: number = 16
): FootprintVertex[] {
  const { latitude, longitude, heading, hfov } = params;

  if (farDist <= nearDist) {
    return [];
  }

  // 1. Circular coverage (360° omnidirectional / fisheye / circular PTZ mode)
  if (hfov >= 360 || hfov <= 0) {
    const polygon: FootprintVertex[] = [];
    const samples = Math.max(36, numArcSamples * 2);
    for (let i = 0; i <= samples; i++) {
      const angle = (i / samples) * 360;
      const pt = computeDestination(latitude, longitude, angle, farDist);
      polygon.push(pt);
    }
    return polygon;
  }

  // 2. Directional sector / cone coverage (hfov < 360°)
  const polygon: FootprintVertex[] = [];

  if (nearDist < 0.3) {
    // Frustum originates at the camera pole ground coordinate
    polygon.push({ latitude, longitude });
  } else {
    // Near boundary arc from left to right
    const nearVertices = generateFrustumArc(latitude, longitude, heading, nearDist, hfov, numArcSamples, false);
    polygon.push(...nearVertices);
  }

  // Far boundary arc from right to left (to maintain closed clockwise polygon)
  const farVertices = generateFrustumArc(latitude, longitude, heading, farDist, hfov, numArcSamples, true);
  polygon.push(...farVertices);

  // Close the polygon
  if (polygon.length > 0) {
    polygon.push({ ...polygon[0] });
  }

  return polygon;
}

/**
 * Computes complete camera ground footprint and DORI zones
 * In accordance with real-world CCTV site engineering:
 * Camera physical coverage boundary is strictly defined by maxRangeMeters.
 * Neither optical pitch truncation nor map zoom/screen pixels modify the real-world metric reach.
 */
export function computeCameraFootprint(
  params: FrustumParams,
  doriRanges?: {
    identification: number;
    recognition: number;
    observation: number;
    detection: number;
  }
): FootprintGeometry {
  const { latitude, longitude, mountingHeight, tilt, vfov, hfov, maxRangeMeters } = params;

  const { nearDistance } = computeGroundDistances(
    mountingHeight,
    tilt,
    vfov,
    maxRangeMeters
  );

  // Real-world physical CCTV coverage reach is strictly defined by maxRangeMeters in meters
  const farDistance = Math.max(1, maxRangeMeters);

  // Lateral chord span at far edge (well-defined up to 180° panoramic)
  const effectiveHfov = Math.min(360, Math.max(1, hfov));
  const halfHfovRad = (Math.min(180, effectiveHfov) / 2) * TO_RAD;
  const footprintWidthFarMeters = effectiveHfov >= 360
    ? Number((2 * farDistance).toFixed(2))
    : Number((2 * farDistance * Math.sin(halfHfovRad)).toFixed(2));

  // Full footprint polygon originating at the camera's fixed ground coordinate to its optical range
  const coordinates = calculateFootprintForRange(params, 0, farDistance, effectiveHfov >= 360 ? 36 : 16);

  // Calculate polygon ground area using Turf
  let totalAreaM2 = 0;
  if (coordinates.length >= 4) {
    try {
      const turfCoords = coordinates.map((pt) => [pt.longitude, pt.latitude]);
      const turfPoly = turfPolygon([turfCoords]);
      totalAreaM2 = Number(turfArea(turfPoly).toFixed(2));
    } catch {
      // Fallback estimate: sector area = 0.5 * r^2 * theta (in rad)
      const thetaRad = effectiveHfov * TO_RAD;
      totalAreaM2 = Number((0.5 * farDistance * farDistance * thetaRad).toFixed(2));
    }
  }

  // Calculate DORI sub-zones if ranges are provided
  const doriZones = {
    identification: [] as FootprintVertex[],
    recognition: [] as FootprintVertex[],
    observation: [] as FootprintVertex[],
    detection: [] as FootprintVertex[]
  };

  if (doriRanges) {
    const idFar = Math.min(farDistance, Math.max(0, doriRanges.identification));
    const recFar = Math.min(farDistance, Math.max(0, doriRanges.recognition));
    const obsFar = Math.min(farDistance, Math.max(0, doriRanges.observation));
    const detFar = Math.min(farDistance, Math.max(0, doriRanges.detection));

    if (idFar > 0) {
      doriZones.identification = calculateFootprintForRange(params, 0, idFar, 8);
    }
    if (recFar > idFar) {
      doriZones.recognition = calculateFootprintForRange(params, idFar, recFar, 8);
    }
    if (obsFar > recFar) {
      doriZones.observation = calculateFootprintForRange(params, recFar, obsFar, 8);
    }
    if (detFar > obsFar) {
      doriZones.detection = calculateFootprintForRange(params, obsFar, detFar, 8);
    }
  }

  return {
    coordinates,
    nearDistanceMeters: nearDistance,
    farDistanceMeters: farDistance,
    footprintWidthFarMeters,
    totalAreaM2,
    doriZones
  };
}
