import { describe, it, expect } from 'vitest';
import type { Mapping, MapperSource } from '../types';
import {
  createSyncState,
  syncFromTemplate,
  syncFromVisual,
  resolveConflict,
  diffTemplateRefs,
  applyTemplateDiff,
  mappingsEqual,
} from './bodyTemplateSync';
import type { BodySyncState, BodySyncOptions } from './bodyTemplateSync';

// ─── Test helpers ─────────────────────────────────────────

const mockSources: MapperSource[] = [
  {
    id: 'n1',
    label: 'Step 1',
    sampleData: { userId: 'string', orderId: 'number', status: 'string' },
    format: 'json',
  },
  {
    id: '__generators__',
    label: 'Generators',
    sampleData: { $uuid: 'string', $timestamp: 'number' },
    format: 'json',
  },
  {
    id: '__env__',
    label: 'Environment',
    sampleData: { API_KEY: 'string' },
    format: 'json',
  },
];

const opts: BodySyncOptions = { sources: mockSources };

function makeMapping(overrides: Partial<Mapping> & { id: string; targetPath: string; sourcePath: string }): Mapping {
  return { sourceId: 'n1', ...overrides };
}

// ─── createSyncState ──────────────────────────────────────

describe('createSyncState', () => {
  it('creates initial state with body and empty mappings', () => {
    const state = createSyncState('{"id": 1}');
    expect(state.body).toBe('{"id": 1}');
    expect(state.mappings).toEqual([]);
    expect(state.lastOrigin).toBe('template');
    expect(state.lastSyncedBody).toBe('{"id": 1}');
  });

  it('creates initial state with existing mappings', () => {
    const mappings = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const state = createSyncState('{"id": "{{userId}}"}', mappings);
    expect(state.mappings).toHaveLength(1);
    expect(state.lastSyncedMappings).toHaveLength(1);
  });
});

// ─── syncFromTemplate ─────────────────────────────────────

describe('syncFromTemplate', () => {
  it('detects new {{var}} refs and creates mappings', () => {
    const body = JSON.stringify({ id: '{{userId}}', name: '{{status}}' });
    const result = syncFromTemplate(body, [], opts);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings[0].sourcePath).toBe('userId');
    expect(result.mappings[0].targetPath).toBe('id');
    expect(result.mappings[0].sourceId).toBe('n1');
    expect(result.mappings[1].sourcePath).toBe('status');
    expect(result.mappingsChanged).toBe(true);
  });

  it('preserves existing mappings that still match', () => {
    const existingMapping = makeMapping({ id: 'existing-1', sourcePath: 'userId', targetPath: 'id' });
    const body = JSON.stringify({ id: '{{userId}}', extra: '{{$uuid}}' });
    const result = syncFromTemplate(body, [existingMapping], opts);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings[0].id).toBe('existing-1');
    expect(result.mappings[1].sourceId).toBe('__generators__');
  });

  it('removes mappings for refs that disappeared', () => {
    const existingMappings = [
      makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' }),
      makeMapping({ id: '2', sourcePath: 'status', targetPath: 'name' }),
    ];
    const body = JSON.stringify({ id: '{{userId}}' });
    const result = syncFromTemplate(body, existingMappings, opts);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].sourcePath).toBe('userId');
    expect(result.mappingsChanged).toBe(true);
  });

  it('preserves mappings for non-JSON body (user mid-edit)', () => {
    const existing = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y' })];
    const result = syncFromTemplate('not json', existing, opts);
    expect(result.mappings).toEqual(existing);
    expect(result.mappingsChanged).toBe(false);
  });

  it('returns empty mappings for non-JSON body with no prior mappings', () => {
    const result = syncFromTemplate('not json', [], opts);
    expect(result.mappings).toEqual([]);
    expect(result.mappingsChanged).toBe(false);
  });

  it('returns unchanged for body with no template refs', () => {
    const result = syncFromTemplate('{"id": 42}', [], opts);
    expect(result.mappings).toHaveLength(0);
    expect(result.mappingsChanged).toBe(false);
  });

  it('assigns generator refs to generators source', () => {
    const body = JSON.stringify({ reqId: '{{$uuid}}' });
    const result = syncFromTemplate(body, [], opts);
    expect(result.mappings[0].sourceId).toBe('__generators__');
  });

  it('assigns env refs to env source', () => {
    const body = JSON.stringify({ key: '{{API_KEY}}' });
    const result = syncFromTemplate(body, [], opts);
    expect(result.mappings[0].sourceId).toBe('__env__');
  });

  it('creates multiple mappings for multi-ref leaf {{a}}{{b}}', () => {
    const body = JSON.stringify({ combo: '{{userId}}{{orderId}}' });
    const result = syncFromTemplate(body, [], opts);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings[0].sourcePath).toBe('userId');
    expect(result.mappings[0].targetPath).toBe('combo');
    expect(result.mappings[1].sourcePath).toBe('orderId');
    expect(result.mappings[1].targetPath).toBe('combo');
    expect(result.mappingsChanged).toBe(true);
  });

  it('preserves existing mappings for multi-ref leaf on re-sync', () => {
    const existing = [
      makeMapping({ id: 'keep-a', sourcePath: 'userId', targetPath: 'combo' }),
      makeMapping({ id: 'keep-b', sourcePath: 'orderId', targetPath: 'combo' }),
    ];
    const body = JSON.stringify({ combo: '{{userId}}{{orderId}}' });
    const result = syncFromTemplate(body, existing, opts);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings[0].id).toBe('keep-a');
    expect(result.mappings[1].id).toBe('keep-b');
    expect(result.mappingsChanged).toBe(false);
  });

  it('does not produce duplicate IDs for repeated ref {{a}}{{a}}', () => {
    const existing = [
      makeMapping({ id: 'dup-1', sourcePath: 'userId', targetPath: 'combo' }),
      makeMapping({ id: 'dup-2', sourcePath: 'userId', targetPath: 'combo' }),
    ];
    const body = JSON.stringify({ combo: '{{userId}}{{userId}}' });
    const result = syncFromTemplate(body, existing, opts);
    expect(result.mappings).toHaveLength(2);
    const ids = result.mappings.map(m => m.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe('dup-1');
    expect(ids[1]).toBe('dup-2');
  });

  it('creates new mapping for second repeated ref when only one exists', () => {
    const existing = [
      makeMapping({ id: 'single', sourcePath: 'userId', targetPath: 'combo' }),
    ];
    const body = JSON.stringify({ combo: '{{userId}}{{userId}}' });
    const result = syncFromTemplate(body, existing, opts);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings[0].id).toBe('single');
    expect(result.mappings[1].id).not.toBe('single');
    expect(result.mappings[1].sourcePath).toBe('userId');
  });

  it('handles nested body paths', () => {
    const body = JSON.stringify({ user: { id: '{{userId}}' } });
    const result = syncFromTemplate(body, [], opts);
    expect(result.mappings[0].targetPath).toBe('user.id');
  });

  it('preserves mapping with expression match', () => {
    const existing = makeMapping({
      id: 'expr-1',
      sourcePath: 'raw',
      targetPath: 'total',
      expression: '$parseFloat(raw)',
    });
    const body = JSON.stringify({ total: '{{$parseFloat(raw)}}' });
    const result = syncFromTemplate(body, [existing], opts);
    expect(result.mappings[0].id).toBe('expr-1');
  });
});

