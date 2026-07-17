/**
 * @vitest-environment node
 */
import http from 'node:http';
import https from 'node:https';
import { PassThrough } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';

const uploadBusboyMode = vi.hoisted(() => ({ fileStreamError: false, lateError: false }));

vi.mock('busboy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('busboy')>();
  const { PassThrough, Readable } = await import('node:stream');
  return {
    default: (headers: Parameters<typeof actual.default>[0]) => {
      if (uploadBusboyMode.lateError) {
        const bb = new PassThrough();
        queueMicrotask(() => {
          bb.emit('field', 'operations', '{}');
          bb.emit('field', 'map', '{}');
          bb.emit('finish');
          setTimeout(() => bb.emit('error', new Error('late parse error')), 20);
        });
        return bb;
      }
      if (!uploadBusboyMode.fileStreamError) {
        return actual.default(headers);
      }
      const bb = new PassThrough();
      queueMicrotask(() => {
        bb.emit('field', 'operations', '{}');
        bb.emit('field', 'map', '{}');
        const stream = new Readable({
          read() {
            this.push(null);
          },
        });
        bb.emit('file', '0', stream, { filename: 'bad.txt', mimeType: 'text/plain' });
        queueMicrotask(() => {
          stream.emit('error', new Error('file read failed'));
          queueMicrotask(() => bb.emit('finish'));
        });
      });
      return bb;
    },
  };
});

import { registerUploadRoute } from './uploadRouteHandler.js';

let mockPort: number;
let mockServer: http.Server;
let mockHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeAll(() => new Promise<void>((resolve) => {
  mockServer = http.createServer((req, res) => mockHandler?.(req, res));
  mockServer.listen(0, '127.0.0.1', () => {
    mockPort = (mockServer.address() as { port: number }).port;
    resolve();
  });
}));

afterAll(() => new Promise<void>((resolve) => { mockServer.close(() => resolve()); }));

afterEach(() => {
  uploadBusboyMode.fileStreamError = false;
  uploadBusboyMode.lateError = false;
  vi.restoreAllMocks();
});

function createMockClientRequest() {
  return Object.assign(new PassThrough(), {
    setNoDelay: vi.fn(),
    setSocketKeepAlive: vi.fn(),
    setTimeout: vi.fn(),
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    removeHeader: vi.fn(),
    abort: vi.fn(),
    destroy: vi.fn(),
  }) as ReturnType<typeof http.request>;
}

function mockUpstreamResponse(
  onOpts?: (opts: http.RequestOptions) => void,
  responseInit: { statusCode?: number; headers?: Record<string, string> } = {},
  afterResponse?: (reqStream: ReturnType<typeof createMockClientRequest>) => void,
) {
  const originalRequest = http.request.bind(http);
  return vi.spyOn(http, 'request').mockImplementation((opts, cb) => {
    const requestOpts = opts as http.RequestOptions;
    const isUploadProxy = requestOpts.method === 'POST'
      && typeof requestOpts.headers?.['content-type'] === 'string'
      && requestOpts.headers['content-type'].includes('multipart/form-data');
    if (!isUploadProxy) {
      return originalRequest(opts, cb);
    }

    onOpts?.(requestOpts);
    const reqStream = createMockClientRequest();
    reqStream.on('error', () => { /* swallow test-only upstream errors */ });
    const incoming = {
      statusCode: responseInit.statusCode,
      headers: responseInit.headers ?? { 'content-type': 'application/json' },
      pipe(dest: NodeJS.WritableStream) {
        if (typeof (dest as NodeJS.WritableStream & { end?: (chunk?: unknown) => void }).end === 'function') {
          (dest as NodeJS.WritableStream & { end: (chunk?: unknown) => void }).end('{"data":{"ok":true}}');
        }
        return dest;
      },
    };
    process.nextTick(() => {
      cb?.(incoming as unknown as http.IncomingMessage);
      afterResponse?.(reqStream);
    });
    return reqStream;
  });
}

function buildApp(onLog = vi.fn()) {
  const router = express.Router();
  registerUploadRoute(router, onLog);
  const app = express();
  app.use(router);
  return { app, onLog };
}

