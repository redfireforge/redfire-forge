/**
 * @vitest-environment jsdom
 *
 * useGraphqlSchema — unit tests.
 * Tests introspection loading, caching, error classification, and polling.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../utils/gqlFetch', () => ({
  gqlFetch: vi.fn(),
}));

vi.mock('../utils/schemaParser', () => ({
  parseIntrospectionResult: vi.fn(),
}));

import { gqlFetch } from '../utils/gqlFetch';
import { parseIntrospectionResult } from '../utils/schemaParser';
import { useGraphqlSchema } from './useGraphqlSchema';
import {
  clearGraphqlSchemaMemoryCacheForTests,
  loadCachedSchemaEntry,
  saveCachedSchemaEntry,
} from '../utils/graphqlSchemaCache';
import type { GraphqlSchemaInfo } from '@shared/types/graphql';

const mockGqlFetch = vi.mocked(gqlFetch);
const mockParseIntrospection = vi.mocked(parseIntrospectionResult);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ENDPOINT = 'https://api.example.com/graphql';

/** Computes the same DJB2 hash as the hook internals */
function hashEndpoint(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h) ^ url.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function makeCacheKey(url: string) {
  return `gql_schema_v1_${hashEndpoint(url)}`;
}

function makeSchemaInfo(overrides: Partial<GraphqlSchemaInfo> = {}): GraphqlSchemaInfo {
  return {
    sdl: 'type Query { hello: String }',
    types: [{ name: 'Query', kind: 'OBJECT', fields: [], description: null, enumValues: [], inputFields: [], possibleTypes: [], isBuiltIn: false }],
    queryType: 'Query',
    mutationType: null,
    subscriptionType: null,
    ...overrides,
  };
}

function makeGqlFetchSuccess(data: Record<string, unknown> = { __schema: { types: [] } }) {
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
    error: undefined,
  };
}

function makeGqlFetchError(status: number, body = '') {
  return {
    status,
    headers: {},
    body,
    error: undefined,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAllMocks();
  clearGraphqlSchemaMemoryCacheForTests();
  localStorage.clear();
  mockParseIntrospection.mockReturnValue(makeSchemaInfo());
  mockGqlFetch.mockResolvedValue(makeGqlFetchSuccess());
});

afterEach(() => {
  clearGraphqlSchemaMemoryCacheForTests();
  localStorage.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useGraphqlSchema — initial state', () => {
  it('starts with idle status when no cache', () => {
    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    expect(result.current.status).toBe('idle');
    expect(result.current.schemaInfo).toBeNull();
    expect(result.current.rawIntrospection).toBeNull();
  });

  it('restores from cache if localStorage has valid cached schema', async () => {
    const schemaInfo = makeSchemaInfo();
    const cachedData = {
      schemaInfo,
      sdlHash: 12345,
      rawIntrospection: { __schema: {} },
    };
    localStorage.setItem(makeCacheKey(ENDPOINT), JSON.stringify(cachedData));

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));

    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.schemaInfo).toEqual(schemaInfo);
    expect(result.current.rawIntrospection).toEqual({ __schema: {} });
  });

  it('ignores corrupt localStorage cache', async () => {
    localStorage.setItem(makeCacheKey(ENDPOINT), 'not-valid-json');
    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    await waitFor(() => expect(result.current.status).toBe('idle'));
  });

  it('ignores cache with missing schemaInfo.types array', async () => {
    localStorage.setItem(
      makeCacheKey(ENDPOINT),
      JSON.stringify({ schemaInfo: { types: null }, sdlHash: 123 }),
    );
    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    await waitFor(() => expect(result.current.status).toBe('idle'));
  });

  it('restores rawIntrospection as null when not in cache', async () => {
    const endpoint = 'https://no-raw-introspection.example.com/graphql';
    const schemaInfo = makeSchemaInfo();
    // Cache without rawIntrospection (schema too large)
    const cachedData = { schemaInfo, sdlHash: 12345 };
    localStorage.setItem(makeCacheKey(endpoint), JSON.stringify(cachedData));

    const { result } = renderHook(() => useGraphqlSchema(endpoint));

    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.rawIntrospection).toBeNull();
  });
});

