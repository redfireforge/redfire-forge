/** Shared policy for skipping E2E dev-server resets while a manual live demo runs. */

export const DEMO_LIVE_GUARD_FILENAME = 'demo-live-guard.json';

/** Relative to repo root — written by Vite dev middleware, read by shell scripts. */
export const DEMO_LIVE_GUARD_RELATIVE_PATH = `.cursor/${DEMO_LIVE_GUARD_FILENAME}`;

/** Heartbeat interval in the browser (see useDemoHub). */
export const DEMO_LIVE_GUARD_HEARTBEAT_MS = 30_000;

/**
 * If no heartbeat for this long, treat the guard as stale (tab closed / crash).
 * Must be greater than DEMO_LIVE_GUARD_HEARTBEAT_MS.
 */
export const DEMO_LIVE_GUARD_STALE_MS = 120_000;

export interface DemoLiveGuardState {
  active: boolean;
  lessonId?: string;
  updatedAt: number;
  /** Only `manual` blocks E2E server resets. */
  source?: 'manual' | 'e2e';
}

export function parseDemoLiveGuardState(raw: unknown): DemoLiveGuardState | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<DemoLiveGuardState>;
  if (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) return null;
  return {
    active: !!record.active,
    lessonId: normalizeDemoLiveGuardLessonId(record.lessonId),
    updatedAt: record.updatedAt,
    source: record.source === 'manual' || record.source === 'e2e' ? record.source : undefined,
  };
}

export function normalizeDemoLiveGuardLessonId(lessonId: unknown): string | undefined {
  if (typeof lessonId !== 'string') return undefined;
  const trimmed = lessonId.trim();
  return trimmed || undefined;
}

/** State written when the Vite dev server starts and no manual demo is in progress. */
export function createInactiveDemoLiveGuardState(now = Date.now()): DemoLiveGuardState {
  return { active: false, updatedAt: now, source: 'manual' };
}

/** Preserve a fresh manual guard across dev-server restart; otherwise reset inactive. */
export function resolveDevServerStartupGuardState(
  existing: DemoLiveGuardState | null,
  now = Date.now(),
): DemoLiveGuardState {
  if (shouldSkipDevServerResetForDemoGuard(existing, now)) {
    return existing!;
  }
  return createInactiveDemoLiveGuardState(now);
}

/** Returns true when an E2E sweep should NOT kill the Vite dev server on :5173. */
export function shouldSkipDevServerResetForDemoGuard(
  guard: DemoLiveGuardState | null,
  now = Date.now(),
): boolean {
  if (!guard?.active) return false;
  if (guard.source === 'e2e') return false;
  if (!normalizeDemoLiveGuardLessonId(guard.lessonId)) return false;
  if (now - guard.updatedAt > DEMO_LIVE_GUARD_STALE_MS) return false;
  return true;
}

/** Server-side validation for POST /__demo-live-guard payloads. */
export function validateIncomingDemoLiveGuardState(state: DemoLiveGuardState): string | null {
  if (state.active && state.source !== 'e2e' && !normalizeDemoLiveGuardLessonId(state.lessonId)) {
    return 'Active manual guard requires lessonId';
  }
  return null;
}

export type DemoLiveGuardCheckDecision = 'skip-reset' | 'allow-reset';

/**
 * Shell check logic: fast-read file first; confirm with live dev-server state when file claims active.
 */
export function resolveDemoLiveGuardCheckDecision(
  fromFile: DemoLiveGuardState | null,
  fromServer: DemoLiveGuardState | null,
  now = Date.now(),
): DemoLiveGuardCheckDecision {
  if (!shouldSkipDevServerResetForDemoGuard(fromFile, now)) {
    return 'allow-reset';
  }
  const effective = fromServer ?? fromFile;
  return shouldSkipDevServerResetForDemoGuard(effective, now) ? 'skip-reset' : 'allow-reset';
}
