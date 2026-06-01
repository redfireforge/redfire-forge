/**
 * KafkaService — Core Scenario Tests
 * Covers: connect, disconnect, listTopics, produce, consumeOnce, subscribe (happy path + validation)
 *
 * Edge-case and branch-coverage tests live in:
 *   kafka-service.coverage.test.ts
 *   kafka-service.coverage-gap.test.ts
 */
import { describe, expect, it, vi } from 'vitest';
import type {
  KafkaAdminAdapter,
  KafkaConsumerAdapter,
  KafkaConsumerRecord,
  KafkaProducerAdapter,
  KafkaRuntimeAdapter,
} from './kafka-adapter.js';
import { KafkaService } from './kafka-service.js';
import { createMockRuntimeAdapter, makeConnection } from './kafka-service.test-utils.js';

describe('KafkaService — Core Scenarios', () => {
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
});
