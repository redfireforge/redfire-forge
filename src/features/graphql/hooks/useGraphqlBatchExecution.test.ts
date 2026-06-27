/**
 * @vitest-environment jsdom
 *
 * Tests for useGraphqlBatchExecution hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(async () => null),
  writeKey: vi.fn(async () => {}),
}));

vi.mock('../utils/authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({})),
}));

vi.mock('../utils/envUtils', () => ({
  findUnresolvedVars: vi.fn(() => []),
  resolveVars: vi.fn((val: string) => val),
}));

import { useGraphqlBatchExecution } from './useGraphqlBatchExecution';
import { buildAuthHeaders } from '../utils/authUtils';
import { findUnresolvedVars } from '../utils/envUtils';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';

const makeTab = (id: string, query = 'query { test }', operationType = 'query'): GqlStudioTab => ({
  id,
  label: id,
  query,
  variables: '',
  headers: [],
  selectedOperation: '',
  operationType,
  connectionId: null,
  schemaStatus: 'none',
  activeEnvironmentId: null,
});

const makeAdvSettings = (overrides: Partial<AdvancedSettingsValues> = {}): AdvancedSettingsValues => ({
  apqEnabled: false,
  apqUseGet: false,
  apqUnsupportedDetected: false,
  batchEnabled: false,
  batchTimeoutMs: 30000,
  batchUnsupportedDetected: false,
  dedupEnabled: true,
  complexityBlockEnabled: false,
  complexityBlockThreshold: 1000,
  ...overrides,
});

const defaultParams = () => {
  const advSettings = makeAdvSettings();
  const advSettingsRef = { current: advSettings };
  return {
    tabs: [] as GqlStudioTab[],
    activeTabId: null as string | null,
    pageDefaultEndpoint: 'https://api.example.com/graphql',
    auth: null,
    pageDefaultAuth: null,
    activeEnvironment: null,
    pageDefaultSkipTlsVerify: false,
    advSettingsRef,
    setAdvSettings: vi.fn(),
    setBatchUnsupportedToast: vi.fn(),
    setRightView: vi.fn(),
    gqlProxyBase: '',
  };
};

describe('useGraphqlBatchExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findUnresolvedVars).mockReturnValue([]);
    vi.mocked(buildAuthHeaders).mockReturnValue({});
    global.fetch = vi.fn();
  });

  describe('initial state', () => {
    it('initializes batchResult to null', () => {
      const { result } = renderHook(() => useGraphqlBatchExecution(defaultParams()));
      expect(result.current.batchResult).toBeNull();
    });

    it('initializes batchExecuting to false', () => {
      const { result } = renderHook(() => useGraphqlBatchExecution(defaultParams()));
      expect(result.current.batchExecuting).toBe(false);
    });

    it('initializes batchResultsOpen to false', () => {
      const { result } = renderHook(() => useGraphqlBatchExecution(defaultParams()));
      expect(result.current.batchResultsOpen).toBe(false);
    });

    it('initializes complexityGatePending to false', () => {
      const { result } = renderHook(() => useGraphqlBatchExecution(defaultParams()));
      expect(result.current.complexityGatePending).toBe(false);
    });

    it('initializes batchTabOverrides to empty Map', () => {
      const { result } = renderHook(() => useGraphqlBatchExecution(defaultParams()));
      expect(result.current.batchTabOverrides.size).toBe(0);
    });

    it('initializes effectiveBatchedTabs to empty array', () => {
      const { result } = renderHook(() => useGraphqlBatchExecution(defaultParams()));
      expect(result.current.effectiveBatchedTabs).toHaveLength(0);
    });
  });

  describe('handleToggleBatch', () => {
    it('toggles a tab to checked', () => {
      const params = { ...defaultParams(), tabs: [makeTab('tab1'), makeTab('tab2')] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('tab1'); });
      expect(result.current.batchTabOverrides.get('tab1')).toBe(true);
    });

    it('toggles a tab back to unchecked', () => {
      const params = { ...defaultParams(), tabs: [makeTab('tab1'), makeTab('tab2')] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('tab1'); });
      act(() => { result.current.handleToggleBatch('tab1'); });
      expect(result.current.batchTabOverrides.get('tab1')).toBe(false);
    });

    it('can toggle multiple tabs independently', () => {
      const params = { ...defaultParams(), tabs: [makeTab('t1'), makeTab('t2'), makeTab('t3')] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      expect(result.current.batchTabOverrides.get('t1')).toBe(true);
      expect(result.current.batchTabOverrides.get('t2')).toBe(true);
      expect(result.current.batchTabOverrides.get('t3')).toBeUndefined();
    });

    it('ignores toggle on tabs outside the active batch group (§11.0 demo)', () => {
      const tabs = [
        { ...makeTab('user-1'), demoLessonId: undefined },
        { ...makeTab('demo-1'), demoLessonId: 'gql-batch-execution' },
        { ...makeTab('demo-2'), demoLessonId: 'gql-batch-execution' },
      ];
      const params = {
        ...defaultParams(),
        tabs,
        activeTabId: 'demo-1',
        activeDemoLessonId: 'gql-batch-execution',
      };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('user-1'); });
      expect(result.current.batchTabOverrides.get('user-1')).toBeUndefined();
      act(() => { result.current.handleToggleBatch('demo-1'); });
      expect(result.current.batchTabOverrides.get('demo-1')).toBe(true);
    });

    it('scopes effective batch to demo group when demo lesson is active', () => {
      const tabs = [
        { ...makeTab('user-1'), demoLessonId: undefined },
        { ...makeTab('demo-1'), demoLessonId: 'gql-batch-execution' },
        { ...makeTab('demo-2'), demoLessonId: 'gql-batch-execution' },
      ];
      const { result, rerender } = renderHook(
        (props: { activeDemoLessonId: string | null }) => useGraphqlBatchExecution({
          ...defaultParams(),
          tabs,
          activeTabId: 'user-1',
          activeDemoLessonId: props.activeDemoLessonId,
        }),
        { initialProps: { activeDemoLessonId: null as string | null } },
      );
      act(() => { result.current.handleToggleBatch('user-1'); });
      act(() => { result.current.handleToggleBatch('demo-1'); });
      act(() => { result.current.handleToggleBatch('demo-2'); });
      expect(result.current.effectiveBatchedTabs).toHaveLength(3);
      rerender({ activeDemoLessonId: 'gql-batch-execution' });
      expect(result.current.effectiveBatchedTabs).toHaveLength(2);
      expect(result.current.effectiveBatchedTabs.every((t) => t.demoLessonId === 'gql-batch-execution')).toBe(true);
    });

    it('only toggles tabs in the active endpoint group', () => {
      const tabs = [
        { ...makeTab('a1'), endpoint: 'https://a.example.com/graphql' },
        { ...makeTab('a2'), endpoint: 'https://a.example.com/graphql' },
        { ...makeTab('b1'), endpoint: 'https://b.example.com/graphql' },
      ];
      const params = { ...defaultParams(), tabs, activeTabId: 'a1' };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('b1'); });
      expect(result.current.batchTabOverrides.get('b1')).toBeUndefined();
      act(() => { result.current.handleToggleBatch('a1'); });
      expect(result.current.batchTabOverrides.get('a1')).toBe(true);
    });
  });

  describe('effectiveBatchedTabs', () => {
    it('includes only tabs that are checked and not subscriptions', () => {
      const tabs = [
        makeTab('q1', 'query { a }', 'query'),
        makeTab('s1', 'subscription { b }', 'subscription'),
        makeTab('q2', 'query { c }', 'query'),
      ];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => {
        result.current.handleToggleBatch('q1');
        result.current.handleToggleBatch('s1');
        result.current.handleToggleBatch('q2');
      });
      const effective = result.current.effectiveBatchedTabs;
      expect(effective.map((t) => t.id)).toEqual(['q1', 'q2']);
    });

    it('returns empty when no tabs checked', () => {
      const tabs = [makeTab('q1'), makeTab('q2')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      expect(result.current.effectiveBatchedTabs).toHaveLength(0);
    });
  });

  describe('batchedTabIdsSet', () => {
    it('contains ids from effectiveBatchedTabs', () => {
      const tabs = [makeTab('q1'), makeTab('q2')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('q1'); result.current.handleToggleBatch('q2'); });
      expect(result.current.batchedTabIdsSet.has('q1')).toBe(true);
      expect(result.current.batchedTabIdsSet.has('q2')).toBe(true);
    });
  });

  describe('handleSendBatch', () => {
    it('does nothing when fewer than 2 tabs are batched', async () => {
      const tab1 = makeTab('t1');
      const params = { ...defaultParams(), tabs: [tab1] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); });
      await act(async () => { result.current.handleSendBatch(); });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does nothing when endpoint is empty', async () => {
      const params = { ...defaultParams(), tabs: [makeTab('t1'), makeTab('t2')], pageDefaultEndpoint: '' };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does nothing when endpoint has unresolved vars', async () => {
      vi.mocked(findUnresolvedVars).mockReturnValue(['MY_VAR']);
      const params = { ...defaultParams(), tabs: [makeTab('t1'), makeTab('t2')], pageDefaultEndpoint: '{{MY_VAR}}' };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does nothing when a batched tab has empty query', async () => {
      const params = { ...defaultParams(), tabs: [makeTab('t1', ''), makeTab('t2')] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fires a fetch to /api/graphql/batch with correct payload', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: { a: 1 } }, { data: { b: 2 } }] }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/graphql/batch',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('opens batch results and switches to response view', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: { a: 1 } }, { data: { b: 2 } }] }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      act(() => { result.current.dismissBatchResults(); });
      expect(result.current.batchResultsOpen).toBe(false);
      act(() => { result.current.openBatchResults(); });
      expect(result.current.batchResultsOpen).toBe(true);
      expect(params.setRightView).toHaveBeenCalledWith('response');
    });

    it('openBatchResults is a no-op when batchResult is null', () => {
      const params = defaultParams();
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.openBatchResults(); });
      expect(result.current.batchResultsOpen).toBe(false);
      expect(params.setRightView).not.toHaveBeenCalled();
    });

    it('sets batchResult with successful responses', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: { a: 1 } }, { data: { b: 2 } }] }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult).not.toBeNull();
      expect(result.current.batchResult?.results).toHaveLength(2);
      expect(result.current.batchResultsOpen).toBe(true);
      expect(params.setRightView).toHaveBeenCalledWith('response');
    });

    it('syncs batch results to the response pane when callback is provided', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              data: { a: 1 },
              _httpStatus: 200,
              _httpHeaders: { 'content-type': 'application/json' },
              _latencyMs: 25,
            },
            {
              data: { b: 2 },
              _httpStatus: 200,
              _httpHeaders: { 'content-type': 'application/json' },
              _latencyMs: 31,
            },
          ],
        }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const syncBatchResultsToResponsePane = vi.fn();
      const params = { ...defaultParams(), tabs, syncBatchResultsToResponsePane };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(syncBatchResultsToResponsePane).toHaveBeenCalledTimes(1);
      expect(syncBatchResultsToResponsePane.mock.calls[0]![0]).toEqual(tabs);
      const batchResult = syncBatchResultsToResponsePane.mock.calls[0]![1];
      expect(batchResult?.results).toHaveLength(2);
      expect(batchResult?.results[0]?.response.requestMethod).toBe('POST');
      expect(batchResult?.results[0]?.response.requestBody?.query).toBe('query { a }');
      expect(batchResult?.results[0]?.response.httpHeaders['content-type']).toBe('application/json');
      expect(batchResult?.results[0]?.response.latencyMs).toBe(25);
    });

    it('persists each batch operation to history when saveHistory is provided', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: { a: 1 } }, { data: { b: 2 } }] }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const saveHistory = vi.fn().mockResolvedValue(undefined);
      const params = {
        ...defaultParams(),
        tabs,
        saveHistory,
        historyConnectionId: 'https://api.example.com/graphql',
      };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(saveHistory).toHaveBeenCalledTimes(2);
      expect(saveHistory).toHaveBeenCalledWith(expect.objectContaining({
        connectionId: 'https://api.example.com/graphql',
      }));
    });

    it('handles fetch error and sets error in batchResult', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.errors?.[0].message).toBe('Network error');
      expect(result.current.batchResult?.results[0].response.batchContext?.batchSize).toBe(2);
    });

    it('detects batch unsupported and calls setAdvSettings + setBatchUnsupportedToast', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {} }, { data: {} }], batchUnsupported: true }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(params.setAdvSettings).toHaveBeenCalledWith(expect.any(Function));
      expect(params.setBatchUnsupportedToast).toHaveBeenCalledWith(true);
    });

    it('handles 408 timeout with partial results', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        json: async () => ({ results: [{ data: { a: 1 }, _httpStatus: 200 }], batchUnsupported: false }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results).toHaveLength(2);
      expect(result.current.batchResult?.results[0].response.httpStatus).toBe(200);
      expect(result.current.batchResult?.results[1].response.httpStatus).toBe(408);
      expect(result.current.batchResult?.results[0].response.batchContext?.batchSize).toBe(2);
    });

    it('Phase 6G: cannot batch tabs from different endpoint groups', () => {
      const tabs = [
        { ...makeTab('t1'), endpoint: 'https://staging.example.com/graphql' },
        { ...makeTab('t2'), endpoint: 'https://prod.example.com/graphql' },
      ];
      const params = { ...defaultParams(), tabs, activeTabId: 't1' };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      expect(result.current.effectiveBatchedTabs).toHaveLength(1);
      expect(result.current.batchEndpointMismatch).toBe(false);
    });

    it('Phase 6A-8: batchEndpointReady is true when checked tabs share endpoint', () => {
      const shared = 'https://staging.example.com/graphql';
      const tabs = [
        { ...makeTab('t1'), endpoint: shared },
        { ...makeTab('t2'), endpoint: shared },
      ];
      const params = { ...defaultParams(), tabs, activeTabId: 't1' };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      expect(result.current.batchEndpointReady).toBe(true);
    });

    it('Phase 6G: batchEndpointReady is false when fewer than two tabs checked in active group', () => {
      const tabs = [
        { ...makeTab('t1'), endpoint: 'https://staging.example.com/graphql' },
        { ...makeTab('t2'), endpoint: 'https://prod.example.com/graphql' },
      ];
      const params = { ...defaultParams(), tabs, activeTabId: 't1' };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); });
      expect(result.current.batchEndpointReady).toBe(false);
      expect(result.current.batchEndpointMismatch).toBe(false);
    });

    it('Phase 6A-8: does not send batch when checked tabs span different endpoints', async () => {
      const tabs = [
        { ...makeTab('t1'), endpoint: 'https://staging.example.com/graphql' },
        { ...makeTab('t2'), endpoint: 'https://prod.example.com/graphql' },
      ];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Phase 6A-8: uses common batched-tab endpoint, not page default when tabs override', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: { a: 1 } }, { data: { b: 2 } }] }),
      });
      const shared = 'https://staging.example.com/graphql';
      const tabs = [
        { ...makeTab('t1', 'query { a }'), endpoint: shared },
        { ...makeTab('t2', 'query { b }'), endpoint: shared },
      ];
      const params = {
        ...defaultParams(),
        tabs,
        pageDefaultEndpoint: 'https://prod.example.com/graphql',
      };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      const body = JSON.parse(vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string) as { endpoint: string };
      expect(body.endpoint).toBe(shared);
    });

    it('sends headers from individual batched tabs', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {} }, { data: {} }], batchUnsupported: false }),
      });
      const tabs = [
        { ...makeTab('t1', 'query { a }'), headers: [{ enabled: true, key: 'X-Custom', value: 'v1' }] },
        makeTab('t2', 'query { b }'),
      ];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse(vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string) as { operations: Array<{ headers?: Record<string, string> }> };
      expect(body.operations[0].headers?.['X-Custom']).toBe('v1');
    });

    it('includes variables when tab has valid JSON variables', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {} }, { data: {} }], batchUnsupported: false }),
      });
      const tabs = [
        { ...makeTab('t1', 'query { a }'), variables: '{"key":"value"}' },
        makeTab('t2', 'query { b }'),
      ];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      const body = JSON.parse(vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string) as { operations: Array<{ variables?: Record<string, unknown> }> };
      expect(body.operations[0].variables).toEqual({ key: 'value' });
    });

    it('writes batch detection to batched endpoint URL (Phase 6A-8)', async () => {
      const { readKey: mockReadKey, writeKey: mockWriteKey } = await import('../../../shared/utils/storage');
      vi.mocked(mockReadKey).mockResolvedValue(null);
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {} }, { data: {} }], batchUnsupported: true }),
      });
      const shared = 'https://staging.example.com/graphql';
      const tabs = [
        { ...makeTab('t1', 'query { a }'), endpoint: shared },
        { ...makeTab('t2', 'query { b }'), endpoint: shared },
      ];
      const params = { ...defaultParams(), tabs, pageDefaultEndpoint: 'https://prod.example.com/graphql' };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      const detectionCalls = vi.mocked(mockWriteKey).mock.calls.filter(
        (c) => c[0] === `gql_conn_detection_${shared}`,
      );
      expect(detectionCalls.length).toBeGreaterThan(0);
    });
  });

  describe('complexityGatePending', () => {
    it('can be set to true and false', () => {
      const { result } = renderHook(() => useGraphqlBatchExecution(defaultParams()));
      act(() => { result.current.setComplexityGatePending(true); });
      expect(result.current.complexityGatePending).toBe(true);
      act(() => { result.current.setComplexityGatePending(false); });
      expect(result.current.complexityGatePending).toBe(false);
    });
  });

  describe('setBatchResult', () => {
    it('can directly set batchResult', () => {
      const { result } = renderHook(() => useGraphqlBatchExecution(defaultParams()));
      act(() => {
        result.current.setBatchResult({
          batchUnsupported: false,
          results: [{ index: 0, response: { data: null, httpStatus: 200, httpHeaders: {}, latencyMs: 0, timestamp: 0 } }],
        });
      });
      expect(result.current.batchResult).not.toBeNull();
    });

    it('uses tab label as operationName when selectedOperation is undefined (??label branch)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {} }, { data: {} }] }),
      });
      // selectedOperation: undefined causes the ?? to fall back to label
      const t1 = { ...makeTab('tab-label-a', 'query { a }'), selectedOperation: undefined as unknown as string, label: 'LabelA' };
      const t2 = { ...makeTab('tab-label-b', 'query { b }'), selectedOperation: undefined as unknown as string, label: 'LabelB' };
      const params = { ...defaultParams(), tabs: [t1, t2] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('tab-label-a'); result.current.handleToggleBatch('tab-label-b'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].operationName).toBe('LabelA');
    });

    it('uses null for data when response has no data field (??null branch)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ errors: [{ message: 'err' }] }, { data: {} }] }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.data).toBeNull();
    });

    it('uses default httpStatus 200 when _httpStatus is missing (typeof branch)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {} }, { data: {} }] }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.httpStatus).toBe(200);
    });

    it('handles 408 timeout: tab without partial result uses label as operationName (??label in timeout handler)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        json: async () => ({ results: [], batchUnsupported: false }),
      });
      const t1 = { ...makeTab('t-408-a', 'query { a }'), selectedOperation: undefined as unknown as string, label: 'TabA' };
      const t2 = { ...makeTab('t-408-b', 'query { b }'), selectedOperation: undefined as unknown as string, label: 'TabB' };
      const params = { ...defaultParams(), tabs: [t1, t2] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t-408-a'); result.current.handleToggleBatch('t-408-b'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].operationName).toBe('TabA');
      expect(result.current.batchResult?.results[0].response.httpStatus).toBe(408);
    });

    it('handles 408 timeout: finite batchTimeoutMs formats label correctly (<1000ms branch)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        json: async () => ({ results: [], batchUnsupported: false }),
      });
      const params = defaultParams();
      (params.advSettingsRef as { current: typeof params.advSettingsRef.current }).current = {
        ...params.advSettingsRef.current,
        batchTimeoutMs: 500, // < 1000ms — uses 'ms' suffix
      };
      const t1 = makeTab('t-408-ms-1', 'query { a }');
      const t2 = makeTab('t-408-ms-2', 'query { b }');
      params.tabs = [t1, t2];
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t-408-ms-1'); result.current.handleToggleBatch('t-408-ms-2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.errors?.[0].message).toMatch(/500ms/);
    });

    it('partial 408 result with missing data covers (partial.data??null) null branch (line 177)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        // data is deliberately absent — covers the ?? null branch
        json: async () => ({ results: [{ _httpStatus: 200 }] }),
      });
      const tabs = [makeTab('t-data-null-1', 'query { a }'), makeTab('t-data-null-2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t-data-null-1'); result.current.handleToggleBatch('t-data-null-2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.data).toBeNull();
    });

    it('partial 408 result with non-number _httpStatus covers typeof branch false path (line 179)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        // _httpStatus is a string — typeof is not 'number', so defaults to 200
        json: async () => ({ results: [{ data: { x: 1 }, _httpStatus: 'ok' as unknown as number }] }),
      });
      const tabs = [makeTab('t-http-str-1', 'query { a }'), makeTab('t-http-str-2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t-http-str-1'); result.current.handleToggleBatch('t-http-str-2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.httpStatus).toBe(200);
    });

    it('408 timeout fallback uses non-null selectedOperation in operationName (??label false branch, line 206)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        // No partial results — all tabs go to timeout fallback
        json: async () => ({ results: [], batchUnsupported: false }),
      });
      // selectedOperation is non-empty → ?? does NOT fall back to label
      const t1 = { ...makeTab('t-sel-op-1', 'query { a }'), selectedOperation: 'GetFoo', label: 'L1' };
      const t2 = { ...makeTab('t-sel-op-2', 'query { b }'), selectedOperation: 'GetBar', label: 'L2' };
      const params = { ...defaultParams(), tabs: [t1, t2] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t-sel-op-1'); result.current.handleToggleBatch('t-sel-op-2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].operationName).toBe('GetFoo');
    });

    it('partial 408 result with errors array covers Array.isArray(partial.errors) true branch', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        // partial result for tab 0 has errors array AND _httpStatus: 200
        json: async () => ({ results: [{ data: { a: 1 }, _httpStatus: 200, errors: [{ message: 'partial error' }] }] }),
      });
      const tabs = [makeTab('t-408-err-1', 'query { a }'), makeTab('t-408-err-2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t-408-err-1'); result.current.handleToggleBatch('t-408-err-2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      // Tab 0 has a partial result with errors array
      expect(result.current.batchResult?.results[0].response.errors).toHaveLength(1);
    });

    it('success result with explicit _httpStatus number covers typeof r._httpStatus === number branch', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {}, _httpStatus: 201 }, { data: {}, _httpStatus: 422 }] }),
      });
      const tabs = [makeTab('t-status-1', 'query { a }'), makeTab('t-status-2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t-status-1'); result.current.handleToggleBatch('t-status-2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.httpStatus).toBe(201);
      expect(result.current.batchResult?.results[1].response.httpStatus).toBe(422);
    });

    it('readKey returns existing data to merge when detecting batch unsupported (raw ?? {} branch)', async () => {
      const { readKey: mockReadKey, writeKey: mockWriteKey } = await import('../../../shared/utils/storage');
      // Return existing detection data so the "raw ? JSON.parse(raw) : {}" branch takes the truthy path
      vi.mocked(mockReadKey).mockResolvedValue(JSON.stringify({ apq: true }));
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {} }, { data: {} }], batchUnsupported: true }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 300)); });
      const detectCalls = vi.mocked(mockWriteKey).mock.calls.filter(
        (c) => c[0] === 'gql_conn_detection_https://api.example.com/graphql',
      );
      expect(detectCalls.length).toBeGreaterThan(0);
      const written = JSON.parse(detectCalls[0][1] as string) as { apq?: boolean; batch?: boolean };
      expect(written.apq).toBe(true);
      expect(written.batch).toBe(true);
    });

    it('handles malformed JSON variables gracefully (catch branch returns undefined — line 134)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: { a: 1 } }, { data: { b: 2 } }] }),
      });
      // One tab has invalid JSON variables — the catch block converts it to undefined
      const badVarsTab = { ...makeTab('t1', 'query { a }'), variables: '{bad json}' };
      const goodTab = makeTab('t2', 'query { b }');
      const params = { ...defaultParams(), tabs: [badVarsTab, goodTab] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      // Should still send batch (malformed vars treated as undefined, not a fatal error)
      expect(global.fetch).toHaveBeenCalled();
      expect(result.current.batchResult).not.toBeNull();
    });

    it('formats sub-second batch timeout label in ms (line 164 ms branch)', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        json: async () => ({ results: [] }),
      });
      const tabs = [makeTab('t-ms-1', 'query { a }'), makeTab('t-ms-2', 'query { b }')];
      const params = {
        ...defaultParams(),
        tabs,
        advSettingsRef: { current: makeAdvSettings({ batchTimeoutMs: 500 }) },
      };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t-ms-1'); result.current.handleToggleBatch('t-ms-2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.errors?.[0].message).toContain('500ms');
    });

    it('swallows writeKey failure when persisting batch unsupported detection', async () => {
      const { readKey: mockReadKey, writeKey: mockWriteKey } = await import('../../../shared/utils/storage');
      vi.mocked(mockReadKey).mockResolvedValue(JSON.stringify({ apq: false }));
      vi.mocked(mockWriteKey).mockRejectedValue(new Error('disk full'));
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: {} }, { data: {} }], batchUnsupported: true }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      params.advSettingsRef.current = makeAdvSettings({ batchUnsupportedDetected: false });
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 100)); });
      expect(result.current.batchResult).not.toBeNull();
    });

    it('uses generic error message when fetch rejects with a non-Error value', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue('network down');
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.results[0].response.errors?.[0].message).toBe('Batch request failed');
    });

    it('408 timeout preserves batchUnsupported flag from response body', async () => {
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 408,
        json: async () => ({ results: [], batchUnsupported: true }),
      });
      const tabs = [makeTab('t1', 'query { a }'), makeTab('t2', 'query { b }')];
      const params = { ...defaultParams(), tabs };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });
      expect(result.current.batchResult?.batchUnsupported).toBe(true);
    });

    it('Phase 6F Slice 3: batch operation headers use each tab profile auth', async () => {
      vi.mocked(buildAuthHeaders).mockImplementation((auth) => {
        if (auth?.type === 'bearer' && auth.token === 'staging') return { Authorization: 'Bearer staging' };
        if (auth?.type === 'bearer' && auth.token === 'prod') return { Authorization: 'Bearer prod' };
        return {};
      });
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: { a: 1 } }, { data: { b: 2 } }] }),
      });
      const shared = 'https://shared.example.com/graphql';
      const profiles = [
        {
          id: 'prof-staging',
          name: 'Staging',
          endpoint: shared,
          auth: { type: 'bearer' as const, token: 'staging' },
          createdAt: 1,
        },
        {
          id: 'prof-prod',
          name: 'Prod',
          endpoint: shared,
          auth: { type: 'bearer' as const, token: 'prod' },
          createdAt: 1,
        },
      ];
      const tabs = [
        { ...makeTab('t1', 'query { a }'), connectionId: 'prof-staging', endpoint: shared },
        { ...makeTab('t2', 'query { b }'), connectionId: 'prof-prod', endpoint: shared },
      ];
      const params = {
        ...defaultParams(),
        tabs,
        profiles,
        pageDefaultAuth: { type: 'bearer' as const, token: 'page-should-not-be-used' },
      };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(String(fetchCall?.[1]?.body)) as {
        operations: Array<{ headers: Record<string, string> }>;
      };
      expect(body.operations[0]?.headers.Authorization).toBe('Bearer staging');
      expect(body.operations[1]?.headers.Authorization).toBe('Bearer prod');
    });

    it('Phase 6H: tab.auth override beats profile auth in batch operation headers', async () => {
      vi.mocked(buildAuthHeaders).mockImplementation((auth) => {
        if (auth?.type === 'bearer' && auth.token === 'tab-override') {
          return { Authorization: 'Bearer tab-override' };
        }
        if (auth?.type === 'bearer' && auth.token === 'prod') return { Authorization: 'Bearer prod' };
        return {};
      });
      vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ data: { a: 1 } }, { data: { b: 2 } }] }),
      });
      const shared = 'https://shared.example.com/graphql';
      const profiles = [
        {
          id: 'prof-staging',
          name: 'Staging',
          endpoint: shared,
          auth: { type: 'bearer' as const, token: 'staging' },
          createdAt: 1,
        },
        {
          id: 'prof-prod',
          name: 'Prod',
          endpoint: shared,
          auth: { type: 'bearer' as const, token: 'prod' },
          createdAt: 1,
        },
      ];
      const tabs = [
        {
          ...makeTab('t1', 'query { a }'),
          connectionId: 'prof-staging',
          endpoint: shared,
          auth: { type: 'bearer' as const, token: 'tab-override' },
        },
        { ...makeTab('t2', 'query { b }'), connectionId: 'prof-prod', endpoint: shared },
      ];
      const params = {
        ...defaultParams(),
        tabs,
        profiles,
        pageDefaultAuth: { type: 'bearer' as const, token: 'page-should-not-be-used' },
      };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); await new Promise((r) => setTimeout(r, 50)); });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(String(fetchCall?.[1]?.body)) as {
        operations: Array<{ headers: Record<string, string> }>;
      };
      expect(body.operations[0]?.headers.Authorization).toBe('Bearer tab-override');
      expect(body.operations[1]?.headers.Authorization).toBe('Bearer prod');
    });

    it('Phase 6F: batchProfileLinkPending when checked tab has unresolved profile link', () => {
      const shared = 'https://shared.example.com/graphql';
      const tabs = [
        { ...makeTab('t1', 'query { a }'), connectionId: 'prof-staging', endpoint: shared },
        { ...makeTab('t2', 'query { b }'), endpoint: shared },
      ];
      const params = { ...defaultParams(), tabs, profiles: [] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      expect(result.current.batchProfileLinkPending).toBe(true);
      expect(result.current.batchEndpointReady).toBe(false);
    });

    it('Phase 6F: does not send batch when checked tab has pending profile link', async () => {
      const shared = 'https://shared.example.com/graphql';
      const tabs = [
        { ...makeTab('t1', 'query { a }'), connectionId: 'prof-staging', endpoint: shared },
        { ...makeTab('t2', 'query { b }'), endpoint: shared },
      ];
      const params = { ...defaultParams(), tabs, profiles: [] };
      const { result } = renderHook(() => useGraphqlBatchExecution(params));
      act(() => { result.current.handleToggleBatch('t1'); result.current.handleToggleBatch('t2'); });
      await act(async () => { result.current.handleSendBatch(); });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
