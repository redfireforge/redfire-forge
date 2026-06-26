import { describe, expect, it } from 'vitest';
import {
  DEMO_LIVE_GUARD_STALE_MS,
  createInactiveDemoLiveGuardState,
  parseDemoLiveGuardState,
  resolveDemoLiveGuardCheckDecision,
  resolveDevServerStartupGuardState,
  shouldSkipDevServerResetForDemoGuard,
  validateIncomingDemoLiveGuardState,
} from './demoLiveGuardPolicy';

describe('demoLiveGuardPolicy', () => {
  it('parseDemoLiveGuardState accepts valid payloads', () => {
    expect(parseDemoLiveGuardState({
      active: true,
      lessonId: 'gql-first-query',
      updatedAt: 1_700_000_000_000,
      source: 'manual',
    })).toEqual({
      active: true,
      lessonId: 'gql-first-query',
      updatedAt: 1_700_000_000_000,
      source: 'manual',
    });
  });

  it('parseDemoLiveGuardState rejects invalid payloads', () => {
    expect(parseDemoLiveGuardState(null)).toBeNull();
    expect(parseDemoLiveGuardState({ active: true })).toBeNull();
    expect(parseDemoLiveGuardState({ active: true, updatedAt: NaN })).toBeNull();
    expect(parseDemoLiveGuardState({
      active: true,
      lessonId: '   ',
      updatedAt: 1_700_000_000_000,
    })).toEqual({
      active: true,
      lessonId: undefined,
      updatedAt: 1_700_000_000_000,
      source: undefined,
    });
  });

  it('shouldSkipDevServerResetForDemoGuard respects active + freshness + source', () => {
    const now = 1_700_000_000_000;
    expect(shouldSkipDevServerResetForDemoGuard(
      { active: true, lessonId: 'gql-1', updatedAt: now - 30_000, source: 'manual' },
      now,
    )).toBe(true);

    expect(shouldSkipDevServerResetForDemoGuard(
      { active: true, updatedAt: now - 1_000, source: 'e2e' },
      now,
    )).toBe(false);

    expect(shouldSkipDevServerResetForDemoGuard(
      { active: false, updatedAt: now - 1_000, source: 'manual' },
      now,
    )).toBe(false);

    expect(shouldSkipDevServerResetForDemoGuard(
      { active: true, updatedAt: now - DEMO_LIVE_GUARD_STALE_MS - 1, source: 'manual', lessonId: 'gql-1' },
      now,
    )).toBe(false);

    expect(shouldSkipDevServerResetForDemoGuard(
      { active: true, updatedAt: now - 30_000, source: 'manual' },
      now,
    )).toBe(false);

    expect(shouldSkipDevServerResetForDemoGuard(
      { active: true, lessonId: '   ', updatedAt: now - 30_000, source: 'manual' },
      now,
    )).toBe(false);

    // Legacy files with lessonId still protect manual demos.
    expect(shouldSkipDevServerResetForDemoGuard(
      { active: true, lessonId: 'gql-legacy', updatedAt: now - 30_000 },
      now,
    )).toBe(true);
  });

  it('validateIncomingDemoLiveGuardState rejects active manual guard without lessonId', () => {
    const now = 1_700_000_000_000;
    expect(validateIncomingDemoLiveGuardState({
      active: true,
      updatedAt: now,
      source: 'manual',
    })).toBe('Active manual guard requires lessonId');
    expect(validateIncomingDemoLiveGuardState({
      active: true,
      lessonId: '   ',
      updatedAt: now,
      source: 'manual',
    })).toBe('Active manual guard requires lessonId');
    expect(validateIncomingDemoLiveGuardState(createInactiveDemoLiveGuardState(now))).toBeNull();
  });

  it('resolveDevServerStartupGuardState preserves fresh manual guard', () => {
    const now = 1_700_000_000_000;
    const existing = { active: true, lessonId: 'gql-2', updatedAt: now - 10_000, source: 'manual' as const };
    expect(resolveDevServerStartupGuardState(existing, now)).toEqual(existing);
    expect(resolveDevServerStartupGuardState(null, now)).toEqual(createInactiveDemoLiveGuardState(now));
    expect(resolveDevServerStartupGuardState(
      { active: true, updatedAt: now - DEMO_LIVE_GUARD_STALE_MS - 1, source: 'manual', lessonId: 'gql-2' },
      now,
    )).toEqual(createInactiveDemoLiveGuardState(now));
  });

  it('resolveDemoLiveGuardCheckDecision confirms with live server state', () => {
    const now = 1_700_000_000_000;
    const active = { active: true, lessonId: 'gql-1', updatedAt: now - 5_000, source: 'manual' as const };
    const inactive = createInactiveDemoLiveGuardState(now);

    expect(resolveDemoLiveGuardCheckDecision(null, null, now)).toBe('allow-reset');
    expect(resolveDemoLiveGuardCheckDecision(active, null, now)).toBe('skip-reset');
    expect(resolveDemoLiveGuardCheckDecision(active, inactive, now)).toBe('allow-reset');
    expect(resolveDemoLiveGuardCheckDecision(active, active, now)).toBe('skip-reset');
  });
});
