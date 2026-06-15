/**
 * Lesson 20: Test Harness Tour
 *
 * Guided tour of the Test Harness domain — its 5 sub-tabs:
 *   Feature Groups, Test Runner, Parameterized Runner,
 *   Workflow Runner, and Results.
 *
 * Explains how WS tests (Connect / Send / Receive) fit into the
 * Harness alongside HTTP and Kafka tests, how to run them,
 * and how to view + export results.
 *
 * Navigation-based "tour" lesson — no mock server or data seeding
 * required. Each step uses preAction to navigate to the target tab
 * before the spotlight and reading phase.
 *
 * NOTE: `initialTab` is intentionally NOT set. The auto-exit hook
 * in useDemoShortcuts exits the demo when activeTab !== initialTab.
 * Since this lesson navigates across multiple tabs (scenarios → runner
 * → param-runner → workflow-runner → results), setting initialTab
 * would trigger auto-exit on the first tab switch. Setup navigates
 * to `scenarios` instead.
 */
import type { DemoActionContext, DemoLesson } from '../../types';

// ── Setup / Cleanup ────────────────────────────────────────────────

async function harnessSetup(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('scenarios');
  await ctx.delay(300);
}

async function harnessCleanup(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('scenarios');
  await ctx.delay(300);
}

// ── Lesson Definition ──────────────────────────────────────────────

