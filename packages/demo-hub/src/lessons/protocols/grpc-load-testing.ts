/**
 * Lesson GRPC-12: Load Testing: Concurrent Calls & Metrics
 *
 * Teaches learners to configure and run a concurrent load test, read p50/p95/p99
 * latency percentiles and throughput (RPS), explore the results visualizations,
 * run a second test to see the run-to-run compare, save a reusable load profile,
 * and extend the test to a server-streaming method with a per-stream message cap.
 *
 *   grpc12-intro        — Navigate to Advanced sub-nav; tour the 5 panel tabs
 *   grpc12-panel-tour   — Load Testing panel: all config fields (including new rate + template)
 *   grpc12-configure    — Set Concurrency=5, Total=50, highlight Request Rate field
 *   grpc12-start        — Click Start; live progress bar and counters
 *   grpc12-results      — Run strip + metrics + status breakdown + histogram + throughput timeline
 *   grpc12-export       — Copy & Download JSON/CSV; run history selector
 *   grpc12-compare      — Run a second test; tour the run-to-run compare section
 *   grpc12-profile      — Save "Echo Baseline"; load it back from the dropdown
 *   grpc12-streaming    — Switch to ServerStream; Max messages/stream; run
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
  ensureStreamingMethodSelectedQuiet,
  fillServerStreamRequestQuiet,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import {
  listGrpcLoadTestProfiles,
  deleteGrpcLoadTestProfile,
} from '@grpc/data/grpcLoadTestProfileRepository';
import type { DemoActionContext } from '../../types';

// ---------------------------------------------------------------------------
// Roster entry
// ---------------------------------------------------------------------------

const GRPC12_ROSTER = getGrpcLessonRosterEntry('grpc-load-testing')!;

// ---------------------------------------------------------------------------
// Demo constants
// ---------------------------------------------------------------------------

const LOAD_TEST_BODY_MESSAGE = 'load-test-run';
const LOAD_TEST_PROFILE_NAME = 'Echo Baseline';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to Advanced sub-nav and select the Load testing tab.
 * Quiet — no ripples; used in preAction guards.
 */
async function navigateToLoadTestPanelQuiet(ctx: DemoActionContext): Promise<void> {
  // Ensure we're on the gRPC Studio page first.
  const advBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (!advBtn) {
    await navigateToGrpcStudio(ctx);
    await ctx.delay(400);
  }

  // Click Advanced sub-nav if not already selected.
  const advEl = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (advEl && advEl.getAttribute('aria-selected') !== 'true') {
    advEl.click();
    await ctx.delay(500);
  }

  // Click the Load testing tab within the Advanced nav.
  const loadTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('load_test'));
  if (loadTab && loadTab.getAttribute('aria-selected') !== 'true') {
    loadTab.click();
    await ctx.delay(400);
  }
}

/**
 * Wait for the load test to complete (results panel visible, no running state).
 * Polls for up to `timeoutMs`.
 */
async function waitForLoadTestComplete(ctx: DemoActionContext, timeoutMs = 20_000): Promise<void> {
  const maxIter = Math.ceil(timeoutMs / 300);
  for (let i = 0; i < maxIter; i++) {
    await ctx.delay(300);
    const startBtn = document.querySelector<HTMLButtonElement>(GRPC.LOAD_TEST_START);
    const resultsPanel = document.querySelector(GRPC.LOAD_TEST_RESULTS);
    const stopBtn = document.querySelector(GRPC.LOAD_TEST_STOP);
    if (startBtn && !stopBtn && resultsPanel) return;
  }
}

/**
 * Silently run the load test with Echo and wait for completion.
 * Used as a preAction guard for steps that require finished results.
 */
