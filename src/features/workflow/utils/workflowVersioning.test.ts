/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MAX_WORKFLOW_VERSIONS,
  computeWorkflowFingerprint,
  createWorkflowVersion,
  addVersionToList,
  generateChangeSummary,
  computeVersionDiff,
  stripWorkflowVersions,
  countWorkflowVersions,
} from './workflowVersioning';
import type { WorkflowVersion } from '../types/workflow';

vi.mock('uuid', () => ({
  v4: (() => {
    let counter = 0;
    return () => `uuid-${++counter}`;
  })(),
}));

// ── Helpers ──

const makeNode = (id: string, type = 'request', data: Record<string, unknown> = {}) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id, ...data },
});

const makeEdge = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
  sourceHandle: null,
  label: '',
});

const makeVersion = (overrides: Partial<WorkflowVersion> = {}): WorkflowVersion => ({
  id: 'v1',
  timestamp: 1000,
  fingerprint: 'fp1',
  nodeCount: 1,
  edgeCount: 0,
  nodes: [makeNode('n1')] as unknown as WorkflowVersion['nodes'],
  edges: [] as unknown as WorkflowVersion['edges'],
  variables: {},
  ...overrides,
});

// ── computeWorkflowFingerprint ──

describe('computeWorkflowFingerprint', () => {
  it('returns a string hash', () => {
    const fp = computeWorkflowFingerprint([], [], {});
    expect(typeof fp).toBe('string');
    expect(fp.length).toBeGreaterThan(0);
  });

  it('returns same hash for same data', () => {
    const nodes = [makeNode('n1')] as any;
    const edges = [makeEdge('e1', 'n1', 'n2')] as any;
    const vars = { foo: 'bar' };
    const fp1 = computeWorkflowFingerprint(nodes, edges, vars);
    const fp2 = computeWorkflowFingerprint(nodes, edges, vars);
    expect(fp1).toBe(fp2);
  });

  it('returns different hash for different nodes', () => {
    const fp1 = computeWorkflowFingerprint([makeNode('n1')] as any, [], {});
    const fp2 = computeWorkflowFingerprint([makeNode('n2')] as any, [], {});
    expect(fp1).not.toBe(fp2);
  });

  it('returns different hash for different variables', () => {
    const fp1 = computeWorkflowFingerprint([], [], { a: '1' });
    const fp2 = computeWorkflowFingerprint([], [], { a: '2' });
    expect(fp1).not.toBe(fp2);
  });

  it('returns different hash for different edges', () => {
    const fp1 = computeWorkflowFingerprint([], [makeEdge('e1', 'a', 'b')] as any, {});
    const fp2 = computeWorkflowFingerprint([], [makeEdge('e1', 'a', 'c')] as any, {});
    expect(fp1).not.toBe(fp2);
  });

  it('includes services in fingerprint', () => {
    const svc = [{ id: 's1', name: 'Svc', endpoints: [], defaultAuth: undefined, microserviceId: undefined }] as any;
    const fp1 = computeWorkflowFingerprint([], [], {}, svc);
    const fp2 = computeWorkflowFingerprint([], [], {});
    expect(fp1).not.toBe(fp2);
  });

  it('treats undefined services same as empty', () => {
    const fp1 = computeWorkflowFingerprint([], [], {}, undefined);
    const fp2 = computeWorkflowFingerprint([], [], {}, []);
    expect(fp1).toBe(fp2);
  });
});

// ── createWorkflowVersion ──

