/**
 * Lesson GRPC-13: Mocking gRPC APIs: Rules & Network Listener
 *
 * Teaches learners to build predicate-based mock rules in the visual Builder,
 * start the in-process mock runtime, verify that the correct rule fires from
 * the Studio call panel, export the rule set as JSON, and understand the
 * desktop-only Network Listener feature.
 *
 *   grpc13-intro         — Advanced → Mock server; tour Builder / JSON / Runtime tabs
 *   grpc13-rule-ping     — Add "Ping match" rule: body_path_equals message=ping → pong OK
 *   grpc13-rule-fallback — Add "Fallback" rule: body_path_exists message → INTERNAL
 *   grpc13-latency       — Runtime tab: set global default latency 100ms + jitter 20ms
 *   grpc13-start         — Start mock runtime; spotlight Running status
 *   grpc13-test-ping     — Studio: send message=ping; mock returns {message:"pong"}
 *   grpc13-test-fallback — Studio: send message=other; fallback fires with INTERNAL error
 *   grpc13-json-export   — JSON tab: show rule set; Copy rules JSON
 *   grpc13-network-listen — Network Listener narration (desktop-only feature)
 */
import { GRPC } from '@shared/selectors';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  closeGrpcSettingsDrawerQuiet,
  clearGrpcSchemaDriftQuiet,
  ensureEchoMessageFilled,
  ensureGrpcReflected,
  ensureGrpcStudioSubNavQuiet,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import type { DemoActionContext } from '../../types';

// ---------------------------------------------------------------------------
// Roster entry
// ---------------------------------------------------------------------------

const GRPC13_ROSTER = getGrpcLessonRosterEntry('grpc-mock-server')!;

// ---------------------------------------------------------------------------
// Demo constants
// ---------------------------------------------------------------------------

/** Body-path equals rule: fires when request body has message == "ping". */
const PING_RULE_NAME = 'Ping match';
const PING_BODY_PATH = 'message';
const PING_MATCH_VALUE = 'ping';
const PING_RESPONSE_BODY = '{"message":"pong"}';

/** Fallback rule: fires when request body has any message field. */
const FALLBACK_RULE_NAME = 'Fallback';
const FALLBACK_BODY_PATH = 'message';
const FALLBACK_STATUS_CODE = 13; // gRPC INTERNAL

/** Test messages for the two rules. */
const TEST_MESSAGE_PING = 'ping';
const TEST_MESSAGE_OTHER = 'other-request';

/** Global latency for the runtime demo. */
const DEMO_LATENCY_MS = 100;
const DEMO_JITTER_MS = 20;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Navigate to Advanced sub-nav and select the Mock server tab. */
async function navigateToMockServerPanelQuiet(ctx: DemoActionContext): Promise<void> {
  const advBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (!advBtn) {
    await navigateToGrpcStudio(ctx);
    await ctx.delay(400);
  }
  const advEl = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (advEl && advEl.getAttribute('aria-selected') !== 'true') {
    advEl.click();
    await ctx.delay(500);
  }
  const mockTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('mock_server'));
  if (mockTab && mockTab.getAttribute('aria-selected') !== 'true') {
    mockTab.click();
    await ctx.delay(400);
  }
}

/** Switch the mock authoring sub-tab (builder | json | runtime). */
async function selectMockAuthoringTab(
  ctx: DemoActionContext,
  tab: 'builder' | 'json' | 'runtime',
): Promise<void> {
  const sel = tab === 'builder' ? GRPC.MOCK_TAB_BUILDER
    : tab === 'json' ? GRPC.MOCK_TAB_JSON
    : GRPC.MOCK_TAB_RUNTIME;
  const btn = document.querySelector<HTMLButtonElement>(sel);
  if (btn && btn.getAttribute('aria-selected') !== 'true') {
    btn.click();
    await ctx.delay(350);
  }
}

