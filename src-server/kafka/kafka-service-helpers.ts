/**
 * Pure utility functions shared by KafkaService and its extracted operation modules.
 *
 * Extracted from kafka-service.ts to keep that orchestrating class under 900 lines
 * and to make each utility individually testable.
 */

import type { KafkaConnectionConfig } from './contracts.js';

// ── Timeout constants ─────────────────────────────────────────────────────────

export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_CLEANUP_TIMEOUT_MS = 2_000;

// ── Error utilities ───────────────────────────────────────────────────────────

/** Extract a human-readable message from any thrown value. */
export function toKafkaMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Returns true when the error message indicates a Kafka operation timeout. */
export function isTimeoutError(error: unknown): boolean {
  const message = toKafkaMessage(error).toLowerCase();
  return message.includes('timed out') || message.includes('timeout');
}

/** Returns true when the error message indicates a SASL / credential failure. */
export function isAuthError(error: unknown): boolean {
  const message = toKafkaMessage(error).toLowerCase();
  return (
    message.includes('sasl authentication failed') ||
    message.includes('authentication failed') ||
    message.includes('invalid credentials')
  );
}

// ── Timeout resolution ────────────────────────────────────────────────────────

/** Effective connect timeout: cluster config value or the default, never < 1 ms. */
export function resolveConnectTimeout(connection?: KafkaConnectionConfig): number {
  return Math.max(connection?.connectionTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS, 1);
}

/** Effective request timeout: cluster config value or the default, never < 1 ms. */
export function resolveRequestTimeout(connection?: KafkaConnectionConfig): number {
  return Math.max(connection?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, 1);
}

// ── Promise timeout race ──────────────────────────────────────────────────────

/**
 * Races `promise` against a timer that rejects after `timeoutMs`.
 * The timer is always cleared regardless of which side wins.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, op: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Kafka ${op} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// ── Safe teardown helpers ─────────────────────────────────────────────────────

/**
 * Disconnects a KafkaJS producer, swallowing errors.
 * Producer disconnect failures are non-fatal cleanup noise.
 */
export async function safeDisconnectProducer(
  producer: { disconnect(): Promise<void> },
): Promise<void> {
  try {
    await withTimeout(producer.disconnect(), DEFAULT_CLEANUP_TIMEOUT_MS, 'producer-disconnect');
  } catch {
    // non-fatal
  }
}

/**
 * Disconnects a KafkaJS consumer, swallowing errors.
 * Consumer disconnect failures are non-fatal cleanup noise.
 */
export async function safeDisconnectConsumer(
  consumer: { disconnect(): Promise<void> },
): Promise<void> {
  try {
    await withTimeout(consumer.disconnect(), DEFAULT_CLEANUP_TIMEOUT_MS, 'consumer-disconnect');
  } catch {
    // non-fatal
  }
}

/**
 * Stops then disconnects a KafkaJS consumer, swallowing errors on both steps.
 * Used in subscribe/consume-once error paths where the consumer may be
 * partially started.
 */
export async function safeStopAndDisconnectConsumer(
  consumer: { stop(): Promise<void>; disconnect(): Promise<void> },
): Promise<void> {
  try {
    await consumer.stop();
  } catch {
    // Stop failures are non-fatal during cleanup.
  }
  await safeDisconnectConsumer(consumer);
}
