/**
 * Main-world bridge script that intercepts history.replaceState, history.pushState,
 * popstate, and hashchange in Google Earth Web's execution context.
 * Dispatches __cctv_url_change__ with 0ms latency directly to the extension content script.
 */
(function () {
  // STRICT HOST BOUNDARY: Google Earth Web only
  if (typeof window === 'undefined' || !window.location) return;
  const isEarth =
    window.location.hostname === 'earth.google.com' &&
    (window.location.pathname === '/web' || window.location.pathname.startsWith('/web/'));

  if (!isEarth) return;

  if ((window as any).__cctv_bridge_installed__) return;
  (window as any).__cctv_bridge_installed__ = true;

  const broadcast = (targetUrl?: any) => {
    try {
      let resolvedHref = window.location.href;
      if (typeof targetUrl === 'string' && targetUrl.trim()) {
        try {
          resolvedHref = new URL(targetUrl, window.location.href).href;
        } catch {
          resolvedHref = targetUrl;
        }
      }
      window.dispatchEvent(
        new CustomEvent('__cctv_url_change__', {
          detail: { href: resolvedHref }
        })
      );
    } catch {
      // Ignored
    }
  };

  const origReplace = history.replaceState;
  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args);
    broadcast(args[2]);
    return ret;
  };

  const origPush = history.pushState;
  history.pushState = function (...args) {
    const ret = origPush.apply(this, args);
    broadcast(args[2]);
    return ret;
  };

  window.addEventListener('hashchange', () => broadcast(), { passive: true });
  window.addEventListener('popstate', () => broadcast(), { passive: true });
})();
