import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mapping } from '../types';
import { bulkDropMappings, upsertTargetMapping } from './dropMapping';

let uuidSeq = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidSeq}`,
}));

function mapping(partial: Omit<Mapping, 'id'> & { id?: string }): Mapping {
  return {
    id: partial.id ?? 'existing-id',
    sourcePath: partial.sourcePath,
    sourceId: partial.sourceId,
    targetPath: partial.targetPath,
    expression: partial.expression,
    isAutoMapped: partial.isAutoMapped,
    isPending: partial.isPending,
  };
}

describe('upsertTargetMapping', () => {
  beforeEach(() => {
    uuidSeq = 0;
  });

  describe('creates a new mapping when no existing match', () => {
    it('appends mapping without expression', () => {
      const existing: Mapping[] = [
        mapping({
          id: 'm1',
          sourcePath: 'other',
          sourceId: 's1',
          targetPath: 'target.other',
        }),
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.user.name',
        'src-a',
        'body.name',
      );
      expect(changed).toBe(true);
      expect(next).toHaveLength(2);
      expect(next[1]).toEqual({
        id: 'test-uuid-1',
        sourcePath: '$.user.name',
        sourceId: 'src-a',
        targetPath: 'body.name',
      });
      expect(next[0]).toBe(existing[0]);
    });

    it('appends mapping with expression', () => {
      const { next, changed } = upsertTargetMapping(
        [],
        '$.a',
        's',
        't',
        'trim($.a)',
      );
      expect(changed).toBe(true);
      expect(next).toEqual([
        {
          id: 'test-uuid-1',
          sourcePath: '$.a',
          sourceId: 's',
          targetPath: 't',
          expression: 'trim($.a)',
        },
      ]);
    });

    it('does not add expression key when expression is empty string (falsy)', () => {
      const { next } = upsertTargetMapping([], '$.a', 's', 't', '');
      expect(next[0]).not.toHaveProperty('expression');
    });
  });

  describe('updates an existing mapping at same target path', () => {
    it('changes sourcePath and sourceId', () => {
      const existing: Mapping[] = [
        mapping({
          id: 'keep-me',
          sourcePath: '$.old',
          sourceId: 'old-src',
          targetPath: 'body.x',
        }),
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.new',
        'new-src',
        'body.x',
      );
      expect(changed).toBe(true);
      expect(next).toHaveLength(1);
      expect(next[0]).toEqual({
        id: 'keep-me',
        sourcePath: '$.new',
        sourceId: 'new-src',
        targetPath: 'body.x',
      });
    });

    it('changes expression when provided', () => {
      const existing: Mapping[] = [
        mapping({
          id: 'm1',
          sourcePath: '$.x',
          sourceId: 's',
          targetPath: 't',
          expression: 'oldExpr()',
        }),
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.x',
        's',
        't',
        'newExpr()',
      );
      expect(changed).toBe(true);
      expect(next[0].expression).toBe('newExpr()');
    });

    it('returns unchanged array when sourcePath, sourceId, and expression all match', () => {
      const existing: Mapping[] = [
        mapping({
          id: 'm1',
          sourcePath: '$.x',
          sourceId: 's',
          targetPath: 't',
          expression: 'e',
        }),
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.x',
        's',
        't',
        'e',
      );
      expect(changed).toBe(false);
      expect(next).toBe(existing);
    });

    it('returns unchanged when both sides have no expression', () => {
      const existing: Mapping[] = [
        mapping({
          id: 'm1',
          sourcePath: '$.x',
          sourceId: 's',
          targetPath: 't',
        }),
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.x',
        's',
        't',
        undefined,
      );
      expect(changed).toBe(false);
      expect(next).toBe(existing);
    });

    it('updates first mapping when multiple share targetPath (findIndex)', () => {
      const existing: Mapping[] = [
        mapping({
          id: 'first',
          sourcePath: '$.a',
          sourceId: 's',
          targetPath: 'dup.target',
        }),
        mapping({
          id: 'second',
          sourcePath: '$.b',
          sourceId: 's',
          targetPath: 'dup.target',
        }),
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.z',
        's',
        'dup.target',
      );
      expect(changed).toBe(true);
      expect(next[0].sourcePath).toBe('$.z');
      expect(next[0].id).toBe('first');
      expect(next[1]).toBe(existing[1]);
    });
  });

  describe('removes expression when updating without one', () => {
    it('strips expression when existing had one and update omits expression', () => {
      const existing: Mapping[] = [
        mapping({
          id: 'm1',
          sourcePath: '$.x',
          sourceId: 's',
          targetPath: 't',
          expression: 'foo()',
        }),
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.y',
        's',
        't',
      );
      expect(changed).toBe(true);
      expect(next[0]).toEqual({
        id: 'm1',
        sourcePath: '$.y',
        sourceId: 's',
        targetPath: 't',
      });
      expect(next[0].expression).toBeUndefined();
    });

    it('strips expression when passing undefined explicitly', () => {
      const existing: Mapping[] = [
        mapping({
          id: 'm1',
          sourcePath: '$.x',
          sourceId: 's',
          targetPath: 't',
          expression: 'bar()',
        }),
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.x',
        's',
        't',
        undefined,
      );
      expect(changed).toBe(true);
      expect('expression' in next[0] ? next[0].expression : undefined).toBeUndefined();
      expect(next[0]).not.toHaveProperty('expression');
    });
  });

  describe('adds expression on update when previous had none', () => {
    it('preserves extra Mapping fields when adding expression', () => {
      const existing: Mapping[] = [
        {
          id: 'm1',
          sourcePath: '$.x',
          sourceId: 's',
          targetPath: 't',
          isAutoMapped: true,
          isPending: true,
        },
      ];
      const { next, changed } = upsertTargetMapping(
        existing,
        '$.x',
        's',
        't',
        'upper($.x)',
      );
      expect(changed).toBe(true);
      expect(next[0]).toMatchObject({
        id: 'm1',
        expression: 'upper($.x)',
        isAutoMapped: true,
        isPending: true,
      });
    });
  });
});

describe('bulkDropMappings', () => {
  beforeEach(() => {
    uuidSeq = 0;
  });

  const noopSuggest = () => undefined as string | undefined;

  it('maps primary source to primary target', () => {
    const current: Mapping[] = [];
    const result = bulkDropMappings(
      current,
      ['$.payload.id'],
      '$.payload.id',
      'target.root.id',
      'src-1',
      ['target.root.id'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings).toEqual([
      {
        id: 'test-uuid-1',
        sourcePath: '$.payload.id',
        sourceId: 'src-1',
        targetPath: 'target.root.id',
      },
    ]);
  });

  it('auto-matches secondary sources by leaf name (case-insensitive)', () => {
    const result = bulkDropMappings(
      [],
      ['$.Order.Name', '$.order.Email'],
      '$.Order.Name',
      'body.name',
      'src',
      ['body.name', 'body.email', 'body.phone'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(2);
    expect(result.nextMappings.map((m) => m.targetPath).sort()).toEqual([
      'body.email',
      'body.name',
    ]);
    const byTarget = Object.fromEntries(
      result.nextMappings.map((m) => [m.targetPath, m.sourcePath]),
    );
    expect(byTarget['body.name']).toBe('$.Order.Name');
    expect(byTarget['body.email']).toBe('$.order.Email');
  });

  it('uses first target path per leaf when duplicates exist in targetLeafPaths', () => {
    const result = bulkDropMappings(
      [],
      ['$.a.foo'],
      '$.primary',
      'z.first.foo',
      's',
      ['z.first.foo', 'z.second.foo'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings[0].targetPath).toBe('z.first.foo');
  });

  it('skips secondary when target is already occupied', () => {
    const current: Mapping[] = [
      mapping({
        id: 'x',
        sourcePath: '$.existing',
        sourceId: 's',
        targetPath: 'body.email',
      }),
    ];
    const result = bulkDropMappings(
      current,
      ['$.user.email', '$.primary.only'],
      '$.primary.only',
      'body.name',
      's',
      ['body.name', 'body.email'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings).toHaveLength(2);
    const emailMap = result.nextMappings.find((m) => m.targetPath === 'body.email');
    expect(emailMap?.sourcePath).toBe('$.existing');
  });

  it('skips secondary when primary claimed the same leaf target in the same run', () => {
    const result = bulkDropMappings(
      [],
      ['$.user.email', '$.other.email'],
      '$.user.email',
      'body.email',
      's',
      ['body.email', 'body.name'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings).toHaveLength(1);
    expect(result.nextMappings[0].sourcePath).toBe('$.user.email');
  });

  it('handles no secondary match (unknown leaf)', () => {
    const result = bulkDropMappings(
      [],
      ['$.a.unknownLeaf'],
      '$.a.unknownLeaf',
      'body.known',
      's',
      ['body.known'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings).toHaveLength(1);
  });

  it('skips secondary when source leaf is empty after split (no match in map)', () => {
    const result = bulkDropMappings(
      [],
      ['$.foo', 'trail.'],
      '$.foo',
      'body.foo',
      's',
      ['body.foo', 'body.bar'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings).toHaveLength(1);
    expect(result.nextMappings[0].sourcePath).toBe('$.foo');
  });

  it('applies expression suggestions for primary via upsert', () => {
    const suggest = (sourcePath: string, _sid: string, _tp: string) =>
      sourcePath === '$.p' ? 'upper($.p)' : undefined;
    const result = bulkDropMappings(
      [],
      ['$.p'],
      '$.p',
      't.p',
      's',
      ['t.p'],
      suggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings[0].expression).toBe('upper($.p)');
  });

  it('applies expression suggestions for secondary mappings', () => {
    const suggest = (sp: string) => (sp === '$.b' ? 'len($.b)' : undefined);
    const result = bulkDropMappings(
      [],
      ['$.a', '$.b'],
      '$.a',
      'out.a',
      's',
      ['out.a', 'out.b'],
      suggest,
    );
    expect(result.appliedCount).toBe(2);
    const b = result.nextMappings.find((m) => m.sourcePath === '$.b');
    expect(b?.expression).toBe('len($.b)');
    const a = result.nextMappings.find((m) => m.sourcePath === '$.a');
    expect(a?.expression).toBeUndefined();
  });

  it('mixes primary + secondary with partial suggestions', () => {
    const suggest = (sp: string) =>
      sp === '$.primary' ? 'coalesce($.primary)' : sp === '$.extra' ? 'lowercase($.extra)' : undefined;
    const result = bulkDropMappings(
      [],
      ['$.extra', '$.primary'],
      '$.primary',
      'root.Main',
      'sid',
      ['root.Main', 'root.extra', 'root.other'],
      suggest,
    );
    expect(result.appliedCount).toBe(2);
    expect(result.nextMappings).toHaveLength(2);
    const main = result.nextMappings.find((m) => m.targetPath === 'root.Main');
    const extra = result.nextMappings.find((m) => m.targetPath === 'root.extra');
    expect(main?.expression).toBe('coalesce($.primary)');
    expect(extra?.expression).toBe('lowercase($.extra)');
  });

  it('returns empty appliedCount and copy of mappings for empty selections', () => {
    const current: Mapping[] = [
      mapping({
        id: '1',
        sourcePath: 'a',
        sourceId: 's',
        targetPath: 't',
      }),
    ];
    const result = bulkDropMappings(
      current,
      [],
      '$.p',
      't.p',
      's',
      [],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(0);
    expect(result.nextMappings).toEqual(current);
    expect(result.nextMappings).not.toBe(current);
  });

  it('does not increment appliedCount when primary upsert is no-op', () => {
    const current: Mapping[] = [
      mapping({
        id: 'same',
        sourcePath: '$.p',
        sourceId: 's',
        targetPath: 't.p',
      }),
    ];
    const result = bulkDropMappings(
      current,
      ['$.p'],
      '$.p',
      't.p',
      's',
      ['t.p'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(0);
    expect(result.nextMappings).toStrictEqual(current);
    expect(result.nextMappings).not.toBe(current);
  });

  it('processes only secondaries when primary path is omitted from selection', () => {
    const result = bulkDropMappings(
      [],
      ['$.side.name'],
      '$.primary.not.selected',
      'root.name',
      's',
      ['root.name', 'root.email'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings[0]).toMatchObject({
      sourcePath: '$.side.name',
      targetPath: 'root.name',
    });
  });

  it('does not add target leaves with empty segment to targetByLeaf', () => {
    const result = bulkDropMappings(
      [],
      ['$.x.y'],
      '$.x.y',
      'valid.leaf',
      's',
      ['valid.leaf', 'noleaf.'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
  });

  it('ignores targetLeafPaths when split returns empty (pop undefined, ?? branch)', () => {
    const noSegments = { split: () => [] as string[] } as unknown as string;
    const result = bulkDropMappings(
      [],
      ['$.only'],
      '$.only',
      'root.only',
      's',
      [noSegments, 'root.only'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings[0].targetPath).toBe('root.only');
  });

  it('skips secondary when split returns empty (pop undefined)', () => {
    const noSegments = { split: () => [] as string[] } as unknown as string;
    const result = bulkDropMappings(
      [],
      [noSegments, '$.keep'],
      '$.keep',
      'out.keep',
      's',
      ['out.keep', 'out.extra'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings[0].sourcePath).toBe('$.keep');
  });

  it('skips later targetLeafPaths that repeat the same leaf (first path wins in map)', () => {
    const result = bulkDropMappings(
      [],
      ['$.only.foo'],
      '$.only.foo',
      'first.foo',
      's',
      ['first.foo', 'second.foo'],
      noopSuggest,
    );
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings[0].targetPath).toBe('first.foo');
  });
});
