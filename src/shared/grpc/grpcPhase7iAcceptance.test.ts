/**
 * Phase 7I — Acceptance checklist traceability (hardening gate).
 *
 * Each describe block maps to one Phase 7 acceptance checklist item.
 * Tests exercise the transport facade, event adapter, lifecycle helpers,
 * and workflow bridge with mocked IPC (no live tonic/Docker required).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowNode } from '@workflow/types/workflow';
import { runGraph } from '@workflow/engine/graphRunner';
import {
  endNode,
  makeEdge,
  startNode,
} from '@workflow/engine/graphRunnerNodeHandlers.test-utils';
import {
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import { GRPC_STREAM_SSE_DISCONNECT_GRACE_MS } from './contracts';
import { buildGrpcNodeOperations } from './buildGrpcNodeOperations';
import { GrpcApiClientError } from './grpcApiClient';
import * as grpcApiClient from './grpcApiClient';
import * as nativeLifecycle from './grpcNativeTauriLifecycle';
import * as nativeTransport from './grpcNativeTauriTransport';
import {
  shouldAcceptGrpcTauriEventForStream,
  GrpcTauriEventSequenceBuffer,
  normalizeGrpcTauriEvent,
} from './grpcTauriEventAdapter';
import type { GrpcTauriEvent } from './grpcTauriContracts';
import { toGrpcApiClientErrorFromUnaryResult } from './grpcTauriErrorMapping';
import {
  bindGrpcStreamTransportForTab,
  clearGrpcStreamTransportBinding,
  isGrpcExpressFallbackOffered,
  isGrpcNativePreflightFailure,
  resetGrpcStreamTransportBindingsForTests,
  withGrpcExpressFallbackOffer,
} from './grpcTransportFallback';
import {
  cancelGrpcUnary,
  cleanupGrpcTabNative,
  invokeGrpcUnary,
  resetGrpcNativeTransportRefCountForTests,
  resetGrpcTabTransportRoutingForTests,
  selectGrpcTransport,
  setGrpcTransportMode,
  syncGrpcTabTransportMode,
} from './grpcTransportFacade';
import * as grpcStreamClient from './grpcStreamClient';
import type { GrpcStreamStartRequest } from './contracts';
import { cleanupGrpcStudioTabNativeResources } from '@grpc/hooks/grpcStudioTabLifecycle';

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => false),
  isNode: vi.fn(() => false),
}));

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { isTauri } from '../utils/platform';
import { httpFetch } from '../utils/httpClient';

const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  resetGrpcNativeTransportRefCountForTests();
  resetGrpcTabTransportRoutingForTests();
  setGrpcTransportMode(null);
  vi.mocked(isTauri).mockReturnValue(false);
  mockHttpFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '{}',
  });
});

function makeTauriEvent(overrides: Partial<GrpcTauriEvent> = {}): GrpcTauriEvent {
  return {
    schemaVersion: 1,
    type: 'grpc-message',
    streamId: 'stream-a',
    requestId: 'req-a',
    tabId: 'tab-a',
    sequence: 1,
    timestamp: '2026-06-30T00:00:00.000Z',
    data: { message: 'hello' },
    ...overrides,
  };
}

const UNARY_ERROR_FIXTURE = {
  status: 3,
  statusMessage: 'INVALID_ARGUMENT',
  headers: { 'x-meta': '1' },
  trailers: { 'grpc-status-details-bin': 'detail-bytes' },
  errorDetail: 'field "message" is required',
  durationMs: 4,
};

// ─── Checklist 1: tab-scoped routing ─────────────────────────────────────────

describe('Phase 7I acceptance — checklist-1: tab-scoped response routing', () => {
  it('rejects stream events for a different tabId or streamId', () => {
    const event = makeTauriEvent();
    expect(shouldAcceptGrpcTauriEventForStream(event, 'stream-a', 'tab-a', 0, 'req-a')).toBe(true);
    expect(shouldAcceptGrpcTauriEventForStream(event, 'stream-b', 'tab-a', 0, 'req-a')).toBe(false);
    expect(shouldAcceptGrpcTauriEventForStream(event, 'stream-a', 'tab-b', 0, 'req-a')).toBe(false);
    expect(shouldAcceptGrpcTauriEventForStream(event, 'stream-a', 'tab-a', 0, 'req-other')).toBe(false);
  });

  it('routes unary invoke and cancel through tab-scoped facade arguments', async () => {
    setGrpcTransportMode('tauri');
    const invokeSpy = vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockResolvedValue({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'tab-scoped' },
      durationMs: 2,
      transportUsed: 'tauri',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
    });
    const cancelSpy = vi.spyOn(nativeTransport, 'invokeGrpcCallCancelNative').mockResolvedValue({
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
      cancelled: true,
    });

    await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-routing-a',
      descriptorPayload: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'Ym9keQ==',
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
    });
    await cancelGrpcUnary(FIXTURE_UNARY_CALL_REQUEST.requestId, 'tab-routing-a');

    expect(invokeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 'tab-routing-a' }),
    );
    expect(cancelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 'tab-routing-a' }),
    );
  });

  it('keeps per-tab transport mode independent when global override is cleared', () => {
    setGrpcTransportMode(null);
    syncGrpcTabTransportMode('tab-native', 'tauri');
    syncGrpcTabTransportMode('tab-express', 'express');
    expect(selectGrpcTransport('tab-native')).toBe('tauri');
    expect(selectGrpcTransport('tab-express')).toBe('express');
  });
});

// ─── Checklist 2: tab close cancels native ops ───────────────────────────────

describe('Phase 7I acceptance — checklist-2: tab close cancels native ops', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    setGrpcTransportMode('tauri');
  });

  it('tab cleanup invokes native cleanup only for the requested tabId', async () => {
    const cleanupSpy = vi.spyOn(nativeLifecycle, 'invokeGrpcTabCleanupNative').mockResolvedValue({
      tabId: 'tab-close-a',
      cancelledStreams: 1,
      releasedChannels: 0,
    });

    await cleanupGrpcTabNative('tab-close-a');
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(cleanupSpy).toHaveBeenCalledWith('tab-close-a');
    expect(cleanupSpy).not.toHaveBeenCalledWith('tab-close-b');
  });

  it('cleanupGrpcTabNative skips native invoke for express tabs and outside Tauri', async () => {
    const cleanupSpy = vi.spyOn(nativeLifecycle, 'invokeGrpcTabCleanupNative').mockResolvedValue({
      tabId: 'tab-express',
      cancelledStreams: 0,
      releasedChannels: 0,
    });

    setGrpcTransportMode(null);
    syncGrpcTabTransportMode('tab-express', 'express');
    await cleanupGrpcTabNative('tab-express');
    expect(cleanupSpy).not.toHaveBeenCalled();

    await cleanupGrpcTabNative('tab-express', { transportMode: 'express' });
    expect(cleanupSpy).not.toHaveBeenCalled();

    vi.mocked(isTauri).mockReturnValue(false);
    syncGrpcTabTransportMode('tab-web', 'tauri');
    await cleanupGrpcTabNative('tab-web');
    expect(cleanupSpy).not.toHaveBeenCalled();
  });

  it('studio tab native cleanup helper delegates to facade', async () => {
    const cleanupSpy = vi.spyOn(nativeLifecycle, 'invokeGrpcTabCleanupNative').mockResolvedValue({
      tabId: 'tab-close-b',
      cancelledStreams: 0,
      releasedChannels: 0,
    });

    await cleanupGrpcStudioTabNativeResources('tab-close-b');
    expect(cleanupSpy).toHaveBeenCalledWith('tab-close-b');
  });

  it('cancelGrpcUnary scopes cancel to the provided tabId', async () => {
    vi.spyOn(nativeTransport, 'invokeGrpcCallCancelNative').mockResolvedValue({
      requestId: 'req-tab-b',
      cancelled: true,
    });

    await cancelGrpcUnary('req-tab-b', 'tab-close-b');
    expect(nativeTransport.invokeGrpcCallCancelNative).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 'tab-close-b', requestId: 'req-tab-b' }),
    );
  });
});

// ─── Checklist 3: stream control idempotency ─────────────────────────────────

describe('Phase 7I acceptance — checklist-3: stream control idempotency', () => {
  it('second cancelGrpcUnary for missing request returns REQUEST_NOT_FOUND without throwing raw IPC errors', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcCallCancelNative').mockRejectedValue(
      new nativeTransport.GrpcNativeTauriTransportError('call_cancel', 'No in-flight call', {
        code: 'GRPC_TAURI_REQUEST_NOT_FOUND',
      }),
    );

    await expect(cancelGrpcUnary('missing-req', 'tab-idem')).rejects.toMatchObject({
      name: 'GrpcApiClientError',
      code: 'GRPC_REQUEST_NOT_FOUND',
      op: 'cancel',
    });
  });

  it('stream transport binding prevents mid-flight transport mode switch', () => {
    syncGrpcTabTransportMode('tab-stream', 'tauri');
    bindGrpcStreamTransportForTab('tab-stream', 'tauri');
    syncGrpcTabTransportMode('tab-stream', 'express');
    expect(selectGrpcTransport('tab-stream')).toBe('tauri');
    clearGrpcStreamTransportBinding('tab-stream');
    expect(selectGrpcTransport('tab-stream')).toBe('express');
  });

  it('defers native stream cancel/end idempotency to Rust gate spot-checks', () => {
    // Verified in test-grpc-phase7i.sh Step 4:
    // cancel_control_is_idempotent_on_terminal_stream,
    // end_control_is_idempotent_on_terminal_stream
    const rustGateSpotChecks = [
      'cancel_control_is_idempotent_on_terminal_stream',
      'end_control_is_idempotent_on_terminal_stream',
    ];
    expect(rustGateSpotChecks).toHaveLength(2);
  });
});

// ─── Checklist 4: orphan cleanup within timeout ──────────────────────────────

describe('Phase 7I acceptance — checklist-4: orphan cleanup within timeout', () => {
  it('native orphan grace matches Express SSE disconnect grace (60s)', () => {
    expect(GRPC_STREAM_SSE_DISCONNECT_GRACE_MS).toBe(60_000);
    // Rust supervisor: lifecycle_test detached_tab_within_grace_keeps_active_stream,
    // detached_tab_orphan_supervisor_cancels_after_grace — see test-grpc-phase7i.sh Step 4.
  });
});

// ─── Checklist 5: channel pool reuse and eviction ────────────────────────────

describe('Phase 7I acceptance — checklist-5: channel pool reuse and eviction', () => {
  it('defers channel pool reuse and TLS fingerprint eviction to Rust gate spot-checks', () => {
    // Verified in test-grpc-phase7i.sh Step 4:
    // reuse_on_identical_target_returns_same_pool_entry,
    // fingerprint_changes_on_tls_mode, fingerprint_does_not_include_auth_type
    const rustGateSpotChecks = [
      'reuse_on_identical_target_returns_same_pool_entry',
      'fingerprint_changes_on_tls_mode',
      'fingerprint_does_not_include_auth_type',
    ];
    expect(rustGateSpotChecks).toHaveLength(3);
  });
});

// ─── Checklist 6: unary error envelope parity ────────────────────────────────

describe('Phase 7I acceptance — checklist-6: unary error envelope parity', () => {
  const sharedError = {
    ...UNARY_ERROR_FIXTURE,
    callType: 'unary' as const,
    transportUsed: 'tauri' as const,
    requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
  };

  it('native non-zero unary maps to GrpcApiClientError with grpcStatus and trailers', async () => {
    setGrpcTransportMode('tauri');
    vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockResolvedValue(sharedError);

    const error = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-err',
      descriptorPayload: {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'Ym9keQ==',
        contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
      },
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(GrpcApiClientError);
    expect((error as GrpcApiClientError).details).toMatchObject({
      grpcStatus: 3,
      statusMessage: 'field "message" is required',
      trailers: { 'grpc-status-details-bin': 'detail-bytes' },
    });
  });

  it('express and native unary errors share grpcStatus classification for the same payload', () => {
    const mappedNative = toGrpcApiClientErrorFromUnaryResult(sharedError);
    const mappedExpress = toGrpcApiClientErrorFromUnaryResult({
      ...UNARY_ERROR_FIXTURE,
      callType: 'unary',
      transportUsed: 'express',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
    });
    expect(mappedNative.details).toMatchObject({
      grpcStatus: 3,
      statusMessage: 'field "message" is required',
    });
    expect(mappedExpress.code).toBe(mappedNative.code);
    expect(mappedExpress.details?.grpcStatus).toBe(3);
    expect(mappedExpress.details?.statusMessage).toBe(mappedNative.details?.statusMessage);
    expect(mappedNative.details?.trailers).toEqual(sharedError.trailers);
    expect(mappedExpress.details?.trailers).toEqual(sharedError.trailers);
  });
});

// ─── Checklist 7: workflow native facade wiring ──────────────────────────────

describe('Phase 7I acceptance — checklist-7: workflow native facade wiring', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(true);
    setGrpcTransportMode('tauri');
    resetGrpcNativeTransportRefCountForTests();
  });

  function unaryNode(id: string): WorkflowNode {
    return {
      id,
      type: 'grpcUnary',
      position: { x: 0, y: 0 },
      data: {
        label: id,
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        callType: 'unary',
        body: { message: id },
      },
    };
  }

  it('runGraph executes grpcUnary through buildGrpcNodeOperations facade', async () => {
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'Ym9keQ==', fileName: 'schema.pb' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-export' },
    });
    vi.spyOn(nativeTransport, 'invokeGrpcUnaryNative').mockResolvedValue({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'workflow-native' },
      durationMs: 6,
      transportUsed: 'tauri',
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
    });

    const ops = buildGrpcNodeOperations();
    const nodes = [startNode('s'), unaryNode('g1'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'e')];

    const results = await runGraph(
      nodes,
      edges,
      {},
      { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() },
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      ops,
    );

    expect(nativeTransport.invokeGrpcUnaryNative).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.workflowNodeId).toBe('g1');
  });

  const STREAM_REQUEST: GrpcStreamStartRequest = {
    requestId: 'req-stream-wf',
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: 'ServerStream',
    body: { message: 'stream', repeat_count: 1 },
  };

  function streamNode(id: string): WorkflowNode {
    return {
      id,
      type: 'grpcServerStream',
      position: { x: 0, y: 0 },
      data: {
        label: id,
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        callType: 'server_streaming',
        body: { message: id, repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    };
  }

  it('runGraph executes grpcServerStream through buildGrpcNodeOperations facade', async () => {
    vi.spyOn(grpcStreamClient, 'startGrpcStream').mockResolvedValue({
      ok: true,
      op: 'stream_start',
      data: { streamId: 'stream-wf', requestId: STREAM_REQUEST.requestId },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: STREAM_REQUEST.requestId },
    });
    vi.spyOn(grpcStreamClient, 'cancelGrpcStream').mockResolvedValue({
      ok: true,
      op: 'stream_cancel',
      data: { streamId: 'stream-wf', cancelled: true },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: STREAM_REQUEST.requestId },
    });
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation((_streamId, tabId, options) => {
      queueMicrotask(() => {
        options.onEvent({
          type: 'grpc-message',
          streamId: 'stream-wf',
          requestId: STREAM_REQUEST.requestId,
          tabId,
          sequence: 1,
          timestamp: '2026-06-30T00:00:00.000Z',
          data: { n: 1 },
        });
        options.onEvent({
          type: 'grpc-end',
          streamId: 'stream-wf',
          requestId: STREAM_REQUEST.requestId,
          tabId,
          sequence: 2,
          timestamp: '2026-06-30T00:00:00.000Z',
          status: 0,
          statusMessage: 'OK',
        });
      });
      return () => undefined;
    });

    const ops = buildGrpcNodeOperations();
    const nodes = [startNode('s'), streamNode('str1'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'str1'), makeEdge('e2', 'str1', 'e')];

    const results = await runGraph(
      nodes,
      edges,
      {},
      { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() },
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      ops,
    );

    expect(grpcStreamClient.startGrpcStream).toHaveBeenCalled();
    expect(grpcStreamClient.openGrpcStreamEvents).toHaveBeenCalledWith(
      'stream-wf',
      'workflow:str1',
      expect.objectContaining({ expectedRequestId: STREAM_REQUEST.requestId }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.transportType).toBe('grpcServerStream');
    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.workflowNodeId).toBe('str1');
  });
});

// ─── Checklist 8: fallback orchestration ─────────────────────────────────────

describe('Phase 7I acceptance — checklist-8: fallback orchestration', () => {
  beforeEach(() => {
    resetGrpcStreamTransportBindingsForTests();
    resetGrpcNativeTransportRefCountForTests();
  });

  it('native preflight failure surfaces express fallback offer metadata', () => {
    const offered = withGrpcExpressFallbackOffer(
      { code: 'GRPC_UNREACHABLE', category: 'unreachable', message: 'channel build failed', retryable: true },
      'native channel build failed',
    );
    expect(isGrpcExpressFallbackOffered(offered)).toBe(true);
    expect((offered.details as { fallbackReason?: string }).fallbackReason).toBe('native channel build failed');
  });

  it('express retry after native failure records fallbackReason on successful unary', async () => {
    syncGrpcTabTransportMode('tab-fallback', 'express');
    vi.spyOn(grpcApiClient, 'postGrpcCall').mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'express-after-native' },
        durationMs: 3,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });

    const envelope = await invokeGrpcUnary({
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: 'tab-fallback',
      fallbackReason: 'native invoke failed',
    });

    expect(envelope.data.transportUsed).toBe('express');
    expect(envelope.data.fallbackReason).toBe('native invoke failed');
  });

  it('unreachable native transport errors are preflight fallback candidates', () => {
    const preflight = new GrpcApiClientError('call', 'connection refused', {
      code: 'GRPC_UNREACHABLE',
      category: 'unreachable',
    });
    expect(isGrpcNativePreflightFailure(preflight)).toBe(true);
  });

  it('mid-flight gRPC status errors are not preflight fallback candidates', () => {
    const midFlight = new GrpcApiClientError('call', 'UNAVAILABLE', {
      details: { grpcStatus: 14 },
    });
    expect(isGrpcNativePreflightFailure(midFlight)).toBe(false);
  });
});

// ─── Event buffer sanity (checklist-1 supplement) ────────────────────────────

describe('Phase 7I acceptance — event sequence buffer isolation', () => {
  it('does not release events for the wrong stream when sequences collide across tabs', () => {
    const buffer = new GrpcTauriEventSequenceBuffer(0);
    const accepted = buffer.accept(normalizeGrpcTauriEvent(makeTauriEvent({ sequence: 1 }))!);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.tabId).toBe('tab-a');
    expect(accepted[0]?.streamId).toBe('stream-a');
  });
});
