/**
 * Native Tauri transport for gRPC streaming — Phase 7D.
 */
import type {
  GrpcRouteEnvelope,
  GrpcStreamCancelResult,
  GrpcStreamEndResult,
  GrpcStreamSendRequest,
  GrpcStreamStartRequest,
  GrpcStreamStartResponse,
  GrpcSuccessEnvelope,
} from './contracts';
import {
  GRPC_TAURI_SCHEMA_VERSION,
  type GrpcTauriDescriptorPayload,
  type GrpcTauriEnvelope,
  type GrpcTauriStreamCancelRequest,
  type GrpcTauriStreamControlResult,
  type GrpcTauriStreamEndRequest,
  type GrpcTauriStreamSendRequest,
  type GrpcTauriStreamStartRequest,
  type GrpcTauriStreamStartResult,
} from './grpcTauriContracts';
import { prepareGrpcTauriDescriptorPayload } from './grpcTauriDescriptorBridge';
import { listenGrpcTauriStreamEvents } from './grpcTauriEventAdapter';
import { toGrpcApiClientErrorFromDescriptorPrepare, toGrpcApiClientErrorFromNative } from './grpcTauriErrorMapping';
import {
  setGrpcStreamEventsOpener,
  setGrpcStreamTransport,
  type OpenGrpcStreamEventsOptions,
  expressGrpcStreamTransport,
  openGrpcStreamEventsViaSse,
} from './grpcStreamClient';
import {
  extractTabIdFromGrpcStreamPath,
  shouldUseNativeGrpcTransportForTab,
} from './grpcTransportTabRouting';

export type GrpcNativeStreamOp = 'stream_start' | 'stream_send' | 'stream_end' | 'stream_cancel';

export class GrpcNativeTauriStreamTransportError extends Error {
  readonly code: string;
  readonly op: GrpcNativeStreamOp;
  readonly retryable: boolean;

  constructor(
    op: GrpcNativeStreamOp,
    message: string,
    options?: { code?: string; retryable?: boolean },
  ) {
    super(message);
    this.name = 'GrpcNativeTauriStreamTransportError';
    this.op = op;
    this.code = options?.code ?? 'GRPC_TAURI_INVOKE_ERROR';
    this.retryable = options?.retryable ?? false;
  }
}

function throwIfEnvelopeNotOk<T>(
  op: GrpcNativeStreamOp,
  envelope: GrpcTauriEnvelope<T>,
): asserts envelope is Extract<GrpcTauriEnvelope<T>, { ok: true }> {
  if (!envelope.ok) {
    throw new GrpcNativeTauriStreamTransportError(op, envelope.error.message, {
      code: envelope.error.code,
      retryable: envelope.error.retryable ?? false,
    });
  }
}

async function resolveDescriptorPayload(
  request: GrpcStreamStartRequest,
): Promise<GrpcTauriDescriptorPayload> {
  return prepareGrpcTauriDescriptorPayload({
    descriptorKey: request.descriptorKey.trim(),
    requestId: request.requestId,
  });
}

export function toGrpcTauriStreamStartRequest(
  request: GrpcStreamStartRequest,
  tabId: string,
  descriptor: GrpcTauriDescriptorPayload,
): GrpcTauriStreamStartRequest {
  return {
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
    requestId: request.requestId,
    tabId,
    callType: request.callType,
    target: request.target,
    service: request.service,
    method: request.method,
    body: request.body,
    metadata: request.metadata,
    auth: request.auth,
    timeoutMs: request.timeoutMs,
    descriptor,
  };
}

