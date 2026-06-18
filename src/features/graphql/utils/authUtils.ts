/**
 * authUtils.ts — Phase 1D
 *
 * Pure utilities for converting a GraphqlAuth config into HTTP request headers.
 * No React dependency — safe to call from any context.
 */

import type { GraphqlAuth } from '../../../shared/types/graphql';

/**
 * Converts a GraphqlAuth config into a headers object suitable for merging
 * into the HTTP request headers before execution.
 *
 * User-defined per-tab headers take precedence over auth headers — callers must
 * spread auth headers FIRST then spread user headers on top.
 *
 * @example
 *   const finalHeaders = { ...buildAuthHeaders(auth), ...userHeaders };
 */
export function buildAuthHeaders(auth: GraphqlAuth | null | undefined): Record<string, string> {
  if (!auth) return {};
  switch (auth.type) {
    case 'bearer':
      return auth.token?.trim()
        ? { Authorization: `Bearer ${auth.token.trim()}` }
        : {};

    case 'basic': {
      const user = auth.username?.trim() ?? '';
      const pass = auth.password ?? '';
      if (!user) return {};
      // BUG-GQL-R7-4 fix: btoa() throws InvalidCharacterError for non-ASCII characters
      // (e.g. accented letters, CJK, Cyrillic in usernames/passwords).
      // encodeURIComponent → unescape converts to a safe Latin-1 byte string first.
      const credentials = `${user}:${pass}`;
      const encoded = btoa(unescape(encodeURIComponent(credentials)));
      return { Authorization: `Basic ${encoded}` };
    }

    case 'apiKey': {
      const name = auth.headerName?.trim();
      const val  = auth.headerValue ?? '';
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
 * Returns a short display label for the given auth type.
 * Used in the auth badge in the connection bar.
 */
export function authBadgeLabel(auth: GraphqlAuth | null | undefined): string {
  if (!auth) return 'No Auth';
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
export function isAuthConfigured(auth: GraphqlAuth | null | undefined): boolean {
  if (!auth) return false;
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
