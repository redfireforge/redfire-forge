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
 *   grpc12-rpc-stats    — RPC Statistics panel: summary cards, method table, export, reset
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
import { scrollDemoTargetIntoView } from '../../demoSpotlightUtils';

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

function scrollAdvancedContentTop(): void {
  const contentEl = document.querySelector<HTMLElement>('.grpc-advanced-content');
  if (contentEl) contentEl.scrollTop = 0;
}

async function scrollDemoTargetWithDelay(
  ctx: DemoActionContext,
  selector: string,
  block: 'start' | 'center' | 'end' = 'center',
): Promise<HTMLElement | null> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  scrollDemoTargetIntoView(el, { block });
  await ctx.delay(350);
  return el;
}

/** Scroll a load-test / advanced-panel target into view, then draw the spotlight ring. */
async function spotlightLoadTestAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 700,
  scrollBlock: 'start' | 'center' | 'end' = 'center',
): Promise<void> {
  const el = await scrollDemoTargetWithDelay(ctx, selector, scrollBlock);
  if (!el) return;
  await spotlightElementAndPause(ctx, el, holdMs);
}

/**
 * Programmatically select the first available (non-empty) option in the
 * run-compare baseline dropdown so the delta content renders.
 * Uses the same React-compatible native-setter pattern as setNumberInputValue.
 */
