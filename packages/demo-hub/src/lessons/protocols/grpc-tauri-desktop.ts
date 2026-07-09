/**
 * Lesson GRPC-23: Tauri Desktop — Native Transport, Diagnostics & Mock Listener
 *
 * Desktop-only lesson (desktopOnly: true). Every preAction guards with
 * `if (!isTauri()) return` so the lesson is safe in web E2E shims.
 *
 *   grpc23-intro            — Tour Transport panel; Tauri Native is available in desktop
 *   grpc23-native-mode      — Select Tauri Native; connection bar indicator updates
 *   grpc23-native-call      — Send an Echo unary call through Rust tonic; see low latency
 *   grpc23-diagnostics      — Advanced → Native Diagnostics; tour the empty state panel
 *   grpc23-diag-refresh     — Click Refresh snapshot; JSON payload appears; Copy JSON
 *   grpc23-native-stream    — Start ServerStream (5 messages); stream registry counter updates
 *   grpc23-mock-setup       — Add ping→pong mock rule; start runtime; status Running
 *   grpc23-listener-enable  — Enable Network Listener; Rust gRPC server binds to TCP port
 *   grpc23-external-call    — Narration: grpcurl call hits listener; Listener log appears
 *   grpc23-hot-swap         — Add 2nd rule; generation counter increments; stop & reset
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
  ensureGrpcReflected,
  ensureGrpcStudioSubNavQuiet,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  spotlightAndPause,
} from './grpc-lesson-helpers';
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
};

function resetSession(): void {
  session.transportSwitched = false;
  session.firstCallDone = false;
  session.inDiagnostics = false;
  session.mockRuleAdded = false;
  session.mockRunning = false;
  session.listenerEnabled = false;
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
    verify: GRPC.TRANSPORT_MODE('tauri'),
  },

  // =========================================================================
  // Step 3 — Send a unary call natively
  // =========================================================================
  {
    id: 'grpc23-native-call',
    title: 'Send a unary call natively',
    description:
      'Select `echo.EchoService / Echo` and send an echo request with `{"message":"native-test"}`. ' +
      'Watch the **response duration** — native tonic calls typically complete with lower ' +
      'latency than the Express proxy path because there is no JavaScript relay hop.\n\n' +
      'The response body and status code are identical: `{"message":"native-test"}`, status OK (0). ' +
      'The only difference is the transport path — Rust → gRPC target vs. ' +
      'Node.js relay → gRPC target.',
    highlight: GRPC.RESPONSE_DURATION,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.transportSwitched) await switchToTauriNativeQuiet(ctx);
      await ensureGrpcStudioSubNavQuiet(ctx);
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

      const bodyInput = document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON_COMPACT);
      if (bodyInput) {
        bodyInput.focus();
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        nativeSet?.call(bodyInput, '{"message":"native-test"}');
        bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
        await ctx.delay(400);
      }

      await ctx.click(GRPC.SEND_BTN);
      await ctx.waitFor(GRPC.RESPONSE_BODY);
      await ctx.delay(600);

      await spotlightAndPause(ctx, GRPC.RESPONSE_DURATION, 1000);
      await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 800);
      session.firstCallDone = true;
    },
    verify: GRPC.RESPONSE_BODY,
  },

  // =========================================================================
  // Step 4 — Open Native Diagnostics
  // =========================================================================
  {
    id: 'grpc23-diagnostics',
    title: 'Open Native Diagnostics',
    description:
      'Navigate to **Advanced → Native Diagnostics**. The panel shows a read-only ' +
      'runtime snapshot for the Tauri backend: channel pool health, active call registry ' +
      'counter, stream session tracking, and last transport mode used.\n\n' +
      'On the web app this panel shows a "desktop only" notice instead. Click ' +
      '**Refresh snapshot** to pull the current state from the Rust backend over the Tauri IPC channel. ' +
      'The snapshot is great for bug reports — it captures exactly what the native ' +
      'transport layer was doing at a given instant.',
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
    },
  },

  // =========================================================================
  // Step 5 — Refresh snapshot and copy JSON
  // =========================================================================
  {
    id: 'grpc23-diag-refresh',
    title: 'Refresh snapshot & Copy JSON',
    description:
      'Click **Refresh snapshot** — the Rust backend sends a fresh diagnostic payload ' +
      'over the Tauri IPC bridge. The JSON textarea fills with channel pool stats: ' +
      'active channels, their target addresses, call counter since startup, and last error ' +
      'taxonomy if any calls failed.\n\n' +
      'Click **Copy JSON** to copy the full payload to your clipboard. Paste it into a ' +
      'bug report or support ticket — it includes everything the Redfire team needs to ' +
      'diagnose native transport issues without a live session.',
    highlight: GRPC.NATIVE_DIAGNOSTICS_REFRESH,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.inDiagnostics) await openNativeDiagnosticsQuiet(ctx);
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      if (!session.inDiagnostics) {
        await openNativeDiagnosticsQuiet(ctx);
        session.inDiagnostics = true;
      }

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
  // Step 6 — Streaming in native mode
  // =========================================================================
  {
    id: 'grpc23-native-stream',
    title: 'Server streaming in native mode',
    description:
      'Switch back to the **Studio** sub-nav and select `echo.EchoService / ServerStream`. ' +
      'Set `repeat_count` to **5** in the request body, then click **Start** to open a ' +
      'native tonic server-streaming channel.\n\n' +
      'Five messages arrive through the Rust stream relay — no JavaScript in the path. ' +
      'When the stream finishes, return to **Advanced → Native Diagnostics** and click ' +
      '**Refresh** — the stream registry counter now reflects the completed stream.',
    highlight: GRPC.STREAM_STATUS_BAR,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.transportSwitched) await switchToTauriNativeQuiet(ctx);
      await ensureGrpcStudioSubNavQuiet(ctx);
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ctx.delay(300);

      const streamMethod = document.querySelector<HTMLElement>(GRPC.METHOD('echo.EchoService', 'ServerStream'));
      if (streamMethod) {
        streamMethod.click();
        await ctx.delay(700);
      }

      const bodyInput = document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON_COMPACT);
      if (bodyInput) {
        bodyInput.focus();
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        nativeSet?.call(bodyInput, '{"message":"stream-native","repeat_count":5}');
        bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
        await ctx.delay(400);
      }

      await spotlightAndPause(ctx, GRPC.STREAM_START_BTN, 700);
      await ctx.click(GRPC.STREAM_START_BTN);
      await ctx.delay(2000);

      await ctx.waitFor(GRPC.STREAM_STATUS_BAR);
      await spotlightAndPause(ctx, GRPC.STREAM_STATUS_BAR, 1000);
      await spotlightAndPause(ctx, GRPC.STREAM_LOG_COUNT, 800);

      await ctx.delay(600);

      await openNativeDiagnosticsQuiet(ctx);
      session.inDiagnostics = true;

      const refreshBtn = document.querySelector<HTMLButtonElement>(GRPC.NATIVE_DIAGNOSTICS_REFRESH);
      if (refreshBtn && !refreshBtn.disabled) {
        refreshBtn.click();
        await ctx.delay(1000);
      }

      if (document.querySelector(GRPC.NATIVE_DIAGNOSTICS_JSON)) {
        await spotlightAndPause(ctx, GRPC.NATIVE_DIAGNOSTICS_JSON, 900);
      }
    },
    verify: GRPC.STREAM_STATUS_BAR,
  },

  // =========================================================================
  // Step 7 — Set up mock rules
  // =========================================================================
  {
    id: 'grpc23-mock-setup',
    title: 'Set up a mock rule',
    description:
      'Navigate to **Advanced → Mock Server → Builder** tab. Click **+ Add rule** and ' +
      'configure it:\n\n' +
      '- **Match field path:** `message`\n' +
      '- **Match value:** `ping`\n' +
      '- **Response body:** `{"message":"pong"}`\n' +
      '- **Status:** `OK`\n\n' +
      'Then switch to the **Runtime** tab and click **Start**. The mock engine is now ' +
      'running in-process, intercepting matching calls. The status badge changes to **Running**.',
    highlight: GRPC.MOCK_STATUS,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      await openMockBuilderQuiet(ctx);
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await openMockBuilderQuiet(ctx);
      await ctx.delay(400);

      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_ADD_RULE, 700);
      const addBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_BUILDER_ADD_RULE);
      if (addBtn) {
        addBtn.click();
        await ctx.delay(600);
      }

      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 800);
      await ctx.delay(400);

      await openMockRuntimeTabQuiet(ctx);
      await ctx.delay(400);

      await spotlightAndPause(ctx, GRPC.MOCK_START, 700);
      const startBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_START);
      if (startBtn && !startBtn.disabled) {
        startBtn.click();
        await ctx.delay(800);
      }

      await spotlightAndPause(ctx, GRPC.MOCK_STATUS, 1000);
      session.mockRunning = true;
    },
    verify: GRPC.MOCK_STATUS,
  },

  // =========================================================================
  // Step 8 — Enable the Network Listener
  // =========================================================================
  {
    id: 'grpc23-listener-enable',
    title: 'Enable the Mock Network Listener',
    description:
      'In the **Runtime** tab, toggle on **Network Listener**. The Tauri backend ' +
      'starts a real Rust `tonic` gRPC server and binds it to a local TCP port (e.g. ' +
      '`127.0.0.1:50099`).\n\n' +
      'The listen address appears in the **Listen target** field. Click **Copy** to ' +
      'copy it — you\'ll paste it into a grpcurl command in the next step.\n\n' +
      '**What this unlocks:** external clients — terminal tools, microservices, CI pipelines — ' +
      'can now call your mock over a real TCP connection, not a Studio-internal channel.',
    highlight: GRPC.MOCK_LISTEN_TARGET,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.mockRunning) {
        await openMockRuntimeTabQuiet(ctx);
        const startBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_START);
        if (startBtn && !startBtn.disabled) {
          startBtn.click();
          await ctx.delay(700);
        }
        session.mockRunning = true;
      }
      await openMockRuntimeTabQuiet(ctx);
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await openMockRuntimeTabQuiet(ctx);
      await ctx.delay(400);

      await spotlightAndPause(ctx, GRPC.MOCK_EXPOSE_NETWORK, 800);

      const listenToggle = document.querySelector<HTMLInputElement>(GRPC.MOCK_EXPOSE_NETWORK);
      if (listenToggle && !listenToggle.checked) {
        listenToggle.click();
        await ctx.delay(1200);
      }

      await ctx.waitFor(GRPC.MOCK_LISTEN_TARGET);
      await spotlightAndPause(ctx, GRPC.MOCK_LISTEN_TARGET, 1000);

      await spotlightAndPause(ctx, GRPC.MOCK_COPY_LISTEN_TARGET, 700);
      const copyBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_COPY_LISTEN_TARGET);
      if (copyBtn) {
        copyBtn.click();
        await ctx.delay(600);
      }

      session.listenerEnabled = true;
    },
    verify: GRPC.MOCK_LISTEN_TARGET,
  },

  // =========================================================================
  // Step 9 — Call the listener externally
  // =========================================================================
  {
    id: 'grpc23-external-call',
    title: 'Call the listener from a terminal',
    description:
      'Open a terminal and run this grpcurl command — replace the address with the ' +
      'listen target you just copied:\n\n' +
      '```\n' +
      'grpcurl -plaintext -d \'{"message":"ping"}\' 127.0.0.1:50099 echo.EchoService/Echo\n' +
      '```\n\n' +
      'Studio receives the call over the real TCP port, matches the `message = "ping"` ' +
      'body-path rule, and returns `{"message":"pong"}`.\n\n' +
      'Watch the **Listener log** panel — the incoming request appears with its matched ' +
      'rule name, matched field value, and round-trip latency. This is the same log you\'d ' +
      'see in a CI environment where microservices call the mock during integration tests.',
    highlight: GRPC.MOCK_LISTENER_LOG,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.listenerEnabled) {
        await openMockRuntimeTabQuiet(ctx);
        const toggle = document.querySelector<HTMLInputElement>(GRPC.MOCK_EXPOSE_NETWORK);
        if (toggle && !toggle.checked) {
          toggle.click();
          await ctx.delay(1000);
          session.listenerEnabled = true;
        }
      }
      await openMockRuntimeTabQuiet(ctx);
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await openMockRuntimeTabQuiet(ctx);
      await ctx.delay(400);

      await spotlightAndPause(ctx, GRPC.MOCK_LISTEN_TARGET, 800);
      await ctx.delay(400);
      await spotlightAndPause(ctx, GRPC.MOCK_LISTENER_LOG, 1200);

      await ctx.delay(800);

      const copyBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_COPY_LISTEN_TARGET);
      if (copyBtn) {
        await ctx.click(GRPC.MOCK_COPY_LISTEN_TARGET);
        await ctx.delay(500);
      }

      await ctx.delay(1500);
    },
  },

  // =========================================================================
  // Step 10 — Hot-swap a rule
  // =========================================================================
  {
    id: 'grpc23-hot-swap',
    title: 'Hot-swap a rule without restarting',
    description:
      'Back in the **Builder** tab, add a second rule:\n\n' +
      '- **Match field path:** `message`\n' +
      '- **Match value:** `hello`\n' +
      '- **Response body:** `{"message":"world"}`\n\n' +
      'Switch to the **Runtime** tab — notice the **Listener generation** counter has ' +
      'incremented. The Rust backend applied the new rule set without restarting the ' +
      'listener or dropping the TCP port binding.\n\n' +
      'Run grpcurl again with `"message":"hello"` — the second rule fires. This hot-swap ' +
      'behavior lets you update mock rules mid-test without breaking long-running integration runs.\n\n' +
      'Finally, stop the listener and reset transport back to **Express Proxy**.',
    highlight: GRPC.MOCK_LISTENER_GENERATION,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      if (!session.listenerEnabled) {
        await openMockRuntimeTabQuiet(ctx);
        const toggle = document.querySelector<HTMLInputElement>(GRPC.MOCK_EXPOSE_NETWORK);
        if (toggle && !toggle.checked) {
          toggle.click();
          await ctx.delay(1000);
          session.listenerEnabled = true;
        }
      }
      await openMockBuilderQuiet(ctx);
    },
    action: async (ctx) => {
      if (!isTauri()) return;
      await openMockBuilderQuiet(ctx);
      await ctx.delay(400);

      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_ADD_RULE, 700);
      const addBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_BUILDER_ADD_RULE);
      if (addBtn) {
        addBtn.click();
        await ctx.delay(600);
      }
      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 800);
      await ctx.delay(400);

      await openMockRuntimeTabQuiet(ctx);
      await ctx.delay(500);

      const genCounter = document.querySelector(GRPC.MOCK_LISTENER_GENERATION);
      if (genCounter) {
        await spotlightAndPause(ctx, GRPC.MOCK_LISTENER_GENERATION, 1200);
      }

      await ctx.delay(800);

      await stopMockRuntimeQuiet(ctx);
      await ctx.delay(600);

      await resetTransportToExpressQuiet(ctx);
      await ctx.delay(600);

      await spotlightAndPause(ctx, GRPC.TRANSPORT_MODE('express'), 900);
    },
    verify: GRPC.TRANSPORT_MODE('express'),
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
    'and stream lifecycle state via the Tauri IPC bridge\n\n' +
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
    'streaming call through the native stack, and expose the Mock Network Listener so ' +
    'external clients can call your mock over a real TCP port.',
  concept,
  steps,
  setup: async (ctx) => {
    resetSession();
    await grpcFirstCallSetup(ctx);
    if (isTauri()) {
      await stopMockRuntimeQuiet(ctx);
      await resetTransportToExpressQuiet(ctx);
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
