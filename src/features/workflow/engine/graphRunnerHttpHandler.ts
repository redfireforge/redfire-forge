/**
 * Handler for HTTP nodes in the workflow graph.
 */
import type { WorkflowNode, HttpNodeData, NodeRunStatus } from '../types/workflow';
import type { Scenario } from '../../../shared/types';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import { executeHttpNode, logHttpResult } from './graphRunnerHelpers';
import { formatHttpNodeRunDetail, summarizeRequestFailure } from '../utils/workflowRunErrors';
import { humanizeError } from '../../../shared/utils/helpers';
import { expandDataSource } from '../../../engine/dataSourceExpander';

export async function handleHttpNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const httpData = node.data as HttpNodeData;
  const dataSource = httpData.dataSource ?? httpData.scenario?.dataSource;
  const enabledRows = dataSource?.rows?.filter(r => r.enabled) ?? [];

  // ── Data-source expansion: execute once per enabled row ──
  if (dataSource && dataSource.columns.length > 0 && enabledRows.length > 0) {
    hCtx.log({ prefix: '>', text: `[${hCtx.nodeLabel(nodeId)}] Expanding data source → ${enabledRows.length} row(s)` });
    const baseScenario: Scenario = { ...httpData.scenario, dataSource };
    const expandedScenarios = expandDataSource(baseScenario);

    let anyFailed = false;
    for (const expanded of expandedScenarios) {
      hCtx.log({ prefix: '>', text: `[${hCtx.nodeLabel(nodeId)}] ${expanded.dataRowLabel ?? 'row'}: ${expanded.method} request...` });
      const expandedData: HttpNodeData = { ...httpData, scenario: expanded };
      const result = await executeHttpNode(
        expandedData,
        hCtx.ctx,
        hCtx.tokenManager,
        nodeId,
        hCtx.initialVariables,
        hCtx.resolveHttpBaseUrl,
        hCtx.resolveHttpAuth,
      );
      hCtx.results.push(result.requestResult);
      if (!result.requestResult.passed) {
        anyFailed = true;
        passed.value = false;
      }
      logHttpResult(hCtx.nodeLabel(nodeId), hCtx.log, result);
    }

    const state = anyFailed ? 'fail' : 'pass';
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state,
      statusCode: undefined,
      responseTimeMs: undefined,
    });
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // ── Single request (no data source) ──
  hCtx.log({ prefix: '>', text: `[${hCtx.nodeLabel(nodeId)}] ${httpData.scenario?.method ?? 'GET'} request...` });
  const result = await executeHttpNode(
    httpData,
    hCtx.ctx,
    hCtx.tokenManager,
    nodeId,
    hCtx.initialVariables,
    hCtx.resolveHttpBaseUrl,
    hCtx.resolveHttpAuth,
  );
  hCtx.results.push(result.requestResult);

  const status: NodeRunStatus = {
    state: result.requestResult.passed ? 'pass' : 'fail',
    statusCode: result.requestResult.httpStatus,
    responseTimeMs: result.requestResult.responseTimeMs,
    extracted: result.extracted,
    error: result.requestResult.passed ? undefined : summarizeRequestFailure(result.requestResult),
    responseDetail: formatHttpNodeRunDetail(result.requestResult, { fullResponseBody: result.fullResponseBody }),
  };
  if (!result.requestResult.passed) passed.value = false;

  logHttpResult(hCtx.nodeLabel(nodeId), hCtx.log, result);

  if (!result.requestResult.passed && !result.requestResult.failureDetails?.length) {
    hCtx.log({ prefix: '!', text: `[${hCtx.nodeLabel(nodeId)}] ${humanizeError(status.error ?? 'request failed')}` });
  }
  hCtx.callbacks.onNodeStateChange(nodeId, status);
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}
