import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCorrelationStore } from './correlation-store-factory';

describe('createCorrelationStore', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates InMemoryServerStore by default', async () => {
    const store = await createCorrelationStore('memory');
    expect(store.count()).toBe(0);
    expect(store.listAll()).toEqual([]);
    await store.close();
  });

  it('creates InMemoryServerStore when no type specified and no env', async () => {
    const store = await createCorrelationStore();
    // Default is memory
    expect(store.count()).toBe(0);
    await store.close();
  });

  it('creates SqliteServerStore with sqlite type', async () => {
    const store = await createCorrelationStore('sqlite');
    expect(store.count()).toBe(0);
    store.clearAll();
    await store.close();
  });
});
