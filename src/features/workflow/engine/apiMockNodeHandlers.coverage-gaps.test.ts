import { describe, expect, it, vi } from 'vitest';
import {
  handleApiMockApply,
  handleApiMockAssertCalls,
  handleApiMockResetState,
  handleApiMockStart,
  handleApiMockStop,
  type ApiMockNodeContext,
} from './apiMockNodeHandlers';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';

const ts = '2026-08-12T00:00:00.000Z';

/** Apply resolves a definition before fetching; supply one so tests reach the request. */
function makeDef(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Srv',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

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
  it('starts via workspace resolver when no definition is provided', async () => {
    const loadWorkspace = vi.fn(async () => ({ servers: [makeDef()], activeServerId: 'srv-1' }));
    const registerStarted = vi.fn();
    const ctx: ApiMockNodeContext = {
      controlBaseUrl: 'http://localhost:3001',
      fetch: vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, data: { serverId: 'srv-1__run_run1', port: 4700, generation: 1 } }),
      }),
      loadWorkspace,
      runId: 'run1',
      registerStarted,
    };
    const result = await handleApiMockStart({
      label: 'Start',
      serverId: 'srv-1',
      portOverride: 4700,
      isolateRun: true,
    }, ctx);
    expect(result.success).toBe(true);
    expect(result.port).toBe(4700);
    expect(registerStarted).toHaveBeenCalledWith('srv-1__run_run1');
  });

  it('applies port override to a pre-resolved definition', async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: { serverId: 'srv-1', port: 4611, generation: 2 } }),
    });
    const ctx: ApiMockNodeContext = {
      controlBaseUrl: 'http://localhost:3001',
      fetch,
      definition: makeDef(),
    };
    const result = await handleApiMockStart({
      label: 'Start',
      serverId: 'srv-1',
      portOverride: 4611,
    }, ctx);
    expect(result.success).toBe(true);
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.port).toBe(4611);
  });

  it('resolves definition for apply when none is supplied', async () => {
    const loadWorkspace = vi.fn(async () => ({ servers: [makeDef()], activeServerId: 'srv-1' }));
    const fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: { generation: 4 } }),
    });
    const result = await handleApiMockApply(
      { label: 'Apply', serverId: 'srv-1' },
      { controlBaseUrl: 'http://localhost:3001', fetch, loadWorkspace },
    );
    expect(result.success).toBe(true);
    expect(result.generation).toBe(4);
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.id).toBe('srv-1');
  });

  it('treats missing servers as success when stop is idempotent', async () => {
    const result = await handleApiMockStop(
      { label: 'Stop', serverId: 'srv-1', idempotent: true },
      mockCtx('Server "srv-1" not found', false),
    );
    expect(result).toEqual({ success: true, serverId: 'srv-1' });
  });

  it('handles non-Error fetch failures and resolver errors', async () => {
    const failingCtx: ApiMockNodeContext = {
      controlBaseUrl: 'http://localhost:3001',
      fetch: vi.fn().mockRejectedValue('network'),
      definition: makeDef(),
    };
    await expect(handleApiMockStart({ label: 'Start', serverId: 'srv-1' }, failingCtx)).resolves.toMatchObject({
      success: false,
      error: 'Request failed',
    });

    const loadWorkspace = vi.fn(async () => ({ servers: [], activeServerId: null }));
    await expect(handleApiMockStart({
      label: 'Start',
      serverId: 'missing',
    }, {
      controlBaseUrl: 'http://localhost:3001',
      fetch: vi.fn(),
      loadWorkspace,
    })).resolves.toMatchObject({ success: false });
  });

  it('uses response fallbacks and strict stop behavior', async () => {
    const registerStarted = vi.fn();
    const ctx: ApiMockNodeContext = {
      controlBaseUrl: 'http://localhost:3001',
      fetch: vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, data: {} }),
      }),
      definition: makeDef(),
      registerStarted,
    };
    const started = await handleApiMockStart({ label: 'Start', serverId: 'srv-1' }, ctx);
    expect(started).toMatchObject({ success: true, serverId: 'srv-1', port: 4600, generation: 1 });
    expect(registerStarted).toHaveBeenCalledWith('srv-1');

    const strictStop = await handleApiMockStop(
      { label: 'Stop', serverId: 'srv-1', idempotent: false },
      mockCtx('not running', false),
    );
    expect(strictStop.success).toBe(false);

    const applyCtx: ApiMockNodeContext = {
      controlBaseUrl: 'http://localhost:3001',
      fetch: vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, data: {} }),
      }),
      definition: makeDef(),
    };
    const applied = await handleApiMockApply({ label: 'Apply', serverId: 'srv-1' }, applyCtx);
    expect(applied.generation).toBe(0);

    await expect(handleApiMockApply(
      { label: 'Apply', serverId: 'missing' },
      {
        controlBaseUrl: 'http://localhost:3001',
        fetch: vi.fn(),
        loadWorkspace: async () => ({ servers: [] }),
      },
    )).resolves.toMatchObject({ success: false });

    await expect(handleApiMockStart(
      { label: 'Start', serverId: 'srv-1' },
      {
        controlBaseUrl: 'http://localhost:3001',
        definition: makeDef(),
        fetch: vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: false, error: {} }) }),
      },
    )).resolves.toMatchObject({ success: false, error: 'Request failed' });
  });

  it('handles stop/apply/reset non-ok responses', async () => {
    await expect(handleApiMockStop({ label: 'Stop', serverId: 'srv-1' }, mockCtx('stop failed', false))).resolves.toMatchObject({ success: false, error: 'stop failed' });
    await expect(handleApiMockApply({ label: 'Apply', serverId: 'srv-1' }, { ...mockCtx('apply failed', false), definition: makeDef() })).resolves.toMatchObject({ success: false, error: 'apply failed' });
    await expect(handleApiMockResetState({ label: 'Reset', serverId: 'srv-1' }, mockCtx('reset failed', false))).resolves.toMatchObject({ success: false, error: 'reset failed' });
  });

  it('handles stop/apply/reset thrown fetch errors', async () => {
    const failingCtx: ApiMockNodeContext = {
      controlBaseUrl: 'http://localhost:3001',
      fetch: vi.fn().mockRejectedValue(new Error('boom')),
    };
    await expect(handleApiMockStop({ label: 'Stop', serverId: 'srv-1' }, failingCtx)).resolves.toMatchObject({ success: false, error: 'boom' });
    await expect(handleApiMockApply({ label: 'Apply', serverId: 'srv-1' }, { ...failingCtx, definition: makeDef() })).resolves.toMatchObject({ success: false, error: 'boom' });
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
