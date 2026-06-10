import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { WebSocketMockService } from './websocket-mock-service';
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
});
