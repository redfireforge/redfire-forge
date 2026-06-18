/**
 * GqlBottomPanel.tsx — the bottom panel (Variables / Headers tabs) in GraphQL Studio.
 *
 * Extracted from GraphqlStudioPage.tsx.
 */

import type { GraphqlEnvironment, GraphqlHeaderRow } from '../../../shared/types/graphql';
import { GraphqlHeadersPanel } from './GraphqlHeadersPanel';
import { GraphqlVariablesPanel } from './GraphqlVariablesPanel';

type BottomPanelTab = 'variables' | 'headers';

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
}: GqlBottomPanelProps) {
  const activeHeaderCount = headers.filter((h) => h.enabled).length;

  return (
    <div className="gql-bottom-panel">
      <div className="gql-bottom-tabs" role="tablist" aria-label="Variables and headers">
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
          />
        )}
      </div>
    </div>
  );
}
