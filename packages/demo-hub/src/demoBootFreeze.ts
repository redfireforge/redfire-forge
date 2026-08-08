/**
 * Live-demo boot marker.
 *
 * No visual cover — deliberately. Every interstitial tried here (opacity:0
 * `.app-main`, a `--bg` overlay, a blurred DOM clone, an elevated Demo Hub, a
 * Concept portal, a "Preparing lesson…" spinner veil) is itself a screen the
 * viewer should not see between Concept and step 1.
 *
 * The transient screens those covers existed to hide are fixed at the source
 * instead: a lesson declares `initialSurface`, which arms
 * `setDemoInitialSurface()` before the tab-switch commit so the lesson tab
 * mounts directly on step 1's sub-panel. With nothing hopping around after
 * mount, Concept → step 1 is a single clean tab change.
 *
 * The `data-demo-bootstrapping="1"` body attribute stays during boot so:
 * - `isElementVisible` counts opacity-0 descendants as findable
 * - `pointer-events: none` on `.app-main` blocks stray clicks during setup
 */

export const DEMO_BOOT_FREEZE_TESTID = 'demo-boot-freeze';

/** Remove any leftover cover nodes (legacy / emergency). */
export function clearDemoBootFreeze(): void {
  document.querySelectorAll(`[data-testid="${DEMO_BOOT_FREEZE_TESTID}"]`).forEach((el) => el.remove());
}

/** Mark boot. Paints nothing. Returns a no-op disposer for callsite stability. */
export function installDemoBootFreeze(): () => void {
  clearDemoBootFreeze();
  document.body.setAttribute('data-demo-bootstrapping', '1');
  return () => { /* teardown owned by revealDemoBootSurface */ };
}

/** Clear the boot attr on the next frame, once step 1 has committed. */
export function revealDemoBootSurface(): void {
  requestAnimationFrame(() => {
    document.body.removeAttribute('data-demo-bootstrapping');
    clearDemoBootFreeze();
  });
}
