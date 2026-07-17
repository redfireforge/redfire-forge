/**
 * Coverage gaps — grpcTransportFacade.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import {
  FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import { GrpcApiClientError } from './grpcApiClient';
import * as grpcApiClient from './grpcApiClient';
import * as nativeStreamTransport from './grpcNativeTauriStreamTransport';
import * as nativeTransport from './grpcNativeTauriTransport';
import {
  cancelGrpcUnary,
  getGrpcNativeTransportRefCountForTests,
  invokeGrpcUnary,
  mountGrpcStudioNativeTransport,
  releaseGrpcNativeTransport,
  resetGrpcNativeTransportRefCountForTests,
  retainGrpcNativeTransport,
  selectGrpcTransport,
  setGrpcTransportMode,
} from './grpcTransportFacade';
import { isTauri } from '../utils/platform';

describe('grpcTransportFacade coverage gaps', () => {
  beforeEach(() => {
    setGrpcTransportMode(null);
    resetGrpcNativeTransportRefCountForTests();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.restoreAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('retainGrpcNativeTransport installs stream transport once in tauri mode', () => {
    setGrpcTransportMode('tauri');
    vi.mocked(isTauri).mockReturnValue(true);
    const installSpy = vi.spyOn(nativeStreamTransport, 'installGrpcNativeStreamTransport');
    retainGrpcNativeTransport();
    retainGrpcNativeTransport();
    expect(installSpy).toHaveBeenCalledTimes(1);
    expect(getGrpcNativeTransportRefCountForTests()).toBe(2);
  });

  it('releaseGrpcNativeTransport clears stream transport when ref count reaches zero', () => {
    setGrpcTransportMode('tauri');
    vi.mocked(isTauri).mockReturnValue(true);
    const clearSpy = vi.spyOn(nativeStreamTransport, 'clearGrpcNativeStreamTransport');
    retainGrpcNativeTransport();
    releaseGrpcNativeTransport();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(getGrpcNativeTransportRefCountForTests()).toBe(0);
  });

  it('retain and release are no-ops outside tauri mode', () => {
    setGrpcTransportMode('express');
    const installSpy = vi.spyOn(nativeStreamTransport, 'installGrpcNativeStreamTransport');
    retainGrpcNativeTransport();
    releaseGrpcNativeTransport();
    expect(installSpy).not.toHaveBeenCalled();
    expect(getGrpcNativeTransportRefCountForTests()).toBe(0);
  });

  it('mountGrpcStudioNativeTransport returns dispose that releases one retain', () => {
    setGrpcTransportMode('tauri');
    vi.mocked(isTauri).mockReturnValue(true);
    const dispose = mountGrpcStudioNativeTransport();
    expect(getGrpcNativeTransportRefCountForTests()).toBe(1);
    dispose();
    expect(getGrpcNativeTransportRefCountForTests()).toBe(0);
  });

  it('selectGrpcTransport honors mode override', () => {
    setGrpcTransportMode('tauri');
    expect(selectGrpcTransport()).toBe('tauri');
  });

  it('invokeGrpcUnary resolves descriptor payload via export when omitted', async () => {
    setGrpcTransportMode('tauri');
    const protosetBase64 = btoa('protoset-bytes');
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64, fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });
    vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockResolvedValue({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'exported' },
      durationMs: 6,
      transportUsed: 'tauri',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
    });

    const envelope = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-export',
    });

    expect(envelope.data.body).toEqual({ message: 'exported' });
  });

  it('invokeGrpcUnary maps non-descriptor payload failures to INVALID_REQUEST', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockRejectedValue(new Error('network down'));

    await expect(invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-fail',
    })).rejects.toMatchObject({
      name: 'GrpcApiClientError',
      code: 'GRPC_INVALID_REQUEST',
    });
  });

  it('invokeGrpcUnary rethrows unexpected native errors', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockRejectedValue(new Error('unexpected'));

    await expect(invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-throw',
      descriptorPayload: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'Ym9keQ==',
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
    })).rejects.toThrow('unexpected');
  });

  it('cancelGrpcUnary uses express deleteGrpcCall when mode is express', async () => {
    setGrpcTransportMode('express');
    const deleteSpy = vi.spyOn(grpcApiClient, 'deleteGrpcCall').mockResolvedValue({
      ok: true,
      op: 'cancel',
      data: { requestId: 'req-express', cancelled: true },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-express' },
    });

    const envelope = await cancelGrpcUnary('req-express', 'tab-express');
    expect(deleteSpy).toHaveBeenCalledWith('req-express', 'tab-express');
    expect(envelope.data.cancelled).toBe(true);
  });

  it('cancelGrpcUnary rethrows unexpected native cancel errors', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcCallCancelNative').mockRejectedValue(new Error('boom'));

    await expect(cancelGrpcUnary('req-1', 'tab-1')).rejects.toThrow('boom');
  });

  it('invokeGrpcUnary maps native transport errors to GrpcApiClientError', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockRejectedValue(
      new nativeTransport.GrpcNativeTauriTransportError('unary', 'channel failed', {
        code: 'GRPC_TAURI_CHANNEL_BUILD',
        retryable: true,
      }),
    );

    await expect(invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-native-err',
      descriptorPayload: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'Ym9keQ==',
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
    })).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('invokeGrpcUnary treats non-Error descriptor resolution failures as strings', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockRejectedValue('export failed');

    await expect(invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-string-err',
    })).rejects.toMatchObject({
      name: 'GrpcApiClientError',
      message: 'export failed',
    });
  });

  it('cancelGrpcUnary maps native transport errors to GrpcApiClientError', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcCallCancelNative').mockRejectedValue(
      new nativeTransport.GrpcNativeTauriTransportError('call_cancel', 'missing', {
        code: 'GRPC_TAURI_REQUEST_NOT_FOUND',
      }),
    );

    await expect(cancelGrpcUnary('missing', 'tab-1')).rejects.toBeInstanceOf(GrpcApiClientError);
  });
});
