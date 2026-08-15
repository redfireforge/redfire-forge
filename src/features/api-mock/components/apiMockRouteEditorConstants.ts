import type { ApiMockFaultKind, ApiMockPredicateV1 } from '../../../shared/api-mock/contracts';
import { isUnavailablePredicateOperator } from '../../../shared/api-mock/unavailableOperators';

export type BuilderTab = 'match' | 'response' | 'behavior' | 'examples' | 'docs';

export const BUILDER_PANEL_ID = 'api-mock-builder-panel';
export const BUILDER_TABS: ReadonlyArray<{ id: BuilderTab; label: string }> = [
  { id: 'match', label: 'Match' },
  { id: 'response', label: 'Response' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'examples', label: 'Examples' },
  { id: 'docs', label: 'Documentation' },
];

export const METHODS = ['ANY', 'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'] as const;
export const OPERATOR_LABELS: Record<ApiMockPredicateV1['operator'], string> = {
  exact: 'Exact',
  contains: 'Contains',
  prefix: 'Prefix',
  suffix: 'Suffix',
  regex: 'Regex',
  glob: 'Glob',
  present: 'Present',
  absent: 'Absent',
  jsonPath_exists: 'JSONPath exists',
  jsonPath_equals: 'JSONPath equals',
  xpath_exists: 'XPath exists',
  xpath_equals: 'XPath equals',
  json_strict: 'JSON strict',
  json_subset: 'JSON subset',
  jsonSchema: 'JSON Schema',
  xmlSchema: 'XML Schema',
  form_field_exact: 'Form field exact',
  form_field_regex: 'Form field regex',
  form_field_present: 'Form field present',
  multipart_field: 'Multipart field',
  multipart_file: 'Multipart file',
  binary_exact: 'Binary exact',
  binary_sha256: 'SHA-256',
};
export const OPERATORS = Object.keys(OPERATOR_LABELS) as ApiMockPredicateV1['operator'][];
export const SOURCES: ApiMockPredicateV1['source'][] = ['pathParam', 'query', 'header', 'cookie', 'security', 'body', 'transport'];

export const SOURCE_LABELS: Record<ApiMockPredicateV1['source'], string> = {
  pathParam: 'Path parameter',
  query: 'Query',
  header: 'Header',
  cookie: 'Cookie',
  security: 'Security',
  body: 'Body',
  transport: 'Transport',
};
export const METHOD_OPTIONS = METHODS.map(m => ({ value: m, label: m }));
export const OPERATOR_OPTIONS = OPERATORS.map(o => ({ value: o, label: OPERATOR_LABELS[o] }));
export const SOURCE_OPTIONS = SOURCES.map(s => ({ value: s, label: SOURCE_LABELS[s] }));

export const TOOLBOX_OPERATORS = new Set<ApiMockPredicateV1['operator']>([
  'regex', 'glob', 'jsonPath_exists', 'jsonPath_equals', 'xpath_exists', 'xpath_equals', 'jsonSchema', 'xmlSchema',
]);

export function expectedText(expected: ApiMockPredicateV1['expected']): string {
  if (typeof expected === 'string') return expected;
  if (expected == null) return '';
  try { return JSON.stringify(expected, null, 2); } catch { return String(expected); }
}

export function pairExpected(expected: ApiMockPredicateV1['expected']): [string, string] {
  return Array.isArray(expected)
    ? [String(expected[0] ?? ''), String(expected[1] ?? '')]
    : ['', ''];
}

export const SECURITY_SELECTOR_OPTIONS = [
  { value: 'scheme', label: 'Scheme' },
  { value: 'username', label: 'Username' },
  { value: 'tokenClaim', label: 'Token claim' },
  { value: 'apiKeyName', label: 'API key name' },
  { value: 'apiKeyLocation', label: 'API key location' },
  { value: 'certSubject', label: 'Certificate subject' },
];

export function operatorOptionsFor(operator: string) {
  if (isUnavailablePredicateOperator(operator)) {
    return [...OPERATOR_OPTIONS, { value: operator, label: `${operator} (unavailable)`, disabled: true }];
  }
  return OPERATOR_OPTIONS;
}

export function securitySelectorValue(selector?: string): string {
  return SECURITY_SELECTOR_OPTIONS.some(o => o.value === selector) ? selector! : '';
}

export const COMBINATOR_OPTIONS = [
  { value: 'all', label: 'All of' },
  { value: 'any', label: 'Any of' },
  { value: 'not', label: 'None of' },
];

export const FAULT_OPTIONS: Array<{ value: ApiMockFaultKind; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'timeout', label: 'Timeout (no response)' },
  { value: 'close', label: 'Close connection' },
  { value: 'reset', label: 'Reset connection' },
  { value: 'malformed', label: 'Malformed body' },
  { value: 'dribble', label: 'Dribble (slow drip)' },
];
