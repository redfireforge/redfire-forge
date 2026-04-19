import type { WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData, DelayNodeData, NodeRunStatus } from '../../types/workflow';
import type { RequestResult, Scenario } from '../../types';
import { httpFetch } from '../../utils/httpClient';
import { serializeWithContentType } from '../../utils/bodySerializer';
import { buildHeaders, buildUrl } from '../executor';
import { validate, evaluateAssertions } from '../validator';
import { TokenManager } from '../tokenManager';
import { VariableContext } from './variableContext';
import { resolveScenario } from './resolveScenario';
import { extractVariables, type ResponseData } from './extractVariables';
import { v4 as uuidv4 } from 'uuid';

export interface GraphRunCallbacks {
  onNodeStateChange: (nodeId: string, status: NodeRunStatus) => void;
  onVariablesChange: (variables: Record<string, string>) => void;
  onComplete: (results: RequestResult[], passed: boolean, durationMs: number) => void;
}

/**
 * Execute a workflow graph with topological traversal.
 * Handles HTTP nodes, Condition branching, and Delay nodes.
 * Calls back for canvas animation and variable updates.
 */
export async function runGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  initialVariables: Record<string, string>,
  callbacks: GraphRunCallbacks,
  abortSignal?: AbortSignal,
): Promise<RequestResult[]> {
  const start = performance.now();
  const ctx = new VariableContext(initialVariables);
  const tokenManager = new TokenManager();
  const results: RequestResult[] = [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    const list = outgoing.get(e.source) ?? [];
    list.push(e);
    outgoing.set(e.source, list);
  }

  const startNodes = findStartNodes(nodes, edges);
  if (startNodes.length === 0) {
    callbacks.onComplete([], true, 0);
    return [];
  }

  for (const node of nodes) {
    callbacks.onNodeStateChange(node.id, { state: 'pending' });
  }

  let allPassed = true;
  const visited = new Set<string>();

  async function visit(nodeId: string): Promise<void> {
    if (visited.has(nodeId) || abortSignal?.aborted) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    callbacks.onNodeStateChange(nodeId, { state: 'running' });

    try {
      if (node.type === 'http') {
        const result = await executeHttpNode(node.data as HttpNodeData, ctx, tokenManager);
        results.push(result.requestResult);

        const status: NodeRunStatus = {
          state: result.requestResult.passed ? 'pass' : 'fail',
          statusCode: result.requestResult.httpStatus,
          responseTimeMs: result.requestResult.responseTimeMs,
          extracted: result.extracted,
        };
        if (!result.requestResult.passed) allPassed = false;
        callbacks.onNodeStateChange(nodeId, status);
        callbacks.onVariablesChange(ctx.snapshot());

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target);
        }

      } else if (node.type === 'condition') {
        const data = node.data as ConditionNodeData;
        const condResult = evaluateCondition(data, ctx);
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        const matchEdge = nextEdges.find(e =>
          condResult ? (e.sourceHandle === 'true' || e.label === 'Yes') : (e.sourceHandle === 'false' || e.label === 'No')
        );

        const skipEdge = nextEdges.find(e =>
          condResult ? (e.sourceHandle === 'false' || e.label === 'No') : (e.sourceHandle === 'true' || e.label === 'Yes')
        );
        if (skipEdge) markSubtreeSkipped(skipEdge.target, outgoing, nodeMap, visited, callbacks);

        if (matchEdge) await visit(matchEdge.target);

      } else if (node.type === 'delay') {
        const data = node.data as DelayNodeData;
        const ms = data.mode === 'random'
          ? (data.minMs ?? 0) + Math.random() * ((data.maxMs ?? data.delayMs) - (data.minMs ?? 0))
          : data.delayMs;

        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, ms);
          if (abortSignal) {
            const onAbort = () => { clearTimeout(timer); resolve(); };
            abortSignal.addEventListener('abort', onAbort, { once: true });
          }
        });

        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target);
        }
      }
    } catch (err) {
      allPassed = false;
      callbacks.onNodeStateChange(nodeId, {
        state: 'fail',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const startNode of startNodes) {
    if (abortSignal?.aborted) break;
    await visit(startNode.id);
  }

  const durationMs = Math.round(performance.now() - start);
  callbacks.onComplete(results, allPassed, durationMs);
  return results;
}

// ── Helpers ──────────────────────────────────────────

function findStartNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const targets = new Set(edges.map(e => e.target));
  return nodes.filter(n => !targets.has(n.id));
}

