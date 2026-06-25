/** Lesson GQL-8: Query Builder — Visual Operations */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
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
  estimatedMinutes: 5,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlQueryBuilderLessonSetup,
  cleanup: gqlQueryBuilderLessonCleanup,

  concept: {
    title: 'Visual Query Builder — No-Code GraphQL Construction',
    body: `The **Builder** mode transforms the editor into a three-panel visual workspace: **field tree** (left), **SDL preview** (center), and **Summary** (right). You explore and select fields from the introspected schema without writing any SDL by hand.

**Why Builder mode exists:** GraphQL's power comes from its self-describing schema — but reading raw SDL to discover fields, arguments, and return types is slow. Builder visualizes the schema as a clickable tree. This is especially valuable when joining a new project: select fields, see the query shape instantly in the preview, then click Execute without typing a line.

**How field selection works:** The field tree mirrors the root operation type (Query, Mutation, or Subscription). Leaf scalars (like \`health\`) can be checked directly. Object types (like \`user\`) have an **expand** button (›) — once expanded, their subfields appear for selection. Required arguments surface inline under the field row, preventing you from forgetting them.

**Aliases:** When the same field needs to appear twice under different names, or when you want a shorter name in the response, set a **field alias**. The preview rewrites \`user { id }\` as \`user { userId: id }\`. Aliases also prevent field conflicts in multi-field responses.

**@include / @skip directives:** These control conditional field inclusion at runtime — \`@include(if: $var)\` sends the field only when the variable is \`true\`. This lets a single query document serve multiple UI states (e.g., showing details only when a panel is expanded) without maintaining multiple query strings.

**One-way sync (Builder → Editor):** Clicking **Edit in Editor** copies the generated SDL into Monaco and exits Builder mode. This is intentional and non-reversible: Builder state is a *selection model* (which fields are checked, which args are filled, which aliases/directives are set) — it cannot be reconstructed from arbitrary SDL. Use Builder for discovery; use Editor for fine-tuning.`,
    keyTerms: [
      {
        term: 'Builder mode',
        definition:
          'Visual query construction UI toggled via the **Builder** button on the editor toolbar. Requires an introspected schema — the field tree is built from the schema types at introspect time.',
      },
      {
        term: 'Field tree',
        definition:
          'Hierarchical checklist of schema fields starting from the Query/Mutation/Subscription root type. Object fields expand (›) to reveal subfields. Leaf scalars are selectable directly.',
      },
      {
        term: 'SDL preview',
        definition:
          'The live center **SDL preview** panel that shows the query document as it is built by your field selections. Updates instantly on every check/uncheck — no Execute needed to see the output.',
      },
      {
        term: 'Summary panel',
        definition:
          'Right-side panel with field stats, path search, and per-field **Field Options** controls (alias input, @include / @skip toggle). The selected field count and depth are shown at the top.',
      },
      {
        term: 'Field alias',
        definition:
          'Renames a field in the response JSON without changing the schema field name. Written as `aliasName: fieldName` in SDL. Prevents field name conflicts and makes responses more readable.',
      },
      {
        term: 'One-way sync',
        definition:
          'Builder → Editor transfer via **Edit in Editor** or **Execute**. Manual SDL edits in Monaco are **not** parsed back into the builder selection state — the builder retains its last state.',
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
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Query Builder</text>

  <!-- ── Connection bar ───────────────────────────────────────────────────── -->
  <rect x="8" y="38" width="684" height="28" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="16" y="43" width="240" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="24" y="55" fill="var(--text-muted)" font-size="9" font-family="monospace">localhost:4010/graphql</text>
  <rect x="268" y="43" width="68" height="18" rx="9" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="302" y="55" text-anchor="middle" font-size="8.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <rect x="570" y="43" width="72" height="18" rx="4" fill="var(--primary)"/>
  <text x="606" y="55" text-anchor="middle" font-size="9.5" font-weight="700" fill="white">▶ Execute</text>

  <!-- ── Mode tab bar ──────────────────────────────────────────────────────── -->
  <rect x="8" y="72" width="684" height="26" fill="var(--bg)"/>
  <line x1="8" y1="98" x2="692" y2="98" stroke="var(--border)" stroke-width="1"/>
  <!-- Editor tab (inactive) -->
  <rect x="12" y="74" width="64" height="22" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="44" y="88" text-anchor="middle" font-size="8.5" fill="var(--text-muted)">Editor</text>
  <!-- Builder tab (ACTIVE) -->
  <rect x="82" y="74" width="68" height="22" rx="4" fill="var(--primary)" stroke="var(--primary)" stroke-width="1"/>
  <text x="116" y="88" text-anchor="middle" font-size="8.5" font-weight="700" fill="white">⬡ Builder</text>
  <!-- Builder tab active callout -->
  <rect x="86" y="58" width="120" height="13" rx="3" fill="color-mix(in srgb, var(--primary) 15%, var(--surface))" stroke="var(--primary)" stroke-width="0.8"/>
  <text x="146" y="68" text-anchor="middle" fill="var(--primary)" font-size="7.5">Mode toggle — replaces Monaco</text>
  <line x1="116" y1="74" x2="146" y2="71" stroke="var(--primary)" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- ── Three-panel Builder layout ───────────────────────────────────────── -->

  <!-- LEFT: Field Tree (36%) -->
  <rect x="8" y="98" width="252" height="234" fill="var(--bg)"/>
  <line x1="260" y1="98" x2="260" y2="332" stroke="var(--border)" stroke-width="1"/>

  <!-- Field tree header -->
  <rect x="8" y="98" width="252" height="22" fill="var(--surface)"/>
  <line x1="8" y1="120" x2="260" y2="120" stroke="var(--border)" stroke-width="1"/>
  <text x="18" y="113" font-size="8.5" font-weight="600" fill="var(--text)">Query root</text>
  <rect x="178" y="101" width="72" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="214" y="113" text-anchor="middle" font-size="7" fill="var(--text-muted)">Select all</text>

  <!-- health row (checked) -->
  <rect x="8" y="121" width="252" height="22" fill="var(--bg)"/>
  <rect x="16" y="128" width="12" height="12" rx="2" fill="var(--primary)"/>
  <text x="22" y="138" text-anchor="middle" font-size="9" fill="white" font-weight="700">✓</text>
  <text x="36" y="137" fill="var(--text)" font-size="9" font-family="monospace">health</text>
  <text x="84" y="137" fill="var(--text-muted)" font-size="7.5">String</text>

  <!-- user row (expanded, partial) -->
  <rect x="8" y="143" width="252" height="22" fill="color-mix(in srgb, var(--primary) 4%, var(--bg))"/>
  <text x="18" y="157" fill="var(--primary)" font-size="10" font-weight="700">›</text>
  <rect x="28" y="149" width="12" height="12" rx="2" fill="color-mix(in srgb, var(--primary) 50%, var(--surface))" stroke="var(--primary)" stroke-width="1"/>
  <text x="34" y="159" text-anchor="middle" fill="white" font-size="7">–</text>
  <text x="48" y="158" fill="var(--text)" font-size="9" font-family="monospace">user</text>
  <text x="84" y="158" fill="var(--text-muted)" font-size="7.5">User!</text>
  <!-- arg row -->
  <rect x="8" y="165" width="252" height="18" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <text x="52" y="177" fill="var(--text-muted)" font-size="7.5">id:</text>
  <rect x="68" y="168" width="80" height="12" rx="2" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="76" y="178" fill="var(--text)" font-size="7.5" font-family="monospace">usr-1</text>

  <!-- subfields: id (checked) -->
  <rect x="8" y="183" width="252" height="18" fill="var(--bg)"/>
  <rect x="44" y="189" width="10" height="10" rx="2" fill="var(--primary)"/>
  <text x="49" y="197.5" text-anchor="middle" font-size="8" fill="white" font-weight="700">✓</text>
  <text x="62" y="197" fill="var(--text)" font-size="8.5" font-family="monospace">  id</text>
  <text x="84" y="197" fill="var(--text-muted)" font-size="7">ID!</text>

  <!-- subfields: name (unchecked) -->
  <rect x="8" y="201" width="252" height="18" fill="var(--bg)"/>
  <rect x="44" y="207" width="10" height="10" rx="2" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="62" y="215" fill="var(--text-muted)" font-size="8.5" font-family="monospace">  name</text>
  <text x="100" y="215" fill="var(--text-muted)" font-size="7">String</text>

  <!-- subfields: email (unchecked) -->
  <rect x="8" y="219" width="252" height="18" fill="var(--bg)"/>
  <rect x="44" y="225" width="10" height="10" rx="2" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="62" y="233" fill="var(--text-muted)" font-size="8.5" font-family="monospace">  email</text>
  <text x="106" y="233" fill="var(--text-muted)" font-size="7">String</text>

  <!-- ── CENTER: SDL Preview (34%) ─────────────────────────────────────────── -->
  <rect x="262" y="98" width="238" height="234" fill="var(--bg)"/>
  <line x1="500" y1="98" x2="500" y2="332" stroke="var(--border)" stroke-width="1"/>

  <!-- Preview header -->
  <rect x="262" y="98" width="238" height="22" fill="var(--surface)"/>
  <line x1="262" y1="120" x2="500" y2="120" stroke="var(--border)" stroke-width="1"/>
  <text x="272" y="113" font-size="8.5" font-weight="600" fill="var(--text)">SDL Preview</text>
  <!-- Copy btn -->
  <rect x="424" y="101" width="36" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="442" y="113" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">⎘ Copy</text>
  <!-- Edit btn -->
  <rect x="462" y="101" width="28" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="476" y="113" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">Edit →</text>

  <!-- Generated query code -->
  <text x="272" y="137" fill="#a78bfa" font-size="9" font-family="monospace">query</text>
  <text x="305" y="137" fill="var(--text)" font-size="9" font-family="monospace"> {</text>
  <text x="280" y="151" fill="var(--text-muted)" font-size="9" font-family="monospace">  health</text>
  <text x="280" y="165" fill="var(--text)" font-size="9" font-family="monospace">  user(</text>
  <text x="309" y="165" fill="#7dd3fc" font-size="9" font-family="monospace">id</text>
  <text x="321" y="165" fill="var(--text)" font-size="9" font-family="monospace">: </text>
  <text x="330" y="165" fill="#86efac" font-size="9" font-family="monospace">"usr-1"</text>
  <text x="373" y="165" fill="var(--text)" font-size="9" font-family="monospace">) {</text>
  <text x="280" y="179" fill="var(--text-muted)" font-size="9" font-family="monospace">    </text>
  <text x="296" y="179" fill="#f59e0b" font-size="9" font-family="monospace">userId</text>
  <text x="333" y="179" fill="var(--text)" font-size="9" font-family="monospace">: id</text>
  <text x="280" y="193" fill="#a78bfa" font-size="9" font-family="monospace">      @include</text>
  <text x="348" y="193" fill="var(--text)" font-size="9" font-family="monospace">(if: </text>
  <text x="373" y="193" fill="#7dd3fc" font-size="9" font-family="monospace">true</text>
  <text x="397" y="193" fill="var(--text)" font-size="9" font-family="monospace">)</text>
  <text x="280" y="207" fill="var(--text)" font-size="9" font-family="monospace">  }</text>
  <text x="272" y="221" fill="var(--text)" font-size="9" font-family="monospace">}</text>

  <!-- Live update callout -->
  <rect x="264" y="228" width="232" height="14" rx="3" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))" stroke="var(--border)" stroke-width="0.8"/>
  <text x="380" y="239" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">● Updates live on every field check</text>

  <!-- ── RIGHT: Summary panel (30%) ───────────────────────────────────────── -->
  <rect x="502" y="98" width="190" height="234" fill="var(--bg)"/>

  <!-- Summary header -->
  <rect x="502" y="98" width="190" height="22" fill="var(--surface)"/>
  <line x1="502" y1="120" x2="692" y2="120" stroke="var(--border)" stroke-width="1"/>
  <text x="512" y="113" font-size="8.5" font-weight="600" fill="var(--text)">Summary</text>
  <text x="632" y="113" text-anchor="end" font-size="7.5" fill="var(--text-muted)">2 fields</text>

  <!-- Field options section -->
  <rect x="502" y="121" width="190" height="16" fill="var(--surface)"/>
  <text x="512" y="132" font-size="7.5" font-weight="600" fill="var(--text-muted)">FIELD OPTIONS</text>

  <!-- user.id row -->
  <rect x="502" y="138" width="190" height="36" fill="var(--bg)" stroke="var(--border)" stroke-width="0.5"/>
  <text x="512" y="152" font-size="8" font-weight="600" fill="var(--text)">user › id</text>
  <text x="512" y="164" fill="var(--text-muted)" font-size="7.5">Alias:</text>
  <rect x="540" y="158" width="56" height="12" rx="2" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="546" y="168" fill="#f59e0b" font-size="7.5" font-family="monospace">userId</text>
  <!-- alias callout -->
  <rect x="604" y="148" width="82" height="14" rx="3" fill="color-mix(in srgb, #f59e0b 12%, var(--surface))" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="645" y="158" text-anchor="middle" fill="#f59e0b" font-size="7">alias renames response key</text>
  <line x1="596" y1="162" x2="604" y2="155" stroke="#f59e0b" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- @include toggle -->
  <rect x="502" y="175" width="190" height="28" fill="var(--bg)" stroke="var(--border)" stroke-width="0.5"/>
  <text x="512" y="188" fill="var(--text-muted)" font-size="7.5">@include:</text>
  <rect x="554" y="181" width="28" height="14" rx="7" fill="var(--primary)"/>
  <circle cx="575" cy="188" r="5" fill="white"/>
  <text x="588" y="192" fill="var(--text-muted)" font-size="7">ON</text>
  <!-- @include callout -->
  <rect x="604" y="175" width="82" height="14" rx="3" fill="color-mix(in srgb, #a78bfa 12%, var(--surface))" stroke="#a78bfa" stroke-width="0.8"/>
  <text x="645" y="185" text-anchor="middle" fill="#a78bfa" font-size="7">conditional at runtime</text>
  <line x1="588" y1="188" x2="604" y2="182" stroke="#a78bfa" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- health row in summary -->
  <rect x="502" y="204" width="190" height="22" fill="var(--bg)" stroke="var(--border)" stroke-width="0.5"/>
  <text x="512" y="218" font-size="8" fill="var(--text)">health</text>
  <text x="554" y="218" fill="var(--text-muted)" font-size="7.5">no options</text>

  <!-- ── Bottom: Variables panel ────────────────────────────────────────────── -->
  <rect x="8" y="332" width="684" height="52" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <line x1="8" y1="332" x2="692" y2="332" stroke="var(--border)" stroke-width="1"/>
  <rect x="16" y="338" width="62" height="16" rx="3" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))" stroke="var(--border)" stroke-width="1"/>
  <text x="47" y="349" text-anchor="middle" font-size="8" fill="var(--text)" font-weight="600">Variables</text>
  <text x="16" y="368" fill="var(--text-muted)" font-size="8" font-family="monospace">{ </text>
  <text x="28" y="368" fill="#7dd3fc" font-size="8" font-family="monospace">"id"</text>
  <text x="52" y="368" fill="var(--text)" font-size="8" font-family="monospace">: </text>
  <text x="62" y="368" fill="#86efac" font-size="8" font-family="monospace">"usr-1"</text>
  <text x="100" y="368" fill="var(--text)" font-size="8" font-family="monospace"> }</text>
  <text x="130" y="368" fill="var(--text-muted)" font-size="7.5" font-style="italic">← synced from arg input</text>

  <!-- ── One-way sync legend ────────────────────────────────────────────────── -->
  <line x1="8" y1="387" x2="692" y2="387" stroke="var(--border)" stroke-width="1"/>
  <rect x="8" y="387" width="684" height="38" fill="var(--bg)"/>

  <defs>
    <marker id="gql8-arr" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M1,1 L5,3 L1,5 Z" fill="var(--primary)"/>
    </marker>
    <marker id="gql8-arr-muted" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M1,1 L5,3 L1,5 Z" fill="var(--text-muted)"/>
    </marker>
  </defs>

  <!-- Builder → Editor (one-way) -->
  <text x="60" y="402" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Field Tree</text>
  <text x="60" y="414" text-anchor="middle" font-size="7" fill="var(--text-muted)">select fields</text>
  <line x1="100" y1="407" x2="140" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql8-arr)"/>
  <text x="192" y="402" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">SDL Preview</text>
  <text x="192" y="414" text-anchor="middle" font-size="7" fill="var(--text-muted)">live update</text>
  <line x1="242" y1="407" x2="282" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql8-arr)"/>
  <text x="340" y="402" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Edit in Editor</text>
  <text x="340" y="414" text-anchor="middle" font-size="7" fill="var(--text-muted)">one-way transfer</text>
  <line x1="398" y1="407" x2="438" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql8-arr)"/>
  <text x="488" y="402" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Monaco Editor</text>
  <text x="488" y="414" text-anchor="middle" font-size="7" fill="var(--text-muted)">fine-tune SDL</text>
  <!-- No return arrow (one-way) -->
  <line x1="538" y1="403" x2="578" y2="403" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3 3" marker-end="url(#gql8-arr-muted)"/>
  <text x="616" y="402" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">not synced back</text>
  <text x="616" y="413" text-anchor="middle" font-size="7" fill="var(--text-muted)">(one-way)</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Open Builder ────────────────────────────────────────────────
    {
      id: 'gql7-builder',
      title: 'Open Builder Mode',
      description:
        'Click **Builder** on the editor mode toolbar to open the visual workspace. The Monaco editor is replaced by a three-panel layout.\n\n' +
        '**Why Builder mode?** When you join a new project or explore an unfamiliar API, reading raw SDL is slow — you\'d need to mentally parse type definitions just to figure out which fields exist. ' +
        `Builder reads the introspected schema from \`${GQL_DEMO_HTTP}\` and renders it as a **clickable tree**, so you can see every available field instantly. ` +
        'The left panel lists **Query** root fields — `health` (a simple health check) and `user(id: ID!)` (an object type requiring an id argument).',
      highlight: GQL.MODE_BUILDER,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ensureBuilderMode(ctx);
        await ctx.delay(800);
      },
      verify: GQL.QB_FIELD_TREE,
      pauseAfter: true,
    },

    // ── Step 2: Expand & Explore ────────────────────────────────────────────
    {
      id: 'gql7-expand',
      title: 'Explore Object Types',
      description:
        'The **Query** type header shows the total field count and **Select all** / **Deselect all** shortcuts. ' +
        'Click the **›** expand button on the `user` row to reveal its scalar subfields — `id`, `name`, and `email`.\n\n' +
        '**Why expand matters:** GraphQL types can nest many levels deep. The expand/collapse tree lets you explore complex schemas (like a Shopify or GitHub schema) without being overwhelmed — you open only the branches you need. ' +
        'Each subfield shows its type (`ID!`, `String`, etc.) so you can assess nullability before selecting.',
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

    // ── Step 3: Select a field ──────────────────────────────────────────────
    {
      id: 'gql7-health',
      title: 'Select a Field — Live Preview',
      description:
        'Check **health** in the field tree. Watch the center **SDL preview** update instantly — `query { health }` appears without you typing a single character.\n\n' +
        '**Why this matters:** The live preview is your feedback loop. As you check more fields, add arguments, set aliases, or enable directives, the preview reflects the exact query document that will be sent to the server — ' +
        'no guessing whether the syntax is correct. You can also paste this preview directly into API documentation or share it with teammates.',
      highlight: GQL.QB_FIELD_TREE,
      preAction: ensureBuilderMode,
      action: async (ctx) => {
        await ensureHealthFieldSelected(ctx);
        await ctx.waitFor(GQL.QB_CODE, 5000);
        await ctx.delay(800);
      },
      verify: GQL.QB_CODE,
      pauseAfter: true,
    },

    // ── Step 4: Select All ──────────────────────────────────────────────────
    {
      id: 'gql7-select-all',
      title: 'Select All / Deselect All',
      description:
        'Click **Select all** to select every leaf field at the current level — all scalar subfields under the Query type appear in the preview immediately. ' +
        'Click again (**Deselect all**) to clear them all.\n\n' +
        '**Why "select all" exists:** When you want to explore what a type returns, checking fields one by one is tedious. Select all gives you a starting point — the full response shape — then you deselect the fields you don\'t need. ' +
        'This is faster than building up from zero, especially for types with 10+ scalar fields.',
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

    // ── Step 5: Arguments ───────────────────────────────────────────────────
    {
      id: 'gql7-user-arg',
      title: 'Fill Required Arguments',
      description:
        'Check **user** in the field tree — an inline **id** argument input appears beneath the field. Fill it with a demo user id.\n\n' +
        '**Why arguments surface inline:** `user(id: ID!)` has a required argument — without it, the server rejects the query. ' +
        'Builder makes required args immediately visible by showing them as an inline input row underneath the field. ' +
        'You can\'t miss them the way you might when writing SDL manually. ' +
        'The filled value is also synced to the **Variables** panel so the query can be parameterized.',
      highlight: GQL.QB_ARG_USER_ID,
      preAction: ensureSelectAllDemonstrated,
      action: async (ctx) => {
        await ensureUserFieldConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.QB_ARG_USER_ID,
      pauseAfter: true,
    },

    // ── Step 6: Alias ───────────────────────────────────────────────────────
    {
      id: 'gql7-alias',
      title: 'Set a Field Alias',
      description:
        'In the **Summary** panel → **Field options**, expand the **user › id** row and set alias **`userId`**. The SDL preview renames the field from `id` to `userId: id`.\n\n' +
        '**Why aliases matter:** GraphQL responses use the field name as the JSON key. If you query the same field twice with different arguments, you\'d get a key conflict — aliases resolve this. ' +
        'Aliases also let you match the shape of your UI state — if your frontend expects `userId` not `id`, the alias eliminates the need for a mapping layer. ' +
        'The builder writes the alias into the SDL automatically when you type it.',
      highlight: GQL.FO_EXPAND_USER_ID,
      preAction: ensureUserFieldConfigured,
      action: async (ctx) => {
        await ensureAliasConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.FO_ALIAS_USER_ID,
      pauseAfter: true,
    },

    // ── Step 7: @include Directive ──────────────────────────────────────────
    {
      id: 'gql7-include',
      title: 'Add the @include Directive',
      description:
        'Expand the **user › id** row in **Field options**, then toggle **@include**. The SDL preview adds `@include(if: true)` next to the field.\n\n' +
        '**Why @include exists:** A single query document can serve multiple UI states using directives. ' +
        'Replace the literal `true` with a variable `$withId: Boolean!` and pass `{ withId: false }` to skip the field — ' +
        'no need to maintain two separate query strings. ' +
        '**@skip** is the inverse: `@skip(if: $hide)` omits the field when `$hide` is `true`. ' +
        'Directives make your queries more flexible without adding complexity to the server.',
      highlight: GQL.FO_EXPAND_USER_ID,
      preAction: ensureAliasConfigured,
      action: async (ctx) => {
        await ensureIncludeConfigured(ctx);
        await ctx.waitFor(GQL.QB_CODE, 5000);
        await ctx.delay(800);
      },
      verify: GQL.QB_CODE,
      pauseAfter: true,
    },

    // ── Step 8: Copy SDL ────────────────────────────────────────────────────
    {
      id: 'gql7-copy',
      title: 'Copy the Generated Query',
      description:
        'Click **Copy** in the builder toolbar — the full generated query is copied to your clipboard. The button briefly shows **Copied ✓** as confirmation.\n\n' +
        '**When to use Copy:** If you want to paste the query into an API playground, a Postman collection, a curl command, or inline into application code — without going through the Editor mode. ' +
        'The copied SDL is production-ready: it includes arguments, aliases, and directives exactly as configured in the builder.',
      highlight: GQL.QB_COPY,
      preAction: ensureIncludeConfigured,
      action: async (ctx) => {
        await ctx.click(GQL.QB_COPY);
        await ctx.delay(1500);
      },
      verify: GQL.QB_COPY,
      pauseAfter: true,
    },

    // ── Step 9: Edit in Editor ──────────────────────────────────────────────
    {
      id: 'gql7-edit',
      title: 'Transfer to Monaco Editor',
      description:
        'Click **Edit in Editor** — the generated SDL is copied into Monaco and **Builder mode exits**. Variables from the builder sync to the Variables tab automatically.\n\n' +
        '**Why "Edit in Editor" exists:** Builder is great for exploration, but it can\'t express every valid GraphQL construct — inline fragments, spread operators, custom directives not in the schema, or complex variable usage. ' +
        'Once you\'ve built the skeleton in Builder, transfer it to Monaco for fine-tuning. ' +
        'You get the best of both worlds: visual construction for the boilerplate, textual editing for the advanced features.',
      highlight: GQL.QB_EDIT,
      preAction: ensureIncludeConfigured,
      action: async (ctx) => {
        await ensureEditedToEditor(ctx);
        await ctx.delay(800);
      },
      verify: GQL.MODE_EDITOR,
      pauseAfter: true,
    },

    // ── Step 10: One-way sync demo ──────────────────────────────────────────
    {
      id: 'gql7-one-way',
      title: 'One-Way Sync Explained',
      description:
        `Add a comment in Monaco (\`${LESSON7_EDITOR_COMMENT}\`), then switch to **Builder** — watch the **Generated query** panel on the left: it still shows the builder's last export, not your manual edit.\n\n` +
        '**Why sync is one-way:** Builder maintains a *selection model* — a structured record of which fields are checked, which arguments are filled, which aliases and directives are set. ' +
        'That model cannot be reconstructed from arbitrary SDL (comments, inline fragments, custom variable names all break the mapping). ' +
        'So Builder → Editor is a one-way export, not a live bidirectional sync. ' +
        'Switching back to **Builder** restores your checkbox selections, aliases, and directives — but not manual edits you made in Monaco. ' +
        'Think of it as: Builder is your **sketch pad**, Editor is your **production draft**.',
      highlight: GQL.QB_CODE,
      preAction: ensureEditedToEditor,
      action: async (ctx) => {
        const model = getMonacoGqlModel();
        const current = model?.getValue() ?? '';
        if (!current.includes(LESSON7_EDITOR_COMMENT)) {
          await fillGqlEditor(ctx, `${current}\n${LESSON7_EDITOR_COMMENT}`, { focus: true });
          await ctx.delay(1500);
        }
        await ctx.click(GQL.MODE_BUILDER);
        await ctx.waitFor(GQL.QB_CODE, 5000);
        await ctx.delay(800);
        document.querySelector(GQL.QB_CODE)?.scrollIntoView?.({ block: 'center' });
        await ctx.delay(600);
        const preview = getBuilderCodeText();
        if (!preview.includes(LESSON7_EDITOR_COMMENT)) {
          await ctx.delay(2000);
        } else {
          await ctx.delay(800);
        }
      },
      verify: GQL.QB_CODE,
      pauseAfter: true,
    },
  ],
};
