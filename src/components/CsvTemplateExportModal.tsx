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

  // Build preview of URL pattern
  const pathParts = analysis.segments.map(seg => seg.segment);
  const previewParts = pathParts.map((seg, i) => {
    const sel = selections[i];
    if (sel?.checked && sel.name.trim()) return `{{${sel.name.trim()}}}`;
    return seg;
  });
  const previewUrl = `${analysis.origin}/${previewParts.join('/')}`;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal csv-import-modal">
        <div className="modal-header">
          <h3>Export CSV Template</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="csv-import-body">
          <div className="csv-step">
            <div className="csv-step-label">Mark variable path segments</div>
            <div className="csv-step-desc">
              Select which parts of the URL path change per test. These become columns in the CSV.
              Query parameters and validation rules are automatically included.
            </div>
            <div className="path-segment-list">
              {analysis.segments.map(seg => (
                <div key={seg.index} className={`path-segment-row ${selections[seg.index]?.checked ? 'selected' : ''}`}>
                  <label className="path-segment-check">
                    <input
                      type="checkbox"
                      checked={selections[seg.index]?.checked ?? false}
                      onChange={() => toggleSegment(seg.index)}
                    />
                    <code className="path-segment-value">/{seg.segment}</code>
                  </label>
                  {selections[seg.index]?.checked && (
                    <input
                      type="text"
                      className="path-var-name-input"
                      placeholder="Variable name (e.g. vin)"
                      value={selections[seg.index]?.name ?? ''}
                      onChange={(e) => setVarName(seg.index, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="csv-step">
            <div className="csv-step-label">URL Pattern Preview</div>
            <code className="url-pattern-preview">{previewUrl}</code>
          </div>

          <div className="csv-step">
            <div className="csv-step-label">CSV Columns</div>
            <div className="csv-columns-preview">
              <span className="csv-col-badge col-fixed">name</span>
              {pathVars.map(pv => (
                <span key={pv.segmentIndex} className="csv-col-badge col-path">path:{pv.variableName}</span>
              ))}
              {analysis.params.map(p => (
                <span key={p.key} className="csv-col-badge col-param">param:{p.key}</span>
              ))}
              {validationFields.map(f => (
                <span key={f.jsonPath} className="csv-col-badge col-validate">validate:{f.jsonPath}</span>
              ))}
            </div>
          </div>

          <div className="csv-step">
            <div className="csv-step-label">What's included from this test (not in CSV)</div>
            <div className="csv-fixed-summary">
              <div><strong>Method:</strong> {test.method}</div>
              <div><strong>Headers:</strong> {test.headers.filter(h => h.key.trim()).length} headers</div>
              <div><strong>Auth:</strong> {test.auth.type}</div>
              {test.body && <div><strong>Body:</strong> (template body included)</div>}
              <div><strong>Validation mode:</strong> {test.validation.mode}</div>
            </div>
          </div>
        </div>

        <div className="csv-import-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleExport}>
            Download CSV Template
          </button>
        </div>
      </div>
    </div>
  );
}
