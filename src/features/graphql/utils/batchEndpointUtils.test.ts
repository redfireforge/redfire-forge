import { describe, it, expect } from 'vitest';
import { evaluateBatchEndpointParity, resolveTabRawEndpoint, buildBatchGroups } from './batchEndpointUtils';
import type { ConnectionProfile } from './connectionProfileStorage';
import type { GqlStudioTab } from './tabPersistence';

function makeTab(id: string, overrides: Partial<GqlStudioTab> = {}): GqlStudioTab {
  return {
    id,
    label: id,
    modelUri: `model://${id}`,
    query: 'query { x }',
    variables: '{}',
    headers: [],
    operationType: 'query',
    unsavedChanges: false,
    ...overrides,
  };
}

const stagingProfile: ConnectionProfile = {
  id: 'prof-staging',
  name: 'Staging',
  endpoint: 'https://staging.example.com/graphql',
  auth: null,
  createdAt: 1,
};

const prodProfile: ConnectionProfile = {
  id: 'prof-prod',
  name: 'Prod',
  endpoint: 'https://prod.example.com/graphql',
  auth: null,
  createdAt: 2,
};

describe('resolveTabRawEndpoint', () => {
  it('returns tab override when set', () => {
    expect(resolveTabRawEndpoint(
      makeTab('t1', { endpoint: 'https://staging.example.com/graphql' }),
      [],
      'https://api.example.com/graphql',
    )).toBe('https://staging.example.com/graphql');
  });

  it('falls back to page default when tab has no override', () => {
    expect(resolveTabRawEndpoint(makeTab('t1'), [], 'https://api.example.com/graphql'))
      .toBe('https://api.example.com/graphql');
  });

  it('Phase 6F: resolves endpoint from linked profile when tab has no endpoint override', () => {
    expect(resolveTabRawEndpoint(
      makeTab('t1', { connectionId: 'prof-staging' }),
      [stagingProfile],
      'https://api.example.com/graphql',
    )).toBe('https://staging.example.com/graphql');
  });
});

