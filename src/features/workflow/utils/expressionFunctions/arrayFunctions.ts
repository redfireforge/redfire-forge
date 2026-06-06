import type { ExpressionFunction } from './types';
import { n, s } from './helpers';
import { isLambda, applyLambda, getNestedValue, type LambdaValue } from '../lambdaUtils';

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === 'string' && v.startsWith('[')) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }
  return [v];
}

function stringify(v: unknown): string {
  if (v == null) return String(v);
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, (_k, val) =>
        typeof val === 'bigint' ? `__bigint__${val.toString()}` : val,
      );
    } catch { return String(v); }
  }
  if (typeof v === 'bigint') return v.toString();
  return String(v);
}

function compareValues(actual: unknown, operator: string, expected: unknown): boolean {
  const numA = Number(actual);
  const numE = Number(expected);
  const hasNums = !isNaN(numA) && !isNaN(numE) && actual !== '' && expected !== '';

  switch (operator) {
    case '=': case '==': case 'equals':
      return stringify(actual) === stringify(expected);
    case '!=': case '<>': case 'not_equals':
      return stringify(actual) !== stringify(expected);
    case '>': return hasNums && numA > numE;
    case '>=': return hasNums && numA >= numE;
    case '<': return hasNums && numA < numE;
    case '<=': return hasNums && numA <= numE;
    case 'contains':
      return s(actual).includes(s(expected));
    case 'starts_with':
      return s(actual).startsWith(s(expected));
    case 'ends_with':
      return s(actual).endsWith(s(expected));
    default: return false;
  }
}

const $sum: ExpressionFunction = {
  name: '$sum', category: 'Array',
  signature: '$sum(array) → number',
  description: 'Sum all numeric elements in an array.',
  args: [{ name: 'array', type: 'array', required: true, description: 'Array of numbers to sum' }],
  returnType: 'number',
  examples: [
    { input: '$sum([1, 2, 3, 4])', output: '10' },
    { input: '$sum([])', output: '0' },
  ],
  evaluate: (arr) => {
    const items = asArray(arr);
    return items.reduce<number>((acc, v) => acc + n(v), 0);
  },
};

const $average: ExpressionFunction = {
  name: '$average', category: 'Array',
  signature: '$average(array) → number',
  description: 'Calculate the arithmetic mean of numeric array elements.',
  args: [{ name: 'array', type: 'array', required: true, description: 'Array of numbers' }],
  returnType: 'number',
  examples: [
    { input: '$average([10, 20, 30])', output: '20' },
    { input: '$average([])', output: '0' },
  ],
  evaluate: (arr) => {
    const items = asArray(arr);
    if (items.length === 0) return 0;
    const sum = items.reduce<number>((acc, v) => acc + n(v), 0);
    return sum / items.length;
  },
};

const $groupBy: ExpressionFunction = {
  name: '$groupBy', category: 'Array',
  signature: '$groupBy(array, key) → object',
  description: 'Group array elements by a key field, returning an object of arrays.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Array of objects' },
    { name: 'key', type: 'string', required: true, description: 'Key path to group by' },
  ],
  returnType: 'object',
  examples: [
    { input: '$groupBy([{status:"active"},{status:"inactive"},{status:"active"}], "status")', output: '{"active":[...],"inactive":[...]}' },
  ],
  evaluate: (arr, key) => {
    const items = asArray(arr);
    const keyPath = s(key);
    const result: Record<string, unknown[]> = {};
    for (const item of items) {
      const groupKey = s(getNestedValue(item, keyPath));
      if (!result[groupKey]) result[groupKey] = [];
      result[groupKey].push(item);
    }
    return result;
  },
};

