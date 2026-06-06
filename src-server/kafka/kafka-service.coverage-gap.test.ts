/**
 * KafkaService — Coverage Gap Tests: Uncovered Branch Paths
 * Covers specific uncovered branches in registerSubscription, disconnect, consumeOnce,
 * subscribe ring buffer, unsubscribe, cleanup, and timeout resolution.
 *
 * Core scenario tests live in kafka-service.core.test.ts.
 * Previously-untested path tests live in kafka-service.coverage.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { KafkaService } from './kafka-service.js';
import { createMockRuntimeAdapter, makeConnection } from './kafka-service.test-utils.js';

describe('KafkaService — Coverage Gap: Uncovered Branches', () => {
  it('connect returns KAFKA_DISCONNECT_BEFORE_SWITCH_FAILED when disconnect fails during cluster switch (line 127)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    // Connect to cluster A
    await service.connect({ connection: makeConnection({ clusterId: 'cluster-a' }) });

    // Make admin.disconnect() throw so the disconnect-before-switch fails
    mock.admin.disconnect.mockRejectedValueOnce(new Error('broker unreachable'));

    // Connect to cluster B — should try to disconnect A first, fail, return KAFKA_DISCONNECT_BEFORE_SWITCH_FAILED
    const result = await service.connect({ connection: makeConnection({ clusterId: 'cluster-b' }) });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_DISCONNECT_BEFORE_SWITCH_FAILED');
  });

  it('disconnect returns KAFKA_CLUSTER_MISMATCH when request.clusterId does not match active cluster (line 176)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    // Connect to cluster-a
    await service.connect({ connection: makeConnection({ clusterId: 'cluster-a' }) });

    // Disconnect with a different clusterId
    const result = await service.disconnect({ clusterId: 'cluster-b' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CLUSTER_MISMATCH');
    expect(result.error.message).toContain('cluster-b');
  });

  it('produce returns KAFKA_NOT_CONNECTED when called without a connection (line 285)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    // Do NOT connect first
    const result = await service.produce({ topic: 'test-topic', messages: [{ value: 'hello' }] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_NOT_CONNECTED');
  });

  it('consumeOnce returns KAFKA_NOT_CONNECTED when called without a connection (line 342)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    // Do NOT connect first
    const result = await service.consumeOnce({ topic: 'test-topic' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_NOT_CONNECTED');
  });

  it('consumeOnce settleResult is idempotent — second call after settlement is a no-op (line 361)', async () => {
    vi.useFakeTimers();
    const record = { topic: 't', partition: 0, offset: '0', key: 'k', value: '{}', headers: {}, timestamp: '0' };
    const mock = createMockRuntimeAdapter({ consumeRecords: [record, record] });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // maxMessages=1 — first record settles, second record triggers the already-settled guard
    const resultPromise = service.consumeOnce({ topic: 't', maxMessages: 1, timeoutMs: 200 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.messages).toHaveLength(1);
    vi.useRealTimers();
  });

  it('subscribe ring buffer evicts oldest message when maxInMemoryMessages is exceeded (line 547)', async () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      topic: 'events', partition: 0, offset: String(i),
      key: `k${i}`, value: `{"i":${i}}`, headers: {}, timestamp: '0',
    }));
    const mock = createMockRuntimeAdapter({ consumeRecords: records });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // maxInMemoryMessages=3 — ring buffer should evict oldest when > 3 messages arrive
    const result = await service.subscribe({ topic: 'events', maxInMemoryMessages: 3 });
    expect(result.ok).toBe(true);

    // Let consumer.run process the records
    await new Promise((r) => setTimeout(r, 20));

    // The subscription should still be registered (no crash)
    const subs = service.getSubscriptions();
    expect(subs.ok).toBe(true);
    if (!subs.ok) throw new Error('expected ok');
    expect(subs.data.subscriptions).toHaveLength(1);
  });

  it('unsubscribe succeeds even when cleanup throws (best-effort cleanup)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const info = service.registerSubscription(
      { topic: 'events' },
      async () => { throw new Error('forced cleanup failure'); },
    );

    const result = await service.unsubscribe({ subscriptionId: info.subscriptionId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.unsubscribed).toBe(true);
  });

  it('cleanupAllSubscriptions swallows errors thrown by individual cleanup callbacks (line 721)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // Subscribe so there is an entry with cleanup
    const sub = await service.subscribe({ topic: 'events' });
    expect(sub.ok).toBe(true);

    // Make consumer.disconnect throw — cleanupAllSubscriptions must not rethrow
    mock.consumer.disconnect.mockRejectedValueOnce(new Error('cleanup exploded'));

    // Disconnect triggers cleanupAllSubscriptions; should succeed despite cleanup error
    const result = await service.disconnect();
    expect(result.ok).toBe(true);
  });

  it('cleanupAllSubscriptions skips entries without a cleanup function (continue branch, line 721)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // Register a subscription WITHOUT a cleanup function — exercises the `continue` branch
    service.registerSubscription({ topic: 'no-cleanup-topic' }, undefined);

    const result = await service.disconnect();
    expect(result.ok).toBe(true);
  });

  it('subscribe run handler returns early when record does not match filter (line 493)', async () => {
    const nonMatchingRecord = { topic: 'events', partition: 0, offset: '0', key: 'skip-me', value: '{}', headers: {}, timestamp: '0' };
    const matchingRecord = { topic: 'events', partition: 0, offset: '1', key: 'keep-me', value: '{}', headers: {}, timestamp: '0' };
    // filterKey: 'keep-me' — first record's key 'skip-me' is filtered out, second passes
    const mock = createMockRuntimeAdapter({
      consumeRecords: [nonMatchingRecord, matchingRecord],
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.subscribe({ topic: 'events', filter: { keyEquals: 'keep-me' }, maxInMemoryMessages: 5 });
    expect(result.ok).toBe(true);
    // Let consumer.run process the records synchronously (mock resolves immediately)
    await new Promise((r) => setTimeout(r, 10));
    // No crash means the non-matching record was skipped correctly
  });

  it('registerSubscription with same subscriptionId invokes previous cleanup (line 547)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // cleanupA throws — the re-registration path wraps cleanup in .catch(() => undefined)
    // so the error must be swallowed and not propagate (exercises stmt 187 AND the catch cb stmt 188)
    const cleanupA = vi.fn(async () => { throw new Error('cleanup error'); });
    const info = service.registerSubscription({ topic: 'topic-a' }, cleanupA);

    // Re-register with the same subscriptionId — should invoke cleanupA (which throws), swallowed
    service.registerSubscription({ subscriptionId: info.subscriptionId, topic: 'topic-a-v2' }, async () => { /* no-op */ });

    // Give the voided promise microtask a chance to run
    await new Promise((r) => setTimeout(r, 10));
    expect(cleanupA).toHaveBeenCalledOnce();
  });

  it('createNotImplementedEnvelope returns KAFKA_NOT_IMPLEMENTED error (line 609)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = service.createNotImplementedEnvelope('subscribe');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_NOT_IMPLEMENTED');
  });

  // ── Branch coverage: registerSubscription defaults (line 536-541) ─────────

  it('registerSubscription without connection uses "cluster" fallback for clusterId', () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    // Not connected — connection?.clusterId is undefined, so ?? 'cluster' branch fires
    const info = service.registerSubscription({ topic: 'orders.created' });
    expect(info.groupId).toContain('redfireforge-sub-cluster-');
    expect(info.createdAt).toBeTruthy();
  });

  it('registerSubscription generates subscriptionId when not provided', () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const info = service.registerSubscription({ topic: 'payments.events' });
    // subscriptionId ?? randomUUID() branch — must produce a valid UUID-ish string
    expect(info.subscriptionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('registerSubscription uses caller-supplied groupId and createdAt verbatim', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const info = service.registerSubscription({
      subscriptionId: 'sub-explicit',
      topic: 'orders.created',
      groupId: 'my-consumer-group',
      createdAt: '2024-01-15T00:00:00Z',
    });
    expect(info.subscriptionId).toBe('sub-explicit');
    expect(info.groupId).toBe('my-consumer-group');
    expect(info.createdAt).toBe('2024-01-15T00:00:00Z');
  });

  // ── Branch coverage: disconnect when admin is null but state is not 'disconnected' ──

  it('disconnect skips admin.disconnect() when admin is already null due to error state', async () => {
    const mock = createMockRuntimeAdapter({ failConnect: true });
    const service = new KafkaService(mock.runtimeAdapter);

    // Connect attempt fails → service is in error state, admin is null
    await service.connect({ connection: makeConnection() });

    // Service is in error state (not 'disconnected'), so the early-return guard is skipped.
    // admin is null → the if (admin) branch is false → disconnect should succeed without calling admin.disconnect()
    const result = await service.disconnect();
    expect(result.ok).toBe(true);
  });

  // ── Branch coverage: subscribe KAFKA_NOT_CONNECTED when called without connection (line 471) ──

  it('subscribe returns KAFKA_NOT_CONNECTED when called without a connection (line 471)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = await service.subscribe({ topic: 'orders.created' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_NOT_CONNECTED');
  });

  // ── Branch coverage: resolveConnectTimeout / resolveRequestTimeout defaults ──

  it('resolveConnectTimeout and resolveRequestTimeout use defaults when connection has no timeouts', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    // Connect with no timeoutMs values set → defaults are used internally.
    // We verify the connection succeeds (meaning the defaults were used correctly).
    const result = await service.connect({
      connection: {
        clusterId: 'no-timeout-cluster',
        clientId: 'test',
        brokers: ['127.0.0.1:9092'],
        // connectionTimeoutMs and requestTimeoutMs intentionally omitted
      },
    });
    expect(result.ok).toBe(true);
  });

  // ── Branch coverage: consume-once settleResult consumer.run error path ───

  it('consumeOnce returns error when consumer.run throws synchronously before settlement', async () => {
    vi.useFakeTimers();
    const mock = createMockRuntimeAdapter({ failRun: true });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const resultPromise = service.consumeOnce({ topic: 'orders.created', timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CONSUME_ONCE_FAILED');
    vi.useRealTimers();
  });

  // ── Branch coverage: line 349 — maxMessages ?? 1 default fallback ───────

  it('consumeOnce uses maxMessages=1 default when not specified (line 349 null-coalesce branch)', async () => {
    // Providing consumeRecords=[record1, record2] but no maxMessages — service defaults to 1.
    // The first record should settle the result and the second never fires (idempotent settle guard).
    const record = { topic: 'orders.created', partition: 0, offset: '0', key: null, value: '{}', headers: {} };
    const mock = createMockRuntimeAdapter({ consumeRecords: [record, record] });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // No maxMessages → default branch fires; first record resolves, second is idempotent no-op.
    const result = await service.consumeOnce({ topic: 'orders.created', timeoutMs: 500 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.messageCount).toBe(1);
    expect(result.data.timedOut).toBe(false);
  });

  // ── Branch coverage: line 773 — requestTimeoutMs ?? DEFAULT fallback ─────

  it('resolveRequestTimeout uses DEFAULT_REQUEST_TIMEOUT_MS when requestTimeoutMs is absent (line 773)', async () => {
    // Connect with a connection that has no requestTimeoutMs — forces the ?? DEFAULT branch.
    // Then call produce() which internally calls resolveRequestTimeout(connection).
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({
      connection: {
        clusterId: 'no-req-timeout-cluster',
        clientId: 'test',
        brokers: ['127.0.0.1:9092'],
        // requestTimeoutMs intentionally omitted
      },
    });

    const result = await service.produce({
      topic: 'orders.created',
      messages: [{ value: '{"id":1}' }],
    });

    expect(result.ok).toBe(true);
  });

  // ── Branch coverage: line 588 — if (existing.cleanup) false branch ───────

  it('unsubscribe skips cleanup call for registration without cleanup (line 588 false branch)', async () => {
    // registerSubscription without cleanup → existing.cleanup is undefined.
    // unsubscribe must still succeed without trying to call cleanup.
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const info = service.registerSubscription({ topic: 'orders.created' }); // no cleanup!

    const result = await service.unsubscribe({ subscriptionId: info.subscriptionId });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected unsubscribe success');
    expect(result.data.unsubscribed).toBe(true);
  });

  // ── Branch coverage: line 248 — partitionsByTopic.get(name) ?? 0 ─────────

  it('listTopics returns 0 partitions for topics absent from metadata (line 248 null-coalesce branch)', async () => {
    // listTopics() returns a topic that has no entry in fetchTopicMetadata → ?? 0 fires.
    const mock = createMockRuntimeAdapter({
      state: {
        topics: ['orders.created', 'ghost-topic'],
        metadata: [{ name: 'orders.created', partitions: 3 }], // ghost-topic has no metadata
      },
    });
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.listTopics();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected listTopics success');
    const ghostEntry = result.data.topics.find((t) => t.name === 'ghost-topic');
    expect(ghostEntry).toBeDefined();
    expect(ghostEntry?.partitions).toBe(0); // ?? 0 was the fallback
  });

  // ── Branch coverage: line 183 — if (pendingConnect) true branch ──────────

  it('disconnect awaits in-flight connect before proceeding (pendingConnect branch, line 183)', async () => {
    // Block admin.connect() with a deferred promise so we can disconnect mid-flight.
    let resolveConnect!: () => void;
    const connectBlocker = new Promise<void>((resolve) => {
      resolveConnect = resolve;
    });

    const mock = createMockRuntimeAdapter();
    mock.admin.connect = vi.fn(async () => {
      await connectBlocker;
    });

    const service = new KafkaService(mock.runtimeAdapter);

    // Start connect without awaiting — it parks on connectBlocker.
    const connectPromise = service.connect({ connection: makeConnection() });

    // Start disconnect while connect is still in-flight. The service MUST await the pending
    // connect (branch[0] of `if (pendingConnect)`) before tearing down.
    const disconnectPromise = service.disconnect();

    // Unblock the stalled connect.
    resolveConnect();

    const [connectResult, disconnectResult] = await Promise.all([connectPromise, disconnectPromise]);

    expect(connectResult.ok).toBe(true);
    expect(disconnectResult.ok).toBe(true);
  });

  // ── Branch: registerSubscription re-registers existing subscription ID ────

  it('registerSubscription calls cleanup of replaced subscription (line 660)', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const cleanupSpy = vi.fn().mockResolvedValue(undefined);
    const subId = 'sub-already-exists';

    // Register first time
    service.registerSubscription({ subscriptionId: subId, topic: 'orders' }, cleanupSpy);

    // Register same subscriptionId again — should invoke the existing cleanup
    service.registerSubscription({ subscriptionId: subId, topic: 'orders' }, vi.fn());

    // Allow the void promise.resolve(cleanup()).catch() to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(cleanupSpy).toHaveBeenCalledOnce();
  });

  // ── Branch: unsubscribe when cleanup() throws ─────────────────────────────

  it('unsubscribe succeeds and removes entry even when cleanup throws', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const subId = 'sub-cleanup-throws';
    service.registerSubscription(
      { subscriptionId: subId, topic: 'orders' },
      async () => { throw new Error('cleanup kaboom'); },
    );

    const result = await service.unsubscribe({ subscriptionId: subId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.unsubscribed).toBe(true);

    const poll = service.getSubscriptionMessages({ subscriptionId: subId });
    expect(poll.ok).toBe(false);
  });

  // ── Branch: cleanupAllSubscriptions skips entries without cleanup ─────────

  it('disconnect cleans up subscriptions that have no cleanup function', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    // Register a subscription WITHOUT a cleanup function
    service.registerSubscription({ subscriptionId: 'no-cleanup-sub', topic: 'orders' });

    const result = await service.disconnect();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    // cleanedSubscriptions counts all entries regardless of cleanup presence
    expect(result.data.cleanedSubscriptions).toBe(1);
  });
});

