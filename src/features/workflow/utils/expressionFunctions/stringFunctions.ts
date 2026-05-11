import type { ExpressionFunction } from './types';
import { s, n } from './helpers';

const $upper: ExpressionFunction = {
  name: '$upper', category: 'String',
  signature: '$upper(value) → string',
  description: 'Convert text to UPPERCASE.',
  args: [{ name: 'value', type: 'string', required: true, description: 'Text to convert' }],
  returnType: 'string',
  examples: [{ input: '$upper("hello")', output: 'HELLO' }],
  evaluate: (v) => s(v).toUpperCase(),
};

const $lower: ExpressionFunction = {
  name: '$lower', category: 'String',
  signature: '$lower(value) → string',
  description: 'Convert text to lowercase.',
  args: [{ name: 'value', type: 'string', required: true, description: 'Text to convert' }],
  returnType: 'string',
  examples: [{ input: '$lower("HELLO")', output: 'hello' }],
  evaluate: (v) => s(v).toLowerCase(),
};

const $trim: ExpressionFunction = {
  name: '$trim', category: 'String',
  signature: '$trim(value) → string',
  description: 'Remove leading and trailing whitespace.',
  args: [{ name: 'value', type: 'string', required: true, description: 'Text to trim' }],
  returnType: 'string',
  examples: [{ input: '$trim("  hi  ")', output: 'hi' }],
  evaluate: (v) => s(v).trim(),
};

const $length: ExpressionFunction = {
  name: '$length', category: 'String',
  signature: '$length(value) → number',
  description: 'Return the length of a string or array.',
  args: [{ name: 'value', type: 'string | array', required: true, description: 'Value to measure' }],
  returnType: 'number',
  examples: [{ input: '$length("hello")', output: '5' }],
  evaluate: (v) => Array.isArray(v) ? v.length : s(v).length,
};

const $concat: ExpressionFunction = {
  name: '$concat', category: 'String',
  signature: '$concat(a, b, ...) → string',
  description: 'Concatenate two or more values into a single string.',
  args: [
    { name: 'a', type: 'string', required: true, description: 'First value' },
    { name: 'b', type: 'string', required: true, description: 'Second value' },
  ],
  returnType: 'string',
  examples: [{ input: '$concat("hello", " ", "world")', output: 'hello world' }],
  evaluate: (...args) => args.map(s).join(''),
};

const $substring: ExpressionFunction = {
  name: '$substring', category: 'String',
  signature: '$substring(value, start, length?) → string',
  description: 'Extract a substring starting at `start` with optional `length`.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'Source string' },
    { name: 'start', type: 'number', required: true, description: '0-based start index' },
    { name: 'length', type: 'number', required: false, description: 'Number of characters' },
  ],
  returnType: 'string',
  examples: [{ input: '$substring("hello", 1, 3)', output: 'ell' }],
  evaluate: (v, start, len) => len != null ? s(v).substr(n(start), n(len)) : s(v).substr(n(start)),
};

const $replace: ExpressionFunction = {
  name: '$replace', category: 'String',
  signature: '$replace(value, search, replacement) → string',
  description: 'Replace all occurrences of `search` with `replacement`.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'Source string' },
    { name: 'search', type: 'string', required: true, description: 'Text to find' },
    { name: 'replacement', type: 'string', required: true, description: 'Replacement text' },
  ],
  returnType: 'string',
  examples: [{ input: '$replace("hello world", "world", "there")', output: 'hello there' }],
  evaluate: (v, search, rep) => s(v).split(s(search)).join(s(rep)),
};

const $split: ExpressionFunction = {
  name: '$split', category: 'String',
  signature: '$split(value, delimiter) → array',
  description: 'Split a string into an array by delimiter.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to split' },
    { name: 'delimiter', type: 'string', required: true, description: 'Delimiter to split by' },
  ],
  returnType: 'array',
  examples: [{ input: '$split("a,b,c", ",")', output: '["a","b","c"]' }],
  evaluate: (v, delim) => s(v).split(s(delim)),
};

