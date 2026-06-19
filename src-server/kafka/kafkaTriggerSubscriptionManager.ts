/**
 * Bounded trigger subscription lifecycle manager.
 *
 * Manages long-lived Kafka consumers that fire workflow executions on each
 * matching message. Enforces per-trigger concurrency limits using KafkaJS
 * pause/resume to apply backpressure rather than dropping executions.
 */
import { randomUUID } from 'node:crypto';
import type { Workflow } from '../../src/features/workflow/types/workflow.js';
import type { KafkaTriggerNodeData } from '../../src/features/workflow/types/workflow.js';
import type { LogLine } from '../../src/shared/types/server-api.js';
import { matchesKafkaMessageFilters } from '../../src/features/workflow/engine/graphRunnerTriggerHandlers.js';
import { deriveKafkaTriggerGroupId } from '../../src/features/workflow/engine/kafkaTriggerContracts.js';
import { createKafkaRuntimeAdapter, type KafkaConsumerAdapter, type KafkaConsumerRecord, type KafkaRuntimeAdapter } from './kafka-adapter.js';
import type { KafkaConnectionConfig } from './contracts.js';
import { executeWorkflow, saveErrorResult } from '../executeWorkflow.js';
import { toErrorMessage } from '../../src/shared/utils/helpers.js';

const DEFAULT_MAX_CONCURRENT_RUNS = 10;

interface TriggerEntry {
  workflowId: string;
  nodeId: string;
  topic: string;
  maxConcurrentRuns: number;
  activeRunCount: number;
  paused: boolean;
  /**
   * Set to true by cleanup() so that in-flight finally() callbacks
   * do not attempt to call consumer.resume() on a stopped consumer.
   */
  cancelled: boolean;
  consumer: KafkaConsumerAdapter;
  groupId: string;
  cleanup: () => Promise<void>;
}

export type { TriggerEntry };

interface ActivateTriggerParams {
  workflow: Workflow;
  nodeId: string;
  connection: KafkaConnectionConfig;
  onLog?: (line: LogLine) => void;
}

export class KafkaTriggerSubscriptionManager {
  private readonly entries = new Map<string, TriggerEntry>();
  private readonly runtimeAdapter: KafkaRuntimeAdapter;

  constructor(runtimeAdapter: KafkaRuntimeAdapter = createKafkaRuntimeAdapter()) {
    this.runtimeAdapter = runtimeAdapter;
  }

  /**
   * Activate a Kafka trigger subscription for the given workflow node.
   * If a subscription already exists for the same key, it is deactivated first
   * (idempotent re-activation).
   */
  async activateTrigger(params: ActivateTriggerParams): Promise<void> {
    const { workflow, nodeId, connection, onLog } = params;

    // Find the kafkaTrigger node in the workflow
    const triggerNode = workflow.nodes.find(
      (n) => n.id === nodeId && n.type === 'kafkaTrigger',
    );
    if (!triggerNode) {
      throw new Error(
        `[KafkaTrigger] Node "${nodeId}" not found or is not a kafkaTrigger in workflow "${workflow.id}"`,
      );
    }

    const data = triggerNode.data as KafkaTriggerNodeData;
    const topic = data.topic?.trim();
    if (!topic) {
      throw new Error(`[KafkaTrigger] Node "${nodeId}" in workflow "${workflow.id}" has no topic configured`);
    }

    const groupId = data.consumerGroupId?.trim() || deriveKafkaTriggerGroupId(workflow.id, nodeId);
    const maxConcurrentRuns = data.maxConcurrentRuns ?? DEFAULT_MAX_CONCURRENT_RUNS;
    const fromBeginning = data.startPosition === 'earliest';
    const workflowId = workflow.id;
    const entryKey = `${workflowId}::${nodeId}`;

    // Idempotent: deactivate any existing subscription first
    if (this.entries.has(entryKey)) {
      await this.deactivateTrigger(workflowId, nodeId);
    }

    const consumer = this.runtimeAdapter.createConsumer(connection, groupId);

    const entry: TriggerEntry = {
      workflowId,
      nodeId,
      topic,
      maxConcurrentRuns,
      activeRunCount: 0,
      paused: false,
      cancelled: false,
      consumer,
      groupId,
      cleanup: async () => {
        entry.cancelled = true;
        try {
          await consumer.stop();
        } catch {
          // ignore stop errors during cleanup
        }
        try {
          await consumer.disconnect();
        } catch {
          // ignore disconnect errors during cleanup
        }
      },
    };

    // Connect and subscribe before registering in the map so a connect/subscribe
    // failure never leaves a stale entry that `getEntries()` could return.
    try {
      await consumer.connect();
      await consumer.subscribe(topic, fromBeginning);
    } catch (err) {
      // Attempt a best-effort disconnect so the kafkajs client is not left open.
      try { await consumer.disconnect(); } catch { /* ignore */ }
      throw err;
    }

    this.entries.set(entryKey, entry);

    // Start consuming — fire-and-forget per message for bounded concurrency.
    // Catch any run() startup errors so they are logged rather than lost.
    consumer.run(async (record: KafkaConsumerRecord) => {
      // Apply message filters first
      if (!matchesKafkaMessageFilters(record, data.keyRegex, data.headerFilters, data.jsonPathFilters)) {
        return;
      }

      // Drop message if at or above the concurrency limit (race window before kafkajs honors pause)
      if (entry.activeRunCount >= entry.maxConcurrentRuns) {
        onLog?.({
          prefix: '!',
          text: `[KafkaTrigger] Dropped message — max concurrency (${entry.maxConcurrentRuns}) reached for ${entryKey}`,
          ts: Date.now(),
        });
        return;
      }

      // Claim a slot
      entry.activeRunCount++;

      // Pause consumer if we just hit the limit
      if (!entry.paused && entry.activeRunCount >= entry.maxConcurrentRuns) {
        entry.paused = true;
        consumer.pause([{ topic }]);
        onLog?.({
          prefix: '!',
          text: `[KafkaTrigger] Pausing consumer — max concurrency (${entry.maxConcurrentRuns}) reached for ${entryKey}`,
          ts: Date.now(),
        });
      }

      // Dispatch workflow — fire-and-forget; finally() releases the slot.
      // Guard resume() with entry.cancelled to avoid calling resume on a stopped consumer
      // when deactivateTrigger() is called while a run is still in-flight.
      void dispatchWorkflowRun(workflow, entry, record, onLog).finally(() => {
        entry.activeRunCount--;
        if (entry.paused && !entry.cancelled && entry.activeRunCount < entry.maxConcurrentRuns) {
          entry.paused = false;
          consumer.resume([{ topic }]);
          onLog?.({
            prefix: '*',
            text: `[KafkaTrigger] Resuming consumer — concurrency dropped below limit for ${entryKey}`,
            ts: Date.now(),
          });
        }
      });
    }).catch((err: unknown) => {
      onLog?.({
        prefix: '!',
        text: `[KafkaTrigger] Consumer run error for ${entryKey}: ${toErrorMessage(err)}`,
        ts: Date.now(),
      });
    });

    onLog?.({
      prefix: '*',
      text: `[KafkaTrigger] Activated subscription: workflow=${workflowId}, node=${nodeId}, topic=${topic}, groupId=${groupId}`,
      ts: Date.now(),
    });
  }

