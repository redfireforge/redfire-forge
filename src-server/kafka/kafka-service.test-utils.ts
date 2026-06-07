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
import type { KafkaConnectionConfig, KafkaRouteEnvelope } from './contracts.js';

// ── Assertion helpers ─────────────────────────────────────────────────────

/**
 * Asserts a KafkaRouteEnvelope is a success and returns the data payload.
 */
export function expectSuccess<T>(envelope: KafkaRouteEnvelope<T>): T {
  if (!envelope.ok) {
    throw new Error(`Expected success but got error: ${envelope.error.code} — ${envelope.error.message}`);
  }
  return envelope.data;
}

/**
 * Asserts a KafkaRouteEnvelope is an error and returns the error details.
 * Optionally checks the error code matches `expectedCode`.
 */
export function expectError(
  envelope: KafkaRouteEnvelope<unknown>,
  expectedCode?: string,
): { code: string; message: string } {
  if (envelope.ok) {
    throw new Error(`Expected error${expectedCode ? ` (${expectedCode})` : ''} but got success`);
  }
  if (expectedCode && envelope.error.code !== expectedCode) {
    throw new Error(`Expected error code '${expectedCode}' but got '${envelope.error.code}'`);
  }
  return envelope.error;
}

export interface MockAdminState {
  topics: string[];
  metadata: KafkaTopicMetadata[];
}

export function createMockRuntimeAdapter(options?: {
  failConnect?: boolean;
  failAuthConnect?: boolean;
  failDisconnect?: boolean;
  failProduce?: boolean;
  failProduceAuth?: boolean;
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
      if (options?.failAuthConnect) {
        throw new Error('SASL authentication failed: security: Invalid credentials');
      }
    }),
    disconnect: vi.fn(async () => {
      if (options?.failDisconnect) {
        throw new Error('disconnect failed');
      }
    }),
    listTopics: vi.fn(async () => state.topics),
    fetchTopicMetadata: vi.fn(async () => state.metadata),
    fetchTopicDetail: vi.fn(async (topicName: string) => ({
      name: topicName,
      partitionCount: 0,
      replicationFactor: 0,
      isInternal: topicName.startsWith('__'),
      partitions: [],
      consumerGroups: [],
      config: {},
      healthStatus: 'unknown' as const,
    })),
    fetchTopicOffsets: vi.fn(async () => [
      { partition: 0, low: '0', high: '0' },
    ]),
  };

  const producer: KafkaProducerAdapter = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    send: vi.fn(async () => {
      if (options?.failProduce) {
        throw new Error('produce failed');
      }
      if (options?.failProduceAuth) {
        throw new Error('SASL authentication failed: Invalid credentials');
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
    pause: vi.fn(() => undefined),
    resume: vi.fn(() => undefined),
    seek: vi.fn(() => undefined),
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
