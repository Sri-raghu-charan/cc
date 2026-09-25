/**
 * Unified Map Navigation Service
 * Handles camera flying and view navigation across Google Earth Web, Google Maps,
 * and 3D geospatial viewers.
 */

import { Coordinates } from '../types/camera';

/**
 * Recursively traverses DOM and Shadow DOM to find matching elements inside Web Components.
 */
function findDeepElement(root: Node, selector: string): Element | null {
  if (!root) return null;

  if ('querySelector' in root) {
    try {
      const match = (root as Element).querySelector(selector);
      if (match) return match;
    } catch {
      // Ignore selector errors
    }
  }

  const children = (root as Element).children || (root as Document).childNodes;
  if (children) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const shadow = (child as Element).shadowRoot;
      if (shadow) {
        const found = findDeepElement(shadow, selector);
        if (found) return found;
      }
      const foundChild = findDeepElement(child, selector);
      if (foundChild) return foundChild;
    }
  }

  return null;
}

/**
 * Sets input value safely across React, Lit, Polymer, and native HTML forms.
 */
function setNativeInputValue(input: HTMLInputElement, value: string): void {
  try {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (valueSetter) {
      valueSetter.call(input, value);
    } else {
      input.value = value;
    }
  } catch {
    input.value = value;
  }

  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

/**
 * Dispatches realistic keyboard Enter sequence.
 */
function dispatchEnterKeys(element: HTMLElement): void {
  const events = ['keydown', 'keypress', 'keyup'];
  events.forEach((type) => {
    const event = new KeyboardEvent(type, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      composed: true,
      cancelable: true
    });
    element.dispatchEvent(event);
  });
}

/**
 * Navigates Google Earth Web 3D camera to target coordinates.
 */
function navigateGoogleEarth(coords: Coordinates & { heading?: number }): void {
  const lat = coords.latitude;
  const lon = coords.longitude;
  const elev = coords.elevation || 0;
  const heading = coords.heading ?? 0;

  // 1. Search Bar Input Automation in Google Earth Web
  // Common Google Earth Web search input selectors (light DOM & shadow DOM)
  const searchInputSelectors = [
    'input[placeholder*="Search" i]',
    'input[aria-label*="Search" i]',
    'input#input',
    '#search-input',
    'input.searchboxinput',
    'input[type="search"]',
    'earth-search input',
    'paper-input input',
    'iron-input input'
  ];

  let searchInput: HTMLInputElement | null = null;
  for (const sel of searchInputSelectors) {
    const el = findDeepElement(document, sel);
    if (el instanceof HTMLInputElement) {
      searchInput = el;
      break;
    }
  }

  // If search input isn't open yet, try clicking the search icon button in the toolbar
  if (!searchInput) {
    const searchBtn = findDeepElement(
      document,
      'button[aria-label*="Search" i], [role="button"][aria-label*="Search" i], #search-button, [data-tooltip*="Search" i]'
    );
    if (searchBtn instanceof HTMLElement) {
      searchBtn.click();
      for (const sel of searchInputSelectors) {
        const el = findDeepElement(document, sel);
        if (el instanceof HTMLInputElement) {
          searchInput = el;
          break;
        }
      }
    }
  }

  if (searchInput) {
    searchInput.focus();
    const coordString = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    setNativeInputValue(searchInput, coordString);
    dispatchEnterKeys(searchInput);

    // Also look for search submit button
    const submitBtn = findDeepElement(
      document,
      'button[aria-label*="Search" i], .searchbox-searchbutton, button[type="submit"]'
    );
    if (submitBtn instanceof HTMLElement && submitBtn !== searchInput) {
      submitBtn.click();
    }
  }

  // 2. Client Router / History PopState Navigation
  try {
    const viewDist = 450;
    const viewTilt = 55;
    const currentPath = window.location.pathname;
    const pathPrefix = currentPath.startsWith('/web') ? '/web' : '';
    const newPath = `${pathPrefix}/@${lat.toFixed(8)},${lon.toFixed(8)},${elev.toFixed(1)}a,${viewDist}d,35y,${heading.toFixed(1)}h,${viewTilt}t,0r`;

    window.history.pushState({ lat, lon }, '', newPath);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { lat, lon } }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (err) {
    console.warn('Google Earth router pushState error:', err);
  }
}

/**
 * Navigates Google Maps to target coordinates.
 */
function navigateGoogleMaps(coords: Coordinates): void {
  const lat = coords.latitude;
  const lon = coords.longitude;

  // Search input in Google Maps
  const searchInput = document.querySelector<HTMLInputElement>(
    '#searchboxinput, input#searchboxinput, input[aria-label*="Search" i]'
  );

  if (searchInput) {
    searchInput.focus();
    setNativeInputValue(searchInput, `${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    dispatchEnterKeys(searchInput);

    const searchBtn = document.querySelector<HTMLElement>('#searchbox-searchbutton');
    if (searchBtn) {
      searchBtn.click();
    }
  }

  try {
    const newUrl = `/@${lat.toFixed(7)},${lon.toFixed(7)},19z`;
    window.history.pushState({ lat, lon }, '', newUrl);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { lat, lon } }));
  } catch (err) {
    console.warn('Google Maps router error:', err);
  }
}

/**
 * Main public entrypoint: Navigates active map (Earth, Maps, or Cesium) to coordinates.
 */
export function navigateMapToCoordinates(coords: Coordinates & { heading?: number }): void {
  if (typeof window === 'undefined') return;

  const hostname = window.location.hostname;
  const href = window.location.href;
  const isEarth =
    hostname.includes('earth.google.com') ||
    window.location.pathname.includes('/earth') ||
    href.includes('earth.google.com');
  const isMaps =
    hostname.includes('google.com') &&
    (window.location.pathname.includes('/maps') || hostname.includes('maps.google.com'));

  if (isEarth) {
    navigateGoogleEarth(coords);
  } else if (isMaps) {
    navigateGoogleMaps(coords);
  }

  // Also broadcast custom event for any listeners
  try {
    window.dispatchEvent(new CustomEvent('cctv:navigate', { detail: coords }));
  } catch {
    // Ignored
  }
}
