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
});
