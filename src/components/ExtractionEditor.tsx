import { useState } from 'react';
import type { Extraction, ExtractionSource } from '../types';
import { suggestedVariableNameFromJsonPath } from '../utils/jsonPathTreeUtils';
import ExtractionPathPickerModal, { type ExtractionFetchSampleProps } from './ExtractionPathPickerModal';

interface Props {
  extractions: Extraction[];
  onChange: (extractions: Extraction[]) => void;
  /** Optional sample JSON to seed the path picker (e.g. last response body). */
  sampleResponseBody?: string;
  /** Optional: Fetch Response + host row inside the picker (Harness test editor). */
  fetchSample?: ExtractionFetchSampleProps;
}

const SOURCES: { value: ExtractionSource; label: string; hint: string }[] = [
  { value: 'body', label: 'Body (JSONPath)', hint: '$.data.id' },
  { value: 'header', label: 'Header', hint: 'Location' },
  { value: 'status', label: 'Status Code', hint: '(auto)' },
];

export default function ExtractionEditor({ extractions, onChange, sampleResponseBody, fetchSample }: Props) {
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);

  const update = (idx: number, patch: Partial<Extraction>) => {
    const next = extractions.map((e, i) => i === idx ? { ...e, ...patch } : e);
    onChange(next);
  };
  const remove = (idx: number) => onChange(extractions.filter((_, i) => i !== idx));
  const add = () => onChange([...extractions, { name: '', source: 'body', expression: '', fallback: '' }]);

  return (
    <div className="extraction-editor">
      <p className="extraction-hint">
        Extract values from responses into <code>{'{{variables}}'}</code> for use in subsequent workflow steps.
      </p>

      {extractions.length === 0 && (
        <p className="extraction-empty">No extractions configured. Add one to capture response values.</p>
      )}

      {extractions.map((ext, i) => {
        const sourceInfo = SOURCES.find(s => s.value === ext.source) ?? SOURCES[0];
        return (
          <div key={i} className="extraction-row">
            <div className="extraction-row-header">
              <span className="extraction-row-num">#{i + 1}</span>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(i)}>×</button>
            </div>
            <div className="extraction-fields">
              <div className="extraction-field">
                <label>Variable Name</label>
                <div className="extraction-var-input">
                  <span className="extraction-brace">{'{{'}</span>
                  <input
                    value={ext.name}
                    onChange={(e) => update(i, { name: e.target.value.replace(/[{}]/g, '') })}
                    placeholder="orderId"
                  />
                  <span className="extraction-brace">{'}}'}</span>
                </div>
              </div>
              <div className="extraction-field">
                <label>Source</label>
                <select value={ext.source} onChange={(e) => update(i, { source: e.target.value as ExtractionSource })}>
                  {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="extraction-field">
                <label>Expression</label>
                <div className="extraction-expression-row">
                  <input
                    value={ext.expression}
                    onChange={(e) => update(i, { expression: e.target.value })}
                    placeholder={sourceInfo.hint}
                    disabled={ext.source === 'status'}
                  />
                  {ext.source === 'body' && (
                    <button
                      type="button"
                      className="btn btn-sm extraction-path-btn"
                      onClick={() => setPickerIdx(i)}
                      title="Browse JSON and pick a path"
                    >
                      Pick path…
                    </button>
                  )}
                </div>
              </div>
              <div className="extraction-field">
                <label>Fallback</label>
                <input
                  value={ext.fallback ?? ''}
                  onChange={(e) => update(i, { fallback: e.target.value || undefined })}
                  placeholder="(optional default)"
                />
              </div>
            </div>
          </div>
        );
      })}

      <button type="button" className="btn btn-sm" onClick={add} style={{ marginTop: 8 }}>
        + Add Extraction
      </button>

      {pickerIdx !== null && extractions[pickerIdx]?.source === 'body' && (
        <ExtractionPathPickerModal
          initialExpression={extractions[pickerIdx].expression}
          initialSampleJson={sampleResponseBody?.trim() ? sampleResponseBody : undefined}
          fetchSample={fetchSample}
          onApply={(expression) => {
            const row = extractions[pickerIdx];
            const nameEmpty = !row?.name?.trim();
            const suggested = suggestedVariableNameFromJsonPath(expression);
            update(pickerIdx, {
              expression,
              ...(nameEmpty && suggested ? { name: suggested } : {}),
            });
            setPickerIdx(null);
          }}
          onClose={() => setPickerIdx(null)}
        />
      )}
    </div>
  );
}
