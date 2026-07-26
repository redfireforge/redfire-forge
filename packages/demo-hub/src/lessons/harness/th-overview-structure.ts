/**
 * TH-1 — Harness Overview & Structure
 *
 * 5 steps: navigate to the Testing domain → understand env/svc scoping →
 * see a pre-built Feature Group → explore the test hierarchy →
 * preview the Runner and Results tabs.
 *
 * Introduces the Testing domain layout so every subsequent TH lesson
 * can skip orientation and jump straight into authoring/execution.
 */
import type { DemoLesson } from '../../types';
import { APP, HAR } from '@shared/selectors';
import {
  spotlight,
  spotlightSel,
  seedDemoEnvAndService,
  seedDemoFeatureGroup,
  deleteDemoFeatureGroup,
  ensureDemoFgExists,
  expandFirstFg,
  expandFirstScenario,
} from './th-demo-helpers';

// ─── Lesson ─────────────────────────────────────────────────────────

export const thOverviewStructureLesson: DemoLesson = {
  id: 'th-overview-structure',
  domainId: 'harness',
  category: 'fundamentals',
  name: 'Harness Overview & Structure',
  description:
    'Navigate the Testing domain — learn the 5 sub-tabs, how env/svc scoping works, ' +
    'and how Feature Groups organize your test suites.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios', 'runner', 'param-runner', 'workflow-runner', 'results'],

  concept: {
    title: 'Organize, Execute, and Analyze API Tests',
    body:
      'The **Test Harness** is where you build, run, and analyze API test suites.\n\n' +
      '**Five areas, one workflow:**\n' +
      '- **Feature Groups** — organize tests into a hierarchy: Feature Group → Scenario → Test\n' +
      '- **Test Runner** — execute standard test suites with configurable iterations and concurrency\n' +
      '- **Parameterized Runner** — data-driven testing with CSV/JSON data sources\n' +
      '- **Workflow Runner** — execute full workflow sequences as test runs\n' +
      '- **Results** — review run history, SLA evaluation, and performance metrics\n\n' +
      '**In this lesson:** You will explore the domain layout, understand how environment ' +
      'and microservice scoping works, and navigate the test hierarchy.',
    keyTerms: [
      { term: 'Feature Group', definition: 'Top-level organizer for tests — group by API area, business domain, or team.' },
      { term: 'Scenario', definition: 'A container for related tests within a Feature Group — can be Standard or Parameterized.' },
      { term: 'Test', definition: 'A single HTTP request with URL, method, headers, body, and validation rules.' },
      { term: 'Environment', definition: 'A named configuration (e.g. dev, staging, prod) that determines base URLs and variables.' },
      { term: 'Microservice', definition: 'A target API service — tests are scoped to one env + microservice pair.' },
    ],
    diagram: `<svg viewBox="0 0 360 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="110" height="80" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="60" y="22" text-anchor="middle" fill="#3b82f6" font-size="8" font-weight="700">Feature Group</text>
      <rect x="15" y="30" width="90" height="48" rx="4" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <text x="60" y="44" text-anchor="middle" fill="#94a3b8" font-size="7">Scenario</text>
      <rect x="22" y="50" width="75" height="10" rx="2" fill="#1e293b" stroke="#64748b" stroke-width="0.5"/>
      <text x="60" y="58" text-anchor="middle" fill="#cbd5e1" font-size="6">GET /users</text>
      <rect x="22" y="63" width="75" height="10" rx="2" fill="#1e293b" stroke="#64748b" stroke-width="0.5"/>
      <text x="60" y="71" text-anchor="middle" fill="#cbd5e1" font-size="6">POST /users</text>
      <path d="M120 45 L155 45" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#th1arr)"/>
      <rect x="160" y="15" width="70" height="30" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="195" y="34" text-anchor="middle" fill="#10b981" font-size="8" font-weight="600">Runner</text>
      <rect x="160" y="52" width="70" height="30" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="195" y="71" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="600">Results</text>
      <path d="M235 30 L270 30 L270 67 L290 67" stroke="#94a3b8" stroke-width="1.2" fill="none" marker-end="url(#th1arr)"/>
      <path d="M235 67 L290 67" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#th1arr)"/>
      <rect x="295" y="50" width="55" height="30" rx="6" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="322" y="63" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="600">Metrics</text>
      <text x="322" y="74" text-anchor="middle" fill="#94a3b8" font-size="6">SLA · Trends</text>
      <defs><marker id="th1arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('scenarios');
    await ctx.delay(300);
    deleteDemoFeatureGroup();
    await ctx.delay(200);
  },

  // ── Cleanup ──────────────────────────────────────────────────────
  cleanup: async (ctx) => {
    deleteDemoFeatureGroup();
    delete (window as unknown as Record<string, unknown>).__demoTh1Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: The Testing Domain ──────────────────────────────────
    {
      id: 'th1-domain-tour',
      title: 'The Testing Domain',
      description:
        'Welcome to the **Test Harness** — the home for all your API test authoring, ' +
        'execution, and analysis.\n\n' +
        'The sub-navigation bar shows **5 tabs** that form the testing workflow:\n' +
        '- **Feature Groups** — author and organize tests\n' +
        '- **Test Runner** — execute standard test suites\n' +
        '- **Parameterized Runner** — data-driven execution with CSV/JSON data\n' +
        '- **Workflow Runner** — run workflow sequences as tests\n' +
        '- **Results** — review run history, metrics, and SLA evaluation\n\n' +
        'You\'ll spend most of your time in Feature Groups authoring tests, then switch ' +
        'to a Runner to execute and Results to analyze.',
      highlight: '.sub-nav-tabs',

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(300);
      },

      action: async (ctx) => {
        // Click the Harness button in the activity bar
        const harnessBtn = document.querySelector<HTMLElement>('[data-testid="nav-harness"]');
        if (harnessBtn) {
          await ctx.click('[data-testid="nav-harness"]');
          await ctx.delay(800);
        }

        // Spotlight each of the 5 sub-nav tabs individually so the viewer reads each one
        const tabs = [
          { sel: HAR.NAV_SCENARIOS, hold: 1200 },
          { sel: HAR.NAV_RUNNER, hold: 1000 },
          { sel: HAR.NAV_PARAM_RUNNER, hold: 1000 },
          { sel: HAR.NAV_WF_RUNNER, hold: 1000 },
          { sel: HAR.NAV_RESULTS, hold: 1000 },
        ];
        for (const { sel, hold } of tabs) {
          const tab = document.querySelector<HTMLElement>(sel);
          if (tab) await spotlight(tab, hold, ctx);
          await ctx.delay(300);
        }
      },

      verify: HAR.NAV_SCENARIOS,
    },

    // ── Step 2: Environment & Microservice Scoping ──────────────────
    {
      id: 'th1-env-scope',
      title: 'Environment & Microservice Scoping',
      description:
        'Every test suite in RedfireForge is **scoped to an environment and microservice** pair.\n\n' +
        'The **Environment** selector determines which server configuration is active ' +
        '(dev, staging, production) — including base URLs and variables.\n\n' +
        'The **Microservice** selector targets a specific API service. Switch the microservice, ' +
        'and you see a completely different set of Feature Groups.\n\n' +
        'This scoping lets you manage test suites for multiple services across multiple ' +
        'environments from a single workspace.',
      highlight: APP.HEADER_ENV_SELECT,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
      },

      action: async (ctx) => {
        // Seed env + svc (creates them if missing, selects them in header)
        const ids = await seedDemoEnvAndService(ctx);
        await ctx.delay(600);

        // Spotlight and click the Environment selector to open its dropdown
        await spotlightSel(ctx, APP.HEADER_ENV_SELECT, 1000);
        await ctx.click(APP.HEADER_ENV_SELECT);
        await ctx.delay(1200);
        // Close by clicking the selector again (toggle)
        await ctx.click(APP.HEADER_ENV_SELECT);
        await ctx.delay(400);

        // Spotlight and click the Microservice selector to open its dropdown
        await spotlightSel(ctx, APP.HEADER_SVC_SELECT, 1000);
        await ctx.click(APP.HEADER_SVC_SELECT);
        await ctx.delay(1200);
        // Close by clicking the selector again
        await ctx.click(APP.HEADER_SVC_SELECT);
        await ctx.delay(400);

        // Store ids for next step
        if (ids) {
          (window as unknown as Record<string, unknown>).__demoTh1Ids = ids;
        }
      },

      verify: APP.HEADER_SVC_SELECT,
    },

    // ── Step 3: A Pre-Built Test Suite ──────────────────────────────
    {
      id: 'th1-seed-tests',
      title: 'A Pre-Built Test Suite',
      description:
        'Let\'s load a **pre-configured test suite** so you can explore the structure.\n\n' +
        'A **Feature Group** called "User API Tests" appears in the tree. Feature Groups are ' +
        'the top-level organizer — group tests by API area, business domain, or team ownership.\n\n' +
        'In practice, you can create Feature Groups manually with **+ Add Feature Group**, ' +
        'or import them from JSON export files. The Gallery page also offers ready-made ' +
        'test samples for common API patterns.',
      highlight: HAR.FG_CARD,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        const ids = (window as unknown as Record<string, unknown>).__demoTh1Ids as { envId: string; svcId: string } | undefined;
        if (ids) {
          seedDemoFeatureGroup(ids.envId, ids.svcId);
        } else {
          const freshIds = await seedDemoEnvAndService(ctx);
          if (freshIds) seedDemoFeatureGroup(freshIds.envId, freshIds.svcId);
        }
        await ctx.delay(300);
      },

      action: async (ctx) => {
        // Seed the FG if not already present
        let ids = (window as unknown as Record<string, unknown>).__demoTh1Ids as { envId: string; svcId: string } | undefined;
        if (!ids) ids = (await seedDemoEnvAndService(ctx)) ?? undefined;
        if (ids) seedDemoFeatureGroup(ids.envId, ids.svcId);
        await ctx.delay(800);

        // Spotlight the Feature Group card
        const fgCard = document.querySelector<HTMLElement>(HAR.FG_CARD);
        if (fgCard) await spotlight(fgCard, 1500, ctx);

        // Spotlight the "+ Add Feature Group" button
        await spotlightSel(ctx, HAR.ADD_FG_BTN, 1200);
      },

      verify: HAR.FG_CARD,
    },

    // ── Step 4: Navigate the Test Hierarchy ─────────────────────────
    {
      id: 'th1-tree-nav',
      title: 'Navigate the Test Hierarchy',
      description:
        'The test hierarchy is three levels deep: **Feature Group → Scenario → Tests**.\n\n' +
        'Click to expand the Feature Group and reveal its **Scenario** — a container ' +
        'for related tests. The kind badge shows "Standard" (one run per test) vs ' +
        '"Parameterized" (data-driven, one run per data row).\n\n' +
        'Inside the Scenario, you see individual **test cards** — each showing the HTTP ' +
        'method (GET, POST), the test name, and validation status. This hierarchy lets you ' +
        'organize hundreds of tests into logical groups.',
      highlight: HAR.FG_EXPAND,

      preAction: async (ctx) => {
        await ensureDemoFgExists(ctx);
      },

      action: async (ctx) => {
        // Expand the Feature Group
        await expandFirstFg(ctx);
        await ctx.delay(800);

        // Spotlight the Scenario card
        const scenarioCard = document.querySelector<HTMLElement>(HAR.SCENARIO_CARD);
        if (scenarioCard) await spotlight(scenarioCard, 1800, ctx);
        await ctx.delay(400);

        // Expand the Scenario to reveal tests
        await expandFirstScenario(ctx);
        await ctx.delay(800);

        // Spotlight the first test card
        const testCards = document.querySelectorAll<HTMLElement>(HAR.TEST_CARD);
        if (testCards.length > 0) {
          await spotlight(testCards[0], 1500, ctx);
        }
        await ctx.delay(400);

        // Spotlight the entire expanded content (Feature Group + Scenario + Tests)
        const fgCard = document.querySelector<HTMLElement>(HAR.FG_CARD);
        if (fgCard) await spotlight(fgCard, 2200, ctx);
      },

      verify: HAR.TEST_CARD,
    },

    // ── Step 5: Preview Runner & Results ────────────────────────────
    {
      id: 'th1-tabs-preview',
      title: 'Preview Runner & Results',
      description:
        'Now let\'s quickly peek at the other two essential tabs.\n\n' +
        'The **Test Runner** is where you execute your test suites — configure iterations, ' +
        'concurrency, and SLA overrides, then watch live progress.\n\n' +
        'The **Results** tab stores all run history — metrics, timing breakdowns, SLA ' +
        'pass/fail evaluation, and baseline comparisons.\n\n' +
        'In the upcoming lessons, you\'ll learn to author tests, configure validations, ' +
        'and run them through these runners.',
      highlight: '[data-testid="nav-tab-runner"]',

      preAction: async (ctx) => {
        await ensureDemoFgExists(ctx);
      },

      action: async (ctx) => {
        // Click Test Runner tab — viewer sees the runner page
        await ctx.click(HAR.NAV_RUNNER);
        await ctx.delay(1800);

        // Click Results tab — viewer sees the results page
        await ctx.click(HAR.NAV_RESULTS);
        await ctx.delay(1800);

        // Return to Feature Groups
        await ctx.click(HAR.NAV_SCENARIOS);
        await ctx.delay(800);
      },

      verify: HAR.NAV_SCENARIOS,
    },
  ],
};
