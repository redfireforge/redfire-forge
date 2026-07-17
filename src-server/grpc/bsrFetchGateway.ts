/**
 * Phase 3E — Buf Schema Registry (BSR) descriptor fetch gateway.
 *
 * Network strategy (supports home direct + corporate proxy):
 * 1. Honor NO_PROXY — skip proxy for buf.build when listed.
 * 2. Try proxy dispatcher when HTTPS_PROXY/HTTP_PROXY is set.
 * 3. On proxy DNS/connect failure, retry direct (mirrors httpClient.ts).
 * 4. Try canonical descriptor URL, then legacy api/v1 URL on 404/HTML.
 */
import { createRequire } from 'node:module';

export interface BsrModuleReference {
  owner: string;
  repo: string;
  fullName: string;
}

export interface BsrFetchParams {
  module: string;
  version?: string;
  digest?: string;
  token?: string;
}

export interface BsrFetchResult {
  protosetBase64: string;
  module: BsrModuleReference;
  version: string;
  digest?: string;
}

export interface BsrFetchPort {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export class BsrFetchGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BsrFetchGatewayError';
  }
}

let cachedNodeDispatcher: unknown | null = null;
let triedNodeDispatcher = false;

function resolveProxyEnv(): string | null {
  const proxy = process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy;
  return proxy?.trim() || null;
}

function resolveNodeDispatcher(): unknown | null {
  if (triedNodeDispatcher) {
    return cachedNodeDispatcher;
  }
  triedNodeDispatcher = true;

  const proxy = resolveProxyEnv();
  if (!proxy) {
    cachedNodeDispatcher = null;
    return null;
  }

  try {
    const require = createRequire(import.meta.url);
    const undici = require('undici') as {
      EnvHttpProxyAgent?: new () => unknown;
      ProxyAgent?: new (url: string) => unknown;
    };

    if (undici.EnvHttpProxyAgent) {
      cachedNodeDispatcher = new undici.EnvHttpProxyAgent();
      return cachedNodeDispatcher;
    }

    if (undici.ProxyAgent) {
      cachedNodeDispatcher = new undici.ProxyAgent(proxy);
      return cachedNodeDispatcher;
    }
  } catch {
    // Fall back to default fetch when undici dispatcher is unavailable.
  }

  cachedNodeDispatcher = null;
  return null;
}

const PROXY_RETRY_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNRESET',
  'UND_ERR_ABORTED',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function isProxyFetchError(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      if (code && PROXY_RETRY_CODES.has(code)) return true;
      if (/Proxy response \(\d+\) !== 200 when HTTP Tunneling/i.test(current.message)) return true;
      current = current.cause;
      continue;
    }
    break;
  }
  return false;
}

function hostnameMatchesNoProxyEntry(hostname: string, entry: string): boolean {
  const normalized = entry.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === '*') return true;
  const host = hostname.toLowerCase();

  if (normalized.startsWith('.')) {
    return host === normalized.slice(1) || host.endsWith(normalized);
  }

  if (normalized.includes('*')) {
    const pattern = normalized
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${pattern}$`, 'i').test(host);
  }

  return host === normalized;
}

/** Returns true when the URL should bypass HTTPS_PROXY/HTTP_PROXY (NO_PROXY list). */
export function shouldBypassProxyForUrl(url: string): boolean {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (!noProxy?.trim()) return false;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  return noProxy
    .split(',')
    .some((entry) => hostnameMatchesNoProxyEntry(hostname, entry));
}

const defaultFetchPort: BsrFetchPort = {
  fetch: async (url, init) => {
    const bypassProxy = shouldBypassProxyForUrl(url);
    const dispatcher = bypassProxy ? null : resolveNodeDispatcher();
    if (!dispatcher) {
      return globalThis.fetch(url, init);
    }
    try {
      return await globalThis.fetch(url, {
        ...init,
        dispatcher,
      } as RequestInit);
    } catch (proxyError) {
      if (!isProxyFetchError(proxyError)) {
        throw proxyError;
      }
      // Proxy unreachable (e.g. stale corporate proxy env at home) — retry direct.
      return globalThis.fetch(url, init);
    }
  },
};

function formatErrorChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      const msg = code ? `${current.message} [${code}]` : current.message;
      if (msg.trim()) {
        parts.push(msg.trim());
      }
      current = current.cause;
      continue;
    }

    const fallback = String(current).trim();
    if (fallback) {
      parts.push(fallback);
    }
    break;
  }

  return parts.length ? parts.join(' -> ') : 'Unknown network error';
}

function bsrNetworkHint(errorText: string): string | null {
  const upper = errorText.toUpperCase();
  if (upper.includes('ENOTFOUND')) {
    return 'DNS lookup failed for buf.build. Check network/DNS settings.';
  }
  if (upper.includes('ECONNREFUSED') || upper.includes('EHOSTUNREACH') || upper.includes('ENETUNREACH')) {
    return 'Network path to buf.build was refused/unreachable.';
  }
  if (upper.includes('ETIMEDOUT') || upper.includes('UND_ERR_CONNECT_TIMEOUT')) {
    return 'Connection to buf.build timed out.';
  }
  if (upper.includes('SELF_SIGNED_CERT') || upper.includes('CERT_') || upper.includes('TLS')) {
    return 'TLS certificate validation failed when connecting to buf.build.';
  }
  if (upper.includes('PROXY')) {
    return 'Proxy configuration blocked the request to buf.build.';
  }
  return null;
}

export function parseBsrModuleReference(rawModule: string): BsrModuleReference {
  const trimmed = rawModule.trim().replace(/^buf\.build\//, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new BsrFetchGatewayError('BSR module must be owner/repo (e.g. buf.build/acme/echo)');
  }
  const owner = parts[0]!;
  const repo = parts[1]!;
  return {
    owner,
    repo,
    fullName: `buf.build/${owner}/${repo}`,
  };
}

/** Canonical BSR descriptor URL (current registry path). */
export function buildBsrDescriptorUrl(module: BsrModuleReference, version: string): string {
  const ref = encodeURIComponent(version);
  return `https://buf.build/${module.owner}/${module.repo}/descriptor/${ref}`;
}

