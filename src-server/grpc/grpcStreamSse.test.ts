/**
 * @vitest-environment node
 */
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_STREAM_MESSAGE_EVENT } from '../../src/shared/grpc/contractFixtures.js';
import {
  closeGrpcStreamSseResponse,
  initGrpcStreamSseResponse,
  writeGrpcStreamSseEvent,
} from './grpcStreamSse.js';

describe('grpcStreamSse', () => {
  it('initializes SSE response headers', () => {
    const res = {
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
    } as unknown as Response;

    initGrpcStreamSseResponse(res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    expect(res.flushHeaders).toHaveBeenCalled();
  });

  it('writes event name and JSON payload in SSE wire format', () => {
    const res = { write: vi.fn() } as unknown as Response;

    writeGrpcStreamSseEvent(res, 'grpc-message', FIXTURE_STREAM_MESSAGE_EVENT);

    expect(res.write).toHaveBeenCalledWith(
      `event: grpc-message\ndata: ${JSON.stringify(FIXTURE_STREAM_MESSAGE_EVENT)}\n\n`,
    );
  });

  it('closes response when not already ended', () => {
    const res = {
      writableEnded: false,
      end: vi.fn(),
    } as unknown as Response;

    closeGrpcStreamSseResponse(res);

    expect(res.end).toHaveBeenCalled();
  });
});