describe('useGraphqlSchema — introspect()', () => {
  it('fetches and parses schema on introspect()', async () => {
    const schemaInfo = makeSchemaInfo();
    mockParseIntrospection.mockReturnValue(schemaInfo);

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));

    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.schemaInfo).toEqual(schemaInfo);
    expect(result.current.introspecting).toBe(false);
  });

  it('sets status to loading while request is in-flight', async () => {
    let resolveGqlFetch!: (v: ReturnType<typeof makeGqlFetchSuccess>) => void;
    mockGqlFetch.mockReturnValue(
      new Promise<ReturnType<typeof makeGqlFetchSuccess>>((r) => { resolveGqlFetch = r; }),
    );

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));

    act(() => { result.current.introspect(); });

    expect(result.current.status).toBe('loading');
    expect(result.current.introspecting).toBe(true);

    await act(async () => {
      resolveGqlFetch(makeGqlFetchSuccess());
    });
  });

  it('passes skipTlsVerify to gqlFetch when tls settings object is empty', async () => {
    mockParseIntrospection.mockReturnValue(makeSchemaInfo());
    const { result } = renderHook(() =>
      useGraphqlSchema('https://localhost:4443/graphql', {}, { skipTlsVerify: true, tls: {} }),
    );

    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(mockGqlFetch).toHaveBeenCalledWith(
      'https://localhost:4443/graphql',
      'POST',
      expect.any(Object),
      expect.any(String),
      undefined,
      { skipTlsVerify: true },
    );
  });

  it('auto-introspects when skipTlsVerify becomes true on an HTTPS endpoint', async () => {
    mockParseIntrospection.mockReturnValue(makeSchemaInfo());
    mockGqlFetch.mockResolvedValue(makeGqlFetchSuccess());

    const { rerender } = renderHook(
      ({ skip }: { skip: boolean }) =>
        useGraphqlSchema('https://localhost:4443/graphql', {}, { skipTlsVerify: skip }),
      { initialProps: { skip: false } },
    );

    expect(mockGqlFetch).not.toHaveBeenCalled();

    rerender({ skip: true });

    await waitFor(() => expect(mockGqlFetch).toHaveBeenCalled());
    expect(mockGqlFetch).toHaveBeenCalledWith(
      'https://localhost:4443/graphql',
      'POST',
      expect.any(Object),
      expect.any(String),
      undefined,
      { skipTlsVerify: true },
    );
  });

  it('does not fetch when endpoint is empty', async () => {
    const { result } = renderHook(() => useGraphqlSchema(''));

    act(() => { result.current.introspect(); });

    expect(mockGqlFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('does not fetch when endpoint is whitespace-only', async () => {
    const { result } = renderHook(() => useGraphqlSchema('   '));

    act(() => { result.current.introspect(); });

    expect(mockGqlFetch).not.toHaveBeenCalled();
  });

  it('caches schema to IndexedDB after successful introspection', async () => {
    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));

    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('loaded'));

    const cached = await loadCachedSchemaEntry(ENDPOINT);
    expect(cached).not.toBeNull();
    expect(cached?.schemaInfo).toBeDefined();
    expect(typeof cached?.sdlHash).toBe('number');
  });
});

