/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { FIXTURE_DESCRIPTOR } from '../../../src/shared/grpc/contractFixtures.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from '../../grpc/descriptorStore.js';
import { clearDynamicProtoCodecCache } from '../../grpc/dynamicProtoCodec.js';
import { createGrpcMockRouter } from './grpc-mock-routes.js';
import { GrpcMockServerPool, resetGrpcMockServerPoolForTests } from '../../grpc/grpcMockServerPool.js';
import {
  getServerGrpcMockRuntimeRegistry,
  resetServerGrpcMockRuntimeRegistryForTests,
} from '../../grpc/grpcMockServerRuntimeBridge.js';

function echoMockRuleSet() {
  return {
    rules: [{
      id: 'echo-ok',
      name: 'Echo ok',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals' as const, method: 'Echo' },
      response: { statusCode: 0, body: { message: 'mocked' } },
    }],
  };
}

describe('grpc-mock-routes', () => {
  let pool: GrpcMockServerPool;

  beforeEach(async () => {
    await resetGrpcMockServerPoolForTests();
    resetServerGrpcMockRuntimeRegistryForTests();
    clearGrpcDescriptorStore();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    pool = new GrpcMockServerPool();
  });

  it('starts and stops a tab-scoped listener', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    const start = await request(app)
      .post('/api/grpc/mock/start')
      .send({
        tabId: 'tab-a',
        connectionId: 'conn-a',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        ruleSet: echoMockRuleSet(),
      });
    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.status.running).toBe(true);
    expect(start.body.data.status.listenTarget).toMatch(/^127\.0\.0\.1:\d+$/);

    const status = await request(app).get('/api/grpc/mock/status?tabId=tab-a');
    expect(status.body.data.status.running).toBe(true);

    const stop = await request(app).post('/api/grpc/mock/stop').send({ tabId: 'tab-a' });
    expect(stop.body.data.status.running).toBe(false);
  });

  it('isolates rules per tab', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-a',
      connectionId: 'conn-a',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: echoMockRuleSet(),
    });
    await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-b',
      connectionId: 'conn-b',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: {
        rules: [{
          id: 'other',
          name: 'Other',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Other' },
          response: { statusCode: 0, body: { message: 'tab-b' } },
        }],
      },
    });

    const statusA = await request(app).get('/api/grpc/mock/status?tabId=tab-a');
    const statusB = await request(app).get('/api/grpc/mock/status?tabId=tab-b');
    expect(statusA.body.data.status.port).not.toBe(statusB.body.data.status.port);
  });

  it('commits a new generation while running', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-a',
      connectionId: 'conn-a',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: echoMockRuleSet(),
    });

    const commit = await request(app).post('/api/grpc/mock/commit').send({
      tabId: 'tab-a',
      ruleSet: {
        rules: [{
          id: 'echo-v2',
          name: 'Echo v2',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { message: 'v2' } },
        }],
      },
    });
    expect(commit.body.data.generation).toBe(2);
  });

  it('commits latency policy while running', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-a',
      connectionId: 'conn-a',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: echoMockRuleSet(),
      latencyPolicy: { defaultLatencyMs: 5, jitterMs: 0, seed: 1 },
    });

    const commit = await request(app).post('/api/grpc/mock/commit').send({
      tabId: 'tab-a',
      ruleSet: echoMockRuleSet(),
      latencyPolicy: { defaultLatencyMs: 25, jitterMs: 0, seed: 1 },
    });
    expect(commit.status).toBe(200);
    expect(commit.body.data.generation).toBe(2);
  });

  it('redacts secret-like lastError in status export', async () => {
    const app = express();
    app.use(express.json());
    const leakyPool = {
      getStatus: () => ({
        running: false,
        tabId: 'tab-a',
        generation: 0,
        inFlightCount: 0,
        lastError: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      }),
      getLogs: () => [],
      start: async () => ({ status: { running: true, tabId: 'tab-a', generation: 1, inFlightCount: 0 } }),
      stop: async () => ({ running: false, tabId: 'tab-a', generation: 0, inFlightCount: 0 }),
      commit: () => ({ generation: 1, committedAt: new Date().toISOString() }),
    } as unknown as GrpcMockServerPool;
    app.use(createGrpcMockRouter({ pool: leakyPool }));

    const status = await request(app).get('/api/grpc/mock/status?tabId=tab-a');
    expect(status.body.data.status.lastError).toBe('[redacted]');
  });

  it('rejects start without parsed JSON object body', async () => {
    const app = express();
    app.use(createGrpcMockRouter({ pool }));

    const start = await request(app)
      .post('/api/grpc/mock/start')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('null'));
    expect(start.status).toBe(400);
    expect(start.body.error?.code ?? start.body.error).toBeTruthy();
  });

  it('rejects status/log without tabId', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    const status = await request(app).get('/api/grpc/mock/status');
    expect(status.status).toBe(400);
    expect(status.body.error.code).toBe('MOCK_INVALID_TAB');

    const logs = await request(app).get('/api/grpc/mock/log');
    expect(logs.status).toBe(400);
  });

  it('returns mock logs with since cursor', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-log',
      connectionId: 'conn-log',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: echoMockRuleSet(),
    });

    const logs = await request(app).get('/api/grpc/mock/log?tabId=tab-log&since=0');
    expect(logs.status).toBe(200);
    expect(logs.body.ok).toBe(true);
    expect(Array.isArray(logs.body.data.entries)).toBe(true);
  });

  it('invokes onLog for lifecycle actions', async () => {
    const lines: string[] = [];
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({
      pool,
      onLog: (line) => lines.push(line.text),
    }));

    await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-log-cb',
      connectionId: 'conn-log-cb',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: echoMockRuleSet(),
    });
    await request(app).post('/api/grpc/mock/stop').send({ tabId: 'tab-log-cb' });

    expect(lines.some((line) => line.includes('start tab=tab-log-cb'))).toBe(true);
    expect(lines.some((line) => line.includes('stop tab=tab-log-cb'))).toBe(true);
  });

  it('maps stop failures to MOCK_STOP_FAILED', async () => {
    const app = express();
    app.use(express.json());
    const failingPool = {
      getStatus: () => ({ running: false, tabId: 'tab-x', generation: 0, inFlightCount: 0 }),
      getLogs: () => [],
      start: async () => ({ status: { running: true, tabId: 'tab-x', generation: 1, inFlightCount: 0 } }),
      stop: async () => { throw new Error('stop boom'); },
      commit: () => ({ generation: 1, committedAt: new Date().toISOString() }),
    } as unknown as GrpcMockServerPool;
    app.use(createGrpcMockRouter({ pool: failingPool }));

    const stop = await request(app).post('/api/grpc/mock/stop').send({ tabId: 'tab-x' });
    expect(stop.status).toBe(500);
    expect(stop.body.error.code).toBe('MOCK_STOP_FAILED');
  });

  it('maps commit failures to MOCK_COMMIT_FAILED', async () => {
    const app = express();
    app.use(express.json());
    const failingPool = {
      getStatus: () => ({ running: true, tabId: 'tab-x', generation: 1, inFlightCount: 0 }),
      getLogs: () => [],
      start: async () => ({ status: { running: true, tabId: 'tab-x', generation: 1, inFlightCount: 0 } }),
      stop: async () => ({ running: false, tabId: 'tab-x', generation: 0, inFlightCount: 0 }),
      commit: () => { throw new Error('commit boom'); },
    } as unknown as GrpcMockServerPool;
    app.use(createGrpcMockRouter({ pool: failingPool }));

    const commit = await request(app).post('/api/grpc/mock/commit').send({
      tabId: 'tab-x',
      ruleSet: echoMockRuleSet(),
    });
    expect(commit.status).toBe(500);
    expect(commit.body.error.code).toBe('MOCK_COMMIT_FAILED');
  });

  it('rejects commit without tabId', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    const commit = await request(app).post('/api/grpc/mock/commit').send({ ruleSet: echoMockRuleSet() });
    expect(commit.status).toBe(400);
    expect(commit.body.error.code).toBe('MOCK_INVALID_REQUEST');
  });

  it('does not leave orphan server manager after start failure', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    const start = await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-fail',
      connectionId: 'conn-fail',
      descriptorKey: 'missing:descriptor:key',
      ruleSet: echoMockRuleSet(),
    });
    expect(start.status).toBe(500);
    expect(getServerGrpcMockRuntimeRegistry().hasManager('tab-fail')).toBe(false);
  });

  it('accepts tabId from request body on stop and status routes', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-body',
      connectionId: 'conn-body',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: echoMockRuleSet(),
    });

    const status = await request(app).get('/api/grpc/mock/status').send({ tabId: 'tab-body' });
    expect(status.status).toBe(200);
    expect(status.body.data.status.running).toBe(true);

    const stop = await request(app).post('/api/grpc/mock/stop').send({ tabId: 'tab-body' });
    expect(stop.body.data.status.running).toBe(false);
  });

  it('redacts lastError when status object leaks secrets outside diagnostic text', async () => {
    const app = express();
    app.use(express.json());
    const leakyPool = {
      getStatus: () => ({
        running: false,
        tabId: 'tab-a',
        generation: 0,
        inFlightCount: 0,
        lastError: 'listener crashed',
        token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      }),
      getLogs: () => [],
      start: async () => ({ status: { running: true, tabId: 'tab-a', generation: 1, inFlightCount: 0 } }),
      stop: async () => ({ running: false, tabId: 'tab-a', generation: 0, inFlightCount: 0 }),
      commit: () => ({ generation: 1, committedAt: new Date().toISOString() }),
    } as unknown as GrpcMockServerPool;
    app.use(createGrpcMockRouter({ pool: leakyPool }));

    const status = await request(app).get('/api/grpc/mock/status?tabId=tab-a');
    expect(status.body.data.status.lastError).toBe('[redacted]');
  });

  it('returns logs with default since cursor when since is not finite', async () => {
    const app = express();
    app.use(express.json());
    app.use(createGrpcMockRouter({ pool }));

    await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-since',
      connectionId: 'conn-since',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: echoMockRuleSet(),
    });

    const logs = await request(app).get('/api/grpc/mock/log?tabId=tab-since&since=not-a-number');
    expect(logs.status).toBe(200);
    expect(Array.isArray(logs.body.data.entries)).toBe(true);
    expect(typeof logs.body.data.nextCursor).toBe('number');
  });

  it('maps start failures to MOCK_START_FAILED', async () => {
    const app = express();
    app.use(express.json());
    const failingPool = {
      getStatus: () => ({ running: false, tabId: 'tab-x', generation: 0, inFlightCount: 0 }),
      getLogs: () => [],
      start: async () => { throw new Error('start boom'); },
      stop: async () => ({ running: false, tabId: 'tab-x', generation: 0, inFlightCount: 0 }),
      commit: () => ({ generation: 1, committedAt: new Date().toISOString() }),
    } as unknown as GrpcMockServerPool;
    app.use(createGrpcMockRouter({ pool: failingPool }));

    const start = await request(app).post('/api/grpc/mock/start').send({
      tabId: 'tab-x',
      connectionId: 'conn-x',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      ruleSet: echoMockRuleSet(),
    });
    expect(start.status).toBe(500);
    expect(start.body.error.code).toBe('MOCK_START_FAILED');
  });
});
