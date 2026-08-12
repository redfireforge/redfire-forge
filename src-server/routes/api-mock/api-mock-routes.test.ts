import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../../src/shared/api-mock/contracts.js';
import { DEFAULT_SETTINGS } from '../../../src/shared/api-mock/defaults.js';

const setTransactionHandler = vi.fn();
const start = vi.fn();
const stop = vi.fn();
const restart = vi.fn();
const commit = vi.fn();
const status = vi.fn();
const list = vi.fn();
const getScenarioState = vi.fn();
const resetScenarioState = vi.fn();
const validateServer = vi.fn();
const isPortAvailable = vi.fn();

vi.mock('../../api-mock/ApiMockServerPool.js', () => ({
  apiMockPool: {
    setTransactionHandler: (...args: unknown[]) => setTransactionHandler(...args),
    start: (...args: unknown[]) => start(...args),
    stop: (...args: unknown[]) => stop(...args),
    restart: (...args: unknown[]) => restart(...args),
    commit: (...args: unknown[]) => commit(...args),
    status: (...args: unknown[]) => status(...args),
    list: (...args: unknown[]) => list(...args),
    getScenarioState: (...args: unknown[]) => getScenarioState(...args),
    resetScenarioState: (...args: unknown[]) => resetScenarioState(...args),
  },
}));
vi.mock('../../../src/shared/api-mock/validation.js', () => ({
  validateServer: (...args: unknown[]) => validateServer(...args),
}));
vi.mock('../../api-mock/ApiMockNetworkListener.js', () => ({
  isPortAvailable: (...args: unknown[]) => isPortAvailable(...args),
}));

import { createApiMockRouter } from './api-mock-routes.js';

const ts = '2026-08-12T00:00:00.000Z';

