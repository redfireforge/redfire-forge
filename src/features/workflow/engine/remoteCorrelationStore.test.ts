import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoteCorrelationStore } from './remoteCorrelationStore';
import type { WorkflowPausedState } from '../types/workflow';

function makeState(): WorkflowPausedState {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    visitedNodes: [],
    pausedNodeId: 'cw1',
    threadId: 'main',
    joinArrived: {},
    results: [],
    startTime: 1000,
    initialVariables: {},
  };
}

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}
function ok(body: unknown, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('RemoteCorrelationStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let store: RemoteCorrelationStore;

  beforeEach(() => {
    fetchMock = vi.fn();
    store = new RemoteCorrelationStore({
      baseUrl: 'http://test',
      pollTimeoutMs: 1000,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers paused entry on server with provided config', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201)) // /pause
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: { paymentId: '101', status: 'approved' } })); // /wait

    const result = await store.pause(
      '101', '/webhooks/callback/payment', makeState(), 60000, undefined,
      { correlationSource: 'body', correlationJsonPath: '$.paymentId' },
    );

    expect(result).toEqual({ paymentId: '101', status: 'approved' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [pauseUrl, pauseInit] = fetchMock.mock.calls[0];
    expect(pauseUrl).toBe('http://test/api/correlations/pause');
    expect((pauseInit as RequestInit).method).toBe('POST');
    const pauseBody = JSON.parse((pauseInit as RequestInit).body as string);
    expect(pauseBody.correlationId).toBe('101');
    expect(pauseBody.correlationJsonPath).toBe('$.paymentId');
    expect(pauseBody.correlationSource).toBe('body');

    const [waitUrl] = fetchMock.mock.calls[1];
    expect(waitUrl).toMatch(/\/api\/correlations\/101\/wait\?timeoutMs=/);
  });

  it('defaults config to body/$.correlationId when omitted', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: {} }));

    await store.pause('cid', '/wh', makeState(), 1000);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.correlationSource).toBe('body');
    expect(body.correlationJsonPath).toBe('$.correlationId');
  });

  it('rejects when registration fails', async () => {
    fetchMock.mockResolvedValueOnce(ok({ error: 'bad' }, 400));

    await expect(store.pause('c1', '/wh', makeState(), 1000)).rejects.toThrow(/Failed to register/);
  });

  it('recovers from a stale 409 by deleting and retrying once', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ error: 'already paused' }, 409)) // first /pause
      .mockResolvedValueOnce(ok({ cancelled: true })) // DELETE
      .mockResolvedValueOnce(ok({ paused: true }, 201)) // retry /pause
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: { ok: 1 } })); // /wait

    const r = await store.pause('stale', '/wh', makeState(), 1000);
    expect(r).toEqual({ ok: 1 });

    const calls = fetchMock.mock.calls.map(c => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${c[0]}`);
    expect(calls[0]).toBe('POST http://test/api/correlations/pause');
    expect(calls[1]).toBe('DELETE http://test/api/correlations/stale');
    expect(calls[2]).toBe('POST http://test/api/correlations/pause');
  });

  it('rejects when same correlationId is paused twice', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementationOnce(() => new Promise(() => undefined)); // never resolves

    void store.pause('dup', '/wh', makeState(), 5000);
    await Promise.resolve();
    await expect(store.pause('dup', '/wh', makeState(), 5000)).rejects.toThrow(/already paused/);
  });

  it('long-polls again when server returns timedOut, then resolves', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: false, timedOut: true }))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: { x: 1 } }));

    const r = await store.pause('c1', '/wh', makeState(), 60000);
    expect(r).toEqual({ x: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('cancel() aborts and DELETEs server entry', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((_url: string, init?: RequestInit) => {
        // wait poll never returns
        return new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      });

    const promise = store.pause('cancel-me', '/wh', makeState(), 60000);
    await Promise.resolve();
    expect(store.isPaused('cancel-me')).toBe(true);

    const cancelled = store.cancel('cancel-me');
    expect(cancelled).toBe(true);
    await expect(promise).rejects.toThrow(/cancelled/);
    expect(store.isPaused('cancel-me')).toBe(false);

    // DELETE call queued
    const deleteCall = fetchMock.mock.calls.find(
      ([u, init]) => String(u).endsWith('/api/correlations/cancel-me') && (init as RequestInit | undefined)?.method === 'DELETE',
    );
    expect(deleteCall).toBeDefined();
  });

  it('resume() resolves locally for tests', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((_u: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
      );

    const p = store.pause('local', '/wh', makeState(), 60000);
    await Promise.resolve();
    expect(store.resume('local', { ok: true })).toBe(true);
    await expect(p).resolves.toEqual({ ok: true });
    expect(store.resume('missing', {})).toBe(false);
  });

  it('listPaused / get / size reflect inflight entries', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((_u: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
      );

    void store.pause('a', '/wh', makeState(), 60000).catch(() => undefined);
    await Promise.resolve();

    expect(store.size).toBe(1);
    expect(store.isPaused('a')).toBe(true);
    expect(store.get('a')?.correlationId).toBe('a');
    expect(store.listPaused()).toHaveLength(1);
    expect(store.get('missing')).toBeUndefined();

    store.cancel('a');
  });

  it('cleanup() removes expired and rejects their promises', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      fetchMock
        .mockResolvedValueOnce(ok({ paused: true }, 201))
        .mockImplementation((_u: string, init?: RequestInit) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
        );

      const p = store.pause('exp', '/wh', makeState(), 1000);
      await Promise.resolve();
      vi.setSystemTime(2000);
      const n = store.cleanup();
      expect(n).toBe(1);
      await expect(p).rejects.toThrow(/timed out/);
    } finally {
      vi.useRealTimers();
    }
  });
});
