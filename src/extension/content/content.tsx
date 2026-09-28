import React from 'react';
import { createRoot } from 'react-dom/client';
import { CctvProvider } from '../../context/CctvContext';
import { MapOverlayCanvas } from './MapOverlayCanvas';
import { FloatingBar } from './FloatingBar';
import { isGoogleEarthUrl } from '../utils/urlHelper';
import './content.css';

declare global {
  interface Window {
    __cctv_extension_initialized__?: boolean;
    __cctv_message_listener_attached__?: boolean;
  }
}

function initCctvExtension() {
  // STRICT HOST BOUNDARY: Only execute, mount, render, or listen on Google Earth Web
  if (typeof window === 'undefined' || !isGoogleEarthUrl(window.location.href)) {
    return;
  }

  // IDEMPOTENCY & RELOAD SAFETY: Ensure single extension root and renderer
  if (document.getElementById('cctv-extension-root') || window.__cctv_extension_initialized__) {
    return;
  }

  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCctvExtension, { once: true });
    } else {
      setTimeout(initCctvExtension, 50);
    }
    return;
  }

  window.__cctv_extension_initialized__ = true;

  const container = document.createElement('div');
  container.id = 'cctv-extension-root';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <CctvProvider>
        <MapOverlayCanvas />
        <FloatingBar />
      </CctvProvider>
    </React.StrictMode>
  );

  console.log('🎥 CCTV GeoPlanner extension active on Google Earth Web:', window.location.href);

  // Listen for extension commands from popup or background (attached once)
  if (!window.__cctv_message_listener_attached__ && typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    window.__cctv_message_listener_attached__ = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({ status: 'OK', version: '1.0.0', platform: 'earth' });
      } else if (message.type === 'TOGGLE_OVERLAY') {
        window.dispatchEvent(new CustomEvent('cctv-toggle-overlay'));
        sendResponse({ status: 'TOGGLED' });
      }
      return true;
    });
  }
}

if (typeof window !== 'undefined' && isGoogleEarthUrl(window.location.href)) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCctvExtension, { once: true });
  } else {
    initCctvExtension();
  }
}
