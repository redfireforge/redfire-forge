/**
 * Lesson 20: Run WS Workflow in Test Harness
 *
 * Demonstrates the Workflow Runner in the Test Harness by running the
 * "WS Echo Demo" workflow (seeded in setup if not yet created by Lesson 8).
 * The user:
 *   1. Navigates to the Workflow Runner tab
 *   2. Selects the WS Echo Demo workflow from the picker
 *   3. Inspects the wsUrl Initial Variable (pre-set to ws://localhost:9876)
 *   4. Clicks ▶ Run Workflow and watches execution against the live mock server
 *   5. Reads the completion banner (timing, request count)
 *   6. Navigates to the Results Dashboard to explore the workflow run
 *
 * Setup:
 *   - Starts the mock server at ws://localhost:9876
 *   - Seeds "WS Echo Demo" workflow via workflow designer adapter (if bridge available)
 *
 * NOTE: initialTab intentionally NOT set. The auto-exit hook in
 * useDemoShortcuts exits the demo when activeTab !== initialTab.
 * This lesson navigates from workflow-runner → results, so setting
 * initialTab would trigger auto-exit on the final step. Setup
 * navigates to workflow-runner instead.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { seedNamedWorkflow } from '../../adapters';

// ── WS Echo Demo Workflow Factory ─────────────────────────────────

/**
 * Creates a minimal "WS Echo Demo" workflow: Start → WS Connect → WS Send → WS Receive.
 * Used by setup to seed the workflow when the user hasn't completed Lesson 8 yet.
 */
function createWsEchoDemoWorkflow(): Record<string, unknown> {
  const startId = crypto.randomUUID();
  const connectId = crypto.randomUUID();
  const sendId = crypto.randomUUID();
  const receiveId = crypto.randomUUID();
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: 'WS Echo Demo',
    schemaVersion: 6,
    variables: { wsUrl: 'ws://localhost:9876' },
    services: [],
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      { id: startId, type: 'start', position: { x: 250, y: 50 }, data: { label: 'Start', inputVariables: {} } },
      {
        id: connectId, type: 'wsConnect', position: { x: 250, y: 160 },
        data: { label: 'WS Connect', url: '{{wsUrl}}', headers: [], queryParams: [], subprotocols: [], connectionId: 'ws1', timeoutMs: 10000, outputBindings: [] },
      },
      {
        id: sendId, type: 'wsSend', position: { x: 250, y: 270 },
        data: { label: 'WS Send', connectionId: 'ws1', message: '{"action": "hello", "from": "workflow"}', messageType: 'text', waitForResponse: false, responseTimeoutMs: 5000, outputBindings: [] },
      },
      {
        id: receiveId, type: 'wsReceive', position: { x: 250, y: 380 },
        data: { label: 'WS Receive', connectionId: 'ws1', timeoutMs: 5000, matchCriteria: { messageType: 'any' }, extractionRules: [], outputBindings: [] },
      },
    ],
    edges: [
      { id: crypto.randomUUID(), source: startId, target: connectId },
      { id: crypto.randomUUID(), source: connectId, target: sendId },
      { id: crypto.randomUUID(), source: sendId, target: receiveId },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// ── Setup / Cleanup ────────────────────────────────────────────────

const DEMO_MOCK_PORT = 9876;

/** True only if this lesson's setup actually started the mock server.
 *  Cleanup skips the stop call when the server was already running before the demo. */
let _runnerStartedMock = false;

async function harnessRunSetup(ctx: DemoActionContext): Promise<void> {
  // Seed "WS Echo Demo" workflow so the Workflow Runner picker always has something to select.
  // If the user already built it via Lesson 8, delete the old copy and re-seed a fresh one
  // so the wsUrl variable is correctly set for this lesson.
  await seedNamedWorkflow(ctx, 'WS Echo Demo', createWsEchoDemoWorkflow(), {
    deleteDelayMs: 0,
    insertPreDelayMs: 100,
    insertDelayMs: 0,
  });
  // Check whether the mock server is already running before starting it.
  // Only start (and later stop) if it was NOT already running — this prevents the
  // demo cleanup from destroying a server the user started independently.
  _runnerStartedMock = false;
  try {
    const statusAbort = new AbortController();
    const statusTimer = setTimeout(() => statusAbort.abort(), 2000);
    const res = await fetch(`/api/ws/mock/status?port=${DEMO_MOCK_PORT}`, { signal: statusAbort.signal });
    clearTimeout(statusTimer);
    const status = (await res.json()) as { running: boolean };
    if (!status.running) {
      _runnerStartedMock = true;
      const startAbort = new AbortController();
      const startTimer = setTimeout(() => startAbort.abort(), 3000);
      await fetch('/api/ws/mock/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: DEMO_MOCK_PORT }),
        signal: startAbort.signal,
      });
      clearTimeout(startTimer);
    }
  } catch { /* server may be unreachable — proceed anyway */ }
  await ctx.delay(400);
  ctx.navigateToTab('workflow-runner');
  await ctx.delay(600);
}

