/**
 * Editor-side template preview — same engine as the live listener, against a
 * sample request derived from the rule path so {{pathParam}} / {{query}} /
 * {{header}} / {{cookie}} / {{jsonPath}} / {{variables.*}} resolve in the pane.
 */
import type { ApiMockRouteV1, ApiMockTemplateContextV1, ApiMockVariableV1 } from './contracts';
import { pathParamNames } from './pathMatcher';
import { renderTemplate } from './templateEngine';

export const PREVIEW_SAMPLE_ID = '42';
export const PREVIEW_SAMPLE_SKU = 'RF-100';
export const PREVIEW_SAMPLE_TENANT = 'acme';
export const PREVIEW_SAMPLE_SESSION = 'abc';

const TEMPLATE_RE = /\{\{[^}]+\}\}/;

export function isTemplateBody(raw: string): boolean {
  return TEMPLATE_RE.test(raw);
}

/** `/products/:id` → `/products/42`. Unparameterized paths are returned as-is. */
export function samplePathFromPattern(pattern: string): string {
  return pattern
    .replace(/:([A-Za-z_]\w*)/g, PREVIEW_SAMPLE_ID)
    .replace(/\{[^}]+\}/g, PREVIEW_SAMPLE_ID);
}

export function buildPreviewTemplateContext(
  route: Pick<ApiMockRouteV1, 'method' | 'path'>,
  variables: ApiMockVariableV1[] = [],
  now = '2026-08-14T15:00:00.000Z',
): ApiMockTemplateContextV1 {
  const pattern = route.path.value || '/';
  const samplePath = samplePathFromPattern(pattern);
  const names = pathParamNames(pattern);
  const pathParams: Record<string, string> = {};
  for (const name of names) pathParams[name] = PREVIEW_SAMPLE_ID;
  return {
    request: {
      method: route.method === 'ANY' ? 'GET' : route.method,
      path: samplePath,
      pathParams,
      query: { sku: [PREVIEW_SAMPLE_SKU] },
      headers: { 'x-tenant': [PREVIEW_SAMPLE_TENANT] },
      cookies: { session: PREVIEW_SAMPLE_SESSION },
      body: { items: [{ sku: PREVIEW_SAMPLE_SKU }] },
      rawBody: JSON.stringify({ items: [{ sku: PREVIEW_SAMPLE_SKU }] }),
    },
    state: {},
    variables: Object.fromEntries(variables.filter(v => v.key).map(v => [v.key, v.value])),
    counters: {},
    now,
    seed: '',
  };
}

export interface TemplatePreviewResult {
  text: string;
  errors: string[];
  isTemplate: boolean;
  samplePath: string;
  sampleMethod: string;
}

function prettyIfJson(raw: string, contentType: string | undefined): string {
  if (!(contentType ?? '').includes('json')) return raw;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Render a response body the way the preview pane should show it. */
export function previewResponseBody(
  raw: string,
  contentType: string | undefined,
  route: Pick<ApiMockRouteV1, 'method' | 'path'>,
  variables: ApiMockVariableV1[] = [],
): TemplatePreviewResult {
  const samplePath = samplePathFromPattern(route.path.value || '/');
  const sampleMethod = route.method === 'ANY' ? 'GET' : route.method;
  if (!isTemplateBody(raw)) {
    return {
      text: prettyIfJson(raw, contentType) || '',
      errors: [],
      isTemplate: false,
      samplePath,
      sampleMethod,
    };
  }
  const rendered = renderTemplate(raw, buildPreviewTemplateContext(route, variables));
  return {
    text: prettyIfJson(rendered.output, contentType) || rendered.output,
    errors: rendered.errors,
    isTemplate: true,
    samplePath,
    sampleMethod,
  };
}
