import type { GraphqlResponse } from '../../../shared/types/graphql';
import type { ApqInfo, ExecuteParams, ExecutionStatus } from '../hooks/useGraphqlExecution';

/** Notify studio layer of a terminal execution result for the request's owning tab. */
export function notifyExecutionCompleted(
  params: Pick<ExecuteParams, 'sourceTabId' | 'onExecutionCompleted'>,
  status: ExecutionStatus,
  response: GraphqlResponse | null,
  apqInfo?: ApqInfo | null,
): void {
  const { sourceTabId, onExecutionCompleted } = params;
  if (sourceTabId && onExecutionCompleted) {
    onExecutionCompleted(sourceTabId, status, response, apqInfo);
  }
}
