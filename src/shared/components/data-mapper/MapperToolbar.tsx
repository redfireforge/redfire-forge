interface MapperToolbarProps {
  onAutoMap: () => void;
  onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  mappingCount: number;
  autoMapCount?: number;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  hasPending?: boolean;
  onAcceptAllPending?: () => void;
  onRejectAllPending?: () => void;
}

export default function MapperToolbar({
  onAutoMap,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  mappingCount,
  autoMapCount,
  showPreview,
  onTogglePreview,
  hasPending,
  onAcceptAllPending,
  onRejectAllPending,
}: MapperToolbarProps) {
  return (
    <div className="dm-toolbar">
      <div className="dm-toolbar-left">
        <button className="dm-toolbar-btn dm-toolbar-btn--primary" onClick={onAutoMap} title="Auto-map matching fields">
          ⚡ Auto-map
          {autoMapCount !== undefined && autoMapCount > 0 && (
            <span className="dm-toolbar-badge">{autoMapCount}</span>
          )}
        </button>
        <button
          className="dm-toolbar-btn"
          onClick={onClearAll}
          disabled={mappingCount === 0}
          title="Clear all mappings"
        >
          ✕ Clear all
        </button>
        {hasPending && onAcceptAllPending && onRejectAllPending && (
          <>
            <button
              className="dm-toolbar-btn dm-toolbar-btn--accept"
              onClick={onAcceptAllPending}
              title="Accept all pending auto-maps"
            >
              ✓ Accept all
            </button>
            <button
              className="dm-toolbar-btn dm-toolbar-btn--reject"
              onClick={onRejectAllPending}
              title="Reject all pending auto-maps"
            >
              ✗ Reject all
            </button>
          </>
        )}
      </div>
      <div className="dm-toolbar-center">
        {mappingCount > 0 && (
          <span className="dm-toolbar-status">
            {mappingCount} mapping{mappingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="dm-toolbar-right">
        {onTogglePreview && (
          <button
            className={`dm-toolbar-btn ${showPreview ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onTogglePreview}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            ⊞ Preview
          </button>
        )}
        <button className="dm-toolbar-btn" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
          ↩ Undo
        </button>
        <button className="dm-toolbar-btn" onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)">
          ↪ Redo
        </button>
      </div>
    </div>
  );
}
