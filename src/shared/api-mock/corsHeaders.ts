/**
 * CORS headers for API Mock listeners (Node companion and native Tauri).
 * Matches Studio `settings.cors` and the native Hyper listener rules.
 */
import type { ApiMockServerSettingsV1 } from './contracts';

export type ApiMockCorsSettingsV1 = ApiMockServerSettingsV1['cors'];

const DEFAULT_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const DEFAULT_HEADERS = 'Content-Type,Authorization,Accept';

export function isCorsPreflight(method: string, cors: ApiMockCorsSettingsV1): boolean {
  return cors.enabled && method.toUpperCase() === 'OPTIONS';
}

export function requestOriginHeader(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers.origin ?? headers.Origin;
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/** Headers applied to every CORS-enabled response (including preflight). */
export function corsResponseHeaders(
  cors: ApiMockCorsSettingsV1,
  requestOrigin: string | undefined,
): Record<string, string> {
  if (!cors.enabled) return {};
  const headers: Record<string, string> = {};
  const origin = requestOrigin?.trim() || '*';
  const allowlist = cors.allowOrigins ?? [];
  const hasWildcard = allowlist.includes('*');
  const allowed = allowlist.length === 0 || hasWildcard || allowlist.includes(origin);

  if (allowed) {
    applyAllowOrigin(headers, cors, origin, hasWildcard || allowlist.length === 0);
  }

  headers['Access-Control-Allow-Methods'] = cors.allowMethods.length > 0
    ? cors.allowMethods.join(',')
    : DEFAULT_METHODS;
  headers['Access-Control-Allow-Headers'] = cors.allowHeaders.length > 0
    ? cors.allowHeaders.join(',')
    : DEFAULT_HEADERS;
  if (cors.exposeHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = cors.exposeHeaders.join(',');
  }
  return headers;
}

export function corsPreflightHeaders(
  cors: ApiMockCorsSettingsV1,
  requestOrigin: string | undefined,
): Record<string, string> {
  return {
    ...corsResponseHeaders(cors, requestOrigin),
    'Access-Control-Max-Age': String(cors.maxAge ?? 86_400),
  };
}

function applyAllowOrigin(
  headers: Record<string, string>,
  cors: ApiMockCorsSettingsV1,
  origin: string,
  wildcard: boolean,
): void {
  if (cors.allowCredentials) {
    if (origin !== '*') {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Vary'] = 'Origin';
    }
    return;
  }
  headers['Access-Control-Allow-Origin'] = wildcard ? '*' : origin;
}
