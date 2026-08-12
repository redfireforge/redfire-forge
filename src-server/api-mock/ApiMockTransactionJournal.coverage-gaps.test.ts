import { describe, expect, it } from 'vitest';
import { ApiMockTransactionJournal } from './ApiMockTransactionJournal';
import { DEFAULT_SETTINGS } from '../../src/shared/api-mock/defaults';
import type { ApiMockTransactionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeTx(overrides: Partial<ApiMockTransactionV1> = {}): ApiMockTransactionV1 {
  return {
    id: 'tx-1',
    serverId: 'srv-1',
    generation: 1,
    receivedAt: ts,
    request: {
      method: 'GET',
      path: '/test',
      rawPath: '/test',
      query: {},
      cookies: {},
      headers: { authorization: ['Bearer secret-token'], 'x-api-key': ['sk-key'] },
      body: null,
      bodyTruncated: false,
      receivedAt: ts,
    },
    outcome: 'matched',
    matchedRouteId: 'r1',
    explanation: {
      normalizedRequest: { method: 'GET', path: '/test', decodedPath: '/test', pathSegments: ['test'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
      candidates: [],
      policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' },
      nearMisses: [],
    },
    response: { status: 200, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 10, generationAtResponse: 1 },
    ...overrides,
  };
}

describe('ApiMockTransactionJournal coverage gaps', () => {
  it('supports zero journal entries while still incrementing the cursor', () => {
    const settings = { ...DEFAULT_SETTINGS, journal: { ...DEFAULT_SETTINGS.journal, maxEntries: 0 } };
    const journal = new ApiMockTransactionJournal(settings);
    const cursor = journal.append(makeTx());
    expect(cursor).toBe(1);
    expect(journal.size()).toBe(0);
    expect(journal.query().transactions).toEqual([]);
  });

  it('handles afterCursor and hard limit clamping', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.append(makeTx({ id: 'tx-1' }));
    journal.append(makeTx({ id: 'tx-2' }));
    journal.append(makeTx({ id: 'tx-3' }));
    expect(journal.query({ afterCursor: 1, limit: 500 }).transactions).toHaveLength(2);
  });

  it('updates redaction settings and handles authorization values without a scheme', () => {
    const journal = new ApiMockTransactionJournal(DEFAULT_SETTINGS);
    journal.updateSettings({
      ...DEFAULT_SETTINGS,
      redaction: {
        ...DEFAULT_SETTINGS.redaction,
        headerNames: ['authorization'],
        jsonPaths: [],
        preserveScheme: false,
      },
    });
    journal.append(makeTx({ request: { ...makeTx().request, headers: { authorization: ['token-without-scheme'] } } }));
    const tx = journal.query().transactions[0];
    expect(tx.request.headers.authorization[0]).toBe('[REDACTED]');
  });

  it('truncates response bodies and preserves existing truncation flags', () => {
    const settings = { ...DEFAULT_SETTINGS, journal: { ...DEFAULT_SETTINGS.journal, maxCapturedBodyBytes: 5 } };
    const journal = new ApiMockTransactionJournal(settings);
    journal.append(makeTx({
      request: { ...makeTx().request, body: 'short', bodyTruncated: true },
      response: { ...makeTx().response!, body: 'ABCDEFGHIJK', bodyTruncated: false },
    }));
    const tx = journal.query().transactions[0];
    expect(tx.request.bodyTruncated).toBe(true);
    expect(tx.response?.body).toBe('ABCDE');
    expect(tx.response?.bodyTruncated).toBe(true);
  });
});
