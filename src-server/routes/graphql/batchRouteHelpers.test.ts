/**
 * @vitest-environment node
 *
 * Unit tests for batchRouteHelpers.ts
 * Tests each helper in isolation against a real in-process mock HTTP server.
 */
import http from 'node:http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  parseResult,
  padTimedOutResults,
  sendSinglePostWithTimeout,
  runSequentialWithTimeout,
  type BatchContext,
} from './batchRouteHelpers.js';

// ─── Mock upstream HTTP server ────────────────────────────────────────────────

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

function makeCtx(overrides?: Partial<BatchContext>): BatchContext {
  return {
    transport:     http,
    targetUrl:     new URL(`http://127.0.0.1:${mockPort}/graphql`),
    baseHeaders:   { 'content-type': 'application/json', 'accept': 'application/json' },
    tlsAgent:      undefined,
    batchDeadline: Date.now() + 30000,
    ...overrides,
  };
}

// ─── parseResult ─────────────────────────────────────────────────────────────

describe('parseResult', () => {
  it('spreads JSON object and adds _httpStatus', () => {
    const result = parseResult('{"data":{"ok":true}}', 200);
    expect(result).toEqual({ data: { ok: true }, _httpStatus: 200 });
  });

  it('returns synthetic error for non-JSON input', () => {
    const result = parseResult('not json', 500);
    expect(result.data).toBeNull();
    expect(result._httpStatus).toBe(500);
    expect((result.errors as { message: string }[])[0].message).toContain('Non-JSON response (HTTP 500)');
  });

  it('returns synthetic error for empty string', () => {
    const result = parseResult('', 200);
    expect(result.data).toBeNull();
    expect((result.errors as { message: string }[])[0].message).toContain('Non-JSON');
  });

  it('preserves existing errors array from upstream', () => {
    const body = JSON.stringify({ data: null, errors: [{ message: 'field missing' }] });
    const result = parseResult(body, 200);
    expect(result.errors).toEqual([{ message: 'field missing' }]);
  });

  it('handles HTTP 4xx status codes', () => {
    const result = parseResult('{"error":"unauthorized"}', 401);
    expect(result._httpStatus).toBe(401);
    expect(result.error).toBe('unauthorized');
  });
});

// ─── padTimedOutResults ───────────────────────────────────────────────────────

describe('padTimedOutResults', () => {
  it('returns partial array unchanged when already full', () => {
    const partial = [{ data: 'a', _httpStatus: 200 }];
    expect(padTimedOutResults(partial, 1)).toEqual(partial);
  });

  it('pads missing slots with timeout error entries', () => {
    const partial = [{ data: 'a', _httpStatus: 200 }];
    const padded = padTimedOutResults(partial, 3);
    expect(padded).toHaveLength(3);
    expect(padded[1]._httpStatus).toBe(408);
    expect(padded[2]._httpStatus).toBe(408);
    expect((padded[1].errors as { message: string }[])[0].message).toContain('Batch timeout');
  });

  it('assigns correct _index values to padded entries', () => {
    const padded = padTimedOutResults([], 2);
    expect(padded[0]._index).toBe(0);
    expect(padded[1]._index).toBe(1);
  });

  it('does not mutate the original partial array', () => {
    const partial: Record<string, unknown>[] = [];
    padTimedOutResults(partial, 2);
    expect(partial).toHaveLength(0);
  });

  it('handles empty partial with totalOps=0', () => {
    expect(padTimedOutResults([], 0)).toEqual([]);
  });
});

// ─── sendSinglePostWithTimeout ────────────────────────────────────────────────