const $any: ExpressionFunction = {
  name: '$any', category: 'Array',
  signature: '$any(array, field, operator, value) or $any(array, fn) → boolean',
  description: 'Return true if any array element matches the condition. Supports both 4-arg form (field, operator, value) and lambda form (fn).',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Array of objects' },
    { name: 'field/fn', type: 'string|function', required: true, description: 'Field path to test, or lambda: element => boolean' },
    { name: 'operator', type: 'string', required: false, description: 'Comparison operator (=, !=, >, >=, <, <=, contains)' },
    { name: 'value', type: 'any', required: false, description: 'Value to compare against' },
  ],
  returnType: 'boolean',
  examples: [
    { input: '$any([{rank:3},{rank:7}], "rank", ">", 5)', output: 'true' },
    { input: '$any([{rank:3},{rank:7}], x => $gt(x.rank, 5))', output: 'true' },
  ],
  evaluate: (arr, field, operator, value) => {
    const items = asArray(arr);
    if (isLambda(field)) {
      const lambda = field as LambdaValue;
      return items.some((item, idx) => !!applyLambda(lambda, [item, idx]));
    }
    const fieldPath = s(field);
    const op = s(operator);
    return items.some(item => compareValues(getNestedValue(item, fieldPath), op, value));
  },
};

const $all: ExpressionFunction = {
  name: '$all', category: 'Array',
  signature: '$all(array, field, operator, value) or $all(array, fn) → boolean',
  description: 'Return true if all array elements match the condition. Supports both 4-arg form (field, operator, value) and lambda form (fn).',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Array of objects' },
    { name: 'field/fn', type: 'string|function', required: true, description: 'Field path to test, or lambda: element => boolean' },
    { name: 'operator', type: 'string', required: false, description: 'Comparison operator (=, !=, >, >=, <, <=, contains)' },
    { name: 'value', type: 'any', required: false, description: 'Value to compare against' },
  ],
  returnType: 'boolean',
  examples: [
    { input: '$all([{rank:7},{rank:9}], "rank", ">", 5)', output: 'true' },
    { input: '$all([{rank:7},{rank:9}], x => $gt(x.rank, 5))', output: 'true' },
  ],
  evaluate: (arr, field, operator, value) => {
    const items = asArray(arr);
    if (items.length === 0) return true;
    if (isLambda(field)) {
      const lambda = field as LambdaValue;
      return items.every((item, idx) => !!applyLambda(lambda, [item, idx]));
    }
    const fieldPath = s(field);
    const op = s(operator);
    return items.every(item => compareValues(getNestedValue(item, fieldPath), op, value));
  },
};

const $map: ExpressionFunction = {
  name: '$map', category: 'Array',
  signature: '$map(array, fn) → array',
  description: 'Apply a function to each element of an array and return the results.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: element => result' },
  ],
  returnType: 'array',
  examples: [
    { input: '$map(["hello","world"], x => $upper(x))', output: '["HELLO","WORLD"]' },
    { input: '$map([{name:"Alice"},{name:"Bob"}], u => u.name)', output: '["Alice","Bob"]' },
  ],
  evaluate: (arr, fn) => {
    const items = asArray(arr);
    if (!isLambda(fn)) return items;
    return items.map((item, idx) => applyLambda(fn as LambdaValue, [item, idx]));
  },
};

const $filter: ExpressionFunction = {
  name: '$filter', category: 'Array',
  signature: '$filter(array, fn) → array',
  description: 'Return elements where the predicate function returns truthy.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: element => boolean' },
  ],
  returnType: 'array',
  examples: [
    { input: '$filter([1,2,3,4,5], x => $gt(x, 3))', output: '[4,5]' },
  ],
  evaluate: (arr, fn) => {
    const items = asArray(arr);
    if (!isLambda(fn)) return items;
    return items.filter((item, idx) => {
      const result = applyLambda(fn as LambdaValue, [item, idx]);
      return !!result;
    });
  },
};

