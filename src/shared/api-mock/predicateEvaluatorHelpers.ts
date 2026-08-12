import type {
  ApiMockCapturedRequestV1,
  ApiMockPredicateExpectedValue,
  ApiMockPredicateOperator,
  ApiMockPredicateV1,
} from './contracts';
import { compileRegexCached, testRegexCached } from './patternCache';
import { BoundedCache } from './perfBudgets';

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
    default: return null;
  }
}

export function evaluateOperator(
  operator: ApiMockPredicateOperator,
  value: string | string[] | null,
  expected: ApiMockPredicateExpectedValue | undefined,
  options?: ApiMockPredicateV1['options'],
): boolean {
  switch (operator) {
    case 'present': return value != null && value !== '';
    case 'absent': return value == null || value === '';

    case 'exact': return matchExact(value, expected, options);
    case 'contains': return matchContains(value, expected);
    case 'prefix': return matchPrefix(value, expected);
    case 'suffix': return matchSuffix(value, expected);
    case 'regex': return matchRegex(value, expected);
    case 'glob': return matchGlob(value, expected);

    case 'json_strict': return matchJsonStrict(value, expected);
    case 'json_subset': return matchJsonSubset(value, expected);
    case 'jsonPath_exists': return matchJsonPathExists(value, expected);
    case 'jsonPath_equals': return matchJsonPathEquals(value, expected);

    case 'form_field_exact': return matchFormField(value, expected, 'exact');
    case 'form_field_regex': return matchFormField(value, expected, 'regex');
    case 'form_field_present': return matchFormField(value, expected, 'present');

    case 'binary_exact': return typeof value === 'string' && value === String(expected);
    case 'binary_sha256': return false;

    case 'jsonSchema':
    case 'xpath_exists':
    case 'xpath_equals':
    case 'xmlSchema':
    case 'multipart_field':
    case 'multipart_file':
      return false;

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

function matchRegex(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const src = str(expected);
  return anyValue(value, v => testRegexCached(src, '', v));
}

function matchGlob(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const pattern = str(expected);
  let regex = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') regex += '.*';
    else if (ch === '?') regex += '.';
    else regex += '.+*?^${}()|[]\\'.includes(ch) ? `\\${ch}` : ch;
  }
  const re = compileRegexCached(`^${regex}$`)!;
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

function matchJsonPathEquals(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined): boolean {
  const body = flatValue(value);
  if (body == null || !Array.isArray(expected) || expected.length < 2) return false;
  const [path, expectedVal] = expected;
  const parsedBody = parseBodyCached(body);
  if (!parsedBody.ok) return false;
  const resolved = resolveSimpleJsonPath(parsedBody.value, path);
  return String(resolved) === String(expectedVal);
}

function matchFormField(value: string | string[] | null, expected: ApiMockPredicateExpectedValue | undefined, mode: 'exact' | 'regex' | 'present'): boolean {
  const body = flatValue(value);
  if (body == null || !Array.isArray(expected)) return false;
  const [fieldName, fieldValue] = expected;
  const params = new URLSearchParams(body);
  const actual = params.get(String(fieldName));
  if (mode === 'present') return actual != null;
  if (mode === 'exact') return actual === String(fieldValue ?? '');
  if (actual == null) return false;
  return testRegexCached(String(fieldValue ?? ''), '', actual);
}

function resolveSimpleJsonPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
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
