/**
 * Lesson GRPC-23: Tauri Desktop — Native Transport, Diagnostics & Mock Listener
 *
 * Desktop-only lesson (desktopOnly: true). Every preAction guards with
 * `if (!isTauri()) return` so the lesson is safe in web E2E shims.
 *
 *   grpc23-intro            — Tour Transport panel; Tauri Native is available in desktop
 *   grpc23-native-mode      — Select Tauri Native; connection bar indicator updates
 *   grpc23-native-call      — Send an Echo unary call through Rust tonic; see low latency
 *   grpc23-diagnostics      — Advanced → Native Diagnostics; refresh snapshot; Copy JSON
 *   grpc23-native-stream    — Start ServerStream (5 messages); stream registry counter updates
 *   grpc23-mock-setup       — Add ping→pong mock rule; start runtime; status Running
 *   grpc23-listener-enable  — Enable Network Listener; Rust gRPC server binds to TCP port
 *   grpc23-external-call    — Narration: grpcurl call hits listener; Listener log appears
 *   grpc23-hot-swap         — Add 2nd rule; generation counter increments; stop & reset
 *   grpc23-default-tauri    — New desktop tabs default to Tauri Native transport
 *   grpc23-secret-vault     — Desktop auth secrets are persisted through encrypted vault storage
 *   grpc23-native-fallback  — Native preflight failures offer quick fallback to Express
 */
import { GRPC } from '@shared/selectors';
import { isTauri } from '@shared/utils/platform';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  closeGrpcSettingsDrawerQuiet,
  GRPC_DEMO_TARGET,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureGrpcStudioSubNavQuiet,
  ensureGrpcRequestFormTabQuiet,
  fillGrpcRequestJsonBody,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  isGrpcEchoComposerReady,
  resetGrpcManageSchemasDraftsQuiet,
  setGrpcTargetQuiet,
  spotlightAndPause,
} from './grpc-lesson-helpers';
import {
  getLastRuleIds,
  scrollBelowMockAuthoringTabs,
  selectMockAuthoringTab,
  setMockInputValue,
  setSelectValue,
} from './grpc-mock-server-helpers';
import type { DemoActionContext } from '../../types';

// ---------------------------------------------------------------------------
// Roster entry
// ---------------------------------------------------------------------------

const GRPC23_ROSTER = getGrpcLessonRosterEntry('grpc-tauri-desktop')!;

// ---------------------------------------------------------------------------
// Session flags — track what has been set up so preActions are idempotent
// ---------------------------------------------------------------------------

const session = {
  transportSwitched: false,
  firstCallDone: false,
  inDiagnostics: false,
  mockRuleAdded: false,
  mockRunning: false,
  listenerEnabled: false,
  authConfigured: false,
};

function resetSession(): void {
  session.transportSwitched = false;
  session.firstCallDone = false;
  session.inDiagnostics = false;
  session.mockRuleAdded = false;
  session.mockRunning = false;
  session.listenerEnabled = false;
  session.authConfigured = false;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Quietly navigate to gRPC Studio → Advanced sub-nav. */
async function navigateToAdvancedQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const advBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (advBtn && advBtn.getAttribute('aria-selected') !== 'true') {
    advBtn.click();
    await ctx.delay(400);
  }
}

const GRPC_ECHO_SERVICE_FQN = 'echo.EchoService';
const GRPC_ECHO_SERVICE_SEL_LOCAL = GRPC.SERVICE(GRPC_ECHO_SERVICE_FQN);
const GRPC_ECHO_METHOD_SEL_LOCAL = GRPC.METHOD(GRPC_ECHO_SERVICE_FQN, 'Echo');

/**
 * Reflect + select Echo against whatever target is CURRENTLY in the target bar,
 * without going through ensureEchoMethodSelected()/ensureGrpcReflected() — those
 * call ensureGrpcTarget() internally, which unconditionally forces the target back
 * to the standard demo address (localhost:50051) whenever it doesn't match. That is
 * wrong for steps that deliberately target the mock listener's external port.
 */
