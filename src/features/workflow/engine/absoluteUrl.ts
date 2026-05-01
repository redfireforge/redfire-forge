import type { VariableContext } from './variableContext';
import { stripTrailingSlash } from '../utils/workflowHostResolve';

/**
 * When the scenario URL is path-only (`/api/...`) and `baseUrl` exists in the variable
 * context (Harness Quick Test injection or Initial variables), prepend it so `fetch` receives
 * a valid absolute URL. Already-absolute URLs are unchanged.
 */
export function ensureAbsoluteUrlWithBase(url: string, ctx: VariableContext): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  const base = ctx.get('baseUrl') ? stripTrailingSlash(ctx.get('baseUrl')!) : undefined;
  if (t.startsWith('/') && base) return `${base}${t}`;
  return t;
}
