import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, FeatureGroup, KeyValue, GlobalAuthProfile, SharedDataSource, DataSource, AuthConfig } from '../../../shared/types';
import { parseCurl } from '../../../shared/utils/curlParser';
import { buildCurlCommand } from '../../../shared/utils/curlGenerator';
import {
  getBaseUrl,
  parseQueryParams,
  pickJsonFile,
  rebuildUrl,
  unwrapImport,
} from '../utils/testEditorUtils';
import { toErrorMessage } from '../../../shared/utils/helpers';
import type { VersionExportOptions } from '../utils/scenarioImportExport';
import TestDefinitionVersionPanel from './TestDefinitionVersionPanel';
import TestDefinitionVersionDiff from './TestDefinitionVersionDiff';
import { createSnapshot } from '../utils/testDefinitionVersioning';
import { BodyEditor } from '../../requests/components/BodyEditor';
import { ParamsEditor, toParamEntries, fromParamEntries, type ParamEntry } from '../../requests/components/ParamsEditor';
import { useToast } from '../../../shared/hooks/useToast';
import { useAuthVerify } from '../../requests/hooks/useAuthVerify';
import { useTestFetch } from '../hooks/useTestFetch';
import { saveFile } from '../../../shared/utils/fileSaver';
import Papa from 'papaparse';
import DataSourceSetupModal from './DataSourceSetupModal';
import TestEditorAuthTab from './TestEditorAuthTab';
import TestEditorValidationTab from './TestEditorValidationTab';
import ExtractionEditor from '../../requests/components/ExtractionEditor';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import DataSourceEditor from './DataSourceEditor';
import type { ImportChoice, ExportChoice } from './ImportExportChoiceModal';

// emptyTest is imported directly from '../utils/testEditorUtils' by consumers

export type TestEditorTab = 'params' | 'body' | 'auth' | 'headers' | 'validation' | 'extract' | 'data' | 'history';
export type TestEditorInputMode = 'builder' | 'curlImport' | 'curlExport';

export type TestEditingContext = { fgId: string; scenarioId: string; testId: string | 'new' };

export interface TestEditorModalProps {
  draft: Scenario;
  onDraftChange: (draft: Scenario) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
  isParameterized?: boolean;
  inputMode: TestEditorInputMode;
  onInputModeChange: (mode: TestEditorInputMode) => void;
  activeTab: TestEditorTab;
  onActiveTabChange: (tab: TestEditorTab) => void;
  resolvedBaseUrl: string;
  allAuthProfiles: GlobalAuthProfile[];
  featureGroups: FeatureGroup[];
  /** Parent feature group id, scenario id, and test id for auth inheritance resolution */
  editingTest: TestEditingContext;
  onExportTest: (scenario: Scenario, versionOpts?: VersionExportOptions) => void;
  onVersionRestore: (version: import('../../../shared/types').TestDefinitionVersion) => void;
  onVersionDelete: (versionId: string) => void;
  onVersionRename: (versionId: string, label: string) => void;
  /** Called when user wants to create a parameterized copy from the Parameterize tab */
  onCreateParameterizedCopy?: (copy: Scenario, targetFgId?: string, targetScenarioId?: string) => void;
  /** Top-level shared data sources (for linking) */
  sharedDataSources?: SharedDataSource[];
  /** Called when user promotes inline data to a shared data source; returns new shared DS id */
  onPromoteToShared?: (
    dataSource: DataSource,
    name: string,
    tags?: string[],
    fetchConfig?: { url: string; method: string; headers: KeyValue[]; auth?: AuthConfig }
  ) => string;
  /** Called when user clicks the shared DS badge to open the modal */
  onOpenSharedDsModal?: () => void;
}

