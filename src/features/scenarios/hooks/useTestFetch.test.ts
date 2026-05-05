import { describe, it, expect, vi } from 'vitest';
import {
  resolveEffectiveAuthFromHierarchy,
  buildResponseVersion,
  buildRulesVersion,
} from './useTestFetch';
import type { Scenario, FeatureGroup, GlobalAuthProfile, AuthConfig } from '../../../shared/types';

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
    expect((version as any).json).toBeUndefined(); // rules version has no json
  });

  it('handles empty expectedFields', () => {
    const v: Scenario['validation'] = { mode: 'full' };
    const version = buildRulesVersion(v);
    expect(version.expectedFields).toEqual([]);
  });
});
