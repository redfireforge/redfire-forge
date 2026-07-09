import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import {
  GRPC_DEFAULT_CALL_TIMEOUT_MS,
  GRPC_ERROR_CODES,
  createGrpcErrorEnvelope,
  createGrpcSuccessEnvelope,
  normalizeGrpcMetadata,
  type GrpcRouteEnvelope,
  type GrpcStreamCancelResult,
  type GrpcStreamEndResult,
  type GrpcStreamSendRequest,
  type GrpcStreamStartRequest,
  type GrpcStreamStartResponse,
} from '../../src/shared/grpc/contracts.js';
import {
  createGrpcValidationErrorEnvelope,
  validateGrpcStreamSendRequest,
  validateGrpcStreamTabId,
} from '../../src/shared/grpc/requestValidation.js';
import {
  mapGrpcAuthResolveErrorForEnvelope,
  resolveGrpcExecuteAuthMetadataSync,
} from './grpcAuthResolve.js';
import {
  grpcOAuth2TokenService,
  type GrpcOAuth2TokenService,
} from './grpcOAuth2TokenService.js';
import { validateResolvedGrpcTargetAddress } from '../../src/shared/grpc/targetValidation.js';
import { classifyGrpcTransportFailure, formatGrpcTransportStatusMessage } from '../../src/shared/grpc/grpcTransportErrors.js';
import { createGrpcTransportErrorEnvelope } from './grpcTransportEnvelope.js';
import { findGrpcMethod } from './descriptorUtils.js';
import { getGrpcDescriptor } from './descriptorStore.js';
import { decodeProtoMessage, encodeProtoMessage } from './dynamicProtoCodec.js';
import { initGrpcStreamSseResponse, closeGrpcStreamSseResponse } from './grpcStreamSse.js';
import {
  grpcJsStreamingClient,
  type GrpcStreamingClientFactory,
} from './grpcStreamingClient.js';
import { assertStreamTabOwnership } from './streamOwnership.js';
import {
  attachGrpcStreamSseClient,
  cancelActiveGrpcStreamsForTab,
  cancelGrpcStreamEntry,
  emitGrpcStreamEvent,
  getGrpcStreamEntry,
  markGrpcStreamTerminal,
  findActiveGrpcStreamByRequestId,
  replayBufferedGrpcStreamEvents,
  scheduleFinalizeAfterTerminal,
  finalizeGrpcStreamEntry,
  tryRegisterGrpcStream,
  type GrpcStreamTransportHandle,
} from './streamRegistry.js';
import {
  appendAuthMetadata,
  hasNonEmptyInitialBody,
  isActiveStream,
  ownershipError,
  requireTransport,
  validateGrpcStreamStartPreflight,
} from './grpcStreamServiceHelpers.js';

export class GrpcStreamService {
  constructor(
    private readonly streamingClient: GrpcStreamingClientFactory = grpcJsStreamingClient,
    private readonly oauth2TokenService: GrpcOAuth2TokenService = grpcOAuth2TokenService,
  ) {}

  startStream(
    request: GrpcStreamStartRequest,
    tabId: string | undefined,
  ): GrpcRouteEnvelope<GrpcStreamStartResponse> | Promise<GrpcRouteEnvelope<GrpcStreamStartResponse>> {
    if (request.auth?.type === 'oauth2') {
      return this.startOAuthStream(request, tabId);
    }
    return this.startStreamSync(request, tabId);
  }

