/**
 * GRPC-13 Mock Server lesson — runtime, testing & export steps (7–12).
 */
import { GRPC } from '@shared/selectors';
import {
  ensureEchoMessageFilled,
  ensureGrpcStudioSubNavQuiet,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import {
  TEST_MESSAGE_OTHER,
  TEST_MESSAGE_PING,
  ensureDemoRulesQuiet,
  navigateToMockServerPanelQuiet,
  selectMockAuthoringTab,
  setMockInputValue,
  startMockQuiet,
  stopMockQuiet,
} from './grpc-mock-server-helpers';

type DemoStep = GrpcDemoLesson['steps'][number];

export const grpcMockServerRuntimeSteps: DemoStep[] = [
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
      const existing = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE);
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
      await ctx.delay(600);
    },
    verify: GRPC.MOCK_STATUS,
  },

  // =========================================================================
  // Step 8 — Test: send message=ping → pong response
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
      const rulesOk = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE).length >= 2;
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
      await ctx.delay(650);
    },
    verify: GRPC.RESPONSE_BODY,
  },

  // =========================================================================
  // Step 9 — Test: fallback rule fires with INTERNAL
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
      'Notice the response panel changes from green to an **error state** — the ' +
      'status badge shows `INTERNAL · 13` and an error message appears below it. ' +
      'This is how gRPC non-OK responses look in the Studio.\n\n' +
      'This pattern — specific match rule first, broad fallback last — is the standard ' +
      'way to define mock behaviour that is predictable without needing an else-branch predicate.',
    highlight: GRPC.RESPONSE_ERROR_PANEL,
    preAction: async (ctx) => {
      const rulesOk = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE).length >= 2;
      if (!rulesOk) await ensureDemoRulesQuiet(ctx);
      await startMockQuiet(ctx);
      await ensureGrpcStudioSubNavQuiet(ctx);
    },
    action: async (ctx) => {
      // Ensure on Studio sub-nav.
      await ensureGrpcStudioSubNavQuiet(ctx);

      // Fill message = "other-request" and spotlight the form briefly.
      await ensureEchoMessageFilled(ctx, TEST_MESSAGE_OTHER);
      const formEl = document.querySelector(GRPC.REQUEST_FORM_SCROLL);
      if (formEl) {
        await spotlightElementAndPause(ctx, formEl as HTMLElement, 600);
      }

      // Click Send.
      await spotlightAndPause(ctx, GRPC.SEND_BTN, 600);
      await ctx.click(GRPC.SEND_BTN);

      // Wait for the error response — mock is in-process so response is fast.
      try {
        await ctx.waitFor(GRPC.RESPONSE_ERROR_PANEL, 4_000);
      } catch {
        try {
          await ctx.waitFor(GRPC.RESPONSE_STATUS, 3_000);
        } catch { /* proceed */ }
      }
      await ctx.delay(300);

      // Single payoff spotlight on the error panel (INTERNAL · 13).
      await spotlightAndPause(ctx, GRPC.RESPONSE_ERROR_PANEL, 1_100);
    },
    verify: GRPC.RESPONSE_PANEL,
  },

  // =========================================================================
  // Step 10 — JSON tab: syntax-highlighted editor + export
  // =========================================================================
  {
    id: 'grpc13-json-highlight',
    title: 'Syntax-Highlighted JSON Editor',
    pauseAfter: true,
    description:
      'Switch to the **JSON** tab to see the full mock rule set in a **syntax-highlighted ' +
      'editor**. JSON keys, strings, numbers, booleans, and null values each have distinct ' +
      'colors — making it much easier to scan and edit large rule sets.\n\n' +
      'The highlighted editor is **fully editable**: type directly to modify rules, and the ' +
      'Builder stays in sync. Scroll sync keeps highlighting aligned with your cursor.\n\n' +
      'Click **Copy rules JSON** to copy the rule set to your clipboard. You can:\n\n' +
      '- **Commit it** to source control as a `.json` file for your test suite\n' +
      '- **Import it** on another machine by pasting into the JSON editor\n' +
      '- **Edit it** directly for bulk changes or expression predicates',
    highlight: GRPC.MOCK_JSON_EDITOR,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight then click JSON tab.
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_JSON, 800);
      await ctx.click(GRPC.MOCK_TAB_JSON);
      await ctx.delay(500);

      // Spotlight the syntax-highlighted JSON editor.
      const editorEl = document.querySelector<HTMLElement>(GRPC.MOCK_JSON_EDITOR);
      if (editorEl) {
        editorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(500);
        await spotlightElementAndPause(ctx, editorEl, 1_300);
      }

      // Spotlight the underlying JSON textarea (still functional inside the editor).
      await spotlightAndPause(ctx, GRPC.MOCK_RULES_JSON, 900);

      // Spotlight and click Copy rules JSON.
      await spotlightAndPause(ctx, GRPC.MOCK_EXPORT_JSON, 900);
      await ctx.click(GRPC.MOCK_EXPORT_JSON);
      await ctx.delay(600);

      // Final spotlight on the editor.
      if (editorEl) {
        await spotlightElementAndPause(ctx, editorEl, 800);
      }
      await ctx.delay(650);
    },
    verify: GRPC.MOCK_RULES_JSON,
  },

  // =========================================================================
  // Step 11 — Generate rule stubs from proto descriptor
  // =========================================================================
  {
    id: 'grpc13-proto-stubs',
    title: 'Generate Rules from Proto',
    pauseAfter: true,
    description:
      'When a proto descriptor is loaded (via reflection or proto file import), the Builder ' +
      'toolbar shows the **⚙ Generate from proto** button.\n\n' +
      'Clicking it **auto-creates one mock rule per RPC method** defined in the loaded proto. ' +
      'Each stub rule includes:\n' +
      '- **Name:** `ServiceName/MethodName`\n' +
      '- **Predicate:** `method_equals MethodName`\n' +
      '- **Response body:** a scaffold built from the response message schema — all fields ' +
      'pre-filled with type-appropriate defaults (empty strings, zeros, empty arrays)\n\n' +
      'This gives you an instant mock for every endpoint. Edit the generated response bodies ' +
      'to return meaningful test data, then start the mock runtime.\n\n' +
      '_(If no proto is loaded, the button is hidden. Load a proto first in the Schema tab.)_',
    highlight: GRPC.MOCK_BUILDER_PANEL,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      await stopMockQuiet(ctx);
      // Clear existing rules so generated stubs are visible alone.
      await selectMockAuthoringTab(ctx, 'json');
      setMockInputValue(GRPC.MOCK_RULES_JSON, JSON.stringify({ version: 1, rules: [] }, null, 2));
      await ctx.delay(200);
      await selectMockAuthoringTab(ctx, 'builder');
      await ctx.delay(200);
    },
    action: async (ctx) => {
      // Switch to Builder tab.
      await ctx.click(GRPC.MOCK_TAB_BUILDER);
      await ctx.delay(400);

      // Check if the generate button is available (proto must be loaded).
      const generateBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_BUILDER_GENERATE_STUBS);
      if (generateBtn) {
        // Spotlight the Generate from proto button.
        generateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(450);
        await spotlightElementAndPause(ctx, generateBtn, 1_200);

        // Click it to generate stubs.
        generateBtn.click();
        await ctx.delay(800);

        // Show the generated rule cards.
        await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 1_200);

        // Spotlight the first generated rule card.
        const firstRule = document.querySelector<HTMLElement>(GRPC.MOCK_BUILDER_RULE);
        if (firstRule) {
          firstRule.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await ctx.delay(400);
          await spotlightElementAndPause(ctx, firstRule, 1_000);
        }
      } else {
        // No proto loaded — show the empty state and explain.
        const emptyState = document.querySelector<HTMLElement>(GRPC.MOCK_BUILDER_EMPTY);
        if (emptyState) {
          await spotlightElementAndPause(ctx, emptyState, 900);
        }
        // Spotlight the toolbar where the button would appear.
        await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_ADD_RULE, 800);
        await ctx.delay(500);
      }
      await ctx.delay(650);
    },
    verify: GRPC.MOCK_BUILDER_PANEL,
  },

  // =========================================================================
  // Step 12 — Network Listener & external clients (overview)
  // =========================================================================
  {
    id: 'grpc13-network-listen',
    title: 'Network Listener & External Clients',
    pauseAfter: true,
    description:
      'The Runtime tab includes an **Expose network endpoint** toggle. ' +
      'Enabling it binds a real TCP port so external gRPC clients — other apps, ' +
      '`grpcurl`, or a CI test suite — can call the mock directly without going ' +
      'through Studio.\n\n' +
      'The listen address (e.g. `127.0.0.1:50099`) appears next to the toggle — ' +
      'copy it with the **Copy** button and use it as your gRPC target in any client.\n\n' +
      'This turns the mock into a standalone in-process gRPC server: useful for ' +
      'end-to-end tests that need a predictable backend without standing up a real service. ' +
      'The **Listener activity** log shows every incoming call and which rule matched.\n\n' +
      '_(This feature requires the web companion server — run `npm run server` to enable it ' +
      'in the web app. On the Tauri desktop app, the companion is embedded and always available.)_',
    highlight: GRPC.MOCK_TAB_RUNTIME,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      // Ensure demo rules are restored (Step 11 may have cleared them).
      const existing = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE);
      if (existing.length < 2) {
        await ensureDemoRulesQuiet(ctx);
      }
      await selectMockAuthoringTab(ctx, 'runtime');
    },
    action: async (ctx) => {
      // Make sure we're on the Runtime tab without duplicate clicks.
      const runtimeTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_RUNTIME);
      if (runtimeTab?.getAttribute('aria-selected') !== 'true') {
        await spotlightAndPause(ctx, GRPC.MOCK_TAB_RUNTIME, 900);
        await ctx.click(GRPC.MOCK_TAB_RUNTIME);
        await ctx.delay(700);
      } else {
        await spotlightAndPause(ctx, GRPC.MOCK_TAB_RUNTIME, 800);
        await ctx.delay(500);
      }

      // Spotlight the runtime panel.
      await spotlightAndPause(ctx, '[data-testid="grpc-mock-runtime-panel"]', 1_200);

      // If on desktop, spotlight the expose-network toggle.
      const exposeToggle = document.querySelector<HTMLElement>(GRPC.MOCK_EXPOSE_NETWORK);
      if (exposeToggle) {
        await spotlightElementAndPause(ctx, exposeToggle, 1_200);

        // Ensure listener details are actually visible before highlighting them.
        const exposeInput = exposeToggle as HTMLInputElement;
        if (!exposeInput.checked) {
          await ctx.click(GRPC.MOCK_EXPOSE_NETWORK);
          try {
            await ctx.waitFor(GRPC.MOCK_LISTEN_TARGET, 6_000);
          } catch {
            // Companion server unavailable in web mode can hide listener details.
          }
          await ctx.delay(900);
        }

        const listenTarget = document.querySelector<HTMLElement>(GRPC.MOCK_LISTEN_TARGET);
        if (listenTarget) {
          await spotlightElementAndPause(ctx, listenTarget, 1_200);
        }
        const copyBtn = document.querySelector<HTMLElement>(GRPC.MOCK_COPY_LISTEN_TARGET);
        if (copyBtn) {
          await spotlightElementAndPause(ctx, copyBtn, 1_000);
        }
      } else {
        // Web mode: narration-only; spotlight the runtime status instead.
        await spotlightAndPause(ctx, GRPC.MOCK_STATUS, 1_200);
        await ctx.delay(800);
        // Stop the mock as cleanup.
        if (document.querySelector(GRPC.MOCK_STOP)) {
          await spotlightAndPause(ctx, GRPC.MOCK_STOP, 900);
          await ctx.click(GRPC.MOCK_STOP);
          await ctx.delay(900);
        }
      }
      await ctx.delay(950);
    },
    verify: GRPC.MOCK_SERVER_PANEL,
  },
];
