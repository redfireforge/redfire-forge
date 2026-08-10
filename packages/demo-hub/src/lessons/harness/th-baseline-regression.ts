/**
 * TH-20 — Baseline & Regression Analysis
 *
 * 5 steps: explore the Comparison & Trends tab — baseline list management,
 * regression thresholds, side-by-side comparison, trend charts, and
 * comparison report export.
 */
import type { DemoLesson } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  spotlightSel,
  seedTh20TestRuns,
  deleteTh20TestRuns,
  ensureTh20RunsExist,
  ensureResultsRunSelected,
  switchToAnalysisTab,
  closeExportMenu,
} from './th-demo-helpers';

// ─── Local helpers ─────────────────────────────────────────────────

async function ensureTh20Ready(ctx: import('../../types').DemoActionContext): Promise<void> {
  ctx.navigateToTab('results');
  await ctx.delay(400);

  // Always require the full dataset (2 runs + 2 live baselines). If the user
  // deleted a run or unmarked baselines, rebuild so Comparison & Trends has
  // something to show (side-by-side panel / trend chart).
  const repaired = await ensureTh20RunsExist();
  await ctx.delay(repaired ? 900 : 300);

  await ensureTh20RunSelected(ctx);
}

async function ensureTh20RunSelected(ctx: import('../../types').DemoActionContext): Promise<void> {
  const trigger = document.querySelector<HTMLElement>(HAR.RUN_SELECT_TRIGGER);
  if (!trigger) return;

  if (trigger.textContent?.includes('TH-20 Baseline Demo')) return;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    trigger.click();
    await ctx.delay(250);

    for (let probe = 0; probe < 5; probe += 1) {
      const options = Array.from(document.querySelectorAll<HTMLElement>(HAR.RUN_SELECT_OPTION));
      const th20Option = options.find((opt) => opt.textContent?.includes('TH-20 Baseline Demo'));
      if (th20Option) {
        th20Option.click();
        await ctx.delay(450);
        return;
      }
      await ctx.delay(120);
    }

    document.body.click();
    await ctx.delay(120);
    if (trigger.textContent?.includes('TH-20 Baseline Demo')) return;
  }

  document.body.click();
  await ctx.delay(150);
  await ensureResultsRunSelected(ctx);
}

function ensureOnAnalysisTab(): void {
  const active = document.querySelector<HTMLElement>(`${HAR.TAB_ANALYSIS}.active`);
  if (!active) switchToAnalysisTab();
}

// ─── Lesson ────────────────────────────────────────────────────────