describe('registerUploadRoute', () => {
  it('returns 400 when Content-Type is not multipart', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
  });

  it('returns 400 when endpoint is missing', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/endpoint/);
  });

  it('returns 400 for invalid endpoint URL', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', 'not-a-url')
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Invalid endpoint/);
  });

  it('accepts endpoint from query param', async () => {
    mockHandler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    };
    const onLog = vi.fn();
    const { app } = buildApp(onLog);
    await request(app)
      .post(`/api/graphql/upload?endpoint=http://127.0.0.1:${mockPort}/graphql`)
      .field('operations', '{}')
      .field('map', '{}');
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info', message: expect.stringContaining('relaying') }),
    );
  });

  it('proxies multipart fields and file to upstream', async () => {
    let capturedContentType = '';
    let capturedBody = Buffer.alloc(0);
    mockHandler = (req, res) => {
      capturedContentType = req.headers['content-type'] ?? '';
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        capturedBody = Buffer.concat(chunks);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { upload: 'ok' } }));
      });
    };

    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .set('authorization', 'Bearer upload-token')
      .field('operations', '{"query":"mutation { upload }"}')
      .field('map', '{"0":["variables.file"]}')
      .attach('0', Buffer.from('file-bytes'), { filename: 'test.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.data.upload).toBe('ok');
    expect(capturedContentType).toMatch(/multipart\/form-data/);
    expect(capturedBody.toString('utf8')).toContain('operations');
    expect(capturedBody.toString('utf8')).toContain('file-bytes');
  });

  it('returns 502 when upstream connection fails', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', 'http://127.0.0.1:29998/graphql')
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('GQL_UPSTREAM_ERROR');
  });

  it('logs upstream errors via onLog', async () => {
    const onLog = vi.fn();
    const { app } = buildApp(onLog);
    await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', 'http://127.0.0.1:29997/graphql')
      .field('operations', '{}')
      .field('map', '{}');
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('upstream error') }),
    );
  });

  it('returns 400 when busboy cannot parse the request body', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('Content-Type', 'multipart/form-data; boundary=----bad')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .send('not-valid-multipart-data');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Multipart parse error/);
  });

  it('uses https transport for https endpoints', async () => {
    const onLog = vi.fn();
    const { app } = buildApp(onLog);
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', 'https://127.0.0.1:29996/graphql')
      .field('operations', '{}')
      .field('map', '{}');
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info' }),
    );
    expect([502, 400]).toContain(res.status);
  });

  it('logs busboy parse errors via onLog', async () => {
    const onLog = vi.fn();
    const { app } = buildApp(onLog);
    await request(app)
      .post('/api/graphql/upload')
      .set('Content-Type', 'multipart/form-data; boundary=----bad')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .send('not-valid-multipart-data');
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('parse error') }),
    );
  });

  it('returns 400 when Content-Type header is completely absent', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .send('plain-body');
    expect(res.status).toBe(400);
  });

  it('skips transfer-encoding header in upstream response', async () => {
    mockHandler = (_req, res) => {
      res.writeHead(200, {
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
        'x-upload': 'yes',
      });
      res.end('{"data":{"ok":true}}');
    };
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(200);
    expect(res.headers['x-upload']).toBe('yes');
  });

  it('rejects empty Content-Type header as non-multipart', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('Content-Type', '')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .send('body');
    expect(res.status).toBe(400);
  });

  it('proxies upload through https transport with default port 443', async () => {
    const requestSpy = vi.spyOn(https, 'request').mockImplementation((_opts, cb) => {
      const opts = _opts as { port?: number };
      expect(opts.port).toBe(443);
      const reqStream = createMockClientRequest();
      const incoming = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        pipe(dest: NodeJS.WritableStream) {
          (dest as NodeJS.WritableStream & { end: (chunk?: unknown) => void }).end('{"data":{"uploaded":true}}');
          return dest;
        },
      };
      process.nextTick(() => {
        cb?.(incoming as unknown as http.IncomingMessage);
      });
      return reqStream;
    });

    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', 'https://graphql.example.com/upload')
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(200);
    expect(res.body.data.uploaded).toBe(true);
    expect(requestSpy).toHaveBeenCalled();
  });

  it('applies skipTlsVerify agent for https upload when x-gql-tls-config is set', async () => {
    const tlsConfig = Buffer.from(JSON.stringify({ skipTlsVerify: true }), 'utf8').toString('base64');
    const requestSpy = vi.spyOn(https, 'request').mockImplementation((opts, cb) => {
      expect((opts as { agent?: { options?: { rejectUnauthorized?: boolean } } }).agent?.options?.rejectUnauthorized).toBe(false);
      const reqStream = createMockClientRequest();
      const incoming = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        pipe(dest: NodeJS.WritableStream) {
          (dest as NodeJS.WritableStream & { end: (chunk?: unknown) => void }).end('{"data":{"ok":true}}');
          return dest;
        },
      };
      process.nextTick(() => {
        cb?.(incoming as unknown as http.IncomingMessage);
      });
      return reqStream;
    });

    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', 'https://localhost:4443/graphql')
      .set('x-gql-tls-config', tlsConfig)
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(200);
    expect(requestSpy).toHaveBeenCalled();
  });

  it('applies mTLS agent for https upload when x-gql-tls-config includes client PEM', async () => {
    const tlsConfig = Buffer.from(JSON.stringify({
      caCert: '-----BEGIN CERTIFICATE-----\nca',
      clientCert: '-----BEGIN CERTIFICATE-----\nclient',
      clientKey: '-----BEGIN PRIVATE KEY-----\nkey',
    }), 'utf8').toString('base64');
    const requestSpy = vi.spyOn(https, 'request').mockImplementation((opts, cb) => {
      const agent = (opts as { agent?: { options?: { cert?: string; key?: string; ca?: string } } }).agent;
      expect(agent?.options?.cert).toContain('BEGIN CERTIFICATE');
      expect(agent?.options?.key).toContain('BEGIN PRIVATE KEY');
      expect(agent?.options?.ca).toContain('BEGIN CERTIFICATE');
      const reqStream = createMockClientRequest();
      const incoming = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        pipe(dest: NodeJS.WritableStream) {
          (dest as NodeJS.WritableStream & { end: (chunk?: unknown) => void }).end('{"data":{"ok":true}}');
          return dest;
        },
      };
      process.nextTick(() => {
        cb?.(incoming as unknown as http.IncomingMessage);
      });
      return reqStream;
    });

    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', 'https://localhost:4445/graphql')
      .set('x-gql-tls-config', tlsConfig)
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(200);
    expect(requestSpy).toHaveBeenCalled();
  });

  it('uses default http port 80 when endpoint omits port', async () => {
    mockUpstreamResponse((opts) => {
      expect(opts.hostname).toBe('upload-default-port.test');
      expect(opts.port).toBe(80);
    });
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', 'http://upload-default-port.test/graphql')
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(200);
  });

  it('logs file stream read errors via onLog', async () => {
    uploadBusboyMode.fileStreamError = true;
    const onLog = vi.fn();
    mockUpstreamResponse();
    const { app } = buildApp(onLog);
    await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .field('operations', '{}')
      .field('map', '{}');
    await new Promise((resolve) => { setTimeout(resolve, 30); });
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('stream read error') }),
    );
  });

  it('rejects requests with no Content-Type via raw HTTP', async () => {
    const { app } = buildApp();
    await new Promise<void>((resolve, reject) => {
      const server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        const req = http.request({
          method: 'POST',
          hostname: '127.0.0.1',
          port: addr.port,
          path: '/api/graphql/upload',
          headers: { 'x-graphql-endpoint': `http://127.0.0.1:${mockPort}/graphql` },
        }, (res) => {
          let body = '';
          res.on('data', (c) => { body += c; });
          res.on('end', () => {
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(body).error.code).toBe('GQL_INVALID_REQUEST');
            server.close(() => resolve());
          });
        });
        req.on('error', reject);
        req.end('plain-body');
      });
    });
  });

  it('skips non-string request header values when forwarding to upstream', async () => {
    let capturedHeaders: http.IncomingHttpHeaders = {};
    mockHandler = (req, res) => {
      capturedHeaders = req.headers;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    };
    const router = express.Router();
    registerUploadRoute(router, vi.fn());
    const app = express();
    app.use((req, _res, next) => {
      req.headers['x-array-header'] = ['a', 'b'] as unknown as string;
      next();
    });
    app.use(router);
    await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .set('authorization', 'Bearer tok')
      .field('operations', '{}')
      .field('map', '{}');
    expect(capturedHeaders['authorization']).toBe('Bearer tok');
    expect(capturedHeaders['x-array-header']).toBeUndefined();
  });

  it('does not send 502 when upstream error occurs after headers were sent', async () => {
    mockUpstreamResponse(undefined, {}, (reqStream) => {
      reqStream.emit('error', new Error('mid-stream fail'));
    });
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(200);
  });

  it('defaults upstream status to 200 when statusCode is missing', async () => {
    mockUpstreamResponse(undefined, {
      statusCode: undefined,
      headers: { 'content-type': 'application/json', 'x-custom': 'yes' },
    });
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(200);
    expect(res.headers['x-custom']).toBe('yes');
  });

  it('logs busboy parse errors without overwriting an already sent response', async () => {
    uploadBusboyMode.lateError = true;
    const onLog = vi.fn();
    mockUpstreamResponse();
    const { app } = buildApp(onLog);
    const res = await request(app)
      .post('/api/graphql/upload')
      .set('x-graphql-endpoint', `http://127.0.0.1:${mockPort}/graphql`)
      .field('operations', '{}')
      .field('map', '{}');
    expect(res.status).toBe(200);
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('parse error') }),
    );
  });
});
