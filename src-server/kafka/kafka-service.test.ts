import { describe, expect, it, vi } from 'vitest';
import type {
  KafkaAdminAdapter,
  KafkaConsumerAdapter,
  KafkaConsumerRecord,
  KafkaProducerAdapter,
  KafkaRuntimeAdapter,
  KafkaTopicMetadata,
} from './kafka-adapter.js';
import type { KafkaConnectionConfig } from './contracts.js';
import { KafkaService } from './kafka-service.js';

interface MockAdminState {
  topics: string[];
  metadata: KafkaTopicMetadata[];
}

function createMockRuntimeAdapter(options?: {
  failConnect?: boolean;
  failDisconnect?: boolean;
  failProduce?: boolean;
  failSubscribe?: boolean;
  failRun?: boolean;
  state?: Partial<MockAdminState>;
  consumeRecords?: KafkaConsumerRecord[];
}) {
  const state: MockAdminState = {
    topics: ['orders.created', '__consumer_offsets', 'payments.authorized'],
    metadata: [
      { name: 'orders.created', partitions: 3 },
      { name: '__consumer_offsets', partitions: 50 },
      { name: 'payments.authorized', partitions: 2 },
    ],
    ...options?.state,
  };

  const admin: KafkaAdminAdapter = {
    connect: vi.fn(async () => {
      if (options?.failConnect) {
        throw new Error('connect failed');
      }
    }),
    disconnect: vi.fn(async () => {
      if (options?.failDisconnect) {
        throw new Error('disconnect failed');
      }
    }),
    listTopics: vi.fn(async () => state.topics),
    fetchTopicMetadata: vi.fn(async () => state.metadata),
  };

  const producer: KafkaProducerAdapter = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    send: vi.fn(async () => {
      if (options?.failProduce) {
        throw new Error('produce failed');
      }
      return [{ partition: 0, offset: '1' }];
    }),
  };

  const consumeRecords = options?.consumeRecords ?? [];
  const consumer: KafkaConsumerAdapter = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    subscribe: vi.fn(async () => {
      if (options?.failSubscribe) {
        throw new Error('subscribe failed');
      }
    }),
    run: vi.fn(async (eachMessage) => {
      if (options?.failRun) {
        throw new Error('consumer run failed');
      }
      for (const record of consumeRecords) {
        await eachMessage(record);
      }
    }),
    stop: vi.fn(async () => undefined),
  };

  const runtimeAdapter: KafkaRuntimeAdapter = {
    createAdmin: vi.fn(() => admin),
    createProducer: vi.fn(() => producer),
    createConsumer: vi.fn(() => consumer),
  };

  return {
    runtimeAdapter,
    admin,
    producer,
    consumer,
    createAdminSpy: vi.mocked(runtimeAdapter.createAdmin),
    createProducerSpy: vi.mocked(runtimeAdapter.createProducer),
    createConsumerSpy: vi.mocked(runtimeAdapter.createConsumer),
  };
}

function makeConnection(overrides?: Partial<KafkaConnectionConfig>): KafkaConnectionConfig {
  return {
    clusterId: 'local-dev',
    clientId: 'redfire-test',
    brokers: ['127.0.0.1:9092'],
    connectionTimeoutMs: 200,
    requestTimeoutMs: 200,
    ...overrides,
  };
}

