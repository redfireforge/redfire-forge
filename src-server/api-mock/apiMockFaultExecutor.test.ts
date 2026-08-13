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

  it('resolves an HTTP/2 timeout when the stream closes without destroying later', async () => {
    vi.useFakeTimers();
    const { req, res, socket } = mockPair();
    let onStreamClose: () => void = () => {};
    const stream = {
      close: vi.fn(),
      once: vi.fn((event: string, fn: () => void) => {
        if (event === 'close') onStreamClose = fn;
      }),
      session: { destroy: vi.fn() },
    };
    (req as { httpVersion?: string; stream?: unknown }).httpVersion = '2.0';
    (req as { stream?: unknown }).stream = stream;
    const pending = deliverWithFault({
      req, res, fault: 'timeout',
      behavior: { delayMs: 0, jitterMs: 0, longRunningMs: 50 },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'x',
    });
    onStreamClose();
    await expect(pending).resolves.toMatchObject({ outcome: 'fault' });
    await vi.advanceTimersByTimeAsync(50);
    expect(socket.destroy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('dribbles chunks then ends', async () => {
    vi.useFakeTimers();
    const { req, res, resMock, socket: _socket } = mockPair();
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
    socket.emit('close');
    vi.useRealTimers();
  });

  it('omits Transfer-Encoding on HTTP/2 dribble and does not write HTTP/1.1 garbage for malformed', async () => {
    vi.useFakeTimers();
    const stream = { close: vi.fn(), session: { destroy: vi.fn() } };
    const { req, res, resMock, socket: _socket } = mockPair();
    (req as { httpVersion?: string; stream?: unknown }).httpVersion = '2.0';
    (req as { stream?: unknown }).stream = stream;

    const pending = deliverWithFault({
      req, res, fault: 'dribble',
      behavior: { delayMs: 0, jitterMs: 0, chunkSchedule: [{ afterMs: 10, body: 'a' }] },
      longRunningMaxMs: 1000,
      status: 200,
      headers: { 'Content-Type': 'text/plain', Connection: 'keep-alive' },
      body: 'a',
    });
    await vi.advanceTimersByTimeAsync(20);
    await pending;
    expect(resMock.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
    vi.useRealTimers();

    const malformed = mockPair();
    (malformed.req as { httpVersion?: string; stream?: unknown }).httpVersion = '2.0';
    (malformed.req as { stream?: unknown }).stream = stream;
    await deliverWithFault({
      req: malformed.req, res: malformed.res, fault: 'malformed',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'x',
    });
    expect(malformed.socket.write).not.toHaveBeenCalled();
    expect(stream.close).toHaveBeenCalled();
    expect(stream.session.destroy).toHaveBeenCalled();
    expect(malformed.socket.destroy).toHaveBeenCalled();

    const none = mockPair();
    (none.req as { httpVersion?: string }).httpVersion = '2.0';
    await deliverWithFault({
      req: none.req, res: none.res, fault: 'none',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200,
      headers: { 'Content-Type': 'text/plain', Connection: 'keep-alive' },
      body: 'ok',
    });
    expect(none.resMock.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
  });

  it('does not destroy the HTTP/2 session when a dribble stream is reset', async () => {
    vi.useFakeTimers();
    const { req, res, socket } = mockPair();
    let onStreamClose: () => void = () => {};
    const stream = {
      closed: false,
      close: vi.fn(),
      once: vi.fn((event: string, fn: () => void) => {
        if (event === 'close') onStreamClose = fn;
      }),
      session: { destroy: vi.fn() },
    };
    (req as { httpVersion?: string; stream?: unknown }).httpVersion = '2.0';
    (req as { stream?: unknown }).stream = stream;
    const pending = deliverWithFault({
      req, res, fault: 'dribble',
      behavior: { delayMs: 0, jitterMs: 0, chunkSchedule: [{ afterMs: 20, body: 'a' }] },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'a',
    });
    stream.closed = true;
    onStreamClose();
    await expect(pending).resolves.toMatchObject({ outcome: 'fault', completedHttp: false });
    expect(stream.session.destroy).not.toHaveBeenCalled();
    expect(socket.destroy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40);
    vi.useRealTimers();
  });

  it('aborts the HTTP/2 stream for close without destroying the session', async () => {
    const { req, res, socket, resMock } = mockPair();
    const stream = { close: vi.fn(), session: { destroy: vi.fn() } };
    (req as { httpVersion?: string; stream?: unknown }).httpVersion = '2.0';
    (req as { stream?: unknown }).stream = stream;
    resMock.end = vi.fn(() => { throw new Error('end failed'); });
    await deliverWithFault({
      req, res, fault: 'close',
      behavior: { delayMs: 0, jitterMs: 0 },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: '',
    });
    expect(resMock.end).not.toHaveBeenCalled();
    expect(stream.close).toHaveBeenCalled();
    expect(stream.session.destroy).not.toHaveBeenCalled();
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  it('aborts dribble when the client disconnects', async () => {
    vi.useFakeTimers();
    const { req, res, socket } = mockPair();
    const pending = deliverWithFault({
      req, res, fault: 'dribble',
      behavior: {
        delayMs: 0, jitterMs: 0,
        chunkSchedule: [
          { afterMs: 20, body: 'a' },
          { afterMs: 40, body: 'b' },
        ],
      },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'ab',
    });
    socket.emit('close');
    await expect(pending).resolves.toMatchObject({ outcome: 'fault', completedHttp: false });
    await vi.advanceTimersByTimeAsync(80);
    expect(socket.destroy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('resolves timeout immediately when the HTTP/2 stream is already closed', async () => {
    const { req, res, socket } = mockPair();
    (req as { httpVersion?: string; stream?: { closed: boolean } }).httpVersion = '2.0';
    (req as { stream?: { closed: boolean } }).stream = { closed: true };
    await expect(deliverWithFault({
      req, res, fault: 'timeout',
      behavior: { delayMs: 0, jitterMs: 0, longRunningMs: 50 },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'x',
    })).resolves.toMatchObject({ outcome: 'fault', completedHttp: false });
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  it('resolves timeout immediately when the socket is already destroyed', async () => {
    vi.useFakeTimers();
    const { req, res, socket } = mockPair();
    (socket as { destroyed?: boolean }).destroyed = true;
    const pending = deliverWithFault({
      req, res, fault: 'timeout',
      behavior: { delayMs: 0, jitterMs: 0, longRunningMs: 50 },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'x',
    });
    await expect(pending).resolves.toMatchObject({ outcome: 'fault', completedHttp: false });
    await vi.advanceTimersByTimeAsync(50);
    expect(socket.destroy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('aborts dribble when the socket is already destroyed', async () => {
    const { req, res, socket, resMock } = mockPair();
    (socket as { destroyed?: boolean }).destroyed = true;
    await expect(deliverWithFault({
      req, res, fault: 'dribble',
      behavior: { delayMs: 0, jitterMs: 0, chunkSchedule: [{ afterMs: 10, body: 'a' }] },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'a',
    })).resolves.toMatchObject({ outcome: 'fault', completedHttp: false });
    expect(resMock.writeHead).not.toHaveBeenCalled();
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('aborts dribble when writeHead throws and when end throws after the last chunk', async () => {
    vi.useFakeTimers();
    const headPair = mockPair();
    headPair.resMock.writeHead = vi.fn(() => { throw new Error('headers failed'); });
    await expect(deliverWithFault({
      req: headPair.req, res: headPair.res, fault: 'dribble',
      behavior: { delayMs: 0, jitterMs: 0, chunkSchedule: [{ afterMs: 10, body: 'a' }] },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'a',
    })).resolves.toMatchObject({ completedHttp: false });

    const endPair = mockPair();
    endPair.resMock.end = vi.fn(() => { throw new Error('end failed'); });
    const pending = deliverWithFault({
      req: endPair.req, res: endPair.res, fault: 'dribble',
      behavior: { delayMs: 0, jitterMs: 0, chunkSchedule: [{ afterMs: 5, body: 'z' }] },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'z',
    });
    await vi.advanceTimersByTimeAsync(10);
    await expect(pending).resolves.toMatchObject({ completedHttp: true });
    vi.useRealTimers();
  });

  it('skips dribble writes after the client has disconnected', async () => {
    vi.useFakeTimers();
    const { req, res, socket, resMock } = mockPair();
    resMock.writableEnded = true;
    const pending = deliverWithFault({
      req, res, fault: 'dribble',
      behavior: { delayMs: 0, jitterMs: 0, chunkSchedule: [{ afterMs: 5, body: 'a' }] },
      longRunningMaxMs: 1000,
      status: 200, headers: {}, body: 'a',
    });
    socket.emit('close');
    await vi.advanceTimersByTimeAsync(20);
    await expect(pending).resolves.toMatchObject({ completedHttp: false });
    expect(resMock.write).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