async function reflectAndSelectEchoAtCurrentTarget(ctx: DemoActionContext): Promise<void> {
  if (isGrpcEchoComposerReady()) {
    await ensureGrpcRequestFormTabQuiet(ctx);
    return;
  }
  const hasReflectionData = () =>
    Boolean(document.querySelector(GRPC.EXPLORER_TREE) || document.querySelector(GRPC.EXPLORER_SOURCE));
  if (!hasReflectionData()) {
    const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
    if (reflectBtn && !reflectBtn.disabled) {
      await ctx.click(GRPC.REFLECT_BTN);
    }
    try {
      await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_SOURCE}`, 12_000);
    } catch {
      // Lesson stays navigable even if reflection is briefly unavailable.
    }
  }
  let methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL_LOCAL);
  if (!methodBtn) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL_LOCAL);
    if (serviceBtn) {
      await ctx.click(GRPC_ECHO_SERVICE_SEL_LOCAL);
      await ctx.delay(400);
    }
  }
  try {
    await ctx.waitFor(GRPC_ECHO_METHOD_SEL_LOCAL, 10_000);
    methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL_LOCAL);
    if (methodBtn) {
      await ctx.click(GRPC_ECHO_METHOD_SEL_LOCAL);
      await ctx.waitFor(GRPC.REQUEST_FORM_SCROLL, 10_000);
    }
  } catch {
    // Best-effort — the fill/send below will simply no-op if the method never selected.
  }
  await ensureGrpcRequestFormTabQuiet(ctx);
}

/** Quietly switch to the Native Diagnostics advanced tab. */
async function openNativeDiagnosticsQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToAdvancedQuiet(ctx);
  const diagTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('native_diagnostics'));
  if (diagTab && diagTab.getAttribute('aria-selected') !== 'true') {
    diagTab.click();
    await ctx.delay(400);
  }
}

/** Quietly navigate to Advanced → Mock Server → Builder tab. */
async function openMockBuilderQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToAdvancedQuiet(ctx);
  const mockTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('mock_server'));
  if (mockTab && mockTab.getAttribute('aria-selected') !== 'true') {
    mockTab.click();
    await ctx.delay(400);
  }
  const builderTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_BUILDER);
  if (builderTab && builderTab.getAttribute('aria-selected') !== 'true') {
    builderTab.click();
    await ctx.delay(300);
  }
}

/** Quietly switch to the Runtime tab inside Mock Server panel. */
async function openMockRuntimeTabQuiet(ctx: DemoActionContext): Promise<void> {
  const runtimeTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_RUNTIME);
  if (runtimeTab && runtimeTab.getAttribute('aria-selected') !== 'true') {
    runtimeTab.click();
    await ctx.delay(400);
  }
}

/** Clear all mock rules so the builder starts empty. */
async function clearMockRulesQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  await openMockBuilderQuiet(ctx);
  await selectMockAuthoringTab(ctx, 'json');
  await ctx.delay(200);
  const rulesJson = JSON.stringify({ version: 1, rules: [] }, null, 2);
  setMockInputValue(GRPC.MOCK_RULES_JSON, rulesJson);
  await ctx.delay(250);
  await selectMockAuthoringTab(ctx, 'builder');
  await ctx.delay(200);
  session.mockRuleAdded = false;
}

/** Quietly switch to Tauri Native transport through settings drawer. */
async function switchToTauriNativeQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  const settingsBtn = document.querySelector<HTMLElement>(GRPC.CONNECTION_SETTINGS_BTN);
  if (!settingsBtn) return;
  settingsBtn.click();
  await ctx.delay(500);
  const transportNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
  if (transportNav) {
    transportNav.click();
    await ctx.delay(300);
  }
  const tauriCard = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('tauri'));
  if (tauriCard && !tauriCard.disabled) {
    tauriCard.click();
    await ctx.delay(300);
  }
  const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
  if (closeBtn) {
    closeBtn.click();
    await ctx.delay(400);
  }
  session.transportSwitched = true;
}

/** Quietly reset transport back to Express Proxy. */
async function resetTransportToExpressQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  const settingsBtn = document.querySelector<HTMLElement>(GRPC.CONNECTION_SETTINGS_BTN);
  if (!settingsBtn) return;
  settingsBtn.click();
  await ctx.delay(400);
  const transportNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
  if (transportNav) {
    transportNav.click();
    await ctx.delay(300);
  }
  const expressCard = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('express'));
  if (expressCard && !expressCard.disabled) {
    expressCard.click();
    await ctx.delay(300);
  }
  const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
  if (closeBtn) {
    closeBtn.click();
    await ctx.delay(400);
  }
  session.transportSwitched = false;
}

/** Quietly stop mock runtime if currently running. */
async function stopMockRuntimeQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  const stopBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_STOP);
  if (stopBtn && !stopBtn.disabled) {
    stopBtn.click();
    await ctx.delay(500);
  }
  session.mockRunning = false;
  session.listenerEnabled = false;
}

async function ensureMockRuntimeStoppedQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  await openMockRuntimeTabQuiet(ctx);
  await stopMockRuntimeQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

async function ensureMockListenerReadyQuiet(ctx: DemoActionContext): Promise<string> {
  if (!isTauri()) return '';
  await openMockRuntimeTabQuiet(ctx);

  const startBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_START);
  if (startBtn && !startBtn.disabled) {
    startBtn.click();
    await ctx.delay(350);
  }
  session.mockRunning = true;

  const toggle = document.querySelector<HTMLInputElement>(GRPC.MOCK_EXPOSE_NETWORK);
  if (toggle && !toggle.checked) {
    toggle.click();
    await ctx.delay(450);
  }

  await ctx.waitFor(GRPC.MOCK_LISTEN_TARGET, 6_000);
  const listenValueEl = document.querySelector<HTMLElement>('.grpc-mock-listen-target-chip__value');
  const listenTarget = listenValueEl?.textContent?.trim() ?? '';
  if (!listenTarget) {
    throw new Error('Mock listener target is not available yet.');
  }

  session.listenerEnabled = true;
  return listenTarget;
}

function readMockListenTargetValue(): string {
  const listenValueEl = document.querySelector<HTMLElement>('.grpc-mock-listen-target-chip__value');
  return listenValueEl?.textContent?.trim() ?? '';
}

async function waitForGrpcSendEnabled(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GRPC.SEND_BTN);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
    if (sendBtn && !sendBtn.disabled) return;
    await ctx.delay(100);
  }
}

async function waitForStreamStartEnabled(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GRPC.STREAM_START_BTN);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const startBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_START_BTN);
    if (startBtn && !startBtn.disabled) return;
    await ctx.delay(120);
  }
}

async function waitForStreamMessageCount(
  ctx: DemoActionContext,
  minCount: number,
  timeoutMs: number,
): Promise<number> {
  const maxAttempts = Math.max(1, Math.floor(timeoutMs / 250));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const text = document.querySelector<HTMLElement>(GRPC.STREAM_LOG_COUNT)?.textContent ?? '';
    const parsed = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(parsed) && parsed >= minCount) {
      return parsed;
    }
    await ctx.delay(250);
  }
  return 0;
}

async function spotlightRequestMessageLine(ctx: DemoActionContext, fallbackMs: number): Promise<void> {
  const editor = document.querySelector<HTMLElement>(GRPC.REQUEST_JSON);
  const lineSelector = GRPC.REQUEST_JSON_MESSAGE_LINE;
  const cleanup = (target: Element | null) => {
    if (target) {
      target.removeAttribute('data-testid');
    }
  };

  const candidateLine = editor
    ?.closest('.cm-editor')
    ?.querySelectorAll<HTMLElement>('.cm-line');
  if (candidateLine && candidateLine.length > 0) {
    const messageLine = Array.from(candidateLine)
      .find((line) => line.textContent?.includes('"message"') ?? false) ?? null;
    if (messageLine) {
      messageLine.setAttribute('data-testid', 'grpc-request-json-message-line');
      try {
        await spotlightAndPause(ctx, lineSelector, fallbackMs);
      } finally {
        cleanup(messageLine);
      }
      return;
    }
  }

  await spotlightAndPause(ctx, GRPC.REQUEST_JSON, fallbackMs);
}

function ensureRequestMessageLineHighlight(): void {
  const editor = document.querySelector<HTMLElement>(GRPC.REQUEST_JSON);
  const candidateLine = editor
    ?.closest('.cm-editor')
    ?.querySelectorAll<HTMLElement>('.cm-line');
  if (candidateLine && candidateLine.length > 0) {
    const messageLine = Array.from(candidateLine)
      .find((line) => line.textContent?.includes('"message"') ?? false) ?? null;
    if (messageLine) {
      messageLine.setAttribute('data-testid', 'grpc-request-json-message-line');
    }
  }
}

function hasMockRulesInDom(): boolean {
  if (document.querySelector('[data-testid="grpc-mock-rules-list"] .grpc-advanced-rule-item')) {
    return true;
  }
  if (document.querySelector('[data-testid^="grpc-mock-builder-rule-"]')) {
    return true;
  }
  return false;
}

function isMockServerPanelVisible(): boolean {
  return !!(
    document.querySelector(GRPC.MOCK_TAB_BUILDER)
    || document.querySelector(GRPC.MOCK_TAB_RUNTIME)
    || document.querySelector(GRPC.MOCK_TAB_JSON)
  );
}

function isMockRuntimeTabActive(): boolean {
  const runtimeTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_RUNTIME);
  return runtimeTab?.getAttribute('aria-selected') === 'true';
}

/** Selector for whichever rule card is currently tagged as the highlight target. */
const CURRENT_RULE_HIGHLIGHT_SELECTOR = '[data-rule-highlight="true"]';

/** Tag only the given rule card for highlighting — clears any previous tag first
 * so an older rule (e.g. the first "ping match" rule) never stays highlighted
 * alongside the one actively being configured. */
function tagCurrentRuleHighlight(ruleId: string): void {
  document.querySelectorAll('[data-rule-highlight]').forEach((el) => {
    el.removeAttribute('data-rule-highlight');
  });
  const ruleEl = document.querySelector<HTMLElement>(`[data-testid="grpc-mock-builder-rule-${ruleId}"]`);
  ruleEl?.setAttribute('data-rule-highlight', 'true');
}

// ---------------------------------------------------------------------------
// Lesson steps
// ---------------------------------------------------------------------------

type DemoStep = GrpcDemoLesson['steps'][number];

const steps: DemoStep[] = [
  // =========================================================================
  // Step 1 — Intro: Desktop-only features
  // =========================================================================
  {
    id: 'grpc23-intro',
    title: 'Intro: Desktop-only features',
    description:
      'Open the **Connection Settings** drawer and look at the **Transport** panel. ' +
      'On the web app, the **Tauri Native (tonic)** card is grayed out — it\'s ' +
      'a desktop-only feature. Here in the Tauri desktop app it is fully selectable.\n\n' +
      '**Express Proxy** routes every call through the Node.js `@grpc/grpc-js` layer ' +
      'on port 3001 before it reaches your gRPC server. **Tauri Native** routes calls ' +
      'directly from a Rust `tonic` channel pool — no JavaScript relay in the path. ' +
      'This gives lower per-call overhead and enables features that only Rust can provide: ' +
      'real TCP binding for the Mock Network Listener and a live channel pool diagnostic snapshot.',
    highlight: GRPC.CONNECTION_SETTINGS_BTN,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) {
        await resetGrpcManageSchemasDraftsQuiet(ctx);
      }
      await ensureGrpcReflected(ctx);
      await closeGrpcSettingsDrawerQuiet(ctx);
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
      await ctx.waitFor(GRPC.SETTINGS_DRAWER);
      await ctx.delay(600);

      await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 700);

      const transportNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
      if (transportNav) {
        transportNav.click();
        await ctx.delay(500);
      }
      await ctx.waitFor(GRPC.TRANSPORT_PANEL);
      await ctx.delay(400);

      await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), 1000);

      await ctx.delay(500);
      await ctx.click(GRPC.SETTINGS_CLOSE);
      await ctx.delay(600);
    },
  },

  // =========================================================================
  // Step 2 — Switch to Tauri Native transport
  // =========================================================================
  {
    id: 'grpc23-native-mode',
    title: 'Switch to Tauri Native',
    description:
      'Open **Settings → Transport** and select **Tauri Native (tonic)**. ' +
      'Notice the connection bar — a small native-transport indicator confirms the ' +
      'channel is now managed by the Rust backend.\n\n' +
      'From this point on, every call you make goes directly from Rust to your gRPC ' +
      'server. The Node.js Express proxy on port 3001 is no longer in the path.',
    highlight: GRPC.TRANSPORT_PANEL,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      await closeGrpcSettingsDrawerQuiet(ctx);
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
      await ctx.waitFor(GRPC.SETTINGS_DRAWER);
      await ctx.delay(500);

      const transportNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
      if (transportNav) {
        transportNav.click();
        await ctx.delay(400);
      }
      await ctx.waitFor(GRPC.TRANSPORT_PANEL);
      await ctx.delay(400);

      await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), 700);

      await ctx.click(GRPC.TRANSPORT_MODE('tauri'));
      await ctx.delay(600);

      await ctx.click(GRPC.SETTINGS_CLOSE);
      await ctx.delay(700);

      await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, 900);
      session.transportSwitched = true;
    },
  },

  // =========================================================================
  // Step 3 — Send a unary call natively
  // =========================================================================
  {
    id: 'grpc23-native-call',
    title: 'Send a unary call natively',
    description:
      'Select `echo.EchoService / Echo` and click **Send** with this request body:\n' +
      '```json\n' +
      '{\n' +
      '  "message": "native-test"\n' +
      '}\n' +
      '```\n' +
      'Watch the **response duration** — native tonic calls typically complete with lower ' +
      'latency than the Express proxy path because there is no JavaScript relay hop.\n\n' +
      'The response body and status code are identical:\n' +
      '```json\n' +
      '{\n' +
      '  "message": "native-test"\n' +
      '}\n' +
      '```\n' +
      'Status is **OK (0)**. ' +
      'The only difference is the transport path — Rust → gRPC target vs. ' +
      'Node.js relay → gRPC target.',
    highlight: GRPC.REQUEST_JSON_MESSAGE_LINE,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.transportSwitched) await switchToTauriNativeQuiet(ctx);
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ensureEchoMethodSelected(ctx);
      await fillGrpcRequestJsonBody(ctx, JSON.stringify({ message: 'native-test' }, null, 2));
      const prettyBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_JSON_PRETTY_BTN);
      if (prettyBtn && !prettyBtn.disabled) {
        prettyBtn.click();
        await ctx.delay(250);
      }
      ensureRequestMessageLineHighlight();
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ctx.delay(300);

      const methodEl = document.querySelector<HTMLElement>(GRPC.METHOD('echo.EchoService', 'Echo'));
      if (methodEl) {
        methodEl.click();
        await ctx.delay(600);
      }

      await spotlightRequestMessageLine(ctx, 600);
      await fillGrpcRequestJsonBody(ctx, JSON.stringify({ message: 'native-test' }, null, 2));
      const prettyBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_JSON_PRETTY_BTN);
      if (prettyBtn && !prettyBtn.disabled) {
        prettyBtn.click();
        await ctx.delay(250);
      }
      ensureRequestMessageLineHighlight();
      await ctx.delay(400);
      await waitForGrpcSendEnabled(ctx);

      await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
      await ctx.click(GRPC.SEND_BTN);
      await ctx.waitFor(GRPC.RESPONSE_BODY);
      await ctx.delay(600);
      await spotlightAndPause(ctx, GRPC.RESPONSE_DURATION, 900);
      await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 900);
      session.firstCallDone = true;
    },
    verify: GRPC.RESPONSE_BODY,
  },

  // =========================================================================
  // Step 4 — Open Native Diagnostics and copy JSON
  // =========================================================================
  {
    id: 'grpc23-diagnostics',
    title: 'Open Native Diagnostics & Copy JSON',
    description:
      'Navigate to **Advanced → Native Diagnostics**. The panel shows a read-only ' +
      'runtime snapshot for the Tauri backend: channel pool health, active call registry ' +
      'counter, stream session tracking, and last transport mode used.\n\n' +
      'On the web app this panel shows a "desktop only" notice instead. Click ' +
      '**Refresh snapshot** to pull the current state from the Rust backend over the Tauri IPC channel. ' +
      'Then click **Copy JSON** — the snapshot is great for bug reports because it captures ' +
      'exactly what the native transport layer was doing at a given instant.',
    highlight: GRPC.ADVANCED_TAB('native_diagnostics'),
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.transportSwitched) await switchToTauriNativeQuiet(ctx);
      if (!session.firstCallDone) {
        await ensureGrpcStudioSubNavQuiet(ctx);
        const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
          await ctx.delay(600);
        }
        session.firstCallDone = true;
      }
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await navigateToAdvancedQuiet(ctx);
      await ctx.delay(400);

      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('native_diagnostics'), 800);

      const diagTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('native_diagnostics'));
      if (diagTab) {
        diagTab.click();
        await ctx.delay(500);
      }

      await ctx.waitFor(GRPC.NATIVE_DIAGNOSTICS_PANEL);
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.NATIVE_DIAGNOSTICS_PANEL, 1000);
      session.inDiagnostics = true;

      await spotlightAndPause(ctx, GRPC.NATIVE_DIAGNOSTICS_REFRESH, 700);
      await ctx.click(GRPC.NATIVE_DIAGNOSTICS_REFRESH);
      await ctx.delay(1200);

      const jsonArea = document.querySelector(GRPC.NATIVE_DIAGNOSTICS_JSON);
      if (jsonArea) {
        await spotlightAndPause(ctx, GRPC.NATIVE_DIAGNOSTICS_JSON, 1000);
      }

      await spotlightAndPause(ctx, GRPC.NATIVE_DIAGNOSTICS_COPY, 700);

      const copyBtn = document.querySelector<HTMLButtonElement>(GRPC.NATIVE_DIAGNOSTICS_COPY);
      if (copyBtn && !copyBtn.disabled) {
        await ctx.click(GRPC.NATIVE_DIAGNOSTICS_COPY);
        await ctx.delay(600);
      }
    },
  },

  // =========================================================================
  // Step 5 — Streaming in native mode
  // =========================================================================
  {
    id: 'grpc23-native-stream',
    title: 'Server streaming in native mode',
    description:
      'Switch back to the **Studio** sub-nav and select `echo.EchoService / ServerStream`. ' +
      'Set `repeat_count` to **5** and `interval_ms` to **300** in the request body, then click **Start** to open a ' +
      'native tonic server-streaming channel.\n\n' +
      'Five messages arrive through the Rust stream relay — no JavaScript in the path. ' +
      'When the stream finishes, return to **Advanced → Native Diagnostics** and click ' +
      '**Refresh** — the stream registry counter now reflects the completed stream.',
    highlight: GRPC.REQUEST_JSON_MESSAGE_LINE,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.transportSwitched) await switchToTauriNativeQuiet(ctx);
      await ensureGrpcStudioSubNavQuiet(ctx);
      const streamMethod = document.querySelector<HTMLElement>(GRPC.METHOD('echo.EchoService', 'ServerStream'));
      if (streamMethod && streamMethod.getAttribute('aria-selected') !== 'true') {
        streamMethod.click();
        await ctx.delay(500);
      }
      const streamPayload = JSON.stringify({
        message: 'stream-native',
        repeat_count: 5,
        interval_ms: 300,
      }, null, 2);
      await fillGrpcRequestJsonBody(ctx, streamPayload);
      ensureRequestMessageLineHighlight();
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.METHOD('echo.EchoService', 'ServerStream'), 900);
      const streamMethod = document.querySelector<HTMLElement>(GRPC.METHOD('echo.EchoService', 'ServerStream'));
      if (streamMethod && streamMethod.getAttribute('aria-selected') !== 'true') {
        streamMethod.click();
        await ctx.delay(900);
      } else {
        await ctx.delay(600);
      }

      await spotlightRequestMessageLine(ctx, 1000);
      await ctx.delay(800);
      await waitForStreamStartEnabled(ctx);

      await spotlightAndPause(ctx, GRPC.STREAM_START_BTN, 900);
      await ctx.click(GRPC.STREAM_START_BTN);
      await ctx.delay(1_350);

      try {
        await ctx.waitFor(GRPC.STREAM_STATUS_BAR, 8_000);
      } catch {
        // Keep lesson flow resilient while still showing pacing.
      }
      try {
        await ctx.waitFor(GRPC.STREAM_LOG_LIST, 8_000);
      } catch {
        // Stream logs can render late on busy desktop sessions.
      }
      await ctx.delay(500);

      const streamedCount = await waitForStreamMessageCount(ctx, 5, 12_000);
      if (streamedCount < 5) {
        // Keep pacing understandable even when fixture delivery is slower than expected.
        await ctx.delay(1_600);
      }

      if (document.querySelector(GRPC.STREAM_LOG_LIST)) {
        await spotlightAndPause(ctx, GRPC.STREAM_LOG_LIST, 1_300);
      }

      await spotlightAndPause(ctx, GRPC.STREAM_STATUS_BAR, 1_350);
      await spotlightAndPause(ctx, GRPC.STREAM_LOG_COUNT, 1_000);

      await ctx.delay(1_100);

      await openNativeDiagnosticsQuiet(ctx);
      session.inDiagnostics = true;
      await ctx.delay(500);

      const refreshBtn = document.querySelector<HTMLButtonElement>(GRPC.NATIVE_DIAGNOSTICS_REFRESH);
      if (refreshBtn && !refreshBtn.disabled) {
        await spotlightAndPause(ctx, GRPC.NATIVE_DIAGNOSTICS_REFRESH, 800);
        refreshBtn.click();
        await ctx.delay(1200);
      }

      if (document.querySelector(GRPC.NATIVE_DIAGNOSTICS_JSON)) {
        await spotlightAndPause(ctx, GRPC.NATIVE_DIAGNOSTICS_JSON, 1_100);
      }
    },
    verify: '.grpc-advanced-panel',
  },

  // =========================================================================
  // Step 6 — Set up mock rules
  // =========================================================================
  {
    id: 'grpc23-mock-setup',
    title: 'Set up a mock rule',
    description:
      'Navigate to **Advanced → Mock Server → Builder** and create a rule in full detail:\n\n' +
      '- **Rule name:** `ping match`\n' +
      '- **Predicate:** `Body path equals`\n' +
      '- **Body path:** `message`\n' +
      '- **Expected value:** `ping`\n' +
      '- **Response body:** `{"message":"pong"}`\n' +
      '- **Status code:** `OK`\n\n' +
      'Then switch to **Runtime** and click **Start mock runtime**. The status chip turns **Running**. ' +
      'From now on, matching calls are intercepted by this mock rule instead of the real backend.',
    highlight: GRPC.MOCK_STATUS,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!isMockServerPanelVisible()) return;
      await stopMockRuntimeQuiet(ctx);
      if (hasMockRulesInDom()) {
        await clearMockRulesQuiet(ctx);
      }
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await openMockBuilderQuiet(ctx);
      await ctx.delay(450);

      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 1_000);

      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_ADD_RULE, 850);
      const addBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_BUILDER_ADD_RULE);
      if (addBtn) {
        addBtn.click();
        await ctx.delay(700);
      }

      const ids = getLastRuleIds();
      if (ids) {
        const newRule = document.querySelector<HTMLElement>(`[data-testid="grpc-mock-builder-rule-${ids.ruleId}"]`);
        if (newRule) {
          await scrollBelowMockAuthoringTabs(ctx, newRule);
          await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-rule-${ids.ruleId}"]`, 900);
        }

        const nameSel = `[data-testid="grpc-mock-builder-name-${ids.ruleId}"]`;
        await spotlightAndPause(ctx, nameSel, 800);
        setMockInputValue(nameSel, 'ping match');
        await ctx.delay(500);

        const kindSel = `[data-testid="grpc-mock-builder-leaf-kind-${ids.nodeId}"]`;
        await spotlightAndPause(ctx, kindSel, 850);
        setSelectValue(kindSel, 'body_path_equals');
        await ctx.delay(600);

        const pathSel = `[data-testid="grpc-mock-builder-leaf-path-${ids.nodeId}"]`;
        await spotlightAndPause(ctx, pathSel, 800);
        setMockInputValue(pathSel, 'message');
        await ctx.delay(450);

        const expectedSel = `[data-testid="grpc-mock-builder-leaf-body-value-${ids.nodeId}"]`;
        await spotlightAndPause(ctx, expectedSel, 800);
        setMockInputValue(expectedSel, 'ping');
        await ctx.delay(500);

        const responseBodySel = `[data-testid="grpc-mock-builder-body-${ids.ruleId}"]`;
        await spotlightAndPause(ctx, responseBodySel, 900);
        setMockInputValue(responseBodySel, JSON.stringify({ message: 'pong' }, null, 2));
        await ctx.delay(700);

        const statusSel = `[data-testid="grpc-mock-builder-status-${ids.ruleId}"]`;
        await spotlightAndPause(ctx, statusSel, 750);
        setSelectValue(statusSel, '0');
        await ctx.delay(500);
      }

      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 1_100);
      await ctx.delay(450);

      await openMockRuntimeTabQuiet(ctx);
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.MOCK_START, 850);
      const startBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_START);
      if (startBtn && !startBtn.disabled) {
        startBtn.click();
        await ctx.delay(900);
      }

      await spotlightAndPause(ctx, GRPC.MOCK_STATUS, 1_100);
      if (document.querySelector(GRPC.MOCK_LISTENER_GENERATION)) {
        await spotlightAndPause(ctx, GRPC.MOCK_LISTENER_GENERATION, 900);
      }
      session.mockRuleAdded = true;
      session.mockRunning = true;
    },
    verify: GRPC.MOCK_STATUS,
  },

  // =========================================================================
  // Step 7 — Enable the Network Listener
  // =========================================================================
  {
    id: 'grpc23-listener-enable',
    title: 'Enable the Mock Network Listener',
    description:
      'In the **Runtime** tab, make sure **Network Listener** is enabled. If the toggle is off, ' +
      'turn it on — the Tauri backend starts a real Rust `tonic` gRPC server and binds it to ' +
      'a local TCP port (e.g. `127.0.0.1:50099`).\n\n' +
      'Once it\'s enabled, the listen address appears in the **Listen target** field. Click ' +
      '**Copy** to copy it — you\'ll paste it into a grpcurl command in the next step.\n\n' +
      '**What this unlocks:** external clients — terminal tools, microservices, CI pipelines — ' +
      'can now call your mock over a real TCP connection, not a Studio-internal channel.',
    highlight: GRPC.MOCK_LISTEN_TARGET,
    preAction: async (_ctx) => {
      if (!isTauri()) return;
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await openMockRuntimeTabQuiet(ctx);
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.MOCK_EXPOSE_NETWORK, 900);

      const listenToggle = document.querySelector<HTMLInputElement>(GRPC.MOCK_EXPOSE_NETWORK);
      if (listenToggle && !listenToggle.checked) {
        listenToggle.click();
        await ctx.delay(900);
      }

      await ctx.waitFor(GRPC.MOCK_LISTEN_TARGET, 6_000);
      await ctx.delay(450);
      await spotlightAndPause(ctx, GRPC.MOCK_LISTEN_TARGET, 1000);

      await spotlightAndPause(ctx, GRPC.MOCK_COPY_LISTEN_TARGET, 800);
      const copyBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_COPY_LISTEN_TARGET);
      if (copyBtn) {
        copyBtn.click();
        await ctx.delay(700);
      }

      session.listenerEnabled = true;
    },
    verify: GRPC.MOCK_EXPOSE_NETWORK,
  },

  // =========================================================================
  // Step 8 — Call the listener externally
  // =========================================================================
  {
    id: 'grpc23-external-call',
    title: 'Call the external listener endpoint (port 50061)',
    description:
      'The **listener port** (e.g. `localhost:50061`) is a real gRPC network socket for **external tools** ' +
      'like `grpcurl`, another microservice, or an integration test runner that needs an explicit address to connect to. ' +
      'It even answers **gRPC ServerReflection**, so tools can discover its services with no local proto files.\n\n' +
      '1. Set the target to the listener address (already copied in the previous step) — for example `localhost:50061`.\n' +
      '2. Click **Reflection** — the listener returns its service tree. Select **Echo**.\n' +
      '3. Enter `{"message":"ping"}` as the request body.\n' +
      '4. Click **Send Unary**.\n' +
      '5. The response is `{"message":"pong"}` — and the target bar still shows the listener port, not 50051.\n\n' +
      '**Contrast:** in a later step you\'ll see that sending to `localhost:50051` (the echo server port) also ' +
      'returns the mock response — because the mock intercepts all Tauri Native calls transparently. ' +
      'Port 50061 is only needed when an external client cannot go through the Tauri transport.',
    highlight: GRPC.TARGET_INPUT,
    preAction: async (_ctx) => {
      if (!isTauri()) return;
    },
    action: async (ctx) => {
      if (!isTauri()) return;

      // Step 7 already left us on Mock Server → Runtime with the listener enabled — read the address directly.
      let listenTarget = readMockListenTargetValue();
      if (!listenTarget) {
        // Guard for rapid-Next / restarted lessons where the listener state was lost.
        listenTarget = await ensureMockListenerReadyQuiet(ctx);
      }

      // Navigate to Studio and set the target to the listener address — it stays there the whole step.
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ctx.delay(300);
      await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
      await ctx.fill(GRPC.TARGET_INPUT, listenTarget || '127.0.0.1:50061');
      // Let the user read the listener address clearly in the target bar
      await ctx.delay(1_000);
      await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 1_000);

      // Reflection → select Echo. Uses reflectAndSelectEchoAtCurrentTarget() (not
      // ensureEchoMethodSelected()) — the latter calls ensureGrpcTarget() internally,
      // which forces the target back to the standard demo address (localhost:50051)
      // whenever it doesn't already match. That would silently undo the listener
      // address we just set above and invalidate its reflection tree.
      await reflectAndSelectEchoAtCurrentTarget(ctx);
      await spotlightRequestMessageLine(ctx, 600);
      await fillGrpcRequestJsonBody(ctx, JSON.stringify({ message: 'ping' }, null, 2));
      await ctx.delay(350);
      await waitForGrpcSendEnabled(ctx);
      await spotlightAndPause(ctx, GRPC.SEND_BTN, 600);
      const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
      if (sendBtn && !sendBtn.disabled) {
        await ctx.click(GRPC.SEND_BTN);
        await ctx.delay(700);
        if (document.querySelector(GRPC.RESPONSE_BODY)) {
          // Spotlight response — "pong" from the mock via the listener socket
          await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 1_500);
        }
        // Spotlight the target bar again — still showing the listener port, confirming the external route
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 1_200);
      }
    },
    verify: GRPC.RESPONSE_BODY,
  },

  // =========================================================================
  // Step 9 — Hot-swap a rule (Builder)
  // =========================================================================
  {
    id: 'grpc23-hot-swap-builder',
    title: 'Hot-swap a rule (Builder)',
    description:
      'Back in the **Builder** tab, add and configure another rule step-by-step:\n\n' +
      '- **Rule name:** `hello match`\n' +
      '- **Predicate:** `Body path equals`\n' +
      '- **Body path:** `message`\n' +
      '- **Expected value:** `hello`\n' +
      '- **Fallback:** leave unchecked\n' +
      '- **Response body:** `{"message":"world"}`\n\n' +
      'We will verify the hot-swap in Runtime in the next step.',
    highlight: CURRENT_RULE_HIGHLIGHT_SELECTOR,
    preAction: async (_ctx) => {
      if (!isTauri()) return;
      if (!isMockServerPanelVisible()) return;
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      if (!isMockServerPanelVisible()) {
        await navigateToAdvancedQuiet(ctx);
        await ctx.delay(300);
        await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('mock_server'), 700);
        const mockTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('mock_server'));
        if (mockTab) {
          mockTab.click();
          await ctx.delay(500);
        }
      }
      const builderTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_BUILDER);
      if (builderTab && builderTab.getAttribute('aria-selected') !== 'true') {
        await spotlightAndPause(ctx, GRPC.MOCK_TAB_BUILDER, 700);
        builderTab.click();
        await ctx.delay(600);
      } else {
        await ctx.delay(200);
      }

      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_ADD_RULE, 800);
      const addBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_BUILDER_ADD_RULE);
      if (addBtn) {
        addBtn.click();
        await ctx.delay(700);
      }

      const ids = getLastRuleIds();
      if (ids) {
        // Tag only the new rule so the persistent step highlight follows it —
        // the existing "ping match" rule above must not stay highlighted.
        tagCurrentRuleHighlight(ids.ruleId);

        const newRule = document.querySelector<HTMLElement>(`[data-testid="grpc-mock-builder-rule-${ids.ruleId}"]`);
        if (newRule) {
          await scrollBelowMockAuthoringTabs(ctx, newRule);
          await spotlightAndPause(ctx, CURRENT_RULE_HIGHLIGHT_SELECTOR, 900);
        }

        const nameSel = `[data-testid="grpc-mock-builder-name-${ids.ruleId}"]`;
        await spotlightAndPause(ctx, nameSel, 800);
        setMockInputValue(nameSel, 'hello match');
        await ctx.delay(500);

        const kindSel = `[data-testid="grpc-mock-builder-leaf-kind-${ids.nodeId}"]`;
        await spotlightAndPause(ctx, kindSel, 800);
        setSelectValue(kindSel, 'body_path_equals');
        await ctx.delay(600);

        const pathSel = `[data-testid="grpc-mock-builder-leaf-path-${ids.nodeId}"]`;
        await spotlightAndPause(ctx, pathSel, 800);
        setMockInputValue(pathSel, 'message');
        await ctx.delay(450);

        const expectedSel = `[data-testid="grpc-mock-builder-leaf-body-value-${ids.nodeId}"]`;
        await spotlightAndPause(ctx, expectedSel, 800);
        setMockInputValue(expectedSel, 'hello');
        await ctx.delay(500);

        const responseBodySel = `[data-testid="grpc-mock-builder-body-${ids.ruleId}"]`;
        await spotlightAndPause(ctx, responseBodySel, 900);
        setMockInputValue(responseBodySel, JSON.stringify({ message: 'world' }, null, 2));
        await ctx.delay(700);
      }
      await ctx.delay(300);
    },
    verify: GRPC.MOCK_BUILDER_PANEL,
  },

  // =========================================================================
  // Step 10 — Hot-swap verification (Runtime)
  // =========================================================================
  {
    id: 'grpc23-hot-swap-runtime',
    title: 'Verify hot-swap via transparent interception (port 50051)',
    description:
      'Switch to **Runtime** and watch the **Listener generation** chip increment — the rules were ' +
      'hot-swapped with no port restart.\n\n' +
      '**This time, keep the target at `localhost:50051`** — the real echo server\'s port. ' +
      'Send `{"message":"hello"}`. Even though you\'re not using the listener port (50061), ' +
      'the mock **transparently intercepts** the call and returns `{"message":"world"}`.\n\n' +
      '**Why both ports work:**\n' +
      '- `50061` — the external socket. External tools connect here explicitly.\n' +
      '- `50051` — the echo server\'s port. The mock intercepts all Tauri Native calls ' +
      'at the transport layer before they reach the real server, regardless of target port.\n\n' +
      'The target bar stays at `localhost:50051` the entire time — yet the mock\'s new rule replies. ' +
      'Then inspect the **Listener log** and stop the runtime.',
    highlight: GRPC.MOCK_LISTENER_GENERATION,
    preAction: async (_ctx) => {
      if (!isTauri()) return;
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      if (!isMockServerPanelVisible()) {
        await navigateToAdvancedQuiet(ctx);
        await ctx.delay(300);
        await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('mock_server'), 700);
        const mockTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('mock_server'));
        if (mockTab) {
          mockTab.click();
          await ctx.delay(500);
        }
      }
      if (!isMockRuntimeTabActive()) {
        const runtimeTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_RUNTIME);
        if (runtimeTab) {
          await spotlightAndPause(ctx, GRPC.MOCK_TAB_RUNTIME, 650);
          runtimeTab.click();
          await ctx.delay(500);
        }
      } else {
        await ctx.delay(300);
      }

      const genCounter = document.querySelector(GRPC.MOCK_LISTENER_GENERATION);
      if (genCounter) {
        await spotlightAndPause(ctx, GRPC.MOCK_LISTENER_GENERATION, 900);
      }

      // Navigate to Studio — ensure target is at localhost:50051 (not the 50061 from previous step)
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ctx.delay(250);
      await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);
      await ctx.delay(400);
      // Spotlight the target — user sees localhost:50051 before we send
      await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 1_200);
      await ensureEchoMethodSelected(ctx);
      await spotlightRequestMessageLine(ctx, 650);
      await fillGrpcRequestJsonBody(ctx, JSON.stringify({ message: 'hello' }, null, 2));
      await ctx.delay(350);
      await waitForGrpcSendEnabled(ctx);
      await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
      const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
      if (sendBtn && !sendBtn.disabled) {
        await ctx.click(GRPC.SEND_BTN);
        await ctx.delay(700);
        if (document.querySelector(GRPC.RESPONSE_BODY)) {
          // "world" comes back even though we targeted 50051 — transparent interception at work
          await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 1_500);
        }
        // Spotlight target again — still showing localhost:50051, yet mock replied
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 1_200);
      }

      await openMockRuntimeTabQuiet(ctx);
      await ctx.delay(300);
      if (document.querySelector(GRPC.MOCK_LISTENER_LOG)) {
        await spotlightAndPause(ctx, GRPC.MOCK_LISTENER_LOG, 700);
      }

      await stopMockRuntimeQuiet(ctx);
    },
    verify: '.grpc-advanced-panel',
  },

  // =========================================================================
  // Step 11 — Desktop default transport behavior
  // =========================================================================
  {
    id: 'grpc23-default-tauri',
    title: 'New desktop tabs default to Tauri Native',
    description:
      'On desktop, every newly created Studio tab starts in **Tauri Native** mode by default. ' +
      'That means you get the Rust `tonic` path immediately without re-opening Settings.\n\n' +
      'Create a fresh tab and check the transport badge in the connection bar. This default ' +
      'keeps everyday desktop workflows on the native stack unless you intentionally switch.',
    highlight: GRPC.ADD_TAB,
    preAction: async (_ctx) => {
      if (!isTauri()) return;
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ctx.delay(260);

      await spotlightAndPause(ctx, GRPC.ADD_TAB, 750);
      const addTabBtn = document.querySelector<HTMLButtonElement>(GRPC.ADD_TAB);
      if (addTabBtn && !addTabBtn.disabled) {
        addTabBtn.click();
        await ctx.delay(900);
      }

      const targetInput = document.querySelector<HTMLInputElement>(GRPC.TARGET_INPUT);
      if (targetInput && !targetInput.value.trim()) {
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 700);
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);
        await ctx.delay(900);
      }

      await spotlightAndPause(ctx, GRPC.TRANSPORT_BADGE, 1_000);
    },
    verify: GRPC.TRANSPORT_BADGE,
  },

  // =========================================================================
  // Step 12 — Desktop secret vault behavior
  // =========================================================================
  {
    id: 'grpc23-secret-vault',
    title: 'Desktop auth secrets use encrypted vault storage',
    description:
      'Open the **Auth** tab in the request panel, switch to **Bearer**, and enter a token. ' +
      'In desktop mode, ' +
      'auth secrets are stored via the desktop vault path so they can be restored later ' +
      'without keeping plain values in request JSON.\n\n' +
      'In the web build, auth secrets are session-scoped by default. This desktop vault behavior ' +
      'is one of the key platform differences for production-like workflows.',
    highlight: GRPC.AUTH_BEARER_TOKEN,
    preAction: async (_ctx) => {
      if (!isTauri()) return;
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await ensureGrpcStudioSubNavQuiet(ctx);
      const authTabBtn = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_AUTH);
      if (authTabBtn && !authTabBtn.disabled && authTabBtn.getAttribute('aria-pressed') !== 'true') {
        authTabBtn.click();
        await ctx.delay(250);
      }

      await spotlightAndPause(ctx, GRPC.AUTH_TYPE_SELECT, 800);
      await ctx.selectOption(GRPC.AUTH_TYPE_SELECT, 'bearer');
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.AUTH_BEARER_TOKEN, 1_000);
      await ctx.fill(GRPC.AUTH_BEARER_TOKEN, 'desktop-vault-demo-token');
      await ctx.delay(600);

      await spotlightAndPause(ctx, GRPC.AUTH_BADGE, 900);
      session.authConfigured = true;
    },
    verify: GRPC.AUTH_BADGE,
  },

  // =========================================================================
  // Step 13 — Native preflight fallback path
  // =========================================================================
  {
    id: 'grpc23-native-fallback',
    title: 'Recover quickly when native preflight fails',
    description:
      'If a native call cannot start (TLS or reachability preflight issues), the error panel can ' +
      'offer **Retry with Express Proxy** so you can keep testing while you investigate.\n\n' +
      'In this clean demo state there may be no error banner, so we show the manual fallback path: ' +
      'open **Settings → Transport**, switch to **Express Proxy**, then switch back to **Tauri Native** ' +
      'once the issue is resolved.',
    highlight: GRPC.CONNECTION_SETTINGS_BTN,
    preAction: async (_ctx) => {
      if (!isTauri()) return;
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ctx.delay(250);

      const retryExpressBtn = document.querySelector<HTMLButtonElement>(GRPC.RETRY_EXPRESS_BTN);
      if (retryExpressBtn && !retryExpressBtn.disabled) {
        await spotlightAndPause(ctx, GRPC.RESPONSE_ERROR_PANEL, 1_000);
        await spotlightAndPause(ctx, GRPC.RETRY_EXPRESS_BTN, 1_000);
        await ctx.delay(450);
        return;
      }

      await spotlightAndPause(ctx, GRPC.CONNECTION_SETTINGS_BTN, 700);
      if (!document.querySelector(GRPC.SETTINGS_DRAWER)) {
        await ctx.click(GRPC.CONNECTION_SETTINGS_BTN);
        await ctx.waitFor(GRPC.SETTINGS_DRAWER);
        await ctx.delay(450);
      }

      await spotlightAndPause(ctx, GRPC.SETTINGS_NAV_ITEM('transport'), 700);
      const transportNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
      if (transportNav) {
        transportNav.click();
        await ctx.delay(450);
      }
      await ctx.waitFor(GRPC.TRANSPORT_PANEL);
      await ctx.delay(350);

      await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 1_000);
      const expressCard = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('express'));
      if (expressCard && !expressCard.disabled) {
        expressCard.click();
        await ctx.delay(450);
      }

      await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('tauri'), 800);
      const tauriCard = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('tauri'));
      if (tauriCard && !tauriCard.disabled) {
        tauriCard.click();
        await ctx.delay(450);
      }
      await ctx.click(GRPC.SETTINGS_CLOSE);
      await ctx.delay(500);
    },
    verify: GRPC.TRANSPORT_BADGE,
  },
];