export async function invokeGrpcStreamStartNative(
  request: GrpcTauriStreamStartRequest,
): Promise<GrpcTauriStreamStartResult> {
  const { invoke } = await import('@tauri-apps/api/core');
  let envelope: GrpcTauriEnvelope<GrpcTauriStreamStartResult>;
  try {
    envelope = await invoke<GrpcTauriEnvelope<GrpcTauriStreamStartResult>>('grpc_stream_start', { request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriStreamTransportError('stream_start', message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }
  throwIfEnvelopeNotOk('stream_start', envelope);
  return envelope.data;
}

export async function invokeGrpcStreamSendNative(
  request: GrpcTauriStreamSendRequest,
): Promise<{ streamId: string; tabId: string; sequence: number }> {
  const { invoke } = await import('@tauri-apps/api/core');
  let envelope: GrpcTauriEnvelope<{ streamId: string; tabId: string; sequence: number }>;
  try {
    envelope = await invoke('grpc_stream_send', { request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriStreamTransportError('stream_send', message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }
  throwIfEnvelopeNotOk('stream_send', envelope);
  return envelope.data;
}

export async function invokeGrpcStreamEndNative(
  request: GrpcTauriStreamEndRequest,
): Promise<GrpcTauriStreamControlResult> {
  const { invoke } = await import('@tauri-apps/api/core');
  let envelope: GrpcTauriEnvelope<GrpcTauriStreamControlResult>;
  try {
    envelope = await invoke('grpc_stream_end', { request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriStreamTransportError('stream_end', message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }
  throwIfEnvelopeNotOk('stream_end', envelope);
  return envelope.data;
}

export async function invokeGrpcStreamCancelNative(
  request: GrpcTauriStreamCancelRequest,
): Promise<GrpcTauriStreamControlResult> {
  const { invoke } = await import('@tauri-apps/api/core');
  let envelope: GrpcTauriEnvelope<GrpcTauriStreamControlResult>;
  try {
    envelope = await invoke('grpc_stream_cancel', { request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriStreamTransportError('stream_cancel', message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }
  throwIfEnvelopeNotOk('stream_cancel', envelope);
  return envelope.data;
}

function mapStreamStartResponse(result: GrpcTauriStreamStartResult): GrpcStreamStartResponse {
  return {
    streamId: result.streamId,
    requestId: result.requestId,
    tabId: result.tabId,
  };
}

function mapStreamEndResult(result: GrpcTauriStreamControlResult, requestId: string): GrpcStreamEndResult {
  return {
    streamId: result.streamId,
    requestId,
    tabId: result.tabId,
    ended: result.acknowledged,
    alreadyEnded: result.alreadyTerminal,
  };
}

function mapStreamCancelResult(result: GrpcTauriStreamControlResult, requestId: string): GrpcStreamCancelResult {
  return {
    streamId: result.streamId,
    requestId,
    tabId: result.tabId,
    cancelled: result.op === 'cancel' && result.acknowledged,
    alreadyEnded: result.alreadyTerminal,
  };
}

const streamRequestIdByStream = new Map<string, string>();

export async function nativeGrpcStreamTransport(
  path: string,
  init: RequestInit,
): Promise<GrpcRouteEnvelope<unknown>> {
  const body = init.body ? JSON.parse(String(init.body)) : undefined;

  if (path.includes('/stream/start')) {
    const tabId = new URL(path, 'http://local').searchParams.get('tabId') ?? '';
    const request = body as GrpcStreamStartRequest;
    let payload: GrpcTauriDescriptorPayload;
    try {
      payload = await resolveDescriptorPayload(request);
    } catch (error) {
      throw toGrpcApiClientErrorFromDescriptorPrepare('stream_start', error);
    }
    const native = await invokeGrpcStreamStartNative(
      toGrpcTauriStreamStartRequest(request, tabId, payload),
    );
    streamRequestIdByStream.set(native.streamId, native.requestId);
    const data = mapStreamStartResponse(native);
    return {
      ok: true,
      op: 'stream_start',
      data,
      meta: { timestamp: new Date().toISOString(), requestId: native.requestId },
    } as GrpcSuccessEnvelope<GrpcStreamStartResponse>;
  }

  const streamMatch = path.match(/\/api\/grpc\/stream\/([^/]+)(?:\/(send|end)|\?|$)/);
  const streamId = streamMatch?.[1] ? decodeURIComponent(streamMatch[1]) : '';
  const tabId = new URL(path, 'http://local').searchParams.get('tabId') ?? '';
  const requestId = streamRequestIdByStream.get(streamId) ?? '';

  if (path.includes('/send')) {
    const sendBody = body as GrpcStreamSendRequest;
    const data = await invokeGrpcStreamSendNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId,
      tabId,
      body: sendBody.body,
    });
    return {
      ok: true,
      op: 'stream_send',
      data,
      meta: { timestamp: new Date().toISOString(), requestId },
    };
  }

  if (path.includes('/end')) {
    const native = await invokeGrpcStreamEndNative({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      streamId,
      tabId,
    });
    streamRequestIdByStream.delete(streamId);
    return {
      ok: true,
      op: 'stream_end',
      data: mapStreamEndResult(native, requestId),
      meta: { timestamp: new Date().toISOString(), requestId },
    };
  }

  const native = await invokeGrpcStreamCancelNative({
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
    streamId,
    tabId,
  });
  streamRequestIdByStream.delete(streamId);
  return {
    ok: true,
    op: 'stream_cancel',
    data: mapStreamCancelResult(native, requestId),
    meta: { timestamp: new Date().toISOString(), requestId },
  };
}

export function openNativeGrpcStreamEvents(
  streamId: string,
  tabId: string,
  options: OpenGrpcStreamEventsOptions,
): () => void {
  let disposed = false;
  let adapterDispose: (() => void) | undefined;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    adapterDispose?.();
    options.onStateChange?.('closed');
  };

  if (options.signal) {
    if (options.signal.aborted) {
      dispose();
      return dispose;
    }
    options.signal.addEventListener('abort', () => dispose(), { once: true });
  }

  options.onStateChange?.('connecting');

  void listenGrpcTauriStreamEvents({
    tabId,
    streamId,
    requestId: options.expectedRequestId,
    resolveLastSequence: options.resolveLastSequence ?? (() => options.lastSequence ?? 0),
    onEvent: (event) => {
      if (disposed) return;
      if (event.type === 'grpc-heartbeat') return;
      options.onEvent(event);
      if (event.type === 'grpc-end' || event.type === 'grpc-error') {
        streamRequestIdByStream.delete(streamId);
        options.onStateChange?.('closed');
      } else {
        options.onStateChange?.('connected');
      }
    },
    onError: options.onError,
  }).then((handle) => {
    if (disposed) {
      handle.dispose();
      return;
    }
    adapterDispose = handle.dispose;
    options.onStateChange?.('connected');
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    options.onError?.(message);
    dispose();
  });

  return dispose;
}

export function installGrpcNativeStreamTransport(): void {
  setGrpcStreamTransport(async (path, init) => {
    const tabId = extractTabIdFromGrpcStreamPath(path);
    if (tabId && !shouldUseNativeGrpcTransportForTab(tabId)) {
      return expressGrpcStreamTransport(path, init);
    }
    try {
      return await nativeGrpcStreamTransport(path, init);
    } catch (error) {
      if (error instanceof GrpcNativeTauriStreamTransportError) {
        throw toGrpcApiClientErrorFromNative(error.op, error);
      }
      throw error;
    }
  });
  setGrpcStreamEventsOpener((streamId, tabId, options) => {
    if (!shouldUseNativeGrpcTransportForTab(tabId)) {
      return openGrpcStreamEventsViaSse(streamId, tabId, options);
    }
    return openNativeGrpcStreamEvents(streamId, tabId, options);
  });
}

export function clearGrpcNativeStreamTransport(): void {
  setGrpcStreamTransport(null);
  setGrpcStreamEventsOpener(null);
  streamRequestIdByStream.clear();
}
