/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// ─── In-memory store state ─────────────────────────────────────────────────────

type StoreData = Map<string, unknown>;

const stores: Record<string, StoreData> = {
  'graphql-history': new Map(),
};

function matchesCompoundRange(
  item: Record<string, unknown>,
  indexField: string,
  range?: IDBKeyRange,
): boolean {
  if (!range) return true;
  const r = range as unknown as { lower: unknown; upper: unknown };
  if (indexField === 'connectionId_timestamp') {
    const lower = r.lower as [string, number];
    const upper = r.upper as [string, number];
    const cid = item.connectionId as string;
    const ts = item.timestamp as number;
    return cid === lower[0] && ts >= lower[1] && ts <= upper[1];
  }
  if (indexField === 'connectionId') {
    return item.connectionId === r.lower;
  }
  const key = item[indexField];
  return key === r.lower;
}

// ─── Mock idbHelpers ───────────────────────────────────────────────────────────

vi.mock('./idbHelpers', () => ({
  wrap: <T>(req: IDBRequest<T> | { _value: T }) => {
    const r = req as { _value: T };
    return Promise.resolve(r._value as T);
  },
  txComplete: () => Promise.resolve(),
}));

// ─── Mock idbOpen ──────────────────────────────────────────────────────────────

vi.mock('./idbOpen', () => {
  const makeRequest = <T>(value: T) => ({ _value: value });

  const makeIndex = (storeName: string, indexField: string) => ({
    getAll: (range?: IDBKeyRange) => {
      const store = stores[storeName]!;
      const all = Array.from(store.values()) as Record<string, unknown>[];
      const filtered = all.filter((item) => matchesCompoundRange(item, indexField, range));
      return makeRequest(filtered);
    },
    getAllKeys: (range?: IDBKeyRange) => {
      const store = stores[storeName]!;
      const all = Array.from(store.values()) as Record<string, unknown>[];
      const filtered = all.filter((item) => matchesCompoundRange(item, indexField, range));
      return makeRequest(filtered.map((item) => item.id));
    },
  });

  const makeObjectStore = (storeName: string) => ({
    getAll: () => makeRequest(Array.from((stores[storeName] ?? new Map()).values())),
    get: (key: string) => makeRequest(stores[storeName]?.get(key)),
    put: (value: unknown) => {
      const id = (value as Record<string, unknown>).id as string;
      stores[storeName]?.set(id, value);
      return makeRequest(id);
    },
    delete: (key: string) => {
      stores[storeName]?.delete(key);
      return makeRequest(undefined);
    },
    index: (indexField: string) => makeIndex(storeName, indexField),
  });

  const mockDB = {
    transaction: (storeNames: string | string[]) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return {
        objectStore: (name: string) => {
          if (!names.includes(name)) throw new Error(`Store ${name} not in transaction`);
          return makeObjectStore(name);
        },
      };
    },
  };

  return { openDB: vi.fn().mockResolvedValue(mockDB) };
});

// ─── Import SUT after mocks ────────────────────────────────────────────────────

import {
  idbSaveHistoryItem,
  idbLoadHistory,
  idbDeleteHistoryItem,
  idbClearHistory,
  HISTORY_STORE,
  RESPONSE_CAP_BYTES,
} from './idbGraphqlHistory';
import { openDB } from './idbOpen';
import type { GraphqlHistoryItem } from '../types/graphql';

function makeHistoryItem(overrides: Partial<GraphqlHistoryItem> = {}): GraphqlHistoryItem {
  return {
    id: overrides.id ?? `hist-${Math.random().toString(36).slice(2, 8)}`,
    operation: { query: '{ hello }', variables: '', operationName: '' },
    response: '{"data":{"hello":"world"}}',
    connectionId: 'conn-1',
    timestamp: Date.now(),
    latencyMs: 42,
    status: 'success',
    ...overrides,
  };
}

