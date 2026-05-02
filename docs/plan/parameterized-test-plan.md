# Parameterized Test (Data-Driven Regression Testing) Plan

> **Goal:** Enable users to define one test pattern with an attached data table (inline or from CSV/Excel file), so the engine expands it into N requests at execution time — replacing the current workflow of exporting a template, editing externally, and re-importing as N independent Scenarios.

---

## ⚙️ Progress Tracking Protocol

> **RULE:** When implementing any phase from this plan, this file MUST be updated as part of that phase's work. This is non-negotiable — it keeps the plan a living document, not a stale spec.

### What to Update Per Phase

1. **Phase Status Tracker** (Section 11 below) — mark the phase status: `🔲 Not Started` → `🔨 In Progress` → `✅ Complete` → `🔍 In Review`
2. **Implementation Notes** — add a sub-section under the phase with:
   - Actual files created/modified (with links)
   - Any deviations from the plan (what changed and why)
   - Test coverage added (file names, test count)
   - Known issues or follow-ups discovered during implementation
3. **Commit Reference** — add the commit hash(es) for the phase's work
4. **Date** — record start and completion dates
5. **Success Criteria** (Section 10) — check off completed items: `- [ ]` → `- [x]`

### Template for Phase Completion Notes

```markdown
#### Implementation Notes (Phase N)
- **Started:** YYYY-MM-DD | **Completed:** YYYY-MM-DD
- **Commits:** `abc1234`, `def5678`
- **Files Created:**
  - `src/path/to/newFile.ts` — description
- **Files Modified:**
  - `src/path/to/existing.ts` — what changed
- **Tests Added:**
  - `src/path/to/newFile.test.ts` — N tests
- **Deviations from Plan:** None / description of changes
- **Follow-ups:** None / issues discovered
```

---

## 1. Current State Audit

### How Data-Driven Testing Works Today

The existing **Export Template → Edit → Import** pipeline:

1. User creates a test in Edit Test modal (e.g., `GET .../vehicles/{{vin}}/vehiclePurchaseOffers?channel={{channel}}`)
2. **Export Template** → `CsvTemplateExportModal` → 3-step wizard:
   - Step 1: Select path segments as variables (auto-detects IDs/VINs)
   - Step 2: Name columns (`name`, `path:vin`, `param:channel`, `validate:$.offers[0].offerName`)
   - Step 3: Review & download `.xlsx` with Metadata + Data sheets
3. User opens Excel, fills rows (one per variation), optionally adds expected validation values
4. **Import Template** → `CsvImportModal` → parses Excel/CSV/JSON, creates one `Scenario` per row via `buildScenarioFromRow()`
5. Result: N independent `Scenario` objects in the FeatureGroup tree

### What's Wrong with This Flow

| Issue | Impact |
|---|---|
| **N cloned Scenarios** | 100 data rows = 100 separate test definitions. Each has its own URL, headers, auth, body — all identical except the parameterized parts |
| **No single source of truth** | Changing a header requires editing all 100 clones individually |
| **Round-trip friction** | Export → Excel → edit → save → re-import. Can't edit data inline |
| **No re-run capability** | After import, no link to original template. Can't "re-run with fresh data" |
| **Results are flat** | 100 results mixed in with other tests. No grouping by "these 100 are the same pattern with different data" |
| **No "capture & validate" flow** | User types expected values in Excel cells manually. Can't run once, capture responses, then use as expected values |
| **Validation changes require re-import** | New assertion rules → re-export template, re-fill data, re-import |

### Relevant Code Inventory

| Component | File | Role |
|---|---|---|
| `Scenario` type | `src/shared/types/index.ts` | Test definition — each clone is a full copy |
| `TestScenario` type | `src/shared/types/index.ts` | Groups tests under a named scenario within FeatureGroup |
| `FeatureGroup` type | `src/shared/types/index.ts` | Top-level container, stored in localStorage/Tauri |
| `TestConfig` type | `src/shared/types/index.ts` | Runner config — `scenarioWeights`, `concurrency`, `totalTransactions` |
| `RequestResult` type | `src/shared/types/index.ts` | Per-request result — `scenarioId`, `scenarioName`, `featureGroupName` |
| `TestRun` type | `src/shared/types/index.ts` | Saved run — `config` + `summary` + `results[]` |
| `executor.ts` | `src/engine/executor.ts` | Builds weighted queue from `scenarioWeights`, dispatches to runners |
| `requestExecution.ts` | `src/engine/requestExecution.ts` | `runSequential`, `runBatch`, `runPool` — execute Scenario queue |
| `workflowRunner.ts` | `src/features/workflow/engine/workflowRunner.ts` | Flat chain execution with variable extraction |
| `TestRunner.tsx` | `src/features/test-runner/TestRunner.tsx` | UI — scenario selection, config, progress, results |
| `TestEditorModal.tsx` | `src/features/scenarios/components/TestEditorModal.tsx` | Edit Test dialog — builder, cURL, export/import |
| `CsvTemplateExportModal.tsx` | `src/features/scenarios/components/CsvTemplateExportModal.tsx` | Export Template wizard |
| `CsvImportModal.tsx` | `src/features/scenarios/components/CsvImportModal.tsx` | Import Template — parses files, creates Scenarios |
| `csvTemplateShared.ts` | `src/features/scenarios/utils/csvTemplateShared.ts` | Shared template generation & row parsing |
| `csvTemplateExcel.ts` | `src/features/scenarios/utils/csvTemplateExcel.ts` | Excel generation with styled sheets |
| `csvTemplateTypes.ts` | `src/features/scenarios/utils/csvTemplateTypes.ts` | Column prefixes, metadata types, parse result types |
| `ResultsDashboard.tsx` | `src/features/results/ResultsDashboard.tsx` | Results display — grouping by feature/scenario/test |
| `resultsGrouping.ts` | `src/features/test-runner/utils/resultsGrouping.ts` | `buildGroups()` — groups results by `featureGroupName`/`groupName`/`scenarioName` |
| `storage.ts` | `src/shared/utils/storage.ts` | Persistence — localStorage (browser) + Tauri file store |
| `graphRunner.ts` | `src/features/workflow/engine/graphRunner.ts` | Full graph topology execution (workflows) |
| `graphRunnerNodeHandlers.ts` | `src/features/workflow/engine/graphRunnerNodeHandlers.ts` | Per-node-type handlers, including `handleHttpNode` |
| `HttpNodeData` type | `src/features/workflow/types/workflow.ts` | Workflow HTTP node — wraps a `Scenario` with service/variable bindings |

---

## 2. Competitive Landscape

### How Other Tools Handle Data-Driven Testing

#### JMeter — CSV Data Set Config

- **Model:** A `CSV Data Set Config` element attached to a Thread Group reads one row per thread iteration.
- **Variables:** Each CSV column maps to a JMeter variable (`${vin}`, `${channel}`).
- **Execution:** Thread Group iterations × thread count. Each iteration picks the next row.
- **Sharing modes:** `All threads` (shared file pointer), `Current thread` (each thread reads from start), `Current thread group`.
- **Validation:** Response Assertions per sampler — can reference data file variables in expected values.
- **Key insight:** The data file is external (CSV on disk), referenced by path. The test plan stays clean; data is injected at runtime.

#### Postman — Collection Runner with Data File

- **Model:** Collection Runner accepts a CSV/JSON data file. Each row = one iteration of the entire collection.
- **Variables:** CSV columns become `{{columnName}}` variables available in requests, pre-request scripts, and test scripts.
- **Execution:** N iterations sequentially or with N virtual users (performance mode).
- **Validation:** `pm.test()` scripts can reference `pm.iterationData.get('column')` for per-row assertions.
- **Inline preview:** Before running, shows a preview of how many iterations and which variables will be injected.
- **Key insight:** The data file is uploaded at run time, not stored with the collection. Each run can use a different data file.

#### k6 — SharedArray + CSV

- **Model:** `SharedArray` + `papaparse` in init context loads CSV into memory. Each VU picks a row (e.g., `data[__VU % data.length]`).
- **Variables:** Regular JS variables — no special variable system needed.
- **Validation:** `check()` calls can reference row data for expected values.
- **Key insight:** Data is loaded once and shared across VUs via `SharedArray` (memory-efficient). Row selection strategy is user-defined (round-robin, random, per-VU).

#### Locust — CSV in Python

- **Model:** Load CSV in `on_start()` or as a class attribute. Each user picks rows via queue or iterator.
- **Variables:** Regular Python attributes on `self`.
- **Key insight:** No built-in data-driven support — users write Python code to load and distribute data.

### Competitive Comparison Matrix

| Feature | JMeter | Postman | k6 | Locust | RedfireForge (Current) | RedfireForge (Planned) |
|---|---|---|---|---|---|---|
| Data source support | CSV file | CSV/JSON upload | CSV via SharedArray | Manual Python code | Export/import (disconnected) | Inline table + CSV/Excel/JSON link |
| Variable injection | `${var}` in samplers | `{{var}}` in requests | JS variables | Python `self` attrs | N cloned Scenarios | `{{var}}` in single pattern |
| Per-row validation | Response Assertion + vars | `pm.iterationData.get()` | `check()` + row data | Python assertions | Manual Excel cells | Inline expected values |
| Data stays linked to test | ✅ (file path reference) | ❌ (upload per run) | ✅ (code reference) | ✅ (code reference) | ❌ (lost after import) | ✅ (attached data source) |
| Pattern changes propagate | ✅ (single sampler) | ✅ (single request) | ✅ (single function) | ✅ (single task) | ❌ (edit each clone) | ✅ (single pattern) |
| Inline data editing | ❌ (external CSV) | ❌ (external file) | ❌ (code) | ❌ (code) | ❌ | ✅ (inline table editor) |
| Visual data preview | ❌ | ✅ (iteration preview) | ❌ | ❌ | ❌ | ✅ (table with preview) |
| Capture response as expected | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Run & Capture) |
| Re-run failed rows only | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (selective re-run) |
| Row tags & subset execution | ❌ | ❌ | ❌ (code) | ❌ (code) | ❌ | ✅ (tags + named subsets) |
| Edge case auto-generation | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (column type analysis) |
| Populate from API response | ❌ | ❌ | ❌ (code) | ❌ (code) | ❌ | ✅ (chained capture) |
| Smart paste (Excel/Sheets) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (TSV/HTML auto-detect) |
| Shared data tables | ❌ | ❌ | ✅ (SharedArray) | ❌ | ❌ | ✅ (cross-test reference) |
| Pre-validation dry run | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (smoke + traffic-light) |
| Update validation from failures | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (inline per-row editing) |
| Visual pass/fail batch split | ❌ (flat list) | ❌ (flat list) | ❌ (console) | ❌ (console) | ❌ | ✅ (collapsible batches) |
| Report generation (HTML/PDF) | ✅ (listeners) | ❌ (Newman CLI) | ❌ (--summary-trend) | ❌ (locust web UI) | ❌ | ✅ (HTML/PDF/JSON/MD) |
| Environment-specific data | ❌ (manual CSV) | ❌ (manual upload) | ❌ (code) | ❌ (code) | ❌ | ✅ (env tags/column) |

