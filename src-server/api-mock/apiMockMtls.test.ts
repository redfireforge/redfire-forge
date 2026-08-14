/**
 * Mutual TLS end-to-end: the listener must accept a client presenting a
 * certificate signed by the configured CA and reject one that does not.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import https from 'node:https';
import { ApiMockNetworkListener } from './ApiMockNetworkListener';
import { generateSelfSigned, generateClientCredentials, type ClientCredentials, type SelfSignedPair } from './apiMockTls';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';
let serverPair: SelfSignedPair;
let clientCreds: ClientCredentials;

beforeAll(async () => {
  [serverPair, clientCreds] = await Promise.all([
    generateSelfSigned(['localhost', '127.0.0.1']),
    generateClientCredentials('integration-client'),
  ]);
}, 60_000);

function makeDef(port: number, mtlsEnabled: boolean): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-mtls', name: 'mTLS', enabled: true, host: '127.0.0.1',
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
        mtls: {
          enabled: mtlsEnabled,
          clientCaPem: clientCreds.caCertPem,
          clientCertPem: clientCreds.clientCertPem,
          clientKeyPem: clientCreds.clientKeyPem,
          clientCommonName: clientCreds.commonName,
        },
      },
    },
    createdAt: ts, updatedAt: ts,
  };
}

function get(port: number, opts: https.RequestOptions): Promise<{ status?: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: '127.0.0.1', port, path: '/ping', method: 'GET', ca: serverPair.certPem, servername: 'localhost', ...opts },
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

let nextPort = 19800 + Math.floor(Math.random() * 300);

describe('ApiMockNetworkListener — mutual TLS', () => {
  const listeners: ApiMockNetworkListener[] = [];
  afterEach(async () => {
    for (const l of listeners) if (l.isRunning()) await l.stop();
    listeners.length = 0;
  });

  async function start(mtlsEnabled: boolean) {
    const port = nextPort++;
    const listener = new ApiMockNetworkListener({ serverId: 'srv-mtls', definition: makeDef(port, mtlsEnabled) });
    listeners.push(listener);
    await listener.start();
    return port;
  }

  it('accepts a client presenting the issued certificate', async () => {
    const port = await start(true);
    const res = await get(port, { cert: clientCreds.clientCertPem, key: clientCreds.clientKeyPem });
    expect(res.status).toBe(200);
    expect(res.body).toBe('pong');
  }, 30_000);

  it('rejects a client that presents no certificate', async () => {
    const port = await start(true);
    await expect(get(port, {})).rejects.toThrow();
  }, 30_000);

  it('allows certificate-less clients when mTLS is off', async () => {
    const port = await start(false);
    const res = await get(port, {});
    expect(res.status).toBe(200);
  }, 30_000);

  it('matches certSubject against the presented client certificate', async () => {
    const port = nextPort++;
    const def = makeDef(port, true);
    def.routes[0].predicates = {
      id: 'pg', combinator: 'all',
      children: [{ id: 'p1', source: 'security', selector: 'certSubject', operator: 'exact', expected: 'CN=integration-client' }],
    };
    def.routes[0].responses[0].body = { kind: 'text', content: 'mtls-ok', contentType: 'text/plain' };
    const txs: Array<{ subject?: string; dump: string }> = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-mtls',
      definition: def,
      onTransaction: tx => txs.push({
        subject: tx.request.clientCertSubject,
        dump: JSON.stringify(tx),
      }),
    });
    listeners.push(listener);
    await listener.start();
    const res = await get(port, { cert: clientCreds.clientCertPem, key: clientCreds.clientKeyPem });
    expect(res.status).toBe(200);
    expect(res.body).toBe('mtls-ok');
    expect(txs[0]?.subject).toBe('CN=integration-client');
    expect(txs[0]?.dump).not.toContain('BEGIN CERTIFICATE');
    expect(txs[0]?.dump).not.toContain('BEGIN PRIVATE KEY');
  }, 30_000);

  it('does not match a different certSubject', async () => {
    const port = nextPort++;
    const def = makeDef(port, true);
    def.routes[0].predicates = {
      id: 'pg', combinator: 'all',
      children: [{ id: 'p1', source: 'security', selector: 'certSubject', operator: 'exact', expected: 'CN=nobody' }],
    };
    const listener = new ApiMockNetworkListener({ serverId: 'srv-mtls', definition: def });
    listeners.push(listener);
    await listener.start();
    const res = await get(port, { cert: clientCreds.clientCertPem, key: clientCreds.clientKeyPem });
    expect(res.status).toBe(404);
  }, 30_000);

  it('refuses to start when mTLS is on but no CA is configured', async () => {
    const def = makeDef(nextPort++, true);
    def.settings.tls!.mtls!.clientCaPem = '';
    const listener = new ApiMockNetworkListener({ serverId: 'srv-mtls', definition: def });
    listeners.push(listener);
    await expect(listener.start()).rejects.toThrow(/client CA/i);
  }, 30_000);
});
