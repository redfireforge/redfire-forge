/**
 * Phase 4A — auth precedence, metadata merge, and validation contracts.
 *
 * Precedence (frozen):
 * 1. Manual metadata keys are normalized to lowercase.
 * 2. Auth panel output overrides conflicting manual keys (auth wins).
 * 3. `Authorization` from auth panel is canonical when auth type produces it.
 * 4. OAuth2 tokens are never fetched in the browser (Phase 4D server-side only).
 */
import {
  type GrpcAuthConfig,
  type GrpcAuthMetadataConflict,
  normalizeGrpcMetadata,
  GRPC_ERROR_CODES,
} from './contracts';
import {
  GRPC_OAUTH2_PREVIEW_AUTHORIZATION,
  oauth2ProducesAuthorizationHeader,
} from './grpcOAuth2Policy';

export interface GrpcAuthValidationIssue {
  field: string;
  code: string;
  message: string;
}

export type GrpcMetadataMergeResult =
  | {
      ok: true;
      metadata: Record<string, string>;
      authHeaders: Record<string, string>;
      conflicts: GrpcAuthMetadataConflict[];
    }
  | {
      ok: false;
      error: string;
      field?: string;
    };

function encodeBasicAuth(username: string, password: string): string {
  const raw = `${username}:${password}`;
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(raw);
  }
  return Buffer.from(raw, 'utf8').toString('base64');
}

export function buildAuthMetadataHeaders(
  auth: GrpcAuthConfig | undefined,
): GrpcMetadataMergeResult {
  if (!auth || auth.type === 'none') {
    return { ok: true, metadata: {}, authHeaders: {}, conflicts: [] };
  }

  switch (auth.type) {
    case 'inherit':
      return { ok: false, error: 'Inherited auth profile must be resolved before execute', field: 'auth.globalProfileId' };
    case 'bearer': {
      const token = auth.bearerToken?.trim();
      if (!token) {
        return { ok: false, error: 'Bearer token is required', field: 'auth.bearerToken' };
      }
      return {
        ok: true,
        metadata: { authorization: `Bearer ${token}` },
        authHeaders: { authorization: `Bearer ${token}` },
        conflicts: [],
      };
    }
    case 'basic': {
      const username = auth.basicUsername?.trim();
      if (!username) {
        return { ok: false, error: 'Basic auth username is required', field: 'auth.basicUsername' };
      }
      const encoded = encodeBasicAuth(username, auth.basicPassword ?? '');
      const value = `Basic ${encoded}`;
      return {
        ok: true,
        metadata: { authorization: value },
        authHeaders: { authorization: value },
        conflicts: [],
      };
    }
    case 'api_key': {
      const name = auth.apiKeyName?.trim().toLowerCase();
      const value = auth.apiKeyValue ?? '';
      if (!name) {
        return { ok: false, error: 'API key header name is required', field: 'auth.apiKeyName' };
      }
      if (!value.trim()) {
        return { ok: false, error: 'API key value is required', field: 'auth.apiKeyValue' };
      }
      return {
        ok: true,
        metadata: { [name]: value },
        authHeaders: { [name]: value },
        conflicts: [],
      };
    }
    case 'oauth2': {
      if (!auth.oauth2?.tokenUrl?.trim()) {
        return { ok: false, error: 'OAuth2 token URL is required', field: 'auth.oauth2.tokenUrl' };
      }
      if (!auth.oauth2.clientId?.trim()) {
        return { ok: false, error: 'OAuth2 client ID is required', field: 'auth.oauth2.clientId' };
      }
      if (!auth.oauth2.clientSecret?.trim()) {
        return {
          ok: false,
          error: 'OAuth2 client secret is required',
          field: 'auth.oauth2.clientSecret',
        };
      }
      return {
        ok: false,
        error: 'OAuth2 tokens are resolved server-side at execute time',
        field: 'auth.type',
      };
    }
    default:
      return { ok: false, error: `Unsupported auth type: ${(auth as GrpcAuthConfig).type}` };
  }
}

/** Metadata keys produced by auth panel at execute time (for export redaction). */
export function getGrpcAuthMetadataKeys(auth: GrpcAuthConfig | undefined): string[] {
  if (!auth || auth.type === 'none') return [];
  if (oauth2ProducesAuthorizationHeader(auth)) {
    return ['authorization'];
  }
  const result = buildAuthMetadataHeaders(auth);
  return result.ok ? Object.keys(result.metadata) : [];
}

