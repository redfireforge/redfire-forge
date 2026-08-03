/** Lesson 7: Load Testing — configure profiles, run a load test, and analyze results */
import type { DemoActionContext, DemoLesson } from '../../types';
import {
  clearEvents,
  disconnectWebSocket,
  fillControlledInput,
  firstVisibleEl,
  getLastMockPort,
  startMockServerQuiet,
  stopMockServerQuiet,
  switchToClientModeQuiet,
} from '../setup-helpers';
import { WS } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { firstVisibleElement } from '../../utils/domVisibility';

/** Spotlight a selector, hold for the viewer, then remove the ring. */
async function spotlightSel(
  ctx: DemoActionContext,
  selector: string,
  holdMs: number,
): Promise<void> {
  const el = firstVisibleElement<HTMLElement>(selector);
  if (!el) return;
  // Prefer no scroll jump — ring follows the element where it already is
  const remove = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
  }
}

/** Quietly ensure the right pane is on the Events tab (no ripple). */
async function ensureEventsTabQuiet(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(WS.RIGHT_TAB_EVENTS)?.classList.contains('active')) return;
  firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_EVENTS)?.click();
  await ctx.delay(80);
}

function isAlreadyConnectedToMock(): boolean {
  const dc = firstVisibleEl<HTMLButtonElement>(WS.DISCONNECT_BTN);
  return Boolean(dc && !dc.disabled);
}

/** Quiet connect — no demo ripples (setup runs under the live overlay). */
async function connectToMockServerQuiet(ctx: DemoActionContext): Promise<void> {
  const url = `ws://localhost:${getLastMockPort()}`;
  if (isAlreadyConnectedToMock()) {
    // Already live — avoid disconnect/reconnect flash
    return;
  }
  // Only open Connect pane if the URL field is not already visible
  if (!firstVisibleEl(WS.URL_INPUT)) {
    firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
    await ctx.delay(60);
  }
  const input = firstVisibleEl<HTMLInputElement>(WS.URL_INPUT);
  if (input && input.value.trim() !== url) {
    fillControlledInput(input, url);
    await ctx.delay(40);
  }
  const connectBtn = firstVisibleEl<HTMLButtonElement>(WS.CONNECT_BTN);
  if (connectBtn && !connectBtn.disabled) connectBtn.click();
  for (let i = 0; i < 40; i++) {
    if (isAlreadyConnectedToMock()) break;
    await ctx.delay(80);
  }
  await ctx.delay(60);
}

/** Quietly wipe the product default template so step 2 can fill it live (no ripple). */
async function clearMessageTemplateQuiet(ctx: DemoActionContext): Promise<void> {
  const ta = firstVisibleEl<HTMLTextAreaElement>(WS.LT_MESSAGE_TEMPLATE);
  if (!ta || !ta.value.trim()) return;
  fillControlledInput(ta, '');
  await ctx.delay(40);
}

/** Quietly select Constant only when another profile is active (avoids reading-phase flash). */
async function ensureConstantProfileQuiet(ctx: DemoActionContext): Promise<void> {
  const constant = firstVisibleElement<HTMLElement>(WS.LT_PROFILE_CONSTANT);
  if (!constant) return;
  if (constant.classList.contains('active') || constant.getAttribute('aria-pressed') === 'true') {
    return;
  }
  constant.click();
  await ctx.delay(120);
}

/** Pretty JSON template filled visibly in step 2. */
const LT_DEMO_TEMPLATE = `{
  "action": "ping",
  "seq": {{counter}},
  "ts": "{{timestamp}}"
}`;

/**
 * Setup: quiet REST mock + client connect. No Mock/Client ripples, no disconnect
 * churn, no demo-tab add/rename (skipStudioTabIsolation). Lands on Events.
 */
async function loadTestSetup(ctx: DemoActionContext): Promise<void> {
  await startMockServerQuiet(ctx);
  await switchToClientModeQuiet(ctx);
  await connectToMockServerQuiet(ctx);
  await ensureEventsTabQuiet(ctx);
  (document.activeElement as HTMLElement | null)?.blur?.();
  await ctx.delay(40);
}

