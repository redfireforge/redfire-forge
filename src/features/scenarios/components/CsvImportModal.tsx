import React, { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, Scenario, DataSource, DataSourceColumn, DataSourceRow } from '@shared/types';
import { parseCsvToScenarios, parseExcelToScenarios, downloadCsv } from '../utils/csvTemplate';
import { parseJsonToScenarios } from '../utils/csvTemplateJson';
import type { CsvParseResult } from '../utils/csvTemplate';
import PopupModal from '@shared/components/PopupModal';
import { CustomSelect } from '@shared/components/CustomSelect';

type ImportMode = 'tests' | 'parameterized';

interface Props {
  featureGroups: FeatureGroup[];
  onImport: (fgId: string, scenarioId: string, tests: Scenario[]) => void;
  onClose: () => void;
}

export default function CsvImportModal({ featureGroups, onImport, onClose }: Props) {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedFgId, setSelectedFgId] = useState(featureGroups[0]?.id ?? '');
  const [createNewFg, setCreateNewFg] = useState(false);
  const [newFgName, setNewFgName] = useState('');
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [newScenarioName, setNewScenarioName] = useState('');
  const [createNewScenario, setCreateNewScenario] = useState(false);
  const [fileName, setFileName] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'append'>('append');
  const [importMode, setImportMode] = useState<ImportMode>('tests');
  const [dragging, setDragging] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFg = createNewFg ? null : featureGroups.find(fg => fg.id === selectedFgId);
  const scenarios = selectedFg?.scenarios ?? [];

  const isExcelFile = (name: string) => /\.xlsx?$/i.test(name);
  const isJsonFile = (name: string) => /\.json$/i.test(name);

  const toggleRowError = (rowIdx: number) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(rowIdx)) next.delete(rowIdx);
      else next.add(rowIdx);
      return next;
    });
  };

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setParseResult(null);
    setParseError(null);
    setExpandedErrors(new Set());
    const baseName = file.name.replace(/\.(xlsx?|csv|txt|json)$/i, '').replace(/[_-]/g, ' ').trim();
    setNewScenarioName(prev => prev || baseName);
    try {
      if (isJsonFile(file.name)) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const text = ev.target?.result as string;
            const result = parseJsonToScenarios(text);
            setParseResult(result);
          } catch (e) {
            setParseError(`Failed to parse JSON file: ${e instanceof Error ? e.message : String(e)}`);
          }
        };
        reader.onerror = () => setParseError('Failed to read file. It may be corrupted or too large.');
        reader.readAsText(file);
      } else if (isExcelFile(file.name)) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const buffer = ev.target?.result as ArrayBuffer;
            const result = parseExcelToScenarios(buffer);
            setParseResult(result);
          } catch (e) {
            setParseError(`Failed to parse Excel file: ${e instanceof Error ? e.message : String(e)}`);
          }
        };
        reader.onerror = () => setParseError('Failed to read file. It may be corrupted or too large.');
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const text = ev.target?.result as string;
            const result = parseCsvToScenarios(text);
            setParseResult(result);
          } catch (e) {
            setParseError(`Failed to parse CSV file: ${e instanceof Error ? e.message : String(e)}`);
          }
        };
        reader.onerror = () => setParseError('Failed to read file. It may be corrupted or too large.');
        reader.readAsText(file);
      }
    } catch (e) {
      setParseError(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (dragCounter.current === 1) setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.json') || isExcelFile(file.name))) {
        processFile(file);
      }
    };

    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);

    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
  }, [processFile]);

  const handleDownloadSample = useCallback(async () => {
    const sampleCsv = [
      'name,method,url,body,auth_type,header:Content-Type,param:channel,validate:data.id',
      'Get Items,GET,https://api.example.com/v1/items,,inherit,,,',
      'Create Item,POST,https://api.example.com/v1/items,"{""name"":""test""}",inherit,application/json,,item-123',
    ].join('\n');
    await downloadCsv(sampleCsv, 'redfireforge_csv_template_sample.csv');
  }, []);

  const validTests = parseResult?.rows.filter(r => r.scenario !== null) ?? [];

  const handleImport = () => {
    const tests = validTests.map(r => r.scenario!);
    if (tests.length === 0) return;

    const fgId = createNewFg ? `__new_fg__:${newFgName.trim()}` : selectedFgId;
    if (!fgId) return;

    // When creating a new feature group, always create a new scenario too
    const scenId = (createNewScenario || createNewFg)
      ? `__new__:${newScenarioName.trim()}`
      : selectedScenarioId;
    if (!scenId) return;

    if (importMode === 'parameterized') {
      // Build a single Scenario with a DataSource from all valid rows
      const paramTest = buildParameterizedTest(tests, parseResult!);
      onImport(fgId, scenId, [paramTest]);
    } else {
      onImport(fgId, scenId, tests);
    }
  };

  const canImport = validTests.length > 0
    && (createNewFg ? newFgName.trim() : selectedFgId)
    && ((createNewScenario || createNewFg) ? newScenarioName.trim() : selectedScenarioId);

  return (
    <PopupModal
      title="Import Tests from CSV / Excel / JSON"
      onClose={onClose}
      dialogClassName="csv-import-modal"
      bodyClassName="csv-import-body"
      footerClassName="csv-import-footer"
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!canImport}>
            {importMode === 'parameterized'
              ? `Import as Parameterized Test (${validTests.length} rows)`
              : `Import ${validTests.length} Test${validTests.length !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    >
          {/* Step 1: Download template */}
          <div className="csv-step">
            <div className="csv-step-label">Step 1 — Get a template</div>
            <div className="csv-step-desc">Use "Export Template" from any existing test's editor to generate an Excel or JSON template pre-filled with its URL, headers, and validation rules. You can also import CSV files or plain JSON arrays.</div>
            <button className="btn btn-xs" onClick={handleDownloadSample}>Download Sample Template</button>
          </div>

          {/* Step 2: Upload */}
          <div className="csv-step">
            <div className="csv-step-label">Step 2 — Upload your file</div>
            <div
              className={`csv-drop-zone${dragging ? ' csv-drop-zone-active' : ''}${fileName ? ' csv-drop-zone-done' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? (
                <div className="csv-drop-zone-file">
                  <span className="csv-drop-zone-icon">📄</span>
                  <span className="csv-drop-zone-name">{fileName}</span>
                  <span className="csv-drop-zone-hint">Click or drop to replace</span>
                </div>
              ) : (
                <div className="csv-drop-zone-empty">
                  <span className="csv-drop-zone-icon">{dragging ? '📥' : '📁'}</span>
                  <span className="csv-drop-zone-label">{dragging ? 'Drop file here' : 'Drag & drop a file here'}</span>
                  <span className="csv-drop-zone-hint">or click to browse · .xlsx .csv .json</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Parse error (crash-level) */}
          {parseError && (
            <div className="csv-step">
              <div className="import-error-box import-error-fatal">
                <div className="import-error-title">Parse Error</div>
                <div className="import-error-msg">{parseError}</div>
              </div>
            </div>
          )}

          {/* File-level structural errors */}
          {parseResult && parseResult.fileErrors.length > 0 && (
            <div className="csv-step">
              <div className="import-error-box import-error-fatal">
                <div className="import-error-title">
                  File Structure Error{parseResult.fileErrors.length > 1 ? 's' : ''}
                </div>
                {parseResult.fileErrors.map((err, i) => (
                  <div key={i} className="import-error-msg">{err}</div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {parseResult && parseResult.warnings.length > 0 && (
            <div className="csv-step">
              <div className="import-error-box import-error-warn">
                <div className="import-error-title">
                  Warning{parseResult.warnings.length > 1 ? 's' : ''}
                </div>
                {parseResult.warnings.map((w, i) => (
                  <div key={i} className="import-error-msg">{w}</div>
                ))}
              </div>
            </div>
          )}

          {/* Template info */}
          {parseResult?.meta && parseResult.fileErrors.length === 0 && (
            <div className="csv-step">
              <div className="csv-step-label">Template detected</div>
              <div className="csv-fixed-summary">
                <div><strong>Method:</strong> {parseResult.meta.method}</div>
                <div><strong>URL Pattern:</strong> <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{parseResult.meta.urlPattern}</code></div>
                <div><strong>Headers:</strong> {parseResult.meta.headers.length} included</div>
                <div><strong>Auth:</strong> {parseResult.meta.auth.type}</div>
                <div><strong>Validation:</strong> {
                  parseResult.meta.validationMode === 'none' ? 'No Body Validation' :
                  parseResult.meta.validationMode === 'full' ? 'Full JSON Match' :
                  'Selective Fields'
                }{parseResult.meta.unorderedArrays ? ' · unordered arrays' : ''}</div>
                {parseResult.meta.validationMode === 'full' && (
                  <div><strong>Expected JSON:</strong> {parseResult.meta.expectedJson ? 'Included in metadata' : 'Not set (capture after first run)'}</div>
                )}
                <div><strong>Columns:</strong> {parseResult.columns.length} in Data sheet</div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {parseResult && parseResult.fileErrors.length === 0 && parseResult.totalRows > 0 && (
            <div className="csv-step">
              <div className="csv-step-label">Step 3 — Preview</div>
              <div className="csv-parse-summary">
                <span className="csv-stat csv-stat-ok">✓ {parseResult.validRows} valid</span>
                {parseResult.errorRows > 0 && (
                  <span className="csv-stat csv-stat-err">✗ {parseResult.errorRows} error{parseResult.errorRows !== 1 ? 's' : ''}</span>
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
                    {parseResult.rows.map((row) => {
                      const hasErr = row.errors.length > 0;
                      const isExpanded = expandedErrors.has(row.rowIndex);
                      return (
                        <React.Fragment key={row.rowIndex}>
                          <tr
                            className={`${hasErr ? 'csv-row-error' : ''} ${hasErr ? 'csv-row-clickable' : ''}`}
                            onClick={hasErr ? () => toggleRowError(row.rowIndex) : undefined}
                          >
                            <td>{row.rowIndex}</td>
                            <td>
                              {hasErr
                                ? <span className="csv-badge-err">{row.errors.length} Error{row.errors.length > 1 ? 's' : ''}</span>
                                : <span className="csv-badge-ok">OK</span>}
                            </td>
                            <td className="csv-cell-name">{row.scenario?.name ?? row.raw['name'] ?? ''}</td>
                            <td><span className={`method-badge method-${(row.scenario?.method ?? row.raw['method'] ?? '').toLowerCase()}`}>{row.scenario?.method ?? row.raw['method'] ?? ''}</span></td>
                            <td className="csv-cell-url">{row.scenario?.url ?? row.raw['url'] ?? ''}</td>
                            <td>{row.scenario?.validation?.expectedFields?.length ?? 0} rules</td>
                          </tr>
                          {hasErr && isExpanded && (
                            <tr className="csv-row-error-expanded">
                              <td colSpan={6}>
                                <div className="csv-row-error-details">
                                  {row.errors.map((err, ei) => (
                                    <div key={ei} className="csv-row-error-line">• {err}</div>
                                  ))}
                                  <div className="csv-row-raw-data">
                                    <strong>Raw data:</strong>
                                    {Object.entries(row.raw).filter(([,v]) => v).map(([k, v]) => (
                                      <span key={k} className="csv-raw-kv"><span className="csv-raw-key">{k}:</span> {v}</span>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Destination */}
          {parseResult && parseResult.fileErrors.length === 0 && parseResult.validRows > 0 && (
            <div className="csv-step">
              <div className="csv-step-label">Step 4 — Select destination</div>
              <div className="csv-dest-fields">
                {/* Feature Group row */}
                <div className="csv-dest-row">
                  <span className="csv-dest-row-label">Feature Group</span>
                  {!createNewFg ? (
                    <CustomSelect
                      className="csv-dest-select"
                      value={selectedFgId}
                      onChange={(v) => { setSelectedFgId(v); setSelectedScenarioId(''); setCreateNewScenario(false); }}
                      options={featureGroups.map((fg) => ({ value: fg.id, label: fg.name }))}
                    />
                  ) : (
                    <input
                      className="csv-dest-select"
                      type="text"
                      placeholder="New feature group name"
                      value={newFgName}
                      onChange={(e) => setNewFgName(e.target.value)}
                      autoFocus
                    />
                  )}
                  <label className="csv-checkbox-label">
                    <input
                      type="checkbox"
                      checked={createNewFg}
                      onChange={(e) => {
                        setCreateNewFg(e.target.checked);
                        if (e.target.checked) {
                          setCreateNewScenario(true);
                          setSelectedScenarioId('');
                        }
                      }}
                    />
                    Create new feature group
                  </label>
                </div>

                {/* Scenario row */}
                <div className="csv-dest-row">
                  <span className="csv-dest-row-label">Scenario</span>
                  {(!createNewScenario && !createNewFg) ? (
                    <CustomSelect
                      className="csv-dest-select"
                      value={selectedScenarioId}
                      onChange={(v) => setSelectedScenarioId(v)}
                      placeholder="— Select —"
                      options={scenarios.map((sc) => ({
                        value: sc.id,
                        label: `${sc.name} (${sc.tests.length} tests)`,
                      }))}
                    />
                  ) : (
                    <input
                      className="csv-dest-select"
                      type="text"
                      placeholder="New scenario name"
                      value={newScenarioName}
                      onChange={(e) => setNewScenarioName(e.target.value)}
                      autoFocus={!createNewFg}
                    />
                  )}
                  {!createNewFg ? (
                    <label className="csv-checkbox-label">
                      <input type="checkbox" checked={createNewScenario} onChange={(e) => { setCreateNewScenario(e.target.checked); setSelectedScenarioId(''); }} />
                      Create new scenario
                    </label>
                  ) : (
                    <span className="csv-dest-empty-cell" />
                  )}
                </div>

                {/* Import mode */}
                <div className="csv-dest-row">
                  <span className="csv-dest-row-label">Import As</span>
                  <CustomSelect
                    className="csv-dest-select"
                    value={importMode}
                    onChange={(v) => setImportMode(v as ImportMode)}
                    options={[
                      { value: 'tests', label: 'Individual Tests — each row becomes a separate test' },
                      { value: 'parameterized', label: 'Parameterized Test — one test with all rows as data source' },
                    ]}
                  />
                </div>

                {/* Duplicate handling */}
                <div className="csv-dest-row">
                  <span className="csv-dest-row-label">Duplicates</span>
                  <CustomSelect
                    className="csv-dest-select"
                    value={duplicateMode}
                    onChange={(v) => setDuplicateMode(v as 'skip' | 'append')}
                    options={[
                      { value: 'append', label: 'Add anyway (allow duplicates)' },
                      { value: 'skip', label: 'Skip duplicates' },
                    ]}
                  />
                </div>
              </div>
            </div>
          )}
    </PopupModal>
  );
}

// ─── Helper: build a single parameterized test from parsed rows ───

function buildParameterizedTest(tests: Scenario[], parseResult: CsvParseResult): Scenario {
  const meta = parseResult.meta;
  const baseTest = tests[0];

  // Build a set of known path variable names from metadata
  const pathVarNames = new Set(meta?.pathVariables ?? []);

  // Column type map from Excel metadata (most reliable source)
  const columnTypes = parseResult.columnTypes;

  // Extract query param names from the URL pattern (e.g. "channel={{channel}}" → "channel")
  const paramNames = new Set<string>();
  if (meta?.urlPattern) {
    const qIdx = meta.urlPattern.indexOf('?');
    if (qIdx >= 0) {
      const qs = meta.urlPattern.slice(qIdx + 1);
      for (const pair of qs.split('&')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx >= 0) paramNames.add(pair.slice(0, eqIdx));
      }
    }
  }

  // Determine columns from the parse result columns list
  const columns: DataSourceColumn[] = [];
  const colNames = parseResult.columns;

  // Skip these meta-level fields — they define the test, not data source columns
  const skipFields = new Set(['name', 'method', 'url', 'body', 'auth_type']);

  for (const colName of colNames) {
    let type: DataSourceColumn['type'] = 'param';
    let mapping = colName;
    let displayName = colName;

    // 1. Check for explicit prefixes (CSV format)
    if (colName.startsWith('path:')) {
      type = 'path';
      mapping = colName.slice(5);
      displayName = mapping;
    } else if (colName.startsWith('param:')) {
      type = 'param';
      mapping = colName.slice(6);
      displayName = mapping;
    } else if (colName.startsWith('validate:') || colName.startsWith('expect:')) {
      type = 'validate';
      mapping = colName.startsWith('validate:') ? colName.slice(9) : colName.slice(7);
      displayName = mapping;
    } else if (colName.startsWith('header:')) {
      type = 'header';
      mapping = colName.slice(7);
      displayName = mapping;
    } else if (colName.startsWith('body:')) {
      type = 'body';
      mapping = colName.slice(5);
      displayName = mapping;
    } else if (skipFields.has(colName)) {
      // Skip test-level fields
      continue;
    } else {
      // 2. No prefix (Excel format) — use columnTypes map from metadata first
      const colInfo = columnTypes?.get(colName);
      if (colInfo) {
        type = colInfo.type as DataSourceColumn['type'];
        mapping = colInfo.mapping || colName;
        if (type === 'name' as string) continue; // skip 'name' type column
      } else if (pathVarNames.has(colName)) {
        type = 'path';
        mapping = colName;
      } else if (paramNames.has(colName)) {
        type = 'param';
        mapping = colName;
      } else {
        // Everything else is a validate column
        type = 'validate';
        mapping = colName;
      }
      displayName = colName;
    }

    columns.push({
      id: uuidv4(),
      name: displayName,
      type,
      mapping,
    });
  }

  // Build rows from valid parsed data
  const rows: DataSourceRow[] = [];
  for (const parsedRow of parseResult.rows) {
    if (!parsedRow.scenario) continue;
    const values: Record<string, string> = {};
    for (const col of columns) {
      // Find value from raw data — try the original column name in all prefix variants
      const rawKey = colNames.find(cn => {
        if (cn === col.name) return true;
        if (cn === col.mapping) return true;
        if (cn === `path:${col.mapping}`) return true;
        if (cn === `param:${col.mapping}`) return true;
        if (cn === `validate:${col.mapping}` || cn === `expect:${col.mapping}`) return true;
        if (cn === `header:${col.mapping}`) return true;
        if (cn === `body:${col.mapping}`) return true;
        return false;
      });
      values[col.id] = rawKey ? (parsedRow.raw[rawKey] ?? '') : '';
    }
    rows.push({
      id: uuidv4(),
      label: parsedRow.scenario.name,
      values,
      enabled: true,
    });
  }

  // Build URL template from metadata
  const urlTemplate = meta?.urlPattern || baseTest.url;

  // Determine validation contract from dynamic validate columns
  const validateCols = columns.filter(c => c.type === 'validate');
  let validationContract: string[] | undefined;
  const patternSet = new Set<string>();
  for (const vc of validateCols) {
    const wildcarded = vc.mapping.replace(/\[\d+\]/g, '[*]');
    if (wildcarded !== vc.mapping) {
      patternSet.add(wildcarded);
    }
  }
  if (patternSet.size > 0) {
    validationContract = Array.from(patternSet);
  }

  // Use metadata-provided contract/mode if available (more reliable than re-deriving)
  const finalContract = parseResult.validationContract ?? validationContract;
  const finalArrayMode = parseResult.arrayValidationMode;

  const dataTable: DataSource = {
    id: uuidv4(),
    columns,
    rows,
    source: { type: 'inline' },
    urlTemplate,
    validationContract: finalContract,
    arrayValidationMode: finalArrayMode,
  };

  // Build the parameterized test scenario
  const paramTest: Scenario = {
    id: uuidv4(),
    name: baseTest.name.replace(/\s*-\s*\S+$/, '') || baseTest.name, // Strip VIN/suffix from name
    method: baseTest.method,
    url: urlTemplate,
    headers: baseTest.headers,
    body: baseTest.body,
    bodyType: baseTest.bodyType,
    bodyForm: baseTest.bodyForm,
    auth: baseTest.auth,
    validation: baseTest.validation,
    dataSource: dataTable,
  };

  return paramTest;
}
