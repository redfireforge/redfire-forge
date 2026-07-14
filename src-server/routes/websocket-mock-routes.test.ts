import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createWebSocketMockRouter } from './websocket-mock-routes.js';

function createMockService() {
  return {
    start: vi.fn().mockResolvedValue({ running: true, port: 9876, clientCount: 0, clients: [] }),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue({ running: false, port: 9876, clientCount: 0, clients: [] }),
    broadcast: vi.fn().mockReturnValue(2),
    updateRules: vi.fn(),
    getLogs: vi.fn().mockReturnValue([]),
  };
}

function createApp(service: ReturnType<typeof createMockService>) {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(createWebSocketMockRouter({ service: service as any }));
  return app;
}

describe('websocket-mock-routes', () => {
  let service: ReturnType<typeof createMockService>;
  let app: express.Express;

  afterEach(() => { resetAllMocks(); });

  beforeEach(() => {
    service = createMockService();
    app = createApp(service);
  });

  describe('POST /api/ws/mock/start', () => {
    it('starts the mock server with valid config', async () => {
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({ port: 9876, rules: [], fallback: 'echo' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.running).toBe(true);
      expect(service.start).toHaveBeenCalledWith({ port: 9876, rules: [], fallback: 'echo' });
    });

    it('rejects invalid port < 1024', async () => {
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({ port: 80 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MOCK_INVALID_PORT');
    });

    it('rejects port > 65535', async () => {
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({ port: 70000 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MOCK_INVALID_PORT');
    });

    it('rejects NaN port', async () => {
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({ port: 'abc' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MOCK_INVALID_PORT');
    });

    it('defaults to port 9876 when not provided', async () => {
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({});
      expect(res.status).toBe(200);
      expect(service.start).toHaveBeenCalledWith(expect.objectContaining({ port: 9876 }));
    });

    it('defaults to echo fallback when invalid', async () => {
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({ fallback: 'invalid' });
      expect(res.status).toBe(200);
      expect(service.start).toHaveBeenCalledWith(expect.objectContaining({ fallback: 'echo' }));
    });

    it('handles EADDRINUSE error', async () => {
      service.start.mockRejectedValue(new Error('listen EADDRINUSE: address already in use'));
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({ port: 9876 });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('MOCK_PORT_IN_USE');
    });

    it('handles generic start error', async () => {
      service.start.mockRejectedValue(new Error('Some other error'));
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({ port: 9876 });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('MOCK_START_FAILED');
    });

    it('handles non-Error thrown from start', async () => {
      service.start.mockRejectedValue('string error');
      const res = await request(app)
        .post('/api/ws/mock/start')
        .send({ port: 9876 });
      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe('string error');
    });
  });

  describe('POST /api/ws/mock/stop', () => {
    it('stops the mock server', async () => {
      const res = await request(app).post('/api/ws/mock/stop');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(service.stop).toHaveBeenCalled();
      expect(service.getStatus).toHaveBeenCalled();
    });

    it('returns stopped status when no service exists for port (pool miss)', async () => {
      const poolApp = express();
      poolApp.use(express.json());
      poolApp.use(createWebSocketMockRouter());
      const res = await request(poolApp)
        .post('/api/ws/mock/stop')
        .send({ port: 19999 });
      expect(res.status).toBe(200);
      expect(res.body.data.running).toBe(false);
      expect(res.body.data.port).toBe(19999);
    });

    it('accepts numeric port in body', async () => {
      const res = await request(app).post('/api/ws/mock/stop').send({ port: 9876 });
      expect(res.status).toBe(200);
      expect(service.stop).toHaveBeenCalled();
    });
  });

  describe('GET /api/ws/mock/status', () => {
    it('returns current status', async () => {
      service.getStatus.mockReturnValue({ running: true, port: 9876, clientCount: 3, clients: [] });
      const res = await request(app).get('/api/ws/mock/status');
      expect(res.status).toBe(200);
      expect(res.body.data.running).toBe(true);
      expect(res.body.data.clientCount).toBe(3);
    });

    it('returns stopped status when no service exists for port (pool miss)', async () => {
      const poolApp = express();
      poolApp.use(express.json());
      poolApp.use(createWebSocketMockRouter());
      const res = await request(poolApp).get('/api/ws/mock/status?port=19999');
      expect(res.status).toBe(200);
      expect(res.body.data.running).toBe(false);
      expect(res.body.data.port).toBe(19999);
    });

    it('accepts numeric port as query string', async () => {
      service.getStatus.mockReturnValue({ running: false, port: 9876, clientCount: 0, clients: [] });
      const res = await request(app).get('/api/ws/mock/status?port=9876');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/ws/mock/broadcast', () => {
    it('broadcasts message to clients', async () => {
      const res = await request(app)
        .post('/api/ws/mock/broadcast')
        .send({ data: 'hello' });
      expect(res.status).toBe(200);
      expect(res.body.data.sent).toBe(2);
      expect(service.broadcast).toHaveBeenCalledWith('hello');
    });

    it('rejects empty data', async () => {
      const res = await request(app)
        .post('/api/ws/mock/broadcast')
        .send({ data: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MOCK_INVALID_DATA');
    });

    it('rejects non-string data', async () => {
      const res = await request(app)
        .post('/api/ws/mock/broadcast')
        .send({ data: 123 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MOCK_INVALID_DATA');
    });

    it('rejects missing data', async () => {
      const res = await request(app)
        .post('/api/ws/mock/broadcast')
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns sent:0 when no service exists for port (pool miss)', async () => {
      const poolApp = express();
      poolApp.use(express.json());
      poolApp.use(createWebSocketMockRouter());
      const res = await request(poolApp)
        .post('/api/ws/mock/broadcast')
        .send({ port: 19999, data: 'hello' });
      expect(res.status).toBe(200);
      expect(res.body.data.sent).toBe(0);
    });
  });

  describe('POST /api/ws/mock/rules', () => {
    it('updates rules', async () => {
      const rules = [{ id: 'r1', match: '*', response: 'ok', enabled: true }];
      const res = await request(app)
        .post('/api/ws/mock/rules')
        .send({ rules, fallback: 'ignore' });
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(service.updateRules).toHaveBeenCalledWith(rules, 'ignore');
    });

    it('rejects non-array rules', async () => {
      const res = await request(app)
        .post('/api/ws/mock/rules')
        .send({ rules: 'not-an-array' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MOCK_INVALID_RULES');
    });

    it('passes undefined fallback when invalid', async () => {
      const res = await request(app)
        .post('/api/ws/mock/rules')
        .send({ rules: [], fallback: 'invalid' });
      expect(res.status).toBe(200);
      expect(service.updateRules).toHaveBeenCalledWith([], undefined);
    });
  });

  describe('GET /api/ws/mock/log', () => {
    it('returns logs with cursor', async () => {
      const entries = [{ id: 1, type: 'message', data: 'test', timestamp: Date.now() }];
      service.getLogs.mockReturnValue(entries);
      const res = await request(app).get('/api/ws/mock/log?sinceCursor=0');
      expect(res.status).toBe(200);
      expect(res.body.data.entries).toEqual(entries);
      expect(res.body.data.cursor).toBe(1);
      expect(service.getLogs).toHaveBeenCalledWith(0);
    });

    it('handles missing sinceCursor', async () => {
      service.getLogs.mockReturnValue([]);
      const res = await request(app).get('/api/ws/mock/log');
      expect(res.status).toBe(200);
      expect(service.getLogs).toHaveBeenCalledWith(undefined);
      expect(res.body.data.cursor).toBe(0);
    });

    it('handles non-numeric sinceCursor', async () => {
      service.getLogs.mockReturnValue([]);
      const res = await request(app).get('/api/ws/mock/log?sinceCursor=abc');
      expect(res.status).toBe(200);
      expect(service.getLogs).toHaveBeenCalledWith(undefined);
    });

    it('returns empty entries when no service exists for port (pool miss)', async () => {
      const poolApp = express();
      poolApp.use(express.json());
      poolApp.use(createWebSocketMockRouter());
      const res = await request(poolApp).get('/api/ws/mock/log?port=19999&sinceCursor=5');
      expect(res.status).toBe(200);
      expect(res.body.data.entries).toEqual([]);
      expect(res.body.data.cursor).toBe(5);
    });

    it('returns cursor=0 when pool miss and no sinceCursor', async () => {
      const poolApp = express();
      poolApp.use(express.json());
      poolApp.use(createWebSocketMockRouter());
      const res = await request(poolApp).get('/api/ws/mock/log?port=19999');
      expect(res.status).toBe(200);
      expect(res.body.data.cursor).toBe(0);
    });
  });

  describe('onLog callback', () => {
    it('calls onLog during operations', async () => {
      const onLog = vi.fn();
      const logApp = express();
      logApp.use(express.json());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logApp.use(createWebSocketMockRouter({ service: service as any, onLog }));

      await request(logApp)
        .post('/api/ws/mock/start')
        .send({ port: 9876 });
      expect(onLog).toHaveBeenCalledWith(expect.objectContaining({
        prefix: '*',
        text: expect.stringContaining('[WS-Mock]'),
      }));
    });
  });
});
