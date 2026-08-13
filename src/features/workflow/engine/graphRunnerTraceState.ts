import type { RequestResult } from '../../../shared/types';
import type { PassedFlag } from './graphRunnerNodeHandlers';

/** gRPC/API-mock nodes write explicit pass/fail entries; use their latest node result for trace state. */
export function resolveNodeTraceState(
  nodeType: string,
  nodeId: string,
  passedFlag: PassedFlag,
  results: RequestResult[],
): 'pass' | 'fail' {
  if (nodeType === 'grpcUnary' || nodeType === 'grpcServerStream' || nodeType === 'grpcAssert'
    || nodeType === 'grpcLoadTest' || nodeType === 'grpcSchemaDiff' || nodeType === 'grpcMockAssert'
    || nodeType === 'apiMockStart' || nodeType === 'apiMockApply' || nodeType === 'apiMockResetState'
    || nodeType === 'apiMockStop' || nodeType === 'apiMockAssertCalls') {
    const nodeResults = results.filter((r) => r.workflowNodeId === nodeId);
    const lastResult = nodeResults[nodeResults.length - 1];
    if (lastResult) return lastResult.passed ? 'pass' : 'fail';
  }
  return passedFlag.value ? 'pass' : 'fail';
}