const $reduce: ExpressionFunction = {
  name: '$reduce', category: 'Array',
  signature: '$reduce(array, fn, initial?) → any',
  description: 'Reduce an array to a single value by applying fn(accumulator, element) for each element.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: (acc, element) => newAcc' },
    { name: 'initial', type: 'any', required: false, description: 'Initial accumulator value (default: first element)' },
  ],
  returnType: 'any',
  examples: [
    { input: '$reduce([1,2,3,4], (acc, x) => $add(acc, x), 0)', output: '10' },
  ],
  evaluate: (arr, fn, initial) => {
    const items = asArray(arr);
    if (!isLambda(fn) || items.length === 0) return initial ?? null;
    const lambda = fn as LambdaValue;
    let acc: unknown = initial !== undefined ? initial : items[0];
    const startIdx = initial !== undefined ? 0 : 1;
    for (let i = startIdx; i < items.length; i++) {
      acc = applyLambda(lambda, [acc, items[i], i]);
    }
    return acc;
  },
};

const $sortBy: ExpressionFunction = {
  name: '$sortBy', category: 'Array',
  signature: '$sortBy(array, fn) → array',
  description: 'Sort array elements by a key extracted via the function.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: element => sortKey' },
  ],
  returnType: 'array',
  examples: [
    { input: '$sortBy([{n:3},{n:1},{n:2}], x => x.n)', output: '[{n:1},{n:2},{n:3}]' },
  ],
  evaluate: (arr, fn) => {
    const items = [...asArray(arr)];
    if (!isLambda(fn)) return items;
    const lambda = fn as LambdaValue;
    return items.sort((a, b) => {
      const ka = applyLambda(lambda, [a]);
      const kb = applyLambda(lambda, [b]);
      if (ka == null && kb == null) return 0;
      if (ka == null) return -1;
      if (kb == null) return 1;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  },
};

const $minBy: ExpressionFunction = {
  name: '$minBy', category: 'Array',
  signature: '$minBy(array, fn) → any',
  description: 'Return the element with the minimum key extracted via the function.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: element => numericKey' },
  ],
  returnType: 'any',
  examples: [
    { input: '$minBy([{n:3},{n:1},{n:2}], x => x.n)', output: '{n:1}' },
  ],
  evaluate: (arr, fn) => {
    const items = asArray(arr);
    if (items.length === 0 || !isLambda(fn)) return null;
    const lambda = fn as LambdaValue;
    let minItem = items[0];
    let minKey: unknown = applyLambda(lambda, [items[0]]);
    for (let i = 1; i < items.length; i++) {
      const key: unknown = applyLambda(lambda, [items[i]]);
      if (key != null && (minKey == null || key < minKey)) { minKey = key; minItem = items[i]; }
    }
    return minItem;
  },
};

const $maxBy: ExpressionFunction = {
  name: '$maxBy', category: 'Array',
  signature: '$maxBy(array, fn) → any',
  description: 'Return the element with the maximum key extracted via the function.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: element => numericKey' },
  ],
  returnType: 'any',
  examples: [
    { input: '$maxBy([{n:3},{n:1},{n:2}], x => x.n)', output: '{n:3}' },
  ],
  evaluate: (arr, fn) => {
    const items = asArray(arr);
    if (items.length === 0 || !isLambda(fn)) return null;
    const lambda = fn as LambdaValue;
    let maxItem = items[0];
    let maxKey: unknown = applyLambda(lambda, [items[0]]);
    for (let i = 1; i < items.length; i++) {
      const key: unknown = applyLambda(lambda, [items[i]]);
      if (key != null && (maxKey == null || key > maxKey)) { maxKey = key; maxItem = items[i]; }
    }
    return maxItem;
  },
};

const $distinctBy: ExpressionFunction = {
  name: '$distinctBy', category: 'Array',
  signature: '$distinctBy(array, fn) → array',
  description: 'Deduplicate array elements by a key extracted via the function.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: element => deduplicationKey' },
  ],
  returnType: 'array',
  examples: [
    { input: '$distinctBy([{id:1,n:"a"},{id:2,n:"b"},{id:1,n:"c"}], x => x.id)', output: '[{id:1,n:"a"},{id:2,n:"b"}]' },
  ],
  evaluate: (arr, fn) => {
    const items = asArray(arr);
    if (!isLambda(fn)) return items;
    const lambda = fn as LambdaValue;
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = s(applyLambda(lambda, [item]));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
};

