/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  resolveTabResponsePaneState,
  resolveActiveTabApqInfo,
  resolveActiveTabUploadProgress,
  useGqlTabResponseCache,
} from './useGqlTabResponseCache';
import type { ApqInfo } from './useGraphqlExecution';
import type { GraphqlResponse } from '../../../shared/types/graphql';

function makeResponse(overrides: Partial<GraphqlResponse> = {}): GraphqlResponse {
  return {
    data: { hello: 'world' },
    latencyMs: 12,
    timestamp: Date.now(),
    httpStatus: 200,
    ...overrides,
  };
}

describe('resolveTabResponsePaneState', () => {
  it('returns idle when tab has no cache and is not executing', () => {
    const state = resolveTabResponsePaneState('tab-1', null, 'idle', null, new Map());
    expect(state).toEqual({ response: null, execStatus: 'idle', executing: false });
  });

  it('returns live loading state when active tab owns in-flight execution', () => {
    const partial = makeResponse({ data: null });
    const state = resolveTabResponsePaneState('tab-1', 'tab-1', 'loading', partial, new Map());
    expect(state.executing).toBe(true);
    expect(state.execStatus).toBe('loading');
    expect(state.response).toBe(partial);
  });

  it('returns live success when active tab owns completed execution', () => {
    const resp = makeResponse();
    const state = resolveTabResponsePaneState('tab-1', 'tab-1', 'success', resp, new Map());
    expect(state).toEqual({ response: resp, execStatus: 'success', executing: false });
  });

  it('returns cached response when switching away from completed tab', () => {
    const tab1Resp = makeResponse({ data: { tab: 1 } });
    const tab2Resp = makeResponse({ data: { tab: 2 } });
    const cache = new Map([
      ['tab-1', { status: 'success' as const, response: tab1Resp }],
      ['tab-2', { status: 'success' as const, response: tab2Resp }],
    ]);

    const onTab2 = resolveTabResponsePaneState('tab-2', 'tab-1', 'success', tab1Resp, cache);
    expect(onTab2.response?.data).toEqual({ tab: 2 });
    expect(onTab2.execStatus).toBe('success');

    const onTab1 = resolveTabResponsePaneState('tab-1', 'tab-1', 'success', tab1Resp, cache);
    expect(onTab1.response?.data).toEqual({ tab: 1 });
  });

  it('does not show in-flight response from another tab on active tab', () => {
    const tab1Live = makeResponse({ data: { loading: true } });
    const tab2Cached = makeResponse({ data: { tab: 2 } });
    const cache = new Map([['tab-2', { status: 'success' as const, response: tab2Cached }]]);

    const state = resolveTabResponsePaneState('tab-2', 'tab-1', 'loading', tab1Live, cache);
    expect(state.response?.data).toEqual({ tab: 2 });
    expect(state.executing).toBe(false);
  });

  it('returns live error when active tab owns failed execution', () => {
    const state = resolveTabResponsePaneState('tab-1', 'tab-1', 'error', null, new Map());
    expect(state).toEqual({ response: null, execStatus: 'error', executing: false });
  });

  it('caches error completion even when response payload is null', () => {
    const state = resolveTabResponsePaneState('tab-1', 'tab-1', 'error', null, new Map([
      ['tab-1', { status: 'error' as const, response: null }],
    ]));
    expect(state.execStatus).toBe('error');
    expect(state.response).toBeNull();
  });
});

