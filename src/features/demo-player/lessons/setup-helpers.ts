/**
 * Reusable setup/cleanup building blocks for demo lessons.
 *
 * Each helper is a small async function that receives a DemoActionContext.
 * Lessons compose only the helpers they need — e.g. a Kafka lesson would
 * use kafka-specific helpers, a WebSocket lesson uses WS helpers, etc.
 */
import type { DemoActionContext } from '../types';
import { WS, KAFKA } from '../../../shared/selectors';

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

// ─── Kafka Helpers ───────────────────────────────────────────────

/** Navigate to Protocols → Kafka (message studio). */
export async function kafkaSetup(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(300);
}

/**
 * Setup for the Publish Studio lesson (K2).
 *
 * If no Kafka cluster is configured, silently creates the default demo cluster
 * (127.0.0.1:19092, plaintext) via the Kafka Settings UI, saves it, and clicks
 * "Connect" so the Send Once button is enabled when the lesson reaches step 7.
 *
 * If a cluster is already configured and connected, this is a fast no-op.
 */
export async function kafkaPublishSetup(ctx: DemoActionContext): Promise<void> {
  // ── Step 1: Navigate to Kafka Settings ──────────────────────────────────
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(600);

  // ── Step 2: Ensure at least one cluster exists ───────────────────────────
  const settingsPage = document.querySelector(KAFKA.SETTINGS_PAGE);
  if (!settingsPage) {
    // Settings page not yet mounted — fall back to plain setup
    ctx.navigateToTab('kafka-message-studio');
    await ctx.delay(300);
    return;
  }

  // Create default cluster if none exist
  const newClusterBtn = document.querySelector(KAFKA.NEW_CLUSTER_BTN) as HTMLElement | null;
  if (newClusterBtn) {
    newClusterBtn.click();
    await ctx.delay(500);

    // Fill cluster name (defaults to auto-generated "New Cluster N" — use "Demo Cluster")
    const nameInput = document.querySelector<HTMLInputElement>('#kafka-cluster-name');
    if (nameInput) {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      proto?.call(nameInput, 'Demo Cluster');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      await ctx.delay(300);
    }

    // Save the cluster (broker stays at default 127.0.0.1:19092 from defaultClusterDraft)
    const saveBtn = document.querySelector<HTMLElement>(KAFKA.SAVE_BTN);
    if (saveBtn) {
      saveBtn.click();
      await ctx.delay(600);
    }
  }

  // ── Step 3: Connect if not already connected ─────────────────────────────
  // Poll briefly for the Connect button to become available (up to 2 s)
  let connectBtn: HTMLButtonElement | null = null;
  for (let i = 0; i < 10; i++) {
    connectBtn = document.querySelector<HTMLButtonElement>(KAFKA.CONNECT_BTN);
    if (connectBtn && !connectBtn.disabled) break;
    await ctx.delay(200);
  }
  if (connectBtn && !connectBtn.disabled) {
    connectBtn.click();
    // Wait up to 5 s for connection to establish
    await ctx.waitFor('[data-testid="kafka-cluster-editor"]', 5000);
    await ctx.delay(1000);
  }

  // ── Step 4: Return to message studio ────────────────────────────────────
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(400);
}

/** Kafka lessons require no broker teardown — this is a no-op for symmetry. */
export async function kafkaCleanup(_ctx: DemoActionContext): Promise<void> {
  // No broker process to stop.
}

/** Navigate to Protocols → Kafka → Topics tab. */
export async function kafkaTopicsSetup(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(300);
  await ctx.click(KAFKA.TOPICS_TAB);
  await ctx.delay(300);
}

/** Navigate to Protocols → Kafka → Schema Registry tab. */
export async function kafkaSchemaSetup(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(300);
  await ctx.click(KAFKA.SCHEMA_TAB);
  await ctx.delay(300);
}
