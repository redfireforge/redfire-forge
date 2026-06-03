import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KafkaConnectionConfig } from './contracts.js';

const mocks = vi.hoisted(() => {
  let consumerMessage = {
    offset: '9',
    timestamp: '1712345678000',
    key: Buffer.from('customer-123'),
    value: Buffer.from('{"status":"created"}'),
    headers: {
      traceId: Buffer.from('trace-1'),
      source: 'seed',
      ignored: null,
    },
  };

  const admin = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    listTopics: vi.fn(async () => ['orders.created', 'payments.authorized']),
    fetchTopicMetadata: vi.fn(async () => ({
      topics: [
        { name: 'orders.created', partitions: [{}, {}, {}] },
        { name: 'payments.authorized', partitions: [{}] },
      ],
    })),
  };

  const producer = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    send: vi.fn(async () => [
      { partition: 2, baseOffset: '42', logAppendTime: '1712345678901' },
    ]),
  };

  const consumer = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    subscribe: vi.fn(async () => undefined),
    run: vi.fn(async ({ eachMessage }: { eachMessage: (payload: unknown) => Promise<void> }) => {
      await eachMessage({
        topic: 'orders.created',
        partition: 1,
        message: consumerMessage,
      });
    }),
    stop: vi.fn(async () => undefined),
    pause: vi.fn(() => undefined),
    resume: vi.fn(() => undefined),
  };

  function KafkaMock(this: unknown) {
    return {
      admin: () => admin,
      producer: () => producer,
      consumer: vi.fn(() => consumer),
    };
  }

  return {
    admin,
    producer,
    consumer,
    getConsumerMessage: () => consumerMessage,
    setConsumerMessage: (value: typeof consumerMessage) => {
      consumerMessage = value;
    },
    kafkaCtor: vi.fn(KafkaMock),
  };
});

vi.mock('kafkajs', () => ({
  Kafka: mocks.kafkaCtor,
}));

import { createKafkaRuntimeAdapter } from './kafka-adapter.js';

function makeConnection(overrides: Partial<KafkaConnectionConfig> = {}): KafkaConnectionConfig {
  return {
    clusterId: 'local-dev',
    clientId: 'redfireforge-local',
    brokers: ['127.0.0.1:19092'],
    connectionTimeoutMs: 5000,
    requestTimeoutMs: 7000,
    auth: { mode: 'none' },
    tls: { enabled: false, rejectUnauthorized: true },
    ...overrides,
  };
}

