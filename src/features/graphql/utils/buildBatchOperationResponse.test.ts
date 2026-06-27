import { describe, it, expect } from 'vitest';
import type { GraphqlError } from '../../../shared/types/graphql';
import {
  buildBatchNetworkErrorResponse,
  buildBatchOperationResponse,
  mapProxyResultsToGraphqlBatchResult,
  stampBatchContextOnBatchResult,
} from './buildBatchOperationResponse';
import type { GqlStudioTab } from './tabPersistence';

const makeTab = (id: string): GqlStudioTab => ({
  id,
  label: id,
  query: 'query CheckHealth { health }',
  variables: '',
  headers: [],
  selectedOperation: 'CheckHealth',
  operationType: 'query',
  connectionId: null,
  schemaStatus: 'none',
  activeEnvironmentId: null,
});

const stampCtx = {
  profiles: [],
  pageDefaults: { endpoint: 'https://api.example.com/graphql', auth: null, skipTlsVerify: false, pollingEnabled: false, pollingIntervalSeconds: 30 },
  globalAuthProfiles: [],
};

describe('buildBatchOperationResponse', () => {
  it('stamps request body, headers, latency, and response headers like single Execute', () => {
    const tab = makeTab('tab-1');
    const op = {
      query: tab.query,
      operationName: 'CheckHealth',
      headers: { Authorization: 'Bearer demo-token' },
    };
    const raw = {
      data: { health: 'ok' },
      _httpStatus: 200,
      _httpHeaders: { 'content-type': 'application/json; charset=utf-8' },
      _latencyMs: 42,
    };

    const response = buildBatchOperationResponse(raw, op, tab, stampCtx);

    expect(response.data).toEqual({ health: 'ok' });
    expect(response.httpStatus).toBe(200);
    expect(response.httpHeaders['content-type']).toBe('application/json; charset=utf-8');
    expect(response.latencyMs).toBe(42);
    expect(response.requestMethod).toBe('POST');
    expect(response.requestBody).toEqual({
      query: tab.query,
      operationName: 'CheckHealth',
    });
    expect(response.requestHeaders?.['Content-Type']).toBe('application/json');
    expect(response.requestHeaders?.Authorization).toBe('Bearer demo-token');
    expect(response.authSentSource).toBe('page');
  });

  it('preserves GraphQL errors and extensions from the proxy payload', () => {
    const tab = makeTab('tab-2');
    const errors: GraphqlError[] = [{ message: 'field missing' }];
    const response = buildBatchOperationResponse(
      {
        data: null,
        errors,
        extensions: { traceId: 'abc' },
        _httpStatus: 200,
        _latencyMs: 12,
      },
      { query: tab.query, headers: {} },
      tab,
      stampCtx,
    );

    expect(response.errors).toEqual(errors);
    expect(response.extensions).toEqual({ traceId: 'abc' });
  });
});

describe('mapProxyResultsToGraphqlBatchResult', () => {
  it('maps each proxy slot to a stamped GraphqlBatchResult entry', () => {
    const tabs = [makeTab('a'), makeTab('b')];
    const ops = [
      { query: tabs[0]!.query, headers: {} },
      { query: tabs[1]!.query, headers: { Authorization: 'Bearer x' } },
    ];
    const batch = mapProxyResultsToGraphqlBatchResult(
      tabs,
      ops,
      [
        { data: { health: 'ok' }, _httpStatus: 200, _latencyMs: 5 },
        { data: { health: 'ok' }, _httpStatus: 200, _latencyMs: 7 },
      ],
      false,
      stampCtx,
    );

    expect(batch.results).toHaveLength(2);
    expect(batch.results[0]?.response.latencyMs).toBe(5);
    expect(batch.results[0]?.response.batchContext).toMatchObject({
      batchIndex: 0,
      batchSize: 2,
      batchUnsupported: false,
      upstreamRequestCount: 1,
    });
    expect(batch.results[0]?.response.batchContext?.wireRequestBody).toHaveLength(2);
    expect(batch.results[1]?.response.requestHeaders?.Authorization).toBe('Bearer x');
    expect(batch.results[1]?.response.batchContext?.batchIndex).toBe(1);
  });
});

describe('stampBatchContextOnBatchResult', () => {
  it('stamps batchContext on network-error batch results', () => {
    const tabs = [makeTab('a'), makeTab('b')];
    const ops = [
      { query: tabs[0]!.query, headers: {} },
      { query: tabs[1]!.query, headers: {} },
    ];
    const base = {
      batchUnsupported: false,
      results: tabs.map((tab, index) => ({
        index,
        operationName: tab.label,
        response: buildBatchNetworkErrorResponse(ops[index]!, tab, stampCtx, 'Network error'),
      })),
    };
    const stamped = stampBatchContextOnBatchResult(base, ops, []);
    expect(stamped.results[0]?.response.batchContext?.batchSize).toBe(2);
    expect(stamped.results[1]?.response.batchContext?.batchIndex).toBe(1);
  });
});

describe('buildBatchNetworkErrorResponse', () => {
  it('stamps request metadata even when the batch fetch fails', () => {
    const tab = makeTab('tab-3');
    const response = buildBatchNetworkErrorResponse(
      { query: tab.query, headers: {} },
      tab,
      stampCtx,
      'Batch request failed',
    );

    expect(response.httpStatus).toBe(0);
    expect(response.errors?.[0]?.message).toBe('Batch request failed');
    expect(response.requestBody?.query).toBe(tab.query);
    expect(response.requestMethod).toBe('POST');
  });
});
