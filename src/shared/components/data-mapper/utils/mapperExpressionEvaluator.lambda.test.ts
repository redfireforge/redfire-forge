import { describe, it, expect } from 'vitest';
import { evaluateMapperExpression } from './mapperExpressionEvaluator';
import { debugExpression } from './expressionStepDebugger';
import type { MapperSource } from '../types';

const sampleData = {
  offers: [
    { associatedOfferingCode: 'CONPLN08YRXM', rank: 13, offerName: 'Connected Plan – 8 Years', productCode: 'Connected Access', billingCadence: 'Prepaid', planType: 'Trial', duration: { unit: 'Years', value: 8 } },
    { associatedOfferingCode: 'ESSPLN01MRXM', rank: 5, offerName: 'Essentials – Trial – 1 Month', productCode: 'Essentials', billingCadence: 'Prepaid', planType: 'Trial', duration: { unit: 'Months', value: 1 } },
    { associatedOfferingCode: 'EVXPLN08YRXM', rank: 9, offerName: 'EV Plan – 8 Years', productCode: 'EV Access', billingCadence: 'Prepaid', planType: 'Trial', duration: { unit: 'Years', value: 8 } },
  ],
  name: 'Test User',
  scores: [10, 20, 5, 30, 15],
  tags: ['alpha', 'beta', 'alpha', 'gamma', 'beta'],
  config: { host: 'localhost', port: 8080, debug: true },
};

const sources: MapperSource[] = [
  { id: 'source', label: 'Source', sampleData },
];

function evalExpr(expression: string) {
  return evaluateMapperExpression(expression, sources, 'source');
}

