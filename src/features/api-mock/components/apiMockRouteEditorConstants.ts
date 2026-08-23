import type { ApiMockFaultKind, ApiMockPredicateV1 } from '@shared/api-mock/contracts';
import { httpMethodSelectOptions } from '@shared/constants/httpMethodColors';
import { isUnavailablePredicateOperator } from '@shared/api-mock/unavailableOperators';
import type { CustomSelectGroup, CustomSelectOption } from '@shared/components/customSelectTypes';

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
export const METHOD_OPTIONS = httpMethodSelectOptions(METHODS);

const OPERATOR_DETAILS: Partial<Record<ApiMockPredicateV1['operator'], string>> = {
  exact: 'Whole value',
  contains: 'Substring',
  prefix: 'Starts with',
  suffix: 'Ends with',
  regex: 'Regular expression',
  glob: 'Wildcards * ?',
  present: 'Key exists',
  absent: 'Key missing',
  jsonPath_exists: 'Path is present',
  jsonPath_equals: 'Path equals value',
  json_strict: 'Exact JSON',
  json_subset: 'Partial JSON',
  jsonSchema: 'Schema validate',
  xpath_exists: 'Node is present',
  xpath_equals: 'Node equals value',
  xmlSchema: 'Schema validate',
  form_field_exact: 'Named field equals',
  form_field_regex: 'Named field matches',
  form_field_present: 'Named field exists',
  multipart_field: 'Part field',
  multipart_file: 'Uploaded filename',
  binary_exact: 'Raw bytes',
  binary_sha256: 'Content hash',
};

function operatorOption(operator: ApiMockPredicateV1['operator']): CustomSelectOption {
  return { value: operator, label: OPERATOR_LABELS[operator], detail: OPERATOR_DETAILS[operator] };
}

function operatorGroup(
  label: string,
  operators: ReadonlyArray<ApiMockPredicateV1['operator']>,
): CustomSelectGroup {
  return { label, options: operators.map(operatorOption) };
}

export const OPERATOR_GROUPS_ALL: CustomSelectGroup[] = [
  operatorGroup('Text', ['exact', 'contains', 'prefix', 'suffix']),
  operatorGroup('Pattern', ['regex', 'glob']),
  operatorGroup('Presence', ['present', 'absent']),
  operatorGroup('JSON', ['jsonPath_exists', 'jsonPath_equals', 'json_strict', 'json_subset', 'jsonSchema']),
  operatorGroup('XML', ['xpath_exists', 'xpath_equals', 'xmlSchema']),
  operatorGroup('Form', ['form_field_exact', 'form_field_regex', 'form_field_present']),
  operatorGroup('Multipart', ['multipart_field', 'multipart_file']),
  operatorGroup('Binary', ['binary_exact', 'binary_sha256']),
];

export const OPERATOR_GROUPS_SCALAR: CustomSelectGroup[] = OPERATOR_GROUPS_ALL.filter(
  group => group.label === 'Text' || group.label === 'Pattern' || group.label === 'Presence',
);

export const OPERATOR_OPTIONS = OPERATOR_GROUPS_ALL.flatMap(group => group.options);

export const SOURCE_OPTIONS: CustomSelectGroup[] = [
  {
    label: 'Request',
    options: [
      { value: 'pathParam', label: SOURCE_LABELS.pathParam, detail: 'URL :id' },
      { value: 'query', label: SOURCE_LABELS.query, detail: '?page=' },
    ],
  },
  {
    label: 'Headers & cookies',
    options: [
      { value: 'header', label: SOURCE_LABELS.header },
      { value: 'cookie', label: SOURCE_LABELS.cookie },
    ],
  },
  {
    label: 'Advanced',
    options: [
      { value: 'security', label: SOURCE_LABELS.security, detail: 'Scheme, claim, cert' },
      { value: 'body', label: SOURCE_LABELS.body },
      { value: 'transport', label: SOURCE_LABELS.transport },
    ],
  },
];

export const SECURITY_SELECTOR_OPTIONS: CustomSelectGroup[] = [
  {
    label: 'Credentials',
    options: [
      { value: 'scheme', label: 'Scheme' },
      { value: 'username', label: 'Username' },
    ],
  },
  {
    label: 'Token',
    options: [{ value: 'tokenClaim', label: 'Token claim' }],
  },
  {
    label: 'API key',
    options: [
      { value: 'apiKeyName', label: 'API key name' },
      { value: 'apiKeyLocation', label: 'API key location' },
    ],
  },
  {
    label: 'Certificate',
    options: [{ value: 'certSubject', label: 'Certificate subject' }],
  },
];

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

export function operatorOptionsFor(
  operator: string,
  source?: ApiMockPredicateV1['source'],
): CustomSelectGroup[] {
  const groups = source && source !== 'body' ? OPERATOR_GROUPS_SCALAR : OPERATOR_GROUPS_ALL;
  const listed = groups.some(group => group.options.some(option => option.value === operator));
  if (listed && !isUnavailablePredicateOperator(operator)) return groups;
  const knownLabel = OPERATOR_LABELS[operator as ApiMockPredicateV1['operator']];
  return [
    ...groups,
    {
      label: 'Current',
      options: [{
        value: operator,
        label: knownLabel ? `${knownLabel} (unavailable)` : `${operator} (unavailable)`,
        disabled: true,
      }],
    },
  ];
}

export function securitySelectorValue(selector?: string): string {
  return SECURITY_SELECTOR_OPTIONS.some(group => group.options.some(option => option.value === selector))
    ? selector!
    : '';
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
