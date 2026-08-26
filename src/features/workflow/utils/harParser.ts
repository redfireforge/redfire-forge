/**
 * HAR parser for Workflow import (Track A — L-10).
 *
 * Parses a HAR 1.2 JSON string into normalized, workflow-ready entries.
 * - Filters OPTIONS preflight, non-HTTP URLs, and known tracking domains
 * - Deduplicates exact (method + path + body) matches
 * - Redacts sensitive headers, replacing values with {{variableName}} placeholders
 * - Emits per-entry warnings for localhost / private-IP URLs
 * - Never throws — all errors are returned in the result
 */

export interface ParsedHarEntry {
  /** Uppercase HTTP method */
  method: string;
  /** Full original URL e.g. "https://api.example.com/users/123" */
  url: string;
  /** Extracted hostname e.g. "api.example.com" */
  host: string;
  /** Path without query string e.g. "/users/123" */
  path: string;
  /** Query params as key→value map (first value wins for multi-value params) */
  query: Record<string, string>;
  /**
   * Request headers with original casing.
   * Sensitive header values replaced with {{variableName}} placeholders.
   */
  headers: Record<string, string>;
  /** True when at least one header value was redacted */
  hasRedactedHeaders: boolean;
  /** Names of headers whose values were redacted, for UI display */
  redactedHeaderNames: string[];
  /** Raw request body text (undefined when no body) */
  body?: string;
  /** MIME type of the request body */
  bodyMimeType?: string;
  /** HTTP response status code (used by Phase 4 chain detection) */
  responseStatus: number;
  /** Raw response body text (used by Phase 4 chain detection) */
  responseBody?: string;
  /** Response Content-Type */
  responseContentType?: string;
  /** Per-entry warnings e.g. localhost URL detected */
  warnings: string[];
}

export interface HarParseResult {
  /** Accepted, normalized entries in original HAR order */
  entries: ParsedHarEntry[];
  /** File-level warnings (not specific to a single entry) */
  globalWarnings: string[];
  /** Total entries skipped by all filters combined */
  filteredCount: number;
  /** Entries skipped because their host matches a known tracking domain */
  trackingFilteredCount: number;
  /** Entries skipped because they were exact duplicates of an earlier entry */
  dedupedCount: number;
  /** Present only when the file cannot be parsed at all (invalid JSON, wrong structure) */
  error?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Sensitive request header names (lowercase) → placeholder variable name.
 * These values are replaced in the parsed output so credentials are never
 * stored in workflow definitions.
 */
const SENSITIVE_HEADERS: Record<string, string> = {
  authorization: '{{authToken}}',
  'proxy-authorization': '{{proxyAuth}}',
  cookie: '{{cookieSession}}',
  'set-cookie': '{{cookieSession}}',
  'x-api-key': '{{apiKey}}',
  'api-key': '{{apiKey}}',
  'x-auth-token': '{{authToken}}',
  'x-access-token': '{{accessToken}}',
  'x-csrf-token': '{{csrfToken}}',
};

/**
 * Hostname substrings that identify analytics / tracking traffic.
 * Entries whose host ends with any of these strings are filtered out silently.
 */
const TRACKING_DOMAINS: readonly string[] = [
  'google-analytics.com',
  'googletagmanager.com',
  'analytics.google.com',
  'stats.g.doubleclick.net',
  'hotjar.com',
  'fullstory.com',
  'segment.io',
  'segment.com',
  'mixpanel.com',
  'amplitude.com',
  'heap.io',
  'sentry.io',
  'rollbar.com',
  'bugsnag.com',
  'datadoghq.com',
  'newrelic.com',
  'logrocket.com',
  'mouseflow.com',
];

/**
 * Browser-managed request headers that should be stripped before storing in a
 * workflow node — they are set automatically by the browser / fetch layer and
 * will cause issues if re-sent manually.
 */
const BROWSER_INTERNAL_HEADERS: ReadonlySet<string> = new Set([
  'host',
  'connection',
  'accept-encoding',
  'content-length',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
]);

/** Regex matching localhost and RFC-1918 private IPv4 addresses */
const PRIVATE_HOST_RE =
  /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

/** Maximum number of HAR entries to process (safety cap for very large HAR files) */
const MAX_ENTRIES = 500;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a HAR 1.2 JSON string into workflow-ready entries.
 *
 * @param text - Raw contents of a `.har` file
 * @returns HarParseResult — never throws
 */
export function parseHarEntries(text: string): HarParseResult {
  // ── Step 1: JSON parse ───────────────────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return makeErrorResult('Invalid JSON — not a valid HAR file.');
  }

