/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGqlModalLockSnapshot,
  normalizeGqlModalLock,
  publishGqlModalLock,
  resetGqlModalLockHostForTests,
} from './gqlModalLockHost';

describe('gqlModalLockHost', () => {
  beforeEach(() => {
    resetGqlModalLockHostForTests();
    delete (window as unknown as Record<string, unknown>).__demoGqlModalLockState;
  });

  it('always keeps env and profiles unlocked when publishing', () => {
    publishGqlModalLock({ envAllowed: false, profileAllowed: false });
    expect(getGqlModalLockSnapshot()).toEqual({
      envAllowed: true,
      profileAllowed: true,
    });
  });

  it('persists normalized lock on window for late-mounting studio', () => {
    publishGqlModalLock({ envAllowed: false, profileAllowed: false });
    expect((window as unknown as Record<string, unknown>).__demoGqlModalLockState).toEqual({
      envAllowed: true,
      profileAllowed: true,
    });
  });

  it('normalizeGqlModalLock always returns open lock', () => {
    expect(normalizeGqlModalLock({ envAllowed: false, profileAllowed: false })).toEqual({
      envAllowed: true,
      profileAllowed: true,
    });
  });
});
