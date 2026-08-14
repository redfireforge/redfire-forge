/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOG_STREAM_URL, subscribeLogStream } from './logStream';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

describe('subscribeLogStream', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('subscribes to the companion log stream', () => {
    const onMessage = vi.fn();
    const stop = subscribeLogStream(onMessage);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe(LOG_STREAM_URL);
    FakeEventSource.instances[0].onmessage?.({ data: 'hello' });
    expect(onMessage).toHaveBeenCalledWith('hello');
    stop();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('closes on error and reconnects with backoff instead of native retry', () => {
    const stop = subscribeLogStream(vi.fn());
    const first = FakeEventSource.instances[0];
    first.onerror?.();
    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.instances).toHaveLength(2);

    FakeEventSource.instances[1].onerror?.();
    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.instances).toHaveLength(3);
    stop();
  });

  it('stops reconnecting after the failure cap', () => {
    subscribeLogStream(vi.fn());
    for (let i = 0; i < 12; i++) {
      const last = FakeEventSource.instances[FakeEventSource.instances.length - 1];
      last.onerror?.();
      vi.advanceTimersByTime(20_000);
    }
    expect(FakeEventSource.instances.length).toBe(8);
  });

  it('does not reconnect after stop', () => {
    const stop = subscribeLogStream(vi.fn());
    FakeEventSource.instances[0].onerror?.();
    stop();
    vi.advanceTimersByTime(20_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('ignores late error callbacks after stop', () => {
    const stop = subscribeLogStream(vi.fn());
    const first = FakeEventSource.instances[0];
    stop();

    first.onerror?.();
    vi.advanceTimersByTime(20_000);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(first.closed).toBe(true);
  });

  it('does not reconnect if a queued retry callback runs after stop', () => {
    let queuedRetry: (() => void) | null = null;
    const clearTimeoutSpy = vi.fn();

    vi.stubGlobal('setTimeout', ((callback: TimerHandler) => {
      queuedRetry = callback as () => void;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
    vi.stubGlobal('clearTimeout', clearTimeoutSpy as typeof clearTimeout);

    const stop = subscribeLogStream(vi.fn());
    FakeEventSource.instances[0].onerror?.();
    stop();
    queuedRetry?.();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('is a no-op when EventSource is missing', () => {
    vi.stubGlobal('EventSource', undefined);
    const stop = subscribeLogStream(vi.fn());
    expect(stop).toBeTypeOf('function');
    expect(() => stop()).not.toThrow();
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('swallows EventSource construction failures', () => {
    vi.stubGlobal('EventSource', class {
      constructor() {
        throw new Error('boom');
      }
    } as unknown as typeof EventSource);
    expect(() => subscribeLogStream(vi.fn())()).not.toThrow();
  });
});
