/**
 * TH-4 — The Test Runner
 *
 * 6 steps: see the host selector → configure execution mode & iterations →
 * select scenarios → preview the execution plan → run & monitor live
 * progress → navigate to results.
 *
 * Teaches the standard Test Runner workflow end-to-end.
 */
import type { DemoLesson } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  deleteTh4DemoFg,
  ensureTh4FgExists,
  selectFirstScenarioInRunner,
  setIterationsValue,
} from './th-demo-helpers';

// ─── Lesson ──────────────────────────────────────────────────────

export const thTestRunnerLesson: DemoLesson = {
  id: 'th-test-runner',
  domainId: 'harness',
  category: 'execution',
  name: 'The Test Runner',
  description:
    'Execute your test suite — configure the host, set execution mode and iterations, ' +
    'preview the plan, run, and monitor live progress.',
  estimatedMinutes: 6,
  initialTab: 'runner',
  allowedTabs: ['scenarios', 'runner', 'results'],

  concept: {
    title: 'The Standard Test Runner',
    body:
      'The Test Runner executes your test suite and shows live progress.\n\n' +
      '**Three configuration areas:**\n' +
      '1. **Host** — where to send requests: Original URLs, Settings base URL, or a Custom override\n' +
      '2. **Execution Config** — mode (Sequential, Batch, Pool, Load Profile, Arrival Rate), ' +
      'concurrency, iterations, timeout, and retry\n' +
      '3. **Scenario Selector** — which scenarios and tests to include, with override controls\n\n' +
      '**Five execution modes:**\n' +
      '- **Sequential** — one request at a time, in order\n' +
      '- **Batch** — fires N requests in parallel, waits, then fires the next batch\n' +
      '- **Continuous Pool** — keeps N requests in-flight at all times\n' +
      '- **Load Profile** — time-based with ramp-up/sustained/spike patterns\n' +
      '- **Constant Arrival** — fires N requests/second (Desktop only)\n\n' +
      '**In this lesson:** You will configure a Batch run with 2 iterations, execute it, ' +
      'and navigate to the saved results.',
    keyTerms: [
      { term: 'Host Mode', definition: 'Controls URL resolution: Original (as authored), Settings (microservice base URL), or Custom (override).' },
      { term: 'Execution Mode', definition: 'Determines how requests are scheduled: sequential, batched, pooled, or load-shaped.' },
      { term: 'Iterations', definition: 'How many times each test runs. 2 iterations × 3 tests = 6 total requests.' },
      { term: 'Execution Plan', definition: 'Preview showing the exact request count before you commit to running.' },
    ],
    diagram: `<svg viewBox="0 0 360 70" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="8" width="65" height="54" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="37" y="28" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Host</text>
      <text x="37" y="42" text-anchor="middle" fill="#94a3b8" font-size="6">Original</text>
      <text x="37" y="54" text-anchor="middle" fill="#94a3b8" font-size="6">Settings · Custom</text>
      <path d="M75 35 L95 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th4arr)"/>
      <rect x="100" y="8" width="70" height="54" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="135" y="24" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Config</text>
      <text x="135" y="36" text-anchor="middle" fill="#94a3b8" font-size="6">Batch · 2 iter</text>
      <text x="135" y="48" text-anchor="middle" fill="#94a3b8" font-size="6">3 tests</text>
      <path d="M175 35 L195 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th4arr)"/>
      <rect x="200" y="8" width="55" height="54" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="227" y="28" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">▶ Run</text>
      <text x="227" y="42" text-anchor="middle" fill="#94a3b8" font-size="6">6 reqs</text>
      <path d="M260 35 L280 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th4arr)"/>
      <rect x="285" y="8" width="70" height="54" rx="5" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="320" y="24" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="700">Results</text>
      <text x="320" y="36" text-anchor="middle" fill="#94a3b8" font-size="6">6/6 passed</text>
      <text x="320" y="48" text-anchor="middle" fill="#94a3b8" font-size="6">TPS · Avg ms</text>
      <defs><marker id="th4arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('runner');
    await ctx.delay(300);
    deleteTh4DemoFg();
    await ctx.delay(200);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    deleteTh4DemoFg();
    delete (window as unknown as Record<string, unknown>).__demoTh4Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Host Configuration ───────────────────────────────
    {
      id: 'th4-host-selector',
      title: 'Host Configuration',
      description:
        'At the top of the Test Runner is the **Host** selector — it controls how ' +
        'request URLs are resolved.\n\n' +
        'Three modes:\n' +
        '- **Original** — uses URLs exactly as written in each test (best for absolute URLs)\n' +
        '- **Settings** — replaces the host portion with the microservice\'s base URL from Settings\n' +
        '- **Custom** — lets you type any override URL\n\n' +
        'Since our tests use absolute JSONPlaceholder URLs, **Original** is the correct choice.',
      highlight: HAR.HOST_SELECTOR,

      preAction: async (ctx) => {
        ctx.navigateToTab('runner');
        await ctx.delay(300);
        await ensureTh4FgExists(ctx);
      },

      action: async (ctx) => {
        await ensureTh4FgExists(ctx);
        await ctx.delay(400);

        const hostSelector = document.querySelector<HTMLElement>(HAR.HOST_SELECTOR);
        if (hostSelector) await spotlight(hostSelector, 2000, ctx);

        const labels = hostSelector?.querySelectorAll<HTMLElement>('label.radio-label');
        const originalLabel = Array.from(labels || []).find(l =>
          l.textContent?.trim()?.startsWith('Original'),
        );
        const originalRadio = originalLabel?.querySelector<HTMLInputElement>('input[type="radio"]');
        if (originalRadio && !originalRadio.checked) {
          originalRadio.click();
          await ctx.delay(500);
        }
      },

      verify: HAR.HOST_SELECTOR,
    },

    // ── Step 2: Execution Mode & Concurrency ─────────────────────
    {
      id: 'th4-execution-config',
      title: 'Execution Mode & Iterations',
      description:
        'The **Execution Config** panel controls how requests are scheduled.\n\n' +
        'Five execution modes:\n' +
        '- **Sequential** — one at a time, in order\n' +
        '- **Batch** — fires N requests in parallel, waits for all, then fires the next batch\n' +
        '- **Continuous Pool** — keeps N requests in-flight at all times\n' +
        '- **Load Profile** — time-based with ramp-up/sustained/spike shaping\n' +
        '- **Constant Arrival** — fires N requests/second (Desktop only)\n\n' +
        '**Batch** is the default and a great starting point. ' +
        'Set **Iterations** to **2** so each test runs twice — ' +
        'this gives us 6 total requests to observe.',
      highlight: HAR.EXEC_CONFIG,

      preAction: async (ctx) => {
        ctx.navigateToTab('runner');
        await ctx.delay(200);
        await ensureTh4FgExists(ctx);
      },

      action: async (ctx) => {
        const execConfig = document.querySelector<HTMLElement>(HAR.EXEC_CONFIG);
        if (execConfig) {
          const modeBox = execConfig.querySelector<HTMLElement>('.runner-option-box');
          if (modeBox) await spotlight(modeBox, 1500, ctx);
        }

        await setIterationsValue(ctx, 2);
        await ctx.delay(500);

        const iterField = Array.from(document.querySelectorAll<HTMLElement>('.resilience-field'))
          .find(f => f.querySelector('label')?.textContent?.includes('Iterations'));
        if (iterField) await spotlight(iterField, 1200, ctx);
      },

      verify: HAR.EXEC_CONFIG,
    },

    // ── Step 3: Select Scenarios to Run ──────────────────────────
    {
      id: 'th4-scenario-select',
      title: 'Select Scenarios to Run',
      description:
        'The **Scenario Selector** lists all scenarios in the current environment. ' +
        'Check a scenario to select all its tests.\n\n' +
        'Above the tree, the **override controls** let you temporarily change validation ' +
        'behavior without editing test definitions:\n' +
        '- **Body Validation** — override mode for all tests (Default, None, Selective, Full)\n' +
        '- **Assertions** — enable/disable assertions globally\n' +
        '- **Unordered arrays** — override array matching order\n\n' +
        'The count badge shows how many scenarios and tests are selected.',
      highlight: HAR.SCENARIO_SELECTOR,

      preAction: async (ctx) => {
        ctx.navigateToTab('runner');
        await ctx.delay(200);
        await ensureTh4FgExists(ctx);
      },

      action: async (ctx) => {
        await selectFirstScenarioInRunner(ctx);
        await ctx.delay(600);

        const countBadge = document.querySelector<HTMLElement>('.filter-count');
        if (countBadge) await spotlight(countBadge, 1500, ctx);

        const overrides = document.querySelector<HTMLElement>('.selection-actions');
        if (overrides) await spotlight(overrides, 1200, ctx);
      },

      verify: HAR.SCENARIO_SELECTOR,
    },

    // ── Step 4: Execution Plan Preview ───────────────────────────
    {
      id: 'th4-exec-plan',
      title: 'Execution Plan Preview',
      description:
        'Once scenarios are selected and iterations are configured, the **Execution Plan** ' +
        'appears showing exactly what will run:\n\n' +
        '`2 iterations × 3 tests = 6 requests`\n\n' +
        'This preview lets you verify the request count before committing to a run. ' +
        'Adjust iterations, weights, or scenario selection to change the total.',
      highlight: HAR.EXEC_PLAN,

      preAction: async (ctx) => {
        ctx.navigateToTab('runner');
        await ctx.delay(200);
        await ensureTh4FgExists(ctx);
        await selectFirstScenarioInRunner(ctx);
        await setIterationsValue(ctx, 2);
      },

      action: async (ctx) => {
        const plan = document.querySelector<HTMLElement>(HAR.EXEC_PLAN);
        if (plan) await spotlight(plan, 2000, ctx);
      },

      verify: HAR.EXEC_PLAN,
    },

    // ── Step 5: Run & Monitor Progress ───────────────────────────
    {
      id: 'th4-run',
      title: 'Run & Monitor Progress',
      description:
        'Click **▶ Run Test** to start execution.\n\n' +
        'The **Live Progress** panel appears with:\n' +
        '- A **progress bar** showing completion percentage\n' +
        '- **Live metrics** — TPS (requests/sec), Avg Response time, Error Rate, ' +
        'and Validation Failures\n' +
        '- Real-time charts plotting response time, throughput, and error rate over time\n\n' +
        'When the run completes, a **completion banner** shows the total request count ' +
        'and elapsed time.',
      highlight: HAR.RUN_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('runner');
        await ctx.delay(200);
        await ensureTh4FgExists(ctx);
        await selectFirstScenarioInRunner(ctx);
        await setIterationsValue(ctx, 2);
      },

      action: async (ctx) => {
        await ctx.click(HAR.RUN_BTN);
        await ctx.delay(1000);

        const start = Date.now();
        while (Date.now() - start < 3000) {
          if (document.querySelector(HAR.LIVE_PROGRESS)) break;
          await ctx.delay(300);
        }

        const progress = document.querySelector<HTMLElement>(HAR.LIVE_PROGRESS);
        if (progress) {
          const bar = progress.querySelector<HTMLElement>('.progress-bar-container');
          if (bar) await spotlight(bar, 1200, ctx);

          const metrics = progress.querySelector<HTMLElement>('.live-metrics');
          if (metrics) await spotlight(metrics, 1800, ctx);
        }

        const runEnd = Date.now();
        while (Date.now() - runEnd < 30000) {
          if (document.querySelector(HAR.COMPLETION)) break;
          await ctx.delay(500);
        }
        await ctx.delay(500);

        const completion = document.querySelector<HTMLElement>(HAR.COMPLETION);
        if (completion) await spotlight(completion, 1800, ctx);
      },

      verify: HAR.RUN_BTN,
    },

    // ── Step 6: View Full Results ────────────────────────────────
    {
      id: 'th4-results',
      title: 'View Full Results',
      description:
        'Click **View Full Results →** to navigate to the Results tab.\n\n' +
        'Every test run is saved with full metadata: timestamp, environment, microservice, ' +
        'request count, pass rate, execution mode, and detailed per-request results.\n\n' +
        'From here you can compare runs, set performance baselines, ' +
        'export reports, and analyze trends across multiple executions.',
      highlight: HAR.VIEW_RESULTS_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('runner');
        await ctx.delay(200);
        await ensureTh4FgExists(ctx);
      },

      action: async (ctx) => {
        const viewBtn = document.querySelector<HTMLElement>(HAR.VIEW_RESULTS_BTN);
        if (viewBtn) {
          await ctx.click(HAR.VIEW_RESULTS_BTN);
          await ctx.delay(1000);
        } else {
          ctx.navigateToTab('results');
          await ctx.delay(800);
        }

        const resultsArea = document.querySelector<HTMLElement>('.results-run-list, .results-page');
        if (resultsArea) await spotlight(resultsArea, 1500, ctx);
      },

      verify: HAR.NAV_RESULTS,
    },
  ],
};
