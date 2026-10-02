import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { useCctv } from '../../context/CctvContext';
import { DORI_COLORS } from '../../geo/dori';
import { getCameraIconUri } from '../../utils/cameraIcons';
import { renderCameraCoverageSnapshot } from '../../utils/satelliteMapCapture';
import { Navigation, ZoomIn, ZoomOut, Compass as CompassIcon, RotateCcw, Globe2 } from 'lucide-react';

const BASE_LAYER_URLS = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  carto_dark: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  carto_light: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
};

/**
 * Creates an imagery provider with reliable maximum level limits
 * to prevent gray placeholder tiles ("Map data not yet available") when zooming close to ground.
 */
function createImageryProvider(layerKey: string): Cesium.ImageryProvider {
  if (layerKey === 'satellite') {
    return new Cesium.UrlTemplateImageryProvider({
      url: BASE_LAYER_URLS.satellite,
      maximumLevel: 18
    });
  }

  return new Cesium.UrlTemplateImageryProvider({
    url: BASE_LAYER_URLS[layerKey as keyof typeof BASE_LAYER_URLS] || BASE_LAYER_URLS.osm,
    maximumLevel: 19
  });
}

export const CesiumMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);

  const {
    cameras,
    activeCameraId,
    footprints,
    overlaps,
    planningPerimeter,
    blindSpotAnalysis,
    isPlacingCamera,
    setIsPlacingCamera,
    addCameraAtCoordinates,
    selectCamera,
    doriLayers,
    baseLayer,
    cesiumIonToken,
    flyToTarget,
    setFlyToTarget,
    registerSnapshotProvider
  } = useCctv();

  const [isViewerReady, setIsViewerReady] = useState<boolean>(false);

  // Initialize Cesium Viewer asynchronously after initial paint
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    let isCancelled = false;
    let retryTimer: any = null;

    const scheduleInit = typeof window.requestIdleCallback === 'function'
      ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 300 })
      : (fn: () => void) => setTimeout(fn, 120);

    const cancelSchedule = typeof window.cancelIdleCallback === 'function'
      ? (id: any) => window.cancelIdleCallback(id)
      : (id: any) => clearTimeout(id);

    const initViewer = () => {
      if (isCancelled || !containerRef.current || viewerRef.current) return;

      if (typeof Cesium === 'undefined' || !(window as any).Cesium) {
        retryTimer = setTimeout(initViewer, 30);
        return;
      }

      if (cesiumIonToken) {
        Cesium.Ion.defaultAccessToken = cesiumIonToken;
      }

      const initialImageryProvider = createImageryProvider(baseLayer);

      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: new Cesium.ImageryLayer(initialImageryProvider),
        animation: false,
        timeline: false,
        geocoder: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        homeButton: false,
        sceneModePicker: false,
        infoBox: false,
        selectionIndicator: false,
        fullscreenButton: false,
        scene3DOnly: true,
        orderIndependentTranslucency: false,
        shadows: false,
        skyBox: false,
        skyAtmosphere: false,
        creditContainer: document.createElement('div'),
        contextOptions: {
          webgl: {
            alpha: false,
            depth: true,
            stencil: false,
            antialias: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true
          }
        },
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity
      });

      // Configure globe visual settings
      viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.25);
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#080c14');
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      viewer.scene.globe.baseColor = Cesium.Color.BLACK;
      viewer.scene.fog.enabled = false;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 25;

      // Ensure tiles render as soon as they load over the network
      viewer.scene.globe.tileLoadProgressEvent.addEventListener((queueLength) => {
        if (queueLength === 0) {
          viewer.scene.requestRender();
        }
      });

      viewer.camera.moveEnd.addEventListener(() => {
        viewer.scene.requestRender();
      });

      viewerRef.current = viewer;

      // Yield before camera setView and rendering to break up the long task
      requestAnimationFrame(() => {
        if (isCancelled || !viewerRef.current) return;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0.0, 20.0, 22000000.0),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0
          }
        });
        setIsViewerReady(true);
      });
    };

    const handle = scheduleInit(initViewer);

    return () => {
      isCancelled = true;
      cancelSchedule(handle);
      if (retryTimer) clearTimeout(retryTimer);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  const currentBaseLayerRef = useRef(baseLayer);

  // Update base layer imagery provider
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !isViewerReady) return;
    if (currentBaseLayerRef.current === baseLayer) return;

    currentBaseLayerRef.current = baseLayer;
    viewer.imageryLayers.removeAll();
    const provider = createImageryProvider(baseLayer);
    viewer.imageryLayers.add(new Cesium.ImageryLayer(provider));
    viewer.scene.requestRender();
  }, [baseLayer, isViewerReady]);

  // Handle FlyTo requests
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !flyToTarget) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        flyToTarget.longitude,
        flyToTarget.latitude,
        Math.max(150, (flyToTarget.elevation || 0) + 200)
      ),
      duration: 1.5,
      complete: () => {
        viewer.scene.requestRender();
      }
    });

    setFlyToTarget(null);
  }, [flyToTarget, setFlyToTarget]);

  // Register Map Snapshot Provider for saving project with map snapshot of the covered camera region
  useEffect(() => {
    return registerSnapshotProvider(async () => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return null;

      try {
        viewer.render();
        const mainCanvas = viewer.scene.canvas;

        // 1. Determine target camera(s) to frame
        const targetCams = cameras.filter((c) => c.visible && (activeCameraId ? c.id === activeCameraId : true));
        if (targetCams.length === 0 && cameras.length > 0) {
          const visible = cameras.filter((c) => c.visible);
          targetCams.push(...(visible.length > 0 ? visible : [cameras[0]]));
        }

        // 2. Collect 2D window coordinates of camera and its covered footprint
        const screenPoints: { x: number; y: number }[] = [];
        targetCams.forEach((cam) => {
          const gPos = Cesium.Cartesian3.fromDegrees(cam.position.longitude, cam.position.latitude, 0);
          const gScr = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, gPos);
          if (gScr) screenPoints.push({ x: gScr.x, y: gScr.y });

          const lPos = Cesium.Cartesian3.fromDegrees(cam.position.longitude, cam.position.latitude, cam.mountingHeight);
          const lScr = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, lPos);
          if (lScr) screenPoints.push({ x: lScr.x, y: lScr.y });

          const fp = footprints.get(cam.id);
          if (fp && fp.coordinates) {
            fp.coordinates.forEach((coord) => {
              const cPos = Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, 0);
              const cScr = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cPos);
              if (cScr) screenPoints.push({ x: cScr.x, y: cScr.y });
            });
          }
        });

        const width = mainCanvas.width;
        const height = mainCanvas.height;

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

          const padX = Math.max(80, boxW * 0.35);
          const padY = Math.max(80, boxH * 0.35);

          cropX = Math.max(0, Math.floor(minX - padX));
          cropY = Math.max(0, Math.floor(minY - padY));
          cropW = Math.min(width - cropX, Math.ceil(boxW + padX * 2));
          cropH = Math.min(height - cropY, Math.ceil(boxH + padY * 2));

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

        const camToStamp = targetCams[0];
        if (!camToStamp) return mainCanvas.toDataURL('image/png');
        const fp = footprints.get(camToStamp.id);

        let cesiumImage: HTMLImageElement | null = null;
        try {
          const dataUrl = mainCanvas.toDataURL('image/png');
          cesiumImage = await new Promise<HTMLImageElement | null>((res) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => res(null);
            img.src = dataUrl;
          });
        } catch {
          // ignore
        }

        return await renderCameraCoverageSnapshot({
          camera: camToStamp,
          footprint: fp,
          doriLayers,
          capturedScreenImage: cesiumImage,
          capturedScreenCrop: {
            cropX,
            cropY,
            cropW,
            cropH,
            totalW: width,
            totalH: height
          },
          overlayCanvas: null,
          dpr: 1,
          targetWidth: Math.max(900, cropW),
          targetHeight: Math.max(600, cropH)
        });
      } catch (err) {
        console.warn('Cesium map snapshot capture error:', err);
        return null;
      }
    });
  }, [registerSnapshotProvider, isViewerReady, cameras, activeCameraId, footprints, doriLayers]);

  // Map Click Interactions (Placement & Selection)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (handlerRef.current) {
      handlerRef.current.destroy();
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click: any) => {
      // 1. If in placement mode: drop a new camera
      if (isPlacingCamera) {
        const ray = viewer.camera.getPickRay(click.position);
        if (!ray) return;
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          const lon = Cesium.Math.toDegrees(cartographic.longitude);
          const elev = cartographic.height || 0;

          const newCam = addCameraAtCoordinates({
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lon.toFixed(7)),
            elevation: Number(elev.toFixed(1))
          });
          selectCamera(newCam.id);
          setIsPlacingCamera(false);
        }
        return;
      }

      // 2. Otherwise: Check if a camera icon was clicked to select & fly to pinned location
      const picked = viewer.scene.pick(click.position);
      if (picked && picked.id) {
        const entityId = picked.id.id || picked.id;
        const matchedCamera = cameras.find(
          (c) =>
            entityId === c.id ||
            entityId === `${c.id}-marker` ||
            entityId === `${c.id}-label` ||
            entityId === `${c.id}-pole` ||
            entityId === `${c.id}-heading-arrow` ||
            entityId === `${c.id}-footprint` ||
            (typeof entityId === 'string' && entityId.startsWith(c.id))
        );
        if (matchedCamera) {
          selectCamera(matchedCamera.id);
          // Tap on camera to go directly to the camera location it pinned!
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              matchedCamera.position.longitude,
              matchedCamera.position.latitude,
              Math.max(160, (matchedCamera.position.elevation || 0) + 180)
            ),
            duration: 1.0
          });
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handlerRef.current = handler;

    return () => {
      if (handlerRef.current && !handlerRef.current.isDestroyed()) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
    };
  }, [isPlacingCamera, cameras, addCameraAtCoordinates, selectCamera, isViewerReady]);

  // Render 3D Camera Entities, Frustums, Sightlines, and DORI Zones
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.entities.removeAll();

    // 1. Render Active Cameras & Footprints
    cameras.forEach((camera) => {
      if (!camera.visible) return;

      const isSelected = camera.id === activeCameraId;
      const groundPos = Cesium.Cartesian3.fromDegrees(
        camera.position.longitude,
        camera.position.latitude,
        0
      );
      const lensPos = Cesium.Cartesian3.fromDegrees(
        camera.position.longitude,
        camera.position.latitude,
        camera.mountingHeight
      );

      // Camera Marker Icon & Label (Real camera icon clamped to ground at markup point)
      const formFactor = camera.specs?.formFactor || 'bullet';
      viewer.entities.add({
        id: `${camera.id}-marker`,
        position: groundPos,
        billboard: {
          image: getCameraIconUri(formFactor, camera.color, isSelected),
          width: isSelected ? 46 : 38,
          height: isSelected ? 54 : 44,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(100, 1.0, 5000, 0.6)
        },
        label: {
          text: `${camera.name} [${formFactor.toUpperCase()}]`,
          font: isSelected ? 'bold 12px sans-serif' : '11px sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: isSelected ? Cesium.Color.fromCssColorString('#38bdf8') : Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, isSelected ? -58 : -48),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(100, 1.0, 4000, 0.6)
        }
      });

      // 3. Vertical Camera Mounting Pole from ground markup point up to lens
      viewer.entities.add({
        id: `${camera.id}-pole`,
        polyline: {
          positions: [groundPos, lensPos],
          width: isSelected ? 4 : 2,
          material: Cesium.Color.fromCssColorString(isSelected ? '#60a5fa' : '#94a3b8')
        }
      });

      // Frustum Ground Coverage Area - radiating from fixed camera point to optical reach
      const fp = footprints.get(camera.id);
      if (fp && fp.coordinates.length >= 3) {
        // Flattened degrees array [lon0, lat0, lon1, lat1, ...]
        const flatCoords: number[] = [];
        fp.coordinates.forEach((v) => {
          flatCoords.push(v.longitude, v.latitude);
        });

        // Main Footprint Polygon clamped strictly to ground showing true covered area
        if (doriLayers.maxGeometric) {
          const coverageColor = isSelected ? '#2563EB' : '#16A34A';
          viewer.entities.add({
            id: `${camera.id}-footprint`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flatCoords),
              material: Cesium.Color.fromCssColorString(coverageColor).withAlpha(isSelected ? 0.32 : 0.22),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString(coverageColor).withAlpha(0.9),
              outlineWidth: isSelected ? 2.5 : 1.5,
              classificationType: Cesium.ClassificationType.BOTH
            }
          });
        }

        // DORI Sub-Zones
        const renderSubZone = (
          idSuffix: string,
          vertices: typeof fp.coordinates,
          colorHex: string,
          alpha: number
        ) => {
          if (!vertices || vertices.length < 3) return;
          const coords: number[] = [];
          vertices.forEach((v) => coords.push(v.longitude, v.latitude));
          viewer.entities.add({
            id: `${camera.id}-${idSuffix}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(coords),
              material: Cesium.Color.fromCssColorString(colorHex).withAlpha(alpha),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString(colorHex).withAlpha(0.9),
              outlineWidth: 1,
              classificationType: Cesium.ClassificationType.BOTH
            }
          });
        };

        if (doriLayers.identification && fp.doriZones.identification.length >= 3) {
          renderSubZone('dori-id', fp.doriZones.identification, DORI_COLORS.IDENTIFICATION, 0.45);
        }
        if (doriLayers.recognition && fp.doriZones.recognition.length >= 3) {
          renderSubZone('dori-rec', fp.doriZones.recognition, DORI_COLORS.RECOGNITION, 0.35);
        }
        if (doriLayers.observation && fp.doriZones.observation.length >= 3) {
          renderSubZone('dori-obs', fp.doriZones.observation, DORI_COLORS.OBSERVATION, 0.25);
        }
        if (doriLayers.detection && fp.doriZones.detection.length >= 3) {
          renderSubZone('dori-det', fp.doriZones.detection, DORI_COLORS.DETECTION, 0.2);
        }
      }
    });

    // 2. Render Overlapping Polygons
    overlaps.forEach((ov, idx) => {
      if (ov.overlapPolygon && ov.overlapPolygon.length >= 3) {
        const flat: number[] = [];
        ov.overlapPolygon.forEach((v) => flat.push(v.longitude, v.latitude));
        viewer.entities.add({
          id: `overlap-${idx}`,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
            material: Cesium.Color.fromCssColorString('#a855f7').withAlpha(0.4),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#d8b4fe'),
            outlineWidth: 2
          }
        });
      }
    });

    // 3. Render Planning Perimeter
    if (planningPerimeter && planningPerimeter.coordinates.length >= 3) {
      const perimCoords: number[] = [];
      planningPerimeter.coordinates.forEach((v) => perimCoords.push(v.longitude, v.latitude));

      viewer.entities.add({
        id: 'planning-perimeter',
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(perimCoords),
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.YELLOW
          })
        }
      });
    }

    // 4. Render Blind Spot Unmonitored Zones
    if (blindSpotAnalysis && blindSpotAnalysis.blindSpotPolygons.length > 0) {
      blindSpotAnalysis.blindSpotPolygons.forEach((poly, idx) => {
        if (poly.length >= 3) {
          const flat: number[] = [];
          poly.forEach((v) => flat.push(v.longitude, v.latitude));
          viewer.entities.add({
            id: `blind-spot-${idx}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
              material: Cesium.Color.RED.withAlpha(0.25),
              outline: true,
              outlineColor: Cesium.Color.RED.withAlpha(0.8),
              outlineWidth: 1
            }
          });
        }
      });
    }
    viewer.scene.requestRender();
  }, [
    cameras,
    activeCameraId,
    footprints,
    overlaps,
    planningPerimeter,
    blindSpotAnalysis,
    doriLayers,
    isViewerReady
  ]);

  // Map Navigation Tools
  const handleZoom = (inOut: 'in' | 'out') => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const factor = inOut === 'in' ? 0.6 : 1.6;
    const currentHeight = viewer.camera.positionCartographic.height;
    if (inOut === 'in' && currentHeight <= 35) return;
    const zoomAmount = inOut === 'in'
      ? Math.max(15, currentHeight * (1 - factor))
      : currentHeight * (factor - 1);
    if (inOut === 'in') {
      viewer.camera.zoomIn(zoomAmount);
    } else {
      viewer.camera.zoomOut(zoomAmount);
    }
    viewer.scene.requestRender();
  };

  const handleResetNorth = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: viewer.camera.position,
      orientation: {
        heading: 0,
        pitch: viewer.camera.pitch,
        roll: 0
      },
      duration: 1.0
    });
  };

  const handleViewWholeGlobe = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0.0, 20.0, 22000000.0),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0
      },
      duration: 1.5
    });
  };

  return (
    <div className="map-viewport">
      <div id="cesiumContainer" ref={containerRef} />

      {/* Floating Mode Overlay */}
      <div className="map-floating-overlay">
        {isPlacingCamera && (
          <div className="placement-banner">
            <span>Click anywhere on the 3D globe to place camera</span>
            <button
              className="btn btn-secondary btn-icon-only"
              style={{ padding: '2px 6px', fontSize: '11px', background: 'rgba(0,0,0,0.4)' }}
              onClick={() => setIsPlacingCamera(false)}
              aria-label="Cancel camera placement mode"
              type="button"
            >
              Cancel
            </button>
          </div>
        )}

        {/* DORI Status Pills */}
        <div className="floating-card dori-legend">
          <div className="dori-chip">
            <span className="dori-dot" style={{ background: DORI_COLORS.IDENTIFICATION }} />
            <span>ID (250 px/m)</span>
          </div>
          <div className="dori-chip">
            <span className="dori-dot" style={{ background: DORI_COLORS.RECOGNITION }} />
            <span>Recog (125 px/m)</span>
          </div>
          <div className="dori-chip">
            <span className="dori-dot" style={{ background: DORI_COLORS.OBSERVATION }} />
            <span>Obs (62.5 px/m)</span>
          </div>
          <div className="dori-chip">
            <span className="dori-dot" style={{ background: DORI_COLORS.DETECTION }} />
            <span>Det (25 px/m)</span>
          </div>
        </div>
      </div>

      {/* Floating 3D Navigation Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 40
        }}
      >
        <button
          className="btn btn-secondary btn-icon-only"
          onClick={handleViewWholeGlobe}
          title="View Whole Globe from space"
          aria-label="View Whole Globe from space"
          type="button"
        >
          <Globe2 size={18} />
        </button>
        <button
          className="btn btn-secondary btn-icon-only"
          onClick={() => handleZoom('in')}
          title="Zoom in 3D map"
          aria-label="Zoom in 3D map"
          type="button"
        >
          <ZoomIn size={18} />
        </button>
        <button
          className="btn btn-secondary btn-icon-only"
          onClick={() => handleZoom('out')}
          title="Zoom out 3D map"
          aria-label="Zoom out 3D map"
          type="button"
        >
          <ZoomOut size={18} />
        </button>
        <button
          className="btn btn-secondary btn-icon-only"
          onClick={handleResetNorth}
          title="Reset map orientation to North"
          aria-label="Reset map orientation to North"
          type="button"
        >
          <CompassIcon size={18} />
        </button>
      </div>
    </div>
  );
};

export default CesiumMap;
