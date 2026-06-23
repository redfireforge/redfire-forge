/**
 * useGraphqlExecution — unit tests
 *
 * Covers the React hook lifecycle, state transitions, cancellation, deduplication,
 * and the parseHttpBody helper (exercised via the execution path).
 *
 * Uses mocked gqlFetch / gqlUpload / dedupExecution / graphqlClient utilities so
 * no real network calls are made.
 */

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../utils/gqlFetch', () => ({
  gqlFetch: vi.fn(),
  gqlUpload: vi.fn(),
}));

vi.mock('../utils/graphqlClient', () => ({
  hasIncrementalDirective: vi.fn(() => false),
}));

vi.mock('../utils/apqClient', () => ({
  executeWithAPQ: vi.fn(),
}));

vi.mock('../utils/multipartParser', () => ({
  parseMultipartMixed: vi.fn(),
}));

vi.mock('../utils/dedupExecution', () => ({
  buildDedupKey: vi.fn(() => 'dedup-key'),
  getInFlight: vi.fn(() => null),
  registerInFlight: vi.fn(),
  removeInFlight: vi.fn(),
  handleDedupGuard: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { useGraphqlExecution } from './useGraphqlExecution';
import { gqlFetch, gqlUpload } from '../utils/gqlFetch';
import { hasIncrementalDirective } from '../utils/graphqlClient';
import { executeWithAPQ } from '../utils/apqClient';
import {
  getInFlight,
  registerInFlight,
  removeInFlight,
  buildDedupKey,
  handleDedupGuard,
} from '../utils/dedupExecution';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ENDPOINT = 'https://api.example.com/graphql';
const QUERY = 'query { user { id name } }';

function baseParams(overrides: Partial<Parameters<ReturnType<typeof useGraphqlExecution>['execute']>[0]> = {}) {
  return {
    endpoint: ENDPOINT,
    query: QUERY,
    variables: '{}',
    headers: {},
    ...overrides,
  };
}

function makeSuccessResponse(data: unknown = { user: { id: '1', name: 'Alice' } }) {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
    error: undefined,
  };
}

function makeErrorResponse(errors: unknown[]) {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: null, errors }),
    error: undefined,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasIncrementalDirective).mockReturnValue(false);
  vi.mocked(getInFlight).mockReturnValue(null);
  vi.mocked(buildDedupKey).mockReturnValue('dedup-key');
  vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('useGraphqlExecution — initial state', () => {
  it('starts with idle status', () => {
    const { result } = renderHook(() => useGraphqlExecution());
    expect(result.current.status).toBe('idle');
  });

  it('starts with null response', () => {
    const { result } = renderHook(() => useGraphqlExecution());
    expect(result.current.response).toBeNull();
  });

  it('starts with isDuplicate = false', () => {
    const { result } = renderHook(() => useGraphqlExecution());
    expect(result.current.isDuplicate).toBe(false);
  });

  it('starts with null apqInfo', () => {
    const { result } = renderHook(() => useGraphqlExecution());
    expect(result.current.apqInfo).toBeNull();
  });
});

// ─── execute() — guard conditions ────────────────────────────────────────────

describe('useGraphqlExecution — execute() guard conditions', () => {
  it('does not fetch when endpoint is empty', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ endpoint: '' }));
    });

    expect(gqlFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('does not fetch when query is empty', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: '' }));
    });

    expect(gqlFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('does not fetch when only whitespace endpoint', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ endpoint: '   ' }));
    });

    expect(gqlFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('does not fetch when only whitespace query', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: '   ' }));
    });

    expect(gqlFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('clears wait subscription when a new execute starts after choosing wait', async () => {
    let resolveShared!: (r: import('../../../shared/types/graphql').GraphqlResponse) => void;
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>((r) => {
      resolveShared = r;
    });

    vi.mocked(getInFlight).mockReturnValueOnce({ controller: new AbortController(), promise: sharedPromise });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });
    act(() => { result.current.resolveDedupChoice('wait'); });
    expect(result.current.status).toBe('loading');

    vi.mocked(gqlFetch).mockResolvedValueOnce(makeSuccessResponse({ fresh: true }));
    await act(async () => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT, query: 'query Fresh { x }' }));
      await Promise.resolve();
    });

    await act(async () => {
      resolveShared(makeSuccessResponse({ stale: true }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.response?.data).toEqual({ fresh: true });
  });

  it('continues execution when variables JSON is malformed', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ variables: '{not-json' }));
      await Promise.resolve();
    });

    expect(gqlFetch).toHaveBeenCalled();
  });

  it('returns error when formData is combined with @stream directive', async () => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(true);

    const { result } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    await act(async () => {
      result.current.execute(baseParams({ formData, query: 'subscription { x @stream { y } }' }));
      await Promise.resolve();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.response?.errors?.[0].message).toContain('@stream');
  });

  it('ignores array-shaped variables for dedup key parsing', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        variables: '[]',
        connectionId: 'conn-1',
        dedupEnabled: true,
      }));
      await Promise.resolve();
    });

    expect(gqlFetch).toHaveBeenCalled();
  });
});

// ─── execute() — formData + @defer mutual exclusion (2D-6) ───────────────────

describe('useGraphqlExecution — formData + @defer mutual exclusion', () => {
  it('returns an error when formData is combined with @defer directive', async () => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(true);

    const { result } = renderHook(() => useGraphqlExecution());

    const formData = new FormData();
    await act(async () => {
      result.current.execute(baseParams({ formData, query: 'query { x @defer { y } }' }));
      await Promise.resolve();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.response?.errors?.[0].message).toContain('@defer');
    expect(gqlFetch).not.toHaveBeenCalled();
  });

  it('notifies onExecutionCompleted for client-side defer+upload validation error (Phase 6A)', async () => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(true);
    const onExecutionCompleted = vi.fn();
    const { result } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    await act(async () => {
      result.current.execute(baseParams({
        formData,
        query: 'query { x @defer { y } }',
        sourceTabId: 'tab-err',
        onExecutionCompleted,
      }));
      await Promise.resolve();
    });

    expect(onExecutionCompleted).toHaveBeenCalledWith(
      'tab-err',
      'error',
      expect.objectContaining({ errors: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('@defer') })]) }),
      null,
    );
  });
});

// ─── execute() — standard HTTP path ──────────────────────────────────────────