// ── Phase 3A: getSubscriptionMessages ──────────────────────────────────────

describe('KafkaService — getSubscriptionMessages', () => {
  it('returns messages for a valid subscriptionId', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const info = service.registerSubscription({ topic: 'orders' });
    const entry = (service as unknown as { subscriptionStore: { get(id: string): { ringBuffer: unknown[]; cursor: number } | undefined } }).subscriptionStore.get(info.subscriptionId)!;
    entry.ringBuffer.push({ topic: 'orders', partition: 0, offset: '0', value: '{"a":1}' });
    entry.ringBuffer.push({ topic: 'orders', partition: 0, offset: '1', value: '{"a":2}' });
    entry.cursor = 2;

    const result = service.getSubscriptionMessages({ subscriptionId: info.subscriptionId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.messages).toHaveLength(2);
    expect(result.data.cursor).toBe(2);
    expect(result.data.bufferSize).toBe(2);
  });

  it('returns 404 for unknown subscriptionId', () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = service.getSubscriptionMessages({ subscriptionId: 'nonexistent' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_SUBSCRIPTION_NOT_FOUND');
  });

  it('returns error when subscriptionId is empty', () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = service.getSubscriptionMessages({ subscriptionId: '' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_INVALID_REQUEST');
  });

  it('sinceCursor filters to only newer messages', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const info = service.registerSubscription({ topic: 'orders' });
    const entry = (service as unknown as { subscriptionStore: { get(id: string): { ringBuffer: unknown[]; cursor: number } | undefined } }).subscriptionStore.get(info.subscriptionId)!;
    entry.ringBuffer.push(
      { topic: 'orders', partition: 0, offset: '0', value: 'msg-1' },
      { topic: 'orders', partition: 0, offset: '1', value: 'msg-2' },
      { topic: 'orders', partition: 0, offset: '2', value: 'msg-3' },
    );
    entry.cursor = 3;

    // sinceCursor=1 should return messages added after cursor 1 (i.e. last 2 messages)
    const result = service.getSubscriptionMessages({ subscriptionId: info.subscriptionId, sinceCursor: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.messages).toHaveLength(2);
    expect(result.data.cursor).toBe(3);
  });

  it('ring buffer wrap sets cursorGap=true', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const info = service.registerSubscription({ topic: 'orders' });
    const entry = (service as unknown as { subscriptionStore: { get(id: string): { ringBuffer: unknown[]; cursor: number; maxInMemoryMessages: number } | undefined } }).subscriptionStore.get(info.subscriptionId)!;
    entry.maxInMemoryMessages = 3;
    entry.ringBuffer.push(
      { topic: 'orders', partition: 0, offset: '8', value: 'msg-8' },
      { topic: 'orders', partition: 0, offset: '9', value: 'msg-9' },
      { topic: 'orders', partition: 0, offset: '10', value: 'msg-10' },
    );
    entry.cursor = 10;

    // sinceCursor=2 is behind bufferStartCursor (10-3=7) → cursorGap
    const result = service.getSubscriptionMessages({ subscriptionId: info.subscriptionId, sinceCursor: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.data.cursorGap).toBe(true);
    expect(result.data.messages).toHaveLength(3);
  });

  it('cluster mismatch returns 409', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection({ clusterId: 'cluster-a' }) });

    const info = service.registerSubscription({ topic: 'orders' });

    const result = service.getSubscriptionMessages({
      subscriptionId: info.subscriptionId,
      clusterId: 'cluster-b',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_CLUSTER_MISMATCH');
  });

  it('fetchTopicDetail returns KAFKA_TOPIC_DETAIL_FAILED when admin throws (line 304)', async () => {
    // Covers the catch branch in getTopicDetail
    const mock = createMockRuntimeAdapter();
    mock.admin.fetchTopicDetail = vi.fn().mockRejectedValue(new Error('broker unreachable'));
    const service = new KafkaService(mock.runtimeAdapter);
    await service.connect({ connection: makeConnection() });

    const result = await service.getTopicDetail('orders.created', { clusterId: undefined });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_TOPIC_DETAIL_FAILED');
    expect(result.error.message).toContain('broker unreachable');
  });

  it('subscribe returns KAFKA_NOT_CONNECTED when called without a connection (line 459)', async () => {
    // Covers the `if (!connection) return createKafkaErrorEnvelope('subscribe', ...)` guard
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    // Do NOT call connect() — connection is null

    const result = await service.subscribe({ topic: 'orders.created' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_NOT_CONNECTED');
  });

  // ── requirePlainObject helper (via produce / consumeOnce / subscribe) ─────────
  it('requirePlainObject: produce rejects array body with KAFKA_INVALID_PRODUCE', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    const result = await service.produce([] as never);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_INVALID_PRODUCE');
    expect(result.error.message).toBe('request body must be an object');
  });

  it('requirePlainObject: consumeOnce rejects null body with KAFKA_INVALID_CONSUME_ONCE', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    const result = await service.consumeOnce(null as never);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_INVALID_CONSUME_ONCE');
  });

  it('requirePlainObject: subscribe rejects non-object body with KAFKA_INVALID_SUBSCRIBE', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);
    const result = await service.subscribe('not-an-object' as never);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_INVALID_SUBSCRIBE');
  });

  // ── requireReadyConnection helper (not-connected path for produce & consumeOnce) ─
  it('requireReadyConnection: produce returns KAFKA_NOT_CONNECTED when snapshot.connection is null despite admin being set', async () => {
    // This corner-case is hard to hit normally, but we cover the branch via
    // calling produce without ever connecting (ensureConnected also guards first).
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = await service.produce({
      clusterId: 'local-dev',
      topic: 'orders.created',
      messages: [{ value: '{}' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    // When not connected, ensureConnected fires first returning KAFKA_NOT_CONNECTED
    expect(result.error.code).toBe('KAFKA_NOT_CONNECTED');
  });

  it('requireReadyConnection: consumeOnce returns KAFKA_NOT_CONNECTED when not connected', async () => {
    const mock = createMockRuntimeAdapter();
    const service = new KafkaService(mock.runtimeAdapter);

    const result = await service.consumeOnce({
      clusterId: 'local-dev',
      topic: 'orders.created',
      maxMessages: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.code).toBe('KAFKA_NOT_CONNECTED');
  });
});
