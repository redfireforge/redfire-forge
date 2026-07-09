/**
 * Lesson GRPC-12: Load Testing: Concurrent Calls & Metrics
 *
 * Teaches learners to configure and run a concurrent load test, read p50/p95/p99
 * latency percentiles and throughput (RPS), save a reusable load profile, and
 * extend the test to a server-streaming method with a per-stream message cap.
 *
 *   grpc12-intro       — Navigate to Advanced sub-nav; tour the 5 panel tabs
 *   grpc12-panel-tour  — Load Testing panel: header shows active RPC; config fields
 *   grpc12-configure   — Set Concurrency=5, Total requests=20; highlight Start
 *   grpc12-start       — Click Start; live progress bar and completed/succeeded/failed counters
 *   grpc12-results     — Results panel: Throughput / p50/p95/p99 / Error rate
 *   grpc12-export      — Copy JSON & Copy CSV; what's in the export
 *   grpc12-profile     — Save "Echo Baseline"; load it back from the dropdown
 *   grpc12-streaming   — Switch to ServerStream; Max messages/stream field appears; run
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
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
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
      // Ensure Echo is reflected and body filled so the load test has an active RPC.
      await ensureGrpcReflected(ctx);
      await ensureEchoMessageFilled(ctx, LOAD_TEST_BODY_MESSAGE);
      await clearGrpcSchemaDriftQuiet(ctx);
      await closeGrpcSettingsDrawerQuiet(ctx);
    },
    action: async (ctx) => {
      // Show the Studio sub-nav first so the viewer sees context.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_STUDIO, 700);
      await ctx.delay(300);

      // Click the Advanced sub-nav tab.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_ADVANCED, 800);
      await ctx.click(GRPC.SUB_NAV_ADVANCED);
      await ctx.delay(700);

      // Wait for the Advanced shell to render.
      try {
        await ctx.waitFor(GRPC.ADVANCED_SHELL, 5_000);
      } catch {
        // If it takes longer, continue — the shell renders fast.
      }
      await ctx.delay(300);

      // Spotlight the Advanced nav bar.
      await spotlightAndPause(ctx, GRPC.ADVANCED_NAV, 800);

      // Spotlight each tab so the viewer reads the names.
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('load_test'), 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('mock_server'), 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('schema_diff'), 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('rpc_stats'), 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('native_diagnostics'), 700);

      // Click Load testing to land on it.
      await ctx.click(GRPC.ADVANCED_TAB('load_test'));
      await ctx.delay(500);
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PANEL, 900);
    },
    verify: GRPC.LOAD_TEST_PANEL,
  },

  // =========================================================================
  // Step 2 — Load Testing panel tour
  // =========================================================================
  {
    id: 'grpc12-panel-tour',
    title: 'Load Testing Panel Tour',
    pauseAfter: true,
    description:
      'The **Load Testing** panel header shows the **active Studio tab** and the **RPC method** ' +
      'that will be exercised — right now it shows the Echo method you selected earlier. ' +
      'The configuration grid has five fields:\n\n' +
      '- **Concurrency** — parallel in-flight gRPC calls\n' +
      '- **Total requests** — how many calls to run in total\n' +
      '- **Duration (ms)** — optional wall-clock cap\n' +
      '- **Ramp-up (ms)** — time to gradually reach full concurrency\n' +
      '- **Warm-up calls** — excluded from metrics to let the server JIT\n\n' +
      'Below the config is the **Saved profiles** card — save and restore any combination for repeatable benchmarks.',
    highlight: GRPC.LOAD_TEST_PANEL,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight the panel header (shows active tab + RPC label).
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_CALL_TYPE_BADGE, 900);

      // Highlight the config grid fields one at a time.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 700);
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-total-calls"]', 700);
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-duration"]', 700);
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-ramp-up"]', 700);
      await ctx.delay(300);

      // Spotlight the Saved profiles card.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-profiles"]', 900);
    },
    verify: GRPC.LOAD_TEST_PANEL,
  },

  // =========================================================================
  // Step 3 — Configure: Concurrency=5, Total requests=20
  // =========================================================================
  {
    id: 'grpc12-configure',
    title: 'Configure the Load Run',
    pauseAfter: true,
    description:
      'Set the load parameters. **Concurrency = 5** means five gRPC calls run at the same time; ' +
      '**Total requests = 20** means the runner stops after 20 calls complete (across all workers).\n\n' +
      'With Concurrency 5 and Total requests 20, the runner fires 4 batches — each viewer will ' +
      'see real parallelism even on a local machine. Leave Duration and Ramp-up empty for now.\n\n' +
      'The **Start load test** button activates once the method is bound and at least Concurrency is set.',
    highlight: GRPC.LOAD_TEST_START,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight then fill Concurrency.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-concurrency"]', 800);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 5);
      await ctx.delay(600);

      // Spotlight then fill Total requests.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-total-calls"]', 800);
      setNumberInputValue('[data-testid="grpc-load-test-total-calls"]', 20);
      await ctx.delay(600);

      // Spotlight the Start button.
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
      'Click **Start load test**. While the test runs, the panel switches to a live view:\n\n' +
      '- A **progress bar** fills as calls complete\n' +
      '- **Completed / Succeeded / Failed** counters update in real time\n' +
      '- The **Status** line shows "Running…" and you can click **Stop** to abort early\n\n' +
      'With Concurrency 5 over a local Go server, all 20 calls finish in under a second — ' +
      'the counters tick fast. Watch the progress bar reach 100% before results appear.',
    highlight: GRPC.LOAD_TEST_STATUS,
    preAction: async (ctx) => {
      // Ensure configured and not already running.
      await navigateToLoadTestPanelQuiet(ctx);
      setNumberInputValue('[data-testid="grpc-load-test-concurrency"]', 5);
      setNumberInputValue('[data-testid="grpc-load-test-total-calls"]', 20);
    },
    action: async (ctx) => {
      // Spotlight then click Start.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 800);
      await ctx.click(GRPC.LOAD_TEST_START);
      await ctx.delay(300);

      // Spotlight the status indicator.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_STATUS, 700);

      // Show live counters if they appear.
      try {
        await ctx.waitFor(GRPC.LOAD_TEST_LIVE_COMPLETED, 3_000);
        await spotlightAndPause(ctx, GRPC.LOAD_TEST_LIVE_COMPLETED, 900);
      } catch {
        // Test may complete before live counters render — that's OK.
      }

      // Wait for the test to complete (results panel appears).
      await waitForLoadTestComplete(ctx, 20_000);
      await ctx.delay(400);

      // Spotlight the results panel appearing.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_RESULTS, 1_000);
    },
    verify: GRPC.LOAD_TEST_RESULTS,
  },

  // =========================================================================
  // Step 5 — Read the metrics
  // =========================================================================
  {
    id: 'grpc12-results',
    title: 'Reading the Metrics',
    pauseAfter: true,
    description:
      'After the run, the **Results** panel shows a metrics grid:\n\n' +
      '- **Throughput** — measured attempts per second (RPS)\n' +
      '- **p50 latency** — median call time; 50% of calls finished faster\n' +
      '- **p95 / p99 latency** — the "slow tail" — if p99 is much higher than p50, ' +
      'some calls hit server GC pauses or connection setup overhead\n' +
      '- **Error rate** — percentage of calls that returned a non-OK gRPC status\n\n' +
      'In production SLO monitoring, **p95** and **p99** are the standard thresholds. ' +
      'A low p50 with a high p99 is the signature of intermittent timeouts or retries.',
    highlight: GRPC.LOAD_TEST_RESULTS,
    preAction: async (ctx) => {
      await ensureLoadTestResultsQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight the full results card.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_RESULTS, 900);

      // Spotlight the metrics grid.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 1_000);

      // Spotlight individual metrics: Throughput, p50, p95/p99, Error rate.
      const metricsGrid = document.querySelector(GRPC.LOAD_TEST_SUMMARY_METRICS);
      if (metricsGrid) {
        const metricEls = metricsGrid.querySelectorAll<HTMLElement>('.grpc-advanced-metric');
        if (metricEls[0]) await spotlightElementAndPause(ctx, metricEls[0], 900);  // Throughput
        await ctx.delay(200);
        if (metricEls[1]) await spotlightElementAndPause(ctx, metricEls[1], 800);  // p50 latency
        await ctx.delay(200);
        if (metricEls[2]) await spotlightElementAndPause(ctx, metricEls[2], 900);  // p95/p99 latency
        await ctx.delay(200);
        if (metricEls[3]) await spotlightElementAndPause(ctx, metricEls[3], 800);  // Error rate
      }
    },
    verify: GRPC.LOAD_TEST_SUMMARY_METRICS,
  },

  // =========================================================================
  // Step 6 — Export JSON / CSV
  // =========================================================================
  {
    id: 'grpc12-export',
    title: 'Exporting Results',
    pauseAfter: true,
    description:
      'Click **Copy JSON** to copy the full results to your clipboard. The exported object includes:\n\n' +
      '- `sourceMetadata` — method, target endpoint, transport, and descriptor key\n' +
      '- `config` — the exact concurrency / total-requests settings used\n' +
      '- `metrics` — throughput, latency percentiles (p50/p95/p99/max), status distribution\n\n' +
      '**Copy CSV** produces a spreadsheet-friendly row of the same metrics — paste it directly ' +
      'into Google Sheets or Excel to build a latency trend chart across runs.\n\n' +
      'Both formats include a `runAt` timestamp so you can track performance over time.',
    highlight: GRPC.LOAD_TEST_EXPORT_JSON,
    preAction: async (ctx) => {
      await ensureLoadTestResultsQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight the Results card header actions.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_RESULTS, 800);

      // Spotlight and click Copy JSON.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_EXPORT_JSON, 900);
      await ctx.click(GRPC.LOAD_TEST_EXPORT_JSON);
      await ctx.delay(600);

      // Spotlight Copy CSV.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_EXPORT_CSV, 800);
      await ctx.delay(400);

      // Return spotlight to the results panel to reinforce context.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_SUMMARY_METRICS, 700);
    },
    verify: GRPC.LOAD_TEST_EXPORT_JSON,
  },

  // =========================================================================
  // Step 7 — Save and load a profile
  // =========================================================================
  {
    id: 'grpc12-profile',
    title: 'Saving a Load Profile',
    pauseAfter: true,
    description:
      'Name this configuration **Echo Baseline** and click **Save profile**. The profile ' +
      'appears in the **Profile** dropdown — select it any time to restore all settings ' +
      '(Concurrency, Total requests, Duration, Ramp-up, Warm-up) in a single click.\n\n' +
      'Try increasing Concurrency to **10** after loading the profile to run a ' +
      'higher-concurrency comparison — you\'ll see throughput scale and p99 latency shift.\n\n' +
      'Profiles are stored locally and survive page reloads, so you can build a library ' +
      'of named benchmark configurations for different services and environments.',
    highlight: GRPC.LOAD_TEST_PROFILE_SAVE,
    preAction: async (ctx) => {
      await navigateToLoadTestPanelQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight the Saved profiles card.
      await spotlightAndPause(ctx, '[data-testid="grpc-load-test-profiles"]', 800);

      // Spotlight and fill the Profile name field.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_NAME, 800);
      await ctx.fill(GRPC.LOAD_TEST_PROFILE_NAME, LOAD_TEST_PROFILE_NAME);
      await ctx.delay(500);

      // Spotlight and click Save profile.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_SAVE, 900);
      await ctx.click(GRPC.LOAD_TEST_PROFILE_SAVE);
      await ctx.delay(700);

      // Spotlight the Profile dropdown to show the saved entry.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_SELECT, 1_000);
      await ctx.delay(300);

      // Spotlight Load profile button.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_PROFILE_LOAD, 800);
    },
    verify: GRPC.LOAD_TEST_PROFILE_SELECT,
  },

  // =========================================================================
  // Step 8 — Server-streaming load test
  // =========================================================================
  {
    id: 'grpc12-streaming',
    title: 'Server-Streaming Load Test',
    pauseAfter: true,
    description:
      'Switch to the `echo.EchoService / ServerStream` method. Notice a new field appears: ' +
      '**Max messages / stream** — this caps how many response messages each concurrent run ' +
      'collects before closing the stream. Set it to **5**.\n\n' +
      'Start the test. Each of the 5 concurrent runs opens a server-streaming RPC and collects ' +
      'up to 5 messages. The metrics show throughput in streams-per-second and latency per stream.\n\n' +
      'This is useful for stress-testing your server\'s streaming backpressure: does it slow down ' +
      'gracefully, or does throughput collapse under concurrent streams?',
    highlight: GRPC.LOAD_TEST_MAX_MESSAGES_PER_STREAM,
    preAction: async (ctx) => {
      // Switch to ServerStream in the Studio tab.
      await ensureGrpcStudioSubNavQuiet(ctx);
      await ensureStreamingMethodSelectedQuiet(ctx, 'ServerStream');
      // Navigate back to the load test panel.
      await navigateToLoadTestPanelQuiet(ctx);
    },
    action: async (ctx) => {
      // Spotlight the call type badge showing "Server stream".
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_CALL_TYPE_BADGE, 900);
      await ctx.delay(300);

      // Spotlight and fill Max messages / stream.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_MAX_MESSAGES_PER_STREAM, 1_000);
      setNumberInputValue('[data-testid="grpc-load-test-max-messages-per-stream"]', 5);
      await ctx.delay(500);

      // Set a small total requests count for the demo so it finishes quickly.
      setNumberInputValue('[data-testid="grpc-load-test-total-calls"]', 10);
      await ctx.delay(300);

      // Spotlight and click Start.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_START, 800);
      await ctx.click(GRPC.LOAD_TEST_START);
      await ctx.delay(400);

      // Spotlight the status.
      await spotlightAndPause(ctx, GRPC.LOAD_TEST_STATUS, 700);

      // Wait for completion.
      await waitForLoadTestComplete(ctx, 25_000);
      await ctx.delay(400);

      // Spotlight the results panel.
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
    'throughput metrics, save a reusable benchmark profile, and explore server-streaming ' +
    'load with per-stream message caps.',
  concept: {
    title: 'Load Testing: Concurrent Calls & Metrics',
    body:
      'gRPC Studio\'s **Load testing** panel runs **ghz-style** concurrent benchmarks from the browser — ' +
      'no extra tooling required. Configure Concurrency (parallel in-flight calls), Total requests, ' +
      'and optional Duration or Ramp-up parameters, then click **Start**.\n\n' +
      'After the run you get a **metrics grid** showing Throughput (RPS) and the full latency ' +
      'percentile ladder — **p50**, **p95**, and **p99** — plus the error rate. ' +
      'Results export as JSON (with `sourceMetadata` for traceability) or CSV for spreadsheets.\n\n' +
      '**Saved profiles** let you store named configurations for repeatable benchmarks — ' +
      'reload any profile in one click to compare runs across concurrency levels or server versions.\n\n' +
      'Server-streaming methods gain a **Max messages / stream** cap so each concurrent run ' +
      'collects a bounded number of messages before closing — preventing unbounded result buffers.',
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
