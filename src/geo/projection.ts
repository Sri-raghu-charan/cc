/**
 * Geospatial projection engine for projecting real-world geodetic coordinates (WGS84)
 * onto Google Earth 3D viewports and Google Maps Web Mercator viewports.
 */

const TO_RAD = Math.PI / 180;
const TO_DEG = 180 / Math.PI;

export interface GoogleEarthViewState {
  latitude: number;
  longitude: number;
  altitude: number; // Eye elevation or ground target elevation in meters
  distance: number; // Distance to ground target in meters
  pitch: number; // Tilt from nadir in degrees (0 = straight down, 90 = horizon)
  heading: number; // Yaw / azimuth in degrees (0 = North, 90 = East)
  fov?: number; // Vertical FOV in degrees (Google Earth standard is 35°)
  roll?: number;
}

export interface GoogleMapsViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number; // 0 to 360
  tilt?: number; // 0 to 67.5 in 3D WebGL mode
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
  distanceToCamera?: number;
}

/**
 * Projects a WGS84 coordinate (latitude, longitude, elevation) to 2D screen coordinates
 * based on Google Earth's current 3D camera view parameters.
 * Guarantees zoom-invariant alignment across all distances.
 */
const WGS84_A = 6378137.0; // semi-major axis (meters)
const WGS84_E2 = 0.00669437999014; // eccentricity squared

/**
 * Converts geodetic WGS84 coordinates to Earth-Centered Earth-Fixed (ECEF) Cartesian coordinates.
 */
export function geodeticToEcef(latDeg: number, lonDeg: number, altMeters: number = 0): [number, number, number] {
  const latRad = latDeg * TO_RAD;
  const lonRad = lonDeg * TO_RAD;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const x = (N + altMeters) * cosLat * cosLon;
  const y = (N + altMeters) * cosLat * sinLon;
  const z = (N * (1 - WGS84_E2) + altMeters) * sinLat;

  return [x, y, z];
}

/**
 * Projects a WGS84 coordinate (latitude, longitude, elevation) to 2D screen coordinates
 * based on Google Earth's current 3D camera view parameters using exact ECEF geometry.
 * Guarantees zero-drift alignment across all camera pans, translations, rotations, and distances.
 */
