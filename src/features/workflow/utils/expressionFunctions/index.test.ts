import { describe, it, expect } from 'vitest';
import {
  EXPRESSION_FUNCTIONS,
  EXPRESSION_FUNCTION_MAP,
  EXPRESSION_CATEGORIES,
  groupedExpressionFunctions,
} from './index';

describe('expressionFunctions/index', () => {
  describe('EXPRESSION_FUNCTIONS', () => {
    it('exports an array of all expression functions', () => {
      expect(Array.isArray(EXPRESSION_FUNCTIONS)).toBe(true);
      expect(EXPRESSION_FUNCTIONS.length).toBeGreaterThan(0);
    });

    it('contains functions with required properties', () => {
      EXPRESSION_FUNCTIONS.forEach((fn) => {
        expect(fn).toHaveProperty('name');
        expect(fn).toHaveProperty('category');
        expect(fn).toHaveProperty('signature');
        expect(fn).toHaveProperty('description');
        expect(fn).toHaveProperty('args');
        expect(fn).toHaveProperty('returnType');
        expect(fn).toHaveProperty('examples');
        expect(fn).toHaveProperty('evaluate');
        expect(typeof fn.name).toBe('string');
        expect(typeof fn.category).toBe('string');
        expect(typeof fn.evaluate).toBe('function');
      });
    });

    it('has unique function names', () => {
      const names = EXPRESSION_FUNCTIONS.map((f) => f.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('includes functions from all categories', () => {
      const categories = new Set(EXPRESSION_FUNCTIONS.map((f) => f.category));
      EXPRESSION_CATEGORIES.forEach((cat) => {
        expect(categories.has(cat)).toBe(true);
      });
    });

    it('includes string functions', () => {
      const stringFns = EXPRESSION_FUNCTIONS.filter((f) => f.category === 'String');
      expect(stringFns.length).toBeGreaterThan(0);
    });

    it('includes math functions', () => {
      const mathFns = EXPRESSION_FUNCTIONS.filter((f) => f.category === 'Math');
      expect(mathFns.length).toBeGreaterThan(0);
    });

    it('includes conditional functions', () => {
      const conditionalFns = EXPRESSION_FUNCTIONS.filter((f) => f.category === 'Conditional');
      expect(conditionalFns.length).toBeGreaterThan(0);
    });

    it('includes JSON functions', () => {
      const jsonFns = EXPRESSION_FUNCTIONS.filter((f) => f.category === 'JSON');
      expect(jsonFns.length).toBeGreaterThan(0);
    });

    it('includes date/time functions', () => {
      const dateFns = EXPRESSION_FUNCTIONS.filter((f) => f.category === 'Date/Time');
      expect(dateFns.length).toBeGreaterThan(0);
    });

    it('includes encoding functions', () => {
      const encodingFns = EXPRESSION_FUNCTIONS.filter((f) => f.category === 'Encoding');
      expect(encodingFns.length).toBeGreaterThan(0);
    });
  });

  describe('EXPRESSION_FUNCTION_MAP', () => {
    it('is a Map instance', () => {
      expect(EXPRESSION_FUNCTION_MAP instanceof Map).toBe(true);
    });

    it('contains all functions from EXPRESSION_FUNCTIONS', () => {
      expect(EXPRESSION_FUNCTION_MAP.size).toBe(EXPRESSION_FUNCTIONS.length);
    });

    it('maps function names to function objects', () => {
      EXPRESSION_FUNCTIONS.forEach((fn) => {
        expect(EXPRESSION_FUNCTION_MAP.get(fn.name)).toBe(fn);
      });
    });

    it('allows looking up functions by name', () => {
      const firstFn = EXPRESSION_FUNCTIONS[0];
      const lookedUp = EXPRESSION_FUNCTION_MAP.get(firstFn.name);
      expect(lookedUp).toBeDefined();
      expect(lookedUp?.name).toBe(firstFn.name);
    });

    it('returns undefined for non-existent function names', () => {
      expect(EXPRESSION_FUNCTION_MAP.get('nonExistentFunction')).toBeUndefined();
    });
  });

  describe('EXPRESSION_CATEGORIES', () => {
    it('exports all expected categories', () => {
      expect(EXPRESSION_CATEGORIES).toEqual([
        'String',
        'Math',
        'Conditional',
        'JSON',
        'Date/Time',
        'Encoding',
      ]);
    });

    it('contains exactly 6 categories', () => {
      expect(EXPRESSION_CATEGORIES).toHaveLength(6);
    });

    it('contains only unique values', () => {
      const unique = new Set(EXPRESSION_CATEGORIES);
      expect(unique.size).toBe(EXPRESSION_CATEGORIES.length);
    });
  });

  describe('groupedExpressionFunctions', () => {
    it('returns an array of category groups', () => {
      const grouped = groupedExpressionFunctions();
      expect(Array.isArray(grouped)).toBe(true);
      expect(grouped.length).toBeGreaterThan(0);
    });

    it('returns groups with category and functions properties', () => {
      const grouped = groupedExpressionFunctions();
      grouped.forEach((group) => {
        expect(group).toHaveProperty('category');
        expect(group).toHaveProperty('functions');
        expect(typeof group.category).toBe('string');
        expect(Array.isArray(group.functions)).toBe(true);
      });
    });

    it('includes all defined categories', () => {
      const grouped = groupedExpressionFunctions();
      const categories = grouped.map((g) => g.category);
      EXPRESSION_CATEGORIES.forEach((cat) => {
        expect(categories).toContain(cat);
      });
    });

    it('groups functions correctly by category', () => {
      const grouped = groupedExpressionFunctions();
      grouped.forEach((group) => {
        group.functions.forEach((fn) => {
          expect(fn.category).toBe(group.category);
        });
      });
    });

    it('does not include empty groups', () => {
      const grouped = groupedExpressionFunctions();
      grouped.forEach((group) => {
        expect(group.functions.length).toBeGreaterThan(0);
      });
    });

    it('includes all functions from EXPRESSION_FUNCTIONS', () => {
      const grouped = groupedExpressionFunctions();
      const allFunctions = grouped.flatMap((g) => g.functions);
      expect(allFunctions.length).toBe(EXPRESSION_FUNCTIONS.length);
    });

    it('maintains function identity across groups', () => {
      const grouped = groupedExpressionFunctions();
      const allFunctions = grouped.flatMap((g) => g.functions);
      
      // Check that each function in grouped output exists in EXPRESSION_FUNCTIONS
      allFunctions.forEach((fn) => {
        expect(EXPRESSION_FUNCTIONS).toContain(fn);
      });
    });

    it('returns categories in the same order as EXPRESSION_CATEGORIES', () => {
      const grouped = groupedExpressionFunctions();
      const groupCategories = grouped.map((g) => g.category);
      
      // Filter EXPRESSION_CATEGORIES to only those with functions
      const expectedCategories = EXPRESSION_CATEGORIES.filter((cat) =>
        EXPRESSION_FUNCTIONS.some((f) => f.category === cat)
      );
      
      expect(groupCategories).toEqual(expectedCategories);
    });

    it('returns new array on each call', () => {
      const grouped1 = groupedExpressionFunctions();
      const grouped2 = groupedExpressionFunctions();
      expect(grouped1).not.toBe(grouped2); // Different array instances
      expect(grouped1).toEqual(grouped2); // Same content
    });
  });

  describe('integration', () => {
    it('functions in groups can be looked up in map', () => {
      const grouped = groupedExpressionFunctions();
      grouped.forEach((group) => {
        group.functions.forEach((fn) => {
          const lookedUp = EXPRESSION_FUNCTION_MAP.get(fn.name);
          expect(lookedUp).toBe(fn);
        });
      });
    });

    it('all map entries appear in grouped output', () => {
      const grouped = groupedExpressionFunctions();
      const allGroupedFunctions = grouped.flatMap((g) => g.functions);
      
      EXPRESSION_FUNCTION_MAP.forEach((fn) => {
        expect(allGroupedFunctions).toContain(fn);
      });
    });
  });
});
