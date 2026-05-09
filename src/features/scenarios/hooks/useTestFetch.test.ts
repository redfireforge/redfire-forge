import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveEffectiveAuthFromHierarchy,
  buildResponseVersion,
  buildRulesVersion,
  buildAuthedRequest,
} from './useTestFetch';
import type { Scenario, FeatureGroup, GlobalAuthProfile, AuthConfig } from '../../../shared/types';

// Mock dependencies
vi.mock('../../../engine/tokenManager', () => ({
  acquireOAuth2Token: vi.fn().mockResolvedValue('mocked-oauth-token'),
}));

// ─── Test helpers ────────────────────────────────────────────

function makeDraft(authOverride: Partial<AuthConfig> = {}): Scenario {
  return {
    id: 'test-1',
    name: 'Test',
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none', ...authOverride } as AuthConfig,
    validation: { mode: 'none' },
  };
}

function makeFeatureGroup(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1',
    name: 'FG',
    microserviceId: 'svc-1',
    environmentId: 'env-1',
    scenarios: [{
      id: 'sc-1',
      name: 'Scenario',
      tests: [],
      ...overrides.scenarios?.[0],
    }],
    ...overrides,
  };
}

// ─── resolveEffectiveAuthFromHierarchy ───────────────────────

describe('resolveEffectiveAuthFromHierarchy', () => {
  const noProfiles: GlobalAuthProfile[] = [];

  it('returns test auth when test has non-inherit/non-none auth', () => {
    const draft = makeDraft({ type: 'bearer', token: 'abc' });
    const result = resolveEffectiveAuthFromHierarchy(draft, [], 'fg-1', 'sc-1', noProfiles);
    expect(result.source).toBe('test');
    expect(result.auth.type).toBe('bearer');
  });

  it('inherits from scenario when test auth is none', () => {
    const draft = makeDraft({ type: 'none' });
    const fgs = [makeFeatureGroup({
      scenarios: [{
        id: 'sc-1', name: 'S', tests: [],
        auth: { type: 'bearer', token: 'sc-token' } as AuthConfig,
      }],
    })];
    const result = resolveEffectiveAuthFromHierarchy(draft, fgs, 'fg-1', 'sc-1', noProfiles);
    expect(result.source).toBe('scenario');
    expect(result.auth.type).toBe('bearer');
  });

  it('inherits from feature group when scenario has no auth', () => {
    const draft = makeDraft({ type: 'none' });
    const fgs = [makeFeatureGroup({
      auth: { type: 'apikey', apiKeyName: 'x', apiKeyValue: 'y', apiKeyIn: 'header' } as AuthConfig,
      scenarios: [{ id: 'sc-1', name: 'S', tests: [] }],
    })];
    const result = resolveEffectiveAuthFromHierarchy(draft, fgs, 'fg-1', 'sc-1', noProfiles);
    expect(result.source).toBe('feature');
    expect(result.auth.type).toBe('apikey');
  });

  it('inherits from global profile when feature group uses inherit + globalAuthProfileId', () => {
    const draft = makeDraft({ type: 'none' });
    const profiles: GlobalAuthProfile[] = [
      { id: 'gp-1', name: 'Global Bearer', auth: { type: 'bearer', token: 'global-token' } as AuthConfig },
    ];
    const fgs = [makeFeatureGroup({
      auth: { type: 'inherit' } as AuthConfig,
      globalAuthProfileId: 'gp-1',
      scenarios: [{ id: 'sc-1', name: 'S', tests: [] }],
    })];
    const result = resolveEffectiveAuthFromHierarchy(draft, fgs, 'fg-1', 'sc-1', profiles);
    expect(result.source).toBe('global:Global Bearer');
    expect(result.auth.type).toBe('bearer');
  });

  it('inherits from global profile when feature group auth is none + has globalAuthProfileId', () => {
    const draft = makeDraft({ type: 'none' });
    const profiles: GlobalAuthProfile[] = [
      { id: 'gp-1', name: 'Global Bearer', auth: { type: 'bearer', token: 'global-token' } as AuthConfig },
    ];
    const fgs = [makeFeatureGroup({
      auth: { type: 'none' } as AuthConfig,
      globalAuthProfileId: 'gp-1',
      scenarios: [{ id: 'sc-1', name: 'S', tests: [] }],
    })];
    const result = resolveEffectiveAuthFromHierarchy(draft, fgs, 'fg-1', 'sc-1', profiles);
    expect(result.source).toBe('global:Global Bearer');
  });

  it('returns none when no auth is configured anywhere', () => {
    const draft = makeDraft({ type: 'none' });
    const fgs = [makeFeatureGroup({ scenarios: [{ id: 'sc-1', name: 'S', tests: [] }] })];
    const result = resolveEffectiveAuthFromHierarchy(draft, fgs, 'fg-1', 'sc-1', noProfiles);
    expect(result.source).toBe('none');
    expect(result.auth.type).toBe('none');
  });

  it('returns none when feature group is not found', () => {
    const draft = makeDraft({ type: 'inherit' });
    const result = resolveEffectiveAuthFromHierarchy(draft, [], 'missing-fg', 'sc-1', noProfiles);
    expect(result.source).toBe('none');
  });

  it('returns test auth for inherit type when test has explicit auth configured', () => {
    const draft = makeDraft({ type: 'basic', username: 'user', password: 'pass' });
    const result = resolveEffectiveAuthFromHierarchy(draft, [], 'fg-1', 'sc-1', noProfiles);
    expect(result.source).toBe('test');
    expect(result.auth.type).toBe('basic');
  });
});