function selectCompareBaseline(): void {
  const sel = document.querySelector<HTMLSelectElement>(
    '[data-testid="grpc-load-test-run-compare-select"]',
  );
  if (!sel) return;
  const firstOption = sel.querySelector<HTMLOptionElement>('option:not([value=""])');
  if (!firstOption) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  nativeSetter?.call(sel, firstOption.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
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
      // Skip the Manage Schemas draft reset — this lesson uses server reflection,
      // never staged schema sources. Running it would cycle the Manage Schemas
      // modal across every tab, flashing a burst of modals before step 1.
      await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
      await ensureGrpcReflected(ctx);
      await ensureEchoMessageFilled(ctx, LOAD_TEST_BODY_MESSAGE);
      await clearGrpcSchemaDriftQuiet(ctx);
      await closeGrpcSettingsDrawerQuiet(ctx);
    },
    action: async (ctx) => {
      // Click Studio tab visibly so the viewer sees the starting context.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_STUDIO, 800);
      await ctx.click(GRPC.SUB_NAV_STUDIO);
      await ctx.delay(800);

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
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('rpc_statistics'), 700);
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
      scrollAdvancedContentTop();
      await ctx.delay(150);

      // Panel header — active tab + RPC label.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_CALL_TYPE_BADGE, 900, 'start');

      // Method under test selector.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_METHOD_SELECT, 1_000, 'start');
      await ctx.delay(200);

      // Config fields one by one.
      await spotlightLoadTestAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 700, 'start');
      await spotlightLoadTestAndPause(ctx, '[data-testid="grpc-load-test-total-calls"]', 700, 'start');
      await spotlightLoadTestAndPause(ctx, '[data-testid="grpc-load-test-duration"]', 700, 'start');
      await spotlightLoadTestAndPause(ctx, '[data-testid="grpc-load-test-ramp-up"]', 700, 'start');

      // Request Rate field — pause longer so viewer notices the new control.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_REQUEST_RATE, 1_000, 'start');
      await ctx.delay(200);

      // Request body template (only visible for unary methods).
      const templateEl = document.querySelector(GRPC.LOAD_TEST_REQUEST_TEMPLATE);
      if (templateEl) {
        await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_REQUEST_TEMPLATE, 1_000, 'center');
        await ctx.delay(200);
      }

      // Profiles card.
      await spotlightLoadTestAndPause(ctx, '[data-testid="grpc-load-test-profiles"]', 900, 'end');
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

      // Scroll down immediately so the viewer sees the Results area filling in.
      const resultsArea = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_STATUS)
        ?? document.querySelector<HTMLElement>(GRPC.LOAD_TEST_RESULTS);
      if (resultsArea) {
        scrollDemoTargetIntoView(resultsArea, { block: 'start' });
        await ctx.delay(300);
      }

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

      // Scroll the results panel into view so the viewer can see it.
      const resultsEl = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_RESULTS);
      if (resultsEl) {
        scrollDemoTargetIntoView(resultsEl, { block: 'start' });
        await ctx.delay(400);
      }

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
      scrollAdvancedContentTop();
      await ctx.delay(150);

      // Spotlight the run strip — run ID + timing context.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_RUN_STRIP, 1_000, 'start');
      await ctx.delay(300);

      // Spotlight the summary metrics grid.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 1_000, 'start');

      // Walk individual metric cards.
      const metricsGrid = document.querySelector(GRPC.LOAD_TEST_SUMMARY_METRICS);
      if (metricsGrid) {
        const metricEls = metricsGrid.querySelectorAll<HTMLElement>('.grpc-advanced-metric');
        if (metricEls[0]) {
          scrollDemoTargetIntoView(metricEls[0], { block: 'center' });
          await ctx.delay(300);
          await spotlightElementAndPause(ctx, metricEls[0], 900);  // Throughput
        }
        await ctx.delay(200);
        if (metricEls[1]) {
          scrollDemoTargetIntoView(metricEls[1], { block: 'center' });
          await ctx.delay(300);
          await spotlightElementAndPause(ctx, metricEls[1], 800);  // p50
        }
        await ctx.delay(200);
        if (metricEls[2]) {
          scrollDemoTargetIntoView(metricEls[2], { block: 'center' });
          await ctx.delay(300);
          await spotlightElementAndPause(ctx, metricEls[2], 900);  // p95/p99
        }
        await ctx.delay(200);
        if (metricEls[3]) {
          scrollDemoTargetIntoView(metricEls[3], { block: 'center' });
          await ctx.delay(300);
          await spotlightElementAndPause(ctx, metricEls[3], 800);  // Error rate
        }
      }

      // Percentile legend.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_PERCENTILE_LEGEND, 800, 'center');
      await ctx.delay(300);

      // Status breakdown chart.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_STATUS_BREAKDOWN, 1_000, 'center');
      await ctx.delay(300);

      // Latency histogram.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_LATENCY_HISTOGRAM, 1_000, 'center');
      await ctx.delay(300);

      // Throughput over time.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_THROUGHPUT_TIMELINE, 1_000, 'end');
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
  // Step 7 — RPC Statistics panel tour
  // =========================================================================
  {
    id: 'grpc12-rpc-stats',
    title: 'RPC Statistics',
    pauseAfter: true,
    description:
      'The **RPC Statistics** tab keeps a running tally of every call made in this session — ' +
      'including all the load test attempts above. Switch to it now to see:\n\n' +
      '- **Summary cards** — total calls, success rate, and average latency (with p95)\n' +
      '- **Per-method table** — one row per RPC method with call count, error count, a latency bar, and a status chip\n' +
      '- **Export JSON / Export CSV** — snapshot the stats for CI dashboards or spreadsheets\n' +
      '- **Reset session** — clears the in-memory counters without touching call history\n\n' +
      'Stats accumulate automatically from every unary call, stream, and load test run — ' +
      'no extra configuration needed.',
    highlight: GRPC.RPC_STATS_PANEL,
    preAction: async (ctx) => {
      await ensureLoadTestResultsQuiet(ctx);
      // Ensure Advanced sub-nav is open.
      const advEl = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
      if (advEl && advEl.getAttribute('aria-selected') !== 'true') {
        advEl.click();
        await ctx.delay(500);
      }
    },
    action: async (ctx) => {
      // Spotlight the RPC statistics tab in the Advanced nav and click it.
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('rpc_statistics'), 900);
      await ctx.click(GRPC.ADVANCED_TAB('rpc_statistics'));
      await ctx.delay(700);

      try {
        await ctx.waitFor(GRPC.RPC_STATS_PANEL, 4_000);
      } catch {
        // Panel renders immediately — continue.
      }
      await ctx.delay(300);

      // Overview of the whole panel.
      await spotlightLoadTestAndPause(ctx, GRPC.RPC_STATS_PANEL, 1_000, 'start');
      await ctx.delay(300);

      // Summary cards (total calls / success rate / avg latency).
      const summaryEl = document.querySelector(GRPC.RPC_STATS_SUMMARY);
      if (summaryEl) {
        await spotlightLoadTestAndPause(ctx, GRPC.RPC_STATS_SUMMARY, 1_100, 'start');
        await ctx.delay(300);
      }

      // Per-method table.
      const tableEl = document.querySelector(GRPC.RPC_STATS_TABLE);
      if (tableEl) {
        await spotlightLoadTestAndPause(ctx, GRPC.RPC_STATS_TABLE, 1_100, 'center');
        await ctx.delay(300);
      }

      // Export buttons.
      const exportJsonEl = document.querySelector(GRPC.RPC_STATS_EXPORT_JSON_BTN);
      if (exportJsonEl) {
        await spotlightLoadTestAndPause(ctx, GRPC.RPC_STATS_EXPORT_JSON_BTN, 800, 'center');
        await ctx.delay(200);
        await spotlightLoadTestAndPause(ctx, GRPC.RPC_STATS_EXPORT_CSV_BTN, 700, 'center');
        await ctx.delay(300);
      }

      // Reset button — pause longer so the viewer reads the note about history being untouched.
      await spotlightLoadTestAndPause(ctx, GRPC.RPC_STATS_RESET, 1_100, 'end');
    },
    verify: GRPC.RPC_STATS_PANEL,
  },

  // =========================================================================
  // Step 8 — Run a second test; tour the run-to-run compare
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

      // Scroll the Run-to-Run Compare section (or the Results panel if compare
      // doesn't exist yet) into view so the reading-phase highlight is visible.
      const compareEl = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_RUN_COMPARE);
      const fallbackEl = compareEl ?? document.querySelector<HTMLElement>(GRPC.LOAD_TEST_RESULTS);
      if (fallbackEl) {
        scrollDemoTargetIntoView(fallbackEl, { block: 'start' });
      } else {
        scrollAdvancedContentTop();
      }
      await ctx.delay(150);
    },
    action: async (ctx) => {
      // Scroll to top so the viewer sees the config fields before we change them.
      scrollAdvancedContentTop();
      await ctx.delay(200);

      // 1. Change concurrency to 10 — viewer sees the value change before the run.
      await spotlightLoadTestAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 900, 'start');
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 10);
      await ctx.delay(500);

      // 2. Start and wait — scroll down immediately so viewer sees progress.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_START, 900, 'start');
      await ctx.click(GRPC.LOAD_TEST_START);
      await ctx.delay(300);

      // Scroll down so results/compare area is visible while running.
      const statusEl = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_STATUS);
      if (statusEl) {
        scrollDemoTargetIntoView(statusEl, { block: 'start' });
        await ctx.delay(300);
      }

      await waitForLoadTestComplete(ctx, 20_000);
      await ctx.delay(600);

      // 3. The compare card appears below results — scroll it into view and spotlight.
      try { await ctx.waitFor(GRPC.LOAD_TEST_RUN_COMPARE, 5_000); } catch { /* may already exist */ }
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_RUN_COMPARE, 1_300, 'start');
      await ctx.delay(400);

      // 4. Spotlight the baseline selector, then pick the previous run so delta content renders.
      try { await ctx.waitFor(GRPC.LOAD_TEST_RUN_COMPARE_SELECT, 3_000); } catch { /* */ }
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_RUN_COMPARE_SELECT, 900, 'start');
      selectCompareBaseline();
      await ctx.delay(1000); // React re-renders delta grid/table after state update.

      // 5. Delta cards — scroll to start so full cards are visible above demo panel.
      try { await ctx.waitFor('.grpc-load-test-compare-grid', 3_000); } catch { /* */ }
      await spotlightLoadTestAndPause(ctx, '.grpc-load-test-compare-grid', 1_400, 'start');
      await ctx.delay(400);

      // 6. Metric detail table — scroll to start so table header + rows are visible.
      try { await ctx.waitFor(GRPC.LOAD_TEST_RUN_COMPARE_DETAILS, 3_000); } catch { /* */ }
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_RUN_COMPARE_DETAILS, 1_200, 'start');
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

      // Scroll the Saved profiles / Save button into view so the reading-phase
      // highlight is visible — the profiles row sits below the config fields.
      const profileEl = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_PROFILE_SAVE)
        ?? document.querySelector<HTMLElement>('[data-testid="grpc-load-test-profiles"]');
      if (profileEl) {
        scrollDemoTargetIntoView(profileEl, { block: 'center' });
      } else {
        scrollAdvancedContentTop();
      }
      await ctx.delay(150);
    },
    action: async (ctx) => {
      // Spotlight the Saved profiles row.
      await spotlightLoadTestAndPause(ctx, '[data-testid="grpc-load-test-profiles"]', 800, 'start');

      // Fill the Profile name field.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_PROFILE_NAME, 800, 'start');
      await ctx.fill(GRPC.LOAD_TEST_PROFILE_NAME, LOAD_TEST_PROFILE_NAME);
      await ctx.delay(500);

      // Click Save profile.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_PROFILE_SAVE, 900, 'start');
      await ctx.click(GRPC.LOAD_TEST_PROFILE_SAVE);
      await ctx.delay(700);

      // Show the Profile dropdown with the saved entry.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_PROFILE_SELECT, 1_000, 'start');
      await ctx.delay(300);

      // Spotlight Load profile button.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_PROFILE_LOAD, 800, 'start');
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
    // After preAction the panel lands on Load Testing with ServerStream active.
    // The call-type badge ("Call type: Server stream") is visible and
    // directly shows what this step demonstrates.
    highlight: GRPC.LOAD_TEST_CALL_TYPE_BADGE,
    preAction: async (ctx) => {
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ensureStreamingMethodSelectedQuiet(ctx, 'ServerStream');
      await fillServerStreamRequestQuiet(ctx);
      await navigateToLoadTestPanelQuiet(ctx);
      scrollAdvancedContentTop();
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 1);
      await ctx.delay(150);
    },
    action: async (ctx) => {
      // 1. Visibly click "Studio" tab so the viewer sees the service tree.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_STUDIO, 800);
      await ctx.click(GRPC.SUB_NAV_STUDIO);
      await ctx.delay(800);

      // 2. Click ServerStream method in the service tree with highlight.
      const serverStreamSel = GRPC.METHOD('echo.EchoService', 'ServerStream');
      try { await ctx.waitFor(serverStreamSel, 3_000); } catch { /* */ }
      await spotlightAndPause(ctx, serverStreamSel, 900);
      await ctx.click(serverStreamSel);
      await ctx.delay(800);

      // 3. Navigate to Advanced > Load testing visibly.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_ADVANCED, 800);
      await ctx.click(GRPC.SUB_NAV_ADVANCED);
      await ctx.delay(600);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('load_test'), 700);
      await ctx.click(GRPC.ADVANCED_TAB('load_test'));
      await ctx.delay(500);

      scrollAdvancedContentTop();
      await ctx.delay(200);

      // 1. Panel header — one spotlight so the viewer reads the call-type subtitle.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_CALL_TYPE_BADGE, 1_400, 'start');
      await ctx.delay(400);

      // 2. Max messages / stream — the only new field; set to 5 while spotlight is on it.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_MAX_MESSAGES_PER_STREAM, 1_300, 'start');
      setNumberInputValue('[data-testid="grpc-load-test-max-messages-per-stream"]', 5);
      await ctx.delay(600);

      // 3. Concurrency — brief look so the viewer registers "1 stream at a time".
      await spotlightLoadTestAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 900, 'start');
      await ctx.delay(300);

      // 4. Start → wait → results.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_START, 900, 'start');
      await ctx.click(GRPC.LOAD_TEST_START);
      await waitForLoadTestComplete(ctx, 25_000);
      await ctx.delay(500);

      // 5. Summary metrics — the payoff: throughput and latency per stream.
      await spotlightLoadTestAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 1_300, 'start');
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
    keyTerms: [
      {
        term: 'Concurrency',
        definition:
          'The number of parallel in-flight calls the load runner keeps open at any moment. Higher concurrency stresses connection pooling and server thread limits.',
      },
      {
        term: 'Throughput (RPS)',
        definition:
          'Requests per second — the rate at which completed calls are returned. The metrics grid shows actual achieved RPS alongside your configured rate cap.',
      },
      {
        term: 'Latency percentiles (p50/p95/p99)',
        definition:
          'The median, 95th, and 99th percentile response times. p99 catches tail latency that averages hide — critical for SLA evaluation.',
      },
      {
        term: 'Run-to-run compare',
        definition:
          'A diff view that appears after two or more runs. Delta cards show metric changes with colour coding (green = improved, red = regressed) so you can gate releases against a baseline.',
      },
      {
        term: 'Saved profile',
        definition:
          'A named snapshot of load test configuration (concurrency, total, duration, RPS, body template). Reload it in one click for repeatable benchmarks across sessions.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 380" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc12-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc12-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
  </defs>

  <!-- Background -->
  <rect width="700" height="380" rx="10" fill="#0d1520"/>

  <!-- Title -->
  <text x="350" y="28" text-anchor="middle" font-size="13" fill="#e2e8f0" font-weight="600">Load Testing Flow</text>

  <!-- ── Left: Configuration panel ── -->
  <rect x="20" y="48" width="190" height="175" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="115" y="68" text-anchor="middle" font-size="10" fill="#93c5fd" font-weight="600">⚙ Configuration</text>

  <text x="32" y="90" font-size="8.5" fill="#a8b8cc">Concurrency</text>
  <rect x="120" y="80" width="78" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="159" y="92" text-anchor="middle" font-family="monospace" font-size="9" fill="#f1f5f9">10</text>

  <text x="32" y="114" font-size="8.5" fill="#a8b8cc">Total requests</text>
  <rect x="120" y="104" width="78" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="159" y="116" text-anchor="middle" font-family="monospace" font-size="9" fill="#f1f5f9">200</text>

  <text x="32" y="138" font-size="8.5" fill="#a8b8cc">RPS cap</text>
  <rect x="120" y="128" width="78" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="159" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#f1f5f9">50</text>

  <text x="32" y="162" font-size="8.5" fill="#a8b8cc">Duration cap</text>
  <rect x="120" y="152" width="78" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="159" y="164" text-anchor="middle" font-family="monospace" font-size="9" fill="#f1f5f9">30s</text>

  <!-- Start button -->
  <rect x="55" y="185" width="120" height="26" rx="13" fill="#1d4ed8" stroke="#3b82f6" stroke-width="1"/>
  <text x="115" y="202" text-anchor="middle" font-size="10" fill="#ffffff" font-weight="600">▶ Start</text>

  <!-- ── Center: concurrent calls ── -->
  <line x1="210" y1="135" x2="265" y2="100" stroke="#3b82f6" stroke-width="1.3" marker-end="url(#grpc12-arr)"/>
  <line x1="210" y1="135" x2="265" y2="135" stroke="#3b82f6" stroke-width="1.3" marker-end="url(#grpc12-arr)"/>
  <line x1="210" y1="135" x2="265" y2="170" stroke="#3b82f6" stroke-width="1.3" marker-end="url(#grpc12-arr)"/>

  <rect x="268" y="80" width="130" height="28" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="333" y="98" text-anchor="middle" font-size="8" fill="#93c5fd">⚡ call 1  →  OK (2ms)</text>
  <rect x="268" y="115" width="130" height="28" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="333" y="133" text-anchor="middle" font-size="8" fill="#93c5fd">⚡ call 2  →  OK (4ms)</text>
  <rect x="268" y="150" width="130" height="28" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="333" y="168" text-anchor="middle" font-size="8" fill="#93c5fd">⚡ call N  →  OK (3ms)</text>
  <text x="333" y="198" text-anchor="middle" font-size="8" fill="#64748b">× 10 concurrent</text>

  <!-- Arrow to results -->
  <line x1="398" y1="135" x2="430" y2="135" stroke="#22c55e" stroke-width="1.4" marker-end="url(#grpc12-arr-g)"/>

  <!-- ── Right: Metrics results panel ── -->
  <rect x="435" y="48" width="245" height="175" rx="6" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
  <text x="557" y="68" text-anchor="middle" font-size="10" fill="#4ade80" font-weight="600">📊 Results</text>

  <!-- Metrics grid -->
  <rect x="445" y="78" width="108" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="499" y="92" text-anchor="middle" font-size="7.5" fill="#64748b">Throughput</text>
  <text x="499" y="105" text-anchor="middle" font-size="11" fill="#4ade80" font-weight="600">48.2 rps</text>

  <rect x="562" y="78" width="108" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="616" y="92" text-anchor="middle" font-size="7.5" fill="#64748b">Error rate</text>
  <text x="616" y="105" text-anchor="middle" font-size="11" fill="#4ade80" font-weight="600">0.0%</text>

  <rect x="445" y="118" width="70" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="480" y="132" text-anchor="middle" font-size="7.5" fill="#64748b">p50</text>
  <text x="480" y="145" text-anchor="middle" font-size="10" fill="#f1f5f9" font-weight="600">2ms</text>

  <rect x="522" y="118" width="70" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="557" y="132" text-anchor="middle" font-size="7.5" fill="#64748b">p95</text>
  <text x="557" y="145" text-anchor="middle" font-size="10" fill="#fbbf24" font-weight="600">8ms</text>

  <rect x="599" y="118" width="70" height="32" rx="3" fill="#0a1118" stroke="#1c3a2a"/>
  <text x="634" y="132" text-anchor="middle" font-size="7.5" fill="#64748b">p99</text>
  <text x="634" y="145" text-anchor="middle" font-size="10" fill="#f87171" font-weight="600">14ms</text>

  <!-- Mini histogram bars -->
  <text x="455" y="168" font-size="7.5" fill="#a8b8cc">Latency histogram</text>
  <rect x="445" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="445" y="190" width="14" height="20" rx="2" fill="#3b82f6"/>
  <rect x="463" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="463" y="178" width="14" height="32" rx="2" fill="#3b82f6"/>
  <rect x="481" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="481" y="184" width="14" height="26" rx="2" fill="#3b82f6"/>
  <rect x="499" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="499" y="196" width="14" height="14" rx="2" fill="#3b82f6"/>
  <rect x="517" y="172" width="14" height="38" rx="2" fill="#1d4ed8" opacity="0.3"/>
  <rect x="517" y="202" width="14" height="8" rx="2" fill="#3b82f6"/>

  <!-- Run-to-run compare -->
  <text x="555" y="168" font-size="7.5" fill="#a8b8cc">Run compare</text>
  <rect x="545" y="174" width="60" height="18" rx="3" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.8"/>
  <text x="575" y="186" text-anchor="middle" font-size="7" fill="#4ade80">▲ +12% rps</text>
  <rect x="610" y="174" width="60" height="18" rx="3" fill="#2a1c1c" stroke="#ef4444" stroke-width="0.8"/>
  <text x="640" y="186" text-anchor="middle" font-size="7" fill="#f87171">▼ +3ms p99</text>

  <!-- Saved profile -->
  <rect x="545" y="198" width="125" height="16" rx="3" fill="#1e293b" stroke="#3b4a60"/>
  <text x="607" y="210" text-anchor="middle" font-size="7" fill="#a8b8cc">💾 Saved profile: baseline-v1</text>

  <!-- ── Bottom: Export/flow labels ── -->
  <text x="115" y="248" text-anchor="middle" font-size="9" fill="#64748b">Configure</text>
  <text x="333" y="248" text-anchor="middle" font-size="9" fill="#64748b">Execute (concurrent)</text>
  <text x="557" y="248" text-anchor="middle" font-size="9" fill="#64748b">Analyse &amp; Compare</text>

  <line x1="175" y1="244" x2="250" y2="244" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#grpc12-arr)"/>
  <line x1="410" y1="244" x2="475" y2="244" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#grpc12-arr-g)"/>

  <!-- Caption -->
  <text x="350" y="275" text-anchor="middle" font-size="9.5" fill="#a8b8cc">Configure → Fire concurrent calls → Read metrics, compare runs, export &amp; save profiles</text>
</svg>`,
  },
  grpc: buildGrpcContractMetaFromRoster(GRPC12_ROSTER),
  setup: async (ctx) => {
    // Skip the Manage Schemas draft reset — this lesson uses server reflection,
    // never staged schema sources. Running it would open/close the Manage Schemas
    // modal (cycling Proto Files/Protoset/URL/BSR sub-tabs) for every tab, which
    // the viewer sees as a burst of modals flashing on and off before step 1.
    await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
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