### Key Insight

JMeter's approach (external CSV file referenced by path) is the most mature. Postman's approach (upload CSV at run time) is the most user-friendly. RedfireForge can combine the best of both — **inline data table for quick edits + CSV/Excel/JSON file link for large datasets** — with visual editing that neither JMeter nor Postman offers. More importantly, the planned features in the bottom 8 rows of the matrix (re-run failed, tags, edge case generation, chained capture, smart paste, shared tables, pre-validation, environment data) are capabilities **no existing tool provides**, making RedfireForge the first data-driven testing tool with truly visual, intelligent data management.

---

## 3. Data Model Design

### 3.1 New Type: `DataTable`

```typescript
// src/shared/types/index.ts

export interface DataTableColumn {
  /** Column identifier used as variable name: e.g. "vin", "channel" */
  name: string;
  /** Where this column binds in the request */
  type: 'path' | 'param' | 'body' | 'header' | 'validate';
  /** For 'path': segment index in URL. For 'param': query param name. For 'validate': JSONPath. */
  mapping: string;
  /** Optional human-readable description */
  description?: string;
}

export interface DataTableRow {
  /** Unique row ID for stable identity across edits */
  id: string;
  /** Column name → value */
  values: Record<string, string>;
  /** Whether this row is enabled (unchecked rows are skipped) */
  enabled: boolean;
  /** User-assigned tags for categorization and filtered execution */
  tags?: string[];
  /** Optional note/annotation for this row */
  note?: string;
}

export type DataSourceType = 'inline' | 'file';

export interface DataTableSource {
  type: DataSourceType;
  /** For 'file': relative or absolute path to CSV/Excel/JSON file */
  filePath?: string;
  /** For 'file': last-read timestamp for staleness detection */
  fileLastRead?: number;
  /** For 'file': row count at last read (for quick display without parsing) */
  fileRowCount?: number;
}

export interface DataTable {
  /** Unique ID */
  id: string;
  /** Column definitions — order matters for display */
  columns: DataTableColumn[];
  /** Data rows (inline source only; file source reads at execution time) */
  rows: DataTableRow[];
  /** Where the data lives */
  source: DataTableSource;
  /** Row distribution strategy during execution */
  distribution: 'sequential' | 'random' | 'round-robin';
  /** Named subsets for filtered execution (Phase 12) */
  subsets?: DataSubset[];
}
```

### 3.2 Extend `Scenario` with Optional DataTable

```typescript
// src/shared/types/index.ts — add to Scenario interface

export interface Scenario {
  // ... existing fields ...
  
  /** Attached data table for parameterized execution */
  dataTable?: DataTable;
}
```

**Design decision:** The data table lives ON the Scenario, not as a separate entity. This keeps the data close to the pattern it parameterizes, avoids cross-reference complexity, and ensures export/import carries the data with it.

### 3.3 Extend `RequestResult` with Data Row Context

```typescript
// src/shared/types/index.ts — add to RequestResult interface

export interface RequestResult {
  // ... existing fields ...
  
  /** Data table row ID that produced this result (for parameterized tests) */
  dataRowId?: string;
  /** Human-readable row label (e.g., "Row 3: VIN=1GY...") for display */
  dataRowLabel?: string;
}
```

### 3.4 Extend `TestConfig` (No Changes Needed)

The existing `TestConfig` already has `scenarioWeights` and `totalTransactions`. When a parameterized test is selected in the runner:
- `totalTransactions` = number of enabled data rows (or data rows × repetitions)
- The executor expands one `Scenario` + N rows into N concrete requests at execution time

No new fields needed on `TestConfig` — the expansion logic lives in the executor.

---

## 4. Implementation Plan

### Phase 1: Data Table Core (Data Model + Storage)

**Priority: Critical | Effort: Small**

#### 4.1 Add Types

Add `DataTable`, `DataTableColumn`, `DataTableRow`, `DataTableSource` to `src/shared/types/index.ts`. Add `dataTable?: DataTable` to `Scenario`. Add `dataRowId?` and `dataRowLabel?` to `RequestResult`.

#### 4.2 Storage Compatibility

No storage migration needed — `dataTable` is optional on `Scenario`. Existing scenarios without it continue to work. Feature Groups are stored as JSON blobs, so new fields are automatically persisted.

**Risk:** Large inline data tables (1000+ rows) may bloat localStorage. Mitigations:
- For browser: already using IndexedDB for test runs; Feature Groups remain in localStorage but data tables > 500 rows should use file source
- For Tauri: file-based storage has no size concern
- UI warning when inline table exceeds 500 rows: "Consider using an external CSV file for large datasets"

#### 4.3 Export/Import Compatibility

Existing JSON export/import (`wrapExport`/`unwrapImport` in `scenarioImportExport.ts`) will naturally carry `dataTable` because it serializes the full `Scenario` object.

---

### Phase 2: Inline Data Table Editor (UI)

**Priority: Critical | Effort: Large**

#### 2.1 DataTableEditor Component

New component: `src/features/scenarios/components/DataTableEditor.tsx`

Accessible from the Edit Test modal as a new tab alongside Params, Auth, Headers, Validation, Extract, History.

```
┌─ Edit Test ──────────────────────────────────────────────────┐
│ Params │ Auth │ Headers │ Validation │ Extract │ Data Table │ │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Source: ◉ Inline  ○ CSV/Excel File                          │
│ Distribution: [Sequential ▼]                                 │
│                                                              │
│ ┌─────────┬──────────┬─────────┬──────────┬────────────────┐ │
│ │ ☑ │ name      │ vin      │ channel  │ validate:$.st… │ │
│ ├───┼───────────┼──────────┼──────────┼────────────────┤ │
│ │ ☑ │ CA-PN-VIN1│ 1GY..338 │ WEBRNW   │ active         │ │
│ │ ☑ │ US-PN-VIN2│ 2GY..445 │ WEBRNW   │ active         │ │
│ │ ☑ │ CA-FL-VIN3│ 3GY..556 │ DEALER   │ pending        │ │
│ │ ☐ │ MX-PN-VIN4│ 4GY..667 │ WEBRNW   │ (skip)         │ │
│ └───┴───────────┴──────────┴──────────┴────────────────┘ │
│                                                              │
│ [+ Add Row] [+ Add Column] [Import CSV] [Paste from Excel]  │
│ [Run Preview: 3 enabled rows → 3 requests]                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Editable cells (click to edit, Tab to move)
- Checkbox per row (enabled/disabled — disabled rows are skipped)
- Add/remove rows and columns
- Column type selector (path / param / body / header / validate)
- Column mapping (auto-detected from URL params and path variables)
- Paste from clipboard (Excel/Google Sheets copy-paste → parsed as TSV)
- Import from CSV/Excel file (reuses existing `parseCsvToScenarios` pipeline)
- Drag to reorder rows
- Row count badge on the Data Table tab
- Search/filter rows (text search across all columns, tag filter)
- Row-level notes (click note icon → add annotation, e.g. "Known slow VIN")

#### 2.2 Smart Clipboard Paste

Paste data from any tabular source — Excel, Google Sheets, Numbers, Notion tables, or even plain TSV/CSV text. The editor auto-detects the format and maps columns intelligently.

**How it works:**
1. User copies rows from Excel / Google Sheets / any table
2. Clicks "Paste from Clipboard" button (or presses Ctrl/Cmd+V when the table is focused)
3. Clipboard content is parsed:
   - TSV (tab-separated) → from Excel/Sheets/Numbers copy
   - CSV (comma-separated) → from text/CSV copy
   - HTML table → from Notion/Confluence/web copy (parse `<table>` tags)
4. Auto-detect if first row is a header (column names) or data
5. Map clipboard columns to existing data table columns by name match
6. Preview: "Pasting 15 rows × 3 columns. 2 columns matched, 1 new column detected."
7. User confirms → rows are appended to the table

```
┌─ Paste Preview ───────────────────────────────────────────────┐
│                                                               │
│ Detected: 15 rows × 4 columns (tab-separated, from Excel)   │
│                                                               │
│ Column Mapping:                                               │
│   Clipboard "VIN"     → Existing column "vin"        ✓       │
│   Clipboard "Channel" → Existing column "channel"    ✓       │
│   Clipboard "Region"  → ⚠ New column (add as param?) [Add]   │
│   Clipboard "Notes"   → ⚠ New column (add as note?)  [Skip]  │
│                                                               │
│ [Cancel]                [Append 15 Rows]  [Replace All Rows]  │
└───────────────────────────────────────────────────────────────┘
```

#### 2.3 Bulk Row Operations

For large data tables (50+ rows), individual editing is tedious. Provide bulk operations:

**Selection:** Click row checkbox to select one; Shift+click for range; Ctrl/Cmd+A for all.

**Bulk actions toolbar** (appears when 2+ rows selected):
```
┌──────────────────────────────────────────────────────────────┐
│ 12 rows selected: [Enable] [Disable] [Delete] [Tag...] [Find & Replace] │
└──────────────────────────────────────────────────────────────┘
```

- **Enable/Disable:** Toggle `enabled` for all selected rows
- **Delete:** Remove selected rows (with undo)
- **Tag:** Add/remove tags on all selected rows
- **Find & Replace:** Find a value in selected rows' cells, replace with another:
  ```
  Find: "WEBRNW"  Replace: "MOBILE"  In column: [All ▼]  [Replace All (8 matches)]
  ```
- **Duplicate:** Clone selected rows (useful for creating variations)
- **Sort:** Sort table by any column (asc/desc)

#### 2.4 Data Table Search & Filter

For tables with 100+ rows, provide a search bar and filter controls:

```
┌─ Search: [webrnw________] │ Filter: [Tag: edge-case ▼] │ Showing: 15 of 100 rows ─┐
```

- **Text search:** Highlights and filters to rows containing the search term in any column
- **Tag filter:** Show only rows with specific tags
- **Status filter** (after pre-validation): Show only 🔴 failed / 🟡 warn / 🟢 pass rows
- **Column filter:** Click column header → filter by distinct values in that column

#### 2.5 Auto-Column Detection

When the user opens the Data Table tab for the first time on a test, auto-detect columns:

1. **Path variables:** Run `analyzeUrlPath()` (existing utility) — segments that look like IDs/VINs become `path:` columns
2. **Query parameters:** Parse URL query string — each `?key=value` becomes a `param:` column
3. **Validation fields:** If test has `expectedFields`, each becomes a `validate:` column

Pre-fill one row with the current test's values.

#### 2.6 URL Pattern Display

Show a live URL pattern above the table:
```
Pattern: GET https://.../{vin}/vehiclePurchaseOffers?channel={channel}&enrollmentType={enrollmentType}
```

Highlight which parts of the URL are parameterized (colored badges matching column headers).

#### 2.7 Tab Integration in TestEditorModal

Add "Data Table" as a new tab in `TestEditorModal.tsx`:

```typescript
// In TestEditorModal.tsx, extend TestEditorTab type
export type TestEditorTab = 'params' | 'auth' | 'headers' | 'validation' | 'extract' | 'history' | 'dataTable';
```

Show a badge count on the tab: `Data Table (100)` showing number of enabled rows.

---

### Phase 3: Execution Engine Expansion

**Priority: Critical | Effort: Medium**

#### 3.1 Data Table Row Expansion in Executor

When `executor.ts` encounters a Scenario with a `dataTable`, expand it into N concrete requests:

```typescript
// src/engine/dataTableExpander.ts — new file

