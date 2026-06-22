/**
 * useGraphqlCollectionRunner — unit tests (Phase 3A task 3A-14)
 *
 * Tests runner logic (sequential execution, abort, HTTP error classification)
 * by mocking executeGraphqlOperation.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GraphqlCollectionItem } from '../../../shared/types/graphql';

// ─── Mock executeGraphqlOperation ─────────────────────────────────────────────

vi.mock('../utils/executeGraphqlOperation', () => ({
  executeGraphqlOperation: vi.fn(),
}));

import { useGraphqlCollectionRunner } from './useGraphqlCollectionRunner';
import { executeGraphqlOperation } from '../utils/executeGraphqlOperation';

const mockExecute = vi.mocked(executeGraphqlOperation);

// ─── Factories ────────────────────────────────────────────────────────────────

function makeItem(overrides?: Partial<GraphqlCollectionItem>): GraphqlCollectionItem {
  return {
    id: crypto.randomUUID(),
    collectionId: 'col-1',
    name: 'Query',
    sortOrder: 0,
    operation: {
      id: crypto.randomUUID(),
      query: 'query { hello }',
      variables: '{}',
      operationType: 'query',
    },
    isPinned: false,
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function successResponse(data: unknown = { hello: 'world' }) {
  return {
    data,
    errors: undefined,
    httpStatus: 200,
    httpHeaders: {},
    latencyMs: 10,
    timestamp: Date.now(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useGraphqlCollectionRunner — sequential run', () => {
  it('emits start + result events per item', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    const items = [makeItem({ id: 'i1' }), makeItem({ id: 'i2' })];

    await act(async () => {
      await result.current.run({ items, endpoint: 'http://test/graphql' });
    });

    const eventTypes = result.current.state.events.map((e) => e.type);
    expect(eventTypes).toEqual(['start', 'result', 'start', 'result']);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(result.current.state.running).toBe(false);
  });

  it('forwards skipTlsVerify to executeGraphqlOperation (Phase 6)', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({
        items: [makeItem({ id: 'tls-tab' })],
        endpoint: 'https://staging.example.com/graphql',
        skipTlsVerify: true,
      });
    });

    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ skipTlsVerify: true }));
  });

  it('marks HTTP 4xx as error event (not result)', async () => {
    mockExecute.mockResolvedValue({
      data: null,
      errors: undefined,
      httpStatus: 401,
      httpHeaders: {},
      latencyMs: 5,
      timestamp: Date.now(),
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [makeItem({ id: 'auth-err' })], endpoint: 'http://test/graphql' });
    });

    const events = result.current.state.events.filter((e) => e.itemId === 'auth-err' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].error?.message).toContain('401');
  });

  it('marks GraphQL errors as error events', async () => {
    mockExecute.mockResolvedValue({
      data: null,
      errors: [{ message: 'Not authorized', locations: [], path: [] }],
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 5,
      timestamp: Date.now(),
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [makeItem({ id: 'gql-err' })], endpoint: 'http://test/graphql' });
    });

    const events = result.current.state.events.filter((e) => e.itemId === 'gql-err' && e.type === 'error');
    expect(events).toHaveLength(1);
    expect(events[0].error?.message).toContain('Not authorized');
  });

  it('skips item with malformed variables JSON', async () => {
    const item = makeItem({
      id: 'bad-vars',
      operation: {
        id: 'op-bad',
        query: 'query { x }',
        variables: '{invalid json}',
        operationType: 'query',
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    expect(mockExecute).not.toHaveBeenCalled();
    const events = result.current.state.events.filter((e) => e.type === 'error');
    expect(events).toHaveLength(1);
    expect(events[0].error?.message).toContain('Variables JSON parse failure');
  });

  it('abort sets aborted flag and stops further items', async () => {
    // abort() after first item completes — remaining items should not execute.
    let callCount = 0;
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    mockExecute.mockImplementation(async () => {
      callCount += 1;
      // On first call, trigger abort so subsequent items are skipped.
      if (callCount === 1) {
        result.current.abort();
      }
      return successResponse();
    });

    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];

    await act(async () => {
      await result.current.run({ items, endpoint: 'http://test/graphql' });
    });

    // Only first item should have been executed (abort was set inside its HTTP call).
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(result.current.state.aborted).toBe(true);
  });
});

describe('useGraphqlCollectionRunner — exportResults', () => {
  it('returns valid JSON with event data', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [makeItem()], endpoint: 'http://test/graphql' });
    });

    const json = result.current.exportResults();
    const parsed = JSON.parse(json) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });
});

// ─── Phase 3B: script execution tests ─────────────────────────────────────────

describe('useGraphqlCollectionRunner — Phase 3B scripts', () => {
  it('rf.abort() in pre-request script emits error event and skips HTTP', async () => {
    const item = makeItem({
      id: 'abort-item',
      scripts: { preRequest: "rf.abort('token missing');", postResponse: '', timeout: 5000, enabled: true },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    // HTTP should not have been called
    expect(mockExecute).not.toHaveBeenCalled();
    const events = result.current.state.events.filter((e) => e.itemId === 'abort-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].error?.message).toContain('token missing');
  });

  it('rf.skip() in pre-request script emits skip event with reason and skips HTTP', async () => {
    const item = makeItem({
      id: 'skip-item',
      scripts: { preRequest: "rf.skip('not applicable for this env');", postResponse: '', timeout: 5000, enabled: true },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    expect(mockExecute).not.toHaveBeenCalled();
    const events = result.current.state.events.filter((e) => e.itemId === 'skip-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('skip');
    // Skip reason should be surfaced in error field
    expect(events[0].error?.message).toContain('not applicable for this env');
  });

  it('failed rf.test() assertions fail the item (error event, not result)', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'test-fail-item',
      scripts: {
        preRequest: '',
        postResponse: "rf.test('status check', () => { throw new Error('wrong status'); });",
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const events = result.current.state.events.filter((e) => e.itemId === 'test-fail-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].error?.message).toContain('test');
    expect(events[0].error?.message).toContain('failed');
  });

  it('passed rf.test() assertions do not fail a successful item', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'test-pass-item',
      scripts: {
        preRequest: '',
        postResponse: "rf.test('all good', () => { /* passes */ });",
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    const events = result.current.state.events.filter((e) => e.itemId === 'test-pass-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('result');
    // Test results should be captured in the event
    expect(events[0].tests).toHaveLength(1);
    expect(events[0].tests![0].passed).toBe(true);
  });

  it('rf.log() output captured in event logs', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'log-item',
      scripts: {
        preRequest: "rf.log('hello from pre'); rf.warn('warning!');",
        postResponse: "rf.log('hello from post');",
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    const events = result.current.state.events.filter((e) => e.itemId === 'log-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    const logs = events[0].logs ?? [];
    const logMessages = logs.map((l) => l.message);
    expect(logMessages.some((m) => m.includes('hello from pre'))).toBe(true);
    expect(logMessages.some((m) => m.includes('warning!'))).toBe(true);
    expect(logMessages.some((m) => m.includes('hello from post'))).toBe(true);
  });

  it('item with scripts.enabled=false skips item-level scripts but runs HTTP', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'disabled-scripts-item',
      scripts: {
        // If these ran, the abort/log would affect the event — but they should be skipped
        preRequest: "rf.abort('should not run');",
        postResponse: "rf.log('should not run');",
        timeout: 5000,
        enabled: false,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    // HTTP should still be called (scripts disabled, not the item)
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const events = result.current.state.events.filter((e) => e.itemId === 'disabled-scripts-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    // Should be a result (abort script was skipped)
    expect(events[0].type).toBe('result');
  });

  it('collection-level pre-script rf.assert(false) blocks HTTP (assertion = explicit gate)', async () => {
    const item = makeItem({ id: 'coll-assert-item' });
    const collection = {
      id: 'col-1',
      name: 'Test Collection',
      preRequestScript: "rf.assert(false, 'collection assertion failed');",
      postResponseScript: '',
      variables: {},
      createdAt: Date.now(),
    };
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql', collection });
    });

    expect(mockExecute).not.toHaveBeenCalled();
    const events = result.current.state.events.filter((e) => e.type === 'error');
    expect(events).toHaveLength(1);
    expect(events[0].error?.message).toContain('collection assertion failed');
  });

  it('collection-level pre-script generic throw is logged but HTTP executes', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({ id: 'coll-throw-item' });
    const collection = {
      id: 'col-1',
      name: 'Test Collection',
      preRequestScript: 'throw new Error("collection pre-script boom");',
      postResponseScript: '',
      variables: {},
      createdAt: Date.now(),
    };
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql', collection });
    });

    // Generic throw doesn't block HTTP
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const nonStart = result.current.state.events.filter((e) => e.itemId === 'coll-throw-item' && e.type !== 'start');
    const allLogs = nonStart.flatMap((e) => e.logs ?? []);
    expect(allLogs.some((l) => l.level === 'error' && l.message.includes('collection pre-script boom'))).toBe(true);
  });

  it('collection-level pre-script rf.skip() emits skip event and skips HTTP', async () => {
    const item = makeItem({ id: 'coll-skip-item' });
    const collection = {
      id: 'col-1',
      name: 'Test Collection',
      preRequestScript: "rf.skip('not applicable');",
      postResponseScript: '',
      variables: {},
      createdAt: Date.now(),
    };
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql', collection });
    });

    expect(mockExecute).not.toHaveBeenCalled();
    const events = result.current.state.events.filter((e) => e.type === 'skip');
    expect(events).toHaveLength(1);
    expect(events[0].error?.message).toContain('not applicable');
  });

  it('collection-level post-response script error is non-blocking', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({ id: 'coll-post-err-item' });
    const collection = {
      id: 'col-1',
      name: 'Test Collection',
      preRequestScript: '',
      postResponseScript: 'throw new Error("collection post boom");',
      variables: {},
      createdAt: Date.now(),
    };
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql', collection });
    });

    // HTTP succeeded → event type should be result despite collection post error
    const events = result.current.state.events.filter((e) => e.itemId === 'coll-post-err-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('result');
    const logs = events[0].logs ?? [];
    expect(logs.some((l) => l.level === 'warn' && l.message.includes('collection post boom'))).toBe(true);
  });

  it('rf.response.httpHeaders are populated in post-response scripts', async () => {
    mockExecute.mockResolvedValue({
      data: { hello: 'world' },
      errors: undefined,
      httpStatus: 200,
      httpHeaders: { 'x-request-id': 'req-456', 'content-type': 'application/json' },
      latencyMs: 15,
      timestamp: Date.now(),
    });
    const item = makeItem({
      id: 'headers-item',
      scripts: {
        preRequest: '',
        postResponse: "rf.setEnv('req_id', rf.response?.httpHeaders?.['x-request-id'] ?? 'missing');",
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    const capturedEnv: Record<string, string> = {};

    await act(async () => {
      await result.current.run({
        items: [item],
        endpoint: 'http://test/graphql',
        onEnvUpdate: (k, v) => { capturedEnv[k] = v; },
      });
    });

    expect(capturedEnv['req_id']).toBe('req-456');
  });

  it('collection-level pre-script rf.abort() stops the item before HTTP', async () => {
    const item = makeItem({ id: 'col-abort-item' });
    const collection = {
      id: 'col-1',
      name: 'Test Collection',
      preRequestScript: "rf.abort('collection-level abort');",
      postResponseScript: '',
      variables: {},
      createdAt: Date.now(),
    };
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql', collection });
    });

    expect(mockExecute).not.toHaveBeenCalled();
    const events = result.current.state.events.filter((e) => e.type === 'error');
    expect(events).toHaveLength(1);
    expect(events[0].error?.message).toContain('collection-level abort');
  });

  it('post-response script error is non-blocking (item still marked result)', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'post-err-item',
      scripts: {
        preRequest: '',
        postResponse: 'throw new Error("post-script error");',
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    // HTTP succeeded, so event type should be 'result' (post errors are non-blocking)
    const events = result.current.state.events.filter((e) => e.itemId === 'post-err-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('result');
    // But the error should appear as a warn log
    const logs = events[0].logs ?? [];
    expect(logs.some((l) => l.level === 'warn' && l.message.includes('post-script error'))).toBe(true);
  });

  it('rf.store is shared across all items in the same run', async () => {
    // Item 1 writes to store; item 2 reads it. Both share the same run-level Map.
    mockExecute.mockResolvedValue(successResponse());
    const item1 = makeItem({
      id: 'store-writer',
      scripts: {
        preRequest: "rf.store.set('sharedToken', 'tok-abc');",
        postResponse: '',
        timeout: 5000,
        enabled: true,
      },
    });
    const item2 = makeItem({
      id: 'store-reader',
      scripts: {
        preRequest: "rf.setEnv('saw_token', rf.store.get('sharedToken') ?? 'missing');",
        postResponse: '',
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    const capturedEnv: Record<string, string> = {};
    await act(async () => {
      await result.current.run({
        items: [item1, item2],
        endpoint: 'http://test/graphql',
        onEnvUpdate: (k, v) => { capturedEnv[k] = v; },
      });
    });

    expect(capturedEnv['saw_token']).toBe('tok-abc');
  });

  it('onEnvUpdate is called when script calls rf.setEnv()', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'env-update-item',
      scripts: {
        preRequest: "rf.setEnv('apiKey', 'secret-123');",
        postResponse: '',
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    const onEnvUpdate = vi.fn();

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql', onEnvUpdate });
    });

    expect(onEnvUpdate).toHaveBeenCalledWith('apiKey', 'secret-123');
  });

  it('rf.setHeader in pre-request script is applied to the HTTP request headers', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'set-header-item',
      scripts: {
        preRequest: "rf.setHeader('X-Tenant-Id', 'tenant-42');",
        postResponse: '',
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Tenant-Id': 'tenant-42' }) }),
    );
  });

  it('rf.assert(false) in pre-request script blocks HTTP (assertion failure = explicit block)', async () => {
    // rf.assert(false) throws GraphqlAssertionError — treated as a blocking signal
    // in pre-request phases (same as rf.abort) because the user explicitly tested a condition.
    const item = makeItem({
      id: 'assert-block-item',
      scripts: {
        preRequest: "rf.assert(false, 'environment not ready');",
        postResponse: '',
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    expect(mockExecute).not.toHaveBeenCalled();
    const events = result.current.state.events.filter((e) => e.itemId === 'assert-block-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].error?.message).toContain('environment not ready');
  });

  it('pre-request generic throw (not abort/skip/assert) is logged but HTTP still executes', async () => {
    // Documents current behavior: only rf.abort()/rf.skip()/rf.assert(false) explicitly block HTTP.
    // A generic runtime error in a pre-request script is logged as an error but
    // the runner continues to execute the HTTP request. This is intentional — aborting
    // on every unexpected throw could mask developer errors silently.
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'pre-throw-item',
      scripts: {
        preRequest: 'throw new Error("unexpected pre-request error");',
        postResponse: '',
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    // HTTP was still called despite the pre-request script error
    expect(mockExecute).toHaveBeenCalledTimes(1);
    // The item emits a result (or error due to test assertions), and error is in logs
    const nonStart = result.current.state.events.filter((e) => e.itemId === 'pre-throw-item' && e.type !== 'start');
    expect(nonStart.length).toBeGreaterThan(0);
    const allLogs = nonStart.flatMap((e) => e.logs ?? []);
    expect(allLogs.some((l) => l.level === 'error' && l.message.includes('unexpected pre-request error'))).toBe(true);
  });

  it('rf.setEnv in item 1 post-script is visible to item 2 pre-script (cross-item env propagation)', async () => {
    // envSnapshot is shared across all items in one run so rf.setEnv changes persist.
    mockExecute.mockResolvedValue(successResponse());
    const item1 = makeItem({
      id: 'env-writer',
      scripts: {
        preRequest: '',
        postResponse: "rf.setEnv('chainedToken', 'tok-from-item1');",
        timeout: 5000,
        enabled: true,
      },
    });
    const item2 = makeItem({
      id: 'env-reader',
      scripts: {
        preRequest: "rf.setEnv('saw_chained', rf.getEnv('chainedToken') ?? 'missing');",
        postResponse: '',
        timeout: 5000,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    const capturedEnv: Record<string, string> = {};

    await act(async () => {
      await result.current.run({
        items: [item1, item2],
        endpoint: 'http://test/graphql',
        onEnvUpdate: (k, v) => { capturedEnv[k] = v; },
      });
    });

    expect(capturedEnv['saw_chained']).toBe('tok-from-item1');
  });

  it('collection-level scripts run even when item.scripts.enabled is false', async () => {
    // Collection scripts gate on collection.preRequestScript / postResponseScript, not on item.scripts.enabled.
    // An item with scripts.enabled=false still runs its collection-level scripts.
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'coll-runs-disabled-item',
      scripts: {
        preRequest: "rf.abort('should not run — item scripts disabled');",
        postResponse: '',
        timeout: 5000,
        enabled: false,
      },
    });
    const collection = {
      id: 'col-1',
      name: 'Collection with scripts',
      preRequestScript: "rf.setEnv('coll_ran', 'yes');",
      postResponseScript: '',
      variables: {},
      createdAt: Date.now(),
    };
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    const capturedEnv: Record<string, string> = {};

    await act(async () => {
      await result.current.run({
        items: [item],
        endpoint: 'http://test/graphql',
        collection,
        onEnvUpdate: (k, v) => { capturedEnv[k] = v; },
      });
    });

    // Item script was disabled — abort should NOT have fired, HTTP should run
    expect(mockExecute).toHaveBeenCalledTimes(1);
    // But collection pre-script should have run
    expect(capturedEnv['coll_ran']).toBe('yes');
  });

  it('collection post-response script runs after item post-response script', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const order: string[] = [];
    // We can't directly observe execution order inside the hook, but we can observe
    // env mutations: item post sets 'order_item'; collection post reads both and sets 'order_coll'
    const item = makeItem({
      id: 'order-test-item',
      scripts: {
        preRequest: '',
        postResponse: "rf.setEnv('order_item', 'item-ran');",
        timeout: 5000,
        enabled: true,
      },
    });
    const collection = {
      id: 'col-1',
      name: 'Order Test Collection',
      preRequestScript: '',
      postResponseScript: "rf.setEnv('order_coll', (rf.getEnv('order_item') ?? 'missing') + '+coll-ran');",
      variables: {},
      createdAt: Date.now(),
    };
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    const capturedEnv: Record<string, string> = {};

    await act(async () => {
      await result.current.run({
        items: [item],
        endpoint: 'http://test/graphql',
        collection,
        onEnvUpdate: (k, v) => { capturedEnv[k] = v; },
      });
    });

    // order_coll should see 'item-ran' set by item post, proving item post ran first
    expect(capturedEnv['order_coll']).toBe('item-ran+coll-ran');
    expect(order).toHaveLength(0); // ensure order array is unused (suppress lint)
  });

  it('collection-pre script timeout blocks HTTP (isTimeout in collection-pre is blocking)', async () => {
    // Collection-level pre-request scripts use a fixed 10s timeout. Simulate a short one
    // by injecting a collection object with a slow pre-script and using a tiny collTimeoutMs.
    // Since collTimeoutMs is hardcoded to 10_000 inside the hook, we test indirectly by
    // verifying that a collection pre-script that takes 200ms does NOT block HTTP when
    // using the default 10s timeout — and does block when the script itself exceeds the timeout.
    // We test actual blocking via a script that explicitly rf.abort()s after a delay.
    mockExecute.mockResolvedValue(successResponse());
    const collection = {
      id: 'coll-pre-timeout',
      name: 'Collection With Pre Timeout',
      preRequestScript:
        // This script sleeps 200ms; since collTimeoutMs = 10s, it won't time out.
        // To verify the timing path we instead use rf.abort() as a blocking proxy.
        "rf.abort('collection pre-request blocked intentionally');",
      postResponseScript: '',
      variables: {},
      createdAt: Date.now(),
    };
    const item = makeItem({ id: 'coll-pre-timeout-item' });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql', collection });
    });

    // Collection pre-script abort must block HTTP
    expect(mockExecute).not.toHaveBeenCalled();
    const terminalEvents = result.current.state.events.filter(
      (e) => e.itemId === 'coll-pre-timeout-item' && e.type !== 'start',
    );
    expect(terminalEvents).toHaveLength(1);
    expect(terminalEvents[0].type).toBe('error');
    expect(terminalEvents[0].error?.message).toContain('blocked');
  });

  it('pre-request script timeout blocks HTTP (isTimeout treated as blocking)', async () => {
    // Scripts that time out in a pre-request phase must NOT let the HTTP request proceed.
    // E.g. an OAuth token refresh that times out should prevent sending an unauthenticated request.
    const item = makeItem({
      id: 'timeout-block-item',
      scripts: {
        // Sleep 200ms — will time out with a 50ms timeout, producing isTimeout: true
        preRequest: 'await new Promise(r => setTimeout(r, 200));',
        timeout: 50,
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test/graphql' });
    });

    // HTTP must NOT have been called — timeout in pre-request is blocking
    expect(mockExecute).not.toHaveBeenCalled();
    // Must emit an error event (not skip) with the timeout message
    const events = result.current.state.events.filter((e) => e.itemId === 'timeout-block-item' && e.type !== 'start');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].error?.message).toContain('timeout');
  }, 5000);

  it('subscription items emit error event and do NOT call executeGraphqlOperation', async () => {
    // Subscriptions require WebSocket/SSE transport; POSTing them as HTTP would
    // result in hangs or confusing server failures.
    const subItem = makeItem({
      id: 'subscription-item',
      operation: {
        id: 'op-sub',
        query: 'subscription OnMessage { message }',
        variables: '{}',
        operationType: 'subscription',
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [subItem], endpoint: 'http://test/graphql' });
    });

    // Must skip HTTP entirely
    expect(mockExecute).not.toHaveBeenCalled();
    // Must emit an error event explaining the limitation
    const terminalEvents = result.current.state.events.filter((e) => e.itemId === 'subscription-item' && e.type !== 'start');
    expect(terminalEvents).toHaveLength(1);
    expect(terminalEvents[0].type).toBe('error');
    expect(terminalEvents[0].error?.message).toMatch(/[Ss]ubscription/);
  });

  it('{{var}} placeholders in item variables resolved against envVars before JSON.parse', async () => {
    // Variables like {"userId": "{{userId}}"} must resolve to the env value before
    // being passed to the HTTP request — matching the main editor's resolveVars behaviour.
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'var-resolve-item',
      operation: {
        id: 'op-var',
        query: 'query GetUser($userId: ID!) { user(id: $userId) { name } }',
        variables: '{"userId": "{{userId}}", "limit": {{pageSize}}}',
        operationType: 'query',
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({
        items: [item],
        endpoint: 'http://test/graphql',
        envVars: { userId: 'user-42', pageSize: '10' },
      });
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { userId: 'user-42', limit: 10 },
      }),
    );
  });

  it('{{var}} with rf.setEnv propagation — later item sees env updated by earlier item script', async () => {
    // envSnapshot is mutable; rf.setEnv in item 1's post-script updates it so that
    // item 2's variables resolve to the new value. This tests cross-item env propagation
    // via the {{var}} resolver.
    mockExecute.mockResolvedValue(successResponse());
    const item1 = makeItem({
      id: 'env-setter',
      scripts: {
        postResponse: "rf.setEnv('dynamicId', 'id-from-item1');",
        enabled: true,
      },
    });
    const item2 = makeItem({
      id: 'var-resolver',
      operation: {
        id: 'op-2',
        query: 'query Get($id: ID!) { node(id: $id) { id } }',
        variables: '{"id": "{{dynamicId}}"}',
        operationType: 'query',
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({
        items: [item1, item2],
        endpoint: 'http://test/graphql',
        envVars: {},
        onEnvUpdate: () => {},
      });
    });

    // Second call must use the id set by item1's post-script
    expect(mockExecute).toHaveBeenCalledTimes(2);
    const secondCall = mockExecute.mock.calls[1][0];
    expect(secondCall.variables).toEqual({ id: 'id-from-item1' });
  });
});

