import { describe, expect, it } from 'vitest';
import type { GraphqlBatchResponseContext, GraphqlBatchResult, GraphqlResponse } from '../../../shared/types/graphql';
import {
  batchLatencyStatusLabel,
  batchOperationSlotLabel,
  batchResponseExplainer,
  batchResultTransportSummary,
  batchStatusPillLabel,
  batchTransportSummary,
  batchTransportSummaryForResponse,
} from './batchResponseContextUtils';

function makeCtx(overrides: Partial<GraphqlBatchResponseContext> = {}): GraphqlBatchResponseContext {
  return {
    batchIndex: 0,
    batchSize: 2,
    batchUnsupported: false,
    upstreamRequestCount: 1,
    batchLatencyMs: 30,
    wireRequestBody: [{ query: '{ a }' }, { query: '{ b }' }],
    ...overrides,
  };
}

describe('batchResponseContextUtils', () => {
  it('formats singular sequential fallback transport summary', () => {
    const ctx = makeCtx({ batchUnsupported: true, upstreamRequestCount: 1 });
    expect(batchTransportSummary(ctx)).toContain('1 upstream HTTP POST · sequential fallback');
  });

  it('formats operation slot and pill labels', () => {
    const ctx = makeCtx({ batchIndex: 1 });
    expect(batchOperationSlotLabel(ctx)).toBe('Operation 2 of 2');
    expect(batchStatusPillLabel(ctx)).toBe('Batch 2/2');
  });

  it('summarizes array batch transport', () => {
    expect(batchTransportSummary(makeCtx())).toContain('JSON array batch');
    expect(batchTransportSummary(makeCtx())).toContain('30 ms total');
  });

  it('summarizes sequential fallback transport', () => {
    const ctx = makeCtx({ batchUnsupported: true, upstreamRequestCount: 2, wireRequestBody: undefined });
    expect(batchTransportSummary(ctx)).toContain('2 upstream HTTP POSTs');
    expect(batchTransportSummary(ctx)).toContain('sequential fallback');
  });

  it('labels batch latency for array and sequential modes', () => {
    expect(batchLatencyStatusLabel(makeCtx(), 30)).toBe('30 ms batch');
    expect(batchLatencyStatusLabel(makeCtx({ batchIndex: 1 }), 12)).toBe('12 ms · batch 30 ms');
    expect(batchLatencyStatusLabel(makeCtx({ batchUnsupported: true, batchIndex: 1 }), 4)).toBe('4 ms · op 2');
  });

  it('explains batch slice context', () => {
    expect(batchResponseExplainer(makeCtx())).toContain('JSON-array POST');
    expect(batchResponseExplainer(makeCtx({ batchUnsupported: true }))).toContain('own POST');
  });

  it('detects proxy failure in response-aware transport summary', () => {
    const ctx = makeCtx();
    const okResponse: GraphqlResponse = {
      data: null,
      httpStatus: 200,
      httpHeaders: {},
      latencyMs: 30,
      timestamp: 1,
    };
    const failedResponse: GraphqlResponse = {
      ...okResponse,
      httpStatus: 0,
    };
    expect(batchTransportSummaryForResponse(ctx, okResponse)).toContain('JSON array batch');
    expect(batchTransportSummaryForResponse(ctx, failedResponse)).toContain('before reaching GraphQL server');
  });

  it('derives modal transport summary from batch result', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [{
        index: 0,
        response: { data: null, httpStatus: 200, httpHeaders: {}, latencyMs: 30, timestamp: 1, batchContext: makeCtx() },
      }],
    };
    expect(batchResultTransportSummary(result)).toContain('JSON array batch');

    const fallback: GraphqlBatchResult = {
      batchUnsupported: true,
      results: [{
        index: 0,
        response: { data: null, httpStatus: 200, httpHeaders: {}, latencyMs: 4, timestamp: 1 },
      }, {
        index: 1,
        response: { data: null, httpStatus: 200, httpHeaders: {}, latencyMs: 6, timestamp: 1 },
      }],
    };
    expect(batchResultTransportSummary(fallback)).toContain('2 upstream HTTP POSTs');
  });

  it('returns null modal transport summary for empty non-fallback results', () => {
    const result: GraphqlBatchResult = {
      batchUnsupported: false,
      results: [],
    };
    expect(batchResultTransportSummary(result)).toBeNull();
  });

  it('derives singular fallback modal transport summary without batch context', () => {
    const fallback: GraphqlBatchResult = {
      batchUnsupported: true,
      results: [{
        index: 0,
        response: { data: null, httpStatus: 200, httpHeaders: {}, latencyMs: 4, timestamp: 1 },
      }],
    };
    expect(batchResultTransportSummary(fallback)).toContain('1 upstream HTTP POST · sequential fallback');
  });
});
