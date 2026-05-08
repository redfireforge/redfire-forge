import type { VariableContext } from './variableContext';
import { stripTrailingSlash } from '../utils/workflowHostResolve';

/**
 * When the scenario URL is path-only (`/api/...` or `api/...`) and `baseUrl` exists in the
 * variable context (Harness Quick Test injection, environment config, or Initial variables),
 * prepend it so `fetch` receives a valid absolute URL. Already-absolute URLs are unchanged.
 */
export function ensureAbsoluteUrlWithBase(url: string, ctx: VariableContext): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  const base = ctx.get('baseUrl') ? stripTrailingSlash(ctx.get('baseUrl')!) : undefined;
  if (!base) return t;
  if (t.startsWith('/')) return `${base}${t}`;
  return `${base}/${t}`;
}
