/** Lesson GQL-3: Schema Exploration — browse, search, Try → insert, execute, SDL export */
import type { DemoLesson } from '../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
  configureDemoTabEndpointOverride,
  ensureEditorReadyForInsert,
  ensureIntrospected,
  ensureSchemaExplorerOpen,
  ensureQueryTypeSelected,
  ensureTryInsertDone,
  ensureUserTypeSelected,
  gqlSchemaLessonCleanup,
  gqlSchemaLessonSetup,
  markTryInsertDone,
  prepareGql4IntrospectReading,
  syncGql4IntrospectSchemaTabDuringReading,
  searchSchemaTypes,
  selectSchemaType,
} from './graphql-lesson-helpers';

export const gqlSchemaLesson: DemoLesson = {
  id: 'gql-schema-exploration',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Schema Exploration',
  description:
    'Browse the introspected schema, search types, inspect fields and arguments, insert a field with Try →, execute the resulting query, and export SDL — everything you need to understand any GraphQL API without reading documentation.',
  estimatedMinutes: 5,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlSchemaLessonSetup,
  cleanup: gqlSchemaLessonCleanup,

  concept: {
    title: 'Schema Explorer',
    body: `After **Introspect**, the **Schema** tab on the right becomes your API contract browser — a searchable, navigable representation of every type the server exposes. In a real production API with 50–200 types, this is how you discover operations, field shapes, and argument requirements **without reading external documentation**.

**The four Schema Explorer capabilities:**

1. **Type browser** — lists every type organised by kind (Object, Input, Enum, Scalar) with colour-coded icons. Use the **search box** to filter by name as you type — indispensable on large schemas.
2. **Field table** — for each selected type, every field is shown with its return type, required arguments (e.g. \`id: ID!\`), and nullability. The **Args** column shows \`—\` when a field takes no arguments.
3. **Try →** — a per-field button in the field table that inserts the field name inside your query block. Fields that require arguments get \`fieldName()\` inserted, ready for you to fill the parentheses. A toast confirms **"Inserted: fieldName"**. After inserting, execute the query immediately to see the live result.
4. **SDL tab + Export** — the **SDL** tab on the type detail panel shows the raw Schema Definition Language for that type (e.g. \`type Query { health: String user(id: ID!): User }\`). **Export SDL** in the toolbar downloads the **full schema** as a \`.graphql\` file — the standard input for schema versioning tools and CI diff checks.

The test server schema used in this lesson has five types: **Query** (root entry points), **Mutation** (write operations), **User** and **Order** (domain objects), and **OrderInput** (an input type for creating orders). You explored the schema briefly in **GQL-1 (Your First GraphQL Query)** — this lesson goes deeper: search, field arguments, click-to-insert, and SDL export.`,
    keyTerms: [
      {
        term: 'SDL',
        definition:
          'Schema Definition Language — the textual form of your GraphQL schema (`type Query { health: String … }`). The SDL tab shows the definition for any selected type; Export SDL downloads the full schema as a `.graphql` file for version control and CI diffs.',
      },
      {
        term: 'Try →',
        definition:
          'A per-field button in the Schema Explorer field table. Clicking it inserts the field name at the Monaco editor cursor. Fields with arguments insert `fieldName()` so you can fill in the arguments next — eliminates typos and copy-paste errors.',
      },
      {
        term: 'Type kind',
        definition:
          'GraphQL type category: OBJECT (domain types like User), INPUT_OBJECT (argument types like OrderInput), ENUM, SCALAR (String, ID, Boolean …). The Explorer shows colour-coded kind badges in the type list.',
      },
      {
        term: 'Non-null (!)',
        definition:
          'The `!` suffix means the value cannot be null. `id: ID!` means the `id` argument is required and must be a non-null ID scalar. The schema enforces this before the server resolves the field.',
      },
      {
        term: 'Export SDL',
        definition:
        'Downloads the full introspected schema as a `.graphql` file. Commit this to version control to track schema evolution — when a field is added, renamed, or removed, `git diff` makes it immediately visible. **GQL-12 (Schema Diff)** shows automated comparison.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 430" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="gql3-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="gql3-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="gql3-arr-p" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#c084fc"/>
    </marker>
    <linearGradient id="gql3-tab-active" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d3a4d"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="gql3-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- ══ STUDIO FRAME ══════════════════════════════════════════════════════════ -->
  <rect x="1" y="1" width="698" height="272" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5" filter="url(#gql3-shadow)"/>

  <!-- title bar -->
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc" font-family="system-ui,sans-serif">GraphQL Studio — Schema Explorer</text>

  <!-- ══ CONNECTION BAR (y 31–70) ════════════════════════════════════════════ -->
  <rect x="1" y="31" width="698" height="39" fill="#0f172a"/>
  <line x1="1" y1="70" x2="698" y2="70" stroke="#3b4a60" stroke-width="1"/>

  <!-- Endpoint input -->
  <rect x="10" y="38" width="310" height="24" rx="4" fill="#0a1118" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="20" y="54" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#94a3b8">http://localhost:4010/graphql</text>

  <!-- ✓ Schema badge (green — already introspected) -->
  <rect x="330" y="39" width="70" height="22" rx="11" fill="#052e16" stroke="#22c55e" stroke-width="1.2"/>
  <text x="365" y="54" text-anchor="middle" font-size="9.5" fill="#22c55e" font-family="system-ui,sans-serif">✓ Schema</text>

  <!-- Introspect button (already clicked — softer style) -->
  <rect x="408" y="39" width="80" height="22" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="448" y="54" text-anchor="middle" font-size="10" fill="#6b7e96" font-family="system-ui,sans-serif">Introspect</text>

  <!-- Execute button (dimmed — not the focus of this lesson) -->
  <rect x="495" y="39" width="78" height="22" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="534" y="54" text-anchor="middle" font-size="10" fill="#6b7e96" font-family="system-ui,sans-serif">▶ Execute</text>

  <!-- Export SDL button (top-right of connection bar) -->
  <rect x="582" y="39" width="108" height="22" rx="4" fill="#1e293b" stroke="#c084fc" stroke-width="1.2"/>
  <text x="636" y="54" text-anchor="middle" font-size="9.5" fill="#c084fc" font-weight="500" font-family="system-ui,sans-serif">Export SDL ↓</text>
  <!-- ④ callout on Export SDL -->
  <circle cx="688" cy="39" r="8" fill="#c084fc"/>
  <text x="688" y="43" text-anchor="middle" font-size="9" font-weight="700" fill="#0d1520" font-family="system-ui,sans-serif">④</text>

  <!-- ══ MODE TABS (y 70–96) ═══════════════════════════════════════════════ -->
  <rect x="1" y="70" width="698" height="26" fill="#0f172a"/>
  <rect x="8" y="73" width="60" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="38" y="87" text-anchor="middle" font-size="10" fill="#a8b8cc" font-family="system-ui,sans-serif">Editor</text>
  <text x="106" y="87" text-anchor="middle" font-size="10" fill="#3b4a60" font-family="system-ui,sans-serif">Builder</text>

  <!-- ══ VERTICAL DIVIDER (editor | schema panel) ═════════════════════════ -->
  <line x1="212" y1="96" x2="212" y2="244" stroke="#3b4a60" stroke-width="1"/>

  <!-- ══ LEFT: Monaco editor (x=1 to x=211, y=96–244) ═══════════════════ -->
  <rect x="1" y="96" width="211" height="148" fill="#0d1520"/>
  <rect x="1" y="96" width="26" height="148" fill="#090f1a"/>
  <text x="14" y="113" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">1</text>
  <text x="14" y="128" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">2</text>
  <text x="14" y="143" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">3</text>
  <!-- query text (faded — editor is not the focus here) -->
  <text x="34" y="113" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#c084fc" opacity="0.55">query</text>
  <text x="75" y="113" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#f1f5f9" opacity="0.55"> {</text>
  <text x="34" y="128" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#f1f5f9" opacity="0.35">  </text>
  <!-- cursor blink indicator in the empty query body -->
  <rect x="46" y="119" width="1.5" height="11" fill="#f1f5f9" opacity="0.5"/>
  <text x="34" y="143" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#f1f5f9" opacity="0.55">}</text>
  <!-- Try → annotation pointing into editor -->
  <line x1="160" y1="175" x2="60" y2="127" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3,2" marker-end="url(#gql3-arr)" opacity="0.7"/>
  <text x="158" y="187" text-anchor="middle" font-size="8" fill="#3b82f6" opacity="0.9" font-family="system-ui,sans-serif">Try → inserts</text>
  <text x="158" y="197" text-anchor="middle" font-size="8" fill="#3b82f6" opacity="0.9" font-family="system-ui,sans-serif">at cursor</text>

  <!-- ══ RIGHT: Schema Explorer panel (x=213 to x=698, y=96–244) ════════ -->
  <rect x="213" y="96" width="485" height="148" fill="#0d1520"/>

  <!-- Right panel tabs: Response | Schema (Schema ACTIVE) -->
  <rect x="213" y="96" width="485" height="26" fill="#0f172a"/>
  <rect x="218" y="99" width="76" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="256" y="113" text-anchor="middle" font-size="10" fill="#6b7e96" font-family="system-ui,sans-serif">Response</text>
  <!-- Schema tab — ACTIVE (blue underline) -->
  <rect x="300" y="99" width="66" height="20" rx="3" fill="url(#gql3-tab-active)" stroke="#3b4a60" stroke-width="1"/>
  <rect x="300" y="117" width="66" height="2" fill="#3b82f6"/>
  <text x="333" y="113" text-anchor="middle" font-size="10" font-weight="600" fill="#f1f5f9" font-family="system-ui,sans-serif">Schema</text>

  <!-- ── Schema explorer sub-header: search box (y=122–146) ─────────────── -->
  <rect x="213" y="122" width="485" height="24" fill="#090f1a"/>
  <rect x="220" y="125" width="164" height="16" rx="4" fill="#0a1118" stroke="#3b4a60" stroke-width="1"/>
  <text x="228" y="137" font-size="8.5" fill="#6b7e96" font-family="system-ui,sans-serif">🔍  Search types…</text>

  <!-- ── VERTICAL DIVIDER: type list | type detail ─────────────────────── -->
  <line x1="348" y1="146" x2="348" y2="244" stroke="#3b4a60" stroke-width="1"/>

  <!-- ══ TYPE LIST (x=213 to x=347, y=146–244) ═════════════════════════ -->
  <rect x="213" y="146" width="135" height="98" fill="#0a1118"/>

  <!-- Query — SELECTED (blue bg + left accent) -->
  <rect x="213" y="146" width="135" height="22" fill="#162036"/>
  <rect x="213" y="146" width="3" height="22" fill="#3b82f6"/>
  <rect x="219" y="149" width="22" height="14" rx="2" fill="#1e3a5f" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="230" y="160" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="7" fill="#3b82f6">OBJ</text>
  <text x="248" y="161" font-size="9.5" font-weight="600" fill="#3b82f6" font-family="system-ui,sans-serif">Query</text>
  <!-- ① callout on type list -->
  <circle cx="340" cy="157" r="8" fill="#3b82f6"/>
  <text x="340" y="161" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">①</text>

  <!-- Mutation -->
  <rect x="213" y="168" width="135" height="20" fill="#0a1118"/>
  <rect x="219" y="171" width="22" height="14" rx="2" fill="#1e293b" stroke="#f59e0b" stroke-width="0.8"/>
  <text x="230" y="181" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="7" fill="#f59e0b">OBJ</text>
  <text x="248" y="182" font-size="9.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Mutation</text>

  <!-- User -->
  <rect x="213" y="188" width="135" height="20" fill="#0a1118"/>
  <rect x="219" y="191" width="22" height="14" rx="2" fill="#1e293b" stroke="#4ade80" stroke-width="0.8"/>
  <text x="230" y="201" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="7" fill="#4ade80">OBJ</text>
  <text x="248" y="202" font-size="9.5" fill="#a8b8cc" font-family="system-ui,sans-serif">User</text>

  <!-- Order -->
  <rect x="213" y="208" width="135" height="20" fill="#0a1118"/>
  <rect x="219" y="211" width="22" height="14" rx="2" fill="#1e293b" stroke="#4ade80" stroke-width="0.8"/>
  <text x="230" y="221" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="7" fill="#4ade80">OBJ</text>
  <text x="248" y="222" font-size="9.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Order</text>

  <!-- OrderInput -->
  <rect x="213" y="228" width="135" height="16" fill="#0a1118"/>
  <rect x="219" y="230" width="22" height="12" rx="2" fill="#1e293b" stroke="#c084fc" stroke-width="0.8"/>
  <text x="230" y="239" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="6.5" fill="#c084fc">INP</text>
  <text x="248" y="240" font-size="9" fill="#8b9ab5" font-family="system-ui,sans-serif">OrderInput</text>

  <!-- ══ TYPE DETAIL PANEL (x=349 to x=698, y=146–244) ═════════════════ -->
  <rect x="349" y="146" width="349" height="98" fill="#0d1520"/>

  <!-- Type detail header: "Query" + Fields/SDL tabs -->
  <rect x="349" y="146" width="349" height="24" fill="#0f172a"/>
  <text x="357" y="162" font-size="11" font-weight="700" fill="#f1f5f9" font-family="system-ui,sans-serif">Query</text>
  <!-- Fields tab (ACTIVE) -->
  <rect x="400" y="149" width="46" height="18" rx="3" fill="#162036" stroke="#3b82f6" stroke-width="1"/>
  <text x="423" y="162" text-anchor="middle" font-size="8.5" fill="#3b82f6" font-weight="600" font-family="system-ui,sans-serif">Fields</text>
  <!-- SDL tab -->
  <rect x="452" y="149" width="36" height="18" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="470" y="162" text-anchor="middle" font-size="8.5" fill="#6b7e96" font-family="system-ui,sans-serif">SDL</text>

  <!-- Column headers -->
  <rect x="349" y="170" width="349" height="16" fill="#090f1a"/>
  <text x="357" y="181" font-size="7.5" fill="#6b7e96" letter-spacing="0.4" font-family="system-ui,sans-serif">FIELD</text>
  <text x="440" y="181" font-size="7.5" fill="#6b7e96" letter-spacing="0.4" font-family="system-ui,sans-serif">TYPE</text>
  <text x="506" y="181" font-size="7.5" fill="#6b7e96" letter-spacing="0.4" font-family="system-ui,sans-serif">ARGS</text>
  <!-- Try → column has no header label — buttons reveal on hover -->
  <text x="575" y="181" font-size="6.5" fill="#4a5a6e" letter-spacing="0.3" font-family="system-ui,sans-serif">hover</text>
  <!-- ② callout on column headers -->
  <circle cx="690" cy="178" r="8" fill="#22c55e"/>
  <text x="690" y="182" text-anchor="middle" font-size="9" font-weight="700" fill="#0d1520" font-family="system-ui,sans-serif">②</text>

  <!-- Row: health field — HIGHLIGHTED (active selection) -->
  <rect x="349" y="186" width="349" height="20" fill="#0f1e30"/>
  <rect x="349" y="186" width="2" height="20" fill="#3b82f6"/>
  <text x="357" y="200" font-size="9.5" fill="#22d3ee" font-weight="600" font-family="'SF Mono','Fira Code',monospace">health</text>
  <text x="440" y="200" font-size="9" fill="#4ade80" font-family="system-ui,sans-serif">String</text>
  <text x="506" y="200" font-size="9" fill="#3b4a60" font-family="system-ui,sans-serif">—</text>
  <!-- Try → button (highlighted blue — this is the focus of step 5) -->
  <rect x="575" y="188" width="44" height="16" rx="3" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1.4"/>
  <text x="597" y="200" text-anchor="middle" font-size="8.5" fill="#3b82f6" font-weight="700" font-family="system-ui,sans-serif">Try →</text>
  <!-- ③ callout on Try → button -->
  <circle cx="660" cy="196" r="8" fill="#3b82f6"/>
  <text x="660" y="200" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">③</text>

  <!-- Row: user field (Try → shown at rest-opacity to match actual UI) -->
  <rect x="349" y="206" width="349" height="20" fill="#0d1520"/>
  <text x="357" y="220" font-size="9.5" fill="#22d3ee" font-family="'SF Mono','Fira Code',monospace">user</text>
  <text x="440" y="220" font-size="9" fill="#4ade80" font-family="system-ui,sans-serif">User!</text>
  <text x="506" y="220" font-size="8.5" fill="#f59e0b" font-family="'SF Mono','Fira Code',monospace">id: ID!</text>
  <rect x="575" y="208" width="44" height="16" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1" opacity="0.42"/>
  <text x="597" y="220" text-anchor="middle" font-size="8.5" fill="#4a7ab0" font-family="system-ui,sans-serif" opacity="0.5">Try →</text>

  <!-- Row: order field (Try → at rest-opacity) -->
  <rect x="349" y="226" width="349" height="18" fill="#0d1520"/>
  <text x="357" y="238" font-size="9.5" fill="#22d3ee" font-family="'SF Mono','Fira Code',monospace">order</text>
  <text x="440" y="238" font-size="9" fill="#4ade80" font-family="system-ui,sans-serif">Order</text>
  <text x="506" y="238" font-size="8.5" fill="#f59e0b" font-family="'SF Mono','Fira Code',monospace">id: ID!</text>
  <rect x="575" y="228" width="44" height="14" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1" opacity="0.42"/>
  <text x="597" y="238" text-anchor="middle" font-size="8.5" fill="#4a7ab0" font-family="system-ui,sans-serif" opacity="0.5">Try →</text>

  <!-- ══ BOTTOM BAR (y 244–272) ════════════════════════════════════════ -->
  <line x1="1" y1="244" x2="698" y2="244" stroke="#3b4a60" stroke-width="1"/>
  <rect x="1" y="244" width="698" height="28" fill="#0f172a"/>
  <rect x="10" y="249" width="76" height="16" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="48" y="261" text-anchor="middle" font-size="10" fill="#a8b8cc" font-family="system-ui,sans-serif">Variables</text>
  <text x="100" y="261" text-anchor="middle" font-size="10" fill="#3b4a60" font-family="system-ui,sans-serif">Headers</text>

  <!-- ══ LEGEND SECTION (y 288–420) ════════════════════════════════════ -->
  <text x="350" y="304" text-anchor="middle" font-size="10" fill="#a8b8cc" letter-spacing="0.5" font-family="system-ui,sans-serif">SCHEMA EXPLORER CAPABILITIES</text>

  <!-- Box ①: Type Browser -->
  <rect x="8" y="314" width="160" height="98" rx="6" fill="#111b28" stroke="#3b82f6" stroke-width="1.2"/>
  <circle cx="26" cy="330" r="10" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1.4"/>
  <text x="26" y="334" text-anchor="middle" font-size="10" font-weight="700" fill="#3b82f6" font-family="system-ui,sans-serif">①</text>
  <text x="112" y="334" text-anchor="middle" font-size="9.5" font-weight="700" fill="#3b82f6" font-family="system-ui,sans-serif">Type Browser</text>
  <line x1="16" y1="341" x2="160" y2="341" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="84" y="356" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Lists all types by kind:</text>
  <text x="84" y="369" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">OBJECT, INPUT, ENUM, SCALAR</text>
  <text x="84" y="383" text-anchor="middle" font-size="8.5" fill="#22d3ee" font-family="system-ui,sans-serif">Search box filters by name</text>
  <text x="84" y="397" text-anchor="middle" font-size="8" fill="#6b7e96" font-family="system-ui,sans-serif">Essential for large schemas (50+ types)</text>
  <text x="84" y="408" text-anchor="middle" font-size="8" fill="#6b7e96" font-family="system-ui,sans-serif">without reading documentation</text>

  <!-- Box ②: Field Table -->
  <rect x="176" y="314" width="160" height="98" rx="6" fill="#111b28" stroke="#22c55e" stroke-width="1.2"/>
  <circle cx="194" cy="330" r="10" fill="#052e16" stroke="#22c55e" stroke-width="1.4"/>
  <text x="194" y="334" text-anchor="middle" font-size="10" font-weight="700" fill="#22c55e" font-family="system-ui,sans-serif">②</text>
  <text x="276" y="334" text-anchor="middle" font-size="9.5" font-weight="700" fill="#22c55e" font-family="system-ui,sans-serif">Field Table</text>
  <line x1="184" y1="341" x2="328" y2="341" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="256" y="356" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">name · return type</text>
  <text x="256" y="369" text-anchor="middle" font-size="8.5" fill="#f59e0b" font-family="'SF Mono','Fira Code',monospace">args: id: ID!  (required)</text>
  <text x="256" y="383" text-anchor="middle" font-size="8.5" fill="#3b4a60" font-family="system-ui,sans-serif">— = no arguments needed</text>
  <text x="256" y="397" text-anchor="middle" font-size="8.5" fill="#4ade80" font-family="system-ui,sans-serif">! = non-nullable (required)</text>
  <text x="256" y="409" text-anchor="middle" font-size="8" fill="#6b7e96" font-family="system-ui,sans-serif">colour-coded scalar return types</text>

  <!-- Box ③: Try → Insert -->
  <rect x="344" y="314" width="160" height="98" rx="6" fill="#111b28" stroke="#3b82f6" stroke-width="1.2"/>
  <circle cx="362" cy="330" r="10" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1.4"/>
  <text x="362" y="334" text-anchor="middle" font-size="10" font-weight="700" fill="#3b82f6" font-family="system-ui,sans-serif">③</text>
  <text x="444" y="334" text-anchor="middle" font-size="9.5" font-weight="700" fill="#3b82f6" font-family="system-ui,sans-serif">Try → Insert</text>
  <line x1="352" y1="341" x2="496" y2="341" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="424" y="356" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Inserts field name at cursor</text>
  <text x="424" y="369" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">in the Monaco editor</text>
  <text x="424" y="383" text-anchor="middle" font-size="8.5" fill="#22d3ee" font-family="system-ui,sans-serif">Toast: "Inserted: health"</text>
  <text x="424" y="397" text-anchor="middle" font-size="8.5" fill="#f1f5f9" font-family="'SF Mono','Fira Code',monospace">user() — args placeholder</text>
  <text x="424" y="409" text-anchor="middle" font-size="8" fill="#6b7e96" font-family="system-ui,sans-serif">eliminates typos in field names</text>

  <!-- Box ④: SDL + Export -->
  <rect x="512" y="314" width="180" height="98" rx="6" fill="#111b28" stroke="#c084fc" stroke-width="1.2"/>
  <circle cx="530" cy="330" r="10" fill="#2d1a4a" stroke="#c084fc" stroke-width="1.4"/>
  <text x="530" y="334" text-anchor="middle" font-size="10" font-weight="700" fill="#c084fc" font-family="system-ui,sans-serif">④</text>
  <text x="622" y="334" text-anchor="middle" font-size="9.5" font-weight="700" fill="#c084fc" font-family="system-ui,sans-serif">SDL Tab + Export</text>
  <line x1="520" y1="341" x2="684" y2="341" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="602" y="356" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">Raw type definition per type:</text>
  <text x="602" y="369" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="8" fill="#94a3b8">type Query { health: String }</text>
  <text x="602" y="383" text-anchor="middle" font-size="8.5" fill="#c084fc" font-family="system-ui,sans-serif">Export SDL → full .graphql file</text>
  <text x="602" y="397" text-anchor="middle" font-size="8.5" fill="#a8b8cc" font-family="system-ui,sans-serif">commit to git · track schema drift</text>
  <text x="602" y="409" text-anchor="middle" font-size="8" fill="#6b7e96" font-family="system-ui,sans-serif">input for Schema Diff (GQL-12)</text>

  <!-- caption -->
  <text x="350" y="426" text-anchor="middle" font-size="9" fill="#3b4a60" font-family="system-ui,sans-serif">Protocols → GraphQL → Schema Exploration (GQL-3)</text>
</svg>`,
  },

  steps: [
    // ── 1. Orientation ─────────────────────────────────────────────────────────
    {
      id: 'gql4-intro',
      title: 'Schema Explorer',
      description:
        'The **Schema Explorer** — the **Schema** tab on the right panel — transforms an introspected schema into a navigable contract browser. ' +
        'In a real production API with 50–200 types, this is how you discover what operations exist and what arguments they require — ' +
        'without reading external documentation. ' +
        'Click any type in the **type list** to open its **field table**: field name, return type, required arguments, and a **Try →** button ' +
        'that inserts the field directly into your Monaco editor. ' +
        'A **search box** at the top filters types as you type. ' +
        'The **SDL tab** on the detail panel shows the raw Schema Definition Language for any type. ' +
        'This lesson builds on the quick schema glimpse from **GQL-1** — here you search, inspect field arguments, use Try →, execute, read the response, and export the full SDL.',
      highlight: GQL.RIGHT_TAB_SCHEMA,
      pauseAfter: true,
    },

    // ── 2. Set endpoint ────────────────────────────────────────────────────────
    {
      id: 'gql4-endpoint',
      title: 'Set the Endpoint',
      description:
        `Connect to \`${GQL_DEMO_HTTP}\`. The local Docker test server exposes a schema with five types: ` +
        '**Query** (root entry points into the API), **Mutation** (write operations), **User** and **Order** (domain object types), ' +
        'and **OrderInput** (an input type for creating orders). You will browse all five through the Explorer in this lesson. ' +
        'Confirm the endpoint field shows the full URL including the `/graphql` path — ' +
        'GraphQL endpoints always use a path suffix, unlike REST where each resource lives at a different URL.',
      highlight: GQL.ENDPOINT_INPUT,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
      },
      action: async (ctx) => {
        await configureDemoTabEndpointOverride(ctx, GQL_DEMO_HTTP);
      },
      pauseAfter: true,
    },

    // ── 3. Introspect ──────────────────────────────────────────────────────────
    {
      id: 'gql4-introspect',
      title: 'Introspect the Schema',
      description:
        'Click **Introspect** to send the built-in `__schema` query to the server. ' +
        'This is a **hidden superpower** of GraphQL: the type system is self-describing — the server publishes every type, field, argument, ' +
        'and description it supports via introspection. ' +
        'RedfireForge caches the response locally, which is why autocomplete, inline validation, and the Schema Explorer all work ' +
        'without a round-trip on every keystroke. ' +
        'Watch the **✓ Schema** badge turn green in the connection bar — that confirms the entire contract is cached. ' +
        'The lesson then opens the **Schema** tab on the right so you can browse the loaded type list immediately.',
      highlight: GQL.INTROSPECT_BTN,
      preAction: prepareGql4IntrospectReading,
      readingSync: syncGql4IntrospectSchemaTabDuringReading,
      action: async (ctx) => {
        if (!document.querySelector(GQL.SCHEMA_BADGE_OK)) {
          await ctx.click(GQL.INTROSPECT_BTN);
          await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
          await ctx.delay(1500);
        }
        await ensureSchemaExplorerOpen(ctx);
      },
      verify: GQL.SCHEMA_TYPE_LIST,
      pauseAfter: true,
    },

    // ── 4. Browse types ────────────────────────────────────────────────────────
    {
      id: 'gql4-browse',
      title: 'Browse Types',
      description:
        'The **Schema** tab is open — the type list fills with every type in the schema: **Query**, **Mutation**, **User**, **Order**, **OrderInput**. ' +
        'Click **Query** to open its detail panel. ' +
        '**Query** is the root type — all top-level operations you can call on this API are listed here. ' +
        'The field table has two columns to pay close attention to: ' +
        '**TYPE** (the return type of the field) and **ARGS** (the arguments the field requires). ' +
        '`health` returns a `String` with no arguments — the Args column shows `—`. ' +
        '`user` returns a `User!` object but **requires** an `id: ID!` argument — ' +
        'the `!` means non-nullable (you cannot omit this argument). ' +
        'Each field row has a **Try →** button — the next steps explore search and click-to-insert.',
      highlight: GQL.SCHEMA_TYPE_LIST,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_SCHEMA);
        await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
        await ctx.delay(800);
        await selectSchemaType(ctx, 'Query');
        await ctx.waitFor(GQL.SCHEMA_FIELDS_TAB, 5000);
        await ctx.delay(1000);
      },
      verify: GQL.SCHEMA_TYPE_DETAIL,
      pauseAfter: true,
    },

    // ── 5. Search and inspect User ─────────────────────────────────────────────
    {
      id: 'gql4-search',
      title: 'Search & Inspect Fields',
      description:
        'Type **`User`** in the search box — the type list immediately filters to show only matching names. ' +
        'In a real production API this is indispensable: 50+ types make scrolling impractical, but search finds any type in seconds. ' +
        'Click **User** to open its detail panel. ' +
        'The `User` type has three scalar fields: **`id`** (returns `ID` — a unique identifier scalar), ' +
        '**`name`** (returns `String`), and **`email`** (returns `String`). ' +
        'None of them take arguments — the **Args** column shows `—` for all three. ' +
        'Compare this to `Query.user`, which **does** require `id: ID!` — that argument is how the server routes to the correct user record. ' +
        'The Args column makes this distinction instantly visible without guessing.',
      highlight: GQL.SCHEMA_SEARCH,
      preAction: ensureQueryTypeSelected,
      action: async (ctx) => {
        await searchSchemaTypes(ctx, 'User');
        await ctx.delay(600);
        await selectSchemaType(ctx, 'User');
        await ctx.delay(1000);
      },
      verify: GQL.SCHEMA_TYPE_DETAIL,
      pauseAfter: true,
    },

    // ── 6. Try → insert ────────────────────────────────────────────────────────
    {
      id: 'gql4-try-insert',
      title: 'Try → Insert',
      description:
        'Click **Query** in the type list to return to the root type. ' +
        'Hover over the **`health`** field row and click the **Try →** button on the right. ' +
        'The field name is instantly inserted at the cursor position inside the Monaco editor — no typing, no copy-paste. ' +
        'A toast notification confirms **"Inserted: health"** and disappears after a moment. ' +
        'The editor now contains `query { health }`, ready to execute. ' +
        'This is especially valuable in deep, complex schemas where field names are long and typos cause silent failures. ' +
        'The **`user`** row would insert `user()` — parentheses placeholder for the required `id` argument.',
      highlight: GQL.TRY_FIELD_HEALTH,
      preAction: async (ctx) => {
        await ensureUserTypeSelected(ctx);
        await selectSchemaType(ctx, 'Query');
        await ensureEditorReadyForInsert(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GQL.TRY_FIELD_HEALTH);
        await ctx.waitFor(GQL.INSERT_FIELD_TOAST, 5000);
        await ctx.delay(1000);
        markTryInsertDone();
      },
      verify: GQL.INSERT_FIELD_TOAST,
      pauseAfter: true,
    },

    // ── 7. Execute inserted query ────────────────────────────────────────────────
    {
      id: 'gql4-exec-inserted',
      title: 'Execute the Inserted Query',
      description:
        'The editor contains `query { health }` from **Try →**. Click **▶ Execute** to run it against the test server. ' +
        'Watch the transport badge and status line — this is the same POST mechanism as GQL-1, but the field name came from the Schema Explorer instead of the keyboard.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureTryInsertDone,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(400);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── 8. Read inserted query result ────────────────────────────────────────────
    {
      id: 'gql4-read-inserted',
      title: 'Read the Schema Explorer Result',
      description:
        'The **Response** panel shows `"data": { "health": "ok" }` — the live answer from the field you inserted. ' +
        'You went from **browse → Try → → execute → read** without typing the field name manually. ' +
        'In a real project you repeat this loop for every new field you add to a complex query.',
      highlight: GQL.RESPONSE_BODY,
      preAction: async (ctx) => {
        await ensureTryInsertDone(ctx);
        if (!document.querySelector(GQL.RESPONSE_BODY)) {
          await ctx.click(GQL.RIGHT_TAB_RESPONSE);
          await ctx.delay(300);
          await ctx.click(GQL.EXECUTE_BTN);
          await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
          await ctx.delay(500);
        }
      },
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(400);
        await ctx.delay(1200);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },

    // ── 9. SDL type view ───────────────────────────────────────────────────────
    {
      id: 'gql4-sdl-view',
      title: 'SDL Type View',
      description:
        'With **Query** selected in the type browser, open the **SDL** tab in the detail panel. ' +
        'You will see the raw Schema Definition Language for that type — for example ' +
        '`type Query { health: String user(id: ID!): User order(id: ID!): Order }`. ' +
        'This is the actual contract the server owns: the same format schema versioning tools, linters, and CI diff checks compare against.',
      highlight: GQL.SCHEMA_SDL_TAB,
      preAction: ensureTryInsertDone,
      action: async (ctx) => {
        await selectSchemaType(ctx, 'Query');
        await ctx.delay(600);
        await ctx.click(GQL.SCHEMA_SDL_TAB);
        await ctx.waitFor(GQL.SCHEMA_SDL_VIEW, 5000);
        await ctx.delay(1500);
      },
      verify: GQL.SCHEMA_SDL_VIEW,
      pauseAfter: true,
    },

    // ── 10. Export full schema SDL ─────────────────────────────────────────────
    {
      id: 'gql4-export-sdl',
      title: 'Export SDL',
      description:
        'The **Export SDL** button in the Schema Explorer toolbar (download icon, labelled **SDL**) saves the **entire schema** as a `.graphql` file — not just the selected type. ' +
        'Commit this file to version control: when a field is added, renamed, or removed, `git diff` makes the change immediately visible to your team. ' +
        '**GQL-12 (Schema Diff)** shows how RedfireForge compares schema snapshots automatically and highlights breaking changes.',
      highlight: GQL.SNAPSHOT_BTN,
      preAction: async (ctx) => {
        await ensureTryInsertDone(ctx);
        await selectSchemaType(ctx, 'Query');
        if (!document.querySelector(GQL.SCHEMA_SDL_VIEW)) {
          await ctx.click(GQL.SCHEMA_SDL_TAB);
          await ctx.waitFor(GQL.SCHEMA_SDL_VIEW, 5000);
        }
      },
      action: async (ctx) => {
        await ctx.delay(800);
        await ctx.click(GQL.SNAPSHOT_BTN);
        await ctx.delay(2000);
      },
      verify: GQL.SNAPSHOT_BTN,
      pauseAfter: true,
    },
  ],
};
