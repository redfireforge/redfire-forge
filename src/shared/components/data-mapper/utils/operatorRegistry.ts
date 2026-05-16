import type { FieldOperator } from '../types';

export interface OperatorMeta {
  label: string;
  icon: string;
  category: 'equality' | 'comparison' | 'string' | 'boolean' | 'existence' | 'type' | 'set' | 'range';
  cssClass: string;
  needsValue: boolean;
}

export const OPERATOR_REGISTRY: Record<FieldOperator, OperatorMeta> = {
  equals: { label: 'equals', icon: '=', category: 'equality', cssClass: 'equals', needsValue: false },
  not_equals: { label: 'not equals', icon: '≠', category: 'equality', cssClass: 'equals', needsValue: false },
  greater_than: { label: 'greater than', icon: '＞', category: 'comparison', cssClass: 'comparison', needsValue: true },
  greater_than_or_equal: { label: 'at least', icon: '≥', category: 'comparison', cssClass: 'comparison', needsValue: true },
  less_than: { label: 'less than', icon: '＜', category: 'comparison', cssClass: 'comparison', needsValue: true },
  less_than_or_equal: { label: 'at most', icon: '≤', category: 'comparison', cssClass: 'comparison', needsValue: true },
  contains: { label: 'contains', icon: '⊃', category: 'string', cssClass: 'string-op', needsValue: true },
  not_contains: { label: 'not contains', icon: '⊅', category: 'string', cssClass: 'string-op', needsValue: true },
  starts_with: { label: 'starts with', icon: '⊳', category: 'string', cssClass: 'string-op', needsValue: true },
  ends_with: { label: 'ends with', icon: '⊲', category: 'string', cssClass: 'string-op', needsValue: true },
  regex: { label: 'matches', icon: '.*', category: 'string', cssClass: 'string-op', needsValue: true },
  is_true: { label: 'is true', icon: '✓', category: 'boolean', cssClass: 'boolean-op', needsValue: false },
  is_false: { label: 'is false', icon: '✗', category: 'boolean', cssClass: 'boolean-op', needsValue: false },
  is_null: { label: 'is null', icon: '∅', category: 'existence', cssClass: 'existence', needsValue: false },
  is_not_null: { label: 'is not null', icon: '∃≠∅', category: 'existence', cssClass: 'existence', needsValue: false },
  is_empty: { label: 'is empty', icon: '⌀', category: 'existence', cssClass: 'existence', needsValue: false },
  is_not_empty: { label: 'is not empty', icon: '⌀̸', category: 'existence', cssClass: 'existence', needsValue: false },
  exists: { label: 'exists', icon: '∃', category: 'existence', cssClass: 'existence', needsValue: false },
  not_exists: { label: 'not exists', icon: '∄', category: 'existence', cssClass: 'existence', needsValue: false },
  is_type: { label: 'is type', icon: 'τ', category: 'type', cssClass: 'type-check', needsValue: true },
  in: { label: 'in list', icon: '∈', category: 'set', cssClass: 'comparison', needsValue: true },
  not_in: { label: 'not in list', icon: '∉', category: 'set', cssClass: 'comparison', needsValue: true },
  between: { label: 'between', icon: '↔', category: 'range', cssClass: 'comparison', needsValue: true },
  close_to: { label: 'close to', icon: '≈', category: 'range', cssClass: 'comparison', needsValue: true },
};

export const OPERATOR_CATEGORIES = [
  { key: 'equality', label: 'Equality' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'string', label: 'String' },
  { key: 'boolean', label: 'Boolean' },
  { key: 'existence', label: 'Existence' },
  { key: 'type', label: 'Type' },
  { key: 'set', label: 'Set' },
  { key: 'range', label: 'Range' },
] as const;