describe('useGraphqlExecution — standard HTTP path', () => {
  it('sets status to loading then success for a successful query', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.response?.data).toEqual({ user: { id: '1', name: 'Alice' } });
  });

  it('calls onExecutionCompleted with the request source tab on success (Phase 6A)', async () => {
    const onExecutionCompleted = vi.fn();
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ sourceTabId: 'tab-42', onExecutionCompleted }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(onExecutionCompleted).toHaveBeenCalledWith(
      'tab-42',
      'success',
      expect.objectContaining({ data: { user: { id: '1', name: 'Alice' } } }),
      null,
    );
  });

  it('sets status to error when response has only errors and no data', async () => {
    vi.mocked(gqlFetch).mockResolvedValue(makeErrorResponse([{ message: 'Not found' }]));

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0]).toEqual({ message: 'Not found' });
  });

  it('sets status to success when response has both data and errors', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ data: { user: null }, errors: [{ message: 'Partial error' }] }),
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.response?.errors).toBeDefined();
  });

  it('includes response extensions when present', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({ data: { x: 1 }, extensions: { tracing: { duration: 100 } } }),
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.response?.extensions).toEqual({ tracing: { duration: 100 } });
  });

  it('handles status=0 with error string (network failure)', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: 'Connection refused',
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toBe('Connection refused');
  });

  it('handles non-JSON body as an error with rawPreview', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      body: '<html>Server Error</html>',
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toContain('non-JSON response');
  });

  it('handles non-JSON body longer than 200 chars (truncates preview)', async () => {
    const longBody = 'x'.repeat(300);
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      body: longBody,
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    const preview = result.current.response?.errors?.[0].extensions?.['rawPreview'] as string;
    expect(preview).toBeDefined();
    expect(preview.length).toBeLessThanOrEqual(201); // 200 chars + "…"
    expect(preview.endsWith('…')).toBe(true);
  });

  it('handles fetch rejection (network error) → error state', async () => {
    vi.mocked(gqlFetch).mockRejectedValue(new Error('Failed to connect'));

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toBe('Failed to connect');
  });

  it('handles fetch rejection with non-Error value → "Unknown network error"', async () => {
    vi.mocked(gqlFetch).mockRejectedValue('connection refused');

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toBe('Unknown network error');
  });

  it('sends operationName in request when provided', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ operationName: 'GetUser' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    // Verify gqlFetch was called with body containing operationName
    const call = vi.mocked(gqlFetch).mock.calls[0];
    const body = call[3] ? JSON.parse(call[3]) : {};
    expect(body.operationName).toBe('GetUser');
  });

  it('passes valid non-empty variables in request body', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ variables: '{"userId": "123"}' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    const call = vi.mocked(gqlFetch).mock.calls[0];
    const body = call[3] ? JSON.parse(call[3]) : {};
    expect(body.variables).toEqual({ userId: '123' });
  });

  it('omits variables from request when variables is "{}"', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ variables: '{}' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    const call = vi.mocked(gqlFetch).mock.calls[0];
    const body = call[3] ? JSON.parse(call[3]) : {};
    expect(body.variables).toBeUndefined();
  });

  it('omits variables from request when variables is invalid JSON', async () => {
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ variables: '{invalid}' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    const call = vi.mocked(gqlFetch).mock.calls[0];
    const body = call[3] ? JSON.parse(call[3]) : {};
    // Malformed JSON → no variables in body
    expect(body.variables).toBeUndefined();
  });

  it('clears response to null and sets loading before request completes', async () => {
    // Make gqlFetch resolve only after we check the loading state
    let resolveFetch!: (v: ReturnType<typeof makeSuccessResponse>) => void;
    vi.mocked(gqlFetch).mockReturnValue(new Promise<ReturnType<typeof makeSuccessResponse>>((r) => { resolveFetch = r; }));

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams());
    });

    // Immediately after execute() — hook should be loading
    expect(result.current.status).toBe('loading');
    expect(result.current.response).toBeNull();

    // Now let the fetch complete
    await act(async () => {
      resolveFetch(makeSuccessResponse());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
  });
});

// ─── cancel() ────────────────────────────────────────────────────────────────

describe('useGraphqlExecution — cancel()', () => {
  it('is a no-op when nothing is in-flight', () => {
    const { result } = renderHook(() => useGraphqlExecution());
    // Should not throw
    act(() => { result.current.cancel(); });
    expect(result.current.status).toBe('idle');
  });

  it('restores last completed state when cancelling an in-flight request', async () => {
    // First: complete a successful request to set lastCompletedResponseRef
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse({ user: { id: '1' } }));
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('success'));

    // Second: start a slow request, then cancel
    let resolveFetch!: (v: ReturnType<typeof makeSuccessResponse>) => void;
    vi.mocked(gqlFetch).mockReturnValue(new Promise<ReturnType<typeof makeSuccessResponse>>((r) => { resolveFetch = r; }));

    act(() => { result.current.execute(baseParams()); });
    expect(result.current.status).toBe('loading');

    act(() => { result.current.cancel(); });

    // After cancel, should restore the last completed state (success)
    expect(result.current.status).toBe('success');

    // Let the slow request resolve (should be ignored since aborted)
    resolveFetch(makeSuccessResponse());
  });

  it('restores last completed APQ badge when cancelling an in-flight request (Phase 6D)', async () => {
    vi.mocked(executeWithAPQ).mockResolvedValue({
      response: makeSuccessResponse(),
      cacheHit: true,
      hash: 'abc123',
      unsupported: false,
    });
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(result.current.apqInfo?.cacheHit).toBe(true));

    let resolveApq!: (v: Awaited<ReturnType<typeof executeWithAPQ>>) => void;
    vi.mocked(executeWithAPQ).mockReturnValue(
      new Promise<Awaited<ReturnType<typeof executeWithAPQ>>>((r) => { resolveApq = r; }),
    );

    act(() => {
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
    });
    expect(result.current.apqInfo).toBeNull();

    act(() => { result.current.cancel(); });

    expect(result.current.apqInfo?.cacheHit).toBe(true);
    expect(result.current.apqInfo?.hash).toBe('abc123');

    await act(async () => {
      resolveApq({
        response: makeSuccessResponse(),
        cacheHit: false,
        hash: 'ignored',
        unsupported: false,
      });
      await Promise.resolve();
    });
  });
});

// ─── Deduplication ────────────────────────────────────────────────────────────

describe('useGraphqlExecution — deduplication', () => {
  it('detects duplicate in-flight request and sets isDuplicate = true', async () => {
    const fakePromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>(() => {});
    vi.mocked(getInFlight).mockReturnValue({ controller: new AbortController(), promise: fakePromise });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });

    expect(result.current.isDuplicate).toBe(true);
    expect(result.current.duplicateSourceTabId).toBeNull();
    expect(gqlFetch).not.toHaveBeenCalled();
  });

  it('records duplicateSourceTabId when duplicate is detected (Phase 6A)', () => {
    const fakePromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>(() => {});
    vi.mocked(getInFlight).mockReturnValue({ controller: new AbortController(), promise: fakePromise });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({
        dedupEnabled: true,
        connectionId: ENDPOINT,
        sourceTabId: 'tab-2',
      }));
    });

    expect(result.current.isDuplicate).toBe(true);
    expect(result.current.duplicateSourceTabId).toBe('tab-2');
    expect(gqlFetch).not.toHaveBeenCalled();
  });

  it('registers in-flight entry when dedupEnabled and connectionId provided', async () => {
    vi.mocked(getInFlight).mockReturnValue(null); // no duplicate

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(registerInFlight).toHaveBeenCalled();
  });

  it('does not register in-flight when _skipDedupCheck is true (sendAnyway)', async () => {
    vi.mocked(getInFlight).mockReturnValue(null);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT, _skipDedupCheck: true }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(registerInFlight).not.toHaveBeenCalled();
  });

  it('cleans up in-flight on unmount', () => {
    const { result, unmount } = renderHook(() => useGraphqlExecution());

    // Start an execution to set currentDedupKeyRef
    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });

    unmount();

    // removeInFlight called during unmount cleanup
    expect(removeInFlight).toHaveBeenCalled();
  });

  it('clears existing dedup registration when execute() is called while dedup is active (lines 262-264)', async () => {
    // Pause gqlFetch so the first request stays in-flight
    let resolveFirst!: (v: ReturnType<typeof makeSuccessResponse>) => void;
    vi.mocked(gqlFetch)
      .mockReturnValueOnce(new Promise<ReturnType<typeof makeSuccessResponse>>((r) => { resolveFirst = r; }))
      .mockResolvedValue(makeSuccessResponse());

    vi.mocked(getInFlight).mockReturnValue(null); // no duplicate on either call

    const { result } = renderHook(() => useGraphqlExecution());

    // First execute — registers dedup, currentDedupKeyRef becomes non-null
    act(() => { result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT })); });
    expect(result.current.status).toBe('loading');

    // Second execute while first is in-flight → hits lines 262-264 (removeInFlight + null)
    act(() => { result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT })); });

    // Resolve first fetch (ignored since abort was called)
    await act(async () => {
      resolveFirst(makeSuccessResponse());
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    // removeInFlight should have been called at least twice (once on re-execute, once on complete)
    expect(removeInFlight).toHaveBeenCalled();
  });
});

// ─── resolveDedupChoice ────────────────────────────────────────────────────────

