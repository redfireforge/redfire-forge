/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  API_MOCK_OPEN_IN_REQUESTS_EVENT,
  capturedRequestPath,
  copyTransactionToClipboard,
  copyTextToClipboard,
  dispatchOpenInRequests,
  exportTransactionsJson,
  filterTransactions,
  formatJournalRequestPreview,
  formatJournalResponsePreview,
  formatTransactionCopy,
  normalizeHttpMethod,
  transactionToOpenInRequestsDetail,
  transactionToRouteDraft,
  transactionToSample,
  sampleToOpenInRequestsDetail,
} from './apiMockJournalActions';

const tx = {
  id: 'tx-1',
  serverId: 'srv-1',
  generation: 1,
  receivedAt: '2026-08-12T00:00:00.000Z',
  request: {
    method: 'POST',
    path: '/users',
    rawPath: '/users?x=1',
    query: { x: ['1'] },
    cookies: {},
    headers: { 'content-type': ['application/json'] },
    body: '{"name":"A"}',
    bodyTruncated: false,
    receivedAt: '2026-08-12T00:00:00.000Z',
  },
  response: { status: 201, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 3, generationAtResponse: 1 },
  outcome: 'matched' as const,
  matchedRouteId: 'r1',
  matchedResponseId: 'v1',
  durationMs: 3,
  explanation: {
    normalizedRequest: { method: 'POST', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
    candidates: [],
    policyDecision: { policy: 'highest_priority' as const, equalPriorityPolicy: 'reject' as const, matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' as const, selectedRouteId: 'r1' },
    nearMisses: [],
  },
};

describe('apiMockJournalActions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes HTTP methods and builds Open in Requests detail', () => {
    expect(normalizeHttpMethod('post')).toBe('POST');
    expect(normalizeHttpMethod('TRACE')).toBe('GET');
    const detail = transactionToOpenInRequestsDetail(tx as never, { host: '127.0.0.1', port: 4601 });
    expect(capturedRequestPath(tx.request)).toBe('/users?x=1');
    expect(detail.url).toBe('http://127.0.0.1:4601/users?x=1');
    expect(transactionToOpenInRequestsDetail(tx as never, { host: '0.0.0.0', port: 4600, tls: true }).url)
      .toBe('https://127.0.0.1:4600/users?x=1');
    expect(detail.method).toBe('POST');
    expect(detail.body).toContain('name');
  });

  it('dispatches the open-in-requests custom event', () => {
    const handler = vi.fn();
    window.addEventListener(API_MOCK_OPEN_IN_REQUESTS_EVENT, handler);
    dispatchOpenInRequests({
      name: 'n', method: 'GET', url: 'http://x', headers: [], body: '',
    });
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(API_MOCK_OPEN_IN_REQUESTS_EVENT, handler);
  });

  it('formats and copies transaction text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const text = formatTransactionCopy(tx as never);
    expect(text).toContain('POST /users?x=1');
    expect(text).toContain('HTTP 201');
    await expect(copyTransactionToClipboard(tx as never)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalled();
  });

  it('includes mTLS subject lines in the journal request preview and filter haystack', () => {
    const mtls = {
      ...tx,
      request: {
        ...tx.request,
        clientCertSubject: 'CN=integration-client',
        clientCertFingerprint: 'aabbccdd',
        headers: undefined,
        body: undefined,
      },
    };
    const preview = formatJournalRequestPreview(mtls.request as never);
    expect(preview).toContain('Client-Cert-Subject: CN=integration-client');
    expect(preview).toContain('Client-Cert-Fingerprint: aabbccdd');
    expect(formatTransactionCopy(mtls as never)).toContain('CN=integration-client');
    expect(filterTransactions([mtls as never], 'integration-client')).toHaveLength(1);
    expect(filterTransactions([mtls as never], 'aabbccdd')).toHaveLength(1);
    expect(filterTransactions([tx as never], 'integration-client')).toHaveLength(0);
  });

  it('pretty-prints JSON responses and shares IO pane width by payload size', () => {
    expect(formatJournalResponsePreview(undefined)).toBe('');
    expect(formatJournalResponsePreview(null)).toBe('');
    const json = formatJournalResponsePreview({
      status: 200,
      reasonPhrase: 'OK',
      headers: { 'content-type': ['application/json'] },
      cookies: [],
      body: '{"ok":true}',
      bodyTruncated: false,
      durationMs: 3,
      generationAtResponse: 1,
    });
    expect(json).toContain('HTTP 200 OK');
    expect(json).toContain('content-type: application/json');
    expect(json).toContain('"ok": true');

    expect(formatJournalResponsePreview({
      status: 204,
      headers: undefined as never,
      cookies: [],
      body: null,
      bodyTruncated: false,
      durationMs: 1,
      generationAtResponse: 1,
    })).toBe('HTTP 204');

    expect(formatJournalResponsePreview({
      status: 500,
      headers: {},
      cookies: [],
      body: 'not-json {oops',
      bodyTruncated: false,
      durationMs: 1,
      generationAtResponse: 1,
    })).toContain('not-json {oops');

    expect(formatJournalResponsePreview({
      status: 200,
      headers: {},
      cookies: [],
      body: '{not valid json',
      bodyTruncated: false,
      durationMs: 1,
      generationAtResponse: 1,
    })).toContain('{not valid json');

    expect(formatJournalResponsePreview({
      status: 200,
      headers: {},
      cookies: [],
      body: '[1,2]',
      bodyTruncated: false,
      durationMs: 1,
      generationAtResponse: 1,
    })).toContain('[\n  1,\n  2\n]');
  });

  it('formats transactions without bodies or responses and copies with clipboard failures', async () => {
    const noBody = {
      ...tx,
      request: { ...tx.request, body: undefined, rawPath: undefined, headers: { accept: 'application/json' } },
      response: undefined,
    };
    const text = formatTransactionCopy(noBody as never);
    expect(text).toContain('POST /users');
    expect(text).toContain('(no response)');

    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyTransactionToClipboard(noBody as never)).resolves.toBe(false);
  });

  it('falls back to execCommand when the clipboard API is denied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn().mockReturnValue(true) });
    await expect(copyTextToClipboard('hello')).resolves.toBe(true);
    vi.mocked(document.execCommand).mockReturnValue(false);
    await expect(copyTextToClipboard('hello')).resolves.toBe(false);
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('returns false when clipboard and execCommand both throw', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => { throw new Error('no'); }),
    });
    await expect(copyTextToClipboard('x')).resolves.toBe(false);
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('builds open-in-requests detail with defaults and scalar header values', () => {
    const minimal = {
      ...tx,
      request: {
        ...tx.request,
        rawPath: undefined,
        query: {},
        headers: { 'x-test': 'plain' },
        body: { not: 'a string' },
      },
    };
    const detail = transactionToOpenInRequestsDetail(minimal as never);
    expect(detail.url).toBe('http://127.0.0.1:4600/users');
    expect(detail.body).toBe('');
    expect(detail.headers).toEqual([{ key: 'x-test', value: 'plain', enabled: true }]);
  });

  it('strips hop-by-hop headers when opening a journal row in Requests', () => {
    const detail = transactionToOpenInRequestsDetail({
      ...tx,
      request: {
        ...tx.request,
        headers: {
          host: ['127.0.0.1:4500'],
          connection: ['keep-alive'],
          accept: ['*/*'],
          'user-agent': ['node'],
          'accept-encoding': ['gzip, deflate'],
        },
      },
    } as never);
    expect(detail.headers.map(h => h.key.toLowerCase()).sort()).toEqual(['accept', 'user-agent']);
    expect(detail.headers.find(h => h.key === 'accept')?.value).toBe('*/*');
  });

  it('open-in-requests and route drafts tolerate missing headers', () => {
    const missing = { ...tx, request: { ...tx.request, headers: undefined, query: undefined } };
    expect(transactionToOpenInRequestsDetail(missing as never).headers).toEqual([]);
    expect(transactionToRouteDraft(missing as never).path.value).toBe('/users');
  });

  it('no-ops open-in-requests dispatch when window is unavailable', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate non-browser runtime
    delete globalThis.window;
    expect(() => dispatchOpenInRequests({
      name: 'n', method: 'GET', url: 'http://x', headers: [], body: '',
    })).not.toThrow();
    globalThis.window = originalWindow;
  });

  it('filters by path, outcome, route label, and returns all rows for blank queries', () => {
    const second = {
      ...tx,
      id: 'tx-2',
      outcome: 'unmatched' as const,
      matchedRouteId: undefined,
      request: { ...tx.request, method: 'GET', path: '/health', rawPath: '/health' },
      response: { ...tx.response!, status: 404 },
    };
    const rows = [tx as never, second as never];

    expect(filterTransactions(rows, '')).toHaveLength(2);
    expect(filterTransactions(rows, 'unmatched')).toHaveLength(1);
    expect(filterTransactions(rows, '/health')).toHaveLength(1);
    expect(filterTransactions(rows, 'post /users', id => (id === 'r1' ? 'Users route' : ''))).toHaveLength(1);
    expect(filterTransactions([second as never], 'r1')).toHaveLength(0);
    expect(filterTransactions([second as never], '404')).toHaveLength(1);
  });

  it('exports journal JSON with default server name', () => {
    const click = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:journal-default');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { click, href: '', download: '' } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });

    exportTransactionsJson([tx as never]);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json');
    expect(click).toHaveBeenCalled();
  });

  it('creates route drafts from proxied transactions and response content types', () => {
    const proxied = {
      ...tx,
      outcome: 'proxied' as const,
      response: {
        ...tx.response!,
        headers: { 'Content-Type': ['application/problem+json'] },
        body: '{"detail":"upstream"}',
      },
    };
    const route = transactionToRouteDraft(proxied as never);
    expect(route.enabled).toBe(false);
    expect(route.responses[0]?.body.contentType).toBe('application/problem+json');

    const scalarCt = transactionToRouteDraft({
      ...tx,
      response: {
        ...tx.response!,
        headers: { 'content-type': 'text/plain' },
      },
    } as never);
    expect(scalarCt.responses[0]?.body.contentType).toBe('text/plain');

    const noResponse = transactionToRouteDraft({
      ...tx,
      response: undefined,
      request: {
        ...tx.request,
        query: { tag: 'solo', multi: ['a', 'b'] },
        headers: { 'Content-Type': 'application/json' },
        body: 42,
      },
    } as never);
    expect(noResponse.path.value).toBe('/users');
  });

  it('promotes a journal row to a durable sample and opens examples in Requests', () => {
    const sample = transactionToSample(tx as never);
    expect(sample.routeId).toBe('r1');
    expect(sample.expected?.status).toBe(201);
    expect(sample.expected?.outcome).toBe('matched');
    expect(transactionToSample(tx as never, { name: 'Custom' }).name).toBe('Custom');
    const detail = sampleToOpenInRequestsDetail(sample, { host: '127.0.0.1', port: 4600 });
    expect(detail.method).toBe('POST');
    expect(detail.url).toContain('/users?x=1');

    const unnamed = sampleToOpenInRequestsDetail({
      name: '',
      request: { ...tx.request, method: 'TRACE', headers: { accept: 'text/plain' }, body: null, rawPath: '' },
    });
    expect(unnamed.method).toBe('GET');
    expect(unnamed.name).toContain('Mock example');
    expect(unnamed.body).toBe('');
    expect(unnamed.url).toBe('http://127.0.0.1:4600/users?x=1');

    const noSlash = sampleToOpenInRequestsDetail({
      name: 'health',
      request: { ...tx.request, path: 'health', rawPath: '', query: {} },
    });
    expect(noSlash.url).toBe('http://127.0.0.1:4600/health');

    const unmatched = transactionToSample({
      ...tx,
      matchedRouteId: undefined,
      matchedResponseId: undefined,
      request: { ...tx.request, method: '' },
      response: { ...tx.response!, body: null },
    } as never, { routeId: undefined });
    expect(unmatched.routeId).toBeUndefined();
    expect(unmatched.expected?.bodyExact).toBeUndefined();

    const leaked = transactionToSample({
      ...tx,
      request: {
        ...tx.request,
        headers: { Authorization: ['Bearer secret'], Cookie: ['a=1', 'b=2'], Accept: ['application/json'] },
        cookies: { sid: 'abc' },
      },
    } as never);
    expect(leaked.request.headers).toEqual({ Accept: ['application/json'] });
    expect(leaked.request.cookies).toEqual({});
    expect(leaked.request.query).toEqual(tx.request.query);
    leaked.request.query.x = ['mutated'];
    expect(tx.request.query.x).toEqual(['1']);

    const cookieDetail = sampleToOpenInRequestsDetail({
      name: 'cookies',
      request: { ...tx.request, headers: { Cookie: ['a=1', 'b=2'], Accept: ['application/json'] } },
    });
    expect(cookieDetail.headers.find(h => h.key === 'Cookie')?.value).toBe('a=1; b=2');
    expect(cookieDetail.headers.find(h => h.key === 'Accept')?.value).toBe('application/json');
    expect(formatJournalRequestPreview({
      ...tx.request,
      headers: { Cookie: ['a=1', 'b=2'] },
    })).toContain('Cookie: a=1; b=2');
  });
});
