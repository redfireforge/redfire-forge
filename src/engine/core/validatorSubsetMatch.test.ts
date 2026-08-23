import { describe, it, expect } from 'vitest';
import { deepSubsetMatch } from './validatorSubsetMatch';

describe('deepSubsetMatch', () => {
  it('matches top-level null expected and actual', () => {
    expect(deepSubsetMatch(null, null).match).toBe(true);
  });

  it('fails top-level null expected when actual is non-null', () => {
    const r = deepSubsetMatch({ x: 1 }, null);
    expect(r.match).toBe(false);
    expect(r.path).toBe('(root)');
    expect(r.expected).toBe('null');
  });

  it('fails when expected array but actual is not an array', () => {
    const r = deepSubsetMatch({ not: 'array' }, [1]);
    expect(r.match).toBe(false);
    expect(r.expected).toBe('array');
    expect(r.actual).toBe('object');
  });

  it('reports array index path when expected element missing', () => {
    const r = deepSubsetMatch([{ a: 1 }], [{ b: 2 }]);
    expect(r.match).toBe(false);
    expect(r.path).toBe('[0]');
  });

  it('fails object expected when actual is null', () => {
    const r = deepSubsetMatch(null, { k: 1 });
    expect(r.match).toBe(false);
    expect(r.expected).toBe('object');
    expect(r.actual).toBe('null');
  });

  it('fails object expected when actual is array of non-matching items', () => {
    const r = deepSubsetMatch([1, 2], { k: 1 });
    expect(r.match).toBe(false);
    expect(r.actual).toBe('no matching element in array');
  });

  it('passes object expected when array has a matching element', () => {
    const r = deepSubsetMatch(
      [{ k: 1, extra: 'a' }, { k: 2 }],
      { k: 1 },
    );
    expect(r.match).toBe(true);
  });

  it('fails object expected when no array element has matching subset', () => {
    const r = deepSubsetMatch(
      [{ k: 2 }, { k: 3 }],
      { k: 1 },
    );
    expect(r.match).toBe(false);
  });

  it('fails object expected when actual is primitive', () => {
    const r = deepSubsetMatch('str', { k: 1 });
    expect(r.match).toBe(false);
    expect(r.actual).toBe('string');
  });

  it('uses nested path when nested object key missing', () => {
    const r = deepSubsetMatch({ outer: { a: 1 } }, { outer: { a: 1, b: 2 } });
    expect(r.match).toBe(false);
    expect(r.path).toBe('outer.b');
    expect(r.actual).toBe('missing key');
  });

  it('propagates mismatch from nested deepSubsetMatch', () => {
    const r = deepSubsetMatch({ outer: { inner: { x: 1 } } }, { outer: { inner: { x: 2 } } });
    expect(r.match).toBe(false);
    expect(r.path).toBe('outer.inner.x');
  });

  it('matches when expected array is fully satisfied', () => {
    expect(deepSubsetMatch([1, 2, 3], [2, 1]).match).toBe(true);
  });

  it('matches when expected object keys are satisfied', () => {
    expect(deepSubsetMatch({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }).match).toBe(true);
  });

  it('uses bare key path at root for missing property', () => {
    const r = deepSubsetMatch({}, { missing: true });
    expect(r.match).toBe(false);
    expect(r.path).toBe('missing');
  });

  it('defaults path to (root) on primitive mismatch at root', () => {
    const r = deepSubsetMatch(2, 3);
    expect(r.match).toBe(false);
    expect(r.path).toBe('(root)');
  });
});
