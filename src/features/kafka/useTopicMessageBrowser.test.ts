/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTopicMessageBrowser } from './useTopicMessageBrowser';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';
import type { KafkaConsumeResultRow } from './types';

function makeKafkaState(overrides?: Partial<UseKafkaStateReturn>): UseKafkaStateReturn {
  return {
    loaded: true,
    clusters: [],
    selectedClusterId: 'test-cluster',
    selectedCluster: null,
    connection: { state: 'connected', clusterId: 'test-cluster' } as UseKafkaStateReturn['connection'],
    topics: [],
    topicsLoading: false,
    topicsError: null,
    includeInternalTopics: false,
    lastError: null,
    lastErrorDetail: null,
    statusPollFailureStreak: 0,
    autoConnectOnStartup: false,
    setAutoConnectOnStartup: vi.fn(),
    setIncludeInternalTopics: vi.fn(),
    setSelectedClusterId: vi.fn(),
    upsertCluster: vi.fn(),
    removeCluster: vi.fn(),
    replaceClusters: vi.fn(),
    connectSelectedCluster: vi.fn(),
    disconnectActiveCluster: vi.fn(),
    testSelectedClusterConnection: vi.fn(),
    refreshConnectionStatus: vi.fn(),
    refreshTopics: vi.fn(),
    setConnectionState: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  } as unknown as UseKafkaStateReturn;
}

const SAMPLE_ROWS: KafkaConsumeResultRow[] = [
  { topic: 'orders.created', partition: 0, offset: '1', value: '{"a":1}', key: 'k1' },
  { topic: 'orders.created', partition: 1, offset: '2', value: '{"a":2}' },
];

describe('useTopicMessageBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initial state: empty result, no selected message', () => {
    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState()),
    );

    expect(result.current.result).toBeNull();
    expect(result.current.selectedIndex).toBeNull();
    expect(result.current.selectedMessage).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.timedOut).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.messageCount).toBe(0);
  });

  it('consumeOnce success sets result rows and clears error', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 'orders.created', messages: SAMPLE_ROWS },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(result.current.result).toEqual(SAMPLE_ROWS);
    expect(result.current.error).toBeNull();
    expect(result.current.messageCount).toBe(2);
    expect(dispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({
      topic: 'orders.created',
      clusterId: 'test-cluster',
    }));
  });

  it('consumeOnce sets timedOut true on timeout response', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 'orders.created', messages: [], timedOut: true },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(result.current.timedOut).toBe(true);
    expect(result.current.result).toEqual([]);
  });

  it('consumeOnce sets error on dispatch failure', async () => {
    const dispatch = vi.fn().mockRejectedValue(new Error('consume failed'));

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('topicName change resets result and error to null', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 'orders.created', messages: SAMPLE_ROWS },
    });

    const { result, rerender } = renderHook(
      ({ topic }) => useTopicMessageBrowser(topic, makeKafkaState(), { dispatch }),
      { initialProps: { topic: 'orders.created' } },
    );

    await act(async () => {
      await result.current.consumeOnce();
    });
    expect(result.current.result).toEqual(SAMPLE_ROWS);

    rerender({ topic: 'payments.settled' });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.timedOut).toBe(false);
    expect(result.current.selectedIndex).toBeNull();
  });

  it('selectMessage and clearResult work correctly', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 'orders.created', messages: SAMPLE_ROWS },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.consumeOnce();
    });

    act(() => {
      result.current.selectMessage(1);
    });
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.selectedMessage).toEqual(SAMPLE_ROWS[1]);

    act(() => {
      result.current.clearResult();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.selectedIndex).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('injectable dispatch from deps is called instead of default', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 't', messages: [] },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('my-topic', makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0]).toBe('consume-once');
  });

  it('partition filter passes to consume request', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 'orders.created', messages: [] },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    act(() => {
      result.current.setDraft({ partition: '2' });
    });

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(dispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({
      partition: 2,
    }));
  });

  it('consumeOnce no-ops when topicName is blank', async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useTopicMessageBrowser('  ', makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("timeWindow 'last-24h' post-filters rows by timestamp", async () => {
    const now = Date.now();
    const recent = String(now - 60 * 60 * 1000);
    const old = String(now - 48 * 60 * 60 * 1000);

    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        topic: 'orders.created',
        messages: [
          { topic: 'orders.created', partition: 0, offset: '1', value: '{}', timestamp: recent },
          { topic: 'orders.created', partition: 0, offset: '2', value: '{}', timestamp: old },
        ],
      },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    act(() => {
      result.current.setDraft({ timeWindow: 'last-24h' });
    });

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(result.current.result).toHaveLength(1);
    expect(result.current.result![0].offset).toBe('1');
  });

  it('consumeOnce with unsuccessful envelope leaves result null', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: false, error: { message: 'fail' } });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('consumeOnce passes filter when keyEquals is set', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 'orders.created', messages: [] },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    act(() => {
      result.current.setDraft({ keyEquals: 'my-key' });
    });

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(dispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({
      filter: expect.objectContaining({ keyEquals: 'my-key' }),
    }));
  });

  it('selectedMessage is null when index is out of range', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 't', messages: SAMPLE_ROWS },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    await act(async () => {
      await result.current.consumeOnce();
    });

    act(() => {
      result.current.selectMessage(99);
    });
    expect(result.current.selectedMessage).toBeNull();
  });

  it('consumeOnce uses default timeout and maxMessages when draft values are invalid', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 't', messages: [] },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    act(() => {
      result.current.setDraft({ timeoutMs: 'abc', maxMessages: '' });
    });

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(dispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({
      timeoutMs: 10_000,
      maxMessages: 50,
    }));
  });

  it("timeWindow 'earliest' uses fromBeginning in request", async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: { topic: 't', messages: [] },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    act(() => {
      result.current.setDraft({ timeWindow: 'earliest' });
    });

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(dispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({
      fromBeginning: true,
    }));
  });

  it("timeWindow 'last-1h' post-filters rows by timestamp", async () => {
    const now = Date.now();
    const recent = String(now - 30 * 60 * 1000);
    const old = String(now - 2 * 60 * 60 * 1000);

    const dispatch = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        topic: 'orders.created',
        messages: [
          { topic: 'orders.created', partition: 0, offset: '1', value: '{}', timestamp: recent },
          { topic: 'orders.created', partition: 0, offset: '2', value: '{}', timestamp: old },
        ],
      },
    });

    const { result } = renderHook(() =>
      useTopicMessageBrowser('orders.created', makeKafkaState(), { dispatch }),
    );

    act(() => {
      result.current.setDraft({ timeWindow: 'last-1h' });
    });

    await act(async () => {
      await result.current.consumeOnce();
    });

    expect(result.current.result).toHaveLength(1);
    expect(result.current.result![0].offset).toBe('1');
    expect(dispatch).toHaveBeenCalledWith('consume-once', expect.objectContaining({
      fromBeginning: true,
    }));
  });
});