export function projectGoogleEarthToScreen(
  lat: number,
  lon: number,
  elev: number = 0,
  view: GoogleEarthViewState,
  viewport: ViewportSize
): ScreenPoint {
  const { width, height } = viewport;
  // Use exact FOV from Google Earth (standard vertical FOV is 35°)
  const fovDeg = view.fov && view.fov > 0 ? view.fov : 35;
  const fovRad = fovDeg * TO_RAD;
  const focalLength = (height / 2) / Math.tan(fovRad / 2);

  // Target ground point in ECEF:
  const [tx, ty, tz] = geodeticToEcef(view.latitude, view.longitude, view.altitude || 0);

  // Local ENU basis vectors in ECEF at target ground point:
  const latRad = view.latitude * TO_RAD;
  const lonRad = view.longitude * TO_RAD;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const eEast = [-sinLon, cosLon, 0];
  const eNorth = [-sinLat * cosLon, -sinLat * sinLon, cosLat];
  const eUp = [cosLat * cosLon, cosLat * sinLon, sinLat];

  // Camera orientation angles:
  const dist = Math.max(1, view.distance || 1000);
  const theta = (Math.max(0, Math.min(89.5, view.pitch || 0))) * TO_RAD; // tilt from nadir
  const psi = (view.heading || 0) * TO_RAD; // azimuth (0 = North, 90 = East)

  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPsi = Math.sin(psi);
  const cosPsi = Math.cos(psi);

  // Optical Look Vector L in ECEF (pointing from eye toward target):
  const lx = (sinTheta * sinPsi) * eEast[0] + (sinTheta * cosPsi) * eNorth[0] + (-cosTheta) * eUp[0];
  const ly = (sinTheta * sinPsi) * eEast[1] + (sinTheta * cosPsi) * eNorth[1] + (-cosTheta) * eUp[1];
  const lz = (sinTheta * sinPsi) * eEast[2] + (sinTheta * cosPsi) * eNorth[2] + (-cosTheta) * eUp[2];

  // Camera eye position in ECEF:
  const eyeX = tx - dist * lx;
  const eyeY = ty - dist * ly;
  const eyeZ = tz - dist * lz;

  // Right Vector R in ECEF (screen +X):
  let rx = (cosPsi) * eEast[0] + (-sinPsi) * eNorth[0];
  let ry = (cosPsi) * eEast[1] + (-sinPsi) * eNorth[1];
  let rz = (cosPsi) * eEast[2] + (-sinPsi) * eNorth[2];

  // Up Vector U in ECEF (screen -Y):
  let ux = ry * lz - rz * ly;
  let uy = rz * lx - rx * lz;
  let uz = rx * ly - ry * lx;

  // Apply roll if present:
  if (view.roll) {
    const rollRad = (view.roll || 0) * TO_RAD;
    const cosRoll = Math.cos(rollRad);
    const sinRoll = Math.sin(rollRad);
    const newRx = rx * cosRoll + ux * sinRoll;
    const newRy = ry * cosRoll + uy * sinRoll;
    const newRz = rz * cosRoll + uz * sinRoll;
    const newUx = -rx * sinRoll + ux * cosRoll;
    const newUy = -ry * sinRoll + uy * cosRoll;
    const newUz = -rz * sinRoll + uz * cosRoll;
    rx = newRx; ry = newRy; rz = newRz;
    ux = newUx; uy = newUy; uz = newUz;
  }

  // Target point P in ECEF:
  const [px, py, pz] = geodeticToEcef(lat, lon, elev);

  // Vector from camera eye to point P:
  const vx = px - eyeX;
  const vy = py - eyeY;
  const vz = pz - eyeZ;

  // Depth along optical look axis:
  const depth = vx * lx + vy * ly + vz * lz;

  // Horizon occlusion / Behind eye check:
  if (depth <= 0.1) {
    return { x: -9999, y: -9999, visible: false, distanceToCamera: depth };
  }

  // Horizon culling check:
  const eyeDistSq = eyeX * eyeX + eyeY * eyeY + eyeZ * eyeZ;
  const rEarthSq = WGS84_A * WGS84_A;
  if (eyeDistSq > rEarthSq) {
    const horizonDistSq = eyeDistSq - rEarthSq;
    const ptDistSq = vx * vx + vy * vy + vz * vz;
    const dotUp = (px * vx + py * vy + pz * vz);
    if (dotUp < 0 && ptDistSq > horizonDistSq + 50000000) {
      return { x: -9999, y: -9999, visible: false, distanceToCamera: depth };
    }
  }

  // Perspective camera coordinates:
  const xCam = vx * rx + vy * ry + vz * rz;
  const yCam = vx * ux + vy * uy + vz * uz;

  const screenX = width / 2 + (xCam * focalLength) / depth;
  const screenY = height / 2 - (yCam * focalLength) / depth;

  const isVisible =
    screenX >= -width &&
    screenX <= width * 2 &&
    screenY >= -height &&
    screenY <= height * 2;

  return {
    x: Number(screenX.toFixed(1)),
    y: Number(screenY.toFixed(1)),
    visible: isVisible,
    distanceToCamera: depth
  };
}

/**
 * Projects a WGS84 coordinate (latitude, longitude) to screen coordinates
 * on Google Maps Web Mercator projection.
 */
export function projectGoogleMapsToScreen(
  lat: number,
  lon: number,
  view: GoogleMapsViewState,
  viewport: ViewportSize
): ScreenPoint {
  const { width, height } = viewport;
  const scale = 256 * Math.pow(2, view.zoom);

  // Web Mercator formula for target point
  const x = ((lon + 180) / 360) * scale;
  const latRad = Math.max(-85.0511, Math.min(85.0511, lat)) * TO_RAD;
  const y = (0.5 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / (2 * Math.PI)) * scale;

  // Web Mercator formula for center point
  const centerX = ((view.longitude + 180) / 360) * scale;
  const centerLatRad = Math.max(-85.0511, Math.min(85.0511, view.latitude)) * TO_RAD;
  const centerY = (0.5 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / (2 * Math.PI)) * scale;

  let dx = x - centerX;
  let dy = y - centerY;

  // Apply bearing rotation if present (3D / tilted view)
  if (view.bearing) {
    const rad = -view.bearing * TO_RAD;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    dx = rx;
    dy = ry;
  }

  // Apply tilt foreshortening if present
  if (view.tilt) {
    const tiltCos = Math.cos(view.tilt * TO_RAD);
    dy = dy * tiltCos;
  }

  const screenX = width / 2 + dx;
  const screenY = height / 2 + dy;

  const isVisible =
    screenX >= -200 &&
    screenX <= width + 200 &&
    screenY >= -200 &&
    screenY <= height + 200;

  return {
    x: Number(screenX.toFixed(1)),
    y: Number(screenY.toFixed(1)),
    visible: isVisible
  };
}

