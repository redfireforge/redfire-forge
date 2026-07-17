/** Sync live-demo presence to the Vite dev guard endpoint (dev only). */
import type { DemoLiveGuardState } from './demoLiveGuardPolicy';
import { DEMO_LIVE_GUARD_HEARTBEAT_MS, normalizeDemoLiveGuardLessonId } from './demoLiveGuardPolicy';

export { DEMO_LIVE_GUARD_HEARTBEAT_MS } from './demoLiveGuardPolicy';

export const DEMO_LIVE_GUARD_ENDPOINT = '/__demo-live-guard';

/** Vitest hook — compile-time env inlining prevents vi.stubEnv from reaching readViteEnv. */
let demoLiveGuardEnvOverride: { mode?: string; dev?: boolean } | undefined;

export function setDemoLiveGuardEnvForTests(next?: { mode?: string; dev?: boolean }): void {
  demoLiveGuardEnvOverride = next;
}

/** Set by Phase 8 E2E via addInitScript — belt-and-suspenders when webdriver is masked. */
export const PHASE8_E2E_GUARD_BYPASS_KEY = '__PHASE8_E2E_SWEEP__';

function readViteEnv(): { mode?: string; dev?: boolean } {
  if (demoLiveGuardEnvOverride) return demoLiveGuardEnvOverride;
  if (typeof import.meta === 'undefined') return {};
  const env = (import.meta as ImportMeta & { env?: Record<string, boolean | string | undefined> }).env;
  if (!env) return {};
  const mode = env['MODE'] as string | undefined;
  const devRaw = env['DEV'] as boolean | string | undefined;
  const dev = devRaw === true || devRaw === 'true';
  return { mode, dev };
}

/** Playwright / WebDriver sessions walk live demos — must not block Phase 8 server resets. */
export function isAutomatedDemoBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !!(navigator as Navigator & { webdriver?: boolean }).webdriver;
}

export function isPhase8E2eBrowser(): boolean {
  const win = (globalThis as unknown as { window?: Record<string, unknown> }).window;
  if (!win) return false;
  return !!win[PHASE8_E2E_GUARD_BYPASS_KEY];
}

export function shouldSyncDemoLiveGuard(): boolean {
  if (typeof fetch === 'undefined') return false;
  if (isAutomatedDemoBrowser()) return false;
  if (isPhase8E2eBrowser()) return false;
  const { mode, dev } = readViteEnv();
  if (mode === 'test') return false;
  return dev === true;
}

/** Heartbeat interval is disabled under Vitest fake timers. */
export function shouldRunDemoLiveGuardHeartbeat(): boolean {
  return shouldSyncDemoLiveGuard();
}

function buildGuardPayload(
  active: boolean,
  meta?: Pick<DemoLiveGuardState, 'lessonId'>,
): DemoLiveGuardState | null {
  const lessonId = normalizeDemoLiveGuardLessonId(meta?.lessonId);
  if (active && !lessonId) return null;
  return {
    active,
    lessonId,
    updatedAt: Date.now(),
    source: 'manual',
  };
}

async function postDemoLiveGuard(
  payload: DemoLiveGuardState,
  init?: Pick<RequestInit, 'keepalive'>,
): Promise<boolean> {
  if (!shouldSyncDemoLiveGuard()) return false;
  try {
    const res = await fetch(DEMO_LIVE_GUARD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: init?.keepalive,
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') ?? '';
    return contentType.includes('application/json');
  } catch {
    return false;
  }
}

export async function syncDemoLiveGuard(
  active: boolean,
  meta?: Pick<DemoLiveGuardState, 'lessonId'>,
): Promise<boolean> {
  const payload = buildGuardPayload(active, meta);
  if (!payload) return false;
  return postDemoLiveGuard(payload);
}

/** Start guard heartbeat; returned cleanup clears the guard. */
export function startDemoLiveGuardHeartbeat(lessonId: string): () => void {
  void syncDemoLiveGuard(true, { lessonId });
  if (!shouldRunDemoLiveGuardHeartbeat() || typeof globalThis.setInterval !== 'function') {
    return () => { void syncDemoLiveGuard(false); };
  }
  const heartbeat = globalThis.setInterval(() => {
    void syncDemoLiveGuard(true, { lessonId });
  }, DEMO_LIVE_GUARD_HEARTBEAT_MS);
  return () => {
    globalThis.clearInterval(heartbeat);
    void syncDemoLiveGuard(false);
  };
}
