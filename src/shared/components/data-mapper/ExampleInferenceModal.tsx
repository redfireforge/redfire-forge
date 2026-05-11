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
          <h3>Learn from Examples</h3>
          <span className="dm-example-subtitle">
            Paste input/output JSON pairs. The engine will infer mapping rules.
          </span>
          <button className="dm-btn-icon" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="dm-example-body">
          {rows.map((row, i) => (
            <div key={i} className="dm-example-row">
              <div className="dm-example-pair">
                <div className="dm-example-field">
                  <label className="dm-example-label">Input {i + 1}</label>
                  <textarea
                    className={`dm-example-textarea ${row.inputError ? 'dm-example-textarea--error' : ''}`}
                    value={row.inputJson}
                    onChange={(e) => updateRow(i, 'inputJson', e.target.value)}
                    placeholder='{ "name": "Alice", "age": 30 }'
                    spellCheck={false}
                  />
                  {row.inputError && <span className="dm-example-error">{row.inputError}</span>}
                </div>
                <span className="dm-example-arrow">→</span>
                <div className="dm-example-field">
                  <label className="dm-example-label">Output {i + 1}</label>
                  <textarea
                    className={`dm-example-textarea ${row.outputError ? 'dm-example-textarea--error' : ''}`}
                    value={row.outputJson}
                    onChange={(e) => updateRow(i, 'outputJson', e.target.value)}
                    placeholder='{ "fullName": "Alice", "years": 30 }'
                    spellCheck={false}
                  />
                  {row.outputError && <span className="dm-example-error">{row.outputError}</span>}
                </div>
              </div>
              {rows.length > 1 && (
                <button
                  className="dm-btn-icon dm-example-remove"
                  onClick={() => removeRow(i)}
                  title="Remove example"
                >×</button>
              )}
            </div>
          ))}
          {rows.length < MAX_EXAMPLES && (
            <button className="dm-example-add" onClick={addRow}>
              + Add example pair
            </button>
          )}
        </div>

        {results && (
          <div className="dm-example-results">
            <h4>{results.length} mapping{results.length !== 1 ? 's' : ''} inferred</h4>
            {results.length === 0 && (
              <p className="dm-example-empty">No mappings could be inferred. Try providing more examples or different data.</p>
            )}
            {results.length > 0 && (
              <div className="dm-example-result-list">
                {results.map((r, i) => (
                  <label key={i} className="dm-example-result-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(i)}
                      onChange={() => toggleSelection(i)}
                    />
                    <span className="dm-example-result-paths">
                      <span className="dm-example-source">{r.sourcePath}</span>
                      <span className="dm-example-result-arrow">→</span>
                      <span className="dm-example-target">{r.targetPath}</span>
                    </span>
                    <span className={`dm-example-confidence dm-example-confidence--${r.confidence >= 80 ? 'high' : r.confidence >= 60 ? 'mid' : 'low'}`}>
                      {r.confidence}%
                    </span>
                    <span className="dm-example-reason">{r.reason}</span>
                    {r.expression && (
                      <code className="dm-example-expr">{r.expression}</code>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="dm-example-footer">
          <button className="dm-toolbar-btn" onClick={onClose}>Cancel</button>
          {(!results || results.length === 0) && (
            <button
              className="dm-toolbar-btn dm-toolbar-btn--primary"
              onClick={handleAnalyze}
              disabled={validRowCount === 0}
            >
              {results ? 'Re-analyze' : 'Analyze'} ({validRowCount} example{validRowCount !== 1 ? 's' : ''})
            </button>
          )}
          {results && results.length > 0 && (
            <button
              className="dm-toolbar-btn dm-toolbar-btn--primary"
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
