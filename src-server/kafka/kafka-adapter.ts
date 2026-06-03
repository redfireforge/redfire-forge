import { Kafka } from 'kafkajs';
import type { KafkaConfig, SASLOptions } from 'kafkajs';
import type { ConnectionOptions } from 'node:tls';

// Suppress the KafkaJS v2 default-partitioner switch warning — we intentionally
// use the new default partitioner and don't need the migration reminder.
process.env['KAFKAJS_NO_PARTITIONER_WARNING'] = '1';
import type { KafkaConnectionConfig } from './contracts.js';

export interface KafkaTopicMetadata {
  name: string;
  partitions: number;
}

export interface KafkaAdminAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTopics(): Promise<string[]>;
  fetchTopicMetadata(): Promise<KafkaTopicMetadata[]>;
}

export interface KafkaProducerMessage {
  key?: string;
  value: string;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: string;
}

export interface KafkaProducerResult {
  partition: number;
  offset: string;
  timestamp?: string;
}

export interface KafkaProducerAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(payload: {
    topic: string;
    acks?: number;
    timeout?: number;
    messages: KafkaProducerMessage[];
  }): Promise<KafkaProducerResult[]>;
}

export interface KafkaConsumerRecord {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

export interface KafkaConsumerAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(topic: string, fromBeginning?: boolean): Promise<void>;
  run(eachMessage: (record: KafkaConsumerRecord) => Promise<void> | void): Promise<void>;
  stop(): Promise<void>;
  pause(topicPartitions: Array<{ topic: string; partitions?: number[] }>): void;
  resume(topicPartitions: Array<{ topic: string; partitions?: number[] }>): void;
}

export interface KafkaRuntimeAdapter {
  createAdmin(connection: KafkaConnectionConfig): KafkaAdminAdapter;
  createProducer(connection: KafkaConnectionConfig): KafkaProducerAdapter;
  createConsumer(connection: KafkaConnectionConfig, groupId: string): KafkaConsumerAdapter;
}

function toSasl(config: KafkaConnectionConfig): SASLOptions | undefined {
  const auth = config.auth;
  if (!auth || auth.mode === 'none') {
    return undefined;
  }

  const username = auth.username ?? '';
  const password = auth.password ?? '';

  if (auth.mode === 'plain') {
    return {
      mechanism: 'plain',
      username,
      password,
    };
  }

  if (auth.mode === 'scram-sha-256') {
    return {
      mechanism: 'scram-sha-256',
      username,
      password,
    };
  }

  return {
    mechanism: 'scram-sha-512',
    username,
    password,
  };
}

function toSsl(config: KafkaConnectionConfig): ConnectionOptions | undefined {
  const tls = config.tls;
  if (!tls?.enabled) {
    return undefined;
  }

  const ssl: ConnectionOptions = {
    rejectUnauthorized: tls.rejectUnauthorized ?? true,
  };

  if (tls.serverName) {
    ssl.servername = tls.serverName;
  }
  if (tls.caPem) {
    ssl.ca = [tls.caPem];
  }
  if (tls.certPem) {
    ssl.cert = tls.certPem;
  }
  if (tls.keyPem) {
    ssl.key = tls.keyPem;
  }
  if (tls.passphrase) {
    ssl.passphrase = tls.passphrase;
  }

  return ssl;
}

function toKafkaConfig(connection: KafkaConnectionConfig): KafkaConfig {
  return {
    clientId: connection.clientId,
    brokers: connection.brokers,
    connectionTimeout: connection.connectionTimeoutMs,
    requestTimeout: connection.requestTimeoutMs,
    ssl: toSsl(connection),
    sasl: toSasl(connection),
  };
}

class KafkaJsAdminAdapter implements KafkaAdminAdapter {
  constructor(private readonly admin: ReturnType<Kafka['admin']>) {}

  async connect(): Promise<void> {
    await this.admin.connect();
  }

  async disconnect(): Promise<void> {
    await this.admin.disconnect();
  }

  async listTopics(): Promise<string[]> {
    return this.admin.listTopics();
  }

  async fetchTopicMetadata(): Promise<KafkaTopicMetadata[]> {
    const metadata = await this.admin.fetchTopicMetadata();
    return metadata.topics.map((topic) => ({
      name: topic.name,
      partitions: topic.partitions.length,
    }));
  }
}

class KafkaJsProducerAdapter implements KafkaProducerAdapter {
  constructor(private readonly producer: ReturnType<Kafka['producer']>) {}

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async send(payload: {
    topic: string;
    acks?: number;
    timeout?: number;
    messages: KafkaProducerMessage[];
  }): Promise<KafkaProducerResult[]> {
    const result = await this.producer.send({
      topic: payload.topic,
      acks: payload.acks,
      timeout: payload.timeout,
      messages: payload.messages.map((message) => ({
        key: message.key,
        value: message.value,
        headers: message.headers,
        partition: message.partition,
        timestamp: message.timestamp,
      })),
    });

    return result.map((record) => ({
      partition: record.partition,
      offset: record.baseOffset,
      timestamp: record.logAppendTime,
    }));
  }
}

class KafkaJsConsumerAdapter implements KafkaConsumerAdapter {
  constructor(private readonly consumer: ReturnType<Kafka['consumer']>) {}

  async connect(): Promise<void> {
    await this.consumer.connect();
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  async subscribe(topic: string, fromBeginning = false): Promise<void> {
    await this.consumer.subscribe({ topic, fromBeginning });
  }

  async run(eachMessage: (record: KafkaConsumerRecord) => Promise<void> | void): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const headers: Record<string, string> = {};
        if (message.headers) {
          for (const [key, value] of Object.entries(message.headers)) {
            if (value == null) {
              continue;
            }
            headers[key] = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
          }
        }

        const key = message.key ? message.key.toString('utf8') : undefined;
        const value = message.value ? message.value.toString('utf8') : '';
        await eachMessage({
          topic,
          partition,
          offset: message.offset,
          timestamp: message.timestamp,
          key,
          value,
          headers,
        });
      },
    });
  }

  async stop(): Promise<void> {
    await this.consumer.stop();
  }

  pause(topicPartitions: Array<{ topic: string; partitions?: number[] }>): void {
    this.consumer.pause(topicPartitions);
  }

  resume(topicPartitions: Array<{ topic: string; partitions?: number[] }>): void {
    this.consumer.resume(topicPartitions);
  }
}

export class KafkaJsRuntimeAdapter implements KafkaRuntimeAdapter {
  createAdmin(connection: KafkaConnectionConfig): KafkaAdminAdapter {
    const kafka = new Kafka(toKafkaConfig(connection));
    return new KafkaJsAdminAdapter(kafka.admin());
  }

  createProducer(connection: KafkaConnectionConfig): KafkaProducerAdapter {
    const kafka = new Kafka(toKafkaConfig(connection));
    return new KafkaJsProducerAdapter(kafka.producer());
  }

  createConsumer(connection: KafkaConnectionConfig, groupId: string): KafkaConsumerAdapter {
    const kafka = new Kafka(toKafkaConfig(connection));
    return new KafkaJsConsumerAdapter(kafka.consumer({ groupId }));
  }
}

export function createKafkaRuntimeAdapter(): KafkaRuntimeAdapter {
  return new KafkaJsRuntimeAdapter();
}