function markSubtreeSkipped(
  nodeId: string,
  outgoing: Map<string, WorkflowEdge[]>,
  nodeMap: Map<string, WorkflowNode>,
  visited: Set<string>,
  callbacks: GraphRunCallbacks,
) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);
  callbacks.onNodeStateChange(nodeId, { state: 'skipped' });
  const nextEdges = outgoing.get(nodeId) ?? [];
  for (const edge of nextEdges) {
    markSubtreeSkipped(edge.target, outgoing, nodeMap, visited, callbacks);
  }
}

async function executeHttpNode(
  data: HttpNodeData,
  ctx: VariableContext,
  tokenManager: TokenManager,
): Promise<{ requestResult: RequestResult; extracted: Record<string, string> }> {
  const resolved = resolveScenario(data.scenario, ctx);
  const { body: reqBody, contentType } = serializeWithContentType(resolved);
  const token = await tokenManager.getToken(resolved);
  const headers = buildHeaders(resolved, token, contentType);
  const url = buildUrl(resolved);

  const start = performance.now();
  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let errorMessage: string | undefined;

  try {
    const result = await httpFetch(url, resolved.method, headers, reqBody);
    if (result.error) {
      errorMessage = result.error;
    } else {
      httpStatus = result.status;
      responseBody = result.body;
      responseHeaders = result.headers;
      try { responseObj = JSON.parse(responseBody); } catch { responseObj = responseBody; }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;

  const assertions = resolved.validation.assertions ?? [];
  const { failures: assertionFailures, statusAsserted } = assertions.length > 0
    ? evaluateAssertions(assertions, { httpStatus, responseTimeMs, responseHeaders, responseBody: responseObj })
    : { failures: [], statusAsserted: false };

  const httpOk = httpStatus > 0 && httpStatus < 400;
  const statusOk = statusAsserted ? assertionFailures.every(f => f.path !== '(status)') : httpOk;
  const jsonFailures = resolved.validation.mode !== 'none' && statusOk ? validate(resolved.validation, responseObj) : [];
  let failureDetails = [...assertionFailures, ...jsonFailures];

  const httpFailed = !statusAsserted && (httpStatus >= 400 || httpStatus === 0);
  if (httpFailed && errorMessage) {
    failureDetails = [{ path: '(http)', expected: '2xx', actual: errorMessage }, ...assertionFailures];
  }

  const networkError = httpStatus === 0 && !statusAsserted;
  const passed = !networkError && failureDetails.length === 0;

  let extracted: Record<string, string> = {};
  if (data.scenario.extractions?.length) {
    const responseData: ResponseData = { status: httpStatus, headers: responseHeaders, body: responseObj };
    extracted = extractVariables(data.scenario.extractions, responseData, ctx);
  }

  const requestResult: RequestResult = {
    id: uuidv4(),
    scenarioId: data.scenario.id,
    scenarioName: data.scenario.name || data.label,
    featureGroupName: data.scenario.featureGroupName,
    groupName: data.scenario.groupName,
    url: resolved.url,
    method: resolved.method,
    httpStatus,
    responseTimeMs,
    responseBody: responseBody.slice(0, 2000),
    timestamp: Date.now(),
    passed,
    validationMode: resolved.validation.mode,
    failureDetails,
    errorMessage,
  };

  return { requestResult, extracted };
}

function evaluateCondition(data: ConditionNodeData, ctx: VariableContext): boolean {
  const left = ctx.resolve(data.left);
  const right = ctx.resolve(data.right);

  switch (data.operator) {
    case '==': return left === right;
    case '!=': return left !== right;
    case '>': return parseFloat(left) > parseFloat(right);
    case '<': return parseFloat(left) < parseFloat(right);
    case '>=': return parseFloat(left) >= parseFloat(right);
    case '<=': return parseFloat(left) <= parseFloat(right);
    case 'contains': return left.includes(right);
    case 'not-contains': return !left.includes(right);
    case 'regex': try { return new RegExp(right).test(left); } catch { return false; }
    default: return false;
  }
}