// ─── syncFromVisual ───────────────────────────────────────

describe('syncFromVisual', () => {
  it('produces body from mappings', () => {
    const mappings = [
      makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' }),
      makeMapping({ id: '2', sourcePath: 'status', targetPath: 'state' }),
    ];
    const result = syncFromVisual(mappings, '{}');
    const parsed = JSON.parse(result.body);
    expect(parsed.id).toBe('{{userId}}');
    expect(parsed.state).toBe('{{status}}');
    expect(result.bodyChanged).toBe(true);
  });

  it('preserves unmapped fields from existing body', () => {
    const mappings = [
      makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' }),
    ];
    const result = syncFromVisual(mappings, '{"id": 0, "extra": true}');
    const parsed = JSON.parse(result.body);
    expect(parsed.id).toBe('{{userId}}');
    expect(parsed.extra).toBe(true);
  });

  it('detects no change when body is same', () => {
    const mappings = [
      makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' }),
    ];
    const currentBody = JSON.stringify({ id: '{{userId}}' }, null, 2);
    const result = syncFromVisual(mappings, currentBody);
    expect(result.bodyChanged).toBe(false);
  });

  it('creates nested structure from dotted paths', () => {
    const mappings = [
      makeMapping({ id: '1', sourcePath: 'city', targetPath: 'address.city' }),
    ];
    const result = syncFromVisual(mappings, '{}');
    const parsed = JSON.parse(result.body);
    expect(parsed.address.city).toBe('{{city}}');
  });

  it('handles empty mappings', () => {
    const result = syncFromVisual([], '{"old": "value"}');
    const parsed = JSON.parse(result.body);
    expect(parsed.old).toBe('value');
  });
});

// ─── resolveConflict ──────────────────────────────────────

