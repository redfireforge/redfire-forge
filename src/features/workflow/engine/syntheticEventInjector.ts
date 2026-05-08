/**
 * Synthetic Event Injector for Phase 7b
 * 
 * A background process that monitors the correlation store for paused workflows
 * and automatically fires synthetic webhook callbacks after a configurable delay.
 * 
 * This simulates a real external system calling back, testing the full pause/resume flow.
 */

import type { ICorrelationStore, PausedEntry } from './correlationStore';
import { calculateSyntheticDelay } from './correlationWaitHelpers';

export interface SyntheticEventConfig {
  /** Base delay before sending the synthetic webhook (ms). Simulates real-world latency. */
  responseDelayMs: number;
  /** Optional jitter range (±ms) added to responseDelayMs for realistic variance. */
  jitterMs?: number;
  /** Per-node mock payload templates. Key is node ID. Supports {{correlationId}} placeholder. */
  mockPayloads?: Record<string, Record<string, unknown>>;
  /** Default mock payload if no node-specific one is provided. */
  defaultPayload?: Record<string, unknown>;
}

interface PendingInjection {
  correlationId: string;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Resolves {{correlationId}} placeholders in a payload template.
 */
function resolvePayloadTemplate(
  template: Record<string, unknown>,
  correlationId: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(template)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/\{\{correlationId\}\}/g, correlationId);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = resolvePayloadTemplate(value as Record<string, unknown>, correlationId);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

export class SyntheticEventInjector {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private pendingInjections = new Map<string, PendingInjection>();
  private processedCorrelationIds = new Set<string>();
  private stopped = false;
  private correlationStore: ICorrelationStore;
  private config: SyntheticEventConfig;

  constructor(correlationStore: ICorrelationStore, config: SyntheticEventConfig) {
    this.correlationStore = correlationStore;
    this.config = config;
  }

  /**
   * Start monitoring the correlation store for paused workflows.
   * Polls every 50ms and schedules synthetic resumes for new entries.
   */
  start(): void {
    if (this.pollInterval) return;
    this.stopped = false;
    
    this.pollInterval = setInterval(() => {
      this.checkForNewPausedEntries();
    }, 50);
  }

  /**
   * Stop monitoring and cancel all pending injections.
   */
  stop(): void {
    this.stopped = true;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    for (const pending of this.pendingInjections.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingInjections.clear();
    this.processedCorrelationIds.clear();
  }

  /**
   * Check if the injector is currently running.
   */
  get isRunning(): boolean {
    return this.pollInterval !== null && !this.stopped;
  }

  /**
   * Get the number of pending injections waiting to fire.
   */
  get pendingCount(): number {
    return this.pendingInjections.size;
  }

  /**
   * Check for new paused entries and schedule synthetic resumes.
   */
  private checkForNewPausedEntries(): void {
    if (this.stopped) return;
    
    const pausedEntries = this.correlationStore.listPaused();
    
    for (const entry of pausedEntries) {
      if (this.processedCorrelationIds.has(entry.correlationId)) {
        continue;
      }
      
      this.scheduleInjection(entry);
    }
  }

  /**
   * Schedule a synthetic resume for a paused entry.
   */
  private scheduleInjection(entry: PausedEntry): void {
    const { correlationId } = entry;
    
    this.processedCorrelationIds.add(correlationId);
    
    const delay = calculateSyntheticDelay(this.config.responseDelayMs, this.config.jitterMs);
    
    const timer = setTimeout(() => {
      if (this.stopped) return;
      this.executeInjection(entry);
      this.pendingInjections.delete(correlationId);
    }, delay);
    
    this.pendingInjections.set(correlationId, { correlationId, timer });
  }

  /**
   * Execute the synthetic resume for a paused entry.
   */
  private executeInjection(entry: PausedEntry): void {
    const { correlationId } = entry;
    
    if (!this.correlationStore.isPaused(correlationId)) {
      return;
    }
    
    const nodeId = entry.state?.pausedNodeId;
    const payloadTemplate =
      (nodeId ? this.config.mockPayloads?.[nodeId] : undefined) ??
      this.config.defaultPayload ??
      {};
    
    const resolvedPayload = resolvePayloadTemplate(payloadTemplate, correlationId);
    
    this.correlationStore.resume(correlationId, resolvedPayload);
  }
}
