/** Lesson GQL-12: Schema Diff & Breaking Changes */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  LESSON12_BASELINE_LABEL,
  ensureLesson12ChangelogOpen,
  ensureLesson12DiffExported,
  ensureLesson12DiffFilters,
  ensureLesson12DiffOpen,
  ensureLesson12SnapshotSaved,
  ensureLesson12TypesTab,
  gqlSchemaDiffLessonCleanup,
  gqlSchemaDiffLessonSetup,
} from './graphql-lesson-helpers';

export const gqlSchemaDiffLesson: DemoLesson = {
  id: 'gql-schema-diff',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Schema Diff & Breaking Changes',
  description:
    'Save schema snapshots, compare against the live introspected schema, review BREAKING vs SAFE changes, filter by severity, and export the diff as JSON.',
  estimatedMinutes: 3,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlSchemaDiffLessonSetup,
  cleanup: gqlSchemaDiffLessonCleanup,

  concept: {
    title: 'Schema Snapshots & Diff',
    body: `GraphQL Studio tracks **schema snapshots** per endpoint so you can detect drift after deploys or server upgrades.

**Workflow:**
1. **Save snapshot** — capture the introspected SDL at a point in time (auto-labeled with a timestamp)
2. **Changelog** — browse saved snapshots for this connection
3. **Diff** — compare a snapshot to the **current** schema (or to another snapshot)
4. **Severity** — changes are classified as **Breaking**, **Dangerous**, **Safe**, or **Deprecated**
5. **Export** — download the diff report as JSON for CI gates or team review

This lesson seeds a **prior-release** baseline so comparing to the live Docker server on port **4010** shows real breaking and safe rows without changing the server.`,
    keyTerms: [
      {
        term: 'Snapshot',
        definition:
          'Frozen copy of the introspected SDL stored in IndexedDB, keyed by endpoint URL.',
      },
      {
        term: 'Breaking change',
        definition:
          'A schema change that can break existing clients — e.g. removing a field or type.',
      },
      {
        term: 'Compare to current',
        definition:
          'Diff the saved snapshot SDL against the schema from the latest introspection.',
      },
      {
        term: 'Diff export',
        definition:
          'JSON file with change rows, severity counts, and paths — suitable for automation.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="15" y="28" width="75" height="64" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="52" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Snapshot</text>
  <text x="52" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">Save SDL</text>
  <rect x="100" y="28" width="70" height="64" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="135" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Changelog</text>
  <text x="135" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">history</text>
  <rect x="180" y="28" width="65" height="64" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="212" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Diff</text>
  <text x="212" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">modal</text>
  <rect x="255" y="28" width="70" height="64" rx="6" fill="var(--danger)" opacity="0.15" stroke="var(--danger)" stroke-width="1.5"/>
  <text x="290" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Breaking</text>
  <text x="290" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">count</text>
  <rect x="335" y="28" width="70" height="64" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="370" y="52" text-anchor="middle" fill="var(--text)" font-size="8">Export</text>
  <text x="370" y="66" text-anchor="middle" fill="var(--text-muted)" font-size="7">JSON</text>
  <text x="210" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Schema Diff</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql12-save-snapshot',
      title: 'Save a Schema Snapshot',
      description:
        'Open the **Schema** tab on the right. On the **Types** sub-tab, click **📷 Save Snapshot** — the current introspected SDL is stored with an auto-generated label (no prompt). This becomes your “current” reference point.',
      highlight: GQL.SAVE_SNAPSHOT_BTN,
      preAction: ensureLesson12TypesTab,
      action: async (ctx) => {
        await ensureLesson12SnapshotSaved(ctx);
      },
      verify: GQL.SAVE_SNAPSHOT_BTN,
      pauseAfter: true,
    },

    {
      id: 'gql12-changelog',
      title: 'Open the Changelog',
      description:
        `Switch to the **Changelog** tab. You will see the snapshot you just saved plus a seeded **${LESSON12_BASELINE_LABEL}** entry — two rows with dates and type counts.`,
      highlight: GQL.CHANGELOG_TAB,
      preAction: ensureLesson12SnapshotSaved,
      action: async (ctx) => {
        await ensureLesson12ChangelogOpen(ctx);
      },
      verify: GQL.CHANGELOG_PANEL,
      pauseAfter: true,
    },

    {
      id: 'gql12-compare',
      title: 'Compare to Current Schema',
      description:
        `Select the **${LESSON12_BASELINE_LABEL}** row (the older baseline). Leave the compare dropdown on **vs. Current Schema**, then click **Diff** — this compares the saved SDL to the live introspected schema.`,
      highlight: GQL.CHANGELOG_DIFF_BTN,
      preAction: ensureLesson12ChangelogOpen,
      action: async (ctx) => {
        await ensureLesson12DiffOpen(ctx);
      },
      verify: GQL.DIFF_MODAL,
      pauseAfter: true,
    },

    {
      id: 'gql12-diff-modal',
      title: 'Review the Diff Modal',
      description:
        'The **Schema Diff** modal lists every change between the baseline and current SDL. Each row shows severity, path, and a human-readable description. Toggle **SDL Diff** in the toolbar to see raw side-by-side SDL if needed.',
      highlight: GQL.DIFF_MODAL,
      preAction: ensureLesson12DiffOpen,
      action: async (ctx) => {
        await ensureLesson12DiffOpen(ctx);
        await ctx.delay(800);
      },
      verify: GQL.DIFF_ROW,
      pauseAfter: true,
    },

    {
      id: 'gql12-breaking',
      title: 'Breaking Change Count',
      description:
        'In the modal header, watch the red **Breaking** count badge — it highlights removals that would break existing clients (e.g. `Query.users` removed since the prior release). Scroll the change list to see affected field paths.',
      highlight: GQL.DIFF_COUNT_BREAKING,
      preAction: ensureLesson12DiffOpen,
      action: async (ctx) => {
        await ensureLesson12DiffOpen(ctx);
        await ctx.delay(800);
      },
      verify: GQL.DIFF_COUNT_BREAKING,
      pauseAfter: true,
    },

    {
      id: 'gql12-filters',
      title: 'Filter by Severity',
      description:
        'Use the severity tabs — **Breaking**, **Safe**, **Deprecated** — to narrow the change list. **Safe** shows additive changes (e.g. new `User.email` field). **Deprecated** may be empty on this server but the filter is available for APIs that mark fields `@deprecated`.',
      highlight: GQL.DIFF_FILTER_BREAKING,
      preAction: ensureLesson12DiffOpen,
      action: async (ctx) => {
        await ensureLesson12DiffFilters(ctx);
      },
      verify: GQL.DIFF_FILTER_SAFE,
      pauseAfter: true,
    },

    {
      id: 'gql12-export',
      title: 'Export Diff as JSON',
      description:
        'Click **Export diff as JSON** in the modal footer. A `schema-diff-*.json` file downloads with severity counts and the full change list — ready for CI schema gates or sharing with your team.',
      highlight: GQL.DIFF_EXPORT_JSON,
      preAction: ensureLesson12DiffOpen,
      action: async (ctx) => {
        await ensureLesson12DiffExported(ctx);
      },
      verify: GQL.DIFF_EXPORT_JSON,
      pauseAfter: true,
    },
  ],
};