export interface ExpandedScenario {
  scenario: Scenario;      // resolved scenario with variables substituted
  dataRowId: string;        // source row ID
  dataRowLabel: string;     // display label (e.g. "Row 1: VIN=1GY...")
}

export function expandDataTable(
  baseScenario: Scenario,
): ExpandedScenario[] {
  const dt = baseScenario.dataTable;
  if (!dt || dt.rows.length === 0) return [{ scenario: baseScenario, dataRowId: '', dataRowLabel: '' }];

  const enabledRows = dt.rows.filter(r => r.enabled);
  if (enabledRows.length === 0) return [];

  return enabledRows.map((row, idx) => {
    const resolved = resolveScenarioFromDataRow(baseScenario, dt.columns, row);
    return {
      scenario: resolved,
      dataRowId: row.id,
      dataRowLabel: buildRowLabel(row, dt.columns, idx),
    };
  });
}
```

**Resolution logic** (`resolveScenarioFromDataRow`):
- `path:` columns → replace `{{varName}}` in URL path
- `param:` columns → set/override query parameter values
- `body:` columns → replace `{{varName}}` in request body
- `header:` columns → set/override header values
- `validate:` columns → populate `expectedFields` in validation config

#### 3.2 Integrate with Executor Queue Building

In `executor.ts`, modify the queue building logic:

```typescript
// After building the weighted queue, expand data tables
const expandedQueue: Array<{ scenario: Scenario; dataRowId?: string; dataRowLabel?: string }> = [];
for (const scenario of queue) {
  if (scenario.dataTable && scenario.dataTable.rows.length > 0) {
    expandedQueue.push(...expandDataTable(scenario));
  } else {
    expandedQueue.push({ scenario, dataRowId: undefined, dataRowLabel: undefined });
  }
}
```

**Interaction with weights:** When a parameterized test has weight 3 and 10 data rows:
- Weight controls how often this test is picked relative to other tests
- Each pick expands to 10 rows (or sampled if totalTransactions < full expansion)
- Distribution setting controls row order: sequential, random, or round-robin across iterations

#### 3.3 Tag Results with Data Row Context

When creating `RequestResult` in `executeWithRetry`, pass through `dataRowId` and `dataRowLabel`:

```typescript
const result: RequestResult = {
  // ... existing fields ...
  dataRowId: expandedEntry.dataRowId,
  dataRowLabel: expandedEntry.dataRowLabel,
};
```

#### 3.4 File Source Loading

For `source.type === 'file'`, load the file at execution time:

- **Browser:** Use File System Access API or user file picker
- **Tauri:** Read file directly from disk via `fs.readTextFile`
- Parse using existing `parseCsvToScenarios` / `parseExcelToScenarios` / `parseJsonToScenarios`
- Map parsed rows to `DataTableRow[]` using column definitions from the Scenario's `dataTable.columns`

**Staleness detection:** Compare file modification time with `fileLastRead`. If stale, show a warning: "Data file has changed since last load. Reload?"

---

### Phase 4: Runner UI Updates

**Priority: High | Effort: Medium**

#### 4.1 Parameterized Test Indicator in Scenario Tree

In the TestRunner scenario selection tree, show a badge on parameterized tests:

```
☑ Onboarding Scenarios
  ☑ Vehicle Purchase Offers          📊 100 rows
  ☑ Enrollment Status Check           📊 50 rows
  ☑ Simple Health Check               (no data table)
```

The badge shows enabled row count. Clicking it opens a read-only preview of the data table.

#### 4.2 Execution Summary Before Run

When the user clicks "Run Test" and selected tests include parameterized tests, show an expansion summary:

```
Ready to run:
  • Vehicle Purchase Offers × 100 rows = 100 requests
  • Enrollment Status Check × 50 rows = 50 requests
  • Simple Health Check × 1 = 1 request
  ─────────────────────────────────────
  Total: 151 requests at concurrency 10
```

#### 4.3 Progress Enhancements

During execution, group progress by test pattern:

```
Progress: 75 / 151 (49%)

Vehicle Purchase Offers:  50/100 ✓47 ✗3
Enrollment Status Check:  25/50  ✓25
Simple Health Check:       0/1
```

#### 4.4 Weight Interaction

In the weight distribution panel, parameterized tests show their row count:

```
Test Distribution (weights)
  1. Vehicle Purchase Offers (100 rows)  [1]
  2. Enrollment Status Check (50 rows)   [1]  
  3. Simple Health Check                 [1]
```

---

### Phase 5: Results Display Updates

**Priority: High | Effort: Medium**

#### 5.1 New Grouping Level: Data Row

Extend `resultsGrouping.ts` to support a new `GroupByLevel`:

```typescript
export type GroupByLevel = 'feature' | 'group' | 'test' | 'dataRow';
```

When `groupBy` includes `'dataRow'`, group results by `dataRowLabel`:

```
▼ Onboarding (Feature Group)
  ▼ Vehicle Purchase Offers (Scenario)
    ▼ Row 1: VIN=1GY..338, channel=WEBRNW    ✓ 200  150ms
    ▼ Row 2: VIN=2GY..445, channel=WEBRNW    ✓ 200  142ms
    ▼ Row 3: VIN=3GY..556, channel=DEALER    ✗ 404  89ms
```

#### 5.2 Data Row Summary Table with Pass/Fail Visual Distinction

For parameterized tests in results, show a summary table with **clear visual separation between passed and failed batches**. This is critical for large data sets (100+ rows) where scanning a flat list of rows is impractical.

**Default view — Split by outcome:**

```
Vehicle Purchase Offers — 100 rows

┌─ ✗ FAILED (3 rows) ──────────────────────────────────────────┐
│ #  │ Row Label        │ Status │ Time  │ Error               │
│  3 │ VIN=3GY..556     │ 404    │  89ms │ Not Found           │
│ 45 │ VIN=7GY..112     │ 401    │  62ms │ Unauthorized        │
│ 67 │ VIN=8GY..334     │ 500    │ 210ms │ Internal Server Err │
└───────────────────────────────────────────────────────────────┘

┌─ ✓ PASSED (97 rows) ─────────────────────────────────────────┐
│ #  │ Row Label        │ Status │ Time  │                     │
│  1 │ VIN=1GY..338     │ 200    │ 150ms │                     │
│  2 │ VIN=2GY..445     │ 200    │ 142ms │                     │
│ ...│ (95 more rows)   │        │       │                     │
└───────────────────────────────────────────────────────────────┘

Summary: Pass 97/100 (97%)  │  Avg: 148ms  │  P95: 210ms  │  P99: 350ms
```

**Design details:**
- Failed batch is always shown **first** and **expanded** — users care about failures most
- Passed batch is **collapsed by default** (expandable) — prevents visual noise
- Each batch has a colored header bar: 🔴 red for failed, 🟢 green for passed
- If validation is absent (smoke test), add a 🟡 yellow **WARN** batch for 2xx responses without validation
- Batch badges show count: `✗ 3 failed`, `✓ 97 passed`, `⚠ 0 warn`

**View modes** (toggle in toolbar):

| Mode | Description |
|---|---|
| **Split** (default) | Failed-first, then passed, then warn. Each in its own collapsible section. |
| **Flat** | All rows in order, with colored status icon per row |
| **Failures Only** | Only show failed rows (same as current "Failed Only" filter) |
| **Comparison** | Side-by-side diff when re-run results exist (Phase 11) |

**Row detail on click:** Expanding any row shows the full request/response detail:
```
▼ Row 3: VIN=3GY..556, channel=DEALER
  ├─ Request:  GET https://api.example.com/vehicles/3GY..556/offers?channel=DEALER
  ├─ Status:   404 Not Found
  ├─ Time:     89ms
  ├─ Response: { "error": "Vehicle not found", "code": "VIN_INVALID" }
  └─ Validation:
       ✗ $.status expected "active" got (no path — 404 response)
       ✗ $.offers[0].offerName expected "OnStar" got (no path)