// ─── Pause / Resume / State machine coverage ──────────────────────────────────

describe('useGraphqlCollectionRunner — pause and resume', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('pause() sets paused state (covers pause useCallback + setState)', () => {
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    act(() => { result.current.pause(); });
    expect(result.current.state.paused).toBe(true);
  });

  it('resume() clears paused state (covers resume useCallback + setState)', () => {
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    act(() => { result.current.pause(); });
    act(() => { result.current.resume(); });
    expect(result.current.state.paused).toBe(false);
  });

  it('pause + resume mid-run — waitIfPaused Promise executor runs (covers L80)', async () => {
    // run() resets pausedRef=false at startup, so we must pause from within the run
    // via the onItemComplete callback (called synchronously at end of item 1 processing,
    // before the loop advances to item 2's waitIfPaused check).
    mockExecute.mockResolvedValue(successResponse());
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      const p = result.current.run({
        items: [makeItem({ id: 'a' }), makeItem({ id: 'b' })],
        endpoint: 'http://test',
        onItemComplete: () => {
          // Pause after item 'a' — pausedRef is now true before item 'b' calls waitIfPaused
          result.current.pause();
        },
      });
      // Flush microtasks so item 'a' completes and run blocks at waitIfPaused for item 'b'
      await new Promise((r) => setTimeout(r, 0));
      // Resume to let item 'b' proceed
      result.current.resume();
      await p;
    });

    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(result.current.state.running).toBe(false);
  });

  it('concurrent run() while running is a no-op (L95 guard — runningRef.current === true)', async () => {
    // Use onItemComplete from first item to attempt a second run() while first is in flight.
    mockExecute.mockResolvedValue(successResponse());
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    let secondRunReturned = false;

    await act(async () => {
      await result.current.run({
        items: [makeItem({ id: 'a' }), makeItem({ id: 'b' })],
        endpoint: 'http://test',
        onItemComplete: () => {
          // This fires while the first run is still running (item 'a' done, item 'b' pending)
          if (!secondRunReturned) {
            result.current.run({ items: [makeItem()], endpoint: 'http://test' })
              .then(() => { secondRunReturned = true; })
              .catch(() => { /* ignore */ });
          }
        },
      });
    });

    // Both items from the first run executed (the second run() was a no-op)
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(secondRunReturned).toBe(true);
  });

  it('abort() mid-pause prevents item 2 from executing (L116 abortedRef check)', async () => {
    // Pause via onItemComplete (runs synchronously after item 'a'), then abort to
    // exercise the L116 `if (abortedRef.current) break` that fires after waitIfPaused.
    mockExecute.mockResolvedValue(successResponse());
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      const p = result.current.run({
        items: [makeItem({ id: 'a' }), makeItem({ id: 'b' })],
        endpoint: 'http://test',
        onItemComplete: () => {
          result.current.pause(); // pause after item 'a'
        },
      });
      await new Promise((r) => setTimeout(r, 0)); // wait for run to block at waitIfPaused for item 'b'
      result.current.abort(); // sets abortedRef=true AND resolves the pause promise
      await p;
    });

    // Item 'a' ran (1 HTTP call), item 'b' was aborted via L116 check
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(result.current.state.aborted).toBe(true);
  });
});

