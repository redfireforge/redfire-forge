/** Lesson GQL-17: Workflow Runner & Results */
import type { DemoLesson } from '../../types';
import {
  GQL_DEMO_HTTP,
  LESSON17_WF_NAME,
  LESSON17_DOCKER_ENDPOINT,
  selectGqlLatencyDemoWorkflow,
  runGqlLatencyWorkflow,
  ensureLesson17WorkflowSelected,
  ensureLesson17WorkflowRun,
  ensureLesson17ResultsOpen,
  gqlWorkflowRunnerLessonSetup,
  gqlWorkflowRunnerLessonCleanup,
} from './graphql-lesson-helpers';

export const gqlWorkflowRunnerLesson: DemoLesson = {
  id: 'gql-workflow-runner',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Workflow Runner & Results',
  description:
    'Graduate the GraphQL Latency Demo workflow from Quick Test to the Workflow Runner — configure iterations, observe live progress, and drill into the Results Explorer for node-level analysis.',
  estimatedMinutes: 5,
  initialTab: 'workflow-runner',
  // Steps 5–10 navigate to Results Dashboard / Explorer — must not auto-exit live demo.
  allowedTabs: ['workflow', 'workflow-runner', 'results'],

  dockerEndpoint: LESSON17_DOCKER_ENDPOINT,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlWorkflowRunnerLessonSetup,
  cleanup: gqlWorkflowRunnerLessonCleanup,

  concept: {
    title: 'Workflow Runner & Results — From Ad Hoc to Tracked, Repeatable Execution',
    body: `Quick Test in the Workflow Designer is a development tool: it runs once, shows you pass/fail on the canvas, and discards the result when you navigate away. The **Workflow Runner** is where workflows graduate to production-grade test execution — every run is **saved, timestamped, and explorable** in the Results Dashboard.

**Why Workflow Runner instead of Quick Test?**
Quick Test has no memory. The Workflow Runner has three capabilities Quick Test can never have: (1) **variable overrides** — change endpoint or auth without touching the workflow definition; (2) **load testing** — run the workflow with configurable iterations and concurrency to measure throughput and tail latency; (3) **persistent results** — every run is stored so you can compare across builds, branches, or time windows.

**Why the Results Dashboard instead of the canvas?**
The canvas green/red overlay shows *whether* nodes passed. The Results Dashboard tells you *how fast* they were and *why* failures occurred across N iterations. The **p50 / p95 latency cards** answer "is this consistently fast?" The **histogram** reveals bimodal distributions that p50 alone would hide. The **Results Explorer** shows per-iteration node state with intermediate variable values — the same data the Debug Mode exposes, but across every run.

**Why the Results Explorer specifically?**
The three-panel layout (canvas + detail + iteration matrix) makes it possible to answer the most common question after a load test: "Which node is the bottleneck, and which iteration first showed the regression?" You can filter to a single failing iteration, inspect the exact variable snapshot at the failing node, and see whether the failure is deterministic or intermittent.

**Why export results?**
Exporting the run trace as JSON lets CI/CD consume threshold assertions programmatically. A p95 latency badge in a pull request is the difference between a workflow test that documents performance and one that enforces it.`,
    keyTerms: [
      {
        term: 'Workflow Runner',
        definition:
          'The Test Harness tab that runs visual workflows as tracked, repeatable test executions — with load config, variable overrides, and persistent results history.',
      },
      {
        term: 'Initial Variables',
        definition:
          'Per-run variable overrides shown in the picker panel — applied at execution time without modifying the workflow definition. Equivalent to environment variables for a CI job.',
      },
      {
        term: 'Concurrency',
        definition:
          'The number of parallel workflow instances. Concurrency 2 with 10 iterations = 5 batches of 2 simultaneous runs — tests the server\'s ability to handle parallel GraphQL requests.',
      },
      {
        term: 'p95 Latency',
        definition:
          '95th percentile response time — 95% of requests completed at or below this value. More actionable than average because it captures the slowest realistic user experience.',
      },
      {
        term: 'Results Explorer',
        definition:
          'Three-panel modal (canvas overlay + detail panel + iteration matrix) for inspecting per-node execution state, intermediate variable values, and pass/fail counts across all iterations.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- Window chrome -->
  <rect width="700" height="430" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
  <rect width="700" height="32" rx="10" fill="#1e293b"/>
  <rect y="22" width="700" height="10" fill="#1e293b"/>
  <circle cx="20" cy="16" r="5" fill="#ef4444" opacity="0.8"/>
  <circle cx="38" cy="16" r="5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="56" cy="16" r="5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="21" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="500">RedfireForge — Redfire Performance Workbench</text>

  <!-- App tab bar -->
  <rect y="32" width="700" height="28" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <rect x="0" y="42" width="90" height="18" rx="3" fill="#0f172a"/>
  <text x="45" y="55" text-anchor="middle" fill="#60a5fa" font-size="9" font-weight="600">▶ Workflow Runner</text>
  <rect x="94" y="42" width="64" height="18" rx="3" fill="transparent"/>
  <text x="126" y="55" text-anchor="middle" fill="#64748b" font-size="9">Results</text>
  <rect x="162" y="42" width="56" height="18" rx="3" fill="transparent"/>
  <text x="190" y="55" text-anchor="middle" fill="#64748b" font-size="9">Workflow</text>

  <!-- ── LEFT PANEL: Workflow Runner ── -->
  <rect x="0" y="60" width="330" height="370" fill="#0f172a"/>

  <!-- Workflow picker label -->
  <text x="14" y="82" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.3">WORKFLOW</text>
  <!-- Picker dropdown -->
  <rect x="10" y="87" width="300" height="22" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="22" y="102" fill="#e2e8f0" font-size="9">GraphQL Latency Demo</text>
  <text x="294" y="102" fill="#64748b" font-size="10">▾</text>

  <!-- Initial Variables section -->
  <rect x="10" y="118" width="300" height="70" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="20" y="133" fill="#94a3b8" font-size="8" font-weight="600" letter-spacing="0.3">INITIAL VARIABLES</text>
  <line x1="10" y1="137" x2="310" y2="137" stroke="#334155" stroke-width="0.5"/>
  <!-- graphqlUrl variable row -->
  <text x="20" y="158" fill="#94a3b8" font-size="8" font-family="'SF Mono','Fira Code',monospace">graphqlUrl</text>
  <rect x="88" y="148" width="212" height="16" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="96" y="160" fill="#f59e0b" font-size="7.5" font-family="'SF Mono','Fira Code',monospace">localhost:4010/graphql</text>
  <text x="20" y="176" fill="#475569" font-size="7.5">Override endpoint per run — workflow definition unchanged</text>

  <!-- Config section header -->
  <text x="14" y="206" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.3">EXECUTION CONFIG</text>
  <rect x="10" y="211" width="300" height="70" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <!-- Iterations -->
  <text x="20" y="228" fill="#94a3b8" font-size="8">Iterations</text>
  <rect x="70" y="220" width="36" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="88" y="230" text-anchor="middle" fill="#e2e8f0" font-size="8">10</text>
  <!-- Concurrency -->
  <text x="120" y="228" fill="#94a3b8" font-size="8">Concurrency</text>
  <rect x="188" y="220" width="28" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="202" y="230" text-anchor="middle" fill="#e2e8f0" font-size="8">2</text>
  <!-- Think time -->
  <text x="20" y="250" fill="#94a3b8" font-size="8">Think Time</text>
  <rect x="70" y="242" width="44" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="92" y="252" text-anchor="middle" fill="#e2e8f0" font-size="8">200ms</text>
  <text x="20" y="268" fill="#475569" font-size="7.5">Concurrency 2 = 5 batches of 2 parallel GQL requests</text>
  <text x="20" y="278" fill="#475569" font-size="7.5">Think time simulates realistic inter-request pacing</text>

  <!-- Run button -->
  <rect x="10" y="292" width="140" height="24" rx="5" fill="#3b82f6"/>
  <text x="80" y="308" text-anchor="middle" fill="#fff" font-size="10" font-weight="600">▶ Run Workflow</text>

  <!-- Live progress bar (running state) -->
  <rect x="10" y="326" width="300" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
  <rect x="10" y="326" width="210" height="14" rx="3" fill="#1d4ed8" opacity="0.7"/>
  <text x="160" y="337" text-anchor="middle" fill="#fff" font-size="8">7 / 10 iterations · 1.2s</text>
  <!-- Progress label -->
  <text x="14" y="354" fill="#94a3b8" font-size="7.5">Progress</text>
  <text x="170" y="354" fill="#60a5fa" font-size="7.5">● Running</text>

  <!-- Completion banner (finished state below progress) -->
  <rect x="10" y="360" width="300" height="30" rx="5" fill="#14532d" stroke="#22c55e" stroke-width="1"/>
  <text x="75" y="372" fill="#86efac" font-size="8">Workflow completed — 10 requests in 2.34s</text>
  <text x="155" y="383" text-anchor="middle" fill="#22c55e" font-size="8" font-weight="600">View Full Results →</text>

  <!-- Divider between panels -->
  <line x1="335" y1="60" x2="335" y2="430" stroke="#334155" stroke-width="1"/>

  <!-- ── RIGHT PANEL: Results Dashboard ── -->
  <rect x="335" y="60" width="365" height="370" fill="#0f172a"/>

  <!-- Results tab header -->
  <text x="350" y="82" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.3">RESULTS DASHBOARD — Workflow Runs</text>

  <!-- Throughput metric cards -->
  <!-- req/s card -->
  <rect x="340" y="88" width="76" height="44" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="378" y="103" text-anchor="middle" fill="#94a3b8" font-size="7.5">Req/s</text>
  <text x="378" y="120" text-anchor="middle" fill="#60a5fa" font-size="14" font-weight="700">4.3</text>

  <!-- p50 card -->
  <rect x="422" y="88" width="76" height="44" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="460" y="103" text-anchor="middle" fill="#94a3b8" font-size="7.5">p50 latency</text>
  <text x="460" y="120" text-anchor="middle" fill="#22c55e" font-size="14" font-weight="700">24ms</text>

  <!-- p95 card -->
  <rect x="504" y="88" width="76" height="44" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="542" y="103" text-anchor="middle" fill="#94a3b8" font-size="7.5">p95 latency</text>
  <text x="542" y="120" text-anchor="middle" fill="#f59e0b" font-size="14" font-weight="700">41ms</text>

  <!-- Error rate card -->
  <rect x="586" y="88" width="104" height="44" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="638" y="103" text-anchor="middle" fill="#94a3b8" font-size="7.5">Error rate</text>
  <text x="638" y="120" text-anchor="middle" fill="#22c55e" font-size="14" font-weight="700">0%</text>

  <!-- Latency histogram area -->
  <rect x="340" y="140" width="350" height="100" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="350" y="155" fill="#94a3b8" font-size="8" font-weight="600">Latency Distribution</text>
  <!-- Histogram bars (simulated, tallest at ~25ms) -->
  <rect x="348" y="185" width="12" height="40" rx="2" fill="#1d4ed8" opacity="0.7"/>
  <rect x="365" y="165" width="12" height="60" rx="2" fill="#2563eb" opacity="0.8"/>
  <rect x="382" y="158" width="12" height="67" rx="2" fill="#3b82f6"/>
  <rect x="399" y="168" width="12" height="57" rx="2" fill="#2563eb" opacity="0.8"/>
  <rect x="416" y="182" width="12" height="43" rx="2" fill="#1d4ed8" opacity="0.7"/>
  <rect x="433" y="195" width="12" height="30" rx="2" fill="#1e3a8a" opacity="0.6"/>
  <rect x="450" y="210" width="12" height="15" rx="2" fill="#1e3a8a" opacity="0.5"/>
  <!-- Axis labels -->
  <text x="348" y="232" fill="#475569" font-size="7">0ms</text>
  <text x="374" y="232" fill="#475569" font-size="7">20</text>
  <text x="398" y="232" fill="#475569" font-size="7">40</text>
  <text x="422" y="232" fill="#475569" font-size="7">60</text>
  <!-- p50/p95 markers -->
  <line x1="380" y1="156" x2="380" y2="235" stroke="#22c55e" stroke-width="0.8" stroke-dasharray="3,2"/>
  <text x="382" y="244" fill="#22c55e" font-size="7">p50=24ms</text>
  <line x1="415" y1="156" x2="415" y2="235" stroke="#f59e0b" stroke-width="0.8" stroke-dasharray="3,2"/>
  <text x="417" y="244" fill="#f59e0b" font-size="7">p95=41ms</text>

  <!-- Results Explorer section -->
  <rect x="340" y="258" width="350" height="80" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="350" y="273" fill="#94a3b8" font-size="8" font-weight="600">Results Explorer (3-panel modal)</text>
  <!-- Explorer preview: canvas + detail + matrix -->
  <!-- Canvas panel (miniature) -->
  <rect x="346" y="278" width="90" height="50" rx="3" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
  <text x="391" y="291" text-anchor="middle" fill="#60a5fa" font-size="7">Canvas overlay</text>
  <rect x="356" y="295" width="25" height="12" rx="2" fill="#14532d" stroke="#22c55e" stroke-width="0.7"/>
  <text x="368" y="304" text-anchor="middle" fill="#86efac" font-size="6">Q✓</text>
  <line x1="381" y1="301" x2="392" y2="301" stroke="#3b82f6" stroke-width="0.8" marker-end="url(#arr17)"/>
  <rect x="392" y="295" width="25" height="12" rx="2" fill="#14532d" stroke="#22c55e" stroke-width="0.7"/>
  <text x="404" y="304" text-anchor="middle" fill="#86efac" font-size="6">A✓</text>
  <!-- Detail panel (miniature) -->
  <rect x="442" y="278" width="100" height="50" rx="3" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
  <text x="492" y="291" text-anchor="middle" fill="#94a3b8" font-size="7">Detail panel</text>
  <text x="450" y="304" fill="#60a5fa" font-size="6.5">gqlLatency: 28</text>
  <text x="450" y="314" fill="#22c55e" font-size="6.5">$ &lt; 500 → pass</text>
  <text x="450" y="324" fill="#94a3b8" font-size="6.5">latencyMs: 28ms</text>
  <!-- Matrix panel (miniature) -->
  <rect x="548" y="278" width="136" height="50" rx="3" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
  <text x="616" y="291" text-anchor="middle" fill="#94a3b8" font-size="7">Iteration matrix</text>
  <text x="556" y="303" fill="#475569" font-size="6">Iter</text>
  <text x="575" y="303" fill="#475569" font-size="6">GQL Query</text>
  <text x="624" y="303" fill="#475569" font-size="6">Assert</text>
  <text x="556" y="312" fill="#94a3b8" font-size="6">1</text>
  <text x="580" y="312" fill="#22c55e" font-size="6">✓ 24ms</text>
  <text x="628" y="312" fill="#22c55e" font-size="6">✓</text>
  <text x="556" y="321" fill="#94a3b8" font-size="6">2</text>
  <text x="580" y="321" fill="#22c55e" font-size="6">✓ 31ms</text>
  <text x="628" y="321" fill="#22c55e" font-size="6">✓</text>

  <!-- Results Explorer open button -->
  <rect x="340" y="344" width="130" height="20" rx="5" fill="#3b82f6"/>
  <text x="405" y="358" text-anchor="middle" fill="#fff" font-size="9">📊 Results Explorer</text>
  <!-- Export JSON button -->
  <rect x="478" y="344" width="78" height="20" rx="5" fill="transparent" stroke="#3b4a60" stroke-width="1"/>
  <text x="517" y="358" text-anchor="middle" fill="#94a3b8" font-size="9">Export JSON</text>

  <!-- Arrowhead marker -->
  <defs>
    <marker id="arr17" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill="#3b82f6"/>
    </marker>
  </defs>

  <!-- Bottom caption -->
  <rect x="0" y="398" width="700" height="32" rx="0" fill="#0f172a"/>
  <rect x="0" y="398" width="700" height="1" fill="#334155"/>
  <text x="350" y="419" text-anchor="middle" fill="#475569" font-size="9">Protocols → GraphQL → GQL-17 Workflow Runner &amp; Results</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql17-open-runner',
      title: 'Open the Workflow Runner',
      description:
        `You are now in the **Workflow Runner** — the tab that bridges the gap between the Workflow Designer and production CI testing.\n\nIn the Designer, **Quick Test** runs once, shows green/red nodes, and vanishes when you navigate away. The Workflow Runner is its tracked counterpart: every run is **saved with a timestamp**, every variable override is **isolated from the workflow definition**, and every iteration produces a result row in the Results Dashboard. The picker at the top lets you select any workflow you have built.\n\nSelect the **${LESSON17_WF_NAME}** workflow — built in GQL-16 — from the dropdown to load it into the Runner.`,
      highlight: '.workflow-picker',
      preAction: gqlWorkflowRunnerLessonSetup,
      action: async (ctx) => {
        await selectGqlLatencyDemoWorkflow(ctx);
        await ctx.delay(800);
      },
      verify: '.workflow-vars-section',
      pauseAfter: true,
    },

    {
      id: 'gql17-runner-variables',
      title: 'Initial Variables — Override graphqlUrl',
      description:
        `The **Initial Variables** panel shows every variable defined in the selected workflow. **GraphQL Latency Demo** has one — \`graphqlUrl\`, pre-set to \`${GQL_DEMO_HTTP}\` (the Docker test server from GQL-16). The GraphQL Query node uses \`{{graphqlUrl}}\` as its endpoint, so you can point this workflow at staging, production, or another local mock server **without editing the workflow definition**.\n\nOverrides here are applied **per-run** — the same pattern as environment variables for a CI job. Leave the default for this lesson; in production you'd swap the URL to match the target environment.`,
      highlight: '.workflow-vars-section',
      preAction: async (ctx) => {
        await ensureLesson17WorkflowSelected(ctx);
        if (!document.querySelector('.wfp-var-row')) {
          await selectGqlLatencyDemoWorkflow(ctx);
        }
      },
      pauseAfter: true,
    },

    {
      id: 'gql17-config-run',
      title: 'Configure Iterations & Concurrency',
      description:
        `The **Execution Config** section controls how many times the workflow runs and how much load it generates.\n\n- **Iterations: 10** — the workflow executes 10 times in total, producing 10 result rows.\n- **Concurrency: 2** — two workflow instances run in parallel at a time, meaning 5 batches of 2 simultaneous GraphQL requests hit the server.\n- **Think Time: 200ms** — a 200ms pause between batches simulates realistic inter-request pacing and prevents the test from running at maximum possible speed.\n\nConcurrency is especially important for GraphQL because HTTP/2 multiplexing means two concurrent operations may share a single TCP connection. Measuring at concurrency 2 gives you a realistic read on whether connection-sharing causes head-of-line blocking or actually reduces latency.`,
      highlight: '.workflow-runner-config-section',
      preAction: ensureLesson17WorkflowSelected,
      pauseAfter: true,
    },

    {
      id: 'gql17-start-run',
      title: 'Start the Run — Watch Live Progress',
      description:
        `Click **▶ Run Workflow**. The live progress bar counts completed iterations as they finish. Each batch of 2 concurrent runs increments the counter by 2.\n\nWatch the **Console** if you opened it — it streams per-node execution logs: endpoint, HTTP status, response body, latency, and bound variable values (\`gqlLatency=28\`) in real time. After all 10 iterations complete, the **completion banner** appears with total request count and wall-clock duration. The result is immediately persisted to the Results Dashboard — you don't need to do anything to save it.`,
      highlight: '.config-form',
      preAction: ensureLesson17WorkflowSelected,
      action: async (ctx) => {
        await runGqlLatencyWorkflow(ctx);
        await ctx.delay(800);
      },
      verify: '.completion-section',
      pauseAfter: true,
    },

    {
      id: 'gql17-results-dashboard',
      title: 'Results Dashboard — Throughput Overview',
      description:
        `Click **View Full Results →** in the completion banner. The app navigates to the **Results Dashboard** filtered to Workflow Runs and auto-selects the run you just executed.\n\nThe four metric cards at the top answer the most important questions immediately:\n- **Req/s** — throughput achieved at your concurrency setting\n- **p50 latency** — median performance (what most requests experience)\n- **p95 latency** — 95th-percentile performance (the slowest 1-in-20 request)\n- **Error rate** — 0% means all 10 iterations passed the GraphQL Assert node\n\nThe **latency histogram** below the cards reveals the shape of the distribution. A tight, unimodal histogram means consistent performance. A bimodal distribution (two humps) suggests occasional cold-start delays or connection pool exhaustion — both invisible in p50 alone.`,
      highlight: '.results-run-filter-tabs',
      preAction: ensureLesson17WorkflowRun,
      action: async (ctx) => {
        await ensureLesson17ResultsOpen(ctx);
        await ctx.delay(800);
      },
      verify: '.results-run-filter-tabs',
      pauseAfter: true,
    },

    {
      id: 'gql17-node-filter',
      title: 'Filter Results by Node',
      description:
        `The **Results** view tabs let you pivot between **Overview** (aggregate metrics) and **Request Details** (per-iteration rows grouped by node).\n\nSwitch to **Request Details** to see each node's output across all 10 iterations. For the GraphQL Latency Demo, there is only one HTTP-producing node — **GraphQL Query** — so filtering is trivial. In multi-node workflows (GQL-18: Mutation → Query → Assert), filtering to a single node isolates whether the mutation, the read-back query, or the assert is slow.\n\nClick any iteration row to open the **Response Detail** modal: it shows the exact HTTP request body (the GraphQL operation), the raw response, the latency breakdown, and the extracted \`gqlLatency\` variable value that the Assert node evaluated against.`,
      highlight: '.results-view-tabs',
      preAction: ensureLesson17ResultsOpen,
      pauseAfter: true,
    },

    {
      id: 'gql17-results-explorer',
      title: 'Open Results Explorer',
      description:
        `Click **📊 Results Explorer** in the Results Dashboard header. A full-screen modal opens with three panels:\n\n1. **Canvas** (left) — the same workflow diagram you built in GQL-16, now overlaid with pass/fail badges and execution-time readings for each node across all iterations.\n2. **Detail Panel** (right) — click any node to see its per-iteration variable snapshot: \`gqlLatency\` value, assertion result, request/response bodies.\n3. **Iteration Matrix** (bottom) — a grid of iteration × node showing pass/fail at a glance. Green means the assertion passed for that iteration; red means it failed. Clicking any cell navigates the canvas to that iteration.\n\nThis three-panel layout makes it possible to answer in seconds: "Which iteration caused the regression, and what variable value triggered the assertion failure?"`,
      highlight: 'button[title="Explore execution results"]',
      preAction: ensureLesson17ResultsOpen,
      action: async (ctx) => {
        const explorerBtn = document.querySelector<HTMLElement>('button[title="Explore execution results"]');
        if (explorerBtn) {
          explorerBtn.click();
          await ctx.delay(600);
        }
      },
      verify: '.results-explorer-diagram',
      pauseAfter: true,
    },

    {
      id: 'gql17-canvas-overlay',
      title: 'Execution State Overlay — Node-Level Latency',
      description:
        `The **canvas panel** shows the same Start → GraphQL Query → GraphQL Assert → End diagram, now annotated with execution data from all iterations:\n\n- Each node displays its **aggregate pass/fail count** (e.g. "10/10 passed")\n- Hovering a node opens a **popover** showing per-node statistics: mean latency, p95 latency, pass count, fail count\n- The **GraphQL Query** node's popover will show timing consistent with the p50 card in the dashboard — confirming the histogram is measuring exactly this node's HTTP round-trip\n- The **GraphQL Assert** node shows a trivial execution time (< 1ms) because assertion evaluation is CPU-only with no network call\n\nThis overlay is the fastest way to identify which node in a long workflow is consuming the most wall time.`,
      highlight: '.results-explorer-diagram',
      preAction: ensureLesson17ResultsOpen,
      pauseAfter: true,
    },

    {
      id: 'gql17-bottleneck',
      title: 'Bottleneck Identification',
      description:
        `The **Iteration Matrix** at the bottom of the Results Explorer shows each iteration × node combination. For the GraphQL Latency Demo:\n\n- **GraphQL Query** — all rows show a latency value (e.g. 22ms, 28ms, 31ms) plus pass status from the Assert node\n- **GraphQL Assert** — all rows show the assertion result (pass/fail) in under 1ms\n\nThe bottleneck is always **GraphQL Query** — the only node that makes a real HTTP request. The Assert node is CPU-only and never contributes meaningfully to latency.\n\nIn a real mutation → query → assert chain (GQL-18), the matrix lets you compare mutation latency vs read-back latency side by side. If the mutation takes 200ms and the query takes 5ms, the bottleneck is clearly the write path — and you know exactly which node to optimize without guessing.`,
      highlight: '.results-explorer-diagram',
      preAction: ensureLesson17ResultsOpen,
      pauseAfter: true,
    },

    {
      id: 'gql17-export-results',
      title: 'Export Results for CI',
      description:
        `Close the Results Explorer and click **Export JSON** in the Results Dashboard header. The run trace is downloaded as a JSON file containing: run metadata (workflow name, timestamp, concurrency, iterations), per-node latency aggregates (p50, p95, p99, error rate), and per-iteration request/response pairs.\n\nThis JSON file is the bridge between the visual Workflow Runner and a CI/CD pipeline:\n- **Threshold assertions in CI:** Load the JSON in a test script and fail the pipeline if \`p95Latency > 100\`\n- **Historical comparison:** Archive files by build SHA to track performance over time\n- **Audit trail:** The file contains the exact GraphQL operation that ran, so regressions are fully reproducible from the artifact alone\n\nThe Workflow Runner turns a visual workflow from a developer convenience into an **enforceable performance contract**.`,
      highlight: '.results-run-filter-tabs',
      preAction: ensureLesson17ResultsOpen,
      pauseAfter: true,
    },
  ],
};
