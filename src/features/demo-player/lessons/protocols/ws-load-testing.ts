/** Lesson 7: Load Testing — configure profiles, run a load test, and analyze results */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsSetup, wsCleanup, disconnectWebSocket, clearEvents, connectToMockServer } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

/** Setup: start mock, connect, stay on Events tab so step 1 visibly opens Load Test. */
async function loadTestSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(500);
  await disconnectWebSocket(ctx);
  await ctx.delay(200);
  await clearEvents(ctx);
  await ctx.delay(200);
  await wsSetup(ctx);
  await ctx.delay(300);
  await connectToMockServer(ctx);
  // Stay on Events tab — step 1's preAction will navigate here reliably before action fires
  await ctx.delay(300);
}

/**
 * Guard: silently runs a short 3-second load test if results are not already present.
 * Used by lt-results and lt-export preActions to ensure the results panel exists.
 */
async function ensureTestResults(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WS.LT_RESULTS)) return;
  // Navigate to tab if needed
  if (!document.querySelector(WS.LT_CONFIG)) {
    await ctx.click(WS.RIGHT_TAB_LOADTEST);
    await ctx.delay(400);
  }
  if (document.querySelector(WS.LT_RESULTS)) return; // check again after nav
  // Ensure template has content
  const ta = document.querySelector(WS.LT_MESSAGE_TEMPLATE) as HTMLTextAreaElement | null;
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
  const startBtn = document.querySelector(WS.LT_START_BTN) as HTMLButtonElement | null;
  if (!startBtn || startBtn.disabled) return;
  startBtn.click(); // quiet — no ripple needed in guard
  await ctx.delay(5000); // 3s test + 2s buffer
  if (!document.querySelector(WS.LT_RESULTS)) {
    await ctx.waitFor(WS.LT_RESULTS);
  }
}

/** Cleanup: stop any running load test, clear results, disconnect, stop mock. */
async function loadTestCleanup(ctx: DemoActionContext): Promise<void> {
  // Stop running test if active
  const stopBtn = document.querySelector(WS.LT_STOP_BTN) as HTMLButtonElement | null;
  if (stopBtn) {
    stopBtn.click();
    await ctx.delay(500);
  }
  // Clear results if present
  const clearBtn = document.querySelector(WS.LT_CLEAR_BTN) as HTMLButtonElement | null;
  if (clearBtn) {
    clearBtn.click();
    await ctx.delay(300);
  }
  // Switch back to events tab
  await ctx.click(WS.RIGHT_TAB_EVENTS);
  await ctx.delay(200);
  await wsCleanup(ctx);
}

