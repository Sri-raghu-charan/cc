import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCctv } from '../../context/CctvContext';
import { ExtensionSidebar } from '../sidebar/ExtensionSidebar';
import { StreetViewModal } from './StreetViewModal';
import { ProjectDetailsModal } from './ProjectDetailsModal';
import { storage } from '../../services/storage';
import {
  Video,
  Plus,
  Compass,
  Minus,
  Maximize2,
  X,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  MapPin,
  FolderUp,
  FileText
} from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

export const FloatingBar: React.FC = () => {
  const {
    cameras,
    activeCamera,
    isPlacingCamera,
    setIsPlacingCamera,
    isRelocatingCamera,
    setIsRelocatingCamera
  } = useCctv();

  const getDefaultPosition = (): Position => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    return {
      x: Math.max(20, width - 420),
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
      const clampedX = Math.max(10, Math.min(window.innerWidth - 320, savedPos.x));
      const clampedY = Math.max(10, Math.min(window.innerHeight - 80, savedPos.y));
      const clampedH = Math.max(380, Math.min(window.innerHeight - clampedY - 20, savedHeight));

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

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag from header handle
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

    // Clamp within window bounds
    const width = isMinimized ? 300 : 380;
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
    const newH = Math.max(380, Math.min(maxAvailable, resizeStartRef.current.startHeight + deltaY));
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
    // Mini restore button on screen edge if user closed the bar
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          top: '70px',
          right: '20px',
          zIndex: 2147483647,
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1.5px solid #38bdf8',
          color: '#38bdf8',
          borderRadius: '20px',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(56, 189, 248, 0.3)',
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
        className="cctv-floating-bar-wrapper"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: isMinimized ? '320px' : '380px',
          maxHeight: isMinimized ? 'auto' : 'calc(100vh - 60px)',
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
          zIndex: 99990,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
          transition: isDragging ? 'none' : 'box-shadow 0.2s, border-color 0.2s'
        }}
      >
        {/* Floating Bar Header (Always Visible & Draggable) */}
        <div
          className="cctv-floating-bar-header"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            padding: '10px 14px',
            background: 'rgba(30, 41, 59, 0.9)',
            borderBottom: isMinimized ? 'none' : '1px solid rgba(148, 163, 184, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
        >
          {/* Title & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GripHorizontal size={14} style={{ color: '#64748b' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc', letterSpacing: '-0.2px' }}>
                CCTV Planner
              </span>
              {/* Status Indicator Dot */}
              <span
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981'
                }}
                title="Geodetic Engine Active"
              />
              <span
                style={{
                  fontSize: '10px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 600
                }}
              >
                {cameras.length} CAM{cameras.length === 1 ? '' : 'S'}
              </span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Quick Add Camera */}
            <button
              type="button"
              className="btn btn-primary btn-icon-only"
              onClick={() => {
                setIsPlacingCamera(!isPlacingCamera);
                setIsRelocatingCamera(false);
              }}
              title={isPlacingCamera ? 'Cancel camera placement' : 'Add new camera to map'}
              style={{
                width: '24px',
                height: '24px',
                background: isPlacingCamera ? '#38bdf8' : '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px'
              }}
            >
              <Plus size={13} />
            </button>

            {/* Quick Relocate Active Camera */}
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={() => {
                setIsRelocatingCamera(!isRelocatingCamera);
                setIsPlacingCamera(false);
              }}
              title={isRelocatingCamera ? 'Cancel relocation' : 'Relocate active camera to junction / click'}
              style={{
                width: '24px',
                height: '24px',
                background: isRelocatingCamera ? '#0284c7' : 'rgba(51, 65, 85, 0.6)',
                color: isRelocatingCamera ? '#fff' : '#94a3b8',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '6px'
              }}
            >
              <MapPin size={12} />
            </button>

            {/* Add Project Details Button (Upload PDF, DOC, TXT, MD, CSV, etc.) */}
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={() => setShowProjectModal(true)}
              title="Add Project Details & Coordinates (Upload PDF, DOC, TXT, MD, CSV)"
              style={{
                width: '24px',
                height: '24px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '6px'
              }}
            >
              <FolderUp size={13} />
            </button>

            {/* Street View Inspector */}
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={() => setShowStreetView(true)}
              title="Inspect Real-World Street View"
              style={{
                width: '24px',
                height: '24px',
                background: 'rgba(51, 65, 85, 0.6)',
                color: '#94a3b8',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '6px'
              }}
            >
              <Compass size={13} />
            </button>

            {/* Minimize / Maximize Button */}
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? 'Expand CCTV Planner' : 'Minimize to compact bar'}
              style={{
                width: '24px',
                height: '24px',
                background: 'transparent',
                color: '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {isMinimized ? <Maximize2 size={13} /> : <Minus size={13} />}
            </button>

            {/* Close / Hide Button */}
            <button
              type="button"
              className="btn btn-secondary btn-icon-only"
              onClick={() => setIsVisible(false)}
              title="Hide CCTV Planner (Restore from top right)"
              style={{
                width: '24px',
                height: '24px',
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Workstation Sidebar Content (When Expanded) */}
        {!isMinimized && (
          <>
            {/* Project Details Quick Section Strip */}
            <div
              style={{
                padding: '7px 12px',
                background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.2), rgba(15, 23, 42, 0.95))',
                borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#cbd5e1' }}>
                <FileText size={13} color="#38bdf8" />
                <span style={{ fontWeight: 600 }}>Project Details:</span>
              </div>

              <button
                type="button"
                onClick={() => setShowProjectModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 2px 8px rgba(56, 189, 248, 0.35)'
                }}
              >
                <FolderUp size={12} /> Add Project Details
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', height: `${panelHeight}px`, display: 'flex', flexDirection: 'column' }}>
              <ExtensionSidebar />
            </div>

            {/* Bottom Resizing Drag Handle */}
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              title="Drag up or down to resize CCTV Planner height"
              style={{
                height: '14px',
                background: 'rgba(30, 41, 59, 0.95)',
                borderTop: '1px solid rgba(148, 163, 184, 0.15)',
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
                  width: '38px',
                  height: '3px',
                  background: isResizing ? '#38bdf8' : 'rgba(148, 163, 184, 0.4)',
                  borderRadius: '2px',
                  transition: 'background 0.15s ease'
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Street View Modal */}
      <StreetViewModal
        isOpen={showStreetView}
        onClose={() => setShowStreetView(false)}
        camera={activeCamera}
      />

      {/* Add Project Details & Universal File Upload Modal */}
      <ProjectDetailsModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
      />
    </>
  );
};

