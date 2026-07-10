/** GRPC-15 Spring Boot — navigation, transport, and quiet helpers */
import { GRPC } from '@shared/selectors';
import { GRPC_SPRING_FIXTURE_SERVLET_TARGET } from '../../adapters';
import {
  GRPC_DEMO_MESSAGE,
  GRPC_ECHO_SERVICE,
  GRPC_ECHO_SERVICE_SEL,
  GRPC_ECHO_METHOD_SEL,
  closeGrpcSettingsDrawerQuiet,
  ensureGrpcStudioSubNavQuiet,
  openGrpcSettingsDrawerQuiet,
  resetGrpcConnectionSettingsQuiet,
  setGrpcTargetQuiet,
  spotlightAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import type { DemoActionContext } from '../../types';

export const GRPC_SPRING_NETTY_TARGET = 'localhost:9090';
export const GRPC_SPRING_SERVLET_TARGET = GRPC_SPRING_FIXTURE_SERVLET_TARGET;
export const GRPC_SECURE_ECHO_METHOD = 'SecureEcho';
export const GRPC_SECURE_ECHO_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_SECURE_ECHO_METHOD);
export const DEMO_BEARER_TOKEN = 'demo-secret-token';
export const DEMO_GRPC_HOST_VAR = '{{grpcHost}}';

export type TransportMode = 'express' | 'tauri' | 'grpc-web' | 'spring-servlet';

export async function ensureStudioNav(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

export async function ensureMessageFilledQuiet(ctx: DemoActionContext, message = GRPC_DEMO_MESSAGE): Promise<void> {
  const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
  if (!field || field.value.trim() === message) return;
  field.focus();
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (nativeSet?.set) {
    nativeSet.set.call(field, message);
  } else {
    field.value = message;
  }
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await ctx.delay(150);
}

export function isTransportModeActive(mode: TransportMode): boolean {
  const btn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE(mode));
  return btn?.getAttribute('aria-pressed') === 'true';
}

/** Quietly select `mode` in the Transport panel — opens/closes the drawer only if needed. */
export async function ensureTransportModeQuiet(ctx: DemoActionContext, mode: TransportMode): Promise<void> {
  await openGrpcSettingsDrawerQuiet(ctx, 'transport');
  if (!document.querySelector(GRPC.TRANSPORT_PANEL)) return;
  if (!isTransportModeActive(mode)) {
    const btn = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE(mode));
    if (btn && !btn.disabled) {
      btn.click();
      await ctx.delay(250);
    }
  }
  await closeGrpcSettingsDrawerQuiet(ctx);
}

// ---------------------------------------------------------------------------
// Reflect + method selection against an arbitrary Spring target (the shared
// grpc-lesson-helpers reflect/select helpers hard-code the Go echo target).
// ---------------------------------------------------------------------------

export async function reflectQuiet(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.EXPLORER_TREE)) return;
  const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  if (reflectBtn && !reflectBtn.disabled) {
    reflectBtn.click();
  }
  try {
    await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
  } catch {
    // Best-effort — infra may be temporarily unavailable in test stubs.
  }
  await ctx.delay(350);
}

export async function selectMethodQuiet(ctx: DemoActionContext, methodSel: string): Promise<void> {
  await reflectQuiet(ctx);
  if (!document.querySelector(methodSel)) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      serviceBtn.click();
      await ctx.delay(350);
    }
  }
  const methodBtn = document.querySelector<HTMLElement>(methodSel);
  if (methodBtn) {
    methodBtn.click();
    try {
      await ctx.waitFor(GRPC.PROTO_FORM, 8_000);
    } catch {
      await ctx.delay(400);
    }
  }
  await ensureMessageFilledQuiet(ctx);
}

/** Visible reflect + method selection (spotlight pacing) for steps that teach it. */
export async function selectMethodVisible(
  ctx: DemoActionContext,
  methodSel: string,
  opts: { reflectFirst?: boolean } = {},
): Promise<void> {
  const { reflectFirst = true } = opts;
  if (reflectFirst) {
    await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 700);
    if (!document.querySelector(GRPC.EXPLORER_TREE)) {
      await ctx.click(GRPC.REFLECT_BTN);
      try {
        await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_ERROR}`, 12_000);
      } catch {
        await ctx.delay(1_500);
      }
      await ctx.delay(400);
    }
    await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 700);
  }

  if (!document.querySelector(methodSel) && document.querySelector(GRPC_ECHO_SERVICE_SEL)) {
    await spotlightAndPause(ctx, GRPC_ECHO_SERVICE_SEL, 600);
    await ctx.click(GRPC_ECHO_SERVICE_SEL);
    try {
      await ctx.waitFor(methodSel, 5_000);
    } catch {
      await ctx.delay(400);
    }
  }
  if (document.querySelector(methodSel)) {
    await spotlightAndPause(ctx, methodSel, 700);
    await ctx.click(methodSel);
    try {
      await ctx.waitFor(GRPC.PROTO_FORM, 8_000);
    } catch {
      await ctx.delay(400);
    }
  }
  await ensureMessageFilledQuiet(ctx);
}

/** Restore the lesson baseline: Express Proxy, Netty target, Echo selected, auth none. */
export async function resetSpringBaselineQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureStudioNav(ctx);
  await resetGrpcConnectionSettingsQuiet(ctx);
  await ensureTransportModeQuiet(ctx, 'express');
  await setGrpcTargetQuiet(ctx, GRPC_SPRING_NETTY_TARGET);
  await selectMethodQuiet(ctx, GRPC_ECHO_METHOD_SEL);
}

// ---------------------------------------------------------------------------
// Auth tab helpers (bearer-only — mirrors the pattern in grpc-metadata-auth.ts)
// ---------------------------------------------------------------------------

export async function openAuthTabQuiet(ctx: DemoActionContext): Promise<void> {
  await closeGrpcSettingsDrawerQuiet(ctx);
  const authTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_AUTH);
  if (authTabBtn && !authTabBtn.disabled) {
    const authTabActive = authTabBtn.getAttribute('aria-pressed') === 'true';
    if (!authTabActive) {
      authTabBtn.click();
      await ctx.delay(150);
    }
  }
}

export async function selectAuthTypeQuiet(ctx: DemoActionContext, type: 'none' | 'bearer'): Promise<void> {
  const authSelect = document.querySelector<HTMLSelectElement>(GRPC.AUTH_TYPE_SELECT);
  if (authSelect && authSelect.value !== type) {
    await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, type);
  }
}

export function bearerTokenFieldValue(): string {
  return document.querySelector<HTMLInputElement>('[data-testid="grpc-auth-bearer-token"]')?.value.trim() ?? '';
}

export function fillBearerTokenField(value: string): void {
  const input = document.querySelector<HTMLInputElement>('[data-testid="grpc-auth-bearer-token"]');
  if (!input || input.disabled) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------------------------------------------------------------------------
// Manage Schemas modal helpers (mirrors grpc-schema-discovery.ts)
// ---------------------------------------------------------------------------

export async function ensureManageModalOpen(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return;
  await ctx.waitFor(GRPC.MANAGE_SCHEMAS_BTN, 10_000);
  await ctx.click(GRPC.MANAGE_SCHEMAS_BTN);
  await ctx.waitFor(GRPC.PROTO_MANAGE_MODAL, 10_000);
  await ctx.delay(350);
}

export async function ensureManageModalClosed(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return;
  await ctx.click(GRPC.PROTO_CANCEL_BTN);
  await ctx.delay(350);
}
