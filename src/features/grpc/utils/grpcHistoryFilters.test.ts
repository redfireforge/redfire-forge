/**
 * Phase 5D — history filter tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist } from '../../../shared/grpc/grpcPersistenceSchema';
import {
  collectGrpcCallHistoryFilterOptions,
  filterGrpcCallHistoryEntries,
} from './grpcHistoryFilters';

const TS = '2026-06-29T12:00:00.000Z';

function makeEntry(
  id: string,
  overrides: Partial<{
    service: string;
    method: string;
    target: string;
    capturedAt: string;
    grpcStatus: number;
    callType: 'unary' | 'server_stream';
  }> = {},
) {
  const entry = prepareGrpcCallHistoryEntryForPersist({
    id,
    snapshot: {
      tabId: 'tab-1',
      requestId: `req-${id}`,
      capturedAt: overrides.capturedAt ?? TS,
      callType: overrides.callType ?? 'unary',
      target: {
        ...FIXTURE_UNARY_CALL_REQUEST.target,
        address: overrides.target ?? 'localhost:50051',
      },
      service: overrides.service ?? FIXTURE_UNARY_CALL_REQUEST.service,
      method: overrides.method ?? FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    },
    error: overrides.grpcStatus !== undefined
      ? {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'fail',
        details: { grpcStatus: overrides.grpcStatus },
      }
      : undefined,
  });
  return entry;
}

describe('grpcHistoryFilters (Phase 5D)', () => {
  const entries = [
    makeEntry('h-1', { service: 'alpha.Service', method: 'One', capturedAt: '2026-06-28T10:00:00.000Z', grpcStatus: 0 }),
    makeEntry('h-2', { service: 'beta.Service', method: 'Two', capturedAt: '2026-06-29T10:00:00.000Z', grpcStatus: 7 }),
    makeEntry('h-3', {
      service: 'alpha.Service',
      method: 'Two',
      target: 'legacy-host:50051',
      capturedAt: '2026-06-30T10:00:00.000Z',
      callType: 'server_stream',
    }),
  ];

  it('filters by service, method, status, call type, and date range', () => {
    expect(filterGrpcCallHistoryEntries(entries, { service: 'alpha.Service' }).map((e) => e.id))
      .toEqual(['h-1', 'h-3']);
    expect(filterGrpcCallHistoryEntries(entries, { method: 'Two' }).map((e) => e.id))
      .toEqual(['h-2', 'h-3']);
    expect(filterGrpcCallHistoryEntries(entries, { grpcStatus: 7 }).map((e) => e.id)).toEqual(['h-2']);
    expect(filterGrpcCallHistoryEntries(entries, { callType: 'server_stream' }).map((e) => e.id)).toEqual(['h-3']);
    expect(filterGrpcCallHistoryEntries(entries, {
      capturedAfter: '2026-06-29T00:00:00.000Z',
      capturedBefore: '2026-06-30T00:00:00.000Z',
    }).map((e) => e.id)).toEqual(['h-2']);
  });

  it('filters by text against target/service/method', () => {
    expect(filterGrpcCallHistoryEntries(entries, { text: 'legacy-host' }).map((e) => e.id)).toEqual(['h-3']);
  });

  it('filters by outcome (OK vs errors) matching mockup 05 status filter', () => {
    const okEntry = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-ok',
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-ok',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
      result: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        durationMs: 12,
      },
    });
    const errEntry = makeEntry('h-err', { grpcStatus: 5 });

    expect(filterGrpcCallHistoryEntries([okEntry, errEntry], { outcome: 'ok' }).map((e) => e.id))
      .toEqual(['h-ok']);
    expect(filterGrpcCallHistoryEntries([okEntry, errEntry], { outcome: 'error' }).map((e) => e.id))
      .toEqual(['h-err']);
  });

  it('collects distinct filter options', () => {
    const options = collectGrpcCallHistoryFilterOptions(entries);
    expect(options.services).toEqual(['alpha.Service', 'beta.Service']);
    expect(options.methods).toEqual(['One', 'Two']);
    expect(options.grpcStatuses).toEqual([0, 7]);
    expect(options.hasErrorEntries).toBe(true);
  });
});
