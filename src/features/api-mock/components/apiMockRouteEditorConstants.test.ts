import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/api-mock/unavailableOperators', () => ({
  isUnavailablePredicateOperator: (operator: string) => operator === 'legacy_op',
}));

import {
  expectedText,
  operatorOptionsFor,
  pairExpected,
  securitySelectorValue,
  OPERATOR_OPTIONS,
} from './apiMockRouteEditorConstants';

describe('apiMockRouteEditorConstants', () => {
  it('stringifies expected values and survives circular objects', () => {
    expect(expectedText('abc')).toBe('abc');
    expect(expectedText(null)).toBe('');
    expect(expectedText({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2));
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(expectedText(circular as never)).toBe(String(circular));
  });

  it('splits pair expected arrays', () => {
    expect(pairExpected(['left', 'right'])).toEqual(['left', 'right']);
    expect(pairExpected(['only'])).toEqual(['only', '']);
    expect(pairExpected([])).toEqual(['', '']);
    expect(pairExpected('nope')).toEqual(['', '']);
  });

  it('appends an unavailable operator option', () => {
    expect(operatorOptionsFor('exact')).toEqual(OPERATOR_OPTIONS);
    expect(operatorOptionsFor('legacy_op')).toEqual([
      ...OPERATOR_OPTIONS,
      { value: 'legacy_op', label: 'legacy_op (unavailable)', disabled: true },
    ]);
  });

  it('keeps known security selectors and blanks unknown ones', () => {
    expect(securitySelectorValue('username')).toBe('username');
    expect(securitySelectorValue('nope')).toBe('');
    expect(securitySelectorValue(undefined)).toBe('');
  });
});
