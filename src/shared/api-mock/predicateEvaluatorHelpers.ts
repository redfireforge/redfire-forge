import type {
  ApiMockCapturedRequestV1,
  ApiMockPredicateExpectedValue,
  ApiMockPredicateOperator,
  ApiMockPredicateResultV1,
  ApiMockPredicateV1,
} from './contracts';
import { getByPath } from '../utils/jsonPath';
import { compileRegexCached, testRegexCached } from './patternCache';
import { BoundedCache } from './perfBudgets';
import { matchXPathExists, matchXPathEquals } from './xpathMatcher';
import {
  matchBinarySha256,
  matchJsonSchema,
  matchMultipartField,
  matchMultipartFile,
  matchXmlSchema,
  type MatcherContext,
} from './schemaMatchers';

export interface ParsedBody { ok: boolean; value?: unknown; }
const parsedBodyCache = new BoundedCache<string, ParsedBody>(256);

export function parseBodyCached(body: string): ParsedBody {
  const cached = parsedBodyCache.get(body);
  if (cached !== undefined) return cached;
  let parsed: ParsedBody;
  try { parsed = { ok: true, value: JSON.parse(body) }; }
  catch { parsed = { ok: false }; }
  parsedBodyCache.set(body, parsed);
  return parsed;
}

export function stripBasePath(path: string, basePath: string): string {
  if (!basePath) return path;
  return path.startsWith(basePath) ? (path.slice(basePath.length) || '/') : path;
}

export function extractValue(
  pred: ApiMockPredicateV1,
  request: ApiMockCapturedRequestV1,
  pathParams: Record<string, string>,
): string | string[] | null {
  const sel = pred.selector;
  switch (pred.source) {
    case 'pathParam':
      return sel ? (pathParams[sel] ?? null) : null;
    case 'query':
      return sel ? (request.query[sel] ?? null) : null;
    case 'header':
      return sel ? (request.headers[sel.toLowerCase()] ?? null) : null;
    case 'cookie':
      return sel ? (request.cookies[sel] ?? null) : null;
    case 'security':
      return extractSecurityValue(sel, request);
    case 'body':
      return request.body;
    case 'transport':
      return null;
    default:
      return null;
  }
}

export function extractSecurityValue(selector: string | undefined, request: ApiMockCapturedRequestV1): string | null {
  const authHeader = request.headers.authorization?.[0];
  if (!selector) return null;
  switch (selector) {
    case 'scheme': {
      if (!authHeader) return null;
      const spaceIdx = authHeader.indexOf(' ');
      return spaceIdx > 0 ? authHeader.slice(0, spaceIdx) : authHeader;
    }
    case 'username': {
      if (!authHeader?.toLowerCase().startsWith('basic ')) return null;
      try {
        const decoded = atob(authHeader.slice(6));
        const username = decoded.split(':')[0];
        return username || null;
      } catch { return null; }
    }
    case 'tokenClaim': return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    case 'apiKeyName': {
      const apiKeyHeaders = ['x-api-key', 'api-key', 'x-auth-token'];
      for (const h of apiKeyHeaders) {
        if (request.headers[h]) return h;
      }
      return null;
    }
    case 'apiKeyLocation': {
      const apiKeyHeaders = ['x-api-key', 'api-key', 'x-auth-token'];
      for (const h of apiKeyHeaders) {
        if (request.headers[h]) return 'header';
      }
      return null;
    }
    case 'certSubject':
      return request.clientCertSubject ?? null;
    default: return null;
  }
}

export function evaluateOperator(
  operator: ApiMockPredicateOperator,
  value: string | string[] | null,
  expected: ApiMockPredicateExpectedValue | undefined,
  options?: ApiMockPredicateV1['options'],
  ctx?: MatcherContext,
): boolean {
  switch (operator) {
    case 'present': return value != null && value !== '';
    case 'absent': return value == null || value === '';

    case 'exact': return matchExact(value, expected, options);
    case 'contains': return matchContains(value, expected);
    case 'prefix': return matchPrefix(value, expected);
    case 'suffix': return matchSuffix(value, expected);
    case 'regex': return matchRegex(value, expected, options);
    case 'glob': return matchGlob(value, expected, options);

    case 'json_strict': return matchJsonStrict(value, expected);
    case 'json_subset': return matchJsonSubset(value, expected);
    case 'jsonPath_exists': return matchJsonPathExists(value, expected);
    case 'jsonPath_equals': return matchJsonPathEquals(value, expected, options?.matchStyle);

    case 'form_field_exact': return matchFormField(value, expected, 'exact');
    case 'form_field_regex': return matchFormField(value, expected, 'regex');
    case 'form_field_present': return matchFormField(value, expected, 'present');

    case 'binary_exact': return typeof value === 'string' && value === String(expected);
    case 'binary_sha256': return matchBinarySha256(value, expected);

    case 'xpath_exists': return matchXPathExists(value, expected);
    case 'xpath_equals': return matchXPathEquals(value, expected, options?.matchStyle);

    case 'jsonSchema': return matchJsonSchema(value, expected);
    case 'xmlSchema': return matchXmlSchema(value, expected);
    case 'multipart_field': return matchMultipartField(value, expected, ctx);
    case 'multipart_file': return matchMultipartFile(value, expected, ctx);

    default: return false;
  }
}

