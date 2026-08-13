import { describe, it, expect } from 'vitest';
import { ApiMockTransactionJournal } from './ApiMockTransactionJournal';
import { DEFAULT_SETTINGS } from '../../src/shared/api-mock/defaults';
import type { ApiMockTransactionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-11T00:00:00.000Z';

function makeTx(overrides: Partial<ApiMockTransactionV1> = {}): ApiMockTransactionV1 {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    serverId: 'srv-1', generation: 1, receivedAt: ts,
    request: {
      method: 'GET', path: '/test', rawPath: '/test', query: {}, cookies: {},
      headers: { authorization: ['Bearer secret-token'], 'x-api-key': ['sk-key'] },
      body: null, bodyTruncated: false, receivedAt: ts,
    },
    outcome: 'matched', matchedRouteId: 'r1',
    explanation: {
      normalizedRequest: { method: 'GET', path: '/test', decodedPath: '/test', pathSegments: ['test'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
      candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' },
      nearMisses: [],
    },
    ...overrides,
  };
}

describe('ApiMockTransactionJournal', () => {
  it('appends and retrieves transactions', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx());
    expect(journal.size()).toBe(1);
    expect(journal.query().transactions).toHaveLength(1);
  });

  it('does not capture when journal.enabled is false', () => {
    const settings = { ...DEFAULT_SETTINGS, journal: { ...DEFAULT_SETTINGS.journal, enabled: false } };
    const journal = new ApiMockTransactionJournal(settings);
    journal.append(makeTx({ id: 'tx-off' }));
    expect(journal.size()).toBe(0);
    expect(journal.getAll()).toEqual([]);
    journal.updateSettings(DEFAULT_SETTINGS);
    journal.append(makeTx({ id: 'tx-on' }));
    expect(journal.size()).toBe(1);
    expect(journal.getAll()[0].id).toBe('tx-on');
  });

  it('enforces max entries cap', () => {
    const settings = { ...DEFAULT_SETTINGS, journal: { ...DEFAULT_SETTINGS.journal, maxEntries: 3 } };
    const journal = new ApiMockTransactionJournal(settings);
    for (let i = 0; i < 10; i++) journal.append(makeTx());
    expect(journal.size()).toBe(3);
    expect(journal.query().capped).toBe(true);
    expect(journal.getStats().drops).toBe(7);
  });

  it('clears all entries', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx());
    journal.append(makeTx());
    journal.clear();
    expect(journal.size()).toBe(0);
    expect(journal.getStats().drops).toBe(0);
    expect(journal.getStats().truncations).toBe(0);
  });

  it('redacts authorization header preserving scheme', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx());
    const tx = journal.query().transactions[0];
    expect(tx.request.headers.authorization[0]).toBe('Bearer [REDACTED]');
  });

  it('preserves the Proxy-Authorization scheme when redacting', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx({
      request: {
        ...makeTx().request,
        headers: { 'proxy-authorization': ['Basic super-secret'] },
      },
    }));
    expect(journal.query().transactions[0].request.headers['proxy-authorization'][0]).toBe('Basic [REDACTED]');
  });

  it('redacts api key header fully', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx());
    const tx = journal.query().transactions[0];
    expect(tx.request.headers['x-api-key'][0]).toBe('[REDACTED]');
  });

  it('redacts cookie maps and response Set-Cookie values', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx({
      request: {
        ...makeTx().request,
        cookies: { session: 'raw-session' },
        headers: { cookie: ['session=raw-session'] },
      },
      response: {
        status: 200,
        headers: { 'set-cookie': ['session=raw-session'] },
        cookies: [{ id: 'c1', name: 'session', value: 'raw-session', enabled: true }],
        body: null,
        bodyTruncated: false,
        durationMs: 1,
        generationAtResponse: 1,
      },
    }));
    const tx = journal.query().transactions[0];
    expect(tx.request.cookies.session).toBe('[REDACTED]');
    expect(tx.request.headers.cookie[0]).toBe('[REDACTED]');
    expect(tx.response?.headers['set-cookie'][0]).toBe('[REDACTED]');
    expect(tx.response?.cookies[0].value).toBe('[REDACTED]');
  });

  it('redacts configured JSONPath locations in request and response bodies', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      redaction: { ...DEFAULT_SETTINGS.redaction, jsonPaths: ['$.password', '$.missing', ''] },
    };
    const journal = new ApiMockTransactionJournal(settings);
    journal.append(makeTx({
      request: { ...makeTx().request, body: '{"name":"Ada","password":"s3cret"}' },
      response: { status: 200, headers: {}, cookies: [], body: '{"password":"also-secret","ok":true}', bodyTruncated: false, durationMs: 1, generationAtResponse: 1 },
    }));
    const tx = journal.query().transactions[0];
    expect(tx.request.body).toContain('[REDACTED]');
    expect(tx.request.body).not.toContain('s3cret');
    expect(tx.request.body).toContain('Ada');
    expect(tx.response?.body).toContain('[REDACTED]');
    expect(tx.response?.body).not.toContain('also-secret');

    journal.append(makeTx({ request: { ...makeTx().request, body: 'not-json' } }));
    expect(journal.getAll()[1].request.body).toBe('not-json');
  });

  it('truncates large request bodies', () => {
    const settings = { ...DEFAULT_SETTINGS, journal: { ...DEFAULT_SETTINGS.journal, maxCapturedBodyBytes: 10 } };
    const journal = new ApiMockTransactionJournal(settings);
    journal.append(makeTx({ request: { ...makeTx().request, body: 'A'.repeat(100) } }));
    const tx = journal.query().transactions[0];
    expect(tx.request.body?.length).toBe(10);
    expect(tx.request.bodyTruncated).toBe(true);
    expect(journal.getStats().truncations).toBe(1);
  });

  it('filters by method', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx({ request: { ...makeTx().request, method: 'GET' } }));
    journal.append(makeTx({ request: { ...makeTx().request, method: 'POST' } }));
    expect(journal.query({ methodFilter: 'GET' }).transactions).toHaveLength(1);
  });

  it('filters by path substring', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx({ request: { ...makeTx().request, path: '/users/42' } }));
    journal.append(makeTx({ request: { ...makeTx().request, path: '/orders/1' } }));
    expect(journal.query({ pathFilter: 'users' }).transactions).toHaveLength(1);
  });

  it('filters by outcome', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx({ outcome: 'matched' }));
    journal.append(makeTx({ outcome: 'unmatched' }));
    expect(journal.query({ outcomeFilter: 'unmatched' }).transactions).toHaveLength(1);
  });

  it('limits page size', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    for (let i = 0; i < 20; i++) journal.append(makeTx());
    expect(journal.query({ limit: 5 }).transactions).toHaveLength(5);
  });

  it('returns incremented cursor', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    const c1 = journal.append(makeTx());
    const c2 = journal.append(makeTx());
    expect(c2).toBeGreaterThan(c1);
  });

  it('getAll returns a copy', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx());
    const all = journal.getAll();
    all.pop();
    expect(journal.size()).toBe(1);
  });
});
