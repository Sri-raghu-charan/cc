import React, { useState } from 'react';
import { Camera, CameraSpecs } from '../../types/camera';
import { VERIFIED_CAMERA_MODELS, createCustomCameraSpecs } from '../../data/cameraModels';
import { CircularCompass } from '../Compass/CircularCompass';
import { GroundMovementControls } from '../Movement/GroundMovementControls';
import { useCctv, JUNCTION_PRESETS, JunctionPresetType } from '../../context/CctvContext';
import { calculateDoriDistances } from '../../geo/dori';
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  MapPin,
  Crosshair,
  Navigation,
  Check,
  Zap,
  Camera as CameraIcon,
  Image as ImageIcon,
  Download,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface CameraInspectorProps {
  camera: Camera;
}

export const CameraInspector: React.FC<CameraInspectorProps> = ({ camera }) => {
  const {
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
    applyJunctionPreset,
    setFlyToTarget,
    captureMapSnapshot,
    saveProjectWithSnapshot,
    lastMapSnapshot
  } = useCctv();

  const [modelSearch, setModelSearch] = useState<string>('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('All');
  const [showModelPicker, setShowModelPicker] = useState<boolean>(false);

  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState<boolean>(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState<boolean>(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);

  const handleCaptureSnapshotOnly = async () => {
    try {
      setIsCapturingSnapshot(true);
      setSnapshotMessage(null);
      const snap = await captureMapSnapshot();
      if (snap) {
        setPreviewSnapshot(snap);
        const a = document.createElement('a');
        a.href = snap;
        a.download = `${camera.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_coverage_map_snapshot.png`;
        a.click();
        setSnapshotMessage('Coverage map snapshot captured & downloaded!');
        setTimeout(() => setSnapshotMessage(null), 5000);
      } else {
        alert('Could not capture map snapshot. Ensure the map is loaded.');
      }
    } catch (err) {
      console.error('Snapshot capture error:', err);
      alert('Snapshot capture failed.');
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  const handleSaveProjectAndSnapshot = async () => {
    try {
      setIsSavingSnapshot(true);
      setSnapshotMessage(null);
      const res = await saveProjectWithSnapshot(`cctv_${camera.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
      if (res.snapshotUrl) {
        setPreviewSnapshot(res.snapshotUrl);
      }
      setSnapshotMessage('Project details & coverage snapshot saved successfully!');
      setTimeout(() => setSnapshotMessage(null), 5000);
    } catch (err) {
      console.error('Save project error:', err);
      alert('Failed to save project with snapshot.');
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const canUndo = (historyStack.get(camera.id)?.length || 0) > 0;

  const dori = calculateDoriDistances(
    camera.specs.resolutionWidth,
    camera.specs.selectedHfov,
    camera.rangeMeters
  );
  const isExaggeratedRange = camera.rangeMeters > (camera.specs.maxOpticalRangeMeters || 45);

  // Filter models based on search query & selected manufacturer
  const filteredModels = VERIFIED_CAMERA_MODELS.filter((m) => {
    const matchesSearch =
      m.modelName.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.manufacturer.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.formFactor.toLowerCase().includes(modelSearch.toLowerCase());
    const matchesMfr =
      selectedManufacturer === 'All' ||
      m.manufacturer.toLowerCase().includes(selectedManufacturer.toLowerCase());
    return matchesSearch && matchesMfr;
  });

  const handleSelectModel = (model: CameraSpecs) => {
    updateCamera(camera.id, {
      specs: { ...model },
      rangeMeters: model.maxOpticalRangeMeters || camera.rangeMeters,
      mountingHeight: model.recommendedHeight || camera.mountingHeight,
      tilt: model.recommendedTilt || camera.tilt
    });
    setShowModelPicker(false);
  };

  const handleApplyDatasheetDefaults = () => {
    updateCamera(camera.id, {
      rangeMeters: camera.specs.maxOpticalRangeMeters || camera.rangeMeters,
      mountingHeight: camera.specs.recommendedHeight || camera.mountingHeight,
      tilt: camera.specs.recommendedTilt || camera.tilt,
      specs: {
        ...camera.specs,
        selectedHfov: camera.specs.hfovMax,
        selectedVfov: camera.specs.vfovMax,
        selectedFocalLength: camera.specs.focalLengthMin
      }
    });
  };

  const handleFocalLengthChange = (focalMm: number) => {
    const fMin = camera.specs.focalLengthMin || 2.8;
    const fMax = camera.specs.focalLengthMax || 12.0;
    const ratio = Math.max(0, Math.min(1, (focalMm - fMin) / Math.max(0.1, fMax - fMin)));

    // Higher focal length = narrower FOV
    const hfov = camera.specs.hfovMax - ratio * (camera.specs.hfovMax - camera.specs.hfovMin);
    const vfov = camera.specs.vfovMax - ratio * (camera.specs.vfovMax - camera.specs.vfovMin);

    // Optical reach scales with zoom ratio
    const baseRange = camera.specs.maxOpticalRangeMeters || 45;
    const zoomRatio = focalMm / Math.max(1, fMin);
    const newRange = Math.round(baseRange * Math.sqrt(zoomRatio));

    updateCamera(camera.id, {
      rangeMeters: Math.min(2500, Math.max(10, newRange)),
      specs: {
        ...camera.specs,
        selectedFocalLength: Number(focalMm.toFixed(1)),
        selectedHfov: Number(hfov.toFixed(1)),
        selectedVfov: Number(vfov.toFixed(1))
      }
    });
  };

  const handleSwitchToCustom = () => {
    const customSpecs = createCustomCameraSpecs({
      selectedHfov: camera.specs.selectedHfov,
      selectedVfov: camera.specs.selectedVfov,
      resolutionWidth: camera.specs.resolutionWidth,
      resolutionHeight: camera.specs.resolutionHeight
    });
    updateCamera(camera.id, { specs: customSpecs });
    setShowModelPicker(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Quick Jump Bar for Quick Scrolling */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          scrollbarWidth: 'none'
        }}
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => document.getElementById('sec-junction')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
          style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '12px', whiteSpace: 'nowrap', background: '#0284c7', color: '#fff' }}
        >
          🚦 Junction
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => document.getElementById('sec-identity')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
          style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}
        >
          Identity
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => document.getElementById('sec-specs')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
          style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}
        >
          Specs
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => document.getElementById('sec-compass')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
          style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '12px', whiteSpace: 'nowrap', background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
        >
          🧭 Compass
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => document.getElementById('sec-movement')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
          style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}
        >
          🕹️ D-Pad
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => document.getElementById('sec-metrics')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
          style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}
        >
          📊 Metrics
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => document.getElementById('sec-snapshot')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#38bdf8'
          }}
        >
          📸 Snapshot
        </button>
      </div>

      {/* Junction Placement & Real-Life Presets Card */}
      <div id="sec-junction" className="card-section" style={{ border: '1px solid rgba(56, 189, 248, 0.4)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%)' }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={13} /> Junction Setup & Positioning
          </span>
          <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 6px', borderRadius: '8px', fontWeight: 600 }}>
            Real-Life Presets
          </span>
        </div>

        {/* Repositioning & Aiming Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => {
              setIsRelocatingCamera(!isRelocatingCamera);
              setIsAimingCamera(false);
            }}
            style={{
              padding: '6px 4px',
              fontSize: '10px',
              fontWeight: 600,
              borderRadius: '8px',
              border: isRelocatingCamera ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
              background: isRelocatingCamera ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.8)',
              color: isRelocatingCamera ? '#38bdf8' : '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px'
            }}
            title="Enter Move Camera mode to place camera at a new location on the map"
          >
            <MapPin size={13} />
            {isRelocatingCamera ? 'Click to Move' : 'Move Camera'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAimingCamera(!isAimingCamera);
              setIsRelocatingCamera(false);
            }}
            style={{
              padding: '6px 4px',
              fontSize: '10px',
              fontWeight: 600,
              borderRadius: '8px',
              border: isAimingCamera ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.15)',
              background: isAimingCamera ? 'rgba(245, 158, 11, 0.3)' : 'rgba(30, 41, 59, 0.8)',
              color: isAimingCamera ? '#f59e0b' : '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px'
            }}
            title="Click down the street to aim camera heading"
          >
            <Crosshair size={13} />
            {isAimingCamera ? 'Click Road...' : 'Aim At'}
          </button>
        </div>

        {/* Real-Life Junction Presets Grid */}
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            One-Click Real-Life Junction Presets:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {(Object.keys(JUNCTION_PRESETS) as JunctionPresetType[]).map((key) => {
              const p = JUNCTION_PRESETS[key];
              const isMatch =
                camera.rangeMeters === p.rangeMeters &&
                camera.mountingHeight === p.mountingHeight &&
                camera.tilt === p.tilt;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyJunctionPreset(camera.id, key)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: isMatch ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                    background: isMatch ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: isMatch ? '#10b981' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{p.label}</span>
                    {isMatch && <Check size={11} style={{ color: '#10b981' }} />}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                    {p.rangeMeters}m range • {p.tilt}° tilt • {p.mountingHeight}m ht
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-world Installer Guidelines */}
        <div style={{ marginTop: '8px', background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.25)', borderRadius: '6px', padding: '6px 8px', fontSize: '10px', color: '#bae6fd', lineHeight: 1.4 }}>
          💡 <strong>Tip for Junctions:</strong> Drag the camera badge directly on the map to place it at the pole/corner, and drag the yellow bead to point down the street. Use 20°-30° tilt to monitor vehicles and pedestrians without sky glare.
        </div>
      </div>

      {/* General Identification */}
      <div id="sec-identity" className="card-section">
        <div className="card-title">
          <span>Camera Identity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFlyToTarget({
                latitude: camera.position.latitude,
                longitude: camera.position.longitude,
                elevation: camera.position.elevation || 0,
                heading: camera.heading
              })}
              style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Fly view to this camera's location"
            >
              <Navigation size={12} />
              Fly Here
            </button>
            <input
              type="color"
              aria-label="Camera color marker"
              value={camera.color}
              onChange={(e) => updateCamera(camera.id, { color: e.target.value })}
              style={{
                width: '20px',
                height: '20px',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'transparent'
              }}
              title="Camera color marker"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor={`camera-name-${camera.id}`} className="form-label-row">
            <span>Name</span>
          </label>
          <input
            id={`camera-name-${camera.id}`}
            type="text"
            className="input-text"
            aria-label="Camera name"
            value={camera.name}
            onChange={(e) => updateCamera(camera.id, { name: e.target.value })}
          />
        </div>

        {/* Persistent Strict Geo-Anchoring Readout */}
        <div
          style={{
            marginTop: '8px',
            padding: '6px 10px',
            background: 'rgba(15, 23, 42, 0.7)',
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
            <span>🔒</span>
            <span style={{ fontWeight: 600, color: '#e2e8f0' }}>Geo-Anchored:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
              {camera.position.latitude.toFixed(6)}°, {camera.position.longitude.toFixed(6)}°
            </span>
          </div>
          <span
            style={{
              fontSize: '9.5px',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 600,
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}
          >
            LOCKED
          </span>
        </div>
      </div>

      {/* Model & Specifications Section */}
      <div id="sec-specs" className="card-section">
        <div className="card-title">
          <span>Model Specifications</span>
          {camera.specs.verificationStatus === 'verified' ? (
            <span className="status-badge status-badge-verified">
              <ShieldCheck size={11} /> Verified
            </span>
          ) : (
            <span className="status-badge status-badge-custom">
              <AlertTriangle size={11} /> User Configured
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {camera.specs.modelName}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {camera.specs.manufacturer} • {camera.specs.formFactor.toUpperCase()} • {camera.specs.megaPixels} MP
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '11px', padding: '4px 8px' }}
            onClick={() => setShowModelPicker(!showModelPicker)}
            type="button"
          >
            {showModelPicker ? 'Close' : 'Change Model'}
          </button>
        </div>

        {/* Model Selector Dropdown / Search Modal */}
        {showModelPicker && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '260px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', gap: '6px' }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <Search size={12} style={{ color: 'var(--text-muted)', marginRight: '6px' }} />
                <input
                  type="text"
                  aria-label="Search manufacturer or model"
                  placeholder="Search manufacturer or model..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '11px',
                    width: '100%',
                    outline: 'none'
                  }}
                />
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '10px', padding: '4px 6px' }}
                onClick={handleSwitchToCustom}
                title="Switch to manual unverified custom parameters"
                aria-label="Switch to manual unverified custom parameters"
                type="button"
              >
                Custom Model
              </button>
            </div>

            {/* Manufacturer Filter Chips */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
              {['All', 'Hikvision', 'Axis', 'Dahua', 'Hanwha', 'Bosch'].map((mfr) => (
                <button
                  key={mfr}
                  type="button"
                  onClick={() => setSelectedManufacturer(mfr)}
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    border: selectedManufacturer === mfr ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                    background:
                      selectedManufacturer === mfr
                        ? mfr === 'Hikvision'
                          ? 'rgba(239, 68, 68, 0.35)'
                          : 'rgba(56, 189, 248, 0.3)'
                        : 'rgba(30, 41, 59, 0.7)',
                    color:
                      selectedManufacturer === mfr
                        ? mfr === 'Hikvision'
                          ? '#fca5a5'
                          : '#38bdf8'
                        : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: selectedManufacturer === mfr ? 700 : 500,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {mfr === 'Hikvision' ? '🔴 Hikvision' : mfr}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredModels.map((m) => (
                <div
                  key={m.modelName}
                  onClick={() => handleSelectModel(m)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background:
                      camera.specs.modelName === m.modelName
                        ? 'rgba(59, 130, 246, 0.25)'
                        : 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                    {m.modelName}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    {m.manufacturer} • {m.megaPixels}MP ({m.resolutionWidth}x{m.resolutionHeight}) • HFOV: {m.hfovMin}°-{m.hfovMax}°
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Datasheet Reference Note */}
        {camera.specs.datasheetRef && (
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            Source: {camera.specs.datasheetRef}
          </div>
        )}

        {/* Quick Action: Apply Verified Real-Life Datasheet Specs */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleApplyDatasheetDefaults}
            style={{
              flex: 1,
              fontSize: '11px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              borderRadius: 'var(--radius-sm)'
            }}
            title="Snap all settings (range, FOV, height, tilt) to manufacturer verified real-world specs"
          >
            <ShieldCheck size={13} />
            Apply Real-World Specs ({camera.specs.maxOpticalRangeMeters}m Reach)
          </button>
        </div>

        {/* Varifocal Optical Zoom Slider (if varifocal/motorized) */}
        {camera.specs.focalLengthMax > camera.specs.focalLengthMin && (
          <div className="form-group" style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <div className="form-label-row">
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>🔍 Optical Zoom / Focal Length</span>
              <span className="form-value-badge" style={{ background: '#2563eb', color: '#fff' }}>
                {camera.specs.selectedFocalLength.toFixed(1)} mm
              </span>
            </div>
            <input
              type="range"
              aria-label="Optical focal length in millimeters"
              min={camera.specs.focalLengthMin}
              max={camera.specs.focalLengthMax}
              step="0.1"
              className="slider-control"
              value={camera.specs.selectedFocalLength}
              onChange={(e) => handleFocalLengthChange(parseFloat(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
              <span>Wide: {camera.specs.focalLengthMin}mm ({camera.specs.hfovMax}°)</span>
              <span>Tele: {camera.specs.focalLengthMax}mm ({camera.specs.hfovMin}°)</span>
            </div>
          </div>
        )}

        {/* Optical FOV Adjustments */}
        <div className="form-group">
          <div className="form-label-row">
            <span>Horizontal FOV (HFOV)</span>
            <span className="form-value-badge">{camera.specs.selectedHfov.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            aria-label="Horizontal Field of View in degrees"
            min={camera.specs.hfovMin || 20}
            max={camera.specs.hfovMax || 140}
            step="0.5"
            className="slider-control"
            value={camera.specs.selectedHfov}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateCamera(camera.id, {
                specs: { ...camera.specs, selectedHfov: val }
              });
            }}
          />
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <span>Vertical FOV (VFOV)</span>
            <span className="form-value-badge">{camera.specs.selectedVfov.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            aria-label="Vertical Field of View in degrees"
            min={camera.specs.vfovMin || 10}
            max={camera.specs.vfovMax || 100}
            step="0.5"
            className="slider-control"
            value={camera.specs.selectedVfov}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateCamera(camera.id, {
                specs: { ...camera.specs, selectedVfov: val }
              });
            }}
          />
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <span>Configured Max Range</span>
            <span
              className="form-value-badge"
              style={{
                background: isExaggeratedRange ? 'rgba(245, 158, 11, 0.2)' : undefined,
                color: isExaggeratedRange ? '#f59e0b' : 'inherit'
              }}
            >
              {camera.rangeMeters} m
            </span>
          </div>
          <input
            type="range"
            aria-label="Configured Maximum Range in meters"
            min="5"
            max={Math.max(120, (camera.specs.maxOpticalRangeMeters || 60) * 1.5)}
            step="1"
            className="slider-control"
            value={camera.rangeMeters}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateCamera(camera.id, { rangeMeters: val });
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
            <span>IR Illumination: {camera.specs.irRangeMeters}m</span>
            <span>Datasheet Reach: {camera.specs.maxOpticalRangeMeters}m</span>
          </div>

          {/* Official Datasheet DORI (if available) */}
          {camera.specs.datasheetDori && (
            <div style={{ marginTop: '8px', background: 'rgba(15, 23, 42, 0.8)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ fontSize: '10px', color: '#38bdf8', marginBottom: '4px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📋 Official EN 62676-4 DORI Standards:</span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Click card to snap range</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                <button
                  type="button"
                  onClick={() => updateCamera(camera.id, { rangeMeters: camera.specs.datasheetDori!.identifyMeters })}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    padding: '4px 2px',
                    borderRadius: '4px',
                    border: camera.rangeMeters === camera.specs.datasheetDori.identifyMeters ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                  title="Click to snap range to Identification limit (250 px/m: Facial features recognized in court)"
                >
                  <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '9px' }}>ID (Face)</div>
                  <div style={{ fontWeight: 700 }}>{camera.specs.datasheetDori.identifyMeters}m</div>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>250 px/m</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateCamera(camera.id, { rangeMeters: camera.specs.datasheetDori!.recognizeMeters })}
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    padding: '4px 2px',
                    borderRadius: '4px',
                    border: camera.rangeMeters === camera.specs.datasheetDori.recognizeMeters ? '2px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                  title="Click to snap range to Recognition limit (125 px/m: Known person / Vehicle plate)"
                >
                  <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '9px' }}>Recognize</div>
                  <div style={{ fontWeight: 700 }}>{camera.specs.datasheetDori.recognizeMeters}m</div>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>125 px/m</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateCamera(camera.id, { rangeMeters: camera.specs.datasheetDori!.observeMeters })}
                  style={{
                    background: 'rgba(234, 179, 8, 0.15)',
                    padding: '4px 2px',
                    borderRadius: '4px',
                    border: camera.rangeMeters === camera.specs.datasheetDori.observeMeters ? '2px solid #eab308' : '1px solid rgba(234, 179, 8, 0.3)',
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                  title="Click to snap range to Observation limit (62.5 px/m: Clothing / Action / IR illumination range)"
                >
                  <div style={{ color: '#eab308', fontWeight: 700, fontSize: '9px' }}>Observe</div>
                  <div style={{ fontWeight: 700 }}>{camera.specs.datasheetDori.observeMeters}m</div>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>62.5 px/m</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateCamera(camera.id, { rangeMeters: camera.specs.datasheetDori!.detectMeters })}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    padding: '4px 2px',
                    borderRadius: '4px',
                    border: camera.rangeMeters === camera.specs.datasheetDori.detectMeters ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                  title="Click to snap range to Detection limit (25 px/m: Motion blob detection only)"
                >
                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: '9px' }}>Detect</div>
                  <div style={{ fontWeight: 700 }}>{camera.specs.datasheetDori.detectMeters}m</div>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>25 px/m</div>
                </button>
              </div>

              <div style={{ marginTop: '6px', fontSize: '9px', color: '#94a3b8', lineHeight: '1.3', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                💡 <strong>Surveillance Reality:</strong> The full {camera.specs.datasheetDori.detectMeters}m cone is only for <em>presence/motion detection</em> (25 px/m). In real life, clear facial ID only works within {camera.specs.datasheetDori.identifyMeters}m, vehicle plates within {camera.specs.datasheetDori.recognizeMeters}m, and night light stops at {camera.specs.irRangeMeters}m. Real camera views are also blocked by buildings and walls.
              </div>
            </div>
          )}

          {/* Real-World DORI Performance Readout */}
          <div style={{ marginTop: '8px', background: 'var(--bg-input)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
              <span>EN 62676-4 Dynamic Calculation:</span>
              <span style={{ color: 'var(--text-secondary)' }}>{camera.specs.resolutionWidth}px @ {camera.specs.selectedHfov}°</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '4px 2px', borderRadius: '3px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '9px' }}>ID (Face)</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dori.identification}m</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', padding: '4px 2px', borderRadius: '3px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '9px' }}>Recognize</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dori.recognition}m</div>
              </div>
              <div style={{ background: 'rgba(234, 179, 8, 0.12)', padding: '4px 2px', borderRadius: '3px', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                <div style={{ color: '#eab308', fontWeight: 700, fontSize: '9px' }}>Observe</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dori.observation}m</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '4px 2px', borderRadius: '3px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ color: '#10b981', fontWeight: 700, fontSize: '9px' }}>Detect</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dori.detection}m</div>
              </div>
            </div>
            {isExaggeratedRange && (
              <div style={{ marginTop: '7px', fontSize: '10px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                <span>Exceeds realistic optical reach ({camera.specs.maxOpticalRangeMeters}m).</span>
                <button
                  type="button"
                  onClick={() => updateCamera(camera.id, { rangeMeters: camera.specs.maxOpticalRangeMeters || 45 })}
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid #f59e0b',
                    color: '#f59e0b',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <Zap size={10} />
                  Snap ({camera.specs.maxOpticalRangeMeters || 45}m)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mounting & Orientation */}
      <div id="sec-orientation" className="card-section">
        <div className="card-title">
          <span>Mounting & Orientation</span>
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <span>Mounting Height</span>
            <span className="form-value-badge">{camera.mountingHeight.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            aria-label="Mounting Height in meters"
            min="1.5"
            max="30"
            step="0.5"
            className="slider-control"
            value={camera.mountingHeight}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateCamera(camera.id, { mountingHeight: val });
            }}
          />
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <span>Tilt (Depression Angle)</span>
            <span className="form-value-badge">{camera.tilt.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            aria-label="Camera Tilt depression angle in degrees"
            min="0"
            max="89"
            step="1"
            className="slider-control"
            value={camera.tilt}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateCamera(camera.id, { tilt: val });
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>0° (Horizon)</span>
            <span>45° (Standard)</span>
            <span>89° (Nadir)</span>
          </div>
        </div>

        {/* Circular Compass Control */}
        <div id="sec-compass" style={{ marginTop: '8px' }}>
          <div className="form-label-row" style={{ marginBottom: '4px' }}>
            <span>Camera Heading (Azimuth)</span>
            <span className="form-value-badge">{Math.round(camera.heading)}°</span>
          </div>
          <CircularCompass
            heading={camera.heading}
            onChange={(newHeading) => rotateCamera(camera.id, newHeading)}
          />
        </div>
      </div>

      {/* Ground Movement Controls */}
      <div id="sec-movement">
        <GroundMovementControls
          camera={camera}
          onMove={(dir, dist) => stepCamera(camera.id, dir, dist)}
          onUndo={() => undoMovement(camera.id)}
          onReset={() => resetToOriginal(camera.id)}
          canUndo={canUndo}
        />
      </div>

      {/* Computed Coverage Geometry Readout */}
      {activeFootprint && (
        <div id="sec-metrics" className="card-section">
          <div className="card-title">
            <span>Ground Coverage Metrics</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridGap: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px'
            }}
          >
            <div style={{ background: 'var(--bg-input)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Near Dead Zone</div>
              <div style={{ fontWeight: 700, color: '#f59e0b' }}>
                {activeFootprint.nearDistanceMeters.toFixed(1)} m
              </div>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Far Reach</div>
              <div style={{ fontWeight: 700, color: '#3b82f6' }}>
                {activeFootprint.farDistanceMeters.toFixed(1)} m
              </div>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Far Span Width</div>
              <div style={{ fontWeight: 700, color: '#10b981' }}>
                {activeFootprint.footprintWidthFarMeters.toFixed(1)} m
              </div>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Total Footprint</div>
              <div style={{ fontWeight: 700, color: '#a855f7' }}>
                {activeFootprint.totalAreaM2.toLocaleString()} m²
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Camera Coverage Snapshot Section */}
      <div
        id="sec-snapshot"
        className="card-section"
        style={{
          border: '1px solid rgba(56, 189, 248, 0.45)',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
            <CameraIcon size={14} /> Camera Coverage Snapshot
          </span>
          <span
            style={{
              fontSize: '10px',
              background: 'rgba(56, 189, 248, 0.18)',
              color: '#38bdf8',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: 600,
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}
          >
            Real Map Coverage
          </span>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 10px', lineHeight: 1.4 }}>
          Captures the exact geographic region covered by this camera on the real satellite map, framed tightly to its DORI optical reach.
        </p>

        {/* Coverage Snapshot Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCaptureSnapshotOnly}
            disabled={isCapturingSnapshot || isSavingSnapshot}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '9px 14px',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
            }}
          >
            {isCapturingSnapshot ? (
              <>
                <Loader2 size={15} className="spin-animation" />
                Capturing Coverage Map...
              </>
            ) : (
              <>
                <CameraIcon size={15} />
                Capture Coverage Snapshot (PNG)
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSaveProjectAndSnapshot}
            disabled={isCapturingSnapshot || isSavingSnapshot}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 12px',
              fontSize: '11.5px',
              background: 'rgba(255, 255, 255, 0.06)'
            }}
          >
            {isSavingSnapshot ? (
              <>
                <Loader2 size={14} className="spin-animation" />
                Saving Project & Snapshot...
              </>
            ) : (
              <>
                <Download size={14} />
                Save Project & Snapshot (JSON + PNG)
              </>
            )}
          </button>
        </div>

        {/* Success Feedback Alert */}
        {snapshotMessage && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '8px',
              color: '#34d399',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CheckCircle2 size={14} />
            <span>{snapshotMessage}</span>
          </div>
        )}

        {/* Snapshot Preview Card */}
        {(previewSnapshot || lastMapSnapshot) && (
          <div
            style={{
              marginTop: '12px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '8px',
              overflow: 'hidden',
              background: 'rgba(15, 23, 42, 0.8)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                background: 'rgba(30, 41, 59, 0.6)',
                borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                fontSize: '10.5px',
                color: '#cbd5e1'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                <ImageIcon size={12} /> Coverage Region Preview
              </span>
              <a
                href={previewSnapshot || lastMapSnapshot || '#'}
                download={`${camera.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_coverage_map_snapshot.png`}
                style={{
                  color: '#38bdf8',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontWeight: 600
                }}
              >
                Download <Download size={11} />
              </a>
            </div>

            <div style={{ position: 'relative', width: '100%', maxHeight: '220px', overflow: 'hidden', background: '#0b1120' }}>
              <img
                src={previewSnapshot || lastMapSnapshot || ''}
                alt="Camera Coverage Snapshot Preview"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  objectFit: 'contain'
                }}
              />
            </div>

            {/* Quick Metadata Readout */}
            <div
              style={{
                padding: '8px 10px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
                fontSize: '10px',
                background: 'rgba(15, 23, 42, 0.95)',
                borderTop: '1px solid rgba(148, 163, 184, 0.1)'
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Pinned GPS:</span>{' '}
                <span style={{ color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                  {camera.position.latitude.toFixed(5)}°, {camera.position.longitude.toFixed(5)}°
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#64748b' }}>Monitored Area:</span>{' '}
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                  {activeFootprint ? `${Math.round(activeFootprint.totalAreaM2).toLocaleString()} m²` : 'Active'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