export const wsLoadTestingLesson: DemoLesson = {
  id: 'ws-load-testing',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Load Testing',
  description: 'Run load tests with constant, ramp, and burst profiles — then analyze real-time metrics.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',

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
        'The **Load Test** tab lives in the right pane alongside Events and Schema. ' +
        'It requires an active connection — the mock echo server is already running. ' +
        'You configure a load profile, set rate and duration, fire the test, then ' +
        'inspect results — all without leaving the studio. Let\'s switch there now.',
      highlight: WS.RIGHT_TAB_LOADTEST,
      preAction: async (ctx) => {
        // Quietly navigate to Events tab so the action produces a visible tab switch
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Navigate with ripple — viewer watches the tab switch and sees the config form
        await ctx.click(WS.RIGHT_TAB_LOADTEST);
        await ctx.delay(900); // user sees the full config form appear
      },
      pauseAfter: true,
    },

    // ── 2. Message Template ──────────────────────────────────────
    {
      id: 'lt-template',
      title: 'Message Template',
      description:
        'Write a JSON template for each message. Three placeholders are available: ' +
        '`{{counter}}` (message index, 0-based), `{{timestamp}}` (ISO timestamp), and ' +
        '`{{random}}` (random float). Each message gets unique values — useful for ' +
        'tracing latency or correlating sent/received pairs.',
      highlight: WS.LT_MESSAGE_TEMPLATE,
      preAction: async (ctx) => {
        // Ensure Load Test tab is visible
        if (!document.querySelector(WS.LT_CONFIG)) {
          await ctx.click(WS.RIGHT_TAB_LOADTEST);
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        const template = '{"action":"ping","seq":{{counter}},"ts":"{{timestamp}}"}';
        await ctx.fill(WS.LT_MESSAGE_TEMPLATE, template);
        await ctx.delay(700); // user reads the filled template
      },
      pauseAfter: true,
    },

    // ── 3. Load Profile ──────────────────────────────────────────
    {
      id: 'lt-profile',
      title: 'Choose a Load Profile',
      description:
        'RedfireForge offers three load profiles. **Ramp** starts slow and accelerates ' +
        '— great for finding the rate at which your server starts to strain. **Burst** ' +
        'fires all messages at once, testing peak capacity. **Constant** sends at a ' +
        'steady fixed rate — the clearest baseline. We\'ll use Constant today.',
      highlight: WS.LT_PROFILE_PILLS,
      preAction: async (ctx) => {
        if (!document.querySelector(WS.LT_CONFIG)) {
          await ctx.click(WS.RIGHT_TAB_LOADTEST);
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        // Tour each profile so the viewer sees the form change
        await ctx.click(WS.LT_PROFILE_RAMP);
        await ctx.delay(900); // user sees "Start Rate" + "End Rate" fields appear
        await ctx.click(WS.LT_PROFILE_BURST);
        await ctx.delay(900); // user sees "Total Messages" field appear
        // Settle on Constant — clean baseline for the demo
        await ctx.click(WS.LT_PROFILE_CONSTANT);
        await ctx.delay(600); // user sees Rate + Duration fields return
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
        if (!document.querySelector(WS.LT_CONFIG)) {
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
        'Click **Start Load Test** to begin. Watch the live counter as 25 messages ' +
        'are sent at exactly 5/s. The progress bar tracks elapsed time; the live ' +
        'metrics show actual rate, total sent, total received, and elapsed time. ' +
        'The test completes automatically after 5 seconds.',
      highlight: WS.LT_START_BTN,
      preAction: async (ctx) => {
        // Ensure config form is visible
        if (!document.querySelector(WS.LT_CONFIG)) {
          await ctx.click(WS.RIGHT_TAB_LOADTEST);
          await ctx.delay(400);
        }
        // Ensure template has content
        const ta = document.querySelector(WS.LT_MESSAGE_TEMPLATE) as HTMLTextAreaElement | null;
        if (ta && !ta.value.trim()) {
          await ctx.fill(WS.LT_MESSAGE_TEMPLATE, '{"action":"ping","seq":{{counter}},"ts":"{{timestamp}}"}');
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
        const startBtn = document.querySelector(WS.LT_START_BTN) as HTMLButtonElement | null;
        if (!startBtn || startBtn.disabled) return;
        // Use ctx.click for the ripple — user sees the Start button press
        await ctx.click(WS.LT_START_BTN);
        // Wait for the 5s test to run + buffer to see live metrics count up
        await ctx.delay(7000);
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
      title: 'Export & New Test',
      description:
        'Click **Export JSON** to download the full result set — every latency sample, ' +
        'throughput snapshot, and summary metric in one file. Perfect for CI/CD ' +
        'dashboards or offline analysis. Click **New Test** to reset the form and try ' +
        'a different profile — Ramp or Burst are great next steps once you have a ' +
        'Constant baseline.',
      highlight: WS.LT_EXPORT_BTN,
      preAction: async (ctx) => { await ensureTestResults(ctx); },
      action: async (ctx) => {
        // Click Export JSON with ripple so the viewer sees the button press
        await ctx.click(WS.LT_EXPORT_BTN);
        await ctx.delay(600); // user sees the download triggered
      },
      pauseAfter: true,
    },
  ],
};
