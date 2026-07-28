/**
 * TH-6 — The Parameterized Runner
 *
 * 6 steps: navigate to the dedicated runner tab → select scenarios and
 * review weights → see the per-test execution plan → use tag filter →
 * run with live per-row progress → view results.
 *
 * Teaches the Parameterized Runner's unique features vs the standard
 * Test Runner: per-test row breakdowns, tag-based filtering, and
 * real-time per-row progress.
 */
import type { DemoLesson } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  deleteTh6DemoFg,
  ensureTh6FgExists,
  selectFirstScenarioInRunner,
  setIterationsValue,
  fillNativeInput,
} from './th-demo-helpers';

/**
 * Both TestRunner and ParameterizedRunner are mounted simultaneously in App.tsx.
 * Scope all selectors to the param-runner page to avoid hitting the hidden
 * standard runner's elements (which come first in the DOM).
 */
const PR = '.param-runner-page';
const pr = (sel: string) => `${PR} ${sel}`;

// ─── Lesson ──────────────────────────────────────────────────────

export const thParameterizedRunnerLesson: DemoLesson = {
  id: 'th-parameterized-runner',
  domainId: 'harness',
  category: 'execution',
  name: 'The Parameterized Runner',
  description:
    'Execute parameterized tests — see the dedicated runner, per-test execution plans ' +
    'with row counts, tag-based filtering, and real-time per-row progress.',
  estimatedMinutes: 6,
  initialTab: 'param-runner',
  allowedTabs: ['scenarios', 'param-runner', 'results'],

  concept: {
    title: 'Parameterized Runner',
    body:
      'The **Parameterized Runner** is a dedicated runner tab for data-driven tests. ' +
      'It differs from the standard Test Runner in several key ways:\n\n' +
      '- **Scenario filter** — only `parameterized` scenarios appear (standard scenarios ' +
      'are in the Test Runner tab)\n' +
      '- **Execution plan** — shows `iterations × rows = requests` per test, not just ' +
      '`iterations × tests`\n' +
      '- **Tag filter** — run only rows matching specific tags (e.g., `smoke`)\n' +
      '- **Per-row progress** — see real-time completion counts per test during the run\n\n' +
      '**In this lesson:** You will configure and execute a parameterized run, see the ' +
      'execution plan, filter by tags, and monitor per-row progress.',
    keyTerms: [
      { term: 'Parameterized Runner', definition: 'A dedicated runner for parameterized scenarios — shows row-level execution details.' },
      { term: 'Execution Plan', definition: 'Preview showing iterations × rows = total requests per test before running.' },
      { term: 'Tag Filter', definition: 'Run-time filter: only data rows matching the specified tags execute.' },
      { term: 'Test Weights', definition: 'Per-test weight (0–100) controlling distribution during random execution mode.' },
    ],
    diagram: `<svg viewBox="0 0 360 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="90" height="70" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="50" y="20" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">5 Data Rows</text>
      <text x="50" y="34" text-anchor="middle" fill="#94a3b8" font-size="6">userId: 1–5</text>
      <text x="50" y="48" text-anchor="middle" fill="#10b981" font-size="5.5">smoke: 1,2,3</text>
      <text x="50" y="60" text-anchor="middle" fill="#f59e0b" font-size="5.5">regression: 4,5</text>
      <path d="M100 40 L130 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th6arr)"/>
      <rect x="135" y="10" width="90" height="60" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="180" y="26" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Runner</text>
      <text x="180" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">2 iter × 5 rows</text>
      <text x="180" y="56" text-anchor="middle" fill="#94a3b8" font-size="5.5">= 10 requests</text>
      <path d="M230 40 L260 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th6arr)"/>
      <rect x="265" y="10" width="90" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="310" y="26" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Results</text>
      <text x="310" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Per-row pass/fail</text>
      <text x="310" y="56" text-anchor="middle" fill="#94a3b8" font-size="5.5">Live metrics</text>
      <defs><marker id="th6arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    deleteTh6DemoFg();
    const w = window as unknown as Record<string, unknown>;
    delete w.__demoTh6Seeded;
    delete w.__demoTh6Ids;
    await ctx.delay(200);
    ctx.navigateToTab('param-runner');
    await ctx.delay(300);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    deleteTh6DemoFg();
    const w = window as unknown as Record<string, unknown>;
    delete w.__demoTh6Seeded;
    delete w.__demoTh6Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: The Parameterized Runner ─────────────────────────
    {
      id: 'th6-param-tab',
      title: 'The Parameterized Runner',
      description:
        'The **Parameterized Runner** is a dedicated runner tab for data-driven scenarios.\n\n' +
        'Unlike the standard Test Runner, this tab shows **only** parameterized scenarios — ' +
        'the ones with `{{variable}}` placeholders and data sources.\n\n' +
        'Notice the **📊 rows** badge next to the scenario — it shows the total number of ' +
        'data rows across all tests, telling you how many requests each iteration will generate.',
      highlight: HAR.PARAM_PAGE_HEADER,

      preAction: async (ctx) => {
        ctx.navigateToTab('param-runner');
        await ctx.delay(200);
        await ensureTh6FgExists(ctx);
      },

      action: async (ctx) => {
        await ensureTh6FgExists(ctx);
        await ctx.delay(400);

        const header = document.querySelector<HTMLElement>(HAR.PARAM_PAGE_HEADER);
        if (header) await spotlight(header, 1500, ctx);

        const selector = document.querySelector<HTMLElement>(pr(HAR.SCENARIO_SELECTOR));
        if (selector) await spotlight(selector, 1500, ctx);
      },

      verify: HAR.PARAM_PAGE_HEADER,
    },

    // ── Step 2: Select & Review Weights ──────────────────────────
    {
      id: 'th6-select-weights',
      title: 'Select & Review Weights',
      description:
        'Select the scenario to include it in the run. Once selected, the **Test Distribution ' +
        '(weights)** section appears.\n\n' +
        'Each test shows its method badge, name, **📊 N rows** count, and a **weight** input. ' +
        'Weights control distribution during random execution: weight 0 skips the test entirely, ' +
        'higher values increase its share.',
      highlight: pr(HAR.WEIGHTS_LEGEND),

      preAction: async (ctx) => {
        ctx.navigateToTab('param-runner');
        await ctx.delay(200);
        await ensureTh6FgExists(ctx);
        await selectFirstScenarioInRunner(ctx, PR);
      },

      action: async (ctx) => {
        await selectFirstScenarioInRunner(ctx, PR);
        await ctx.delay(500);

        const legend = document.querySelector<HTMLElement>(pr(HAR.WEIGHTS_LEGEND));
        if (legend) {
          const arrow = legend.querySelector<HTMLElement>('.collapse-arrow');
          if (arrow && !arrow.classList.contains('expanded')) {
            legend.click();
            await ctx.delay(500);
          }
          await spotlight(legend, 1200, ctx);
        }

        const weightRow = document.querySelector<HTMLElement>(pr(HAR.WEIGHT_ROW));
        if (weightRow) await spotlight(weightRow, 1500, ctx);
      },

      verify: pr(HAR.WEIGHTS_LEGEND),
    },

    // ── Step 3: Execution Plan ───────────────────────────────────
    {
      id: 'th6-exec-plan',
      title: 'Execution Plan (Rows × Iterations)',
      description:
        'The **Execution Plan** shows exactly what will happen before you commit to running.\n\n' +
        'For parameterized tests, it shows a **per-test breakdown**: `iterations × rows = requests`. ' +
        'Each enabled data row becomes a real HTTP request with substituted values.\n\n' +
        'With 2 iterations and 5 rows, one test generates **10 requests** total.',
      highlight: pr(HAR.EXEC_PLAN),

      preAction: async (ctx) => {
        ctx.navigateToTab('param-runner');
        await ctx.delay(200);
        await ensureTh6FgExists(ctx);
        await selectFirstScenarioInRunner(ctx, PR);
      },

      action: async (ctx) => {
        await setIterationsValue(ctx, 2, PR);
        await ctx.delay(600);

        const plan = document.querySelector<HTMLElement>(pr(HAR.EXEC_PLAN));
        if (plan) await spotlight(plan, 2000, ctx);
      },

      verify: pr(HAR.EXEC_PLAN),
    },

    // ── Step 4: Tag Filter ───────────────────────────────────────
    {
      id: 'th6-tag-filter',
      title: 'Tag Filter',
      description:
        'The **Tag Filter** appears when your data rows have tags. It lets you run a **subset** ' +
        'of rows without editing the data source.\n\n' +
        'Type a tag name (e.g., `smoke`) and only matching rows will execute at run time. ' +
        'This is invaluable for large data sets — run a quick `smoke` check with 10 rows ' +
        'instead of the full 500-row regression suite.',
      highlight: pr(HAR.TAG_FILTER_INPUT),

      preAction: async (ctx) => {
        ctx.navigateToTab('param-runner');
        await ctx.delay(200);
        await ensureTh6FgExists(ctx);
        await selectFirstScenarioInRunner(ctx, PR);
      },

      action: async (ctx) => {
        const filterInput = document.querySelector<HTMLElement>(pr(HAR.TAG_FILTER_INPUT));
        if (filterInput) {
          await spotlight(filterInput, 1200, ctx);

          fillNativeInput(pr(HAR.TAG_FILTER_INPUT), 'smoke');
          await ctx.delay(800);

          const hint = document.querySelector<HTMLElement>(pr(HAR.TAG_FILTER_HINT));
          if (hint) await spotlight(hint, 1500, ctx);

          await ctx.delay(800);
          fillNativeInput(pr(HAR.TAG_FILTER_INPUT), '');
          await ctx.delay(400);
        }
      },

      verify: pr(HAR.TAG_FILTER_INPUT),
    },

    // ── Step 5: Run & Monitor Progress ───────────────────────────
    {
      id: 'th6-run',
      title: 'Run & Monitor Progress',
      description:
        'Click **▶ Run Parameterized Test** to start. Watch the live progress:\n\n' +
        '- **Progress bar** — fills as requests complete\n' +
        '- **Per-test row progress** — unique to the parameterized runner, shows completion ' +
        'counts per test (e.g., `5/5 ✓3`)\n' +
        '- **Live metrics** — TPS, Avg Response, Error Rate, Validation Failures',
      highlight: pr(HAR.RUN_BTN),

      preAction: async (ctx) => {
        ctx.navigateToTab('param-runner');
        await ctx.delay(200);
        await ensureTh6FgExists(ctx);
        await selectFirstScenarioInRunner(ctx, PR);
        await setIterationsValue(ctx, 2, PR);
      },

      action: async (ctx) => {
        await setIterationsValue(ctx, 2, PR);
        await ctx.delay(300);

        await ctx.click(pr(HAR.RUN_BTN));

        // Wait for Live Progress to mount, then scroll it into view immediately
        // so the viewer sees bar + per-test rows + metrics without manual scroll.
        const start = Date.now();
        while (Date.now() - start < 3000) {
          if (document.querySelector(pr(HAR.LIVE_PROGRESS))) break;
          await ctx.delay(100);
        }

        const progress = document.querySelector<HTMLElement>(pr(HAR.LIVE_PROGRESS));
        if (progress) {
          progress.scrollIntoView({ behavior: 'smooth', block: 'start' });
          await ctx.delay(800);
          await spotlight(progress, 1200, ctx);
        }

        const perTest = document.querySelector<HTMLElement>(pr(HAR.PER_TEST_PROGRESS));
        if (perTest) {
          perTest.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          await spotlight(perTest, 1200, ctx);
        }

        const metrics = document.querySelector<HTMLElement>(pr(HAR.LIVE_METRICS));
        if (metrics) {
          metrics.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          await spotlight(metrics, 1200, ctx);
        }

        try {
          await ctx.waitFor(pr(HAR.COMPLETION), 30000);
        } catch {
          await ctx.delay(8000);
        }

        const completion = document.querySelector<HTMLElement>(pr(HAR.COMPLETION));
        if (completion) {
          completion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          await ctx.delay(400);
          await spotlight(completion, 1500, ctx);
        }
      },

      verify: pr(HAR.LIVE_PROGRESS),
    },

    // ── Step 6: Completion & Results ─────────────────────────────
    {
      id: 'th6-results',
      title: 'Completion & Results',
      description:
        'The run completes with a summary showing total requests and elapsed time.\n\n' +
        'Click **View Full Results →** to see every request outcome in the Results tab. ' +
        'Every parameterized run is saved for comparison, **re-run of failed rows**, and ' +
        'baseline analysis — covered in the **Results & Analysis** lesson.',
      highlight: pr(HAR.COMPLETION),

      preAction: async (ctx) => {
        ctx.navigateToTab('param-runner');
        await ctx.delay(200);
      },

      action: async (ctx) => {
        const completion = document.querySelector<HTMLElement>(pr(HAR.COMPLETION));
        if (completion) {
          await spotlight(completion, 1500, ctx);

          const viewBtn = document.querySelector<HTMLElement>(pr(HAR.VIEW_RESULTS_BTN));
          if (viewBtn) {
            viewBtn.click();
            await ctx.delay(1000);
          }
        } else {
          ctx.navigateToTab('results');
          await ctx.delay(800);
        }
      },

      verify: HAR.NAV_RESULTS,
    },
  ],
};
