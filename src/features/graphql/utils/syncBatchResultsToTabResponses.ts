import type { GraphqlBatchResult, GraphqlResponse } from '../../../shared/types/graphql';
import type { ExecutionStatus } from '../hooks/useGraphqlExecution';
import type { GqlStudioTab } from './tabPersistence';

/** Maps a GraphQL HTTP response to the studio execution status badge semantics. */
export function deriveExecutionStatusFromGraphqlResponse(response: GraphqlResponse): ExecutionStatus {
  if (response.httpStatus >= 400 || response.httpStatus === 0) return 'error';
  const hasErrors = (response.errors?.length ?? 0) > 0;
  const hasData = response.data !== null && response.data !== undefined;
  if (hasErrors && !hasData) return 'error';
  return 'success';
}

export interface BatchTabResponseSync {
  tabId: string;
  status: ExecutionStatus;
  response: GraphqlResponse;
}

/** Aligns batch operation results with the batched studio tabs (index order). */
export function buildBatchTabResponseSyncs(
  batchedTabs: GqlStudioTab[],
  batchResult: GraphqlBatchResult,
): BatchTabResponseSync[] {
  const syncs: BatchTabResponseSync[] = [];
  for (let index = 0; index < batchResult.results.length; index += 1) {
    const tab = batchedTabs[index];
    const op = batchResult.results[index];
    if (!tab || !op) continue;
    syncs.push({
      tabId: tab.id,
      status: deriveExecutionStatusFromGraphqlResponse(op.response),
      response: op.response,
    });
  }
  return syncs;
}

export interface BatchTabResponseSyncHandlers {
  cacheExecutionResult: (
    tabId: string,
    status: ExecutionStatus,
    response: GraphqlResponse | null,
  ) => void;
  applyTabResult: (
    tabId: string,
    status: ExecutionStatus,
    response: GraphqlResponse | null,
  ) => void;
}

/** Pushes batch results into per-tab execution hooks and the response-pane cache. */
export function applyBatchTabResponseSyncs(
  syncs: BatchTabResponseSync[],
  handlers: BatchTabResponseSyncHandlers,
): void {
  for (const { tabId, status, response } of syncs) {
    handlers.cacheExecutionResult(tabId, status, response);
    handlers.applyTabResult(tabId, status, response);
  }
}

export function syncBatchResultsToTabResponses(
  batchedTabs: GqlStudioTab[],
  batchResult: GraphqlBatchResult,
  handlers: BatchTabResponseSyncHandlers,
): void {
  applyBatchTabResponseSyncs(buildBatchTabResponseSyncs(batchedTabs, batchResult), handlers);
}
