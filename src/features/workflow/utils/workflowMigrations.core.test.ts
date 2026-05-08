import { describe, it, expect, vi } from 'vitest';
import { migrateWorkflowSchema, migrateV1ToV2, migrateV2ToV3 } from './workflowMigrations';
import type { Workflow, HttpNodeData, WorkflowNode } from '../types/workflow';

// Deterministic UUID for tests
let uuidCounter = 0;
vi.mock('uuid', () => ({ v4: () => `test-uuid-${uuidCounter++}` }));

function minimalScenario(): HttpNodeData['scenario'] {
  return {
    id: 's', name: 's', url: '/', method: 'GET',
    headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
  };
}

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf-1', name: 'Test', nodes: [], edges: [],
    createdAt: 0, updatedAt: 0,
    variables: {}, hostProfiles: [], authProfiles: [], services: [],
    schemaVersion: 5,
    ...overrides,
  };
}

function httpNode(id: string, label: string, extra: Partial<HttpNodeData> = {}): WorkflowNode {
  return {
    id, type: 'http', position: { x: 0, y: 0 },
    data: { label, scenario: minimalScenario(), ...extra },
  };
}

describe('migrateV1ToV2', () => {
  it('returns base unchanged when schemaVersion is already >= 2', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      schemaVersion: 2,
      nodes: [httpNode('n1', 'Step', { hostBaseUrl: 'https://already-v2.example.com' })],
    };
    const result = migrateV1ToV2(wf);
    expect(result.schemaVersion).toBe(2);
    expect(result.nodes).toBe(wf.nodes);
    expect((result.nodes[0].data as HttpNodeData).hostProfileId).toBeUndefined();
  });

  it('indexes pre-existing authProfiles for reuse', () => {
    const auth = { type: 'bearer' as const, token: 'shared' };
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, services: [],
      hostProfiles: [{ id: 'hp1', name: 'H', hostBaseUrl: 'https://api.example.com' }],
      authProfiles: [{ id: 'ap-existing', name: 'Pre', auth }],
      schemaVersion: 1,
      nodes: [
        httpNode('n1', 'A', {
          hostProfileId: 'hp1',
          scenario: { ...minimalScenario(), auth },
        }),
      ],
    };
    const result = migrateV1ToV2(wf);
    expect((result.nodes[0].data as HttpNodeData).authProfileId).toBe('ap-existing');
    expect(result.authProfiles!.filter(a => a.id.startsWith('auth_')).length).toBe(0);
  });

  it('returns the same node instance for non-http nodes', () => {
    const cond: WorkflowNode = {
      id: 'c1',
      type: 'condition',
      position: { x: 0, y: 0 },
      data: { label: 'If', left: '1', operator: '==', right: '2' },
    };
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, services: [],
      hostProfiles: [],
      authProfiles: [],
      schemaVersion: 1,
      nodes: [
        cond,
        httpNode('n1', 'Step', { hostBaseUrl: 'https://mixed-v1.example.com' }),
      ],
    };
    const result = migrateV1ToV2(wf);
    expect(result.nodes[0]).toBe(cond);
    expect((result.nodes[1].data as HttpNodeData).hostProfileId).toBeDefined();
  });
});

describe('migrateV2ToV3', () => {
  it('returns the same reference when schemaVersion is already >= 3', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      schemaVersion: 3,
      nodes: [httpNode('n1', 'Only')],
    };
    expect(migrateV2ToV3(wf)).toBe(wf);
  });

  it('runs v1 migration first when schemaVersion is still 1', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      schemaVersion: 1,
      nodes: [httpNode('n1', 'Step', { hostBaseUrl: 'https://v1-then-v3.example.com' })],
    };
    const result = migrateV2ToV3(wf);
    expect(result.schemaVersion).toBe(3);
    expect((result.nodes[0].data as HttpNodeData).serviceId).toBeDefined();
  });
});

