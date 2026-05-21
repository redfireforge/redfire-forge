/**
 * Shared test helpers for correlation-handler.test.ts splits.
 */
import type { ServerPausedEntry } from '../correlation-handler.js';

export function makeEntry(overrides: Partial<ServerPausedEntry> = {}): ServerPausedEntry {
  return {
    correlationId: 'corr-1',
    webhookPath: '/webhooks/callback/payment',
    executionId: 'exec-1',
    workflowId: 'wf-1',
    pausedNodeId: 'cw1',
    pausedAt: Date.now(),
    timeoutAt: 0,
    correlationSource: 'body',
    correlationJsonPath: 'correlationId',
    ...overrides,
  };
}

export const TEST_HMAC_SECRET = '01234567890123456789012345678901';