/** Get the ruleId and leaf nodeId for the LAST rule in the builder. */
function getLastRuleIds(): { ruleId: string; nodeId: string } | null {
  const ruleEls = document.querySelectorAll<HTMLElement>('[data-testid^="grpc-mock-builder-rule-"]');
  const lastRule = ruleEls[ruleEls.length - 1];
  if (!lastRule) return null;
  const ruleId = lastRule.getAttribute('data-testid')!.replace('grpc-mock-builder-rule-', '');
  const leafKindEl = lastRule.querySelector<HTMLSelectElement>('[data-testid^="grpc-mock-builder-leaf-kind-"]');
  const nodeId = leafKindEl?.getAttribute('data-testid')?.replace('grpc-mock-builder-leaf-kind-', '') ?? '';
  return { ruleId, nodeId };
}

/** Set a React-controlled select element value. */
function setSelectValue(selector: string, value: string): void {
  const el = document.querySelector<HTMLSelectElement>(selector);
  if (!el) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Set a React-controlled input or textarea value. */
function setMockInputValue(selector: string, value: string): void {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Quietly stop the mock runtime if it is running. */
async function stopMockQuiet(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.MOCK_STOP)) {
    const stopBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_STOP);
    stopBtn?.click();
    await ctx.delay(500);
  }
}

/** Quietly start the mock runtime if it is not already running. */
async function startMockQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToMockServerPanelQuiet(ctx);
  if (document.querySelector(GRPC.MOCK_STOP)) return; // already running
  const startBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_START);
  if (startBtn && !startBtn.disabled) {
    startBtn.click();
    await ctx.delay(600);
  }
}

/**
 * Silently reset the mock rule set to the two demo rules.
 * Uses the JSON tab to patch the full rules JSON at once — avoids
 * repeated builder clicks that would be slow in preAction guards.
 */
async function ensureDemoRulesQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToMockServerPanelQuiet(ctx);
  await selectMockAuthoringTab(ctx, 'json');
  await ctx.delay(200);

  // Build the demo rule set JSON directly.
  const rulesJson = JSON.stringify({
    version: 1,
    rules: [
      {
        id: 'demo-ping-rule',
        name: PING_RULE_NAME,
        enabled: true,
        priority: 2,
        predicate: {
          type: 'leaf',
          kind: 'body_path_equals',
          path: PING_BODY_PATH,
          value: PING_MATCH_VALUE,
        },
        response: {
          bodyText: PING_RESPONSE_BODY,
          statusCode: 0,
        },
      },
      {
        id: 'demo-fallback-rule',
        name: FALLBACK_RULE_NAME,
        enabled: true,
        priority: 1,
        predicate: {
          type: 'leaf',
          kind: 'body_path_exists',
          path: FALLBACK_BODY_PATH,
        },
        response: {
          statusCode: FALLBACK_STATUS_CODE,
        },
      },
    ],
  }, null, 2);

  setMockInputValue(GRPC.MOCK_RULES_JSON, rulesJson);
  await ctx.delay(300);
  // Switch back to Builder so the viewer sees the rule cards.
  await selectMockAuthoringTab(ctx, 'builder');
  await ctx.delay(200);
}

// ---------------------------------------------------------------------------
// Lesson steps
// ---------------------------------------------------------------------------

type DemoStep = GrpcDemoLesson['steps'][number];

