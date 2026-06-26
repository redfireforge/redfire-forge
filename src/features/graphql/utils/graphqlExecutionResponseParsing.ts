import type { GraphqlError, GraphqlResponse } from '../../../shared/types/graphql';
import type { ApqInfo } from '../hooks/useGraphqlExecution';
import {
  describeAuthSentMetadata,
  type AuthSentMetadata,
  type GqlAuthSentSource,
} from './gqlAuthResolve';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { GlobalAuthProfile } from '../../../shared/types';

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

export interface AuthSentStampInput {
  source: GqlAuthSentSource;
  storedAuth?: GraphqlAuth | null;
  globalAuthProfiles?: GlobalAuthProfile[];
}

export function authSentFieldsFromMetadata(
  meta: AuthSentMetadata,
): Pick<GraphqlResponse, 'authSentSource' | 'authSentLines'> {
  return {
    authSentSource: meta.source,
    authSentLines: meta.lines,
  };
}

export function buildAuthSentFields(
  requestHeaders: Record<string, string>,
  stamp?: AuthSentStampInput,
): Pick<GraphqlResponse, 'authSentSource' | 'authSentLines'> | undefined {
  if (!stamp) return undefined;
  return authSentFieldsFromMetadata(
    describeAuthSentMetadata(
      stamp.storedAuth ?? null,
      stamp.source,
      stamp.globalAuthProfiles ?? [],
      requestHeaders,
    ),
  );
}

export interface RequestStampInput {
  method?: string;
  body?: Record<string, unknown>;
}

export function stampRequestHeaders(
  response: GraphqlResponse,
  requestHeaders: Record<string, string>,
  authStamp?: AuthSentStampInput,
  requestStamp?: RequestStampInput,
): GraphqlResponse {
  const authFields = buildAuthSentFields(requestHeaders, authStamp);
  const stamped: GraphqlResponse = {
    ...response,
    requestHeaders: { ...requestHeaders },
  };
  if (requestStamp?.method) {
    stamped.requestMethod = requestStamp.method;
  } else {
    delete stamped.requestMethod;
  }
  if (requestStamp?.body && Object.keys(requestStamp.body).length > 0) {
    stamped.requestBody = { ...requestStamp.body };
  } else {
    delete stamped.requestBody;
  }
  if (authFields) {
    stamped.authSentSource = authFields.authSentSource;
    stamped.authSentLines = authFields.authSentLines;
  } else {
    delete stamped.authSentSource;
    delete stamped.authSentLines;
  }
  return stamped;
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