describe('createWorkflowVersion', () => {
  it('creates a new version with correct properties', () => {
    const nodes = [makeNode('n1')] as any;
    const edges = [makeEdge('e1', 'n1', 'n2')] as any;
    const vars = { key: 'val' };
    const v = createWorkflowVersion(nodes, edges, vars, undefined, []);
    expect(v).not.toBeNull();
    expect(v!.nodeCount).toBe(1);
    expect(v!.edgeCount).toBe(1);
    expect(v!.variables).toEqual({ key: 'val' });
    expect(v!.fingerprint).toBeTruthy();
    expect(v!.timestamp).toBeGreaterThan(0);
  });

  it('returns null if fingerprint matches latest version', () => {
    const nodes = [makeNode('n1')] as any;
    const fp = computeWorkflowFingerprint(nodes, [], {});
    const existing = [makeVersion({ fingerprint: fp })];
    const v = createWorkflowVersion(nodes, [], {}, undefined, existing);
    expect(v).toBeNull();
  });

  it('creates version if fingerprint differs from latest', () => {
    const existing = [makeVersion({ fingerprint: 'different' })];
    const v = createWorkflowVersion([makeNode('n1')] as any, [], {}, undefined, existing);
    expect(v).not.toBeNull();
  });

  it('deep clones the data', () => {
    const nodes = [makeNode('n1')] as any;
    const vars = { key: 'val' };
    const v = createWorkflowVersion(nodes, [], vars, undefined, []);
    vars.key = 'changed';
    nodes[0].id = 'changed';
    expect(v!.variables.key).toBe('val');
    expect(v!.nodes[0].id).toBe('n1');
  });

  it('accepts optional label', () => {
    const v = createWorkflowVersion([], [], {}, undefined, [], 'My Label');
    expect(v!.label).toBe('My Label');
  });

  it('includes services when provided', () => {
    const svcs = [{ id: 's1', name: 'Svc' }] as any;
    const v = createWorkflowVersion([], [], {}, svcs, []);
    expect(v!.services).toEqual(svcs);
  });

  it('sets services to undefined when not provided', () => {
    const v = createWorkflowVersion([], [], {}, undefined, []);
    expect(v!.services).toBeUndefined();
  });
});

// ── addVersionToList ──

describe('addVersionToList', () => {
  it('prepends version to list', () => {
    const v1 = makeVersion({ id: 'v1' });
    const v2 = makeVersion({ id: 'v2' });
    const result = addVersionToList([v1], v2);
    expect(result[0].id).toBe('v2');
    expect(result[1].id).toBe('v1');
  });

  it('caps list at max', () => {
    const existing = Array.from({ length: 5 }, (_, i) => makeVersion({ id: `v${i}` }));
    const newV = makeVersion({ id: 'new' });
    const result = addVersionToList(existing, newV, 3);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('new');
  });

  it('uses MAX_WORKFLOW_VERSIONS as default max', () => {
    const existing = Array.from({ length: MAX_WORKFLOW_VERSIONS }, (_, i) => makeVersion({ id: `v${i}` }));
    const newV = makeVersion({ id: 'new' });
    const result = addVersionToList(existing, newV);
    expect(result).toHaveLength(MAX_WORKFLOW_VERSIONS);
    expect(result[0].id).toBe('new');
  });

  it('handles empty list', () => {
    const v = makeVersion({ id: 'v1' });
    const result = addVersionToList([], v);
    expect(result).toEqual([v]);
  });
});

// ── generateChangeSummary ──

