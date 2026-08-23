/**
 * Handler for HTTP nodes in the workflow graph.
 */
import type { WorkflowNode, HttpNodeData, NodeRunStatus } from '../types/workflow';
import type { Scenario, AssertionResult } from '@shared/types';
import type { NodeHandlerContext, PassedFlag, CapturedHttpNodeDetails } from './graphRunnerNodeHandlerContext';
import { executeHttpNode, logHttpResult } from './graphRunnerHelpers';
import { formatHttpNodeRunDetail, summarizeRequestFailure } from '../utils/workflowRunErrors';
import { humanizeError } from '@shared/utils/helpers';
import { expandDataSource } from '@engine/core/dataSourceExpander';
import { captureMappingTraces, shouldCaptureMappingTraces } from '@shared/components/data-mapper/utils/mappingTrace';
import { resolveTraceLevel } from './graphRunnerTraceLevel';

/** Maximum response body size to capture (100KB) */
const MAX_RESPONSE_BODY_SIZE = 102400;

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
      if (hCtx.abortSignal?.aborted) break;
      hCtx.log({ prefix: '>', text: `[${hCtx.nodeLabel(nodeId)}] ${expanded.dataRowLabel ?? 'row'}: ${expanded.method} request...` });
      const expandedData: HttpNodeData = { ...httpData, scenario: expanded };
      const dsPerNodeTimeoutMs = typeof httpData.timeoutSec === 'number' && httpData.timeoutSec > 0
        ? httpData.timeoutSec * 1000
        : hCtx.httpTimeoutMs;
      const result = await executeHttpNode(
        expandedData,
        hCtx.ctx,
        hCtx.tokenManager,
        nodeId,
        hCtx.initialVariables,
        hCtx.resolveHttpBaseUrl,
        hCtx.resolveHttpAuth,
        dsPerNodeTimeoutMs,
        hCtx.abortSignal,
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
  const perNodeTimeoutMs = typeof httpData.timeoutSec === 'number' && httpData.timeoutSec > 0
    ? httpData.timeoutSec * 1000
    : hCtx.httpTimeoutMs;
  const result = await executeHttpNode(
    httpData,
    hCtx.ctx,
    hCtx.tokenManager,
    nodeId,
    hCtx.initialVariables,
    hCtx.resolveHttpBaseUrl,
    hCtx.resolveHttpAuth,
    perNodeTimeoutMs,
    hCtx.abortSignal,
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

  // Capture full trace data if enabled (or if failed and alwaysCaptureFailures is true)
  const shouldCaptureFullTrace = hCtx.traceOptions?.captureFullTrace || 
    (hCtx.traceOptions?.alwaysCaptureFailures && !result.requestResult.passed);
  
  if (shouldCaptureFullTrace && hCtx.capturedHttpDetails) {
    const maxBodySize = hCtx.traceOptions?.maxResponseBodySize ?? MAX_RESPONSE_BODY_SIZE;
    const responseBody = result.fullResponseBody;
    const bodyTruncated = responseBody.length > maxBodySize;
    
    const captured: CapturedHttpNodeDetails = {
      request: {
        method: result.requestResult.method,
        url: result.requestResult.url,
        headers: result.requestHeaders,
        bodyTemplate: httpData.scenario?.body,
        bodyResolved: result.requestBody,
      },
      response: {
        statusCode: result.requestResult.httpStatus,
        statusText: result.requestResult.httpStatus?.toString(),
        headers: result.responseHeaders,
        body: bodyTruncated ? responseBody.slice(0, maxBodySize) : responseBody,
        bodyTruncated,
      },
      assertions: buildAssertionResults(result.requestResult),
      variablesSnapshot: hCtx.ctx.snapshot(),
      extractedVariables: Object.keys(result.extracted).length > 0 ? result.extracted : undefined,
    };

    // Capture mapping traces at full/debug level when body extraction mappings exist
    const traceLevel = resolveTraceLevel(hCtx.traceOptions);
    if (shouldCaptureMappingTraces(traceLevel) && httpData.scenario?.extractions?.length) {
      const extractionSource = {
        id: 'response',
        label: 'Response',
        sampleData: responseBody,
      };
      const extractionMappings = httpData.scenario.extractions
        .filter((e) => e.source === 'body' && !!e.expression)
        .map((e, i) => ({
          id: `ext-${nodeId}-${i}`,
          sourcePath: e.expression,
          sourceId: 'response',
          targetPath: e.name,
        }));
      if (extractionMappings.length > 0) {
        captured.mappingTraces = captureMappingTraces({
          mappings: extractionMappings,
          sources: [extractionSource],
          activeSourceId: 'response',
        });
      }
    }

    hCtx.capturedHttpDetails.set(nodeId, captured);
  }

  hCtx.callbacks.onNodeStateChange(nodeId, status);
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

/**
 * Build assertion results from RequestResult for trace capture.
 */
function buildAssertionResults(requestResult: import('../../../shared/types').RequestResult): AssertionResult[] {
  const results: AssertionResult[] = [];
  
  // Status assertion (implicit)
  if (requestResult.httpStatus !== undefined) {
    results.push({
      type: 'status',
      description: `Status code is ${requestResult.httpStatus}`,
      passed: requestResult.passed || requestResult.failureDetails?.every(f => f.path !== '(status)' && f.path !== '(http)') !== false,
      expected: requestResult.httpStatus?.toString(),
      actual: requestResult.httpStatus?.toString(),
    });
  }
  
  // Failure details become failed assertions
  if (requestResult.failureDetails) {
    for (const failure of requestResult.failureDetails) {
      results.push({
        type: 'validation',
        description: `${failure.path}`,
        passed: false,
        expected: failure.expected,
        actual: failure.actual,
      });
    }
  }
  
  return results;
}
