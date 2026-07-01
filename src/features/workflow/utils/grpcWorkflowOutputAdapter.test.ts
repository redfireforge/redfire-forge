/**
 * Phase 6G — unit tests for grpcWorkflowOutputAdapter.ts
 *
 * Pure transformation tests; no network I/O, no mocking required.
 */
import { describe, expect, it } from 'vitest';
import {
  grpcStatusLabel,
  buildGrpcNodeStatusMeta,
  formatGrpcNodeRunDetail,
  type GrpcOutputAdapterMeta,
} from './grpcWorkflowOutputAdapter';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const UNARY_META: GrpcOutputAdapterMeta = {
  service: 'echo.EchoService',
  method: 'Echo',
  target: 'localhost:50051',
  callType: 'unary',
  attempts: 1,
};

const STREAM_META: GrpcOutputAdapterMeta = {
  service: 'events.EventService',
  method: 'Subscribe',
  target: 'localhost:9090',
  callType: 'server_streaming',
  attempts: 1,
};

const ASSERT_META: GrpcOutputAdapterMeta = {
  service: 'echo.EchoService',
  method: 'Echo',
  target: 'localhost:50051',
  callType: 'assert',
  assertSource: 'echoCall',
};

const UNARY_STEP: GrpcWorkflowStepResult = {
  nodeId: 'n1',
  callType: 'unary',
  status: 'success',
  grpcStatus: 0,
  grpcStatusMessage: 'OK',
  durationMs: 45,
  body: { message: 'hello' },
  trailers: { 'grpc-status': '0' },
};

const STREAM_STEP: GrpcWorkflowStepResult = {
  nodeId: 'n2',
  callType: 'server_streaming',
  status: 'success',
  grpcStatus: 0,
  durationMs: 120,
  messages: [{ event: 'a' }, { event: 'b' }, { event: 'c' }],
  streamStopReason: 'stream_end',
};

const ASSERT_STEP_PASS: GrpcWorkflowStepResult = {
  nodeId: 'n3',
  callType: 'unary',
  status: 'success',
  grpcStatus: 0,
  durationMs: 30,
};

const ASSERT_STEP_FAIL: GrpcWorkflowStepResult = {
  nodeId: 'n3',
  callType: 'unary',
  status: 'failed',
  grpcStatus: 0,
  durationMs: 28,
  assertionFailures: ['$.message expected "hello" got "world"', '$.code expected 0 got 1'],
};

// ─── grpcStatusLabel ─────────────────────────────────────────────────────────

describe('grpcStatusLabel', () => {
  it('returns OK for status 0', () => {
    expect(grpcStatusLabel(0)).toBe('OK');
  });

  it('returns CANCELLED for status 1', () => {
    expect(grpcStatusLabel(1)).toBe('CANCELLED');
  });

  it('returns NOT_FOUND for status 5', () => {
    expect(grpcStatusLabel(5)).toBe('NOT_FOUND');
  });

  it('returns UNAVAILABLE for status 14', () => {
    expect(grpcStatusLabel(14)).toBe('UNAVAILABLE');
  });

  it('returns UNAUTHENTICATED for status 16', () => {
    expect(grpcStatusLabel(16)).toBe('UNAUTHENTICATED');
  });

  it('returns STATUS_N fallback for unknown codes', () => {
    expect(grpcStatusLabel(99)).toBe('STATUS_99');
    expect(grpcStatusLabel(50)).toBe('STATUS_50');
  });

  it('returns UNKNOWN for undefined', () => {
    expect(grpcStatusLabel(undefined)).toBe('UNKNOWN');
  });
});

// ─── buildGrpcNodeStatusMeta ─────────────────────────────────────────────────