describe('generateChangeSummary', () => {
  it('reports added nodes', () => {
    const older = { nodeCount: 1, edgeCount: 0, nodes: [makeNode('n1')], edges: [], variables: {} };
    const newer = { nodeCount: 3, edgeCount: 0, nodes: [makeNode('n1'), makeNode('n2'), makeNode('n3')], edges: [], variables: {} };
    expect(generateChangeSummary(older as any, newer as any)).toContain('2 nodes added');
  });

  it('reports removed nodes', () => {
    const older = { nodeCount: 3, edgeCount: 0, nodes: [], edges: [], variables: {} };
    const newer = { nodeCount: 1, edgeCount: 0, nodes: [], edges: [], variables: {} };
    expect(generateChangeSummary(older as any, newer as any)).toContain('2 nodes removed');
  });

  it('reports added edges', () => {
    const older = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: {} };
    const newer = { nodeCount: 0, edgeCount: 1, nodes: [], edges: [], variables: {} };
    expect(generateChangeSummary(older as any, newer as any)).toContain('1 edge added');
  });

  it('reports removed edges', () => {
    const older = { nodeCount: 0, edgeCount: 2, nodes: [], edges: [], variables: {} };
    const newer = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: {} };
    expect(generateChangeSummary(older as any, newer as any)).toContain('2 edges removed');
  });

  it('reports added variables', () => {
    const older = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: {} };
    const newer = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: { a: '1', b: '2' } };
    expect(generateChangeSummary(older as any, newer as any)).toContain('2 vars added');
  });

  it('reports removed variables', () => {
    const older = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: { a: '1' } };
    const newer = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: {} };
    expect(generateChangeSummary(older as any, newer as any)).toContain('1 var removed');
  });

  it('reports changed variables', () => {
    const older = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: { a: '1' } };
    const newer = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: { a: '2' } };
    expect(generateChangeSummary(older as any, newer as any)).toContain('1 var changed');
  });

  it('reports modified nodes when count is same', () => {
    const n1 = makeNode('n1', 'request', { url: '/a' });
    const n1mod = makeNode('n1', 'request', { url: '/b' });
    const older = { nodeCount: 1, edgeCount: 0, nodes: [n1], edges: [], variables: {} };
    const newer = { nodeCount: 1, edgeCount: 0, nodes: [n1mod], edges: [], variables: {} };
    expect(generateChangeSummary(older as any, newer as any)).toContain('1 node modified');
  });

  it('returns "No structural changes" when nothing changed', () => {
    const v = { nodeCount: 0, edgeCount: 0, nodes: [], edges: [], variables: {} };
    expect(generateChangeSummary(v as any, v as any)).toBe('No structural changes');
  });

  it('combines multiple changes', () => {
    const older = { nodeCount: 1, edgeCount: 1, nodes: [makeNode('n1')], edges: [], variables: { a: '1' } };
    const newer = { nodeCount: 2, edgeCount: 0, nodes: [makeNode('n1'), makeNode('n2')], edges: [], variables: {} };
    const summary = generateChangeSummary(older as any, newer as any);
    expect(summary).toContain('1 node added');
    expect(summary).toContain('1 edge removed');
    expect(summary).toContain('1 var removed');
  });
});

// ── computeVersionDiff ──

