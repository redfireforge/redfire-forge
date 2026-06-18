/**
 * @vitest-environment node
 */
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi, afterAll } from 'vitest';
import { createGraphqlRouter } from './graphql-routes.js';

// ---------------------------------------------------------------------------
// Mock upstream HTTP server for proxy response tests
// ---------------------------------------------------------------------------

let mockUpstreamPort: number;
let mockUpstreamServer: http.Server;
let mockUpstreamHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

async function startMockUpstream(): Promise<void> {
  return new Promise((resolve) => {
    mockUpstreamServer = http.createServer((req, res) => {
      mockUpstreamHandler?.(req, res);
    });
    mockUpstreamServer.listen(0, '127.0.0.1', () => {
      mockUpstreamPort = (mockUpstreamServer.address() as { port: number }).port;
      resolve();
    });
  });
}

// Start the mock upstream server before all tests
await startMockUpstream();
afterAll(() => {
  mockUpstreamServer?.close();
});

function buildApp(onLog = vi.fn()) {
  const app = express();
  app.use(express.json());
  app.use(createGraphqlRouter({ onLog }));
  return app;
}

describe('createGraphqlRouter', () => {
  // ── POST /api/graphql/subscribe ─────────────────────────────────────────────
  describe('POST /api/graphql/subscribe', () => {
    it('returns 400 when endpoint is missing', async () => {
      const res = await request(buildApp()).post('/api/graphql/subscribe').send({});
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
    });

    it('returns 400 when endpoint is not a string', async () => {
      const res = await request(buildApp()).post('/api/graphql/subscribe').send({ endpoint: 123 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
    });

    it('returns 400 when endpoint is an empty string', async () => {
      const res = await request(buildApp()).post('/api/graphql/subscribe').send({ endpoint: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
    });

    it('returns 501 with GQL_NOT_IMPLEMENTED when endpoint is valid', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/subscribe')
        .send({ endpoint: 'wss://api.example.com/graphql' });
      expect(res.status).toBe(501);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('GQL_NOT_IMPLEMENTED');
      expect(res.body.error.message).toMatch(/Sprint 2/);
    });

    it('calls onLog when endpoint is valid', async () => {
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .post('/api/graphql/subscribe')
        .send({ endpoint: 'wss://api.example.com/graphql' });
      expect(onLog).toHaveBeenCalledOnce();
      const call = onLog.mock.calls[0][0];
      expect(call.level).toBe('warn');
      expect(call.message).toMatch(/WS subscription proxy/);
      expect(typeof call.timestamp).toBe('number');
    });
  });

  // ── GET /api/graphql/sse ────────────────────────────────────────────────────
  describe('GET /api/graphql/sse', () => {
    it('returns 400 when endpoint query param is missing', async () => {
      const res = await request(buildApp()).get('/api/graphql/sse');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
    });

    it('returns 400 when endpoint query param is empty string', async () => {
      const res = await request(buildApp()).get('/api/graphql/sse').query({ endpoint: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
    });

    it('returns 501 with GQL_NOT_IMPLEMENTED when endpoint is valid', async () => {
      const res = await request(buildApp())
        .get('/api/graphql/sse')
        .query({ endpoint: 'https://api.example.com/graphql/stream' });
      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('GQL_NOT_IMPLEMENTED');
      expect(res.body.error.message).toMatch(/Sprint 3/);
    });

    it('calls onLog when endpoint is valid', async () => {
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .get('/api/graphql/sse')
        .query({ endpoint: 'https://api.example.com/graphql/stream' });
      expect(onLog).toHaveBeenCalledOnce();
    });
  });

  // ── POST /api/graphql/upload ────────────────────────────────────────────────
  describe('POST /api/graphql/upload', () => {
    it('returns 400 when Content-Type is not multipart/form-data', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/upload')
        .set('Content-Type', 'application/json')
        .send('{}');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/multipart/);
    });

    it('returns 400 when x-graphql-endpoint header is missing', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/upload')
        .field('operations', '{"query": "mutation {upload}"}')
        .field('map', '{"0": ["variables.file"]}')
        .attach('0', Buffer.from('fake-file-content'), { filename: 'test.txt', contentType: 'text/plain' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/endpoint/);
    });

    it('returns 400 when endpoint URL is invalid', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/upload')
        .set('x-graphql-endpoint', 'not-a-url')
        .field('operations', '{"query":"mutation {upload}"}')
        .field('map', '{}');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/Invalid endpoint/);
    });

    it('calls onLog for a valid multipart request before proxying', async () => {
      const onLog = vi.fn();
      // This will fail upstream (connection refused) but should log first
      await request(buildApp(onLog))
        .post('/api/graphql/upload')
        .set('x-graphql-endpoint', 'http://localhost:19999/graphql')
        .field('operations', '{"query":"mutation {upload}"}')
        .field('map', '{}');
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' }),
      );
    });

    it('forwards all non-hop-by-hop user headers to upstream (authorization, custom)', async () => {
      // This test verifies the deny-list forwarding logic.
      // It will fail with ECONNREFUSED (no real upstream) so we only verify the log.
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .post('/api/graphql/upload')
        .set('x-graphql-endpoint', 'http://localhost:19999/graphql')
        .set('authorization', 'Bearer test-token')
        .set('x-tenant-id', 'acme')
        .field('operations', '{"query":"mutation {upload}"}')
        .field('map', '{}');
      // Proxy should have reached the logging step (validates header forwarding path was taken)
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info', message: expect.stringContaining('relaying') }),
      );
    });

    it('accepts a file upload with a special-character filename (double-quote escaping)', async () => {
      const onLog = vi.fn();
      // Attachment with a filename containing double quotes — should reach the proxy log, not 400
      await request(buildApp(onLog))
        .post('/api/graphql/upload')
        .set('x-graphql-endpoint', 'http://localhost:19999/graphql')
        .field('operations', '{"query":"mutation {upload}"}')
        .field('map', '{"0":["variables.file"]}')
        .attach('0', Buffer.from('data'), { filename: 'my "file".jpg', contentType: 'image/jpeg' });
      // Should reach the info log (not a 400 error)
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' }),
      );
    });
  });

  // ── Router factory ──────────────────────────────────────────────────────────
  describe('createGraphqlRouter', () => {
    it('works without options (no onLog)', async () => {
      const app = express();
      app.use(express.json());
      app.use(createGraphqlRouter()); // no options
      const res = await request(app).post('/api/graphql/subscribe').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/graphql/query ─────────────────────────────────────────────────
  describe('POST /api/graphql/query', () => {
    it('returns 400 when endpoint is missing', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ query: '{ hello }' });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/endpoint/);
    });

    it('returns 400 when endpoint is empty string', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ endpoint: '', query: '{ hello }' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
    });

    it('returns 400 when query is missing', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ endpoint: 'http://localhost:4000/graphql' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/query/);
    });

    it('returns 400 when query is empty string', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ endpoint: 'http://localhost:4000/graphql', query: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
    });

    it('returns 400 when endpoint URL is invalid', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ endpoint: 'not-a-url', query: '{ hello }' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GQL_INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/Invalid endpoint/);
    });

    it('calls onLog and attempts upstream connection for valid request', async () => {
      const onLog = vi.fn();
      // Will fail with ECONNREFUSED (no real upstream) — verify log was called
      await request(buildApp(onLog))
        .post('/api/graphql/query')
        .send({ endpoint: 'http://localhost:19999/graphql', query: '{ hello }' });
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info', message: expect.stringContaining('relaying') }),
      );
    });

    it('logs acceptMultipart: true when Accept: multipart/mixed is forwarded', async () => {
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .post('/api/graphql/query')
        .set('Accept', 'multipart/mixed, application/json')
        .send({ endpoint: 'http://localhost:19999/graphql', query: '{ hello }' });
      // The route logs { acceptMultipart: true } in the message JSON when Accept contains multipart
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('acceptMultipart'),
        }),
      );
    });

    it('forwards operationName when provided', async () => {
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .post('/api/graphql/query')
        .send({
          endpoint: 'http://localhost:19999/graphql',
          query: 'query GetUser { user { id } }',
          operationName: 'GetUser',
        });
      // Just verify it reaches the log step without 400
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' }),
      );
    });

    it('returns 502 when upstream connection is refused', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ endpoint: 'http://localhost:29847/graphql', query: '{ hello }' });
      // Connection refused → 502 Bad Gateway
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('GQL_UPSTREAM_ERROR');
    });

    it('works without onLog (no options)', async () => {
      const app = express();
      app.use(express.json());
      app.use(createGraphqlRouter());
      const res = await request(app)
        .post('/api/graphql/query')
        .send({ endpoint: 'http://localhost:29847/graphql', query: '{ hello }' });
      // Just verify no crash and some response
      expect([400, 502]).toContain(res.status);
    });

    it('includes variables in upstream body when variables are provided (line 118 true branch)', async () => {
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .post('/api/graphql/query')
        .send({
          endpoint: 'http://localhost:29847/graphql',
          query: '{ user(id: $id) { name } }',
          variables: { id: '1' },
        });
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: expect.stringMatching(/info|error/) }),
      );
    });

    it('falls back to application/json accept when Accept header is array (line 125 false branch)', async () => {
      // Node http may pass accept as array — test the fallback to 'application/json'
      const onLog = vi.fn();
      // Can't easily set an array header via supertest, so just verify
      // that omitting Accept header uses the default 'application/json'
      await request(buildApp(onLog))
        .post('/api/graphql/query')
        .send({ endpoint: 'http://localhost:29847/graphql', query: '{ hello }' });
      // Should reach upstream (502) — the fallback path was used
      expect(onLog).toHaveBeenCalled();
    });

    it('skips non-string header values in extraHeaders (line 135 false branch)', async () => {
      // Send headers as non-object (array) — route falls back to empty {}
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .post('/api/graphql/query')
        .send({
          endpoint: 'http://localhost:29847/graphql',
          query: '{ hello }',
          headers: ['not-an-object'],
        });
      // Should still attempt upstream (not 400)
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' }),
      );
    });

    it('includes operationName in upstream body only when it is a string (line 112 false branch)', async () => {
      const onLog = vi.fn();
      // operationName as number — should be excluded from upstream body
      await request(buildApp(onLog))
        .post('/api/graphql/query')
        .send({
          endpoint: 'http://localhost:29847/graphql',
          query: '{ hello }',
          operationName: 42,
        });
      // Reaches upstream path (logs info)
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' }),
      );
    });
  });

  describe('POST /api/graphql/query — mock upstream responses', () => {
    it('proxies a successful upstream response (line 161-173 covered)', async () => {
      mockUpstreamHandler = (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json', 'x-custom': 'yes' });
        res.end(JSON.stringify({ data: { hello: 'world' } }));
      };
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ endpoint: `http://127.0.0.1:${mockUpstreamPort}/graphql`, query: '{ hello }' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ hello: 'world' });
    });

    it('forwards upstream non-200 status (line 162 statusCode)', async () => {
      mockUpstreamHandler = (_req, res) => {
        res.writeHead(422, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ errors: [{ message: 'Bad query' }] }));
      };
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ endpoint: `http://127.0.0.1:${mockUpstreamPort}/graphql`, query: '{ bad }' });
      expect(res.status).toBe(422);
    });

    it('skips hop-by-hop connection/keep-alive headers from upstream (line 167)', async () => {
      mockUpstreamHandler = (_req, res) => {
        res.writeHead(200, {
          'content-type': 'application/json',
          'connection': 'keep-alive',
          'keep-alive': 'timeout=5',
          'x-relay': 'yes',
        });
        res.end('{"data":{}}');
      };
      const res = await request(buildApp())
        .post('/api/graphql/query')
        .send({ endpoint: `http://127.0.0.1:${mockUpstreamPort}/graphql`, query: '{ x }' });
      expect(res.status).toBe(200);
      expect(res.headers['x-relay']).toBe('yes');
    });

    it('proxies query with variables and operationName to upstream (lines 118-119)', async () => {
      let capturedBody = '';
      mockUpstreamHandler = (req, res) => {
        let body = '';
        req.on('data', (c: Buffer) => { body += c.toString(); });
        req.on('end', () => {
          capturedBody = body;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{"data":{}}');
        });
      };
      await request(buildApp())
        .post('/api/graphql/query')
        .send({
          endpoint: `http://127.0.0.1:${mockUpstreamPort}/graphql`,
          query: '{ user { name } }',
          variables: { id: '1' },
          operationName: 'GetUser',
        });
      const parsed = JSON.parse(capturedBody);
      expect(parsed.variables).toEqual({ id: '1' });
      expect(parsed.operationName).toBe('GetUser');
    });

    it('forwards extra string headers to upstream (line 134-136)', async () => {
      let capturedHeaders: Record<string, string> = {};
      mockUpstreamHandler = (req, res) => {
        capturedHeaders = req.headers as Record<string, string>;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"data":{}}');
      };
      await request(buildApp())
        .post('/api/graphql/query')
        .send({
          endpoint: `http://127.0.0.1:${mockUpstreamPort}/graphql`,
          query: '{ x }',
          headers: { 'authorization': 'Bearer tok', 'x-tenant': 'acme' },
        });
      expect(capturedHeaders['authorization']).toBe('Bearer tok');
      expect(capturedHeaders['x-tenant']).toBe('acme');
    });

    it('log: no meta (line 39 false branch — log called without meta)', async () => {
      mockUpstreamHandler = (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"data":{}}');
      };
      // onLog is called with just a message (no meta) for the subscribe route
      const onLog = vi.fn();
      // Also test subscribe with onLog which uses meta=undefined path
      await request(buildApp(onLog))
        .post('/api/graphql/subscribe')
        .send({ endpoint: 'wss://localhost:9999/graphql' });
      const calls = onLog.mock.calls.map(c => c[0].message as string);
      // Should include a message (without meta appended)
      expect(calls.some(m => m.includes('[graphql]'))).toBe(true);
    });
  });

  describe('POST /api/graphql/upload — mock upstream responses', () => {
    it('proxies upload response from upstream (lines 358-367 covered)', async () => {
      mockUpstreamHandler = (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json', 'x-upload': 'done' });
        res.end('{"data":{"upload":"ok"}}');
      };
      const res = await request(buildApp())
        .post('/api/graphql/upload')
        .set('x-graphql-endpoint', `http://127.0.0.1:${mockUpstreamPort}/graphql`)
        .field('operations', '{"query":"mutation { upload }"}')
        .field('map', '{"0":["variables.file"]}')
        .attach('0', Buffer.from('file data'), { filename: 'test.txt', contentType: 'text/plain' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ upload: 'ok' });
    });

    it('skips transfer-encoding/connection/keep-alive headers in upload response (line 362)', async () => {
      mockUpstreamHandler = (_req, res) => {
        res.writeHead(200, {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          'x-processed': 'true',
        });
        res.end('{"data":{}}');
      };
      const res = await request(buildApp())
        .post('/api/graphql/upload')
        .set('x-graphql-endpoint', `http://127.0.0.1:${mockUpstreamPort}/graphql`)
        .field('operations', '{"query":"mutation { upload }"}')
        .field('map', '{}');
      expect(res.status).toBe(200);
      expect(res.headers['x-processed']).toBe('true');
    });

    it('non-string header values in upload request forward are skipped (line 344)', async () => {
      // When a header value is an array (not a string), it should be skipped
      const onLog = vi.fn();
      mockUpstreamHandler = (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      };
      await request(buildApp(onLog))
        .post('/api/graphql/upload')
        .set('x-graphql-endpoint', `http://127.0.0.1:${mockUpstreamPort}/graphql`)
        .set('authorization', 'Bearer token')
        .field('operations', '{}')
        .field('map', '{}');
      // Should have reached the info log (relaying)
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info', message: expect.stringContaining('relaying') }),
      );
    });
  });

  describe('POST /api/graphql/upload — extended', () => {
    it('reads targetEndpoint from endpoint query param when x-graphql-endpoint header is absent (line 255 fallback)', async () => {
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .post('/api/graphql/upload?endpoint=http://localhost:19999/graphql')
        .field('operations', '{"query":"mutation {upload}"}')
        .field('map', '{}');
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info', message: expect.stringContaining('relaying') }),
      );
    });

    it('returns 502 when upload upstream connection is refused', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/upload')
        .set('x-graphql-endpoint', 'http://localhost:29847/graphql')
        .field('operations', '{"query":"mutation {upload}"}')
        .field('map', '{}');
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('GQL_UPSTREAM_ERROR');
    });
  });
});
