import * as grpc from '@grpc/grpc-js';
import {
  GRPC_DEFAULT_CALL_TIMEOUT_MS,
  GRPC_DEFAULT_PROBE_TIMEOUT_MS,
  GRPC_ERROR_CODES,
  createGrpcErrorEnvelope,
  createGrpcSuccessEnvelope,
  defaultGrpcTlsMode,
  normalizeGrpcMetadata,
  type GrpcCallRequest,
  type GrpcCallResult,
  type GrpcCancelCallResult,
  type GrpcDescribeRequest,
  type GrpcDescriptor,
  type GrpcExportProtosetRequest,
  type GrpcExportProtosetResult,
  type GrpcDescriptorLookupRequest,
  type GrpcReflectRequest,
  type GrpcRouteEnvelope,
  type GrpcErrorCode,
  type GrpcStatusRequest,
  type GrpcStatusResult,
} from '../../src/shared/grpc/contracts.js';
import {
  createGrpcValidationErrorEnvelope,
  validateGrpcDescribeRequest,
  validateGrpcDescriptorLookupRequest,
  validateGrpcExportProtosetRequest,
  validateGrpcReflectRequest,
  validateGrpcStatusRequest,
  validatePhase1UnaryCallRequest,
} from '../../src/shared/grpc/requestValidation.js';
import { createSanitizedGrpcErrorEnvelope } from '../../src/shared/grpc/grpcRedaction.js';
import { createGrpcTransportErrorEnvelope } from './grpcTransportEnvelope.js';
import {
  mapGrpcAuthResolveErrorForEnvelope,
  resolveGrpcExecuteAuthMetadata,
  resolveGrpcExecuteAuthMetadataSync,
} from './grpcAuthResolve.js';
import {
  grpcOAuth2TokenService,
  type GrpcOAuth2TokenService,
} from './grpcOAuth2TokenService.js';
import { validateResolvedGrpcTargetAddress } from '../../src/shared/grpc/targetValidation.js';
import {
  cancelGrpcCall,
  getGrpcCallEntry,
  markGrpcCallCancelled,
  markGrpcCallCompleted,
  tryRegisterGrpcCall,
} from './callRegistry.js';
import { findGrpcMethod } from './descriptorUtils.js';
import { getGrpcDescriptor } from './descriptorStore.js';
import { getDescriptorRootCache } from './descriptorRootCache.js';
import { encodeRootAsProtosetBase64 } from './protoDescriptorParser.js';
import { decodeProtoMessage, encodeProtoMessage } from './dynamicProtoCodec.js';
import { DescriptorLoader, DescriptorLoaderError, descriptorLoader } from './descriptorLoader.js';
import { grpcJsClient, type GrpcClientPort } from './grpcClient.js';

function mapDescriptorLoaderErrorCode(
  error: DescriptorLoaderError,
  op: 'reflect' | 'describe',
): GrpcErrorCode {
  switch (error.code) {
    case 'unreachable':
      return GRPC_ERROR_CODES.UNREACHABLE;
    case 'invalid_target':
      return GRPC_ERROR_CODES.INVALID_TARGET;
    case 'invalid_descriptor':
      return GRPC_ERROR_CODES.INVALID_DESCRIPTOR;
    case 'describe_failed':
      return GRPC_ERROR_CODES.DESCRIBE_FAILED;
    case 'import_resolution_failed':
      return GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED;
    case 'reflection_failed':
      return GRPC_ERROR_CODES.REFLECTION_FAILED;
    default:
      return op === 'reflect'
        ? GRPC_ERROR_CODES.REFLECTION_FAILED
        : GRPC_ERROR_CODES.DESCRIBE_FAILED;
  }
}

async function appendAuthMetadata(
  metadata: Record<string, string>,
  auth: GrpcCallRequest['auth'],
  oauth2TokenService: GrpcOAuth2TokenService,
): Promise<Record<string, string>> {
  if (auth?.type === 'oauth2') {
    return resolveGrpcExecuteAuthMetadata(metadata, auth, oauth2TokenService);
  }
  return resolveGrpcExecuteAuthMetadataSync(metadata, auth);
}

export class GrpcService {
  constructor(
    private readonly client: GrpcClientPort = grpcJsClient,
    private readonly loader: DescriptorLoader = descriptorLoader,
    private readonly oauth2TokenService: GrpcOAuth2TokenService = grpcOAuth2TokenService,
  ) {}

