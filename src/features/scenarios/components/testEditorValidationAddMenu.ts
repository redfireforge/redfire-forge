import type { ReactNode } from 'react';
import type { Assertion } from '../../../shared/types';

export type AddAssertionMenuRow =
  | { kind: 'divider' }
  | {
      kind: 'item';
      icon: ReactNode;
      iconClassName?: string;
      label: string;
      desc: string;
      assertion: Assertion | (() => Assertion);
    }
  | { kind: 'regexBuilder'; icon: ReactNode; label: string; desc: string };

export const ADD_ASSERTION_MENU_ROWS: AddAssertionMenuRow[] = [
  { kind: 'item', icon: '🔢', label: 'Status Code', desc: 'Assert HTTP status (200, 404…)', assertion: { type: 'status', expected: '200' } },
  { kind: 'item', icon: '⏱', label: 'Response Time SLA', desc: 'Set max response time threshold', assertion: { type: 'responseTime', maxMs: 500 } },
  { kind: 'item', icon: '📋', label: 'Response Header', desc: 'Check header name & value', assertion: { type: 'header', name: 'content-type', operator: 'contains', value: 'json' } },
  { kind: 'item', icon: '🔤', label: 'Regex Match', desc: 'Quick regex on a JSON path', assertion: { type: 'regex', jsonPath: '$.name', pattern: '^[A-Z].*' } },
  { kind: 'divider' },
  { kind: 'regexBuilder', icon: '🛠', label: 'Regex Builder…', desc: 'Visual builder with pattern library' },
  { kind: 'divider' },
  { kind: 'item', icon: '📏', label: 'Array Length', desc: 'Assert array size at a JSON path', assertion: { type: 'arrayLength', jsonPath: '', operator: '>=', value: 1 } },
  { kind: 'item', icon: '🔢', label: 'Numeric Compare', desc: 'Compare number at a JSON path', assertion: { type: 'numeric', jsonPath: '', operator: '=', value: 0 } },
  { kind: 'item', icon: '📅', label: 'Date Compare', desc: 'Compare date at a JSON path', assertion: { type: 'date', jsonPath: '', operator: '>', reference: { kind: 'today', timezone: 'utc' } } },
  { kind: 'divider' },
  { kind: 'item', icon: '🏷', label: 'Type Check', desc: 'Assert value type at a JSON path', assertion: { type: 'typeCheck', jsonPath: '', expectedType: 'string' } },
  { kind: 'item', icon: '🔍', label: 'Field Exists', desc: 'Assert a JSON path exists or not', assertion: { type: 'existence', jsonPath: '', expectExists: true } },
  { kind: 'divider' },
  { kind: 'item', icon: '⊇', label: 'Array Contains', desc: 'Check if array includes specific items', assertion: { type: 'arrayContains', jsonPath: '', value: '', mode: 'any' } },
  { kind: 'item', icon: '∀', label: 'Each Element', desc: 'Assert condition on every array element', assertion: { type: 'each', jsonPath: '', fieldPath: '', operator: 'greater_than_or_equal', value: '0' } },
  { kind: 'item', icon: '⊆', label: 'Contains Subset', desc: 'Partial deep match on a JSON structure', assertion: { type: 'containsSubset', jsonPath: '$', expected: '{}' } },
  { kind: 'item', icon: '{}', label: 'JSON Schema', desc: 'Validate response against a JSON Schema document', assertion: { type: 'jsonSchema', schema: '{}' } },
  { kind: 'divider' },
  { kind: 'item', icon: '⚖', label: 'Body Size', desc: 'Assert response body size within bounds', assertion: { type: 'bodySize', operator: '<=', value: 1024, unit: 'kb' } },
  {
    kind: 'item',
    icon: '⏱',
    label: 'Date Precise',
    desc: 'Compare date/time with sub-day precision',
    assertion: () => ({ type: 'datePrecise', jsonPath: '', operator: '>=', reference: new Date().toISOString(), precision: 'second' }),
  },
  { kind: 'divider' },
  { kind: 'item', icon: 'λ', iconClassName: 'aam-icon--lambda', label: 'Custom Predicate', desc: 'Write an expression that evaluates to truthy/falsy', assertion: { type: 'custom', expression: '', description: '' } },
];
