import type { AuthConfig, FeatureGroup, GlobalAuthProfile } from '../../../shared/types';

const AUTH_LABEL: Record<string, string> = {
  basic: 'Basic Auth', bearer: 'Bearer Token', apikey: 'API Key',
  digest: 'Digest Auth', oauth2: 'OAuth2 Client Credentials',
};

export function buildScenarioInheritHint(fg: FeatureGroup, allAuthProfiles: GlobalAuthProfile[]): string {
  const fgAuth = fg.auth;
  if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') {
    return `Will use feature-level ${AUTH_LABEL[fgAuth.type] ?? fgAuth.type}`;
  }
  if (fgAuth?.type === 'inherit' && fg.globalAuthProfileId) {
    const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
    return profile
      ? `Will use global profile "${profile.name}" (${AUTH_LABEL[profile.auth.type] ?? profile.auth.type})`
      : 'Feature references a missing global profile.';
  }
  return 'No auth configured at feature level. Configure it via the "Auth" button on the feature group.';
}

export function resolveScenarioInheritedAuth(
  fg: FeatureGroup,
  allAuthProfiles: GlobalAuthProfile[],
): { auth: AuthConfig; label: string } | null {
  const fgAuth = fg.auth;
  if (!fgAuth || fgAuth.type === 'none') return null;
  let resolvedAuth: AuthConfig = fgAuth;
  let resolvedLabel = 'feature';
  if (fgAuth.type === 'inherit' && fg.globalAuthProfileId) {
    const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
    if (!profile) return null;
    resolvedAuth = profile.auth;
    resolvedLabel = profile.name;
  }
  if (resolvedAuth.type === 'none' || resolvedAuth.type === 'inherit') return null;
  return { auth: resolvedAuth, label: resolvedLabel };
}