```

#### 5.3 Failed Row Quick Filter

Add a filter button: "Show Failed Rows Only" — instantly filters to rows that failed validation or returned error status.

#### 5.4 Export Results with Data Context

When exporting results as CSV/JSON, include `dataRowId`, `dataRowLabel`, and the original data row values alongside the response metrics. This enables external analysis of which data combinations cause failures.

#### 5.5 Result Report Generation

After a parameterized test completes, offer an optional **"Generate Report"** button that produces a self-contained report the user can share, archive, or attach to tickets.

**Trigger:** "Generate Report" button in the results toolbar (next to "Export CSV" and "Compare Runs").

**Report formats:**

| Format | Best For | Content |
|---|---|---|
| **HTML** (default) | Sharing via email/Slack, opening in browser | Styled, interactive (collapsible sections, charts) |
| **PDF** | Archiving, attaching to Jira/ServiceNow tickets | Print-ready, static |
| **JSON** | CI/CD pipelines, programmatic consumption | Machine-readable, full detail |
| **Markdown** | Git commit messages, PR descriptions | Lightweight text summary |

**HTML report contents:**

```
┌─ RedfireForge Test Report ────────────────────────────────────┐
│                                                               │
│ Test: Vehicle Purchase Offers (parameterized, 100 rows)      │
│ Date: 2026-05-01 14:32:15                                    │
│ Environment: staging / VehicleService                        │
│ Duration: 12.4s  │  Concurrency: 10  │  Mode: batch          │
│                                                               │
│ ═══════════════════════════════════════════════════════════   │
│ SUMMARY                                                       │
│   ✓ 97 passed  ✗ 3 failed  ⚠ 0 warn                         │
│   Pass rate: 97%                                              │
│   Avg: 148ms  P50: 140ms  P95: 210ms  P99: 350ms            │
│                                                               │
│ [Pass/Fail Pie Chart]  [Response Time Distribution Chart]     │
│                                                               │
│ ═══════════════════════════════════════════════════════════   │
│ FAILED ROWS (3)                                               │
│ ┌────┬──────────────┬────────┬────────┬─────────────────────┐ │
│ │ #  │ Row Label    │ Status │ Time   │ Error               │ │
│ ├────┼──────────────┼────────┼────────┼─────────────────────┤ │
│ │  3 │ VIN=3GY..556 │ 404    │  89ms  │ Not Found           │ │
│ │ 45 │ VIN=7GY..112 │ 401    │  62ms  │ Unauthorized        │ │
│ │ 67 │ VIN=8GY..334 │ 500    │ 210ms  │ Internal Server Err │ │
│ └────┴──────────────┴────────┴────────┴─────────────────────┘ │
│                                                               │
│ For each failed row: request URL, response body snippet,     │
│ validation diff (expected vs actual)                          │
│                                                               │
│ ═══════════════════════════════════════════════════════════   │
│ PASSED ROWS (97) — collapsed table, expandable                │
│                                                               │
│ ═══════════════════════════════════════════════════════════   │
│ PERFORMANCE                                                   │
│ [Response Time Over Time chart — from LiveCharts timeSeries] │
│ [Percentile Distribution chart]                               │
│                                                               │
│ ═══════════════════════════════════════════════════════════   │
│ DATA TABLE SNAPSHOT                                           │
│ Full data table included (all rows, with tags)               │
│                                                               │
│ Footer: Generated by RedfireForge v0.5.6                     │
└───────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// src/features/results/utils/reportGenerator.ts

export interface ReportOptions {
  format: 'html' | 'pdf' | 'json' | 'markdown';
  includePassedRows: boolean;       // default: true (collapsed)
  includeCharts: boolean;           // default: true (HTML/PDF only)
  includeDataTableSnapshot: boolean; // default: true
  includeResponseBodies: boolean;    // default: false (can be large)
  title?: string;                   // custom report title
}

export function generateReport(
  testRun: TestRun,
  scenarios: Scenario[],
  options: ReportOptions,
): string | Blob { ... }
```

- **HTML:** Built from a template with inline CSS (no external dependencies). Charts rendered as inline SVG. Self-contained single `.html` file.
- **PDF:** Generated from the HTML report via `window.print()` (browser) or a lightweight PDF library (Tauri). No server needed.
- **JSON:** Structured output matching the CI/CD format from Phase 9.2, plus full row-level detail.
- **Markdown:** Summary table + failed row list. Ideal for pasting into PR descriptions or Slack.

**Auto-report option:** In runner config, users can check "Auto-generate report after run" → report is saved to a default location immediately when the test finishes. Useful for scheduled/CI runs.

**Report for non-parameterized tests:** The report generator works for all test types, not just parameterized. For regular tests, it shows the standard summary without the data row split.

---

### Phase 6: Workflow Integration

**Priority: Medium | Effort: Medium**

#### 6.1 Data Table on Workflow HTTP Nodes

Extend `HttpNodeData` in workflow types:

```typescript
export interface HttpNodeData {
  // ... existing fields ...
  
  /** Optional data table for parameterized execution of this HTTP node. */
  dataTable?: DataTable;
}
```

When an HTTP node in a workflow has a data table, the graph runner should:
- **Single run (Quick Test):** Execute the node once per enabled data row, collecting results for each
- **Load test (Harness):** Each workflow iteration picks one row (round-robin or random)

#### 6.2 Loop Node + Data Table Integration

The existing Loop node (type: `forEach`) already supports iterating over arrays. A natural integration:

```
[Start] → [Loop (forEach: dataRows)] → [HTTP Node (uses {{item.vin}}, {{item.channel}})] → [End]
```

When a Loop node's `sourceExpression` references a data table, the graph runner injects data rows as the iterable collection. Each iteration sets `{{item.vin}}`, `{{item.channel}}`, etc. from the current row.

This requires no new node types — just the ability for Loop nodes to reference a data table as their source.

#### 6.3 Data Table as Workflow Variable Source

Add support for data tables at the workflow level (not just per-node):

```typescript
export interface Workflow {
  // ... existing fields ...
  
  /** Workflow-level data tables — accessible to all nodes via variables. */
  dataTables?: DataTable[];
}
```

**Use case:** A workflow that tests user registration → login → profile update, with 100 different user/password combinations. The data table feeds variables into the workflow's `VariableContext`, and each HTTP node references `{{username}}`, `{{password}}`.

---

### Phase 7: File Source Management (CSV / Excel / JSON)

**Priority: Medium | Effort: Small**

All three file formats are first-class citizens — CSV (`.csv`), Excel (`.xlsx`), and JSON (`.json`). The existing parsing pipelines (`csvTemplateCsv.ts`, `csvTemplateExcel.ts`, `csvTemplateJson.ts`) are reused and extended for data-table file sources. Both import and export support all three formats, so users can choose whichever their workflow prefers.

| Format | Parser (existing) | Generator (existing) | Notes |
|---|---|---|---|
| CSV | `parseCsvToScenarios` | `generateCsvTemplate` | Simplest; universal tool support |
| Excel (.xlsx) | `parseExcelToScenarios` | `generateExcelTemplate` | Styled sheets, metadata tab, column-type prefixes |
| JSON | `parseJsonToScenarios` | `generateJsonTemplate` | Best for CI/CD pipelines, programmatic generation |

#### 7.1 File Picker in Data Table Editor

When `source.type === 'file'`:

```
┌─ Data Source ─────────────────────────────────────────┐
│ Source: ○ Inline  ◉ CSV/Excel File                   │
│                                                       │
│ File: /Users/team/test-data/vehicles.xlsx  [Browse]   │
│ Last read: 2 hours ago (100 rows)     [Reload]        │
│ Status: ✓ File accessible                             │
│                                                       │
│ Column Mapping:                                       │
│   Column A "VIN"     → path:vin           ✓           │
│   Column B "Channel" → param:channel      ✓           │
│   Column C "Country" → param:country      ✓           │
│   Column D "Expected"→ validate:$.status  ✓           │
│                                                       │
│ Preview (first 5 rows):                               │
│ ┌──────────┬──────────┬─────────┬──────────┐          │
│ │ vin      │ channel  │ country │ expected │          │
│ ├──────────┼──────────┼─────────┼──────────┤          │
│ │ 1GY..338 │ WEBRNW   │ CA      │ active   │          │
│ │ 2GY..445 │ WEBRNW   │ US      │ active   │          │
│ │ ...      │          │         │          │          │
│ └──────────┴──────────┴─────────┴──────────┘          │
└───────────────────────────────────────────────────────┘
```

#### 7.2 Column Auto-Mapping

When a file is loaded, auto-map file columns to test parameters:

1. Exact name match: file column "channel" → `param:channel`
2. Prefix match: file column "path:vin" → `path:vin` (uses existing Export Template column naming)
3. Unmatched columns → prompt user to map or ignore

#### 7.3 File Watch (Tauri Only)

In Tauri mode, optionally watch the data file for changes:
- When the file changes, show a notification: "Data file updated — 5 new rows. Reload?"
- Auto-reload if user has opted in

---

### Phase 8: Capture & Validate Flow

**Priority: Medium | Effort: Medium**

#### 8.1 "Run & Capture" Mode

Add a button to the Data Table editor: **"Run & Capture"**

This executes all enabled rows once (sequentially, concurrency 1), captures each response, and auto-populates validation columns:

```
Before Capture:
│ vin      │ channel │ validate:$.status │ validate:$.offers[0].name │
│ 1GY..338 │ WEBRNW  │ (empty)           │ (empty)                    │

After Capture:
│ vin      │ channel │ validate:$.status │ validate:$.offers[0].name │
│ 1GY..338 │ WEBRNW  │ active            │ OnStar One - Trial         │
```

The user reviews captured values, edits any that should be different, then saves. Future runs validate against these captured baselines.

#### 8.2 Diff on Re-Run

When a parameterized test has captured expected values and is re-run, show a diff for failed rows:

```
Row 3: VIN=3GY..556
  $.status:          expected "active"    got "suspended"
  $.offers[0].name:  expected "OnStar…"  got "Basic Plan"
