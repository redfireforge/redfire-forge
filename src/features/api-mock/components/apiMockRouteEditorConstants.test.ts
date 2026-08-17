import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/api-mock/unavailableOperators', () => ({
  isUnavailablePredicateOperator: (operator: string) => operator === 'legacy_op',
}));

import {
  expectedText,
  operatorOptionsFor,
  pairExpected,
  securitySelectorValue,
  METHOD_OPTIONS,
  OPERATOR_GROUPS_ALL,
  OPERATOR_GROUPS_SCALAR,
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

  it('groups operators and keeps an unavailable current value', () => {
    expect(operatorOptionsFor('exact')).toEqual(OPERATOR_GROUPS_ALL);
    expect(operatorOptionsFor('exact', 'header')).toEqual(OPERATOR_GROUPS_SCALAR);
    expect(operatorOptionsFor('form_field_exact', 'body').some(g => g.label === 'Form')).toBe(true);
    expect(operatorOptionsFor('form_field_exact', 'header').at(-1)).toEqual({
      label: 'Current',
      options: [{ value: 'form_field_exact', label: 'Form field exact (unavailable)', disabled: true }],
    });
    expect(operatorOptionsFor('legacy_op').at(-1)).toEqual({
      label: 'Current',
      options: [{ value: 'legacy_op', label: 'legacy_op (unavailable)', disabled: true }],
    });
  });

  it('colors method options like Requests', () => {
    const get = METHOD_OPTIONS.find(o => o.value === 'GET');
    expect(get).toMatchObject({
      label: 'GET',
      detail: 'Retrieve data',
      swatch: '#22c55e',
    });
  });

  it('keeps known security selectors and blanks unknown ones', () => {
    expect(securitySelectorValue('username')).toBe('username');
    expect(securitySelectorValue('nope')).toBe('');
    expect(securitySelectorValue(undefined)).toBe('');
  });
});
