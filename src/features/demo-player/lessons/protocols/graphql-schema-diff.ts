/** Lesson GQL-12: Schema Diff & Breaking Changes */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
  LESSON12_BASELINE_LABEL,
  ensureLesson12BaselineReady,
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
  estimatedMinutes: 4,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlSchemaDiffLessonSetup,
  cleanup: gqlSchemaDiffLessonCleanup,

  concept: {
    title: 'Schema Diff — Catching API Contract Breaks Before They Reach Clients',
    body: `GraphQL schemas are living contracts. Every deploy that modifies a schema risks breaking existing clients — removing a field, renaming a type, or changing an argument from optional to required can silently break web apps, mobile apps, and third-party integrations. Studio's **Schema Diff** feature makes these risks visible before and after each change.

**Why snapshots, not just live diffing?**
A snapshot is a frozen copy of the introspected SDL captured at a specific point in time — usually before a planned server update. When you compare a pre-deploy snapshot to the live schema post-deploy, you get a precise diff that correlates with that release. Without snapshots, you can only compare "now vs. a moment ago" — not "v2.1 vs. v2.2". Snapshots are keyed by endpoint URL and stored in IndexedDB (or Tauri FS), so they persist across sessions.

**Severity classification — why not just "changed"?**
Schema changes carry very different risk levels:
- **Breaking** — removals or incompatible modifications that will immediately fail existing queries (removing a field, making a nullable argument required, removing a type). These require coordinated client migrations.
- **Dangerous** — changes that may fail in edge cases (e.g. changing an argument default that clients depend on). Handle with care.
- **Safe** — purely additive changes (new fields, new types, new enum values). Existing clients are unaffected. New clients can start using them immediately.
- **Deprecated** — fields or types marked \`@deprecated\`. Not breaking yet, but clients should migrate before they are removed.

**Why the baseline approach in this lesson?**
Instead of actually modifying the Docker server schema (which is impractical in a demo), this lesson seeds a **prior-release baseline snapshot** with a slightly older SDL. Comparing that baseline to the live Docker server on port 4010 produces real breaking and safe change rows without touching the server.

**Why export the diff as JSON?**
Schema diff reports in JSON format can be consumed by CI/CD pipelines — a pre-deploy hook can fail the build if \`breakingCount > 0\` or if specific critical paths are removed. This turns manual "hope nobody broke anything" reviews into automated guardrails.`,
    keyTerms: [
      {
        term: 'Snapshot',
        definition:
          'Frozen copy of the introspected SDL stored in IndexedDB, keyed by endpoint URL and captured at a point in time. Survives page refreshes and browser restarts. The foundation of schema drift detection.',
      },
      {
        term: 'Breaking change',
        definition:
          'A schema modification that will immediately fail existing client queries — removing a field or type, making a nullable argument required, changing a return type. Shown in red. Requires coordinated client migration.',
      },
      {
        term: 'Safe change',
        definition:
          'A purely additive schema change — new fields, new types, new enum values. Existing clients are unaffected. Shown in green. New clients can use them immediately.',
      },
      {
        term: 'Compare to current',
        definition:
          'The primary diff mode: compare a saved snapshot SDL against the schema from the latest live introspection. Reveals exactly what changed between the saved point in time and now.',
      },
      {
        term: 'Diff export (JSON)',
        definition:
          'Downloadable `schema-diff-*.json` file containing the full change list, severity counts (breaking/dangerous/safe/deprecated), and field paths. Suitable for CI/CD schema gate automation.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- ── Window chrome ────────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="700" height="430" rx="10" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <rect x="0" y="0" width="700" height="32" rx="10" fill="var(--surface)"/>
  <rect x="0" y="22" width="700" height="10" fill="var(--surface)"/>
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Schema Diff &amp; Breaking Changes</text>

  <!-- ── Connection bar ───────────────────────────────────────────────────── -->
  <rect x="0" y="32" width="700" height="26" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="8" y="37" width="230" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="16" y="48" fill="var(--text-muted)" font-size="8.5" font-family="monospace">localhost:4010/graphql</text>
  <rect x="250" y="37" width="60" height="16" rx="8" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="280" y="48" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <rect x="618" y="37" width="72" height="16" rx="4" fill="var(--primary)"/>
  <text x="654" y="48" text-anchor="middle" font-size="9" font-weight="700" fill="white">▶ Execute</text>

  <!-- ── Left activity bar ─────────────────────────────────────────────────── -->
  <rect x="0" y="58" width="36" height="372" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="3" y="68" width="30" height="30" rx="4" fill="var(--bg)"/>
  <text x="18" y="86" text-anchor="middle" font-size="12" opacity="0.3">📋</text>

  <!-- ── Editor panel (left, ~200px) ───────────────────────────────────────── -->
  <rect x="36" y="58" width="200" height="372" fill="var(--bg)"/>
  <line x1="236" y1="58" x2="236" y2="430" stroke="var(--border)" stroke-width="1"/>
  <rect x="36" y="58" width="200" height="22" fill="var(--bg)"/>
  <rect x="40" y="60" width="56" height="18" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="68" y="72" text-anchor="middle" font-size="7.5" fill="var(--text)">Query 1</text>
  <rect x="36" y="80" width="200" height="1" fill="var(--border)"/>
  <text x="48" y="100" fill="#a78bfa" font-size="9" font-family="monospace">query</text>
  <text x="82" y="100" fill="var(--text)" font-size="9" font-family="monospace"> { health }</text>

  <!-- ── Schema Explorer (right side, ~464px) ──────────────────────────────── -->
  <rect x="238" y="58" width="462" height="372" fill="var(--bg)"/>

  <!-- Schema Explorer header -->
  <rect x="238" y="58" width="462" height="22" fill="var(--surface)"/>
  <line x1="238" y1="80" x2="700" y2="80" stroke="var(--border)" stroke-width="1"/>
  <text x="248" y="73" font-size="8.5" font-weight="600" fill="var(--text)">Schema Explorer</text>

  <!-- Sub-tabs: Types | Changelog (active) -->
  <rect x="244" y="82" width="46" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="267" y="94" text-anchor="middle" font-size="8" fill="var(--text-muted)">Types</text>
  <rect x="294" y="82" width="68" height="18" rx="3" fill="var(--primary)"/>
  <text x="328" y="94" text-anchor="middle" font-size="8" fill="white" font-weight="700">Changelog</text>
  <!-- Save Snapshot button -->
  <rect x="590" y="82" width="100" height="18" rx="3" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="640" y="93" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">📷 Save Snapshot</text>

  <!-- Changelog panel content -->
  <rect x="238" y="100" width="462" height="200" fill="var(--bg)"/>
  <line x1="238" y1="100" x2="700" y2="100" stroke="var(--border)" stroke-width="0.5"/>

  <!-- Snapshot row 1 (current — just saved) -->
  <rect x="238" y="100" width="462" height="36" fill="color-mix(in srgb, #28c840 4%, var(--bg))"/>
  <line x1="238" y1="136" x2="700" y2="136" stroke="var(--border)" stroke-width="0.5"/>
  <text x="252" y="116" font-size="8.5" font-weight="600" fill="var(--text)">Current snapshot</text>
  <text x="252" y="129" font-size="7" fill="var(--text-muted)">2026-06-21 · 47 types · just saved</text>
  <rect x="590" y="106" width="40" height="22" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="610" y="121" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">Diff</text>
  <!-- New badge -->
  <rect x="528" y="108" width="36" height="16" rx="3" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.5"/>
  <text x="546" y="119" text-anchor="middle" font-size="7" fill="#28c840">📷 new</text>

  <!-- Snapshot row 2 (baseline — seeded, selected) -->
  <rect x="238" y="136" width="462" height="36" fill="color-mix(in srgb, var(--primary) 7%, var(--surface))" stroke="var(--primary)" stroke-width="0.5"/>
  <line x1="238" y1="172" x2="700" y2="172" stroke="var(--border)" stroke-width="0.5"/>
  <text x="252" y="152" font-size="8.5" font-weight="600" fill="var(--primary)">Prior Release — v1.0</text>
  <text x="252" y="165" font-size="7" fill="var(--text-muted)">2026-06-01 · 45 types · baseline</text>
  <rect x="634" y="142" width="50" height="22" rx="3" fill="var(--primary)"/>
  <text x="659" y="157" text-anchor="middle" font-size="7.5" fill="white" font-weight="700">Diff →</text>
  <!-- Compare to dropdown -->
  <rect x="494" y="142" width="134" height="22" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="502" y="156" font-size="7.5" fill="var(--text-muted)">vs. Current Schema ▾</text>

  <!-- Snapshot row 3 (older) -->
  <rect x="238" y="172" width="462" height="36" fill="var(--bg)"/>
  <text x="252" y="188" font-size="8.5" fill="var(--text-muted)">Older snapshot</text>
  <text x="252" y="201" font-size="7" fill="var(--text-muted)">2026-05-12 · 43 types</text>
  <rect x="634" y="178" width="50" height="22" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="659" y="193" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">Diff</text>

  <!-- ── Schema Diff Modal (overlay) ───────────────────────────────────────── -->
  <!-- Modal backdrop -->
  <rect x="180" y="140" width="450" height="256" rx="8" fill="color-mix(in srgb, var(--bg) 55%, transparent)" stroke="var(--border)" stroke-width="1.5"/>

  <!-- Modal window -->
  <rect x="190" y="148" width="430" height="240" rx="7" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>

  <!-- Modal title bar -->
  <rect x="190" y="148" width="430" height="28" rx="7" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))"/>
  <rect x="190" y="164" width="430" height="12" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))"/>
  <text x="210" y="167" font-size="10" font-weight="700" fill="var(--text)">Schema Diff</text>
  <text x="260" y="167" font-size="8" fill="var(--text-muted)">Prior Release v1.0  →  Current Schema</text>
  <!-- Close button -->
  <circle cx="605" cy="162" r="7" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="605" y="166" text-anchor="middle" font-size="9" fill="var(--text-muted)">✕</text>

  <!-- Count badges -->
  <rect x="200" y="180" width="62" height="18" rx="4" fill="color-mix(in srgb, #ef4444 15%, var(--surface))" stroke="#ef4444" stroke-width="1"/>
  <text x="231" y="192" text-anchor="middle" font-size="8" fill="#ef4444" font-weight="700">🔴 2 Breaking</text>
  <rect x="268" y="180" width="46" height="18" rx="4" fill="color-mix(in srgb, #28c840 10%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="291" y="192" text-anchor="middle" font-size="8" fill="#28c840" font-weight="700">🟢 3 Safe</text>
  <rect x="320" y="180" width="64" height="18" rx="4" fill="color-mix(in srgb, #f59e0b 10%, var(--surface))" stroke="#f59e0b" stroke-width="1"/>
  <text x="352" y="192" text-anchor="middle" font-size="8" fill="#f59e0b" font-weight="700">⚠ 1 Deprecated</text>

  <!-- Severity filter tabs -->
  <rect x="200" y="202" width="200" height="16" rx="3" fill="var(--bg)"/>
  <rect x="200" y="202" width="48" height="16" rx="3" fill="#ef4444"/>
  <text x="224" y="213" text-anchor="middle" font-size="7" fill="white" font-weight="600">Breaking</text>
  <rect x="252" y="202" width="38" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="271" y="213" text-anchor="middle" font-size="7" fill="var(--text-muted)">Safe</text>
  <rect x="294" y="202" width="54" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="321" y="213" text-anchor="middle" font-size="7" fill="var(--text-muted)">Deprecated</text>
  <!-- SDL Diff toggle -->
  <rect x="520" y="202" width="64" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="552" y="213" text-anchor="middle" font-size="7" fill="var(--text-muted)">⟺ SDL Diff</text>

  <!-- Diff rows table header -->
  <rect x="190" y="218" width="430" height="14" fill="var(--bg)"/>
  <line x1="190" y1="218" x2="620" y2="218" stroke="var(--border)" stroke-width="0.5"/>
  <text x="200" y="228" font-size="6.5" fill="var(--text-muted)" font-weight="600">SEVERITY</text>
  <text x="260" y="228" font-size="6.5" fill="var(--text-muted)" font-weight="600">PATH</text>
  <text x="410" y="228" font-size="6.5" fill="var(--text-muted)" font-weight="600">CHANGE</text>

  <!-- Diff row 1 — Breaking: Query.users removed -->
  <rect x="190" y="232" width="430" height="22" fill="color-mix(in srgb, #ef4444 5%, var(--surface))"/>
  <line x1="190" y1="232" x2="620" y2="232" stroke="var(--border)" stroke-width="0.3"/>
  <rect x="198" y="235" width="46" height="14" rx="3" fill="color-mix(in srgb, #ef4444 15%, var(--surface))" stroke="#ef4444" stroke-width="0.8"/>
  <text x="221" y="245" text-anchor="middle" font-size="7" fill="#ef4444" font-weight="600">Breaking</text>
  <text x="260" y="246" fill="var(--text)" font-size="8" font-family="monospace">Query.users</text>
  <text x="410" y="246" fill="var(--text-muted)" font-size="7.5">Field removed</text>

  <!-- Diff row 2 — Breaking: Query.createOrder return change -->
  <rect x="190" y="254" width="430" height="22" fill="color-mix(in srgb, #ef4444 3%, var(--surface))"/>
  <line x1="190" y1="254" x2="620" y2="254" stroke="var(--border)" stroke-width="0.3"/>
  <rect x="198" y="257" width="46" height="14" rx="3" fill="color-mix(in srgb, #ef4444 15%, var(--surface))" stroke="#ef4444" stroke-width="0.8"/>
  <text x="221" y="267" text-anchor="middle" font-size="7" fill="#ef4444" font-weight="600">Breaking</text>
  <text x="260" y="268" fill="var(--text)" font-size="8" font-family="monospace">Mutation.order</text>
  <text x="410" y="268" fill="var(--text-muted)" font-size="7.5">Return type changed</text>

  <!-- Diff row 3 — Safe: User.email added -->
  <rect x="190" y="276" width="430" height="22" fill="color-mix(in srgb, #28c840 4%, var(--surface))"/>
  <line x1="190" y1="276" x2="620" y2="276" stroke="var(--border)" stroke-width="0.3"/>
  <rect x="198" y="279" width="34" height="14" rx="3" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="215" y="289" text-anchor="middle" font-size="7" fill="#28c840" font-weight="600">Safe</text>
  <text x="260" y="290" fill="var(--text)" font-size="8" font-family="monospace">User.email</text>
  <text x="410" y="290" fill="var(--text-muted)" font-size="7.5">New field added</text>

  <!-- Diff row 4 — Safe: Subscription.orderStatus added -->
  <rect x="190" y="298" width="430" height="22" fill="var(--surface)"/>
  <line x1="190" y1="298" x2="620" y2="298" stroke="var(--border)" stroke-width="0.3"/>
  <rect x="198" y="301" width="34" height="14" rx="3" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="215" y="311" text-anchor="middle" font-size="7" fill="#28c840" font-weight="600">Safe</text>
  <text x="260" y="312" fill="var(--text)" font-size="8" font-family="monospace">Subscription.orderStatus</text>
  <text x="410" y="312" fill="var(--text-muted)" font-size="7.5">New subscription field</text>

  <!-- Modal footer -->
  <line x1="190" y1="322" x2="620" y2="322" stroke="var(--border)" stroke-width="1"/>
  <rect x="190" y="322" width="430" height="26" fill="color-mix(in srgb, var(--primary) 4%, var(--surface))"/>
  <rect x="200" y="328" width="110" height="14" rx="4" fill="var(--primary)"/>
  <text x="255" y="338" text-anchor="middle" font-size="7.5" fill="white" font-weight="700">↓ Export diff as JSON</text>
  <text x="520" y="338" text-anchor="end" font-size="7" fill="var(--text-muted)">schema-diff-20260621.json</text>

  <!-- ── Bottom legend ─────────────────────────────────────────────────────── -->
  <line x1="0" y1="390" x2="700" y2="390" stroke="var(--border)" stroke-width="1"/>
  <rect x="0" y="390" width="700" height="40" fill="var(--bg)"/>
  <defs>
    <marker id="gql12-arr" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
      <path d="M1,1 L4,2.5 L1,4 Z" fill="var(--primary)"/>
    </marker>
  </defs>
  <text x="40" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">📷 Snapshot</text>
  <text x="40" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">save SDL</text>
  <line x1="74" y1="408" x2="106" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql12-arr)"/>
  <text x="140" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Changelog</text>
  <text x="140" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">timeline</text>
  <line x1="176" y1="408" x2="210" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql12-arr)"/>
  <text x="248" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Diff Modal</text>
  <text x="248" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">vs. current</text>
  <line x1="286" y1="408" x2="318" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql12-arr)"/>
  <rect x="328" y="398" width="46" height="14" rx="3" fill="color-mix(in srgb, #ef4444 15%, var(--surface))" stroke="#ef4444" stroke-width="0.8"/>
  <text x="351" y="408" text-anchor="middle" font-size="7.5" fill="#ef4444" font-weight="600">Breaking</text>
  <text x="351" y="420" text-anchor="middle" font-size="7" fill="var(--text-muted)">removals</text>
  <line x1="378" y1="408" x2="408" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql12-arr)"/>
  <rect x="418" y="398" width="34" height="14" rx="3" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="435" y="408" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">Safe</text>
  <text x="435" y="420" text-anchor="middle" font-size="7" fill="var(--text-muted)">additions</text>
  <line x1="455" y1="408" x2="483" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql12-arr)"/>
  <text x="518" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Filter</text>
  <text x="518" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">by severity</text>
  <line x1="546" y1="408" x2="576" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql12-arr)"/>
  <text x="624" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--primary)">Export JSON</text>
  <text x="624" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">CI/CD gate</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Save snapshot ───────────────────────────────────────────────
    {
      id: 'gql12-save-snapshot',
      title: 'Save a Schema Snapshot',
      description:
        'In the **Schema Explorer** on the right, stay on the **Types** sub-tab and click **📷 Save Snapshot** — the current introspected SDL is stored with an auto-generated timestamp label.\n\n' +
        '**Why save before comparing?** The snapshot is your reference point — the "before" state that the diff will compare against. Without a snapshot, you only know what the schema looks like now; with a snapshot, you know what it looked like at the moment you captured it. ' +
        'This lets you answer: "did the schema change between my last deploy and now?" Snapshots are stored per endpoint URL in IndexedDB, so they persist across sessions and survive page refreshes.',
      highlight: GQL.SAVE_SNAPSHOT_BTN,
      preAction: ensureLesson12TypesTab,
      action: async (ctx) => {
        await ensureLesson12SnapshotSaved(ctx);
      },
      verify: GQL.SAVE_SNAPSHOT_BTN,
      pauseAfter: true,
    },

    // ── Step 2: Open changelog ──────────────────────────────────────────────
    {
      id: 'gql12-changelog',
      title: 'Open the Changelog',
      description:
        `Switch to the **Changelog** tab. You will see the snapshot you just saved plus a seeded **${LESSON12_BASELINE_LABEL}** entry — two rows with dates and type counts.\n\n` +
        '**Why a changelog view?** The Changelog is the chronological record of every schema snapshot ever saved for this endpoint. Each row shows when the snapshot was taken and how many types it contained at that time. ' +
        'This timeline lets you correlate schema changes with deploy events, sprint milestones, or incident windows. ' +
        'The seeded baseline entry simulates a prior release — it has an older SDL that is missing some fields the live server now exposes.',
      highlight: GQL.CHANGELOG_TAB,
      preAction: ensureLesson12SnapshotSaved,
      action: async (ctx) => {
        await ensureLesson12ChangelogOpen(ctx);
      },
      verify: GQL.CHANGELOG_PANEL,
      pauseAfter: true,
    },

    // ── Step 3: Compare to current ──────────────────────────────────────────
    {
      id: 'gql12-compare',
      title: 'Diff the Baseline Against Current Schema',
      description:
        `Select the **${LESSON12_BASELINE_LABEL}** row, then click **View diff** in the compare bar below — leave **Compare against** on **Current schema**.\n\n` +
        '**Why compare against current?** In CI, every deploy introspects the live schema and diffs it against the last approved baseline. ' +
        'This catches accidental breaking changes before they reach production — renamed fields, removed types, and tightened nullability all surface in the diff modal before you merge.',
      highlight: GQL.CHANGELOG_COMPARE_BAR,
      preAction: ensureLesson12BaselineReady,
      action: async (ctx) => {
        await ensureLesson12DiffOpen(ctx);
      },
      verify: GQL.DIFF_MODAL,
      pauseAfter: 5500,
    },

    // ── Step 4: Review diff modal ───────────────────────────────────────────
    {
      id: 'gql12-diff-modal',
      title: 'Review the Diff Modal',
      description:
        'The **Schema Diff** modal opens on the **Changes** tab. Each row shows a severity pill, field path, and a human-readable change summary — scan the list before diving into details.\n\n' +
        '**Why show the diff as a structured table (not just text)?** Raw SDL comparison (like a git diff) tells you what text changed — but not whether that change will break clients. A structured table with severity classification makes the risk immediately scannable: you can see at a glance how many Breaking vs. Safe changes exist without reading every line of SDL. ' +
        'Switch to **SDL Diff** in the toolbar when you need raw side-by-side SDL text.',
      highlight: GQL.DIFF_CONTENT,
      preAction: ensureLesson12DiffOpen,
      action: async (ctx) => {
        await ctx.delay(1500);
      },
      verify: GQL.DIFF_ROW,
      pauseAfter: true,
    },

    // ── Step 5: Breaking count badge ────────────────────────────────────────
    {
      id: 'gql12-breaking',
      title: 'Breaking Change Count',
      description:
        'Look at the summary badges in the modal header — the red **Breaking** count highlights removals and incompatible modifications that will immediately fail existing client queries (e.g. `Query.users` removed since the prior release).\n\n' +
        '**Why a prominent count badge?** Breaking changes require immediate action — client-side code must be updated before the change can go to production. Surfacing the count in the header means you see the severity summary without scrolling the change list. ' +
        'A badge showing "0 Breaking" gives you the confidence to deploy; "2 Breaking" tells you to stop and coordinate a migration. ' +
        'The red color follows the standard traffic-light convention: stop and review before proceeding.',
      highlight: GQL.DIFF_COUNT_BREAKING,
      preAction: ensureLesson12DiffOpen,
      action: async (ctx) => {
        await ctx.delay(1500);
      },
      verify: GQL.DIFF_COUNT_BREAKING,
      pauseAfter: true,
    },

    // ── Step 6: Filter by severity ──────────────────────────────────────────
    {
      id: 'gql12-filters',
      title: 'Filter by Severity',
      description:
        'Use the severity filter tabs in the toolbar — **All**, **Breaking**, **Safe**, **Deprecated** — to narrow the change list. **Safe** shows additive changes (e.g. new `User.email` field). **Deprecated** may be empty on this server but the filter is always available.\n\n' +
        '**Why filter instead of showing everything?** In large schemas, a diff between two releases can contain dozens of changes — mostly Safe additive ones (new types, new fields). When you are on-call reviewing an incident or pre-deploy check, you care only about Breaking changes. ' +
        'Filtering isolates the signal from the noise. Conversely, a product manager reviewing the release notes might want only the Safe additions — new features clients can start using immediately. The filter tabs serve both audiences.',
      highlight: GQL.DIFF_FILTERS,
      preAction: ensureLesson12DiffOpen,
      action: async (ctx) => {
        await ensureLesson12DiffFilters(ctx);
      },
      verify: GQL.DIFF_FILTER_SAFE,
      pauseAfter: true,
    },

    // ── Step 7: Export diff as JSON ─────────────────────────────────────────
    {
      id: 'gql12-export',
      title: 'Export Diff as JSON',
      description:
        'Click **Export JSON** in the modal footer. A `schema-diff-*.json` file downloads with severity counts and the full change list — ready for CI schema gates or sharing with your team.\n\n' +
        '**Why automate with the export?** Manual review catches breaking changes when someone happens to run the diff. Automated schema gating catches them every time. A CI/CD script can:\n' +
        '1. Call the Studio export API (or parse the JSON from a scripted run)\n' +
        '2. Fail the build if `breakingCount > 0`\n' +
        '3. Post the Safe additions to a Slack channel as release notes\n' +
        '4. Compare critical field paths (e.g. `Query.checkout`) and alert if they are removed\n\n' +
        'The JSON format is self-describing — severity counts, full change list with field paths, and timestamps are all included.',
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
