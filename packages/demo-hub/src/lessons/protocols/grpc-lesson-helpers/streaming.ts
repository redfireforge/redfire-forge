import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import { showSpotlightRing } from '../../../demoRipple';
import {
  GRPC_ECHO_SERVICE,
  GRPC_ECHO_SERVICE_SEL,
} from './constants';
import { setInputValueAndDispatch } from './dom';
import { closeGrpcSettingsDrawerQuiet } from './navigation';
import { ensureGrpcReflected, guardGrpcReflectedQuiet } from './reflection';

export const GRPC_SERVER_STREAM_METHOD = 'ServerStream';
export const GRPC_CLIENT_STREAM_METHOD = 'ClientStream';
export const GRPC_BIDI_STREAM_METHOD = 'BidiStream';
export const GRPC_STREAM_MESSAGE = 'stream-demo';
export const GRPC_STREAM_REPEAT_COUNT = 5;
export const GRPC_STREAM_INTERVAL_MS = 300;

export const GRPC_SERVER_STREAM_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_SERVER_STREAM_METHOD);
export const GRPC_CLIENT_STREAM_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_CLIENT_STREAM_METHOD);
export const GRPC_BIDI_STREAM_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_BIDI_STREAM_METHOD);

const CLIENT_STREAM_QUEUE_MESSAGES = ['client-msg-1', 'client-msg-2', 'client-msg-3'];

type StreamingMethodName = 'ServerStream' | 'ClientStream' | 'BidiStream';

const layoutMarkerByMethod: Record<StreamingMethodName, string> = {
  ServerStream: GRPC.STREAM_START_BTN,
  ClientStream: GRPC.STREAM_ADD_QUEUE_BTN,
  BidiStream: GRPC.STREAM_START_BTN,
};

/**
 * Select a streaming method (ServerStream, ClientStream, or BidiStream) from the Service Explorer.
 * Idempotent — skips click if the correct compose/call type panel is already visible.
 */
export async function ensureStreamingMethodSelected(
  ctx: DemoActionContext,
  methodName: StreamingMethodName,
): Promise<void> {
  await ensureGrpcReflected(ctx);

  const methodSel = GRPC.METHOD(GRPC_ECHO_SERVICE, methodName);
  const layoutMarker = layoutMarkerByMethod[methodName];
  const methodHeader = document.querySelector(GRPC.CALL_METHOD_NAME);
  if (methodHeader?.textContent?.includes(methodName) && document.querySelector(layoutMarker)) {
    return;
  }

  // Expand the service node if the method button isn't visible.
  if (!document.querySelector(methodSel)) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL);
    if (serviceBtn) {
      await ctx.click(GRPC_ECHO_SERVICE_SEL);
      await ctx.delay(160);
    }
  }

  await ctx.waitFor(methodSel, 10_000);
  await ctx.click(methodSel);
  await ctx.waitFor(layoutMarker, 8_000);
  await ctx.delay(180);
}

/** Select a streaming method without visible click ripples — for fast preAction guards. */
export async function ensureStreamingMethodSelectedQuiet(
  ctx: DemoActionContext,
  methodName: StreamingMethodName,
): Promise<void> {
  const methodSel = GRPC.METHOD(GRPC_ECHO_SERVICE, methodName);
  const layoutMarker = layoutMarkerByMethod[methodName];
  const methodHeader = document.querySelector(GRPC.CALL_METHOD_NAME);
  if (methodHeader?.textContent?.includes(methodName) && document.querySelector(layoutMarker)) {
    return;
  }

  if (!document.querySelector(methodSel)) {
    document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL)?.click();
    await ctx.delay(100);
  }

  document.querySelector<HTMLElement>(methodSel)?.click();
  try {
    await ctx.waitFor(layoutMarker, 4_000);
  } catch {
    await ctx.delay(150);
  }
}

/**
 * Fill the StreamRequest fields for server-streaming.
 * Fills message, repeat_count, and interval_ms.
 */
