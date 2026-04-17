import { useState, useMemo } from 'react';
import type { Scenario, BodyType, KeyValue } from '../types';

const BODY_TYPE_GROUPS: { label: string; types: { value: BodyType; label: string }[] }[] = [
  {
    label: 'Structured',
    types: [
      { value: 'form-data', label: 'Form Data' },
      { value: 'form-urlencoded', label: 'Form URL Encoded' },
    ],
  },
  {
    label: 'Text',
    types: [
      { value: 'json', label: 'JSON' },
      { value: 'xml', label: 'XML' },
      { value: 'text', label: 'Plain Text' },
    ],
  },
  {
    label: 'Other',
    types: [
      { value: 'file', label: 'File' },
      { value: 'none', label: 'No Body' },
    ],
  },
];

const PLACEHOLDER_MAP: Record<string, string> = {
  json: '{\n  "key": "value"\n}',
  xml: '<root>\n  <element>value</element>\n</root>',
  text: 'Plain text body...',
  file: 'Paste file content or base64...',
};

interface BodyEditorProps {
  draft: Scenario;
  onDraftChange: (d: Scenario) => void;
}

export function BodyEditor({ draft, onDraftChange }: BodyEditorProps) {
  const bodyType: BodyType = draft.bodyType ?? (draft.body ? 'json' : 'none');
  const isFormType = bodyType === 'form-urlencoded' || bodyType === 'form-data';
  const isTextType = bodyType === 'json' || bodyType === 'xml' || bodyType === 'text' || bodyType === 'file';
  const [showDesc, setShowDesc] = useState(false);

  const handleTypeChange = (newType: BodyType) => {
    const update: Partial<Scenario> = { bodyType: newType };
    if ((newType === 'form-urlencoded' || newType === 'form-data') && (!draft.bodyForm || draft.bodyForm.length === 0)) {
      update.bodyForm = [{ key: '', value: '' }];
    }
    onDraftChange({ ...draft, ...update });
  };

  const bodyForm = draft.bodyForm ?? [{ key: '', value: '' }];
  const formCount = useMemo(() => bodyForm.filter(kv => kv.key.trim()).length, [bodyForm]);

  const updateFormRow = (idx: number, field: 'key' | 'value', val: string) => {
    const rows = [...bodyForm];
    rows[idx] = { ...rows[idx], [field]: val };
    onDraftChange({ ...draft, bodyForm: rows });
  };

  const addFormRow = () => {
    onDraftChange({ ...draft, bodyForm: [...bodyForm, { key: '', value: '' }] });
  };

  const removeFormRow = (idx: number) => {
    const rows = bodyForm.filter((_, i) => i !== idx);
    onDraftChange({ ...draft, bodyForm: rows.length > 0 ? rows : [{ key: '', value: '' }] });
  };

  const deleteAllForm = () => {
    onDraftChange({ ...draft, bodyForm: [{ key: '', value: '' }] });
  };

  return (
    <div className="body-editor-panel">
      <div className="body-type-selector">
        {BODY_TYPE_GROUPS.map((group) => (
          <div key={group.label} className="body-type-group">
            <span className="body-type-group-label">{group.label}</span>
            {group.types.map((t) => (
              <label key={t.value} className="body-type-radio">
                <input
                  type="radio"
                  name="bodyType"
                  checked={bodyType === t.value}
                  onChange={() => handleTypeChange(t.value)}
                />
                {t.label}
              </label>
            ))}
          </div>
        ))}
      </div>

      {isFormType && (
        <div className="params-editor body-form-section">
          <div className="params-toolbar">
            <div className="params-toolbar-left">
              <span className="params-section-label">
                {bodyType === 'form-data' ? 'Multipart' : 'Form URL Encoded'}
              </span>
              {formCount > 0 && <span className="tab-badge">{formCount}</span>}
            </div>
          </div>

          <div className="params-actions">
            <button type="button" className="btn btn-sm" onClick={addFormRow}>+ Add</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={deleteAllForm} title="Delete all">
              Delete all
            </button>
            <button
              type="button"
              className={`btn btn-sm btn-ghost ${showDesc ? 'active' : ''}`}
              onClick={() => setShowDesc(!showDesc)}
              title="Toggle descriptions"
            >
              Description
            </button>
          </div>

          {bodyForm.map((kv: KeyValue, i: number) => (
            <div key={i} className={`params-row ${showDesc ? 'with-desc' : ''}`}>
              <span className="params-drag-handle">⠿</span>
              <input
                className="params-input"
                value={kv.key}
                onChange={(e) => updateFormRow(i, 'key', e.target.value)}
                placeholder="name"
              />
              <input
                className="params-input"
                value={kv.value}
                onChange={(e) => updateFormRow(i, 'value', e.target.value)}
                placeholder="value"
              />
              {showDesc && (
                <input
                  className="params-input params-desc-input"
                  value=""
                  readOnly
                  placeholder="description"
                />
              )}
              <span style={{ width: 15 }} />
              <button
                type="button"
                className="params-delete"
                onClick={() => removeFormRow(i)}
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {isTextType && (
        <textarea
          className="body-editor"
          rows={14}
          value={draft.body}
          onChange={(e) => onDraftChange({ ...draft, body: e.target.value })}
          placeholder={PLACEHOLDER_MAP[bodyType] || ''}
        />
      )}

      {bodyType === 'none' && (
        <div className="body-none-message">
          This request does not have a body.
        </div>
      )}
    </div>
  );
}
