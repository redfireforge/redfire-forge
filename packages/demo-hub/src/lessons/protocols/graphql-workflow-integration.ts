/** Lesson GQL-16: Workflow Integration */
import type { DemoLesson } from '../../types';
import { GQL, WF } from '@shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  LESSON11_LATENCY_VAR,
  LESSON11_GRAPHQL_URL_VAR,
  LESSON11_PASS_THRESHOLD_MS,
  LESSON11_WF_NAME,
  ensureLesson11AssertNodeAdded,
  ensureLesson11ConsoleOpen,
  ensureLesson11QueryNodeAdded,
  ensureLesson11WorkflowCreated,
  ensureLesson11WorkflowVariablesConfigured,
  demonstrateLesson11AssertConfigured,
  demonstrateLesson11ConsoleOpen,
  demonstrateLesson11DebugRun,
  demonstrateLesson11ObserveFailure,
  demonstrateLesson11ObservePass,
  demonstrateLesson11PassExec,
  demonstrateLesson11QueryConfigured,
  demonstrateLesson11TightenThreshold,
  prepareGql11AssertConfigReading,
  prepareGql11AssertNodeReading,
  prepareGql11ConsoleReading,
  prepareGql11DebugReading,
  prepareGql11ObserveFailureReading,
  prepareGql11ObservePassReading,
  prepareGql11QueryConfigReading,
  prepareGql11QueryNodeReading,
  prepareGql11TightenThresholdModal,
  gqlWorkflowIntegrationLessonCleanup,
  gqlWorkflowIntegrationLessonSetup,
} from './graphql-lesson-helpers';