/**
 * Guard: silently runs a short 3-second load test if results are not already present.
 * Used by lt-results and lt-export preActions to ensure the results panel exists.
 */
async function ensureTestResults(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(WS.LT_RESULTS)) return;
  // Navigate to tab if needed
  if (!firstVisibleElement(WS.LT_CONFIG)) {
    await ctx.click(WS.RIGHT_TAB_LOADTEST);
    await ctx.delay(400);
  }
  if (firstVisibleElement(WS.LT_RESULTS)) return; // check again after nav
  // Ensure template has content
  const ta = firstVisibleElement<HTMLTextAreaElement>(WS.LT_MESSAGE_TEMPLATE);
  if (ta && !ta.value.trim()) {
    await ctx.fill(WS.LT_MESSAGE_TEMPLATE, '{"action":"ping","seq":{{counter}}}');
    await ctx.delay(200);
  }
  // Set Constant profile + short 3s test so we don't wait long
  await ctx.click(WS.LT_PROFILE_CONSTANT);
  await ctx.delay(200);
  await ctx.fill(WS.LT_RATE, '5');
  await ctx.delay(200);
  await ctx.fill(WS.LT_DURATION, '3');
  await ctx.delay(200);
  const startBtn = firstVisibleElement<HTMLButtonElement>(WS.LT_START_BTN);
  if (!startBtn || startBtn.disabled) return;
  startBtn.click(); // quiet — no ripple needed in guard
  await ctx.waitFor(WS.LT_RESULTS, 8000); // 3s test + 5s buffer (Rule 5)
}

/** Cleanup: stop any running load test, clear results, disconnect, stop mock quietly. */
async function loadTestCleanup(ctx: DemoActionContext): Promise<void> {
  const stopBtn = firstVisibleElement<HTMLButtonElement>(WS.LT_STOP_BTN);
  if (stopBtn) {
    stopBtn.click();
    await ctx.delay(500);
  }
  const clearBtn = firstVisibleElement<HTMLButtonElement>(WS.LT_CLEAR_BTN);
  if (clearBtn) {
    clearBtn.click();
    await ctx.delay(300);
  }
  firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_EVENTS)?.click();
  await ctx.delay(80);
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await stopMockServerQuiet(ctx);
  await switchToClientModeQuiet(ctx);
}

