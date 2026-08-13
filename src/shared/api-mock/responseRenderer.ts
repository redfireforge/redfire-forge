/**
 * Pure response rendering shared by the live listener and simulation preview.
 */
import type {
  ApiMockCapturedRequestV1,
  ApiMockRouteV1,
  ApiMockResponseVariantV1,
  ApiMockTemplateContextV1,
  ApiMockVariableV1,
} from './contracts';
import type { ScenarioState } from './scenarioRuntime';
import { matchPath } from './pathMatcher';
import { stripBasePath } from './predicateEvaluatorHelpers';
import { renderTemplate } from './templateEngine';

export interface RenderVariantInput {
  variant: ApiMockResponseVariantV1 | undefined;
  request: ApiMockCapturedRequestV1;
  route: ApiMockRouteV1;
  basePath: string;
  scenario: ScenarioState;
  variables: ApiMockVariableV1[];
  seed: string;
  maxResponseBodyBytes: number;
  now?: string;
}

export interface RenderedVariant {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  templateErrorCount: number;
}

export function renderResponseVariant(input: RenderVariantInput): RenderedVariant {
  const {
    variant,
    request,
    route,
    basePath,
    scenario,
    variables,
    seed,
    maxResponseBodyBytes,
    now = new Date().toISOString(),
  } = input;

  const status = variant?.status ?? 200;
  const headers: Record<string, string | string[]> = {};
  const setCookies: string[] = [];
  let templateErrorCount = 0;
  const applyTemplate = (value: string): string => {
    if (!value.includes('{{')) return value;
    const rendered = renderTemplate(value, ctx);
    templateErrorCount += rendered.errors.length;
    return rendered.output;
  };
  const pathParams = matchPath(route.path, stripBasePath(request.path, basePath)).params;
  const ctx: ApiMockTemplateContextV1 = {
    request: {
      method: request.method,
      path: request.path,
      pathParams,
      query: request.query,
      headers: request.headers,
      cookies: request.cookies,
      body: (() => {
        if (request.body == null) return null;
        try { return JSON.parse(request.body) as Record<string, unknown>; } catch { return request.body; }
      })(),
      rawBody: request.body ?? '',
    },
    state: { ...scenario.states },
    variables: Object.fromEntries(variables.map(v => [v.key, v.value])),
    counters: { ...scenario.counters },
    now,
    seed,
  };

  for (const h of variant?.headers ?? []) {
    if (!h.enabled) continue;
    headers[h.key] = applyTemplate(h.value);
  }
  const ct = variant?.body.contentType;
  if (ct) headers['Content-Type'] = ct;

  for (const c of variant?.cookies ?? []) {
    if (c.enabled === false) continue;
    const parts = [`${c.name}=${applyTemplate(c.value)}`];
    if (c.path) parts.push(`Path=${c.path}`);
    if (c.domain) parts.push(`Domain=${c.domain}`);
    if (c.maxAge != null) parts.push(`Max-Age=${c.maxAge}`);
    if (c.secure) parts.push('Secure');
    if (c.httpOnly) parts.push('HttpOnly');
    if (c.sameSite) parts.push(`SameSite=${c.sameSite}`);
    setCookies.push(parts.join('; '));
  }
  if (setCookies.length === 1) headers['Set-Cookie'] = setCookies[0];
  else if (setCookies.length > 1) headers['Set-Cookie'] = setCookies;

  const rawBody = variant?.body.content ?? '';
  const body = applyTemplate(rawBody);
  return {
    status,
    headers,
    body: body.length > maxResponseBodyBytes ? body.slice(0, maxResponseBodyBytes) : body,
    templateErrorCount,
  };
}

/** Flatten headers for captured-response shape (string → string[]). */
export function toCapturedHeaders(headers: Record<string, string | string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = Array.isArray(v) ? v : [v];
  }
  return out;
}