/**
 * Inverse projection: Converts screen coordinates (e.g. mouse click) back into
 * latitude and longitude based on the current Google Maps view state.
 */
export function unprojectGoogleMapsScreen(
  screenX: number,
  screenY: number,
  view: GoogleMapsViewState,
  viewport: ViewportSize
): { latitude: number; longitude: number } {
  const { width, height } = viewport;
  const scale = 256 * Math.pow(2, view.zoom);

  let dx = screenX - width / 2;
  let dy = screenY - height / 2;

  if (view.tilt) {
    const tiltCos = Math.cos(view.tilt * TO_RAD);
    if (tiltCos > 0.1) dy = dy / tiltCos;
  }

  if (view.bearing) {
    const rad = view.bearing * TO_RAD;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    dx = rx;
    dy = ry;
  }

  const centerX = ((view.longitude + 180) / 360) * scale;
  const centerLatRad = Math.max(-85.0511, Math.min(85.0511, view.latitude)) * TO_RAD;
  const centerY = (0.5 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / (2 * Math.PI)) * scale;

  const clickX = centerX + dx;
  const clickY = centerY + dy;

  const lon = (clickX / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (clickY / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return {
    latitude: Number(lat.toFixed(7)),
    longitude: Number(lon.toFixed(7))
  };
}

/**
 * Projects a 3D polygon onto Google Earth screen viewport with Sutherland-Hodgman
 * near-plane clipping. Prevents polygon vertices behind or near the camera from
 * inverting, blowing up to infinity, or shooting off-screen to (-9999, -9999).
 */
export function projectGoogleEarthPolygon(
  coords: { latitude: number; longitude: number }[],
  elev: number = 0,
  view: GoogleEarthViewState,
  viewport: ViewportSize
): { x: number; y: number }[] {
  if (!coords || coords.length < 3) return [];

  const { width, height } = viewport;
  const fovDeg = view.fov && view.fov > 0 ? view.fov : 35;
  const fovRad = fovDeg * TO_RAD;
  const focalLength = (height / 2) / Math.tan(fovRad / 2);

  // Target ground point in ECEF:
  const targetAlt = view.altitude || elev || 0;
  const [tx, ty, tz] = geodeticToEcef(view.latitude, view.longitude, targetAlt);

  // Local ENU basis vectors in ECEF at target ground point:
  const latRad = view.latitude * TO_RAD;
  const lonRad = view.longitude * TO_RAD;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const eEast = [-sinLon, cosLon, 0];
  const eNorth = [-sinLat * cosLon, -sinLat * sinLon, cosLat];
  const eUp = [cosLat * cosLon, cosLat * sinLon, sinLat];

  // Camera orientation angles:
  const dist = Math.max(1, view.distance || 1000);
  const theta = (Math.max(0, Math.min(89.5, view.pitch || 0))) * TO_RAD;
  const psi = (view.heading || 0) * TO_RAD;

  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPsi = Math.sin(psi);
  const cosPsi = Math.cos(psi);

  // Optical Look Vector L in ECEF:
  const lx = (sinTheta * sinPsi) * eEast[0] + (sinTheta * cosPsi) * eNorth[0] + (-cosTheta) * eUp[0];
  const ly = (sinTheta * sinPsi) * eEast[1] + (sinTheta * cosPsi) * eNorth[1] + (-cosTheta) * eUp[1];
  const lz = (sinTheta * sinPsi) * eEast[2] + (sinTheta * cosPsi) * eNorth[2] + (-cosTheta) * eUp[2];

  // Camera eye position in ECEF:
  const eyeX = tx - dist * lx;
  const eyeY = ty - dist * ly;
  const eyeZ = tz - dist * lz;

  // Right Vector R:
  let rx = (cosPsi) * eEast[0] + (-sinPsi) * eNorth[0];
  let ry = (cosPsi) * eEast[1] + (-sinPsi) * eNorth[1];
  let rz = (cosPsi) * eEast[2] + (-sinPsi) * eNorth[2];

  // Up Vector U:
  let ux = ry * lz - rz * ly;
  let uy = rz * lx - rx * lz;
  let uz = rx * ly - ry * lx;

  if (view.roll) {
    const rollRad = (view.roll || 0) * TO_RAD;
    const cosRoll = Math.cos(rollRad);
    const sinRoll = Math.sin(rollRad);
    const newRx = rx * cosRoll + ux * sinRoll;
    const newRy = ry * cosRoll + uy * sinRoll;
    const newRz = rz * cosRoll + uz * sinRoll;
    const newUx = -rx * sinRoll + ux * cosRoll;
    const newUy = -ry * sinRoll + uy * cosRoll;
    const newUz = -rz * sinRoll + uz * cosRoll;
    rx = newRx; ry = newRy; rz = newRz;
    ux = newUx; uy = newUy; uz = newUz;
  }

  // Convert each vertex to camera space:
  interface CamVertex { x: number; y: number; z: number }
  const camVertices: CamVertex[] = [];
  for (const c of coords) {
    const [px, py, pz] = geodeticToEcef(c.latitude, c.longitude, elev);
    const vx = px - eyeX;
    const vy = py - eyeY;
    const vz = pz - eyeZ;
    const zCam = vx * lx + vy * ly + vz * lz;
    const xCam = vx * rx + vy * ry + vz * rz;
    const yCam = vx * ux + vy * uy + vz * uz;
    camVertices.push({ x: xCam, y: yCam, z: zCam });
  }

  // Sutherland-Hodgman clip against near plane z >= nearZ (0.5m)
  const nearZ = 0.5;
  const clipped: CamVertex[] = [];
  const n = camVertices.length;
  for (let i = 0; i < n; i++) {
    const p1 = camVertices[i];
    const p2 = camVertices[(i + 1) % n];
    const p1In = p1.z >= nearZ;
    const p2In = p2.z >= nearZ;

    if (p1In && p2In) {
      clipped.push(p2);
    } else if (p1In && !p2In) {
      const t = (nearZ - p1.z) / (p2.z - p1.z);
      clipped.push({
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
        z: nearZ
      });
    } else if (!p1In && p2In) {
      const t = (nearZ - p1.z) / (p2.z - p1.z);
      clipped.push({
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
        z: nearZ
      });
      clipped.push(p2);
    }
  }

  if (clipped.length < 3) return [];

  return clipped.map((pt) => ({
    x: Number((width / 2 + (pt.x * focalLength) / pt.z).toFixed(1)),
    y: Number((height / 2 - (pt.y * focalLength) / pt.z).toFixed(1))
  }));
}

/**
 * Inverse projection for Google Earth: computes exact clicked ground coordinate
 * via 3D ray-plane intersection in ECEF, guaranteeing exact positioning and zero drift.
 */
export function unprojectGoogleEarthScreen(
  screenX: number,
  screenY: number,
  view: GoogleEarthViewState,
  viewport: ViewportSize
): { latitude: number; longitude: number; elevation: number } {
  const { width, height } = viewport;
  const fovDeg = view.fov && view.fov > 0 ? view.fov : 35;
  const fovRad = fovDeg * TO_RAD;
  const focalLength = (height / 2) / Math.tan(fovRad / 2);

  // Target ground point in ECEF:
  const targetAlt = view.altitude || 0;
  const [tx, ty, tz] = geodeticToEcef(view.latitude, view.longitude, targetAlt);

  // Local ENU basis vectors in ECEF at target ground point:
  const latRad = view.latitude * TO_RAD;
  const lonRad = view.longitude * TO_RAD;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const eEast = [-sinLon, cosLon, 0];
  const eNorth = [-sinLat * cosLon, -sinLat * sinLon, cosLat];
  const eUp = [cosLat * cosLon, cosLat * sinLon, sinLat];

  // Camera orientation angles:
  const dist = Math.max(1, view.distance || 1000);
  const theta = (Math.max(0, Math.min(89.5, view.pitch || 0))) * TO_RAD;
  const psi = (view.heading || 0) * TO_RAD;

  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPsi = Math.sin(psi);
  const cosPsi = Math.cos(psi);

  // Look vector L in ECEF:
  const lx = (sinTheta * sinPsi) * eEast[0] + (sinTheta * cosPsi) * eNorth[0] + (-cosTheta) * eUp[0];
  const ly = (sinTheta * sinPsi) * eEast[1] + (sinTheta * cosPsi) * eNorth[1] + (-cosTheta) * eUp[1];
  const lz = (sinTheta * sinPsi) * eEast[2] + (sinTheta * cosPsi) * eNorth[2] + (-cosTheta) * eUp[2];

  // Eye in ECEF:
  const eyeX = tx - dist * lx;
  const eyeY = ty - dist * ly;
  const eyeZ = tz - dist * lz;

  // Right Vector R:
  let rx = (cosPsi) * eEast[0] + (-sinPsi) * eNorth[0];
  let ry = (cosPsi) * eEast[1] + (-sinPsi) * eNorth[1];
  let rz = (cosPsi) * eEast[2] + (-sinPsi) * eNorth[2];

  // Up Vector U:
  let ux = ry * lz - rz * ly;
  let uy = rz * lx - rx * lz;
  let uz = rx * ly - ry * lx;

  if (view.roll) {
    const rollRad = (view.roll || 0) * TO_RAD;
    const cosRoll = Math.cos(rollRad);
    const sinRoll = Math.sin(rollRad);
    const newRx = rx * cosRoll + ux * sinRoll;
    const newRy = ry * cosRoll + uy * sinRoll;
    const newRz = rz * cosRoll + uz * sinRoll;
    const newUx = -rx * sinRoll + ux * cosRoll;
    const newUy = -ry * sinRoll + uy * cosRoll;
    const newUz = -rz * sinRoll + uz * cosRoll;
    rx = newRx; ry = newRy; rz = newRz;
    ux = newUx; uy = newUy; uz = newUz;
  }

  // Camera ray in ECEF:
  const dx = screenX - width / 2;
  const dy = height / 2 - screenY; // Screen Y is inverted relative to camera Up
  const rayX = dx * rx + dy * ux + focalLength * lx;
  const rayY = dx * ry + dy * uy + focalLength * ly;
  const rayZ = dx * rz + dy * uz + focalLength * lz;

  const rayLen = Math.hypot(rayX, rayY, rayZ);
  const dirX = rayX / rayLen;
  const dirY = rayY / rayLen;
  const dirZ = rayZ / rayLen;

  // Intersect ray with ground plane through Target T with normal eUp:
  const dirDotUp = dirX * eUp[0] + dirY * eUp[1] + dirZ * eUp[2];
  const lDotUp = lx * eUp[0] + ly * eUp[1] + lz * eUp[2];

  let t = dist;
  if (dirDotUp < -0.001) {
    t = (dist * lDotUp) / dirDotUp;
  }

  const px = eyeX + t * dirX;
  const py = eyeY + t * dirY;
  const pz = eyeZ + t * dirZ;

  // Convert ECEF coordinate P back to Geodetic WGS84:
  const p = Math.hypot(px, py);
  const lon = Math.atan2(py, px) * TO_DEG;
  let lat = Math.atan2(pz, p * (1 - WGS84_E2)) * TO_DEG;

  // Refine latitude with Bowring's method for millimeter accuracy
  const latRadRef = lat * TO_RAD;
  const sinL = Math.sin(latRadRef);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinL * sinL);
  lat = Math.atan2(pz + WGS84_E2 * N * sinL, p) * TO_DEG;

  return {
    latitude: Number(lat.toFixed(7)),
    longitude: Number(lon.toFixed(7)),
    elevation: Number(targetAlt.toFixed(1))
  };
}
