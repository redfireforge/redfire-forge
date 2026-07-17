import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import * as grpcApiClient from './grpcApiClient';
import {
  clearGrpcNativeStreamTransport,
  installGrpcNativeStreamTransport,
  invokeGrpcStreamEndNative,
  invokeGrpcStreamStartNative,
  openNativeGrpcStreamEvents,
} from './grpcNativeTauriStreamTransport';
import { GRPC_TAURI_SCHEMA_VERSION } from './grpcTauriContracts';
import { listenGrpcTauriStreamEvents } from './grpcTauriEventAdapter';
import { startGrpcStream } from './grpcStreamClient';
import { resetGrpcTabTransportRoutingForTests, syncGrpcTabTransportMode } from './grpcTransportTabRouting';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('./grpcTauriEventAdapter', () => ({
  listenGrpcTauriStreamEvents: vi.fn(async () => ({ dispose: vi.fn() })),
}));

describe('grpcNativeTauriStreamTransport', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    clearGrpcNativeStreamTransport();
    resetGrpcTabTransportRoutingForTests();
  });

  it('invokeGrpcStreamStartNative routes grpc_stream_start invoke', async () => {
    invokeMock.mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: {
        streamId: 'stream-1',
        requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
        tabId: 'tab-a',
        transportUsed: 'tauri',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    const result = await invokeGrpcStreamStartNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
      tabId: 'tab-a',
      callType: 'server_streaming',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello', repeatCount: 1, intervalMs: 0 },
      descriptor: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'abc',
        contentSha256: 'a'.repeat(64),
      },
    });

    expect(invokeMock).toHaveBeenCalledWith('grpc_stream_start', expect.any(Object));
    expect(result.streamId).toBe('stream-1');
  });

  it('installGrpcNativeStreamTransport wires stream transport override', () => {
    installGrpcNativeStreamTransport();
    expect(typeof startGrpcStream).toBe('function');
  });

  it('startGrpcStream uses native transport when installed', async () => {
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-native' },
    });
    installGrpcNativeStreamTransport();
    syncGrpcTabTransportMode('tab-native', 'tauri');
    invokeMock.mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: {
        streamId: 'stream-native',
        requestId: 'req-native',
        tabId: 'tab-native',
        transportUsed: 'tauri',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    const envelope = await startGrpcStream({
      requestId: 'req-native',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      service: 'echo.EchoService',
      method: 'ServerStream',
      callType: 'server_streaming',
      body: { message: 'hello', repeatCount: 1, intervalMs: 0 },
    }, 'tab-native');

    expect(envelope.data.streamId).toBe('stream-native');
    clearGrpcNativeStreamTransport();
  });

  it('invokeGrpcStreamEndNative maps alreadyTerminal to GrpcStreamEndResult', async () => {
    invokeMock.mockResolvedValue({
      ok: true,
      op: 'stream_end',
      data: {
        streamId: 'stream-gone',
        tabId: 'tab-a',
        op: 'end',
        acknowledged: false,
        alreadyTerminal: true,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    const result = await invokeGrpcStreamEndNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId: 'stream-gone',
      tabId: 'tab-a',
    });

    expect(result.alreadyTerminal).toBe(true);
    expect(result.acknowledged).toBe(false);
  });

  it('openNativeGrpcStreamEvents disposes on AbortSignal and reports connecting state', () => {
    const onStateChange = vi.fn();
    const controller = new AbortController();
    const dispose = openNativeGrpcStreamEvents('stream-a', 'tab-a', {
      onEvent: vi.fn(),
      onStateChange,
      signal: controller.signal,
    });

    expect(onStateChange).toHaveBeenCalledWith('connecting');
    expect(listenGrpcTauriStreamEvents).toHaveBeenCalled();

    controller.abort();
    expect(onStateChange).toHaveBeenCalledWith('closed');
    dispose();
  });
});
