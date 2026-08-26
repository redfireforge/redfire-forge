import { describe, expect, it } from 'vitest';
import { parseHarEntries, fixHarSampleExpected, previewHarEntries, fingerprintRequest, TRACKING_DOMAINS } from './harImport';
import { HAR_IMPORT_LIMITS } from './proxyContracts';
import type { ApiMockSimulationSampleV1 } from './contracts';
import type { SourceRequest } from './sourceToRule';

function harDoc(entries: unknown[]) {
  return JSON.stringify({ log: { version: '1.2', entries } });
}

function makeBaseSample(overrides: Partial<ApiMockSimulationSampleV1> = {}): ApiMockSimulationSampleV1 {
  return {
    id: 'test-id',
    name: 'GET /test',
    routeId: 'rte-abc',
    request: {
      method: 'GET',
      path: '/test',
      rawPath: '/test',
      query: {},
      headers: {},
      cookies: {},
      body: null,
      bodyTruncated: false,
      receivedAt: new Date().toISOString(),
    },
    expected: { outcome: 'matched', status: 200 },
    ...overrides,
  };
}

function makeSource(overrides: Partial<SourceRequest> = {}): SourceRequest {
  return {
    method: 'GET',
    path: '/test',
    status: 200,
    ...overrides,
  };
}

describe('parseHarEntries', () => {
  it('parses entries and redacts secrets', () => {
    const text = harDoc([{
      request: {
        method: 'POST',
        url: 'https://api.example.com/v1/users?active=1',
        headers: [
          { name: 'Authorization', value: 'Bearer secret' },
          { name: 'Content-Type', value: 'application/json' },
        ],
        postData: { text: '{"name":"Ada"}', mimeType: 'application/json' },
      },
      response: {
        status: 201,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: { text: '{"id":1}', mimeType: 'application/json' },
      },
    }]);
    const batch = parseHarEntries(text);
    expect(batch.sources).toHaveLength(1);
    expect(batch.sources[0].method).toBe('POST');
    expect(batch.sources[0].path).toBe('/v1/users');
    expect(batch.sources[0].headers?.Authorization).toBe('[REDACTED]');
    expect(batch.sources[0].headers?.['Content-Type']).toBe('application/json');
    expect(batch.sources[0].status).toBe(201);
    expect(batch.diagnostics.some(d => d.code === 'AMS-REDACTION-SECRET-DETECTED')).toBe(true);
  });

  it('rejects invalid JSON and empty logs', () => {
    expect(parseHarEntries('{').diagnostics[0].code).toBe('AMS-IMPORT-PARSE');
    expect(parseHarEntries(JSON.stringify({ log: { entries: [] } })).diagnostics[0].code).toBe('AMS-IMPORT-EMPTY');
  });

  it('rejects oversized HARs', () => {
    const batch = parseHarEntries('{}', HAR_IMPORT_LIMITS.maxFileBytes + 1);
    expect(batch.diagnostics[0].code).toBe('AMS-IMPORT-HAR-TOO-LARGE');
  });

  it('skips bad entries and truncates above maxEntries', () => {
    const entries = Array.from({ length: HAR_IMPORT_LIMITS.maxEntries + 2 }, (_, i) => ({
      request: { method: 'GET', url: `https://example.com/i/${i}` },
      response: { status: 200, content: { text: 'ok' } },
    }));
    entries[0] = { request: { method: 'GET', url: 'not-a-url' }, response: { status: 200, content: { text: 'x' } } } as never;
    const batch = parseHarEntries(harDoc(entries));
    expect(batch.sources.length).toBeLessThanOrEqual(HAR_IMPORT_LIMITS.maxEntries);
    expect(batch.lossReport.some(l => l.includes('Truncated'))).toBe(true);
    expect(batch.lossReport.some(l => l.includes('invalid URL'))).toBe(true);
  });

  it('skips entries missing method or url and resolves mime types', () => {
    const batch = parseHarEntries(harDoc([
      { request: { url: 'https://example.com/a' }, response: { status: 200, content: { text: 'x' } } },
      {
        request: { method: 'POST', url: 'https://example.com/b' },
        response: { status: 200, content: { text: '{"ok":true}', mimeType: 'application/json' } },
      },
      {
        request: {
          method: 'GET',
          url: 'https://example.com/c',
          headers: [{ name: '', value: 'skip' }, { name: 'Accept', value: 'json' }],
          postData: { mimeType: 'text/plain' },
        },
        response: { status: 200 },
      },
    ]));
    expect(batch.lossReport.some(l => l.includes('missing method/url'))).toBe(true);
    expect(batch.sources.find(s => s.path === '/b')?.responseContentType).toBe('application/json');
    expect(batch.sources.find(s => s.path === '/c')?.responseContentType).toBe('text/plain');
    expect(batch.diagnostics.some(d => d.message.includes('entries'))).toBe(true);
  });

  it('defaults response status to 200 when response.status is not a number (covers parseHarEntries line 142)', () => {
    const raw = JSON.stringify({
      log: {
        entries: [{
          request: { method: 'GET', url: 'https://api.example.com/items', headers: [] },
          response: { status: 'N/A', headers: [], content: { text: '' } },
        }],
      },
    });
    const batch = parseHarEntries(raw);
    expect(batch.sources[0].status).toBe(200);
  });

  it('handles header with null name without throwing (covers parseHarEntries h.name?.toLowerCase?.() null path)', () => {
    const raw = JSON.stringify({
      log: {
        entries: [{
          request: {
            method: 'GET',
            url: 'https://api.example.com/items',
            headers: [{ name: null, value: 'x' }, { name: 'X-Keep', value: 'ok' }],
          },
          response: { status: 200, headers: [], content: { text: '' } },
        }],
      },
    });
    const batch = parseHarEntries(raw);
    expect(batch.sources).toHaveLength(1);
    expect(batch.sources[0].headers?.['X-Keep']).toBe('ok');
  });
});