describe('resolveConflict', () => {
  it('returns unchanged when nothing is dirty', () => {
    const body = JSON.stringify({ id: '{{userId}}' });
    const mappings = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const state: BodySyncState = {
      body,
      mappings,
      lastOrigin: 'template',
      lastSyncedBody: body,
      lastSyncedMappings: mappings,
    };
    const result = resolveConflict(state, opts);
    expect(result.bodyChanged).toBe(false);
    expect(result.mappingsChanged).toBe(false);
  });

  it('syncs from template when only body changed', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}' });
    const newBody = JSON.stringify({ id: '{{userId}}', name: '{{status}}' });
    const mappings = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const state: BodySyncState = {
      body: newBody,
      mappings,
      lastOrigin: 'template',
      lastSyncedBody: oldBody,
      lastSyncedMappings: mappings,
    };
    const result = resolveConflict(state, opts);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappingsChanged).toBe(true);
  });

  it('syncs from visual when only mappings changed', () => {
    const body = JSON.stringify({ id: '{{userId}}' });
    const oldMappings = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const newMappings = [
      makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' }),
      makeMapping({ id: '2', sourcePath: 'status', targetPath: 'state' }),
    ];
    const state: BodySyncState = {
      body,
      mappings: newMappings,
      lastOrigin: 'visual',
      lastSyncedBody: body,
      lastSyncedMappings: oldMappings,
    };
    const result = resolveConflict(state, opts);
    expect(result.bodyChanged).toBe(true);
    const parsed = JSON.parse(result.body);
    expect(parsed.state).toBe('{{status}}');
  });

  it('uses latest origin when both sides changed (template wins)', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}' });
    const newBody = JSON.stringify({ id: '{{orderId}}' });
    const oldMappings = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const newMappings = [makeMapping({ id: '2', sourcePath: 'status', targetPath: 'state' })];
    const state: BodySyncState = {
      body: newBody,
      mappings: newMappings,
      lastOrigin: 'template',
      lastSyncedBody: oldBody,
      lastSyncedMappings: oldMappings,
    };
    const result = resolveConflict(state, opts);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].sourcePath).toBe('orderId');
  });

  it('uses latest origin when both sides changed (visual wins)', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}' });
    const newBody = JSON.stringify({ id: '{{orderId}}' });
    const oldMappings = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const newMappings = [makeMapping({ id: '2', sourcePath: 'status', targetPath: 'state' })];
    const state: BodySyncState = {
      body: newBody,
      mappings: newMappings,
      lastOrigin: 'visual',
      lastSyncedBody: oldBody,
      lastSyncedMappings: oldMappings,
    };
    const result = resolveConflict(state, opts);
    const parsed = JSON.parse(result.body);
    expect(parsed.state).toBe('{{status}}');
  });
});

// ─── diffTemplateRefs ─────────────────────────────────────

