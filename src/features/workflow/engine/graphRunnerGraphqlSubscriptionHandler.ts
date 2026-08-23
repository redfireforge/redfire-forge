/**
 * Handler for the `graphqlSubscription` workflow node type.
 * Opens a WebSocket subscription via the proxy transport, collects messages
 * until a stop condition is met, then applies output bindings.
 */

import type { WorkflowNode, GraphqlSubscriptionNodeData } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import { toErrorMessage } from '@shared/utils/helpers';
import { getByPath } from '@shared/utils/jsonPath';
import { createWsProxyTransport, createSseProxyTransport } from '@graphql/utils/graphqlProxyTransports';
import { deriveWsEndpoint } from '@graphql/utils/graphqlClient';
import {
  buildExtractedVariableMap,
  buildGraphqlRunSnapshot,
} from '@graphql/utils/graphqlConfigTestHelpers';
import {
  collectGraphqlBindingEntries,
  collectGraphqlNodeVariableNames,
  logGraphqlSubscriptionMessage,
  logGraphqlVariableBindings,
  logGraphqlVariables,
} from './graphRunnerGraphqlLogHelpers';
import {
  applySubscriptionOutputBindings,
  buildGraphqlHeaders,
  buildGraphqlResult,
} from './graphRunnerGraphqlSharedHelpers';

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
