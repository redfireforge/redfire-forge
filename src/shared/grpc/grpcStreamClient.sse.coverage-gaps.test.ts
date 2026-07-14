import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./grpcTauriDescriptorBridge', () => ({
  prepareGrpcTauriDescriptorPayload: vi.fn(),
}));

import {openGrpcStreamEvents,
  setGrpcStreamEventsOpener,
  setGrpcStreamTransport,
} from './grpcStreamClient';

import {sseResponse } from './grpcStreamClientCoverageGaps.testHelpers';

describe('openGrpcStreamEventsViaSse coverage gaps', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    setGrpcStreamTransport(null);
    setGrpcStreamEventsOpener(null);
  });

  afterEach(() => {
    setGrpcStreamTransport(null);
    setGrpcStreamEventsOpener(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses custom stream events opener override when set', () => {
    const override = vi.fn(() => vi.fn());
    setGrpcStreamEventsOpener(override);
    const dispose = openGrpcStreamEvents('s1', 'tab-1', { onEvent: () => undefined });
    expect(override).toHaveBeenCalledWith('s1', 'tab-1', expect.any(Object));
    dispose();
  });

  it('openGrpcStreamEventsViaSse closes on non-retryable 409 responses', async () => {
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: false,
      error: { message: 'stream tab mismatch' },
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));

    const onError = vi.fn();
    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
      onStateChange,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onStateChange).toHaveBeenCalledWith('closed');
    dispose();
  });

  it('openGrpcStreamEventsViaSse parses JSON error envelopes on retryable failures', async () => {
    vi.useFakeTimers();
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: false,
        error: { message: 'temporary outage' },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(sseResponse([]));

    const onError = vi.fn();
    openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    expect(onError).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('openGrpcStreamEventsViaSse closes when reconnect backoff aborts', async () => {
    vi.useFakeTimers();
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock.mockRejectedValue(new Error('network down'));

    const controller = new AbortController();
    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onStateChange,
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onStateChange).toHaveBeenCalledWith('closed');
    dispose();
    vi.useRealTimers();
  });

  it('openGrpcStreamEventsViaSse retries after non-JSON retryable HTTP failures', async () => {
    vi.useFakeTimers();
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock
      .mockResolvedValueOnce(new Response('plain-text-error', { status: 503 }))
      .mockResolvedValueOnce(sseResponse([]));

    const onError = vi.fn();
    openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    expect(onError).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('openGrpcStreamEventsViaSse surfaces non-Error reconnect failures', async () => {
    vi.useFakeTimers();
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock.mockRejectedValue('plain string failure');

    const onError = vi.fn();
    openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(attempt));
      await vi.advanceTimersByTimeAsync(10_000);
    }
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('plain string failure'));
    vi.useRealTimers();
  });
});
