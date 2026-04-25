import { describe, it, expect } from 'vitest';
import type { AuthConfig, GlobalAuthProfile } from '../types';
import {
  getAuthType,
  authToState,
  stateToAuth,
  emptyAuthState,
} from './requestAuthState';
import type { EnvAuthState } from './requestAuthState';

function makeProfile(id: string, authType: AuthConfig['type'] = 'bearer'): GlobalAuthProfile {
  return { id, name: `Profile ${id}`, auth: { type: authType, token: 'tok-' + id } };
}

// ─── getAuthType ─────────────────────────────────────────

describe('getAuthType', () => {
  it('returns "none" for undefined auth', () => {
    expect(getAuthType(undefined)).toBe('none');
  });

  it('returns "none" for auth type "none"', () => {
    expect(getAuthType({ type: 'none' })).toBe('none');
  });

  it('returns "none" for auth type "inherit"', () => {
    expect(getAuthType({ type: 'inherit' })).toBe('none');
  });

  it('returns "bearer" for bearer auth', () => {
    expect(getAuthType({ type: 'bearer', token: 'abc' })).toBe('bearer');
  });

  it('returns "basic" for basic auth', () => {
    expect(getAuthType({ type: 'basic', username: 'user' })).toBe('basic');
  });

  it('returns "apikey" for API key auth', () => {
    expect(getAuthType({ type: 'apikey', apiKeyName: 'key' })).toBe('apikey');
  });

  it('returns "oauth2" for OAuth2 auth', () => {
    expect(getAuthType({ type: 'oauth2', tokenUrl: 'https://...' })).toBe('oauth2');
  });

  it('returns "global-profile" when globalProfileId is set and profiles exist', () => {
    const auth = { type: 'bearer' as const, token: 'x', globalProfileId: 'p1' } as AuthConfig & { globalProfileId: string };
    const profiles = [makeProfile('p1')];
    expect(getAuthType(auth, profiles)).toBe('global-profile');
  });

  it('does not return "global-profile" when profiles array is empty', () => {
    const auth = { type: 'bearer' as const, token: 'x', globalProfileId: 'p1' } as AuthConfig & { globalProfileId: string };
    expect(getAuthType(auth, [])).toBe('bearer');
  });
});

// ─── authToState ─────────────────────────────────────────

describe('authToState', () => {
  it('maps undefined auth to default empty state', () => {
    const state = authToState(undefined, []);
    expect(state.authType).toBe('none');
    expect(state.bearerPrefix).toBe('Bearer');
    expect(state.bearerToken).toBe('');
    expect(state.basicUser).toBe('');
    expect(state.basicPass).toBe('');
    expect(state.apiKeyName).toBe('');
    expect(state.apiKeyValue).toBe('');
    expect(state.apiKeyIn).toBe('header');
    expect(state.tokenUrl).toBe('');
    expect(state.clientId).toBe('');
    expect(state.clientSecret).toBe('');
  });

  it('maps bearer auth correctly', () => {
    const auth: AuthConfig = { type: 'bearer', prefix: 'Token', token: 'mytoken' };
    const state = authToState(auth, []);
    expect(state.authType).toBe('bearer');
    expect(state.bearerPrefix).toBe('Token');
    expect(state.bearerToken).toBe('mytoken');
  });

  it('maps basic auth correctly', () => {
    const auth: AuthConfig = { type: 'basic', username: 'admin', password: 'secret' };
    const state = authToState(auth, []);
    expect(state.authType).toBe('basic');
    expect(state.basicUser).toBe('admin');
    expect(state.basicPass).toBe('secret');
  });

  it('maps apikey auth correctly', () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'val', apiKeyIn: 'query' };
    const state = authToState(auth, []);
    expect(state.authType).toBe('apikey');
    expect(state.apiKeyName).toBe('X-Key');
    expect(state.apiKeyValue).toBe('val');
    expect(state.apiKeyIn).toBe('query');
  });

  it('maps oauth2 auth correctly', () => {
    const auth: AuthConfig = { type: 'oauth2', tokenUrl: 'https://auth.com/token', clientId: 'cid', clientSecret: 'csec' };
    const state = authToState(auth, []);
    expect(state.authType).toBe('oauth2');
    expect(state.tokenUrl).toBe('https://auth.com/token');
    expect(state.clientId).toBe('cid');
    expect(state.clientSecret).toBe('csec');
  });

  it('maps global profile auth correctly', () => {
    const profiles = [makeProfile('p1')];
    const auth = { type: 'bearer' as const, token: 'x', globalProfileId: 'p1' } as AuthConfig & { globalProfileId: string };
    const state = authToState(auth, profiles);
    expect(state.authType).toBe('global-profile');
    expect(state.selectedProfileId).toBe('p1');
  });

  it('defaults selectedProfileId to first profile when none set', () => {
    const profiles = [makeProfile('p1'), makeProfile('p2')];
    const state = authToState(undefined, profiles);
    expect(state.selectedProfileId).toBe('p1');
  });

  it('defaults selectedProfileId to empty string when no profiles', () => {
    const state = authToState(undefined, []);
    expect(state.selectedProfileId).toBe('');
  });
});

