/**
 * Main-world bridge script that intercepts history.replaceState, history.pushState,
 * popstate, and hashchange in the page's execution context.
 * Dispatches __cctv_url_change__ with 0ms latency directly to the extension content script.
 */
(function () {
  if ((window as any).__cctv_bridge_installed__) return;
  (window as any).__cctv_bridge_installed__ = true;

  const broadcast = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('__cctv_url_change__', {
          detail: { href: window.location.href }
        })
      );
    } catch {
      // Ignored
    }
  };

  const origReplace = history.replaceState;
  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args);
    broadcast();
    return ret;
  };

  const origPush = history.pushState;
  history.pushState = function (...args) {
    const ret = origPush.apply(this, args);
    broadcast();
    return ret;
  };

  window.addEventListener('hashchange', broadcast, { passive: true });
  window.addEventListener('popstate', broadcast, { passive: true });
})();