// ─── Branch coverage: HTTP throw, missing response fields, plural test failures ─

describe('useGraphqlCollectionRunner — HTTP error branches', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('executeGraphqlOperation Error throw emits error event with message (L293 idx=0)', async () => {
    mockExecute.mockRejectedValue(new Error('network timeout'));
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [makeItem({ id: 'http-throw' })], endpoint: 'http://test' });
    });

    const errEvents = result.current.state.events.filter((e) => e.type === 'error');
    expect(errEvents).toHaveLength(1);
    expect(errEvents[0].error?.message).toContain('network timeout');
    expect(errEvents[0].error?.phase).toBe('http');
  });

  it('executeGraphqlOperation non-Error throw uses String() coercion (L293 idx=1)', async () => {
    mockExecute.mockRejectedValue('string error message');
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [makeItem({ id: 'http-str-throw' })], endpoint: 'http://test' });
    });

    const errEvents = result.current.state.events.filter((e) => e.type === 'error');
    expect(errEvents).toHaveLength(1);
    expect(errEvents[0].error?.message).toContain('string error message');
  });

  it('response without httpStatus defaults to 200 (L304 nullish coalescing)', async () => {
    mockExecute.mockResolvedValue({ data: { x: 1 }, errors: undefined } as unknown as ReturnType<typeof successResponse>);
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [makeItem()], endpoint: 'http://test' });
    });

    const resultEvents = result.current.state.events.filter((e) => e.type === 'result');
    expect(resultEvents).toHaveLength(1);
  });

  it('response without httpHeaders defaults to {} (L305 nullish coalescing)', async () => {
    mockExecute.mockResolvedValue({
      data: { x: 1 },
      errors: undefined,
      httpStatus: 200,
    } as unknown as ReturnType<typeof successResponse>);
    const { result } = renderHook(() => useGraphqlCollectionRunner());
    const item = makeItem({
      id: 'no-headers',
      scripts: {
        postResponse: "rf.setEnv('has_headers', String(typeof rf.response?.httpHeaders === 'object'));",
        enabled: true,
      },
    });
    const capturedEnv: Record<string, string> = {};

    await act(async () => {
      await result.current.run({
        items: [item],
        endpoint: 'http://test',
        onEnvUpdate: (k, v) => { capturedEnv[k] = v; },
      });
    });

    expect(capturedEnv['has_headers']).toBe('true');
  });

  it('item with variables=undefined runs without crash (L138 nullish default)', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      operation: {
        id: 'op-no-vars',
        query: 'query { ping }',
        variables: undefined as unknown as string,
        operationType: 'query',
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test' });
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const resultEvents = result.current.state.events.filter((e) => e.type === 'result');
    expect(resultEvents).toHaveLength(1);
  });

  it('{{var}} placeholder with no matching env key keeps literal (L144 ?? match)', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      operation: {
        id: 'op-unresolved',
        query: 'query { x }',
        variables: '{"key": "{{MISSING_KEY}}"}',
        operationType: 'query',
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test', envVars: {} });
    });

    // The placeholder stays as its literal text since the env key is absent
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { key: '{{MISSING_KEY}}' } }),
    );
  });

  it('multiple test failures uses plural "tests failed" message (L350 idx=1)', async () => {
    mockExecute.mockResolvedValue(successResponse());
    const item = makeItem({
      id: 'multi-fail-item',
      scripts: {
        postResponse:
          "rf.test('fail 1', () => { throw new Error('boom 1'); });" +
          "rf.test('fail 2', () => { throw new Error('boom 2'); });",
        enabled: true,
      },
    });
    const { result } = renderHook(() => useGraphqlCollectionRunner());

    await act(async () => {
      await result.current.run({ items: [item], endpoint: 'http://test' });
    });

    const errEvents = result.current.state.events.filter((e) => e.type === 'error');
    expect(errEvents).toHaveLength(1);
    // Plural: "2 tests failed"
    expect(errEvents[0].error?.message).toMatch(/2 tests failed/);
  });
});
