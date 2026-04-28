import type { ExpressionFunction } from './types';
import { s } from './helpers';

const $default: ExpressionFunction = {
  name: '$default', category: 'Conditional',
  signature: '$default(value, fallback) → any',
  description: 'Return `value` if it is non-empty, otherwise `fallback`.',
  args: [
    { name: 'value', type: 'any', required: true, description: 'Primary value' },
    { name: 'fallback', type: 'any', required: true, description: 'Fallback if value is empty' },
  ],
  returnType: 'any',
  examples: [{ input: '$default("", "N/A")', output: 'N/A' }],
  evaluate: (v, fb) => (v != null && s(v) !== '') ? v : fb,
};

const $if: ExpressionFunction = {
  name: '$if', category: 'Conditional',
  signature: '$if(condition, then, else) → any',
  description: 'If `condition` is truthy, return `then`, otherwise `else`.',
  args: [
    { name: 'condition', type: 'any', required: true, description: 'Condition to test' },
    { name: 'then', type: 'any', required: true, description: 'Value if true' },
    { name: 'else', type: 'any', required: true, description: 'Value if false' },
  ],
  returnType: 'any',
  examples: [{ input: '$if("true", "yes", "no")', output: 'yes' }],
  evaluate: (cond, then, els) => {
    const c = s(cond);
    const truthy = c !== '' && c !== '0' && c !== 'false' && c !== 'null' && c !== 'undefined';
    return truthy ? then : els;
  },
};

const $isEmpty: ExpressionFunction = {
  name: '$isEmpty', category: 'Conditional',
  signature: '$isEmpty(value) → boolean',
  description: 'Return true if value is empty, null, or undefined.',
  args: [{ name: 'value', type: 'any', required: true, description: 'Value to check' }],
  returnType: 'boolean',
  examples: [{ input: '$isEmpty("")', output: 'true' }],
  evaluate: (v) => v == null || s(v) === '' || (Array.isArray(v) && v.length === 0),
};

const $contains: ExpressionFunction = {
  name: '$contains', category: 'Conditional',
  signature: '$contains(haystack, needle) → boolean',
  description: 'Return true if `haystack` contains `needle` (case-sensitive).',
  args: [
    { name: 'haystack', type: 'string', required: true, description: 'String to search in' },
    { name: 'needle', type: 'string', required: true, description: 'String to search for' },
  ],
  returnType: 'boolean',
  examples: [{ input: '$contains("hello world", "world")', output: 'true' }],
  evaluate: (h, needle) => s(h).includes(s(needle)),
};

const $matches: ExpressionFunction = {
  name: '$matches', category: 'Conditional',
  signature: '$matches(value, pattern) → boolean',
  description: 'Return true if `value` matches the regex `pattern`.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to test' },
    { name: 'pattern', type: 'string', required: true, description: 'Regex pattern' },
  ],
  returnType: 'boolean',
  examples: [{ input: '$matches("abc123", "^[a-z]+\\\\d+$")', output: 'true' }],
  evaluate: (v, pattern) => {
    try { return new RegExp(s(pattern)).test(s(v)); }
    catch { return false; }
  },
};

const $not: ExpressionFunction = {
  name: '$not', category: 'Conditional',
  signature: '$not(value) → boolean',
  description: 'Return the logical negation of a value.',
  args: [{ name: 'value', type: 'any', required: true, description: 'Value to negate' }],
  returnType: 'boolean',
  examples: [{ input: '$not("false")', output: 'true' }],
  evaluate: (v) => {
    const c = s(v);
    const truthy = c !== '' && c !== '0' && c !== 'false' && c !== 'null' && c !== 'undefined';
    return !truthy;
  },
};

const $coalesce: ExpressionFunction = {
  name: '$coalesce', category: 'Conditional',
  signature: '$coalesce(a, b, ...) → any',
  description: 'Return the first non-null, non-empty value from the arguments.',
  args: [
    { name: 'a', type: 'any', required: true, description: 'First value' },
    { name: 'b', type: 'any', required: true, description: 'Second value' },
  ],
  returnType: 'any',
  examples: [{ input: '$coalesce("", null, "found")', output: 'found' }],
  evaluate: (...args) => {
    for (const a of args) {
      if (a != null && s(a) !== '') return a;
    }
    return args[args.length - 1] ?? null;
  },
};

const $equals: ExpressionFunction = {
  name: '$equals', category: 'Conditional',
  signature: '$equals(a, b) → boolean',
  description: 'Check whether two values are equal (string comparison).',
  args: [
    { name: 'a', type: 'any', required: true, description: 'First value' },
    { name: 'b', type: 'any', required: true, description: 'Second value' },
  ],
  returnType: 'boolean',
  examples: [{ input: '$equals("hello", "hello")', output: 'true' }],
  evaluate: (a, b) => s(a) === s(b),
};

export const conditionalFunctions: ExpressionFunction[] = [
  $default, $if, $isEmpty, $contains, $matches,
  $not, $coalesce, $equals,
];
