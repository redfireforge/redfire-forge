import { describe, it, expect } from 'vitest';
import { toNumber, stringify, evaluateFieldOperator } from './fieldOperatorEvaluation';

describe('fieldOperatorEvaluation helpers', () => {
  it('toNumber handles numbers, numeric strings, blanks, NaN, and non-coercible types', () => {
    expect(toNumber(3.5)).toBe(3.5);
    expect(toNumber(' 42 ')).toBe(42);
    expect(toNumber('')).toBeNull();
    expect(toNumber('   ')).toBeNull();
    expect(toNumber('x')).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber({})).toBeNull();
    expect(toNumber([])).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(Infinity)).toBe(Infinity);
  });

  it('stringify maps undefined, strings, null, primitives, and nested values', () => {
    expect(stringify(undefined)).toBe('undefined');
    expect(stringify('plain')).toBe('plain');
    expect(stringify({ a: 1 })).toBe('{"a":1}');
    expect(stringify(null)).toBe('null');
    expect(stringify(0)).toBe('0');
    expect(stringify([1, 'x'])).toBe('[1,"x"]');
    expect(stringify(Symbol.for('s'))).toBe('Symbol(s)');
  });

  it('stringify falls back for values JSON.stringify cannot serialize to a string', () => {
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('no');
        },
      },
    );
    expect(stringify(proxy)).toBe('[object Object]');

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(stringify(circular)).toBe('[object Object]');

    expect(() => JSON.stringify(1n)).toThrow();
    expect(stringify(BigInt(99))).toBe('99');
  });

  it('evaluateFieldOperator equals falls back when expectedValue is not valid JSON', () => {
    const r = evaluateFieldOperator('hello', 'equals', undefined, 'not-json');
    expect(r.pass).toBe(false);
  });

  it('evaluateFieldOperator equals uses JSON-parse path when expected is JSON', () => {
    expect(evaluateFieldOperator(42, 'equals', undefined, '42').pass).toBe(true);
    expect(
      evaluateFieldOperator({ x: 1 }, 'equals', undefined, '{"x":1}').pass,
    ).toBe(true);
  });

  it('evaluateFieldOperator equals uses nullish fallback when inner stringify of undefined yields undefined', () => {
    const r = evaluateFieldOperator(undefined, 'equals', undefined, 'null');
    expect(r.actual).toBe('undefined');
    expect(r.pass).toBe(false);
  });

  it('evaluateFieldOperator equals stringifies actual with String fallback on circular refs', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const r = evaluateFieldOperator(circular, 'equals', undefined, '{}');
    expect(r.pass).toBe(false);
    expect(r.actual).toBe('[object Object]');
  });

  it('evaluateFieldOperator not_equals uses stringify fallbacks parallel to equals', () => {
    expect(evaluateFieldOperator(1, 'not_equals', undefined, '2').pass).toBe(true);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const cir = evaluateFieldOperator(circular, 'not_equals', undefined, '{"x":1}');
    expect(cir.actual).toBe('[object Object]');
    expect(cir.pass).toBe(true);

    expect(evaluateFieldOperator('same', 'not_equals', undefined, 'same').pass).toBe(false);
  });

  it('evaluateFieldOperator not_equals nullish-coalesces inner actual like equals', () => {
    const r = evaluateFieldOperator(undefined, 'not_equals', undefined, 'null');
    expect(r.actual).toBe('undefined');
    expect(r.pass).toBe(true);
  });

  it('comparison operators prefer operatorValue and fail on non-numeric operands', () => {
    expect(evaluateFieldOperator(5, 'greater_than', '3', '999').pass).toBe(true);
    expect(evaluateFieldOperator(8, 'greater_than_or_equal', '8', '0').pass).toBe(true);
    expect(evaluateFieldOperator(2, 'greater_than', undefined, '10').pass).toBe(false);
    expect(evaluateFieldOperator(2, 'greater_than', undefined, '5').pass).toBe(false);
    expect(evaluateFieldOperator('nope', 'greater_than', undefined, '1').pass).toBe(false);
    expect(evaluateFieldOperator(1, 'greater_than', undefined, 'z').pass).toBe(false);

    expect(evaluateFieldOperator(3, 'greater_than_or_equal', '3', '0').pass).toBe(true);
    expect(evaluateFieldOperator(2, 'greater_than_or_equal', '4', '').pass).toBe(false);

    expect(evaluateFieldOperator(4, 'less_than_or_equal', '5', '').pass).toBe(true);
    expect(evaluateFieldOperator(1, 'less_than', undefined, '5').pass).toBe(true);
    expect(evaluateFieldOperator(9, 'less_than', '2', '').pass).toBe(false);
    expect(evaluateFieldOperator(5, 'less_than', undefined, '2').pass).toBe(false);

    expect(evaluateFieldOperator(4, 'less_than_or_equal', '4', '').pass).toBe(true);
    expect(evaluateFieldOperator(5, 'less_than_or_equal', '3', '').pass).toBe(false);
    expect(evaluateFieldOperator(Number.NaN, 'less_than_or_equal', '', '10').pass).toBe(false);
  });

  it('toNumber distinguishes blank strings from Infinity numerals', () => {
    expect(toNumber('Infinity')).toBe(Infinity);
    expect(toNumber('-Infinity')).toBe(-Infinity);
  });

  it('evaluateFieldOperator in / not_in cover empty raw and sparse JSON.stringify(undefined) lookups', () => {
    expect(evaluateFieldOperator(1, 'in', '', '').pass).toBe(false);
    expect(evaluateFieldOperator(undefined, 'not_in', '[1]', '').pass).toBe(true);
  });

  it('evaluateFieldOperator contains / not_contains stringify non-string actual', () => {
    expect(evaluateFieldOperator({ a: 1 }, 'contains', undefined, '"a"').pass).toBe(true);
    expect(evaluateFieldOperator('alpha', 'contains', undefined, 'ph').pass).toBe(true);
    expect(evaluateFieldOperator('alpha', 'not_contains', undefined, 'z').pass).toBe(true);
    expect(evaluateFieldOperator({ b: 2 }, 'not_contains', undefined, '"z"').pass).toBe(true);

    /* JSON.stringify returns undefined for functions — exercises `?? ""` fallback */
    const fn = (): number => 1;
    expect(evaluateFieldOperator(fn, 'contains', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(fn, 'not_contains', undefined, 'x').pass).toBe(true);
  });

  it('evaluateFieldOperator starts_with and ends_with cover string vs JSON branches', () => {
    expect(evaluateFieldOperator('foobar', 'starts_with', undefined, 'foo').pass).toBe(true);
    expect(evaluateFieldOperator(['x'], 'starts_with', undefined, '[').pass).toBe(true);
    expect(evaluateFieldOperator('foobar', 'ends_with', undefined, 'bar').pass).toBe(true);
    expect(evaluateFieldOperator([1, 2], 'ends_with', undefined, '2]').pass).toBe(true);

    const fn = (): boolean => false;
    expect(evaluateFieldOperator(fn, 'starts_with', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(fn, 'ends_with', undefined, '').pass).toBe(true);
  });

  it('evaluateFieldOperator regex accepts valid patterns and uses JSON for non-string actual', () => {
    expect(evaluateFieldOperator('abc123', 'regex', '^[a-z]+\\d+$', '').pass).toBe(true);
    expect(evaluateFieldOperator(404, 'regex', '^\\d+$', '').pass).toBe(true);

    const fn = (): void => {};
    expect(evaluateFieldOperator(fn, 'regex', '^$', '').pass).toBe(true);
  });

  it('evaluateFieldOperator regex rejects empty pattern', () => {
    const r = evaluateFieldOperator('abc', 'regex', '', '');
    expect(r.pass).toBe(false);
    expect(r.expected).toContain('non-empty');
  });

  it('evaluateFieldOperator regex catches invalid patterns', () => {
    const r = evaluateFieldOperator('abc', 'regex', '[broken', '');
    expect(r.pass).toBe(false);
    expect(r.actual).toContain('invalid');
  });

  it('evaluateFieldOperator boolean and null checks cover string and primitive branches', () => {
    expect(evaluateFieldOperator(true, 'is_true', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator('true', 'is_true', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(false, 'is_true', undefined, '').pass).toBe(false);

    expect(evaluateFieldOperator(false, 'is_false', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator('false', 'is_false', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(true, 'is_false', undefined, '').pass).toBe(false);

    expect(evaluateFieldOperator(null, 'is_null', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(undefined, 'is_not_null', undefined, '').pass).toBe(false);
    expect(evaluateFieldOperator(0, 'is_not_null', undefined, '').pass).toBe(true);
  });

  it('evaluateFieldOperator is_empty and is_not_empty cover object, array, and scalar branches', () => {
    expect(evaluateFieldOperator('', 'is_empty', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator([], 'is_empty', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator({}, 'is_empty', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator([0], 'is_empty', undefined, '').pass).toBe(false);

    expect(evaluateFieldOperator('x', 'is_not_empty', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator({}, 'is_not_empty', undefined, '').pass).toBe(false);
    expect(evaluateFieldOperator(null, 'is_not_empty', undefined, '').pass).toBe(false);
  });

  it('evaluateFieldOperator exists and not_exists', () => {
    expect(evaluateFieldOperator(0, 'exists', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(undefined, 'exists', undefined, '').pass).toBe(false);
    expect(evaluateFieldOperator(undefined, 'not_exists', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(null, 'not_exists', undefined, '').pass).toBe(false);
  });

  it('evaluateFieldOperator is_type matches each JSON typeof branch and operatorValue', () => {
    expect(evaluateFieldOperator(null, 'is_type', 'null', 'object').pass).toBe(true);
    expect(evaluateFieldOperator([], 'is_type', 'array', 'object').pass).toBe(true);
    expect(evaluateFieldOperator('hi', 'is_type', 'string', '').pass).toBe(true);
    expect(evaluateFieldOperator(3, 'is_type', 'number', '').pass).toBe(true);
    expect(evaluateFieldOperator(false, 'is_type', 'boolean', '').pass).toBe(true);
    expect(evaluateFieldOperator(undefined, 'is_type', 'undefined', '').pass).toBe(true);
    expect(evaluateFieldOperator({ a: 1 }, 'is_type', 'object', '').pass).toBe(true);
    expect(evaluateFieldOperator(1, 'is_type', 'string', '').pass).toBe(false);
    expect(evaluateFieldOperator(1, 'is_type', undefined, 'NUMBER').pass).toBe(true);
    expect(evaluateFieldOperator(1, 'is_type', '', '').pass).toBe(false);
  });

  it('evaluateFieldOperator in / not_in cover JSON array, non-array parse, and CSV fallback', () => {
    expect(evaluateFieldOperator(2, 'in', undefined, '[1,2,3]').pass).toBe(true);
    expect(evaluateFieldOperator(2, 'in', undefined, '[1,3]').pass).toBe(false);

    expect(evaluateFieldOperator('x', 'in', undefined, '"not-array"').pass).toBe(false);

    expect(evaluateFieldOperator('b', 'in', undefined, 'a, b, c').pass).toBe(true);

    expect(evaluateFieldOperator(9, 'not_in', undefined, '[1,2]').pass).toBe(true);
    expect(evaluateFieldOperator(1, 'not_in', undefined, '[1]').pass).toBe(false);
    expect(evaluateFieldOperator('z', 'not_in', undefined, 'a,b').pass).toBe(true);

    expect(evaluateFieldOperator('x', 'in', undefined, 'x,{bad-json').pass).toBe(true);
    expect(evaluateFieldOperator('a', 'not_in', undefined, 'a,{bad-json').pass).toBe(false);
    expect(evaluateFieldOperator(2, 'in', '[1,2]', '99').pass).toBe(true);
  });

  it('handles empty-string operatorValue (nullish coalescing favors empty string operand)', () => {
    expect(evaluateFieldOperator(5, 'greater_than', '', '3').pass).toBe(false);
    expect(evaluateFieldOperator('x', 'between', '', '1,10').pass).toBe(false);
    expect(evaluateFieldOperator('ab', 'starts_with', '', '').pass).toBe(true);

    expect(evaluateFieldOperator(5, 'between', '', '1,10').pass).toBe(false);
    expect(evaluateFieldOperator(3, 'close_to', '', '3').pass).toBe(false);
    expect(evaluateFieldOperator(undefined, 'in', '', '[1,2]').pass).toBe(false);
  });

  it('evaluateFieldOperator close_to with explicit trailing comma yields zero tolerance', () => {
    expect(evaluateFieldOperator(3, 'close_to', '3,', '').pass).toBe(true);
    expect(evaluateFieldOperator(3.001, 'close_to', '3,', '').pass).toBe(false);
  });

  it('evaluateFieldOperator in / not_in parse plain objects via CSV split fallback', () => {
    expect(evaluateFieldOperator('z', 'in', '{}', '[9]').pass).toBe(false);
    expect(evaluateFieldOperator(9, 'not_in', '{}', '[9]').pass).toBe(true);
  });

  it('evaluateFieldOperator between validates bounds and numeric actual', () => {
    expect(evaluateFieldOperator(5, 'between', undefined, '1, 10').pass).toBe(true);
    expect(evaluateFieldOperator(5, 'between', '1,10', '0, 0').pass).toBe(true);
    expect(evaluateFieldOperator(0, 'between', undefined, '1, 10').pass).toBe(false);
    expect(evaluateFieldOperator(11, 'between', undefined, '1, 10').pass).toBe(false);
    expect(evaluateFieldOperator('n', 'between', undefined, '1, 10').pass).toBe(false);
    expect(evaluateFieldOperator(1, 'between', undefined, 'x, y').pass).toBe(false);
  });

  it('evaluateFieldOperator close_to uses explicit tolerance and handles invalid target', () => {
    expect(evaluateFieldOperator(3.004, 'close_to', '3', '').pass).toBe(true);
    expect(evaluateFieldOperator(3.004, 'close_to', '3', '9, 9').pass).toBe(true);
    expect(evaluateFieldOperator(3.02, 'close_to', '3', '').pass).toBe(false);

    expect(evaluateFieldOperator(3.4, 'close_to', '3, 0.5', '').pass).toBe(true);
    expect(evaluateFieldOperator(4, 'close_to', '3, 0.5', '').pass).toBe(false);

    expect(evaluateFieldOperator(1, 'close_to', 'bad', '').pass).toBe(false);
    expect(evaluateFieldOperator('x', 'close_to', '1, 0.1', '').pass).toBe(false);
    expect(evaluateFieldOperator(3, 'close_to', '3,badtol', '').pass).toBe(false);
  });

  it('evaluateFieldOperator unknown operator hits default branch', () => {
    const r = evaluateFieldOperator('x', 'unknown_operator' as never, '', '');
    expect(r.pass).toBe(false);
    expect(r.actual).toContain('unknown');
  });
});
