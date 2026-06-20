import { describe, it, expect } from 'vitest';
import { promoteToFeatureGroups, batchPromoteCollection } from './promoteToHarness';
import type { FeatureGroup, RequestCollection, Scenario } from '../../../shared/types';
import type { PromotionContext } from './requestToScenario';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const makeScenario = (overrides?: Partial<Scenario>): Scenario =>
  _makeScenario({ id: 'test-1', name: 'Get Users', ...overrides });

function makeGroups(): FeatureGroup[] {
  return [
    {
      id: 'fg-1', name: 'User Tests',
      microserviceId: 'svc-1', environmentId: 'env-1',
      scenarios: [
        { id: 'sc-1', name: 'Smoke', kind: 'standard', tests: [] },
        { id: 'sc-2', name: 'Regression', kind: 'standard', tests: [
          { id: 't-existing', name: 'existing', url: 'http://x', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } },
        ] },
      ],
    },
  ];
}

describe('promoteToFeatureGroups', () => {
  it('adds scenario to existing group and test scenario', () => {
    const result = promoteToFeatureGroups(makeGroups(), makeScenario(), {
      targetGroupId: 'fg-1',
      targetScenarioId: 'sc-1',
    });
    const group = result.featureGroups.find(g => g.id === 'fg-1')!;
    const sc = group.scenarios.find(s => s.id === 'sc-1')!;
    expect(sc.tests).toHaveLength(1);
    expect(sc.tests[0].name).toBe('Get Users');
    expect(result.createdGroupId).toBe('fg-1');
    expect(result.createdScenarioId).toBe('sc-1');
  });

  it('creates new feature group when newGroupName provided', () => {
    const result = promoteToFeatureGroups(makeGroups(), makeScenario(), {
      newGroupName: 'New API Group',
      newScenarioName: 'Basic Tests',
      environmentId: 'env-2',
      microserviceId: 'svc-2',
    });
    expect(result.featureGroups).toHaveLength(2);
    const newGroup = result.featureGroups[0];
    expect(newGroup.name).toBe('New API Group');
    expect(newGroup.microserviceId).toBe('svc-2');
    expect(newGroup.environmentId).toBe('env-2');
    expect(newGroup.scenarios).toHaveLength(1);
    expect(newGroup.scenarios[0].name).toBe('Basic Tests');
    expect(newGroup.scenarios[0].tests).toHaveLength(1);
  });

  it('creates new test scenario when newScenarioName provided', () => {
    const result = promoteToFeatureGroups(makeGroups(), makeScenario(), {
      targetGroupId: 'fg-1',
      newScenarioName: 'New Scenario',
    });
    const group = result.featureGroups.find(g => g.id === 'fg-1')!;
    expect(group.scenarios).toHaveLength(3);
    const newSc = group.scenarios[2];
    expect(newSc.name).toBe('New Scenario');
    expect(newSc.tests).toHaveLength(1);
    expect(newSc.tests[0].name).toBe('Get Users');
  });

  it('does not modify other groups or scenarios', () => {
    const result = promoteToFeatureGroups(makeGroups(), makeScenario(), {
      targetGroupId: 'fg-1',
      targetScenarioId: 'sc-1',
    });
    const group = result.featureGroups.find(g => g.id === 'fg-1')!;
    const regression = group.scenarios.find(s => s.id === 'sc-2')!;
    expect(regression.tests).toHaveLength(1);
    expect(regression.tests[0].id).toBe('t-existing');
  });

  it('uses scenario name as default when creating new group without scenario name', () => {
    const result = promoteToFeatureGroups([], makeScenario({ name: 'My Test' }), {
      newGroupName: 'Group',
    });
    const group = result.featureGroups[0];
    expect(group.scenarios[0].name).toBe('My Test');
  });

  it('returns empty ids when neither target group nor new group name provided', () => {
    const result = promoteToFeatureGroups(makeGroups(), makeScenario(), {});
    expect(result.createdGroupId).toBe('');
    expect(result.createdScenarioId).toBe('');
    expect(result.featureGroups).toEqual(makeGroups());
  });

  it('targets group without scenario id or name leaves scenarios unchanged but reports group id', () => {
    const before = makeGroups();
    const result = promoteToFeatureGroups(before, makeScenario(), { targetGroupId: 'fg-1' });
    expect(result.createdGroupId).toBe('fg-1');
    expect(result.createdScenarioId).toBe('');
    expect(result.featureGroups).toEqual(before);
  });

  it('defaults new scenario title to Default when promoted request has blank name', () => {
    const result = promoteToFeatureGroups([], makeScenario({ name: '' }), {
      newGroupName: 'SoloGroup',
    });
    expect(result.featureGroups[0].scenarios[0].name).toBe('Default');
  });

  it('silently skips additions when stale scenario identifiers miss the group catalogue', () => {
    const before = makeGroups();
    const scenario = makeScenario({ name: 'Orphan Promo' });
    const result = promoteToFeatureGroups(before, scenario, {
      targetGroupId: 'fg-1',
      targetScenarioId: 'missing-scenario',
    });
    expect(result.featureGroups).toEqual(before);
    expect(result.createdScenarioId).toBe('missing-scenario');
  });

  it('trims whitespace from new group and scenario labels', () => {
    const result = promoteToFeatureGroups([], makeScenario(), {
      newGroupName: '  spaced  ',
      newScenarioName: '  trimmed  ',
    });
    expect(result.featureGroups[0].name).toBe('spaced');
    expect(result.featureGroups[0].scenarios[0].name).toBe('trimmed');
  });
});

