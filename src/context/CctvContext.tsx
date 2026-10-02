import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BlindSpotAnalysisResult,
  Camera,
  Coordinates,
  FootprintGeometry,
  MovementDirection,
  MovementHistoryEntry,
  OverlapResult,
  PlanningPerimeter
} from '../types/camera';
import { VERIFIED_CAMERA_MODELS } from '../data/cameraModels';
import { computeCameraFootprint } from '../geo/frustum';
import { calculateDoriDistances } from '../geo/dori';
import { moveCamera, resetCameraToOriginal } from '../geo/movement';
import { normalizeHeading, computeBearing } from '../geo/coordinates';
import { analyzeBlindSpots, analyzeOverlaps } from '../geo/analysis';
import { storage } from '../services/storage';
import { navigateMapToCoordinates } from '../services/mapNavigator';
import { ParsedCamera } from '../utils/projectFileParser';
import { SAMPLE_CAMERAS_RAJAHMUNDRY } from '../data/sampleProjects';

export type BaseLayerType = 'satellite' | 'osm' | 'carto_dark' | 'carto_light';

export interface DoriLayerVisibility {
  identification: boolean;
  recognition: boolean;
  observation: boolean;
  detection: boolean;
  maxGeometric: boolean;
}

interface CctvContextType {
  cameras: Camera[];
  activeCameraId: string | null;
  activeCamera: Camera | null;
  footprints: Map<string, FootprintGeometry>;
  activeFootprint: FootprintGeometry | null;
  overlaps: OverlapResult[];
  planningPerimeter: PlanningPerimeter | null;
  blindSpotAnalysis: BlindSpotAnalysisResult | null;
  isPlacingCamera: boolean;
  isRelocatingCamera: boolean;
  isAimingCamera: boolean;
  doriLayers: DoriLayerVisibility;
  baseLayer: BaseLayerType;
  cesiumIonToken: string;
  historyStack: Map<string, MovementHistoryEntry[]>;

  // Actions
  setIsPlacingCamera: (val: boolean) => void;
  setIsRelocatingCamera: (val: boolean) => void;
  setIsAimingCamera: (val: boolean) => void;
  setBaseLayer: (layer: BaseLayerType) => void;
  setCesiumIonToken: (token: string) => void;
  setDoriLayers: React.Dispatch<React.SetStateAction<DoriLayerVisibility>>;
  selectCamera: (id: string | null) => void;
  addCameraAtCoordinates: (coords: Coordinates, specs?: any) => Camera;
  addCamerasBatch: (camerasData: ParsedCamera[]) => Camera[];

  relocateCamera: (id: string, coords: Coordinates) => void;
  aimCameraAt: (id: string, targetCoords: Coordinates) => void;
  applyJunctionPreset: (id: string, presetName: JunctionPresetType) => void;
  updateCamera: (id: string, updates: Partial<Camera>) => void;
  deleteCamera: (id: string) => void;
  duplicateCamera: (id: string) => void;
  toggleCameraVisibility: (id: string) => void;
  stepCamera: (id: string, direction: MovementDirection, distanceMeters: number) => void;
  rotateCamera: (id: string, newHeading: number) => void;
  undoMovement: (id: string) => void;
  resetToOriginal: (id: string) => void;
  setPlanningPerimeter: (perimeter: PlanningPerimeter | null) => void;
  exportProjectJson: (snapshotDataUrl?: string) => string;
  exportProjectGeoJson: () => string;
  importProjectJson: (jsonString: string) => boolean;
  registerSnapshotProvider: (provider: () => Promise<string | null> | string | null) => () => void;
  captureMapSnapshot: () => Promise<string | null>;
  saveProjectWithSnapshot: (customName?: string) => Promise<{ json: string; snapshotUrl: string | null }>;
  lastMapSnapshot: string | null;
  flyToTarget: Coordinates | null;
  setFlyToTarget: (target: Coordinates | null) => void;
  loadCameras: (newCameras: Camera[]) => void;
  clearAllCameras: () => void;
}

export type JunctionPresetType = 'intersection' | 'approach' | 'tJunction' | 'roundabout';

