import React, { useState } from 'react';
import { useCctv } from '../../context/CctvContext';
import { MainTabsNav, MainTabType } from '../Navigation/MainTabsNav';
import { CamerasTab } from '../Tabs/CamerasTab';
import { InspectTab } from '../Tabs/InspectTab';
import { PlacesTab } from '../Tabs/PlacesTab';
import { AnalysisTab } from '../Tabs/AnalysisTab';

export const Sidebar: React.FC = () => {
  const { cameras } = useCctv();
  const [activeTab, setActiveTab] = useState<MainTabType>('cameras');

  return (
    <aside className="app-sidebar" aria-label="Planning Workstation Sidebar">
      {/* 4 Primary Navigation Tabs in strict order: Cameras -> Inspect -> Places -> Analysis */}
      <MainTabsNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cameraCount={cameras.length}
      />

      {/* Tab Content Body */}
      <div className="cctv-panel-body">
        {activeTab === 'cameras' && (
          <CamerasTab onInspectCamera={() => setActiveTab('inspect')} />
        )}

        {activeTab === 'inspect' && (
          <InspectTab onNavigateToPlaces={() => setActiveTab('places')} />
        )}

        {activeTab === 'places' && <PlacesTab />}

        {activeTab === 'analysis' && <AnalysisTab />}
      </div>
    </aside>
  );
};

export default Sidebar;
