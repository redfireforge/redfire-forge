/**
 * apqClient.test.ts — Phase 3F unit tests
 *
 * Tests for:
 *   - computeAPQHash: normalisation, caching, FIFO eviction
 *   - isPersistedQueryNotFound
 *   - isAPQUnsupported
 *   - executeWithAPQ: cache hit, cache miss, unsupported server, GET path, mutation path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeAPQHash,
  isPersistedQueryNotFound,
  isAPQUnsupported,
  executeWithAPQ,
  _clearAPQCache,
  _apqCacheSize,
  _apqCacheEntries,
} from './apqClient';
import type { GraphqlResponse } from '@shared/types/graphql';

// ─── SHA-256 polyfill for jsdom (crypto.subtle is available in Node 18+) ─────
// vitest runs under Node so crypto.subtle should be present; no polyfill needed.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOkResponse(overrides: Partial<GraphqlResponse> = {}): GraphqlResponse {
  return {
    httpStatus: 200,
    httpHeaders: {},
    latencyMs: 10,
    timestamp: Date.now(),
    data: { hello: 'world' },
    ...overrides,
  };
}

function makePqnfResponse(): GraphqlResponse {
  return {
    httpStatus: 200,
    httpHeaders: {},
    latencyMs: 10,
    timestamp: Date.now(),
    data: null,
    errors: [{ message: 'PersistedQueryNotFound', extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' } }],
  };
}

function makeUnsupportedResponse(httpStatus = 400): GraphqlResponse {
  return {
    httpStatus,
    httpHeaders: {},
    latencyMs: 10,
    timestamp: Date.now(),
    data: null,
    errors: [{ message: 'Some unrelated error' }],
  };
}

// ─── computeAPQHash ───────────────────────────────────────────────────────────

describe('computeAPQHash', () => {
  beforeEach(() => { _clearAPQCache(); });

  it('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await computeAPQHash('{ hello }');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalizes whitespace before hashing', async () => {
    const h1 = await computeAPQHash('{ hello }');
    const h2 = await computeAPQHash('{  hello  }'); // extra spaces
    // parse+print normalization makes these produce the same hash
    expect(h1).toBe(h2);
  });

  it('caches the result — second call does not recompute (same hash)', async () => {
    const cryptoSpy = vi.spyOn(crypto.subtle, 'digest');
    const h1 = await computeAPQHash('{ hello }');
    const h2 = await computeAPQHash('{ hello }');
    expect(h1).toBe(h2);
    // digest should only have been called once (second call is from cache)
    expect(cryptoSpy).toHaveBeenCalledTimes(1);
    cryptoSpy.mockRestore();
  });

  it('different queries produce different hashes', async () => {
    const h1 = await computeAPQHash('{ hello }');
    const h2 = await computeAPQHash('{ world }');
    expect(h1).not.toBe(h2);
  });

  it('handles unparseable query strings by hashing raw string', async () => {
    // Should not throw; falls back to hashing raw string
    const hash = await computeAPQHash('NOT_VALID_GRAPHQL %%%');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('FIFO eviction: oldest entry is evicted when cache reaches max (500)', async () => {
    _clearAPQCache();
    // Pre-fill 500 unique queries. We use simple field names to avoid parse errors.
    const FILL = 500;
    const hashes: string[] = [];
    for (let i = 0; i < FILL; i++) {
      hashes.push(await computeAPQHash(`{ field${i} }`));
    }
    expect(_apqCacheSize()).toBe(500);

    // Adding one more should evict the first entry
    await computeAPQHash('{ extraField }');
    expect(_apqCacheSize()).toBe(500);

    // The first entry should no longer be in the cache
    const entries = _apqCacheEntries();
    const firstNormalized = entries[0][0];
    // firstNormalized should not be the pre-normalised form of `{ field0 }`
    expect(firstNormalized).not.toContain('field0');
  });
});

// ─── isPersistedQueryNotFound ─────────────────────────────────────────────────

describe('isPersistedQueryNotFound', () => {
  it('returns true for PERSISTED_QUERY_NOT_FOUND error', () => {
    expect(isPersistedQueryNotFound(makePqnfResponse())).toBe(true);
  });

  it('returns false for other errors', () => {
    const resp = makeUnsupportedResponse(200);
    expect(isPersistedQueryNotFound(resp)).toBe(false);
  });

  it('returns false for success response', () => {
    expect(isPersistedQueryNotFound(makeOkResponse())).toBe(false);
  });

  it('returns false for response with no errors', () => {
    const resp = makeOkResponse({ errors: undefined });
    expect(isPersistedQueryNotFound(resp)).toBe(false);
  });
});

// ─── isAPQUnsupported ────────────────────────────────────────────────────────

describe('isAPQUnsupported', () => {
  it('returns true for HTTP 400', () => {
    expect(isAPQUnsupported(makeOkResponse({ httpStatus: 400, data: null, errors: [] }))).toBe(true);
  });

  it('returns true for HTTP 405', () => {
    expect(isAPQUnsupported(makeOkResponse({ httpStatus: 405, data: null, errors: [] }))).toBe(true);
  });

  it('returns true for PERSISTED_QUERY_NOT_SUPPORTED error code', () => {
    const resp = makeOkResponse({
      errors: [{ message: 'APQ not supported', extensions: { code: 'PERSISTED_QUERY_NOT_SUPPORTED' } }],
    });
    expect(isAPQUnsupported(resp)).toBe(true);
  });

  it('returns false for successful response', () => {
    expect(isAPQUnsupported(makeOkResponse())).toBe(false);
  });

  it('returns false for PERSISTED_QUERY_NOT_FOUND (that is a CACHE MISS, not unsupported)', () => {
    expect(isAPQUnsupported(makePqnfResponse())).toBe(false);
  });

  it('returns false for HTTP 200 with ordinary GraphQL field errors (NOT unsupported)', () => {
    // A valid APQ cache-hit response can still carry application-level GraphQL errors.
    // These errors must NOT trigger unsupported detection — they are not APQ failures.
    const resp = makeOkResponse({
      httpStatus: 200,
      data: null,
      errors: [{ message: 'User not found', extensions: { code: 'NOT_FOUND' } }],
    });
    expect(isAPQUnsupported(resp)).toBe(false);
  });

  it('returns false for HTTP 200 with multiple unrelated errors (NOT unsupported)', () => {
    const resp = makeOkResponse({
      httpStatus: 200,
      data: null,
      errors: [
        { message: 'Validation error: field X is required' },
        { message: 'Authorization failed', extensions: { code: 'UNAUTHORIZED' } },
      ],
    });
    expect(isAPQUnsupported(resp)).toBe(false);
  });

  it('returns false for HTTP 400 that has a data field (unrelated server error, NOT APQ unsupported)', () => {
    // Narrowing: a 400 that returns data is NOT an APQ-structure rejection.
    const resp = makeOkResponse({ httpStatus: 400, data: { someField: 'value' }, errors: [] });
    expect(isAPQUnsupported(resp)).toBe(false);
  });

  it('returns true for PERSISTED_QUERY_NOT_SUPPORTED regardless of data field', () => {
    // Explicit code always wins, even if data is present
    const resp = makeOkResponse({
      httpStatus: 200,
      data: { foo: 'bar' },
      errors: [{ message: 'APQ not supported', extensions: { code: 'PERSISTED_QUERY_NOT_SUPPORTED' } }],
    });
    expect(isAPQUnsupported(resp)).toBe(true);
  });
});

// ─── executeWithAPQ ──────────────────────────────────────────────────────────

describe('executeWithAPQ', () => {
  beforeEach(() => { _clearAPQCache(); });

  const QUERY = '{ hello }';
  const VARS = {};

  it('cache HIT: hash-only POST succeeds on first try', async () => {
    const sendFn = vi.fn().mockResolvedValue(makeOkResponse());
    const result = await executeWithAPQ(sendFn, QUERY, VARS, 'query', false);

    expect(result.cacheHit).toBe(true);
    expect(result.unsupported).toBe(false);
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    // sendFn called once with POST
    expect(sendFn).toHaveBeenCalledTimes(1);
    const [body, method] = sendFn.mock.calls[0] as [Record<string, unknown>, string];
    expect(method).toBe('POST');
    expect(body).not.toHaveProperty('query'); // hash-only
    expect(body).toHaveProperty('extensions.persistedQuery.sha256Hash', result.hash);
  });

  it('cache MISS: PERSISTED_QUERY_NOT_FOUND → retries with full query', async () => {
    const sendFn = vi.fn()
      .mockResolvedValueOnce(makePqnfResponse())   // step 1: cache miss
      .mockResolvedValueOnce(makeOkResponse());    // step 2: full query OK

    const result = await executeWithAPQ(sendFn, QUERY, VARS, 'query', false);

    expect(result.cacheHit).toBe(false);
    expect(result.unsupported).toBe(false);
    expect(sendFn).toHaveBeenCalledTimes(2);

    const [body2, method2] = sendFn.mock.calls[1] as [Record<string, unknown>, string];
    expect(method2).toBe('POST');
    expect(body2).toHaveProperty('query', QUERY.trim()); // full query in retry
    // Hash still present in extensions
    expect(body2).toHaveProperty('extensions.persistedQuery.sha256Hash');
  });

  it('unsupported server (HTTP 400) → falls back to plain POST', async () => {
    const httpErrResp: GraphqlResponse = {
      httpStatus: 400, httpHeaders: {}, latencyMs: 5, timestamp: Date.now(), data: null, errors: [],
    };
    const sendFn = vi.fn()
      .mockResolvedValueOnce(httpErrResp)    // step 1: HTTP 400 → unsupported
      .mockResolvedValueOnce(makeOkResponse());  // fallback plain POST

    const result = await executeWithAPQ(sendFn, QUERY, VARS, 'query', false);

    expect(result.cacheHit).toBe(false);
    expect(result.unsupported).toBe(true);
    expect(sendFn).toHaveBeenCalledTimes(2);
    const [fallbackBody, fallbackMethod] = sendFn.mock.calls[1] as [Record<string, unknown>, string];
    expect(fallbackMethod).toBe('POST');
    expect(fallbackBody).toHaveProperty('query'); // plain query, no extensions
    expect(fallbackBody).not.toHaveProperty('extensions');
  });

  it('GET mode (useGet=true) uses GET for hash-only first request', async () => {
    const sendFn = vi.fn().mockResolvedValue(makeOkResponse());
    const result = await executeWithAPQ(sendFn, QUERY, VARS, 'query', true);

    expect(result.cacheHit).toBe(true);
    const [, method] = sendFn.mock.calls[0] as [Record<string, unknown>, string];
    expect(method).toBe('GET');
  });

  it('GET mode: mutations always use POST, never GET', async () => {
    const sendFn = vi.fn().mockResolvedValue(makeOkResponse());
    await executeWithAPQ(sendFn, 'mutation Foo { foo }', VARS, 'mutation', true);

    const [, method] = sendFn.mock.calls[0] as [Record<string, unknown>, string];
    expect(method).toBe('POST');
  });

  it('includes variables in hash-only body when non-empty', async () => {
    const sendFn = vi.fn().mockResolvedValue(makeOkResponse());
    const vars = { id: '123' };
    await executeWithAPQ(sendFn, QUERY, vars, 'query', false);

    const [body] = sendFn.mock.calls[0] as [Record<string, unknown>, string];
    expect(body).toHaveProperty('variables', vars);
  });

  it('omits variables from hash-only body when empty', async () => {
    const sendFn = vi.fn().mockResolvedValue(makeOkResponse());
    await executeWithAPQ(sendFn, QUERY, {}, 'query', false);

    const [body] = sendFn.mock.calls[0] as [Record<string, unknown>, string];
    expect(body).not.toHaveProperty('variables');
  });

  it('GET MISS: falls back to POST with full query when PQNF returned on GET', async () => {
    const sendFn = vi.fn()
      .mockResolvedValueOnce(makePqnfResponse())  // GET cache miss
      .mockResolvedValueOnce(makeOkResponse());   // POST full query

    const result = await executeWithAPQ(sendFn, QUERY, VARS, 'query', true);

    expect(result.cacheHit).toBe(false);
    expect(sendFn).toHaveBeenCalledTimes(2);
    const [, method1] = sendFn.mock.calls[0] as [Record<string, unknown>, string];
    const [, method2] = sendFn.mock.calls[1] as [Record<string, unknown>, string];
    expect(method1).toBe('GET');
    expect(method2).toBe('POST');
  });

  it('APQ version is always 1 in the persistedQuery extension', async () => {
    const sendFn = vi.fn().mockResolvedValue(makeOkResponse());
    await executeWithAPQ(sendFn, QUERY, VARS, 'query', false);

    const [body] = sendFn.mock.calls[0] as [Record<string, unknown>, string];
    const ext = body['extensions'] as Record<string, unknown>;
    const pq = ext['persistedQuery'] as Record<string, unknown>;
    expect(pq['version']).toBe(1);
  });

  it('hash is consistent across multiple calls for same query', async () => {
    const sendFn = vi.fn().mockResolvedValue(makeOkResponse());
    const r1 = await executeWithAPQ(sendFn, QUERY, VARS, 'query', false);
    _clearAPQCache();
    const r2 = await executeWithAPQ(sendFn, QUERY, VARS, 'query', false);
    expect(r1.hash).toBe(r2.hash);
  });

  it('GET mode + unsupported server (HTTP 400) → falls back to plain POST full query', async () => {
    const httpErrResp: GraphqlResponse = {
      httpStatus: 400, httpHeaders: {}, latencyMs: 5, timestamp: Date.now(), data: null, errors: [],
    };
    const sendFn = vi.fn()
      .mockResolvedValueOnce(httpErrResp)   // GET step 1 → 400 → unsupported
      .mockResolvedValueOnce(makeOkResponse()); // POST fallback

    const result = await executeWithAPQ(sendFn, QUERY, VARS, 'query', true);

    expect(result.cacheHit).toBe(false);
    expect(result.unsupported).toBe(true);
    // Step 1 used GET (hash-only)
    const [, method1] = sendFn.mock.calls[0] as [Record<string, unknown>, string];
    expect(method1).toBe('GET');
    // Step 2 (fallback) used POST with full query, no extensions
    expect(sendFn).toHaveBeenCalledTimes(2);
    const [fallbackBody, fallbackMethod] = sendFn.mock.calls[1] as [Record<string, unknown>, string];
    expect(fallbackMethod).toBe('POST');
    expect(fallbackBody).toHaveProperty('query');
    expect(fallbackBody).not.toHaveProperty('extensions');
  });

  it('variables included in full-query retry body on cache MISS', async () => {
    const vars = { id: '42', name: 'test' };
    const sendFn = vi.fn()
      .mockResolvedValueOnce(makePqnfResponse()) // step 1: cache miss
      .mockResolvedValueOnce(makeOkResponse());   // step 2: full query OK

    await executeWithAPQ(sendFn, QUERY, vars, 'query', false);

    const [retryBody] = sendFn.mock.calls[1] as [Record<string, unknown>, string];
    expect(retryBody).toHaveProperty('variables', vars);
    expect(retryBody).toHaveProperty('query');
    expect(retryBody).toHaveProperty('extensions.persistedQuery.sha256Hash');
  });

  it('abort signal between steps prevents step 2 from firing', async () => {
    const ctrl = new AbortController();
    const pqnfResp = makePqnfResponse();

    // Abort the signal as part of the sendFn resolution so it's aborted
    // when executeWithAPQ checks signal.aborted between steps.
    const sendFn = vi.fn().mockImplementationOnce(async () => {
      ctrl.abort();
      return pqnfResp;
    });

    await expect(
      executeWithAPQ(sendFn, QUERY, VARS, 'query', false, ctrl.signal),
    ).rejects.toThrow('APQ request aborted');

    // step 2 should NOT have been called
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('PERSISTED_QUERY_NOT_SUPPORTED error code → unsupported=true', async () => {
    const notSupportedResp: GraphqlResponse = {
      httpStatus: 200, httpHeaders: {}, latencyMs: 5, timestamp: Date.now(), data: null,
      errors: [{ message: 'APQ not supported', extensions: { code: 'PERSISTED_QUERY_NOT_SUPPORTED' } }],
    };
    const sendFn = vi.fn()
      .mockResolvedValueOnce(notSupportedResp)
      .mockResolvedValueOnce(makeOkResponse());

    const result = await executeWithAPQ(sendFn, QUERY, VARS, 'query', false);

    expect(result.unsupported).toBe(true);
    expect(result.cacheHit).toBe(false);
    // Fallback to plain POST
    const [fallbackBody] = sendFn.mock.calls[1] as [Record<string, unknown>, string];
    expect(fallbackBody).toHaveProperty('query');
    expect(fallbackBody).not.toHaveProperty('extensions');
  });
});
