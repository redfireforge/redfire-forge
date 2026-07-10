/**
 * Reusable setup/cleanup building blocks for demo lessons.
 *
 * Each helper is a small async function that receives a DemoActionContext.
 * Lessons compose only the helpers they need — e.g. a Kafka lesson would
 * use kafka-specific helpers, a WebSocket lesson uses WS helpers, etc.
 */
import type { DemoActionContext } from '../types';
import { WS, KAFKA } from '@shared/selectors';
import { dispatchKafkaOperation } from '@shared/kafka/kafkaClient';
import { firstVisibleElement } from '../utils/domVisibility';

/** Re-export — see `domVisibility.ts` for implementation. */
export { firstVisibleElement as firstVisibleEl } from '../utils/domVisibility';

const firstVisibleEl = firstVisibleElement;

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
    let started = false;
    for (let i = 0; i < 50; i++) {
      if (firstVisibleEl(WS.MOCK_STOP_BTN)) { started = true; break; }
      await ctx.delay(100);
    }
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

type ValueTrackedInput = HTMLInputElement & {
  _valueTracker?: { getValue: () => string; setValue: (v: string) => void };
};

/** Set a React-controlled checkbox by updating the native checked property. */
export function setControlledCheckbox(el: HTMLInputElement, checked: boolean): void {
  if (el.checked === checked) return;
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
  const tracker = (el as ValueTrackedInput)._valueTracker;
  if (tracker) {
    tracker.setValue(String(el.checked));
  }
  nativeSet?.call(el, checked);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Fill a React-controlled input by setting the native value property. */
export function fillControlledInput(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const nativeSet = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  // React 18+ tracks the DOM value — reset the tracker so onChange fires.
  const tracker = (el as ValueTrackedInput)._valueTracker;
  if (tracker) {
    tracker.setValue(el.value);
  }
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

/** Navigate to Protocols → Kafka (message studio) and ensure plaintext connection. */
export async function kafkaSetup(ctx: DemoActionContext): Promise<void> {
  try {
    const s = await dispatchKafkaOperation<{ state: string }>('status');
    if (s.data?.state !== 'connected') await ensureKafkaConnected();
  } catch { /* server may not be running */ }
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(400);
}

/** Navigate to Kafka Settings and ensure SASL connection for the secure demo stack. */
export async function kafkaSecureSetup(ctx: DemoActionContext): Promise<void> {
  try { await ensureKafkaSaslConnected(); } catch { /* server may not be running */ }
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(300);
}

/** Navigate to Kafka Settings and ensure TLS+SASL connection for the TLS demo stack. */
export async function kafkaTlsSetup(ctx: DemoActionContext): Promise<void> {
  try { await ensureKafkaTlsConnected(); } catch { /* server may not be running */ }
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(300);
}

// ── API-based Kafka connection helpers ────────────────────────────
// These bypass UI clicks entirely — each function checks server status
// via /api/kafka/status and connects if needed.  Lesson setups call the
// profile that matches their Docker stack.

interface KafkaConnectProfile {
  clusterId: string;
  brokers: string[];
  auth?: { mode: string; username: string; password: string };
  tls?: { enabled: boolean; rejectUnauthorized: boolean };
}

const PROFILE_PLAINTEXT: KafkaConnectProfile = {
  clusterId: 'demo-plaintext',
  brokers: ['127.0.0.1:19092'],
};

const PROFILE_SASL: KafkaConnectProfile = {
  clusterId: 'demo-secure',
  brokers: ['127.0.0.1:19093'],
  auth: { mode: 'scram-sha-256', username: 'redfireforge-app', password: 'app-password' },
};

const PROFILE_TLS: KafkaConnectProfile = {
  clusterId: 'demo-tls',
  brokers: ['127.0.0.1:19095'],
  auth: { mode: 'scram-sha-256', username: 'redfireforge-app', password: 'app-password' },
  tls: { enabled: true, rejectUnauthorized: false },
};

const PROFILE_SCHEMA_REGISTRY: KafkaConnectProfile = {
  clusterId: 'demo-schema-registry',
  brokers: ['127.0.0.1:19094'],
};

async function connectProfile(profile: KafkaConnectProfile): Promise<void> {
  try {
    const status = await dispatchKafkaOperation<{ state: string; clusterId?: string }>('status');
    if (status.data?.state === 'connected' && status.data.clusterId === profile.clusterId) return;
  } catch { /* not connected — fall through */ }

  await dispatchKafkaOperation('connect', {
    connection: {
      clusterId: profile.clusterId,
      clientId: 'redfireforge-demo',
      brokers: profile.brokers,
      connectionTimeoutMs: 8000,
      requestTimeoutMs: 10000,
      ...(profile.auth ? { auth: profile.auth } : {}),
      ...(profile.tls ? { tls: profile.tls } : {}),
    },
  });
}

/** Connect to the plaintext Redpanda broker (127.0.0.1:19092). */
export async function ensureKafkaConnected(): Promise<void> {
  await connectProfile(PROFILE_PLAINTEXT);
}

/** Connect to the SASL/SCRAM-256 broker (127.0.0.1:19093). */
export async function ensureKafkaSaslConnected(): Promise<void> {
  await connectProfile(PROFILE_SASL);
}

/** Connect to the TLS + SASL broker (127.0.0.1:19095). */
export async function ensureKafkaTlsConnected(): Promise<void> {
  await connectProfile(PROFILE_TLS);
}

/** Connect to the schema-registry broker (127.0.0.1:19094). */
export async function ensureKafkaSchemaRegistryConnected(): Promise<void> {
  await connectProfile(PROFILE_SCHEMA_REGISTRY);
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
  // ── Step 0: If already connected, skip the entire settings detour ───────
  // Navigating to kafka-settings can change React's selectedClusterId to a
  // stale cluster card (e.g. "Demo Cluster") that differs from the server's
  // active connection, causing 409 KAFKA_CLUSTER_MISMATCH on produce/consume.
  try {
    const statusEnv = await dispatchKafkaOperation<{ state: string }>('status');
    if (statusEnv.data?.state === 'connected') {
      ctx.navigateToTab('kafka-message-studio');
      await ctx.delay(400);
      return;
    }
    await ensureKafkaConnected();
  } catch {
    // API call failed (server might not be running) — fall through to UI-based setup
  }

  // ── Step 1: Navigate to Kafka Settings ──────────────────────────────────
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(600);

  // ── Step 2: Ensure at least one cluster exists ───────────────────────────
  const settingsPage = document.querySelector(KAFKA.SETTINGS_PAGE);
  if (!settingsPage) {
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

    const nameInput = document.querySelector<HTMLInputElement>('#kafka-cluster-name');
    if (nameInput) {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      proto?.call(nameInput, 'Demo Cluster');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      await ctx.delay(300);
    }

    const saveBtn = document.querySelector<HTMLElement>(KAFKA.SAVE_BTN);
    if (saveBtn) {
      saveBtn.click();
      await ctx.delay(600);
    }
  }

  // ── Step 3: Connect if not already connected ─────────────────────────────
  let connectBtn: HTMLButtonElement | null = null;
  for (let i = 0; i < 10; i++) {
    connectBtn = document.querySelector<HTMLButtonElement>(KAFKA.CONNECT_BTN);
    if (connectBtn && !connectBtn.disabled) break;
    await ctx.delay(200);
  }
  if (connectBtn && !connectBtn.disabled) {
    connectBtn.click();
    // Wait for Disconnect button to become ENABLED (not just exist) —
    // the button is always in the DOM but disabled until connected.
    for (let i = 0; i < 40; i++) {
      const dcBtn = document.querySelector<HTMLButtonElement>(KAFKA.DISCONNECT_BTN);
      if (dcBtn && !dcBtn.disabled) break;
      await ctx.delay(200);
    }
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
 * Delete a single cluster from the settings page.
 *
 * Assumes we're already on kafka-settings. Finds the cluster card,
 * clicks Edit to open the editor (which exposes the Delete button),
 * then clicks Delete → Confirm Delete.
 */
async function deleteDemoCluster(ctx: DemoActionContext): Promise<void> {
  const card = document.querySelector<HTMLElement>('[data-testid^="kafka-cluster-card-"]');
  if (!card) return;

  // Click Edit button inside the card (not the card itself — that only selects).
  const editBtn = card.querySelector<HTMLButtonElement>('.kafka-cluster-card-actions .btn');
  if (editBtn) {
    editBtn.click();
    await ctx.delay(500);
  }

  // Click "Delete Cluster" to show the confirmation prompt.
  const deleteBtn = document.querySelector<HTMLButtonElement>(KAFKA.DELETE_CLUSTER_BTN);
  if (!deleteBtn) return;
  deleteBtn.click();
  await ctx.delay(400);

  // Confirm deletion.
  const confirmBtn = document.querySelector<HTMLButtonElement>(KAFKA.CONFIRM_DELETE_BTN);
  if (confirmBtn) {
    confirmBtn.click();
    await ctx.delay(500);
  }
}

/**
 * Setup for the Quick Start lesson (K1).
 *
 * Ensures a clean first-time experience: disconnects any active connection,
 * deletes any existing clusters (especially "Demo Cluster" left from a
 * previous run), so the empty-state "Create First Cluster" button appears.
 */
export async function kafkaQuickStartSetup(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(500);

  // Disconnect any active connection first (delete fails on a connected cluster).
  const disconnectBtn = document.querySelector<HTMLButtonElement>(KAFKA.DISCONNECT_BTN);
  if (disconnectBtn && !disconnectBtn.disabled) {
    disconnectBtn.click();
    await ctx.delay(800);
  }

  // Delete clusters one at a time (handles stale "Demo Cluster" from previous runs).
  // Loop up to 3 times to handle multiple leftover clusters.
  for (let i = 0; i < 3; i++) {
    const card = document.querySelector<HTMLElement>('[data-testid^="kafka-cluster-card-"]');
    if (!card) break;
    await deleteDemoCluster(ctx);
  }
}

/**
 * Cleanup for the Quick Start lesson (K1).
 *
 * Deletes the "Demo Cluster" profile so restarting the lesson restores
 * the empty-state view ("Create First Cluster" button).
 */
export async function kafkaQuickStartCleanup(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(500);

  // Disconnect first — delete requires no active connection.
  const disconnectBtn = document.querySelector<HTMLButtonElement>(KAFKA.DISCONNECT_BTN);
  if (disconnectBtn && !disconnectBtn.disabled) {
    disconnectBtn.click();
    await ctx.delay(800);
  }

  await deleteDemoCluster(ctx);
}

/** Navigate to Protocols → Kafka → Topics tab and ensure plaintext connection. */
export async function kafkaTopicsSetup(ctx: DemoActionContext): Promise<void> {
  try {
    const s = await dispatchKafkaOperation<{ state: string }>('status');
    if (s.data?.state !== 'connected') await ensureKafkaConnected();
  } catch { /* server may not be running */ }
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(300);
  await ctx.click(KAFKA.TOPICS_TAB);
  await ctx.delay(600);

  // Topics load asynchronously after connection — wait for at least one row
  const topicRow = `${KAFKA.TOPIC_TABLE} tbody tr[style]`;
  for (let i = 0; i < 20; i++) {
    if (document.querySelector(topicRow)) break;
    await ctx.delay(500);
  }
}

/** Navigate to Protocols → Kafka → Schema Registry tab and ensure SR broker connection. */
export async function kafkaSchemaSetup(ctx: DemoActionContext): Promise<void> {
  try { await ensureKafkaSchemaRegistryConnected(); } catch { /* server may not be running */ }
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(300);
  await ctx.click(KAFKA.SCHEMA_TAB);
  await ctx.delay(300);
}