  private async startOAuthStream(
    request: GrpcStreamStartRequest,
    tabId: string | undefined,
  ): Promise<GrpcRouteEnvelope<GrpcStreamStartResponse>> {
    const started = Date.now();
    const preflightError = validateGrpcStreamStartPreflight(request, tabId, started);
    if (preflightError) {
      return preflightError;
    }

    try {
      const metadata = await appendAuthMetadata(
        normalizeGrpcMetadata(request.metadata),
        request.auth,
        this.oauth2TokenService,
      );
      return this.startStreamSync(request, tabId, metadata);
    } catch (error) {
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
  }

  private startStreamSync(
    request: GrpcStreamStartRequest,
    tabId: string | undefined,
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
      transportBox.current = this.streamingClient.startStream(
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

  attachStreamEvents(
    streamId: string,
    tabId: string | undefined,
    res: Response,
    lastSequence?: number,
  ): GrpcRouteEnvelope<never> | null {
    const tabIssues = validateGrpcStreamTabId(tabId);
    if (tabIssues.length > 0) {
      return createGrpcValidationErrorEnvelope('stream_events', tabIssues)!;
    }

    const ownership = assertStreamTabOwnership(getGrpcStreamEntry(streamId), tabId!);
    if (!ownership.ok) {
      return ownershipError('stream_events', ownership.reason, streamId);
    }

    initGrpcStreamSseResponse(res);
    replayBufferedGrpcStreamEvents(streamId, res, lastSequence ?? 0);

    if (ownership.entry.status !== 'active') {
      res.flush?.();
      const closeTimer = setTimeout(() => {
        closeGrpcStreamSseResponse(res);
        finalizeGrpcStreamEntry(streamId);
      }, 0);
      closeTimer.unref?.();
      return null;
    }

    const attached = attachGrpcStreamSseClient(streamId, res, () => undefined);
    if (attached === 'not_found') {
      closeGrpcStreamSseResponse(res);
      return ownershipError('stream_events', 'not_found', streamId);
    }
    return null;
  }

  sendStreamMessage(
    streamId: string,
    tabId: string | undefined,
    request: GrpcStreamSendRequest,
  ): GrpcRouteEnvelope<{ streamId: string; tabId: string; sequence: number }> {
    const tabIssues = validateGrpcStreamTabId(tabId);
    if (tabIssues.length > 0) {
      return createGrpcValidationErrorEnvelope('stream_send', tabIssues)!;
    }

    const sendIssues = validateGrpcStreamSendRequest(request.body);
    if (sendIssues.length > 0) {
      return createGrpcValidationErrorEnvelope('stream_send', sendIssues)!;
    }

    const ownership = assertStreamTabOwnership(getGrpcStreamEntry(streamId), tabId!);
    if (!ownership.ok) {
      return ownershipError('stream_send', ownership.reason, streamId);
    }

    const { entry } = ownership;
    if (entry.status !== 'active') {
      return createGrpcErrorEnvelope('stream_send', {
        code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
        message: `No active stream registered for streamId ${streamId}`,
      }, { requestId: entry.requestId });
    }

    if (entry.clientWritesEnded) {
      return createGrpcErrorEnvelope('stream_send', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        category: 'conflict',
        message: 'send is not valid after client stream EOF',
      }, { requestId: entry.requestId });
    }

    if (entry.callType === 'server_streaming') {
      return createGrpcErrorEnvelope('stream_send', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        category: 'conflict',
        message: 'send is not valid for server-streaming RPCs',
      }, { requestId: entry.requestId });
    }

    const descriptor = getGrpcDescriptor(entry.descriptorKey);
    if (!descriptor) {
      return createGrpcErrorEnvelope('stream_send', {
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
        message: `Descriptor not found for key: ${entry.descriptorKey}`,
      }, { requestId: entry.requestId });
    }

    let requestBuffer: Buffer;
    try {
      requestBuffer = encodeProtoMessage(
        descriptor,
        entry.requestTypeName,
        request.body,
      );
    } catch (encodeError) {
      const message = encodeError instanceof Error ? encodeError.message : String(encodeError);
      return createGrpcErrorEnvelope('stream_send', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message,
      }, { requestId: entry.requestId });
    }

    try {
      entry.transport.write(requestBuffer);
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      return createGrpcErrorEnvelope('stream_send', {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        message,
      }, { requestId: entry.requestId });
    }

    const event = emitGrpcStreamEvent(streamId, {
      type: 'grpc-message',
      direction: 'outbound',
      data: request.body,
    });

    return createGrpcSuccessEnvelope(
      'stream_send',
      { streamId, tabId: tabId!, sequence: event?.sequence ?? entry.sequence },
      { requestId: entry.requestId },
    );
  }

