import { describe, expect, it } from 'vitest';
import { exportHarForStudio, exportHarFromSamples, exportHarFromTransactions, joinCapturedHeaderValue, mockClientOrigin, stripCapturedRequestSecrets } from './harExport';
import { HAR_IMPORT_LIMITS } from './proxyContracts';
import type { ApiMockSimulationSampleV1, ApiMockTransactionV1 } from './contracts';

const ts = '2026-08-13T00:00:00.000Z';

function tx(overrides: Partial<ApiMockTransactionV1> = {}): ApiMockTransactionV1 {
  return {
    id: 'tx-1',
    serverId: 'srv-1',
    generation: 1,
    receivedAt: ts,
    request: {
      method: 'POST',
      path: '/users',
      rawPath: '/users?x=1',
      query: { x: ['1'] },
      headers: { Authorization: ['Bearer secret'], 'Content-Type': ['application/json'] },
      cookies: { sid: 'abc' },
      body: '{"name":"Ada"}',
      bodyTruncated: false,
      receivedAt: ts,
      contentType: 'application/json',
    },
    response: {
      status: 201,
      headers: { 'Set-Cookie': ['sid=abc'] },
      cookies: [{ id: 'c1', name: 'sid', value: 'abc', enabled: true }],
      body: '{"ok":true}',
      bodyTruncated: false,
      durationMs: 4,
      generationAtResponse: 1,
    },
    outcome: 'matched',
    matchedRouteId: 'r1',
    durationMs: 4,
    explanation: {
      normalizedRequest: {
        method: 'POST', path: '/users', decodedPath: '/users', pathSegments: ['users'],
        query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0,
      },
      candidates: [],
      policyDecision: {
        policy: 'highest_priority', equalPriorityPolicy: 'reject',
        matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched',
      },
      nearMisses: [],
    },
    ...overrides,
  };
}

