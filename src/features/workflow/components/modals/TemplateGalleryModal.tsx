import { useState, useEffect, useCallback } from 'react';
import { sampleWorkflowCatalog, type SampleWorkflowEntry, type SampleCategory } from '../../../../data/sampleWorkflows';

const CATEGORIES: { key: SampleCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All Templates' },
  { key: 'basics', label: 'Basics' },
  { key: 'triggers', label: 'Triggers' },
  { key: 'logic', label: 'Logic' },
  { key: 'advanced', label: 'Advanced' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (entry: SampleWorkflowEntry) => void;
}

export default function TemplateGalleryModal({ open, onClose, onSelect }: Props) {
  const [category, setCategory] = useState<SampleCategory | 'all'>('all');

  const filtered = category === 'all'
    ? sampleWorkflowCatalog
    : sampleWorkflowCatalog.filter(e => e.category === category);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="tg-overlay" onClick={onClose}>
      <div className="tg-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Template Gallery">
        <div className="tg-header">
          <h2 className="tg-title">Template Gallery</h2>
          <button className="tg-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="tg-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`tg-tab ${category === cat.key ? 'active' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
              {cat.key !== 'all' && (
                <span className="tg-tab-count">
                  {sampleWorkflowCatalog.filter(e => e.category === cat.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="tg-grid">
          {filtered.map(entry => (
            <button
              key={entry.id}
              className="tg-card"
              onClick={() => onSelect(entry)}
            >
              <div className="tg-card-icon">{entry.icon}</div>
              <div className="tg-card-body">
                <div className="tg-card-name">{entry.name}</div>
                <div className="tg-card-desc">{entry.description}</div>
              </div>
              <div className="tg-card-meta">
                <span className="tg-card-nodes">{entry.nodeCount} nodes</span>
                <span className="tg-card-category">{entry.category}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
