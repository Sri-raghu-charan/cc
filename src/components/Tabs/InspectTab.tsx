import React, { useState } from 'react';
import { useCctv } from '../../context/CctvContext';
import { Camera, CameraSpecs } from '../../types/camera';
import { VERIFIED_CAMERA_MODELS, createCustomCameraSpecs } from '../../data/cameraModels';
import { ProfessionalCompass, getCardinalDirection } from '../Compass/ProfessionalCompass';
import { GroundMovementControls } from '../Movement/GroundMovementControls';
import { calculateDoriDistances } from '../../geo/dori';
import {
  Video,
  ShieldCheck,
  ChevronDown,
  Navigation,
  MapPin,
  Crosshair,
  ExternalLink,
  Camera as CameraIcon,
  Download,
  AlertTriangle,
  Search,
  CheckCircle2,
  Compass as CompassIcon,
  Layers,
  ChevronRight
} from 'lucide-react';

interface InspectTabProps {
  onNavigateToPlaces?: () => void;
}

export const InspectTab: React.FC<InspectTabProps> = ({ onNavigateToPlaces }) => {
  const {
    activeCamera,
    cameras,
    updateCamera,
    rotateCamera,
    stepCamera,
    undoMovement,
    resetToOriginal,
    historyStack,
    activeFootprint,
    isRelocatingCamera,
    setIsRelocatingCamera,
    isAimingCamera,
    setIsAimingCamera,
    setFlyToTarget,
    captureMapSnapshot,
    saveProjectWithSnapshot
  } = useCctv();

  const [activeSubTab, setActiveSubTab] = useState<'parameters' | 'preview' | 'streetview'>('parameters');
  const [showModelPicker, setShowModelPicker] = useState<boolean>(false);
  const [modelSearch, setModelSearch] = useState<string>('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('All');
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editedName, setEditedName] = useState<string>('');
  const [showFineMovement, setShowFineMovement] = useState<boolean>(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState<boolean>(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);

  if (!activeCamera) {
    return (
      <div className="inspect-empty-state">
        <div className="empty-icon-circle">
          <Video size={28} />
        </div>
        <h3>No Camera Selected</h3>
        <p>
          Select a camera from the <strong>Cameras</strong> tab, click a camera marker on the map, or place a new camera to inspect and tune its sightline.
        </p>
      </div>
    );
  }

  const canUndo = (historyStack.get(activeCamera.id)?.length || 0) > 0;
  const dori = calculateDoriDistances(
    activeCamera.specs.resolutionWidth,
    activeCamera.specs.selectedHfov,
    activeCamera.rangeMeters
  );

  // Model Picker filtering
  const filteredModels = VERIFIED_CAMERA_MODELS.filter((m) => {
    const matchesSearch =
      m.modelName.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.manufacturer.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.formFactor.toLowerCase().includes(modelSearch.toLowerCase());
    const matchesMfr =
      selectedManufacturer === 'All' ||
      m.manufacturer.toLowerCase() === selectedManufacturer.toLowerCase();
    return matchesSearch && matchesMfr;
  });

  const handleSelectModel = (model: CameraSpecs) => {
    updateCamera(activeCamera.id, {
      specs: { ...model },
      rangeMeters: model.maxOpticalRangeMeters || activeCamera.rangeMeters,
      mountingHeight: model.recommendedHeight || activeCamera.mountingHeight,
      tilt: model.recommendedTilt || activeCamera.tilt
    });
    setShowModelPicker(false);
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      updateCamera(activeCamera.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleFovChange = (val: number) => {
    // Preserve aspect ratio for VFOV
    const aspectRatio = (activeCamera.specs.resolutionHeight || 1080) / (activeCamera.specs.resolutionWidth || 1920);
    const newVfov = Math.max(10, Math.min(100, Math.round(val * aspectRatio * 1.15)));
    updateCamera(activeCamera.id, {
      specs: {
        ...activeCamera.specs,
        selectedHfov: val,
        selectedVfov: newVfov
      }
    });
  };

  const handleCaptureSnapshot = async () => {
    try {
      setIsCapturingSnapshot(true);
      const snap = await captureMapSnapshot();
      if (snap) {
        setPreviewSnapshot(snap);
      }
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  // Google Street View official URL
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${activeCamera.position.latitude},${activeCamera.position.longitude}&heading=${Math.round(activeCamera.heading)}&pitch=${-Math.round(activeCamera.tilt)}`;

  return (
    <div className="inspect-tab-container">
      {/* 1. Selected Camera Header Card */}
      <div className="inspect-camera-header-card">
        <div className="inspect-camera-header-top">
          <div className="inspect-camera-badge-icon">
            <Video size={16} />
          </div>

          <div className="inspect-camera-title-info">
            <span className="selected-camera-label">Selected Camera</span>
            {isEditingName ? (
              <div className="name-edit-box">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  autoFocus
                  className="camera-name-input"
                />
              </div>
            ) : (
              <h3
                className="selected-camera-name"
                onClick={() => {
                  setEditedName(activeCamera.name);
                  setIsEditingName(true);
                }}
                title="Click to rename camera"
              >
                {activeCamera.name}
              </h3>
            )}
            <div className="selected-camera-coords">
              <MapPin size={11} className="coords-pin-icon" />
              <span>
                {activeCamera.position.latitude.toFixed(6)}, {activeCamera.position.longitude.toFixed(6)}
              </span>
            </div>
          </div>

          <div className="inspect-status-badge-wrapper">
            <span className="status-badge-online">
              <span className="status-dot dot-online" /> Online
            </span>
          </div>
        </div>

        {/* Quick Toolbar (Fly, Move, Aim) */}
        <div className="inspect-quick-toolbar">
          <button
            type="button"
            className="quick-tool-btn"
            onClick={() =>
              setFlyToTarget({
                latitude: activeCamera.position.latitude,
                longitude: activeCamera.position.longitude,
                elevation: (activeCamera.position.elevation || 0) + 200,
                heading: activeCamera.heading
              })
            }
            title="Fly 3D view to camera"
          >
            <Navigation size={12} />
            <span>Fly To</span>
          </button>

          <button
            type="button"
            className={`quick-tool-btn ${isRelocatingCamera ? 'active' : ''}`}
            onClick={() => {
              setIsRelocatingCamera(!isRelocatingCamera);
              setIsAimingCamera(false);
            }}
            title="Click to relocate camera anchor on map"
          >
            <MapPin size={12} />
            <span>{isRelocatingCamera ? 'Relocating...' : 'Move'}</span>
          </button>

          <button
            type="button"
            className={`quick-tool-btn ${isAimingCamera ? 'active' : ''}`}
            onClick={() => {
              setIsAimingCamera(!isAimingCamera);
              setIsRelocatingCamera(false);
            }}
            title="Click down a street to aim heading"
          >
            <Crosshair size={12} />
            <span>{isAimingCamera ? 'Aiming...' : 'Aim'}</span>
          </button>
        </div>
      </div>

      {/* 2. Segmented Control Subtabs */}
      <div className="inspect-subtabs-nav">
        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'parameters' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('parameters')}
        >
          Parameters
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'streetview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('streetview')}
        >
          Street View
        </button>
      </div>

      {/* 3. Subtab Content: Parameters */}
      {activeSubTab === 'parameters' && (
        <div className="inspect-parameters-scroll">
          {/* Camera Model Card */}
          <div className="inspect-control-card">
            <div className="control-card-header">
              <label className="control-label">Camera Model</label>
              {activeCamera.specs.verificationStatus === 'verified' && (
                <span className="verified-chip">
                  <ShieldCheck size={11} /> Verified
                </span>
              )}
            </div>

            <div
              className="model-select-card"
              onClick={() => setShowModelPicker(!showModelPicker)}
            >
              <img
                src="/camera_hardware.jpg"
                alt="Camera Model"
                className="model-select-img"
              />
              <div className="model-select-text">
                <span className="model-name-text">{activeCamera.specs.modelName}</span>
                <span className="model-meta-text">
                  {activeCamera.specs.manufacturer} • {activeCamera.specs.formFactor.toUpperCase()} • {activeCamera.specs.megaPixels} MP
                </span>
              </div>
              <ChevronDown size={16} className="model-chevron" />
            </div>

            {/* Model Picker Modal / Dropdown */}
            {showModelPicker && (
              <div className="model-picker-modal">
                <div className="picker-search-bar">
                  <Search size={13} className="picker-search-icon" />
                  <input
                    type="text"
                    placeholder="Search manufacturer or model..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="picker-search-input"
                  />
                </div>

                <div className="picker-mfr-pills">
                  {['All', 'Hikvision', 'Dahua', 'CP Plus', 'Axis', 'Hanwha', 'Bosch'].map((mfr) => (
                    <button
                      key={mfr}
                      type="button"
                      className={`picker-pill ${selectedManufacturer === mfr ? 'active' : ''}`}
                      onClick={() => setSelectedManufacturer(mfr)}
                    >
                      {mfr}
                    </button>
                  ))}
                </div>

                <div className="picker-models-list">
                  {filteredModels.map((m) => (
                    <div
                      key={m.modelName}
                      className={`picker-model-item ${activeCamera.specs.modelName === m.modelName ? 'active' : ''}`}
                      onClick={() => handleSelectModel(m)}
                    >
                      <div className="picker-model-title">{m.modelName}</div>
                      <div className="picker-model-specs">
                        {m.manufacturer} • {m.megaPixels}MP ({m.resolutionWidth}x{m.resolutionHeight}) • Reach: {m.maxOpticalRangeMeters}m
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Field of View (FOV) Slider */}
          <div className="inspect-control-card">
            <div className="control-card-header">
              <span className="control-label">Field of View (FOV)</span>
              <span className="control-value-highlight">
                {Math.round(activeCamera.specs.selectedHfov)}°
              </span>
            </div>

            <div className="slider-wrapper">
              <input
                type="range"
                min="30"
                max="120"
                step="1"
                value={activeCamera.specs.selectedHfov}
                onChange={(e) => handleFovChange(parseFloat(e.target.value))}
                className="clean-range-slider"
                style={{
                  background: `linear-gradient(to right, #2563EB 0%, #2563EB ${((activeCamera.specs.selectedHfov - 30) / 90) * 100}%, #E2E8F0 ${((activeCamera.specs.selectedHfov - 30) / 90) * 100}%, #E2E8F0 100%)`
                }}
              />
            </div>

            <div className="slider-scale-ticks">
              <span>30°</span>
              <span>60°</span>
              <span>90°</span>
              <span>120°</span>
            </div>

            <div className="fov-sub-readout">
              <span>Horizontal FOV: {Math.round(activeCamera.specs.selectedHfov)}°</span>
              <span>Vertical FOV: {Math.round(activeCamera.specs.selectedVfov)}°</span>
            </div>
          </div>

          {/* Range (Coverage Distance) Slider */}
          <div className="inspect-control-card">
            <div className="control-card-header">
              <span className="control-label">Range (Coverage Distance)</span>
              <span className="control-value-highlight">{activeCamera.rangeMeters} m</span>
            </div>

            <div className="slider-wrapper">
              <input
                type="range"
                min="10"
                max="1000"
                step="5"
                value={activeCamera.rangeMeters}
                onChange={(e) =>
                  updateCamera(activeCamera.id, { rangeMeters: parseFloat(e.target.value) })
                }
                className="clean-range-slider"
                style={{
                  background: `linear-gradient(to right, #2563EB 0%, #2563EB ${((activeCamera.rangeMeters - 10) / 990) * 100}%, #E2E8F0 ${((activeCamera.rangeMeters - 10) / 990) * 100}%, #E2E8F0 100%)`
                }}
              />
            </div>

            <div className="slider-scale-ticks">
              <span>50</span>
              <span>100</span>
              <span>200</span>
              <span>500</span>
              <span>1000</span>
            </div>

            {/* DORI Quick Snap Pills */}
            {activeCamera.specs.datasheetDori && (
              <div className="dori-snap-grid">
                <button
                  type="button"
                  className="dori-snap-btn"
                  onClick={() =>
                    updateCamera(activeCamera.id, {
                      rangeMeters: activeCamera.specs.datasheetDori!.identifyMeters
                    })
                  }
                  title="Snap to Face Identification limit"
                >
                  <span className="dori-tag tag-id">ID (Face)</span>
                  <span className="dori-meters">{activeCamera.specs.datasheetDori.identifyMeters}m</span>
                </button>

                <button
                  type="button"
                  className="dori-snap-btn"
                  onClick={() =>
                    updateCamera(activeCamera.id, {
                      rangeMeters: activeCamera.specs.datasheetDori!.recognizeMeters
                    })
                  }
                  title="Snap to License Plate Recognition limit"
                >
                  <span className="dori-tag tag-rec">Recognize</span>
                  <span className="dori-meters">{activeCamera.specs.datasheetDori.recognizeMeters}m</span>
                </button>

                <button
                  type="button"
                  className="dori-snap-btn"
                  onClick={() =>
                    updateCamera(activeCamera.id, {
                      rangeMeters: activeCamera.specs.datasheetDori!.observeMeters
                    })
                  }
                  title="Snap to Activity Observation limit"
                >
                  <span className="dori-tag tag-obs">Observe</span>
                  <span className="dori-meters">{activeCamera.specs.datasheetDori.observeMeters}m</span>
                </button>

                <button
                  type="button"
                  className="dori-snap-btn"
                  onClick={() =>
                    updateCamera(activeCamera.id, {
                      rangeMeters: activeCamera.specs.datasheetDori!.detectMeters
                    })
                  }
                  title="Snap to Motion Detection limit"
                >
                  <span className="dori-tag tag-det">Detect</span>
                  <span className="dori-meters">{activeCamera.specs.datasheetDori.detectMeters}m</span>
                </button>
              </div>
            )}
          </div>

          {/* Mounting Height Slider */}
          <div className="inspect-control-card">
            <div className="control-card-header">
              <span className="control-label">Mounting Height</span>
              <span className="control-value-highlight">{activeCamera.mountingHeight} m</span>
            </div>

            <div className="slider-wrapper">
              <input
                type="range"
                min="2"
                max="20"
                step="0.5"
                value={activeCamera.mountingHeight}
                onChange={(e) =>
                  updateCamera(activeCamera.id, { mountingHeight: parseFloat(e.target.value) })
                }
                className="clean-range-slider"
                style={{
                  background: `linear-gradient(to right, #2563EB 0%, #2563EB ${((activeCamera.mountingHeight - 2) / 18) * 100}%, #E2E8F0 ${((activeCamera.mountingHeight - 2) / 18) * 100}%, #E2E8F0 100%)`
                }}
              />
            </div>

            <div className="slider-scale-ticks">
              <span>2</span>
              <span>5</span>
              <span>8</span>
              <span>12</span>
              <span>20</span>
            </div>
          </div>

          {/* Tilt (Vertical Angle) Slider */}
          <div className="inspect-control-card">
            <div className="control-card-header">
              <span className="control-label">Tilt (Vertical Angle)</span>
              <span className="control-value-highlight">
                -{Math.round(activeCamera.tilt)}° (Down)
              </span>
            </div>

            <div className="slider-wrapper">
              <input
                type="range"
                min="0"
                max="45"
                step="1"
                value={activeCamera.tilt}
                onChange={(e) =>
                  updateCamera(activeCamera.id, { tilt: parseFloat(e.target.value) })
                }
                className="clean-range-slider"
                style={{
                  background: `linear-gradient(to right, #2563EB 0%, #2563EB ${(activeCamera.tilt / 45) * 100}%, #E2E8F0 ${(activeCamera.tilt / 45) * 100}%, #E2E8F0 100%)`
                }}
              />
            </div>

            <div className="slider-scale-ticks">
              <span>0°</span>
              <span>-15°</span>
              <span>-30°</span>
              <span>-45°</span>
            </div>
          </div>

          {/* Direction (Azimuth) & Large Compass */}
          <div className="inspect-control-card">
            <div className="control-card-header">
              <span className="control-label">Direction (Azimuth)</span>
              <span className="control-value-highlight">
                {Math.round(activeCamera.heading)}° ({getCardinalDirection(activeCamera.heading)})
              </span>
            </div>

            {/* Professional Large Compass Control */}
            <ProfessionalCompass
              heading={activeCamera.heading}
              onChange={(newHeading) => rotateCamera(activeCamera.id, newHeading)}
              onAimClick={() => setIsAimingCamera(!isAimingCamera)}
              isAiming={isAimingCamera}
            />
          </div>

          {/* Fine Ground Movement Accordion */}
          <div className="fine-movement-accordion">
            <button
              type="button"
              className="accordion-toggle-btn"
              onClick={() => setShowFineMovement(!showFineMovement)}
            >
              <span>Fine Ground Movement (D-Pad)</span>
              <ChevronRight
                size={14}
                style={{ transform: showFineMovement ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
              />
            </button>

            {showFineMovement && (
              <div className="accordion-body">
                <GroundMovementControls
                  camera={activeCamera}
                  onMove={(dir, dist) => stepCamera(activeCamera.id, dir, dist)}
                  onUndo={() => undoMovement(activeCamera.id)}
                  onReset={() => resetToOriginal(activeCamera.id)}
                  canUndo={canUndo}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Subtab Content: Preview */}
      {activeSubTab === 'preview' && (
        <div className="inspect-preview-container">
          {/* Ground Footprint Metrics */}
          {activeFootprint && (
            <div className="inspect-control-card">
              <label className="control-label" style={{ marginBottom: '8px', display: 'block' }}>
                Coverage Geometry Readout
              </label>
              <div className="preview-metrics-grid">
                <div className="metric-box">
                  <span className="metric-label">Near Dead Zone</span>
                  <span className="metric-val">{activeFootprint.nearDistanceMeters.toFixed(1)} m</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Far Reach</span>
                  <span className="metric-val">{activeFootprint.farDistanceMeters.toFixed(1)} m</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Span Width</span>
                  <span className="metric-val">{activeFootprint.footprintWidthFarMeters.toFixed(1)} m</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Total Footprint</span>
                  <span className="metric-val">{activeFootprint.totalAreaM2.toLocaleString()} m²</span>
                </div>
              </div>
            </div>
          )}

          {/* Snapshot Preview Box */}
          <div className="inspect-control-card">
            <div className="control-card-header">
              <span className="control-label">Satellite Coverage Snapshot</span>
              <button
                type="button"
                className="btn-text-action"
                onClick={handleCaptureSnapshot}
                disabled={isCapturingSnapshot}
              >
                <CameraIcon size={12} />
                <span>{isCapturingSnapshot ? 'Capturing...' : 'Capture Snapshot'}</span>
              </button>
            </div>

            <div className="snapshot-preview-frame">
              <img
                src={previewSnapshot || '/coverage_map_preview.jpg'}
                alt="Camera Coverage Snapshot"
                className="snapshot-preview-img"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Subtab Content: Street View */}
      {activeSubTab === 'streetview' && (
        <div className="inspect-streetview-container">
          <div className="streetview-hero-card">
            <div className="streetview-icon-circle">
              <CompassIcon size={32} />
            </div>

            <h4>Google Maps 360° Street View</h4>
            <p>
              Inspect physical sightline obstructions, poles, trees, and ground structures at (
              {activeCamera.position.latitude.toFixed(5)}°, {activeCamera.position.longitude.toFixed(5)}°)
              oriented at {Math.round(activeCamera.heading)}° azimuth.
            </p>

            <a
              href={streetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-launch-streetview"
            >
              <span>Open Official Street View</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="streetview-coord-breakdown">
            <div className="breakdown-item">
              <span className="label">Latitude</span>
              <span className="val">{activeCamera.position.latitude.toFixed(6)}°</span>
            </div>
            <div className="breakdown-item">
              <span className="label">Longitude</span>
              <span className="val">{activeCamera.position.longitude.toFixed(6)}°</span>
            </div>
            <div className="breakdown-item">
              <span className="label">Azimuth / Pitch</span>
              <span className="val">
                {Math.round(activeCamera.heading)}° / -{Math.round(activeCamera.tilt)}°
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
