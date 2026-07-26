/**
 * TH-7 — Results & Analysis
 *
 * 6 steps: navigate to the Results Dashboard → read metrics and
 * response time distribution → drill into Request Details with
 * grouping/filters → mark a baseline → check SLA tab → export.
 */
import type { DemoLesson } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  seedTh7TestRun,
  deleteTh7TestRuns,
  ensureResultsRunSelected,
} from './th-demo-helpers';

// ─── Lesson ──────────────────────────────────────────────────────

export const thResultsAnalysisLesson: DemoLesson = {
  id: 'th-results-analysis',
  domainId: 'harness',
  category: 'analysis',
  name: 'Results & Analysis',
  description:
    'Explore the Results Dashboard — read metrics, response time distribution, ' +
    'drill into request details, mark baselines, and export reports.',
  estimatedMinutes: 6,
  initialTab: 'results',
  allowedTabs: ['scenarios', 'runner', 'param-runner', 'results'],

  concept: {
    title: 'Results Dashboard',
    body:
      'Every test run is saved to the **Results Dashboard** for analysis.\n\n' +
      '- **Overview** — throughput, latency percentiles, error rate, response time histogram\n' +
      '- **Request Details** — per-request table with grouping (Feature/Scenario/Test) and status filter\n' +
      '- **SLA** — evaluates performance targets defined on Feature Groups or Scenarios\n' +
      '- **Comparison & Trends** — compare runs against baselines, detect regressions\n\n' +
      'Runs can be exported as JSON, CSV, or formatted reports (HTML/Markdown).',
    keyTerms: [
      { term: 'Test Run', definition: 'A saved execution with config, results, and computed summary metrics.' },
      { term: 'Baseline', definition: 'A pinned run used as the reference for regression detection.' },
      { term: 'Percentile (P95/P99)', definition: '95th/99th percentile response time — outlier sensitivity.' },
      { term: 'SLA Target', definition: 'An acceptance criterion (e.g., P95 < 500ms) evaluated after each run.' },
    ],
    diagram: `<svg viewBox="0 0 360 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="80" height="60" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="45" y="30" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Test Run</text>
      <text x="45" y="44" text-anchor="middle" fill="#94a3b8" font-size="5.5">5 requests</text>
      <text x="45" y="56" text-anchor="middle" fill="#94a3b8" font-size="5.5">4✓ 1✗</text>
      <path d="M90 40 L120 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th7arr)"/>
      <rect x="125" y="5" width="110" height="70" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="180" y="20" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Dashboard</text>
      <text x="180" y="34" text-anchor="middle" fill="#94a3b8" font-size="5">Overview · Request Details</text>
      <text x="180" y="46" text-anchor="middle" fill="#94a3b8" font-size="5">SLA · Comparison</text>
      <text x="180" y="60" text-anchor="middle" fill="#94a3b8" font-size="5">Metrics · Histogram</text>
      <path d="M240 40 L270 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th7arr)"/>
      <rect x="275" y="10" width="80" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="315" y="30" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Export</text>
      <text x="315" y="44" text-anchor="middle" fill="#94a3b8" font-size="5.5">JSON · CSV</text>
      <text x="315" y="56" text-anchor="middle" fill="#94a3b8" font-size="5.5">HTML · Markdown</text>
      <defs><marker id="th7arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    await deleteTh7TestRuns();
    await seedTh7TestRun();
    await ctx.delay(300);
    ctx.navigateToTab('results');
    await ctx.delay(500);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    await deleteTh7TestRuns();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: The Results Dashboard ────────────────────────────
    {
      id: 'th7-dashboard',
      title: 'The Results Dashboard',
      description:
        'The **Results** tab shows every saved test run.\n\n' +
        'At the top, **run type filters** let you show All Runs, Test Runs only, or ' +
        'Workflow Runs only. Below that, a **dropdown** lets you select a specific run — ' +
        'each entry shows the timestamp, request count, and TPS.',
      highlight: HAR.RESULTS_TOP,

      preAction: async (ctx) => {
        ctx.navigateToTab('results');
        await ctx.delay(400);
      },

      action: async (ctx) => {
        const filterTabs = document.querySelector<HTMLElement>(HAR.RUN_TYPE_TABS);
        if (filterTabs) await spotlight(filterTabs, 1200, ctx);

        const trigger = document.querySelector<HTMLElement>(HAR.RUN_SELECT_TRIGGER);
        if (trigger) {
          await spotlight(trigger, 1200, ctx);
          trigger.click();
          await ctx.delay(600);

          const menu = document.querySelector<HTMLElement>(HAR.RUN_SELECT_MENU);
          if (menu) {
            await spotlight(menu, 1200, ctx);
            const firstOption = menu.querySelector<HTMLElement>(HAR.RUN_SELECT_OPTION);
            if (firstOption) {
              firstOption.click();
              await ctx.delay(600);
            }
          }
        }
      },

      verify: HAR.RESULTS_TOP,
    },

    // ── Step 2: Metrics & Distribution ───────────────────────────
    {
      id: 'th7-metrics',
      title: 'Metrics & Distribution',
      description:
        'The **Overview** tab shows key performance metrics in two rows:\n\n' +
        '- **Row 1**: TPS (throughput), Avg Response, Min, Max\n' +
        '- **Row 2**: P50, P95, P99, Error Rate, Total Duration, Total Requests, ' +
        'Validation Failures\n\n' +
        'Below, the **Response Time Distribution** histogram shows how response times ' +
        'are spread — with P95/P99 reference lines to identify outliers.',
      highlight: HAR.METRICS_CARDS,

      preAction: async (ctx) => {
        ctx.navigateToTab('results');
        await ctx.delay(400);
        await ensureResultsRunSelected(ctx);
      },

      action: async (ctx) => {
        const cards = document.querySelector<HTMLElement>(HAR.METRICS_CARDS);
        if (cards) await spotlight(cards, 1500, ctx);

        const latencyRow = document.querySelector<HTMLElement>(HAR.METRICS_LATENCY);
        if (latencyRow) await spotlight(latencyRow, 1500, ctx);

        const histogram = document.querySelector<HTMLElement>(HAR.HISTOGRAM);
        if (histogram) await spotlight(histogram, 1500, ctx);
      },

      verify: HAR.METRICS_CARDS,
    },

    // ── Step 3: Request Details & Grouping ───────────────────────
    {
      id: 'th7-request-details',
      title: 'Request Details & Grouping',
      description:
        'The **Request Details** tab shows every individual request in the run.\n\n' +
        'Use the **Group By** selector to organize results by Feature, Scenario, or ' +
        'Test Name. The **status filter** lets you narrow to Passed, Failed, or Failed ' +
        'Data Rows only — helping you quickly find problems in large runs.',
      highlight: HAR.TAB_REQUESTS,

      preAction: async (ctx) => {
        ctx.navigateToTab('results');
        await ctx.delay(400);
        await ensureResultsRunSelected(ctx);
      },

      action: async (ctx) => {
        const reqTab = document.querySelector<HTMLElement>(HAR.TAB_REQUESTS);
        if (reqTab) {
          reqTab.click();
          await ctx.delay(800);
        }

        const groupBy = document.querySelector<HTMLElement>(HAR.GROUP_BY);
        if (groupBy) await spotlight(groupBy, 1500, ctx);

        await ctx.delay(800);
      },

      verify: HAR.TAB_REQUESTS,
    },

    // ── Step 4: Set a Baseline ───────────────────────────────────
    {
      id: 'th7-baseline',
      title: 'Set a Baseline',
      description:
        'Click **☆ Set Baseline** to pin this run as a performance reference.\n\n' +
        'Once set, the **Comparison & Trends** tab lets you compare future runs against ' +
        'the baseline — detecting regressions in P95, P99, error rate, and more. ' +
        'The baseline is marked with a ★ star in the run dropdown.',
      highlight: HAR.BASELINE_TOGGLE,

      preAction: async (ctx) => {
        ctx.navigateToTab('results');
        await ctx.delay(400);
        await ensureResultsRunSelected(ctx);
      },

      action: async (ctx) => {
        const baselineBtn = document.querySelector<HTMLElement>(HAR.BASELINE_TOGGLE);
        if (baselineBtn) {
          await spotlight(baselineBtn, 1200, ctx);

          if (!baselineBtn.classList.contains('baseline-active')) {
            baselineBtn.click();
            await ctx.delay(800);
          }

          const analysisTab = document.querySelector<HTMLElement>(HAR.TAB_ANALYSIS);
          if (analysisTab) await spotlight(analysisTab, 1000, ctx);
        }
      },

      verify: HAR.BASELINE_TOGGLE,
    },

    // ── Step 5: SLA Status ───────────────────────────────────────
    {
      id: 'th7-sla',
      title: 'SLA Status',
      description:
        'The **SLA** tab evaluates performance targets defined on your Feature Groups ' +
        'or Scenarios.\n\n' +
        'Targets like **P95 < 500ms** or **Error Rate < 1%** are checked automatically ' +
        'after each run. Pass/warn/fail indicators show at a glance whether your API ' +
        'meets its service level agreements. See the **SLA Targets & Acceptance Criteria** lesson for defining SLA targets.',
      highlight: HAR.TAB_SLA,

      preAction: async (ctx) => {
        ctx.navigateToTab('results');
        await ctx.delay(400);
        await ensureResultsRunSelected(ctx);
      },

      action: async (ctx) => {
        const slaTab = document.querySelector<HTMLElement>(HAR.TAB_SLA);
        if (slaTab) {
          slaTab.click();
          await ctx.delay(600);
        }

        const slaPanel = document.querySelector<HTMLElement>(HAR.SLA_PANEL);
        if (slaPanel) {
          await spotlight(slaPanel, 1500, ctx);
        } else {
          const emptyState = document.querySelector<HTMLElement>('#results-panel-sla .empty-state');
          if (emptyState) await spotlight(emptyState, 1500, ctx);
        }
      },

      verify: HAR.TAB_SLA,
    },

    // ── Step 6: Export Reports ───────────────────────────────────
    {
      id: 'th7-export',
      title: 'Export Reports',
      description:
        'Export your results in multiple formats:\n\n' +
        '- **Export JSON** — full run data for programmatic analysis\n' +
        '- **Export CSV** — per-request spreadsheet\n' +
        '- **Generate Report** — HTML (standalone charts), JSON, or Markdown\n\n' +
        'HTML reports are shareable standalone files — great for CI artifacts or team sharing.',
      highlight: HAR.EXPORT_JSON,

      preAction: async (ctx) => {
        ctx.navigateToTab('results');
        await ctx.delay(400);
        await ensureResultsRunSelected(ctx);
        const overviewTab = document.querySelector<HTMLElement>(HAR.TAB_OVERVIEW);
        if (overviewTab) {
          overviewTab.click();
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        const exportBtn = document.querySelector<HTMLElement>(HAR.EXPORT_JSON);
        if (exportBtn) await spotlight(exportBtn, 1200, ctx);

        const reportMenu = document.querySelector<HTMLElement>(HAR.REPORT_MENU);
        if (reportMenu) await spotlight(reportMenu, 1500, ctx);
      },

      verify: HAR.EXPORT_JSON,
    },
  ],
};
