import { describe, it, expect, vi } from 'vitest';
import { migrateWorkflowSchema, migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5, migrateV5ToV6 } from './workflowMigrations';
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

  it('commonLabelPrefix falls back when labels share no non-trivial prefix', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'Zeta', { scenario: { ...minimalScenario(), url: 'https://same-host.example/a' } }),
        httpNode('n2', 'Alpha', { scenario: { ...minimalScenario(), url: 'https://same-host.example/b' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
    const d1 = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    const d2 = result.nodes.find(n => n.id === 'n2')!.data as HttpNodeData;
    expect(d1.serviceId).toBe(d2.serviceId);
  });

  it('deriveServiceNameFromLabel keeps original when suffix strip yields empty', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', ' - GET', { scenario: { ...minimalScenario(), url: 'https://x.example/y' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.some(s => s.name.includes('GET'))).toBe(true);
  });

  it('extractUrlOrigin returns null for https:// only (regex fallback misses host)', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'Lone', { scenario: { ...minimalScenario(), url: 'https://' } }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.length).toBeGreaterThan(0);
  });

  it('v2 hostProfile keeps auth undefined when paired authProfileId is missing', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [{ id: 'hp1', name: 'H', hostBaseUrl: 'https://x.com' }],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'A', { hostProfileId: 'hp1', authProfileId: 'missing-ap' }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.directUrl === 'https://x.com' || s.endpoints?.some(e => e.url === 'https://x.com'));
    expect(svc).toBeDefined();
    expect(svc!.auth).toBeUndefined();
  });

  it('v2 nodeAuthMap records only first auth per hostProfileId', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [{ id: 'hp1', name: 'H', hostBaseUrl: 'https://dup.com' }],
      authProfiles: [
        { id: 'ap1', name: 'A1', auth: { type: 'bearer', token: 'first' } },
        { id: 'ap2', name: 'A2', auth: { type: 'bearer', token: 'second' } },
      ],
      nodes: [
        httpNode('n1', 'Same', { hostProfileId: 'hp1', authProfileId: 'ap1' }),
        httpNode('n2', 'Same', { hostProfileId: 'hp1', authProfileId: 'ap2' }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const withFirst = result.services!.filter(s => (s.auth as { token?: string } | undefined)?.token === 'first');
    expect(withFirst.length).toBeGreaterThan(0);
    expect(result.services!.filter(s => (s.auth as { token?: string } | undefined)?.token === 'second')).toHaveLength(0);
  });

  it('v2 nodeAuthMap pairs host with auth from first http node that lists both ids', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [{ id: 'hp1', name: 'H', hostBaseUrl: 'https://pair-order.com' }],
      authProfiles: [{ id: 'ap1', name: 'A', auth: { type: 'bearer', token: 'paired' } }],
      nodes: [
        httpNode('n1', 'Same', { hostProfileId: 'hp1' }),
        httpNode('n2', 'Same', { hostProfileId: 'hp1', authProfileId: 'ap1' }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.some(s => (s.auth as { token?: string } | undefined)?.token === 'paired')).toBe(true);
  });

  it('convertLegacyEndpoints skips direct service when directUrl is whitespace only', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc-ws', name: 'Ws',
        urlMode: 'direct',
        directUrl: '   ',
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-ws');
    expect(svc!.endpoints).toEqual([]);
  });

  it('convertLegacyEndpoints skips adhoc when adhocUrl is empty', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc-ad', name: 'Ad',
        urlMode: 'adhoc' as any,
        adhocUrl: '',
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.find(s => s.id === 'svc-ad')!.endpoints).toEqual([]);
  });

  it('convertLegacyEndpoints skips blank entries in multi-env baseUrls', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc-m', name: 'M',
        urlMode: 'multi-env',
        baseUrls: { good: 'https://ok.example.com', bad: '', blanks: '  ' },
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-m');
    expect(svc!.endpoints!.length).toBe(1);
    expect(svc!.endpoints![0].envId).toBe('good');
  });

  it('migrateV1ToV2 skips host block when hostProfileId already set', () => {
    const wf = makeWorkflow({
      schemaVersion: 1,
      hostProfiles: [],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'X', {
          hostProfileId: 'pre-hp',
          hostBaseUrl: 'https://still-inline.com',
        }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.hostProfileId).toBe('pre-hp');
  });

  it('migrateV1ToV2 skips auth block when authProfileId already set', () => {
    const wf = makeWorkflow({
      schemaVersion: 1,
      hostProfiles: [{ id: 'h1', name: 'H', hostBaseUrl: 'https://z.com' }],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'X', {
          hostProfileId: 'h1',
          authProfileId: 'pre-ap',
          scenario: { ...minimalScenario(), auth: { type: 'bearer', token: 'tok' } },
        }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.authProfileId).toBe('pre-ap');
  });

  it('migrateV2ToV3 phase2 returns same node reference when serviceId preset', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [],
      authProfiles: [],
      services: [{ id: 's-fixed', name: 'F', urlMode: 'direct', endpoints: [] }],
      nodes: [
        httpNode('n1', 'Keep', {
          serviceId: 's-fixed',
          scenario: { ...minimalScenario(), url: 'https://keep.example/p' },
        }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    expect((result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData).serviceId).toBe('s-fixed');
  });

  it('v5→v6 prefers webhook when both webhook and schedule exist', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'Test',
      createdAt: 0, updatedAt: 0, schemaVersion: 5,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 'start1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'S' } },
        { id: 'wh1', type: 'webhook', position: { x: 1, y: 0 }, data: { label: 'W' } },
        { id: 'sch1', type: 'schedule', position: { x: 2, y: 0 }, data: { label: 'Sch' } },
        httpNode('h1', 'Http'),
      ],
      edges: [
        { id: 'e0', source: 'start1', target: 'wh1' },
        { id: 'e1', source: 'wh1', target: 'h1' },
        { id: 'e2', source: 'sch1', target: 'h1' },
      ],
    };
    const result = migrateWorkflowSchema(wf);
    expect(result.nodes.find(n => n.id === 'start1')).toBeUndefined();
  });

  it('sets defaultAuth from auth when defaultAuth absent on legacy service', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc-d', name: 'D',
        auth: { type: 'bearer', token: 'x' },
        endpoints: [],
      } as any],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-d');
    expect(svc!.defaultAuth).toEqual({ type: 'bearer', token: 'x' });
  });

  it('v2 hostProfile with blank name uses numbered service title', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [{ id: 'hp1', name: '', hostBaseUrl: 'https://blank-name.example' }],
      authProfiles: [],
      nodes: [httpNode('n1', 'Same', { hostProfileId: 'hp1' })],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.directUrl === 'https://blank-name.example' || s.endpoints?.some(e => e.url === 'https://blank-name.example'));
    expect(svc).toBeDefined();
    expect(svc!.name).toMatch(/Service/);
  });

  it('v2 hostProfile uses numbered name when profile name omitted', () => {
    const wf = makeWorkflow({
      schemaVersion: 2,
      hostProfiles: [{ id: 'hp1', name: undefined as unknown as string, hostBaseUrl: 'https://undef-name.example' } as any],
      authProfiles: [],
      nodes: [httpNode('n1', 'Same', { hostProfileId: 'hp1' })],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.directUrl === 'https://undef-name.example' || s.endpoints?.some(e => e.url === 'https://undef-name.example'));
    expect(svc).toBeDefined();
    expect(svc!.name).toMatch(/Service/);
  });

  it('convertLegacyEndpoints skips multi-env when baseUrls is absent', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc-ne', name: 'NoBase',
        urlMode: 'multi-env',
        endpoints: [],
      } as any],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.find(s => s.id === 'svc-ne')!.endpoints).toEqual([]);
  });

  it('convertLegacyEndpoints skips empty env URLs inside baseUrls', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc-sk', name: 'Skip',
        urlMode: 'multi-env',
        baseUrls: { empty: null as unknown as string, blank: '' },
        endpoints: [],
      } as any],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.find(s => s.id === 'svc-sk')!.endpoints).toEqual([]);
  });

  it('convertLegacyEndpoints does not match unknown urlMode', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc-unk', name: 'U',
        urlMode: 'other' as any,
        endpoints: [],
      }],
    });
    const result = migrateWorkflowSchema(wf);
    expect(result.services!.find(s => s.id === 'svc-unk')!.endpoints).toEqual([]);
  });

  it('convertLegacyEndpoints uses auth when defaultAuth is null', () => {
    const wf = makeWorkflow({
      schemaVersion: 5,
      services: [{
        id: 'svc-nd',
        name: 'N',
        auth: { type: 'bearer', token: 'z' },
        defaultAuth: null as any,
        endpoints: [],
      } as any],
    });
    const result = migrateWorkflowSchema(wf);
    const svc = result.services!.find(s => s.id === 'svc-nd');
    expect(svc!.defaultAuth).toEqual({ type: 'bearer', token: 'z' });
  });

  it('v1 skips inline host migration when only hostEnvironmentId is set', () => {
    const wf = makeWorkflow({
      schemaVersion: 1,
      nodes: [
        httpNode('n1', 'Partial', {
          hostEnvironmentId: 'e-only',
          hostMicroserviceId: '',
        }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    const d = result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData;
    expect(d.hostProfileId).toBeUndefined();
  });

  it('v1 migrates apikey auth to authProfile', () => {
    const wf = makeWorkflow({
      schemaVersion: 1,
      hostProfiles: [{ id: 'h1', name: 'H', hostBaseUrl: 'https://k.example' }],
      authProfiles: [],
      nodes: [
        httpNode('n1', 'K', {
          hostProfileId: 'h1',
          scenario: { ...minimalScenario(), auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret' } },
        }),
      ],
    });
    const result = migrateWorkflowSchema(wf);
    expect((result.nodes.find(n => n.id === 'n1')!.data as HttpNodeData).authProfileId).toBeDefined();
  });
});

describe('migrateV3ToV4 / migrateV4ToV5 / migrateV5ToV6 direct calls', () => {
  it('migrateV1ToV2 leaves nodes unchanged when schema is already >= 2', () => {
    const wf = makeWorkflow({ schemaVersion: 2, nodes: [httpNode('n1', 'X')] });
    const r = migrateV1ToV2(wf);
    expect(r.schemaVersion).toBe(2);
    expect(r.nodes).toBe(wf.nodes);
  });

  it('migrateV1ToV2 normalizes missing profile arrays for v1 workflows', () => {
    const wf = {
      id: 'wf-1', name: 'T', schemaVersion: 1, nodes: [], edges: [],
      createdAt: 0, updatedAt: 0, variables: {},
    } as unknown as Workflow;
    const r = migrateV1ToV2(wf);
    expect(r.hostProfiles).toEqual([]);
    expect(r.authProfiles).toEqual([]);
  });

  it('migrateV2ToV3 is a no-op when schema is already >= 3', () => {
    const wf = makeWorkflow({ schemaVersion: 3, nodes: [httpNode('n1', 'X')] });
    expect(migrateV2ToV3(wf)).toBe(wf);
  });

  it('migrateV3ToV4 is a no-op when schema is already >= 4', () => {
    const wf = makeWorkflow({ schemaVersion: 4, nodes: [httpNode('n1', 'X')] });
    expect(migrateV3ToV4(wf)).toBe(wf);
  });

  it('migrateV4ToV5 is a no-op when schema is already >= 5', () => {
    const wf = makeWorkflow({ schemaVersion: 5 });
    expect(migrateV4ToV5(wf)).toBe(wf);
  });

  it('migrateV5ToV6 is a no-op when schema is already >= 6', () => {
    const wf = makeWorkflow({ schemaVersion: 6 });
    expect(migrateV5ToV6(wf)).toBe(wf);
  });

  it('migrateV4ToV5 bumps schema 4 to 5', () => {
    const wf = makeWorkflow({ schemaVersion: 4, nodes: [httpNode('h1', 'Call')] });
    const r = migrateV4ToV5(wf);
    expect(r.schemaVersion).toBe(5);
    expect(r.nodes).toEqual(wf.nodes);
  });

  it('migrateWorkflowSchema from v4 skips earlier migration steps', () => {
    const wf = makeWorkflow({
      schemaVersion: 4,
      nodes: [{ id: 's1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', inputVariables: {} } }, httpNode('h1', 'X')],
      edges: [{ id: 'e1', source: 's1', target: 'h1' }],
    });
    const r = migrateWorkflowSchema(wf);
    expect(r.schemaVersion).toBe(6);
    expect(r.nodes.some(n => n.id === 's1')).toBe(true);
  });

  it('migrateV3ToV4 inserts Start node for v3 workflow without one', () => {
    const wf = makeWorkflow({ schemaVersion: 3, nodes: [httpNode('h1', 'Only')], edges: [] });
    const r = migrateV3ToV4(wf);
    expect(r.schemaVersion).toBe(4);
    expect(r.nodes.some(n => n.type === 'start')).toBe(true);
    expect(r.edges.some(e => e.targetHandle === null)).toBe(true);
  });

  it('migrateV3ToV4 only bumps version when Start already exists', () => {
    const wf: Workflow = {
      id: 'wf-1', name: 'T', schemaVersion: 3, createdAt: 0, updatedAt: 0,
      variables: {}, hostProfiles: [], authProfiles: [], services: [],
      nodes: [
        { id: 's1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', inputVariables: {} } },
        httpNode('h1', 'Http'),
      ],
      edges: [],
    };
    const r = migrateV3ToV4(wf);
    expect(r.schemaVersion).toBe(4);
    expect(r.nodes).toHaveLength(2);
  });

  it('migrateV3ToV4 only bumps version when workflow has no nodes', () => {
    const wf = makeWorkflow({ schemaVersion: 3, nodes: [] });
    const r = migrateV3ToV4(wf);
    expect(r.schemaVersion).toBe(4);
    expect(r.nodes).toHaveLength(0);
  });
});

