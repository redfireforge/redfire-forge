/** Lesson GQL-4: Schema Exploration — browse, search, Try → insert, SDL export */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  ensureDemoEndpoint,
  ensureEditorReadyForInsert,
  ensureIntrospected,
  ensureQueryTypeSelected,
  ensureTryInsertDone,
  ensureUserTypeSelected,
  gqlSchemaLessonCleanup,
  gqlSchemaLessonSetup,
  markTryInsertDone,
  searchSchemaTypes,
  selectSchemaType,
} from './graphql-lesson-helpers';

export const gqlSchemaLesson: DemoLesson = {
  id: 'gql-schema-exploration',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Schema Exploration',
  description:
    'Browse the introspected schema, search types, inspect fields and arguments, insert fields with Try →, and export SDL.',
  estimatedMinutes: 3,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlSchemaLessonSetup,
  cleanup: gqlSchemaLessonCleanup,

  concept: {
    title: 'Schema Explorer',
    body: `After **Introspect**, the **Schema** tab on the right becomes a navigable contract browser. The explorer shows every type in your API — \`Query\`, \`Mutation\`, \`User\`, \`Order\`, and more.

**Key capabilities:**
- **Type list** — filter by kind (Object, Input, Enum) or search by name
- **Field table** — name, return type, arguments, and description per field
- **Try →** — insert a field into the active query editor at the cursor
- **SDL tab** — read the raw schema definition for any type; **Export SDL** downloads the full schema

Lesson 1 gave a quick peek at the type list. This lesson goes deeper: search, field inspection, click-to-insert, and SDL export on the port **4010** test server.`,
    keyTerms: [
      {
        term: 'SDL',
        definition:
          'Schema Definition Language — the textual form of your GraphQL schema (`type Query { … }`). View per-type SDL in the Schema tab.',
      },
      {
        term: 'Try →',
        definition:
          'Button on each field row that inserts the field name at the editor cursor. Fields with arguments get `()` appended.',
      },
      {
        term: 'Type kind',
        definition:
          'GraphQL type category: OBJECT, INPUT_OBJECT, ENUM, SCALAR, etc. Color-coded icons in the type list.',
      },
      {
        term: 'Export SDL',
        definition:
          'Downloads the full introspected schema as a `.graphql` file — useful for version control and schema diff.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="20" width="100" height="80" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="60" y="42" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Type list</text>
  <text x="60" y="58" text-anchor="middle" fill="var(--text-muted)" font-size="8">Query, User…</text>
  <text x="60" y="72" text-anchor="middle" fill="var(--text-muted)" font-size="8">Search filter</text>
  <rect x="120" y="20" width="110" height="80" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="175" y="42" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Field table</text>
  <text x="175" y="58" text-anchor="middle" fill="var(--text-muted)" font-size="8">name · type · args</text>
  <text x="175" y="74" text-anchor="middle" fill="var(--primary)" font-size="8">Try →</text>
  <rect x="240" y="20" width="80" height="80" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="280" y="48" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">SDL tab</text>
  <text x="280" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="8">type Query</text>
  <rect x="330" y="20" width="80" height="80" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="370" y="48" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Export</text>
  <text x="370" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="8">.graphql file</text>
  <text x="210" y="110" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Schema Exploration</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql4-intro',
      title: 'Schema Explorer',
      description:
        'The **Schema** tab on the right pane is your API contract browser. After introspection it lists every type — objects, inputs, enums, and scalars — with a searchable type list and a detail panel for fields.',
      highlight: GQL.RIGHT_TAB_SCHEMA,
      pauseAfter: true,
    },

    {
      id: 'gql4-endpoint',
      title: 'Set the Endpoint',
      description:
        `Connect to \`${GQL_DEMO_HTTP}\`. The test server schema includes \`Query\`, \`Mutation\`, \`User\`, \`Order\`, and \`OrderInput\` types for this walkthrough.`,
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
      id: 'gql4-introspect',
      title: 'Introspect the Schema',
      description:
        'Click **Introspect** to populate the Schema Explorer. The green badge confirms the schema is cached — the type list fills with Query, Mutation, User, and more.',
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
      id: 'gql4-browse',
      title: 'Browse Types',
      description:
        'Open the **Schema** tab and click **Query** in the type list. The detail panel shows root fields — `health` (no args) and `user(id: ID!)` (required argument). Each row has a **Try →** button for click-to-insert.',
      highlight: GQL.SCHEMA_TYPE_LIST,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_SCHEMA);
        await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
        await selectSchemaType(ctx, 'Query');
        await ctx.waitFor(GQL.SCHEMA_FIELDS_TAB, 5000);
        await ctx.delay(800);
      },
      verify: GQL.SCHEMA_TYPE_DETAIL,
      pauseAfter: true,
    },

    {
      id: 'gql4-search',
      title: 'Search & Inspect Fields',
      description:
        'Use the **search** box to filter types — type `User` to hide unrelated entries. Click **User** and read the field table: `id`, `name`, and `email` with their scalar types. The **Args** column shows `—` when a field has no arguments.',
      highlight: GQL.SCHEMA_SEARCH,
      preAction: ensureQueryTypeSelected,
      action: async (ctx) => {
        await searchSchemaTypes(ctx, 'User');
        await selectSchemaType(ctx, 'User');
        await ctx.delay(800);
      },
      verify: GQL.SCHEMA_TYPE_DETAIL,
      pauseAfter: true,
    },

    {
      id: 'gql4-try-insert',
      title: 'Try → Insert',
      description:
        'Select **Query** again, then click **Try →** on the `health` field. The field name is inserted at your editor cursor and a toast confirms **Inserted: health**. Fields with arguments (like `user`) insert `user()` so you can fill args next.',
      highlight: GQL.TRY_FIELD_HEALTH,
      preAction: async (ctx) => {
        await ensureUserTypeSelected(ctx);
        await selectSchemaType(ctx, 'Query');
        await ensureEditorReadyForInsert(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GQL.TRY_FIELD_HEALTH);
        await ctx.waitFor(GQL.INSERT_FIELD_TOAST, 5000);
        await ctx.delay(700);
        markTryInsertDone();
      },
      verify: GQL.INSERT_FIELD_TOAST,
      pauseAfter: true,
    },

    {
      id: 'gql4-sdl-export',
      title: 'SDL View & Export',
      description:
        'In the type detail panel, switch to the **SDL** tab to see the raw `type Query { … }` definition. Click **Export SDL** in the explorer toolbar to download the full schema as a `.graphql` file — useful for diffs and documentation.',
      highlight: GQL.SNAPSHOT_BTN,
      preAction: ensureTryInsertDone,
      action: async (ctx) => {
        await selectSchemaType(ctx, 'Query');
        await ctx.click(GQL.SCHEMA_SDL_TAB);
        await ctx.waitFor(GQL.SCHEMA_SDL_VIEW, 5000);
        await ctx.delay(600);
        await ctx.click(GQL.SNAPSHOT_BTN);
        await ctx.delay(700);
      },
      verify: GQL.SCHEMA_SDL_VIEW,
      pauseAfter: true,
    },
  ],
};
