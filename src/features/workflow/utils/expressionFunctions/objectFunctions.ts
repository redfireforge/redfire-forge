import type { ExpressionFunction } from './types';
import { s } from './helpers';
import { isLambda, applyLambda, type LambdaValue } from '../lambdaUtils';

function asObj(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string' && v.startsWith('{')) {
    try {
      const parsed = JSON.parse(v);
      if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }
  return {};
}

const $has: ExpressionFunction = {
  name: '$has', category: 'Object',
  signature: '$has(obj, key) → boolean',
  description: 'Check if an object has a specific key.',
  args: [
    { name: 'obj', type: 'object', required: true, description: 'Object to check' },
    { name: 'key', type: 'string', required: true, description: 'Key to look for' },
  ],
  returnType: 'boolean',
  examples: [{ input: '$has({name:"Alice"}, "name")', output: 'true' }],
  evaluate: (obj, key) => {
    const o = asObj(obj);
    return Object.prototype.hasOwnProperty.call(o, s(key));
  },
};

const $toEntries: ExpressionFunction = {
  name: '$toEntries', category: 'Object',
  signature: '$toEntries(obj) → array',
  description: 'Convert an object to an array of {key, value} pairs.',
  args: [{ name: 'obj', type: 'object', required: true, description: 'Object to convert' }],
  returnType: 'array',
  examples: [{ input: '$toEntries({a:1, b:2})', output: '[{key:"a",value:1},{key:"b",value:2}]' }],
  evaluate: (obj) => {
    const o = asObj(obj);
    return Object.entries(o).map(([key, value]) => ({ key, value }));
  },
};

const $fromEntries: ExpressionFunction = {
  name: '$fromEntries', category: 'Object',
  signature: '$fromEntries(array) → object',
  description: 'Convert an array of {key, value} pairs to an object.',
  args: [{ name: 'array', type: 'array', required: true, description: 'Array of {key, value} objects' }],
  returnType: 'object',
  examples: [{ input: '$fromEntries([{key:"a",value:1},{key:"b",value:2}])', output: '{a:1,b:2}' }],
  evaluate: (arr) => {
    if (!Array.isArray(arr)) return {};
    const result: Record<string, unknown> = {};
    for (const entry of arr) {
      if (entry != null && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        const key = e.key != null ? s(e.key) : undefined;
        if (key !== undefined) result[key] = e.value;
      }
    }
    return result;
  },
};

const $pick: ExpressionFunction = {
  name: '$pick', category: 'Object',
  signature: '$pick(obj, keys) → object',
  description: 'Return a new object containing only the specified keys (comma-separated).',
  args: [
    { name: 'obj', type: 'object', required: true, description: 'Source object' },
    { name: 'keys', type: 'string', required: true, description: 'Comma-separated list of keys to keep' },
  ],
  returnType: 'object',
  examples: [{ input: '$pick({a:1, b:2, c:3}, "a,c")', output: '{a:1,c:3}' }],
  evaluate: (obj, keys) => {
    const o = asObj(obj);
    const keyList = s(keys).split(',').map(k => k.trim()).filter(Boolean);
    const result: Record<string, unknown> = {};
    for (const key of keyList) {
      if (Object.prototype.hasOwnProperty.call(o, key)) result[key] = o[key];
    }
    return result;
  },
};

const $omit: ExpressionFunction = {
  name: '$omit', category: 'Object',
  signature: '$omit(obj, keys) → object',
  description: 'Return a new object excluding the specified keys (comma-separated).',
  args: [
    { name: 'obj', type: 'object', required: true, description: 'Source object' },
    { name: 'keys', type: 'string', required: true, description: 'Comma-separated list of keys to exclude' },
  ],
  returnType: 'object',
  examples: [{ input: '$omit({a:1, b:2, c:3}, "b")', output: '{a:1,c:3}' }],
  evaluate: (obj, keys) => {
    const o = asObj(obj);
    const keySet = new Set(s(keys).split(',').map(k => k.trim()).filter(Boolean));
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(o)) {
      if (!keySet.has(key)) result[key] = value;
    }
    return result;
  },
};

const $mapValues: ExpressionFunction = {
  name: '$mapValues', category: 'Object',
  signature: '$mapValues(object, fn) → object',
  description: 'Apply a function to each value in an object, returning new object with same keys.',
  args: [
    { name: 'object', type: 'object', required: true, description: 'Input object' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: (value, key) => newValue' },
  ],
  returnType: 'object',
  examples: [
    { input: '$mapValues({a:1, b:2}, v => $multiply(v, 10))', output: '{"a":10,"b":20}' },
  ],
  evaluate: (obj, fn) => {
    const o = asObj(obj);
    if (!isLambda(fn)) return o;
    const lambda = fn as LambdaValue;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      result[k] = applyLambda(lambda, [v, k]);
    }
    return result;
  },
};

const $mapKeys: ExpressionFunction = {
  name: '$mapKeys', category: 'Object',
  signature: '$mapKeys(object, fn) → object',
  description: 'Apply a function to each key in an object, returning new object with transformed keys.',
  args: [
    { name: 'object', type: 'object', required: true, description: 'Input object' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: (key, value) => newKey' },
  ],
  returnType: 'object',
  examples: [
    { input: '$mapKeys({name:"Alice"}, k => $upper(k))', output: '{"NAME":"Alice"}' },
  ],
  evaluate: (obj, fn) => {
    const o = asObj(obj);
    if (!isLambda(fn)) return o;
    const lambda = fn as LambdaValue;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const newKey = s(applyLambda(lambda, [k, v]));
      result[newKey] = v;
    }
    return result;
  },
};

const $withEntries: ExpressionFunction = {
  name: '$withEntries', category: 'Object',
  signature: '$withEntries(object, fn) → object',
  description: 'Transform each {key, value} entry of an object via the function.',
  args: [
    { name: 'object', type: 'object', required: true, description: 'Input object' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: entry => {key, value}' },
  ],
  returnType: 'object',
  examples: [
    { input: '$withEntries({a:1}, e => e)', output: '{"a":1}' },
  ],
  evaluate: (obj, fn) => {
    const o = asObj(obj);
    if (!isLambda(fn)) return o;
    const lambda = fn as LambdaValue;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const entry = applyLambda(lambda, [{ key: k, value: v }]);
      if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
        const e = entry as Record<string, unknown>;
        const newKey = s(e.key ?? k);
        result[newKey] = e.value ?? v;
      } else {
        result[k] = v;
      }
    }
    return result;
  },
};

export const objectFunctions: ExpressionFunction[] = [
  $has, $toEntries, $fromEntries, $pick, $omit,
  $mapValues, $mapKeys, $withEntries,
];
