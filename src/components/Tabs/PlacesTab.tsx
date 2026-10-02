import React, { useState, useRef, useEffect } from 'react';
import { useCctv } from '../../context/CctvContext';
import { parseProjectFile, ParsedProjectFileResult } from '../../utils/projectFileParser';
import { storage } from '../../services/storage';
import { DEFAULT_RECENT_PROJECTS, RecentProjectItem } from '../../data/sampleProjects';
import {
  Search,
  Navigation,
  Upload,
  FileText,
  FileCode,
  FileSpreadsheet,
  MoreVertical,
  Crosshair,
  Loader2,
  CheckCircle2,
  X,
  Plus
} from 'lucide-react';
import { VERIFIED_CAMERA_MODELS } from '../../data/cameraModels';

interface PlaceResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

export const PlacesTab: React.FC = () => {
  const {
    activeCamera,
    setFlyToTarget,
    addCameraAtCoordinates,
    selectCamera,
    addCamerasBatch,
    importProjectJson,
    loadCameras
  } = useCctv();

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [showResultsDropdown, setShowResultsDropdown] = useState<boolean>(false);

  // Editable coordinates state
  const [latitude, setLatitude] = useState<string>('17.000497');
  const [longitude, setLongitude] = useState<string>('81.804008');

  // Sync with active camera coordinates if selected
  useEffect(() => {
    if (activeCamera) {
      setLatitude(activeCamera.position.latitude.toFixed(6));
      setLongitude(activeCamera.position.longitude.toFixed(6));
    }
  }, [activeCamera]);

  // Project file upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Recent projects state
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>(DEFAULT_RECENT_PROJECTS);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Hydrate recent projects from storage
  useEffect(() => {
    storage.get<RecentProjectItem[]>('cctv_recent_projects', DEFAULT_RECENT_PROJECTS).then((items) => {
      if (items && items.length > 0) {
        setRecentProjects(items);
      }
    });
  }, []);

  // Execute location geocoding search
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check direct lat/lon coordinate entry
    const match = searchQuery.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[3]);
      if (!isNaN(lat) && !isNaN(lon)) {
        setLatitude(lat.toFixed(6));
        setLongitude(lon.toFixed(6));
        setFlyToTarget({ latitude: lat, longitude: lon, elevation: 250 });
        setShowResultsDropdown(false);
        return;
      }
    }

    setIsSearching(true);
    setShowResultsDropdown(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=6`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: PlaceResult[] = await res.json();
      setSearchResults(data || []);
      if (data && data.length > 0) {
        const top = data[0];
        setLatitude(parseFloat(top.lat).toFixed(6));
        setLongitude(parseFloat(top.lon).toFixed(6));
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlace = (place: PlaceResult) => {
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    setLatitude(lat.toFixed(6));
    setLongitude(lon.toFixed(6));
    setFlyToTarget({ latitude: lat, longitude: lon, elevation: 250 });
    setShowResultsDropdown(false);
  };

  const handlePlaceCameraAt = (place: PlaceResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    setFlyToTarget({ latitude: lat, longitude: lon, elevation: 200 });
    const cam = addCameraAtCoordinates({ latitude: lat, longitude: lon, elevation: 10 }, VERIFIED_CAMERA_MODELS[0]);
    selectCamera(cam.id);
    setShowResultsDropdown(false);
  };

  // Fly to current entered coordinates
  const handleFlyToLocation = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      alert('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }
    setFlyToTarget({
      latitude: lat,
      longitude: lon,
      elevation: 250
    });
  };

  // Populate coordinates from user's current GPS location or active camera
  const handleLocateTarget = () => {
    if (activeCamera) {
      setLatitude(activeCamera.position.latitude.toFixed(6));
      setLongitude(activeCamera.position.longitude.toFixed(6));
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toFixed(6));
          setLongitude(pos.coords.longitude.toFixed(6));
          setFlyToTarget({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            elevation: 250
          });
        },
        () => {
          // Default to Rajahmundry ISKCON temple coords
          setLatitude('17.000497');
          setLongitude('81.804008');
        }
      );
    }
  };

  // Process file upload (JSON, KML, CSV, GeoJSON, etc.)
  const processUploadedFile = async (file: File) => {
    setIsUploading(true);
    setStatusMessage(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      // If standard JSON, check if it's our project JSON
      if (ext === 'json') {
        const text = await file.text();
        const ok = importProjectJson(text);
        if (ok) {
          setStatusMessage(`Loaded project: ${file.name}`);
          setTimeout(() => setStatusMessage(null), 4000);
          return;
        }
      }

      // Universal project parser for CSV, KML, GeoJSON, TXT, PDF, DOC
      const result: ParsedProjectFileResult = await parseProjectFile(file);
      if (result.success && result.cameras.length > 0) {
        const added = addCamerasBatch(result.cameras);
        setStatusMessage(`Successfully imported ${added.length} cameras from ${file.name}`);

        // Add to recent projects
        const newProject: RecentProjectItem = {
          id: `proj-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          filename: file.name,
          extension: (ext === 'kml' ? 'kml' : ext === 'csv' ? 'csv' : 'json') as any,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          cameraCount: added.length,
          cameras: added
        };

        const updated = [newProject, ...recentProjects.filter((p) => p.filename !== file.name)].slice(0, 8);
        setRecentProjects(updated);
        storage.set('cctv_recent_projects', updated);

        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        alert(result.error || 'No camera coordinates detected in uploaded file.');
      }
    } catch (err: any) {
      alert(`Error reading file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file);
  };

  // Load a project from history
  const handleLoadRecentProject = (proj: RecentProjectItem) => {
    if (proj.cameras && proj.cameras.length > 0) {
      loadCameras(proj.cameras);
      setStatusMessage(`Loaded ${proj.name} (${proj.cameras.length} cameras)`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleClearHistory = () => {
    setRecentProjects([]);
    storage.set('cctv_recent_projects', []);
  };

  const getFileIcon = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'kml':
        return <FileCode size={18} className="file-icon kml" />;
      case 'csv':
        return <FileSpreadsheet size={18} className="file-icon csv" />;
      default:
        return <FileText size={18} className="file-icon json" />;
    }
  };

  return (
    <div className="places-tab-container">
      {/* 1. Search Location Section */}
      <div className="places-section">
        <label className="section-title">Search Location</label>

        <form onSubmit={handleSearchSubmit} className="places-search-bar">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="places-search-input"
            placeholder="Search a place (eg.Rajahmundry, ISKCON Temple)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowResultsDropdown(false);
              }}
            >
              <X size={13} />
            </button>
          )}
          {isSearching && <Loader2 size={14} className="spin" style={{ color: '#2563EB' }} />}
        </form>

        {/* Live Search Results Dropdown */}
        {showResultsDropdown && searchResults.length > 0 && (
          <div className="search-results-dropdown">
            {searchResults.map((res) => (
              <div
                key={res.place_id}
                className="search-result-item"
                onClick={() => handleSelectPlace(res)}
              >
                <div className="result-text-col">
                  <span className="result-name">{res.display_name}</span>
                  <span className="result-coords">
                    {parseFloat(res.lat).toFixed(5)}°, {parseFloat(res.lon).toFixed(5)}°
                  </span>
                </div>

                <div className="result-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="result-action-btn"
                    onClick={() => handleSelectPlace(res)}
                    title="Fly map to location"
                  >
                    <Navigation size={12} />
                  </button>
                  <button
                    type="button"
                    className="result-action-btn primary"
                    onClick={(e) => handlePlaceCameraAt(res, e)}
                    title="Place camera at location"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Coordinates Row */}
      <div className="places-section">
        <label className="section-title">Coordinates</label>

        <div className="coords-inputs-row">
          <div className="coord-field">
            <span className="coord-label">Latitude</span>
            <input
              type="text"
              className="coord-input"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </div>

          <div className="coord-field">
            <span className="coord-label">Longitude</span>
            <input
              type="text"
              className="coord-input"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="coord-locate-btn"
            onClick={handleLocateTarget}
            title="Snap to active camera coordinates"
          >
            <Crosshair size={16} />
          </button>
        </div>
      </div>

      {/* 3. Primary Fly to Location Button */}
      <button
        type="button"
        className="btn-fly-location"
        onClick={handleFlyToLocation}
      >
        <Navigation size={15} style={{ transform: 'rotate(45deg)' }} />
        <span>Fly to Location</span>
      </button>

      {/* 4. Project File Upload Card */}
      <div className="places-section" style={{ marginTop: '4px' }}>
        <label className="section-title">Project File</label>

        <div
          className={`project-upload-dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon-circle">
            <Upload size={20} />
          </div>

          <h4 className="upload-title">Upload Project File</h4>
          <span className="upload-formats">Supported: .json, .kml, .csv</span>

          <button
            type="button"
            className="btn-choose-file"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            {isUploading ? 'Parsing...' : 'Choose File'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.kml,.csv,.tsv,.geojson,.txt,.pdf,.doc,.docx"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {statusMessage && (
          <div className="upload-status-toast">
            <CheckCircle2 size={13} />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* 5. Recent Projects History */}
      <div className="places-section">
        <div className="recent-projects-header">
          <label className="section-title" style={{ marginBottom: 0 }}>Recent Projects</label>
          {recentProjects.length > 0 && (
            <button
              type="button"
              className="btn-clear-history"
              onClick={handleClearHistory}
            >
              Clear All
            </button>
          )}
        </div>

        <div className="recent-projects-list">
          {recentProjects.length === 0 ? (
            <div className="recent-projects-empty">
              No recent projects saved. Upload a file above to save your project history.
            </div>
          ) : (
            recentProjects.map((proj) => (
              <div
                key={proj.id}
                className="recent-project-card"
                onClick={() => handleLoadRecentProject(proj)}
                title={`Click to load ${proj.filename}`}
              >
                <div className="project-icon-box">
                  {getFileIcon(proj.extension)}
                </div>

                <div className="project-details">
                  <span className="project-filename">{proj.filename}</span>
                  <span className="project-meta">
                    {proj.date} • {proj.cameraCount} cameras
                  </span>
                </div>

                <div className="project-menu-anchor" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="project-menu-btn"
                    onClick={() => setActiveMenuId(activeMenuId === proj.id ? null : proj.id)}
                  >
                    <MoreVertical size={14} />
                  </button>

                  {activeMenuId === proj.id && (
                    <div className="project-dropdown-menu">
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          handleLoadRecentProject(proj);
                          setActiveMenuId(null);
                        }}
                      >
                        Load Project
                      </button>
                      <button
                        type="button"
                        className="dropdown-item text-danger"
                        onClick={() => {
                          const updated = recentProjects.filter((p) => p.id !== proj.id);
                          setRecentProjects(updated);
                          storage.set('cctv_recent_projects', updated);
                          setActiveMenuId(null);
                        }}
                      >
                        Remove from History
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
