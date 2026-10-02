import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera } from '../../types/camera';
import { storage } from '../../services/storage';
import { isGoogleEarthUrl } from '../utils/urlHelper';
import { Video, Globe2, ShieldCheck, Download, AlertCircle } from 'lucide-react';
import './popup.css';

const PopupApp: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [activeTabIsEarth, setActiveTabIsEarth] = useState<boolean>(false);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  useEffect(() => {
    storage.get<Camera[]>('cctv_saved_cameras', []).then((cams) => {
      setCameras(cams);
    });

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id) setActiveTabId(tab.id);
        if (tab?.url) {
          const isEarth = isGoogleEarthUrl(tab.url);
          setActiveTabIsEarth(isEarth);
        }
      });
    }
  }, []);

  const openGoogleEarth = () => {
    const url = 'https://earth.google.com/web/';
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const toggleOverlay = () => {
    if (activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_OVERLAY' });
      window.close();
    }
  };

  const reloadActiveMap = () => {
    if (activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.reload(activeTabId);
      window.close();
    }
  };

  const exportJson = () => {
    const data = {
      project: 'CCTV Coverage Plan',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      cameras
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cctv_plan_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <div className="popup-title">
          <Video size={18} style={{ color: '#2563eb' }} />
          <span>CCTV GeoPlanner</span>
        </div>
        <span
          style={{
            fontSize: '10px',
            background: '#dcfce7',
            color: '#16a34a',
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 700
          }}
        >
          v1.0.0
        </span>
      </div>

      {/* Status Card */}
      <div className="popup-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Saved Cameras:</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>
            {cameras.length} Active
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Target Host:</span>
          <span
            style={{
              fontSize: '11px',
              color: activeTabIsEarth ? '#16a34a' : '#d97706',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600
            }}
          >
            {activeTabIsEarth ? (
              <>
                <ShieldCheck size={13} /> Google Earth Web Active
              </>
            ) : (
              <>
                <AlertCircle size={13} /> Standby (Not on Earth)
              </>
            )}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="popup-actions">
        {activeTabIsEarth ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              style={{ justifyContent: 'center', fontSize: '12px' }}
              onClick={toggleOverlay}
            >
              <Video size={14} /> Toggle CCTV Planner
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'center', fontSize: '12px' }}
              onClick={reloadActiveMap}
            >
              🔄 Refresh Tab to Activate
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            style={{ justifyContent: 'center', fontSize: '12px' }}
            onClick={openGoogleEarth}
          >
            <Globe2 size={14} /> Open in Google Earth Web
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary"
          style={{ justifyContent: 'center', fontSize: '12px' }}
          onClick={exportJson}
        >
          <Download size={14} /> Export Cameras JSON
        </button>
      </div>

      <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', marginTop: '2px' }}>
        Hard geo-anchored 3D overlay for Google Earth Web.
      </div>
    </div>
  );
};

const rootEl = document.getElementById('popup-root');
if (rootEl) {
  createRoot(rootEl).render(<PopupApp />);
}