beforeEach(() => {
  stores[HISTORY_STORE]!.clear();
  vi.mocked(openDB).mockReset();
  vi.mocked(openDB).mockImplementation(async () => {
    const makeRequest = <T>(value: T) => ({ _value: value });
    const makeIndex = (storeName: string, indexField: string) => ({
      getAll: (range?: IDBKeyRange) => {
        const store = stores[storeName]!;
        const all = Array.from(store.values()) as Record<string, unknown>[];
        const filtered = all.filter((item) => matchesCompoundRange(item, indexField, range));
        return makeRequest(filtered);
      },
      getAllKeys: (range?: IDBKeyRange) => {
        const store = stores[storeName]!;
        const all = Array.from(store.values()) as Record<string, unknown>[];
        const filtered = all.filter((item) => matchesCompoundRange(item, indexField, range));
        return makeRequest(filtered.map((item) => item.id));
      },
    });
    const makeObjectStore = (storeName: string) => ({
      getAll: () => makeRequest(Array.from((stores[storeName] ?? new Map()).values())),
      get: (key: string) => makeRequest(stores[storeName]?.get(key)),
      put: (value: unknown) => {
        const id = (value as Record<string, unknown>).id as string;
        stores[storeName]?.set(id, value);
        return makeRequest(id);
      },
      delete: (key: string) => {
        stores[storeName]?.delete(key);
        return makeRequest(undefined);
      },
      index: (indexField: string) => makeIndex(storeName, indexField),
    });
    return {
      transaction: (storeNames: string | string[]) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        return {
          objectStore: (name: string) => {
            if (!names.includes(name)) throw new Error(`Store ${name} not in transaction`);
            return makeObjectStore(name);
          },
        };
      },
    };
  });
});

describe('idbSaveHistoryItem', () => {
  it('writes a new history item to the store', async () => {
    const item = makeHistoryItem({ id: 'h1' });
    await idbSaveHistoryItem(item, 50);
    expect(stores[HISTORY_STORE]!.get('h1')).toEqual(item);
  });

  it('evicts oldest items when maxItems is reached', async () => {
    const items = [1000, 2000, 3000].map((ts, i) =>
      makeHistoryItem({ id: `h${i}`, timestamp: ts, connectionId: 'conn-1' }),
    );
    for (const item of items) {
      stores[HISTORY_STORE]!.set(item.id, item);
    }

    const newItem = makeHistoryItem({ id: 'h-new', timestamp: 4000, connectionId: 'conn-1' });
    await idbSaveHistoryItem(newItem, 3);

    expect(stores[HISTORY_STORE]!.has('h0')).toBe(false);
    expect(stores[HISTORY_STORE]!.has('h1')).toBe(true);
    expect(stores[HISTORY_STORE]!.has('h2')).toBe(true);
    expect(stores[HISTORY_STORE]!.has('h-new')).toBe(true);
  });

  it('does not evict when count is below maxItems', async () => {
    const item = makeHistoryItem({ id: 'h-only', timestamp: 1000 });
    stores[HISTORY_STORE]!.set(item.id, item);

    const newItem = makeHistoryItem({ id: 'h2', timestamp: 2000 });
    await idbSaveHistoryItem(newItem, 5);

    expect(stores[HISTORY_STORE]!.has('h-only')).toBe(true);
    expect(stores[HISTORY_STORE]!.has('h2')).toBe(true);
  });

  it('truncates oversized string responses', async () => {
    const big = 'x'.repeat(RESPONSE_CAP_BYTES + 10_000);
    const item = makeHistoryItem({ id: 'h-big', response: big });
    await idbSaveHistoryItem(item, 50);

    const saved = stores[HISTORY_STORE]!.get('h-big') as GraphqlHistoryItem;
    expect(saved.response.endsWith('\n__TRUNCATED__')).toBe(true);
    expect(new Blob([saved.response]).size).toBeLessThanOrEqual(RESPONSE_CAP_BYTES);
  });

  it('leaves non-string response unchanged', async () => {
    const item = makeHistoryItem({
      id: 'h-obj',
      response: { ok: true } as unknown as string,
    });
    await idbSaveHistoryItem(item, 50);
    expect(stores[HISTORY_STORE]!.get('h-obj')).toEqual(item);
  });

  it('serialises concurrent saves for the same connection', async () => {
    const maxItems = 2;
    for (let i = 0; i < maxItems; i++) {
      await idbSaveHistoryItem(
        makeHistoryItem({ id: `seed-${i}`, timestamp: i * 1000, connectionId: 'conn-serial' }),
        maxItems,
      );
    }

    await Promise.all([
      idbSaveHistoryItem(makeHistoryItem({ id: 'a', timestamp: 5000, connectionId: 'conn-serial' }), maxItems),
      idbSaveHistoryItem(makeHistoryItem({ id: 'b', timestamp: 6000, connectionId: 'conn-serial' }), maxItems),
    ]);

    const remaining = Array.from(stores[HISTORY_STORE]!.values()) as GraphqlHistoryItem[];
    const forConn = remaining.filter((x) => x.connectionId === 'conn-serial');
    expect(forConn.length).toBeLessThanOrEqual(maxItems);
    expect(forConn.some((x) => x.id === 'b')).toBe(true);
  });

  it('propagates IDB errors to the caller while queue continues for subsequent saves', async () => {
    vi.mocked(openDB).mockRejectedValueOnce(new Error('IDB open failed'));

    // Error should now reject the caller's promise so the caller can choose
    // whether to update in-memory state (it should NOT on failure).
    await expect(idbSaveHistoryItem(makeHistoryItem({ id: 'fail' }), 10)).rejects.toThrow('IDB open failed');

    // Despite the failure, the queue must remain healthy — subsequent saves work.
    const okItem = makeHistoryItem({ id: 'ok-after-fail' });
    await idbSaveHistoryItem(okItem, 10);
    expect(stores[HISTORY_STORE]!.has('ok-after-fail')).toBe(true);
  });
});

