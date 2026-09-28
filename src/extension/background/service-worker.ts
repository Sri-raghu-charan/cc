/**
 * Manifest V3 Background Service Worker for CCTV GeoPlanner
 * Strictly enforces Google Earth Web only activation.
 */

import { isGoogleEarthTab, isGoogleEarthUrl } from '../utils/urlHelper';

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('CCTV GeoPlanner Extension installed/reloaded:', details.reason);
  try {
    const tabs = await chrome.tabs.query({
      url: ['*://earth.google.com/web/*']
    });

    for (const tab of tabs) {
      if (tab.id && isGoogleEarthTab(tab)) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
          });
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content/content.css']
          });
        } catch {
          // Tab might be in restricted state or already injected
        }
      }
    }
  } catch (err) {
    console.debug('Tab auto-injection skipped:', err);
  }
});

// Handle clicks on extension icon in browser toolbar (if no popup or when triggered)
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  if (isGoogleEarthTab(tab)) {
    // Ping content script or toggle overlay on Google Earth Web
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
    } catch {
      // Content script may not have finished mounting yet
    }
  } else {
    // Open Google Earth Web in a new tab if user is on any unsupported page
    chrome.tabs.create({ url: 'https://earth.google.com/web/' });
  }
});

// Handle message requests from content scripts (e.g. capturing visible Earth tab for camera coverage snapshots)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CAPTURE_VISIBLE_TAB') {
    // Validate sender tab
    if (sender.tab && !isGoogleEarthTab(sender.tab)) {
      sendResponse({ success: false, error: 'Unauthorized origin for tab capture' });
      return false;
    }

    const winId = sender.tab?.windowId;
    const captureCallback = (dataUrl: string | undefined) => {
      if (chrome.runtime.lastError || !dataUrl) {
        console.warn('captureVisibleTab error:', chrome.runtime.lastError?.message);
        sendResponse({
          success: false,
          error: chrome.runtime.lastError?.message || 'Failed to capture visible tab'
        });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    };

    try {
      if (typeof winId === 'number') {
        (chrome.tabs as any).captureVisibleTab(winId, { format: 'png' }, captureCallback);
      } else {
        (chrome.tabs as any).captureVisibleTab({ format: 'png' }, captureCallback);
      }
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'captureVisibleTab error' });
    }
    return true; // Keep message channel open for async response
  }
});