  // ── Step 2: Validate HAR envelope ───────────────────────────────────────
  const rawEntries = (parsed as { log?: { entries?: unknown[] } } | null)?.log?.entries;
  if (!Array.isArray(rawEntries)) {
    return makeErrorResult('HAR file is missing "log.entries" array.');
  }
  if (rawEntries.length === 0) {
    return {
      entries: [],
      globalWarnings: ['HAR file contains no entries.'],
      filteredCount: 0,
      trackingFilteredCount: 0,
      dedupedCount: 0,
    };
  }

  // ── Step 3: Process entries ──────────────────────────────────────────────
  const globalWarnings: string[] = [];
  let filteredCount = 0;
  let trackingFilteredCount = 0;
  let dedupedCount = 0;

  // Dedup key: method + pathname + body (normalised)
  const seenKeys = new Set<string>();
  const result: ParsedHarEntry[] = [];

  const slice =
    rawEntries.length > MAX_ENTRIES
      ? (globalWarnings.push(
          `HAR has ${rawEntries.length} entries — only the first ${MAX_ENTRIES} are imported.`,
        ),
        rawEntries.slice(0, MAX_ENTRIES))
      : rawEntries;

  for (const rawEntry of slice) {
    const entry = rawEntry as {
      request?: {
        method?: string;
        url?: string;
        headers?: Array<{ name: string; value: string }>;
        postData?: { mimeType?: string; text?: string };
      };
      response?: {
        status?: number;
        headers?: Array<{ name: string; value: string }>;
        content?: { mimeType?: string; text?: string };
      };
    };

    const req = entry?.request;
    if (!req?.url || !req?.method) {
      filteredCount++;
      continue;
    }

    const method = req.method.toUpperCase();

    // Filter: OPTIONS (CORS preflight)
    if (method === 'OPTIONS') {
      filteredCount++;
      continue;
    }

    // Filter: non-HTTP(S) URLs
    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      filteredCount++;
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      filteredCount++;
      continue;
    }

    const host = url.hostname;

    // Filter: tracking / analytics domains
    if (TRACKING_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      trackingFilteredCount++;
      filteredCount++;
      continue;
    }

    // Filter: exact duplicates (method + pathname + normalised body)
    const bodyText = req.postData?.text ?? '';
    const dedupeKey = `${method}::${url.pathname}::${bodyText}`;
    if (seenKeys.has(dedupeKey)) {
      dedupedCount++;
      filteredCount++;
      continue;
    }
    seenKeys.add(dedupeKey);

    // ── Process headers ────────────────────────────────────────────────────
    const headers: Record<string, string> = {};
    const redactedHeaderNames: string[] = [];

    for (const h of req.headers ?? []) {
      const nameLower = (h.name ?? '').toLowerCase();
      if (!nameLower) continue;

      // Strip browser-internal headers
      if (BROWSER_INTERNAL_HEADERS.has(nameLower)) continue;

      if (nameLower in SENSITIVE_HEADERS) {
        headers[h.name] = SENSITIVE_HEADERS[nameLower];
        redactedHeaderNames.push(h.name);
      } else {
        headers[h.name] = h.value;
      }
    }

    // ── Query params ───────────────────────────────────────────────────────
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      // First value wins for multi-value params
      if (!(key in query)) {
        query[key] = value;
      }
    });

    // ── Response data ──────────────────────────────────────────────────────
    const res = entry?.response;
    const responseStatus = typeof res?.status === 'number' ? res.status : 200;
    const responseBody = res?.content?.text;
    const responseContentType =
      res?.headers?.find((h) => h.name.toLowerCase() === 'content-type')?.value ??
      res?.content?.mimeType;

    // ── Per-entry warnings ─────────────────────────────────────────────────
    const warnings: string[] = [];
    if (PRIVATE_HOST_RE.test(host)) {
      warnings.push(
        `URL points to ${host} (localhost/private IP) — may not be reachable from other machines.`,
      );
    }

    result.push({
      method,
      url: req.url,
      host,
      path: url.pathname,
      query,
      headers,
      hasRedactedHeaders: redactedHeaderNames.length > 0,
      redactedHeaderNames,
      body: bodyText !== '' ? bodyText : undefined,
      bodyMimeType: req.postData?.mimeType,
      responseStatus,
      responseBody,
      responseContentType,
      warnings,
    });
  }

  return {
    entries: result,
    globalWarnings,
    filteredCount,
    trackingFilteredCount,
    dedupedCount,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function makeErrorResult(error: string): HarParseResult {
  return {
    entries: [],
    globalWarnings: [],
    filteredCount: 0,
    trackingFilteredCount: 0,
    dedupedCount: 0,
    error,
  };
}
