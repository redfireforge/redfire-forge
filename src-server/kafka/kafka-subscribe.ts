/**
 * kafka-subscribe.ts
 *
 * Standalone implementation of the Kafka subscribe operation.
 * Extracted from KafkaService to reduce class size and isolate
 * the consumer lifecycle setup logic.
 */

import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaConnectionConfig,
  type KafkaConsumeRecord,
  type KafkaRouteEnvelope,
  type KafkaSubscribeInfo,
  type KafkaSubscribeRequest,
  type KafkaSubscribeResult,
} from './contracts.js';
import type { KafkaRuntimeAdapter } from './kafka-adapter.js';
import { matchesKafkaConsumeFilter } from './kafka-service-utils.js';
import {
  resolveRequestTimeout,
  safeStopAndDisconnectConsumer,
  toKafkaMessage,
  withTimeout,
} from './kafka-service-helpers.js';
import type { KafkaSubscriptionStore } from './kafka-subscription-store.js';
import { randomUUID } from 'node:crypto';

export interface ExecuteSubscribeResult {
  ok: true;
  info: KafkaSubscribeInfo;
}

/**
 * Execute a Kafka subscribe operation: create a consumer, start running,
 * and register the subscription in the store.
 *
 * On success, the subscription is registered in `subscriptionStore` and
 * the caller should call `updateSubscriptionCount()`.
 */
export async function executeSubscribe(
  runtimeAdapter: KafkaRuntimeAdapter,
  connection: KafkaConnectionConfig,
  request: KafkaSubscribeRequest,
  subscriptionStore: KafkaSubscriptionStore,
  onSubscriptionRemoved: () => void,
): Promise<KafkaRouteEnvelope<KafkaSubscribeResult>> {
  if (!request.topic?.trim()) {
    return createKafkaErrorEnvelope('subscribe', {
      code: 'KAFKA_INVALID_SUBSCRIBE',
      message: 'topic is required',
    });
  }

  const subscriptionId = randomUUID();
  const groupId = request.groupId ?? `redfireforge-sub-${connection.clusterId}-${subscriptionId.slice(0, 8)}`;
  const consumer = runtimeAdapter.createConsumer(connection, groupId);
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
      const entry = subscriptionStore.get(subscriptionId);
      if (entry) {
        entry.cursor++;
      }
    }).catch(async () => {
      subscriptionStore.delete(subscriptionId);
      onSubscriptionRemoved();
      await safeStopAndDisconnectConsumer(consumer);
    });

    const info: KafkaSubscribeInfo = {
      subscriptionId,
      topic: request.topic,
      groupId,
      createdAt: new Date().toISOString(),
    };

    subscriptionStore.set(subscriptionId, {
      info,
      cleanup: async () => { await safeStopAndDisconnectConsumer(consumer); },
      ringBuffer,
      maxInMemoryMessages,
      cursor: 0,
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
