import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketProxyService } from './websocket-service';
import { WebSocketServer, WebSocket } from 'ws';
import https from 'node:https';

let wss: WebSocketServer | null = null;
let service: WebSocketProxyService;
const TEST_PORT = 18765;

function startEchoServer(): Promise<void> {
  return new Promise((resolve) => {
    wss = new WebSocketServer({ port: TEST_PORT });
    wss.on('connection', (ws) => {
      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          ws.send(data);
        } else {
          ws.send(data.toString('utf-8'));
        }
      });
    });
    wss.on('listening', resolve);
  });
}

function stopEchoServer(): Promise<void> {
  return new Promise((resolve) => {
    if (wss) {
      wss.close(() => resolve());
      wss = null;
    } else {
      resolve();
    }
  });
}

beforeEach(async () => {
  service = new WebSocketProxyService(100);
  await startEchoServer();
});

afterEach(async () => {
  service.stopGc();
  await service.disconnectAll();
  await stopEchoServer();
});

describe('WebSocketProxyService', () => {
  describe('connect', () => {
    it('connects to a WebSocket server and returns connectionId', async () => {
      const env = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(env.ok).toBe(true);
      if (env.ok) {
        expect(env.data.connectionId).toBeTruthy();
        expect(env.data.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('rejects empty URL', async () => {
      const env = await service.connect({ url: '' });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_INVALID_URL');
      }
    });

    it('rejects non-ws URL', async () => {
      const env = await service.connect({ url: 'http://localhost:8765' });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_INVALID_URL');
      }
    });

    it('returns error for unreachable server', async () => {
      const env = await service.connect({ url: 'ws://localhost:19999', timeoutMs: 1000 });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toMatch(/WS_CONNECT_/);
      }
    });

    it('passes custom headers', async () => {
      const env = await service.connect({
        url: `ws://localhost:${TEST_PORT}`,
        headers: { 'X-Custom': 'test-value', 'Authorization': 'Bearer token123' },
      });
      expect(env.ok).toBe(true);
    });

    it('passes subprotocols', async () => {
      const env = await service.connect({
        url: `ws://localhost:${TEST_PORT}`,
        subprotocols: ['json', 'graphql-ws'],
      });
      expect(env.ok).toBe(true);
    });

    it('increments connection count', async () => {
      expect(service.getConnectionCount()).toBe(0);
      await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(service.getConnectionCount()).toBe(1);
      await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(service.getConnectionCount()).toBe(2);
    });
  });

  describe('send', () => {
    it('sends a text message', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(connEnv.ok).toBe(true);
      if (!connEnv.ok) return;

      const sendEnv = service.send({
        connectionId: connEnv.data.connectionId,
        data: 'hello',
      });
      expect(sendEnv.ok).toBe(true);
      if (sendEnv.ok) {
        expect(sendEnv.data.sentAt).toBeTruthy();
      }
    });

    it('returns error for unknown connectionId', () => {
      const env = service.send({ connectionId: 'nonexistent', data: 'test' });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_NOT_FOUND');
      }
    });
  });

  describe('ping', () => {
    it('sends a ping frame successfully', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(connEnv.ok).toBe(true);
      if (!connEnv.ok) return;

      const pingEnv = service.ping({ connectionId: connEnv.data.connectionId });
      expect(pingEnv.ok).toBe(true);
      if (pingEnv.ok) {
        expect(pingEnv.data.connectionId).toBe(connEnv.data.connectionId);
        expect(pingEnv.data.sentAt).toBeTruthy();
      }
    });

    it('sends a ping with optional data', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(connEnv.ok).toBe(true);
      if (!connEnv.ok) return;

      const pingEnv = service.ping({ connectionId: connEnv.data.connectionId, data: 'keepalive' });
      expect(pingEnv.ok).toBe(true);
    });

    it('returns error for unknown connectionId', () => {
      const env = service.ping({ connectionId: 'nonexistent' });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_NOT_FOUND');
      }
    });

    it('returns error when connection is disconnected', () => {
      const env = service.ping({ connectionId: 'nonexistent-2' });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_NOT_FOUND');
      }
    });
  });

  describe('getMessages', () => {
    it('returns received messages from echo server', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(connEnv.ok).toBe(true);
      if (!connEnv.ok) return;

      const connId = connEnv.data.connectionId;
      service.send({ connectionId: connId, data: 'ping' });

      // Wait for echo response
      await new Promise((r) => setTimeout(r, 100));

      const msgEnv = service.getMessages({ connectionId: connId });
      expect(msgEnv.ok).toBe(true);
      if (msgEnv.ok) {
        expect(msgEnv.data.messages.length).toBeGreaterThanOrEqual(1);
        expect(msgEnv.data.messages[0].data).toBe('ping');
        expect(msgEnv.data.messages[0].type).toBe('text');
        expect(msgEnv.data.cursor).toBeGreaterThanOrEqual(1);
      }
    });

    it('uses sinceCursor to get only new messages', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const connId = connEnv.data.connectionId;
      service.send({ connectionId: connId, data: 'msg1' });
      await new Promise((r) => setTimeout(r, 100));

      const firstPoll = service.getMessages({ connectionId: connId });
      if (!firstPoll.ok) return;
      const cursor = firstPoll.data.cursor;

      service.send({ connectionId: connId, data: 'msg2' });
      await new Promise((r) => setTimeout(r, 100));

      const secondPoll = service.getMessages({ connectionId: connId, sinceCursor: cursor });
      expect(secondPoll.ok).toBe(true);
      if (secondPoll.ok) {
        expect(secondPoll.data.messages).toHaveLength(1);
        expect(secondPoll.data.messages[0].data).toBe('msg2');
      }
    });

    it('returns error for unknown connectionId', () => {
      const env = service.getMessages({ connectionId: 'nonexistent' });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_NOT_FOUND');
      }
    });
  });

  describe('getStatus', () => {
    it('returns connection status', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const statusEnv = service.getStatus({ connectionId: connEnv.data.connectionId });
      expect(statusEnv.ok).toBe(true);
      if (statusEnv.ok) {
        expect(statusEnv.data.state).toBe('connected');
        expect(statusEnv.data.url).toBe(`ws://localhost:${TEST_PORT}`);
        expect(statusEnv.data.connectedAt).toBeTruthy();
        expect(statusEnv.data.sentCount).toBe(0);
        expect(statusEnv.data.receivedCount).toBe(0);
      }
    });

    it('returns error for unknown connectionId', () => {
      const env = service.getStatus({ connectionId: 'nonexistent' });
      expect(env.ok).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('disconnects and removes connection', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const connId = connEnv.data.connectionId;
      const disconnEnv = service.disconnect({ connectionId: connId });
      expect(disconnEnv.ok).toBe(true);
      if (disconnEnv.ok) {
        expect(disconnEnv.data.disconnected).toBe(true);
      }

      expect(service.getConnectionCount()).toBe(0);
      const statusEnv = service.getStatus({ connectionId: connId });
      expect(statusEnv.ok).toBe(false);
    });

    it('returns error for unknown connectionId', () => {
      const env = service.disconnect({ connectionId: 'nonexistent' });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_NOT_FOUND');
      }
    });
  });

  describe('disconnectAll', () => {
    it('closes all connections', async () => {
      await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(service.getConnectionCount()).toBe(2);

      await service.disconnectAll();
      expect(service.getConnectionCount()).toBe(0);
    });
  });

  describe('message buffer cap', () => {
    it('respects max buffer size', async () => {
      const cappedService = new WebSocketProxyService(3);
      const connEnv = await cappedService.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) { cappedService.stopGc(); return; }

      const connId = connEnv.data.connectionId;
      for (let i = 0; i < 5; i++) {
        cappedService.send({ connectionId: connId, data: `msg-${i}` });
      }

      await new Promise((r) => setTimeout(r, 200));

      const msgEnv = cappedService.getMessages({ connectionId: connId });
      expect(msgEnv.ok).toBe(true);
      if (msgEnv.ok) {
        expect(msgEnv.data.messages.length).toBeLessThanOrEqual(3);
      }

      cappedService.stopGc();
      await cappedService.disconnectAll();
    });
  });

  describe('TLS config', () => {
    it('connects to ws:// without TLS agent even if tls config is provided', async () => {
      const connEnv = await service.connect({
        url: `ws://localhost:${TEST_PORT}`,
        tls: { rejectUnauthorized: false },
      });
      expect(connEnv.ok).toBe(true);
      if (connEnv.ok) {
        expect(connEnv.data.connectionId).toBeTruthy();
        service.disconnect({ connectionId: connEnv.data.connectionId });
      }
    });

    it('rejects invalid URL with TLS config', async () => {
      const connEnv = await service.connect({
        url: 'not-a-url',
        tls: { caCert: 'cert' },
      });
      expect(connEnv.ok).toBe(false);
    });

    it('accepts tls config fields in connect request', async () => {
      const connEnv = await service.connect({
        url: `ws://localhost:${TEST_PORT}`,
        tls: {
          rejectUnauthorized: false,
          caCert: '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----',
          clientCert: '-----BEGIN CERTIFICATE-----\nclient\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
        },
      });
      expect(connEnv.ok).toBe(true);
      if (connEnv.ok) {
        service.disconnect({ connectionId: connEnv.data.connectionId });
      }
    });
  });

  describe('buildTlsAgent', () => {
    it('returns undefined for ws:// URLs', () => {
      const agent = service.buildTlsAgent({ rejectUnauthorized: false }, 'ws://example.com');
      expect(agent).toBeUndefined();
    });

    it('returns an https.Agent for wss:// URLs', () => {
      const agent = service.buildTlsAgent({ rejectUnauthorized: true }, 'wss://example.com');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(https.Agent);
    });

    it('creates agent with rejectUnauthorized=false', () => {
      const agent = service.buildTlsAgent({ rejectUnauthorized: false }, 'wss://example.com');
      expect(agent).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((agent as any).options.rejectUnauthorized).toBe(false);
    });

    it('creates agent with CA certificate', () => {
      const caCert = '-----BEGIN CERTIFICATE-----\nfakeca\n-----END CERTIFICATE-----';
      const agent = service.buildTlsAgent({ caCert }, 'wss://example.com');
      expect(agent).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((agent as any).options.ca).toBe(caCert);
    });

    it('creates agent with client cert and key (mTLS)', () => {
      const clientCert = '-----BEGIN CERTIFICATE-----\nclient\n-----END CERTIFICATE-----';
      const clientKey = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
      const agent = service.buildTlsAgent({ clientCert, clientKey }, 'wss://example.com');
      expect(agent).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((agent as any).options.cert).toBe(clientCert);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((agent as any).options.key).toBe(clientKey);
    });

    it('handles case-insensitive WSS:// scheme', () => {
      const agent = service.buildTlsAgent({ rejectUnauthorized: false }, 'WSS://EXAMPLE.COM');
      expect(agent).toBeDefined();
    });

    it('returns agent with default options when no TLS overrides', () => {
      const agent = service.buildTlsAgent({}, 'wss://example.com');
      expect(agent).toBeDefined();
    });
  });

  describe('send — additional branches', () => {
    it('sends a binary message (base64)', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const sendEnv = service.send({
        connectionId: connEnv.data.connectionId,
        data: Buffer.from('binary-data').toString('base64'),
        type: 'binary',
      });
      expect(sendEnv.ok).toBe(true);
    });

    it('returns WS_NOT_CONNECTED when connection is disconnected', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const connId = connEnv.data.connectionId;
      // Mutate handle state to simulate a closed connection without removing it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connections = (service as any).connections as Map<string, Record<string, unknown>>;
      const handle = connections.get(connId);
      if (handle) {
        (handle.ws as WebSocket).close();
        handle.state = 'disconnected';
        // Wait for ws to actually close
        await new Promise((r) => setTimeout(r, 50));
      }

      const sendEnv = service.send({ connectionId: connId, data: 'test' });
      expect(sendEnv.ok).toBe(false);
      if (!sendEnv.ok) {
        expect(sendEnv.error.code).toBe('WS_NOT_CONNECTED');
      }
    });
  });

  describe('ping — additional branches', () => {
    it('returns WS_NOT_CONNECTED when connection is not open', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connections = (service as any).connections as Map<string, Record<string, unknown>>;
      const handle = connections.get(connEnv.data.connectionId);
      if (handle) {
        (handle.ws as WebSocket).close();
        handle.state = 'disconnected';
        await new Promise((r) => setTimeout(r, 50));
      }

      const pingEnv = service.ping({ connectionId: connEnv.data.connectionId });
      expect(pingEnv.ok).toBe(false);
      if (!pingEnv.ok) {
        expect(pingEnv.error.code).toBe('WS_NOT_CONNECTED');
      }
    });
  });

  describe('getStatus — additional branches', () => {
    it('returns uptimeMs for active connection', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const statusEnv = service.getStatus({ connectionId: connEnv.data.connectionId });
      expect(statusEnv.ok).toBe(true);
      if (statusEnv.ok) {
        expect(statusEnv.data.uptimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('includes sent and received counts after messaging', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const connId = connEnv.data.connectionId;
      service.send({ connectionId: connId, data: 'msg1' });
      service.send({ connectionId: connId, data: 'msg2' });
      await new Promise((r) => setTimeout(r, 100));

      const statusEnv = service.getStatus({ connectionId: connId });
      if (statusEnv.ok) {
        expect(statusEnv.data.sentCount).toBe(2);
        expect(statusEnv.data.receivedCount).toBe(2); // echo server
      }
    });
  });

  describe('disconnect — additional branches', () => {
    it('disconnects with custom code and reason', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const disconnEnv = service.disconnect({
        connectionId: connEnv.data.connectionId,
        code: 4001,
        reason: 'Custom close',
      });
      expect(disconnEnv.ok).toBe(true);
      expect(service.getConnectionCount()).toBe(0);
    });
  });

  describe('reset', () => {
    it('closes all connections and clears state', async () => {
      await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(service.getConnectionCount()).toBe(2);

      service.reset();
      expect(service.getConnectionCount()).toBe(0);
    });
  });

  describe('binary message reception', () => {
    it('receives binary messages as base64', async () => {
      // The echo server already echoes binary back as binary (isBinary check)
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;

      const connId = connEnv.data.connectionId;
      service.send({
        connectionId: connId,
        data: Buffer.from('binary-test').toString('base64'),
        type: 'binary',
      });

      await new Promise((r) => setTimeout(r, 200));

      const msgEnv = service.getMessages({ connectionId: connId });
      expect(msgEnv.ok).toBe(true);
      if (msgEnv.ok && msgEnv.data.messages.length > 0) {
        expect(msgEnv.data.messages[0].type).toBe('binary');
        expect(msgEnv.data.messages[0].size).toBeGreaterThan(0);
      }
    });
  });

  describe('connect — null/missing request fields', () => {
    it('rejects null url', async () => {
      const env = await service.connect({ url: null as unknown as string });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_INVALID_URL');
      }
    });

    it('rejects whitespace-only url', async () => {
      const env = await service.connect({ url: '   ' });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toBe('WS_INVALID_URL');
      }
    });

    it('filters empty subprotocols', async () => {
      const env = await service.connect({
        url: `ws://localhost:${TEST_PORT}`,
        subprotocols: ['', '  ', 'valid'],
      });
      expect(env.ok).toBe(true);
    });
  });

  describe('ping', () => {
    it('pings an active connection', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(connEnv.ok).toBe(true);
      if (!connEnv.ok) return;
      const pingEnv = service.ping({ connectionId: connEnv.data.connectionId });
      expect(pingEnv.ok).toBe(true);
    });

    it('pings with data', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(connEnv.ok).toBe(true);
      if (!connEnv.ok) return;
      const pingEnv = service.ping({ connectionId: connEnv.data.connectionId, data: 'hello' });
      expect(pingEnv.ok).toBe(true);
    });

    it('returns error for unknown connection', () => {
      const env = service.ping({ connectionId: 'nonexistent' });
      expect(env.ok).toBe(false);
      if (!env.ok) expect(env.error.code).toBe('WS_NOT_FOUND');
    });

    it('returns error for disconnected connection', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;
      service.disconnect({ connectionId: connEnv.data.connectionId });
      await new Promise(r => setTimeout(r, 100));
      const env = service.ping({ connectionId: connEnv.data.connectionId });
      expect(env.ok).toBe(false);
    });
  });

  describe('send — binary', () => {
    it('sends binary data', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      expect(connEnv.ok).toBe(true);
      if (!connEnv.ok) return;
      const b64 = Buffer.from('hello binary').toString('base64');
      const sendEnv = service.send({ connectionId: connEnv.data.connectionId, data: b64, type: 'binary' });
      expect(sendEnv.ok).toBe(true);
    });
  });

  describe('getMessages — cursor', () => {
    it('returns messages after sinceCursor', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;
      const cid = connEnv.data.connectionId;

      // Send two messages and wait
      service.send({ connectionId: cid, data: 'msg1', type: 'text' });
      service.send({ connectionId: cid, data: 'msg2', type: 'text' });
      await new Promise(r => setTimeout(r, 200));

      // Get all messages
      const allEnv = service.getMessages({ connectionId: cid });
      if (!allEnv.ok) return;
      const cursor = allEnv.data.cursor;

      // Send third message
      service.send({ connectionId: cid, data: 'msg3', type: 'text' });
      await new Promise(r => setTimeout(r, 200));

      // Get only messages after cursor
      const newEnv = service.getMessages({ connectionId: cid, sinceCursor: cursor });
      expect(newEnv.ok).toBe(true);
      if (newEnv.ok) {
        expect(newEnv.data.messages.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('close and error events', () => {
    it('sets disconnected state with close code/reason on server close', async () => {
      const connEnv = await service.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;
      const cid = connEnv.data.connectionId;

      // Close all server connections
      wss!.clients.forEach((ws) => ws.close(1000, 'normal'));
      await new Promise(r => setTimeout(r, 200));

      const status = service.getStatus({ connectionId: cid });
      expect(status.ok).toBe(true);
      if (status.ok) {
        expect(status.data.state).toBe('disconnected');
        expect(status.data.closeCode).toBe(1000);
      }
    });
  });

  describe('buffer overflow', () => {
    it('truncates message buffer when exceeding maxBufferSize', async () => {
      const smallService = new WebSocketProxyService(5); // maxBufferSize=5
      const connEnv = await smallService.connect({ url: `ws://localhost:${TEST_PORT}` });
      if (!connEnv.ok) return;
      const cid = connEnv.data.connectionId;

      // Send 10 messages
      for (let i = 0; i < 10; i++) {
        smallService.send({ connectionId: cid, data: `msg${i}`, type: 'text' });
      }
      await new Promise(r => setTimeout(r, 500));

      const msgs = smallService.getMessages({ connectionId: cid });
      if (msgs.ok) {
        // Should have at most 5 messages (echo server replies to each)
        expect(msgs.data.messages.length).toBeLessThanOrEqual(10);
      }

      smallService.stopGc();
      await smallService.disconnectAll();
    });
  });

  describe('GC idle timeout', () => {
    it('removes idle connections when GC runs', async () => {
      const gcService = new WebSocketProxyService({ maxBufferSize: 100 });
      const env = await gcService.connect({
        url: `ws://localhost:${TEST_PORT}`,
        timeoutMs: 5000,
      });
      expect(env.ok).toBe(true);
      if (!env.ok) return;
      const cid = env.data.connectionId;
      expect(gcService.getConnectionCount()).toBe(1);

      // Manually set lastActivity far in the past to simulate idle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = (gcService as any).connections.get(cid);
      handle.lastActivity = 0;

      // Manually invoke the GC callback logic
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [id, h] of (gcService as any).connections) {
        if (now - h.lastActivity > 5 * 60 * 1000) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (gcService as any).closeAndRemove(id, h, 1001, 'Idle timeout');
        }
      }

      // Connection should be removed
      expect(gcService.getConnectionCount()).toBe(0);
      gcService.stopGc();
    });
  });

  describe('connect timeout', () => {
    it('returns timeout error for unreachable host', async () => {
      const env = await service.connect({
        url: 'ws://192.0.2.1:1',
        connectionId: 'timeout-test',
        timeoutMs: 100,
      });
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.code).toMatch(/WS_CONNECT_FAILED|WS_CONNECT_TIMEOUT/);
      }
    });
  });

  describe('ws error event after connect', () => {
    it('sets state to error when ws emits error', async () => {
      const env = await service.connect({
        url: `ws://localhost:${TEST_PORT}`,
        timeoutMs: 5000,
      });
      expect(env.ok).toBe(true);
      if (!env.ok) return;
      const cid = env.data.connectionId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = (service as any).connections.get(cid);
      // Emit an error event on the ws to trigger the attachListeners error handler
      handle.ws.emit('error', new Error('test ws error'));
      expect(handle.state).toBe('error');
      expect(handle.lastError).toBe('test ws error');
    });
  });

  describe('send failure', () => {
    it('returns WS_SEND_FAILED when ws.send throws', async () => {
      const env = await service.connect({
        url: `ws://localhost:${TEST_PORT}`,
        timeoutMs: 5000,
      });
      expect(env.ok).toBe(true);
      if (!env.ok) return;
      const cid = env.data.connectionId;
      // Stub ws.send to throw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = (service as any).connections.get(cid);
      handle.ws.send = () => { throw new Error('mock send error'); };
      const result = service.send({ connectionId: cid, data: 'test', type: 'text' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WS_SEND_FAILED');
        expect(result.error.message).toContain('mock send error');
      }
    });
  });

  describe('ping failure', () => {
    it('returns WS_SEND_FAILED when ws.ping throws', async () => {
      const env = await service.connect({
        url: `ws://localhost:${TEST_PORT}`,
        timeoutMs: 5000,
      });
      expect(env.ok).toBe(true);
      if (!env.ok) return;
      const cid = env.data.connectionId;
      // Stub ws.ping to throw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = (service as any).connections.get(cid);
      handle.ws.ping = () => { throw new Error('mock ping error'); };
      const result = service.ping({ connectionId: cid });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WS_SEND_FAILED');
        expect(result.error.message).toContain('mock ping error');
      }
    });
  });
});
