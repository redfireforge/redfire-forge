/**
 * Floating pill-style control panel rendered inside the Results Explorer
 * `WorkflowExecutionCanvas`. Provides zoom in/out, fit-view, save layout, and
 * minimap-toggle buttons. Extracted from `WorkflowExecutionCanvas.tsx` to keep
 * the parent file under the monolithic-class threshold.
 */
import { useCallback, useState } from 'react';
import { useReactFlow } from '@xyflow/react';

interface ReplayCanvasControlsProps {
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  onSaveLayout?: () => void;
}

export function ReplayCanvasControls({ showMinimap, onToggleMinimap, onSaveLayout }: ReplayCanvasControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [saveFlash, setSaveFlash] = useState(false);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.05, duration: 200 });
  }, [fitView]);

  const handleSave = useCallback(() => {
    onSaveLayout?.();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  }, [onSaveLayout]);

  return (
    <div className="wf-pill-controls">
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
      <button type="button" className="wf-pill-btn" title="Fit view" onClick={handleFitView}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>
      <div className="wf-pill-sep" />
      <button
        type="button"
        className={`wf-pill-btn ${saveFlash ? 'save-flash' : ''}`}
        title="Save current node layout"
        onClick={handleSave}
        data-testid="save-layout-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      </button>
      {onToggleMinimap && (
        <>
          <div className="wf-pill-sep" />
          <button
            type="button"
            className={`wf-pill-btn ${showMinimap ? 'active' : ''}`}
            title="Toggle minimap"
            onClick={onToggleMinimap}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
