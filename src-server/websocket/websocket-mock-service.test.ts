import { describe, it, expect, afterEach, vi } from 'vitest';

const wssCtorMode = vi.hoisted(() => ({ mode: 'normal' as 'normal' | 'throw' | 'throw-string' }));

vi.mock('ws', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ws')>();
  class PatchedWebSocketServer extends actual.WebSocketServer {
    constructor(...args: ConstructorParameters<typeof actual.WebSocketServer>) {
      if (wssCtorMode.mode === 'throw') {
        throw new Error('constructor boom');
      }
      if (wssCtorMode.mode === 'throw-string') {
        throw 'plain failure';
      }
      super(...args);
    }
  }
  return { ...actual, WebSocketServer: PatchedWebSocketServer };
});

import WebSocket from 'ws';
import { WebSocketMockService, WebSocketMockPool } from './websocket-mock-service.js';
import type { WsMockRule } from '../../src/shared/websocket/types';

function makeRule(overrides: Partial<WsMockRule> = {}): WsMockRule {
  return {
    id: 'r1',
    name: 'Test Rule',
    enabled: true,
    match: { type: 'any', pattern: '' },
    response: { type: 'echo' },
    ...overrides,
  };
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(data.toString()));
  });
}

describe('WebSocketMockService', () => {
  let service: WebSocketMockService;
  const port = 19876 + Math.floor(Math.random() * 1000);

  afterEach(async () => {
    wssCtorMode.mode = 'normal';
    service?.destroy();
    await waitMs(50);
  });

  it('starts and reports running status', async () => {
    service = new WebSocketMockService();
    const status = await service.start({ port, rules: [], fallback: 'echo' });
    expect(status.running).toBe(true);
    expect(status.port).toBe(port);
    expect(status.clientCount).toBe(0);
  });

  it('stops and reports stopped status', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });
    service.stop();
    const status = service.getStatus();
    expect(status.running).toBe(false);
  });

  it('accepts client connections', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });

    const client = await connectClient(port);
    await waitMs(50);

    const status = service.getStatus();
    expect(status.clientCount).toBe(1);
    expect(status.clients).toHaveLength(1);

    client.close();
    await waitMs(50);
  });

  it('echoes messages in echo fallback mode', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });

    const client = await connectClient(port);
    const msgPromise = waitForMessage(client);
    client.send('hello');
    const response = await msgPromise;
    expect(response).toBe('hello');

    client.close();
    await waitMs(50);
  });

  it('matches rules and sends static response', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'exact', pattern: 'ping' },
        response: { type: 'static', data: 'pong' },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    const msgPromise = waitForMessage(client);
    client.send('ping');
    const response = await msgPromise;
    expect(response).toBe('pong');

    client.close();
    await waitMs(50);
  });

  it('ignores messages when fallback is ignore and no rule matches', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({ match: { type: 'exact', pattern: 'never-match' }, response: { type: 'static', data: 'x' } }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    let received = false;
    client.on('message', () => { received = true; });
    client.send('hello');
    await waitMs(100);
    expect(received).toBe(false);

    client.close();
    await waitMs(50);
  });

  it('broadcasts to all connected clients', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'ignore' });

    const c1 = await connectClient(port);
    const c2 = await connectClient(port);
    await waitMs(50);

    const p1 = waitForMessage(c1);
    const p2 = waitForMessage(c2);
    const sent = service.broadcast('announcement');
    expect(sent).toBe(2);

    expect(await p1).toBe('announcement');
    expect(await p2).toBe('announcement');

    c1.close();
    c2.close();
    await waitMs(50);
  });

  it('tracks activity in log', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });

    const client = await connectClient(port);
    await waitMs(50);

    const msgPromise = waitForMessage(client);
    client.send('test');
    await msgPromise;
    await waitMs(50);

    const logs = service.getLogs();
    expect(logs.some((l) => l.event === 'server-start')).toBe(true);
    expect(logs.some((l) => l.event === 'client-connect')).toBe(true);
    expect(logs.some((l) => l.event === 'message-in')).toBe(true);
    expect(logs.some((l) => l.event === 'response-out')).toBe(true);

    client.close();
    await waitMs(50);
  });

  it('getLogs with sinceCursor returns only new entries', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });

    const allLogs = service.getLogs();
    const cursor = allLogs[allLogs.length - 1]?.id ?? 0;

    const client = await connectClient(port);
    await waitMs(50);

    const newLogs = service.getLogs(cursor);
    expect(newLogs.length).toBeGreaterThan(0);
    expect(newLogs.every((l) => l.id > cursor)).toBe(true);

    client.close();
    await waitMs(50);
  });

  it('stops all clients on stop with code 1001', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });

    const client = await connectClient(port);
    let closeCode = 0;
    const closePromise = new Promise<void>((resolve) => {
      client.on('close', (code) => { closeCode = code; resolve(); });
    });

    service.stop();
    await closePromise;
    expect(closeCode).toBe(1001);
  });

  it('handles template responses', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'any', pattern: '' },
        response: { type: 'template', data: '{"echo":"{{message}}","n":{{counter}}}' },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    const msgPromise = waitForMessage(client);
    client.send('hello');
    const response = await msgPromise;
    const parsed = JSON.parse(response);
    expect(parsed.echo).toBe('hello');
    expect(parsed.n).toBe(1);

    client.close();
    await waitMs(50);
  });

  it('handles delayed responses', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'any', pattern: '' },
        response: { type: 'static', data: 'delayed', delay: 100 },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    const start = Date.now();
    const msgPromise = waitForMessage(client);
    client.send('test');
    await msgPromise;
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80);

    client.close();
    await waitMs(50);
  });

  it('updateRules changes rules at runtime', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'ignore' });

    const client = await connectClient(port);
    let received = false;
    client.on('message', () => { received = true; });

    client.send('test');
    await waitMs(50);
    expect(received).toBe(false);

    service.updateRules([makeRule({ match: { type: 'any', pattern: '' }, response: { type: 'echo' } })]);

    const msgPromise = waitForMessage(client);
    client.send('test2');
    const resp = await msgPromise;
    expect(resp).toBe('test2');

    client.close();
    await waitMs(50);
  });

  it('rejects start with port in use', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });

    const service2 = new WebSocketMockService();
    await expect(service2.start({ port, rules: [], fallback: 'echo' })).rejects.toThrow();
    service2.destroy();
  });

  it('sanitizes invalid close codes to 1000', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'any', pattern: '' },
        response: { type: 'close', closeCode: 999, closeReason: 'bad code' },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    let closeCode = 0;
    const closePromise = new Promise<void>((resolve) => {
      client.on('close', (code) => { closeCode = code; resolve(); });
    });
    client.send('test');
    await closePromise;
    expect(closeCode).toBe(1000);
  });

  it('template response with null data sends nothing', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'any', pattern: '' },
        response: { type: 'template', data: undefined as unknown as string },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    let received = false;
    client.on('message', () => { received = true; });
    client.send('test');
    await waitMs(100);
    expect(received).toBe(false);

    client.close();
    await waitMs(50);
  });

  it('static response with null data sends nothing', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'any', pattern: '' },
        response: { type: 'static', data: undefined as unknown as string },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    let received = false;
    client.on('message', () => { received = true; });
    client.send('test');
    await waitMs(100);
    expect(received).toBe(false);

    client.close();
    await waitMs(50);
  });

  it('close response uses valid custom close codes', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'any', pattern: '' },
        response: { type: 'close', closeCode: 3000, closeReason: 'custom' },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    let closeCode = 0;
    const closePromise = new Promise<void>((resolve) => {
      client.on('close', (code) => { closeCode = code; resolve(); });
    });
    client.send('test');
    await closePromise;
    expect(closeCode).toBe(3000);
  });

  it('close response defaults closeCode to 1000 and closeReason to empty', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'any', pattern: '' },
        response: { type: 'close' },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    let closeCode = 0;
    const closePromise = new Promise<void>((resolve) => {
      client.on('close', (code) => { closeCode = code; resolve(); });
    });
    client.send('test');
    await closePromise;
    expect(closeCode).toBe(1000);
  });

  it('delayed response is cancelled on destroy', async () => {
    service = new WebSocketMockService();
    const rules: WsMockRule[] = [
      makeRule({
        match: { type: 'any', pattern: '' },
        response: { type: 'static', data: 'delayed', delay: 5000 },
      }),
    ];
    await service.start({ port, rules, fallback: 'ignore' });

    const client = await connectClient(port);
    client.send('test');
    await waitMs(50);

    // Destroy before delay fires — should not throw
    service.destroy();
    await waitMs(50);

    // Client should be disconnected
    expect(client.readyState).not.toBe(WebSocket.OPEN);
  });

  it('handles restart (stop then start)', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });
    const status1 = service.getStatus();
    expect(status1.running).toBe(true);

    // Idempotent: calling start again on same port updates config without restart
    const status2 = await service.start({ port, rules: [], fallback: 'ignore' });
    expect(status2.running).toBe(true);
    // Fallback should be updated (verify via behavior, not status object)
  });

  it('restarts when port changes', async () => {
    service = new WebSocketMockService();
    const port2 = port + 1;
    await service.start({ port, rules: [], fallback: 'echo' });
    expect(service.getStatus().running).toBe(true);

    // Different port forces a restart
    const status2 = await service.start({ port: port2, rules: [], fallback: 'echo' });
    expect(status2.running).toBe(true);
    expect(status2.port).toBe(port2);
    // Original port should be free now
  });

  it('updateRules also updates fallback when provided', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });

    const client = await connectClient(port);

    // Initially echo mode
    const msg1Promise = waitForMessage(client);
    client.send('hello');
    expect(await msg1Promise).toBe('hello');

    // Switch to ignore mode
    service.updateRules([], 'ignore');
    let received = false;
    client.on('message', () => { received = true; });
    client.send('hello2');
    await waitMs(100);
    expect(received).toBe(false);

    client.close();
    await waitMs(50);
  });

  it('truncates long message data in logs', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'echo' });

    const client = await connectClient(port);
    const longMsg = 'x'.repeat(600);
    const msgPromise = waitForMessage(client);
    client.send(longMsg);
    await msgPromise;
    await waitMs(50);

    const logs = service.getLogs();
    const msgIn = logs.find((l) => l.event === 'message-in');
    expect(msgIn).toBeDefined();
    expect(msgIn!.data!.length).toBeLessThanOrEqual(501);
    expect(msgIn!.data!.endsWith('\u2026')).toBe(true);

    client.close();
    await waitMs(50);
  });

  it('triggers server-side ws error handler', async () => {
    service = new WebSocketMockService();
    const errPort = port + 50;
    await service.start({ port: errPort, rules: [], fallback: 'echo' });
    const client = await connectClient(errPort);
    await waitMs(30);
    const internal = service as unknown as { clients: Map<string, { ws: WebSocket }> };
    const serverWs = [...internal.clients.values()][0]?.ws;
    expect(serverWs).toBeDefined();
    serverWs!.emit('error', new Error('server ws error'));
    await waitMs(30);
    expect(service.getLogs().some((l) => l.event === 'error' && l.data === 'server ws error')).toBe(true);
    client.close();
    await waitMs(50);
  });

  it('trims log buffer when exceeding MAX_LOG_ENTRIES', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'ignore' });
    const client = await connectClient(port);
    for (let i = 0; i < 210; i += 1) {
      client.send(`msg-${i}`);
      await waitMs(1);
    }
    await waitMs(100);
    expect(service.getLogs().length).toBeLessThanOrEqual(200);
    client.close();
    await waitMs(50);
  });

  it('handles binary client messages as utf-8 strings', async () => {
    service = new WebSocketMockService();
    await service.start({
      port,
      rules: [makeRule({ match: { type: 'exact', pattern: 'binary-data' }, response: { type: 'static', data: 'ok' } })],
      fallback: 'ignore',
    });

    const client = await connectClient(port);
    const msgPromise = waitForMessage(client);
    client.send(Buffer.from('binary-data'));
    expect(await msgPromise).toBe('ok');
    client.close();
    await waitMs(50);
  });

  it('ignores messages when fallback is ignore and no rule matches', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'ignore' });

    const client = await connectClient(port);
    let received = false;
    client.on('message', () => { received = true; });
    client.send('unmatched-message');
    await waitMs(80);
    expect(received).toBe(false);
    expect(service.getLogs().some((l) => l.event === 'message-in' && l.data === 'unmatched-message')).toBe(true);
    expect(service.getLogs().some((l) => l.event === 'response-out')).toBe(false);

    client.close();
    await waitMs(50);
  });

  it('broadcast skips closed clients and omits log when nothing sent', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'ignore' });
    expect(service.broadcast('nobody listening')).toBe(0);
    expect(service.getLogs().some((l) => l.event === 'response-out')).toBe(false);
  });

  it('broadcast sends to open clients and logs outbound data', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'ignore' });
    const client = await connectClient(port);
    const msgPromise = waitForMessage(client);
    const sent = service.broadcast('broadcast-msg');
    expect(sent).toBe(1);
    expect(await msgPromise).toBe('broadcast-msg');
    expect(service.getLogs().some((l) => l.event === 'response-out' && l.data?.includes('broadcast-msg'))).toBe(true);
    client.close();
    await waitMs(50);
  });

  it('rejects start when WebSocketServer constructor throws synchronously', async () => {
    wssCtorMode.mode = 'throw';
    service = new WebSocketMockService();
    await expect(service.start({ port: port + 200, rules: [], fallback: 'echo' }))
      .rejects.toThrow('constructor boom');
    expect(service.getLogs().some((l) => l.event === 'error' && l.data === 'constructor boom')).toBe(true);
  });

  it('rejects start when constructor throws a non-Error value', async () => {
    wssCtorMode.mode = 'throw-string';
    service = new WebSocketMockService();
    await expect(service.start({ port: port + 201, rules: [], fallback: 'echo' }))
      .rejects.toThrow('plain failure');
    expect(service.getLogs().some((l) => l.event === 'error' && l.data === 'plain failure')).toBe(true);
  });

  it('rejects start when server emits error before listening', async () => {
    service = new WebSocketMockService();
    const conflictPort = port + 300;
    await service.start({ port: conflictPort, rules: [], fallback: 'echo' });
    const service2 = new WebSocketMockService();
    await expect(service2.start({ port: conflictPort, rules: [], fallback: 'echo' }))
      .rejects.toThrow(/EADDRINUSE|listen/);
    expect(service2.getStatus().error).toBeTruthy();
  });

  it('skips delayed response when client disconnects before delay elapses', async () => {
    service = new WebSocketMockService();
    await service.start({
      port,
      rules: [makeRule({ response: { type: 'static', data: 'delayed', delay: 200 } })],
      fallback: 'ignore',
    });
    const client = await connectClient(port);
    let received = false;
    client.on('message', () => { received = true; });
    client.send('trigger');
    client.close();
    await waitMs(250);
    expect(received).toBe(false);
    expect(service.getLogs().some((l) => l.event === 'response-out')).toBe(false);
    await waitMs(50);
  });

  it('logs unknown remote address when socket has no remoteAddress', async () => {
    service = new WebSocketMockService();
    const listenPort = port + 400;
    await service.start({ port: listenPort, rules: [], fallback: 'echo' });
    const internal = service as unknown as {
      wss: { emit: (event: string, ws: WebSocket, req: { socket: { remoteAddress?: string } }) => void };
    };
    const syntheticWs = Object.assign(new EventTarget(), {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      terminate: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'message') {
          (syntheticWs as { _msgHandler?: (...args: unknown[]) => void })._msgHandler = handler;
        }
      }),
    }) as unknown as WebSocket;
    internal.wss.emit('connection', syntheticWs, { socket: { remoteAddress: undefined } });
    expect(service.getLogs().some((l) => l.event === 'client-connect' && l.data === 'unknown')).toBe(true);
  });

  it('broadcast skips clients that are no longer open', async () => {
    service = new WebSocketMockService();
    await service.start({ port, rules: [], fallback: 'ignore' });
    const client = await connectClient(port);
    client.close();
    await waitMs(50);
    expect(service.broadcast('after-close')).toBe(0);
  });
});

