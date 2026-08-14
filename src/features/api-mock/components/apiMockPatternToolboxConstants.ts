import type { ApiMockPathMatcherKind, ApiMockPredicateV1 } from '../../../shared/api-mock/contracts';
import { formatJsonPathValue } from '../../../shared/api-mock/jsonPathFromCursor';

export const DEFAULT_JSON_SAMPLE = {
  customer: { id: 'C-4421', tier: 'gold' },
  items: [{ sku: 'RF-100', qty: 2 }],
};

export type ConstraintDraft = {
  id: string;
  source: Extract<ApiMockPredicateV1['source'], 'query' | 'header' | 'cookie'>;
  selector: string;
  operator: ApiMockPredicateV1['operator'];
  expected: string;
};

export const CONSTRAINT_SOURCE_OPTIONS = [
  { value: 'header', label: 'Header' },
  { value: 'query', label: 'Query' },
  { value: 'cookie', label: 'Cookie' },
];

export const CONSTRAINT_OPERATOR_OPTIONS = [
  { value: 'exact', label: 'Exact' },
  { value: 'contains', label: 'Contains' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'suffix', label: 'Suffix' },
  { value: 'regex', label: 'Regex' },
  { value: 'glob', label: 'Glob' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
];

export type ToolTab = 'regex' | 'path' | 'jsonpath' | 'constraints' | 'xpath' | 'schema';

export function toolboxTabForOperator(operator?: string): ToolTab {
  if (operator === 'regex' || operator === 'glob') return 'regex';
  if (operator === 'jsonPath_exists' || operator === 'jsonPath_equals') return 'jsonpath';
  if (operator === 'xpath_exists' || operator === 'xpath_equals') return 'xpath';
  if (operator === 'jsonSchema' || operator === 'xmlSchema') return 'schema';
  return 'path';
}

/** Schema-tab kind from the matcher operator, falling back to the expected-value shape. */
export function initialSchemaKind(
  operator?: string,
  expected?: unknown,
): 'json' | 'xml' {
  if (operator === 'xmlSchema') return 'xml';
  if (operator === 'jsonSchema') return 'json';
  if (Array.isArray(expected)) return 'xml';
  if (typeof expected === 'string') {
    const trimmed = expected.trim();
    if (!trimmed || trimmed.startsWith('{')) return 'json';
    return 'xml';
  }
  if (expected && typeof expected === 'object') {
    const rec = expected as Record<string, unknown>;
    if (rec.requiredElements != null || rec.elements != null) return 'xml';
  }
  return 'json';
}

const DEFAULT_SCHEMA_TEXT = '{\n  "type": "object"\n}';

const BODY_MATCHER_OPS = new Set<string>([
  'jsonPath_exists', 'jsonPath_equals', 'xpath_exists', 'xpath_equals', 'regex', 'glob',
]);

/** JSONPath editor fields from the matcher being edited — never start from `$` + sample. */
export function initialJsonPathDraft(operator?: string, expected?: unknown): { path: string; value: string } {
  if (operator === 'jsonPath_equals' && Array.isArray(expected) && expected[0] != null) {
    return { path: String(expected[0]), value: formatJsonPathValue(expected[1]) };
  }
  if (operator === 'jsonPath_exists' && typeof expected === 'string' && expected.trim()) {
    return { path: expected, value: '' };
  }
  return { path: '$', value: formatJsonPathValue(DEFAULT_JSON_SAMPLE) };
}

/** XPath editor fields from the matcher being edited — never start from `/*`. */
export function initialXPathDraft(operator?: string, expected?: unknown): { expr: string; value: string } {
  if (operator === 'xpath_equals' && Array.isArray(expected) && expected[0] != null) {
    return { expr: String(expected[0]), value: formatJsonPathValue(expected[1]) };
  }
  if (operator === 'xpath_exists' && typeof expected === 'string' && expected.trim()) {
    return { expr: expected, value: '' };
  }
  return { expr: '/*', value: '' };
}

/** Regex/glob expected, else the path matcher regex, else a numeric-id preset. */
export function initialRegexPattern(
  operator?: string,
  expected?: unknown,
  pathKind?: string,
  pathValue?: string,
): string {
  if (operator === 'regex' || operator === 'glob') {
    if (typeof expected === 'string') return expected;
    if (expected != null) return String(expected);
  }
  if (pathKind === 'regex' && pathValue) return pathValue;
  return '^[0-9]+$';
}

/** Schema editor text — skip JSONPath/XPath/regex expected so those rows don't pollute Schema. */
export function initialSchemaText(operator?: string, expected?: unknown): string {
  if (operator && BODY_MATCHER_OPS.has(operator)) return DEFAULT_SCHEMA_TEXT;
  if (typeof expected === 'string') return expected;
  if (expected && typeof expected === 'object') return JSON.stringify(expected, null, 2);
  return DEFAULT_SCHEMA_TEXT;
}

export const KIND_OPTIONS: Array<{ value: ApiMockPathMatcherKind; label: string }> = [
  { value: 'exact', label: 'Exact' },
  { value: 'parameterized', label: 'Parameterized (:id / {id})' },
  { value: 'glob', label: 'Glob (* ** ?)' },
  { value: 'regex', label: 'Regex' },
];

export const PATH_PRESETS: Array<{ kind: ApiMockPathMatcherKind; value: string; sample: string; label: string }> = [
  { kind: 'parameterized', value: '/users/:id', sample: '/users/42', label: '/users/:id' },
  { kind: 'parameterized', value: '/orders/{orderId}/items/{itemId}', sample: '/orders/7/items/3', label: 'nested params' },
  { kind: 'glob', value: '/api/**', sample: '/api/v1/users', label: '/api/** (any depth)' },
  { kind: 'glob', value: '/assets/*.png', sample: '/assets/logo.png', label: '/assets/*.png' },
  { kind: 'regex', value: '^/v[0-9]+/.*$', sample: '/v2/users', label: '^/v[0-9]+/.*$' },
];

export const REGEX_LIBRARY = [
  { category: 'Identifiers', entries: [
    { name: 'Numeric ID', pattern: '^[0-9]+$', pass: ['42', '100234'], fail: ['admin', '42a'] },
    { name: 'UUID v4', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', pass: ['550e8400-e29b-41d4-a716-446655440000'], fail: ['not-a-uuid'] },
    { name: 'Alphanumeric code', pattern: '^[A-Za-z0-9]+$', pass: ['ABC123'], fail: ['ab-c'] },
  ]},
  { category: 'API formats', entries: [
    { name: 'ISO date', pattern: '^\\d{4}-\\d{2}-\\d{2}$', pass: ['2026-08-12'], fail: ['08/12/2026'] },
    { name: 'Semantic version', pattern: '^\\d+\\.\\d+\\.\\d+$', pass: ['1.2.3'], fail: ['v1'] },
    { name: 'Bearer JWT shape', pattern: '^[\\w-]+\\.[\\w-]+\\.[\\w-]+$', pass: ['aaa.bbb.ccc'], fail: ['token'] },
  ]},
];

export const XPATH_PRESETS = [
  { name: 'Root element', expr: '/*', sample: '<Order><Id>1</Id></Order>' },
  { name: 'Local name', expr: "//*[local-name()='vin']", sample: "<Vehicle xmlns='urn:ex'><vin>1HGCM</vin></Vehicle>" },
  { name: 'Text value', expr: "//*[local-name()='status']/text()", sample: '<Item><status>open</status></Item>' },
];

export const SCHEMA_PRESETS = [
  { name: 'JSON object', kind: 'json' as const, value: '{\n  "type": "object"\n}' },
  { name: 'Required id', kind: 'json' as const, value: '{\n  "type": "object",\n  "required": ["id"]\n}' },
  { name: 'XML names', kind: 'xml' as const, value: 'Order, Id' },
];
