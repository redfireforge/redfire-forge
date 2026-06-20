/** Lesson GQL-10: Performance Tracing */
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

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlPerformanceTracingLessonSetup,
  cleanup: gqlPerformanceTracingLessonCleanup,

  concept: {
    title: 'Complexity & Tracing',
    body: `GraphQL Studio surfaces performance in three layers:

1. **Complexity badge** (\`gql-complexity-badge\`) — pre-execution cost estimate from your query + schema
2. **Apollo Tracing waterfall** (\`gql-trace-view\`) — per-resolver timings from \`extensions.tracing\` in the response
3. **Latency histogram** (\`gql-histogram-strip\`) — distribution of recent request latencies (appears after 2+ executions)

The Docker test server on port **4010** returns Apollo Tracing v1 data on every query.`,
    keyTerms: [
      {
        term: 'Complexity score',
        definition:
          'Estimated field cost shown as `~N` next to Execute. Adding nested fields like `user { … }` increases the score.',
      },
      {
        term: 'Apollo Tracing',
        definition:
          'Server extension (`extensions.tracing`) with resolver start offsets and durations in nanoseconds.',
      },
      {
        term: 'Waterfall view',
        definition:
          'Gantt-style chart in the response Tracing tab — each row is one resolver with a color-coded duration bar.',
      },
      {
        term: 'Latency histogram',
        definition:
          'Compact bar chart below the response viewer summarizing the last N request latencies.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="15" y="28" width="70" height="64" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="50" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Complexity</text>
  <text x="50" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">~N badge</text>
  <rect x="95" y="28" width="65" height="64" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="127" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Execute</text>
  <text x="127" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">tracing ext</text>
  <rect x="170" y="28" width="80" height="64" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="210" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Waterfall</text>
  <text x="210" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">resolvers</text>
  <rect x="260" y="28" width="70" height="64" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="295" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Sort</text>
  <text x="295" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">slowest</text>
  <rect x="340" y="28" width="65" height="64" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="372" y="52" text-anchor="middle" fill="var(--text)" font-size="8">Histogram</text>
  <text x="372" y="66" text-anchor="middle" fill="var(--text-muted)" font-size="7">n≥2 runs</text>
  <text x="210" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Performance Tracing</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql10-complexity',
      title: 'Query Complexity Badge',
      description:
        `After introspecting \`${GQL_DEMO_HTTP}\`, load \`query { health }\` in the editor. Watch the **complexity badge** (\`gql-complexity-badge\`) next to **Execute** — it shows an estimated cost like **~1** before you send the request.`,
      highlight: GQL.COMPLEXITY_BADGE,
      preAction: ensureTracingHealthQuery,
      action: async (ctx) => {
        await ensureTracingHealthQuery(ctx);
        await ctx.delay(800);
      },
      verify: GQL.COMPLEXITY_BADGE,
      pauseAfter: true,
    },

    {
      id: 'gql10-expand',
      title: 'Complexity Grows With Fields',
      description:
        'Add **user(id: …)** with subfields alongside `health`. The complexity badge **increases** — more selected fields mean a higher estimated server cost.',
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

    {
      id: 'gql10-execute',
      title: 'Execute With Tracing',
      description:
        'Click **Execute**. The Docker test server attaches **Apollo Tracing v1** in `extensions.tracing`. A **Tracing** badge (`gql-rv-tracing-badge`) appears in the response header when trace data is present.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureTracingUserQuery,
      action: async (ctx) => {
        await ensureTracingExecuted(ctx);
        await ctx.delay(800);
      },
      verify: GQL.RV_TRACING_BADGE,
      pauseAfter: true,
    },

    {
      id: 'gql10-waterfall',
      title: 'Open the Waterfall',
      description:
        'Click the **Tracing** badge or the **Tracing** tab (`gql-rv-tab-tracing`) in the response viewer. The **waterfall** (`gql-trace-view`) lists each resolver with a timeline bar and duration.',
      highlight: GQL.TRACE_VIEW,
      preAction: ensureTracingExecuted,
      action: async (ctx) => {
        await ensureTracingViewOpen(ctx);
        await ctx.delay(800);
      },
      verify: GQL.TRACE_VIEW,
      pauseAfter: true,
    },

    {
      id: 'gql10-hover',
      title: 'Resolver Duration Tooltip',
      description:
        'Hover a resolver row (`gql-trace-resolver-row`) — the Gantt bar tooltip shows **Start** and **Duration** for that field. Color coding: green &lt; 50ms, amber 50–200ms, red &gt; 200ms.',
      highlight: GQL.TRACE_RESOLVER_ROW,
      preAction: ensureTracingViewOpen,
      action: async (ctx) => {
        await ensureTracingResolverHovered(ctx);
        await ctx.delay(800);
      },
      verify: GQL.TRACE_RESOLVER_ROW,
      pauseAfter: true,
    },

    {
      id: 'gql10-sort',
      title: 'Sort by Duration',
      description:
        'Click **Slowest first** (`gql-trace-sort-duration`) in the tracing controls. Resolver rows reorder so the longest-running fields appear at the top.',
      highlight: GQL.TRACE_SORT_DURATION,
      preAction: ensureTracingViewOpen,
      action: async (ctx) => {
        await ensureTracingSortedByDuration(ctx);
        await ctx.delay(800);
      },
      verify: GQL.TRACE_SORT_DURATION,
      pauseAfter: true,
    },

    {
      id: 'gql10-histogram',
      title: 'Latency Histogram',
      description:
        'Execute the query **two more times** (three total). The **latency histogram strip** (`gql-histogram-strip`) appears below the response viewer once at least **two** latencies are recorded — showing avg, p95, and bucket distribution.',
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