export const gqlWorkflowIntegrationLesson: DemoLesson = {
  id: 'gql-workflow-integration',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Workflow Integration',
  description:
    'Build a GraphQL Query + Assert workflow in the Designer, bind latency output, watch live console logs, and diagnose failures with step-through Debug Mode.',
  estimatedMinutes: 6,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'workflow-runner'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlWorkflowIntegrationLessonSetup,
  cleanup: gqlWorkflowIntegrationLessonCleanup,

  concept: {
    title: 'GraphQL Workflow Integration — From One-Off Query to Automated Test',
    body: `Every time you run a query in GraphQL Studio you are performing a **one-off, manual check**. The Workflow Designer lets you turn that same query into a **repeatable, automated integration test** that can run on a schedule, in CI/CD, or as part of a multi-step sequence. This lesson shows the complete path from blank canvas to a passing + failing latency guard.

**Why a GraphQL Query node instead of a generic HTTP node?**
The generic HTTP node sends raw bytes — it has no awareness of GraphQL semantics. The **GraphQL Query** node understands operation type (Q / M / S), validates the query at config time, and exposes per-field output bindings like \`latencyMs\`, \`responseBody\`, and \`errorCount\` directly in its Output tab. Downstream nodes receive typed, named values — not raw JSON you have to parse yourself.

**Why Output binding is the critical feature?**
Binding \`latencyMs\` to a workflow variable (\`${LESSON11_LATENCY_VAR}\`) is what makes downstream assertion possible. Without binding, each node is an isolated island. With binding, every downstream node — Assert, conditional branch, log node — can reference the live value from this execution and act on it.

**Why GraphQL Assert instead of a generic Assert?**
The **GraphQL Assert** node always displays the original GraphQL operation that produced the value being asserted. When an assertion fails you immediately see *which query* was running, not just a bare number. That context collapses the triage loop from minutes to seconds.

**Why Debug Mode?**
Quick Test runs the workflow atomically — all nodes execute, you see the final state. **Debug Mode** runs it **step by step**: the workflow pauses after each node, showing intermediate variable values before the next node starts. This makes it trivial to pinpoint which node produced an unexpected value when a multi-node workflow fails.`,
    keyTerms: [
      {
        term: 'Output binding',
        definition:
          'Maps a GraphQL response field (e.g. `latencyMs`) to a named workflow variable that every downstream node can reference.',
      },
      {
        term: 'Source variable',
        definition:
          'On a GraphQL Assert node, the workflow variable holding the JSON value to assert against — here: `gqlLatency` bound from the query node\'s Output tab.',
      },
      {
        term: 'Quick Test',
        definition:
          'Runs the full workflow once in the Designer — nodes turn green (pass) or red (fail) on the canvas with execution time badges.',
      },
      {
        term: 'less_than',
        definition:
          'Field operator `<` — passes when the numeric value at the JSONPath is strictly less than the configured threshold.',
      },
      {
        term: 'Debug Mode',
        definition:
          'Step-by-step execution: the workflow pauses after each node, showing live intermediate variable values so you can triage assertion failures node by node.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- Window chrome -->
  <rect width="700" height="430" rx="10" fill="#0f172a" stroke="#3b4a60" stroke-width="1.5"/>
  <rect width="700" height="32" rx="10" fill="#1e293b"/>
  <rect y="22" width="700" height="10" fill="#1e293b"/>
  <circle cx="20" cy="16" r="5" fill="#ef4444" opacity="0.8"/>
  <circle cx="38" cy="16" r="5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="56" cy="16" r="5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="21" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="500">Workflow Designer — GraphQL Latency Demo</text>

  <!-- Toolbar -->
  <rect y="32" width="700" height="34" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <!-- Toolbar workflow name badge -->
  <rect x="12" y="40" width="140" height="18" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="82" y="53" text-anchor="middle" fill="#94a3b8" font-size="9.5">GraphQL Latency Demo</text>
  <!-- Save button -->
  <rect x="165" y="40" width="44" height="18" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="187" y="53" text-anchor="middle" fill="#94a3b8" font-size="9">Save</text>
  <!-- Quick Test button (primary) -->
  <rect x="542" y="39" width="84" height="20" rx="5" fill="#3b82f6"/>
  <text x="556" y="53" fill="#fff" font-size="9">▶ Quick Test</text>
  <!-- Debug button (outline) -->
  <rect x="632" y="39" width="56" height="20" rx="5" fill="transparent" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="660" y="53" text-anchor="middle" fill="#3b82f6" font-size="9">Debug</text>

  <!-- Left palette -->
  <rect x="0" y="66" width="130" height="330" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <text x="65" y="85" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.5">ACTIONS</text>
  <!-- GraphQL Query palette block (highlighted) -->
  <rect x="10" y="92" width="110" height="32" rx="5" fill="#312e81" stroke="#6366f1" stroke-width="1.5"/>
  <text x="65" y="108" text-anchor="middle" fill="#a5b4fc" font-size="9" font-weight="600">GraphQL Query</text>
  <text x="65" y="119" text-anchor="middle" fill="#818cf8" font-size="8">Q / M / S node</text>
  <!-- GraphQL Assert palette block -->
  <text x="65" y="145" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.5">LOGIC</text>
  <rect x="10" y="152" width="110" height="32" rx="5" fill="#14532d" stroke="#22c55e" stroke-width="1"/>
  <text x="65" y="168" text-anchor="middle" fill="#86efac" font-size="9" font-weight="600">GraphQL Assert</text>
  <text x="65" y="179" text-anchor="middle" fill="#6ee7b7" font-size="8">Assertion node</text>

  <!-- Canvas area -->
  <rect x="130" y="66" width="570" height="300" fill="#0f172a"/>
  <!-- Grid dots -->
  <pattern id="grid16" x="130" y="66" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="10" cy="10" r="0.8" fill="#1e2d45" opacity="0.6"/>
  </pattern>
  <rect x="130" y="66" width="570" height="300" fill="url(#grid16)"/>

  <!-- ── WORKFLOW NODES ── -->

  <!-- Start node -->
  <rect x="152" y="170" width="60" height="38" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="182" y="193" text-anchor="middle" fill="#93c5fd" font-size="10" font-weight="600">Start</text>

  <!-- Arrow: Start → Query -->
  <line x1="212" y1="189" x2="258" y2="189" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr16)"/>

  <!-- GraphQL Query node (green — passed) -->
  <rect x="258" y="154" width="126" height="70" rx="8" fill="#14532d" stroke="#22c55e" stroke-width="2"/>
  <text x="321" y="174" text-anchor="middle" fill="#86efac" font-size="10" font-weight="700">GraphQL Query</text>
  <text x="321" y="187" text-anchor="middle" fill="#6ee7b7" font-size="8">query { health }</text>
  <text x="321" y="199" text-anchor="middle" fill="#94a3b8" font-size="7.5">http://localhost:4010/graphql</text>
  <!-- Pass badge -->
  <rect x="356" y="155" width="26" height="14" rx="4" fill="#22c55e"/>
  <text x="369" y="165" text-anchor="middle" fill="#fff" font-size="7.5" font-weight="700">✓ 28ms</text>
  <!-- Output binding annotation -->
  <line x1="321" y1="224" x2="321" y2="237" stroke="#6366f1" stroke-width="1" stroke-dasharray="3,2"/>
  <rect x="250" y="237" width="142" height="16" rx="3" fill="#1e1b4b" stroke="#4338ca" stroke-width="0.8"/>
  <text x="321" y="248" text-anchor="middle" fill="#a5b4fc" font-size="8">latencyMs → gqlLatency</text>

  <!-- Arrow: Query → Assert -->
  <line x1="384" y1="189" x2="432" y2="189" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr16)"/>

  <!-- GraphQL Assert node (red — failed with 1ms threshold) -->
  <rect x="432" y="154" width="126" height="70" rx="8" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
  <text x="495" y="174" text-anchor="middle" fill="#fca5a5" font-size="10" font-weight="700">GraphQL Assert</text>
  <text x="495" y="187" text-anchor="middle" fill="#f87171" font-size="8">$ &lt; 1ms</text>
  <text x="495" y="199" text-anchor="middle" fill="#94a3b8" font-size="7.5">source: gqlLatency</text>
  <!-- Fail badge -->
  <rect x="530" y="155" width="26" height="14" rx="4" fill="#ef4444"/>
  <text x="543" y="165" text-anchor="middle" fill="#fff" font-size="7.5" font-weight="700">✗ FAIL</text>
  <!-- Failure tooltip -->
  <rect x="440" y="132" width="110" height="18" rx="3" fill="#7f1d1d" stroke="#ef4444" stroke-width="0.8"/>
  <text x="495" y="144" text-anchor="middle" fill="#fca5a5" font-size="7.5">28 is not &lt; 1 — threshold too tight</text>

  <!-- Arrow: Assert → End -->
  <line x1="558" y1="189" x2="600" y2="189" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#arr16-red)"/>

  <!-- End node -->
  <rect x="600" y="170" width="60" height="38" rx="8" fill="#1e293b" stroke="#3b4a60" stroke-width="1.5"/>
  <text x="630" y="193" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="600">End</text>

  <!-- Arrowhead markers -->
  <defs>
    <marker id="arr16" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="arr16-red" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444"/>
    </marker>
  </defs>

  <!-- Console panel (docked, collapsed) -->
  <rect x="130" y="366" width="570" height="30" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <!-- Console badge -->
  <rect x="140" y="373" width="56" height="16" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="168" y="385" text-anchor="middle" fill="#60a5fa" font-size="8.5" font-weight="600">Console ●</text>
  <!-- Console log excerpt -->
  <text x="210" y="381" fill="#6ee7b7" font-size="7.5">[node:graphqlQuery]</text>
  <text x="320" y="381" fill="#94a3b8" font-size="7.5">POST 200 · 28ms → gqlLatency=28</text>
  <text x="530" y="381" fill="#f87171" font-size="7.5">[FAIL] 28 ≮ 1</text>

  <!-- Bottom caption -->
  <rect x="0" y="396" width="700" height="34" rx="0" fill="#0f172a"/>
  <rect x="0" y="396" width="700" height="1" fill="#334155"/>
  <text x="350" y="418" text-anchor="middle" fill="#475569" font-size="9">Protocols → GraphQL → GQL-16 Workflow Integration</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql11-create',
      title: 'Create a Blank Workflow',
      description:
        `Click **+ New** → **Blank Workflow**. Name it **${LESSON11_WF_NAME}** and confirm.\n\n` +
        `A blank canvas appears with Start and End already placed. The Blocks Palette on the left groups nodes into Actions, Logic, and Triggers — GraphQL Query lives under Actions; GraphQL Assert under Logic.`,
      highlight: WF.SIDEBAR_NEW_BTN,
      preAction: gqlWorkflowIntegrationLessonSetup,
      action: async (ctx) => {
        await ensureLesson11WorkflowCreated(ctx);
      },
      verify: WF.CANVAS,
      pauseAfter: true,
    },

    {
      id: 'gql11-workflow-variables',
      title: 'Define the graphqlUrl Variable',
      description:
        `Open **Variables** in the Designer toolbar. In the Workflow Variables modal, add \`${LESSON11_GRAPHQL_URL_VAR}\` = \`${GQL_DEMO_HTTP}\` and click **Save**.\n\n` +
        `These defaults are available to every step as \`{{name}}\` placeholders. Defining graphqlUrl here keeps the Query endpoint environment-agnostic (\`${GQL_DEMO_VAR}\`) so the Workflow Runner can override the URL per run without editing the canvas.`,
      highlight: WF.VARIABLES_BTN,
      preAction: ensureLesson11WorkflowCreated,
      action: async (ctx) => {
        await ensureLesson11WorkflowVariablesConfigured(ctx);
      },
      verify: WF.CANVAS,
      pauseAfter: true,
    },

    {
      id: 'gql11-query-node',
      title: 'Add GraphQL Query Node',
      description:
        `In the Blocks palette, search for Graph, then click **GraphQL Query** under Actions. Wire Start → GraphQL Query.\n\n` +
        `Why a dedicated GraphQL Query node instead of a generic HTTP node? The GraphQL node understands operation type, validates at config time, and exposes typed output bindings like \`latencyMs\` in its Output tab — no hand-crafted JSON envelope or custom extraction.`,
      highlight: WF.PAL_GQL_QUERY,
      preAction: prepareGql11QueryNodeReading,
      action: async (ctx) => {
        await ensureLesson11QueryNodeAdded(ctx);
      },
      verify: GQL.WF_CANVAS_QUERY_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-config-query',
      title: 'Configure the Query & Bind Output',
      description:
        `Double-click the GraphQL Query node. On Operation, set the endpoint to \`${GQL_DEMO_VAR}\` and the query to \`query { health }\`.\n\n` +
        `Then open the **Output** tab — click **+ Add**, select \`latencyMs\`, and name the variable \`${LESSON11_LATENCY_VAR}\`. Save.\n\n` +
        `That binding makes \`${LESSON11_LATENCY_VAR}\` available to every downstream node. Without it, each node is an isolated island; with it, Assert can gate on measured latency.`,
      // Open panel in preAction; spotlight Endpoint (not the empty Query editor / panel bg).
      highlight: GQL.WF_ENDPOINT_INPUT,
      preAction: prepareGql11QueryConfigReading,
      action: async (ctx) => {
        await demonstrateLesson11QueryConfigured(ctx);
      },
      verify: GQL.WF_CANVAS_QUERY_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-assert-node',
      title: 'Add GraphQL Assert Node',
      description:
        `Search the palette for Assert, then click **GraphQL Assert** under Logic. Connect GraphQL Query → GraphQL Assert → End.\n\n` +
        `Unlike a generic Assert, GraphQL Assert always shows the original GraphQL operation that produced the value — so a failure points you at the causal query, not just a bare number.`,
      highlight: WF.PAL_GQL_ASSERT,
      preAction: prepareGql11AssertNodeReading,
      action: async (ctx) => {
        await ensureLesson11AssertNodeAdded(ctx);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-configure-assert',
      title: 'Configure Assert Source & Latency Rule',
      description:
        `Open the GraphQL Assert node. On the **Source** tab, set **Source variable** to \`${LESSON11_LATENCY_VAR}\` (bound from the Query Output tab) — a live runtime value from each run, not a hardcoded number.\n\n` +
        `Then open **Assertions**, click **+ Add**, and set JSONPath \`$\`, operator \`<\` (\`less_than\`), expected \`${LESSON11_PASS_THRESHOLD_MS}\`, description "Latency under ${LESSON11_PASS_THRESHOLD_MS}ms". Save.\n\n` +
        `\`$\` means "the source value itself." ${LESSON11_PASS_THRESHOLD_MS}ms is a generous local-dev threshold that still catches multi-second regressions.`,
      // Source tab opened in preAction — reading spotlight starts on the variable control.
      highlight: WF.WF_GQL_ASSERT_SOURCE,
      preAction: prepareGql11AssertConfigReading,
      action: async (ctx) => {
        await demonstrateLesson11AssertConfigured(ctx, LESSON11_PASS_THRESHOLD_MS);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-console',
      title: 'Open the Console Before Running',
      description:
        `Click **Console** in the Designer status bar. The log panel opens floating on the left so canvas nodes stay visible.\n\n` +
        `Open it **before** Quick Test — the Console streams live per-node logs. Opening it after a run shows an empty panel; completed entries are not buffered for late readers.`,
      highlight: WF.CONSOLE_BADGE,
      preAction: prepareGql11ConsoleReading,
      action: async (ctx) => {
        await demonstrateLesson11ConsoleOpen(ctx);
      },
      verify: WF.CONSOLE,
      pauseAfter: true,
    },

    {
      id: 'gql11-run-pass-exec',
      title: 'Quick Test — Run the Workflow',
      description:
        `Click **Quick Test** (▶ in the toolbar). Each node runs in sequence and logs stream into the Console.\n\n` +
        `Against the local Docker server the query usually finishes well under ${LESSON11_PASS_THRESHOLD_MS}ms. The next step shows the green pass badges on the canvas.`,
      highlight: WF.QUICK_TEST_BTN,
      preAction: ensureLesson11ConsoleOpen,
      action: async (ctx) => {
        await demonstrateLesson11PassExec(ctx);
      },
      verify: WF.EXEC_SUMMARY,
      pauseAfter: true,
    },

    {
      id: 'gql11-observe-pass',
      title: 'Both Nodes Pass',
      description:
        'Watch the canvas: GraphQL Query and GraphQL Assert turn **green** with execution-time badges. Click a node for input → output detail in the sidebar.\n\n' +
        'This is a healthy baseline — CI should look like this before you tighten thresholds or add more nodes.',
      highlight: GQL.WF_CANVAS_QUERY_NODE,
      preAction: prepareGql11ObservePassReading,
      action: async (ctx) => {
        await demonstrateLesson11ObservePass(ctx);
      },
      verify: GQL.WF_CANVAS_QUERY_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-tighten-threshold',
      title: 'Tighten the Assertion Threshold',
      description:
        `Re-open GraphQL Assert and change the expected value from ${LESSON11_PASS_THRESHOLD_MS} to **1** ms — too tight for a local Docker server. Save.\n\n` +
        'This step only configures the assertion. The next step re-runs Quick Test and shows the failed Assert node.',
      highlight: GQL.WF_ASSERT_EXPECTED,
      preAction: prepareGql11TightenThresholdModal,
      action: async (ctx) => {
        await demonstrateLesson11TightenThreshold(ctx);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-observe-failure',
      title: 'Assert Node Fails',
      description:
        'Click **Quick Test** again with the 1ms threshold. GraphQL Query stays green (HTTP succeeded), but GraphQL Assert turns **red** — latency is not < 1ms.\n\n' +
        'Watch the **Console** for the failed assertion, actual value, expected threshold, and the GraphQL operation that produced it.',
      highlight: WF.QUICK_TEST_BTN,
      preAction: prepareGql11ObserveFailureReading,
      action: async (ctx) => {
        await demonstrateLesson11ObserveFailure(ctx);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-debug-mode',
      title: 'Step Through with Debug Mode',
      description:
        `Click **Debug** (next to Quick Test). The workflow pauses before each node — use **Step** to advance one node at a time and watch variables update between pauses.\n\n` +
        'Use Debug when Quick Test shows a red node but the root cause may be earlier. Stepping GraphQL Query binds `gqlLatency`; stepping GraphQL Assert evaluates the 1ms threshold and fails — data flow becomes obvious node by node.',
      highlight: WF.DEBUG_BTN,
      preAction: prepareGql11DebugReading,
      action: async (ctx) => {
        await demonstrateLesson11DebugRun(ctx);
      },
      verify: WF.CANVAS,
      pauseAfter: true,
    },
  ],
};
