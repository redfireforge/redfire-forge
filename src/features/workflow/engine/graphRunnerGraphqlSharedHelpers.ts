/**
 * Shared helpers for GraphQL workflow node handlers.
 * Used by query/mutation, subscription, introspect, and assert handlers.
 */

import type {
  GraphqlNodeHeaderRow,
  GraphqlOutputBinding,
  GraphqlSubscriptionOutputBinding,
  GraphqlIntrospectOutputBinding,
} from '../types/workflow';
import type { NodeHandlerContext } from './graphRunnerNodeHandlerContext';
import type { RequestResult } from '@shared/types';
import type { GraphqlAuth } from '@shared/types/graphql';
import { nextResultId } from '@engine/requestExecution';
import { buildAuthHeaders } from '@graphql/utils/authUtils';

// ── Bounded defaults ───────────────────────────────────────────────────────────

export const DEFAULT_TIMEOUT_MS = 30_000;

// ── Shared helpers ─────────────────────────────────────────────────────────────

/**
 * Build the resolved HTTP headers for a GraphQL node, merging user-supplied
 * header rows with any auth headers derived from the node's auth config.
 */
export function buildGraphqlHeaders(
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
export function applyQueryOutputBindings(
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
export function applySubscriptionOutputBindings(
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
export function applyIntrospectOutputBindings(
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
export function buildGraphqlResult(
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
