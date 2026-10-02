import React from 'react';
import { Video, Sliders, Globe2, BarChart3 } from 'lucide-react';

export type MainTabType = 'cameras' | 'inspect' | 'places' | 'analysis';

interface MainTabsNavProps {
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
  cameraCount?: number;
}

/**
 * Primary 4-Tab Navigation for CCTV Planner
 * STRICT ORDER REQUIRED:
 * 1. Cameras
 * 2. Inspect
 * 3. Places
 * 4. Analysis
 */
export const MainTabsNav: React.FC<MainTabsNavProps> = ({
  activeTab,
  onTabChange,
  cameraCount
}) => {
  return (
    <nav className="cctv-main-nav" aria-label="CCTV Planner Primary Navigation">
      {/* 1. Cameras */}
      <button
        type="button"
        className={`cctv-nav-item ${activeTab === 'cameras' ? 'active' : ''}`}
        onClick={() => onTabChange('cameras')}
        aria-selected={activeTab === 'cameras'}
        role="tab"
        title="Cameras Management"
      >
        <div className="cctv-nav-icon">
          <Video size={16} />
        </div>
        <span className="cctv-nav-label">Cameras</span>
        {activeTab === 'cameras' && <span className="cctv-nav-indicator" />}
      </button>

      {/* 2. Inspect */}
      <button
        type="button"
        className={`cctv-nav-item ${activeTab === 'inspect' ? 'active' : ''}`}
        onClick={() => onTabChange('inspect')}
        aria-selected={activeTab === 'inspect'}
        role="tab"
        title="Camera Parameter & Sightline Inspection"
      >
        <div className="cctv-nav-icon">
          <Sliders size={16} />
        </div>
        <span className="cctv-nav-label">Inspect</span>
        {activeTab === 'inspect' && <span className="cctv-nav-indicator" />}
      </button>

      {/* 3. Places */}
      <button
        type="button"
        className={`cctv-nav-item ${activeTab === 'places' ? 'active' : ''}`}
        onClick={() => onTabChange('places')}
        aria-selected={activeTab === 'places'}
        role="tab"
        title="Search Global Locations & Upload Project Plans"
      >
        <div className="cctv-nav-icon">
          <Globe2 size={16} />
        </div>
        <span className="cctv-nav-label">Places</span>
        {activeTab === 'places' && <span className="cctv-nav-indicator" />}
      </button>

      {/* 4. Analysis */}
      <button
        type="button"
        className={`cctv-nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
        onClick={() => onTabChange('analysis')}
        aria-selected={activeTab === 'analysis'}
        role="tab"
        title="Coverage Frustums & Blind Spot Analysis"
      >
        <div className="cctv-nav-icon">
          <BarChart3 size={16} />
        </div>
        <span className="cctv-nav-label">Analysis</span>
        {activeTab === 'analysis' && <span className="cctv-nav-indicator" />}
      </button>
    </nav>
  );
};
