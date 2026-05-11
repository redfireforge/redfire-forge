import { describe, it, expect } from 'vitest';
import {
  levenshtein,
  suggestRepairs,
  generateRepairResults,
  applyRepair,
} from './schemaRepair';
import type { SchemaSnapshot } from './schemaSnapshot';
import type { ClassifiedDrift } from './schemaDrift';

function snap(fields: Array<{ path: string; type: string }>): SchemaSnapshot {
  return {
    id: 'test',
    contextId: 'test',
    side: 'source',
    fields: fields.map((f) => ({
      ...f,
      depth: f.path.split('.').length - 1,
      nullable: false,
      isArrayElement: false,
    })),
    capturedAt: new Date().toISOString(),
    topLevelKeyCount: fields.length,
  };
}

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('computes correct distance for simple edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('name', 'names')).toBe(1);
    expect(levenshtein('userId', 'user_id')).toBe(2);
  });

  it('handles single-character strings', () => {
    expect(levenshtein('a', 'b')).toBe(1);
    expect(levenshtein('a', 'a')).toBe(0);
  });
});

describe('suggestRepairs', () => {
  it('suggests similar names via Levenshtein', () => {
    const saved = snap([{ path: 'userName', type: 'string' }]);
    const current = snap([{ path: 'user_name', type: 'string' }]);

    const suggestions = suggestRepairs('userName', 'm1', current, saved);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].suggestedPath).toBe('user_name');
    expect(suggestions[0].strategy).toBe('similar-name');
    expect(suggestions[0].confidence).toBeGreaterThan(0);
  });

  it('suggests renamed candidates (same parent, same type, new field)', () => {
    const saved = snap([
      { path: 'user.firstName', type: 'string' },
      { path: 'user.age', type: 'number' },
    ]);
    const current = snap([
      { path: 'user.givenName', type: 'string' },
      { path: 'user.age', type: 'number' },
    ]);

    const suggestions = suggestRepairs('user.firstName', 'm1', current, saved);
    const renamed = suggestions.find((s) => s.strategy === 'renamed-candidate');
    expect(renamed).toBeDefined();
    expect(renamed!.suggestedPath).toBe('user.givenName');
    expect(renamed!.reason).toContain('likely rename');
  });

  it('boosts confidence when both similar-name and renamed-candidate match', () => {
    const saved = snap([{ path: 'email', type: 'string' }]);
    const current = snap([{ path: 'emails', type: 'string' }]);

    const suggestions = suggestRepairs('email', 'm1', current, saved);
    expect(suggestions.length).toBeGreaterThan(0);
    const top = suggestions[0];
    expect(top.suggestedPath).toBe('emails');
    expect(top.confidence).toBeGreaterThan(70);
  });

  it('returns empty for no viable candidates', () => {
    const saved = snap([{ path: 'foo', type: 'string' }]);
    const current = snap([{ path: 'completely_different_name_xyz', type: 'number' }]);

    const suggestions = suggestRepairs('foo', 'm1', current, saved);
    expect(suggestions).toEqual([]);
  });

  it('limits suggestions to MAX_SUGGESTIONS_PER_MAPPING', () => {
    const saved = snap([{ path: 'x', type: 'string' }]);
    const currentFields = [];
    for (let i = 0; i < 10; i++) {
      currentFields.push({ path: `x${i}`, type: 'string' });
    }
    const current = snap(currentFields);

    const suggestions = suggestRepairs('x', 'm1', current, saved);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it('sorts suggestions by confidence descending', () => {
    const saved = snap([{ path: 'name', type: 'string' }]);
    const current = snap([
      { path: 'named', type: 'string' },
      { path: 'names', type: 'string' },
      { path: 'naame', type: 'string' },
    ]);

    const suggestions = suggestRepairs('name', 'm1', current, saved);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i].confidence).toBeLessThanOrEqual(suggestions[i - 1].confidence);
    }
  });

  it('handles paths with .[*] segments correctly (lastSegment bug)', () => {
    const saved = snap([{ path: 'items.[*].userName', type: 'string' }]);
    const current = snap([{ path: 'items.[*].user_name', type: 'string' }]);

    const suggestions = suggestRepairs('items.[*].userName', 'm1', current, saved);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].suggestedPath).toBe('items.[*].user_name');
    expect(suggestions[0].strategy).toBe('similar-name');
  });

  it('handles deeply nested .[*] paths without corruption', () => {
    const saved = snap([{ path: 'data.[*].nested.[*].field', type: 'string' }]);
    const current = snap([{ path: 'data.[*].nested.[*].fields', type: 'string' }]);

    const suggestions = suggestRepairs('data.[*].nested.[*].field', 'm1', current, saved);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].suggestedPath).toBe('data.[*].nested.[*].fields');
  });

  it('returns empty when current and saved snapshots have no fields', () => {
    const saved = snap([]);
    const current = snap([]);
    const suggestions = suggestRepairs('missing', 'm1', current, saved);
    expect(suggestions).toEqual([]);
  });

  it('penalizes type mismatch in confidence', () => {
    const saved = snap([{ path: 'count', type: 'number' }]);
    const current = snap([
      { path: 'counts', type: 'number' },
      { path: 'countt', type: 'string' },
    ]);

    const suggestions = suggestRepairs('count', 'm1', current, saved);
    const sameType = suggestions.find((s) => s.suggestedPath === 'counts');
    const diffType = suggestions.find((s) => s.suggestedPath === 'countt');
    expect(sameType).toBeDefined();
    expect(diffType).toBeDefined();
    expect(sameType!.confidence).toBeGreaterThan(diffType!.confidence);
  });
});

