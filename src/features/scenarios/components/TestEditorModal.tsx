import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Scenario, FeatureGroup, KeyValue, GlobalAuthProfile, SharedDataSource, DataSource, AuthConfig, ScenarioActionType } from '@shared/types';
import { isWsActionType } from '@shared/types';
import { parseCurl } from '@shared/utils/curlParser';
import { buildCurlCommand } from '@shared/utils/curlGenerator';
import { parseQueryParams, rebuildUrl } from '../utils/testEditorUtils';
import { toErrorMessage, formatJson } from '@shared/utils/helpers';
import type { VersionExportOptions } from '../utils/scenarioImportExport';
import TestDefinitionVersionDiff from './TestDefinitionVersionDiff';
import { toParamEntries, fromParamEntries, type ParamEntry } from '../../requests/components/ParamsEditor';
import { useToast } from '@shared/hooks/useToast';
import { useAuthVerify } from '../../requests/hooks/useAuthVerify';
import { useTestFetch } from '../hooks/useTestFetch';
import DataSourceSetupModal from './DataSourceSetupModal';
import { TestEditorTabs } from './TestEditorTabs';
import TestEditorPropertyCard from './TestEditorPropertyCard';
import TestEditorTabContent from './TestEditorTabContent';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import type { ImportChoice, ExportChoice } from './ImportExportChoiceModal';
import TestEditorModalHeaderActions from './TestEditorModalHeaderActions';
import WsScenarioEditor from './WsScenarioEditor';
import { createDefaultWsConnectAction, createDefaultWsSendAction, createDefaultWsReceiveAction } from '@shared/utils/wsScenarioDefaults';
import { makeDefaultGrpcHarnessCallAction } from '@shared/utils/grpcHarnessScenarioContracts';
import { createTestEditorExportHandler, createTestEditorImportHandler } from '../utils/testEditorModalImportExport';

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
  onCreateParameterizedCopy?: (copy: Scenario, targetFgId?: string, targetScenarioId?: string, newScenarioName?: string) => void;
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
  /** When true at mount, immediately switches to the Data tab and opens the setup/parameterize wizard */
  initialOpenDataSourceWizard?: boolean;
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
  initialOpenDataSourceWizard,
}: TestEditorModalProps) {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const toast = useToast();

  // Seeds the Data tab's setup modal open on mount (from the shared-DS "Create + Open Parameterize Wizard"
  // flow), or imperatively via the header "Parameterize" shortcut. Reset shortly after the Data tab is
  // showing so revisiting the tab later doesn't reopen the wizard.
  const [openDataSetupOnMount, setOpenDataSetupOnMount] = useState(() => !!initialOpenDataSourceWizard);
  useEffect(() => {
    if (activeTab !== 'data' || !openDataSetupOnMount) return;
    const t = setTimeout(() => setOpenDataSetupOnMount(false), 0);
    return () => clearTimeout(t);
  }, [activeTab, openDataSetupOnMount]);
  const handleOpenParameterizeWizard = useCallback(() => {
    // Must leave cURL Import/Export view — builder is the only mode that
    // renders the Data / Parameterize tab content.
    onInputModeChange('builder');
    setOpenDataSetupOnMount(true);
    onActiveTabChange('data');
  }, [onInputModeChange, onActiveTabChange]);
  const canParameterize = !isNew && !!onCreateParameterizedCopy && !draft.dataSource && !draft.sharedDataSourceId;

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
      const kv = fromParamEntries(entries);
      const patch: Partial<Scenario> = { url: rebuildUrl(cur.url, kv) };
      // Keep the parameterized urlTemplate (used for the URL Preview and runs)
      // in sync so query params added here are reflected everywhere.
      if (cur.dataSource?.urlTemplate) {
        patch.dataSource = { ...cur.dataSource, urlTemplate: rebuildUrl(cur.dataSource.urlTemplate, kv) };
      }
      onDraftChange({ ...cur, ...patch });
    }
  }, [onDraftChange]);

  const handleImportFromUrl = useCallback(() => {
    const cur = draftRef.current;
    // Prefer the live URL (incl. query). For parameterized tests, urlTemplate may carry ?params.
    const sourceUrl = cur.dataSource?.urlTemplate?.trim() || cur.url;
    setQueryParams(toParamEntries(parseQueryParams(sourceUrl)));
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
    // If the user typed/pasted a query string, keep it — do not clobber with the params table.
    // Path/host-only edits still preserve existing query params via rebuildUrl.
    const typedHasQuery = newBaseUrl.includes('?');
    const enabledParams = fromParamEntries(queryParams);
    const newUrl = typedHasQuery || enabledParams.length === 0
      ? newBaseUrl
      : rebuildUrl(newBaseUrl, enabledParams);
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
    // Pretty-print JSON bodies so the Body tab is readable after import
    let body = parsed.body ?? '';
    if ((parsed.bodyType === 'json' || (!parsed.bodyType && body.trim().startsWith('{'))) && body.trim()) {
      const pretty = formatJson(body);
      if (pretty) body = pretty;
    }
    onDraftChange({ ...cur, ...parsedWithoutId, body, validation: cur.validation });
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
  const [transportDropOpen, setTransportDropOpen] = useState(false);
  const [methodDropOpen, setMethodDropOpen] = useState(false);
  const transportDropRef = useRef<HTMLDivElement>(null);
  const methodDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (transportDropRef.current && !transportDropRef.current.contains(e.target as Node)) setTransportDropOpen(false);
      if (methodDropRef.current && !methodDropRef.current.contains(e.target as Node)) setMethodDropOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      // Start with the template path (already has path {{variables}})
      const base = dt.urlTemplate.split('?')[0];
      const paramCols = dt.columns.filter(c => c.type === 'param');
      const colKeys = new Set(paramCols.map(c => c.mapping));
      // Preserve manual query params from BOTH the template and the live URL
      // (the Params tab edits draft.url, which may be ahead of the template),
      // skipping any that are backed by a param column.
      const queryOf = (u: string) => (u.split('?')[1] ?? '').split('&').filter(Boolean);
      const seen = new Set<string>();
      const manual: string[] = [];
      for (const pair of [...queryOf(dt.urlTemplate), ...queryOf(draft.url)]) {
        const key = pair.split('=')[0];
        if (!key || colKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        manual.push(pair);
      }
      const parts = [
        ...manual,
        ...paramCols.map(c => `${c.mapping}={{${c.mapping}}}`),
      ];
      return parts.length > 0 ? `${base}?${parts.join('&')}` : base;
    }
    return draft.url;
  }, [draft.dataSource, draft.url]);

  // Show the full URL (including ?query) in the editor so "Import from URL" has something to parse
  // and pasted query strings remain visible. Params table stays the structured editor for the same data.
  const baseUrl = displayUrl;

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
        overlayClassName="rf-builder-overlay"
        dialogClassName="rf-builder-modal"
        expandMode="fullscreen"
        minWidth={640}
        minHeight={420}
        constrainDragToViewport
        dragViewportPadding={8}
        headerActions={
          <TestEditorModalHeaderActions
            inputMode={inputMode}
            onInputModeChange={onInputModeChange}
            isHttp={isHttp}
            triggerCurlGeneration={() => {
              void triggerCurlGeneration();
            }}
            importDropdownOpen={importDropdownOpen}
            setImportDropdownOpen={setImportDropdownOpen}
            exportDropdownOpen={exportDropdownOpen}
            setExportDropdownOpen={setExportDropdownOpen}
            importDropdownRef={importDropdownRef}
            exportDropdownRef={exportDropdownRef}
            hasDataSource={!!draft.dataSource}
            onImportChoice={handleImportChoice}
            onExportChoice={handleExportChoice}
            onCancel={onCancel}
            onSave={onSave}
            canSave={canSave}
            canParameterize={canParameterize}
            onOpenParameterizeWizard={handleOpenParameterizeWizard}
          />
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
            <TestEditorPropertyCard
              draft={draft}
              onDraftChange={onDraftChange}
              effectiveTransport={effectiveTransport}
              isHttp={isHttp}
              transportDropOpen={transportDropOpen}
              setTransportDropOpen={setTransportDropOpen}
              transportDropRef={transportDropRef}
              handleTransportChange={handleTransportChange}
              methodDropOpen={methodDropOpen}
              setMethodDropOpen={setMethodDropOpen}
              methodDropRef={methodDropRef}
              baseUrl={baseUrl}
              handleBaseUrlChange={handleBaseUrlChange}
              resolvedBaseUrl={resolvedBaseUrl}
              displayUrl={displayUrl}
            />

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

            <TestEditorTabContent
              activeTab={activeTab}
              isHttp={isHttp}
              isWs={isWs}
              queryParams={queryParams}
              handleParamsChange={handleParamsChange}
              handleImportFromUrl={handleImportFromUrl}
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
              updateHeader={updateHeader}
              addHeader={addHeader}
              removeHeader={removeHeader}
              draftRef={draftRef}
              resolvedBaseUrl={resolvedBaseUrl}
              fetchingResponse={fetchingResponse}
              fetchError={fetchError}
              fetchHostOverride={fetchHostOverride}
              setFetchHostOverride={setFetchHostOverride}
              fetchHostEnabled={fetchHostEnabled}
              setFetchHostEnabled={setFetchHostEnabled}
              handleFetchSampleResponse={handleFetchSampleResponse}
              fetchSampleDataForMapper={fetchSampleDataForMapper}
              validating={validating}
              validationResult={validationResult}
              setValidationResult={setValidationResult}
              handleValidateResponse={handleValidateResponse}
              pendingFetchResponse={pendingFetchResponse}
              handleFetchKeepRules={handleFetchKeepRules}
              handleFetchReplaceAll={handleFetchReplaceAll}
              handleFetchCancel={handleFetchCancel}
              handleFetchRow={handleFetchRow}
              onCreateParameterizedCopy={onCreateParameterizedCopy}
              sharedDataSources={sharedDataSources}
              onPromoteToShared={onPromoteToShared}
              onOpenSharedDsModal={onOpenSharedDsModal}
              openSetupModalOnMount={openDataSetupOnMount}
              defVersions={defVersions}
              onVersionRestore={onVersionRestore}
              onVersionDelete={onVersionDelete}
              onVersionRename={onVersionRename}
              setDiffVersions={setDiffVersions}
            />
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
