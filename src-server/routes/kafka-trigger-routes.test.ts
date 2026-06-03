/**
 * @vitest-environment node
 *
 * Unit tests for kafka-trigger-routes.ts
 * Covers POST /api/kafka/trigger/activate, POST /api/kafka/trigger/deactivate,
 * and GET /api/kafka/trigger/active.
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createKafkaTriggerRouter } from './kafka-trigger-routes.js';

// Mock file-storage (resolved relative to kafka-trigger-routes.ts)
vi.mock('../file-storage.js', () => ({
  getWorkflow: vi.fn(),
}));

import { getWorkflow } from '../file-storage.js';
const mockGetWorkflow = vi.mocked(getWorkflow);

// ── Helpers ───────────────────────────────────────────────────────────────────

function connectedSnapshot(
  bootstrapServers = 'localhost:9092',
  clusterId = 'test-cluster',
) {
  return {
    status: { state: 'connected' as const, subscriptionCount: 0 },
    connection: { bootstrapServers, clusterId },
  };
}

function disconnectedSnapshot() {
  return {
    status: { state: 'disconnected' as const, subscriptionCount: 0 },
    connection: undefined,
  };
}

function createMockService(snapshot = connectedSnapshot()) {
  return { getSnapshot: vi.fn(() => snapshot) };
}

function createMockManager() {
  return {
    activateTrigger: vi.fn<() => Promise<void>>(async () => undefined),
    deactivateTrigger: vi.fn<() => Promise<void>>(async () => undefined),
    getEntries: vi.fn(() => [] as ReturnType<{ getEntries(): [] }['getEntries']>),
  };
}

function createMockWorkflow(id = 'wf-1') {
  return {
    id,
    name: 'Test Workflow',
    nodes: [
      {
        id: 'trig-1',
        type: 'kafkaTrigger',
        position: { x: 0, y: 0 },
        data: {
          topic: 'orders.created',
          consumerGroupId: 'test-group',
          maxConcurrentRuns: 5,
        },
      },
    ],
    edges: [],
  };
}

function createApp(
  service = createMockService(),
  manager = createMockManager(),
) {
  const app = express();
  app.use(express.json());
  app.use(
    createKafkaTriggerRouter({
      service: service as never,
      manager: manager as never,
    }),
  );
  return app;
}

// ── POST /api/kafka/trigger/activate ─────────────────────────────────────────

describe('POST /api/kafka/trigger/activate', () => {
  let service: ReturnType<typeof createMockService>;
  let manager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createMockService();
    manager = createMockManager();
  });

  it('returns 400 when workflowId is missing', async () => {
    const app = createApp(service, manager);
    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ nodeId: 'trig-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workflowId/i);
  });

  it('returns 400 when workflowId is blank', async () => {
    const app = createApp(service, manager);
    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: '   ', nodeId: 'trig-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workflowId/i);
  });

  it('returns 400 when nodeId is missing', async () => {
    const app = createApp(service, manager);
    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nodeId/i);
  });

  it('returns 400 when nodeId is blank', async () => {
    const app = createApp(service, manager);
    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nodeId/i);
  });

  it('returns 404 when workflow is not found', async () => {
    mockGetWorkflow.mockResolvedValueOnce(null);
    const app = createApp(service, manager);
    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'missing-wf', nodeId: 'trig-1' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 503 when Kafka is not connected', async () => {
    const disconnectedService = createMockService(disconnectedSnapshot());
    mockGetWorkflow.mockResolvedValueOnce(createMockWorkflow() as never);
    const app = createApp(disconnectedService, manager);
    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/kafka is not connected/i);
  });

  it('returns 503 when Kafka state is connected but connection object is absent', async () => {
    // Defensive: state=connected but connection not set (should not happen in practice)
    const oddSnapshot = {
      status: { state: 'connected' as const, subscriptionCount: 0 },
      connection: undefined,
    };
    const oddService = createMockService(oddSnapshot);
    mockGetWorkflow.mockResolvedValueOnce(createMockWorkflow() as never);
    const app = createApp(oddService, manager);
    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(503);
  });

  it('returns 404 when nodeId does not exist in the workflow', async () => {
    const workflow = createMockWorkflow();
    mockGetWorkflow.mockResolvedValueOnce(workflow as never);
    const app = createApp(service, manager);

    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: 'nonexistent-node' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/node not found/i);
  });

  it('returns 400 when nodeId exists but is not a kafkaTrigger node', async () => {
    const workflow = {
      ...createMockWorkflow(),
      nodes: [
        {
          id: 'http-node',
          type: 'http',
          position: { x: 0, y: 0 },
          data: { label: 'HTTP' },
        },
      ],
    };
    mockGetWorkflow.mockResolvedValueOnce(workflow as never);
    const app = createApp(service, manager);

    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: 'http-node' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a kafkaTrigger node/i);
  });

  it('returns 200 and calls manager.activateTrigger on success', async () => {
    const workflow = createMockWorkflow();
    mockGetWorkflow.mockResolvedValueOnce(workflow as never);
    const snapshot = connectedSnapshot();
    const connectedService = createMockService(snapshot);
    const app = createApp(connectedService, manager);

    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(manager.activateTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow,
        nodeId: 'trig-1',
        connection: snapshot.connection,
      }),
    );
  });

  it('returns 500 when manager.activateTrigger throws', async () => {
    mockGetWorkflow.mockResolvedValueOnce(createMockWorkflow() as never);
    manager.activateTrigger.mockRejectedValueOnce(new Error('consumer connect failed'));
    const app = createApp(service, manager);

    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/consumer connect failed/i);
  });
});

// ── POST /api/kafka/trigger/deactivate ───────────────────────────────────────

describe('POST /api/kafka/trigger/deactivate', () => {
  let manager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = createMockManager();
  });

  it('returns 400 when workflowId is missing', async () => {
    const app = createApp(createMockService(), manager);
    const res = await request(app)
      .post('/api/kafka/trigger/deactivate')
      .send({ nodeId: 'trig-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workflowId/i);
  });

  it('returns 400 when nodeId is missing', async () => {
    const app = createApp(createMockService(), manager);
    const res = await request(app)
      .post('/api/kafka/trigger/deactivate')
      .send({ workflowId: 'wf-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nodeId/i);
  });

  it('returns 200 and calls manager.deactivateTrigger on success', async () => {
    const app = createApp(createMockService(), manager);
    const res = await request(app)
      .post('/api/kafka/trigger/deactivate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(manager.deactivateTrigger).toHaveBeenCalledWith('wf-1', 'trig-1');
  });

  it('returns 200 even when trigger was not active (idempotent)', async () => {
    // deactivateTrigger silently returns when entry is not found
    manager.deactivateTrigger.mockResolvedValueOnce(undefined);
    const app = createApp(createMockService(), manager);
    const res = await request(app)
      .post('/api/kafka/trigger/deactivate')
      .send({ workflowId: 'wf-nonexistent', nodeId: 'trig-1' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 500 when manager.deactivateTrigger throws', async () => {
    manager.deactivateTrigger.mockRejectedValueOnce(new Error('consumer disconnect failed'));
    const app = createApp(createMockService(), manager);

    const res = await request(app)
      .post('/api/kafka/trigger/deactivate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/consumer disconnect failed/i);
  });
});

// ── GET /api/kafka/trigger/active ─────────────────────────────────────────────

describe('GET /api/kafka/trigger/active', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty list when no triggers are active', async () => {
    const manager = createMockManager();
    const app = createApp(createMockService(), manager);

    const res = await request(app).get('/api/kafka/trigger/active');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.count).toBe(0);
    expect(res.body.triggers).toEqual([]);
  });

  it('returns active trigger entries from manager.getEntries()', async () => {
    const entries = [
      {
        workflowId: 'wf-1',
        nodeId: 'trig-1',
        topic: 'orders.created',
        groupId: 'grp-wf-1-trig-1',
        maxConcurrentRuns: 5,
        activeRunCount: 2,
        paused: false,
      },
      {
        workflowId: 'wf-2',
        nodeId: 'trig-2',
        topic: 'payments.processed',
        groupId: 'grp-wf-2-trig-2',
        maxConcurrentRuns: 3,
        activeRunCount: 0,
        paused: false,
      },
    ];
    const manager = createMockManager();
    manager.getEntries.mockReturnValueOnce(entries as never);
    const app = createApp(createMockService(), manager);

    const res = await request(app).get('/api/kafka/trigger/active');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.triggers).toEqual(entries);
  });
});

// ── Coverage gap: non-Error throws (String(err) branch) ───────────────────────

describe('non-Error thrown values', () => {
  beforeEach(() => vi.clearAllMocks());

  it('activate: returns 500 with String(err) when a non-Error is thrown (line 68)', async () => {
    mockGetWorkflow.mockResolvedValueOnce(createMockWorkflow() as never);
    const manager = createMockManager();
    // Throw a plain string — exercises the `String(err)` branch
    manager.activateTrigger.mockRejectedValueOnce('string rejection value' as never);
    const app = createApp(createMockService(), manager);

    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('string rejection value');
  });

  it('deactivate: returns 500 with String(err) when a non-Error is thrown (line 89)', async () => {
    const manager = createMockManager();
    manager.deactivateTrigger.mockRejectedValueOnce(42 as never);
    const app = createApp(createMockService(), manager);

    const res = await request(app)
      .post('/api/kafka/trigger/deactivate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('42');
  });
});

// ── Coverage gap: default service/manager singletons (lines 18-19) ────────────

// Mock the module-level singletons so the router can fall back to them
vi.mock('../kafka/kafka-service.js', () => ({
  kafkaService: {
    getSnapshot: vi.fn(() => ({
      status: { state: 'disconnected' as const, subscriptionCount: 0 },
      connection: undefined,
    })),
  },
}));
vi.mock('../kafka/kafkaTriggerSubscriptionManager.js', () => ({
  kafkaTriggerSubscriptionManager: {
    activateTrigger: vi.fn(async () => undefined),
    deactivateTrigger: vi.fn(async () => undefined),
    getEntries: vi.fn(() => []),
  },
}));

describe('default singleton fallback (options.service ?? kafkaService)', () => {
  it('uses kafkaService singleton when no service option is provided (lines 18-19)', async () => {
    // Provide a workflow so the code reaches service.getSnapshot()
    mockGetWorkflow.mockResolvedValueOnce(createMockWorkflow() as never);

    // Router created with no options — falls back to the mocked module singletons
    const app = express();
    app.use(express.json());
    app.use(createKafkaTriggerRouter());

    // The mocked kafkaService returns disconnected → 503
    const res = await request(app)
      .post('/api/kafka/trigger/activate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not connected/i);
  });

  it('uses kafkaTriggerSubscriptionManager singleton for deactivate (line 19)', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKafkaTriggerRouter());

    // deactivate does not need getWorkflow — goes straight to manager.deactivateTrigger
    const res = await request(app)
      .post('/api/kafka/trigger/deactivate')
      .send({ workflowId: 'wf-1', nodeId: 'trig-1' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
