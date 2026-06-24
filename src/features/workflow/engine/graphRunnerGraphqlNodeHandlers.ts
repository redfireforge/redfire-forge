/**
 * Handlers for GraphQL workflow nodes:
 *   graphqlQuery / graphqlMutation — HTTP POST via proxy
 *   graphqlSubscription            — WebSocket via proxy transport
 *   graphqlIntrospect              — HTTP introspection + schema validation
 *   graphqlAssert                  — Assert on workflow variables
 *
 * Follows the same separation pattern as graphRunnerWsNodeHandlers.ts and
 * graphRunnerKafkaNodeHandlers.ts. All handlers are re-exported through the
 * graphRunnerNodeHandlers.ts barrel and dispatched from graphRunner.ts.
 *
 * HTTP calls (query/mutation/introspect) use global `fetch` via `getProxyBase()`.
 * Subscription uses `createWsProxyTransport` from graphqlProxyTransports.ts.
 * Both are mockable in tests via vi.mock / vi.spyOn(globalThis, 'fetch').
 */

import { buildClientSchema, printSchema, isObjectType } from 'graphql';
import { INTROSPECTION_QUERY } from '../../graphql/utils/graphqlIntrospectionQuery';
import type { WorkflowNode } from '../types/workflow';
import type {
  GraphqlQueryNodeData,
  GraphqlSubscriptionNodeData,
  GraphqlIntrospectNodeData,
  GraphqlAssertNodeData,
  GraphqlNodeHeaderRow,
  GraphqlOutputBinding,
  GraphqlSubscriptionOutputBinding,
  GraphqlIntrospectOutputBinding,
} from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import type { RequestResult } from '../../../shared/types';
import { toErrorMessage } from '../../../shared/utils/helpers';
import { getByPath } from '../../../shared/utils/jsonPath';
import { nextResultId } from '../../../engine/requestExecution';
import { evaluateFieldOperator } from '../../../engine/fieldOperatorEvaluation';
import { buildAuthHeaders } from '../../graphql/utils/authUtils';
import { getProxyBase, createWsProxyTransport, createSseProxyTransport } from '../../graphql/utils/graphqlProxyTransports';
import { deriveWsEndpoint } from '../../graphql/utils/graphqlClient';
import { computeAPQHash } from '../../graphql/utils/apqClient';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import {
  buildExtractedVariableMap,
  buildGraphqlRunSnapshot,
} from '../../graphql/utils/graphqlConfigTestHelpers';
import {
  collectGraphqlBindingEntries,
  collectGraphqlNodeVariableNames,
  logGraphqlResponseData,
  logGraphqlSubscriptionMessage,
  logGraphqlVariableBindings,
  logGraphqlVariables,
  previewForConsoleLog,
} from './graphRunnerGraphqlLogHelpers';

// ── Bounded defaults ───────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;

// ── Shared helpers ─────────────────────────────────────────────────────────────

/**
 * Build the resolved HTTP headers for a GraphQL node, merging user-supplied
 * header rows with any auth headers derived from the node's auth config.
 */
function buildGraphqlHeaders(
  rows: GraphqlNodeHeaderRow[],
  auth: GraphqlAuth | undefined,
  ctx: NodeHandlerContext['ctx'],
): Record<string, string> {
  const base = Object.fromEntries(
    rows
      .filter(r => r.enabled && r.key)
      .map(r => [ctx.resolve(r.key), ctx.resolve(r.value)]),
  );
  return { ...base, ...buildAuthHeaders(auth) };
}

/**
 * Write standard GraphQL query/mutation output bindings into the variable context.
 */
function applyQueryOutputBindings(
  bindings: GraphqlOutputBinding[],
  outputs: {
    data: unknown;
    errors: unknown;
    latencyMs: number;
    httpStatus: number;
    operationName: string;
  },
  ctx: NodeHandlerContext['ctx'],
): void {
  for (const b of bindings) {
    if (!b.enabled || !b.variableName) continue;
    const v = outputs[b.field];
    const serialized =
      typeof v === 'string' ? v
        : typeof v === 'number' ? String(v)
          : JSON.stringify(v ?? '');
    ctx.set(b.variableName, serialized);
  }
}

/**
 * Write GraphQL subscription output bindings into the variable context.
 */
