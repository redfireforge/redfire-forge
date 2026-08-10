import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Scenario, BodyType, KeyValue } from '../../../shared/types';
import { CodeTextarea } from './CodeTextarea';

const BODY_TYPE_GROUPS: { label: string; icon: string; types: { value: BodyType; label: string }[] }[] = [
  {
    label: 'Structured',
    icon: '☰',
    types: [
      { value: 'form-data', label: 'Form Data' },
      { value: 'form-urlencoded', label: 'Form URL Encoded' },
    ],
  },
  {
    label: 'Text',
    icon: '{ }',
    types: [
      { value: 'json', label: 'JSON' },
      { value: 'xml', label: 'XML' },
      { value: 'text', label: 'Plain Text' },
    ],
  },
  {
    label: 'Other',
    icon: '···',
    types: [
      { value: 'file', label: 'File' },
      { value: 'none', label: 'No Body' },
    ],
  },
];

const TYPE_LABELS: Record<BodyType, string> = {
  'form-data': 'Multipart',
  'form-urlencoded': 'Form URL Encoded',
  json: 'JSON',
  xml: 'XML',
  text: 'Plain Text',
  file: 'File',
  none: 'No Body',
};

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const computePosition = useCallback((): React.CSSProperties => {
    const trigger = triggerRef.current;
    if (!trigger) return {};
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const spaceBelow = viewportHeight - rect.bottom;
    const ESTIMATED_DROPDOWN_HEIGHT = 280;
    if (spaceBelow < ESTIMATED_DROPDOWN_HEIGHT && rect.top > spaceBelow) {
      return { top: 'auto', bottom: '100%', marginBottom: 4 };
    }
    return { top: 'calc(100% + 4px)' };
  }, []);

  const recomputeDropdownPosition = useCallback(() => {
    setDropdownStyle(computePosition());
  }, [computePosition]);

  useEffect(() => {
    if (!dropdownOpen) return;
    recomputeDropdownPosition();
    const onClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('resize', recomputeDropdownPosition);
    window.addEventListener('scroll', recomputeDropdownPosition, true);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('resize', recomputeDropdownPosition);
      window.removeEventListener('scroll', recomputeDropdownPosition, true);
    };
  }, [dropdownOpen, recomputeDropdownPosition]);

  const handleTypeChange = useCallback((newType: BodyType) => {
    const update: Partial<Scenario> = { bodyType: newType };
    if ((newType === 'form-urlencoded' || newType === 'form-data') && (!draft.bodyForm || draft.bodyForm.length === 0)) {
      update.bodyForm = [{ key: '', value: '' }];
    }
    onDraftChange({ ...draft, ...update });
    setDropdownOpen(false);
  }, [draft, onDraftChange]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="body-editor-panel" data-testid="req-body-editor">
      {/* Dropdown trigger + body content header */}
      <div className="body-type-dropdown-wrapper" ref={dropdownRef}>
        <button
          ref={triggerRef}
          type="button"
          className="body-type-trigger"
          data-testid="req-body-type-trigger"
          onClick={() => {
            setDropdownOpen(o => {
              if (!o) setDropdownStyle(computePosition());
              return !o;
            });
          }}
        >
          {TYPE_LABELS[bodyType]}
          {isFormType && formCount > 0 && <span className="tab-badge">{formCount}</span>}
          <span className="body-type-trigger-arrow">{dropdownOpen ? '▲' : '▼'}</span>
        </button>

        {dropdownOpen && (
          <div className="body-type-dropdown" data-testid="req-body-type-dropdown" style={dropdownStyle}>
            {BODY_TYPE_GROUPS.map((group) => (
              <div key={group.label} className="body-type-dropdown-group">
                <span className="body-type-dropdown-label">
                  <span className="body-type-dropdown-icon">{group.icon}</span>
                  {group.label}
                </span>
                {group.types.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`body-type-dropdown-item ${bodyType === t.value ? 'active' : ''}`}
                    onClick={() => handleTypeChange(t.value)}
                  >
                    {t.label}
                    {bodyType === t.value && <span className="body-type-check">✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body content area */}
      {isFormType && (
        <div className="params-editor body-form-section">
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
        <CodeTextarea
          value={draft.body}
          onChange={(body) => onDraftChange({ ...draft, body })}
          placeholder={PLACEHOLDER_MAP[bodyType] || ''}
          bodyType={bodyType}
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
