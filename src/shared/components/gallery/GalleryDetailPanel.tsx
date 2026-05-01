import { useState } from 'react';
import type { GalleryEntry } from '../../../data/galleries/types';
import type { GallerySampleStatus } from '../../../features/gallery/types';
import { DifficultyDots } from './DifficultyDots';
import { LiveApiBadge } from './LiveApiBadge';
import AppModalFrame from '../AppModalFrame';

interface GalleryDetailPanelProps<T = unknown> {
  entry: GalleryEntry<T> | null;
  /** Label for the primary action button (e.g. "Import", "Load", "Apply"). */
  actionLabel?: string;
  /** Label for the secondary action button (e.g. "Try It"). */
  secondaryLabel?: string;
  onAction?: (entry: GalleryEntry<T>) => void;
  onSecondary?: (entry: GalleryEntry<T>) => void;
  onClose?: () => void;
  /** Optional render prop for domain-specific preview content. */
  renderPreview?: (entry: GalleryEntry<T>, onExpand: (label: string, content: string) => void) => React.ReactNode;
  /** Import status for this sample. */
  sampleStatus?: GallerySampleStatus;
}

/**
 * Right-side detail panel shown when a gallery card is selected.
 *
 * Shows: icon, name, description, difficulty, tags, live-API list,
 * action buttons, and an optional domain-specific preview.
 */
export function GalleryDetailPanel<T = unknown>({
  entry,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
  onClose,
  renderPreview,
  sampleStatus: _sampleStatus,
}: GalleryDetailPanelProps<T>) {
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');

  if (!entry) return null;

  const handleExpandPreview = (label: string, content: string) => {
    setModalTitle(`${entry.name} — ${label}`);
    setModalContent(content);
    setShowJsonModal(true);
  };

  // Fallback: for non-rich previews, expand shows full factory output
  const handleExpandFallback = () => {
    const item = entry.factory();
    const text = (() => {
      try { return typeof item === 'string' ? item : JSON.stringify(item, null, 2); } catch { return String(item); }
    })();
    setModalTitle(`${entry.name} — Preview`);
    setModalContent(text);
    setShowJsonModal(true);
  };

  return (
    <div className="gallery-detail-panel">
      <div className="gallery-detail-header">
        <div className="gallery-detail-icon">{entry.icon}</div>
        <div className="gallery-detail-title-group">
          <div className="gallery-detail-name">{entry.name}</div>
        </div>
        {onClose && (
          <button className="gallery-detail-close" onClick={onClose} type="button" aria-label="Close detail panel">
            ✕
          </button>
        )}
      </div>

      <div className="gallery-detail-desc">{entry.description}</div>

      <div className="gallery-detail-meta">
        <div className="gallery-detail-row">
          <span className="gallery-detail-label">Difficulty</span>
          <DifficultyDots level={entry.difficulty} />
        </div>

        {entry.liveApis.length > 0 && (
          <div className="gallery-detail-row">
            <span className="gallery-detail-label">Live API</span>
            <div className="gallery-detail-apis">
              {entry.liveApis.map(api => (
                <LiveApiBadge key={api} api={api} />
              ))}
            </div>
          </div>
        )}

        {entry.tags.length > 0 && (
          <div className="gallery-detail-row">
            <span className="gallery-detail-label">Tags</span>
            <div className="gallery-detail-tags">
              {entry.tags.map(tag => (
                <span key={tag} className="gallery-tag">#{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {renderPreview && (() => {
        const preview = renderPreview(entry, handleExpandPreview);
        const isRich = typeof preview === 'object';
        if (isRich) {
          // Rich preview (e.g. tabbed RequestPreview) — no click-to-expand wrapper
          return <div className="gallery-detail-preview gallery-detail-preview-rich">{preview}</div>;
        }
        // Plain text preview with expand button
        return (
          <div className="gallery-detail-preview" style={{ position: 'relative' }}>
            <button
              type="button"
              className="gallery-tab-expand-btn"
              title="View full content in modal"
              onClick={handleExpandFallback}
            >
              ↗
            </button>
            <pre className="gallery-detail-preview-pre">{preview}</pre>
          </div>
        );
      })()}

      <div className="gallery-detail-actions">
        {onAction && actionLabel && (
          <button
            className="gallery-detail-btn gallery-detail-btn-primary"
            onClick={() => onAction(entry)}
            type="button"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            className="gallery-detail-btn gallery-detail-btn-secondary"
            onClick={() => onSecondary(entry)}
            type="button"
          >
            {secondaryLabel}
          </button>
        )}
      </div>

      {showJsonModal && (
        <AppModalFrame
          title={modalTitle}
          onClose={() => setShowJsonModal(false)}
          overlayClassName="popup-modal-overlay modal-overlay gallery-json-overlay"
          dialogClassName="popup-modal gallery-json-dialog modal"
          bodyClassName="gallery-json-modal-body"
          minWidth={600}
          minHeight={400}
          closeOnOverlayClick={false}
          closeButtonKind="none"
          footer={
            <div className="gallery-json-footer">
              <button type="button" className="gallery-detail-btn gallery-detail-btn-secondary" onClick={() => setShowJsonModal(false)}>Close</button>
            </div>
          }
        >
          <pre className="gallery-json-pre">{modalContent}</pre>
        </AppModalFrame>
      )}
    </div>
  );
}
