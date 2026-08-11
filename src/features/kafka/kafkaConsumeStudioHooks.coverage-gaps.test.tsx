/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';
import * as helpers from './kafkaConsumeStreamHelpers';
import * as messageStudioUtils from './kafkaMessageStudioUtils';
import { useKafkaConsumeE2eBridge, useKafkaConsumeStreamView, useRelativeTimestampTick } from './kafkaConsumeStudioHooks';
import type { UseKafkaStreamModeReturn } from '../../app/hooks/useKafkaStreamMode';

function HookHost({ studio, intervalMs = 30_000 }: { studio: UseKafkaMessageStudioReturn; intervalMs?: number }) {
  useKafkaConsumeE2eBridge(studio);
  useRelativeTimestampTick(intervalMs);
  return null;
}

function createStreamMode(overrides: Partial<UseKafkaStreamModeReturn> = {}): UseKafkaStreamModeReturn {
  return {
    streamMessages: [],
    isStreaming: false,
    clearStreamMessages: vi.fn(),
    startStream: vi.fn(),
    stopStream: vi.fn(),
    ...overrides,
  } as unknown as UseKafkaStreamModeReturn;
}

describe('kafkaConsumeStudioHooks coverage gaps', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__kafkaInjectConsumeResults;
    vi.useRealTimers();
  });

  it('registers and unregisters __kafkaInjectConsumeResults bridge', () => {
    const consumeOnce = vi.fn();
    const setConsumeResult = vi.fn();
    const studio = {
      consumeOnce,
      __setConsumeResult: setConsumeResult,
    } as unknown as UseKafkaMessageStudioReturn;

    const { unmount } = render(<HookHost studio={studio} />);
    const bridge = (window as unknown as Record<string, unknown>).__kafkaInjectConsumeResults;
    expect(typeof bridge).toBe('function');

    (bridge as (rows: Array<{ topic: string }>) => void)([{ topic: 'orders' }]);
    expect(consumeOnce).toHaveBeenCalledTimes(1);
    expect(setConsumeResult).toHaveBeenCalledWith([{ topic: 'orders' }]);

    unmount();
    expect((window as unknown as Record<string, unknown>).__kafkaInjectConsumeResults).toBeUndefined();
  });

  it('bridge works even when __setConsumeResult is not provided', () => {
    const consumeOnce = vi.fn();
    const studio = {
      consumeOnce,
    } as unknown as UseKafkaMessageStudioReturn;

    render(<HookHost studio={studio} />);
    const bridge = (window as unknown as Record<string, unknown>).__kafkaInjectConsumeResults as (rows: unknown[]) => void;
    expect(() => bridge([{ any: 'value' }])).not.toThrow();
    expect(consumeOnce).toHaveBeenCalledTimes(1);
  });

  it('starts and clears interval for relative tick updates', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const studio = {
      consumeOnce: vi.fn(),
    } as unknown as UseKafkaMessageStudioReturn;

    const { unmount } = render(<HookHost studio={studio} intervalMs={1234} />);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1234);
    const intervalId = setIntervalSpy.mock.results[0]?.value;

    vi.advanceTimersByTime(5000);
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });

  it('covers stream view callbacks and derived state', () => {
    const exportSpy = vi.spyOn(helpers, 'filterIndexedStreamRows').mockReturnValue([{ row: { topic: 'orders' }, index: 0 }] as never);
    const scrollToSpy = vi.fn();
    const streamListRef = { current: { scrollTop: 0, scrollHeight: 100, clientHeight: 50, scrollTo: scrollToSpy } as unknown as HTMLDivElement };
    const parentScrollSpy = vi.fn();
    const streamResultsZoneRef = {
      current: {
        parentElement: {
          parentElement: document.body,
          getBoundingClientRect: () => ({ top: 0 } as DOMRect),
        } as unknown as HTMLElement,
        getBoundingClientRect: () => ({ top: 10 } as DOMRect),
      } as unknown as HTMLDivElement,
    };
    const streamMode = createStreamMode({
      streamMessages: [{ topic: 'orders' }] as never,
      isStreaming: false,
      clearStreamMessages: vi.fn(),
      startStream: vi.fn(),
      stopStream: vi.fn(),
    });

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ overflowY: 'scroll' } as CSSStyleDeclaration);
    vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect);
    (streamResultsZoneRef.current.parentElement as unknown as { scrollTo: typeof parentScrollSpy }).scrollTo = parentScrollSpy;

    const { result, rerender } = renderHook(({ isStreaming: _isStreaming }) => useKafkaConsumeStreamView({
      streamMode,
      consumeDraftTopic: 'topic-a',
      clusterId: 'cluster-a',
      consumeDraft: vi.fn() as never,
    }), { initialProps: { isStreaming: false } });

    result.current.streamListRef.current = streamListRef.current;
    result.current.streamResultsZoneRef.current = streamResultsZoneRef.current;
    streamMode.isStreaming = true;
    rerender({ isStreaming: true });

    act(() => {
      result.current.handleStreamScroll();
      result.current.scrollStreamToBottom();
      result.current.handleClearStream();
      result.current.handleStartStream();
      result.current.handleStopStream();
      result.current.setStreamSearch('orders');
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' });
    expect(parentScrollSpy).toHaveBeenCalled();

    expect(result.current.streamSearchActive).toBe(true);
    expect(result.current.filteredStreamRows).toEqual([{ row: { topic: 'orders' }, index: 0 }]);
    expect(streamMode.clearStreamMessages).toHaveBeenCalled();
    expect(streamMode.startStream).toHaveBeenCalledWith(expect.any(Function), 'cluster-a');
    expect(streamMode.stopStream).toHaveBeenCalled();
    expect(scrollToSpy).toHaveBeenCalled();
    exportSpy.mockRestore();
  });

  it('pins stream list to bottom by assigning scrollTop when messages update', () => {
    const streamMode = createStreamMode({
      streamMessages: [] as never,
      isStreaming: false,
    });
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 250 });
    Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: 0 });

    const { result, rerender } = renderHook(() => useKafkaConsumeStreamView({
      streamMode,
      consumeDraftTopic: 'topic-a',
      clusterId: 'cluster-a',
      consumeDraft: vi.fn() as never,
    }));

    result.current.streamListRef.current = el as unknown as HTMLDivElement;
    streamMode.streamMessages = [{ topic: 'orders' }] as never;
    rerender();

    expect((result.current.streamListRef.current as unknown as { scrollTop: number }).scrollTop).toBe(250);
  });

  it('exports rows when stream messages are present and falls back to documentElement scrolling', () => {
    const exportResultSetSpy = vi.spyOn(messageStudioUtils, 'exportResultSet').mockResolvedValue(undefined as never);
    const streamMode = createStreamMode({
      streamMessages: [{ topic: 'orders' }] as never,
      isStreaming: false,
      clearStreamMessages: vi.fn(),
      startStream: vi.fn(),
      stopStream: vi.fn(),
    });
    const scrollToSpy = vi.fn();
    const streamResultsZoneRef = {
      current: {
        parentElement: null,
        getBoundingClientRect: () => ({ top: 30 } as DOMRect),
      } as unknown as HTMLDivElement,
    };

    vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue({ top: 10 } as DOMRect);
    (document.documentElement as unknown as { scrollTo: typeof scrollToSpy }).scrollTo = scrollToSpy;

    const { result, rerender } = renderHook(() => useKafkaConsumeStreamView({
      streamMode,
      consumeDraftTopic: 'topic-a',
      clusterId: 'cluster-a',
      consumeDraft: vi.fn() as never,
    }));

    result.current.streamResultsZoneRef.current = streamResultsZoneRef.current;
    streamMode.isStreaming = true;
    rerender();
    act(() => result.current.handleExportStream());

    expect(exportResultSetSpy).toHaveBeenCalledWith([{ topic: 'orders' }], 'topic-a');
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 12, behavior: 'smooth' });
    exportResultSetSpy.mockRestore();
  });

  it('uses the nearest scroll parent when stream results are inside a scrollable container', () => {
    const streamMode = createStreamMode({
      streamMessages: [{ topic: 'orders' }] as never,
      isStreaming: false,
    });
    const parentScrollSpy = vi.fn();
    const streamResultsZoneRef = {
      current: {
        parentElement: {
          parentElement: document.body,
          getBoundingClientRect: () => ({ top: 15 } as DOMRect),
          scrollTop: 20,
          scrollHeight: 120,
        } as unknown as HTMLElement,
        getBoundingClientRect: () => ({ top: 45 } as DOMRect),
      } as unknown as HTMLDivElement,
    };

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ overflowY: 'scroll' } as CSSStyleDeclaration);
    const { result, rerender } = renderHook(() => useKafkaConsumeStreamView({
      streamMode,
      consumeDraftTopic: 'topic-a',
      clusterId: 'cluster-a',
      consumeDraft: vi.fn() as never,
    }));

    result.current.streamResultsZoneRef.current = streamResultsZoneRef.current;
    (streamResultsZoneRef.current.parentElement as unknown as { scrollTo: typeof parentScrollSpy }).scrollTo = parentScrollSpy;
    streamMode.isStreaming = true;
    rerender();

    expect(parentScrollSpy).toHaveBeenCalledWith({ top: 42, behavior: 'smooth' });
  });

  it('walks past a non-scroll parent to find the next scrollable ancestor', () => {
    const streamMode = createStreamMode({
      streamMessages: [{ topic: 'orders' }] as never,
      isStreaming: false,
    });
    const parentScrollSpy = vi.fn();
    const grandParent = {
      parentElement: document.body,
      getBoundingClientRect: () => ({ top: 10 } as DOMRect),
      scrollTop: 5,
      scrollTo: parentScrollSpy,
    } as unknown as HTMLElement;
    const parent = {
      parentElement: grandParent,
      getBoundingClientRect: () => ({ top: 15 } as DOMRect),
    } as unknown as HTMLElement;
    const streamResultsZoneRef = {
      current: {
        parentElement: parent,
        getBoundingClientRect: () => ({ top: 45 } as DOMRect),
      } as unknown as HTMLDivElement,
    };

    vi.spyOn(window, 'getComputedStyle').mockImplementation((node: Element) => {
      if (node === parent) return { overflowY: 'visible' } as CSSStyleDeclaration;
      return { overflowY: 'auto' } as CSSStyleDeclaration;
    });

    const { result, rerender } = renderHook(() => useKafkaConsumeStreamView({
      streamMode,
      consumeDraftTopic: 'topic-a',
      clusterId: 'cluster-a',
      consumeDraft: vi.fn() as never,
    }));

    result.current.streamResultsZoneRef.current = streamResultsZoneRef.current;
    streamMode.isStreaming = true;
    rerender();

    expect(parentScrollSpy).toHaveBeenCalledWith({ top: 32, behavior: 'smooth' });
  });

  it('does not export or scroll when the stream has no messages and no list ref', () => {
    const exportResultSetSpy = vi.spyOn(messageStudioUtils, 'exportResultSet').mockResolvedValue(undefined as never);
    const streamMode = createStreamMode({
      streamMessages: [] as never,
      isStreaming: false,
    });

    const { result } = renderHook(() => useKafkaConsumeStreamView({
      streamMode,
      consumeDraftTopic: 'topic-a',
      clusterId: 'cluster-a',
      consumeDraft: vi.fn() as never,
    }));

    act(() => {
      result.current.handleExportStream();
      result.current.scrollStreamToBottom();
    });

    expect(exportResultSetSpy).not.toHaveBeenCalled();
  });
});
