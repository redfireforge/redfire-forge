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
  idbSaveMicroservices,
  idbMigrateMicroservices,
} from './idbEnvironmentsMicroservices';

describe('idbEnvironmentsMicroservices', () => {
  beforeEach(() => {
    mockPutCalls.length = 0;
    localStorage.clear();
  });

  it('saves microservices to IDB', async () => {
    await idbSaveMicroservices([{ id: 's1', name: 'api', baseUrls: {} }]);
    expect(mockPutCalls).toHaveLength(1);
  });

  it('migrates microservices from localStorage and removes the LS key', async () => {
    localStorage.setItem(
      'perf-test-v3-microservices',
      JSON.stringify([{ id: 's1', name: 'graphql-demo', baseUrls: {} }]),
    );
    const migrated = await idbMigrateMicroservices('perf-test-v3-microservices');
    expect(migrated).toBe(true);
    expect(localStorage.getItem('perf-test-v3-microservices')).toBeNull();
    expect(mockPutCalls).toHaveLength(1);
  });
});
