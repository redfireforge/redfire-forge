import { useState, useMemo } from 'react';
import type { Scenario } from '../types';
import { analyzeUrlPath, generateCsvTemplate, downloadCsv } from '../utils/csvTemplate';
import type { ExportOptions } from '../utils/csvTemplate';

interface Props {
  test: Scenario;
  onClose: () => void;
}

export default function CsvTemplateExportModal({ test, onClose }: Props) {
  const analysis = useMemo(() => analyzeUrlPath(test.url), [test.url]);

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

  const validationFields = test.validation.expectedFields ?? [];

  const handleExport = () => {
    const opts: ExportOptions = { test, pathVariables: pathVars };
    const csv = generateCsvTemplate(opts);
    const safeName = test.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'template';
    downloadCsv(csv, `${safeName}_template.csv`);
    onClose();
  };

  const pathParts = analysis.segments.map(seg => seg.segment);
  const previewParts = pathParts.map((seg, i) => {
    const sel = selections[i];
    if (sel?.checked && sel.name.trim()) return `{{${sel.name.trim()}}}`;
    return seg;
  });
  const previewUrl = `${analysis.origin}/${previewParts.join('/')}`;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal csv-export-modal">
        {/* Header */}
        <div className="csv-export-header">
          <div>
            <h3>Export CSV Template</h3>
            <span className="csv-export-subtitle">
              <span className={`method-badge method-${test.method.toLowerCase()}`}>{test.method}</span>
              {test.name}
            </span>
          </div>
          <div className="csv-export-header-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleExport}>Download CSV Template</button>
          </div>
        </div>

        {/* Two-panel body */}
        <div className="csv-export-body">
          {/* Left: URL path segments */}
          <div className="csv-export-left">
            <div className="csv-panel-title">URL Path Segments</div>
            <div className="csv-panel-desc">Check the segments that change per test. Name each variable.</div>
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
                    {isChecked ? (
                      <input
                        type="text"
                        className="path-var-input"
                        placeholder="variable name"
                        value={sel?.name ?? ''}
                        onChange={(e) => setVarName(seg.index, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        autoFocus
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* URL pattern */}
            <div className="csv-panel-title" style={{ marginTop: 16 }}>URL Pattern</div>
            <code className="url-pattern-box">{previewUrl}</code>
          </div>

          {/* Right: Summary */}
          <div className="csv-export-right">
            <div className="csv-panel-title">CSV Columns (per row)</div>
            <div className="csv-panel-desc">These become column headers in the CSV file.</div>
            <div className="csv-col-list">
              <div className="csv-col-item col-fixed">name</div>
              {pathVars.map(pv => (
                <div key={pv.segmentIndex} className="csv-col-item col-path">path:{pv.variableName}</div>
              ))}
              {analysis.params.map(p => (
                <div key={p.key} className="csv-col-item col-param">param:{p.key}</div>
              ))}
              {validationFields.map(f => (
                <div key={f.jsonPath} className="csv-col-item col-validate">validate:{f.jsonPath}</div>
              ))}
            </div>

            <div className="csv-panel-title" style={{ marginTop: 16 }}>Inherited from test (fixed)</div>
            <div className="csv-panel-desc">These are embedded in the template metadata — not repeated per row.</div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
