// ── Kafka nodes ─────────────────────────────────────

import type { KafkaSchemaConfig } from '../../../../shared/kafka/kafkaClient';

export type KafkaAckMode = 'all' | 'leader' | 'none';
export type KafkaConsumeStartPosition = 'latest' | 'earliest' | 'committed';
export type KafkaConsumeLoadTestMode = 'wait-for-real' | 'auto-resume' | 'synthetic-inject';

export interface KafkaNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface KafkaNodeMetadataBinding {
  id: string;
  source: 'topic' | 'partition' | 'offset' | 'timestamp' | 'key';
  targetVariable: string;
  enabled: boolean;
}

export interface KafkaConsumeHeaderFilterRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface KafkaConsumeJsonPathFilterRow {
  id: string;
  jsonPath: string;
  expectedValue?: string;
  enabled: boolean;
}

export interface KafkaConsumeLoadTestBehavior {
  mode: KafkaConsumeLoadTestMode;
  mockPayload?: Record<string, unknown>;
  syntheticDelayMs?: number;
  syntheticJitterMs?: number;
}

export interface KafkaProduceNodeData {
  [key: string]: unknown;
  label: string;
  clusterId: string;
  topic: string;
  keyTemplate?: string;
  partition?: number;
  headers?: KafkaNodeHeaderRow[];
  bodyTemplate?: string;
  ackMode?: KafkaAckMode;
  timeoutMs?: number;
  outputBindings?: KafkaNodeMetadataBinding[];
  /** Optional Avro/Protobuf/JSON-Schema registry config for message encoding. */
  schemaConfig?: KafkaSchemaConfig;
}

export interface KafkaConsumeNodeData {
  [key: string]: unknown;
  label: string;
  clusterId: string;
  topic: string;
  keyRegex?: string;
  headerFilters?: KafkaConsumeHeaderFilterRow[];
  jsonPathFilters?: KafkaConsumeJsonPathFilterRow[];
  timeoutMs?: number;
  maxMessages?: number;
  startPosition?: KafkaConsumeStartPosition;
  loadTestBehavior?: KafkaConsumeLoadTestBehavior;
  outputBindings?: KafkaNodeMetadataBinding[];
  /** Optional Avro/Protobuf/JSON-Schema registry config for message decoding. */
  schemaConfig?: KafkaSchemaConfig;
}

// ── Kafka Trigger node ──────────────────────────────

/** Offset policy for KafkaTrigger — default is latest (no replay). */
export type KafkaTriggerOffsetPolicy = 'latest' | 'earliest';

export interface KafkaTriggerNodeData {
  [key: string]: unknown;
  label: string;
  /** Kafka cluster to subscribe to. */
  clusterId: string;
  /** Topic to consume from. */
  topic: string;
  /**
   * Consumer group ID override for this trigger.
   * When omitted, derived as `rf-trigger-<workflowId>-<nodeId>` for deterministic rejoin semantics
   * (re-subscriptions on reconnect rejoin the same group and do not replay already-processed offsets).
   */
  consumerGroupId?: string;
  /**
   * Offset policy. Default: `latest` (do not replay messages delivered before trigger registered).
   * `earliest` is opt-in and replays from the beginning of the topic.
   */
  startPosition?: KafkaTriggerOffsetPolicy;
  /** Optional regex filter on the message key — messages not matching are discarded before dispatch. */
  keyRegex?: string;
  /** Optional header match filters — all enabled filters must pass before workflow dispatch. */
  headerFilters?: KafkaConsumeHeaderFilterRow[];
  /** Optional JSON path filters on the message body — all enabled filters must pass. */
  jsonPathFilters?: KafkaConsumeJsonPathFilterRow[];
  /**
   * Max concurrent workflow runs this trigger may start simultaneously.
   * When the limit is reached, the Kafka consumer is paused until active count drops below threshold.
   * Default: 10.
   */
  maxConcurrentRuns?: number;
  /** Additional variables to extract from the message body into workflow context via JSONPath. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /**
   * Sample Kafka message body for Quick Test.
   * When set, Quick Test uses this as the trigger message instead of dry-running with empty variables.
   * JSON string — same semantics as WebhookTriggerNodeData.samplePayload.
   */
  samplePayload?: string;
  /** Optional sample message key for Quick Test. */
  sampleKey?: string;
  /** Optional sample message headers for Quick Test (JSON object string). */
  sampleHeaders?: string;
  /** Optional description/notes. */
  notes?: string;
}

// ── Kafka Wait node ─────────────────────────────────

/** Source field in a Kafka message from which the correlation ID is extracted. */
export type KafkaWaitCorrelationSource = 'body' | 'header' | 'key';

export interface KafkaWaitNodeData {
  [key: string]: unknown;
  label: string;
  /** Kafka cluster to subscribe to for the wait. */
  clusterId: string;
  /** Topic to consume from while waiting. */
  topic: string;
  /** Expression resolving to correlation ID to match (e.g. "{{orderId}}"). */
  correlationIdExpression: string;
  /**
   * Where in the Kafka message to extract the correlation ID for matching.
   * - `body`: extract via JSON path from message value (use `correlationJsonPath`)
   * - `header`: extract from a message header (use `correlationHeader`)
   * - `key`: use the message key directly as the correlation ID
   */
  correlationSource: KafkaWaitCorrelationSource;
  /** JSONPath to extract correlation ID from message body. Used when `correlationSource` is `'body'`. */
  correlationJsonPath?: string;
  /** Header name to extract correlation ID from. Used when `correlationSource` is `'header'`. */
  correlationHeader?: string;
  /** Additional variables to extract from the matching message body into workflow context via JSONPath. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  /** Timeout in ms (workflow fails if no matching message received before timeout). 0 = unlimited. */
  timeoutMs: number;
  /** Optional regex filter on the message key — only messages matching are considered for correlation. */
  keyRegex?: string;
  /** Optional header match filters applied before correlation matching. */
  headerFilters?: KafkaConsumeHeaderFilterRow[];
  /**
   * Sample Kafka message body for Quick Test.
   * When set, Quick Test uses this as the correlated response message instead of waiting forever.
   * JSON string — same semantics as KafkaTriggerNodeData.samplePayload.
   */
  samplePayload?: string;
  /** Optional sample message key for Quick Test. */
  sampleKey?: string;
  /** Optional sample message headers for Quick Test (JSON object string). */
  sampleHeaders?: string;
  /** Optional description/notes. */
  notes?: string;
  /** How this node behaves during load/performance tests. When omitted, defaults to 'wait-for-real'. */
  loadTestBehavior?: KafkaConsumeLoadTestBehavior;
}

