import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Scenario, FeatureGroup, KeyValue, GlobalAuthProfile, SharedDataSource, DataSource, AuthConfig, ScenarioActionType } from '../../../shared/types';
import { isWsActionType } from '../../../shared/types';
import { parseCurl } from '../../../shared/utils/curlParser';
import { buildCurlCommand } from '../../../shared/utils/curlGenerator';
import {
  getBaseUrl,
  parseQueryParams,
  rebuildUrl,
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
import DataSourceSetupModal from './DataSourceSetupModal';
import TestEditorAuthTab from './TestEditorAuthTab';
import TestEditorValidationTab from './TestEditorValidationTab';
import { TestEditorTabs } from './TestEditorTabs';
import ExtractionEditor from '../../requests/components/ExtractionEditor';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import DataSourceEditor from './DataSourceEditor';
import type { ImportChoice, ExportChoice } from './ImportExportChoiceModal';
import WsScenarioEditor from './WsScenarioEditor';
import {
  createDefaultWsConnectAction,
  createDefaultWsSendAction,
  createDefaultWsReceiveAction,
} from '../../../shared/utils/wsScenarioDefaults';
import { makeDefaultGrpcHarnessCallAction } from '../../../shared/utils/grpcHarnessScenarioContracts';
import {
  createTestEditorExportHandler,
  createTestEditorImportHandler,
} from '../utils/testEditorModalImportExport';

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
  scenarioKind?: import('../../../shared/types').ScenarioKind;
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
  scenarioKind,
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
    fetchSampleDataForMapper,
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

  const effectiveTransport: ScenarioActionType = draft.actionType ?? 'http';
  const isHttp = effectiveTransport === 'http';
  const isWs = isWsActionType(effectiveTransport);
  const isKafka = effectiveTransport === 'kafkaProduce' || effectiveTransport === 'kafkaConsume';
  const isGrpc = effectiveTransport === 'grpcCall';

  const siblingTests = useMemo(() => {
    const fg = featureGroups.find((g) => g.id === editingTest.fgId);
    if (!fg) return [];
    const sc = fg.scenarios.find((s) => s.id === editingTest.scenarioId);
    return sc?.tests ?? [];
  }, [featureGroups, editingTest.fgId, editingTest.scenarioId]);

  const handleTransportChange = useCallback((actionType: ScenarioActionType) => {
    const cur = draftRef.current;
    if ((cur.actionType ?? 'http') === actionType) return;
    const patch: Partial<Scenario> = {
      actionType: actionType === 'http' ? undefined : actionType,
      wsConnectAction: undefined,
      wsSendAction: undefined,
      wsReceiveAction: undefined,
      kafkaProduceAction: undefined,
      kafkaConsumeAction: undefined,
      grpcCallAction: undefined,
    };
    if (actionType === 'http') {
      patch.method = 'GET';
    } else if (isWsActionType(actionType)) {
      patch.method = 'WEBSOCKET';
      if (actionType === 'wsConnect') patch.wsConnectAction = createDefaultWsConnectAction();
      else if (actionType === 'wsSend') patch.wsSendAction = createDefaultWsSendAction();
      else if (actionType === 'wsReceive') patch.wsReceiveAction = createDefaultWsReceiveAction();
    } else if (actionType === 'grpcCall') {
      patch.method = 'GRPC';
      patch.grpcCallAction = makeDefaultGrpcHarnessCallAction();
    } else if (actionType === 'kafkaProduce' || actionType === 'kafkaConsume') {
      patch.method = 'KAFKA';
    }
    if (isWsActionType(actionType) && cur.extractions?.some(e => e.source !== 'body')) {
      patch.extractions = cur.extractions.filter(e => e.source === 'body');
    }
    onDraftChange({ ...cur, ...patch });
    if (actionType !== 'http' && inputMode !== 'builder') {
      onInputModeChange('builder');
    }
    // Switch away from HTTP-only tabs (extract is shared by HTTP and WS)
    const httpOnlyTabs: TestEditorTab[] = ['params', 'body', 'auth', 'headers'];
    if (actionType !== 'http' && httpOnlyTabs.includes(activeTab)) {
      onActiveTabChange('validation');
    }
    if (!isWsActionType(actionType) && actionType !== 'http' && activeTab === 'extract') {
      onActiveTabChange('validation');
    }
  }, [onDraftChange, inputMode, onInputModeChange, activeTab, onActiveTabChange]);

  const canSave = useMemo(() => {
    if (!draft.name.trim()) return false;
    if (isHttp) return !!draft.url.trim();
    if (isWs) {
      if (effectiveTransport === 'wsConnect') return !!(draft.wsConnectAction?.url?.trim());
      if (effectiveTransport === 'wsSend') return !!(draft.wsSendAction?.connectionRef?.trim());
      if (effectiveTransport === 'wsReceive') {
        if (!draft.wsReceiveAction?.connectionRef?.trim()) return false;
        const mc = draft.wsReceiveAction?.matchCriteria;
        if (mc?.jsonPathValue !== undefined && !mc?.jsonPathMatch) return false;
        return true;
      }
      return true;
    }
    return true;
  }, [draft, isHttp, isWs, effectiveTransport]);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps -- factory returns a stable handler; deps listed explicitly
  const importHandler = useCallback(
    createTestEditorImportHandler({
      draftRef,
      onDraftChange,
      syncParamsFromUrl,
      inputMode,
      onInputModeChange,
      onActiveTabChange,
      toast,
    }),
    [onDraftChange, syncParamsFromUrl, inputMode, onInputModeChange, onActiveTabChange, toast],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- factory returns a stable handler; deps listed explicitly
  const exportHandler = useCallback(
    createTestEditorExportHandler({
      draftRef,
      onExportTest,
      setCsvExportOpen,
    }),
    [onExportTest],
  );

  const handleImportChoice = useCallback((choice: ImportChoice) => {
    setImportDropdownOpen(false);
    importHandler(choice);
  }, [importHandler]);

  const handleExportChoice = useCallback((choice: ExportChoice) => {
    setExportDropdownOpen(false);
    exportHandler(choice);
  }, [exportHandler]);

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
              {isHttp && (
                <button type="button" className={`mode-btn ${inputMode === 'curlImport' ? 'active' : ''}`} onClick={() => onInputModeChange('curlImport')}>cURL Import</button>
              )}
              {isHttp && (
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
              )}
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
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={!canSave}>Save</button>
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

            <div className="form-row form-row--transport">
              <label>Transport</label>
              <select
                value={effectiveTransport}
                onChange={(e) => handleTransportChange(e.target.value as ScenarioActionType)}
                className="transport-select"
                aria-label="Transport type"
              >
                <optgroup label="HTTP">
                  <option value="http">HTTP</option>
                </optgroup>
                <optgroup label="WebSocket">
                  <option value="wsConnect">WS Connect</option>
                  <option value="wsSend">WS Send</option>
                  <option value="wsReceive">WS Receive</option>
                </optgroup>
                <optgroup label="Kafka">
                  <option value="kafkaProduce">Kafka Produce</option>
                  <option value="kafkaConsume">Kafka Consume</option>
                </optgroup>
              </select>
            </div>

            {isHttp && (
              <>
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
              </>
            )}

            {isWs && (
              <WsScenarioEditor
                draft={draft}
                onDraftChange={onDraftChange}
                resolvedBaseUrl={resolvedBaseUrl}
                siblingTests={siblingTests}
              />
            )}

            {isKafka && (
              <div className="kafka-editor-placeholder">
                <p>Kafka scenario editor is planned for a future phase. Configure Kafka actions via JSON import or the data model.</p>
              </div>
            )}

            {isGrpc && (
              <div className="kafka-editor-placeholder">
                <p>gRPC harness scenario editor is planned for a future phase. Configure gRPC calls via JSON import.</p>
              </div>
            )}

            <TestEditorTabs
              isHttp={isHttp}
              isWs={isWs}
              draft={draft}
              activeTab={activeTab}
              onActiveTabChange={onActiveTabChange}
              paramCount={paramCount}
              headerCount={headerCount}
              scenarioKind={scenarioKind}
              isNew={isNew}
              defVersionCount={defVersionCount}
            />

            <div className="builder-tab-content">
              {activeTab === 'params' && isHttp && (
                <ParamsEditor params={queryParams} onChange={handleParamsChange} onImportFromUrl={handleImportFromUrl} />
              )}

              {activeTab === 'body' && isHttp && draft.method !== 'GET' && (
                <BodyEditor draft={draft} onDraftChange={onDraftChange} />
              )}

              {activeTab === 'auth' && isHttp && (
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

              {activeTab === 'headers' && isHttp && (
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
                  fetchSampleDataForMapper={fetchSampleDataForMapper}
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

              {activeTab === 'extract' && isHttp && (
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
                  contextScope={draft.id}
                />
              )}

              {activeTab === 'extract' && isWs && (
                <ExtractionEditor
                  extractions={draft.extractions ?? []}
                  onChange={(extractions) => onDraftChange({ ...draft, extractions })}
                  sampleResponseBody={
                    (draft.validation.sampleJson && draft.validation.sampleJson.trim())
                      ? draft.validation.sampleJson
                      : validationResult?.responseJson
                  }
                  contextScope={draft.id}
                  transportType="ws"
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
