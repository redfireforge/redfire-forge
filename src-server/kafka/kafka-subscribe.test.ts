/**
 * Unit tests for kafka-subscribe.ts
 *
 * Covers: basic subscribe, topic validation, consumer lifecycle,
 * ring buffer management, filter matching, error paths, and
 * subscription store interaction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSubscribe } from './kafka-subscribe.js';
import { createMockRuntimeAdapter, makeConnection, expectSuccess, expectError } from './kafka-service.test-utils.js';
import { KafkaSubscriptionStore } from './kafka-subscription-store.js';
import type { KafkaSubscribeRequest } from './contracts.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseRequest(overrides?: Partial<KafkaSubscribeRequest>): KafkaSubscribeRequest {
  return {
    clusterId: 'local-dev',
    topic: 'orders.created',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('executeSubscribe', () => {
  let subscriptionStore: KafkaSubscriptionStore;
  let onSubscriptionRemoved: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAllMocks();
    subscriptionStore = new KafkaSubscriptionStore();
    onSubscriptionRemoved = vi.fn();
  });

  it('creates a subscription and registers it in the store', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    expect(data.subscription).toBeDefined();
    expect(data.subscription.topic).toBe('orders.created');
    expect(data.subscription.subscriptionId).toBeTruthy();
    expect(data.clusterId).toBe('local-dev');

    // Verify registered in store
    expect(subscriptionStore.size).toBe(1);
    const entry = subscriptionStore.get(data.subscription.subscriptionId);
    expect(entry).toBeDefined();
    expect(entry!.info.topic).toBe('orders.created');
  });

  it('returns error for empty topic', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest({ topic: '' }),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const err = expectError(result, 'KAFKA_INVALID_SUBSCRIBE');
    expect(err.message).toBe('topic is required');
  });

  it('returns error for whitespace-only topic', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest({ topic: '   ' }),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    expectError(result, 'KAFKA_INVALID_SUBSCRIBE');
  });

  it('uses custom groupId when provided', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest({ groupId: 'my-group' }),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    expect(data.subscription.groupId).toBe('my-group');
  });

  it('generates groupId when not provided', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    expect(data.subscription.groupId).toContain('redfireforge-sub-');
  });

  it('connects consumer and subscribes to topic', async () => {
    const { runtimeAdapter, consumer } = createMockRuntimeAdapter();

    await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    expect(consumer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith('orders.created', false);
  });

  it('subscribes from beginning when requested', async () => {
    const { runtimeAdapter, consumer } = createMockRuntimeAdapter();

    await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest({ fromBeginning: true }),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    expect(consumer.subscribe).toHaveBeenCalledWith('orders.created', true);
  });

  it('returns error when subscribe fails', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter({ failSubscribe: true });

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const err = expectError(result, 'KAFKA_SUBSCRIBE_FAILED');
    expect(err.retryable).toBe(true);
  });

  it('does not register subscription on failure', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter({ failSubscribe: true });

    await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    expect(subscriptionStore.size).toBe(0);
  });

  it('stops and disconnects consumer on failure', async () => {
    const { runtimeAdapter, consumer } = createMockRuntimeAdapter({ failSubscribe: true });

    await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    expect(consumer.stop).toHaveBeenCalled();
    expect(consumer.disconnect).toHaveBeenCalled();
  });

  it('sets up cleanup function in the subscription entry', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    const entry = subscriptionStore.get(data.subscription.subscriptionId);
    expect(entry!.cleanup).toBeTypeOf('function');
  });

  it('ring buffer defaults to maxInMemoryMessages=100', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    const entry = subscriptionStore.get(data.subscription.subscriptionId);
    expect(entry!.maxInMemoryMessages).toBe(100);
  });

  it('respects custom maxInMemoryMessages', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest({ maxInMemoryMessages: 50 }),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    const entry = subscriptionStore.get(data.subscription.subscriptionId);
    expect(entry!.maxInMemoryMessages).toBe(50);
  });

  it('clamps maxInMemoryMessages to at least 1', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest({ maxInMemoryMessages: 0 }),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    const entry = subscriptionStore.get(data.subscription.subscriptionId);
    expect(entry!.maxInMemoryMessages).toBe(1);
  });

  it('populates ring buffer with consumed records', async () => {
    const records = [
      {
        topic: 'orders.created',
        partition: 0,
        offset: '0',
        timestamp: '1700000000000',
        key: null,
        value: '{"event":"test"}',
        headers: {},
      },
    ];
    const { runtimeAdapter } = createMockRuntimeAdapter({ consumeRecords: records });

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    const entry = subscriptionStore.get(data.subscription.subscriptionId);
    // consumer.run fires synchronously in mock, but the store entry is
    // registered after run starts, so the ring buffer receives records
    // but the cursor increment guard (store.get) returns undefined.
    // The ring buffer should still have the record.
    expect(entry!.ringBuffer.length).toBe(1);
  });

  it('strips server-only rawValue Buffer before buffering (no leak to client)', async () => {
    const records = [
      {
        topic: 'orders.created',
        partition: 0,
        offset: '0',
        timestamp: '1700000000000',
        key: undefined,
        value: '{"event":"test"}',
        headers: {},
        // Adapter always populates rawValue (raw bytes for schema decode);
        // it must never be stored in the ring buffer nor serialized out.
        rawValue: Buffer.from('{"event":"test"}', 'utf-8'),
      },
    ];
    const { runtimeAdapter } = createMockRuntimeAdapter({ consumeRecords: records });

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    const entry = subscriptionStore.get(data.subscription.subscriptionId);
    expect(entry!.ringBuffer.length).toBe(1);
    const buffered = entry!.ringBuffer[0] as Record<string, unknown>;
    expect('rawValue' in buffered).toBe(false);
    expect(buffered.value).toBe('{"event":"test"}');
  });

  it('includes createdAt timestamp in subscription info', async () => {
    const { runtimeAdapter } = createMockRuntimeAdapter();

    const result = await executeSubscribe(
      runtimeAdapter,
      makeConnection(),
      baseRequest(),
      subscriptionStore,
      onSubscriptionRemoved,
    );

    const data = expectSuccess(result);
    expect(data.subscription.createdAt).toBeTruthy();
    // Should be a valid ISO timestamp
    expect(new Date(data.subscription.createdAt).toISOString()).toBe(
      data.subscription.createdAt,
    );
  });
});
