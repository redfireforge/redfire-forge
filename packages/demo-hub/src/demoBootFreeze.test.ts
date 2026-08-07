/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDemoBootFreeze,
  installDemoBootFreeze,
  revealDemoBootSurface,
  DEMO_BOOT_FREEZE_TESTID,
} from './demoBootFreeze';

describe('demoBootFreeze', () => {
  afterEach(() => {
    document.body.removeAttribute('data-demo-bootstrapping');
    document.body.innerHTML = '';
  });

  it('installDemoBootFreeze sets the bootstrapping attr and paints no cover', () => {
    document.body.innerHTML = `<main class="app-main"><div class="demo-hub"></div></main>`;
    installDemoBootFreeze();
    expect(document.body.getAttribute('data-demo-bootstrapping')).toBe('1');
    // No veil, spinner, or clone — interstitials are themselves a screen the
    // viewer should not see. Transient screens are fixed via initialSurface.
    expect(document.querySelector(`[data-testid="${DEMO_BOOT_FREEZE_TESTID}"]`)).toBeNull();
    expect(document.body.textContent).not.toContain('Preparing lesson');
  });

  it('clearDemoBootFreeze removes any legacy cover nodes', () => {
    const legacy = document.createElement('div');
    legacy.setAttribute('data-testid', DEMO_BOOT_FREEZE_TESTID);
    document.body.appendChild(legacy);
    clearDemoBootFreeze();
    expect(document.querySelector(`[data-testid="${DEMO_BOOT_FREEZE_TESTID}"]`)).toBeNull();
  });

  it('installDemoBootFreeze sweeps a stale cover left by an aborted run', () => {
    const stale = document.createElement('div');
    stale.setAttribute('data-testid', DEMO_BOOT_FREEZE_TESTID);
    document.body.appendChild(stale);
    installDemoBootFreeze();
    expect(document.querySelector(`[data-testid="${DEMO_BOOT_FREEZE_TESTID}"]`)).toBeNull();
  });

  it('revealDemoBootSurface clears bootstrapping attr on the next frame', async () => {
    document.body.setAttribute('data-demo-bootstrapping', '1');
    revealDemoBootSurface();
    expect(document.body.getAttribute('data-demo-bootstrapping')).toBe('1');
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    expect(document.body.getAttribute('data-demo-bootstrapping')).toBeNull();
  });
});