const $join: ExpressionFunction = {
  name: '$join', category: 'String',
  signature: '$join(array, delimiter) → string',
  description: 'Join array elements into a string with delimiter.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Array to join' },
    { name: 'delimiter', type: 'string', required: true, description: 'Delimiter between elements' },
  ],
  returnType: 'string',
  examples: [{ input: '$join(["a","b","c"], "-")', output: 'a-b-c' }],
  evaluate: (v, delim) => {
    const arr = Array.isArray(v) ? v : [v];
    return arr.map(s).join(s(delim));
  },
};

const $startsWith: ExpressionFunction = {
  name: '$startsWith', category: 'String',
  signature: '$startsWith(value, prefix) → boolean',
  description: 'Check whether a string starts with the specified prefix.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to check' },
    { name: 'prefix', type: 'string', required: true, description: 'Prefix to look for' },
  ],
  returnType: 'boolean',
  examples: [{ input: '$startsWith("hello world", "hello")', output: 'true' }],
  evaluate: (v, prefix) => s(v).startsWith(s(prefix)),
};

const $endsWith: ExpressionFunction = {
  name: '$endsWith', category: 'String',
  signature: '$endsWith(value, suffix) → boolean',
  description: 'Check whether a string ends with the specified suffix.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to check' },
    { name: 'suffix', type: 'string', required: true, description: 'Suffix to look for' },
  ],
  returnType: 'boolean',
  examples: [{ input: '$endsWith("hello world", "world")', output: 'true' }],
  evaluate: (v, suffix) => s(v).endsWith(s(suffix)),
};

const $padStart: ExpressionFunction = {
  name: '$padStart', category: 'String',
  signature: '$padStart(value, length, pad?) → string',
  description: 'Pad a string from the start to the target length.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to pad' },
    { name: 'length', type: 'number', required: true, description: 'Target length' },
    { name: 'pad', type: 'string', required: false, description: 'Pad character (default: space)' },
  ],
  returnType: 'string',
  examples: [{ input: '$padStart("42", 5, "0")', output: '00042' }],
  evaluate: (v, len, pad) => s(v).padStart(n(len), pad != null && s(pad) !== '' ? s(pad) : ' '),
};

const $padEnd: ExpressionFunction = {
  name: '$padEnd', category: 'String',
  signature: '$padEnd(value, length, pad?) → string',
  description: 'Pad a string from the end to the target length.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to pad' },
    { name: 'length', type: 'number', required: true, description: 'Target length' },
    { name: 'pad', type: 'string', required: false, description: 'Pad character (default: space)' },
  ],
  returnType: 'string',
  examples: [{ input: '$padEnd("hi", 5, ".")', output: 'hi...' }],
  evaluate: (v, len, pad) => s(v).padEnd(n(len), pad != null && s(pad) !== '' ? s(pad) : ' '),
};

const $repeat: ExpressionFunction = {
  name: '$repeat', category: 'String',
  signature: '$repeat(value, count) → string',
  description: 'Repeat a string the specified number of times.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to repeat' },
    { name: 'count', type: 'number', required: true, description: 'Number of repetitions' },
  ],
  returnType: 'string',
  examples: [{ input: '$repeat("ab", 3)', output: 'ababab' }],
  evaluate: (v, count) => { const c = Math.max(0, Math.floor(n(count))); return s(v).repeat(c); },
};

const $indexOf: ExpressionFunction = {
  name: '$indexOf', category: 'String',
  signature: '$indexOf(value, search) → number',
  description: 'Return the first index of `search` in `value`, or -1 if not found.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to search in' },
    { name: 'search', type: 'string', required: true, description: 'Substring to find' },
  ],
  returnType: 'number',
  examples: [{ input: '$indexOf("hello world", "world")', output: '6' }],
  evaluate: (v, search) => s(v).indexOf(s(search)),
};

const $toString: ExpressionFunction = {
  name: '$toString', category: 'String',
  signature: '$toString(value)',
  description: 'Convert any value to its string representation.',
  args: [{ name: 'value', type: 'any', required: true, description: 'Value to convert' }],
  returnType: 'string',
  examples: [{ input: '$toString(42)', output: '"42"' }, { input: '$toString(true)', output: '"true"' }],
  evaluate: (v) => String(v ?? ''),
};

export const stringFunctions: ExpressionFunction[] = [
  $upper, $lower, $trim, $length, $concat, $substring, $replace, $split, $join,
  $startsWith, $endsWith, $padStart, $padEnd, $repeat, $indexOf, $toString,
];
