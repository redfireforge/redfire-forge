/**
 * Coverage gaps — grpcNativeTauriStreamTransport.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import * as grpcApiClient from './grpcApiClient';
import { GRPC_TAURI_SCHEMA_VERSION } from './grpcTauriContracts';
import * as grpcTauriEventAdapter from './grpcTauriEventAdapter';
import {
  clearGrpcNativeStreamTransport,
  GrpcNativeTauriStreamTransportError,
  installGrpcNativeStreamTransport,
  invokeGrpcStreamCancelNative,
  invokeGrpcStreamEndNative,
  invokeGrpcStreamSendNative,
  invokeGrpcStreamStartNative,
  nativeGrpcStreamTransport,
  openNativeGrpcStreamEvents,
  toGrpcTauriStreamStartRequest,
} from './grpcNativeTauriStreamTransport';
import { startGrpcStream, openGrpcStreamEvents } from './grpcStreamClient';
import * as grpcStreamClient from './grpcStreamClient';
import { GrpcApiClientError } from './grpcApiClient';
import {
  resetGrpcTabTransportRoutingForTests,
  setGrpcTransportMode,
  syncGrpcTabTransportMode,
} from './grpcTransportTabRouting';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('grpcNativeTauriStreamTransport coverage gaps', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    clearGrpcNativeStreamTransport();
    resetGrpcTabTransportRoutingForTests();
    vi.restoreAllMocks();
  });

  it('GrpcNativeTauriStreamTransportError uses default code when options omit code', () => {
    const err = new GrpcNativeTauriStreamTransportError('stream_start', 'failed', { retryable: true });
    expect(err.code).toBe('GRPC_TAURI_INVOKE_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('invokeGrpcStreamStartNative wraps Error invoke failures', async () => {
    invokeMock.mockRejectedValue(new Error('ipc Error'));
    await expect(invokeGrpcStreamStartNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      requestId: 'req-1',
      tabId: 'tab-a',
      callType: 'server_streaming',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: {},
      descriptor: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'abc',
        contentSha256: 'a'.repeat(64),
      },
    })).rejects.toMatchObject({ message: 'ipc Error' });
  });

  it('invokeGrpcStreamSendNative wraps Error invoke failures', async () => {
    invokeMock.mockRejectedValue(new Error('send Error'));
    await expect(invokeGrpcStreamSendNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
      body: {},
    })).rejects.toMatchObject({ message: 'send Error' });
  });

  it('invokeGrpcStreamEndNative wraps Error invoke failures', async () => {
    invokeMock.mockRejectedValue(new Error('end Error'));
    await expect(invokeGrpcStreamEndNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
    })).rejects.toMatchObject({ message: 'end Error' });
  });

  it('invokeGrpcStreamCancelNative wraps Error invoke failures', async () => {
    invokeMock.mockRejectedValue(new Error('cancel Error'));
    await expect(invokeGrpcStreamCancelNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
    })).rejects.toMatchObject({ message: 'cancel Error' });
  });

  it('nativeGrpcStreamTransport send path tolerates missing stream id match and tabId', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_cancel',
      data: {
        streamId: '',
        tabId: '',
        op: 'cancel',
        acknowledged: true,
        alreadyTerminal: false,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const cancel = await nativeGrpcStreamTransport(
      '/api/grpc/stream/',
      { method: 'DELETE' },
    );
    expect(cancel.ok).toBe(true);
  });

  it('toGrpcTauriStreamStartRequest maps unary stream fields', () => {
    const request = {
      requestId: 'req-1',
      callType: 'server_streaming' as const,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi' },
      metadata: { 'x-meta': '1' },
      auth: FIXTURE_UNARY_CALL_REQUEST.auth,
      timeoutMs: 5000,
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
    };
    const descriptor = {
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      protosetBase64: 'abc',
      contentSha256: 'a'.repeat(64),
    };
    expect(toGrpcTauriStreamStartRequest(request, 'tab-1', descriptor)).toMatchObject({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      tabId: 'tab-1',
      descriptor,
      metadata: { 'x-meta': '1' },
    });
  });

  it('invokeGrpcStreamSendNative maps invoke and envelope failures', async () => {
    invokeMock.mockResolvedValue({
      ok: true,
      op: 'stream_send',
      data: { streamId: 's1', tabId: 'tab-a', sequence: 2 },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await expect(invokeGrpcStreamSendNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
      body: { message: 'x' },
    })).resolves.toMatchObject({ sequence: 2 });

    invokeMock.mockRejectedValue('send ipc fail');
    await expect(invokeGrpcStreamSendNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
      body: {},
    })).rejects.toMatchObject({ op: 'stream_send', message: 'send ipc fail' });

    invokeMock.mockResolvedValue({
      ok: false,
      op: 'stream_send',
      error: { message: 'bad send', code: 'X', retryable: true },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await expect(invokeGrpcStreamSendNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
      body: {},
    })).rejects.toMatchObject({ op: 'stream_send', retryable: true });
  });

  it('invokeGrpcStreamCancelNative maps cancelled acknowledged result', async () => {
    invokeMock.mockResolvedValue({
      ok: true,
      op: 'stream_cancel',
      data: {
        streamId: 's1',
        tabId: 'tab-a',
        op: 'cancel',
        acknowledged: true,
        alreadyTerminal: false,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const result = await invokeGrpcStreamCancelNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
    });
    expect(result.op).toBe('cancel');
    expect(result.acknowledged).toBe(true);
  });

  it('nativeGrpcStreamTransport handles send, end, and cancel paths', async () => {
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-stream' },
    });

    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_start',
      data: {
        streamId: 'stream-x',
        requestId: 'req-stream',
        tabId: 'tab-a',
        transportUsed: 'tauri',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const start = await nativeGrpcStreamTransport(
      '/api/grpc/stream/start?tabId=tab-a',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-stream',
          descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: 'echo.EchoService',
          method: 'ServerStream',
          callType: 'server_streaming',
          body: { message: 'hello' },
        }),
      },
    );
    expect(start.ok).toBe(true);

    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_send',
      data: { streamId: 'stream-x', tabId: 'tab-a', sequence: 1 },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const send = await nativeGrpcStreamTransport(
      '/api/grpc/stream/stream-x/send?tabId=tab-a',
      { method: 'POST', body: JSON.stringify({ body: { message: 'next' } }) },
    );
    expect(send.ok).toBe(true);
    if (send.ok) expect(send.op).toBe('stream_send');

    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_end',
      data: {
        streamId: 'stream-x',
        tabId: 'tab-a',
        op: 'end',
        acknowledged: true,
        alreadyTerminal: false,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const end = await nativeGrpcStreamTransport(
      '/api/grpc/stream/stream-x/end?tabId=tab-a',
      { method: 'POST' },
    );
    expect(end.ok).toBe(true);
    if (end.ok) expect(end.data.ended).toBe(true);

    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_start',
      data: {
        streamId: 'stream-y',
        requestId: 'req-stream-2',
        tabId: 'tab-a',
        transportUsed: 'tauri',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await nativeGrpcStreamTransport(
      '/api/grpc/stream/start?tabId=tab-a',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-stream-2',
          descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: 'echo.EchoService',
          method: 'ServerStream',
          callType: 'server_streaming',
          body: {},
        }),
      },
    );

    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_cancel',
      data: {
        streamId: 'stream-y',
        tabId: 'tab-a',
        op: 'cancel',
        acknowledged: true,
        alreadyTerminal: false,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const cancel = await nativeGrpcStreamTransport(
      '/api/grpc/stream/stream-y?tabId=tab-a',
      { method: 'DELETE' },
    );
    expect(cancel.ok).toBe(true);
    if (cancel.ok) expect(cancel.data.cancelled).toBe(true);
  });

  it('installGrpcNativeStreamTransport delegates to express when tab mode is express', async () => {
    installGrpcNativeStreamTransport();
    setGrpcTransportMode('express');
    syncGrpcTabTransportMode('tab-express', 'express');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        ok: true,
        op: 'stream_start',
        data: { streamId: 's-express', requestId: 'req-express', tabId: 'tab-express' },
        meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-express' },
      }), { status: 200 }),
    );

    const envelope = await startGrpcStream({
      requestId: 'req-express',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      service: 'echo.EchoService',
      method: 'ServerStream',
      callType: 'server_streaming',
      body: { message: 'hello' },
    }, 'tab-express');

    expect(fetchSpy).toHaveBeenCalled();
    expect(envelope.data.streamId).toBe('s-express');
    fetchSpy.mockRestore();
    clearGrpcNativeStreamTransport();
  });

  it('openNativeGrpcStreamEvents ignores heartbeat and closes on grpc-end', async () => {
    let eventHandler: ((event: { type: string }) => void) | undefined;
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockImplementation(async (opts) => {
      eventHandler = (raw) => {
        opts.onEvent({
          type: raw.type as 'grpc-message',
          streamId: 'stream-a',
          requestId: 'req-a',
          tabId: 'tab-a',
          sequence: 1,
          timestamp: '2026-06-30T00:00:00.000Z',
        });
      };
      return { dispose: vi.fn() };
    });

    const onEvent = vi.fn();
    const onStateChange = vi.fn();
    openNativeGrpcStreamEvents('stream-a', 'tab-a', {
      onEvent,
      onStateChange,
      expectedRequestId: 'req-a',
    });

    await Promise.resolve();
    eventHandler?.({ type: 'grpc-heartbeat' });
    expect(onEvent).not.toHaveBeenCalled();

    eventHandler?.({ type: 'grpc-end' });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith('closed');
  });

  it('openNativeGrpcStreamEvents returns early when signal is already aborted', () => {
    const onStateChange = vi.fn();
    const controller = new AbortController();
    controller.abort();
    openNativeGrpcStreamEvents('stream-a', 'tab-a', {
      onEvent: vi.fn(),
      onStateChange,
      signal: controller.signal,
    });
    expect(onStateChange).toHaveBeenCalledWith('closed');
  });

  it('openNativeGrpcStreamEvents disposes adapter when disposed before listen resolves', async () => {
    const disposeFn = vi.fn();
    let resolveListen: ((handle: { dispose: () => void }) => void) | undefined;
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockImplementation(
      () => new Promise((resolve) => { resolveListen = resolve; }),
    );

    const dispose = openNativeGrpcStreamEvents('stream-a', 'tab-a', {
      onEvent: vi.fn(),
      onStateChange: vi.fn(),
    });
    dispose();
    resolveListen?.({ dispose: disposeFn });
    await Promise.resolve();
    expect(disposeFn).toHaveBeenCalled();
  });

  it('openNativeGrpcStreamEvents handles grpc-error and connected state transitions', async () => {
    let eventHandler: ((event: { type: string }) => void) | undefined;
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockImplementation(async (opts) => {
      eventHandler = (raw) => {
        opts.onEvent({
          type: raw.type as 'grpc-message',
          streamId: 'stream-a',
          requestId: 'req-a',
          tabId: 'tab-a',
          sequence: 1,
          timestamp: '2026-06-30T00:00:00.000Z',
        });
      };
      return { dispose: vi.fn() };
    });

    const onEvent = vi.fn();
    const onStateChange = vi.fn();
    openNativeGrpcStreamEvents('stream-a', 'tab-a', { onEvent, onStateChange });
    await Promise.resolve();

    eventHandler?.({ type: 'grpc-message' });
    expect(onStateChange).toHaveBeenCalledWith('connected');

    eventHandler?.({ type: 'grpc-error' });
    expect(onStateChange).toHaveBeenCalledWith('closed');
  });

  it('installGrpcNativeStreamTransport maps native stream errors to GrpcApiClientError', async () => {
    installGrpcNativeStreamTransport();
    setGrpcTransportMode('tauri');
    syncGrpcTabTransportMode('tab-tauri', 'tauri');
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-native-err' },
    });
    invokeMock.mockRejectedValue(new Error('ipc down'));

    await expect(startGrpcStream({
      requestId: 'req-native-err',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      service: 'echo.EchoService',
      method: 'ServerStream',
      callType: 'server_streaming',
      body: {},
    }, 'tab-tauri')).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('installGrpcNativeStreamTransport maps export failures to GrpcApiClientError', async () => {
    installGrpcNativeStreamTransport();
    setGrpcTransportMode('tauri');
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockRejectedValue(new Error('export failed'));

    await expect(startGrpcStream({
      requestId: 'req-export-fail',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      service: 'echo.EchoService',
      method: 'ServerStream',
      callType: 'server_streaming',
      body: {},
    }, 'tab-tauri')).rejects.toMatchObject({
      name: 'GrpcApiClientError',
      code: 'GRPC_INVALID_REQUEST',
    });
  });

  it('installGrpcNativeStreamTransport uses SSE events opener for express tabs', () => {
    const sseSpy = vi.spyOn(grpcStreamClient, 'openGrpcStreamEventsViaSse').mockReturnValue(() => undefined);
    installGrpcNativeStreamTransport();
    setGrpcTransportMode('express');
    syncGrpcTabTransportMode('tab-express', 'express');
    openGrpcStreamEvents('stream-express', 'tab-express', { onEvent: vi.fn() });
    expect(sseSpy).toHaveBeenCalledWith('stream-express', 'tab-express', expect.any(Object));
    sseSpy.mockRestore();
    clearGrpcNativeStreamTransport();
  });

  it('invokeGrpcStreamCancelNative wraps non-Error invoke failures', async () => {
    invokeMock.mockRejectedValue('cancel ipc string');
    await expect(invokeGrpcStreamCancelNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
    })).rejects.toMatchObject({ op: 'stream_cancel', message: 'cancel ipc string' });
  });

  it('openNativeGrpcStreamEvents uses lastSequence fallback when resolveLastSequence omitted', async () => {
    const listenSpy = vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockResolvedValue({
      dispose: vi.fn(),
    });
    openNativeGrpcStreamEvents('stream-a', 'tab-a', {
      onEvent: vi.fn(),
      lastSequence: 4,
    });
    await Promise.resolve();
    expect(listenSpy.mock.calls[0]?.[0].resolveLastSequence?.()).toBe(4);
  });

  it('openNativeGrpcStreamEvents ignores events after dispose', async () => {
    let eventHandler: ((event: { type: string }) => void) | undefined;
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockImplementation(async (opts) => {
      eventHandler = (raw) => {
        opts.onEvent({
          type: raw.type as 'grpc-message',
          streamId: 'stream-a',
          requestId: 'req-a',
          tabId: 'tab-a',
          sequence: 1,
          timestamp: '2026-06-30T00:00:00.000Z',
        });
      };
      return { dispose: vi.fn() };
    });
    const onEvent = vi.fn();
    const dispose = openNativeGrpcStreamEvents('stream-a', 'tab-a', { onEvent });
    dispose();
    await Promise.resolve();
    eventHandler?.({ type: 'grpc-message' });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('installGrpcNativeStreamTransport uses native events opener for tauri tabs', () => {
    const listenSpy = vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockResolvedValue({
      dispose: vi.fn(),
    });
    installGrpcNativeStreamTransport();
    setGrpcTransportMode('tauri');
    syncGrpcTabTransportMode('tab-tauri', 'tauri');
    openGrpcStreamEvents('stream-tauri', 'tab-tauri', { onEvent: vi.fn() });
    expect(listenSpy).toHaveBeenCalled();
    listenSpy.mockRestore();
    clearGrpcNativeStreamTransport();
  });

  it('nativeGrpcStreamTransport cancel path marks cancelled false when not acknowledged', async () => {
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-z' },
    });
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_start',
      data: {
        streamId: 'stream-z',
        requestId: 'req-z',
        tabId: 'tab-a',
        transportUsed: 'tauri',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await nativeGrpcStreamTransport(
      '/api/grpc/stream/start?tabId=tab-a',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-z',
          descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: 'echo.EchoService',
          method: 'ServerStream',
          callType: 'server_streaming',
          body: {},
        }),
      },
    );

    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_cancel',
      data: {
        streamId: 'stream-z',
        tabId: 'tab-a',
        op: 'end',
        acknowledged: false,
        alreadyTerminal: true,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const cancel = await nativeGrpcStreamTransport(
      '/api/grpc/stream/stream-z?tabId=tab-a',
      { method: 'DELETE' },
    );
    if (cancel.ok) {
      expect(cancel.data.cancelled).toBe(false);
      expect(cancel.data.alreadyEnded).toBe(true);
    }
  });

  it('invokeGrpcStreamEndNative wraps invoke and envelope failures', async () => {
    invokeMock.mockRejectedValue('end ipc string');
    await expect(invokeGrpcStreamEndNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
    })).rejects.toMatchObject({ op: 'stream_end', message: 'end ipc string' });

    invokeMock.mockResolvedValue({
      ok: false,
      op: 'stream_end',
      error: { message: 'end denied' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await expect(invokeGrpcStreamEndNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
    })).rejects.toMatchObject({ op: 'stream_end', retryable: false });
  });

  it('openNativeGrpcStreamEvents reports non-Error listen failures as strings', async () => {
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockRejectedValue('listen string fail');
    const onError = vi.fn();
    openNativeGrpcStreamEvents('stream-a', 'tab-a', { onEvent: vi.fn(), onError });
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith('listen string fail');
  });

  it('openNativeGrpcStreamEvents defaults lastSequence to zero', async () => {
    const listenSpy = vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockResolvedValue({
      dispose: vi.fn(),
    });
    openNativeGrpcStreamEvents('stream-a', 'tab-a', { onEvent: vi.fn() });
    await Promise.resolve();
    expect(listenSpy.mock.calls[0]?.[0].resolveLastSequence?.()).toBe(0);
  });

  it('nativeGrpcStreamTransport handles end without request body', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_start',
      data: {
        streamId: 'stream-bodyless',
        requestId: 'req-bodyless',
        tabId: 'tab-a',
        transportUsed: 'tauri',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-bodyless' },
    });
    await nativeGrpcStreamTransport(
      '/api/grpc/stream/start?tabId=tab-a',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-bodyless',
          descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: 'echo.EchoService',
          method: 'ServerStream',
          callType: 'server_streaming',
          body: {},
        }),
      },
    );

    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_end',
      data: {
        streamId: 'stream-bodyless',
        tabId: 'tab-a',
        op: 'end',
        acknowledged: true,
        alreadyTerminal: false,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const end = await nativeGrpcStreamTransport(
      '/api/grpc/stream/stream-bodyless/end?tabId=tab-a',
      { method: 'POST' },
    );
    expect(end.ok).toBe(true);
  });

  it('nativeGrpcStreamTransport cancel uses empty requestId when stream was not started', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_cancel',
      data: {
        streamId: 'orphan',
        tabId: 'tab-a',
        op: 'cancel',
        acknowledged: true,
        alreadyTerminal: false,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const cancel = await nativeGrpcStreamTransport(
      '/api/grpc/stream/orphan?tabId=tab-a',
      { method: 'DELETE' },
    );
    expect(cancel.ok).toBe(true);
    if (cancel.ok) expect(cancel.meta.requestId).toBe('');
  });

  it('openNativeGrpcStreamEvents forwards adapter onError callbacks', async () => {
    let adapterOnError: ((message: string) => void) | undefined;
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockImplementation(async (opts) => {
      adapterOnError = opts.onError;
      return { dispose: vi.fn() };
    });
    const onError = vi.fn();
    openNativeGrpcStreamEvents('stream-a', 'tab-a', { onEvent: vi.fn(), onError });
    await Promise.resolve();
    adapterOnError?.('adapter error');
    expect(onError).toHaveBeenCalledWith('adapter error');
  });

  it('installGrpcNativeStreamTransport uses native path when stream URL has no tabId', async () => {
    installGrpcNativeStreamTransport();
    setGrpcTransportMode('express');
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-no-tab' },
    });
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_start',
      data: {
        streamId: 'stream-no-tab',
        requestId: 'req-no-tab',
        tabId: '',
        transportUsed: 'tauri',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await nativeGrpcStreamTransport(
      '/api/grpc/stream/start',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId: 'req-no-tab',
          descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: 'echo.EchoService',
          method: 'ServerStream',
          callType: 'server_streaming',
          body: {},
        }),
      },
    );
    expect(invokeMock).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    clearGrpcNativeStreamTransport();
  });

  it('openNativeGrpcStreamEvents honors resolveLastSequence when provided', async () => {
    const listenSpy = vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockResolvedValue({
      dispose: vi.fn(),
    });
    openNativeGrpcStreamEvents('stream-a', 'tab-a', {
      onEvent: vi.fn(),
      resolveLastSequence: () => 11,
      lastSequence: 4,
    });
    await Promise.resolve();
    expect(listenSpy.mock.calls[0]?.[0].resolveLastSequence?.()).toBe(11);
  });

  it('invokeGrpcStreamCancelNative maps non-acknowledged cancel op', async () => {
    invokeMock.mockResolvedValue({
      ok: true,
      op: 'stream_cancel',
      data: {
        streamId: 's1',
        tabId: 'tab-a',
        op: 'cancel',
        acknowledged: false,
        alreadyTerminal: false,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const result = await invokeGrpcStreamCancelNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 's1',
      tabId: 'tab-a',
    });
    expect(result.acknowledged).toBe(false);
  });

  it('invokeGrpcStreamStartNative preserves retryable flag from envelope errors', async () => {
    invokeMock.mockResolvedValue({
      ok: false,
      op: 'stream_start',
      error: { message: 'start denied', code: 'DENIED', retryable: true },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await expect(invokeGrpcStreamStartNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      requestId: 'req-1',
      tabId: 'tab-a',
      callType: 'server_streaming',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: {},
      descriptor: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'abc',
        contentSha256: 'a'.repeat(64),
      },
    })).rejects.toMatchObject({ op: 'stream_start', retryable: true });
  });

  it('installGrpcNativeStreamTransport treats empty tabId as native stream path', async () => {
    installGrpcNativeStreamTransport();
    setGrpcTransportMode('express');
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-empty-tab' },
    });
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'stream_start',
      data: {
        streamId: 'stream-empty-tab',
        requestId: 'req-empty-tab',
        tabId: '',
        transportUsed: 'tauri',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const envelope = await startGrpcStream({
      requestId: 'req-empty-tab',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      service: 'echo.EchoService',
      method: 'ServerStream',
      callType: 'server_streaming',
      body: {},
    }, '');
    expect(invokeMock).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(envelope.data.streamId).toBe('stream-empty-tab');
    fetchSpy.mockRestore();
    clearGrpcNativeStreamTransport();
  });

  it('openNativeGrpcStreamEvents registers abort listener when signal is active', async () => {
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockResolvedValue({
      dispose: vi.fn(),
    });
    const controller = new AbortController();
    const onStateChange = vi.fn();
    openNativeGrpcStreamEvents('stream-a', 'tab-a', {
      onEvent: vi.fn(),
      onStateChange,
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();
    expect(onStateChange).toHaveBeenCalledWith('closed');
  });

  it('openNativeGrpcStreamEvents dispose is idempotent', async () => {
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockResolvedValue({
      dispose: vi.fn(),
    });
    const onStateChange = vi.fn();
    const dispose = openNativeGrpcStreamEvents('stream-a', 'tab-a', {
      onEvent: vi.fn(),
      onStateChange,
    });
    dispose();
    dispose();
    expect(onStateChange).toHaveBeenCalledWith('closed');
    expect(onStateChange.mock.calls.filter((c) => c[0] === 'closed')).toHaveLength(1);
  });

  it('openNativeGrpcStreamEvents reports listen failures via onError', async () => {
    vi.spyOn(grpcTauriEventAdapter, 'listenGrpcTauriStreamEvents').mockRejectedValue(new Error('listen failed'));
    const onError = vi.fn();
    const onStateChange = vi.fn();
    openNativeGrpcStreamEvents('stream-a', 'tab-a', { onEvent: vi.fn(), onError, onStateChange });
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith('listen failed');
    expect(onStateChange).toHaveBeenCalledWith('closed');
  });
});
