import React, { useState, useMemo } from 'react';
import { useCctv } from '../../context/CctvContext';
import { SAMPLE_CAMERAS_RAJAHMUNDRY } from '../../data/sampleProjects';
import {
  Plus,
  Search,
  SlidersHorizontal,
  MoreVertical,
  Navigation,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Sliders,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  VideoOff
} from 'lucide-react';
import { getCameraIconUri } from '../../utils/cameraIcons';

interface CamerasTabProps {
  onInspectCamera?: (cameraId: string) => void;
}

export const CamerasTab: React.FC<CamerasTabProps> = ({ onInspectCamera }) => {
  const {
    cameras,
    activeCameraId,
    selectCamera,
    deleteCamera,
    duplicateCamera,
    toggleCameraVisibility,
    isPlacingCamera,
    setIsPlacingCamera,
    setFlyToTarget,
    clearAllCameras,
    loadCameras
  } = useCctv();

  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'warning' | 'offline'>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Determine camera operational status
  const getCameraStatus = (camera: (typeof cameras)[0]): 'online' | 'warning' | 'offline' => {
    if (!camera.visible) return 'offline';
    const isExaggerated = camera.rangeMeters > (camera.specs.maxOpticalRangeMeters || 60) * 1.3;
    if (isExaggerated || Math.abs(camera.tilt) > 60) return 'warning';
    return 'online';
  };

  // Filter & Search cameras
  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cam.name.toLowerCase().includes(q) ||
        cam.specs.modelName.toLowerCase().includes(q) ||
        (cam.specs.manufacturer && cam.specs.manufacturer.toLowerCase().includes(q));

      const status = getCameraStatus(cam);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      const matchesMfr =
        manufacturerFilter === 'all' ||
        cam.specs.manufacturer.toLowerCase() === manufacturerFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesMfr;
    });
  }, [cameras, searchQuery, statusFilter, manufacturerFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCameras = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredCameras.slice(start, start + pageSize);
  }, [filteredCameras, validCurrentPage, pageSize]);

  const handleSelectCamera = (id: string) => {
    selectCamera(id);
    const target = cameras.find((c) => c.id === id);
    if (target) {
      setFlyToTarget({
        latitude: target.position.latitude,
        longitude: target.position.longitude,
        elevation: (target.position.elevation || 0) + 200,
        heading: target.heading
      });
    }
  };

  const handleInspect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    selectCamera(id);
    setActiveMenuId(null);
    if (onInspectCamera) onInspectCamera(id);
  };

  // Get thumbnail for camera card
  const getCameraThumbnail = (cam: (typeof cameras)[0], isSelected: boolean) => {
    if (cam.name.toLowerCase().includes('iskcon') || cam.id.includes('iskcon')) {
      return '/temple_view.jpg';
    }
    // Fallback to crisp camera hardware or SVG icon
    return '/camera_hardware.jpg';
  };

  return (
    <div className="cameras-tab-container">
      {/* 1. Header with Count, Clear All & Add Camera Buttons */}
      <div className="cameras-tab-header">
        <div className="cameras-header-title">
          <h2>Cameras</h2>
          <span className="cameras-count-badge">
            {cameras.length} Camera{cameras.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="cameras-header-actions">
          {cameras.length > 0 && !isConfirmingClear && (
            <button
              type="button"
              className="btn-clear-cameras"
              onClick={() => setIsConfirmingClear(true)}
              title="Clear all cameras from project"
            >
              <Trash2 size={13} />
              <span>Clear All</span>
            </button>
          )}

          <button
            type="button"
            className={`btn-add-camera ${isPlacingCamera ? 'active-placing' : ''}`}
            onClick={() => setIsPlacingCamera(!isPlacingCamera)}
            title={isPlacingCamera ? 'Cancel camera placement' : 'Click to place a new camera on the map'}
          >
            <Plus size={15} />
            <span>{isPlacingCamera ? 'Click on Map' : 'Add Camera'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Banner for Clear All */}
      {isConfirmingClear && (
        <div className="clear-confirm-banner">
          <div className="clear-confirm-text">
            <AlertTriangle size={15} className="clear-warn-icon" />
            <span>Clear all <strong>{cameras.length}</strong> cameras from this project?</span>
          </div>
          <div className="clear-confirm-actions">
            <button
              type="button"
              className="btn-confirm-cancel"
              onClick={() => setIsConfirmingClear(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-confirm-execute"
              onClick={() => {
                clearAllCameras();
                setIsConfirmingClear(false);
              }}
            >
              Yes, Clear All
            </button>
          </div>
        </div>
      )}

      {/* 2. Search & Filter Bar */}
      <div className="cameras-search-bar-row">
        <div className="cameras-search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="cameras-search-input"
            placeholder="Search camera by name or model..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <button
          type="button"
          className={`cameras-filter-btn ${showFilterMenu || statusFilter !== 'all' || manufacturerFilter !== 'all' ? 'active' : ''}`}
          onClick={() => setShowFilterMenu(!showFilterMenu)}
          title="Filter cameras by status or manufacturer"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {/* Filter Dropdown Popover */}
      {showFilterMenu && (
        <div className="cameras-filter-popover">
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <div className="filter-pills">
              {(['all', 'online', 'warning', 'offline'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`filter-pill ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'online' && <span className="status-dot dot-online" />}
                  {s === 'warning' && <span className="status-dot dot-warning" />}
                  {s === 'offline' && <span className="status-dot dot-offline" />}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Manufacturer</label>
            <select
              className="filter-select"
              value={manufacturerFilter}
              onChange={(e) => setManufacturerFilter(e.target.value)}
            >
              <option value="all">All Manufacturers</option>
              <option value="hikvision">Hikvision</option>
              <option value="dahua">Dahua</option>
              <option value="cp plus">CP Plus</option>
              <option value="axis">Axis</option>
              <option value="hanwha">Hanwha</option>
              <option value="bosch">Bosch</option>
            </select>
          </div>
        </div>
      )}

      {/* 3. Camera Cards List */}
      <div className="cameras-list-scroll">
        {cameras.length === 0 ? (
          <div className="cameras-empty-state zero-cameras">
            <div className="zero-cameras-icon-circle">
              <VideoOff size={30} style={{ color: '#94A3B8' }} />
            </div>
            <h4 className="empty-title">All Cameras Cleared</h4>
            <p className="empty-desc">
              Your CCTV camera plan is currently empty. You can place cameras manually on the map, restore the default 34-camera Rajahmundry plan, or load an existing project file.
            </p>
            <div className="zero-cameras-actions">
              <button
                type="button"
                className="btn-restore-sample"
                onClick={() => loadCameras(SAMPLE_CAMERAS_RAJAHMUNDRY)}
              >
                <RotateCcw size={14} />
                <span>Restore Sample Cameras (34)</span>
              </button>
              <button
                type="button"
                className="btn-add-empty"
                onClick={() => setIsPlacingCamera(true)}
              >
                <Plus size={14} />
                <span>Place Camera on Map</span>
              </button>
            </div>
          </div>
        ) : paginatedCameras.length === 0 ? (
          <div className="cameras-empty-state">
            <AlertCircle size={28} className="empty-icon" />
            <p className="empty-title">No cameras match your search</p>
            <p className="empty-desc">
              Try adjusting your search terms or filter settings.
            </p>
          </div>
        ) : (
          paginatedCameras.map((camera) => {
            const isSelected = camera.id === activeCameraId;
            const status = getCameraStatus(camera);
            const thumbUrl = getCameraThumbnail(camera, isSelected);

            return (
              <div
                key={camera.id}
                className={`camera-item-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectCamera(camera.id)}
              >
                {/* Left Selection Checkbox */}
                <div
                  className="camera-item-checkbox"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectCamera(camera.id);
                  }}
                  title={isSelected ? 'Active Camera' : 'Select Camera'}
                >
                  {isSelected ? (
                    <div className="checkbox-box checked">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="checkbox-box" />
                  )}
                </div>

                {/* Camera Thumbnail Image */}
                <div className="camera-item-thumbnail-container">
                  <img
                    src={thumbUrl}
                    alt={camera.name}
                    className="camera-item-thumbnail"
                    onError={(e) => {
                      // Fallback to SVG icon
                      (e.target as HTMLImageElement).src = getCameraIconUri(
                        camera.specs.formFactor,
                        camera.color,
                        isSelected
                      );
                    }}
                  />
                </div>

                {/* Camera Details */}
                <div className="camera-item-details">
                  {/* Row 1: Status Dot + Name */}
                  <div className="camera-item-title-row">
                    <span
                      className={`camera-status-dot dot-${status}`}
                      title={`Status: ${status.toUpperCase()}`}
                    />
                    <span className="camera-item-name">{camera.name}</span>
                  </div>

                  {/* Row 2: Camera Model */}
                  <div className="camera-item-model">
                    {camera.specs.modelName}
                  </div>

                  {/* Row 3: Coordinates */}
                  <div className="camera-item-coords">
                    {camera.position.latitude.toFixed(6)}, {camera.position.longitude.toFixed(6)}
                  </div>

                  {/* Row 4: Hover Information Board */}
                  <div className="camera-hover-board">
                    <span className="hover-badge fov">{camera.specs.selectedHfov}° FOV</span>
                    <span className="hover-badge range">{camera.rangeMeters}m</span>
                    <span className="hover-badge heading">{camera.heading}° Az</span>
                  </div>
                </div>

                {/* Right 3-Dots More Options Menu */}
                <div className="camera-item-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="camera-item-menu-btn"
                    onClick={() => setActiveMenuId(activeMenuId === camera.id ? null : camera.id)}
                    title="Camera options"
                  >
                    <MoreVertical size={15} />
                  </button>

                  {activeMenuId === camera.id && (
                    <div className="camera-dropdown-menu">
                      <button
                        type="button"
                        className="dropdown-menu-item"
                        onClick={(e) => handleInspect(camera.id, e)}
                      >
                        <Sliders size={13} />
                        <span>Inspect Parameters</span>
                      </button>

                      <button
                        type="button"
                        className="dropdown-menu-item"
                        onClick={() => {
                          setFlyToTarget({
                            latitude: camera.position.latitude,
                            longitude: camera.position.longitude,
                            elevation: (camera.position.elevation || 0) + 200,
                            heading: camera.heading
                          });
                          setActiveMenuId(null);
                        }}
                      >
                        <Navigation size={13} />
                        <span>Fly to Location</span>
                      </button>

                      <button
                        type="button"
                        className="dropdown-menu-item"
                        onClick={() => {
                          toggleCameraVisibility(camera.id);
                          setActiveMenuId(null);
                        }}
                      >
                        {camera.visible ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{camera.visible ? 'Hide Coverage' : 'Show Coverage'}</span>
                      </button>

                      <button
                        type="button"
                        className="dropdown-menu-item"
                        onClick={() => {
                          duplicateCamera(camera.id);
                          setActiveMenuId(null);
                        }}
                      >
                        <Copy size={13} />
                        <span>Duplicate</span>
                      </button>

                      <div className="dropdown-divider" />

                      <button
                        type="button"
                        className="dropdown-menu-item text-danger"
                        onClick={() => {
                          deleteCamera(camera.id);
                          setActiveMenuId(null);
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete Camera</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Pagination Footer */}
      {totalPages > 1 && (
        <div className="cameras-pagination">
          <button
            type="button"
            className="pagination-btn"
            disabled={validCurrentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="Previous page"
          >
            &lt;
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                type="button"
                className={`pagination-num ${validCurrentPage === pageNum ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            className="pagination-btn"
            disabled={validCurrentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            title="Next page"
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
};
