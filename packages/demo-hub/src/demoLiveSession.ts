/** Persist in-progress live demo state across page reload / HMR (sessionStorage). */
import type { SpeedMultiplier } from './types';

export const DEMO_LIVE_SESSION_KEY = 'redfire-demo-live-session-v1';

/** Max age before an interrupted session is discarded (6 hours). */
export const DEMO_LIVE_SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface DemoLiveSession {
  lessonId: string;
  stepIndex: number;
  isPlaying: boolean;
  speed: SpeedMultiplier;
  savedAt: number;
}

export function persistDemoLiveSession(session: DemoLiveSession): void {
  try {
    sessionStorage.setItem(DEMO_LIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function readDemoLiveSession(): DemoLiveSession | null {
  try {
    const raw = sessionStorage.getItem(DEMO_LIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoLiveSession>;
    if (!parsed.lessonId || typeof parsed.stepIndex !== 'number') return null;
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > DEMO_LIVE_SESSION_MAX_AGE_MS) {
      clearDemoLiveSession();
      return null;
    }
    return {
      lessonId: parsed.lessonId,
      stepIndex: parsed.stepIndex,
      isPlaying: !!parsed.isPlaying,
      speed: (parsed.speed ?? 1) as SpeedMultiplier,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearDemoLiveSession(): void {
  try {
    sessionStorage.removeItem(DEMO_LIVE_SESSION_KEY);
  } catch {
    /* noop */
  }
}

export function hasRestorableDemoLiveSession(): boolean {
  return readDemoLiveSession() !== null;
}

/** Module-level guard for non-HMR environments (production / vitest). */
let resumeConsumedThisPageLoad = false;

function isViteDevHmrRuntime(): boolean {
  return typeof import.meta !== 'undefined'
    && !!import.meta.hot
    && import.meta.env?.MODE !== 'test';
}

/**
 * Returns true the first time per real page load (or first HMR mount after reload).
 * Vite HMR re-executes modules without a full navigation — without this guard,
 * resumeInterruptedLiveDemo would re-run lesson setup on every hot update and feel
 * like repeated hard refreshes during live demos.
 */
export function consumeLiveDemoResumeOnce(): boolean {
  if (isViteDevHmrRuntime()) {
    const hotModule = import.meta.hot as unknown as {
      data: { liveDemoResumeConsumed?: boolean };
    };
    if (!hotModule.data) hotModule.data = {};
    const hotData = hotModule.data;
    if (hotData.liveDemoResumeConsumed) return false;
    hotData.liveDemoResumeConsumed = true;
    return true;
  }
  if (resumeConsumedThisPageLoad) return false;
  resumeConsumedThisPageLoad = true;
  return true;
}

/** Test helper — vitest reuses the module graph across tests. */
export function resetLiveDemoResumeConsumeForTests(): void {
  resumeConsumedThisPageLoad = false;
  if (typeof import.meta !== 'undefined' && import.meta.hot) {
    const hotData = import.meta.hot.data as { liveDemoResumeConsumed?: boolean } | undefined;
    if (hotData) hotData.liveDemoResumeConsumed = false;
  }
}
