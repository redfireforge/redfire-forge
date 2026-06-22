import type { GraphqlError, GraphqlResponse } from '../../../shared/types/graphql';
import type { ApqInfo } from '../hooks/useGraphqlExecution';

/** Parse an HTTP response body into a GraphqlResponse. */
export function parseHttpBody(
  status: number,
  headers: Record<string, string>,
  body: string,
  latencyMs: number,
  error?: string,
): GraphqlResponse {
  const base: GraphqlResponse = {
    httpStatus: status,
    httpHeaders: headers,
    latencyMs,
    timestamp: Date.now(),
  };
  if (status === 0 && error) {
    base.data = null;
    base.errors = [{ message: error }];
    return base;
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    base.data = parsed.data ?? null;
    if (Array.isArray(parsed.errors)) base.errors = parsed.errors as GraphqlError[];
    if (parsed.extensions && typeof parsed.extensions === 'object') {
      base.extensions = parsed.extensions as Record<string, unknown>;
    }
  } catch {
    const preview = body.length > 200 ? `${body.slice(0, 200)}…` : body;
    base.data = null;
    base.errors = [{ message: `Server returned a non-JSON response (HTTP ${status})`, extensions: { rawPreview: preview } }];
  }

  if (status >= 400 && (!base.errors || base.errors.length === 0)) {
    base.data = null;
    base.errors = [{ message: `HTTP ${status}: ${body ? body.slice(0, 100) : 'Server error'}` }];
  }

  return base;
}

export function stampRequestHeaders(
  response: GraphqlResponse,
  requestHeaders: Record<string, string>,
): GraphqlResponse {
  return { ...response, requestHeaders: { ...requestHeaders } };
}

/** Build connection-bar APQ metadata from a stamped GraphqlResponse (dedup wait path). */
export function apqInfoFromResponse(
  response: GraphqlResponse,
  connectionId?: string,
): ApqInfo | null {
  if (!response.apqHash) return null;
  return {
    hash: response.apqHash,
    cacheHit: response.apqCacheHit ?? false,
    unsupported: response.apqUnsupported ?? false,
    connectionId,
  };
}
