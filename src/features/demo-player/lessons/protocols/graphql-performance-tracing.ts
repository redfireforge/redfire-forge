/** Lesson GQL-11: Performance Tracing */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_DEMO_HTTP,
  ensureLatencyHistogramVisible,
  ensureTracingExecuted,
  ensureTracingHealthQuery,
  ensureTracingResolverHovered,
  ensureTracingSortedByDuration,
  ensureTracingUserQuery,
  ensureTracingViewOpen,
  getComplexityBadgeScore,
  gqlPerformanceTracingLessonCleanup,
  gqlPerformanceTracingLessonSetup,
} from './graphql-lesson-helpers';

export const gqlPerformanceTracingLesson: DemoLesson = {
  id: 'gql-performance-tracing',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Performance Tracing',
  description:
    'Read query complexity estimates, execute against a tracing-enabled server, explore the Apollo Tracing waterfall, and build a latency histogram.',
  estimatedMinutes: 4,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlPerformanceTracingLessonSetup,
  cleanup: gqlPerformanceTracingLessonCleanup,

  concept: {
    title: 'Performance Tracing — From Estimate to Evidence',
    body: `GraphQL Studio surfaces performance data in **three progressive layers** — each tells you something the previous one cannot.

**Layer 1 — Complexity badge (pre-execution):**
Before you click Execute, the **complexity badge** (\`≈N\` next to Execute) shows an estimated field cost calculated from your query structure and the schema. This is not a server measurement — it is a static analysis of how many fields and resolvers the server will likely invoke. It catches expensive queries before they hit the server.

**Why complexity estimation matters:** A naive \`query { users { posts { comments { author { … } } } } }\` looks innocent in the editor but could fetch thousands of objects. The complexity badge makes the cost visible at authoring time, not after a slow response or a production incident.

**Layer 2 — Apollo Tracing waterfall (post-execution, per-resolver):**
After execution, when the response contains \`extensions.tracing\`, the **Tracing tab** lights up with a Gantt-style waterfall. Each row represents one resolver — with its start offset (relative to query start) and duration. This reveals:
- Which resolvers run in parallel vs. which block sequentially
- Which single resolver is your bottleneck (vs. total query time being misleading)
- How nested resolvers (e.g., \`user → posts → comments\`) cascade in time

**Why the waterfall is more useful than total latency:** Total query time shows you there is a problem. The waterfall shows you where. A query taking 300ms with a single resolver taking 295ms is very different from one where all 10 resolvers share that 300ms.

**Layer 3 — Latency histogram (multi-execution, distribution):**
After two or more executions, the **histogram strip** appears below the response viewer. It shows the distribution of recent request latencies — not just the last one. This reveals whether slow responses are consistent or occasional spikes.

**Why distribution matters:** The p95 latency (the 95th percentile — the slowest 5% of requests) is what your users actually experience at scale. A histogram with a long right tail (occasional 500ms spikes) behaves very differently from a narrow one (consistent 50ms). The histogram strip gives you this signal without running a full load test.`,
    keyTerms: [
      {
        term: 'Complexity badge',
        definition:
          'Pre-execution static field-cost estimate shown as `≈N` next to Execute. Based on query structure + schema, not server measurement. Warns about expensive queries before sending them.',
      },
      {
        term: 'Apollo Tracing',
        definition:
          'Server-side extension (`extensions.tracing` in the GraphQL response) providing per-resolver start offsets and durations in nanoseconds. The Docker test server returns this on every request.',
      },
      {
        term: 'Waterfall (Gantt chart)',
        definition:
          'The Tracing tab view — each row is one resolver plotted on a timeline. Color coding: green < 50ms, amber 50–200ms, red > 200ms. Reveals sequential vs. parallel execution and bottleneck resolvers.',
      },
      {
        term: 'Resolver row',
        definition:
          'A single entry in the waterfall — field path (e.g., `Query.user`), a colored duration bar, and a tooltip with exact start/duration. Hover to inspect.',
      },
      {
        term: 'Latency histogram',
        definition:
          'Compact bar chart (`gql-histogram-strip`) below the response viewer — shows distribution of recent request latencies with avg and p95. Appears after 2+ executions. Reveals latency spikes vs. consistent slow performance.',
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
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Performance Tracing</text>

  <!-- ── Connection bar ───────────────────────────────────────────────────── -->
  <rect x="0" y="32" width="700" height="26" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="8" y="37" width="230" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="16" y="48" fill="var(--text-muted)" font-size="8.5" font-family="monospace">localhost:4010/graphql</text>
  <rect x="250" y="37" width="60" height="16" rx="8" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="280" y="48" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <!-- Execute + Complexity badge -->
  <rect x="556" y="37" width="36" height="16" rx="3" fill="color-mix(in srgb, #f59e0b 15%, var(--surface))" stroke="#f59e0b" stroke-width="1"/>
  <text x="574" y="48" text-anchor="middle" font-size="8" fill="#f59e0b" font-weight="700">≈5</text>
  <!-- Badge annotation -->
  <rect x="480" y="37" width="72" height="16" rx="3" fill="color-mix(in srgb, #f59e0b 8%, var(--surface))" stroke="#f59e0b" stroke-width="0.5"/>
  <text x="516" y="48" text-anchor="middle" font-size="7" fill="#f59e0b">Complexity: ≈5</text>
  <rect x="596" y="37" width="72" height="16" rx="4" fill="var(--primary)"/>
  <text x="632" y="48" text-anchor="middle" font-size="9" font-weight="700" fill="white">▶ Execute</text>

  <!-- ── Left activity bar ─────────────────────────────────────────────────── -->
  <rect x="0" y="58" width="36" height="372" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="3" y="68" width="30" height="30" rx="4" fill="var(--bg)"/>
  <text x="18" y="86" text-anchor="middle" font-size="12" opacity="0.3">📋</text>

  <!-- ── Monaco Editor (left, ~240px) ──────────────────────────────────────── -->
  <rect x="36" y="58" width="240" height="372" fill="var(--bg)"/>
  <line x1="276" y1="58" x2="276" y2="430" stroke="var(--border)" stroke-width="1"/>

  <!-- Editor header -->
  <rect x="36" y="58" width="240" height="22" fill="var(--bg)"/>
  <rect x="40" y="60" width="56" height="18" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="68" y="72" text-anchor="middle" font-size="7.5" fill="var(--text)" font-weight="500">Query 1</text>
  <rect x="36" y="80" width="240" height="1" fill="var(--border)"/>

  <!-- Query code -->
  <rect x="36" y="81" width="240" height="200" fill="var(--bg)"/>
  <text x="48" y="98" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">1</text>
  <text x="48" y="112" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">2</text>
  <text x="48" y="126" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">3</text>
  <text x="48" y="140" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">4</text>
  <text x="48" y="154" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">5</text>
  <text x="48" y="168" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">6</text>
  <text x="48" y="182" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">7</text>
  <text x="60" y="98" fill="#a78bfa" font-size="9" font-family="monospace">query</text>
  <text x="95" y="98" fill="var(--text)" font-size="9" font-family="monospace"> TracingDemo {</text>
  <text x="60" y="112" fill="var(--text-muted)" font-size="9" font-family="monospace">  health</text>
  <text x="60" y="126" fill="#60a5fa" font-size="9" font-family="monospace">  user</text>
  <text x="90" y="126" fill="var(--text)" font-size="9" font-family="monospace">(id: </text>
  <text x="113" y="126" fill="#f59e0b" font-size="9" font-family="monospace">"usr-1"</text>
  <text x="150" y="126" fill="var(--text)" font-size="9" font-family="monospace">) {</text>
  <text x="60" y="140" fill="var(--text-muted)" font-size="9" font-family="monospace">    id</text>
  <text x="60" y="154" fill="var(--text-muted)" font-size="9" font-family="monospace">    name</text>
  <text x="60" y="168" fill="var(--text)" font-size="9" font-family="monospace">  }</text>
  <text x="60" y="182" fill="var(--text)" font-size="9" font-family="monospace">}</text>

  <!-- ── Response viewer (right, ~424px) ───────────────────────────────────── -->
  <rect x="278" y="58" width="422" height="372" fill="var(--bg)"/>

  <!-- Response tab bar -->
  <rect x="278" y="58" width="422" height="26" fill="var(--surface)"/>
  <line x1="278" y1="84" x2="700" y2="84" stroke="var(--border)" stroke-width="1"/>
  <!-- Response tab -->
  <rect x="284" y="62" width="62" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="315" y="74" text-anchor="middle" font-size="8" fill="var(--text-muted)">Response</text>
  <!-- Tracing tab (active) -->
  <rect x="350" y="62" width="60" height="18" rx="3" fill="var(--primary)"/>
  <text x="380" y="74" text-anchor="middle" font-size="8" fill="white" font-weight="700">⏱ Tracing</text>
  <!-- Tracing badge in response header -->
  <rect x="570" y="64" width="60" height="14" rx="3" fill="color-mix(in srgb, var(--primary) 15%, var(--surface))" stroke="var(--primary)" stroke-width="1"/>
  <text x="600" y="74" text-anchor="middle" font-size="7.5" fill="var(--primary)" font-weight="600">⏱ Tracing ●</text>
  <!-- Badge annotation -->
  <line x1="600" y1="78" x2="600" y2="94" stroke="var(--primary)" stroke-width="0.8" stroke-dasharray="2 2"/>
  <rect x="550" y="94" width="100" height="13" rx="3" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))" stroke="var(--border)" stroke-width="0.5"/>
  <text x="600" y="103" text-anchor="middle" font-size="6.5" fill="var(--primary)">trace data present</text>

  <!-- Tracing controls bar -->
  <rect x="278" y="84" width="422" height="22" fill="var(--surface)"/>
  <line x1="278" y1="106" x2="700" y2="106" stroke="var(--border)" stroke-width="0.5"/>
  <text x="288" y="98" font-size="8" fill="var(--text-muted)">Total: 42ms</text>
  <text x="370" y="98" font-size="8" fill="var(--text-muted)">3 resolvers</text>
  <!-- Sort button -->
  <rect x="560" y="87" width="82" height="14" rx="3" fill="var(--primary)"/>
  <text x="601" y="97" text-anchor="middle" font-size="7.5" fill="white" font-weight="600">▼ Slowest first</text>

  <!-- ── Waterfall rows ─────────────────────────────────────────────────────── -->
  <!-- Row 1: Query.user — amber (slowest) -->
  <rect x="278" y="106" width="422" height="30" fill="var(--bg)"/>
  <line x1="278" y1="106" x2="700" y2="106" stroke="var(--border)" stroke-width="0.5"/>
  <text x="288" y="118" font-size="8" fill="var(--text)">Query.user</text>
  <text x="288" y="130" font-size="7" fill="var(--text-muted)">30ms</text>
  <!-- Timeline track -->
  <rect x="390" y="112" width="290" height="18" rx="2" fill="color-mix(in srgb, var(--primary) 5%, var(--bg))"/>
  <!-- Bar: amber (30ms of 42ms total) -->
  <rect x="392" y="113" width="196" height="16" rx="2" fill="#f59e0b"/>
  <text x="430" y="124" font-size="7" fill="white" font-weight="600">30ms</text>
  <!-- Hover tooltip -->
  <rect x="540" y="94" width="110" height="26" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="595" y="105" text-anchor="middle" font-size="7" fill="var(--text)">Start: 2ms</text>
  <text x="595" y="116" text-anchor="middle" font-size="7" fill="#f59e0b" font-weight="600">Duration: 30ms</text>

  <!-- Row 2: Query.health — green (fast) -->
  <rect x="278" y="136" width="422" height="30" fill="var(--bg)"/>
  <line x1="278" y1="136" x2="700" y2="136" stroke="var(--border)" stroke-width="0.5"/>
  <text x="288" y="148" font-size="8" fill="var(--text)">Query.health</text>
  <text x="288" y="160" font-size="7" fill="var(--text-muted)">8ms</text>
  <rect x="390" y="142" width="290" height="18" rx="2" fill="color-mix(in srgb, var(--primary) 5%, var(--bg))"/>
  <rect x="392" y="143" width="52" height="16" rx="2" fill="#28c840"/>
  <text x="418" y="154" font-size="7" fill="white" font-weight="600">8ms</text>

  <!-- Row 3: User.name — green (fast) -->
  <rect x="278" y="166" width="422" height="30" fill="var(--bg)"/>
  <line x1="278" y1="166" x2="700" y2="166" stroke="var(--border)" stroke-width="0.5"/>
  <text x="288" y="178" font-size="8" fill="var(--text-muted)">User.name</text>
  <text x="288" y="190" font-size="7" fill="var(--text-muted)">4ms</text>
  <rect x="390" y="172" width="290" height="18" rx="2" fill="color-mix(in srgb, var(--primary) 5%, var(--bg))"/>
  <!-- Starts later (after user parent) -->
  <rect x="468" y="173" width="26" height="16" rx="2" fill="#28c840"/>
  <text x="481" y="184" font-size="7" fill="white" font-weight="600">4ms</text>

  <!-- Color legend -->
  <rect x="278" y="198" width="422" height="20" fill="var(--surface)"/>
  <line x1="278" y1="198" x2="700" y2="198" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="290" y="203" width="8" height="8" rx="1" fill="#28c840"/>
  <text x="302" y="210" font-size="7" fill="var(--text-muted)">&lt; 50ms</text>
  <rect x="340" y="203" width="8" height="8" rx="1" fill="#f59e0b"/>
  <text x="352" y="210" font-size="7" fill="var(--text-muted)">50–200ms</text>
  <rect x="408" y="203" width="8" height="8" rx="1" fill="#ef4444"/>
  <text x="420" y="210" font-size="7" fill="var(--text-muted)">&gt; 200ms</text>
  <text x="560" y="210" font-size="7" fill="var(--text-muted)">hover row → tooltip</text>

  <!-- ── Histogram strip ────────────────────────────────────────────────────── -->
  <line x1="278" y1="218" x2="700" y2="218" stroke="var(--border)" stroke-width="1"/>
  <rect x="278" y="218" width="422" height="16" fill="var(--surface)"/>
  <text x="288" y="229" font-size="8" font-weight="600" fill="var(--text)">Latency Histogram</text>
  <text x="560" y="229" text-anchor="end" font-size="7.5" fill="var(--text-muted)">avg: 38ms · p95: 58ms</text>
  <!-- Histogram bars -->
  <rect x="278" y="234" width="422" height="50" fill="var(--bg)"/>
  <!-- x-axis labels -->
  <text x="290" y="278" font-size="6.5" fill="var(--text-muted)">0ms</text>
  <text x="370" y="278" font-size="6.5" fill="var(--text-muted)">30ms</text>
  <text x="450" y="278" font-size="6.5" fill="var(--text-muted)">60ms</text>
  <text x="530" y="278" font-size="6.5" fill="var(--text-muted)">90ms</text>
  <text x="610" y="278" font-size="6.5" fill="var(--text-muted)">120ms</text>
  <!-- Histogram bars (distribution) -->
  <rect x="300" y="258" width="12" height="16" rx="1" fill="var(--primary)" opacity="0.5"/>
  <rect x="316" y="250" width="12" height="24" rx="1" fill="var(--primary)" opacity="0.6"/>
  <rect x="332" y="240" width="12" height="34" rx="1" fill="var(--primary)" opacity="0.7"/>
  <rect x="348" y="236" width="12" height="38" rx="1" fill="var(--primary)" opacity="0.8"/>
  <rect x="364" y="244" width="12" height="30" rx="1" fill="var(--primary)" opacity="0.75"/>
  <rect x="380" y="252" width="12" height="22" rx="1" fill="var(--primary)" opacity="0.6"/>
  <rect x="396" y="260" width="12" height="14" rx="1" fill="var(--primary)" opacity="0.5"/>
  <rect x="412" y="264" width="12" height="10" rx="1" fill="var(--primary)" opacity="0.4"/>
  <rect x="428" y="268" width="12" height="6" rx="1" fill="#f59e0b" opacity="0.6"/>
  <rect x="444" y="270" width="12" height="4" rx="1" fill="#f59e0b" opacity="0.5"/>
  <!-- p95 marker -->
  <line x1="448" y1="234" x2="448" y2="275" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3 2"/>
  <rect x="450" y="234" width="28" height="12" rx="2" fill="color-mix(in srgb, #f59e0b 15%, var(--surface))"/>
  <text x="464" y="243" text-anchor="middle" font-size="7" fill="#f59e0b" font-weight="600">p95</text>
  <!-- Histogram label callout -->
  <rect x="540" y="244" width="140" height="28" rx="3" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))" stroke="var(--border)" stroke-width="0.8"/>
  <text x="610" y="256" text-anchor="middle" font-size="7.5" fill="var(--primary)" font-weight="600">appears after 2+ runs</text>
  <text x="610" y="266" text-anchor="middle" font-size="7" fill="var(--text-muted)">reveals latency distribution</text>

  <!-- ── Response JSON preview (below histogram) ──────────────────────────── -->
  <line x1="278" y1="286" x2="700" y2="286" stroke="var(--border)" stroke-width="1"/>
  <rect x="278" y="286" width="422" height="16" fill="var(--surface)"/>
  <text x="288" y="297" font-size="8" font-weight="600" fill="var(--text)">extensions.tracing</text>
  <text x="690" y="297" text-anchor="end" font-size="7.5" fill="var(--text-muted)">Apollo Tracing v1</text>
  <rect x="278" y="302" width="422" height="50" fill="var(--bg)"/>
  <text x="288" y="318" fill="var(--text-muted)" font-size="7.5" font-family="monospace">&#123;</text>
  <text x="296" y="330" fill="var(--text-muted)" font-size="7.5" font-family="monospace">  "version": 1, "startTime": "...",</text>
  <text x="296" y="342" fill="#28c840" font-size="7.5" font-family="monospace">  "duration": 42000000,</text>
  <text x="296" y="354" fill="#60a5fa" font-size="7.5" font-family="monospace">  "execution": &#123; "resolvers": [...] &#125;</text>

  <!-- ── Bottom legend ─────────────────────────────────────────────────────── -->
  <line x1="0" y1="390" x2="700" y2="390" stroke="var(--border)" stroke-width="1"/>
  <rect x="0" y="390" width="700" height="40" fill="var(--bg)"/>
  <defs>
    <marker id="gql11-arr" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
      <path d="M1,1 L4,2.5 L1,4 Z" fill="var(--primary)"/>
    </marker>
  </defs>
  <text x="42" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">≈N badge</text>
  <text x="42" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">pre-execution</text>
  <line x1="76" y1="408" x2="106" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql11-arr)"/>
  <text x="138" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Execute</text>
  <text x="138" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">+ tracing ext</text>
  <line x1="172" y1="408" x2="202" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql11-arr)"/>
  <text x="238" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Waterfall</text>
  <text x="238" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">per-resolver</text>
  <line x1="276" y1="408" x2="306" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql11-arr)"/>
  <text x="342" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Sort by Duration</text>
  <text x="342" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">find bottleneck</text>
  <line x1="390" y1="408" x2="420" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql11-arr)"/>
  <text x="458" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Hover Row</text>
  <text x="458" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">tooltip: start+dur</text>
  <line x1="494" y1="408" x2="524" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql11-arr)"/>
  <text x="576" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--primary)">Histogram</text>
  <text x="576" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">distribution + p95</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Complexity badge ────────────────────────────────────────────
    {
      id: 'gql10-complexity',
      title: 'Query Complexity Badge — Pre-Execution Cost',
      description:
        `After introspecting \`${GQL_DEMO_HTTP}\`, load \`query { health }\` in the editor. The **complexity badge** (\`gql-complexity-badge\`) next to **Execute** shows a cost estimate like **≈1** before any server request is made.\n\n` +
        '**Why complexity estimation?** The badge is a static analysis of your query structure against the schema — it counts how many resolvers the server will invoke. ' +
        'A simple `query { health }` scores ≈1. Nested queries like `users { posts { comments { … } } }` score much higher. ' +
        'The goal is to surface expensive queries at authoring time, before they cause slow responses, rate-limit errors, or production incidents. ' +
        'Think of it as a fuel gauge before a trip — you see the cost before you commit.',
      highlight: GQL.COMPLEXITY_BADGE,
      preAction: ensureTracingHealthQuery,
      action: async (ctx) => {
        await ensureTracingHealthQuery(ctx);
        await ctx.delay(800);
      },
      verify: GQL.COMPLEXITY_BADGE,
      pauseAfter: true,
    },

    // ── Step 2: Complexity grows with fields ───────────────────────────────
    {
      id: 'gql10-expand',
      title: 'Complexity Grows With Fields',
      description:
        'Add **`user(id: …)`** with `id` and `name` subfields alongside `health`. Watch the complexity badge **increase**.\n\n' +
        '**Why the score increases:** Each additional field the server must resolve adds to the estimated cost. The `user` field requires a separate database lookup (or service call). Its subfields `id` and `name` each add to the resolver count. ' +
        'The badge helps you understand the trade-off before executing: is the extra data worth the extra server work? ' +
        'This is especially relevant with deeply nested queries where the N+1 problem can turn a single request into hundreds of resolver calls.',
      highlight: GQL.COMPLEXITY_BADGE,
      preAction: ensureTracingHealthQuery,
      action: async (ctx) => {
        const before = getComplexityBadgeScore();
        await ensureTracingUserQuery(ctx);
        const after = getComplexityBadgeScore();
        if (after <= before && before > 0) {
          await ensureTracingUserQuery(ctx);
        }
        await ctx.delay(800);
      },
      verify: GQL.COMPLEXITY_BADGE,
      pauseAfter: true,
    },

    // ── Step 3: Execute with tracing ────────────────────────────────────────
    {
      id: 'gql10-execute',
      title: 'Execute — Trigger Apollo Tracing',
      description:
        'Click **Execute** (`gql-execute-btn`). The Docker test server processes the query and attaches per-resolver timing data in `extensions.tracing` of the response JSON.\n\n' +
        '**Why the server must opt in:** Apollo Tracing is a server-side extension — the server has to be configured to collect and return resolver timings. Not every GraphQL server enables it. ' +
        'The Docker test server on port 4010 always returns Apollo Tracing v1, making this a reliable demo environment. In production, look for the `extensions.tracing` key in your raw response JSON; if it is absent, your server has not enabled the extension.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureTracingUserQuery,
      action: async (ctx) => {
        await ensureTracingExecuted(ctx);
        await ctx.delay(800);
      },
      verify: GQL.RV_TRACING_BADGE,
      pauseAfter: true,
    },

    // ── Step 4: Tracing badge (NEW) ─────────────────────────────────────────
    {
      id: 'gql10-tracing-badge',
      title: 'The Tracing Badge — Trace Data Confirmed',
      description:
        'A **Tracing** badge (`gql-rv-tracing-badge`) appears in the response header — this is your signal that the server returned `extensions.tracing` data. Click it to open the waterfall.\n\n' +
        '**Why a badge instead of auto-opening?** Not every execution against every server will return tracing data. The badge is a conditional indicator: if the server returned trace data, it lights up and gives you a click target. If the server does not support tracing, no badge appears — you do not navigate to an empty panel. ' +
        'The badge also serves as a persistent indicator: even after you switch response tabs, the badge reminds you that trace data is available.',
      highlight: GQL.RV_TRACING_BADGE,
      preAction: ensureTracingExecuted,
      action: async (ctx) => {
        await ensureTracingViewOpen(ctx);
        await ctx.delay(800);
      },
      verify: GQL.TRACE_VIEW,
      pauseAfter: true,
    },

    // ── Step 5: Open waterfall ─────────────────────────────────────────────
    {
      id: 'gql10-waterfall',
      title: 'Explore the Resolver Waterfall',
      description:
        'The **Tracing tab** (`gql-rv-tab-tracing`) opens the **waterfall** (`gql-trace-view`) — a Gantt-style chart where each row is one resolver plotted on a shared timeline.\n\n' +
        '**Why a waterfall chart?** It makes the execution structure visible. You can see:\n' +
        '- Which resolvers run in **parallel** (bars at the same horizontal position)\n' +
        '- Which resolvers run **sequentially** (bars staggered in time — a child resolver starts after its parent)\n' +
        '- The **relative contribution** of each resolver to total query time\n\n' +
        'A query where `Query.user` takes 290ms out of a 300ms total is a very different performance profile from one where all 10 resolvers share 300ms evenly. The waterfall makes both patterns immediately visible.',
      highlight: GQL.TRACE_VIEW,
      preAction: ensureTracingViewOpen,
      action: async (ctx) => {
        await ctx.delay(800);
      },
      verify: GQL.TRACE_VIEW,
      pauseAfter: true,
    },

    // ── Step 6: Hover resolver tooltip ─────────────────────────────────────
    {
      id: 'gql10-hover',
      title: 'Resolver Duration Tooltip',
      description:
        'Hover a resolver row (`gql-trace-resolver-row`) — the Gantt bar tooltip shows **Start** offset (when the resolver began, relative to query start) and **Duration** for that field. Bars are color-coded: green &lt; 50ms, amber 50–200ms, red &gt; 200ms.\n\n' +
        '**Why the tooltip matters:** The bar width gives you a visual sense of duration, but the tooltip gives you the exact numbers in milliseconds. ' +
        'The **Start offset** is equally important: a resolver that starts at t=200ms (because it depends on a parent resolver) tells a different story from one that starts at t=0. ' +
        'The color coding follows a traffic-light convention so you can identify slow resolvers without reading every number.',
      highlight: GQL.TRACE_RESOLVER_ROW,
      preAction: ensureTracingViewOpen,
      action: async (ctx) => {
        await ensureTracingResolverHovered(ctx);
        await ctx.delay(800);
      },
      verify: GQL.TRACE_RESOLVER_ROW,
      pauseAfter: true,
    },

    // ── Step 7: Sort by duration ────────────────────────────────────────────
    {
      id: 'gql10-sort',
      title: 'Sort by Duration — Find the Bottleneck',
      description:
        'Click **Slowest first** (`gql-trace-sort-duration`) in the tracing controls. Resolver rows reorder so the longest-running field appears at the top.\n\n' +
        '**Why sort?** Waterfall charts show execution order by default (the order resolvers started). This is accurate but not always useful for identifying bottlenecks — a slow resolver that starts near the end might be buried at the bottom of a long list. ' +
        'Sorting by duration puts your slowest resolver at the top immediately, regardless of when it ran. ' +
        'This is your first optimization target: fix the slowest resolver before worrying about the fast ones.',
      highlight: GQL.TRACE_SORT_DURATION,
      preAction: ensureTracingViewOpen,
      action: async (ctx) => {
        await ensureTracingSortedByDuration(ctx);
        await ctx.delay(800);
      },
      verify: GQL.TRACE_SORT_DURATION,
      pauseAfter: true,
    },

    // ── Step 8: Latency histogram ───────────────────────────────────────────
    {
      id: 'gql10-histogram',
      title: 'Latency Histogram — Distribution Over Time',
      description:
        'Execute the query **two more times** (three total). The **latency histogram strip** (`gql-histogram-strip`) appears below the response viewer — showing avg, p95, and a bar-chart distribution of recent request latencies.\n\n' +
        '**Why distribution matters more than a single measurement:** One slow execution could be a cold start, a transient network glitch, or just noise. The histogram shows you the pattern across multiple executions:\n' +
        '- A **narrow, symmetric histogram** means consistent performance\n' +
        '- A **right-skewed histogram with a long tail** means occasional spikes (your p95 is much worse than your average)\n' +
        '- A **bimodal histogram** (two peaks) means two distinct execution paths — possibly a cache hit vs. cache miss pattern\n\n' +
        'The **p95 line** (the value below which 95% of requests fall) is the metric to optimize for in production — it represents the worst experience your typical user encounters.',
      highlight: GQL.HISTOGRAM_STRIP,
      preAction: ensureTracingSortedByDuration,
      action: async (ctx) => {
        await ensureLatencyHistogramVisible(ctx);
        await ctx.delay(800);
      },
      verify: GQL.HISTOGRAM_STRIP,
      pauseAfter: true,
    },
  ],
};
