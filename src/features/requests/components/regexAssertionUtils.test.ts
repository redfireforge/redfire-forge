import { describe, it, expect, vi } from 'vitest';
import {
  PATTERN_LIBRARY,
  testPattern,
  resolveValue,
} from './regexAssertionUtils';

describe('regexAssertionUtils', () => {
  describe('PATTERN_LIBRARY', () => {
    it('is an array of pattern entries', () => {
      expect(Array.isArray(PATTERN_LIBRARY)).toBe(true);
      expect(PATTERN_LIBRARY.length).toBeGreaterThan(0);
    });

    it('contains patterns with required properties', () => {
      PATTERN_LIBRARY.forEach((entry) => {
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('pattern');
        expect(entry).toHaveProperty('description');
        expect(entry).toHaveProperty('category');
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.pattern).toBe('string');
        expect(typeof entry.description).toBe('string');
        expect(typeof entry.category).toBe('string');
      });
    });

    it('groups patterns by category', () => {
      const categories = new Set(PATTERN_LIBRARY.map((e) => e.category));
      expect(categories.has('Text')).toBe(true);
      expect(categories.has('Identifiers')).toBe(true);
      expect(categories.has('Formats')).toBe(true);
      expect(categories.has('Numbers')).toBe(true);
      expect(categories.has('Arrays')).toBe(true);
    });

    it('includes UUID pattern', () => {
      const uuidPattern = PATTERN_LIBRARY.find((e) => e.name === 'UUID v4');
      expect(uuidPattern).toBeDefined();
      expect(uuidPattern?.category).toBe('Identifiers');
    });

    it('includes email pattern', () => {
      const emailPattern = PATTERN_LIBRARY.find((e) => e.name === 'Email address');
      expect(emailPattern).toBeDefined();
      expect(emailPattern?.category).toBe('Formats');
    });

    it('includes phone pattern', () => {
      const phonePattern = PATTERN_LIBRARY.find((e) => e.name === 'Phone (US)');
      expect(phonePattern).toBeDefined();
      expect(phonePattern?.category).toBe('Formats');
    });

    it('has non-empty descriptions', () => {
      PATTERN_LIBRARY.forEach((entry) => {
        expect(entry.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('testPattern', () => {
    describe('valid regex patterns', () => {
      it('returns match for simple text match', () => {
        const result = testPattern('hello', 'hello world');
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('returns no match when pattern not found', () => {
        const result = testPattern('goodbye', 'hello world');
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(false);
      });

      it('matches UUID v4 pattern', () => {
        const pattern = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
        const validUuid = '550e8400-e29b-41d4-a716-446655440000';
        const result = testPattern(pattern, validUuid);
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(true);
      });

      it('rejects invalid UUID', () => {
        const pattern = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
        const invalidUuid = 'not-a-uuid';
        const result = testPattern(pattern, invalidUuid);
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(false);
      });

      it('matches email pattern', () => {
        const pattern = '^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$';
        const result = testPattern(pattern, 'user@example.com');
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(true);
      });

      it('matches ISO date pattern', () => {
        const pattern = '^\\d{4}-\\d{2}-\\d{2}';
        const result = testPattern(pattern, '2026-04-27');
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(true);
      });

      it('matches positive integer pattern', () => {
        const pattern = '^[1-9]\\d*$';
        expect(testPattern(pattern, '123').matches).toBe(true);
        expect(testPattern(pattern, '0').matches).toBe(false);
        expect(testPattern(pattern, '-5').matches).toBe(false);
      });

      it('provides match details', () => {
        const result = testPattern('(\\d+)', 'Price: 123 dollars');
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(true);
        expect(result.matchDetails).toBeDefined();
        expect(result.matchDetails?.[1]).toBe('123');
      });
    });

    describe('empty or invalid patterns', () => {
      it('returns no match for empty pattern', () => {
        const result = testPattern('', 'any value');
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(false);
      });

      it('returns error for invalid regex', () => {
        const result = testPattern('[unclosed', 'test');
        expect(result.valid).toBe(false);
        expect(result.matches).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('handles malformed regex gracefully', () => {
        const result = testPattern('(', 'test');
        expect(result.valid).toBe(false);
        expect(result.error).toBeTruthy();
      });

      it('uses fallback error text when RegExp throws a non-Error value', () => {
        const spy = vi.spyOn(RegExp.prototype, 'test').mockImplementation(() => {
          throw 'boom';
        });
        const result = testPattern('abc', 'value');
        expect(result).toEqual({ valid: false, matches: false, error: 'Invalid regex' });
        spy.mockRestore();
      });
    });

    describe('special characters and escaping', () => {
      it('matches literal dots when escaped', () => {
        const result = testPattern('\\d+\\.\\d+', '3.14');
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(true);
      });

      it('handles anchors correctly', () => {
        expect(testPattern('^hello', 'hello world').matches).toBe(true);
        expect(testPattern('^hello', 'say hello').matches).toBe(false);
        expect(testPattern('world$', 'hello world').matches).toBe(true);
        expect(testPattern('world$', 'world peace').matches).toBe(false);
      });

      it('handles character classes', () => {
        const result = testPattern('[A-Z][a-z]+', 'Hello');
        expect(result.valid).toBe(true);
        expect(result.matches).toBe(true);
      });
    });
  });

  describe('resolveValue', () => {
    const sampleJson = JSON.stringify({
      name: 'John',
      age: 30,
      address: {
        city: 'New York',
        zip: '10001',
      },
      tags: ['developer', 'designer'],
      active: true,
    });

    describe('simple property access', () => {
      it('resolves top-level string property', () => {
        expect(resolveValue(sampleJson, '$.name')).toBe('John');
      });

      it('resolves top-level string property without $', () => {
        expect(resolveValue(sampleJson, 'name')).toBe('John');
      });

      it('resolves top-level string property without $.', () => {
        expect(resolveValue(sampleJson, '.name')).toBe('John');
      });

      it('resolves top-level number property', () => {
        expect(resolveValue(sampleJson, '$.age')).toBe('30');
      });

      it('resolves top-level boolean property', () => {
        expect(resolveValue(sampleJson, '$.active')).toBe('true');
      });
    });

    describe('nested property access', () => {
      it('resolves nested string property', () => {
        expect(resolveValue(sampleJson, '$.address.city')).toBe('New York');
      });

      it('resolves deeply nested property', () => {
        expect(resolveValue(sampleJson, '$.address.zip')).toBe('10001');
      });

      it('resolves nested property without $', () => {
        expect(resolveValue(sampleJson, 'address.city')).toBe('New York');
      });
    });

    describe('array access', () => {
      it('resolves array element by index', () => {
        expect(resolveValue(sampleJson, '$.tags[0]')).toBe('developer');
      });

      it('resolves second array element', () => {
        expect(resolveValue(sampleJson, '$.tags[1]')).toBe('designer');
      });

      it('resolves entire array as JSON string', () => {
        const result = resolveValue(sampleJson, '$.tags');
        expect(result).toBe('["developer","designer"]');
      });
    });

    describe('edge cases', () => {
      it('returns undefined for non-existent property', () => {
        expect(resolveValue(sampleJson, '$.nonexistent')).toBeUndefined();
      });

      it('returns undefined for invalid path', () => {
        expect(resolveValue(sampleJson, '$.address.nonexistent')).toBeUndefined();
      });

      it('returns undefined for empty json', () => {
        expect(resolveValue('', '$.name')).toBeUndefined();
      });

      it('returns undefined for empty path', () => {
        expect(resolveValue(sampleJson, '')).toBeUndefined();
      });

      it('returns undefined for invalid JSON', () => {
        expect(resolveValue('not json', '$.name')).toBeUndefined();
      });

      it('returns undefined when accessing property on primitive', () => {
        expect(resolveValue(sampleJson, '$.age.invalid')).toBeUndefined();
      });

      it('handles null values', () => {
        const jsonWithNull = JSON.stringify({ value: null });
        expect(resolveValue(jsonWithNull, '$.value')).toBe('null');
      });
    });

    describe('complex objects', () => {
      it('resolves object as JSON string', () => {
        const result = resolveValue(sampleJson, '$.address');
        expect(result).toBe('{"city":"New York","zip":"10001"}');
      });

      it('handles nested arrays', () => {
        const json = JSON.stringify({ items: [[1, 2], [3, 4]] });
        expect(resolveValue(json, '$.items[0][1]')).toBe('2');
      });
    });

    describe('path normalization', () => {
      it('handles paths with or without leading $', () => {
        expect(resolveValue(sampleJson, '$.name')).toBe(resolveValue(sampleJson, 'name'));
      });

      it('handles consecutive dots', () => {
        expect(resolveValue(sampleJson, '..name')).toBe('John');
      });

      it('normalizes array bracket notation', () => {
        expect(resolveValue(sampleJson, 'tags[0]')).toBe('developer');
      });
    });
  });

  describe('integration', () => {
    it('can use testPattern with resolveValue result', () => {
      const json = JSON.stringify({ email: 'user@example.com' });
      const value = resolveValue(json, '$.email');
      const pattern = '^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$';
      const result = testPattern(pattern, value || '');
      
      expect(result.valid).toBe(true);
      expect(result.matches).toBe(true);
    });

    it('validates UUID from JSON response', () => {
      const json = JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000' });
      const value = resolveValue(json, '$.id');
      const uuidPattern = PATTERN_LIBRARY.find((e) => e.name === 'UUID v4');
      const result = testPattern(uuidPattern!.pattern, value || '');
      
      expect(result.matches).toBe(true);
    });
  });
});
