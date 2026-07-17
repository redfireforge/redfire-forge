import {
  GRPC_ERROR_CODES,
  createGrpcErrorEnvelope,
  type GrpcRouteEnvelope,
  type GrpcStreamStartRequest,
} from '../../src/shared/grpc/contracts.js';
import {
  createGrpcValidationErrorEnvelope,
  validateGrpcStreamStartRequest,
  validateGrpcStreamTabId,
} from '../../src/shared/grpc/requestValidation.js';
import { validateResolvedGrpcTargetAddress } from '../../src/shared/grpc/targetValidation.js';
import {
  resolveGrpcExecuteAuthMetadata,
  resolveGrpcExecuteAuthMetadataSync,
} from './grpcAuthResolve.js';
import { findGrpcMethod } from './descriptorUtils.js';
import { encodeProtoMessage } from './dynamicProtoCodec.js';
import type { GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';
import { getGrpcDescriptor } from './descriptorStore.js';
import { getGrpcStreamEntry, findActiveGrpcStreamByRequestId, type GrpcStreamTransportHandle } from './streamRegistry.js';
import { assertStreamTabOwnership } from './streamOwnership.js';

export async function appendAuthMetadata(
  metadata: Record<string, string>,
  auth: GrpcStreamStartRequest['auth'],
  oauth2TokenService: GrpcOAuth2TokenService,
): Promise<Record<string, string>> {
  if (auth?.type === 'oauth2') {
    return resolveGrpcExecuteAuthMetadata(metadata, auth, oauth2TokenService);
  }
  return resolveGrpcExecuteAuthMetadataSync(metadata, auth);
}

export function validateGrpcStreamStartPreflight(
  request: GrpcStreamStartRequest,
  tabId: string | undefined,
  started: number,
): GrpcRouteEnvelope<{ streamId: string; requestId: string; tabId: string }> | null {
  const tabIssues = validateGrpcStreamTabId(tabId);
  if (tabIssues.length > 0) {
    return createGrpcValidationErrorEnvelope('stream_start', tabIssues, {
      requestId: request.requestId,
      durationMs: Date.now() - started,
    })!;
  }

  const issues = validateGrpcStreamStartRequest(request);
  if (issues.length > 0) {
    return createGrpcValidationErrorEnvelope('stream_start', issues, {
      requestId: request.requestId,
      durationMs: Date.now() - started,
    })!;
  }

  validateResolvedGrpcTargetAddress(request.target.address);

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

  if (methodInfo.callType !== request.callType) {
    return createGrpcErrorEnvelope(
      'stream_start',
      {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message: `callType ${request.callType} does not match descriptor (${methodInfo.callType})`,
      },
      { requestId: request.requestId, durationMs: Date.now() - started },
    );
  }

  try {
    encodeProtoMessage(
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

  return null;
}

type GrpcStreamOp = 'stream_events' | 'stream_send' | 'stream_end' | 'stream_cancel';

export function ownershipError(
  op: GrpcStreamOp,
  reason: 'not_found' | 'tab_mismatch',
  streamId: string,
  requestId?: string,
): GrpcRouteEnvelope<never> {
  if (reason === 'not_found') {
    return createGrpcErrorEnvelope(op, {
      code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
      message: `No active stream registered for streamId ${streamId}`,
    }, { requestId });
  }
  return createGrpcErrorEnvelope(op, {
    code: GRPC_ERROR_CODES.INVALID_REQUEST,
    category: 'conflict',
    message: `tabId does not match the registered stream ${streamId}`,
  }, { requestId });
}

export function hasNonEmptyInitialBody(body: Record<string, unknown>): boolean {
  return Object.values(body).some(
    (value) => value !== '' && value !== null && value !== undefined,
  );
}

export function isActiveStream(streamId: string): boolean {
  return getGrpcStreamEntry(streamId)?.status === 'active';
}

export function requireTransport(
  current: GrpcStreamTransportHandle | null,
): GrpcStreamTransportHandle {
  if (!current) {
    throw new Error('Stream transport is not ready');
  }
  return current;
}

export function assertOwnershipOrError(
  op: GrpcStreamOp,
  streamId: string,
  tabId: string,
) {
  const ownership = assertStreamTabOwnership(getGrpcStreamEntry(streamId), tabId);
  if (!ownership.ok) {
    return { ok: false as const, envelope: ownershipError(op, ownership.reason, streamId) };
  }
  return { ok: true as const, entry: ownership.entry };
}