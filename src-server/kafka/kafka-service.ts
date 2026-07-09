import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaConsumeOnceRequest,
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
  checkClusterMismatch,
  validateConnectionConfig,
} from './kafka-service-utils.js';
import { executeProduce } from './kafka-produce.js';
import { executeSubscribe } from './kafka-subscribe.js';
import {
  DEFAULT_CLEANUP_TIMEOUT_MS,
  isAuthError,
  isTimeoutError,
  requireKafkaPlainObject,
  resolveConnectTimeout,
  resolveRequestTimeout,
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

    const mismatch = checkClusterMismatch('disconnect', request?.clusterId, currentClusterId);
    if (mismatch) return mismatch;

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
    const mismatch = checkClusterMismatch('topic-detail', request.clusterId, clusterId);
    if (mismatch) return mismatch;

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
    const bodyErr = requireKafkaPlainObject('produce', request, 'KAFKA_INVALID_PRODUCE');
    if (bodyErr) return bodyErr;

    const connResult = this.requireReadyConnection('produce', request.clusterId);
    if (!connResult.ok) return connResult.envelope;

    return executeProduce(this.runtimeAdapter, connResult.connection, request);
  }

  async consumeOnce(request: KafkaConsumeOnceRequest): Promise<KafkaRouteEnvelope<KafkaConsumeResult>> {
    const bodyErr = requireKafkaPlainObject('consume-once', request, 'KAFKA_INVALID_CONSUME_ONCE');
    if (bodyErr) return bodyErr;

    const connResult = this.requireReadyConnection('consume-once', request.clusterId);
    if (!connResult.ok) return connResult.envelope;

    return executeConsumeOnce(this.runtimeAdapter, connResult.connection, request);
  }

  async subscribe(request: KafkaSubscribeRequest): Promise<KafkaRouteEnvelope<KafkaSubscribeResult>> {
    const bodyErr = requireKafkaPlainObject('subscribe', request, 'KAFKA_INVALID_SUBSCRIBE');
    if (bodyErr) return bodyErr;

    const connResult = this.requireReadyConnection('subscribe', request.clusterId);
    if (!connResult.ok) return connResult.envelope;

    const result = await executeSubscribe(
      this.runtimeAdapter,
      connResult.connection,
      request,
      this.subscriptionStore,
      () => this.updateSubscriptionCount(),
    );
    this.updateSubscriptionCount();
    return result;
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
    const mismatch = checkClusterMismatch(op, requestClusterId, clusterId);
    if (mismatch) return mismatch;

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