function makeCollection(): RequestCollection {
  return {
    id: 'col-1', name: 'User API', mode: 'multi-env',
    baseUrls: { env1: 'https://api.example.com' },
    requests: [
      { id: 'r1', name: 'List Users', method: 'GET', url: '/users', headers: [], body: '', auth: { type: 'none' } },
      { id: 'r2', name: 'Get User', method: 'GET', url: '/users/{id}', headers: [], body: '', auth: { type: 'none' } },
    ],
    folders: [
      {
        id: 'f1', name: 'Admin',
        requests: [
          { id: 'r3', name: 'Delete User', method: 'DELETE', url: '/admin/users/{id}', headers: [], body: '', auth: { type: 'basic', username: 'admin', password: 'pass' } },
        ],
      },
    ],
  };
}

function makePromotionContext(col: RequestCollection): PromotionContext {
  return {
    collection: col,
    selectedEnvId: 'env1',
    environments: [{ id: 'env1', name: 'DEV' }],
    globalAuthProfiles: [],
    microservices: [],
  };
}

describe('batchPromoteCollection', () => {
  it('maps collection to FeatureGroup correctly', () => {
    const col = makeCollection();
    const { featureGroup } = batchPromoteCollection(col, makePromotionContext(col));
    expect(featureGroup.name).toBe('User API');
    expect(featureGroup.scenarios.length).toBe(2);
  });

  it('maps folders to TestScenarios', () => {
    const col = makeCollection();
    const { featureGroup } = batchPromoteCollection(col, makePromotionContext(col));
    const folderScenario = featureGroup.scenarios.find(s => s.name === 'Admin');
    expect(folderScenario).toBeTruthy();
    expect(folderScenario!.tests).toHaveLength(1);
    expect(folderScenario!.tests[0].name).toBe('Delete User');
  });

  it('maps each request to a test', () => {
    const col = makeCollection();
    const { featureGroup, promotedRequestIds } = batchPromoteCollection(col, makePromotionContext(col));
    const rootScenario = featureGroup.scenarios.find(s => s.name === 'User API');
    expect(rootScenario!.tests).toHaveLength(2);
    expect(promotedRequestIds).toContain('r1');
    expect(promotedRequestIds).toContain('r2');
    expect(promotedRequestIds).toContain('r3');
  });

  it('respects selected request IDs filter', () => {
    const col = makeCollection();
    const selected = new Set(['r1', 'r3']);
    const { featureGroup, promotedRequestIds } = batchPromoteCollection(col, makePromotionContext(col), selected);
    expect(promotedRequestIds).toEqual(['r1', 'r3']);
    const rootSc = featureGroup.scenarios.find(s => s.name === 'User API');
    expect(rootSc!.tests).toHaveLength(1);
    expect(rootSc!.tests[0].name).toBe('List Users');
  });

  it('promotes nested folder scenarios after root batch', () => {
    const col: RequestCollection = {
      ...makeCollection(),
      requests: [{ id: 'r1', name: 'Only Root', method: 'GET', url: '/', headers: [], body: '', auth: { type: 'none' } }],
      folders: [
        {
          id: 'outer',
          name: 'Outer',
          requests: [{ id: 'rO', name: 'Outer Req', method: 'GET', url: '/o', headers: [], body: '', auth: { type: 'none' } }],
          folders: [{
            id: 'inner',
            name: 'Inner',
            requests: [{ id: 'rI', name: 'Nested', method: 'POST', url: '/i', headers: [], body: '', auth: { type: 'none' } }],
            folders: [],
          }],
        },
      ],
    };
    const ctx = makePromotionContext(col);
    const { featureGroup, promotedRequestIds } = batchPromoteCollection(col, ctx);
    const names = featureGroup.scenarios.map(s => s.name);
    expect(names).toContain('Inner');
    expect(promotedRequestIds).toEqual(expect.arrayContaining(['r1', 'rO', 'rI']));
    const inner = featureGroup.scenarios.find(s => s.name === 'Inner');
    expect(inner?.tests).toHaveLength(1);
    expect(inner?.tests[0].name).toBe('Nested');
  });

  it('maps folder-only selections when root stays empty after filter', () => {
    const col = makeCollection();
    const selected = new Set(['r3']);
    const { featureGroup, promotedRequestIds } = batchPromoteCollection(col, makePromotionContext(col), selected);
    expect(promotedRequestIds).toEqual(['r3']);
    expect(featureGroup.scenarios.every(s => s.name !== col.name)).toBe(true);
    expect(featureGroup.scenarios.find(s => s.name === 'Admin')).toBeTruthy();
  });

  it('promotes only root rows when folders array is omitted', () => {
    const col: RequestCollection = {
      ...makeCollection(),
      folders: undefined,
    };
    const { featureGroup, promotedRequestIds } = batchPromoteCollection(col, makePromotionContext(col));
    expect(featureGroup.scenarios.length).toBe(1);
    expect(featureGroup.scenarios[0].name).toBe(col.name);
    expect(promotedRequestIds).toEqual(['r1', 'r2']);
  });

  it('fills targetEnvId and targetSvcId on generated feature groups', () => {
    const col = makeCollection();
    const ctx = makePromotionContext(col);
    const { featureGroup } = batchPromoteCollection(col, ctx, undefined, undefined, 'env-x', 'svc-x');
    expect(featureGroup.environmentId).toBe('env-x');
    expect(featureGroup.microserviceId).toBe('svc-x');
  });

  it('skips folders whose requests are omitted by bulk selection filters', () => {
    const col: RequestCollection = {
      ...makeCollection(),
      folders: [
        ...makeCollection().folders,
        {
          id: 'empty-peer',
          name: 'Muted',
          requests: [
            { id: 'muted-only', name: 'Skip', method: 'GET', url: '/', headers: [], body: '', auth: { type: 'none' } },
          ],
        },
      ],
    };
    const selected = new Set(['r1', 'r3']);
    const { featureGroup } = batchPromoteCollection(col, makePromotionContext(col), selected);
    expect(featureGroup.scenarios.find(s => s.name === 'Muted')).toBeUndefined();
    expect(featureGroup.scenarios.find(s => s.name === 'Admin')).toBeTruthy();
  });
});
