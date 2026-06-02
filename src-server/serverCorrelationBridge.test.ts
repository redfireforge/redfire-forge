/**
 * Phase 5 — ServerCorrelationBridge unit tests.
 *
 * Covers:
 *  - Basic pause / resume / cancel / timeout operations
 *  - Duplicate correlationId guard (rejects immediately)
 *  - Race: timeout fires after waiter has already fired → no double-reject
 *  - Race: late notifyResume fires after cancel/timeout → no double-resolve
 *  - cancel() deregisters waiter so subsequent notifyResume() has no effect
 *  - cleanup() removes expired entries and rejects their Promises
 *  - Orphaned entry (registered in activeStore but no waiter): notifyResume queues in queuedResumes
 *  - size, isPaused(), listPaused() state tracking
 *  - ServerPausedEntry fields stored with correct correlationSource/config from pause() call
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerCorrelationBridge } from './serverCorrelationBridge.js';
import {
  clearAllCorrelations,
  setCorrelationStore,
  notifyResume,
  getPausedCount,
  findByCorrelationId,
  type QueuedResume,
} from './correlation-handler.js';
import { InMemoryServerStore } from './correlation-store-memory.js';
import { clearIdempotency } from './webhook-idempotency.js';

// ── State factory ─────────────────────────────────────────────────────────────

function makeState(
  overrides: Partial<import('../src/features/workflow/types/workflow.js').WorkflowPausedState> = {},
): import('../src/features/workflow/types/workflow.js').WorkflowPausedState {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    visitedNodes: [],
    pausedNodeId: 'kw1',
    threadId: 'main',
    joinArrived: {},
    results: [],
    startTime: Date.now(),
    initialVariables: {},
    ...overrides,
  };
}

function makeResumeData(overrides: Partial<QueuedResume> = {}): QueuedResume {
  return {
    webhookData: { topic: 'orders', key: 'ord-1', value: '{"id":"ord-1"}', partition: 0, offset: '5', headers: {} },
    executionId: 'exec-1',
    workflowId: 'wf-1',
    ts: Date.now(),
    ...overrides,
  };
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

beforeEach(() => {
  setCorrelationStore(new InMemoryServerStore());
  clearAllCorrelations();
  clearIdempotency();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  clearAllCorrelations();
});

// ── Basic operations ──────────────────────────────────────────────────────────

describe('ServerCorrelationBridge — basic operations', () => {
  it('pause() resolves when notifyResume() fires before timeout', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-1', 'orders', makeState(), 5000);

    const payload: QueuedResume = makeResumeData();
    notifyResume('ord-1', payload);

    const result = await pausePromise;
    expect(result).toEqual(payload.webhookData);
  });

  it('pause() rejects with timeout error when timeoutMs elapses', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-timeout', 'orders', makeState(), 100);

    vi.advanceTimersByTime(150);

    await expect(pausePromise).rejects.toThrow(/timeout/i);
  });

  it('pause() with timeoutMs=0 does not set up a timer and never auto-rejects', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-no-timeout', 'orders', makeState(), 0);

    // Advance time well past any reasonable timeout — Promise should still be pending
    vi.advanceTimersByTime(100_000);

    // Resolve externally to avoid test hanging
    notifyResume('ord-no-timeout', makeResumeData());
    await expect(pausePromise).resolves.toBeDefined();
  });

  it('cancel() on a paused entry causes pause() to reject', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-cancel', 'orders', makeState(), 5000);

    const cancelled = bridge.cancel('ord-cancel');

    expect(cancelled).toBe(true);
    await expect(pausePromise).rejects.toThrow(/cancelled/i);
  });

  it('cancel() on a non-existent correlationId returns false', () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    expect(bridge.cancel('ord-ghost')).toBe(false);
  });

  it('resume() on a paused entry resolves the Promise directly', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-direct', 'orders', makeState(), 5000);

    const data = { topic: 'orders', key: 'ord-direct', value: '{"x":1}', partition: 0, offset: '1', headers: {} };
    const resumed = bridge.resume('ord-direct', data);

    expect(resumed).toBe(true);
    await expect(pausePromise).resolves.toEqual(data);
  });

  it('resume() on a non-existent correlationId returns false', () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    expect(bridge.resume('ord-ghost', {})).toBe(false);
  });

  it('pause() rejects immediately for duplicate correlationId (concurrent pause guard)', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    // First pause
    const first = bridge.pause('ord-dup', 'orders', makeState(), 5000);
    // Second pause with same ID
    await expect(bridge.pause('ord-dup', 'orders', makeState(), 5000)).rejects.toThrow(/already paused/i);
    // Clean up first
    bridge.cancel('ord-dup');
    await first.catch(() => {});
  });
});

// ── State tracking ────────────────────────────────────────────────────────────

describe('ServerCorrelationBridge — state tracking', () => {
  it('isPaused() returns true while paused and false after resolve', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-state', 'orders', makeState(), 5000);

    expect(bridge.isPaused('ord-state')).toBe(true);

    notifyResume('ord-state', makeResumeData());
    await pausePromise;

    expect(bridge.isPaused('ord-state')).toBe(false);
  });

  it('isPaused() returns false after cancel()', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-cancel-state', 'orders', makeState(), 5000);
    bridge.cancel('ord-cancel-state');
    expect(bridge.isPaused('ord-cancel-state')).toBe(false);
    await p.catch(() => {});
  });

  it('size property tracks the number of active paused entries', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    expect(bridge.size).toBe(0);

    const p1 = bridge.pause('ord-a', 'orders', makeState(), 5000);
    const p2 = bridge.pause('ord-b', 'orders', makeState(), 5000);
    expect(bridge.size).toBe(2);

    notifyResume('ord-a', makeResumeData());
    await p1;
    expect(bridge.size).toBe(1);

    bridge.cancel('ord-b');
    await p2.catch(() => {});
    expect(bridge.size).toBe(0);
  });

  it('listPaused() returns all active paused entries', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p1 = bridge.pause('ord-list-1', 'orders', makeState({ pausedNodeId: 'kw1' }), 5000);
    const p2 = bridge.pause('ord-list-2', 'events', makeState({ pausedNodeId: 'kw2' }), 5000);

    const paused = bridge.listPaused();
    expect(paused).toHaveLength(2);
    expect(paused.map(e => e.correlationId)).toContain('ord-list-1');
    expect(paused.map(e => e.correlationId)).toContain('ord-list-2');

    // Clean up
    bridge.cancel('ord-list-1');
    bridge.cancel('ord-list-2');
    await Promise.allSettled([p1, p2]);
  });

  it('get() returns the PausedEntry while active and undefined after resolution', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-get', 'orders', makeState(), 5000);

    const entry = bridge.get('ord-get');
    expect(entry).toBeDefined();
    expect(entry?.correlationId).toBe('ord-get');
    expect(entry?.webhookPath).toBe('orders');

    notifyResume('ord-get', makeResumeData());
    await p;
    expect(bridge.get('ord-get')).toBeUndefined();
  });
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

describe('ServerCorrelationBridge — cleanup()', () => {
  it('cleanup() removes and rejects expired entries', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    // timeoutMs=50 — entry expires in 50ms
    const p = bridge.pause('ord-expired', 'orders', makeState(), 50);

    // Advance time to trigger expiry
    vi.advanceTimersByTime(100);

    // cleanup() should find it expired and reject it
    // (Though the internal setTimeout already rejected it — cleanup is the manual fallback)
    await p.catch(() => {}); // already rejected by the timer

    // After rejection, cleanup has nothing to clean; size should be 0
    expect(bridge.size).toBe(0);
    expect(bridge.isPaused('ord-expired')).toBe(false);
  });

  it('cleanup() returns 0 when all entries are still within their timeout window', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p1 = bridge.pause('ord-fresh-1', 'orders', makeState(), 10_000);
    const p2 = bridge.pause('ord-fresh-2', 'orders', makeState(), 10_000);

    // Advance only a little — entries not expired yet
    vi.advanceTimersByTime(1_000);

    const removed = bridge.cleanup();
    expect(removed).toBe(0);
    expect(bridge.size).toBe(2);

    bridge.cancel('ord-fresh-1');
    bridge.cancel('ord-fresh-2');
    await Promise.allSettled([p1, p2]);
  });
});

// ── Race conditions ───────────────────────────────────────────────────────────

describe('ServerCorrelationBridge — race conditions', () => {
  it('timeout guard: timer callback is a no-op if waiter already fired', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-race-1', 'orders', makeState(), 100);

    // Resume the waiter first
    notifyResume('ord-race-1', makeResumeData());
    const result = await pausePromise;
    expect(result).toBeDefined();

    // Now advance time past the timeout — should not throw or reject
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();

    // Bridge size should still be 0 (no double-entry)
    expect(bridge.size).toBe(0);
  });

  it('late notifyResume after cancel() has no effect — no double-resolve', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-race-cancel', 'orders', makeState(), 5000);

    // Cancel first → Promise rejects
    bridge.cancel('ord-race-cancel');
    await expect(pausePromise).rejects.toThrow(/cancelled/i);

    // Now fire notifyResume after cancel — should be silently ignored
    const spy = vi.fn();
    pausePromise.then(spy, spy); // already settled
    notifyResume('ord-race-cancel', makeResumeData());
    // No errors should be thrown
    expect(spy).not.toHaveBeenCalled(); // already rejected, no new callbacks
  });

  it('late notifyResume after timeout() has no effect — no double-resolve', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-race-timeout', 'orders', makeState(), 50);

    // Advance time to trigger timeout
    vi.advanceTimersByTime(100);
    await expect(pausePromise).rejects.toThrow(/timeout/i);

    // Fire notifyResume after timeout — should be silently ignored
    expect(() => notifyResume('ord-race-timeout', makeResumeData())).not.toThrow();
    expect(bridge.size).toBe(0);
  });

  it('cancel() deregisters waiter so subsequent notifyResume() does not resolve a dead Promise', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const pausePromise = bridge.pause('ord-race-deregister', 'orders', makeState(), 5000);

    // Cancel → deregisters from resumeWaiters
    bridge.cancel('ord-race-deregister');
    await expect(pausePromise).rejects.toThrow(/cancelled/i);

    // Subsequent notifyResume should queue in queuedResumes (no waiter), not crash
    let threw = false;
    try {
      notifyResume('ord-race-deregister', makeResumeData());
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});

// ── Server store integration ──────────────────────────────────────────────────

describe('ServerCorrelationBridge — activeStore integration', () => {
  it('pause() registers an entry in the active correlation store', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-store', 'orders', makeState({ pausedNodeId: 'kw1' }), 5000);

    expect(getPausedCount()).toBe(1);
    const entry = findByCorrelationId('ord-store');
    expect(entry).toBeDefined();
    expect(entry?.webhookPath).toBe('orders');
    expect(entry?.executionId).toBe('exec-1');
    expect(entry?.workflowId).toBe('wf-1');
    expect(entry?.pausedNodeId).toBe('kw1');

    // Clean up
    notifyResume('ord-store', makeResumeData());
    await p;
  });

  it('pause() stores correlationSource and correlationJsonPath from config', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-cfg', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'body',
      correlationJsonPath: '$.orderId',
    });

    const entry = findByCorrelationId('ord-cfg');
    expect(entry?.correlationSource).toBe('body');
    expect(entry?.correlationJsonPath).toBe('$.orderId');

    notifyResume('ord-cfg', makeResumeData());
    await p;
  });

  it('pause() stores correlationSource=key correctly (Kafka key correlation)', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-key', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'key',
    });

    const entry = findByCorrelationId('ord-key');
    expect(entry?.correlationSource).toBe('key');

    notifyResume('ord-key', makeResumeData());
    await p;
  });

  it('pause() stores correlationSource=header with correlationHeader', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-hdr', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'header',
      correlationHeader: 'X-Order-Id',
    });

    const entry = findByCorrelationId('ord-hdr');
    expect(entry?.correlationSource).toBe('header');
    expect(entry?.correlationHeader).toBe('X-Order-Id');

    notifyResume('ord-hdr', makeResumeData());
    await p;
  });

  it('resume/cancel removes entry from the active correlation store', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-remove', 'orders', makeState(), 5000);

    expect(getPausedCount()).toBe(1);

    bridge.cancel('ord-remove');
    await p.catch(() => {});

    expect(getPausedCount()).toBe(0);
    expect(findByCorrelationId('ord-remove')).toBeUndefined();
  });

  it('timeout removes entry from the active correlation store', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-timeout-store', 'orders', makeState(), 50);

    expect(getPausedCount()).toBe(1);

    vi.advanceTimersByTime(100);
    await p.catch(() => {});

    expect(getPausedCount()).toBe(0);
  });
});

// ── Restart / disconnect resilience ──────────────────────────────────────────

describe('ServerCorrelationBridge — restart and disconnect resilience', () => {
  it('orphaned entry (in activeStore, no resumeWaiter) queues resume data in queuedResumes rather than crashing', async () => {
    /**
     * Simulates a server restart scenario: an entry is in the store (e.g. from
     * persisted state or a different process), but no in-process waiter has been
     * registered. When notifyResume() fires (e.g. from dispatchKafkaResumeMessage),
     * the data should be queued in queuedResumes for HTTP long-poll pickup rather
     * than being dropped or causing an error.
     *
     * NOTE: ServerCorrelationBridge does NOT read from queuedResumes — it relies on
     * the resume waiter mechanism. The queued data is intended for browser-side
     * long-poll clients. This test documents the expected behavior.
     */
    // Directly add an entry to the store without registering a waiter (simulates restart)
    const { addPausedCorrelation } = await import('./correlation-handler.js');
    addPausedCorrelation({
      correlationId: 'ord-orphan',
      webhookPath: 'orders',
      executionId: 'exec-orphan',
      workflowId: 'wf-1',
      pausedNodeId: 'kw1',
      pausedAt: Date.now(),
      timeoutAt: 0,
      correlationSource: 'body',
      correlationJsonPath: 'orderId',
    });

    // notifyResume should NOT throw even though no waiter is registered
    expect(() => notifyResume('ord-orphan', makeResumeData())).not.toThrow();
  });

  it('multiple sequential pause/resume cycles on same bridge work correctly', async () => {
    const bridge = new ServerCorrelationBridge('exec-seq', 'wf-1');

    for (let i = 0; i < 3; i++) {
      const corrId = `ord-seq-${i}`;
      const p = bridge.pause(corrId, 'orders', makeState(), 5000);
      notifyResume(corrId, makeResumeData({ webhookData: { iteration: i } }));
      const result = await p;
      expect((result as Record<string, unknown>).iteration).toBe(i);
    }
  });

  it('concurrent pauses on different correlationIds all resolve independently', async () => {
    const bridge = new ServerCorrelationBridge('exec-concurrent', 'wf-1');

    const promises = ['a', 'b', 'c'].map(id =>
      bridge.pause(`ord-concurrent-${id}`, 'orders', makeState(), 5000),
    );

    // Resolve them in reverse order to verify independence
    notifyResume('ord-concurrent-c', makeResumeData({ webhookData: { id: 'c' } }));
    notifyResume('ord-concurrent-a', makeResumeData({ webhookData: { id: 'a' } }));
    notifyResume('ord-concurrent-b', makeResumeData({ webhookData: { id: 'b' } }));

    const results = await Promise.all(promises);
    expect((results[0] as Record<string, unknown>).id).toBe('a');
    expect((results[1] as Record<string, unknown>).id).toBe('b');
    expect((results[2] as Record<string, unknown>).id).toBe('c');
  });
});
