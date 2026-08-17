/**
 * Phase 9B — allowlisted unmatched-request proxy with SSRF controls.
 * Uses hostname allowlist (proxyPolicy) + DNS validation (gRPC outbound policy).
 */
import type http from 'node:http';
import {
  addAntiRecursionHeader,
  checkProxyUrl,
  stripCredentialHeaders,
  stripHopByHopHeaders,
  stripSetCookieFromResponse,
  type ProxyPolicyConfig,
} from '../../src/shared/api-mock/proxyPolicy.js';
import type { ApiMockProxySettingsV1 } from '../../src/shared/api-mock/proxyContracts.js';
import { PROXY_HARD_CEILINGS } from '../../src/shared/api-mock/proxyContracts.js';
import { validateServerOutboundUrlWithDns } from '../grpc/serverOutboundUrlPolicy.js';

export interface ProxyExecutorInput {
  req: http.IncomingMessage;
  proxy: ApiMockProxySettingsV1;
  /** Absolute upstream URL (allowlisted origin + inbound path/query). */
  upstreamUrl: string;
  activeMockPorts: number[];
  body: Buffer | null;
}

export interface ProxyExecutorResult {
  ok: boolean;
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  error?: string;
  redirected?: boolean;
}

export function buildUpstreamUrl(
  allowlistOrigin: string,
  inboundPath: string,
  inboundUrl: string,
): string {
  const base = allowlistOrigin.replace(/\/$/, '');
  let path = inboundPath || '/';
  try {
    const u = new URL(inboundUrl, 'http://localhost');
    path = u.pathname + u.search;
  } catch { /* keep path */ }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function pickAllowlistedOrigin(proxy: ApiMockProxySettingsV1, inboundHostHint?: string): string | undefined {
  if (!proxy.enabled || proxy.allowlist.length === 0) return undefined;
  if (inboundHostHint) {
    const hit = proxy.allowlist.find(a => inboundHostHint.startsWith(a) || a.includes(inboundHostHint));
    if (hit) return hit;
  }
  return proxy.allowlist[0];
}

/** Ordered, non-empty allowlist origins — the failover chain (top to bottom). */
export function listProxyOrigins(proxy: ApiMockProxySettingsV1): string[] {
  if (!proxy.enabled) return [];
  return proxy.allowlist.map(o => o.trim()).filter(Boolean);
}

/**
 * Failover rule: move to the next allowlisted server when the current one cannot
 * be trusted to own the path. A server is "not the owner" when it is unreachable
 * (transport failure → `ok:false`), returns a 5xx, or returns a 404. Any other
 * real HTTP reply (2xx/3xx, or a 4xx like 401/403) is the final answer and stops
 * the chain.
 */
export function shouldTryNextOrigin(result: ProxyExecutorResult): boolean {
  if (!result.ok) return true;
  if (result.status === 404) return true;
  if (result.status >= 500 && result.status <= 599) return true;
  return false;
}

export interface ProxyFailoverInput {
  req: http.IncomingMessage;
  proxy: ApiMockProxySettingsV1;
  /** Inbound path captured by the listener (used to build each upstream URL). */
  capturedPath: string;
  /** Raw inbound URL (`req.url`) so query strings are preserved. */
  inboundUrl: string;
  activeMockPorts: number[];
  body: Buffer | null;
}

export interface ProxyFailoverResult extends ProxyExecutorResult {
  /** The allowlisted origin that produced the returned result (last attempted). */
  attemptedOrigin?: string;
  /** How many origins were tried before stopping. */
  attempts: number;
}

/**
 * Try each allowlisted origin in order until one returns a real answer
 * (see {@link shouldTryNextOrigin}). Returns the last attempt when every origin
 * fails, so the caller still gets a meaningful status/body to deliver and record.
 */
export async function executeProxyWithFailover(input: ProxyFailoverInput): Promise<ProxyFailoverResult> {
  const origins = listProxyOrigins(input.proxy);
  let last: ProxyExecutorResult = {
    ok: false,
    status: 502,
    headers: {},
    body: '',
    error: 'Proxy enabled but allowlist is empty',
  };
  let attempts = 0;
  let attemptedOrigin: string | undefined;
  for (const origin of origins) {
    attempts++;
    attemptedOrigin = origin;
    const upstreamUrl = buildUpstreamUrl(origin, input.capturedPath, input.inboundUrl);
    last = await executeProxy({
      req: input.req,
      proxy: input.proxy,
      upstreamUrl,
      activeMockPorts: input.activeMockPorts,
      body: input.body,
    });
    if (!shouldTryNextOrigin(last)) break;
  }
  return { ...last, attemptedOrigin, attempts };
}

export async function executeProxy(input: ProxyExecutorInput): Promise<ProxyExecutorResult> {
  const { proxy, upstreamUrl, activeMockPorts, body, req } = input;
  const timeoutMs = Math.min(Math.max(1, proxy.timeoutMs), PROXY_HARD_CEILINGS.timeoutMs);
  const maxRedirects = Math.min(Math.max(0, proxy.maxRedirects), PROXY_HARD_CEILINGS.maxRedirects);
  const maxBytes = Math.min(Math.max(1, proxy.maxResponseBytes), PROXY_HARD_CEILINGS.maxResponseBytes);

  const policyConfig: ProxyPolicyConfig = {
    allowedUpstreams: proxy.allowlist,
    forwardCredentialHeaders: proxy.forwardAuth ? proxy.forwardCredentialHeaders : [],
    maxRedirects,
    timeoutMs,
    maxResponseBytes: maxBytes,
  };

  let currentUrl = upstreamUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const policy = checkProxyUrl(currentUrl, policyConfig, activeMockPorts);
    if (!policy.allowed) {
      return { ok: false, status: 502, headers: {}, body: '', error: policy.reason };
    }

    // When blockPrivateNetworks is on, reuse gRPC DNS pinning (rejects private/link-local).
    // When off, allowlist alone governs (still blocked for metadata by checkProxyUrl).
    if (proxy.blockPrivateNetworks) {
      try {
        await validateServerOutboundUrlWithDns(currentUrl);
      } catch (e) {
        return {
          ok: false,
          status: 502,
          headers: {},
          body: '',
          error: e instanceof Error ? e.message : 'DNS/policy rejected upstream',
        };
      }
    }

    let inboundHeaders: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null || k.startsWith(':')) continue;
      inboundHeaders[k] = v;
    }
    if (proxy.stripHopByHop) inboundHeaders = stripHopByHopHeaders(inboundHeaders);
    inboundHeaders = stripCredentialHeaders(
      inboundHeaders,
      proxy.forwardAuth ? proxy.forwardCredentialHeaders : [],
    );
    inboundHeaders = addAntiRecursionHeader(inboundHeaders);
    // Avoid host leakage to wrong upstream
    delete inboundHeaders.host;
    delete inboundHeaders['content-length'];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(currentUrl, {
        method: req.method ?? 'GET',
        headers: flattenHeaders(inboundHeaders),
        body: body && req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())
          ? new Uint8Array(body)
          : undefined,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const loc = res.headers.get('location')!;
        currentUrl = new URL(loc, currentUrl).toString();
        if (hop === maxRedirects) {
          return { ok: false, status: 502, headers: {}, body: '', error: 'Redirect limit exceeded' };
        }
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      const truncated = buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf;
      let headers = headersFromFetch(res.headers);
      headers = stripSetCookieFromResponse(headers);
      if (proxy.stripHopByHop) headers = stripHopByHopHeaders(headers);

      return {
        ok: true,
        status: res.status,
        headers,
        body: truncated.toString('utf8'),
        redirected: hop > 0,
      };
    } catch (e) {
      return {
        ok: false,
        status: 502,
        headers: {},
        body: '',
        error: e instanceof Error ? e.message : 'Proxy fetch failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 502, headers: {}, body: '', error: 'Proxy failed' };
}

function flattenHeaders(headers: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!Array.isArray(v)) {
      out[k] = v;
      continue;
    }
    out[k] = v.join(k.toLowerCase() === 'cookie' ? '; ' : ', ');
  }
  return out;
}

function headersFromFetch(h: Headers): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  h.forEach((value, key) => {
    const existing = out[key];
    if (existing == null) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  });
  return out;
}
