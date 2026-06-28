import { describe, it, expect } from 'vitest';
import {
  buildBatchNetworkErrorResponse,
  buildBatchOperationResponse,
  buildBatchResponseContext,
  buildBatchTimeoutOperationResponse,
  buildBatchWireRequestBody,
  mapProxyResultsToGraphqlBatchResult,
} from './buildBatchOperationResponse';
import type { GqlStudioTab } from './tabPersistence';

const tab: GqlStudioTab = {
  id: 't1',
  label: 'Tab',
  modelUri: 'inmemory://graphql/t1',
  query: 'query Q { x }',
  variables: '{}',
  headers: [],
  operationType: 'query',
  unsavedChanges: false,
};

const stampCtx = {
  profiles: [],
  pageDefaults: {
    endpoint: 'http://localhost/graphql',
    auth: null,
    skipTlsVerify: false,
    pollingEnabled: false,
    pollingIntervalSeconds: 30,
  },
  globalAuthProfiles: [],
};

describe('buildBatchOperationResponse — coverage gaps', () => {
  it('buildBatchWireRequestBody omits empty operationName', () => {
    expect(buildBatchWireRequestBody([{ query: 'q', headers: {}, operationName: '  ' }])).toEqual([
      { query: 'q' },
    ]);
    expect(buildBatchWireRequestBody([{ query: 'q', variables: { a: 1 }, headers: {} }])).toEqual([
      { query: 'q', variables: { a: 1 } },
    ]);
  });

  it('buildBatchResponseContext uses per-op latency when batchUnsupported', () => {
    const ctx = buildBatchResponseContext(1, true, [{ query: 'a', headers: {} }, { query: 'b', headers: {} }], [
      { _latencyMs: 10 },
      { _latencyMs: 20 },
    ]);
    expect(ctx.batchLatencyMs).toBe(20);
    expect(ctx.upstreamRequestCount).toBe(2);
  });

  it('buildBatchResponseContext uses first latency when batch supported', () => {
    const ctx = buildBatchResponseContext(0, false, [{ query: 'a', headers: {} }], [
      { _latencyMs: 99 },
      { _latencyMs: 1 },
    ]);
    expect(ctx.batchLatencyMs).toBe(99);
    expect(ctx.upstreamRequestCount).toBe(1);
  });

  it('buildBatchOperationResponse handles missing wire headers and invalid latency', () => {
    const response = buildBatchOperationResponse(
      { data: { ok: true }, _httpHeaders: { 'X-Custom': 123 as unknown as string } },
      { query: tab.query, headers: {} },
      tab,
      stampCtx,
    );
    expect(response.httpHeaders).toEqual({});
    expect(response.latencyMs).toBe(0);
  });

  it('buildBatchNetworkErrorResponse and timeout response include context', () => {
    buildBatchResponseContext(0, false, [{ query: 'q', headers: {} }], []);
    const net = buildBatchNetworkErrorResponse({ query: 'q', headers: {} }, tab, stampCtx, 'fail');
    expect(net.errors?.[0]?.message).toContain('fail');
    const timeout = buildBatchTimeoutOperationResponse({ query: 'q', headers: {} }, tab, stampCtx, 'Request timed out');
    expect(timeout.errors?.[0]?.message).toContain('timed out');
  });

  it('mapProxyResultsToGraphqlBatchResult maps mixed success and error rows', () => {
    const batch = mapProxyResultsToGraphqlBatchResult(
      [tab, tab],
      [{ query: 'q1', headers: {} }, { query: 'q2', headers: {} }],
      [{ data: { a: 1 }, _httpStatus: 200 }, { errors: [{ message: 'bad' }], _httpStatus: 400 }],
      false,
      stampCtx,
    );
    expect(batch.results).toHaveLength(2);
    expect(batch.results[1].response.errors?.length).toBeGreaterThan(0);
  });
});
