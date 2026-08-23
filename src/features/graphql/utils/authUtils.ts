/**
 * authUtils.ts — Phase 1D
 *
 * Pure utilities for converting a GraphqlAuth config into HTTP request headers.
 * No React dependency — safe to call from any context.
 */

import type { GlobalAuthProfile } from '@shared/types';
import type { GraphqlAuth } from '@shared/types/graphql';
import type { ConnectionProfile } from './connectionProfileStorage';
import type { GqlStudioTab } from './tabPersistence';
import {
  isTabAuthOverridden,
  isTabProfileLinked,
  resolveTabAuthLayer,
} from './tabConnectionResolution';
import { resolveEffectiveGqlAuth, inheritAuthProfileLabel } from './gqlAuthResolve';

/**
 * Converts a GraphqlAuth config into a headers object suitable for merging
 * into the HTTP request headers before execution.
 *
 * When `globalAuthProfiles` is supplied, `type: 'inherit'` auth is resolved
 * from the bound GlobalAuthProfile before building headers.
 *
 * User-defined per-tab headers take precedence over auth headers — callers must
 * spread auth headers FIRST then spread user headers on top.
 *
 * @example
 *   const finalHeaders = { ...buildAuthHeaders(auth, profiles), ...userHeaders };
 */
export function buildAuthHeaders(
  auth: GraphqlAuth | null | undefined,
  globalAuthProfiles: GlobalAuthProfile[] = [],
): Record<string, string> {
  const effective = resolveEffectiveGqlAuth(auth, globalAuthProfiles);
  if (!effective) return {};
  switch (effective.type) {
    case 'bearer':
      return effective.token?.trim()
        ? { Authorization: `Bearer ${effective.token.trim()}` }
        : {};

    case 'basic': {
      const user = effective.username?.trim() ?? '';
      const pass = effective.password ?? '';
      if (!user) return {};
      // BUG-GQL-R7-4 fix: btoa() throws InvalidCharacterError for non-ASCII characters
      // (e.g. accented letters, CJK, Cyrillic in usernames/passwords).
      // encodeURIComponent → unescape converts to a safe Latin-1 byte string first.
      const credentials = `${user}:${pass}`;
      const encoded = btoa(unescape(encodeURIComponent(credentials)));
      return { Authorization: `Basic ${encoded}` };
    }

    case 'apiKey': {
      const name = effective.headerName?.trim();
      const val  = effective.headerValue ?? '';
      if (!name) return {};
      return { [name]: val };
    }

    case 'oauth2':
    case 'custom':
    default:
      // OAuth2 tokens are injected via pre-request scripts (Phase 3).
      // Custom auth uses the Headers panel directly.
      return {};
  }
}

/**
 * Phase 6F — overwrite auth header keys with profile-scoped auth for a tab's execution layer.
 * Preserves non-auth custom headers already in the map.
 */
export function stampAuthHeaders(
  headers: Record<string, string> | undefined,
  auth: GraphqlAuth | null | undefined,
  globalAuthProfiles: GlobalAuthProfile[] = [],
): Record<string, string> {
  const authHeaders = buildAuthHeaders(auth, globalAuthProfiles);
  if (Object.keys(authHeaders).length === 0) {
    return { ...(headers ?? {}) };
  }
  const merged = { ...(headers ?? {}) };
  delete merged.Authorization;
  for (const [k, v] of Object.entries(authHeaders)) {
    merged[k] = v;
  }
  return merged;
}

/**
 * Returns a short display label for the given auth type.
 * Used in the auth badge in the connection bar.
 */
export function authBadgeLabel(
  auth: GraphqlAuth | null | undefined,
  globalAuthProfiles: GlobalAuthProfile[] = [],
): string {
  if (!auth) return 'No Auth';
  if (auth.type === 'inherit') {
    const name = inheritAuthProfileLabel(auth, globalAuthProfiles);
    return name ? `Inherit (${name})` : 'Inherit';
  }
  switch (auth.type) {
    case 'bearer':  return 'Bearer';
    case 'basic':   return 'Basic';
    case 'apiKey':  return 'API Key';
    case 'oauth2':  return 'OAuth 2.0';
    case 'custom':  return 'Custom';
    default:        return 'No Auth';
  }
}

/**
 * Returns true if the auth config is non-empty (i.e. will inject at least one header)
 * OR if the user has explicitly selected a non-default auth type (oauth2 / custom).
 * Used to decide whether to show the "configured" visual accent on the badge.
 *
 * BUG-GQL-R7-5 fix: oauth2 and custom were returning false, so the badge stayed gray —
 * indistinguishable from "No Auth". A user who explicitly chose OAuth 2.0 was confused
 * because their selection appeared to have no effect on the badge. Now both types show
 * the blue "configured" accent to confirm the selection was registered.
 */
export function isAuthConfigured(
  auth: GraphqlAuth | null | undefined,
  globalAuthProfiles: GlobalAuthProfile[] = [],
): boolean {
  if (!auth) return false;
  if (auth.type === 'inherit') {
    return Boolean(auth.globalProfileId) || globalAuthProfiles.length > 0;
  }
  switch (auth.type) {
    case 'bearer':  return Boolean(auth.token?.trim());
    case 'basic':   return Boolean(auth.username?.trim());
    // BUG-R3-4 fix: only require headerName — an empty value may be intentional for some APIs
    case 'apiKey':  return Boolean(auth.headerName?.trim());
    // oauth2 and custom: user explicitly chose a type — show as configured so the badge
    // turns blue (the user knows they selected it, even though headers aren't auto-injected here).
    case 'oauth2':
    case 'custom':  return true;
    default:        return false;
  }
}

// ─── Phase 6H Slice 4 — badge + tab strip presentation ───────────────────────

