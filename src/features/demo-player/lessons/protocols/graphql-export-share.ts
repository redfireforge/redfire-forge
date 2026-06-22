/** Lesson GQL-10: Export & Share Queries */
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
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlExportShareLessonSetup,
  cleanup: gqlExportShareLessonCleanup,

  concept: {
    title: 'Export & Share — Two Surfaces, Two Audiences',
    body: `GraphQL Studio deliberately does **not** ship a heavyweight code-generation panel (TypeScript clients, React hooks, Python gql, etc.). That complexity belongs in dedicated tools like GraphQL Code Generator or Amplify. Instead, Studio exposes two focused, practical export surfaces.

**Surface 1 — Builder SDL Preview (for developers editing queries):**
The Query Builder's center panel shows a **live SDL preview** that updates as you check fields. This is not a static view — every checkbox change, argument fill, alias, or directive is immediately reflected in the generated SDL. Three actions are available from this surface:
- **Copy** — puts the generated query on your clipboard (paste into a \`.graphql\` file, a README, a Postman collection, or your frontend code)
- **Edit in Editor** — one-way transfer: the SDL lands in Monaco and Builder mode switches off, letting you hand-edit the query before executing

**Surface 2 — History cURL export (for shell/CI/team sharing):**
After executing a query, right-clicking a History entry reveals **Copy as cURL**. This produces a complete \`curl -X POST\` command with:
- The endpoint URL
- \`Content-Type: application/json\` header
- The query and any variable values already serialized into JSON

**Why cURL matters:** cURL commands are the universal API sharing format. They work in any terminal, can be pasted into CI/CD scripts, reproduce issues exactly in bug reports, and can be imported into Postman or Insomnia with a single click. When you share a cURL command, you share the complete reproducible request — not just a description of it.

**Why these two surfaces and not more?** The Builder SDL path is for the development workflow — you build, refine, copy, and paste the query into your codebase. The History cURL path is for the operational workflow — you run it, get a result, and share the exact HTTP request that produced it. Together they cover the two most common export needs without feature bloat.`,
    keyTerms: [
      {
        term: 'SDL preview',
        definition:
          'Live-generated query text in the Builder center panel (`gql-qb-code`). Updates with every checkbox change, argument fill, alias, or directive — the authoritative visual export of the query you are constructing.',
      },
      {
        term: 'Copy (Builder)',
        definition:
          'Toolbar button (`gql-qb-copy`) that copies the current SDL preview to your clipboard. Use to paste into `.graphql` files, READMEs, Postman, or frontend code. Brief "Copied ✓" confirmation appears.',
      },
      {
        term: 'Edit in Editor',
        definition:
          'One-way transfer (`gql-qb-edit`): the Builder SDL lands in Monaco and Builder mode turns off. From that point, you hand-edit the query. There is no back-sync from the editor to the Builder.',
      },
      {
        term: 'Copy as cURL',
        definition:
          'History context-menu action that produces a complete `curl -X POST` command — endpoint URL, Content-Type header, and JSON body with query + variables already serialized. Universal sharing format.',
      },
      {
        term: 'One-way sync',
        definition:
          'Builder → Editor transfer is intentionally one-way. The Builder is a selection model (checkboxes, args, aliases); once you have free-form text in the editor, there is no reliable way to reconstruct the Builder\'s checkbox state from arbitrary SDL.',
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
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Export &amp; Share Queries</text>

  <!-- ── Connection bar ───────────────────────────────────────────────────── -->
  <rect x="0" y="32" width="700" height="26" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="8" y="37" width="230" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="16" y="48" fill="var(--text-muted)" font-size="8.5" font-family="monospace">localhost:4010/graphql</text>
  <rect x="250" y="37" width="60" height="16" rx="8" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="280" y="48" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <!-- Mode buttons -->
  <rect x="380" y="37" width="52" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="406" y="48" text-anchor="middle" font-size="8" fill="var(--text-muted)">✏ Editor</text>
  <rect x="436" y="37" width="56" height="16" rx="3" fill="var(--primary)"/>
  <text x="464" y="48" text-anchor="middle" font-size="8" fill="white" font-weight="600">⊞ Builder</text>

  <!-- ── Left activity bar ─────────────────────────────────────────────────── -->
  <rect x="0" y="58" width="36" height="372" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="3" y="68" width="30" height="30" rx="4" fill="var(--bg)"/>
  <text x="18" y="86" text-anchor="middle" font-size="12" opacity="0.3">📋</text>
  <rect x="3" y="104" width="30" height="30" rx="4" fill="var(--bg)"/>
  <text x="18" y="122" text-anchor="middle" font-size="12" opacity="0.3">📁</text>

  <!-- ── Builder: Field Tree panel (left, ~210px) ───────────────────────────── -->
  <rect x="36" y="58" width="210" height="372" fill="var(--bg)"/>
  <line x1="246" y1="58" x2="246" y2="430" stroke="var(--border)" stroke-width="1"/>

  <!-- Field tree header -->
  <rect x="36" y="58" width="210" height="22" fill="var(--surface)"/>
  <line x1="36" y1="80" x2="246" y2="80" stroke="var(--border)" stroke-width="1"/>
  <text x="46" y="73" font-size="8.5" font-weight="600" fill="var(--text)">Field Tree</text>
  <rect x="200" y="62" width="38" height="14" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="219" y="72" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">▸ Query</text>

  <!-- Field: health (checked) -->
  <rect x="36" y="80" width="210" height="22" fill="color-mix(in srgb, #28c840 6%, var(--bg))"/>
  <rect x="48" y="84" width="14" height="14" rx="3" fill="#28c840"/>
  <text x="55" y="94" text-anchor="middle" font-size="9" fill="white" font-weight="700">✓</text>
  <text x="70" y="95" font-size="9" fill="var(--text)" font-weight="500">health</text>
  <text x="222" y="95" text-anchor="end" font-size="7.5" fill="var(--text-muted)">String!</text>

  <!-- Field: user (expanded, partial) -->
  <rect x="36" y="102" width="210" height="22" fill="color-mix(in srgb, var(--primary) 5%, var(--bg))"/>
  <line x1="36" y1="102" x2="246" y2="102" stroke="var(--border)" stroke-width="0.5"/>
  <text x="46" y="116" font-size="9" fill="var(--primary)">▾</text>
  <rect x="56" y="106" width="14" height="14" rx="3" fill="color-mix(in srgb, var(--primary) 40%, var(--surface))" stroke="var(--primary)" stroke-width="1"/>
  <text x="63" y="116" text-anchor="middle" font-size="7" fill="var(--primary)" font-weight="700">–</text>
  <text x="78" y="116" font-size="9" fill="var(--text)" font-weight="500">user</text>
  <text x="222" y="116" text-anchor="end" font-size="7.5" fill="var(--text-muted)">User</text>

  <!-- user argument: id -->
  <rect x="36" y="124" width="210" height="22" fill="var(--bg)"/>
  <line x1="36" y1="124" x2="246" y2="124" stroke="var(--border)" stroke-width="0.3"/>
  <text x="72" y="138" font-size="8" fill="var(--text-muted)">id:</text>
  <rect x="86" y="128" width="80" height="14" rx="3" fill="var(--surface)" stroke="var(--primary)" stroke-width="1"/>
  <text x="92" y="138" fill="var(--text)" font-size="8" font-family="monospace">usr-1</text>
  <!-- arg annotation -->
  <rect x="172" y="128" width="62" height="14" rx="3" fill="color-mix(in srgb, #f59e0b 10%, var(--surface))" stroke="#f59e0b" stroke-width="0.5"/>
  <text x="203" y="138" text-anchor="middle" font-size="6.5" fill="#f59e0b">required arg</text>

  <!-- user sub-fields: id, name -->
  <rect x="36" y="146" width="210" height="20" fill="var(--bg)"/>
  <line x1="36" y1="146" x2="246" y2="146" stroke="var(--border)" stroke-width="0.3"/>
  <rect x="80" y="150" width="14" height="14" rx="3" fill="#28c840"/>
  <text x="87" y="160" text-anchor="middle" font-size="9" fill="white" font-weight="700">✓</text>
  <text x="102" y="160" font-size="9" fill="var(--text)">id</text>
  <rect x="36" y="166" width="210" height="20" fill="var(--bg)"/>
  <line x1="36" y1="166" x2="246" y2="166" stroke="var(--border)" stroke-width="0.3"/>
  <rect x="80" y="170" width="14" height="14" rx="3" fill="#28c840"/>
  <text x="87" y="180" text-anchor="middle" font-size="9" fill="white" font-weight="700">✓</text>
  <text x="102" y="180" font-size="9" fill="var(--text)">name</text>

  <!-- Other fields (unchecked) -->
  <rect x="36" y="186" width="210" height="20" fill="var(--bg)"/>
  <line x1="36" y1="186" x2="246" y2="186" stroke="var(--border)" stroke-width="0.3"/>
  <rect x="48" y="190" width="14" height="14" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="70" y="200" font-size="9" fill="var(--text-muted)" opacity="0.5">posts</text>

  <!-- ── Builder: SDL Preview panel (center, ~228px) ────────────────────────── -->
  <rect x="248" y="58" width="228" height="372" fill="var(--bg)"/>
  <line x1="476" y1="58" x2="476" y2="430" stroke="var(--border)" stroke-width="1"/>

  <!-- SDL Preview header + toolbar -->
  <rect x="248" y="58" width="228" height="22" fill="var(--surface)"/>
  <line x1="248" y1="80" x2="476" y2="80" stroke="var(--border)" stroke-width="1"/>
  <text x="258" y="73" font-size="8.5" font-weight="600" fill="var(--text)">SDL Preview</text>
  <!-- Copy button (highlighted) -->
  <rect x="348" y="62" width="50" height="14" rx="4" fill="color-mix(in srgb, var(--primary) 15%, var(--surface))" stroke="var(--primary)" stroke-width="1"/>
  <text x="373" y="72" text-anchor="middle" font-size="7.5" fill="var(--primary)" font-weight="600">⎘ Copy</text>
  <!-- Edit in Editor button -->
  <rect x="402" y="62" width="66" height="14" rx="4" fill="var(--primary)"/>
  <text x="435" y="72" text-anchor="middle" font-size="7.5" fill="white" font-weight="600">✏ Edit in Editor</text>

  <!-- SDL code content -->
  <rect x="248" y="80" width="228" height="200" fill="var(--bg)"/>
  <!-- Line numbers -->
  <text x="260" y="100" fill="var(--text-muted)" font-size="7.5" opacity="0.5" font-family="monospace">1</text>
  <text x="260" y="115" fill="var(--text-muted)" font-size="7.5" opacity="0.5" font-family="monospace">2</text>
  <text x="260" y="130" fill="var(--text-muted)" font-size="7.5" opacity="0.5" font-family="monospace">3</text>
  <text x="260" y="145" fill="var(--text-muted)" font-size="7.5" opacity="0.5" font-family="monospace">4</text>
  <text x="260" y="160" fill="var(--text-muted)" font-size="7.5" opacity="0.5" font-family="monospace">5</text>
  <text x="260" y="175" fill="var(--text-muted)" font-size="7.5" opacity="0.5" font-family="monospace">6</text>
  <text x="260" y="190" fill="var(--text-muted)" font-size="7.5" opacity="0.5" font-family="monospace">7</text>
  <text x="260" y="205" fill="var(--text-muted)" font-size="7.5" opacity="0.5" font-family="monospace">8</text>
  <!-- Query code -->
  <text x="278" y="100" fill="#a78bfa" font-size="9" font-family="monospace">query</text>
  <text x="312" y="100" fill="var(--text)" font-size="9" font-family="monospace"> ExportDemo {</text>
  <text x="278" y="115" fill="var(--text-muted)" font-size="9" font-family="monospace">  health</text>
  <text x="278" y="130" fill="#60a5fa" font-size="9" font-family="monospace">  user</text>
  <text x="312" y="130" fill="var(--text)" font-size="9" font-family="monospace">(id: </text>
  <text x="340" y="130" fill="#f59e0b" font-size="9" font-family="monospace">"usr-1"</text>
  <text x="377" y="130" fill="var(--text)" font-size="9" font-family="monospace">) {</text>
  <text x="278" y="145" fill="var(--text-muted)" font-size="9" font-family="monospace">    id</text>
  <text x="278" y="160" fill="var(--text-muted)" font-size="9" font-family="monospace">    name</text>
  <text x="278" y="175" fill="var(--text)" font-size="9" font-family="monospace">  }</text>
  <text x="278" y="190" fill="var(--text)" font-size="9" font-family="monospace">}</text>

  <!-- Live update badge -->
  <rect x="258" y="206" width="80" height="14" rx="3" fill="color-mix(in srgb, #28c840 10%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="298" y="216" text-anchor="middle" font-size="7" fill="#28c840">↻ live preview</text>

  <!-- Copy confirmation badge -->
  <rect x="348" y="225" width="54" height="16" rx="4" fill="#28c840"/>
  <text x="375" y="237" text-anchor="middle" font-size="8" fill="white" font-weight="700">Copied ✓</text>
  <line x1="373" y1="76" x2="375" y2="225" stroke="#28c840" stroke-width="0.8" stroke-dasharray="3 3"/>

  <!-- ── History panel with context menu (right, ~224px) ────────────────────── -->
  <rect x="478" y="58" width="222" height="372" fill="var(--bg)"/>

  <!-- History panel header -->
  <rect x="478" y="58" width="222" height="22" fill="var(--surface)"/>
  <line x1="478" y1="80" x2="700" y2="80" stroke="var(--border)" stroke-width="1"/>
  <text x="488" y="73" font-size="8.5" font-weight="600" fill="var(--text)">History</text>
  <text x="688" y="73" text-anchor="end" font-size="7.5" fill="var(--text-muted)">Clear ✕</text>

  <!-- History entry (right-clicked → active) -->
  <rect x="478" y="80" width="222" height="36" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))" stroke="var(--primary)" stroke-width="0.5"/>
  <text x="488" y="96" font-size="8" font-weight="600" fill="var(--primary)">query ExportDemo { ... }</text>
  <text x="488" y="109" font-size="7" fill="var(--text-muted)">200 OK · 18ms · 3:31 PM</text>
  <rect x="668" y="84" width="28" height="14" rx="3" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.5"/>
  <text x="682" y="95" text-anchor="middle" font-size="7" fill="#28c840">✓ 200</text>

  <!-- Context menu (floating) -->
  <rect x="488" y="120" width="160" height="112" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.4))"/>
  <!-- Menu items -->
  <rect x="488" y="120" width="160" height="24" rx="5" fill="var(--surface)"/>
  <rect x="488" y="136" width="160" height="8" fill="var(--surface)"/>
  <text x="504" y="136" font-size="8.5" fill="var(--text)">Preview</text>
  <line x1="488" y1="144" x2="648" y2="144" stroke="var(--border)" stroke-width="0.5"/>
  <text x="504" y="156" font-size="8.5" fill="var(--text)">Load into Editor</text>
  <line x1="488" y1="162" x2="648" y2="162" stroke="var(--border)" stroke-width="0.5"/>
  <text x="504" y="174" font-size="8.5" fill="var(--text)">Run</text>
  <line x1="488" y1="180" x2="648" y2="180" stroke="var(--border)" stroke-width="0.5"/>
  <!-- Highlighted: Copy as cURL -->
  <rect x="490" y="183" width="156" height="22" rx="3" fill="color-mix(in srgb, var(--primary) 15%, var(--surface))"/>
  <text x="504" y="198" font-size="8.5" fill="var(--primary)" font-weight="700">⎘ Copy as cURL</text>
  <rect x="616" y="186" width="26" height="14" rx="3" fill="var(--primary)"/>
  <text x="629" y="196" text-anchor="middle" font-size="7.5" fill="white" font-weight="600">⌘C</text>
  <line x1="488" y1="205" x2="648" y2="205" stroke="var(--border)" stroke-width="0.5"/>
  <text x="504" y="217" font-size="8.5" fill="var(--text)">Delete</text>

  <!-- cURL output preview -->
  <rect x="488" y="244" width="200" height="70" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="496" y="258" font-size="7" fill="var(--text-muted)" font-family="monospace">curl -X POST \\</text>
  <text x="496" y="270" font-size="7" fill="var(--text-muted)" font-family="monospace">  localhost:4010/graphql \\</text>
  <text x="496" y="282" font-size="7" fill="var(--text-muted)" font-family="monospace">  -H 'Content-Type: ...' \\</text>
  <text x="496" y="294" font-size="7" fill="#28c840" font-family="monospace">  -d '&#123;"query":"..."&#125;'</text>
  <!-- cURL badge -->
  <rect x="488" y="318" width="110" height="16" rx="3" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))" stroke="var(--primary)" stroke-width="0.8"/>
  <text x="543" y="329" text-anchor="middle" font-size="7" fill="var(--primary)">→ clipboard (paste anywhere)</text>

  <!-- ── Bottom legend ─────────────────────────────────────────────────────── -->
  <line x1="0" y1="390" x2="700" y2="390" stroke="var(--border)" stroke-width="1"/>
  <rect x="0" y="390" width="700" height="40" fill="var(--bg)"/>
  <defs>
    <marker id="gql10-arr" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
      <path d="M1,1 L4,2.5 L1,4 Z" fill="var(--primary)"/>
    </marker>
  </defs>
  <text x="46" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Builder</text>
  <text x="46" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">field tree</text>
  <line x1="80" y1="408" x2="108" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql10-arr)"/>
  <text x="138" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">SDL Preview</text>
  <text x="138" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">live SDL</text>
  <line x1="175" y1="408" x2="205" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql10-arr)"/>
  <text x="230" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">⎘ Copy</text>
  <text x="230" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">clipboard</text>
  <text x="262" y="412" fill="var(--text-muted)" font-size="8">or</text>
  <line x1="272" y1="408" x2="300" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql10-arr)"/>
  <text x="332" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Edit in Editor</text>
  <text x="332" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">Monaco (1-way)</text>
  <line x1="386" y1="408" x2="416" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql10-arr)"/>
  <text x="448" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Execute</text>
  <text x="448" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">→ History</text>
  <line x1="480" y1="408" x2="510" y2="408" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql10-arr)"/>
  <text x="560" y="406" text-anchor="middle" font-size="8" font-weight="600" fill="var(--primary)">⎘ Copy as cURL</text>
  <text x="560" y="418" text-anchor="middle" font-size="7" fill="var(--text-muted)">terminal / CI / team</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Build in Query Builder ─────────────────────────────────────
    {
      id: 'gql9-builder',
      title: 'Build a Query in Builder Mode',
      description:
        `Switch to **Builder** mode after introspecting \`${GQL_DEMO_HTTP}\`. Check **health** and expand **user** — fill the required \`id\` argument with a value. Both fields appear in the SDL preview.\n\n` +
        '**Why start in Builder mode?** Builder mode is schema-guided: every field you can legally select is shown in a tree derived from the introspection schema. ' +
        'You cannot accidentally type an invalid field name or forget a required argument — the UI surfaces both problems immediately. ' +
        'This is especially valuable when exploring an unfamiliar API: you can discover available fields by browsing the tree rather than reading schema documentation.',
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

    // ── Step 2: Read the live SDL preview ──────────────────────────────────
    {
      id: 'gql9-preview',
      title: 'Read the Live SDL Preview',
      description:
        'Watch the center **SDL preview** (`gql-qb-code`) — it shows the complete generated query with both `health` and `user(id: …)` fields, updating in real time as you interact with the Builder.\n\n' +
        '**Why a live preview instead of a separate Code Gen step?** The SDL preview eliminates the round-trip: you see the exact query that will be sent as you build it, not after a "generate" button click. ' +
        'If you check a field and the SDL looks wrong, you uncheck it immediately — there is no intermediate state to reason about. ' +
        'This is also the canonical export surface: the preview text is exactly what executes when you click Execute.',
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

    // ── Step 3: Copy SDL to Clipboard ──────────────────────────────────────
    {
      id: 'gql9-copy',
      title: 'Copy SDL to Clipboard',
      description:
        'Click **Copy** (`gql-qb-copy`) in the Builder toolbar — the generated query is copied to your clipboard. The button briefly shows **Copied ✓** as confirmation.\n\n' +
        '**Why Copy is the developer handoff path:** The clipboard is the universal bridge between tools. Once the SDL is on your clipboard you can:\n' +
        '- Paste it into a `.graphql` file in your codebase and commit it\n' +
        '- Paste it into a Postman or Insomnia request body\n' +
        '- Paste it into a README or API documentation page\n' +
        '- Run it with a different HTTP client by wrapping it in a JSON body\n\n' +
        'The Copy path is for the **development workflow** — taking the query out of Studio and into your project.',
      highlight: GQL.QB_COPY,
      preAction: ensureBuilderHealthAndUserSelected,
      action: async (ctx) => {
        await ensureBuilderSdlCopied(ctx);
        await ctx.delay(800);
      },
      verify: GQL.QB_COPY,
      pauseAfter: true,
    },

    // ── Step 4: Edit in Editor ─────────────────────────────────────────────
    {
      id: 'gql9-edit',
      title: 'Transfer to Editor (One-Way)',
      description:
        'Click **Edit in Editor** (`gql-qb-edit`) — the SDL transfers to Monaco and **Builder mode turns off**. You can now hand-edit the query text before executing.\n\n' +
        '**Why is this a one-way transfer?** The Builder is a selection model — it tracks which checkboxes are ticked and which arguments are filled. ' +
        'Once you have arbitrary text in the editor (you can write any valid GraphQL), there is no reliable way to reconstruct the checkbox state from that text. ' +
        'So the transfer is intentionally one-way. Use **Edit in Editor** when the Builder got you 90% there and you need to make a final tweak — add a fragment, change a field alias, or add a directive — that Builder mode does not expose.',
      highlight: GQL.QB_EDIT,
      preAction: ensureBuilderHealthAndUserSelected,
      action: async (ctx) => {
        await ensureExportBuilderEditedToEditor(ctx);
        await ctx.delay(800);
      },
      verify: GQL.MODE_EDITOR,
      pauseAfter: true,
    },

    // ── Step 5: Copy as cURL from History ──────────────────────────────────
    {
      id: 'gql9-curl',
      title: 'Share as cURL from History',
      description:
        'Click **Execute** to run the query, then open **History** → **right-click** the entry → **Copy as cURL**. A complete `curl -X POST` command with your endpoint and JSON body is copied to your clipboard.\n\n' +
        '**Why cURL is the universal sharing format:** A cURL command encodes the complete HTTP request — URL, headers, and body — in a single string that works in any terminal on any operating system. It is also the language that engineers, support teams, and CI pipelines share when discussing API calls. ' +
        'Specific advantages:\n' +
        '- **Reproducibility**: the recipient runs the exact same HTTP request, not an approximation\n' +
        '- **CI/CD**: paste into a GitHub Actions step or a bash script with no modification\n' +
        '- **Tool import**: Postman and Insomnia both accept cURL commands via "Import from cURL"\n' +
        '- **Bug reports**: a cURL command in a bug report removes all ambiguity about what was sent',
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
