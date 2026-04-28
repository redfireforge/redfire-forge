import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryCorrelationStore } from './correlationStore';
import type { WorkflowPausedState } from '../types/workflow';

// ── helpers ──────────────────────────────────────────

function makeState(overrides: Partial<WorkflowPausedState> = {}): WorkflowPausedState {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { x: '1' },
    visitedNodes: ['start'],
    pausedNodeId: 'cw1',
    threadId: 'main',
    joinArrived: {},
    results: [],
    startTime: 1000,
    initialVariables: {},
    ...overrides,
  };
}

// ── InMemoryCorrelationStore ────────────────────────

describe('InMemoryCorrelationStore', () => {
  let store: InMemoryCorrelationStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryCorrelationStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── pause + resume ─────────────────────────────

  it('pause and resume with matching correlationId', async () => {
    const state = makeState();
    const promise = store.pause('corr-1', '/webhooks/payment', state, 5000);

    expect(store.isPaused('corr-1')).toBe(true);
    expect(store.size).toBe(1);

    const resumed = store.resume('corr-1', { status: 'approved', amount: 99.99 });
    expect(resumed).toBe(true);

    const data = await promise;
    expect(data).toEqual({ status: 'approved', amount: 99.99 });
    expect(store.isPaused('corr-1')).toBe(false);
    expect(store.size).toBe(0);
  });

  it('resume returns false when no matching correlationId', () => {
    expect(store.resume('nonexistent', { data: 1 })).toBe(false);
  });

  it('rejects duplicate correlationId', async () => {
    const state = makeState();
    // Start first pause (don't await — it's pending)
    const p1 = store.pause('dup-1', '/wh', state, 5000);
    // Second pause with same ID should reject immediately
    await expect(store.pause('dup-1', '/wh', state, 5000)).rejects.toThrow('already paused');

    // Clean up first pause
    store.resume('dup-1', {});
    await p1;
  });

  // ── timeout ────────────────────────────────────

  it('rejects with timeout error when timeoutMs expires', async () => {
    const state = makeState();
    const promise = store.pause('timeout-1', '/wh', state, 100);

    // Advance time past timeout
    vi.advanceTimersByTime(101);

    await expect(promise).rejects.toThrow('Correlation timeout');
    expect(store.isPaused('timeout-1')).toBe(false);
    expect(store.size).toBe(0);
  });

  it('does not timeout when timeoutMs is 0 (unlimited)', async () => {
    const state = makeState();
    const promise = store.pause('no-timeout', '/wh', state, 0);

    // Advance a long time — should NOT timeout
    vi.advanceTimersByTime(999999);

    expect(store.isPaused('no-timeout')).toBe(true);

    // Resume to clean up
    store.resume('no-timeout', { ok: true });
    const data = await promise;
    expect(data).toEqual({ ok: true });
  });

  it('clears timeout timer when resumed before expiry', async () => {
    const state = makeState();
    const promise = store.pause('early-resume', '/wh', state, 5000);

    // Resume immediately
    store.resume('early-resume', { fast: true });
    const data = await promise;
    expect(data).toEqual({ fast: true });

    // Advance past original timeout — should NOT throw
    vi.advanceTimersByTime(6000);
    expect(store.size).toBe(0);
  });

  // ── cancel ─────────────────────────────────────

  it('cancel rejects the pause promise', async () => {
    const state = makeState();
    const promise = store.pause('cancel-1', '/wh', state, 5000);

    const cancelled = store.cancel('cancel-1');
    expect(cancelled).toBe(true);
    expect(store.isPaused('cancel-1')).toBe(false);

    await expect(promise).rejects.toThrow('Correlation cancelled');
  });

  it('cancel returns false for nonexistent correlationId', () => {
    expect(store.cancel('no-such')).toBe(false);
  });

  it('cancel clears timeout timer', async () => {
    const state = makeState();
    const promise = store.pause('cancel-timer', '/wh', state, 5000);

    store.cancel('cancel-timer');

    // Advance past original timeout — should not double-reject
    vi.advanceTimersByTime(6000);

    await expect(promise).rejects.toThrow('cancelled');
    expect(store.size).toBe(0);
  });

  // ── get ────────────────────────────────────────

  it('get returns the paused entry', async () => {
    const state = makeState({ executionId: 'get-test' });
    const promise = store.pause('get-1', '/wh/test', state, 5000, 'type==payment');

    const entry = store.get('get-1');
    expect(entry).toBeDefined();
    expect(entry!.correlationId).toBe('get-1');
    expect(entry!.webhookPath).toBe('/wh/test');
    expect(entry!.state.executionId).toBe('get-test');
    expect(entry!.webhookFilter).toBe('type==payment');
    expect(entry!.timeoutAt).toBeGreaterThan(0);

    // Clean up
    store.cancel('get-1');
    await expect(promise).rejects.toThrow('cancelled');
  });

  it('get returns undefined for nonexistent correlationId', () => {
    expect(store.get('nope')).toBeUndefined();
  });

  // ── isPaused ───────────────────────────────────

  it('isPaused returns false for nonexistent correlationId', () => {
    expect(store.isPaused('nope')).toBe(false);
  });

  // ── cleanup ────────────────────────────────────

  it('cleanup removes expired entries', async () => {
    const state1 = makeState({ executionId: 'e1' });
    const state2 = makeState({ executionId: 'e2' });
    const p1 = store.pause('exp-1', '/wh', state1, 100);
    const p2 = store.pause('exp-2', '/wh', state2, 200);

    // Advance past first timeout but not second
    vi.advanceTimersByTime(150);

    // p1 should already be rejected by its own timer
    await expect(p1).rejects.toThrow('Correlation timeout');

    // Now run cleanup — p2 has NOT expired yet
    const cleaned = store.cleanup();
    expect(cleaned).toBe(0); // p1 was already removed by timer

    // Advance past second timeout
    vi.advanceTimersByTime(100);
    await expect(p2).rejects.toThrow('Correlation timeout');
  });

  it('cleanup removes entries whose timeout passed (manual check)', async () => {
    vi.useRealTimers(); // Use real timers so setTimeout doesn't fire automatically
    vi.useFakeTimers({ shouldAdvanceTime: false });

    const store2 = new InMemoryCorrelationStore();
    const state = makeState();

    // Create entry with very long timeout (won't fire via setTimeout in test)
    const promise = store2.pause('cleanup-manual', '/wh', state, 50);

    // Manually set Date.now past the timeout
    vi.setSystemTime(Date.now() + 100);

    const cleaned = store2.cleanup();
    expect(cleaned).toBe(1);
    expect(store2.isPaused('cleanup-manual')).toBe(false);

    await expect(promise).rejects.toThrow('expired during cleanup');
  });

  it('cleanup skips entries with timeoutAt = 0 (unlimited)', async () => {
    const state = makeState();
    const promise = store.pause('no-expire', '/wh', state, 0);

    vi.advanceTimersByTime(999999);
    const cleaned = store.cleanup();
    expect(cleaned).toBe(0);
    expect(store.isPaused('no-expire')).toBe(true);

    // Clean up
    store.cancel('no-expire');
    await expect(promise).rejects.toThrow('cancelled');
  });

  // ── listPaused ─────────────────────────────────

  it('listPaused returns all paused entries', async () => {
    const s1 = makeState({ executionId: 'e1' });
    const s2 = makeState({ executionId: 'e2' });
    const p1 = store.pause('list-1', '/wh1', s1, 5000);
    const p2 = store.pause('list-2', '/wh2', s2, 5000);

    const list = store.listPaused();
    expect(list).toHaveLength(2);
    expect(list.map(e => e.correlationId).sort()).toEqual(['list-1', 'list-2']);

    // Clean up
    store.cancel('list-1');
    store.cancel('list-2');
    await expect(p1).rejects.toThrow('cancelled');
    await expect(p2).rejects.toThrow('cancelled');
  });

  it('listPaused returns empty array when nothing is paused', () => {
    expect(store.listPaused()).toEqual([]);
  });

  // ── size ───────────────────────────────────────

  it('size reflects current count', async () => {
    expect(store.size).toBe(0);

    const s1 = makeState();
    const p1 = store.pause('size-1', '/wh', s1, 5000);
    expect(store.size).toBe(1);

    const p2 = store.pause('size-2', '/wh', s1, 5000);
    expect(store.size).toBe(2);

    store.resume('size-1', {});
    await p1;
    expect(store.size).toBe(1);

    store.cancel('size-2');
    await expect(p2).rejects.toThrow('cancelled');
    expect(store.size).toBe(0);
  });

  // ── edge cases ─────────────────────────────────

  it('multiple pause/resume cycles with same correlationId', async () => {
    const state = makeState();

    // First cycle
    const p1 = store.pause('reuse-1', '/wh', state, 5000);
    store.resume('reuse-1', { cycle: 1 });
    expect(await p1).toEqual({ cycle: 1 });

    // Second cycle — same correlationId should work
    const p2 = store.pause('reuse-1', '/wh', state, 5000);
    store.resume('reuse-1', { cycle: 2 });
    expect(await p2).toEqual({ cycle: 2 });
  });

  it('webhookFilter is stored and accessible', async () => {
    const state = makeState();
    const promise = store.pause('filter-1', '/wh', state, 5000, '{{webhook.type}} == payment');

    const entry = store.get('filter-1');
    expect(entry!.webhookFilter).toBe('{{webhook.type}} == payment');

    store.cancel('filter-1');
    await expect(promise).rejects.toThrow('cancelled');
  });

  it('pausedAt timestamp is captured', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const state = makeState();
    const promise = store.pause('ts-1', '/wh', state, 5000);

    const entry = store.get('ts-1');
    expect(entry!.pausedAt).toBe(new Date('2026-01-01T00:00:00Z').getTime());

    store.cancel('ts-1');
    await expect(promise).rejects.toThrow('cancelled');
  });

  it('timeoutAt is correctly computed', async () => {
    vi.setSystemTime(1000);
    const state = makeState();
    const promise = store.pause('ta-1', '/wh', state, 5000);

    const entry = store.get('ta-1');
    expect(entry!.timeoutAt).toBe(6000); // 1000 + 5000

    store.cancel('ta-1');
    await expect(promise).rejects.toThrow('cancelled');
  });

  it('timeoutAt is 0 when timeoutMs is 0', async () => {
    const state = makeState();
    const promise = store.pause('ta-0', '/wh', state, 0);

    const entry = store.get('ta-0');
    expect(entry!.timeoutAt).toBe(0);

    store.cancel('ta-0');
    await expect(promise).rejects.toThrow('cancelled');
  });
});
