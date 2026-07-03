/**
 * @vitest-environment jsdom
 */
import { createElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ARRAY_CONTAINS_MODE_OPTIONS,
  CalendarIcon,
  ComparisonSelect,
  DATE_OP_OPTIONS,
  FIELD_OP_OPTIONS,
  getAssertionTypeBadgeLabel,
  NUMERIC_OP_OPTIONS,
} from './testEditorValidationConstants';

describe('getAssertionTypeBadgeLabel', () => {
  it('maps known assertion types to badge labels', () => {
    expect(getAssertionTypeBadgeLabel('status')).toBe('STATUS');
    expect(getAssertionTypeBadgeLabel('responseTime')).toBe('TIME');
    expect(getAssertionTypeBadgeLabel('header')).toBe('HEADER');
    expect(getAssertionTypeBadgeLabel('regex')).toBe('REGEX');
    expect(getAssertionTypeBadgeLabel('arrayLength')).toBe('ARRAY');
    expect(getAssertionTypeBadgeLabel('numeric')).toBe('NUMBER');
    expect(getAssertionTypeBadgeLabel('date')).toBe('DATE');
    expect(getAssertionTypeBadgeLabel('typeCheck')).toBe('TYPE');
    expect(getAssertionTypeBadgeLabel('existence')).toBe('EXISTS');
    expect(getAssertionTypeBadgeLabel('arrayContains')).toBe('CONTAINS');
    expect(getAssertionTypeBadgeLabel('each')).toBe('EACH');
    expect(getAssertionTypeBadgeLabel('jsonSchema')).toBe('SCHEMA');
    expect(getAssertionTypeBadgeLabel('bodySize')).toBe('SIZE');
    expect(getAssertionTypeBadgeLabel('datePrecise')).toBe('DATE⁺');
    expect(getAssertionTypeBadgeLabel('custom')).toBe('CUSTOM');
  });

  it('maps transport assertion types to badge labels', () => {
    expect(getAssertionTypeBadgeLabel('kafkaField')).toBe('KAFKA');
    expect(getAssertionTypeBadgeLabel('wsField')).toBe('WS');
    expect(getAssertionTypeBadgeLabel('wsNumericField')).toBe('WS#');
  });

  it('returns SUBSET for unknown types', () => {
    expect(getAssertionTypeBadgeLabel('subset')).toBe('SUBSET');
    expect(getAssertionTypeBadgeLabel('')).toBe('SUBSET');
    expect(getAssertionTypeBadgeLabel('unknown')).toBe('SUBSET');
  });
});

describe('validation option lists', () => {
  it('keeps numeric and date comparison lists aligned in length', () => {
    expect(NUMERIC_OP_OPTIONS).toHaveLength(6);
    expect(DATE_OP_OPTIONS).toHaveLength(6);
  });

  it('uses unique operator values in numeric, date, and field option lists', () => {
    const numVals = NUMERIC_OP_OPTIONS.map((o) => o.value);
    const dateVals = DATE_OP_OPTIONS.map((o) => o.value);
    const fieldVals = FIELD_OP_OPTIONS.map((o) => o.value);
    expect(new Set(numVals).size).toBe(numVals.length);
    expect(new Set(dateVals).size).toBe(dateVals.length);
    expect(new Set(fieldVals).size).toBe(fieldVals.length);
  });

  it('lists all array-contains modes', () => {
    expect(ARRAY_CONTAINS_MODE_OPTIONS.map((o) => o.value)).toEqual(['any', 'all', 'only', 'none']);
  });
});

describe('ComparisonSelect', () => {
  it('renders options and invokes onChange with the selected operator', () => {
    const onChange = vi.fn();
    render(createElement(ComparisonSelect, { value: '=', onChange, options: NUMERIC_OP_OPTIONS }));
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('assertion-select', 'assertion-select-operator');
    fireEvent.change(select, { target: { value: '>' } });
    expect(onChange).toHaveBeenCalledWith('>');
  });

  it('respects a custom className', () => {
    render(
      createElement(ComparisonSelect, {
        value: '>',
        onChange: () => {},
        options: DATE_OP_OPTIONS,
        className: 'custom-op-select',
      }),
    );
    expect(screen.getByRole('combobox')).toHaveClass('custom-op-select');
  });
});

describe('CalendarIcon', () => {
  it('renders an svg element', () => {
    const { container } = render(createElement(CalendarIcon, { 'data-testid': 'cal-icon' }));
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
