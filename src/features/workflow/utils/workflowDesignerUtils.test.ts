import { describe, it, expect } from 'vitest';
import { getDetailModalProps, getNodeMiniMapColor, buildConfigModalWorkflowList } from './workflowDesignerUtils';
import { buildQuickTestFailureReport } from './workflowRunErrors';
import type { Workflow } from '../types/workflow';

function minimalWorkflow(id: string, name: string): Workflow {
  return {
    id,
    name,
    schemaVersion: 5,
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [],
    edges: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

type SampleCatalogEntry = { id: string; companionFactories?: (() => Workflow)[] };

// ─── getDetailModalProps ─────────────────────────────────────────────────────

describe('getDetailModalProps', () => {
  const meta = { title: 'GET /api/users', body: '{"users":[]}' };

  it('returns empty values when detailModal is null', () => {
    const result = getDetailModalProps(null, meta, undefined, null);
    expect(result).toEqual({ title: '', subtitle: undefined, body: undefined });
  });

  it('returns step detail with response title', () => {
    const result = getDetailModalProps({ type: 'step', nodeId: 'n1' }, meta, 'http', null);
    expect(result.title).toBe('Response — GET /api/users');
    expect(result.subtitle).toBe('Last Quick Test result for this step');
    expect(result.body).toBe('{"users":[]}');
  });

  it('returns variable detail for http node', () => {
    const result = getDetailModalProps({ type: 'variable', key: 'token' }, meta, 'http', null);
    expect(result.title).toBe('Variable {{token}}');
    expect(result.subtitle).toContain('initial variables');
    expect(result.body).toBeUndefined();
  });

  it('returns variable detail for non-http node', () => {
    const result = getDetailModalProps({ type: 'variable', key: 'token' }, meta, 'condition', null);
    expect(result.title).toBe('Variable {{token}}');
    expect(result.subtitle).toContain('workflow defaults');
    expect(result.body).toBeUndefined();
  });

  it('returns variable detail when selectedNodeType is undefined', () => {
    const result = getDetailModalProps({ type: 'variable', key: 'x' }, meta, undefined, null);
    expect(result.subtitle).toContain('workflow defaults');
  });

  it('returns runError detail with lastRunError body', () => {
    const result = getDetailModalProps({ type: 'runError' }, meta, undefined, 'timeout');
    expect(result.title).toBe('Quick Test failed');
    expect(result.body).toBe('timeout');
  });

  it('returns runError with structured failure report', () => {
    const report = buildQuickTestFailureReport(
      undefined,
      [{ nodeId: 'a1', label: 'GraphQL Assert', state: 'fail', error: 'detail line' }],
      { gqlLatency: '28' },
      900,
      'detail line',
    );
    const result = getDetailModalProps({ type: 'runError' }, meta, undefined, report.summary, report);
    expect(result.failureReport).toBe(report);
    expect(result.subtitle).toContain('1 failed');
  });

  it('returns empty string body when runError and lastRunError is null', () => {
    const result = getDetailModalProps({ type: 'runError' }, meta, undefined, null);
    expect(result.body).toBe('');
  });
});

// ─── getNodeMiniMapColor ─────────────────────────────────────────────────────

describe('getNodeMiniMapColor', () => {
  it('returns red for failed nodes', () => {
    expect(getNodeMiniMapColor({ id: 'n1' }, { n1: { state: 'fail', startedAt: 0 } })).toBe('#ef4444');
  });

  it('returns yellow for running nodes', () => {
    expect(getNodeMiniMapColor({ id: 'n1' }, { n1: { state: 'running', startedAt: 0 } })).toBe('#eab308');
  });

  it('returns green for passed nodes', () => {
    expect(getNodeMiniMapColor({ id: 'n1' }, { n1: { state: 'pass', startedAt: 0 } })).toBe('#22c55e');
  });

  it('returns gray for skipped nodes', () => {
    expect(getNodeMiniMapColor({ id: 'n1' }, { n1: { state: 'skipped', startedAt: 0 } })).toBe('#94a3b8');
  });

  it('returns purple for condition node without status', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'condition' }, {})).toBe('#a78bfa');
  });

  it('returns gray for delay node without status', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'delay' }, {})).toBe('#94a3b8');
  });

  it('returns green for start node without status', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'start' }, {})).toBe('#22c55e');
  });

  it('returns dark purple for fork node without status', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'fork' }, {})).toBe('#a855f7');
  });

  it('returns kafka color for kafka-prefixed types', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'kafkaProduce' }, {})).toBe('#b5944f');
  });

  it('returns ws color for ws-prefixed types', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'wsSend' }, {})).toBe('#8a82bf');
  });

  it('returns graphql color for graphql-prefixed types', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'graphqlQuery' }, {})).toBe('#4da8b5');
  });

  it('returns grpc color for grpc-prefixed types', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'grpcUnary' }, {})).toBe('#5f8fb5');
  });

  it('returns default color when type does not match ws lowercase prefix', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'WebSocket' }, {})).toBe('#3b82f6');
  });

  it('returns blue as default color', () => {
    expect(getNodeMiniMapColor({ id: 'n1', type: 'http' }, {})).toBe('#3b82f6');
  });

  it('status takes priority over node type', () => {
    // A condition node that failed should be red, not purple
    expect(getNodeMiniMapColor({ id: 'n1', type: 'condition' }, { n1: { state: 'fail', startedAt: 0 } })).toBe('#ef4444');
  });
});

