import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import { GRPC_DEMO_MESSAGE } from './constants';
import { setGrpcLessonRunFlag } from '../grpc-lesson-contract/runtime';
import { closeGrpcSettingsDrawerQuiet } from './navigation';
import { ensureEchoMessageFilled } from './echoComposer';

export async function ensureUnaryExecuted(
  ctx: DemoActionContext,
  message = GRPC_DEMO_MESSAGE,
): Promise<void> {
  const responseBody = document.querySelector<HTMLElement>(GRPC.RESPONSE_BODY);
  if (responseBody?.textContent?.includes(message)) {
    setGrpcLessonRunFlag('executed', true);
    return;
  }

  await ensureEchoMessageFilled(ctx, message);

  const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
  if (sendBtn && !sendBtn.disabled) {
    await ctx.click(GRPC.SEND_BTN);
  }

  // ctx.waitFor never throws — it silently resolves at timeout.
  // Use a single 7 s window for status + 4 s for body so the caller's
  // action stays well under the 16 s DEMO_ACTION_TIMEOUT_MS.
  await ctx.waitFor(GRPC.RESPONSE_STATUS, 7_000);
  await ctx.waitFor(GRPC.RESPONSE_BODY, 4_000);
  await ctx.delay(300);
  setGrpcLessonRunFlag('executed', true);
}

export async function guardUnaryExecutedQuiet(ctx: DemoActionContext): Promise<void> {
  const body = document.querySelector<HTMLElement>(GRPC.RESPONSE_BODY);
  if (body?.textContent?.includes(GRPC_DEMO_MESSAGE)) {
    setGrpcLessonRunFlag('executed', true);
    return;
  }
  await ensureUnaryExecuted(ctx);
}

/** Open History and select the latest call row so the detail pane is populated. */
export async function openFirstGrpcHistoryEntry(
  ctx: DemoActionContext,
  options?: { ensureExecuted?: boolean },
): Promise<void> {
  if (options?.ensureExecuted !== false) {
    await ensureUnaryExecuted(ctx);
  }
  await closeGrpcSettingsDrawerQuiet(ctx);
  const historyBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_HISTORY);
  if (historyBtn && historyBtn.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GRPC.SUB_NAV_HISTORY);
  }
  await ctx.waitFor(GRPC.HISTORY_PANEL, 5_000);
  await ctx.waitFor(GRPC.HISTORY_LIST, 5_000);
  await ctx.waitFor(GRPC.HISTORY_ENTRY_ROW, 5_000);
  await ctx.delay(150);
  await ctx.click(GRPC.HISTORY_ENTRY_ROW);
  await ctx.waitFor(GRPC.HISTORY_REPLAY_BTN, 5_000);
  await ctx.delay(250);
}