```

This gives immediate regression visibility: "Row 3 changed from active to suspended."

#### 8.3 Pre-Validation Mode ("Dry Run")

Distinct from "Run & Capture" (which captures responses as baselines), **Pre-Validation** runs all data rows against the real API to verify the data itself is correct before committing to a full performance or regression test. This is especially useful for bulk sample data that may contain stale IDs, invalid formats, or revoked credentials.

**Trigger:** "Pre-Validate Data" button in the Data Table editor toolbar (next to "Run & Capture").

**Execution:**
- Runs all enabled rows sequentially (concurrency 1) to avoid overwhelming the API
- Each row gets a traffic-light status icon in the table:
  - 🟢 **Pass:** HTTP 2xx and all validations passed (if validations exist)
  - 🟡 **Warn:** HTTP 2xx but no validations defined — response received, correctness unknown
  - 🔴 **Fail:** HTTP 4xx/5xx or validation failed

**Behavior when validation is absent:**
- If no `validate:` columns exist, pre-validation acts as a **smoke test** — it confirms each row produces a successful HTTP response (2xx) but cannot verify response content. Rows get 🟡 (warn) instead of 🟢 (pass) to signal that correctness was not fully verified.
- Users can add `validate:` columns at any time, or use "Run & Capture" first to auto-populate them, then re-run pre-validation.

**Results display:**
```
Pre-Validation Results — 100 rows
  🟢 85 passed  │  🟡 10 warn (no validation)  │  🔴 5 failed
  
  Failed rows:
    Row 12: VIN=4GY..778 → 404 Not Found (VIN may be invalid)
    Row 45: VIN=7GY..112 → 401 Unauthorized (token expired?)
    Row 67: VIN=8GY..334 → 422 Unprocessable (channel="INVALID")
    Row 88: VIN=9GY..556 → 500 Internal Server Error
    Row 91: VIN=9GY..889 → timeout after 10s
```

**Post-validation actions:**
- ☐ Disable failed rows (uncheck them so they're skipped in the actual test run)
- ☐ Remove failed rows from the data table
- ☐ Export failed rows to CSV for external review
- ☐ Fix and re-validate (edit values inline, then re-run pre-validation on failed rows only)
- ☐ **Update validation rules per row** (see 8.4 below)

#### 8.4 Inline Validation Rule Editing from Pre-Validation Results

When pre-validation reveals failures, users often need to **adjust the expected values** — the data was correct, but the expectation was wrong (e.g., a product's price changed, a user's status was updated). Instead of navigating back to the data table, editing blind, and re-running, the user can fix validation rules **directly from the pre-validation results panel**.

**How it works:**

For each failed row, show the validation diff with an **"Update Expected"** action:

```
┌─ Pre-Validation: Row 3 — VIN=3GY..556 ──────────────────────┐
│                                                               │
│ ✗ validate:$.status                                          │
│   Expected: "active"                                         │
│   Actual:   "suspended"                                      │
│   [Update to "suspended"]  [Ignore]  [Remove validation]     │
│                                                               │
│ ✗ validate:$.offers[0].offerName                             │
│   Expected: "OnStar One - Trial"                             │
│   Actual:   "Basic Plan"                                     │
│   [Update to "Basic Plan"]  [Ignore]  [Remove validation]    │
│                                                               │
│ ✓ validate:$.offers.length                                   │
│   Expected: ≥ 1    Actual: 3    ✓                            │
│                                                               │
│ Actions for this row:                                         │
│   [Accept All Changes]  [Skip Row]  [Edit Row Data...]       │
└───────────────────────────────────────────────────────────────┘
```

**Action buttons per failed assertion:**

| Action | Effect |
|---|---|
| **Update to "..."** | Overwrites the `validate:` column value in the data table with the actual response value. The row now expects the new value. |
| **Ignore** | Keeps the old expected value — the failure will persist on next run (intentional: tracks a known regression). |
| **Remove validation** | Deletes this `validate:` column for this row only — reverts to smoke test (HTTP status only) for this assertion. |
| **Edit manually** | Opens an inline text input to type a custom expected value (e.g., regex pattern, numeric range). |

**Bulk actions across rows:**

```
12 rows failed on validate:$.status
  8 expected "active", got "suspended"
  4 expected "active", got "expired"

  [Update all 8 to "suspended"]  [Update all 4 to "expired"]
  [Update all 12 to match actual]  [Remove validation for all]
```

This groups identical failure patterns and lets users batch-update, rather than clicking through 12 rows one by one.

**Workflow:**
1. Run pre-validation → see failures
2. Click "Update to ..." on assertions that reflect legitimate data changes
3. Click "Ignore" on assertions that are genuine regressions (keep tracking them)
4. Data table is updated in-place — no need to close, edit, and re-run
5. Click "Re-validate Updated Rows" → only the modified rows are re-tested
6. All pass → ready for full test run

**Key difference from "Run & Capture":**
| Aspect | Run & Capture | Pre-Validate |
|---|---|---|
| Purpose | Capture responses as baseline expected values | Verify data rows produce valid responses |
| Writes to table? | ✅ Populates `validate:` columns | ❌ Only adds status icons (non-destructive) |
| When to use | Before first regression run | Before any run with new/untrusted data |
| Validation columns required? | No (captures them) | No (smoke-tests without them) |

---

### Phase 9: CLI Support

**Priority: Low | Effort: Small**

#### 9.1 CLI Data Table Execution

The CLI (`cli/index.ts`) should support:

```bash
redfireforge run --scenario "Vehicle Purchase Offers" --data ./vehicles.csv
```

- `--data` overrides the inline data table with an external file
- Results are output with `dataRowLabel` in the report
- Exit code is non-zero if any row fails

#### 9.2 CI/CD Integration

Output format compatible with CI/CD report parsers:

```json
{
  "pattern": "Vehicle Purchase Offers",
  "totalRows": 100,
  "passedRows": 97,
  "failedRows": 3,
  "failedRowDetails": [
    { "row": 3, "label": "VIN=3GY..556", "error": "404 Not Found" },
    ...
  ]
}
```

---

### Phase 10: Gallery Samples & Training Manuals

**Priority: Medium | Effort: Medium**

Following the established gallery sample pattern (12 request samples, 8 catalog specs, 8 test samples, 5 workflow samples), create parameterized test gallery samples and accompanying training manuals — all using **real public APIs** so they work out-of-the-box without any setup.

#### 10.1 Gallery Samples for Parameterized Tests

Add new entries to `testSampleCatalog` (or a new `parameterizedTestCatalog`) with pre-populated `DataTable` objects. Each sample demonstrates a different data-driven pattern at increasing difficulty:

| Sample | Difficulty | API | Data Table Pattern | Rows |
|---|---|---|---|---|
| **User Lookup Sweep** | Easy | JSONPlaceholder `/users/{{id}}` | `path:id` with IDs 1–10 | 10 |
| **Product Search Matrix** | Easy | DummyJSON `/products/search?q={{query}}` | `param:query` with ["phone", "laptop", "watch", "shoes", "perfume"] | 5 |
| **Country Validation Suite** | Medium | REST Countries `/v3.1/name/{{name}}` | `path:name` + `validate:$[0].capital[0]` with known countries + expected capitals | 8 |
| **Pokémon Contract Sweep** | Medium | PokéAPI `/api/v2/pokemon/{{name}}` | `path:name` + `validate:$.types[0].type.name` with 10 Pokémon + expected primary types | 10 |
| **Multi-Endpoint Regression** | Advanced | DummyJSON (products, users, carts, auth) | Mixed `path:` + `param:` + `validate:` across 4 URL patterns, 20 total rows | 20 |
| **Auth Token Rotation** | Advanced | DummyJSON `/auth/login` | `body:username` + `body:password` with 5 test users + `validate:$.accessToken` (regex: non-empty) | 5 |

**Factory pattern** (follows existing convention):

```typescript
// src/data/galleries/tests/presets/parameterized.ts

export function createUserLookupSweepTest(): FeatureGroup {
  return {
    id: 'test-param-user-sweep',
    name: 'User Lookup Sweep',
    scenarios: [{
      id: 'sc-user-sweep',
      name: 'Sweep User IDs 1–10',
      tests: [{
        id: 'req-user-sweep',
        name: 'GET /users/{{id}}',
        url: 'https://jsonplaceholder.typicode.com/users/{{id}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: {
          mode: 'full',
          assertions: [{ type: 'status', expected: '200' }],
        },
        dataTable: {
          id: 'dt-user-sweep',
          columns: [
            { name: 'id', type: 'path', mapping: 'id', description: 'User ID' },
            { name: 'expectedName', type: 'validate', mapping: '$.name', description: 'Expected user name' },
          ],
          rows: [
            { id: 'r1', values: { id: '1', expectedName: 'Leanne Graham' }, enabled: true },
            { id: 'r2', values: { id: '2', expectedName: 'Ervin Howell' }, enabled: true },
            // ... rows 3-10 with real JSONPlaceholder user names
          ],
          source: { type: 'inline' },
          distribution: 'sequential',
        },
      }],
    }],
  };
}
```

**Gallery catalog entry:**

```typescript
{
  id: 'test-param-user-sweep',
  domain: 'tests',
  name: 'User Lookup Sweep',
  description: 'Parameterized GET across 10 JSONPlaceholder users — data-driven with expected names',
  icon: '📊',
  category: 'regression',
  difficulty: 'easy',
  tags: ['parameterized', 'data-driven', 'users', 'jsonplaceholder', 'data-table'],
  liveApis: ['jsonplaceholder.typicode.com'],
  scenarioCount: 1,     // 1 scenario, but 10 data rows
  dataRowCount: 10,      // new field: badge shows "📊 10 rows"
  assertionTypes: ['status', 'regex'],
  factory: createUserLookupSweepTest,
}
```

#### 10.2 Public APIs Used

Consistent with existing gallery samples, all parameterized test samples use real, free, no-auth-required public APIs:

| API | Base URL | Why It Works for Data-Driven Testing |
|---|---|---|
| **JSONPlaceholder** | `jsonplaceholder.typicode.com` | Predictable data (10 users, 100 posts) — perfect for sweep tests |
| **DummyJSON** | `dummyjson.com` | Rich search/filter/auth endpoints — good for param:query variations |
| **PokéAPI** | `pokeapi.co` | Deeply nested responses — ideal for validate:jsonPath patterns |
| **REST Countries** | `restcountries.com` | Stable reference data — capitals, populations won't change |
| **Dog CEO** | `dog.ceo` | Random results — good for smoke test (no validation, just 2xx check) |
| **Open Library** | `openlibrary.org` | Large search results — tests pagination with data variations |

#### 10.3 Training Manuals

Create training manuals following `docs/training-manuals/CONVENTIONS.md` naming:

| Manual | Difficulty | Folder | Content |
|---|---|---|---|
| `parameterized-basics-easy.html` | Easy | `data-driven/` | Introduction to data tables: create a 3-row table, run, view grouped results |
| `parameterized-file-import-easy.html` | Easy | `data-driven/` | Import CSV/Excel/JSON file as data source |
| `parameterized-validation-medium.html` | Medium | `data-driven/` | Add validation columns, run & capture baselines, detect regressions |
| `parameterized-pre-validate-medium.html` | Medium | `data-driven/` | Pre-validate bulk data against real API before running full test |
| `parameterized-workflow-advanced.html` | Advanced | `data-driven/` | Attach data table to workflow HTTP nodes, loop over data rows |
| `parameterized-batch-template-advanced.html` | Advanced | `data-driven/` | Export/import batch templates, merge N clones into parameterized test |

Each training manual:
- Uses a gallery sample as its starting point (e.g., "Load the 'User Lookup Sweep' sample from Gallery")
- Has step-by-step screenshots (placeholder references)
- Ends with a "Try It Yourself" section using a different public API
- Links to related training manuals (e.g., validation manual → pre-validate manual)

#### 10.4 Sample Data Files

Ship sample data files in `test-data/` for use with file source mode:

| File | Format | Rows | API | Purpose |
|---|---|---|---|---|
| `sample_users_10.csv` | CSV | 10 | JSONPlaceholder | Basic sweep — user IDs 1–10 with expected names |
| `sample_products_20.xlsx` | Excel | 20 | DummyJSON | Product search queries with expected result counts |
| `sample_countries_8.json` | JSON | 8 | REST Countries | Country names with expected capitals and populations |
| `sample_pokemon_mixed.csv` | CSV | 15 | PokéAPI | Pokémon names with expected types (5 correct, 5 wrong, 5 missing) — for pre-validation demo |

---

### Phase 11: Re-run Failed Rows

**Priority: High | Effort: Small**

No competitor offers this. After running a 1000-row parameterized test, users shouldn't have to re-run all 1000 to retest the 12 that failed. This is a massive time saver for large data-driven suites.

#### 11.1 "Re-run Failed" Button

After a parameterized test completes, the results view shows:

```
Vehicle Purchase Offers — 1000 rows
  ✓ 988 passed  ✗ 12 failed
  
  [Re-run Failed (12)]  [Re-run All (1000)]  [Export Failed to CSV]
