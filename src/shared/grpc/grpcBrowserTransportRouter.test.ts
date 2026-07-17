/**
 * Phase 10B — Browser transport router unit tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import * as grpcApiClient from './grpcApiClient';
import * as springServletUnaryClient from './grpcGrpcSpringServletUnaryClient';
import {
  assertGrpcTransportDispatchReady,
  isGrpcTransportDispatchImplemented,
  listGrpcBrowserTransportAdapters,
  resolveDispatchableGrpcTransportMode,
  resolveGrpcBrowserTransportAdapter,
  resolveGrpcBrowserTransportAdapterForTab,
} from './grpcBrowserTransportRouter';
import {
  cancelGrpcUnary,
  invokeGrpcUnary,
  setGrpcTransportMode,
  resetGrpcNativeTransportRefCountForTests,
} from './grpcTransportFacade';

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => false),
  isNode: vi.fn(() => false),
}));

describe('grpcBrowserTransportRouter (Phase 10B)', () => {
  beforeEach(() => {
    setGrpcTransportMode(null);
    resetGrpcNativeTransportRefCountForTests();
    vi.restoreAllMocks();
  });

  it('registers four adapters with deterministic modes', () => {
    const adapters = listGrpcBrowserTransportAdapters();
    expect(adapters.map((entry) => entry.mode).sort()).toEqual([
      'express',
      'grpc-web',
      'spring-servlet',
      'tauri',
    ]);
  });

  it('isGrpcTransportDispatchImplemented reads adapter dispatchReady flags', () => {
    expect(isGrpcTransportDispatchImplemented('express')).toBe(true);
    expect(isGrpcTransportDispatchImplemented('tauri')).toBe(true);
    expect(isGrpcTransportDispatchImplemented('grpc-web')).toBe(true);
    expect(isGrpcTransportDispatchImplemented('spring-servlet')).toBe(true);
  });

  it('assertGrpcTransportDispatchReady allows spring-servlet after 10D; grpc-web is ready', () => {
    expect(() => assertGrpcTransportDispatchReady('spring-servlet')).not.toThrow();
    expect(() => assertGrpcTransportDispatchReady('grpc-web')).not.toThrow();
    expect(() => assertGrpcTransportDispatchReady('express')).not.toThrow();
  });

  it('resolveDispatchableGrpcTransportMode returns express/tauri and rejects other modes', () => {
    expect(resolveDispatchableGrpcTransportMode('express')).toBe('express');
    expect(resolveDispatchableGrpcTransportMode('tauri')).toBe('tauri');
    expect(() => resolveDispatchableGrpcTransportMode('grpc-web'))
      .toThrow(/Unreachable gRPC transport mode: grpc-web/);
    expect(() => resolveDispatchableGrpcTransportMode('spring-servlet'))
      .toThrow(/Unreachable gRPC transport mode: spring-servlet/);
  });

  it('resolveGrpcBrowserTransportAdapter returns express adapter with startStream', () => {
    const adapter = resolveGrpcBrowserTransportAdapter('express');
    expect(adapter.mode).toBe('express');
    expect(adapter.dispatchReady).toBe(true);
    expect(adapter.startStream).toBeTypeOf('function');
  });

  it('snapshot transportMode binds invoke even when tab registry differs', async () => {
    setGrpcTransportMode('grpc-web');
    const postSpy = vi.spyOn(grpcApiClient, 'postGrpcCall').mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'snapshot-express' },
        durationMs: 3,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });

    const envelope = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-snapshot-bind',
      transportMode: 'express',
    });

    expect(postSpy).toHaveBeenCalled();
    expect(envelope.data.transportUsed).toBe('express');
    expect(envelope.data.body).toEqual({ message: 'snapshot-express' });
  });

  it('resolveGrpcBrowserTransportAdapterForTab uses tab registry when snapshot omitted', () => {
    setGrpcTransportMode('tauri');
    const adapter = resolveGrpcBrowserTransportAdapterForTab('tab-registry');
    expect(adapter.mode).toBe('tauri');
  });

  it('cancelGrpcUnary uses snapshot transportMode over tab registry', async () => {
    setGrpcTransportMode('grpc-web');
    const deleteSpy = vi.spyOn(grpcApiClient, 'deleteGrpcCall').mockResolvedValue({
      ok: true,
      op: 'cancel',
      data: { requestId: 'req-cancel', cancelled: true },
      meta: { requestId: 'req-cancel', timestamp: '2026-06-30T00:00:00.000Z' },
    });

    await cancelGrpcUnary('req-cancel', 'tab-snapshot-cancel', { transportMode: 'express' });

    expect(deleteSpy).toHaveBeenCalledWith('req-cancel', 'tab-snapshot-cancel');
  });

  it('cancelGrpcUnary with snapshot express succeeds when tab registry is grpc-web', async () => {
    setGrpcTransportMode('grpc-web');
    const deleteSpy = vi.spyOn(grpcApiClient, 'deleteGrpcCall').mockResolvedValue({
      ok: true,
      op: 'cancel',
      data: { requestId: 'req-cleanup', cancelled: true },
      meta: { requestId: 'req-cleanup', timestamp: '2026-06-30T00:00:00.000Z' },
    });

    await expect(cancelGrpcUnary('req-cleanup', 'tab-cleanup', { transportMode: 'express' }))
      .resolves.toMatchObject({ ok: true, op: 'cancel' });
    expect(deleteSpy).toHaveBeenCalled();

    deleteSpy.mockClear();
    await expect(cancelGrpcUnary('req-cleanup', 'tab-cleanup'))
      .resolves.toMatchObject({ ok: true, op: 'cancel', data: { cancelled: false } });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('cancelGrpcUnary with snapshot express succeeds when tab registry is spring-servlet', async () => {
    setGrpcTransportMode('spring-servlet');
    const deleteSpy = vi.spyOn(grpcApiClient, 'deleteGrpcCall').mockResolvedValue({
      ok: true,
      op: 'cancel',
      data: { requestId: 'req-servlet-cleanup', cancelled: true },
      meta: { requestId: 'req-servlet-cleanup', timestamp: '2026-06-30T00:00:00.000Z' },
    });
    const servletCancelSpy = vi.spyOn(springServletUnaryClient, 'cancelGrpcSpringServletUnary');

    await expect(cancelGrpcUnary('req-servlet-cleanup', 'tab-servlet-cleanup', { transportMode: 'express' }))
      .resolves.toMatchObject({ ok: true, op: 'cancel' });
    expect(deleteSpy).toHaveBeenCalled();
    expect(servletCancelSpy).not.toHaveBeenCalled();

    deleteSpy.mockClear();
    servletCancelSpy.mockReset();
    servletCancelSpy.mockReturnValue(false);
    await expect(cancelGrpcUnary('req-servlet-cleanup', 'tab-servlet-cleanup'))
      .resolves.toMatchObject({ ok: true, op: 'cancel', data: { cancelled: false } });
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(servletCancelSpy).toHaveBeenCalledWith('tab-servlet-cleanup', 'req-servlet-cleanup');
  });
});
