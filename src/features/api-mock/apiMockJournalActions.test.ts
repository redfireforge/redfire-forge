/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  API_MOCK_OPEN_IN_REQUESTS_EVENT,
  copyTransactionToClipboard,
  dispatchOpenInRequests,
  exportTransactionsJson,
  filterTransactions,
  formatTransactionCopy,
  normalizeHttpMethod,
  transactionToOpenInRequestsDetail,
  transactionToRouteDraft,
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
    expect(detail.url).toBe('http://127.0.0.1:4601/users?x=1');
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

  it('builds open-in-requests detail with defaults and scalar header values', () => {
    const minimal = {
      ...tx,
      request: {
        ...tx.request,
        rawPath: undefined,
        headers: { 'x-test': 'plain' },
        body: { not: 'a string' },
      },
    };
    const detail = transactionToOpenInRequestsDetail(minimal as never);
    expect(detail.url).toBe('http://127.0.0.1:4600/users');
    expect(detail.body).toBe('');
    expect(detail.headers).toEqual([{ key: 'x-test', value: 'plain', enabled: true }]);
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
});
