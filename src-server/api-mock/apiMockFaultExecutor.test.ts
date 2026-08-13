import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { deliverWithFault } from './apiMockFaultExecutor';

function mockPair() {
  const socket = new EventEmitter() as EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  socket.write = vi.fn();
  socket.destroy = vi.fn();

  const res = {
    headersSent: false,
    writableEnded: false,
    writeHead: vi.fn(function (this: { headersSent: boolean }) { this.headersSent = true; }),
    write: vi.fn(),
    end: vi.fn(function (this: { writableEnded: boolean }) { this.writableEnded = true; }),
  };

  const req = { socket } as unknown as import('node:http').IncomingMessage;
  return { req, res: res as unknown as import('node:http').ServerResponse, socket, resMock: res };
}

describe('apiMockFaultExecutor', () => {
  it('sends a normal response for none/undefined fault', async () => {
    const { req, res, resMock } = mockPair();
    const result = await deliverWithFault({
      req, res, fault: 'none',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'ok',
    });
    expect(result.outcome).toBe('matched');
    expect(resMock.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
    expect(resMock.end).toHaveBeenCalledWith('ok');
  });

  it('destroys the socket for reset', async () => {
    const { req, res, socket } = mockPair();
    const result = await deliverWithFault({
      req, res, fault: 'reset',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'x',
    });
    expect(result.outcome).toBe('fault');
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('writes malformed framing then destroys for malformed', async () => {
    const { req, res, socket } = mockPair();
    const result = await deliverWithFault({
      req, res, fault: 'malformed',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'x',
    });
    expect(result.outcome).toBe('fault');
    expect(socket.write).toHaveBeenCalled();
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('holds then destroys for timeout', async () => {
    vi.useFakeTimers();
    const { req, res, socket } = mockPair();
    const pending = deliverWithFault({
      req, res, fault: 'timeout',
      behavior: { delayMs: 0, jitterMs: 0, longRunningMs: 50 },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'x',
    });
    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;
    expect(result.outcome).toBe('fault');
    expect(socket.destroy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('dribbles chunks then ends', async () => {
    vi.useFakeTimers();
    const { req, res, resMock } = mockPair();
    const pending = deliverWithFault({
      req, res, fault: 'dribble',
      behavior: {
        delayMs: 0, jitterMs: 0,
        chunkSchedule: [
          { afterMs: 10, body: 'a' },
          { afterMs: 10, body: 'b' },
        ],
      },
      longRunningMaxMs: 1000,
      status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'ab',
    });
    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;
    expect(result.outcome).toBe('fault');
    expect(result.completedHttp).toBe(true);
    expect(resMock.write).toHaveBeenCalled();
    expect(resMock.end).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
