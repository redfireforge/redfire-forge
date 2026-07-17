import { describe, expect, it, vi } from 'vitest';
import * as grpcAuthPolicy from '../../../shared/grpc/grpcAuthPolicy';
import {
  describeGrpcAssertion,
  logGrpcAssertUpstream,
  logGrpcCallResponse,
  logGrpcRequestMetadata,
  resolveGrpcRequestMetadataForLog,
} from './graphRunnerGrpcLogHelpers';

function collectLines(fn: (emit: (line: { prefix: string; text: string }) => void) => void) {
  const lines: Array<{ prefix: string; text: string }> = [];
  fn((line) => lines.push(line));
  return lines;
}

describe('graphRunnerGrpcLogHelpers coverage gaps', () => {
  it('resolveGrpcRequestMetadataForLog falls back when auth merge throws', () => {
    vi.spyOn(grpcAuthPolicy, 'prepareGrpcExecuteRequestMetadata').mockImplementation(() => {
      throw new Error('auth merge failed');
    });
    expect(resolveGrpcRequestMetadataForLog({ 'x-trace': '1' }, { type: 'bearer', bearerToken: 't' }))
      .toEqual({ 'x-trace': '1' });
    expect(resolveGrpcRequestMetadataForLog(undefined, { type: 'bearer', bearerToken: 't' }))
      .toEqual({});
    vi.restoreAllMocks();
  });

  it('logGrpcRequestMetadata logs oauth2 without metadata rows', () => {
    const lines = collectLines((log) => {
      logGrpcRequestMetadata('Echo', log, {}, { type: 'oauth2', profileId: 'p1' });
    });
    expect(lines[0]?.text).toContain('oauth2');
  });

  it('logGrpcRequestMetadata logs auth type when metadata is empty', () => {
    const lines = collectLines((log) => {
      logGrpcRequestMetadata('Echo', log, {}, { type: 'api_key', headerName: 'x-key', value: 'secret' });
    });
    expect(lines[0]?.text).toContain('api_key');
  });

  it('logGrpcCallResponse covers server streaming, attempts, and trailers', () => {
    const lines = collectLines((log) => {
      logGrpcCallResponse('Stream', log, {
        nodeId: 'n1',
        callType: 'server_streaming',
        status: 'success',
        grpcStatus: 0,
        durationMs: 12,
        messages: [{ seq: 1 }, { seq: 2 }],
        streamStopReason: 'max_messages',
      }, { attempts: 3 });
      logGrpcCallResponse('EmptyStream', log, {
        nodeId: 'n3',
        callType: 'server_streaming',
        status: 'success',
        grpcStatus: 0,
        messages: [],
      });
      logGrpcCallResponse('Unary', log, {
        nodeId: 'n2',
        callType: 'unary',
        status: 'success',
        grpcStatus: 0,
        body: { ok: true },
        trailers: { 'grpc-status': '0' },
      });
      logGrpcCallResponse('StatusOnly', log, {
        nodeId: 'n4',
        callType: 'unary',
        status: 'success',
        grpcStatus: 0,
        grpcStatusMessage: 'Cancelled',
      });
    });
    expect(lines.some((l) => l.text.includes('Messages: 2'))).toBe(true);
    expect(lines.some((l) => l.text.includes('Stop reason: max_messages'))).toBe(true);
    expect(lines.some((l) => l.text.includes('Attempts: 3'))).toBe(true);
    expect(lines.some((l) => l.text.includes('Trailers:'))).toBe(true);
    expect(lines.some((l) => l.text.includes('Cancelled'))).toBe(true);
    expect(lines.some((l) => l.text.includes('Messages: 0'))).toBe(true);
  });

  it('describeGrpcAssertion formats trailer, duration, stream, and fallback assertions', () => {
    expect(describeGrpcAssertion({ grpcField: 'id', exists: true })).toContain('exists = true');
    expect(describeGrpcAssertion({ grpcField: 'id', contains: 'abc' })).toContain('contains');
    expect(describeGrpcAssertion({ grpcField: 'id' })).toBe('grpcField "id"');
    expect(describeGrpcAssertion({ grpcTrailer: 'x-foo', exists: false })).toContain('exists = false');
    expect(describeGrpcAssertion({ grpcTrailer: 'x-foo', equals: 'bar' })).toContain('equals bar');
    expect(describeGrpcAssertion({ grpcTrailer: 'x-foo' })).toBe('grpcTrailer "x-foo"');
    expect(describeGrpcAssertion({ grpcDuration: { max: 100, min: 10 } })).toContain('max 100ms');
    expect(describeGrpcAssertion({ grpcDuration: {} })).toContain('(empty)');
    expect(describeGrpcAssertion({ grpcStreamLength: { equals: 2, min: 1, max: 5 } })).toContain('equals 2');
    expect(describeGrpcAssertion({ grpcStreamLength: {} })).toContain('(empty)');
    expect(describeGrpcAssertion({} as never)).toBe('assertion');
  });

  it('logGrpcAssertUpstream prefers last stream message when body is absent', () => {
    const lines = collectLines((log) => {
      logGrpcAssertUpstream('Assert', log, {
        nodeId: 'u1',
        callType: 'server_streaming',
        status: 'success',
        grpcStatus: 0,
        messages: [{ first: true }, { last: true }],
      });
    });
    expect(lines[1]?.text).toContain('Upstream last message');
    expect(lines[1]?.text).toContain('last');
  });
});
