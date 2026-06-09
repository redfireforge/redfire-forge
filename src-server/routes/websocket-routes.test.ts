/**
 * @vitest-environment node
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createWebSocketRouter } from './websocket-routes.js';
import {
  createWsSuccessEnvelope,
  createWsErrorEnvelope,
} from '../websocket/contracts.js';

function createMockService() {
  return {
    connect: vi.fn(async () => createWsSuccessEnvelope('connect', {
      connectionId: 'test-conn-1',
      protocol: '',
      extensions: '',
      latencyMs: 12,
    })),
    disconnect: vi.fn(() => createWsSuccessEnvelope('disconnect', {
      connectionId: 'test-conn-1',
      disconnected: true,
    })),
    send: vi.fn(() => createWsSuccessEnvelope('send', {
      connectionId: 'test-conn-1',
      sentAt: new Date().toISOString(),
    })),
    ping: vi.fn(() => createWsSuccessEnvelope('ping', {
      connectionId: 'test-conn-1',
      sentAt: new Date().toISOString(),
    })),
    getMessages: vi.fn(() => createWsSuccessEnvelope('messages', {
      connectionId: 'test-conn-1',
      messages: [],
      cursor: 0,
      bufferSize: 0,
    })),
    getStatus: vi.fn(() => createWsSuccessEnvelope('status', {
      connectionId: 'test-conn-1',
      state: 'connected' as const,
      url: 'ws://localhost:8765',
      sentCount: 0,
      receivedCount: 0,
    })),
  };
}

function buildApp(mockService: ReturnType<typeof createMockService>, onLog?: (line: unknown) => void) {
  const app = express();
  app.use(express.json());
  app.use(createWebSocketRouter({
    service: mockService as never,
    onLog: onLog as never,
  }));
  return app;
}

describe('websocket-routes', () => {
  let mockService: ReturnType<typeof createMockService>;
  let app: express.Express;

  beforeEach(() => {
    mockService = createMockService();
    app = buildApp(mockService);
  });

  // ── POST /api/ws/connect ─────────────────────────────────────────────────

  describe('POST /api/ws/connect', () => {
    it('returns 200 with success envelope', async () => {
      const res = await request(app)
        .post('/api/ws/connect')
        .send({ url: 'ws://localhost:8765' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.op).toBe('connect');
      expect(res.body.data.connectionId).toBe('test-conn-1');
      expect(mockService.connect).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'ws://localhost:8765' }),
      );
    });

    it('returns 400 when body is an array', async () => {
      const res = await request(app)
        .post('/api/ws/connect')
        .send([1, 2, 3]);

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('WS_INVALID_REQUEST');
    });

    it('returns error status when service returns error', async () => {
      mockService.connect.mockResolvedValue(
        createWsErrorEnvelope('connect', {
          code: 'WS_INVALID_URL',
          message: 'url must start with ws://',
        }),
      );

      const res = await request(app)
        .post('/api/ws/connect')
        .send({ url: 'http://bad' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('WS_INVALID_URL');
    });

    it('returns 504 for timeout errors', async () => {
      mockService.connect.mockResolvedValue(
        createWsErrorEnvelope('connect', {
          code: 'WS_CONNECT_TIMEOUT',
          message: 'Timed out',
          retryable: true,
        }),
      );

      const res = await request(app)
        .post('/api/ws/connect')
        .send({ url: 'ws://slow.example.com' });

      expect(res.status).toBe(504);
    });

    it('calls onLog callback', async () => {
      const logSpy = vi.fn();
      const logApp = buildApp(mockService, logSpy);

      await request(logApp)
        .post('/api/ws/connect')
        .send({ url: 'ws://localhost:8765' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('[WebSocket] connect'),
        }),
      );
    });
  });

  // ── POST /api/ws/disconnect ──────────────────────────────────────────────

  describe('POST /api/ws/disconnect', () => {
    it('returns 200 with success envelope', async () => {
      const res = await request(app)
        .post('/api/ws/disconnect')
        .send({ connectionId: 'test-conn-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.disconnected).toBe(true);
    });

    it('returns 404 when connection not found', async () => {
      mockService.disconnect.mockReturnValue(
        createWsErrorEnvelope('disconnect', {
          code: 'WS_NOT_FOUND',
          message: 'Connection not found',
        }),
      );

      const res = await request(app)
        .post('/api/ws/disconnect')
        .send({ connectionId: 'nonexistent' });

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
    });

    it('rejects non-object body', async () => {
      const res = await request(app)
        .post('/api/ws/disconnect')
        .send([1, 2, 3]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WS_INVALID_REQUEST');
    });
  });

  // ── POST /api/ws/send ────────────────────────────────────────────────────

  describe('POST /api/ws/send', () => {
    it('returns 200 with success envelope', async () => {
      const res = await request(app)
        .post('/api/ws/send')
        .send({ connectionId: 'test-conn-1', data: 'hello' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns 409 when not connected', async () => {
      mockService.send.mockReturnValue(
        createWsErrorEnvelope('send', {
          code: 'WS_NOT_CONNECTED',
          message: 'Connection is not open',
        }),
      );

      const res = await request(app)
        .post('/api/ws/send')
        .send({ connectionId: 'test-conn-1', data: 'hello' });

      expect(res.status).toBe(409);
    });
  });

  // ── POST /api/ws/ping ───────────────────────────────────────────────────

  describe('POST /api/ws/ping', () => {
    it('returns 200 with success envelope', async () => {
      const res = await request(app)
        .post('/api/ws/ping')
        .send({ connectionId: 'test-conn-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mockService.ping).toHaveBeenCalledWith({ connectionId: 'test-conn-1' });
    });

    it('returns 404 when connection not found', async () => {
      mockService.ping.mockReturnValue(
        createWsErrorEnvelope('ping', {
          code: 'WS_NOT_FOUND',
          message: 'Connection not found',
        }),
      );

      const res = await request(app)
        .post('/api/ws/ping')
        .send({ connectionId: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    it('rejects non-object body', async () => {
      const res = await request(app)
        .post('/api/ws/ping')
        .send([1, 2, 3]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WS_INVALID_REQUEST');
    });
  });

  // ── GET /api/ws/messages ─────────────────────────────────────────────────

  describe('GET /api/ws/messages', () => {
    it('returns messages for valid connectionId', async () => {
      const res = await request(app)
        .get('/api/ws/messages?connectionId=test-conn-1');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.messages).toEqual([]);
      expect(mockService.getMessages).toHaveBeenCalledWith({
        connectionId: 'test-conn-1',
        sinceCursor: undefined,
      });
    });

    it('passes sinceCursor as integer', async () => {
      await request(app)
        .get('/api/ws/messages?connectionId=test-conn-1&sinceCursor=5');

      expect(mockService.getMessages).toHaveBeenCalledWith({
        connectionId: 'test-conn-1',
        sinceCursor: 5,
      });
    });

    it('returns 400 when connectionId is missing', async () => {
      const res = await request(app)
        .get('/api/ws/messages');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('WS_INVALID_REQUEST');
    });

    it('ignores non-numeric sinceCursor', async () => {
      await request(app)
        .get('/api/ws/messages?connectionId=test-conn-1&sinceCursor=abc');

      expect(mockService.getMessages).toHaveBeenCalledWith({
        connectionId: 'test-conn-1',
        sinceCursor: undefined,
      });
    });
  });

  // ── GET /api/ws/status ───────────────────────────────────────────────────

  describe('GET /api/ws/status', () => {
    it('returns status for valid connectionId', async () => {
      const res = await request(app)
        .get('/api/ws/status?connectionId=test-conn-1');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.state).toBe('connected');
    });

    it('returns 400 when connectionId is missing', async () => {
      const res = await request(app)
        .get('/api/ws/status');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('returns 404 when connection not found', async () => {
      mockService.getStatus.mockReturnValue(
        createWsErrorEnvelope('status', {
          code: 'WS_NOT_FOUND',
          message: 'Connection not found',
        }),
      );

      const res = await request(app)
        .get('/api/ws/status?connectionId=nonexistent');

      expect(res.status).toBe(404);
    });
  });

  // ── Error status mapping ─────────────────────────────────────────────────

  describe('error status mapping', () => {
    it('maps WS_CONNECT_FAILED to 500', async () => {
      mockService.connect.mockResolvedValue(
        createWsErrorEnvelope('connect', {
          code: 'WS_CONNECT_FAILED',
          message: 'Connection refused',
        }),
      );

      const res = await request(app)
        .post('/api/ws/connect')
        .send({ url: 'ws://bad' });

      expect(res.status).toBe(500);
    });

    it('maps WS_SEND_FAILED to 500', async () => {
      mockService.send.mockReturnValue(
        createWsErrorEnvelope('send', {
          code: 'WS_SEND_FAILED',
          message: 'Send error',
        }),
      );

      const res = await request(app)
        .post('/api/ws/send')
        .send({ connectionId: 'x', data: 'y' });

      expect(res.status).toBe(500);
    });
  });
});
