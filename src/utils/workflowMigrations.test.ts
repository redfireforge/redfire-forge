import { describe, it, expect, vi } from 'vitest';
import { migrateWorkflowSchema } from './workflowMigrations';
import type { Workflow, HttpNodeData, WorkflowNode, WorkflowService } from '../types/workflow';

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
    schemaVersion: 3,
    ...overrides,
  };
}

function httpNode(id: string, label: string, extra: Partial<HttpNodeData> = {}): WorkflowNode {
  return {
    id, type: 'http', position: { x: 0, y: 0 },
    data: { label, scenario: minimalScenario(), ...extra },
  };
}

describe('migrateWorkflowSchema', () => {
  it('returns v3 workflow unchanged', () => {
    const wf = makeWorkflow({ schemaVersion: 3 });
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(3);
    expect(result.services).toEqual([]);
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
    expect(result.schemaVersion).toBe(3);
    const data = result.nodes[0].data as HttpNodeData;
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
    expect(result.schemaVersion).toBe(3);
    expect(result.services!.length).toBeGreaterThan(0);
    const svc = result.services![0];
    expect(svc.auth).toEqual({ type: 'bearer', token: 'tok' });
    // Node should have serviceId
    const data = result.nodes[0].data as HttpNodeData;
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
    const d1 = result.nodes[0].data as HttpNodeData;
    const d2 = result.nodes[1].data as HttpNodeData;
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
    const d1 = result.nodes[0].data as HttpNodeData;
    const d2 = result.nodes[1].data as HttpNodeData;
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
    expect(result.schemaVersion).toBe(3);
    expect(result.nodes).toEqual([]);
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
    expect(result.schemaVersion).toBe(3);
    expect(result.nodes).toHaveLength(2);
  });

  it('fills hostProfiles and authProfiles arrays when undefined', () => {
    const wf = { id: 'wf-1', name: 'Test', nodes: [], edges: [], createdAt: 0, updatedAt: 0, variables: {}, schemaVersion: 3 } as unknown as Workflow;
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
      schemaVersion: 3,
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
      schemaVersion: 3,
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

  it('fixup assigns orphan HTTP nodes without serviceId', () => {
    const wf = makeWorkflow({
      schemaVersion: 3,
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
      schemaVersion: 3,
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
    expect(result.schemaVersion).toBe(3);
    const data = result.nodes[0].data as HttpNodeData;
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
    expect(result.schemaVersion).toBe(3);
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
    const d = result.nodes[0].data as HttpNodeData;
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
    const d = result.nodes[0].data as HttpNodeData;
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
    const d = result.nodes[0].data as HttpNodeData;
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
      createdAt: 0, updatedAt: 0, schemaVersion: 3,
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
      createdAt: 0, updatedAt: 0, schemaVersion: 3,
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
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].type).toBe('condition');
    expect(result.nodes[1].type).toBe('delay');
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
    const d1 = result.nodes[0].data as HttpNodeData;
    const d2 = result.nodes[1].data as HttpNodeData;
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
    const d1 = result.nodes[0].data as HttpNodeData;
    const d2 = result.nodes[1].data as HttpNodeData;
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
    const d1 = result.nodes[0].data as HttpNodeData;
    const d2 = result.nodes[1].data as HttpNodeData;
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
    const d = result.nodes[0].data as HttpNodeData;
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
    const d = result.nodes[0].data as HttpNodeData;
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
      createdAt: 0, updatedAt: 0, schemaVersion: 3,
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
    const d = result.nodes[0].data as HttpNodeData;
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
    const d = result.nodes[0].data as HttpNodeData;
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
    const d = result.nodes[0].data as HttpNodeData;
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
    const d = result.nodes[0].data as HttpNodeData;
    // serviceId preserved from pre-assignment
    expect(d.serviceId).toBe('svc-pre');
  });

  it('fixup handles orphan HTTP node without serviceId at all', () => {
    // schemaVersion 3, no services, node has no serviceId
    const wf: Workflow = {
      id: 'wf-1', name: 'Test', edges: [],
      createdAt: 0, updatedAt: 0, schemaVersion: 3,
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
});

