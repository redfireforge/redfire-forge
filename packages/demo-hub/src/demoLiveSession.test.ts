/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEMO_LIVE_SESSION_KEY,
  DEMO_LIVE_SESSION_MAX_AGE_MS,
  persistDemoLiveSession,
  readDemoLiveSession,
  clearDemoLiveSession,
  hasRestorableDemoLiveSession,
  consumeLiveDemoResumeOnce,
  resetLiveDemoResumeConsumeForTests,
} from './demoLiveSession';

describe('demoLiveSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('persists and reads a live session', () => {
    persistDemoLiveSession({
      lessonId: 'gql-first-query',
      stepIndex: 3,
      isPlaying: true,
      speed: 1.5,
      savedAt: Date.now(),
    });
    const session = readDemoLiveSession();
    expect(session?.lessonId).toBe('gql-first-query');
    expect(session?.stepIndex).toBe(3);
    expect(session?.speed).toBe(1.5);
    expect(hasRestorableDemoLiveSession()).toBe(true);
  });

  it('returns null and clears expired sessions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    persistDemoLiveSession({
      lessonId: 'gql-first-query',
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z').getTime() + DEMO_LIVE_SESSION_MAX_AGE_MS + 1);
    expect(readDemoLiveSession()).toBeNull();
    expect(sessionStorage.getItem(DEMO_LIVE_SESSION_KEY)).toBeNull();
  });

  it('clearDemoLiveSession removes the key', () => {
    persistDemoLiveSession({
      lessonId: 'x',
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    clearDemoLiveSession();
    expect(readDemoLiveSession()).toBeNull();
    expect(hasRestorableDemoLiveSession()).toBe(false);
  });

  it('consumeLiveDemoResumeOnce allows only one resume per page load without HMR', () => {
    resetLiveDemoResumeConsumeForTests();
    expect(consumeLiveDemoResumeOnce()).toBe(true);
    expect(consumeLiveDemoResumeOnce()).toBe(false);
    resetLiveDemoResumeConsumeForTests();
    expect(consumeLiveDemoResumeOnce()).toBe(true);
  });
});