function applySubscriptionOutputBindings(
  bindings: GraphqlSubscriptionOutputBinding[],
  outputs: {
    messages: unknown[];
    messageCount: number;
    firstMessage: unknown;
    lastMessage: unknown;
    latencyMs: number;
  },
  ctx: NodeHandlerContext['ctx'],
): void {
  for (const b of bindings) {
    if (!b.enabled || !b.variableName) continue;
    const v = outputs[b.field];
    const serialized =
      typeof v === 'string' ? v
        : typeof v === 'number' ? String(v)
          : JSON.stringify(v ?? '');
    ctx.set(b.variableName, serialized);
  }
}

/**
 * Write GraphQL introspect output bindings into the variable context.
 */
function applyIntrospectOutputBindings(
  bindings: GraphqlIntrospectOutputBinding[],
  outputs: {
    sdl: string;
    typeCount: number;
    fieldCount: number;
    schemaHash: string;
    queryTypeName: string;
  },
  ctx: NodeHandlerContext['ctx'],
): void {
  for (const b of bindings) {
    if (!b.enabled || !b.variableName) continue;
    const v = outputs[b.field];
    ctx.set(b.variableName, typeof v === 'string' ? v : String(v));
  }
}

/** Build a RequestResult for a GraphQL node execution. */
function buildGraphqlResult(
  nodeId: string,
  label: string,
  transportType: 'graphqlQuery' | 'graphqlMutation' | 'graphqlSubscription' | 'graphqlIntrospect' | 'graphqlAssert',
  endpoint: string,
  durationMs: number,
  passed: boolean,
  httpStatus?: number,
  errorMessage?: string,
): RequestResult {
  return {
    id: nextResultId(),
    scenarioId: nodeId,
    scenarioName: label,
    url: endpoint,
    method: transportType === 'graphqlMutation' ? 'MUTATION'
      : transportType === 'graphqlSubscription' ? 'SUBSCRIBE'
      : transportType === 'graphqlIntrospect' ? 'INTROSPECT'
      : transportType === 'graphqlAssert' ? 'ASSERT'
      : 'QUERY',
    httpStatus: httpStatus ?? (passed ? 200 : 0),
    responseTimeMs: durationMs,
    responseBody: '',
    timestamp: Date.now(),
    passed,
    validationMode: 'none',
    failureDetails: [],
    workflowNodeId: nodeId,
    transportType,
    errorMessage,
  };
}

// ── graphqlQuery / graphqlMutation handler ─────────────────────────────────────

/**
 * Handles both `graphqlQuery` and `graphqlMutation` node types.
 * Sends an HTTP POST to `/api/graphql/query` via the proxy, extracts variables,
 * and applies output bindings.
 */
