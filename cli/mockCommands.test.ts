/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { stringify as stringifyYaml } from 'yaml';

const startStandaloneServers = vi.fn();

vi.mock('./mockStandalone', () => ({
  startStandaloneServers: (...args: unknown[]) => startStandaloneServers(...args),
}));

import { holdMockStartUntilSignal, runMockSimulate, runMockStart, runMockStop, runMockVerify, runMockVerifyAllRoutes, runMockWaitReady } from './mockCommands';

const ts = '2026-08-13T00:00:00.000Z';

function makeWorkspace(overrides: Record<string, unknown> = {}) {
  return {
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
      routes: [{
        id: 'r1', name: 'Health', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/health' }, priority: 10,
        predicates: { id: 'pg', combinator: 'all', children: [] },
        responseMode: 'rules',
        responses: [{
          id: 'resp-1', name: '200 Default', enabled: true, isDefault: true, status: 200,
          headers: [], cookies: [],
          body: { kind: 'json', content: '{"ok":true}', contentType: 'application/json' },
          behavior: { delayMs: 0, jitterMs: 0 },
        }],
        tags: [], createdAt: ts, updatedAt: ts,
      }],
      samples: [{
        id: 's1', name: 'health', routeId: 'r1',
        request: {
          method: 'GET', path: '/health', rawPath: '/health', query: {}, headers: {}, cookies: {},
          body: null, bodyTruncated: false, receivedAt: ts,
        },
        expected: { outcome: 'matched', status: 200 },
      }],
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
      ...overrides,
    }],
  };
}

