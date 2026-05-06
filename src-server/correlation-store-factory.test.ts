import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPgCtor } = vi.hoisted(() => ({
  mockPgCtor: vi.fn(),
}));

vi.mock('./correlation-store-postgres.js', () => ({
  PostgresServerStore: mockPgCtor,
}));

import { createCorrelationStore } from './correlation-store-factory';

describe('createCorrelationStore', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockPgCtor.mockReset();
    mockPgCtor.mockImplementation(
      class PostgresServerStoreStub {
        init = vi.fn().mockResolvedValue(undefined);
        close = vi.fn().mockResolvedValue(undefined);
      },
    );
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

  it('uses CORRELATION_STORE_TYPE from env when type omitted', async () => {
    vi.stubEnv('CORRELATION_STORE_TYPE', 'memory');
    const store = await createCorrelationStore();
    expect(store.count()).toBe(0);
    await store.close();
  });

  it('creates PostgresServerStore with postgres type', async () => {
    const store = await createCorrelationStore('postgres');
    expect(mockPgCtor).toHaveBeenCalledTimes(1);
    await store.init();
    await store.close();
  });
});