export interface JunctionPreset {
  name: JunctionPresetType;
  label: string;
  description: string;
  rangeMeters: number;
  mountingHeight: number;
  tilt: number;
  hfov: number;
  vfov: number;
}

export const JUNCTION_PRESETS: Record<JunctionPresetType, JunctionPreset> = {
  intersection: {
    name: 'intersection',
    label: 'Intersection Overview',
    description: 'Wide coverage of 3/4-way junction, turn lanes & pedestrian crossings',
    rangeMeters: 32,
    mountingHeight: 6.0,
    tilt: 26,
    hfov: 95,
    vfov: 52
  },
  approach: {
    name: 'approach',
    label: 'Approach Lane Tracking',
    description: 'Focused view down approach street for vehicle & plate identification',
    rangeMeters: 45,
    mountingHeight: 6.0,
    tilt: 18,
    hfov: 60,
    vfov: 34
  },
  tJunction: {
    name: 'tJunction',
    label: 'T-Junction / Pedestrian Corner',
    description: 'Corner-mounted for high-res monitoring of side road turns & foot traffic',
    rangeMeters: 22,
    mountingHeight: 4.5,
    tilt: 32,
    hfov: 105,
    vfov: 58
  },
  roundabout: {
    name: 'roundabout',
    label: 'Roundabout Traffic Flow',
    description: 'Elevated wide angle overseeing circular entries, exits, and merges',
    rangeMeters: 38,
    mountingHeight: 6.5,
    tilt: 22,
    hfov: 80,
    vfov: 45
  }
};

const CctvContext = createContext<CctvContextType | null>(null);

const DEFAULT_CAMERA_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316'  // Orange
];