  endStream(
    streamId: string,
    tabId: string | undefined,
  ): GrpcRouteEnvelope<GrpcStreamEndResult> {
    const tabIssues = validateGrpcStreamTabId(tabId);
    if (tabIssues.length > 0) {
      return createGrpcValidationErrorEnvelope('stream_end', tabIssues)!;
    }

    const ownership = assertStreamTabOwnership(getGrpcStreamEntry(streamId), tabId!);
    if (!ownership.ok) {
      if (ownership.reason === 'not_found') {
        return createGrpcSuccessEnvelope(
          'stream_end',
          {
            streamId,
            requestId: '',
            tabId: tabId!,
            ended: false,
            alreadyEnded: true,
          },
        );
      }
      return ownershipError('stream_end', ownership.reason, streamId);
    }

    const { entry } = ownership;
    if (entry.status !== 'active') {
      return createGrpcSuccessEnvelope(
        'stream_end',
        {
          streamId,
          requestId: entry.requestId,
          tabId: tabId!,
          ended: false,
          alreadyEnded: true,
        },
        { requestId: entry.requestId },
      );
    }

    if (entry.clientWritesEnded) {
      return createGrpcSuccessEnvelope(
        'stream_end',
        {
          streamId,
          requestId: entry.requestId,
          tabId: tabId!,
          ended: true,
          alreadyEnded: true,
        },
        { requestId: entry.requestId },
      );
    }

    if (entry.callType === 'server_streaming') {
      return createGrpcErrorEnvelope('stream_end', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        category: 'conflict',
        message: 'end is not valid for server-streaming RPCs',
      }, { requestId: entry.requestId });
    }

    try {
      entry.transport.endWrites();
      entry.clientWritesEnded = true;
    } catch (endError) {
      const message = endError instanceof Error ? endError.message : String(endError);
      return createGrpcErrorEnvelope('stream_end', {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        message,
      }, { requestId: entry.requestId });
    }

    return createGrpcSuccessEnvelope(
      'stream_end',
      {
        streamId,
        requestId: entry.requestId,
        tabId: tabId!,
        ended: true,
      },
      { requestId: entry.requestId },
    );
  }

  cancelStream(
    streamId: string,
    tabId: string | undefined,
  ): GrpcRouteEnvelope<GrpcStreamCancelResult> {
    const tabIssues = validateGrpcStreamTabId(tabId);
    if (tabIssues.length > 0) {
      return createGrpcValidationErrorEnvelope('stream_cancel', tabIssues)!;
    }

    const entry = getGrpcStreamEntry(streamId);
    if (!entry) {
      return createGrpcSuccessEnvelope(
        'stream_cancel',
        {
          streamId,
          requestId: '',
          tabId: tabId!,
          cancelled: false,
          alreadyEnded: true,
        },
      );
    }

    const ownership = assertStreamTabOwnership(entry, tabId!);
    if (!ownership.ok) {
      return ownershipError('stream_cancel', ownership.reason, streamId, entry?.requestId);
    }

    if (entry!.status !== 'active') {
      return createGrpcSuccessEnvelope(
        'stream_cancel',
        {
          streamId,
          requestId: entry!.requestId,
          tabId: tabId!,
          cancelled: false,
          alreadyEnded: true,
        },
        { requestId: entry!.requestId },
      );
    }

    const result = cancelGrpcStreamEntry(streamId, tabId!, 'cancelled');
    if (result === 'already_terminal') {
      return createGrpcSuccessEnvelope(
        'stream_cancel',
        {
          streamId,
          requestId: entry!.requestId,
          tabId: tabId!,
          cancelled: false,
          alreadyEnded: true,
        },
        { requestId: entry!.requestId },
      );
    }

    emitGrpcStreamEvent(streamId, {
      type: 'grpc-end',
      status: 1,
      statusMessage: 'Cancelled',
    });
    scheduleFinalizeAfterTerminal(streamId);

    return createGrpcSuccessEnvelope(
      'stream_cancel',
      {
        streamId,
        requestId: entry!.requestId,
        tabId: tabId!,
        cancelled: true,
      },
      { requestId: entry!.requestId },
    );
  }
}

export const grpcStreamService = new GrpcStreamService();
