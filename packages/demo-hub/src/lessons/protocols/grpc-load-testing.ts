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
import { grpcLoadTestingConcept } from './grpc-load-testing.content';
import { captureGrpcActiveDescriptorKey } from '../../adapters';
import {
  GRPC_ECHO_METHOD,
  GRPC_ECHO_METHOD_SEL,
  GRPC_ECHO_SERVICE_SEL,
  closeGrpcSettingsDrawerQuiet,
  clearGrpcSchemaDriftQuiet,
  ensureGrpcPlaintextChannelReady,
  ensureGrpcStudioSubNavQuiet,
  ensureStreamingMethodSelectedQuiet,
  fillGrpcEchoMessage,
  fillServerStreamRequestQuiet,
  grpcFirstCallCleanup,
  resetGrpcConnectionSettingsQuiet,
  resetGrpcLessonSessionFlags,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import {
  listGrpcLoadTestProfiles,
  deleteGrpcLoadTestProfile,
} from '@grpc/data/grpcLoadTestProfileRepository';
import type { DemoActionContext } from '../../types';
import {
  findScrollableParent,
  resumeDemoAutoScroll,
  scrollDemoTargetIntoView,
} from '../../demoSpotlightUtils';

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
 * Quiet Studio boot prep: Reflect + select Echo + fill body with DOM clicks only.
 * Shared `ensureGrpcReflected` / `ensureEchoMethodSelected` use `ctx.click`, which
 * draws ripples during Preparing — the "quick moving highlights" before step 1.
 */
async function prepareLoadTestStudioQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcPlaintextChannelReady(ctx);

  if (!document.querySelector(GRPC.EXPLORER_TREE) && !document.querySelector(GRPC.EXPLORER_SOURCE)) {
    const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
    if (reflectBtn && !reflectBtn.disabled) {
      reflectBtn.click();
    }
    try {
      await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_SOURCE}`, 12_000);
    } catch {
      // Remain navigable if local reflection infra is unavailable.
    }
  }
  if (document.querySelector(GRPC.EXPLORER_TREE) || document.querySelector(GRPC.EXPLORER_SOURCE)) {
    captureGrpcActiveDescriptorKey();
  }

  const methodLabel = document.querySelector(GRPC.CALL_METHOD_NAME)?.textContent ?? '';
  if (!methodLabel.includes(GRPC_ECHO_METHOD)) {
    if (!document.querySelector(GRPC_ECHO_METHOD_SEL)) {
      document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL)?.click();
      await ctx.delay(150);
    }
    document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL)?.click();
    try {
      await ctx.waitFor(GRPC.REQUEST_FORM_SCROLL, 5_000);
    } catch {
      await ctx.delay(150);
    }
  }
  // fillGrpcEchoMessage sets messageFilled when a lesson run is active.
  await fillGrpcEchoMessage(ctx, LOAD_TEST_BODY_MESSAGE);
}

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

/**
 * Scroll a compare/results subsection high enough that its header + primary
 * rows sit above the floating LiveDemo panel (not clipped / not buried under
 * Status breakdown + Latency histogram).
 */
async function scrollCompareSectionIntoView(
  ctx: DemoActionContext,
  el: HTMLElement,
): Promise<void> {
  resumeDemoAutoScroll();
  scrollDemoTargetIntoView(el, { block: 'start' });
  await ctx.delay(400);

  const scrollParent =
    findScrollableParent(el)
    ?? document.querySelector<HTMLElement>('.grpc-advanced-content');
  if (!scrollParent) return;

  const demoPanel = document.querySelector('.demo-live-panel')?.getBoundingClientRect();
  const limitBottom = demoPanel ? demoPanel.top - 20 : window.innerHeight - 32;
  const parentTop = scrollParent.getBoundingClientRect().top;
  const rect = el.getBoundingClientRect();

  // Prefer keeping the section top near the scroll parent top (+ padding).
  if (rect.top < parentTop + 8 || rect.top > parentTop + 96) {
    scrollParent.scrollTop += rect.top - parentTop - 24;
    await ctx.delay(280);
  }

  // If the section still spills under the LiveDemo panel, nudge further up.
  const after = el.getBoundingClientRect();
  if (after.bottom > limitBottom && after.height < (limitBottom - parentTop) * 0.9) {
    scrollParent.scrollTop += after.bottom - limitBottom + 28;
    await ctx.delay(280);
  }
}

/** Spotlight a results/compare subsection with scroll-up correction. */
async function spotlightCompareSectionAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs: number,
): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  await scrollCompareSectionIntoView(ctx, el);
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
    action: async (ctx) => {
      // Reading already rings Advanced — open once, land on Load testing.
      await ctx.click(GRPC.SUB_NAV_ADVANCED);
      await ctx.delay(800);
      try {
        await ctx.waitFor(GRPC.ADVANCED_SHELL, 5_000);
      } catch {
        /* shell renders fast */
      }
      await ctx.delay(400);

      // One nav beat (names are readable in the bar) — no per-tab ring tour.
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('load_test'), 1_100);
      await ctx.click(GRPC.ADVANCED_TAB('load_test'));
      await ctx.delay(800);
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
    // Exact first control — not the whole panel shell (huge ring + scroll thrash).
    highlight: GRPC.LOAD_TEST_METHOD_SELECT,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
      scrollAdvancedContentTop();
      await ctx.delay(120);
    },
    action: async (ctx) => {
      // Four exact beats — method, key knobs, template, profiles. No per-field scroll tour.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_METHOD_SELECT, 1_100);
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 1_000);
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_REQUEST_RATE, 1_100);
      if (document.querySelector(GRPC.LOAD_TEST_REQUEST_TEMPLATE)) {
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_REQUEST_TEMPLATE, 1_100);
      }
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-profiles"]', 1_000);
    },
    verify: GRPC.LOAD_TEST_METHOD_SELECT,
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
    highlight: '[data-testid="grpc-load-test-concurrency"]',
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
      scrollAdvancedContentTop();
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 900);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 5);
      await ctx.delay(500);

      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-total-calls"]', 900);
      setNumberInputValue('[data-testid="grpc-load-test-total-calls"]', 50);
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 1_100);
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
    highlight: GRPC.LOAD_TEST_START,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 5);
      setNumberInputValue('[data-testid="grpc-load-test-total-calls"]', 50);
    },
    action: async (ctx) => {
      await ctx.click(GRPC.LOAD_TEST_START);
      await ctx.delay(400);

      // One status beat while running — skip live-KPI hopscotch (too much scroll).
      const statusEl = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_STATUS);
      if (statusEl) {
        await scrollCompareSectionIntoView(ctx, statusEl);
        await spotlightElementAndPause(ctx, statusEl, 1_000);
      }

      await waitForLoadTestComplete(ctx, 20_000);
      await ctx.delay(500);

      // Exact payoff: summary metrics (not the entire Results shell).
      try { await ctx.waitFor(GRPC.LOAD_TEST_SUMMARY_METRICS, 5_000); } catch { /* */ }
      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 1_400);
    },
    verify: GRPC.LOAD_TEST_SUMMARY_METRICS,
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
    highlight: GRPC.LOAD_TEST_SUMMARY_METRICS,
    preAction: async (ctx) => {
      await ensureLoadTestResultsQuiet(ctx);
      const metrics = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_SUMMARY_METRICS);
      if (metrics) await scrollCompareSectionIntoView(ctx, metrics);
    },
    action: async (ctx) => {
      // Four exact sections — no per-card hopscotch through the metrics grid.
      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 1_500);
      await ctx.delay(400);
      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_STATUS_BREAKDOWN, 1_300);
      await ctx.delay(350);
      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_LATENCY_HISTOGRAM, 1_300);
      await ctx.delay(350);
      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_THROUGHPUT_TIMELINE, 1_400);
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
      const exportBtn = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_EXPORT_JSON);
      if (exportBtn) await scrollCompareSectionIntoView(ctx, exportBtn);
    },
    action: async (ctx) => {
      if (document.querySelector(GRPC.LOAD_TEST_RUN_HISTORY_SELECT)) {
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_RUN_HISTORY_SELECT, 1_000);
      }
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_EXPORT_JSON, 1_100);
      await ctx.click(GRPC.LOAD_TEST_EXPORT_JSON);
      await ctx.delay(600);
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_DOWNLOAD_JSON, 1_000);
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_EXPORT_CSV, 900);
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
    highlight: GRPC.ADVANCED_TAB('rpc_statistics'),
    preAction: async (ctx) => {
      await ensureLoadTestResultsQuiet(ctx);
      const advEl = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
      if (advEl && advEl.getAttribute('aria-selected') !== 'true') {
        advEl.click();
        await ctx.delay(400);
      }
    },
    action: async (ctx) => {
      await ctx.click(GRPC.ADVANCED_TAB('rpc_statistics'));
      await ctx.delay(700);
      try { await ctx.waitFor(GRPC.RPC_STATS_PANEL, 4_000); } catch { /* */ }

      // Exact sections only — skip whole-panel + export-button hopscotch.
      if (document.querySelector(GRPC.RPC_STATS_SUMMARY)) {
        await spotlightAndPause(ctx, GRPC.RPC_STATS_SUMMARY, 1_300);
      }
      if (document.querySelector(GRPC.RPC_STATS_TABLE)) {
        await spotlightAndPause(ctx, GRPC.RPC_STATS_TABLE, 1_400);
      }
      if (document.querySelector(GRPC.RPC_STATS_RESET)) {
        await spotlightAndPause(ctx, GRPC.RPC_STATS_RESET, 1_100);
      }
    },
    verify: GRPC.RPC_STATS_SUMMARY,
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
    // Compare card does not exist until the second run finishes — ring Start for Reading.
    highlight: GRPC.LOAD_TEST_START,
    preAction: async (ctx) => {
      // Ensure at least one finished run exists before we run the second.
      await ensureLoadTestResultsQuiet(ctx);
      await navigateToLoadTestPanelQuiet(ctx);
      // Land on config so Reading's Start highlight is on-screen (not buried in charts).
      scrollAdvancedContentTop();
      await ctx.delay(200);
    },
    action: async (ctx) => {
      scrollAdvancedContentTop();
      await ctx.delay(300);

      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 1_000);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 10);
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 1_000);
      await ctx.click(GRPC.LOAD_TEST_START);
      await waitForLoadTestComplete(ctx, 20_000);
      await ctx.delay(800);

      // Exact compare controls only — never the tall card shell.
      try { await ctx.waitFor(GRPC.LOAD_TEST_RUN_COMPARE_SELECT, 5_000); } catch { /* */ }
      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_RUN_COMPARE_SELECT, 1_400);
      selectCompareBaseline();
      await ctx.delay(1_200);

      try { await ctx.waitFor(GRPC.LOAD_TEST_COMPARE_GRID, 3_000); } catch { /* */ }
      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_COMPARE_GRID, 1_600);
      await ctx.delay(400);

      try { await ctx.waitFor(GRPC.LOAD_TEST_RUN_COMPARE_DETAILS, 3_000); } catch { /* */ }
      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_RUN_COMPARE_DETAILS, 1_800);
    },
    verify: GRPC.LOAD_TEST_RUN_COMPARE_DETAILS,
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
    // Exact name field — not Save (may be off-screen under Results) and not the whole row.
    highlight: GRPC.LOAD_TEST_PROFILE_NAME,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
      const existing = (await listGrpcLoadTestProfiles()).find(
        (p) => p.name.localeCompare(LOAD_TEST_PROFILE_NAME, undefined, { sensitivity: 'base' }) === 0,
      );
      if (existing) await deleteGrpcLoadTestProfile(existing.id);

      const nameEl = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_PROFILE_NAME);
      if (nameEl) {
        await scrollCompareSectionIntoView(ctx, nameEl);
      } else {
        scrollAdvancedContentTop();
      }
      await ctx.delay(200);
    },
    action: async (ctx) => {
      // Stay on the Saved profiles row — no re-scroll between exact controls.
      const nameEl = document.querySelector<HTMLElement>(GRPC.LOAD_TEST_PROFILE_NAME);
      if (nameEl) await scrollCompareSectionIntoView(ctx, nameEl);

      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_NAME, 1_100);
      await ctx.fill(GRPC.LOAD_TEST_PROFILE_NAME, LOAD_TEST_PROFILE_NAME);
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_SAVE, 1_100);
      await ctx.click(GRPC.LOAD_TEST_PROFILE_SAVE);
      await ctx.delay(700);

      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_SELECT, 1_200);
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_LOAD, 1_000);
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
      // Quiet method switch — avoid Studio ↔ Advanced bounce in the action.
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ensureStreamingMethodSelectedQuiet(ctx, 'ServerStream');
      await fillServerStreamRequestQuiet(ctx);
      await navigateToLoadTestPanelQuiet(ctx);
      scrollAdvancedContentTop();
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 1);
      await ctx.delay(150);
    },
    action: async (ctx) => {
      scrollAdvancedContentTop();
      await ctx.delay(200);

      // Stay on Load testing — badge + new field + start + metrics.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_CALL_TYPE_BADGE, 1_300);
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_MAX_MESSAGES_PER_STREAM, 1_300);
      setNumberInputValue('[data-testid="grpc-load-test-max-messages-per-stream"]', 5);
      await ctx.delay(500);

      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 1_000);
      await ctx.click(GRPC.LOAD_TEST_START);
      await waitForLoadTestComplete(ctx, 25_000);
      await ctx.delay(500);

      await spotlightCompareSectionAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 1_400);
    },
    verify: GRPC.LOAD_TEST_SUMMARY_METRICS,
  },
];

// ---------------------------------------------------------------------------
// Lesson export
// ---------------------------------------------------------------------------

export const grpcLoadTestingLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC12_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  // Avoid add-tab → rename-"demo" flashes before step 1 Reading.
  skipStudioTabIsolation: true,
  description:
    'Run concurrent load tests against a gRPC method, read p50/p95/p99 latency and ' +
    'throughput metrics, explore the results charts, compare runs with the built-in diff view, ' +
    'save a reusable benchmark profile, and extend load testing to server-streaming methods.',
  concept: grpcLoadTestingConcept,
  grpc: buildGrpcContractMetaFromRoster(GRPC12_ROSTER),
  setup: async (ctx) => {
    // Quiet land on Studio — no tab normalize/rename tour, no Reflect/method ripples.
    resetGrpcLessonSessionFlags();
    await navigateToGrpcStudio(ctx);
    await closeGrpcSettingsDrawerQuiet(ctx);
    await ensureGrpcStudioSubNavQuiet(ctx);
    await resetGrpcConnectionSettingsQuiet(ctx);
    await clearGrpcSchemaDriftQuiet(ctx);
    await prepareLoadTestStudioQuiet(ctx);
  },
  cleanup: async (ctx) => {
    await ensureGrpcStudioSubNavQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },
  steps,
};