```

**"Re-run Failed"** creates a temporary execution scope:
- Filters the data table to only the failed `dataRowId` values
- Runs those rows with the same config (concurrency, auth, headers)
- Merges results back: the 12 re-run results replace the originals in the saved `TestRun`
- Shows a mini-summary: "Re-run: 10/12 now passing, 2 still failing"

#### 11.2 Selective Row Re-run

Beyond "all failed," users can cherry-pick specific rows to re-run:

```
☑ Row 12: VIN=4GY..778 → 404 (re-run)
☐ Row 45: VIN=7GY..112 → 401 (skip)
☑ Row 67: VIN=8GY..334 → 422 (re-run)
                          [Re-run Selected (2)]
```

#### 11.3 Implementation

```typescript
// Extension to executor — reRunDataRows()
export function buildRerunQueue(
  baseScenario: Scenario,
  failedRowIds: string[],
): ExpandedScenario[] {
  const dt = baseScenario.dataTable;
  if (!dt) return [];
  const failedRows = dt.rows.filter(r => failedRowIds.includes(r.id));
  return failedRows.map((row, idx) => ({
    scenario: resolveScenarioFromDataRow(baseScenario, dt.columns, row),
    dataRowId: row.id,
    dataRowLabel: buildRowLabel(row, dt.columns, idx),
  }));
}
```

#### 11.4 Result Merging

When re-run results come back, merge into the existing `TestRun`:
- Match by `dataRowId`
- Replace the old result with the new one
- Recalculate summary stats (pass rate, avg time, percentiles)
- Mark replaced results as `rerun: true` for audit trail

---

### Phase 12: Row Tags & Data Subsets

**Priority: Medium | Effort: Medium**

Tags turn a flat data table into a categorized test matrix. Users can tag rows, then run only specific subsets — "run all edge cases," "run only US region," "run happy-path only."

#### 12.1 Row Tags

Each `DataTableRow` gets an optional `tags` field:

```typescript
export interface DataTableRow {
  id: string;
  values: Record<string, string>;
  enabled: boolean;
  /** User-assigned tags for categorization and filtered execution */
  tags?: string[];
  /** Optional note/annotation for this row */
  note?: string;
}
```

#### 12.2 Tag UI in Data Table Editor

```
┌───┬──────────┬──────────┬─────────┬──────────┬───────────────────┐
│ ☑ │ vin      │ channel  │ country │ Tags     │ Note              │
├───┼──────────┼──────────┼─────────┼──────────┼───────────────────┤
│ ☑ │ 1GY..338 │ WEBRNW   │ CA      │ 🏷 happy │                   │
│ ☑ │ 2GY..445 │ WEBRNW   │ US      │ 🏷 happy │                   │
│ ☑ │ 3GY..556 │ DEALER   │ MX      │ 🏷 edge  │ Dealer channel    │
│ ☑ │ (empty)  │ WEBRNW   │ CA      │ 🏷 neg   │ Missing VIN       │
│ ☑ │ INVALID  │ INVALID  │ XX      │ 🏷 neg   │ All invalid       │
└───┴──────────┴──────────┴─────────┴──────────┴───────────────────┘
Filter by tag: [All ▼]  [happy-path]  [edge-case]  [negative]
```

**Built-in tag suggestions:** `happy-path`, `edge-case`, `negative`, `boundary`, `regression`, `smoke`
**Custom tags:** Users can create any tag (free-text input with autocomplete from existing tags)

#### 12.3 Named Data Subsets

Beyond ad-hoc tag filtering, users can save **named subsets** — pre-defined row selections for repeated use:

```typescript
export interface DataSubset {
  /** Unique name: e.g. "US Region Only", "Edge Cases" */
  name: string;
  /** Filter rule — either tag-based or explicit row IDs */
  filter: { type: 'tags'; tags: string[]; mode: 'any' | 'all' }
        | { type: 'rows'; rowIds: string[] };
}

export interface DataTable {
  // ... existing fields ...
  /** Named subsets for filtered execution */
  subsets?: DataSubset[];
}
```

#### 12.4 Runner Integration

In the TestRunner, when a parameterized test is selected, show a subset dropdown:

```
☑ Vehicle Purchase Offers  📊 100 rows
  Run subset: [All rows (100) ▼]
               All rows (100)
               ── Saved Subsets ──
               US Region Only (42)
               Edge Cases (15)
               Previously Failed (3)
               ── By Tag ──
               happy-path (60)
               edge-case (15)
               negative (10)
               boundary (8)
               untagged (7)
```

This lets users do targeted regression passes without editing the data table.

---

### Phase 13: Edge Case Auto-Generation

**Priority: Medium | Effort: Medium**

This is a unique differentiator — no competitor offers it. Given a column's data type and sample values, auto-generate boundary/negative/edge-case rows to catch what manual data misses.

#### 13.1 Column Type Inference

When a user creates or imports a data table, infer column types from existing values:

| Inferred Type | Detection | Example Values |
|---|---|---|
| `integer` | All values match `^\d+$` | `1`, `42`, `100` |
| `string-id` | Alphanumeric, fixed pattern | `VIN1234`, `USR-001` |
| `email` | Contains `@` | `user@example.com` |
| `enum` | ≤10 distinct values across all rows | `WEBRNW`, `DEALER`, `MOBILE` |
| `country-code` | 2-letter ISO codes | `US`, `CA`, `MX` |
| `url` | Starts with `http` | `https://example.com` |
| `date` | ISO date pattern | `2026-01-15` |
| `numeric` | Decimal numbers | `19.99`, `0.5` |
| `boolean` | `true`/`false`/`0`/`1` | `true`, `false` |
| `freetext` | Fallback | Anything else |

#### 13.2 Edge Case Suggestions

Based on inferred type, suggest edge case rows:

```
┌─ Auto-Generate Edge Cases ────────────────────────────────────┐
│                                                               │
│ Analyzing 3 columns across 10 rows...                        │
│                                                               │
│ Column "id" (integer, range: 1–10):                          │
│   ☑ Boundary: 0 (below min)                                 │
│   ☑ Boundary: 11 (above max)                                │
│   ☑ Negative: -1                                             │
│   ☑ Large: 999999999                                         │
│   ☑ Empty string                                             │
│   ☐ Non-numeric: "abc"                                       │
│                                                               │
│ Column "channel" (enum: WEBRNW, DEALER, MOBILE):             │
│   ☑ Unknown value: "UNKNOWN"                                 │
│   ☑ Empty string                                             │
│   ☑ Case variation: "webrnw" (lowercase)                     │
│   ☐ Special chars: "WEB<script>RNW"                          │
│                                                               │
│ Column "country" (country-code: US, CA, MX):                 │
│   ☑ Invalid code: "XX"                                       │
│   ☑ Empty string                                             │
│   ☑ Numeric: "99"                                            │
│   ☑ 3-letter: "USA" (wrong format)                           │
│                                                               │
│ Will add: 12 edge case rows (tagged "auto-edge")             │
│ [Cancel]                        [Add Selected Rows]           │
└───────────────────────────────────────────────────────────────┘
```

**Key behavior:**
- Auto-generated rows are tagged `auto-edge` for easy filtering
- Users check/uncheck which suggestions to include
- Suggestions are contextual — numeric columns get boundary tests, enums get unknown-value tests, string IDs get format-violation tests
- Security-oriented suggestions (SQL injection, XSS patterns) are available under an "Advanced" toggle
- Rows are added to the existing data table, not replacing anything

#### 13.3 Implementation

```typescript
// src/features/scenarios/utils/edgeCaseGenerator.ts

export interface EdgeCaseSuggestion {
  label: string;           // "Boundary: 0 (below min)"
  category: 'boundary' | 'negative' | 'empty' | 'format' | 'security';
  values: Record<string, string>;  // column → generated value
  defaultEnabled: boolean;
}

export function inferColumnType(values: string[]): ColumnInferredType { ... }

export function generateEdgeCases(
  columns: DataTableColumn[],
  existingRows: DataTableRow[],
): EdgeCaseSuggestion[] { ... }
```

#### 13.4 Competitive Advantage