const steps: DemoStep[] = [
  // =========================================================================
  // Step 1 — Navigate to Advanced → Mock server; tour three tabs
  // =========================================================================
  {
    id: 'grpc13-intro',
    title: 'Intro: Mock Server Panel',
    pauseAfter: true,
    description:
      'The **Mock server** panel (under **Advanced**) lets you define predicate-based rules: ' +
      'when an incoming gRPC call matches a rule\'s condition, the mock returns your ' +
      'configured response — no real server needed.\n\n' +
      'The panel has three sub-tabs:\n\n' +
      '- **Builder** — visual rule editor with predicate dropdowns and response fields\n' +
      '- **JSON** — the raw JSON rule set; edit directly and import/export\n' +
      '- **Runtime** — global latency, mock status, and the Start / Stop controls\n\n' +
      'Rules hot-swap while the runtime is running — add or remove them without restarting.',
    highlight: GRPC.MOCK_SERVER_PANEL,
    preAction: async (ctx) => {
      await grpcFirstCallSetup(ctx);
      await ensureGrpcReflected(ctx);
      await clearGrpcSchemaDriftQuiet(ctx);
      await closeGrpcSettingsDrawerQuiet(ctx);
      // Navigate to mock server with an empty rule set.
      await navigateToMockServerPanelQuiet(ctx);
      await stopMockQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight the Studio sub-nav for context before switching.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_STUDIO, 700);
      await ctx.delay(200);

      // Click Advanced sub-nav.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_ADVANCED, 800);
      await ctx.click(GRPC.SUB_NAV_ADVANCED);
      await ctx.delay(600);

      // Spotlight the advanced nav, then click Mock server.
      await spotlightAndPause(ctx, GRPC.ADVANCED_NAV, 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('mock_server'), 800);
      await ctx.click(GRPC.ADVANCED_TAB('mock_server'));
      await ctx.delay(500);

      // Wait for the mock panel to render.
      try {
        await ctx.waitFor(GRPC.MOCK_SERVER_PANEL, 4_000);
      } catch { /* panel renders fast */ }
      await ctx.delay(300);

      // Spotlight the full panel.
      await spotlightAndPause(ctx, GRPC.MOCK_SERVER_PANEL, 900);

      // Tour the three authoring tabs.
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_BUILDER, 750);
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_JSON, 750);
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_RUNTIME, 750);

      // Return to Builder tab.
      await ctx.click(GRPC.MOCK_TAB_BUILDER);
      await ctx.delay(400);
      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 900);
    },
    verify: GRPC.MOCK_SERVER_PANEL,
  },

  // =========================================================================
  // Step 2 — Add "Ping match" rule: body_path_equals message=ping → pong OK
  // =========================================================================
  {
    id: 'grpc13-rule-ping',
    title: 'Rule 1: Body Path Equals',
    pauseAfter: true,
    description:
      'Click **+ Add rule** to create the first rule: **Ping match**.\n\n' +
      'In the **When** section, set the predicate:\n' +
      '- **Predicate kind:** Body path equals\n' +
      '- **Body path:** `message`\n' +
      '- **Expected value:** `ping`\n\n' +
      'In the **Then respond** section:\n' +
      '- **Response body:** `{"message":"pong"}`\n' +
      '- **Status code:** `0` (OK)\n\n' +
      'When Studio sends a call with `message: "ping"`, the mock intercepts it and ' +
      'immediately returns `{"message":"pong"}` — no real server involved.',
    highlight: GRPC.MOCK_BUILDER_ADD_RULE,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      await stopMockQuiet(ctx);
      // Clear any pre-existing rules so this step always starts with a blank slate.
      await selectMockAuthoringTab(ctx, 'json');
      setMockInputValue(GRPC.MOCK_RULES_JSON, JSON.stringify({ version: 1, rules: [] }, null, 2));
      await ctx.delay(200);
      await selectMockAuthoringTab(ctx, 'builder');
      await ctx.delay(200);
    },
    action: async (ctx) => {
      // Spotlight and click + Add rule.
      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_ADD_RULE, 800);
      await ctx.click(GRPC.MOCK_BUILDER_ADD_RULE);
      await ctx.delay(500);

      // Wait for the rule element to appear.
      try {
        await ctx.waitFor('[data-testid^="grpc-mock-builder-rule-"]', 3_000);
      } catch { /* rule appears synchronously */ }
      await ctx.delay(300);

      // Get the new rule's IDs.
      const ids = getLastRuleIds();
      if (!ids) return;

      // Spotlight the new rule card.
      const ruleEl = document.querySelector<HTMLElement>(`[data-testid="grpc-mock-builder-rule-${ids.ruleId}"]`);
      if (ruleEl) {
        await spotlightElementAndPause(ctx, ruleEl, 800);
      }

      // Fill in the rule name.
      await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-name-${ids.ruleId}"]`, 700);
      setMockInputValue(`[data-testid="grpc-mock-builder-name-${ids.ruleId}"]`, PING_RULE_NAME);
      await ctx.delay(500);

      // Set the predicate kind to body_path_equals.
      await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-leaf-kind-${ids.nodeId}"]`, 800);
      setSelectValue(`[data-testid="grpc-mock-builder-leaf-kind-${ids.nodeId}"]`, 'body_path_equals');
      await ctx.delay(600);

      // Fill in the body path.
      await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-leaf-path-${ids.nodeId}"]`, 700);
      setMockInputValue(`[data-testid="grpc-mock-builder-leaf-path-${ids.nodeId}"]`, PING_BODY_PATH);
      await ctx.delay(400);

      // Fill in the expected value.
      await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-leaf-body-value-${ids.nodeId}"]`, 700);
      setMockInputValue(`[data-testid="grpc-mock-builder-leaf-body-value-${ids.nodeId}"]`, PING_MATCH_VALUE);
      await ctx.delay(400);

      // Fill in the response body.
      await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-body-${ids.ruleId}"]`, 800);
      setMockInputValue(`[data-testid="grpc-mock-builder-body-${ids.ruleId}"]`, PING_RESPONSE_BODY);
      await ctx.delay(500);

      // Status code 0 = OK (show to viewer).
      await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-status-${ids.ruleId}"]`, 700);
      await ctx.delay(300);

      // Highlight the completed rule card.
      if (ruleEl) {
        await spotlightElementAndPause(ctx, ruleEl, 1_000);
      }
    },
    verify: GRPC.MOCK_BUILDER_PANEL,
  },

  // =========================================================================
  // Step 3 — Add "Fallback" rule: body_path_exists message → INTERNAL
  // =========================================================================
  {
    id: 'grpc13-rule-fallback',
    title: 'Rule 2: Fallback (Body Path Exists)',
    pauseAfter: true,
    description:
      'Add a second rule: **Fallback**.\n\n' +
      'In the **When** section:\n' +
      '- **Predicate kind:** Body path exists\n' +
      '- **Body path:** `message`\n\n' +
      'In the **Then respond** section:\n' +
      '- **Status code:** `13` (INTERNAL)\n\n' +
      '`Body path exists` matches **any** call that has a `message` field — including ' +
      'requests where message is "ping". Rules fire in priority order (higher first), ' +
      'so Rule 1 (priority 2) is checked before Rule 2 (priority 1). ' +
      'Only calls that don\'t match Rule 1 fall through to the INTERNAL status.',
    highlight: GRPC.MOCK_BUILDER_ADD_RULE,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      await selectMockAuthoringTab(ctx, 'builder');
      const existingRules = document.querySelectorAll('[data-testid^="grpc-mock-builder-rule-"]');
      if (existingRules.length === 0) {
        // User skipped Step 2 — add Rule 1 silently so the action can add Rule 2 normally.
        await selectMockAuthoringTab(ctx, 'json');
        const rule1Json = JSON.stringify({
          version: 1,
          rules: [{
            id: 'demo-ping-rule',
            name: PING_RULE_NAME,
            enabled: true,
            priority: 2,
            predicate: { type: 'leaf', kind: 'body_path_equals', path: PING_BODY_PATH, value: PING_MATCH_VALUE },
            response: { bodyText: PING_RESPONSE_BODY, statusCode: 0 },
          }],
        }, null, 2);
        setMockInputValue(GRPC.MOCK_RULES_JSON, rule1Json);
        await ctx.delay(200);
        await selectMockAuthoringTab(ctx, 'builder');
        await ctx.delay(200);
      }
      // If 2 rules already exist (e.g. lesson restarted mid-way), action detects this and skips + Add rule.
    },
    action: async (ctx) => {
      const existingRuleCount = document.querySelectorAll('[data-testid^="grpc-mock-builder-rule-"]').length;

      // Show Rule 1 for context before adding Rule 2.
      const rule1El = document.querySelector<HTMLElement>('[data-testid^="grpc-mock-builder-rule-"]');
      if (rule1El) {
        await spotlightElementAndPause(ctx, rule1El, 700);
      }

      if (existingRuleCount < 2) {
        // Educational flow: add Rule 2 step-by-step.
        await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_ADD_RULE, 800);
        await ctx.click(GRPC.MOCK_BUILDER_ADD_RULE);
        await ctx.delay(500);

        const ids = getLastRuleIds();
        if (ids) {
          const ruleEl = document.querySelector<HTMLElement>(`[data-testid="grpc-mock-builder-rule-${ids.ruleId}"]`);
          if (ruleEl) await spotlightElementAndPause(ctx, ruleEl, 700);

          setMockInputValue(`[data-testid="grpc-mock-builder-name-${ids.ruleId}"]`, FALLBACK_RULE_NAME);
          await ctx.delay(400);

          await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-leaf-kind-${ids.nodeId}"]`, 800);
          setSelectValue(`[data-testid="grpc-mock-builder-leaf-kind-${ids.nodeId}"]`, 'body_path_exists');
          await ctx.delay(600);

          await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-leaf-path-${ids.nodeId}"]`, 700);
          setMockInputValue(`[data-testid="grpc-mock-builder-leaf-path-${ids.nodeId}"]`, FALLBACK_BODY_PATH);
          await ctx.delay(400);

          await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-status-${ids.ruleId}"]`, 800);
          setMockInputValue(`[data-testid="grpc-mock-builder-status-${ids.ruleId}"]`, String(FALLBACK_STATUS_CODE));
          await ctx.delay(500);
        }
      }

      // Payoff: spotlight the full builder panel showing both rules and their priority ordering.
      await spotlightAndPause(ctx, '[data-testid="grpc-mock-builder-panel"]', 1_000);
    },
    verify: GRPC.MOCK_BUILDER_PANEL,
  },

  // =========================================================================
  // Step 4 — Runtime tab: set global latency
  // =========================================================================
  {
    id: 'grpc13-latency',
    title: 'Global Latency Simulation',
    pauseAfter: true,
    description:
      'Switch to the **Runtime** tab to configure the mock runtime behavior.\n\n' +
      '**Global latency** adds a baseline delay to every mock response — independent of ' +
      'which rule fired. This simulates realistic server response times when testing against ' +
      'a canned mock:\n\n' +
      '- **Default latency (ms):** `100` — every response waits at least 100ms\n' +
      '- **Jitter (ms):** `20` — adds random ±20ms variance, avoiding suspiciously uniform timings\n\n' +
      'Latency is **global** (applies to all rules) rather than per-rule. ' +
      'Use it to test client timeout handling — set latency above your client\'s deadline and watch it cancel.',
    highlight: GRPC.MOCK_TAB_RUNTIME,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      // Ensure rules exist.
      const existing = document.querySelectorAll('[data-testid^="grpc-mock-builder-rule-"]');
      if (existing.length < 2) {
        await ensureDemoRulesQuiet(ctx);
      }
    },
    action: async (ctx) => {
      // Spotlight then click Runtime tab.
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_RUNTIME, 800);
      await ctx.click(GRPC.MOCK_TAB_RUNTIME);
      await ctx.delay(500);

      // Spotlight the latency form fields.
      await spotlightAndPause(ctx, '[data-testid="grpc-mock-latency-default"]', 900);
      setMockInputValue('[data-testid="grpc-mock-latency-default"]', String(DEMO_LATENCY_MS));
      await ctx.delay(500);

      await spotlightAndPause(ctx, '[data-testid="grpc-mock-latency-jitter"]', 800);
      setMockInputValue('[data-testid="grpc-mock-latency-jitter"]', String(DEMO_JITTER_MS));
      await ctx.delay(500);

      // Spotlight the runtime panel as a whole.
      await spotlightAndPause(ctx, '[data-testid="grpc-mock-runtime-panel"]', 900);
    },
    verify: GRPC.MOCK_TAB_RUNTIME,
  },

  // =========================================================================
  // Step 5 — Start the mock runtime
  // =========================================================================
  {
    id: 'grpc13-start',
    title: 'Start Mock Runtime',
    pauseAfter: true,
    description:
      'Click **Start mock runtime** to activate the in-process interceptor. ' +
      'The status badge changes to **Running** and the button switches to **Stop**.\n\n' +
      'In **web mode**, the mock intercepts Studio\'s outbound gRPC calls before they ' +
      'reach the network — no Express proxy or Go server is involved in the matched response.\n\n' +
      'Rules **hot-swap** while the mock is running: you can add, delete, or reorder rules ' +
      'without restarting — changes apply to the next incoming call.',
    highlight: GRPC.MOCK_START,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      // Ensure rules exist before allowing Start.
      const existing = document.querySelectorAll('[data-testid^="grpc-mock-builder-rule-"]');
      if (existing.length < 2) {
        await ensureDemoRulesQuiet(ctx);
      }
      // Already running? — stop first so the viewer sees the Start flow.
      if (document.querySelector(GRPC.MOCK_STOP)) {
        const stopBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_STOP);
        stopBtn?.click();
        await ctx.delay(500);
      }
    },
    action: async (ctx) => {
      // Show the Builder tab state first so viewer remembers what rules are configured.
      await ctx.click(GRPC.MOCK_TAB_BUILDER);
      await ctx.delay(400);
      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 800);

      // Spotlight Start button (in panel header — visible from any tab).
      await spotlightAndPause(ctx, GRPC.MOCK_START, 900);
      await ctx.click(GRPC.MOCK_START);
      await ctx.delay(600);

      // Switch to Runtime tab to show the Running status.
      await ctx.click(GRPC.MOCK_TAB_RUNTIME);
      await ctx.delay(400);

      // Spotlight the status badge showing "Running".
      await spotlightAndPause(ctx, GRPC.MOCK_STATUS, 1_000);

      // Spotlight the Stop button to show how to halt the mock.
      await spotlightAndPause(ctx, GRPC.MOCK_STOP, 800);
    },
    verify: GRPC.MOCK_STATUS,
  },

  // =========================================================================
  // Step 6 — Test: send message=ping → pong response
  // =========================================================================
  {
    id: 'grpc13-test-ping',
    title: 'Test: Ping Rule Fires',
    pauseAfter: true,
    description:
      'Navigate back to the **Studio** call panel — the mock is still running in the background.\n\n' +
      'Fill the request with `message: "ping"` and click **Send**. Instead of reaching the ' +
      'real Echo server, the call is intercepted by the mock runtime. Rule 1 ("Ping match") ' +
      'matches because `message` equals `"ping"`, so the response is instantly:\n\n' +
      '```json\n{"message": "pong"}\n```\n\n' +
      'Notice the response arrives in ~100ms — the global latency you set. The real server ' +
      'is never contacted.',
    highlight: GRPC.RESPONSE_PANEL,
    preAction: async (ctx) => {
      // Ensure mock is running with the right rules.
      const rulesOk = document.querySelectorAll('[data-testid^="grpc-mock-builder-rule-"]').length >= 2;
      if (!rulesOk) await ensureDemoRulesQuiet(ctx);
      await startMockQuiet(ctx);
      // Navigate to Studio sub-nav.
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ensureEchoMessageFilled(ctx, TEST_MESSAGE_PING);
    },
    action: async (ctx) => {
      // Navigate back to Studio sub-nav with a visible click.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_STUDIO, 800);
      await ctx.click(GRPC.SUB_NAV_STUDIO);
      await ctx.delay(600);

      // Fill message = "ping" so the viewer sees the body.
      await ensureEchoMessageFilled(ctx, TEST_MESSAGE_PING);
      const formEl = document.querySelector(GRPC.REQUEST_FORM_SCROLL);
      if (formEl) {
        await spotlightElementAndPause(ctx, formEl as HTMLElement, 900);
      }

      // Spotlight Send button and click.
      await spotlightAndPause(ctx, GRPC.SEND_BTN, 800);
      await ctx.click(GRPC.SEND_BTN);
      await ctx.delay(400);

      // Wait for the response.
      try {
        await ctx.waitFor(GRPC.RESPONSE_STATUS, 8_000);
      } catch { /* mock may respond very fast */ }
      await ctx.delay(400);

      // Spotlight the response panel.
      await spotlightAndPause(ctx, GRPC.RESPONSE_PANEL, 900);

      // Spotlight the response body showing "pong".
      await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 1_000);
    },
    verify: GRPC.RESPONSE_BODY,
  },

  // =========================================================================
  // Step 7 — Test: fallback rule fires with INTERNAL
  // =========================================================================
  {
    id: 'grpc13-test-fallback',
    title: 'Test: Fallback Rule Fires',
    pauseAfter: true,
    description:
      'Change the request body to `message: "other-request"` and click **Send** again.\n\n' +
      'Rule 1 ("Ping match") no longer matches — `message` is not `"ping"`. ' +
      'The mock evaluates Rule 2 ("Fallback"), which matches because `message` field exists. ' +
      'The mock returns gRPC status **13 INTERNAL** with no body.\n\n' +
      'This pattern — specific match rule first, broad fallback last — is the standard ' +
      'way to define mock behaviour that is predictable without needing an else-branch predicate.',
    highlight: GRPC.RESPONSE_ERROR_PANEL,
    preAction: async (ctx) => {
      const rulesOk = document.querySelectorAll('[data-testid^="grpc-mock-builder-rule-"]').length >= 2;
      if (!rulesOk) await ensureDemoRulesQuiet(ctx);
      await startMockQuiet(ctx);
      await ensureGrpcStudioSubNavQuiet(ctx);
    },
    action: async (ctx) => {
      // Ensure on Studio sub-nav.
      await ensureGrpcStudioSubNavQuiet(ctx);

      // Fill message = "other-request".
      await ensureEchoMessageFilled(ctx, TEST_MESSAGE_OTHER);
      const formEl = document.querySelector(GRPC.REQUEST_FORM_SCROLL);
      if (formEl) {
        await spotlightElementAndPause(ctx, formEl as HTMLElement, 900);
      }

      // Click Send.
      await spotlightAndPause(ctx, GRPC.SEND_BTN, 800);
      await ctx.click(GRPC.SEND_BTN);
      await ctx.delay(400);

      // Wait for the error response.
      try {
        await ctx.waitFor(GRPC.RESPONSE_ERROR_PANEL, 8_000);
      } catch {
        try {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 6_000);
        } catch { /* proceed */ }
      }
      await ctx.delay(400);

      // Spotlight the response panel.
      await spotlightAndPause(ctx, GRPC.RESPONSE_PANEL, 800);

      // Spotlight the error panel showing INTERNAL status.
      await spotlightAndPause(ctx, GRPC.RESPONSE_ERROR_PANEL, 1_000);
    },
    verify: GRPC.RESPONSE_PANEL,
  },

  // =========================================================================
  // Step 8 — JSON tab: show rule set; Copy rules JSON
  // =========================================================================
  {
    id: 'grpc13-json-export',
    title: 'Export the Rule Set',
    pauseAfter: true,
    description:
      'Switch to the **JSON** tab to see the full mock rule set as structured JSON. ' +
      'The two rules you built are serialized here — each with predicate, response, priority, ' +
      'and enabled state.\n\n' +
      'Click **Copy rules JSON** to copy the rule set to your clipboard. You can:\n\n' +
      '- **Commit it** to source control as a `.json` file for your test suite\n' +
      '- **Import it** on another machine by pasting into the JSON editor\n' +
      '- **Edit it** directly in the JSON editor for bulk changes or expression predicates\n\n' +
      'The JSON editor and Builder stay **in sync** — any change in one is reflected in the other.',
    highlight: GRPC.MOCK_TAB_JSON,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight then click JSON tab.
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_JSON, 800);
      await ctx.click(GRPC.MOCK_TAB_JSON);
      await ctx.delay(500);

      // Spotlight the rules JSON textarea.
      await spotlightAndPause(ctx, GRPC.MOCK_RULES_JSON, 1_000);

      // Spotlight and click Copy rules JSON — clipboard receives the full rule set.
      await spotlightAndPause(ctx, GRPC.MOCK_EXPORT_JSON, 900);
      await ctx.click(GRPC.MOCK_EXPORT_JSON);
      await ctx.delay(600);

      // Spotlight the JSON textarea one more time so the viewer sees the exported content.
      await spotlightAndPause(ctx, GRPC.MOCK_RULES_JSON, 800);
    },
    verify: GRPC.MOCK_RULES_JSON,
  },

  // =========================================================================
  // Step 9 — Network Listener (narration; desktop-only feature)
  // =========================================================================
  {
    id: 'grpc13-network-listen',
    title: 'Network Listener (Desktop)',
    pauseAfter: true,
    description:
      'On the **Tauri desktop app**, the Runtime tab shows an extra toggle: ' +
      '**Expose network endpoint**. Enabling it binds a real TCP port so ' +
      'external gRPC clients — other apps, `grpcurl`, or a CI test suite — ' +
      'can call the mock directly without going through Studio.\n\n' +
      'The listen address (e.g. `127.0.0.1:50099`) appears next to the toggle — ' +
      'copy it with the **Copy** button and use it as your gRPC target in any client.\n\n' +
      'This turns the mock into a standalone in-process gRPC server: useful for ' +
      'end-to-end tests that need a predictable backend without standing up a real service. ' +
      'The **Listener activity** log shows every incoming call and which rule matched.\n\n' +
      '_(This toggle is not available in web mode — the full desktop walkthrough is in ' +
      'Lesson 15: Tauri Desktop.)_',
    highlight: GRPC.MOCK_TAB_RUNTIME,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      await selectMockAuthoringTab(ctx, 'runtime');
    },
    action: async (ctx) => {
      // Make sure we're on the Runtime tab.
      await ctx.click(GRPC.MOCK_TAB_RUNTIME);
      await ctx.delay(500);

      // Spotlight the runtime panel.
      await spotlightAndPause(ctx, '[data-testid="grpc-mock-runtime-panel"]', 900);

      // Spotlight the stop button (network listener context).
      if (document.querySelector(GRPC.MOCK_STOP)) {
        await spotlightAndPause(ctx, GRPC.MOCK_STOP, 700);
      }

      // If on desktop, spotlight the expose-network toggle.
      const exposeToggle = document.querySelector<HTMLElement>(GRPC.MOCK_EXPOSE_NETWORK);
      if (exposeToggle) {
        await spotlightElementAndPause(ctx, exposeToggle, 1_000);
        const listenTarget = document.querySelector<HTMLElement>(GRPC.MOCK_LISTEN_TARGET);
        if (listenTarget) {
          await spotlightElementAndPause(ctx, listenTarget, 900);
        }
        const copyBtn = document.querySelector<HTMLElement>(GRPC.MOCK_COPY_LISTEN_TARGET);
        if (copyBtn) {
          await spotlightElementAndPause(ctx, copyBtn, 800);
        }
      } else {
        // Web mode: narration-only; spotlight the runtime status instead.
        await spotlightAndPause(ctx, GRPC.MOCK_STATUS, 900);
        await ctx.delay(500);
        // Stop the mock as cleanup.
        await spotlightAndPause(ctx, GRPC.MOCK_STOP, 800);
      }
    },
    verify: GRPC.MOCK_SERVER_PANEL,
  },
];

