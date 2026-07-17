/**
 * Phase 8 — shared auth resolver for the WebSocket and SSE studios.
 *
 * Turns an {@link AuthConfig} (header-based, query-based, or inherited from a
 * global profile) into concrete header / query-param key-value pairs to apply
 * at connect time. This is the single source of truth for both protocols:
 *
 *  - WebSocket applies header auth via the proxy sidecar (the direct browser
 *    `WebSocket` transport cannot set headers) and query auth by appending to
 *    the URL.
 *  - SSE applies header auth via `fetch` (works directly in the browser) and
 *    query auth by appending to the URL.
 *
 * It reuses {@link resolveAuthHeaders} for the header mapping, follows the
 * inherit chain through `globalProfileId`, interpolates `{{env}}` variables in
 * every credential field, and acquires OAuth2 tokens via
 * {@link acquireOAuth2Token} — mirroring the canonical Requests behaviour.
 */
import type { AuthConfig, GlobalAuthProfile } from '../../shared/types';
import { resolveAuthHeaders } from '../../shared/utils/authHeaders';
import { acquireOAuth2Token } from '../../engine/tokenManager';
import { resolveEnvVars } from './wsMessageUtils';

export interface ResolvedAuthKeyValue {
  key: string;
  value: string;
}

export interface ResolvedAuth {
  /** Header name → value pairs to merge into the connect request headers. */
  headers: ResolvedAuthKeyValue[];
  /** Query-param name → value pairs to append to the connect URL. */
  queryParams: ResolvedAuthKeyValue[];
}

/** Interpolate `{{env}}` placeholders in a single optional credential field. */
function interp(value: string | undefined, env: Record<string, string>): string {
  if (!value) return '';
  return resolveEnvVars(value, env);
}

/**
 * Resolve the effective {@link AuthConfig}, following the inherit chain.
 *
 * When `auth.type === 'inherit'` the bound global profile (`auth.globalProfileId`,
 * falling back to the catalog-style `auth.__globalProfileId`) supplies the real
 * auth. Returns `null` when there is no usable auth (none / unbound inherit /
 * missing profile).
 */
export function resolveEffectiveAuth(
  auth: AuthConfig | undefined,
  profiles: GlobalAuthProfile[],
): AuthConfig | null {
  if (!auth || auth.type === 'none') return null;
  if (auth.type === 'inherit') {
    const profileId = auth.globalProfileId ?? auth.__globalProfileId;
    if (!profileId) return null;
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile || !profile.auth || profile.auth.type === 'none' || profile.auth.type === 'inherit') return null;
    return profile.auth;
  }
  return auth;
}

/**
 * Resolve an {@link AuthConfig} into concrete headers + query params to apply at
 * connect time. Async because OAuth2 acquires a token over the network.
 *
 * @param auth      The draft / config auth (may be undefined or inherit).
 * @param profiles  Available global auth profiles (for inherit resolution).
 * @param envVarMap Environment variables used to interpolate `{{vars}}`.
 */