describe('resolveActiveTabApqInfo', () => {
  const tab1Apq: ApqInfo = { hash: 'aaa', cacheHit: true, unsupported: false };
  const tab2Apq: ApqInfo = { hash: 'bbb', cacheHit: false, unsupported: false };
  const liveApq: ApqInfo = { hash: 'live', cacheHit: false, unsupported: false };

  it('returns live apqInfo when active tab owns execution', () => {
    const cache = new Map([
      ['tab-1', { status: 'success' as const, response: null, apqInfo: tab1Apq }],
    ]);
    expect(resolveActiveTabApqInfo('tab-1', 'tab-1', liveApq, cache)).toBe(liveApq);
  });

  it('returns cached apqInfo when viewing a non-executing tab', () => {
    const cache = new Map([
      ['tab-1', { status: 'success' as const, response: null, apqInfo: tab1Apq }],
      ['tab-2', { status: 'idle' as const, response: null }],
    ]);
    expect(resolveActiveTabApqInfo('tab-1', 'tab-2', liveApq, cache)).toEqual(tab1Apq);
  });

  it('returns null when tab has no cached apqInfo and is not executing', () => {
    const cache = new Map([
      ['tab-2', { status: 'success' as const, response: null, apqInfo: tab2Apq }],
    ]);
    expect(resolveActiveTabApqInfo('tab-1', 'tab-2', liveApq, cache)).toBeNull();
  });

  it('returns null when cached apqInfo is explicitly null', () => {
    const cache = new Map([
      ['tab-1', { status: 'success' as const, response: null, apqInfo: null }],
    ]);
    expect(resolveActiveTabApqInfo('tab-1', 'tab-2', liveApq, cache)).toBeNull();
  });
});

describe('resolveActiveTabUploadProgress', () => {
  it('returns cached progress for the active tab', () => {
    const cache = new Map([
      ['tab-1', { status: 'loading' as const, response: null, uploadProgress: 55 }],
      ['tab-2', { status: 'idle' as const, response: null }],
    ]);
    expect(resolveActiveTabUploadProgress('tab-1', cache)).toBe(55);
    expect(resolveActiveTabUploadProgress('tab-2', cache)).toBeNull();
  });

  it('returns null when cached upload progress is explicitly zero', () => {
    const cache = new Map([
      ['tab-1', { status: 'loading' as const, response: null, uploadProgress: 0 }],
    ]);
    expect(resolveActiveTabUploadProgress('tab-1', cache)).toBe(0);
  });
});

