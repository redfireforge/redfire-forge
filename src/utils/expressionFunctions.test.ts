import { describe, it, expect } from 'vitest';
import {
  EXPRESSION_FUNCTIONS,
  EXPRESSION_FUNCTION_MAP,
  EXPRESSION_CATEGORIES,
  groupedExpressionFunctions,
} from './expressionFunctions';

describe('expressionFunctions', () => {
  // ── Registry structure ──

  it('has at least 55 functions', () => {
    expect(EXPRESSION_FUNCTIONS.length).toBeGreaterThanOrEqual(55);
  });

  it('every function has required metadata', () => {
    for (const fn of EXPRESSION_FUNCTIONS) {
      expect(fn.name).toBeTruthy();
      expect(fn.name.startsWith('$')).toBe(true);
      expect(fn.category).toBeTruthy();
      expect(fn.signature).toBeTruthy();
      expect(fn.description).toBeTruthy();
      expect(fn.returnType).toBeTruthy();
      expect(fn.examples.length).toBeGreaterThan(0);
      expect(typeof fn.evaluate).toBe('function');
    }
  });

  it('EXPRESSION_FUNCTION_MAP contains all functions by name', () => {
    for (const fn of EXPRESSION_FUNCTIONS) {
      expect(EXPRESSION_FUNCTION_MAP.get(fn.name)).toBe(fn);
    }
  });

  it('EXPRESSION_CATEGORIES has expected categories', () => {
    expect(EXPRESSION_CATEGORIES).toContain('String');
    expect(EXPRESSION_CATEGORIES).toContain('Math');
    expect(EXPRESSION_CATEGORIES).toContain('Conditional');
    expect(EXPRESSION_CATEGORIES).toContain('JSON');
    expect(EXPRESSION_CATEGORIES).toContain('Date/Time');
    expect(EXPRESSION_CATEGORIES).toContain('Encoding');
  });

  it('groupedExpressionFunctions groups functions by category', () => {
    const groups = groupedExpressionFunctions();
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.category).toBeTruthy();
      expect(g.functions.length).toBeGreaterThan(0);
      for (const fn of g.functions) {
        expect(fn.category).toBe(g.category);
      }
    }
  });

  it('no duplicate function names', () => {
    const names = EXPRESSION_FUNCTIONS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  // ── String functions ──

  describe('String functions', () => {
    it('$upper converts to uppercase', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$upper')!.evaluate('hello')).toBe('HELLO');
    });
    it('$upper handles null', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$upper')!.evaluate(null)).toBe('');
    });
    it('$lower converts to lowercase', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$lower')!.evaluate('HELLO')).toBe('hello');
    });
    it('$trim removes whitespace', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$trim')!.evaluate('  hi  ')).toBe('hi');
    });
    it('$length returns string length', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$length')!.evaluate('hello')).toBe(5);
    });
    it('$length returns array length', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$length')!.evaluate([1, 2, 3])).toBe(3);
    });
    it('$concat joins multiple values', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$concat')!.evaluate('a', 'b', 'c')).toBe('abc');
    });
    it('$substring extracts substring', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$substring')!.evaluate('hello', 1, 3)).toBe('ell');
    });
    it('$substring without length', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$substring')!.evaluate('hello', 2)).toBe('llo');
    });
    it('$replace replaces all occurrences', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$replace')!.evaluate('aaa', 'a', 'b')).toBe('bbb');
    });
    it('$split splits by delimiter', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$split')!.evaluate('a,b,c', ',')).toEqual(['a', 'b', 'c']);
    });
    it('$join joins array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$join')!.evaluate(['a', 'b'], '-')).toBe('a-b');
    });
    it('$join wraps non-array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$join')!.evaluate('solo', ',')).toBe('solo');
    });
  });

  // ── Math functions ──

  describe('Math functions', () => {
    it('$add', () => expect(EXPRESSION_FUNCTION_MAP.get('$add')!.evaluate(10, 5)).toBe(15));
    it('$subtract', () => expect(EXPRESSION_FUNCTION_MAP.get('$subtract')!.evaluate(10, 3)).toBe(7));
    it('$multiply', () => expect(EXPRESSION_FUNCTION_MAP.get('$multiply')!.evaluate(4, 3)).toBe(12));
    it('$divide', () => expect(EXPRESSION_FUNCTION_MAP.get('$divide')!.evaluate(10, 2)).toBe(5));
    it('$divide by zero returns 0', () => expect(EXPRESSION_FUNCTION_MAP.get('$divide')!.evaluate(10, 0)).toBe(0));
    it('$round with decimals', () => expect(EXPRESSION_FUNCTION_MAP.get('$round')!.evaluate(3.14159, 2)).toBe(3.14));
    it('$round without decimals', () => expect(EXPRESSION_FUNCTION_MAP.get('$round')!.evaluate(3.7)).toBe(4));
    it('$abs', () => expect(EXPRESSION_FUNCTION_MAP.get('$abs')!.evaluate(-5)).toBe(5));
    it('$min', () => expect(EXPRESSION_FUNCTION_MAP.get('$min')!.evaluate(3, 7)).toBe(3));
    it('$max', () => expect(EXPRESSION_FUNCTION_MAP.get('$max')!.evaluate(3, 7)).toBe(7));
    it('$add handles string args', () => expect(EXPRESSION_FUNCTION_MAP.get('$add')!.evaluate('10', '5')).toBe(15));
  });

  // ── Conditional functions ──

  describe('Conditional functions', () => {
    it('$default returns value when non-empty', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$default')!.evaluate('hello', 'fallback')).toBe('hello');
    });
    it('$default returns fallback when empty', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$default')!.evaluate('', 'N/A')).toBe('N/A');
    });
    it('$default returns fallback when null', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$default')!.evaluate(null, 'N/A')).toBe('N/A');
    });
    it('$if returns then when truthy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$if')!.evaluate('yes', 'A', 'B')).toBe('A');
    });
    it('$if returns else when falsy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$if')!.evaluate('', 'A', 'B')).toBe('B');
    });
    it('$if treats "false" as falsy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$if')!.evaluate('false', 'A', 'B')).toBe('B');
    });
    it('$if treats "0" as falsy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$if')!.evaluate('0', 'A', 'B')).toBe('B');
    });
    it('$isEmpty returns true for empty string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$isEmpty')!.evaluate('')).toBe(true);
    });
    it('$isEmpty returns false for non-empty', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$isEmpty')!.evaluate('hi')).toBe(false);
    });
    it('$isEmpty returns true for null', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$isEmpty')!.evaluate(null)).toBe(true);
    });
    it('$isEmpty returns true for empty array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$isEmpty')!.evaluate([])).toBe(true);
    });
    it('$contains returns true when found', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$contains')!.evaluate('hello world', 'world')).toBe(true);
    });
    it('$contains returns false when not found', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$contains')!.evaluate('hello', 'xyz')).toBe(false);
    });
    it('$matches returns true for matching regex', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$matches')!.evaluate('abc123', '^[a-z]+\\d+$')).toBe(true);
    });
    it('$matches returns false for invalid regex', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$matches')!.evaluate('abc', '[')).toBe(false);
    });
  });

  // ── JSON functions ──

  describe('JSON functions', () => {
    it('$parse parses valid JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$parse')!.evaluate('{"a":1}')).toEqual({ a: 1 });
    });
    it('$parse returns null for invalid JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$parse')!.evaluate('not json')).toBe(null);
    });
    it('$stringify serializes object', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$stringify')!.evaluate({ a: 1 })).toBe('{"a":1}');
    });
    it('$keys returns keys from object', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$keys')!.evaluate({ a: 1, b: 2 })).toEqual(['a', 'b']);
    });
    it('$keys returns keys from JSON string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$keys')!.evaluate('{"x":1,"y":2}')).toEqual(['x', 'y']);
    });
    it('$keys returns [] for non-object', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$keys')!.evaluate('not json')).toEqual([]);
    });
    it('$values returns values from object', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$values')!.evaluate({ a: 1, b: 2 })).toEqual([1, 2]);
    });
    it('$count returns array length', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$count')!.evaluate([1, 2, 3])).toBe(3);
    });
    it('$count returns length from JSON array string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$count')!.evaluate('[1,2]')).toBe(2);
    });
    it('$flatten flattens one level', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$flatten')!.evaluate([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
    });
    it('$jsonpath navigates dot path', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$jsonpath')!.evaluate({ a: { b: 42 } }, 'a.b')).toBe(42);
    });
    it('$jsonpath works with JSON string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$jsonpath')!.evaluate('{"a":{"b":1}}', 'a.b')).toBe(1);
    });
    it('$jsonpath returns null for missing path', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$jsonpath')!.evaluate({ a: 1 }, 'x.y')).toBe(null);
    });
  });

  // ── Date/Time functions ──

  describe('Date/Time functions', () => {
    it('$now returns ISO string', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$now')!.evaluate() as string;
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
    it('$toIso converts date string', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$toIso')!.evaluate('2024-01-15') as string;
      expect(result).toContain('2024-01-15');
    });
    it('$toIso converts timestamp', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$toIso')!.evaluate(0) as string;
      expect(result).toBe('1970-01-01T00:00:00.000Z');
    });
    it('$formatDate with default format', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$formatDate')!.evaluate('2024-01-15T10:30:00Z');
      expect(result).toBe('2024-01-15');
    });
    it('$formatDate with custom format', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$formatDate')!.evaluate('2024-01-15T10:30:00Z', 'YYYY/MM/DD');
      expect(result).toBe('2024/01/15');
    });
    it('$formatDate returns empty for invalid date', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$formatDate')!.evaluate('not-a-date')).toBe('');
    });
    it('$diffMs returns milliseconds difference', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$diffMs')!.evaluate('2024-01-16T00:00:00Z', '2024-01-15T00:00:00Z');
      expect(result).toBe(86400000);
    });
    it('$addDays adds days', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$addDays')!.evaluate('2024-01-15T00:00:00Z', 7) as string;
      expect(result).toContain('2024-01-22');
    });
  });

  // ── Encoding functions ──

  describe('Encoding functions', () => {
    it('$base64 encodes', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$base64')!.evaluate('hello')).toBe('aGVsbG8=');
    });
    it('$base64Decode decodes', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$base64Decode')!.evaluate('aGVsbG8=')).toBe('hello');
    });
    it('$base64Decode returns empty for invalid', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$base64Decode')!.evaluate('!!!')).toBe('');
    });
    it('$urlEncode encodes', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$urlEncode')!.evaluate('hello world')).toBe('hello%20world');
    });
    it('$urlDecode decodes', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$urlDecode')!.evaluate('hello%20world')).toBe('hello world');
    });
    it('$urlDecode returns original for invalid', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$urlDecode')!.evaluate('%ZZ')).toBe('%ZZ');
    });
    it('$hash returns hex string', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$hash')!.evaluate('hello');
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThan(0);
    });
    it('$hash is deterministic', () => {
      const a = EXPRESSION_FUNCTION_MAP.get('$hash')!.evaluate('test');
      const b = EXPRESSION_FUNCTION_MAP.get('$hash')!.evaluate('test');
      expect(a).toBe(b);
    });
    it('$hash differs for different inputs', () => {
      const a = EXPRESSION_FUNCTION_MAP.get('$hash')!.evaluate('hello');
      const b = EXPRESSION_FUNCTION_MAP.get('$hash')!.evaluate('world');
      expect(a).not.toBe(b);
    });
  });

  // ── New String functions ──
  describe('new String functions', () => {
    it('$startsWith returns true for matching prefix', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$startsWith')!.evaluate('hello world', 'hello')).toBe(true);
    });
    it('$startsWith returns false for non-matching', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$startsWith')!.evaluate('hello', 'world')).toBe(false);
    });
    it('$endsWith returns true for matching suffix', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$endsWith')!.evaluate('hello world', 'world')).toBe(true);
    });
    it('$endsWith returns false for non-matching', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$endsWith')!.evaluate('hello', 'world')).toBe(false);
    });
    it('$padStart pads from start', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$padStart')!.evaluate('42', 5, '0')).toBe('00042');
    });
    it('$padStart uses space by default', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$padStart')!.evaluate('hi', 4)).toBe('  hi');
    });
    it('$padEnd pads from end', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$padEnd')!.evaluate('hi', 5, '.')).toBe('hi...');
    });
    it('$repeat repeats string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$repeat')!.evaluate('ab', 3)).toBe('ababab');
    });
    it('$repeat handles 0', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$repeat')!.evaluate('ab', 0)).toBe('');
    });
    it('$repeat handles negative', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$repeat')!.evaluate('ab', -1)).toBe('');
    });
    it('$indexOf finds substring', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$indexOf')!.evaluate('hello world', 'world')).toBe(6);
    });
    it('$indexOf returns -1 when not found', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$indexOf')!.evaluate('hello', 'xyz')).toBe(-1);
    });
  });

  // ── New Math functions ──
  describe('new Math functions', () => {
    it('$mod returns remainder', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$mod')!.evaluate(10, 3)).toBe(1);
    });
    it('$mod returns 0 for division by zero', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$mod')!.evaluate(10, 0)).toBe(0);
    });
    it('$floor rounds down', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$floor')!.evaluate(3.7)).toBe(3);
    });
    it('$floor rounds negative down', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$floor')!.evaluate(-1.2)).toBe(-2);
    });
    it('$ceil rounds up', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$ceil')!.evaluate(3.2)).toBe(4);
    });
    it('$ceil rounds negative up', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$ceil')!.evaluate(-1.8)).toBe(-1);
    });
    it('$power computes exponentiation', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$power')!.evaluate(2, 10)).toBe(1024);
    });
    it('$power handles 0 exponent', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$power')!.evaluate(5, 0)).toBe(1);
    });
    it('$random returns number in range', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$random')!.evaluate(1, 10) as number;
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    });
    it('$random returns integer', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$random')!.evaluate(1, 100) as number;
      expect(Number.isInteger(result)).toBe(true);
    });
    it('$random uses default range', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$random')!.evaluate() as number;
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(999999);
    });
  });

  // ── New Conditional functions ──
  describe('new Conditional functions', () => {
    it('$not negates truthy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$not')!.evaluate('hello')).toBe(false);
    });
    it('$not negates falsy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$not')!.evaluate('false')).toBe(true);
    });
    it('$not negates empty string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$not')!.evaluate('')).toBe(true);
    });
    it('$coalesce returns first non-empty', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$coalesce')!.evaluate('', null, 'found')).toBe('found');
    });
    it('$coalesce returns first arg if non-empty', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$coalesce')!.evaluate('first', 'second')).toBe('first');
    });
    it('$coalesce returns last arg if all empty', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$coalesce')!.evaluate('', '')).toBe('');
    });
    it('$equals returns true for equal strings', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$equals')!.evaluate('hello', 'hello')).toBe(true);
    });
    it('$equals returns false for different strings', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$equals')!.evaluate('hello', 'world')).toBe(false);
    });
    it('$equals compares numbers as strings', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$equals')!.evaluate(42, '42')).toBe(true);
    });
  });

  // ── New JSON functions ──
  describe('new JSON functions', () => {
    it('$merge merges two objects', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$merge')!.evaluate('{"a":1}', '{"b":2}')).toEqual({ a: 1, b: 2 });
    });
    it('$merge overrides with second object', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$merge')!.evaluate('{"a":1}', '{"a":2}')).toEqual({ a: 2 });
    });
    it('$merge handles native objects', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$merge')!.evaluate({ x: 1 }, { y: 2 })).toEqual({ x: 1, y: 2 });
    });
    it('$type returns string for string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$type')!.evaluate('hello')).toBe('string');
    });
    it('$type returns number for number', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$type')!.evaluate(42)).toBe('number');
    });
    it('$type returns boolean for boolean', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$type')!.evaluate(true)).toBe('boolean');
    });
    it('$type returns array for array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$type')!.evaluate([1, 2])).toBe('array');
    });
    it('$type returns object for object', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$type')!.evaluate({ a: 1 })).toBe('object');
    });
    it('$type returns null for null', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$type')!.evaluate(null)).toBe('null');
    });
    it('$sort sorts array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$sort')!.evaluate([3, 1, 2])).toEqual([1, 2, 3]);
    });
    it('$sort sorts strings', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$sort')!.evaluate(['c', 'a', 'b'])).toEqual(['a', 'b', 'c']);
    });
    it('$sort handles JSON string input', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$sort')!.evaluate('[3,1,2]')).toEqual([1, 2, 3]);
    });
    it('$reverse reverses array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$reverse')!.evaluate([1, 2, 3])).toEqual([3, 2, 1]);
    });
    it('$reverse handles JSON string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$reverse')!.evaluate('[1,2,3]')).toEqual([3, 2, 1]);
    });
    it('$unique removes duplicates', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$unique')!.evaluate([1, 2, 2, 3, 3])).toEqual([1, 2, 3]);
    });
    it('$unique handles string duplicates', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$unique')!.evaluate(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });
    it('$first returns first element', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$first')!.evaluate([10, 20, 30])).toBe(10);
    });
    it('$first returns first char of string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$first')!.evaluate('hello')).toBe('h');
    });
    it('$first returns null for empty array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$first')!.evaluate([])).toBe(null);
    });
    it('$last returns last element', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$last')!.evaluate([10, 20, 30])).toBe(30);
    });
    it('$last returns last char of string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$last')!.evaluate('hello')).toBe('o');
    });
    it('$slice returns portion of array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$slice')!.evaluate([1, 2, 3, 4, 5], 1, 3)).toEqual([2, 3]);
    });
    it('$slice without end returns rest', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$slice')!.evaluate([1, 2, 3, 4, 5], 2)).toEqual([3, 4, 5]);
    });
    it('$slice handles JSON string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$slice')!.evaluate('[1,2,3,4]', 0, 2)).toEqual([1, 2]);
    });
  });

  // ── New Date/Time functions ──
  describe('new Date/Time functions', () => {
    it('$addHours adds hours', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$addHours')!.evaluate('2024-01-15T10:00:00Z', 3);
      expect(result).toBe('2024-01-15T13:00:00.000Z');
    });
    it('$addHours subtracts negative hours', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$addHours')!.evaluate('2024-01-15T10:00:00Z', -2);
      expect(result).toBe('2024-01-15T08:00:00.000Z');
    });
    it('$timestamp returns a number', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$timestamp')!.evaluate();
      expect(typeof result).toBe('number');
      expect(result as number).toBeGreaterThan(0);
    });
    it('$epoch converts date string to ms', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$epoch')!.evaluate('2024-01-15T10:30:00Z');
      expect(result).toBe(new Date('2024-01-15T10:30:00Z').getTime());
    });
    it('$epoch returns 0 for invalid date', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$epoch')!.evaluate('not-a-date')).toBe(0);
    });
  });

  // ── Edge-case branch coverage ──
  describe('edge-case branches', () => {
    // $length: array vs string branch
    it('$length handles null', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$length')!.evaluate(null)).toBe(0);
    });

    // $substring: len != null branch (already covered above, but ensure both paths)
    it('$substring with null length falls back to substr without length', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$substring')!.evaluate('hello', 1, null)).toBe('ello');
    });

    // $padEnd: default pad (space)
    it('$padEnd uses space by default', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$padEnd')!.evaluate('hi', 4)).toBe('hi  ');
    });

    // $padStart/$padEnd with explicit null pad
    it('$padStart with null pad uses space', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$padStart')!.evaluate('x', 3, null)).toBe('  x');
    });

    // $divide: non-zero path
    it('$divide normal division', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$divide')!.evaluate(10, 3)).toBeCloseTo(3.333, 2);
    });

    // $round: dec == null path
    it('$round with explicit null decimals', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$round')!.evaluate(3.7, null)).toBe(4);
    });

    // $random: partial null args
    it('$random with only min', () => {
      const r = EXPRESSION_FUNCTION_MAP.get('$random')!.evaluate(100) as number;
      expect(r).toBeGreaterThanOrEqual(100);
    });
    it('$random with only max null', () => {
      const r = EXPRESSION_FUNCTION_MAP.get('$random')!.evaluate(0, null) as number;
      expect(r).toBeGreaterThanOrEqual(0);
    });

    // $mod: non-zero path
    it('$mod normal modulo', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$mod')!.evaluate(7, 3)).toBe(1);
    });

    // $if: "null" and "undefined" as falsy
    it('$if treats "null" as falsy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$if')!.evaluate('null', 'A', 'B')).toBe('B');
    });
    it('$if treats "undefined" as falsy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$if')!.evaluate('undefined', 'A', 'B')).toBe('B');
    });
    it('$if treats non-zero number string as truthy', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$if')!.evaluate('42', 'A', 'B')).toBe('A');
    });

    // $not: "0", "null", "undefined"
    it('$not negates "0"', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$not')!.evaluate('0')).toBe(true);
    });
    it('$not negates "null"', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$not')!.evaluate('null')).toBe(true);
    });
    it('$not negates "undefined"', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$not')!.evaluate('undefined')).toBe(true);
    });

    // $isEmpty: non-empty array
    it('$isEmpty returns false for non-empty array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$isEmpty')!.evaluate([1, 2])).toBe(false);
    });
    it('$isEmpty returns false for number', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$isEmpty')!.evaluate(42)).toBe(false);
    });

    // $matches: non-matching regex
    it('$matches returns false for non-match', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$matches')!.evaluate('hello', '^\\d+$')).toBe(false);
    });

    // $coalesce: all non-empty returns first
    it('$coalesce with all non-empty returns first', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$coalesce')!.evaluate('a', 'b', 'c')).toBe('a');
    });
    // $coalesce: no args path
    it('$coalesce with no args returns null', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$coalesce')!.evaluate()).toBe(null);
    });

    // $default: undefined
    it('$default returns fallback when undefined', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$default')!.evaluate(undefined, 'fb')).toBe('fb');
    });

    // $keys: returns [] for array input
    it('$keys returns [] for array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$keys')!.evaluate([1, 2])).toEqual([]);
    });

    // $values: returns [] for non-object
    it('$values returns [] for non-object', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$values')!.evaluate('not json')).toEqual([]);
    });
    it('$values returns [] for array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$values')!.evaluate([1, 2])).toEqual([]);
    });
    it('$values from JSON string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$values')!.evaluate('{"x":1,"y":2}')).toEqual([1, 2]);
    });

    // $count: non-array string not starting with [
    it('$count returns string length for plain string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$count')!.evaluate('hello')).toBe(5);
    });
    it('$count handles invalid JSON array string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$count')!.evaluate('[invalid')).toBe(8);
    });

    // $flatten: JSON string input
    it('$flatten handles JSON string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$flatten')!.evaluate('[[1,2],[3]]')).toEqual([1, 2, 3]);
    });
    it('$flatten returns [] for non-array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$flatten')!.evaluate('not json')).toEqual([]);
    });
    it('$flatten returns [] for non-array JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$flatten')!.evaluate('42')).toEqual([]);
    });

    // $sort: non-array returns []
    it('$sort returns [] for non-array non-JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$sort')!.evaluate('not json')).toEqual([]);
    });
    it('$sort returns [] for non-array JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$sort')!.evaluate('42')).toEqual([]);
    });

    // $reverse: non-array
    it('$reverse returns [] for non-array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$reverse')!.evaluate('not json')).toEqual([]);
    });
    it('$reverse returns [] for non-array JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$reverse')!.evaluate('42')).toEqual([]);
    });

    // $unique: non-array
    it('$unique returns [] for non-array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$unique')!.evaluate('not json')).toEqual([]);
    });
    it('$unique returns [] for non-array JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$unique')!.evaluate('42')).toEqual([]);
    });

    // $first: JSON array string
    it('$first parses JSON array string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$first')!.evaluate('[10,20,30]')).toBe(10);
    });
    it('$first returns null for empty JSON array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$first')!.evaluate('[]')).toBe(null);
    });
    it('$first handles invalid JSON starting with [', () => {
      const r = EXPRESSION_FUNCTION_MAP.get('$first')!.evaluate('[invalid');
      expect(r).toBe('[');
    });
    it('$first returns empty string for empty string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$first')!.evaluate('')).toBe('');
    });

    // $last: JSON array string
    it('$last parses JSON array string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$last')!.evaluate('[10,20,30]')).toBe(30);
    });
    it('$last returns null for empty JSON array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$last')!.evaluate('[]')).toBe(null);
    });
    it('$last handles invalid JSON starting with [', () => {
      const r = EXPRESSION_FUNCTION_MAP.get('$last')!.evaluate('[invalid');
      expect(r).toBe('d');
    });
    it('$last returns empty for empty string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$last')!.evaluate('')).toBe('');
    });
    it('$last returns null for empty array', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$last')!.evaluate([])).toBe(null);
    });

    // $slice: JSON string input, non-array
    it('$slice returns [] for non-array non-JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$slice')!.evaluate('not json', 0, 1)).toEqual([]);
    });

    // $jsonpath: null object, non-object segment
    it('$jsonpath returns null for null input', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$jsonpath')!.evaluate(null, 'a.b')).toBe(null);
    });
    it('$jsonpath returns null for invalid JSON string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$jsonpath')!.evaluate('not json', 'a')).toBe(null);
    });
    it('$jsonpath returns null for primitive at intermediate path', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$jsonpath')!.evaluate({ a: 42 }, 'a.b')).toBe(null);
    });

    // $merge: non-object inputs
    it('$merge handles invalid JSON', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$merge')!.evaluate('not json', 'also not')).toEqual({});
    });
    it('$merge handles array input', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$merge')!.evaluate([1, 2], { b: 2 })).toEqual({ b: 2 });
    });

    // $type: undefined
    it('$type returns null for undefined', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$type')!.evaluate(undefined)).toBe('null');
    });

    // $stringify: error path (circular ref)
    it('$stringify returns string for circular ref', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      const result = EXPRESSION_FUNCTION_MAP.get('$stringify')!.evaluate(obj);
      expect(typeof result).toBe('string');
    });

    // $parse: handles empty string
    it('$parse returns null for empty string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$parse')!.evaluate('')).toBe(null);
    });

    // $toIso: with timestamp number
    it('$toIso converts numeric timestamp', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$toIso')!.evaluate(1705312200000)).toContain('2024');
    });

    // $formatDate: with HH:mm:ss
    it('$formatDate with time tokens', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$formatDate')!.evaluate('2024-01-15T10:30:45Z', 'HH:mm:ss');
      expect(result).toBe('10:30:45');
    });
    // $formatDate with numeric timestamp
    it('$formatDate with numeric timestamp', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$formatDate')!.evaluate(0);
      expect(result).toBe('1970-01-01');
    });

    // $diffMs with numeric timestamps
    it('$diffMs with numeric timestamps', () => {
      const r = EXPRESSION_FUNCTION_MAP.get('$diffMs')!.evaluate(86400000, 0);
      expect(r).toBe(86400000);
    });

    // $addDays with numeric timestamp
    it('$addDays with numeric timestamp', () => {
      const r = EXPRESSION_FUNCTION_MAP.get('$addDays')!.evaluate(0, 1) as string;
      expect(r).toContain('1970-01-02');
    });

    // $addHours with numeric timestamp
    it('$addHours with numeric timestamp', () => {
      const r = EXPRESSION_FUNCTION_MAP.get('$addHours')!.evaluate(0, 1);
      expect(r).toBe('1970-01-01T01:00:00.000Z');
    });

    // String helper s() with undefined
    it('$upper handles undefined', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$upper')!.evaluate(undefined)).toBe('');
    });

    // Number helper n() with non-number
    it('$add handles NaN string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$add')!.evaluate('abc', 5)).toBe(5);
    });

    // $base64 with special chars
    it('$base64 handles empty string', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$base64')!.evaluate('')).toBe('');
    });

    // $urlDecode handles valid encoded string
    it('$urlDecode handles plus sign', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$urlDecode')!.evaluate('hello+world')).toBe('hello+world');
    });

    // $hash handles empty string
    it('$hash handles empty string', () => {
      const result = EXPRESSION_FUNCTION_MAP.get('$hash')!.evaluate('');
      expect(typeof result).toBe('string');
    });

    // $first: non-array JSON string starting with [
    it('$first handles JSON that parses to non-array starting with [', () => {
      // This case is tricky - JSON starting with [ should be an array
      // Testing a string that starts with [ but parses to non-array isn't really possible
      // Instead test the sv[0] ?? '' fallback for empty string
      expect(EXPRESSION_FUNCTION_MAP.get('$first')!.evaluate(null)).toBe('');
    });

    // $last: non-array JSON string starting with [
    it('$last handles null', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('$last')!.evaluate(null)).toBe('');
    });
  });
});
