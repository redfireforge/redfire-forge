/**
 * Phase 9E — safe HAR import subset → SourceRequest drafts (inactive until Apply).
 */
import type { ApiMockDiagnosticV1, ApiMockSimulationSampleV1 } from './contracts';
import type { SourceRequest } from './sourceToRule';
import { HAR_IMPORT_LIMITS } from './proxyContracts';
import type { ParsedImportBatch } from './importParsers';
import { sha256HexSync } from './sha256Sync';

const SECRET_HEADERS = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key', 'api-key', 'x-auth-token',
]);

/** Well-known analytics / telemetry hosts that should be auto-filtered on HAR import. */
export const TRACKING_DOMAINS: ReadonlySet<string> = new Set([
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'doubleclick.net', 'googlesyndication.com', 'analytics.google.com',
  'connect.facebook.net', 'hotjar.com', 'mixpanel.com',
  'cdn.segment.com', 'api.segment.io', 'api.amplitude.com', 'cdn.amplitude.com',
  'heapanalytics.com', 'fullstory.com', 'logrocket.com',
  'cdn.logrocket.io', 'cdn.lr-ingest.io',
  'browser-intake-datadoghq.com', 'bam.nr-data.net', 'nr-data.net',
  'clarity.ms',
]);

function isTrackingDomain(host: string): boolean {
  const lower = host.toLowerCase();
  for (const d of TRACKING_DOMAINS) {
    if (lower === d || lower.endsWith(`.${d}`)) return true;
  }
  return false;
}

function diag(code: string, message: string, severity: ApiMockDiagnosticV1['severity'] = 'info'): ApiMockDiagnosticV1 {
  return { code, severity, path: '/import/har', message };
}

interface HarEntry {
  request?: {
    method?: string;
    url?: string;
    headers?: Array<{ name: string; value: string }>;
    postData?: { text?: string; mimeType?: string };
  };
  response?: {
    status?: number;
    headers?: Array<{ name: string; value: string }>;
    content?: { text?: string; mimeType?: string };
  };
}

/** Parse a HAR 1.2 document into import sources with redaction + caps. */
export function parseHarEntries(text: string, fileBytes = text.length): ParsedImportBatch {
  const diagnostics: ApiMockDiagnosticV1[] = [];
  const lossReport: string[] = [];

  if (fileBytes > HAR_IMPORT_LIMITS.maxFileBytes) {
    return {
      sources: [],
      diagnostics: [diag('AMS-IMPORT-HAR-TOO-LARGE', `HAR exceeds ${HAR_IMPORT_LIMITS.maxFileBytes} byte limit.`, 'error')],
      lossReport,
      label: 'HAR',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      sources: [],
      diagnostics: [diag('AMS-IMPORT-PARSE', 'Invalid JSON for HAR document.', 'error')],
      lossReport,
      label: 'HAR',
    };
  }

  const log = (parsed as { log?: { entries?: HarEntry[] } })?.log;
  const entries = log?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      sources: [],
      diagnostics: [diag('AMS-IMPORT-EMPTY', 'No HAR log.entries found.', 'error')],
      lossReport,
      label: 'HAR',
    };
  }

  if (entries.length > HAR_IMPORT_LIMITS.maxEntries) {
    lossReport.push(`Truncated to first ${HAR_IMPORT_LIMITS.maxEntries} of ${entries.length} entries.`);
  }

  const sources: SourceRequest[] = [];
  let secretHits = 0;
  const slice = entries.slice(0, HAR_IMPORT_LIMITS.maxEntries);

  for (let i = 0; i < slice.length; i++) {
    const entry = slice[i];
    const req = entry.request;
    if (!req?.url || !req.method) {
      lossReport.push(`Entry ${i}: missing method/url — skipped.`);
      continue;
    }

    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      lossReport.push(`Entry ${i}: invalid URL — skipped.`);
      continue;
    }

    const headers: Record<string, string> = {};
    for (const h of req.headers ?? []) {
      const name = h.name?.toLowerCase?.() ?? '';
      if (!name) continue;
      if (SECRET_HEADERS.has(name)) {
        secretHits += 1;
        headers[h.name] = '[REDACTED]';
        continue;
      }
      headers[h.name] = h.value;
    }

    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });

    const res = entry.response;
    const resHeaders = res?.headers ?? [];
    const contentType = resHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value
      ?? res?.content?.mimeType
      ?? req.postData?.mimeType;

    sources.push({
      method: req.method.toUpperCase(),
      path: url.pathname || '/',
      headers,
      query: Object.keys(query).length ? query : undefined,
      body: req.postData?.text,
      responseBody: res?.content?.text,
      responseContentType: contentType,
      status: typeof res?.status === 'number' ? res.status : 200,
    });
  }

  if (secretHits > 0) {
    diagnostics.push(diag(
      'AMS-REDACTION-SECRET-DETECTED',
      `Redacted ${secretHits} secret header value(s) from HAR. Review drafts before enabling.`,
      'warning',
    ));
  }
  diagnostics.push(diag('AMS-IMPORT-HAR', `Parsed ${sources.length} HAR entr${sources.length === 1 ? 'y' : 'ies'} as inactive drafts.`, 'info'));
  lossReport.push('Cookies/auth are redacted; browser timings, pages, and WebSocket frames are omitted.');

  return { sources, diagnostics, lossReport, label: 'HAR' };
}