// ---------------------------------------------------------------------------
// Concept slide
// ---------------------------------------------------------------------------

const concept: GrpcDemoLesson['concept'] = {
  title: 'Tauri Native — Rust All the Way to the Server',
  body:
    'RedfireForge ships two gRPC transport backends:\n\n' +
    '| Transport | Path | Available |\n' +
    '|---|---|---|\n' +
    '| **Express Proxy** | Browser → Node.js `@grpc/grpc-js` → gRPC server | Web + Desktop |\n' +
    '| **Tauri Native** | Desktop → Rust `tonic` channel pool → gRPC server | Desktop only |\n\n' +
    'The native path removes the JavaScript relay hop. This matters for:\n\n' +
    '- **Lower latency** in high-throughput streaming scenarios\n' +
    '- **Mock Network Listener** — a real Rust TCP server that external tools can connect to\n' +
    '- **Channel pool diagnostics** — runtime snapshot of open channels, call counters, ' +
    'and stream lifecycle state via the Tauri IPC bridge\n' +
    '- **Desktop secret vault behavior** — auth secrets persist via encrypted local storage path\n' +
    '- **Native fallback controls** — quick recovery path to Express when preflight checks fail\n\n' +
    '**Mock Network Listener** binds a `tonic` gRPC server to a local TCP port. ' +
    'When you change mock rules, the listener hot-swaps them in without restarting — ' +
    'the Listener generation counter increments each time. This lets CI pipelines and ' +
    'microservices connect to the mock over a real port without Studio acting as a proxy.',
  keyTerms: [
    { term: 'Tauri Native transport', definition: 'Rust tonic gRPC channel managed by the Tauri backend — no Node.js relay in the call path.' },
    { term: 'Channel pool', definition: 'Pool of reusable tonic channels keyed by target + TLS config. Stats visible in Native Diagnostics.' },
    { term: 'Native Diagnostics', definition: 'Read-only Advanced tab showing a runtime snapshot: channel pool, call registry, stream tracking, last error.' },
    { term: 'Mock Network Listener', definition: 'Desktop-only Rust gRPC server bound to a real TCP port — external clients connect directly.' },
    { term: 'Listener generation', definition: 'Counter that increments each time mock rules are hot-swapped without restarting the listener.' },
    { term: 'Desktop secret vault', definition: 'Desktop path stores auth secrets with encrypted-local persistence semantics for restore across sessions.' },
    { term: 'Native preflight fallback', definition: 'On transport start failures, Studio can offer a quick switch/retry path through Express Proxy.' },
  ],
};