// ---------------------------------------------------------------------------
// Lesson export
// ---------------------------------------------------------------------------

export const grpcMockServerLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC13_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Build predicate-based mock rules in the visual Builder, start the in-process mock ' +
    'runtime, verify that the correct rule fires from the Studio call panel, and export ' +
    'the rule set as portable JSON for use in CI or on other machines.',
  concept: {
    title: 'Mocking gRPC APIs: Rules & Network Listener',
    body:
      'gRPC Studio\'s **Mock server** panel lets you define **predicate-based rules** that ' +
      'intercept outbound calls and return canned responses — no real server required.\n\n' +
      'Rules have two parts:\n' +
      '1. **Predicate** — a condition on the request (body path equals/exists, method, metadata key)\n' +
      '2. **Response** — a JSON body, gRPC status code, and optional error message\n\n' +
      'Rules are evaluated in **priority order** (higher priority first); the first matching rule wins. ' +
      'Global **latency simulation** adds a configurable delay to all responses.\n\n' +
      'In **web mode**, the mock intercepts calls in-process — the Express proxy and Go server ' +
      'are bypassed for matched calls. On the **Tauri desktop app**, enabling the ' +
      '**Network Listener** binds a real TCP port so external gRPC clients connect directly.',
  },
  grpc: buildGrpcContractMetaFromRoster(GRPC13_ROSTER),
  setup: async (ctx) => {
    await grpcFirstCallSetup(ctx);
    await ensureGrpcReflected(ctx);
    await clearGrpcSchemaDriftQuiet(ctx);
    await closeGrpcSettingsDrawerQuiet(ctx);
    await navigateToGrpcStudio(ctx);
  },
  cleanup: async (ctx) => {
    // Stop the mock so it doesn't affect the next lesson.
    await navigateToMockServerPanelQuiet(ctx);
    await stopMockQuiet(ctx);
    await ensureGrpcStudioSubNavQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },
  steps,
};
