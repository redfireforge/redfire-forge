/**
 * kafka-produce.ts
 *
 * Standalone implementation of the Kafka produce operation.
 * Extracted from KafkaService to reduce class size and isolate
 * the schema-encoding logic.
 */

import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaConnectionConfig,
  type KafkaProduceRequest,
  type KafkaProduceResult,
  type KafkaRouteEnvelope,
} from './contracts.js';
import type { KafkaRuntimeAdapter } from './kafka-adapter.js';
import { validateKafkaProduceRequest } from './kafka-service-utils.js';
import {
  encodeValue,
  SchemaRegistryError,
  SCHEMA_ERROR_CODES,
} from './schema-registry-client.js';
import {
  isAuthError,
  resolveRequestTimeout,
  safeDisconnectProducer,
  toKafkaMessage,
  withTimeout,
} from './kafka-service-helpers.js';

/**
 * Execute a Kafka produce operation: validate, optionally schema-encode,
 * send messages via a short-lived producer, and return results.
 */
export async function executeProduce(
  runtimeAdapter: KafkaRuntimeAdapter,
  connection: KafkaConnectionConfig,
  request: KafkaProduceRequest,
): Promise<KafkaRouteEnvelope<KafkaProduceResult>> {
  const validationError = validateKafkaProduceRequest(request);
  if (validationError) {
    return createKafkaErrorEnvelope('produce', validationError);
  }

  const producer = runtimeAdapter.createProducer(connection);
  try {
    await withTimeout(producer.connect(), resolveRequestTimeout(connection), 'produce-connect');

    // Phase 10B — Schema encode when schemaConfig is present.
    let messagesToSend = request.messages;
    let valueEncoding: KafkaProduceResult['valueEncoding'];

    if (request.schemaConfig) {
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
