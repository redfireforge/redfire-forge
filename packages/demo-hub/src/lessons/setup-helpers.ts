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
import { firstVisibleElement, visibleElements } from '../utils/domVisibility';
import {
  clearAllKafkaClusters,
  deleteKafkaClusterByName,
  ensurePlaintextKafkaCluster,
  markKafkaConnected,
} from '../adapters/kafkaStudioAdapter';

/** Re-export — see `domVisibility.ts` for implementation. */
export { firstVisibleElement as firstVisibleEl } from '../utils/domVisibility';

const firstVisibleEl = firstVisibleElement;

/** True when the *visible* connection tab is in the given studio mode.
 *  Must not use raw querySelector — every WS tab mounts its own mode chrome,
 *  and a hidden tab in Client mode would falsely skip switching the active tab. */
function isVisibleStudioMode(mode: 'client' | 'mock' | 'saved'): boolean {
  const btn = firstVisibleEl<HTMLElement>(`[data-testid="mode-${mode}"]`);
  if (!btn) return false;
  return btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true';
}

// ─── WebSocket Helpers ───────────────────────────────────────────

/**
 * Tracks whether the current demo session started the mock server.
 * If the server was already running when the demo began, the demo must NOT stop it in cleanup
 * — doing so would destroy the user's running server unexpectedly.
 * Reset to false at the start of each startMockServer call.
 */
let _demoStartedMock = false;

/**
 * Port captured from the Mock Server panel the last time startMockServer() ran.
 * Each connection tab gets its own dynamically-assigned port (9876, 9877, …), so
 * lessons must never assume a fixed port — they should read this after starting
 * the mock server (while still in Mock mode) and reuse it for the Client URL.
 * Falls back to '9876' if startMockServer() was never called.
 */
let _lastMockPort = '9876';

/** Returns the tab's actual assigned mock port, as last captured by startMockServer(). */
export function getLastMockPort(): string {
  return _lastMockPort;
}

/** Start the built-in mock echo server (no-op if already running).
 * Waits for the Stop button to appear rather than a fixed delay so the
 * server is guaranteed to be listening before the caller proceeds.
 * Sets _demoStartedMock=true only when this call actually starts the server. */
const DEMO_MOCK_PORT = '9876';

/** Force the Mock Server port field to `port` via the React-controlled path. */
async function commitMockPortInput(ctx: DemoActionContext, port: string): Promise<void> {
  // Port input is read-only while the server is running / stopping — wait until editable.
  for (let i = 0; i < 30; i++) {
    const portInput = firstVisibleEl<HTMLInputElement>(WS.MOCK_PORT_INPUT);
    if (portInput && !portInput.readOnly && !firstVisibleEl(WS.MOCK_STOP_BTN)) {
      fillControlledInput(portInput, port);
      portInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      portInput.blur();
      portInput.dispatchEvent(new Event('blur', { bubbles: true }));
      _lastMockPort = port;
      // Give React a tick to apply localMockPort + parent mockPorts state before Start.
      await ctx.delay(120);
      return;
    }
    await ctx.delay(50);
  }
  _lastMockPort = port;
}

export async function startMockServer(ctx: DemoActionContext) {
  // Only switch to Mock mode if the *visible* tab is not already there.
  if (!isVisibleStudioMode('mock')) {
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(120);
  }
  // Pin demos to the canonical mock port. Stop first if needed — the port
  // field is read-only while the server is running.
  if (firstVisibleEl(WS.MOCK_STOP_BTN)) {
    const portInput = firstVisibleEl<HTMLInputElement>(WS.MOCK_PORT_INPUT);
    const current = portInput?.value?.trim() ?? '';
    if (current === DEMO_MOCK_PORT) {
      _lastMockPort = DEMO_MOCK_PORT;
      _demoStartedMock = false;
      return;
    }
    const stopBtn = firstVisibleEl<HTMLButtonElement>(WS.MOCK_STOP_BTN);
    if (stopBtn && !stopBtn.disabled) {
      stopBtn.click();
      await ctx.delay(200);
    }
  }
  await commitMockPortInput(ctx, DEMO_MOCK_PORT);
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
    await ctx.delay(150);
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
  if (!isVisibleStudioMode('mock')) {
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(120);
  }
  const btn = firstVisibleEl<HTMLButtonElement>(WS.MOCK_STOP_BTN);
  if (btn && !btn.disabled) {
    btn.click();
    await ctx.delay(150);
  }
}

