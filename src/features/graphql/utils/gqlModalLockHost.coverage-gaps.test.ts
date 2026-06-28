/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { subscribeGqlModalLock, installGqlModalLockBridge, publishGqlModalLock, getGqlModalLockSnapshot } from './gqlModalLockHost';

describe('gqlModalLockHost — subscribe and install', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoSetGqlModalLock;
    delete (window as unknown as Record<string, unknown>).__demoGqlModalLockState;
  });

  it('subscribeGqlModalLock notifies on publish and unsubscribes', () => {
    const listener = vi.fn();
    const unsub = subscribeGqlModalLock(listener);
    publishGqlModalLock({ envAllowed: false, profileAllowed: false });
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    publishGqlModalLock({ envAllowed: false, profileAllowed: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('installGqlModalLockBridge restores persisted lock from window', () => {
    (window as unknown as Record<string, unknown>).__demoGqlModalLockState = {
      envAllowed: false,
      profileAllowed: false,
    };
    installGqlModalLockBridge();
    expect((window as unknown as Record<string, unknown>).__demoSetGqlModalLock).toBeTypeOf('function');
  });

  it('getGqlModalLockSnapshot returns current lock state', () => {
    publishGqlModalLock({ envAllowed: true, profileAllowed: true });
    expect(getGqlModalLockSnapshot()).toEqual({ envAllowed: true, profileAllowed: true });
  });

  it('installGqlModalLockBridge no-ops when window is undefined', () => {
    const saved = globalThis.window;
    // @ts-expect-error — simulate SSR
    delete globalThis.window;
    expect(() => installGqlModalLockBridge()).not.toThrow();
    globalThis.window = saved;
  });

  it('publishGqlModalLock skips window write when window is undefined', () => {
    const saved = globalThis.window;
    // @ts-expect-error — simulate SSR
    delete globalThis.window;
    expect(() => publishGqlModalLock({ envAllowed: false, profileAllowed: false })).not.toThrow();
    globalThis.window = saved;
  });

  it('installGqlModalLockBridge skips publish when no persisted lock', () => {
    delete (window as unknown as Record<string, unknown>).__demoGqlModalLockState;
    installGqlModalLockBridge();
    expect(getGqlModalLockSnapshot()).toEqual({ envAllowed: true, profileAllowed: true });
  });
});
