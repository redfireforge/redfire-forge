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
  ensureGrpcStudioSubNavQuiet,
  fillGrpcRequestJsonBody,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  resetGrpcManageSchemasDraftsQuiet,
  setGrpcTargetQuiet,
  spotlightAndPause,
  spotlightResponseJsonContentTight,
} from './grpc-lesson-helpers';
import {
  getLastRuleIds,
  scrollBelowMockAuthoringTabs,
  setMockInputValue,
  setSelectValue,
} from './grpc-mock-server-helpers';
import {
  CURRENT_RULE_HIGHLIGHT_SELECTOR,
  clearMockRulesQuiet,
  ensureMockListenerReadyQuiet,
  ensureMockRuntimeStoppedQuiet,
  ensureRequestMessageLineHighlight,
  grpcTauriDesktopSession as session,
  hasMockRulesInDom,
  isMockRuntimeTabActive,
  isMockServerPanelVisible,
  navigateToAdvancedQuiet,
  openMockBuilderQuiet,
  openMockRuntimeTabQuiet,
  openNativeDiagnosticsQuiet,
  readMockListenTargetValue,
  reflectAndSelectEchoAtCurrentTarget,
  resetGrpcTauriDesktopSession as resetSession,
  resetTransportToExpressQuiet,
  spotlightRequestMessageLine,
  stopMockRuntimeQuiet,
  switchToTauriNativeQuiet,
  tagCurrentRuleHighlight,
  waitForGrpcSendEnabled,
  waitForStreamMessageCount,
  waitForStreamStartEnabled,
} from './grpc-tauri-desktop-helpers';
import { grpcTauriDesktopConcept as concept, grpcTauriDesktopDescriptions as copy } from './grpc-tauri-desktop.content';

// ---------------------------------------------------------------------------
// Roster entry
// ---------------------------------------------------------------------------

const GRPC23_ROSTER = getGrpcLessonRosterEntry('grpc-tauri-desktop')!;

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
    description: copy.intro,
    highlight: GRPC.CONNECTION_SETTINGS_BTN,
    preAction: async (ctx) => {
      if (!isTauri()) return;
      // Setup already normalizes base session; keep intro guard minimal.
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
    description: copy.nativeMode,
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
    description: copy.nativeCall,
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
    description: copy.diagnostics,
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
    description: copy.nativeStream,
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
    description: copy.mockSetup,
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
    description: copy.listenerEnable,
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
    description: copy.externalCall,
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
          await spotlightResponseJsonContentTight(ctx, 1_500);
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
    description: copy.hotSwapBuilder,
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
    description: copy.hotSwapRuntime,
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
          await spotlightResponseJsonContentTight(ctx, 1_500);
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
    description: copy.defaultTauri,
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
    description: copy.secretVault,
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
    description: copy.nativeFallback,
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
    await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
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
