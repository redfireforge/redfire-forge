/**
 * GqlRightPane.tsx — the right-side pane (Response / Schema tabs) in GraphQL Studio.
 *
 * Extracted from GraphqlStudioPage.tsx.
 */

import type { GraphqlResponse, GraphqlSchemaInfo } from '../../../shared/types/graphql';
import { GraphqlResponseViewer } from './GraphqlResponseViewer';
import { GraphqlSchemaExplorer } from './GraphqlSchemaExplorer';

type RightPaneView = 'response' | 'schema';

interface GqlRightPaneProps {
  view: RightPaneView;
  onViewChange: (v: RightPaneView) => void;
  // Response pane
  response: GraphqlResponse | null;
  executing: boolean;
  execStatus: 'idle' | 'loading' | 'success' | 'error';
  // Schema pane
  schemaInfo: GraphqlSchemaInfo | null;
  schemaStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'introspection-disabled';
  schemaErrorMessage?: string | null;
  onIntrospect: () => void;
  introspecting: boolean;
}

export function GqlRightPane({
  view,
  onViewChange,
  response,
  executing,
  execStatus,
  schemaInfo,
  schemaStatus,
  schemaErrorMessage,
  onIntrospect,
  introspecting,
}: GqlRightPaneProps) {
  const hasErrors = !!(response?.errors?.length);
  const hasData = response?.data != null;
  const isPartialSuccess = hasErrors && hasData;

  return (
    <div className="gql-right-pane" data-testid="gql-right-pane">
      <div className="gql-right-pane-tabs" role="tablist" aria-label="Right pane view">
        <button
          id="gql-right-tab-response-btn"
          className={`gql-right-tab${view === 'response' ? ' gql-right-tab--active' : ''}`}
          role="tab"
          aria-selected={view === 'response'}
          aria-controls="gql-right-pane-tabpanel"
          onClick={() => onViewChange('response')}
          type="button"
          data-testid="gql-right-tab-response"
        >
          Response
          {execStatus === 'success' && !executing && isPartialSuccess && (
            <span className="gql-right-tab-badge gql-right-tab-badge--warn" aria-label="Partial success with errors" />
          )}
          {execStatus === 'success' && !executing && !isPartialSuccess && (
            <span className="gql-right-tab-badge gql-right-tab-badge--ok" aria-hidden="true" />
          )}
          {execStatus === 'error' && !executing && (
            <span className="gql-right-tab-badge gql-right-tab-badge--error" aria-label="Execution error" />
          )}
        </button>
        <button
          id="gql-right-tab-schema-btn"
          className={`gql-right-tab${view === 'schema' ? ' gql-right-tab--active' : ''}`}
          role="tab"
          aria-selected={view === 'schema'}
          aria-controls="gql-right-pane-tabpanel"
          onClick={() => onViewChange('schema')}
          type="button"
          data-testid="gql-right-tab-schema"
        >
          Schema
          {schemaStatus === 'loaded' && (
            <span className="gql-right-tab-badge gql-right-tab-badge--ok" aria-hidden="true" />
          )}
          {(schemaStatus === 'error' || schemaStatus === 'introspection-disabled') && (
            <span className="gql-right-tab-badge gql-right-tab-badge--error" aria-label="Schema error" />
          )}
        </button>
      </div>

      <div
        id="gql-right-pane-tabpanel"
        className="gql-right-pane-content"
        role="tabpanel"
        aria-labelledby={`gql-right-tab-${view}-btn`}
      >
        {view === 'response' && (
          <GraphqlResponseViewer response={response} loading={executing} />
        )}
        {view === 'schema' && (
          <GraphqlSchemaExplorer
            schemaInfo={schemaInfo}
            status={schemaStatus}
            errorMessage={schemaErrorMessage}
            onIntrospect={onIntrospect}
            introspecting={introspecting}
          />
        )}
      </div>
    </div>
  );
}
