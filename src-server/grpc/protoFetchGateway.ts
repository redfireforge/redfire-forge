/**
 * Phase 3E — server-side URL proto fetch gateway.
 */
import {
  protoPathFromFetchUrl,
  ProtoFetchPolicyError,
  validateProtoFetchUrlWithDns,
} from './protoFetchPolicy.js';
import { isGrpcOutboundDnsStrictEnabled } from './grpcOutboundDnsPolicy.js';

export interface ProtoFetchResponse {
  content: string;
  etag?: string;
  resolvedUrl: string;
  protoPath: string;
  /** True when server returned HTTP 304 and cached content should be reused. */
  notModified?: boolean;
}

export interface ProtoFetchPort {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export class ProtoFetchGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtoFetchGatewayError';
  }
}

const defaultFetchPort: ProtoFetchPort = {
  fetch: (url, init) => globalThis.fetch(url, init),
};

/** Maximum proto file size accepted from remote URL fetch (5 MiB). */
export const MAX_PROTO_FETCH_BYTES = 5 * 1024 * 1024;

export async function fetchProtoFromUrl(
  rawUrl: string,
  options?: {
    fetchPort?: ProtoFetchPort;
    allowHttpLocalhost?: boolean;
    timeoutMs?: number;
    ifNoneMatch?: string;
    resolveHostname?: (hostname: string) => Promise<string[]>;
    skipDnsResolution?: boolean;
  },
): Promise<ProtoFetchResponse> {
  let parsed: URL;
  try {
    parsed = await validateProtoFetchUrlWithDns(rawUrl, {
      allowHttpLocalhost: options?.allowHttpLocalhost,
      resolveHostname: options?.resolveHostname,
      skipDnsResolution: options?.skipDnsResolution ?? !isGrpcOutboundDnsStrictEnabled(),
    });
  } catch (error) {
    if (error instanceof ProtoFetchPolicyError) {
      throw new ProtoFetchGatewayError(error.message);
    }
    throw error;
  }

  const fetchPort = options?.fetchPort ?? defaultFetchPort;
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      accept: 'text/plain, application/octet-stream, */*',
    };
    if (options?.ifNoneMatch?.trim()) {
      const tag = options.ifNoneMatch.trim();
      headers['if-none-match'] = tag.startsWith('"') ? tag : `"${tag}"`;
    }

    const response = await fetchPort.fetch(parsed.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'manual',
    });

    if (response.status === 304) {
      if (!options?.ifNoneMatch?.trim()) {
        throw new ProtoFetchGatewayError('Proto fetch returned 304 without a cached etag');
      }
      return {
        content: '',
        etag: options.ifNoneMatch.trim().replace(/^"|"$/g, ''),
        resolvedUrl: parsed.toString(),
        protoPath: protoPathFromFetchUrl(parsed),
        notModified: true,
      };
    }

    if (response.status >= 300 && response.status < 400) {
      throw new ProtoFetchGatewayError('Proto fetch redirects are not allowed');
    }

    if (!response.ok) {
      throw new ProtoFetchGatewayError(`Proto fetch failed with HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const declared = Number(contentLength);
      if (Number.isFinite(declared) && declared > MAX_PROTO_FETCH_BYTES) {
        throw new ProtoFetchGatewayError(
          `Proto fetch response exceeds ${MAX_PROTO_FETCH_BYTES} byte limit`,
        );
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PROTO_FETCH_BYTES) {
      throw new ProtoFetchGatewayError(
        `Proto fetch response exceeds ${MAX_PROTO_FETCH_BYTES} byte limit`,
      );
    }

    const content = buffer.toString('utf8');
    if (!content.trim()) {
      throw new ProtoFetchGatewayError('Proto fetch returned empty content');
    }

    const etag = response.headers.get('etag') ?? undefined;
    return {
      content,
      etag: etag?.replace(/^"|"$/g, ''),
      resolvedUrl: parsed.toString(),
      protoPath: protoPathFromFetchUrl(parsed),
    };
  } catch (error) {
    if (error instanceof ProtoFetchGatewayError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProtoFetchGatewayError(`Proto fetch timed out after ${timeoutMs}ms`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new ProtoFetchGatewayError(`Proto fetch failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}
