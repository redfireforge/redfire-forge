import { describe, expect, it } from 'vitest';
import { isUnavailablePredicateOperator, UNAVAILABLE_PREDICATE_OPERATORS } from './unavailableOperators';

describe('unavailableOperators', () => {
  it('has no gated matcher operators after P2 libraries shipped', () => {
    expect(UNAVAILABLE_PREDICATE_OPERATORS).toEqual([]);
  });

  it('identifies unavailable vs supported operators', () => {
    expect(isUnavailablePredicateOperator('jsonSchema')).toBe(false);
    expect(isUnavailablePredicateOperator('exact')).toBe(false);
  });
});