export const wsLoadTestingLesson: DemoLesson = {
  id: 'ws-load-testing',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Load Testing',
  description: 'Run load tests with constant, ramp, and burst profiles — then analyze real-time metrics.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',
  // Avoid add→rename "demo" connection tab flash at live start
  skipStudioTabIsolation: true,

  setup: loadTestSetup,
  cleanup: loadTestCleanup,

  concept: {
    title: 'WebSocket Load Testing',
    body: `How does your WebSocket server handle real-world traffic? RedfireForge's built-in load tester lets you find out — no external tools needed.

**Load Profiles**
- **Constant** — Send messages at a fixed rate (e.g., 10 msg/s for 5 seconds = 50 messages)
- **Ramp** — Start slow and increase to a target rate, simulating growing traffic
- **Burst** — Fire a batch of messages all at once, testing peak capacity

**Message Templates**
Write a JSON template with placeholders: \`{{counter}}\` (message index), \`{{timestamp}}\` (ISO timestamp), \`{{random}}\` (random value). Each message sent uses the next index, producing unique payloads.

**Live Metrics**
While the test runs, watch real-time stats: messages sent, current rate, elapsed time, and a progress bar.

**Results Dashboard**
After completion, see a full results dashboard:
- **Summary cards** — total messages, duration, throughput (msg/s), total bytes
- **Latency percentiles** — min, mean, p50, p95, p99, max
- **Histogram** — visual distribution of response latencies
- **Export** — download results as JSON for further analysis`,
    keyTerms: [
      { term: 'Constant Profile', definition: 'Fixed rate of messages per second for a set duration.' },
      { term: 'Ramp Profile', definition: 'Gradually increasing message rate from start to end rate.' },
      { term: 'Burst Profile', definition: 'Send all messages at once in a single batch.' },
      { term: 'Latency Percentile', definition: 'p50 = median, p95 = 95th percentile, p99 = near-worst-case response time.' },
      { term: 'Throughput', definition: 'Messages per second the server can handle.' },
    ],
    diagram: `<svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="140" rx="8" fill="#1e1e2e" />

  <!-- Constant -->
  <rect x="15" y="15" width="110" height="50" rx="4" fill="#2a2a3a" />
  <text x="70" y="32" text-anchor="middle" fill="#60a5fa" font-size="9" font-weight="bold">Constant</text>
  <line x1="25" y1="50" x2="115" y2="50" stroke="#60a5fa" stroke-width="2" />
  <text x="70" y="60" text-anchor="middle" fill="#888" font-size="7">10 msg/s × 5s</text>

  <!-- Ramp -->
  <rect x="140" y="15" width="110" height="50" rx="4" fill="#2a2a3a" />
  <text x="195" y="32" text-anchor="middle" fill="#22c55e" font-size="9" font-weight="bold">Ramp</text>
  <line x1="150" y1="55" x2="240" y2="38" stroke="#22c55e" stroke-width="2" />
  <text x="195" y="60" text-anchor="middle" fill="#888" font-size="7">1→20 msg/s</text>

  <!-- Burst -->
  <rect x="265" y="15" width="120" height="50" rx="4" fill="#2a2a3a" />
  <text x="325" y="32" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">Burst</text>
  <rect x="310" y="38" width="5" height="20" fill="#f59e0b" opacity="0.8" />
  <text x="325" y="60" text-anchor="middle" fill="#888" font-size="7">100 at once</text>

  <!-- Results row -->
  <rect x="15" y="75" width="370" height="50" rx="4" fill="#2a2a3a" />
  <text x="30" y="92" fill="#c4b5fd" font-size="9" font-weight="bold">📊 Results</text>
  <text x="30" y="108" fill="#888" font-size="8">50 msgs · 5.2s · 9.6 msg/s</text>
  <text x="200" y="92" fill="#aaa" font-size="8">Latency: p50=12ms p95=28ms p99=45ms</text>
  <rect x="200" y="98" width="15" height="18" rx="1" fill="#4ade80" opacity="0.6" />
  <rect x="218" y="103" width="15" height="13" rx="1" fill="#4ade80" opacity="0.5" />
  <rect x="236" y="108" width="15" height="8" rx="1" fill="#4ade80" opacity="0.4" />
  <rect x="254" y="112" width="15" height="4" rx="1" fill="#4ade80" opacity="0.3" />
  <text x="290" y="118" fill="#666" font-size="7">histogram</text>
</svg>`,
  },

  steps: [
    // ── 1. Load Test Tab ─────────────────────────────────────────
    {
      id: 'lt-intro',
      title: 'Load Test Tab',
      description:
        'We start on the **Events** tab — the default right-pane view while connected. ' +
        'The **Load Test** tab lives next to Events and Schema. It needs an active ' +
        'connection (the mock echo server is already running). Watch as we switch ' +
        'there to configure a profile, rate, and duration.',
      // No reading highlight — avoids spotlight/scroll pulse while setup settles
      preAction: async (ctx) => {
        await ensureEventsTabQuiet(ctx);
        (document.activeElement as HTMLElement | null)?.blur?.();
      },
      action: async (ctx) => {
        // Single visible beat: spotlight Load Test, then open
        await spotlightSel(ctx, WS.RIGHT_TAB_LOADTEST, 900);
        await ctx.click(WS.RIGHT_TAB_LOADTEST);
        await ctx.waitFor(WS.LT_CONFIG, 3000);
        // Wipe product default immediately (quiet) so step 2 starts from empty
        await clearMessageTemplateQuiet(ctx);
        await ctx.delay(700);
      },
      pauseAfter: true,
    },

    // ── 2. Message Template ──────────────────────────────────────
    {
      id: 'lt-template',
      title: 'Message Template',
      description:
        'The Message Template starts empty — you define the JSON each load message sends. ' +
        'Placeholders: `{{counter}}` (message index), `{{timestamp}}` (ISO timestamp), and ' +
        '`{{random}}` (random float). Watch as we enter a pretty-printed template so every ' +
        'message gets unique values you can trace.',
      highlight: WS.LT_MESSAGE_TEMPLATE,
      preAction: async (ctx) => {
        if (!firstVisibleElement(WS.LT_CONFIG)) {
          firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_LOADTEST)?.click();
          await ctx.delay(200);
        }
        await clearMessageTemplateQuiet(ctx);
      },
      action: async (ctx) => {
        // Spotlight empty field, then fill pretty JSON live
        await spotlightSel(ctx, WS.LT_MESSAGE_TEMPLATE, 900);
        await ctx.fill(WS.LT_MESSAGE_TEMPLATE, LT_DEMO_TEMPLATE);
        await ctx.delay(1500); // viewer reads the pretty-printed template
        await spotlightSel(ctx, WS.LT_MESSAGE_TEMPLATE, 1100);
      },
      pauseAfter: true,
    },

    // ── 3. Load Profile ──────────────────────────────────────────
    {
      id: 'lt-profile',
      title: 'Choose a Load Profile',
      description:
        'RedfireForge offers three load profiles. Watch as we preview each one: ' +
        '**Ramp** starts slow and accelerates; **Burst** fires all messages at once; ' +
        '**Constant** sends at a steady fixed rate — the clearest baseline. ' +
        'We settle on **Constant** for today\'s run.',
      highlight: WS.LT_PROFILE_CONSTANT,
      preAction: async (ctx) => {
        if (!firstVisibleElement(WS.LT_CONFIG)) {
          firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_LOADTEST)?.click();
          await ctx.delay(200);
        }
        // Quiet reset only when needed — avoids Constant ripple flash during reading
        await ensureConstantProfileQuiet(ctx);
      },
      action: async (ctx) => {
        // Tour each profile with spotlight so the viewer can follow the form change
        await spotlightSel(ctx, WS.LT_PROFILE_RAMP, 700);
        await ctx.click(WS.LT_PROFILE_RAMP);
        await ctx.delay(1100); // Start rate + End rate rows appear

        await spotlightSel(ctx, WS.LT_PROFILE_BURST, 700);
        await ctx.click(WS.LT_PROFILE_BURST);
        await ctx.delay(1100); // Total messages row appears

        // Settle on Constant — matches narration and next step's Rate/Duration fields
        await spotlightSel(ctx, WS.LT_PROFILE_CONSTANT, 800);
        await ctx.click(WS.LT_PROFILE_CONSTANT);
        await ctx.delay(1200); // Rate + Duration rows return; hold so viewer sees Constant active
      },
      pauseAfter: true,
    },

    // ── 4. Rate & Duration ───────────────────────────────────────
    {
      id: 'lt-settings',
      title: 'Rate & Duration',
      description:
        'Set **Rate** (messages per second) and **Duration** (seconds). Quick presets ' +
        'are available for duration — click any to apply instantly. We\'ll use ' +
        '5 msg/s for 5 seconds, sending 25 messages total. The summary card at the ' +
        'bottom always shows the expected count so you know what you\'re committing to.',
      highlight: WS.LT_RATE,
      preAction: async (ctx) => {
        if (!firstVisibleElement(WS.LT_CONFIG)) {
          await ctx.click(WS.RIGHT_TAB_LOADTEST);
          await ctx.delay(300);
        }
        // Ensure we are on Constant profile so Rate/Duration fields exist
        await ctx.click(WS.LT_PROFILE_CONSTANT);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        // Set rate to 5 msg/s
        await ctx.fill(WS.LT_RATE, '5');
        await ctx.delay(500); // user reads the updated value
        // Set duration to 5 seconds (lights up the "5s" preset button)
        await ctx.fill(WS.LT_DURATION, '5');
        await ctx.delay(600); // user reads summary card updating to ~25 messages
      },
      verify: WS.LT_SUMMARY,
      pauseAfter: true,
    },

    // ── 5. Run the Test ──────────────────────────────────────────
    {
      id: 'lt-run',
      title: 'Run the Load Test',
      description:
        'Click **Start load test** to begin. Watch the live counter as 25 messages ' +
        'are sent at exactly 5/s. The progress bar tracks elapsed time; the live ' +
        'metrics show actual rate, total sent, total received, and elapsed time. ' +
        'The test completes automatically after 5 seconds.',
      highlight: WS.LT_START_BTN,
      preAction: async (ctx) => {
        // Navigate to Load Test tab if neither config nor results are visible
        if (!firstVisibleElement(WS.LT_CONFIG) && !firstVisibleElement(WS.LT_RESULTS)) {
          await ctx.click(WS.RIGHT_TAB_LOADTEST);
          await ctx.delay(400);
        }
        // If a previous test result is showing, clear it so the config form is visible
        // (user may have skipped here from step 6 or 7 — Rule 4 guard)
        // Re-query DOM here so we pick up any changes from the tab navigation above
        if (!firstVisibleElement(WS.LT_CONFIG) && firstVisibleElement(WS.LT_CLEAR_BTN)) {
          await ctx.click(WS.LT_CLEAR_BTN);
          await ctx.waitFor(WS.LT_CONFIG, 2000); // wait for React to re-render the config form
        }
        // Ensure template has content
        const ta = firstVisibleElement<HTMLTextAreaElement>(WS.LT_MESSAGE_TEMPLATE);
        if (ta && !ta.value.trim()) {
          await ctx.fill(WS.LT_MESSAGE_TEMPLATE, LT_DEMO_TEMPLATE);
          await ctx.delay(200);
        }
        // Always ensure Constant profile + rate=5, duration=5 so description is accurate
        // (user may have skipped steps 3 or 4)
        await ctx.click(WS.LT_PROFILE_CONSTANT);
        await ctx.delay(200);
        await ctx.fill(WS.LT_RATE, '5');
        await ctx.delay(200);
        await ctx.fill(WS.LT_DURATION, '5');
        await ctx.delay(200);
      },
      action: async (ctx) => {
        const startBtn = firstVisibleElement<HTMLButtonElement>(WS.LT_START_BTN);
        if (!startBtn || startBtn.disabled) return;
        // Use ctx.click for the ripple — user sees the Start button press
        await ctx.click(WS.LT_START_BTN);
        // Wait for the test to finish naturally — results appear when done (Rule 5)
        // User watches live metrics count up for ~5s while waitFor polls
        await ctx.waitFor(WS.LT_RESULTS, 12000);
        await ctx.delay(800); // brief pause so user sees results render before spotlight changes
      },
      verify: WS.LT_RESULTS,
      pauseAfter: true,
    },

    // ── 6. Results Dashboard ─────────────────────────────────────
    {
      id: 'lt-results',
      title: 'Results Dashboard',
      description:
        'The results dashboard shows everything at a glance: **Messages Sent / Received**, ' +
        '**Duration**, **Avg Send Rate**, and — if the echo server responded — full ' +
        '**Round-Trip Latency** with p50, p95, and p99 percentiles. The histogram ' +
        'below shows the latency distribution bucket-by-bucket. The sparkline tracks ' +
        'throughput over time so you can see if the rate was steady.',
      highlight: WS.LT_RESULT_CARDS,
      preAction: async (ctx) => { await ensureTestResults(ctx); },
      pauseAfter: true,
    },

    // ── 7. Export & Reset ────────────────────────────────────────
    {
      id: 'lt-export',
      title: 'Export & Edit Configuration',
      description:
        'Click **Export** to download the full result set — every latency sample, ' +
        'throughput snapshot, and summary metric in one file. Perfect for CI/CD ' +
        'dashboards or offline analysis. Use **← Edit configuration** to return to ' +
        'the setup form and try a different profile — Ramp or Burst are great next ' +
        'steps once you have a Constant baseline. Or click **Run again** to re-run ' +
        'the same settings without leaving results.',
      highlight: WS.LT_EXPORT_BTN,
      preAction: async (ctx) => { await ensureTestResults(ctx); },
      action: async (ctx) => {
        // Click Export with ripple so the viewer sees the button press
        await ctx.click(WS.LT_EXPORT_BTN);
        await ctx.delay(600); // user sees the download triggered
      },
      pauseAfter: true,
    },
  ],
};