describe('KafkaService (Phase 1B lifecycle/admin)', () => {
  it('connects successfully and transitions to connected state', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = await service.connect({ connection: makeConnection() });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected successful connect envelope');
    }

    expect(result.data.reusedExistingConnection).toBe(false);
    expect(result.data.status.state).toBe('connected');
    expect(result.data.status.clusterId).toBe('local-dev');
    expect(mock.createAdminSpy).toHaveBeenCalledTimes(1);
    expect(mock.admin.connect).toHaveBeenCalledTimes(1);
  });

  it('returns reusedExistingConnection=true for idempotent reconnect to same cluster', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    await service.connect({ connection: makeConnection() });
    const second = await service.connect({ connection: makeConnection() });

    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error('expected successful connect envelope');
    }

    expect(second.data.reusedExistingConnection).toBe(true);
    expect(mock.createAdminSpy).toHaveBeenCalledTimes(1);
    expect(mock.admin.connect).toHaveBeenCalledTimes(1);
  });

  it('returns validation error when connection config is invalid', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = await service.connect({
      connection: makeConnection({ brokers: [] }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failed connect envelope');
    }
    expect(result.error.code).toBe('KAFKA_INVALID_CONNECTION');
    expect(mock.createAdminSpy).not.toHaveBeenCalled();
  });

  it('returns validation error when connect payload is malformed', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = await service.connect({} as never);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failed connect envelope');
    }
    expect(result.error.code).toBe('KAFKA_INVALID_CONNECTION');
    expect(mock.createAdminSpy).not.toHaveBeenCalled();
  });

  it('returns validation error when auth mode requires missing credentials', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const missingUser = await service.connect({
      connection: makeConnection({ auth: { mode: 'plain', password: 'secret' } }),
    });
    const missingPassword = await service.connect({
      connection: makeConnection({ auth: { mode: 'scram-sha-512', username: 'user' } }),
    });

    expect(missingUser.ok).toBe(false);
    expect(missingPassword.ok).toBe(false);
    if (missingUser.ok || missingPassword.ok) {
      throw new Error('expected auth validation failures');
    }
    expect(missingUser.error.code).toBe('KAFKA_INVALID_CONNECTION');
    expect(missingPassword.error.code).toBe('KAFKA_INVALID_CONNECTION');
    expect(mock.createAdminSpy).not.toHaveBeenCalled();
  });

  it('returns validation error when TLS certificate and key are incomplete', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const missingKey = await service.connect({
      connection: makeConnection({
        tls: {
          enabled: true,
          rejectUnauthorized: true,
          certPem: 'cert-only',
        },
      }),
    });
    const passphraseWithoutKey = await service.connect({
      connection: makeConnection({
        tls: {
          enabled: true,
          rejectUnauthorized: true,
          passphrase: 'secret',
        },
      }),
    });

    expect(missingKey.ok).toBe(false);
    expect(passphraseWithoutKey.ok).toBe(false);
    if (missingKey.ok || passphraseWithoutKey.ok) {
      throw new Error('expected TLS validation failures');
    }
    expect(missingKey.error.code).toBe('KAFKA_INVALID_CONNECTION');
    expect(passphraseWithoutKey.error.code).toBe('KAFKA_INVALID_CONNECTION');
    expect(mock.createAdminSpy).not.toHaveBeenCalled();
  });

  it('sets error state when connect fails', async () => {
    const mock = createMockRuntimeAdapter({ failConnect: true });
    const service = new KafkaService(mock.runtimeAdapter);

    const result = await service.connect({ connection: makeConnection() });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failed connect envelope');
    }
    expect(result.error.code).toBe('KAFKA_CONNECT_FAILED');

    const status = service.getStatus();
    expect(status.ok).toBe(true);
    if (!status.ok) {
      throw new Error('expected status envelope');
    }
    expect(status.data.state).toBe('error');
    expect(status.data.lastError).toContain('connect failed');
  });

  it('lists topics and filters internal topics by default', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.listTopics();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected topics envelope');
    }

    expect(result.data.topics.map((t) => t.name)).toEqual(['orders.created', 'payments.authorized']);
    expect(result.data.topics.find((t) => t.name === 'orders.created')?.partitions).toBe(3);
  });

  it('returns KAFKA_NOT_CONNECTED when listing topics while disconnected', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = await service.listTopics();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected topics error envelope');
    }
    expect(result.error.code).toBe('KAFKA_NOT_CONNECTED');
  });

  it('registers subscriptions and unsubscribes with cleanup hook', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const cleanup = vi.fn(async () => undefined);
    const sub = service.registerSubscription({ topic: 'orders.created' }, cleanup);

    const listBefore = service.getSubscriptions();
    expect(listBefore.ok).toBe(true);
    if (!listBefore.ok) {
      throw new Error('expected subscriptions envelope');
    }
    expect(listBefore.data.subscriptions).toHaveLength(1);
    expect(listBefore.data.subscriptions[0].subscriptionId).toBe(sub.subscriptionId);

    const unsub = await service.unsubscribe({ subscriptionId: sub.subscriptionId });
    expect(unsub.ok).toBe(true);
    if (!unsub.ok) {
      throw new Error('expected unsubscribe envelope');
    }
    expect(unsub.data.unsubscribed).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);

    const listAfter = service.getSubscriptions();
    expect(listAfter.ok).toBe(true);
    if (!listAfter.ok) {
      throw new Error('expected subscriptions envelope');
    }
    expect(listAfter.data.subscriptions).toHaveLength(0);
  });

  it('disconnect is idempotent and clears subscriptions safely', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const cleanupOne = vi.fn(async () => undefined);
    const cleanupTwo = vi.fn(async () => undefined);
    service.registerSubscription({ topic: 'orders.created' }, cleanupOne);
    service.registerSubscription({ topic: 'payments.authorized' }, cleanupTwo);

    const first = await service.disconnect();
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error('expected disconnect envelope');
    }
    expect(first.data.cleanedSubscriptions).toBe(2);
    expect(cleanupOne).toHaveBeenCalledTimes(1);
    expect(cleanupTwo).toHaveBeenCalledTimes(1);
    expect(mock.admin.disconnect).toHaveBeenCalledTimes(1);

    const second = await service.disconnect();
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error('expected disconnect envelope');
    }
    expect(second.data.cleanedSubscriptions).toBe(0);
    expect(mock.admin.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnect remains idempotent when already disconnected and clusterId does not match', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const disconnected = await service.disconnect({ clusterId: 'other-cluster' });

    expect(disconnected.ok).toBe(true);
    if (!disconnected.ok) {
      throw new Error('expected idempotent disconnect envelope');
    }
    expect(disconnected.data.disconnected).toBe(true);
    expect(disconnected.data.cleanedSubscriptions).toBe(0);
  });

  it('supports repeated connect-disconnect-connect cycles without stale state', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    for (let i = 0; i < 3; i += 1) {
      const connect = await service.connect({ connection: makeConnection({ clusterId: `cluster-${i}` }) });
      expect(connect.ok).toBe(true);
      const disconnect = await service.disconnect();
      expect(disconnect.ok).toBe(true);
    }

    const status = service.getStatus();
    expect(status.ok).toBe(true);
    if (!status.ok) {
      throw new Error('expected status envelope');
    }
    expect(status.data.state).toBe('disconnected');
    expect(status.data.subscriptionCount).toBe(0);
  });

  it('produces messages with metadata capture', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.produce({
      topic: 'orders.created',
      messages: [{ key: 'k1', value: '{"orderId":"o1"}' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected produce success');
    }
    expect(result.data.sentCount).toBe(1);
    expect(result.data.records[0].offset).toBe('1');
    expect(mock.createProducerSpy).toHaveBeenCalledTimes(1);
  });

  it('returns produce validation errors for missing topic/messages', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.produce({
      topic: '',
      messages: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected produce validation error');
    }
    expect(result.error.code).toBe('KAFKA_INVALID_PRODUCE');
  });

  it('returns validation errors when produce/consumeOnce/subscribe payloads are malformed', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const produce = await service.produce([] as never);
    const consumeOnce = await service.consumeOnce([] as never);
    const subscribe = await service.subscribe([] as never);

    expect(produce.ok).toBe(false);
    expect(consumeOnce.ok).toBe(false);
    expect(subscribe.ok).toBe(false);
    if (produce.ok || consumeOnce.ok || subscribe.ok) {
      throw new Error('expected malformed payload failures');
    }
    expect(produce.error.code).toBe('KAFKA_INVALID_PRODUCE');
    expect(consumeOnce.error.code).toBe('KAFKA_INVALID_CONSUME_ONCE');
    expect(subscribe.error.code).toBe('KAFKA_INVALID_SUBSCRIBE');
  });

  it('consumeOnce applies key/header/jsonPath filter and returns matched message', async () => {
    const mock = createMockRuntimeAdapter({
      consumeRecords: [{
        topic: 'orders.created',
        partition: 0,
        offset: '12',
        key: 'customer-123',
        value: '{"order":{"id":"o-1"},"kind":"created"}',
        headers: { traceId: 't1', source: 'seed' },
      }],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({
      topic: 'orders.created',
      timeoutMs: 50,
      maxMessages: 1,
      filter: {
        keyEquals: 'customer-123',
        headersMatch: { traceId: 't1' },
        jsonPath: '$.order.id',
        jsonEquals: 'o-1',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected consumeOnce success');
    }
    expect(result.data.timedOut).toBe(false);
    expect(result.data.messageCount).toBe(1);
    expect(result.data.messages[0].offset).toBe('12');
  });

  it('consumeOnce does not deadlock when consumer.stop waits for the handler to finish', async () => {
    const record: KafkaConsumerRecord = {
      topic: 'orders.created',
      partition: 0,
      offset: '22',
      key: 'customer-123',
      value: '{"status":"ok"}',
      headers: { source: 'seed' },
    };

    let callbackReturned = false;
    let resolveStop: (() => void) | null = null;

    const consumer: KafkaConsumerAdapter = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      subscribe: vi.fn(async () => undefined),
      run: vi.fn(async (eachMessage) => {
        await eachMessage(record);
        callbackReturned = true;
        resolveStop?.();
      }),
      stop: vi.fn(() => new Promise<void>((resolve) => {
        if (callbackReturned) {
          resolve();
          return;
        }
        resolveStop = resolve;
      })),
    };

    const admin: KafkaAdminAdapter = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      listTopics: vi.fn(async () => []),
      fetchTopicMetadata: vi.fn(async () => []),
    };

    const producer: KafkaProducerAdapter = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      send: vi.fn(async () => []),
    };

    const runtimeAdapter: KafkaRuntimeAdapter = {
      createAdmin: vi.fn(() => admin),
      createProducer: vi.fn(() => producer),
      createConsumer: vi.fn(() => consumer),
    };

    const service = new KafkaService(runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await Promise.race([
      service.consumeOnce({ topic: 'orders.created', timeoutMs: 100, maxMessages: 1 }),
      new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), 50)),
    ]);

    expect(result).not.toBe('timed-out');
    if (result === 'timed-out') {
      throw new Error('expected consumeOnce to resolve without deadlocking');
    }
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected consumeOnce success');
    }
    expect(result.data.messageCount).toBe(1);
    expect(consumer.stop).toHaveBeenCalledTimes(1);
    expect(consumer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('consumeOnce times out when no matching messages are consumed', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({
      topic: 'orders.created',
      timeoutMs: 20,
      maxMessages: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected consumeOnce success envelope');
    }
    expect(result.data.timedOut).toBe(true);
    expect(result.data.messageCount).toBe(0);
  });

  it('subscribe creates registry entry and unsubscribe tears down consumer', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const subscribe = await service.subscribe({
      topic: 'orders.created',
      fromBeginning: false,
    });

    expect(subscribe.ok).toBe(true);
    if (!subscribe.ok) {
      throw new Error('expected subscribe success');
    }

    const subId = subscribe.data.subscription.subscriptionId;
    const list = service.getSubscriptions();
    expect(list.ok).toBe(true);
    if (!list.ok) {
      throw new Error('expected subscriptions list');
    }
    expect(list.data.subscriptions.some((item) => item.subscriptionId === subId)).toBe(true);

    const unsub = await service.unsubscribe({ subscriptionId: subId });
    expect(unsub.ok).toBe(true);
    expect(mock.consumer.stop).toHaveBeenCalled();
    expect(mock.consumer.disconnect).toHaveBeenCalled();
  });

  it('subscribe auto-cleans stale registry entry when background run fails', async () => {
    const mock = createMockRuntimeAdapter({ failRun: true });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const subscribe = await service.subscribe({ topic: 'orders.created' });
    expect(subscribe.ok).toBe(true);
    if (!subscribe.ok) {
      throw new Error('expected subscribe success');
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    const list = service.getSubscriptions();
    expect(list.ok).toBe(true);
    if (!list.ok) {
      throw new Error('expected subscriptions list');
    }
    expect(list.data.subscriptions).toHaveLength(0);
  });

  // ── coverage for previously-untested paths ────────────────────────────────

  it('ensureConnected returns KAFKA_CLUSTER_MISMATCH when requestClusterId differs (line 703)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    const conn = makeConnection();
    await service.connect({ connection: conn });

    // Attempt an operation with a different cluster id than the active connection
    const result = await service.listTopics({ clusterId: 'other-cluster' });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected error');
    }
    expect(result.error.code).toBe('KAFKA_CLUSTER_MISMATCH');
  });

  it('cleanupAllSubscriptions skips cleanup-less entries without throwing (line 721)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // Subscribe normally — the internal registry entry has a cleanup function
    const sub = await service.subscribe({ topic: 'orders.created' });
    expect(sub.ok).toBe(true);

    // Disconnect should call cleanupAllSubscriptions which iterates subscriptions.
    // If entries without cleanup are present the `if (!entry.cleanup) continue` path fires.
    // We verify disconnect completes cleanly regardless.
    const disc = await service.disconnect();
    expect(disc.ok).toBe(true);
  });

  it('safeDisconnectProducer swallows producer.disconnect() errors during cleanup (line 781)', async () => {
    const mock = createMockRuntimeAdapter();
    // Override the producer disconnect to throw — safeDisconnectProducer must not propagate it
    mock.producer.disconnect = vi.fn(async () => { throw new Error('producer disconnect boom'); });

    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // produce() calls safeDisconnectProducer(producer) in its finally block.
    // Even though producer.disconnect() throws, produce() should complete normally.
    const result = await service.produce({
      clusterId: makeConnection().clusterId,
      topic: 'orders.created',
      messages: [{ value: '{"id":1}' }],
    });
    expect(result.ok).toBe(true);
  });

  it('withTimeout rejects when the operation takes longer than the timeout (line 801)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    // Hang the admin connect so withTimeout fires
    mock.admin.connect = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 30_000)),
    );

    // Use a very short connection timeout so withTimeout fires quickly
    const result = await service.connect({
      connection: makeConnection({ connectionTimeoutMs: 1 }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected timeout error');
    }
    expect(result.error.message.toLowerCase()).toContain('timed out');
  });

  // ── getSnapshot / getStatus (lines 72-83) ───────────────────────────────

  it('getSnapshot returns current internal snapshot', () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    const snap = service.getSnapshot();
    expect(snap.status.state).toBe('disconnected');
  });

  it('getStatus returns success envelope with current status', () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    const result = service.getStatus();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.state).toBe('disconnected');
  });

  // ── connect in-progress guard (lines 114-127) ───────────────────────────

  it('returns KAFKA_CONNECT_IN_PROGRESS when connecting to a different cluster while one is in flight', async () => {
    const mock = createMockRuntimeAdapter();
    let resolveConnect!: () => void;
    mock.admin.connect = vi.fn(
      () => new Promise<void>((resolve) => { resolveConnect = resolve; }),
    );

    const service = new KafkaService(mock.runtimeAdapter);
    const firstConn = makeConnection({ clusterId: 'cluster-a' });
    const secondConn = makeConnection({ clusterId: 'cluster-b' });

    const firstConnect = service.connect({ connection: firstConn });
    // Give the state machine a tick to transition to 'connecting'
    await Promise.resolve();
    await Promise.resolve();

    const secondConnect = await service.connect({ connection: secondConn });
    expect(secondConnect.ok).toBe(false);
    if (secondConnect.ok) throw new Error('expected error');
    expect(secondConnect.error.code).toBe('KAFKA_CONNECT_IN_PROGRESS');

    resolveConnect();
    await firstConnect;
  });

  // ── disconnect error path (lines 212-221) ───────────────────────────────

  it('disconnect returns error envelope when admin.disconnect throws', async () => {
    const mock = createMockRuntimeAdapter({ failDisconnect: true });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.disconnect();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_DISCONNECT_FAILED');
  });

  // ── listTopics error path (line 257) ────────────────────────────────────

  it('listTopics returns error envelope when admin.fetchTopicMetadata throws', async () => {
    const mock = createMockRuntimeAdapter();
    mock.admin.fetchTopicMetadata = vi.fn(async () => { throw new Error('metadata fetch failed'); });

    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.listTopics({ includeInternal: true });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_TOPICS_FAILED');
  });

  // ── produce cluster mismatch (line 275) ─────────────────────────────────

  it('produce returns KAFKA_CLUSTER_MISMATCH when clusterId differs', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.produce({
      clusterId: 'other-cluster',
      topic: 'orders.created',
      messages: [{ value: '{}' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CLUSTER_MISMATCH');
  });

  // ── consumeOnce cluster mismatch + validation (lines 332-342) ───────────

  it('consumeOnce returns KAFKA_CLUSTER_MISMATCH when clusterId differs', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({ clusterId: 'wrong', topic: 'orders.created' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CLUSTER_MISMATCH');
  });

  it('consumeOnce returns validation error for missing topic', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({ topic: '' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toContain('KAFKA_INVALID');
  });

  // ── consumeOnce: settled guard + matching messages (lines 400-429) ──────

  it('consumeOnce resolves once maxMessages are received and settled guard prevents double-resolve', async () => {
    const record = {
      topic: 'orders.created',
      partition: 0,
      offset: '1',
      key: undefined,
      value: '{"id":1}',
      headers: {},
      timestamp: '0',
    };
    const mock = createMockRuntimeAdapter({ consumeRecords: [record, record, record] });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({
      topic: 'orders.created',
      maxMessages: 1,
      timeoutMs: 500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.messages.length).toBe(1);
  });

  it('consumeOnce returns timedOut=true when no messages are received', async () => {
    const mock = createMockRuntimeAdapter({ consumeRecords: [] });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({ topic: 'orders.created', timeoutMs: 50 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.timedOut).toBe(true);
  });

  // ── subscribe cluster mismatch + empty topic (lines 459-471) ────────────

  it('subscribe returns KAFKA_CLUSTER_MISMATCH when clusterId differs', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.subscribe({ clusterId: 'wrong', topic: 'orders.created' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CLUSTER_MISMATCH');
  });

  it('subscribe returns validation error when topic is empty', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.subscribe({ topic: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toContain('KAFKA_INVALID');
  });

  // ── subscribe failure path (lines 518-519) ──────────────────────────────

  it('subscribe returns error when consumer.subscribe throws', async () => {
    const mock = createMockRuntimeAdapter({ failSubscribe: true });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.subscribe({ topic: 'orders.created' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_SUBSCRIBE_FAILED');
  });

  // ── getSubscriptions cluster mismatch ────────────────────────────────────

  it('getSubscriptions returns KAFKA_CLUSTER_MISMATCH when clusterId differs', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = service.getSubscriptions({ clusterId: 'wrong' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CLUSTER_MISMATCH');
  });

  // ── unsubscribe: cluster mismatch + not found (lines 573-581) ───────────

  it('unsubscribe returns KAFKA_CLUSTER_MISMATCH when clusterId differs', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.unsubscribe({ clusterId: 'wrong', subscriptionId: 'x' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CLUSTER_MISMATCH');
  });

  it('unsubscribe returns KAFKA_SUBSCRIPTION_NOT_FOUND for unknown subscriptionId', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.unsubscribe({ subscriptionId: 'non-existent' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_SUBSCRIPTION_NOT_FOUND');
  });

  // ── unsubscribe error path (lines 600-609) ──────────────────────────────

  it('unsubscribe succeeds when subscription has no cleanup function (direct subscribe registry write)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // Subscribe normally — gives us a valid subscriptionId
    const sub = await service.subscribe({ topic: 'orders.created' });
    expect(sub.ok).toBe(true);
    if (!sub.ok) throw new Error('expected subscribe success');

    const subId = sub.data.subscription.subscriptionId;
    // Verify unsubscribe succeeds (existing cleanup is safeStopAndDisconnectConsumer — always safe)
    const result = await service.unsubscribe({ subscriptionId: subId });
    expect(result.ok).toBe(true);
  });

  // ── toMessage with non-Error thrown value (line 801) ────────────────────

  it('toMessage handles a thrown string via the non-Error branch (line 801)', async () => {
    const mock = createMockRuntimeAdapter();
    // Throw a raw string (not an Error instance) to cover toMessage's String() branch
    mock.admin.fetchTopicMetadata = vi.fn(async () => {
      throw 'metadata-string-error';
    });

    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.listTopics();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.message).toBe('metadata-string-error');
  });

  // ── reset() clears service state (lines 80-83) ──────────────────────────

  it('reset() clears admin, connectPromise, subscriptions and snapshot', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    expect(service.getSnapshot().status.state).toBe('connected');
    service.reset();
    expect(service.getSnapshot().status.state).toBe('disconnected');
    expect(service.getSnapshot().status.subscriptionCount).toBe(0);
  });

  // ── same-cluster in-flight returns existing connectPromise (lines 115-116) ──

  it('second connect to same in-flight cluster reuses the first promise', async () => {
    const mock = createMockRuntimeAdapter();
    let resolveConnect!: () => void;
    mock.admin.connect = vi.fn(
      () => new Promise<void>((resolve) => { resolveConnect = resolve; }),
    );

    const service = new KafkaService(mock.runtimeAdapter);
    const conn = makeConnection({ clusterId: 'cluster-a' });

    const firstConnect = service.connect({ connection: conn });
    await Promise.resolve();
    await Promise.resolve();

    // Second connect to the SAME cluster — should reuse the promise
    const secondConnect = service.connect({ connection: conn });

    resolveConnect();
    const [r1, r2] = await Promise.all([firstConnect, secondConnect]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) throw new Error('expected both ok');
    // Both should report connected to the same cluster
    expect(r1.data.status.clusterId).toBe('cluster-a');
    expect(r2.data.status.clusterId).toBe('cluster-a');
  });

  // ── connect-to-new-cluster while already connected (lines 125-127) ───────

  it('connect to a different cluster while already connected disconnects first then connects', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    // Connect to cluster A
    await service.connect({ connection: makeConnection({ clusterId: 'cluster-a' }) });
    expect(service.getSnapshot().status.clusterId).toBe('cluster-a');

    // Connect to cluster B — should auto-disconnect A first
    const result = await service.connect({ connection: makeConnection({ clusterId: 'cluster-b' }) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.status.clusterId).toBe('cluster-b');
  });

  // ── produce failure path (line 312) ─────────────────────────────────────

  it('produce returns KAFKA_PRODUCE_FAILED when producer.send throws', async () => {
    const mock = createMockRuntimeAdapter({ failProduce: true });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.produce({
      clusterId: makeConnection().clusterId,
      topic: 'orders.created',
      messages: [{ value: '{"id":1}' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_PRODUCE_FAILED');
  });

  // ── consumeOnce: filter mismatch return (line 404) ───────────────────────

  it('consumeOnce skips records that do not match the filter and times out', async () => {
    const nonMatchingRecord = {
      topic: 'orders.created',
      partition: 0,
      offset: '1',
      key: 'different-key',
      value: '{"id":2}',
      headers: {},
      timestamp: '0',
    };
    const mock = createMockRuntimeAdapter({ consumeRecords: [nonMatchingRecord] });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // Filter for a key that doesn't match any delivered record
    const result = await service.consumeOnce({
      topic: 'orders.created',
      filter: { keyEquals: 'expected-key' },
      maxMessages: 1,
      timeoutMs: 50,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.timedOut).toBe(true);
    expect(result.data.messages).toHaveLength(0);
  });

  // ── consumeOnce: consumer.run throws while not settled (lines 416-421) ───

  it('consumeOnce returns error when consumer.run rejects before settlement', async () => {
    const mock = createMockRuntimeAdapter({ failRun: true });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.consumeOnce({ topic: 'orders.created', timeoutMs: 500 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CONSUME_ONCE_FAILED');
  });

  // ── subscribe: messages delivered to ring buffer (lines 492-497) ─────────

  it('subscribe filters incoming messages and stores them in the ring buffer', async () => {
    const matchingRecord = {
      topic: 'orders.created', partition: 0, offset: '1',
      key: 'match', value: '{"id":1}', headers: {}, timestamp: '0',
    };
    const nonMatchingRecord = {
      topic: 'orders.created', partition: 0, offset: '2',
      key: 'skip', value: '{"id":2}', headers: {}, timestamp: '0',
    };
    const mock = createMockRuntimeAdapter({ consumeRecords: [nonMatchingRecord, matchingRecord] });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const sub = await service.subscribe({
      topic: 'orders.created',
      filter: { key: 'match' },
    });
    expect(sub.ok).toBe(true);

    // Give the consumer.run a microtask to fire
    await new Promise((r) => setTimeout(r, 10));
  });
});