/**
 * Expression function registry for the Expression Builder.
 *
 * Each function has metadata (signature, description, examples) for the UI catalog,
 * plus an `evaluate` implementation used at runtime.
 */

export interface ExpressionFunctionArg {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ExpressionFunction {
  name: string;
  category: string;
  signature: string;
  description: string;
  args: ExpressionFunctionArg[];
  returnType: string;
  examples: { input: string; output: string }[];
  evaluate: (...args: unknown[]) => unknown;
}

/** All available expression function categories in display order. */
export const EXPRESSION_CATEGORIES = ['String', 'Math', 'Conditional', 'JSON', 'Date/Time', 'Encoding'] as const;
export type ExpressionCategory = (typeof EXPRESSION_CATEGORIES)[number];

const s = (v: unknown): string => v == null ? '' : String(v);
const n = (v: unknown): number => { const x = Number(v); return isNaN(x) ? 0 : x; };

// ── String functions ──

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
  evaluate: (v, len, pad) => s(v).padStart(n(len), pad != null ? s(pad) : ' '),
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
  evaluate: (v, len, pad) => s(v).padEnd(n(len), pad != null ? s(pad) : ' '),
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

// ── Math functions ──

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
    const lo = min != null ? n(min) : 0;
    const hi = max != null ? n(max) : 999999;
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  },
};

// ── Conditional functions ──

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

// ── JSON functions ──

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

// ── Date/Time functions ──

const $now: ExpressionFunction = {
  name: '$now', category: 'Date/Time',
  signature: '$now() → string',
  description: 'Return the current date/time as an ISO 8601 string.',
  args: [],
  returnType: 'string',
  examples: [{ input: '$now()', output: '2024-01-15T10:30:00.000Z' }],
  evaluate: () => new Date().toISOString(),
};

const $toIso: ExpressionFunction = {
  name: '$toIso', category: 'Date/Time',
  signature: '$toIso(timestamp) → string',
  description: 'Convert a Unix timestamp (ms) or date string to ISO 8601.',
  args: [{ name: 'timestamp', type: 'number | string', required: true, description: 'Timestamp or date string' }],
  returnType: 'string',
  examples: [{ input: '$toIso(1705312200000)', output: '2024-01-15T10:30:00.000Z' }],
  evaluate: (v) => { try { return new Date(isNaN(Number(v)) ? s(v) : Number(v)).toISOString(); } catch { return ''; } },
};

const $formatDate: ExpressionFunction = {
  name: '$formatDate', category: 'Date/Time',
  signature: '$formatDate(date, format?) → string',
  description: 'Format a date. Supports YYYY, MM, DD, HH, mm, ss tokens. Default: YYYY-MM-DD.',
  args: [
    { name: 'date', type: 'string | number', required: true, description: 'Date string or timestamp' },
    { name: 'format', type: 'string', required: false, description: 'Format pattern (default: YYYY-MM-DD)' },
  ],
  returnType: 'string',
  examples: [{ input: '$formatDate("2024-01-15T10:30:00Z", "YYYY/MM/DD")', output: '2024/01/15' }],
  evaluate: (v, fmt) => {
    try {
      const d = new Date(isNaN(Number(v)) ? s(v) : Number(v));
      if (isNaN(d.getTime())) return '';
      const pattern = fmt ? s(fmt) : 'YYYY-MM-DD';
      const pad = (x: number) => String(x).padStart(2, '0');
      return pattern
        .replace('YYYY', String(d.getUTCFullYear()))
        .replace('MM', pad(d.getUTCMonth() + 1))
        .replace('DD', pad(d.getUTCDate()))
        .replace('HH', pad(d.getUTCHours()))
        .replace('mm', pad(d.getUTCMinutes()))
        .replace('ss', pad(d.getUTCSeconds()));
    } catch { return ''; }
  },
};

const $diffMs: ExpressionFunction = {
  name: '$diffMs', category: 'Date/Time',
  signature: '$diffMs(date1, date2) → number',
  description: 'Return the difference in milliseconds between two dates (date1 - date2).',
  args: [
    { name: 'date1', type: 'string | number', required: true, description: 'First date' },
    { name: 'date2', type: 'string | number', required: true, description: 'Second date' },
  ],
  returnType: 'number',
  examples: [{ input: '$diffMs("2024-01-16", "2024-01-15")', output: '86400000' }],
  evaluate: (a, b) => {
    try {
      const d1 = new Date(isNaN(Number(a)) ? s(a) : Number(a)).getTime();
      const d2 = new Date(isNaN(Number(b)) ? s(b) : Number(b)).getTime();
      return d1 - d2;
    } catch { return 0; }
  },
};

const $addDays: ExpressionFunction = {
  name: '$addDays', category: 'Date/Time',
  signature: '$addDays(date, days) → string',
  description: 'Add `days` to a date and return ISO string.',
  args: [
    { name: 'date', type: 'string | number', required: true, description: 'Base date' },
    { name: 'days', type: 'number', required: true, description: 'Days to add (can be negative)' },
  ],
  returnType: 'string',
  examples: [{ input: '$addDays("2024-01-15", 7)', output: '2024-01-22T00:00:00.000Z' }],
  evaluate: (v, days) => {
    try {
      const d = new Date(isNaN(Number(v)) ? s(v) : Number(v));
      d.setDate(d.getDate() + n(days));
      return d.toISOString();
    } catch { return ''; }
  },
};

