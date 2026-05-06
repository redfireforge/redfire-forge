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
});
