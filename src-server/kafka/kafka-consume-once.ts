/**
 * kafka-consume-once.ts
 *
 * Standalone implementation of the one-shot consume-once operation.
 * Extracted from KafkaService to keep kafka-service.ts under the 900-line threshold.
 */

import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaConsumeOnceRequest,
  type KafkaConsumeResult,
  type KafkaConsumeRecord,
  type KafkaConnectionConfig,
  type KafkaRouteEnvelope,
} from './contracts.js';
import type { KafkaRuntimeAdapter } from './kafka-adapter.js';
import { matchesKafkaConsumeFilter, validateKafkaConsumeRequest } from './kafka-service-utils.js';
import {
  decodeValue,
  SchemaRegistryError,
  SCHEMA_ERROR_CODES,
} from './schema-registry-client.js';
import {
  DEFAULT_CLEANUP_TIMEOUT_MS,
  resolveRequestTimeout,
  safeDisconnectConsumer,
  withTimeout,
} from './kafka-service-helpers.js';
import { randomUUID } from 'node:crypto';

export async function executeConsumeOnce(
  runtimeAdapter: KafkaRuntimeAdapter,
  connection: KafkaConnectionConfig,
  request: KafkaConsumeOnceRequest,
): Promise<KafkaRouteEnvelope<KafkaConsumeResult>> {
  const validationError = validateKafkaConsumeRequest(request);
  if (validationError) {
    return createKafkaErrorEnvelope('consume-once', validationError);
  }

  const maxMessages = Math.max(request.maxMessages ?? 1, 1);
  const timeoutMs = Math.max(request.timeoutMs ?? resolveRequestTimeout(connection), 1);
  const groupId = request.groupId ?? `redfireforge-consume-once-${randomUUID().slice(0, 8)}`;
  const consumer = runtimeAdapter.createConsumer(connection, groupId);
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
        // point regardless of any in-flight eachMessage callbacks. If messages
        // already reached maxMessages (i.e. the last message arrived at the
        // exact millisecond the timer fired), treat the result as NOT timed-out.
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
      message: String(error instanceof Error ? error.message : error),
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
