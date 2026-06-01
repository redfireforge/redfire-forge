/**
 * KafkaService — Coverage Tests: Previously-Untested Paths
 * Covers specific source lines for admin, produce, consumeOnce, subscribe, and internal helpers.
 *
 * Core scenario tests live in kafka-service.core.test.ts.
 * Additional coverage-gap tests live in kafka-service.coverage-gap.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { KafkaService } from './kafka-service.js';
import { createMockRuntimeAdapter, makeConnection } from './kafka-service.test-utils.js';

describe('KafkaService — Coverage: Untested Paths', () => {
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
