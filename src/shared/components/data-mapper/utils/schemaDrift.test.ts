import { describe, it, expect } from 'vitest';
import {
  diffSchemas,
  findAffectedMappings,
  summarizeDrift,
  formatDriftMessage,
  classifyDrift,
  summarizeClassifiedDrift,
} from './schemaDrift';
import type { SchemaDrift } from './schemaDrift';
import { captureSchemaSnapshot } from './schemaSnapshot';
import type { SchemaSnapshot } from './schemaSnapshot';
import type { Mapping } from '../types';

function snap(data: unknown): SchemaSnapshot {
  return captureSchemaSnapshot('test', 'source', data);
}

function makeMapping(overrides: Partial<Mapping> & { id: string; sourcePath: string; targetPath: string }): Mapping {
  return { sourceId: 's1', ...overrides };
}

// ─── diffSchemas ──────────────────────────────────────────

describe('diffSchemas', () => {
  it('returns empty for identical schemas', () => {
    const s = snap({ name: 'Alice', age: 30 });
    expect(diffSchemas(s, s)).toEqual([]);
  });

  it('detects added fields', () => {
    const saved = snap({ name: 'Alice' });
    const current = snap({ name: 'Alice', age: 30 });
    const drifts = diffSchemas(saved, current);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('added');
    expect(drifts[0].path).toBe('age');
    expect(drifts[0].currentType).toBe('number');
    expect(drifts[0].savedType).toBeUndefined();
  });

  it('detects removed fields', () => {
    const saved = snap({ name: 'Alice', age: 30 });
    const current = snap({ name: 'Alice' });
    const drifts = diffSchemas(saved, current);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('removed');
    expect(drifts[0].path).toBe('age');
    expect(drifts[0].savedType).toBe('number');
    expect(drifts[0].currentType).toBeUndefined();
  });

  it('detects type changes', () => {
    const saved = snap({ value: 'hello' });
    const current = snap({ value: 42 });
    const drifts = diffSchemas(saved, current);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('typeChanged');
    expect(drifts[0].path).toBe('value');
    expect(drifts[0].savedType).toBe('string');
    expect(drifts[0].currentType).toBe('number');
  });

  it('detects nullable changes', () => {
    const saved = snap({ value: null });
    const current = snap({ value: 'hello' });
    const drifts = diffSchemas(saved, current);
    // null → string is a type change, not just nullable change
    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('typeChanged');
    expect(drifts[0].savedType).toBe('null');
    expect(drifts[0].currentType).toBe('string');
  });

  it('detects multiple drift types simultaneously', () => {
    const saved = snap({ name: 'Alice', age: 30, email: 'a@b.com' });
    const current = snap({ name: 42, phone: '555' });
    const drifts = diffSchemas(saved, current);

    const types = drifts.map(d => d.driftType);
    expect(types).toContain('removed');
    expect(types).toContain('typeChanged');
    expect(types).toContain('added');

    expect(drifts.find(d => d.path === 'age')!.driftType).toBe('removed');
    expect(drifts.find(d => d.path === 'email')!.driftType).toBe('removed');
    expect(drifts.find(d => d.path === 'name')!.driftType).toBe('typeChanged');
    expect(drifts.find(d => d.path === 'phone')!.driftType).toBe('added');
  });

  it('handles nested field drift', () => {
    const saved = snap({ user: { name: 'Alice' } });
    const current = snap({ user: { name: 'Alice', email: 'a@b.com' } });
    const drifts = diffSchemas(saved, current);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].path).toBe('user.email');
    expect(drifts[0].driftType).toBe('added');
  });

  it('handles array field drift', () => {
    const saved = snap({ items: [{ id: 1 }] });
    const current = snap({ items: [{ id: 1, name: 'Item' }] });
    const drifts = diffSchemas(saved, current);
    const addedPaths = drifts.filter(d => d.driftType === 'added').map(d => d.path);
    expect(addedPaths).toContain('items.[*].name');
  });

  it('detects structural change (scalar → object)', () => {
    const saved = snap({ value: 'simple' });
    const current = snap({ value: { nested: true } });
    const drifts = diffSchemas(saved, current);
    const valueDrift = drifts.find(d => d.path === 'value');
    expect(valueDrift).toBeDefined();
    expect(valueDrift!.driftType).toBe('typeChanged');
    expect(valueDrift!.savedType).toBe('string');
    expect(valueDrift!.currentType).toBe('object');
  });

  it('detects structural change (object → array)', () => {
    const saved = snap({ data: { x: 1 } });
    const current = snap({ data: [1, 2] });
    const drifts = diffSchemas(saved, current);
    const dataDrift = drifts.find(d => d.path === 'data');
    expect(dataDrift).toBeDefined();
    expect(dataDrift!.savedType).toBe('object');
    expect(dataDrift!.currentType).toBe('array');
  });

  it('handles both schemas empty', () => {
    const saved = snap({});
    const current = snap({});
    expect(diffSchemas(saved, current)).toEqual([]);
  });

  it('handles saved empty, current has fields', () => {
    const saved = snap({});
    const current = snap({ name: 'Alice' });
    const drifts = diffSchemas(saved, current);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('added');
  });

  it('detects nullable change on same type', () => {
    // To test nullable change specifically, we need two snapshots with
    // same type but different nullable. Build manually:
    const saved: SchemaSnapshot = {
      id: 's1', contextId: 'test', side: 'source', fields: [
        { path: 'val', type: 'string', depth: 0, nullable: true, isArrayElement: false },
      ], capturedAt: '', topLevelKeyCount: 1,
    };
    const current: SchemaSnapshot = {
      id: 's2', contextId: 'test', side: 'source', fields: [
        { path: 'val', type: 'string', depth: 0, nullable: false, isArrayElement: false },
      ], capturedAt: '', topLevelKeyCount: 1,
    };
    const drifts = diffSchemas(saved, current);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('nullableChanged');
    expect(drifts[0].savedNullable).toBe(true);
    expect(drifts[0].currentNullable).toBe(false);
  });
});