export async function fillServerStreamRequest(
  ctx: DemoActionContext,
  opts: { message?: string; repeatCount?: number; intervalMs?: number } = {},
): Promise<void> {
  const { message = GRPC_STREAM_MESSAGE, repeatCount = GRPC_STREAM_REPEAT_COUNT, intervalMs = GRPC_STREAM_INTERVAL_MS } = opts;

  await ctx.waitFor(GRPC.PROTO_FIELD_INPUT('message'), 10_000);
  await ctx.fill(GRPC.PROTO_FIELD_INPUT('message'), message);
  await ctx.delay(120);

  const repeatInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('repeat_count'));
  if (repeatInput) {
    await ctx.fill(GRPC.PROTO_FIELD_INPUT('repeat_count'), String(repeatCount));
    await ctx.delay(120);
  }

  const intervalInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('interval_ms'));
  if (intervalInput) {
    await ctx.fill(GRPC.PROTO_FIELD_INPUT('interval_ms'), String(intervalMs));
    await ctx.delay(120);
  }
}

/** Fill StreamRequest fields without visible fill ripples — idempotent. */
export async function fillServerStreamRequestQuiet(
  ctx: DemoActionContext,
  opts: { message?: string; repeatCount?: number; intervalMs?: number } = {},
): Promise<void> {
  const {
    message = GRPC_STREAM_MESSAGE,
    repeatCount = GRPC_STREAM_REPEAT_COUNT,
    intervalMs = GRPC_STREAM_INTERVAL_MS,
  } = opts;

  const msgEl = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('message'));
  if (msgEl && msgEl.value !== message) {
    setInputValueAndDispatch(msgEl, message);
  }

  const repeatEl = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('repeat_count'));
  if (repeatEl && repeatEl.value !== String(repeatCount)) {
    setInputValueAndDispatch(repeatEl, String(repeatCount));
  }

  const intervalEl = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('interval_ms'));
  if (intervalEl && intervalEl.value !== String(intervalMs)) {
    setInputValueAndDispatch(intervalEl, String(intervalMs));
  }

  await ctx.delay(80);
}

/**
 * Add a single message to the client streaming pending queue.
 * Fills the message field with the given body and clicks Add to queue.
 */
export async function queueClientStreamMessage(
  ctx: DemoActionContext,
  message: string,
): Promise<void> {
  const messageInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('message'));
  if (messageInput) {
    await ctx.fill(GRPC.PROTO_FIELD_INPUT('message'), message);
    await ctx.delay(120);
  }
  const addBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_ADD_QUEUE_BTN);
  if (addBtn && !addBtn.disabled) {
    await ctx.click(GRPC.STREAM_ADD_QUEUE_BTN);
    await ctx.delay(160);
  }
}

/**
 * Queue the three client stream demo messages if the pending panel is empty.
 * Idempotent — skips if items are already queued.
 */
export async function ensureClientStreamQueued(ctx: DemoActionContext): Promise<void> {
  await ensureStreamingMethodSelected(ctx, 'ClientStream');

  // Skip if messages are already queued.
  if (document.querySelector(GRPC.STREAM_PENDING_ITEM(0))) return;

  for (const msg of CLIENT_STREAM_QUEUE_MESSAGES) {
    await queueClientStreamMessage(ctx, msg);
  }

  await ctx.waitFor(GRPC.STREAM_PENDING_ITEM(0), 5_000);
  await ctx.delay(120);
}

/**
 * Draw a sustained spotlight ring on a stream control, hold so the viewer's
 * eye lands on it, click it (with the normal click ripple), then hold on the
 * outcome before moving on.
 */
export async function highlightAndClickStreamControl(
  ctx: DemoActionContext,
  selector: string,
  opts: { holdMs?: number; afterClickMs?: number } = {},
): Promise<boolean> {
  const { holdMs = 1_000, afterClickMs = 900 } = opts;
  const el = document.querySelector<HTMLButtonElement>(selector);
  if (!el || el.disabled) return false;

  const removeRing = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
    await ctx.click(selector);
  } finally {
    removeRing();
  }
  await ctx.delay(afterClickMs);
  return true;
}

/**
 * Walk the full client-stream lifecycle with a sequential spotlight:
 * Start stream → Send all → End stream.
 */
