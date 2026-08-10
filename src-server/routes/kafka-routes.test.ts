/**
 * @vitest-environment node
 */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKafkaRouter } from './kafka-routes.js';
import { createKafkaErrorEnvelope, createKafkaSuccessEnvelope } from '../kafka/contracts.js';
import {
  SchemaRegistryError,
  listSubjectsWithFormat,
  listVersions,
  fetchSchema,
  registerSchemaVersion,
} from '../kafka/schema-registry-client.js';

// ── Mock schema-registry-client (schema routes delegate directly to these) ────
vi.mock('../kafka/schema-registry-client.js', () => ({
  listSubjects: vi.fn(),
  listSubjectsWithFormat: vi.fn(),
  listVersions: vi.fn(),
  fetchSchema: vi.fn(),
  registerSchemaVersion: vi.fn(),
  SchemaRegistryError: class SchemaRegistryError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'SchemaRegistryError';
      this.code = code;
    }
  },
}));

function createMockService() {
  return {
    connect: vi.fn(async () => createKafkaSuccessEnvelope('connect', {
      status: { state: 'connected', clusterId: 'local-dev', subscriptionCount: 0 },
      reusedExistingConnection: false,
    })),
    disconnect: vi.fn(async () => createKafkaSuccessEnvelope('disconnect', {
      status: { state: 'disconnected', subscriptionCount: 0 },
      disconnected: true,
      cleanedSubscriptions: 0,
    })),
    getStatus: vi.fn(() => createKafkaSuccessEnvelope('status', {
      state: 'connected',
      clusterId: 'local-dev',
      subscriptionCount: 0,
    })),
    listTopics: vi.fn(async () => createKafkaSuccessEnvelope('topics', {
      clusterId: 'local-dev',
      topics: [{ name: 'orders.created', partitions: 3, isInternal: false }],
    })),
    produce: vi.fn(async () => createKafkaSuccessEnvelope('produce', {
      clusterId: 'local-dev',
      topic: 'orders.created',
      sentCount: 1,
      records: [{ partition: 0, offset: '1' }],
    })),
    consumeOnce: vi.fn(async () => createKafkaSuccessEnvelope('consume-once', {
      messageCount: 1,
      messages: [{
        topic: 'orders.created',
        partition: 0,
        offset: '1',
        value: '{"orderId":"o1"}',
      }],
      timedOut: false,
    })),
    subscribe: vi.fn(async () => createKafkaSuccessEnvelope('subscribe', {
      clusterId: 'local-dev',
      subscription: {
        subscriptionId: 'sub-1',
        topic: 'orders.created',
        groupId: 'g-1',
        createdAt: new Date().toISOString(),
      },
    })),
    getSubscriptions: vi.fn(() => createKafkaSuccessEnvelope('subscriptions', {
      clusterId: 'local-dev',
      subscriptions: [],
    })),
    unsubscribe: vi.fn(async () => createKafkaSuccessEnvelope('unsubscribe', {
      clusterId: 'local-dev',
      subscriptionId: 'sub-1',
      unsubscribed: true,
    })),
  };
}

function createApp(service: ReturnType<typeof createMockService>) {
  const app = express();
  app.use(express.json());
  app.use(createKafkaRouter({ service: service as never }));
  return app;
}

function createAppWithQueryOverride(
  service: ReturnType<typeof createMockService>,
  query: Record<string, unknown>,
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'query', {
      value: query,
      configurable: true,
    });
    next();
  });
  app.use(createKafkaRouter({ service: service as never }));
  return app;
}