describe('fixHarSampleExpected', () => {
  it('sets outcome matched and real status for 2xx', () => {
    const result = fixHarSampleExpected(makeBaseSample(), makeSource({ status: 201 }));
    expect(result.expected?.outcome).toBe('matched');
    expect(result.expected?.status).toBe(201);
  });

  it('sets outcome matched for 3xx', () => {
    const result = fixHarSampleExpected(makeBaseSample(), makeSource({ status: 302 }));
    expect(result.expected?.outcome).toBe('matched');
    expect(result.expected?.status).toBe(302);
  });

  it('sets outcome unmatched for 4xx', () => {
    const result = fixHarSampleExpected(makeBaseSample(), makeSource({ status: 404 }));
    expect(result.expected?.outcome).toBe('unmatched');
    expect(result.expected?.status).toBe(404);
  });

  it('sets outcome unmatched for 5xx', () => {
    const result = fixHarSampleExpected(makeBaseSample(), makeSource({ status: 500 }));
    expect(result.expected?.outcome).toBe('unmatched');
    expect(result.expected?.status).toBe(500);
  });

  it('defaults to matched/200 when source.status is undefined', () => {
    const result = fixHarSampleExpected(makeBaseSample(), makeSource({ status: undefined }));
    expect(result.expected?.outcome).toBe('matched');
    expect(result.expected?.status).toBe(200);
  });

  it('preserves routeId and other sample fields', () => {
    const sample = makeBaseSample({ routeId: 'rte-xyz', name: 'POST /orders' });
    const result = fixHarSampleExpected(sample, makeSource({ status: 201 }));
    expect(result.routeId).toBe('rte-xyz');
    expect(result.name).toBe('POST /orders');
    expect(result.request.method).toBe('GET');
  });

  it('preserves existing expected fields not overridden', () => {
    const sample = makeBaseSample({
      expected: { outcome: 'matched', status: 200, bodyContains: 'hello' },
    });
    const result = fixHarSampleExpected(sample, makeSource({ status: 201 }));
    expect(result.expected?.bodyContains).toBe('hello');
    expect(result.expected?.status).toBe(201);
  });
});

// ─────────────────────── previewHarEntries ───────────────────────────────────

function makeEntry(opts: {
  method?: string;
  url?: string;
  status?: number;
  requestHeaders?: Array<{ name: string; value: string }>;
  responseContentType?: string;
  postDataText?: string;
  responseText?: string;
}) {
  return {
    request: {
      method: opts.method ?? 'GET',
      url: opts.url ?? 'https://api.example.com/items',
      headers: opts.requestHeaders ?? [],
      postData: opts.postDataText !== undefined ? { text: opts.postDataText, mimeType: 'application/json' } : undefined,
    },
    response: {
      status: opts.status ?? 200,
      headers: opts.responseContentType
        ? [{ name: 'content-type', value: opts.responseContentType }]
        : [],
      content: { text: opts.responseText ?? '', mimeType: opts.responseContentType ?? 'application/json' },
    },
  };
}

