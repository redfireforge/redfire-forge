/**
 * Reusable setup/cleanup building blocks for demo lessons.
 *
 * Each helper is a small async function that receives a DemoActionContext.
 * Lessons compose only the helpers they need — e.g. a Kafka lesson would
 * use kafka-specific helpers, a WebSocket lesson uses WS helpers, etc.
 */
import type { DemoActionContext } from '../types';
import { WS, KAFKA } from '../../../shared/selectors';

/** Return the first DOM element matching `selector` that has a non-zero bounding box
 *  (i.e. it is actually rendered and not hidden via display:none / visibility:hidden).
 *  Mirrors the `firstVisible` logic in useDemoHub.ts — prevents targeting hidden
 *  panels from inactive WebSocket tabs when multiple tabs are open. */
export function firstVisibleEl<T extends HTMLElement = HTMLElement>(selector: string): T | null {
  const all = document.querySelectorAll<T>(selector);
  for (const el of Array.from(all)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

// ─── WebSocket Helpers ───────────────────────────────────────────

/**
 * Tracks whether the current demo session started the mock server.
 * If the server was already running when the demo began, the demo must NOT stop it in cleanup
 * — doing so would destroy the user's running server unexpectedly.
 * Reset to false at the start of each startMockServer call.
 */
let _demoStartedMock = false;

/** Start the built-in mock echo server (no-op if already running).
 * Waits for the Stop button to appear rather than a fixed delay so the
 * server is guaranteed to be listening before the caller proceeds.
 * Sets _demoStartedMock=true only when this call actually starts the server. */
export async function startMockServer(ctx: DemoActionContext) {
  await ctx.click(WS.MODE_MOCK);
  await ctx.delay(400);
  // Already running? Record that WE did not start it — cleanup must leave it alone.
  if (firstVisibleEl(WS.MOCK_STOP_BTN)) {
    _demoStartedMock = false;
    return;
  }
  _demoStartedMock = true;
  // Click Start and wait (retry once if the first attempt doesn't take)
  for (let attempt = 0; attempt < 2; attempt++) {
    const btn = firstVisibleEl<HTMLButtonElement>(WS.MOCK_START_BTN);
    if (btn && !btn.disabled) btn.click();
    // Wait up to 5s for the Stop button (server listening confirmation)
    const started = await new Promise<boolean>(resolve => {
      const deadline = Date.now() + 5000;
      const poll = () => {
        if (firstVisibleEl(WS.MOCK_STOP_BTN)) return resolve(true);
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(poll, 100);
      };
      poll();
    });
    if (started) return;
    await ctx.delay(500);
  }
  // Last resort: give up but wait 2s so the caller isn't racing
  await ctx.delay(2000);
}

/**
 * Stop the mock echo server — but ONLY if the demo started it.
 * If the server was already running before the demo began (_demoStartedMock === false),
 * this is a no-op to protect the user's running server.
 */
export async function stopMockServer(ctx: DemoActionContext) {
  if (!_demoStartedMock) return;
  _demoStartedMock = false;
  await ctx.click(WS.MODE_MOCK);
  await ctx.delay(300);
  const btn = firstVisibleEl<HTMLButtonElement>(WS.MOCK_STOP_BTN);
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
  const btn = firstVisibleEl<HTMLButtonElement>(WS.DISCONNECT_BTN);
  if (btn && !btn.disabled) {
    btn.click();
    await ctx.delay(300);
  }
}

/** Clear the events/message log. */
export async function clearEvents(ctx: DemoActionContext) {
  const btn = firstVisibleEl<HTMLButtonElement>(WS.CLEAR_BTN);
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

/**
 * Remove all enabled custom headers from the Headers tab.
 *
 * The browser WebSocket transport cannot set custom headers — they force proxy
 * mode (/api/ws/connect). If a user has headers configured from their normal
 * workflow (or a saved profile), they will trigger proxy mode and cause a 504
 * Gateway Timeout in web mode even when skip-cert and TLS options are clean.
 *
 * We click the remove button on every enabled non-empty header row, then return
 * to the Connect tab so the caller can continue with a clean draft.
 */
export async function clearCustomHeaders(ctx: DemoActionContext) {
  await ctx.click(WS.LEFT_TAB_HEADERS);
  await ctx.delay(200);
  // Remove all rows that have a non-empty key. We loop up to 20 times to handle
  // multiple headers; each click removes one row.
  for (let i = 0; i < 20; i++) {
    const removeBtn = document.querySelector<HTMLButtonElement>('.ws-connect-kv-remove-btn');
    if (!removeBtn) break;
    removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await ctx.delay(150);
  }
  await ctx.click(WS.LEFT_TAB_CONNECT);
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

  // Create default cluster only if none exist yet (target the empty-state button only,
  // NOT the always-visible "+ New" button which would create a duplicate on repeated runs)
  const emptyCreateBtn = document.querySelector<HTMLElement>('[data-testid="kafka-empty-create-btn"]');
  if (emptyCreateBtn) {
    emptyCreateBtn.click();
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
    // Wait for the Disconnect button to appear — it only shows when the cluster
    // is actually connected, so this correctly blocks until the connection succeeds.
    await ctx.waitFor(KAFKA.DISCONNECT_BTN, 8000);
    await ctx.delay(600);
  }

  // ── Step 4: Return to message studio ────────────────────────────────────
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(400);
}

/** Kafka lessons require no broker teardown — this is a no-op for symmetry. */
export async function kafkaCleanup(_ctx: DemoActionContext): Promise<void> {
  // No broker process to stop.
}

/**
 * Cleanup for the Quick Start lesson (K1).
 *
 * Deletes the "Demo Cluster" profile that K1 creates so that restarting the
 * lesson restores the empty-state view ("Create First Cluster" button).
 *
 * Without this cleanup, step 2 of K1 cannot open the cluster editor because
 * the empty-state button is hidden once any cluster exists.
 */
export async function kafkaQuickStartCleanup(ctx: DemoActionContext): Promise<void> {
  // Navigate to Kafka Settings where cluster management lives.
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(500);

  // If no clusters exist, nothing to clean up.
  const clusterCard = document.querySelector<HTMLElement>('[data-testid^="kafka-cluster-card-"]');
  if (!clusterCard) return;

  // Select the cluster to open its editor.
  clusterCard.click();
  await ctx.delay(400);

  // Click "Delete Cluster" to trigger the confirmation prompt.
  const deleteBtn = document.querySelector<HTMLButtonElement>(KAFKA.DELETE_CLUSTER_BTN);
  if (!deleteBtn) return;
  deleteBtn.click();
  await ctx.delay(300);

  // Confirm the deletion.
  const confirmBtn = document.querySelector<HTMLButtonElement>(KAFKA.CONFIRM_DELETE_BTN);
  if (confirmBtn) {
    confirmBtn.click();
    await ctx.delay(400);
  }
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
