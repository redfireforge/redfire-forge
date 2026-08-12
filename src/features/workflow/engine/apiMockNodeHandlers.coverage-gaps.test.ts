import { describe, expect, it, vi } from 'vitest';
import {
  handleApiMockApply,
  handleApiMockAssertCalls,
  handleApiMockResetState,
  handleApiMockStop,
  type ApiMockNodeContext,
} from './apiMockNodeHandlers';
import type { ApiMockTransactionV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function mockCtx(response: unknown, ok = true): ApiMockNodeContext {
  return {
    controlBaseUrl: 'http://localhost:3001',
    fetch: vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok, data: response, error: ok ? undefined : { message: String(response) } }) }),
  };
}

function makeTx(overrides: Partial<ApiMockTransactionV1> = {}): ApiMockTransactionV1 {
  return {
    id: 'tx-1',
    serverId: 'srv-1',
    generation: 1,
    receivedAt: ts,
    request: { method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
    outcome: 'matched',
    matchedRouteId: 'r1',
    explanation: { normalizedRequest: { method: 'GET', path: '/test', decodedPath: '/test', pathSegments: ['test'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' }, nearMisses: [] },
    response: { status: 200, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 10, generationAtResponse: 1 },
    ...overrides,
  };
}

describe('apiMockNodeHandlers coverage gaps', () => {
  it('handles stop/apply/reset non-ok responses', async () => {
    await expect(handleApiMockStop({ label: 'Stop', serverId: 'srv-1' }, mockCtx('stop failed', false))).resolves.toMatchObject({ success: false, error: 'stop failed' });
    await expect(handleApiMockApply({ label: 'Apply', serverId: 'srv-1' }, mockCtx('apply failed', false))).resolves.toMatchObject({ success: false, error: 'apply failed' });
    await expect(handleApiMockResetState({ label: 'Reset', serverId: 'srv-1' }, mockCtx('reset failed', false))).resolves.toMatchObject({ success: false, error: 'reset failed' });
  });

  it('handles stop/apply/reset thrown fetch errors', async () => {
    const failingCtx: ApiMockNodeContext = {
      controlBaseUrl: 'http://localhost:3001',
      fetch: vi.fn().mockRejectedValue(new Error('boom')),
    };
    await expect(handleApiMockStop({ label: 'Stop', serverId: 'srv-1' }, failingCtx)).resolves.toMatchObject({ success: false, error: 'boom' });
    await expect(handleApiMockApply({ label: 'Apply', serverId: 'srv-1' }, failingCtx)).resolves.toMatchObject({ success: false, error: 'boom' });
    await expect(handleApiMockResetState({ label: 'Reset', serverId: 'srv-1' }, failingCtx)).resolves.toMatchObject({ success: false, error: 'boom' });
  });

  it('filters assert calls by expected status and tolerates absent expected header value', async () => {
    const txs = [
      makeTx({ response: { ...makeTx().response!, status: 200 } }),
      makeTx({ id: 'tx-2', response: { ...makeTx().response!, status: 500 } }),
    ];
    const statusFiltered = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedStatus: 500, expectedCount: 1 },
      mockCtx({}),
      txs,
    );
    expect(statusFiltered.success).toBe(true);

    const headerPresenceOnly = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedHeaderKey: 'x-custom' },
      mockCtx({}),
      [makeTx({ request: { ...makeTx().request, headers: { 'x-custom': ['present'] } } })],
    );
    expect(headerPresenceOnly.success).toBe(true);
  });
});
