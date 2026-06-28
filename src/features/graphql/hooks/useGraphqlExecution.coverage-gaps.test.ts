/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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

import { useGraphqlExecution } from './useGraphqlExecution';
import { gqlFetch } from '../utils/gqlFetch';
import { getInFlight } from '../utils/dedupExecution';

const ENDPOINT = 'https://api.example.com/graphql';

function makeSuccessResponse(data: unknown = { ok: true }) {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
    error: undefined,
  };
}

describe('useGraphqlExecution — coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gqlFetch).mockResolvedValue(makeSuccessResponse());
    vi.mocked(getInFlight).mockReturnValue(null);
  });

  it('applyResult sets external batch response without calling fetch', async () => {
    const { result } = renderHook(() => useGraphqlExecution());
    const external = {
      data: { batch: true },
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 1,
      timestamp: Date.now(),
    };
    act(() => {
      result.current.applyResult('success', external);
    });
    expect(result.current.status).toBe('success');
    expect(result.current.response).toEqual(external);
    expect(gqlFetch).not.toHaveBeenCalled();
  });

  it('cancel restores last completed snapshot after a successful execute', async () => {
    const { result } = renderHook(() => useGraphqlExecution());
    await act(async () => {
      result.current.execute({
        endpoint: ENDPOINT,
        query: 'query { a }',
        variables: '{}',
        headers: {},
      });
      await Promise.resolve();
    });
    expect(result.current.status).toBe('success');
    act(() => {
      result.current.execute({
        endpoint: ENDPOINT,
        query: 'query { b }',
        variables: '{}',
        headers: {},
      });
    });
    act(() => { result.current.cancel(); });
    expect(result.current.status).toBe('success');
    expect(result.current.response?.data).toEqual({ ok: true });
  });

  it('cancel restores idle when abort controller never started', () => {
    const { result } = renderHook(() => useGraphqlExecution());
    act(() => { result.current.cancel(); });
    expect(result.current.status).toBe('idle');
    expect(result.current.response).toBeNull();
  });

  it('applyResult is a no-op after unmount', async () => {
    const { result, unmount } = renderHook(() => useGraphqlExecution());
    unmount();
    expect(() => {
      act(() => {
        result.current.applyResult('error', {
          data: null,
          httpStatus: 500,
          httpHeaders: {},
          latencyMs: 0,
          timestamp: Date.now(),
          errors: [{ message: 'fail' }],
        });
      });
    }).not.toThrow();
  });
});
