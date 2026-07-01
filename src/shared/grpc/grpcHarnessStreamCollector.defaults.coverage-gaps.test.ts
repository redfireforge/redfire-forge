/**
 * Coverage gaps — default transport deps in grpcHarnessStreamCollector.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import type { GrpcStreamEvent } from './contracts';
import { FIXTURE_SERVER_STREAM_START_REQUEST } from './contractFixtures';

const streamClientMocks = vi.hoisted(() => ({
  startGrpcStream: vi.fn(async () => ({
    data: { streamId: 'stream-default', requestId: 'req-default' },
  })),
  sendGrpcStreamMessage: vi.fn(async () => undefined),
  endGrpcStream: vi.fn(async () => undefined),
  cancelGrpcStream: vi.fn(async () => undefined),
  openGrpcStreamEvents: vi.fn((_streamId: string, _tabId: string, handlers: {
    onEvent: (event: GrpcStreamEvent) => void;
  }) => {
    queueMicrotask(() => {
      handlers.onEvent({ type: 'grpc-end', status: 0, statusMessage: 'OK', trailers: {} });
    });
    return () => undefined;
  }),
}));

const workflowCollectorMock = vi.hoisted(() => ({
  collectGrpcWorkflowServerStream: vi.fn(async () => ({
    grpcStatus: 0,
    grpcStatusMessage: 'OK',
    durationMs: 2,
    messages: [{ n: 1 }],
    trailers: {},
    stopReason: 'stream_end' as const,
  })),
}));

vi.mock('./grpcStreamClient', () => streamClientMocks);
vi.mock('../../features/workflow/utils/grpcWorkflowStreamCollector', () => workflowCollectorMock);

import {
  collectGrpcHarnessServerStream,
  executeGrpcHarnessClientStream,
} from './grpcHarnessStreamCollector';

describe('grpcHarnessStreamCollector default deps coverage gaps', () => {
  it('uses workflow server stream collector when deps.collectServerStream is omitted', async () => {
    const outcome = await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:defaults',
      { maxMessages: 1 },
    );
    expect(workflowCollectorMock.collectGrpcWorkflowServerStream).toHaveBeenCalled();
    expect(outcome.passed).toBe(true);
  });

  it('uses grpcStreamClient defaults for outbound client streams', async () => {
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:defaults',
      [{ message: 'one' }],
    );
    expect(streamClientMocks.startGrpcStream).toHaveBeenCalled();
    expect(streamClientMocks.openGrpcStreamEvents).toHaveBeenCalled();
    expect(outcome.passed).toBe(true);
    expect(outcome.streamStopReason).toBe('stream_end');
  });

  it('maps startStream AbortError to cancelled stop reason', async () => {
    streamClientMocks.startGrpcStream.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:abort',
      [{ message: 'one' }],
    );
    expect(outcome.streamStopReason).toBe('cancelled');
    expect(outcome.passed).toBe(false);
  });

  it('maps startStream generic failures to transport_error with string detail', async () => {
    streamClientMocks.startGrpcStream.mockRejectedValueOnce('start exploded');
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:transport',
      [{ message: 'one' }],
    );
    expect(outcome.streamStopReason).toBe('transport_error');
    expect(outcome.errorDetail).toBe('start exploded');
  });

  it('uses grpc-error defaults when status fields are omitted on default deps', async () => {
    streamClientMocks.openGrpcStreamEvents.mockImplementationOnce((_streamId, _tabId, handlers: {
      onEvent: (event: GrpcStreamEvent) => void;
    }) => {
      queueMicrotask(() => {
        handlers.onEvent({ type: 'grpc-error', trailers: {} });
      });
      return () => undefined;
    });
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:error-defaults',
      [{ message: 'one' }],
    );
    expect(outcome.grpcStatus).toBe(13);
    expect(outcome.grpcStatusMessage).toBe('Stream error');
  });
});