export function buildGrpcOAuth2PreviewMetadata(
  manualMetadata: Record<string, string> | undefined,
  auth: GrpcAuthConfig | undefined,
): GrpcMetadataMergeResult {
  const shapeIssues = validateGrpcAuthConfigContract(auth);
  if (shapeIssues.length > 0) {
    return {
      ok: false,
      error: shapeIssues[0]?.message ?? 'Invalid OAuth2 configuration',
      field: shapeIssues[0]?.field,
    };
  }
  if (!auth || auth.type !== 'oauth2') {
    return { ok: false, error: 'OAuth2 auth configuration is required', field: 'auth.type' };
  }

  const normalizedManual = normalizeGrpcMetadata(manualMetadata);
  const authHeaders = { authorization: GRPC_OAUTH2_PREVIEW_AUTHORIZATION };
  const metadata = { ...normalizedManual };
  const conflicts: GrpcAuthMetadataConflict[] = [];

  for (const [key, authValue] of Object.entries(authHeaders)) {
    const manualValue = metadata[key];
    if (manualValue !== undefined && manualValue !== authValue) {
      conflicts.push({ key, manualValue, authValue });
    }
    metadata[key] = authValue;
  }

  return {
    ok: true,
    metadata,
    authHeaders,
    conflicts,
  };
}

/**
 * Build HTTP request metadata for execute — OAuth2 auth passes through for server-side token fetch.
 */
export function prepareGrpcExecuteRequestMetadata(
  manualMetadata: Record<string, string> | undefined,
  auth: GrpcAuthConfig | undefined,
): Record<string, string> | undefined {
  if (auth?.type === 'oauth2') {
    const normalized = normalizeGrpcMetadata(manualMetadata);
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }
  const merged = mergeGrpcExecuteMetadata(manualMetadata, auth);
  if (!merged.ok) {
    throw new Error(merged.error);
  }
  return Object.keys(merged.metadata).length > 0 ? merged.metadata : undefined;
}

export function mergeGrpcExecuteMetadata(
  manualMetadata: Record<string, string> | undefined,
  auth: GrpcAuthConfig | undefined,
): GrpcMetadataMergeResult {
  const normalizedManual = normalizeGrpcMetadata(manualMetadata);
  const authResult = buildAuthMetadataHeaders(auth);
  if (!authResult.ok) {
    return authResult;
  }

  const metadata = { ...normalizedManual };
  const conflicts: GrpcAuthMetadataConflict[] = [];

  for (const [key, authValue] of Object.entries(authResult.metadata)) {
    const manualValue = metadata[key];
    if (manualValue !== undefined && manualValue !== authValue) {
      conflicts.push({ key, manualValue, authValue });
    }
    metadata[key] = authValue;
  }

  return {
    ok: true,
    metadata,
    authHeaders: authResult.metadata,
    conflicts,
  };
}

export function validateGrpcAuthConfigContract(
  auth: GrpcAuthConfig | undefined,
): GrpcAuthValidationIssue[] {
  if (!auth || auth.type === 'none') return [];

  const issues: GrpcAuthValidationIssue[] = [];
  const push = (field: string, message: string) => {
    issues.push({ field, code: GRPC_ERROR_CODES.INVALID_REQUEST, message });
  };

  switch (auth.type) {
    case 'inherit':
      if (!auth.globalProfileId?.trim()) {
        push('auth.globalProfileId', 'Select an auth profile to inherit credentials.');
      }
      break;
    case 'bearer':
      if (!auth.bearerToken?.trim()) push('auth.bearerToken', 'Bearer token is required');
      break;
    case 'basic':
      if (!auth.basicUsername?.trim()) push('auth.basicUsername', 'Basic auth username is required');
      break;
    case 'api_key':
      if (!auth.apiKeyName?.trim()) push('auth.apiKeyName', 'API key header name is required');
      if (!auth.apiKeyValue?.trim()) push('auth.apiKeyValue', 'API key value is required');
      break;
    case 'oauth2':
      if (!auth.oauth2?.tokenUrl?.trim()) push('auth.oauth2.tokenUrl', 'OAuth2 token URL is required');
      if (!auth.oauth2?.clientId?.trim()) push('auth.oauth2.clientId', 'OAuth2 client ID is required');
      if (!auth.oauth2?.clientSecret?.trim()) {
        push('auth.oauth2.clientSecret', 'OAuth2 client secret is required');
      }
      break;
    default:
      push('auth.type', `Unsupported auth type: ${auth.type as string}`);
  }

  return issues;
}

/** Shape + execute readiness (oauth2 shape valid on client; token fetch is server-side). */
export function validateGrpcAuthForExecute(
  auth: GrpcAuthConfig | undefined,
): GrpcAuthValidationIssue[] {
  if (!auth || auth.type === 'none') {
    return [];
  }
  if (auth.type === 'oauth2') {
    return validateGrpcAuthConfigContract(auth);
  }

  const headerResult = buildAuthMetadataHeaders(auth);
  if (!headerResult.ok) {
    return [{
      field: headerResult.field ?? 'auth',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: headerResult.error,
    }];
  }
  return [];
}