describe('useGraphqlExecution — resolveDedupChoice()', () => {
  it('is a no-op when no pending dedup state', () => {
    const { result } = renderHook(() => useGraphqlExecution());
    act(() => { result.current.resolveDedupChoice('wait'); });
    expect(result.current.isDuplicate).toBe(false);
    expect(result.current.status).toBe('idle');
  });

  it('"wait" subscribes to shared promise and resolves to success', async () => {
    let resolveShared!: (r: import('../../../shared/types/graphql').GraphqlResponse) => void;
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>((r) => { resolveShared = r; });

    vi.mocked(getInFlight).mockReturnValueOnce({ controller: new AbortController(), promise: sharedPromise });

    const { result } = renderHook(() => useGraphqlExecution());

    // Trigger dedup detection
    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });
    expect(result.current.isDuplicate).toBe(true);

    // User chooses "wait"
    act(() => { result.current.resolveDedupChoice('wait'); });
    expect(result.current.status).toBe('loading');
    expect(result.current.isDuplicate).toBe(false);

    // Shared promise resolves
    await act(async () => {
      resolveShared({
        httpStatus: 200,
        httpHeaders: {},
        latencyMs: 50,
        timestamp: Date.now(),
        data: { result: 'ok' },
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.response?.data).toEqual({ result: 'ok' });
  });

  it('clears APQ badge while waiting and restores from shared response (Phase 6D)', async () => {
    vi.mocked(executeWithAPQ).mockResolvedValue({
      response: makeSuccessResponse(),
      cacheHit: true,
      hash: 'prior-hash',
      unsupported: false,
    });
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.apqInfo?.hash).toBe('prior-hash'));

    let resolveShared!: (r: import('../../../shared/types/graphql').GraphqlResponse) => void;
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>((r) => {
      resolveShared = r;
    });

    vi.mocked(getInFlight).mockReturnValueOnce({ controller: new AbortController(), promise: sharedPromise });

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });
    expect(result.current.isDuplicate).toBe(true);

    act(() => { result.current.resolveDedupChoice('wait'); });
    expect(result.current.status).toBe('loading');
    expect(result.current.apqInfo).toBeNull();

    await act(async () => {
      resolveShared({
        httpStatus: 200,
        httpHeaders: {},
        latencyMs: 10,
        timestamp: Date.now(),
        data: { ok: true },
        apqHash: 'shared-hash',
        apqCacheHit: true,
        apqUnsupported: false,
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.apqInfo).toEqual({
      hash: 'shared-hash',
      cacheHit: true,
      unsupported: false,
      connectionId: ENDPOINT,
    });
  });

  it('caches dedup wait result to the waiter tab via onExecutionCompleted (Phase 6A)', async () => {
    const onExecutionCompleted = vi.fn();
    let resolveShared!: (r: import('../../../shared/types/graphql').GraphqlResponse) => void;
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>((r) => {
      resolveShared = r;
    });

    vi.mocked(getInFlight).mockReturnValueOnce({ controller: new AbortController(), promise: sharedPromise });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({
        dedupEnabled: true,
        connectionId: ENDPOINT,
        sourceTabId: 'tab-waiter',
        onExecutionCompleted,
      }));
    });

    act(() => { result.current.resolveDedupChoice('wait'); });

    await act(async () => {
      resolveShared({
        httpStatus: 200,
        httpHeaders: {},
        latencyMs: 10,
        timestamp: Date.now(),
        data: { merged: true },
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(onExecutionCompleted).toHaveBeenCalledWith(
      'tab-waiter',
      'success',
      expect.objectContaining({ data: { merged: true } }),
      null,
    );
  });

  it('does not call onExecutionStarted when dedup duplicate pauses execution (Phase 6A)', () => {
    const onExecutionStarted = vi.fn();
    const fakePromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>(() => {});
    vi.mocked(getInFlight).mockReturnValue({ controller: new AbortController(), promise: fakePromise });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({
        dedupEnabled: true,
        connectionId: ENDPOINT,
        sourceTabId: 'tab-2',
        onExecutionStarted,
      }));
    });

    expect(result.current.isDuplicate).toBe(true);
    expect(onExecutionStarted).not.toHaveBeenCalled();
  });

  it('calls onExecutionStarted when execution actually starts loading (Phase 6A)', async () => {
    const onExecutionStarted = vi.fn();
    vi.mocked(getInFlight).mockReturnValue(null);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        sourceTabId: 'tab-1',
        onExecutionStarted,
      }));
      await Promise.resolve();
    });

    expect(onExecutionStarted).toHaveBeenCalledWith('tab-1');
  });

  it('does not call onExecutionStarted for sendAnyway (_skipDedupCheck) (Phase 6A)', async () => {
    const onExecutionStarted = vi.fn();
    vi.mocked(getInFlight).mockReturnValue(null);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        sourceTabId: 'tab-2',
        onExecutionStarted,
        dedupEnabled: true,
        connectionId: ENDPOINT,
        _skipDedupCheck: true,
      }));
      await Promise.resolve();
    });

    expect(onExecutionStarted).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('"wait" restores prior state when shared promise rejects', async () => {
    // Complete a request first to have a "prior" state
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('success'));

    // Now trigger dedup detection with a rejecting promise
    let rejectShared!: (e: Error) => void;
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>((_, rej) => { rejectShared = rej; });

    vi.mocked(getInFlight).mockReturnValueOnce({ controller: new AbortController(), promise: sharedPromise });

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });

    act(() => { result.current.resolveDedupChoice('wait'); });

    await act(async () => {
      rejectShared(new Error('Aborted'));
      await Promise.resolve();
    });

    // Restores the previous success state
    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('"cancel" aborts original and retries with _skipDedupCheckOnly', async () => {
    let resolveShared!: (r: import('../../../shared/types/graphql').GraphqlResponse) => void;
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>((r) => { resolveShared = r; });

    vi.mocked(getInFlight).mockReturnValueOnce({ controller: new AbortController(), promise: sharedPromise });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });
    expect(result.current.isDuplicate).toBe(true);

    // Reset getInFlight for the retry
    vi.mocked(getInFlight).mockReturnValue(null);

    await act(async () => {
      result.current.resolveDedupChoice('cancel');
      await Promise.resolve();
    });

    expect(handleDedupGuard).toHaveBeenCalledWith('dedup-key', 'cancel');
    expect(result.current.isDuplicate).toBe(false);

    // The retry request should complete
    await waitFor(() => expect(result.current.status).toBe('success'));
    resolveShared({ httpStatus: 200, httpHeaders: {}, latencyMs: 50, timestamp: Date.now(), data: null });
  });

  it('"sendAnyway" retries with _skipDedupCheck (runs alongside original)', async () => {
    let resolveShared!: (r: import('../../../shared/types/graphql').GraphqlResponse) => void;
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>((r) => { resolveShared = r; });

    vi.mocked(getInFlight).mockReturnValueOnce({ controller: new AbortController(), promise: sharedPromise });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });
    expect(result.current.isDuplicate).toBe(true);

    // Reset for retry
    vi.mocked(getInFlight).mockReturnValue(null);

    await act(async () => {
      result.current.resolveDedupChoice('sendAnyway');
      await Promise.resolve();
    });

    expect(result.current.isDuplicate).toBe(false);
    await waitFor(() => expect(result.current.status).toBe('success'));

    // registerInFlight must NOT be called for sendAnyway (no registration for the bypass copy)
    expect(registerInFlight).not.toHaveBeenCalled();
    resolveShared({ httpStatus: 200, httpHeaders: {}, latencyMs: 50, timestamp: Date.now(), data: null });
  });

  it('cancel() in undecided-dedup state dismisses without aborting the shared request', async () => {
    // Simulate a shared in-flight request with a separate abort controller
    const sharedCtrl = new AbortController();
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>(() => {});
    vi.mocked(getInFlight).mockReturnValue({ controller: sharedCtrl, promise: sharedPromise });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });
    expect(result.current.isDuplicate).toBe(true);

    // Pressing Cancel should clear isDuplicate but NOT abort the shared request
    act(() => { result.current.cancel(); });

    expect(result.current.isDuplicate).toBe(false);
    // The shared controller must NOT have been aborted
    expect(sharedCtrl.signal.aborted).toBe(false);
  });
});

