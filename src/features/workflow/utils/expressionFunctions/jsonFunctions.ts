import type { ExpressionFunction } from './types';
import { s, n } from './helpers';

const $jsonpath: ExpressionFunction = {
  name: '$jsonpath', category: 'JSON',
  signature: '$jsonpath(object, path) → any',
  description: 'Extract a value using a simple dot-path (e.g. "data.items.0.name").',
  args: [
    { name: 'object', type: 'object | string', required: true, description: 'Object or JSON string' },
    { name: 'path', type: 'string', required: true, description: 'Dot-separated path' },
  ],
  returnType: 'any',
  examples: [{ input: '$jsonpath(\'{"a":{"b":1}}\', "a.b")', output: '1' }],
  evaluate: (v, path) => {
    let obj: unknown = typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v;
    if (obj == null) return null;
    for (const seg of s(path).split('.')) {
      if (obj == null || typeof obj !== 'object') return null;
      obj = (obj as Record<string, unknown>)[seg];
    }
    return obj;
  },
};

const $parse: ExpressionFunction = {
  name: '$parse', category: 'JSON',
  signature: '$parse(jsonString) → any',
  description: 'Parse a JSON string into an object.',
  args: [{ name: 'jsonString', type: 'string', required: true, description: 'JSON string to parse' }],
  returnType: 'any',
  examples: [{ input: '$parse(\'{"a":1}\')', output: '{"a":1}' }],
  evaluate: (v) => { try { return JSON.parse(s(v)); } catch { return null; } },
};

const $stringify: ExpressionFunction = {
  name: '$stringify', category: 'JSON',
  signature: '$stringify(value) → string',
  description: 'Serialize a value to a JSON string.',
  args: [{ name: 'value', type: 'any', required: true, description: 'Value to serialize' }],
  returnType: 'string',
  examples: [{ input: '$stringify({"a":1})', output: '{"a":1}' }],
  evaluate: (v) => { try { return JSON.stringify(v); } catch { return s(v); } },
};

const $keys: ExpressionFunction = {
  name: '$keys', category: 'JSON',
  signature: '$keys(object) → array',
  description: 'Return an array of keys from an object or parsed JSON string.',
  args: [{ name: 'object', type: 'object | string', required: true, description: 'Object or JSON string' }],
  returnType: 'array',
  examples: [{ input: '$keys(\'{"a":1,"b":2}\')', output: '["a","b"]' }],
  evaluate: (v) => {
    const obj = typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v;
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : [];
  },
};

const $values: ExpressionFunction = {
  name: '$values', category: 'JSON',
  signature: '$values(object) → array',
  description: 'Return an array of values from an object or parsed JSON string.',
  args: [{ name: 'object', type: 'object | string', required: true, description: 'Object or JSON string' }],
  returnType: 'array',
  examples: [{ input: '$values(\'{"a":1,"b":2}\')', output: '[1,2]' }],
  evaluate: (v) => {
    const obj = typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v;
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.values(obj) : [];
  },
};

const $count: ExpressionFunction = {
  name: '$count', category: 'JSON',
  signature: '$count(arrayOrString) → number',
  description: 'Return element count for arrays, or character count for strings.',
  args: [{ name: 'arrayOrString', type: 'array | string', required: true, description: 'Array or string' }],
  returnType: 'number',
  examples: [{ input: '$count([1,2,3])', output: '3' }],
  evaluate: (v) => {
    if (Array.isArray(v)) return v.length;
    const sv = s(v);
    if (sv.startsWith('[')) { try { return JSON.parse(sv).length; } catch { /* fall through */ } }
    return sv.length;
  },
};

const $flatten: ExpressionFunction = {
  name: '$flatten', category: 'JSON',
  signature: '$flatten(array) → array',
  description: 'Flatten a nested array by one level.',
  args: [{ name: 'array', type: 'array', required: true, description: 'Array to flatten' }],
  returnType: 'array',
  examples: [{ input: '$flatten([[1,2],[3,4]])', output: '[1,2,3,4]' }],
  evaluate: (v) => {
    const arr = Array.isArray(v) ? v : (() => { try { return JSON.parse(s(v)); } catch { return []; } })();
    return Array.isArray(arr) ? arr.flat() : [];
  },
};

const $merge: ExpressionFunction = {
  name: '$merge', category: 'JSON',
  signature: '$merge(a, b) → object',
  description: 'Shallow-merge two objects (or JSON strings). Properties in `b` override `a`.',
  args: [
    { name: 'a', type: 'object | string', required: true, description: 'Base object' },
    { name: 'b', type: 'object | string', required: true, description: 'Override object' },
  ],
  returnType: 'object',
  examples: [{ input: '$merge(\'{"a":1}\', \'{"b":2}\')', output: '{"a":1,"b":2}' }],
  evaluate: (a, b) => {
    const parseObj = (v: unknown) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
      try { const p = JSON.parse(s(v)); return typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch { return {}; }
    };
    return { ...parseObj(a), ...parseObj(b) };
  },
};

