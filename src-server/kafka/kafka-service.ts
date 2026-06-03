import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaConsumeOnceRequest,
  type KafkaConsumeResult,
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
  type KafkaSubscriptionsRequest,
  type KafkaSubscriptionsResult,
  type KafkaTopicsRequest,
  type KafkaTopicsResult,
  type KafkaUnsubscribeRequest,
  type KafkaUnsubscribeResult,
} from './contracts.js';
import { createKafkaRuntimeAdapter, type KafkaAdminAdapter, type KafkaRuntimeAdapter } from './kafka-adapter.js';
import {
  matchesKafkaConsumeFilter,
  validateConnectionConfig,
  validateKafkaConsumeRequest,
  validateKafkaProduceRequest,
} from './kafka-service-utils.js';
import {
  encodeValue,
  decodeValue,
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
  safeDisconnectConsumer,
  safeDisconnectProducer,
  safeStopAndDisconnectConsumer,
  toKafkaMessage,
  withTimeout,
} from './kafka-service-helpers.js';

const SUBSCRIPTION_GROUP_PREFIX = 'redfireforge-sub';

interface SubscriptionEntry {
  info: KafkaSubscribeInfo;
  cleanup?: () => Promise<void> | void;
}

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
  private readonly subscriptions = new Map<string, SubscriptionEntry>();

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
    this.subscriptions.clear();
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
      const cleanedSubscriptions = await this.cleanupAllSubscriptions();
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

    const cleanedSubscriptions = await this.cleanupAllSubscriptions();
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

  async produce(request: KafkaProduceRequest): Promise<KafkaRouteEnvelope<KafkaProduceResult>> {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return createKafkaErrorEnvelope('produce', {
        code: 'KAFKA_INVALID_PRODUCE',
        message: 'request body must be an object',
      });
    }

    const readiness = this.ensureConnected('produce', request.clusterId);
    if (!readiness.ok) {
      return readiness;
    }

    const validationError = validateKafkaProduceRequest(request);
    if (validationError) {
      return createKafkaErrorEnvelope('produce', validationError);
    }

    const connection = this.snapshot.connection;
    if (!connection) {
      return createKafkaErrorEnvelope('produce', {
        code: 'KAFKA_NOT_CONNECTED',
        message: 'Kafka service is not connected',
      });
    }

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
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return createKafkaErrorEnvelope('consume-once', {
        code: 'KAFKA_INVALID_CONSUME_ONCE',
        message: 'request body must be an object',
      });
    }

    const readiness = this.ensureConnected('consume-once', request.clusterId);
    if (!readiness.ok) {
      return readiness;
    }

    const validationError = validateKafkaConsumeRequest(request);
    if (validationError) {
      return createKafkaErrorEnvelope('consume-once', validationError);
    }

    const connection = this.snapshot.connection;
    if (!connection) {
      return createKafkaErrorEnvelope('consume-once', {
        code: 'KAFKA_NOT_CONNECTED',
        message: 'Kafka service is not connected',
      });
    }

    const maxMessages = Math.max(request.maxMessages ?? 1, 1);
    const timeoutMs = Math.max(request.timeoutMs ?? resolveRequestTimeout(connection), 1);
    const groupId = request.groupId ?? `redfireforge-consume-once-${randomUUID().slice(0, 8)}`;
    const consumer = this.runtimeAdapter.createConsumer(connection, groupId);
    const messages: KafkaConsumeRecord[] = [];

    let settle: ((result: KafkaConsumeResult) => Promise<void>) | null = null;
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let stopPromise: Promise<void> | null = null;

    const settleResult = async (result: KafkaConsumeResult): Promise<void> => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (!stopPromise) {
        stopPromise = consumer.stop().catch(() => {
          // Consume-once should remain resilient even when stop fails.
        });
      }
      if (settle) {
        await settle(result);
      }
    };

    try {
      await withTimeout(consumer.connect(), resolveRequestTimeout(connection), 'consume-connect');
      await withTimeout(
        consumer.subscribe(request.topic, request.fromBeginning ?? false),
        resolveRequestTimeout(connection),
        'consume-subscribe',
      );

      const resultPromise = new Promise<KafkaConsumeResult>((resolve, reject) => {
        settle = async (result) => {
          resolve(result);
        };

        timeoutHandle = setTimeout(() => {
          // Snapshot the collected messages so the result is immutable after this
          // point regardless of any in-flight eachMessage callbacks.  If the
          // messages array already reached maxMessages (i.e. the last message
          // arrived at the exact millisecond the timer fired), treat the result as
          // NOT timed-out — we fulfilled the request even if the timer won the race.
          const snapshot = [...messages];
          void settleResult({
            messageCount: snapshot.length,
            messages: snapshot,
            timedOut: snapshot.length < maxMessages,
          }).catch(reject);
        }, timeoutMs);

        void consumer.run(async (record) => {
          if (settled) {
            return;
          }

          if (!matchesKafkaConsumeFilter(record, request.filter)) {
            return;
          }

          // Phase 10B — Schema decode when schemaConfig is present.
          // Uses rawValue (raw Buffer) — not record.value (toString'd string)
          // which corrupts Avro binary bytes.
          // rawValue is always stripped from the client-facing record (server-side only).
          // Subscribe-path schema decode is out of scope for Phase 10B.
          const { rawValue: _rawValue, ...strippedRecord } = record;
          let consumeRecord: KafkaConsumeRecord = strippedRecord;
          if (request.schemaConfig && _rawValue) {
            try {
              const decoded = await decodeValue(request.schemaConfig, _rawValue);
              consumeRecord = {
                topic: record.topic,
                partition: record.partition,
                offset: record.offset,
                timestamp: record.timestamp,
                key: record.key,
                value: JSON.stringify(decoded),
                headers: record.headers,
                // rawValue is server-side only — omit from client-facing record
              };
            } catch (decodeError) {
              // Schema decode errors settle with a dedicated error code rather
              // than silently falling through to KAFKA_CONSUME_ONCE_FAILED.
              if (decodeError instanceof SchemaRegistryError) {
                await settleResult({
                  messageCount: 0,
                  messages: [],
                  timedOut: false,
                  schemaError: {
                    code: decodeError.code,
                    message: decodeError.message,
                  },
                } as KafkaConsumeResult & { schemaError?: { code: string; message: string } });
                return;
              }
              throw decodeError;
            }
          }

          messages.push(consumeRecord);
          if (messages.length >= maxMessages) {
            const snapshot = [...messages];
            await settleResult({
              messageCount: snapshot.length,
              messages: snapshot,
              timedOut: false,
            });
          }
        }).catch((error) => {
          if (!settled) {
            settled = true;
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
            reject(error);
          }
        });
      });

      const result = await resultPromise;
      // Phase 10B — surface schema decode errors via dedicated error codes
      const schemaErr = (result as KafkaConsumeResult & { schemaError?: { code: string; message: string } }).schemaError;
      if (schemaErr) {
        return createKafkaErrorEnvelope('consume-once', {
          code: schemaErr.code,
          message: schemaErr.message,
          retryable: schemaErr.code === SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
        });
      }
      return createKafkaSuccessEnvelope('consume-once', result);
    } catch (error) {
      // Phase 10B — schema errors surface as dedicated codes, not KAFKA_CONSUME_ONCE_FAILED.
      if (error instanceof SchemaRegistryError) {
        return createKafkaErrorEnvelope('consume-once', {
          code: error.code,
          message: error.message,
          retryable: error.code === SCHEMA_ERROR_CODES.REGISTRY_UNREACHABLE,
        });
      }
      return createKafkaErrorEnvelope('consume-once', {
        code: 'KAFKA_CONSUME_ONCE_FAILED',
        message: toKafkaMessage(error),
        retryable: true,
      });
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (stopPromise) {
        try {
          await withTimeout(stopPromise, DEFAULT_CLEANUP_TIMEOUT_MS, 'consume-stop');
        } catch {
          // Slow or stuck stop should not block the consume-once response forever.
        }
      }
      await safeDisconnectConsumer(consumer);
    }
  }

  async subscribe(request: KafkaSubscribeRequest): Promise<KafkaRouteEnvelope<KafkaSubscribeResult>> {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return createKafkaErrorEnvelope('subscribe', {
        code: 'KAFKA_INVALID_SUBSCRIBE',
        message: 'request body must be an object',
      });
    }

    const readiness = this.ensureConnected('subscribe', request.clusterId);
    if (!readiness.ok) {
      return readiness;
    }

    if (!request.topic?.trim()) {
      return createKafkaErrorEnvelope('subscribe', {
        code: 'KAFKA_INVALID_SUBSCRIBE',
        message: 'topic is required',
      });
    }

    const connection = this.snapshot.connection;
    if (!connection) {
      return createKafkaErrorEnvelope('subscribe', {
        code: 'KAFKA_NOT_CONNECTED',
        message: 'Kafka service is not connected',
      });
    }

    const subscriptionId = randomUUID();
    const groupId = request.groupId ?? `${SUBSCRIPTION_GROUP_PREFIX}-${connection.clusterId}-${subscriptionId.slice(0, 8)}`;
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
      }).catch(async () => {
        this.subscriptions.delete(subscriptionId);
        this.updateSubscriptionCount();
        await safeStopAndDisconnectConsumer(consumer);
      });

      const info = this.registerSubscription({
        subscriptionId,
        topic: request.topic,
        groupId,
      }, async () => {
        await safeStopAndDisconnectConsumer(consumer);
      });

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
    const clusterId = this.snapshot.connection?.clusterId ?? 'cluster';
    const subscriptionId = params.subscriptionId ?? randomUUID();
    const info: KafkaSubscribeInfo = {
      subscriptionId,
      topic: params.topic,
      groupId: params.groupId ?? `${SUBSCRIPTION_GROUP_PREFIX}-${clusterId}-${subscriptionId.slice(0, 8)}`,
      createdAt: params.createdAt ?? new Date().toISOString(),
    };

    const existing = this.subscriptions.get(subscriptionId);
    if (existing?.cleanup) {
      void Promise.resolve(existing.cleanup()).catch(() => undefined);
    }

    this.subscriptions.set(subscriptionId, { info, cleanup });
    this.updateSubscriptionCount();
    return info;
  }

  getSubscriptions(request?: KafkaSubscriptionsRequest): KafkaRouteEnvelope<KafkaSubscriptionsResult> {
    const clusterId = this.snapshot.connection?.clusterId;
    if (request?.clusterId && clusterId && request.clusterId !== clusterId) {
      return createKafkaErrorEnvelope('subscriptions', {
        code: 'KAFKA_CLUSTER_MISMATCH',
        message: `Subscriptions request cluster '${request.clusterId}' does not match active cluster '${clusterId}'`,
      });
    }

    return createKafkaSuccessEnvelope('subscriptions', {
      clusterId,
      subscriptions: [...this.subscriptions.values()].map((entry) => entry.info),
    });
  }

  async unsubscribe(request: KafkaUnsubscribeRequest): Promise<KafkaRouteEnvelope<KafkaUnsubscribeResult>> {
    const clusterId = this.snapshot.connection?.clusterId;
    if (request.clusterId && clusterId && request.clusterId !== clusterId) {
      return createKafkaErrorEnvelope('unsubscribe', {
        code: 'KAFKA_CLUSTER_MISMATCH',
        message: `Unsubscribe request cluster '${request.clusterId}' does not match active cluster '${clusterId}'`,
      });
    }

    const existing = this.subscriptions.get(request.subscriptionId);
    if (!existing) {
      return createKafkaErrorEnvelope('unsubscribe', {
        code: 'KAFKA_SUBSCRIPTION_NOT_FOUND',
        message: `Subscription '${request.subscriptionId}' does not exist`,
      });
    }

    try {
      if (existing.cleanup) {
        await withTimeout(Promise.resolve(existing.cleanup()), DEFAULT_CLEANUP_TIMEOUT_MS, 'unsubscribe');
      }

      this.subscriptions.delete(request.subscriptionId);
      this.updateSubscriptionCount();
      return createKafkaSuccessEnvelope('unsubscribe', {
        clusterId,
        subscriptionId: request.subscriptionId,
        unsubscribed: true,
      });
    } catch (error) {
      return createKafkaErrorEnvelope('unsubscribe', {
        code: 'KAFKA_UNSUBSCRIBE_FAILED',
        message: toKafkaMessage(error),
        retryable: true,
      });
    }
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
          subscriptionCount: this.subscriptions.size,
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
          subscriptionCount: this.subscriptions.size,
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

  private currentStatus(): KafkaServiceStatus {
    return {
      ...this.snapshot.status,
      subscriptionCount: this.subscriptions.size,
    };
  }

  private setSnapshot(update: Partial<KafkaServiceSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...update,
      status: {
        ...this.snapshot.status,
        ...update.status,
        subscriptionCount: this.subscriptions.size,
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

  private async cleanupAllSubscriptions(): Promise<number> {
    const entries = [...this.subscriptions.values()];
    this.subscriptions.clear();
    this.updateSubscriptionCount();

    let cleaned = 0;
    for (const entry of entries) {
      cleaned += 1;
      if (!entry.cleanup) {
        continue;
      }
      try {
        await withTimeout(Promise.resolve(entry.cleanup()), DEFAULT_CLEANUP_TIMEOUT_MS, 'disconnect');
      } catch {
        // Keep disconnect resilient: one bad cleanup should not block teardown.
      }
    }

    return cleaned;
  }

  private updateSubscriptionCount(): void {
    this.snapshot = {
      ...this.snapshot,
      status: {
        ...this.snapshot.status,
        subscriptionCount: this.subscriptions.size,
      },
    };
  }
}

export const kafkaService = new KafkaService();