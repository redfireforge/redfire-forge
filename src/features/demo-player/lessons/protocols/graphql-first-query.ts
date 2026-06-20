/** Lesson GQL-1: Your First GraphQL Query — endpoint, introspect, execute, history */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  GQL_HEALTH_QUERY,
  ensureDemoEndpoint,
  ensureExecuted,
  ensureHealthQuery,
  ensureIntrospected,
  fillGqlEditor,
  gqlFirstQueryCleanup,
  gqlFirstQuerySetup,
} from './graphql-lesson-helpers';

export const gqlFirstQueryLesson: DemoLesson = {
  id: 'gql-first-query',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Your First GraphQL Query',
  description:
    'Connect to a GraphQL endpoint, introspect the schema, write a query, execute it, and find the result in History.',
  estimatedMinutes: 3,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlFirstQuerySetup,
  cleanup: gqlFirstQueryCleanup,

  concept: {
    title: 'GraphQL in RedfireForge',
    body: `**GraphQL Studio** is RedfireForge's dedicated workspace for exploring GraphQL APIs. Unlike REST, you ask for exactly the fields you need in a single round-trip.

**The typical flow:**
1. **Endpoint** — point at your GraphQL HTTP URL (e.g. \`${GQL_DEMO_HTTP}\`)
2. **Introspect** — download the server's schema so autocomplete and the Schema Explorer work
3. **Write** — compose a query in the Monaco editor (or use the visual Builder)
4. **Execute** — send the request and read the JSON response
5. **History** — every execution is auto-saved so you can reload or re-run later

This lesson uses the local Docker test server on port **4010**. Start it with the command shown in the prerequisite gate, then walk through all five steps above.`,
    keyTerms: [
      {
        term: 'Introspection',
        definition:
          'A built-in GraphQL query that returns the server schema — types, fields, and arguments. RedfireForge caches it for autocomplete and the Schema Explorer.',
      },
      {
        term: 'Operation',
        definition:
          'A named or anonymous query, mutation, or subscription sent to the server. This lesson uses a simple query operation.',
      },
      {
        term: 'Schema',
        definition:
          'The contract describing what queries are allowed and what types they return. Introspection populates the Schema tab on the right.',
      },
      {
        term: 'History',
        definition:
          'An auto-populated log of past executions. Each entry stores the query, variables, and response so you can reload without retyping.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="gql1-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <rect x="10" y="35" width="90" height="50" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="55" y="58" text-anchor="middle" fill="var(--text)" font-size="10" font-weight="600">Endpoint</text>
  <text x="55" y="72" text-anchor="middle" fill="var(--text-muted)" font-size="8">:4010/graphql</text>
  <line x1="100" y1="60" x2="125" y2="60" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql1-arrow)"/>
  <rect x="125" y="35" width="80" height="50" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="165" y="58" text-anchor="middle" fill="var(--text)" font-size="10" font-weight="600">Introspect</text>
  <text x="165" y="72" text-anchor="middle" fill="var(--text-muted)" font-size="8">schema</text>
  <line x1="205" y1="60" x2="230" y2="60" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql1-arrow)"/>
  <rect x="230" y="35" width="70" height="50" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="265" y="58" text-anchor="middle" fill="var(--text)" font-size="10" font-weight="600">Query</text>
  <text x="265" y="72" text-anchor="middle" fill="var(--text-muted)" font-size="8">editor</text>
  <line x1="300" y1="60" x2="325" y2="60" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql1-arrow)"/>
  <rect x="325" y="35" width="80" height="50" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="365" y="58" text-anchor="middle" fill="var(--text)" font-size="10" font-weight="600">Response</text>
  <text x="365" y="72" text-anchor="middle" fill="var(--text-muted)" font-size="8">+ History</text>
  <text x="210" y="105" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Your First GraphQL Query</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql1-intro',
      title: 'GraphQL Studio',
      description:
        'Welcome to **GraphQL Studio**. The **connection bar** at the top holds your endpoint URL, **Introspect**, and **Execute** buttons. The editor is in the centre; the **Response** and **Schema** tabs are on the right.',
      highlight: GQL.CONNECTION_BAR,
      pauseAfter: true,
    },

    {
      id: 'gql1-endpoint',
      title: 'Set the Endpoint',
      description:
        `Paste the test server URL into the endpoint field: \`${GQL_DEMO_HTTP}\`. This is the HTTP entry point for queries — the same server Playwright E2E tests use on port **4010**.`,
      highlight: GQL.ENDPOINT_INPUT,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
      },
      action: async (ctx) => {
        await ctx.fill(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
        await ctx.delay(400);
      },
      pauseAfter: true,
    },

    {
      id: 'gql1-introspect',
      title: 'Introspect the Schema',
      description:
        'Click **Introspect** to download the server schema. Watch for the green schema badge — it confirms autocomplete and the Schema Explorer are ready. Introspection is required before Execute is fully enabled.',
      highlight: GQL.INTROSPECT_BTN,
      preAction: ensureDemoEndpoint,
      action: async (ctx) => {
        if (!document.querySelector(GQL.SCHEMA_BADGE_OK)) {
          await ctx.click(GQL.INTROSPECT_BTN);
          await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
        }
        await ctx.delay(1500);
      },
      verify: GQL.SCHEMA_BADGE_OK,
      pauseAfter: true,
    },

    {
      id: 'gql1-schema',
      title: 'Explore the Schema',
      description:
        'Open the **Schema** tab on the right. Browse the type list — you should see **Query** with fields like `health` and `user`. This tree is built from introspection; clicking a field can insert it into your query later.',
      highlight: GQL.RIGHT_TAB_SCHEMA,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_SCHEMA);
        await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
        await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
        await ctx.delay(800);
      },
      verify: GQL.SCHEMA_TYPE_LIST,
      pauseAfter: true,
    },

    {
      id: 'gql1-write-query',
      title: 'Write a Query',
      description:
        'Switch back to **Editor** mode and type a minimal query. We use `query { health }` — it asks the server for its health-check field and needs no variables. Watch the Monaco editor update as you type.',
      highlight: GQL.EDITOR,
      preAction: async (ctx) => {
        await ensureIntrospected(ctx);
        const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
        if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
          await ctx.click(GQL.MODE_EDITOR);
          await ctx.delay(200);
        }
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(GQL.MODE_EDITOR);
        await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
        await ctx.delay(600);
        await fillGqlEditor(ctx, GQL_HEALTH_QUERY);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    {
      id: 'gql1-execute',
      title: 'Execute the Query',
      description:
        'Click **Execute** (or press the keyboard shortcut). The **Response** tab shows HTTP status, latency, and the JSON body. You should see `"health": "ok"` in the response data.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureHealthQuery,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    {
      id: 'gql1-history',
      title: 'History Auto-Save',
      description:
        'Every successful execution is **auto-saved** to History. Click the **History** icon in the left activity bar — your `health` query appears with a timestamp. Single-click an entry to preview; use **Load** or **Run** from the preview panel (Lesson 8 covers the full workflow).',
      highlight: GQL.ACTIVITY_HISTORY,
      preAction: ensureExecuted,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(300);
        await ctx.click(GQL.ACTIVITY_HISTORY);
        await ctx.waitFor(GQL.HISTORY_PANEL, 5000);
        await ctx.waitFor(GQL.HISTORY_ENTRY, 5000);
        await ctx.delay(700);
      },
      verify: GQL.HISTORY_ENTRY,
      pauseAfter: true,
    },
  ],
};