export function describeFailure(pred: ApiMockPredicateV1, value: string | string[] | null): string {
  if (value == null) return `${pred.source}${pred.selector ? ` "${pred.selector}"` : ''} was absent`;
  const display = Array.isArray(value) ? value.join(', ') : value.length > 80 ? `${value.slice(0, 80)}…` : value;
  return `${pred.source}${pred.selector ? ` "${pred.selector}"` : ''} ${pred.operator} failed — got "${display}"`;
}

function str(v: ApiMockPredicateExpectedValue | undefined): string {
  return typeof v === 'string' ? v : String(v ?? '');
}

function flatValue(v: string | string[] | null): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function anyValue(v: string | string[] | null, fn: (s: string) => boolean): boolean {
  if (v == null) return false;
  const arr = Array.isArray(v) ? v : [v];
  return arr.some(fn);
}

function matchExact(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined, options?: ApiMockPredicateV1['options']): boolean {
  const exp = str(expected);
  const ci = options?.caseSensitive === false;
  return anyValue(value, v => ci ? v.toLowerCase() === exp.toLowerCase() : v === exp);
}

function matchContains(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const exp = str(expected);
  return anyValue(value, v => v.includes(exp));
}

function matchPrefix(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const exp = str(expected);
  return anyValue(value, v => v.startsWith(exp));
}

function matchSuffix(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const exp = str(expected);
  return anyValue(value, v => v.endsWith(exp));
}

function matchRegex(
  value: string | string[] | null,
  expected: ApiMockPredicateExpectedValue | undefined,
  options?: ApiMockPredicateV1['options'],
): boolean {
  const src = str(expected);
  const flags = options?.caseSensitive === false ? 'i' : '';
  return anyValue(value, v => testRegexCached(src, flags, v));
}

function matchGlob(
  value: string | string[] | null,
  expected: ApiMockPredicateExpectedValue | undefined,
  options?: ApiMockPredicateV1['options'],
): boolean {
  const pattern = str(expected);
  let regex = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') regex += '.*';
    else if (ch === '?') regex += '.';
    else regex += '.+*?^${}()|[]\\'.includes(ch) ? `\\${ch}` : ch;
  }
  const re = compileRegexCached(`^${regex}$`, options?.caseSensitive === false ? 'i' : '')!;
  return anyValue(value, v => re.test(v));
}

function matchJsonStrict(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const body = flatValue(value);
  if (body == null) return false;
  const parsedBody = parseBodyCached(body);
  if (!parsedBody.ok) return false;
  try {
    const exp = typeof expected === 'string' ? JSON.parse(expected) : expected;
    return deepStrictEqual(parsedBody.value, exp);
  } catch {
    return false;
  }
}

function matchJsonSubset(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const body = flatValue(value);
  if (body == null) return false;
  const parsedBody = parseBodyCached(body);
  if (!parsedBody.ok) return false;
  try {
    const exp = typeof expected === 'string' ? JSON.parse(expected) : expected;
    return isSubset(exp, parsedBody.value);
  } catch {
    return false;
  }
}

function matchJsonPathExists(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const body = flatValue(value);
  if (body == null || typeof expected !== 'string') return false;
  const parsedBody = parseBodyCached(body);
  if (!parsedBody.ok) return false;
  return resolveSimpleJsonPath(parsedBody.value, expected) !== undefined;
}

function matchJsonPathEquals(
  value: string | string[] | null,
  expected: ApiMockPredicateExpectedValue | undefined,
  matchStyle?: 'subset' | 'exact',
): boolean {
  const body = flatValue(value);
  if (body == null || !Array.isArray(expected) || expected.length < 2) return false;
  const [path, expectedVal] = expected;
  if (typeof path !== 'string') return false;
  const parsedBody = parseBodyCached(body);
  if (!parsedBody.ok) return false;
  const resolved = resolveSimpleJsonPath(parsedBody.value, path);
  if (resolved === undefined) return false;
  const actual = formatJsonPathValue(resolved);
  const want = typeof expectedVal === 'string' ? expectedVal : formatJsonPathValue(expectedVal);
  // Empty needle would make `includes('')` true for every string; treat it as exact.
  // Only return on a successful substring hit so pretty vs compact object JSON
  // can still fall through to structural equality.
  if (matchStyle === 'subset' && want && actual.includes(want)) return true;
  if (actual === want) return true;
  // Toolbox Apply stores JSON.stringify of objects/arrays; compare structurally
  // so key order and compact vs pretty JSON still match.
  if (resolved !== null && typeof resolved === 'object') {
    let exp: unknown = expectedVal;
    if (typeof expectedVal === 'string') {
      try { exp = JSON.parse(expectedVal); } catch { return false; }
    }
    if (exp !== null && typeof exp === 'object') return deepStrictEqual(resolved, exp);
  }
  return false;
}

