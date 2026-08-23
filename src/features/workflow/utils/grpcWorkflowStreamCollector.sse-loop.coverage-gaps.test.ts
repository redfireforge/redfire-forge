/**
 * Coverage gaps — SSE loop abort branch (lines 217–219) via mocked parser.
 * The real parseGrpcSseStream throws AbortError before the collector loop can break.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/grpc/grpcStreamSseParser', () => ({
  parseGrpcStreamEventJson: (data: string) => JSON.parse(data) as unknown,
  parseGrpcSseStream: vi.fn(),
}));

import { parseGrpcSseStream } from '@shared/grpc/grpcStreamSseParser';
import { collectGrpcWorkflowServerStream } from './grpcWorkflowStreamCollector';
import type { GrpcStreamStartRequest } from '@shared/grpc/contracts';

describe('grpcWorkflowStreamCollector SSE loop abort coverage', () => {
  const request = {
    requestId: 'req-stream',
    target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
    descriptorKey: 'dk',
    service: 'echo.EchoService',
    method: 'ServerStream',
    body: { message: 'hi' },
  } satisfies GrpcStreamStartRequest;

  it('breaks the SSE loop when the abort signal is set between frames', async () => {
    const abortController = new AbortController();
    let releaseSecondFrame!: () => void;
    const secondFrameGate = new Promise<void>((resolve) => {
      releaseSecondFrame = resolve;
    });

    vi.mocked(parseGrpcSseStream).mockImplementation(async function* () {
      yield {
        event: 'grpc-message',
        data: JSON.stringify({ type: 'grpc-message', data: { n: 1 } }),
      };
      await secondFrameGate;
      yield { event: 'grpc-heartbeat', data: '{}' };
    });

    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-sse-abort' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream<Uint8Array>({ start() {} }),
    } as Response));

    const pending = collectGrpcWorkflowServerStream(
      request,
      'workflow:node-sse-abort',
      {},
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, fetchEvents },
      },
    );

    await vi.waitFor(() => expect(fetchEvents).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    abortController.abort();
    releaseSecondFrame();
    const result = await pending;

    expect(result.stopReason).toBe('cancelled');
    expect(result.messages).toEqual([{ n: 1 }]);
  });
});