/** Legacy BSR descriptor URL (pre-phase-13 api/v1 path). */
export function buildBsrDescriptorUrlLegacy(module: BsrModuleReference, version: string): string {
  const ref = encodeURIComponent(version);
  return `https://buf.build/api/v1/modules/${module.owner}/${module.repo}/descriptor?ref=${ref}`;
}

function isRetriableBsrUrlError(error: unknown): boolean {
  if (!(error instanceof BsrFetchGatewayError)) return false;
  return /HTTP 404/i.test(error.message)
    || /returned HTML instead of descriptor bytes/i.test(error.message);
}

interface ParsedBsrDescriptorResponse {
  protosetBase64: string;
  digest?: string;
}

async function parseBsrDescriptorResponse(
  response: Response,
  module: BsrModuleReference,
  version: string,
  params: BsrFetchParams,
): Promise<ParsedBsrDescriptorResponse> {
  const contentType = response.headers.get('content-type') ?? '';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new BsrFetchGatewayError(`BSR returned empty descriptor for ${module.fullName}`);
  }

  if (contentType.includes('text/html')) {
    throw new BsrFetchGatewayError(
      `BSR returned HTML instead of descriptor bytes for ${module.fullName}@${version}. `
      + 'This typically indicates an invalid endpoint or network/proxy content rewrite.',
    );
  }

  let protosetBase64: string;
  if (contentType.includes('application/json')) {
    const json = JSON.parse(buffer.toString('utf8')) as { protosetBase64?: string; descriptorBase64?: string };
    const encoded = json.protosetBase64 ?? json.descriptorBase64;
    if (!encoded?.trim()) {
      throw new BsrFetchGatewayError('BSR JSON response missing protosetBase64');
    }
    protosetBase64 = encoded.trim();
  } else {
    protosetBase64 = buffer.toString('base64');
  }

  const digest = params.digest?.trim()
    || response.headers.get('x-bsr-digest')
    || response.headers.get('etag')
    || undefined;

  return {
    protosetBase64,
    digest: digest?.replace(/^"|"$/g, ''),
  };
}

async function fetchBsrDescriptorFromUrl(
  url: string,
  module: BsrModuleReference,
  version: string,
  params: BsrFetchParams,
  fetchPort: BsrFetchPort,
  signal: AbortSignal,
): Promise<ParsedBsrDescriptorResponse> {
  const headers: Record<string, string> = {
    accept: 'application/octet-stream, application/json, */*',
  };
  if (params.token?.trim()) {
    headers.authorization = `Bearer ${params.token.trim()}`;
  }

  const response = await fetchPort.fetch(url, {
    method: 'GET',
    headers,
    signal,
  });

  if (!response.ok) {
    throw new BsrFetchGatewayError(`BSR fetch failed with HTTP ${response.status} for ${module.fullName}`);
  }

  return parseBsrDescriptorResponse(response, module, version, params);
}

export async function fetchBsrDescriptorSet(
  params: BsrFetchParams,
  options?: {
    fetchPort?: BsrFetchPort;
    timeoutMs?: number;
  },
): Promise<BsrFetchResult> {
  const module = parseBsrModuleReference(params.module);
  const version = params.version?.trim() || 'main';
  const fetchPort = options?.fetchPort ?? defaultFetchPort;
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const urls = [
    buildBsrDescriptorUrl(module, version),
    buildBsrDescriptorUrlLegacy(module, version),
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let lastError: unknown;
    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index]!;
      try {
        const parsed = await fetchBsrDescriptorFromUrl(
          url,
          module,
          version,
          params,
          fetchPort,
          controller.signal,
        );
        return {
          protosetBase64: parsed.protosetBase64,
          module,
          version,
          digest: parsed.digest,
        };
      } catch (error) {
        lastError = error;
        const hasAlternateUrl = index < urls.length - 1;
        if (hasAlternateUrl && isRetriableBsrUrlError(error)) {
          continue;
        }
        if (error instanceof BsrFetchGatewayError) {
          throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          throw new BsrFetchGatewayError(`BSR fetch timed out after ${timeoutMs}ms`);
        }
        const chain = formatErrorChain(error);
        const hint = bsrNetworkHint(chain);
        throw new BsrFetchGatewayError(
          `BSR fetch failed for ${module.fullName}@${version}: ${chain}${hint ? ` (${hint})` : ''}`,
        );
      }
    }

    if (lastError instanceof BsrFetchGatewayError) {
      throw lastError;
    }
    throw new BsrFetchGatewayError(`BSR fetch failed for ${module.fullName}@${version}`);
  } finally {
    clearTimeout(timer);
  }
}
