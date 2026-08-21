/**
 * Phase 9E — HAR 1.2 export subset with an explicit compatibility/loss report.
 */
import type { ApiMockCapturedRequestV1, ApiMockSimulationSampleV1, ApiMockTransactionV1 } from './contracts';
import { HAR_IMPORT_LIMITS } from './proxyContracts';

const SECRET_HEADERS = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key', 'api-key', 'x-auth-token',
]);

export interface HarExportOptions {
  host?: string;
  port?: number;
  redact?: boolean;
  /** When true, client URLs use https (TLS mock listeners). */
  tls?: boolean;
}

export interface HarExportResult {
  har: Record<string, unknown>;
  lossReport: string[];
  entryCount: number;
}

interface HarNv {
  name: string;
  value: string;
}

/** Cookie uses "; " (RFC 6265); other combined headers use ", " (RFC 9110). */
export function joinCapturedHeaderValue(name: string, raw: string[] | string | undefined): string {
  if (raw == null) return '';
  const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
  return values.join(name.toLowerCase() === 'cookie' ? '; ' : ', ');
}

function headerPairs(headers: Record<string, string[] | string> | undefined, redact: boolean, secretHits: { n: number }): HarNv[] {
  const out: HarNv[] = [];
  for (const [name, raw] of Object.entries(headers ?? {})) {
    const lower = name.toLowerCase();
    const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    // Set-Cookie is a list of independent headers; Cookie is one "; "-joined header.
    const expanded = lower === 'set-cookie' ? values : [joinCapturedHeaderValue(name, values)];
    for (const value of expanded) {
      if (redact && SECRET_HEADERS.has(lower)) {
        secretHits.n += 1;
        out.push({ name, value: '[REDACTED]' });
      } else {
        out.push({ name, value });
      }
    }
  }
  return out;
}

function cookiePairs(cookies: Record<string, string> | undefined, redact: boolean, secretHits: { n: number }): HarNv[] {
  if (!cookies) return [];
  return Object.entries(cookies).map(([name, value]) => {
    if (redact) secretHits.n += 1;
    return {
      name,
      value: redact ? '[REDACTED]' : value,
    };
  });
}

function queryPairs(query: Record<string, string[] | string> | undefined): HarNv[] {
  const out: HarNv[] = [];
  for (const [name, raw] of Object.entries(query ?? {})) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) out.push({ name, value: String(value) });
  }
  return out;
}

/** Bind-all is not a client-reachable host — replay/HAR/Requests should hit loopback. */
export function mockClientHost(host: string): string {
  return host === '0.0.0.0' ? '127.0.0.1' : host;
}

/** Origin a client should use to reach this mock (TLS + LAN bind rewritten). */
export function mockClientOrigin(host: string, port: number, tls = false): string {
  return `${tls ? 'https' : 'http'}://${mockClientHost(host)}:${port}`;
}

/** Drop captured Authorization/Cookie values so duplicated tabs do not copy secrets. */
export function stripCapturedRequestSecrets(request: ApiMockCapturedRequestV1): ApiMockCapturedRequestV1 {
  const headers = { ...(request.headers ?? {}) };
  for (const key of Object.keys(headers)) {
    if (SECRET_HEADERS.has(key.toLowerCase())) delete headers[key];
  }
  return { ...request, headers, cookies: {}, query: { ...(request.query ?? {}) } };
}

