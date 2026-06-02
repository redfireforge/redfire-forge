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
import { randomUUID } from 'node:crypto';

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_CLEANUP_TIMEOUT_MS = 2_000;

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
        await this.withTimeout(admin.disconnect(), this.resolveRequestTimeout(this.snapshot.connection), 'disconnect');
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
      const message = this.toMessage(error);
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
        this.withTimeout(this.admin!.listTopics(), this.resolveRequestTimeout(this.snapshot.connection), 'topics'),
        this.withTimeout(this.admin!.fetchTopicMetadata(), this.resolveRequestTimeout(this.snapshot.connection), 'topics'),
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
        message: this.toMessage(error),
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
      await this.withTimeout(producer.connect(), this.resolveRequestTimeout(connection), 'produce-connect');
      const records = await this.withTimeout(
        producer.send({
          topic: request.topic,
          acks: request.acks,
          timeout: request.timeoutMs,
          messages: request.messages,
        }),
        this.resolveRequestTimeout(connection),
        'produce-send',
      );

      return createKafkaSuccessEnvelope('produce', {
        clusterId: connection.clusterId,
        topic: request.topic,
        sentCount: request.messages.length,
        records,
      });
    } catch (error) {
      return createKafkaErrorEnvelope('produce', {
        code: 'KAFKA_PRODUCE_FAILED',
        message: this.toMessage(error),
        retryable: true,
      });
    } finally {
      await this.safeDisconnectProducer(producer);
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
    const timeoutMs = Math.max(request.timeoutMs ?? this.resolveRequestTimeout(connection), 1);
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
      await this.withTimeout(consumer.connect(), this.resolveRequestTimeout(connection), 'consume-connect');
      await this.withTimeout(
        consumer.subscribe(request.topic, request.fromBeginning ?? false),
        this.resolveRequestTimeout(connection),
        'consume-subscribe',
      );

      const resultPromise = new Promise<KafkaConsumeResult>((resolve, reject) => {
        settle = async (result) => {
          resolve(result);
        };

        timeoutHandle = setTimeout(() => {
          void settleResult({
            messageCount: messages.length,
            messages,
            timedOut: true,
          }).catch(reject);
        }, timeoutMs);

        void consumer.run(async (record) => {
          if (settled) {
            return;
          }

          if (!matchesKafkaConsumeFilter(record, request.filter)) {
            return;
          }

          messages.push(record);
          if (messages.length >= maxMessages) {
            await settleResult({
              messageCount: messages.length,
              messages,
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
      return createKafkaSuccessEnvelope('consume-once', result);
    } catch (error) {
      return createKafkaErrorEnvelope('consume-once', {
        code: 'KAFKA_CONSUME_ONCE_FAILED',
        message: this.toMessage(error),
        retryable: true,
      });
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (stopPromise) {
        try {
          await this.withTimeout(stopPromise, DEFAULT_CLEANUP_TIMEOUT_MS, 'consume-stop');
        } catch {
          // Slow or stuck stop should not block the consume-once response forever.
        }
      }
      await this.safeDisconnectConsumer(consumer);
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
      await this.withTimeout(consumer.connect(), this.resolveRequestTimeout(connection), 'subscribe-connect');
      await this.withTimeout(
        consumer.subscribe(request.topic, request.fromBeginning ?? false),
        this.resolveRequestTimeout(connection),
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
        await this.safeStopAndDisconnectConsumer(consumer);
      });

      const info = this.registerSubscription({
        subscriptionId,
        topic: request.topic,
        groupId,
      }, async () => {
        await this.safeStopAndDisconnectConsumer(consumer);
      });

      return createKafkaSuccessEnvelope('subscribe', {
        clusterId: connection.clusterId,
        subscription: info,
      });
    } catch (error) {
      await this.safeStopAndDisconnectConsumer(consumer);
      return createKafkaErrorEnvelope('subscribe', {
        code: 'KAFKA_SUBSCRIBE_FAILED',
        message: this.toMessage(error),
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
        await this.withTimeout(Promise.resolve(existing.cleanup()), DEFAULT_CLEANUP_TIMEOUT_MS, 'unsubscribe');
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
        message: this.toMessage(error),
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
      await this.withTimeout(admin.connect(), this.resolveConnectTimeout(connection), 'connect');
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
      const message = this.toMessage(error);

      try {
        await this.withTimeout(admin.disconnect(), DEFAULT_CLEANUP_TIMEOUT_MS, 'connect-cleanup');
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
        code: this.isTimeoutError(error) ? 'KAFKA_CONNECT_TIMEOUT'
          : this.isAuthError(error) ? 'KAFKA_AUTH_FAILED'
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
        await this.withTimeout(Promise.resolve(entry.cleanup()), DEFAULT_CLEANUP_TIMEOUT_MS, 'disconnect');
      } catch {
        // Keep disconnect resilient: one bad cleanup should not block teardown.
      }
    }

    return cleaned;
  }

  private async safeDisconnectProducer(producer: { disconnect(): Promise<void> }): Promise<void> {
    try {
      await producer.disconnect();
    } catch {
      // Producer disconnect failures are non-fatal cleanup noise.
    }
  }

  private async safeDisconnectConsumer(consumer: { disconnect(): Promise<void> }): Promise<void> {
    try {
      await consumer.disconnect();
    } catch {
      // Consumer disconnect failures are non-fatal cleanup noise.
    }
  }

  private async safeStopAndDisconnectConsumer(consumer: { stop(): Promise<void>; disconnect(): Promise<void> }): Promise<void> {
    try {
      await consumer.stop();
    } catch {
      // Stop failures are non-fatal during cleanup.
    }
    await this.safeDisconnectConsumer(consumer);
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

  private resolveConnectTimeout(connection?: KafkaConnectionConfig): number {
    return Math.max(connection?.connectionTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS, 1);
  }

  private resolveRequestTimeout(connection?: KafkaConnectionConfig): number {
    return Math.max(connection?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, 1);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, op: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Kafka ${op} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private isTimeoutError(error: unknown): boolean {
    const message = this.toMessage(error).toLowerCase();
    return message.includes('timed out') || message.includes('timeout');
  }

  private isAuthError(error: unknown): boolean {
    const message = this.toMessage(error).toLowerCase();
    return (
      message.includes('sasl authentication failed') ||
      message.includes('authentication failed') ||
      message.includes('invalid credentials')
    );
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

export const kafkaService = new KafkaService();