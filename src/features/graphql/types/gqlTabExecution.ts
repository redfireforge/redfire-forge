import type { GraphqlResponse } from '../../../shared/types/graphql';
import type {
  ApqInfo,
  ExecuteParams,
  ExecutionStatus,
  UseGraphqlExecution,
} from '../hooks/useGraphqlExecution';
import type { DedupChoice } from '../utils/dedupExecution';

export interface GqlTabExecutionState {
  status: ExecutionStatus;
  response: GraphqlResponse | null;
  apqInfo: ApqInfo | null;
  isDuplicate: boolean;
  duplicateSourceTabId: string | null;
}

export const IDLE_GQL_TAB_EXECUTION_STATE: GqlTabExecutionState = {
  status: 'idle',
  response: null,
  apqInfo: null,
  isDuplicate: false,
  duplicateSourceTabId: null,
};

/** Imperative API for a per-tab GraphQL execution hook instance (Phase 6E). */
export interface GqlTabExecutionHandle {
  execute: (params: ExecuteParams) => void;
  cancel: UseGraphqlExecution['cancel'];
  resolveDedupChoice: (choice: DedupChoice) => void;
  getState: () => GqlTabExecutionState;
}
