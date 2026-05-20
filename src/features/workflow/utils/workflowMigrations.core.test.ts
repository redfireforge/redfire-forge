import { describe, it, expect, vi } from 'vitest';
import { migrateV1ToV2, migrateV2ToV3 } from './workflowMigrations';
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
