/**
 * Helper functions for CorrelationWait node handler.
 * Extracted to reduce code duplication and improve testability.
 */

import type { CorrelationWaitNodeData } from '../types/workflow';
import type { VariableContext } from './variableContext';
import { extractPayloadVariables } from './graphRunnerHelpers';

export interface CorrelationWaitLogFn {
  (line: { prefix: string; text: string }): void;
}

/**
 * Injects webhook payload data into the variable context and extracts configured variables.
 */
export function injectWebhookPayload(
  webhookData: Record<string, unknown>,
  correlationId: string,
  data: CorrelationWaitNodeData,
  ctx: VariableContext,
  log: CorrelationWaitLogFn,
  label: string,
): void {
  ctx.set('webhook.body', JSON.stringify(webhookData));
  ctx.set('webhook.correlationId', correlationId);

  if (data.extractVariables && data.extractVariables.length > 0) {
    const extracted = extractPayloadVariables(webhookData, data.extractVariables, ctx);
    for (const [name, strVal] of Object.entries(extracted)) {
      log({ prefix: '#', text: `[${label}] ${name} = ${strVal.length > 80 ? strVal.slice(0, 80) + '…' : strVal}` });
    }
  }
}

/**
 * Creates a promise that rejects when the abort signal fires.
 * Returns null if no abort signal is provided.
 */
export function createAbortPromise(abortSignal?: AbortSignal): Promise<never> | null {
  if (!abortSignal) return null;
  
  return new Promise<never>((_, reject) => {
    if (abortSignal.aborted) {
      reject(new Error('Workflow run aborted'));
      return;
    }
    abortSignal.addEventListener('abort', () => reject(new Error('Workflow run aborted')), { once: true });
  });
}

/**
 * Calculates the actual delay with jitter for synthetic inject mode.
 */
export function calculateSyntheticDelay(baseDelayMs: number, jitterMs: number = 0): number {
  if (jitterMs <= 0) return baseDelayMs;
  const jitter = Math.random() * jitterMs * 2 - jitterMs;
  return Math.max(0, baseDelayMs + jitter);
}

/**
 * Waits for a specified delay, respecting the abort signal.
 * Returns true if completed, false if aborted.
 */
export async function waitWithAbort(delayMs: number, abortSignal?: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(true), delayMs);
    if (abortSignal) {
      if (abortSignal.aborted) {
        clearTimeout(timer);
        resolve(false);
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        resolve(false);
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Gets the mock payload for a node from runner config or node-level fallback.
 */
export function getMockPayload(
  nodeId: string,
  runnerMockPayloads?: Record<string, Record<string, unknown>>,
  nodeLevelPayload?: Record<string, unknown>,
): Record<string, unknown> {
  return runnerMockPayloads?.[nodeId] ?? nodeLevelPayload ?? {};
}