/** Switch to client mode (no-op if the visible tab is already in client mode). */
export async function switchToClientMode(ctx: DemoActionContext) {
  if (isVisibleStudioMode('client')) return;
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(150);
  // Verify the *visible* tab switched — retry once if the first click was swallowed
  if (!isVisibleStudioMode('client')) {
    firstVisibleEl<HTMLButtonElement>(WS.MODE_CLIENT)?.click();
    await ctx.delay(200);
  }
}

/**
 * Delete every visible mock rule card until the list is empty.
 * Retries a few passes because:
 *  - async storage load can repopulate rules after an early clear
 *  - delete buttons live in the card (opacity 0 until hover, but still clickable)
 *
 * Call from lesson setup/cleanup and before "Add your first rule".
 */
export async function clearAllMockRules(ctx: DemoActionContext): Promise<void> {
  if (!isVisibleStudioMode('mock')) {
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(250);
  }
  const rulesTab = firstVisibleEl<HTMLElement>(WS.MOCK_TAB_RULES);
  if (rulesTab) {
    rulesTab.click();
    await ctx.delay(200);
  }

  for (let pass = 0; pass < 4; pass++) {
    let guard = 0;
    while (guard++ < 25) {
      const cards = visibleElements<HTMLElement>(WS.MOCK_RULE_FIRST);
      if (cards.length === 0) break;

      const card = cards[0];
      const deleteBtn =
        card.querySelector<HTMLButtonElement>('[data-testid^="rule-delete-"]')
        ?? firstVisibleEl<HTMLButtonElement>(WS.MOCK_RULE_DELETE_ANY);
      if (!deleteBtn) {
        // Expand so action chrome is focusable / present, then retry
        (card.querySelector<HTMLElement>('[data-testid^="rule-expand-"]') ?? card.querySelector<HTMLElement>('.ws-mock-rule-header'))?.click();
        await ctx.delay(150);
        continue;
      }
      deleteBtn.click();
      await ctx.delay(280);
    }

    // Allow a late storage hydrate to finish, then clear again if needed
    await ctx.delay(pass === 0 ? 500 : 250);
    if (visibleElements(WS.MOCK_RULE_FIRST).length === 0) return;
  }
}

/** Disconnect the active WebSocket connection (no-op if already disconnected). */
export async function disconnectWebSocket(ctx: DemoActionContext) {
  const btn = firstVisibleEl<HTMLButtonElement>(WS.DISCONNECT_BTN);
  if (btn && !btn.disabled) {
    btn.click();
    await ctx.delay(120);
  }
}

/** Clear the events/message log. */
export async function clearEvents(ctx: DemoActionContext) {
  const btn = firstVisibleEl<HTMLButtonElement>(WS.CLEAR_BTN);
  if (btn && !btn.disabled) {
    btn.click();
    await ctx.delay(120);
  }
}

/** Reset auth type to "none". */
export async function resetAuth(ctx: DemoActionContext) {
  await ctx.click(WS.LEFT_TAB_AUTH);
  await ctx.delay(120);
  await ctx.selectOption(WS.AUTH_TYPE_DROPDOWN, 'none');
  await ctx.delay(120);
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
  await ctx.delay(120);
  // Remove all rows that have a non-empty key. We loop up to 20 times to handle
  // multiple headers; each click removes one row.
  for (let i = 0; i < 20; i++) {
    const removeBtn = document.querySelector<HTMLButtonElement>('.ws-connect-kv-remove-btn');
    if (!removeBtn) break;
    removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await ctx.delay(90);
  }
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(120);
}

/** Close extra WS connection tabs until only 1 remains. */
export async function closeExtraConnectionTabs(ctx: DemoActionContext, maxIterations = 7) {
  for (let i = 0; i < maxIterations; i++) {
    const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
    if (tabs.length <= 1) break;
    const lastTab = tabs[tabs.length - 1] as HTMLElement;
    const tabId = lastTab.getAttribute('data-testid')?.replace('conn-tab-', '') ?? '';
    const closeBtn = document.querySelector(`[data-testid="conn-tab-close-${tabId}"]`) as HTMLElement | null;
    if (closeBtn) {
      closeBtn.click();
      await ctx.delay(120);
    } else {
      break;
    }
  }
}

