import { useReactFlow } from '@xyflow/react';

interface Props {
  showMinimap: boolean;
  onToggleMinimap: () => void;
  onRestoreLayout: () => void;
  onAutoLayout: () => void;
  disableLayout?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export default function WorkflowCanvasControls({
  showMinimap,
  onToggleMinimap,
  onRestoreLayout,
  onAutoLayout,
  disableLayout,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

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

      <button type="button" className="wf-pill-btn" title="Fit view" onClick={() => fitView({ padding: 0.2, duration: 300 })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>

      <button type="button" className="wf-pill-btn" title="Restore saved layout" onClick={onRestoreLayout} disabled={disableLayout}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="7" y="1" width="10" height="6" rx="1" />
          <rect x="1" y="17" width="10" height="6" rx="1" />
          <rect x="13" y="17" width="10" height="6" rx="1" />
          <rect x="11" y="7" width="2" height="4" />
          <rect x="5" y="11" width="2" height="6" />
          <rect x="6" y="10" width="12" height="2" />
          <rect x="17" y="11" width="2" height="6" />
        </svg>
      </button>

      <button type="button" className="wf-pill-btn" title="Auto-layout" onClick={onAutoLayout}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="7" y="1" width="10" height="5" rx="1" />
          <rect x="1" y="18" width="10" height="5" rx="1" />
          <rect x="13" y="18" width="10" height="5" rx="1" />
          <rect x="11" y="6" width="2" height="4" />
          <rect x="5" y="10" width="2" height="8" />
          <rect x="6" y="10" width="12" height="2" />
          <rect x="17" y="10" width="2" height="8" />
          <path d="M19 3 L21 5 L19 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="15" y1="5" x2="21" y2="5" stroke="currentColor" strokeWidth="1.5" />
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
