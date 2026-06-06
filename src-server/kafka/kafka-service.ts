import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaConsumeOnceRequest,
  type KafkaConsumeRecord,
  type KafkaConnectionConfig,
  type KafkaConnectResult,
  type KafkaConnectRequest,
  type KafkaDisconnectResult,
  type KafkaDisconnectRequest,
  type KafkaOperation,
  type KafkaProduceRequest,
  type KafkaProduceResult,
  type KafkaRouteEnvelope,
  type KafkaServiceStatus,
  type KafkaStatusRequest,
  type KafkaSubscribeInfo,
  type KafkaSubscribeRequest,
  type KafkaSubscribeResult,
  type KafkaSubscriptionMessagesRequest,
  type KafkaSubscriptionMessagesResult,
  type KafkaSubscriptionsRequest,
  type KafkaSubscriptionsResult,
  type KafkaTopicDetail,
  type KafkaTopicDetailRequest,
  type KafkaTopicsRequest,
  type KafkaTopicsResult,
  type KafkaUnsubscribeRequest,
  type KafkaUnsubscribeResult,
} from './contracts.js';
import { createKafkaRuntimeAdapter, type KafkaAdminAdapter, type KafkaRuntimeAdapter } from './kafka-adapter.js';
import {
  matchesKafkaConsumeFilter,
  validateConnectionConfig,
  validateKafkaProduceRequest,
} from './kafka-service-utils.js';
import {
  encodeValue,
  SchemaRegistryError,
  SCHEMA_ERROR_CODES,
} from './schema-registry-client.js';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_CLEANUP_TIMEOUT_MS,
  isAuthError,
  isTimeoutError,
  resolveConnectTimeout,
  resolveRequestTimeout,
  safeDisconnectProducer,
  safeStopAndDisconnectConsumer,
  toKafkaMessage,
  withTimeout,
} from './kafka-service-helpers.js';
import { toErrorMessage } from '../../src/shared/utils/helpers.js';
import { executeConsumeOnce } from './kafka-consume-once.js';
import { KafkaSubscriptionStore } from './kafka-subscription-store.js';

export interface KafkaServiceSnapshot {
  status: KafkaServiceStatus;
  connection?: KafkaConnectionConfig;
}

export class KafkaService {
  private readonly runtimeAdapter: KafkaRuntimeAdapter;

  private snapshot: KafkaServiceSnapshot = {
    status: {
      state: 'disconnected',
      subscriptionCount: 0,
    },
  };

  private admin: KafkaAdminAdapter | null = null;
  private connectPromise: Promise<KafkaRouteEnvelope<KafkaConnectResult>> | null = null;
  private readonly subscriptionStore = new KafkaSubscriptionStore();

  constructor(runtimeAdapter: KafkaRuntimeAdapter = createKafkaRuntimeAdapter()) {
    this.runtimeAdapter = runtimeAdapter;
  }

  getSnapshot(): KafkaServiceSnapshot {
    return this.snapshot;
  }

  getStatus(_request?: KafkaStatusRequest): KafkaRouteEnvelope<KafkaServiceStatus> {
    return createKafkaSuccessEnvelope('status', this.currentStatus());
  }

  reset(): void {
    this.admin = null;
    this.connectPromise = null;
    this.subscriptionStore.clear();
    this.snapshot = {
      status: {
        state: 'disconnected',
        subscriptionCount: 0,
      },
    };
  }