describe('previewHarEntries', () => {
  it('returns error on invalid JSON', () => {
    const result = previewHarEntries('not json');
    expect(result.error).toBeTruthy();
    expect(result.accepted).toHaveLength(0);
  });

  it('returns empty accepted list for empty HAR', () => {
    const result = previewHarEntries(JSON.stringify({ log: { entries: [] } }));
    expect(result.accepted).toHaveLength(0);
    expect(result.autoFiltered).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('accepts a standard HTTP request', () => {
    const result = previewHarEntries(harDoc([makeEntry({ url: 'https://api.example.com/users', status: 200 })]));
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].method).toBe('GET');
    expect(result.accepted[0].path).toBe('/users');
    expect(result.accepted[0].status).toBe(200);
  });

  it('classifies OPTIONS as options-preflight', () => {
    const result = previewHarEntries(harDoc([makeEntry({ method: 'OPTIONS', url: 'https://api.example.com/orders' })]));
    expect(result.accepted).toHaveLength(0);
    expect(result.autoFiltered).toHaveLength(1);
    expect(result.autoFiltered[0].filteredReason).toBe('options-preflight');
  });

  it('classifies tracking domain entries as tracking-domain', () => {
    const domain = [...TRACKING_DOMAINS][0]; // e.g. 'google-analytics.com'
    const result = previewHarEntries(harDoc([makeEntry({ url: `https://${domain}/collect` })]));
    expect(result.accepted).toHaveLength(0);
    expect(result.autoFiltered[0].filteredReason).toBe('tracking-domain');
  });

  it('classifies tracking subdomain entries correctly', () => {
    const result = previewHarEntries(harDoc([makeEntry({ url: 'https://sub.google-analytics.com/collect' })]));
    expect(result.autoFiltered[0].filteredReason).toBe('tracking-domain');
  });

  it('classifies non-HTTP URLs (ws://) as non-http', () => {
    const result = previewHarEntries(harDoc([makeEntry({ url: 'ws://api.example.com/socket' })]));
    expect(result.accepted).toHaveLength(0);
    expect(result.autoFiltered[0].filteredReason).toBe('non-http');
  });

  it('classifies duplicate method+path entries as duplicate', () => {
    const result = previewHarEntries(harDoc([
      makeEntry({ url: 'https://api.example.com/items', method: 'GET' }),
      makeEntry({ url: 'https://api.example.com/items', method: 'GET' }),
    ]));
    expect(result.accepted).toHaveLength(1);
    expect(result.autoFiltered).toHaveLength(1);
    expect(result.autoFiltered[0].filteredReason).toBe('duplicate');
  });

  it('does not deduplicate different methods on same path', () => {
    const result = previewHarEntries(harDoc([
      makeEntry({ url: 'https://api.example.com/items', method: 'GET' }),
      makeEntry({ url: 'https://api.example.com/items', method: 'POST' }),
    ]));
    expect(result.accepted).toHaveLength(2);
  });

  it('accepted entries have no filteredReason', () => {
    const result = previewHarEntries(harDoc([makeEntry({ url: 'https://api.example.com/items' })]));
    expect(result.accepted[0].filteredReason).toBeUndefined();
  });

  it('sets hasRedactedHeaders: true when Authorization header present', () => {
    const result = previewHarEntries(harDoc([makeEntry({
      requestHeaders: [{ name: 'Authorization', value: 'Bearer tok' }],
    })]));
    expect(result.accepted[0].hasRedactedHeaders).toBe(true);
    // Source should have [REDACTED] value
    expect(result.accepted[0].source.headers?.['Authorization']).toBe('[REDACTED]');
  });

  it('sets secretHits count correctly for multiple headers in one entry', () => {
    const result = previewHarEntries(harDoc([makeEntry({
      requestHeaders: [
        { name: 'Authorization', value: 'Bearer tok' },
        { name: 'Cookie', value: 'session=abc' },
      ],
    })]));
    expect(result.secretHits).toBe(2);
  });

  it('accumulates secretHits across multiple entries', () => {
    const result = previewHarEntries(harDoc([
      makeEntry({ url: 'https://api.example.com/a', requestHeaders: [{ name: 'Authorization', value: 'x' }] }),
      makeEntry({ url: 'https://api.example.com/b', requestHeaders: [{ name: 'Authorization', value: 'y' }] }),
    ]));
    expect(result.secretHits).toBe(2);
  });

  it('sets truncated: true when entries exceed MAX_ENTRIES cap', () => {
    const entries = Array.from({ length: HAR_IMPORT_LIMITS.maxEntries + 5 }, (_, i) =>
      makeEntry({ url: `https://api.example.com/item-${i}` }),
    );
    const result = previewHarEntries(JSON.stringify({ log: { entries } }));
    expect(result.truncated).toBe(true);
    expect(result.accepted.length).toBeLessThanOrEqual(HAR_IMPORT_LIMITS.maxEntries);
  });

  it('paired source.path matches entry path', () => {
    const result = previewHarEntries(harDoc([makeEntry({ url: 'https://api.example.com/orders/123' })]));
    expect(result.accepted[0].source.path).toBe('/orders/123');
  });

  it('paired source.status matches entry response status', () => {
    const result = previewHarEntries(harDoc([makeEntry({ status: 404 })]));
    expect(result.accepted[0].source.status).toBe(404);
  });

  it('entry.index reflects raw HAR position (display-only)', () => {
    const result = previewHarEntries(harDoc([
      makeEntry({ method: 'OPTIONS', url: 'https://api.example.com/x' }), // filtered → idx 0
      makeEntry({ url: 'https://api.example.com/a' }),                     // accepted → idx 1
    ]));
    expect(result.accepted[0].index).toBe(1); // raw HAR position, not accepted-array position
  });

  it('accepted-array positions are 0-based regardless of raw index', () => {
    const result = previewHarEntries(harDoc([
      makeEntry({ method: 'OPTIONS', url: 'https://api.example.com/x' }), // idx 0 → filtered
      makeEntry({ url: 'https://api.example.com/a' }),                     // idx 1 → accepted[0]
      makeEntry({ url: 'https://api.example.com/b' }),                     // idx 2 → accepted[1]
    ]));
    // accepted-array has 2 items at positions 0, 1
    expect(result.accepted).toHaveLength(2);
    // Their raw indices differ from accepted positions
    expect(result.accepted[0].index).toBe(1);
    expect(result.accepted[1].index).toBe(2);
  });

  it('handles missing log.entries gracefully', () => {
    const result = previewHarEntries(JSON.stringify({ log: {} }));
    expect(result.accepted).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('skips malformed entries (missing url) without erroring', () => {
    const result = previewHarEntries(JSON.stringify({
      log: { entries: [{ request: { method: 'GET' } /* no url */ }] },
    }));
    expect(result.accepted).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('includes query params in entry path display but not in source.path', () => {
    // path should be pathname only; query goes in source.query
    const result = previewHarEntries(harDoc([makeEntry({ url: 'https://api.example.com/items?page=2&limit=10' })]));
    expect(result.accepted[0].path).toBe('/items');
    expect(result.accepted[0].source.path).toBe('/items');
    expect(result.accepted[0].source.query?.['page']).toBe('2');
  });

  it('preserves non-secret headers unredacted in source.headers (covers else branch)', () => {
    // Ensures the non-secret path (headers[h.name] = h.value) is exercised in previewHarEntries.
    const result = previewHarEntries(harDoc([makeEntry({
      requestHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'X-Tenant', value: 'acme' },
      ],
    })]));
    expect(result.accepted[0].source.headers?.['Content-Type']).toBe('application/json');
    expect(result.accepted[0].source.headers?.['X-Tenant']).toBe('acme');
    expect(result.accepted[0].hasRedactedHeaders).toBe(false);
  });

  it('mixed secret and non-secret headers: redacts secret, preserves non-secret', () => {
    const result = previewHarEntries(harDoc([makeEntry({
      requestHeaders: [
        { name: 'Authorization', value: 'Bearer tok' },
        { name: 'Content-Type', value: 'application/json' },
      ],
    })]));
    expect(result.accepted[0].source.headers?.['Authorization']).toBe('[REDACTED]');
    expect(result.accepted[0].source.headers?.['Content-Type']).toBe('application/json');
    expect(result.accepted[0].hasRedactedHeaders).toBe(true);
    expect(result.secretHits).toBe(1);
  });

  it('defaults response status to 200 when response.status is not a number', () => {
    // Covers the `typeof entry.response?.status === 'number' ? ... : 200` false branch.
    const raw = JSON.stringify({
      log: {
        entries: [{
          request: { method: 'GET', url: 'https://api.example.com/items', headers: [] },
          response: { status: 'N/A', headers: [], content: { text: '' } },
        }],
      },
    });
    const result = previewHarEntries(raw);
    expect(result.accepted[0].status).toBe(200);
    expect(result.accepted[0].source.status).toBe(200);
  });

  it('handles missing response.headers gracefully (uses empty array fallback)', () => {
    // Covers the `res?.headers ?? []` false branch.
    const raw = JSON.stringify({
      log: {
        entries: [{
          request: { method: 'GET', url: 'https://api.example.com/items', headers: [] },
          response: { status: 200, content: { text: '{}', mimeType: 'application/json' } },
          // No `headers` field on response — exercising `res?.headers ?? []`
        }],
      },
    });
    const result = previewHarEntries(raw);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].source.responseContentType).toBe('application/json');
  });

  it('skips header with empty string name (covers !name continue — line 257)', () => {
    // Covers the `if (!name) continue` true branch in the previewHarEntries header loop.
    const result = previewHarEntries(harDoc([makeEntry({
      url: 'https://api.example.com/items',
      requestHeaders: [
        { name: '', value: 'should-be-skipped' },
        { name: 'X-Keep', value: 'ok' },
      ],
    })]));
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].source.headers?.['X-Keep']).toBe('ok');
    expect(result.accepted[0].source.headers?.[''] ?? undefined).toBeUndefined();
  });

  it('handles header with null name without throwing (covers h.name?.toLowerCase?.() null path — line 256)', () => {
    // Covers the `h.name?.toLowerCase?.() ?? ''` false branch (h.name is null → returns '').
    const raw = JSON.stringify({
      log: {
        entries: [{
          request: {
            method: 'GET',
            url: 'https://api.example.com/items',
            headers: [{ name: null, value: 'x' }, { name: 'Accept', value: 'json' }],
          },
          response: { status: 200, headers: [], content: { text: '' } },
        }],
      },
    });
    const result = previewHarEntries(raw);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].source.headers?.['Accept']).toBe('json');
  });

  it('handles missing request.headers field (covers req.headers ?? [] path — line 255)', () => {
    // Covers the `req.headers ?? []` false branch when headers field is entirely absent.
    const raw = JSON.stringify({
      log: {
        entries: [{
          request: {
            method: 'GET',
            url: 'https://api.example.com/items',
            // No `headers` field
          },
          response: { status: 200, headers: [], content: { text: '' } },
        }],
      },
    });
    const result = previewHarEntries(raw);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].hasRedactedHeaders).toBe(false);
    expect(result.secretHits).toBe(0);
  });
});

