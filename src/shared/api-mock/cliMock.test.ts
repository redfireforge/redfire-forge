/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { cliAssertJournal, cliFetchJournal, cliLoadAndValidate, cliSimulateSamples } from './cliMock';
import type { ApiMockTransactionV1 } from './contracts';

const ts = '2026-08-13T00:00:00.000Z';

describe('cliMock', () => {
  it('loads a workspace and simulates samples for a known server', () => {
    const loaded = cliLoadAndValidate({
      schemaVersion: 1,
      activeServerId: 'srv-1',
      tabOrder: ['srv-1'],
      servers: [{
        id: 'srv-1',
        name: 'Demo',
        enabled: true,
        host: '127.0.0.1',
        port: 4600,
        basePath: '',
        folders: [],
        routes: [],
        samples: [],
        variables: [],
        settings: {
          selection: { multipleMatchPolicy: 'highest_priority', equalPriorityPolicy: 'reject', ambiguityResponse: { status: 409, headers: [], body: '{}', contentType: 'application/json' } },
          fallback: { unmatchedResponse: { status: 404, headers: [], body: '{}', contentType: 'application/json' }, mode: 'default_response' },
          cors: { enabled: false, allowOrigins: ['*'], allowMethods: ['GET'], allowHeaders: ['Content-Type'], allowCredentials: false, maxAge: 0, exposeHeaders: [] },
          limits: { maxInboundBodyBytes: 1024, maxResponseBodyBytes: 1024, maxConcurrentConnections: 10, maxDelayMs: 0, longRunningEnabled: false, longRunningMaxMs: 0, gracefulDrainMs: 0 },
          journal: { enabled: true, maxEntries: 10, maxCapturedBodyBytes: 1024, persistToDisk: false },
          redaction: { headerNames: [], jsonPaths: [], preserveScheme: true },
        },
        createdAt: ts,
        updatedAt: ts,
      }],
    });
    expect(loaded.validationErrors).toEqual([]);
    expect(cliSimulateSamples({ workspace: loaded.workspace, serverId: 'missing' })).toEqual([]);
    expect(cliSimulateSamples({ workspace: loaded.workspace, serverId: 'srv-1' })).toEqual([]);
    expect(cliSimulateSamples({
      workspace: { ...loaded.workspace, servers: [{ ...loaded.workspace.servers[0], samples: undefined as never }] },
      serverId: 'srv-1',
    })).toEqual([]);
    expect(cliSimulateSamples({ workspace: loaded.workspace, serverId: 'srv-1', routeId: 'r1' })).toEqual([]);

    const invalid = cliLoadAndValidate({
      schemaVersion: 1,
      servers: [{ ...loaded.workspace.servers[0], name: '' }],
      tabOrder: ['srv-1'],
    });
    expect(invalid.validationErrors.some(e => e.includes('srv-1'))).toBe(true);
  });

  it('does not throw when servers or sample arrays are missing', () => {
    const missingServers = cliLoadAndValidate({ hello: true } as Record<string, unknown>);
    expect(missingServers.workspace.servers).toEqual([]);
    expect(missingServers.validationErrors).toEqual([]);

    const loaded = cliLoadAndValidate({
      schemaVersion: 1,
      servers: [{
        id: 'srv-1',
        name: 'Demo',
        enabled: true,
        host: '127.0.0.1',
        port: 4600,
        createdAt: ts,
        updatedAt: ts,
      } as never],
    });
    expect(loaded.validationErrors.some(e => e.includes('settings'))).toBe(true);
    expect(() => cliSimulateSamples({ workspace: loaded.workspace, serverId: 'srv-1' })).not.toThrow();
  });

  it('fetches a live journal and maps HTTP / transport failures', async () => {
    const _ok = await cliFetchJournal({
      controlBase: 'http://127.0.0.1:3001/',
      serverId: 'srv-1',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: { transactions: [{ id: 'tx-1' }] } }),
      }) as unknown as typeof fetch,
    });
    const emptyData = await cliFetchJournal({
      controlBase: 'http://127.0.0.1:3001',
      serverId: 'srv-1',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: {} }),
      }) as unknown as typeof fetch,
    });
    expect(emptyData).toEqual({ ok: true, transactions: [] });

    const httpFail = await cliFetchJournal({
      controlBase: 'http://127.0.0.1:3001',
      serverId: 'srv-1',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ ok: false, error: { message: 'missing' } }),
      }) as unknown as typeof fetch,
    });
    expect(httpFail.ok).toBe(false);

    const httpNoMessage = await cliFetchJournal({
      controlBase: 'http://127.0.0.1:3001',
      serverId: 'srv-1',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ ok: false }),
      }) as unknown as typeof fetch,
    });
    expect(httpNoMessage).toEqual({ ok: false, error: 'HTTP 502' });

    const bodyFalse = await cliFetchJournal({
      controlBase: 'http://127.0.0.1:3001',
      serverId: 'srv-1',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, error: {} }),
      }) as unknown as typeof fetch,
    });
    expect(bodyFalse).toEqual({ ok: false, error: 'HTTP 200' });

    const boom = await cliFetchJournal({
      controlBase: 'http://127.0.0.1:3001',
      serverId: 'srv-1',
      fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch,
    });
    expect(boom.ok).toBe(false);
    if (!boom.ok) expect(boom.error).toContain('ECONNREFUSED');

    const unknown = await cliFetchJournal({
      controlBase: 'http://127.0.0.1:3001',
      serverId: 'srv-1',
      fetchImpl: vi.fn().mockRejectedValue('nope') as unknown as typeof fetch,
    });
    expect(unknown.ok).toBe(false);
  });

  it('uses global fetch when no fetchImpl is provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { transactions: [] } }),
    });
    vi.stubGlobal('fetch', fetchImpl);
    const result = await cliFetchJournal({ controlBase: 'http://127.0.0.1:3001', serverId: 'srv-1' });
    expect(result).toEqual({ ok: true, transactions: [] });
    expect(fetchImpl).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('asserts journal rows', () => {
    const tx = {
      id: 'tx-1', serverId: 'srv-1', generation: 1, receivedAt: ts,
      request: { method: 'GET', path: '/x', rawPath: '/x', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
      outcome: 'matched', matchedRouteId: 'r1',
      explanation: {
        normalizedRequest: { method: 'GET', path: '/x', decodedPath: '/x', pathSegments: ['x'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
        candidates: [],
        policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' },
        nearMisses: [],
      },
      response: { status: 200, headers: {}, cookies: [], body: '{}', bodyTruncated: false, durationMs: 1, generationAtResponse: 1 },
      durationMs: 1,
    } as ApiMockTransactionV1;
    expect(cliAssertJournal([tx], { serverId: 'srv-1', expectedMinCount: 1 }).passed).toBe(true);
  });

  it('filters simulate samples by route association including expected.routeId', () => {
    const loaded = cliLoadAndValidate({
      schemaVersion: 1,
      activeServerId: 'srv-1',
      tabOrder: ['srv-1'],
      servers: [{
        id: 'srv-1',
        name: 'Demo',
        enabled: true,
        host: '127.0.0.1',
        port: 4600,
        basePath: '',
        folders: [],
        routes: [],
        samples: [
          {
            id: 's1', name: 'r1', routeId: 'r1',
            request: {
              method: 'GET', path: '/a', rawPath: '/a', query: {}, headers: {}, cookies: {},
              body: null, bodyTruncated: false, receivedAt: ts,
            },
          },
          {
            id: 's2', name: 'r2', routeId: 'r2',
            request: {
              method: 'GET', path: '/b', rawPath: '/b', query: {}, headers: {}, cookies: {},
              body: null, bodyTruncated: false, receivedAt: ts,
            },
          },
          {
            id: 's3', name: 'expected-r1',
            request: {
              method: 'GET', path: '/c', rawPath: '/c', query: {}, headers: {}, cookies: {},
              body: null, bodyTruncated: false, receivedAt: ts,
            },
            expected: { routeId: 'r1' },
          },
        ],
        variables: [],
        settings: {
          selection: { multipleMatchPolicy: 'highest_priority', equalPriorityPolicy: 'reject', ambiguityResponse: { status: 409, headers: [], body: '{}', contentType: 'application/json' } },
          fallback: { unmatchedResponse: { status: 404, headers: [], body: '{}', contentType: 'application/json' }, mode: 'default_response' },
          cors: { enabled: false, allowOrigins: ['*'], allowMethods: ['GET'], allowHeaders: ['Content-Type'], allowCredentials: false, maxAge: 0, exposeHeaders: [] },
          limits: { maxInboundBodyBytes: 1024, maxResponseBodyBytes: 1024, maxConcurrentConnections: 10, maxDelayMs: 0, longRunningEnabled: false, longRunningMaxMs: 0, gracefulDrainMs: 0 },
          journal: { enabled: true, maxEntries: 10, maxCapturedBodyBytes: 1024, persistToDisk: false },
          redaction: { headerNames: [], jsonPaths: [], preserveScheme: true },
        },
        createdAt: ts,
        updatedAt: ts,
      }],
    });
    const ids = cliSimulateSamples({ workspace: loaded.workspace, serverId: 'srv-1', routeId: 'r1' }).map(r => r.sampleId);
    expect(ids.sort()).toEqual(['s1', 's3']);
  });
});
