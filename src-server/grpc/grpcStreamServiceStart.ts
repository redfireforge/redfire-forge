import { randomUUID } from 'node:crypto';
import {
  GRPC_DEFAULT_CALL_TIMEOUT_MS,
  GRPC_ERROR_CODES,
  createGrpcErrorEnvelope,
  createGrpcSuccessEnvelope,
  normalizeGrpcMetadata,
  type GrpcRouteEnvelope,
  type GrpcStreamStartRequest,
  type GrpcStreamStartResponse,
} from '../../src/shared/grpc/contracts.js';
import {
  createGrpcValidationErrorEnvelope,
} from '../../src/shared/grpc/requestValidation.js';
import { validateResolvedGrpcTargetAddress } from '../../src/shared/grpc/targetValidation.js';
import { classifyGrpcTransportFailure, formatGrpcTransportStatusMessage } from '../../src/shared/grpc/grpcTransportErrors.js';
import { mapGrpcAuthResolveErrorForEnvelope, resolveGrpcExecuteAuthMetadataSync } from './grpcAuthResolve.js';
import { findGrpcMethod } from './descriptorUtils.js';
import { getGrpcDescriptor } from './descriptorStore.js';
import { decodeProtoMessage, encodeProtoMessage } from './dynamicProtoCodec.js';
import { createGrpcTransportErrorEnvelope } from './grpcTransportEnvelope.js';
import {
  cancelActiveGrpcStreamsForTab,
  cancelGrpcStreamEntry,
  emitGrpcStreamEvent,
  finalizeGrpcStreamEntry,
  findActiveGrpcStreamByRequestId,
  markGrpcStreamTerminal,
  scheduleFinalizeAfterTerminal,
  tryRegisterGrpcStream,
  type GrpcStreamTransportHandle,
} from './streamRegistry.js';
import {
  hasNonEmptyInitialBody,
  isActiveStream,
  requireTransport,
  validateGrpcStreamStartPreflight,
} from './grpcStreamServiceHelpers.js';
import type { GrpcStreamingClientFactory } from './grpcStreamingClient.js';

