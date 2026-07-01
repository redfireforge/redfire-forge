/**
 * Phase 8F — row trace key tests.
 */
import { describe, expect, it } from 'vitest';
import {
  buildGrpcHarnessRowTraceKey,
  buildGrpcHarnessResultTraceKey,
  parseGrpcHarnessRowTraceKey,
  GRPC_HARNESS_ROW_TRACE_SEP,
} from './grpcHarnessRowIdentity';

describe('grpcHarnessRowIdentity (Phase 8F)', () => {
  it('builds stable composite trace keys', () => {
    expect(buildGrpcHarnessRowTraceKey('sc-grpc-1', 'row-abc')).toBe('sc-grpc-1::row-abc');
    expect(GRPC_HARNESS_ROW_TRACE_SEP).toBe('::');
  });

  it('parses composite trace keys', () => {
    expect(parseGrpcHarnessRowTraceKey('sc-grpc-1::row-abc')).toEqual({
      scenarioId: 'sc-grpc-1',
      dataRowId: 'row-abc',
    });
  });

  it('returns base scenario id when no row suffix is present', () => {
    expect(parseGrpcHarnessRowTraceKey('sc-grpc-1')).toEqual({
      scenarioId: 'sc-grpc-1',
      dataRowId: undefined,
    });
  });

  it('round-trips composite keys built from scenario + row ids', () => {
    const traceKey = buildGrpcHarnessRowTraceKey('sc-grpc-1', 'row-abc');
    expect(parseGrpcHarnessRowTraceKey(traceKey)).toEqual({
      scenarioId: 'sc-grpc-1',
      dataRowId: 'row-abc',
    });
  });

  it('builds result trace keys for rerun merge (row-less uses empty suffix)', () => {
    expect(buildGrpcHarnessResultTraceKey('sc-1', 'row-0')).toBe('sc-1::row-0');
    expect(buildGrpcHarnessResultTraceKey('sc-1')).toBe('sc-1::');
    expect(buildGrpcHarnessResultTraceKey('sc-1', undefined)).toBe('sc-1::');
  });

  it('parses row-less result trace keys without an empty-string dataRowId', () => {
    expect(parseGrpcHarnessRowTraceKey(buildGrpcHarnessResultTraceKey('sc-1'))).toEqual({
      scenarioId: 'sc-1',
      dataRowId: undefined,
    });
  });
});
