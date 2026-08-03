/**
 * GRPC-13 Mock Server lesson — builder & rule-authoring steps (1–6).
 */
import { GRPC } from '@shared/selectors';
import {
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import {
  DEMO_JITTER_MS,
  DEMO_LATENCY_MS,
  FALLBACK_BODY_PATH,
  FALLBACK_RULE_NAME,
  FALLBACK_STATUS_CODE,
  GRPC13_DRY_RUN_PAYOFF_MS,
  GRPC13_DRY_RUN_SPOTLIGHT_MS,
  PING_BODY_PATH,
  PING_MATCH_VALUE,
  PING_RESPONSE_BODY,
  PING_RULE_NAME,
  ensureDemoRulesQuiet,
  getLastRuleIds,
  navigateToMockServerPanelQuiet,
  scrollAndSpotlight,
  scrollBelowMockAuthoringTabs,
  scrollMockControlIntoView,
  selectMockAuthoringTab,
  setMockInputValue,
  setSelectValue,
  startMockQuiet,
  stopMockQuiet,
} from './grpc-mock-server-helpers';

type DemoStep = GrpcDemoLesson['steps'][number];

export const grpcMockServerBuilderSteps: DemoStep[] = [
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
      '- **Builder** — visual rule editor with search, drag-to-reorder, collapse/expand, ' +
      'inline dry-run tester, and conflict detection\n' +
      '- **JSON** — syntax-highlighted JSON editor with live editing and export\n' +
      '- **Runtime** — global latency, mock status, and the Start / Stop controls\n\n' +
      'Rules hot-swap while the runtime is running — add or remove them without restarting.',
    highlight: GRPC.MOCK_SERVER_PANEL,
    preAction: async (ctx) => {
      // Setup already prepares reflection/session state. Keep intro guard
      // lightweight so step 1 does not replay fast setup choreography.
      await navigateToMockServerPanelQuiet(ctx);
      await stopMockQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight Studio first; only click when we are not already there.
      const studioBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_STUDIO);
      await spotlightAndPause(ctx, GRPC.SUB_NAV_STUDIO, 900);
      if (studioBtn && studioBtn.getAttribute('aria-selected') !== 'true') {
        await ctx.click(GRPC.SUB_NAV_STUDIO);
        await ctx.delay(700);
      } else {
        await ctx.delay(450);
      }

      // Now spotlight Advanced and click it.
      const advancedBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
      await spotlightAndPause(ctx, GRPC.SUB_NAV_ADVANCED, 950);
      if (advancedBtn && advancedBtn.getAttribute('aria-selected') !== 'true') {
        await ctx.click(GRPC.SUB_NAV_ADVANCED);
        await ctx.delay(700);
      } else {
        await ctx.delay(450);
      }

      // Spotlight the advanced nav, then click Mock server.
      await spotlightAndPause(ctx, GRPC.ADVANCED_NAV, 850);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('mock_server'), 800);
      await ctx.click(GRPC.ADVANCED_TAB('mock_server'));
      await ctx.delay(650);

      // Wait for the mock panel to render.
      try {
        await ctx.waitFor(GRPC.MOCK_SERVER_PANEL, 4_000);
      } catch { /* panel renders fast */ }
      await ctx.delay(300);

      // Spotlight the full panel.
      await spotlightAndPause(ctx, GRPC.MOCK_SERVER_PANEL, 1_050);

      // Tour the three authoring tabs.
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_BUILDER, 900);
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_JSON, 900);
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_RUNTIME, 900);

      // Return to Builder tab.
      await ctx.click(GRPC.MOCK_TAB_BUILDER);
      await ctx.delay(600);
      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 900);
      await ctx.delay(900);
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
      await ctx.click(GRPC.MOCK_BUILDER_ADD_RULE);
      await ctx.delay(500);

      // Wait for the rule element to appear.
      try {
        await ctx.waitFor(GRPC.MOCK_BUILDER_RULE, 3_000);
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
      await ctx.delay(600);
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
      const existingRules = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE);
      if (existingRules.length === 0) {
        // User skipped Step 2 — add Rule 1 silently so the action can add Rule 2 normally.
        await selectMockAuthoringTab(ctx, 'json');
        const rule1Json = JSON.stringify({
          version: 1,
          rules: [{
            id: 'demo-ping-rule',
            name: PING_RULE_NAME,
            enabled: true,
            priority: 1,
            predicate: { type: 'leaf', kind: 'body_path_equals', path: PING_BODY_PATH, value: PING_MATCH_VALUE },
            response: { body: JSON.parse(PING_RESPONSE_BODY), statusCode: 0 },
          }],
        }, null, 2);
        setMockInputValue(GRPC.MOCK_RULES_JSON, rule1Json);
        await ctx.delay(200);
        await selectMockAuthoringTab(ctx, 'builder');
        await ctx.delay(200);
      }
    },
    action: async (ctx) => {
      const existingRuleCount = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE).length;

      // Show Rule 1 for context before adding Rule 2.
      const rule1El = document.querySelector<HTMLElement>(GRPC.MOCK_BUILDER_RULE);
      if (rule1El) {
        await spotlightElementAndPause(ctx, rule1El, 700);
      }

      // Ensure Rule 2 is fully visible below fixed Authoring tabs.
      const currentRules = document.querySelectorAll<HTMLElement>(GRPC.MOCK_BUILDER_RULE);
      if (currentRules.length >= 2) {
        await scrollBelowMockAuthoringTabs(ctx, currentRules[1]);
      }

      if (existingRuleCount < 2) {
        // Educational flow: add Rule 2 step-by-step.
        await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_ADD_RULE, 800);
        await ctx.click(GRPC.MOCK_BUILDER_ADD_RULE);
        await ctx.delay(500);

        const ids = getLastRuleIds();
        if (ids) {
          const ruleEl = document.querySelector<HTMLElement>(`[data-testid="grpc-mock-builder-rule-${ids.ruleId}"]`);
          if (ruleEl) {
            await scrollBelowMockAuthoringTabs(ctx, ruleEl);
            await spotlightElementAndPause(ctx, ruleEl, 700);
          }

          setMockInputValue(`[data-testid="grpc-mock-builder-name-${ids.ruleId}"]`, FALLBACK_RULE_NAME);
          await ctx.delay(400);

          await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-leaf-kind-${ids.nodeId}"]`, 800);
          setSelectValue(`[data-testid="grpc-mock-builder-leaf-kind-${ids.nodeId}"]`, 'body_path_exists');
          await ctx.delay(600);

          await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-leaf-path-${ids.nodeId}"]`, 700);
          setMockInputValue(`[data-testid="grpc-mock-builder-leaf-path-${ids.nodeId}"]`, FALLBACK_BODY_PATH);
          await ctx.delay(400);

          await spotlightAndPause(ctx, `[data-testid="grpc-mock-builder-status-${ids.ruleId}"]`, 800);
          setSelectValue(`[data-testid="grpc-mock-builder-status-${ids.ruleId}"]`, String(FALLBACK_STATUS_CODE));
          await ctx.delay(500);
        }
      }

      // Payoff: spotlight the full builder panel showing both rules and their priority ordering.
      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 1_000);
      await ctx.delay(600);
    },
    verify: GRPC.MOCK_BUILDER_PANEL,
  },

  // =========================================================================
  // Step 4 — Builder UX: Collapse, Search & Drag-to-Reorder
  // =========================================================================
  {
    id: 'grpc13-builder-ux',
    title: 'Builder UX: Collapse, Search & Drag',
    pauseAfter: true,
    description:
      'The Builder has several UX features that help manage large rule sets:\n\n' +
      '- **Collapse/expand** — click the chevron (▶ / ▼) on a rule card to collapse it ' +
      'into a single-line **predicate summary** (e.g. `body.message == "ping" → OK`). ' +
      'Collapsed rules show the full rule logic at a glance.\n' +
      '- **Search bar** — type in the search input to filter rules by name or predicate. ' +
      'Only matching rules are shown; clear the search to see all rules again.\n' +
      '- **Drag-to-reorder** — grab the drag handle (⠿) on a rule card and drag it up or ' +
      'down to reorder rules. Priority is updated automatically.\n' +
      '- **Hover actions** — hover any rule card to reveal **Duplicate**, **Delete**, and ' +
      '**Test** buttons that fade in on the right side of the header.\n\n' +
      'These features make it practical to work with 10+ rules without losing track.',
    highlight: GRPC.MOCK_BUILDER_PANEL,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      const existing = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE);
      if (existing.length < 2) {
        await ensureDemoRulesQuiet(ctx);
      }
      await selectMockAuthoringTab(ctx, 'builder');
      await ctx.delay(200);
    },
    action: async (ctx) => {
      // ── 0. Orient: show both rules expanded ──────────────────────────────
      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 1_200);

      const ruleEls = document.querySelectorAll<HTMLElement>(GRPC.MOCK_BUILDER_RULE);
      const firstRuleId = ruleEls[0]?.getAttribute('data-testid')?.replace('grpc-mock-builder-rule-', '');
      const secondRuleId = ruleEls[1]?.getAttribute('data-testid')?.replace('grpc-mock-builder-rule-', '');

      // ── 1. COLLAPSE / EXPAND ─────────────────────────────────────────────
      if (firstRuleId) {
        const collapseBtn = document.querySelector<HTMLButtonElement>(
          `[data-testid="grpc-mock-builder-collapse-${firstRuleId}"]`,
        );

        // Spotlight the chevron button so viewer knows what to click.
        if (collapseBtn) {
          await scrollBelowMockAuthoringTabs(ctx, collapseBtn);
          await ctx.delay(300);
          await spotlightElementAndPause(ctx, collapseBtn, 1_400);
          collapseBtn.click();
          await ctx.delay(700);
        }

        // Spotlight the resulting predicate summary line.
        const summaryEl = document.querySelector<HTMLElement>(
          `[data-testid="grpc-mock-builder-summary-${firstRuleId}"]`,
        );
        if (summaryEl) {
          await scrollBelowMockAuthoringTabs(ctx, summaryEl);
          await ctx.delay(300);
          await spotlightElementAndPause(ctx, summaryEl, 1_400);
        }

        // Re-expand Rule 1.
        if (collapseBtn) {
          collapseBtn.click();
          await ctx.delay(600);
        }
      }

      // Also collapse/spotlight Rule 2 summary so viewer sees it works on any rule.
      if (secondRuleId) {
        const collapseBtn2 = document.querySelector<HTMLButtonElement>(
          `[data-testid="grpc-mock-builder-collapse-${secondRuleId}"]`,
        );
        if (collapseBtn2) {
          await scrollBelowMockAuthoringTabs(ctx, collapseBtn2);
          await ctx.delay(300);
          collapseBtn2.click();
          await ctx.delay(500);

          const summaryEl2 = document.querySelector<HTMLElement>(
            `[data-testid="grpc-mock-builder-summary-${secondRuleId}"]`,
          );
          if (summaryEl2) {
            await spotlightElementAndPause(ctx, summaryEl2, 1_200);
          }

          // Re-expand Rule 2.
          collapseBtn2.click();
          await ctx.delay(500);
        }
      }

      // ── 2. SEARCH BAR ────────────────────────────────────────────────────
      const searchEl = document.querySelector<HTMLInputElement>(GRPC.MOCK_BUILDER_SEARCH);
      if (searchEl) {
        // Spotlight the search bar first.
        await scrollAndSpotlight(ctx, GRPC.MOCK_BUILDER_SEARCH, 1_400);

        // Type "Ping" — only Rule 1 should remain visible.
        setMockInputValue(GRPC.MOCK_BUILDER_SEARCH, 'Ping');
        await ctx.delay(500);

        // Spotlight the filtered single result.
        const filteredRule = document.querySelector<HTMLElement>(GRPC.MOCK_BUILDER_RULE);
        if (filteredRule) {
          await spotlightElementAndPause(ctx, filteredRule, 1_200);
        }

        // Clear search to restore both rules.
        setMockInputValue(GRPC.MOCK_BUILDER_SEARCH, '');
        await ctx.delay(600);
        await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 900);
      }

      // ── 3. DRAG HANDLE ───────────────────────────────────────────────────
      // Scroll Rule 1 into view and spotlight its entire header row, then the handle.
      if (firstRuleId) {
        const rule1El = document.querySelector<HTMLElement>(GRPC.MOCK_BUILDER_RULE);
        if (rule1El) {
          await scrollBelowMockAuthoringTabs(ctx, rule1El);
          await ctx.delay(300);
          await spotlightElementAndPause(ctx, rule1El, 900);
        }

        const dragHandle = document.querySelector<HTMLElement>(
          `[data-testid="grpc-mock-builder-drag-${firstRuleId}"]`,
        );
        if (dragHandle) {
          await spotlightElementAndPause(ctx, dragHandle, 1_400);
        }
      }

      // ── 4. HOVER ACTIONS (Duplicate / Delete / Test) ─────────────────────
      if (firstRuleId) {
        const actionsGroup = document.querySelector<HTMLElement>(
          `[data-testid="grpc-mock-builder-rule-${firstRuleId}"] .grpc-mock-builder-actions-group`,
        );
        if (actionsGroup) {
          // Force-show the actions group (same as hover) so viewer can see the buttons.
          actionsGroup.style.opacity = '1';
          await ctx.delay(200);

          await spotlightElementAndPause(ctx, actionsGroup, 1_700);

          // Spotlight a representative action button.
          const testBtn = document.querySelector<HTMLElement>(
            `[data-testid="grpc-mock-builder-test-toggle-${firstRuleId}"]`,
          );
          if (testBtn) await spotlightElementAndPause(ctx, testBtn, 1_000);

          // Remove the forced opacity so it reverts to hover-only.
          actionsGroup.style.opacity = '';
          await ctx.delay(300);
        }
      }

      // ── Payoff: full panel ────────────────────────────────────────────────
      await spotlightAndPause(ctx, GRPC.MOCK_BUILDER_PANEL, 1_200);
      await ctx.delay(700);
    },
    verify: GRPC.MOCK_BUILDER_PANEL,
  },

  // =========================================================================
  // Step 5 — Dry-Run Tester: evaluate a rule in isolation
  // =========================================================================
  {
    id: 'grpc13-dry-run',
    title: 'Dry-Run Tester: Test a Rule',
    pauseAfter: true,
    description:
      'Each rule has an inline **dry-run tester** — click the **edit / test** control on a rule card ' +
      'to open it. Fill in a mock evaluation context (service, method, metadata, request body) ' +
      'and click **Run test** to see whether this rule would match.\n\n' +
      'The tester evaluates the rule\'s predicate **in isolation** — it doesn\'t start the ' +
      'mock runtime or send any network traffic. This is useful for debugging complex predicates ' +
      'before going live.\n\n' +
      'The result shows **Match** or **No match** with the evaluated response if it matches.',
    highlight: GRPC.MOCK_BUILDER_PANEL,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      const existing = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE);
      if (existing.length < 2) {
        await ensureDemoRulesQuiet(ctx);
      }
      await selectMockAuthoringTab(ctx, 'builder');
      // Quietly expand the first (Ping) rule so action can open the tester immediately.
      const firstRuleEl = document.querySelector<HTMLElement>(GRPC.MOCK_BUILDER_RULE);
      const preRuleId = firstRuleEl?.getAttribute('data-testid')?.replace('grpc-mock-builder-rule-', '');
      if (preRuleId && document.querySelector(`[data-testid="grpc-mock-builder-summary-${preRuleId}"]`)) {
        document
          .querySelector<HTMLButtonElement>(`[data-testid="grpc-mock-builder-collapse-${preRuleId}"]`)
          ?.click();
      }
      await ctx.delay(200);
    },
    action: async (ctx) => {
      const ruleEls = document.querySelectorAll<HTMLElement>(GRPC.MOCK_BUILDER_RULE);
      const firstRuleId = ruleEls[0]?.getAttribute('data-testid')?.replace('grpc-mock-builder-rule-', '');
      if (!firstRuleId) return;

      // Expand quietly if still collapsed — skip chevron tour (preAction usually handled it).
      const isRule1Collapsed = !!document.querySelector(
        `[data-testid="grpc-mock-builder-summary-${firstRuleId}"]`,
      );
      if (isRule1Collapsed) {
        document
          .querySelector<HTMLButtonElement>(`[data-testid="grpc-mock-builder-collapse-${firstRuleId}"]`)
          ?.click();
        await ctx.delay(350);
      }

      const actionsGroup = document.querySelector<HTMLElement>(
        `[data-testid="grpc-mock-builder-rule-${firstRuleId}"] .grpc-mock-builder-actions-group`,
      );
      if (actionsGroup) {
        // Demo spotlight needs hover-only actions to be visible before click.
        actionsGroup.style.opacity = '1';
        await ctx.delay(120);
      }

      // Open the dry-run tester — short hold so Acting doesn't linger on the pencil.
      const testToggle = document.querySelector<HTMLButtonElement>(
        `[data-testid="grpc-mock-builder-test-toggle-${firstRuleId}"]`,
      );
      if (testToggle) {
        testToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(280);
        await spotlightElementAndPause(ctx, testToggle, 800);
        testToggle.click();
        await ctx.delay(450);
      }

      if (actionsGroup) {
        actionsGroup.style.opacity = '';
      }

      try {
        await ctx.waitFor('[data-testid="grpc-mock-tester-close"]', 3_000);
      } catch { /* renders synchronously */ }

      // One digest of the open tester (no separate modal-shell + form tours).
      const testerEl = document.querySelector<HTMLElement>(
        `[data-testid="grpc-mock-builder-tester-${firstRuleId}"]`,
      );
      if (testerEl) {
        await spotlightElementAndPause(ctx, testerEl, GRPC13_DRY_RUN_SPOTLIGHT_MS);
      }

      const bodyInput = `[data-testid="grpc-mock-tester-body-${firstRuleId}"]`;
      await scrollAndSpotlight(ctx, bodyInput, GRPC13_DRY_RUN_SPOTLIGHT_MS);
      setMockInputValue(bodyInput, JSON.stringify({ message: 'ping' }, null, 2));
      await ctx.delay(500);

      const evalBtn = `[data-testid="grpc-mock-tester-run-${firstRuleId}"]`;
      await scrollAndSpotlight(ctx, evalBtn, GRPC13_DRY_RUN_SPOTLIGHT_MS);
      const evalBtnEl = document.querySelector<HTMLButtonElement>(evalBtn);
      if (evalBtnEl) {
        evalBtnEl.click();
        await ctx.delay(600);
      }

      const resultEl = document.querySelector<HTMLElement>(
        `[data-testid="grpc-mock-tester-result-${firstRuleId}"]`,
      );
      if (resultEl) {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        await ctx.delay(300);
        await spotlightElementAndPause(ctx, resultEl, GRPC13_DRY_RUN_PAYOFF_MS);
      }

      const closeBtn = document.querySelector<HTMLButtonElement>('[data-testid="grpc-mock-tester-close"]');
      if (closeBtn) {
        closeBtn.click();
        await ctx.delay(450);
      } else if (testToggle) {
        testToggle.click();
        await ctx.delay(350);
      }
    },
    verify: GRPC.MOCK_BUILDER_PANEL,
  },

  // =========================================================================
  // Step 6 — Runtime tab: set global latency
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
      'Use it to test client timeout handling — set latency above your client\'s deadline and watch it cancel. ' +
      'This step also starts the mock runtime so the configured delay is active before the ping test.',
    highlight: GRPC.MOCK_TAB_RUNTIME,
    preAction: async (ctx) => {
      await navigateToMockServerPanelQuiet(ctx);
      // Ensure rules exist.
      const existing = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE);
      if (existing.length < 2) {
        await ensureDemoRulesQuiet(ctx);
      }
      // Pin Runtime below the Advanced nav with top pad so the Reading
      // spotlight ring isn't half-clipped under the feature-tab bar.
      await scrollMockControlIntoView(ctx, GRPC.MOCK_TAB_RUNTIME, 'start');
    },
    action: async (ctx) => {
      await scrollMockControlIntoView(ctx, GRPC.MOCK_TAB_RUNTIME, 'start');
      await spotlightAndPause(ctx, GRPC.MOCK_TAB_RUNTIME, 800);
      await ctx.click(GRPC.MOCK_TAB_RUNTIME);
      await ctx.delay(500);

      // Latency fields live below the header — scroll them fully into view first.
      await scrollAndSpotlight(ctx, '[data-testid="grpc-mock-latency-default"]', 900);
      setMockInputValue('[data-testid="grpc-mock-latency-default"]', String(DEMO_LATENCY_MS));
      await ctx.delay(500);

      await scrollAndSpotlight(ctx, '[data-testid="grpc-mock-latency-jitter"]', 800);
      setMockInputValue('[data-testid="grpc-mock-latency-jitter"]', String(DEMO_JITTER_MS));
      await ctx.delay(500);

      await startMockQuiet(ctx);
      await ctx.delay(400);

      await scrollAndSpotlight(ctx, '[data-testid="grpc-mock-runtime-panel"]', 900);
    },
    verify: GRPC.MOCK_TAB_RUNTIME,
  },
];
