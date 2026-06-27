/**
 * Phase 6F/6H — single source of truth for per-tab connection resolution.
 * Endpoint, auth, TLS, and polling inherit from tab → profile → page defaults.
 */
import type { GraphqlAuth } from '../../../shared/types/graphql';
import { buildTabTlsSettings, type GqlTlsSettings } from '../../../shared/types/gqlTls';
import type { ConnectionProfile } from './connectionProfileStorage';
import type { GqlStudioTab } from './tabPersistence';
import { normalizeGraphqlEndpoint } from './graphqlEndpointUtils';
import type { GqlAuthSentSource } from './gqlAuthResolve';

export type { GqlAuthSentSource } from './gqlAuthResolve';

export interface TabConnectionPageDefaults {
  endpoint: string;
  auth: GraphqlAuth | null;
  skipTlsVerify: boolean;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
}

export interface TabConnectionResolution {
  /** Raw endpoint before env {{var}} substitution. */
  endpoint: string;
  connectionId: string | undefined;
  profileName: string | undefined;
  auth: GraphqlAuth | null;
  skipTlsVerify: boolean;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
  pollingIntervalMs: number;
}

export function findProfileById(
  profiles: ConnectionProfile[],
  connectionId: string | undefined,
): ConnectionProfile | undefined {
  if (!connectionId) return undefined;
  return profiles.find((p) => p.id === connectionId);
}

/** True when tab.connectionId resolves to a profile in the catalog (Phase 6F). */
export function isTabProfileLinked(
  tab: GqlStudioTab,
  profiles: ConnectionProfile[],
): boolean {
  return findProfileById(profiles, tab.connectionId) !== undefined;
}

/** True when tab references a profile that is not yet available in the catalog (Phase 6F). */
export function isTabProfileLinkPending(
  tab: GqlStudioTab,
  profiles: ConnectionProfile[],
): boolean {
  return Boolean(tab.connectionId && !isTabProfileLinked(tab, profiles));
}

/** Raw endpoint for a tab before env-variable resolution. Phase 6F. */
export function resolveTabRawEndpoint(
  tab: GqlStudioTab,
  profiles: ConnectionProfile[],
  pageDefaultEndpoint: string,
): string {
  if (tab.endpoint !== undefined) return tab.endpoint.trim();
  const profile = findProfileById(profiles, tab.connectionId);
  if (profile?.endpoint.trim()) return profile.endpoint.trim();
  return pageDefaultEndpoint;
}

/**
 * Endpoint used for auto tab labels — env-resolved page default when the tab
 * inherits the page URL (no per-tab override or profile endpoint).
 */
export function resolveTabLabelEndpoint(
  tab: GqlStudioTab,
  profiles: ConnectionProfile[],
  pageDefaultEndpoint: string,
  pageDefaultEndpointResolved?: string,
): string {
  if (tab.endpoint?.trim()) {
    return normalizeGraphqlEndpoint(tab.endpoint);
  }
  const profile = findProfileById(profiles, tab.connectionId);
  if (profile?.endpoint.trim()) {
    return normalizeGraphqlEndpoint(profile.endpoint);
  }
  return normalizeGraphqlEndpoint(
    pageDefaultEndpointResolved?.trim()
      ? pageDefaultEndpointResolved
      : pageDefaultEndpoint,
  );
}

/** True when tab stores its own auth layer (including explicit No Auth via `null`). Phase 6H. */
export function isTabAuthOverridden(tab: GqlStudioTab): boolean {
  return resolveTabAuthLayer(tab) !== undefined;
}

/**
 * Tab auth layer before profile/page fallthrough.
 * - `undefined` → inherit workspace (includes `{ type: 'inherit' }` without globalProfileId)
 * - `null` → explicit No Auth override
 * - object → explicit override (bearer, inherit+globalProfileId, etc.)
 */
