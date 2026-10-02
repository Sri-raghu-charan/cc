import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera } from '../../types/camera';
import { Layers, Eye, Compass, Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CoverageMapViewerProps {
  cameras: Camera[];
  activeCameraId: string | null;
  onSelectCamera: (id: string) => void;
  showDoriSettings: boolean;
  onToggleDoriSettings: () => void;
}

export const CoverageMapViewer: React.FC<CoverageMapViewerProps> = ({
  cameras,
  activeCameraId,
  onSelectCamera,
  showDoriSettings,
  onToggleDoriSettings
}) => {
  const [viewMode, setViewMode] = useState<'interactive' | 'satellite'>('interactive');
  const [hoveredCamId, setHoveredCamId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute bounding box of cameras
  const bounds = useMemo(() => {
    if (cameras.length === 0) {
      return { minLat: 16.98, maxLat: 17.02, minLng: 81.78, maxLng: 81.82 };
    }

    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;

    cameras.forEach((c) => {
      const lat = c.position.latitude;
      const lng = c.position.longitude;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    // Add 25% padding so sectors don't clip at edges
    const latSpan = Math.max(0.015, maxLat - minLat);
    const lngSpan = Math.max(0.02, maxLng - minLng);

    return {
      minLat: minLat - latSpan * 0.25,
      maxLat: maxLat + latSpan * 0.25,
      minLng: minLng - lngSpan * 0.25,
      maxLng: maxLng + lngSpan * 0.25
    };
  }, [cameras]);

  // Project lat/lng to canvas pixel coordinates
  const project = (lat: number, lng: number, width: number, height: number) => {
    const normX = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
    const normY = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);
    return {
      x: Math.max(10, Math.min(width - 10, normX * width)),
      y: Math.max(10, Math.min(height - 10, normY * height))
    };
  };

  // Render the dynamic GIS coverage area canvas
  useEffect(() => {
    if (viewMode !== 'interactive') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Draw clean GIS topographic basemap background
    ctx.fillStyle = '#0F172A'; // Deep GIS navy
    ctx.fillRect(0, 0, width, height);

    // Subtle GIS grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Stylized river/waterfront curve (Rajahmundry Godavari river simulation)
    ctx.beginPath();
    ctx.moveTo(0, height * 0.65);
    ctx.bezierCurveTo(width * 0.3, height * 0.7, width * 0.6, height * 0.45, width, height * 0.55);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(30, 58, 138, 0.35)'; // Deep aquatic blue
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Render each camera's proper ground coverage area from its fixed point
    cameras.forEach((cam) => {
      if (!cam.visible) return;

      const isSelected = cam.id === activeCameraId;
      const isHovered = cam.id === hoveredCamId;
      const pt = project(cam.position.latitude, cam.position.longitude, width, height);

      // Metric radius scaled to canvas pixels
      // Average 100m range ~ 36px on this scale
      const radiusPx = Math.max(22, Math.min(85, (cam.rangeMeters / 150) * 45));

      // Azimuth angle in canvas radians (0° = North = straight up -PI/2)
      const centerAngle = (cam.heading - 90) * (Math.PI / 180);
      const halfFovRad = ((cam.specs.selectedHfov || 90) / 2) * (Math.PI / 180);
      const startAngle = centerAngle - halfFovRad;
      const endAngle = centerAngle + halfFovRad;

      // Draw the true solid geometric coverage area sector
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.arc(pt.x, pt.y, radiusPx, startAngle, endAngle, false);
      ctx.closePath();

      // Create a smooth, professional GIS optical radial gradient from the fixed camera point outward
      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radiusPx);
      if (isSelected || isHovered) {
        grad.addColorStop(0, 'rgba(37, 99, 235, 0.50)');
        grad.addColorStop(0.65, 'rgba(37, 99, 235, 0.26)');
        grad.addColorStop(1, 'rgba(37, 99, 235, 0.08)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else {
        grad.addColorStop(0, 'rgba(34, 197, 94, 0.42)');
        grad.addColorStop(0.65, 'rgba(34, 197, 94, 0.22)');
        grad.addColorStop(1, 'rgba(34, 197, 94, 0.06)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#16A34A';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }

      // 3. Draw Camera Fixed Ground Point Pin
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#38BDF8' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Direction notch on camera base
      const notchX = pt.x + Math.cos(centerAngle) * 7;
      const notchY = pt.y + Math.sin(centerAngle) * 7;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(notchX, notchY);
      ctx.strokeStyle = isSelected ? '#38BDF8' : '#22C55E';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.restore();
  }, [cameras, activeCameraId, hoveredCamId, bounds, viewMode]);

  // Handle canvas mouse move for interactive hover tooltips
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let matched: Camera | null = null;
    for (let i = cameras.length - 1; i >= 0; i--) {
      const cam = cameras[i];
      const pt = project(cam.position.latitude, cam.position.longitude, rect.width, rect.height);
      const dist = Math.hypot(mouseX - pt.x, mouseY - pt.y);
      if (dist <= 16) {
        matched = cam;
        break;
      }
    }

    if (matched) {
      setHoveredCamId(matched.id);
      setTooltipPos({ x: mouseX, y: mouseY });
    } else {
      setHoveredCamId(null);
      setTooltipPos(null);
    }
  };

  const handleCanvasClick = () => {
    if (hoveredCamId) {
      onSelectCamera(hoveredCamId);
    }
  };

  const hoveredCam = cameras.find((c) => c.id === hoveredCamId);

  return (
    <div className="coverage-map-viewer-container">
      {/* View Switcher Toolbar */}
      <div className="coverage-map-toolbar">
        <div className="coverage-mode-pills">
          <button
            type="button"
            className={`coverage-mode-pill ${viewMode === 'interactive' ? 'active' : ''}`}
            onClick={() => setViewMode('interactive')}
          >
            🗺️ Dynamic Area
          </button>
          <button
            type="button"
            className={`coverage-mode-pill ${viewMode === 'satellite' ? 'active' : ''}`}
            onClick={() => setViewMode('satellite')}
          >
            🛰️ Satellite
          </button>
        </div>

        <button
          type="button"
          className="coverage-map-layer-btn"
          onClick={onToggleDoriSettings}
          title="Toggle DORI Layers"
        >
          <Layers size={13} />
        </button>
      </div>

      {/* Main Preview Card */}
      <div className="coverage-map-preview-card">
        {viewMode === 'satellite' ? (
          <img
            src="/coverage_map_preview.jpg"
            alt="Authentic CCTV GIS Coverage Map"
            className="coverage-map-img"
          />
        ) : (
          <div className="coverage-canvas-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas
              ref={canvasRef}
              className="coverage-map-canvas"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => {
                setHoveredCamId(null);
                setTooltipPos(null);
              }}
              onClick={handleCanvasClick}
              style={{ width: '100%', height: '100%', display: 'block', cursor: hoveredCamId ? 'pointer' : 'default' }}
            />

            {/* Interactive Hover Tooltip */}
            {hoveredCam && tooltipPos && (
              <div
                className="coverage-canvas-tooltip"
                style={{
                  position: 'absolute',
                  left: `${Math.min(240, tooltipPos.x + 12)}px`,
                  top: `${Math.max(10, tooltipPos.y - 28)}px`,
                  pointerEvents: 'none'
                }}
              >
                <div className="tooltip-name">{hoveredCam.name}</div>
                <div className="tooltip-meta">
                  Range: <strong>{hoveredCam.rangeMeters}m</strong> • {hoveredCam.specs.selectedHfov}° FOV
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exact GIS Legend */}
      <div className="coverage-map-legend">
        <div className="legend-item">
          <span className="legend-color-box box-coverage" />
          <span className="legend-label">Coverage Area</span>
        </div>

        <div className="legend-item">
          <span className="legend-color-box box-overlap" />
          <span className="legend-label">Overlap Area</span>
        </div>

        <div className="legend-item">
          <span className="legend-color-box box-blindspot" />
          <span className="legend-label">Blind Spot</span>
        </div>
      </div>
    </div>
  );
};
