/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { isTauri, isNode, supportsWorkers } from './platform';

describe('isTauri', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
  });

  it('returns false when __TAURI_INTERNALS__ is not present', () => {
    expect(isTauri()).toBe(false);
  });

  it('returns true when __TAURI_INTERNALS__ is present', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });

  it('returns false when window is undefined (no browser global)', () => {
    vi.stubGlobal('window', undefined);
    expect(isTauri()).toBe(false);
  });
});

describe('isNode', () => {
  const originalVersions = process.versions;

  afterEach(() => {
    Object.defineProperty(process, 'versions', {
      value: originalVersions,
      configurable: true,
      enumerable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('returns true in test environment (Node)', () => {
    expect(isNode()).toBe(true);
  });

  it('returns false when process.versions has no node field', () => {
    Object.defineProperty(process, 'versions', {
      value: {},
      configurable: true,
      enumerable: true,
      writable: true,
    });
    expect(isNode()).toBe(false);
  });

  it('returns false when process is undefined', () => {
    const proc = globalThis.process;
    Object.defineProperty(globalThis, 'process', {
      value: undefined,
      configurable: true,
    });
    expect(isNode()).toBe(false);
    Object.defineProperty(globalThis, 'process', {
      value: proc,
      configurable: true,
    });
  });
});

describe('supportsWorkers', () => {
  it('returns a stable boolean for the current environment', () => {
    const first = supportsWorkers();
    expect(typeof first).toBe('boolean');
    expect(supportsWorkers()).toBe(first);
  });
});