describe('kafka-adapter', () => {
  beforeEach(() => {
    mocks.setConsumerMessage({
      offset: '9',
      timestamp: '1712345678000',
      key: Buffer.from('customer-123'),
      value: Buffer.from('{"status":"created"}'),
      headers: {
        traceId: Buffer.from('trace-1'),
        source: 'seed',
        ignored: null,
      },
    });
    mocks.kafkaCtor.mockClear();
    mocks.admin.connect.mockClear();
    mocks.admin.disconnect.mockClear();
    mocks.admin.listTopics.mockClear();
    mocks.admin.fetchTopicMetadata.mockClear();
    mocks.producer.connect.mockClear();
    mocks.producer.disconnect.mockClear();
    mocks.producer.send.mockClear();
    mocks.consumer.connect.mockClear();
    mocks.consumer.disconnect.mockClear();
    mocks.consumer.subscribe.mockClear();
    mocks.consumer.run.mockClear();
    mocks.consumer.stop.mockClear();
    mocks.consumer.pause.mockClear();
    mocks.consumer.resume.mockClear();
  });

  it('creates Kafka clients with mapped plaintext, sasl, and tls config', () => {
    const runtime = createKafkaRuntimeAdapter();
    const connection = makeConnection({
      auth: {
        mode: 'scram-sha-512',
        username: 'svc-user',
        password: 'svc-pass',
      },
      tls: {
        enabled: true,
        rejectUnauthorized: false,
        serverName: 'kafka.local',
        caPem: 'ca-pem',
        certPem: 'cert-pem',
        keyPem: 'key-pem',
        passphrase: 'secret',
      },
    });

    runtime.createAdmin(connection);
    runtime.createProducer(connection);
    runtime.createConsumer(connection, 'group-1');

    expect(mocks.kafkaCtor).toHaveBeenCalledTimes(3);
    expect(mocks.kafkaCtor).toHaveBeenNthCalledWith(1, {
      clientId: 'redfireforge-local',
      brokers: ['127.0.0.1:19092'],
      connectionTimeout: 5000,
      requestTimeout: 7000,
      ssl: {
        rejectUnauthorized: false,
        servername: 'kafka.local',
        ca: ['ca-pem'],
        cert: 'cert-pem',
        key: 'key-pem',
        passphrase: 'secret',
      },
      sasl: {
        mechanism: 'scram-sha-512',
        username: 'svc-user',
        password: 'svc-pass',
      },
    });
  });

  it('maps disabled tls and scram-sha-256 auth without optional certificates', () => {
    const runtime = createKafkaRuntimeAdapter();
    const connection = makeConnection({
      auth: {
        mode: 'scram-sha-256',
        username: 'svc-user',
        password: 'svc-pass',
      },
      tls: {
        enabled: false,
        rejectUnauthorized: true,
      },
    });

    runtime.createAdmin(connection);

    expect(mocks.kafkaCtor).toHaveBeenCalledWith({
      clientId: 'redfireforge-local',
      brokers: ['127.0.0.1:19092'],
      connectionTimeout: 5000,
      requestTimeout: 7000,
      ssl: undefined,
      sasl: {
        mechanism: 'scram-sha-256',
        username: 'svc-user',
        password: 'svc-pass',
      },
    });
  });

  it('omits sasl config when auth mode is none', () => {
    const runtime = createKafkaRuntimeAdapter();

    runtime.createProducer(makeConnection({ auth: { mode: 'none' } }));

    expect(mocks.kafkaCtor).toHaveBeenCalledWith(expect.objectContaining({
      ssl: undefined,
      sasl: undefined,
    }));
  });

  it('defaults missing auth credentials to empty strings and tls rejectUnauthorized to true', () => {
    const runtime = createKafkaRuntimeAdapter();

    runtime.createAdmin(makeConnection({
      auth: { mode: 'plain' },
      tls: { enabled: true },
    }));

    expect(mocks.kafkaCtor).toHaveBeenCalledWith(expect.objectContaining({
      ssl: { rejectUnauthorized: true },
      sasl: {
        mechanism: 'plain',
        username: '',
        password: '',
      },
    }));
  });

  it('admin adapter proxies methods and maps topic partition counts', async () => {
    const runtime = createKafkaRuntimeAdapter();
    const admin = runtime.createAdmin(makeConnection());

    await admin.connect();
    const topics = await admin.listTopics();
    const metadata = await admin.fetchTopicMetadata();
    await admin.disconnect();

    expect(topics).toEqual(['orders.created', 'payments.authorized']);
    expect(metadata).toEqual([
      { name: 'orders.created', partitions: 3 },
      { name: 'payments.authorized', partitions: 1 },
    ]);
    expect(mocks.admin.connect).toHaveBeenCalledTimes(1);
    expect(mocks.admin.disconnect).toHaveBeenCalledTimes(1);
  });

  it('producer adapter maps outbound payload and broker response metadata', async () => {
    const runtime = createKafkaRuntimeAdapter();
    const producer = runtime.createProducer(makeConnection({ auth: { mode: 'plain', username: 'user', password: 'pass' } }));

    await producer.connect();
    const records = await producer.send({
      topic: 'orders.created',
      acks: -1,
      timeout: 1200,
      messages: [{
        key: 'customer-123',
        value: '{"status":"created"}',
        headers: { traceId: 'trace-1' },
        partition: 1,
        timestamp: '1712345678000',
      }],
    });
    await producer.disconnect();

    expect(mocks.producer.send).toHaveBeenCalledWith({
      topic: 'orders.created',
      acks: -1,
      timeout: 1200,
      messages: [{
        key: 'customer-123',
        value: '{"status":"created"}',
        headers: { traceId: 'trace-1' },
        partition: 1,
        timestamp: '1712345678000',
      }],
    });
    expect(records).toEqual([{ partition: 2, offset: '42', timestamp: '1712345678901' }]);
  });

  it('consumer adapter maps subscribe/run/stop and normalizes record buffers', async () => {
    const runtime = createKafkaRuntimeAdapter();
    const consumer = runtime.createConsumer(makeConnection(), 'group-42');
    const eachMessage = vi.fn(async () => undefined);

    await consumer.connect();
    await consumer.subscribe('orders.created');
    await consumer.run(eachMessage);
    await consumer.stop();
    await consumer.disconnect();

    expect(mocks.consumer.subscribe).toHaveBeenCalledWith({ topic: 'orders.created', fromBeginning: false });
    expect(eachMessage).toHaveBeenCalledWith({
      topic: 'orders.created',
      partition: 1,
      offset: '9',
      timestamp: '1712345678000',
      key: 'customer-123',
      value: '{"status":"created"}',
      headers: {
        traceId: 'trace-1',
        source: 'seed',
      },
    });
    expect(mocks.consumer.stop).toHaveBeenCalledTimes(1);
    expect(mocks.consumer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('consumer adapter delegates pause to the underlying kafkajs consumer', () => {
    const runtime = createKafkaRuntimeAdapter();
    const consumer = runtime.createConsumer(makeConnection(), 'group-pause');
    consumer.pause([{ topic: 'orders.created' }, { topic: 'payments.authorized', partitions: [0, 1] }]);
    expect(mocks.consumer.pause).toHaveBeenCalledWith([
      { topic: 'orders.created' },
      { topic: 'payments.authorized', partitions: [0, 1] },
    ]);
  });

  it('consumer adapter delegates resume to the underlying kafkajs consumer', () => {
    const runtime = createKafkaRuntimeAdapter();
    const consumer = runtime.createConsumer(makeConnection(), 'group-resume');
    consumer.resume([{ topic: 'orders.created' }]);
    expect(mocks.consumer.resume).toHaveBeenCalledWith([{ topic: 'orders.created' }]);
  });

  it('consumer adapter handles records without headers, key, or value', async () => {
    const runtime = createKafkaRuntimeAdapter();
    const consumer = runtime.createConsumer(makeConnection(), 'group-42');
    const eachMessage = vi.fn(async () => undefined);

    mocks.setConsumerMessage({
      offset: '11',
      timestamp: '0',
      key: null,
      value: null,
      headers: undefined,
    });

    await consumer.run(eachMessage);

    expect(eachMessage).toHaveBeenCalledWith({
      topic: 'orders.created',
      partition: 1,
      offset: '11',
      timestamp: '0',
      key: undefined,
      value: '',
      headers: {},
    });
  });
});