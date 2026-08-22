/**
 * E2E fast mode — collapses lesson pacing to a tick.
 *
 * Lesson beats are authored for a human viewer (ring holds, payoff pauses, pre-Run
 * breaths). Replaying them at presentation speed makes a 7-step walk take minutes
 * while asserting nothing extra, so Playwright sets this flag before the app boots.
 *
 * Kept as a dependency-free leaf so E2E specs can import the key without pulling the
 * demo-hub module graph (Monaco et al.) into Playwright's Node loader.
 */
export const DEMO_E2E_FAST_MODE_KEY = '__REDFIRE_DEMO_E2E_FAST__';

/** Ceiling for any paced delay under fast mode — long enough for the DOM to settle. */
export const DEMO_E2E_FAST_DELAY_MS = 30;

export function isDemoE2EFastMode(): boolean {
  return typeof window !== 'undefined'
    && (window as unknown as Record<string, unknown>)[DEMO_E2E_FAST_MODE_KEY] === true;
}

/** Clamp a paced delay when fast mode is on; otherwise pass it through. */
export function clampDemoPacing(ms: number): number {
  return isDemoE2EFastMode() ? Math.min(ms, DEMO_E2E_FAST_DELAY_MS) : ms;
}
