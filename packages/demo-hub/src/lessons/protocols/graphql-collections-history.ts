/** Lesson GQL-9: Collections & History */
import type { DemoLesson } from '../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
  LESSON8_ITEM_NAME,
  LESSON8_ITEM_RENAME,
  executeLesson8HealthQuery,
  revealHistoryPanel,
  openHistoryPreview,
  loadHistoryToEditor,
  runHistoryEntry,
  saveHistoryToCollection,
  renameCollectionItem,
  deleteLesson8Collection,
  triggerCollectionsImportFile,
  confirmImportWithMerge,
  gqlCollectionsHistoryLessonCleanup,
  gqlCollectionsHistoryLessonSetup,
  prepareGql8ExecHealthReading,
  prepareGql8ObserveHistoryReading,
  prepareGql8PreviewReading,
  prepareGql8LoadReading,
  prepareGql8RunReading,
  prepareGql8SaveReading,
  prepareGql8RenameReading,
  prepareGql8ExportReading,
  prepareGql8DeleteReading,
  prepareGql8ImportFileReading,
  prepareGql8ImportMergeReading,
} from './graphql-lesson-helpers';

export const gqlCollectionsHistoryLesson: DemoLesson = {
  id: 'gql-collections-history',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Collections & History',
  description:
    'Use execution History to preview, load, and re-run queries; save operations to Collections; rename items; export and import collection JSON.',
  estimatedMinutes: 7,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
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

**Why History has three actions — Preview, Load into editor, and Open & Run:**
- **Preview** (single-click an entry): Read-only view of the query and its response. Use this to inspect what you sent before deciding to act.
- **Load into editor**: Copies the query into Monaco without executing it. Use this when you want to edit the query before running again — e.g., changing a variable or adding a field.
- **Open & Run**: Loads the query into Monaco **and** immediately executes it. Use this when you want to re-execute the exact same operation without modification.

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
          'Single-click a history entry to open the **Preview** panel. Shows query and response without any server interaction. Choose **Load into editor**, **Open & Run**, or **Save to Collection** from here.',
      },
      {
        term: 'Load into editor vs Open & Run',
        definition:
          '**Load into editor** copies the query into Monaco only — no execution. **Open & Run** copies it AND executes immediately. Choose Load into editor when you want to edit first; Open & Run when you want an exact replay.',
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
  <rect x="0" y="0" width="700" height="430" rx="10" fill="#0f172a" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="0" y="0" width="700" height="32" rx="10" fill="#1e293b"/>
  <rect x="0" y="22" width="700" height="10" fill="#1e293b"/>
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <text x="350" y="21" text-anchor="middle" fill="#a8b8cc" font-size="11" font-weight="500">GraphQL Studio — Collections &amp; History</text>

  <!-- ── Connection bar ───────────────────────────────────────────────────── -->
  <rect x="0" y="32" width="700" height="26" fill="#1e293b" stroke="#3b4a60" stroke-width="0.5"/>
  <rect x="8" y="37" width="230" height="16" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="16" y="48" fill="#a8b8cc" font-size="8.5" font-family="monospace">localhost:4010/graphql</text>
  <rect x="250" y="37" width="60" height="16" rx="8" fill="#1a3324" stroke="#28c840" stroke-width="1"/>
  <text x="280" y="48" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <rect x="610" y="37" width="72" height="16" rx="4" fill="#3b82f6"/>
  <text x="646" y="48" text-anchor="middle" font-size="9" font-weight="700" fill="white">▶ Execute</text>

  <!-- ── Left activity bar ─────────────────────────────────────────────────── -->
  <rect x="0" y="58" width="36" height="372" fill="#1e293b" stroke="#3b4a60" stroke-width="0.5"/>

  <!-- History icon (active/highlighted) -->
  <rect x="3" y="68" width="30" height="30" rx="4" fill="color-mix(in srgb, #3b82f6 20%, #1e293b)" stroke="#3b82f6" stroke-width="1"/>
  <text x="18" y="86" text-anchor="middle" font-size="13">📋</text>
  <!-- History label callout -->
  <rect x="40" y="68" width="56" height="14" rx="3" fill="#243044" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="68" y="79" text-anchor="middle" font-size="7.5" fill="#3b82f6" font-weight="600">History</text>
  <line x1="33" y1="83" x2="40" y2="75" stroke="#3b82f6" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- Collections icon (highlighted) -->
  <rect x="3" y="104" width="30" height="30" rx="4" fill="#1a3324" stroke="#28c840" stroke-width="1"/>
  <text x="18" y="122" text-anchor="middle" font-size="13">📁</text>
  <!-- Collections label callout -->
  <rect x="40" y="104" width="72" height="14" rx="3" fill="#1a3028" stroke="#28c840" stroke-width="0.8"/>
  <text x="76" y="115" text-anchor="middle" font-size="7.5" fill="#28c840" font-weight="600">Collections</text>
  <line x1="33" y1="119" x2="40" y2="111" stroke="#28c840" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- Other icons (inactive) -->
  <rect x="3" y="140" width="30" height="30" rx="4" fill="#0f172a"/>
  <text x="18" y="158" text-anchor="middle" font-size="12" opacity="0.3">⚙</text>

  <!-- ── History panel (left, ~220px) ──────────────────────────────────────── -->
  <rect x="36" y="58" width="220" height="372" fill="#0f172a"/>
  <line x1="256" y1="58" x2="256" y2="430" stroke="#3b4a60" stroke-width="1"/>

  <!-- History panel header -->
  <rect x="36" y="58" width="220" height="22" fill="#1e293b"/>
  <line x1="36" y1="80" x2="256" y2="80" stroke="#3b4a60" stroke-width="1"/>
  <text x="46" y="73" font-size="8.5" font-weight="600" fill="#f1f5f9">History</text>
  <text x="234" y="73" text-anchor="end" font-size="7.5" fill="#a8b8cc">Clear ✕</text>

  <!-- History entries -->
  <!-- Entry 1 (active/selected) -->
  <rect x="36" y="80" width="220" height="36" fill="#152238" stroke="#3b82f6" stroke-width="0.5"/>
  <text x="46" y="95" font-size="8" font-weight="600" fill="#3b82f6">query { health }</text>
  <text x="46" y="109" font-size="7" fill="#a8b8cc">200 OK · 12ms · 3:21 PM</text>
  <rect x="218" y="84" width="30" height="14" rx="3" fill="#1a3324" stroke="#28c840" stroke-width="0.5"/>
  <text x="233" y="95" text-anchor="middle" font-size="7" fill="#28c840">✓ 200</text>

  <!-- Entry 2 -->
  <rect x="36" y="116" width="220" height="36" fill="#0f172a"/>
  <line x1="36" y1="116" x2="256" y2="116" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="46" y="131" font-size="8" fill="#a8b8cc">query { health }</text>
  <text x="46" y="145" font-size="7" fill="#a8b8cc">200 OK · 14ms · 3:18 PM</text>

  <!-- Entry 3 -->
  <rect x="36" y="152" width="220" height="36" fill="#0f172a"/>
  <line x1="36" y1="152" x2="256" y2="152" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="46" y="167" font-size="8" fill="#a8b8cc">mutation { createUser... }</text>
  <text x="46" y="181" font-size="7" fill="#a8b8cc">201 · 43ms · 3:14 PM</text>

  <!-- History preview panel (below entries) -->
  <line x1="36" y1="196" x2="256" y2="196" stroke="#3b4a60" stroke-width="1"/>
  <rect x="36" y="196" width="220" height="16" fill="#1e293b"/>
  <text x="46" y="207" font-size="7.5" font-weight="600" fill="#f1f5f9">Preview</text>
  <!-- Action buttons -->
  <rect x="36" y="213" width="220" height="22" fill="#1e293b"/>
  <rect x="44" y="217" width="52" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="70" y="227" text-anchor="middle" font-size="6.5" fill="#a8b8cc">Load into editor</text>
  <rect x="100" y="217" width="48" height="14" rx="3" fill="#3b82f6"/>
  <text x="124" y="227" text-anchor="middle" font-size="6.5" fill="white" font-weight="600">Open &amp; Run</text>
  <rect x="152" y="217" width="48" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="176" y="227" text-anchor="middle" font-size="6.5" fill="#a8b8cc">Save to Col.</text>
  <!-- Load/Run annotation -->
  <rect x="42" y="235" width="148" height="13" rx="3" fill="#1a2740" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="116" y="245" text-anchor="middle" fill="#a8b8cc" font-size="6">Load into editor = no execute · Open &amp; Run = load + execute</text>

  <!-- Preview query text -->
  <rect x="36" y="250" width="220" height="80" fill="#0f172a"/>
  <text x="46" y="266" font-size="8" fill="#a8b8cc" font-family="monospace">query {</text>
  <text x="46" y="278" font-size="8" fill="#f1f5f9" font-family="monospace">  health</text>
  <text x="46" y="290" font-size="8" fill="#a8b8cc" font-family="monospace">}</text>
  <line x1="36" y1="304" x2="256" y2="304" stroke="#3b4a60" stroke-width="0.5"/>
  <rect x="36" y="304" width="220" height="36" fill="#0f172a"/>
  <text x="46" y="316" font-size="7.5" font-weight="600" fill="#a8b8cc">Response</text>
  <text x="46" y="330" font-size="8" fill="#28c840" font-family="monospace">{ "health": "ok" }</text>

  <!-- ── Collections panel (center, ~220px) ────────────────────────────────── -->
  <rect x="258" y="58" width="220" height="372" fill="#0f172a"/>
  <line x1="478" y1="58" x2="478" y2="430" stroke="#3b4a60" stroke-width="1"/>

  <!-- Collections header -->
  <rect x="258" y="58" width="220" height="22" fill="#1e293b"/>
  <line x1="258" y1="80" x2="478" y2="80" stroke="#3b4a60" stroke-width="1"/>
  <text x="268" y="73" font-size="8.5" font-weight="600" fill="#f1f5f9">Collections</text>
  <!-- toolbar buttons -->
  <rect x="386" y="62" width="20" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="396" y="73" text-anchor="middle" font-size="8.5" fill="#a8b8cc">+</text>
  <rect x="410" y="62" width="28" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="424" y="73" text-anchor="middle" font-size="7.5" fill="#a8b8cc">↑ Exp</text>
  <rect x="442" y="62" width="28" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="456" y="73" text-anchor="middle" font-size="7.5" fill="#a8b8cc">↓ Imp</text>

  <!-- Collection folder (expanded) -->
  <rect x="258" y="80" width="220" height="22" fill="#1e293b"/>
  <text x="268" y="94" font-size="9" fill="#f1f5f9">▾ 📁 Demo Queries</text>
  <text x="448" y="94" text-anchor="end" font-size="7" fill="#a8b8cc">2 items</text>

  <!-- Collection item 1 (renamed) -->
  <rect x="258" y="102" width="220" height="20" fill="#0f172a"/>
  <text x="284" y="115" font-size="8.5" fill="#f1f5f9">📄 Health Checker v2</text>
  <!-- Context menu hint -->
  <rect x="380" y="105" width="54" height="14" rx="2" fill="#2d2a1a" stroke="#f59e0b" stroke-width="0.5"/>
  <text x="407" y="115" text-anchor="middle" font-size="6.5" fill="#f59e0b">right-click → Rename</text>

  <!-- Collection item 2 -->
  <rect x="258" y="122" width="220" height="20" fill="#0f172a"/>
  <line x1="258" y1="122" x2="478" y2="122" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="284" y="135" font-size="8.5" fill="#a8b8cc">📄 User Lookup</text>

  <!-- Export / Import hint row -->
  <rect x="258" y="160" width="220" height="26" fill="#1e293b" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="268" y="171" font-size="7.5" font-weight="600" fill="#a8b8cc">Export →</text>
  <text x="268" y="181" fill="#a8b8cc" font-size="7">redfire-graphql-collections*.json</text>
  <rect x="398" y="163" width="70" height="18" rx="3" fill="#1a2740" stroke="#3b82f6" stroke-width="0.8"/>
  <text x="433" y="176" text-anchor="middle" font-size="7.5" fill="#3b82f6">Merge | Replace</text>

  <!-- ── Editor area (right, ~220px) ────────────────────────────────────────── -->
  <rect x="480" y="58" width="220" height="372" fill="#0f172a"/>

  <!-- Editor header tabs -->
  <rect x="480" y="58" width="220" height="22" fill="#0f172a"/>
  <rect x="484" y="60" width="56" height="18" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="512" y="72" text-anchor="middle" font-size="7.5" fill="#f1f5f9" font-weight="500">Query 1</text>
  <rect x="480" y="80" width="220" height="1" fill="#3b4a60"/>

  <!-- Monaco editor content -->
  <rect x="480" y="81" width="220" height="178" fill="#0f172a"/>
  <!-- Line numbers -->
  <text x="490" y="97" fill="#a8b8cc" font-size="7" opacity="0.5" font-family="monospace">1</text>
  <text x="490" y="110" fill="#a8b8cc" font-size="7" opacity="0.5" font-family="monospace">2</text>
  <text x="490" y="123" fill="#a8b8cc" font-size="7" opacity="0.5" font-family="monospace">3</text>
  <!-- Query code -->
  <text x="504" y="97" fill="#a78bfa" font-size="8.5" font-family="monospace">query</text>
  <text x="531" y="97" fill="#f1f5f9" font-size="8.5" font-family="monospace"> {</text>
  <text x="504" y="110" fill="#a8b8cc" font-size="8.5" font-family="monospace">  health</text>
  <text x="504" y="123" fill="#f1f5f9" font-size="8.5" font-family="monospace">}</text>
  <!-- Loaded from history badge -->
  <rect x="484" y="128" width="110" height="14" rx="3" fill="#1a2740" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="539" y="138" text-anchor="middle" fill="#3b82f6" font-size="7">⬇ loaded from history</text>

  <!-- Response panel -->
  <line x1="480" y1="260" x2="700" y2="260" stroke="#3b4a60" stroke-width="1"/>
  <rect x="480" y="260" width="220" height="16" fill="#1e293b"/>
  <text x="490" y="272" font-size="7.5" font-weight="600" fill="#f1f5f9">Response</text>
  <text x="680" y="272" text-anchor="end" font-size="7" fill="#a8b8cc">12ms</text>
  <text x="490" y="292" fill="#28c840" font-size="9" font-family="monospace">{ "health": "ok" }</text>

  <!-- ── Save to Collection dialog (modal overlay) ──────────────────────────── -->
  <!-- Semi-transparent backdrop  -->
  <rect x="200" y="140" width="340" height="200" rx="8" fill="color-mix(in srgb, #0f172a 60%, transparent)" stroke="#3b4a60" stroke-width="2"/>
  <!-- Dialog box -->
  <rect x="210" y="148" width="320" height="184" rx="6" fill="#1e293b" stroke="#3b4a60" stroke-width="1.5"/>
  <!-- Dialog header -->
  <rect x="210" y="148" width="320" height="28" rx="6" fill="#1a2740"/>
  <rect x="210" y="164" width="320" height="12" fill="#1a2740"/>
  <text x="370" y="166" text-anchor="middle" font-size="10" font-weight="700" fill="#f1f5f9">Save to Collection</text>
  <!-- Name input -->
  <text x="224" y="194" font-size="8" fill="#a8b8cc">Operation name</text>
  <rect x="224" y="198" width="292" height="18" rx="3" fill="#0f172a" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="232" y="211" fill="#f1f5f9" font-size="8.5" font-family="monospace">Health Check Demo</text>
  <!-- Collection picker -->
  <text x="224" y="230" font-size="8" fill="#a8b8cc">Collection</text>
  <rect x="224" y="234" width="292" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="232" y="247" fill="#f1f5f9" font-size="8.5">Demo Queries ▾</text>
  <!-- Buttons -->
  <rect x="320" y="306" width="60" height="18" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="350" y="319" text-anchor="middle" font-size="8.5" fill="#a8b8cc">Cancel</text>
  <rect x="386" y="306" width="56" height="18" rx="4" fill="#3b82f6"/>
  <text x="414" y="319" text-anchor="middle" font-size="8.5" font-weight="700" fill="white">💾 Save</text>
  <!-- Dialog callout -->
  <rect x="454" y="220" width="110" height="28" rx="3" fill="#1a3028" stroke="#28c840" stroke-width="0.8"/>
  <text x="509" y="232" text-anchor="middle" fill="#28c840" font-size="7" font-weight="600">Save from History</text>
  <text x="509" y="242" text-anchor="middle" fill="#a8b8cc" font-size="6.5">persists across sessions</text>

  <!-- ── Legend: History → Collection lifecycle ────────────────────────────── -->
  <line x1="0" y1="388" x2="700" y2="388" stroke="#3b4a60" stroke-width="1"/>
  <rect x="0" y="388" width="700" height="42" fill="#0f172a"/>
  <defs>
    <marker id="gql9-arr" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto">
      <path d="M1,1 L4,2.5 L1,4 Z" fill="#3b82f6"/>
    </marker>
  </defs>
  <text x="50" y="404" text-anchor="middle" font-size="8" font-weight="600" fill="#f1f5f9">Execute</text>
  <text x="50" y="415" text-anchor="middle" font-size="7" fill="#a8b8cc">auto-logs</text>
  <line x1="84" y1="407" x2="110" y2="407" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="145" y="404" text-anchor="middle" font-size="8" font-weight="600" fill="#f1f5f9">History</text>
  <text x="145" y="415" text-anchor="middle" font-size="7" fill="#a8b8cc">preview entry</text>
  <line x1="180" y1="404" x2="202" y2="404" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="222" y="401" text-anchor="middle" font-size="7" fill="#f1f5f9">Load into editor</text>
  <text x="222" y="411" text-anchor="middle" font-size="7" fill="#a8b8cc">editor only</text>
  <text x="222" y="420" text-anchor="middle" font-size="7" fill="#a8b8cc">(no execute)</text>
  <line x1="246" y1="404" x2="268" y2="404" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="290" y="401" text-anchor="middle" font-size="7" fill="#f1f5f9">Open &amp; Run</text>
  <text x="290" y="411" text-anchor="middle" font-size="7" fill="#a8b8cc">load + execute</text>
  <line x1="314" y1="404" x2="336" y2="404" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="365" y="401" text-anchor="middle" font-size="7.5" fill="#f1f5f9">Save to Col.</text>
  <text x="365" y="411" text-anchor="middle" font-size="7" fill="#a8b8cc">name + folder</text>
  <line x1="400" y1="404" x2="422" y2="404" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="448" y="401" text-anchor="middle" font-size="7.5" fill="#f1f5f9">Rename</text>
  <text x="448" y="411" text-anchor="middle" font-size="7" fill="#a8b8cc">ctx menu</text>
  <line x1="478" y1="404" x2="500" y2="404" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="525" y="401" text-anchor="middle" font-size="7.5" fill="#f1f5f9">Export</text>
  <text x="525" y="411" text-anchor="middle" font-size="7" fill="#a8b8cc">.json file</text>
  <line x1="550" y1="404" x2="572" y2="404" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql9-arr)"/>
  <text x="610" y="401" text-anchor="middle" font-size="7.5" fill="#f1f5f9">Import</text>
  <text x="610" y="411" text-anchor="middle" font-size="7" fill="#a8b8cc">Merge | Replace</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Execute & auto-log ──────────────────────────────────────────
    {
      id: 'gql8-exec-health',
      title: 'Execute the Health Query',
      description:
        'With `query { health }` in the editor, click **Execute**. Under the hood every execution is captured automatically — you never have to remember to save a useful query.\n\n' +
        'This step triggers the request; the next step opens **History** so you can see the new entry with status code, latency, and timestamp.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareGql8ExecHealthReading,
      action: async (ctx) => {
        await executeLesson8HealthQuery(ctx);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    {
      id: 'gql8-observe-history',
      title: 'Auto-Log to History',
      description:
        'Open the **History** panel (📋 in the left activity bar) — a new entry appears with status code, latency, and timestamp.\n\n' +
        '**Why History auto-logs:** Every execution is captured automatically — including accidental queries that returned an interesting result, failed requests (useful for debugging), and baseline measurements. ' +
        'The log is stored in IndexedDB and survives page refreshes.',
      highlight: GQL.HISTORY_ENTRY,
      preAction: prepareGql8ObserveHistoryReading,
      action: async (ctx) => {
        await revealHistoryPanel(ctx);
      },
      verify: GQL.HISTORY_ENTRY,
      pauseAfter: true,
    },

    // ── Step 3: Preview entry ───────────────────────────────────────────────
    {
      id: 'gql8-preview',
      title: 'Preview a History Entry',
      description:
        '**Single-click** a history row — the **Preview** panel opens with the query text and the formatted response JSON side by side. This view is **read-only** until you choose an action.\n\n' +
        '**Why preview is read-only:** Seeing the query and response together before deciding what to do prevents accidental re-execution. You might want to compare this response against a newer run, or just confirm the query text before editing it. ' +
        'The preview shows status code, latency, and timestamp — enough context to understand what happened without running anything.',
      highlight: GQL.HISTORY_PREVIEW,
      preAction: prepareGql8PreviewReading,
      action: async (ctx) => {
        await openHistoryPreview(ctx);
      },
      verify: GQL.HISTORY_PREVIEW,
      pauseAfter: true,
    },

    // ── Step 3: Load into editor ────────────────────────────────────────────
    {
      id: 'gql8-load',
      title: 'Load into Editor (No Execute)',
      description:
        'Click **Load into editor** in the preview panel — the query transfers to Monaco **without** executing it. The editor contains the operation and you can modify it before running.\n\n' +
        '**Why Load into editor ≠ Open & Run:** Load into editor is the "inspect before committing" action. Common uses: you want to add a field to the query before re-running, you want to adjust a variable value, or you want to refactor the query into a mutation. ' +
        'It gives you a starting point without hitting the server — useful in production environments where unnecessary queries have cost or side-effect implications.',
      highlight: GQL.HISTORY_LOAD,
      preAction: prepareGql8LoadReading,
      action: async (ctx) => {
        await loadHistoryToEditor(ctx);
      },
      verify: GQL.EDITOR,
      pauseAfter: true,
    },

    // ── Step 4: Run from history ────────────────────────────────────────────
    {
      id: 'gql8-run',
      title: 'Open & Run from History',
      description:
        'Re-open the preview and click **Open & Run** — the query loads into the editor **and executes immediately**. Watch the response panel update with a fresh result.\n\n' +
        '**Why Open & Run exists separately:** The most common history use case is re-running a query to see if the server response changed (e.g., checking if a data mutation took effect, or re-testing after a server fix). ' +
        'Open & Run collapses Load into editor + Execute into a single click, saving the extra interaction when you want an exact replay with no changes.',
      highlight: GQL.HISTORY_RUN,
      preAction: prepareGql8RunReading,
      action: async (ctx) => {
        await runHistoryEntry(ctx);
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
      preAction: prepareGql8SaveReading,
      action: async (ctx) => {
        await saveHistoryToCollection(ctx);
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
      preAction: prepareGql8RenameReading,
      action: async (ctx) => {
        await renameCollectionItem(ctx);
      },
      verify: GQL.COL_ITEM,
      pauseAfter: true,
    },

    // ── Step 7: Export ──────────────────────────────────────────────────────
    {
      id: 'gql8-export',
      title: 'Export Collections to JSON',
      description:
        'Click **Export** in the Collections toolbar — a `redfire-graphql-collections*.json` file downloads containing all collections, folders, items, and operation metadata.\n\n' +
        '**Why export matters:** The JSON file is the portable representation of your entire query library. Common workflows:\n' +
        '- Check it into version control so the whole team shares the same queries\n' +
        '- Email it to a customer to reproduce an issue\n' +
        '- Archive a project\'s API surface before sunsetting it\n' +
        '- Migrate queries to a new environment by importing on the target machine',
      highlight: GQL.COLLECTIONS_EXPORT,
      preAction: prepareGql8ExportReading,
      action: async (ctx) => {
        await ctx.click(GQL.COLLECTIONS_EXPORT);
        await ctx.delay(2000);
      },
      verify: GQL.COLLECTIONS_EXPORT,
      pauseAfter: true,
    },

    // ── Step 9: Delete collection ───────────────────────────────────────────
    {
      id: 'gql8-delete',
      title: 'Delete the Collection',
      description:
        'Open **Collections** → **right-click** the collection header → **Delete**. The folder and its saved operation disappear from the tree.\n\n' +
        '**Why delete first?** This simulates starting fresh — or recovering after accidental loss — before importing a shared query library from a teammate\'s export file.',
      highlight: GQL.COL_NODE,
      preAction: prepareGql8DeleteReading,
      action: async (ctx) => {
        await deleteLesson8Collection(ctx);
      },
      verify: GQL.COLLECTIONS_PANEL,
      pauseAfter: true,
    },

    // ── Step 10: Import JSON file ───────────────────────────────────────────
    {
      id: 'gql8-import-file',
      title: 'Import the Exported JSON',
      description:
        'Click **Import** in the Collections toolbar and choose your `redfire-graphql-collections*.json` file. RedfireForge parses the export and opens the **Import mode** dialog.\n\n' +
        'The demo loads a sample export containing **Lesson 8 Health** — the same operation you exported in the previous step.',
      highlight: GQL.COLLECTIONS_IMPORT,
      preAction: prepareGql8ImportFileReading,
      action: async (ctx) => {
        await triggerCollectionsImportFile(ctx);
      },
      verify: GQL.IMPORT_MODE_DIALOG,
      pauseAfter: true,
    },

    // ── Step 11: Choose Merge ─────────────────────────────────────────────────
    {
      id: 'gql8-import-merge',
      title: 'Choose Merge to Restore',
      description:
        'Select **Merge** — imported items are added alongside any existing collections without overwriting them. The saved operation reappears in the tree.\n\n' +
        '**Why two import modes?**\n' +
        '- **Merge** — safe for team onboarding: a new teammate imports the shared library without losing their own queries.\n' +
        '- **Replace** — overwrites all collections with the imported file. Use for environment resets or seeding a fresh install.\n\n' +
        'This confirms the exported JSON is a complete, self-contained backup — the collection fully restores from the file alone.',
      highlight: GQL.IMPORT_MODE_MERGE,
      preAction: prepareGql8ImportMergeReading,
      action: async (ctx) => {
        await confirmImportWithMerge(ctx);
      },
      verify: GQL.COL_ITEM,
      pauseAfter: true,
    },
  ],
};