describe('evaluateBatchEndpointParity', () => {
  const page = 'https://api.example.com/graphql';

  it('returns no mismatch for zero batched tabs', () => {
    expect(evaluateBatchEndpointParity([], page, null)).toEqual({
      hasParity: true,
      commonResolvedEndpoint: null,
      mismatch: false,
    });
  });

  it('returns no mismatch for fewer than two batched tabs', () => {
    expect(evaluateBatchEndpointParity([makeTab('t1')], page, null)).toEqual({
      hasParity: true,
      commonResolvedEndpoint: null,
      mismatch: false,
    });
  });

  it('returns parity when all batched tabs share the same resolved endpoint', () => {
    const result = evaluateBatchEndpointParity(
      [
        makeTab('t1', { endpoint: 'https://staging.example.com/graphql' }),
        makeTab('t2', { endpoint: 'https://staging.example.com/graphql' }),
      ],
      page,
      null,
    );
    expect(result).toEqual({
      hasParity: true,
      commonResolvedEndpoint: 'https://staging.example.com/graphql',
      mismatch: false,
    });
  });

  it('returns parity when tabs inherit the same page default', () => {
    const result = evaluateBatchEndpointParity([makeTab('t1'), makeTab('t2')], page, null);
    expect(result.hasParity).toBe(true);
    expect(result.commonResolvedEndpoint).toBe(page);
    expect(result.mismatch).toBe(false);
  });

  it('detects mismatch when batched tabs use different endpoints (Phase 6A-8)', () => {
    const result = evaluateBatchEndpointParity(
      [
        makeTab('t1', { endpoint: 'https://staging.example.com/graphql' }),
        makeTab('t2', { endpoint: 'https://prod.example.com/graphql' }),
      ],
      page,
      null,
    );
    expect(result.hasParity).toBe(false);
    expect(result.commonResolvedEndpoint).toBeNull();
    expect(result.mismatch).toBe(true);
  });

  it('Phase 6F: detects mismatch when tabs link to different profiles', () => {
    const result = evaluateBatchEndpointParity(
      [
        makeTab('t1', { connectionId: 'prof-staging' }),
        makeTab('t2', { connectionId: 'prof-prod' }),
      ],
      page,
      null,
      undefined,
      [stagingProfile, prodProfile],
    );
    expect(result.mismatch).toBe(true);
  });

  it('Phase 6F: parity when tabs link to same profile', () => {
    const result = evaluateBatchEndpointParity(
      [
        makeTab('t1', { connectionId: 'prof-staging' }),
        makeTab('t2', { connectionId: 'prof-staging' }),
      ],
      page,
      null,
      undefined,
      [stagingProfile],
    );
    expect(result.hasParity).toBe(true);
    expect(result.commonResolvedEndpoint).toBe('https://staging.example.com/graphql');
  });

  it('detects mismatch when one tab overrides and another inherits page default', () => {
    const result = evaluateBatchEndpointParity(
      [makeTab('t1', { endpoint: 'https://staging.example.com/graphql' }), makeTab('t2')],
      page,
      null,
    );
    expect(result.mismatch).toBe(true);
  });

  it('treats blank resolved endpoints as mismatch', () => {
    const result = evaluateBatchEndpointParity(
      [makeTab('t1'), makeTab('t2')],
      '   ',
      null,
    );
    expect(result.hasParity).toBe(false);
    expect(result.mismatch).toBe(true);
  });

  it('detects mismatch when resolved endpoints differ via env vars', () => {
    const env = {
      id: 'env',
      name: 'Dev',
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
      variables: [
        { key: 'stagingUrl', value: 'https://a.com/gql', enabled: true },
        { key: 'prodUrl', value: 'https://b.com/gql', enabled: true },
      ],
    };
    const result = evaluateBatchEndpointParity(
      [
        makeTab('t1', { endpoint: '{{stagingUrl}}' }),
        makeTab('t2', { endpoint: '{{prodUrl}}' }),
      ],
      page,
      env,
    );
    expect(result.mismatch).toBe(true);
  });

  it('detects mismatch when one tab resolves empty and another has an endpoint', () => {
    const result = evaluateBatchEndpointParity(
      [makeTab('t1', { endpoint: '' }), makeTab('t2', { endpoint: 'https://staging.example.com/graphql' })],
      page,
      null,
    );
    expect(result.hasParity).toBe(false);
    expect(result.mismatch).toBe(true);
  });

  it('parity when tabs link to profiles whose endpoint is whitespace-only', () => {
    const blankEndpointProfile: ConnectionProfile = {
      ...stagingProfile,
      endpoint: '   ',
    };
    const result = evaluateBatchEndpointParity(
      [
        makeTab('t1', { connectionId: 'prof-staging' }),
        makeTab('t2', { connectionId: 'prof-staging' }),
      ],
      page,
      null,
      undefined,
      [blankEndpointProfile],
    );
    expect(result.hasParity).toBe(true);
    expect(result.commonResolvedEndpoint).toBe(page);
  });

  it('parity when tabs with whitespace-only overrides inherit page default', () => {
    const result = evaluateBatchEndpointParity(
      [makeTab('t1', { endpoint: '   ' }), makeTab('t2', { endpoint: '  \t  ' })],
      page,
      null,
    );
    expect(result.hasParity).toBe(true);
    expect(result.commonResolvedEndpoint).toBe(page);
  });

  it('hasParity false when env-resolved endpoints are blank', () => {
    const env = {
      id: 'env',
      name: 'Dev',
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
      variables: [{ key: 'blank', value: '', enabled: true }],
    };
    const result = evaluateBatchEndpointParity(
      [makeTab('t1', { endpoint: '{{blank}}' }), makeTab('t2', { endpoint: '{{blank}}' })],
      page,
      env,
    );
    expect(result.hasParity).toBe(false);
    expect(result.mismatch).toBe(true);
    expect(result.commonResolvedEndpoint).toBeNull();
  });

  it('uses default profiles array when the fifth argument is omitted', () => {
    const result = evaluateBatchEndpointParity(
      [makeTab('t1', { endpoint: 'https://a.example/gql' }), makeTab('t2', { endpoint: 'https://a.example/gql' })],
      page,
      null,
    );
    expect(result.hasParity).toBe(true);
  });

  it('parity when tabs link to missing profiles and inherit page default', () => {
    const result = evaluateBatchEndpointParity(
      [
        makeTab('t1', { connectionId: 'missing-a' }),
        makeTab('t2', { connectionId: 'missing-b' }),
      ],
      page,
      null,
      undefined,
      [stagingProfile],
    );
    expect(result.hasParity).toBe(true);
    expect(result.commonResolvedEndpoint).toBe(page);
  });

  it('parity when tabs share the same env-var-resolved endpoint', () => {
    const env = {
      id: 'env',
      name: 'Dev',
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
      variables: [{ key: 'gqlUrl', value: 'https://shared.example/gql', enabled: true }],
    };
    const result = evaluateBatchEndpointParity(
      [makeTab('t1', { endpoint: '{{gqlUrl}}' }), makeTab('t2', { endpoint: '{{gqlUrl}}' })],
      page,
      env,
      { gqlUrl: 'https://shared.example/gql' },
    );
    expect(result.hasParity).toBe(true);
    expect(result.commonResolvedEndpoint).toBe('https://shared.example/gql');
  });
});

describe('buildBatchGroups', () => {
  const page = 'https://api.example.com/graphql';

  it('groups tabs by resolved endpoint', () => {
    const groups = buildBatchGroups(
      [
        makeTab('t1', { endpoint: 'https://staging.example.com/graphql' }),
        makeTab('t2', { endpoint: 'https://staging.example.com/graphql' }),
        makeTab('t3', { endpoint: 'https://prod.example.com/graphql' }),
      ],
      page,
      null,
    );
    expect(groups).toHaveLength(2);
    const staging = groups.find((g) => g.tabIds.includes('t1'));
    expect(staging?.tabIds).toEqual(['t1', 't2']);
    expect(staging?.displayLabel).toBe('staging.example.com');
  });

  it('excludes subscription tabs', () => {
    const groups = buildBatchGroups(
      [
        makeTab('q1'),
        makeTab('s1', { operationType: 'subscription' }),
      ],
      page,
      null,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tabIds).toEqual(['q1']);
  });

  it('filters to demo lesson tabs when demoLessonId is set', () => {
    const groups = buildBatchGroups(
      [
        makeTab('user'),
        makeTab('d1', { demoLessonId: 'gql-batch-execution' }),
        makeTab('d2', { demoLessonId: 'gql-batch-execution' }),
      ],
      page,
      null,
      undefined,
      [],
      { demoLessonId: 'gql-batch-execution' },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tabIds).toEqual(['d1', 'd2']);
  });
});
