/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// ── idbOpen mock ──────────────────────────────────────────────────────────────
let mockGetResult: unknown = undefined;
let mockGetShouldError = false;
let mockPutShouldError = false;
const mockPutCalls: Array<{ data: unknown; key: string }> = [];

vi.mock('./idbOpen', () => {
  // createRequest must live inside the factory so it is available when Vitest hoists vi.mock()
  const createRequest = <T>(result: T, shouldError: boolean): IDBRequest<T> => {
    return {
      result,
      error: shouldError ? new Error('IDB Error') : null,
      get onsuccess() { return null; },
      set onsuccess(fn: ((ev: Event) => void) | null) {
        if (fn && !shouldError) Promise.resolve().then(() => fn(new Event('success')));
      },
      get onerror() { return null; },
      set onerror(fn: ((ev: Event) => void) | null) {
        if (fn && shouldError) Promise.resolve().then(() => fn(new Event('error')));
      },
    } as unknown as IDBRequest<T>;
  };

  const mockObjectStore = {
    get: () => createRequest(mockGetResult, mockGetShouldError),
    put: (data: unknown, key: string) => {
      mockPutCalls.push({ data, key });
      return createRequest(undefined, mockPutShouldError);
    },
  };
  return {
    openDB: vi.fn().mockResolvedValue({
      transaction: () => ({ objectStore: () => mockObjectStore }),
    }),
  };
});

import { idbAvailable, wrap, txComplete, createIdbBlobStore } from './idbHelpers';