export async function handleGraphqlQueryNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GraphqlQueryNodeData;
  const label = hCtx.nodeLabel(nodeId);
  const isMutation = node.type === 'graphqlMutation';

  // ── Validation ──
  const rawEndpoint = data.endpoint?.trim();
  if (!rawEndpoint) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: endpoint is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Endpoint is required' });
    hCtx.results.push(buildGraphqlResult(nodeId, label, isMutation ? 'graphqlMutation' : 'graphqlQuery', '', 0, false, 0, 'Endpoint is required'));
    return;
  }
  if (!data.query?.trim()) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: query is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Query is required' });
    hCtx.results.push(buildGraphqlResult(nodeId, label, isMutation ? 'graphqlMutation' : 'graphqlQuery', rawEndpoint, 0, false, 0, 'Query is required'));
    return;
  }

  const endpoint = hCtx.ctx.resolve(rawEndpoint);
  const resolvedQuery = hCtx.ctx.resolve(data.query);
  const rawVariables = hCtx.ctx.resolve(data.variables ?? '{}');

  let parsedVariables: Record<string, unknown>;
  try {
    parsedVariables = rawVariables ? (JSON.parse(rawVariables) as Record<string, unknown>) : {};
  } catch {
    passed.value = false;
    const msg = `Invalid JSON in variables after interpolation: ${rawVariables}`;
    hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
    hCtx.results.push(buildGraphqlResult(nodeId, label, isMutation ? 'graphqlMutation' : 'graphqlQuery', endpoint, 0, false, 0, msg));
    return;
  }

  // Headers go in the body — the proxy reads `body.headers` and forwards them to upstream.
  // Do NOT pass them as HTTP-level headers on the proxy request (the proxy ignores those).
  const graphqlHeaders = buildGraphqlHeaders(data.headers ?? [], data.auth, hCtx.ctx);
  const proxyBase = getProxyBase();
  const timeoutMs = data.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // Enforce per-request timeout via AbortSignal.timeout, composed with the workflow abort signal.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const fetchSignal = hCtx.abortSignal
    ? AbortSignal.any([timeoutSignal, hCtx.abortSignal])
    : timeoutSignal;

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });
  const t0 = performance.now();
  hCtx.log({ prefix: '→', text: `[${label}] ${isMutation ? 'MUTATION' : 'QUERY'} ${endpoint}` });
  logGraphqlVariables(label, hCtx.log, parsedVariables);

  try {
    const resp = await fetch(`${proxyBase}/api/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        query: resolvedQuery,
        variables: parsedVariables,
        headers: graphqlHeaders,
        skipTlsVerify: data.skipTlsVerify,
      }),
      signal: fetchSignal,
    });

    const transportType = isMutation ? 'graphqlMutation' as const : 'graphqlQuery' as const;

    // ── Check proxy-level HTTP status first ──
    if (!resp.ok) {
      const durationMs = Math.round(performance.now() - t0);
      let proxyErrMsg = `Proxy request failed: HTTP ${resp.status}`;
      try {
        const errBody = await resp.json() as { error?: { message?: string }; message?: string };
        if (errBody?.error?.message) proxyErrMsg = errBody.error.message;
        else if (errBody?.message) proxyErrMsg = errBody.message;
      } catch { /* keep default */ }
      passed.value = false;
      hCtx.results.push(buildGraphqlResult(nodeId, label, transportType, endpoint, durationMs, false, resp.status, proxyErrMsg));
      hCtx.log({ prefix: '!', text: `[${label}] ${isMutation ? 'Mutation' : 'Query'} failed — ${durationMs}ms: ${proxyErrMsg}` });
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: proxyErrMsg });
      return;
    }

    const body = await resp.json() as { data?: unknown; errors?: unknown[] };
    const durationMs = Math.round(performance.now() - t0);
    const extracted = buildExtractedVariableMap(data.extractionRules ?? [], body.data);
    const runDetail = buildGraphqlRunSnapshot({
      data: body.data,
      errors: body.errors,
      httpStatus: resp.status,
      latencyMs: durationMs,
    });
    const runStateBase = {
      statusCode: resp.status,
      responseTimeMs: durationMs,
      extracted: Object.keys(extracted).length > 0 ? extracted : undefined,
      responseDetail: runDetail,
    };

    // ── Apply extraction rules ──
    for (const rule of data.extractionRules ?? []) {
      if (!rule.variableName?.trim() || !rule.jsonPath?.trim()) continue;
      const extractedVal = getByPath(body.data, rule.jsonPath);
      hCtx.ctx.set(rule.variableName, extractedVal === undefined ? '' : JSON.stringify(extractedVal));
    }

    // ── Apply output bindings ──
    applyQueryOutputBindings(data.outputBindings ?? [], {
      data: body.data,
      errors: body.errors,
      latencyMs: durationMs,
      httpStatus: resp.status,
      operationName: data.label ?? '',
    }, hCtx.ctx);

    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    const bindingNames = collectGraphqlNodeVariableNames(data.extractionRules, data.outputBindings);
    const bindingEntries = collectGraphqlBindingEntries(extracted, hCtx.ctx, bindingNames);

    if ((body.errors?.length ?? 0) > 0) {
      // GraphQL errors in the response — treat as failure
      const errSummary = JSON.stringify(body.errors);
      passed.value = false;
      hCtx.results.push(buildGraphqlResult(nodeId, label, transportType, endpoint, durationMs, false, resp.status, `GraphQL errors: ${errSummary}`));
      logGraphqlResponseData(label, hCtx.log, {
        httpStatus: resp.status,
        durationMs,
        data: body.data,
        errors: body.errors,
      });
      logGraphqlVariableBindings(label, hCtx.log, bindingEntries);
      hCtx.log({ prefix: '!', text: `[${label}] GraphQL errors — ${durationMs}ms: ${errSummary}` });
      hCtx.callbacks.onNodeStateChange(nodeId, {
        state: 'fail',
        error: `GraphQL errors: ${errSummary}`,
        ...runStateBase,
      });
      return;
    }

    hCtx.results.push(buildGraphqlResult(nodeId, label, transportType, endpoint, durationMs, true, resp.status));
    logGraphqlResponseData(label, hCtx.log, {
      httpStatus: resp.status,
      durationMs,
      data: body.data,
    });
    logGraphqlVariableBindings(label, hCtx.log, bindingEntries);
    hCtx.log({ prefix: '✓', text: `[${label}] ${isMutation ? 'Mutation' : 'Query'} succeeded — ${durationMs}ms` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass', ...runStateBase });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    passed.value = false;
    const msg = toErrorMessage(err);
    const transportType = isMutation ? 'graphqlMutation' as const : 'graphqlQuery' as const;
    hCtx.results.push(buildGraphqlResult(nodeId, label, transportType, endpoint, durationMs, false, 0, msg));
    hCtx.log({ prefix: '!', text: `[${label}] ${isMutation ? 'Mutation' : 'Query'} failed — ${durationMs}ms: ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}

// ── graphqlSubscription handler ────────────────────────────────────────────────

/**
 * Handles the `graphqlSubscription` node type.
 * Opens a WebSocket subscription via the proxy transport, collects messages
 * until a stop condition is met, then applies output bindings.
 */
export async function handleGraphqlSubscriptionNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GraphqlSubscriptionNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // ── Validation ──
  const rawEndpoint = data.endpoint?.trim();
  if (!rawEndpoint) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: endpoint is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Endpoint is required' });
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlSubscription', '', 0, false, 0, 'Endpoint is required'));
    return;
  }
  if (!data.subscriptionQuery?.trim()) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: subscription query is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Subscription query is required' });
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlSubscription', rawEndpoint, 0, false, 0, 'Subscription query is required'));
    return;
  }

  if (hCtx.abortSignal?.aborted) {
    passed.value = false;
    const msg = 'Aborted before subscription started';
    hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlSubscription', rawEndpoint, 0, false, 0, msg));
    return;
  }

  const endpoint = deriveWsEndpoint(hCtx.ctx.resolve(rawEndpoint));
  const resolvedSubscriptionQuery = hCtx.ctx.resolve(data.subscriptionQuery);
  const rawVariables = hCtx.ctx.resolve(data.variables ?? '{}');

  let parsedVariables: Record<string, unknown>;
  try {
    parsedVariables = rawVariables ? (JSON.parse(rawVariables) as Record<string, unknown>) : {};
  } catch {
    passed.value = false;
    const msg = `Invalid JSON in subscription variables after interpolation: ${rawVariables}`;
    hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlSubscription', endpoint, 0, false, 0, msg));
    return;
  }

  const headers = buildGraphqlHeaders(data.headers ?? [], data.auth, hCtx.ctx);
  const subprotocol: 'graphql-transport-ws' | 'graphql-ws' =
    (data.subscriptionTransport === 'graphql-ws') ? 'graphql-ws' : 'graphql-transport-ws';
  const transport = data.subscriptionTransport === 'sse'
    ? createSseProxyTransport(data.auth)
    : createWsProxyTransport(subprotocol, data.auth);

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });
  hCtx.log({ prefix: '→', text: `[${label}] SUBSCRIBE ${endpoint}` });
  logGraphqlVariables(label, hCtx.log, parsedVariables);
  if (data.stopAfterMessages) hCtx.log({ prefix: '→', text: `[${label}]   stop after ${data.stopAfterMessages} messages` });
  if (data.stopAfterMs) hCtx.log({ prefix: '→', text: `[${label}]   stop after ${data.stopAfterMs}ms` });

  const messages: unknown[] = [];
  let firstMsgLatency = -1;
  const t0 = performance.now();

  try {
    await new Promise<void>((resolve, reject) => {
      let stopTimer: ReturnType<typeof setTimeout> | null = null;
      let unsubscribe: (() => void) | null = null;

      const cleanup = () => {
        if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      };

      if (data.stopAfterMs) {
        stopTimer = setTimeout(() => { cleanup(); resolve(); }, data.stopAfterMs);
      }

      unsubscribe = transport.subscribe(
        resolvedSubscriptionQuery,
        parsedVariables,
        undefined,
        { endpoint, headers, skipTlsVerify: false, signal: hCtx.abortSignal },
        {
          onMessage(msgData: unknown) {
            if (firstMsgLatency < 0) firstMsgLatency = performance.now() - t0;
            messages.push(msgData);

            // Apply per-message extraction rules into workflow variables.
            // extractionRules.jsonPath is applied to the inner `data` object of each
            // GraphQL message (e.g. `$.field`) — consistent with query/mutation extraction
            // and the interface JSDoc ("JSONPath applied to the response `data` object").
            const msgInnerData = (msgData as { data?: unknown }).data;
            logGraphqlSubscriptionMessage(
              label,
              hCtx.log,
              messages.length - 1,
              msgInnerData ?? msgData,
            );
            for (const rule of data.extractionRules ?? []) {
              if (!rule.variableName?.trim() || !rule.jsonPath?.trim()) continue;
              const extracted = getByPath(msgInnerData, rule.jsonPath);
              hCtx.ctx.set(rule.variableName, extracted === undefined ? '' : JSON.stringify(extracted));
            }

            if (data.stopAfterMessages && messages.length >= data.stopAfterMessages) {
              cleanup(); resolve(); return;
            }
            if (data.stopCondition) {
              // stopCondition JSONPath is applied to msg.data (same root as extractionRules)
              const condMet = getByPath(msgInnerData, data.stopCondition);
              if (condMet) { cleanup(); resolve(); return; }
            }
          },
          onError(errMsg: string) { cleanup(); reject(new Error(errMsg)); },
          onComplete() { cleanup(); resolve(); },
        },
      );

      if (hCtx.abortSignal) {
        hCtx.abortSignal.addEventListener('abort', () => { cleanup(); resolve(); }, { once: true });
      }
    });

    const durationMs = Math.round(performance.now() - t0);

    applySubscriptionOutputBindings(data.outputBindings ?? [], {
      // For output bindings, expose the inner `data` of each message (same root as
      // extractionRules and stopCondition) so assertions use consistent JSONPath roots.
      messages: messages.map(m => (m as { data?: unknown }).data ?? m),
      messageCount: messages.length,
      firstMessage: (messages[0] as { data?: unknown } | undefined)?.data ?? messages[0] ?? null,
      lastMessage: (messages[messages.length - 1] as { data?: unknown } | undefined)?.data ?? messages[messages.length - 1] ?? null,
      latencyMs: firstMsgLatency >= 0 ? Math.round(firstMsgLatency) : durationMs,
    }, hCtx.ctx);

    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    const lastInnerData = messages.length > 0
      ? (messages[messages.length - 1] as { data?: unknown }).data
      : undefined;
    const extracted = buildExtractedVariableMap(data.extractionRules ?? [], lastInnerData);
    const runDetail = buildGraphqlRunSnapshot({
      subscriptionLastData: lastInnerData,
      httpStatus: 200,
      latencyMs: durationMs,
    });
    const runStateBase = {
      statusCode: 200,
      responseTimeMs: durationMs,
      extracted: Object.keys(extracted).length > 0 ? extracted : undefined,
      responseDetail: runDetail,
    };

    const bindingNames = collectGraphqlNodeVariableNames(data.extractionRules, data.outputBindings);
    logGraphqlVariableBindings(
      label,
      hCtx.log,
      collectGraphqlBindingEntries(extracted, hCtx.ctx, bindingNames),
    );
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlSubscription', endpoint, durationMs, true, 200));
    hCtx.log({ prefix: '✓', text: `[${label}] Subscription complete — ${messages.length} message(s) — ${durationMs}ms` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass', ...runStateBase });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    passed.value = false;
    const msg = toErrorMessage(err);
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlSubscription', endpoint, durationMs, false, 0, msg));
    hCtx.log({ prefix: '!', text: `[${label}] Subscription failed — ${durationMs}ms: ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}

// ── graphqlIntrospect handler ──────────────────────────────────────────────────

/**
 * Handles the `graphqlIntrospect` node type.
 * Fetches and parses the remote schema, runs optional validation rules,
 * then applies output bindings (sdl, typeCount, fieldCount, schemaHash, queryTypeName).
 */
export async function handleGraphqlIntrospectNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GraphqlIntrospectNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // ── Validation ──
  const rawEndpoint = data.endpoint?.trim();
  if (!rawEndpoint) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: endpoint is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Endpoint is required' });
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlIntrospect', '', 0, false, 0, 'Endpoint is required'));
    return;
  }

  const endpoint = hCtx.ctx.resolve(rawEndpoint);
  // Headers go in the body — the proxy reads `body.headers` and forwards them to upstream.
  const graphqlHeaders = buildGraphqlHeaders(data.headers ?? [], data.auth, hCtx.ctx);
  const proxyBase = getProxyBase();
  const timeoutMs = data.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // Enforce per-request timeout via AbortSignal.timeout, composed with the workflow abort signal.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const fetchSignal = hCtx.abortSignal
    ? AbortSignal.any([timeoutSignal, hCtx.abortSignal])
    : timeoutSignal;

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });
  const t0 = performance.now();
  hCtx.log({ prefix: '→', text: `[${label}] INTROSPECT ${endpoint}` });

  try {
    // Use /api/graphql/query with the standard introspection query.
    // There is no dedicated /api/graphql/introspect route — introspection is a
    // regular GraphQL query sent to the endpoint.
    const resp = await fetch(`${proxyBase}/api/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        query: INTROSPECTION_QUERY,
        headers: graphqlHeaders,
        skipTlsVerify: data.skipTlsVerify,
      }),
      signal: fetchSignal,
    });

    // ── Check proxy-level HTTP status first ──
    if (!resp.ok) {
      const durationMs = Math.round(performance.now() - t0);
      let proxyErrMsg = `Proxy request failed: HTTP ${resp.status}`;
      try {
        const errBody = await resp.json() as { error?: { message?: string }; message?: string };
        if (errBody?.error?.message) proxyErrMsg = errBody.error.message;
        else if (errBody?.message) proxyErrMsg = errBody.message;
      } catch { /* keep default */ }
      passed.value = false;
      hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlIntrospect', endpoint, durationMs, false, resp.status, proxyErrMsg));
      hCtx.log({ prefix: '!', text: `[${label}] ${proxyErrMsg}` });
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: proxyErrMsg });
      return;
    }

    const introspectionResult = await resp.json() as { data?: unknown; errors?: unknown[] };
    const durationMs = Math.round(performance.now() - t0);

    // Check for GraphQL errors (e.g., introspection disabled)
    if ((introspectionResult.errors?.length ?? 0) > 0 || !introspectionResult.data) {
      const errDetail = introspectionResult.errors
        ? JSON.stringify(introspectionResult.errors)
        : 'No schema data returned (introspection may be disabled)';
      const msg = `Introspection failed: ${errDetail}`;
      passed.value = false;
      hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlIntrospect', endpoint, durationMs, false, resp.status, msg));
      hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
      return;
    }

    const schema = buildClientSchema(introspectionResult.data as Parameters<typeof buildClientSchema>[0]);
    const sdl = printSchema(schema);
    const allTypes = Object.values(schema.getTypeMap()).filter(t => !t.name.startsWith('__'));
    const fieldCount = allTypes.reduce(
      (n, t) => n + (isObjectType(t) ? Object.keys(t.getFields()).length : 0),
      0,
    );
    const schemaHash = await computeAPQHash(sdl);
    const queryTypeName = schema.getQueryType()?.name ?? 'Query';

    // ── Validation rules ──
    if (data.minTypeCount != null && allTypes.length < data.minTypeCount) {
      const msg = `Schema has ${allTypes.length} types; expected ≥ ${data.minTypeCount}`;
      passed.value = false;
      hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlIntrospect', endpoint, durationMs, false, resp.status, msg));
      hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
      return;
    }
    for (const req of data.requiredTypes ?? []) {
      if (!schema.getType(req)) {
        const msg = `Required type "${req}" missing from schema`;
        passed.value = false;
        hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlIntrospect', endpoint, durationMs, false, resp.status, msg));
        hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
        hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
        return;
      }
    }
    for (const { typeName, fieldName } of data.requiredFields ?? []) {
      const t = schema.getType(typeName);
      if (!isObjectType(t) || !t.getFields()[fieldName]) {
        const msg = `Required field "${typeName}.${fieldName}" missing from schema`;
        passed.value = false;
        hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlIntrospect', endpoint, durationMs, false, resp.status, msg));
        hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
        hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
        return;
      }
    }

    // ── Apply output bindings ──
    applyIntrospectOutputBindings(data.outputBindings ?? [], {
      sdl,
      typeCount: allTypes.length,
      fieldCount,
      schemaHash,
      queryTypeName,
    }, hCtx.ctx);

    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlIntrospect', endpoint, durationMs, true, resp.status));
    hCtx.log({ prefix: '✓', text: `[${label}] Introspection succeeded — ${allTypes.length} types — ${durationMs}ms` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    passed.value = false;
    const msg = toErrorMessage(err);
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlIntrospect', endpoint, durationMs, false, 0, msg));
    hCtx.log({ prefix: '!', text: `[${label}] Introspection failed — ${durationMs}ms: ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}

// ── graphqlAssert handler ──────────────────────────────────────────────────────

/**
 * Handles the `graphqlAssert` node type.
 * Evaluates JSONPath assertions against a workflow variable and either
 * fails the workflow (failBehavior='error') or logs warnings (failBehavior='warn').
 */
export async function handleGraphqlAssertNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GraphqlAssertNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // ── Validation ──
  if (!data.sourceVariable?.trim()) {
    passed.value = false;
    const msg = 'Source variable is required';
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlAssert', '', 0, false, 0, msg));
    return;
  }

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });
  hCtx.log({ prefix: '→', text: `[${label}] ASSERT on {{${data.sourceVariable}}}` });

  const t0 = performance.now();
  const sourceVar = data.sourceVariable.trim();
  const rawSourceValue = hCtx.ctx.resolve(`{{${sourceVar}}}`);

  const failures: string[] = [];
  if (rawSourceValue === `{{${sourceVar}}}`) {
    failures.push(
      `Source variable "{{${sourceVar}}}" is not set. ` +
      `Bind an output from an upstream node (e.g. GraphQL Query → Output → latencyMs → ${sourceVar}), then Save the workflow.`,
    );
  }

  let sourceValue: unknown;
  if (failures.length === 0) {
    try {
      sourceValue = rawSourceValue ? JSON.parse(rawSourceValue) : rawSourceValue;
    } catch {
      sourceValue = rawSourceValue;
    }
  }

  for (const assertion of data.assertions ?? []) {
    if (failures.some((f) => f.includes('not set'))) break;
    const resolvedJsonPath = hCtx.ctx.resolve(assertion.jsonPath);
    const resolvedExpected = assertion.expectedValue != null
      ? hCtx.ctx.resolve(assertion.expectedValue)
      : undefined;
    const actual = getByPath(sourceValue, resolvedJsonPath);
    const result = evaluateFieldOperator(actual, assertion.operator, undefined, resolvedExpected ?? '');
    if (!result.pass) {
      const detail =
        `${resolvedJsonPath} ${assertion.operator} ${resolvedExpected ?? ''} — got ${JSON.stringify(actual)} ` +
        `(expected ${result.expected})`;
      const msg = assertion.description?.trim()
        ? `${assertion.description.trim()}\n${detail}`
        : detail;
      failures.push(msg);
    }
  }

  const durationMs = Math.round(performance.now() - t0);

  if (failures.length > 0 && data.failBehavior === 'error') {
    const errMsg = failures.join('\n');
    passed.value = false;
    hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlAssert', '', durationMs, false, 0, errMsg));
    hCtx.log({ prefix: '!', text: `[${label}] Assert failed (${failures.length} failure(s)) — ${durationMs}ms` });
    for (const f of failures) hCtx.log({ prefix: '!', text: `[${label}]   ✗ ${f}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: errMsg });
    return;
  }

  if (failures.length > 0 && data.failBehavior === 'warn') {
    hCtx.log({ prefix: '~', text: `[${label}] Assert warnings (${failures.length}):` });
    for (const f of failures) hCtx.log({ prefix: '~', text: `[${label}]   ⚠ ${f}` });
  }

  hCtx.results.push(buildGraphqlResult(nodeId, label, 'graphqlAssert', '', durationMs, true));
  if (rawSourceValue && rawSourceValue !== `{{${sourceVar}}}`) {
    hCtx.log({ prefix: '→', text: `[${label}]   Source: ${previewForConsoleLog(sourceValue, 200)}` });
  }
  hCtx.log({ prefix: '✓', text: `[${label}] Assert passed — ${data.assertions?.length ?? 0} assertion(s) — ${durationMs}ms` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}
