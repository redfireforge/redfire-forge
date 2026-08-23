/**
 * gqlAuthResolve.ts — resolve GraphQL Studio auth, including inherit-from-profile.
 *
 * Mirrors the WebSocket/SSE {@link resolveEffectiveAuth} pattern: store
 * `{ type: 'inherit', globalProfileId }` in tab/page auth state, then resolve
 * to concrete credentials at execution time via GlobalAuthProfile catalog.
 */
import type { AuthConfig, GlobalAuthProfile } from '@shared/types';
import type { GraphqlAuth } from '@shared/types/graphql';

/** Convert a resolved AuthConfig (from a global profile) into GraphqlAuth. */
export function authConfigToGraphqlAuth(config: AuthConfig): GraphqlAuth | null {
  switch (config.type) {
    case 'none':
    case 'inherit':
      return null;
    case 'bearer':
      return { type: 'bearer', token: config.token };
    case 'basic':
    case 'digest':
      return { type: 'basic', username: config.username, password: config.password };
    case 'apikey':
      return {
        type: 'apiKey',
        headerName: config.apiKeyName,
        headerValue: config.apiKeyValue,
      };
    case 'oauth2':
      return {
        type: 'oauth2',
        oauth2: {
          tokenUrl: config.tokenUrl ?? '',
          clientId: config.clientId ?? '',
          clientSecret: config.clientSecret ?? '',
        },
      };
    default:
      return null;
  }
}

/**
 * Follow the inherit chain and return concrete GraphqlAuth for header building.
 * Returns null when auth is unset, inherit-without-profile, or unresolvable.
 */
export function resolveEffectiveGqlAuth(
  auth: GraphqlAuth | null | undefined,
  profiles: GlobalAuthProfile[],
): GraphqlAuth | null {
  if (!auth) return null;
  if (auth.type !== 'inherit') return auth;
  const profileId = auth.globalProfileId;
  if (!profileId) return null;
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile?.auth || profile.auth.type === 'none' || profile.auth.type === 'inherit') {
    return null;
  }
  return authConfigToGraphqlAuth(profile.auth);
}

