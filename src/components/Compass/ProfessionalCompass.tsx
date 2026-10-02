import React, { useRef, useState, useCallback, useEffect } from 'react';
import { normalizeHeading } from '../../geo/coordinates';
import { Crosshair } from 'lucide-react';

interface ProfessionalCompassProps {
  heading: number;
  onChange: (heading: number) => void;
  onAimClick?: () => void;
  isAiming?: boolean;
  disabled?: boolean;
}

export const getCardinalDirection = (deg: number): string => {
  const normalized = ((deg % 360) + 360) % 360;
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
};

export const ProfessionalCompass: React.FC<ProfessionalCompassProps> = ({
  heading,
  onChange,
  onAimClick,
  isAiming = false,
  disabled = false
}) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(Math.round(heading).toString());

  useEffect(() => {
    setInputValue(Math.round(heading).toString());
  }, [heading]);

  const updateHeadingFromCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;

      // 0° = North (deltaX = 0, deltaY < 0)
      // 90° = East (deltaX > 0, deltaY = 0)
      let angleRad = Math.atan2(deltaX, -deltaY);
      let angleDeg = angleRad * (180 / Math.PI);
      const normalized = Math.round(normalizeHeading(angleDeg));
      onChange(normalized);
    },
    [onChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateHeadingFromCoords(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    updateHeadingFromCoords(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(normalizeHeading(num));
    }
  };

  const roundedHeading = Math.round(heading);

  return (
    <div className="pro-compass-wrapper">
      {/* Compass Dial Container */}
      <div
        ref={dialRef}
        className="pro-compass-dial"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="Click or drag around compass to rotate camera orientation"
      >
        {/* Outer Ring Ticks (SVG) */}
        <svg
          viewBox="0 0 160 160"
          className="pro-compass-ticks-svg"
          aria-hidden="true"
        >
          {Array.from({ length: 36 }).map((_, i) => {
            const deg = i * 10;
            const isMajor = deg % 30 === 0;
            const isCardinal = deg % 90 === 0;
            const rad = (deg - 90) * (Math.PI / 180);
            const rOuter = 74;
            const rInner = isCardinal ? 63 : isMajor ? 66 : 70;
            const x1 = 80 + rOuter * Math.cos(rad);
            const y1 = 80 + rOuter * Math.sin(rad);
            const x2 = 80 + rInner * Math.cos(rad);
            const y2 = 80 + rInner * Math.sin(rad);
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isCardinal ? '#94A3B8' : isMajor ? '#CBD5E1' : '#E2E8F0'}
                strokeWidth={isCardinal ? 1.8 : isMajor ? 1.2 : 0.8}
              />
            );
          })}
        </svg>

        {/* Cardinal Markers */}
        <span className="pro-compass-cardinal card-n">N</span>
        <span className="pro-compass-cardinal card-e">E</span>
        <span className="pro-compass-cardinal card-s">S</span>
        <span className="pro-compass-cardinal card-w">W</span>

        {/* Directional Wedge (Translucent blue field of view cone radiating from center) */}
        <div
          className="pro-compass-wedge"
          style={{ transform: `translate(-50%, -50%) rotate(${roundedHeading}deg)` }}
        >
          <svg viewBox="0 0 100 100" className="pro-wedge-svg">
            <defs>
              <linearGradient id="azimuthConeGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#60A5FA" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            {/* 36-degree sector pointing up */}
            <path
              d="M 50 50 L 32 4 A 48 48 0 0 1 68 4 Z"
              fill="url(#azimuthConeGradient)"
            />
            {/* Center aim line */}
            <line x1="50" y1="50" x2="50" y2="3" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="2,2" />
          </svg>
        </div>

        {/* Center Stylized CCTV Camera Icon Rotated to Heading */}
        <div
          className="pro-compass-center-camera"
          style={{ transform: `translate(-50%, -50%) rotate(${roundedHeading}deg)` }}
        >
          <div className="pro-camera-symbol">
            <div className="cam-lens" />
            <div className="cam-body" />
          </div>
        </div>
      </div>

      {/* Numerical Degree Input & Aim Button */}
      <div className="pro-compass-controls">
        <div className="pro-degree-input-box">
          <input
            type="number"
            min="0"
            max="359"
            aria-label="Camera direction azimuth in degrees"
            value={inputValue}
            onChange={handleInputChange}
            className="pro-degree-input"
          />
          <span className="pro-degree-unit">°</span>
        </div>

        {onAimClick && (
          <button
            type="button"
            className={`pro-aim-btn ${isAiming ? 'active' : ''}`}
            onClick={onAimClick}
            title={isAiming ? 'Click down a street to aim heading' : 'Aim camera heading down a street'}
            aria-label="Aim camera heading"
          >
            <Crosshair size={15} />
          </button>
        )}
      </div>

      {/* Quick Cardinal Direction Snaps */}
      <div className="pro-cardinal-snaps">
        <button
          type="button"
          className={`snap-btn ${roundedHeading === 0 ? 'active' : ''}`}
          onClick={() => onChange(0)}
        >
          N (0°)
        </button>
        <button
          type="button"
          className={`snap-btn ${roundedHeading === 90 ? 'active' : ''}`}
          onClick={() => onChange(90)}
        >
          E (90°)
        </button>
        <button
          type="button"
          className={`snap-btn ${roundedHeading === 180 ? 'active' : ''}`}
          onClick={() => onChange(180)}
        >
          S (180°)
        </button>
        <button
          type="button"
          className={`snap-btn ${roundedHeading === 270 ? 'active' : ''}`}
          onClick={() => onChange(270)}
        >
          W (270°)
        </button>
      </div>
    </div>
  );
};
