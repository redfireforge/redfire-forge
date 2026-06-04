/**
 * Shared Kafka Studio types — consumed by Phases 1–5.
 * Lives in src/features/kafka/ rather than src/shared/ because these types are
 * UI-layer concepts (drafts, result rows) not shared with the server.
 */

import type { KafkaSchemaConfig } from '../../shared/kafka/kafkaClient';

// ── Header row (Publish panel) ─────────────────────────────────────────────

export interface KafkaHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

// ── Publish draft ──────────────────────────────────────────────────────────

export interface KafkaPublishDraft {
  topic: string;
  key: string;
  /** '' = auto, numeric string = explicit partition number */
  partition: string;
  acks: -1 | 0 | 1;
  timeoutMs: string;
  headers: KafkaHeaderRow[];
  body: string;
  schemaConfig?: KafkaSchemaConfig;
}

// ── Consume draft ──────────────────────────────────────────────────────────

export interface KafkaConsumeDraft {
  topic: string;
  groupId: string;
  startPosition: 'latest' | 'earliest';
  timeoutMs: string;
  maxMessages: string;
  /** Exact key match → server KafkaMessageFilter.keyEquals */
  keyEquals: string;
  /** 'key=value' string → server KafkaMessageFilter.headersMatch: { key: 'value' } */
  headerMatch: string;
  jsonPath: string;
  jsonPathEquals: string;
  schemaConfig?: KafkaSchemaConfig;
}

// ── Result types ───────────────────────────────────────────────────────────

export interface KafkaPublishResult {
  topic: string;
  sentCount: number;
  records: Array<{ partition: number; offset: string; timestamp?: string }>;
  valueEncoding?: string;
}

/** Single row in the Consume results table — mirrors server KafkaConsumeRecord. */
export interface KafkaConsumeResultRow {
  topic: string;
  partition: number;
  offset: string;
  timestamp?: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
}
