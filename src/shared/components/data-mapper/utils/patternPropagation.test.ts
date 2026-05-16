import { describe, expect, it } from 'vitest';
import type { Mapping } from '../types';
import {
  buildPatternPropagationPreview,
  projectPatternExpression,
} from './patternPropagation';

describe('patternPropagation', () => {
  it('returns null when anchor mapping is not array-index based', () => {
    const anchor: Mapping = {
      id: 'a1',
      sourcePath: 'customer.name',
      sourceId: 's1',
      targetPath: 'customer.name',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor],
      ['customer.name'],
      ['customer.name'],
      's1',
    );
    expect(preview).toBeNull();
  });

  it('builds preview rows with new, update, unchanged, and missing-source actions', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'offers[0].associatedOfferingCode',
      sourceId: 's1',
      targetPath: 'offers[0].associatedOfferingCode',
    };
    const existing: Mapping[] = [
      anchor,
      {
        id: 'm1',
        sourcePath: 'offers[0].associatedOfferingCode',
        sourceId: 's1',
        targetPath: 'offers[1].associatedOfferingCode',
      },
      {
        id: 'm2',
        sourcePath: 'offers[2].associatedOfferingCode',
        sourceId: 's1',
        targetPath: 'offers[2].associatedOfferingCode',
      },
    ];

    const preview = buildPatternPropagationPreview(
      anchor,
      existing,
      [
        'offers[0].associatedOfferingCode',
        'offers[1].associatedOfferingCode',
        'offers[2].associatedOfferingCode',
      ],
      [
        'offers[0].associatedOfferingCode',
        'offers[1].associatedOfferingCode',
        'offers[2].associatedOfferingCode',
        'offers[3].associatedOfferingCode',
      ],
      's1',
    );

    expect(preview).toBeTruthy();
    if (!preview) return;
    expect(preview.insertedCount).toBe(0);
    expect(preview.updatedCount).toBe(1);
    expect(preview.unchangedCount).toBe(2);
    expect(preview.missingSourceCount).toBe(1);

    const byTarget = new Map(preview.rows.map((row) => [row.targetPath, row.action]));
    expect(byTarget.get('offers[0].associatedOfferingCode')).toBe('unchanged');
    expect(byTarget.get('offers[1].associatedOfferingCode')).toBe('update');
    expect(byTarget.get('offers[2].associatedOfferingCode')).toBe('unchanged');
    expect(byTarget.get('offers[3].associatedOfferingCode')).toBe('missing-source');
  });

  it('normalizes dot-before-index paths while building preview', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: '$.offers.[0].associatedOfferingCode',
      sourceId: 's1',
      targetPath: 'offers[0].associatedOfferingCode',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor],
      ['offers[0].associatedOfferingCode', 'offers[1].associatedOfferingCode'],
      ['offers[0].associatedOfferingCode', 'offers[1].associatedOfferingCode'],
      's1',
    );
    expect(preview).toBeTruthy();
    if (!preview) return;
    expect(preview.rows.find((row) => row.targetPath === 'offers[1].associatedOfferingCode')?.sourcePath)
      .toBe('offers[1].associatedOfferingCode');
  });

  it('projects expressions from anchor source path to propagated source paths', () => {
    expect(
      projectPatternExpression(
        '$toString($.offers[0].associatedOfferingCode)',
        'offers[0].associatedOfferingCode',
        'offers[2].associatedOfferingCode',
      ),
    ).toBe('$toString($.offers[2].associatedOfferingCode)');

    expect(
      projectPatternExpression(
        '$trim($.offers.[0].associatedOfferingCode)',
        '$.offers.[0].associatedOfferingCode',
        'offers[1].associatedOfferingCode',
      ),
    ).toBe('$trim($.offers[1].associatedOfferingCode)');
  });

  it('returns null when anchor has no array indices on source or target', () => {
    const noIndices: Mapping = {
      id: 'a1',
      sourcePath: 'offers[0].code',
      sourceId: 's1',
      targetPath: 'flat.code',
    };
    expect(
      buildPatternPropagationPreview(noIndices, [noIndices], ['offers[0].code'], ['flat.code'], 's1'),
    ).toBeNull();

    const missingSourceIndices: Mapping = {
      id: 'a2',
      sourcePath: 'flat.code',
      sourceId: 's1',
      targetPath: 'offers[0].code',
    };
    expect(
      buildPatternPropagationPreview(
        missingSourceIndices,
        [missingSourceIndices],
        ['flat.code'],
        ['offers[0].code'],
        's1',
      ),
    ).toBeNull();
  });

  it('returns null when no target leaves match the anchor wildcard pattern', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'offers[0].associatedOfferingCode',
      sourceId: 's1',
      targetPath: 'offers[0].associatedOfferingCode',
    };
    expect(
      buildPatternPropagationPreview(
        anchor,
        [anchor],
        ['offers[0].associatedOfferingCode'],
        ['other[0].associatedOfferingCode'],
        's1',
      ),
    ).toBeNull();
  });

  it('skips target leaves whose bracket index count does not match the anchor template', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'items[0].nested[0].leaf',
      sourceId: 's1',
      targetPath: 'items[0].nested[0].leaf',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor],
      ['items[0].nested[0].leaf', 'items[1].nested.leaf'],
      ['items[0].nested[0].leaf', 'items[1].nested.leaf'],
      's1',
    );
    expect(preview).toBeTruthy();
    if (!preview) return;
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].targetPath).toBe('items[0].nested[0].leaf');
  });

  it('propagates templates with multiple independent index slots', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'items[0].nested[0].leaf',
      sourceId: 's1',
      targetPath: 'items[0].nested[0].leaf',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor],
      ['items[0].nested[0].leaf', 'items[1].nested[2].leaf'],
      ['items[0].nested[0].leaf', 'items[1].nested[2].leaf'],
      's1',
    );
    expect(preview).toBeTruthy();
    if (!preview) return;
    const byTarget = new Map(preview.rows.map((r) => [r.targetPath, r.sourcePath]));
    expect(byTarget.get('items[1].nested[2].leaf')).toBe('items[1].nested[2].leaf');
  });

  it('marks rows unchanged when existing mapping matches source, sourceId, and expression', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'offers[0].code',
      sourceId: 's1',
      targetPath: 'offers[0].code',
      expression: '$trim($.offers[0].code)',
    };
    const twin: Mapping = {
      id: 'twin',
      sourcePath: 'offers[1].code',
      sourceId: 's1',
      targetPath: 'offers[1].code',
      expression: '$trim($.offers[1].code)',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor, twin],
      ['offers[0].code', 'offers[1].code'],
      ['offers[0].code', 'offers[1].code'],
      's1',
    );
    expect(preview?.unchangedCount).toBe(2);
    expect(preview?.rows.every((r) => r.action === 'unchanged')).toBe(true);
  });

  it('marks rows update when projected expression differs from existing mapping', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'offers[0].code',
      sourceId: 's1',
      targetPath: 'offers[0].code',
      expression: '$trim($.offers[0].code)',
    };
    const stale: Mapping = {
      id: 'stale',
      sourcePath: 'offers[1].code',
      sourceId: 's1',
      targetPath: 'offers[1].code',
      expression: '$upper($.offers[1].code)',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor, stale],
      ['offers[0].code', 'offers[1].code'],
      ['offers[0].code', 'offers[1].code'],
      's1',
    );
    expect(preview?.updatedCount).toBe(1);
    expect(preview?.unchangedCount).toBe(1);
    const updated = preview?.rows.find((r) => r.targetPath === 'offers[1].code');
    expect(updated?.action).toBe('update');
    expect(updated?.projectedExpression).toBe('$trim($.offers[1].code)');
  });

  it('marks rows update when existing mapping uses a different source id than the anchor', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'offers[0].code',
      sourceId: 's1',
      targetPath: 'offers[0].code',
    };
    const otherSource: Mapping = {
      id: 'other',
      sourcePath: 'offers[1].code',
      sourceId: 's2',
      targetPath: 'offers[1].code',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor, otherSource],
      ['offers[0].code', 'offers[1].code'],
      ['offers[0].code', 'offers[1].code'],
      's1',
    );
    expect(preview?.updatedCount).toBe(1);
    expect(preview?.rows.find((r) => r.targetPath === 'offers[1].code')?.action).toBe('update');
  });

  it('projectPatternExpression returns undefined for undefined and null-like expressions', () => {
    expect(projectPatternExpression(undefined, 'a[0].x', 'a[1].x')).toBeUndefined();
    expect(projectPatternExpression(null as unknown as undefined, 'a[0].x', 'a[1].x')).toBeNull();
  });

  it('projectPatternExpression replaces $.-prefixed anchor paths in expressions', () => {
    expect(
      projectPatternExpression(
        'concat($.items[0].id, $.suffix)',
        '$.items.[0].id',
        'items[2].id',
      ),
    ).toBe('concat($.items[2].id, $.suffix)');
  });

  it('marks propagated targets as new when no mapping exists yet for that target path', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'rows[0].id',
      sourceId: 's1',
      targetPath: 'rows[0].id',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor],
      ['rows[0].id', 'rows[1].id'],
      ['rows[0].id', 'rows[1].id'],
      's1',
    );
    expect(preview?.insertedCount).toBe(1);
    expect(preview?.rows.find((r) => r.targetPath === 'rows[1].id')?.action).toBe('new');
  });

  it('falls back to activeSourceId when anchor mapping omits sourceId', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'rows[0].id',
      targetPath: 'rows[0].id',
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor],
      ['rows[0].id'],
      ['rows[0].id'],
      'fallback-src',
    );
    expect(preview?.sourceId).toBe('fallback-src');
  });

  it('treats missing and undefined expressions as equivalent when comparing mappings', () => {
    const anchor: Mapping = {
      id: 'anchor',
      sourcePath: 'rows[0].id',
      sourceId: 's1',
      targetPath: 'rows[0].id',
    };
    const twin: Mapping = {
      id: 'twin',
      sourcePath: 'rows[1].id',
      sourceId: 's1',
      targetPath: 'rows[1].id',
      expression: undefined,
    };
    const preview = buildPatternPropagationPreview(
      anchor,
      [anchor, twin],
      ['rows[0].id', 'rows[1].id'],
      ['rows[0].id', 'rows[1].id'],
      's1',
    );
    expect(preview?.rows.find((r) => r.targetPath === 'rows[1].id')?.action).toBe('unchanged');
  });
});
