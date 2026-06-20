/** Lesson GQL-9: Export & Share Queries */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_DEMO_HTTP,
  ensureBuilderHealthAndUserSelected,
  ensureBuilderSdlCopied,
  ensureExportBuilderEditedToEditor,
  ensureHistoryCopyAsCurl,
  ensureIntrospected,
  getBuilderCodeText,
  gqlExportShareLessonCleanup,
  gqlExportShareLessonSetup,
} from './graphql-lesson-helpers';

export const gqlExportShareLesson: DemoLesson = {
  id: 'gql-export-share',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Export & Share Queries',
  description:
    'Export GraphQL operations via Builder preview, copy SDL, transfer to the editor, and share as cURL from History.',
  estimatedMinutes: 3,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlExportShareLessonSetup,
  cleanup: gqlExportShareLessonCleanup,

  concept: {
    title: 'Export Surfaces',
    body: `GraphQL Studio does **not** ship a multi-target Code Gen panel (TypeScript clients, Python gql, etc.). The real export paths are:

1. **Query Builder** — live SDL in \`gql-qb-code\`, **Copy** to clipboard, **Edit in Editor** to Monaco
2. **History** — right-click any execution → **Copy as cURL** for shell-ready sharing

This lesson walks through both — build a query visually, export the SDL, then generate a cURL command from a real execution.`,
    keyTerms: [
      {
        term: 'SDL preview',
        definition:
          'Generated query text in the Builder center panel (`gql-qb-code`). Updates live as you check fields.',
      },
      {
        term: 'Copy (Builder)',
        definition:
          'Toolbar button (`gql-qb-copy`) copies the generated SDL to your clipboard.',
      },
      {
        term: 'Edit in Editor',
        definition:
          'One-way transfer from Builder to Monaco (`gql-qb-edit`). Switches back to Editor mode.',
      },
      {
        term: 'Copy as cURL',
        definition:
          'History context-menu action — builds `curl -X POST` with endpoint, query, and variables JSON.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="15" y="28" width="85" height="64" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="57" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Builder</text>
  <text x="57" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">health+user</text>
  <rect x="110" y="28" width="75" height="64" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="147" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Copy</text>
  <text x="147" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">SDL</text>
  <rect x="195" y="28" width="80" height="64" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="235" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Editor</text>
  <text x="235" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">Monaco</text>
  <rect x="285" y="28" width="55" height="64" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="312" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Run</text>
  <text x="312" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">execute</text>
  <rect x="350" y="28" width="55" height="64" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="377" y="52" text-anchor="middle" fill="var(--text)" font-size="8">cURL</text>
  <text x="377" y="66" text-anchor="middle" fill="var(--text-muted)" font-size="7">History</text>
  <text x="210" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Export &amp; Share</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql9-builder',
      title: 'Build in Query Builder',
      description:
        `Switch to **Builder** mode after introspecting \`${GQL_DEMO_HTTP}\`. Check **health** and **user** — fill the required \`id\` argument on \`user\`. The SDL preview updates with both fields.`,
      highlight: GQL.QB_FIELD_TREE,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ensureBuilderHealthAndUserSelected(ctx);
        await ctx.waitFor(GQL.QB_CODE, 5000);
        await ctx.delay(800);
      },
      verify: GQL.QB_CODE,
      pauseAfter: true,
    },

    {
      id: 'gql9-preview',
      title: 'Read the Live Preview',
      description:
        'Watch the center **SDL preview** (`gql-qb-code`) — it shows the complete generated query with both `health` and `user(id: …)` fields. This is the canonical export surface (no separate Code Gen panel).',
      highlight: GQL.QB_CODE,
      preAction: ensureBuilderHealthAndUserSelected,
      action: async (ctx) => {
        await ctx.waitFor(GQL.QB_CODE, 5000);
        const code = getBuilderCodeText();
        if (!code.includes('health') || !code.includes('user')) {
          await ensureBuilderHealthAndUserSelected(ctx);
        }
        await ctx.delay(800);
      },
      verify: GQL.QB_CODE,
      pauseAfter: true,
    },

    {
      id: 'gql9-copy',
      title: 'Copy SDL to Clipboard',
      description:
        'Click **Copy** (`gql-qb-copy`) in the Builder toolbar — the generated query is copied to your clipboard. The button briefly shows **Copied** as confirmation.',
      highlight: GQL.QB_COPY,
      preAction: ensureBuilderHealthAndUserSelected,
      action: async (ctx) => {
        await ensureBuilderSdlCopied(ctx);
        await ctx.delay(800);
      },
      verify: GQL.QB_COPY,
      pauseAfter: true,
    },

    {
      id: 'gql9-edit',
      title: 'Edit in Editor',
      description:
        'Click **Edit in Editor** (`gql-qb-edit`) — the SDL transfers to Monaco and **Builder mode turns off**. You can fine-tune the query text before executing.',
      highlight: GQL.QB_EDIT,
      preAction: ensureBuilderHealthAndUserSelected,
      action: async (ctx) => {
        await ensureExportBuilderEditedToEditor(ctx);
        await ctx.delay(800);
      },
      verify: GQL.MODE_EDITOR,
      pauseAfter: true,
    },

    {
      id: 'gql9-curl',
      title: 'Copy as cURL from History',
      description:
        'Click **Execute** to run the query, then open **History** → **right-click** the entry → **Copy as cURL**. A `curl -X POST` command with your endpoint and JSON body is copied — ready to paste into a terminal or share with teammates.',
      highlight: GQL.HISTORY_CONTEXT_MENU,
      preAction: ensureExportBuilderEditedToEditor,
      action: async (ctx) => {
        await ensureHistoryCopyAsCurl(ctx);
        await ctx.delay(800);
      },
      verify: GQL.HISTORY_ENTRY,
      pauseAfter: true,
    },
  ],
};
