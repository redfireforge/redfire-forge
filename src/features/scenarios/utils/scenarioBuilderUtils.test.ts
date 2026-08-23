import { describe, it, expect } from 'vitest';
import type { Scenario, TestScenario, FeatureGroup, GlobalAuthProfile, AuthConfig } from '@shared/types';
import {
  SCENARIO_AUTH_TYPE_OPTIONS,
  buildFeatureAuthTypeOptions,
  resolveEffectiveAuth,
} from './scenarioBuilderUtils';
import { makeScenario as _makeScenario, makeTestScenario as _makeTestScenario } from '@test-utils/factories';

function auth(type: AuthConfig['type']): AuthConfig {
  return { type } as AuthConfig;
}

function makeTest(t: AuthConfig['type']): Scenario {
  return _makeScenario({ id: 't', name: 'T', url: '', auth: auth(t) }) as Scenario;
}
function makeScenario(t: AuthConfig['type']): TestScenario {
  return _makeTestScenario({ id: 'sc', name: 'SC', tests: [], auth: auth(t) }) as unknown as TestScenario;
}
function makeFg(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return { id: 'fg', name: 'FG', scenarios: [], ...overrides } as FeatureGroup;
}

describe('scenarioBuilderUtils', () => {
  it('exposes a fixed scenario auth-type option list', () => {
    expect(SCENARIO_AUTH_TYPE_OPTIONS[0]).toEqual({ value: 'inherit', label: 'Inherit from Feature' });
    expect(SCENARIO_AUTH_TYPE_OPTIONS).toHaveLength(7);
  });

  describe('buildFeatureAuthTypeOptions', () => {
    it('omits inherit when no profiles exist', () => {
      const opts = buildFeatureAuthTypeOptions([]);
      expect(opts.some((o) => o.value === 'inherit')).toBe(false);
      expect(opts).toHaveLength(6);
    });

    it('prepends inherit when profiles exist', () => {
      const opts = buildFeatureAuthTypeOptions([{ id: 'p', name: 'P', auth: auth('bearer') } as GlobalAuthProfile]);
      expect(opts[0]).toEqual({ value: 'inherit', label: 'Inherit from Auth Profile' });
      expect(opts).toHaveLength(7);
    });
  });

  describe('resolveEffectiveAuth', () => {
    it('returns the test own auth when explicit', () => {
      const r = resolveEffectiveAuth(makeTest('bearer'), makeScenario('none'), makeFg(), []);
      expect(r).toEqual({ label: 'bearer', source: 'own' });
    });

    it('falls through to scenario auth', () => {
      const r = resolveEffectiveAuth(makeTest('inherit'), makeScenario('basic'), makeFg(), []);
      expect(r).toEqual({ label: 'basic', source: 'scenario' });
    });

    it('falls through to feature auth', () => {
      const r = resolveEffectiveAuth(makeTest('none'), makeScenario('inherit'), makeFg({ auth: auth('apikey') }), []);
      expect(r).toEqual({ label: 'apikey', source: 'feature' });
    });

    it('resolves a global auth profile when feature inherits', () => {
      const fg = makeFg({ auth: auth('inherit'), globalAuthProfileId: 'gp1' });
      const profiles = [{ id: 'gp1', name: 'Prod', auth: auth('oauth2') } as GlobalAuthProfile];
      const r = resolveEffectiveAuth(makeTest('none'), makeScenario('none'), fg, profiles);
      expect(r).toEqual({ label: 'oauth2 (Prod)', source: 'global' });
    });

    it('flags a missing global profile', () => {
      const fg = makeFg({ auth: auth('inherit'), globalAuthProfileId: 'missing' });
      const r = resolveEffectiveAuth(makeTest('none'), makeScenario('none'), fg, []);
      expect(r).toEqual({ label: 'global (missing)', source: 'global' });
    });

    it('returns null when nothing resolves', () => {
      const r = resolveEffectiveAuth(makeTest('none'), makeScenario('none'), makeFg(), []);
      expect(r).toBeNull();
    });

    it('handles a scenario with no auth set', () => {
      const sc = { id: 'sc', name: 'SC', tests: [] } as unknown as TestScenario;
      const r = resolveEffectiveAuth(makeTest('none'), sc, makeFg(), []);
      expect(r).toBeNull();
    });
  });
});