export default function TestEditorModal({
  draft,
  onDraftChange,
  onSave,
  onCancel,
  isNew,
  isParameterized,
  inputMode,
  onInputModeChange,
  activeTab,
  onActiveTabChange,
  resolvedBaseUrl,
  allAuthProfiles,
  featureGroups,
  editingTest,
  onExportTest,
  onVersionRestore,
  onVersionDelete,
  onVersionRename,
  onCreateParameterizedCopy,
  sharedDataSources,
  onPromoteToShared,
  onOpenSharedDsModal,
}: TestEditorModalProps) {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const toast = useToast();

  const [importDropdownOpen, setImportDropdownOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const importDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(e.target as Node)) setImportDropdownOpen(false);
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) setExportDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [curlText, setCurlText] = useState('');
  const [generatedCurl, setGeneratedCurl] = useState('');
  const [curlGenerating, setCurlGenerating] = useState(false);
  const [queryParams, setQueryParams] = useState<ParamEntry[]>(() => toParamEntries(parseQueryParams(draft.url)));

  const {
    fetchingResponse, fetchError,
    fetchHostOverride, setFetchHostOverride,
    fetchHostEnabled, setFetchHostEnabled,
    validating, validationResult, setValidationResult,
    pendingFetchResponse,
    resolveEffectiveAuth,
    handleFetchRow,
    handleFetchSampleResponse,
    handleFetchKeepRules, handleFetchReplaceAll, handleFetchCancel,
    handleValidateResponse,
  } = useTestFetch({
    draftRef,
    onDraftChange,
    featureGroups,
    editingFgId: editingTest.fgId,
    editingScenarioId: editingTest.scenarioId,
    editingTestId: editingTest.testId,
    allAuthProfiles,
    draftId: draft.id,
  });

  const { authVerifying, authVerifyResult, setAuthVerifyResult, verifyAuth } = useAuthVerify();
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    setQueryParams(toParamEntries(parseQueryParams(draft.url)));
    setCurlText('');
    setGeneratedCurl('');
    setAuthVerifyResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally sync local state only on test switch
  }, [editingTest.fgId, editingTest.scenarioId, editingTest.testId, draft.id]);

  // Sync queryParams when draft.url changes externally (e.g. version restore)
  const prevUrlRef = useRef(draft.url);
  useEffect(() => {
    if (draft.url !== prevUrlRef.current) {
      prevUrlRef.current = draft.url;
      setQueryParams(toParamEntries(parseQueryParams(draft.url)));
    }
  }, [draft.url]);

  const syncParamsFromUrl = useCallback((url: string) => {
    setQueryParams(toParamEntries(parseQueryParams(url)));
  }, []);

  const handleParamsChange = useCallback((entries: ParamEntry[]) => {
    setQueryParams(entries);
    const cur = draftRef.current;
    if (cur.url) {
      onDraftChange({ ...cur, url: rebuildUrl(cur.url, fromParamEntries(entries)) });
    }
  }, [onDraftChange]);

  const handleImportFromUrl = useCallback(() => {
    const cur = draftRef.current;
    setQueryParams(toParamEntries(parseQueryParams(cur.url)));
  }, []);

  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const cur = draftRef.current;
    const headers = [...cur.headers];
    headers[index] = { ...headers[index], [field]: val };
    onDraftChange({ ...cur, headers });
  };

  const addHeader = () => {
    const cur = draftRef.current;
    onDraftChange({ ...cur, headers: [...cur.headers, { key: '', value: '' }] });
  };

  const removeHeader = (index: number) => {
    const cur = draftRef.current;
    onDraftChange({ ...cur, headers: cur.headers.filter((_, i) => i !== index) });
  };

  const handleBaseUrlChange = (newBaseUrl: string) => {
    const cur = draftRef.current;
    const enabledParams = fromParamEntries(queryParams);
    const newUrl = enabledParams.length > 0 ? rebuildUrl(newBaseUrl, enabledParams) : newBaseUrl;
    const patch: Partial<Scenario> = { url: newUrl };
    // Keep urlTemplate in sync when data source exists
    if (cur.dataSource?.urlTemplate) {
      patch.dataSource = { ...cur.dataSource, urlTemplate: newUrl };
    }
    onDraftChange({ ...cur, ...patch });
  };

  const handleCurlImport = () => {
    if (!curlText.trim()) return;
    const parsed = parseCurl(curlText);
    const cur = draftRef.current;
    // Preserve cur.id so the React key doesn't change and cause a remount
    const { id: _discardId, ...parsedWithoutId } = parsed;
    onDraftChange({ ...cur, ...parsedWithoutId, validation: cur.validation });
    syncParamsFromUrl(parsed.url || '');
    onInputModeChange('builder');
    setCurlText('');
    if (parsed.bodyType && parsed.bodyType !== 'none' && parsed.method !== 'GET') {
      onActiveTabChange('body');
    }
  };

  const generateCurl = useCallback(async (): Promise<string> => {
    const cur = draftRef.current;
    const { auth: effectiveAuth } = resolveEffectiveAuth();
    return buildCurlCommand(cur, effectiveAuth);
  }, [resolveEffectiveAuth]);

  const triggerCurlGeneration = useCallback(async () => {
    const cur = draftRef.current;
    if (!cur.url.trim()) {
      setGeneratedCurl('');
      return;
    }
    setCurlGenerating(true);
    try {
      const cmd = await generateCurl();
      setGeneratedCurl(cmd);
    } catch (err) {
      setGeneratedCurl(`# Error generating cURL: ${toErrorMessage(err)}`);
    } finally {
      setCurlGenerating(false);
    }
  }, [generateCurl]);

  const [csvExportOpen, setCsvExportOpen] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{ older: import('../../../shared/types').TestDefinitionVersion; newer: import('../../../shared/types').TestDefinitionVersion } | null>(null);

  const defVersions = draft.definitionVersions ?? [];
  const defVersionCount = defVersions.length;

  const paramCount = useMemo(() => queryParams.filter((p) => p.key.trim() && p.enabled).length, [queryParams]);
  const headerCount = useMemo(() => draft.headers.filter((h) => h.key.trim()).length, [draft.headers]);

  // For parameterized tests, build a preview URL with {{variable}} placeholders for param columns
  const displayUrl = useMemo(() => {
    const dt = draft.dataSource;
    if (dt?.urlTemplate) {
      // Start with the template (already has path {{variables}})
      const paramCols = dt.columns.filter(c => c.type === 'param');
      if (paramCols.length > 0) {
        const base = dt.urlTemplate.split('?')[0];
        const params = paramCols.map(c => `${c.mapping}={{${c.mapping}}}`).join('&');
        return `${base}?${params}`;
      }
      return dt.urlTemplate;
    }
    return draft.url;
  }, [draft.dataSource, draft.url]);

  const baseUrl = useMemo(() => (displayUrl ? getBaseUrl(displayUrl) : ''), [displayUrl]);

  // ─── Import/Export choice handlers ──────────────────────────
  const handleImportChoice = useCallback((choice: ImportChoice) => {
    setImportDropdownOpen(false);
    if (choice === 'test-definition') {
      pickJsonFile((raw) => {
        const data = unwrapImport(raw);
        const t = data as Scenario;
        if (!t.name || !t.url || !t.method) { toast.show('error', 'Invalid file', 'Expected a test with name, url, and method.'); return; }
        const cur = draftRef.current;
        onDraftChange({ ...t, id: cur.id });
        syncParamsFromUrl(t.url || '');
        if (inputMode !== 'builder') onInputModeChange('builder');
      });
    } else if (choice === 'data-rows') {
      // Trigger file picker for CSV/JSON data rows
      const dt = draftRef.current.dataSource;
      if (!dt) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        const cur = draftRef.current;
        const currentDt = cur.dataSource;
        if (!currentDt) return;

        if (file.name.endsWith('.json')) {
          try {
            const json = JSON.parse(text);
            // Minimal JSON import — map values by column name
            if (json.rows && Array.isArray(json.rows)) {
              const newRows = json.rows.map((r: { values?: Record<string, string>; enabled?: boolean }) => {
                const values: Record<string, string> = {};
                for (const col of currentDt.columns) {
                  values[col.id] = r.values?.[col.name] ?? '';
                }
                return { id: uuidv4(), values, enabled: r.enabled !== false };
              });
              onDraftChange({ ...cur, dataSource: { ...currentDt, rows: newRows } });
            }
          } catch (err) { console.error('JSON import failed:', err); }
          return;
        }

        // CSV import
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return;
        const rawHeaders = Papa.parse(lines[0]).data[0] as string[];
        const colIdMap = rawHeaders.map(h => {
          const trimmed = h.trim();
          // Strip type prefix (path:, param:, expect:, header:, body:, validate:)
          const stripped = trimmed.replace(/^(?:path|param|expect|header|body|validate):/, '');
          const col = currentDt.columns.find(c => c.name.toLowerCase() === stripped.toLowerCase() || c.mapping.toLowerCase() === stripped.toLowerCase())
            || currentDt.columns.find(c => c.name.toLowerCase() === trimmed.toLowerCase() || c.mapping.toLowerCase() === trimmed.toLowerCase());
          return col?.id ?? null;
        });
        const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
        const dataRows = parsed.data.slice(1); // skip header row
        const newRows = [];
        for (const cells of dataRows) {
          const values: Record<string, string> = {};
          for (const col of currentDt.columns) values[col.id] = '';
          for (let j = 0; j < colIdMap.length; j++) {
            if (colIdMap[j]) values[colIdMap[j]!] = cells[j] ?? '';
          }
          newRows.push({ id: uuidv4(), values, enabled: true });
        }
        if (newRows.length > 0) {
          onDraftChange({ ...cur, dataSource: { ...currentDt, rows: newRows } });
        }
      };
      input.click();
    }
  }, [onDraftChange, onInputModeChange, inputMode, syncParamsFromUrl, toast]);

  const handleExportChoice = useCallback((choice: ExportChoice) => {
    setExportDropdownOpen(false);
    if (choice === 'test-definition') {
      // Export directly with default options (include all versions)
      onExportTest(draftRef.current);
    } else if (choice === 'excel-template') {
      setCsvExportOpen(true);
    } else if (choice === 'data-csv') {
      const dt = draftRef.current.dataSource;
      if (!dt) return;
      const headers = dt.columns.map(col => {
        const prefix = col.type === 'path' ? 'path:' : col.type === 'param' ? 'param:' : col.type === 'validate' ? 'expect:' : col.type === 'header' ? 'header:' : col.type === 'body' ? 'body:' : '';
        return prefix + col.name;
      });
      const data = dt.rows.map(row =>
        dt.columns.map(col => row.values[col.id] ?? ''),
      );
      const csv = Papa.unparse({ fields: headers, data });
      const blob = new Blob([csv], { type: 'text/csv' });
      void saveFile(blob, { filename: `${draftRef.current.name || 'data-source'}.csv`, mimeType: 'text/csv', description: 'CSV file' });
    } else if (choice === 'data-json') {
      const cur = draftRef.current;
      const dt = cur.dataSource;
      if (!dt) return;
      const json = {
        version: '1.0',
        metadata: { name: cur.name, method: cur.method, urlTemplate: dt.urlTemplate || cur.url, createdAt: new Date().toISOString(), exportedFrom: 'RedfireForge' },
        columns: dt.columns.map(col => ({ id: col.id, name: col.name, type: col.type, mapping: col.mapping })),
        rows: dt.rows.map(row => ({ id: row.id, enabled: row.enabled, tags: row.tags, note: row.note, values: Object.fromEntries(dt.columns.map(col => [col.name, row.values[col.id] ?? ''])) })),
      };
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      void saveFile(blob, { filename: `${cur.name || 'data-source'}.json`, mimeType: 'application/json', description: 'JSON file' });
    }
  }, [onExportTest]);

  return (
    <>
      <WorkflowEditorModalFrame
        title={isNew ? (isParameterized ? 'New Parameterized Test' : 'New Test') : (isParameterized ? 'Edit Parameterized Test' : 'Edit Test')}
        onClose={onCancel}
        overlayClassName="insomnia-modal-overlay"
        dialogClassName="insomnia-modal"
        expandMode="fullscreen"
        headerActions={
          <>
            <div className="mode-toggle">
              <button type="button" className={`mode-btn ${inputMode === 'builder' ? 'active' : ''}`} onClick={() => onInputModeChange('builder')}>Builder</button>
              <button type="button" className={`mode-btn ${inputMode === 'curlImport' ? 'active' : ''}`} onClick={() => onInputModeChange('curlImport')}>cURL Import</button>
              <button
                type="button"
                className={`mode-btn ${inputMode === 'curlExport' ? 'active' : ''}`}
                onClick={() => {
                  onInputModeChange('curlExport');
                  void triggerCurlGeneration();
                }}
              >
                cURL Export
              </button>
              <div className="mode-btn-dropdown-wrapper" ref={importDropdownRef}>
                <button
                  type="button"
                  className={`mode-btn ${importDropdownOpen ? 'active' : ''}`}
                  onClick={() => { setImportDropdownOpen(v => !v); setExportDropdownOpen(false); }}
                >
                  Import ▾
                </button>
                {importDropdownOpen && (
                  <div className="mode-btn-dropdown">
                    <button type="button" className="mode-btn-dropdown-item" onClick={() => handleImportChoice('test-definition')}>
                      <span className="mode-btn-dropdown-label">Test Definition</span>
                      <span className="mode-btn-dropdown-desc">Load a saved test configuration (.json)</span>
                    </button>
                    <button type="button" className="mode-btn-dropdown-item" disabled={!draft.dataSource} onClick={() => handleImportChoice('data-rows')}>
                      <span className="mode-btn-dropdown-label">Data Rows</span>
                      <span className="mode-btn-dropdown-desc">Import CSV or JSON data into the Data Source</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="mode-btn-dropdown-wrapper" ref={exportDropdownRef}>
                <button
                  type="button"
                  className={`mode-btn ${exportDropdownOpen ? 'active' : ''}`}
                  onClick={() => { setExportDropdownOpen(v => !v); setImportDropdownOpen(false); }}
                >
                  Export ▾
                </button>
                {exportDropdownOpen && (
                  <div className="mode-btn-dropdown">
                    <button type="button" className="mode-btn-dropdown-item" onClick={() => handleExportChoice('test-definition')}>
                      <span className="mode-btn-dropdown-label">Test Definition</span>
                      <span className="mode-btn-dropdown-desc">Save test configuration as .json</span>
                    </button>
                    <button type="button" className="mode-btn-dropdown-item" onClick={() => handleExportChoice('excel-template')}>
                      <span className="mode-btn-dropdown-label">Excel Template</span>
                      <span className="mode-btn-dropdown-desc">Structured .xlsx with metadata and data rows</span>
                    </button>
                    <button type="button" className="mode-btn-dropdown-item" disabled={!draft.dataSource} onClick={() => handleExportChoice('data-csv')}>
                      <span className="mode-btn-dropdown-label">Data as CSV</span>
                      <span className="mode-btn-dropdown-desc">Export Data Source rows as .csv</span>
                    </button>
                    <button type="button" className="mode-btn-dropdown-item" disabled={!draft.dataSource} onClick={() => handleExportChoice('data-json')}>
                      <span className="mode-btn-dropdown-label">Data as JSON</span>
                      <span className="mode-btn-dropdown-desc">Export Data Source rows as .json</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button type="button" className="btn" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={!draft.name.trim() || !draft.url.trim()}>Save</button>
          </>
        }
      >

        {inputMode === 'curlImport' && (
          <div className="curl-mode-panel">
            <label>Paste your cURL command</label>
            <textarea
              rows={10}
              autoFocus
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              placeholder={`curl -X POST https://api.example.com/data \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token123' \\
  -d '{"key": "value"}'`}
            />
            <div className="curl-actions">
              <button type="button" className="btn btn-primary" disabled={!curlText.trim()} onClick={handleCurlImport}>
                Import &amp; Switch to Builder
              </button>
            </div>
            {draft.url && (
              <div className="curl-preview">
                <strong>Current test:</strong> {draft.method} {draft.url}
              </div>
            )}
          </div>
        )}

        {inputMode === 'curlExport' && (
          <div className="curl-mode-panel">
            <label>Generated cURL command</label>
            {draft.url.trim() ? (
              <>
                <textarea
                  rows={12}
                  readOnly
                  value={curlGenerating ? 'Generating cURL (acquiring token)...' : generatedCurl}
                  className="curl-export-textarea"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <div className="curl-actions">
                  <button type="button" className="btn btn-primary" disabled={curlGenerating || !generatedCurl} onClick={() => {
                    void navigator.clipboard.writeText(generatedCurl);
                  }}>Copy to Clipboard</button>
                  <button type="button" className="btn" disabled={curlGenerating} onClick={() => void triggerCurlGeneration()}>
                    {curlGenerating ? 'Generating...' : 'Refresh'}
                  </button>
                </div>
                {resolveEffectiveAuth().auth.type === 'oauth2' && !curlGenerating && (
                  <div className="curl-preview">
                    <strong>Note:</strong> The OAuth2 token above is a real token acquired from the token endpoint. It may expire — click <strong>Refresh</strong> to get a new one.
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">Configure the test URL in the Builder first to generate a cURL command.</div>
            )}
          </div>
        )}

        {inputMode === 'builder' && (
          <div className="builder-panel">
            <div className="form-row">
              <label>Name</label>
              <input value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} placeholder="e.g. Get User Profile" />
            </div>

            <div className="url-bar">
              <select
                className={`method-select method-color-${draft.method.toLowerCase()}`}
                value={draft.method}
                onChange={(e) => onDraftChange({ ...draft, method: e.target.value as Scenario['method'] })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                className="url-input"
                value={baseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                placeholder={resolvedBaseUrl ? `${resolvedBaseUrl}/...` : 'https://api.example.com/endpoint'}
              />
              {resolvedBaseUrl && !draft.url && (
                <button type="button" className="btn btn-sm url-fill-btn" onClick={() => handleBaseUrlChange(resolvedBaseUrl)} title="Use resolved base URL">Use</button>
              )}
            </div>

            {draft.url && (
              <div className="url-preview">
                <span className="url-preview-label">URL PREVIEW</span>
                <code>{displayUrl}</code>
              </div>
            )}

            <div className="builder-tabs">
              <button type="button" className={`builder-tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => onActiveTabChange('params')}>
                Params {paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
              </button>
              {draft.method !== 'GET' && (
                <button type="button" className={`builder-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => onActiveTabChange('body')}>
                  Body {(draft.body || (draft.bodyForm ?? []).some(kv => kv.key.trim())) ? <span className="tab-badge-dot" /> : null}
                </button>
              )}
              <button type="button" className={`builder-tab ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => onActiveTabChange('auth')}>
                Auth {draft.auth.type !== 'none' && <span className="tab-badge-dot" />}
              </button>
              <button type="button" className={`builder-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => onActiveTabChange('headers')}>
                Headers {headerCount > 0 && <span className="tab-badge">{headerCount}</span>}
              </button>
              {!(draft.dataSource?.columns.some(c => c.type === 'validate')) && (
                <button type="button" className={`builder-tab ${activeTab === 'validation' ? 'active' : ''}`} onClick={() => onActiveTabChange('validation')}>
                  Validation {(draft.validation.mode === 'selective' || (draft.validation.mode === 'full' && !!draft.validation.expectedJson?.trim()) || (draft.validation.assertions?.length ?? 0) > 0) && <span className="tab-badge-dot" />}
                </button>
              )}
              {!(draft.dataSource?.columns.some(c => c.type === 'validate')) && (
                <button type="button" className={`builder-tab ${activeTab === 'extract' ? 'active' : ''}`} onClick={() => onActiveTabChange('extract')}>
                  Extract {(draft.extractions?.length ?? 0) > 0 && <span className="tab-badge">{draft.extractions!.length}</span>}
                </button>
              )}
              {!draft.dataSource && (
                <button type="button" className={`builder-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => onActiveTabChange('data')}>
                  Parameterize
                </button>
              )}
              {draft.dataSource && (
                <button type="button" className={`builder-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => onActiveTabChange('data')}>
                  Data Source {(draft.dataSource.rows.filter(r => r.enabled).length ?? 0) > 0 && <span className="tab-badge">{draft.dataSource.rows.filter(r => r.enabled).length}</span>}
                </button>
              )}
              {!isNew && (
                <button type="button" className={`builder-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => onActiveTabChange('history')}>
                  History {defVersionCount > 0 && <span className="tab-badge">{defVersionCount}</span>}
                </button>
              )}
            </div>

            <div className="builder-tab-content">
              {activeTab === 'params' && (
                <ParamsEditor params={queryParams} onChange={handleParamsChange} onImportFromUrl={handleImportFromUrl} />
              )}

              {activeTab === 'body' && draft.method !== 'GET' && (
                <BodyEditor draft={draft} onDraftChange={onDraftChange} />
              )}

              {activeTab === 'auth' && (
                <TestEditorAuthTab
                  draft={draft}
                  onDraftChange={onDraftChange}
                  featureGroups={featureGroups}
                  editingTest={editingTest}
                  allAuthProfiles={allAuthProfiles}
                  verifyAuth={verifyAuth}
                  resolveEffectiveAuth={resolveEffectiveAuth}
                  authVerifying={authVerifying}
                  authVerifyResult={authVerifyResult}
                  setAuthVerifyResult={setAuthVerifyResult}
                  showSecret={showSecret}
                  setShowSecret={setShowSecret}
                />
              )}

              {activeTab === 'headers' && (
                <div className="kv-section">
                  <div className="kv-header">
                    <span>REQUEST HEADERS</span>
                  </div>
                  {draft.headers.map((h: KeyValue, i: number) => (
                    <div key={i} className="kv-row">
                      <input value={h.key} onChange={(e) => updateHeader(i, 'key', e.target.value)} placeholder="Header name" />
                      <input value={h.value} onChange={(e) => updateHeader(i, 'value', e.target.value)} placeholder="Header value" />
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => removeHeader(i)}>×</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={addHeader}>+ Add</button>
                </div>
              )}

              {activeTab === 'validation' && (
                <TestEditorValidationTab
                  draft={draft}
                  onDraftChange={onDraftChange}
                  draftRef={draftRef}
                  resolvedBaseUrl={resolvedBaseUrl}
                  fetchingResponse={fetchingResponse}
                  fetchError={fetchError}
                  fetchHostOverride={fetchHostOverride}
                  setFetchHostOverride={setFetchHostOverride}
                  fetchHostEnabled={fetchHostEnabled}
                  setFetchHostEnabled={setFetchHostEnabled}
                  onFetchSampleResponse={handleFetchSampleResponse}
                  validating={validating}
                  validationResult={validationResult}
                  setValidationResult={setValidationResult}
                  onValidateResponse={handleValidateResponse}
                  pendingFetchResponse={pendingFetchResponse}
                  onFetchKeepRules={handleFetchKeepRules}
                  onFetchReplaceAll={handleFetchReplaceAll}
                  onFetchCancel={handleFetchCancel}
                />
              )}

              {activeTab === 'extract' && (
                <ExtractionEditor
                  extractions={draft.extractions ?? []}
                  onChange={(extractions) => onDraftChange({ ...draft, extractions })}
                  sampleResponseBody={
                    (draft.validation.sampleJson && draft.validation.sampleJson.trim())
                      ? draft.validation.sampleJson
                      : validationResult?.responseJson
                  }
                  fetchSample={{
                    onFetch: handleFetchSampleResponse,
                    fetching: fetchingResponse,
                    error: fetchError,
                    host: {
                      enabled: fetchHostEnabled,
                      setEnabled: setFetchHostEnabled,
                      override: fetchHostOverride,
                      setOverride: setFetchHostOverride,
                      resolvedBaseUrl,
                    },
                  }}
                />
              )}

              {activeTab === 'data' && (
                <DataSourceEditor
                  draft={draft}
                  onDraftChange={onDraftChange}
                  onFetchRow={handleFetchRow}
                  onCreateParameterizedCopy={onCreateParameterizedCopy}
                  featureGroups={featureGroups}
                  editingTest={editingTest}
                  sharedDataSources={sharedDataSources}
                  onPromoteToShared={onPromoteToShared}
                  onOpenSharedDsModal={onOpenSharedDsModal}
                />
              )}

              {activeTab === 'history' && (
                <TestDefinitionVersionPanel
                  versions={defVersions}
                  currentSnapshot={createSnapshot(draft)}
                  onRestore={onVersionRestore}
                  onDelete={onVersionDelete}
                  onRename={onVersionRename}
                  onCompare={(older, newer) => setDiffVersions({ older, newer })}
                />
              )}
            </div>
          </div>
        )}
      </WorkflowEditorModalFrame>

      {diffVersions && (
        <TestDefinitionVersionDiff
          open
          older={diffVersions.older}
          newer={diffVersions.newer}
          onClose={() => setDiffVersions(null)}
        />
      )}

      {csvExportOpen && (
        <DataSourceSetupModal
          test={draft}
          mode="export"
          onApply={(dataTable, _urlTemplate) => {
            onDraftChange({ ...draftRef.current, dataSource: dataTable });
          }}
          onClose={() => setCsvExportOpen(false)}
        />
      )}
    </>
  );
}