describe('mockCommands', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'am-cli-'));
    startStandaloneServers.mockReset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  function writeWs(name: string, data: unknown) {
    const file = join(dir, name);
    writeFileSync(file, JSON.stringify(data));
    return file;
  }

  it('simulates samples and writes junit output', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const junit = join(dir, 'out.xml');
    const out = join(dir, 'out.json');
    const code = await runMockSimulate({ file, output: out, junit });
    expect(code).toBe(0);
    expect(readFileSync(junit, 'utf8')).toContain('testcase');
    expect(JSON.parse(readFileSync(out, 'utf8')).total).toBe(1);
  });

  it('rejects missing files and empty servers', async () => {
    await expect(runMockSimulate({ file: join(dir, 'nope.json') })).rejects.toThrow(/File not found/);
    const empty = writeWs('empty.json', { schemaVersion: 1, servers: [], tabOrder: [] });
    expect(await runMockSimulate({ file: empty })).toBe(1);
    const dangling = makeWorkspace();
    dangling.activeServerId = 'gone';
    expect(await runMockSimulate({ file: writeWs('dangling-active.json', dangling) })).toBe(0);
  });

  it('verifies live journal via companion and fails on transport errors', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          transactions: [{
            id: 'tx-1', serverId: 'srv-1', generation: 1, receivedAt: ts,
            request: { method: 'GET', path: '/health', rawPath: '/health', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
            outcome: 'matched', matchedRouteId: 'r1',
            explanation: { normalizedRequest: { method: 'GET', path: '/health', decodedPath: '/health', pathSegments: ['health'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' }, nearMisses: [] },
            response: { status: 200, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 1, generationAtResponse: 1 },
            durationMs: 1,
          }],
        },
      }),
    });
    const code = await runMockVerify({
      file,
      minCalls: 1,
      expectOutcome: 'matched',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(code).toBe(0);

    const tooFew = await runMockVerify({
      file,
      minCalls: 9,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(tooFew).toBe(1);

    const down = await runMockVerify({
      file,
      fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch,
    });
    expect(down).toBe(1);

    const emptyJournal = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { transactions: [] } }),
    });
    expect(await runMockVerify({
      file,
      fetchImpl: emptyJournal as unknown as typeof fetch,
    })).toBe(0);
    expect(await runMockVerify({
      file,
      expectOutcome: 'matched',
      fetchImpl: emptyJournal as unknown as typeof fetch,
    })).toBe(1);
    expect(await runMockVerify({
      file,
      bodyContains: 'ok',
      fetchImpl: emptyJournal as unknown as typeof fetch,
    })).toBe(1);
  });

  it('supports --simulate verify and starts via companion or standalone fallback', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    expect(await runMockVerify({ file, simulate: true })).toBe(0);
    const noSamples = writeWs('no-samples.json', {
      ...makeWorkspace(),
      servers: [{ ...makeWorkspace().servers[0], samples: [] }],
    });
    expect(await runMockVerify({ file: noSamples, simulate: true, expectOutcome: 'matched' })).toBe(1);
    expect(await runMockVerify({ file: noSamples, simulate: true, bodyContains: 'ok' })).toBe(1);
    expect(await runMockVerify({ file, simulate: true, minCalls: 1, expectOutcome: 'matched' })).toBe(0);
    expect(await runMockVerify({ file, simulate: true, minCalls: 99 })).toBe(1);
    expect(await runMockVerify({ file, simulate: true, expectOutcome: 'unmatched' })).toBe(1);
    expect(await runMockVerify({ file, simulate: true, routeId: 'r1', bodyContains: 'ok' })).toBe(0);
    expect(await runMockVerify({ file, simulate: true, routeId: 'missing-route' })).toBe(1);

    const mixed = makeWorkspace();
    mixed.servers[0].samples.push({
      id: 's-miss',
      name: 'missing',
      request: {
        method: 'GET', path: '/nope', rawPath: '/nope', query: {}, headers: {}, cookies: {},
        body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched' },
    });
    const mixedFile = writeWs('mixed.json', mixed);
    expect(await runMockSimulate({ file: mixedFile })).toBe(1);
    expect(await runMockVerify({ file: mixedFile, simulate: true })).toBe(1);
    expect(await runMockVerify({ file: mixedFile, simulate: true, routeId: 'r1' })).toBe(0);
    const taggedMiss = makeWorkspace();
    taggedMiss.servers[0].samples.push({
      id: 's-r1-miss',
      name: 'r1-miss',
      routeId: 'r1',
      request: {
        method: 'GET', path: '/nope', rawPath: '/nope', query: {}, headers: {}, cookies: {},
        body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched', routeId: 'r1' },
    });
    const taggedMissFile = writeWs('tagged-miss.json', taggedMiss);
    expect(await runMockVerify({ file: taggedMissFile, simulate: true, routeId: 'r1' })).toBe(1);
    expect(await runMockVerify({ file, simulate: true, bodyContains: 'nope' })).toBe(1);
    expect(await runMockVerify({ file, simulate: true, lastCallWithinMs: 1000 })).toBe(1);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { port: 4600, generation: 1 } }),
    }));
    expect(await runMockStart({ file })).toBe(0);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    startStandaloneServers.mockResolvedValue({
      results: [{ serverId: 'srv-1', ok: true, port: 4600, mode: 'standalone' }],
      stopAll: vi.fn(),
    });
    expect(await runMockStart({ file, hold: false })).toBe(0);
    expect(startStandaloneServers).toHaveBeenCalled();

    startStandaloneServers.mockResolvedValue({
      results: [{ serverId: 'srv-1', ok: true, port: 4601, mode: 'standalone' }],
      stopAll: vi.fn(),
    });
    expect(await runMockStart({ file, standalone: true, port: 4601, hold: false })).toBe(0);
  });

  it('loads YAML and export envelopes, and reports companion HTTP errors', async () => {
    const yamlFile = join(dir, 'ws.yaml');
    writeFileSync(yamlFile, stringifyYaml(makeWorkspace()));
    expect(await runMockSimulate({ file: yamlFile })).toBe(0);

    const emptyYaml = join(dir, 'empty.yaml');
    writeFileSync(emptyYaml, `
schemaVersion: 1
activeServerId: srv-1
tabOrder: [srv-1]
servers: []
`);
    expect(await runMockSimulate({ file: emptyYaml })).toBe(1);

    const envelope = writeWs('env.json', {
      _exportMeta: { kind: 'redfireforge-api-mock' },
      data: { scope: 'workspace', workspace: makeWorkspace() },
    });
    expect(await runMockSimulate({ file: envelope })).toBe(0);

    const serversEnvelope = writeWs('servers.json', {
      _exportMeta: {},
      data: { scope: 'servers', servers: makeWorkspace().servers },
    });
    expect(await runMockSimulate({ file: serversEnvelope })).toBe(0);

    const single = writeWs('single.json', makeWorkspace().servers[0]);
    expect(await runMockSimulate({ file: single })).toBe(0);

    const stringPort = { ...makeWorkspace().servers[0], port: '4600' };
    expect(await runMockSimulate({ file: writeWs('port-str.json', stringPort) })).toBe(0);

    const wsStringPort = makeWorkspace();
    (wsStringPort.servers[0] as { port: unknown }).port = '4600';
    expect(await runMockSimulate({ file: writeWs('ws-port-str.json', wsStringPort) })).toBe(0);

    const envelopeStringPort = writeWs('env-port-str.json', {
      _exportMeta: {},
      data: { scope: 'workspace', workspace: wsStringPort },
    });
    expect(await runMockSimulate({ file: envelopeStringPort })).toBe(0);

    const serversStringPort = writeWs('servers-port-str.json', {
      _exportMeta: {},
      data: { scope: 'servers', servers: wsStringPort.servers },
    });
    expect(await runMockSimulate({ file: serversStringPort })).toBe(0);

    const keepPort = makeWorkspace();
    (keepPort.servers[0] as { port: unknown }).port = 'not-a-port';
    expect(await runMockSimulate({ file: writeWs('ws-port-keep.json', keepPort) })).toBe(0);

    const envelopeNoServers = writeWs('env-no-servers.json', {
      _exportMeta: {},
      data: { scope: 'workspace', workspace: { schemaVersion: 1 } },
    });
    expect(await runMockSimulate({ file: envelopeNoServers })).toBe(1);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: { message: 'boom' } }),
    }));
    expect(await runMockStart({ file: envelope })).toBe(1);
  });

  it('reports validation errors, missing server ids, junit failures, and companion errors without messages', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const invalid = writeWs('invalid.json', makeWorkspace({ name: '' }));
    expect(await runMockSimulate({ file: invalid })).toBe(1);
    expect(await runMockStart({ file: invalid })).toBe(1);
    expect(await runMockVerify({ file: invalid })).toBe(1);

    const empty = writeWs('empty.json', { schemaVersion: 1, servers: [], tabOrder: [] });
    expect(await runMockVerify({ file: empty })).toBe(1);

    const file = writeWs('ws.json', makeWorkspace());
    expect(await runMockSimulate({ file })).toBe(0);

    const failing = writeWs('fail.json', makeWorkspace({
      samples: [{
        id: 's1&<>"', name: 'health', routeId: 'r1',
        request: {
          method: 'GET', path: '/missing', rawPath: '/missing', query: {}, headers: {}, cookies: {},
          body: null, bodyTruncated: false, receivedAt: ts,
        },
        expected: { outcome: 'matched', status: 200 },
      }],
    }));
    const junit = join(dir, 'fail.xml');
    expect(await runMockSimulate({ file: failing, junit })).toBe(1);
    const xml = readFileSync(junit, 'utf8');
    expect(xml).toContain('<failure');
    expect(xml).toContain('s1&amp;&lt;&gt;&quot;');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ ok: false }),
    }));
    expect(await runMockStart({ file })).toBe(1);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('nope'));
    startStandaloneServers.mockResolvedValue({
      results: [{ serverId: 'srv-1', ok: true, port: 4600, mode: 'standalone' }],
      stopAll: vi.fn(),
    });
    expect(await runMockStart({ file, hold: false })).toBe(0);
    logSpy.mockRestore();
  });

  it('parses an unrecognized definition shape and parks waitReady without hanging in tests', async () => {
    const raw = writeWs('raw.json', { schemaVersion: 1, notAWorkspace: true });
    expect(await runMockSimulate({ file: raw })).toBe(1);
    expect(await runMockSimulate({ file: writeWs('no-schema.json', { hello: true }) })).toBe(1);

    const file = writeWs('ws.json', makeWorkspace());
    const stopAll = vi.fn().mockResolvedValue(undefined);
    startStandaloneServers.mockResolvedValue({
      results: [{ serverId: 'srv-1', ok: true, port: 4600, mode: 'standalone' }],
      stopAll,
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    expect(await runMockStart({ file, standalone: true, waitReady: true, hold: false })).toBe(0);
    expect(stopAll).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
  });

  it('increments --port across servers in a workspace', async () => {
    const ws = makeWorkspace();
    ws.servers.push({ ...ws.servers[0], id: 'srv-2', name: 'Two', port: 4601 });
    const file = writeWs('multi.json', ws);
    startStandaloneServers.mockResolvedValue({
      results: [
        { serverId: 'srv-1', ok: true, port: 4700, mode: 'standalone' },
        { serverId: 'srv-2', ok: true, port: 4701, mode: 'standalone' },
      ],
      stopAll: vi.fn(),
    });
    expect(await runMockStart({ file, standalone: true, port: 4700, hold: false })).toBe(0);
    const started = startStandaloneServers.mock.calls.at(-1)?.[0] as Array<{ port: number }>;
    expect(started[0].port).toBe(4700);
    expect(started[1].port).toBe(4701);
  });

  it('holds mock start until signal and stops companion listeners', async () => {
    const exit = vi.fn();
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('stop failed'))
      .mockResolvedValue({ ok: true });
    await holdMockStartUntilSignal({
      controlBase: 'http://127.0.0.1:3001',
      results: [
        { ok: false, serverId: 'dead' },
        { ok: true, serverId: 'srv-1' },
        { ok: true, serverId: 'srv-2' },
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      hold: false,
      exit: exit as unknown as (code: number) => void,
    });
    expect(exit).toHaveBeenCalledWith(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const stopAll = vi.fn().mockResolvedValue(undefined);
    const handlers: Array<() => void> = [];
    const onSpy = vi.spyOn(process, 'on').mockImplementation(((ev: string, fn: () => void) => {
      if (ev === 'SIGINT' || ev === 'SIGTERM') handlers.push(fn);
      return process;
    }) as typeof process.on);
    await holdMockStartUntilSignal({
      stopAll,
      controlBase: 'http://127.0.0.1:3001',
      results: [{ ok: true, serverId: 'srv-1' }],
      hold: false,
      exit,
    });
    handlers[0]?.();
    handlers[1]?.();
    expect(stopAll).toHaveBeenCalled();
    onSpy.mockRestore();

    const exploding = vi.fn().mockRejectedValue(new Error('stop failed'));
    const exitAfterThrow = vi.fn();
    await holdMockStartUntilSignal({
      stopAll: exploding,
      controlBase: 'http://127.0.0.1:3001',
      results: [{ ok: true, serverId: 'srv-1' }],
      hold: false,
      exit: exitAfterThrow,
    });
    expect(exitAfterThrow).toHaveBeenCalledWith(0);
  });

  it('passes live journal filters through to assertions', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    // Use a fresh receivedAt so time-based assertions (lastCallWithinMs) don't drift.
    const recentTs = new Date().toISOString();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          transactions: [{
            id: 'tx-1', serverId: 'srv-1', generation: 1, receivedAt: recentTs,
            request: { method: 'GET', path: '/health', rawPath: '/health', query: {}, headers: {}, cookies: {}, body: '{"ok":true}', bodyTruncated: false, receivedAt: recentTs },
            outcome: 'matched', matchedRouteId: 'r1',
            explanation: { normalizedRequest: { method: 'GET', path: '/health', decodedPath: '/health', pathSegments: ['health'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' }, nearMisses: [] },
            response: { status: 200, headers: {}, cookies: [], body: '{"ok":true}', bodyTruncated: false, durationMs: 1, generationAtResponse: 1 },
            durationMs: 1,
          }],
        },
      }),
    });
    expect(await runMockVerify({
      file,
      minCalls: 1,
      expectOutcome: 'matched',
      routeId: 'r1',
      lastCallWithinMs: 86_400_000,
      bodyContains: 'ok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).toBe(0);
  });

  it('rejects invalid numeric flags, empty workspaces, missing servers, and empty corpora', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    expect(await runMockStart({ file, port: Number.NaN, hold: false })).toBe(1);
    expect(await runMockStart({ file, port: 70000, hold: false })).toBe(1);
    expect(await runMockVerify({ file, minCalls: Number.NaN })).toBe(1);
    expect(await runMockVerify({ file, lastCallWithinMs: -1 })).toBe(1);

    const empty = writeWs('empty.json', { schemaVersion: 1, servers: [], tabOrder: [] });
    expect(await runMockStart({ file: empty, hold: false })).toBe(1);
    expect(await runMockSimulate({ file, serverId: 'missing' })).toBe(1);

    const noSamples = writeWs('no-samples.json', {
      ...makeWorkspace(),
      servers: [{ ...makeWorkspace().servers[0], samples: [] }],
    });
    expect(await runMockSimulate({ file: noSamples })).toBe(1);
    expect(await runMockVerify({ file: noSamples, simulate: true })).toBe(1);

    const overflow = makeWorkspace();
    overflow.servers.push({ ...overflow.servers[0], id: 'srv-2', name: 'Two', port: 4601 });
    expect(await runMockStart({ file: writeWs('overflow.json', overflow), port: 65535, hold: false })).toBe(1);

    await expect(runMockSimulate({ file: writeWs('null.json', null) })).rejects.toThrow(/not a mock workspace/);
  });

  it('covers missing live/simulated servers and wait-ready file timeouts', async () => {
    const workspace = makeWorkspace();
    workspace.activeServerId = 'missing';
    const file = writeWs('missing-server.json', workspace);
    expect(await runMockVerify({ file, serverId: 'missing', simulate: true })).toBe(1);
    expect(await runMockVerify({ file, serverId: 'missing', fetchImpl: vi.fn() as unknown as typeof fetch })).toBe(1);

    expect(await runMockWaitReady({
      portFile: join(dir, 'missing.port'),
      timeoutSecs: 0,
      intervalMs: 1,
    })).toBe(1);
    expect(await runMockWaitReady({
      envFile: join(dir, 'missing.env'),
      timeoutSecs: 0,
      intervalMs: 1,
    })).toBe(1);
  });

  it('rolls back companion listeners when a later start fails', async () => {
    const ws = makeWorkspace();
    ws.servers.push({ ...ws.servers[0], id: 'srv-2', name: 'Two', port: 4601 });
    const file = writeWs('multi.json', ws);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { port: 4600, generation: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ ok: false, error: { message: 'port in use' } }),
      })
      .mockRejectedValueOnce(new Error('stop failed'));
    vi.stubGlobal('fetch', fetchImpl);
    expect(await runMockStart({ file })).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/mock/servers/srv-1/stop'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('passes simulate when the corpus expects an ambiguous outcome', async () => {
    const ws = makeWorkspace();
    const twin = { ...ws.servers[0].routes[0], id: 'r2', name: 'Health 2' };
    ws.servers[0].routes.push(twin);
    ws.servers[0].samples[0] = {
      ...ws.servers[0].samples[0],
      expected: { outcome: 'ambiguous' },
    };
    const file = writeWs('ambiguous.json', ws);
    expect(await runMockSimulate({ file })).toBe(0);
    expect(await runMockVerify({ file, simulate: true, expectOutcome: 'ambiguous' })).toBe(0);
  });

  // ── --port auto ───────────────────────────────────────────────────────────

  it('mock start --port auto picks a free port and writes port-file + env-file', async () => {
    startStandaloneServers.mockResolvedValue({
      results: [{ serverId: 'srv-1', ok: true, port: 51234 }],
      stopAll: vi.fn().mockResolvedValue(undefined),
    });
    const portFile = join(dir, '.rff-mock-port');
    const envFile  = join(dir, '.env.mock');
    const file = writeWs('ws.json', makeWorkspace());
    const code = await runMockStart({ file, port: 'auto', portFile, envFile, standalone: true, hold: false });
    expect(code).toBe(0);
    // The standalone servers received an integer port (not 'auto').
    const [serversArg] = startStandaloneServers.mock.calls[0] as [Array<{ port: number }>, ...unknown[]];
    expect(typeof serversArg[0].port).toBe('number');
    expect(serversArg[0].port).toBeGreaterThan(0);
    // Port discovery files were written with the port the standalone server actually bound.
    expect(readFileSync(portFile, 'utf8')).toMatch(/^\d+$/);
    expect(readFileSync(envFile, 'utf8')).toMatch(/^API_MOCK_PORT=\d+\n$/);
  });

  it('mock start --port auto does not write files when start fails', async () => {
    startStandaloneServers.mockResolvedValue({
      results: [{ serverId: 'srv-1', ok: false, error: 'bind failed' }],
      stopAll: vi.fn().mockResolvedValue(undefined),
    });
    const portFile = join(dir, '.rff-mock-port-fail');
    const file = writeWs('ws.json', makeWorkspace());
    const code = await runMockStart({ file, port: 'auto', portFile, standalone: true, hold: false });
    expect(code).toBe(1);
    expect(existsSync(portFile)).toBe(false);
  });

  // ── mock stop ─────────────────────────────────────────────────────────────

  it('mock stop calls companion stop endpoint and returns 0 on success', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const code = await runMockStop({ file, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/mock/servers/srv-1/stop'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('mock stop --all stops every server in the workspace', async () => {
    const ws = makeWorkspace();
    ws.servers.push({ ...ws.servers[0], id: 'srv-2', name: 'Two', port: 4601 });
    const file = writeWs('multi.json', ws);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const code = await runMockStop({ file, all: true, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('/srv-1/stop'), expect.anything());
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('/srv-2/stop'), expect.anything());
  });

  it('mock stop returns 1 when companion is unreachable', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const code = await runMockStop({ file, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(1);
  });

  it('mock stop reports HTTP error when response is non-ok and body cannot be parsed', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('invalid json');
      },
    });
    const code = await runMockStop({ file, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(1);
  });

  it('mock stop reports generic companion unreachable error for non-Error throws', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const fetchImpl = vi.fn().mockRejectedValue('boom');
    const code = await runMockStop({ file, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(1);
  });

  it('mock stop returns 1 when server not found in definition', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const fetchImpl = vi.fn();
    const code = await runMockStop({ file, serverId: 'does-not-exist', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  // ── mock verify --all-routes ──────────────────────────────────────────────

  function makeJournalFetch(transactions: Array<{ matchedRouteId?: string }>) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          transactions: transactions.map((t, i) => ({
            id: `tx-${i}`, serverId: 'srv-1', generation: 1, receivedAt: ts,
            request: { method: 'GET', path: '/health', rawPath: '/health', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
            outcome: 'matched',
            matchedRouteId: t.matchedRouteId,
            explanation: { normalizedRequest: { method: 'GET', path: '/health', decodedPath: '/health', pathSegments: [], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 }, candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' }, nearMisses: [] },
            durationMs: 1,
          })),
        },
      }),
    });
  }

  it('verify --all-routes passes when all enabled routes were called', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const fetchImpl = makeJournalFetch([{ matchedRouteId: 'r1' }]);
    const code = await runMockVerifyAllRoutes({ file, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(0);
  });

  it('verify --all-routes fails when a route was never called', async () => {
    const ws = makeWorkspace();
    ws.servers[0].routes.push({
      ...ws.servers[0].routes[0],
      id: 'r2',
      name: 'Orders',
      method: 'POST',
      path: { kind: 'exact', value: '/orders' },
    });
    const file = writeWs('ws.json', ws);
    // Only r1 was called — r2 was not.
    const fetchImpl = makeJournalFetch([{ matchedRouteId: 'r1' }]);
    const code = await runMockVerifyAllRoutes({ file, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(1);
  });

  it('verify --all-routes respects --min-calls per route', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    // Only 1 call, but we require 3.
    const fetchImpl = makeJournalFetch([{ matchedRouteId: 'r1' }]);
    expect(await runMockVerifyAllRoutes({ file, minCallsPerRoute: 3, fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(1);
    // 3 calls — passes.
    const fetchImpl3 = makeJournalFetch([
      { matchedRouteId: 'r1' }, { matchedRouteId: 'r1' }, { matchedRouteId: 'r1' },
    ]);
    expect(await runMockVerifyAllRoutes({ file, minCallsPerRoute: 3, fetchImpl: fetchImpl3 as unknown as typeof fetch })).toBe(0);
  });

  it('verify --all-routes skips disabled routes', async () => {
    const ws = makeWorkspace();
    ws.servers[0].routes.push({
      ...ws.servers[0].routes[0],
      id: 'r2',
      name: 'Disabled',
      enabled: false,
      method: 'POST',
      path: { kind: 'exact', value: '/disabled' },
    });
    const file = writeWs('ws.json', ws);
    // r2 is disabled — only r1 must be called.
    const fetchImpl = makeJournalFetch([{ matchedRouteId: 'r1' }]);
    expect(await runMockVerifyAllRoutes({ file, fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(0);
  });

  it('verify --all-routes returns 1 when companion is unreachable', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await runMockVerifyAllRoutes({ file, fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(1);
  });

  it('verify --all-routes returns 1 for empty route list', async () => {
    const ws = makeWorkspace();
    ws.servers[0].routes = [];
    const file = writeWs('ws.json', ws);
    const fetchImpl = makeJournalFetch([]);
    expect(await runMockVerifyAllRoutes({ file, fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(1);
  });

  it('verify --all-routes rejects non-positive --min-calls values', async () => {
    const file = writeWs('ws.json', makeWorkspace());
    expect(await runMockVerifyAllRoutes({ file, minCallsPerRoute: 0 })).toBe(1);
  });

  it('verify --all-routes uses unknown path label when route path is missing', async () => {
    const ws = makeWorkspace();
    ws.servers[0].routes[0] = {
      ...ws.servers[0].routes[0],
      path: { kind: 'exact', value: undefined as unknown as string },
    };
    const file = writeWs('ws-pathless.json', ws);
    const fetchImpl = makeJournalFetch([{ matchedRouteId: 'r1' }]);
    expect(await runMockVerifyAllRoutes({ file, fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(0);
  });

  // ── mock wait-ready ───────────────────────────────────────────────────────

  it('wait-ready polls /__rff/health/ready by default and passes on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const code = await runMockWaitReady({ port: 51432, fetchImpl: fetchImpl as unknown as typeof fetch, intervalMs: 10 });
    expect(code).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:51432/__rff/health/ready');
  });

  it('wait-ready keeps retrying on 503 (alive but not ready yet) until timeout', async () => {
    // 503 = "not ready yet" — should keep polling, not pass immediately
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const code = await runMockWaitReady({ port: 4600, timeoutSecs: 0.1, intervalMs: 20, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(1);
  });

  it('wait-ready accepts custom --health-path to poll root instead', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await runMockWaitReady({ port: 4600, healthPath: '/', fetchImpl: fetchImpl as unknown as typeof fetch, intervalMs: 10 });
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4600/');
  });

  it('wait-ready reads port from --port-file and polls health endpoint', async () => {
    const portFile = join(dir, '.rff-mock-port');
    writeFileSync(portFile, '54321', 'utf8');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const code = await runMockWaitReady({ portFile, fetchImpl: fetchImpl as unknown as typeof fetch, intervalMs: 10 });
    expect(code).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:54321/__rff/health/ready');
  });

  it('wait-ready reads port from --env-file and polls health endpoint', async () => {
    const envFile = join(dir, '.env.mock');
    writeFileSync(envFile, 'API_MOCK_PORT=54322\n', 'utf8');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const code = await runMockWaitReady({ envFile, fetchImpl: fetchImpl as unknown as typeof fetch, intervalMs: 10 });
    expect(code).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:54322/__rff/health/ready');
  });

  it('wait-ready times out when server never becomes ready', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const code = await runMockWaitReady({ port: 59999, timeoutSecs: 0.1, intervalMs: 20, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(code).toBe(1);
  });

  it('wait-ready returns 1 when port-file has invalid content', async () => {
    const portFile = join(dir, '.bad-port');
    writeFileSync(portFile, 'not-a-number', 'utf8');
    const code = await runMockWaitReady({ portFile, intervalMs: 10 });
    expect(code).toBe(1);
  });

  it('wait-ready returns 1 when no port source is provided', async () => {
    const code = await runMockWaitReady({});
    expect(code).toBe(1);
  });
});
