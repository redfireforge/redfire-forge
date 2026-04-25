import { useState, useCallback } from 'react';
import type { Extraction, ExtractionSource } from '../types';
import type { WorkflowVariableHint } from '../utils/workflowVariableHints';
import { suggestedVariableNameFromJsonPath } from '../utils/jsonPathTreeUtils';
import ExtractionPathPickerModal, { type ExtractionFetchSampleProps } from './ExtractionPathPickerModal';
import ExtractionMapperModal from './ExtractionMapperModal';
import ExpressionInput from './workflow/ExpressionInput';

interface Props {
  extractions: Extraction[];
  onChange: (extractions: Extraction[]) => void;
  /** Optional sample JSON to seed the path picker (e.g. last response body). */
  sampleResponseBody?: string;
  /** Optional: Fetch Response + host row inside the picker (Harness test editor). */
  fetchSample?: ExtractionFetchSampleProps;
  /** Variable hints for autocomplete in expression/fallback fields. */
  variableHints?: WorkflowVariableHint[];
}

const SOURCES: { value: ExtractionSource; label: string; hint: string }[] = [
  { value: 'body', label: 'Body', hint: '$.data.id' },
  { value: 'header', label: 'Header', hint: 'Location' },
  { value: 'status', label: 'Status', hint: '(auto)' },
];

export default function ExtractionEditor({ extractions, onChange, sampleResponseBody, fetchSample, variableHints = [] }: Props) {
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [mapperOpen, setMapperOpen] = useState(false);

  const update = (idx: number, patch: Partial<Extraction>) => {
    const next = extractions.map((e, i) => i === idx ? { ...e, ...patch } : e);
    onChange(next);
  };
  const remove = (idx: number) => onChange(extractions.filter((_, i) => i !== idx));
  const add = () => onChange([...extractions, { name: '', source: 'body', expression: '', fallback: '' }]);

  const handleDragStart = useCallback((idx: number) => { setDragIdx(idx); }, []);
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);
  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx !== null && dragIdx !== targetIdx) {
      const next = [...extractions];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      onChange(next);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, extractions, onChange]);
  const handleDragEnd = useCallback(() => { setDragIdx(null); setDragOverIdx(null); }, []);

  return (
    <div className="extraction-editor">
      <p className="extraction-hint">
        Extract response values into <code>{'{{variables}}'}</code> for subsequent steps.
      </p>

      {/* ── Fetch Response → opens Extraction Mapper Modal ── */}
      {fetchSample && (
        <div className="ext-fetch-section">
          <div className="ext-fetch-bar">
            <button
              type="button"
              className="btn btn-sm btn-accent ext-fetch-btn"
              onClick={() => setMapperOpen(true)}
              disabled={fetchSample.fetching}
            >
              {fetchSample.fetching ? 'Fetching…' : '⚡ Fetch & Map'}
            </button>
            {fetchSample.host && !fetchSample.host.enabled && fetchSample.host.resolvedBaseUrl && (
              <span className="ext-resolved-url">
                Target: <code>{fetchSample.host.resolvedBaseUrl}</code>
              </span>
            )}
          </div>
          {fetchSample.error && (
            <div className="ext-fetch-error">{fetchSample.error}</div>
          )}
        </div>
      )}

      {extractions.length === 0 && (
        <p className="extraction-empty">No extractions configured. Add one to capture response values.</p>
      )}

      {extractions.length > 0 && (
        <div className="ext-table" role="table">
          <div className="ext-thead" role="row">
            <span className="ext-th ext-th-grip" />
            <span className="ext-th ext-th-var">Variable</span>
            <span className="ext-th ext-th-source">Source</span>
            <span className="ext-th ext-th-expr">Expression</span>
            <span className="ext-th ext-th-fb">Fallback</span>
            <span className="ext-th ext-th-del" />
          </div>

          {extractions.map((ext, i) => {
            const sourceInfo = SOURCES.find(s => s.value === ext.source) ?? SOURCES[0];
            const isDragging = dragIdx === i;
            const isOver = dragOverIdx === i && dragIdx !== i;
            return (
              <div
                key={i}
                className={`ext-row${isDragging ? ' ext-row-dragging' : ''}${isOver ? ' ext-row-dragover' : ''}`}
                role="row"
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
              >
                <span className="ext-cell ext-cell-grip" title="Drag to reorder">⠿</span>

                <span className="ext-cell ext-cell-var">
                  <input
                    value={ext.name}
                    onChange={(e) => update(i, { name: e.target.value.replace(/[{}]/g, '') })}
                    placeholder="variableName"
                    className="ext-input"
                    aria-label="Variable name"
                  />
                </span>

                <span className="ext-cell ext-cell-source">
                  <select
                    value={ext.source}
                    onChange={(e) => update(i, { source: e.target.value as ExtractionSource })}
                    className="ext-select"
                    aria-label="Source"
                  >
                    {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </span>

                <span className="ext-cell ext-cell-expr">
                  <ExpressionInput
                    value={ext.expression}
                    onChange={(val) => update(i, { expression: val })}
                    placeholder={sourceInfo.hint}
                    disabled={ext.source === 'status'}
                    className="ext-input"
                    aria-label="Expression"
                    variableHints={variableHints}
                  />
                  {ext.source === 'body' && (
                    <button
                      type="button"
                      className="ext-pick-btn"
                      onClick={() => setPickerIdx(i)}
                      title="Browse JSON and pick a path"
                    >
                      ⋯
                    </button>
                  )}
                </span>

                <span className="ext-cell ext-cell-fb">
                  <ExpressionInput
                    value={ext.fallback ?? ''}
                    onChange={(val) => update(i, { fallback: val || undefined })}
                    placeholder="default"
                    className="ext-input"
                    aria-label="Fallback"
                    variableHints={variableHints}
                  />
                </span>

                <span className="ext-cell ext-cell-del">
                  <button
                    type="button"
                    className="ext-del-btn"
                    onClick={() => remove(i)}
                    title="Remove extraction"
                    aria-label={`Remove extraction ${i + 1}`}
                  >
                    ×
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className="btn btn-sm ext-add-btn" onClick={add}>
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

      {mapperOpen && fetchSample && (
        <ExtractionMapperModal
          existingExtractions={extractions}
          sampleResponseBody={sampleResponseBody}
          fetchSample={fetchSample}
          onApply={(mapped) => {
            onChange(mapped);
            setMapperOpen(false);
          }}
          onClose={() => setMapperOpen(false)}
        />
      )}
    </div>
  );
}