describe('buildGrpcNodeStatusMeta', () => {
  it('builds unary meta with all fields populated', () => {
    const meta = buildGrpcNodeStatusMeta(UNARY_STEP, UNARY_META);

    expect(meta.service).toBe('echo.EchoService');
    expect(meta.method).toBe('Echo');
    expect(meta.target).toBe('localhost:50051');
    expect(meta.callType).toBe('unary');
    expect(meta.grpcStatus).toBe(0);
    expect(meta.grpcStatusMessage).toBe('OK');
    expect(meta.attempts).toBe(1);
    expect(meta.bodyPreview).toContain('hello');
  });

  it('builds server_streaming meta with messageCount and streamStopReason', () => {
    const meta = buildGrpcNodeStatusMeta(STREAM_STEP, STREAM_META);

    expect(meta.callType).toBe('server_streaming');
    expect(meta.messageCount).toBe(3);
    expect(meta.streamStopReason).toBe('stream_end');
    // bodyPreview from last message
    expect(meta.bodyPreview).toContain('event');
  });

  it('builds assert meta with assertionFailures', () => {
    const meta = buildGrpcNodeStatusMeta(ASSERT_STEP_FAIL, ASSERT_META);

    expect(meta.callType).toBe('assert');
    expect(meta.assertionFailures).toHaveLength(2);
    expect(meta.assertionFailures![0]).toContain('$.message');
  });

  it('returns minimal meta when stepResult is undefined', () => {
    const meta = buildGrpcNodeStatusMeta(undefined, UNARY_META);

    expect(meta.service).toBe('echo.EchoService');
    expect(meta.method).toBe('Echo');
    expect(meta.target).toBe('localhost:50051');
    expect(meta.callType).toBe('unary');
    expect(meta.grpcStatus).toBeUndefined();
    expect(meta.bodyPreview).toBeUndefined();
    expect(meta.messageCount).toBeUndefined();
  });

  it('sets bodyPreview from body for unary', () => {
    const meta = buildGrpcNodeStatusMeta(UNARY_STEP, UNARY_META);
    expect(meta.bodyPreview).toBe(JSON.stringify(UNARY_STEP.body));
  });

  it('sets bodyPreview from last message for streaming', () => {
    const meta = buildGrpcNodeStatusMeta(STREAM_STEP, STREAM_META);
    const lastMsg = STREAM_STEP.messages![STREAM_STEP.messages!.length - 1];
    expect(meta.bodyPreview).toBe(JSON.stringify(lastMsg));
  });

  it('truncates bodyPreview at 512 characters', () => {
    const bigBody = { data: 'x'.repeat(600) };
    const step: GrpcWorkflowStepResult = {
      nodeId: 'n4',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      body: bigBody,
    };
    const meta = buildGrpcNodeStatusMeta(step, UNARY_META);
    expect(meta.bodyPreview!.length).toBeLessThanOrEqual(512);
  });
});

// ─── formatGrpcNodeRunDetail ─────────────────────────────────────────────────

describe('formatGrpcNodeRunDetail', () => {
  it('formats unary success detail with service/method/target and status', () => {
    const detail = formatGrpcNodeRunDetail(UNARY_STEP, UNARY_META);

    expect(detail).toContain('UNARY echo.EchoService/Echo → localhost:50051');
    expect(detail).toContain('gRPC 0 OK');
    expect(detail).toContain('45ms');
    expect(detail).toContain('hello');
  });

  it('formats unary detail with non-zero gRPC status', () => {
    const failStep: GrpcWorkflowStepResult = {
      nodeId: 'n5',
      callType: 'unary',
      status: 'failed',
      grpcStatus: 14,
      grpcStatusMessage: 'Connection refused',
      durationMs: 10,
    };
    const detail = formatGrpcNodeRunDetail(failStep, UNARY_META);

    expect(detail).toContain('gRPC 14 UNAVAILABLE');
    expect(detail).toContain('Connection refused');
  });

  it('formats server_streaming detail with messages and stop reason', () => {
    const detail = formatGrpcNodeRunDetail(STREAM_STEP, STREAM_META);

    expect(detail).toContain('SERVER_STREAM events.EventService/Subscribe → localhost:9090');
    expect(detail).toContain('Messages collected: 3');
    expect(detail).toContain('Stop reason: stream_end');
    expect(detail).toContain('Last message:');
    expect(detail).toContain('event');
  });

  it('formats assert pass detail with "All assertions passed"', () => {
    const detail = formatGrpcNodeRunDetail(ASSERT_STEP_PASS, ASSERT_META);

    expect(detail).toContain('ASSERT source=echoCall');
    expect(detail).toContain('All assertions passed');
    expect(detail).toContain('Duration: 30ms');
  });

  it('formats assert fail detail with failure list', () => {
    const detail = formatGrpcNodeRunDetail(ASSERT_STEP_FAIL, ASSERT_META);

    expect(detail).toContain('ASSERT source=echoCall');
    expect(detail).toContain('Assertion failures:');
    expect(detail).toContain('$.message expected "hello" got "world"');
    expect(detail).toContain('$.code expected 0 got 1');
  });

  it('includes attempt count when attempts > 1', () => {
    const retryMeta: GrpcOutputAdapterMeta = { ...UNARY_META, attempts: 3 };
    const detail = formatGrpcNodeRunDetail(UNARY_STEP, retryMeta);
    expect(detail).toContain('Attempts: 3');
  });

  it('omits attempt count when attempts is 1', () => {
    const detail = formatGrpcNodeRunDetail(UNARY_STEP, UNARY_META);
    expect(detail).not.toContain('Attempts:');
  });

  it('includes trailers section when trailers are present', () => {
    const detail = formatGrpcNodeRunDetail(UNARY_STEP, UNARY_META);
    expect(detail).toContain('Trailers:');
    expect(detail).toContain('grpc-status: 0');
  });

  it('uses target as assertSource fallback when assertSource is undefined', () => {
    const metaNoSource: GrpcOutputAdapterMeta = { ...ASSERT_META, assertSource: undefined };
    const detail = formatGrpcNodeRunDetail(ASSERT_STEP_PASS, metaNoSource);
    expect(detail).toContain(`ASSERT source=${ASSERT_META.target}`);
  });
});
