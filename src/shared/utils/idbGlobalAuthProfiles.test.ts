/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

const mockPutCalls: unknown[] = [];

vi.mock('./idbOpen', () => {
  const createRequest = <T>(result: T): IDBRequest<T> => ({
    result,
    error: null,
    get onsuccess() { return null; },
    set onsuccess(fn: ((ev: Event) => void) | null) {
      if (fn) Promise.resolve().then(() => fn(new Event('success')));
    },
    get onerror() { return null; },
    set onerror(fn: ((ev: Event) => void) | null) {
      if (fn) Promise.resolve().then(() => fn(new Event('error')));
    },
  } as unknown as IDBRequest<T>);

  const mockObjectStore = {
    get: () => createRequest(undefined),
    put: (data: unknown) => {
      mockPutCalls.push(data);
      return createRequest(undefined);
    },
  };

  return {
    openDB: vi.fn().mockResolvedValue({
      transaction: () => ({ objectStore: () => mockObjectStore }),
    }),
  };
});

import {
  idbSaveGlobalAuthProfiles,
  idbMigrateGlobalAuthProfiles,
} from './idbGlobalAuthProfiles';
import { GLOBAL_AUTH_KEY } from './storageKeys';

describe('idbGlobalAuthProfiles', () => {
  beforeEach(() => {
    mockPutCalls.length = 0;
    localStorage.clear();
  });

  it('migrates auth profiles from localStorage to IndexedDB', async () => {
    const profiles = [{ id: 'a1', name: 'Demo JWT', type: 'bearer', token: 'x' }];
    localStorage.setItem(GLOBAL_AUTH_KEY, JSON.stringify(profiles));

    const migrated = await idbMigrateGlobalAuthProfiles(GLOBAL_AUTH_KEY);
    expect(migrated).toBe(true);
    expect(localStorage.getItem(GLOBAL_AUTH_KEY)).toBeNull();
    expect(mockPutCalls).toHaveLength(1);
  });

  it('persists via save', async () => {
    const profiles = [{ id: 'a2', name: 'API Key', type: 'apikey', apiKey: 'k', apiKeyHeader: 'X-Api-Key' }];
    await idbSaveGlobalAuthProfiles(profiles);
    expect(mockPutCalls).toEqual([profiles]);
  });
});
