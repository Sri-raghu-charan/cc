import React, { useState, useRef } from 'react';
import { useCctv } from '../../context/CctvContext';
import { parseProjectFile, parseProjectText, ParsedCamera, ParsedProjectFileResult } from '../../utils/projectFileParser';
import {
  FileUp,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Compass,
  Layers,
  FileText,
  Upload,
  ArrowRight,
  ClipboardPaste
} from 'lucide-react';

interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({ isOpen, onClose }) => {
  const { addCamerasBatch } = useCctv();

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParsedProjectFileResult | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setParseResult(null);
    try {
      const res = await parseProjectFile(file);
      setParseResult(res);
      // Auto-deploy if cameras detected directly
      if (res.success && res.cameras.length > 0) {
        // We let the user see the preview and click Confirm or auto-fix
      }
    } catch (err: any) {
      setParseResult({
        success: false,
        filename: file.name,
        fileType: file.name.split('.').pop() || '',
        cameras: [],
        error: err.message || 'Failed to read file'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) return;
    setIsProcessing(true);
    const res = parseProjectText(pasteText, 'Pasted_Coordinates.txt', 'txt');
    setParseResult(res);
    setIsProcessing(false);
  };

  const handleConfirmDeploy = () => {
    if (!parseResult || parseResult.cameras.length === 0) return;

    const added = addCamerasBatch(parseResult.cameras);
    setSuccessToast(`Successfully anchored ${added.length} cameras to Earth coordinates!`);

    setTimeout(() => {
      setSuccessToast(null);
      onClose();
    }, 1200);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        pointerEvents: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 25px rgba(56, 189, 248, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(30, 41, 59, 0.8)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)'
              }}
            >
              <FileUp size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc', letterSpacing: '-0.3px' }}>
                Add Project Details
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Import camera locations from PDF, DOC, TXT, MD, CSV, or KML
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            padding: '8px 16px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
            gap: '8px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'upload' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              color: activeTab === 'upload' ? '#38bdf8' : '#94a3b8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Upload size={14} /> Upload File (PDF, DOC, TXT, MD, CSV)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'paste' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              color: activeTab === 'paste' ? '#38bdf8' : '#94a3b8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <ClipboardPaste size={14} /> Paste Text / Coordinates
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {successToast ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <CheckCircle2 size={40} color="#10b981" />
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{successToast}</div>
              <div style={{ fontSize: '12px', color: '#a7f3d0' }}>
                All camera pins are strictly anchored to WGS84 Earth coordinates.
              </div>
            </div>
          ) : parseResult && parseResult.success && parseResult.cameras.length > 0 ? (
            /* Parsed Cameras Preview */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#38bdf8" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                      {parseResult.cameras.length} Cameras Detected
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      From: {parseResult.filename} ({parseResult.fileType.toUpperCase()})
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: '#38bdf8',
                    fontWeight: 700,
                    background: 'rgba(15, 23, 42, 0.7)',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}
                >
                  <Lock size={12} /> Strict WGS84 Lock
                </div>
              </div>

              {/* Cameras List Preview */}
              <div
                style={{
                  maxHeight: '230px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  paddingRight: '4px'
                }}
              >
                {parseResult.cameras.map((cam, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(30, 41, 59, 0.7)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{cam.name}</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#38bdf8', marginTop: '1px' }}>
                          {cam.latitude.toFixed(6)}°, {cam.longitude.toFixed(6)}°
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
                      <span title="Mounting Height">{cam.mountingHeight || 5.0}m</span>
                      {typeof cam.heading === 'number' && (
                        <span title="Heading" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Compass size={11} /> {cam.heading}°
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setParseResult(null)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    background: 'transparent',
                    color: '#94a3b8',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Choose Another File
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDeploy}
                  style={{
                    flex: 2,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)'
                  }}
                >
                  <Lock size={14} /> Deploy & Strictly Fix to Earth
                </button>
              </div>
            </div>
          ) : parseResult && !parseResult.success ? (
            /* Error Display */
            <div
              style={{
                padding: '14px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 700 }}>
                <AlertTriangle size={18} /> Parse Error
              </div>
              <div style={{ fontSize: '12px', color: '#fca5a5', lineHeight: 1.4 }}>{parseResult.error}</div>
              <button
                type="button"
                onClick={() => setParseResult(null)}
                style={{
                  alignSelf: 'flex-start',
                  padding: '6px 12px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fff',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
            </div>
          ) : activeTab === 'upload' ? (
            /* Upload Drop Area */
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,.json,.geojson,.csv,.tsv,.kml,text/*"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: isDragging ? '2px dashed #38bdf8' : '2px dashed rgba(148, 163, 184, 0.3)',
                  background: isDragging ? 'rgba(56, 189, 248, 0.1)' : 'rgba(30, 41, 59, 0.4)',
                  borderRadius: '12px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8'
                  }}
                >
                  <Upload size={24} />
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                    Click to browse or drag & drop project file
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Supports PDF, DOC, DOCX, TXT, Markdown (.md), CSV, JSON, KML
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '4px'
                  }}
                >
                  {['.PDF', '.DOCX', '.TXT', '.MD', '.CSV', '.KML', '.JSON'].map((fmt) => (
                    <span
                      key={fmt}
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        background: 'rgba(51, 65, 85, 0.6)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '4px',
                        color: '#cbd5e1'
                      }}
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>

              {isProcessing && (
                <div style={{ textAlign: 'center', color: '#38bdf8', fontSize: '12px', padding: '10px' }}>
                  Processing document and extracting WGS84 coordinates...
                </div>
              )}
            </>
          ) : (
            /* Paste Coordinates Area */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Paste camera coordinates, Markdown table, CSV rows, or project survey text:
              </div>

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Example:&#10;Camera 1 (Main Gate): 40.7580, -73.9855, height: 6m, heading: 90&#10;Camera 2 (Loading Dock): 40.7585, -73.9842, height: 5.5m&#10;Camera 3 (Perimeter North): 40.7592, -73.9860"
                rows={7}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: '#f8fafc',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />

              <button
                type="button"
                onClick={handlePasteParse}
                disabled={!pasteText.trim() || isProcessing}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: pasteText.trim() ? '#0284c7' : 'rgba(51, 65, 85, 0.5)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                Extract Coordinates & Preview Cameras <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Real-World Anchor Guarantee Notice */}
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '11px',
              color: '#94a3b8'
            }}
          >
            <Lock size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#38bdf8' }}>Strict Real-World WGS84 Anchor:</strong> All imported cameras are
              physically anchored to their Earth coordinates. Panning, zooming, tilting, rotation, or UI movement cannot
              alter their location.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