export async function resolveAuthForConnect(
  auth: AuthConfig | undefined,
  profiles: GlobalAuthProfile[],
  envVarMap: Record<string, string>,
): Promise<ResolvedAuth> {
  const effective = resolveEffectiveAuth(auth, profiles);
  if (!effective) return { headers: [], queryParams: [] };

  // Interpolate every credential field before mapping to headers/params so the
  // mapping (and OAuth2 acquisition) see fully-resolved values.
  const resolved: AuthConfig = {
    ...effective,
    username: interp(effective.username, envVarMap),
    password: interp(effective.password, envVarMap),
    token: interp(effective.token, envVarMap),
    prefix: effective.prefix ? interp(effective.prefix, envVarMap) : effective.prefix,
    apiKeyName: interp(effective.apiKeyName, envVarMap),
    apiKeyValue: interp(effective.apiKeyValue, envVarMap),
    tokenUrl: interp(effective.tokenUrl, envVarMap),
    clientId: interp(effective.clientId, envVarMap),
    clientSecret: interp(effective.clientSecret, envVarMap),
  };

  // API key is handled explicitly (not via resolveAuthHeaders) so the wire
  // matches the panel + the masked preview: query → URL param; header **or
  // unspecified** → request header. The panel's "Header" radio is the default
  // (checked when apiKeyIn !== 'query') but leaves apiKeyIn undefined until
  // toggled, and resolveAuthHeaders only maps apikey when apiKeyIn === 'header'
  // — so delegating here would silently drop a header-default key.
  if (resolved.type === 'apikey') {
    if (!resolved.apiKeyName || !resolved.apiKeyValue) {
      return { headers: [], queryParams: [] };
    }
    if (resolved.apiKeyIn === 'query') {
      return {
        headers: [],
        queryParams: [{ key: resolved.apiKeyName, value: resolved.apiKeyValue }],
      };
    }
    return {
      headers: [{ key: resolved.apiKeyName, value: resolved.apiKeyValue }],
      queryParams: [],
    };
  }

  let oauth2Token: string | undefined;
  if (resolved.type === 'oauth2') {
    if (!resolved.tokenUrl || !resolved.clientId || !resolved.clientSecret) {
      return { headers: [], queryParams: [] };
    }
    oauth2Token = await acquireOAuth2Token(resolved);
  }

  const headerMap = resolveAuthHeaders(resolved, oauth2Token);
  const headers = Object.entries(headerMap).map(([key, value]) => ({ key, value }));
  return { headers, queryParams: [] };
}

/**
 * Append already-resolved auth query params to a URL. Values are assumed to be
 * fully interpolated (by {@link resolveAuthForConnect}); they are URL-encoded
 * here. A no-op when there are no params.
 */
export function appendAuthQueryParams(url: string, params: ResolvedAuthKeyValue[]): string {
  if (params.length === 0) return url;
  const separator = url.includes('?') ? '&' : '?';
  const qs = params
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
  return `${url}${separator}${qs}`;
}

/** Mask a secret for display: keep the first/last few chars, hide the middle. */
function mask(value: string): string {
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/**
 * Base64-encode for the masked preview, tolerating non-Latin1 credentials.
 * `btoa` throws on characters outside the Latin1 range (e.g. accented or
 * emoji usernames). The preview is masked anyway, so a placeholder is fine —
 * this just prevents the (synchronous, in-render) preview from crashing.
 */
function safeBtoaMask(value: string): string {
  try {
    return mask(btoa(value));
  } catch {
    return '••••';
  }
}

/**
 * Produce a masked, human-readable one-line summary of what the resolved auth
 * will send (e.g. `Authorization: Basic dXNl…ZA==` or `X-API-Key (query): abc…xyz`).
 * Pure / synchronous — for OAuth2 it reports the flow rather than fetching a token.
 * Returns `null` when there is nothing to apply.
 */
export function describeResolvedAuth(
  auth: AuthConfig | undefined,
  profiles: GlobalAuthProfile[],
): string | null {
  const effective = resolveEffectiveAuth(auth, profiles);
  if (!effective) {
    if (auth?.type === 'inherit') return 'Inherit — no profile selected';
    return null;
  }

  switch (effective.type) {
    case 'basic':
      if (!effective.username) return null;
      return `Authorization: Basic ${safeBtoaMask(`${effective.username}:${effective.password ?? ''}`)}`;
    case 'digest':
      if (!effective.username) return null;
      return `Authorization: Basic ${safeBtoaMask(`${effective.username}:${effective.password ?? ''}`)} (digest fallback)`;
    case 'bearer': {
      if (!effective.token) return null;
      const prefix = effective.prefix?.trim() || 'Bearer';
      return `Authorization: ${prefix} ${mask(effective.token)}`;
    }
    case 'apikey': {
      if (!effective.apiKeyName || !effective.apiKeyValue) return null;
      const where = effective.apiKeyIn === 'query' ? 'query' : 'header';
      return `${effective.apiKeyName} (${where}): ${mask(effective.apiKeyValue)}`;
    }
    case 'oauth2':
      if (!effective.tokenUrl || !effective.clientId) return 'OAuth2 — incomplete configuration';
      return `Authorization: Bearer <token from ${effective.tokenUrl}>`;
    default:
      return null;
  }
}
