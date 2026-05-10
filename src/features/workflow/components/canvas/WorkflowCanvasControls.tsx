import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

interface Props {
  showMinimap: boolean;
  onToggleMinimap: () => void;
  onSaveLayout: () => void;
  savedViewport?: { x: number; y: number; zoom: number };
  disableLayout?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export default function WorkflowCanvasControls({
  showMinimap,
  onToggleMinimap,
  onSaveLayout,
  savedViewport,
  disableLayout,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const [saveFlash, setSaveFlash] = useState(false);

  const handleFitView = useCallback(() => {
    if (savedViewport) {
      setViewport(savedViewport, { duration: 300 });
    } else {
      fitView({ padding: 0.1, duration: 300 });
    }
  }, [savedViewport, setViewport, fitView]);

  const handleSave = useCallback(() => {
    onSaveLayout();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  }, [onSaveLayout]);

  return (
    <div className="wf-pill-controls">
      {onUndo && onRedo && (
        <>
          <button type="button" className="wf-pill-btn" title="Undo (⌘Z)" disabled={!canUndo} onClick={onUndo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
          </button>
          <button type="button" className="wf-pill-btn" title="Redo (⌘⇧Z)" disabled={!canRedo} onClick={onRedo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
            </svg>
          </button>
          <div className="wf-pill-sep" />
        </>
      )}
      <button type="button" className="wf-pill-btn" title="Zoom in" onClick={() => zoomIn({ duration: 200 })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>

      <button type="button" className="wf-pill-btn" title="Zoom out" onClick={() => zoomOut({ duration: 200 })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>

      <div className="wf-pill-sep" />

      <button type="button" className="wf-pill-btn" title={savedViewport ? 'Restore saved view' : 'Fit view'} onClick={handleFitView}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>

      <button
        type="button"
        className={`wf-pill-btn ${saveFlash ? 'save-flash' : ''}`}
        title="Save current node layout"
        onClick={handleSave}
        disabled={disableLayout}
        data-testid="save-layout-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      </button>

      <div className="wf-pill-sep" />

      <button
        type="button"
        className={`wf-pill-btn ${showMinimap ? 'wf-pill-btn-active' : ''}`}
        title="Toggle minimap"
        onClick={onToggleMinimap}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <rect x="12" y="12" width="8" height="8" rx="1" fill="currentColor" opacity="0.3" stroke="none"/>
        </svg>
      </button>
    </div>
  );
}
