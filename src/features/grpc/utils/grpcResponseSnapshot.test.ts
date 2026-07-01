import { describe, expect, it } from 'vitest';
import {
  captureGrpcResponseSnapshotBaseline,
  compareGrpcResponseToBaseline,
  diffGrpcResponseSnapshotBodies,
  resolveUnaryResultForSavedRequestComparison,
} from './grpcResponseSnapshot';

describe('grpcResponseSnapshot (Phase 5I)', () => {
  it('captureGrpcResponseSnapshotBaseline copies status and body', () => {
    const baseline = captureGrpcResponseSnapshotBaseline({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: { authorization: 'Bearer secret-token' },
      trailers: { 'x-secret': 'value' },
      durationMs: 12,
      body: { message: 'hello' },
    });
    expect(baseline.grpcStatus).toBe(0);
    expect(baseline.statusMessage).toBe('OK');
    expect(baseline.body).toEqual({ message: 'hello' });
    expect(baseline.capturedAt).toMatch(/^\d{4}-/);
    expect(baseline).not.toHaveProperty('headers');
    expect(baseline).not.toHaveProperty('trailers');
  });

  it('captureGrpcResponseSnapshotBaseline rejects non-OK gRPC status', () => {
    expect(() => captureGrpcResponseSnapshotBaseline({
      callType: 'unary',
      status: 5,
      statusMessage: 'NOT_FOUND',
      headers: {},
      trailers: {},
      durationMs: 1,
      body: {},
    })).toThrow(/successful unary response/i);
  });

  it('compareGrpcResponseToBaseline returns none without baseline', () => {
    expect(compareGrpcResponseToBaseline(undefined, undefined).state).toBe('none');
  });

  it('compareGrpcResponseToBaseline detects match', () => {
    const baseline = captureGrpcResponseSnapshotBaseline({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
      body: { message: 'hi' },
    });
    const result = compareGrpcResponseToBaseline({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 2,
      body: { message: 'hi' },
    }, baseline);
    expect(result.state).toBe('match');
    expect(result.diffs).toHaveLength(0);
  });

  it('compareGrpcResponseToBaseline detects body and status diffs', () => {
    const baseline = captureGrpcResponseSnapshotBaseline({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
      body: { message: 'old', count: 1 },
    });
    const result = compareGrpcResponseToBaseline({
      callType: 'unary',
      status: 5,
      statusMessage: 'NOT_FOUND',
      headers: {},
      trailers: {},
      durationMs: 2,
      body: { message: 'new' },
    }, baseline);
    expect(result.state).toBe('diff');
    expect(result.statusMismatch).toBe(true);
    expect(result.diffs.some((entry) => entry.path === 'grpcStatus')).toBe(true);
    expect(result.diffs.some((entry) => entry.path === 'message')).toBe(true);
    expect(result.diffs.some((entry) => entry.path === 'count')).toBe(true);
  });

  it('compareGrpcResponseToBaseline detects statusMessage diff', () => {
    const baseline = captureGrpcResponseSnapshotBaseline({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
      body: { message: 'hi' },
    });
    const result = compareGrpcResponseToBaseline({
      callType: 'unary',
      status: 0,
      statusMessage: 'Custom message',
      headers: {},
      trailers: {},
      durationMs: 2,
      body: { message: 'hi' },
    }, baseline);
    expect(result.state).toBe('diff');
    expect(result.diffs.some((entry) => entry.path === 'statusMessage')).toBe(true);
  });

  it('resolveUnaryResultForSavedRequestComparison requires OK unary match', () => {
    const saved = { callType: 'unary', service: 'echo.EchoService', method: 'Echo' };
    const okResult = {
      callType: 'unary' as const,
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
      body: {},
    };
    expect(resolveUnaryResultForSavedRequestComparison(saved, {
      lifecycle: 'success',
      service: 'echo.EchoService',
      method: 'Echo',
      lastResult: okResult,
    })).toEqual(okResult);
    expect(resolveUnaryResultForSavedRequestComparison(saved, {
      lifecycle: 'success',
      service: 'echo.EchoService',
      method: 'Echo',
      lastResult: { ...okResult, status: 5 },
    })).toBeUndefined();
    expect(resolveUnaryResultForSavedRequestComparison(saved, {
      lifecycle: 'success',
      service: 'other.Service',
      method: 'Echo',
      lastResult: okResult,
    })).toBeUndefined();
    expect(resolveUnaryResultForSavedRequestComparison(
      { ...saved, descriptorKey: 'desc-a' },
      {
        lifecycle: 'success',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-b',
        lastResult: okResult,
      },
    )).toBeUndefined();
  });

  it('diffGrpcResponseSnapshotBodies reports nested changes', () => {
    const diffs = diffGrpcResponseSnapshotBodies(
      { user: { name: 'Alice' }, tags: ['a'] },
      { user: { name: 'Bob' }, tags: ['a', 'b'] },
    );
    expect(diffs.some((entry) => entry.path === 'user.name' && entry.change === 'changed')).toBe(true);
    expect(diffs.some((entry) => entry.path === 'tags[1]' && entry.change === 'added')).toBe(true);
  });
});
