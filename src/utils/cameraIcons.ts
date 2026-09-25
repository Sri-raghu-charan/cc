/**
 * Camera Icon Generator for Cesium 3D Globe & Map Overlays
 * Generates crisp, high-definition, realistic CCTV camera icons for each form factor:
 * - Bullet
 * - Dome
 * - Turret
 * - PTZ
 * - Box
 * 
 * Uses self-contained base64 SVG and canvas-based rendering for 100% reliability
 * across all WebGL engines (CesiumJS), ensuring the camera is never a plain dot.
 */

import { CameraFormFactor } from '../types/camera';

const iconCache = new Map<string, string>();

/**
 * Returns inner SVG graphic for a given camera form factor with realistic details
 */
function getFormFactorSvgContent(formFactor: CameraFormFactor, color: string): string {
  switch (formFactor.toLowerCase()) {
    case 'bullet':
      return `
        <!-- CCTV Bullet Camera -->
        <!-- Mounting base plate -->
        <rect x="6" y="27" width="6" height="3" rx="0.5" fill="#475569" stroke="#334155" stroke-width="0.5" />
        <!-- Swivel mounting bracket arm -->
        <path d="M12 28.5 L15 28.5 L15 24 L17 23.5" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" />
        
        <!-- Main cylindrical camera body -->
        <rect x="15" y="16.5" width="16" height="10" rx="2" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
        <!-- Accent stripe in camera's system color -->
        <line x1="20" y1="17.5" x2="20" y2="25.5" stroke="${color}" stroke-width="1.8" />
        
        <!-- Protective sunshield canopy visor -->
        <path d="M13 16.5 L33 16.5 L30 13 L14 13 Z" fill="#334155" stroke="#1e293b" stroke-width="0.8" />
        
        <!-- Front optical lens barrel -->
        <rect x="30" y="17.5" width="4.5" height="8" rx="1" fill="#1e293b" />
        <!-- Optical glass lens aperture with cyan reflection -->
        <ellipse cx="34.5" cy="21.5" rx="1.5" ry="3.5" fill="#0f172a" />
        <ellipse cx="34.5" cy="20.5" rx="0.8" ry="1.8" fill="#38bdf8" />
        <circle cx="34" cy="19.5" r="0.6" fill="#ffffff" />
        
        <!-- Security Recording Indicator LED (Red blinking/solid dot) -->
        <circle cx="28" cy="19" r="1.2" fill="#ef4444" />
        <circle cx="28" cy="19" r="0.5" fill="#ffffff" />
      `;

    case 'dome':
      return `
        <!-- CCTV Dome Camera -->
        <!-- Surface mounting ceiling/wall baseplate -->
        <rect x="10" y="14" width="28" height="4.5" rx="1.5" fill="#334155" stroke="#1e293b" stroke-width="1" />
        <!-- Metal trim ring with camera accent color -->
        <rect x="12" y="18" width="24" height="2" fill="${color}" />
        
        <!-- Smoked optical dome bubble -->
        <path d="M12 20 C12 32 36 32 36 20 Z" fill="#0f172a" stroke="#475569" stroke-width="1" />
        <path d="M14 20 C14 29 34 29 34 20 Z" fill="#1e293b" opacity="0.6" />
        
        <!-- Internal camera gimbal eye -->
        <circle cx="24" cy="22" r="5" fill="#0f172a" stroke="${color}" stroke-width="1.5" />
        <!-- Camera optical lens with blue glare -->
        <circle cx="24" cy="22" r="2.5" fill="#0284c7" />
        <circle cx="24" cy="22" r="1.2" fill="#38bdf8" />
        <circle cx="23" cy="21" r="0.6" fill="#ffffff" />
        
        <!-- Security status indicator -->
        <circle cx="29" cy="16" r="1" fill="#10b981" />
      `;

    case 'turret':
      return `
        <!-- CCTV Eyeball / Turret Camera -->
        <!-- Angled mounting collar -->
        <path d="M11 15 L37 15 L33 21 L15 21 Z" fill="#334155" stroke="#1e293b" stroke-width="1" />
        <line x1="14" y1="18" x2="34" y2="18" stroke="${color}" stroke-width="1.5" />
        
        <!-- Spherical turret eyeball body -->
        <circle cx="24" cy="23.5" r="7.5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1" />
        
        <!-- Flat front faceplate -->
        <circle cx="24" cy="24" r="5" fill="#0f172a" stroke="${color}" stroke-width="1.2" />
        <!-- Central lens -->
        <circle cx="24" cy="24" r="2.2" fill="#0284c7" />
        <circle cx="23.2" cy="23.2" r="0.7" fill="#ffffff" />
        
        <!-- Infrared LED illuminator ring -->
        <circle cx="20.5" cy="22.5" r="0.7" fill="#ef4444" />
        <circle cx="27.5" cy="22.5" r="0.7" fill="#ef4444" />
        <circle cx="24" cy="27.2" r="0.7" fill="#ef4444" />
      `;

    case 'ptz':
      return `
        <!-- CCTV PTZ Speed Dome Camera -->
        <!-- Heavy-duty overhead pendant mount -->
        <path d="M21 11 L27 11 L27 15 L21 15 Z" fill="#475569" />
        <rect x="18" y="11" width="12" height="2" rx="0.5" fill="#334155" />
        
        <!-- Upper housing collar -->
        <path d="M14 15 L34 15 L32 20 L16 20 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
        <!-- Dual axis pan/tilt ring -->
        <rect x="17" y="20" width="14" height="2.5" fill="${color}" />
        
        <!-- Motorized optical dome sphere -->
        <circle cx="24" cy="25.5" r="7" fill="#0f172a" stroke="#334155" stroke-width="1" />
        <!-- Center powerful zoom lens barrel -->
        <circle cx="24" cy="25.5" r="3.5" fill="#1e293b" stroke="#38bdf8" stroke-width="1" />
        <circle cx="24" cy="25.5" r="1.8" fill="#0284c7" />
        <circle cx="23.2" cy="24.7" r="0.7" fill="#ffffff" />
        
        <!-- Pan rotation indicators -->
        <path d="M13 25 C13 28.5 16 30 19 30" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" />
        <path d="M35 25 C35 28.5 32 30 29 30" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" />
      `;

    case 'box':
      return `
        <!-- CCTV Box / Professional Camera -->
        <!-- Rectangular main body -->
        <rect x="17" y="15" width="18" height="12" rx="1.5" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
        <!-- Upper sunshield canopy -->
        <rect x="16" y="13.5" width="20" height="2.5" rx="0.5" fill="#334155" />
        
        <!-- Prominent C/CS-mount interchangeable lens barrel -->
        <rect x="10" y="17.5" width="7.5" height="7.5" rx="0.5" fill="#1e293b" stroke="${color}" stroke-width="1" />
        <rect x="7" y="18.5" width="3" height="5.5" rx="0.5" fill="#0f172a" />
        <ellipse cx="8.5" cy="21.2" rx="0.8" ry="1.5" fill="#38bdf8" />
        
        <!-- Rear cable gland & bracket -->
        <rect x="33" y="20" width="2" height="3" fill="#64748b" />
        <rect x="23" y="27" width="6" height="3" fill="#475569" />
        
        <!-- Status indicator LED -->
        <circle cx="31" cy="18" r="1" fill="#ef4444" />
      `;

    default:
      return `
        <!-- Generic CCTV Security Camera -->
        <path d="M12 15 L32 15 L29 12 L13 12 Z" fill="#334155" />
        <rect x="14" y="15.5" width="16" height="10" rx="2" fill="#f8fafc" stroke="${color}" stroke-width="1.5" />
        <rect x="29" y="17" width="4" height="7" rx="0.5" fill="#0f172a" />
        <circle cx="31" cy="20.5" r="1.5" fill="#38bdf8" />
        <circle cx="20" cy="20.5" r="2" fill="${color}" />
        <circle cx="26" cy="18" r="0.8" fill="#ef4444" />
      `;
  }
}