/**
 * Post-process a sample produced by convertSourceToRule/batchToRoutes to set the correct
 * outcome and status based on the original HAR response.
 *
 * convertSourceToRule always defaults to `expected: { outcome: 'matched', status: 200 }`.
 * For HAR entries we need:
 *  - status:  the real HTTP status from the HAR response
 *  - outcome: 'matched' for 1xx/2xx/3xx, 'unmatched' for 4xx/5xx
 */
export function fixHarSampleExpected(
  sample: ApiMockSimulationSampleV1,
  source: SourceRequest,
): ApiMockSimulationSampleV1 {
  const status = source.status ?? 200;
  return {
    ...sample,
    expected: {
      ...sample.expected,
      outcome: status < 400 ? 'matched' : 'unmatched',
      status,
    },
  };
}

// ─────────────────────── B-2: per-entry preview ──────────────────────────────

export interface HarPreviewEntry {
  /** Raw position in the HAR entries array — display-only, not used as checkbox key. */
  index: number;
  method: string;
  path: string;
  host: string;
  status: number;
  /** Why this entry was auto-filtered (undefined = accepted). */
  filteredReason?: 'options-preflight' | 'tracking-domain' | 'non-http' | 'duplicate';
  hasRedactedHeaders: boolean;
}

/** Accepted entry that also carries the pre-built SourceRequest for the confirm step. */
export interface HarPreviewAcceptedEntry extends HarPreviewEntry {
  source: SourceRequest;
}

export interface HarPreviewResult {
  /** Use accepted-array position (0..N-1) for checkbox state — NOT entry.index. */
  accepted: HarPreviewAcceptedEntry[];
  autoFiltered: HarPreviewEntry[];
  secretHits: number;
  truncated: boolean;
  error?: string;
}

/**
 * Pre-parse a HAR document into a reviewable per-entry list.
 * Classifies entries as accepted or auto-filtered (OPTIONS, tracking, duplicate, non-http).
 * Each accepted entry carries a paired SourceRequest so the confirm step can build routes
 * without re-running any parsing — checkboxes use accepted-array positions.
 */
export function previewHarEntries(text: string): HarPreviewResult {
  const accepted: HarPreviewAcceptedEntry[] = [];
  const autoFiltered: HarPreviewEntry[] = [];
  let secretHits = 0;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { accepted, autoFiltered, secretHits, truncated: false, error: 'Invalid JSON for HAR document.' };
  }

  const entries = (parsed as { log?: { entries?: HarEntry[] } })?.log?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { accepted, autoFiltered, secretHits, truncated: false };
  }

  const truncated = entries.length > HAR_IMPORT_LIMITS.maxEntries;
  const slice = entries.slice(0, HAR_IMPORT_LIMITS.maxEntries);
  // Dedup key: "method:path" — second occurrence of the same method+path is a duplicate.
  const seenKeys = new Set<string>();

  for (let i = 0; i < slice.length; i++) {
    const entry = slice[i];
    const req = entry.request;
    if (!req?.url || !req.method) continue;  // malformed — skip silently

    let url: URL;
    try { url = new URL(req.url); } catch { continue; }

    const method = req.method.toUpperCase();
    const path = url.pathname || '/';
    const host = url.hostname;
    const status = typeof entry.response?.status === 'number' ? entry.response.status : 200;

    // Build headers with redaction (shared logic with parseHarEntries).
    let hasRedactedHeaders = false;
    const headers: Record<string, string> = {};
    for (const h of req.headers ?? []) {
      const name = h.name?.toLowerCase?.() ?? '';
      if (!name) continue;
      if (SECRET_HEADERS.has(name)) {
        hasRedactedHeaders = true;
        secretHits++;
        headers[h.name] = '[REDACTED]';
      } else {
        headers[h.name] = h.value;
      }
    }

    const base: HarPreviewEntry = { index: i, method, path, host, status, hasRedactedHeaders };

    // Classify entry — order matters: non-http first, then OPTIONS, then tracking, then dedup.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      autoFiltered.push({ ...base, filteredReason: 'non-http' });
      continue;
    }
    if (method === 'OPTIONS') {
      autoFiltered.push({ ...base, filteredReason: 'options-preflight' });
      continue;
    }
    if (isTrackingDomain(host)) {
      autoFiltered.push({ ...base, filteredReason: 'tracking-domain' });
      continue;
    }
    const dedupKey = `${method}:${path}`;
    if (seenKeys.has(dedupKey)) {
      autoFiltered.push({ ...base, filteredReason: 'duplicate' });
      continue;
    }
    seenKeys.add(dedupKey);

    // Build the paired SourceRequest (same logic as parseHarEntries).
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });
    const res = entry.response;
    const resHeaders = res?.headers ?? [];
    const contentType = resHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value
      ?? res?.content?.mimeType
      ?? req.postData?.mimeType;

    const source: SourceRequest = {
      method,
      path,
      headers,
      query: Object.keys(query).length ? query : undefined,
      body: req.postData?.text,
      responseBody: res?.content?.text,
      responseContentType: contentType,
      status,
    };

    accepted.push({ ...base, source });
  }

  return { accepted, autoFiltered, secretHits, truncated };
}

/**
 * Compute the request fingerprint used to match journal transactions to HAR-sourced routes.
 * Mirrors the fingerprint stored in `ApiMockHarSourceEntryV1.requestFingerprint`.
 */
export function fingerprintRequest(method: string, path: string, body: string | null | undefined): string {
  return sha256HexSync(`${method}::${path}::${(body ?? '').slice(0, 512)}`);
}
