import type { Scenario } from '../../../shared/types';
import { httpFetch } from '../../../shared/utils/httpClient';
import { serializeWithContentType } from '../../../shared/utils/bodySerializer';
import { buildHeaders, buildUrl } from '../../../engine/executor';
import { TokenManager } from '../../../engine/tokenManager';
import { VariableContext } from './variableContext';
import { resolveScenario } from './resolveScenario';
import { ensureAbsoluteUrlWithBase } from './absoluteUrl';
import { stripTrailingSlash } from '../utils/workflowHostResolve';
import { prettyJson } from '../../../shared/utils/helpers';

export type FetchScenarioSampleResult =
  | { ok: true; body: string; httpStatus: number; finalUrl: string }
  | { ok: false; error: string; body?: string; httpStatus?: number; finalUrl?: string };

function applyHostOverride(url: string, enabled: boolean, override: string): string {
  if (!enabled || !override.trim()) return url;
  try {
    const orig = new URL(url);
    const base = new URL(override.trim().endsWith('/') ? override.trim() : `${override.trim()}/`);
    orig.protocol = base.protocol;
    orig.host = base.host;
    return orig.toString();
  } catch {
    return url;
  }
}

function isAbsoluteHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateOAuth2Configured(auth: Scenario['auth']): string | null {
  if (auth.type !== 'oauth2') return null;
  const missing: string[] = [];
  if (!auth.tokenUrl?.trim()) missing.push('tokenUrl');
  if (!auth.clientId?.trim()) missing.push('clientId');
  if (!auth.clientSecret?.trim()) missing.push('clientSecret');
  if (missing.length === 0) return null;
  return `OAuth2 is missing: ${missing.join(', ')}. Configure the token server in the Auth tab, or use a global profile with complete OAuth2 credentials.`;
}

/**
 * One-off HTTP fetch for workflow Extract → Pick JSON path (same resolution as Quick Test).
 */
export async function fetchScenarioSample(
  scenario: Scenario,
  liveVariables: Record<string, string>,
  resolvedBaseUrl: string,
  options: { fetchHostEnabled: boolean; fetchHostOverride: string },
): Promise<FetchScenarioSampleResult> {
  const envLayer: Record<string, string> = {};
  const bu = resolvedBaseUrl.trim();
  if (bu) envLayer.baseUrl = stripTrailingSlash(bu);

  const ctx = new VariableContext(liveVariables, envLayer);
  const resolved = resolveScenario(scenario, ctx);
  const resolvedAbs: Scenario = {
    ...resolved,
    url: ensureAbsoluteUrlWithBase(resolved.url, ctx),
  };

  if (!resolvedAbs.url.trim()) {
    return { ok: false, error: 'URL is required on this HTTP step.' };
  }

  if (!isAbsoluteHttpUrl(resolvedAbs.url)) {
    return {
      ok: false,
      error:
        'Could not build an absolute URL. Assign a Service in the Service Registry, or set Environment + Microservice in the toolbar.',
    };
  }

  const oauthErr = validateOAuth2Configured(resolvedAbs.auth);
  if (oauthErr) return { ok: false, error: oauthErr };

  const tokenManager = new TokenManager();
  let token: string | undefined;
  try {
    token = await tokenManager.getToken(resolvedAbs);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const { body: reqBody, contentType } = serializeWithContentType(resolvedAbs);
  const headers = buildHeaders(resolvedAbs, token, contentType);
  let url = buildUrl(resolvedAbs);
  url = applyHostOverride(url, options.fetchHostEnabled, options.fetchHostOverride);

  try {
    const result = await httpFetch(url, resolvedAbs.method, headers, reqBody);
    if (result.error) {
      return { ok: false, error: result.error };
    }
    if (result.status >= 400) {
      return {
        ok: false,
        error: `HTTP ${result.status}: ${result.statusText}`,
        body: result.body || undefined,
        httpStatus: result.status,
        finalUrl: url,
      };
    }
    const pretty = prettyJson(result.body);
    return { ok: true, body: pretty, httpStatus: result.status, finalUrl: url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
