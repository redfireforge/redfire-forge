/**
 * Phase 3E — Buf Schema Registry (BSR) descriptor fetch gateway.
 */
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

const defaultFetchPort: BsrFetchPort = {
  fetch: (url, init) => globalThis.fetch(url, init),
};

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
  return `https://buf.build/api/v1/modules/${module.owner}/${module.repo}/descriptor?ref=${ref}`;
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
    const message = error instanceof Error ? error.message : String(error);
    throw new BsrFetchGatewayError(`BSR fetch failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}
