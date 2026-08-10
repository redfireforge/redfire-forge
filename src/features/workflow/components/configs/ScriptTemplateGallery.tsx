import { useState } from 'react';
import { scriptTemplates, SCRIPT_TEMPLATE_CATEGORIES, type ScriptTemplate, type ScriptTemplateCategory } from '../../engine/scriptTemplates';

interface Props {
  onSelect: (template: ScriptTemplate) => void;
  onClose: () => void;
}

export default function ScriptTemplateGallery({ onSelect, onClose }: Props) {
  const [category, setCategory] = useState<ScriptTemplateCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = scriptTemplates.filter(t => {
    if (category !== 'all' && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="wf-script-template-gallery">
      <div className="wf-script-template-header">
        <h4>Code Templates</h4>
      </div>

      <div className="wf-script-template-controls">
        <input
          type="text"
          className="wf-script-template-search"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="wf-script-template-tabs">
          {SCRIPT_TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`wf-script-template-tab ${category === cat.key ? 'active' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wf-script-template-list">
        {filtered.length === 0 && (
          <div className="wf-script-template-empty">No templates match your search.</div>
        )}
        {filtered.map(t => (
          <button
            key={t.id}
            className="wf-script-template-card"
            onClick={() => onSelect(t)}
          >
            <div className="wf-script-template-name">{t.name}</div>
            <div className="wf-script-template-desc">{t.description}</div>
            <div className="wf-script-template-meta">
              <span className="wf-script-template-category">{t.category}</span>
              <span className="wf-script-template-vars">
                {t.inputVariables.length} in → {t.outputVariables.length} out
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="wf-script-template-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