describe('exportHarFromTransactions', () => {
  it('exports HAR 1.2 entries and redacts secrets', () => {
    const result = exportHarFromTransactions([tx()], { host: '127.0.0.1', port: 4601 });
    expect(result.entryCount).toBe(1);
    const log = (result.har as { log: { entries: Array<{ request: { url: string; headers: Array<{ name: string; value: string }> } }> } }).log;
    expect(log.entries[0].request.url).toBe('http://127.0.0.1:4601/users?x=1');
    expect(log.entries[0].request.headers.find(h => h.name === 'Authorization')?.value).toBe('[REDACTED]');
    expect(result.lossReport.some(n => n.includes('Redacted'))).toBe(true);
    expect(result.har).toHaveProperty('_lossReport');

    const lanTls = exportHarFromTransactions([tx()], { host: '0.0.0.0', port: 4600, tls: true });
    const lanUrl = (lanTls.har as { log: { entries: Array<{ request: { url: string } }> } }).log.entries[0].request.url;
    expect(lanUrl).toBe('https://127.0.0.1:4600/users?x=1');
    expect(lanTls.lossReport.some(n => n.includes('0.0.0.0'))).toBe(true);
  });

  it('handles missing responses, empty journals, and truncation', () => {
    const empty = exportHarFromTransactions([]);
    expect(empty.entryCount).toBe(0);
    expect(empty.lossReport.some(n => n.includes('empty'))).toBe(true);

    const unredacted = exportHarFromTransactions([tx({
      request: {
        ...tx().request,
        headers: { accept: 'text/plain' as unknown as string[] },
        query: { q: 'solo' as unknown as string[] },
        body: null,
        cookies: undefined as unknown as Record<string, string>,
        rawPath: '',
        path: 'plain',
      },
      response: {
        ...tx().response!,
        headers: {},
        cookies: undefined as never,
        body: null,
      },
    })], { redact: false });
    expect(unredacted.entryCount).toBe(1);

    const noRes = exportHarFromTransactions([tx({ response: undefined, durationMs: undefined, matchedRouteId: undefined })]);
    const entry = (noRes.har as { log: { entries: Array<{ response: { status: number }; time: number }> } }).log.entries[0];
    expect(entry.response.status).toBe(0);
    expect(entry.time).toBe(-1);

    const skipped = exportHarFromTransactions([{ id: 'tx-bad' } as ApiMockTransactionV1]);
    expect(skipped.entryCount).toBe(0);
    expect(skipped.lossReport.some(n => n.includes('Skipped'))).toBe(true);
    expect(skipped.lossReport.some(n => n.includes('empty'))).toBe(false);

    const many = Array.from({ length: HAR_IMPORT_LIMITS.maxEntries + 2 }, (_, i) => tx({
      id: `tx-${i}`,
      receivedAt: new Date(Date.parse('2026-08-13T00:00:00.000Z') + i).toISOString(),
      request: { ...tx().request, path: `/p-${i}`, rawPath: `/p-${i}` },
    }));
    const truncated = exportHarFromTransactions(many);
    expect(truncated.entryCount).toBe(HAR_IMPORT_LIMITS.maxEntries);
    expect(truncated.lossReport.some(n => n.includes('most recent'))).toBe(true);
    const urls = (truncated.har as { log: { entries: Array<{ request: { url: string } }> } }).log.entries.map(e => e.request.url);
    expect(urls[0]).toContain(`/p-${many.length - HAR_IMPORT_LIMITS.maxEntries}`);
    expect(urls.at(-1)).toContain(`/p-${many.length - 1}`);
  });

  it('joins Cookie with semicolons, keeps Set-Cookie as separate headers, and exports chronological order', () => {
    const older = tx({
      id: 'tx-old',
      receivedAt: '2026-08-13T00:00:00.000Z',
      request: {
        ...tx().request,
        headers: { Cookie: ['a=1', 'b=2'], Accept: ['application/json'] },
      },
      response: {
        ...tx().response!,
        headers: { 'Set-Cookie': ['sid=1', 'theme=dark'] },
      },
    });
    const newer = tx({
      id: 'tx-new',
      receivedAt: '2026-08-13T00:00:01.000Z',
      request: { ...tx().request, path: '/later', rawPath: '/later' },
    });
    const result = exportHarFromTransactions([newer, older], { redact: false });
    const log = (result.har as {
      log: { entries: Array<{ startedDateTime: string; request: { headers: Array<{ name: string; value: string }> }; response: { headers: Array<{ name: string; value: string }> } }> };
    }).log;
    expect(log.entries.map(e => e.startedDateTime)).toEqual([
      '2026-08-13T00:00:00.000Z',
      '2026-08-13T00:00:01.000Z',
    ]);
    expect(log.entries[0].request.headers.find(h => h.name === 'Cookie')?.value).toBe('a=1; b=2');
    expect(log.entries[0].response.headers.filter(h => h.name === 'Set-Cookie').map(h => h.value)).toEqual(['sid=1', 'theme=dark']);
    expect(joinCapturedHeaderValue('Cookie', ['a=1', 'b=2'])).toBe('a=1; b=2');
    expect(joinCapturedHeaderValue('Accept', ['application/json', 'text/plain'])).toBe('application/json, text/plain');
    expect(joinCapturedHeaderValue('X-Empty', undefined)).toBe('');
    expect(joinCapturedHeaderValue('Cookie', [])).toBe('');

    const invalidTime = exportHarFromTransactions([
      tx({ id: 'tx-new', receivedAt: '2026-08-13T00:00:01.000Z', request: { ...tx().request, path: '/later', rawPath: '/later' } }),
      tx({ id: 'tx-bad-time', receivedAt: 'not-a-date', request: { ...tx().request, path: '/invalid', rawPath: '/invalid' } }),
    ], { redact: false });
    const ordered = (invalidTime.har as { log: { entries: Array<{ startedDateTime: string }> } }).log.entries;
    expect(ordered.map(e => e.startedDateTime)).toEqual(['not-a-date', '2026-08-13T00:00:01.000Z']);
  });
});

