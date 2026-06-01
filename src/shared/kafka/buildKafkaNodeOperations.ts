/**
 * Factory that creates a KafkaNodeOperations adapter backed by dispatchKafkaOperation.
 *
 * This bridges the generic KafkaNodeOperations interface (used by workflow node handlers)
 * to the concrete Kafka server API (produce / consume-once).
 *
 * Shape mappings:
 *  - produce: wraps single message in the server `messages` array; maps ackMode string
 *    to numeric acks (-1/1/0); extracts first record from the response records array.
 *  - consume: maps startPosition to fromBeginning; maps headerFilters array to
 *    headersMatch Record; maps first jsonPathFilter to server's single jsonPath/jsonEquals
 *    filter fields; NOTE — keyRegex is sent as keyEquals (server does not support regex
 *    key filtering; exact-match approximation only).
 */

import type {
  KafkaNodeOperations,
  KafkaConsumedMessage,
  KafkaProduceResult,
} from '../../features/workflow/engine/graphRunnerNodeHandlerContext';
import { dispatchKafkaOperation } from './kafkaClient';

// ── Inline server response shapes (mirrors src-server/kafka/contracts.ts) ──
// Duplicated here so src/ does not import from src-server/.

interface ServerProduceRecordResult {
  partition: number;
  offset: string;
  timestamp?: string;
}

interface ServerProduceResult {
  topic: string;
  sentCount: number;
  records: ServerProduceRecordResult[];
}

interface ServerConsumeRecord {
  topic: string;
  partition: number;
  offset: string;
  timestamp?: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

interface ServerConsumeResult {
  messageCount: number;
  messages: ServerConsumeRecord[];
}

// ── ackMode → numeric acks ──

function ackModeToAcks(ackMode?: string): number | undefined {
  switch (ackMode) {
    case 'all':    return -1;
    case 'leader': return 1;
    case 'none':   return 0;
    default:       return undefined;
  }
}

// ── Adapter factory ──

/**
 * Build a KafkaNodeOperations instance that uses dispatchKafkaOperation under the hood.
 * Safe to call in both browser and Web Worker contexts (dispatchKafkaOperation is a
 * plain async function with no React dependencies).
 */
export function buildKafkaNodeOperations(): KafkaNodeOperations {
  return {
    async produce(params): Promise<KafkaProduceResult> {
      const envelope = await dispatchKafkaOperation<ServerProduceResult>('produce', {
        clusterId: params.clusterId,
        topic: params.topic,
        messages: [
          {
            key: params.key,
            value: params.value,
            headers: params.headers,
            partition: params.partition,
          },
        ],
        acks: ackModeToAcks(params.ackMode),
        timeoutMs: params.timeoutMs,
      });

      // dispatchKafkaOperation throws KafkaClientError on !ok; if we reach here the
      // envelope is successful.
      const data = envelope.data!;
      const rec = data.records?.[0];

      return {
        topic: data.topic,
        partition: rec?.partition ?? 0,
        offset: rec?.offset ?? '',
        timestamp: rec?.timestamp ?? '',
        key: params.key,
      };
    },

    async consume(params): Promise<KafkaConsumedMessage[]> {
      // Build filter from the handler params
      const keyEquals = params.keyRegex?.trim() || undefined;   // NOTE: treated as exact match
      const validHeaderFilters = params.headerFilters?.filter((f) => f.key?.trim());
      const headersMatch: Record<string, string> | undefined =
        validHeaderFilters && validHeaderFilters.length > 0
          ? Object.fromEntries(validHeaderFilters.map((f) => [f.key, f.value]))
          : undefined;
      const firstJsonPath = params.jsonPathFilters?.[0];
      const jsonPath = firstJsonPath?.jsonPath?.trim() || undefined;
      const jsonEquals = firstJsonPath?.expectedValue?.trim() || undefined;

      const hasFilter = keyEquals || headersMatch || jsonPath;
      const filter = hasFilter
        ? { keyEquals, headersMatch, jsonPath, jsonEquals }
        : undefined;

      const envelope = await dispatchKafkaOperation<ServerConsumeResult>('consume-once', {
        clusterId: params.clusterId,
        topic: params.topic,
        maxMessages: params.maxMessages,
        timeoutMs: params.timeoutMs,
        fromBeginning: params.startPosition === 'earliest',
        ...(filter ? { filter } : {}),
      });

      const data = envelope.data!;
      return (data.messages ?? []).map((m): KafkaConsumedMessage => ({
        topic: m.topic,
        partition: m.partition,
        offset: m.offset,
        timestamp: m.timestamp ?? '',
        key: m.key,
        value: m.value,
        headers: m.headers,
      }));
    },
  };
}
