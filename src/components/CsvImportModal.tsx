import { useState, useRef, useCallback } from 'react';
import type { FeatureGroup, Scenario } from '../types';
import { parseCsvToScenarios, downloadCsv } from '../utils/csvTemplate';
import type { CsvParseResult } from '../utils/csvTemplate';

interface Props {
  featureGroups: FeatureGroup[];
  onImport: (fgId: string, scenarioId: string, tests: Scenario[]) => void;
  onClose: () => void;
}

export default function CsvImportModal({ featureGroups, onImport, onClose }: Props) {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [selectedFgId, setSelectedFgId] = useState(featureGroups[0]?.id ?? '');
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [newScenarioName, setNewScenarioName] = useState('');
  const [createNewScenario, setCreateNewScenario] = useState(false);
  const [fileName, setFileName] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'append'>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFg = featureGroups.find(fg => fg.id === selectedFgId);
  const scenarios = selectedFg?.scenarios ?? [];

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCsvToScenarios(text);
      setParseResult(result);
    };
    reader.readAsText(file);
  }, []);

  const handleDownloadSample = useCallback(() => {
    const sampleCsv = [
      'name,method,url,body,auth_type,header:Content-Type,param:channel,validate:data.id',
      'Get Items,GET,https://api.example.com/v1/items,,inherit,,,',
      'Create Item,POST,https://api.example.com/v1/items,"{""name"":""test""}",inherit,application/json,,item-123',
    ].join('\n');
    downloadCsv(sampleCsv, 'redfireforge_csv_template_sample.csv');
  }, []);

  const validTests = parseResult?.rows.filter(r => r.scenario !== null) ?? [];

  const handleImport = () => {
    const tests = validTests.map(r => r.scenario!);
    if (tests.length === 0) return;
    const scenId = createNewScenario ? `__new__:${newScenarioName.trim()}` : selectedScenarioId;
    if (!scenId) return;
    onImport(selectedFgId, scenId, tests);
  };

  const canImport = validTests.length > 0
    && selectedFgId
    && (createNewScenario ? newScenarioName.trim() : selectedScenarioId);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal csv-import-modal">
        <div className="modal-header">
          <h3>Import Tests from CSV</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="csv-import-body">
          {/* Step 1: Download template */}
          <div className="csv-step">
            <div className="csv-step-label">Step 1 — Get a template</div>
            <div className="csv-step-desc">Download a sample CSV template, or use "CSV Template" from any existing test's editor to generate one pre-filled with its URL, headers, and validation rules.</div>
            <button className="btn btn-xs" onClick={handleDownloadSample}>Download Sample Template</button>
          </div>

          {/* Step 2: Upload */}
          <div className="csv-step">
            <div className="csv-step-label">Step 2 — Upload your CSV</div>
            <div className="csv-upload-row">
              <button className="btn" onClick={() => fileInputRef.current?.click()}>
                Choose File...
              </button>
              <span className="csv-filename">{fileName || 'No file selected'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Template info */}
          {parseResult?.meta && (
            <div className="csv-step">
              <div className="csv-step-label">Template detected</div>
              <div className="csv-fixed-summary">
                <div><strong>Method:</strong> {parseResult.meta.method}</div>
                <div><strong>URL Pattern:</strong> <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{parseResult.meta.urlPattern}</code></div>
                <div><strong>Headers:</strong> {parseResult.meta.headers.length} included</div>
                <div><strong>Auth:</strong> {parseResult.meta.auth.type}</div>
                <div><strong>Validation:</strong> {parseResult.meta.validationMode}{parseResult.meta.unorderedArrays ? ' (unordered arrays)' : ''}</div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {parseResult && (
            <div className="csv-step">
              <div className="csv-step-label">{parseResult.meta ? 'Step 3 — Preview' : 'Step 3 — Preview'}</div>
              <div className="csv-parse-summary">
                <span className="csv-stat csv-stat-ok">✓ {parseResult.validRows} valid</span>
                {parseResult.errorRows > 0 && (
                  <span className="csv-stat csv-stat-err">✗ {parseResult.errorRows} errors</span>
                )}
                <span className="csv-stat">{parseResult.totalRows} total rows</span>
              </div>
              <div className="csv-preview-table-wrap">
                <table className="csv-preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Status</th>
                      <th>Name</th>
                      <th>Method</th>
                      <th>URL</th>
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rows.map((row) => (
                      <tr key={row.rowIndex} className={row.errors.length > 0 ? 'csv-row-error' : ''}>
                        <td>{row.rowIndex}</td>
                        <td>{row.errors.length > 0 ? <span className="csv-badge-err">Error</span> : <span className="csv-badge-ok">OK</span>}</td>
                        <td className="csv-cell-name">{row.scenario?.name ?? row.raw['name'] ?? ''}</td>
                        <td><span className={`method-badge method-${(row.scenario?.method ?? row.raw['method'] ?? '').toLowerCase()}`}>{row.scenario?.method ?? row.raw['method'] ?? ''}</span></td>
                        <td className="csv-cell-url">{row.scenario?.url ?? row.raw['url'] ?? ''}</td>
                        <td>{row.scenario?.validation?.expectedFields?.length ?? 0} rules</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parseResult.rows.filter(r => r.errors.length > 0).map(r => (
                <div key={r.rowIndex} className="csv-row-error-detail">
                  Row {r.rowIndex}: {r.errors.join(', ')}
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Destination */}
          {parseResult && parseResult.validRows > 0 && (
            <div className="csv-step">
              <div className="csv-step-label">Step 4 — Select destination</div>
              <div className="csv-dest-fields">
                <div className="csv-dest-field">
                  <label>Feature Group</label>
                  <select value={selectedFgId} onChange={(e) => { setSelectedFgId(e.target.value); setSelectedScenarioId(''); setCreateNewScenario(false); }}>
                    {featureGroups.map(fg => (
                      <option key={fg.id} value={fg.id}>{fg.name}</option>
                    ))}
                  </select>
                </div>
                <div className="csv-dest-field">
                  <label>Scenario</label>
                  {!createNewScenario ? (
                    <select value={selectedScenarioId} onChange={(e) => setSelectedScenarioId(e.target.value)}>
                      <option value="">— Select —</option>
                      {scenarios.map(sc => (
                        <option key={sc.id} value={sc.id}>{sc.name} ({sc.tests.length} tests)</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="New scenario name"
                      value={newScenarioName}
                      onChange={(e) => setNewScenarioName(e.target.value)}
                      autoFocus
                    />
                  )}
                  <label className="csv-checkbox-label">
                    <input type="checkbox" checked={createNewScenario} onChange={(e) => { setCreateNewScenario(e.target.checked); setSelectedScenarioId(''); }} />
                    Create new scenario
                  </label>
                </div>
                <div className="csv-dest-field">
                  <label>If test name already exists</label>
                  <select value={duplicateMode} onChange={(e) => setDuplicateMode(e.target.value as 'skip' | 'append')}>
                    <option value="append">Add anyway (allow duplicates)</option>
                    <option value="skip">Skip duplicates</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="csv-import-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!canImport}>
            Import {validTests.length} Test{validTests.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
