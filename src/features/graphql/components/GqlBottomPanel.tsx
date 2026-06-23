/**
 * GqlBottomPanel.tsx — the bottom panel (Variables / Headers / Auth / Files tabs) in GraphQL Studio.
 *
 * Extracted from GraphqlStudioPage.tsx.
 * Phase 2.0 Sprint 4: added "Files" tab for multipart file upload (2E-1).
 * Phase 6H Slice 7.3: Auth tab (Option D bottom panel).
 */

import type { GlobalAuthProfile } from '../../../shared/types';
import type { GraphqlAuth, GraphqlEnvironment, GraphqlHeaderRow } from '../../../shared/types/graphql';
import type { BottomPanelTab } from '../graphqlStudioPageTypes';
import type { GqlAuthPopoverScope } from '../utils/gqlAuthPopoverUtils';
import type { FileEntry } from '../utils/multipartBuilder';
import { GraphqlAuthPanel } from './GraphqlAuthPanel';
import { GraphqlFileUpload } from './GraphqlFileUpload';
import { GraphqlHeadersPanel } from './GraphqlHeadersPanel';
import { GraphqlVariablesPanel } from './GraphqlVariablesPanel';

interface GqlBottomPanelProps {
  activeTab: BottomPanelTab;
  onTabChange: (tab: BottomPanelTab) => void;
  varsModelPath: string;
  defaultVarsValue: string;
  onVariablesChange: (v: string) => void;
  varsError: string | null;
  headers: GraphqlHeaderRow[];
  onHeadersChange: (headers: GraphqlHeaderRow[]) => void;
  activeEnvironment?: GraphqlEnvironment | null;
  globalEnvMap?: Record<string, string>;
  fileEntries: FileEntry[];
  onFileEntriesChange: (entries: FileEntry[]) => void;
  maxFileSizeMb?: number;
  /** Sprint 8 (2E-4): 0–100 while uploading, null when idle */
  uploadProgress?: number | null;
  /** Phase 6H Slice 7.3 — auth panel props */
  storedAuth?: GraphqlAuth | null | undefined;
  resolvedAuthPreview?: string;
  authScope?: GqlAuthPopoverScope;
  hasAuthOverride?: boolean;
  onAuthChange?: (auth: GraphqlAuth | null) => void;
  onResetAuthToInherit?: () => void;
  linkedProfileName?: string | null;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
}