describe('useGraphqlSchema — error classification', () => {
  it('shows authentication error on 401', async () => {
    mockGqlFetch.mockResolvedValue(makeGqlFetchError(401));

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Authentication required');
  });

  it('shows access denied error on 403', async () => {
    mockGqlFetch.mockResolvedValue(makeGqlFetchError(403));

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Access denied');
  });

  it('shows server error on 500+', async () => {
    mockGqlFetch.mockResolvedValue(makeGqlFetchError(503));

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Server error');
  });

  it('shows mock-not-enabled message on 503 MOCK_NOT_ENABLED', async () => {
    mockGqlFetch.mockResolvedValue(makeGqlFetchError(
      503,
      JSON.stringify({ error: { code: 'MOCK_NOT_ENABLED', message: 'Mock off' } }),
    ));

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Mock server is not enabled');
  });

  it('shows custom 503 error message when provided', async () => {
    mockGqlFetch.mockResolvedValue(makeGqlFetchError(
      503,
      JSON.stringify({ error: { message: 'Service warming up' } }),
    ));

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Service warming up');
  });

  it('sets parse error when introspection body fails second JSON parse', async () => {
    mockGqlFetch.mockResolvedValue(makeGqlFetchSuccess());
    const originalParse = JSON.parse;
    let parseCount = 0;
    vi.spyOn(JSON, 'parse').mockImplementation((text: string) => {
      parseCount += 1;
      if (parseCount >= 2) {
        throw new SyntaxError('forced parse failure');
      }
      return originalParse(text);
    });

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.errorMessage).toContain('Failed to parse introspection response'));
    vi.mocked(JSON.parse).mockRestore();
  });

  it('shows network error on status=0', async () => {
    mockGqlFetch.mockResolvedValue({ status: 0, headers: {}, body: '', error: 'Network failure' });

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Cannot reach endpoint');
    expect(result.current.errorMessage).toContain('Network failure');
  });

  it('shows mTLS hint when nginx rejects missing client certificate', async () => {
    mockGqlFetch.mockResolvedValue({
      status: 400,
      headers: {},
      body: '<html><body>No required SSL certificate was sent</body></html>',
    });

    const { result } = renderHook(() =>
      useGraphqlSchema('https://localhost:4445/graphql', {}, {
        tls: {
          clientCert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        },
      }),
    );
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Client certificate required');
    expect(mockGqlFetch).toHaveBeenCalled();
  });

  it('blocks introspection on port 4445 when client cert is missing', async () => {
    const { result } = renderHook(() =>
      useGraphqlSchema('https://localhost:4445/graphql', {}, { skipTlsVerify: true }),
    );
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Client certificate required');
    expect(mockGqlFetch).not.toHaveBeenCalled();
  });

  it('shows non-JSON error when response body is not JSON', async () => {
    mockGqlFetch.mockResolvedValue(makeGqlFetchError(200, 'not json'));

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('not valid JSON');
  });

  it('detects introspection-disabled via error messages', async () => {
    const body = JSON.stringify({
      data: { __schema: null },
      errors: [{ message: 'introspect is not allowed on production' }],
    });
    mockGqlFetch.mockResolvedValue({ status: 200, headers: {}, body, error: undefined });

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('introspection-disabled'));
  });

  it('shows error when graphql errors are present but not introspection-related', async () => {
    const body = JSON.stringify({
      data: { __schema: null },
      errors: [{ message: 'some other unrelated error' }],
    });
    mockGqlFetch.mockResolvedValue({ status: 200, headers: {}, body, error: undefined });

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('returned errors during introspection');
  });

  it('shows error when response has no data.__schema', async () => {
    const body = JSON.stringify({ data: {} });
    mockGqlFetch.mockResolvedValue({ status: 200, headers: {}, body, error: undefined });

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('not a valid GraphQL introspection result');
  });

  it('shows error when parseIntrospectionResult throws', async () => {
    mockParseIntrospection.mockImplementation(() => { throw new Error('parse error'); });

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Failed to parse GraphQL schema');
  });

  it('shows error when gqlFetch throws (network exception)', async () => {
    mockGqlFetch.mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('Introspection request failed');
  });

  it('shows error when data is null in response body', async () => {
    const body = JSON.stringify({ data: null });
    mockGqlFetch.mockResolvedValue({ status: 200, headers: {}, body, error: undefined });

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));
    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('useGraphqlSchema — endpoint change', () => {
  it('resets state when endpoint changes', async () => {
    const { result, rerender } = renderHook(
      ({ ep }: { ep: string }) => useGraphqlSchema(ep),
      { initialProps: { ep: ENDPOINT } },
    );

    act(() => { result.current.introspect(); });
    await waitFor(() => expect(result.current.status).toBe('loaded'));

    // Change endpoint
    rerender({ ep: 'https://other.example.com/graphql' });

    // State should reset to idle (no cache for this endpoint)
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.schemaInfo).toBeNull();
  });

  it('restores from cache when switching to a cached endpoint', async () => {
    const otherEndpoint = 'https://cached.example.com/graphql';
    const schemaInfo = makeSchemaInfo({ sdl: 'type Query { cached: String }' });
    localStorage.setItem(
      makeCacheKey(otherEndpoint),
      JSON.stringify({ schemaInfo, sdlHash: 999, rawIntrospection: null }),
    );

    const { result, rerender } = renderHook(
      ({ ep }: { ep: string }) => useGraphqlSchema(ep),
      { initialProps: { ep: ENDPOINT } },
    );

    rerender({ ep: otherEndpoint });

    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.schemaInfo?.sdl).toContain('cached');
  });
});