describe('fingerprintRequest (B-3a)', () => {
  it('returns a 64-char hex string', () => {
    const fp = fingerprintRequest('GET', '/api/users', null);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same inputs', () => {
    const fp1 = fingerprintRequest('POST', '/api/orders', '{"item":"widget"}');
    const fp2 = fingerprintRequest('POST', '/api/orders', '{"item":"widget"}');
    expect(fp1).toBe(fp2);
  });

  it('differs when method differs', () => {
    const fp1 = fingerprintRequest('GET', '/api/orders', null);
    const fp2 = fingerprintRequest('POST', '/api/orders', null);
    expect(fp1).not.toBe(fp2);
  });

  it('differs when path differs', () => {
    const fp1 = fingerprintRequest('GET', '/api/orders', null);
    const fp2 = fingerprintRequest('GET', '/api/items', null);
    expect(fp1).not.toBe(fp2);
  });

  it('differs when body differs', () => {
    const fp1 = fingerprintRequest('POST', '/api', '{"a":1}');
    const fp2 = fingerprintRequest('POST', '/api', '{"b":2}');
    expect(fp1).not.toBe(fp2);
  });

  it('treats null and empty-string body identically', () => {
    const fp1 = fingerprintRequest('GET', '/api', null);
    const fp2 = fingerprintRequest('GET', '/api', '');
    expect(fp1).toBe(fp2);
  });

  it('truncates body to 512 chars for fingerprint', () => {
    const longBody = 'x'.repeat(1000);
    const fp1 = fingerprintRequest('POST', '/api', longBody);
    const fp2 = fingerprintRequest('POST', '/api', longBody.slice(0, 512));
    expect(fp1).toBe(fp2);
  });
});
