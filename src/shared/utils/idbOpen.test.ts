/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('idbOpen.openDB', () => {
  it('opens database and exposes expected object stores', async () => {
    vi.resetModules();
    await import('fake-indexeddb/auto');
    const { openDB } = await import('./idbOpen');
    const db = await openDB();
    expect(db.objectStoreNames.contains('testRuns')).toBe(true);
    expect(db.objectStoreNames.contains('featureGroups')).toBe(true);
    expect(db.objectStoreNames.contains('sharedDataSources')).toBe(true);
    db.close();
  });

  it('returns the same in-flight promise when called again (singleton)', async () => {
    vi.resetModules();
    await import('fake-indexeddb/auto');
    const { openDB } = await import('./idbOpen');
    const a = openDB();
    const b = openDB();
    expect(a).toBe(b);
    const db = await a;
    db.close();
  });

  it('rejects when indexedDB.open throws synchronously', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        throw new Error('idb open boom');
      }),
      deleteDatabase: vi.fn(),
    } as IDBFactory);
    const { openDB } = await import('./idbOpen');
    await expect(openDB()).rejects.toThrow('idb open boom');
  });

  it('rejects when open never completes (timeout)', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const hung = {} as IDBOpenDBRequest;
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => hung as IDBOpenDBRequest),
      deleteDatabase: vi.fn(),
    } as IDBFactory);
    const { openDB } = await import('./idbOpen');
    const p = openDB();
    const settled = p.then(
      () => { throw new Error('expected rejection'); },
      (e: Error) => e,
    );
    await vi.advanceTimersByTimeAsync(3000);
    expect((await settled).message).toBe('IndexedDB open timed out');
  });

  it('rejects with req.error when onerror fires', async () => {
    vi.resetModules();
    const req = {
      onupgradeneeded: null as null | ((ev: Event) => void),
      onsuccess: null as null | ((ev: Event) => void),
      onerror: null as null | ((ev: Event) => void),
      onblocked: null as null | (() => void),
      error: new Error('open failed') as unknown as DOMException,
      result: null as IDBDatabase | null,
    };
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => req as unknown as IDBOpenDBRequest),
      deleteDatabase: vi.fn(),
    } as IDBFactory);
    const { openDB } = await import('./idbOpen');
    const p = openDB();
    queueMicrotask(() => req.onerror?.({} as Event));
    await expect(p).rejects.toBe(req.error);
  });

  it('handles onblocked by deleting database and retrying open', async () => {
    vi.resetModules();
    let openCall = 0;
    const delReq = {
      onsuccess: null as null | (() => void),
      onerror: null as null | ((ev: Event) => void),
    };
    const blockedReqRef: { onblocked?: () => void; result?: { close: () => void } } = {
      result: { close: vi.fn() },
    };
    const okDb = {
      objectStoreNames: { contains: () => true },
      close: vi.fn(),
      onversionchange: null as null | (() => void),
    } as unknown as IDBDatabase;
    const successReqRef: { onsuccess?: (ev: Event) => void; result?: IDBDatabase } = { result: okDb };

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        openCall++;
        if (openCall === 1) return blockedReqRef as unknown as IDBOpenDBRequest;
        return successReqRef as unknown as IDBOpenDBRequest;
      }),
      deleteDatabase: vi.fn(() => delReq as unknown as IDBOpenDBRequest),
    } as IDBFactory);

    const { openDB } = await import('./idbOpen');
    const p = openDB();
    blockedReqRef.onblocked?.();
    queueMicrotask(() => {
      delReq.onsuccess?.();
      queueMicrotask(() => successReqRef.onsuccess?.({} as Event));
    });
    const db = await p;
    expect(db).toBe(okDb);
    expect(indexedDB.deleteDatabase).toHaveBeenCalledWith('redfireforge');
  });

  it('rejects when deleteDatabase fails after blocked', async () => {
    vi.resetModules();
    const delReq = {
      onsuccess: null as null | (() => void),
      onerror: null as null | ((ev: Event) => void),
    };
    const blockedReqRef: { onblocked?: () => void; result?: { close: () => void } } = {
      result: { close: vi.fn() },
    };
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => blockedReqRef as unknown as IDBOpenDBRequest),
      deleteDatabase: vi.fn(() => delReq as unknown as IDBOpenDBRequest),
    } as IDBFactory);
    const { openDB } = await import('./idbOpen');
    const p = openDB();
    blockedReqRef.onblocked?.();
    queueMicrotask(() => delReq.onerror?.({} as Event));
    await expect(p).rejects.toThrow('IndexedDB blocked and delete failed');
  });

  it('clears cached connection promise when db receives versionchange', async () => {
    vi.resetModules();
    await import('fake-indexeddb/auto');
    const { openDB } = await import('./idbOpen');
    const db = await openDB();
    const close = vi.spyOn(db, 'close');
    db.onversionchange?.({} as IDBVersionChangeEvent);
    expect(close).toHaveBeenCalled();
    const db2 = await openDB();
    expect(db2).not.toBe(db);
    db2.close();
  });

  it('skips store creation if stores already exist (upgrade idempotency)', async () => {
    vi.resetModules();
    // Simulate a db that already has all object stores
    const mockDb = {
      objectStoreNames: {
        contains: vi.fn((name: string) => ['testRuns', 'featureGroups', 'sharedDataSources'].includes(name)),
      },
      createObjectStore: vi.fn(),
      close: vi.fn(),
      onversionchange: null as null | (() => void),
    } as unknown as IDBDatabase;
    
    const req = {
      onupgradeneeded: null as null | ((ev: IDBVersionChangeEvent) => void),
      onsuccess: null as null | ((ev: Event) => void),
      onerror: null as null | ((ev: Event) => void),
      onblocked: null as null | (() => void),
      error: null as null | DOMException,
      result: mockDb,
    };
    
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => req as unknown as IDBOpenDBRequest),
      deleteDatabase: vi.fn(),
    } as IDBFactory);
    
    const { openDB } = await import('./idbOpen');
    const p = openDB();
    
    // Trigger upgrade event
    queueMicrotask(() => {
      req.onupgradeneeded?.({ oldVersion: 2, newVersion: 3 } as IDBVersionChangeEvent);
      // Then trigger success
      queueMicrotask(() => req.onsuccess?.({} as Event));
    });
    
    const db = await p;
    // Since all stores exist, createObjectStore should not be called
    expect(mockDb.createObjectStore).not.toHaveBeenCalled();
    expect(db).toBe(mockDb);
  });

  it('creates only missing stores during upgrade', async () => {
    vi.resetModules();
    // Simulate a db that only has testRuns, missing featureGroups and sharedDataSources
    const storesCreated: string[] = [];
    const mockStore = {
      createIndex: vi.fn(),
    };
    const mockDb = {
      objectStoreNames: {
        contains: vi.fn((name: string) => name === 'testRuns'), // Only testRuns exists
      },
      createObjectStore: vi.fn((name: string) => {
        storesCreated.push(name);
        return mockStore;
      }),
      close: vi.fn(),
      onversionchange: null as null | (() => void),
    } as unknown as IDBDatabase;
    
    const req = {
      onupgradeneeded: null as null | ((ev: IDBVersionChangeEvent) => void),
      onsuccess: null as null | ((ev: Event) => void),
      onerror: null as null | ((ev: Event) => void),
      onblocked: null as null | (() => void),
      error: null as null | DOMException,
      result: mockDb,
    };
    
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => req as unknown as IDBOpenDBRequest),
      deleteDatabase: vi.fn(),
    } as IDBFactory);
    
    const { openDB } = await import('./idbOpen');
    const p = openDB();
    
    // Trigger upgrade event
    queueMicrotask(() => {
      req.onupgradeneeded?.({ oldVersion: 1, newVersion: 3 } as IDBVersionChangeEvent);
      // Then trigger success
      queueMicrotask(() => req.onsuccess?.({} as Event));
    });
    
    await p;
    // Only featureGroups and sharedDataSources should be created
    expect(storesCreated).toEqual(['featureGroups', 'sharedDataSources']);
    expect(mockDb.createObjectStore).toHaveBeenCalledTimes(2);
  });
});