  /**
   * Deactivate a specific trigger subscription. No-op if not found.
   */
  async deactivateTrigger(workflowId: string, nodeId: string): Promise<void> {
    const entryKey = `${workflowId}::${nodeId}`;
    const entry = this.entries.get(entryKey);
    if (!entry) {
      return;
    }
    this.entries.delete(entryKey);
    await entry.cleanup();
  }

  /**
   * Deactivate all active trigger subscriptions. Called on server shutdown.
   */
  async deactivateAll(): Promise<void> {
    const cleanups = [...this.entries.values()].map((e) => e.cleanup());
    this.entries.clear();
    await Promise.allSettled(cleanups);
  }

  /**
   * Returns a snapshot of all active trigger entries for the status endpoint.
   */
  getEntries(): Array<{
    workflowId: string;
    nodeId: string;
    topic: string;
    groupId: string;
    maxConcurrentRuns: number;
    activeRunCount: number;
    paused: boolean;
  }> {
    return [...this.entries.values()].map((e) => ({
      workflowId: e.workflowId,
      nodeId: e.nodeId,
      topic: e.topic,
      groupId: e.groupId,
      maxConcurrentRuns: e.maxConcurrentRuns,
      activeRunCount: e.activeRunCount,
      paused: e.paused,
    }));
  }
}

async function dispatchWorkflowRun(
  workflow: Workflow,
  entry: TriggerEntry,
  record: KafkaConsumerRecord,
  onLog?: (line: LogLine) => void,
): Promise<void> {
  const startTime = Date.now();
  // Each execution gets a unique ID so concurrent runs don't collide
  const executionId = `kafka-${entry.workflowId}-${entry.nodeId}-${randomUUID()}`;

  // Strip the server-only `rawValue` (raw Buffer) before exposing the record to
  // the workflow: JSON.stringify would otherwise serialize it as a bloated
  // `{"type":"Buffer","data":[...]}` blob in the `__kafkaTriggerMessage`
  // variable. Consumers want the (already-stringified/decoded) `value`.
  const { rawValue: _rawValue, ...triggerRecord } = record;

  const initialVariables: Record<string, string> = {
    ...workflow.variables,
    __kafkaTriggerMessage: JSON.stringify(triggerRecord),
  };

  try {
    await executeWorkflow({
      executionId,
      workflow,
      initialVariables,
      triggerType: 'kafka-trigger',
      triggerId: entry.nodeId,
      startTime,
      onLog,
    });
  } catch (err) {
    const errorMessage = toErrorMessage(err);
    onLog?.({
      prefix: '!',
      text: `[KafkaTrigger] Execution error for ${entry.workflowId}::${entry.nodeId}: ${errorMessage}`,
      ts: Date.now(),
    });
    // Persist error to execution history — parallel to webhook/cron path behavior
    await saveErrorResult({
      executionId,
      workflowId: entry.workflowId,
      triggerId: entry.nodeId,
      triggerType: 'kafka-trigger',
      startTime,
      error: errorMessage,
    });
  }
}

export const kafkaTriggerSubscriptionManager = new KafkaTriggerSubscriptionManager();
