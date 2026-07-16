import { describe, expect, it } from 'vitest';
import type { FailureDetail } from '../shared/types';
import { deepCompare } from './deepCompare';

describe('deepCompare', () => {
  it('does nothing when values are strictly equal', () => {
    const failures: FailureDetail[] = [];
    deepCompare('same', 'same', '', failures);
    expect(failures).toEqual([]);
  });

  it('records a root mismatch for null/type differences', () => {
    const failures: FailureDetail[] = [];
    deepCompare(null, { ok: true }, '', failures);
    expect(failures).toEqual([
      {
        path: '(root)',
        expected: 'null',
        actual: '{"ok":true}',
      },
    ]);
  });

  it('records an array-vs-non-array mismatch', () => {
    const failures: FailureDetail[] = [];
    deepCompare(['a'], 'a', 'payload.items', failures);
    expect(failures).toEqual([
      {
        path: 'payload.items',
        expected: '["a"]',
        actual: '"a"',
      },
    ]);
  });

  it('recurses through arrays and objects using nested paths', () => {
    const failures: FailureDetail[] = [];
    deepCompare(
      {
        meta: { status: 'ok' },
        items: [{ id: 1, name: 'first' }, { id: 2 }],
      },
      {
        meta: { status: 'bad' },
        items: [{ id: 1, name: 'first' }, { id: 3, extra: true }],
      },
      '',
      failures,
    );

    expect(failures).toEqual([
      {
        path: 'meta.status',
        expected: '"ok"',
        actual: '"bad"',
      },
      {
        path: 'items[1].id',
        expected: '2',
        actual: '3',
      },
      {
        path: 'items[1].extra',
        expected: undefined,
        actual: 'true',
      },
    ]);
  });
});