describe('computeVersionDiff', () => {
  it('detects added nodes', () => {
    const older = makeVersion({ nodes: [] as any });
    const newer = makeVersion({ nodes: [makeNode('n1')] as any });
    const diff = computeVersionDiff(older, newer);
    expect(diff.addedNodes).toHaveLength(1);
    expect(diff.removedNodes).toHaveLength(0);
  });

  it('detects removed nodes', () => {
    const older = makeVersion({ nodes: [makeNode('n1')] as any });
    const newer = makeVersion({ nodes: [] as any });
    const diff = computeVersionDiff(older, newer);
    expect(diff.removedNodes).toHaveLength(1);
    expect(diff.addedNodes).toHaveLength(0);
  });

  it('detects modified nodes', () => {
    const n1 = makeNode('n1', 'request', { url: '/a' });
    const n1mod = makeNode('n1', 'request', { url: '/b' });
    const older = makeVersion({ nodes: [n1] as any });
    const newer = makeVersion({ nodes: [n1mod] as any });
    const diff = computeVersionDiff(older, newer);
    expect(diff.modifiedNodes).toHaveLength(1);
    expect(diff.modifiedNodes[0].id).toBe('n1');
  });

  it('detects added edges', () => {
    const older = makeVersion({ edges: [] as any });
    const newer = makeVersion({ edges: [makeEdge('e1', 'a', 'b')] as any });
    const diff = computeVersionDiff(older, newer);
    expect(diff.addedEdges).toHaveLength(1);
  });

  it('detects removed edges', () => {
    const older = makeVersion({ edges: [makeEdge('e1', 'a', 'b')] as any });
    const newer = makeVersion({ edges: [] as any });
    const diff = computeVersionDiff(older, newer);
    expect(diff.removedEdges).toHaveLength(1);
  });

  it('detects added variables', () => {
    const older = makeVersion({ variables: {} });
    const newer = makeVersion({ variables: { foo: 'bar' } });
    const diff = computeVersionDiff(older, newer);
    expect(diff.variableChanges.added).toEqual([{ key: 'foo', value: 'bar' }]);
  });

  it('detects removed variables', () => {
    const older = makeVersion({ variables: { foo: 'bar' } });
    const newer = makeVersion({ variables: {} });
    const diff = computeVersionDiff(older, newer);
    expect(diff.variableChanges.removed).toEqual([{ key: 'foo', value: 'bar' }]);
  });

  it('detects modified variables', () => {
    const older = makeVersion({ variables: { foo: 'bar' } });
    const newer = makeVersion({ variables: { foo: 'baz' } });
    const diff = computeVersionDiff(older, newer);
    expect(diff.variableChanges.modified).toEqual([{ key: 'foo', oldValue: 'bar', newValue: 'baz' }]);
  });

  it('detects added services', () => {
    const svc = { id: 's1', name: 'Svc' } as any;
    const older = makeVersion({ services: [] });
    const newer = makeVersion({ services: [svc] });
    const diff = computeVersionDiff(older, newer);
    expect(diff.serviceChanges.added).toHaveLength(1);
  });

  it('detects removed services', () => {
    const svc = { id: 's1', name: 'Svc' } as any;
    const older = makeVersion({ services: [svc] });
    const newer = makeVersion({ services: [] });
    const diff = computeVersionDiff(older, newer);
    expect(diff.serviceChanges.removed).toHaveLength(1);
  });

  it('detects modified services', () => {
    const svc1 = { id: 's1', name: 'Svc' } as any;
    const svc2 = { id: 's1', name: 'Updated' } as any;
    const older = makeVersion({ services: [svc1] });
    const newer = makeVersion({ services: [svc2] });
    const diff = computeVersionDiff(older, newer);
    expect(diff.serviceChanges.modified).toHaveLength(1);
    expect(diff.serviceChanges.modified[0].name).toBe('Updated');
  });

  it('handles undefined services in older version', () => {
    const older = makeVersion({ services: undefined });
    const newer = makeVersion({ services: [{ id: 's1', name: 'Svc' } as any] });
    const diff = computeVersionDiff(older, newer);
    expect(diff.serviceChanges.added).toHaveLength(1);
  });

  it('handles undefined services in newer version', () => {
    const older = makeVersion({ services: [{ id: 's1', name: 'Svc' } as any] });
    const newer = makeVersion({ services: undefined });
    const diff = computeVersionDiff(older, newer);
    expect(diff.serviceChanges.removed).toHaveLength(1);
  });
});

// ── stripWorkflowVersions ──

describe('stripWorkflowVersions', () => {
  it('removes versions from workflow', () => {
    const wf = { id: 'wf1', name: 'Test', versions: [makeVersion()] };
    const stripped = stripWorkflowVersions(wf);
    expect('versions' in stripped).toBe(false);
    expect(stripped.id).toBe('wf1');
    expect(stripped.name).toBe('Test');
  });

  it('handles workflow without versions', () => {
    const wf = { id: 'wf1', name: 'Test' };
    const stripped = stripWorkflowVersions(wf);
    expect('versions' in stripped).toBe(false);
    expect(stripped.id).toBe('wf1');
  });

  it('preserves all other properties', () => {
    const wf = { id: 'wf1', name: 'Test', nodes: [], edges: [], variables: {}, versions: [makeVersion()] };
    const stripped = stripWorkflowVersions(wf);
    expect(stripped.nodes).toEqual([]);
    expect(stripped.edges).toEqual([]);
    expect(stripped.variables).toEqual({});
  });
});

// ── countWorkflowVersions ──

describe('countWorkflowVersions', () => {
  it('returns version count', () => {
    expect(countWorkflowVersions({ versions: [makeVersion(), makeVersion()] })).toBe(2);
  });

  it('returns 0 when no versions', () => {
    expect(countWorkflowVersions({})).toBe(0);
  });

  it('returns 0 when versions is undefined', () => {
    expect(countWorkflowVersions({ versions: undefined })).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(countWorkflowVersions({ versions: [] })).toBe(0);
  });
});

// ── MAX_WORKFLOW_VERSIONS ──

describe('MAX_WORKFLOW_VERSIONS', () => {
  it('is 30', () => {
    expect(MAX_WORKFLOW_VERSIONS).toBe(30);
  });
});
