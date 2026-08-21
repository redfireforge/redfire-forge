/**
 * Browse-helpers catalog for API Mock response templates.
 * Only helpers and context paths the template engine actually resolves.
 */
import { FAKER_HELPER_PATHS, type FakerHelperPath } from './templateFaker';

export const TEMPLATE_ENGINE_HELPER_NAMES = [
  'pathParam', 'query', 'header', 'cookie', 'state', 'counter',
  'uuid', 'now', 'randomInt', 'oneOf', 'repeat', 'base64', 'jsonPath', 'faker',
] as const;

export type TemplateEngineHelperName = (typeof TEMPLATE_ENGINE_HELPER_NAMES)[number];

export type TemplateHelperCategory =
  | 'request'
  | 'context'
  | 'identity'
  | 'random'
  | 'transform'
  | 'state'
  | 'faker';

export const TEMPLATE_HELPER_CATEGORY_ORDER: TemplateHelperCategory[] = [
  'request', 'context', 'identity', 'random', 'transform', 'state', 'faker',
];

export const TEMPLATE_HELPER_CATEGORY_LABELS: Record<TemplateHelperCategory, string> = {
  request: 'Request',
  context: 'Context',
  identity: 'Identity & time',
  random: 'Random',
  transform: 'Transform',
  state: 'State & variables',
  faker: 'Faker',
};

export type TemplateHelperNavId = TemplateHelperCategory | 'all';

export const TEMPLATE_HELPER_NAV_LABELS: Record<TemplateHelperNavId, string> = {
  all: 'All',
  request: 'Request',
  context: 'Context',
  identity: 'Identity',
  random: 'Random',
  transform: 'Transform',
  state: 'State',
  faker: 'Faker',
};

export interface TemplateHelperNavItem {
  id: TemplateHelperNavId;
  label: string;
  count: number;
}

export interface TemplateHelperEntry {
  id: string;
  name: string;
  snippet: string;
  detail: string;
  category: TemplateHelperCategory;
  /** Engine helper name when this row is a `{{name …}}` call. */
  engineName?: TemplateEngineHelperName;
}

const FAKER_DETAILS: Record<FakerHelperPath, string> = {
  'person.firstName': 'Given name from the curated person set',
  'person.lastName': 'Family name from the curated person set',
  'person.fullName': 'First and last name together',
  'internet.email': 'example.test address built from the person set',
  'internet.userName': 'Dotted first.last user name',
  'location.city': 'City from the curated location set',
  'lorem.word': 'Single placeholder word',
  'lorem.sentence': 'Short placeholder sentence',
  'string.alphanumeric': 'Eight-character alphanumeric token',
  'string.uuid': 'Deterministic UUID-shaped string (seeded when seed is set)',
  'number.int': 'Integer from 0–9999',
  'datatype.boolean': 'true or false',
  'commerce.product': 'Product noun from the curated set',
  'phone.number': 'US-style +1-555-01xx number',
};

const CORE_HELPERS: TemplateHelperEntry[] = [
  {
    id: 'pathParam',
    name: 'pathParam',
    snippet: "{{pathParam 'id'}}",
    detail: 'Named path parameter from the matched route (for example :id).',
    category: 'request',
    engineName: 'pathParam',
  },
  {
    id: 'query',
    name: 'query',
    snippet: "{{query 'q'}}",
    detail: 'First value of a query-string key.',
    category: 'request',
    engineName: 'query',
  },
  {
    id: 'header',
    name: 'header',
    snippet: "{{header 'X-Tenant'}}",
    detail: 'Request header value (name is matched case-insensitively).',
    category: 'request',
    engineName: 'header',
  },
  {
    id: 'cookie',
    name: 'cookie',
    snippet: "{{cookie 'session'}}",
    detail: 'Request cookie value.',
    category: 'request',
    engineName: 'cookie',
  },
  {
    id: 'jsonPath',
    name: 'jsonPath',
    snippet: "{{jsonPath '$.user.name'}}",
    detail: 'JSONPath against the parsed request body.',
    category: 'request',
    engineName: 'jsonPath',
  },
  {
    id: 'request.method',
    name: 'request.method',
    snippet: '{{request.method}}',
    detail: 'HTTP method of the incoming request.',
    category: 'context',
  },
  {
    id: 'request.path',
    name: 'request.path',
    snippet: '{{request.path}}',
    detail: 'Request path as received.',
    category: 'context',
  },
  {
    id: 'seed',
    name: 'seed',
    snippet: '{{seed}}',
    detail: 'Template seed. When set, randomInt, oneOf, and faker stay deterministic.',
    category: 'context',
  },
  {
    id: 'uuid',
    name: 'uuid',
    snippet: '{{uuid}}',
    detail: 'Random UUID v4.',
    category: 'identity',
    engineName: 'uuid',
  },
  {
    id: 'now',
    name: 'now',
    snippet: '{{now}}',
    detail: 'ISO-8601 timestamp from the template clock.',
    category: 'identity',
    engineName: 'now',
  },
  {
    id: 'randomInt',
    name: 'randomInt',
    snippet: "{{randomInt '1' '100'}}",
    detail: 'Integer in the inclusive range. Seeded when seed is set.',
    category: 'random',
    engineName: 'randomInt',
  },
  {
    id: 'oneOf',
    name: 'oneOf',
    snippet: "{{oneOf 'a' 'b'}}",
    detail: 'Pick one of the listed values. Seeded when seed is set.',
    category: 'random',
    engineName: 'oneOf',
  },
  {
    id: 'faker',
    name: 'faker',
    snippet: "{{faker 'person.firstName'}}",
    detail: 'Curated faker path. Unknown paths report a template error instead of a blank string.',
    category: 'random',
    engineName: 'faker',
  },
  {
    id: 'repeat',
    name: 'repeat',
    snippet: "{{repeat '3' 'ab'}}",
    detail: 'Repeat a string up to 100 times.',
    category: 'transform',
    engineName: 'repeat',
  },
  {
    id: 'base64',
    name: 'base64',
    snippet: "{{base64 'hello'}}",
    detail: "Base64 encode. Pass 'decode' as the second argument to decode.",
    category: 'transform',
    engineName: 'base64',
  },
  {
    id: 'state',
    name: 'state',
    snippet: "{{state 'flow'}}",
    detail: 'Named scenario state value.',
    category: 'state',
    engineName: 'state',
  },
  {
    id: 'counter',
    name: 'counter',
    snippet: "{{counter 'hits'}}",
    detail: 'Named scenario counter (0 when unset).',
    category: 'state',
    engineName: 'counter',
  },
  {
    id: 'variables',
    name: 'variables',
    snippet: '{{variables.tenant}}',
    detail: 'Server variable by key. Replace tenant with any variable name.',
    category: 'state',
  },
];

