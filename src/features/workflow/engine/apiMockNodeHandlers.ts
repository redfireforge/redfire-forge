/**
 * API Mock Studio — workflow node handlers (Phase 11A-11B).
 * Pure handler functions for API Mock workflow nodes.
 */
import type {
  ApiMockStartNodeData,
  ApiMockStopNodeData,
  ApiMockApplyNodeData,
  ApiMockResetStateNodeData,
  ApiMockAssertCallsNodeData,
} from '../types/workflow/node-api-mock';
import type { ApiMockTransactionV1 } from '../../../shared/api-mock/contracts';

export interface ApiMockNodeContext {
  controlBaseUrl: string;
  fetch: typeof globalThis.fetch;
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
  };
}

export async function handleApiMockStart(data: ApiMockStartNodeData, ctx: ApiMockNodeContext): Promise<ApiMockNodeResult> {
  try {
    const res = await ctx.fetch(`${ctx.controlBaseUrl}/api/mock/servers/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.serverId, port: data.portOverride }),
    });
    const json = await res.json() as { ok: boolean; data?: { serverId: string; port: number; generation: number }; error?: { message: string } };
    if (!json.ok) return { success: false, error: json.error?.message ?? 'Start failed' };
    return { success: true, serverId: json.data?.serverId, port: json.data?.port, generation: json.data?.generation };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function handleApiMockStop(data: ApiMockStopNodeData, ctx: ApiMockNodeContext): Promise<ApiMockNodeResult> {
  try {
    const res = await ctx.fetch(`${ctx.controlBaseUrl}/api/mock/servers/${data.serverId}/stop`, { method: 'POST' });
    const json = await res.json() as { ok: boolean; error?: { message: string } };
    if (!json.ok) return { success: false, error: json.error?.message };
    return { success: true, serverId: data.serverId };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function handleApiMockApply(data: ApiMockApplyNodeData, ctx: ApiMockNodeContext): Promise<ApiMockNodeResult> {
  try {
    const res = await ctx.fetch(`${ctx.controlBaseUrl}/api/mock/servers/${data.serverId}/definition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.serverId }),
    });
    const json = await res.json() as { ok: boolean; data?: { generation: number }; error?: { message: string } };
    if (!json.ok) return { success: false, error: json.error?.message };
    return { success: true, serverId: data.serverId, generation: json.data?.generation };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function handleApiMockResetState(data: ApiMockResetStateNodeData, ctx: ApiMockNodeContext): Promise<ApiMockNodeResult> {
  try {
    const res = await ctx.fetch(`${ctx.controlBaseUrl}/api/mock/servers/${data.serverId}/state/reset`, { method: 'POST' });
    const json = await res.json() as { ok: boolean; error?: { message: string } };
    if (!json.ok) return { success: false, error: json.error?.message };
    return { success: true, serverId: data.serverId };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function handleApiMockAssertCalls(
  data: ApiMockAssertCallsNodeData,
  _ctx: ApiMockNodeContext,
  transactions: ApiMockTransactionV1[],
): Promise<ApiMockNodeResult> {
  const matching = transactions.filter(tx => {
    if (tx.serverId !== data.serverId) return false;
    if (data.routeId && tx.matchedRouteId !== data.routeId) return false;
    if (data.expectedStatus && tx.response?.status !== data.expectedStatus) return false;
    return true;
  });

  const count = matching.length;

  if (data.expectedCount != null && count !== data.expectedCount) {
    return {
      success: false, serverId: data.serverId,
      assertionDetails: { expected: `count = ${data.expectedCount}`, actual: `count = ${count}` },
    };
  }
  if (data.expectedMinCount != null && count < data.expectedMinCount) {
    return {
      success: false, serverId: data.serverId,
      assertionDetails: { expected: `count >= ${data.expectedMinCount}`, actual: `count = ${count}` },
    };
  }
  if (data.expectedMaxCount != null && count > data.expectedMaxCount) {
    return {
      success: false, serverId: data.serverId,
      assertionDetails: { expected: `count <= ${data.expectedMaxCount}`, actual: `count = ${count}` },
    };
  }

  if (data.expectedBodyContains && matching.length > 0) {
    const last = matching[matching.length - 1];
    if (!last.response?.body?.includes(data.expectedBodyContains)) {
      return {
        success: false, serverId: data.serverId,
        assertionDetails: {
          expected: `body contains "${data.expectedBodyContains}"`,
          actual: `body = "${last.response?.body?.slice(0, 100) ?? '(null)'}"`,
        },
      };
    }
  }

  if (data.expectedHeaderKey && matching.length > 0) {
    const last = matching[matching.length - 1];
    const headerVal = last.request.headers[data.expectedHeaderKey.toLowerCase()]?.[0];
    if (data.expectedHeaderValue && headerVal !== data.expectedHeaderValue) {
      return {
        success: false, serverId: data.serverId,
        assertionDetails: {
          expected: `header ${data.expectedHeaderKey} = "${data.expectedHeaderValue}"`,
          actual: `header ${data.expectedHeaderKey} = "${headerVal ?? '(absent)'}"`,
        },
      };
    }
  }

  return { success: true, serverId: data.serverId };
}