function mask(value: string): string {
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function safeBtoaMask(value: string): string {
  try {
    return mask(btoa(value));
  } catch {
    return '••••';
  }
}

/** Masked one-line preview for the auth popover footer (sync, no token fetch). */
export function describeResolvedGqlAuth(
  auth: GraphqlAuth | null | undefined,
  profiles: GlobalAuthProfile[],
): string {
  if (!auth) return 'No authentication headers will be added';

  if (auth.type === 'inherit') {
    if (!auth.globalProfileId) return 'Inherit — no profile selected';
    const profile = profiles.find((p) => p.id === auth.globalProfileId);
    if (!profile) return 'Inherit — profile not found';
    const effective = authConfigToGraphqlAuth(profile.auth);
    if (!effective) return `Inherit — ${profile.name} (no usable auth)`;
    const inner = describeResolvedGqlAuth(effective, profiles);
    return inner.startsWith('Inherit') ? inner : `${profile.name}: ${inner}`;
  }

  switch (auth.type) {
    case 'bearer': {
      const t = auth.token?.trim() ?? '';
      return t
        ? `Authorization: Bearer ${t.slice(0, 24)}${t.length > 24 ? '…' : ''}`
        : 'Token not set — no header will be added';
    }
    case 'basic': {
      const u = auth.username?.trim() ?? '';
      return u
        ? `Authorization: Basic ${safeBtoaMask(`${u}:${auth.password ?? ''}`)}`
        : 'Username not set — no header will be added';
    }
    case 'apiKey': {
      const n = auth.headerName?.trim() ?? '';
      const v = auth.headerValue ?? '';
      if (!n) return 'Header name not set — no header will be added';
      return `${n}: ${v ? mask(v) : '(empty value)'}`;
    }
    case 'oauth2':
      return auth.oauth2?.tokenUrl
        ? `Authorization: Bearer <token from ${auth.oauth2.tokenUrl}>`
        : 'OAuth 2.0 token injection is a Phase 3 feature';
    case 'custom':
      return 'Custom headers added via the Headers panel';
    default:
      return 'No authentication headers will be added';
  }
}

export type GqlAuthSentSource = 'page' | 'tab' | 'profile';

export interface AuthSentMetadata {
  source: GqlAuthSentSource;
  sourceLabel: string;
  lines: string[];
}

export function authSentSourceLabel(source: GqlAuthSentSource): string {
  switch (source) {
    case 'page':
      return 'from page default';
    case 'tab':
      return 'tab override';
    case 'profile':
      return 'from connection profile';
  }
}

function maskAuthValue(value: string): string {
  if (value.length <= 8) return '••••';
  return `${value.slice(0, Math.min(12, value.length))}-••••`;
}

function formatAuthorizationForDisplay(value: string): string {
  const trimmed = value.trim();
  if (/^bearer /i.test(trimmed)) {
    const token = trimmed.replace(/^bearer /i, '').trim();
    return token
      ? `Authorization: Bearer ${maskAuthValue(token)}`
      : 'Authorization: Bearer (empty)';
  }
  if (/^basic /i.test(trimmed)) {
    return 'Authorization: Basic ••••';
  }
  return `Authorization: ${maskAuthValue(trimmed)}`;
}

function findHeaderValue(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

/** Masked auth line derived from stored/effective auth when request headers omit auth keys. */
function describeEffectiveAuthSentLine(
  storedAuth: GraphqlAuth | null | undefined,
  globalAuthProfiles: GlobalAuthProfile[],
): string | null {
  const effective = resolveEffectiveGqlAuth(storedAuth, globalAuthProfiles);
  if (!effective) return null;

  switch (effective.type) {
    case 'bearer': {
      const token = effective.token?.trim() ?? '';
      return token ? formatAuthorizationForDisplay(`Bearer ${token}`) : null;
    }
    case 'basic': {
      const user = effective.username?.trim() ?? '';
      return user ? 'Authorization: Basic ••••' : null;
    }
    case 'apiKey': {
      const name = effective.headerName?.trim() ?? '';
      const value = effective.headerValue ?? '';
      if (!name) return null;
      return `${name}: ${value ? mask(value) : '(empty value)'}`;
    }
    default:
      return null;
  }
}

function extractAuthDisplayLines(
  storedAuth: GraphqlAuth | null | undefined,
  globalAuthProfiles: GlobalAuthProfile[],
  requestHeaders?: Record<string, string>,
): string[] {
  const effective = resolveEffectiveGqlAuth(storedAuth, globalAuthProfiles);
  const lines: string[] = [];

  const authorization = findHeaderValue(requestHeaders, 'Authorization');
  if (authorization) {
    lines.push(formatAuthorizationForDisplay(authorization));
  }

  if (effective?.type === 'apiKey' && effective.headerName?.trim()) {
    const name = effective.headerName.trim();
    const raw = findHeaderValue(requestHeaders, name);
    if (raw !== undefined && !lines.some((line) => line.startsWith(`${name}:`))) {
      lines.push(`${name}: ${raw ? mask(raw) : '(empty value)'}`);
    }
  }

  if (lines.length > 0) return lines;

  const fallback = describeEffectiveAuthSentLine(storedAuth, globalAuthProfiles);
  return fallback ? [fallback] : [];
}

/**
 * Phase 6H — masked auth-sent summary for the response Metadata tab.
 * Prefer actual outgoing request headers when available; fall back to stored auth preview.
 */
export function describeAuthSentMetadata(
  storedAuth: GraphqlAuth | null | undefined,
  source: GqlAuthSentSource,
  globalAuthProfiles: GlobalAuthProfile[] = [],
  requestHeaders?: Record<string, string>,
): AuthSentMetadata {
  return {
    source,
    sourceLabel: authSentSourceLabel(source),
    lines: extractAuthDisplayLines(storedAuth, globalAuthProfiles, requestHeaders),
  };
}

/** Profile name for inherit auth badge label, when bound. */
export function inheritAuthProfileLabel(
  auth: GraphqlAuth | null | undefined,
  profiles: GlobalAuthProfile[],
): string | null {
  if (auth?.type !== 'inherit' || !auth.globalProfileId) return null;
  return profiles.find((p) => p.id === auth.globalProfileId)?.name ?? null;
}