| Tool | Edge Case Generation |
|---|---|
| JMeter | ❌ Manual only |
| Postman | ❌ Manual only |
| k6 | ❌ Write code |
| Locust | ❌ Write code |
| Katalon | ❌ Manual only |
| **RedfireForge** | ✅ Auto-suggest from column analysis |

---

### Phase 14: Chained Data Capture (API Response → Data Table)

**Priority: Medium | Effort: Medium**

Use one API's response as the data source for another test — a common real-world pattern. "Fetch all users, then test each user's profile endpoint."

#### 14.1 Concept

```
Step 1: GET https://jsonplaceholder.typicode.com/users
        → Response: [{ id: 1, name: "Leanne" }, { id: 2, name: "Ervin" }, ...]

Step 2: Auto-populate data table from response array:
        ┌────┬──────────────────┐
        │ id │ name             │
        ├────┼──────────────────┤
        │ 1  │ Leanne Graham    │
        │ 2  │ Ervin Howell     │
        │ 3  │ Clementine Bauch │
        │ ...│                  │
        └────┴──────────────────┘

Step 3: Run parameterized test: GET /users/{{id}} with validate:$.name = {{name}}
```

#### 14.2 "Populate from API" Button

In the Data Table editor, add a button: **"Populate from API Response"**

```
┌─ Populate from API ───────────────────────────────────────────┐
│                                                               │
│ Source: ○ Send a request now                                  │
│         ◉ Use last response from this test                   │
│         ○ Use response from another test: [Select... ▼]      │
│                                                               │
│ Response JSONPath for array: [$.data ▼]                      │
│   Detected arrays: $ (root, 10 items), $.data (if nested)   │
│                                                               │
│ Map response fields to columns:                               │
│   $.id       → path:id          ✓                            │
│   $.name     → validate:name    ✓                            │
│   $.email    → (ignore)         ☐                            │
│   $.phone    → (ignore)         ☐                            │
│                                                               │
│ Preview: 10 rows will be added                               │
│ [Cancel]                          [Populate Table]            │
└───────────────────────────────────────────────────────────────┘
```

#### 14.3 Use Cases

| Pattern | Source API | Data Table Test |
|---|---|---|
| User sweep | `GET /users` → array of user objects | `GET /users/{{id}}` with validation |
| Product catalog | `GET /products` → product list | `GET /products/{{id}}` verify each |
| Search verification | `GET /search?q=phone` → results | `GET /products/{{id}}` for each result |
| Auth token rotation | `GET /users` → user list | `POST /auth/login` with each user's credentials |

#### 14.4 Workflow Integration

In workflows, this maps naturally to the existing variable extraction flow:
1. HTTP Node A fetches a list → extracts array to variable `{{users}}`
2. Loop Node iterates over `{{users}}`
3. HTTP Node B uses `{{item.id}}` from the current iteration

The "Populate from API" feature brings this same power to standalone (non-workflow) parameterized tests.

---

## 5. Interaction with Existing Features

### 5.1 Export / Import Batch Template (Enhanced)

The existing Export Template → Edit → Import flow is preserved and enhanced to bridge with the new DataTable concept. The same `CsvTemplateExportModal` and `CsvImportModal` components are extended — not replaced.

#### Export Enhancements

| Scenario | Current Behavior | Enhanced Behavior |
|---|---|---|
| Test **without** DataTable | Exports a template with 1 sample row | Same (no change) |
| Test **with** DataTable (inline) | N/A (new) | Exports pattern + all data rows as a batch template. Metadata sheet stores column type mappings. Data sheet contains all enabled rows. |
| Test **with** DataTable (file source) | N/A (new) | Exports pattern + metadata only (no data rows). Metadata sheet includes `fileSource: /path/to/file.csv` reference. |

Export format selection:

```
┌─ Export Batch Template ───────────────────────────────────────┐
│                                                               │
│ Format: ◉ Excel (.xlsx)  ○ CSV (.csv)  ○ JSON (.json)       │
│                                                               │
│ Content:                                                      │
│   ☑ Include data rows (100 rows)                             │
│   ☑ Include metadata (column mappings, URL pattern)          │
│   ☐ Include validation columns                               │
│                                                               │
│ Preview:                                                      │
│   Sheet 1 "Metadata": URL pattern, method, headers, auth     │
│   Sheet 2 "Data": 100 rows × 4 columns                      │
│                                                               │
│ [Cancel]                                   [Export]           │
└───────────────────────────────────────────────────────────────┘
```

#### Import Enhancements

When importing a template file, the import modal detects whether it's a batch template (has metadata + multiple data rows) and offers two import modes:

```
┌─ Import Template ─────────────────────────────────────────────┐
│                                                               │
│ File: vehicles_100.xlsx (100 data rows detected)             │
│                                                               │
│ Import as:                                                    │
│   ◉ Parameterized test (1 test with 100-row data table)      │
│   ○ Individual tests (100 separate Scenario clones)           │
│                                                               │
│ [Cancel]                                    [Import]          │
└───────────────────────────────────────────────────────────────┘
```

- **Parameterized test** (new default): Creates one `Scenario` with a `DataTable` containing the imported rows. Pattern (URL, headers, auth, body template) is reconstructed from the metadata sheet. Validation columns (if present) populate `validate:` columns in the data table.
- **Individual tests** (legacy): Creates N separate `Scenario` objects via `buildScenarioFromRow()` — same as current behavior.

#### Round-Trip Fidelity

A full round-trip is now supported:
1. Create a parameterized test with data table
2. Export as batch template (.xlsx / .csv / .json)
3. Edit externally (add rows, fix values)
4. Re-import — choose "Parameterized test" mode
5. Data table is updated with new/changed rows
6. Pattern changes from step 1 are preserved (only data changes)

This eliminates the "N disconnected clones" problem described in Section 1.

### 5.2 Runner Weight System

Parameterized tests participate in the weight system like regular tests:
- Weight controls relative frequency vs other tests
- Each "pick" of a parameterized test expands to all its data rows
- In `load-profile` mode, data rows are distributed across VUs: each VU picks the next available row

### 5.3 Baselines & Trend Charts

In `ResultsDashboard`, baselines and trend charts should work with parameterized tests:
- **Run comparison:** Compare per-row results across two runs (same data, different times)
- **Trend chart:** Track specific data rows' response times over multiple runs
- **Regression detection:** Flag rows whose response time increased by >X% vs baseline

### 5.4 Workflow Harness Integration

When the Workflow↔Harness integration (separate plan) routes through `graphRunner`:
- HTTP nodes with data tables are expanded per-row
- Each workflow iteration can pick different data rows
- Results are tagged with both `workflowNodeId` and `dataRowId`

### 5.5 Shared / Reusable Data Tables

A single data table can be referenced by multiple tests — change the data once, all tests update. This avoids duplicating the same 100-row dataset across 5 tests that hit different endpoints but share the same parameter space (e.g., same VINs tested against `/offers`, `/status`, `/enrollment`).

#### Storage Model

```typescript
// src/shared/types/index.ts

export interface SharedDataTable extends DataTable {
  /** Human-readable name: "Production VIN Set" */
  name: string;
  /** Which Scenario IDs reference this table */
  referencedBy: string[];
}
```

Shared data tables are stored at the `FeatureGroup` level (sibling to `scenarios`):

```typescript
export interface FeatureGroup {
  // ... existing fields ...
  /** Shared data tables available to all scenarios in this group */
  sharedDataTables?: SharedDataTable[];
}
```

A `Scenario` references a shared table via ID instead of embedding it:

```typescript
export interface Scenario {
  // ... existing fields ...
  dataTable?: DataTable;
  /** Reference to a shared data table (mutually exclusive with inline dataTable) */
  sharedDataTableId?: string;
}
```

#### UI

In the Data Table tab, source selector adds a third option:

```
Source: ○ Inline  ○ CSV/Excel/JSON File  ◉ Shared Table
        [Production VIN Set (100 rows) ▼]
        
        Also used by: Vehicle Offers, Enrollment Check, Status API
```

The shared table is edited from a central location (FeatureGroup settings or a dedicated "Data Tables" tab on the test editor), and changes propagate to all referencing tests automatically.

### 5.6 Environment-Specific Data Sets

Different environments have different valid data — dev has test user IDs 1–10, staging has 100–200, production has real VINs. Rather than maintaining separate data tables per environment, allow **environment-scoped row filtering**.

#### Approach A: Environment Column

Add an `env` column type to `DataTableColumn`:

```typescript
type: 'path' | 'param' | 'body' | 'header' | 'validate' | 'env';
```

Rows with `env` column value matching the active environment are included; others are skipped:

```
│ vin      │ channel │ env     │ validate:$.status │
│ 1GY..338 │ WEBRNW  │ dev     │ active            │  ← runs in dev
│ 2GY..445 │ WEBRNW  │ dev     │ active            │  ← runs in dev
│ 5GY..990 │ WEBRNW  │ staging │ active            │  ← runs in staging
│ 8GY..112 │ DEALER  │ prod    │ active            │  ← runs in prod
│ 9GY..334 │ WEBRNW  │ all     │ active            │  ← runs in all envs
```

The `env` column is not injected into the request — it's purely a filter. The active environment comes from the TestRunner's environment selector (already exists: `envName`, `envId`).

#### Approach B: Row Tags (Simpler)

Reuse the row tags system (Phase 12): tag rows with `env:dev`, `env:staging`, `env:prod`. Create named subsets per environment. No new column type needed — just convention.

**Recommendation:** Start with Approach B (tags) for simplicity. Add Approach A (dedicated column type) later if users need more structured environment filtering.

---

## 6. Migration & Backward Compatibility

### 6.1 No Breaking Changes

- `dataTable` is optional on `Scenario` — existing scenarios work unchanged
- `dataRowId`/`dataRowLabel` are optional on `RequestResult` — existing results work unchanged
- All new types are additive
- Storage format remains JSON — new fields are naturally persisted

### 6.2 Migration Path from N-Clone Pattern

For users who already have N cloned Scenarios from the current Export/Import flow, offer a **"Merge to Parameterized"** utility:

1. User selects multiple Scenarios in the same TestScenario group
2. Tool detects the common pattern (same URL structure, headers, auth, body)
3. Extracts varying parts into columns, merges into one Scenario with a DataTable
4. Removes the N clones, replaces with the single parameterized test

This is a quality-of-life feature for Phase 2 or later.

---

