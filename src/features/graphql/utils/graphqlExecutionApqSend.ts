import type { GqlTlsSettings } from '@shared/types/gqlTls';
import { gqlRequiresTlsProxy, tlsApqGetNeedsPostProxy } from '@shared/types/gqlTls';
import { getProxyBase } from '../utils/graphqlProxyTransports';
import { gqlFetch } from '../utils/gqlFetch';
import { parseHttpBody } from '../utils/graphqlExecutionResponseParsing';
import type { APQSendFn } from '../utils/apqClient';

export interface BuildApqSendFnParams {
  endpoint: string;
  tls: GqlTlsSettings;
  headers: Record<string, string>;
  requestHeaders: Record<string, string>;
  requestBody: Record<string, unknown>;
  startTime: number;
  signal: AbortSignal;
}

/** Builds the APQ two-step sendFn (GET hash-only or POST full query). */
export function buildApqSendFn(params: BuildApqSendFnParams): APQSendFn {
  const {
    endpoint,
    tls,
    headers,
    requestHeaders,
    requestBody,
    startTime,
    signal,
  } = params;

  return async (bodyFields, method) => {
    if (method === 'GET') {
      const getHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
      delete getHeaders['Content-Type'];

      if (gqlRequiresTlsProxy(tls)) {
        if (tlsApqGetNeedsPostProxy(tls)) {
          const postBody: Record<string, unknown> = { ...bodyFields };
          if (requestBody.operationName != null) {
            postBody.operationName = requestBody.operationName;
          }
          const result = await gqlFetch(
            endpoint,
            'POST',
            { 'Content-Type': 'application/json', Accept: 'application/json', ...getHeaders },
            JSON.stringify({
              query: postBody.query,
              ...(postBody.extensions !== undefined ? { extensions: postBody.extensions } : {}),
              ...(postBody.variables !== undefined ? { variables: postBody.variables } : {}),
              ...(postBody.operationName !== undefined ? { operationName: postBody.operationName } : {}),
            }),
            signal,
            tls,
          );
          return parseHttpBody(result.status, result.headers, result.body, Math.round(performance.now() - startTime), result.error);
        }

        const proxyParams = new URLSearchParams();
        proxyParams.set('endpoint', endpoint);
        for (const [k, v] of Object.entries(bodyFields)) {
          proxyParams.set(k, JSON.stringify(v));
        }
        if (requestBody.operationName != null) {
          proxyParams.set('operationName', String(requestBody.operationName));
        }
        if (tls.skipTlsVerify) proxyParams.set('skipTlsVerify', 'true');
        const result = await gqlFetch(
          `${getProxyBase()}/api/graphql/query?${proxyParams.toString()}`,
          'GET',
          getHeaders,
          undefined,
          signal,
          false,
        );
        return parseHttpBody(result.status, result.headers, result.body, Math.round(performance.now() - startTime), result.error);
      }

      let apqUrl: URL;
      try {
        apqUrl = new URL(endpoint);
      } catch {
        apqUrl = new URL(endpoint, window.location.href);
      }
      for (const [k, v] of Object.entries(bodyFields)) {
        apqUrl.searchParams.set(k, JSON.stringify(v));
      }
      if (requestBody.operationName != null) {
        apqUrl.searchParams.set('operationName', String(requestBody.operationName));
      }
      const result = await gqlFetch(
        apqUrl.toString(),
        'GET',
        getHeaders,
        undefined,
        signal,
        false,
      );
      return parseHttpBody(result.status, result.headers, result.body, Math.round(performance.now() - startTime), result.error);
    }

    const isHashOnly = !('query' in bodyFields);
    const fullBody: Record<string, unknown> = isHashOnly
      ? { ...bodyFields, ...(requestBody.operationName !== undefined ? { operationName: requestBody.operationName } : {}) }
      : { ...requestBody, ...bodyFields };
    const result = await gqlFetch(
      endpoint,
      'POST',
      requestHeaders,
      JSON.stringify(fullBody),
      signal,
      tls,
    );
    return parseHttpBody(result.status, result.headers, result.body, Math.round(performance.now() - startTime), result.error);
  };
}