const $zip: ExpressionFunction = {
  name: '$zip', category: 'Array',
  signature: '$zip(array1, array2, fn?) → array',
  description: 'Combine two arrays element-wise. If fn is provided, apply it to each pair.',
  args: [
    { name: 'array1', type: 'array', required: true, description: 'First array' },
    { name: 'array2', type: 'array', required: true, description: 'Second array' },
    { name: 'fn', type: 'function', required: false, description: 'Lambda: (a, b) => result' },
  ],
  returnType: 'array',
  examples: [
    { input: '$zip([1,2,3], ["a","b","c"])', output: '[[1,"a"],[2,"b"],[3,"c"]]' },
    { input: '$zip([1,2], [10,20], (a, b) => $add(a, b))', output: '[11,22]' },
  ],
  evaluate: (arr1, arr2, fn) => {
    const items1 = asArray(arr1);
    const items2 = asArray(arr2);
    const len = Math.min(items1.length, items2.length);
    const result: unknown[] = [];
    for (let i = 0; i < len; i++) {
      if (isLambda(fn)) {
        result.push(applyLambda(fn as LambdaValue, [items1[i], items2[i], i]));
      } else {
        result.push([items1[i], items2[i]]);
      }
    }
    return result;
  },
};

const $pluck: ExpressionFunction = {
  name: '$pluck', category: 'Array',
  signature: '$pluck(array, key) → array',
  description: 'Extract the value of a specific key from each element in an array of objects.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Array of objects' },
    { name: 'key', type: 'string', required: true, description: 'Key path to extract' },
  ],
  returnType: 'array',
  examples: [
    { input: '$pluck([{name:"Alice"},{name:"Bob"}], "name")', output: '["Alice","Bob"]' },
  ],
  evaluate: (arr, key) => {
    const items = asArray(arr);
    const keyPath = s(key);
    return items.map(item => getNestedValue(item, keyPath));
  },
};

const $find: ExpressionFunction = {
  name: '$find', category: 'Array',
  signature: '$find(array, fn) → any',
  description: 'Return the first element where the predicate function returns truthy, or null if none found.',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: element => boolean' },
  ],
  returnType: 'any',
  examples: [
    { input: '$find([1,2,3,4,5], x => $gt(x, 3))', output: '4' },
  ],
  evaluate: (arr, fn) => {
    const items = asArray(arr);
    if (!isLambda(fn)) return null;
    const lambda = fn as LambdaValue;
    for (let i = 0; i < items.length; i++) {
      if (applyLambda(lambda, [items[i], i])) return items[i];
    }
    return null;
  },
};

const $findAll: ExpressionFunction = {
  name: '$findAll', category: 'Array',
  signature: '$findAll(array, fn) → array',
  description: 'Return all elements where the predicate function returns truthy (alias for $filter with clearer intent).',
  args: [
    { name: 'array', type: 'array', required: true, description: 'Input array' },
    { name: 'fn', type: 'function', required: true, description: 'Lambda: element => boolean' },
  ],
  returnType: 'array',
  examples: [
    { input: '$findAll([1,2,3,4,5], x => $gt(x, 3))', output: '[4,5]' },
  ],
  evaluate: (arr, fn) => {
    const items = asArray(arr);
    if (!isLambda(fn)) return items;
    const lambda = fn as LambdaValue;
    return items.filter((item, idx) => !!applyLambda(lambda, [item, idx]));
  },
};

export const arrayFunctions: ExpressionFunction[] = [
  $sum, $average, $groupBy, $any, $all,
  $map, $filter, $reduce, $sortBy, $minBy, $maxBy, $distinctBy, $zip,
  $pluck, $find, $findAll,
];
