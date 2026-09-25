/**
 * TypeScript Data Models for CCTV Camera Coverage Planning System
 */

export type VerificationStatus = 'verified' | 'user_defined' | 'estimated';

export type CameraFormFactor = 'bullet' | 'dome' | 'turret' | 'ptz' | 'box';

export type LensType = 'fixed' | 'varifocal' | 'motorized_zoom';

export interface DatasheetDori {
  detectMeters: number;     // 25 px/m detection reach
  observeMeters: number;    // 62.5 px/m observation reach
  recognizeMeters: number;  // 125 px/m recognition reach
  identifyMeters: number;   // 250 px/m positive face/plate identification
}

export interface CameraSpecs {
  modelName: string;
  manufacturer: string;
  formFactor: CameraFormFactor;
  resolutionWidth: number; // e.g. 1920, 2560, 3840
  resolutionHeight: number; // e.g. 1080, 1440, 2160
  megaPixels: number; // e.g. 2.0, 4.0, 8.0
  sensorSize: string; // e.g. "1/2.8\"", "1/1.8\"", "1/2.5\""
  lensType: LensType;
  focalLengthMin: number; // mm
  focalLengthMax: number; // mm
  selectedFocalLength: number; // mm
  hfovMin: number; // degrees
  hfovMax: number; // degrees
  selectedHfov: number; // degrees
  vfovMin: number; // degrees
  vfovMax: number; // degrees
  selectedVfov: number; // degrees
  maxOpticalRangeMeters: number; // Documented geometric reach / detection range
  irRangeMeters: number; // Documented infrared illumination range
  datasheetDori?: DatasheetDori; // Official manufacturer EN 62676-4 DORI specs
  recommendedHeight?: number; // Recommended real-world mounting height in meters
  recommendedTilt?: number; // Recommended real-world tilt angle in degrees
  verificationStatus: VerificationStatus;
  datasheetRef?: string;
  notes?: string;
}

export interface Coordinates {
  latitude: number; // WGS84 degrees
  longitude: number; // WGS84 degrees
  elevation: number; // meters above ground/sea level
  heading?: number; // Optional viewing azimuth heading in degrees
}

export interface Camera {
  id: string;
  name: string;
  position: Coordinates;
  originalPosition: Coordinates; // For "Reset to Original Position"
  mountingHeight: number; // meters above local ground (e.g. 3.0 to 25.0m)
  heading: number; // 0° = North, 90° = East, 180° = South, 270° = West (0 <= heading < 360)
  tilt: number; // Depression angle downwards in degrees (0° = horizontal, 90° = nadir)
  rangeMeters: number; // User-configured or model-specified max range
  specs: CameraSpecs;
  visible: boolean;
  color: string; // Hex color for camera footprint / representation
  isLocked?: boolean; // Strict geo-anchoring: coordinates are immutable unless explicitly in Move mode
}

export interface DoriDistances {
  identification: number; // 250 px/m (meters)
  recognition: number; // 125 px/m (meters)
  observation: number; // 62.5 px/m (meters)
  detection: number; // 25 px/m (meters)
  maxGeometric: number; // meters
}

export interface FootprintVertex {
  latitude: number;
  longitude: number;
}

export interface FootprintGeometry {
  coordinates: FootprintVertex[]; // Array of WGS84 coordinates closing the polygon
  nearDistanceMeters: number; // Blind zone distance from pole to near edge
  farDistanceMeters: number; // Effective far distance on ground
  footprintWidthFarMeters: number; // Lateral span at far edge
  totalAreaM2: number; // Total covered ground area in square meters
  doriZones: {
    identification: FootprintVertex[];
    recognition: FootprintVertex[];
    observation: FootprintVertex[];
    detection: FootprintVertex[];
  };
}

export interface OverlapResult {
  cameraIds: [string, string];
  overlapAreaM2: number;
  overlapPolygon: FootprintVertex[];
}

export interface PlanningPerimeter {
  id: string;
  name: string;
  coordinates: FootprintVertex[]; // Closed polygon boundary
  totalAreaM2: number;
}

export interface BlindSpotAnalysisResult {
  perimeterAreaM2: number;
  coveredAreaM2: number;
  coveragePercentage: number;
  blindSpotAreaM2: number;
  blindSpotPolygons: FootprintVertex[][]; // Polygons representing unmonitored zones
}

export type MovementDirection = 'forward' | 'backward' | 'left' | 'right';

export interface MovementHistoryEntry {
  cameraPosition: Coordinates;
  heading: number;
  timestamp: number;
}
