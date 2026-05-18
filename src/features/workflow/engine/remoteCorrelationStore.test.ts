/**
 * @vitest-environment jsdom
 */
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

  it('cancel() returns false for unknown correlation id', () => {
    expect(store.cancel('no-such-id')).toBe(false);
  });

  it('resolves base URL from window location when baseUrl omitted', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: {} }));
    const s = new RemoteCorrelationStore({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await s.pause('pid', '/wh', makeState(), 5000);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('http://localhost:3001/api/correlations/pause');
  });

  it('retries wait poll when response is not ok', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ err: true }, 500))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: { z: 2 } }));

    const r = await store.pause('c-retry-notok', '/wh', makeState(), 60_000);
    expect(r).toEqual({ z: 2 });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/wait')).length).toBeGreaterThanOrEqual(2);
  });

  it('backs off and retries when wait fetch throws (network blip)', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockRejectedValueOnce(new Error('net down'))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: { r: 1 } }));

    const r = await store.pause('c-net', '/wh', makeState(), 60_000);
    expect(r).toEqual({ r: 1 });
  });

  it('fails wait loop when overall deadline elapses', async () => {
    vi.useFakeTimers();
    try {
      const start = 1_000_000;
      vi.setSystemTime(start);
      fetchMock
        .mockResolvedValueOnce(ok({ paused: true }, 201))
        .mockImplementation((url: string) => {
          if (String(url).includes('/wait')) {
            vi.advanceTimersByTime(90_000);
            return Promise.resolve(ok({ resumed: false }));
          }
          return Promise.resolve(ok({}));
        });

      const p = store.pause('c-dead', '/wh', makeState(), 60_000);
      const assertReject = expect(p).rejects.toThrow(/timed out/);
      await vi.runAllTimersAsync();
      await assertReject;
    } finally {
      vi.useRealTimers();
    }
  });

  it('failAndDelete on unexpected wait error surfaces on pause promise', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((url: string) => {
        if (String(url).includes('/wait')) {
          return Promise.resolve({
            get ok() {
              throw new Error('wait boom');
            },
            json: async () => ({}),
          } as unknown as Response);
        }
        return Promise.resolve(ok({}));
      });

    await expect(store.pause('c-boom', '/wh', makeState(), 60_000)).rejects.toThrow('wait boom');
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

  it('includes webhookFilter and header/query config in pause payload', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: { x: 1 } }));

    await store.pause(
      'wf-cid',
      '/wh',
      makeState(),
      1000,
      'filter-x',
      {
        correlationSource: 'header',
        correlationJsonPath: '$.x',
        correlationHeader: 'X-Cor',
        correlationQueryParam: 'q',
      },
    );

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.webhookFilter).toBe('filter-x');
    expect(body.correlationSource).toBe('header');
    expect(body.correlationHeader).toBe('X-Cor');
    expect(body.correlationQueryParam).toBe('q');
  });

  it('settles with empty object when resumed without webhookData', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: true }));

    const r = await store.pause('no-data', '/wh', makeState(), 60_000);
    expect(r).toEqual({});
  });

  it('accepts registration response with 200 OK', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 200))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: { k: 1 } }));

    await expect(store.pause('ok200', '/wh', makeState(), 60_000)).resolves.toEqual({ k: 1 });
  });

  it('uses pollTimeoutMs cap in wait URL when deadline far away', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: false, timedOut: true }))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: {} }));
    const s = new RemoteCorrelationStore({
      baseUrl: 'http://test',
      pollTimeoutMs: 333,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await s.pause('poll-cap', '/wh', makeState(), 600_000);
    const waits = fetchImpl.mock.calls.filter(c => String(c[0]).includes('/wait'));
    expect(waits.length).toBeGreaterThanOrEqual(2);
    expect(String(waits[0][0])).toContain('timeoutMs=333');
  });

  it('strips trailing slash from explicit baseUrl', () => {
    const trailingStore = new RemoteCorrelationStore({
      baseUrl: 'http://test/',
      pollTimeoutMs: 1000,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: {} }));

    void trailingStore.pause('trail', '/wh', makeState(), 5000);
    expect(fetchMock.mock.calls[0][0]).toBe('http://test/api/correlations/pause');
  });

  it('uses MAX_OVERALL_TIMEOUT when timeoutMs is 0', () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((_u: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
      );

    void store.pause('zero-timeout', '/wh', makeState(), 0);
    const registerBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(registerBody.timeoutMs).toBe(3600000);
    store.cancel('zero-timeout');
  });

  it('retries after json() throws on wait response', async () => {
    let waitCalls = 0;
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((url: string) => {
        if (String(url).includes('/wait')) {
          waitCalls++;
          if (waitCalls === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => { throw new Error('bad json'); },
              text: async () => '',
            });
          }
          return Promise.resolve(ok({ resumed: true, webhookData: { retry: true } }));
        }
        return Promise.resolve(ok({}));
      });

    const result = await store.pause('json-fail', '/wh', makeState(), 60000);
    expect(result).toEqual({ retry: true });
    expect(waitCalls).toBe(2);
  });

  it('failAndDelete is a no-op when entry was already removed', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((_u: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
      );

    const p = store.pause('double-fail', '/wh', makeState(), 60000);
    await Promise.resolve();
    store.cancel('double-fail');
    await expect(p).rejects.toThrow();
    expect(store.size).toBe(0);
  });

  it('cancel() swallows DELETE failures', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).includes('/wait')) {
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          });
        }
        if (
          (init as RequestInit | undefined)?.method === 'DELETE'
          && String(url).includes('cancel-del-fail')
        ) {
          return Promise.reject(new Error('delete failed'));
        }
        return Promise.resolve(ok({}));
      });

    const promise = store.pause('cancel-del-fail', '/wh', makeState(), 60000);
    await Promise.resolve();
    expect(store.cancel('cancel-del-fail')).toBe(true);
    await expect(promise).rejects.toThrow(/cancelled/);
  });

  it('409 recovery swallows DELETE failure and still retries pause', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ error: 'conflict' }, 409))
      .mockRejectedValueOnce(new Error('stale delete failed'))
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: { recovered: true } }));

    const r = await store.pause('409-del-fail', '/wh', makeState(), 1000);
    expect(r).toEqual({ recovered: true });
  });

  it('failAndDelete swallows DELETE failures after timeout', async () => {
    vi.useFakeTimers();
    try {
      const start = 1_000_000;
      vi.setSystemTime(start);
      fetchMock
        .mockResolvedValueOnce(ok({ paused: true }, 201))
        .mockImplementation((url: string, init?: RequestInit) => {
          if (String(url).includes('/wait')) {
            vi.advanceTimersByTime(90_000);
            return Promise.resolve(ok({ resumed: false }));
          }
          if ((init as RequestInit | undefined)?.method === 'DELETE') {
            return Promise.reject(new Error('cleanup delete failed'));
          }
          return Promise.resolve(ok({}));
        });

      const p = store.pause('timeout-del-fail', '/wh', makeState(), 60_000);
      const assertReject = expect(p).rejects.toThrow(/timed out/);
      await vi.runAllTimersAsync();
      await assertReject;
    } finally {
      vi.useRealTimers();
    }
  });

  it('wait loop maps non-Error throws through failAndDelete', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((url: string) => {
        if (String(url).includes('/wait')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              get resumed() {
                throw 'not-an-error-instance';
              },
            }),
            text: async () => '',
          } as unknown as Response);
        }
        return Promise.resolve(ok({}));
      });

    await expect(
      store.pause('non-error-throw', '/wh', makeState(), 60_000),
    ).rejects.toThrow(/not-an-error-instance/);
  });

  it('failAndDelete skips cleanup when entry is already gone', () => {
    const raw = store as unknown as {
      failAndDelete(correlationId: string, err: Error): void;
    };
    expect(() => raw.failAndDelete('missing-entry', new Error('x'))).not.toThrow();
  });

  it('server resume is ignored after local resume removed the entry', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockImplementation((url: string) => {
        if (String(url).includes('/wait')) {
          return new Promise((resolve) => {
            setTimeout(
              () => resolve(ok({ resumed: true, webhookData: { late: true } })),
              30,
            );
          });
        }
        return Promise.resolve(ok({}));
      });

    const p = store.pause('race-resume', '/wh', makeState(), 60_000);
    await Promise.resolve();
    expect(store.resume('race-resume', { local: true })).toBe(true);
    await expect(p).resolves.toEqual({ local: true });
    await new Promise(r => setTimeout(r, 80));
    expect(store.size).toBe(0);
  });
});