describe('kafka-routes', () => {
  afterEach(() => { resetAllMocks(); });

  it('POST /api/kafka/disconnect delegates valid bodies to service', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/disconnect').send({ clusterId: 'local-dev' });

    expect(res.status).toBe(200);
    expect(service.disconnect).toHaveBeenCalledWith({ clusterId: 'local-dev' });
  });

  it('POST /api/kafka/disconnect rejects array payloads', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/disconnect').send([]);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('KAFKA_INVALID_REQUEST');
    expect(service.disconnect).not.toHaveBeenCalled();
  });

  it('POST /api/kafka/connect delegates to service', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/connect').send({
      connection: {
        clusterId: 'local-dev',
        clientId: 'redfire',
        brokers: ['127.0.0.1:9092'],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(service.connect).toHaveBeenCalledTimes(1);
  });

  it('POST /api/kafka/connect rejects array payloads', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/connect').send([]);

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('KAFKA_INVALID_REQUEST');
    expect(service.connect).not.toHaveBeenCalled();
  });

  it('GET /api/kafka/topics validates includeInternal query', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).get('/api/kafka/topics?includeInternal=banana');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('KAFKA_INVALID_REQUEST');
    expect(service.listTopics).not.toHaveBeenCalled();
  });

  it('GET /api/kafka/status forwards clusterId query', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).get('/api/kafka/status?clusterId=cluster-a');

    expect(res.status).toBe(200);
    expect(service.getStatus).toHaveBeenCalledWith({ clusterId: 'cluster-a' });
  });

  it('GET /api/kafka/topics forwards valid boolean query values', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).get('/api/kafka/topics?clusterId=cluster-a&includeInternal=false');

    expect(res.status).toBe(200);
    expect(service.listTopics).toHaveBeenCalledWith({
      clusterId: 'cluster-a',
      includeInternal: false,
    });
  });

  it('GET /api/kafka/topics accepts includeInternal=1', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).get('/api/kafka/topics?includeInternal=1');

    expect(res.status).toBe(200);
    expect(service.listTopics).toHaveBeenCalledWith({
      clusterId: undefined,
      includeInternal: true,
    });
  });

  it('GET /api/kafka/topics accepts boolean query overrides from middleware', async () => {
    const service = createMockService();
    const app = createAppWithQueryOverride(service, { includeInternal: true, clusterId: 'cluster-b' });

    const res = await request(app).get('/api/kafka/topics');

    expect(res.status).toBe(200);
    expect(service.listTopics).toHaveBeenCalledWith({
      clusterId: 'cluster-b',
      includeInternal: true,
    });
  });

  it('POST /api/kafka/produce rejects non-object payloads', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/produce').send([]);

    expect(res.status).toBe(400);
    expect(service.produce).not.toHaveBeenCalled();
  });

  it('POST /api/kafka/consume-once rejects non-object payloads', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/consume-once').send([]);

    expect(res.status).toBe(400);
    expect(service.consumeOnce).not.toHaveBeenCalled();
  });

  it('POST /api/kafka/subscribe rejects non-object payloads', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/subscribe').send([]);

    expect(res.status).toBe(400);
    expect(service.subscribe).not.toHaveBeenCalled();
  });

  it('POST /api/kafka/unsubscribe rejects non-object payloads', async () => {
    const service = createMockService();
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/unsubscribe').send([]);

    expect(res.status).toBe(400);
    expect(service.unsubscribe).not.toHaveBeenCalled();
  });

  it('maps KAFKA_INVALID_* errors to 400', async () => {
    const service = createMockService();
    service.produce.mockResolvedValueOnce(createKafkaErrorEnvelope('produce', {
      code: 'KAFKA_INVALID_PRODUCE',
      message: 'invalid',
    }));
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/produce').send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('maps KAFKA_NOT_CONNECTED errors to 503', async () => {
    const service = createMockService();
    service.consumeOnce.mockResolvedValueOnce(createKafkaErrorEnvelope('consume-once', {
      code: 'KAFKA_NOT_CONNECTED',
      message: 'not connected',
    }));
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/consume-once').send({ topic: 'orders.created' });

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });

  it('maps NOT_FOUND errors to 404', async () => {
    const service = createMockService();
    service.unsubscribe.mockResolvedValueOnce(createKafkaErrorEnvelope('unsubscribe', {
      code: 'KAFKA_SUBSCRIPTION_NOT_FOUND',
      message: 'missing',
    }));
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/unsubscribe').send({ subscriptionId: 'missing' });

    expect(res.status).toBe(404);
  });

  it('maps MISMATCH errors to 409', async () => {
    const service = createMockService();
    service.listTopics.mockResolvedValueOnce(createKafkaErrorEnvelope('topics', {
      code: 'KAFKA_CLUSTER_MISMATCH',
      message: 'wrong cluster',
    }));
    const app = createApp(service);

    const res = await request(app).get('/api/kafka/topics?clusterId=wrong');

    expect(res.status).toBe(409);
  });

  it('maps unknown server errors to 500', async () => {
    const service = createMockService();
    service.connect.mockResolvedValueOnce(createKafkaErrorEnvelope('connect', {
      code: 'KAFKA_CONNECT_FAILED',
      message: 'failed',
    }));
    const app = createApp(service);

    const res = await request(app).post('/api/kafka/connect').send({
      connection: { clusterId: 'local-dev', clientId: 'redfire', brokers: ['127.0.0.1:9092'] },
    });

    expect(res.status).toBe(500);
  });

  it('emits log lines for mutating Kafka routes', async () => {
    const service = createMockService();
    const onLog = vi.fn();
    const app = express();
    app.use(express.json());
    app.use(createKafkaRouter({ service: service as never, onLog }));

    await request(app).post('/api/kafka/connect').send({
      connection: { clusterId: 'local-dev', clientId: 'redfire', brokers: ['127.0.0.1:9092'] },
    });
    await request(app).post('/api/kafka/produce').send({ topic: 'orders.created', messages: [{ value: '{}' }] });

    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ text: '[Kafka] connect request' }));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ text: '[Kafka] produce request' }));
  });

  it('supports subscribe/list/unsubscribe routes', async () => {
    const service = createMockService();
    const app = createApp(service);

    const subscribe = await request(app).post('/api/kafka/subscribe').send({ topic: 'orders.created' });
    const list = await request(app).get('/api/kafka/subscriptions');
    const unsubscribe = await request(app).post('/api/kafka/unsubscribe').send({ subscriptionId: 'sub-1' });

    expect(subscribe.status).toBe(200);
    expect(list.status).toBe(200);
    expect(unsubscribe.status).toBe(200);
    expect(service.subscribe).toHaveBeenCalledTimes(1);
    expect(service.getSubscriptions).toHaveBeenCalledTimes(1);
    expect(service.unsubscribe).toHaveBeenCalledTimes(1);
  });

  // ── Phase 10 — Schema Registry routes ───────────────────────────────────────

  const schemaConfig = { registryUrl: 'http://localhost:8081', format: 'avro' as const };

  describe('POST /api/kafka/schema-subjects', () => {
    it('returns subjects on success', async () => {
      vi.mocked(listSubjectsWithFormat).mockResolvedValueOnce([
        { name: 'orders-value', schemaType: 'AVRO' },
        { name: 'payments-value', schemaType: 'AVRO' },
      ]);
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-subjects')
        .send({ schemaConfig });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.subjects).toEqual([
        { name: 'orders-value', schemaType: 'AVRO' },
        { name: 'payments-value', schemaType: 'AVRO' },
      ]);
      expect(vi.mocked(listSubjectsWithFormat)).toHaveBeenCalledWith(schemaConfig);
    });

    it('rejects missing schemaConfig.registryUrl with 400', async () => {
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-subjects')
        .send({ schemaConfig: { format: 'avro' } });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('KAFKA_INVALID_REQUEST');
    });

    it('rejects non-object body with 400', async () => {
      const app = createApp(createMockService());
      const res = await request(app).post('/api/kafka/schema-subjects').send([]);
      expect(res.status).toBe(400);
    });

    it('maps REGISTRY_AUTH_FAILURE to 401', async () => {
      vi.mocked(listSubjectsWithFormat).mockRejectedValueOnce(
        new SchemaRegistryError('REGISTRY_AUTH_FAILURE', 'denied'),
      );
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-subjects')
        .send({ schemaConfig });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REGISTRY_AUTH_FAILURE');
    });

    it('maps REGISTRY_UNREACHABLE to 503', async () => {
      vi.mocked(listSubjectsWithFormat).mockRejectedValueOnce(
        new SchemaRegistryError('REGISTRY_UNREACHABLE', 'down'),
      );
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-subjects')
        .send({ schemaConfig });

      expect(res.status).toBe(503);
      expect(res.body.error.retryable).toBe(true);
    });
  });

  describe('POST /api/kafka/schema-versions', () => {
    it('returns versions on success', async () => {
      vi.mocked(listVersions).mockResolvedValueOnce([1, 2, 3]);
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-versions')
        .send({ schemaConfig, subject: 'orders-value' });

      expect(res.status).toBe(200);
      expect(res.body.data.subject).toBe('orders-value');
      expect(res.body.data.versions).toEqual([1, 2, 3]);
      expect(vi.mocked(listVersions)).toHaveBeenCalledWith(schemaConfig, 'orders-value');
    });

    it('rejects missing subject with 400', async () => {
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-versions')
        .send({ schemaConfig });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('KAFKA_INVALID_REQUEST');
      expect(res.body.error.message).toContain('subject');
    });

    it('rejects blank subject with 400', async () => {
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-versions')
        .send({ schemaConfig, subject: '   ' });

      expect(res.status).toBe(400);
    });

    it('rejects missing schemaConfig.registryUrl with 400', async () => {
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-versions')
        .send({ schemaConfig: { format: 'avro' }, subject: 'orders-value' });

      expect(res.status).toBe(400);
    });

    it('maps REGISTRY_AUTH_FAILURE to 401', async () => {
      vi.mocked(listVersions).mockRejectedValueOnce(
        new SchemaRegistryError('REGISTRY_AUTH_FAILURE', 'denied'),
      );
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-versions')
        .send({ schemaConfig, subject: 'orders-value' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/kafka/schema-fetch', () => {
    const schemaResult = {
      subject: 'orders-value',
      version: 3,
      id: 42,
      schema: '{"type":"record","name":"Order"}',
      schemaType: 'AVRO',
    };

    it('returns schema on success (latest version)', async () => {
      vi.mocked(fetchSchema).mockResolvedValueOnce(schemaResult);
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-fetch')
        .send({ schemaConfig, subject: 'orders-value' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(schemaResult);
      expect(vi.mocked(fetchSchema)).toHaveBeenCalledWith(schemaConfig, 'orders-value', undefined);
    });

    it('passes explicit version to fetchSchema', async () => {
      vi.mocked(fetchSchema).mockResolvedValueOnce({ ...schemaResult, version: 2 });
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-fetch')
        .send({ schemaConfig, subject: 'orders-value', version: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.version).toBe(2);
      expect(vi.mocked(fetchSchema)).toHaveBeenCalledWith(schemaConfig, 'orders-value', 2);
    });

    it('rejects missing subject with 400', async () => {
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-fetch')
        .send({ schemaConfig });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('KAFKA_INVALID_REQUEST');
    });

    it('rejects missing schemaConfig.registryUrl with 400', async () => {
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-fetch')
        .send({ schemaConfig: { format: 'avro' }, subject: 'orders-value' });

      expect(res.status).toBe(400);
    });

    it('maps REGISTRY_UNREACHABLE to 503', async () => {
      vi.mocked(fetchSchema).mockRejectedValueOnce(
        new SchemaRegistryError('REGISTRY_UNREACHABLE', 'timeout'),
      );
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-fetch')
        .send({ schemaConfig, subject: 'orders-value' });

      expect(res.status).toBe(503);
      expect(res.body.error.retryable).toBe(true);
    });

    it('maps unexpected errors to 503 with retryable=true', async () => {
      vi.mocked(fetchSchema).mockRejectedValueOnce(new Error('unexpected failure'));
      const app = createApp(createMockService());

      const res = await request(app)
        .post('/api/kafka/schema-fetch')
        .send({ schemaConfig, subject: 'orders-value' });

      expect(res.status).toBe(503);
      expect(res.body.error.retryable).toBe(true);
    });
  });

  // ── Phase 3A: GET /api/kafka/subscription-messages ──────────────────────

  describe('GET /api/kafka/subscription-messages', () => {
    it('returns 200 with messages for valid subscriptionId', async () => {
      const service = createMockService();
      (service as Record<string, unknown>).getSubscriptionMessages = vi.fn(() =>
        createKafkaSuccessEnvelope('subscription-messages', {
          subscriptionId: 'sub-1',
          messages: [{ topic: 't', partition: 0, offset: '0', value: '{}' }],
          cursor: 1,
          bufferSize: 1,
          maxInMemoryMessages: 100,
        }),
      );
      const app = createApp(service);

      const res = await request(app)
        .get('/api/kafka/subscription-messages?subscriptionId=sub-1&sinceCursor=0');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.messages).toHaveLength(1);
      expect(res.body.data.cursor).toBe(1);
    });

    it('returns 400 when subscriptionId is missing', async () => {
      const service = createMockService();
      const app = createApp(service);

      const res = await request(app).get('/api/kafka/subscription-messages');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('KAFKA_INVALID_REQUEST');
    });

    it('returns 404 when subscription not found', async () => {
      const service = createMockService();
      (service as Record<string, unknown>).getSubscriptionMessages = vi.fn(() =>
        createKafkaErrorEnvelope('subscription-messages', {
          code: 'KAFKA_SUBSCRIPTION_NOT_FOUND',
          message: 'not found',
        }),
      );
      const app = createApp(service);

      const res = await request(app)
        .get('/api/kafka/subscription-messages?subscriptionId=nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('KAFKA_SUBSCRIPTION_NOT_FOUND');
    });

    it('parses sinceCursor as number from query string', async () => {
      const service = createMockService();
      const getSubMsgMock = vi.fn(() =>
        createKafkaSuccessEnvelope('subscription-messages', {
          subscriptionId: 'sub-1',
          messages: [],
          cursor: 5,
          bufferSize: 0,
          maxInMemoryMessages: 100,
        }),
      );
      (service as Record<string, unknown>).getSubscriptionMessages = getSubMsgMock;
      const app = createApp(service);

      await request(app)
        .get('/api/kafka/subscription-messages?subscriptionId=sub-1&sinceCursor=5');

      expect(getSubMsgMock).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId: 'sub-1', sinceCursor: 5 }),
      );
    });
  });

  describe('GET /api/kafka/topics/:topicName/detail', () => {
    it('returns 200 with topic detail on success', async () => {
      const service = createMockService();
      (service as Record<string, unknown>).getTopicDetail = vi.fn(async () =>
        createKafkaSuccessEnvelope('topic-detail', {
          clusterId: 'local-dev',
          topic: { name: 'orders.created', partitionCount: 3, replicationFactor: 1, isInternal: false, partitions: [], consumerGroups: [], config: {}, healthStatus: 'healthy' as const },
        }),
      );
      const app = createApp(service);

      const res = await request(app).get('/api/kafka/topics/orders.created/detail');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('catches unexpected thrown errors and returns KAFKA_TOPIC_DETAIL_FAILED', async () => {
      const service = createMockService();
      (service as Record<string, unknown>).getTopicDetail = vi.fn(async () => {
        throw new Error('broker disconnected');
      });
      const app = createApp(service);

      const res = await request(app).get('/api/kafka/topics/orders.created/detail?clusterId=local-dev');

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('KAFKA_TOPIC_DETAIL_FAILED');
      expect(res.body.error.message).toContain('broker disconnected');
    });

    it('forwards clusterId query parameter to service', async () => {
      const service = createMockService();
      const detailMock = vi.fn(async () =>
        createKafkaSuccessEnvelope('topic-detail', {
          clusterId: 'cluster-a',
          topic: { name: 'payments', partitionCount: 1, replicationFactor: 1, isInternal: false, partitions: [], consumerGroups: [], config: {}, healthStatus: 'unknown' as const },
        }),
      );
      (service as Record<string, unknown>).getTopicDetail = detailMock;
      const app = createApp(service);

      await request(app).get('/api/kafka/topics/payments/detail?clusterId=cluster-a');

      expect(detailMock).toHaveBeenCalledWith('payments', expect.objectContaining({ clusterId: 'cluster-a' }));
    });
  });

  describe('POST /api/kafka/schema-versions — additional branches', () => {
    it('rejects non-object body with 400', async () => {
      const service = createMockService();
      const app = createApp(service);

      const res = await request(app)
        .post('/api/kafka/schema-versions')
        .send([{ schemaConfig: { registryUrl: 'http://r:8081' }, subject: 'my-topic-value' }]);

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('POST /api/kafka/schema-fetch — additional branches', () => {
    it('rejects non-object body with 400', async () => {
      const service = createMockService();
      const app = createApp(service);

      const res = await request(app)
        .post('/api/kafka/schema-fetch')
        .send([{ schemaConfig: { registryUrl: 'http://r:8081' }, subject: 'my-topic-value', version: 1 }]);

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });

  // ── POST /api/kafka/schema-seed-sample ──────────────────────────────────
  describe('POST /api/kafka/schema-seed-sample', () => {
    const seedSchemaConfig = { registryUrl: 'http://localhost:8081' };

    it('rejects non-object body with 400', async () => {
      const service = createMockService();
      const app = createApp(service);
      const res = await request(app)
        .post('/api/kafka/schema-seed-sample')
        .send(['not', 'an', 'object']);
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('rejects missing schemaConfig.registryUrl with 400', async () => {
      const service = createMockService();
      const app = createApp(service);
      const res = await request(app)
        .post('/api/kafka/schema-seed-sample')
        .send({ schemaConfig: {} });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('seeds sample schemas and returns success envelope', async () => {
      vi.mocked(registerSchemaVersion)
        .mockResolvedValueOnce({ id: 1 })           // v1 registration
        .mockResolvedValueOnce({ id: 1, version: 2 }) // v2 registration
        .mockResolvedValue({ id: 99 });               // best-effort extras

      const service = createMockService();
      const app = createApp(service);
      const res = await request(app)
        .post('/api/kafka/schema-seed-sample')
        .send({ schemaConfig: seedSchemaConfig, subject: 'orders-value' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.subject).toBe('orders-value');
      expect(res.body.data.id).toBe(1);
    });

    it('returns error envelope when registration throws', async () => {
      vi.mocked(registerSchemaVersion).mockRejectedValueOnce(
        new SchemaRegistryError('REGISTRY_UNREACHABLE', 'down'),
      );
      const service = createMockService();
      const app = createApp(service);
      const res = await request(app)
        .post('/api/kafka/schema-seed-sample')
        .send({ schemaConfig: seedSchemaConfig });
      // REGISTRY_UNREACHABLE maps to 503 everywhere else in this router (see
      // schema-subjects/schema-versions/schema-fetch tests above).
      expect(res.status).toBe(503);
      expect(res.body.ok).toBe(false);
    });
  });
});
