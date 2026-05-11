import type { ExpressionFunction } from './types';
import { n } from './helpers';

const $add: ExpressionFunction = {
  name: '$add', category: 'Math',
  signature: '$add(a, b) → number',
  description: 'Add two numbers.',
  args: [
    { name: 'a', type: 'number', required: true, description: 'First number' },
    { name: 'b', type: 'number', required: true, description: 'Second number' },
  ],
  returnType: 'number',
  examples: [{ input: '$add(10, 5)', output: '15' }],
  evaluate: (a, b) => n(a) + n(b),
};

const $subtract: ExpressionFunction = {
  name: '$subtract', category: 'Math',
  signature: '$subtract(a, b) → number',
  description: 'Subtract b from a.',
  args: [
    { name: 'a', type: 'number', required: true, description: 'Number to subtract from' },
    { name: 'b', type: 'number', required: true, description: 'Number to subtract' },
  ],
  returnType: 'number',
  examples: [{ input: '$subtract(10, 3)', output: '7' }],
  evaluate: (a, b) => n(a) - n(b),
};

const $multiply: ExpressionFunction = {
  name: '$multiply', category: 'Math',
  signature: '$multiply(a, b) → number',
  description: 'Multiply two numbers.',
  args: [
    { name: 'a', type: 'number', required: true, description: 'First number' },
    { name: 'b', type: 'number', required: true, description: 'Second number' },
  ],
  returnType: 'number',
  examples: [{ input: '$multiply(4, 3)', output: '12' }],
  evaluate: (a, b) => n(a) * n(b),
};

const $divide: ExpressionFunction = {
  name: '$divide', category: 'Math',
  signature: '$divide(a, b) → number',
  description: 'Divide a by b. Returns 0 if b is 0.',
  args: [
    { name: 'a', type: 'number', required: true, description: 'Dividend' },
    { name: 'b', type: 'number', required: true, description: 'Divisor' },
  ],
  returnType: 'number',
  examples: [{ input: '$divide(10, 3)', output: '3.3333333333333335' }],
  evaluate: (a, b) => { const d = n(b); return d === 0 ? 0 : n(a) / d; },
};

const $round: ExpressionFunction = {
  name: '$round', category: 'Math',
  signature: '$round(value, decimals?) → number',
  description: 'Round a number to the specified decimal places (default 0).',
  args: [
    { name: 'value', type: 'number', required: true, description: 'Number to round' },
    { name: 'decimals', type: 'number', required: false, description: 'Decimal places (default 0)' },
  ],
  returnType: 'number',
  examples: [{ input: '$round(3.14159, 2)', output: '3.14' }],
  evaluate: (v, dec) => {
    const d = dec != null ? n(dec) : 0;
    const factor = Math.pow(10, d);
    return Math.round(n(v) * factor) / factor;
  },
};

const $abs: ExpressionFunction = {
  name: '$abs', category: 'Math',
  signature: '$abs(value) → number',
  description: 'Return the absolute value.',
  args: [{ name: 'value', type: 'number', required: true, description: 'Number' }],
  returnType: 'number',
  examples: [{ input: '$abs(-5)', output: '5' }],
  evaluate: (v) => Math.abs(n(v)),
};

const $min: ExpressionFunction = {
  name: '$min', category: 'Math',
  signature: '$min(a, b) → number',
  description: 'Return the smaller of two numbers.',
  args: [
    { name: 'a', type: 'number', required: true, description: 'First number' },
    { name: 'b', type: 'number', required: true, description: 'Second number' },
  ],
  returnType: 'number',
  examples: [{ input: '$min(3, 7)', output: '3' }],
  evaluate: (a, b) => Math.min(n(a), n(b)),
};

const $max: ExpressionFunction = {
  name: '$max', category: 'Math',
  signature: '$max(a, b) → number',
  description: 'Return the larger of two numbers.',
  args: [
    { name: 'a', type: 'number', required: true, description: 'First number' },
    { name: 'b', type: 'number', required: true, description: 'Second number' },
  ],
  returnType: 'number',
  examples: [{ input: '$max(3, 7)', output: '7' }],
  evaluate: (a, b) => Math.max(n(a), n(b)),
};

