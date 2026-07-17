/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { registerSseRoutes } from './sseRouteHandler.js';

function createMockClientRequest() {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    on(event: string, fn: (...args: unknown[]) => void) {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(fn);
      return this;
    },
    end: vi.fn(),
    destroy: vi.fn(),
    setNoDelay: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const fn of handlers[event] ?? []) fn(...args);
    },
  } as unknown as http.ClientRequest;
}

function mockTransportResponse(
  requestSpy: ReturnType<typeof vi.spyOn>,
  incoming: Record<string, unknown>,
  assertAgent?: (opts: unknown) => void,
) {
  requestSpy.mockImplementation((opts, cb) => {
    assertAgent?.(opts);
    const reqStream = createMockClientRequest();
    process.nextTick(() => {
      cb?.(incoming as unknown as http.IncomingMessage);
    });
    return reqStream;
  });
}

function mockSuccessSse(requestSpy: ReturnType<typeof vi.spyOn>, assertAgent?: (opts: unknown) => void) {
  mockTransportResponse(requestSpy, {
    statusCode: 200,
    headers: {},
    on: vi.fn(),
    pipe(dest: NodeJS.WritableStream) {
      (dest as NodeJS.WritableStream & { end: (chunk?: unknown) => void }).end();
      return dest;
    },
  }, assertAgent);
}

function buildApp(onLog?: (line: unknown) => void) {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerSseRoutes(router, onLog);
  app.use(router);
  return app;
}