function buildUrl(
  request: Pick<ApiMockCapturedRequestV1, 'rawPath' | 'path' | 'query'>,
  host: string,
  port: number,
  tls = false,
): string {
  const raw = request.rawPath || request.path || '/';
  const prefix = raw.startsWith('/') ? raw : `/${raw}`;
  const origin = mockClientOrigin(host, port, tls);
  if (prefix.includes('?')) return `${origin}${prefix}`;
  const qs = queryPairs(request.query).map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value)}`).join('&');
  return qs ? `${origin}${prefix}?${qs}` : `${origin}${prefix}`;
}

function requestToHar(
  request: ApiMockCapturedRequestV1,
  opts: { host: string; port: number; tls: boolean; redact: boolean; secretHits: { n: number } },
): Record<string, unknown> {
  const headers = headerPairs(request.headers, opts.redact, opts.secretHits);
  const body = typeof request.body === 'string' ? request.body : '';
  return {
    method: request.method,
    url: buildUrl(request, opts.host, opts.port, opts.tls),
    httpVersion: 'HTTP/1.1',
    cookies: cookiePairs(request.cookies, opts.redact, opts.secretHits),
    headers,
    queryString: queryPairs(request.query),
    headersSize: -1,
    bodySize: body ? new TextEncoder().encode(body).length : 0,
    ...(body
      ? { postData: { mimeType: request.contentType ?? 'application/octet-stream', text: body } }
      : {}),
  };
}

function responseToHar(
  tx: Pick<ApiMockTransactionV1, 'response'>,
  redact: boolean,
  secretHits: { n: number },
): Record<string, unknown> {
  const res = tx.response;
  if (!res) {
    return {
      status: 0,
      statusText: '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      content: { size: 0, mimeType: 'x-unknown', text: '' },
      redirectURL: '',
      headersSize: -1,
      bodySize: 0,
    };
  }
  const headers = headerPairs(res.headers, redact, secretHits);
  const body = typeof res.body === 'string' ? res.body : '';
  const contentType = headers.find(h => h.name.toLowerCase() === 'content-type')?.value ?? 'application/octet-stream';
  return {
    status: res.status,
    statusText: '',
    httpVersion: 'HTTP/1.1',
    cookies: (res.cookies ?? []).map(c => {
      if (redact) secretHits.n += 1;
      return {
        name: c.name,
        value: redact ? '[REDACTED]' : c.value,
      };
    }),
    headers,
    content: {
      size: body ? new TextEncoder().encode(body).length : 0,
      mimeType: contentType,
      text: body,
    },
    redirectURL: '',
    headersSize: -1,
    bodySize: body ? new TextEncoder().encode(body).length : 0,
  };
}

function baseLossReport(truncated: boolean, secretHits: number, emptyKind?: string): string[] {
  const lossReport = [
    'Browser timings, pages, cache, and WebSocket frames are omitted.',
    'HTTP version is recorded as HTTP/1.1; HTTP/2 frames are not represented.',
    'Content encoding, compression, and binary payloads are exported as UTF-8 text when present.',
  ];
  if (emptyKind) lossReport.unshift(emptyKind);
  if (truncated) {
    lossReport.push(`Truncated to the ${HAR_IMPORT_LIMITS.maxEntries} most recent entries.`);
  }
  if (secretHits > 0) {
    lossReport.push(`Redacted ${secretHits} secret header/cookie value(s).`);
  }
  return lossReport;
}

function wrapHar(entries: Record<string, unknown>[], lossReport: string[]): HarExportResult {
  return {
    har: {
      log: {
        version: '1.2',
        creator: { name: 'RedfireForge API Mock Studio', version: '1' },
        entries,
      },
      _lossReport: lossReport,
    },
    lossReport,
    entryCount: entries.length,
  };
}

/** Prefer live journal entries; fall back to saved examples when the journal is empty or unusable. */
export function exportHarForStudio(
  transactions: ApiMockTransactionV1[],
  samples: ApiMockSimulationSampleV1[],
  options: HarExportOptions = {},
): HarExportResult {
  if (transactions.length === 0) return exportHarFromSamples(samples, options);
  const fromJournal = exportHarFromTransactions(transactions, options);
  if (fromJournal.entryCount > 0 || samples.length === 0) return fromJournal;
  return exportHarFromSamples(samples, options);
}

/** Export journal transactions as a HAR 1.2 document plus loss notes. */
export function exportHarFromTransactions(
  transactions: ApiMockTransactionV1[],
  options: HarExportOptions = {},
): HarExportResult {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 4600;
  const tls = options.tls ?? false;
  const redact = options.redact ?? true;
  const secretHits = { n: 0 };
  const usable = transactions
    .map((tx, index) => ({ tx, index }))
    .filter((row): row is { tx: ApiMockTransactionV1; index: number } => Boolean(row.tx?.request));
  usable.sort((a, b) => {
    const ta = Date.parse(a.tx.receivedAt);
    const tb = Date.parse(b.tx.receivedAt);
    const na = Number.isFinite(ta) ? ta : 0;
    const nb = Number.isFinite(tb) ? tb : 0;
    if (na !== nb) return na - nb;
    return a.index - b.index;
  });
  const truncated = usable.length > HAR_IMPORT_LIMITS.maxEntries;
  const slice = truncated ? usable.slice(-HAR_IMPORT_LIMITS.maxEntries) : usable;
  const skipped = transactions.length - usable.length;
  const entries: Record<string, unknown>[] = [];
  for (const { tx } of slice) {
    entries.push({
      startedDateTime: tx.receivedAt,
      time: typeof tx.durationMs === 'number' ? tx.durationMs : -1,
      request: requestToHar(tx.request, { host, port, tls, redact, secretHits }),
      response: responseToHar(tx, redact, secretHits),
      cache: {},
      timings: {
        send: 0,
        wait: typeof tx.durationMs === 'number' ? tx.durationMs : -1,
        receive: 0,
      },
      comment: tx.matchedRouteId ? `matchedRouteId=${tx.matchedRouteId}` : tx.outcome,
    });
  }
  const empty = entries.length === 0 && skipped === 0 ? 'Journal was empty — HAR contains no entries.' : undefined;
  const loss = baseLossReport(truncated, secretHits.n, empty);
  if (skipped > 0) loss.push(`Skipped ${skipped} journal row(s) without a captured request.`);
  if (host === '0.0.0.0') loss.push('Bound host 0.0.0.0 was rewritten to 127.0.0.1 for client-reachable URLs.');
  return wrapHar(entries, loss);
}

/** Export saved simulation samples as synthetic HAR entries when no journal is available. */
export function exportHarFromSamples(
  samples: ApiMockSimulationSampleV1[],
  options: HarExportOptions = {},
): HarExportResult {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 4600;
  const tls = options.tls ?? false;
  const redact = options.redact ?? true;
  const secretHits = { n: 0 };
  const truncated = samples.length > HAR_IMPORT_LIMITS.maxEntries;
  const slice = truncated ? samples.slice(-HAR_IMPORT_LIMITS.maxEntries) : samples;
  const entries = slice.map(sample => {
    const status = sample.expected?.status ?? 0;
    const body = sample.expected?.bodyExact ?? '';
    const bodyBytes = body ? new TextEncoder().encode(body).length : 0;
    return {
      startedDateTime: new Date(0).toISOString(),
      time: -1,
      request: requestToHar(sample.request, { host, port, tls, redact, secretHits }),
      response: {
        status,
        statusText: '',
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: [],
        content: { size: bodyBytes, mimeType: 'application/octet-stream', text: body },
        redirectURL: '',
        headersSize: -1,
        bodySize: bodyBytes,
      },
      cache: {},
      timings: { send: 0, wait: -1, receive: 0 },
      comment: `sample:${sample.id}`,
    };
  });
  const extra = [
    'Exported saved examples rather than live journal transactions. Response bodies are expected outcomes, not captured traffic.',
  ];
  if (host === '0.0.0.0') extra.push('Bound host 0.0.0.0 was rewritten to 127.0.0.1 for client-reachable URLs.');
  const empty = entries.length === 0 ? 'No journal rows or saved examples — HAR contains no entries.' : undefined;
  return wrapHar(entries, [...baseLossReport(truncated, secretHits.n, empty), ...extra]);
}
