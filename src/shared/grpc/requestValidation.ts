/**
 * Phase 1A — shared request validation for unary call routes (UI + src-server).
 */
import {
  GRPC_ERROR_CODES,
  createGrpcErrorEnvelope,
  grpcErrorCategoryForCode,
  isPhase1UnaryCallRequest,
  isPhase2StreamStartRequest,
  mapGrpcErrorCodeToHttpStatus,
  type GrpcCallRequest,
  type GrpcDescribeRequest,
  type GrpcErrorEnvelope,
  type GrpcExportProtosetRequest,
  type GrpcOperation,
  type GrpcReflectRequest,
  type GrpcStatusRequest,
  type GrpcStreamStartRequest,
  type GrpcTabExecuteSnapshot,
} from './contracts';
import { validateGrpcMetadataRecord } from './metadataValidation';
import { validateGrpcAuthForExecute } from './grpcAuthPolicy';
import { validateGrpcTlsConfigContract } from './grpcTlsPolicy';
import { validateResolvedGrpcTargetAddress, withGrpcTargetValidationMessage } from './targetValidation';

export interface GrpcRequestValidationIssue {
  field: string;
  code: string;
  message: string;
}

function validateOptionalTimeoutMs(
  timeoutMs: number | undefined,
  field: string,
  issues: GrpcRequestValidationIssue[],
): void {
  if (
    timeoutMs !== undefined &&
    (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
  ) {
    issues.push({
      field,
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'timeoutMs must be a positive number when provided',
    });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateGrpcTlsMode(
  tlsMode: string | undefined,
  field: string,
  issues: GrpcRequestValidationIssue[],
): void {
  if (tlsMode === undefined) return;
  if (tlsMode === 'disabled' || tlsMode === 'tls' || tlsMode === 'mtls') return;
  issues.push({
    field,
    code: GRPC_ERROR_CODES.INVALID_REQUEST,
    message: 'tlsMode must be disabled, tls, or mtls',
  });
}

function validateGrpcExecuteRequestCommon(
  request: GrpcCallRequest,
  issues: GrpcRequestValidationIssue[],
): void {
  if (!request.requestId?.trim()) {
    issues.push({
      field: 'requestId',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'requestId is required',
    });
  }

  if (!request.descriptorKey?.trim()) {
    issues.push({
      field: 'descriptorKey',
      code: GRPC_ERROR_CODES.MISSING_DESCRIPTOR_KEY,
      message: 'descriptorKey is required',
    });
  }

  if (!request.service?.trim()) {
    issues.push({
      field: 'service',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'service is required',
    });
  }

  if (!request.method?.trim()) {
    issues.push({
      field: 'method',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'method is required',
    });
  }

  if (!isPlainObject(request.body)) {
    issues.push({
      field: 'body',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'body must be a JSON object',
    });
  }

  const address = request.target?.address?.trim() ?? '';
  if (!address) {
    issues.push({
      field: 'target.address',
      code: GRPC_ERROR_CODES.INVALID_TARGET,
      message: 'target.address is required',
    });
  } else {
    const targetCheck = withGrpcTargetValidationMessage(validateResolvedGrpcTargetAddress(address));
    if (!targetCheck.valid) {
      issues.push({
        field: 'target.address',
        code: GRPC_ERROR_CODES.INVALID_TARGET,
        message: targetCheck.reason,
      });
    }
  }

  validateGrpcTlsMode(request.target?.tlsMode, 'target.tlsMode', issues);
  validateOptionalTimeoutMs(request.timeoutMs, 'timeoutMs', issues);

  for (const tlsIssue of validateGrpcTlsConfigContract(
    request.target?.tlsMode ?? 'disabled',
    request.target?.tlsConfig,
  )) {
    issues.push({
      field: `target.${tlsIssue.field}`,
      code: tlsIssue.code,
      message: tlsIssue.message,
    });
  }

  for (const authIssue of validateGrpcAuthForExecute(request.auth)) {
    issues.push(authIssue);
  }

  const metadataError = validateGrpcMetadataRecord(request.metadata);
  if (metadataError) {
    issues.push({
      field: 'metadata',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: metadataError,
    });
  }
}

export function validatePhase1UnaryCallRequest(
  request: GrpcCallRequest,
): GrpcRequestValidationIssue[] {
  const issues: GrpcRequestValidationIssue[] = [];

  if (!isPhase1UnaryCallRequest(request)) {
    issues.push({
      field: 'callType',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'Phase 1 supports unary calls only',
    });
  }

  validateGrpcExecuteRequestCommon(request, issues);

  return issues;
}

export function validateGrpcStreamStartRequest(
  request: GrpcStreamStartRequest,
): GrpcRequestValidationIssue[] {
  const issues: GrpcRequestValidationIssue[] = [];

  if (!isPhase2StreamStartRequest(request)) {
    issues.push({
      field: 'callType',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'callType must be server_streaming, client_streaming, or bidi_streaming',
    });
  }

  validateGrpcExecuteRequestCommon(request, issues);

  return issues;
}

/** Phase 11A — validate immutable tab execute snapshot before load-test capture. */
export function validateGrpcTabExecuteSnapshot(
  snapshot: GrpcTabExecuteSnapshot,
): GrpcRequestValidationIssue[] {
  const issues: GrpcRequestValidationIssue[] = [];

  if (!snapshot.tabId?.trim()) {
    issues.push({
      field: 'tabId',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'tabId is required',
    });
  }

  if (!snapshot.capturedAt?.trim()) {
    issues.push({
      field: 'capturedAt',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'capturedAt is required',
    });
  }

  validateGrpcExecuteRequestCommon(
    {
      requestId: snapshot.requestId,
      callType: snapshot.callType,
      descriptorKey: snapshot.descriptorKey,
      service: snapshot.service,
      method: snapshot.method,
      body: snapshot.body,
      target: snapshot.target,
      metadata: snapshot.metadata,
      timeoutMs: snapshot.timeoutMs,
      auth: snapshot.auth,
    } as GrpcCallRequest,
    issues,
  );

  return issues;
}

export function validateGrpcStreamSendRequest(
  body: unknown,
): GrpcRequestValidationIssue[] {
  const issues: GrpcRequestValidationIssue[] = [];
  if (!isPlainObject(body)) {
    issues.push({
      field: 'body',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'body must be a JSON object',
    });
  }
  return issues;
}

export function validateGrpcStreamTabId(
  tabId: string | undefined,
): GrpcRequestValidationIssue[] {
  if (!tabId?.trim()) {
    return [{
      field: 'tabId',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'tabId query parameter is required',
    }];
  }
  return [];
}

export function validateGrpcReflectRequest(
  request: GrpcReflectRequest,
): GrpcRequestValidationIssue[] {
  const issues: GrpcRequestValidationIssue[] = [];
  const address = request.target?.address?.trim() ?? '';

  if (!address) {
    issues.push({
      field: 'target.address',
      code: GRPC_ERROR_CODES.INVALID_TARGET,
      message: 'target.address is required',
    });
    return issues;
  }

  const targetCheck = withGrpcTargetValidationMessage(validateResolvedGrpcTargetAddress(address));
  if (!targetCheck.valid) {
    issues.push({
      field: 'target.address',
      code: GRPC_ERROR_CODES.INVALID_TARGET,
      message: targetCheck.reason,
    });
  }

  validateOptionalTimeoutMs(request.timeoutMs, 'timeoutMs', issues);
  validateGrpcTlsMode(request.target?.tlsMode, 'target.tlsMode', issues);

  for (const tlsIssue of validateGrpcTlsConfigContract(
    request.target?.tlsMode ?? 'disabled',
    request.target?.tlsConfig,
  )) {
    issues.push({
      field: `target.${tlsIssue.field}`,
      code: tlsIssue.code,
      message: tlsIssue.message,
    });
  }

  return issues;
}

export function validateGrpcDescribeRequest(
  request: GrpcDescribeRequest,
): GrpcRequestValidationIssue[] {
  const issues: GrpcRequestValidationIssue[] = [];

  if (
    request.source !== 'proto_files'
    && request.source !== 'protoset'
    && request.source !== 'bsr'
    && request.source !== 'url_proto'
  ) {
    issues.push({
      field: 'source',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: `unsupported describe source: ${request.source as string}`,
    });
    return issues;
  }

  if (request.source === 'proto_files') {
    if (!request.protoFiles?.length) {
      issues.push({
        field: 'protoFiles',
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
        message: 'protoFiles is required when source is proto_files',
      });
    } else {
      request.protoFiles.forEach((file, index) => {
        if (!file.path?.trim() || !file.content?.trim()) {
          issues.push({
            field: `protoFiles[${index}]`,
            code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
            message: 'each proto file requires non-empty path and content',
          });
        }
      });
    }
  } else if (request.source === 'protoset') {
    if (!request.protosetBase64?.trim()) {
      issues.push({
        field: 'protosetBase64',
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
        message: 'protosetBase64 is required when source is protoset',
      });
    }
  } else if (request.source === 'url_proto') {
    if (!request.url?.trim()) {
      issues.push({
        field: 'url',
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
        message: 'url is required when source is url_proto',
      });
    }
  } else if (request.source === 'bsr') {
    if (!request.bsrModule?.trim()) {
      issues.push({
        field: 'bsrModule',
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
        message: 'bsrModule is required when source is bsr',
      });
    }
  }

  return issues;
}

export function validateGrpcExportProtosetRequest(
  request: GrpcExportProtosetRequest,
): GrpcRequestValidationIssue[] {
  const issues: GrpcRequestValidationIssue[] = [];
  if (!request.descriptorKey?.trim()) {
    issues.push({
      field: 'descriptorKey',
      code: GRPC_ERROR_CODES.MISSING_DESCRIPTOR_KEY,
      message: 'descriptorKey is required',
    });
  }
  return issues;
}

export function validateGrpcStatusAddress(address: string): GrpcRequestValidationIssue[] {
  if (!address?.trim()) {
    return [{
      field: 'address',
      code: GRPC_ERROR_CODES.INVALID_TARGET,
      message: 'address query parameter is required',
    }];
  }

  const check = withGrpcTargetValidationMessage(validateResolvedGrpcTargetAddress(address));
  if (!check.valid) {
    return [{
      field: 'address',
      code: GRPC_ERROR_CODES.INVALID_TARGET,
      message: check.reason,
    }];
  }

  return [];
}

export function validateGrpcStatusRequest(
  request: GrpcStatusRequest,
): GrpcRequestValidationIssue[] {
  const issues = validateGrpcStatusAddress(request.address);
  validateOptionalTimeoutMs(request.timeoutMs, 'timeoutMs', issues);
  validateGrpcTlsMode(request.tlsMode, 'tlsMode', issues);
  return issues;
}

/** Convenience for route handlers — returns first validation error code. */
export function firstGrpcValidationErrorCode(
  issues: GrpcRequestValidationIssue[],
): string | undefined {
  return issues[0]?.code;
}

/** Map validation issue code to HTTP status (Phase 1B route helper). */
export function grpcValidationIssueToHttpStatus(code: string): number {
  return mapGrpcErrorCodeToHttpStatus({
    code,
    category: grpcErrorCategoryForCode(code),
    message: '',
  });
}

/** Build a route error envelope from the first validation issue (Phase 1B). */
export function createGrpcValidationErrorEnvelope(
  op: GrpcOperation,
  issues: GrpcRequestValidationIssue[],
  meta?: { requestId?: string; durationMs?: number },
): GrpcErrorEnvelope | null {
  const first = issues[0];
  if (!first) return null;
  return createGrpcErrorEnvelope(
    op,
    {
      code: first.code,
      message: first.message,
      details: { field: first.field, issues },
    },
    meta,
  );
}
