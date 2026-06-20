/** Lesson GQL-8: Collections & History */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  LESSON8_ITEM_NAME,
  LESSON8_ITEM_RENAME,
  ensureCollectionItemRenamed,
  ensureCollectionRestoredViaImport,
  ensureHealthExecutedWithHistory,
  ensureHealthQuery,
  ensureHistoryLoadedToEditor,
  ensureHistoryPreviewOpen,
  ensureHistoryRunExecuted,
  ensureIntrospected,
  ensureSavedToCollectionFromHistory,
  gqlCollectionsHistoryLessonCleanup,
  gqlCollectionsHistoryLessonSetup,
  openHistoryPanel,
} from './graphql-lesson-helpers';

export const gqlCollectionsHistoryLesson: DemoLesson = {
  id: 'gql-collections-history',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Collections & History',
  description:
    'Use execution History to preview, load, and re-run queries; save operations to Collections; rename items; export and import collection JSON.',
  estimatedMinutes: 3,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlCollectionsHistoryLessonSetup,
  cleanup: gqlCollectionsHistoryLessonCleanup,

  concept: {
    title: 'History & Collections',
    body: `Every **Execute** auto-appends to **History** — query text, variables, response, and timing. Single-click an entry for a read-only **preview**; **Load** copies the query into the editor without running; **Run** loads **and** executes.

**Collections** persist named operations across sessions. Save from History or the Collections panel, organize in folders, **rename** via the context menu, **export** JSON for sharing, and **import** to restore on another machine.`,
    keyTerms: [
      {
        term: 'History',
        definition:
          'Auto-logged execution list in the left activity bar. Preview panel shows query + response with Load / Run / Save actions.',
      },
      {
        term: 'Load vs Run',
        definition:
          '`gql-history-load` loads into Monaco only. `gql-history-run` loads and executes immediately — do not confuse with double-click on collection items.',
      },
      {
        term: 'Collection',
        definition:
          'Named group of saved GraphQL operations stored locally (IDB). Export produces `redfire-graphql-collections*.json`.',
      },
      {
        term: 'Import merge',
        definition:
          'Import dialog offers **Merge** (keep existing, add new) or **Replace** (destructive overwrite). Lesson 8 uses Merge after delete-restore.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="28" width="70" height="64" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="45" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Execute</text>
  <text x="45" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">health</text>
  <rect x="90" y="28" width="75" height="64" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="127" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">History</text>
  <text x="127" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">preview</text>
  <rect x="175" y="28" width="70" height="64" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="210" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Load</text>
  <text x="210" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">no exec</text>
  <rect x="255" y="28" width="70" height="64" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="290" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Collection</text>
  <text x="290" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">save</text>
  <rect x="335" y="28" width="75" height="64" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="372" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Export</text>
  <text x="372" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">import</text>
  <text x="210" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Collections &amp; History</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql8-execute',
      title: 'Execute & History Entry',
      description:
        `With \`query { health }\` in the editor, click **Execute**. Open the **History** activity panel — a new entry appears with status, latency, and timestamp.`,
      highlight: GQL.HISTORY_ENTRY,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ensureHealthQuery(ctx);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(500);
        await openHistoryPanel(ctx);
        await ctx.waitFor(GQL.HISTORY_ENTRY, 8000);
        await ctx.delay(800);
      },
      verify: GQL.HISTORY_ENTRY,
      pauseAfter: true,
    },

    {
      id: 'gql8-preview',
      title: 'Preview a History Entry',
      description:
        '**Single-click** a history row — the preview panel (`gql-history-preview`) shows the query text and formatted response JSON. This is read-only until you choose an action.',
      highlight: GQL.HISTORY_PREVIEW,
      preAction: ensureHealthExecutedWithHistory,
      action: async (ctx) => {
        await ensureHistoryPreviewOpen(ctx);
        await ctx.delay(800);
      },
      verify: GQL.HISTORY_PREVIEW,
      pauseAfter: true,
    },

    {
      id: 'gql8-load',
      title: 'Load into Editor',
      description:
        'Click **Load** (`gql-history-load`) — the query transfers to Monaco **without** executing. Use this when you want to edit before running again.',
      highlight: GQL.HISTORY_LOAD,
      preAction: ensureHistoryPreviewOpen,
      action: async (ctx) => {
        await ensureHistoryLoadedToEditor(ctx);
        await ctx.delay(800);
      },
      verify: GQL.EDITOR,
      pauseAfter: true,
    },

    {
      id: 'gql8-run',
      title: 'Run from History',
      description:
        'Re-open the preview and click **Run** (`gql-history-run`) — the query loads into the editor **and executes immediately**. Compare with **Load**, which does not hit the server.',
      highlight: GQL.HISTORY_RUN,
      preAction: ensureHistoryLoadedToEditor,
      action: async (ctx) => {
        await ensureHistoryRunExecuted(ctx);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    {
      id: 'gql8-save',
      title: 'Save to Collection',
      description:
        `From the history preview, click **Save to Collection** → name the operation **${LESSON8_ITEM_NAME}** → pick a collection (create one with **+** in Collections if needed) → **Save**.`,
      highlight: GQL.HISTORY_SAVE_TO_COL,
      preAction: ensureHistoryRunExecuted,
      action: async (ctx) => {
        await ensureSavedToCollectionFromHistory(ctx);
        await ctx.delay(800);
      },
      verify: GQL.COL_ITEM,
      pauseAfter: true,
    },

    {
      id: 'gql8-rename',
      title: 'Rename a Collection Item',
      description:
        `Open **Collections** → expand the collection → **right-click** the saved item → **Rename** → enter **${LESSON8_ITEM_RENAME}**. (Item double-click **loads** the query — use the context menu to rename.)`,
      highlight: GQL.COL_ITEM_RENAME,
      preAction: ensureSavedToCollectionFromHistory,
      action: async (ctx) => {
        await ensureCollectionItemRenamed(ctx);
        await ctx.delay(800);
      },
      verify: GQL.COL_ITEM,
      pauseAfter: true,
    },

    {
      id: 'gql8-export',
      title: 'Export Collections',
      description:
        'In the Collections toolbar, click **Export** (`gql-collections-export`) — a `redfire-graphql-collections*.json` file downloads with all collections, folders, and operations.',
      highlight: GQL.COLLECTIONS_EXPORT,
      preAction: ensureCollectionItemRenamed,
      action: async (ctx) => {
        await ctx.click(GQL.COLLECTIONS_EXPORT);
        await ctx.delay(1500);
      },
      verify: GQL.COLLECTIONS_EXPORT,
      pauseAfter: true,
    },

    {
      id: 'gql8-import',
      title: 'Delete & Import Restore',
      description:
        '**Right-click** the collection header → **Delete**. Then click **Import** (`gql-collections-import`), choose your exported JSON, and select **Merge** — the saved operation reappears in the tree.',
      highlight: GQL.COLLECTIONS_IMPORT,
      preAction: ensureCollectionItemRenamed,
      action: async (ctx) => {
        await ensureCollectionRestoredViaImport(ctx);
        await ctx.delay(800);
      },
      verify: GQL.COL_ITEM,
      pauseAfter: true,
    },
  ],
};
