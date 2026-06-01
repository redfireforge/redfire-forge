/**
 * Shared test utilities for KafkaService unit tests.
 * Imported by kafka-service.core.test.ts, kafka-service.coverage.test.ts,
 * and kafka-service.coverage-gap.test.ts.
 */
import { vi } from 'vitest';
import type {
  KafkaAdminAdapter,
  KafkaConsumerAdapter,
  KafkaConsumerRecord,
  KafkaProducerAdapter,
  KafkaRuntimeAdapter,
  KafkaTopicMetadata,
} from './kafka-adapter.js';
import type { KafkaConnectionConfig } from './contracts.js';

export interface MockAdminState {
  topics: string[];
  metadata: KafkaTopicMetadata[];
}

export function createMockRuntimeAdapter(options?: {
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

export function makeConnection(overrides?: Partial<KafkaConnectionConfig>): KafkaConnectionConfig {
  return {
    clusterId: 'local-dev',
    clientId: 'redfire-test',
    brokers: ['127.0.0.1:9092'],
    connectionTimeoutMs: 200,
    requestTimeoutMs: 200,
    ...overrides,
  };
}
