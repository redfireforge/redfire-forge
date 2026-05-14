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
  evaluate: (v, start, len) => {
    const str = s(v);
    const st = n(start);
    if (len != null) return str.slice(st, st + n(len));
    return str.slice(st);
  },
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
  evaluate: (v, count) => { const c = Math.min(Math.max(0, Math.floor(n(count))), 10000); return s(v).repeat(c); },
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

const $substringBefore: ExpressionFunction = {
  name: '$substringBefore', category: 'String',
  signature: '$substringBefore(str, separator) → string',
  description: 'Return the substring before the first occurrence of separator. Returns the full string if separator is not found.',
  args: [
    { name: 'str', type: 'string', required: true, description: 'Input string' },
    { name: 'separator', type: 'string', required: true, description: 'Separator to search for' },
  ],
  returnType: 'string',
  examples: [{ input: '$substringBefore("hello-world", "-")', output: 'hello' }],
  evaluate: (str, sep) => {
    const text = s(str);
    const separator = s(sep);
    if (separator === '') return text;
    const idx = text.indexOf(separator);
    return idx === -1 ? text : text.slice(0, idx);
  },
};

const $substringAfter: ExpressionFunction = {
  name: '$substringAfter', category: 'String',
  signature: '$substringAfter(str, separator) → string',
  description: 'Return the substring after the first occurrence of separator. Returns empty string if separator is not found.',
  args: [
    { name: 'str', type: 'string', required: true, description: 'Input string' },
    { name: 'separator', type: 'string', required: true, description: 'Separator to search for' },
  ],
  returnType: 'string',
  examples: [{ input: '$substringAfter("hello-world", "-")', output: 'world' }],
  evaluate: (str, sep) => {
    const text = s(str);
    const separator = s(sep);
    if (separator === '') return '';
    const idx = text.indexOf(separator);
    return idx === -1 ? '' : text.slice(idx + separator.length);
  },
};

const $capitalize: ExpressionFunction = {
  name: '$capitalize', category: 'String',
  signature: '$capitalize(str) → string',
  description: 'Capitalize the first letter of the string.',
  args: [{ name: 'str', type: 'string', required: true, description: 'Input string' }],
  returnType: 'string',
  examples: [{ input: '$capitalize("hello world")', output: 'Hello world' }],
  evaluate: (str) => {
    const text = s(str);
    return text.length === 0 ? '' : text[0].toUpperCase() + text.slice(1);
  },
};

const $camelCase: ExpressionFunction = {
  name: '$camelCase', category: 'String',
  signature: '$camelCase(str) → string',
  description: 'Convert a string to camelCase.',
  args: [{ name: 'str', type: 'string', required: true, description: 'Input string' }],
  returnType: 'string',
  examples: [
    { input: '$camelCase("hello world")', output: 'helloWorld' },
    { input: '$camelCase("foo-bar-baz")', output: 'fooBarBaz' },
  ],
  evaluate: (str) => {
    const text = s(str);
    return text
      .replace(/[^a-zA-Z0-9]+(.)/g, (_m, ch: string) => ch.toUpperCase())
      .replace(/^[A-Z]/, (ch) => ch.toLowerCase());
  },
};

const $snakeCase: ExpressionFunction = {
  name: '$snakeCase', category: 'String',
  signature: '$snakeCase(str) → string',
  description: 'Convert a string to snake_case.',
  args: [{ name: 'str', type: 'string', required: true, description: 'Input string' }],
  returnType: 'string',
  examples: [
    { input: '$snakeCase("helloWorld")', output: 'hello_world' },
    { input: '$snakeCase("foo bar baz")', output: 'foo_bar_baz' },
  ],
  evaluate: (str) => {
    const text = s(str);
    return text
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  },
};

const $kebabCase: ExpressionFunction = {
  name: '$kebabCase', category: 'String',
  signature: '$kebabCase(str) → string',
  description: 'Convert a string to kebab-case (lowercase with hyphens).',
  args: [{ name: 'str', type: 'string', required: true, description: 'Input string' }],
  returnType: 'string',
  examples: [{ input: '$kebabCase("helloWorld")', output: '"hello-world"' }],
  evaluate: (val) => {
    const text = s(val);
    return text
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  },
};

const $isAlpha: ExpressionFunction = {
  name: '$isAlpha', category: 'String',
  signature: '$isAlpha(str) → boolean',
  description: 'Return true if the string contains only alphabetic characters.',
  args: [{ name: 'str', type: 'string', required: true, description: 'Input string' }],
  returnType: 'boolean',
  examples: [{ input: '$isAlpha("Hello")', output: 'true' }, { input: '$isAlpha("Hello123")', output: 'false' }],
  evaluate: (val) => {
    const text = s(val);
    return text.length > 0 && /^[a-zA-Z]+$/.test(text);
  },
};

const $isNumeric: ExpressionFunction = {
  name: '$isNumeric', category: 'String',
  signature: '$isNumeric(str) → boolean',
  description: 'Return true if the string represents a valid number.',
  args: [{ name: 'str', type: 'string', required: true, description: 'Input string' }],
  returnType: 'boolean',
  examples: [{ input: '$isNumeric("123.45")', output: 'true' }, { input: '$isNumeric("abc")', output: 'false' }],
  evaluate: (val) => {
    const text = s(val);
    return text.length > 0 && !isNaN(Number(text)) && isFinite(Number(text));
  },
};

