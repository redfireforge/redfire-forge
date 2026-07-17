/**
 * Phase 4D — OAuth2 client-credentials contracts (shared policy + error taxonomy).
 *
 * Token HTTP fetch lives server-side only (`src-server/grpc/grpcOAuth2TokenService.ts`).
 */
import type { GrpcAuthConfig } from './contracts';

export const GRPC_OAUTH2_DEFAULT_TOKEN_TTL_SEC = 1800;
export const GRPC_OAUTH2_TOKEN_EXPIRY_BUFFER_SEC = 30;
export const GRPC_OAUTH2_TOKEN_REQUEST_TIMEOUT_MS = 15_000;

export const GRPC_OAUTH2_PREVIEW_AUTHORIZATION = 'Bearer <server-acquired>';

export type GrpcOAuth2TokenErrorCategory =
  | 'invalid_client'
  | 'invalid_scope'
  | 'invalid_response'
  | 'endpoint_unreachable'
  | 'timeout';

export interface GrpcOAuth2Credentials {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export function normalizeGrpcOAuth2Credentials(
  oauth2: GrpcOAuth2Credentials | undefined,
): GrpcOAuth2Credentials | undefined {
  if (!oauth2) return undefined;
  const tokenUrl = oauth2.tokenUrl.trim();
  const clientId = oauth2.clientId.trim();
  const clientSecret = oauth2.clientSecret;
  const scope = oauth2.scope?.trim();
  if (!tokenUrl && !clientId && !clientSecret.trim() && !scope) {
    return undefined;
  }
  return {
    tokenUrl,
    clientId,
    clientSecret,
    scope: scope || undefined,
  };
}

/** In-memory cache key — never log or persist this value. */
export function buildGrpcOAuth2CacheKey(oauth2: GrpcOAuth2Credentials): string {
  return [
    oauth2.tokenUrl,
    oauth2.clientId,
    oauth2.clientSecret,
    oauth2.scope ?? '',
  ].join('|');
}

export function parseGrpcOAuth2TokenExpiry(accessToken: string): number | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(
      typeof globalThis.atob === 'function'
        ? globalThis.atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8'),
    ) as { exp?: unknown };
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

export function oauth2ProducesAuthorizationHeader(
  auth: GrpcAuthConfig | undefined,
): boolean {
  return auth?.type === 'oauth2';
}

export function mapGrpcOAuth2HttpFailure(
  status: number,
  bodyText: string,
): { category: GrpcOAuth2TokenErrorCategory; message: string } {
  const safeBody = sanitizeGrpcOAuth2ErrorText(bodyText);
  let parsedError: string | undefined;
  let parsedDescription: string | undefined;
  try {
    const parsed = JSON.parse(bodyText) as { error?: string; error_description?: string };
    if (typeof parsed.error === 'string') parsedError = parsed.error;
    if (typeof parsed.error_description === 'string') {
      parsedDescription = sanitizeGrpcOAuth2ErrorText(parsed.error_description);
    }
  } catch {
    // non-JSON body — use status mapping only
  }

  if (parsedError === 'invalid_scope') {
    return {
      category: 'invalid_scope',
      message: parsedDescription
        ? `OAuth2 token request failed: invalid_scope — ${parsedDescription}`
        : 'OAuth2 token request failed: invalid_scope — verify the requested scope.',
    };
  }
  if (status === 401 || parsedError === 'invalid_client') {
    return {
      category: 'invalid_client',
      message: 'OAuth2 token request failed: invalid_client — check client ID and client secret.',
    };
  }
  if (status >= 500) {
    return {
      category: 'endpoint_unreachable',
      message: `OAuth2 token endpoint returned ${status}. The authorization server may be unavailable.`,
    };
  }
  if (status >= 400) {
    const detail = parsedDescription ?? (safeBody ? safeBody.slice(0, 160) : `HTTP ${status}`);
    return {
      category: 'invalid_client',
      message: `OAuth2 token request failed: ${detail}`,
    };
  }
  return {
    category: 'invalid_response',
    message: 'OAuth2 token request failed: unexpected response from token endpoint.',
  };
}

/** Strip secret-like material from OAuth error text before surfacing to UI/logs. */
export function sanitizeGrpcOAuth2ErrorText(text: string): string {
  return text
    .replace(/client_secret[=:]\s*[^\s&"']+/gi, 'client_secret=[REDACTED]')
    .replace(/access_token[=:]\s*[^\s&"']+/gi, 'access_token=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
}

export function formatGrpcOAuth2TokenErrorMessage(
  category: GrpcOAuth2TokenErrorCategory,
  detail?: string,
): string {
  switch (category) {
    case 'invalid_client':
      return detail ?? 'OAuth2 token request failed: invalid_client — check client ID and client secret.';
    case 'invalid_scope':
      return detail ?? 'OAuth2 token request failed: invalid_scope — verify the requested scope.';
    case 'timeout':
      return 'OAuth2 token request timed out — check the token URL and network connectivity.';
    case 'endpoint_unreachable':
      return detail ?? 'OAuth2 token endpoint is unreachable — verify the token URL.';
    case 'invalid_response':
      return detail ?? 'OAuth2 token endpoint returned an invalid response (missing access_token).';
    default:
      return detail ?? 'OAuth2 token request failed.';
  }
}
