/**
 * Kafka runner action types — transport action type, assertion targets,
 * action configs, and result metadata.
 *
 * Extracted from index.ts (Phase 8 refactor).
 */

/**
 * Transport action type for runner scenarios and results.
 * `'http'` is the default (backward-compatible fallback when the field is absent).
 */
export type KafkaActionType = 'http' | 'kafkaProduce' | 'kafkaConsume';

/**
 * Kafka message assertion target selector paths.
 * Use with `Assertion` type `'kafkaField'`.
 * - `kafka.body` — the message value / payload
 * - `kafka.key` — the message key
 * - `kafka.partition` — the partition number (as string)
 * - `kafka.offset` — the committed or consumed offset (as string)
 * - `` `kafka.header.<name>` `` — a specific message header by name (e.g. `kafka.header.x-order-id`)
 */
export type KafkaAssertionTarget =
  | 'kafka.body'
  | 'kafka.key'
  | 'kafka.partition'
  | 'kafka.offset'
  | `kafka.header.${string}`;

/** Configuration for a Kafka produce runner action. */
export interface KafkaProduceActionConfig {
  /** Kafka cluster ID to connect to. */
  clusterId: string;
  /** Topic to produce to. Supports `{{variable}}` interpolation. */
  topic: string;
  /** Message key. Supports `{{variable}}` interpolation. */
  key?: string;
  /** Message value / body. Supports `{{variable}}` interpolation. */
  value?: string;
  /** Message headers (values support `{{variable}}` interpolation). */
  headers?: Record<string, string>;
  /** Target partition. Absent = auto-distributed by broker. */
  partition?: number;
  /** Acknowledgement mode: `-1` = all, `0` = none, `1` = leader-only. Default: `-1`. */
  acks?: number;
  /** Produce timeout in ms. Default: `5000`. */
  timeoutMs?: number;
}

/** Configuration for a Kafka consume (receive + assert) runner action. */
export interface KafkaConsumeActionConfig {
  /** Kafka cluster ID to connect to. */
  clusterId: string;
  /** Topic to consume from. Supports `{{variable}}` interpolation. */
  topic: string;
  /** Consumer group ID override. Absent = deterministic group derived from scenario ID. */
  groupId?: string;
  /** Consume from beginning of topic. Default: `false`. */
  fromBeginning?: boolean;
  /** Consume timeout in ms. Default: `10000`. */
  timeoutMs?: number;
  /** Maximum number of messages to consume. Default: `1`. */
  maxMessages?: number;
  /** Optional filter applied before assertion evaluation. */
  filter?: {
    /** Exact key match. */
    keyEquals?: string;
    /** Header key-value exact matches (all must match). */
    headersMatch?: Record<string, string>;
    /** JSONPath expression to select a value in the message body. */
    jsonPath?: string;
    /** Expected value at the JSONPath (exact equality). */
    jsonEquals?: string;
  };
}

/** Metadata captured from an executed Kafka action result. */
export interface KafkaResultMeta {
  /** Topic that was produced to or consumed from. */
  topic: string;
  /** Partition written to or read from. */
  partition: number;
  /**
   * Message offset as a number.
   * Produce: the committed offset of the produced message.
   * Consume: offset of the first matched message.
   */
  offset: number;
  /** Message key (produce: as sent; consume: from matched message). */
  key?: string;
  /** Message headers (produce: as sent; consume: from matched message). */
  headers?: Record<string, string>;
  /** Number of messages matched and consumed (consume actions only). */
  matchedMessages?: number;
}
