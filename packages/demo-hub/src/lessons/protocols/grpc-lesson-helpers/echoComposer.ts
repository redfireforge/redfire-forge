import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import {
  GRPC_DEMO_MESSAGE,
  GRPC_ECHO_METHOD,
  GRPC_ECHO_METHOD_SEL,
  GRPC_ECHO_SERVICE_SEL,
  grpcLessonSession,
} from './constants';
import { setGrpcLessonRunFlag } from '../grpc-lesson-contract/runtime';
import { setInputValueAndDispatch } from './dom';
import { patchGrpcActiveTabBody } from '../../../adapters';
import { ensureGrpcReflected } from './reflection';

export async function ensureGrpcRequestFormTabQuiet(ctx: DemoActionContext): Promise<void> {
  const formTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
  if (formTab && formTab.getAttribute('aria-pressed') !== 'true') {
    formTab.click();
    await ctx.delay(150);
  }
}

/** Unary hybrid mode — Form Input tab shows compact JSON instead of proto rows. */
export function isGrpcHybridComposerActive(): boolean {
  return Boolean(document.querySelector(GRPC.REQUEST_JSON_COMPACT));
}

export function grpcEchoComposerFieldSelector(): string {
  return isGrpcHybridComposerActive() ? GRPC.REQUEST_JSON : GRPC.PROTO_FIELD_INPUT_MESSAGE;
}

export function isGrpcEchoComposerReady(): boolean {
  const methodLabel = document.querySelector(GRPC.CALL_METHOD_NAME)?.textContent ?? '';
  if (!methodLabel.includes(GRPC_ECHO_METHOD)) return false;
  return Boolean(
    document.querySelector(GRPC.PROTO_FIELD_INPUT_MESSAGE)
      || document.querySelector(GRPC.REQUEST_JSON),
  );
}

function echoMessageJsonBody(message: string): string {
  return JSON.stringify({ message }, null, 2);
}

export async function ensureEchoMethodSelected(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcReflected(ctx);

  if (grpcLessonSession.methodSelected && isGrpcEchoComposerReady()) {
    await ensureGrpcRequestFormTabQuiet(ctx);
    return;
  }

  const methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL);
  if (!methodBtn) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      await ctx.delay(400);
    }
  }

  await ctx.waitFor(GRPC_ECHO_METHOD_SEL, 10_000);
  await ctx.click(GRPC_ECHO_METHOD_SEL);
  await ctx.waitFor(GRPC.REQUEST_FORM_SCROLL, 10_000);
  await ensureGrpcRequestFormTabQuiet(ctx);
  await ctx.waitFor(grpcEchoComposerFieldSelector(), 10_000);
  await ctx.delay(400);
  setGrpcLessonRunFlag('methodSelected', true);
}

export async function fillGrpcEchoMessage(
  ctx: DemoActionContext,
  message = GRPC_DEMO_MESSAGE,
): Promise<void> {
  await ensureGrpcRequestFormTabQuiet(ctx);
  const json = echoMessageJsonBody(message);
  if (isGrpcHybridComposerActive()) {
    const textarea = document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON);
    if (textarea?.value.trim() === json.trim()) {
      patchGrpcActiveTabBody(json);
      setGrpcLessonRunFlag('messageFilled', true);
      return;
    }
    if (textarea) {
      setInputValueAndDispatch(textarea, json);
    } else {
      await ctx.waitFor(GRPC.REQUEST_JSON, 8_000);
      await ctx.fill(GRPC.REQUEST_JSON, json);
    }
  } else {
    await ctx.waitFor(GRPC.PROTO_FIELD_INPUT_MESSAGE, 10_000);
    const field = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT_MESSAGE);
    if (field?.value === message) {
      patchGrpcActiveTabBody(json);
      setGrpcLessonRunFlag('messageFilled', true);
      return;
    }
    await ctx.fill(GRPC.PROTO_FIELD_INPUT_MESSAGE, message);
    if (field && field.value !== message) {
      setInputValueAndDispatch(field, message);
    }
  }
  // Ensure the tab's React state carries the body regardless of whether
  // handleJsonChange's `method` guard allowed the onChange to propagate.
  patchGrpcActiveTabBody(json);
  await ctx.delay(400);
  setGrpcLessonRunFlag('messageFilled', true);
}

export async function ensureEchoMessageFilled(
  ctx: DemoActionContext,
  message = GRPC_DEMO_MESSAGE,
): Promise<void> {
  await ensureEchoMethodSelected(ctx);
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(grpcEchoComposerFieldSelector());
  const expected = isGrpcHybridComposerActive() ? echoMessageJsonBody(message) : message;
  if (grpcLessonSession.messageFilled && field?.value.trim() === expected.trim()) {
    return;
  }
  await fillGrpcEchoMessage(ctx, message);
}

/** Fill the request JSON editor (always inside the Form Input tab in hybrid mode). */
export async function fillGrpcRequestJsonBody(ctx: DemoActionContext, jsonBody: string): Promise<void> {
  await ensureGrpcRequestFormTabQuiet(ctx);
  const jsonEditor = document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON);
  const normalized = jsonBody.trim();
  if (jsonEditor?.value.trim() === normalized) return;
  if (jsonEditor) {
    setInputValueAndDispatch(jsonEditor, jsonBody);
  } else {
    await ctx.waitFor(GRPC.REQUEST_JSON, 8_000);
    await ctx.fill(GRPC.REQUEST_JSON, jsonBody);
  }
  await ctx.delay(400);
}

export async function guardEchoMethodQuiet(ctx: DemoActionContext): Promise<void> {
  if (isGrpcEchoComposerReady()) {
    await ensureGrpcRequestFormTabQuiet(ctx);
    setGrpcLessonRunFlag('methodSelected', true);
    return;
  }
  await ensureEchoMethodSelected(ctx);
}