describe('diffTemplateRefs', () => {
  it('detects added refs', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}' });
    const newBody = JSON.stringify({ id: '{{userId}}', name: '{{status}}' });
    const { added, removed } = diffTemplateRefs(oldBody, newBody);
    expect(added).toHaveLength(1);
    expect(added[0]).toEqual({ path: 'name', ref: 'status' });
    expect(removed).toHaveLength(0);
  });

  it('detects removed refs', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}', name: '{{status}}' });
    const newBody = JSON.stringify({ id: '{{userId}}' });
    const { added, removed } = diffTemplateRefs(oldBody, newBody);
    expect(added).toHaveLength(0);
    expect(removed).toHaveLength(1);
    expect(removed[0]).toEqual({ path: 'name', ref: 'status' });
  });

  it('detects changed ref on same path', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}' });
    const newBody = JSON.stringify({ id: '{{orderId}}' });
    const { added, removed } = diffTemplateRefs(oldBody, newBody);
    expect(removed).toHaveLength(1);
    expect(removed[0].ref).toBe('userId');
    expect(added).toHaveLength(1);
    expect(added[0].ref).toBe('orderId');
  });

  it('returns empty for identical bodies', () => {
    const body = JSON.stringify({ id: '{{userId}}' });
    const { added, removed } = diffTemplateRefs(body, body);
    expect(added).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  it('handles non-JSON bodies gracefully', () => {
    const { added, removed } = diffTemplateRefs('not json', 'also not json');
    expect(added).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  it('detects nested ref changes', () => {
    const oldBody = JSON.stringify({ user: { id: '{{userId}}' } });
    const newBody = JSON.stringify({ user: { id: '{{orderId}}' } });
    const { added, removed } = diffTemplateRefs(oldBody, newBody);
    expect(removed[0]).toEqual({ path: 'user.id', ref: 'userId' });
    expect(added[0]).toEqual({ path: 'user.id', ref: 'orderId' });
  });
});

// ─── applyTemplateDiff ────────────────────────────────────

describe('applyTemplateDiff', () => {
  it('adds mapping for newly added ref', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}' });
    const newBody = JSON.stringify({ id: '{{userId}}', name: '{{status}}' });
    const existing = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const result = applyTemplateDiff(oldBody, newBody, existing, opts);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings[0].id).toBe('1');
    expect(result.mappings[1].sourcePath).toBe('status');
    expect(result.mappingsChanged).toBe(true);
  });

  it('removes mapping for deleted ref', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}', name: '{{status}}' });
    const newBody = JSON.stringify({ id: '{{userId}}' });
    const existing = [
      makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' }),
      makeMapping({ id: '2', sourcePath: 'status', targetPath: 'name' }),
    ];
    const result = applyTemplateDiff(oldBody, newBody, existing, opts);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].sourcePath).toBe('userId');
    expect(result.mappingsChanged).toBe(true);
  });

  it('preserves existing mappings when no ref changes', () => {
    const body = JSON.stringify({ id: '{{userId}}' });
    const existing = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const result = applyTemplateDiff(body, body, existing, opts);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].id).toBe('1');
    expect(result.mappingsChanged).toBe(false);
  });

  it('handles ref replacement on same path', () => {
    const oldBody = JSON.stringify({ id: '{{userId}}' });
    const newBody = JSON.stringify({ id: '{{orderId}}' });
    const existing = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const result = applyTemplateDiff(oldBody, newBody, existing, opts);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].sourcePath).toBe('orderId');
    expect(result.mappingsChanged).toBe(true);
  });

  it('does not duplicate existing mappings', () => {
    const oldBody = JSON.stringify({});
    const newBody = JSON.stringify({ id: '{{userId}}' });
    const existing = [makeMapping({ id: '1', sourcePath: 'userId', targetPath: 'id' })];
    const result = applyTemplateDiff(oldBody, newBody, existing, opts);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].id).toBe('1');
  });

  it('assigns correct sourceId for new generator refs', () => {
    const oldBody = JSON.stringify({});
    const newBody = JSON.stringify({ reqId: '{{$uuid}}' });
    const result = applyTemplateDiff(oldBody, newBody, [], opts);
    expect(result.mappings[0].sourceId).toBe('__generators__');
  });

  it('reports bodyChanged when bodies differ', () => {
    const oldBody = JSON.stringify({ id: 1 });
    const newBody = JSON.stringify({ id: 2 });
    const result = applyTemplateDiff(oldBody, newBody, [], opts);
    expect(result.bodyChanged).toBe(true);
  });

  it('handles multiple simultaneous additions', () => {
    const oldBody = JSON.stringify({});
    const newBody = JSON.stringify({ a: '{{userId}}', b: '{{$uuid}}', c: '{{API_KEY}}' });
    const result = applyTemplateDiff(oldBody, newBody, [], opts);
    expect(result.mappings).toHaveLength(3);
    const sources = result.mappings.map(m => m.sourceId);
    expect(sources).toContain('n1');
    expect(sources).toContain('__generators__');
    expect(sources).toContain('__env__');
  });
});

// ─── mappingsEqual ────────────────────────────────────────

describe('mappingsEqual', () => {
  it('returns true for identical arrays', () => {
    const a = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y' })];
    const b = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y' })];
    expect(mappingsEqual(a, b)).toBe(true);
  });

  it('returns false for different lengths', () => {
    const a = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y' })];
    expect(mappingsEqual(a, [])).toBe(false);
  });

  it('returns false for different sourcePath', () => {
    const a = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y' })];
    const b = [makeMapping({ id: '1', sourcePath: 'z', targetPath: 'y' })];
    expect(mappingsEqual(a, b)).toBe(false);
  });

  it('returns false for different targetPath', () => {
    const a = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y' })];
    const b = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'z' })];
    expect(mappingsEqual(a, b)).toBe(false);
  });

  it('returns false for different expression', () => {
    const a = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y', expression: 'a' })];
    const b = [makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y', expression: 'b' })];
    expect(mappingsEqual(a, b)).toBe(false);
  });

  it('returns false for different sourceId', () => {
    const a = [{ id: '1', sourcePath: 'x', targetPath: 'y', sourceId: 'a' }];
    const b = [{ id: '1', sourcePath: 'x', targetPath: 'y', sourceId: 'b' }];
    expect(mappingsEqual(a, b)).toBe(false);
  });

  it('returns true for empty arrays', () => {
    expect(mappingsEqual([], [])).toBe(true);
  });

  it('returns false for different order', () => {
    const m1 = makeMapping({ id: '1', sourcePath: 'x', targetPath: 'y' });
    const m2 = makeMapping({ id: '2', sourcePath: 'a', targetPath: 'b' });
    expect(mappingsEqual([m1, m2], [m2, m1])).toBe(false);
  });
});
