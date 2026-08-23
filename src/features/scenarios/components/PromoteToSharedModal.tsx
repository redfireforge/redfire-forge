/**
 * PromoteToSharedModal — Promotes inline parameterized data to a Shared Data Source.
 *
 * Reuses PopupModal pattern from CopyTestModal.
 */
import { useState, useMemo } from 'react';
import type { DataSource } from '@shared/types';
import PopupModal from '@shared/components/PopupModal';

interface Props {
  dataSource: DataSource;
  testName: string;
  onConfirm: (name: string, tags?: string[]) => void;
  onClose: () => void;
}

export default function PromoteToSharedModal({ dataSource, testName, onConfirm, onClose }: Props) {
  const [name, setName] = useState(`${testName} Data`);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const preview = useMemo(() => {
    const cols = dataSource.columns ?? [];
    const rows = dataSource.rows ?? [];
    const enabledRows = rows.filter(r => r.enabled !== false);
    const disabledRows = rows.length - enabledRows.length;
    const validateCols = cols.filter(c => c.type === 'validate').length;
    const urlTemplate = dataSource.urlTemplate ?? '';
    return { cols, rows, enabledRows, disabledRows, validateCols, urlTemplate };
  }, [dataSource]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const canConfirm = name.trim().length > 0;

  return (
    <PopupModal
      title="⬆ Promote to Shared Data Source"
      onClose={onClose}
      dialogClassName="promote-modal-wide"
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm(name.trim(), tags.length > 0 ? tags : undefined)}
            disabled={!canConfirm}
          >
            ⬆ Promote & Link
          </button>
        </>
      )}
    >
      <div className="popup-modal-field">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a name for the shared data source"
          autoFocus
        />
      </div>

      <div className="popup-modal-field">
        <label>Tags <span className="text-muted">(optional)</span></label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <span key={tag} className="tag-pill">
              {tag}
              <button type="button" className="tag-pill-remove" onClick={() => handleRemoveTag(tag)}>×</button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleAddTag}
            placeholder="Add tag..."
            style={{ flex: 1, minWidth: 80 }}
          />
        </div>
      </div>

      <div className="popup-modal-section" style={{ marginTop: 16 }}>
        <div className="popup-modal-section-title">Preview</div>
        <div className="popup-modal-preview">
          <div className="preview-row">
            <span className="preview-label">Columns:</span>
            <span>{preview.cols.length} ({preview.cols.map(c => c.name).join(', ') || 'none'})</span>
          </div>
          <div className="preview-row">
            <span className="preview-label">Data rows:</span>
            <span>
              {preview.rows.length} total
              {preview.disabledRows > 0 && ` (${preview.enabledRows.length} enabled, ${preview.disabledRows} disabled)`}
            </span>
          </div>
          {preview.urlTemplate && (
            <div className="preview-row" style={{ flexWrap: 'wrap' }}>
              <span className="preview-label">URL template:</span>
              <code style={{ fontSize: '0.85em', wordBreak: 'break-all', flex: 1 }}>{preview.urlTemplate}</code>
            </div>
          )}
          {preview.validateCols > 0 && (
            <div className="preview-row">
              <span className="preview-label">Validation:</span>
              <span>{preview.validateCols} validate column{preview.validateCols > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="popup-modal-info" style={{ marginTop: 16 }}>
        <strong>After promotion:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
          <li>This test will be linked to the new shared data source</li>
          <li>Inline data will be removed from this test</li>
          <li>Edit data in "📦 Shared Data Sources" modal</li>
        </ul>
      </div>
    </PopupModal>
  );
}
