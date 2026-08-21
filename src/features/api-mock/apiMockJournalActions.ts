/**
 * Journal actions from mockup 07: Open in Requests, Create route, Copy.
 */
import type {
  ApiMockRouteV1,
  ApiMockCapturedRequestV1,
  ApiMockCapturedResponseV1,
  ApiMockTransactionV1,
  ApiMockSimulationSampleV1,
} from '../../shared/api-mock/contracts';
import { convertSourceToRule } from '../../shared/api-mock/sourceToRule';
import { joinCapturedHeaderValue, mockClientOrigin, stripCapturedRequestSecrets } from '../../shared/api-mock/harExport';
import type { HttpMethod, KeyValue } from '../../shared/types';
import { isClientManagedRequestHeader } from '../../shared/utils/outboundRequestHeaders';

export const API_MOCK_OPEN_IN_REQUESTS_EVENT = 'api-mock-open-in-requests';

export interface ApiMockOpenInRequestsDetail {
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: string;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** Headers safe to replay from Requests / Send (drops connection, host, …). */
function capturedHeadersToKeyValues(
  headers: Record<string, string[] | string> | undefined,
): KeyValue[] {
  return Object.entries(headers ?? {})
    .filter(([key]) => !isClientManagedRequestHeader(key))
    .map(([key, value]) => ({
      key,
      value: joinCapturedHeaderValue(key, value),
      enabled: true,
    }));
}

export function normalizeHttpMethod(method: string): HttpMethod {
  const upper = method.toUpperCase();
  return (HTTP_METHODS.includes(upper as HttpMethod) ? upper : 'GET') as HttpMethod;
}

/** Path + query string (leading slash, no host) for simulate seeds and request URLs. */
export function capturedRequestPath(
  request: Pick<ApiMockCapturedRequestV1, 'rawPath' | 'path' | 'query'>,
): string {
  const raw = request.rawPath || request.path || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path.includes('?')) return path;
  const parts: string[] = [];
  for (const [name, rawValue] of Object.entries(request.query ?? {})) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `${path}?${parts.join('&')}` : path;
}

function capturedRequestUrl(
  request: Pick<ApiMockCapturedRequestV1, 'rawPath' | 'path' | 'query'>,
  host: string,
  port: number,
  tls = false,
): string {
  return `${mockClientOrigin(host, port, tls)}${capturedRequestPath(request)}`;
}

export function transactionToOpenInRequestsDetail(
  tx: ApiMockTransactionV1,
  opts?: { host?: string; port?: number; tls?: boolean },
): ApiMockOpenInRequestsDetail {
  const method = normalizeHttpMethod(tx.request.method);
  const host = opts?.host ?? '127.0.0.1';
  const port = opts?.port ?? 4600;
  const url = capturedRequestUrl(tx.request, host, port, opts?.tls);
  const headers: KeyValue[] = capturedHeadersToKeyValues(tx.request.headers);
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

export function formatJournalRequestPreview(request: ApiMockCapturedRequestV1): string {
  const certLines = [
    request.clientCertSubject ? `Client-Cert-Subject: ${request.clientCertSubject}` : '',
    request.clientCertFingerprint ? `Client-Cert-Fingerprint: ${request.clientCertFingerprint}` : '',
  ].filter(Boolean);
  const headerLines = Object.entries(request.headers ?? {}).map(([k, v]) => `${k}: ${joinCapturedHeaderValue(k, v)}`);
  const head = [`${request.method} ${request.rawPath || request.path}`, ...certLines, ...headerLines].join('\n');
  return request.body ? `${head}\n\n${request.body}` : head;
}

function prettyJournalBody(body: string | null | undefined): string {
  if (!body) return '';
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

export function formatJournalResponsePreview(
  response: ApiMockCapturedResponseV1 | undefined | null,
): string {
  if (!response) return '';
  const status = `HTTP ${response.status}${response.reasonPhrase ? ` ${response.reasonPhrase}` : ''}`;
  const headerLines = Object.entries(response.headers ?? {}).map(([k, v]) => `${k}: ${joinCapturedHeaderValue(k, v)}`);
  const head = [status, ...headerLines].join('\n');
  const body = prettyJournalBody(response.body);
  return body ? `${head}\n\n${body}` : head;
}

export function formatTransactionCopy(tx: ApiMockTransactionV1): string {
  const req = formatJournalRequestPreview(tx.request);
  const res = tx.response
    ? `\n\n---\nHTTP ${tx.response.status}\n${tx.response.body ?? ''}`
    : '\n\n---\n(no response)';
  return `${req}${res}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
      document.body.removeChild(el);
      return Boolean(ok);
    } catch {
      return false;
    }
  }
}

export async function copyTransactionToClipboard(tx: ApiMockTransactionV1): Promise<boolean> {
  return copyTextToClipboard(formatTransactionCopy(tx));
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
      tx.request.clientCertSubject,
      tx.request.clientCertFingerprint,
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

export function sampleToOpenInRequestsDetail(
  sample: { name: string; request: ApiMockCapturedRequestV1 },
  opts?: { host?: string; port?: number; tls?: boolean },
): ApiMockOpenInRequestsDetail {
  const method = normalizeHttpMethod(sample.request.method);
  const host = opts?.host ?? '127.0.0.1';
  const port = opts?.port ?? 4600;
  const url = capturedRequestUrl(sample.request, host, port, opts?.tls);
  const headers: KeyValue[] = capturedHeadersToKeyValues(sample.request.headers);
  return {
    name: sample.name || `Mock example · ${method} ${sample.request.path}`,
    method,
    url,
    headers,
    body: typeof sample.request.body === 'string' ? sample.request.body : '',
  };
}

export function transactionToSample(
  tx: ApiMockTransactionV1,
  opts?: { routeId?: string; name?: string },
): ApiMockSimulationSampleV1 {
  const routeId = opts?.routeId ?? tx.matchedRouteId;
  const method = tx.request.method || 'GET';
  return {
    id: `sample-${crypto.randomUUID().slice(0, 8)}`,
    name: opts?.name ?? `${method} ${tx.request.path}`,
    routeId,
    request: stripCapturedRequestSecrets(tx.request),
    expected: {
      outcome: tx.outcome,
      routeId: tx.matchedRouteId,
      responseId: tx.matchedResponseId,
      status: tx.response?.status,
      bodyExact: typeof tx.response?.body === 'string' ? tx.response.body : undefined,
    },
  };
}

export function transactionToRouteDraft(tx: ApiMockTransactionV1): ApiMockRouteV1 {
  const headers = Object.fromEntries(
    Object.entries(tx.request.headers ?? {}).map(([k, v]) => [k, joinCapturedHeaderValue(k, v)]),
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
