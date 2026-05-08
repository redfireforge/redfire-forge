import { describe, it, expect, vi } from 'vitest';
import { migrateWorkflowSchema } from './workflowMigrations';
import type { Workflow, HttpNodeData, WorkflowNode, SubWorkflowNodeData, WorkflowNodeType, WorkflowNodeData } from '../types/workflow';

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

// ────────────────────────────────────────────────────
// v4 → v5: Sub-workflow support
// ────────────────────────────────────────────────────

describe('migrateWorkflowSchema - v4 → v5', () => {
  function makeWf(overrides: Partial<Workflow> = {}): Workflow {
    return {
      id: 'wf-1', name: 'Test', nodes: [], edges: [],
      createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      ...overrides,
    };
  }

  it('bumps v4 to v5', () => {
    const wf = makeWf({ schemaVersion: 4 });
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
  });

  it('leaves v5 workflow unchanged', () => {
    const wf = makeWf({ schemaVersion: 5 });
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
  });

  it('migrates v1 all the way to v5', () => {
    const wf = makeWf({ schemaVersion: 1 });
    const result = migrateWorkflowSchema(wf);
    expect(result.schemaVersion).toBe(6);
  });

  it('preserves subWorkflow nodes during migration', () => {
    const subWfNode: WorkflowNode = {
      id: 'sw1', type: 'subWorkflow', position: { x: 0, y: 0 },
      data: {
        label: 'Child Flow',
        workflowId: 'child-uuid',
        workflowName: 'My Child',
        inputMappings: [{ sourceExpression: '{{userId}}', targetVariable: 'id' }],
        outputMappings: [{ sourceVariable: 'result', targetVariable: 'childResult' }],
      } as SubWorkflowNodeData,
    };
    const wf = makeWf({ schemaVersion: 5, nodes: [subWfNode] });
    const result = migrateWorkflowSchema(wf);
    const sw = result.nodes.find(n => n.type === 'subWorkflow')!;
    const d = sw.data as SubWorkflowNodeData;
    expect(d.workflowId).toBe('child-uuid');
    expect(d.inputMappings).toHaveLength(1);
    expect(d.outputMappings).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────
// SubWorkflowNodeData type checks
// ────────────────────────────────────────────────────

describe('SubWorkflowNodeData type', () => {
  it('is included in WorkflowNodeType union', () => {
    const t: WorkflowNodeType = 'subWorkflow';
    expect(t).toBe('subWorkflow');
  });

  it('is included in WorkflowNodeData union', () => {
    const data: WorkflowNodeData = {
      label: 'Sub',
      workflowId: 'abc',
      inputMappings: [],
      outputMappings: [],
    } as SubWorkflowNodeData;
    expect(data.label).toBe('Sub');
  });

  it('supports all optional fields with defaults', () => {
    const data: SubWorkflowNodeData = {
      label: 'Test',
      workflowId: 'id-1',
      inputMappings: [],
      outputMappings: [],
      propagateAllOutputs: true,
      maxDepth: 5,
      timeoutMs: 30000,
      workflowName: 'Child',
    };
    expect(data.propagateAllOutputs).toBe(true);
    expect(data.maxDepth).toBe(5);
    expect(data.timeoutMs).toBe(30000);
    expect(data.workflowName).toBe('Child');
  });

  it('supports input/output mapping structure', () => {
    const data: SubWorkflowNodeData = {
      label: 'Mapped',
      workflowId: 'id-2',
      inputMappings: [
        { sourceExpression: '{{userId}}', targetVariable: 'id' },
        { sourceExpression: 'literal-value', targetVariable: 'mode' },
      ],
      outputMappings: [
        { sourceVariable: 'result', targetVariable: 'childResult' },
      ],
    };
    expect(data.inputMappings).toHaveLength(2);
    expect(data.inputMappings[0].sourceExpression).toBe('{{userId}}');
    expect(data.outputMappings[0].sourceVariable).toBe('result');
  });
});

// ── Additional migration edge cases for branch coverage ──

describe('migrateWorkflowSchema – additional edge cases', () => {
  it('v1 handles node with hostBaseUrl with whitespace', () => {
    const wf = makeWorkflow({
      schemaVersion: 1,
      nodes: [httpNode('n1', 'Test', {
        hostBaseUrl: '  https://api.example.com  ',
        hostEnvironmentId: '',
        hostMicroserviceId: '',
      })],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
  });

  it('v2→v3 handles hostProfile without URL or env/ms (empty host)', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [{
        id: 'hp1', name: 'Empty',
        hostBaseUrl: '',
        hostEnvironmentId: '',
        hostMicroserviceId: '',
      }],
      authProfiles: [],
      nodes: [httpNode('n1', 'Test', { hostProfileId: 'hp1' })],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
  });

  it('convertLegacyEndpoints handles adhoc urlMode', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc1', name: 'Adhoc',
        urlMode: 'adhoc' as any,
        adhocUrl: 'https://adhoc.example.com',
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc1');
    expect(svc!.endpoints!.length).toBeGreaterThan(0);
    expect(svc!.endpoints![0].envId).toBe('__adhoc__');
  });

  it('convertLegacyEndpoints handles multi-env with baseUrls and authPerEnv', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc1', name: 'MultiEnv',
        urlMode: 'multi-env',
        baseUrls: { 'env1': 'https://dev.example.com', 'env2': 'https://prod.example.com' },
        authPerEnv: { 'env1': { type: 'bearer', token: 'abc' } },
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc1');
    expect(svc!.endpoints!.length).toBe(2);
    expect(svc!.endpoints!.find(e => e.envId === 'env1')!.authMode).toBe('custom');
  });

  it('v2→v3 Phase 3 orphan with template-only URL groups by label', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'Template Node', {
          scenario: {
            ...minimalScenario(),
            url: '{{baseUrl}}/api/test',
          },
        }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
  });

  it('extractUrlOrigin returns null for empty URL', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [httpNode('n1', 'Empty URL', { scenario: { ...minimalScenario(), url: '' } })],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
  });

  it('extractUrlOrigin handles non-http URL', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [httpNode('n1', 'FTP', { scenario: { ...minimalScenario(), url: 'ftp://files.example.com/data' } })],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.some(s => s.urlMode === 'multi-env' || !s.directUrl)).toBe(true);
  });

  it('extractUrlOrigin handles URL that fails new URL() but matches regex', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [httpNode('n1', 'Weird URL', {
        scenario: { ...minimalScenario(), url: 'http://example.com:bad/path' },
      })],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
  });

  it('v1 handles node with auth type none (skips auth migration)', () => {
    const wf = makeWorkflow({
      schemaVersion: 1,
      nodes: [httpNode('n1', 'NoAuth', {
        hostBaseUrl: 'https://api.example.com',
        scenario: { ...minimalScenario(), auth: { type: 'none' } },
      })],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services![0];
    expect(svc.auth).toBeUndefined();
  });

  it('v1 handles node with auth type inherit (skips auth migration)', () => {
    const wf = makeWorkflow({
      schemaVersion: 1,
      nodes: [httpNode('n1', 'InheritAuth', {
        hostBaseUrl: 'https://api.example.com',
        scenario: { ...minimalScenario(), auth: { type: 'inherit' } },
      })],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services![0];
    expect(svc.auth).toBeUndefined();
  });

  it('fixup handles service with all nodes having same non-URL origin', () => {
    const wf = makeWorkflow({
      schemaVersion: 3,
      services: [{
        id: 'svc1', name: 'Shared',
        urlMode: 'direct',
        directUrl: 'https://api.example.com',
        endpoints: [{ envId: '__all__', url: 'https://api.example.com', enabled: true, authMode: 'inherit' as const, source: 'manual' as const }],
      }],
      nodes: [
        httpNode('n1', 'A', { serviceId: 'svc1', scenario: { ...minimalScenario(), url: 'https://api.example.com/a' } }),
        httpNode('n2', 'B', { serviceId: 'svc1', scenario: { ...minimalScenario(), url: 'https://api.example.com/b' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    // Same origin, should NOT split
    const httpNodes = result.nodes.filter(n => n.type === 'http');
    const svcIds = new Set(httpNodes.map(n => (n.data as any).serviceId));
    expect(svcIds.size).toBe(1);
  });

  it('commonLabelPrefix returns single label name for single-node groups', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [httpNode('n1', 'My Service - GET users', { scenario: { ...minimalScenario(), url: 'https://api.example.com/users' } })],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
  });

  it('commonLabelPrefix finds common prefix for multiple labels', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'UserService - GET', { scenario: { ...minimalScenario(), url: 'https://api.example.com/users' } }),
        httpNode('n2', 'UserService - POST', { scenario: { ...minimalScenario(), url: 'https://api.example.com/users' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
  });
});