export async function runClientStreamSendLifecycle(ctx: DemoActionContext): Promise<void> {
  await highlightAndClickStreamControl(ctx, GRPC.STREAM_START_BTN, {
    holdMs: 1_100,
    afterClickMs: 900,
  });

  try {
    await ctx.waitFor(GRPC.STREAM_SEND_ALL_BTN, 3_000);
  } catch {
    // Send all may be unavailable if the stream already ended.
  }
  await highlightAndClickStreamControl(ctx, GRPC.STREAM_SEND_ALL_BTN, {
    holdMs: 1_100,
    afterClickMs: 1_200,
  });

  try {
    await ctx.waitFor(GRPC.STREAM_PENDING_END_BTN, 2_000);
  } catch {
    // End button may be absent if the stream already finished.
  }
  await highlightAndClickStreamControl(ctx, GRPC.STREAM_PENDING_END_BTN, {
    holdMs: 1_100,
    afterClickMs: 900,
  });
}

/**
 * Start the bidi stream and send two interleaved messages.
 * The stream must not already be active — check STREAM_CANCEL_BTN before calling.
 */
export async function startAndExchangeBidiStream(ctx: DemoActionContext): Promise<void> {
  await ensureStreamingMethodSelected(ctx, 'BidiStream');

  const startBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_START_BTN);
  if (startBtn && !startBtn.disabled) {
    const removeStartRing = showSpotlightRing(startBtn);
    try {
      await ctx.delay(900);
      await ctx.click(GRPC.STREAM_START_BTN);
    } finally {
      removeStartRing();
    }
    await ctx.delay(400);
  }

  try {
    await ctx.waitFor(GRPC.STREAM_CANCEL_BTN, 6_000);
  } catch {
    // Stream may already be open on retry.
  }

  const sendBidiMessage = async (text: string): Promise<void> => {
    const messageInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('message'));
    if (messageInput) {
      const removeInputRing = showSpotlightRing(messageInput);
      try {
        await ctx.delay(600);
        await ctx.fill(GRPC.PROTO_FIELD_INPUT('message'), text);
        await ctx.delay(400);
      } finally {
        removeInputRing();
      }
    }
    const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_SEND_MESSAGE_BTN);
    if (sendBtn && !sendBtn.disabled) {
      const removeSendRing = showSpotlightRing(sendBtn);
      try {
        await ctx.delay(500);
        await ctx.click(GRPC.STREAM_SEND_MESSAGE_BTN);
      } finally {
        removeSendRing();
      }
      const logEl = document.querySelector<HTMLElement>(GRPC.STREAM_MESSAGE_LOG);
      if (logEl) {
        const removeLogRing = showSpotlightRing(logEl);
        try {
          await ctx.delay(600);
        } finally {
          removeLogRing();
        }
      } else {
        await ctx.delay(500);
      }
    }
  };

  await sendBidiMessage('bidi-hello');
  await sendBidiMessage('bidi-world');

  try {
    await ctx.waitFor(GRPC.STREAM_LOG_LIST, 5_000);
  } catch {
    // Log may populate asynchronously.
  }
}

function isServerStreamFormFilled(): boolean {
  const message = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('message'));
  const repeat = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('repeat_count'));
  const interval = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('interval_ms'));
  return (
    message?.value === GRPC_STREAM_MESSAGE
    && repeat?.value === String(GRPC_STREAM_REPEAT_COUNT)
    && interval?.value === String(GRPC_STREAM_INTERVAL_MS)
  );
}

export async function guardServerStreamSelectedQuiet(ctx: DemoActionContext): Promise<void> {
  await guardGrpcReflectedQuiet(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  const methodHeader = document.querySelector(GRPC.CALL_METHOD_NAME);
  if (methodHeader?.textContent?.includes('ServerStream') && document.querySelector(GRPC.STREAM_START_BTN)) {
    return;
  }
  await ensureStreamingMethodSelectedQuiet(ctx, 'ServerStream');
}

export async function guardServerStreamFormQuiet(ctx: DemoActionContext): Promise<void> {
  await guardServerStreamSelectedQuiet(ctx);
  if (isServerStreamFormFilled()) return;
  await fillServerStreamRequestQuiet(ctx);
}

/** Quietly start server stream and wait for log entries when the visible step was skipped. */
export async function guardServerStreamExecutedQuiet(ctx: DemoActionContext): Promise<void> {
  await guardServerStreamFormQuiet(ctx);
  if (document.querySelector(GRPC.STREAM_LOG_LIST)) {
    const statusText = document.querySelector(GRPC.STREAM_STATUS_BADGE)?.textContent ?? '';
    if (/(finished|ended|complete|streaming)/i.test(statusText)) {
      return;
    }
  }
  const startBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_START_BTN);
  if (startBtn && !startBtn.disabled) {
    startBtn.click();
    try {
      await ctx.waitFor(GRPC.STREAM_LOG_LIST, 6_000);
    } catch {
      // Log may render asynchronously.
    }
    await ctx.delay(1_600);
  }
}

