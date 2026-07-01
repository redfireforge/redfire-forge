/**
 * Phase 4A — centralized secret redaction for persistence, exports, and diagnostics.
 */
import type {
  GrpcAuthConfig,
  GrpcCallRequest,
  GrpcCallResult,
  GrpcErrorBody,
  GrpcErrorCategory,
  GrpcErrorEnvelope,
  GrpcEnvelopeMeta,
  GrpcOperation,
  GrpcTabExecuteSnapshot,
  GrpcTlsConfig,
} from './contracts';
import {
  createGrpcErrorEnvelope,
  grpcErrorCategoryForCode,
  normalizeGrpcMetadata,
} from './contracts';
import { getGrpcAuthMetadataKeys, buildAuthMetadataHeaders } from './grpcAuthPolicy';
import { sanitizeGrpcOAuth2ErrorText } from './grpcOAuth2Policy';
import {
  type GrpcRedactionConsumer,
  isGrpcSecretMetadataKey,
} from './grpcSecretPolicy';

export const GRPC_REDACTED_PLACEHOLDER = '[REDACTED]';
export const GRPC_REDACTED_PEM_PLACEHOLDER = '[REDACTED_PEM]';

const PEM_IN_TEXT_PATTERN = /-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/g;
const BEARER_IN_TEXT_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const BASIC_IN_TEXT_PATTERN = /Basic\s+[A-Za-z0-9+/=]+/gi;

export function maskGrpcDisplayValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function redactGrpcTlsConfig(
  tlsConfig: GrpcTlsConfig | undefined,
): GrpcTlsConfig | undefined {
  if (!tlsConfig) return undefined;
  return {
    serverCaPem: tlsConfig.serverCaPem ? GRPC_REDACTED_PEM_PLACEHOLDER : undefined,
    clientCertPem: tlsConfig.clientCertPem ? GRPC_REDACTED_PEM_PLACEHOLDER : undefined,
    clientKeyPem: tlsConfig.clientKeyPem ? GRPC_REDACTED_PEM_PLACEHOLDER : undefined,
    serverNameOverride: tlsConfig.serverNameOverride,
  };
}

export function redactGrpcAuthConfig(
  auth: GrpcAuthConfig | undefined,
): GrpcAuthConfig | undefined {
  if (!auth) return undefined;
  if (auth.type === 'none') return { type: 'none' };

  switch (auth.type) {
    case 'bearer':
      return {
        type: 'bearer',
        bearerToken: auth.bearerToken ? GRPC_REDACTED_PLACEHOLDER : undefined,
      };
    case 'basic':
      return {
        type: 'basic',
        basicUsername: auth.basicUsername,
        basicPassword: auth.basicPassword ? GRPC_REDACTED_PLACEHOLDER : undefined,
      };
    case 'api_key':
      return {
        type: 'api_key',
        apiKeyName: auth.apiKeyName,
        apiKeyValue: auth.apiKeyValue ? GRPC_REDACTED_PLACEHOLDER : undefined,
      };
    case 'oauth2':
      return {
        type: 'oauth2',
        oauth2: auth.oauth2
          ? {
              tokenUrl: auth.oauth2.tokenUrl,
              clientId: auth.oauth2.clientId,
              clientSecret: auth.oauth2.clientSecret
                ? GRPC_REDACTED_PLACEHOLDER
                : '',
              scope: auth.oauth2.scope,
            }
          : undefined,
      };
    default:
      return auth;
  }
}

export function redactGrpcProtoIngestState<T extends { bsrToken?: string }>(
  ingest: T | undefined,
): T | undefined {
  if (!ingest) return undefined;
  return {
    ...ingest,
    bsrToken: ingest.bsrToken ? GRPC_REDACTED_PLACEHOLDER : undefined,
  };
}

export function redactGrpcMetadataForDisplay(
  metadata: Record<string, string> | undefined,
): Record<string, string> {
  if (!metadata) return {};
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    if (lower === 'authorization') {
      redacted[key] = redactAuthorizationHeader(value);
    } else if (lower.endsWith('-bin')) {
      redacted[key] = value ? '[base64]' : '';
    } else if (isGrpcSecretMetadataKey(key)) {
      redacted[key] = GRPC_REDACTED_PLACEHOLDER;
    } else {
      redacted[key] = maskGrpcDisplayValue(value);
    }
  }
  return redacted;
}

