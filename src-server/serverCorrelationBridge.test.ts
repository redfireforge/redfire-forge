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
  dispatchKafkaResumeMessage,
  type QueuedResume,
  type KafkaResumeMessage,
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

  it('resume() on a no-timer entry (timeoutMs=0) resolves without calling clearTimeout', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    // timeoutMs=0 → no timer is created → entry.timer is undefined
    const pausePromise = bridge.pause('ord-direct-notimer', 'orders', makeState(), 0);

    const data = { topic: 'orders', key: 'ord-direct-notimer', value: 'ok', partition: 0, offset: '2', headers: {} };
    // resume() with entry.timer === undefined exercises the if(entry.timer) false branch
    const resumed = bridge.resume('ord-direct-notimer', data);

    expect(resumed).toBe(true);
    await expect(pausePromise).resolves.toEqual(data);
  });

  it('cancel() on a no-timer entry (timeoutMs=0) rejects without calling clearTimeout', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    // timeoutMs=0 → no timer → entry.timer is undefined
    const pausePromise = bridge.pause('ord-cancel-notimer', 'orders', makeState(), 0);

    // cancel() with entry.timer === undefined exercises the if(entry.timer) false branch
    const cancelled = bridge.cancel('ord-cancel-notimer');

    expect(cancelled).toBe(true);
    await expect(pausePromise).rejects.toThrow(/cancelled/i);
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
  it('internal timer rejects expired entries automatically (no manual cleanup needed)', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-timer-expire', 'orders', makeState(), 50);

    // Advance fake timers to fire the internal setTimeout
    vi.advanceTimersByTime(100);
    await expect(p).rejects.toThrow(/timeout/i);

    // Entry cleaned up by the internal timer
    expect(bridge.size).toBe(0);
    expect(bridge.isPaused('ord-timer-expire')).toBe(false);
    expect(getPausedCount()).toBe(0);
  });

  it('cleanup() manually removes and rejects expired entries when the system clock is advanced without firing timers', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-manual-cleanup', 'orders', makeState(), 100);

    // Advance system clock past timeout WITHOUT firing the internal setTimeout timer
    vi.setSystemTime(Date.now() + 200);

    // Bridge should still be paused (internal timer has not fired yet)
    expect(bridge.isPaused('ord-manual-cleanup')).toBe(true);
    expect(bridge.size).toBe(1);
    expect(getPausedCount()).toBe(1);

    // cleanup() finds the expired entry and rejects it
    const removed = bridge.cleanup();
    expect(removed).toBe(1);
    expect(bridge.size).toBe(0);
    expect(bridge.isPaused('ord-manual-cleanup')).toBe(false);
    expect(getPausedCount()).toBe(0);

    // Promise rejects with "expired" message
    await expect(p).rejects.toThrow(/expired/i);
  });

  it('cleanup() returns 0 when no entries have expired yet', async () => {
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

  it('cleanup() does not remove entries with timeoutMs=0 (no-timeout entries)', async () => {
    const bridge = new ServerCorrelationBridge('exec-1', 'wf-1');
    const p = bridge.pause('ord-no-timeout-cleanup', 'orders', makeState(), 0);

    // Advance the clock far into the future
    vi.setSystemTime(Date.now() + 1_000_000);

    // cleanup() should NOT remove a no-timeout entry (timeoutAt === 0)
    const removed = bridge.cleanup();
    expect(removed).toBe(0);
    expect(bridge.isPaused('ord-no-timeout-cleanup')).toBe(true);

    // Clean up
    notifyResume('ord-no-timeout-cleanup', makeResumeData());
    await p;
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

// ── Kafka dispatch round-trip ─────────────────────────────────────────────────
//
// Tests the full production path: bridge.pause() registers both in the server
// activeStore AND in resumeWaiters. dispatchKafkaResumeMessage() matches the
// entry, removes it from the store, and calls notifyResume() which fires the
// bridge's in-process waiter, resolving the Promise.

function makeKafkaMsg(overrides: Partial<KafkaResumeMessage> = {}): KafkaResumeMessage {
  return {
    topic: 'orders',
    partition: 0,
    offset: '5',
    key: 'ord-rt',
    value: JSON.stringify({ orderId: 'ord-rt', status: 'shipped' }),
    headers: {},
    ...overrides,
  };
}

describe('ServerCorrelationBridge — Kafka dispatch round-trip', () => {
  it('bridge.pause() (body source) + dispatchKafkaResumeMessage() resolves the Promise with Kafka message data', async () => {
    const bridge = new ServerCorrelationBridge('exec-rt', 'wf-1');
    const pausePromise = bridge.pause('ord-rt', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'body',
      correlationJsonPath: 'orderId',
    });

    // Verify entry is registered in the active store
    expect(getPausedCount()).toBe(1);
    expect(bridge.isPaused('ord-rt')).toBe(true);
    const storedEntry = findByCorrelationId('ord-rt');
    expect(storedEntry?.correlationSource).toBe('body');
    expect(storedEntry?.correlationJsonPath).toBe('orderId');

    // Dispatch a Kafka message matching the correlationId via JSON body
    const outcome = dispatchKafkaResumeMessage(makeKafkaMsg());
    expect(outcome.resumed).toBe(true);
    if (!outcome.resumed) return;
    expect(outcome.correlationId).toBe('ord-rt');
    expect(outcome.executionId).toBe('exec-rt');

    // Bridge's Promise resolves with the Kafka message fields
    const result = await pausePromise;
    expect(result).toMatchObject({
      topic: 'orders',
      partition: 0,
      offset: '5',
      key: 'ord-rt',
    });
    expect((result['value'] as string)).toContain('shipped');

    // Active store entry is gone
    expect(getPausedCount()).toBe(0);
    expect(bridge.isPaused('ord-rt')).toBe(false);
  });

  it('bridge.pause() (key source) + dispatchKafkaResumeMessage() matches via Kafka message key', async () => {
    const bridge = new ServerCorrelationBridge('exec-rt-key', 'wf-1');
    const pausePromise = bridge.pause('my-key', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'key',
    });

    const outcome = dispatchKafkaResumeMessage(makeKafkaMsg({
      key: 'my-key',
      offset: '10',
      headers: { 'x-trace': 'abc' },
    }));

    expect(outcome.resumed).toBe(true);

    const result = await pausePromise;
    expect(result['key']).toBe('my-key');
    expect((result['headers'] as Record<string, string>)['x-trace']).toBe('abc');
    expect(getPausedCount()).toBe(0);
  });

  it('bridge.pause() (header source) + dispatchKafkaResumeMessage() matches via header', async () => {
    const bridge = new ServerCorrelationBridge('exec-rt-hdr', 'wf-1');
    const pausePromise = bridge.pause('hdr-corr-val', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'header',
      correlationHeader: 'x-correlation-id',
    });

    const outcome = dispatchKafkaResumeMessage(makeKafkaMsg({
      headers: { 'x-correlation-id': 'hdr-corr-val' },
    }));

    expect(outcome.resumed).toBe(true);
    const result = await pausePromise;
    expect((result['headers'] as Record<string, string>)['x-correlation-id']).toBe('hdr-corr-val');
    expect(getPausedCount()).toBe(0);
  });

  it('dispatchKafkaResumeMessage on wrong topic returns no-match; bridge remains paused', async () => {
    const bridge = new ServerCorrelationBridge('exec-rt-nm', 'wf-1');
    const pausePromise = bridge.pause('ord-nm', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'body',
      correlationJsonPath: 'orderId',
    });

    const outcome = dispatchKafkaResumeMessage(makeKafkaMsg({ topic: 'payments' }));
    expect(outcome.resumed).toBe(false);
    if (outcome.resumed) return;
    expect(outcome.reason).toBe('no-match');

    // Bridge is still waiting
    expect(bridge.isPaused('ord-nm')).toBe(true);
    expect(getPausedCount()).toBe(1);

    // Clean up
    bridge.cancel('ord-nm');
    await pausePromise.catch(() => {});
    expect(getPausedCount()).toBe(0);
  });

  it('dispatchKafkaResumeMessage with mismatched correlationId returns no-match; bridge remains paused', async () => {
    const bridge = new ServerCorrelationBridge('exec-rt-mm', 'wf-1');
    const pausePromise = bridge.pause('ord-waiting', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'body',
      correlationJsonPath: 'orderId',
    });

    // Message has orderId 'ord-other', not 'ord-waiting'
    const outcome = dispatchKafkaResumeMessage(makeKafkaMsg({
      value: JSON.stringify({ orderId: 'ord-other' }),
    }));
    expect(outcome.resumed).toBe(false);

    expect(bridge.isPaused('ord-waiting')).toBe(true);

    bridge.cancel('ord-waiting');
    await pausePromise.catch(() => {});
  });

  it('idempotent replay after bridge resolves returns duplicate outcome', async () => {
    const bridge = new ServerCorrelationBridge('exec-rt-idem', 'wf-1');
    const pausePromise = bridge.pause('ord-idem', 'orders', makeState(), 5000, undefined, {
      correlationSource: 'body',
      correlationJsonPath: 'orderId',
    });

    const msg = makeKafkaMsg({ value: JSON.stringify({ orderId: 'ord-idem' }) });

    // First dispatch: resumes bridge
    const first = dispatchKafkaResumeMessage(msg);
    expect(first.resumed).toBe(true);
    await pausePromise; // resolved

    // Second dispatch of same offset: no active match, idempotency store hit
    const second = dispatchKafkaResumeMessage(msg);
    expect(second.resumed).toBe(false);
    if (second.resumed) return;
    expect(second.reason).toBe('duplicate');
  });
});
