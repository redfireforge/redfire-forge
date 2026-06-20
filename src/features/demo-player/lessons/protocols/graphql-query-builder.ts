/** Lesson GQL-7: Query Builder — Visual Operations */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_DEMO_HTTP,
  LESSON7_EDITOR_COMMENT,
  ensureAliasConfigured,
  ensureBuilderMode,
  ensureEditedToEditor,
  ensureHealthFieldSelected,
  ensureIncludeConfigured,
  ensureIntrospected,
  ensureSelectAllDemonstrated,
  ensureUserFieldConfigured,
  fillGqlEditor,
  getBuilderCodeText,
  getMonacoGqlModel,
  gqlQueryBuilderLessonCleanup,
  gqlQueryBuilderLessonSetup,
} from './graphql-lesson-helpers';

export const gqlQueryBuilderLesson: DemoLesson = {
  id: 'gql-query-builder',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Query Builder — Visual Operations',
  description:
    'Build GraphQL queries visually: field tree selection, live SDL preview, aliases and directives in the Summary panel, copy/export, and one-way sync to the editor.',
  estimatedMinutes: 4,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlQueryBuilderLessonSetup,
  cleanup: gqlQueryBuilderLessonCleanup,

  concept: {
    title: 'Visual Query Builder',
    body: `The **Builder** mode toggle replaces Monaco with a three-panel workspace: **field tree** (left), **live SDL preview** (center), and **Summary** (right).

Check fields to build a query without writing SDL by hand. Required arguments appear inline under the field row. **Field Options** in the Summary panel add per-field **aliases** and **@include / @skip** directives.

**Edit in Editor** copies the generated query into Monaco and switches back to Editor mode — but edits in Monaco are **not** parsed back into the builder (one-way sync). Use Builder for exploration; use Editor for fine-tuning.`,
    keyTerms: [
      {
        term: 'Builder mode',
        definition:
          'Visual query construction UI toggled via the Builder button (`gql-mode-builder`). Requires an introspected schema.',
      },
      {
        term: 'Field tree',
        definition:
          'Hierarchical checklist of schema fields on the Query/Mutation/Subscription root type. Leaf scalars are selectable directly.',
      },
      {
        term: 'Summary panel',
        definition:
          'Right-side panel with field stats, path search, and per-field alias/directive controls (`gql-qb-field-options`).',
      },
      {
        term: 'One-way sync',
        definition:
          'Builder → Editor via **Edit in Editor** or **Execute**. Manual editor changes do not update builder selection state.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="25" width="95" height="70" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="57" y="48" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Field tree</text>
  <text x="57" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="8">health · user</text>
  <rect x="115" y="25" width="110" height="70" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="170" y="48" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">SDL preview</text>
  <text x="170" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="8">gql-qb-code</text>
  <rect x="235" y="25" width="95" height="70" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="282" y="48" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Summary</text>
  <text x="282" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="8">alias · @include</text>
  <rect x="340" y="25" width="70" height="70" rx="6" fill="var(--success)" opacity="0.12" stroke="var(--success)" stroke-width="1.5"/>
  <text x="375" y="52" text-anchor="middle" fill="var(--text)" font-size="8">Edit in</text>
  <text x="375" y="66" text-anchor="middle" fill="var(--text)" font-size="8">Editor →</text>
  <text x="210" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Query Builder</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql7-builder',
      title: 'Builder Mode Toggle',
      description:
        `Click **Builder** on the editor toolbar (\`gql-mode-builder\`) to open the visual workspace. With \`${GQL_DEMO_HTTP}\` introspected, the left panel lists **Query** root fields — \`health\` and \`user(id: ID!)\`.`,
      highlight: GQL.QB_FIELD_TREE,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ensureBuilderMode(ctx);
        await ctx.delay(800);
      },
      verify: GQL.QB_FIELD_TREE,
      pauseAfter: true,
    },

    {
      id: 'gql7-expand',
      title: 'Explore the Query Root',
      description:
        'The **Query** type header shows field count and a **Select all** shortcut. Expand the **user** row (›) to reveal scalar subfields `id`, `name`, and `email` — flat on this test schema.',
      highlight: GQL.QB_FIELD_TREE,
      preAction: ensureBuilderMode,
      action: async (ctx) => {
        const userRow = document.querySelectorAll('.gql-qb-field-row');
        const row = Array.from(userRow).find(
          (r) => r.querySelector('.gql-qb-field-name')?.textContent?.trim() === 'user',
        );
        const expand = row?.querySelector<HTMLElement>('.gql-qb-expand-btn');
        if (expand && !expand.classList.contains('gql-qb-expand-btn--open')) {
          expand.click();
          await ctx.delay(600);
        }
        await ctx.delay(800);
      },
      verify: GQL.QB_FIELD_TREE,
      pauseAfter: true,
    },

    {
      id: 'gql7-health',
      title: 'Select a Field',
      description:
        'Check **health** in the field tree. The center **SDL preview** (`gql-qb-code`) updates live — you should see `query { health }` without typing.',
      highlight: GQL.QB_CODE,
      preAction: ensureBuilderMode,
      action: async (ctx) => {
        await ensureHealthFieldSelected(ctx);
        await ctx.waitFor(GQL.QB_CODE, 5000);
        await ctx.delay(800);
      },
      verify: GQL.QB_CODE,
      pauseAfter: true,
    },

    {
      id: 'gql7-select-all',
      title: 'Select All / Deselect All',
      description:
        'Click **+ all** (`gql-qb-select-all`) to select every leaf field at the current level, then click again (**✕ all**) to deselect. This is faster than toggling fields one by one.',
      highlight: GQL.QB_SELECT_ALL,
      preAction: ensureHealthFieldSelected,
      action: async (ctx) => {
        await ctx.click(GQL.QB_SELECT_ALL);
        await ctx.delay(600);
        await ctx.click(GQL.QB_SELECT_ALL);
        await ctx.delay(800);
      },
      verify: GQL.QB_SELECT_ALL,
      pauseAfter: true,
    },

    {
      id: 'gql7-user-arg',
      title: 'Arguments on Fields',
      description:
        'Check **user** → an inline **id** argument row appears (`gql-qb-arg-user-id`). Fill it with a user id from the seeded demo user — required for `user(id: ID!)`.',
      highlight: GQL.QB_ARG_USER_ID,
      preAction: ensureSelectAllDemonstrated,
      action: async (ctx) => {
        await ensureUserFieldConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.QB_ARG_USER_ID,
      pauseAfter: true,
    },

    {
      id: 'gql7-alias',
      title: 'Field Alias',
      description:
        'In the **Summary** panel → **Field Options**, expand the **id** row under `user` and set alias **`userId`**. The preview renames the field in generated SDL.',
      highlight: GQL.FO_ALIAS_USER_ID,
      preAction: ensureUserFieldConfigured,
      action: async (ctx) => {
        await ensureAliasConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.FO_ALIAS_USER_ID,
      pauseAfter: true,
    },

    {
      id: 'gql7-include',
      title: '@include Directive',
      description:
        'Toggle **@include** on the same `user.id` row (`gql-fo-include-user.id`). The SDL preview adds `@include(if: …)` — conditional field inclusion at runtime.',
      highlight: GQL.FO_INCLUDE_USER_ID,
      preAction: ensureAliasConfigured,
      action: async (ctx) => {
        await ensureIncludeConfigured(ctx);
        await ctx.waitFor(GQL.QB_CODE, 5000);
        await ctx.delay(800);
      },
      verify: GQL.QB_CODE,
      pauseAfter: true,
    },

    {
      id: 'gql7-copy',
      title: 'Copy Generated SDL',
      description:
        'Click **Copy** (`gql-qb-copy`) in the builder toolbar — the generated query is copied to your clipboard. The button briefly shows **Copied** as confirmation.',
      highlight: GQL.QB_COPY,
      preAction: ensureIncludeConfigured,
      action: async (ctx) => {
        await ctx.click(GQL.QB_COPY);
        await ctx.delay(1500);
      },
      verify: GQL.QB_COPY,
      pauseAfter: true,
    },

    {
      id: 'gql7-edit',
      title: 'Edit in Editor',
      description:
        'Click **Edit in Editor** (`gql-qb-edit`) — the generated SDL transfers to Monaco and **Builder mode turns off**. Variables from the builder sync to the Variables tab when present.',
      highlight: GQL.QB_EDIT,
      preAction: ensureIncludeConfigured,
      action: async (ctx) => {
        await ensureEditedToEditor(ctx);
        await ctx.delay(800);
      },
      verify: GQL.MODE_EDITOR,
      pauseAfter: true,
    },

    {
      id: 'gql7-one-way',
      title: 'One-Way Sync',
      description:
        `Add a comment in Monaco (\`${LESSON7_EDITOR_COMMENT}\`), then switch back to **Builder**. The preview still reflects the last builder state — editor edits are **not** parsed back. Builder → Editor only.`,
      highlight: GQL.MODE_EDITOR,
      preAction: ensureEditedToEditor,
      action: async (ctx) => {
        const model = getMonacoGqlModel();
        const current = model?.getValue() ?? '';
        if (!current.includes(LESSON7_EDITOR_COMMENT)) {
          await fillGqlEditor(ctx, `${current}\n${LESSON7_EDITOR_COMMENT}`, { focus: false });
        }
        await ctx.delay(500);
        await ctx.click(GQL.MODE_BUILDER);
        await ctx.waitFor(GQL.QB_CODE, 5000);
        await ctx.delay(800);
        const preview = getBuilderCodeText();
        if (!preview.includes(LESSON7_EDITOR_COMMENT)) {
          await ctx.delay(400);
        }
        await ctx.click(GQL.MODE_EDITOR);
        await ctx.delay(400);
      },
      verify: GQL.MODE_EDITOR,
      pauseAfter: true,
    },
  ],
};