export const CctvProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isPlacingCamera, setIsPlacingCamera] = useState<boolean>(false);
  const [isRelocatingCamera, setIsRelocatingCamera] = useState<boolean>(false);
  const [isAimingCamera, setIsAimingCamera] = useState<boolean>(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayerType>('satellite');
  const [cesiumIonToken, setCesiumIonToken] = useState<string>('');
  const [flyToTarget, setFlyToTargetState] = useState<Coordinates | null>(null);

  // Unified FlyTo that triggers navigation across Google Earth, Google Maps, and Cesium
  const setFlyToTarget = useCallback((target: Coordinates | null) => {
    setFlyToTargetState(target);
    if (target) {
      navigateMapToCoordinates(target);
    }
  }, []);

  // Load a full project camera set and fly to primary camera
  const loadCameras = useCallback((newCameras: Camera[]) => {
    setCameras(newCameras);
    if (newCameras.length > 0) {
      setActiveCameraId(newCameras[0].id);
      setFlyToTarget({
        latitude: newCameras[0].position.latitude,
        longitude: newCameras[0].position.longitude,
        elevation: (newCameras[0].position.elevation || 0) + 200,
        heading: newCameras[0].heading
      });
      storage.set('cctv_cleared_by_user', false);
    } else {
      setActiveCameraId(null);
      storage.set('cctv_cleared_by_user', true);
    }
  }, [setFlyToTarget]);

  // Clear all pinned cameras and purge from storage
  const clearAllCameras = useCallback(() => {
    setCameras([]);
    setActiveCameraId(null);
    storage.set('cctv_saved_cameras', []);
    storage.set('cctv_cleared_by_user', true);
  }, []);

  const [doriLayers, setDoriLayers] = useState<DoriLayerVisibility>({
    identification: true,
    recognition: true,
    observation: true,
    detection: true,
    maxGeometric: true
  });

  const [planningPerimeter, setPlanningPerimeter] = useState<PlanningPerimeter | null>(null);
  const [historyStack, setHistoryStack] = useState<Map<string, MovementHistoryEntry[]>>(new Map());
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydrate state from storage on mount
  useEffect(() => {
    let mounted = true;
    async function loadStoredData() {
      try {
        const storedCameras = await storage.get<Camera[]>('cctv_saved_cameras', []);
        const wasCleared = await storage.get<boolean>('cctv_cleared_by_user', false);
        const storedPerimeter = await storage.get<PlanningPerimeter | null>('cctv_planning_perimeter', null);
        const storedToken = await storage.get<string>('cctv_cesium_ion_token', '');
        
        if (mounted) {
          if (Array.isArray(storedCameras) && storedCameras.length > 0) {
            const validCameras = storedCameras
              .filter((c) => c.id !== 'cam-initial-1')
              .map((c) => ({
                ...c,
                isLocked: true,
                position: {
                  latitude: Number(c.position.latitude.toFixed(7)),
                  longitude: Number(c.position.longitude.toFixed(7)),
                  elevation: c.position.elevation || 0
                }
              }));
            setCameras(validCameras);
            setActiveCameraId(validCameras.length > 0 ? validCameras[0].id : null);
          } else if (wasCleared) {
            // User explicitly cleared all cameras
            setCameras([]);
            setActiveCameraId(null);
          } else {
            // Default to real-world Rajahmundry 34-camera plan matching reference design
            setCameras(SAMPLE_CAMERAS_RAJAHMUNDRY);
            setActiveCameraId(SAMPLE_CAMERAS_RAJAHMUNDRY[0].id);
          }
          if (storedPerimeter) {
            setPlanningPerimeter(storedPerimeter);
          }
          if (storedToken) {
            setCesiumIonToken(storedToken);
          }
          setIsHydrated(true);
        }
      } catch (e) {
        console.warn('Storage hydration error:', e);
        if (mounted) {
          setCameras([]);
          setActiveCameraId(null);
          setIsHydrated(true);
        }
      }
    }
    loadStoredData();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist cameras when changed after hydration
  useEffect(() => {
    if (!isHydrated) return;
    storage.set('cctv_saved_cameras', cameras);
  }, [cameras, isHydrated]);

  // Persist planning perimeter when changed after hydration
  useEffect(() => {
    if (!isHydrated) return;
    storage.set('cctv_planning_perimeter', planningPerimeter);
  }, [planningPerimeter, isHydrated]);

  // Save Ion token to storage when changed
  useEffect(() => {
    if (cesiumIonToken) {
      storage.set('cctv_cesium_ion_token', cesiumIonToken);
    }
  }, [cesiumIonToken]);

  // Active Camera getter
  const activeCamera = useMemo(() => {
    return cameras.find((c) => c.id === activeCameraId) || null;
  }, [cameras, activeCameraId]);

  // Compute Footprints for all cameras
  const footprints = useMemo(() => {
    const map = new Map<string, FootprintGeometry>();

    for (const camera of cameras) {
      if (!camera.visible) continue;

      const doriDistances = calculateDoriDistances(
        camera.specs.resolutionWidth,
        camera.specs.selectedHfov,
        camera.rangeMeters
      );

      const fp = computeCameraFootprint(
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

      map.set(camera.id, fp);
    }

    return map;
  }, [cameras]);

  const activeFootprint = useMemo(() => {
    if (!activeCameraId) return null;
    return footprints.get(activeCameraId) || null;
  }, [activeCameraId, footprints]);

  // Pairwise overlaps
  const overlaps = useMemo(() => {
    return analyzeOverlaps(cameras, footprints);
  }, [cameras, footprints]);

  // Blind spots
  const blindSpotAnalysis = useMemo(() => {
    if (!planningPerimeter) return null;
    return analyzeBlindSpots(planningPerimeter, cameras, footprints);
  }, [planningPerimeter, cameras, footprints]);

  // Select camera
  const selectCamera = useCallback((id: string | null) => {
    setActiveCameraId(id);
  }, []);

  // Add camera (Strictly Approach Lane ratio: 60° HFOV, 34° VFOV, 45m range, 18° tilt, 6m ht)
  const addCameraAtCoordinates = useCallback(
    (coords: Coordinates, specs?: any): Camera => {
      const colorIndex = cameras.length % DEFAULT_CAMERA_COLORS.length;

      // All cameras strictly default to the Approach Lane Tracking standard (45m range, 18° tilt, 6m ht, 60° HFOV, 34° VFOV)
      const approachPreset = JUNCTION_PRESETS.approach;
      const baseSpecs = {
        ...VERIFIED_CAMERA_MODELS[0],
        selectedHfov: approachPreset.hfov, // 60.0°
        selectedVfov: approachPreset.vfov, // 34.0°
        maxOpticalRangeMeters: approachPreset.rangeMeters, // 45m
        recommendedHeight: approachPreset.mountingHeight, // 6.0m
        recommendedTilt: approachPreset.tilt // 18°
      };

      const cameraSpecs = specs
        ? {
            ...baseSpecs,
            ...specs,
            selectedHfov: specs.selectedHfov ?? approachPreset.hfov,
            selectedVfov: specs.selectedVfov ?? approachPreset.vfov,
            maxOpticalRangeMeters: specs.maxOpticalRangeMeters ?? approachPreset.rangeMeters,
            recommendedHeight: specs.recommendedHeight ?? approachPreset.mountingHeight,
            recommendedTilt: specs.recommendedTilt ?? approachPreset.tilt
          }
        : baseSpecs;

      const mountingHeight = cameraSpecs.recommendedHeight || approachPreset.mountingHeight;
      const tilt = cameraSpecs.recommendedTilt || approachPreset.tilt;
      const rangeMeters = cameraSpecs.maxOpticalRangeMeters || approachPreset.rangeMeters;

      const newCamera: Camera = {
        id: `cam-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        name: `Camera ${cameras.length + 1}`,
        position: {
          latitude: Number(coords.latitude.toFixed(7)),
          longitude: Number(coords.longitude.toFixed(7)),
          elevation: Number((coords.elevation || 0).toFixed(1))
        },
        originalPosition: {
          latitude: Number(coords.latitude.toFixed(7)),
          longitude: Number(coords.longitude.toFixed(7)),
          elevation: Number((coords.elevation || 0).toFixed(1))
        },
        mountingHeight,
        heading: 0,
        tilt,
        rangeMeters,
        specs: cameraSpecs,
        visible: true,
        color: DEFAULT_CAMERA_COLORS[colorIndex],
        isLocked: true
      };

      setCameras((prev) => [...prev, newCamera]);
      setActiveCameraId(newCamera.id);
      setIsPlacingCamera(false);
      setIsRelocatingCamera(false);
      setIsAimingCamera(false);
      return newCamera;
    },
    [cameras]
  );

  // Batch add multiple cameras from imported project files and strictly anchor to WGS84 coordinates
  const addCamerasBatch = useCallback(
    (camerasData: ParsedCamera[]): Camera[] => {
      if (!camerasData || camerasData.length === 0) return [];

      // All imported cameras strictly default to Approach Lane specifications (45m range, 18° tilt, 6m ht, 60° HFOV, 34° VFOV)
      const approachPreset = JUNCTION_PRESETS.approach;
      const baseSpecs = {
        ...VERIFIED_CAMERA_MODELS[0],
        selectedHfov: approachPreset.hfov, // 60.0°
        selectedVfov: approachPreset.vfov, // 34.0°
        maxOpticalRangeMeters: approachPreset.rangeMeters, // 45m
        recommendedHeight: approachPreset.mountingHeight, // 6.0m
        recommendedTilt: approachPreset.tilt // 18°
      };

      const newCameras: Camera[] = camerasData.map((data, idx) => {
        const colorIndex = (cameras.length + idx) % DEFAULT_CAMERA_COLORS.length;
        const spec = {
          ...baseSpecs,
          ...(data.specs || {}),
          selectedHfov: data.specs?.selectedHfov ?? approachPreset.hfov,
          selectedVfov: data.specs?.selectedVfov ?? approachPreset.vfov,
          maxOpticalRangeMeters: data.specs?.maxOpticalRangeMeters ?? approachPreset.rangeMeters,
          recommendedHeight: data.specs?.recommendedHeight ?? approachPreset.mountingHeight,
          recommendedTilt: data.specs?.recommendedTilt ?? approachPreset.tilt
        };

        // When uploading the project plan, use the exact camera name provided in the file
        const cameraName = data.name && data.name.trim().length > 0
          ? data.name.trim()
          : `Camera ${cameras.length + idx + 1}`;

        return {
          id: `cam-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${idx}`,
          name: cameraName,
          position: {
            latitude: Number(data.latitude.toFixed(7)),
            longitude: Number(data.longitude.toFixed(7)),
            elevation: Number((data.elevation || 0).toFixed(1))
          },
          originalPosition: {
            latitude: Number(data.latitude.toFixed(7)),
            longitude: Number(data.longitude.toFixed(7)),
            elevation: Number((data.elevation || 0).toFixed(1))
          },
          mountingHeight:
            typeof data.mountingHeight === 'number' && data.mountingHeight > 0
              ? data.mountingHeight
              : approachPreset.mountingHeight,
          heading: typeof data.heading === 'number' ? data.heading : 0,
          tilt: typeof data.tilt === 'number' ? data.tilt : approachPreset.tilt,
          rangeMeters:
            typeof data.rangeMeters === 'number' && data.rangeMeters > 0
              ? data.rangeMeters
              : approachPreset.rangeMeters,
          specs: spec,
          visible: true,
          color: DEFAULT_CAMERA_COLORS[colorIndex],
          isLocked: true // Strict Real-World WGS84 Anchor
        };
      });

      setCameras((prev) => [...prev, ...newCameras]);
      if (newCameras.length > 0) {
        setActiveCameraId(newCameras[0].id);
        // Automatically fly/navigate Google Earth to the first imported camera
        setFlyToTarget({
          latitude: newCameras[0].position.latitude,
          longitude: newCameras[0].position.longitude,
          elevation: newCameras[0].position.elevation
        });
      }
      setIsPlacingCamera(false);
      setIsRelocatingCamera(false);
      setIsAimingCamera(false);
      return newCameras;
    },
    [cameras, setFlyToTarget]
  );



  // Relocate camera to target coordinates (Only authorized way to move a placed camera)
  const relocateCamera = useCallback((id: string, coords: Coordinates) => {
    const lat = Number(coords.latitude.toFixed(7));
    const lon = Number(coords.longitude.toFixed(7));
    const elev = Number((coords.elevation || 0).toFixed(1));

    setCameras((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              position: {
                latitude: lat,
                longitude: lon,
                elevation: elev
              },
              isLocked: true
            }
          : c
      )
    );
    setIsRelocatingCamera(false);
  }, []);

  // Aim camera at target coordinates
  const aimCameraAt = useCallback((id: string, targetCoords: Coordinates) => {
    setCameras((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const bearing = computeBearing(
          c.position.latitude,
          c.position.longitude,
          targetCoords.latitude,
          targetCoords.longitude
        );
        return { ...c, heading: bearing };
      })
    );
    setIsAimingCamera(false);
  }, []);

  // Apply junction presets
  const applyJunctionPreset = useCallback((id: string, presetName: JunctionPresetType) => {
    const preset = JUNCTION_PRESETS[presetName];
    if (!preset) return;
    setCameras((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          rangeMeters: preset.rangeMeters,
          mountingHeight: preset.mountingHeight,
          tilt: preset.tilt,
          specs: {
            ...c.specs,
            selectedHfov: preset.hfov,
            selectedVfov: preset.vfov
          }
        };
      })
    );
  }, []);

  // Update camera (strict geo-anchoring: position cannot be modified via general updates)
  const updateCamera = useCallback((id: string, updates: Partial<Camera>) => {
    setCameras((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        // Strip out position from general updates to prevent accidental relocation during UI events
        const safeUpdates = { ...updates };
        delete safeUpdates.position;
        return { ...c, ...safeUpdates };
      })
    );
  }, []);

  // Delete camera
  const deleteCamera = useCallback(
    (id: string) => {
      setCameras((prev) => prev.filter((c) => c.id !== id));
      if (activeCameraId === id) {
        const remaining = cameras.filter((c) => c.id !== id);
        setActiveCameraId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [activeCameraId, cameras]
  );

  // Duplicate camera
  const duplicateCamera = useCallback(
    (id: string) => {
      const source = cameras.find((c) => c.id === id);
      if (!source) return;

      const colorIndex = (cameras.length + 1) % DEFAULT_CAMERA_COLORS.length;
      const copy: Camera = {
        ...source,
        id: `cam-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        name: `${source.name} (Copy)`,
        color: DEFAULT_CAMERA_COLORS[colorIndex]
      };

      setCameras((prev) => [...prev, copy]);
      setActiveCameraId(copy.id);
    },
    [cameras]
  );

  // Toggle visibility
  const toggleCameraVisibility = useCallback((id: string) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  }, []);

  // Step camera by ground distance (only allowed if camera is explicitly unlocked)
  const stepCamera = useCallback(
    (id: string, direction: MovementDirection, distanceMeters: number) => {
      const targetCam = cameras.find((c) => c.id === id);
      if (!targetCam || targetCam.isLocked) return;

      const { newPosition, entry } = moveCamera(targetCam, direction, distanceMeters);

      setCameras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, position: newPosition } : c))
      );

      // Record to history stack
      setHistoryStack((prev) => {
        const copy = new Map(prev);
        const existing = copy.get(id) || [];
        copy.set(id, [...existing, entry]);
        return copy;
      });
    },
    [cameras]
  );

  // Rotate camera heading
  const rotateCamera = useCallback((id: string, newHeading: number) => {
    const normalized = normalizeHeading(newHeading);
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, heading: normalized } : c))
    );
  }, []);

  // Undo movement (only if camera is unlocked)
  const undoMovement = useCallback((id: string) => {
    setHistoryStack((prev) => {
      const history = prev.get(id);
      if (!history || history.length === 0) return prev;

      const targetCam = cameras.find((c) => c.id === id);
      if (targetCam?.isLocked) return prev;

      const lastEntry = history[history.length - 1];
      const newHistory = history.slice(0, -1);

      setCameras((camList) =>
        camList.map((c) =>
          c.id === id
            ? {
                ...c,
                position: { ...lastEntry.cameraPosition }
              }
            : c
        )
      );

      const copy = new Map(prev);
      copy.set(id, newHistory);
      return copy;
    });
  }, [cameras]);

  // Reset to original position (only if camera is unlocked)
  const resetToOriginal = useCallback(
    (id: string) => {
      const targetCam = cameras.find((c) => c.id === id);
      if (!targetCam || targetCam.isLocked) return;

      const originalCoords = resetCameraToOriginal(targetCam);

      setCameras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, position: originalCoords } : c))
      );

      // Clear history stack for this camera
      setHistoryStack((prev) => {
        const copy = new Map(prev);
        copy.delete(id);
        return copy;
      });
    },
    [cameras]
  );

  const snapshotProviderRef = useRef<(() => Promise<string | null> | string | null) | null>(null);
  const [lastMapSnapshot, setLastMapSnapshot] = useState<string | null>(null);

  const registerSnapshotProvider = useCallback((provider: () => Promise<string | null> | string | null) => {
    snapshotProviderRef.current = provider;
    return () => {
      if (snapshotProviderRef.current === provider) {
        snapshotProviderRef.current = null;
      }
    };
  }, []);

  const captureMapSnapshot = useCallback(async (): Promise<string | null> => {
    if (!snapshotProviderRef.current) return null;
    try {
      const snap = await snapshotProviderRef.current();
      if (snap) {
        setLastMapSnapshot(snap);
      }
      return snap;
    } catch (err) {
      console.warn('Map snapshot capture failed:', err);
      return null;
    }
  }, []);

  // Save Project with Map Snapshot (saves JSON configuration and downloads PNG map snapshot)
  const saveProjectWithSnapshot = useCallback(async (customName?: string) => {
    const snap = await captureMapSnapshot();
    const dateStr = new Date().toISOString().slice(0, 10);
    const projName = customName || `cctv_plan_${dateStr}`;

    const projectData = {
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      projectName: projName,
      totalCameras: cameras.length,
      mapSnapshot: snap,
      cameras,
      planningPerimeter
    };

    const jsonStr = JSON.stringify(projectData, null, 2);

    // 1. Download Project JSON (with embedded snapshot)
    const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `${projName}.json`;
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);

    // 2. Download Standalone High-Resolution Map Snapshot Image (PNG)
    if (snap) {
      const imgLink = document.createElement('a');
      imgLink.href = snap;
      imgLink.download = `${projName}_map_snapshot.png`;
      imgLink.click();
    }

    return { json: jsonStr, snapshotUrl: snap };
  }, [captureMapSnapshot, cameras, planningPerimeter]);

  // Project Export as JSON
  const exportProjectJson = useCallback((snapshotDataUrl?: string) => {
    const data = {
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      totalCameras: cameras.length,
      mapSnapshot: snapshotDataUrl || lastMapSnapshot || null,
      cameras,
      planningPerimeter
    };
    return JSON.stringify(data, null, 2);
  }, [cameras, planningPerimeter, lastMapSnapshot]);

  // Project Export as GeoJSON
  const exportProjectGeoJson = useCallback(() => {
    const features: any[] = [];

    cameras.forEach((cam) => {
      // Camera Point Feature
      features.push({
        type: 'Feature',
        id: cam.id,
        geometry: {
          type: 'Point',
          coordinates: [cam.position.longitude, cam.position.latitude, cam.position.elevation]
        },
        properties: {
          type: 'camera_pole',
          name: cam.name,
          model: cam.specs.modelName,
          manufacturer: cam.specs.manufacturer,
          heading: cam.heading,
          tilt: cam.tilt,
          mountingHeight: cam.mountingHeight,
          rangeMeters: cam.rangeMeters
        }
      });

      // Frustum Polygon Feature
      const fp = footprints.get(cam.id);
      if (fp && fp.coordinates.length >= 4) {
        features.push({
          type: 'Feature',
          id: `${cam.id}-footprint`,
          geometry: {
            type: 'Polygon',
            coordinates: [fp.coordinates.map((pt) => [pt.longitude, pt.latitude])]
          },
          properties: {
            type: 'coverage_footprint',
            cameraId: cam.id,
            cameraName: cam.name,
            nearDistanceMeters: fp.nearDistanceMeters,
            farDistanceMeters: fp.farDistanceMeters,
            areaM2: fp.totalAreaM2
          }
        });
      }
    });

    return JSON.stringify(
      {
        type: 'FeatureCollection',
        features
      },
      null,
      2
    );
  }, [cameras, footprints]);

  // Import Project JSON
  const importProjectJson = useCallback((jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.cameras)) {
        setCameras(data.cameras);
        if (data.cameras.length > 0) {
          setActiveCameraId(data.cameras[0].id);
          setFlyToTarget(data.cameras[0].position);
        }
      }
      if (data.planningPerimeter) {
        setPlanningPerimeter(data.planningPerimeter);
      }
      if (data.mapSnapshot) {
        setLastMapSnapshot(data.mapSnapshot);
      }
      return true;
    } catch (err) {
      console.error('Failed to import project JSON:', err);
      return false;
    }
  }, []);

  return (
    <CctvContext.Provider
      value={{
        cameras,
        activeCameraId,
        activeCamera,
        footprints,
        activeFootprint,
        overlaps,
        planningPerimeter,
        blindSpotAnalysis,
        isPlacingCamera,
        isRelocatingCamera,
        isAimingCamera,
        doriLayers,
        baseLayer,
        cesiumIonToken,
        historyStack,
        setIsPlacingCamera,
        setIsRelocatingCamera,
        setIsAimingCamera,
        setBaseLayer,
        setCesiumIonToken,
        setDoriLayers,
        selectCamera,
        addCameraAtCoordinates,
        addCamerasBatch,
        relocateCamera,
        aimCameraAt,
        applyJunctionPreset,
        updateCamera,
        deleteCamera,
        duplicateCamera,
        toggleCameraVisibility,
        stepCamera,
        rotateCamera,
        undoMovement,
        resetToOriginal,
        setPlanningPerimeter,
        exportProjectJson,
        exportProjectGeoJson,
        importProjectJson,
        registerSnapshotProvider,
        captureMapSnapshot,
        saveProjectWithSnapshot,
        lastMapSnapshot,
        flyToTarget,
        setFlyToTarget,
        loadCameras,
        clearAllCameras
      }}
    >
      {children}
    </CctvContext.Provider>
  );
};

export const useCctv = (): CctvContextType => {
  const context = useContext(CctvContext);
  if (!context) {
    throw new Error('useCctv must be used within a CctvProvider');
  }
  return context;
};
