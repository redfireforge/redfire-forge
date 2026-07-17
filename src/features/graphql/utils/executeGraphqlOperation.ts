/**
 * executeGraphqlOperation — standalone single-shot GraphQL executor.
 *
 * Used by the Collection Runner (3A-8) and any other non-hook caller that needs
 * to execute a GraphQL operation without going through the full React execution
 * hook (which owns AbortController, polling, incremental delivery, etc.).
 *
 * This is the simple path: JSON body → POST → parse response → GraphqlResponse.
 * File upload and @defer/@stream are NOT supported here.
 */

import { gqlFetch } from './gqlFetch';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import type { GraphqlError, GraphqlResponse } from '../../../shared/types/graphql';

export interface ExecuteOperationParams {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipTlsVerify?: boolean;
  tls?: GqlTlsSettings;
}

export async function executeGraphqlOperation(params: ExecuteOperationParams): Promise<GraphqlResponse> {
  const { endpoint, query, variables, operationName, headers = {}, signal, skipTlsVerify, tls: tlsInput } = params;
  const tls = tlsInput ?? (skipTlsVerify ? { skipTlsVerify: true } : {});

  const body: Record<string, unknown> = { query };
  if (variables && Object.keys(variables).length > 0) body.variables = variables;
  if (operationName) body.operationName = operationName;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...headers,
  };

  const startTime = performance.now();
  const result = await gqlFetch(endpoint, 'POST', requestHeaders, JSON.stringify(body), signal, tls);
  const latencyMs = Math.round(performance.now() - startTime);

  const response: GraphqlResponse = {
    httpStatus: result.status,
    httpHeaders: result.headers,
    latencyMs,
    timestamp: Date.now(),
  };

  if (result.status === 0 && result.error) {
    response.data = null;
    response.errors = [{ message: result.error }];
    return response;
  }

  try {
    const parsed = JSON.parse(result.body) as Record<string, unknown>;
    response.data = parsed.data ?? null;
    if (Array.isArray(parsed.errors)) {
      response.errors = parsed.errors as GraphqlError[];
    }
    if (parsed.extensions && typeof parsed.extensions === 'object') {
      response.extensions = parsed.extensions as Record<string, unknown>;
    }
  } catch {
    const preview = result.body.length > 200 ? `${result.body.slice(0, 200)}…` : result.body;
    response.data = null;
    response.errors = [{ message: `Server returned a non-JSON response (HTTP ${result.status})`, extensions: { rawPreview: preview } }];
  }

  return response;
}
