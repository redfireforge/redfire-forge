/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { isTauri, isNode } from './platform';

describe('isTauri', () => {
  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('returns false when __TAURI_INTERNALS__ is not present', () => {
    expect(isTauri()).toBe(false);
  });

  it('returns true when __TAURI_INTERNALS__ is present', () => {
    (window as any).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });
});

describe('isNode', () => {
  it('returns true in test environment (Node)', () => {
    expect(isNode()).toBe(true);
  });
});
