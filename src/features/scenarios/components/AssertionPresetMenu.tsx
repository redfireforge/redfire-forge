import { useState, useRef, useEffect } from 'react';
import { assertionPresetCatalog, ASSERTION_PRESET_CATEGORIES } from '../../../data/galleries/assertion-presets';
import type { AssertionPresetEntry } from '../../../data/galleries/assertion-presets';
import type { Assertion } from '@shared/types';

interface Props {
  onImport: (assertions: Assertion[]) => void;
}

export default function AssertionPresetMenu({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>('all');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = category === 'all'
    ? assertionPresetCatalog
    : assertionPresetCatalog.filter(p => p.category === category);

  const handleSelect = (entry: AssertionPresetEntry) => {
    onImport(entry.factory());
    setOpen(false);
  };

  return (
    <div className="assertion-preset-wrap" ref={menuRef}>
      <button
        type="button"
        className="btn btn-sm btn-outline"
        onClick={() => setOpen(!open)}
      >
        📋 Presets
      </button>
      {open && (
        <div className="assertion-preset-menu">
          <div className="apm-header">
            <span className="apm-title">Assertion Presets</span>
            <span className="apm-hint">Import a ready-made assertion set</span>
          </div>
          <div className="apm-tabs">
            {ASSERTION_PRESET_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                type="button"
                className={`apm-tab${category === cat.key ? ' active' : ''}`}
                onClick={() => setCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="apm-list">
            {filtered.map(entry => (
              <button
                key={entry.id}
                type="button"
                className="apm-card"
                onClick={() => handleSelect(entry)}
              >
                <span className="apm-card-icon">{entry.icon}</span>
                <div className="apm-card-body">
                  <span className="apm-card-name">{entry.name}</span>
                  <span className="apm-card-desc">{entry.description}</span>
                  <div className="apm-card-meta">
                    <span className={`apm-difficulty apm-difficulty-${entry.difficulty}`}>{entry.difficulty}</span>
                    <span className="apm-count">{entry.assertionCount} assertions</span>
                    <span className="apm-types">{entry.assertionTypes.join(', ')}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
