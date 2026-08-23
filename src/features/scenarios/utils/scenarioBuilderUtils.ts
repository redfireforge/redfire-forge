import type { AuthType, Scenario, TestScenario, FeatureGroup, GlobalAuthProfile } from '@shared/types';

export const SCENARIO_AUTH_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'inherit', label: 'Inherit from Feature' },
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'apikey', label: 'API Key' },
  { value: 'digest', label: 'Digest Auth' },
  { value: 'oauth2', label: 'OAuth2 Client Credentials' },
];

export function buildFeatureAuthTypeOptions(
  allAuthProfiles: GlobalAuthProfile[]
): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  if (allAuthProfiles.length > 0) {
    opts.push({ value: 'inherit', label: 'Inherit from Auth Profile' });
  }
  opts.push(
    { value: 'none', label: 'No Auth' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'apikey', label: 'API Key' },
    { value: 'digest', label: 'Digest Auth' },
    { value: 'oauth2', label: 'OAuth2 Client Credentials' },
  );
  return opts;
}

export function resolveEffectiveAuth(
  t: Scenario,
  sc: TestScenario,
  fg: FeatureGroup,
  allAuthProfiles: GlobalAuthProfile[]
): { label: string; source: string } | null {
  const tAuth = t.auth || { type: 'none' as AuthType };
  if (tAuth.type !== 'none' && tAuth.type !== 'inherit') {
    return { label: tAuth.type, source: 'own' };
  }
  const scAuth = sc.auth || { type: 'none' as AuthType };
  if (scAuth.type !== 'none' && scAuth.type !== 'inherit') {
    return { label: scAuth.type, source: 'scenario' };
  }
  const fgAuth = fg.auth;
  if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') {
    return { label: fgAuth.type, source: 'feature' };
  }
  if (fgAuth?.type === 'inherit' && fg.globalAuthProfileId) {
    const p = allAuthProfiles.find((gp) => gp.id === fg.globalAuthProfileId);
    return p ? { label: `${p.auth.type} (${p.name})`, source: 'global' } : { label: 'global (missing)', source: 'global' };
  }
  return null;
}
