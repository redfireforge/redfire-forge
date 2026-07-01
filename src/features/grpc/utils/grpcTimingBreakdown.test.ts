import { describe, expect, it } from 'vitest';
import {
  buildGrpcTimingBreakdownRows,
  formatGrpcTimingDurationLabel,
  grpcTimingBarWidthPercent,
  resolveGrpcTimingBarDenominatorMs,
} from './grpcTimingBreakdown';

describe('grpcTimingBreakdown', () => {
  it('builds six timing rows from explicit breakdown', () => {
    const rows = buildGrpcTimingBreakdownRows({
      dnsLookupMs: 2,
      tcpConnectTlsMs: 10,
      http2HandshakeMs: 8,
      protoSerializationMs: 1,
      serverProcessingMs: 50,
      responseDeserializationMs: 1,
    }, 72);
    expect(rows).toHaveLength(6);
    expect(rows.find((row) => row.key === 'serverProcessingMs')?.durationMs).toBe(50);
  });

  it('fills missing phases when only total duration is known', () => {
    const rows = buildGrpcTimingBreakdownRows(undefined, 100);
    const sum = rows.reduce((acc, row) => acc + row.durationMs, 0);
    expect(sum).toBeGreaterThan(0);
    expect(rows[0]?.label).toBe('DNS Lookup');
  });

  it('formats sub-millisecond durations', () => {
    expect(formatGrpcTimingDurationLabel(0.4)).toBe('<1ms');
    expect(formatGrpcTimingDurationLabel(12)).toBe('12ms');
  });

  it('scales row durations when explicit breakdown exceeds total duration', () => {
    const rows = buildGrpcTimingBreakdownRows({
      dnsLookupMs: 10,
      tcpConnectTlsMs: 20,
      http2HandshakeMs: 20,
      protoSerializationMs: 10,
      serverProcessingMs: 50,
      responseDeserializationMs: 10,
    }, 72);
    const sum = rows.reduce((acc, row) => acc + row.durationMs, 0);
    expect(sum).toBeLessThanOrEqual(72);
  });

  it('resolves bar denominator from row sum when it exceeds total', () => {
    const rows = buildGrpcTimingBreakdownRows({
      dnsLookupMs: 10,
      tcpConnectTlsMs: 10,
      http2HandshakeMs: 10,
      protoSerializationMs: 10,
      serverProcessingMs: 10,
      responseDeserializationMs: 10,
    }, 50);
    expect(resolveGrpcTimingBarDenominatorMs(rows, 50)).toBeGreaterThanOrEqual(50);
  });

  it('computes bar width as percentage of total', () => {
    expect(grpcTimingBarWidthPercent(25, 100)).toBe(25);
    expect(grpcTimingBarWidthPercent(0, 100)).toBe(0);
  });
});