const $type: ExpressionFunction = {
  name: '$type', category: 'JSON',
  signature: '$type(value) → string',
  description: 'Return the type of a value: "string", "number", "boolean", "array", "object", or "null".',
  args: [{ name: 'value', type: 'any', required: true, description: 'Value to inspect' }],
  returnType: 'string',
  examples: [{ input: '$type(42)', output: 'number' }],
  evaluate: (v) => {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  },
};

const $sort: ExpressionFunction = {
  name: '$sort', category: 'JSON',
  signature: '$sort(array) → array',
  description: 'Sort an array in ascending order.',
  args: [{ name: 'array', type: 'array', required: true, description: 'Array to sort' }],
  returnType: 'array',
  examples: [{ input: '$sort([3,1,2])', output: '[1,2,3]' }],
  evaluate: (v) => {
    const arr = Array.isArray(v) ? [...v] : (() => { try { return JSON.parse(s(v)); } catch { return []; } })();
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => {
      const sa = String(a), sb = String(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  },
};

const $reverse: ExpressionFunction = {
  name: '$reverse', category: 'JSON',
  signature: '$reverse(array) → array',
  description: 'Reverse the order of items in an array.',
  args: [{ name: 'array', type: 'array', required: true, description: 'Array to reverse' }],
  returnType: 'array',
  examples: [{ input: '$reverse([1,2,3])', output: '[3,2,1]' }],
  evaluate: (v) => {
    const arr = Array.isArray(v) ? [...v] : (() => { try { return JSON.parse(s(v)); } catch { return []; } })();
    if (!Array.isArray(arr)) return [];
    return arr.reverse();
  },
};

const $unique: ExpressionFunction = {
  name: '$unique', category: 'JSON',
  signature: '$unique(array) → array',
  description: 'Remove duplicate values from an array.',
  args: [{ name: 'array', type: 'array', required: true, description: 'Array to deduplicate' }],
  returnType: 'array',
  examples: [{ input: '$unique([1,2,2,3,3])', output: '[1,2,3]' }],
  evaluate: (v) => {
    const arr = Array.isArray(v) ? v : (() => { try { return JSON.parse(s(v)); } catch { return []; } })();
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(x => JSON.stringify(x)))].map(x => { try { return JSON.parse(x); } catch { return x; } });
  },
};

const $first: ExpressionFunction = {
  name: '$first', category: 'JSON',
  signature: '$first(array) → any',
  description: 'Return the first item from an array or the first character of a string.',
  args: [{ name: 'array', type: 'array | string', required: true, description: 'Array or string' }],
  returnType: 'any',
  examples: [{ input: '$first([10,20,30])', output: '10' }],
  evaluate: (v) => {
    if (Array.isArray(v)) return v[0] ?? null;
    const sv = s(v);
    if (sv.startsWith('[')) { try { const arr = JSON.parse(sv); return Array.isArray(arr) ? arr[0] ?? null : sv[0] ?? ''; } catch { /* fall through */ } }
    return sv[0] ?? '';
  },
};

const $last: ExpressionFunction = {
  name: '$last', category: 'JSON',
  signature: '$last(array) → any',
  description: 'Return the last item from an array or the last character of a string.',
  args: [{ name: 'array', type: 'array | string', required: true, description: 'Array or string' }],
  returnType: 'any',
  examples: [{ input: '$last([10,20,30])', output: '30' }],
  evaluate: (v) => {
    if (Array.isArray(v)) return v[v.length - 1] ?? null;
    const sv = s(v);
    if (sv.startsWith('[')) { try { const arr = JSON.parse(sv); return Array.isArray(arr) ? arr[arr.length - 1] ?? null : sv[sv.length - 1] ?? ''; } catch { /* fall through */ } }
    return sv[sv.length - 1] ?? '';
  },
};

const $slice: ExpressionFunction = {
  name: '$slice', category: 'JSON',
  signature: '$slice(array, start, end?) → array',
  description: 'Return a portion of an array from `start` to `end` (exclusive).',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Array to slice' },
    { name: 'start', type: 'number', required: true, description: 'Start index' },
    { name: 'end', type: 'number', required: false, description: 'End index (exclusive)' },
  ],
  returnType: 'array',
  examples: [{ input: '$slice([1,2,3,4,5], 1, 3)', output: '[2,3]' }],
  evaluate: (v, start, end) => {
    const arr = Array.isArray(v) ? v : (() => { try { return JSON.parse(s(v)); } catch { return []; } })();
    if (!Array.isArray(arr)) return [];
    return end != null ? arr.slice(n(start), n(end)) : arr.slice(n(start));
  },
};

export const jsonFunctions: ExpressionFunction[] = [
  $jsonpath, $parse, $stringify, $keys, $values, $count, $flatten,
  $merge, $type, $sort, $reverse, $unique, $first, $last, $slice,
];