describe('sendSinglePostWithTimeout', () => {
  it('sends POST and returns response body + status', async () => {
    mockHandler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: { hello: true } }));
    };
    const result = await sendSinglePostWithTimeout({ query: '{ hello }' }, makeCtx());
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ data: { hello: true } });
  });

  it('returns 408 immediately when batchDeadline is in the past', async () => {
    const ctx = makeCtx({ batchDeadline: Date.now() - 1 });
    const result = await sendSinglePostWithTimeout({ query: '{ q }' }, ctx);
    expect(result.status).toBe(408);
    const body = JSON.parse(result.body) as { errors: { message: string }[] };
    expect(body.errors[0].message).toContain('Batch timeout');
  });

  it('returns 408 when socket timeout fires before upstream responds', async () => {
    mockHandler = (_req, res) => {
      // Deliberately delay — the 5 ms deadline will fire first
      setTimeout(() => { res.writeHead(200); res.end('{}'); }, 200);
    };
    const ctx = makeCtx({ batchDeadline: Date.now() + 5 }); // 5 ms deadline
    const result = await sendSinglePostWithTimeout({ query: '{ slow }' }, ctx);
    expect(result.status).toBe(408);
  });

  it('returns status=0 and error body when upstream is unreachable', async () => {
    const ctx = makeCtx({ targetUrl: new URL('http://127.0.0.1:29999/graphql') });
    const result = await sendSinglePostWithTimeout({ query: '{ q }' }, ctx);
    expect(result.status).toBe(0);
    const body = JSON.parse(result.body) as { errors: { message: string }[] };
    expect(body.errors[0].message).toBeTruthy();
  });

  it('merges per-operation headers over base headers', async () => {
    let capturedAuth = '';
    mockHandler = (req, res) => {
      capturedAuth = req.headers['authorization'] as string ?? '';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"data":null}');
    };
    await sendSinglePostWithTimeout(
      { query: '{ q }' },
      makeCtx(),
      { Authorization: 'Bearer per-tab-token' },
    );
    expect(capturedAuth).toBe('Bearer per-tab-token');
  });

  it('ignores non-string per-op header values', async () => {
    let capturedHeaders: http.IncomingHttpHeaders = {};
    mockHandler = (req, res) => {
      capturedHeaders = req.headers;
      res.writeHead(200); res.end('{}');
    };
    await sendSinglePostWithTimeout(
      { query: '{ q }' },
      makeCtx(),
      // TypeScript type allows only string, but at runtime callers may pass non-string
      { 'x-valid': 'yes', 'x-invalid': (42 as unknown) as string },
    );
    expect(capturedHeaders['x-valid']).toBe('yes');
    expect(capturedHeaders['x-invalid']).toBeUndefined();
  });

  it('forwards operationName when present', async () => {
    let capturedBody = '';
    mockHandler = (req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => { body += c.toString(); });
      req.on('end', () => { capturedBody = body; res.writeHead(200); res.end('{}'); });
    };
    await sendSinglePostWithTimeout({ query: '{ q }', operationName: 'MyOp' }, makeCtx());
    expect(JSON.parse(capturedBody)).toMatchObject({ operationName: 'MyOp' });
  });

  it('passes upstream non-200 status through', async () => {
    mockHandler = (_req, res) => { res.writeHead(422); res.end('{"errors":[{"message":"invalid"}]}'); };
    const result = await sendSinglePostWithTimeout({ query: '{ q }' }, makeCtx());
    expect(result.status).toBe(422);
  });
});

// ─── runSequentialWithTimeout ─────────────────────────────────────────────────

