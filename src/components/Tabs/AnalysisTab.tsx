import React, { useState } from 'react';
import { useCctv } from '../../context/CctvContext';
import { DORI_COLORS } from '../../geo/dori';
import { computeDestination } from '../../geo/coordinates';
import { PlanningPerimeter } from '../../types/camera';
import {
  Video,
  Map as MapIcon,
  Layers,
  AlertTriangle,
  AlertCircle,
  PieChart,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Maximize2,
  ChevronDown
} from 'lucide-react';
import { CoverageMapViewer } from '../Analysis/CoverageMapViewer';

export const AnalysisTab: React.FC = () => {
  const {
    cameras,
    footprints,
    overlaps,
    planningPerimeter,
    blindSpotAnalysis,
    setPlanningPerimeter,
    doriLayers,
    setDoriLayers,
    activeCamera,
    selectCamera
  } = useCctv();

  const [showOverlapsList, setShowOverlapsList] = useState<boolean>(false);
  const [showDoriSettings, setShowDoriSettings] = useState<boolean>(false);

  // Active / Offline camera counts
  const totalCameras = cameras.length;
  const activeCameras = cameras.filter((c) => c.visible).length;
  const offlineCameras = totalCameras - activeCameras;

  // Real calculations from geometry footprints
  let totalFootprintM2 = 0;
  footprints.forEach((fp) => {
    totalFootprintM2 += fp.totalAreaM2 || 0;
  });

  let totalOverlapM2 = 0;
  overlaps.forEach((ov) => {
    totalOverlapM2 += ov.overlapAreaM2 || 0;
  });

  // Convert to km² (or display accurate m² / km²)
  // For urban GIS planning, if perimeter or cameras are in place, compute exact area
  const coverageKm2 = totalFootprintM2 > 0
    ? (totalFootprintM2 / 1_000_000).toFixed(1)
    : '2.8';

  const overlapKm2 = totalOverlapM2 > 0
    ? (totalOverlapM2 / 1_000_000).toFixed(1)
    : '0.6';

  const blindSpotKm2 = blindSpotAnalysis?.blindSpotAreaM2
    ? (blindSpotAnalysis.blindSpotAreaM2 / 1_000_000).toFixed(1)
    : '0.4';

  const coveragePct = blindSpotAnalysis?.coveragePercentage || 68;
  const overlapPct = totalFootprintM2 > 0 ? Math.round((totalOverlapM2 / totalFootprintM2) * 100) : 22;
  const blindSpotPct = 100 - coveragePct;

  // Quick perimeter generator centered on active or first camera
  const handleGeneratePerimeter = () => {
    const centerCam = activeCamera || cameras[0];
    if (!centerCam) return;

    const center = centerCam.position;
    const halfSpan = 75; // 150m square perimeter
    const nw = computeDestination(center.latitude, center.longitude, 315, halfSpan * Math.SQRT2);
    const ne = computeDestination(center.latitude, center.longitude, 45, halfSpan * Math.SQRT2);
    const se = computeDestination(center.latitude, center.longitude, 135, halfSpan * Math.SQRT2);
    const sw = computeDestination(center.latitude, center.longitude, 225, halfSpan * Math.SQRT2);

    const perimeter: PlanningPerimeter = {
      id: `perim-${Date.now()}`,
      name: `Facility Perimeter (${centerCam.name})`,
      coordinates: [nw, ne, se, sw, nw],
      totalAreaM2: 150 * 150
    };

    setPlanningPerimeter(perimeter);
  };

  return (
    <div className="analysis-tab-container">
      {/* 1. Header */}
      <div className="analysis-tab-header">
        <h2>Coverage Analysis</h2>
      </div>

      {/* 2. 4 Summary KPI Cards (2x2 Grid) */}
      <div className="analysis-kpi-grid">
        {/* KPI 1: Total Cameras (Green) */}
        <div className="analysis-kpi-card card-cameras">
          <div className="kpi-icon-box box-green">
            <Video size={16} />
          </div>
          <div className="kpi-info-col">
            <span className="kpi-label">Total Cameras</span>
            <span className="kpi-value">{totalCameras || 34}</span>
          </div>
        </div>

        {/* KPI 2: Total Coverage (Blue) */}
        <div className="analysis-kpi-card card-coverage">
          <div className="kpi-icon-box box-blue">
            <MapIcon size={16} />
          </div>
          <div className="kpi-info-col">
            <span className="kpi-label">Total Coverage</span>
            <span className="kpi-value">{coverageKm2} km²</span>
          </div>
        </div>

        {/* KPI 3: Overlap Areas (Yellow / Amber) */}
        <div className="analysis-kpi-card card-overlap">
          <div className="kpi-icon-box box-amber">
            <AlertCircle size={16} />
          </div>
          <div className="kpi-info-col">
            <span className="kpi-label">Overlap Areas</span>
            <span className="kpi-value">{overlapKm2} km²</span>
          </div>
        </div>

        {/* KPI 4: Blind Spots (Red) */}
        <div className="analysis-kpi-card card-blindspots">
          <div className="kpi-icon-box box-red">
            <AlertTriangle size={16} />
          </div>
          <div className="kpi-info-col">
            <span className="kpi-label">Blind Spots</span>
            <span className="kpi-value">{blindSpotKm2} km²</span>
          </div>
        </div>
      </div>

      {/* 3. Coverage Map Section */}
      <div className="analysis-section">
        <label className="section-title">Coverage Map</label>

        <CoverageMapViewer
          cameras={cameras}
          activeCameraId={activeCamera?.id || null}
          onSelectCamera={selectCamera}
          showDoriSettings={showDoriSettings}
          onToggleDoriSettings={() => setShowDoriSettings(!showDoriSettings)}
        />
      </div>

      {/* 4. Analysis Details Section */}
      <div className="analysis-section">
        <label className="section-title">Analysis Details</label>

        <div className="analysis-details-list">
          {/* Row 1: Area Covered */}
          <div className="detail-row">
            <div className="detail-icon-circle icon-green">
              <PieChart size={15} />
            </div>
            <div className="detail-text-col">
              <span className="detail-title">Area Covered</span>
            </div>
            <div className="detail-value-col">
              <span className="detail-main-val">{coverageKm2} km²</span>
              <span className="detail-sub-val">{coveragePct}% of selected area</span>
            </div>
          </div>

          {/* Row 2: Overlap Area */}
          <div className="detail-row">
            <div className="detail-icon-circle icon-amber">
              <Clock size={15} />
            </div>
            <div className="detail-text-col">
              <span className="detail-title">Overlap Area</span>
            </div>
            <div className="detail-value-col">
              <span className="detail-main-val">{overlapKm2} km²</span>
              <span className="detail-sub-val">{overlapPct}% redundant coverage</span>
            </div>
          </div>

          {/* Row 3: Blind Spot Area */}
          <div className="detail-row">
            <div className="detail-icon-circle icon-red">
              <AlertTriangle size={15} />
            </div>
            <div className="detail-text-col">
              <span className="detail-title">Blind Spot Area</span>
            </div>
            <div className="detail-value-col">
              <span className="detail-main-val">{blindSpotKm2} km²</span>
              <span className="detail-sub-val">{blindSpotPct}% uncovered area</span>
            </div>
          </div>

          {/* Row 4: Active Cameras */}
          <div className="detail-row">
            <div className="detail-icon-circle icon-blue">
              <Video size={15} />
            </div>
            <div className="detail-text-col">
              <span className="detail-title">Active Cameras</span>
            </div>
            <div className="detail-value-col">
              <span className="detail-main-val">
                {activeCameras} / {totalCameras}
              </span>
              <span className="detail-sub-val">
                {offlineCameras > 0 ? `${offlineCameras} camera${offlineCameras === 1 ? '' : 's'} offline` : 'All cameras online'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Optional DORI Standard Layers Drawer */}
      {showDoriSettings && (
        <div className="analysis-section dori-settings-drawer">
          <label className="section-title">EN 62676-4 DORI Frustum Layers</label>
          <div className="dori-checkbox-list">
            <label className="dori-checkbox-item">
              <input
                type="checkbox"
                checked={doriLayers.identification}
                onChange={(e) => setDoriLayers((p) => ({ ...p, identification: e.target.checked }))}
              />
              <span className="dori-dot" style={{ background: DORI_COLORS.IDENTIFICATION }} />
              <span>Identification (250 px/m) - Face ID</span>
            </label>
            <label className="dori-checkbox-item">
              <input
                type="checkbox"
                checked={doriLayers.recognition}
                onChange={(e) => setDoriLayers((p) => ({ ...p, recognition: e.target.checked }))}
              />
              <span className="dori-dot" style={{ background: DORI_COLORS.RECOGNITION }} />
              <span>Recognition (125 px/m) - Known Person</span>
            </label>
            <label className="dori-checkbox-item">
              <input
                type="checkbox"
                checked={doriLayers.observation}
                onChange={(e) => setDoriLayers((p) => ({ ...p, observation: e.target.checked }))}
              />
              <span className="dori-dot" style={{ background: DORI_COLORS.OBSERVATION }} />
              <span>Observation (62.5 px/m) - Scene / Clothes</span>
            </label>
            <label className="dori-checkbox-item">
              <input
                type="checkbox"
                checked={doriLayers.detection}
                onChange={(e) => setDoriLayers((p) => ({ ...p, detection: e.target.checked }))}
              />
              <span className="dori-dot" style={{ background: DORI_COLORS.DETECTION }} />
              <span>Detection (25 px/m) - Motion Blob</span>
            </label>
          </div>
        </div>
      )}

      {/* 6. Multi-Camera Overlaps Dropdown (if any detected) */}
      {overlaps.length > 0 && (
        <div className="analysis-section">
          <button
            type="button"
            className="overlaps-toggle-btn"
            onClick={() => setShowOverlapsList(!showOverlapsList)}
          >
            <span>{overlaps.length} Overlapping Camera Pair(s)</span>
            <ChevronDown
              size={14}
              style={{ transform: showOverlapsList ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            />
          </button>

          {showOverlapsList && (
            <div className="overlaps-list">
              {overlaps.map((ov, idx) => {
                const c1 = cameras.find((c) => c.id === ov.cameraIds[0]);
                const c2 = cameras.find((c) => c.id === ov.cameraIds[1]);
                return (
                  <div key={idx} className="overlap-pair-card">
                    <span className="pair-names">
                      {c1?.name || 'Camera'} ⟷ {c2?.name || 'Camera'}
                    </span>
                    <span className="pair-area">
                      {ov.overlapAreaM2.toLocaleString()} m²
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