export function resolveTabAuthLayer(tab: GqlStudioTab): GraphqlAuth | null | undefined {
  if (tab.auth === undefined) return undefined;
  if (tab.auth === null) return null;
  if (tab.auth.type === 'inherit' && !tab.auth.globalProfileId?.trim()) {
    return undefined;
  }
  return tab.auth;
}

/**
 * Profile auth contribution when the tab has no auth layer.
 * Bare `{ type: 'inherit' }` on a profile falls through to page default (Phase 6H).
 */
export function resolveProfileAuthContribution(
  profile: ConnectionProfile | undefined,
  pageDefaultAuth: GraphqlAuth | null,
): GraphqlAuth | null {
  if (profile === undefined) return pageDefaultAuth;
  if (profile.auth === undefined) return pageDefaultAuth;
  if (profile.auth === null) return null;
  if (profile.auth.type === 'inherit' && !profile.auth.globalProfileId?.trim()) {
    return pageDefaultAuth;
  }
  return profile.auth;
}

/**
 * Phase 6H — auth resolution: tab layer → linked profile → page default.
 * Returns stored GraphqlAuth (including `{ type: 'inherit', globalProfileId }`);
 * header building resolves inherit/global profiles at execution via `resolveEffectiveGqlAuth`.
 */
export function resolveTabAuth(
  tab: GqlStudioTab,
  profile: ConnectionProfile | undefined,
  pageDefaultAuth: GraphqlAuth | null,
): GraphqlAuth | null {
  const layer = resolveTabAuthLayer(tab);
  if (layer !== undefined) {
    return layer;
  }
  return resolveProfileAuthContribution(profile, pageDefaultAuth);
}

/**
 * Phase 6H — labels where credentials came from for response Metadata "auth sent" row.
 * Tab override wins; otherwise profile explicit auth; otherwise page default.
 */
export function resolveTabAuthSentSource(
  tab: GqlStudioTab,
  profile: ConnectionProfile | undefined,
  _pageDefaultAuth: GraphqlAuth | null,
): GqlAuthSentSource {
  if (isTabAuthOverridden(tab)) return 'tab';
  if (profile?.auth !== undefined) {
    if (profile.auth === null) return 'profile';
    if (profile.auth.type === 'inherit' && !profile.auth.globalProfileId?.trim()) {
      return 'page';
    }
    return 'profile';
  }
  return 'page';
}

export function resolveTabConnection(
  tab: GqlStudioTab,
  profiles: ConnectionProfile[],
  pageDefaults: TabConnectionPageDefaults,
): TabConnectionResolution {
  const profile = findProfileById(profiles, tab.connectionId);
  const linked = profile !== undefined;
  const endpoint = resolveTabRawEndpoint(tab, profiles, pageDefaults.endpoint);
  const auth = resolveTabAuth(tab, profile, pageDefaults.auth);
  const skipTlsVerify = tab.skipTlsVerify ?? pageDefaults.skipTlsVerify;
  const pollingEnabled = tab.pollingEnabled ?? pageDefaults.pollingEnabled;
  const pollingIntervalSeconds = tab.pollingIntervalSeconds ?? pageDefaults.pollingIntervalSeconds;
  const pollingIntervalMs = pollingEnabled ? pollingIntervalSeconds * 1000 : 0;

  return {
    endpoint,
    connectionId: linked ? tab.connectionId : undefined,
    profileName: linked ? profile.name : undefined,
    auth,
    skipTlsVerify,
    tlsCaCert: tab.tlsCaCert ?? pageDefaults.tlsCaCert,
    tlsClientCert: tab.tlsClientCert ?? pageDefaults.tlsClientCert,
    tlsClientKey: tab.tlsClientKey ?? pageDefaults.tlsClientKey,
    pollingEnabled,
    pollingIntervalSeconds,
    pollingIntervalMs,
  };
}

export function tabConnectionTls(resolution: TabConnectionResolution): GqlTlsSettings {
  return buildTabTlsSettings(resolution);
}