  async connect(request: KafkaConnectRequest): Promise<KafkaRouteEnvelope<KafkaConnectResult>> {
    if (!request || typeof request !== 'object' || !('connection' in request) || !request.connection) {
      return createKafkaErrorEnvelope('connect', {
        code: 'KAFKA_INVALID_CONNECTION',
        message: 'connection is required',
      });
    }

    const validationError = validateConnectionConfig(request.connection);
    if (validationError) {
      return createKafkaErrorEnvelope('connect', validationError);
    }

    const existingStatus = this.currentStatus();

    if (existingStatus.state === 'connected' && existingStatus.clusterId === request.connection.clusterId) {
      return createKafkaSuccessEnvelope('connect', {
        status: existingStatus,
        reusedExistingConnection: true,
      });
    }

    if (existingStatus.state === 'connecting' && this.connectPromise) {
      if (existingStatus.clusterId === request.connection.clusterId) {
        return this.connectPromise;
      }
      return createKafkaErrorEnvelope('connect', {
        code: 'KAFKA_CONNECT_IN_PROGRESS',
        message: `Connection attempt already in progress for cluster '${existingStatus.clusterId ?? 'unknown'}'`,
        retryable: true,
      });
    }

    if (existingStatus.state === 'connected' && existingStatus.clusterId !== request.connection.clusterId) {
      const disconnected = await this.disconnect({ clusterId: existingStatus.clusterId });
      if (!disconnected.ok) {
        return createKafkaErrorEnvelope('connect', {
          code: 'KAFKA_DISCONNECT_BEFORE_SWITCH_FAILED',
          message: disconnected.error.message,
          retryable: true,
          details: disconnected.error.details,
        });
      }
    }

    this.setSnapshot({
      connection: request.connection,
      status: {
        state: 'connecting',
        clusterId: request.connection.clusterId,
        connectedAt: undefined,
        lastError: undefined,
      },
    });

    const connectStart = Date.now();
    this.connectPromise = this.performConnect(request.connection, connectStart);
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect(request?: KafkaDisconnectRequest): Promise<KafkaRouteEnvelope<KafkaDisconnectResult>> {
    if (!this.admin && !this.connectPromise && this.snapshot.status.state === 'disconnected') {
      const cleanedSubscriptions = await this.subscriptionStore.cleanupAll();
      this.updateSubscriptionCount();
      this.snapshot = {
        status: {
          state: 'disconnected',
          connectedAt: undefined,
          lastError: undefined,
          subscriptionCount: 0,
        },
      };
      return createKafkaSuccessEnvelope('disconnect', {
        status: this.currentStatus(),
        disconnected: true,
        cleanedSubscriptions,
      });
    }

    const currentClusterId = this.snapshot.connection?.clusterId ?? this.snapshot.status.clusterId;

    if (request?.clusterId && currentClusterId && request.clusterId !== currentClusterId) {
      return createKafkaErrorEnvelope('disconnect', {
        code: 'KAFKA_CLUSTER_MISMATCH',
        message: `Disconnect request cluster '${request.clusterId}' does not match active cluster '${currentClusterId}'`,
      });
    }

    const pendingConnect = this.connectPromise;
    if (pendingConnect) {
      await pendingConnect.catch(() => undefined);
    }

    const cleanedSubscriptions = await this.subscriptionStore.cleanupAll();
    this.updateSubscriptionCount();
    const admin = this.admin;
    this.admin = null;

    try {
      if (admin) {
        await withTimeout(admin.disconnect(), resolveRequestTimeout(this.snapshot.connection), 'disconnect');
      }

      this.snapshot = {
        status: {
          state: 'disconnected',
          clusterId: undefined,
          connectedAt: undefined,
          lastError: undefined,
          subscriptionCount: 0,
        },
      };

      return createKafkaSuccessEnvelope('disconnect', {
        status: this.currentStatus(),
        disconnected: true,
        cleanedSubscriptions,
      });
    } catch (error) {
      const message = toKafkaMessage(error);
      this.snapshot = {
        ...this.snapshot,
        status: {
          ...this.currentStatus(),
          state: 'error',
          lastError: message,
        },
      };
      return createKafkaErrorEnvelope('disconnect', {
        code: 'KAFKA_DISCONNECT_FAILED',
        message,
        retryable: true,
      });
    }
  }

  async listTopics(request?: KafkaTopicsRequest): Promise<KafkaRouteEnvelope<KafkaTopicsResult>> {
    const readiness = this.ensureConnected('topics', request?.clusterId);
    if (!readiness.ok) {
      return readiness;
    }

    const includeInternal = request?.includeInternal ?? false;
    try {
      const [topicNames, metadata] = await Promise.all([
        withTimeout(this.admin!.listTopics(), resolveRequestTimeout(this.snapshot.connection), 'topics'),
        withTimeout(this.admin!.fetchTopicMetadata(), resolveRequestTimeout(this.snapshot.connection), 'topics'),
      ]);

      const partitionsByTopic = new Map(metadata.map((topic) => [topic.name, topic.partitions]));
      const topics = topicNames
        .filter((name) => includeInternal || !name.startsWith('__'))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          name,
          partitions: partitionsByTopic.get(name) ?? 0,
          isInternal: name.startsWith('__'),
        }));

