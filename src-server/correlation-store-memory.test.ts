import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryServerStore } from './correlation-store-memory';
import type { ServerPausedEntry } from './correlation-handler';

function makeEntry(overrides: Partial<ServerPausedEntry> = {}): ServerPausedEntry {
  return {
    correlationId: 'corr-1',
    webhookPath: '/webhooks/callback/payment',
    executionId: 'exec-1',
    workflowId: 'wf-1',
    pausedNodeId: 'cw1',
    pausedAt: Date.now(),
    timeoutAt: 0,
    correlationSource: 'body',
    correlationJsonPath: '$.correlationId',
    ...overrides,
  };
}

describe('InMemoryServerStore', () => {
  let store: InMemoryServerStore;

  beforeEach(async () => {
    store = new InMemoryServerStore();
    await store.init();
  });

  it('adds and finds an entry', () => {
    expect(store.add(makeEntry())).toBe(true);
    expect(store.find('corr-1')).toBeDefined();
    expect(store.count()).toBe(1);
  });

  it('rejects duplicate IDs', () => {
    store.add(makeEntry());
    expect(store.add(makeEntry())).toBe(false);
  });

  it('removes an entry', () => {
    store.add(makeEntry());
    const removed = store.remove('corr-1');
    expect(removed?.correlationId).toBe('corr-1');
    expect(store.count()).toBe(0);
  });

  it('lists all entries', () => {
    store.add(makeEntry({ correlationId: 'a' }));
    store.add(makeEntry({ correlationId: 'b' }));
    expect(store.listAll()).toHaveLength(2);
  });

  it('cleans up expired entries', () => {
    store.add(makeEntry({ correlationId: 'expired', timeoutAt: Date.now() - 1000 }));
    store.add(makeEntry({ correlationId: 'active', timeoutAt: 0 }));
    expect(store.cleanupExpired()).toBe(1);
    expect(store.count()).toBe(1);
  });

  it('logs unmatched webhooks', () => {
    store.logUnmatched('/test', 'x', { data: 1 });
    expect(store.getUnmatched()).toHaveLength(1);
  });

  it('clears all data', () => {
    store.add(makeEntry());
    store.logUnmatched('/test', undefined, {});
    store.clearAll();
    expect(store.count()).toBe(0);
    expect(store.getUnmatched()).toHaveLength(0);
  });
});
