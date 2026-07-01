import type { Response } from 'express';
import type { GrpcStreamEvent } from '../../src/shared/grpc/contracts.js';

export function initGrpcStreamSseResponse(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
}

export function writeGrpcStreamSseEvent(
  res: Response,
  eventName: GrpcStreamEvent['type'],
  data: GrpcStreamEvent,
): void {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function closeGrpcStreamSseResponse(res: Response): void {
  if (!res.writableEnded) {
    res.end();
  }
}