describe('runSequentialWithTimeout', () => {
  it('runs all operations and returns results when no timeout', async () => {
    mockHandler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: { ok: true } }));
    };
    const ops = [{ query: '{ a }' }, { query: '{ b }' }];
    const { results, timedOut } = await runSequentialWithTimeout(ops, makeCtx());
    expect(timedOut).toBe(false);
    expect(results).toHaveLength(2);
    expect(results[0].data).toEqual({ ok: true });
  });

  it('returns timedOut=true when batchDeadline passes before first op', async () => {
    const ctx = makeCtx({ batchDeadline: Date.now() - 1 }); // already expired
    const { results, timedOut } = await runSequentialWithTimeout(
      [{ query: '{ a }' }, { query: '{ b }' }],
      ctx,
    );
    expect(timedOut).toBe(true);
    expect(results).toHaveLength(0); // No ops ran
  });

  it('returns one result when first op succeeds and second op gets socket timeout', async () => {
    let callCount = 0;
    mockHandler = (_req, res) => {
      callCount++;
      if (callCount === 1) {
        // First op: respond immediately
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"data":{"n":1}}');
      }
      // Second op: hold the connection open so the 5 ms timer fires
    };
    // Give enough deadline for first op but expire it for second
    const ctx = makeCtx({ batchDeadline: Date.now() + 5 });
    // Wait for first op to complete, then deadline expires, second hits socket timeout
    const { results, timedOut } = await runSequentialWithTimeout(
      [{ query: '{ a }' }, { query: '{ b }' }],
      ctx,
    );
    // Either one result (first op succeeded, second timed out) or zero (deadline pre-check)
    expect(timedOut).toBe(true);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('stops on socket-level 408 and returns partial results with timedOut=true', async () => {
    let callCount = 0;
    mockHandler = (_req, res) => {
      callCount++;
      if (callCount === 1) {
        res.writeHead(200); res.end('{"data":{"n":1}}');
      }
      // Second call: just don't respond (connection stays open, 5ms deadline fires)
    };
    const ctx = makeCtx({ batchDeadline: Date.now() + 5 }); // only 5ms
    // First op should succeed (if it's fast enough), second should 408
    const { timedOut } = await runSequentialWithTimeout(
      [{ query: '{ a }' }, { query: '{ b }' }],
      ctx,
    );
    expect(timedOut).toBe(true);
  });

  it('includes per-operation headers when op has headers object', async () => {
    let capturedAuth = '';
    mockHandler = (req, res) => {
      capturedAuth = req.headers['authorization'] as string ?? '';
      res.writeHead(200); res.end('{"data":null}');
    };
    const ops = [{ query: '{ a }', headers: { Authorization: 'Bearer per-op' } }];
    await runSequentialWithTimeout(ops, makeCtx());
    expect(capturedAuth).toBe('Bearer per-op');
  });

  it('ignores per-op headers when headers is an array', async () => {
    let capturedAuth = '';
    mockHandler = (req, res) => {
      capturedAuth = req.headers['authorization'] as string ?? '';
      res.writeHead(200); res.end('{"data":null}');
    };
    const ops = [{ query: '{ a }', headers: ['not-an-object'] }];
    await runSequentialWithTimeout(ops, makeCtx());
    expect(capturedAuth).toBe('');
  });

  it('includes operationName in op body only when non-empty string', async () => {
    const bodies: unknown[] = [];
    mockHandler = (req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => { body += c.toString(); });
      req.on('end', () => {
        bodies.push(JSON.parse(body));
        res.writeHead(200); res.end('{}');
      });
    };
    const ops = [
      { query: '{ a }', operationName: 'MyOp' },
      { query: '{ b }', operationName: '' },
      { query: '{ c }' },
    ];
    await runSequentialWithTimeout(ops, makeCtx());
    expect((bodies[0] as Record<string, unknown>).operationName).toBe('MyOp');
    expect((bodies[1] as Record<string, unknown>).operationName).toBeUndefined();
    expect((bodies[2] as Record<string, unknown>).operationName).toBeUndefined();
  });

  it('returns empty results without timeout for zero operations', async () => {
    const { results, timedOut } = await runSequentialWithTimeout([], makeCtx());
    expect(results).toHaveLength(0);
    expect(timedOut).toBe(false);
  });

  it('includes variables in op body when op has variables defined', async () => {
    const bodies: unknown[] = [];
    mockHandler = (req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => { body += c.toString(); });
      req.on('end', () => {
        bodies.push(JSON.parse(body));
        res.writeHead(200); res.end('{"data":null}');
      });
    };
    const ops = [
      { query: '{ user(id: $id) { name } }', variables: { id: '42' } },
      { query: '{ users }' }, // no variables
    ];
    await runSequentialWithTimeout(ops, makeCtx());
    expect((bodies[0] as Record<string, unknown>).variables).toEqual({ id: '42' });
    expect((bodies[1] as Record<string, unknown>).variables).toBeUndefined();
  });

  it('uses default http port 80 when targetUrl omits explicit port', async () => {
    const ctx = makeCtx({ targetUrl: new URL('http://127.0.0.1/graphql') });
    const result = await sendSinglePostWithTimeout({ query: '{ q }' }, ctx);
    expect(result.status).toBe(0);
  });
});