const FAKER_HELPERS: TemplateHelperEntry[] = FAKER_HELPER_PATHS.map(path => ({
  id: `faker:${path}`,
  name: `faker ${path}`,
  snippet: `{{faker '${path}'}}`,
  detail: FAKER_DETAILS[path],
  category: 'faker' as const,
  engineName: 'faker' as const,
}));

export const TEMPLATE_HELPER_CATALOG: TemplateHelperEntry[] = [
  ...CORE_HELPERS,
  ...FAKER_HELPERS,
];

export function filterTemplateHelpers(
  query: string,
  helpers: readonly TemplateHelperEntry[] = TEMPLATE_HELPER_CATALOG,
): TemplateHelperEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...helpers];
  return helpers.filter(entry => (
    entry.name.toLowerCase().includes(q)
    || entry.snippet.toLowerCase().includes(q)
    || entry.detail.toLowerCase().includes(q)
    || entry.category.toLowerCase().includes(q)
    || TEMPLATE_HELPER_CATEGORY_LABELS[entry.category].toLowerCase().includes(q)
  ));
}

export interface TemplateHelperGroup {
  category: TemplateHelperCategory;
  label: string;
  items: TemplateHelperEntry[];
}

export function groupTemplateHelpers(helpers: readonly TemplateHelperEntry[]): TemplateHelperGroup[] {
  return TEMPLATE_HELPER_CATEGORY_ORDER
    .map(category => ({
      category,
      label: TEMPLATE_HELPER_CATEGORY_LABELS[category],
      items: helpers.filter(entry => entry.category === category),
    }))
    .filter(group => group.items.length > 0);
}

export function scopeTemplateHelpers(
  helpers: readonly TemplateHelperEntry[],
  category: TemplateHelperNavId,
): TemplateHelperEntry[] {
  if (category === 'all') return [...helpers];
  return helpers.filter(entry => entry.category === category);
}

export function templateHelperNavItems(
  helpers: readonly TemplateHelperEntry[],
): TemplateHelperNavItem[] {
  const groups = groupTemplateHelpers(helpers);
  return [
    { id: 'all', label: TEMPLATE_HELPER_NAV_LABELS.all, count: helpers.length },
    ...groups.map(group => ({
      id: group.category,
      label: TEMPLATE_HELPER_NAV_LABELS[group.category],
      count: group.items.length,
    })),
  ];
}

export function nextHelperMatch(index: number, length: number, direction: 1 | -1): number {
  if (length <= 0) return 0;
  return (index + direction + length) % length;
}

export function formatHelperCatalogCount(filtered: number, total: number): string {
  return `${filtered}/${total}`;
}

/** Append a helper snippet on its own line so the body stays readable. */
export function insertTemplateSnippet(body: string, snippet: string): string {
  const trimmed = body.replace(/\s+$/, '');
  if (!trimmed) return snippet;
  return `${trimmed}\n${snippet}`;
}

export async function copyTemplateSnippet(
  text: string,
  clipboard?: Pick<Clipboard, 'writeText'>,
): Promise<boolean> {
  try {
    await (clipboard ?? navigator.clipboard).writeText(text);
    return true;
  } catch {
    return false;
  }
}