/** Close extra SSE connection tabs until only 1 remains. */
export async function closeExtraSseConnectionTabs(ctx: DemoActionContext, maxIterations = 7) {
  const SSE_BAR = '[data-testid="sse-conn-tab-bar"]';
  const SSE_ITEM = '[data-testid="sse-conn-tab-item"]';
  const SSE_CLOSE = '[data-testid="sse-conn-tab-close"]';
  for (let i = 0; i < maxIterations; i++) {
    const tabs = document.querySelectorAll(`${SSE_BAR} ${SSE_ITEM}`);
    if (tabs.length <= 1) break;
    const lastTab = tabs[tabs.length - 1] as HTMLElement;
    const closeBtn = lastTab.querySelector<HTMLElement>(SSE_CLOSE);
    if (closeBtn) {
      closeBtn.click();
      await ctx.delay(120);
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

/** Connect to the mock server (fill URL, click Connect, wait for connection).
 * When no url is passed, uses the tab's actual assigned mock port (captured by
 * startMockServer()) instead of assuming a fixed port. */
export async function connectToMockServer(
  ctx: DemoActionContext,
  url?: string,
  delayMs = 1500,
) {
  const resolvedUrl = url ?? `ws://localhost:${_lastMockPort}`;
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(120);
  await ctx.fill(WS.URL_INPUT, resolvedUrl);
  await ctx.delay(120);
  await ctx.click(WS.CONNECT_BTN);
  await ctx.delay(delayMs);
}

// ─── Composed Flows ─────────────────────────────────────────────

/**
 * Start the mock echo server via REST — no Mock/Client mode switching, no ripples.
 * Use in lesson `setup()` when step 1 must open calmly on an already-stable UI.
 */
export async function startMockServerQuiet(
  ctx: DemoActionContext,
  port = Number(DEMO_MOCK_PORT),
): Promise<void> {
  _lastMockPort = String(port);
  try {
    const statusRes = await fetch(`/api/ws/mock/status?port=${port}`);
    if (statusRes.ok) {
      const status = (await statusRes.json()) as { running?: boolean };
      if (status.running) {
        // Already up — do not claim ownership for cleanup.
        _demoStartedMock = false;
        await ctx.delay(40);
        return;
      }
    }
  } catch { /* status probe failed — try start anyway */ }

  try {
    await fetch('/api/ws/mock/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port, rules: [], fallback: 'echo' }),
    });
    _demoStartedMock = true;
  } catch { /* server may be unavailable in unit tests */ }
  await ctx.delay(80);
}

/** Stop a mock server started by {@link startMockServerQuiet} via REST (no UI flash). */
export async function stopMockServerQuiet(
  ctx: DemoActionContext,
  port = Number(_lastMockPort || DEMO_MOCK_PORT),
): Promise<void> {
  if (!_demoStartedMock) return;
  _demoStartedMock = false;
  try {
    await fetch('/api/ws/mock/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port }),
    });
  } catch { /* ignore */ }
  await ctx.delay(40);
}

/**
 * Quietly force the active tab's Mock Server port field to `port` (React path).
 * Used when REST start alone leaves a sticky UI value like 9878.
 */
export async function pinActiveMockPortQuiet(
  ctx: DemoActionContext,
  port: number | string = DEMO_MOCK_PORT,
): Promise<void> {
  const portStr = String(port);
  const wasMock = isVisibleStudioMode('mock');
  if (!wasMock) {
    firstVisibleEl<HTMLElement>(WS.MODE_MOCK)?.click();
    await ctx.delay(60);
  }
  // Port is locked while running — stop briefly so we can rewrite the field.
  if (firstVisibleEl(WS.MOCK_STOP_BTN)) {
    const portInput = firstVisibleEl<HTMLInputElement>(WS.MOCK_PORT_INPUT);
    if ((portInput?.value?.trim() ?? '') === portStr) {
      _lastMockPort = portStr;
      if (!wasMock) {
        firstVisibleEl<HTMLElement>(WS.MODE_CLIENT)?.click();
        await ctx.delay(40);
      }
      return;
    }
    firstVisibleEl<HTMLButtonElement>(WS.MOCK_STOP_BTN)?.click();
    await ctx.delay(160);
  }
  await commitMockPortInput(ctx, portStr);
  if (!wasMock) {
    firstVisibleEl<HTMLElement>(WS.MODE_CLIENT)?.click();
    await ctx.delay(40);
  }
}

/** Switch to Client mode with a quiet DOM click (no demo ripple). */
export async function switchToClientModeQuiet(ctx: DemoActionContext): Promise<void> {
  if (isVisibleStudioMode('client')) return;
  firstVisibleEl<HTMLElement>(WS.MODE_CLIENT)?.click();
  await ctx.delay(60);
}

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
    const s = await dispatchKafkaOperation<{ state: string; clusterId?: string }>('status');
    if (s.data?.state !== 'connected' || s.data.clusterId !== PROFILE_PLAINTEXT.clusterId) await ensureKafkaConnected();
  } catch { /* server may not be running */ }
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(120);
}