describe('useGraphqlSchema — Phase 6 per-tab endpoint cache isolation', () => {
  it('uses distinct localStorage cache keys per endpoint URL', () => {
    const staging = 'https://staging.example.com/graphql';
    const prod = 'https://prod.example.com/graphql';
    expect(makeCacheKey(staging)).not.toBe(makeCacheKey(prod));
  });

  it('preserves per-endpoint cache entries when switching active endpoint (tab switch)', async () => {
    const staging = 'https://staging.example.com/graphql';
    const prod = 'https://prod.example.com/graphql';

    await saveCachedSchemaEntry(staging, {
      schemaInfo: makeSchemaInfo({ sdl: 'type Query { stagingField: String }' }),
      sdlHash: 1111,
      rawIntrospection: null,
    });
    await saveCachedSchemaEntry(prod, {
      schemaInfo: makeSchemaInfo({ sdl: 'type Query { prodField: String }' }),
      sdlHash: 4242,
      rawIntrospection: null,
    });

    const { result, rerender } = renderHook(
      ({ ep }: { ep: string }) => useGraphqlSchema(ep),
      { initialProps: { ep: staging } },
    );

    await waitFor(() => expect(result.current.schemaInfo?.sdl).toContain('stagingField'));

    rerender({ ep: prod });

    await waitFor(() => expect(result.current.schemaInfo?.sdl).toContain('prodField'));
    expect(await loadCachedSchemaEntry(staging)).toBeTruthy();
    expect(await loadCachedSchemaEntry(prod)).toBeTruthy();
  });
});