describe('idbLoadHistory', () => {
  it('returns empty array when no history exists', async () => {
    expect(await idbLoadHistory('conn-empty')).toEqual([]);
  });

  it('returns items for a connection sorted newest-first', async () => {
    const items = [
      makeHistoryItem({ id: 'old', timestamp: 1000, connectionId: 'conn-1' }),
      makeHistoryItem({ id: 'new', timestamp: 3000, connectionId: 'conn-1' }),
      makeHistoryItem({ id: 'mid', timestamp: 2000, connectionId: 'conn-1' }),
      makeHistoryItem({ id: 'other', timestamp: 9000, connectionId: 'conn-2' }),
    ];
    for (const item of items) stores[HISTORY_STORE]!.set(item.id, item);

    const result = await idbLoadHistory('conn-1');
    expect(result.map((x) => x.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('idbDeleteHistoryItem', () => {
  it('removes a single item by id', async () => {
    const item = makeHistoryItem({ id: 'del-me' });
    stores[HISTORY_STORE]!.set(item.id, item);
    await idbDeleteHistoryItem('del-me');
    expect(stores[HISTORY_STORE]!.has('del-me')).toBe(false);
  });
});

describe('idbClearHistory', () => {
  it('is a no-op when connection has no history', async () => {
    await expect(idbClearHistory('missing-conn')).resolves.toBeUndefined();
    expect(stores[HISTORY_STORE]!.size).toBe(0);
  });

  it('deletes all items for a connection', async () => {
    const items = [
      makeHistoryItem({ id: 'a', connectionId: 'conn-clear' }),
      makeHistoryItem({ id: 'b', connectionId: 'conn-clear' }),
      makeHistoryItem({ id: 'c', connectionId: 'other-conn' }),
    ];
    for (const item of items) stores[HISTORY_STORE]!.set(item.id, item);

    await idbClearHistory('conn-clear');

    expect(stores[HISTORY_STORE]!.has('a')).toBe(false);
    expect(stores[HISTORY_STORE]!.has('b')).toBe(false);
    expect(stores[HISTORY_STORE]!.has('c')).toBe(true);
  });
});
