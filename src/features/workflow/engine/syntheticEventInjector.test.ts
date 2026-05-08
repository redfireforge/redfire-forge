import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyntheticEventInjector } from './syntheticEventInjector';
import { InMemoryCorrelationStore } from './correlationStore';
import type { WorkflowPausedState } from '../types/workflow';

describe('SyntheticEventInjector', () => {
  let store: InMemoryCorrelationStore;
  let injector: SyntheticEventInjector;

  const makePausedState = (pausedNodeId: string): WorkflowPausedState => ({
    executionId: 'exec-1',
    workflowId: 'wf-1',
    pausedNodeId,
    variables: {},
    visitedNodes: [],
    threadId: 'thread-1',
    joinArrived: {},
    results: [],
    startTime: Date.now(),
    initialVariables: {},
  });

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryCorrelationStore();
  });

  afterEach(() => {
    injector?.stop();
    vi.useRealTimers();
  });

  it('should start and stop without errors', () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 100,
    });

    expect(injector.isRunning).toBe(false);
    injector.start();
    expect(injector.isRunning).toBe(true);
    injector.start();
    expect(injector.isRunning).toBe(true);
    injector.stop();
    expect(injector.isRunning).toBe(false);
  });

  it('should resume paused entries after configured delay', async () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 200,
      mockPayloads: {
        'node-1': { status: 'completed', paymentId: '{{correlationId}}' },
      },
    });
    injector.start();

    // Pause a workflow
    const resumePromise = store.pause(
      'corr-123',
      '/webhooks/payment',
      makePausedState('node-1'),
      300000,
    );

    // Advance past the poll interval (50ms) to detect the paused entry
    await vi.advanceTimersByTimeAsync(60);
    expect(injector.pendingCount).toBe(1);

    // Advance past the delay (200ms)
    await vi.advanceTimersByTimeAsync(200);

    // The promise should resolve with the mock payload
    const result = await resumePromise;
    expect(result).toEqual({ status: 'completed', paymentId: 'corr-123' });
  });

  it('should resolve {{correlationId}} placeholders in nested objects', async () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 50,
      mockPayloads: {
        'node-1': {
          outer: {
            inner: '{{correlationId}}',
            array: ['static', 123],
          },
          id: '{{correlationId}}',
        },
      },
    });
    injector.start();

    const resumePromise = store.pause(
      'test-id-456',
      '/webhooks/test',
      makePausedState('node-1'),
      300000,
    );

    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(50);

    const result = await resumePromise;
    expect(result).toEqual({
      outer: {
        inner: 'test-id-456',
        array: ['static', 123],
      },
      id: 'test-id-456',
    });
  });

  it('should use defaultPayload when no node-specific payload is configured', async () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 50,
      defaultPayload: { status: 'default', id: '{{correlationId}}' },
    });
    injector.start();

    const resumePromise = store.pause(
      'corr-789',
      '/webhooks/other',
      makePausedState('unknown-node'),
      300000,
    );

    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(50);

    const result = await resumePromise;
    expect(result).toEqual({ status: 'default', id: 'corr-789' });
  });

  it('should apply jitter to delay', async () => {
    // Mock random to return 0.75
    // Jitter calculation: 0.75 * jitterMs * 2 - jitterMs = 0.75 * 50 * 2 - 50 = 25
    // Total delay = 100 + 25 = 125ms
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 100,
      jitterMs: 50,
    });
    injector.start();

    const resumePromise = store.pause(
      'corr-jitter',
      '/webhooks/jitter',
      makePausedState('node-1'),
      300000,
    );

    // Advance enough time for poll + delay
    // Poll detects at ~50ms, delay is 125ms, so total ~175ms
    await vi.advanceTimersByTimeAsync(200);

    // Should have been resumed
    expect(store.isPaused('corr-jitter')).toBe(false);

    const result = await resumePromise;
    expect(result).toEqual({});
  });

  it('should handle multiple paused entries concurrently', async () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 100,
      defaultPayload: { status: 'ok' },
    });
    injector.start();

    const promise1 = store.pause('corr-1', '/webhooks/a', makePausedState('node-1'), 300000);
    const promise2 = store.pause('corr-2', '/webhooks/b', makePausedState('node-1'), 300000);
    const promise3 = store.pause('corr-3', '/webhooks/c', makePausedState('node-1'), 300000);

    await vi.advanceTimersByTimeAsync(60);
    expect(injector.pendingCount).toBe(3);

    await vi.advanceTimersByTimeAsync(100);

    const [r1, r2, r3] = await Promise.all([promise1, promise2, promise3]);
    expect(r1).toEqual({ status: 'ok' });
    expect(r2).toEqual({ status: 'ok' });
    expect(r3).toEqual({ status: 'ok' });
  });

  it('should not process same correlation ID twice', async () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 100,
      defaultPayload: { status: 'ok' },
    });
    injector.start();

    const resumePromise = store.pause(
      'corr-once',
      '/webhooks/once',
      makePausedState('node-1'),
      300000,
    );

    // First poll
    await vi.advanceTimersByTimeAsync(60);
    expect(injector.pendingCount).toBe(1);

    // Second poll - should not add another pending injection
    await vi.advanceTimersByTimeAsync(50);
    expect(injector.pendingCount).toBe(1);

    // Complete the injection
    await vi.advanceTimersByTimeAsync(100);
    await resumePromise;
  });

  it('should cancel pending injections when stopped', async () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 1000,
      defaultPayload: { status: 'ok' },
    });
    injector.start();

    store.pause('corr-cancel', '/webhooks/cancel', makePausedState('node-1'), 300000);

    await vi.advanceTimersByTimeAsync(60);
    expect(injector.pendingCount).toBe(1);

    injector.stop();
    expect(injector.pendingCount).toBe(0);

    // Entry should still be paused (not resumed)
    expect(store.isPaused('corr-cancel')).toBe(true);
  });

  it('should not resume if entry was already resumed externally', async () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 200,
      defaultPayload: { status: 'synthetic' },
    });
    injector.start();

    const resumePromise = store.pause(
      'corr-external',
      '/webhooks/external',
      makePausedState('node-1'),
      300000,
    );

    await vi.advanceTimersByTimeAsync(60);

    // External system resumes before injector fires
    store.resume('corr-external', { status: 'external' });

    const result = await resumePromise;
    expect(result).toEqual({ status: 'external' });

    // Injector fires but entry is already gone - should not throw
    await vi.advanceTimersByTimeAsync(200);
  });

  it('should handle empty mockPayloads gracefully', async () => {
    injector = new SyntheticEventInjector(store, {
      responseDelayMs: 50,
    });
    injector.start();

    const resumePromise = store.pause(
      'corr-empty',
      '/webhooks/empty',
      makePausedState('node-1'),
      300000,
    );

    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(50);

    const result = await resumePromise;
    expect(result).toEqual({});
  });

  it('short-circuits checkForNewPausedEntries when stopped', () => {
    injector = new SyntheticEventInjector(store, { responseDelayMs: 50 });
    injector.start();
    injector.stop();
    (injector as unknown as { checkForNewPausedEntries: () => void }).checkForNewPausedEntries();
  });

  it('skips executeInjection when stopped before the delay elapses', async () => {
    injector = new SyntheticEventInjector(store, { responseDelayMs: 100 });
    injector.start();
    const resumePromise = store.pause('corr-stopped', '/w', makePausedState('n1'), 300000);
    await vi.advanceTimersByTimeAsync(60);
    expect(injector.pendingCount).toBe(1);
    (injector as unknown as { stopped: boolean }).stopped = true;
    await vi.advanceTimersByTimeAsync(150);
    expect(store.isPaused('corr-stopped')).toBe(true);
    store.resume('corr-stopped', { manual: true });
    await expect(resumePromise).resolves.toEqual({ manual: true });
    injector.stop();
  });
});
