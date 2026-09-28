/**
 * Centralized Google Earth Web URL and Tab validation utilities.
 * Enforces the strict single-platform activation boundary:
 * The extension must activate, inject, and render ONLY inside Google Earth Web (https://earth.google.com/web/*).
 */

/**
 * Positively identifies Google Earth Web URLs (https://earth.google.com/web/*)
 * and strictly rejects everything else (Google Maps, localhost, 127.0.0.1, GitHub,
 * YouTube, arbitrary Google pages, arbitrary websites, malformed URLs).
 */
export function isGoogleEarthUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;

  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);

    // Protocol must be standard http or https
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    // Host must be strictly 'earth.google.com'
    if (parsed.hostname !== 'earth.google.com') {
      return false;
    }

    // Path must target Google Earth Web application (/web or /web/*)
    const pathname = parsed.pathname;
    if (pathname === '/web' || pathname.startsWith('/web/')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Validates whether a Chrome Tab represents an active Google Earth Web session.
 */
export function isGoogleEarthTab(tab: { url?: string } | undefined | null): boolean {
  return isGoogleEarthUrl(tab?.url);
}
