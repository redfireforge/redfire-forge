/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearDemoLiveSession,
  consumeLiveDemoResumeOnce,
  persistDemoLiveSession,
  readDemoLiveSession,
  resetLiveDemoResumeConsumeForTests,
  hasRestorableDemoLiveSession,
  setDemoLiveSessionHmrRuntimeForTests,
  DEMO_LIVE_SESSION_KEY,
  DEMO_LIVE_SESSION_MAX_AGE_MS,
} from './demoLiveSession';

describe('demoLiveSession — coverage gaps', () => {
  afterEach(() => {
    sessionStorage.clear();
    resetLiveDemoResumeConsumeForTests();
    setDemoLiveSessionHmrRuntimeForTests(undefined);
    vi.restoreAllMocks();
  });

  it('readDemoLiveSession returns null for invalid JSON', () => {
    sessionStorage.setItem('redfire-demo-live-session-v1', '{not-json');
    expect(readDemoLiveSession()).toBeNull();
  });

  it('readDemoLiveSession returns null when lessonId missing', () => {
    sessionStorage.setItem('redfire-demo-live-session-v1', JSON.stringify({ stepIndex: 0, savedAt: Date.now() }));
    expect(readDemoLiveSession()).toBeNull();
  });

  it('readDemoLiveSession returns null when stepIndex is not a number', () => {
    sessionStorage.setItem('redfire-demo-live-session-v1', JSON.stringify({
      lessonId: 'x',
      stepIndex: 'bad',
      savedAt: Date.now(),
    }));
    expect(readDemoLiveSession()).toBeNull();
  });

  it('persistDemoLiveSession swallows quota errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => persistDemoLiveSession({
      lessonId: 'x',
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    })).not.toThrow();
  });

  it('clearDemoLiveSession swallows removeItem errors', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => clearDemoLiveSession()).not.toThrow();
  });

  it('readDemoLiveSession normalizes optional fields', () => {
    persistDemoLiveSession({
      lessonId: 'gql-first-query',
      stepIndex: 2,
      isPlaying: true,
      speed: 1,
      savedAt: Date.now(),
    });
    const session = readDemoLiveSession();
    expect(session?.isPlaying).toBe(true);
    expect(session?.speed).toBe(1);
  });

  it('readDemoLiveSession defaults isPlaying to false when omitted', () => {
    sessionStorage.setItem(DEMO_LIVE_SESSION_KEY, JSON.stringify({
      lessonId: 'gql-first-query',
      stepIndex: 0,
      savedAt: Date.now(),
    }));
    expect(readDemoLiveSession()?.isPlaying).toBe(false);
  });

  it('consumeLiveDemoResumeOnce uses module guard outside HMR', () => {
    resetLiveDemoResumeConsumeForTests();
    expect(consumeLiveDemoResumeOnce()).toBe(true);
    expect(consumeLiveDemoResumeOnce()).toBe(false);
  });

  it('readDemoLiveSession returns null when session is expired', () => {
    sessionStorage.setItem(DEMO_LIVE_SESSION_KEY, JSON.stringify({
      lessonId: 'gql-first-query',
      stepIndex: 1,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now() - DEMO_LIVE_SESSION_MAX_AGE_MS - 1000,
    }));
    expect(readDemoLiveSession()).toBeNull();
    expect(sessionStorage.getItem(DEMO_LIVE_SESSION_KEY)).toBeNull();
  });

  it('readDemoLiveSession returns null when storage is empty', () => {
    expect(readDemoLiveSession()).toBeNull();
  });

  it('hasRestorableDemoLiveSession reflects persisted session', () => {
    expect(hasRestorableDemoLiveSession()).toBe(false);
    persistDemoLiveSession({
      lessonId: 'gql-first-query',
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    expect(hasRestorableDemoLiveSession()).toBe(true);
  });

  it('consumeLiveDemoResumeOnce uses HMR hot data when available', () => {
    resetLiveDemoResumeConsumeForTests();
    const hotData: { liveDemoResumeConsumed?: boolean } = {};
    Object.defineProperty(import.meta, 'hot', {
      value: { data: hotData },
      configurable: true,
    });
    setDemoLiveSessionHmrRuntimeForTests(true);
    expect(consumeLiveDemoResumeOnce()).toBe(true);
    expect(consumeLiveDemoResumeOnce()).toBe(false);
    resetLiveDemoResumeConsumeForTests();
  });

  it('readDemoLiveSession returns null when savedAt is missing', () => {
    sessionStorage.setItem(DEMO_LIVE_SESSION_KEY, JSON.stringify({
      lessonId: 'gql-first-query',
      stepIndex: 0,
    }));
    expect(readDemoLiveSession()).toBeNull();
  });

  it('consumeLiveDemoResumeOnce initializes HMR hot data when missing', () => {
    resetLiveDemoResumeConsumeForTests();
    Object.defineProperty(import.meta, 'hot', {
      value: { data: undefined },
      configurable: true,
    });
    setDemoLiveSessionHmrRuntimeForTests(true);
    expect(consumeLiveDemoResumeOnce()).toBe(true);
    expect(consumeLiveDemoResumeOnce()).toBe(false);
    resetLiveDemoResumeConsumeForTests();
    setDemoLiveSessionHmrRuntimeForTests(undefined);
  });
});