describe('generateRepairResults', () => {
  it('generates results for breaking drifts with affected mappings', () => {
    const saved = snap([{ path: 'oldField', type: 'string' }]);
    const current = snap([{ path: 'newField', type: 'string' }]);
    const drifts: ClassifiedDrift[] = [
      {
        path: 'oldField',
        driftType: 'removed',
        savedType: 'string',
        affectedMappingIds: ['m1'],
        severity: 'breaking',
        description: 'Field removed',
      },
    ];

    const results = generateRepairResults(drifts, current, saved);
    expect(results).toHaveLength(1);
    expect(results[0].mappingId).toBe('m1');
    expect(results[0].driftPath).toBe('oldField');
    expect(results[0].suggestions.length).toBeGreaterThan(0);
  });

  it('skips non-breaking drifts', () => {
    const saved = snap([{ path: 'x', type: 'string' }]);
    const current = snap([{ path: 'x', type: 'number' }]);
    const drifts: ClassifiedDrift[] = [
      {
        path: 'x',
        driftType: 'typeChanged',
        savedType: 'string',
        currentType: 'number',
        affectedMappingIds: ['m1'],
        severity: 'warning',
        description: 'Type changed',
      },
    ];

    const results = generateRepairResults(drifts, current, saved);
    expect(results).toEqual([]);
  });

  it('deduplicates results for same mapping + drift path', () => {
    const saved = snap([{ path: 'x', type: 'string' }]);
    const current = snap([{ path: 'xx', type: 'string' }]);
    const drifts: ClassifiedDrift[] = [
      {
        path: 'x',
        driftType: 'removed',
        savedType: 'string',
        affectedMappingIds: ['m1', 'm1'],
        severity: 'breaking',
        description: 'Field removed',
      },
    ];

    const results = generateRepairResults(drifts, current, saved);
    const m1Results = results.filter((r) => r.mappingId === 'm1');
    expect(m1Results).toHaveLength(1);
  });

  it('handles multiple affected mappings for same drift', () => {
    const saved = snap([{ path: 'field', type: 'string' }]);
    const current = snap([{ path: 'fields', type: 'string' }]);
    const drifts: ClassifiedDrift[] = [
      {
        path: 'field',
        driftType: 'removed',
        savedType: 'string',
        affectedMappingIds: ['m1', 'm2'],
        severity: 'breaking',
        description: 'Field removed',
      },
    ];

    const results = generateRepairResults(drifts, current, saved);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.mappingId)).toEqual(['m1', 'm2']);
  });
});

describe('applyRepair', () => {
  it('updates mapping sourcePath to suggested path', () => {
    const mapping: Mapping = {
      id: 'm1',
      sourceId: 's1',
      sourcePath: 'old.field',
      targetPath: 'out',
    };
    const suggestion = {
      driftPath: 'old.field',
      mappingId: 'm1',
      suggestedPath: 'new.field',
      reason: 'Similar name',
      strategy: 'similar-name' as const,
      confidence: 80,
    };

    const repaired = applyRepair(mapping, suggestion);
    expect(repaired.sourcePath).toBe('new.field');
    expect(repaired.id).toBe('m1');
    expect(repaired.targetPath).toBe('out');
  });

  it('preserves other mapping properties', () => {
    const mapping: Mapping = {
      id: 'm2',
      sourceId: 's1',
      sourcePath: 'x',
      targetPath: 'y',
      expression: '$upper(x)',
    };
    const suggestion = {
      driftPath: 'x',
      mappingId: 'm2',
      suggestedPath: 'xx',
      reason: 'test',
      strategy: 'similar-name' as const,
      confidence: 50,
    };

    const repaired = applyRepair(mapping, suggestion);
    expect(repaired.sourcePath).toBe('xx');
    expect(repaired.expression).toBe('$upper(xx)');
    expect(repaired.sourceId).toBe('s1');
  });
});