// ─── buildConfigModalWorkflowList ────────────────────────────────────────────

describe('buildConfigModalWorkflowList', () => {
  const wf1 = minimalWorkflow('w1', 'Workflow 1');
  const wf2 = minimalWorkflow('w2', 'Workflow 2');

  it('returns base workflows mapped to id/name', () => {
    const result = buildConfigModalWorkflowList([wf1, wf2], null, []);
    expect(result).toEqual([
      { id: 'w1', name: 'Workflow 1' },
      { id: 'w2', name: 'Workflow 2' },
    ]);
  });

  it('returns empty list when no workflows', () => {
    expect(buildConfigModalWorkflowList([], null, [])).toEqual([]);
  });

  it('does not add companions when previewWorkflow is null', () => {
    const catalog: SampleCatalogEntry[] = [{ id: 'w1', companionFactories: [() => minimalWorkflow('c1', 'Companion')] }];
    const result = buildConfigModalWorkflowList([wf1], null, catalog);
    expect(result).toEqual([{ id: 'w1', name: 'Workflow 1' }]);
  });

  it('adds companion workflows from catalog for preview workflow', () => {
    const companion = minimalWorkflow('c1', 'Companion');
    const catalog: SampleCatalogEntry[] = [{ id: 'w1', companionFactories: [() => companion] }];
    const result = buildConfigModalWorkflowList([wf1], wf1, catalog);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ id: 'c1', name: 'Companion' });
  });

  it('does not duplicate companion that is already in the list', () => {
    const catalog: SampleCatalogEntry[] = [{ id: 'w1', companionFactories: [() => minimalWorkflow('w2', 'Companion')] }];
    const result = buildConfigModalWorkflowList([wf1, wf2], wf1, catalog);
    expect(result).toHaveLength(2);
  });

  it('handles catalog entry without companionFactories', () => {
    const catalog: SampleCatalogEntry[] = [{ id: 'w1' }];
    const result = buildConfigModalWorkflowList([wf1], wf1, catalog);
    expect(result).toEqual([{ id: 'w1', name: 'Workflow 1' }]);
  });

  it('handles preview workflow not found in catalog', () => {
    const result = buildConfigModalWorkflowList([wf1], wf1, []);
    expect(result).toEqual([{ id: 'w1', name: 'Workflow 1' }]);
  });

  it('adds multiple companions', () => {
    const catalog: SampleCatalogEntry[] = [{
      id: 'w1',
      companionFactories: [
        () => minimalWorkflow('c1', 'C1'),
        () => minimalWorkflow('c2', 'C2'),
      ],
    }];
    const result = buildConfigModalWorkflowList([wf1], wf1, catalog);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.id)).toEqual(['w1', 'c1', 'c2']);
  });
});
