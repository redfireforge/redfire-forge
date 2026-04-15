import { useState, useMemo } from 'react';
import type { Scenario } from '../types';
import {
  analyzeUrlPath,
  buildColumnDefs,
  generateExcelTemplate,
  downloadExcel,
} from '../utils/csvTemplate';
import type { ExportOptions, ColumnDef } from '../utils/csvTemplate';

interface Props {
  test: Scenario;
  onClose: () => void;
}

type Step = 'variables' | 'columns' | 'review';

export default function CsvTemplateExportModal({ test, onClose }: Props) {
  const analysis = useMemo(() => analyzeUrlPath(test.url), [test.url]);

  const [step, setStep] = useState<Step>('variables');

  // --- Step 1: path variable selections ---
  const [selections, setSelections] = useState<Record<number, { checked: boolean; name: string }>>(() => {
    const init: Record<number, { checked: boolean; name: string }> = {};
    for (const seg of analysis.segments) {
      init[seg.index] = {
        checked: seg.suggestedVariable,
        name: seg.suggestedVariable ? seg.variableName : '',
      };
    }
    return init;
  });

  const toggleSegment = (idx: number) => {
    setSelections(prev => ({
      ...prev,
      [idx]: { ...prev[idx], checked: !prev[idx].checked },
    }));
  };

  const setVarName = (idx: number, name: string) => {
    setSelections(prev => ({
      ...prev,
      [idx]: { ...prev[idx], name },
    }));
  };

  const pathVars = Object.entries(selections)
    .filter(([, v]) => v.checked && v.name.trim())
    .map(([k, v]) => ({ segmentIndex: parseInt(k), variableName: v.name.trim() }));

  const pathParts = analysis.segments.map(seg => seg.segment);
  const previewParts = pathParts.map((seg, i) => {
    const sel = selections[i];
    if (sel?.checked && sel.name.trim()) return `{{${sel.name.trim()}}}`;
    return seg;
  });
  const previewUrl = `${analysis.origin}/${previewParts.join('/')}`;

  // --- Step 2: column definitions (built when entering step 2) ---
  const [columnDefs, setColumnDefs] = useState<ColumnDef[]>([]);

  const enterStep2 = () => {
    const exportOpts: ExportOptions = { test, pathVariables: pathVars };
    const defs = buildColumnDefs(exportOpts);
    setColumnDefs(defs);
    setStep('columns');
  };

  const updateColumnName = (idx: number, name: string) => {
    setColumnDefs(prev => prev.map((d, i) => i === idx ? { ...d, customName: name } : d));
  };

  const columnNamesValid = useMemo(() => {
    if (columnDefs.length === 0) return false;
    const names = columnDefs.map(d => d.customName.trim());
    if (names.some(n => !n)) return false;
    if (names.some(n => !/^[a-zA-Z0-9_]+$/.test(n))) return false;
    if (new Set(names).size !== names.length) return false;
    return true;
  }, [columnDefs]);

  const duplicateNames = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of columnDefs) {
      const n = d.customName.trim();
      counts[n] = (counts[n] || 0) + 1;
    }
    return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([n]) => n));
  }, [columnDefs]);

  // --- Step 3: review & export ---
  const { origin, pathname, params: urlParams } = useMemo(() => {
    try {
      const u = new URL(test.url);
      const params: { key: string; value: string }[] = [];
      u.searchParams.forEach((value, key) => params.push({ key, value }));
      return { origin: u.origin, pathname: u.pathname, params };
    } catch {
      return { origin: '', pathname: test.url, params: [] };
    }
  }, [test.url]);

  const handleExport = () => {
    const wb = generateExcelTemplate({ test, pathVariables: pathVars, columnDefs });
    const safeName = test.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'template';
    downloadExcel(wb, `${safeName}_template.xlsx`);
    onClose();
  };

  // --- Render ---
  const stepLabels: { key: Step; label: string; num: number }[] = [
    { key: 'variables', label: 'Path Variables', num: 1 },
    { key: 'columns', label: 'Column Names', num: 2 },
    { key: 'review', label: 'Review & Export', num: 3 },
  ];

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal csv-export-modal">
        {/* Header */}
        <div className="csv-export-header">
          <div>
            <h3>Export Excel Template</h3>
            <span className="csv-export-subtitle">
              <span className={`method-badge method-${test.method.toLowerCase()}`}>{test.method}</span>
              {test.name}
            </span>
          </div>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>

        {/* Step indicator */}
        <div className="excel-steps-bar">
          {stepLabels.map((s, i) => (
            <div key={s.key} className={`excel-step-indicator ${step === s.key ? 'active' : ''} ${stepLabels.findIndex(x => x.key === step) > i ? 'done' : ''}`}>
              <span className="excel-step-num">{s.num}</span>
              <span className="excel-step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step body */}
        <div className="csv-export-body">
          {/* ==================== Step 1: Path Variables ==================== */}
          {step === 'variables' && (
            <div className="excel-step-content">
              <div className="csv-export-left" style={{ flex: 1 }}>
                <div className="csv-panel-title">URL Path Segments</div>
                <div className="csv-panel-desc">Check the segments that change per test row. Name each variable.</div>
                <div className="path-segment-list">
                  {analysis.segments.map(seg => {
                    const sel = selections[seg.index];
                    const isChecked = sel?.checked ?? false;
                    return (
                      <div key={seg.index} className={`path-seg ${isChecked ? 'path-seg-active' : ''}`}>
                        <label className="path-seg-label">
                          <input type="checkbox" checked={isChecked} onChange={() => toggleSegment(seg.index)} />
                          <code>/{seg.segment}</code>
                        </label>
                        <div className="path-seg-spacer" />
                        {isChecked && (
                          <input
                            type="text"
                            className="path-var-input"
                            placeholder="variable name"
                            value={sel?.name ?? ''}
                            onChange={(e) => setVarName(seg.index, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            autoFocus
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="csv-panel-title" style={{ marginTop: 16 }}>URL Pattern</div>
                <code className="url-pattern-box">{previewUrl}</code>
              </div>

              <div className="csv-export-right" style={{ flex: 1 }}>
                <div className="csv-panel-title">Inherited from test (fixed)</div>
                <div className="csv-panel-desc">Stored in Metadata sheet — not repeated per row.</div>
                <div className="csv-fixed-list">
                  <div className="csv-fixed-item">
                    <span className="csv-fixed-key">Method</span>
                    <span className={`method-badge method-${test.method.toLowerCase()}`}>{test.method}</span>
                  </div>
                  <div className="csv-fixed-item">
                    <span className="csv-fixed-key">Headers</span>
                    <span>{test.headers.filter(h => h.key.trim()).map(h => h.key).join(', ') || 'None'}</span>
                  </div>
                  <div className="csv-fixed-item">
                    <span className="csv-fixed-key">Auth</span>
                    <span>{test.auth.type}</span>
                  </div>
                  {test.body && (
                    <div className="csv-fixed-item">
                      <span className="csv-fixed-key">Body</span>
                      <span>Included</span>
                    </div>
                  )}
                  <div className="csv-fixed-item">
                    <span className="csv-fixed-key">Validation</span>
                    <span>{test.validation.mode}{test.validation.unorderedArrays ? ' · unordered arrays' : ''}</span>
                  </div>
                  {(test.validation.excludedPaths ?? []).length > 0 && (
                    <div className="csv-fixed-item">
                      <span className="csv-fixed-key">Excluded</span>
                      <span>{test.validation.excludedPaths!.length} paths</span>
                    </div>
                  )}
                  <div className="csv-fixed-item">
                    <span className="csv-fixed-key">Query Params</span>
                    <span>{urlParams.length > 0 ? urlParams.map(p => p.key).join(', ') : 'None'}</span>
                  </div>
                  <div className="csv-fixed-item">
                    <span className="csv-fixed-key">Validation Rules</span>
                    <span>{(test.validation.expectedFields ?? []).length} fields</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== Step 2: Column Names ==================== */}
          {step === 'columns' && (
            <div className="excel-step-content excel-step-columns">
              <div className="csv-panel-title">Customize Column Headers</div>
              <div className="csv-panel-desc">
                These become column headers in the Data sheet. Edit the "Custom Name" to your preference.
                Names must be unique, alphanumeric with underscores only.
              </div>
              <div className="excel-col-table-wrap">
                <table className="excel-col-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Type</th>
                      <th>Full Path / Mapping</th>
                      <th>Auto Name</th>
                      <th>Custom Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnDefs.map((d, i) => {
                      const isDup = duplicateNames.has(d.customName.trim());
                      const isEmpty = !d.customName.trim();
                      const isBadChars = d.customName.trim() && !/^[a-zA-Z0-9_]+$/.test(d.customName.trim());
                      const hasError = isDup || isEmpty || isBadChars;
                      return (
                        <tr key={i} className={hasError ? 'excel-col-row-error' : ''}>
                          <td className="excel-col-num">{i + 1}</td>
                          <td>
                            <span className={`excel-col-type-badge type-${d.type}`}>{d.type}</span>
                          </td>
                          <td className="excel-col-path">
                            <code>{d.type === 'name' ? 'name' : d.mapping}</code>
                          </td>
                          <td className="excel-col-auto">{d.autoName}</td>
                          <td>
                            <input
                              type="text"
                              className={`excel-col-input ${hasError ? 'input-error' : ''}`}
                              value={d.customName}
                              onChange={(e) => updateColumnName(i, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            />
                            {isDup && <span className="excel-col-err">duplicate</span>}
                            {isEmpty && <span className="excel-col-err">required</span>}
                            {isBadChars && <span className="excel-col-err">invalid chars</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== Step 3: Review & Confirm ==================== */}
          {step === 'review' && (
            <div className="excel-step-content excel-step-review">
              <div className="excel-review-section">
                <div className="csv-panel-title">Data Sheet Preview</div>
                <div className="csv-panel-desc">Column headers and one sample row from the source test.</div>
                <div className="excel-review-table-wrap">
                  <table className="excel-review-table">
                    <thead>
                      <tr>
                        {columnDefs.map((d, i) => (
                          <th key={i}>
                            <span className={`excel-col-type-dot type-${d.type}`} />
                            {d.customName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {columnDefs.map((d, i) => {
                          let val = '';
                          if (d.type === 'name') val = test.name;
                          else if (d.type === 'path') {
                            const pv = pathVars.find(p => p.variableName === d.mapping);
                            val = pv ? pathParts[pv.segmentIndex] || '' : '';
                          } else if (d.type === 'param') {
                            val = urlParams.find(p => p.key === d.mapping)?.value ?? '';
                          } else if (d.type === 'validate') {
                            val = (test.validation.expectedFields ?? []).find(f => f.jsonPath === d.mapping)?.expectedValue ?? '';
                          }
                          return <td key={i} title={val}>{val}</td>;
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="excel-review-section">
                <div className="csv-panel-title">Metadata Sheet</div>
                <div className="csv-panel-desc">Configuration, column mappings, and headers.</div>

                <div className="excel-review-meta-group">
                  <div className="excel-review-meta-title">Column Mappings ({columnDefs.length})</div>
                  <div className="excel-review-table-wrap">
                    <table className="excel-review-table excel-review-table-sm">
                      <thead>
                        <tr><th>Column</th><th>Type</th><th>Mapping</th></tr>
                      </thead>
                      <tbody>
                        {columnDefs.map((d, i) => (
                          <tr key={i}>
                            <td>{d.customName}</td>
                            <td><span className={`excel-col-type-badge type-${d.type}`}>{d.type}</span></td>
                            <td><code>{d.mapping || '—'}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="excel-review-meta-group">
                  <div className="excel-review-meta-title">Config</div>
                  <div className="excel-review-kv-list">
                    <div><strong>Method:</strong> <span className={`method-badge method-${test.method.toLowerCase()}`}>{test.method}</span></div>
                    <div><strong>URL Pattern:</strong> <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{previewUrl}</code></div>
                    <div><strong>Auth:</strong> {test.auth.type}</div>
                    <div><strong>Validation:</strong> {test.validation.mode}{test.validation.unorderedArrays ? ' · unordered arrays' : ''}</div>
                    {test.body && <div><strong>Body:</strong> included</div>}
                  </div>
                </div>

                <div className="excel-review-meta-group">
                  <div className="excel-review-meta-title">Headers ({test.headers.filter(h => h.key.trim()).length})</div>
                  <div className="excel-review-kv-list">
                    {test.headers.filter(h => h.key.trim()).map((h, i) => (
                      <div key={i}><strong>{h.key}:</strong> {h.value}</div>
                    ))}
                    {test.headers.filter(h => h.key.trim()).length === 0 && <div className="text-muted">No headers</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="excel-export-footer">
          {step !== 'variables' && (
            <button className="btn" onClick={() => setStep(step === 'review' ? 'columns' : 'variables')}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step === 'variables' && (
            <button className="btn btn-primary" onClick={enterStep2}>
              Next: Column Names
            </button>
          )}
          {step === 'columns' && (
            <button className="btn btn-primary" onClick={() => setStep('review')} disabled={!columnNamesValid}>
              Next: Review
            </button>
          )}
          {step === 'review' && (
            <button className="btn btn-primary" onClick={handleExport}>
              Confirm &amp; Download .xlsx
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
