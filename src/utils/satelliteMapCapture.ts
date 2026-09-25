/**
 * Satellite Map Imagery Service
 * Fetches real high-resolution satellite imagery for camera coverage regions
 * using ArcGIS World Imagery (Free global satellite basemap, CORS enabled).
 * Generates rich, georeferenced coverage snapshots with real satellite photographs.
 */

import { Camera, Coordinates, FootprintGeometry, FootprintVertex } from '../types/camera';
import { DORI_COLORS } from '../geo/dori';

export interface BoundingBox4326 {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/**
 * Calculates geographic WGS84 bounding box encompassing a camera and its coverage footprint.
 */
export function computeCameraCoverageBbox(
  cameraPos: Coordinates,
  fp?: FootprintGeometry | null,
  paddingRatio: number = 0.20
): BoundingBox4326 {
  let minLon = cameraPos.longitude;
  let maxLon = cameraPos.longitude;
  let minLat = cameraPos.latitude;
  let maxLat = cameraPos.latitude;

  if (fp && fp.coordinates && fp.coordinates.length > 0) {
    fp.coordinates.forEach((pt) => {
      if (pt.longitude < minLon) minLon = pt.longitude;
      if (pt.longitude > maxLon) maxLon = pt.longitude;
      if (pt.latitude < minLat) minLat = pt.latitude;
      if (pt.latitude > maxLat) maxLat = pt.latitude;
    });

    if (fp.doriZones) {
      const allZones = [
        fp.doriZones.identification,
        fp.doriZones.recognition,
        fp.doriZones.observation,
        fp.doriZones.detection
      ];
      allZones.forEach((zone) => {
        if (zone) {
          zone.forEach((pt) => {
            if (pt.longitude < minLon) minLon = pt.longitude;
            if (pt.longitude > maxLon) maxLon = pt.longitude;
            if (pt.latitude < minLat) minLat = pt.latitude;
            if (pt.latitude > maxLat) maxLat = pt.latitude;
          });
        }
      });
    }
  } else {
    // Default ~80m coverage box if no footprint
    const delta = 0.0008;
    minLon -= delta;
    maxLon += delta;
    minLat -= delta;
    maxLat += delta;
  }

  const spanLon = Math.max(0.0004, maxLon - minLon);
  const spanLat = Math.max(0.0004, maxLat - minLat);

  const padLon = spanLon * paddingRatio;
  const padLat = spanLat * paddingRatio;

  return {
    minLon: minLon - padLon,
    minLat: minLat - padLat,
    maxLon: maxLon + padLon,
    maxLat: maxLat + padLat
  };
}

/**
 * Fetches real high-resolution satellite imagery for an exact bounding box.
 */
export async function fetchSatelliteBboxImage(
  bbox: BoundingBox4326,
  targetWidth: number = 1000,
  targetHeight: number = 700
): Promise<HTMLImageElement | null> {
  const w = Math.max(320, Math.min(2048, Math.round(targetWidth)));
  const h = Math.max(240, Math.min(2048, Math.round(targetHeight)));

  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox.minLon.toFixed(7)},${bbox.minLat.toFixed(7)},${bbox.maxLon.toFixed(7)},${bbox.maxLat.toFixed(7)}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=png&f=image`;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('Satellite imagery fetch failed for bbox:', bbox);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Tests if an image/canvas is predominantly blank/pitch black (e.g. from failed tab capture or unrendered WebGL)
 */
export function isImageBlank(img: HTMLImageElement | HTMLCanvasElement): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 32;
    testCanvas.height = 32;
    const ctx = testCanvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let totalBrightness = 0;
    let nonZeroCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a > 10) {
        nonZeroCount++;
        const b = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        totalBrightness += b;
      }
    }
    if (nonZeroCount < 32 * 32 * 0.2) return true; // mostly transparent
    const avgBrightness = totalBrightness / Math.max(1, nonZeroCount);
    // Dark void background like #0f172a or #000000 has brightness < 16
    return avgBrightness < 16;
  } catch {
    return false;
  }
}

export interface RenderCoverageSnapshotOptions {
  camera: Camera;
  footprint?: FootprintGeometry | null;
  doriLayers?: {
    identification?: boolean;
    recognition?: boolean;
    observation?: boolean;
    detection?: boolean;
    maxGeometric?: boolean;
  };
  capturedScreenImage?: HTMLImageElement | null;
  capturedScreenCrop?: {
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
    totalW: number;
    totalH: number;
  };
  overlayCanvas?: HTMLCanvasElement | null;
  dpr?: number;
  targetWidth?: number;
  targetHeight?: number;
}

/**
 * Generates a complete, high-resolution camera coverage snapshot
 * with the REAL Earth satellite photograph underneath and DORI zones projected on top.
 */
export async function renderCameraCoverageSnapshot(
  options: RenderCoverageSnapshotOptions
): Promise<string> {
  const {
    camera,
    footprint,
    doriLayers = { identification: true, recognition: true, observation: true, detection: true, maxGeometric: true },
    capturedScreenImage,
    capturedScreenCrop,
    overlayCanvas,
    dpr = 1,
    targetWidth = 1100,
    targetHeight = 720
  } = options;

  const w = Math.round(targetWidth);
  const h = Math.round(targetHeight);

  // Check if captured screen image is available and NOT blank
  const hasValidScreen =
    capturedScreenImage &&
    capturedScreenCrop &&
    overlayCanvas &&
    !isImageBlank(capturedScreenImage);

  if (hasValidScreen && capturedScreenCrop) {
    // We have a genuine 3D Google Earth / Map screenshot
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(capturedScreenCrop.cropW * dpr);
    offscreen.height = Math.round(capturedScreenCrop.cropH * dpr);
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      const imgScaleX = capturedScreenImage.naturalWidth / capturedScreenCrop.totalW;
      const imgScaleY = capturedScreenImage.naturalHeight / capturedScreenCrop.totalH;

      ctx.drawImage(
        capturedScreenImage,
        capturedScreenCrop.cropX * imgScaleX,
        capturedScreenCrop.cropY * imgScaleY,
        capturedScreenCrop.cropW * imgScaleX,
        capturedScreenCrop.cropH * imgScaleY,
        0,
        0,
        offscreen.width,
        offscreen.height
      );

      // Draw overlay canvas
      ctx.drawImage(
        overlayCanvas,
        capturedScreenCrop.cropX * dpr,
        capturedScreenCrop.cropY * dpr,
        capturedScreenCrop.cropW * dpr,
        capturedScreenCrop.cropH * dpr,
        0,
        0,
        offscreen.width,
        offscreen.height
      );

      // Draw Telemetry Banner
      drawTelemetryBanner(ctx, offscreen.width, offscreen.height, camera, footprint, dpr);
      return offscreen.toDataURL('image/png');
    }
  }

  // Fallback or Primary: Render on High-Resolution ArcGIS Satellite Imagery
  const bbox = computeCameraCoverageBbox(camera.position, footprint, 0.20);
  const satelliteImg = await fetchSatelliteBboxImage(bbox, w, h);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Draw Satellite Map Background
  if (satelliteImg) {
    ctx.drawImage(satelliteImg, 0, 0, w, h);
  } else {
    // High-tech tactical dark grid if completely offline
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  // Geographic projection helper
  const lonSpan = bbox.maxLon - bbox.minLon;
  const latSpan = bbox.maxLat - bbox.minLat;
  const toPx = (lon: number, lat: number) => ({
    x: ((lon - bbox.minLon) / lonSpan) * w,
    y: ((bbox.maxLat - lat) / latSpan) * h
  });

  const camPx = toPx(camera.position.longitude, camera.position.latitude);

  // Helper to draw projected polygon
  const drawPolygon = (
    pts: FootprintVertex[],
    fillStyle: string,
    strokeStyle: string,
    lineWidth: number = 2
  ) => {
    if (!pts || pts.length < 3) return;
    const pxs = pts.map((p) => toPx(p.longitude, p.latitude));
    ctx.beginPath();
    ctx.moveTo(pxs[0].x, pxs[0].y);
    for (let i = 1; i < pxs.length; i++) {
      ctx.lineTo(pxs[i].x, pxs[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  // 2. Draw DORI Coverage Zones directly onto real satellite map
  if (footprint) {
    // Detection Zone (Outer)
    if (doriLayers.detection !== false && footprint.doriZones?.detection?.length >= 3) {
      drawPolygon(footprint.doriZones.detection, 'rgba(59, 130, 246, 0.22)', DORI_COLORS.DETECTION, 1.8);
    }

    // Observation Zone
    if (doriLayers.observation !== false && footprint.doriZones?.observation?.length >= 3) {
      drawPolygon(footprint.doriZones.observation, 'rgba(234, 179, 8, 0.28)', DORI_COLORS.OBSERVATION, 2.0);
    }

    // Recognition Zone
    if (doriLayers.recognition !== false && footprint.doriZones?.recognition?.length >= 3) {
      drawPolygon(footprint.doriZones.recognition, 'rgba(245, 158, 11, 0.35)', DORI_COLORS.RECOGNITION, 2.2);
    }

    // Identification Zone (Inner)
    if (doriLayers.identification !== false && footprint.doriZones?.identification?.length >= 3) {
      drawPolygon(footprint.doriZones.identification, 'rgba(239, 68, 68, 0.42)', DORI_COLORS.IDENTIFICATION, 2.4);
    }

    // Geometric Footprint Boundary (Outer reach)
    if (doriLayers.maxGeometric !== false && footprint.coordinates?.length >= 3) {
      drawPolygon(
        footprint.coordinates,
        'rgba(56, 189, 248, 0.10)',
        camera.color || '#38bdf8',
        2.5
      );
    }

    // 3. Draw Optical Center Sightline Rays
    if (footprint.coordinates?.length >= 3) {
      const farIdx = Math.floor(footprint.coordinates.length / 2);
      const farMid = footprint.coordinates[farIdx];
      const leftPt = footprint.coordinates[0];
      const rightPt = footprint.coordinates[footprint.coordinates.length - 1];

      // Side FOV boundary lines
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = camera.color || 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.5;

      const leftPx = toPx(leftPt.longitude, leftPt.latitude);
      ctx.beginPath();
      ctx.moveTo(camPx.x, camPx.y);
      ctx.lineTo(leftPx.x, leftPx.y);
      ctx.stroke();

      const rightPx = toPx(rightPt.longitude, rightPt.latitude);
      ctx.beginPath();
      ctx.moveTo(camPx.x, camPx.y);
      ctx.lineTo(rightPx.x, rightPx.y);
      ctx.stroke();

      // Central optical aiming axis
      if (farMid) {
        const farPx = toPx(farMid.longitude, farMid.latitude);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(camPx.x, camPx.y);
        ctx.lineTo(farPx.x, farPx.y);
        ctx.stroke();

        // Arrow head at optical center
        const angle = Math.atan2(farPx.y - camPx.y, farPx.x - camPx.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(farPx.x, farPx.y);
        ctx.lineTo(farPx.x - headLen * Math.cos(angle - Math.PI / 6), farPx.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(farPx.x - headLen * Math.cos(angle + Math.PI / 6), farPx.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Draw DORI Distance Badges along the zones
    const drawBadge = (pts: FootprintVertex[], label: string, color: string) => {
      if (!pts || pts.length < 3) return;
      const mid = pts[Math.floor(pts.length / 2)];
      if (!mid) return;
      const p = toPx(mid.longitude, mid.latitude);

      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      const tw = ctx.measureText(label).width;
      const bw = tw + 14;
      const bh = 20;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(p.x - bw / 2, p.y - bh / 2, bw, bh, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, p.x, p.y);
      ctx.restore();
    };

    if (footprint.doriZones?.identification?.length >= 3) {
      drawBadge(footprint.doriZones.identification, `ID: ${camera.specs.datasheetDori?.identifyMeters || '7'}m (Face)`, '#ef4444');
    }
    if (footprint.doriZones?.recognition?.length >= 3) {
      drawBadge(footprint.doriZones.recognition, `Rec: ${camera.specs.datasheetDori?.recognizeMeters || '15'}m (Plates)`, '#f59e0b');
    }
    if (footprint.doriZones?.observation?.length >= 3) {
      drawBadge(footprint.doriZones.observation, `Obs: ${camera.specs.datasheetDori?.observeMeters || '30'}m (IR Limit)`, '#eab308');
    }
    if (footprint.coordinates?.length >= 3) {
      const reach = camera.specs.datasheetDori?.detectMeters || footprint.farDistanceMeters.toFixed(0);
      drawBadge(footprint.coordinates, `Detect: ${reach}m (Motion Only)`, '#38bdf8');
    }
  }

  // 5. Draw Camera Pinned Marker Markup
  ctx.save();
  // Radial pulse glow
  const glow = ctx.createRadialGradient(camPx.x, camPx.y, 4, camPx.x, camPx.y, 22);
  glow.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
  glow.addColorStop(0.5, 'rgba(56, 189, 248, 0.2)');
  glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(camPx.x, camPx.y, 22, 0, Math.PI * 2);
  ctx.fill();

  // Solid Camera Pin Circle
  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(camPx.x, camPx.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Heading direction pointer on camera pin
  const rad = ((camera.heading - 90) * Math.PI) / 180;
  const hLen = 22;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(camPx.x, camPx.y);
  ctx.lineTo(camPx.x + Math.cos(rad) * hLen, camPx.y + Math.sin(rad) * hLen);
  ctx.stroke();

  // Camera Name Label
  ctx.font = 'bold 11px sans-serif';
  const nameWidth = ctx.measureText(camera.name).width;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(camPx.x - nameWidth / 2 - 8, camPx.y + 16, nameWidth + 16, 20, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(camera.name, camPx.x, camPx.y + 26);
  ctx.restore();

  // 6. Draw North Compass Rose (top-right corner)
  ctx.save();
  const compassX = w - 46;
  const compassY = 46;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(compassX, compassY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // North needle
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(compassX, compassY - 16);
  ctx.lineTo(compassX + 5, compassY);
  ctx.lineTo(compassX - 5, compassY);
  ctx.closePath();
  ctx.fill();

  // South needle
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(compassX, compassY + 16);
  ctx.lineTo(compassX + 5, compassY);
  ctx.lineTo(compassX - 5, compassY);
  ctx.closePath();
  ctx.fill();

  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', compassX, compassY - 17);
  ctx.restore();

  // 7. Draw Professional Telemetry Stamp Banner at the bottom
  drawTelemetryBanner(ctx, w, h, camera, footprint, 1);

  return canvas.toDataURL('image/png');
}

/**
 * Draws the professional engineering telemetry metadata watermark banner
 */
function drawTelemetryBanner(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  camera: Camera,
  footprint?: FootprintGeometry | null,
  dpr: number = 1
) {
  const bannerH = Math.round(48 * dpr);
  const bannerY = canvasH - bannerH;

  // Dark glass gradient
  const grad = ctx.createLinearGradient(0, bannerY - 10 * dpr, 0, canvasH);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
  grad.addColorStop(0.35, 'rgba(15, 23, 42, 0.88)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bannerY - 10 * dpr, canvasW, bannerH + 10 * dpr);

  // Top Line: Camera Name, Model, Form factor
  ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const titleText = `📹 ${camera.name} • ${camera.specs.modelName || 'CCTV'} [${(camera.specs.formFactor || 'bullet').toUpperCase()}]`;
  ctx.fillText(titleText, 16 * dpr, bannerY + bannerH * 0.32);

  // Bottom Line: Geographic Coordinates, Height, Tilt, Azimuth
  ctx.font = `${Math.round(10 * dpr)}px monospace`;
  ctx.fillStyle = '#94a3b8';
  const subText = `${camera.position.latitude.toFixed(6)}°, ${camera.position.longitude.toFixed(6)}° • Mounting H: ${camera.mountingHeight}m • Tilt: ${Math.round(camera.tilt)}° • Azimuth: ${Math.round(camera.heading)}°`;
  ctx.fillText(subText, 16 * dpr, bannerY + bannerH * 0.72);

  // Right Side: Coverage Distance & Area
  ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'right';
  const reach = footprint ? footprint.farDistanceMeters.toFixed(0) : camera.rangeMeters;
  const area = footprint ? ` (${Math.round(footprint.totalAreaM2).toLocaleString()} m²)` : '';
  ctx.fillText(`Coverage: ${reach}m${area}`, canvasW - 16 * dpr, bannerY + bannerH * 0.32);

  ctx.font = `${Math.round(9.5 * dpr)}px sans-serif`;
  ctx.fillStyle = '#64748b';
  ctx.fillText('ArcGIS World Imagery • IEC/EN 62676-4', canvasW - 16 * dpr, bannerY + bannerH * 0.72);
}