/**
 * Generates an unmistakable, high-definition CCTV camera pin icon data URL.
 * Employs clean base64 SVG without external ID references to guarantee 100%
 * rock-solid rendering on all WebGL textures and map canvases.
 */
export function getCameraIconUri(
  formFactor: CameraFormFactor | string = 'bullet',
  color: string = '#3b82f6',
  isSelected: boolean = false
): string {
  const normType = (formFactor || 'bullet').toLowerCase() as CameraFormFactor;
  const cacheKey = `${normType}_${color}_${isSelected ? 'sel' : 'unsel'}`;

  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const strokeColor = isSelected ? '#38bdf8' : color;
  const strokeWidth = isSelected ? '2.5' : '1.8';
  const badgeBg = '#0f172a';
  const haloColor = isSelected ? 'rgba(56, 189, 248, 0.45)' : 'rgba(0, 0, 0, 0.35)';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
  <!-- Outer drop shadow / focus halo -->
  <circle cx="24" cy="22" r="21" fill="${haloColor}" />

  <!-- Pin Marker Outer Shape: Downward pointing needle tip touching exact ground markup point -->
  <path d="M18 36 L24 53 L30 36 Z" fill="${badgeBg}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" />

  <!-- Main circular pin badge background -->
  <circle cx="24" cy="22" r="18" fill="${badgeBg}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />

  <!-- Inner contrast border -->
  <circle cx="24" cy="22" r="16" fill="#1e293b" opacity="0.9" />

  <!-- Real CCTV Camera Graphic -->
  <g>
    ${getFormFactorSvgContent(normType, strokeColor)}
  </g>

  <!-- Active selected status beacon dot on top-right -->
  ${
    isSelected
      ? `<circle cx="36" cy="10" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
         <circle cx="36" cy="10" r="2" fill="#ffffff" />`
      : ''
  }

  <!-- Ground contact pin tip dot -->
  <circle cx="24" cy="53" r="1.5" fill="#ffffff" stroke="${strokeColor}" stroke-width="0.8" />
</svg>`;

  // Base64 encode the SVG string safely to prevent URL fragment corruption
  let dataUri: string;
  try {
    if (typeof btoa !== 'undefined') {
      dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg.trim())))}`;
    } else if (typeof globalThis !== 'undefined' && (globalThis as unknown as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } }).Buffer) {
      const buf = (globalThis as unknown as { Buffer: { from: (s: string) => { toString: (enc: string) => string } } }).Buffer;
      dataUri = `data:image/svg+xml;base64,${buf.from(svg.trim()).toString('base64')}`;
    } else {
      dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
    }
  } catch {
    dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
  }

  iconCache.set(cacheKey, dataUri);
  return dataUri;
}