describe('idbHelpers', () => {
  beforeEach(() => {
    resetAllMocks();
    mockGetResult = undefined;
    mockGetShouldError = false;
    mockPutShouldError = false;
    mockPutCalls.length = 0;
    localStorage.clear();
    // Ensure indexedDB is restored between tests (fake-indexeddb/auto sets it up)
    if (!(globalThis as Record<string, unknown>).indexedDB) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fake-indexeddb/auto');
    }
  });

  describe('idbAvailable', () => {
    it('returns true when indexedDB is defined', () => {
      // fake-indexeddb/auto ensures indexedDB is available in jsdom
      expect(idbAvailable()).toBe(true);
    });

    it('returns false when indexedDB is undefined', () => {
      const orig = (globalThis as Record<string, unknown>).indexedDB;
      (globalThis as Record<string, unknown>).indexedDB = undefined;
      try {
        expect(idbAvailable()).toBe(false);
      } finally {
        (globalThis as Record<string, unknown>).indexedDB = orig;
      }
    });
  });

  describe('txComplete', () => {
    it('resolves when transaction completes', async () => {
      const tx = {
        get oncomplete() { return null; },
        set oncomplete(fn: (() => void) | null) {
          if (fn) Promise.resolve().then(() => fn());
        },
        get onerror() { return null; },
        set onerror(_fn: (() => void) | null) { /* */ },
        get onabort() { return null; },
        set onabort(_fn: (() => void) | null) { /* */ },
        error: null,
      } as unknown as IDBTransaction;
      await expect(txComplete(tx)).resolves.toBeUndefined();
    });

    it('rejects when transaction errors', async () => {
      const tx = {
        get oncomplete() { return null; },
        set oncomplete(_fn: (() => void) | null) { /* */ },
        get onerror() { return null; },
        set onerror(fn: (() => void) | null) {
          if (fn) Promise.resolve().then(() => fn());
        },
        get onabort() { return null; },
        set onabort(_fn: (() => void) | null) { /* */ },
        error: new Error('tx error'),
      } as unknown as IDBTransaction;
      await expect(txComplete(tx)).rejects.toBeInstanceOf(Error);
    });

    it('rejects on abort with fallback message when error is null', async () => {
      const tx = {
        get oncomplete() { return null; },
        set oncomplete(_fn: (() => void) | null) { /* */ },
        get onerror() { return null; },
        set onerror(_fn: (() => void) | null) { /* */ },
        get onabort() { return null; },
        set onabort(fn: (() => void) | null) {
          if (fn) Promise.resolve().then(() => fn());
        },
        error: null,
      } as unknown as IDBTransaction;
      await expect(txComplete(tx)).rejects.toThrow('IDB transaction aborted');
    });
  });

  describe('wrap', () => {
    it('resolves with the result on success', async () => {
      const req: IDBRequest<string> = {
        result: 'hello',
        error: null,
        get onsuccess() { return null; },
        set onsuccess(fn: ((ev: Event) => void) | null) {
          if (fn) Promise.resolve().then(() => fn(new Event('success')));
        },
        get onerror() { return null; },
        set onerror(_fn: ((ev: Event) => void) | null) { /* */ },
      } as unknown as IDBRequest<string>;
      const result = await wrap(req);
      expect(result).toBe('hello');
    });

    it('rejects with the error on failure', async () => {
      const req: IDBRequest<string> = {
        result: '',
        error: new Error('IDB Error'),
        get onsuccess() { return null; },
        set onsuccess(_fn: ((ev: Event) => void) | null) { /* */ },
        get onerror() { return null; },
        set onerror(fn: ((ev: Event) => void) | null) {
          if (fn) Promise.resolve().then(() => fn(new Event('error')));
        },
      } as unknown as IDBRequest<string>;
      await expect(wrap(req)).rejects.toBeInstanceOf(Error);
    });
  });

  describe('createIdbBlobStore', () => {
    describe('load', () => {
      it('returns null when indexedDB is unavailable', async () => {
        const orig = (globalThis as Record<string, unknown>).indexedDB;
        (globalThis as Record<string, unknown>).indexedDB = undefined;
        try {
          const store = createIdbBlobStore('test-store');
          expect(await store.load()).toBeNull();
        } finally {
          (globalThis as Record<string, unknown>).indexedDB = orig;
        }
      });

      it('returns data when IDB has a stored value', async () => {
        mockGetResult = { items: [1, 2, 3] };
        const store = createIdbBlobStore('test-store');
        expect(await store.load()).toEqual({ items: [1, 2, 3] });
      });

      it('returns null when stored value is empty (falsy)', async () => {
        mockGetResult = undefined;
        const store = createIdbBlobStore('test-store');
        expect(await store.load()).toBeNull();
      });

      it('uses default validate (truthy check) when no custom validator provided', async () => {
        mockGetResult = { ok: true };
        const store = createIdbBlobStore('default-validate-store');
        expect(await store.load()).toEqual({ ok: true });
      });

      it('default validate rejects falsy stored values during migrate', async () => {
        localStorage.setItem('falsy-key', JSON.stringify(null));
        const store = createIdbBlobStore('default-validate-store');
        expect(await store.migrate('falsy-key')).toBe(false);
      });

      it('returns null when IDB throws (catch branch)', async () => {
        mockGetShouldError = true;
        const store = createIdbBlobStore('test-store');
        expect(await store.load()).toBeNull();
      });
    });

    describe('save', () => {
      it('stores data under "all" key', async () => {
        const store = createIdbBlobStore('test-store');
        await store.save({ items: ['a', 'b'] });
        expect(mockPutCalls).toHaveLength(1);
        expect(mockPutCalls[0].key).toBe('all');
        expect(mockPutCalls[0].data).toEqual({ items: ['a', 'b'] });
      });

      it('throws when indexedDB is unavailable', async () => {
        const orig = (globalThis as Record<string, unknown>).indexedDB;
        (globalThis as Record<string, unknown>).indexedDB = undefined;
        try {
          const store = createIdbBlobStore('test-store');
          await expect(store.save({ items: [] })).rejects.toThrow('IndexedDB not available');
        } finally {
          (globalThis as Record<string, unknown>).indexedDB = orig;
        }
      });

      it('propagates IDB put errors', async () => {
        mockPutShouldError = true;
        const store = createIdbBlobStore('test-store');
        await expect(store.save({ items: [] })).rejects.toBeInstanceOf(Error);
      });
    });

    describe('migrate', () => {
      it('returns false when indexedDB is unavailable', async () => {
        const orig = (globalThis as Record<string, unknown>).indexedDB;
        (globalThis as Record<string, unknown>).indexedDB = undefined;
        try {
          const store = createIdbBlobStore('test-store');
          expect(await store.migrate('ls-key')).toBe(false);
        } finally {
          (globalThis as Record<string, unknown>).indexedDB = orig;
        }
      });

      it('returns false when localStorage key is missing', async () => {
        const store = createIdbBlobStore('test-store');
        expect(await store.migrate('non-existent-key')).toBe(false);
      });

      it('returns false when validation fails', async () => {
        localStorage.setItem('my-key', JSON.stringify([1, 2, 3]));
        const store = createIdbBlobStore<number[]>('test-store', (data) => Array.isArray(data) && (data as number[]).length > 10);
        expect(await store.migrate('my-key')).toBe(false);
      });

      it('migrates valid data: saves to IDB and removes from localStorage', async () => {
        const data = [1, 2, 3];
        localStorage.setItem('my-key', JSON.stringify(data));
        const store = createIdbBlobStore<number[]>('test-store', (d) => Array.isArray(d));
        const result = await store.migrate('my-key');
        expect(result).toBe(true);
        expect(mockPutCalls).toHaveLength(1);
        expect(localStorage.getItem('my-key')).toBeNull();
      });

      it('returns false when JSON.parse throws (catch branch)', async () => {
        localStorage.setItem('bad-key', 'not-valid-json{{{');
        const store = createIdbBlobStore('test-store');
        expect(await store.migrate('bad-key')).toBe(false);
      });
    });
  });
});

