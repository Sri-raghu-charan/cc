/**
 * Manifest V3 Background Service Worker for CCTV GeoPlanner
 */

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('CCTV GeoPlanner Extension installed/reloaded:', details.reason);
  try {
    const tabs = await chrome.tabs.query({
      url: [
        '*://earth.google.com/*',
        '*://*.google.com/earth/*',
        '*://google.com/earth/*',
        '*://*.google.com/maps/*',
        '*://maps.google.com/*',
        '*://google.com/maps/*'
      ]
    });
    for (const tab of tabs) {
      if (tab.id) {
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

// Handle clicks on extension icon in browser toolbar
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const url = tab.url || '';
  const isEarthOrMaps = url.includes('earth.google.com') || url.includes('google.com/maps');

  if (isEarthOrMaps) {
    // Ping content script or toggle overlay
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
    } catch {
      // Content script may not have loaded yet, inject or reload
    }
  } else {
    // Open Google Earth in a new tab if user is not on a supported map
    chrome.tabs.create({ url: 'https://earth.google.com/web/' });
  }
});

// Handle message requests from content scripts (e.g. capturing visible Earth tab for camera coverage snapshots)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CAPTURE_VISIBLE_TAB') {
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