function makeDef(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Mock Server 1',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

function makeTx(): ApiMockTransactionV1 {
  return {
    id: 'tx-1',
    serverId: 'srv-1',
    generation: 1,
    receivedAt: ts,
    completedAt: ts,
    request: {
      method: 'GET', path: '/users', rawPath: '/users', query: {}, cookies: {}, headers: {},
      body: null, bodyTruncated: false, receivedAt: ts,
    },
    response: { status: 200, headers: {}, cookies: [], body: '{}', bodyTruncated: false, durationMs: 3, generationAtResponse: 1 },
    outcome: 'matched',
    matchedRouteId: 'r1',
    explanation: {
      normalizedRequest: { method: 'GET', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
      candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched', selectedRouteId: 'r1' },
      nearMisses: [],
    },
    durationMs: 3,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const onLog = vi.fn();
  app.use(createApiMockRouter({ onLog }));
  const txHandler = setTransactionHandler.mock.calls.at(-1)?.[0] as ((tx: ApiMockTransactionV1) => void) | undefined;
  return { app, onLog, txHandler };
}

describe('createApiMockRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateServer.mockReturnValue([]);
    isPortAvailable.mockResolvedValue(true);
    status.mockReturnValue(undefined);
    list.mockReturnValue([]);
    getScenarioState.mockReturnValue(undefined);
    resetScenarioState.mockReturnValue(false);
  });

  it('handles start validation, success, and classified failures', async () => {
    const { app, onLog } = buildApp();

    let res = await request(app).post('/api/mock/servers/start').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');

    validateServer.mockReturnValueOnce([{ severity: 'error', message: 'bad config' }]);
    res = await request(app).post('/api/mock/servers/start').send(makeDef());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    start.mockResolvedValueOnce({ serverId: 'srv-1', port: 4600, state: 'running', generation: 1 });
    res = await request(app).post('/api/mock/servers/start').send(makeDef());
    expect(res.status).toBe(200);
    expect(res.body.data.generation).toBe(1);
    expect(onLog).toHaveBeenCalled();

    start.mockRejectedValueOnce(new Error('listen EADDRINUSE: address already in use'));
    res = await request(app).post('/api/mock/servers/start').send(makeDef());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MOCK_PORT_IN_USE');
  });

  it('handles stop, restart, commit, status, state, list, and probe routes', async () => {
    const { app } = buildApp();

    stop.mockResolvedValueOnce({ serverId: 'srv-1', port: 4600, state: 'stopped', generation: 1 });
    let res = await request(app).post('/api/mock/servers/srv-1/stop');
    expect(res.status).toBe(200);

    stop.mockRejectedValueOnce(new Error('missing'));
    res = await request(app).post('/api/mock/servers/srv-1/stop');
    expect(res.status).toBe(404);

    res = await request(app).post('/api/mock/servers/srv-1/restart').send({});
    expect(res.status).toBe(400);

    restart.mockResolvedValueOnce({ serverId: 'srv-1', port: 4600, state: 'running', generation: 2 });
    res = await request(app).post('/api/mock/servers/srv-1/restart').send(makeDef());
    expect(res.status).toBe(200);

    restart.mockRejectedValueOnce(new Error('fetch failed'));
    res = await request(app).post('/api/mock/servers/srv-1/restart').send(makeDef());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COMPANION_UNAVAILABLE');

    res = await request(app).put('/api/mock/servers/srv-1/definition').send({});
    expect(res.status).toBe(400);

    validateServer.mockReturnValueOnce([{ severity: 'error', message: 'invalid draft' }]);
    res = await request(app).put('/api/mock/servers/srv-1/definition').send(makeDef());
    expect(res.status).toBe(400);

    commit.mockReturnValueOnce({ serverId: 'srv-1', port: 4600, state: 'running', generation: 3 });
    res = await request(app).put('/api/mock/servers/srv-1/definition').send(makeDef());
    expect(res.status).toBe(200);

    commit.mockImplementationOnce(() => { throw new Error('not running'); });
    res = await request(app).put('/api/mock/servers/srv-1/definition').send(makeDef());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COMMIT_FAILED');

    status.mockReturnValueOnce(undefined);
    res = await request(app).get('/api/mock/servers/srv-1/status');
    expect(res.status).toBe(404);

    status.mockReturnValueOnce({ serverId: 'srv-1', port: 4600, state: 'running', generation: 3 });
    res = await request(app).get('/api/mock/servers/srv-1/status');
    expect(res.status).toBe(200);

    getScenarioState.mockReturnValueOnce(undefined);
    res = await request(app).get('/api/mock/servers/srv-1/state');
    expect(res.status).toBe(404);

    getScenarioState.mockReturnValueOnce({ states: { default: 'advanced' }, counters: { hits: 2 } });
    res = await request(app).get('/api/mock/servers/srv-1/state');
    expect(res.status).toBe(200);
    expect(res.body.data.counters.hits).toBe(2);

    resetScenarioState.mockReturnValueOnce(false);
    res = await request(app).post('/api/mock/servers/srv-1/state/reset');
    expect(res.status).toBe(404);

    resetScenarioState.mockReturnValueOnce(true);
    res = await request(app).post('/api/mock/servers/srv-1/state/reset');
    expect(res.status).toBe(200);

    list.mockReturnValueOnce([{ serverId: 'srv-1', port: 4600, state: 'running', generation: 3 }]);
    res = await request(app).get('/api/mock/servers');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    res = await request(app).post('/api/mock/ports/probe').send({ port: 80 });
    expect(res.status).toBe(400);

    isPortAvailable.mockResolvedValueOnce(false);
    res = await request(app).post('/api/mock/ports/probe').send({ port: 4610 });
    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
  });

  it('creates journals, lists transactions with filters, and clears them', async () => {
    const { app, txHandler } = buildApp();

    let res = await request(app).get('/api/mock/servers/srv-1/transactions');
    expect(res.status).toBe(404);

    start.mockResolvedValueOnce({ serverId: 'srv-1', port: 4600, state: 'running', generation: 1 });
    await request(app).post('/api/mock/servers/start').send(makeDef());
    expect(txHandler).toBeTypeOf('function');

    txHandler?.(makeTx());
    txHandler?.({ ...makeTx(), id: 'tx-2', outcome: 'unmatched', request: { ...makeTx().request, method: 'POST', path: '/orders' } });

    res = await request(app)
      .get('/api/mock/servers/srv-1/transactions')
      .query({ limit: 1, method: 'GET', path: 'users', outcome: 'matched' });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toHaveLength(1);
    expect(res.body.data.total).toBe(2);

    res = await request(app).delete('/api/mock/servers/unknown/transactions');
    expect(res.status).toBe(404);

    res = await request(app).delete('/api/mock/servers/srv-1/transactions');
    expect(res.status).toBe(200);

    res = await request(app).get('/api/mock/servers/srv-1/transactions');
    expect(res.body.data.transactions).toHaveLength(0);
  });
});
