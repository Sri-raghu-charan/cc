import React, { useState, useRef, useEffect } from 'react';
import { useCctv, BaseLayerType } from '../../context/CctvContext';
import {
  Cctv,
  Search,
  Layers,
  Settings,
  Plus,
  Loader2,
  MapPin,
  Navigation,
  X
} from 'lucide-react';
import { SettingsModal } from '../Settings/SettingsModal';
import { VERIFIED_CAMERA_MODELS } from '../../data/cameraModels';

interface HeaderSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const Header: React.FC = () => {
  const {
    isPlacingCamera,
    setIsPlacingCamera,
    baseLayer,
    setBaseLayer,
    setFlyToTarget,
    addCameraAtCoordinates,
    selectCamera
  } = useCctv();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<HeaderSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check if query is raw lat, lon coordinates (e.g. "40.7128, -74.0060")
    const coordMatch = searchQuery.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      if (!isNaN(lat) && !isNaN(lon)) {
        setFlyToTarget({ latitude: lat, longitude: lon, elevation: 250 });
        setShowDropdown(false);
        return;
      }
    }

    setIsSearching(true);
    setShowDropdown(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5`,
        {
          headers: {
            'Accept-Language': 'en'
          }
        }
      );
      const data: HeaderSearchResult[] = await response.json();
      if (data && data.length > 0) {
        setSearchResults(data);
        // Automatically fly to top match on Enter
        const top = data[0];
        setFlyToTarget({
          latitude: parseFloat(top.lat),
          longitude: parseFloat(top.lon),
          elevation: 250
        });
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (res: HeaderSearchResult) => {
    const lat = parseFloat(res.lat);
    const lon = parseFloat(res.lon);
    setFlyToTarget({ latitude: lat, longitude: lon, elevation: 250 });
    setShowDropdown(false);
  };

  const handlePlaceAtResult = (res: HeaderSearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const lat = parseFloat(res.lat);
    const lon = parseFloat(res.lon);
    setFlyToTarget({ latitude: lat, longitude: lon, elevation: 200 });

    const newCam = addCameraAtCoordinates(
      { latitude: lat, longitude: lon, elevation: 10 },
      VERIFIED_CAMERA_MODELS[0]
    );
    selectCamera(newCam.id);
    setShowDropdown(false);
  };

  return (
    <>
      <header className="top-header">
        {/* Brand Section */}
        <div className="brand-section">
          <div className="brand-icon">
            <Cctv size={18} />
          </div>
          <div className="brand-title">
            <span>CCTV GeoPlanner</span>
            <span className="brand-badge">3D Geospatial</span>
          </div>
        </div>

        {/* Search & Location Tool with Live Dropdown */}
        <div className="header-center-tools" ref={searchBoxRef} style={{ position: 'relative' }}>
          <form onSubmit={handleSearch} className="search-box">
            {isSearching ? (
              <Loader2 size={14} className="spin" style={{ color: 'var(--text-accent)' }} />
            ) : (
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
            )}
            <input
              type="text"
              className="search-input"
              aria-label="Search global places, cities, or coordinates"
              placeholder="Search any place in the world (e.g. Tokyo, Eiffel Tower, 40.758, -73.985)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!showDropdown && e.target.value.length >= 3) {
                  setShowDropdown(true);
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowDropdown(false);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            )}
          </form>

          {/* Interactive Search Results Dropdown */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '420px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.2)',
                zIndex: 200,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {searchResults.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {isSearching ? 'Searching global locations...' : 'Press Enter or type to search places'}
                </div>
              ) : (
                searchResults.map((res) => (
                  <div
                    key={res.place_id}
                    onClick={() => handleSelectResult(res)}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#EFF6FF')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <MapPin size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <div style={{ fontSize: '12px', color: '#1E293B', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {res.display_name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon-only"
                        title="Fly to this location"
                        aria-label={`Fly map to ${res.display_name}`}
                        onClick={() => handleSelectResult(res)}
                      >
                        <Navigation size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-icon-only"
                        title="Place camera at this location"
                        aria-label={`Place camera at ${res.display_name}`}
                        onClick={(e) => handlePlaceAtResult(res, e)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Action Tools */}
        <div className="header-actions">
          {/* Base Layer Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="select-input"
              id="base-layer-select"
              aria-label="Select base map imagery provider"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              value={baseLayer}
              onChange={(e) => setBaseLayer(e.target.value as BaseLayerType)}
            >
              <option value="satellite">Satellite (Esri Imagery)</option>
              <option value="osm">OpenStreetMap</option>
              <option value="carto_dark">Carto Dark Matter</option>
              <option value="carto_light">Carto Positron</option>
            </select>
          </div>

          {/* Place Camera Mode Toggle */}
          <button
            className={`btn ${isPlacingCamera ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsPlacingCamera(!isPlacingCamera)}
            type="button"
            title="Click to activate camera placement mode, then click on the map"
            aria-label={isPlacingCamera ? 'Cancel camera placement mode' : 'Add new camera to map'}
          >
            <Plus size={14} />
            {isPlacingCamera ? 'Click Map to Place' : 'Add Camera'}
          </button>

          {/* Settings Modal Button */}
          <button
            className="btn btn-secondary btn-icon-only"
            onClick={() => setShowSettings(true)}
            title="Settings & Map Configuration"
            aria-label="Settings & Map Configuration"
            type="button"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
};
