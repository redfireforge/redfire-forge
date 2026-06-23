/**
 * Phase 6H Slice 3 — map stored auth layers ↔ popover type selector values.
 */
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GraphqlAuth } from '../../../shared/types/graphql';

export const AUTH_TYPE_NONE = 'none' as const;
export const AUTH_TYPE_INHERIT_WORKSPACE = 'inherit-workspace' as const;

export type GqlAuthPopoverSelectableType =
  | GraphqlAuth['type']
  | typeof AUTH_TYPE_NONE
  | typeof AUTH_TYPE_INHERIT_WORKSPACE;

export type GqlAuthPopoverScope = 'page' | 'tab';

/** Maps persisted stored auth to the popover type dropdown value. */
export function storedAuthToPopoverType(
  storedAuth: GraphqlAuth | null | undefined,
  authScope: GqlAuthPopoverScope,
): GqlAuthPopoverSelectableType {
  if (storedAuth === undefined) {
    return authScope === 'tab' ? AUTH_TYPE_INHERIT_WORKSPACE : AUTH_TYPE_NONE;
  }
  if (storedAuth === null) return AUTH_TYPE_NONE;
  if (storedAuth.type === 'inherit') {
    return storedAuth.globalProfileId?.trim() ? 'inherit' : AUTH_TYPE_INHERIT_WORKSPACE;
  }
  return storedAuth.type;
}

export function buildAuthTypeOptions(
  profiles: GlobalAuthProfile[],
  authScope: GqlAuthPopoverScope,
): Array<{ value: GqlAuthPopoverSelectableType; label: string; disabled?: boolean }> {
  const opts: Array<{ value: GqlAuthPopoverSelectableType; label: string; disabled?: boolean }> = [];
  if (authScope === 'tab') {
    opts.push({ value: AUTH_TYPE_INHERIT_WORKSPACE, label: 'Inherit workspace default' });
  }
  if (profiles.length > 0) {
    opts.push({ value: 'inherit', label: 'Inherit from Auth Profile' });
  }
  opts.push(
    { value: AUTH_TYPE_NONE, label: 'No Auth' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'apiKey', label: 'API Key' },
    { value: 'oauth2', label: 'OAuth 2.0 (Phase 3 — coming soon)', disabled: true },
    { value: 'custom', label: 'Custom (Headers Panel)' },
  );
  return opts;
}

/** True when the tab stores its own auth layer (popover shows reset control). */
export function popoverShowsAuthOverride(
  storedAuth: GraphqlAuth | null | undefined,
  authScope: GqlAuthPopoverScope,
): boolean {
  if (authScope !== 'tab') return false;
  if (storedAuth === undefined) return false;
  if (storedAuth === null) return true;
  if (storedAuth.type === 'inherit' && !storedAuth.globalProfileId?.trim()) return false;
  return true;
}
