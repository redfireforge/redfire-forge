/** Lesson GQL-9: Collections & History */
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
  estimatedMinutes: 4,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlCollectionsHistoryLessonSetup,
  cleanup: gqlCollectionsHistoryLessonCleanup,

  concept: {
    title: 'Collections & History — Persistence & Reuse',
    body: `**History** and **Collections** solve two different persistence problems in GraphQL Studio.

**History — automatic capture:** Every time you click Execute (or Subscribe), the operation is automatically appended to the History log — query text, variables, response body, status code, and latency. You never have to manually save anything. This means even accidental one-off queries that produced a useful response are recoverable. The History panel lives in the left activity bar and survives page refreshes (stored in IndexedDB).

**Why History has three actions — Load, Run, and Preview:**
- **Preview** (single-click an entry): Read-only view of the query and its response. Use this to inspect what you sent before deciding to act.
- **Load** (Load button): Copies the query into Monaco without executing it. Use this when you want to edit the query before running again — e.g., changing a variable or adding a field.
- **Run** (Run button): Loads the query into Monaco **and** immediately executes it. Use this when you want to re-execute the exact same operation without modification.

**Collections — intentional persistence:** Collections are named groups of saved operations that persist across sessions and survive browser storage clears (when backed by IndexedDB or Tauri FS). Save from History or directly from the editor. Organize in folders, rename via the context menu, and share via export.

**Export / Import workflow:** Collections export to a single \`redfire-graphql-collections*.json\` file containing all folders, items, metadata, and variables. Import supports two modes:
- **Merge** — adds the imported items to existing collections (safe, non-destructive)
- **Replace** — overwrites all existing collections (destructive)

**Why the distinction matters:** In a team workflow, you maintain a shared \`team-queries.json\` file in version control. New team members import it with **Merge** to add the team queries without overwriting their own. **Replace** is for full environment resets.`,
    keyTerms: [
      {
        term: 'History',
        definition:
          'Auto-logged execution record in the left activity bar. Every Execute/Subscribe appends a timestamped entry with query, variables, response, status code, and latency. Stored in IndexedDB — survives refreshes.',
      },
      {
        term: 'Preview (read-only)',
        definition:
          'Single-click a history entry to open the preview panel (`gql-history-preview`). Shows query and response without any server interaction. Choose Load, Run, or Save from here.',
      },
      {
        term: 'Load vs Run',
        definition:
          '**Load** (`gql-history-load`) copies the query into Monaco only — no execution. **Run** (`gql-history-run`) copies it AND executes immediately. Choose Load when you want to edit first; Run when you want an exact replay.',
      },
      {
        term: 'Collection',
        definition:
          'Named, persistent group of saved GraphQL operations organized in a folder tree. Items can be renamed, reordered, and run by double-click. Stored locally (IDB) or in the Tauri file system.',
      },
      {
        term: 'Import merge vs replace',
        definition:
          '**Merge** adds imported items to existing collections — safe for team workflows. **Replace** overwrites everything — use for fresh environment resets. Always confirm the mode before importing.',
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
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Collections &amp; History</text>

  <!-- ── Connection bar ───────────────────────────────────────────────────── -->
  <rect x="0" y="32" width="700" height="26" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="8" y="37" width="230" height="16" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="16" y="48" fill="var(--text-muted)" font-size="8.5" font-family="monospace">localhost:4010/graphql</text>
  <rect x="250" y="37" width="60" height="16" rx="8" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="280" y="48" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <rect x="610" y="37" width="72" height="16" rx="4" fill="var(--primary)"/>
  <text x="646" y="48" text-anchor="middle" font-size="9" font-weight="700" fill="white">▶ Execute</text>

  <!-- ── Left activity bar ─────────────────────────────────────────────────── -->
  <rect x="0" y="58" width="36" height="372" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>

  <!-- History icon (active/highlighted) -->
  <rect x="3" y="68" width="30" height="30" rx="4" fill="color-mix(in srgb, var(--primary) 20%, var(--surface))" stroke="var(--primary)" stroke-width="1"/>
  <text x="18" y="86" text-anchor="middle" font-size="13">📋</text>
  <!-- History label callout -->
  <rect x="40" y="68" width="56" height="14" rx="3" fill="color-mix(in srgb, var(--primary) 15%, var(--surface))" stroke="var(--primary)" stroke-width="0.8"/>
  <text x="68" y="79" text-anchor="middle" font-size="7.5" fill="var(--primary)" font-weight="600">History</text>
  <line x1="33" y1="83" x2="40" y2="75" stroke="var(--primary)" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- Collections icon (highlighted) -->
  <rect x="3" y="104" width="30" height="30" rx="4" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="18" y="122" text-anchor="middle" font-size="13">📁</text>
  <!-- Collections label callout -->
  <rect x="40" y="104" width="72" height="14" rx="3" fill="color-mix(in srgb, #28c840 10%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="76" y="115" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">Collections</text>
  <line x1="33" y1="119" x2="40" y2="111" stroke="#28c840" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- Other icons (inactive) -->
  <rect x="3" y="140" width="30" height="30" rx="4" fill="var(--bg)"/>
  <text x="18" y="158" text-anchor="middle" font-size="12" opacity="0.3">⚙</text>

  <!-- ── History panel (left, ~220px) ──────────────────────────────────────── -->
  <rect x="36" y="58" width="220" height="372" fill="var(--bg)"/>
  <line x1="256" y1="58" x2="256" y2="430" stroke="var(--border)" stroke-width="1"/>

  <!-- History panel header -->
  <rect x="36" y="58" width="220" height="22" fill="var(--surface)"/>
  <line x1="36" y1="80" x2="256" y2="80" stroke="var(--border)" stroke-width="1"/>
  <text x="46" y="73" font-size="8.5" font-weight="600" fill="var(--text)">History</text>
  <text x="234" y="73" text-anchor="end" font-size="7.5" fill="var(--text-muted)">Clear ✕</text>

  <!-- History entries -->
  <!-- Entry 1 (active/selected) -->
  <rect x="36" y="80" width="220" height="36" fill="color-mix(in srgb, var(--primary) 8%, var(--surface))" stroke="var(--primary)" stroke-width="0.5"/>
  <text x="46" y="95" font-size="8" font-weight="600" fill="var(--primary)">query { health }</text>
  <text x="46" y="109" font-size="7" fill="var(--text-muted)">200 OK · 12ms · 3:21 PM</text>
  <rect x="218" y="84" width="30" height="14" rx="3" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="0.5"/>
  <text x="233" y="95" text-anchor="middle" font-size="7" fill="#28c840">✓ 200</text>

  <!-- Entry 2 -->
  <rect x="36" y="116" width="220" height="36" fill="var(--bg)"/>
  <line x1="36" y1="116" x2="256" y2="116" stroke="var(--border)" stroke-width="0.5"/>
  <text x="46" y="131" font-size="8" fill="var(--text-muted)">query { health }</text>
  <text x="46" y="145" font-size="7" fill="var(--text-muted)">200 OK · 14ms · 3:18 PM</text>

  <!-- Entry 3 -->
  <rect x="36" y="152" width="220" height="36" fill="var(--bg)"/>
  <line x1="36" y1="152" x2="256" y2="152" stroke="var(--border)" stroke-width="0.5"/>
  <text x="46" y="167" font-size="8" fill="var(--text-muted)">mutation { createUser... }</text>
  <text x="46" y="181" font-size="7" fill="var(--text-muted)">201 · 43ms · 3:14 PM</text>

  <!-- History preview panel (below entries) -->
  <line x1="36" y1="196" x2="256" y2="196" stroke="var(--border)" stroke-width="1"/>
  <rect x="36" y="196" width="220" height="16" fill="var(--surface)"/>
  <text x="46" y="207" font-size="7.5" font-weight="600" fill="var(--text)">Preview</text>
  <!-- Action buttons -->
  <rect x="36" y="213" width="220" height="22" fill="var(--surface)"/>
  <rect x="44" y="217" width="34" height="14" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="61" y="227" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">⬇ Load</text>
  <rect x="84" y="217" width="30" height="14" rx="3" fill="var(--primary)"/>
  <text x="99" y="227" text-anchor="middle" font-size="7.5" fill="white" font-weight="600">▶ Run</text>
  <rect x="120" y="217" width="48" height="14" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="144" y="227" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">💾 Save</text>
  <!-- Load/Run annotation -->
  <rect x="42" y="235" width="104" height="13" rx="3" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))" stroke="var(--border)" stroke-width="0.5"/>
  <text x="94" y="245" text-anchor="middle" fill="var(--text-muted)" font-size="6.5">Load = editor only · Run = execute</text>

  <!-- Preview query text -->
  <rect x="36" y="250" width="220" height="80" fill="var(--bg)"/>
  <text x="46" y="266" font-size="8" fill="var(--text-muted)" font-family="monospace">query {</text>
  <text x="46" y="278" font-size="8" fill="var(--text)" font-family="monospace">  health</text>
  <text x="46" y="290" font-size="8" fill="var(--text-muted)" font-family="monospace">}</text>
  <line x1="36" y1="304" x2="256" y2="304" stroke="var(--border)" stroke-width="0.5"/>
  <rect x="36" y="304" width="220" height="36" fill="var(--bg)"/>
  <text x="46" y="316" font-size="7.5" font-weight="600" fill="var(--text-muted)">Response</text>
  <text x="46" y="330" font-size="8" fill="#28c840" font-family="monospace">{ "health": "ok" }</text>

  <!-- ── Collections panel (center, ~220px) ────────────────────────────────── -->
  <rect x="258" y="58" width="220" height="372" fill="var(--bg)"/>
  <line x1="478" y1="58" x2="478" y2="430" stroke="var(--border)" stroke-width="1"/>

  <!-- Collections header -->
  <rect x="258" y="58" width="220" height="22" fill="var(--surface)"/>
  <line x1="258" y1="80" x2="478" y2="80" stroke="var(--border)" stroke-width="1"/>
  <text x="268" y="73" font-size="8.5" font-weight="600" fill="var(--text)">Collections</text>
  <!-- toolbar buttons -->
  <rect x="386" y="62" width="20" height="14" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="396" y="73" text-anchor="middle" font-size="8.5" fill="var(--text-muted)">+</text>
  <rect x="410" y="62" width="28" height="14" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="424" y="73" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">↑ Exp</text>
  <rect x="442" y="62" width="28" height="14" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="456" y="73" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">↓ Imp</text>

  <!-- Collection folder (expanded) -->
  <rect x="258" y="80" width="220" height="22" fill="var(--surface)"/>
  <text x="268" y="94" font-size="9" fill="var(--text)">▾ 📁 Demo Queries</text>
  <text x="448" y="94" text-anchor="end" font-size="7" fill="var(--text-muted)">2 items</text>

  <!-- Collection item 1 (renamed) -->
  <rect x="258" y="102" width="220" height="20" fill="var(--bg)"/>
  <text x="284" y="115" font-size="8.5" fill="var(--text)">📄 Health Checker v2</text>
  <!-- Context menu hint -->
  <rect x="380" y="105" width="54" height="14" rx="2" fill="color-mix(in srgb, #f59e0b 12%, var(--surface))" stroke="#f59e0b" stroke-width="0.5"/>
  <text x="407" y="115" text-anchor="middle" font-size="6.5" fill="#f59e0b">right-click → Rename</text>

  <!-- Collection item 2 -->
  <rect x="258" y="122" width="220" height="20" fill="var(--bg)"/>
  <line x1="258" y1="122" x2="478" y2="122" stroke="var(--border)" stroke-width="0.5"/>
  <text x="284" y="135" font-size="8.5" fill="var(--text-muted)">📄 User Lookup</text>

  <!-- Export / Import hint row -->
  <rect x="258" y="160" width="220" height="26" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <text x="268" y="171" font-size="7.5" font-weight="600" fill="var(--text-muted)">Export →</text>
  <text x="268" y="181" fill="var(--text-muted)" font-size="7">redfire-graphql-collections*.json</text>
  <rect x="398" y="163" width="70" height="18" rx="3" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))" stroke="var(--primary)" stroke-width="0.8"/>
  <text x="433" y="176" text-anchor="middle" font-size="7.5" fill="var(--primary)">Merge | Replace</text>

  <!-- ── Editor area (right, ~220px) ────────────────────────────────────────── -->
  <rect x="480" y="58" width="220" height="372" fill="var(--bg)"/>

  <!-- Editor header tabs -->
  <rect x="480" y="58" width="220" height="22" fill="var(--bg)"/>
  <rect x="484" y="60" width="56" height="18" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="512" y="72" text-anchor="middle" font-size="7.5" fill="var(--text)" font-weight="500">Query 1</text>
  <rect x="480" y="80" width="220" height="1" fill="var(--border)"/>

  <!-- Monaco editor content -->
  <rect x="480" y="81" width="220" height="178" fill="var(--bg)"/>
  <!-- Line numbers -->
  <text x="490" y="97" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">1</text>
  <text x="490" y="110" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">2</text>
  <text x="490" y="123" fill="var(--text-muted)" font-size="7" opacity="0.5" font-family="monospace">3</text>
  <!-- Query code -->
  <text x="504" y="97" fill="#a78bfa" font-size="8.5" font-family="monospace">query</text>
  <text x="531" y="97" fill="var(--text)" font-size="8.5" font-family="monospace"> {</text>
  <text x="504" y="110" fill="var(--text-muted)" font-size="8.5" font-family="monospace">  health</text>
  <text x="504" y="123" fill="var(--text)" font-size="8.5" font-family="monospace">}</text>
  <!-- Loaded from history badge -->
  <rect x="484" y="128" width="110" height="14" rx="3" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))" stroke="var(--border)" stroke-width="0.5"/>
  <text x="539" y="138" text-anchor="middle" fill="var(--primary)" font-size="7">⬇ loaded from history</text>

  <!-- Response panel -->
  <line x1="480" y1="260" x2="700" y2="260" stroke="var(--border)" stroke-width="1"/>
  <rect x="480" y="260" width="220" height="16" fill="var(--surface)"/>
  <text x="490" y="272" font-size="7.5" font-weight="600" fill="var(--text)">Response</text>
  <text x="680" y="272" text-anchor="end" font-size="7" fill="var(--text-muted)">12ms</text>
  <text x="490" y="292" fill="#28c840" font-size="9" font-family="monospace">{ "health": "ok" }</text>

  <!-- ── Save to Collection dialog (modal overlay) ──────────────────────────── -->
  <!-- Semi-transparent backdrop  -->
  <rect x="200" y="140" width="340" height="200" rx="8" fill="color-mix(in srgb, var(--bg) 60%, transparent)" stroke="var(--border)" stroke-width="2"/>
  <!-- Dialog box -->
  <rect x="210" y="148" width="320" height="184" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Dialog header -->
  <rect x="210" y="148" width="320" height="28" rx="6" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))"/>
  <rect x="210" y="164" width="320" height="12" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))"/>
  <text x="370" y="166" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">Save to Collection</text>
  <!-- Name input -->
  <text x="224" y="194" font-size="8" fill="var(--text-muted)">Operation name</text>
  <rect x="224" y="198" width="292" height="18" rx="3" fill="var(--bg)" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="232" y="211" fill="var(--text)" font-size="8.5" font-family="monospace">Health Check Demo</text>
  <!-- Collection picker -->
  <text x="224" y="230" font-size="8" fill="var(--text-muted)">Collection</text>
  <rect x="224" y="234" width="292" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="232" y="247" fill="var(--text)" font-size="8.5">Demo Queries ▾</text>
  <!-- Buttons -->
  <rect x="320" y="306" width="60" height="18" rx="4" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="350" y="319" text-anchor="middle" font-size="8.5" fill="var(--text-muted)">Cancel</text>
  <rect x="386" y="306" width="56" height="18" rx="4" fill="var(--primary)"/>
  <text x="414" y="319" text-anchor="middle" font-size="8.5" font-weight="700" fill="white">💾 Save</text>
  <!-- Dialog callout -->
  <rect x="454" y="220" width="110" height="28" rx="3" fill="color-mix(in srgb, #28c840 10%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="509" y="232" text-anchor="middle" fill="#28c840" font-size="7" font-weight="600">Save from History</text>
  <text x="509" y="242" text-anchor="middle" fill="var(--text-muted)" font-size="6.5">persists across sessions</text>

  <!-- ── Legend: History → Collection lifecycle ────────────────────────────── -->
  <line x1="0" y1="388" x2="700" y2="388" stroke="var(--border)" stroke-width="1"/>
  <rect x="0" y="388" width="700" height="42" fill="var(--bg)"/>
  <defs>
    <marker id="gql9-arr" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
      <path d="M1,1 L4,2.5 L1,4 Z" fill="var(--primary)"/>
    </marker>
  </defs>
  <text x="50" y="404" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">Execute</text>
  <text x="50" y="415" text-anchor="middle" font-size="7" fill="var(--text-muted)">auto-logs</text>
  <line x1="84" y1="407" x2="110" y2="407" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="145" y="404" text-anchor="middle" font-size="8" font-weight="600" fill="var(--text)">History</text>
  <text x="145" y="415" text-anchor="middle" font-size="7" fill="var(--text-muted)">preview entry</text>
  <line x1="180" y1="404" x2="202" y2="404" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="222" y="401" text-anchor="middle" font-size="7.5" fill="var(--text)">Load</text>
  <text x="222" y="411" text-anchor="middle" font-size="7" fill="var(--text-muted)">editor only</text>
  <text x="222" y="420" text-anchor="middle" font-size="7" fill="var(--text-muted)">(no execute)</text>
  <line x1="246" y1="404" x2="268" y2="404" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="290" y="401" text-anchor="middle" font-size="7.5" fill="var(--text)">Run</text>
  <text x="290" y="411" text-anchor="middle" font-size="7" fill="var(--text-muted)">load + execute</text>
  <line x1="314" y1="404" x2="336" y2="404" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="365" y="401" text-anchor="middle" font-size="7.5" fill="var(--text)">Save to Col.</text>
  <text x="365" y="411" text-anchor="middle" font-size="7" fill="var(--text-muted)">name + folder</text>
  <line x1="400" y1="404" x2="422" y2="404" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="448" y="401" text-anchor="middle" font-size="7.5" fill="var(--text)">Rename</text>
  <text x="448" y="411" text-anchor="middle" font-size="7" fill="var(--text-muted)">ctx menu</text>
  <line x1="478" y1="404" x2="500" y2="404" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="525" y="401" text-anchor="middle" font-size="7.5" fill="var(--text)">Export</text>
  <text x="525" y="411" text-anchor="middle" font-size="7" fill="var(--text-muted)">.json file</text>
  <line x1="550" y1="404" x2="572" y2="404" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="610" y="401" text-anchor="middle" font-size="7.5" fill="var(--text)">Import</text>
  <text x="610" y="411" text-anchor="middle" font-size="7" fill="var(--text-muted)">Merge | Replace</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Execute & auto-log ──────────────────────────────────────────
    {
      id: 'gql8-execute',
      title: 'Execute & Auto-Log to History',
      description:
        `With \`query { health }\` in the editor, click **Execute**. Open the **History** panel (📋 in the left activity bar) — a new entry appears with status code, latency, and timestamp.\n\n` +
        '**Why History auto-logs:** You never have to remember to save a useful query. Every execution is captured automatically — including accidental queries that returned an interesting result, failed requests (useful for debugging), and baseline measurements. ' +
        'The log is stored in IndexedDB and survives page refreshes, so you can close the tab and still see what you ran last session.',
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

    // ── Step 2: Preview entry ───────────────────────────────────────────────
    {
      id: 'gql8-preview',
      title: 'Preview a History Entry',
      description:
        '**Single-click** a history row — the **Preview** panel (`gql-history-preview`) opens with the query text and the formatted response JSON side by side. This view is **read-only** until you choose an action.\n\n' +
        '**Why preview is read-only:** Seeing the query and response together before deciding what to do prevents accidental re-execution. You might want to compare this response against a newer run, or just confirm the query text before editing it. ' +
        'The preview shows status code, latency, and timestamp — enough context to understand what happened without running anything.',
      highlight: GQL.HISTORY_PREVIEW,
      preAction: ensureHealthExecutedWithHistory,
      action: async (ctx) => {
        await ensureHistoryPreviewOpen(ctx);
        await ctx.delay(800);
      },
      verify: GQL.HISTORY_PREVIEW,
      pauseAfter: true,
    },

    // ── Step 3: Load into editor ────────────────────────────────────────────
    {
      id: 'gql8-load',
      title: 'Load into Editor (No Execute)',
      description:
        'Click **Load** (`gql-history-load`) in the preview panel — the query transfers to Monaco **without** executing it. The editor contains the operation and you can modify it before running.\n\n' +
        '**Why Load ≠ Run:** Load is the "inspect before committing" action. Common uses: you want to add a field to the query before re-running, you want to adjust a variable value, or you want to refactor the query into a mutation. ' +
        'It gives you a starting point without hitting the server — useful in production environments where unnecessary queries have cost or side-effect implications.',
      highlight: GQL.HISTORY_LOAD,
      preAction: ensureHistoryPreviewOpen,
      action: async (ctx) => {
        await ensureHistoryLoadedToEditor(ctx);
        await ctx.delay(800);
      },
      verify: GQL.EDITOR,
      pauseAfter: true,
    },

    // ── Step 4: Run from history ────────────────────────────────────────────
    {
      id: 'gql8-run',
      title: 'Run from History (Load + Execute)',
      description:
        'Re-open the preview and click **Run** (`gql-history-run`) — the query loads into the editor **and executes immediately**. Watch the response panel update with a fresh result.\n\n' +
        '**Why Run exists separately:** The most common history use case is re-running a query to see if the server response changed (e.g., checking if a data mutation took effect, or re-testing after a server fix). ' +
        'Run collapses Load + Execute into a single click, saving the extra interaction when you want an exact replay with no changes.',
      highlight: GQL.HISTORY_RUN,
      preAction: ensureHistoryLoadedToEditor,
      action: async (ctx) => {
        await ensureHistoryRunExecuted(ctx);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    // ── Step 5: Save to Collection ──────────────────────────────────────────
    {
      id: 'gql8-save',
      title: 'Save to a Collection',
      description:
        `From the history preview, click **Save to Collection** — name the operation **${LESSON8_ITEM_NAME}** → pick a collection (create one with **+** if needed) → **Save**.\n\n` +
        '**Why Collections exist:** History is auto-logged but not curated. Collections are the curated library — you save only the operations your team actually uses. ' +
        'Collections persist even if you clear History, survive browser storage resets (in Tauri, they live in the file system), and can be shared via export. ' +
        'Think of History as your browser history and Collections as your bookmarks.',
      highlight: GQL.HISTORY_SAVE_TO_COL,
      preAction: ensureHistoryRunExecuted,
      action: async (ctx) => {
        await ensureSavedToCollectionFromHistory(ctx);
        await ctx.delay(800);
      },
      verify: GQL.COL_ITEM,
      pauseAfter: true,
    },

    // ── Step 6: Rename ──────────────────────────────────────────────────────
    {
      id: 'gql8-rename',
      title: 'Rename a Collection Item',
      description:
        `Open **Collections** → expand the folder → **right-click** the saved item → **Rename** → enter **${LESSON8_ITEM_RENAME}**.\n\n` +
        '**Why right-click to rename (not double-click):** Double-clicking a collection item **loads** it into the editor — that\'s the primary action. ' +
        'Rename is a less frequent operation, deliberately placed in the context menu to prevent accidental renames. ' +
        'The context menu also offers **Delete** and **Duplicate** so you have full lifecycle control without cluttering the item row.',
      highlight: GQL.COL_ITEM_RENAME,
      preAction: ensureSavedToCollectionFromHistory,
      action: async (ctx) => {
        await ensureCollectionItemRenamed(ctx);
        await ctx.delay(800);
      },
      verify: GQL.COL_ITEM,
      pauseAfter: true,
    },

    // ── Step 7: Export ──────────────────────────────────────────────────────
    {
      id: 'gql8-export',
      title: 'Export Collections to JSON',
      description:
        'Click **Export** (`gql-collections-export`) in the Collections toolbar — a `redfire-graphql-collections*.json` file downloads containing all collections, folders, items, and operation metadata.\n\n' +
        '**Why export matters:** The JSON file is the portable representation of your entire query library. Common workflows:\n' +
        '- Check it into version control so the whole team shares the same queries\n' +
        '- Email it to a customer to reproduce an issue\n' +
        '- Archive a project\'s API surface before sunsetting it\n' +
        '- Migrate queries to a new environment by importing on the target machine',
      highlight: GQL.COLLECTIONS_EXPORT,
      preAction: ensureCollectionItemRenamed,
      action: async (ctx) => {
        await ctx.click(GQL.COLLECTIONS_EXPORT);
        await ctx.delay(1500);
      },
      verify: GQL.COLLECTIONS_EXPORT,
      pauseAfter: true,
    },

    // ── Step 8: Import (Merge) ──────────────────────────────────────────────
    {
      id: 'gql8-import',
      title: 'Delete & Import with Merge',
      description:
        '**Right-click** the collection header → **Delete**. Then click **Import** (`gql-collections-import`), choose your exported JSON, and select **Merge** — the saved operation reappears in the tree.\n\n' +
        '**Why two import modes?**\n' +
        '- **Merge** — adds imported items alongside existing collections. Safe for team onboarding: a new teammate imports the shared library without losing their own queries.\n' +
        '- **Replace** — overwrites all collections with the imported file. Use for environment resets or seeding a fresh install.\n\n' +
        'This step demonstrates that the exported JSON is a complete, self-contained backup — the collection fully restores from the file alone.',
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
