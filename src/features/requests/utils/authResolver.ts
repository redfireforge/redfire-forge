import type { AuthConfig, FeatureGroup, GlobalAuthProfile, Scenario, TestScenario } from '../../../shared/types';

/**
 * Walks the auth inheritance chain:
 *   Test → Scenario → Feature Group → Global Auth Profile → Env Auth → { type: 'none' }
 *
 * envFallbackAuth: resolved from Microservice.authProfileIds[envId] in the Environment config.
 */
export function resolveAuth(
  test: Scenario,
  scenario: Pick<TestScenario, 'auth'>,
  featureGroup: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'>,
  globalAuthProfiles: Pick<GlobalAuthProfile, 'id' | 'auth'>[],
  envFallbackAuth?: AuthConfig,
): AuthConfig {
  if (test.auth.type !== 'inherit' && test.auth.type !== 'none') return test.auth;

  const scAuth = scenario.auth;
  if (scAuth && scAuth.type !== 'none' && scAuth.type !== 'inherit') return scAuth as AuthConfig;

  const fgAuth = featureGroup.auth;
  if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') return fgAuth as AuthConfig;

  if (featureGroup.globalAuthProfileId) {
    const profile = globalAuthProfiles.find((p) => p.id === featureGroup.globalAuthProfileId);
    if (profile && profile.auth.type !== 'none') return profile.auth;
  }

  if (envFallbackAuth && envFallbackAuth.type !== 'none') return envFallbackAuth;

  return { type: 'none' };
}
