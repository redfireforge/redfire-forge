import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_RESULT } from '../../../shared/grpc/contractFixtures';
import {
  buildGrpcResponseCopyText,
  countGrpcHeaderEntries,
  formatGrpcDurationMs,
  formatGrpcRpcStatusLabel,
  formatGrpcTlsFailureHint,
  grpcStatusBadgeModifier,
  serializeGrpcResponseBody,
  sortedGrpcHeaderEntries,
} from './grpcResponseUtils';

describe('grpcResponseUtils (Phase 1G)', () => {
  it('formats RPC status label as message · code', () => {
    expect(formatGrpcRpcStatusLabel(0, 'OK')).toBe('OK · 0');
    expect(formatGrpcRpcStatusLabel(5, 'NOT_FOUND')).toBe('NOT_FOUND · 5');
  });

  it('classifies status badge modifier', () => {
    expect(grpcStatusBadgeModifier(0)).toBe('ok');
    expect(grpcStatusBadgeModifier(13)).toBe('error');
  });

  it('formats duration in milliseconds', () => {
    expect(formatGrpcDurationMs(87.4)).toBe('87ms');
    expect(formatGrpcDurationMs(-1)).toBe('—');
  });

  it('serializes response body as pretty JSON', () => {
    expect(serializeGrpcResponseBody({ message: 'hello' })).toContain('"message": "hello"');
    expect(serializeGrpcResponseBody(undefined)).toBe('{}');
  });

  it('builds copy text from unary result body', () => {
    const text = buildGrpcResponseCopyText(FIXTURE_UNARY_CALL_RESULT);
    expect(text).toContain('"message": "hello grpc"');
  });

  it('sortedGrpcHeaderEntries handles undefined headers', () => {
    expect(sortedGrpcHeaderEntries(undefined)).toEqual([]);
    expect(countGrpcHeaderEntries(undefined)).toBe(0);
  });

  it('sorts header entries by key', () => {
    expect(sortedGrpcHeaderEntries({ 'z-key': '1', 'a-key': '2' })).toEqual([
      { key: 'a-key', value: '2' },
      { key: 'z-key', value: '1' },
    ]);
  });

  it('formatGrpcTlsFailureHint maps tlsFailure details to user message', () => {
    const hint = formatGrpcTlsFailureHint({
      code: 'GRPC_TLS_FAILED',
      category: 'tls_failed',
      message: 'TLS failed',
      details: { tlsFailure: 'unknown_ca' },
    });
    expect(hint).toMatch(/not trusted/i);
  });
});
