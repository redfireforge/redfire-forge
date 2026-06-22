/** Lesson GQL-2: Variables & Arguments — parameterized queries and the Variables panel */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  GQL_DEMO_VAR,
  GQL_USER_QUERY,
  ensureAliceVarsFilled,
  ensureBobVarsFilled,
  fillActiveTabEndpoint,
  ensureDemoEndpoint,
  ensureExecutedWithAlice,
  ensureExecutedWithBob,
  ensureHistoryPanelWithEntries,
  ensureHistoryCompareMarked,
  ensureHistoryComparePanelOpen,
  ensureHistoryCompareModeOn,
  markHistoryCompareEntry,
  ensureIntrospected,
  ensureParamUserQuery,
  openSchemaExplorer,
  ensureResponseDataUserVisible,
  ensureVariablesPanelOpen,
  fillGqlEditor,
  fillGqlVariables,
  getDemoUserAId,
  getDemoUserBId,
  gqlVariablesLessonCleanup,
  gqlVariablesLessonSetup,
  seedDemoUsers,
} from './graphql-lesson-helpers';
import {
  ensureGqlDemoHeaderContext,
  navigateToGraphqlStudio,
} from '../env-manager-lesson-helpers';

/** Step 6 diagram — annotated query anatomy (signature, argument, selection set). */
export const GQL2_QUERY_ANATOMY_DIAGRAM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 300" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="gql2a-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
    <marker id="gql2a-arr-p" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#c084fc"/>
    </marker>
    <marker id="gql2a-arr-c" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22d3ee"/>
    </marker>
    <filter id="gql2a-shadow" x="-3%" y="-3%" width="106%" height="106%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- panel chrome -->
  <rect x="8" y="8" width="664" height="284" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.2" filter="url(#gql2a-shadow)"/>
  <text x="340" y="30" text-anchor="middle" font-size="11" font-weight="600" fill="#a8b8cc" letter-spacing="0.4">PARAMETERIZED QUERY ANATOMY</text>
  <line x1="8" y1="40" x2="672" y2="40" stroke="#3b4a60" stroke-width="1"/>

  <!-- editor surface -->
  <rect x="24" y="52" width="632" height="88" rx="6" fill="#090f1a" stroke="#3b4a60" stroke-width="1"/>
  <rect x="24" y="52" width="28" height="88" fill="#070c14" rx="6"/>
  <rect x="24" y="52" width="28" height="88" fill="#070c14"/>
  <text x="36" y="72" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">1</text>
  <text x="36" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">2</text>
  <text x="36" y="104" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#3b4a60">3</text>

  <!-- query text with highlight regions -->
  <!-- Line 1 -->
  <text x="58" y="72" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#c084fc">query</text>
  <text x="104" y="72" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9"> GetUser</text>
  <!-- signature highlight box -->
  <rect x="168" y="58" width="72" height="18" rx="3" fill="#f59e0b" fill-opacity="0.12" stroke="#f59e0b" stroke-width="1.2"/>
  <text x="176" y="72" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f59e0b">($id: ID!)</text>
  <text x="248" y="72" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9"> {</text>

  <!-- Line 2 -->
  <text x="58" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#22d3ee">  user</text>
  <!-- argument highlight box -->
  <rect x="108" y="74" width="58" height="18" rx="3" fill="#f59e0b" fill-opacity="0.08" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="116" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9">(id: </text>
  <text x="148" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f59e0b">$id</text>
  <text x="168" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9">)</text>
  <!-- selection set highlight box -->
  <rect x="182" y="74" width="118" height="18" rx="3" fill="#22d3ee" fill-opacity="0.1" stroke="#22d3ee" stroke-width="1.2"/>
  <text x="190" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9"> { </text>
  <text x="204" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#4ade80">id</text>
  <text x="222" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#4ade80"> name</text>
  <text x="262" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#4ade80"> email</text>
  <text x="310" y="88" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9"> }</text>

  <!-- Line 3 -->
  <text x="58" y="104" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9">}</text>

  <!-- dashed link: signature $id → argument $id -->
  <path d="M204,76 Q204,62 154,62 Q154,76 154,76" stroke="#f59e0b" stroke-width="1" fill="none" stroke-dasharray="3,2" opacity="0.7"/>
  <text x="178" y="58" text-anchor="middle" font-size="8" fill="#f59e0b">same $id</text>

  <!-- callout ① Signature -->
  <line x1="204" y1="76" x2="204" y2="158" stroke="#f59e0b" stroke-width="1.2" marker-end="url(#gql2a-arr)"/>
  <rect x="118" y="162" width="172" height="56" rx="6" fill="#111b28" stroke="#f59e0b" stroke-width="1.2"/>
  <circle cx="134" cy="178" r="10" fill="#f59e0b"/>
  <text x="134" y="182" text-anchor="middle" font-size="10" font-weight="700" fill="#0d1520">1</text>
  <text x="152" y="180" font-size="11" font-weight="700" fill="#f59e0b">Signature</text>
  <text x="152" y="196" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#94a3b8">($id: ID!)</text>
  <text x="152" y="210" font-size="9" fill="#a8b8cc">Declares the variable and its type</text>

  <!-- callout ② Argument -->
  <line x1="154" y1="92" x2="154" y2="158" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,2" opacity="0.8"/>
  <line x1="154" y1="158" x2="340" y2="158" stroke="#f59e0b" stroke-width="1.2" marker-end="url(#gql2a-arr)"/>
  <rect x="254" y="162" width="172" height="56" rx="6" fill="#111b28" stroke="#f59e0b" stroke-width="1"/>
  <circle cx="270" cy="178" r="10" fill="#f59e0b" fill-opacity="0.85"/>
  <text x="270" y="182" text-anchor="middle" font-size="10" font-weight="700" fill="#0d1520">2</text>
  <text x="288" y="180" font-size="11" font-weight="700" fill="#f59e0b">Argument</text>
  <text x="288" y="196" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#94a3b8">user(id: $id)</text>
  <text x="288" y="210" font-size="9" fill="#a8b8cc">Passes $id to the field — not a string</text>

  <!-- callout ③ Selection set -->
  <line x1="241" y1="92" x2="241" y2="148" stroke="#22d3ee" stroke-width="1.2"/>
  <line x1="241" y1="148" x2="490" y2="148" stroke="#22d3ee" stroke-width="1.2" marker-end="url(#gql2a-arr-c)"/>
  <rect x="390" y="162" width="172" height="56" rx="6" fill="#111b28" stroke="#22d3ee" stroke-width="1.2"/>
  <circle cx="406" cy="178" r="10" fill="#22d3ee"/>
  <text x="406" y="182" text-anchor="middle" font-size="10" font-weight="700" fill="#0d1520">3</text>
  <text x="424" y="180" font-size="11" font-weight="700" fill="#22d3ee">Selection set</text>
  <text x="424" y="196" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#94a3b8">{ id name email }</text>
  <text x="424" y="210" font-size="9" fill="#a8b8cc">Fields returned from the User type</text>

  <!-- footer note -->
  <rect x="24" y="238" width="632" height="40" rx="6" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="40" y="256" font-size="9.5" fill="#a8b8cc">Query text stays </text>
  <text x="128" y="256" font-size="9.5" font-weight="700" fill="#3b82f6">unchanged</text>
  <text x="188" y="256" font-size="9.5" fill="#a8b8cc"> between runs — only the Variables JSON </text>
  <text x="408" y="256" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#4ade80">{ "id": "…" }</text>
  <text x="40" y="270" font-size="9" fill="#22c55e">✓ injection-safe — values never interpolated into the query string</text>
</svg>`;

export const gqlVariablesLesson: DemoLesson = {
  id: 'gql-variables',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Variables & Arguments',
  description:
    'Write a parameterized GraphQL query, supply `$id` via the Variables panel, execute twice with different values, and compare how History stores each run.',
  estimatedMinutes: 9,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlVariablesLessonSetup,
  cleanup: gqlVariablesLessonCleanup,

  concept: {
    title: 'Variables & Arguments',
    body: `GraphQL **variables** let you write a query once and execute it many times with different inputs. Declare them in the operation signature — \`$id: ID!\` — and reference them in field arguments: \`user(id: $id)\`.

The **Variables** panel (bottom of the editor) holds a JSON object whose keys match your variable names (without the \`$\` prefix). Change the JSON, click **Execute** again — the query text in the editor stays **identical**; only the variables payload changes.

**Why variables matter:**
- **Reuse** — one query template, many parameter sets (Alice today, Bob tomorrow, production user IDs in CI)
- **Safety** — values travel in a separate \`variables\` field of the HTTP POST body, not string-interpolated into the query (no injection risk)
- **Typing** — \`ID!\` means a required non-null ID scalar; GraphQL validates types before the server resolves fields
- **Testability** — swap \`id\` in JSON to drive the same assertion logic across many records

This lesson creates two users — **Alice** and **Bob** — on the test server via \`createUser\` mutations, then fetches each one by changing only the \`id\` variable.`,
    keyTerms: [
      {
        term: 'Variable definition',
        definition:
          'Syntax like `$id: ID!` in the operation signature. The `$` prefix marks a variable; `ID!` is a required ID scalar type validated before execution.',
      },
      {
        term: 'Variable value',
        definition:
          'JSON in the Variables panel, e.g. `{ "id": "usr-1" }`. Keys must match variable names (without the `$`). Sent as a separate field in the HTTP request body.',
      },
      {
        term: 'Argument',
        definition:
          'A value passed to a field, e.g. `user(id: $id)`. Arguments can be literals (`"abc"`) or variables (`$id`). The argument name (`id`) is defined by the schema; the variable name (`$id`) is yours.',
      },
      {
        term: 'Required (`!`)',
        definition:
          'The exclamation mark means the value cannot be null. `ID!` requires a non-null ID; omitting the key in Variables JSON or passing `null` causes a client-side validation error before Execute is sent.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 430" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="gql2-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="gql2-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="gql2-arr-a" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
    <linearGradient id="gql2-tab-active" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d3a4d"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="gql2-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- ══ STUDIO FRAME ════════════════════════════════════════════════════════ -->
  <rect x="1" y="1" width="698" height="248" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5" filter="url(#gql2-shadow)"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">GraphQL Studio — Variables &amp; Arguments</text>

  <!-- connection bar -->
  <rect x="1" y="31" width="698" height="36" fill="#0f172a"/>
  <line x1="1" y1="67" x2="698" y2="67" stroke="#3b4a60" stroke-width="1"/>
  <rect x="10" y="38" width="280" height="22" rx="4" fill="#0a1118" stroke="#3b4a60" stroke-width="1"/>
  <text x="20" y="53" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#94a3b8">${GQL_DEMO_HTTP.replace('http://', '')}</text>
  <rect x="300" y="39" width="68" height="20" rx="10" fill="#052e16" stroke="#22c55e" stroke-width="1"/>
  <text x="334" y="53" text-anchor="middle" font-size="9" fill="#22c55e">✓ Schema</text>
  <rect x="560" y="39" width="72" height="20" rx="4" fill="#3b82f6"/>
  <text x="596" y="53" text-anchor="middle" font-size="10" font-weight="600" fill="#fff">▶ Execute</text>

  <!-- editor pane (left) — query UNCHANGED label -->
  <rect x="1" y="67" width="379" height="118" fill="#0d1520"/>
  <rect x="380" y="67" width="1" height="118" fill="#3b4a60"/>
  <rect x="8" y="72" width="64" height="18" rx="3" fill="url(#gql2-tab-active)" stroke="#3b4a60" stroke-width="1"/>
  <text x="40" y="84" text-anchor="middle" font-size="10" font-weight="600" fill="#f1f5f9">Editor</text>
  <rect x="1" y="67" width="379" height="118" fill="none" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4,3" opacity="0.35"/>
  <text x="190" y="82" text-anchor="middle" font-size="8.5" fill="#3b82f6" opacity="0.9">same query every run</text>
  <!-- query code -->
  <rect x="1" y="92" width="28" height="93" fill="#090f1a"/>
  <text x="38" y="108" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#c084fc">query GetUser</text>
  <text x="38" y="122" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#f59e0b">($id: ID!)</text>
  <text x="38" y="136" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#f1f5f9"> { user(id: </text>
  <text x="118" y="136" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#f59e0b">$id</text>
  <text x="138" y="136" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#f1f5f9">) {</text>
  <text x="50" y="150" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#22d3ee">  id name email</text>
  <text x="38" y="164" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#f1f5f9">  }</text>
  <text x="38" y="178" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#f1f5f9">}</text>

  <!-- right pane — two result columns Alice / Bob -->
  <rect x="381" y="67" width="318" height="118" fill="#0d1520"/>
  <rect x="381" y="67" width="318" height="22" fill="#0f172a"/>
  <text x="420" y="82" text-anchor="middle" font-size="10" font-weight="600" fill="#f1f5f9">Response</text>
  <!-- Alice column -->
  <rect x="388" y="94" width="145" height="82" rx="4" fill="#0a1118" stroke="#22c55e" stroke-width="1.2"/>
  <text x="460" y="108" text-anchor="middle" font-size="9" font-weight="700" fill="#22c55e">Run 1 — Alice</text>
  <text x="398" y="124" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#a8b8cc">"name": </text>
  <text x="448" y="124" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#4ade80">"Alice"</text>
  <text x="398" y="138" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#a8b8cc">"email": </text>
  <text x="448" y="138" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#94a3b8">"alice@…"</text>
  <!-- Bob column -->
  <rect x="542" y="94" width="145" height="82" rx="4" fill="#0a1118" stroke="#f59e0b" stroke-width="1.2"/>
  <text x="614" y="108" text-anchor="middle" font-size="9" font-weight="700" fill="#f59e0b">Run 2 — Bob</text>
  <text x="552" y="124" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#a8b8cc">"name": </text>
  <text x="602" y="124" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#4ade80">"Bob"</text>
  <text x="552" y="138" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#a8b8cc">"email": </text>
  <text x="602" y="138" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#94a3b8">"bob@…"</text>

  <!-- bottom panel — Variables tab active -->
  <line x1="1" y1="185" x2="698" y2="185" stroke="#3b4a60" stroke-width="1"/>
  <rect x="1" y="185" width="698" height="64" fill="#0f172a"/>
  <rect x="10" y="190" width="76" height="18" rx="3" fill="url(#gql2-tab-active)" stroke="#f59e0b" stroke-width="1.2"/>
  <rect x="10" y="206" width="76" height="2" fill="#f59e0b"/>
  <text x="48" y="203" text-anchor="middle" font-size="10" font-weight="600" fill="#f59e0b">Variables</text>
  <text x="100" y="203" font-size="10" fill="#3b4a60">Headers</text>
  <!-- vars JSON — changes between runs -->
  <rect x="10" y="214" width="678" height="28" rx="4" fill="#0a1118" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4,2"/>
  <text x="20" y="232" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#a8b8cc">{ </text>
  <text x="36" y="232" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#c084fc">"id"</text>
  <text x="58" y="232" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#a8b8cc">: </text>
  <text x="68" y="232" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#4ade80">"usr-alice"</text>
  <text x="158" y="232" font-family="'SF Mono','Fira Code',monospace" font-size="10" fill="#a8b8cc"> }</text>
  <text x="520" y="232" font-size="9" fill="#f59e0b">→ change to "usr-bob" →</text>
  <text x="648" y="232" font-size="9" fill="#4ade80">"Bob"</text>

  <!-- ══ FLOW LEGEND (y 258–430) ═══════════════════════════════════════════ -->
  <text x="350" y="275" text-anchor="middle" font-size="10" fill="#a8b8cc" letter-spacing="0.5">QUERY UNCHANGED — VARIABLES DRIVE THE RESULT</text>

  <!-- Step 1: Query -->
  <rect x="20" y="288" width="120" height="52" rx="6" fill="#111b28" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="80" y="306" text-anchor="middle" font-size="9" font-weight="700" fill="#3b82f6">① Query</text>
  <text x="80" y="320" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="8" fill="#94a3b8">GetUser($id: ID!)</text>
  <text x="80" y="332" text-anchor="middle" font-size="8" fill="#a8b8cc">never edited</text>
  <line x1="140" y1="314" x2="168" y2="314" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql2-arr)"/>

  <!-- Step 2: Variables -->
  <rect x="168" y="288" width="120" height="52" rx="6" fill="#111b28" stroke="#f59e0b" stroke-width="1.2"/>
  <text x="228" y="306" text-anchor="middle" font-size="9" font-weight="700" fill="#f59e0b">② Variables</text>
  <text x="228" y="320" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="8" fill="#94a3b8">{ "id": "…" }</text>
  <text x="228" y="332" text-anchor="middle" font-size="8" fill="#a8b8cc">JSON panel</text>
  <line x1="288" y1="314" x2="316" y2="314" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql2-arr)"/>

  <!-- Step 3: Execute -->
  <rect x="316" y="288" width="100" height="52" rx="6" fill="#111b28" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="366" y="306" text-anchor="middle" font-size="9" font-weight="700" fill="#3b82f6">③ Execute</text>
  <text x="366" y="320" text-anchor="middle" font-size="8" fill="#a8b8cc">HTTP POST</text>
  <text x="366" y="332" text-anchor="middle" font-size="8" fill="#94a3b8">query + variables</text>
  <line x1="416" y1="314" x2="444" y2="314" stroke="#22c55e" stroke-width="1.5" marker-end="url(#gql2-arr-g)"/>

  <!-- Step 4: Compare -->
  <rect x="444" y="288" width="120" height="52" rx="6" fill="#111b28" stroke="#22c55e" stroke-width="1.2"/>
  <text x="504" y="306" text-anchor="middle" font-size="9" font-weight="700" fill="#22c55e">④ Compare</text>
  <text x="504" y="320" text-anchor="middle" font-size="8" fill="#4ade80">Alice → Bob</text>
  <text x="504" y="332" text-anchor="middle" font-size="8" fill="#a8b8cc">same fields, diff data</text>

  <!-- Safety callout -->
  <rect x="580" y="288" width="110" height="52" rx="6" fill="#111b28" stroke="#3b4a60" stroke-width="1"/>
  <text x="635" y="306" text-anchor="middle" font-size="8.5" font-weight="700" fill="#a8b8cc">NOT string</text>
  <text x="635" y="318" text-anchor="middle" font-size="8.5" font-weight="700" fill="#a8b8cc">interpolation</text>
  <text x="635" y="332" text-anchor="middle" font-size="8" fill="#22c55e">✓ injection-safe</text>

  <!-- dashed loop: change vars only -->
  <path d="M228,340 Q228,365 366,365 Q504,365 504,340" stroke="#f59e0b" stroke-width="1.2" fill="none" stroke-dasharray="4,3" marker-end="url(#gql2-arr-a)"/>
  <text x="366" y="378" text-anchor="middle" font-size="8.5" fill="#f59e0b">change Variables only — re-Execute</text>

  <text x="350" y="408" text-anchor="middle" font-size="9" fill="#3b4a60">Protocols → GraphQL → Variables &amp; Arguments</text>
</svg>`,
  },

  steps: [
    // ── 1. Orientation ───────────────────────────────────────────
    {
      id: 'gql2-intro',
      title: 'The Variables Panel',
      description:
        'Below the query editor are three tabs: **Variables**, **Headers**, and **Files**. ' +
        'The **Variables** tab holds a JSON object — one key per `$variable` declared in your query signature. ' +
        'Values are sent in a separate field of the HTTP POST body, **not** interpolated into the query string — this is what makes GraphQL variables injection-safe. ' +
        'In this lesson you will write one parameterized query and execute it twice with different `id` values.',
      highlight: GQL.BOTTOM_TAB_VARS,
      pauseAfter: true,
    },

    // ── 2. Endpoint ──────────────────────────────────────────────
    {
      id: 'gql2-endpoint',
      title: 'Set the Endpoint',
      description:
        `Type \`${GQL_DEMO_VAR}\` into the endpoint field — the same Environment Manager variable from **Lesson 1** that resolves to \`${GQL_DEMO_HTTP}\`. ` +
        'Continue from **Lesson 1** — the next step verifies the endpoint variable resolves correctly before introspection. ' +
        'This server exposes `user(id: ID!)` for queries and `createUser` for mutations — both needed in this lesson.',
      highlight: GQL.ENDPOINT_INPUT,
      preAction: async (ctx) => {
        await ensureGqlDemoHeaderContext(ctx);
        await navigateToGraphqlStudio(ctx);
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
      },
      action: async (ctx) => {
        await fillActiveTabEndpoint(ctx, GQL_DEMO_VAR);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 3. Resolved endpoint preview ─────────────────────────────
    {
      id: 'gql2-endpoint-resolved',
      title: 'Confirm the Resolved URL',
      description:
        `Watch **↳ Resolved:** appear below the endpoint field — RedfireForge resolves \`${GQL_DEMO_VAR}\` to \`${GQL_DEMO_HTTP}\` with a **✓** checkmark. ` +
        'This confirms the variable, environment, and service from **Lesson 1** are still wired before you introspect.',
      highlight: GQL.ENDPOINT_PREVIEW,
      preAction: ensureDemoEndpoint,
      action: async (ctx) => {
        await ctx.waitFor(GQL.ENDPOINT_PREVIEW, 5000);
        await ctx.delay(1500);
      },
      verify: GQL.ENDPOINT_PREVIEW,
      pauseAfter: true,
    },

    // ── 4. Introspect ────────────────────────────────────────────
    {
      id: 'gql2-introspect',
      title: 'Introspect the Schema',
      description:
        'Click **Introspect** to download the server schema. Autocomplete needs to know that `user` accepts an `id: ID!` argument and returns a `User` type with `id`, `name`, and `email` fields. ' +
        'Watch for the green **Schema loaded** badge in the connection bar — without it, the editor cannot validate your `$id: ID!` variable definition.',
      highlight: GQL.INTROSPECT_BTN,
      preAction: ensureDemoEndpoint,
      action: async (ctx) => {
        await ctx.click(GQL.INTROSPECT_BTN);
        await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
        await ctx.delay(1500);
      },
      verify: GQL.SCHEMA_BADGE_OK,
      pauseAfter: true,
    },

    // ── 5. Schema tab ────────────────────────────────────────────
    {
      id: 'gql2-schema',
      title: 'Browse the Query Type',
      description:
        'Open the **Schema** tab on the right panel. Select **Query** in the type list and inspect `user(id: ID!)` — this is the field you will parameterize with `$id` in the next steps. ' +
        'The type detail panel shows the return type **User** with `id`, `name`, and `email` fields.',
      highlight: GQL.RIGHT_TAB_SCHEMA,
      preAction: ensureIntrospected,
      action: async (ctx) => {
        await openSchemaExplorer(ctx);
        await ctx.waitFor(GQL.SCHEMA_TYPE_QUERY, 10000);
        await ctx.click(GQL.SCHEMA_TYPE_QUERY);
        await ctx.delay(800);
      },
      verify: GQL.SCHEMA_TYPE_QUERY,
      pauseAfter: true,
    },

    // ── 6. Write parameterized query ─────────────────────────────
    {
      id: 'gql2-write-query',
      title: 'Write a Parameterized Query',
      description:
        'In the editor, write a **named query** with a variable definition and an argument reference. ' +
        'The diagram shows how three parts work together — `$id` is **declared once** in the signature and **referenced** in the field argument, never stitched into the query string.\n\n' +
        '```graphql\nquery GetUser($id: ID!) {\n  user(id: $id) { id name email }\n}\n```\n\n' +
        'Behind the scenes the lesson also creates **Alice** and **Bob** on the server via `createUser` mutations so we have real IDs to query.',
      diagram: GQL2_QUERY_ANATOMY_DIAGRAM,
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

    // ── 5. Open variables panel ──────────────────────────────────
    {
      id: 'gql2-open-vars',
      title: 'Open the Variables Panel',
      description:
        'Click the **Variables** tab at the bottom of the editor area. The JSON editor starts empty `{}` — you will fill in the `id` key that matches your `$id` variable. ' +
        'Keys in this JSON **must not** include the `$` prefix: the variable `$id` maps to the JSON key `"id"`. ' +
        'Monaco validates JSON syntax here — a trailing comma or missing quote will be highlighted before you execute.',
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

    // ── 6. Set Alice variables ───────────────────────────────────
    {
      id: 'gql2-set-alice-vars',
      title: 'Set Variables for Alice',
      description:
        'Fill the Variables JSON with Alice\'s user ID: `{ "id": "<alice-id>" }`. ' +
        'The lesson seeded **Alice** on the server during the previous step — her ID is a real UUID returned by `createUser`. ' +
        'Watch the JSON appear in the Variables panel; the query in the editor above stays completely unchanged.',
      highlight: GQL.VARS_PANEL,
      preAction: async (ctx) => {
        await ensureParamUserQuery(ctx);
        await ensureVariablesPanelOpen(ctx);
      },
      action: async (ctx) => {
        await seedDemoUsers();
        const aliceJson = JSON.stringify({ id: getDemoUserAId() }, null, 2);
        await fillGqlVariables(ctx, aliceJson);
        await ctx.delay(500);
      },
      verify: GQL.VARS_PANEL,
      pauseAfter: true,
    },

    // ── 7. Execute for Alice ─────────────────────────────────────
    {
      id: 'gql2-exec-alice',
      title: 'Execute for Alice',
      description:
        'Click **▶ Execute**. RedfireForge sends an HTTP POST with two separate JSON fields: `query` (your GetUser operation) and `variables` (the `{ "id": "…" }` object). ' +
        'The server resolves `user(id: $id)` using Alice\'s ID. The response will appear in the panel on the right — the next step reads it.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureAliceVarsFilled,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── 8. Read Alice response ───────────────────────────────────
    {
      id: 'gql2-read-alice',
      title: 'Read Alice\'s Response',
      description:
        'The **data.user** summary card shows `"name": "Alice"` and `"email": "alice@demo.local"`. ' +
        'Notice the response contains only the three fields you selected — not the entire User object.',
      highlight: GQL.RESPONSE_DATA_USER,
      preAction: ensureExecutedWithAlice,
      action: async (ctx) => {
        await ensureResponseDataUserVisible(ctx);
        await ctx.delay(1000);
      },
      verify: GQL.RESPONSE_DATA_USER,
      pauseAfter: true,
    },

    // ── 9. Metadata tab — variables in HTTP POST body ────────────
    {
      id: 'gql2-vars-metadata',
      title: 'Variables Travel in the POST Body',
      description:
        'Click the **Metadata** tab in the Response panel. The raw HTTP request shows **POST** with a JSON body containing two top-level fields: `query` (your GetUser operation text) and **`variables`** (the `{ "id": "…" }` object from the Variables panel). ' +
        'This is why variables are injection-safe — values never get string-interpolated into the query string. Change only the Variables JSON and Execute again; the `query` field in this POST body stays byte-for-byte identical.',
      highlight: GQL.RV_TAB_METADATA,
      preAction: ensureExecutedWithAlice,
      action: async (ctx) => {
        await ctx.click(GQL.RV_TAB_METADATA);
        await ctx.waitFor(GQL.RV_METADATA, 5000);
        await ctx.delay(1200);
      },
      verify: GQL.RV_METADATA,
      pauseAfter: true,
    },

    // ── 10. Set Bob variables ────────────────────────────────────
    {
      id: 'gql2-set-bob-vars',
      title: 'Change Variables for Bob',
      description:
        'In the **Variables panel**, replace Alice\'s ID with **Bob**\'s ID — change only the `"id"` value in the JSON editor, leave the query untouched. ' +
        'This is the core power of variables: the same `GetUser` operation drives both lookups. ' +
        'In a test suite you would loop over an array of IDs with this exact pattern.',
      highlight: GQL.VARS_PANEL,
      preAction: ensureExecutedWithAlice,
      action: async (ctx) => {
        await seedDemoUsers();
        await ctx.click(GQL.BOTTOM_TAB_VARS);
        await ctx.waitFor(GQL.VARS_PANEL, 5000);
        await ctx.delay(400);
        const bobJson = JSON.stringify({ id: getDemoUserBId() }, null, 2);
        await fillGqlVariables(ctx, bobJson);
        await ctx.delay(500);
      },
      verify: GQL.VARS_PANEL,
      pauseAfter: true,
    },

    // ── 11. Execute for Bob ──────────────────────────────────────
    {
      id: 'gql2-exec-bob',
      title: 'Execute for Bob',
      description:
        'Click **▶ Execute** again. Same query text, same endpoint, different **`variables`** payload — the server now resolves Bob\'s record. ' +
        'The response will appear in the panel on the right — the next step reads it.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureBobVarsFilled,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── 12. Read Bob response ────────────────────────────────────
    {
      id: 'gql2-read-bob',
      title: 'Read Bob\'s Response',
      description:
        'The **data.user** summary card now shows `"name": "Bob"` and `"email": "bob@demo.local"`. ' +
        'Same three selected fields as Alice — only the variable value changed.',
      highlight: GQL.RESPONSE_DATA_USER,
      preAction: ensureExecutedWithBob,
      action: async (ctx) => {
        await ensureResponseDataUserVisible(ctx);
        await ctx.delay(1000);
      },
      verify: GQL.RESPONSE_DATA_USER,
      pauseAfter: true,
    },

    // ── 13. Open History ─────────────────────────────────────────
    {
      id: 'gql2-history',
      title: 'History Remembers Every Run',
      description:
        'Every execution is **auto-saved** to History — query, variables JSON, and response. ' +
        'Click the **History** icon in the left activity bar to open the History sidebar. ' +
        'You should see **GetUser** entries from your Alice and Bob studio executions — each row stores the query, variables JSON, and response from **Execute**.',
      highlight: GQL.ACTIVITY_HISTORY,
      preAction: ensureHistoryPanelWithEntries,
      action: async (ctx) => {
        const active = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)?.classList.contains('gql-activity-tab--active');
        if (!active) {
          await ctx.click(GQL.ACTIVITY_HISTORY);
          await ctx.waitFor(GQL.HISTORY_PANEL, 5000);
        }
        await ctx.waitFor(GQL.HISTORY_ENTRY, 5000);
        await ctx.delay(800);
      },
      verify: GQL.HISTORY_ENTRY,
      pauseAfter: true,
    },

    // ── 14. Search History ───────────────────────────────────────
    {
      id: 'gql2-history-search',
      title: 'Search History',
      description:
        'Use the **search bar** at the top of the **History** sidebar to filter by operation name, query text, **variables JSON**, or **response body**. ' +
        'Type **`GetUser`** to narrow the list to your parameterized lookups.',
      highlight: GQL.HISTORY_SEARCH,
      preAction: ensureHistoryPanelWithEntries,
      action: async (ctx) => {
        await ctx.click(GQL.HISTORY_SEARCH);
        await ctx.delay(400);
        await ctx.fill(GQL.HISTORY_SEARCH, 'GetUser');
        await ctx.delay(800);
      },
      verify: GQL.HISTORY_SEARCH,
      pauseAfter: true,
    },

    // ── 15. Mark runs for comparison ───────────────────────────────
    {
      id: 'gql2-history-compare-mark',
      title: 'Mark Runs to Compare',
      description:
        'Click **Compare** in the History header to enter compare mode. Each row gets a **+** button — click it to assign **slot A** or **slot B**. ' +
        'Search **`Alice`** and mark her GetUser run as **A**, then search **`Bob`** and mark his run as **B**. The compare bar shows both slots when filled.',
      highlight: GQL.HISTORY_COMPARE_TOGGLE,
      preAction: ensureHistoryPanelWithEntries,
      action: async (ctx) => {
        await ensureHistoryCompareModeOn(ctx);
        await markHistoryCompareEntry(ctx, 'Alice', 'A');
        await markHistoryCompareEntry(ctx, 'Bob', 'B');
      },
      verify: GQL.HISTORY_COMPARE_BTN_ENABLED,
      pauseAfter: true,
    },

    // ── 16. View side-by-side comparison ─────────────────────────
    {
      id: 'gql2-history-compare',
      title: 'Compare Alice vs Bob',
      description:
        'Click **View comparison** in the History compare bar. The comparison opens **inside the History sidebar** — **Variables** and **Response data** tables side by side, with differing fields (`id`, `user.name`, `user.email`) highlighted. ' +
        'Same query text, different variable values, different users returned.',
      highlight: GQL.HISTORY_COMPARE_BTN,
      preAction: ensureHistoryCompareMarked,
      action: async (ctx) => {
        if (!document.querySelector(GQL.HISTORY_COMPARE_PANEL)) {
          await ensureHistoryComparePanelOpen(ctx);
        }
        await ctx.delay(1000);
      },
      verify: GQL.HISTORY_COMPARE_TABLE,
      pauseAfter: true,
    },
  ],
};