// ─── findAffectedMappings ─────────────────────────────────

describe('findAffectedMappings', () => {
  it('links drift to mappings by source path', () => {
    const drifts: SchemaDrift[] = [{
      path: 'name',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'name', targetPath: 'userName' }),
      makeMapping({ id: 'm2', sourcePath: 'age', targetPath: 'userAge' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual(['m1']);
  });

  it('links drift to mappings by target path', () => {
    const drifts: SchemaDrift[] = [{
      path: 'output',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'name', targetPath: 'output' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'target');
    expect(result[0].affectedMappingIds).toEqual(['m1']);
  });

  it('matches child paths of removed parent', () => {
    const drifts: SchemaDrift[] = [{
      path: 'user',
      driftType: 'removed',
      savedType: 'object',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'user.name', targetPath: 'out1' }),
      makeMapping({ id: 'm2', sourcePath: 'user.age', targetPath: 'out2' }),
      makeMapping({ id: 'm3', sourcePath: 'status', targetPath: 'out3' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual(['m1', 'm2']);
  });

  it('matches array child paths', () => {
    const drifts: SchemaDrift[] = [{
      path: 'items',
      driftType: 'typeChanged',
      savedType: 'array',
      currentType: 'string',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'items[0].name', targetPath: 'out' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual(['m1']);
  });

  it('returns empty affected list when no mappings match', () => {
    const drifts: SchemaDrift[] = [{
      path: 'unused',
      driftType: 'added',
      currentType: 'string',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'name', targetPath: 'out' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual([]);
  });

  it('handles empty mappings', () => {
    const drifts: SchemaDrift[] = [{
      path: 'field',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: [],
    }];
    const result = findAffectedMappings(drifts, [], 'source');
    expect(result[0].affectedMappingIds).toEqual([]);
  });

  it('does NOT match substring paths (name vs username)', () => {
    const drifts: SchemaDrift[] = [{
      path: 'name',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'username', targetPath: 'out' }),
      makeMapping({ id: 'm2', sourcePath: 'name', targetPath: 'out2' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual(['m2']);
  });

  it('matches indexed paths against wildcard drift paths', () => {
    const drifts: SchemaDrift[] = [{
      path: 'items.[*].name',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'items[0].name', targetPath: 'out' }),
      makeMapping({ id: 'm2', sourcePath: 'items[5].name', targetPath: 'out2' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual(['m1', 'm2']);
  });

  it('matches wildcard mapping paths against wildcard drift paths', () => {
    const drifts: SchemaDrift[] = [{
      path: 'data.[*].id',
      driftType: 'typeChanged',
      savedType: 'number',
      currentType: 'string',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'data.[*].id', targetPath: 'out' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual(['m1']);
  });

  it('filters by sourceId when drift has sourceId', () => {
    const drifts: SchemaDrift[] = [{
      path: 'name',
      driftType: 'removed',
      savedType: 'string',
      sourceId: 'src-A',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'name', targetPath: 'out1', sourceId: 'src-A' }),
      makeMapping({ id: 'm2', sourcePath: 'name', targetPath: 'out2', sourceId: 'src-B' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual(['m1']);
  });

  it('does not filter by sourceId when drift has no sourceId', () => {
    const drifts: SchemaDrift[] = [{
      path: 'name',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: [],
    }];
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'name', targetPath: 'out1', sourceId: 'src-A' }),
      makeMapping({ id: 'm2', sourcePath: 'name', targetPath: 'out2', sourceId: 'src-B' }),
    ];
    const result = findAffectedMappings(drifts, mappings, 'source');
    expect(result[0].affectedMappingIds).toEqual(['m1', 'm2']);
  });
});

// ─── summarizeDrift ───────────────────────────────────────

describe('summarizeDrift', () => {
  it('returns zero summary for no drifts', () => {
    const summary = summarizeDrift([]);
    expect(summary.hasDrift).toBe(false);
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.typeChanged).toBe(0);
    expect(summary.nullableChanged).toBe(0);
    expect(summary.totalAffectedMappings).toBe(0);
  });

  it('counts drift types correctly', () => {
    const drifts: SchemaDrift[] = [
      { path: 'a', driftType: 'added', currentType: 'string', affectedMappingIds: [] },
      { path: 'b', driftType: 'added', currentType: 'number', affectedMappingIds: [] },
      { path: 'c', driftType: 'removed', savedType: 'string', affectedMappingIds: ['m1'] },
      { path: 'd', driftType: 'typeChanged', savedType: 'string', currentType: 'number', affectedMappingIds: ['m2'] },
      { path: 'e', driftType: 'nullableChanged', savedType: 'string', currentType: 'string', savedNullable: false, currentNullable: true, affectedMappingIds: [] },
    ];
    const summary = summarizeDrift(drifts);
    expect(summary.added).toBe(2);
    expect(summary.removed).toBe(1);
    expect(summary.typeChanged).toBe(1);
    expect(summary.nullableChanged).toBe(1);
    expect(summary.totalAffectedMappings).toBe(2);
    expect(summary.hasDrift).toBe(true);
  });

  it('deduplicates affected mapping IDs', () => {
    const drifts: SchemaDrift[] = [
      { path: 'a', driftType: 'removed', savedType: 'string', affectedMappingIds: ['m1', 'm2'] },
      { path: 'b', driftType: 'removed', savedType: 'number', affectedMappingIds: ['m2', 'm3'] },
    ];
    const summary = summarizeDrift(drifts);
    expect(summary.totalAffectedMappings).toBe(3);
  });
});

// ─── formatDriftMessage ───────────────────────────────────

describe('formatDriftMessage', () => {
  it('returns "no changes" for no drift', () => {
    const summary = summarizeDrift([]);
    expect(formatDriftMessage(summary)).toBe('No schema changes detected.');
  });

  it('formats added-only drift', () => {
    const msg = formatDriftMessage({
      added: 3, removed: 0, typeChanged: 0, nullableChanged: 0,
      totalAffectedMappings: 0, hasDrift: true,
    });
    expect(msg).toBe('Schema changed: 3 added');
  });

  it('formats mixed drift with affected mappings', () => {
    const msg = formatDriftMessage({
      added: 1, removed: 2, typeChanged: 1, nullableChanged: 0,
      totalAffectedMappings: 3, hasDrift: true,
    });
    expect(msg).toBe('Schema changed: 1 added, 2 removed, 1 type changed (3 mappings affected)');
  });

  it('formats single affected mapping (no plural)', () => {
    const msg = formatDriftMessage({
      added: 0, removed: 1, typeChanged: 0, nullableChanged: 0,
      totalAffectedMappings: 1, hasDrift: true,
    });
    expect(msg).toBe('Schema changed: 1 removed (1 mapping affected)');
  });

  it('formats nullable-only drift', () => {
    const msg = formatDriftMessage({
      added: 0, removed: 0, typeChanged: 0, nullableChanged: 2,
      totalAffectedMappings: 0, hasDrift: true,
    });
    expect(msg).toBe('Schema changed: 2 nullable changed');
  });
});

// ─── classifyDrift ────────────────────────────────────────

describe('classifyDrift', () => {
  it('classifies added fields as "info"', () => {
    const drifts: SchemaDrift[] = [{
      path: 'email',
      driftType: 'added',
      currentType: 'string',
      affectedMappingIds: [],
    }];
    const classified = classifyDrift(drifts);
    expect(classified).toHaveLength(1);
    expect(classified[0].severity).toBe('info');
    expect(classified[0].description).toContain('New field');
    expect(classified[0].description).toContain('email');
  });

  it('classifies removed field with affected mappings as "breaking"', () => {
    const drifts: SchemaDrift[] = [{
      path: 'status',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: ['m1', 'm2'],
    }];
    const classified = classifyDrift(drifts);
    expect(classified[0].severity).toBe('breaking');
    expect(classified[0].description).toContain('removed');
    expect(classified[0].description).toContain('2 mappings will break');
  });

  it('classifies removed field without affected mappings as "warning"', () => {
    const drifts: SchemaDrift[] = [{
      path: 'unused',
      driftType: 'removed',
      savedType: 'number',
      affectedMappingIds: [],
    }];
    const classified = classifyDrift(drifts);
    expect(classified[0].severity).toBe('warning');
    expect(classified[0].description).toContain('no mappings affected');
  });

  it('classifies removed field with single mapping (singular text)', () => {
    const drifts: SchemaDrift[] = [{
      path: 'name',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: ['m1'],
    }];
    const classified = classifyDrift(drifts);
    expect(classified[0].severity).toBe('breaking');
    expect(classified[0].description).toContain('1 mapping will break');
  });

  it('classifies typeChanged as "warning"', () => {
    const drifts: SchemaDrift[] = [{
      path: 'count',
      driftType: 'typeChanged',
      savedType: 'number',
      currentType: 'string',
      affectedMappingIds: ['m1'],
    }];
    const classified = classifyDrift(drifts);
    expect(classified[0].severity).toBe('warning');
    expect(classified[0].description).toContain('changed from number to string');
  });

  it('classifies nullableChanged as "info"', () => {
    const drifts: SchemaDrift[] = [{
      path: 'value',
      driftType: 'nullableChanged',
      savedType: 'string',
      currentType: 'string',
      savedNullable: false,
      currentNullable: true,
      affectedMappingIds: [],
    }];
    const classified = classifyDrift(drifts);
    expect(classified[0].severity).toBe('info');
    expect(classified[0].description).toContain('can now be null');
  });

  it('classifies nullableChanged to non-nullable', () => {
    const drifts: SchemaDrift[] = [{
      path: 'value',
      driftType: 'nullableChanged',
      savedType: 'string',
      currentType: 'string',
      savedNullable: true,
      currentNullable: false,
      affectedMappingIds: [],
    }];
    const classified = classifyDrift(drifts);
    expect(classified[0].severity).toBe('info');
    expect(classified[0].description).toContain('no longer nullable');
  });

  it('classifies a mixed list with correct severities', () => {
    const drifts: SchemaDrift[] = [
      { path: 'a', driftType: 'added', currentType: 'string', affectedMappingIds: [] },
      { path: 'b', driftType: 'removed', savedType: 'string', affectedMappingIds: ['m1'] },
      { path: 'c', driftType: 'typeChanged', savedType: 'number', currentType: 'string', affectedMappingIds: [] },
      { path: 'd', driftType: 'removed', savedType: 'number', affectedMappingIds: [] },
    ];
    const classified = classifyDrift(drifts);
    expect(classified.map(c => c.severity)).toEqual(['info', 'breaking', 'warning', 'warning']);
  });

  it('returns empty array for empty input', () => {
    expect(classifyDrift([])).toEqual([]);
  });
});

// ─── summarizeClassifiedDrift ─────────────────────────────

describe('summarizeClassifiedDrift', () => {
  it('returns zero counts for empty input', () => {
    const summary = summarizeClassifiedDrift([]);
    expect(summary.breakingCount).toBe(0);
    expect(summary.warningCount).toBe(0);
    expect(summary.infoCount).toBe(0);
    expect(summary.hasDrift).toBe(false);
  });

  it('counts severity levels correctly', () => {
    const drifts: SchemaDrift[] = [
      { path: 'a', driftType: 'added', currentType: 'string', affectedMappingIds: [] },
      { path: 'b', driftType: 'removed', savedType: 'string', affectedMappingIds: ['m1'] },
      { path: 'c', driftType: 'typeChanged', savedType: 'number', currentType: 'string', affectedMappingIds: [] },
      { path: 'd', driftType: 'removed', savedType: 'number', affectedMappingIds: [] },
      { path: 'e', driftType: 'nullableChanged', savedType: 'string', currentType: 'string', savedNullable: false, currentNullable: true, affectedMappingIds: [] },
    ];
    const classified = classifyDrift(drifts);
    const summary = summarizeClassifiedDrift(classified);
    expect(summary.infoCount).toBe(2);     // added + nullableChanged
    expect(summary.warningCount).toBe(2);  // typeChanged + removed-no-mappings
    expect(summary.breakingCount).toBe(1); // removed-with-mappings
    expect(summary.hasDrift).toBe(true);
  });

  it('includes base DriftSummary fields', () => {
    const drifts: SchemaDrift[] = [
      { path: 'a', driftType: 'added', currentType: 'string', affectedMappingIds: [] },
      { path: 'b', driftType: 'removed', savedType: 'string', affectedMappingIds: ['m1'] },
    ];
    const classified = classifyDrift(drifts);
    const summary = summarizeClassifiedDrift(classified);
    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(1);
    expect(summary.totalAffectedMappings).toBe(1);
  });
});

// ─── Integration: capture → diff ──────────────────────────

describe('integration: capture then diff', () => {
  it('detects drift when API adds a field', () => {
    const saved = snap({ id: 1, name: 'Alice' });
    const current = snap({ id: 1, name: 'Alice', email: 'a@b.com' });

    const drifts = diffSchemas(saved, current);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].path).toBe('email');
    expect(drifts[0].driftType).toBe('added');

    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'name', targetPath: 'userName' }),
    ];
    const withMappings = findAffectedMappings(drifts, mappings, 'source');
    expect(withMappings[0].affectedMappingIds).toEqual([]);
  });

  it('detects drift when API removes a mapped field', () => {
    const saved = snap({ id: 1, name: 'Alice', status: 'active' });
    const current = snap({ id: 1, name: 'Alice' });

    const drifts = diffSchemas(saved, current);
    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'status', targetPath: 'userStatus' }),
    ];
    const withMappings = findAffectedMappings(drifts, mappings, 'source');

    expect(withMappings[0].driftType).toBe('removed');
    expect(withMappings[0].affectedMappingIds).toEqual(['m1']);
  });

  it('detects drift when API changes field type', () => {
    const saved = snap({ count: 42 });
    const current = snap({ count: '42' });

    const drifts = diffSchemas(saved, current);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].path).toBe('count');
    expect(drifts[0].driftType).toBe('typeChanged');
    expect(drifts[0].savedType).toBe('number');
    expect(drifts[0].currentType).toBe('string');
  });

  it('produces accurate summary for complex drift', () => {
    const saved = snap({
      user: { name: 'Alice', age: 30 },
      items: [{ id: 1 }],
    });
    const current = snap({
      user: { name: 'Alice', email: 'a@b.com' },
      items: [{ id: '1', title: 'Item' }],
      newField: true,
    });

    const drifts = diffSchemas(saved, current);
    const summary = summarizeDrift(drifts);
    expect(summary.hasDrift).toBe(true);
    expect(summary.removed).toBeGreaterThan(0);
    expect(summary.added).toBeGreaterThan(0);
  });

  it('full pipeline: capture → diff → findAffected → classify → summarizeClassified', () => {
    const saved = snap({ id: 1, name: 'Alice', status: 'active' });
    const current = snap({ id: 1, name: 'Alice', email: 'new@test.com' });

    const mappings = [
      makeMapping({ id: 'm1', sourcePath: 'status', targetPath: 'out1' }),
      makeMapping({ id: 'm2', sourcePath: 'name', targetPath: 'out2' }),
    ];

    const rawDrifts = diffSchemas(saved, current);
    const withMappings = findAffectedMappings(rawDrifts, mappings, 'source');
    const classified = classifyDrift(withMappings);
    const summary = summarizeClassifiedDrift(classified);

    expect(summary.hasDrift).toBe(true);
    expect(summary.removed).toBe(1);
    expect(summary.added).toBe(1);

    const removedDrift = classified.find(c => c.driftType === 'removed');
    expect(removedDrift).toBeDefined();
    expect(removedDrift!.severity).toBe('breaking');
    expect(removedDrift!.affectedMappingIds).toEqual(['m1']);

    const addedDrift = classified.find(c => c.driftType === 'added');
    expect(addedDrift).toBeDefined();
    expect(addedDrift!.severity).toBe('info');

    expect(summary.breakingCount).toBe(1);
    expect(summary.infoCount).toBe(1);
    expect(summary.totalAffectedMappings).toBe(1);
  });

  it('all removed fields with no affected mappings → all classified as warning', () => {
    const saved = snap({ a: 1, b: 'x', c: true });
    const current = snap({});

    const rawDrifts = diffSchemas(saved, current);
    const withMappings = findAffectedMappings(rawDrifts, [], 'source');
    const classified = classifyDrift(withMappings);

    expect(classified).toHaveLength(3);
    for (const c of classified) {
      expect(c.driftType).toBe('removed');
      expect(c.severity).toBe('warning');
    }
  });
});
