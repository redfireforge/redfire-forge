/** Lesson GQL-3: Mutations — Create, Delete & Input Types */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_CREATE_ORDER_MUTATION,
  GQL_CREATE_ORDER_VARS,
  GQL_CREATE_USER_MUTATION,
  GQL_CREATE_USER_VARS,
  GQL_DELETE_USER_MUTATION,
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  ensureCreateOrderExecuted,
  ensureCreateUserExecuted,
  ensureCreateUserMutation,
  ensureDeleteUserMutation,
  ensureDemoEndpoint,
  ensureIntrospected,
  ensureVariablesPanelOpen,
  fillGqlEditor,
  fillGqlVariables,
  getLesson3CreatedUserId,
  gqlMutationsLessonCleanup,
  gqlMutationsLessonSetup,
  parseCreatedUserIdFromResponse,
  storeCreatedUserIdFromResponse,
} from './graphql-lesson-helpers';

export const gqlMutationsLesson: DemoLesson = {
  id: 'gql-mutations',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Mutations — Create, Update, Delete',
  description:
    'Write GraphQL mutations to create and delete data, use an input object type, and observe idempotent delete behaviour on the test server.',
  estimatedMinutes: 4,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlMutationsLessonSetup,
  cleanup: gqlMutationsLessonCleanup,

  concept: {
    title: 'GraphQL Mutations',
    body: `**Mutations** are GraphQL operations that change server-side data — create, update, or delete records. They use the \`mutation\` keyword instead of \`query\`.

When you type a mutation in the editor, the active tab badge switches from **Q** to **M** (amber). Mutations can take:
- **Scalar arguments** — \`createUser(name: $name, email: $email)\`
- **Input object types** — \`createOrder(input: $input)\` where \`OrderInput\` groups related fields

The test server on port **4010** exposes \`createUser\`, \`createOrder\`, and \`deleteUser\`. There is no \`updateUser\` — this lesson verifies create → read response → delete → **idempotent** re-delete (\`success: false\` when the user is already gone).`,
    keyTerms: [
      {
        term: 'Mutation',
        definition:
          'A GraphQL operation that modifies data. Declared with `mutation OperationName { ... }`. The tab bar shows an **M** badge.',
      },
      {
        term: 'Input type',
        definition:
          'A structured argument object defined in the schema, e.g. `input OrderInput { customerId: ID!, items: [String!] }`. Passed as a single `$input` variable.',
      },
      {
        term: 'DeleteResult',
        definition:
          'The return type of `deleteUser` — `{ success: Boolean! }`. `true` when a row was removed; `false` when the id was already absent.',
      },
      {
        term: 'Idempotency',
        definition:
          'Calling delete twice with the same id is safe: the first call returns `success: true`, the second returns `success: false` without a server error.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 130" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="gql3-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <rect x="10" y="25" width="95" height="50" rx="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="57" y="48" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">createUser</text>
  <text x="57" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="8">Carol → usr-N</text>
  <line x1="105" y1="50" x2="130" y2="50" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql3-arrow)"/>
  <rect x="130" y="25" width="95" height="50" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="177" y="48" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">createOrder</text>
  <text x="177" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="8">OrderInput!</text>
  <line x1="225" y1="50" x2="250" y2="50" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql3-arrow)"/>
  <rect x="250" y="25" width="80" height="50" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="290" y="48" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">deleteUser</text>
  <text x="290" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="8">$id variable</text>
  <line x1="330" y1="50" x2="355" y2="50" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql3-arrow)"/>
  <rect x="355" y="25" width="55" height="50" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="382" y="48" text-anchor="middle" fill="var(--text)" font-size="8">success:</text>
  <text x="382" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="8">false</text>
  <text x="210" y="95" text-anchor="middle" fill="var(--text-muted)" font-size="9">Same mutation + vars → second delete is idempotent</text>
  <text x="210" y="118" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Mutations</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql3-intro',
      title: 'Mutation Operations',
      description:
        '**Mutations** change data on the server — unlike queries, which only read. When your editor contains a `mutation` block, the tab badge switches from **Q** (query) to **M** (mutation, amber). This lesson walks through create and delete on the port **4010** test server.',
      highlight: GQL.TAB_BAR,
      pauseAfter: true,
    },

    {
      id: 'gql3-endpoint',
      title: 'Set the Endpoint',
      description:
        `Connect to \`${GQL_DEMO_HTTP}\`. The server exposes \`createUser\`, \`createOrder\`, and \`deleteUser\` mutations alongside the \`user\` query from Lesson 2.`,
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
      id: 'gql3-introspect',
      title: 'Introspect the Schema',
      description:
        'Click **Introspect** to load the `Mutation` type — you need `createUser`, `createOrder`, and `deleteUser` in the schema tree for autocomplete.',
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
      id: 'gql3-write-create',
      title: 'Write a Create Mutation',
      description:
        'Replace the query with a **createUser** mutation:\n\n`mutation CreateUser($name: String!, $email: String!) { createUser(name: $name, email: $email) { id name email } }`\n\nWatch the tab badge flip to **M** — RedfireForge detects the operation type from the `mutation` keyword.',
      highlight: GQL.EDITOR,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ctx.click(GQL.MODE_EDITOR);
        await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
        await ctx.delay(600);
        await fillGqlEditor(ctx, GQL_CREATE_USER_MUTATION);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    {
      id: 'gql3-create-exec',
      title: 'Execute Create',
      description:
        'Open **Variables** and set `{ "name": "Carol", "email": "carol@demo.local" }`, then click **Execute**. The server allocates a new `id` (e.g. `usr-1`) and returns the created user in the response panel.',
      highlight: GQL.VARS_PANEL,
      preAction: ensureCreateUserMutation,
      action: async (ctx) => {
        await ensureVariablesPanelOpen(ctx);
        await fillGqlVariables(ctx, GQL_CREATE_USER_VARS);
        await ctx.delay(400);
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        storeCreatedUserIdFromResponse();
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    {
      id: 'gql3-observe-create',
      title: 'Read the Create Response',
      description:
        'Inspect the **Response** body — note the `id`, `name`, and `email` fields under `data.createUser`. Save this `id` mentally; you will pass it to `deleteUser` in a later step via the `$id` variable.',
      highlight: GQL.RESPONSE_BODY,
      preAction: ensureCreateUserExecuted,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },

    {
      id: 'gql3-input-type',
      title: 'Input Object Type',
      description:
        'Switch the editor to **createOrder** — this mutation uses an **input object** `OrderInput!` instead of separate scalar args:\n\n`mutation CreateOrder($input: OrderInput!) { createOrder(input: $input) { id status } }`\n\nSet variables to `{ "input": { "customerId": "cust-demo", "items": ["widget", "gadget"] } }` and **Execute**.',
      highlight: GQL.EDITOR,
      preAction: ensureCreateUserExecuted,
      action: async (ctx) => {
        await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION);
        await ctx.delay(500);
        await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS);
        await ctx.delay(400);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    {
      id: 'gql3-write-delete',
      title: 'Write Delete Mutation',
      description:
        'Load the **deleteUser** mutation and wire the `$id` variable to Carol\'s id from step 6:\n\n`mutation DeleteUser($id: ID!) { deleteUser(id: $id) { success } }`\n\nVariables: `{ "id": "<created-user-id>" }` — the lesson fills the real id captured from the create response.',
      highlight: GQL.VARS_PANEL,
      preAction: ensureCreateOrderExecuted,
      action: async (ctx) => {
        await fillGqlEditor(ctx, GQL_DELETE_USER_MUTATION);
        await ctx.delay(500);
        await ensureVariablesPanelOpen(ctx);
        const userId = getLesson3CreatedUserId() || parseCreatedUserIdFromResponse() || '';
        if (userId) {
          await fillGqlVariables(ctx, JSON.stringify({ id: userId }, null, 2));
        }
        await ctx.delay(700);
      },
      pauseAfter: true,
    },

    {
      id: 'gql3-idempotency',
      title: 'Delete & Idempotency',
      description:
        'Click **Execute** — `success: true` removes Carol. Click **Execute** again with the same `$id` — the server returns `success: false` (user already gone). This is **idempotent** delete semantics: no error, just a boolean flag.',
      highlight: GQL.RESPONSE_BODY,
      preAction: ensureDeleteUserMutation,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },
  ],
};
