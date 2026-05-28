import type { ReactNode } from 'react';

interface Props {
  id: string;
  isCurrent: boolean;
  label: string;
  /** Raw label value for editing (before fallback like "v1") */
  rawLabel?: string;
  time: string;
  editingLabel: string | null;
  labelText: string;
  setEditingLabel: (id: string | null) => void;
  setLabelText: (text: string) => void;
  onRename: (id: string, label: string) => void;
  onPreview: () => void;
  onRestore: () => void;
  onDelete: () => void;
  /** Tags/badges rendered between time and current-tag */
  children?: ReactNode;
}

export default function VersionListItem({
  id, isCurrent, label, rawLabel, time,
  editingLabel, labelText, setEditingLabel, setLabelText,
  onRename, onPreview, onRestore, onDelete,
  children,
}: Props) {
  return (
    <div className={`version-item ${isCurrent ? 'version-current' : ''}`}>
      <div className="version-item-row">
        <div className="version-item-info">
          {editingLabel === id ? (
            <input
              className="version-label-input"
              autoFocus
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onRename(id, labelText); setEditingLabel(null); }
                if (e.key === 'Escape') setEditingLabel(null);
              }}
              onBlur={() => { onRename(id, labelText); setEditingLabel(null); }}
            />
          ) : (
            <span className="version-label" onClick={() => { setEditingLabel(id); setLabelText(rawLabel ?? ''); }}>
              {label}
            </span>
          )}
          <span className="version-time">{time}</span>
          {children}
          {isCurrent && <span className="version-current-tag">current</span>}
        </div>
        <div className="version-item-actions">
          <button type="button" className="btn btn-xs" onClick={onPreview}>
            Preview
          </button>
          {!isCurrent && (
            <button type="button" className="btn btn-xs" onClick={onRestore}>Restore</button>
          )}
          <button type="button" className="btn btn-xs btn-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}
