/**
 * Phase 5A — Kafka Trigger/Wait contracts.
 *
 * Runtime utilities and constants for the KafkaTrigger and KafkaWait node types.
 * These are separate from the type definitions in workflow.ts to keep that file
 * as a pure types/interfaces file.
 */

import type { KafkaTriggerNodeData, KafkaWaitNodeData } from '../types/workflow';

// ── Consumer group ID derivation ─────────────────────────────────────────────

/**
 * Derive a deterministic Kafka consumer group ID for a KafkaTrigger node.
 *
 * Using a workflowId+nodeId–derived name means that each restart/reconnect
 * rejoins the same consumer group, preventing duplicate message dispatch and
 * ensuring the broker tracks committed offsets per trigger subscription.
 *
 * @param workflowId - The workflow definition ID (not the run ID).
 * @param triggerNodeId - The canvas node ID of the kafkaTrigger node.
 * @returns A deterministic string safe to use as a Kafka consumer group ID.
 */
export function deriveKafkaTriggerGroupId(workflowId: string, triggerNodeId: string): string {
  return `rf-trigger-${workflowId}-${triggerNodeId}`;
}

// ── Context variable key constants ───────────────────────────────────────────

/**
 * Context variable keys seeded into the workflow variable context
 * when a KafkaTrigger node fires (i.e., the workflow starts from a Kafka message).
 *
 * Dynamic header keys follow the pattern: `kafka.trigger.header.<name>`
 * (e.g. `kafka.trigger.header.X-Request-Id`).
 */
export const KAFKA_TRIGGER_CONTEXT_KEYS = {
  topic:     'kafka.trigger.topic',
  partition: 'kafka.trigger.partition',
  offset:    'kafka.trigger.offset',
  key:       'kafka.trigger.key',
  value:     'kafka.trigger.value',
  /** Header key prefix — append `.<headerName>` to get the full key. */
  headerPrefix: 'kafka.trigger.header',
} as const;

/**
 * Context variable keys seeded into the workflow variable context
 * when a KafkaWait node resumes (i.e., the matching correlation message is received).
 *
 * Dynamic header keys follow the pattern: `kafka.wait.header.<name>`.
 */
export const KAFKA_WAIT_CONTEXT_KEYS = {
  topic:     'kafka.wait.topic',
  partition: 'kafka.wait.partition',
  offset:    'kafka.wait.offset',
  key:       'kafka.wait.key',
  value:     'kafka.wait.value',
  /** Header key prefix — append `.<headerName>` to get the full key. */
  headerPrefix: 'kafka.wait.header',
} as const;

// ── Config validation ────────────────────────────────────────────────────────

/**
 * Returns true if the KafkaTrigger node data has the minimum required fields
 * to attempt a subscription. Used for compile-safe contract tests and pre-run validation.
 */
export function isValidKafkaTriggerConfig(data: KafkaTriggerNodeData): boolean {
  return (
    typeof data.clusterId === 'string' && data.clusterId.trim().length > 0 &&
    typeof data.topic === 'string' && data.topic.trim().length > 0
  );
}

/**
 * Returns true if the KafkaWait node data has the minimum required fields
 * to attempt correlation matching. Used for compile-safe contract tests and pre-run validation.
 */
export function isValidKafkaWaitConfig(data: KafkaWaitNodeData): boolean {
  return (
    typeof data.clusterId === 'string' && data.clusterId.trim().length > 0 &&
    typeof data.topic === 'string' && data.topic.trim().length > 0 &&
    typeof data.correlationIdExpression === 'string' && data.correlationIdExpression.trim().length > 0
  );
}