async function harnessRunCleanup(_ctx: DemoActionContext): Promise<void> {
  // Only stop the mock server if this lesson started it.
  // Skipping this preserves the user's running server when they were already using one.
  if (_runnerStartedMock) {
    _runnerStartedMock = false;
    try {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 3000);
      await fetch('/api/ws/mock/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: DEMO_MOCK_PORT }),
        signal: abort.signal,
      });
      clearTimeout(timer);
    } catch { /* ignore — server may already be stopped or unreachable */ }
  }
  // No navigateToTab here — App.tsx calls setActiveTab('demo-hub') after cleanup resolves.
  await new Promise<void>((r) => setTimeout(r, 300));
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Open the workflow picker and select the exact "WS Echo Demo" workflow.
 *
 * Prefers an exact name match so it always lands on the setup-seeded workflow
 * (which has `variables: { wsUrl: '...' }`), not on a user copy like
 * "WS Echo Demo (copy)" that may have the URL hard-coded without variables.
 */
async function selectWsEchoDemo(ctx: DemoActionContext): Promise<void> {
  await ctx.click('[data-testid="workflow-select"]');
  await ctx.waitFor('.wfp-dropdown-panel');
  await ctx.delay(400);
  const items = Array.from(document.querySelectorAll('.wfp-dropdown-item'));
  // Prefer exact match first so user copies (e.g. "WS Echo Demo (copy)") are skipped.
  const target = (
    items.find((el) => el.textContent?.trim() === 'WS Echo Demo') ??
    items.find((el) => el.textContent?.trim().startsWith('WS Echo Demo'))
  ) as HTMLElement | undefined;
  if (target) { target.click(); await ctx.delay(700); }
}

