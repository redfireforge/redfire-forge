/**
 * Reusable setup/cleanup building blocks for demo lessons.
 *
 * Each helper is a small async function that receives a DemoActionContext.
 * Lessons compose only the helpers they need — e.g. a Kafka lesson would
 * use kafka-specific helpers, a WebSocket lesson uses WS helpers, etc.
 */
import type { DemoActionContext } from '../types';
import { WS } from '../../../shared/selectors';

// ─── WebSocket Helpers ───────────────────────────────────────────

/** Start the built-in mock echo server (no-op if already running). */
export async function startMockServer(ctx: DemoActionContext) {
  await ctx.click(WS.MODE_MOCK);
  await ctx.delay(400);
  const btn = document.querySelector(WS.MOCK_START_BTN) as HTMLButtonElement | null;
  if (btn && !btn.disabled) {
    btn.click();
    await ctx.delay(1000);
  }
}

/** Stop the mock echo server (no-op if already stopped). */
export async function stopMockServer(ctx: DemoActionContext) {
  await ctx.click(WS.MODE_MOCK);
  await ctx.delay(300);
  const btn = document.querySelector(WS.MOCK_STOP_BTN) as HTMLButtonElement | null;
  if (btn && !btn.disabled) {
    btn.click();
    await ctx.delay(500);
  }
}

/** Switch to client mode. */
export async function switchToClientMode(ctx: DemoActionContext) {
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);
}

/** Disconnect the active WebSocket connection (no-op if already disconnected). */
export async function disconnectWebSocket(ctx: DemoActionContext) {
  const btn = document.querySelector(WS.DISCONNECT_BTN) as HTMLButtonElement | null;
  if (btn && !btn.disabled) {
    btn.click();
    await ctx.delay(300);
  }
}

/** Clear the events/message log. */
export async function clearEvents(ctx: DemoActionContext) {
  const btn = document.querySelector(WS.CLEAR_BTN) as HTMLButtonElement | null;
  if (btn && !btn.disabled) {
    btn.click();
    await ctx.delay(200);
  }
}

/** Reset auth type to "none". */
export async function resetAuth(ctx: DemoActionContext) {
  await ctx.click(WS.LEFT_TAB_AUTH);
  await ctx.delay(200);
  await ctx.selectOption(WS.AUTH_TYPE_DROPDOWN, 'none');
  await ctx.delay(200);
}

/** Close extra connection tabs until only 1 remains. */
export async function closeExtraConnectionTabs(ctx: DemoActionContext, maxIterations = 7) {
  for (let i = 0; i < maxIterations; i++) {
    const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
    if (tabs.length <= 1) break;
    const lastTab = tabs[tabs.length - 1] as HTMLElement;
    const tabId = lastTab.getAttribute('data-testid')?.replace('conn-tab-', '') ?? '';
    const closeBtn = document.querySelector(`[data-testid="conn-tab-close-${tabId}"]`) as HTMLElement | null;
    if (closeBtn) {
      closeBtn.click();
      await ctx.delay(300);
    } else {
      break;
    }
  }
}

/** Fill a React-controlled input by setting the native value property. */
export function fillControlledInput(el: HTMLInputElement, value: string) {
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSet?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Connect to the mock server (fill URL, click Connect, wait for connection). */
export async function connectToMockServer(
  ctx: DemoActionContext,
  url = 'ws://localhost:9876',
  delayMs = 1500,
) {
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.fill(WS.URL_INPUT, url);
  await ctx.delay(200);
  await ctx.click(WS.CONNECT_BTN);
  await ctx.delay(delayMs);
}

// ─── Composed Flows ─────────────────────────────────────────────

/** Common WS setup: ensure mock server is running, switch to client mode. */
export async function wsSetup(ctx: DemoActionContext) {
  await startMockServer(ctx);
  await switchToClientMode(ctx);
}

/** Common WS cleanup: disconnect, clear events, stop mock server, return to client mode. */
export async function wsCleanup(ctx: DemoActionContext) {
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await stopMockServer(ctx);
  await switchToClientMode(ctx);
}

/** WS + Auth cleanup: disconnect, clear events, reset auth, stop mock, return to client. */
export async function wsAuthCleanup(ctx: DemoActionContext) {
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await resetAuth(ctx);
  await stopMockServer(ctx);
  await switchToClientMode(ctx);
}
