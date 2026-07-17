import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import { navigateToGrpcStudio } from '../../env-manager-lesson-helpers';
import { GRPC_DEMO_TARGET, grpcLessonSession } from './constants';
import { setGrpcLessonRunFlag } from '../grpc-lesson-contract/runtime';
import { setInputValueAndDispatch } from './dom';
import { closeGrpcSettingsDrawerQuiet, ensureGrpcStudioSubNavQuiet } from './navigation';

export async function ensureGrpcTarget(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
  await ctx.waitFor(GRPC.TARGET_INPUT, 10_000);

  const input = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
  if (grpcLessonSession.targetSet && input?.value.trim() === GRPC_DEMO_TARGET) {
    if (document.querySelector(GRPC.TARGET_STATUS_OK)) return;
  }

  await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);

  // Fallback path: some runtime states can ignore synthetic fill calls.
  // Force native input/change events so React state is updated deterministically.
  if (!document.querySelector(GRPC.TARGET_STATUS_OK)) {
    const targetInput = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
    if (targetInput) {
      targetInput.focus();
      targetInput.value = GRPC_DEMO_TARGET;
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      targetInput.blur();
    }
  }

  try {
    await ctx.waitFor(GRPC.TARGET_STATUS_OK, 6_000);
  } catch {
    // Keep lesson flow responsive even when local endpoint interpolation/config
    // prevents target validation from reaching OK.
    return;
  }
  await ctx.delay(500);
  setGrpcLessonRunFlag('targetSet', true);
}

/**
 * Quietly reset auth → none.
 * Called during lesson setup and cleanup so leftover auth config
 * (e.g. OAuth2 from a previous lesson) does not bleed into a new lesson.
 * Auth is in the call-panel Auth tab — the settings drawer is not opened.
 * TLS is managed per-lesson via the TLS badge modal.
 */
export async function resetGrpcConnectionSettingsQuiet(ctx: DemoActionContext): Promise<void> {
  // Close the settings drawer if it happens to be open (auth and TLS have moved
  // out of the settings drawer — no need to open it just to reset them).
  await closeGrpcSettingsDrawerQuiet(ctx);

  // Reset auth → none via the call-panel Auth tab (auth moved out of settings drawer).
  const authBadgeText = document.querySelector<HTMLElement>(GRPC.AUTH_BADGE)?.textContent ?? '';
  if (!/\bnone\b/i.test(authBadgeText)) {
    try {
      const authTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_AUTH);
      if (authTabBtn && !authTabBtn.disabled && authTabBtn.getAttribute('aria-pressed') !== 'true') {
        authTabBtn.click();
        await ctx.delay(150);
      }
      const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
      if (authSelect && authSelect.value !== 'none') {
        await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, 'none');
        await ctx.delay(200);
      }
    } catch {
      // Best-effort — do not block lesson progression on auth UI drift.
    }
  }
}

/** Quietly set the connection target without viewer ripple (preAction / guards). */
export async function setGrpcTargetQuiet(ctx: DemoActionContext, target: string): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  const input = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
  if (!input) return;
  if (input.value.trim() === target.trim()) return;
  setInputValueAndDispatch(input, target);
  await ctx.delay(250);
  if (target.trim() === GRPC_DEMO_TARGET) {
    setGrpcLessonRunFlag('targetSet', true);
  }
}

export async function guardGrpcTargetQuiet(ctx: DemoActionContext): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
  if (input?.value.trim() === GRPC_DEMO_TARGET && document.querySelector(GRPC.TARGET_STATUS_OK)) {
    setGrpcLessonRunFlag('targetSet', true);
    return;
  }
  await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
  try {
    await ctx.waitFor(GRPC.TARGET_STATUS_OK, 4_000);
  } catch {
    // Target validation may lag — action step will retry visibly.
  }
  setGrpcLessonRunFlag('targetSet', true);
}
