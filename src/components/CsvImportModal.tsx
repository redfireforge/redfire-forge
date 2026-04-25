import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { FeatureGroup, Scenario } from '../types';
import { parseCsvToScenarios, parseExcelToScenarios, downloadCsv } from '../utils/csvTemplate';
import type { CsvParseResult } from '../utils/csvTemplate';
import { useModalDrag } from '../hooks/useModalDrag';
import { useModalExpand } from '../hooks/useModalExpand';
import { useModalResize } from '../hooks/useModalResize';
import ModalExpandButton from './shared/ModalExpandButton';
import ModalResizeHandles from './shared/ModalResizeHandles';

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
  const [dragging, setDragging] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(true);
  const { expanded: modalExpanded, toggleExpand, expandClass } = useModalExpand();
  const { resizeStyle, onRightEdge, onCorner } = useModalResize();
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFg = createNewFg ? null : featureGroups.find(fg => fg.id === selectedFgId);
  const scenarios = selectedFg?.scenarios ?? [];

  const isExcelFile = (name: string) => /\.xlsx?$/i.test(name);

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
    const baseName = file.name.replace(/\.(xlsx?|csv|txt)$/i, '').replace(/[_-]/g, ' ').trim();
    setNewScenarioName(prev => prev || baseName);
    try {
      if (isExcelFile(file.name)) {
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
      if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt') || isExcelFile(file.name))) {
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

    const fgId = createNewFg ? `__new_fg__:${newFgName.trim()}` : selectedFgId;
    if (!fgId) return;

    // When creating a new feature group, always create a new scenario too
    const scenId = (createNewScenario || createNewFg)
      ? `__new__:${newScenarioName.trim()}`
      : selectedScenarioId;
    if (!scenId) return;

    onImport(fgId, scenId, tests);
  };

  const canImport = validTests.length > 0
    && (createNewFg ? newFgName.trim() : selectedFgId)
    && ((createNewScenario || createNewFg) ? newScenarioName.trim() : selectedScenarioId);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={overlayStyle}
    >
      <div className={`modal csv-import-modal ${expandClass}`} role="dialog" style={{ ...modalStyle, ...resizeStyle }}>
        <div className="modal-header" style={{ cursor: 'move' }} onMouseDown={onDragStart}>
          <h3>Import Tests from CSV / Excel</h3>
          <ModalExpandButton expanded={modalExpanded} onToggle={toggleExpand} />
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="csv-import-body">
          {/* Step 1: Download template */}
          <div className="csv-step">
            <div className="csv-step-label">Step 1 — Get a template</div>
            <div className="csv-step-desc">Use "Export Template" from any existing test's editor to generate an Excel template pre-filled with its URL, headers, and validation rules. You can also import legacy CSV files.</div>
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
                  <span className="csv-drop-zone-label">{dragging ? 'Drop file here' : 'Drag & drop an Excel or CSV file here'}</span>
                  <span className="csv-drop-zone-hint">or click to browse · .xlsx .csv</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
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
                  parseResult.meta.validationMode === 'none' ? 'No Validation' :
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
                <div className="csv-dest-field">
                  <label>Feature Group</label>
                  {!createNewFg ? (
                    <select value={selectedFgId} onChange={(e) => { setSelectedFgId(e.target.value); setSelectedScenarioId(''); setCreateNewScenario(false); }}>
                      {featureGroups.map(fg => (
                        <option key={fg.id} value={fg.id}>{fg.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
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
                <div className="csv-dest-field">
                  <label>Scenario</label>
                  {(!createNewScenario && !createNewFg) ? (
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
                      autoFocus={!createNewFg}
                    />
                  )}
                  {!createNewFg && (
                    <label className="csv-checkbox-label">
                      <input type="checkbox" checked={createNewScenario} onChange={(e) => { setCreateNewScenario(e.target.checked); setSelectedScenarioId(''); }} />
                      Create new scenario
                    </label>
                  )}
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
          <ModalExpandButton expanded={modalExpanded} onToggle={toggleExpand} position="footer" />
        </div>
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} />
      </div>
    </div>
  );
}