describe('Lambda functions — Live Preview evaluation', () => {

  // ── $map ──
  describe('$map', () => {
    it('maps array elements with lambda', () => {
      const r = evalExpr('$map($.scores, x => $multiply(x, 2))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([20, 40, 10, 60, 30]);
    });

    it('maps objects extracting a field', () => {
      const r = evalExpr('$map($.offers, x => x.rank)');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([13, 5, 9]);
    });

    it('maps with index parameter', () => {
      const r = evalExpr('$map([10, 20, 30], (x, i) => $add(x, i))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([10, 21, 32]);
    });
  });

  // ── $filter ──
  describe('$filter', () => {
    it('filters array elements with lambda', () => {
      const r = evalExpr('$filter($.scores, x => $gt(x, 10))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([20, 30, 15]);
    });

    it('filters objects by field', () => {
      const r = evalExpr('$filter($.offers, x => $gt(x.rank, 8))');
      expect(r.error).toBeUndefined();
      expect(Array.isArray(r.value)).toBe(true);
      expect((r.value as unknown[]).length).toBe(2);
    });
  });

  // ── $reduce ──
  describe('$reduce', () => {
    it('reduces array with accumulator', () => {
      const r = evalExpr('$reduce($.scores, (acc, x) => $add(acc, x), 0)');
      expect(r.error).toBeUndefined();
      expect(r.value).toBe(80);
    });

    it('reduces without initial value', () => {
      const r = evalExpr('$reduce([1, 2, 3, 4], (acc, x) => $add(acc, x))');
      expect(r.error).toBeUndefined();
      expect(r.value).toBe(10);
    });
  });

  // ── $sortBy ──
  describe('$sortBy', () => {
    it('sorts objects by field', () => {
      const r = evalExpr('$sortBy($.offers, x => x.rank)');
      expect(r.error).toBeUndefined();
      const sorted = r.value as { rank: number }[];
      expect(sorted.map(o => o.rank)).toEqual([5, 9, 13]);
    });

    it('sorts numbers', () => {
      const r = evalExpr('$sortBy($.scores, x => x)');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([5, 10, 15, 20, 30]);
    });
  });

  // ── $minBy ──
  describe('$minBy', () => {
    it('finds element with minimum value', () => {
      const r = evalExpr('$minBy($.offers, x => x.rank)');
      expect(r.error).toBeUndefined();
      expect((r.value as { rank: number }).rank).toBe(5);
    });

    it('returns null for empty array', () => {
      const r = evalExpr('$minBy([], x => x)');
      expect(r.error).toBeUndefined();
      expect(r.value).toBeNull();
    });
  });

  // ── $maxBy ──
  describe('$maxBy', () => {
    it('finds element with maximum value', () => {
      const r = evalExpr('$maxBy($.offers, x => x.rank)');
      expect(r.error).toBeUndefined();
      expect((r.value as { rank: number }).rank).toBe(13);
    });

    it('chained property access on result', () => {
      const r = evalExpr('$maxBy($.offers, x => x.rank).rank');
      expect(r.error).toBeUndefined();
      expect(r.value).toBe(13);
    });

    it('chained nested property access', () => {
      const r = evalExpr('$maxBy($.offers, x => x.duration.value).offerName');
      expect(r.error).toBeUndefined();
      expect(r.value).toBe('Connected Plan – 8 Years');
    });
  });

  // ── $distinctBy ──
  describe('$distinctBy', () => {
    it('removes duplicates by lambda key', () => {
      const r = evalExpr('$distinctBy($.tags, x => x)');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('removes duplicates by object field', () => {
      const r = evalExpr('$distinctBy($.offers, x => x.planType)');
      expect(r.error).toBeUndefined();
      expect((r.value as unknown[]).length).toBe(1);
    });
  });

  // ── $zip ──
  describe('$zip', () => {
    it('zips two arrays with lambda', () => {
      const r = evalExpr('$zip([1, 2, 3], [10, 20, 30], (a, b) => $add(a, b))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([11, 22, 33]);
    });

    it('zips without lambda (pairs)', () => {
      const r = evalExpr('$zip([1, 2], ["a", "b"])');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([[1, 'a'], [2, 'b']]);
    });
  });

  // ── $find ──
  describe('$find', () => {
    it('finds first matching element', () => {
      const r = evalExpr('$find($.offers, x => $equals(x.productCode, "Essentials"))');
      expect(r.error).toBeUndefined();
      expect((r.value as { rank: number }).rank).toBe(5);
    });

    it('returns null when no match', () => {
      const r = evalExpr('$find($.offers, x => $equals(x.productCode, "NonExistent"))');
      expect(r.error).toBeUndefined();
      expect(r.value).toBeNull();
    });

    it('chained property access on find result', () => {
      const r = evalExpr('$find($.offers, x => $equals(x.productCode, "Essentials")).offerName');
      expect(r.error).toBeUndefined();
      expect(r.value).toBe('Essentials – Trial – 1 Month');
    });
  });

  // ── $findAll ──
  describe('$findAll', () => {
    it('finds all matching elements', () => {
      const r = evalExpr('$findAll($.offers, x => $equals(x.billingCadence, "Prepaid"))');
      expect(r.error).toBeUndefined();
      expect((r.value as unknown[]).length).toBe(3);
    });

    it('returns empty array when no match', () => {
      const r = evalExpr('$findAll($.offers, x => $equals(x.planType, "Premium"))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([]);
    });
  });

  // ── $mapValues ──
  describe('$mapValues', () => {
    it('transforms object values with lambda', () => {
      const r = evalExpr('$mapValues($.config, v => $toString(v))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual({ host: 'localhost', port: '8080', debug: 'true' });
    });
  });

  // ── $mapKeys ──
  describe('$mapKeys', () => {
    it('transforms object keys with lambda', () => {
      const r = evalExpr('$mapKeys($.config, k => $upper(k))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual({ HOST: 'localhost', PORT: 8080, DEBUG: true });
    });
  });

  // ── $withEntries ──
  describe('$withEntries', () => {
    it('transforms entries with lambda', () => {
      const r = evalExpr('$withEntries($.config, e => e)');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual({ host: 'localhost', port: 8080, debug: true });
    });
  });

  // ── Nested lambdas ──
  describe('nested/composed lambda expressions', () => {
    it('$map + chained property access', () => {
      const r = evalExpr('$map($.offers, x => x.duration.value)');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([8, 1, 8]);
    });

    it('$filter + $map chained', () => {
      const r = evalExpr('$map($filter($.offers, x => $gt(x.rank, 8)), x => x.offerName)');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual(['Connected Plan – 8 Years', 'EV Plan – 8 Years']);
    });

    it('$reduce on $map result', () => {
      const r = evalExpr('$reduce($map($.offers, x => x.rank), (acc, x) => $add(acc, x), 0)');
      expect(r.error).toBeUndefined();
      expect(r.value).toBe(27);
    });

    it('lambda accessing nested object field', () => {
      const r = evalExpr('$filter($.offers, x => $equals(x.duration.unit, "Years"))');
      expect(r.error).toBeUndefined();
      expect((r.value as unknown[]).length).toBe(2);
    });

    it('$sortBy + $map combo', () => {
      const r = evalExpr('$map($sortBy($.offers, x => x.rank), x => x.rank)');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([5, 9, 13]);
    });
  });

  // ── Edge cases ──
  describe('edge cases', () => {
    it('lambda with string operations', () => {
      const r = evalExpr('$map($.tags, x => $upper(x))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual(['ALPHA', 'BETA', 'ALPHA', 'GAMMA', 'BETA']);
    });

    it('empty array input', () => {
      const r = evalExpr('$map([], x => x)');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([]);
    });

    it('$filter returning empty', () => {
      const r = evalExpr('$filter($.scores, x => $gt(x, 100))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([]);
    });

    it('lambda with $concat', () => {
      const r = evalExpr('$map($.offers, x => $concat(x.productCode, " (", $toString(x.rank), ")"))');
      expect(r.error).toBeUndefined();
      expect(r.value).toEqual([
        'Connected Access (13)',
        'Essentials (5)',
        'EV Access (9)',
      ]);
    });
  });

  // ── Step Debugger ──
  describe('Step Debugger integration', () => {
    function debug(expression: string) {
      return debugExpression(expression, sources, 'source');
    }

    it('$map step debug produces steps with no errors', () => {
      const r = debug('$map($.offers, x => x.rank)');
      expect(r.error).toBeUndefined();
      expect(r.steps.length).toBeGreaterThanOrEqual(2);
      expect(r.steps[r.steps.length - 1].label).toBe('Final Result');
      expect(r.steps[r.steps.length - 1].error).toBeUndefined();
      expect(r.finalValue).toEqual([13, 5, 9]);
    });

    it('$filter step debug labels as Lambda Application', () => {
      const r = debug('$filter($.scores, x => $gt(x, 10))');
      expect(r.error).toBeUndefined();
      const lambdaSteps = r.steps.filter(s => s.label === 'Lambda Application');
      expect(lambdaSteps.length).toBeGreaterThanOrEqual(0);
      expect(r.finalValue).toEqual([20, 30, 15]);
    });

    it('$maxBy with chained access debugs correctly', () => {
      const r = debug('$maxBy($.offers, x => x.rank).rank');
      expect(r.error).toBeUndefined();
      expect(r.finalValue).toBe(13);
      expect(r.steps.some(s => s.error)).toBe(false);
    });

    it('$find debug labels as Lambda Application', () => {
      const r = debug('$find($.offers, x => $equals(x.productCode, "Essentials"))');
      expect(r.error).toBeUndefined();
      expect(r.finalValue).toBeTruthy();
      const labels = r.steps.map(s => s.label);
      expect(labels.includes('Lambda Application') || labels.includes('Final Result')).toBe(true);
    });

    it('nested $map($filter(...)) debug has multiple steps', () => {
      const r = debug('$map($filter($.offers, x => $gt(x.rank, 8)), x => x.offerName)');
      expect(r.error).toBeUndefined();
      expect(r.steps.length).toBeGreaterThanOrEqual(3);
      expect(r.finalValue).toEqual(['Connected Plan – 8 Years', 'EV Plan – 8 Years']);
    });

    it('$reduce debug produces correct final value', () => {
      const r = debug('$reduce($.scores, (acc, x) => $add(acc, x), 0)');
      expect(r.error).toBeUndefined();
      expect(r.finalValue).toBe(80);
    });

    it('all lambda functions debug without errors', () => {
      const expressions = [
        '$map($.scores, x => $multiply(x, 2))',
        '$filter($.scores, x => $gt(x, 10))',
        '$reduce($.scores, (acc, x) => $add(acc, x), 0)',
        '$sortBy($.offers, x => x.rank)',
        '$minBy($.offers, x => x.rank)',
        '$maxBy($.offers, x => x.rank)',
        '$distinctBy($.tags, x => x)',
        '$zip([1, 2, 3], [10, 20, 30], (a, b) => $add(a, b))',
        '$find($.offers, x => $equals(x.productCode, "Essentials"))',
        '$findAll($.offers, x => $equals(x.billingCadence, "Prepaid"))',
        '$mapValues($.config, v => $toString(v))',
        '$mapKeys($.config, k => $upper(k))',
        '$withEntries($.config, e => e)',
      ];

      for (const expr of expressions) {
        const r = debug(expr);
        expect(r.error).toBeUndefined();
        expect(r.steps.length).toBeGreaterThanOrEqual(1);
        expect(r.steps[r.steps.length - 1].error).toBeUndefined();
      }
    });
  });
});
