/** Lesson GQL-2: Variables & Arguments — parameterized queries and the Variables panel */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  GQL_USER_QUERY,
  ensureDemoEndpoint,
  ensureExecutedWithAlice,
  ensureExecutedWithBob,
  ensureIntrospected,
  ensureParamUserQuery,
  ensureVariablesPanelOpen,
  fillGqlEditor,
  fillGqlVariables,
  getDemoUserAId,
  getDemoUserBId,
  gqlVariablesLessonCleanup,
  gqlVariablesLessonSetup,
  seedDemoUsers,
} from './graphql-lesson-helpers';

export const gqlVariablesLesson: DemoLesson = {
  id: 'gql-variables',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Variables & Arguments',
  description:
    'Write a parameterized GraphQL query, supply `$id` via the Variables panel, and re-run with different values to fetch different users.',
  estimatedMinutes: 3,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlVariablesLessonSetup,
  cleanup: gqlVariablesLessonCleanup,

  concept: {
    title: 'GraphQL Variables',
    body: `GraphQL **variables** let you write a query once and execute it many times with different inputs. Declare them in the operation signature — \`$id: ID!\` — and reference them in field arguments: \`user(id: $id)\`.

The **Variables** panel (bottom of the editor) holds a JSON object whose keys match your variable names. Change the JSON, click **Execute** again — the query text stays the same; only the variables change.

**Why variables matter:**
- **Reuse** — one query template, many parameter sets
- **Safety** — values are sent separately from the query string (not string interpolation)
- **Typing** — \`ID!\` means a required ID scalar; the server validates before resolving

This lesson creates two users — **Alice** and **Bob** — on the test server, then fetches each one by changing only the \`id\` variable.`,
    keyTerms: [
      {
        term: 'Variable definition',
        definition:
          'Syntax like `$id: ID!` in the operation signature. The `$` prefix marks a variable; `ID!` is a required ID scalar type.',
      },
      {
        term: 'Variable value',
        definition:
          'JSON in the Variables panel, e.g. `{ "id": "usr-1" }`. Keys must match variable names (without the `$`).',
      },
      {
        term: 'Argument',
        definition:
          'A value passed to a field, e.g. `user(id: $id)`. Arguments can be literals (`"abc"`) or variables (`$id`).',
      },
      {
        term: 'Required (`!`)',
        definition:
          'The exclamation mark means the value cannot be null. `ID!` requires a non-null ID; omitting it causes a validation error.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 130" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="gql2-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <rect x="10" y="20" width="130" height="55" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="75" y="40" text-anchor="middle" fill="var(--text)" font-size="9" font-family="monospace">query($id: ID!)</text>
  <text x="75" y="54" text-anchor="middle" fill="var(--text-muted)" font-size="8" font-family="monospace">{ user(id: $id) }</text>
  <text x="75" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">Editor — same query</text>
  <line x1="140" y1="47" x2="168" y2="47" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql2-arrow)"/>
  <rect x="168" y="20" width="90" height="55" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="213" y="40" text-anchor="middle" fill="var(--text)" font-size="9" font-family="monospace">{ "id": "…" }</text>
  <text x="213" y="58" text-anchor="middle" fill="var(--text-muted)" font-size="8">Variables panel</text>
  <line x1="258" y1="47" x2="286" y2="47" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql2-arrow)"/>
  <rect x="286" y="20" width="120" height="55" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="346" y="42" text-anchor="middle" fill="var(--text)" font-size="9">Alice → Bob</text>
  <text x="346" y="58" text-anchor="middle" fill="var(--text-muted)" font-size="8">Different response</text>
  <text x="210" y="100" text-anchor="middle" fill="var(--text-muted)" font-size="9">Change variables only — query text unchanged</text>
  <text x="210" y="118" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Variables &amp; Arguments</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql2-intro',
      title: 'Variables Panel',
      description:
        'Below the query editor are three tabs: **Variables**, **Headers**, and **Files**. The **Variables** tab holds a JSON object — one key per `$variable` in your query. You will write a parameterized query, then supply `$id` values here.',
      highlight: GQL.BOTTOM_TAB_VARS,
      pauseAfter: true,
    },

    {
      id: 'gql2-endpoint',
      title: 'Set the Endpoint',
      description:
        `Point at the test server: \`${GQL_DEMO_HTTP}\`. This is the same Docker server from Lesson 1 — port **4010** with \`user(id)\` and \`createUser\` mutations available.`,
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
      id: 'gql2-introspect',
      title: 'Introspect the Schema',
      description:
        'Click **Introspect** so autocomplete knows about the `user(id: ID!)` field and its return type. The green schema badge confirms the schema is loaded.',
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
      id: 'gql2-write-query',
      title: 'Write a Parameterized Query',
      description:
        'In the editor, write a named query with a **variable definition** and an **argument** reference:\n\n`query GetUser($id: ID!) { user(id: $id) { id name email } }`\n\nNotice `$id: ID!` in the signature and `id: $id` in the field argument — the query text never changes; only the variable value does.',
      highlight: GQL.EDITOR,
      preAction: async (ctx) => {
        await ensureIntrospected(ctx);
        await seedDemoUsers();
        const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
        if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
          await ctx.click(GQL.MODE_EDITOR);
          await ctx.delay(200);
        }
      },
      action: async (ctx) => {
        await ctx.click(GQL.MODE_EDITOR);
        await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
        await ctx.delay(600);
        await fillGqlEditor(ctx, GQL_USER_QUERY);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    {
      id: 'gql2-open-vars',
      title: 'Open the Variables Panel',
      description:
        'Click the **Variables** tab at the bottom of the editor area. The JSON editor starts empty — you will fill in the `id` key that matches your `$id` variable.',
      highlight: GQL.BOTTOM_TAB_VARS,
      preAction: ensureParamUserQuery,
      action: async (ctx) => {
        await ctx.click(GQL.BOTTOM_TAB_VARS);
        await ctx.waitFor(GQL.VARS_PANEL, 5000);
        await ctx.delay(800);
      },
      verify: GQL.VARS_PANEL,
      pauseAfter: true,
    },

    {
      id: 'gql2-execute-alice',
      title: 'Execute with Alice',
      description:
        'Set the variables JSON to `{ "id": "<alice-id>" }` — the lesson seeds **Alice** on the server during setup. Click **Execute** and read the response: you should see `"name": "Alice"` and her email.',
      highlight: GQL.VARS_PANEL,
      preAction: async (ctx) => {
        await ensureParamUserQuery(ctx);
        await ensureVariablesPanelOpen(ctx);
      },
      action: async (ctx) => {
        await seedDemoUsers();
        const aliceJson = JSON.stringify({ id: getDemoUserAId() }, null, 2);
        await fillGqlVariables(ctx, aliceJson);
        await ctx.delay(400);
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    {
      id: 'gql2-execute-bob',
      title: 'Re-run with Bob',
      description:
        'Change only the `id` value to **Bob**\'s user ID — leave the query untouched. Click **Execute** again. The response now shows `"name": "Bob"` — same query, different variable, different user.',
      highlight: GQL.VARS_PANEL,
      preAction: ensureExecutedWithAlice,
      action: async (ctx) => {
        await seedDemoUsers();
        const bobJson = JSON.stringify({ id: getDemoUserBId() }, null, 2);
        await fillGqlVariables(ctx, bobJson);
        await ctx.delay(400);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    {
      id: 'gql2-compare',
      title: 'Compare Results',
      description:
        'Look at the **Response** body — only the `id`, `name`, and `email` fields changed between runs. The query in the editor is identical; variables made the difference. This is how you parameterize API tests and reuse operations across environments.',
      highlight: GQL.RESPONSE_BODY,
      preAction: ensureExecutedWithBob,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },
  ],
};