/**
 * Warm the SASL broker for the secure lesson, then disconnect.
 *
 * Important: do NOT leave the API session connected under clusterId
 * `demo-secure`. That id is not a saved UI profile, so the Clusters header
 * would show Connected while every card shows Idle (orphan connection).
 * The lesson itself teaches Save → Test → Connect for **Local Secure**.
 */
export async function kafkaSecureSetup(ctx: DemoActionContext): Promise<void> {
  deleteKafkaClusterByName('Local Secure');
  try {
    await ensureKafkaSaslConnected();
    await dispatchKafkaOperation('disconnect', { clusterId: PROFILE_SASL.clusterId });
  } catch { /* server may not be running */ }
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(120);
  // Sync React state if the status poll has not cleared the probe yet.
  const disconnectBtn = document.querySelector<HTMLButtonElement>(KAFKA.DISCONNECT_BTN);
  if (disconnectBtn && !disconnectBtn.disabled) {
    disconnectBtn.click();
    await ctx.delay(200);
  }
}

/**
 * Warm the TLS+SASL broker for the TLS lesson, then disconnect.
 * Same orphan-connection guard as kafkaSecureSetup (`demo-tls` is not a saved profile).
 */
export async function kafkaTlsSetup(ctx: DemoActionContext): Promise<void> {
  deleteKafkaClusterByName('Local TLS');
  try {
    await ensureKafkaTlsConnected();
    await dispatchKafkaOperation('disconnect', { clusterId: PROFILE_TLS.clusterId });
  } catch { /* server may not be running */ }
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(120);
  const disconnectBtn = document.querySelector<HTMLButtonElement>(KAFKA.DISCONNECT_BTN);
  if (disconnectBtn && !disconnectBtn.disabled) {
    disconnectBtn.click();
    await ctx.delay(200);
  }
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
  clusterId: 'demo-cluster',
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
 * Quietly seed Demo Cluster + connect the plaintext broker (no Settings UI).
 * Used by Publish Studio boot so Start never flashes Settings → Connect → Studio.
 */
export async function preparePlaintextKafkaStudio(): Promise<void> {
  ensurePlaintextKafkaCluster();
  try {
    await ensureKafkaConnected();
    markKafkaConnected(PROFILE_PLAINTEXT.clusterId);
  } catch {
    /* broker/server may be offline — lesson Docker gate covers that */
  }
}

/**
 * Setup for the Publish Studio lesson (K2).
 *
 * Seeds the plaintext Demo Cluster via the demo bridge and connects through the
 * API — never navigates to Settings (that Settings→Create→Connect tour was the
 * multi-page flash before step 1).
 */
export async function kafkaPublishSetup(ctx: DemoActionContext): Promise<void> {
  await preparePlaintextKafkaStudio();
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(80);
}

/** Kafka lessons require no broker teardown — this is a no-op for symmetry. */
export async function kafkaCleanup(_ctx: DemoActionContext): Promise<void> {
  // No broker process to stop.
}

/**
 * Setup for the Quick Start lesson (K1).
 *
 * Quietly clear saved clusters via the demo bridge (no Edit → Delete UI tour).
 * `prepareBeforeNavigate` already clears before Settings paints; this is the
 * idempotent belt for Restart / mid-lesson recovery.
 */
export async function kafkaQuickStartSetup(ctx: DemoActionContext): Promise<void> {
  clearAllKafkaClusters();
  ctx.navigateToTab('kafka-settings');
  await ctx.delay(80);
}

/**
 * Cleanup for the Quick Start lesson (K1).
 *
 * Quietly remove leftover profiles so Restart lands on the empty state again.
 */
export async function kafkaQuickStartCleanup(_ctx: DemoActionContext): Promise<void> {
  clearAllKafkaClusters();
}

/** Navigate to Protocols → Kafka → Topics tab and ensure plaintext connection. */
export async function kafkaTopicsSetup(ctx: DemoActionContext): Promise<void> {
  try {
    const s = await dispatchKafkaOperation<{ state: string; clusterId?: string }>('status');
    if (s.data?.state !== 'connected' || s.data.clusterId !== PROFILE_PLAINTEXT.clusterId) await ensureKafkaConnected();
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

/** Navigate to Protocols → Kafka Message Studio for the Schema Registry lesson.
 *  Does NOT click the Schema tab — that is the lesson's first visible teaching beat
 *  (sr-intro). Clicking it here caused a pre-narration flash users perceived as
 *  "unnecessary moving parts" at lesson start. */
export async function kafkaSchemaSetup(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('kafka-message-studio');
  await ctx.delay(120);
}
