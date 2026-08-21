import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { deliverWithFault } from './apiMockFaultExecutor';

function mockPair(options: {
  headersSent?: boolean;
  endThrows?: boolean;
  writeThrows?: boolean;
  destroyThrows?: boolean;
} = {}) {
  const socket = new EventEmitter() as EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  socket.write = vi.fn(() => {
    if (options.writeThrows) throw new Error('write failed');
  });
  socket.destroy = vi.fn(() => {
    if (options.destroyThrows) throw new Error('destroy failed');
  });

  const res = {
    headersSent: options.headersSent ?? false,
    writableEnded: false,
    writeHead: vi.fn(function (this: { headersSent: boolean }) { this.headersSent = true; }),
    write: vi.fn(() => {
      if (options.writeThrows) throw new Error('write failed');
    }),
    end: vi.fn(function (this: { writableEnded: boolean }) {
      if (options.endThrows) throw new Error('end failed');
      this.writableEnded = true;
    }),
  };

  const req = { socket } as unknown as import('node:http').IncomingMessage;
  return { req, res: res as unknown as import('node:http').ServerResponse, socket, resMock: res };
}

describe('apiMockFaultExecutor coverage gaps', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips writeHead and end when headers were already sent for a normal response', async () => {
    const { req, res, resMock } = mockPair({ headersSent: true });
    const result = await deliverWithFault({
      req,
      res,
      fault: 'none',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'ok',
    });
    expect(result.outcome).toBe('matched');
    expect(resMock.writeHead).not.toHaveBeenCalled();
    expect(resMock.end).not.toHaveBeenCalled();
  });

  it('closes the connection abruptly for close fault', async () => {
    const { req, res, resMock, socket } = mockPair();
    const result = await deliverWithFault({
      req,
      res,
      fault: 'close',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200,
      headers: {},
      body: 'ignored',
    });
    expect(result.outcome).toBe('fault');
    expect(resMock.end).toHaveBeenCalled();
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  it('destroys the socket when close/end throws', async () => {
    const { req, res, socket } = mockPair({ endThrows: true });
    const result = await deliverWithFault({
      req,
      res,
      fault: 'close',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200,
      headers: {},
      body: '',
    });
    expect(result.outcome).toBe('fault');
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('clears the timeout hold timer when the socket closes early', async () => {
    vi.useFakeTimers();
    const { req, res, socket } = mockPair();
    const pending = deliverWithFault({
      req,
      res,
      fault: 'timeout',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 500,
      status: 200,
      headers: {},
      body: '',
    });
    socket.emit('close');
    await expect(pending).resolves.toMatchObject({ outcome: 'fault', completedHttp: false });
    await vi.advanceTimersByTimeAsync(500);
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  it('uses default dribble schedule and handles write failures', async () => {
    vi.useFakeTimers();
    const { req, res, resMock } = mockPair();
    const pending = deliverWithFault({
      req,
      res,
      fault: 'dribble',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'abcd',
    });
    await vi.advanceTimersByTimeAsync(60);
    const result = await pending;
    expect(result.completedHttp).toBe(true);
    expect(resMock.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Transfer-Encoding': 'chunked',
    }));
    expect(resMock.write).toHaveBeenCalled();
  });

  it('destroys the socket when dribble chunk writes fail', async () => {
    vi.useFakeTimers();
    const { req, res, socket } = mockPair({ writeThrows: true });
    const pending = deliverWithFault({
      req,
      res,
      fault: 'dribble',
      behavior: {
        delayMs: 0,
        jitterMs: 0,
        chunkSchedule: [{ afterMs: 0, body: 'x' }],
      },
      longRunningMaxMs: 1000,
      status: 200,
      headers: {},
      body: 'x',
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await pending;
    expect(result.completedHttp).toBe(false);
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('ignores destroy failures for reset and malformed faults', async () => {
    const resetPair = mockPair({ destroyThrows: true });
    await expect(deliverWithFault({
      req: resetPair.req,
      res: resetPair.res,
      fault: 'reset',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200,
      headers: {},
      body: '',
    })).resolves.toMatchObject({ outcome: 'fault' });

    const malformedPair = mockPair({ destroyThrows: true, writeThrows: false });
    malformedPair.socket.write = vi.fn(() => { throw new Error('write boom'); });
    await expect(deliverWithFault({
      req: malformedPair.req,
      res: malformedPair.res,
      fault: 'malformed',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200,
      headers: {},
      body: '',
    })).resolves.toMatchObject({ outcome: 'fault' });
  });

  it('dribbles without rewriting headers when they were already sent', async () => {
    vi.useFakeTimers();
    const { req, res, resMock } = mockPair({ headersSent: true });
    const pending = deliverWithFault({
      req,
      res,
      fault: 'dribble',
      behavior: {
        delayMs: 0,
        jitterMs: 0,
        chunkSchedule: [{ afterMs: 0, body: 'z' }],
      },
      longRunningMaxMs: 1000,
      status: 200,
      headers: {},
      body: 'z',
    });
    await vi.advanceTimersByTimeAsync(5);
    await pending;
    expect(resMock.writeHead).not.toHaveBeenCalled();
  });
});
