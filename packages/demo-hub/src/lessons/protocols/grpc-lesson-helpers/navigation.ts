import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';

/** Close connection settings drawer if a prior step left it open. */
export async function closeGrpcSettingsDrawerQuiet(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.SETTINGS_DRAWER)) {
    const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
    if (closeBtn) {
      closeBtn.click();
      await ctx.delay(200);
    }
  }
}

/** Ensure Studio sub-nav is on the main call surface (not Collections/History). */
export async function ensureGrpcStudioSubNavQuiet(ctx: DemoActionContext): Promise<void> {
  const studioBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_STUDIO);
  if (studioBtn && studioBtn.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GRPC.SUB_NAV_STUDIO);
    await ctx.delay(300);
  }
}

/** Open History sub-nav without viewer ripple (preAction / guards). */
export async function openGrpcHistoryPanelQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const historyBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_HISTORY);
  if (historyBtn && historyBtn.getAttribute('aria-selected') !== 'true') {
    historyBtn.click();
    await ctx.delay(220);
  }
  try {
    await ctx.waitFor(GRPC.HISTORY_PANEL, 2_500);
  } catch {
    // History panel may be unavailable when storage is empty — caller handles entry wait.
  }
}

/** Open connection settings drawer on a nav tab without viewer ripple. */
export async function openGrpcSettingsDrawerQuiet(
  ctx: DemoActionContext,
  nav?: 'call' | 'compression' | 'health' | 'k8s' | 'transport' | 'tls' | 'auth',
): Promise<void> {
  const settingsBtn = document.querySelector<HTMLButtonElement>(GRPC.CONNECTION_SETTINGS_BTN);
  if (!settingsBtn || settingsBtn.disabled) return;

  if (!document.querySelector(GRPC.SETTINGS_DRAWER)) {
    settingsBtn.click();
    try {
      await ctx.waitFor(GRPC.SETTINGS_DRAWER, 5_000);
    } catch {
      return;
    }
    await ctx.delay(300);
  }

  if (!nav) return;

  const navSel = GRPC.SETTINGS_NAV_ITEM(nav);
  if (!document.querySelector(navSel)) return;
  const navBtn = document.querySelector<HTMLElement>(navSel);
  navBtn?.click();
  try {
    await ctx.waitFor(GRPC.SETTINGS_PANEL(nav), 3_000);
  } catch {
    // Panel may be unavailable when settings are locked.
  }
  await ctx.delay(250);
}
