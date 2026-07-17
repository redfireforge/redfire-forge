/** Lesson GQL-15: Batch Execution */
import type { DemoLesson } from '../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
  LESSON15_ERROR_QUERY,
  demonstrateLesson15AddSecondTab,
  demonstrateLesson15BatchResults,
  demonstrateLesson15BatchResponseSlice,
  demonstrateLesson15EnableBatch,
  demonstrateLesson15OpenHistory,
  demonstrateLesson15PartialError,
  demonstrateLesson15RunBatch,
  demonstrateLesson15SelectBatchTabs,
  demonstrateLesson15WriteQueries,
  ensureLesson15IntroReady,
  ensureLesson15ReadyToExecute,
  gqlBatchLessonCleanup,
  gqlBatchLessonSetup,
  prepareGql15BatchSelectReading,
  prepareGql15BatchResultsReading,
  prepareGql15BatchResponseSliceReading,
  prepareGql15AddTabReading,
  prepareGql15WriteQueriesReading,
  prepareGql15EnableBatchReading,
  prepareGql15ExportBatchReading,
  prepareGql15PartialErrorReading,
} from './graphql-lesson-helpers';

export const gqlBatchExecutionLesson: DemoLesson = {
  id: 'gql-batch-execution',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Batch Execution',
  description:
    'Send multiple GraphQL operations in a single HTTP request and receive a combined response array — ideal for integration tests and dashboard pre-fetching.',
  estimatedMinutes: 6,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
  /** Two demo tab slots for batch parity teaching (§11.0). */
  tabBudget: 2,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d --build',
  tag: '🐳 Docker',

  setup: gqlBatchLessonSetup,
  cleanup: gqlBatchLessonCleanup,

  concept: {
    title: 'Batch Execution — N Operations, One HTTP Round-Trip',
    body: `GraphQL batch execution sends an **array** of operations in a single HTTP request and receives an **array** of results — one entry per operation, in the same order. Instead of N sequential round-trips, you pay for network latency only once. The server processes each operation independently and assembles the response array before sending it back.

**Why batching instead of individual requests?**
The cost of N individual GraphQL requests is N × (round-trip latency + TLS handshake overhead). For a dashboard that needs 5 queries to render, that is 5 serial round-trips on a cold connection — often the bottleneck, not query execution. Batching collapses all 5 into one request, reducing the critical rendering path to a single round-trip. This is especially impactful in integration test suites, where hundreds of sequential "run query, assert" cycles become much faster when related queries are batched.

**When NOT to use batching?**
Mutations with observable side-effects (creating users, sending emails, charging payments) should never be batched unless order is guaranteed and idempotent. Some servers execute batched operations concurrently — batch ordering is not guaranteed at the network protocol level. For mutations: use individual requests where sequence is critical. For read-only queries: batching is safe and fast.

**Why does batch require endpoint parity?**
A batch request is a single HTTP call to one URL. If two tabs point to different servers (e.g. staging vs. production from GQL-14), there is no single URL that can receive both operations. Studio enforces this constraint at the UI level — the **Send Batch** button is disabled when checked tabs have different resolved endpoints. This is the converse of GQL-14: multi-tab isolation enables parallel cross-server work, while batch execution requires same-server unity.

**What happens when the server does not support batching?**
The Docker demo server on port **4010** has JSON-array batching **enabled** — you should see **1 upstream HTTP POST · JSON array batch** in the Batch Results transport line. For other endpoints, RFC-compliant servers accept an array body and return an array response. Older servers reject the array and return a single error object. Studio detects this on the first attempt and falls back to **sequential** execution — each operation is sent individually, but results are still aggregated in the same Batch Results panel. A **Sequential fallback** badge appears on the panel header for those servers only.`,
    keyTerms: [
      {
        term: 'Batch request',
        definition:
          'A single HTTP POST body containing a JSON **array** of GraphQL operation objects (`[{query, variables}, ...]`). The server processes each entry and returns an array of results in the same order.',
      },
      {
        term: 'Endpoint parity',
        definition:
          'The requirement that all tabs included in a batch share the same resolved endpoint URL. Mixing endpoints is impossible in a single HTTP request — the Send Batch button is disabled when tabs point to different servers.',
      },
      {
        term: 'Partial error',
        definition:
          'A batch response where one or more operations returned `errors` while others returned `data`. GraphQL batch does not fail-fast — all operations run and all results are returned, even if some have errors. Each result card in the panel shows ✓ (success) or ✗ (error) independently.',
      },
      {
        term: 'Sequential fallback',
        definition:
          'When a server does not support JSON array batching, Studio automatically falls back to sending each operation individually and aggregates the results into the Batch Results panel. A **Sequential fallback** badge and transport line in the modal header indicate this mode; per-tab Response slices show **op N** latency instead of a shared batch time.',
      },
      {
        term: 'Batch response slice',
        definition:
          'Each batched tab\'s **Response** pane shows one operation from the batch run — not a separate Execute. A **Batch N/M** banner, transport summary, and **View full batch** link make that clear. The **Metadata** tab adds batch slot, transport mode, and the wire JSON-array body when array batching succeeded.',
      },
      {
        term: 'Batch inclusion',
        definition:
          'Operations selected in **Advanced Settings → Batch** for the active endpoint group. Checked tabs show a read-only **B** badge on the tab bar. Subscriptions are excluded — they use WebSocket connections and cannot be batched in an HTTP body.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- ── Window chrome ────────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="700" height="430" rx="10" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <rect x="0" y="0" width="700" height="32" rx="10" fill="var(--surface)"/>
  <rect x="0" y="22" width="700" height="10" fill="var(--surface)"/>
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Batch Execution</text>

  <!-- ── Connection bar ──────────────────────────────────────────────────── -->
  <rect x="0" y="32" width="700" height="26" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="8" y="37" width="210" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="16" y="48" fill="var(--text)" font-size="8.5" font-family="monospace">localhost:4010/graphql</text>
  <rect x="228" y="37" width="50" height="16" rx="8" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="253" y="48" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <!-- Send Batch (2) button — the key UI element -->
  <rect x="530" y="36" width="100" height="18" rx="4" fill="var(--primary)"/>
  <text x="580" y="48" text-anchor="middle" font-size="8.5" font-weight="700" fill="white">⚡ Send Batch (2)</text>
  <!-- Gear icon -->
  <text x="640" y="48" font-size="10" fill="var(--text-muted)">⚙</text>
  <!-- Execute (per-tab) button -->
  <rect x="656" y="36" width="36" height="18" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="674" y="48" text-anchor="middle" font-size="8" fill="var(--text-muted)">▶</text>

  <!-- ── Tab bar ─────────────────────────────────────────────────────────── -->
  <rect x="0" y="58" width="700" height="30" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>

  <!-- Tab 1: GetHealth (checked for batch) -->
  <rect x="4" y="62" width="150" height="22" rx="4" fill="var(--primary)" opacity="0.12" stroke="var(--primary)" stroke-width="1.2"/>
  <rect x="4" y="80" width="150" height="4" fill="var(--primary)"/>
  <!-- Batch checkbox checked -->
  <rect x="10" y="67" width="11" height="11" rx="2" fill="var(--primary)"/>
  <text x="15" y="77" text-anchor="middle" font-size="8" fill="white" font-weight="700">✓</text>
  <!-- Tab label -->
  <text x="32" y="76" font-size="8.5" fill="var(--text)" font-weight="600">Q GetHealth</text>
  <text x="143" y="76" font-size="8" fill="var(--text-muted)" opacity="0.6">✕</text>

  <!-- Tab 2: CheckHealth (checked for batch) -->
  <rect x="158" y="62" width="155" height="22" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <!-- Batch checkbox checked -->
  <rect x="164" y="67" width="11" height="11" rx="2" fill="var(--primary)"/>
  <text x="169" y="77" text-anchor="middle" font-size="8" fill="white" font-weight="700">✓</text>
  <!-- Tab label -->
  <text x="186" y="76" font-size="8.5" fill="var(--text-muted)">Q CheckHealth</text>
  <text x="302" y="76" font-size="8" fill="var(--text-muted)" opacity="0.6">✕</text>

  <!-- Batch checkbox legend -->
  <rect x="320" y="66" width="10" height="10" rx="2" fill="var(--primary)" opacity="0.7"/>
  <text x="334" y="75" font-size="7" fill="var(--text-muted)">= included in batch</text>

  <!-- Add tab -->
  <rect x="460" y="64" width="22" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="471" y="76" text-anchor="middle" font-size="11" fill="var(--text-muted)">+</text>

  <!-- ── Left activity bar ─────────────────────────────────────────────────── -->
  <rect x="0" y="88" width="36" height="342" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="3" y="96" width="30" height="30" rx="4" fill="var(--bg)"/>
  <text x="18" y="115" text-anchor="middle" font-size="11" opacity="0.3">📋</text>

  <!-- ── Editor panel ──────────────────────────────────────────────────────── -->
  <rect x="36" y="88" width="235" height="342" fill="var(--bg)"/>
  <line x1="271" y1="88" x2="271" y2="430" stroke="var(--border)" stroke-width="1"/>
  <!-- Editor header -->
  <rect x="36" y="88" width="235" height="20" fill="var(--bg)"/>
  <rect x="40" y="90" width="55" height="16" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="67" y="102" text-anchor="middle" font-size="7.5" fill="var(--text)">GetHealth</text>
  <line x1="36" y1="108" x2="271" y2="108" stroke="var(--border)" stroke-width="1"/>
  <!-- Query text -->
  <text x="48" y="128" fill="#a78bfa" font-size="9" font-family="monospace">query</text>
  <text x="87" y="128" fill="var(--text)" font-size="9" font-family="monospace"> {</text>
  <text x="60" y="144" fill="#34d399" font-size="9" font-family="monospace">  health</text>
  <text x="48" y="160" fill="var(--text)" font-size="9" font-family="monospace">}</text>
  <!-- Tab 1 label -->
  <rect x="40" y="174" width="218" height="28" rx="4" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))" stroke="var(--primary)" stroke-width="0.8"/>
  <text x="50" y="190" font-size="7.5" fill="var(--primary)" font-weight="600">Tab 1 — active (GetHealth)</text>
  <text x="50" y="200" font-size="7" fill="var(--text-muted)">Tab 2: query CheckHealth { health }</text>

  <!-- ── Batch Results panel ────────────────────────────────────────────────── -->
  <rect x="271" y="88" width="429" height="342" fill="var(--bg)"/>

  <!-- Panel header: "Batch of 2 — 2 passed" -->
  <rect x="271" y="88" width="429" height="30" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <text x="283" y="107" font-size="10" fill="var(--text)" font-weight="700">Batch of 2</text>
  <rect x="356" y="94" width="58" height="16" rx="8" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="385" y="105" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">2 passed</text>
  <text x="682" y="107" text-anchor="end" font-size="11" fill="var(--text-muted)">×</text>

  <!-- Operation Card 1: ✓ GetHealth -->
  <rect x="279" y="122" width="413" height="84" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="279" y="122" width="413" height="4" rx="4" fill="#28c840"/>
  <!-- Card header -->
  <rect x="279" y="126" width="413" height="24" fill="color-mix(in srgb, #28c840 6%, var(--surface))"/>
  <text x="291" y="141" font-size="8.5" fill="#28c840" font-weight="700">✓</text>
  <text x="306" y="141" font-size="8.5" fill="var(--text)" font-weight="600">GetHealth</text>
  <rect x="450" y="130" width="40" height="14" rx="3" fill="color-mix(in srgb, #28c840 12%, var(--surface))" stroke="#28c840" stroke-width="0.5"/>
  <text x="470" y="140" text-anchor="middle" font-size="7" fill="#28c840">HTTP 200</text>
  <text x="498" y="141" font-size="7" fill="var(--text-muted)">28 ms</text>
  <text x="682" y="141" text-anchor="end" font-size="9" fill="var(--text-muted)">▾</text>
  <!-- Card body -->
  <rect x="279" y="150" width="413" height="56" fill="var(--bg)"/>
  <text x="291" y="168" fill="var(--text-muted)" font-size="8" font-family="monospace">{"data": {"health": "ok"}}</text>

  <!-- Operation Card 2: ✓ CheckHealth -->
  <rect x="279" y="214" width="413" height="84" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="279" y="214" width="413" height="4" rx="4" fill="#28c840"/>
  <!-- Card header -->
  <rect x="279" y="218" width="413" height="24" fill="color-mix(in srgb, #28c840 6%, var(--surface))"/>
  <text x="291" y="233" font-size="8.5" fill="#28c840" font-weight="700">✓</text>
  <text x="306" y="233" font-size="8.5" fill="var(--text)" font-weight="600">CheckHealth</text>
  <rect x="450" y="222" width="40" height="14" rx="3" fill="color-mix(in srgb, #28c840 12%, var(--surface))" stroke="#28c840" stroke-width="0.5"/>
  <text x="470" y="232" text-anchor="middle" font-size="7" fill="#28c840">HTTP 200</text>
  <text x="498" y="233" font-size="7" fill="var(--text-muted)">31 ms</text>
  <text x="682" y="233" text-anchor="end" font-size="9" fill="var(--text-muted)">▾</text>
  <!-- Card body -->
  <rect x="279" y="242" width="413" height="56" fill="var(--bg)"/>
  <text x="291" y="260" fill="var(--text-muted)" font-size="8" font-family="monospace">{"data": {"health": "ok"}}</text>

  <!-- ── Bottom legend / annotation ─────────────────────────────────────────── -->
  <line x1="0" y1="388" x2="700" y2="388" stroke="var(--border)" stroke-width="1"/>
  <rect x="0" y="388" width="700" height="42" fill="var(--bg)"/>

  <!-- Flow steps -->
  <defs>
    <marker id="gql15-arr" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
      <path d="M1,1 L4,2.5 L1,4 Z" fill="var(--primary)"/>
    </marker>
  </defs>

  <text x="36" y="405" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Add Tab 2</text>
  <text x="36" y="417" text-anchor="middle" font-size="7" fill="var(--text-muted)">same endpoint</text>
  <line x1="74" y1="407" x2="102" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql15-arr)"/>
  <text x="146" y="405" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Write queries</text>
  <text x="146" y="417" text-anchor="middle" font-size="7" fill="var(--text-muted)">both tabs</text>
  <line x1="186" y1="407" x2="212" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql15-arr)"/>
  <text x="260" y="405" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Enable Batch</text>
  <text x="260" y="417" text-anchor="middle" font-size="7" fill="var(--text-muted)">⚙ → Batch tab</text>
  <line x1="316" y1="407" x2="344" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql15-arr)"/>
  <text x="394" y="405" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Check ☑ both tabs</text>
  <text x="394" y="417" text-anchor="middle" font-size="7" fill="var(--text-muted)">batch table</text>
  <line x1="440" y1="407" x2="468" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql15-arr)"/>
  <text x="550" y="405" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Send Batch (2)</text>
  <text x="550" y="417" text-anchor="middle" font-size="7" fill="var(--primary)">1 HTTP request</text>
  <line x1="600" y1="407" x2="628" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql15-arr)"/>
  <text x="664" y="405" text-anchor="middle" font-size="8" font-weight="600" fill="#28c840">Batch of 2 ✓ ✓</text>
  <text x="664" y="417" text-anchor="middle" font-size="7" fill="var(--text-muted)">stacked cards</text>
