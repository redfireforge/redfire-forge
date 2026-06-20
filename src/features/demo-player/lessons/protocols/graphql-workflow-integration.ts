/** Lesson GQL-11: Workflow Integration */
import type { DemoLesson } from '../../types';
import { GQL, WF } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_DEMO_HTTP,
  LESSON11_LATENCY_VAR,
  LESSON11_WF_NAME,
  ensureLesson11AssertNodeAdded,
  ensureLesson11AssertRuleConfigured,
  ensureLesson11AssertSourceConfigured,
  ensureLesson11QueryConfigured,
  ensureLesson11QueryNodeAdded,
  ensureLesson11WorkflowCreated,
  ensureLesson11WorkflowFailRun,
  ensureLesson11WorkflowPassRun,
  gqlWorkflowIntegrationLessonCleanup,
  gqlWorkflowIntegrationLessonSetup,
} from './graphql-lesson-helpers';

export const gqlWorkflowIntegrationLesson: DemoLesson = {
  id: 'gql-workflow-integration',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Workflow Integration',
  description:
    'Build a GraphQL Query + Assert workflow in the Designer, bind latency output, and verify pass/fail execution against the Docker test server.',
  estimatedMinutes: 4,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'workflow-runner'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlWorkflowIntegrationLessonSetup,
  cleanup: gqlWorkflowIntegrationLessonCleanup,

  concept: {
    title: 'GraphQL Workflow Nodes',
    body: `GraphQL Studio operations can be automated as **workflow nodes** in the Workflow Designer:

- **GraphQL Query** — POST a query/mutation to an endpoint; bind \`latencyMs\`, \`data\`, and other fields to workflow variables via the **Output** tab
- **GraphQL Assert** — evaluate JSONPath assertions against a source variable (typically a bound latency value)

This lesson wires **Start → GraphQL Query → GraphQL Assert → End**, binds \`latencyMs\` to \`${LESSON11_LATENCY_VAR}\`, asserts latency **< 500ms**, then tightens the threshold to force a visible failure.`,
    keyTerms: [
      {
        term: 'Output binding',
        definition:
          'Maps a GraphQL response field (e.g. `latencyMs`) to a named workflow variable downstream nodes can reference.',
      },
      {
        term: 'Source variable',
        definition:
          'On `graphqlAssert`, the workflow variable holding the JSON/value to assert against (here: `gqlLatency`).',
      },
      {
        term: 'Quick Test',
        definition:
          'One-click workflow execution in the Designer — nodes turn green (pass) or red (fail) on the canvas.',
      },
      {
        term: 'less_than',
        definition:
          'Field operator `<` — passes when the value at the JSONPath is numerically less than the expected threshold.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="40" width="55" height="40" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="47" y="64" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Start</text>
  <line x1="75" y1="60" x2="95" y2="60" stroke="var(--primary)" stroke-width="1.5"/>
  <rect x="95" y="34" width="80" height="52" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="135" y="54" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">GraphQL</text>
  <text x="135" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">Query</text>
  <line x1="175" y1="60" x2="195" y2="60" stroke="var(--primary)" stroke-width="1.5"/>
  <rect x="195" y="34" width="80" height="52" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="235" y="54" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">GraphQL</text>
  <text x="235" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">Assert</text>
  <line x1="275" y1="60" x2="295" y2="60" stroke="var(--primary)" stroke-width="1.5"/>
  <rect x="295" y="40" width="55" height="40" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="322" y="64" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">End</text>
  <text x="210" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Workflow Integration</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql11-create',
      title: 'Create a Workflow',
      description:
        `Open the **Workflow Designer** and click **+ New** → **Blank Workflow**. Name it **${LESSON11_WF_NAME}** — a clean canvas with Start and End nodes.`,
      highlight: WF.SIDEBAR_NEW_BTN,
      preAction: gqlWorkflowIntegrationLessonSetup,
      action: async (ctx) => {
        await ensureLesson11WorkflowCreated(ctx);
        await ctx.delay(800);
      },
      verify: WF.CANVAS,
      pauseAfter: true,
    },

    {
      id: 'gql11-query-node',
      title: 'Add GraphQL Query Node',
      description:
        'In the palette **Actions** section, click **GraphQL Query** — a purple Q node appears. Wire **Start → GraphQL Query**.',
      highlight: WF.PAL_GQL_QUERY,
      preAction: ensureLesson11WorkflowCreated,
      action: async (ctx) => {
        await ensureLesson11QueryNodeAdded(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_QUERY_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-config-query',
      title: 'Configure the Query',
      description:
        `Double-click the query node. Set endpoint to \`${GQL_DEMO_HTTP}\`, query to \`query { health }\`, then open the **Output** tab — bind **latencyMs** → \`${LESSON11_LATENCY_VAR}\`.`,
      highlight: GQL.WF_QUERY_PANEL,
      preAction: ensureLesson11QueryNodeAdded,
      action: async (ctx) => {
        await ensureLesson11QueryConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_QUERY_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-assert-node',
      title: 'Add GraphQL Assert Node',
      description:
        'Click **GraphQL Assert** in the palette (Logic section). Connect **GraphQL Query → GraphQL Assert → End**.',
      highlight: WF.PAL_GQL_ASSERT,
      preAction: ensureLesson11QueryConfigured,
      action: async (ctx) => {
        await ensureLesson11AssertNodeAdded(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-assert-source',
      title: 'Set Assert Source',
      description:
        `Open the Assert config → **Source** tab. Set **Source variable** to \`${LESSON11_LATENCY_VAR}\` — the latency value bound from the query node's Output tab.`,
      highlight: GQL.WF_ASSERT_PANEL,
      preAction: ensureLesson11AssertNodeAdded,
      action: async (ctx) => {
        await ensureLesson11AssertSourceConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-assert-rule',
      title: 'Latency Assertion',
      description:
        'On the **Assertions** tab, add a rule: JSONPath `$`, operator **<** (`less_than`), expected value **500**, description "Latency under 500ms".',
      highlight: GQL.WF_ASSERT_ROW,
      preAction: ensureLesson11AssertSourceConfigured,
      action: async (ctx) => {
        await ensureLesson11AssertRuleConfigured(ctx, '500');
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql11-run-pass',
      title: 'Run — Both Nodes Pass',
      description:
        'Click **Quick Test** (▶). Against the Docker server, the query succeeds and latency is well under 500ms — both **GraphQL Query** and **GraphQL Assert** nodes turn **green**.',
      highlight: WF.QUICK_TEST_BTN,
      preAction: ensureLesson11AssertRuleConfigured,
      action: async (ctx) => {
        await ensureLesson11WorkflowPassRun(ctx);
        await ctx.delay(800);
      },
      verify: WF.EXEC_SUMMARY,
      pauseAfter: true,
    },

    {
      id: 'gql11-run-fail',
      title: 'Tighten Threshold — Assert Fails',
      description:
        'Re-open the Assert node and change the expected value to **1** ms (impossibly strict). **Quick Test** again — the query still passes but **GraphQL Assert** turns **red** with failure details in the console.',
      highlight: GQL.WF_CANVAS_ASSERT_NODE,
      preAction: ensureLesson11WorkflowPassRun,
      action: async (ctx) => {
        await ensureLesson11WorkflowFailRun(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_ASSERT_NODE,
      pauseAfter: true,
    },
  ],
};