describe('WebSocketMockPool', () => {
  let pool: WebSocketMockPool;

  afterEach(async () => {
    pool.stopAll();
    await waitMs(50);
  });

  it('getOrCreate creates a new service for an unknown port', () => {
    pool = new WebSocketMockPool();
    const svc = pool.getOrCreate(19400);
    expect(svc).toBeInstanceOf(WebSocketMockService);
  });

  it('getOrCreate returns the same service for the same port', () => {
    pool = new WebSocketMockPool();
    const svc1 = pool.getOrCreate(19401);
    const svc2 = pool.getOrCreate(19401);
    expect(svc1).toBe(svc2);
  });

  it('get returns undefined for unknown port', () => {
    pool = new WebSocketMockPool();
    expect(pool.get(19402)).toBeUndefined();
  });

  it('get returns service for known port', () => {
    pool = new WebSocketMockPool();
    const created = pool.getOrCreate(19403);
    expect(pool.get(19403)).toBe(created);
  });

  it('release removes and stops the service', async () => {
    pool = new WebSocketMockPool();
    const svc = pool.getOrCreate(19404);
    await svc.start({ port: 19404, rules: [], fallback: 'echo' });
    await waitMs(30);
    pool.release(19404);
    expect(pool.get(19404)).toBeUndefined();
    await waitMs(50);
  });

  it('release is a no-op for unknown port', () => {
    pool = new WebSocketMockPool();
    expect(() => pool.release(19405)).not.toThrow();
  });

  it('stopAll stops all services and clears the pool', async () => {
    pool = new WebSocketMockPool();
    const svc1 = pool.getOrCreate(19406);
    const svc2 = pool.getOrCreate(19407);
    await svc1.start({ port: 19406, rules: [], fallback: 'echo' });
    await svc2.start({ port: 19407, rules: [], fallback: 'echo' });
    await waitMs(30);
    pool.stopAll();
    expect(pool.get(19406)).toBeUndefined();
    expect(pool.get(19407)).toBeUndefined();
    await waitMs(50);
  });
});
