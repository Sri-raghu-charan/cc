import React, { useState, useRef, useEffect } from 'react';
import { useCctv } from '../../context/CctvContext';
import { MainTabsNav, MainTabType } from '../../components/Navigation/MainTabsNav';
import { CamerasTab } from '../../components/Tabs/CamerasTab';
import { InspectTab } from '../../components/Tabs/InspectTab';
import { PlacesTab } from '../../components/Tabs/PlacesTab';
import { AnalysisTab } from '../../components/Tabs/AnalysisTab';

export type ExtensionTabType = MainTabType;

interface ExtensionSidebarProps {
  initialTab?: MainTabType;
}

export const ExtensionSidebar: React.FC<ExtensionSidebarProps> = ({ initialTab = 'cameras' }) => {
  const { cameras } = useCctv();
  const [activeTab, setActiveTab] = useState<MainTabType>(initialTab);

  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Isolate wheel scrolling so Google Earth globe does not steal zoom events
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const stopPropagation = (e: WheelEvent) => {
      e.stopPropagation();
    };

    el.addEventListener('wheel', stopPropagation, { passive: true });
    return () => {
      el.removeEventListener('wheel', stopPropagation);
    };
  }, []);

  return (
    <div
      className="extension-sidebar-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-main, #F8FAFC)'
      }}
    >
      {/* 4 Primary Navigation Tabs (Cameras -> Inspect -> Places -> Analysis) */}
      <MainTabsNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cameraCount={cameras.length}
      />

      {/* Tab Content Body */}
      <div
        ref={bodyRef}
        className="cctv-panel-body"
        onWheel={(e) => e.stopPropagation()}
      >
        {activeTab === 'cameras' && (
          <CamerasTab onInspectCamera={() => setActiveTab('inspect')} />
        )}

        {activeTab === 'inspect' && (
          <InspectTab onNavigateToPlaces={() => setActiveTab('places')} />
        )}

        {activeTab === 'places' && <PlacesTab />}

        {activeTab === 'analysis' && <AnalysisTab />}
      </div>
    </div>
  );
};