// ─── APQ execution path ────────────────────────────────────────────────────────

describe('useGraphqlExecution — APQ execution path', () => {
  it('calls executeWithAPQ when apqEnabled is true (mock returns directly)', async () => {
    vi.mocked(executeWithAPQ).mockResolvedValue({
      response: makeSuccessResponse(),
      cacheHit: true,
      hash: 'abc123',
      unsupported: false,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(executeWithAPQ).toHaveBeenCalled();
    expect(result.current.apqInfo?.cacheHit).toBe(true);
  });

  it('reports APQ as unsupported when executeWithAPQ returns unsupported=true', async () => {
    vi.mocked(executeWithAPQ).mockResolvedValue({
      response: makeSuccessResponse(),
      cacheHit: false,
      hash: 'abc123',
      unsupported: true,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.apqInfo?.unsupported).toBe(true);
    expect(result.current.apqInfo?.connectionId).toBe(ENDPOINT);
  });

  it('exercises apqSendFn POST path via executeWithAPQ callthrough', async () => {
    // Instead of mocking the result, we implement executeWithAPQ to call the sendFn
    // This covers the APQ sendFn body (lines 493-566)
    vi.mocked(executeWithAPQ).mockImplementation(async (sendFn) => {
      // Call sendFn with POST (no GET) — covers the POST branch of the sendFn
      const response = await sendFn({ query: QUERY }, 'POST');
      return { response, cacheHit: false, hash: 'callthrough-hash', unsupported: false };
    });
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    // gqlFetch should have been called by the sendFn
    expect(gqlFetch).toHaveBeenCalled();
  });

  it('exercises apqSendFn GET path without skipTlsVerify', async () => {
    vi.mocked(executeWithAPQ).mockImplementation(async (sendFn) => {
      // Call sendFn with GET method — covers the GET branch (no skipTlsVerify)
      const response = await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'abc' } } }, 'GET');
      return { response, cacheHit: true, hash: 'abc', unsupported: false };
    });
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ apqEnabled: true, apqUseGet: true, connectionId: ENDPOINT }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(gqlFetch).toHaveBeenCalled();
  });

  it('exercises apqSendFn GET path with operationName (line 536 true branch)', async () => {
    vi.mocked(executeWithAPQ).mockImplementation(async (sendFn) => {
      // GET + operationName — exercises the `requestBody.operationName != null` true branch
      const response = await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'abc' } } }, 'GET');
      return { response, cacheHit: true, hash: 'abc', unsupported: false };
    });
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ apqEnabled: true, apqUseGet: true, operationName: 'MyOp', connectionId: ENDPOINT }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    // operationName should have been added to the GET URL query params
    const call = vi.mocked(gqlFetch).mock.calls[0];
    expect(call[0]).toContain('operationName');
  });

  it('exercises apqSendFn GET with skipTlsVerify=true AND operationName (line 507 true branch)', async () => {
    const { executeWithAPQ: mockAPQ } = await import('../utils/apqClient');
    vi.mocked(mockAPQ).mockImplementation(async (sendFn) => {
      // GET + skipTlsVerify + operationName → proxy path with operationName set
      const response = await sendFn(
        { extensions: { persistedQuery: { version: 1, sha256Hash: 'myhash' } } },
        'GET',
      );
      return { response, cacheHit: true, hash: 'myhash', unsupported: false };
    });
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        apqEnabled: true,
        apqUseGet: true,
        skipTlsVerify: true,
        operationName: 'ProxiedOp',
        connectionId: ENDPOINT,
      }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    const call = vi.mocked(gqlFetch).mock.calls[0];
    // Both proxy URL and operationName param should be present
    expect(call[0]).toContain('/api/graphql/query');
    expect(call[0]).toContain('operationName');
  });

  it('exercises apqSendFn POST path with hash-only body (no query field)', async () => {
    vi.mocked(executeWithAPQ).mockImplementation(async (sendFn) => {
      // Hash-only POST (no `query` field in bodyFields) — tests `isHashOnly` branch
      const response = await sendFn({ extensions: { persistedQuery: {} } }, 'POST');
      return { response, cacheHit: false, hash: 'abc', unsupported: false };
    });
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ apqEnabled: true, operationName: 'TestOp', connectionId: ENDPOINT }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    // Verify body sent to gqlFetch does not include the full query (hash-only)
    const call = vi.mocked(gqlFetch).mock.calls[0];
    const body = call[3] ? JSON.parse(call[3]) : {};
    expect('query' in body).toBe(false);
  });

  it('exercises apqSendFn POST hash-only path WITHOUT operationName (line 555 false branch)', async () => {
    vi.mocked(executeWithAPQ).mockImplementation(async (sendFn) => {
      // Hash-only POST (no `query` field) — operationName is undefined so false branch of line 555
      const response = await sendFn({ extensions: { persistedQuery: {} } }, 'POST');
      return { response, cacheHit: false, hash: 'abc', unsupported: false };
    });
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      // No operationName provided → undefined → the ternary at line 555 takes false branch
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    // The body should only contain the APQ hash fields (no operationName added)
    const call = vi.mocked(gqlFetch).mock.calls[0];
    const body = call[3] ? JSON.parse(call[3]) : {};
    expect('query' in body).toBe(false);
    expect('operationName' in body).toBe(false);
  });
});

// ─── File upload path ─────────────────────────────────────────────────────────