export async function guardClientStreamSelectedQuiet(ctx: DemoActionContext): Promise<void> {
  await guardGrpcReflectedQuiet(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  const methodHeader = document.querySelector(GRPC.CALL_METHOD_NAME);
  if (methodHeader?.textContent?.includes('ClientStream') && document.querySelector(GRPC.STREAM_ADD_QUEUE_BTN)) {
    return;
  }
  await ensureStreamingMethodSelectedQuiet(ctx, 'ClientStream');
}

export async function guardClientStreamQueuedQuiet(ctx: DemoActionContext): Promise<void> {
  await guardClientStreamSelectedQuiet(ctx);
  if (document.querySelector(GRPC.STREAM_PENDING_ITEM(0))) return;

  for (const msg of CLIENT_STREAM_QUEUE_MESSAGES) {
    const messageInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('message'));
    if (messageInput) {
      setInputValueAndDispatch(messageInput, msg);
    }
    document.querySelector<HTMLButtonElement>(GRPC.STREAM_ADD_QUEUE_BTN)?.click();
    await ctx.delay(100);
  }
}

export async function cancelActiveStreamQuiet(ctx: DemoActionContext): Promise<void> {
  const cancelBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_CANCEL_BTN);
  if (cancelBtn && !cancelBtn.disabled) {
    cancelBtn.click();
    await ctx.delay(200);
  }
}

export async function guardBidiStreamSelectedQuiet(ctx: DemoActionContext): Promise<void> {
  await guardGrpcReflectedQuiet(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  const methodHeader = document.querySelector(GRPC.CALL_METHOD_NAME);
  if (methodHeader?.textContent?.includes('BidiStream') && document.querySelector(GRPC.STREAM_START_BTN)) {
    return;
  }
  await ensureStreamingMethodSelectedQuiet(ctx, 'BidiStream');
}

export async function guardBidiStreamActiveQuiet(ctx: DemoActionContext): Promise<void> {
  await guardBidiStreamSelectedQuiet(ctx);
  if (document.querySelector(GRPC.STREAM_CANCEL_BTN)) return;

  document.querySelector<HTMLButtonElement>(GRPC.STREAM_START_BTN)?.click();
  try {
    await ctx.waitFor(GRPC.STREAM_CANCEL_BTN, 4_000);
  } catch {
    await ctx.delay(150);
  }
}

/** Seed bidi log entries without visible ripples — for export/cancel preAction recovery. */
export async function seedBidiStreamLogQuiet(ctx: DemoActionContext): Promise<void> {
  await guardBidiStreamSelectedQuiet(ctx);
  if (document.querySelector(GRPC.STREAM_LOG_LIST)) return;

  if (!document.querySelector(GRPC.STREAM_CANCEL_BTN)) {
    document.querySelector<HTMLButtonElement>(GRPC.STREAM_START_BTN)?.click();
    try {
      await ctx.waitFor(GRPC.STREAM_CANCEL_BTN, 4_000);
    } catch {
      await ctx.delay(150);
    }
  }

  for (const text of ['bidi-hello', 'bidi-world']) {
    const messageInput = document.querySelector<HTMLInputElement>(GRPC.PROTO_FIELD_INPUT('message'));
    if (messageInput) {
      setInputValueAndDispatch(messageInput, text);
    }
    document.querySelector<HTMLButtonElement>(GRPC.STREAM_SEND_MESSAGE_BTN)?.click();
    await ctx.delay(120);
  }

  try {
    await ctx.waitFor(GRPC.STREAM_LOG_LIST, 4_000);
  } catch {
    // Log may populate asynchronously.
  }
}