## 7. Priority Sequencing

| Phase | Name | Priority | Effort | Depends On |
|---|---|---|---|---|
| 1 | Data Table Core (types) | Critical | Small | — |
| 2 | Inline Data Table Editor (+ Smart Paste, Bulk Ops) | Critical | Large | Phase 1 |
| 3 | Execution Engine Expansion | Critical | Medium | Phase 1 |
| 4 | Runner UI Updates | High | Medium | Phase 2, 3 |
| 5 | Results Display Updates | High | Medium | Phase 3 |
| 6 | Workflow Integration | Medium | Medium | Phase 1, 3 |
| 7 | File Source Management (CSV/Excel/JSON) | Medium | Small | Phase 2 |
| 8 | Capture & Validate + Pre-Validation | Medium | Medium | Phase 2, 3 |
| 9 | CLI Support | Low | Small | Phase 3 |
| 10 | Gallery Samples & Training Manuals | Medium | Medium | Phase 1, 2, 8 |
| 11 | Re-run Failed Rows | High | Small | Phase 3, 5 |
| 12 | Row Tags & Data Subsets | Medium | Medium | Phase 2 |
| 13 | Edge Case Auto-Generation | Medium | Medium | Phase 2, 12 |
| 14 | Chained Data Capture (API → Table) | Medium | Medium | Phase 2, 3 |

**Recommended implementation order:**

```
Phase 1 (types)
  ├─→ Phase 2 (editor + paste + bulk) ─┬─→ Phase 4 (runner UI) ─→ Phase 11 (re-run failed)
  │                                     ├─→ Phase 7 (file sources)
  │                                     ├─→ Phase 12 (tags) ─→ Phase 13 (edge case gen)
  │                                     └─→ Phase 14 (chained capture)
  └─→ Phase 3 (engine) ────────────────┬─→ Phase 5 (results)
                                        ├─→ Phase 8 (capture + pre-validate) ─→ Phase 10 (gallery)
                                        ├─→ Phase 6 (workflow)
                                        └─→ Phase 9 (CLI)
```

**Wave 1 (Critical):** 1 → 2 + 3 (parallel)
**Wave 2 (High):** 4 + 5 + 11 (parallel, builds on Wave 1)
**Wave 3 (Medium-core):** 7 + 8 + 12 (parallel)
**Wave 4 (Medium-advanced):** 10 + 13 + 14 + 6 (parallel)
**Wave 5 (Low):** 9

---

## 8. Design Principles

1. **One pattern, many data.** A parameterized test is ONE test definition with attached data, not N clones. Changes to the pattern (URL, headers, auth, body structure) automatically apply to all data rows.

2. **Data is first-class.** Data rows are visible, editable, and manageable within the UI — not hidden behind an export/import round-trip.

3. **Backward compatible.** All existing tests, exports, imports, and results continue to work unchanged. Data tables are purely additive.

4. **Reuse existing infrastructure.** The CSV/Excel parsing pipeline (`csvTemplateShared.ts`, `csvTemplateExcel.ts`) is reused for file source loading. The `{{variable}}` resolution system is reused for data injection. The existing result grouping system is extended, not replaced.

5. **Progressive complexity.** Simple case (3 rows inline) requires zero knowledge of files or column types. Advanced case (10K rows from Excel with file-watch) builds on the same model. Users start simple and grow.

6. **Validation is optional — always.** A data table works perfectly without any `validate:` columns. When no validations exist, the test runs as a **pure smoke test** — each row is executed and the result is pass/fail based on HTTP status code only (2xx = pass, 4xx/5xx = fail). Users can add validation columns at any time via "Run & Capture" (auto-populate from live responses) or manually. The system never forces users to define expected values. This means:
   - A 100-row data table with zero `validate:` columns → 100 smoke tests (HTTP status check only)
   - A 100-row data table with `validate:$.status` column → 100 regression tests (status code + field value)
   - Pre-validation mode shows 🟡 (warn) for rows without validation columns to distinguish from fully validated 🟢 (pass) rows

---

## 9. Non-Goals (Out of Scope)

- **Database-driven data sources** — No JDBC, MongoDB, or other database connectors. Data comes from inline tables, CSV/Excel/JSON files, or API responses (Phase 14) only.
- **Full faker/factory library** — Edge case auto-generation (Phase 13) suggests boundary values from column analysis, but does not include a general-purpose data generation library (no random names, addresses, etc.)
- **Cross-test data dependencies** — Each parameterized test is self-contained; no data flow between different parameterized tests (workflows handle inter-step dependencies)
- **Spreadsheet-level formulas** — Data table cells are plain strings, not computed values. No `=SUM()`, `=IF()`, or cell references.
- **Real-time collaborative editing** — Data tables are local; no multi-user sync or conflict resolution
- **Data table version control** — No built-in git-like history for data table changes (use standard file versioning for external CSV/Excel files)

---

## 11. Phase Status Tracker

| Phase | Name | Status | Started | Completed | Commits |
|---|---|---|---|---|---|
| 1 | Data Table Core (types) | 🔲 Not Started | — | — | — |
| 2 | Inline Data Table Editor (+ Smart Paste, Bulk Ops) | 🔲 Not Started | — | — | — |
| 3 | Execution Engine Expansion | 🔲 Not Started | — | — | — |
| 4 | Runner UI Updates | 🔲 Not Started | — | — | — |
| 5 | Results Display + Report Generation | 🔲 Not Started | — | — | — |
| 6 | Workflow Integration | 🔲 Not Started | — | — | — |
| 7 | File Source Management (CSV/Excel/JSON) | 🔲 Not Started | — | — | — |
| 8 | Capture & Validate + Pre-Validation | 🔲 Not Started | — | — | — |
| 9 | CLI Support | 🔲 Not Started | — | — | — |
| 10 | Gallery Samples & Training Manuals | 🔲 Not Started | — | — | — |
| 11 | Re-run Failed Rows | 🔲 Not Started | — | — | — |
| 12 | Row Tags & Data Subsets | 🔲 Not Started | — | — | — |
| 13 | Edge Case Auto-Generation | 🔲 Not Started | — | — | — |
| 14 | Chained Data Capture (API → Table) | 🔲 Not Started | — | — | — |

---

## 12. Success Criteria

### Core (Phases 1–5)
- [ ] User can add a Data Table tab to any test and define columns + rows inline
- [ ] Data table columns auto-detect from URL path variables and query parameters
- [ ] Execution engine expands one Scenario + N data rows into N concrete requests
- [ ] Each result is tagged with `dataRowId` and `dataRowLabel`
- [ ] Results dashboard groups parameterized test results by data row
- [ ] Failed rows are instantly filterable in results view

### Data Management (Phases 2, 7, 12)
- [ ] Smart paste from Excel/Google Sheets/Notion detects TSV/HTML and maps columns
- [ ] Bulk select, enable/disable, delete, tag, find & replace across rows
- [ ] Search/filter rows by text, tag, or pre-validation status within the data table
- [ ] Row-level notes/annotations visible in the table
- [ ] CSV, Excel (.xlsx), and JSON files can be linked as external data source (all three formats)
- [ ] Row tags with built-in suggestions (happy-path, edge-case, negative, boundary)
- [ ] Named data subsets for filtered execution ("US Only", "Edge Cases")

### Execution & Results (Phases 5, 8, 11, 14)
- [ ] Results view splits parameterized test rows into **Failed** (expanded) and **Passed** (collapsed) batches with colored headers
- [ ] Four result view modes: Split (default), Flat, Failures Only, Comparison
- [ ] Expanding a failed row shows full request/response detail and validation diff
- [ ] "Run & Capture" pre-populates validation columns from live responses
- [ ] "Pre-Validate Data" runs all rows against the real API and shows pass/warn/fail per row
- [ ] Pre-validation with no validation columns shows 🟡 warn (smoke test), not 🟢 pass
- [ ] Pre-validation failure results show inline "Update Expected" / "Ignore" / "Remove" per assertion
- [ ] Bulk update validation rules across rows with identical failure patterns
- [ ] "Re-validate Updated Rows" re-runs only rows whose validation was modified
- [ ] Validation is fully optional — tests run as smoke tests (status-only) when no `validate:` columns exist
- [ ] "Re-run Failed" re-executes only failed rows and merges results back
- [ ] Selective row re-run — cherry-pick specific rows to re-test
- [ ] "Populate from API Response" extracts an array from one API call into the data table
- [ ] "Generate Report" produces self-contained HTML, PDF, JSON, or Markdown reports
- [ ] HTML report includes summary, failed/passed tables, charts (pie + response time), and data table snapshot
- [ ] Auto-report option: auto-save report to file when test finishes

### Intelligent Features (Phase 13)
- [ ] Column type inference from existing values (integer, email, enum, country-code, etc.)
- [ ] Edge case auto-generation suggests boundary, negative, empty, and format-violation rows
- [ ] Auto-generated rows are tagged `auto-edge` for easy filtering

### Export/Import (Section 5.1)
- [ ] Export batch template produces .xlsx, .csv, or .json with metadata + data rows
- [ ] Import batch template offers "Parameterized test" vs "Individual tests" import mode
- [ ] Existing Export Template / Import Template flows continue to work (backward compatible)
- [ ] Full round-trip: create → export → edit externally → re-import preserves pattern

### Advanced (Phases 5.5, 5.6, 6, 10)
- [ ] Shared data tables referenced by multiple tests, edited centrally
- [ ] Environment-specific data filtering via tags or dedicated env column
- [ ] Gallery includes 6+ parameterized test samples using real public APIs (no setup required)
- [ ] Training manuals cover data table basics, file import, validation, pre-validation, and workflow integration
- [ ] Sample data files ship in `test-data/` in CSV, Excel, and JSON formats
- [ ] Workflow HTTP nodes support data tables for per-row execution

### CLI (Phase 9)
- [ ] CLI supports `--data` flag to override inline data with external file

### Performance
- [ ] No performance regression: expanding 1000 data rows adds < 100ms to test startup

---

_Created: 2026-05-01 | Status: Proposed | Related: [workflow-harness-integration-plan.md](./workflow-harness-integration-plan.md), [CsvTemplateExportModal](../../src/features/scenarios/components/CsvTemplateExportModal.tsx), [csvTemplateShared.ts](../../src/features/scenarios/utils/csvTemplateShared.ts)_