export function GqlBottomPanel({
  activeTab,
  onTabChange,
  varsModelPath,
  defaultVarsValue,
  onVariablesChange,
  varsError,
  headers,
  onHeadersChange,
  activeEnvironment,
  globalEnvMap,
  fileEntries,
  onFileEntriesChange,
  maxFileSizeMb,
  uploadProgress,
  storedAuth,
  resolvedAuthPreview = '',
  authScope = 'tab',
  hasAuthOverride = false,
  onAuthChange,
  onResetAuthToInherit,
  linkedProfileName = null,
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
}: GqlBottomPanelProps) {
  const activeHeaderCount = headers.filter((h) => h.enabled).length;
  const validFileCount = fileEntries.filter((e) => e.error === null && e.varPath.trim() !== '').length;
  const hasFileErrors = fileEntries.some((e) => e.error !== null);
  const showAuthPanel = onAuthChange != null;

  return (
    <div className="gql-bottom-panel">
      <div className="gql-bottom-tabs" role="tablist" aria-label="Variables, headers, auth, and files">
        <button
          id="gql-bottom-tab-variables-btn"
          className={`gql-bottom-tab${activeTab === 'variables' ? ' gql-bottom-tab--active' : ''}${varsError ? ' gql-bottom-tab--error' : ''}`}
          role="tab"
          aria-selected={activeTab === 'variables'}
          aria-controls="gql-bottom-tabpanel"
          onClick={() => onTabChange('variables')}
          data-testid="gql-bottom-tab-variables"
          type="button"
          title={varsError ?? undefined}
        >
          Variables
          {varsError && (
            <span className="gql-bottom-tab-error-dot" aria-label="Invalid JSON" title="Invalid JSON" />
          )}
        </button>
        <button
          id="gql-bottom-tab-headers-btn"
          className={`gql-bottom-tab${activeTab === 'headers' ? ' gql-bottom-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'headers'}
          aria-controls="gql-bottom-tabpanel"
          onClick={() => onTabChange('headers')}
          data-testid="gql-bottom-tab-headers"
          type="button"
        >
          Headers
          {activeHeaderCount > 0 && (
            <span className="gql-bottom-tab-badge">{activeHeaderCount}</span>
          )}
        </button>
        {showAuthPanel && (
          <button
            id="gql-bottom-tab-auth-btn"
            className={`gql-bottom-tab${activeTab === 'auth' ? ' gql-bottom-tab--active' : ''}${hasAuthOverride ? ' gql-bottom-tab--override' : ''}`}
            role="tab"
            aria-selected={activeTab === 'auth'}
            aria-controls="gql-bottom-tabpanel"
            onClick={() => onTabChange('auth')}
            data-testid="gql-bottom-tab-auth"
            type="button"
            title={
              authScope === 'page'
                ? 'Page default auth'
                : hasAuthOverride
                  ? 'This tab overrides workspace auth'
                  : 'Inheriting workspace auth'
            }
          >
            Auth
            {hasAuthOverride && (
              <span className="gql-bottom-tab-override-dot" aria-label="Tab auth override" title="Tab auth override" />
            )}
          </button>
        )}
        <button
          id="gql-bottom-tab-files-btn"
          className={`gql-bottom-tab${activeTab === 'files' ? ' gql-bottom-tab--active' : ''}${hasFileErrors ? ' gql-bottom-tab--error' : ''}`}
          role="tab"
          aria-selected={activeTab === 'files'}
          aria-controls="gql-bottom-tabpanel"
          onClick={() => onTabChange('files')}
          data-testid="gql-bottom-tab-files"
          type="button"
          title={hasFileErrors ? 'File size errors — fix before executing' : undefined}
        >
          Files
          {validFileCount > 0 && !hasFileErrors && (
            <span className="gql-bottom-tab-badge">{validFileCount}</span>
          )}
          {hasFileErrors && (
            <span className="gql-bottom-tab-error-dot" aria-label="File errors" title="File errors" />
          )}
        </button>
      </div>

      <div
        id="gql-bottom-tabpanel"
        className="gql-bottom-content"
        role="tabpanel"
        aria-labelledby={`gql-bottom-tab-${activeTab}-btn`}
      >
        {activeTab === 'variables' && (
          <div className="gql-vars-wrapper">
            {varsError && (
              <div className="gql-vars-error-banner" role="alert" data-testid="gql-vars-error-banner">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {varsError} — fix to enable Execute
              </div>
            )}
            <GraphqlVariablesPanel
              modelPath={varsModelPath}
              defaultValue={defaultVarsValue}
              onChange={onVariablesChange}
              hasError={varsError !== null}
              height="100%"
            />
          </div>
        )}
        {activeTab === 'headers' && (
          <GraphqlHeadersPanel
            headers={headers}
            onChange={onHeadersChange}
            activeEnvironment={activeEnvironment}
            globalEnvMap={globalEnvMap}
          />
        )}
        {activeTab === 'auth' && showAuthPanel && (
          <GraphqlAuthPanel
            storedAuth={storedAuth}
            resolvedPreview={resolvedAuthPreview}
            authScope={authScope}
            hasAuthOverride={hasAuthOverride}
            onResetToInherit={onResetAuthToInherit}
            onChange={onAuthChange}
            linkedProfileName={linkedProfileName}
            globalAuthProfiles={globalAuthProfiles}
            defaultAuthProfileId={defaultAuthProfileId}
          />
        )}
        {activeTab === 'files' && (
          <GraphqlFileUpload
            entries={fileEntries}
            onEntriesChange={onFileEntriesChange}
            maxFileSizeMb={maxFileSizeMb}
            uploadProgress={uploadProgress}
          />
        )}
      </div>

      {uploadProgress != null && activeTab !== 'files' && (
        <div className="gql-file-progress gql-file-progress--banner" data-testid="gql-files-progress-banner" role="status">
          <div
            className="gql-file-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress}
          >
            <div
              className={`gql-file-progress-fill${uploadProgress === 0 ? ' gql-file-progress-fill--indeterminate' : ''}`}
              style={uploadProgress === 0 ? undefined : { width: `${uploadProgress}%` }}
            />
          </div>
          <span className="gql-file-progress-label">
            {uploadProgress === 0
              ? 'Uploading files…'
              : uploadProgress < 98
                ? `Uploading files… ${uploadProgress}%`
                : 'Processing upload…'}
          </span>
        </div>
      )}
    </div>
  );
}