async function ensureLoadTestResultsQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToLoadTestPanelQuiet(ctx);

  // If results are already showing, nothing to do.
  if (
    document.querySelector(GRPC.LOAD_TEST_RESULTS) &&
    !document.querySelector(GRPC.LOAD_TEST_STOP)
  ) {
    return;
  }

  // Dismiss any stale running state first.
  if (document.querySelector(GRPC.LOAD_TEST_STOP)) {
    // Already running — wait for it to finish.
    await waitForLoadTestComplete(ctx, 25_000);
    return;
  }

  // Start the test.
  const startBtn = document.querySelector<HTMLButtonElement>(GRPC.LOAD_TEST_START);
  if (startBtn && !startBtn.disabled) {
    startBtn.click();
    await waitForLoadTestComplete(ctx, 25_000);
  }
}

/**
 * Fill a number input via React-compatible native value setter.
 * The standard `ctx.fill()` dispatches a keyboard simulation; this targets
 * the controlled `value` directly for numeric inputs.
 */
function setNumberInputValue(selector: string, value: number): void {
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeInputValueSetter?.call(el, String(value));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------------------------------------------------------------------------
// Lesson steps
// ---------------------------------------------------------------------------

type DemoStep = GrpcDemoLesson['steps'][number];

const steps: DemoStep[] = [
  // =========================================================================
  // Step 1 — Navigate to Advanced; tour panel tabs
  // =========================================================================
  {
    id: 'grpc12-intro',
    title: 'Intro: Advanced Panel',
    pauseAfter: true,
    description:
      'gRPC Studio has an **Advanced** panel that unlocks power-user features. Click the ' +
      '**Advanced** tab in the sub-navigation to reveal five sections:\n\n' +
      '- **Load testing** — concurrent RPC benchmarks with p50/p95/p99 metrics\n' +
      '- **Mock server** — rule-based in-process gRPC mock\n' +
      '- **Schema diff** — compare live reflection vs a saved baseline\n' +
      '- **RPC statistics** — per-method call counts and error rates\n' +
      '- **Native Diagnostics** — desktop-only gRPC connection diagnostics\n\n' +
      'This lesson focuses on **Load testing**.',
    highlight: GRPC.SUB_NAV_ADVANCED,
    preAction: async (ctx) => {
      await grpcFirstCallSetup(ctx);
      await ensureGrpcReflected(ctx);
      await ensureEchoMessageFilled(ctx, LOAD_TEST_BODY_MESSAGE);
      await clearGrpcSchemaDriftQuiet(ctx);
      await closeGrpcSettingsDrawerQuiet(ctx);
    },
    action: async (ctx) => {
      // Show the Studio sub-nav so the viewer sees current context.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_STUDIO, 700);
      await ctx.delay(300);

      // Click the Advanced sub-nav tab.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_ADVANCED, 800);
      await ctx.click(GRPC.SUB_NAV_ADVANCED);
      await ctx.delay(700);

      try {
        await ctx.waitFor(GRPC.ADVANCED_SHELL, 5_000);
      } catch {
        // Shell renders fast — continue.
      }
      await ctx.delay(300);

      // Tour the Advanced nav tabs so the viewer reads each name.
      await spotlightAndPause(ctx, GRPC.ADVANCED_NAV, 800);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('load_test'), 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('mock_server'), 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('schema_diff'), 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('rpc_stats'), 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('native_diagnostics'), 700);

      // Land on Load testing.
      await ctx.click(GRPC.ADVANCED_TAB('load_test'));
      await ctx.delay(500);
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PANEL, 900);
    },
    verify: GRPC.LOAD_TEST_PANEL,
  },

  // =========================================================================
  // Step 2 — Load Testing panel full field tour
  // =========================================================================
  {
    id: 'grpc12-panel-tour',
    title: 'Load Testing Panel Tour',
    pauseAfter: true,
    description:
      'The **Load Testing** panel header shows the **active Studio tab** and the **RPC method** ' +
      'bound to this run — right now it is the Echo unary method. At the top, **Method under test** lets you ' +
      'override the active tab method for load testing only. Six numeric fields are arranged in a compact row:\n\n' +
      '- **Concurrency** — parallel in-flight gRPC calls\n' +
      '- **Total requests** — stop after this many completed calls\n' +
      '- **Duration (s)** — optional wall-clock cap in seconds\n' +
      '- **Ramp-up (s)** — gradually reach full concurrency over this many seconds\n' +
      '- **Request rate (RPS)** — cap throughput; `0` means unlimited\n' +
      '- **Warm-up calls** — excluded from metrics to let the server JIT warm up\n\n' +
      '**Request body template** (below the row) is a JSON template for unary calls; supports ' +
      '`{{runId}}` interpolation so each iteration sends a unique payload.\n\n' +
      'At the bottom, the compact **Saved profiles** row lets you save and load named benchmark presets. ' +
      'Use the ▾ collapse chevron in each card header to hide a section and focus on what you need.',
    highlight: GRPC.LOAD_TEST_PANEL,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
    },
    action: async (ctx) => {
      // Panel header — active tab + RPC label.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_CALL_TYPE_BADGE, 900);

      // New: Method under test selector.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_METHOD_SELECT, 1_000);
      await ctx.delay(200);

      // Config fields one by one.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 700);
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-total-calls"]', 700);
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-duration"]', 700);
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-ramp-up"]', 700);

      // New: Request Rate field — pause longer so viewer notices the new control.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_REQUEST_RATE, 1_000);
      await ctx.delay(200);

      // New: Request body template (only visible for unary methods).
      const templateEl = document.querySelector(GRPC.LOAD_TEST_REQUEST_TEMPLATE);
      if (templateEl) {
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_REQUEST_TEMPLATE, 1_000);
        await ctx.delay(200);
      }

      // Profiles card.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-profiles"]', 900);
    },
    verify: GRPC.LOAD_TEST_PANEL,
  },

  // =========================================================================
  // Step 3 — Configure: Concurrency=5, Total requests=50
  // =========================================================================
  {
    id: 'grpc12-configure',
    title: 'Configure the Load Run',
    pauseAfter: true,
    description:
      'Set **Concurrency = 5** (five parallel calls) and **Total requests = 50** ' +
      '(stop after 50 completed calls). With 50 calls the charts will have enough data points ' +
      'to show meaningful buckets in the latency histogram and bars in the throughput timeline.\n\n' +
      'Leave **Request rate** empty (unlimited) for now — the scheduler runs as fast as the ' +
      'server responds. Setting a rate like `10` would cap throughput to 10 RPS regardless of ' +
      'concurrency, useful for controlled soak tests.\n\n' +
      'The **Request body template** is left blank so the runner uses the body from the active ' +
      'Studio tab. You can fill it with `{"message":"hello {{runId}}"}` to vary the payload per call.',
    highlight: GRPC.LOAD_TEST_START,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
    },
    action: async (ctx) => {
      // Fill Concurrency.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 800);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 5);
      await ctx.delay(600);

      // Fill Total requests.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-total-calls"]', 800);
      setNumberInputValue('[data-testid="grpc-load-test-total-calls"]', 50);
      await ctx.delay(600);

      // Spotlight Request Rate — highlight that it is intentionally empty (unlimited).
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_REQUEST_RATE, 900);
      await ctx.delay(300);

      // Spotlight Start button — viewer is ready.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 1_000);
    },
    verify: GRPC.LOAD_TEST_START,
  },

  // =========================================================================
  // Step 4 — Start the test; watch live counters
  // =========================================================================
  {
    id: 'grpc12-start',
    title: 'Start — Live Progress',
    pauseAfter: true,
    description:
      'Click **Start load test**. While the test runs:\n\n' +
      '- A **progress bar** fills as calls complete (Completed / 50)\n' +
      '- **Completed / Succeeded / Failed** counters update in real time\n' +
      '- **Live KPI cards** show Throughput (RPS), Success %, p50 latency, and Error % as the run progresses\n' +
      '- **Status** shows "Running" — click **Stop** any time to abort early\n\n' +
      'With Concurrency 5 against a local server, all 50 calls typically finish in under a second. ' +
      'Watch the progress bar hit 100% then the full results panel slides in.',
    highlight: GRPC.LOAD_TEST_STATUS,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 5);
      setNumberInputValue('[data-testid="grpc-load-test-total-calls"]', 50);
    },
    action: async (ctx) => {
      // Spotlight then click Start.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 800);
      await ctx.click(GRPC.LOAD_TEST_START);
      await ctx.delay(300);

      // Spotlight the status indicator.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_STATUS, 700);

      // Show live counters if they appear before completion.
      try {
        await ctx.waitFor(GRPC.LOAD_TEST_LIVE_COMPLETED, 3_000);
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_LIVE_COMPLETED, 900);
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_LIVE_THROUGHPUT, 800);
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_LIVE_P50, 800);
      } catch {
        // Fast local server — test may complete before live counters render.
      }

      // Wait for results to appear.
      await waitForLoadTestComplete(ctx, 20_000);
      await ctx.delay(400);

      // Spotlight the results panel appearing.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_RESULTS, 1_000);
    },
    verify: GRPC.LOAD_TEST_RESULTS,
  },

  // =========================================================================
  // Step 5 — Full results panel: run strip + metrics + charts
  // =========================================================================
  {
    id: 'grpc12-results',
    title: 'Reading the Results',
    pauseAfter: true,
    description:
      'After the run the **Results** panel shows four sections:\n\n' +
      '**Run strip** — run ID, wall-clock duration, stop reason (Total Calls / Duration / Manual), ' +
      'and completion time. Use the run ID to correlate with server-side traces.\n\n' +
      '**Metrics grid** — Throughput (RPS), p50 latency (median), p95/p99 (tail latency), and ' +
      'Error rate. A high p99 relative to p50 is the signature of intermittent GC pauses or retries.\n\n' +
      '**Status breakdown** — bar chart of gRPC status codes; all-OK means a single `0` bar.\n\n' +
      '**Latency histogram** — 8-bucket distribution of call durations; useful for spotting bimodal ' +
      'distributions (fast path vs slow path).\n\n' +
      '**Throughput over time** — per-second bar chart of successful vs failed attempts; ' +
      'a ramp at the start reveals warm-up behavior.',
    highlight: GRPC.LOAD_TEST_RESULTS,
    preAction: async (ctx) => {
      await ensureLoadTestResultsQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight the run strip — run ID + timing context.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_RUN_STRIP, 1_000);
      await ctx.delay(300);

      // Spotlight the summary metrics grid.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 1_000);

      // Walk individual metric cards.
      const metricsGrid = document.querySelector(GRPC.LOAD_TEST_SUMMARY_METRICS);
      if (metricsGrid) {
        const metricEls = metricsGrid.querySelectorAll<HTMLElement>('.grpc-advanced-metric');
        if (metricEls[0]) await spotlightElementAndPause(ctx, metricEls[0], 900);  // Throughput
        await ctx.delay(200);
        if (metricEls[1]) await spotlightElementAndPause(ctx, metricEls[1], 800);  // p50
        await ctx.delay(200);
        if (metricEls[2]) await spotlightElementAndPause(ctx, metricEls[2], 900);  // p95/p99
        await ctx.delay(200);
        if (metricEls[3]) await spotlightElementAndPause(ctx, metricEls[3], 800);  // Error rate
      }

      // Percentile legend.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PERCENTILE_LEGEND, 800);
      await ctx.delay(300);

      // Status breakdown chart.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_STATUS_BREAKDOWN, 1_000);
      await ctx.delay(300);

      // Latency histogram.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_LATENCY_HISTOGRAM, 1_000);
      await ctx.delay(300);

      // Throughput over time.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_THROUGHPUT_TIMELINE, 1_000);
    },
    verify: GRPC.LOAD_TEST_SUMMARY_METRICS,
  },

  // =========================================================================
  // Step 6 — Export: Copy & Download, run history selector
  // =========================================================================
  {
    id: 'grpc12-export',
    title: 'Exporting Results',
    pauseAfter: true,
    description:
      'The Results card header has four export actions:\n\n' +
      '- **Copy JSON** — copies the full run summary to clipboard (includes `sourceMetadata`, ' +
      '`config`, and `metrics` with status distribution and latency percentiles)\n' +
      '- **Download JSON** — saves the same payload as a named `.json` file ' +
      '(`<runId>.json`) — useful for archiving benchmarks in CI\n' +
      '- **Copy CSV** — single spreadsheet row for pasting into Google Sheets / Excel\n' +
      '- **Download CSV** — saves as a `.csv` file for automation pipelines\n\n' +
      'The **run history selector** at the left of the header lets you switch between all runs ' +
      'recorded in this session — results are persisted across page reloads so you can ' +
      'compare morning vs afternoon benchmarks.',
    highlight: GRPC.LOAD_TEST_EXPORT_JSON,
    preAction: async (ctx) => {
      await ensureLoadTestResultsQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight the Results card header area.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_RESULTS, 800);
      await ctx.delay(300);

      // Run history selector.
      const historySelect = document.querySelector(GRPC.LOAD_TEST_RUN_HISTORY_SELECT);
      if (historySelect) {
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_RUN_HISTORY_SELECT, 900);
        await ctx.delay(300);
      }

      // Copy JSON.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_EXPORT_JSON, 900);
      await ctx.click(GRPC.LOAD_TEST_EXPORT_JSON);
      await ctx.delay(600);

      // Download JSON — spotlight but don't click (would trigger file download in demo).
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_DOWNLOAD_JSON, 900);
      await ctx.delay(400);

      // Copy CSV.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_EXPORT_CSV, 800);
      await ctx.delay(300);

      // Download CSV.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_DOWNLOAD_CSV, 800);
      await ctx.delay(400);

      // Return to metrics to reinforce context.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 700);
    },
    verify: GRPC.LOAD_TEST_EXPORT_JSON,
  },

  // =========================================================================
  // Step 7 — Run a second test; tour the run-to-run compare
  // =========================================================================
  {
    id: 'grpc12-compare',
    title: 'Run-to-Run Compare',
    pauseAfter: true,
    description:
      'Run a **second test** at higher concurrency (10) to produce a different result. ' +
      'Once two runs exist, the Results panel adds a **Run-to-run compare** section:\n\n' +
      '- **Baseline selector** — pick which previous run to compare against\n' +
      '- **Delta cards** — colour-coded Throughput Δ, p50 Δ, p95 Δ, Error rate Δ ' +
      '(green = improved, red = regressed)\n' +
      '- **Metric detail table** — side-by-side baseline / current / delta for every ' +
      'percentile, success rate, and attempt count\n' +
      '- **Status composition diff** — per-status-code count and percentage change\n\n' +
      'This is the same workflow engineers use to gate a deployment: run the baseline ' +
      'on the old version, deploy, run again, check the compare.',
    highlight: GRPC.LOAD_TEST_RUN_COMPARE,
    preAction: async (ctx) => {
      // Ensure at least one finished run exists before we run the second.
      await ensureLoadTestResultsQuiet(ctx);
      await navigateToLoadTestPanelQuiet(ctx);
      // Scroll the panel back to the top so the config fields are visible.
      const contentEl = document.querySelector<HTMLElement>('.grpc-advanced-content');
      if (contentEl) contentEl.scrollTop = 0;
      await ctx.delay(150);
    },
    action: async (ctx) => {
      // Set higher concurrency so the second run has visibly different numbers.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 800);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 10);
      await ctx.delay(500);

      // Start.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 800);
      await ctx.click(GRPC.LOAD_TEST_START);
      await ctx.delay(400);

      // Brief status spotlight while running.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_STATUS, 700);

      // Wait for completion.
      await waitForLoadTestComplete(ctx, 20_000);
      await ctx.delay(600);

      // Scroll the compare section into view before spotlighting it.
      const compareEl = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_RUN_COMPARE);
      if (compareEl) compareEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await ctx.delay(400);

      // Spotlight the compare section — appears once 2+ runs exist.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_RUN_COMPARE, 1_200);
      await ctx.delay(300);

      // Spotlight the baseline selector.
      const compareSelect = document.querySelector(GRPC.LOAD_TEST_RUN_COMPARE_SELECT);
      if (compareSelect) {
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_RUN_COMPARE_SELECT, 900);
        await ctx.delay(300);
      }

      // Spotlight the delta cards (quick Δ grid inside the compare section).
      const compareSection = document.querySelector(GRPC.LOAD_TEST_RUN_COMPARE);
      if (compareSection) {
        const deltaGrid = compareSection.querySelector<HTMLElement>('.grpc-load-test-compare-grid');
        if (deltaGrid) {
          await spotlightElementAndPause(ctx, deltaGrid, 1_000);
          await ctx.delay(300);
        }
      }

      // Spotlight the detail metric table.
      const detailsEl = document.querySelector(GRPC.LOAD_TEST_RUN_COMPARE_DETAILS);
      if (detailsEl) {
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_RUN_COMPARE_DETAILS, 1_000);
      }
    },
    verify: GRPC.LOAD_TEST_RUN_COMPARE,
  },

  // =========================================================================
  // Step 8 — Save and load a profile
  // =========================================================================
  {
    id: 'grpc12-profile',
    title: 'Saving a Load Profile',
    pauseAfter: true,
    description:
      'Type **Echo Baseline** into the profile name field and click **Save**. The profile ' +
      'appears in the **Saved profiles** dropdown — select it any time and click **Load** to restore ' +
      'Concurrency, Total requests, Duration, Ramp-up, Request rate, and Warm-up in a single click.\n\n' +
      'Profiles are stored locally and survive page reloads, so you can maintain a library ' +
      'of named benchmark configurations — "Smoke Test", "Soak 1h", "Rate-limited 50 RPS" — ' +
      'for different services and environments.',
    highlight: GRPC.LOAD_TEST_PROFILE_SAVE,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
      // Remove any stale 'Echo Baseline' profile left from a prior lesson run.
      const existing = (await listGrpcLoadTestProfiles()).find(
        (p) => p.name.localeCompare(LOAD_TEST_PROFILE_NAME, undefined, { sensitivity: 'base' }) === 0,
      );
      if (existing) await deleteGrpcLoadTestProfile(existing.id);
      // Scroll to top so the profiles row is reachable without the panel being stuck scrolled down.
      const contentEl = document.querySelector<HTMLElement>('.grpc-advanced-content');
      if (contentEl) contentEl.scrollTop = 0;
      await ctx.delay(150);
    },
    action: async (ctx) => {
      // Spotlight the Saved profiles row.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-profiles"]', 800);

      // Fill the Profile name field.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_NAME, 800);
      await ctx.fill(GRPC.LOAD_TEST_PROFILE_NAME, LOAD_TEST_PROFILE_NAME);
      await ctx.delay(500);

      // Click Save profile.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_SAVE, 900);
      await ctx.click(GRPC.LOAD_TEST_PROFILE_SAVE);
      await ctx.delay(700);

      // Show the Profile dropdown with the saved entry.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_SELECT, 1_000);
      await ctx.delay(300);

      // Spotlight Load profile button.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_LOAD, 800);
    },
    verify: GRPC.LOAD_TEST_PROFILE_SELECT,
  },

  // =========================================================================
  // Step 9 — Server-streaming load test
  // =========================================================================
  {
    id: 'grpc12-streaming',
    title: 'Server-Streaming Load Test',
    pauseAfter: true,
    description:
      'Switch to `echo.EchoService / ServerStream`. The call type badge changes to ' +
      '**Server stream** and a new field appears: **Max messages / stream** — this caps ' +
      'how many response messages each run collects before closing the stream. ' +
      'Set it to **5**.\n\n' +
      'Concurrency is set to **1** (one stream at a time) because the Express proxy ' +
      'stream registry allows only one active stream per tab. The scheduler fires 10 ' +
      'sequential streams, each collecting up to 5 messages.\n\n' +
      'The metrics show throughput in streams-per-second and latency per stream. ' +
      'Raise **Max messages / stream** to collect more messages per run and observe ' +
      'how server-side streaming backpressure affects latency.',
    highlight: GRPC.LOAD_TEST_MAX_MESSAGES_PER_STREAM,
    preAction: async (ctx) => {
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ensureStreamingMethodSelectedQuiet(ctx, 'ServerStream');
      // Fill repeat_count so the echo server knows how many messages to stream back per call.
      await fillServerStreamRequestQuiet(ctx);
      await navigateToLoadTestPanelQuiet(ctx);
      // Enforce concurrency=1: the Express proxy stream registry allows only one active
      // stream per tab — concurrent starts cancel each other.
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 1);
    },
    action: async (ctx) => {
      // Call type badge — now shows "Server stream".
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_CALL_TYPE_BADGE, 900);
      await ctx.delay(300);

      // Max messages / stream field.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_MAX_MESSAGES_PER_STREAM, 1_000);
      setNumberInputValue('[data-testid="grpc-load-test-max-messages-per-stream"]', 5);
      await ctx.delay(500);

      // Concurrency must be 1 — the Express proxy stream registry allows only one active
      // stream per tab; higher concurrency causes each new stream to cancel prior ones.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 700);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 1);
      setNumberInputValue('[data-testid="grpc-load-test-total-calls"]', 10);
      await ctx.delay(300);

      // Start.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 800);
      await ctx.click(GRPC.LOAD_TEST_START);
      await ctx.delay(400);

      // Status while running.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_STATUS, 700);

      // Wait for completion.
      await waitForLoadTestComplete(ctx, 25_000);
      await ctx.delay(500);

      // Full results panel.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_RESULTS, 900);
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 1_000);
    },
    verify: GRPC.LOAD_TEST_RESULTS,
  },
];

