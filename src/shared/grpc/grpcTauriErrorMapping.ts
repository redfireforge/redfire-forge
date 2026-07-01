/**
 * Map native Tauri gRPC error codes to Express route error codes — Phase 7C parity.
 */
import { GRPC_ERROR_CODES } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import type { GrpcOperation } from './contracts';
import { classifyGrpcTransportFailure } from './grpcTransportErrors';
import { GrpcNativeTauriTransportError } from './grpcNativeTauriTransport';
import { GRPC_TAURI_ERROR_CODES } from './grpcTauriContracts';

const TAURI_TO_EXPRESS_CODE: Record<string, string> = {
  [GRPC_TAURI_ERROR_CODES.SCHEMA_MISMATCH]: GRPC_ERROR_CODES.INVALID_REQUEST,
  [GRPC_TAURI_ERROR_CODES.DESCRIPTOR_INTEGRITY]: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
  [GRPC_TAURI_ERROR_CODES.CHANNEL_BUILD]: GRPC_ERROR_CODES.UNREACHABLE,
  [GRPC_TAURI_ERROR_CODES.CALL_FAILED]: GRPC_ERROR_CODES.CALL_FAILED,
  [GRPC_TAURI_ERROR_CODES.CANCELLED]: GRPC_ERROR_CODES.CANCELLED,
  [GRPC_TAURI_ERROR_CODES.REQUEST_NOT_FOUND]: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
  [GRPC_TAURI_ERROR_CODES.INVALID_REQUEST]: GRPC_ERROR_CODES.INVALID_REQUEST,
  [GRPC_TAURI_ERROR_CODES.STREAM_NOT_FOUND]: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
  [GRPC_TAURI_ERROR_CODES.STREAM_OWNERSHIP]: GRPC_ERROR_CODES.INVALID_REQUEST,
  [GRPC_TAURI_ERROR_CODES.TAB_CLEANUP]: GRPC_ERROR_CODES.CALL_FAILED,
  [GRPC_TAURI_ERROR_CODES.INTERNAL]: GRPC_ERROR_CODES.CALL_FAILED,
};

const DESCRIPTOR_MESSAGE_PATTERN =
  /not found in descriptor|Service not found in descriptor|Failed to build descriptor pool|Invalid protosetBase64|protosetBase64 decoded to an empty buffer|64-character hex digest|SHA-256 mismatch/i;

const DESCRIPTOR_PREPARE_FAILURE_PATTERN =
  /SHA-256|descriptorKey|protosetBase64|descriptor/i;

export function mapTauriErrorCodeToExpress(code: string, message?: string): string {
  const normalizedMessage = message?.trim() ?? '';
  if (DESCRIPTOR_MESSAGE_PATTERN.test(normalizedMessage)) {
    return GRPC_ERROR_CODES.INVALID_DESCRIPTOR;
  }
  if (/target\.address is required/i.test(normalizedMessage)) {
    return GRPC_ERROR_CODES.INVALID_TARGET;
  }
  return TAURI_TO_EXPRESS_CODE[code] ?? GRPC_ERROR_CODES.CALL_FAILED;
}

export function toGrpcApiClientErrorFromDescriptorPrepare(
  op: GrpcOperation,
  error: unknown,
): GrpcApiClientError {
  if (error instanceof GrpcApiClientError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new GrpcApiClientError(op, message, {
    code: DESCRIPTOR_PREPARE_FAILURE_PATTERN.test(message)
      ? GRPC_ERROR_CODES.INVALID_DESCRIPTOR
      : GRPC_ERROR_CODES.INVALID_REQUEST,
    retryable: false,
  });
}

export function toGrpcApiClientErrorFromNative(
  op: GrpcOperation,
  error: GrpcNativeTauriTransportError | { message: string; code: string; retryable: boolean },
): GrpcApiClientError {
  return new GrpcApiClientError(op, error.message, {
    code: mapTauriErrorCodeToExpress(error.code, error.message),
    retryable: error.retryable,
  });
}

export function toGrpcApiClientErrorFromUnaryResult(result: {
  status: number;
  statusMessage: string;
  errorDetail?: string;
  trailers: Record<string, string>;
}): GrpcApiClientError {
  const classified = classifyGrpcTransportFailure(result.statusMessage, {
    grpcStatus: result.status,
    grpcDetails: result.errorDetail ?? result.statusMessage,
  });
  return new GrpcApiClientError('call', classified.message, {
    code: classified.code,
    retryable: classified.retryable,
    category: classified.category,
    details: {
      ...classified.details,
      trailers: result.trailers,
    },
  });
}
