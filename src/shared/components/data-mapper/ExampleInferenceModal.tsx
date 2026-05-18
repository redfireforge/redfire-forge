/**
 * Example Inference Modal (Phase 10C.4).
 *
 * "Learn from Examples" flow: user pastes 1–5 input/output JSON pairs,
 * the engine infers mapping rules, and results are shown as pending
 * auto-map candidates for accept/reject.
 */

import { useState, useCallback, useMemo } from 'react';
import { inferMappingsFromExamples, parseExampleJson } from './utils/exampleInference';
import type { ExamplePair, InferredMapping } from './utils/exampleInference';

interface ExampleInferenceModalProps {
  onClose: () => void;
  onApply: (mappings: InferredMapping[]) => void;
}

interface ExampleRow {
  inputJson: string;
  outputJson: string;
  inputError?: string;
  outputError?: string;
}

const EMPTY_ROW: ExampleRow = { inputJson: '', outputJson: '' };

const MAX_EXAMPLES = 5;

export default function ExampleInferenceModal({ onClose, onApply }: ExampleInferenceModalProps) {
  const [rows, setRows] = useState<ExampleRow[]>([{ ...EMPTY_ROW }]);
  const [results, setResults] = useState<InferredMapping[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const updateRow = useCallback((index: number, field: 'inputJson' | 'outputJson', value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value, [`${field === 'inputJson' ? 'input' : 'output'}Error`]: undefined };
      return next;
    });
    setResults(null);
  }, []);

  const addRow = useCallback(() => {
    if (rows.length >= MAX_EXAMPLES) return;
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }, [rows.length]);

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
    setResults(null);
  }, []);

  const handleAnalyze = useCallback(() => {
    const pairs: ExamplePair[] = [];
    let hasError = false;
    const updatedRows = rows.map((row) => {
      const inputResult = parseExampleJson(row.inputJson);
      const outputResult = parseExampleJson(row.outputJson);
      const newRow = { ...row };
      if (inputResult.error) { newRow.inputError = inputResult.error; hasError = true; }
      if (outputResult.error) { newRow.outputError = outputResult.error; hasError = true; }
      if (!inputResult.error && !outputResult.error) {
        pairs.push({ input: inputResult.data, output: outputResult.data });
      }
      return newRow;
    });
    setRows(updatedRows);
    if (hasError || pairs.length === 0) return;
    const inferred = inferMappingsFromExamples(pairs);
    setResults(inferred);
    setSelectedIds(new Set(inferred.map((_, i) => i)));
  }, [rows]);

  const handleApply = useCallback(() => {
    if (!results) return;
    const selected = results.filter((_, i) => selectedIds.has(i));
    if (selected.length === 0) return;
    onApply(selected);
    onClose();
  }, [results, selectedIds, onApply, onClose]);

  const toggleSelection = useCallback((index: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const validRowCount = useMemo(
    () => rows.filter((r) => r.inputJson.trim() && r.outputJson.trim()).length,
    [rows],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <div className="dm-example-overlay" onKeyDown={handleKeyDown} role="dialog" aria-label="Learn from Examples">
      <div className="dm-example-modal">
        <div className="dm-example-header">
          <div className="dm-example-header-text">
            <h3>Learn from Examples</h3>
            <span className="dm-example-subtitle">
              Provide input → output JSON pairs to infer mapping rules automatically.
            </span>
          </div>
        </div>

        <div className="dm-example-body">
          <div className="dm-example-pairs">
            {rows.map((row, i) => (
              <div key={i} className="dm-example-card">
                <div className="dm-example-card-header">
                  <span className="dm-example-card-num">Pair {i + 1}</span>
                  {rows.length > 1 && (
                    <button
                      className="dm-example-card-remove"
                      onClick={() => removeRow(i)}
                      title="Remove pair"
                      aria-label={`Remove pair ${i + 1}`}
                    >×</button>
                  )}
                </div>
                <div className="dm-example-card-body">
                  <div className="dm-example-field">
                    <label className="dm-example-label">Input</label>
                    <textarea
                      className={`dm-example-textarea ${row.inputError ? 'dm-example-textarea--error' : ''}`}
                      value={row.inputJson}
                      onChange={(e) => updateRow(i, 'inputJson', e.target.value)}
                      placeholder='{ "name": "Alice", "age": 30 }'
                      spellCheck={false}
                      rows={3}
                    />
                    {row.inputError && <span className="dm-example-error">{row.inputError}</span>}
                  </div>
                  <div className="dm-example-arrow-col">
                    <span className="dm-example-arrow">→</span>
                  </div>
                  <div className="dm-example-field">
                    <label className="dm-example-label">Output</label>
                    <textarea
                      className={`dm-example-textarea ${row.outputError ? 'dm-example-textarea--error' : ''}`}
                      value={row.outputJson}
                      onChange={(e) => updateRow(i, 'outputJson', e.target.value)}
                      placeholder='{ "fullName": "Alice", "years": 30 }'
                      spellCheck={false}
                      rows={3}
                    />
                    {row.outputError && <span className="dm-example-error">{row.outputError}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {rows.length < MAX_EXAMPLES && (
            <button className="dm-example-add" onClick={addRow}>
              + Add pair ({rows.length}/{MAX_EXAMPLES})
            </button>
          )}
        </div>

        {results && (
          <div className="dm-example-results">
            <div className="dm-example-results-header">
              <span className="dm-example-results-title">
                {results.length} mapping{results.length !== 1 ? 's' : ''} inferred
              </span>
              {results.length > 0 && (
                <span className="dm-example-results-selected">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            {results.length === 0 && (
              <p className="dm-example-empty">No mappings could be inferred. Try more examples or different data.</p>
            )}
            {results.length > 0 && (
              <table className="dm-example-result-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Source</th>
                    <th></th>
                    <th>Target</th>
                    <th style={{ width: 48 }}>Score</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr
                      key={i}
                      className={`dm-example-result-row ${selectedIds.has(i) ? 'dm-example-result-row--selected' : ''}`}
                      onClick={() => toggleSelection(i)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(i)}
                          onChange={() => toggleSelection(i)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td><code className="dm-example-src-code">{r.sourcePath}</code></td>
                      <td className="dm-example-result-arrow">→</td>
                      <td><code className="dm-example-tgt-code">{r.targetPath}</code></td>
                      <td>
                        <span className={`dm-example-score dm-example-score--${r.confidence >= 80 ? 'high' : r.confidence >= 60 ? 'mid' : 'low'}`}>
                          {r.confidence}%
                        </span>
                      </td>
                      <td className="dm-example-reason">
                        {r.reason}
                        {r.expression && <code className="dm-example-expr">{r.expression}</code>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="dm-example-footer">
          <button className="dm-example-btn dm-example-btn--secondary" onClick={onClose}>Cancel</button>
          {(!results || results.length === 0) ? (
            <button
              className="dm-example-btn dm-example-btn--primary"
              onClick={handleAnalyze}
              disabled={validRowCount === 0}
            >
              Analyze{validRowCount > 0 ? ` (${validRowCount})` : ''}
            </button>
          ) : (
            <button
              className="dm-example-btn dm-example-btn--primary"
              onClick={handleApply}
              disabled={selectedIds.size === 0}
            >
              Apply {selectedIds.size} mapping{selectedIds.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