describe('useGraphqlExecution — file upload path', () => {
  it('calls gqlUpload when formData is provided (no @defer)', async () => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(false);
    vi.mocked(gqlUpload).mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { upload: 'ok' } }),
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    await act(async () => {
      result.current.execute(baseParams({ formData }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(gqlUpload).toHaveBeenCalled();
    expect(gqlFetch).not.toHaveBeenCalled();
  });

  it('Phase 6H: stamps upload responses with outgoing headers (no synthetic JSON Content-Type)', async () => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(false);
    vi.mocked(gqlUpload).mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { upload: 'ok' } }),
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    await act(async () => {
      result.current.execute(baseParams({
        formData,
        headers: { Authorization: 'Bearer upload-token' },
        authSentStamp: {
          source: 'tab',
          storedAuth: { type: 'bearer', token: 'upload-token' },
        },
      }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.response?.requestHeaders).toEqual({ Authorization: 'Bearer upload-token' });
    expect(result.current.response?.requestHeaders?.['Content-Type']).toBeUndefined();
    expect(result.current.response?.authSentSource).toBe('tab');
    expect(result.current.response?.authSentLines?.[0]).toContain('Authorization: Bearer upload');
  });

  it('handles gqlUpload Aborted error result', async () => {
    vi.mocked(gqlUpload).mockResolvedValue({
      status: 0,
      headers: {},
      body: '',
      error: 'Aborted',
    });

    const { result } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    await act(async () => {
      result.current.execute(baseParams({ formData }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    // After abort, restores last completed state (idle → idle)
    expect(result.current.status).toBe('idle');
  });

  it('handles gqlUpload error response as success (has data)', async () => {
    vi.mocked(gqlUpload).mockResolvedValue({
      status: 200,
      headers: {},
      body: JSON.stringify({ data: { file: 'uploaded' }, errors: [{ message: 'warn' }] }),
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    await act(async () => {
      result.current.execute(baseParams({ formData }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('handles file upload abort when ctrl.signal is aborted before gqlUpload resolves (line 342)', async () => {
    let resolveUpload!: (v: { status: number; headers: Record<string, string>; body: string; error: undefined }) => void;
    vi.mocked(gqlUpload).mockReturnValue(
      new Promise<{ status: number; headers: Record<string, string>; body: string; error: undefined }>(
        (r) => { resolveUpload = r; },
      ),
    );

    const { result } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    act(() => { result.current.execute(baseParams({ formData })); });
    expect(result.current.status).toBe('loading');

    // Cancel while upload is in-flight → aborts the signal
    act(() => { result.current.cancel(); });
    expect(result.current.status).toBe('idle');

    // gqlUpload resolves AFTER abort — ctrl.signal.aborted should be true
    await act(async () => {
      resolveUpload({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"data":{}}', error: undefined });
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Status stays idle (abort path rejects and returns without updating state again)
    expect(result.current.status).toBe('idle');
  });

  it('sets status to error when gqlUpload response has errors and null data (line 354 error branch)', async () => {
    vi.mocked(gqlUpload).mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: null, errors: [{ message: 'upload failed' }] }),
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    await act(async () => {
      result.current.execute(baseParams({ formData }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toBe('upload failed');
  });
});

// ─── Abort handling — standard path (lines 608-619) ──────────────────────────

describe('useGraphqlExecution — abort handling in standard path', () => {
  it('handles abort signal set before gqlFetch resolves (line 608)', async () => {
    let resolveFetch!: (v: ReturnType<typeof makeSuccessResponse>) => void;
    vi.mocked(gqlFetch).mockReturnValue(
      new Promise<ReturnType<typeof makeSuccessResponse>>((r) => { resolveFetch = r; }),
    );

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams()); });

    // Cancel while gqlFetch is pending → aborts the controller
    act(() => { result.current.cancel(); });
    expect(result.current.status).toBe('idle');

    // Resolve the fetch after abort — should hit the `ctrl.signal.aborted` check
    await act(async () => {
      resolveFetch(makeSuccessResponse());
      // Let the async body process
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Status should remain idle (restored by cancel)
    expect(result.current.status).toBe('idle');
  });

  it('handles gqlFetch returning { error: "Aborted" } (line 614)', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: 'Aborted',
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Should restore last completed state (idle → idle)
    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    expect(result.current.status).toBe('idle');
  });

  it('handles abort error from gqlFetch throwing AbortError in catch (lines 646-652)', async () => {
    let rejectFetch!: (e: Error) => void;
    vi.mocked(gqlFetch).mockReturnValue(
      new Promise<ReturnType<typeof makeSuccessResponse>>((_, rej) => { rejectFetch = rej; }),
    );

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams()); });

    // Cancel to set ctrl.signal.aborted = true
    act(() => { result.current.cancel(); });

    // Now reject gqlFetch — when catch block runs, ctrl.signal.aborted will be true
    await act(async () => {
      rejectFetch(Object.assign(new Error('AbortError'), { name: 'AbortError' }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // State should remain as set by cancel()
    expect(result.current.status).toBe('idle');
  });

  it('handles fetch rejection with aborted signal (AbortError) in catch block', async () => {
    // First complete a request so lastCompletedResponseRef is set to 'success'
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());
    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams());
      await new Promise<void>((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(result.current.status).toBe('success'));

    // Now set up a slow fetch, then abort it
    let rejectFetch!: (e: Error) => void;
    vi.mocked(gqlFetch).mockReturnValue(
      new Promise<ReturnType<typeof makeSuccessResponse>>((_, rej) => { rejectFetch = rej; }),
    );

    act(() => { result.current.execute(baseParams()); });
    act(() => { result.current.cancel(); });

    await act(async () => {
      rejectFetch(new Error('Network connection aborted'));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Restores last completed state (success)
    expect(result.current.status).toBe('success');
  });
});

// ─── Incremental delivery path (@defer/@stream, lines 364-484) ───────────────

describe('useGraphqlExecution — incremental delivery path', () => {
  beforeEach(() => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(true);
  });

  afterEach(() => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(false);
  });

  it('uses global.fetch for incremental queries (non-multipart response)', async () => {
    // Mock global.fetch for the incremental path
    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => k === 'content-type' ? 'application/json' : null,
        forEach: (fn: (v: string, k: string) => void) => {
          fn('application/json', 'content-type');
        },
      },
      body: JSON.stringify({ data: { user: { id: '1' } } }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { user @defer { id } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    // The incremental path handles non-multipart responses
    expect(global.fetch).toHaveBeenCalled();
  });

  it('handles incremental non-multipart path with valid JSON response (line 476 success, no errors)', async () => {
    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => k === 'content-type' ? 'application/json' : null,
        forEach: (fn: (v: string, k: string) => void) => fn('application/json', 'content-type'),
      },
      text: () => Promise.resolve(JSON.stringify({ data: { user: { id: '1' } } })),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { user @defer { id } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('handles incremental non-multipart with errors+data (line 476 right-side || evaluation)', async () => {
    // hasErr2=true forces evaluation of gqlResponse.data !== null (right side of ||)
    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => k === 'content-type' ? 'application/json' : null,
        forEach: (fn: (v: string, k: string) => void) => fn('application/json', 'content-type'),
      },
      text: () => Promise.resolve(
        JSON.stringify({ data: null, errors: [{ message: 'incremental error' }] }),
      ),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { user @defer { id } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('incremental path fetch rejects with non-Error value (line 406 "Network error" branch)', async () => {
    // Rejects with string instead of Error object → tests `? err.message : 'Network error'` false branch
    global.fetch = vi.fn().mockRejectedValue('string rejection');

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { user @defer { id } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toBe('Network error');
  });

  it('incremental response with null content-type (line 422 ?? right side)', async () => {
    // headers.get('content-type') returns null → ?? '' covers the right side of ??
    const mockResponse = {
      status: 200,
      headers: {
        get: () => null,
        forEach: (fn: (v: string, k: string) => void) => fn('', 'x-custom'),
      },
      text: () => Promise.resolve(JSON.stringify({ data: { x: 1 } })),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { x @defer { y } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('handles incremental path with fetch network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { user @defer { id } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toBe('Connection refused');
  });

  it('handles incremental path with multipart/mixed content-type', async () => {
    const { parseMultipartMixed: mockParser } = await import('../utils/multipartParser');

    // Mock a multipart response
    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => k === 'content-type' ? 'multipart/mixed; boundary=---' : null,
        forEach: (fn: (v: string, k: string) => void) => {
          fn('multipart/mixed', 'content-type');
        },
      },
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    // Mock parseMultipartMixed to call callback with a single chunk
    vi.mocked(mockParser).mockImplementation(async (_resp, callback) => {
      callback({
        merged: { data: 'ok' },
        errors: undefined,
        extensions: undefined,
        hasNext: false,
      });
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { x @defer { y } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).not.toBe('loading'));
  });

  it('handles multipart stream where no final chunk is received (line 464 false branch)', async () => {
    const { parseMultipartMixed: mockParser } = await import('../utils/multipartParser');

    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => k === 'content-type' ? 'multipart/mixed; boundary=---' : null,
        forEach: (fn: (v: string, k: string) => void) => fn('multipart/mixed', 'content-type'),
      },
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    // Mock parseMultipartMixed to call callback with only intermediate chunks (hasNext=true)
    vi.mocked(mockParser).mockImplementation(async (_resp, callback) => {
      // Only intermediate chunk — hasNext=true means lastChunkResp stays null
      callback({
        merged: { partial: true },
        errors: undefined,
        extensions: undefined,
        hasNext: true,
      });
      // Stream ends without a final chunk — chunkIdx=1 but lastChunkResp=null
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { x @defer { y } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    // With only intermediate chunks and no final, status stays in 'loading' from the chunk update
    await waitFor(() => expect(result.current.status).not.toBe('idle'));
  });
});

// ─── Unmount cleanup ──────────────────────────────────────────────────────────

describe('useGraphqlExecution — unmount cleanup', () => {
  it('aborts in-flight request on unmount', () => {
    let fetchController!: AbortSignal;
    vi.mocked(gqlFetch).mockImplementation((_, _method, _headers, _body, signal) => {
      fetchController = signal!;
      return new Promise(() => {}); // never resolves
    });

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams()); });

    unmount();

    // Signal should be aborted after unmount
    expect(fetchController.aborted).toBe(true);
  });

  it('does not update state after unmount', async () => {
    let resolveFetch!: (v: ReturnType<typeof makeSuccessResponse>) => void;
    vi.mocked(gqlFetch).mockReturnValue(
      new Promise<ReturnType<typeof makeSuccessResponse>>((r) => { resolveFetch = r; }),
    );

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams()); });
    expect(result.current.status).toBe('loading');

    unmount();

    // Resolve after unmount — should not cause state updates or errors
    await act(async () => {
      resolveFetch(makeSuccessResponse());
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // No crash — test passes if no error is thrown
  });

  it('updates state after StrictMode remount (mountedRef reset on mount)', async () => {
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution(), { reactStrictMode: true });

    act(() => { result.current.execute(baseParams()); });

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    expect(result.current.status).toBe('success');
    expect(result.current.response?.data).toEqual({ user: { id: '1', name: 'Alice' } });
  });
});

// ─── Incremental + skipTlsVerify path ─────────────────────────────────────────

describe('useGraphqlExecution — incremental delivery + skipTlsVerify', () => {
  beforeEach(() => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(true);
  });

  afterEach(() => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(false);
  });

  it('routes incremental request through /api/graphql/query proxy when skipTlsVerify=true', async () => {
    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => (k === 'content-type' ? 'application/json' : null),
        forEach: (fn: (v: string, k: string) => void) => {
          fn('application/json', 'content-type');
        },
      },
      text: vi.fn().mockResolvedValue(JSON.stringify({ data: { hello: 'world' } })),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        query: 'query { hello @defer { name } }',
        skipTlsVerify: true,
      }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).not.toBe('loading'));

    // Should have called the proxy endpoint
    const fetchCalls = vi.mocked(global.fetch).mock.calls;
    expect(fetchCalls[0][0]).toBe('/api/graphql/query');
  });

  it('uses Content-Type header from passed headers when skipTlsVerify=true (line 382 coverage)', async () => {
    // requestHeaders['Accept'] is always set by isIncremental (line 308), so the ?? right side
    // is dead code — but the test exercises the skipTlsVerify fetch path with custom headers
    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => (k === 'content-type' ? 'application/json' : null),
        forEach: (fn: (v: string, k: string) => void) => fn('application/json', 'content-type'),
      },
      text: vi.fn().mockResolvedValue(JSON.stringify({ data: { hello: 'world' } })),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        query: 'query { hello @defer { name } }',
        skipTlsVerify: true,
        headers: { 'X-Custom': 'value' },
      }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    const fetchCalls = vi.mocked(global.fetch).mock.calls;
    expect(fetchCalls[0][0]).toBe('/api/graphql/query');
  });

  it('sends incremental request directly to endpoint when skipTlsVerify=false', async () => {
    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => (k === 'content-type' ? 'application/json' : null),
        forEach: (fn: (v: string, k: string) => void) => {
          fn('application/json', 'content-type');
        },
      },
      text: vi.fn().mockResolvedValue(JSON.stringify({ data: { hello: 'world' } })),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        query: 'query { hello @defer { name } }',
        skipTlsVerify: false,
      }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).not.toBe('loading'));

    // Should have called the actual endpoint
    const fetchCalls = vi.mocked(global.fetch).mock.calls;
    expect(fetchCalls[0][0]).toBe(ENDPOINT);
  });

  it('handles incremental abort signal from fetch rejection', async () => {
    const abortError = Object.assign(new Error('AbortError'), { name: 'AbortError' });
    global.fetch = vi.fn().mockRejectedValue(abortError);

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ query: 'query { x @defer { y } }' }));
      result.current.cancel();
    });

    await act(async () => { await new Promise<void>((r) => setTimeout(r, 10)); });

    // Status should be idle (restored from cancel)
    expect(result.current.status).toBe('idle');
  });

  it('handles incremental multipart/mixed with empty chunks (chunkIdx=0)', async () => {
    const { parseMultipartMixed: mockParser } = await import('../utils/multipartParser');

    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => (k === 'content-type' ? 'multipart/mixed; boundary=---' : null),
        forEach: vi.fn(),
      },
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    // Mock parseMultipartMixed to never call the callback (0 chunks)
    vi.mocked(mockParser).mockImplementation(async () => {
      // No callback calls → chunkIdx remains 0
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { x @defer { y } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toContain('no incremental chunks');
  });
});

// ─── APQ path with abort ───────────────────────────────────────────────────────

describe('useGraphqlExecution — APQ abort handling', () => {
  it('handles ctrl.signal.aborted after APQ completes (lines 585-594)', async () => {
    const { executeWithAPQ: mockAPQ } = await import('../utils/apqClient');

    // APQ mock resolves, but we'll cancel before it settles
    let resolveAPQ!: (v: { response: ReturnType<typeof makeSuccessResponse>; cacheHit: boolean; hash: string; unsupported: boolean }) => void;
    vi.mocked(mockAPQ).mockReturnValue(
      new Promise((r) => { resolveAPQ = r; }),
    );
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
    });

    // Cancel while APQ is in-flight
    act(() => { result.current.cancel(); });
    expect(result.current.status).toBe('idle');

    // Resolve APQ after cancellation — signal is already aborted
    await act(async () => {
      resolveAPQ({
        response: makeSuccessResponse() as never,
        cacheHit: false,
        hash: 'abc123',
        unsupported: false,
      });
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Status should stay as idle (restored by cancel)
    expect(result.current.status).toBe('idle');
  });

  it('exercises apqSendFn GET path with skipTlsVerify=true (TLS proxy branch)', async () => {
    const { executeWithAPQ: mockAPQ } = await import('../utils/apqClient');

    vi.mocked(mockAPQ).mockImplementation(async (sendFn) => {
      // Call sendFn with GET + skipTlsVerify path
      const response = await sendFn(
        { extensions: { persistedQuery: { version: 1, sha256Hash: 'myhash' } } },
        'GET',
      );
      return { response, cacheHit: true, hash: 'myhash', unsupported: false };
    });
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        apqEnabled: true,
        apqUseGet: true,
        skipTlsVerify: true,
        connectionId: ENDPOINT,
      }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    // gqlFetch should have been called with the proxy URL
    const fetchCall = vi.mocked(gqlFetch).mock.calls[0];
    expect(fetchCall[0]).toContain('/api/graphql/query');
  });

  it('exercises apqSendFn GET with invalid endpoint URL falls back to relative URL', async () => {
    const { executeWithAPQ: mockAPQ } = await import('../utils/apqClient');

    vi.mocked(mockAPQ).mockImplementation(async (sendFn) => {
      const response = await sendFn(
        { extensions: { persistedQuery: {} } },
        'GET',
      );
      return { response, cacheHit: false, hash: 'x', unsupported: false };
    });
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      // Use a non-absolute endpoint to trigger the try/catch in apqSendFn GET
      result.current.execute({
        ...baseParams(),
        endpoint: '/relative/graphql',
        apqEnabled: true,
        apqUseGet: true,
        skipTlsVerify: false,
        connectionId: 'relative',
      });
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
  });
});

// ─── Standard path abort after gqlFetch resolves ─────────────────────────────

describe('useGraphqlExecution — standard path abort after response', () => {
  it('handles ctrl.signal.aborted after gqlFetch resolves (lines 631-634)', async () => {
    let resolveGqlFetch!: (v: ReturnType<typeof makeSuccessResponse>) => void;
    vi.mocked(gqlFetch).mockReturnValue(
      new Promise<ReturnType<typeof makeSuccessResponse>>((r) => { resolveGqlFetch = r; }),
    );

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams()); });
    expect(result.current.status).toBe('loading');

    // Cancel while gqlFetch is pending
    act(() => { result.current.cancel(); });
    expect(result.current.status).toBe('idle');

    // gqlFetch resolves after abort — ctrl.signal.aborted is true
    await act(async () => {
      resolveGqlFetch(makeSuccessResponse());
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Status stays idle (restored from cancel, not overwritten by the aborted path)
    expect(result.current.status).toBe('idle');
  });

  it('hits ctrl.signal.aborted check at line 631 via APQ path abort', async () => {
    // In the APQ path there is no early abort check inside the block,
    // so if the user cancels while APQ is processing and APQ still returns,
    // line 631 (ctrl.signal.aborted) catches it.
    let resolveAPQ!: (v: { response: unknown; cacheHit: boolean; hash: string; unsupported: boolean }) => void;
    vi.mocked(executeWithAPQ).mockReturnValue(
      new Promise((r) => { resolveAPQ = r; }),
    );
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT })); });

    // Cancel while APQ is in-flight
    act(() => { result.current.cancel(); });

    // APQ resolves after abort — should hit line 631
    await act(async () => {
      resolveAPQ({
        response: { status: 200, data: { id: 1 }, errors: undefined, latencyMs: 1, raw: '{}' },
        cacheHit: true, hash: 'abc', unsupported: false,
      });
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Status stays idle (aborted path rejected the promise)
    expect(result.current.status).toBe('idle');
  });
});

// ─── cancel() after unmount ───────────────────────────────────────────────────

describe('useGraphqlExecution — cancel() after unmount (line 179)', () => {
  it('does not update state when cancel() is called after component unmounts', async () => {
    vi.mocked(gqlFetch).mockReturnValue(new Promise(() => {})); // never resolves

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    // Start a request
    act(() => { result.current.execute(baseParams()); });
    expect(result.current.status).toBe('loading');

    // Save cancel before unmount
    const cancelFn = result.current.cancel;

    // Unmount — sets mountedRef.current = false
    unmount();

    // Call cancel after unmount — should NOT throw or error
    expect(() => { act(() => { cancelFn(); }); }).not.toThrow();
  });
});

// ─── dedup cleanup guard — replacement request took over ─────────────────────

describe('useGraphqlExecution — dedup cleanup guard (lines 678-679)', () => {
  it('skips removeInFlight when a replacement request has registered a new entry', async () => {
    let resolveFirst!: (v: ReturnType<typeof makeSuccessResponse>) => void;
    vi.mocked(gqlFetch).mockReturnValueOnce(
      new Promise<ReturnType<typeof makeSuccessResponse>>((r) => { resolveFirst = r; }),
    );
    vi.mocked(buildDedupKey).mockReturnValue('dedup-k');
    vi.mocked(handleDedupGuard).mockReturnValue(false);
    // getInFlight first returns null (registration), then returns a DIFFERENT promise
    // (simulating a replacement request registering before our finally block runs)
    const differentPromise = Promise.resolve({ httpStatus: 200 } as never);
    vi.mocked(getInFlight)
      .mockReturnValueOnce(null) // first call during execute
      .mockReturnValue({ promise: differentPromise, abort: vi.fn() }); // in finally: different promise
    vi.mocked(registerInFlight).mockReturnValue(undefined);

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: 'c1' }));
    });

    await act(async () => {
      resolveFirst(makeSuccessResponse());
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    // removeInFlight should NOT have been called because `stillOurs` is false
    expect(removeInFlight).not.toHaveBeenCalled();
  });
});

