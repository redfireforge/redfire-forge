/**
 * Response pane display state — overlays batch-loading on the active tab pane.
 */
import type { GraphqlResponse } from '@shared/types/graphql';

export type StudioExecStatus = 'idle' | 'loading' | 'success' | 'error';

export interface StudioResponsePaneState {
  response: GraphqlResponse | null;
  execStatus: StudioExecStatus;
  executing: boolean;
}

export function resolveStudioResponsePaneState(
  base: StudioResponsePaneState,
  batchExecuting: boolean,
  activeTabId: string | null,
  batchedTabIdsSet: Set<string>,
): StudioResponsePaneState {
  const isBatchingActiveTab =
    batchExecuting && activeTabId != null && batchedTabIdsSet.has(activeTabId);
  if (isBatchingActiveTab) {
    return { response: null, execStatus: 'loading', executing: true };
  }
  return base;
}
