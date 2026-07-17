import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import * as grpcApiClient from './grpcApiClient';
import * as grpcWebUnaryClient from './grpcGrpcWebUnaryClient';
import * as springServletUnaryClient from './grpcGrpcSpringServletUnaryClient';
import * as nativeLifecycle from './grpcNativeTauriLifecycle';
import * as nativeTransport from './grpcNativeTauriTransport';
import * as nativeStreamTransport from './grpcNativeTauriStreamTransport';
import {
  bindGrpcStreamTransportForTab,
  clearGrpcStreamTransportBinding,
  resetGrpcStreamTransportBindingsForTests,
} from './grpcTransportFallback';
import {
  cancelGrpcUnary,
  cleanupGrpcTabNative,
  getGrpcNativeTransportRefCountForTests,
  invokeGrpcUnary,
  mountGrpcStudioNativeTransport,
  releaseGrpcNativeTransport,
  resetGrpcNativeTransportRefCountForTests,
  retainGrpcNativeTransport,
  selectGrpcTransport,
  setGrpcTransportMode,
  syncGrpcTabTransportMode,
} from './grpcTransportFacade';

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => false),
  isNode: vi.fn(() => false),
}));

import { isTauri } from '../utils/platform';

describe('grpcTransportFacade', () => {
  beforeEach(() => {
    setGrpcTransportMode(null);
    resetGrpcNativeTransportRefCountForTests();
    resetGrpcStreamTransportBindingsForTests();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.restoreAllMocks();
  });

  it('selectGrpcTransport defaults to express outside Tauri', () => {
    expect(selectGrpcTransport()).toBe('express');
  });

  it('invokeGrpcUnary uses express postGrpcCall when mode is express', async () => {
    setGrpcTransportMode('express');
    const postSpy = vi.spyOn(grpcApiClient, 'postGrpcCall').mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'via-express' },
        durationMs: 5,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });

    const envelope = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-express',
    });

    expect(postSpy).toHaveBeenCalledWith(FIXTURE_UNARY_CALL_REQUEST, 'tab-express');
    expect(envelope.data.body).toEqual({ message: 'via-express' });
  });

  it('invokeGrpcUnary uses native transport when mode is tauri', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: {
        protosetBase64: 'Ym9keQ==',
        fileName: 'schema.pb',
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });

    vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockResolvedValue({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'via-tauri' },
      durationMs: 8,
      transportUsed: 'tauri',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
    });

    const envelope = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-tauri',
      descriptorPayload: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'Ym9keQ==',
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
    });

    expect(envelope.op).toBe('call');
    expect(envelope.data.body).toEqual({ message: 'via-tauri' });
  });

  it('cancelGrpcUnary routes to native cancel in tauri mode', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcCallCancelNative').mockResolvedValue({
      requestId: 'req-1',
      cancelled: true,
    });

    const envelope = await cancelGrpcUnary('req-1', 'tab-1');
    expect(envelope.data.cancelled).toBe(true);
  });

  it('cancelGrpcUnary throws GrpcApiClientError on native not-found', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcCallCancelNative').mockRejectedValue(
      new nativeTransport.GrpcNativeTauriTransportError('call_cancel', 'No in-flight call registered for requestId', {
        code: 'GRPC_TAURI_REQUEST_NOT_FOUND',
      }),
    );

    await expect(cancelGrpcUnary('missing', 'tab-1')).rejects.toMatchObject({
      name: 'GrpcApiClientError',
      code: 'GRPC_REQUEST_NOT_FOUND',
      op: 'cancel',
    });
  });

  it('invokeGrpcUnary throws GrpcApiClientError on non-zero native grpc status', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockResolvedValue({
      callType: 'unary',
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: {},
      trailers: {},
      durationMs: 4,
      transportUsed: 'tauri',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
    });

    await expect(invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-tauri',
      descriptorPayload: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'Ym9keQ==',
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
    })).rejects.toMatchObject({
      name: 'GrpcApiClientError',
      op: 'call',
      details: { grpcStatus: 3 },
    });
  });

  it('invokeGrpcUnary rejects descriptor payload with empty protoset', async () => {
    setGrpcTransportMode('tauri');

    await expect(invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-tauri',
      descriptorPayload: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: '   ',
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
    })).rejects.toMatchObject({
      name: 'GrpcApiClientError',
      op: 'call',
      code: 'GRPC_INVALID_DESCRIPTOR',
    });
  });

  it('invokeGrpcUnary recomputes descriptor payload SHA from protoset bytes', async () => {
    setGrpcTransportMode('tauri');
    const invokeSpy = vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockResolvedValue({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'via-tauri' },
      durationMs: 1,
      transportUsed: 'tauri',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
    });

    await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-tauri',
      descriptorPayload: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'Ym9keQ==',
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
    });

    expect(invokeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptor: expect.objectContaining({
          contentSha256: '230d8358dc8e8890b4c58deeb62912ee2f20357ae92a5cc861b98e68fe31acb5',
        }),
      }),
    );
  });

  it('retainGrpcNativeTransport installs stream transport once in tauri mode', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    setGrpcTransportMode('tauri');
    const installSpy = vi.spyOn(nativeStreamTransport, 'installGrpcNativeStreamTransport');

    retainGrpcNativeTransport();
    retainGrpcNativeTransport();

    expect(installSpy).toHaveBeenCalledTimes(1);
    expect(getGrpcNativeTransportRefCountForTests()).toBe(2);
  });

  it('releaseGrpcNativeTransport clears install when ref count reaches zero', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    setGrpcTransportMode('tauri');
    const clearSpy = vi.spyOn(nativeStreamTransport, 'clearGrpcNativeStreamTransport');

    retainGrpcNativeTransport();
    releaseGrpcNativeTransport();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(getGrpcNativeTransportRefCountForTests()).toBe(0);
  });

  it('mountGrpcStudioNativeTransport returns dispose that releases retain', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeStreamTransport, 'installGrpcNativeStreamTransport');

    const dispose = mountGrpcStudioNativeTransport();
    expect(getGrpcNativeTransportRefCountForTests()).toBe(1);

    dispose();
    expect(getGrpcNativeTransportRefCountForTests()).toBe(0);
  });

  it('retainGrpcNativeTransport is a no-op outside Tauri', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    setGrpcTransportMode('tauri');
    const installSpy = vi.spyOn(nativeStreamTransport, 'installGrpcNativeStreamTransport');

    retainGrpcNativeTransport();
    expect(installSpy).not.toHaveBeenCalled();
    expect(getGrpcNativeTransportRefCountForTests()).toBe(0);
  });

  it('releaseGrpcNativeTransport decrements even when transport mode switches to express', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeStreamTransport, 'installGrpcNativeStreamTransport');
    const clearSpy = vi.spyOn(nativeStreamTransport, 'clearGrpcNativeStreamTransport');

    retainGrpcNativeTransport();
    setGrpcTransportMode('express');
    releaseGrpcNativeTransport();

    expect(getGrpcNativeTransportRefCountForTests()).toBe(0);
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('invokeGrpcUnary express retry attaches fallbackReason metadata', async () => {
    syncGrpcTabTransportMode('tab-express', 'express');
    const postSpy = vi.spyOn(grpcApiClient, 'postGrpcCall').mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'via-express' },
        durationMs: 5,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });

    const envelope = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-express',
      fallbackReason: 'native invoke failed',
    });

    expect(postSpy).toHaveBeenCalled();
    expect(envelope.data.transportUsed).toBe('express');
    expect(envelope.data.fallbackReason).toBe('native invoke failed');
  });

  it('express tab on desktop bypasses native unary', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    syncGrpcTabTransportMode('tab-express', 'express');
    const postSpy = vi.spyOn(grpcApiClient, 'postGrpcCall').mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'express-tab' },
        durationMs: 3,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });
    const nativeSpy = vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative');

    await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-express',
    });

    expect(postSpy).toHaveBeenCalled();
    expect(nativeSpy).not.toHaveBeenCalled();
  });

  it('stream transport binding locks routing after stream_start', () => {
    syncGrpcTabTransportMode('tab-stream', 'tauri');
    bindGrpcStreamTransportForTab('tab-stream', 'tauri');
    syncGrpcTabTransportMode('tab-stream', 'express');
    expect(selectGrpcTransport('tab-stream')).toBe('tauri');
    clearGrpcStreamTransportBinding('tab-stream');
    expect(selectGrpcTransport('tab-stream')).toBe('express');
  });

  it('cleanupGrpcTabNative skips native invoke when transport snapshot is express', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    setGrpcTransportMode('tauri');
    syncGrpcTabTransportMode('tab-close', 'tauri');
    const cleanupSpy = vi.spyOn(nativeLifecycle, 'invokeGrpcTabCleanupNative');

    await cleanupGrpcTabNative('tab-close', { transportMode: 'express' });

    expect(cleanupSpy).not.toHaveBeenCalled();
  });

  it('invokeGrpcUnary routes grpc-web mode through grpc-web client (Phase 10C)', async () => {
    syncGrpcTabTransportMode('tab-grpc-web', 'grpc-web');
    const postSpy = vi.spyOn(grpcApiClient, 'postGrpcCall');
    const webSpy = vi.spyOn(grpcWebUnaryClient, 'invokeGrpcWebUnary').mockResolvedValue({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'ok' },
      durationMs: 3,
      transportUsed: 'grpc-web',
    });
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { requestId: FIXTURE_UNARY_CALL_REQUEST.requestId, timestamp: '2026-06-30T00:00:00.000Z' },
    });

    const envelope = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-grpc-web',
    });

    expect(webSpy).toHaveBeenCalled();
    expect(envelope.data.transportUsed).toBe('grpc-web');
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('invokeGrpcUnary routes spring-servlet mode through servlet client (Phase 10D)', async () => {
    syncGrpcTabTransportMode('tab-servlet', 'spring-servlet');
    const postSpy = vi.spyOn(grpcApiClient, 'postGrpcCall');
    const servletSpy = vi.spyOn(springServletUnaryClient, 'invokeGrpcSpringServletUnary').mockResolvedValue({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'ok' },
      durationMs: 3,
      transportUsed: 'spring-servlet',
    });
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { requestId: FIXTURE_UNARY_CALL_REQUEST.requestId, timestamp: '2026-06-30T00:00:00.000Z' },
    });

    const envelope = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-servlet',
    });

    expect(servletSpy).toHaveBeenCalled();
    expect(envelope.data.transportUsed).toBe('spring-servlet');
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('cancelGrpcUnary spring-servlet uses abort registry not Express delete (Phase 10D)', async () => {
    syncGrpcTabTransportMode('tab-servlet', 'spring-servlet');
    const deleteSpy = vi.spyOn(grpcApiClient, 'deleteGrpcCall');
    const nativeSpy = vi.spyOn(nativeTransport, 'invokeGrpcCallCancelNative');

    const envelope = await cancelGrpcUnary('req-1', 'tab-servlet');

    expect(envelope.data.cancelled).toBe(false);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(nativeSpy).not.toHaveBeenCalled();
  });

  it('cleanupGrpcTabNative skips native invoke for browser-direct modes on desktop (Phase 10A)', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    syncGrpcTabTransportMode('tab-grpc-web', 'grpc-web');
    const cleanupSpy = vi.spyOn(nativeLifecycle, 'invokeGrpcTabCleanupNative');

    await cleanupGrpcTabNative('tab-grpc-web');
    await cleanupGrpcTabNative('tab-grpc-web', { transportMode: 'grpc-web' });
    await cleanupGrpcTabNative('tab-servlet', { transportMode: 'spring-servlet' });

    expect(cleanupSpy).not.toHaveBeenCalled();
  });
});
