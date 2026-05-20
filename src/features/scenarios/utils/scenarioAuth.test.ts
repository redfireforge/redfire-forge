import { describe, it, expect } from 'vitest';
import { buildScenarioInheritHint, resolveScenarioInheritedAuth } from './scenarioAuth';
import { AuthConfig, FeatureGroup, GlobalAuthProfile } from '../../../shared/types';

function makeFg(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg1',
    name: 'Test FG',
    scenarios: [],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<GlobalAuthProfile> = {}): GlobalAuthProfile {
  return {
    id: 'prof1',
    name: 'My Profile',
    auth: { type: 'bearer', token: 'abc' },
    ...overrides,
  } as GlobalAuthProfile;
}

describe('buildScenarioInheritHint', () => {
  it('returns no-auth message when feature has no auth', () => {
    const hint = buildScenarioInheritHint(makeFg(), []);
    expect(hint).toContain('No auth configured');
  });

  it('returns no-auth message when auth type is none', () => {
    const hint = buildScenarioInheritHint(makeFg({ auth: { type: 'none' } }), []);
    expect(hint).toContain('No auth configured');
  });

  it('returns feature-level hint for direct auth', () => {
    const hint = buildScenarioInheritHint(makeFg({ auth: { type: 'bearer', token: 'x' } }), []);
    expect(hint).toContain('feature-level');
    expect(hint).toContain('Bearer Token');
  });

  it('returns global profile hint when inherit + profile found', () => {
    const profile = makeProfile();
    const fg = makeFg({ auth: { type: 'inherit' }, globalAuthProfileId: 'prof1' });
    const hint = buildScenarioInheritHint(fg, [profile]);
    expect(hint).toContain('My Profile');
    expect(hint).toContain('Bearer Token');
  });

  it('returns missing profile hint when inherit + profile not found', () => {
    const fg = makeFg({ auth: { type: 'inherit' }, globalAuthProfileId: 'missing' });
    const hint = buildScenarioInheritHint(fg, []);
    expect(hint).toContain('missing global profile');
  });

  it('handles unknown auth type with fallback', () => {
    const hint = buildScenarioInheritHint(makeFg({ auth: { type: 'custom' } as unknown as AuthConfig }), []);
    expect(hint).toContain('feature-level');
    expect(hint).toContain('custom');
  });
});

describe('resolveScenarioInheritedAuth', () => {
  it('returns null when no auth', () => {
    expect(resolveScenarioInheritedAuth(makeFg(), [])).toBeNull();
  });

  it('returns null when auth type is none', () => {
    expect(resolveScenarioInheritedAuth(makeFg({ auth: { type: 'none' } }), [])).toBeNull();
  });

  it('returns feature auth directly for non-inherit types', () => {
    const auth = { type: 'bearer' as const, token: 'x' };
    const result = resolveScenarioInheritedAuth(makeFg({ auth }), []);
    expect(result).toEqual({ auth, label: 'feature' });
  });

  it('resolves global profile for inherit type', () => {
    const profile = makeProfile();
    const fg = makeFg({ auth: { type: 'inherit' }, globalAuthProfileId: 'prof1' });
    const result = resolveScenarioInheritedAuth(fg, [profile]);
    expect(result?.auth).toEqual(profile.auth);
    expect(result?.label).toBe('My Profile');
  });

  it('returns null when inherit but profile not found', () => {
    const fg = makeFg({ auth: { type: 'inherit' }, globalAuthProfileId: 'missing' });
    expect(resolveScenarioInheritedAuth(fg, [])).toBeNull();
  });

  it('returns null when resolved auth is none', () => {
    const profile: GlobalAuthProfile = { id: 'prof1', name: 'None Prof', auth: { type: 'none' } };
    const fg = makeFg({ auth: { type: 'inherit' }, globalAuthProfileId: 'prof1' });
    expect(resolveScenarioInheritedAuth(fg, [profile])).toBeNull();
  });
});