describe('registerSseRoutes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/graphql/sse applies skipTlsVerify agent for https upstream', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    mockSuccessSse(requestSpy, (opts) => {
      const agent = (opts as { agent?: https.Agent }).agent;
      expect(agent).toBeInstanceOf(https.Agent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((agent as any).options.rejectUnauthorized).toBe(false);
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/graphql/sse')
      .send({
        endpoint: 'https://localhost:4443/graphql/stream',
        query: 'subscription { ping }',
        skipTlsVerify: true,
      });

    expect(res.status).toBe(200);
    expect(requestSpy).toHaveBeenCalled();
  });

  it('GET /api/graphql/sse still accepts query-string skipTlsVerify', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    mockSuccessSse(requestSpy);

    const app = buildApp();
    const res = await request(app)
      .get('/api/graphql/sse')
      .query({
        endpoint: 'https://localhost:4443/graphql/stream',
        query: 'subscription { ping }',
        skipTlsVerify: 'true',
      });

    expect(res.status).toBe(200);
    expect(requestSpy).toHaveBeenCalled();
  });

  it('GET /api/graphql/sse rejects PEM TLS fields in query string', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/graphql/sse')
      .query({
        endpoint: 'https://localhost:4443/graphql/stream',
        query: 'subscription { ping }',
        clientCert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
    expect(res.body.error.message).toContain('PEM TLS fields');
  });

  it('GET returns 400 when endpoint param missing', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/graphql/sse').query({ query: 'subscription { ping }' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('endpoint');
  });

  it('GET returns 400 when query param missing', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/graphql/sse').query({ endpoint: 'https://ex.com/gql' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('query');
  });

  it('GET returns 400 for invalid endpoint URL', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/graphql/sse')
      .query({ endpoint: 'not-a-url', query: 'subscription { ping }' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Invalid endpoint URL');
  });

  it('normalises wss:// endpoint to https transport', async () => {
    const httpsSpy = vi.spyOn(https, 'request');
    mockSuccessSse(httpsSpy, (opts) => {
      expect((opts as { protocol?: string }).protocol).toBeUndefined();
      expect((opts as { hostname?: string }).hostname).toBe('localhost');
    });

    const app = buildApp();
    await request(app).get('/api/graphql/sse').query({
      endpoint: 'wss://localhost:4443/graphql/stream',
      query: 'subscription { ping }',
    });
    expect(httpsSpy).toHaveBeenCalled();
  });

  it('normalises ws:// endpoint to http upstream transport', async () => {
    const originalHttpRequest = http.request.bind(http);
    const httpSpy = vi.spyOn(http, 'request').mockImplementation((opts, cb) => {
      const hostname = typeof opts === 'object' && opts && 'hostname' in opts
        ? String((opts as http.RequestOptions).hostname)
        : '';
      if (hostname === 'localhost') {
        const reqStream = createMockClientRequest();
        process.nextTick(() => {
          cb?.({
            statusCode: 200,
            on: vi.fn(),
            pipe(dest: NodeJS.WritableStream) {
              (dest as NodeJS.WritableStream & { end: (chunk?: unknown) => void }).end();
              return dest;
            },
          } as unknown as http.IncomingMessage);
        });
        return reqStream;
      }
      return originalHttpRequest(opts as http.RequestOptions, cb as (res: http.IncomingMessage) => void);
    });

    const app = buildApp();
    const res = await request(app).get('/api/graphql/sse').query({
      endpoint: 'ws://localhost:4010/graphql/stream',
      query: 'subscription { ping }',
    });
    expect(res.status).toBe(200);
    expect(httpSpy).toHaveBeenCalled();
    httpSpy.mockRestore();
  });

  it('GET forwards variables and operationName query params', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    mockSuccessSse(requestSpy, (opts) => {
      const path = (opts as { path?: string }).path ?? '';
      expect(path).toContain('variables=');
      expect(path).toContain('operationName=PingSub');
    });

    const app = buildApp();
    await request(app).get('/api/graphql/sse').query({
      endpoint: 'https://localhost:4443/graphql/stream',
      query: 'subscription { ping }',
      variables: '{"id":"1"}',
      operationName: 'PingSub',
    });
  });

  it('POST forwards JSON variables and extra headers', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    mockSuccessSse(requestSpy, (opts) => {
      const headers = (opts as { headers?: Record<string, string> }).headers ?? {};
      expect(headers.authorization).toBe('Bearer tok');
      const path = (opts as { path?: string }).path ?? '';
      expect(path).toContain('variables=');
    });

    const app = buildApp();
    await request(app).post('/api/graphql/sse').send({
      endpoint: 'https://localhost:4443/graphql/stream',
      query: 'subscription { ping }',
      variables: { id: '1' },
      operationName: 'PingSub',
      headers: { Authorization: 'Bearer tok' },
      caCert: '-----BEGIN CERTIFICATE-----\nca',
    });
  });

  it('POST returns 400 when endpoint or query missing', async () => {
    const app = buildApp();
    const noEndpoint = await request(app).post('/api/graphql/sse').send({ query: 'sub { ping }' });
    expect(noEndpoint.status).toBe(400);
    const noQuery = await request(app).post('/api/graphql/sse').send({ endpoint: 'https://ex.com/gql' });
    expect(noQuery.status).toBe(400);
  });

  it('writes SSE error event when upstream returns non-200', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    mockTransportResponse(requestSpy, {
      statusCode: 502,
      resume: vi.fn(),
    });

    const app = buildApp();
    const res = await request(app).post('/api/graphql/sse').send({
      endpoint: 'https://localhost:4443/graphql/stream',
      query: 'subscription { ping }',
    });
    expect(res.status).toBe(200);
    expect(res.text).toContain('event: error');
    expect(res.text).toContain('HTTP 502');
  });

  it('handles upstream response stream error after headers sent', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    const incoming = new EventEmitter() as EventEmitter & {
      statusCode: number;
      pipe: ReturnType<typeof vi.fn>;
    };
    incoming.statusCode = 200;
    incoming.pipe = vi.fn();
    requestSpy.mockImplementation((_opts, cb) => {
      const reqStream = createMockClientRequest();
      process.nextTick(() => {
        cb?.(incoming as unknown as http.IncomingMessage);
        incoming.emit('error', new Error('stream broke'));
      });
      return reqStream;
    });

    const app = buildApp();
    const res = await request(app).post('/api/graphql/sse').send({
      endpoint: 'https://localhost:4443/graphql/stream',
      query: 'subscription { ping }',
    });
    expect(res.status).toBe(200);
    expect(res.text).toContain('stream broke');
  });

  it('handles upstream request error before headers sent', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    requestSpy.mockImplementation(() => {
      const reqStream = createMockClientRequest();
      process.nextTick(() => {
        reqStream.emit('error', new Error('connect refused'));
      });
      return reqStream;
    });

    const app = buildApp();
    const res = await request(app).post('/api/graphql/sse').send({
      endpoint: 'https://localhost:4443/graphql/stream',
      query: 'subscription { ping }',
    });
    expect(res.status).toBe(200);
    expect(res.text).toContain('connect refused');
  });

  it('destroys upstream request when client disconnects', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    const reqStream = createMockClientRequest();
    requestSpy.mockImplementation((_opts, cb) => {
      process.nextTick(() => {
        cb?.({
          statusCode: 200,
          on: vi.fn(),
          pipe: vi.fn(),
        } as unknown as http.IncomingMessage);
      });
      return reqStream;
    });

    const app = buildApp();
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    const clientReq = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/graphql/sse?endpoint=https%3A%2F%2Flocalhost%2Fgraphql&query=sub',
      method: 'GET',
    });
    clientReq.end();
    await new Promise((r) => setTimeout(r, 50));
    clientReq.destroy();
    await new Promise((r) => setTimeout(r, 50));
    expect(reqStream.destroy).toHaveBeenCalled();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('collectForwardHeaders skips hop-by-hop headers and sets SSE accept on upstream', async () => {
    const requestSpy = vi.spyOn(https, 'request');
    mockSuccessSse(requestSpy, (opts) => {
      const headers = (opts as { headers?: Record<string, string> }).headers ?? {};
      expect(headers.connection).toBeUndefined();
      expect(headers.accept).toBe('text/event-stream');
      expect(headers['cache-control']).toBe('no-cache');
    });

    const app = buildApp();
    await request(app)
      .post('/api/graphql/sse')
      .set('Connection', 'close')
      .set('X-Custom', 'val')
      .send({
        endpoint: 'https://localhost:4443/graphql/stream',
        query: 'subscription { ping }',
      });
  });

  it('invokes onLog for upstream request errors', async () => {
    const onLog = vi.fn();
    const requestSpy = vi.spyOn(https, 'request');
    requestSpy.mockImplementation(() => {
      const reqStream = createMockClientRequest();
      process.nextTick(() => reqStream.emit('error', new Error('upstream fail')));
      return reqStream;
    });

    const app = buildApp(onLog);
    await request(app).post('/api/graphql/sse').send({
      endpoint: 'https://localhost:4443/graphql/stream',
      query: 'subscription { ping }',
    });
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('upstream fail'),
      }),
    );
  });
});