function matchFormField(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined, mode: 'exact' | 'regex' | 'present'): boolean {
  const body = flatValue(value);
  if (body == null) return false;
  // Pair UI writes [field, value] for exact/regex; `present` has a single box, so a
  // bare string names the field (parity with the multipart matchers).
  const [fieldName, fieldValue] = Array.isArray(expected)
    ? [expected[0], expected[1]]
    : [mode === 'present' && typeof expected === 'string' ? expected : undefined, undefined];
  if (!fieldName) return false;
  const params = new URLSearchParams(body);
  const actual = params.get(String(fieldName));
  if (mode === 'present') return actual != null;
  if (mode === 'exact') return actual === String(fieldValue ?? '');
  if (actual == null) return false;
  return testRegexCached(String(fieldValue ?? ''), '', actual);
}

/**
 * Format a resolved JSON value for Expected / Resolved UI and jsonPath_equals.
 * Scalars use String() parity; objects/arrays use JSON.stringify (not `[object Object]`).
 */
export function formatJsonPathValue(resolved: unknown): string {
  if (resolved === undefined) return '';
  if (resolved === null) return 'null';
  if (typeof resolved === 'string') return resolved;
  if (typeof resolved === 'number' || typeof resolved === 'boolean') return String(resolved);
  return JSON.stringify(resolved);
}

/**
 * Resolve a simplified JSONPath against an object.
 * Supports `$.a.b`, `$.items[0].sku`, `items[0].sku`, and `$.items[*].id` via the
 * shared canonical path engine (runtime-parity with predicate matching).
 */
export function resolveSimpleJsonPath(obj: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '$') return obj;
  return getByPath(obj, trimmed);
}

function deepStrictEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false;
    return a.every((v, i) => deepStrictEqual(v, (b as unknown[])[i]));
  }
  const aKeys = Object.keys(a as Record<string, unknown>).sort();
  const bKeys = Object.keys(b as Record<string, unknown>).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, i) =>
    key === bKeys[i] && deepStrictEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

export function combinatorLabel(combinator: string): string {
  if (combinator === 'all') return 'All of';
  if (combinator === 'any') return 'Any of';
  if (combinator === 'not') return 'None of';
  return 'Group';
}

export function predicateResultLabel(result: Pick<ApiMockPredicateResultV1, 'source' | 'selector' | 'combinator'>): string {
  if (result.combinator) return combinatorLabel(result.combinator);
  return result.selector ? `${result.source} "${result.selector}"` : result.source;
}

export function describeGroupOutcome(
  combinator: string,
  passed: boolean,
  childResults: Array<Pick<ApiMockPredicateResultV1, 'passed' | 'evaluated' | 'source' | 'selector' | 'combinator'>>,
): string {
  if (combinator === 'not') {
    if (childResults.some(r => r.evaluated === false)) {
      return 'fail-closed — a child could not be evaluated';
    }
    if (passed) return 'passed — no child matched';
    const matching = childResults.filter(r => r.passed);
    if (matching.length) {
      return `rejected — ${matching.map(predicateResultLabel).join(', ')} matched`;
    }
    return 'rejected — a child matched';
  }
  if (combinator === 'any' && !passed) return 'failed — no child passed';
  if (combinator === 'all' && !passed) {
    const failed = childResults.filter(r => !r.passed);
    if (failed.length) {
      return `failed — ${failed.map(predicateResultLabel).join(', ')} did not match`;
    }
    return 'failed — every child must pass';
  }
  if (combinator !== 'all' && combinator !== 'any' && combinator !== 'not') {
    return `unknown combinator "${combinator}" — fail-closed`;
  }
  return passed ? 'passed' : 'failed';
}

function isSubset(expected: unknown, actual: unknown): boolean {
  if (expected === actual) return true;
  if (expected == null) return true;
  if (typeof expected !== 'object' || typeof actual !== 'object') return expected === actual;
  if (actual == null) return false;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every((e, i) => i < actual.length && isSubset(e, actual[i]));
  }
  return Object.keys(expected as Record<string, unknown>).every(
    key => isSubset((expected as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key]),
  );
}