export const wsTestRunnerLesson: DemoLesson = {
  id: 'ws-test-runner',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Test Harness Tour',
  description: 'Explore the Test Harness — Feature Groups, Test Runner, Workflow Runner, and Results Dashboard.',
  estimatedMinutes: 3,
  // initialTab intentionally omitted — see file header comment

  setup: harnessSetup,
  cleanup: harnessCleanup,

  concept: {
    title: 'Test Harness — Organize, Run & Analyze',
    body: `The **Test Harness** is where you organize your tests, run them, and analyze results. It's a separate domain from the Workflow Designer and WebSocket Studio.

**Five Sub-Tabs:**
1. **Feature Groups** — Organize tests into groups and scenarios. Each test can be HTTP, WebSocket (Connect / Send / Receive), or Kafka.
2. **Test Runner** — Select scenarios, configure overrides, and execute test runs.
3. **Parameterized Runner** — Run scenarios with data-driven parameters (CSV, JSON, shared data sources).
4. **Workflow Runner** — Execute entire workflows (from the Designer) as test runs.
5. **Results** — View run history, analyze pass/fail rates, export JSON/CSV reports.

**WebSocket Tests in the Harness:**
- Use the **Transport** dropdown in the Test Editor to select WS Connect, WS Send, or WS Receive
- Chain them in a scenario: Connect → Send → Receive
- Add WS-specific assertions (body content, frame type, latency, message size)
- Results show transport-aware status: CONNECT, SEND, RECEIVE instead of HTTP codes

**Connection Flow:**
WS tests reference each other by Connection ID — a Send or Receive test picks the Connection ID from a sibling Connect test in the same scenario.`,
    keyTerms: [
      { term: 'Feature Group', definition: 'A named collection of test scenarios, scoped to an environment and microservice.' },
      { term: 'Test Runner', definition: 'Executes selected scenarios and produces pass/fail results with timing data.' },
      { term: 'Workflow Runner', definition: 'Runs an entire visual workflow (from the Designer) as a test execution.' },
      { term: 'Transport', definition: 'The action type for a test: HTTP, WS Connect, WS Send, WS Receive, or Kafka.' },
    ],
    diagram: `<svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="140" rx="8" fill="#1e1e2e" />

  <!-- Feature Groups -->
  <rect x="15" y="15" width="110" height="50" rx="4" fill="#2a2a3a" stroke="#60a5fa" stroke-width="1" />
  <text x="70" y="35" text-anchor="middle" fill="#60a5fa" font-size="9" font-weight="bold">Feature Groups</text>
  <text x="70" y="50" text-anchor="middle" fill="#888" font-size="7">FG → Scenario → Test</text>

  <!-- Test Runner -->
  <rect x="145" y="15" width="110" height="50" rx="4" fill="#2a2a3a" stroke="#4ade80" stroke-width="1" />
  <text x="200" y="35" text-anchor="middle" fill="#4ade80" font-size="9" font-weight="bold">Test Runner</text>
  <text x="200" y="50" text-anchor="middle" fill="#888" font-size="7">Select → Run → Pass/Fail</text>

  <!-- Results -->
  <rect x="275" y="15" width="110" height="50" rx="4" fill="#2a2a3a" stroke="#f59e0b" stroke-width="1" />
  <text x="330" y="35" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">Results</text>
  <text x="330" y="50" text-anchor="middle" fill="#888" font-size="7">Analyze + Export</text>

  <!-- Arrows -->
  <path d="M128,40 L142,40" stroke="#888" stroke-width="1.5" marker-end="url(#arr20)" />
  <path d="M258,40 L272,40" stroke="#888" stroke-width="1.5" marker-end="url(#arr20)" />

  <!-- WS Transport row -->
  <rect x="15" y="80" width="370" height="45" rx="4" fill="#2a2a3a" stroke="#a78bfa" stroke-width="1" stroke-dasharray="4,3" />
  <text x="25" y="97" fill="#a78bfa" font-size="9" font-weight="bold">WS Tests:</text>
  <rect x="100" y="86" width="70" height="22" rx="3" fill="#3a3a4a" />
  <text x="135" y="101" text-anchor="middle" fill="#60a5fa" font-size="8">Connect</text>
  <text x="178" y="101" fill="#888" font-size="8">→</text>
  <rect x="190" y="86" width="55" height="22" rx="3" fill="#3a3a4a" />
  <text x="217" y="101" text-anchor="middle" fill="#4ade80" font-size="8">Send</text>
  <text x="253" y="101" fill="#888" font-size="8">→</text>
  <rect x="265" y="86" width="65" height="22" rx="3" fill="#3a3a4a" />
  <text x="297" y="101" text-anchor="middle" fill="#f59e0b" font-size="8">Receive</text>
  <text x="345" y="101" fill="#888" font-size="8">→ Assert</text>
  <text x="200" y="120" text-anchor="middle" fill="#888" font-size="7">Chain WS tests by Connection ID within a scenario</text>

  <defs><marker id="arr20" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#888"/></marker></defs>
</svg>`,
  },

  steps: [
    // ── 1. The Test Harness ────────────────────────────────────
    {
      id: 'tr-harness-intro',
      title: 'The Test Harness',
      description:
        'The Test Harness is a separate domain from the Workflow Designer and WebSocket Studio. It has five sub-tabs visible at the top: Feature Groups (where you organize tests), Test Runner, Parameterized Runner, Workflow Runner, and Results. Each tab serves a distinct purpose in the test lifecycle.',
      highlight: '.sub-nav-tabs',
      pauseAfter: true,
    },

    // ── 2. Feature Groups ──────────────────────────────────────
    {
      id: 'tr-feature-groups',
      title: 'Feature Groups',
      description:
        'Feature Groups is where you organize your tests. The hierarchy is: Feature Group → Scenario → Test. Each test can be HTTP, WebSocket (Connect / Send / Receive), or Kafka. WS tests in the same scenario can reference each other by Connection ID — connect first, then send and receive on that connection. Use "+ Add Feature Group" to create one, then add scenarios and tests inside it.',
      highlight: '.page',
      pauseAfter: true,
    },

    // ── 3. Test Runner ─────────────────────────────────────────
    {
      id: 'tr-test-runner',
      title: 'Test Runner',
      description:
        'The Test Runner lets you select scenarios from your Feature Groups, configure execution options (skip validation, force unordered, assertion overrides), and run them. WS tests execute through the proxy backend — Connect establishes the WebSocket, Send transmits a message, and Receive waits for a response. Results show transport-specific status: CONNECT, SEND, RECEIVE instead of HTTP codes.',
      highlight: '.page',
      preAction: async (ctx) => {
        ctx.navigateToTab('runner');
        await ctx.delay(600);
      },
      pauseAfter: true,
    },

    // ── 4. Parameterized Runner ────────────────────────────────
    {
      id: 'tr-param-runner',
      title: 'Parameterized Runner',
      description:
        'The Parameterized Runner is for data-driven testing. Upload a CSV or JSON file, or connect a shared data source, and the runner iterates over each row — substituting values into your test templates. For WS tests, you can parameterize the URL, message payload, connection timeout, or expected response — perfect for testing multiple endpoints or message formats in a single run.',
      highlight: '.param-runner-page',
      preAction: async (ctx) => {
        ctx.navigateToTab('param-runner');
        await ctx.delay(600);
      },
      pauseAfter: true,
    },

    // ── 5. Workflow Runner ─────────────────────────────────────
    {
      id: 'tr-workflow-runner',
      title: 'Workflow Runner',
      description:
        'The Workflow Runner executes entire visual workflows from the Designer. In Lesson 9, you built a WS workflow with Connect → Send → Receive nodes and ran Quick Test. Here you can run that same workflow as a full test, with all node outputs captured and assertion results tracked. Click "Run in Harness" from the Workflow Designer toolbar to jump here with your workflow pre-selected.',
      highlight: '.page',
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow-runner');
        await ctx.delay(600);
      },
      pauseAfter: true,
    },

    // ── 6. Results Dashboard ───────────────────────────────────
    {
      id: 'tr-results',
      title: 'Results Dashboard',
      description:
        'The Results Dashboard shows all test and workflow run history. Filter by run type (Test Runs vs Workflow Runs) using the tabs at the top. Drill into individual results to see transport-aware details — WS results show Connection ID, protocol, frame type, and message size instead of the HTTP timing waterfall. Use the view tabs to switch between Overview, Requests, SLA, and Analysis.',
      highlight: '.results-run-filter-tabs',
      preAction: async (ctx) => {
        ctx.navigateToTab('results');
        await ctx.delay(600);
      },
      pauseAfter: true,
    },

    // ── 7. Export & Reporting ───────────────────────────────────
    {
      id: 'tr-export',
      title: 'Export & Reporting',
      description:
        'Export your test results as JSON or CSV for CI/CD integration, team sharing, or archival. You can also import results from CLI runs or workflow replays. The Generate Report dropdown creates detailed HTML reports. Feature Groups can be exported and imported too — share test suites across environments or with teammates.',
      highlight: '.results-top-actions',
      pauseAfter: true,
    },
  ],
};