describe('useGraphqlSchema — polling', () => {
  it('polls at specified interval when visibilityState is visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { result } = renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 1000 }),
      );

      // Initially no fetch
      expect(mockGqlFetch).not.toHaveBeenCalled();

      // Advance timer to trigger first poll
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(mockGqlFetch).toHaveBeenCalled();
      expect(result.current).toBeTruthy(); // keep reference
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not poll when pollingIntervalMs is 0', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      renderHook(() => useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 0 }));

      await act(async () => { vi.advanceTimersByTime(5000); });

      expect(mockGqlFetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not poll when endpoint is empty', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      renderHook(() => useGraphqlSchema('', {}, { pollingIntervalMs: 1000 }));

      await act(async () => { vi.advanceTimersByTime(2000); });

      expect(mockGqlFetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets pollErrorMessage when poll fails but keeps existing schema', async () => {
    // First call (introspect) succeeds
    const schemaInfo = makeSchemaInfo();
    mockGqlFetch.mockResolvedValueOnce(makeGqlFetchSuccess());
    mockParseIntrospection.mockReturnValue(schemaInfo);

    // Set up polling with a shorter interval
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { result } = renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 500 }),
      );

      act(() => { result.current.introspect(); });

      await waitFor(() => expect(result.current.status).toBe('loaded'));
      const originalSchemaInfo = result.current.schemaInfo;

      // Next poll fails
      mockGqlFetch.mockResolvedValue(makeGqlFetchError(500));

      await act(async () => { vi.advanceTimersByTime(600); });

      await waitFor(() => expect(result.current.pollErrorMessage).not.toBeNull());
      expect(result.current.schemaInfo).toEqual(originalSchemaInfo);
      expect(result.current.status).toBe('loaded');
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls onSchemaChanged when poll finds a different schema', async () => {
    const schemaV1 = makeSchemaInfo({ sdl: 'type Query { v1: String }' });
    const schemaV2 = makeSchemaInfo({ sdl: 'type Query { v2: String }' });

    mockParseIntrospection
      .mockReturnValueOnce(schemaV1) // initial introspect
      .mockReturnValue(schemaV2);   // poll

    const onSchemaChanged = vi.fn();

    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { result } = renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 500, onSchemaChanged }),
      );

      act(() => { result.current.introspect(); });
      await waitFor(() => expect(result.current.status).toBe('loaded'));

      // Trigger poll
      await act(async () => { vi.advanceTimersByTime(600); });

      await waitFor(() => expect(onSchemaChanged).toHaveBeenCalledWith(schemaV2));
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets pollErrorMessage via exception when gqlFetch throws during poll (line 417)', async () => {
    // First introspect succeeds
    mockGqlFetch.mockResolvedValueOnce(makeGqlFetchSuccess());

    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { result } = renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 500 }),
      );

      act(() => { result.current.introspect(); });
      await waitFor(() => expect(result.current.status).toBe('loaded'));

      // Poll throws an exception
      mockGqlFetch.mockRejectedValue(new Error('Network timeout'));

      await act(async () => { vi.advanceTimersByTime(600); });

      await waitFor(() => expect(result.current.pollErrorMessage).not.toBeNull());
      // Status should remain 'loaded' (kept from prior success)
      expect(result.current.status).toBe('loaded');
      expect(result.current.pollErrorMessage).toContain('retry');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes polling immediately when document becomes visible (lines 462-464)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 10000 }),
      );

      // Initially no fetch
      expect(mockGqlFetch).not.toHaveBeenCalled();

      // Simulate visibility change (tab becomes visible)
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Small delay for async processing
      await act(async () => { await vi.advanceTimersByTimeAsync(60); });

      // Should have immediately polled on visibility change
      expect(mockGqlFetch).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not poll when document is hidden on visibilitychange', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 10000 }),
      );

      expect(mockGqlFetch).not.toHaveBeenCalled();

      // Simulate visibility change with document still hidden
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      await act(async () => { await vi.advanceTimersByTimeAsync(60); });

      // Should NOT have polled (document is hidden)
      expect(mockGqlFetch).not.toHaveBeenCalled();

      // Reset hidden state
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not call onSchemaChanged when schema is unchanged', async () => {
    const schema = makeSchemaInfo({ sdl: 'type Query { same: String }' });
    mockParseIntrospection.mockReturnValue(schema);

    const onSchemaChanged = vi.fn();

    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { result } = renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 500, onSchemaChanged }),
      );

      act(() => { result.current.introspect(); });
      await waitFor(() => expect(result.current.status).toBe('loaded'));

      // Clear calls from initial introspect
      onSchemaChanged.mockClear();

      // Poll returns same schema
      await act(async () => { vi.advanceTimersByTime(600); });

      // Wait a bit to ensure poll completed
      await vi.advanceTimersByTimeAsync(120);

      expect(onSchemaChanged).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears pollErrorMessage when unchanged poll succeeds after prior failure', async () => {
    const schema = makeSchemaInfo({ sdl: 'type Query { stable: String }' });
    mockGqlFetch.mockResolvedValueOnce(makeGqlFetchSuccess());
    mockParseIntrospection.mockReturnValue(schema);

    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { result } = renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 500 }),
      );

      act(() => { result.current.introspect(); });
      await waitFor(() => expect(result.current.status).toBe('loaded'));

      mockGqlFetch.mockResolvedValueOnce(makeGqlFetchError(500));
      await act(async () => { vi.advanceTimersByTime(600); });
      await waitFor(() => expect(result.current.pollErrorMessage).not.toBeNull());

      mockGqlFetch.mockResolvedValueOnce(makeGqlFetchSuccess());
      mockParseIntrospection.mockReturnValue(schema);
      await act(async () => { vi.advanceTimersByTime(600); });
      await waitFor(() => expect(result.current.pollErrorMessage).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });

  it('discards stale introspection response when a newer request started', async () => {
    let resolveFirst!: (v: ReturnType<typeof makeGqlFetchSuccess>) => void;
    mockGqlFetch
      .mockReturnValueOnce(new Promise<ReturnType<typeof makeGqlFetchSuccess>>((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce(makeGqlFetchSuccess());

    const schemaA = makeSchemaInfo({ sdl: 'type Query { first: String }' });
    const schemaB = makeSchemaInfo({ sdl: 'type Query { second: String }' });
    mockParseIntrospection.mockReturnValueOnce(schemaA).mockReturnValueOnce(schemaB);

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT));

    act(() => { result.current.introspect(); });
    act(() => { result.current.introspect(); });

    await act(async () => {
      resolveFirst(makeGqlFetchSuccess());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.schemaInfo?.sdl).toContain('second'));
  });
});