  async status(request: GrpcStatusRequest): Promise<GrpcRouteEnvelope<GrpcStatusResult>> {
    const started = Date.now();
    const tlsMode = request.tlsMode ?? defaultGrpcTlsMode();
    const issues = validateGrpcStatusRequest(request);
    if (issues.length > 0) {
      return createGrpcValidationErrorEnvelope('status', issues, {
        durationMs: Date.now() - started,
      })!;
    }

    const check = validateResolvedGrpcTargetAddress(request.address);
    const normalizedAddress = check.valid ? check.normalized : request.address.trim();
    const timeoutMs = request.timeoutMs ?? GRPC_DEFAULT_PROBE_TIMEOUT_MS;
    const probe = await this.client.probeReachability({
      address: normalizedAddress,
      timeoutMs,
    });

    const data: GrpcStatusResult = {
      reachable: probe.reachable,
      address: normalizedAddress,
      tlsMode,
      latencyMs: probe.latencyMs,
      errorMessage: probe.errorMessage,
    };

    return createGrpcSuccessEnvelope('status', data, {
      durationMs: Date.now() - started,
    });
  }

  async reflect(request: GrpcReflectRequest): Promise<GrpcRouteEnvelope<GrpcDescriptor>> {
    const started = Date.now();
    const issues = validateGrpcReflectRequest(request);
    if (issues.length > 0) {
      return createGrpcValidationErrorEnvelope('reflect', issues, {
        requestId: request.requestId,
        durationMs: Date.now() - started,
      })!;
    }

    try {
      const descriptor = await this.loader.loadFromReflection(request);
      return createGrpcSuccessEnvelope('reflect', descriptor, {
        requestId: request.requestId,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      if (error instanceof DescriptorLoaderError) {
        const code = mapDescriptorLoaderErrorCode(error, 'reflect');
        return createSanitizedGrpcErrorEnvelope(
          'reflect',
          {
            code,
            message: error.message,
            retryable: error.code === 'unreachable',
            details: error.transportDetails,
          },
          { requestId: request.requestId, durationMs: Date.now() - started },
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      return createSanitizedGrpcErrorEnvelope(
        'reflect',
        {
          code: GRPC_ERROR_CODES.REFLECTION_FAILED,
          message: `Server reflection failed: ${message}`,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }
  }

  async describe(request: GrpcDescribeRequest): Promise<GrpcRouteEnvelope<GrpcDescriptor>> {
    const started = Date.now();
    const issues = validateGrpcDescribeRequest(request);
    if (issues.length > 0) {
      return createGrpcValidationErrorEnvelope('describe', issues, {
        requestId: request.requestId,
        durationMs: Date.now() - started,
      })!;
    }

    try {
      const descriptor = await this.loader.loadFromDescribe(request);
      return createGrpcSuccessEnvelope('describe', descriptor, {
        requestId: request.requestId,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      if (error instanceof DescriptorLoaderError) {
        return createGrpcErrorEnvelope(
          'describe',
          {
            code: mapDescriptorLoaderErrorCode(error, 'describe'),
            message: error.message,
          },
          { requestId: request.requestId, durationMs: Date.now() - started },
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      return createGrpcErrorEnvelope(
        'describe',
        {
          code: GRPC_ERROR_CODES.DESCRIBE_FAILED,
          message: `Failed to parse ${request.source} source: ${message}`,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }
  }

  async exportProtoset(
    request: GrpcExportProtosetRequest,
  ): Promise<GrpcRouteEnvelope<GrpcExportProtosetResult>> {
    const started = Date.now();
    const issues = validateGrpcExportProtosetRequest(request);
    if (issues.length > 0) {
      return createGrpcValidationErrorEnvelope('export_protoset', issues, {
        requestId: request.requestId,
        durationMs: Date.now() - started,
      })!;
    }

    const descriptorKey = request.descriptorKey.trim();
    const descriptor = getGrpcDescriptor(descriptorKey);
    if (!descriptor) {
      return createGrpcErrorEnvelope(
        'export_protoset',
        {
          code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
          message: `Descriptor not found for key: ${descriptorKey}`,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }

    const root = getDescriptorRootCache(descriptorKey);
    if (!root) {
      return createGrpcErrorEnvelope(
        'export_protoset',
        {
          code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
          message: 'Descriptor root is not available for export — reload the schema and try again',
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }

    try {
      const protosetBase64 = encodeRootAsProtosetBase64(root);
      const hashSuffix = descriptor.contentSha256?.slice(0, 8) ?? 'schema';
      const fileName = `grpc-${descriptor.source}-${hashSuffix}.pb`;
      return createGrpcSuccessEnvelope(
        'export_protoset',
        { protosetBase64, fileName },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createGrpcErrorEnvelope(
        'export_protoset',
        {
          code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
          message: `Failed to encode protoset: ${message}`,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }
  }

  async lookupDescriptor(
    request: GrpcDescriptorLookupRequest,
  ): Promise<GrpcRouteEnvelope<GrpcDescriptor>> {
    const started = Date.now();
    const issues = validateGrpcDescriptorLookupRequest(request);
    if (issues.length > 0) {
      return createGrpcValidationErrorEnvelope('lookup_descriptor', issues, {
        requestId: request.requestId,
        durationMs: Date.now() - started,
      })!;
    }

    const descriptorKey = request.descriptorKey.trim();
    const descriptor = getGrpcDescriptor(descriptorKey);
    if (!descriptor) {
      return createGrpcErrorEnvelope(
        'lookup_descriptor',
        {
          code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
          message: `Descriptor not found for key: ${descriptorKey}`,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }

    return createGrpcSuccessEnvelope(
      'lookup_descriptor',
      descriptor,
      { requestId: request.requestId, durationMs: Date.now() - started },
    );
  }

  async call(request: GrpcCallRequest, tabId?: string): Promise<GrpcRouteEnvelope<GrpcCallResult>> {
    const started = Date.now();
    const issues = validatePhase1UnaryCallRequest(request);
    if (issues.length > 0) {
      return createGrpcValidationErrorEnvelope('call', issues, {
        requestId: request.requestId,
        durationMs: Date.now() - started,
      })!;
    }

    const targetCheck = validateResolvedGrpcTargetAddress(request.target.address);
    if (targetCheck.valid && targetCheck.kind === 'in_process') {
      return createGrpcErrorEnvelope(
        'call',
        {
          code: GRPC_ERROR_CODES.UNREACHABLE,
          message: 'in-process targets are not dialable from the Node server (Phase 1B)',
          retryable: false,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }

    const dialAddress = targetCheck.valid ? targetCheck.normalized : request.target.address.trim();

    const descriptor = getGrpcDescriptor(request.descriptorKey);
    if (!descriptor) {
      return createGrpcErrorEnvelope(
        'call',
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
        'call',
        {
          code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
          message: `Method ${request.service}/${request.method} not found in descriptor`,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }

    if (methodInfo.callType !== 'unary') {
      return createGrpcErrorEnvelope(
        'call',
        {
          code: GRPC_ERROR_CODES.INVALID_REQUEST,
          message: `Phase 1 supports unary calls only (${methodInfo.callType} not supported)`,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }

    let requestBuffer: Buffer;
    let protoSerializationMs = 0;
    try {
      const encodeStarted = Date.now();
      requestBuffer = encodeProtoMessage(
        descriptor,
        methodInfo.requestTypeName,
        request.body,
      );
      protoSerializationMs = Date.now() - encodeStarted;
    } catch (encodeError) {
      const message = encodeError instanceof Error ? encodeError.message : String(encodeError);
      const schemaFailure = /Invalid descriptor schema|not found in descriptor/i.test(message);
      return createGrpcErrorEnvelope(
        'call',
        {
          code: schemaFailure ? GRPC_ERROR_CODES.INVALID_DESCRIPTOR : GRPC_ERROR_CODES.INVALID_REQUEST,
          message,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }

    const timeoutMs = request.timeoutMs ?? GRPC_DEFAULT_CALL_TIMEOUT_MS;
    let metadata: Record<string, string>;
    try {
      metadata = await appendAuthMetadata(
        normalizeGrpcMetadata(request.metadata),
        request.auth,
        this.oauth2TokenService,
      );
    } catch (error) {
      const mapped = mapGrpcAuthResolveErrorForEnvelope(error);
      return createGrpcValidationErrorEnvelope('call', [{
        field: mapped.field,
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message: mapped.message,
      }], {
        requestId: request.requestId,
        durationMs: Date.now() - started,
      })!;
    }

    const registration = tryRegisterGrpcCall(request.requestId, tabId);
    if (!registration.ok) {
      return createGrpcErrorEnvelope(
        'call',
        {
          code: GRPC_ERROR_CODES.INVALID_REQUEST,
          message: `requestId ${request.requestId} is already in use by an active call`,
        },
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    }

    const { signal } = registration;

    try {
      const invokeResult = await this.client.invokeUnary({
        address: dialAddress,
        service: request.service,
        method: request.method,
        requestBuffer,
        metadata,
        timeoutMs,
        signal,
        tlsMode: request.target.tlsMode,
        tlsConfig: request.target.tlsConfig,
        decodeResponse: (buffer) => decodeProtoMessage(
          descriptor,
          methodInfo.responseTypeName,
          buffer,
        ),
      });

      const registryEntry = getGrpcCallEntry(request.requestId);
      if (signal.aborted || registryEntry?.status === 'cancelled') {
        return createGrpcErrorEnvelope(
          'call',
          {
            code: GRPC_ERROR_CODES.CANCELLED,
            message: 'Unary call was cancelled by the client',
          },
          { requestId: request.requestId, durationMs: Date.now() - started },
        );
      }

      markGrpcCallCompleted(request.requestId);
      const data: GrpcCallResult = {
        callType: 'unary',
        status: invokeResult.status,
        statusMessage: invokeResult.statusMessage,
        headers: invokeResult.headers,
        trailers: invokeResult.trailers,
        body: invokeResult.body,
        durationMs: Date.now() - started,
        timingBreakdown: {
          ...invokeResult.timingBreakdown,
          protoSerializationMs,
        },
      };

      return createGrpcSuccessEnvelope('call', data, {
        requestId: request.requestId,
        durationMs: data.durationMs,
      });
    } catch (error) {
      const registryEntry = getGrpcCallEntry(request.requestId);
      if (signal.aborted || registryEntry?.status === 'cancelled') {
        markGrpcCallCancelled(request.requestId);
        return createGrpcErrorEnvelope(
          'call',
          {
            code: GRPC_ERROR_CODES.CANCELLED,
            message: 'Unary call was cancelled by the client',
          },
          { requestId: request.requestId, durationMs: Date.now() - started },
        );
      }

      const grpcStatus = (error as { grpcStatus?: number }).grpcStatus;
      if (typeof grpcStatus === 'number') {
        if (grpcStatus === grpc.status.CANCELLED) {
          markGrpcCallCancelled(request.requestId);
          return createGrpcErrorEnvelope(
            'call',
            {
              code: GRPC_ERROR_CODES.CANCELLED,
              message: 'Unary call was cancelled by the client',
            },
            { requestId: request.requestId, durationMs: Date.now() - started },
          );
        }

        markGrpcCallCompleted(request.requestId);
        const grpcDetails = (error as { grpcDetails?: string }).grpcDetails ?? 'RPC failed';
        const grpcMetadata = (error as { grpcMetadata?: grpc.Metadata }).grpcMetadata;
        return createGrpcTransportErrorEnvelope(
          'call',
          error,
          { requestId: request.requestId, durationMs: Date.now() - started },
          {
            grpcStatus,
            grpcDetails,
            grpcMetadata: grpcMetadata ? Object.fromEntries(
              Object.entries(grpcMetadata.getMap()).map(([key, values]) => [key, String(values[0])]),
            ) : undefined,
          },
        );
      }

      markGrpcCallCompleted(request.requestId);

      return createGrpcTransportErrorEnvelope(
        'call',
        error,
        { requestId: request.requestId, durationMs: Date.now() - started },
      );
    } finally {
      // Keep completed/cancelled entries for idempotent DELETE until cancel clears them.
    }
  }

  cancel(requestId: string, tabId?: string): GrpcRouteEnvelope<GrpcCancelCallResult> {
    if (!requestId?.trim()) {
      return createGrpcErrorEnvelope('cancel', {
        code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
        message: 'No in-flight call registered for requestId',
      });
    }

    const result = cancelGrpcCall(requestId, tabId);

    if (result === 'not_found') {
      return createGrpcErrorEnvelope('cancel', {
        code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
        message: 'No in-flight call registered for requestId',
      }, { requestId });
    }

    if (result === 'tab_mismatch') {
      return createGrpcErrorEnvelope('cancel', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message: 'tabId does not match the registered call',
      }, { requestId });
    }

    if (result === 'already_completed') {
      return createGrpcSuccessEnvelope(
        'cancel',
        { requestId, cancelled: false, alreadyCompleted: true },
        { requestId },
      );
    }

    return createGrpcSuccessEnvelope(
      'cancel',
      { requestId, cancelled: true },
      { requestId },
    );
  }
}

export const grpcService = new GrpcService();
