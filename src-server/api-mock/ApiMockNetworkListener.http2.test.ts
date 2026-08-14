/**
 * HTTPS listeners advertise HTTP/2 (ALPN h2) and still accept HTTP/1.1.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { EventEmitter } from 'node:events';
import http2 from 'node:http2';
import https from 'node:https';
import { ApiMockNetworkListener, peerTlsSocket, requestRemoteAddress } from './ApiMockNetworkListener';
import { generateSelfSigned, type SelfSignedPair } from './apiMockTls';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-13T00:00:00.000Z';
let serverPair: SelfSignedPair;

beforeAll(async () => {
  serverPair = await generateSelfSigned(['localhost', '127.0.0.1']);
}, 60_000);

function makeDef(port: number): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-h2', name: 'HTTP/2', enabled: true, host: '127.0.0.1',
    port, basePath: '', folders: [], variables: [], samples: [],
    routes: [{
      id: 'r1', name: 'Ping', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/ping' }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [{
        ...createDefaultResponse('resp-1'),
        status: 200,
        body: { kind: 'text', content: 'pong', contentType: 'text/plain' },
      }],
      tags: [], createdAt: ts, updatedAt: ts,
    }],
    settings: {
      ...DEFAULT_SETTINGS,
      tls: {
        enabled: true,
        certPem: serverPair.certPem,
        keyPem: serverPair.keyPem,
        selfSigned: true,
      },
    },
    createdAt: ts, updatedAt: ts,
  };
}

function http2Get(port: number): Promise<{ status?: number; body: string; alpn?: string }> {
  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://127.0.0.1:${port}`, {
      ca: serverPair.certPem,
      servername: 'localhost',
    });
    client.on('error', reject);
    const req = client.request({ ':method': 'GET', ':path': '/ping' });
    let body = '';
    req.on('response', headers => {
      req.on('data', c => { body += c; });
      req.on('end', () => {
        const alpn = (client as { alpnProtocol?: string }).alpnProtocol;
        client.close();
        resolve({ status: Number(headers[':status']), body, alpn });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function https11Get(port: number): Promise<{ status?: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: '127.0.0.1', port, path: '/ping', method: 'GET',
        ca: serverPair.certPem, servername: 'localhost',
      },
      res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

let nextPort = 20400 + Math.floor(Math.random() * 200);

describe('ApiMockNetworkListener — HTTP/2', () => {
  const listeners: ApiMockNetworkListener[] = [];
  afterEach(async () => {
    for (const l of listeners) if (l.isRunning()) await l.stop();
    listeners.length = 0;
  });

  it('serves h2 and still accepts HTTP/1.1 on the same TLS port', async () => {
    const port = nextPort++;
    const txs: Array<{ method: string; host?: string[]; remoteAddress?: string }> = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-h2',
      definition: makeDef(port),
      onTransaction: tx => txs.push({
        method: tx.request.method,
        host: tx.request.headers.host,
        remoteAddress: tx.request.remoteAddress,
      }),
    });
    listeners.push(listener);
    await listener.start();

    const h2 = await http2Get(port);
    expect(h2.status).toBe(200);
    expect(h2.body).toBe('pong');
    expect(h2.alpn).toBe('h2');

    const h11 = await https11Get(port);
    expect(h11.status).toBe(200);
    expect(h11.body).toBe('pong');

    expect(txs).toHaveLength(2);
    expect(txs[0].method).toBe('GET');
    expect(txs[0].host?.[0]).toMatch(/^(127\.0\.0\.1|localhost):\d+$/);
    expect(txs[0].remoteAddress).toBeTruthy();
  });

  it('keeps running if the TLS server or an HTTP/2 session errors after listen', async () => {
    const port = nextPort++;
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-h2',
      definition: makeDef(port),
    });
    listeners.push(listener);
    await listener.start();

    const server = (listener as unknown as { server: EventEmitter }).server;
    expect(() => server.emit('error', new Error('after listen'))).not.toThrow();

    const session = new EventEmitter() as EventEmitter & { socket: EventEmitter };
    session.socket = new EventEmitter();
    server.emit('session', session);
    expect(() => session.emit('error', new Error('h2 session'))).not.toThrow();
    expect(listener.isRunning()).toBe(true);
  });

  it('GOAWAYs existing HTTP/2 sessions on stop so they cannot keep serving', async () => {
    const port = nextPort++;
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-h2',
      definition: makeDef(port),
    });
    listeners.push(listener);
    await listener.start();

    const client = http2.connect(`https://127.0.0.1:${port}`, {
      ca: serverPair.certPem,
      servername: 'localhost',
    });
    try {
      await new Promise<void>((resolve, reject) => {
        client.once('connect', () => resolve());
        client.once('error', reject);
      });
      const ping = () => new Promise<{ status: number }>((resolve, reject) => {
        const req = client.request({ ':method': 'GET', ':path': '/ping' });
        req.on('response', headers => {
          req.resume();
          req.on('end', () => resolve({ status: Number(headers[':status']) }));
        });
        req.on('error', reject);
        req.end();
      });
      expect((await ping()).status).toBe(200);
      await listener.stop();
      await expect(ping()).rejects.toBeTruthy();
    } finally {
      client.close();
    }
  });
});

describe('peerTlsSocket', () => {
  it('uses a direct TLS socket, then the HTTP/2 session socket, then the raw socket', () => {
    const tlsSock = { getPeerCertificate: () => ({}) };
    expect(peerTlsSocket({ socket: tlsSock } as never)).toBe(tlsSock);

    const sessionSock = { getPeerCertificate: () => ({}) };
    expect(peerTlsSocket({
      socket: {},
      stream: { session: { socket: sessionSock } },
    } as never)).toBe(sessionSock);

    const plain = {};
    expect(peerTlsSocket({
      socket: plain,
      stream: { session: { socket: {} } },
    } as never)).toBe(plain);
    expect(peerTlsSocket({ socket: plain, stream: undefined } as never)).toBe(plain);
    expect(peerTlsSocket({} as never)).toBeNull();
  });
});

describe('requestRemoteAddress', () => {
  it('prefers the request socket, then the HTTP/2 session socket', () => {
    expect(requestRemoteAddress({ socket: { remoteAddress: '10.0.0.1' } } as never)).toBe('10.0.0.1');
    expect(requestRemoteAddress({
      socket: {},
      stream: { session: { socket: { remoteAddress: '10.0.0.2' } } },
    } as never)).toBe('10.0.0.2');
    expect(requestRemoteAddress({} as never)).toBeUndefined();
  });
});