// ─── buildResponseVersion ────────────────────────────────────

describe('buildResponseVersion', () => {
  it('builds a version snapshot from validation state', () => {
    const v: Scenario['validation'] = {
      mode: 'selective',
      selectiveMode: 'include',
      expectedFields: [{ path: '$.name', op: 'exists' }],
      excludedPaths: ['$.meta'],
      unorderedArrays: true,
    };
    const version = buildResponseVersion(v, '{"name":"Alice"}');
    expect(version.id).toBeTruthy();
    expect(version.timestamp).toBeGreaterThan(0);
    expect(version.json).toBe('{"name":"Alice"}');
    expect(version.validationMode).toBe('selective');
    expect(version.selectiveMode).toBe('include');
    expect(version.expectedFields).toEqual([{ path: '$.name', op: 'exists' }]);
    expect(version.excludedPaths).toEqual(['$.meta']);
    expect(version.unorderedArrays).toBe(true);
  });

  it('handles undefined optional fields', () => {
    const v: Scenario['validation'] = { mode: 'none' };
    const version = buildResponseVersion(v, '');
    expect(version.expectedFields).toEqual([]);
    expect(version.excludedPaths).toEqual([]);
    expect(version.unorderedArrays).toBeUndefined();
  });

  it('does not mutate original expectedFields array', () => {
    const fields = [{ path: '$.x', op: 'exists' as const }];
    const v: Scenario['validation'] = { mode: 'selective', expectedFields: fields };
    const version = buildResponseVersion(v, '{}');
    expect(version.expectedFields).not.toBe(fields);
    expect(version.expectedFields).toEqual(fields);
  });
});

// ─── buildRulesVersion ───────────────────────────────────────

describe('buildRulesVersion', () => {
  it('builds a rules version from validation state', () => {
    const v: Scenario['validation'] = {
      mode: 'selective',
      selectiveMode: 'include',
      expectedFields: [{ path: '$.status', op: 'equals', value: 'active' }],
      excludedPaths: [],
    };
    const version = buildRulesVersion(v);
    expect(version.id).toBeTruthy();
    expect(version.timestamp).toBeGreaterThan(0);
    expect(version.validationMode).toBe('selective');
    expect(version.expectedFields).toEqual([{ path: '$.status', op: 'equals', value: 'active' }]);
    expect(Object.hasOwn(version, 'json')).toBe(false);
  });

  it('handles empty expectedFields', () => {
    const v: Scenario['validation'] = { mode: 'full' };
    const version = buildRulesVersion(v);
    expect(version.expectedFields).toEqual([]);
  });
});

// ─── buildAuthedRequest ───────────────────────────────────────