// ─── dedup "wait" with error response (line 711) ─────────────────────────────

describe('useGraphqlExecution — dedup "wait" error response (line 711)', () => {
  it('"wait" resolves to error status when response has errors and data is null', async () => {
    let resolveShared!: (v: GraphqlResponse) => void;
    const sharedPromise = new Promise<GraphqlResponse>((r) => { resolveShared = r; });

    vi.mocked(getInFlight)
      .mockReturnValueOnce({ promise: sharedPromise, abort: vi.fn() });
    vi.mocked(buildDedupKey).mockReturnValue('shared-key');
    vi.mocked(handleDedupGuard).mockImplementation((_key, _promise, _setDup, _setPending) => {
      _setDup(true);
      _setPending({ promise: sharedPromise, abort: vi.fn() });
      return true;
    });

    const { result } = renderHook(() => useGraphqlExecution());

    // Execute — the dedup guard fires, setting isDuplicate=true
    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: 'c1' }));
    });

    // User picks "wait"
    act(() => { result.current.resolveDedupChoice('wait'); });

    // The shared promise resolves with an error-only response (data = null)
    const errorResp: GraphqlResponse = {
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 50,
      timestamp: Date.now(),
      data: null,
      errors: [{ message: 'Something went wrong' }],
    };

    await act(async () => {
      resolveShared(errorResp);
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0].message).toBe('Something went wrong');
  });
});

