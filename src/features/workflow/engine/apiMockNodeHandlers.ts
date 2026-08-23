/**
 * API Mock Studio — workflow node handlers (Phase 11A-11B).
 * Pure control-plane helpers; graphRunner wraps these with visitOutgoing / variables.
 */
import type {
  ApiMockStartNodeData,
  ApiMockStopNodeData,
  ApiMockApplyNodeData,
  ApiMockResetStateNodeData,
  ApiMockAssertCallsNodeData,
} from '../types/workflow/node-api-mock';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '@shared/api-mock/contracts';
import { assertMockCalls } from '@shared/api-mock/assertMockCalls';
import { resolveApiMockDefinition } from '../utils/apiMockWorkflowDefinitionResolver';

export interface ApiMockNodeContext {
  controlBaseUrl: string;
  fetch: typeof globalThis.fetch;
  /** Pre-resolved definition (preferred for start/apply). */
  definition?: ApiMockServerDefinitionV1;
  /** Optional workspace loader override for start when definition is absent. */
  loadWorkspace?: Parameters<typeof resolveApiMockDefinition>[0]['loadWorkspace'];
  runId?: string;
  registerStarted?: (serverId: string) => void;
}

export interface ApiMockNodeResult {
  success: boolean;
  serverId?: string;
  port?: number;
  generation?: number;
  error?: string;
  assertionDetails?: {
    expected: string;
    actual: string;
    nearMisses?: string[];
    transactionIds?: string[];
  };
}

async function postJson(
  ctx: ApiMockNodeContext,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const res = await ctx.fetch(`${ctx.controlBaseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const json = await res.json() as { ok?: boolean; data?: Record<string, unknown>; error?: { message?: string } };
    if (!json.ok) return { ok: false, error: json.error?.message ?? 'Request failed' };
    return { ok: true, data: json.data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function handleApiMockStart(data: ApiMockStartNodeData, ctx: ApiMockNodeContext): Promise<ApiMockNodeResult> {
  let definition = ctx.definition;
  if (!definition) {
    const resolved = await resolveApiMockDefinition({
      serverId: data.serverId,
      portOverride: data.portOverride,
      isolateRun: data.isolateRun !== false,
      runId: ctx.runId ?? `wf-${Date.now()}`,
      loadWorkspace: ctx.loadWorkspace,
    });
    if (!resolved.ok) return { success: false, error: resolved.error };
    definition = resolved.definition;
  } else if (data.portOverride != null) {
    definition = { ...definition, port: data.portOverride };
  }
  if (!definition.id && data.serverId) {
    definition = { ...definition, id: data.serverId };
  }
  if (!definition.id) {
    return { success: false, error: 'Server definition with id is required' };
  }

  const result = await postJson(ctx, '/api/mock/servers/start', {
    method: 'POST',
    body: JSON.stringify(definition),
  });
  if (!result.ok) return { success: false, error: result.error };
  const serverId = String(result.data?.serverId ?? definition.id);
  const port = Number(result.data?.port ?? definition.port);
  const generation = Number(result.data?.generation ?? 1);
  ctx.registerStarted?.(serverId);
  return { success: true, serverId, port, generation };
}

export async function handleApiMockStop(data: ApiMockStopNodeData, ctx: ApiMockNodeContext): Promise<ApiMockNodeResult> {
  const result = await postJson(ctx, `/api/mock/servers/${encodeURIComponent(data.serverId)}/stop`, { method: 'POST' });
  if (!result.ok) {
    if (data.idempotent !== false && /not found|not running/i.test(result.error ?? '')) {
      return { success: true, serverId: data.serverId };
    }
    return { success: false, error: result.error, serverId: data.serverId };
  }
  return { success: true, serverId: data.serverId };
}

export async function handleApiMockApply(data: ApiMockApplyNodeData, ctx: ApiMockNodeContext): Promise<ApiMockNodeResult> {
  let definition = ctx.definition;
  if (!definition) {
    const resolved = await resolveApiMockDefinition({
      serverId: data.serverId,
      isolateRun: false,
      loadWorkspace: ctx.loadWorkspace,
    });
    if (!resolved.ok) return { success: false, error: resolved.error };
    definition = resolved.definition;
  }
  // Apply uses the runtime server id (may be isolated).
  definition = { ...definition, id: data.serverId };
  const result = await postJson(ctx, `/api/mock/servers/${encodeURIComponent(data.serverId)}/definition`, {
    method: 'PUT',
    body: JSON.stringify(definition),
  });
  if (!result.ok) return { success: false, error: result.error, serverId: data.serverId };
  return {
    success: true,
    serverId: data.serverId,
    generation: Number(result.data?.generation ?? 0),
  };
}

export async function handleApiMockResetState(data: ApiMockResetStateNodeData, ctx: ApiMockNodeContext): Promise<ApiMockNodeResult> {
  const result = await postJson(ctx, `/api/mock/servers/${encodeURIComponent(data.serverId)}/state/reset`, { method: 'POST' });
  if (!result.ok) return { success: false, error: result.error, serverId: data.serverId };
  return { success: true, serverId: data.serverId };
}

export async function handleApiMockAssertCalls(
  data: ApiMockAssertCallsNodeData,
  _ctx: ApiMockNodeContext,
  transactions: ApiMockTransactionV1[],
): Promise<ApiMockNodeResult> {
  const assertion = assertMockCalls(transactions, {
    serverId: data.serverId,
    routeId: data.routeId,
    matchedResponseId: data.matchedResponseId,
    expectedCount: data.expectedCount,
    expectedMinCount: data.expectedMinCount,
    expectedMaxCount: data.expectedMaxCount,
    expectedStatus: data.expectedStatus,
    expectedBodyContains: data.expectedBodyContains,
    expectedBodyMatch: data.expectedBodyMatch,
    expectedHeaders: data.expectedHeaders,
    expectedHeaderKey: data.expectedHeaderKey,
    expectedHeaderValue: data.expectedHeaderValue,
    expectedLastCallWithinMs: data.expectedLastCallWithinMs,
  });

  if (!assertion.passed) {
    return {
      success: false,
      serverId: data.serverId,
      assertionDetails: {
        expected: assertion.expected,
        actual: assertion.actual,
        nearMisses: assertion.nearMisses,
        transactionIds: assertion.matchingIds,
      },
    };
  }
  return {
    success: true,
    serverId: data.serverId,
    assertionDetails: {
      expected: assertion.expected,
      actual: assertion.actual,
      transactionIds: assertion.matchingIds,
    },
  };
}