describe('useGraphqlSchema — poll parseIntrospectionResult failure (line 361)', () => {
  it('sets pollErrorMessage when parseIntrospectionResult throws during poll', async () => {
    const schemaV1 = makeSchemaInfo();

    // Initial introspect succeeds
    mockGqlFetch.mockResolvedValueOnce(makeGqlFetchSuccess());
    mockParseIntrospection.mockReturnValueOnce(schemaV1);

    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { result } = renderHook(() =>
        useGraphqlSchema(ENDPOINT, {}, { pollingIntervalMs: 500 }),
      );

      act(() => { result.current.introspect(); });
      await waitFor(() => expect(result.current.status).toBe('loaded'));

      // Next poll: gqlFetch returns valid JSON but parseIntrospectionResult throws
      mockGqlFetch.mockResolvedValue(makeGqlFetchSuccess());
      mockParseIntrospection.mockImplementation(() => { throw new Error('schema parse error during poll'); });

      await act(async () => { vi.advanceTimersByTime(600); });

      // Should set pollErrorMessage but keep existing schema
      await waitFor(() => expect(result.current.pollErrorMessage).toContain('Schema parse failed'));
      expect(result.current.status).toBe('loaded'); // still loaded
      expect(result.current.schemaInfo).toEqual(schemaV1); // unchanged
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useGraphqlSchema — unmount cleanup', () => {
  it('does not update state after unmount', async () => {
    let resolveGqlFetch!: (v: ReturnType<typeof makeGqlFetchSuccess>) => void;
    mockGqlFetch.mockReturnValue(
      new Promise<ReturnType<typeof makeGqlFetchSuccess>>((r) => { resolveGqlFetch = r; }),
    );

    const { result, unmount } = renderHook(() => useGraphqlSchema(ENDPOINT));

    act(() => { result.current.introspect(); });
    expect(result.current.status).toBe('loading');

    unmount();

    // Resolve after unmount — should not cause React warnings
    await act(async () => {
      resolveGqlFetch(makeGqlFetchSuccess());
      await Promise.resolve();
    });

    // No errors thrown — test passes
  });
});

describe('useGraphqlSchema — StrictMode remount', () => {
  it('updates state after StrictMode remount (mountedRef reset on mount)', async () => {
    const schema = makeSchemaInfo({ types: [{ name: 'Query', kind: 'OBJECT', fields: [], description: null, enumValues: [], inputFields: [], possibleTypes: [], isBuiltIn: false }] });
    mockGqlFetch.mockResolvedValue(makeGqlFetchSuccess());
    mockParseIntrospection.mockReturnValue(schema);

    const { result } = renderHook(() => useGraphqlSchema(ENDPOINT), { reactStrictMode: true });

    act(() => { result.current.introspect(); });

    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.schemaInfo).toEqual(schema);
  });
});