// ─── stateToAuth ─────────────────────────────────────────

describe('stateToAuth', () => {
  it('returns { type: "none" } for "none" auth type', () => {
    const state = emptyAuthState([]);
    expect(stateToAuth(state, [])).toEqual({ type: 'none' });
  });

  it('converts bearer state to AuthConfig', () => {
    const state: EnvAuthState = {
      ...emptyAuthState([]),
      authType: 'bearer',
      bearerPrefix: 'Token',
      bearerToken: 'abc123',
    };
    const auth = stateToAuth(state, []);
    expect(auth).toEqual({ type: 'bearer', prefix: 'Token', token: 'abc123' });
  });

  it('converts basic state to AuthConfig', () => {
    const state: EnvAuthState = {
      ...emptyAuthState([]),
      authType: 'basic',
      basicUser: 'admin',
      basicPass: 'pass',
    };
    const auth = stateToAuth(state, []);
    expect(auth).toEqual({ type: 'basic', username: 'admin', password: 'pass' });
  });

  it('converts apikey state to AuthConfig with correct type', () => {
    const state: EnvAuthState = {
      ...emptyAuthState([]),
      authType: 'apikey',
      apiKeyName: 'X-API-Key',
      apiKeyValue: 'mykey',
      apiKeyIn: 'header',
    };
    const auth = stateToAuth(state, []);
    expect(auth).toEqual({ type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'mykey', apiKeyIn: 'header' });
    expect(auth!.type).toBe('apikey');
  });

  it('converts oauth2 state to AuthConfig', () => {
    const state: EnvAuthState = {
      ...emptyAuthState([]),
      authType: 'oauth2',
      tokenUrl: 'https://auth.com/token',
      clientId: 'cid',
      clientSecret: 'csec',
    };
    const auth = stateToAuth(state, []);
    expect(auth).toEqual({ type: 'oauth2', tokenUrl: 'https://auth.com/token', clientId: 'cid', clientSecret: 'csec' });
  });

  it('converts global-profile state to AuthConfig with profile data', () => {
    const profiles = [makeProfile('p1', 'bearer')];
    const state: EnvAuthState = {
      ...emptyAuthState(profiles),
      authType: 'global-profile',
      selectedProfileId: 'p1',
    };
    const auth = stateToAuth(state, profiles) as AuthConfig & { globalProfileId: string };
    expect(auth.type).toBe('bearer');
    expect(auth.token).toBe('tok-p1');
    expect(auth.globalProfileId).toBe('p1');
  });

  it('returns { type: "none" } for global-profile when profile not found', () => {
    const state: EnvAuthState = {
      ...emptyAuthState([]),
      authType: 'global-profile',
      selectedProfileId: 'missing',
    };
    expect(stateToAuth(state, [])).toEqual({ type: 'none' });
  });
});

// ─── emptyAuthState ──────────────────────────────────────

describe('emptyAuthState', () => {
  it('produces a state with authType "none"', () => {
    const state = emptyAuthState([]);
    expect(state.authType).toBe('none');
  });

  it('sets selectedProfileId from first profile', () => {
    const profiles = [makeProfile('p1')];
    const state = emptyAuthState(profiles);
    expect(state.selectedProfileId).toBe('p1');
  });
});

// ─── Roundtrip tests ─────────────────────────────────────

describe('roundtrip: authToState -> stateToAuth', () => {
  const profiles = [makeProfile('p1', 'bearer')];

  const cases: [string, AuthConfig][] = [
    ['bearer', { type: 'bearer', prefix: 'Bearer', token: 'tok' }],
    ['basic', { type: 'basic', username: 'user', password: 'pass' }],
    ['apikey', { type: 'apikey', apiKeyName: 'Key', apiKeyValue: 'val', apiKeyIn: 'header' }],
    ['oauth2', { type: 'oauth2', tokenUrl: 'https://a.com', clientId: 'c', clientSecret: 's' }],
  ];

  it.each(cases)('roundtrips %s auth correctly', (_name, auth) => {
    const state = authToState(auth, profiles);
    const result = stateToAuth(state, profiles);
    expect(result).toEqual(auth);
  });
});