const $mod: ExpressionFunction = {
  name: '$mod', category: 'Math',
  signature: '$mod(a, b) → number',
  description: 'Return the remainder from dividing a by b.',
  args: [
    { name: 'a', type: 'number', required: true, description: 'Dividend' },
    { name: 'b', type: 'number', required: true, description: 'Divisor' },
  ],
  returnType: 'number',
  examples: [{ input: '$mod(10, 3)', output: '1' }],
  evaluate: (a, b) => { const d = n(b); return d === 0 ? 0 : n(a) % d; },
};

const $floor: ExpressionFunction = {
  name: '$floor', category: 'Math',
  signature: '$floor(value) → number',
  description: 'Round a number down to the nearest integer.',
  args: [{ name: 'value', type: 'number', required: true, description: 'Number to round down' }],
  returnType: 'number',
  examples: [{ input: '$floor(3.7)', output: '3' }],
  evaluate: (v) => Math.floor(n(v)),
};

const $ceil: ExpressionFunction = {
  name: '$ceil', category: 'Math',
  signature: '$ceil(value) → number',
  description: 'Round a number up to the nearest integer.',
  args: [{ name: 'value', type: 'number', required: true, description: 'Number to round up' }],
  returnType: 'number',
  examples: [{ input: '$ceil(3.2)', output: '4' }],
  evaluate: (v) => Math.ceil(n(v)),
};

const $power: ExpressionFunction = {
  name: '$power', category: 'Math',
  signature: '$power(base, exponent) → number',
  description: 'Raise base to the power of exponent.',
  args: [
    { name: 'base', type: 'number', required: true, description: 'Base number' },
    { name: 'exponent', type: 'number', required: true, description: 'Exponent' },
  ],
  returnType: 'number',
  examples: [{ input: '$power(2, 10)', output: '1024' }],
  evaluate: (base, exp) => Math.pow(n(base), n(exp)),
};

const $random: ExpressionFunction = {
  name: '$random', category: 'Math',
  signature: '$random(min?, max?) → number',
  description: 'Return a random integer. Default range: 0–999999.',
  args: [
    { name: 'min', type: 'number', required: false, description: 'Minimum value (default 0)' },
    { name: 'max', type: 'number', required: false, description: 'Maximum value (default 999999)' },
  ],
  returnType: 'number',
  examples: [{ input: '$random(1, 100)', output: '42' }],
  evaluate: (min, max) => {
    let lo = min != null ? n(min) : 0;
    let hi = max != null ? n(max) : 999999;
    if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  },
};

const $parseInt: ExpressionFunction = {
  name: '$parseInt', category: 'Math',
  signature: '$parseInt(value)',
  description: 'Parse a string to an integer. Returns 0 if not parseable.',
  args: [{ name: 'value', type: 'any', required: true, description: 'Value to parse' }],
  returnType: 'number',
  examples: [{ input: '$parseInt("42")', output: '42' }, { input: '$parseInt("3.14")', output: '3' }],
  evaluate: (v) => { const r = parseInt(String(v), 10); return Number.isNaN(r) ? 0 : r; },
};

const $toInt: ExpressionFunction = {
  name: '$toInt', category: 'Math',
  signature: '$toInt(value)',
  description: 'Convert a value to an integer. Handles booleans ("true"→1, "false"→0) and numeric strings.',
  args: [{ name: 'value', type: 'any', required: true, description: 'Value to convert' }],
  returnType: 'number',
  examples: [{ input: '$toInt(true)', output: '1' }, { input: '$toInt("7")', output: '7' }],
  evaluate: (v) => {
    if (typeof v === 'boolean') return v ? 1 : 0;
    const str = String(v).toLowerCase().trim();
    if (str === 'true') return 1;
    if (str === 'false') return 0;
    const r = parseInt(str, 10);
    return Number.isNaN(r) ? 0 : r;
  },
};

const $parseFloat: ExpressionFunction = {
  name: '$parseFloat', category: 'Math',
  signature: '$parseFloat(value)',
  description: 'Parse a string to a floating-point number.',
  args: [{ name: 'value', type: 'any', required: true, description: 'Value to parse' }],
  returnType: 'number',
  examples: [{ input: '$parseFloat("3.14")', output: '3.14' }],
  evaluate: (v) => { const r = parseFloat(String(v)); return Number.isNaN(r) ? 0 : r; },
};

export const mathFunctions: ExpressionFunction[] = [
  $add, $subtract, $multiply, $divide, $round, $abs, $min, $max,
  $mod, $floor, $ceil, $power, $random, $parseInt, $toInt, $parseFloat,
];
