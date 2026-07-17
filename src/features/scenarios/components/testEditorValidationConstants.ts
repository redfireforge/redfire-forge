import { createElement, type ChangeEvent, type SVGProps } from 'react';
import type { ComparisonOperator, FieldOperator } from '../../../shared/types';

export function getAssertionTypeBadgeLabel(type: string): string {
  switch (type) {
    case 'status': return 'STATUS';
    case 'responseTime': return 'TIME';
    case 'header': return 'HEADER';
    case 'regex': return 'REGEX';
    case 'arrayLength': return 'ARRAY';
    case 'numeric': return 'NUMBER';
    case 'date': return 'DATE';
    case 'typeCheck': return 'TYPE';
    case 'existence': return 'EXISTS';
    case 'arrayContains': return 'CONTAINS';
    case 'each': return 'EACH';
    case 'jsonSchema': return 'SCHEMA';
    case 'bodySize': return 'SIZE';
    case 'datePrecise': return 'DATE⁺';
    case 'custom': return 'CUSTOM';
    case 'kafkaField': return 'KAFKA';
    case 'wsField': return 'WS';
    case 'wsNumericField': return 'WS#';
    default: return 'SUBSET';
  }
}

export const NUMERIC_OP_OPTIONS: { value: ComparisonOperator; label: string }[] = [
  { value: '=', label: 'equals (=)' },
  { value: '!=', label: 'not equals (≠)' },
  { value: '>', label: 'greater than (>)' },
  { value: '>=', label: 'at least (≥)' },
  { value: '<', label: 'less than (<)' },
  { value: '<=', label: 'at most (≤)' },
];

export const DATE_OP_OPTIONS: { value: ComparisonOperator; label: string }[] = [
  { value: '=', label: 'equals (=)' },
  { value: '!=', label: 'not equals (≠)' },
  { value: '>', label: 'after (>)' },
  { value: '>=', label: 'on or after (≥)' },
  { value: '<', label: 'before (<)' },
  { value: '<=', label: 'on or before (≤)' },
];

export interface ComparisonSelectProps {
  value: ComparisonOperator;
  onChange: (op: ComparisonOperator) => void;
  options: { value: ComparisonOperator; label: string }[];
  className?: string;
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return createElement(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...props,
    },
    createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }),
    createElement('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
    createElement('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
    createElement('line', { x1: 3, y1: 10, x2: 21, y2: 10 }),
  );
}

export function ComparisonSelect({ value, onChange, options, className }: ComparisonSelectProps) {
  return createElement(
    'select',
    {
      value,
      onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as ComparisonOperator),
      className: className ?? 'assertion-select assertion-select-operator',
    },
    ...options.map((o) => createElement('option', { key: o.value, value: o.value }, o.label)),
  );
}

export const FIELD_OP_OPTIONS: { value: FieldOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'greater_than', label: '>' },
  { value: 'greater_than_or_equal', label: '>=' },
  { value: 'less_than', label: '<' },
  { value: 'less_than_or_equal', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'regex', label: 'regex' },
  { value: 'is_true', label: 'is true' },
  { value: 'is_false', label: 'is false' },
  { value: 'is_null', label: 'is null' },
  { value: 'is_not_null', label: 'is not null' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'not exists' },
  { value: 'is_type', label: 'is type' },
  { value: 'in', label: 'in' },
  { value: 'not_in', label: 'not in' },
  { value: 'between', label: 'between' },
  { value: 'close_to', label: 'close to' },
];

export const ARRAY_CONTAINS_MODE_OPTIONS: { value: 'any' | 'all' | 'only' | 'none'; label: string }[] = [
  { value: 'any', label: 'any (at least one)' },
  { value: 'all', label: 'all (every item)' },
  { value: 'only', label: 'only (exact set)' },
  { value: 'none', label: 'none (no match)' },
];