// ---------------------------------------------------------------------------
// Lesson export
// ---------------------------------------------------------------------------

export const grpcLoadTestingLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC12_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Run concurrent load tests against a gRPC method, read p50/p95/p99 latency and ' +
    'throughput metrics, explore the results charts, compare runs with the built-in diff view, ' +
    'save a reusable benchmark profile, and extend load testing to server-streaming methods.',
  concept: {
    title: 'Load Testing: Concurrent Calls & Metrics',
    body:
      'gRPC Studio\'s **Load testing** panel runs **ghz-style** concurrent benchmarks from the browser — ' +
      'no extra tooling required. Configure Concurrency (parallel in-flight calls), Total requests, ' +
      'Duration or Ramp-up caps, a **Request rate (RPS)** throttle, and an optional ' +
      '**Request body template** with `{{runId}}` interpolation.\n\n' +
      'After the run you get a rich results panel: a **metrics grid** (Throughput, p50/p95/p99, ' +
      'Error rate), a **status breakdown** bar chart, a **latency histogram**, and a ' +
      '**throughput over time** timeline.\n\n' +
      'When two or more runs exist a **Run-to-run compare** section appears — colour-coded ' +
      'delta cards and a full metric detail table let you gate deployments against a saved baseline.\n\n' +
      'Results export as **Copy / Download JSON** (with `sourceMetadata` for traceability) or ' +
      '**Copy / Download CSV** for spreadsheets. The **run history selector** lets you switch ' +
      'between all recorded runs in the session.\n\n' +
      '**Saved profiles** store named configurations for repeatable benchmarks — reload in one click.',
  },
  grpc: buildGrpcContractMetaFromRoster(GRPC12_ROSTER),
  setup: async (ctx) => {
    await grpcFirstCallSetup(ctx);
    await ensureGrpcReflected(ctx);
    await ensureEchoMessageFilled(ctx, LOAD_TEST_BODY_MESSAGE);
    await clearGrpcSchemaDriftQuiet(ctx);
    await closeGrpcSettingsDrawerQuiet(ctx);
  },
  cleanup: async (ctx) => {
    await ensureGrpcStudioSubNavQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },
  steps,
};