/** Click the Run Workflow button and wait until the completion banner appears (up to 15 s). */
async function runWorkflow(ctx: DemoActionContext): Promise<void> {
  // ctx.click shows a ripple so the user sees the button being pressed
  await ctx.click('.config-form .form-actions .btn-primary');
  // Poll for completion banner — workflow takes a few seconds against the mock server
  for (let i = 0; i < 30; i++) {
    await ctx.delay(500);
    if (document.querySelector('.completion-section')) break;
  }
  // Scroll the completion banner into view so the user can read the result
  // (the progress section renders below the Run button, outside the viewport).
  document.querySelector('.completion-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await ctx.delay(600);
}

// ── Lesson Definition ──────────────────────────────────────────────

export const wsTestRunnerLesson: DemoLesson = {
  id: 'ws-test-runner',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Run WS Workflow in Harness',
  description: 'Run the WS Echo Demo workflow from the Test Harness Workflow Runner and explore the results.',
  estimatedMinutes: 4,
  // initialTab intentionally omitted — see file header comment

  setup: harnessRunSetup,
  cleanup: harnessRunCleanup,

  concept: {
    title: 'Workflow Runner — From Designer to Harness',
    body: `The **Workflow Runner** in the Test Harness is where visual workflows graduate from ad hoc exploration to tracked test runs.

**Quick Test vs Workflow Runner**

| | Quick Test | Workflow Runner |
|---|---|---|
| Location | Workflow Designer toolbar | Test Harness → Workflow Runner |
| Result saved? | No — ephemeral | Yes — stored in Results |
| Variable override | No | Yes — edit before each run |
| Run history | No | Full history with timestamps |
| Load testing | No | Yes — concurrency + iterations |

**How It Works**

1. Pick a workflow from the **Workflow** dropdown
2. The **Initial Variables** panel shows all defined variables — override them without touching the workflow
3. Click **▶ Run Workflow** — execution runs through the proxy backend
4. A completion banner shows total requests and wall-clock time
5. Click **View Full Results →** to open the Results Dashboard filtered to that run

**WS Echo Demo variables**
The workflow uses \`{{wsUrl}}\` so you can point it at any WebSocket server — change it here without modifying the workflow definition.`,
    keyTerms: [
      { term: 'Workflow Runner', definition: 'The Test Harness tab that runs visual workflows as tracked test executions with result history.' },
      { term: 'Initial Variables', definition: 'Per-run variable overrides — shown in the picker panel, applied at execution time only.' },
      { term: 'Completion Banner', definition: 'The summary shown after a run finishes: request count and total duration.' },
      { term: 'Results Dashboard', definition: 'The Results tab filtered to show workflow runs — drill into each node\'s output and timing.' },
    ],
    diagram: `<svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="150" rx="8" fill="#1e1e2e" />

  <!-- Step 1: Workflow Picker -->
  <rect x="10" y="20" width="88" height="110" rx="4" fill="#2a2a3a" stroke="#60a5fa" stroke-width="1" />
  <text x="54" y="38" text-anchor="middle" fill="#60a5fa" font-size="8" font-weight="bold">Workflow</text>
  <text x="54" y="50" text-anchor="middle" fill="#60a5fa" font-size="8" font-weight="bold">Picker</text>
  <rect x="18" y="56" width="72" height="15" rx="2" fill="#1e3a5f" />
  <text x="54" y="67" text-anchor="middle" fill="#93c5fd" font-size="7">WS Echo Demo ▾</text>
  <rect x="18" y="76" width="72" height="36" rx="2" fill="#16213e" />
  <text x="54" y="88" text-anchor="middle" fill="#888" font-size="6.5">wsUrl =</text>
  <text x="54" y="99" text-anchor="middle" fill="#a78bfa" font-size="6">ws://localhost:9876</text>
  <text x="54" y="118" text-anchor="middle" fill="#888" font-size="6.5">Initial Variables</text>

  <!-- Arrow 1 -->
  <path d="M101,75 L118,75" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#arr2)" />

  <!-- Step 2: Run -->
  <rect x="120" y="20" width="80" height="110" rx="4" fill="#2a2a3a" stroke="#4ade80" stroke-width="1" />
  <text x="160" y="38" text-anchor="middle" fill="#4ade80" font-size="8" font-weight="bold">▶ Run</text>
  <text x="160" y="50" text-anchor="middle" fill="#4ade80" font-size="8" font-weight="bold">Workflow</text>
  <rect x="128" y="56" width="64" height="20" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.5" />
  <text x="160" y="70" text-anchor="middle" fill="#4ade80" font-size="7">Connect ✓</text>
  <rect x="128" y="80" width="64" height="20" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.5" />
  <text x="160" y="94" text-anchor="middle" fill="#4ade80" font-size="7">Send ✓</text>
  <rect x="128" y="104" width="64" height="20" rx="3" fill="#052e16" stroke="#22c55e" stroke-width="0.5" />
  <text x="160" y="118" text-anchor="middle" fill="#4ade80" font-size="7">Receive ✓</text>

  <!-- Arrow 2 -->
  <path d="M203,75 L220,75" stroke="#4ade80" stroke-width="1.5" marker-end="url(#arr3)" />

  <!-- Step 3: Completion -->
  <rect x="222" y="20" width="88" height="52" rx="4" fill="#2a2a3a" stroke="#f59e0b" stroke-width="1" />
  <text x="266" y="38" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="bold">Completion</text>
  <text x="266" y="50" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="bold">Banner</text>
  <text x="266" y="64" text-anchor="middle" fill="#888" font-size="6.5">3 requests · 0.42 s</text>

  <!-- Arrow 3 -->
  <path d="M266,74 L266,88" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#arr4)" />

  <!-- Step 4: Results -->
  <rect x="222" y="90" width="88" height="40" rx="4" fill="#2a2a3a" stroke="#a78bfa" stroke-width="1" />
  <text x="266" y="107" text-anchor="middle" fill="#a78bfa" font-size="8" font-weight="bold">Results</text>
  <text x="266" y="120" text-anchor="middle" fill="#a78bfa" font-size="8" font-weight="bold">Dashboard</text>

  <!-- Mock server -->
  <rect x="320" y="20" width="70" height="110" rx="4" fill="#2a2a3a" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4,3" />
  <text x="355" y="38" text-anchor="middle" fill="#38bdf8" font-size="7" font-weight="bold">Mock WS</text>
  <text x="355" y="50" text-anchor="middle" fill="#38bdf8" font-size="7" font-weight="bold">Server</text>
  <text x="355" y="65" text-anchor="middle" fill="#888" font-size="6.5">:9876</text>
  <text x="355" y="80" text-anchor="middle" fill="#4ade80" font-size="6.5">echo</text>
  <line x1="200" y1="94" x2="318" y2="70" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="3,2" />

  <defs>
    <marker id="arr2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa"/></marker>
    <marker id="arr3" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80"/></marker>
    <marker id="arr4" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── 1. Workflow Runner tab ─────────────────────────────────────
    {
      id: 'wfhr-open',
      title: 'Workflow Runner',
      description:
        'You\'re now in the **Workflow Runner** — the Test Harness tab that runs visual workflows as fully tracked test executions. Unlike Quick Test (which runs inside the Designer and discards the result), every run here is saved to the Results Dashboard with timestamps, request details, and timing data. The picker at the top lets you choose any workflow you\'ve built.',
      highlight: '.workflow-picker',
      pauseAfter: true,
    },

    // ── 2. Select WS Echo Demo ─────────────────────────────────────
    {
      id: 'wfhr-pick',
      title: 'Select the WS Echo Demo Workflow',
      description:
        'Click the **Workflow** dropdown and select "WS Echo Demo" — the workflow you built in Lesson 8 (Connect → Send → Receive). The demo seeds it automatically in setup, so it will always appear. Once selected, the workflow summary and Initial Variables panel appear below the picker.',
      highlight: '[data-testid="workflow-select"]',
      action: async (ctx) => {
        await selectWsEchoDemo(ctx);
      },
      verify: '.workflow-vars-section',
      pauseAfter: true,
    },

    // ── 3. Inspect Initial Variables ───────────────────────────────
    {
      id: 'wfhr-variables',
      title: 'Initial Variables — Override wsUrl',
      description:
        'The **Initial Variables** panel shows every variable defined in the workflow. "WS Echo Demo" has one — `wsUrl`, pre-set to `ws://localhost:9876` (the mock server started in this lesson\'s setup). You can change it here to point the workflow at any other WebSocket server without touching the workflow definition itself. The mock server is already running, so leave it as-is.',
      highlight: '.workflow-vars-section',
      preAction: async (ctx: DemoActionContext) => {
        // Guard: ensure the correct workflow is selected AND variables are populated.
        // A workflow without variables also renders .workflow-vars-section (empty state),
        // so we check for an actual .wfp-var-row to confirm variables loaded.
        if (!document.querySelector('.wfp-var-row')) {
          await selectWsEchoDemo(ctx);
        }
      },
      pauseAfter: true,
    },

    // ── 4. Run the workflow ────────────────────────────────────────
    {
      id: 'wfhr-run',
      title: 'Run the Workflow',
      description:
        'After reading, the demo clicks **▶ Run Workflow** for you. Watch the live progress panel — the WS Connect node opens a connection to `ws://localhost:9876`, WS Send delivers the echo message, and WS Receive captures the reply. All three nodes complete in a second or two against the local mock server.',
      highlight: '.config-form .form-actions',
      preAction: async (ctx: DemoActionContext) => {
        // Guard: ensure WS Echo Demo is selected so the Run Workflow button exists.
        if (!document.querySelector('.config-form')) {
          await selectWsEchoDemo(ctx);
        }
      },
      action: async (ctx) => {
        await runWorkflow(ctx);
      },
      verify: '.completion-section',
      pauseAfter: true,
    },

    // ── 5. Completion banner → open Results ────────────────────────
    {
      id: 'wfhr-complete',
      title: 'Run Complete — View Full Results',
      description:
        'The completion banner confirms the run finished — total requests (one per WS node) and wall-clock duration are shown. The result is now persisted in the Results Dashboard. The demo clicks **View Full Results →** to open it filtered to this workflow run.',
      highlight: '.completion-section',
      action: async (ctx) => {
        // Click "View Full Results →" with ripple so the user sees it happening;
        // this triggers onComplete('workflow') → navigates to results tab
        await ctx.click('.completion-section .btn-primary');
      },
      verify: '.results-run-filter-tabs',
      pauseAfter: true,
    },

    // ── 6. Results Dashboard ───────────────────────────────────────
    {
      id: 'wfhr-results',
      title: 'Results Dashboard — Workflow Run',
      description:
        'The Results Dashboard is now filtered to **Workflow Runs**. The most recent entry at the top is the "WS Echo Demo" run — tagged **⚡ WS Echo Demo** with a pass/fail badge and duration. Click it to open the **Workflow Results Explorer**: a node-by-node diagram with status indicators, extracted values, and timing for every WS step. You can also export the full trace as JSON or PNG from the header toolbar.',
      highlight: '.results-run-filter-tabs',
      preAction: async (ctx: DemoActionContext) => {
        // Guard: navigate to results if step 5 was skipped.
        if (!document.querySelector('.results-run-filter-tabs')) {
          ctx.navigateToTab('results');
          await ctx.delay(800);
        }
      },
      pauseAfter: true,
    },

    // ── 7. Request Details → Response Detail modal ─────────────────
    {
      id: 'wfhr-request-details',
      title: 'Request Details — Inspect Each WS Exchange',
      description:
        'Switch to **Request Details** to see every individual request grouped by WS node. ' +
        'Each row is a single WS operation: Connect, Send, or Receive. ' +
        'Click any row to open the **Response Detail** modal — it shows the full payload, ' +
        'connection metadata (ID, protocol, message size), and response timing for that exchange. ' +
        'The modal is **resizable**: drag the right edge, bottom edge, or corner to make it larger.',
      highlight: '.results-view-tabs',
      preAction: async (ctx: DemoActionContext) => {
        // Guard: ensure we're on the results tab.
        if (!document.querySelector('.results-view-tabs')) {
          ctx.navigateToTab('results');
          await ctx.delay(800);
        }
        // Ensure "Request Details" sub-tab is active.
        const tabs = Array.from(document.querySelectorAll('.results-view-tab'));
        const reqTab = tabs.find(el => el.textContent?.trim() === 'Request Details') as HTMLElement | undefined;
        if (reqTab && !reqTab.classList.contains('active')) {
          reqTab.click();
          await ctx.delay(400);
        }
      },
      action: async (ctx) => {
        // Click "Request Details" tab with ripple so viewer sees the switch.
        await ctx.click('[data-testid="results-tab-requests"]');
        await ctx.delay(600);
        // Wait for clickable rows to render.
        await ctx.waitFor('.clickable-row');
        await ctx.delay(400);
        // Click the first result row to open the Response Detail modal.
        await ctx.click('.clickable-row');
        await ctx.delay(500);
      },
      verify: '.response-detail-modal',
      pauseAfter: true,
    },
  ],
};