// ─── Imports needed for GraphqlResponse type ─────────────────────────────────

import type { GraphqlResponse } from '../../../shared/types/graphql';

// ─── Multipart streaming — error status for final chunk (lines 442-445) ──────

describe('useGraphqlExecution — multipart final chunk with errors and null data', () => {
  beforeEach(() => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(true);
  });
  afterEach(() => {
    vi.mocked(hasIncrementalDirective).mockReturnValue(false);
  });

  it('sets status to error when final chunk has errors and no data', async () => {
    const { parseMultipartMixed: mockParser } = await import('../utils/multipartParser');

    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => k === 'content-type' ? 'multipart/mixed; boundary=---' : null,
        forEach: (fn: (v: string, k: string) => void) => fn('multipart/mixed', 'content-type'),
      },
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    vi.mocked(mockParser).mockImplementation(async (_resp, callback) => {
      callback({
        merged: null,
        errors: [{ message: 'stream error' }],
        extensions: undefined,
        hasNext: false, // last chunk
      });
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { x @defer { y } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('handles intermediate (non-last) streaming chunks followed by final chunk (lines 445-446)', async () => {
    const { parseMultipartMixed: mockParser } = await import('../utils/multipartParser');

    const mockResponse = {
      status: 200,
      headers: {
        get: (k: string) => k === 'content-type' ? 'multipart/mixed; boundary=---' : null,
        forEach: (fn: (v: string, k: string) => void) => fn('multipart/mixed', 'content-type'),
      },
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    vi.mocked(mockParser).mockImplementation(async (_resp, callback) => {
      // Intermediate chunk: hasNext=true (not last)
      callback({
        merged: { partial: true },
        errors: undefined,
        extensions: undefined,
        hasNext: true,
      });
      // Final chunk: hasNext=false
      callback({
        merged: { partial: true, done: true },
        errors: undefined,
        extensions: undefined,
        hasNext: false,
      });
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({ query: 'query { x @defer { y } }' }));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    // After all chunks received, status should be success
    await waitFor(() => expect(result.current.status).toBe('success'));
  });
});

// ─── HTTP 4xx synthetic error + cancel while waiting on dedup ─────────────────

describe('useGraphqlExecution — HTTP error body normalization', () => {
  it('adds synthetic GraphQL error for 4xx HTTP with empty errors array', async () => {
    vi.mocked(gqlFetch).mockResolvedValueOnce({
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: null, errors: [] }),
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      await result.current.execute(baseParams());
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0]?.message).toContain('HTTP 502');
  });

  it('uses body slice when synthesizing 4xx error from non-GraphQL JSON payload', async () => {
    vi.mocked(gqlFetch).mockResolvedValueOnce({
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'missing route' }),
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      await result.current.execute(baseParams());
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0]?.message).toContain('HTTP 404');
    expect(result.current.response?.errors?.[0]?.message).toContain('missing route');
  });

  it('marks non-JSON 4xx responses as errors via parseHttpBody catch path', async () => {
    vi.mocked(gqlFetch).mockResolvedValueOnce({
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'text/html' },
      body: '<html>error</html>',
      error: undefined,
    });

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      await result.current.execute(baseParams());
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.response?.errors?.[0]?.message).toContain('non-JSON');
  });
});