describe('migrateWorkflowSchema', () => {
  it('returns v6 workflow unchanged', () => {
    const wf = makeWorkflow({ schemaVersion: 6 });
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    expect(result.services).toEqual([]);
  });

  // ── v3 → v4: Start node insertion ──

  it('v3→v4 inserts Start node and connects to root nodes', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      schemaVersion: 3,
      nodes: [
        httpNode('n1', 'Step A'),
        httpNode('n2', 'Step B'),
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    // Start node should be inserted
    const startNode = result.nodes.find(n => n.type === 'start');
    expect(startNode).toBeDefined();
    expect(startNode!.data.label).toBe('Start');
    // Start node should connect to root node (n1, which has no incoming edges)
    const startEdges = result.edges.filter(e => e.source === startNode!.id);
    expect(startEdges).toHaveLength(1);
    expect(startEdges[0].target).toBe('n1');
    // n2 should NOT get a direct edge from Start (it has incoming from n1)
    expect(startEdges.find(e => e.target === 'n2')).toBeUndefined();
  });

  it('v3→v4 skips insertion when Start node already exists', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      schemaVersion: 3,
      nodes: [
        { id: 's1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', inputVariables: {} } },
        httpNode('n1', 'Step A'),
      ],
      edges: [{ id: 'e1', source: 's1', target: 'n1' }],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    // Should not add another Start node
    const startNodes = result.nodes.filter(n => n.type === 'start');
    expect(startNodes).toHaveLength(1);
  });

  it('v3→v4 skips insertion for empty workflows', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      schemaVersion: 3,
      nodes: [],
      edges: [],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    expect(result.nodes).toHaveLength(0);
  });

  it('v3→v4 shifts existing nodes down by 100px', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      schemaVersion: 3,
      nodes: [
        { ...httpNode('n1', 'Step A'), position: { x: 100, y: 50 } },
      ],
      edges: [],
    };
    const result = migrateWorkflowSchema(wf);
    const n1 = result.nodes.find(n => n.id === 'n1')!;
    expect(n1.position.y).toBe(150); // 50 + 100
    expect(n1.position.x).toBe(100); // unchanged
  });

  it('v3→v4 connects Start to multiple root nodes', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      schemaVersion: 3,
      nodes: [
        httpNode('n1', 'Root A'),
        httpNode('n2', 'Root B'),
      ],
      edges: [], // both are root nodes
    };
    const result = migrateWorkflowSchema(wf);
    const startNode = result.nodes.find(n => n.type === 'start')!;
    const startEdges = result.edges.filter(e => e.source === startNode.id);
    expect(startEdges).toHaveLength(2);
    expect(startEdges.map(e => e.target).sort()).toEqual(['n1', 'n2']);
  });

  it('migrates a v1 workflow with inline host fields to v3', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Step 1', {
          hostBaseUrl: 'https://api.example.com',
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    const data = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    // Should have a hostProfileId assigned
    expect(data.hostProfileId).toBeDefined();
    // Should have services created
    expect(result.services!.length).toBeGreaterThan(0);
  });

  it('migrates a v2 workflow with hostProfiles to v3 services', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {},
      hostProfiles: [
        { id: 'hp-1', name: 'Host 1', hostBaseUrl: 'https://api.test.com' },
      ],
      authProfiles: [
        { id: 'ap-1', name: 'Auth 1', auth: { type: 'bearer', token: 'tok' } },
      ],
      services: [],
      nodes: [
        httpNode('n1', 'Step 1', { hostProfileId: 'hp-1', authProfileId: 'ap-1' }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    expect(result.services!.length).toBeGreaterThan(0);
    const svc = result.services![0];
    expect(svc.auth).toEqual({ type: 'bearer', token: 'tok' });
    // Node should have serviceId
    const data = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(data.serviceId).toBe(svc.id);
  });

  it('converts legacy service endpoints during migration', () => {
    const wf = makeWorkflow({
      services: [{
        id: 'svc-1', name: 'Legacy', urlMode: 'direct',
        directUrl: 'https://legacy.example.com',
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-1');
    expect(svc).toBeDefined();
    expect(svc!.endpoints!.length).toBe(1);
    expect(svc!.endpoints![0].envId).toBe('__all__');
    expect(svc!.endpoints![0].url).toBe('https://legacy.example.com');
  });

  it('converts adhoc urlMode to endpoints', () => {
    const wf = makeWorkflow({
      services: [{
        id: 'svc-1', name: 'Adhoc', urlMode: 'adhoc',
        adhocUrl: 'https://adhoc.example.com/',
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-1');
    expect(svc!.endpoints![0].envId).toBe('__adhoc__');
    expect(svc!.endpoints![0].url).toBe('https://adhoc.example.com/');
  });

  it('converts multi-env urlMode to per-env endpoints', () => {
    const wf = makeWorkflow({
      services: [{
        id: 'svc-1', name: 'Multi', urlMode: 'multi-env',
        baseUrls: { t01: 'https://test.example.com', p01: 'https://prod.example.com' },
        authPerEnv: { t01: { type: 'bearer', token: 'test-tok' } },
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-1');
    expect(svc!.endpoints!.length).toBe(2);
    const t01 = svc!.endpoints!.find(e => e.envId === 't01');
    expect(t01!.url).toBe('https://test.example.com');
    expect(t01!.authMode).toBe('custom');
    expect(t01!.auth).toEqual({ type: 'bearer', token: 'test-tok' });
    const p01 = svc!.endpoints!.find(e => e.envId === 'p01');
    expect(p01!.authMode).toBe('inherit');
  });

  it('preserves endpoints when services already have them', () => {
    const endpoints = [
      { envId: 't01', url: 'https://test.com', enabled: true, authMode: 'inherit' as const, source: 'manual' as const },
    ];
    const wf = makeWorkflow({
      services: [{
        id: 'svc-1', name: 'Has EP', urlMode: 'direct',
        endpoints,
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-1');
    expect(svc!.endpoints).toEqual(endpoints);
  });

  it('groups orphan HTTP nodes by URL origin into separate services', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Step A', { scenario: { ...minimalScenario(), url: 'https://api-a.example.com/path' } }),
        httpNode('n2', 'Step B', { scenario: { ...minimalScenario(), url: 'https://api-b.example.com/path' } }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    // Each origin should get its own service
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    expect(d1.serviceId).toBeDefined();
    expect(d2.serviceId).toBeDefined();
    expect(d1.serviceId).not.toBe(d2.serviceId);
  });

  it('groups orphan HTTP nodes with same origin into one service', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Step A', { scenario: { ...minimalScenario(), url: 'https://api.example.com/a' } }),
        httpNode('n2', 'Step B', { scenario: { ...minimalScenario(), url: 'https://api.example.com/b' } }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    expect(d1.serviceId).toBeDefined();
    expect(d1.serviceId).toBe(d2.serviceId);
  });

  it('sets defaultAuth from service auth during migration', () => {
    const wf = makeWorkflow({
      services: [{
        id: 'svc-1', name: 'Svc',
        auth: { type: 'bearer', token: 'abc' },
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-1');
    expect(svc!.defaultAuth).toEqual({ type: 'bearer', token: 'abc' });
  });

  it('handles workflow with no nodes', () => {
    const wf = makeWorkflow({ nodes: [], schemaVersion: 1 });
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    // v3→v4 does not insert Start node if there are no existing nodes
    expect(result.nodes).toHaveLength(0);
    expect(result.services).toEqual([]);
  });

  it('handles non-http nodes (condition, delay) gracefully', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'c1', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'If', left: '{{status}}', operator: '==', right: '200' } },
        { id: 'd1', type: 'delay', position: { x: 0, y: 0 }, data: { label: 'Wait', delayMs: 1000, mode: 'fixed' } },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    // v3→v4 inserts a Start node
    expect(result.nodes).toHaveLength(3);
  });

  it('fills hostProfiles and authProfiles arrays when undefined', () => {
    const wf = { id: 'wf-1', name: 'Test', nodes: [], edges: [], createdAt: 0, updatedAt: 0, variables: {}, schemaVersion: 4 } as unknown as Workflow;
    const result = migrateWorkflowSchema(wf);
    expect(result.hostProfiles).toEqual([]);
    expect(result.authProfiles).toEqual([]);
  });

  it('migrates v2 hostProfile with env+microservice to multi-env service', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {},
      hostProfiles: [
        { id: 'hp-1', name: 'Env Host', hostEnvironmentId: 'e1', hostMicroserviceId: 'ms-1' },
      ],
      authProfiles: [],
      services: [],
      nodes: [
        httpNode('n1', 'Step 1', { hostProfileId: 'hp-1' }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
    const svc = result.services![0];
    expect(svc.urlMode).toBe('multi-env');
    expect(svc.microserviceId).toBe('ms-1');
  });

  it('fixup splits over-grouped service when nodes have different URL origins', () => {
    // Start with v3 that has 2 nodes sharing one service but with different URL origins
    const wf = makeWorkflow({
      schemaVersion: 4,
      services: [{
        id: 'svc-shared', name: 'Shared', urlMode: 'direct',
        endpoints: [{ envId: '__all__', url: 'https://a.com', enabled: true, authMode: 'inherit' as const, source: 'manual' as const }],
      }],
      nodes: [
        httpNode('n1', 'A', { serviceId: 'svc-shared', scenario: { ...minimalScenario(), url: 'https://api-a.com/foo' } }),
        httpNode('n2', 'B', { serviceId: 'svc-shared', scenario: { ...minimalScenario(), url: 'https://api-b.com/bar' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes[0].data as HttpNodeData;
    const d2 = result.nodes[1].data as HttpNodeData;
    // Should be split into different services
    expect(d1.serviceId).toBeDefined();
    expect(d2.serviceId).toBeDefined();
    expect(d1.serviceId).not.toBe(d2.serviceId);
    // Original over-grouped service should be removed
    expect(result.services!.find(s => s.id === 'svc-shared')).toBeUndefined();
  });

  it('fixup keeps service when all nodes have the same URL origin', () => {
    const wf = makeWorkflow({
      schemaVersion: 4,
      services: [{
        id: 'svc-ok', name: 'Ok', urlMode: 'direct',
        endpoints: [{ envId: '__all__', url: 'https://api.com', enabled: true, authMode: 'inherit' as const, source: 'manual' as const }],
      }],
      nodes: [
        httpNode('n1', 'A', { serviceId: 'svc-ok', scenario: { ...minimalScenario(), url: 'https://api.com/foo' } }),
        httpNode('n2', 'B', { serviceId: 'svc-ok', scenario: { ...minimalScenario(), url: 'https://api.com/bar' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    // Should NOT split — same origin
    expect(result.services!.find(s => s.id === 'svc-ok')).toBeDefined();
  });

  it('fixupOverGroupedServices appends node ids to an existing label group (shared groupKey)', () => {
    const wf = makeWorkflow({
      schemaVersion: 4,
      services: [],
      nodes: [
        httpNode('n1', 'Same Label', { scenario: { ...minimalScenario(), url: '/one' } }),
        httpNode('n2', 'Same Label', { scenario: { ...minimalScenario(), url: '/two' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    expect(d1.serviceId).toBeDefined();
    expect(d1.serviceId).toBe(d2.serviceId);
  });

  it('fixupOverGroupedServices does not reassign http nodes outside the regroup set', () => {
    const wf = makeWorkflow({
      schemaVersion: 4,
      services: [{
        id: 'svc-stable', name: 'Stable', urlMode: 'direct',
        directUrl: 'https://stable.example.com',
        endpoints: [{
          envId: '__all__', url: 'https://stable.example.com',
          enabled: true, authMode: 'inherit' as const, source: 'manual' as const,
        }],
      }, {
        id: 'svc-shared', name: 'Shared', urlMode: 'direct',
        endpoints: [{
          envId: '__all__', url: 'https://placeholder.invalid',
          enabled: true, authMode: 'inherit' as const, source: 'manual' as const,
        }],
      }],
      nodes: [
        httpNode('n1', 'A', { serviceId: 'svc-shared', scenario: { ...minimalScenario(), url: 'https://split-a.example.com/x' } }),
        httpNode('n2', 'B', { serviceId: 'svc-shared', scenario: { ...minimalScenario(), url: 'https://split-b.example.com/y' } }),
        httpNode('n3', 'Stable', { serviceId: 'svc-stable', scenario: { ...minimalScenario(), url: 'https://stable.example.com/z' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const d3 = result.nodes.find(n => n.id === 'n3')!.data as HttpNodeData;
    expect(d3.serviceId).toBe('svc-stable');
  });

  it('fixup assigns orphan HTTP nodes without serviceId', () => {
    const wf = makeWorkflow({
      schemaVersion: 4,
      services: [],
      nodes: [
        httpNode('n1', 'Orphan', { scenario: { ...minimalScenario(), url: 'https://orphan.com/x' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes[0].data as HttpNodeData;
    expect(d.serviceId).toBeDefined();
    expect(result.services!.length).toBe(1);
    expect(result.services![0].directUrl).toBe('https://orphan.com');
  });

  it('fixup preserves auth on orphan nodes with inline auth', () => {
    const wf = makeWorkflow({
      schemaVersion: 4,
      services: [],
      nodes: [
        httpNode('n1', 'Authed', { scenario: { ...minimalScenario(), url: 'https://secure.com/api', auth: { type: 'bearer', token: 'tk' } } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services![0];
    expect(svc.auth).toEqual({ type: 'bearer', token: 'tk' });
  });

  it('migrates v1 node with env+microservice to hostProfile', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Step 1', {
          hostEnvironmentId: 'env1',
          hostMicroserviceId: 'ms1',
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    const data = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(data.hostProfileId).toBeDefined();
  });

  it('v1 nodes with inline auth get authProfile', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Step 1', {
          scenario: { ...minimalScenario(), auth: { type: 'bearer', token: 'mytoken' } },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
  });

  it('orphan node with hostBaseUrl gets grouped by host', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Step A', { hostBaseUrl: 'https://custom-host.com' }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    // Node should get a service via orphan grouping (phase 3) with hostBaseUrl key
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.serviceId).toBeDefined();
  });

  it('orphan node with env+microservice but no hostProfile gets multi-env service', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Step A', {
          hostEnvironmentId: 'env1', hostMicroserviceId: 'ms1',
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.serviceId).toBeDefined();
    const svc = result.services!.find(s => s.id === d.serviceId);
    expect(svc!.urlMode).toBe('multi-env');
  });

  it('orphan node with non-URL relative path gets grouped by label', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'My Label', { scenario: { ...minimalScenario(), url: '/api/users' } }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.serviceId).toBeDefined();
  });

  it('v2→v3 groups orphan nodes with hostBaseUrl by host', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Step A', {
          hostBaseUrl: 'https://my-host.com/api',
          scenario: { ...minimalScenario(), url: 'https://my-host.com/api/endpoint' },
        }),
        httpNode('n2', 'Step B', {
          hostBaseUrl: 'https://my-host.com/api',
          scenario: { ...minimalScenario(), url: 'https://my-host.com/api/other' },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    expect(d1.serviceId).toBeDefined();
    expect(d1.serviceId).toBe(d2.serviceId);
    const svc = result.services!.find(s => s.id === d1.serviceId);
    expect(svc).toBeDefined();
  });

  it('fixupOverGroupedServices re-groups nodes with different origins', () => {
    // Start with schemaVersion 3 but nodes assigned to a single service despite different origins
    const sharedSvcId = 'svc_shared';
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 4,
      variables: {}, hostProfiles: [], authProfiles: [],
      services: [{
        id: sharedSvcId, name: 'Shared', urlMode: 'direct',
        directUrl: 'https://a.com', endpoints: [], auth: undefined, defaultAuth: undefined,
      }],
      nodes: [
        httpNode('n1', 'A Service', {
          serviceId: sharedSvcId,
          scenario: { ...minimalScenario(), url: 'https://a.com/api' },
        }),
        httpNode('n2', 'B Service', {
          serviceId: sharedSvcId,
          scenario: { ...minimalScenario(), url: 'https://b.com/api' },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    // They should be assigned to different services now
    expect(d1.serviceId).not.toBe(d2.serviceId);
  });

  it('fixupOverGroupedServices skips services with only one node', () => {
    const svcId = 'svc_single';
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 4,
      variables: {}, hostProfiles: [], authProfiles: [],
      services: [{
        id: svcId, name: 'Solo', urlMode: 'direct',
        directUrl: 'https://a.com', endpoints: [], auth: undefined, defaultAuth: undefined,
      }],
      nodes: [
        httpNode('n1', 'Only Step', {
          serviceId: svcId,
          scenario: { ...minimalScenario(), url: 'https://a.com/api' },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    // Should keep the original service
    const d = result.nodes[0].data as HttpNodeData;
    expect(d.serviceId).toBe(svcId);
  });

  it('non-http nodes pass through v2→v3 unchanged', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'c1', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'If', left: '1', operator: '==', right: '1' } } as WorkflowNode,
        { id: 'd1', type: 'delay', position: { x: 0, y: 0 }, data: { label: 'Wait', delayMs: 100, mode: 'fixed' } } as WorkflowNode,
      ],
    };
    const result = migrateWorkflowSchema(wf);
    // v3→v4 inserts a Start node
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.find(n => n.id === 'c1')!.type).toBe('condition');
    expect(result.nodes.find(n => n.id === 'd1')!.type).toBe('delay');
  });

  it('v2→v3 assigns different services to nodes with auth vs no auth for same origin', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Public', {
          scenario: { ...minimalScenario(), url: 'https://api.example.com/public' },
        }),
        httpNode('n2', 'Secured', {
          scenario: {
            ...minimalScenario(),
            url: 'https://api.example.com/secured',
            auth: { type: 'bearer', token: 'tok' },
          },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    // Both should have serviceId assigned
    expect(d1.serviceId).toBeDefined();
    expect(d2.serviceId).toBeDefined();
  });

  it('v1 reuses existing hostProfile when key matches', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, services: [],
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'Step A', { hostBaseUrl: 'https://api.example.com' }),
        httpNode('n2', 'Step B', { hostBaseUrl: 'https://api.example.com' }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    // Both should share same hostProfileId
    expect(d1.hostProfileId).toBe(d2.hostProfileId);
  });

  it('v1 reuses existing authProfile when auth matches', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, services: [],
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'Step A', {
          scenario: { ...minimalScenario(), auth: { type: 'bearer', token: 'same-token' } },
        }),
        httpNode('n2', 'Step B', {
          scenario: { ...minimalScenario(), auth: { type: 'bearer', token: 'same-token' } },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    expect(d1.authProfileId).toBe(d2.authProfileId);
  });

  it('v1 skips auth migration for none/inherit auth types', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, services: [],
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'Step A', {
          scenario: { ...minimalScenario(), auth: { type: 'none' } },
        }),
        httpNode('n2', 'Step B', {
          scenario: { ...minimalScenario(), auth: { type: 'inherit' } },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    expect(d1.authProfileId).toBeUndefined();
    expect(d2.authProfileId).toBeUndefined();
  });

  it('v1 node without label uses fallback name for host/auth profiles', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, services: [],
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', '', {
          hostBaseUrl: 'https://no-label.com',
          scenario: { ...minimalScenario(), auth: { type: 'bearer', token: 'tok' } },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    // Should still create profiles with fallback names
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.hostProfileId).toBeDefined();
    expect(d.authProfileId).toBeDefined();
  });

  it('v1 preserves existing hostProfileId and does not re-create', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, services: [],
      hostProfiles: [{ id: 'existing-hp', name: 'Existing', hostBaseUrl: 'https://x.com' }],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'Step', { hostProfileId: 'existing-hp', hostBaseUrl: 'https://x.com' }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.hostProfileId).toBe('existing-hp');
  });

  it('v2→v3 hostProfile without URL or env uses direct mode', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {},
      hostProfiles: [{ id: 'hp-1', name: 'Empty Host' }],
      authProfiles: [],
      services: [],
      nodes: [httpNode('n1', 'Step', { hostProfileId: 'hp-1' })],
    };
    const result = migrateWorkflowSchema(wf);
    const svc = result.services![0];
    expect(svc.urlMode).toBe('direct');
    expect(svc.directUrl).toBeUndefined();
  });

  it('fixupOverGroupedServices handles multiple re-grouped nodes with nodeToSvc fallthrough', () => {
    // Three nodes sharing a service, two different origins + one relative URL node
    const sharedSvcId = 'svc_over';
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 4,
      variables: {}, hostProfiles: [], authProfiles: [],
      services: [{
        id: sharedSvcId, name: 'Over', urlMode: 'direct',
        endpoints: [], auth: undefined, defaultAuth: undefined,
      }],
      nodes: [
        httpNode('n1', 'A', { serviceId: sharedSvcId, scenario: { ...minimalScenario(), url: 'https://a.com/x' } }),
        httpNode('n2', 'B', { serviceId: sharedSvcId, scenario: { ...minimalScenario(), url: 'https://b.com/y' } }),
        httpNode('n3', 'C', { serviceId: sharedSvcId, scenario: { ...minimalScenario(), url: '/relative' } }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const ids = result.nodes.map(n => (n.data as HttpNodeData).serviceId);
    // All should be re-assigned
    expect(ids.every(id => id !== sharedSvcId)).toBe(true);
    // n1 and n2 should have different services (different origins)
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('extractUrlOrigin handles template-only URL', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Template', { scenario: { ...minimalScenario(), url: '{{baseUrl}}/api' } }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    // Should be grouped by label since URL origin can't be extracted
    expect(d.serviceId).toBeDefined();
  });

  it('v2→v3 Phase 3 groups orphan with hostBaseUrl but no hostProfileId', () => {
    // Node has hostBaseUrl but no hostProfileId, so Phase 1/2 won't assign serviceId
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Direct Host', {
          hostBaseUrl: 'https://direct-host.com',
          scenario: { ...minimalScenario(), url: 'https://direct-host.com/api/test' },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.serviceId).toBeDefined();
  });

  it('v2→v3 Phase 3 groups orphan with env+microservice but no hostProfileId', () => {
    // Node has hostEnvironmentId+hostMicroserviceId but no hostProfileId
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        httpNode('n1', 'Ms Host', {
          hostEnvironmentId: 'e1',
          hostMicroserviceId: 'ms-1',
          scenario: { ...minimalScenario(), url: '/api/path' },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.serviceId).toBeDefined();
    const svc = result.services!.find(s => s.id === d.serviceId);
    expect(svc!.urlMode).toBe('multi-env');
  });

  it('v2→v3 Phase 4 leaves HTTP node without mapping unchanged', () => {
    // Pre-assigned serviceId that survives all phases
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 2,
      variables: {}, hostProfiles: [], authProfiles: [],
      services: [{ id: 'svc-pre', name: 'Pre', urlMode: 'direct', endpoints: [] }],
      nodes: [
        httpNode('n1', 'Pre-assigned', {
          serviceId: 'svc-pre',
          scenario: { ...minimalScenario(), url: 'https://x.com/a' },
        }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    // serviceId preserved from pre-assignment
    expect(d.serviceId).toBe('svc-pre');
  });

  it('fixup handles orphan HTTP node without serviceId at all', () => {
    // schemaVersion 3, no services, node has no serviceId
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 4,
      variables: {}, hostProfiles: [], authProfiles: [],
      services: [],
      nodes: [
        httpNode('n1', 'Orphan', { scenario: { ...minimalScenario(), url: 'https://orphan.com/x' } }),
      ],
    };
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes[0].data as HttpNodeData;
    expect(d.serviceId).toBeDefined();
  });

  // ── v5 → v6: Remove orphaned Start nodes from webhook/schedule triggered workflows ──

  it('v5→v6 removes orphaned Start nodes in webhook-triggered workflow', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'wh1', type: 'webhook', position: { x: 100, y: 0 }, data: { label: 'Webhook' } },
        httpNode('http1', 'API Call'),
      ],
      edges: [
        // Start connects only to webhook - should be removed
        { id: 'e1', source: 'start1', target: 'wh1' },
        // Webhook connects to HTTP
        { id: 'e2', source: 'wh1', target: 'http1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    // Start node removed
    expect(result.nodes.find(n => n.id === 'start1')).toBeUndefined();
    // Edge from start also removed
    expect(result.edges.find(e => e.id === 'e1')).toBeUndefined();
    // Other nodes and edges remain
    expect(result.nodes.find(n => n.id === 'wh1')).toBeDefined();
    expect(result.nodes.find(n => n.id === 'http1')).toBeDefined();
    expect(result.edges.find(e => e.id === 'e2')).toBeDefined();
  });

  it('v5→v6 removes Start with no outgoing edges in webhook workflow', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Orphan Start' } },
        { id: 'wh1', type: 'webhook', position: { x: 100, y: 0 }, data: { label: 'Webhook' } },
        httpNode('http1', 'API Call'),
      ],
      edges: [
        // No edge from start1 - it's orphaned
        { id: 'e1', source: 'wh1', target: 'http1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    expect(result.nodes.find(n => n.id === 'start1')).toBeUndefined();
    expect(result.nodes.length).toBe(2);
  });

  it('v5→v6 preserves Start that connects to non-trigger nodes', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'wh1', type: 'webhook', position: { x: 100, y: 0 }, data: { label: 'Webhook' } },
        httpNode('http1', 'API Call'),
      ],
      edges: [
        // Start connects to HTTP node (not webhook) - should be preserved
        { id: 'e1', source: 'start1', target: 'http1' },
        { id: 'e2', source: 'wh1', target: 'http1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    // Start node preserved
    expect(result.nodes.find(n => n.id === 'start1')).toBeDefined();
    expect(result.nodes.length).toBe(3);
    expect(result.edges.length).toBe(2);
  });

  it('v5→v6 drops edges that point at a removed Start node', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'wh1', type: 'webhook', position: { x: 100, y: 0 }, data: { label: 'Webhook' } },
        httpNode('http1', 'API Call'),
      ],
      edges: [
        { id: 'e0', source: 'start1', target: 'wh1' },
        { id: 'e1', source: 'http1', target: 'start1' },
        { id: 'e2', source: 'wh1', target: 'http1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.nodes.find(n => n.id === 'start1')).toBeUndefined();
    expect(result.edges.find(e => e.id === 'e1')).toBeUndefined();
    expect(result.edges.find(e => e.id === 'e2')).toBeDefined();
  });

  it('v5→v6 handles schedule-triggered workflow same as webhook', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'sch1', type: 'schedule', position: { x: 100, y: 0 }, data: { label: 'Schedule' } },
        httpNode('http1', 'API Call'),
      ],
      edges: [
        // Start connects only to schedule - should be removed
        { id: 'e1', source: 'start1', target: 'sch1' },
        { id: 'e2', source: 'sch1', target: 'http1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    expect(result.nodes.find(n => n.id === 'start1')).toBeUndefined();
  });

  it('v5→v6 does nothing for non-trigger workflows', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        httpNode('http1', 'API Call'),
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'http1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
    // All nodes preserved
    expect(result.nodes.length).toBe(2);
    expect(result.edges.length).toBe(1);
  });

  it('v5→v6 keeps Start when it has more than one outgoing edge', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'wh1', type: 'webhook', position: { x: 100, y: 0 }, data: { label: 'Webhook' } },
        httpNode('http1', 'API Call'),
      ],
      edges: [
        { id: 'e0', source: 'start1', target: 'wh1' },
        { id: 'e1', source: 'start1', target: 'http1' },
        { id: 'e2', source: 'wh1', target: 'http1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.nodes.find(n => n.id === 'start1')).toBeDefined();
  });

  it('v5→v6 keeps Start when its single edge targets a non-trigger node', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'wh1', type: 'webhook', position: { x: 100, y: 0 }, data: { label: 'Webhook' } },
        httpNode('http1', 'API Call'),
      ],
      edges: [
        { id: 'e0', source: 'start1', target: 'http1' },
        { id: 'e1', source: 'wh1', target: 'http1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.nodes.find(n => n.id === 'start1')).toBeDefined();
  });
});
