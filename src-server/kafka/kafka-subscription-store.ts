/**
 * kafka-subscription-store.ts
 *
 * Manages the in-memory subscription registry for KafkaService.
 * Extracted from KafkaService to keep kafka-service.ts under the 900-line threshold.
 */

import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaConsumeRecord,
  type KafkaConnectionConfig,
  type KafkaSubscribeInfo,
  type KafkaSubscriptionsRequest,
  type KafkaSubscriptionsResult,
  type KafkaSubscriptionMessagesRequest,
  type KafkaSubscriptionMessagesResult,
  type KafkaUnsubscribeRequest,
  type KafkaUnsubscribeResult,
  type KafkaRouteEnvelope,
} from './contracts.js';
import { DEFAULT_CLEANUP_TIMEOUT_MS, withTimeout } from './kafka-service-helpers.js';
import { randomUUID } from 'node:crypto';

const SUBSCRIPTION_GROUP_PREFIX = 'redfireforge-sub';

export interface SubscriptionEntry {
  info: KafkaSubscribeInfo;
  cleanup?: () => Promise<void> | void;
  ringBuffer: KafkaConsumeRecord[];
  maxInMemoryMessages: number;
  cursor: number;
}

export class KafkaSubscriptionStore {
  private readonly subscriptions = new Map<string, SubscriptionEntry>();

  get size(): number {
    return this.subscriptions.size;
  }

  clear(): void {
    this.subscriptions.clear();
  }

  get(id: string): SubscriptionEntry | undefined {
    return this.subscriptions.get(id);
  }

  set(id: string, entry: SubscriptionEntry): void {
    this.subscriptions.set(id, entry);
  }

  delete(id: string): void {
    this.subscriptions.delete(id);
  }

  values(): IterableIterator<SubscriptionEntry> {
    return this.subscriptions.values();
  }

  /**
   * Creates a new subscription entry (or updates an existing one, preserving its ring buffer).
   * Returns the canonical KafkaSubscribeInfo for the entry.
   */
  register(
    params: {
      subscriptionId?: string;
      topic: string;
      groupId?: string;
      createdAt?: string;
    },
    clusterId: string | undefined,
    cleanup?: () => Promise<void> | void,
  ): KafkaSubscribeInfo {
    const effectiveClusterId = clusterId ?? 'cluster';
    const subscriptionId = params.subscriptionId ?? randomUUID();
    const info: KafkaSubscribeInfo = {
      subscriptionId,
      topic: params.topic,
      groupId: params.groupId ?? `${SUBSCRIPTION_GROUP_PREFIX}-${effectiveClusterId}-${subscriptionId.slice(0, 8)}`,
      createdAt: params.createdAt ?? new Date().toISOString(),
    };

    const existing = this.subscriptions.get(subscriptionId);
    if (existing?.cleanup) {
      void Promise.resolve(existing.cleanup()).catch(() => undefined);
    }

    this.subscriptions.set(subscriptionId, {
      info,
      cleanup,
      ringBuffer: existing?.ringBuffer ?? [],
      maxInMemoryMessages: existing?.maxInMemoryMessages ?? 100,
      cursor: existing?.cursor ?? 0,
    });

    return info;
  }

  getSubscriptions(
    request: KafkaSubscriptionsRequest | undefined,
    currentConnection: KafkaConnectionConfig | undefined,
  ): KafkaRouteEnvelope<KafkaSubscriptionsResult> {
    const clusterId = currentConnection?.clusterId;
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

  getSubscriptionMessages(
    request: KafkaSubscriptionMessagesRequest,
    currentConnection: KafkaConnectionConfig | undefined,
  ): KafkaRouteEnvelope<KafkaSubscriptionMessagesResult> {
    const clusterId = currentConnection?.clusterId;
    if (request.clusterId && clusterId && request.clusterId !== clusterId) {
      return createKafkaErrorEnvelope('subscription-messages', {
        code: 'KAFKA_CLUSTER_MISMATCH',
        message: `Request cluster '${request.clusterId}' does not match active cluster '${clusterId}'`,
      });
    }

    if (!request.subscriptionId) {
      return createKafkaErrorEnvelope('subscription-messages', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'subscriptionId is required',
      });
    }

    const entry = this.subscriptions.get(request.subscriptionId);
    if (!entry) {
      return createKafkaErrorEnvelope('subscription-messages', {
        code: 'KAFKA_SUBSCRIPTION_NOT_FOUND',
        message: `Subscription '${request.subscriptionId}' does not exist`,
      });
    }

    const sinceCursor = request.sinceCursor ?? 0;
    const bufferStartCursor = entry.cursor - entry.ringBuffer.length;
    const cursorGap = sinceCursor > 0 && sinceCursor < bufferStartCursor;

    let messages: KafkaConsumeRecord[];
    if (sinceCursor <= 0 || sinceCursor <= bufferStartCursor) {
      messages = [...entry.ringBuffer];
    } else {
      const skipCount = sinceCursor - bufferStartCursor;
      messages = entry.ringBuffer.slice(skipCount);
    }

    return createKafkaSuccessEnvelope('subscription-messages', {
      subscriptionId: request.subscriptionId,
      messages,
      cursor: entry.cursor,
      bufferSize: entry.ringBuffer.length,
      maxInMemoryMessages: entry.maxInMemoryMessages,
      cursorGap,
    });
  }

  async unsubscribe(
    request: KafkaUnsubscribeRequest,
    currentConnection: KafkaConnectionConfig | undefined,
  ): Promise<KafkaRouteEnvelope<KafkaUnsubscribeResult>> {
    const clusterId = currentConnection?.clusterId;
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
    } catch {
      // Best-effort cleanup — don't block registry removal on consumer stop timeout
    }

    this.subscriptions.delete(request.subscriptionId);

    return createKafkaSuccessEnvelope('unsubscribe', {
      clusterId,
      subscriptionId: request.subscriptionId,
      unsubscribed: true,
    });
  }

  async cleanupAll(): Promise<number> {
    const entries = [...this.subscriptions.values()];
    this.subscriptions.clear();

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
}