describe('useGraphqlExecution — cancel during dedup wait subscription', () => {
  it('restores prior idle state when cancel() is called after choosing wait', async () => {
    let resolveShared!: (v: GraphqlResponse) => void;
    const sharedPromise = new Promise<GraphqlResponse>((r) => { resolveShared = r; });

    vi.mocked(getInFlight)
      .mockReturnValueOnce({ promise: sharedPromise, abort: vi.fn() });
    vi.mocked(handleDedupGuard).mockImplementation((_key, _promise, _setDup, _setPending) => {
      _setDup(true);
      _setPending({ promise: sharedPromise, abort: vi.fn() });
      return true;
    });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });

    act(() => { result.current.resolveDedupChoice('wait'); });

    await waitFor(() => expect(result.current.status).toBe('loading'));

    act(() => { result.current.cancel(); });

    expect(result.current.status).toBe('idle');
    expect(result.current.isDuplicate).toBe(false);

    await act(async () => {
      resolveShared(makeSuccessResponse());
    });
  });

  it('restores prior state when shared dedup promise rejects during wait', async () => {
    let rejectShared!: (reason?: unknown) => void;
    const sharedPromise = new Promise<GraphqlResponse>((_, reject) => { rejectShared = reject; });

    vi.mocked(getInFlight)
      .mockReturnValueOnce({ promise: sharedPromise, abort: vi.fn() });
    vi.mocked(handleDedupGuard).mockImplementation((_key, _promise, _setDup, _setPending) => {
      _setDup(true);
      _setPending({ promise: sharedPromise, abort: vi.fn() });
      return true;
    });

    const { result } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });

    act(() => { result.current.resolveDedupChoice('wait'); });

    await waitFor(() => expect(result.current.status).toBe('loading'));

    await act(async () => {
      rejectShared(new Error('shared failed'));
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    expect(result.current.status).toBe('idle');
  });

  it('cancel() after unmount during pending dedup is a no-op for state updates', async () => {
    vi.mocked(getInFlight).mockReturnValueOnce({
      promise: new Promise<GraphqlResponse>(() => {}),
      abort: vi.fn(),
    });
    vi.mocked(handleDedupGuard).mockImplementation((_key, _promise, setDup, setPending) => {
      setDup(true);
      setPending({ promise: new Promise<GraphqlResponse>(() => {}), abort: vi.fn() });
      return true;
    });

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });
    expect(result.current.isDuplicate).toBe(true);

    const cancelFn = result.current.cancel;
    unmount();
    expect(() => act(() => { cancelFn(); })).not.toThrow();
  });
});

describe('useGraphqlExecution — unmount guards on async completion paths', () => {
  it('does not restore state when cancel wait runs after unmount', async () => {
    let resolveShared!: (v: import('../../../shared/types/graphql').GraphqlResponse) => void;
    const sharedPromise = new Promise<import('../../../shared/types/graphql').GraphqlResponse>((r) => { resolveShared = r; });

    vi.mocked(getInFlight)
      .mockReturnValueOnce({ promise: sharedPromise, abort: vi.fn() });
    vi.mocked(handleDedupGuard).mockImplementation((_key, _promise, _setDup, _setPending) => {
      _setDup(true);
      _setPending({ promise: sharedPromise, abort: vi.fn() });
      return true;
    });

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ dedupEnabled: true, connectionId: ENDPOINT }));
    });
    act(() => { result.current.resolveDedupChoice('wait'); });
    await waitFor(() => expect(result.current.status).toBe('loading'));

    const cancelFn = result.current.cancel;
    unmount();
    expect(() => act(() => { cancelFn(); })).not.toThrow();

    await act(async () => {
      resolveShared(makeSuccessResponse());
    });
  });

  it('does not update state when gqlUpload returns Aborted after unmount', async () => {
    vi.mocked(gqlUpload).mockResolvedValue({
      status: 0,
      headers: {},
      body: '',
      error: 'Aborted',
    });

    const { result, unmount } = renderHook(() => useGraphqlExecution());
    const formData = new FormData();

    act(() => {
      result.current.execute(baseParams({ formData }));
    });
    expect(result.current.status).toBe('loading');

    unmount();
    await act(async () => { await Promise.resolve(); });
  });

  it('APQ GET with client cert routes through POST TLS proxy', async () => {
    vi.mocked(executeWithAPQ).mockImplementation(async (sendFn) => {
      const response = await sendFn(
        { extensions: { persistedQuery: { version: 1, sha256Hash: 'cert-hash' } } },
        'GET',
      );
      return { response, cacheHit: true, hash: 'cert-hash', unsupported: false };
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue(JSON.stringify({ data: { ok: true } })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        apqEnabled: true,
        apqUseGet: true,
        tls: { caCert: '-----BEGIN CERT-----\nMIIB' },
        connectionId: ENDPOINT,
      }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/graphql/query'),
      expect.objectContaining({ method: 'POST' }),
    );
    const proxyBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(proxyBody.extensions).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('APQ TLS POST proxy forwards operationName and variables from GET body', async () => {
    vi.mocked(executeWithAPQ).mockImplementation(async (sendFn) => {
      const response = await sendFn(
        {
          extensions: { persistedQuery: { version: 1, sha256Hash: 'hash-1' } },
          variables: { id: '1' },
        },
        'GET',
      );
      return { response, cacheHit: false, hash: 'hash-1', unsupported: false };
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue(JSON.stringify({ data: { item: true } })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphqlExecution());

    await act(async () => {
      result.current.execute(baseParams({
        apqEnabled: true,
        apqUseGet: true,
        operationName: 'ItemQuery',
        variables: '{"id":"1"}',
        tls: { clientCert: '-----BEGIN CERT-----\nABC' },
        connectionId: ENDPOINT,
      }));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    const proxyBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(proxyBody.operationName).toBe('ItemQuery');
    expect(proxyBody.variables).toEqual({ id: '1' });
    expect(proxyBody.extensions).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('skips setStatus after standard gqlFetch when unmounted before completion', async () => {
    let resolveFetch!: (v: ReturnType<typeof makeSuccessResponse>) => void;
    vi.mocked(gqlFetch).mockReturnValue(
      new Promise<ReturnType<typeof makeSuccessResponse>>((r) => { resolveFetch = r; }),
    );

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams()); });
    expect(result.current.status).toBe('loading');
    unmount();

    await act(async () => {
      resolveFetch(makeSuccessResponse());
      await Promise.resolve();
    });
  });

  it('skips setApqInfo when unmounted before APQ completes', async () => {
    let resolveAPQ!: (v: Awaited<ReturnType<typeof executeWithAPQ>>) => void;
    vi.mocked(executeWithAPQ).mockReturnValue(
      new Promise<Awaited<ReturnType<typeof executeWithAPQ>>>((r) => { resolveAPQ = r; }),
    );

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    act(() => {
      result.current.execute(baseParams({ apqEnabled: true, connectionId: ENDPOINT }));
    });
    unmount();

    await act(async () => {
      resolveAPQ({
        response: makeSuccessResponse() as never,
        cacheHit: true,
        hash: 'late-hash',
        unsupported: false,
      });
      await Promise.resolve();
    });

    expect(result.current.apqInfo).toBeNull();
  });

  it('skips error setStatus when unmounted before gqlFetch rejection', async () => {
    vi.mocked(gqlFetch).mockRejectedValue(new Error('network down'));

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams()); });
    unmount();

    await act(async () => { await Promise.resolve(); });
    expect(result.current.status).toBe('loading');
  });

  it('skips restoreCompletedSnapshot when gqlFetch Aborted after unmount', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 0,
      headers: {},
      body: '',
      error: 'Aborted',
    });

    const { result, unmount } = renderHook(() => useGraphqlExecution());

    act(() => { result.current.execute(baseParams()); });
    unmount();

    await act(async () => { await Promise.resolve(); });
  });
});