describe('buildAuthedRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds headers from scenario headers', async () => {
    const draft = makeDraft();
    draft.headers = [
      { key: 'X-Custom', value: 'custom-value' },
      { key: 'Accept', value: 'application/json' },
    ];
    const result = await buildAuthedRequest(draft, { type: 'none' }, 'none');
    expect(result.headers['X-Custom']).toBe('custom-value');
    expect(result.headers['Accept']).toBe('application/json');
    expect(result.fetchError).toBeUndefined();
  });

  it('skips empty header keys', async () => {
    const draft = makeDraft();
    draft.headers = [
      { key: '', value: 'ignored' },
      { key: '  ', value: 'also-ignored' },
      { key: 'Valid', value: 'kept' },
    ];
    const result = await buildAuthedRequest(draft, { type: 'none' }, 'none');
    expect(result.headers['Valid']).toBe('kept');
    expect(Object.keys(result.headers).filter(k => k !== 'Valid' && k !== 'Content-Type')).toEqual([]);
  });

  it('skips Authorization header when auth is configured', async () => {
    const draft = makeDraft();
    draft.headers = [
      { key: 'Authorization', value: 'should-be-ignored' },
      { key: 'X-Other', value: 'kept' },
    ];
    const result = await buildAuthedRequest(draft, { type: 'bearer', token: 'abc' }, 'test');
    expect(result.headers['Authorization']).toBe('Bearer abc');
    expect(result.headers['X-Other']).toBe('kept');
  });

  it('keeps Authorization header when auth type is none', async () => {
    const draft = makeDraft();
    draft.headers = [{ key: 'Authorization', value: 'custom-auth' }];
    const result = await buildAuthedRequest(draft, { type: 'none' }, 'none');
    expect(result.headers['Authorization']).toBe('custom-auth');
  });

  it('adds bearer auth header', async () => {
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, { type: 'bearer', token: 'my-token' }, 'test');
    expect(result.headers['Authorization']).toBe('Bearer my-token');
  });

  it('adds bearer auth header with custom prefix', async () => {
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, { type: 'bearer', token: 'my-token', prefix: 'Token' }, 'test');
    expect(result.headers['Authorization']).toBe('Token my-token');
  });

  it('adds basic auth header', async () => {
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, { type: 'basic', username: 'user', password: 'pass' }, 'test');
    expect(result.headers['Authorization']).toBe(`Basic ${btoa('user:pass')}`);
  });

  it('adds apikey header when apiKeyIn is header', async () => {
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, {
      type: 'apikey',
      apiKeyName: 'X-API-Key',
      apiKeyValue: 'secret123',
      apiKeyIn: 'header',
    }, 'test');
    expect(result.headers['X-API-Key']).toBe('secret123');
  });

  it('does not add apikey header when apiKeyIn is query', async () => {
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, {
      type: 'apikey',
      apiKeyName: 'api_key',
      apiKeyValue: 'secret123',
      apiKeyIn: 'query',
    }, 'test');
    expect(result.headers['api_key']).toBeUndefined();
  });

  it('returns error for oauth2 missing tokenUrl', async () => {
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, {
      type: 'oauth2',
      tokenUrl: '',
      clientId: 'id',
      clientSecret: 'secret',
      grantType: 'client_credentials',
    }, 'test');
    expect(result.fetchError).toContain('tokenUrl');
    expect(result.fetchError).toContain('auth source: test');
  });

  it('returns error for oauth2 missing clientId', async () => {
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, {
      type: 'oauth2',
      tokenUrl: 'https://auth.example.com/token',
      clientId: '',
      clientSecret: 'secret',
      grantType: 'client_credentials',
    }, 'test');
    expect(result.fetchError).toContain('clientId');
  });

  it('returns error for oauth2 missing clientSecret', async () => {
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, {
      type: 'oauth2',
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'id',
      clientSecret: '',
      grantType: 'client_credentials',
    }, 'test');
    expect(result.fetchError).toContain('clientSecret');
  });

  it('acquires oauth2 token and adds Authorization header', async () => {
    const { acquireOAuth2Token } = await import('../../../engine/tokenManager');
    const draft = makeDraft();
    const result = await buildAuthedRequest(draft, {
      type: 'oauth2',
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'my-client',
      clientSecret: 'my-secret',
      grantType: 'client_credentials',
    }, 'test');
    expect(acquireOAuth2Token).toHaveBeenCalled();
    expect(result.headers['Authorization']).toBe('Bearer mocked-oauth-token');
    expect(result.fetchError).toBeUndefined();
  });

  it('serializes JSON body and sets Content-Type', async () => {
    const draft = makeDraft();
    draft.method = 'POST';
    draft.body = '{"key":"value"}';
    draft.bodyType = 'json';
    const result = await buildAuthedRequest(draft, { type: 'none' }, 'none');
    expect(result.body).toBe('{"key":"value"}');
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('serializes form-urlencoded body', async () => {
    const draft = makeDraft();
    draft.method = 'POST';
    draft.bodyType = 'form-urlencoded';
    draft.bodyForm = [
      { key: 'name', value: 'John' },
      { key: 'age', value: '30' },
    ];
    const result = await buildAuthedRequest(draft, { type: 'none' }, 'none');
    expect(result.body).toBe('name=John&age=30');
    expect(result.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('serializes form-data body with boundary', async () => {
    const draft = makeDraft();
    draft.method = 'POST';
    draft.bodyType = 'form-data';
    draft.bodyForm = [{ key: 'field', value: 'value' }];
    const result = await buildAuthedRequest(draft, { type: 'none' }, 'none');
    expect(result.body).toContain('Content-Disposition: form-data; name="field"');
    expect(result.body).toContain('value');
    expect(result.headers['Content-Type']).toContain('multipart/form-data; boundary=');
  });

  it('returns undefined body for GET requests', async () => {
    const draft = makeDraft();
    draft.method = 'GET';
    draft.body = 'should be ignored';
    const result = await buildAuthedRequest(draft, { type: 'none' }, 'none');
    expect(result.body).toBeUndefined();
  });

  it('preserves existing Content-Type header for non-form-data', async () => {
    const draft = makeDraft();
    draft.method = 'POST';
    draft.body = '{"test":true}';
    draft.bodyType = 'json';
    draft.headers = [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }];
    const result = await buildAuthedRequest(draft, { type: 'none' }, 'none');
    expect(result.headers['Content-Type']).toBe('application/json; charset=utf-8');
  });
});