describe('useGqlTabResponseCache', () => {
  it('caches execution results and resolves per active tab', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());
    const resp1 = makeResponse({ data: { n: 1 } });
    const resp2 = makeResponse({ data: { n: 2 } });

    act(() => {
      result.current.markExecutionStarted('tab-1');
      result.current.cacheExecutionResult('tab-1', 'success', resp1);
      result.current.markExecutionStarted('tab-2');
      result.current.cacheExecutionResult('tab-2', 'success', resp2);
    });

    const tab1View = result.current.resolvePaneState('tab-1', 'success', resp2);
    expect(tab1View.response?.data).toEqual({ n: 1 });

    const tab2View = result.current.resolvePaneState('tab-2', 'success', resp2);
    expect(tab2View.response?.data).toEqual({ n: 2 });
  });

  it('removeTabFromCache drops snapshot and clears executing ref when tab closes mid-flight', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());
    const resp = makeResponse();

    act(() => {
      result.current.markExecutionStarted('tab-1');
      result.current.cacheExecutionResult('tab-1', 'success', resp);
      result.current.removeTabFromCache('tab-1');
    });

    expect(result.current.responseCache.has('tab-1')).toBe(false);
    expect(result.current.executingTabIdRef.current).toBeNull();

    const view = result.current.resolvePaneState('tab-1', 'idle', null);
    expect(view).toEqual({ response: null, execStatus: 'idle', executing: false });
  });

  it('removeTabFromCache is a no-op when tab is not in cache', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());

    act(() => {
      result.current.removeTabFromCache('missing-tab');
    });

    expect(result.current.responseCache.size).toBe(0);
    expect(result.current.executingTabIdRef.current).toBeNull();
  });

  it('removeTabFromCache does not clear executing ref for a different tab', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());
    const resp = makeResponse();

    act(() => {
      result.current.markExecutionStarted('tab-1');
      result.current.cacheExecutionResult('tab-2', 'success', resp);
      result.current.removeTabFromCache('tab-2');
    });

    expect(result.current.executingTabIdRef.current).toBe('tab-1');
  });

  it('returns live error state for active executing tab', () => {
    const state = resolveTabResponsePaneState('tab-1', 'tab-1', 'error', null, new Map());
    expect(state).toEqual({ response: null, execStatus: 'error', executing: false });
  });

  it('caches apqInfo with execution result (Phase 6D)', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());
    const resp = makeResponse();
    const apqInfo: ApqInfo = { hash: 'hash1', cacheHit: true, unsupported: false };

    act(() => {
      result.current.cacheExecutionResult('tab-1', 'success', resp, apqInfo);
    });

    expect(result.current.getCachedApqInfo('tab-1')).toEqual(apqInfo);
    expect(result.current.responseCache.get('tab-1')).toEqual({
      status: 'success',
      response: resp,
      apqInfo,
    });
  });

  it('preserves prior apqInfo when cache update omits apqInfo arg', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());
    const apqInfo: ApqInfo = { hash: 'keep', cacheHit: true, unsupported: false };

    act(() => {
      result.current.cacheExecutionResult('tab-1', 'success', makeResponse(), apqInfo);
      result.current.cacheExecutionResult('tab-1', 'success', makeResponse({ data: { n: 2 } }));
    });

    expect(result.current.getCachedApqInfo('tab-1')).toEqual(apqInfo);
  });

  it('clears cached apqInfo when completion passes null (Phase 6D)', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());

    act(() => {
      result.current.cacheExecutionResult('tab-1', 'success', makeResponse(), {
        hash: 'old',
        cacheHit: true,
        unsupported: false,
      });
      result.current.cacheExecutionResult('tab-1', 'success', makeResponse(), null);
    });

    expect(result.current.getCachedApqInfo('tab-1')).toBeNull();
  });

  it('removeTabFromCache evicts cached apqInfo', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());

    act(() => {
      result.current.cacheExecutionResult('tab-1', 'success', makeResponse(), {
        hash: 'x',
        cacheHit: false,
        unsupported: false,
      });
      result.current.removeTabFromCache('tab-1');
    });

    expect(result.current.getCachedApqInfo('tab-1')).toBeUndefined();
  });

  it('blocks cache updates for evicted tabs after close (Phase 6D+6E)', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());
    const resp = makeResponse();

    act(() => {
      result.current.cacheExecutionResult('tab-1', 'success', resp, {
        hash: 'first',
        cacheHit: true,
        unsupported: false,
      });
      result.current.removeTabFromCache('tab-1');
      result.current.cacheExecutionResult('tab-1', 'success', makeResponse({ data: { late: true } }), {
        hash: 'late',
        cacheHit: false,
        unsupported: false,
      });
    });

    expect(result.current.responseCache.has('tab-1')).toBe(false);
    expect(result.current.getCachedApqInfo('tab-1')).toBeUndefined();
  });

  it('caches and clears per-tab upload progress (Phase 6D-6)', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());

    act(() => {
      result.current.setTabUploadProgress('tab-1', 0);
      result.current.setTabUploadProgress('tab-1', 42);
    });

    expect(resolveActiveTabUploadProgress('tab-1', result.current.responseCache)).toBe(42);

    act(() => {
      result.current.cacheExecutionResult('tab-1', 'success', makeResponse());
    });

    expect(resolveActiveTabUploadProgress('tab-1', result.current.responseCache)).toBeNull();
    expect(result.current.responseCache.get('tab-1')?.uploadProgress).toBeUndefined();
  });

  it('setTabUploadProgress is ignored for evicted tabs', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());

    act(() => {
      result.current.removeTabFromCache('tab-1');
      result.current.setTabUploadProgress('tab-1', 75);
    });

    expect(result.current.responseCache.has('tab-1')).toBe(false);
  });

  it('setTabUploadProgress(null) clears cached progress without leaving null sentinel', () => {
    const { result } = renderHook(() => useGqlTabResponseCache());

    act(() => {
      result.current.setTabUploadProgress('tab-1', 40);
      result.current.setTabUploadProgress('tab-1', null);
    });

    expect(result.current.responseCache.get('tab-1')?.uploadProgress).toBeUndefined();
    expect(resolveActiveTabUploadProgress('tab-1', result.current.responseCache)).toBeNull();
  });
});
