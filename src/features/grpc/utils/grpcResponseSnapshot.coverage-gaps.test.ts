import { describe, expect, it } from 'vitest';
import {
  captureGrpcStreamResponseSnapshotBaseline,
  compareGrpcResponseToBaseline,
  createPseudoGrpcCallResultFromStreamSession,
  diffGrpcResponseSnapshotBodies,
  resolveUnaryResultForSavedRequestComparison,
  savedRequestMatchesUnaryResult,
} from './grpcResponseSnapshot';

const TS = '2026-06-29T12:00:00.000Z';

describe('grpcResponseSnapshot coverage gaps', () => {
  it('normalizes cancelled and error stream lifecycles', () => {
    const cancelled = captureGrpcStreamResponseSnapshotBaseline({
      streamLifecycle: 'cancelled',
      streamMessages: [],
    });
    expect(cancelled.grpcStatus).toBe(1);
    expect(cancelled.statusMessage).toBe('CANCELLED');

    const fallbackError = captureGrpcStreamResponseSnapshotBaseline({
      streamLifecycle: 'error',
      streamError: { code: 'X', category: 'call_failed', message: '' },
      streamMessages: [],
    });
    expect(fallbackError.grpcStatus).toBe(2);
    expect(fallbackError.statusMessage).toBe('Stream error');
  });

  it('collects array removals and object key diffs', () => {
    const diffs = diffGrpcResponseSnapshotBodies(
      { tags: ['a', 'b'], user: { name: 'Alice' } },
      { tags: ['a'], user: { name: 'Alice', role: 'admin' } },
    );
    expect(diffs.some((entry) => entry.path === 'tags[1]' && entry.change === 'removed')).toBe(true);
    expect(diffs.some((entry) => entry.path === 'user.role' && entry.change === 'added')).toBe(true);
  });

  it('returns none when baseline exists but actual is missing', () => {
    const result = compareGrpcResponseToBaseline(undefined, {
      capturedAt: TS,
      grpcStatus: 0,
      statusMessage: 'OK',
      body: {},
    });
    expect(result.state).toBe('none');
  });

  it('savedRequestMatchesUnaryResult requires unary call type and a result', () => {
    expect(savedRequestMatchesUnaryResult(
      { callType: 'server_streaming', service: 's', method: 'm' },
      { callType: 'unary', status: 0, statusMessage: 'OK', headers: {}, trailers: {}, durationMs: 0, body: {} },
    )).toBe(false);
    expect(savedRequestMatchesUnaryResult(
      { callType: 'unary', service: 's', method: 'm' },
      undefined,
    )).toBe(false);
    expect(savedRequestMatchesUnaryResult(
      { callType: 'unary', service: 's', method: 'm' },
      { callType: 'unary', status: 0, statusMessage: 'OK', headers: {}, trailers: {}, durationMs: 0, body: {} },
    )).toBe(true);
  });

  it('resolveUnaryResultForSavedRequestComparison accepts matching descriptor keys', () => {
    const okResult = {
      callType: 'unary' as const,
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
      body: {},
    };
    expect(resolveUnaryResultForSavedRequestComparison(
      { callType: 'unary', service: 'echo.EchoService', method: 'Echo', descriptorKey: 'desc-a' },
      {
        lifecycle: 'success',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-a',
        lastResult: okResult,
      },
    )).toEqual(okResult);
    expect(resolveUnaryResultForSavedRequestComparison(
      { callType: 'unary', service: 'echo.EchoService', method: 'Echo' },
      {
        lifecycle: 'idle',
        service: 'echo.EchoService',
        method: 'Echo',
        lastResult: okResult,
      },
    )).toBeUndefined();
  });

  it('createPseudoGrpcCallResultFromStreamSession copies inbound messages only', () => {
    const pseudo = createPseudoGrpcCallResultFromStreamSession({
      streamLifecycle: 'ended',
      streamMessages: [
        { sequence: 1, timestamp: TS, direction: 'outbound', data: { sent: true } },
        { sequence: 2, timestamp: TS, direction: 'inbound', data: { id: 1 } },
      ],
    });
    expect(pseudo.status).toBe(0);
    expect(pseudo.body).toEqual({ inboundMessages: [{ id: 1 }] });
  });

  it('uses grpcStatus from stream error details when present', () => {
    const baseline = captureGrpcStreamResponseSnapshotBaseline({
      streamLifecycle: 'error',
      streamError: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'permission denied',
        details: { grpcStatus: 7 },
      },
      streamMessages: [],
    });
    expect(baseline.grpcStatus).toBe(7);
    expect(baseline.statusMessage).toBe('permission denied');
  });

  it('returns no diffs when snapshot bodies are identical', () => {
    expect(diffGrpcResponseSnapshotBodies({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it('reports primitive root diffs and ignores non-unary saved requests', () => {
    expect(diffGrpcResponseSnapshotBodies(1, 2)[0]).toMatchObject({ path: '(root)', change: 'changed' });
    expect(resolveUnaryResultForSavedRequestComparison(
      { callType: 'server_streaming', service: 's', method: 'm' },
      { lifecycle: 'success', service: 's', method: 'm', lastResult: {
        callType: 'unary', status: 0, statusMessage: 'OK', headers: {}, trailers: {}, durationMs: 0, body: {},
      } },
    )).toBeUndefined();
  });

  it('compareGrpcResponseToBaseline returns match when bodies are equal', () => {
    const baseline = {
      capturedAt: TS,
      grpcStatus: 0,
      statusMessage: 'OK',
      body: { message: 'same' },
    };
    const result = compareGrpcResponseToBaseline({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
      body: { message: 'same' },
    }, baseline);
    expect(result.state).toBe('match');
  });
});
