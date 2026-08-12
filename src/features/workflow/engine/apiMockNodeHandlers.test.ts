import { describe, it, expect, vi } from 'vitest';
import {
  handleApiMockStart, handleApiMockStop, handleApiMockApply,
  handleApiMockResetState, handleApiMockAssertCalls,
  type ApiMockNodeContext,
} from './apiMockNodeHandlers';
import type { ApiMockTransactionV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-11T00:00:00.000Z';

function mockCtx(response: unknown, ok = true): ApiMockNodeContext {
  return {
    controlBaseUrl: 'http://localhost:3001',
    fetch: vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok, data: response, error: ok ? undefined : { message: String(response) } }) }),
  };
}

function makeTx(overrides: Partial<ApiMockTransactionV1> = {}): ApiMockTransactionV1 {
  return {
    id: 'tx-1', serverId: 'srv-1', generation: 1, receivedAt: ts,
    request: { method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
    outcome: 'matched', matchedRouteId: 'r1',
    explanation: { normalizedRequest: { method: 'GET', path: '/test', decodedPath: '/test', pathSegments: ['test'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' }, nearMisses: [] },
    response: { status: 200, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 10, generationAtResponse: 1 },
    ...overrides,
  };
}

describe('handleApiMockStart', () => {
  it('returns success with port and generation', async () => {
    const ctx = mockCtx({ serverId: 'srv-1', port: 4600, generation: 1 });
    const result = await handleApiMockStart({ label: 'Start', serverId: 'srv-1' }, ctx);
    expect(result.success).toBe(true);
    expect(result.port).toBe(4600);
  });

  it('returns error on failure', async () => {
    const ctx = mockCtx('Port in use', false);
    const result = await handleApiMockStart({ label: 'Start', serverId: 'srv-1' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Port in use');
  });

  it('handles network error', async () => {
    const ctx = { controlBaseUrl: 'http://localhost:3001', fetch: vi.fn().mockRejectedValue(new Error('Connection refused')) };
    const result = await handleApiMockStart({ label: 'Start', serverId: 'srv-1' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection refused');
  });
});

describe('handleApiMockStop', () => {
  it('stops server successfully', async () => {
    const ctx = mockCtx({});
    const result = await handleApiMockStop({ label: 'Stop', serverId: 'srv-1' }, ctx);
    expect(result.success).toBe(true);
  });
});

describe('handleApiMockApply', () => {
  it('commits definition and returns generation', async () => {
    const ctx = mockCtx({ generation: 3 });
    const result = await handleApiMockApply({ label: 'Apply', serverId: 'srv-1' }, ctx);
    expect(result.success).toBe(true);
    expect(result.generation).toBe(3);
  });
});

describe('handleApiMockResetState', () => {
  it('resets state', async () => {
    const ctx = mockCtx({});
    const result = await handleApiMockResetState({ label: 'Reset', serverId: 'srv-1' }, ctx);
    expect(result.success).toBe(true);
  });
});

describe('handleApiMockAssertCalls', () => {
  it('passes when count matches', async () => {
    const txs = [makeTx(), makeTx()];
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedCount: 2 },
      mockCtx({}), txs,
    );
    expect(result.success).toBe(true);
  });

  it('fails when count does not match', async () => {
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedCount: 5 },
      mockCtx({}), [makeTx()],
    );
    expect(result.success).toBe(false);
    expect(result.assertionDetails?.expected).toContain('count = 5');
    expect(result.assertionDetails?.actual).toContain('count = 1');
  });

  it('filters by routeId', async () => {
    const txs = [makeTx({ matchedRouteId: 'r1' }), makeTx({ matchedRouteId: 'r2' })];
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', routeId: 'r1', expectedCount: 1 },
      mockCtx({}), txs,
    );
    expect(result.success).toBe(true);
  });

  it('checks expectedMinCount', async () => {
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedMinCount: 3 },
      mockCtx({}), [makeTx()],
    );
    expect(result.success).toBe(false);
  });

  it('checks expectedMaxCount', async () => {
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedMaxCount: 0 },
      mockCtx({}), [makeTx()],
    );
    expect(result.success).toBe(false);
  });

  it('checks body contains', async () => {
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedBodyContains: 'missing' },
      mockCtx({}), [makeTx()],
    );
    expect(result.success).toBe(false);
    expect(result.assertionDetails?.expected).toContain('body contains');
  });

  it('checks header value', async () => {
    const tx = makeTx({ request: { ...makeTx().request, headers: { 'x-custom': ['val'] } } });
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedHeaderKey: 'x-custom', expectedHeaderValue: 'val' },
      mockCtx({}), [tx],
    );
    expect(result.success).toBe(true);
  });

  it('fails on wrong header value', async () => {
    const tx = makeTx({ request: { ...makeTx().request, headers: { 'x-custom': ['wrong'] } } });
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1', expectedHeaderKey: 'x-custom', expectedHeaderValue: 'expected' },
      mockCtx({}), [tx],
    );
    expect(result.success).toBe(false);
  });

  it('passes when no assertions configured', async () => {
    const result = await handleApiMockAssertCalls(
      { label: 'Assert', serverId: 'srv-1' },
      mockCtx({}), [makeTx()],
    );
    expect(result.success).toBe(true);
  });
});
