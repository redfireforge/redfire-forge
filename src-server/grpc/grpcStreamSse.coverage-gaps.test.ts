/**
 * @vitest-environment node
 */
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { closeGrpcStreamSseResponse, initGrpcStreamSseResponse } from './grpcStreamSse.js';

describe('grpcStreamSse coverage gaps', () => {
  it('initGrpcStreamSseResponse works without flushHeaders', () => {
    const res = { writeHead: vi.fn() } as unknown as Response;
    initGrpcStreamSseResponse(res);
    expect(res.writeHead).toHaveBeenCalled();
  });

  it('closeGrpcStreamSseResponse is a no-op when already ended', () => {
    const end = vi.fn();
    const res = { writableEnded: true, end } as unknown as Response;
    closeGrpcStreamSseResponse(res);
    expect(end).not.toHaveBeenCalled();
  });
});
