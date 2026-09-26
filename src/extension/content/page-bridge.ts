/**
 * Main-world bridge script that intercepts history.replaceState, history.pushState,
 * popstate, and hashchange in the page's execution context.
 * Dispatches __cctv_url_change__ with 0ms latency directly to the extension content script.
 */
(function () {
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

