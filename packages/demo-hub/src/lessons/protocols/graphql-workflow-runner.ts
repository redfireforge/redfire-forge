/** Lesson GQL-17: Workflow Runner & Results */
import type { DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { WFR } from '@shared/selectors/wfr';
import { RES } from '@shared/selectors/res';
import { REX } from '@shared/selectors/rex';
import { GQL_DEMO_HTTP } from './graphql-lesson-helpers/core';
import {
  LESSON17_WF_NAME,
  LESSON17_DOCKER_ENDPOINT,
  LESSON17_DEMO_ITERATIONS,
  LESSON17_DEMO_CONCURRENCY,
  selectGqlLatencyDemoWorkflow,
  runGqlLatencyWorkflow,
  ensureLesson17WorkflowSelected,
  ensureLesson17RunnerDemoConfig,
  ensureLesson17OnResultsTab,
  openLesson17ResultsFromCompletionBanner,
  openLesson17RequestDetailsTab,
  closeLesson17ResultsExplorerIfOpen,
  openLesson17ResultsOverviewTab,
  ensureLesson17MetricsCardsReady,
  scrollLesson17MetricsCardsIntoView,
  prepareLesson17ResultsExplorerButton,
  tourLesson17MetricsCards,
  tourLesson17ResultsExplorer,
  gqlWorkflowRunnerLessonSetup,
  gqlWorkflowRunnerLessonCleanup,
} from './graphql-lesson-helpers/lesson17-workflow-runner';

export const gqlWorkflowRunnerLesson: DemoLesson = {
  id: 'gql-workflow-runner',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Workflow Runner & Results',
  description:
    'Graduate the GraphQL Latency Demo workflow from Quick Test to the Workflow Runner — configure iterations, observe live progress, and drill into the Results Explorer for node-level analysis.',
  estimatedMinutes: 5,
  initialTab: 'workflow-runner',
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
      title: 'Select GraphQL Latency Demo',
      description:
        `You are in the Workflow Runner — tracked test executions that are saved to Results (unlike Quick Test in the Designer).\n\n` +
        `Open the **Workflow** dropdown and select **${LESSON17_WF_NAME}** (from GQL-16). Initial Variables and Execution Config appear below the picker.`,
      highlight: WF.WORKFLOW_SELECT,
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
        `The **Initial Variables** panel lists workflow-level defaults you can override for this run only. **${LESSON17_WF_NAME}** defines one variable — \`graphqlUrl\` — pre-filled with \`${GQL_DEMO_HTTP}\`.\n\n` +
        `The GraphQL Query node references \`{{graphqlUrl}}\` as its endpoint, so you can point this run at staging or another mock server **without editing the workflow**. Leave the default for this lesson.`,
      highlight: '.workflow-vars-section',
      preAction: async (ctx) => {
        await ensureLesson17WorkflowSelected(ctx);
        if (!document.querySelector('.wfp-var-row')) {
          await selectGqlLatencyDemoWorkflow(ctx, { quiet: true });
        }
      },
      pauseAfter: true,
    },

    {
      id: 'gql17-config-run',
      title: 'Set Iterations & Concurrency',
      description:
        `In **Execution Config**, the demo sets **Iterations** to **${LESSON17_DEMO_ITERATIONS}** and **Concurrency** to **${LESSON17_DEMO_CONCURRENCY}** — enough iterations to populate the Results Dashboard without a long wait.\n\n` +
        `- **Iterations** — how many times the full workflow runs\n` +
        `- **Concurrency** — how many instances run in parallel (1 = sequential, easy to follow in the progress bar)\n\n` +
        `For production load tests you might use 10+ iterations at concurrency 2–4. Here we keep it short so you can watch each iteration complete.`,
      highlight: '.workflow-runner-config-section .resilience-field:nth-child(2)',
      preAction: ensureLesson17WorkflowSelected,
      action: async (ctx) => {
        await ensureLesson17RunnerDemoConfig(ctx);
        await ctx.delay(800);
      },
      pauseAfter: true,
    },

    {
      id: 'gql17-start-run',
      title: 'Run the Workflow Once',
      description:
        `Click **▶ Run Workflow**. The progress bar advances as each iteration completes — watch it count up to **${LESSON17_DEMO_ITERATIONS}**.\n\n` +
        `Each iteration executes **Start → GraphQL Query → GraphQL Assert → End** against the Docker server. When finished, the green **completion banner** shows total requests and wall-clock time. The run is **automatically saved** — no extra Save step.`,
      highlight: WFR.RUN_BTN,
      preAction: ensureLesson17RunnerDemoConfig,
      action: async (ctx) => {
        if (!document.querySelector('.completion-section')) {
          await ensureLesson17WorkflowSelected(ctx);
          await runGqlLatencyWorkflow(ctx);
        }
        await ctx.delay(800);
      },
      verify: '.completion-section',
      pauseAfter: true,
    },

    {
      id: 'gql17-view-results',
      title: 'Open the Results Dashboard',
      description:
        `Click **View Full Results →** in the completion banner. The app switches to the **Results** tab and selects the run you just completed.\n\n` +
        `This is the hand-off from Runner to Results — the same navigation you would use after any production load test.`,
      highlight: '.completion-section .btn-primary',
      preAction: ensureLesson17RunnerDemoConfig,
      action: async (ctx) => {
        await openLesson17ResultsFromCompletionBanner(ctx);
        await ctx.delay(800);
      },
      verify: '.results-run-filter-tabs',
      pauseAfter: true,
    },

    {
      id: 'gql17-results-dashboard',
      title: 'Throughput & Latency Cards',
      description:
        `The **headline metric cards** at the top summarize the run in two rows:\n\n` +
        `- **Row 1** — **TPS** (throughput), avg/min/max response time\n` +
        `- **Row 2** — **P50 / P95 / P99** latency, **Error rate** (should be **0%** when all Assert nodes pass), total duration, and request count\n\n` +
        `Below the cards: **Workflow Execution Summary** — iteration chart, per-step metrics (**GraphQL Query**, **GraphQL Assert**), and the latency histogram.`,
      // Latency row is the teaching payoff (second screen). preAction pins scroll so
      // reading-phase auto-scroll cannot shove cards under the sticky Results header.
      highlight: RES.METRICS_LATENCY_ROW,
      preAction: async (ctx) => {
        await openLesson17ResultsOverviewTab(ctx);
        await ensureLesson17MetricsCardsReady(ctx);
        await scrollLesson17MetricsCardsIntoView(ctx);
      },
      action: async (ctx) => {
        await tourLesson17MetricsCards(ctx);
      },
      verify: RES.METRICS_LATENCY_ROW,
      pauseAfter: true,
    },

    {
      id: 'gql17-request-details',
      title: 'Request Details — Per-Iteration Rows',
      description:
        `Click the **Request Details** tab (next to **Overview**). Each row is one HTTP-producing step from one iteration — for this workflow, rows from **GraphQL Query** show latency and status.\n\n` +
        `Click any row to open **Response Detail**: the GraphQL operation sent, raw response body, and the \`gqlLatency\` value the Assert node evaluated.`,
      highlight: RES.REQUEST_DETAILS_TAB,
      preAction: ensureLesson17OnResultsTab,
      action: async (ctx) => {
        await openLesson17RequestDetailsTab(ctx);
        await ctx.delay(800);
      },
      verify: RES.REQUEST_DETAILS_TAB,
      pauseAfter: true,
    },

    {
      id: 'gql17-results-explorer',
      title: 'Results Explorer — Canvas, Detail & Matrix',
      description:
        `Click **📊 Results Explorer** in the header, then **Fit view** on the canvas toolbar so the full **Start → GraphQL Query → GraphQL Assert → End** chain is centered on screen.\n\n` +
        `Toggle **🖥 Console** — it opens on **Aggregate** first (pass rate, timing table). The demo then selects **iteration #1** so you see the **detailed log**: Start → GraphQL Query → GraphQL Assert → End with per-node timings. Requires **Standard** trace (set in step 3); **Minimal** only shows failures.\n\n` +
        `The modal has three panels:\n\n` +
        `1. **Canvas** — your GQL-16 diagram with pass/fail badges and per-node timing across all iterations\n` +
        `2. **Detail panel** — click a node to see variable snapshots (\`gqlLatency\`) and assertion results for that iteration\n` +
        `3. **Iteration matrix** — a grid of iteration × node; **GraphQL Query** rows show latency, **GraphQL Assert** rows show pass/fail\n\n` +
        `For this two-node chain the bottleneck is always **GraphQL Query** (the only HTTP step). In longer workflows (GQL-18) the matrix compares write vs read latency side by side.`,
      highlight: RES.RESULTS_EXPLORER_BTN,
      preAction: async (ctx) => {
        await prepareLesson17ResultsExplorerButton(ctx);
      },
      action: async (ctx) => {
        await tourLesson17ResultsExplorer(ctx);
      },
      verify: REX.CONSOLE_BODY,
      pauseAfter: true,
    },

    {
      id: 'gql17-export-results',
      title: 'Export JSON for CI',
      description:
        `Close the Results Explorer, then click **Export JSON** in the dashboard header. The file contains run metadata (workflow name, iterations, concurrency), per-node latency aggregates, and per-iteration request/response pairs.\n\n` +
        `Use it in CI to fail a build when \`p95Latency\` exceeds a threshold, or archive by build SHA to track regressions over time.`,
      highlight: RES.EXPORT_JSON_BTN,
      preAction: ensureLesson17OnResultsTab,
      action: async (ctx) => {
        await closeLesson17ResultsExplorerIfOpen(ctx);
        await ctx.delay(800);
      },
      pauseAfter: true,
    },
  ],
};