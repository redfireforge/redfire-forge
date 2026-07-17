/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  expectSuccess,
  expectError,
  createMockRuntimeAdapter,
  makeConnection,
} from './kafka-service.test-utils.js';

describe('kafka-service.test-utils', () => {
  describe('expectSuccess', () => {
    it('returns data when envelope is ok', () => {
      const data = expectSuccess({ ok: true, data: { topic: 'orders' } });
      expect(data).toEqual({ topic: 'orders' });
    });

    it('throws when envelope is an error', () => {
      expect(() => expectSuccess({
        ok: false,
        error: { code: 'KAFKA_FAIL', message: 'boom' },
      })).toThrow('Expected success but got error: KAFKA_FAIL — boom');
    });
  });

  describe('expectError', () => {
    it('returns error when envelope is not ok', () => {
      const err = expectError({
        ok: false,
        error: { code: 'KAFKA_FAIL', message: 'boom' },
      });
      expect(err).toEqual({ code: 'KAFKA_FAIL', message: 'boom' });
    });

    it('throws when envelope is ok', () => {
      expect(() => expectError({ ok: true, data: {} })).toThrow('Expected error but got success');
    });

    it('throws when error code does not match expectedCode', () => {
      expect(() => expectError(
        { ok: false, error: { code: 'OTHER', message: 'x' } },
        'KAFKA_FAIL',
      )).toThrow("Expected error code 'KAFKA_FAIL' but got 'OTHER'");
    });

    it('returns error when expectedCode matches', () => {
      const err = expectError(
        { ok: false, error: { code: 'KAFKA_FAIL', message: 'x' } },
        'KAFKA_FAIL',
      );
      expect(err.code).toBe('KAFKA_FAIL');
    });
  });

  describe('makeConnection', () => {
    it('returns defaults and applies overrides', () => {
      const conn = makeConnection({ clusterId: 'prod', brokers: ['10.0.0.1:9092'] });
      expect(conn.clusterId).toBe('prod');
      expect(conn.brokers).toEqual(['10.0.0.1:9092']);
      expect(conn.clientId).toBe('redfire-test');
    });
  });

  describe('createMockRuntimeAdapter', () => {
    it('creates admin/producer/consumer adapters', () => {
      const { runtimeAdapter, admin, producer, consumer } = createMockRuntimeAdapter();
      expect(runtimeAdapter.createAdmin()).toBe(admin);
      expect(runtimeAdapter.createProducer()).toBe(producer);
      expect(runtimeAdapter.createConsumer()).toBe(consumer);
    });

    it('admin.connect succeeds when no failure flags are set', async () => {
      const { admin } = createMockRuntimeAdapter();
      await expect(admin.connect()).resolves.toBeUndefined();
    });

    it('admin.connect throws when failConnect is set', async () => {
      const { admin } = createMockRuntimeAdapter({ failConnect: true });
      await expect(admin.connect()).rejects.toThrow('connect failed');
    });

    it('admin.connect throws auth error when failAuthConnect is set', async () => {
      const { admin } = createMockRuntimeAdapter({ failAuthConnect: true });
      await expect(admin.connect()).rejects.toThrow('SASL authentication failed');
    });

    it('admin.disconnect throws when failDisconnect is set', async () => {
      const { admin } = createMockRuntimeAdapter({ failDisconnect: true });
      await expect(admin.disconnect()).rejects.toThrow('disconnect failed');
    });

    it('producer.send throws when failProduce is set', async () => {
      const { producer } = createMockRuntimeAdapter({ failProduce: true });
      await expect(producer.send({ topic: 't', messages: [] })).rejects.toThrow('produce failed');
    });

    it('producer.send throws auth error when failProduceAuth is set', async () => {
      const { producer } = createMockRuntimeAdapter({ failProduceAuth: true });
      await expect(producer.send({ topic: 't', messages: [] })).rejects.toThrow('Invalid credentials');
    });

    it('consumer.subscribe throws when failSubscribe is set', async () => {
      const { consumer } = createMockRuntimeAdapter({ failSubscribe: true });
      await expect(consumer.subscribe({ topic: 't' })).rejects.toThrow('subscribe failed');
    });

    it('consumer.run throws when failRun is set', async () => {
      const { consumer } = createMockRuntimeAdapter({ failRun: true });
      await expect(consumer.run(async () => {})).rejects.toThrow('consumer run failed');
    });

    it('consumer.run invokes eachMessage for consumeRecords', async () => {
      const records = [{ topic: 't', partition: 0, offset: '1', key: null, value: Buffer.from('x'), timestamp: '0' }];
      const { consumer } = createMockRuntimeAdapter({ consumeRecords: records });
      const received: unknown[] = [];
      await consumer.run(async (record) => { received.push(record); });
      expect(received).toHaveLength(1);
    });

    it('admin.fetchTopicDetail marks internal topics', async () => {
      const { admin } = createMockRuntimeAdapter();
      const detail = await admin.fetchTopicDetail('__consumer_offsets');
      expect(detail.isInternal).toBe(true);
    });

    it('uses custom state when provided', async () => {
      const { admin } = createMockRuntimeAdapter({
        state: { topics: ['custom'], metadata: [{ name: 'custom', partitions: 1 }] },
      });
      expect(await admin.listTopics()).toEqual(['custom']);
      expect(await admin.fetchTopicMetadata()).toEqual([{ name: 'custom', partitions: 1 }]);
    });

    it('exposes spy wrappers for runtime factory methods', () => {
      const { createAdminSpy, createProducerSpy, createConsumerSpy, runtimeAdapter } = createMockRuntimeAdapter();
      runtimeAdapter.createAdmin();
      runtimeAdapter.createProducer();
      runtimeAdapter.createConsumer();
      expect(createAdminSpy).toHaveBeenCalled();
      expect(createProducerSpy).toHaveBeenCalled();
      expect(createConsumerSpy).toHaveBeenCalled();
    });

    it('supports producer and consumer lifecycle methods', async () => {
      const { producer, consumer } = createMockRuntimeAdapter();
      await producer.connect();
      await producer.disconnect();
      await consumer.connect();
      await consumer.subscribe({ topic: 'orders.created' });
      await consumer.stop();
      await consumer.pause();
      await consumer.resume();
      consumer.seek({ topic: 'orders.created', partition: 0, offset: '0' });
      await consumer.disconnect();
      expect(await producer.send({ topic: 'orders.created', messages: [{ value: Buffer.from('x') }] })).toEqual([
        { partition: 0, offset: '1' },
      ]);
    });

    it('admin.fetchTopicOffsets returns default offsets', async () => {
      const { admin } = createMockRuntimeAdapter();
      expect(await admin.fetchTopicOffsets('orders.created')).toEqual([
        { partition: 0, low: '0', high: '0' },
      ]);
    });

    it('admin.fetchTopicDetail returns non-internal metadata for user topics', async () => {
      const { admin } = createMockRuntimeAdapter();
      const detail = await admin.fetchTopicDetail('orders.created');
      expect(detail.isInternal).toBe(false);
      expect(detail.name).toBe('orders.created');
    });
  });
});
