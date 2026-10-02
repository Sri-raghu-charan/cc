import React, { useState, useEffect, useRef } from 'react';
import { useCctv } from '../../context/CctvContext';
import { ExtensionSidebar } from '../sidebar/ExtensionSidebar';
import { StreetViewModal } from './StreetViewModal';
import { ProjectDetailsModal } from './ProjectDetailsModal';
import { SettingsModal } from '../../components/Settings/SettingsModal';
import { storage } from '../../services/storage';
import {
  Video,
  Minus,
  Maximize2,
  X,
  Settings
} from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

export const FloatingBar: React.FC = () => {
  const { cameras, activeCamera } = useCctv();

  const getDefaultPosition = (): Position => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    return {
      x: Math.max(20, width - 430),
      y: 70
    };
  };

  const getDefaultHeight = (): number => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    return Math.min(780, Math.max(540, vh - 130));
  };

  const [position, setPosition] = useState<Position>(getDefaultPosition);
  const [panelHeight, setPanelHeight] = useState<number>(getDefaultHeight);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showStreetView, setShowStreetView] = useState<boolean>(false);
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0
  });

  const resizeStartRef = useRef<{ startY: number; startHeight: number }>({
    startY: 0,
    startHeight: 600
  });

  const barRef = useRef<HTMLDivElement | null>(null);

  // Restore saved position, height, and state on mount
  useEffect(() => {
    async function loadSavedState() {
      const def = getDefaultPosition();
      const defH = getDefaultHeight();
      const savedPos = await storage.get<Position>('cctv_floating_bar_pos', def);
      const savedMin = await storage.get<boolean>('cctv_floating_bar_minimized', false);
      const savedVis = await storage.get<boolean>('cctv_floating_bar_visible', true);
      const savedHeight = await storage.get<number>('cctv_floating_bar_height', defH);

      // Clamp within viewport
      const clampedX = Math.max(10, Math.min(window.innerWidth - 340, savedPos.x));
      const clampedY = Math.max(10, Math.min(window.innerHeight - 80, savedPos.y));
      const clampedH = Math.max(400, Math.min(window.innerHeight - clampedY - 20, savedHeight));

      setPosition({ x: clampedX, y: clampedY });
      setIsMinimized(savedMin);
      setIsVisible(savedVis);
      setPanelHeight(clampedH);
    }
    loadSavedState();
  }, []);

  // Stop wheel events on the entire floating bar from bubbling to Google Earth globe
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const stopWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };
    el.addEventListener('wheel', stopWheel, { passive: true });
    return () => el.removeEventListener('wheel', stopWheel);
  }, []);

  // Listen for toggle messages
  useEffect(() => {
    const handleToggle = () => {
      setIsVisible((prev) => !prev);
    };
    window.addEventListener('cctv-toggle-overlay', handleToggle);
    return () => window.removeEventListener('cctv-toggle-overlay', handleToggle);
  }, []);

  // Save state changes
  useEffect(() => {
    storage.set('cctv_floating_bar_minimized', isMinimized);
  }, [isMinimized]);

  useEffect(() => {
    storage.set('cctv_floating_bar_visible', isVisible);
  }, [isVisible]);

  // Handle Dragging from header
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const newX = dragStartRef.current.posX + deltaX;
    const newY = dragStartRef.current.posY + deltaY;

    const width = isMinimized ? 300 : 400;
    const height = isMinimized ? 50 : 500;
    const clampedX = Math.max(10, Math.min(window.innerWidth - width, newX));
    const clampedY = Math.max(10, Math.min(window.innerHeight - height, newY));

    setPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      storage.set('cctv_floating_bar_pos', position);
    }
  };

  // Handle Height Resizing from bottom handle
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      startY: e.clientY,
      startHeight: panelHeight
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    const deltaY = e.clientY - resizeStartRef.current.startY;
    const maxAvailable = window.innerHeight - position.y - 20;
    const newH = Math.max(400, Math.min(maxAvailable, resizeStartRef.current.startHeight + deltaY));
    setPanelHeight(newH);
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isResizing) {
      setIsResizing(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      storage.set('cctv_floating_bar_height', panelHeight);
    }
  };

  if (!isVisible) {
    // Restore button on screen edge if closed
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          top: '70px',
          right: '20px',
          zIndex: 2147483647,
          background: '#FFFFFF',
          border: '1.5px solid #2563EB',
          color: '#2563EB',
          borderRadius: '24px',
          padding: '8px 16px',
          fontSize: '12.5px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
          pointerEvents: 'auto'
        }}
      >
        <Video size={16} /> Open CCTV Planner
      </button>
    );
  }

  return (
    <>
      <div
        ref={barRef}
        className="cctv-floating-bar-wrapper cctv-app-window"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: isMinimized ? '320px' : '400px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 20px 40px -8px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.05)',
          zIndex: 99990,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
          transition: isDragging ? 'none' : 'box-shadow 0.2s'
        }}
      >
        {/* Floating Bar Window Header */}
        <div
          className="cctv-window-header"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          {/* Brand Logo & Title */}
          <div className="window-header-brand">
            <div className="window-brand-icon">
              <Video size={15} />
            </div>
            <span className="window-brand-title">CCTV Planner</span>
          </div>

          {/* Right Header Actions (Settings, Minimize, Close) */}
          <div className="window-header-actions">
            <button
              type="button"
              className="window-action-btn"
              onClick={() => setShowSettingsModal(true)}
              title="Settings & Geospatial Tokens"
              aria-label="Settings & Geospatial Tokens"
            >
              <Settings size={15} />
            </button>

            <button
              type="button"
              className="window-action-btn"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? 'Expand CCTV Planner' : 'Minimize'}
              aria-label={isMinimized ? 'Expand CCTV Planner' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 size={13} /> : <Minus size={14} />}
            </button>

            <button
              type="button"
              className="window-action-btn"
              onClick={() => setIsVisible(false)}
              title="Hide CCTV Planner (Restore from screen edge)"
              aria-label="Hide CCTV Planner"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Workstation Sidebar Content (When Expanded) */}
        {!isMinimized && (
          <>
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                height: `${panelHeight}px`,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <ExtensionSidebar />
            </div>

            {/* Bottom Resizing Drag Handle */}
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              title="Drag up or down to resize CCTV Planner height"
              style={{
                height: '12px',
                background: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'ns-resize',
                userSelect: 'none',
                touchAction: 'none'
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '3px',
                  background: isResizing ? '#2563EB' : '#CBD5E1',
                  borderRadius: '2px',
                  transition: 'background 0.15s ease'
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Street View Modal */}
      <StreetViewModal
        isOpen={showStreetView}
        onClose={() => setShowStreetView(false)}
        camera={activeCamera}
      />

      {/* Project Details Modal */}
      <ProjectDetailsModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
      />
    </>
  );
};
