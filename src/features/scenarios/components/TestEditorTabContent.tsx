import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  Scenario,
  FeatureGroup,
  KeyValue,
  GlobalAuthProfile,
  SharedDataSource,
  DataSource,
  AuthConfig,
  TestDefinitionVersion,
} from '../../../shared/types';
import type { AuthVerifyResult } from '../../requests/hooks/useAuthVerify';
import type { FetchErrorDetail } from '../../../shared/components/data-mapper/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { BodyEditor } from '../../requests/components/BodyEditor';
import { ParamsEditor, type ParamEntry } from '../../requests/components/ParamsEditor';
import TestEditorAuthTab from './TestEditorAuthTab';
import TestEditorValidationTab, { type TestEditorValidationTabProps } from './TestEditorValidationTab';
import ExtractionEditor from '../../requests/components/ExtractionEditor';
import DataSourceEditor from './DataSourceEditor';
import TestDefinitionVersionPanel from './TestDefinitionVersionPanel';
import { createSnapshot } from '../utils/testDefinitionVersioning';
import type { TestEditorTab, TestEditingContext } from './TestEditorModal';

export interface TestEditorTabContentProps {
  activeTab: TestEditorTab;
  isHttp: boolean;
  isWs: boolean;
  queryParams: ParamEntry[];
  handleParamsChange: (entries: ParamEntry[]) => void;
  handleImportFromUrl: () => void;
  draft: Scenario;
  onDraftChange: (draft: Scenario) => void;
  featureGroups: FeatureGroup[];
  editingTest: TestEditingContext;
  allAuthProfiles: GlobalAuthProfile[];
  verifyAuth: (auth: AuthConfig) => void | Promise<void>;
  resolveEffectiveAuth: () => { auth: AuthConfig; source: string };
  authVerifying: boolean;
  authVerifyResult: AuthVerifyResult | null;
  setAuthVerifyResult: (v: AuthVerifyResult | null) => void;
  showSecret: boolean;
  setShowSecret: Dispatch<SetStateAction<boolean>>;
  updateHeader: (index: number, field: 'key' | 'value', val: string) => void;
  addHeader: () => void;
  removeHeader: (index: number) => void;
  draftRef: MutableRefObject<Scenario>;
  resolvedBaseUrl: string;
  fetchingResponse: boolean;
  fetchError: FetchErrorDetail | null;
  fetchHostOverride: string;
  setFetchHostOverride: (value: string) => void;
  fetchHostEnabled: boolean;
  setFetchHostEnabled: (enabled: boolean) => void;
  handleFetchSampleResponse: TestEditorValidationTabProps['onFetchSampleResponse'];
  fetchSampleDataForMapper: TestEditorValidationTabProps['fetchSampleDataForMapper'];
  validating: boolean;
  validationResult: TestEditorValidationTabProps['validationResult'];
  setValidationResult: TestEditorValidationTabProps['setValidationResult'];
  handleValidateResponse: TestEditorValidationTabProps['onValidateResponse'];
  pendingFetchResponse: TestEditorValidationTabProps['pendingFetchResponse'];
  handleFetchKeepRules: TestEditorValidationTabProps['onFetchKeepRules'];
  handleFetchReplaceAll: TestEditorValidationTabProps['onFetchReplaceAll'];
  handleFetchCancel: TestEditorValidationTabProps['onFetchCancel'];
  handleFetchRow: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
  onCreateParameterizedCopy?: (copy: Scenario, targetFgId?: string, targetScenarioId?: string) => void;
  sharedDataSources?: SharedDataSource[];
  onPromoteToShared?: (
    dataSource: DataSource,
    name: string,
    tags?: string[],
    fetchConfig?: { url: string; method: string; headers: KeyValue[]; auth?: AuthConfig }
  ) => string;
  onOpenSharedDsModal?: () => void;
  openSetupModalOnMount?: boolean;
  defVersions: TestDefinitionVersion[];
  onVersionRestore: (version: TestDefinitionVersion) => void;
  onVersionDelete: (versionId: string) => void;
  onVersionRename: (versionId: string, label: string) => void;
  setDiffVersions: (versions: { older: TestDefinitionVersion; newer: TestDefinitionVersion } | null) => void;
}

export default function TestEditorTabContent({
  activeTab,
  isHttp,
  isWs,
  queryParams,
  handleParamsChange,
  handleImportFromUrl,
  draft,
  onDraftChange,
  featureGroups,
  editingTest,
  allAuthProfiles,
  verifyAuth,
  resolveEffectiveAuth,
  authVerifying,
  authVerifyResult,
  setAuthVerifyResult,
  showSecret,
  setShowSecret,
  updateHeader,
  addHeader,
  removeHeader,
  draftRef,
  resolvedBaseUrl,
  fetchingResponse,
  fetchError,
  fetchHostOverride,
  setFetchHostOverride,
  fetchHostEnabled,
  setFetchHostEnabled,
  handleFetchSampleResponse,
  fetchSampleDataForMapper,
  validating,
  validationResult,
  setValidationResult,
  handleValidateResponse,
  pendingFetchResponse,
  handleFetchKeepRules,
  handleFetchReplaceAll,
  handleFetchCancel,
  handleFetchRow,
  onCreateParameterizedCopy,
  sharedDataSources,
  onPromoteToShared,
  onOpenSharedDsModal,
  openSetupModalOnMount,
  defVersions,
  onVersionRestore,
  onVersionDelete,
  onVersionRename,
  setDiffVersions,
}: TestEditorTabContentProps) {
  return (
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
          openSetupModalOnMount={openSetupModalOnMount}
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
  );
}
