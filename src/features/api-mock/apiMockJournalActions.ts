/**
 * Journal actions from mockup 07: Open in Requests, Create route, Copy.
 */
import type { ApiMockRouteV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import { convertSourceToRule } from '../../shared/api-mock/sourceToRule';
import type { HttpMethod, KeyValue } from '../../shared/types';

export const API_MOCK_OPEN_IN_REQUESTS_EVENT = 'api-mock-open-in-requests';

export interface ApiMockOpenInRequestsDetail {
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: string;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function normalizeHttpMethod(method: string): HttpMethod {
  const upper = method.toUpperCase();
  return (HTTP_METHODS.includes(upper as HttpMethod) ? upper : 'GET') as HttpMethod;
}

export function transactionToOpenInRequestsDetail(
  tx: ApiMockTransactionV1,
  opts?: { host?: string; port?: number },
): ApiMockOpenInRequestsDetail {
  const method = normalizeHttpMethod(tx.request.method);
  const host = opts?.host ?? '127.0.0.1';
  const port = opts?.port ?? 4600;
  const url = `http://${host}:${port}${tx.request.rawPath || tx.request.path}`;
  const headers: KeyValue[] = Object.entries(tx.request.headers).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join(', ') : String(value),
    enabled: true,
  }));
  return {
    name: `Mock journal · ${method} ${tx.request.path}`,
    method,
    url,
    headers,
    body: typeof tx.request.body === 'string' ? tx.request.body : '',
  };
}

export function dispatchOpenInRequests(detail: ApiMockOpenInRequestsDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(API_MOCK_OPEN_IN_REQUESTS_EVENT, { detail }));
}

export function formatTransactionCopy(tx: ApiMockTransactionV1): string {
  const reqHeaders = Object.entries(tx.request.headers)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
  const req = `${tx.request.method} ${tx.request.rawPath || tx.request.path}\n${reqHeaders}${tx.request.body ? `\n\n${tx.request.body}` : ''}`;
  const res = tx.response
    ? `\n\n---\nHTTP ${tx.response.status}\n${tx.response.body ?? ''}`
    : '\n\n---\n(no response)';
  return `${req}${res}`;
}

export async function copyTransactionToClipboard(tx: ApiMockTransactionV1): Promise<boolean> {
  const text = formatTransactionCopy(tx);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Filter journal rows by path, status, outcome, or matched rule id/name text. */
export function filterTransactions(
  transactions: ApiMockTransactionV1[],
  query: string,
  routeLabel?: (routeId?: string) => string,
): ApiMockTransactionV1[] {
  const q = query.trim().toLowerCase();
  if (!q) return transactions;
  return transactions.filter(tx => {
    const status = String(tx.response?.status ?? tx.outcome);
    const rule = routeLabel?.(tx.matchedRouteId) ?? tx.matchedRouteId ?? '';
    const hay = [
      tx.request.method,
      tx.request.path,
      tx.request.rawPath,
      status,
      tx.outcome,
      rule,
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function exportTransactionsJson(transactions: ApiMockTransactionV1[], serverName?: string): void {
  const blob = new Blob(
    [JSON.stringify({
      _exportMeta: {
        kind: 'api-mock-journal',
        exportedAt: new Date().toISOString(),
        serverName: serverName ?? 'mock-server',
        count: transactions.length,
      },
      data: { transactions },
    }, null, 2)],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-mock-journal-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function transactionToRouteDraft(tx: ApiMockTransactionV1): ApiMockRouteV1 {
  const headers = Object.fromEntries(
    Object.entries(tx.request.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]),
  );
  const query = Object.fromEntries(
    Object.entries(tx.request.query ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? '' : String(v)]),
  );
  const resHeaders = tx.response?.headers ?? {};
  const contentType = (() => {
    for (const [k, v] of Object.entries(resHeaders)) {
      if (k.toLowerCase() === 'content-type') return Array.isArray(v) ? v[0] : String(v);
    }
    return undefined;
  })();
  const result = convertSourceToRule(
    {
      method: tx.request.method,
      path: tx.request.path,
      headers,
      query,
      body: typeof tx.request.body === 'string' ? tx.request.body : undefined,
      contentType: headers['content-type'] ?? headers['Content-Type'],
      responseBody: typeof tx.response?.body === 'string' ? tx.response.body : undefined,
      responseContentType: contentType,
      status: tx.response?.status,
    },
    {
      sourceKind: 'journal',
      sourceLabel: tx.outcome === 'proxied' ? 'Proxy journal' : 'Journal transaction',
    },
  );
  return { ...result.route, enabled: false };
}
