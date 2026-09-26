import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCctv } from '../../context/CctvContext';
import { urlWatcher, CurrentMapState } from '../services/urlWatcher';
import {
  projectGoogleEarthToScreen,
  projectGoogleEarthPolygon,
  projectGoogleMapsToScreen,
  unprojectGoogleEarthScreen,
  unprojectGoogleMapsScreen,
  ViewportSize,
  ScreenPoint
} from '../../geo/projection';
import { computeBearing } from '../../geo/coordinates';
import { DORI_COLORS } from '../../geo/dori';
import { VERIFIED_CAMERA_MODELS } from '../../data/cameraModels';
import { getCameraIconUri } from '../../utils/cameraIcons';
import { renderCameraCoverageSnapshot } from '../../utils/satelliteMapCapture';

interface MapOverlayCanvasProps {
  onSelectCamera?: (id: string) => void;
}

export const MapOverlayCanvas: React.FC<MapOverlayCanvasProps> = ({ onSelectCamera }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  const [mapState, setMapState] = useState<CurrentMapState>(() => urlWatcher.getState());
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const {
    cameras,
    activeCameraId,
    activeCamera,
    footprints,
    overlaps,
    blindSpotAnalysis,
    doriLayers,
    isPlacingCamera,
    setIsPlacingCamera,
    isRelocatingCamera,
    setIsRelocatingCamera,
    isAimingCamera,
    setIsAimingCamera,
    addCameraAtCoordinates,
    relocateCamera,
    aimCameraAt,
    selectCamera,
    registerSnapshotProvider
  } = useCctv();

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Map state listener from URL watcher
  useEffect(() => {
    return urlWatcher.subscribe((state) => {
      setMapState(state);
    });
  }, []);

  // Track mouse position in special click modes
  const isSpecialMode = isPlacingCamera || isRelocatingCamera || isAimingCamera;
  useEffect(() => {
    if (!isSpecialMode) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isSpecialMode]);

  // Project point with exact terrain elevation anchoring from live map view state
  const groundAlt = mapState.platform === 'earth' && mapState.earthView ? (mapState.earthView.altitude || 0) : 0;

  const projectPoint = useCallback(
    (lat: number, lon: number, elev: number = 0): ScreenPoint => {
      const liveState = urlWatcher.getState();
      if (liveState.platform === 'earth' && liveState.earthView) {
        return projectGoogleEarthToScreen(lat, lon, elev, liveState.earthView, viewport);
      }
      const mapsView = liveState.mapsView || {
        latitude: liveState.centerLat,
        longitude: liveState.centerLon,
        zoom: liveState.altitudeOrZoom || 18
      };
      return projectGoogleMapsToScreen(lat, lon, mapsView, viewport);
    },
    [viewport]
  );

  // Unproject screen point to geographic coordinates with exact WGS84 ground altitude
  const unprojectPoint = useCallback(
    (screenX: number, screenY: number): { latitude: number; longitude: number; elevation: number } => {
      const liveState = urlWatcher.getState();
      if (liveState.platform === 'earth' && liveState.earthView) {
        return unprojectGoogleEarthScreen(screenX, screenY, liveState.earthView, viewport);
      }
      const mapsView = liveState.mapsView || {
        latitude: liveState.centerLat,
        longitude: liveState.centerLon,
        zoom: liveState.altitudeOrZoom || 18
      };
      const unproj = unprojectGoogleMapsScreen(screenX, screenY, mapsView, viewport);
      return { ...unproj, elevation: 0 };
    },
    [viewport]
  );

  // Register Map Snapshot Provider for saving project with map snapshot of the covered camera region
  useEffect(() => {
    return registerSnapshotProvider(async () => {
      const overlayCanvas = canvasRef.current;
      if (!overlayCanvas) return null;

      try {
        // 1. Determine target camera(s) to frame
        const targetCams = cameras.filter((c) => c.visible && (activeCameraId ? c.id === activeCameraId : true));
        if (targetCams.length === 0 && cameras.length > 0) {
          const visible = cameras.filter((c) => c.visible);
          targetCams.push(...(visible.length > 0 ? visible : [cameras[0]]));
        }

        // 2. Collect all screen points for the camera and its covered footprint & DORI zones
        const screenPoints: { x: number; y: number }[] = [];
        targetCams.forEach((cam) => {
          const camElev = groundAlt;
          const gPt = projectPoint(cam.position.latitude, cam.position.longitude, camElev);
          if (gPt.visible) screenPoints.push({ x: gPt.x, y: gPt.y });

          const lPt = projectPoint(cam.position.latitude, cam.position.longitude, camElev + cam.mountingHeight);
          if (lPt.visible) screenPoints.push({ x: lPt.x, y: lPt.y });

          const fp = footprints.get(cam.id);
          if (fp && fp.coordinates) {
            fp.coordinates.forEach((coord) => {
              const pt = projectPoint(coord.latitude, coord.longitude, camElev);
              if (pt.visible) screenPoints.push({ x: pt.x, y: pt.y });
            });
            if (fp.doriZones) {
              const zones = [
                fp.doriZones.identification,
                fp.doriZones.recognition,
                fp.doriZones.observation,
                fp.doriZones.detection
              ];
              zones.forEach((z) => {
                if (z) {
                  z.forEach((coord) => {
                    const pt = projectPoint(coord.latitude, coord.longitude, camElev);
                    if (pt.visible) screenPoints.push({ x: pt.x, y: pt.y });
                  });
                }
              });
            }
          }
        });

        const width = viewport.width;
        const height = viewport.height;
        const dpr = window.devicePixelRatio || 1;

        // Calculate bounding box around camera covered area
        let cropX = 0;
        let cropY = 0;
        let cropW = width;
        let cropH = height;

        if (screenPoints.length >= 2) {
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;

          screenPoints.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });

          const boxW = Math.max(10, maxX - minX);
          const boxH = Math.max(10, maxY - minY);

          // Tightly frame the camera coverage area on the map (20% padding, min 45px)
          const padX = Math.max(45, boxW * 0.20);
          const padY = Math.max(45, boxH * 0.20);

          const rawCropX = minX - padX;
          const rawCropY = minY - padY;
          const rawCropW = boxW + padX * 2;
          const rawCropH = boxH + padY * 2;

          cropX = Math.max(0, Math.floor(rawCropX));
          cropY = Math.max(0, Math.floor(rawCropY));
          cropW = Math.min(width - cropX, Math.ceil(rawCropW));
          cropH = Math.min(height - cropY, Math.ceil(rawCropH));

          // Ensure sensible minimum frame size (at least 400x300)
          if (cropW < 400) {
            const diff = 400 - cropW;
            cropX = Math.max(0, cropX - diff / 2);
            cropW = Math.min(width - cropX, 400);
          }
          if (cropH < 300) {
            const diff = 300 - cropH;
            cropY = Math.max(0, cropY - diff / 2);
            cropH = Math.min(height - cropY, 300);
          }
        }

        // 3. Acquire background Earth satellite image
        let earthImage: HTMLImageElement | null = null;
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          try {
            const response = await new Promise<{ success: boolean; dataUrl?: string }>((resolve) => {
              chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (res) => {
                if (chrome.runtime?.lastError || !res) {
                  resolve({ success: false });
                } else {
                  resolve(res);
                }
              });
            });

            if (response && response.success && response.dataUrl) {
              earthImage = await new Promise<HTMLImageElement | null>((res) => {
                const img = new Image();
                img.onload = () => res(img);
                img.onerror = () => res(null);
                img.src = response.dataUrl!;
              });
            }
          } catch {
            // Fallback to DOM canvas
          }
        }

        const camToStamp = targetCams[0];
        if (!camToStamp) return overlayCanvas.toDataURL('image/png');

        const fp = footprints.get(camToStamp.id);

        return await renderCameraCoverageSnapshot({
          camera: camToStamp,
          footprint: fp,
          doriLayers,
          capturedScreenImage: earthImage,
          capturedScreenCrop: {
            cropX,
            cropY,
            cropW,
            cropH,
            totalW: width,
            totalH: height
          },
          overlayCanvas,
          dpr,
          targetWidth: Math.max(900, Math.round(cropW * dpr)),
          targetHeight: Math.max(600, Math.round(cropH * dpr))
        });
      } catch (err) {
        console.warn('Map overlay camera region snapshot capture error:', err);
        return overlayCanvas.toDataURL('image/png');
      }
    });
  }, [
    registerSnapshotProvider,
    cameras,
    activeCameraId,
    footprints,
    groundAlt,
    projectPoint,
    viewport
  ]);

  // Handle map click in placement, relocate, or aim mode
  const handleMapActionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const coords = unprojectPoint(clickX, clickY);

    if (isPlacingCamera) {
      const newCam = addCameraAtCoordinates(
        { latitude: coords.latitude, longitude: coords.longitude, elevation: coords.elevation ?? groundAlt },
        VERIFIED_CAMERA_MODELS[0]
      );
      selectCamera(newCam.id);
      setIsPlacingCamera(false);
      return;
    }

    if (isRelocatingCamera && activeCameraId) {
      relocateCamera(activeCameraId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        elevation: coords.elevation ?? groundAlt
      });
      setIsRelocatingCamera(false);
      return;
    }

    if (isAimingCamera && activeCameraId) {
      aimCameraAt(activeCameraId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        elevation: coords.elevation ?? groundAlt
      });
      setIsAimingCamera(false);
      return;
    }
  };

  // Non-blocking camera click selection on map (zero interference with Google Earth pans/tilts)
  const clickStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.cctv-floating-bar-wrapper, .cctv-streetview-modal, button, input, select')) {
        return;
      }
      clickStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!clickStartRef.current) return;
      const { x: startX, y: startY, time: startTime } = clickStartRef.current;
      clickStartRef.current = null;

      // If user moved more than 6px or held longer than 500ms, it was a pan/tilt drag, not a marker click
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      const elapsed = Date.now() - startTime;
      if (dist > 6 || elapsed > 500) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.cctv-floating-bar-wrapper, .cctv-streetview-modal, button, input, select')) {
        return;
      }

      // Check click against camera markers projected using live view state
      const liveState = urlWatcher.forceCheck();
      const proj = (lat: number, lon: number, el: number): ScreenPoint => {
        if (liveState.platform === 'earth' && liveState.earthView) {
          return projectGoogleEarthToScreen(lat, lon, el, liveState.earthView, viewport);
        }
        const mapsView = liveState.mapsView || {
          latitude: liveState.centerLat,
          longitude: liveState.centerLon,
          zoom: liveState.altitudeOrZoom || 18
        };
        return projectGoogleMapsToScreen(lat, lon, mapsView, viewport);
      };

      for (let i = cameras.length - 1; i >= 0; i--) {
        const cam = cameras[i];
        if (!cam.visible) continue;
        const pt = proj(cam.position.latitude, cam.position.longitude, cam.position.elevation || 0);
        if (!pt.visible) continue;

        const distGround = Math.hypot(e.clientX - pt.x, e.clientY - pt.y);
        const inBadge = Math.abs(e.clientX - pt.x) <= 60 && e.clientY >= pt.y - 48 && e.clientY <= pt.y - 14;

        if (distGround <= 22 || inBadge) {
          selectCamera(cam.id);
          if (onSelectCamera) onSelectCamera(cam.id);
          break;
        }
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
    };
  }, [cameras, viewport, selectCamera, onSelectCamera]);

  // Render loop using Canvas 2D
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = viewport.width;
      const height = viewport.height;

      // Handle retina displays
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Force-check live map state synchronously to eliminate any frame lag during pans/tilts
      const currentMapState = urlWatcher.forceCheck();

      // Realtime projection helper using exact instantaneous view state
      const projectPointRealtime = (lat: number, lon: number, elev: number = 0): ScreenPoint => {
        if (currentMapState.platform === 'earth' && currentMapState.earthView) {
          return projectGoogleEarthToScreen(lat, lon, elev, currentMapState.earthView, viewport);
        }
        const mapsView = currentMapState.mapsView || {
          latitude: currentMapState.centerLat,
          longitude: currentMapState.centerLon,
          zoom: currentMapState.altitudeOrZoom || 18
        };
        return projectGoogleMapsToScreen(lat, lon, mapsView, viewport);
      };

      // Helper to draw projected polygon with 3D near-plane clipping
      const drawPolygon = (
        coords: { latitude: number; longitude: number }[],
        fillStyle: string,
        strokeStyle: string,
        lineWidth: number = 1.5,
        elev: number = 0
      ) => {
        if (!coords || coords.length < 3) return;

        let screenPts: { x: number; y: number }[] = [];
        if (currentMapState.platform === 'earth' && currentMapState.earthView) {
          screenPts = projectGoogleEarthPolygon(coords, elev, currentMapState.earthView, viewport);
        } else {
          const mapsView = currentMapState.mapsView || {
            latitude: currentMapState.centerLat,
            longitude: currentMapState.centerLon,
            zoom: currentMapState.altitudeOrZoom || 18
          };
          screenPts = coords
            .map((c) => projectGoogleMapsToScreen(c.latitude, c.longitude, mapsView, viewport))
            .filter((p) => p.visible);
        }

        if (screenPts.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(screenPts[0].x, screenPts[0].y);
        for (let i = 1; i < screenPts.length; i++) {
          ctx.lineTo(screenPts[i].x, screenPts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      };

      // 1. Draw blind spot polygons if available
      if (blindSpotAnalysis && blindSpotAnalysis.blindSpotPolygons.length > 0) {
        blindSpotAnalysis.blindSpotPolygons.forEach((poly) => {
          drawPolygon(poly, 'rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.7)', 1.5, groundAlt);
        });
      }

      // 2. Draw camera coverage footprints, DORI zones, and sightlines
      cameras.forEach((cam) => {
        if (!cam.visible) return;

        const isSelected = cam.id === activeCameraId;
        const fp = footprints.get(cam.id);
        // STRICT GEO-ANCHOR: camera elevation is physically locked to terrain surface coordinates
        const camElev =
          cam.position.elevation !== undefined && cam.position.elevation !== 0
            ? cam.position.elevation
            : currentMapState.platform === 'earth' && currentMapState.earthView?.altitude
            ? currentMapState.earthView.altitude
            : 0;


        const groundPt = projectPointRealtime(cam.position.latitude, cam.position.longitude, camElev);
        const lensPt = projectPointRealtime(
          cam.position.latitude,
          cam.position.longitude,
          camElev + cam.mountingHeight
        );

        if (fp && fp.coordinates.length >= 3) {
          // Main Geometric Footprint Polygon
          if (doriLayers.maxGeometric) {
            drawPolygon(
              fp.coordinates,
              isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.14)',
              cam.color || '#3b82f6',
              isSelected ? 2.2 : 1.4,
              camElev
            );
          }

          // DORI Zones
          if (doriLayers.identification && fp.doriZones.identification.length >= 3) {
            drawPolygon(fp.doriZones.identification, 'rgba(239, 68, 68, 0.45)', DORI_COLORS.IDENTIFICATION, 1.2, camElev);
          }
          if (doriLayers.recognition && fp.doriZones.recognition.length >= 3) {
            drawPolygon(fp.doriZones.recognition, 'rgba(245, 158, 11, 0.35)', DORI_COLORS.RECOGNITION, 1.2, camElev);
          }
          if (doriLayers.observation && fp.doriZones.observation.length >= 3) {
            drawPolygon(fp.doriZones.observation, 'rgba(234, 179, 8, 0.25)', DORI_COLORS.OBSERVATION, 1.2, camElev);
          }
          if (doriLayers.detection && fp.doriZones.detection.length >= 3) {
            drawPolygon(fp.doriZones.detection, 'rgba(16, 185, 129, 0.18)', DORI_COLORS.DETECTION, 1.2, camElev);
          }

          // DORI Zone Distance Badges for selected camera
          if (isSelected) {
            const drawZoneBadge = (coords: { latitude: number; longitude: number }[], label: string, color: string) => {
              if (!coords || coords.length < 3) return;
              const midIdx = Math.floor(coords.length / 2);
              const pt = coords[midIdx];
              if (!pt) return;
              const scr = projectPointRealtime(pt.latitude, pt.longitude, camElev);
              if (!scr.visible) return;

              ctx.save();
              ctx.font = 'bold 9px sans-serif';
              const textMetrics = ctx.measureText(label);
              const padX = 4;
              const padY = 2;
              const badgeW = textMetrics.width + padX * 2;
              const badgeH = 13;

              ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
              ctx.strokeStyle = color;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(scr.x - badgeW / 2, scr.y - badgeH / 2, badgeW, badgeH, 3);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = color;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(label, scr.x, scr.y);
              ctx.restore();
            };

            if (doriLayers.identification && fp.doriZones.identification.length >= 3) {
              drawZoneBadge(fp.doriZones.identification, `ID: ${cam.specs.datasheetDori?.identifyMeters || '7'}m (Face)`, '#ef4444');
            }
            if (doriLayers.recognition && fp.doriZones.recognition.length >= 3) {
              drawZoneBadge(fp.doriZones.recognition, `Rec: ${cam.specs.datasheetDori?.recognizeMeters || '15'}m (Plates)`, '#f59e0b');
            }
            if (doriLayers.observation && fp.doriZones.observation.length >= 3) {
              drawZoneBadge(fp.doriZones.observation, `Obs: ${cam.specs.datasheetDori?.observeMeters || '30'}m (IR Limit)`, '#eab308');
            }
            if (doriLayers.maxGeometric && fp.coordinates.length >= 3) {
              drawZoneBadge(fp.coordinates, `Detect: ${cam.specs.datasheetDori?.detectMeters || fp.farDistanceMeters.toFixed(0)}m (Motion Only)`, '#38bdf8');
            }
          }

          // 3D Optical Sightline Frustum Rays (if selected)
          if (isSelected && lensPt.visible && fp.coordinates.length >= 4) {
            const cornerIndices = [
              0,
              Math.floor(fp.coordinates.length / 4),
              Math.floor(fp.coordinates.length / 2),
              Math.floor((3 * fp.coordinates.length) / 4)
            ];

            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = cam.color || '#60a5fa';
            ctx.lineWidth = 1;

            cornerIndices.forEach((idx) => {
              const corner = fp.coordinates[idx];
              if (corner) {
                const cornerPt = projectPointRealtime(corner.latitude, corner.longitude, camElev);
                if (cornerPt.visible) {
                  ctx.beginPath();
                  ctx.moveTo(lensPt.x, lensPt.y);
                  ctx.lineTo(cornerPt.x, cornerPt.y);
                  ctx.stroke();
                }
              }
            });
            ctx.restore();
          }
        }

        // Fixed Ground Markup Point on the map with Realistic CCTV Camera Icon
        if (groundPt.visible) {
          // Pulse target ring for selected camera
          if (isSelected) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(groundPt.x, groundPt.y, 14, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
          }

          // Solid ground markup pin base sticking to map
          ctx.beginPath();
          ctx.arc(groundPt.x, groundPt.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#38bdf8' : (cam.color || '#3b82f6');
          ctx.lineWidth = 2;
          ctx.stroke();

          // Center crosshair pip
          ctx.beginPath();
          ctx.arc(groundPt.x, groundPt.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Draw realistic CCTV security camera body and lens oriented to camera heading
          ctx.save();
          ctx.translate(groundPt.x, groundPt.y);
          ctx.rotate((cam.heading - 90) * (Math.PI / 180));

          // Swivel mounting arm / bracket
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-7, -1.5, 5, 3);

          // Weatherproof camera enclosure body
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = isSelected ? '#38bdf8' : (cam.color || '#3b82f6');
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(-2, -5, 14, 10, 2);
          ctx.fill();
          ctx.stroke();

          // Sun canopy / protective visor hood
          ctx.fillStyle = '#334155';
          ctx.fillRect(-1, -6.5, 15, 2);

          // Front optical lens barrel & aperture
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(12, -3.5, 3.5, 7);
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(13.5, 0, 1.4, 0, Math.PI * 2);
          ctx.fill();

          // Red recording indicator LED
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(5, -2.5, 1.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // Camera Mounting Pole in 3D perspective
        if (groundPt.visible && lensPt.visible && cam.mountingHeight > 0.5) {
          ctx.beginPath();
          ctx.moveTo(groundPt.x, groundPt.y);
          ctx.lineTo(lensPt.x, lensPt.y);
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#94a3b8';
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.stroke();
        }

        // Heading Direction Line & Arrow extending from fixed ground markup point
        if (groundPt.visible) {
          const arrowLen = 38;
          const rad = (cam.heading - 90) * (Math.PI / 180);
          const endX = groundPt.x + arrowLen * Math.cos(rad);
          const endY = groundPt.y + arrowLen * Math.sin(rad);

          ctx.beginPath();
          ctx.moveTo(groundPt.x, groundPt.y);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = cam.color || '#3b82f6';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Arrow tip
          const tipAngle = Math.PI / 6;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - 8 * Math.cos(rad - tipAngle), endY - 8 * Math.sin(rad - tipAngle));
          ctx.lineTo(endX - 8 * Math.cos(rad + tipAngle), endY - 8 * Math.sin(rad + tipAngle));
          ctx.closePath();
          ctx.fillStyle = cam.color || '#3b82f6';
          ctx.fill();
        }

        // Camera Name Badge (Anchored directly on canvas at 60 FPS - ONLY camera name visible)
        if (groundPt.visible) {
          ctx.save();
          const badgeText = cam.name;
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          const textMetrics = ctx.measureText(badgeText);
          const padX = 12;
          const badgeW = textMetrics.width + padX * 2;
          const badgeH = 22;
          const badgeX = groundPt.x - badgeW / 2;
          const badgeY = groundPt.y - 36;

          // Badge pill container
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 11);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#38bdf8' : (cam.color || 'rgba(255, 255, 255, 0.25)');
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();

          // ONLY camera name is visible over there on the map
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, groundPt.x, badgeY + badgeH / 2);

          ctx.restore();
        }

      });

      // 3. Draw pairwise overlaps
      overlaps.forEach((ov) => {
        if (!ov.overlapPolygon || ov.overlapPolygon.length < 3) return;
        drawPolygon(ov.overlapPolygon, 'rgba(168, 85, 247, 0.4)', '#d8b4fe', 2);
      });

      // 4. Special mode cursor & crosshair
      if (isSpecialMode && mousePos) {
        ctx.save();
        ctx.strokeStyle = isAimingCamera ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(mousePos.x - 22, mousePos.y);
        ctx.lineTo(mousePos.x + 22, mousePos.y);
        ctx.moveTo(mousePos.x, mousePos.y - 22);
        ctx.lineTo(mousePos.x, mousePos.y + 22);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = isAimingCamera ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.25)';
        ctx.fill();
        ctx.strokeStyle = isAimingCamera ? '#f59e0b' : '#38bdf8';
        ctx.setLineDash([]);
        ctx.stroke();

        // Crosshair tooltip label
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        const tipText = isPlacingCamera
          ? 'Click map to place camera'
          : isRelocatingCamera
          ? 'Click junction/road to relocate camera'
          : 'Click road/junction to aim camera';
        ctx.strokeText(tipText, mousePos.x + 14, mousePos.y - 12);
        ctx.fillText(tipText, mousePos.x + 14, mousePos.y - 12);

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);

  }, [
    viewport,
    mapState,
    cameras,
    activeCameraId,
    footprints,
    overlaps,
    blindSpotAnalysis,
    doriLayers,
    isSpecialMode,
    isPlacingCamera,
    isRelocatingCamera,
    isAimingCamera,
    mousePos,
    groundAlt,
    projectPoint
  ]);

  return (
    <>
      {/* Underlying Canvas for high-performance 60fps 3D rendering */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 100,
          pointerEvents: 'none'
        }}
      />

      {/* Interactive Layer for handling map clicks in placement, relocate, or aim mode */}
      {isSpecialMode && (
        <div
          className="cctv-interactive-layer"
          onClick={handleMapActionClick}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99990,
            pointerEvents: 'auto',
            cursor: 'crosshair'
          }}
        />
      )}

      {/* Special Mode Interactive Banner */}
      {isSpecialMode && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.96)',
            border: isAimingCamera ? '1px solid #f59e0b' : '1px solid #38bdf8',
            borderRadius: '24px',
            padding: '10px 22px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            zIndex: 99995,
            pointerEvents: 'auto'
          }}
        >
          <span>
            {isPlacingCamera && '📍 New Camera Mode: Click anywhere on Earth or Maps to drop camera'}
            {isRelocatingCamera && `📍 Move Camera: Click on the target junction or road on Earth to place ${activeCamera?.name || 'Camera'}`}
            {isAimingCamera && `🎯 Aiming ${activeCamera?.name || 'Camera'}: Click down the road to point camera`}
          </span>

          <button
            type="button"
            onClick={() => {
              setIsPlacingCamera(false);
              setIsRelocatingCamera(false);
              setIsAimingCamera(false);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              border: 'none',
              borderRadius: '12px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
};