export type GqlAuthBadgeVariant = 'inherit' | 'override' | 'profile' | 'default';

export type GqlAuthBadgeScope = 'page' | 'tab' | 'profile';

export interface GqlAuthBadgePresentation {
  label: string;
  variant: GqlAuthBadgeVariant;
  /** Scope pill on the connection-bar badge; null when not useful (single inheriting tab). */
  scope: GqlAuthBadgeScope | null;
  configured: boolean;
}

export type GqlTabAuthDotKind = 'inherit' | 'profile' | 'override' | 'none';

function resolvedAuthInheritSuffix(
  auth: GraphqlAuth | null,
  globalAuthProfiles: GlobalAuthProfile[],
): string {
  if (!auth) return 'No Auth';
  if (auth.type === 'inherit') {
    return inheritAuthProfileLabel(auth, globalAuthProfiles) ?? 'Profile';
  }
  return authBadgeLabel(auth, globalAuthProfiles);
}

/**
 * Connection-bar auth badge: resolved label + visual variant + optional scope pill.
 * Badge always reflects **resolved** credentials; styling reflects inherit vs override vs profile.
 */
export function resolveGqlAuthBadgePresentation(params: {
  resolvedAuth: GraphqlAuth | null;
  hasTabAuthOverride: boolean;
  hasProfileLink: boolean;
  usesPageDefaultAuth: boolean;
  linkedProfileName?: string | null;
  globalAuthProfiles?: GlobalAuthProfile[];
  tabsLength?: number;
}): GqlAuthBadgePresentation {
  const {
    resolvedAuth,
    hasTabAuthOverride,
    hasProfileLink,
    usesPageDefaultAuth,
    linkedProfileName = null,
    globalAuthProfiles = [],
    tabsLength = 1,
  } = params;

  const configured = isAuthConfigured(resolvedAuth, globalAuthProfiles);

  let variant: GqlAuthBadgeVariant;
  let scope: GqlAuthBadgeScope;

  if (hasTabAuthOverride) {
    variant = 'override';
    scope = 'tab';
  } else if (hasProfileLink) {
    variant = 'profile';
    scope = 'profile';
  } else if (!usesPageDefaultAuth) {
    variant = 'inherit';
    scope = 'tab';
  } else {
    variant = 'default';
    scope = 'page';
  }

  const showScopePill = tabsLength > 1 || hasProfileLink || hasTabAuthOverride;

  let label: string;
  if (hasTabAuthOverride) {
    label = authBadgeLabel(resolvedAuth, globalAuthProfiles);
  } else if (hasProfileLink && linkedProfileName) {
    label = `Inherit (${linkedProfileName})`;
  } else if ((variant === 'inherit' || variant === 'profile') && !usesPageDefaultAuth) {
    label = `Inherit (${resolvedAuthInheritSuffix(resolvedAuth, globalAuthProfiles)})`;
  } else {
    label = authBadgeLabel(resolvedAuth, globalAuthProfiles);
  }

  return {
    label,
    variant,
    scope: showScopePill ? scope : null,
    // Inherit chain uses dashed styling even when resolved credentials exist.
    configured: variant === 'inherit' ? false : configured,
  };
}

/** Tab-strip auth dot kind — only rendered when multiple tabs are open. */
export function resolveTabAuthDotKind(
  tab: GqlStudioTab,
  profiles: ConnectionProfile[],
  _globalAuthProfiles: GlobalAuthProfile[] = [],
): GqlTabAuthDotKind {
  if (isTabAuthOverridden(tab)) {
    const layer = resolveTabAuthLayer(tab);
    if (layer === null) return 'none';
    // Any explicit tab auth layer (including empty bearer / inherit-global) is an override.
    return 'override';
  }
  if (isTabProfileLinked(tab, profiles)) return 'profile';
  return 'inherit';
}

/**
 * Builds the `connectionParams` payload for a WebSocket `connection_init` frame.
 *
 * Phase 2A-8: The graphql-transport-ws protocol sends an initial `connection_init`
 * message whose `payload` object is forwarded to the server as `connectionParams`.
 * This is the canonical way to pass auth credentials for WS subscriptions (since
 * browser WebSocket cannot send custom headers).
 *
 * The returned object is sent as `{ type: "connection_init", payload: <returned> }`.
 * Returns `{}` (empty object) for no-auth and unimplemented types — the server will
 * ignore empty connectionParams in most configurations.
 *
 * Note: OAuth2 tokens must be pre-fetched before calling this function.
 * The `oauth2` case is intentionally left as empty since token acquisition
 * is handled separately by the execution context (Phase 3+ feature).
 */
export function buildConnectionParams(
  auth: GraphqlAuth | null | undefined,
  globalAuthProfiles: GlobalAuthProfile[] = [],
): Record<string, unknown> {
  const effective = resolveEffectiveGqlAuth(auth, globalAuthProfiles);
  if (!effective) return {};
  switch (effective.type) {
    case 'bearer':
      return effective.token?.trim()
        ? { Authorization: `Bearer ${effective.token.trim()}` }
        : {};

    case 'basic': {
      const user = effective.username?.trim() ?? '';
      const pass = effective.password ?? '';
      if (!user) return {};
      const credentials = `${user}:${pass}`;
      const encoded = btoa(unescape(encodeURIComponent(credentials)));
      return { Authorization: `Basic ${encoded}` };
    }

    case 'apiKey': {
      const name = effective.headerName?.trim();
      const val  = effective.headerValue ?? '';
      if (!name) return {};
      return { [name]: val };
    }

    // OAuth2 tokens must be pre-fetched — pass as Bearer when token is available.
    // Custom auth uses the Headers panel — not injected into connectionParams.
    case 'oauth2':
    // falls through
    case 'custom':
    // falls through
    default:
      return {};
  }
}
