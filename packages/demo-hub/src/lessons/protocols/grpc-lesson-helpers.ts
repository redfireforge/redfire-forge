/** Shared helpers for gRPC Studio demo lessons (GRPC-1+). */
import type { DemoActionContext } from '../../types';
import { GRPC } from '@shared/selectors';
import {
  GRPC_DEMO_DOCKER_COMMAND,
  GRPC_DEMO_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_TARGET,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_STUDIO_LESSON_ALLOWED_TABS as GRPC_STUDIO_LESSON_ALLOWED_TABS_VALUES,
} from '../../adapters';
import {
  getGrpcLessonRunFlags,
  setGrpcLessonRunFlag,
} from './grpc-lesson-contract/runtime';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

export {
  GRPC_DEMO_TARGET,
  GRPC_DEMO_HEALTH_URL,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_DOCKER_COMMAND,
};

export const GRPC_STUDIO_LESSON_ALLOWED_TABS = GRPC_STUDIO_LESSON_ALLOWED_TABS_VALUES;

export const GRPC_ECHO_SERVICE = 'echo.EchoService';
export const GRPC_ECHO_METHOD = 'Echo';
export const GRPC_DEMO_MESSAGE = 'Hello from gRPC Studio';

export const GRPC_ECHO_SERVICE_SEL = GRPC.SERVICE(GRPC_ECHO_SERVICE);
export const GRPC_ECHO_METHOD_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_ECHO_METHOD);

export const grpcLessonSession = {
  get targetSet() {
    return getGrpcLessonRunFlags().targetSet;
  },
  get reflected() {
    return getGrpcLessonRunFlags().reflected;
  },
  get methodSelected() {
    return getGrpcLessonRunFlags().methodSelected;
  },
  get messageFilled() {
    return getGrpcLessonRunFlags().messageFilled;
  },
  get executed() {
    return getGrpcLessonRunFlags().executed;
  },
};

export function resetGrpcLessonSessionFlags(): void {
  setGrpcLessonRunFlag('targetSet', false);
  setGrpcLessonRunFlag('reflected', false);
  setGrpcLessonRunFlag('methodSelected', false);
  setGrpcLessonRunFlag('messageFilled', false);
  setGrpcLessonRunFlag('executed', false);
}

/** Close connection settings drawer if a prior step left it open. */
export async function closeGrpcSettingsDrawerQuiet(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.SETTINGS_DRAWER)) {
    const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
    if (closeBtn) {
      closeBtn.click();
      await ctx.delay(400);
    }
  }
}

/** Ensure Studio sub-nav is on the main call surface (not Collections/History). */
export async function ensureGrpcStudioSubNavQuiet(ctx: DemoActionContext): Promise<void> {
  const studioBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_STUDIO);
  if (studioBtn && studioBtn.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GRPC.SUB_NAV_STUDIO);
    await ctx.delay(600);
  }
}

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
  await ctx.waitFor(GRPC.TARGET_STATUS_OK, 10_000);
  await ctx.delay(500);
  setGrpcLessonRunFlag('targetSet', true);
}

export async function ensureGrpcReflected(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcTarget(ctx);
  if (grpcLessonSession.reflected && document.querySelector(GRPC.EXPLORER_TREE)) {
    return;
  }

  const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  if (reflectBtn && !reflectBtn.disabled) {
    await ctx.click(GRPC.REFLECT_BTN);
  }
  await ctx.waitFor(GRPC.EXPLORER_TREE, 30_000);
  await ctx.delay(800);
  setGrpcLessonRunFlag('reflected', true);
}

export async function ensureEchoMethodSelected(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcReflected(ctx);

  if (
    grpcLessonSession.methodSelected
    && document.querySelector(GRPC.PROTO_FORM)
    && document.querySelector(GRPC_ECHO_METHOD_SEL)
  ) {
    return;
  }

  const methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL);
  if (!methodBtn) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      await ctx.delay(500);
    }
  }

  await ctx.waitFor(GRPC_ECHO_METHOD_SEL, 10_000);
  await ctx.click(GRPC_ECHO_METHOD_SEL);
  await ctx.waitFor(GRPC.PROTO_FORM, 10_000);
  await ctx.delay(600);
  setGrpcLessonRunFlag('methodSelected', true);
}

export async function ensureEchoMessageFilled(
  ctx: DemoActionContext,
  message = GRPC_DEMO_MESSAGE,
): Promise<void> {
  await ensureEchoMethodSelected(ctx);

  const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
  if (grpcLessonSession.messageFilled && field?.value === message) {
    return;
  }

  await ctx.waitFor(GRPC.PROTO_FIELD_INPUT_MESSAGE, 10_000);
  await ctx.fill(GRPC.PROTO_FIELD_INPUT_MESSAGE, message);
  await ctx.delay(500);
  setGrpcLessonRunFlag('messageFilled', true);
}

export async function ensureUnaryExecuted(
  ctx: DemoActionContext,
  message = GRPC_DEMO_MESSAGE,
): Promise<void> {
  await ensureEchoMessageFilled(ctx, message);

  if (grpcLessonSession.executed && document.querySelector(GRPC.RESPONSE_BODY)) {
    const body = document.querySelector(GRPC.RESPONSE_BODY);
    if (body?.textContent?.includes(message)) return;
  }

  const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
  if (sendBtn && !sendBtn.disabled) {
    await ctx.click(GRPC.SEND_BTN);
  }
  await ctx.waitFor(GRPC.RESPONSE_STATUS, 30_000);
  await ctx.waitFor(GRPC.RESPONSE_BODY, 10_000);
  await ctx.delay(800);
  setGrpcLessonRunFlag('executed', true);
}

export async function grpcFirstCallSetup(ctx: DemoActionContext): Promise<void> {
  resetGrpcLessonSessionFlags();
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
  await navigateToGrpcStudio(ctx);
}

export async function grpcFirstCallCleanup(ctx: DemoActionContext): Promise<void> {
  resetGrpcLessonSessionFlags();
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}