      return createKafkaSuccessEnvelope('topics', {
        clusterId: this.snapshot.connection?.clusterId,
        topics,
      });
    } catch (error) {
      return createKafkaErrorEnvelope('topics', {
        code: 'KAFKA_TOPICS_FAILED',
        message: toKafkaMessage(error),
        retryable: true,
      });
    }
  }

  async getTopicDetail(
    topicName: string,
    request: KafkaTopicDetailRequest,
  ): Promise<KafkaRouteEnvelope<KafkaTopicDetail>> {
    const clusterId = this.snapshot.connection?.clusterId;
    if (request.clusterId && clusterId && request.clusterId !== clusterId) {
      return createKafkaErrorEnvelope('topic-detail', {
        code: 'KAFKA_CLUSTER_MISMATCH',
        message: `Request cluster '${request.clusterId}' does not match active cluster '${clusterId}'`,
      });
    }

    if (!this.admin) {
      return createKafkaErrorEnvelope('topic-detail', {
        code: 'KAFKA_NOT_CONNECTED',
        message: 'Not connected to any Kafka cluster',
      });
    }

    try {
      const detail = await withTimeout(
        this.admin.fetchTopicDetail(topicName),
        30_000,
        'topic-detail',
      );
      return createKafkaSuccessEnvelope('topic-detail', detail);
    } catch (error) {
      return createKafkaErrorEnvelope('topic-detail', {
        code: 'KAFKA_TOPIC_DETAIL_FAILED',
        message: toErrorMessage(error) || `Failed to fetch topic detail for '${topicName}'`,
      });
    }
  }

  async produce(request: KafkaProduceRequest): Promise<KafkaRouteEnvelope<KafkaProduceResult>> {
    const bodyErr = KafkaService.requirePlainObject('produce', request, 'KAFKA_INVALID_PRODUCE');
    if (bodyErr) return bodyErr;

    const connResult = this.requireReadyConnection('produce', request.clusterId);
    if (!connResult.ok) return connResult.envelope;

    const validationError = validateKafkaProduceRequest(request);
    if (validationError) {
      return createKafkaErrorEnvelope('produce', validationError);
    }

    const { connection } = connResult;

    const producer = this.runtimeAdapter.createProducer(connection);
    try {
      await withTimeout(producer.connect(), resolveRequestTimeout(connection), 'produce-connect');

      // Phase 10B — Schema encode when schemaConfig is present.
      // When absent, messages are passed through unchanged (no behavioral change).
      let messagesToSend = request.messages;
      let valueEncoding: KafkaProduceResult['valueEncoding'];

      if (request.schemaConfig) {
        // Encode each message value using the registry client.
        // encodeValue() returns a raw Confluent wire-format Buffer.  We assign it
        // directly into KafkaProducerMessage.value (string | Buffer) and KafkaJS
        // sends the bytes verbatim — no base64 encoding.  The consumer reads the
        // same raw bytes via rawValue and passes them to decodeValue().
        const schemaConfig = request.schemaConfig;
        const encodedMessages = await Promise.all(
          request.messages.map(async (msg) => {
            let parsedValue: unknown;
            try {
              parsedValue = JSON.parse(msg.value);
            } catch {
              parsedValue = msg.value;
            }
            const encodedBuffer = await encodeValue(schemaConfig, request.topic, parsedValue);
            // Send raw Confluent wire-format bytes; KafkaJS accepts Buffer values.
            // The consumer's rawValue path reads these bytes directly for decode.
            return { ...msg, value: encodedBuffer };
          }),
        );
        messagesToSend = encodedMessages;
        switch (schemaConfig.format) {
          case 'protobuf':    valueEncoding = 'protobuf';    break;
          case 'json-schema': valueEncoding = 'json-schema'; break;
          default:            valueEncoding = 'avro';        break;
        }
      }

      const records = await withTimeout(
        producer.send({
          topic: request.topic,
          acks: request.acks,
          timeout: request.timeoutMs,
          messages: messagesToSend,
        }),
        resolveRequestTimeout(connection),
        'produce-send',
      );

      return createKafkaSuccessEnvelope('produce', {
        clusterId: connection.clusterId,
        topic: request.topic,
        sentCount: request.messages.length,
        records,
        ...(valueEncoding ? { valueEncoding } : {}),
      });
    } catch (error) {
      // Phase 10B — schema errors surface as dedicated codes, not KAFKA_PRODUCE_FAILED.
      if (error instanceof SchemaRegistryError) {
        return createKafkaErrorEnvelope('produce', {
          code: error.code,
          message: error.message,
          retryable: error.code === SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
        });
      }
      const authFail = isAuthError(error);
      return createKafkaErrorEnvelope('produce', {
        code: authFail ? 'KAFKA_AUTH_FAILED' : 'KAFKA_PRODUCE_FAILED',
        message: toKafkaMessage(error),
        retryable: !authFail,
      });
    } finally {
      await safeDisconnectProducer(producer);
    }
  }

  async consumeOnce(request: KafkaConsumeOnceRequest): Promise<KafkaRouteEnvelope<KafkaConsumeResult>> {
    const bodyErr = KafkaService.requirePlainObject('consume-once', request, 'KAFKA_INVALID_CONSUME_ONCE');
    if (bodyErr) return bodyErr;

    const connResult = this.requireReadyConnection('consume-once', request.clusterId);
    if (!connResult.ok) return connResult.envelope;

    return executeConsumeOnce(this.runtimeAdapter, connResult.connection, request);
  }

  async subscribe(request: KafkaSubscribeRequest): Promise<KafkaRouteEnvelope<KafkaSubscribeResult>> {
    const bodyErr = KafkaService.requirePlainObject('subscribe', request, 'KAFKA_INVALID_SUBSCRIBE');
    if (bodyErr) return bodyErr;

    const connResult = this.requireReadyConnection('subscribe', request.clusterId);
    if (!connResult.ok) return connResult.envelope;

    if (!request.topic?.trim()) {
      return createKafkaErrorEnvelope('subscribe', {
        code: 'KAFKA_INVALID_SUBSCRIBE',
        message: 'topic is required',
      });
    }

    const { connection } = connResult;

    const subscriptionId = randomUUID();
    const groupId = request.groupId ?? `redfireforge-sub-${connection.clusterId}-${subscriptionId.slice(0, 8)}`;
    const consumer = this.runtimeAdapter.createConsumer(connection, groupId);
    const maxInMemoryMessages = Math.max(request.maxInMemoryMessages ?? 100, 1);
    const ringBuffer: KafkaConsumeRecord[] = [];

    try {
      await withTimeout(consumer.connect(), resolveRequestTimeout(connection), 'subscribe-connect');
      await withTimeout(
        consumer.subscribe(request.topic, request.fromBeginning ?? false),
        resolveRequestTimeout(connection),
        'subscribe-subscribe',
      );

      void consumer.run(async (record) => {
        if (!matchesKafkaConsumeFilter(record, request.filter)) {
          return;
        }
        ringBuffer.push(record);
        if (ringBuffer.length > maxInMemoryMessages) {
          ringBuffer.shift();
        }
        const entry = this.subscriptionStore.get(subscriptionId);
        if (entry) {
          entry.cursor++;
        }
      }).catch(async () => {
        this.subscriptionStore.delete(subscriptionId);
        this.updateSubscriptionCount();
        await safeStopAndDisconnectConsumer(consumer);
      });

      const info: KafkaSubscribeInfo = {
        subscriptionId,
        topic: request.topic,
        groupId,
        createdAt: new Date().toISOString(),
      };

      this.subscriptionStore.set(subscriptionId, {
        info,
        cleanup: async () => { await safeStopAndDisconnectConsumer(consumer); },
        ringBuffer,
        maxInMemoryMessages,
        cursor: 0,
      });
      this.updateSubscriptionCount();

      return createKafkaSuccessEnvelope('subscribe', {
        clusterId: connection.clusterId,
        subscription: info,
      });
    } catch (error) {
      await safeStopAndDisconnectConsumer(consumer);
      return createKafkaErrorEnvelope('subscribe', {
        code: 'KAFKA_SUBSCRIBE_FAILED',
        message: toKafkaMessage(error),
        retryable: true,
      });
    }
  }

  registerSubscription(
    params: {
      subscriptionId?: string;
      topic: string;
      groupId?: string;
      createdAt?: string;
    },
    cleanup?: () => Promise<void> | void,
  ): KafkaSubscribeInfo {
    const info = this.subscriptionStore.register(params, this.snapshot.connection?.clusterId, cleanup);
    this.updateSubscriptionCount();
    return info;
  }

  getSubscriptions(request?: KafkaSubscriptionsRequest): KafkaRouteEnvelope<KafkaSubscriptionsResult> {
    return this.subscriptionStore.getSubscriptions(request, this.snapshot.connection);
  }

  getSubscriptionMessages(
    request: KafkaSubscriptionMessagesRequest,
  ): KafkaRouteEnvelope<KafkaSubscriptionMessagesResult> {
    return this.subscriptionStore.getSubscriptionMessages(request, this.snapshot.connection);
  }

  async unsubscribe(request: KafkaUnsubscribeRequest): Promise<KafkaRouteEnvelope<KafkaUnsubscribeResult>> {
    const result = await this.subscriptionStore.unsubscribe(request, this.snapshot.connection);
    this.updateSubscriptionCount();
    return result;
  }

  createNotImplementedEnvelope(op: KafkaOperation): KafkaRouteEnvelope<never> {
    return createKafkaErrorEnvelope(op, {
      code: 'KAFKA_NOT_IMPLEMENTED',
      message: 'Kafka operation is not implemented yet in this phase',
    });
  }

  private async performConnect(
    connection: KafkaConnectionConfig,
    startTs: number,
  ): Promise<KafkaRouteEnvelope<KafkaConnectResult>> {
    const admin = this.runtimeAdapter.createAdmin(connection);
    try {
      await withTimeout(admin.connect(), resolveConnectTimeout(connection), 'connect');
      this.admin = admin;

      this.snapshot = {
        connection,
        status: {
          state: 'connected',
          clusterId: connection.clusterId,
          connectedAt: new Date().toISOString(),
          lastError: undefined,
          subscriptionCount: this.subscriptionStore.size,
        },
      };

      return createKafkaSuccessEnvelope('connect', {
        status: this.currentStatus(),
        reusedExistingConnection: false,
      }, {
        durationMs: Date.now() - startTs,
      });
    } catch (error) {
      const message = toKafkaMessage(error);

      try {
        await withTimeout(admin.disconnect(), DEFAULT_CLEANUP_TIMEOUT_MS, 'connect-cleanup');
      } catch {
        // Ignore disconnect failures while handling connect errors.
      }

      this.snapshot = {
        connection,
        status: {
          state: 'error',
          clusterId: connection.clusterId,
          connectedAt: undefined,
          lastError: message,
          subscriptionCount: this.subscriptionStore.size,
        },
      };

      return createKafkaErrorEnvelope('connect', {
        code: isTimeoutError(error) ? 'KAFKA_CONNECT_TIMEOUT'
          : isAuthError(error) ? 'KAFKA_AUTH_FAILED'
          : 'KAFKA_CONNECT_FAILED',
        message,
        retryable: true,
      }, {
        durationMs: Date.now() - startTs,
      });
    }
  }

  /**
   * Guards that `body` is a non-null, non-array plain object.
   * Returns an error envelope when the check fails, or `null` when valid.
   * Used by produce, consumeOnce, and subscribe to eliminate repeated inline guards.
   */
  private static requirePlainObject(
    op: KafkaOperation,
    body: unknown,
    code: string,
  ): KafkaRouteEnvelope<never> | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return createKafkaErrorEnvelope(op, { code, message: 'request body must be an object' });
    }
    return null;
  }

  /**
   * Combines the `ensureConnected` readiness check with the `snapshot.connection`
   * null-guard that all write operations (produce, consumeOnce, subscribe) share.
   * Returns `{ ok: false, envelope }` when either guard fails, or
   * `{ ok: true, connection }` when the service is ready.
   */
  private requireReadyConnection(
    op: 'produce' | 'consume-once' | 'subscribe',
    clusterId?: string,
  ): { ok: false; envelope: KafkaRouteEnvelope<never> } | { ok: true; connection: KafkaConnectionConfig } {
    const readiness = this.ensureConnected(op, clusterId);
    if (!readiness.ok) {
      return { ok: false, envelope: readiness };
    }
    const connection = this.snapshot.connection;
    if (!connection) {
      return {
        ok: false,
        envelope: createKafkaErrorEnvelope(op, {
          code: 'KAFKA_NOT_CONNECTED',
          message: 'Kafka service is not connected',
        }),
      };
    }
    return { ok: true, connection };
  }

  private currentStatus(): KafkaServiceStatus {
    return {
      ...this.snapshot.status,
      subscriptionCount: this.subscriptionStore.size,
    };
  }

  private setSnapshot(update: Partial<KafkaServiceSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...update,
      status: {
        ...this.snapshot.status,
        ...update.status,
        subscriptionCount: this.subscriptionStore.size,
      },
    };
  }

  private ensureConnected(
    op: 'topics' | 'produce' | 'consume-once' | 'subscribe',
    requestClusterId?: string,
  ): KafkaRouteEnvelope<never> | { ok: true } {
    if (!this.admin || this.snapshot.status.state !== 'connected') {
      return createKafkaErrorEnvelope(op, {
        code: 'KAFKA_NOT_CONNECTED',
        message: 'Kafka service is not connected',
        retryable: false,
      });
    }

    const clusterId = this.snapshot.connection?.clusterId;
    if (requestClusterId && clusterId && requestClusterId !== clusterId) {
      return createKafkaErrorEnvelope(op, {
        code: 'KAFKA_CLUSTER_MISMATCH',
        message: `Request cluster '${requestClusterId}' does not match active cluster '${clusterId}'`,
      });
    }

    return { ok: true };
  }

  private updateSubscriptionCount(): void {
    this.snapshot = {
      ...this.snapshot,
      status: {
        ...this.snapshot.status,
        subscriptionCount: this.subscriptionStore.size,
      },
    };
  }
}

export const kafkaService = new KafkaService();