export const thBaselineRegressionLesson: DemoLesson = {
  id: 'th-baseline-regression',
  domainId: 'harness',
  category: 'analysis',
  name: 'Baseline & Regression Analysis',
  description:
    'Explore the Comparison & Trends tab — manage baselines, configure ' +
    'regression thresholds, compare runs side-by-side, view trends, ' +
    'and export comparison reports.',
  estimatedMinutes: 5,
  initialTab: 'results',
  allowedTabs: ['results'],

  concept: {
    title: 'Baseline & Regression Analysis',
    body:
      'The **Comparison & Trends** tab is your regression detection center.\n\n' +
      '- **Baselines** — pin runs as named performance reference points\n' +
      '- **Regression Thresholds** — set warning limits per metric (critical = 2× warning)\n' +
      '- **Run Comparison** — side-by-side deltas with color-coded threshold indicators\n' +
      '- **Trend Charts** — multi-run performance trends with baseline markers\n' +
      '- **Export** — JSON or Markdown comparison reports for CI/PR review\n\n' +
      'Baselines are evaluated automatically — every run in the selector shows its ' +
      'regression status at a glance (`R:🟢 Pass`, `R:🟡 Warn`, `R:🔴 Critical`).',
    keyTerms: [
      { term: 'Baseline', definition: 'A pinned run used as the reference for regression detection.' },
      { term: 'Regression Threshold', definition: 'A percentage (or absolute pp for Error Rate) that triggers warnings.' },
      { term: 'Critical = 2× Warning', definition: 'Critical severity fires at double the configured warning threshold.' },
      { term: 'Trend Scope', definition: 'Filter trend runs by service, environment, or workflow context.' },
    ],
    diagram: `<svg viewBox="0 0 380 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="70" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="40" y="28" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">★ Baseline</text>
      <text x="40" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Run 1 (fast)</text>
      <text x="40" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">P95: 120ms</text>
      <path d="M80 40 L110 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th20arr)"/>
      <rect x="115" y="5" width="110" height="70" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="170" y="20" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Comparison</text>
      <text x="170" y="34" text-anchor="middle" fill="#94a3b8" font-size="5">Deltas · Thresholds</text>
      <text x="170" y="46" text-anchor="middle" fill="#94a3b8" font-size="5">Per-Scenario · Trends</text>
      <text x="170" y="58" text-anchor="middle" fill="#94a3b8" font-size="5">🟢 OK · 🟡 Warn · 🔴 Critical</text>
      <path d="M230 40 L260 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th20arr)"/>
      <rect x="265" y="10" width="70" height="60" rx="5" fill="#1e293b" stroke="#ef4444" stroke-width="1.5"/>
      <text x="300" y="28" text-anchor="middle" fill="#ef4444" font-size="7" font-weight="700">Run 2</text>
      <text x="300" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">P95: +45%</text>
      <text x="300" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">🟡 Warn</text>
      <defs><marker id="th20arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ──────────────────────────────────────────────────────
  setup: async (ctx) => {
    await deleteTh20TestRuns();
    await seedTh20TestRuns();
    await ctx.delay(300);
    ctx.navigateToTab('results');
    await ctx.delay(500);
  },

  // ── Cleanup ────────────────────────────────────────────────────
  cleanup: async () => {
    await deleteTh20TestRuns();
  },

  steps: [
    // ── Step 1: Baseline List & Management ────────────────────────
    {
      id: 'th20-baseline-list',
      title: 'Baseline List & Management',
      description:
        'The **Comparison & Trends** tab contains a sidebar with the **Baseline List**.\n\n' +
        'Each baseline shows a ★ star, its label, and timestamp. You can **rename** a baseline ' +
        '(click the label for inline editing), **set it as the compare target** for side-by-side ' +
        'analysis, or **unmark** it when no longer needed.',
      highlight: HAR.TAB_ANALYSIS,

      preAction: async (ctx) => {
        await ensureTh20Ready(ctx);
      },

      action: async (ctx) => {
        const analysisTab = document.querySelector<HTMLElement>(HAR.TAB_ANALYSIS);
        if (analysisTab) {
          analysisTab.click();
          await ctx.delay(800);
        }

        const listPanel = document.querySelector<HTMLElement>(HAR.BASELINE_LIST);
        if (listPanel) {
          await spotlight(listPanel, 1500, ctx);

          const firstItem = document.querySelector<HTMLElement>(HAR.BASELINE_LIST_ITEM);
          if (firstItem) {
            await spotlight(firstItem, 1200, ctx);

            const actions = firstItem.querySelector<HTMLElement>(HAR.BASELINE_LIST_ACTIONS);
            if (actions) await spotlight(actions, 1000, ctx);
          }
        }
      },

      verify: HAR.BASELINE_LIST,
    },

    // ── Step 2: Regression Thresholds ─────────────────────────────
    {
      id: 'th20-thresholds',
      title: 'Regression Thresholds',
      description:
        'The **Regression Thresholds** panel configures warning limits for 7 metrics: ' +
        'Avg, P50, P95, P99, P99.9 (% change), TPS drop (%), and Error Rate (absolute pp).\n\n' +
        '**Critical fires at 2× the warning value** — e.g., P95 warn at 10% means critical ' +
        'at 20%. Tailor these to your API\'s performance tolerance.',
      highlight: HAR.THRESHOLDS_PANEL,

      preAction: async (ctx) => {
        await ensureTh20Ready(ctx);
        ensureOnAnalysisTab();
        await ctx.delay(300);
      },

      action: async (ctx) => {
        const panel = document.querySelector<HTMLElement>(HAR.THRESHOLDS_PANEL);
        if (panel) {
          await spotlight(panel, 1500, ctx);

          const grid = panel.querySelector<HTMLElement>('.thresholds-grid');
          if (grid) {
            await spotlight(grid, 1200, ctx);
          }

          const actions = panel.querySelector<HTMLElement>('.thresholds-actions');
          if (actions) await spotlight(actions, 800, ctx);
        }
      },

      verify: HAR.THRESHOLDS_PANEL,
    },

    // ── Step 3: Run Comparison Panel ──────────────────────────────
    {
      id: 'th20-comparison',
      title: 'Run Comparison Panel',
      description:
        'The **Comparison toolbar** shows the current mode (Baseline or Ad-hoc) and a ' +
        'dropdown to select the comparison target.\n\n' +
        'When a baseline is set, the **Run Comparison Panel** appears with a side-by-side ' +
        'metrics table — each delta is color-coded: **green** (OK), **amber** (warn), ' +
        '**red** (critical). Sub-tabs break down: Overview, Per-Scenario, Regressions, ' +
        'and Distribution.',
      highlight: HAR.COMPARISON_PANEL,

      preAction: async (ctx) => {
        await ensureTh20Ready(ctx);
        ensureOnAnalysisTab();
        await ctx.delay(300);
        closeExportMenu();
      },

      action: async (ctx) => {
        const toolbar = document.querySelector<HTMLElement>(HAR.COMPARISON_TOOLBAR);
        if (toolbar) {
          const badge = toolbar.querySelector<HTMLElement>(HAR.COMPARISON_MODE_BADGE);
          if (badge) await spotlight(badge, 1000, ctx);

          const select = toolbar.querySelector<HTMLElement>(HAR.COMPARE_SELECT);
          if (select) await spotlight(select, 800, ctx);
        }

        const panel = document.querySelector<HTMLElement>(HAR.COMPARISON_PANEL);
        if (panel) {
          await spotlight(panel, 1500, ctx);

          const tabs = panel.querySelector<HTMLElement>('.run-comparison-tabs');
          if (tabs) await spotlight(tabs, 1000, ctx);
        }
      },

      verify: HAR.COMPARISON_TOOLBAR,
    },

    // ── Step 4: Trend Chart ───────────────────────────────────────
    {
      id: 'th20-trends',
      title: 'Trend Chart',
      description:
        'Click **Show Trend** to reveal a multi-run **trend chart** — X-axis is runs ' +
        'over time, Y-axis is the selected metric.\n\n' +
        'Baseline runs appear as larger orange dots. Switch between **Overall** and ' +
        '**Per-Scenario** tabs, and use the **scope filter** (All runs / By service / ' +
        'By service+env) to narrow the trend context.',
      highlight: HAR.TREND_CONTAINER,

      preAction: async (ctx) => {
        await ensureTh20Ready(ctx);
        ensureOnAnalysisTab();
        await ctx.delay(300);
      },

      action: async (ctx) => {
        const toolbar = document.querySelector<HTMLElement>(HAR.COMPARISON_TOOLBAR);
        if (toolbar) {
          const trendBtn = Array.from(toolbar.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('Trend'));
          if (trendBtn) {
            await spotlight(trendBtn, 800, ctx);
            if (trendBtn.textContent?.includes('Show')) {
              trendBtn.click();
              await ctx.delay(800);
            }
          }
        }

        // The trend toolbar sits above the chart and can pull the viewport up.
        // Re-anchor the viewport to the actual chart before spotlighting details.
        let chart: HTMLElement | null = null;
        for (let i = 0; i < 8; i += 1) {
          chart = document.querySelector<HTMLElement>(HAR.TREND_CONTAINER);
          if (chart) break;
          await ctx.delay(120);
        }

        if (chart) {
          chart.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await ctx.delay(350);
          await spotlight(chart, 1500, ctx);

          const trendTabs = chart.querySelector<HTMLElement>(HAR.TREND_TABS);
          if (trendTabs) await spotlight(trendTabs, 1000, ctx);

          const scopeSelect = chart.querySelector<HTMLElement>(HAR.TREND_SCOPE_SELECT);
          if (scopeSelect) await spotlight(scopeSelect, 800, ctx);
        } else {
          await spotlightSel(ctx, HAR.COMPARISON_PANEL, 1000);
        }
      },

      verify: HAR.TREND_CONTAINER,
    },

    // ── Step 5: Export Comparison Report ───────────────────────────
    {
      id: 'th20-export',
      title: 'Export Comparison Report',
      description:
        'The **Export** button in the comparison panel offers two formats:\n\n' +
        '- **JSON** — machine-readable for CI pipelines\n' +
        '- **Markdown** — human-readable for PR reviews\n\n' +
        'Reports include the summary table, per-scenario deltas, regression flags, ' +
        'and threshold violations — attach to pull requests to document performance impact.',
      highlight: HAR.COMPARISON_EXPORT_BTN,

      preAction: async (ctx) => {
        await ensureTh20Ready(ctx);
        ensureOnAnalysisTab();
        await ctx.delay(300);
        closeExportMenu();
      },

      action: async (ctx) => {
        const exportBtn = document.querySelector<HTMLElement>(HAR.COMPARISON_EXPORT_BTN);
        if (exportBtn) {
          await spotlight(exportBtn, 1000, ctx);
          exportBtn.click();
          await ctx.delay(600);

          const menu = document.querySelector<HTMLElement>(HAR.COMPARISON_EXPORT_MENU);
          if (menu) {
            await spotlight(menu, 1200, ctx);
            await ctx.delay(800);
            document.body.click();
            await ctx.delay(400);
          }
        } else {
          await spotlightSel(ctx, HAR.COMPARISON_PANEL, 1200);
        }
      },

      verify: HAR.COMPARISON_TOOLBAR,
    },
  ],
};