export function startGrpcStreamSync(
  request: GrpcStreamStartRequest,
  tabId: string | undefined,
  streamingClient: GrpcStreamingClientFactory,
  resolvedMetadata?: Record<string, string>,
): GrpcRouteEnvelope<GrpcStreamStartResponse> {
  const started = Date.now();
  const preflightError = validateGrpcStreamStartPreflight(request, tabId, started);
  if (preflightError) {
    return preflightError;
  }

  const targetCheck = validateResolvedGrpcTargetAddress(request.target.address);
  const dialAddress = targetCheck.valid ? targetCheck.normalized : request.target.address.trim();

  const descriptor = getGrpcDescriptor(request.descriptorKey);
  if (!descriptor) {
    return createGrpcErrorEnvelope(
      'stream_start',
      {
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
        message: `Descriptor not found for key: ${request.descriptorKey}`,
      },
      { requestId: request.requestId, durationMs: Date.now() - started },
    );
  }

  const methodInfo = findGrpcMethod(descriptor, request.service, request.method);
  if (!methodInfo) {
    return createGrpcErrorEnvelope(
      'stream_start',
      {
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
        message: `Method ${request.service}/${request.method} not found in descriptor`,
      },
      { requestId: request.requestId, durationMs: Date.now() - started },
    );
  }

  let requestBuffer: Buffer;
  try {
    requestBuffer = encodeProtoMessage(
      descriptor,
      methodInfo.requestTypeName,
      request.body,
    );
  } catch (encodeError) {
    const message = encodeError instanceof Error ? encodeError.message : String(encodeError);
    const schemaFailure = /Invalid descriptor schema|not found in descriptor/i.test(message);
    return createGrpcErrorEnvelope(
      'stream_start',
      {
        code: schemaFailure ? GRPC_ERROR_CODES.INVALID_DESCRIPTOR : GRPC_ERROR_CODES.INVALID_REQUEST,
        message,
      },
      { requestId: request.requestId, durationMs: Date.now() - started },
    );
  }

  cancelActiveGrpcStreamsForTab(tabId!);

  const existingRequest = findActiveGrpcStreamByRequestId(request.requestId);
  if (existingRequest) {
    return createGrpcErrorEnvelope(
      'stream_start',
      {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        category: 'conflict',
        message: `requestId ${request.requestId} is already in use by an active stream`,
      },
      { requestId: request.requestId, durationMs: Date.now() - started },
    );
  }

  const streamId = randomUUID();
  const timeoutMs = request.timeoutMs ?? GRPC_DEFAULT_CALL_TIMEOUT_MS;

  const decodeResponse = (buffer: Buffer) => decodeProtoMessage(
    descriptor,
    methodInfo.responseTypeName,
    buffer,
  );

  const transportBox: { current: GrpcStreamTransportHandle | null } = { current: null };
  const transportProxy: GrpcStreamTransportHandle = {
    callType: request.callType,
    write: (buffer) => requireTransport(transportBox.current).write(buffer),
    endWrites: () => requireTransport(transportBox.current).endWrites(),
    cancel: () => requireTransport(transportBox.current).cancel(),
  };

  const registration = tryRegisterGrpcStream({
    streamId,
    tabId: tabId!,
    requestId: request.requestId,
    callType: request.callType,
    descriptorKey: request.descriptorKey,
    requestTypeName: methodInfo.requestTypeName,
    transport: transportProxy,
  });

  if (!registration.ok) {
    return createGrpcErrorEnvelope(
      'stream_start',
      {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        category: 'conflict',
        message: `requestId ${request.requestId} is already in use by an active stream`,
      },
      { requestId: request.requestId, durationMs: Date.now() - started },
    );
  }

  let metadata: Record<string, string>;
  try {
    metadata = resolvedMetadata ?? resolveGrpcExecuteAuthMetadataSync(
      normalizeGrpcMetadata(request.metadata),
      request.auth,
    );
  } catch (error) {
    finalizeGrpcStreamEntry(streamId);
    const mapped = mapGrpcAuthResolveErrorForEnvelope(error);
    return createGrpcValidationErrorEnvelope('stream_start', [{
      field: mapped.field,
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: mapped.message,
    }], {
      requestId: request.requestId,
      durationMs: Date.now() - started,
    })!;
  }

  try {
    transportBox.current = streamingClient.startStream(
      {
        address: dialAddress,
        service: request.service,
        method: request.method,
        callType: request.callType,
        requestBuffer,
        metadata,
        timeoutMs,
        tlsMode: request.target.tlsMode,
        tlsConfig: request.target.tlsConfig,
        decodeResponse,
      },
      {
        onInboundMessage: (body) => {
          if (!isActiveStream(streamId)) return;
          emitGrpcStreamEvent(streamId, {
            type: 'grpc-message',
            direction: 'inbound',
            data: body,
          });
        },
        onTerminal: (result) => {
          if (!isActiveStream(streamId)) return;
          markGrpcStreamTerminal(streamId, 'ended');
          const statusMessage = result.status === 0
            ? result.statusMessage
            : formatGrpcTransportStatusMessage(result.status, result.statusMessage);
          emitGrpcStreamEvent(streamId, {
            type: 'grpc-end',
            status: result.status,
            statusMessage,
            headers: result.headers,
            trailers: result.trailers,
            data: result.body,
          });
          scheduleFinalizeAfterTerminal(streamId);
        },
        onError: (message, status) => {
          if (!isActiveStream(streamId)) return;
          markGrpcStreamTerminal(streamId, 'error');
          const classified = classifyGrpcTransportFailure(message, { grpcStatus: status });
          emitGrpcStreamEvent(streamId, {
            type: 'grpc-error',
            status,
            statusMessage: classified.message,
          });
          scheduleFinalizeAfterTerminal(streamId);
        },
      },
    );
  } catch (error) {
    finalizeGrpcStreamEntry(streamId);
    return createGrpcTransportErrorEnvelope(
      'stream_start',
      error,
      { requestId: request.requestId, durationMs: Date.now() - started },
    );
  }

  // Bidi may open with an immediate first message; client streaming uses Send message / Send all.
  if (
    request.callType === 'bidi_streaming'
    && hasNonEmptyInitialBody(request.body)
  ) {
    try {
      transportProxy.write(requestBuffer);
      emitGrpcStreamEvent(streamId, {
        type: 'grpc-message',
        direction: 'outbound',
        data: request.body,
      });
    } catch (writeError) {
      cancelGrpcStreamEntry(streamId, tabId!, 'cancelled');
      emitGrpcStreamEvent(streamId, {
        type: 'grpc-end',
        status: 1,
        statusMessage: 'Cancelled',
      });
      scheduleFinalizeAfterTerminal(streamId);
      return createGrpcTransportErrorEnvelope(
        'stream_start',
        writeError,
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }
  }

  return createGrpcSuccessEnvelope(
    'stream_start',
    { streamId, requestId: request.requestId, tabId: tabId! },
    { requestId: request.requestId, durationMs: Date.now() - started },
  );
}
