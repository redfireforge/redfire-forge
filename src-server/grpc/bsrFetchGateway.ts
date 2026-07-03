/**
 * Phase 3E — Buf Schema Registry (BSR) descriptor fetch gateway.
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

function resolveNodeDispatcher(): unknown | null {
  if (triedNodeDispatcher) {
    return cachedNodeDispatcher;
  }
  triedNodeDispatcher = true;

  const proxy = process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy;

  if (!proxy?.trim()) {
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

const defaultFetchPort: BsrFetchPort = {
  fetch: (url, init) => {
    const dispatcher = resolveNodeDispatcher();
    if (!dispatcher) {
      return globalThis.fetch(url, init);
    }
    return globalThis.fetch(url, {
      ...init,
      dispatcher,
    } as RequestInit);
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

export function buildBsrDescriptorUrl(module: BsrModuleReference, version: string): string {
  const ref = encodeURIComponent(version);
  return `https://buf.build/${module.owner}/${module.repo}/descriptor/${ref}`;
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
  const url = buildBsrDescriptorUrl(module, version);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    accept: 'application/octet-stream, application/json, */*',
  };
  if (params.token?.trim()) {
    headers.authorization = `Bearer ${params.token.trim()}`;
  }

  try {
    const response = await fetchPort.fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new BsrFetchGatewayError(`BSR fetch failed with HTTP ${response.status} for ${module.fullName}`);
    }

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
      module,
      version,
      digest: digest?.replace(/^"|"$/g, ''),
    };
  } catch (error) {
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
  } finally {
    clearTimeout(timer);
  }
}