const $trimStart: ExpressionFunction = {
  name: '$trimStart', category: 'String',
  signature: '$trimStart(str) → string',
  description: 'Remove leading whitespace from a string.',
  args: [{ name: 'str', type: 'string', required: true, description: 'Input string' }],
  returnType: 'string',
  examples: [{ input: '$trimStart("  hello  ")', output: '"hello  "' }],
  evaluate: (val) => s(val).trimStart(),
};

const $trimEnd: ExpressionFunction = {
  name: '$trimEnd', category: 'String',
  signature: '$trimEnd(str) → string',
  description: 'Remove trailing whitespace from a string.',
  args: [{ name: 'str', type: 'string', required: true, description: 'Input string' }],
  returnType: 'string',
  examples: [{ input: '$trimEnd("  hello  ")', output: '"  hello"' }],
  evaluate: (val) => s(val).trimEnd(),
};

const $scan: ExpressionFunction = {
  name: '$scan', category: 'String',
  signature: '$scan(str, regex) → array',
  description: 'Find all matches of a regular expression in a string.',
  args: [
    { name: 'str', type: 'string', required: true, description: 'Input string' },
    { name: 'regex', type: 'string', required: true, description: 'Regular expression pattern' },
  ],
  returnType: 'array',
  examples: [{ input: '$scan("a1b2c3", "[0-9]+")', output: '["1","2","3"]' }],
  evaluate: (val, pattern) => {
    const text = s(val);
    const p = s(pattern);
    try {
      const re = new RegExp(p, 'g');
      return [...text.matchAll(re)].map(m => m[0]);
    } catch {
      return [];
    }
  },
};

const $ltrimStr: ExpressionFunction = {
  name: '$ltrimStr', category: 'String',
  signature: '$ltrimStr(str, prefix) → string',
  description: 'Remove a specific prefix string from the start (once). If the string does not start with the prefix, return it unchanged.',
  args: [
    { name: 'str', type: 'string', required: true, description: 'Input string' },
    { name: 'prefix', type: 'string', required: true, description: 'Prefix to remove' },
  ],
  returnType: 'string',
  examples: [{ input: '$ltrimStr("/api/users", "/api")', output: '"/users"' }],
  evaluate: (val, prefix) => {
    const text = s(val);
    const pfx = s(prefix);
    return text.startsWith(pfx) ? text.slice(pfx.length) : text;
  },
};

const $rtrimStr: ExpressionFunction = {
  name: '$rtrimStr', category: 'String',
  signature: '$rtrimStr(str, suffix) → string',
  description: 'Remove a specific suffix string from the end (once). If the string does not end with the suffix, return it unchanged.',
  args: [
    { name: 'str', type: 'string', required: true, description: 'Input string' },
    { name: 'suffix', type: 'string', required: true, description: 'Suffix to remove' },
  ],
  returnType: 'string',
  examples: [{ input: '$rtrimStr("file.json", ".json")', output: '"file"' }],
  evaluate: (val, suffix) => {
    const text = s(val);
    const sfx = s(suffix);
    if (!sfx) return text;
    return text.endsWith(sfx) ? text.slice(0, -sfx.length) : text;
  },
};

const $capture: ExpressionFunction = {
  name: '$capture', category: 'String',
  signature: '$capture(str, regex) → object',
  description: 'Extract named capture groups from the first regex match. Returns an object with group names as keys, or an empty object if no match.',
  args: [
    { name: 'str', type: 'string', required: true, description: 'Input string' },
    { name: 'regex', type: 'string', required: true, description: 'Regular expression with named groups (?<name>...)' },
  ],
  returnType: 'object',
  examples: [
    { input: '$capture("2024-01-15", "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})")', output: '{"year":"2024","month":"01","day":"15"}' },
  ],
  evaluate: (val, pattern) => {
    const text = s(val);
    const p = s(pattern);
    try {
      const re = new RegExp(p);
      const match = text.match(re);
      if (!match?.groups) return {};
      return { ...match.groups };
    } catch {
      return {};
    }
  },
};

const $indices: ExpressionFunction = {
  name: '$indices', category: 'String',
  signature: '$indices(str, search) → array',
  description: 'Return an array of all starting index positions where the search string occurs.',
  args: [
    { name: 'str', type: 'string', required: true, description: 'Input string' },
    { name: 'search', type: 'string', required: true, description: 'Substring to find' },
  ],
  returnType: 'array',
  examples: [{ input: '$indices("abcabc", "bc")', output: '[1,4]' }],
  evaluate: (val, search) => {
    const text = s(val);
    const needle = s(search);
    if (!needle) return [];
    const positions: number[] = [];
    let idx = 0;
    while (idx <= text.length - needle.length) {
      const found = text.indexOf(needle, idx);
      if (found < 0) break;
      positions.push(found);
      idx = found + 1;
    }
    return positions;
  },
};

export const stringFunctions: ExpressionFunction[] = [
  $upper, $lower, $trim, $length, $concat, $substring, $replace, $split, $join,
  $startsWith, $endsWith, $padStart, $padEnd, $repeat, $indexOf, $toString,
  $substringBefore, $substringAfter, $capitalize, $camelCase, $snakeCase,
  $kebabCase, $isAlpha, $isNumeric, $trimStart, $trimEnd, $scan,
  $ltrimStr, $rtrimStr, $capture, $indices,
];
