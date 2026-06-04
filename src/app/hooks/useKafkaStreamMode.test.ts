/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKafkaStreamMode } from './useKafkaStreamMode';
import type { UseKafkaStateReturn } from './useKafkaState';
import type { KafkaConsumeDraft } from '../../features/kafka/types';

function makeKafkaState(overrides?: Partial<UseKafkaStateReturn>): UseKafkaStateReturn {
  return {
    loaded: true,
    clusters: [],
    selectedClusterId: 'cluster-1',
    selectedCluster: null,
    connection: { state: 'connected', lastError: null },
    autoConnect: { enabled: false, clusterId: null },
    addCluster: vi.fn(),
    updateCluster: vi.fn(),
    removeCluster: vi.fn(),
    selectCluster: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    setAutoConnect: vi.fn(),
    ...overrides,
  } as unknown as UseKafkaStateReturn;
}

function makeDraft(topic = 'test-topic'): KafkaConsumeDraft {
  return {
    topic,
    groupId: 'group-1',
    startPosition: 'earliest',
    timeoutMs: '10000',
    maxMessages: '50',
    keyEquals: '',
    headerMatch: '',
    jsonPath: '',
    jsonPathEquals: '',
  };
}

describe('useKafkaStreamMode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial state: isStreaming=false, streamMessages=[]', () => {
    const { result } = renderHook(() => useKafkaStreamMode(makeKafkaState()));
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamMessages).toEqual([]);
    expect(result.current.streamError).toBeNull();
    expect(result.current.cursorGap).toBe(false);
  });

  it('startStream success: sets isStreaming=true, stores subscriptionId', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { subscription: { subscriptionId: 'sub-123', topic: 'test-topic', groupId: 'g', createdAt: '2026-01-01' } },
    });

    const { result } = renderHook(() =>
      useKafkaStreamMode(makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.startStream(makeDraft(), 'cluster-1');
    });

    expect(result.current.isStreaming).toBe(true);
    expect(result.current.streamSubscriptionId).toBe('sub-123');
    expect(dispatch).toHaveBeenCalledWith('subscribe', expect.objectContaining({ topic: 'test-topic' }));
  });

  it('startStream with blank topic: sets streamError, does not dispatch', async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useKafkaStreamMode(makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.startStream(makeDraft(''), 'cluster-1');
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamError).not.toBeNull();
    expect(result.current.streamError?.code).toBe('KAFKA_INVALID_SUBSCRIBE');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('startStream when not connected: sets streamError', async () => {
    const dispatch = vi.fn();
    const state = makeKafkaState({ connection: { state: 'disconnected', lastError: null } as UseKafkaStateReturn['connection'] });

    const { result } = renderHook(() =>
      useKafkaStreamMode(state, { dispatch }),
    );

    await act(async () => {
      await result.current.startStream(makeDraft(), 'cluster-1');
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamError?.code).toBe('KAFKA_NOT_CONNECTED');
  });

  it('stopStream: fires unsubscribe, keeps messages', async () => {
    const dispatch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { subscription: { subscriptionId: 'sub-1', topic: 't', groupId: 'g', createdAt: '' } },
      })
      .mockResolvedValue({ ok: true, data: { messages: [], cursor: 0 } });

    const { result } = renderHook(() =>
      useKafkaStreamMode(makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.startStream(makeDraft(), 'cluster-1');
    });
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      await result.current.stopStream();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(dispatch).toHaveBeenCalledWith('unsubscribe', expect.objectContaining({ subscriptionId: 'sub-1' }));
  });

  it('clearStreamMessages: resets to []', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { subscription: { subscriptionId: 'sub-x', topic: 't', groupId: 'g', createdAt: '' } },
    });
    const { result } = renderHook(() =>
      useKafkaStreamMode(makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.startStream(makeDraft(), 'cluster-1');
    });

    act(() => {
      result.current.clearStreamMessages();
    });

    expect(result.current.streamMessages).toEqual([]);
    expect(result.current.cursorGap).toBe(false);
  });

  it('selectStreamMessage / detail selection works', () => {
    const { result } = renderHook(() => useKafkaStreamMode(makeKafkaState()));

    act(() => {
      result.current.selectStreamMessage(0);
    });
    expect(result.current.selectedStreamIndex).toBe(0);

    act(() => {
      result.current.selectStreamMessage(null);
    });
    expect(result.current.selectedStreamIndex).toBeNull();
  });

  it('web polling: appends new messages from subscription-messages response', async () => {
    let pollCount = 0;
    const dispatch = vi.fn().mockImplementation((op: string) => {
      if (op === 'subscribe') {
        return Promise.resolve({
          ok: true,
          data: { subscription: { subscriptionId: 'sub-poll', topic: 't', groupId: 'g', createdAt: '' } },
        });
      }
      if (op === 'subscription-messages') {
        pollCount++;
        if (pollCount === 1) {
          return Promise.resolve({
            ok: true,
            data: {
              subscriptionId: 'sub-poll',
              messages: [{ topic: 't', partition: 0, offset: '1', value: '{"seq":1}' }],
              cursor: 1,
            },
          });
        }
        return Promise.resolve({
          ok: true,
          data: { subscriptionId: 'sub-poll', messages: [], cursor: 1 },
        });
      }
      return Promise.resolve({ ok: true, data: {} });
    });

    const { result } = renderHook(() =>
      useKafkaStreamMode(makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.startStream(makeDraft(), 'cluster-1');
    });

    // Advance timer to trigger first poll and flush microtasks
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(result.current.streamMessages.length).toBeGreaterThanOrEqual(1);
    expect(result.current.streamMessages[0].value).toBe('{"seq":1}');

    // Clean up to avoid lingering intervals
    await act(async () => {
      await result.current.stopStream();
    });
  });

  it('cursorGap=true when server indicates buffer wrap', async () => {
    const dispatch = vi.fn().mockImplementation((op: string) => {
      if (op === 'subscribe') {
        return Promise.resolve({
          ok: true,
          data: { subscription: { subscriptionId: 'sub-gap', topic: 't', groupId: 'g', createdAt: '' } },
        });
      }
      if (op === 'subscription-messages') {
        return Promise.resolve({
          ok: true,
          data: {
            subscriptionId: 'sub-gap',
            messages: [{ topic: 't', partition: 0, offset: '100', value: '{}' }],
            cursor: 100,
            cursorGap: true,
          },
        });
      }
      return Promise.resolve({ ok: true, data: {} });
    });

    const { result } = renderHook(() =>
      useKafkaStreamMode(makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.startStream(makeDraft(), 'cluster-1');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(result.current.cursorGap).toBe(true);

    await act(async () => {
      await result.current.stopStream();
    });
  });

  it('disconnect cleanup: auto-stops stream on connection state change', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { subscription: { subscriptionId: 'sub-dc', topic: 't', groupId: 'g', createdAt: '' } },
    });

    const kafkaState = makeKafkaState();
    const { result, rerender } = renderHook(
      ({ state }) => useKafkaStreamMode(state, { dispatch }),
      { initialProps: { state: kafkaState } },
    );

    await act(async () => {
      await result.current.startStream(makeDraft(), 'cluster-1');
    });
    expect(result.current.isStreaming).toBe(true);

    // Simulate disconnect
    const disconnected = makeKafkaState({
      connection: { state: 'disconnected', lastError: null } as UseKafkaStateReturn['connection'],
    });
    rerender({ state: disconnected });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamSubscriptionId).toBeNull();
  });
});