/** Export/history path — full redaction for auth-panel keys and secret metadata names. */
export function redactGrpcMetadataForExport(
  metadata: Record<string, string> | undefined,
  auth?: GrpcAuthConfig,
): Record<string, string> {
  if (!metadata && !auth) return {};

  const authHeaderKeys = new Set<string>(getGrpcAuthMetadataKeys(auth));
  const authResult = buildAuthMetadataHeaders(auth);
  if (authResult.ok) {
    for (const key of Object.keys(authResult.metadata)) {
      authHeaderKeys.add(key);
    }
  }

  const redacted: Record<string, string> = {};
  const normalizedMetadata = normalizeGrpcMetadata(metadata);
  for (const [key, value] of Object.entries(normalizedMetadata)) {
    const lower = key.toLowerCase();
    if (authHeaderKeys.has(key) || isGrpcSecretMetadataKey(key)) {
      redacted[key] = GRPC_REDACTED_PLACEHOLDER;
    } else if (lower.endsWith('-bin')) {
      redacted[key] = value ? '[base64]' : '';
    } else {
      redacted[key] = maskGrpcDisplayValue(value);
    }
  }

  for (const key of authHeaderKeys) {
    if (!(key in redacted)) {
      redacted[key] = GRPC_REDACTED_PLACEHOLDER;
    }
  }

  return redacted;
}

export function redactAuthorizationHeader(value: string): string {
  const trimmed = value.trim();
  if (/^bearer /i.test(trimmed)) {
    return `Bearer ${maskGrpcDisplayValue(trimmed.replace(/^bearer /i, ''))}`;
  }
  if (/^basic /i.test(trimmed)) {
    return 'Basic ••••';
  }
  return maskGrpcDisplayValue(trimmed);
}

export function sanitizeGrpcErrorMessage(message: string): string {
  return sanitizeGrpcOAuth2ErrorText(message)
    .replace(PEM_IN_TEXT_PATTERN, GRPC_REDACTED_PEM_PLACEHOLDER)
    .replace(BEARER_IN_TEXT_PATTERN, 'Bearer [REDACTED]')
    .replace(BASIC_IN_TEXT_PATTERN, 'Basic [REDACTED]');
}

export function redactGrpcErrorBody(error: GrpcErrorBody): GrpcErrorBody {
  return {
    ...error,
    message: sanitizeGrpcErrorMessage(error.message),
    details: redactUnknownValue(error.details),
  };
}

/** Error envelope factory with Phase 4A secret sanitization (T2). */
export function createSanitizedGrpcErrorEnvelope(
  op: GrpcOperation,
  error: Omit<GrpcErrorBody, 'category'> & { category?: GrpcErrorCategory },
  meta?: Partial<GrpcEnvelopeMeta>,
): GrpcErrorEnvelope {
  const category = error.category ?? grpcErrorCategoryForCode(error.code);
  return createGrpcErrorEnvelope(op, redactGrpcErrorBody({ ...error, category }), meta);
}

export function redactGrpcCallRequestForExport(
  request: GrpcCallRequest,
): GrpcCallRequest {
  return {
    ...request,
    metadata: redactGrpcMetadataForExport(request.metadata, request.auth),
    auth: redactGrpcAuthConfig(request.auth),
    target: {
      ...request.target,
      tlsConfig: redactGrpcTlsConfig(request.target.tlsConfig),
    },
  };
}

export function redactGrpcExecuteSnapshotForExport(
  snapshot: GrpcTabExecuteSnapshot,
): GrpcTabExecuteSnapshot {
  return {
    ...snapshot,
    metadata: redactGrpcMetadataForExport(snapshot.metadata, snapshot.auth),
    auth: redactGrpcAuthConfig(snapshot.auth),
    target: {
      ...snapshot.target,
      tlsConfig: redactGrpcTlsConfig(snapshot.target.tlsConfig),
    },
    interpolationEnv: snapshot.interpolationEnv
      ? {
          ...snapshot.interpolationEnv,
          env: {},
        }
      : undefined,
  };
}

