/**
 * @vitest-environment node
 */
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { probeApiMockEcho } from './echoHealthProbe';

describe('probeApiMockEcho', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve()));
    });
    server = undefined;
  });

  function listen(handler: Parameters<typeof createServer>[0]): Promise<number> {
    return new Promise((resolve, reject) => {
      server = createServer(handler);
      server.listen(0, '127.0.0.1', () => {
        const addr = server!.address();
        if (addr && typeof addr === 'object') resolve(addr.port);
        else reject(new Error('no port'));
      });
    });
  }

  it('returns ok on HTTP 200', async () => {
    const port = await listen((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    await expect(probeApiMockEcho(1000, port)).resolves.toEqual({ ok: true, statusCode: 200, reason: undefined });
  });

  it('returns down on HTTP 503', async () => {
    const port = await listen((_req, res) => {
      res.writeHead(503);
      res.end('no');
    });
    await expect(probeApiMockEcho(1000, port)).resolves.toEqual({
      ok: false,
      statusCode: 503,
      reason: 'http_503',
    });
  });

  it('returns down when nothing listens', async () => {
    const result = await probeApiMockEcho(400, 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('returns down when the probe times out', async () => {
    const port = await listen((_req, _res) => { /* hold the socket */ });
    await expect(probeApiMockEcho(50, port)).resolves.toEqual({ ok: false, reason: 'timeout' });
  });
});
