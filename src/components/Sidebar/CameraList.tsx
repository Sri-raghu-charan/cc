import React, { useRef, useState } from 'react';
import { useCctv } from '../../context/CctvContext';
import { parseProjectFile } from '../../utils/projectFileParser';
import {
  Video,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Navigation,
  Download,
  Upload,
  CheckCircle2,
  Camera as CameraIcon,
  Image as ImageIcon
} from 'lucide-react';
import { getCameraIconUri } from '../../utils/cameraIcons';

export const CameraList: React.FC = () => {
  const {
    cameras,
    activeCameraId,
    selectCamera,
    deleteCamera,
    duplicateCamera,
    toggleCameraVisibility,
    setIsPlacingCamera,
    setFlyToTarget,
    addCamerasBatch,
    exportProjectJson,
    exportProjectGeoJson,
    importProjectJson,
    saveProjectWithSnapshot,
    captureMapSnapshot,
    lastMapSnapshot,
    clearAllCameras
  } = useCctv();


  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Save Project with Map Snapshot of CCTV Coverage
  const handleSaveProjectWithSnapshot = async () => {
    try {
      setIsSavingSnapshot(true);
      setSaveSuccessMessage(null);
      const res = await saveProjectWithSnapshot();
      setSaveSuccessMessage('Project & Map Snapshot saved!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error saving project with snapshot:', err);
      alert('Failed to capture map snapshot.');
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  // Download Standalone Map Snapshot Image (PNG)
  const handleDownloadSnapshotOnly = async () => {
    try {
      setIsSavingSnapshot(true);
      const snap = await captureMapSnapshot();
      if (!snap) {
        alert('Could not capture map snapshot. Ensure the map is loaded.');
        return;
      }
      const a = document.createElement('a');
      a.href = snap;
      a.download = `cctv_coverage_map_snapshot_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (err) {
      console.error('Snapshot capture error:', err);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  const handleDownloadJson = () => {
    const json = exportProjectJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cctv_plan_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadGeoJson = () => {
    const geojson = exportProjectGeoJson();
    const blob = new Blob([geojson], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cctv_plan_footprints_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      // If it's a standard JSON file, try importProjectJson first
      if (ext === 'json') {
        const content = await file.text();
        const ok = importProjectJson(content);
        if (ok) {
          alert('Project imported successfully!');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }

      // Universal parser for PDF, DOC, DOCX, TXT, MD, CSV, KML, GeoJSON
      const parsed = await parseProjectFile(file);
      if (parsed.success && parsed.cameras.length > 0) {
        const added = addCamerasBatch(parsed.cameras);
        alert(`Successfully imported and anchored ${added.length} cameras to Earth coordinates!`);
      } else {
        alert(parsed.error || 'Failed to detect camera coordinates in this file.');
      }
    } catch (err: any) {
      alert(`Error reading file: ${err.message || 'Unknown error'}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={() => setIsPlacingCamera(true)}
          type="button"
        >
          <Plus size={16} />
          Place New Camera
        </button>

        {cameras.length > 0 && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (window.confirm('Remove all pinned camera locations from the map?')) {
                clearAllCameras();
              }
            }}
            title="Remove all pinned camera locations"
            aria-label="Remove all pinned camera locations"
            style={{ color: 'var(--accent-danger)', padding: '0 12px' }}
            type="button"
          >
            <Trash2 size={14} />
            Clear All
          </button>
        )}
      </div>

      {/* Camera Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {cameras.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}
          >
            No cameras placed yet. Click "Place New Camera" or click anywhere on the 3D globe to begin planning.
          </div>
        ) : (
          cameras.map((camera) => {
            const isSelected = camera.id === activeCameraId;
            return (
              <div
                key={camera.id}
                onClick={() => {
                  selectCamera(camera.id);
                  setFlyToTarget({
                    latitude: camera.position.latitude,
                    longitude: camera.position.longitude,
                    elevation: camera.position.elevation || 0,
                    heading: camera.heading
                  });
                }}
                style={{
                  background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-panel-card)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={getCameraIconUri(camera.specs.formFactor, camera.color, isSelected)}
                      alt={`${camera.name} icon`}
                      style={{
                        width: '20px',
                        height: '24px',
                        objectFit: 'contain',
                        filter: isSelected ? 'drop-shadow(0 0 5px #38bdf8)' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))'
                      }}
                    />
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                      {camera.name}
                    </div>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: '0.5px'
                      }}
                    >
                      {camera.specs.formFactor}
                    </span>
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: '10px', color: 'var(--text-accent)', fontWeight: 700 }}>
                      ACTIVE
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {camera.specs.modelName} • H: {camera.mountingHeight}m • Tilt: {Math.round(camera.tilt)}° • Azimuth: {Math.round(camera.heading)}°
                </div>

                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {camera.position.latitude.toFixed(6)}°, {camera.position.longitude.toFixed(6)}°
                </div>

                {/* Card Item Quick Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '6px',
                    marginTop: '2px'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-secondary btn-icon-only"
                    onClick={() => {
                      selectCamera(camera.id);
                      setFlyToTarget({
                        latitude: camera.position.latitude,
                        longitude: camera.position.longitude,
                        elevation: camera.position.elevation || 0,
                        heading: camera.heading
                      });
                    }}
                    title="Fly 3D view to camera location"
                    aria-label={`Fly 3D view to camera ${camera.name}`}
                    type="button"
                  >
                    <Navigation size={13} />
                  </button>
                  <button
                    className="btn btn-secondary btn-icon-only"
                    onClick={() => toggleCameraVisibility(camera.id)}
                    title={camera.visible ? 'Hide coverage footprint' : 'Show coverage footprint'}
                    aria-label={camera.visible ? `Hide coverage footprint for ${camera.name}` : `Show coverage footprint for ${camera.name}`}
                    type="button"
                  >
                    {camera.visible ? <Eye size={13} /> : <EyeOff size={13} style={{ color: 'var(--text-muted)' }} />}
                  </button>
                  <button
                    className="btn btn-secondary btn-icon-only"
                    onClick={() => duplicateCamera(camera.id)}
                    title="Duplicate camera"
                    aria-label={`Duplicate camera ${camera.name}`}
                    type="button"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    className="btn btn-secondary btn-icon-only"
                    onClick={() => deleteCamera(camera.id)}
                    title="Delete camera"
                    aria-label={`Delete camera ${camera.name}`}
                    style={{ color: 'var(--accent-danger)' }}
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Export & Import Tools */}
      <div className="card-section">
        <div className="card-title">
          <span>Project Data & Map Snapshot</span>
        </div>

        {/* Primary Save Project & Snapshot Button */}
        <button
          className="btn btn-primary"
          onClick={handleSaveProjectWithSnapshot}
          disabled={isSavingSnapshot}
          title="Save project details and snapshot of the map covered by CCTV cameras (JSON + PNG)"
          aria-label="Save project details and map snapshot"
          style={{
            width: '100%',
            marginBottom: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: isSavingSnapshot ? 'var(--accent-primary-hover)' : 'var(--accent-primary)'
          }}
          type="button"
        >
          <CameraIcon size={15} />
          {isSavingSnapshot ? 'Capturing Map Snapshot...' : 'Save Project with Map Snapshot'}
        </button>

        {saveSuccessMessage && (
          <div
            style={{
              padding: '6px 10px',
              marginBottom: '8px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10b981',
              color: '#6ee7b7',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CheckCircle2 size={13} />
            {saveSuccessMessage}
          </div>
        )}

        {/* Saved Map Snapshot Preview Card */}
        {lastMapSnapshot && (
          <div
            style={{
              marginBottom: '8px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              background: 'rgba(15, 23, 42, 0.8)'
            }}
          >
            <div
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 600,
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(30, 41, 59, 0.7)'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ImageIcon size={11} /> Saved Map Coverage Snapshot
              </span>
              <button
                type="button"
                onClick={handleDownloadSnapshotOnly}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '9px',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Download PNG
              </button>
            </div>
            <img
              src={lastMapSnapshot}
              alt="Map CCTV Coverage Snapshot"
              style={{
                width: '100%',
                maxHeight: '100px',
                objectFit: 'cover',
                display: 'block'
              }}
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '6px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadJson}
            title="Export project configuration as JSON"
            aria-label="Export project configuration as JSON"
            type="button"
          >
            <Download size={13} />
            Export JSON
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadGeoJson}
            title="Export camera footprints as GIS GeoJSON layer"
            aria-label="Export camera footprints as GIS GeoJSON layer"
            type="button"
          >
            <Download size={13} />
            GeoJSON
          </button>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Import Planning Project JSON or GeoJSON file"
          style={{ width: '100%' }}
          type="button"
        >
          <Upload size={13} />
          Import Planning Project
        </button>
        <input
          type="file"
          ref={fileInputRef}
          aria-label="Select Planning Project file to upload"
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.txt,.md,.json,.geojson,.csv,.tsv,.kml,text/*"
          onChange={handleFileSelect}
        />

      </div>
    </div>
  );
};
