/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { ApiMockNetworkListener, isPortAvailable } from './ApiMockNetworkListener';
import * as proxyExecutor from './apiMockProxyExecutor';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeDef(port: number, overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-test',
    name: 'Test',
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    variables: [],
    samples: [],
    routes: [{
      id: 'r1',
      name: 'Test Route',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/hello' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [{
        ...createDefaultResponse('resp-1'),
        status: 200,
        body: { kind: 'text', content: 'Hello from mock', contentType: 'text/plain' },
      }],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

let nextPort = 20100 + Math.floor(Math.random() * 500);
function getPort() { return nextPort++; }

describe('ApiMockNetworkListener coverage gaps', () => {
  const listeners: ApiMockNetworkListener[] = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const listener of listeners) {
      if (listener.isRunning()) await listener.stop();
    }
    listeners.length = 0;
  });

  it('supports sequence-mode selection and resetScenario', async () => {
    const port = getPort();
    const def = makeDef(port, {
      routes: [{
        ...makeDef(port).routes[0],
        responseMode: 'sequence',
        responses: [
          { ...createDefaultResponse('resp-1'), enabled: true, status: 200, isDefault: true, body: { kind: 'text', content: 'one', contentType: 'text/plain' } },
          { ...createDefaultResponse('resp-2'), enabled: true, status: 201, isDefault: false, body: { kind: 'text', content: 'two', contentType: 'text/plain' } },
        ],
      }],
    });
    const listener = new ApiMockNetworkListener({ serverId: 'srv-seq', definition: def });
    listeners.push(listener);
    await listener.start();

    expect(listener.getServerId()).toBe('srv-seq');
    expect(listener.getPort()).toBe(port);

    expect(await (await fetch(`http://127.0.0.1:${port}/hello`)).text()).toBe('one');
    expect(await (await fetch(`http://127.0.0.1:${port}/hello`)).text()).toBe('two');
    listener.resetScenario();
    expect(await (await fetch(`http://127.0.0.1:${port}/hello`)).text()).toBe('one');
  });

  it('supports weighted and state response modes and exposes scenario state', async () => {
    const weightedPort = getPort();
    const weightedDef = makeDef(weightedPort, {
      routes: [{
        ...makeDef(weightedPort).routes[0],
        responseMode: 'weighted',
        responses: [
          { ...createDefaultResponse('resp-off'), enabled: false, weight: 50, body: { kind: 'text', content: 'off', contentType: 'text/plain' } },
          { ...createDefaultResponse('resp-on'), enabled: true, weight: 100, isDefault: true, status: 202, body: { kind: 'text', content: 'weighted', contentType: 'text/plain' } },
        ],
      }],
    });
    const weighted = new ApiMockNetworkListener({ serverId: 'srv-weighted', definition: weightedDef });
    listeners.push(weighted);
    await weighted.start();
    const weightedRes = await fetch(`http://127.0.0.1:${weightedPort}/hello`);
    expect(weightedRes.status).toBe(202);
    expect(await weightedRes.text()).toBe('weighted');

    const statePort = getPort();
    const stateDef = makeDef(statePort, {
      routes: [{
        ...makeDef(statePort).routes[0],
        responseMode: 'state',
        responses: [
          {
            ...createDefaultResponse('resp-default'),
            enabled: true,
            isDefault: true,
            body: { kind: 'text', content: 'idle', contentType: 'text/plain' },
            transition: { targetState: 'active' },
          },
          {
            ...createDefaultResponse('resp-active'),
            enabled: true,
            isDefault: false,
            status: 203,
            body: { kind: 'text', content: 'active', contentType: 'text/plain' },
            transition: { currentState: 'active', targetState: 'done' },
          },
        ],
      }],
    });
    const stateListener = new ApiMockNetworkListener({ serverId: 'srv-state', definition: stateDef });
    listeners.push(stateListener);
    await stateListener.start();
    expect(await (await fetch(`http://127.0.0.1:${statePort}/hello`)).text()).toBe('idle');
    expect(stateListener.getScenarioState().states.default).toBe('active');
    const second = await fetch(`http://127.0.0.1:${statePort}/hello`);
    expect(second.status).toBe(203);
    expect(await second.text()).toBe('active');
  });

  it('uses enabled fallback rule selection, records truncation, and tolerates missing transaction handlers', async () => {
    const port = getPort();
    const transactions: unknown[] = [];
    const def = makeDef(port, {
      routes: [{
        ...makeDef(port).routes[0],
        method: 'POST',
        path: { kind: 'exact', value: '/post' },
        responses: [
          { ...createDefaultResponse('resp-disabled'), enabled: false, isDefault: true, body: { kind: 'text', content: 'disabled', contentType: 'text/plain' } },
          { ...createDefaultResponse('resp-long'), enabled: true, isDefault: false, status: 204, body: { kind: 'text', content: 'X'.repeat(1100), contentType: 'text/plain' } },
        ],
      }],
      settings: {
        ...DEFAULT_SETTINGS,
        limits: { ...DEFAULT_SETTINGS.limits, maxInboundBodyBytes: 5 },
        journal: { ...DEFAULT_SETTINGS.journal, maxCapturedBodyBytes: 1024 },
      },
    });
    const listener = new ApiMockNetworkListener({ serverId: 'srv-post', definition: def, onTransaction: tx => transactions.push(tx) });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/post`, { method: 'POST', body: 'ABCDEFGHIJK' });
    expect(res.status).toBe(204);
    expect(transactions).toHaveLength(1);
    const tx = transactions[0] as any;
    expect(tx.request.bodyTruncated).toBe(true);
    expect(tx.request.body).toBeNull();
    expect(tx.response.bodyTruncated).toBe(true);
    expect(tx.response.body.length).toBe(1024);

    const noHandlerPort = getPort();
    const noHandler = new ApiMockNetworkListener({ serverId: 'srv-nohandler', definition: makeDef(noHandlerPort) });
    listeners.push(noHandler);
    await noHandler.start();
    const noHandlerRes = await fetch(`http://127.0.0.1:${noHandlerPort}/hello`);
    expect(noHandlerRes.status).toBe(200);
  });

  it('falls back when a matched route has no selectable variant and uses the immediate send path', async () => {
    const port = getPort();
    const transactions: unknown[] = [];
    const def = makeDef(port, {
      routes: [{
        ...makeDef(port).routes[0],
        responseMode: 'weighted',
        responses: [
          {
            ...createDefaultResponse('resp-disabled'),
            enabled: false,
            isDefault: false,
            body: { kind: 'text', content: 'disabled', contentType: 'text/plain' },
          },
        ],
      }],
    });
    const listener = new ApiMockNetworkListener({ serverId: 'srv-fallback', definition: def, onTransaction: tx => transactions.push(tx) });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(res.status).toBe(200);
    expect((await res.text())).toBe('');
    const tx = transactions[0] as any;
    expect(tx.response.headers).toEqual({});
    expect(tx.response.body).toBe('');
  });

  it('captures small request bodies, applies delayed sends, and skips disabled response headers', async () => {
    vi.useFakeTimers();
    const transactions: unknown[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-direct',
      definition: makeDef(getPort(), {
        routes: [{
          ...makeDef(0).routes[0],
          method: 'GET',
          path: { kind: 'exact', value: '/' },
          responses: [{
            ...createDefaultResponse('resp-delay'),
            enabled: true,
            isDefault: true,
            headers: [
              { id: 'h1', key: 'x-disabled', value: 'off', enabled: false },
              { id: 'h2', key: 'x-enabled', value: 'on', enabled: true },
            ],
            body: { kind: 'text', content: 'delayed', contentType: 'text/plain' },
            behavior: { delayMs: 5, jitterMs: 0 },
          }],
        }],
      }),
      onTransaction: tx => transactions.push(tx),
    });

    const req = new EventEmitter() as any;
    req.method = undefined;
    req.url = undefined;
    req.headers = {};
    req.socket = { remoteAddress: '127.0.0.1' };
    const res = {
      headersSent: false,
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as any;

    (listener as any).handleRequest(req, res);
    req.emit('data', Buffer.from('abc'));
    req.emit('end');

    expect(res.writeHead).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5);
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'x-enabled': 'on', 'Content-Type': 'text/plain' });
    expect(res.end).toHaveBeenCalledWith('delayed');
    const tx = transactions[0] as any;
    expect(tx.request.method).toBe('GET');
    expect(tx.request.path).toBe('/');
    expect(tx.request.body).toBe('abc');
    vi.useRealTimers();
  });

  it('supports 0.0.0.0 listeners, duplicate start rejection, and raw request error handling', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-any', definition: makeDef(port, { host: '0.0.0.0' }) });
    listeners.push(listener);
    await listener.start();
    await expect(listener.start()).rejects.toThrow('already running');
    const hostRes = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(hostRes.status).toBe(200);

    const availabilityPort = getPort();
    const availabilityListener = new ApiMockNetworkListener({ serverId: 'srv-avail', definition: makeDef(availabilityPort) });
    listeners.push(availabilityListener);
    await availabilityListener.start();
    expect(await isPortAvailable(availabilityPort)).toBe(false);
    await availabilityListener.stop();
    expect(await isPortAvailable(availabilityPort)).toBe(true);

    const req = new EventEmitter() as any;
    req.method = 'GET';
    req.url = '/hello';
    req.headers = {};
    req.socket = { remoteAddress: '127.0.0.1' };
    const res = {
      headersSent: false,
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as any;
    (listener as any).handleRequest(req, res);
    req.emit('error', new Error('bad request'));
    expect(res.writeHead).toHaveBeenCalledWith(400);
    expect(res.end).toHaveBeenCalled();

    const resSent = {
      headersSent: true,
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as any;
    const reqSent = new EventEmitter() as any;
    reqSent.method = 'GET';
    reqSent.url = '/hello';
    reqSent.headers = {};
    reqSent.socket = { remoteAddress: '127.0.0.1' };
    (listener as any).handleRequest(reqSent, resSent);
    reqSent.emit('error', new Error('late error'));
    expect(resSent.writeHead).not.toHaveBeenCalled();

    const stoppedListener = new ApiMockNetworkListener({ serverId: 'srv-stop', definition: makeDef(getPort()) });
    await expect(stoppedListener.stop()).resolves.toBeUndefined();
  });

  it('executes reset fault without completing a normal HTTP body', async () => {
    const port = getPort();
    const def = makeDef(port, {
      routes: [{
        ...makeDef(port).routes[0],
        responses: [{
          ...createDefaultResponse('resp-1'),
          status: 200,
          body: { kind: 'text', content: 'should-not-arrive', contentType: 'text/plain' },
          behavior: { delayMs: 0, jitterMs: 0, fault: 'reset' },
        }],
      }],
    });
    const txs: any[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-fault',
      definition: def,
      onTransaction: tx => txs.push(tx),
    });
    listeners.push(listener);
    await listener.start();

    await expect(fetch(`http://127.0.0.1:${port}/hello`)).rejects.toThrow();
    await vi.waitFor(() => expect(txs.length).toBe(1));
    expect(txs[0].outcome).toBe('fault');
    expect(txs[0].matchedResponseId).toBe('resp-1');
  });

  it('applies response transforms before delivery', async () => {
    const port = getPort();
    const def = makeDef(port, {
      routes: [{
        ...makeDef(port).routes[0],
        responses: [{
          ...createDefaultResponse('resp-1'),
          status: 200,
          body: { kind: 'text', content: 'raw', contentType: 'text/plain' },
          transforms: [
            { id: 't1', enabled: true, target: 'response', op: 'setHeader', key: 'X-Transformed', value: '1' },
            { id: 't2', enabled: true, target: 'response', op: 'setStatus', value: '201' },
            { id: 't3', enabled: true, target: 'response', op: 'replaceBody', value: 'transformed' },
          ],
        }],
      }],
    });
    const listener = new ApiMockNetworkListener({ serverId: 'srv-xf', definition: def });
    listeners.push(listener);
    await listener.start();
    const res = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(res.status).toBe(201);
    expect(res.headers.get('x-transformed')).toBe('1');
    expect(await res.text()).toBe('transformed');
  });

  it('records proxied exchanges as inactive drafts when enabled', async () => {
    const port = getPort();
    const drafts: any[] = [];
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('upstream.example.com')) {
        return new Response('{"upstream":true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return realFetch(input, init);
    }));

    const def = makeDef(port, {
      routes: [],
      settings: {
        ...DEFAULT_SETTINGS,
        fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
        proxy: {
          ...DEFAULT_SETTINGS.proxy!,
          enabled: true,
          allowlist: ['https://upstream.example.com'],
          blockPrivateNetworks: false,
          recordAsDrafts: true,
        },
      },
    });
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-rec',
      definition: def,
      onRecordedDraft: d => drafts.push(d),
      getActiveMockPorts: () => [port],
    });
    listeners.push(listener);
    await listener.start();

    try {
      const res = await fetch(`http://127.0.0.1:${port}/captured`);
      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(drafts.length).toBe(1));
      expect(drafts[0].route.enabled).toBe(false);
      expect(drafts[0].fingerprint).toContain('GET /captured');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects anti-recursion proxy loops with 508', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-loop',
      definition: makeDef(port),
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/hello`, {
      headers: { 'x-redfireforge-mock': 'true' },
    });
    expect(res.status).toBe(508);
    const body = await res.json();
    expect(body.error).toBe('loop_detected');
  });

  it('returns 502 when proxy fallback is enabled without allowlist', async () => {
    const port = getPort();
    const txs: any[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-proxy',
      definition: makeDef(port, {
        routes: [],
        settings: {
          ...DEFAULT_SETTINGS,
          fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
          proxy: { ...DEFAULT_SETTINGS.proxy!, enabled: true, allowlist: [] },
        },
      }),
      onTransaction: tx => txs.push(tx),
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/missing`);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('proxy_misconfigured');
    await vi.waitFor(() => expect(txs.length).toBe(1));
    expect(txs[0].outcome).toBe('error');
  });

  it('returns closest-match debug JSON for unmatched requests when configured', async () => {
    const port = getPort();
    const txs: any[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-closest',
      definition: makeDef(port, {
        routes: [],
        settings: {
          ...DEFAULT_SETTINGS,
          fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'closest_match_debug' },
        },
      }),
      onTransaction: tx => txs.push(tx),
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/almost`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.mode).toBe('closest_match_debug');
    expect(txs).toHaveLength(1);
    expect(txs[0].outcome).toBe('unmatched');
  });

  it('returns proxy_failed when upstream fetch rejects', async () => {
    const port = getPort();
    const txs: any[] = [];
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('upstream.example.com')) {
        throw new Error('upstream down');
      }
      return realFetch(input, init);
    }));

    const listener = new ApiMockNetworkListener({
      serverId: 'srv-proxy-fail',
      definition: makeDef(port, {
        routes: [],
        settings: {
          ...DEFAULT_SETTINGS,
          fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
          proxy: {
            ...DEFAULT_SETTINGS.proxy!,
            enabled: true,
            allowlist: ['https://upstream.example.com'],
            blockPrivateNetworks: false,
          },
        },
      }),
      onTransaction: tx => txs.push(tx),
      getActiveMockPorts: () => [port],
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/missing`);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('proxy_failed');
    expect(body.message).toContain('upstream down');
    await vi.waitFor(() => expect(txs.length).toBe(1));
    expect(txs[0].outcome).toBe('error');
  });

  it('falls back to another variant when the selected one hits maxMatches', async () => {
    const port = getPort();
    const def = makeDef(port, {
      routes: [{
        ...makeDef(port).routes[0],
        responseMode: 'rules',
        responses: [
          {
            ...createDefaultResponse('resp-limited'),
            enabled: true,
            isDefault: true,
            status: 200,
            body: { kind: 'text', content: 'first', contentType: 'text/plain' },
            behavior: { delayMs: 0, jitterMs: 0, maxMatches: 1 },
          },
          {
            ...createDefaultResponse('resp-fallback'),
            enabled: true,
            isDefault: false,
            status: 201,
            body: { kind: 'text', content: 'fallback', contentType: 'text/plain' },
            behavior: { delayMs: 0, jitterMs: 0 },
          },
        ],
      }],
    });
    const listener = new ApiMockNetworkListener({ serverId: 'srv-max', definition: def });
    listeners.push(listener);
    await listener.start();

    expect(await (await fetch(`http://127.0.0.1:${port}/hello`)).text()).toBe('first');
    const second = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(second.status).toBe(201);
    expect(await second.text()).toBe('fallback');
  });

  it('fires enabled callbacks after delivering a matched response', async () => {
    const port = getPort();
    const realFetch = globalThis.fetch.bind(globalThis);
    const callbackFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('callback.example.com')) {
        return new Response('ok', { status: 204 });
      }
      return realFetch(input, init);
    });
    vi.stubGlobal('fetch', callbackFetch);

    const listener = new ApiMockNetworkListener({
      serverId: 'srv-cb',
      definition: makeDef(port, {
        routes: [{
          ...makeDef(port).routes[0],
          responses: [{
            ...createDefaultResponse('resp-1'),
            callbacks: [{
              id: 'cb-1',
              enabled: true,
              method: 'POST',
              url: 'https://callback.example.com/hook',
              headers: [],
              bodyTemplate: '{"done":true}',
              timeoutMs: 5000,
              maxRetries: 0,
            }],
          }],
        }],
        settings: {
          ...DEFAULT_SETTINGS,
          callbacks: { allowlist: ['https://callback.example.com/hook'] },
          proxy: { ...DEFAULT_SETTINGS.proxy!, blockPrivateNetworks: false },
        },
      }),
      getActiveMockPorts: () => [port],
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(callbackFetch).toHaveBeenCalledWith(
      'https://callback.example.com/hook',
      expect.objectContaining({ method: 'POST' }),
    ));
  });

  it('rejects TLS start when cert/key are missing or material is invalid', async () => {
    const missingCert = new ApiMockNetworkListener({
      serverId: 'srv-tls-missing',
      definition: makeDef(getPort(), {
        settings: {
          ...DEFAULT_SETTINGS,
          tls: { enabled: true, certPem: '', keyPem: '', selfSigned: false },
        },
      }),
    });
    await expect(missingCert.start()).rejects.toThrow(/certificate and key/i);

    const badMaterial = new ApiMockNetworkListener({
      serverId: 'srv-tls-bad',
      definition: makeDef(getPort(), {
        settings: {
          ...DEFAULT_SETTINGS,
          tls: { enabled: true, certPem: 'not-a-cert', keyPem: 'not-a-key', selfSigned: false },
        },
      }),
    });
    await expect(badMaterial.start()).rejects.toThrow(/TLS material rejected/i);
  });

  it('swallows draft recording errors without affecting proxy delivery', async () => {
    const port = getPort();
    const recording = await import('../../src/shared/api-mock/proxyRecording.js');
    vi.spyOn(recording, 'toRecordedDraft').mockImplementation(() => {
      throw new Error('draft failed');
    });
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('upstream.example.com')) {
        return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return realFetch(input, init);
    }));

    const listener = new ApiMockNetworkListener({
      serverId: 'srv-rec-fail',
      definition: makeDef(port, {
        routes: [],
        settings: {
          ...DEFAULT_SETTINGS,
          fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
          proxy: {
            ...DEFAULT_SETTINGS.proxy!,
            enabled: true,
            allowlist: ['https://upstream.example.com'],
            blockPrivateNetworks: false,
            recordAsDrafts: true,
          },
        },
      }),
      onRecordedDraft: vi.fn(),
      getActiveMockPorts: () => [port],
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/safe`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('uses default active port list when getActiveMockPorts is omitted', async () => {
    const port = getPort();
    const txs: any[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-ports',
      definition: makeDef(port, {
        routes: [],
        settings: {
          ...DEFAULT_SETTINGS,
          fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
          proxy: {
            ...DEFAULT_SETTINGS.proxy!,
            enabled: true,
            allowlist: ['https://upstream.example.com'],
            blockPrivateNetworks: false,
          },
        },
      }),
      onTransaction: tx => txs.push(tx),
    });
    listeners.push(listener);
    await listener.start();

    vi.spyOn(proxyExecutor, 'executeProxy').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { 'x-multi': ['a', 'b'] },
      body: '{"ok":true}',
    });

    const res = await fetch(`http://127.0.0.1:${port}/proxy-path`);
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(txs.length).toBe(1));
    expect(txs[0].response.headers['x-multi']).toEqual(['a', 'b']);
    expect(vi.mocked(proxyExecutor.executeProxy).mock.calls[0][0].activeMockPorts).toEqual([port]);
  });

  it('returns proxy_failed with a default message when upstream error is missing', async () => {
    const port = getPort();
    vi.spyOn(proxyExecutor, 'executeProxy').mockResolvedValue({
      ok: false,
      status: 502,
      headers: {},
      body: '',
    });

    const listener = new ApiMockNetworkListener({
      serverId: 'srv-proxy-empty-err',
      definition: makeDef(port, {
        routes: [],
        settings: {
          ...DEFAULT_SETTINGS,
          fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
          proxy: {
            ...DEFAULT_SETTINGS.proxy!,
            enabled: true,
            allowlist: ['https://upstream.example.com'],
            blockPrivateNetworks: false,
          },
        },
      }),
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/missing`);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('proxy_failed');
    expect(body.message).toBe('upstream error');
  });

  it('applies scenario transitions on matched rule responses', async () => {
    const port = getPort();
    const def = makeDef(port, {
      routes: [{
        ...makeDef(port).routes[0],
        responses: [{
          ...createDefaultResponse('resp-1'),
          body: { kind: 'text', content: 'step', contentType: 'text/plain' },
          transition: { targetState: 'armed' },
        }],
      }],
    });
    const listener = new ApiMockNetworkListener({ serverId: 'srv-transition', definition: def });
    listeners.push(listener);
    await listener.start();

    await fetch(`http://127.0.0.1:${port}/hello`);
    expect(listener.getScenarioState().states.default).toBe('armed');
  });

  it('forces socket drain when stop exceeds gracefulDrainMs', async () => {
    vi.useFakeTimers();
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-drain',
      definition: makeDef(getPort(), {
        settings: {
          ...DEFAULT_SETTINGS,
          limits: { ...DEFAULT_SETTINGS.limits, gracefulDrainMs: 5 },
        },
      }),
    });
    const socket = { destroy: vi.fn() } as any;
    const close = vi.fn();
    (listener as any).server = { close };
    (listener as any).activeConnections = new Set([socket]);

    const stopPromise = listener.stop();
    await vi.advanceTimersByTimeAsync(5);
    await stopPromise;

    expect(close).toHaveBeenCalled();
    expect(socket.destroy).toHaveBeenCalled();
    expect((listener as any).activeConnections.size).toBe(0);
    vi.useRealTimers();
  });
});
