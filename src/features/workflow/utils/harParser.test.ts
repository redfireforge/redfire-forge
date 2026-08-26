import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseHarEntries } from './harParser';

// ── Fixture helpers ───────────────────────────────────────────────────────────

const FIXTURES = join(__dirname, '__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

function buildHar(entries: unknown[]): string {
  return JSON.stringify({ log: { version: '1.2', entries } });
}

function buildEntry(
  method: string,
  url: string,
  options: {
    headers?: Array<{ name: string; value: string }>;
    body?: string;
    bodyMimeType?: string;
    responseStatus?: number;
    responseBody?: string;
    responseContentType?: string;
  } = {},
): unknown {
  return {
    request: {
      method,
      url,
      headers: options.headers ?? [],
      ...(options.body !== undefined
        ? { postData: { mimeType: options.bodyMimeType ?? 'application/json', text: options.body } }
        : {}),
    },
    response: {
      status: options.responseStatus ?? 200,
      headers: options.responseContentType
        ? [{ name: 'Content-Type', value: options.responseContentType }]
        : [],
      content: {
        mimeType: options.responseContentType ?? 'application/json',
        text: options.responseBody ?? '{}',
      },
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('parseHarEntries', () => {
  // ── Error handling ──────────────────────────────────────────────────────

  it('returns error when input is not valid JSON', () => {
    const result = parseHarEntries('not json at all');
    expect(result.error).toMatch(/invalid json/i);
    expect(result.entries).toHaveLength(0);
  });

  it('returns error when input is valid JSON but missing log.entries', () => {
    const result = parseHarEntries('{"log":{}}');
    expect(result.error).toMatch(/log\.entries/i);
    expect(result.entries).toHaveLength(0);
  });

  it('returns error from fixture file sample-invalid.har', () => {
    const result = parseHarEntries(loadFixture('sample-invalid.har'));
    expect(result.error).toBeDefined();
    expect(result.entries).toHaveLength(0);
  });

  it('returns global warning for empty entries array, no error', () => {
    const result = parseHarEntries(loadFixture('sample-empty.har'));
    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
    expect(result.globalWarnings.some((w) => /no entries/i.test(w))).toBe(true);
  });

  // ── Happy path ─────────────────────────────────────────────────────────

  it('parses sample-api.har into 5 entries', () => {
    const result = parseHarEntries(loadFixture('sample-api.har'));
    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(5);
  });

  it('sets method to uppercase', () => {
    const result = parseHarEntries(buildHar([buildEntry('get', 'https://api.example.com/ping')]));
    expect(result.entries[0].method).toBe('GET');
  });

  it('extracts host correctly', () => {
    const result = parseHarEntries(loadFixture('sample-api.har'));
    expect(result.entries.every((e) => e.host === 'api.example.com')).toBe(true);
  });

  it('extracts path without query string', () => {
    const result = parseHarEntries(
      buildHar([buildEntry('GET', 'https://api.example.com/orders?page=1&limit=10')]),
    );
    expect(result.entries[0].path).toBe('/orders');
  });

  it('parses query params from URL into query record', () => {
    const result = parseHarEntries(
      buildHar([buildEntry('GET', 'https://api.example.com/orders?page=1&limit=10')]),
    );
    expect(result.entries[0].query).toEqual({ page: '1', limit: '10' });
  });

  it('sets query to empty object when no query params', () => {
    const result = parseHarEntries(
      buildHar([buildEntry('GET', 'https://api.example.com/users')]),
    );
    expect(result.entries[0].query).toEqual({});
  });

  it('extracts responseStatus from response', () => {
    const result = parseHarEntries(
      buildHar([buildEntry('POST', 'https://api.example.com/items', { responseStatus: 201 })]),
    );
    expect(result.entries[0].responseStatus).toBe(201);
  });

  it('defaults responseStatus to 200 when response is missing', () => {
    const har = JSON.stringify({
      log: {
        entries: [{ request: { method: 'GET', url: 'https://api.example.com/x', headers: [] } }],
      },
    });
    const result = parseHarEntries(har);
    expect(result.entries[0].responseStatus).toBe(200);
  });

  it('captures responseBody from response.content.text', () => {
    const result = parseHarEntries(
      buildHar([buildEntry('GET', 'https://api.example.com/users', { responseBody: '{"id":1}' })]),
    );
    expect(result.entries[0].responseBody).toBe('{"id":1}');
  });

  it('captures responseContentType from response Content-Type header', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/users', {
          responseContentType: 'application/json',
        }),
      ]),
    );
    expect(result.entries[0].responseContentType).toBe('application/json');
  });

  it('captures request body when postData.text is present', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('POST', 'https://api.example.com/users', { body: '{"name":"Alice"}' }),
      ]),
    );
    expect(result.entries[0].body).toBe('{"name":"Alice"}');
  });

  it('sets body to undefined when no postData', () => {
    const result = parseHarEntries(
      buildHar([buildEntry('GET', 'https://api.example.com/users')]),
    );
    expect(result.entries[0].body).toBeUndefined();
  });

  it('sets bodyMimeType from postData.mimeType', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('POST', 'https://api.example.com/items', {
          body: '{"x":1}',
          bodyMimeType: 'application/json',
        }),
      ]),
    );
    expect(result.entries[0].bodyMimeType).toBe('application/json');
  });

  it('returns filteredCount = 0 when nothing is filtered', () => {
    const result = parseHarEntries(loadFixture('sample-api.har'));
    expect(result.filteredCount).toBe(0);
  });

  // ── Filtering ───────────────────────────────────────────────────────────

  it('filters out OPTIONS preflight requests', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('OPTIONS', 'https://api.example.com/resource'),
        buildEntry('GET', 'https://api.example.com/resource'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].method).toBe('GET');
    expect(result.filteredCount).toBe(1);
  });

  it('filters out HEAD requests (not supported by workflow HTTP node)', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('HEAD', 'https://api.example.com/resource'),
        buildEntry('GET', 'https://api.example.com/resource'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].method).toBe('GET');
    expect(result.filteredCount).toBe(1);
  });

  it('filters out CONNECT requests (not supported)', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('CONNECT', 'https://api.example.com/resource'),
        buildEntry('POST', 'https://api.example.com/data', { body: '{}' }),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.filteredCount).toBe(1);
  });

  it('accepts all supported methods: GET, POST, PUT, PATCH, DELETE', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/a'),
        buildEntry('POST', 'https://api.example.com/b', { body: '{}' }),
        buildEntry('PUT', 'https://api.example.com/c', { body: '{}' }),
        buildEntry('PATCH', 'https://api.example.com/d', { body: '{}' }),
        buildEntry('DELETE', 'https://api.example.com/e'),
      ]),
    );
    expect(result.entries).toHaveLength(5);
    expect(result.filteredCount).toBe(0);
  });

  it('filters out non-HTTP URLs (chrome-extension://)', () => {
    const result = parseHarEntries(
      buildHar([
        { request: { method: 'GET', url: 'chrome-extension://abc/page', headers: [] } },
        buildEntry('GET', 'https://api.example.com/ok'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.filteredCount).toBe(1);
  });

  it('filters out non-HTTP URLs (data: URI)', () => {
    const result = parseHarEntries(
      buildHar([
        { request: { method: 'GET', url: 'data:text/html,<h1>test</h1>', headers: [] } },
        buildEntry('GET', 'https://api.example.com/ok'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.filteredCount).toBe(1);
  });

  it('filters out entries with missing method', () => {
    const result = parseHarEntries(
      buildHar([
        { request: { url: 'https://api.example.com/x', headers: [] } },
        buildEntry('GET', 'https://api.example.com/ok'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.filteredCount).toBe(1);
  });

  it('filters out entries with missing url', () => {
    const result = parseHarEntries(
      buildHar([
        { request: { method: 'GET', headers: [] } },
        buildEntry('GET', 'https://api.example.com/ok'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
  });

  it('filters out known tracking domain: google-analytics.com', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://www.google-analytics.com/collect?v=1'),
        buildEntry('GET', 'https://api.example.com/ok'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.trackingFilteredCount).toBe(1);
    expect(result.filteredCount).toBe(1);
  });

  it('filters out known tracking domain: segment.io', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('POST', 'https://api.segment.io/v1/track'),
        buildEntry('GET', 'https://api.example.com/ok'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.trackingFilteredCount).toBe(1);
  });

  it('filters tracking domains and reports trackingFilteredCount separately from filteredCount', () => {
    const result = parseHarEntries(loadFixture('sample-mixed-filters.har'));
    // sample-mixed-filters has: 1 real, 1 OPTIONS, 2 tracking, 1 chrome-extension, 2 duplicates
    expect(result.trackingFilteredCount).toBe(2);
    expect(result.filteredCount).toBeGreaterThanOrEqual(result.trackingFilteredCount);
  });

  // ── Deduplication ───────────────────────────────────────────────────────

  it('deduplicates entries with same method + path + empty body', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/users'),
        buildEntry('GET', 'https://api.example.com/users'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.dedupedCount).toBe(1);
    expect(result.filteredCount).toBe(1);
  });

  it('deduplicates entries with same method + path + same body', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('POST', 'https://api.example.com/users', { body: '{"name":"Bob"}' }),
        buildEntry('POST', 'https://api.example.com/users', { body: '{"name":"Bob"}' }),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.dedupedCount).toBe(1);
  });

  it('does NOT deduplicate entries with same path but different bodies', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('POST', 'https://api.example.com/users', { body: '{"name":"Bob"}' }),
        buildEntry('POST', 'https://api.example.com/users', { body: '{"name":"Carol"}' }),
      ]),
    );
    expect(result.entries).toHaveLength(2);
    expect(result.dedupedCount).toBe(0);
  });

  it('does NOT deduplicate entries with same path but different methods', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/users'),
        buildEntry('POST', 'https://api.example.com/users', { body: '{}' }),
      ]),
    );
    expect(result.entries).toHaveLength(2);
  });

  it('processes fixture sample-duplicates.har correctly', () => {
    const result = parseHarEntries(loadFixture('sample-duplicates.har'));
    // 2x GET /users (dedup to 1) + 2x POST /users body Bob (dedup to 1) + 1x POST /users body Carol
    expect(result.entries).toHaveLength(3);
    expect(result.dedupedCount).toBe(2);
  });

  // ── Header processing ───────────────────────────────────────────────────

  it('redacts Authorization header → {{authToken}}', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [{ name: 'Authorization', value: 'Bearer top-secret-123' }],
        }),
      ]),
    );
    expect(result.entries[0].headers['Authorization']).toBe('{{authToken}}');
    expect(result.entries[0].hasRedactedHeaders).toBe(true);
    expect(result.entries[0].redactedHeaderNames).toContain('Authorization');
  });

  it('redacts Cookie header → {{cookieSession}}', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [{ name: 'Cookie', value: 'session=abc; user=123' }],
        }),
      ]),
    );
    expect(result.entries[0].headers['Cookie']).toBe('{{cookieSession}}');
  });

  it('redacts X-Api-Key header → {{apiKey}}', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [{ name: 'X-Api-Key', value: 'key-9999' }],
        }),
      ]),
    );
    expect(result.entries[0].headers['X-Api-Key']).toBe('{{apiKey}}');
  });

  it('redacts X-Auth-Token header → {{authToken}}', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [{ name: 'X-Auth-Token', value: 'token-abc' }],
        }),
      ]),
    );
    expect(result.entries[0].headers['X-Auth-Token']).toBe('{{authToken}}');
  });

  it('redacts X-Access-Token header → {{accessToken}}', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [{ name: 'X-Access-Token', value: 'tok-xyz' }],
        }),
      ]),
    );
    expect(result.entries[0].headers['X-Access-Token']).toBe('{{accessToken}}');
  });

  it('redacts X-CSRF-Token header → {{csrfToken}}', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [{ name: 'X-CSRF-Token', value: 'csrf-abc' }],
        }),
      ]),
    );
    expect(result.entries[0].headers['X-CSRF-Token']).toBe('{{csrfToken}}');
  });

  it('preserves non-sensitive headers with original casing and value', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [
            { name: 'Accept', value: 'application/json' },
            { name: 'X-Request-Id', value: 'req-001' },
          ],
        }),
      ]),
    );
    expect(result.entries[0].headers['Accept']).toBe('application/json');
    expect(result.entries[0].headers['X-Request-Id']).toBe('req-001');
  });

  it('strips browser-internal headers: host', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [
            { name: 'host', value: 'api.example.com' },
            { name: 'Accept', value: 'application/json' },
          ],
        }),
      ]),
    );
    expect('host' in result.entries[0].headers).toBe(false);
    expect('Accept' in result.entries[0].headers).toBe(true);
  });

  it('strips browser-internal headers: connection, accept-encoding, content-length', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [
            { name: 'connection', value: 'keep-alive' },
            { name: 'accept-encoding', value: 'gzip, deflate, br' },
            { name: 'content-length', value: '42' },
            { name: 'Accept', value: 'application/json' },
          ],
        }),
      ]),
    );
    expect('connection' in result.entries[0].headers).toBe(false);
    expect('accept-encoding' in result.entries[0].headers).toBe(false);
    expect('content-length' in result.entries[0].headers).toBe(false);
    expect(result.entries[0].headers['Accept']).toBe('application/json');
  });

  it('sets hasRedactedHeaders: false when no sensitive headers present', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [{ name: 'Accept', value: 'application/json' }],
        }),
      ]),
    );
    expect(result.entries[0].hasRedactedHeaders).toBe(false);
    expect(result.entries[0].redactedHeaderNames).toHaveLength(0);
  });

  it('lists all redacted header names in redactedHeaderNames', () => {
    const result = parseHarEntries(loadFixture('sample-sensitive-headers.har'));
    const entry = result.entries[0];
    expect(entry.redactedHeaderNames).toContain('Authorization');
    expect(entry.redactedHeaderNames).toContain('Cookie');
    expect(entry.redactedHeaderNames).toContain('X-Api-Key');
    expect(entry.redactedHeaderNames).toContain('X-Auth-Token');
  });

  // ── Warnings ────────────────────────────────────────────────────────────

  it('adds per-entry warning for localhost URL', () => {
    const result = parseHarEntries(loadFixture('sample-localhost.har'));
    expect(result.entries.every((e) => e.warnings.length > 0)).toBe(true);
    expect(result.entries[0].warnings.some((w) => /localhost|private ip/i.test(w))).toBe(true);
  });

  it('adds warning for 127.x.x.x private IP', () => {
    const result = parseHarEntries(loadFixture('sample-localhost.har'));
    const entry127 = result.entries.find((e) => e.host === '127.0.0.1');
    expect(entry127?.warnings.some((w) => /127\.0\.0\.1/.test(w))).toBe(true);
  });

  it('adds warning for 192.168.x.x private IP', () => {
    const result = parseHarEntries(loadFixture('sample-localhost.har'));
    const entryPrivate = result.entries.find((e) => e.host === '192.168.1.10');
    expect(entryPrivate?.warnings.some((w) => /192\.168/.test(w))).toBe(true);
  });

  it('adds warning for IPv6 localhost [::1]', () => {
    const result = parseHarEntries(
      buildHar([buildEntry('GET', 'http://[::1]:8080/api/health')]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].warnings.some((w) => /::1|localhost|private ip/i.test(w))).toBe(true);
  });

  it('does NOT add warnings for public API URLs', () => {
    const result = parseHarEntries(loadFixture('sample-api.har'));
    expect(result.entries.every((e) => e.warnings.length === 0)).toBe(true);
  });

  // ── MAX_ENTRIES cap ─────────────────────────────────────────────────────

  it('caps processing at 500 entries and adds a global warning', () => {
    const entries = Array.from({ length: 510 }, (_, i) =>
      buildEntry('GET', `https://api.example.com/item${i}`),
    );
    const result = parseHarEntries(buildHar(entries));
    expect(result.entries).toHaveLength(500);
    expect(result.globalWarnings.some((w) => /510/.test(w))).toBe(true);
  });

  // ── Mixed fixture ───────────────────────────────────────────────────────

  it('handles entries with no headers array gracefully', () => {
    const har = JSON.stringify({
      log: {
        entries: [{ request: { method: 'GET', url: 'https://api.example.com/x' } }],
      },
    });
    const result = parseHarEntries(har);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].headers).toEqual({});
  });

  it('skips header entries with empty name', () => {
    const result = parseHarEntries(
      buildHar([
        buildEntry('GET', 'https://api.example.com/data', {
          headers: [
            { name: '', value: 'should-be-ignored' },
            // also test null-ish name via raw object
          ],
        }),
      ]),
    );
    expect('' in result.entries[0].headers).toBe(false);
    expect(Object.keys(result.entries[0].headers)).toHaveLength(0);
  });

  it('skips header entries with null/undefined name', () => {
    const har = JSON.stringify({
      log: {
        entries: [
          {
            request: {
              method: 'GET',
              url: 'https://api.example.com/data',
              headers: [
                { name: null, value: 'ignored' },
                { name: 'Accept', value: 'application/json' },
              ],
            },
          },
        ],
      },
    });
    const result = parseHarEntries(har);
    expect(result.entries[0].headers['Accept']).toBe('application/json');
    expect(Object.keys(result.entries[0].headers)).toHaveLength(1);
  });

  it('handles multi-value query params — first value wins', () => {
    const result = parseHarEntries(
      buildHar([buildEntry('GET', 'https://api.example.com/data?tag=a&tag=b&page=1')]),
    );
    // 'tag' appears twice — first value should win
    expect(result.entries[0].query['tag']).toBe('a');
    expect(result.entries[0].query['page']).toBe('1');
  });

  it('filters out entries with a completely malformed URL that cannot be parsed', () => {
    const result = parseHarEntries(
      buildHar([
        { request: { method: 'GET', url: 'not a url at all %%', headers: [] } },
        buildEntry('GET', 'https://api.example.com/ok'),
      ]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.filteredCount).toBe(1);
  });

  it('processes sample-mixed-filters.har: keeps real entries, drops preflight, tracking, extension, deduplicates', () => {
    const result = parseHarEntries(loadFixture('sample-mixed-filters.har'));
    // The fixture has:
    //  1: GET https://api.example.com/status  → accepted
    //  2: OPTIONS https://api.example.com/status → filtered (OPTIONS)
    //  3: GET https://www.google-analytics.com/... → filtered (tracking)
    //  4: POST https://api.segment.io/... → filtered (tracking)
    //  5: GET chrome-extension://... → filtered (non-http)
    //  6: GET https://api.example.com/items → accepted
    //  7: GET https://api.example.com/items → filtered (dupe of 6)
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].path).toBe('/status');
    expect(result.entries[1].path).toBe('/items');
    expect(result.trackingFilteredCount).toBe(2);
    expect(result.dedupedCount).toBe(1);
    // 1 OPTIONS + 2 tracking + 1 chrome-extension + 1 dupe = 5
    expect(result.filteredCount).toBe(5);
  });
});
