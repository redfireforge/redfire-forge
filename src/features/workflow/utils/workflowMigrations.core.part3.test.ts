import { describe, it, expect, vi } from 'vitest';
import { migrateWorkflowSchema } from './workflowMigrations';
import { Workflow, HttpNodeData, WorkflowNode } from '../types/workflow';

// Deterministic UUID for tests
let uuidCounter = 0;
vi.mock('uuid', () => ({ v4: () => `test-uuid-${uuidCounter++}` }));

function minimalScenario(): HttpNodeData['scenario'] {
  return {
    id: 's', name: 's', url: '/', method: 'GET',
    headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
  };
}

function _makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
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

describe('migrateWorkflowSchema', () => {

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

describe('fixupOverGroupedServices — microservice-bound services', () => {
  it('preserves a multi-node service that has microserviceId', () => {
    const svcId = 'svc-ms-bound';
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 6,
      variables: {}, hostProfiles: [], authProfiles: [],
      services: [{
        id: svcId, name: 'sales-sim',
        microserviceId: 'ms-123',
        endpoints: [{ envId: 'e1', url: 'https://api.example.com', enabled: true, authMode: 'inherit' as const, source: 'microservice' as const }],
      }],
      nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'n1', type: 'http', position: { x: 0, y: 100 }, data: { label: 'RuleFact API', serviceId: svcId, scenario: { ...minimalScenario(), url: '/rulefact' } } },
        { id: 'n2', type: 'http', position: { x: 0, y: 200 }, data: { label: 'Kafka Status', serviceId: svcId, scenario: { ...minimalScenario(), url: '/kafka/status' } } },
        { id: 'n3', type: 'http', position: { x: 0, y: 300 }, data: { label: 'Trial Offer', serviceId: svcId, scenario: { ...minimalScenario(), url: '/trial-offer' } } },
      ],
      edges: [],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.services).toHaveLength(1);
    expect(result.services[0].id).toBe(svcId);
    expect(result.services[0].name).toBe('sales-sim');
    expect(result.services[0].microserviceId).toBe('ms-123');
    for (const n of result.nodes.filter(n => n.type === 'http')) {
      expect((n.data as HttpNodeData).serviceId).toBe(svcId);
    }
  });

  it('still splits non-microservice services with different origins', () => {
    const svcId = 'svc-no-ms';
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 6,
      variables: {}, hostProfiles: [], authProfiles: [],
      services: [{
        id: svcId, name: 'mixed',
        endpoints: [],
      }],
      nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'n1', type: 'http', position: { x: 0, y: 100 }, data: { label: 'API A', serviceId: svcId, scenario: { ...minimalScenario(), url: 'https://a.example.com/foo' } } },
        { id: 'n2', type: 'http', position: { x: 0, y: 200 }, data: { label: 'API B', serviceId: svcId, scenario: { ...minimalScenario(), url: 'https://b.example.com/bar' } } },
      ],
      edges: [],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.services.length).toBeGreaterThan(1);
  });
});