</svg>`,
  },

  steps: [
    // ── Step 1: What is Batch Execution? ─────────────────────────────────────
    {
      id: 'gql15-intro',
      title: 'What is Batch Execution?',
      description:
        'Batch execution sends **multiple GraphQL operations as a single HTTP request** and receives an **array of results** in return. No sequential round-trips — all operations in the batch share one network round-trip.\n\n' +
        '**Why batch instead of individual requests?** Every HTTP request carries overhead: DNS resolution, TLS handshake, and queue time at the load balancer. For N queries, N individual requests multiply this overhead by N. Batch folds all of them into one request, paying the overhead only once. This is especially effective in integration test pipelines (where dozens of "query → assert" cycles run in sequence) and in dashboard pre-fetching (where 5–10 independent queries must all resolve before the page renders). The result is dramatically faster test suites and faster first meaningful paint for data-heavy UIs.',
      highlight: GQL.TAB_BAR,
      preAction: ensureLesson15IntroReady,
      action: async (ctx) => {
        await ctx.delay(1000);
      },
      verify: GQL.TAB_BAR,
      pauseAfter: true,
    },

    // ── Step 2: Add Second Tab ────────────────────────────────────────────────
    {
      id: 'gql15-add-tab',
      title: 'Add a Second Tab',
      description:
        'Click the **+** button at the end of the tab bar to open a second workspace tab. On **Tab 2**, change the endpoint to `http://localhost:4010/graphql` — a direct URL override (you will see the **:4010** hostname badge on the tab). Switch back to **Tab 1** and confirm it still shows `{{graphqlUrl}}` with no override badge.\n\n' +
        '**Why can batch use different *stored* URLs?** Batch cares about the **resolved** server, not the literal string in the connection bar. Tab 1\'s `{{graphqlUrl}}` and Tab 2\'s direct localhost URL both resolve to the same Docker server — so **Send Batch** stays enabled once you turn batch mode on. That is the opposite of GQL-14, where staging and production were genuinely different servers.',
      highlight: GQL.TAB_ADD_BTN,
      preAction: prepareGql15AddTabReading,
      action: demonstrateLesson15AddSecondTab,
      verify: GQL.TAB_BAR,
      pauseAfter: true,
    },

    // ── Step 3: Write Queries on Both Tabs ────────────────────────────────────
    {
      id: 'gql15-write-queries',
      title: 'Write a Query on Each Tab',
      description:
        'Switch to **Tab 1** and confirm `query { health }` is in the editor. Switch to **Tab 2** and enter `query CheckHealth { health }` — a different operation name so the batch result cards are easy to tell apart.\n\n' +
        '**Why different operation names?** Batch results are labelled by operation name, not tab title. Distinct names (`GetHealth` vs `CheckHealth`) make the stacked cards self-explanatory in screenshots and CI logs — you can see which response came from which tab without cross-referencing the tab bar.',
      highlight: GQL.EDITOR,
      preAction: prepareGql15WriteQueriesReading,
      action: demonstrateLesson15WriteQueries,
      verify: GQL.EDITOR,
      pauseAfter: true,
    },

    // ── Step 4: Enable Batch Mode ─────────────────────────────────────────────
    {
      id: 'gql15-enable-batch',
      title: 'Enable Batch Mode',
      description:
        'With both tabs configured, click the **⚙ gear** in the connection bar to open **Advanced settings**, switch to the **Batch** tab, and turn on **Enable query batching**. Review the operation table and timeout, then click **Save** — a batch summary chip appears on the connection bar and the **Send Batch** controls unlock once two operations are selected.\n\n' +
        '**Why wait until both tabs exist?** Batching sends multiple operations in one HTTP request — you need at least two ready tabs on the same endpoint before the toggle appears. Keeping batch setup in Advanced Settings keeps the connection bar clean while still making batch mode one click away when you need it.',
      highlight: GQL.ADV_BATCH_PANEL,
      preAction: prepareGql15EnableBatchReading,
      action: demonstrateLesson15EnableBatch,
      verify: GQL.BATCH_SUMMARY_CHIP,
      pauseAfter: true,
    },

    // ── Step 5: Select Batch Operations ───────────────────────────────────────
    {
      id: 'gql15-batch-select',
      title: 'Select Operations for the Batch',
      description:
        'Re-open **Advanced settings → Batch**. In the operation table, check **both** demo tabs — each row shows the operation letter, tab name, and the **full query on one line** (hover for the complete document). Click **Save**. A read-only **B** badge appears on each included tab in the tab bar.\n\n' +
        '**Why a table instead of tab-bar checkboxes?** Grouping by endpoint prevents accidental cross-server batches. The status row shows **0/2 → 2/2** so you always know how many operations will fire before you click **Send Batch**. Use **Select all** when every tab in the group should participate.',
      highlight: GQL.ADV_BATCH_PANEL,
      preAction: prepareGql15BatchSelectReading,
      action: demonstrateLesson15SelectBatchTabs,
      verify: GQL.TAB_BAR,
      pauseAfter: true,
    },

    // ── Step 6: Send Batch ──────────────────────────────────────────────────
    {
      id: 'gql15-batch-run',
      title: 'Send Batch Execute',
      description:
        'The **⚡ Send Batch (2)** button in the connection bar reflects how many operations are checked. Click it — the connection bar shows **Batching…** while the proxy sends one request. Both queries are serialised into a JSON array for a single upstream HTTP POST when the server supports array batching.\n\n' +
        '**Why does the button show a count?** The count updates live as you check or uncheck operations in Advanced Settings. Uncheck a tab and it drops out of the batch — handy for selective runs. The upstream body looks like `[{"query":"query { health }"},{"query":"query CheckHealth { health }"}]` — a standard array that RFC-compliant GraphQL servers handle natively.',
      highlight: GQL.BATCH_EXECUTE_BTN,
      preAction: ensureLesson15ReadyToExecute,
      action: demonstrateLesson15RunBatch,
      verify: GQL.BATCH_RESULTS,
      pauseAfter: true,
    },

    // ── Step 7: Batch Results Panel ───────────────────────────────────────────
    {
      id: 'gql15-batch-results',
      title: 'Batch Results Panel',
      description:
        'The floating **Batch execution** modal opens with a transport line such as **1 upstream HTTP POST · JSON array batch · N ms total** on the demo Docker server (true single-request batching). On servers that reject array bodies, the same line shows **sequential fallback** instead. **N passed / M failed** pills summarise the run; each stacked card shows operation name, HTTP status, latency, and JSON body.\n\n' +
        '**Why a separate modal?** Batch runs produce N results at once — a single Response pane cannot show them all without hiding context. The modal is the authoritative full-batch view; you can dismiss it and still inspect each tab individually (next step).',
      highlight: GQL.BATCH_RESULTS,
      preAction: prepareGql15BatchResultsReading,
      action: demonstrateLesson15BatchResults,
      verify: GQL.BATCH_RESULTS,
      pauseAfter: true,
    },

    // ── Step 8: Per-Tab Response Slice ────────────────────────────────────────
    {
      id: 'gql15-batch-response-slice',
      title: 'Per-Tab Response Slice',
      description:
        'Close the batch modal and switch between tabs. Each tab\'s **Response** pane shows **one operation from the batch** — not a fresh single Execute. Look for the **Batch 1/2** (or **2/2**) banner, the transport summary, and batch-aware latency (**30 ms batch** for array mode, or **4 ms · op 2** in sequential fallback).\n\n' +
        '**Why this matters:** Without the banner, batch results look like separate Execute clicks — confusing in demos and CI logs. **View full batch** reopens the modal after you dismiss it. Open the **Metadata** tab on any batched tab for batch slot, transport mode, and the **Wire batch body** JSON array sent upstream.',
      highlight: GQL.RESPONSE_BATCH_BANNER,
      preAction: prepareGql15BatchResponseSliceReading,
      action: demonstrateLesson15BatchResponseSlice,
      verify: GQL.RESPONSE_BATCH_BANNER,
      pauseAfter: true,
    },

    // ── Step 9: Partial Error Handling ────────────────────────────────────────
    {
      id: 'gql15-partial-error',
      title: 'Partial Errors — Batch Does Not Fail-Fast',
      description:
        `On **Tab 2**, replace the query with \`${LESSON15_ERROR_QUERY}\` — a field that does not exist in the schema. Click **Send Batch** again. The header shows **1 passed / 1 failed**: Tab 1's card keeps ✓ data; Tab 2's card shows ✗ with an errors array.\n\n` +
        '**Why is this important?** Most HTTP stacks fail the whole request when one part fails. GraphQL batch evaluates each operation independently — a schema error on operation 2 does not block operation 1\'s data. Dismiss the batch modal and switch tabs — each Response pane still shows its **Batch N/M** slice so you can inspect success and failure side by side. In integration tests, your setup query may have succeeded even when an assertion query failed — partial results, not a total blackout.',
      highlight: GQL.BATCH_RESULTS,
      preAction: prepareGql15PartialErrorReading,
      action: demonstrateLesson15PartialError,
      verify: GQL.BATCH_RESULTS,
      pauseAfter: true,
    },

    // ── Step 10: Batch History & CI Export ─────────────────────────────────────
    {
      id: 'gql15-export-batch',
      title: 'Batch History & CI Export',
      description:
        'On the demo Docker server you ran a **true JSON-array batch** — one HTTP POST, one response array. Studio still supports **sequential fallback** for older servers that reject array bodies; that mode shows a **Sequential fallback** badge and per-operation latency (**op N**) instead of a shared batch time.\n\n' +
        '**Why does this matter for CI?** Batch runs are logged per connection. Open the **History** sidebar (⏱ in the activity bar) — each batch run is stored. Select an entry and click **Load** to restore the full result, or copy JSON from the result cards for regression snapshots.',
      highlight: GQL.ACTIVITY_HISTORY,
      preAction: prepareGql15ExportBatchReading,
      action: demonstrateLesson15OpenHistory,
      verify: GQL.HISTORY_PANEL,
      pauseAfter: true,
    },
  ],
};