const $addHours: ExpressionFunction = {
  name: '$addHours', category: 'Date/Time',
  signature: '$addHours(date, hours) → string',
  description: 'Add `hours` to a date and return ISO string.',
  args: [
    { name: 'date', type: 'string | number', required: true, description: 'Base date' },
    { name: 'hours', type: 'number', required: true, description: 'Hours to add (can be negative)' },
  ],
  returnType: 'string',
  examples: [{ input: '$addHours("2024-01-15T10:00:00Z", 3)', output: '2024-01-15T13:00:00.000Z' }],
  evaluate: (v, hours) => {
    try {
      const d = new Date(isNaN(Number(v)) ? s(v) : Number(v));
      d.setTime(d.getTime() + n(hours) * 3600000);
      return d.toISOString();
    } catch { return ''; }
  },
};

const $timestamp: ExpressionFunction = {
  name: '$timestamp', category: 'Date/Time',
  signature: '$timestamp() → number',
  description: 'Return the current Unix timestamp in milliseconds.',
  args: [],
  returnType: 'number',
  examples: [{ input: '$timestamp()', output: '1705312200000' }],
  evaluate: () => Date.now(),
};

const $epoch: ExpressionFunction = {
  name: '$epoch', category: 'Date/Time',
  signature: '$epoch(date) → number',
  description: 'Convert a date string to Unix timestamp in milliseconds.',
  args: [{ name: 'date', type: 'string', required: true, description: 'Date string to convert' }],
  returnType: 'number',
  examples: [{ input: '$epoch("2024-01-15T10:30:00Z")', output: '1705314600000' }],
  evaluate: (v) => { try { const t = new Date(s(v)).getTime(); return isNaN(t) ? 0 : t; } catch { return 0; } },
};

// ── Encoding functions ──

const $base64: ExpressionFunction = {
  name: '$base64', category: 'Encoding',
  signature: '$base64(value) → string',
  description: 'Encode a string to Base64.',
  args: [{ name: 'value', type: 'string', required: true, description: 'String to encode' }],
  returnType: 'string',
  examples: [{ input: '$base64("hello")', output: 'aGVsbG8=' }],
  evaluate: (v) => { try { return btoa(s(v)); } catch { return ''; } },
};

const $base64Decode: ExpressionFunction = {
  name: '$base64Decode', category: 'Encoding',
  signature: '$base64Decode(value) → string',
  description: 'Decode a Base64 string.',
  args: [{ name: 'value', type: 'string', required: true, description: 'Base64 string to decode' }],
  returnType: 'string',
  examples: [{ input: '$base64Decode("aGVsbG8=")', output: 'hello' }],
  evaluate: (v) => { try { return atob(s(v)); } catch { return ''; } },
};

const $urlEncode: ExpressionFunction = {
  name: '$urlEncode', category: 'Encoding',
  signature: '$urlEncode(value) → string',
  description: 'URL-encode a string.',
  args: [{ name: 'value', type: 'string', required: true, description: 'String to encode' }],
  returnType: 'string',
  examples: [{ input: '$urlEncode("hello world")', output: 'hello%20world' }],
  evaluate: (v) => encodeURIComponent(s(v)),
};

const $urlDecode: ExpressionFunction = {
  name: '$urlDecode', category: 'Encoding',
  signature: '$urlDecode(value) → string',
  description: 'URL-decode a string.',
  args: [{ name: 'value', type: 'string', required: true, description: 'URL-encoded string' }],
  returnType: 'string',
  examples: [{ input: '$urlDecode("hello%20world")', output: 'hello world' }],
  evaluate: (v) => { try { return decodeURIComponent(s(v)); } catch { return s(v); } },
};

const $hash: ExpressionFunction = {
  name: '$hash', category: 'Encoding',
  signature: '$hash(value, algorithm?) → string',
  description: 'Generate a hash of a string. Supports simple djb2 hashing (synchronous). Returns hex string.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to hash' },
    { name: 'algorithm', type: 'string', required: false, description: 'Reserved for future use' },
  ],
  returnType: 'string',
  examples: [{ input: '$hash("hello")', output: '261238937' }],
  evaluate: (v) => {
    // djb2 hash — fast, deterministic, synchronous
    const str = s(v);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  },
};

// ── Registry ──

export const EXPRESSION_FUNCTIONS: ExpressionFunction[] = [
  // String
  $upper, $lower, $trim, $length, $concat, $substring, $replace, $split, $join,
  $startsWith, $endsWith, $padStart, $padEnd, $repeat, $indexOf,
  // Math
  $add, $subtract, $multiply, $divide, $round, $abs, $min, $max,
  $mod, $floor, $ceil, $power, $random,
  // Conditional
  $default, $if, $isEmpty, $contains, $matches,
  $not, $coalesce, $equals,
  // JSON
  $jsonpath, $parse, $stringify, $keys, $values, $count, $flatten,
  $merge, $type, $sort, $reverse, $unique, $first, $last, $slice,
  // Date/Time
  $now, $toIso, $formatDate, $diffMs, $addDays,
  $addHours, $timestamp, $epoch,
  // Encoding
  $base64, $base64Decode, $urlEncode, $urlDecode, $hash,
];

/** Lookup by name (e.g. "$upper"). */
export const EXPRESSION_FUNCTION_MAP = new Map<string, ExpressionFunction>(
  EXPRESSION_FUNCTIONS.map((f) => [f.name, f]),
);

/** Functions grouped by category in display order. */
export function groupedExpressionFunctions(): { category: string; functions: ExpressionFunction[] }[] {
  return EXPRESSION_CATEGORIES.map((cat) => ({
    category: cat,
    functions: EXPRESSION_FUNCTIONS.filter((f) => f.category === cat),
  })).filter((g) => g.functions.length > 0);
}
