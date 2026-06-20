/**
 * GqlRightPane.tsx — the right-side pane (Response / Schema tabs) in GraphQL Studio.
 *
 * Extracted from GraphqlStudioPage.tsx.
 *
 * Phase 2.0 Sprint 2: Subscription log integrated — replaces the subscription hint
 * and response viewer when a subscription session is active.
 */

import type {
  GraphqlResponse,
  GraphqlSchemaInfo,
  GraphqlSchemaSnapshot,
  GraphqlSubscriptionAssertion,
  GraphqlSubscriptionMessage,
  SubscriptionState,
  SubscriptionStats,
} from '../../../shared/types/graphql';
import type { DeprecatedFieldUsage } from '../utils/deprecatedFieldScanner';
import { GraphqlResponseViewer } from './GraphqlResponseViewer';
import { GraphqlSchemaExplorer } from './GraphqlSchemaExplorer';
import { GraphqlSubscriptionLog } from './GraphqlSubscriptionLog';
import type { MessageAssertionResults } from '../utils/subscriptionAssertions';
import { useEffect, useRef, useState } from 'react';

const MAX_LATENCY_HISTORY = 50;

type RightPaneView = 'response' | 'schema';

/** Props bundle for the subscription log panel (Sprint 2). */
export interface SubscriptionLogProps {
  state: SubscriptionState;
  messages: GraphqlSubscriptionMessage[];
  stats: SubscriptionStats;
  connectedSince: number;
  isPaused: boolean;
  pausedBufferCount: number;
  errorMessage?: string | null;
  reconnectAttempt?: number;
  transport?: 'graphql-transport-ws' | 'graphql-ws' | 'sse' | null;
  operationName?: string;
  /** Sprint 8 (2C-5): assertion definitions */
  assertions?: GraphqlSubscriptionAssertion[];
  /** Sprint 8 (2C-5): pre-computed results keyed by message ID */
  assertionResultMap?: Map<string, MessageAssertionResults>;
  onPause(): void;
  onResume(): void;
  onClear(): void;
  onExport(): void;
  onStop(): void;
}

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
  /** Active tab's operation type — used to route between response viewer and subscription log. */
  activeOperationType?: 'query' | 'mutation' | 'subscription' | null;
  /**
   * Sprint 2: when present (non-null state !== 'idle'), shows the subscription log
   * in the response pane instead of the response viewer or hint.
   */
  subscriptionLog?: SubscriptionLogProps | null;
  /** Optional: insert a field into the active query editor (powers "Try →" in schema explorer) */
  onInsertField?: (fieldName: string, fieldType: string, hasArgs: boolean) => void;
  // 3D-2: schema snapshot / changelog props
  snapshots?: GraphqlSchemaSnapshot[];
  onSaveSnapshot?: () => Promise<void>;
  onDeleteSnapshot?: (id: string) => void;
  onOpenDiff?: (snapshot: GraphqlSchemaSnapshot, compareToId?: string) => void;
  // 3D-7: deprecated field usages
  deprecatedUsages?: DeprecatedFieldUsage[];
  onOpenCollectionItem?: (itemId: string) => void;
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
  activeOperationType,
  subscriptionLog,
  onInsertField,
  snapshots,
  onSaveSnapshot,
  onDeleteSnapshot,
  onOpenDiff,
  deprecatedUsages,
  onOpenCollectionItem,
}: GqlRightPaneProps) {
  const hasErrors = !!(response?.errors?.length);
  const hasData = response?.data != null;
  const isPartialSuccess = hasErrors && hasData;

  // Accumulate latency history (capped at MAX_LATENCY_HISTORY) across tab switches.
  // Tracks the last-seen response timestamp to avoid double-counting on re-render.
  const latencyHistoryRef   = useRef<number[]>([]);
  const lastTimestampRef    = useRef<number | undefined>(undefined);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!response || response.latencyMs == null) return;
    if (response.timestamp === lastTimestampRef.current) return;
    lastTimestampRef.current = response.timestamp;
    const next = [...latencyHistoryRef.current, response.latencyMs];
    if (next.length > MAX_LATENCY_HISTORY) next.splice(0, next.length - MAX_LATENCY_HISTORY);
    latencyHistoryRef.current = next;
    setLatencyHistory(next);
  }, [response]);

  // Show subscription log when there is an active session (state !== 'idle').
  // The log stays visible after the subscription ends (closed/error) so the user
  // can read the final messages and error detail.
  const showSubscriptionLog =
    activeOperationType === 'subscription' &&
    subscriptionLog != null &&
    subscriptionLog.state !== 'idle';

  // Show the subscription hint when idle with no active session.
  // Note: response === null is NOT required — a stale HTTP response from a previous
  // query/mutation is irrelevant for subscription tabs and should not replace the hint.
  const showSubscriptionHint =
    activeOperationType === 'subscription' &&
    !showSubscriptionLog &&
    execStatus === 'idle' &&
    !executing;

  // Response tab badge for subscription sessions.
  // 'paused' → green (still live, user manually paused buffering)
  // 'closing' → amber connecting (transitioning state, same as connecting/reconnecting)
  const subLogBadge = showSubscriptionLog
    ? (subscriptionLog.state === 'active'        ? 'active' :
       subscriptionLog.state === 'paused'        ? 'active' :
       subscriptionLog.state === 'connecting'    ? 'connecting' :
       subscriptionLog.state === 'reconnecting'  ? 'connecting' :
       subscriptionLog.state === 'closing'       ? 'connecting' :
       subscriptionLog.state === 'error'         ? 'error' :
       subscriptionLog.state === 'closed'        ? 'ok' : null)
    : null;

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
          {activeOperationType === 'subscription' ? 'Stream' : 'Response'}
          {/* Query/mutation response badges */}
          {!showSubscriptionLog && execStatus === 'success' && !executing && isPartialSuccess && (
            <span className="gql-right-tab-badge gql-right-tab-badge--warn" aria-label="Partial success with errors" />
          )}
          {!showSubscriptionLog && execStatus === 'success' && !executing && !isPartialSuccess && (
            <span className="gql-right-tab-badge gql-right-tab-badge--ok" aria-hidden="true" />
          )}
          {!showSubscriptionLog && execStatus === 'error' && !executing && (
            <span className="gql-right-tab-badge gql-right-tab-badge--error" aria-label="Execution error" />
          )}
          {/* Subscription log state badges */}
          {subLogBadge === 'active' && (
            <span className="gql-right-tab-badge gql-right-tab-badge--ok" aria-hidden="true" />
          )}
          {subLogBadge === 'connecting' && (
            <span className="gql-right-tab-badge gql-right-tab-badge--connecting" aria-label="Connecting" />
          )}
          {subLogBadge === 'ok' && (
            <span className="gql-right-tab-badge gql-right-tab-badge--ok" aria-hidden="true" />
          )}
          {subLogBadge === 'error' && (
            <span className="gql-right-tab-badge gql-right-tab-badge--error" aria-label="Subscription error" />
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
        {/* Sprint 2: live subscription log */}
        {view === 'response' && showSubscriptionLog && subscriptionLog && (
          <GraphqlSubscriptionLog
            state={subscriptionLog.state}
            messages={subscriptionLog.messages}
            stats={subscriptionLog.stats}
            connectedSince={subscriptionLog.connectedSince}
            isPaused={subscriptionLog.isPaused}
            pausedBufferCount={subscriptionLog.pausedBufferCount}
            errorMessage={subscriptionLog.errorMessage}
            reconnectAttempt={subscriptionLog.reconnectAttempt}
            transport={subscriptionLog.transport}
            operationName={subscriptionLog.operationName}
            assertions={subscriptionLog.assertions}
            assertionResultMap={subscriptionLog.assertionResultMap}
            onPause={subscriptionLog.onPause}
            onResume={subscriptionLog.onResume}
            onClear={subscriptionLog.onClear}
            onExport={subscriptionLog.onExport}
            onStop={subscriptionLog.onStop}
          />
        )}

        {/* Subscription idle hint (no active session yet) */}
        {view === 'response' && showSubscriptionHint && (
          <div className="gql-subscription-hint" data-testid="gql-subscription-hint">
            <div className="gql-subscription-hint-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <p className="gql-subscription-hint-title">Subscription operation</p>
            <p className="gql-subscription-hint-body">
              Click{' '}
              <strong>Subscribe</strong>
              {' '}to open a real-time connection and start receiving events.
            </p>
            <p className="gql-subscription-hint-footer">
              Supports{' '}
              <strong>graphql-transport-ws</strong>
              {', '}
              <strong>graphql-ws</strong>
              {', and '}
              <strong>SSE</strong>
              {' '}transports — select the transport in the connection bar.
            </p>
          </div>
        )}

        {/* Query/mutation response viewer */}
        {view === 'response' && !showSubscriptionLog && !showSubscriptionHint && (
          <GraphqlResponseViewer response={response} loading={executing} latencyHistory={latencyHistory} />
        )}

        {view === 'schema' && (
          <GraphqlSchemaExplorer
            schemaInfo={schemaInfo}
            status={schemaStatus}
            errorMessage={schemaErrorMessage}
            onIntrospect={onIntrospect}
            introspecting={introspecting}
            onInsertField={onInsertField}
            snapshots={snapshots}
            onSaveSnapshot={onSaveSnapshot}
            onDeleteSnapshot={onDeleteSnapshot}
            onOpenDiff={onOpenDiff}
            deprecatedUsages={deprecatedUsages ?? []}
            onOpenCollectionItem={onOpenCollectionItem}
          />
        )}
      </div>
    </div>
  );
}