describe('exportHarFromSamples', () => {
  it('exports synthetic entries from examples', () => {
    const samples: ApiMockSimulationSampleV1[] = [{
      id: 's1',
      name: 'GET /health',
      request: {
        method: 'GET', path: 'health', rawPath: '', query: {}, headers: {}, cookies: {},
        body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched', status: 200, bodyExact: '{"ok":true}' },
    }];
    const result = exportHarFromSamples(samples);
    expect(result.entryCount).toBe(1);
    expect(result.lossReport.some(n => n.includes('saved examples'))).toBe(true);

    const noQueryInPath = exportHarFromTransactions([tx({
      request: {
        ...tx().request,
        rawPath: '/search',
        path: '/search',
        query: { q: ['hello'], page: ['2'] },
        headers: {},
        cookies: { sid: 'abc' },
        body: null,
      },
    })]);
    const search = (noQueryInPath.har as { log: { entries: Array<{ request: { url: string } }> } }).log.entries[0];
    expect(search.request.url).toContain('/search?q=hello&page=2');
    expect(noQueryInPath.lossReport.some(n => n.includes('Redacted'))).toBe(true);

    const noExpected = exportHarFromSamples([{
      id: 's2',
      name: 'GET /plain',
      request: {
        method: 'GET', path: '/plain', rawPath: '/plain', query: {}, headers: {}, cookies: {},
        body: null, bodyTruncated: false, receivedAt: ts,
      },
    }]);
    const entry = (noExpected.har as { log: { entries: Array<{ response: { status: number; content: { text: string; size: number }; bodySize: number } }> } }).log.entries[0];
    expect(entry.response.status).toBe(0);
    expect(entry.response.content.text).toBe('');
    expect(entry.response.bodySize).toBe(0);

    const unicode = exportHarFromSamples([{
      id: 's3',
      name: 'GET /uni',
      request: {
        method: 'GET', path: '/uni', rawPath: '/uni', query: {}, headers: {}, cookies: {},
        body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { bodyExact: '✓' },
    }]);
    const uni = (unicode.har as { log: { entries: Array<{ response: { bodySize: number; content: { size: number } } }> } }).log.entries[0];
    expect(uni.response.bodySize).toBe(new TextEncoder().encode('✓').length);
    expect(uni.response.content.size).toBe(uni.response.bodySize);

    const empty = exportHarFromSamples([]);
    expect(empty.lossReport.some(n => n.includes('No journal'))).toBe(true);

    const lanSamples = exportHarFromSamples(samples, { host: '0.0.0.0', port: 4600, tls: true });
    const lanSampleUrl = (lanSamples.har as { log: { entries: Array<{ request: { url: string } }> } }).log.entries[0].request.url;
    expect(lanSampleUrl).toBe('https://127.0.0.1:4600/health');
    expect(lanSamples.lossReport.some(n => n.includes('0.0.0.0'))).toBe(true);
    expect(mockClientOrigin('localhost', 4600)).toBe('http://localhost:4600');
    expect(stripCapturedRequestSecrets({
      method: 'GET', path: '/', rawPath: '/', query: {},
      headers: { Authorization: ['Bearer secret'], Accept: ['application/json'] },
      cookies: { sid: 'abc' }, body: null, bodyTruncated: false, receivedAt: ts,
    }).headers).toEqual({ Accept: ['application/json'] });

    const manySamples: ApiMockSimulationSampleV1[] = Array.from({ length: HAR_IMPORT_LIMITS.maxEntries + 2 }, (_, i) => ({
      id: `s-${i}`,
      name: `s${i}`,
      request: {
        method: 'GET', path: `/${i}`, rawPath: `/${i}`, query: {}, headers: {}, cookies: {},
        body: null, bodyTruncated: false, receivedAt: ts,
      },
    }));
    const truncatedSamples = exportHarFromSamples(manySamples);
    expect(truncatedSamples.entryCount).toBe(HAR_IMPORT_LIMITS.maxEntries);
    expect(truncatedSamples.lossReport.some(n => n.includes('most recent'))).toBe(true);
    const sampleComments = (truncatedSamples.har as { log: { entries: Array<{ comment: string }> } }).log.entries.map(e => e.comment);
    expect(sampleComments[0]).toBe('sample:s-2');
    expect(sampleComments.at(-1)).toBe(`sample:s-${HAR_IMPORT_LIMITS.maxEntries + 1}`);
  });
});

describe('exportHarForStudio', () => {
  it('uses the journal when it has entries, otherwise falls back to examples', () => {
    const sample: ApiMockSimulationSampleV1 = {
      id: 's1',
      name: 'GET /health',
      request: {
        method: 'GET', path: '/health', rawPath: '/health', query: {}, headers: {}, cookies: {},
        body: null, bodyTruncated: false, receivedAt: ts,
      },
    };
    const fromJournal = exportHarForStudio([tx()], [sample]);
    expect(fromJournal.entryCount).toBe(1);
    expect(fromJournal.lossReport.some(n => n.includes('saved examples'))).toBe(false);

    const skippedOnly = exportHarForStudio([{ id: 'tx-bad' } as ApiMockTransactionV1], [sample]);
    expect(skippedOnly.entryCount).toBe(1);
    expect(skippedOnly.lossReport.some(n => n.includes('saved examples'))).toBe(true);

    const skippedNoSamples = exportHarForStudio([{ id: 'tx-bad' } as ApiMockTransactionV1], []);
    expect(skippedNoSamples.entryCount).toBe(0);
    expect(skippedNoSamples.lossReport.some(n => n.includes('Skipped'))).toBe(true);

    const emptyJournal = exportHarForStudio([], [sample]);
    expect(emptyJournal.entryCount).toBe(1);
  });
});