// ---------------------------------------------------------------------------
// Exported lesson
// ---------------------------------------------------------------------------

export const grpcTauriDesktopLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC23_ROSTER),
  desktopOnly: true,
  domainId: 'protocols',
  category: 'grpc',
  grpc: buildGrpcContractMetaFromRoster(GRPC23_ROSTER),
  description:
    'Unlock the features that only exist in the RedfireForge desktop app: switch to Rust ' +
    'tonic native transport, inspect the live channel pool via Native Diagnostics, run a ' +
    'streaming call through the native stack, expose the Mock Network Listener for external ' +
    'TCP clients, and understand desktop-only secret vault + native fallback behavior.',
  concept,
  steps,
  setup: async (ctx) => {
    resetSession();
    await grpcFirstCallSetup(ctx);
    if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) {
      await resetGrpcManageSchemasDraftsQuiet(ctx);
    }
    if (isTauri()) {
      await ensureMockRuntimeStoppedQuiet(ctx);
      await setGrpcTargetQuiet(ctx, GRPC_DEMO_TARGET);
    }
  },
  cleanup: async (ctx) => {
    if (isTauri()) {
      await stopMockRuntimeQuiet(ctx);
      await resetTransportToExpressQuiet(ctx);
    }
    await grpcFirstCallCleanup(ctx);
    resetSession();
  },
};
