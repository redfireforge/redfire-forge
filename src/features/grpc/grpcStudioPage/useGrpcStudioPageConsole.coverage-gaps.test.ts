/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import * as compressionPolicy from '../../../shared/grpc/grpcCompressionPolicy';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import { useGrpcStudioPageConsole } from './useGrpcStudioPageConsole';

function makeSnapshot(requestId: string) {
  return {
    requestId,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    transportMode: 'express' as const,
    metadata: { 'x-trace': '1' },
    auth: { type: 'none' as const },
    compression: undefined,
    body: FIXTURE_UNARY_CALL_REQUEST.body,
    timeoutMs: 30_000,
  };
}

function useConsoleHarness(initialTab: ReturnType<typeof createGrpcStudioTab>, consoleOpen = true) {
  const [tab, setTab] = useState(initialTab);
  const consoleApi = useGrpcStudioPageConsole({ activeTab: tab } as UseGrpcStudioReturn, consoleOpen);
  return { ...consoleApi, tab, setTab };
}

function renderConsole(tab: ReturnType<typeof createGrpcStudioTab>, consoleOpen = true) {
  return renderHook(
    ({ open }) => useConsoleHarness(tab, open),
    { initialProps: { open: consoleOpen } },
  );
}

describe('useGrpcStudioPageConsole coverage gaps', () => {
  beforeEach(() => {
    vi.spyOn(compressionPolicy, 'prepareGrpcCallMetadata').mockImplementation(
      (metadata) => metadata ?? {},
    );
  });

  it('does not append events while console is closed', async () => {
    const tabId = createGrpcStudioTab({ lifecycle: 'idle' }).id;
    const { result, rerender } = renderConsole(createGrpcStudioTab({ id: tabId, lifecycle: 'idle' }), false);

    rerender({ open: false });
    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'success',
        lastExecuteSnapshot: makeSnapshot('req-1'),
        lastResult: {
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'ok' },
          durationMs: 12,
        },
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents).toHaveLength(0);
    });
  });

  it('records unary send and terminal events while console stays open', async () => {
    const tabId = createGrpcStudioTab({ lifecycle: 'idle' }).id;
    const { result } = renderConsole(createGrpcStudioTab({ id: tabId, lifecycle: 'idle' }), true);

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'calling',
        lastExecuteSnapshot: makeSnapshot('req-send'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.direction === 'send')).toBe(true);
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'success',
        lastExecuteSnapshot: makeSnapshot('req-send'),
        lastResult: {
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'ok' },
          durationMs: 8,
        },
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Unary success')).toBe(true);
    });
  });

  it('records unary error terminal events and metadata prep failures', async () => {
    vi.mocked(compressionPolicy.prepareGrpcCallMetadata).mockImplementationOnce(() => {
      throw new Error('compression rejected');
    });

    const tabId = createGrpcStudioTab({ lifecycle: 'idle' }).id;
    const { result } = renderConsole(createGrpcStudioTab({ id: tabId, lifecycle: 'idle' }), true);

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'calling',
        lastExecuteSnapshot: makeSnapshot('req-meta-fail'),
      }));
    });

    await waitFor(() => {
      const sendEvent = result.current.consoleEvents.find((event) => event.direction === 'send');
      expect(sendEvent?.payload).toMatchObject({
        manualMetadata: { 'x-trace': '1' },
      });
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'error',
        lastExecuteSnapshot: makeSnapshot('req-meta-fail'),
        lastError: {
          code: 13,
          category: 'call_failed',
          message: 'boom',
        },
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Unary error')).toBe(true);
    });
  });

  it('uses empty metadata when prepareGrpcCallMetadata returns null', async () => {
    vi.mocked(compressionPolicy.prepareGrpcCallMetadata).mockReturnValueOnce(undefined as never);

    const tabId = createGrpcStudioTab({ lifecycle: 'idle' }).id;
    const { result } = renderConsole(createGrpcStudioTab({ id: tabId, lifecycle: 'idle' }), true);

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'calling',
        lastExecuteSnapshot: {
          ...makeSnapshot('req-null-meta'),
          metadata: undefined,
        },
      }));
    });

    await waitFor(() => {
      const sendEvent = result.current.consoleEvents.find((event) => event.direction === 'send');
      expect(sendEvent?.payload).toMatchObject({ metadata: {} });
    });
  });

  it('records stream error lifecycle events', async () => {
    const tabId = 'tab-stream-error';
    const { result } = renderHook(
      ({ tab, open }) => useConsoleHarness(tab, open),
      {
        initialProps: {
          tab: createGrpcStudioTab({ id: tabId, streamLifecycle: 'idle', streamMessages: [] }),
          open: true,
        },
      },
    );

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        streamLifecycle: 'error',
        streamError: { code: 13, category: 'call_failed', message: 'stream failed' },
        streamMessages: [],
        lastExecuteSnapshot: makeSnapshot('req-stream-error'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Stream error')).toBe(true);
    });
  });

  it('records stream messages and lifecycle transitions', async () => {
    const tabId = createGrpcStudioTab({
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastExecuteSnapshot: makeSnapshot('req-stream'),
    }).id;
    const { result } = renderConsole(createGrpcStudioTab({
      id: tabId,
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastExecuteSnapshot: makeSnapshot('req-stream'),
    }), true);

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        streamLifecycle: 'streaming',
        streamMessages: [
          { direction: 'outbound', sequence: 1, timestamp: '2026-07-01T00:00:00.000Z', data: { message: 'out' } },
          { direction: 'inbound', sequence: 2, timestamp: '2026-07-01T00:00:01.000Z', data: { message: 'in' } },
        ],
        lastExecuteSnapshot: makeSnapshot('req-stream'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.filter((event) => event.summary?.startsWith('Stream '))).toHaveLength(2);
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        streamLifecycle: 'ended',
        streamEndedAt: '2026-07-01T00:00:02.000Z',
        streamStartedAt: '2026-07-01T00:00:00.000Z',
        streamMessages: [
          { direction: 'outbound', sequence: 1, timestamp: '2026-07-01T00:00:00.000Z', data: { message: 'out' } },
          { direction: 'inbound', sequence: 2, timestamp: '2026-07-01T00:00:01.000Z', data: { message: 'in' } },
        ],
        lastExecuteSnapshot: makeSnapshot('req-stream'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Stream ended')).toBe(true);
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        streamLifecycle: 'cancelled',
        streamError: { code: 1, category: 'cancelled', message: 'cancelled' },
        streamMessages: [
          { direction: 'outbound', sequence: 1, timestamp: '2026-07-01T00:00:00.000Z', data: { message: 'out' } },
          { direction: 'inbound', sequence: 2, timestamp: '2026-07-01T00:00:01.000Z', data: { message: 'in' } },
        ],
        lastExecuteSnapshot: makeSnapshot('req-stream'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Stream cancelled')).toBe(true);
    });
  });

  it('seeds seen state when console reopens and supports manual append/clear', async () => {
    const tabId = createGrpcStudioTab({ lifecycle: 'idle' }).id;
    const { result, rerender } = renderConsole(createGrpcStudioTab({ id: tabId, lifecycle: 'idle' }), true);

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'calling',
        lastExecuteSnapshot: makeSnapshot('req-before-close'),
      }));
    });
    await waitFor(() => {
      expect(result.current.consoleEvents.length).toBeGreaterThan(0);
    });
    const beforeClose = result.current.consoleEvents.length;

    rerender({ open: false });
    rerender({ open: true });
    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'calling',
        lastExecuteSnapshot: makeSnapshot('req-after-reopen'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.length).toBeGreaterThan(beforeClose);
    });

    act(() => {
      result.current.appendConsoleEvent({
        timestamp: '2026-07-01T00:00:00.000Z',
        direction: 'event',
        summary: 'manual',
        payload: { ok: true },
      });
    });
    expect(result.current.consoleEvents.some((event) => event.summary === 'manual')).toBe(true);

    act(() => {
      result.current.clearConsoleEvents();
    });
    expect(result.current.consoleEvents).toHaveLength(0);
  });

  it('initializes stream counters for a new tab while console stays open', async () => {
    const tabA = createGrpcStudioTab({ id: 'tab-a', lifecycle: 'idle' });
    const tabB = createGrpcStudioTab({
      id: 'tab-b',
      streamLifecycle: 'streaming',
      streamMessages: [],
      lastExecuteSnapshot: makeSnapshot('req-tab-b'),
    });
    const streamMessage = {
      direction: 'inbound' as const,
      sequence: 1,
      timestamp: '2026-07-01T00:00:00.000Z',
      data: { ok: true },
    };

    const { result } = renderHook(
      ({ tab, open }) => useConsoleHarness(tab, open),
      { initialProps: { tab: tabA, open: true } },
    );

    act(() => {
      result.current.setTab(tabB);
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: 'tab-b',
        streamLifecycle: 'streaming',
        streamMessages: [streamMessage],
        lastExecuteSnapshot: makeSnapshot('req-tab-b'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary?.startsWith('Stream recv'))).toBe(true);
    });
  });

  it('records unary cancelled terminal events', async () => {
    const tabId = createGrpcStudioTab({ lifecycle: 'idle' }).id;
    const { result } = renderConsole(createGrpcStudioTab({ id: tabId, lifecycle: 'idle' }), true);

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'calling',
        lastExecuteSnapshot: makeSnapshot('req-cancel'),
      }));
    });
    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.direction === 'send')).toBe(true);
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'cancelled',
        lastExecuteSnapshot: makeSnapshot('req-cancel'),
        lastError: { code: 1, category: 'cancelled', message: 'cancelled' },
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Unary cancelled')).toBe(true);
    });
  });

  it('caps console events at 2000 entries', () => {
    const { result } = renderConsole(createGrpcStudioTab(), true);

    act(() => {
      for (let index = 0; index < 2005; index += 1) {
        result.current.appendConsoleEvent({
          timestamp: '2026-07-01T00:00:00.000Z',
          direction: 'event',
          summary: `event-${index}`,
          payload: { index },
        });
      }
    });

    expect(result.current.consoleEvents).toHaveLength(2000);
    expect(result.current.consoleEvents[0]?.summary).toBe('event-5');
    expect(result.current.consoleEvents.at(-1)?.summary).toBe('event-2004');
  });

  it('does not re-seed unary counters when returning to a previously seen tab', async () => {
    const tabId = 'tab-return';
    const snapshot = makeSnapshot('req-return');
    const { result } = renderHook(
      ({ tab, open }) => useConsoleHarness(tab, open),
      {
        initialProps: {
          tab: createGrpcStudioTab({ id: tabId, lifecycle: 'idle' }),
          open: true,
        },
      },
    );

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'calling',
        lastExecuteSnapshot: snapshot,
      }));
    });
    await waitFor(() => {
      expect(result.current.consoleEvents.filter((event) => event.direction === 'send')).toHaveLength(1);
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({ id: 'tab-other', lifecycle: 'idle' }));
    });
    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        lifecycle: 'success',
        lastExecuteSnapshot: snapshot,
        lastResult: {
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'ok' },
          durationMs: 5,
        },
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.filter((event) => event.direction === 'send')).toHaveLength(1);
    });
  });

  it('records outbound stream console events and skips duplicate lifecycle transitions', async () => {
    const outbound = {
      direction: 'outbound' as const,
      sequence: 2,
      timestamp: '2026-07-01T00:00:01.000Z',
      data: { message: 'out' },
    };
    const tabId = 'tab-stream';
    const { result } = renderHook(
      ({ tab, open }) => useConsoleHarness(tab, open),
      {
        initialProps: {
          tab: createGrpcStudioTab({ id: tabId, lifecycle: 'idle', streamLifecycle: 'idle', streamMessages: [] }),
          open: true,
        },
      },
    );

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        streamLifecycle: 'streaming',
        streamMessages: [outbound],
        lastExecuteSnapshot: makeSnapshot('req-stream'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Stream send #2')).toBe(true);
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        streamLifecycle: 'ended',
        streamEndedAt: '2026-07-01T00:00:02.000Z',
        streamMessages: [outbound],
        lastExecuteSnapshot: makeSnapshot('req-stream'),
      }));
    });
    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Stream ended')).toBe(true);
    });

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        streamLifecycle: 'ended',
        streamEndedAt: '2026-07-01T00:00:03.000Z',
        streamMessages: [outbound],
        lastExecuteSnapshot: makeSnapshot('req-stream'),
      }));
    });
    expect(result.current.consoleEvents.filter((event) => event.summary === 'Stream ended')).toHaveLength(1);
  });

  it('records stream cancelled lifecycle events', async () => {
    const tabId = 'tab-stream-cancel';
    const { result } = renderHook(
      ({ tab, open }) => useConsoleHarness(tab, open),
      {
        initialProps: {
          tab: createGrpcStudioTab({ id: tabId, streamLifecycle: 'idle', streamMessages: [] }),
          open: true,
        },
      },
    );

    act(() => {
      result.current.setTab(createGrpcStudioTab({
        id: tabId,
        streamLifecycle: 'cancelled',
        streamError: { code: 1, category: 'cancelled', message: 'cancelled' },
        streamMessages: [],
        lastExecuteSnapshot: makeSnapshot('req-stream-cancel'),
      }));
    });

    await waitFor(() => {
      expect(result.current.consoleEvents.some((event) => event.summary === 'Stream cancelled')).toBe(true);
    });
  });
});