/** Phase 4E — surfaces that carry tab runtime fields subject to consumer redaction. */
export interface GrpcRedactableStudioPayload {
  tlsConfig?: GrpcTlsConfig;
  auth?: GrpcAuthConfig;
  metadata?: Record<string, string>;
  lastExecuteSnapshot?: GrpcTabExecuteSnapshot;
  lastResult?: GrpcCallResult;
  lastError?: GrpcErrorBody;
  protoIngest?: { bsrToken?: string };
}

export function redactGrpcCallResultForDisplay(result: GrpcCallResult): GrpcCallResult {
  return {
    ...result,
    headers: redactGrpcMetadataForDisplay(result.headers),
    trailers: redactGrpcMetadataForDisplay(result.trailers),
  };
}

export function redactGrpcCallResultForExport(
  result: GrpcCallResult,
  auth?: GrpcAuthConfig,
): GrpcCallResult {
  return {
    ...result,
    headers: redactGrpcMetadataForExport(result.headers, auth),
    trailers: redactGrpcMetadataForExport(result.trailers, auth),
  };
}

export function redactGrpcStudioPayloadForConsumer(
  payload: GrpcRedactableStudioPayload,
  consumer: GrpcRedactionConsumer,
): GrpcRedactableStudioPayload {
  const needsExportRedaction = consumer !== 'toast_messages';
  const redacted: GrpcRedactableStudioPayload = { ...payload };

  if (payload.metadata !== undefined) {
    redacted.metadata = needsExportRedaction
      ? redactGrpcMetadataForExport(payload.metadata, payload.auth)
      : redactGrpcMetadataForDisplay(payload.metadata);
  }

  if (payload.auth !== undefined) {
    redacted.auth = redactGrpcAuthConfig(payload.auth);
  }

  if (payload.tlsConfig !== undefined) {
    redacted.tlsConfig = redactGrpcTlsConfig(payload.tlsConfig);
  }

  if (payload.lastExecuteSnapshot !== undefined) {
    redacted.lastExecuteSnapshot = redactGrpcExecuteSnapshotForExport(payload.lastExecuteSnapshot);
  }

  if (payload.lastResult !== undefined) {
    redacted.lastResult = needsExportRedaction
      ? redactGrpcCallResultForExport(payload.lastResult, payload.auth)
      : redactGrpcCallResultForDisplay(payload.lastResult);
  }

  if (payload.lastError !== undefined) {
    redacted.lastError = redactGrpcErrorBody(payload.lastError);
  }

  if (payload.protoIngest !== undefined) {
    redacted.protoIngest = redactGrpcProtoIngestState(payload.protoIngest);
  }

  return redacted;
}

/** Phase 5 prep — redacted call history record shape (no raw secrets). */
export interface GrpcCallHistoryRecord {
  snapshot: GrpcTabExecuteSnapshot;
  result?: GrpcCallResult;
  error?: GrpcErrorBody;
  capturedAt: string;
}

export function prepareGrpcCallHistoryRecord(input: {
  snapshot: GrpcTabExecuteSnapshot;
  result?: GrpcCallResult;
  error?: GrpcErrorBody;
}): GrpcCallHistoryRecord {
  const payload = redactGrpcStudioPayloadForConsumer(
    {
      lastExecuteSnapshot: input.snapshot,
      lastResult: input.result,
      lastError: input.error,
      auth: input.snapshot.auth,
    },
    'call_history',
  );
  return {
    snapshot: payload.lastExecuteSnapshot!,
    result: payload.lastResult,
    error: payload.lastError,
    capturedAt: input.snapshot.capturedAt,
  };
}

function redactUnknownValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeGrpcErrorMessage(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactUnknownValue(entry));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (isLikelySecretKey(key) && typeof entry === 'string') {
        result[key] = GRPC_REDACTED_PLACEHOLDER;
      } else {
        result[key] = redactUnknownValue(entry);
      }
    }
    return result;
  }
  return value;
}

function isLikelySecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  return isGrpcSecretMetadataKey(key) || lower.includes('pem');
}

/** Phase 8H — recursively redact secret-bearing nested values for harness export. */
export function redactGrpcNestedValueForExport(value: unknown): unknown {
  return redactUnknownValue(value);
}
