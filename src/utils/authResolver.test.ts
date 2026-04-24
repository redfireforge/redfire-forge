import { describe, it, expect } from 'vitest';
import { resolveAuth } from './authResolver';
import type { Scenario, TestScenario, FeatureGroup, GlobalAuthProfile, AuthConfig } from '../types';

function makeTest(auth: AuthConfig): Scenario {
  return {
    id: 't1', name: 'Test', url: 'http://x', method: 'GET',
    headers: [], body: '', auth, validation: { mode: 'none' },
  };
}

const basicAuth: AuthConfig = { type: 'basic', username: 'u', password: 'p' };
const bearerAuth: AuthConfig = { type: 'bearer', token: 'tok123' };
const oauth2Auth: AuthConfig = { type: 'oauth2', tokenUrl: 'http://tok', clientId: 'c', clientSecret: 's' };
const apiKeyAuth: AuthConfig = { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'val', apiKeyIn: 'header' };

const noAuthScenario: Pick<TestScenario, 'auth'> = { auth: { type: 'none' } };
const inheritScenario: Pick<TestScenario, 'auth'> = { auth: { type: 'inherit' } };
const noAuthFg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = { auth: { type: 'none' } };

const globalProfile: GlobalAuthProfile = { id: 'gp1', name: 'Global OAuth', auth: oauth2Auth };

describe('resolveAuth — auth inheritance chain', () => {
  it('returns test auth when test has explicit auth (not inherit/none)', () => {
    const result = resolveAuth(makeTest(basicAuth), noAuthScenario, noAuthFg, []);
    expect(result).toEqual(basicAuth);
  });

  it('walks up to scenario when test is inherit', () => {
    const sc: Pick<TestScenario, 'auth'> = { auth: bearerAuth };
    const result = resolveAuth(makeTest({ type: 'inherit' }), sc, noAuthFg, []);
    expect(result).toEqual(bearerAuth);
  });

  it('walks up to scenario when test is none', () => {
    const sc: Pick<TestScenario, 'auth'> = { auth: apiKeyAuth };
    const result = resolveAuth(makeTest({ type: 'none' }), sc, noAuthFg, []);
    expect(result).toEqual(apiKeyAuth);
  });

  it('walks up to feature group when scenario is none', () => {
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = { auth: basicAuth };
    const result = resolveAuth(makeTest({ type: 'inherit' }), noAuthScenario, fg, []);
    expect(result).toEqual(basicAuth);
  });

  it('walks up to feature group when scenario is inherit', () => {
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = { auth: bearerAuth };
    const result = resolveAuth(makeTest({ type: 'inherit' }), inheritScenario, fg, []);
    expect(result).toEqual(bearerAuth);
  });

  it('walks up to global auth profile when feature group points to one', () => {
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = {
      auth: { type: 'none' },
      globalAuthProfileId: 'gp1',
    };
    const result = resolveAuth(makeTest({ type: 'inherit' }), noAuthScenario, fg, [globalProfile]);
    expect(result).toEqual(oauth2Auth);
  });

  it('returns none when global profile referenced but not found', () => {
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = {
      auth: { type: 'none' },
      globalAuthProfileId: 'missing',
    };
    const result = resolveAuth(makeTest({ type: 'inherit' }), noAuthScenario, fg, [globalProfile]);
    expect(result).toEqual({ type: 'none' });
  });

  it('returns none when global profile auth is none', () => {
    const noneProfile: GlobalAuthProfile = { id: 'gp2', name: 'None Profile', auth: { type: 'none' } };
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = {
      auth: { type: 'none' },
      globalAuthProfileId: 'gp2',
    };
    const result = resolveAuth(makeTest({ type: 'inherit' }), noAuthScenario, fg, [noneProfile]);
    expect(result).toEqual({ type: 'none' });
  });

  it('returns none when entire chain is none/inherit', () => {
    const result = resolveAuth(makeTest({ type: 'inherit' }), inheritScenario, noAuthFg, []);
    expect(result).toEqual({ type: 'none' });
  });

  it('test auth takes priority over scenario auth', () => {
    const sc: Pick<TestScenario, 'auth'> = { auth: bearerAuth };
    const result = resolveAuth(makeTest(basicAuth), sc, noAuthFg, []);
    expect(result).toEqual(basicAuth);
  });

  it('scenario auth takes priority over feature group auth', () => {
    const sc: Pick<TestScenario, 'auth'> = { auth: bearerAuth };
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = { auth: basicAuth };
    const result = resolveAuth(makeTest({ type: 'inherit' }), sc, fg, []);
    expect(result).toEqual(bearerAuth);
  });

  it('feature group auth takes priority over global profile', () => {
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = {
      auth: basicAuth,
      globalAuthProfileId: 'gp1',
    };
    const result = resolveAuth(makeTest({ type: 'inherit' }), noAuthScenario, fg, [globalProfile]);
    expect(result).toEqual(basicAuth);
  });

  it('handles scenario with undefined auth (optional field)', () => {
    const sc: Pick<TestScenario, 'auth'> = {};
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = { auth: bearerAuth };
    const result = resolveAuth(makeTest({ type: 'inherit' }), sc, fg, []);
    expect(result).toEqual(bearerAuth);
  });

  it('handles feature group with undefined auth', () => {
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = {};
    const result = resolveAuth(makeTest({ type: 'inherit' }), noAuthScenario, fg, []);
    expect(result).toEqual({ type: 'none' });
  });

  it('full chain: test=inherit → scenario=inherit → fg=inherit+globalId → global profile', () => {
    const fg: Pick<FeatureGroup, 'auth' | 'globalAuthProfileId'> = {
      auth: { type: 'inherit' },
      globalAuthProfileId: 'gp1',
    };
    const result = resolveAuth(makeTest({ type: 'inherit' }), inheritScenario, fg, [globalProfile]);
    expect(result).toEqual(oauth2Auth);
  });

  it('all six auth types are returned correctly when set on test', () => {
    const types: AuthConfig[] = [
      basicAuth, bearerAuth, apiKeyAuth, oauth2Auth,
      { type: 'digest', username: 'u', password: 'p' },
    ];
    for (const auth of types) {
      expect(resolveAuth(makeTest(auth), noAuthScenario, noAuthFg, []).type).toBe(auth.type);
    }
  });

  it('returns envFallbackAuth when entire chain is none/inherit', () => {
    const envAuth: AuthConfig = { type: 'bearer', token: 'env-tok' };
    const result = resolveAuth(
      makeTest({ type: 'inherit' }), inheritScenario, noAuthFg, [], envAuth,
    );
    expect(result).toEqual(envAuth);
  });

  it('returns none when envFallbackAuth is none', () => {
    const result = resolveAuth(
      makeTest({ type: 'inherit' }), inheritScenario, noAuthFg, [], { type: 'none' },
    );
    expect(result).toEqual({ type: 'none' });
  });
});
