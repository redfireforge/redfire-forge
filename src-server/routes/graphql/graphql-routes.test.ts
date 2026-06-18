/**
 * @vitest-environment node
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createGraphqlRouter } from './graphql-routes.js';

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

    it('returns 501 with GQL_NOT_IMPLEMENTED for multipart/form-data', async () => {
      const res = await request(buildApp())
        .post('/api/graphql/upload')
        .field('operations', '{"query": "mutation {upload}"}')
        .field('map', '{"0": ["variables.file"]}')
        .attach('0', Buffer.from('fake-file-content'), { filename: 'test.txt', contentType: 'text/plain' });
      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('GQL_NOT_IMPLEMENTED');
      expect(res.body.error.message).toMatch(/Sprint 4/);
    });

    it('calls onLog for multipart/form-data', async () => {
      const onLog = vi.fn();
      await request(buildApp(onLog))
        .post('/api/graphql/upload')
        .field('operations', '{"query":"mutation {upload}"}')
        .field('map', '{}');
      expect(onLog).toHaveBeenCalledOnce();
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
});
