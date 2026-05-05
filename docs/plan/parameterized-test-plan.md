# Parameterized Test (Data-Driven Regression Testing) Plan

> **Goal:** Enable users to define one test pattern with an attached data source (inline or from CSV/Excel file), so the engine expands it into N requests at execution time — replacing the current workflow of exporting a template, editing externally, and re-importing as N independent Scenarios.

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
| `FeatureGroup` type | `src/shared/types/index.ts` | Top-level container, stored in IndexedDB (browser) / Tauri file store |
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
| `storage.ts` | `src/shared/utils/storage.ts` | Persistence — IndexedDB for FGs + test runs (browser), localStorage fallback, Tauri file store |
| `idbOpen.ts` | `src/shared/utils/idbOpen.ts` | Shared IndexedDB connection (DB "redfireforge" v2) with timeout + blocked handling |
| `idbFeatureGroups.ts` | `src/shared/utils/idbFeatureGroups.ts` | IndexedDB backend for feature groups (load/save/migrate) |
| `idbTestRuns.ts` | `src/shared/utils/idbTestRuns.ts` | IndexedDB backend for test run history |
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
| Shared data sources | ❌ | ❌ | ✅ (SharedArray) | ❌ | ❌ | ✅ (cross-test reference) |
| Pre-validation dry run | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (smoke + traffic-light) |
| Update validation from failures | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (inline per-row editing) |
| Visual pass/fail batch split | ❌ (flat list) | ❌ (flat list) | ❌ (console) | ❌ (console) | ❌ | ✅ (collapsible batches) |
| Report generation (HTML/PDF) | ✅ (listeners) | ❌ (Newman CLI) | ❌ (--summary-trend) | ❌ (locust web UI) | ❌ | ✅ (HTML/PDF/JSON/MD) |
| Environment-specific data | ❌ (manual CSV) | ❌ (manual upload) | ❌ (code) | ❌ (code) | ❌ | ✅ (env tags/column) |

### Key Insight

JMeter's approach (external CSV file referenced by path) is the most mature. Postman's approach (upload CSV at run time) is the most user-friendly. RedfireForge can combine the best of both — **inline data source for quick edits + CSV/Excel/JSON file link for large datasets** — with visual editing that neither JMeter nor Postman offers. More importantly, the planned features in the bottom 8 rows of the matrix (re-run failed, tags, edge case generation, chained capture, smart paste, shared tables, pre-validation, environment data) are capabilities **no existing tool provides**, making RedfireForge the first data-driven testing tool with truly visual, intelligent data management.

---

## 3. Data Model Design

### 3.1 New Type: `DataSource`

```typescript
// src/shared/types/index.ts

export interface DataSourceColumn {
  /** Stable column identifier — used as key in DataSourceRow.values (survives renames) */
  id: string;
  /** Display name shown in the table header (editable by user) */
  name: string;
  /** Where this column binds in the request */
  type: 'path' | 'param' | 'body' | 'header' | 'validate';
  /** For 'path': variable name in URL. For 'param': query param name. For 'validate': JSONPath. */
  mapping: string;
  /** Optional human-readable description */
  description?: string;
}

export interface DataSourceRow {
  /** Unique row ID for stable identity across edits */
  id: string;
  /** Column ID → value (keyed by column.id, NOT column.name — stable across renames) */
  values: Record<string, string>;
  /** Whether this row is enabled (unchecked rows are skipped) */
  enabled: boolean;
  /** User-assigned tags for categorization and filtered execution (Phase 12) */
  tags?: string[];
  /** Optional note/annotation for this row */
  note?: string;
}

export type DataSourceType = 'inline' | 'file';

export interface DataSourceSource {
  type: DataSourceType;
  /** For 'file': relative or absolute path to CSV/Excel/JSON file */
  filePath?: string;
  /** For 'file': last-read timestamp for staleness detection */
  fileLastRead?: number;
  /** For 'file': row count at last read (for quick display without parsing) */
  fileRowCount?: number;
}

export interface DataSource {
  /** Unique ID */
  id: string;
  /** Column definitions — order matters for display */
  columns: DataSourceColumn[];
  /** Data rows (inline source only; file source reads at execution time) */
  rows: DataSourceRow[];
  /** Where the data lives */
  source: DataSourceSource;
  /** Row distribution strategy during execution (defaults to 'sequential' when omitted) */
  distribution?: 'sequential' | 'random' | 'round-robin';
  // NOTE: `subsets?: DataSubset[]` deferred to Phase 12
}
```

### 3.2 Extend `Scenario` with Optional DataSource

```typescript
// src/shared/types/index.ts — add to Scenario interface

export interface Scenario {
  // ... existing fields ...
  
  /** Attached data source for parameterized execution */
  dataSource?: DataSource;
  /** Transient: set by data source expansion — row ID for result tagging */
  dataRowId?: string;
  /** Transient: set by data source expansion — display label for result tagging */
  dataRowLabel?: string;
}
```

**Design decision:** The data source lives ON the Scenario, not as a separate entity. This keeps the data close to the pattern it parameterizes, avoids cross-reference complexity, and ensures export/import carries the data with it.

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

### 3.5 Adaptive Tab Visibility

Instead of an explicit `ScenarioType` enum, tab visibility adapts based on the **presence and shape** of the `dataSource` field. No new type field, no migration, no breaking changes.

**Decision logic:**

```typescript
// No enum needed — derive behavior from data shape
const hasDataSource = !!scenario.dataSource;
const hasValidateColumns = scenario.dataSource?.columns.some(c => c.type === 'validate') ?? false;
```

**Tab visibility rules:**

| Tab | No Data Source | Data Source (no validate cols) | Data Source (with validate cols) |
|-----|---------------|-------------------------------|----------------------------------|
| Params | ✓ | ✓ | ✓ |
| Auth | ✓ | ✓ | ✓ |
| Headers | ✓ | ✓ | ✓ |
| Validation | ✓ | ✓ | ✗ (validation lives in data rows) |
| Extract | ✓ | ✓ | ✗ |
| Data | ✓ (current) | ✗ (replaced by Data Source) | ✗ (replaced by Data Source) |
| Data Source | ✗ | ✓ | ✓ |
| History | ✓ | ✓ | ✓ |

**Key insight:** The same `Scenario` type works for both standard tests and parameterized tests. The UI simply renders different tabs based on what data exists. This avoids:
- A `ScenarioType` enum that would need migration logic
- Conditional type checks scattered throughout the codebase
- A confusing "Convert" flow that creates duplicate scenarios

**Tree view indicator:** Tests with `dataSource` show a 📋 icon in the scenario tree.

### 3.6 Create Parameterized Copy

A "Create Parameterized Copy" action creates a new test pre-configured with a data source:

**Entry points:**
1. **"+ Parameterized Test" button** — next to existing "+ Test" in scenario header. Creates a blank test and immediately opens the Data Source Setup Wizard.
2. **"Create Parameterized Copy →" button** — on existing test editor toolbar. Duplicates the test with a data source attached.

**"Create Parameterized Copy →" logic:**
1. Duplicate the existing scenario (new ID, append " (Parameterized)" to name)
2. Copy: `url`, `method`, `headers`, `auth`, `params` from source
3. `url` becomes `dataSource.urlTemplate`
4. If source has validation rules → suggest as `validate:` columns in wizard Step 3
5. Open Data Source Setup Wizard with URL pre-loaded in Step 1 (path variable detection)
6. Set `sourceTestId` on the new scenario (optional backlink for traceability badge)
7. Original test is **preserved** (not modified) — user keeps both

**Optional backlink:**
```typescript
// Added to Scenario interface (optional, no migration needed)
sourceTestId?: string; // ID of the test this was copied from
```
When present, the tree view shows a small link badge. Clicking it navigates to the source test.

**Use case:** Dev has a working test, wants to expand it to N variations. "Create Parameterized Copy" creates the data-driven version while keeping the original for quick single-request debugging.

### 3.7 QA Handoff Workflow

The full end-to-end flow for data-driven regression testing:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Step 1   │    │ Step 2   │    │ Step 3   │    │ Review 1 │    │ Samples  │
│ Path Vars│ →  │ Input    │ →  │ Expect   │ →  │ Dev      │ →  │ Dev Adds │
│          │    │ Columns  │    │ Fields   │    │ Reviews  │    │ Rows     │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
       ↓
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Export   │    │ QA Fills │    │ Review 2 │    │ Import   │    │ Execute  │
│ CSV/JSON │ →  │ Values   │ →  │ Dev      │ →  │ Data     │ →  │ Per-Row  │
│          │    │          │    │ Reviews  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Step 3 — Expected Values (Wizard):**
- Choose validation mode: None / Full JSON Match / Selective Fields
- "Fetch Sample Response" button → executes request with sample inputs
- For Selective: browse response tree (reuse slimmed `JsonPathBuilder`), check fields
- Checked fields become `expect:` columns in the data source

**Sample Row Creation:**
1. Dev enters input values (path vars, params) in a row
2. Clicks "Fetch" → executes request with those inputs against current environment
3. Response populates → `expect:` columns auto-fill from actual response
4. Dev reviews/adjusts → saves as sample row (marked with badge)
5. Repeat for additional variations

**Export → QA → Import cycle:**
1. Export includes: column headers (with `path:`, `param:`, `expect:` prefixes) + sample rows
2. QA fills remaining rows in Excel/CSV/JSON (samples show expected format)
3. Dev reviews completed file (Review Gate 2)
4. Import updates data source with QA-provided rows
5. Run with validation → per-row pass/fail

### 3.8 Runtime Validation Mode Override

When running a Parameterized Test, the validation mode stored in `dataSource.validationMode` is the **default**, but can be overridden at run time:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `'none'` | Skip all `expect:` columns. HTTP status only. | Quick smoke test |
| `'full'` | Use `expect:$response` column for deep JSON compare | Full regression |
| `'selective'` | Use individual `expect:jsonPath` columns per row | Field-level regression |

**UI:** Run Options panel shows a dropdown: "Validation: [Use Default ▼]" with options to override.

**Key insight:** The `expect:` columns are always present in the template/data — they're just ignored when mode is `'none'`. This means the same template serves both smoke tests and full regression without modification.

### 3.9 JSON Export/Import Schema

JSON format for data-driven test templates — optimized for CI/CD pipelines and programmatic generation:

```typescript
interface ParameterizedTestJson {
  /** Schema version for forward compatibility */
  version: '1.0';
  /** Metadata about the test pattern */
  metadata: {
    name: string;
    description?: string;
    method: HttpMethod;
    urlTemplate: string;
    headers?: Record<string, string>;
    auth?: { type: string; [key: string]: unknown };
    createdAt: string; // ISO 8601
    exportedFrom: string; // 'RedfireForge v0.5.x'
  };
  /** Column definitions with type mappings */
  columns: Array<{
    id: string;
    name: string;
    type: 'path' | 'param' | 'header' | 'body' | 'expect' | 'expect-full';
    mapping: string; // variable name or JSONPath
  }>;
  /** Validation configuration */
  validation: {
    mode: 'none' | 'full' | 'selective';
    /** JSONPaths selected for selective mode */
    selectedFields?: string[];
  };
  /** Data rows */
  rows: Array<{
    id?: string;
    enabled?: boolean; // defaults to true
    isSample?: boolean;
    tags?: string[];
    note?: string;
    values: Record<string, string | number | boolean | null>;
  }>;
}
```

**Example JSON file:**

```json
{
  "version": "1.0",
  "metadata": {
    "name": "Vehicle Purchase Offers",
    "method": "GET",
    "urlTemplate": "https://api.example.com/vehicles/{{vin}}/purchaseOffers?channel={{channel}}",
    "headers": { "X-Correlation-Id": "{{$uuid}}" },
    "createdAt": "2026-05-02T10:00:00Z",
    "exportedFrom": "RedfireForge v0.5.6"
  },
  "columns": [
    { "id": "col1", "name": "vin", "type": "path", "mapping": "vin" },
    { "id": "col2", "name": "channel", "type": "param", "mapping": "channel" },
    { "id": "col3", "name": "status", "type": "expect", "mapping": "$.data.status" },
    { "id": "col4", "name": "offerName", "type": "expect", "mapping": "$.data.offers[0].name" }
  ],
  "validation": {
    "mode": "selective",
    "selectedFields": ["$.data.status", "$.data.offers[0].name"]
  },
  "rows": [
    {
      "isSample": true,
      "values": { "vin": "1GYFZR40...", "channel": "WEBRNW", "status": "active", "offerName": "OnStar Trial" }
    },
    {
      "isSample": true,
      "values": { "vin": "2GYFZR40...", "channel": "DEALER", "status": "pending", "offerName": "Basic Plan" }
    },
    {
      "values": { "vin": "3GYFZR40...", "channel": "WEBRNW", "status": "", "offerName": "" },
      "note": "QA to fill expected values"
    }
  ]
}
```

**JSON advantages over CSV:**
- No escaping issues (JSON in `expect:$response` column is properly nested, not string-in-a-cell)
- Schema is self-documenting (column types, validation mode embedded)
- Programmatic generation from scripts/CI pipelines is trivial
- Supports complex values (objects, arrays, null) natively
- Round-trip fidelity: no data loss from CSV quoting/encoding

**JSON import logic:**
1. Parse and validate against `ParameterizedTestJson` schema
2. Map `columns` → `DataSourceColumn[]`
3. Map `rows` → `DataSourceRow[]` (generate IDs if not provided)
4. Reconstruct `DataSourceConfig` with validation settings
5. Offer "Parameterized test" vs "Individual tests" import mode (same as CSV/Excel)

---

## 4. Implementation Plan

### Phase 1: Data Source Core (Data Model + Storage)

**Priority: Critical | Effort: Small**

#### 4.1 Add Types

Add `DataSource`, `DataSourceColumn`, `DataSourceRow`, `DataSourceSource` to `src/shared/types/index.ts`. Add `dataSource?: DataSource` to `Scenario`. Add `dataRowId?` and `dataRowLabel?` to `RequestResult`.

#### 4.2 Storage Compatibility

No storage migration needed — `dataSource` is optional on `Scenario`. Existing scenarios without it continue to work. Feature Groups are stored as JSON blobs, so new fields are automatically persisted.

**Risk:** Large inline data sources (1000+ rows) may bloat localStorage. Mitigations:
- ~~For browser: already using IndexedDB for test runs; Feature Groups remain in localStorage but data sources > 500 rows should use file source~~
- **UPDATE (2026-05-03):** Feature Groups have been migrated to IndexedDB (see Phase 15B below). localStorage's ~5MB quota was exceeded with 18 FGs / 388 tests (~700KB). IndexedDB provides 50MB+ capacity.
- For Tauri: file-based storage has no size concern
- UI warning when inline table exceeds 500 rows: "Consider using an external CSV file for large datasets"

#### 4.3 Export/Import Compatibility

Existing JSON export/import (`wrapExport`/`unwrapImport` in `scenarioImportExport.ts`) will naturally carry `dataSource` because it serializes the full `Scenario` object.

#### 4.4 Implementation Notes (Phase 1)

**Status:** ✅ Complete (2026-05-01) | Branch: `feature/parameterized-tests`

**Files modified:**
- `src/shared/types/index.ts` — Added `DataSourceColumn`, `DataSourceRow`, `DataSourceType`, `DataSourceSource`, `DataSource` types; added `dataSource?`, `dataRowId?`, `dataRowLabel?` to `Scenario`; added `dataRowId?`, `dataRowLabel?` to `RequestResult`

**Design decisions:** See Section 3.5 (Wave 1 Retrospective) for 5 design improvements made during implementation.

---

### Phase 2: Inline Data Source Editor (UI)

**Priority: Critical | Effort: Large**

> **Implementation split (approved design review):**
> Phase 2 is split into 3 incremental sub-phases to reduce risk and enable earlier testing:
> - **2A** (Core): Table editor + tab integration + auto-column detection — minimum viable for end-to-end parameterized testing
> - **2B** (Productivity): Smart paste + bulk operations + drag-to-reorder rows
> - **2C** (Polish): Search/filter rows + URL pattern display
>
> **Key design decisions:**
> 1. **Reuse `params-row` CSS patterns** — the table grid uses existing `params-row` / `params-input` / `params-delete` / `params-toggle` classes for visual consistency (not a custom `<table>`)
> 2. **`draft` + `onDraftChange` pattern** — same interface as `ParamsEditor`, `BodyEditor`, `TestEditorAuthTab` (no separate state management)
> 3. **`autoDetectColumns()` as pure utility** — `src/features/scenarios/utils/dataSourceUtils.ts`, calls existing `analyzeUrlPath()` + `parseQueryParams()` + scans body/headers for `{{varName}}`
> 4. **Tag filter deferred to Phase 12**, pre-validation status filter deferred to Phase 8 — only text search in 2C
> 5. **Drag-to-reorder deferred to 2B** — 2A uses simple move up/down buttons

#### 2.1 DataSourceEditor Component

New component: `src/features/scenarios/components/DataSourceEditor.tsx`

Accessible from the Edit Test modal as a new tab alongside Params, Auth, Headers, Validation, Extract, History.

```
┌─ Edit Test ──────────────────────────────────────────────────┐
│ Params │ Auth │ Headers │ Validation │ Extract │ Data Source │ │
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

**Features (by sub-phase):**

**2A (Core):**
- Editable cells (click to edit, Tab to move)
- Checkbox per row (enabled/disabled — disabled rows are skipped)
- Add/remove rows and columns
- Column type selector (path / param / body / header / validate)
- Column mapping (auto-detected from URL params and path variables via `autoDetectColumns()`)
- Move up/down buttons for row reordering
- Row count badge on the Data Source tab
- Import from CSV file (reuses existing `parseCsvToScenarios` pipeline)

**2B (Productivity):** ✅ Complete (2026-05-02)
- Bulk operations (click/Shift+click/Cmd+click to select rows → Enable/Disable/Duplicate/Delete)
- Drag to reorder rows (drag handle per row, HTML5 drag-and-drop)
- Sort by column (click column header → asc/desc toggle)

**2C (Polish):** ✅ Complete (2026-05-02)
- Search/filter rows (text search across all columns with row count indicator)
- Row-level notes (click note icon → inline annotation input)
- Sort indicators on column headers (▲/▼ when active, ⇅ otherwise)

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
5. Map clipboard columns to existing data source columns by name match
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

For large data sources (50+ rows), individual editing is tedious. Provide bulk operations:

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

#### 2.4 Data Source Search & Filter

For tables with 100+ rows, provide a search bar and filter controls:

```
┌─ Search: [webrnw________] │ Filter: [Tag: edge-case ▼] │ Showing: 15 of 100 rows ─┐
```

- **Text search:** Highlights and filters to rows containing the search term in any column
- **Tag filter:** Show only rows with specific tags
- **Status filter** (after pre-validation): Show only 🔴 failed / 🟡 warn / 🟢 pass rows
- **Column filter:** Click column header → filter by distinct values in that column

#### 2.5 Auto-Column Detection

When the user opens the Data Source tab for the first time on a test, auto-detect columns:

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

Add "Data Source" as a new tab in `TestEditorModal.tsx`:

```typescript
// In TestEditorModal.tsx, extend TestEditorTab type
export type TestEditorTab = 'params' | 'body' | 'auth' | 'headers' | 'validation' | 'extract' | 'history' | 'dataSource';
```

**Follow existing tab bar pattern** — the TestEditorModal uses `WorkflowEditorModalFrame` as its container and renders tabs as `<button className="builder-tab">` inside a `<div className="builder-tabs">`. Tab content renders inside `<div className="builder-tab-content">`.

```tsx
// Tab button — follows existing badge patterns:
// - Numeric count badge (like Params/Headers/Extract): <span className="tab-badge">{count}</span>
// - Dot indicator (like Body/Auth/Validation): <span className="tab-badge-dot" />
// Data Source uses numeric count (row count is useful information):
<button type="button" className={`builder-tab ${activeTab === 'dataSource' ? 'active' : ''}`}
  onClick={() => onActiveTabChange('dataSource')}>
  Data Source {enabledRowCount > 0 && <span className="tab-badge">{enabledRowCount}</span>}
</button>
```

The `DataSourceEditor` renders as tab content (not a standalone modal) — same pattern as `ParamsEditor`, `BodyEditor`, `TestEditorAuthTab`, etc.

#### 2.8 Phase 2A Improvements (2026-05-02)

New capabilities added to the DataSourceEditor beyond the original plan:

| Feature | Description |
|---|---|
| **Tab/Enter keyboard navigation** | Tab moves right (wraps to next row), Shift+Tab left, Enter moves down, Alt+Arrow vertical. Uses `data-row`/`data-col` attributes for focus targeting. |
| **URL template display** | Shows `urlTemplate` above the table in monospace code box for at-a-glance pattern visibility. |
| **JSON import** | Import button accepts `.csv` and `.json`. JSON supports schema v1 (`ParameterizedTestJson`) and simple array-of-objects. Column type detection from prefixes. |
| **Export CSV** | Toolbar button exports with type-prefixed headers (`path:vin`, `param:channel`, `expect:$.status`) and RFC 4180 quoting. |
| **Export JSON** | Toolbar button exports `ParameterizedTestJson` schema v1 (version, metadata, columns, validation, rows). |
| **Duplicate row** | ⧉ button in row actions, inserts copy immediately below source row. |
| **Quick Setup** | Empty state "⚡ Quick Setup" auto-detects columns from URL `{{vars}}` and query params without wizard. Falls back to wizard if no columns detected. |
| **Column type badges** | Colored inline badges (path/param/body/header/validate) in column headers for instant visual type recognition. |
| **Proper CSV parsing** | `parseCsvLine()` handles quoted fields (commas, quotes, newlines inside cells). |
| **Column prefix detection** | Import auto-detects column types from CSV headers: `path:`, `param:`, `expect:`, `header:`, `body:` prefixes. |

#### Implementation Notes (Phase 2A)
- **Started:** 2026-05-01 | **Completed:** 2026-05-02
- **Files Modified:**
  - `src/features/scenarios/components/DataSourceEditor.tsx` — Added keyboard nav, JSON import/export, duplicate row, Quick Setup, column type badges, proper CSV parsing
  - `src/features/scenarios/components/DataSourceEditor.test.tsx` — Updated empty state tests, added Quick Setup test (17 tests passing)
  - `src/styles/scenario-builder.css` — Added URL template display, column type badge colors, empty state actions, wider action column
- **Tests:** 17 passing (DataSourceEditor) + 19 passing (dataSourceUtils)
- **Deviations from Plan:** Added features not originally in 2A scope (JSON import/export, Quick Setup). These were identified during code evaluation as high-value, low-effort additions that align with Phase 7 (file sources) and improve the core editing experience.

---

#### 2.9 Excel Export/Import Fixes & Parameterized Import Mode (2026-05-02)

Fixes and enhancements to the Excel template round-trip pipeline and CsvImportModal:

| Fix/Feature | Description |
|---|---|
| **VIN encoding fix** | `decodeURIComponent()` on path segment values before writing to Excel — encoded VINs like `1GTPU91D%2F6R107995A` now display correctly |
| **Export all DataSource rows** | Added `dataRows` parameter to `ExcelExportOptions` — both `DataSourceSetupModal` and `CsvTemplateExportModal` now pass all data rows, not just the sample row |
| **Validation column ordering** | Added `extractArrayIndex()` helper — validate columns sorted by array index (offer0_code before offer1_code) |
| **Dynamic columns in export** | `buildColumnDefs` now iterates `dataSource.columns` for validate columns not in `expectedFields` |
| **Consistent column naming** | Dynamic validate columns (from DataSource) now use `shortNameFromJsonPath(col.mapping)` for auto-name generation — consistent with static columns |
| **validationContract/arrayValidationMode in metadata** | Export writes these to CONFIG section of Metadata sheet; import parses them back |
| **Parameterized import mode** | `CsvImportModal` now offers "Import as Tests" vs "Import as Parameterized Test" selector in Step 4 |
| **buildParameterizedTest helper** | Builds a single Scenario with DataSource from all parsed rows — proper column type detection from metadata `columnTypes` map |
| **columnTypes on CsvParseResult** | `parseExcelToScenarios` now returns `columnTypes`, `validationContract`, `arrayValidationMode` for consumers |
| **arrayValidationMode preservation** | Parameterized import now preserves ordered/unordered mode from metadata on the DataSource |

#### 2.10 Test Editor Import/Export UI Consolidation (2026-05-02)

Simplified the toolbar button layout to remove duplication between Test Editor top bar and DataSource bottom bar:

**Before:**
- Top bar: Builder | cURL Import | cURL Export | **Import** (test def) | **Export** (test def) | **Export Template** | Cancel | Save
- Bottom bar: Sequential ▼ | Configure | Contract | **Import** (data rows) | **CSV** | **JSON** | Remove

**After:**
- Top bar: Builder | cURL Import | cURL Export | **Import** | **Export** | Cancel | Save
- Bottom bar: Sequential ▼ | Configure | Contract | Remove

Import and Export are now **tab modes** (consistent with Builder / cURL Import / cURL Export) — clicking them switches the main content panel to show available options as clickable cards:

- **Import panel:** "Test Definition" (.json) | "Data Rows" (CSV/JSON — disabled if no DataSource)
- **Export panel:** "Test Definition" (.json) | "Excel Template" (.xlsx) | "Data as CSV" | "Data as JSON" (last two disabled if no DataSource)

#### Implementation Notes (Phase 2A — Export/Import Enhancements)
- **Started:** 2026-05-02 | **Completed:** 2026-05-02
- **Files Created:**
  - `src/features/scenarios/components/ImportExportChoiceModal.tsx` — Choice modal component (types only used now, panel is inline)
- **Files Modified:**
  - `src/features/scenarios/utils/csvTemplateExcel.ts` — VIN decoding, dataRows export, column ordering, dynamic column naming, metadata contract export, columnTypes return
  - `src/features/scenarios/utils/csvTemplateTypes.ts` — Added `columnTypes`, `validationContract`, `arrayValidationMode` to `CsvParseResult`
  - `src/features/scenarios/components/CsvImportModal.tsx` — Parameterized import mode selector, `buildParameterizedTest` helper using `columnTypes` map
  - `src/features/scenarios/components/TestEditorModal.tsx` — Consolidated Import/Export as input modes with inline panels, removed separate Export Template button, added data CSV/JSON export handlers
  - `src/features/scenarios/components/DataSourceEditor.tsx` — Removed Import/CSV/JSON buttons from bottom toolbar
  - `src/styles/scenario-builder.css` — Added `.import-export-choice-*` styles
- **Tests:** 21 Excel roundtrip tests passing, 500 scenario tests passing, TypeScript clean
- **Deviations from Plan:** UI consolidation was not in original plan but addresses usability confusion from duplicate Import/Export buttons. Test Definition export now uses default version options (includes all) rather than showing a version popover.

---

### Phase 3: Execution Engine Expansion

**Priority: Critical | Effort: Medium**

#### 3.1 Data Source Row Expansion in Executor

When `executor.ts` encounters a Scenario with a `dataSource`, expand it into N concrete requests:

```typescript
// src/engine/dataSourceExpander.ts — new file

/**
 * Expand a Scenario with an attached DataSource into N concrete Scenarios,
 * one per enabled data row. Scenarios without a data source are returned as-is.
 */
export function expandDataSource(scenario: Scenario): Scenario[] {
  const dt = scenario.dataSource;
  if (!dt || dt.columns.length === 0 || dt.rows.length === 0) return [scenario];

  const enabledRows = dt.rows.filter(r => r.enabled);
  if (enabledRows.length === 0) return [scenario];

  const orderedRows = applyDistribution(enabledRows, dt.distribution);

  return orderedRows.map((row, idx) =>
    resolveScenarioFromDataRow(scenario, dt.columns, row, idx),
  );
}

/**
 * Resolve a Scenario's data source row into a concrete Scenario with
 * all variables substituted and data row metadata attached.
 * Clears dataSource on the result (already resolved), sets dataRowId/dataRowLabel.
 */
export function resolveScenarioFromDataRow(
  base: Scenario, columns: DataSourceColumn[], row: DataSourceRow, rowIndex: number,
): Scenario { ... }

/** Batch-expand a full execution queue (non-parameterized scenarios pass through). */
export function expandQueue(queue: Scenario[]): Scenario[] { ... }
```

> **Design decisions made during implementation:**
> 1. **No wrapper type:** Instead of `ExpandedScenario { scenario, dataRowId, dataRowLabel }`, the row metadata is attached directly on `Scenario` as transient `dataRowId`/`dataRowLabel` fields. This avoids refactoring all execution runners (`runSequential`, `runBatch`, `runPool`) to handle a wrapper type — they continue to take `Scenario[]`.
> 2. **Column `id` key stability:** `DataSourceRow.values` is keyed by `DataSourceColumn.id` (a stable UUID), not by `column.name`. This prevents data breakage when users rename column display names.
> 3. **Cleared after expansion:** Expanded scenarios have `dataSource: undefined` — they are concrete requests, not templates.

**Resolution logic** (`resolveScenarioFromDataRow`):
- `path:` columns → replace `{{varName}}` in URL path
- `param:` columns → set/override query parameter values
- `body:` columns → replace `{{varName}}` in request body
- `header:` columns → set/override header values
- `validate:` columns → populate `expectedFields` in validation config

#### 3.2 Integrate with Executor Queue Building

In `executor.ts`, after building and shuffling the weighted queue, expand data sources:

```typescript
// After shuffle, before execution mode dispatch
const expandedQueue = expandQueue(queue);

// Then pass expandedQueue (not queue) to runSequential/runBatch/runPool
// Workflow and load-profile modes pass through unchanged (Phase 6 integration)
```

**Interaction with weights:** When a parameterized test has weight 3 and 10 data rows:
- Weight controls how often this test is picked relative to other tests
- Each pick expands to 10 rows (or sampled if totalTransactions < full expansion)
- Distribution setting controls row order: sequential, random, or round-robin across iterations

#### 3.3 Tag Results with Data Row Context

In `requestExecution.ts`, the `executeRequest` function copies `dataRowId`/`dataRowLabel` from the Scenario to the `RequestResult`:

```typescript
return {
  // ... existing fields ...
  dataRowId: scenario.dataRowId,
  dataRowLabel: scenario.dataRowLabel,
};
```

No wrapper type needed — the transient fields on `Scenario` flow naturally through the existing execution pipeline.

#### 3.4 File Source Loading

For `source.type === 'file'`, load the file at execution time:

- **Browser:** Use File System Access API or user file picker
- **Tauri:** Read file directly from disk via `fs.readTextFile`
- Parse using existing `parseCsvToScenarios` / `parseExcelToScenarios` / `parseJsonToScenarios`
- Map parsed rows to `DataSourceRow[]` using column definitions from the Scenario's `dataSource.columns`

**Staleness detection:** Compare file modification time with `fileLastRead`. If stale, show a warning: "Data file has changed since last load. Reload?"

#### 3.5 Implementation Notes (Wave 1 Retrospective)

The following design decisions were made during Phase 1 + Phase 3 implementation and differ from the original plan:

1. **Column `id` vs `name` key stability** — Added a stable `id` (UUID) to `DataSourceColumn`. `DataSourceRow.values` is keyed by `column.id`, not `column.name`. This prevents data loss when users rename column display names. The `name` field is purely for display.

2. **`subsets` deferred to Phase 12** — The `subsets?: DataSubset[]` field was removed from the Phase 1 `DataSource` type. It will be added when Phase 12 (Row Tags & Data Subsets) is implemented. This keeps the initial type surface small and avoids premature abstractions.

3. **`distribution` made optional** — Changed from required to optional (`distribution?: ...`), defaulting to `'sequential'` when omitted. This simplifies scenario creation — users only set distribution when they need non-sequential behavior.

4. **Transient row metadata on Scenario** — Instead of a separate `ExpandedScenario` wrapper type, `dataRowId` and `dataRowLabel` were added as optional fields directly on `Scenario`. This avoids refactoring all execution runners (`runSequential`, `runBatch`, `runPool`) to handle a wrapper. The fields are "transient" — set only on expanded copies during execution, never persisted.

5. **Types kept in `src/shared/types/index.ts`** — All new types were added to the existing central type file rather than creating a separate `dataSource.ts`, matching the project's convention of a single type index.

#### 3.6 Implementation Notes (Phase 3)

**Status:** ✅ Complete (2026-05-01) | Branch: `feature/parameterized-tests`

**Files created:**
- `src/engine/dataSourceExpander.ts` — `expandDataSource()`, `expandQueue()`, `resolveScenarioFromDataRow()`, `buildRowLabel()`, `applyDistribution()`
- `src/engine/dataSourceExpander.test.ts` — 26 unit tests (all passing)

**Files modified:**
- `src/engine/executor.ts` — Added `expandQueue` import; inserted `expandedQueue = expandQueue(queue)` after shuffle; pass `expandedQueue` to `runSequential`/`runBatch`/`runPool`
- `src/engine/requestExecution.ts` — Added `dataRowId`/`dataRowLabel` propagation from `scenario` to `RequestResult` in `executeRequest()`

**Test results:** 440 engine tests passing (16 files, 0 regressions)

**Not yet implemented (deferred):**
- Section 3.4 (File Source Loading) — deferred to Phase 7
- `validate:` column resolution into `expectedFields` — deferred to Phase 8

#### 2A Implementation Notes (Phase 2 — Core)

**Status:** ✅ Complete (2026-05-01) | Branch: `feature/parameterized-tests`

**Files created:**
- `src/features/scenarios/utils/dataSourceUtils.ts` — `autoDetectColumns()`, `createEmptyDataSource()`, `createEmptyRow()`, `createEmptyColumn()`, `extractTemplateVariables()`
- `src/features/scenarios/utils/dataSourceUtils.test.ts` — 12 unit tests (all passing)
- `src/features/scenarios/components/DataSourceEditor.tsx` — Full inline data source editor with column CRUD, row CRUD, move up/down, CSV import, distribution selector, enable/disable toggles
- `src/features/scenarios/components/DataSourceEditor.test.tsx` — 16 unit tests (all passing)

**Files modified:**
- `src/features/scenarios/components/TestEditorModal.tsx` — Added `'data'` to `TestEditorTab` union type; import `DataSourceEditor`; added Data tab button with row count badge; added `activeTab === 'data'` content rendering
- `src/styles/scenario-builder.css` — Added `.data-source-editor`, `.data-source-empty`, `.data-source-grid`, `.data-source-row`, `.data-source-col-header`, `.data-source-move-btn`, `.data-source-footer`, `.data-source-preview`, and related classes (originally `.data-table-*`, renamed to `.data-source-*` in Phase 5)

**Design decisions applied:**
1. Reuses `params-editor` / `params-input` / `params-toggle` / `params-delete` CSS classes for visual consistency
2. Follows `draft` + `onDraftChange` pattern (same as all other tabs)
3. `autoDetectColumns()` is a pure utility that calls existing `analyzeUrlPath()` + `parseUrl()`
4. Column name editing is inline (click to edit, blur/Enter to commit)
5. Move up/down buttons instead of drag-to-reorder (drag deferred to 2B)
6. CSV import uses native file picker + simple comma split (RFC-4180 parsing deferred to 2B)

**Test results:** 28 new tests passing (12 utility + 16 component), tsc clean

---

### Phase 4: Runner UI Updates

**Status:** ✅ Complete (2026-05-02) | Branch: `feature/parameterized-tests`

**Priority: High | Effort: Medium**

#### 4.1 Parameterized Test Indicator in Scenario Tree ✅

`📊 N rows` badge shown next to scenarios with parameterized tests (enabled row count). Uses existing `count-badge` class with `count-badge-data` variant.

#### 4.2 Execution Summary Before Run ✅

When parameterized tests are selected, an "Expansion Summary" panel appears showing per-test breakdown: `slots × rows = requests`. When expanded total exceeds configured transactions, shows `Expanded N → capped to M requests`.

#### 4.3 Progress Enhancements ✅

During execution, per-test progress breakdown appears below the progress bar showing each test's completion count with ✓ pass / ✗ fail counts (only visible when parameterized tests are running).

#### 4.4 Weight Interaction ✅

Row count badge (`📊 N rows`) shown alongside method badge and test name in the weight distribution panel.

#### 4.5 Queue Capping ✅

Expanded queue is capped at `totalTransactions` — "10 transactions" means exactly 10 HTTP requests, even when parameterized tests expand rows. This makes the total predictable.

#### Bug Fixes (discovered during Phase 4)

- **Template variable encoding:** `replaceHost()` now preserves `{{varName}}` placeholders instead of URL-encoding them to `%7B%7B...%7D%7D`
- **Validate columns in expansion:** `resolveScenarioFromDataRow()` now builds `expectedFields` from validate columns and sets `validation.mode = 'selective'` with `unorderedArrays` propagated from `arrayValidationMode`

---

### Phase 5: Results Display Updates

**Status:** ✅ Complete (2026-05-02) | Branch: `feature/parameterized-tests`

**Priority: High | Effort: Medium**

#### 5.1 Data Row Grouping ✅

Added `dataRow` to `GroupByLevel`. Results can be grouped by `test → dataRow` showing per-row breakdown. `dataRowLabel` and `dataRowId` are searchable. Non-parameterized results fall into `(no data row)` bucket.

#### 5.2 Data Row Summary Table ✅

New `DataRowSummaryTable` component auto-appears when a leaf group contains data-row results. Features:
- **Split view** (default): Failed rows shown first (expanded), passed rows collapsed
- **Flat view**: All rows in order
- **Failures Only**: Only failed rows
- Stats bar: Pass N/M (X%) │ Avg │ P95 │ P99

#### 5.3 Failed Row Quick Filter ✅

Added "Failed Data Rows" filter option in the results filter dropdown — shows only failed results that have a `dataRowId`.

#### 5.4 Export with Data Context ✅

CSV export now includes `Data Row ID` and `Data Row Label` columns. JSON export unchanged (already included via `RequestResult` serialization).

#### 5.5 Report Generation ✅

New `reportGenerator.ts` with 3 formats:
- **HTML**: Self-contained dark-themed report with summary cards, failed/passed sections, XSS-safe escaping
- **JSON**: Structured output with `parameterized` section (totalRows, failedRowDetails) and optional response body inclusion
- **Markdown**: Summary table + failed row list — ideal for PR descriptions

"Generate Report ▾" dropdown added to results toolbar next to Export buttons.

Tests: 17 grouping tests (4 new) + 9 report generator tests = 26 passing.

---

### Phase 6: Workflow Integration
```

When `groupBy` includes `'dataRow'`, group results by `dataRowLabel`. In `buildGroups()`, add the key derivation following the existing pattern:

```typescript
// In buildGroups — existing pattern: level → key derivation
if (level === 'feature') key = r.featureGroupName || '(unknown feature)';
else if (level === 'group') key = r.groupName || '(unknown group)';
else if (level === 'test') key = r.scenarioName;
else if (level === 'dataRow') key = r.dataRowLabel || r.dataRowId || '(no data row)';
```

Results tree with dataRow grouping:

```
▼ Onboarding (Feature Group)
  ▼ Vehicle Purchase Offers (Scenario)
    ▼ Row 1: VIN=1GY..338, channel=WEBRNW    ✓ 200  150ms
    ▼ Row 2: VIN=2GY..445, channel=WEBRNW    ✓ 200  142ms
    ▼ Row 3: VIN=3GY..556, channel=DEALER    ✗ 404  89ms
```

**Integration with existing group-by dropdown:** The `ResultsDashboard` uses `groupBy`/`subGroupBy` state with `subGroupOptions` computed from the primary level. Add `dataRow` as a sub-group option when the primary group is `test`:

```typescript
// subGroupOptions — extend existing pattern
if (groupBy === 'test') return [{ value: 'dataRow', label: 'Then by Data Row' }];
// For feature → group, add: { value: 'dataRow', label: 'Then by Data Row' } when results have dataRowId
```

Non-parameterized results (where `dataRowId` is undefined) group into a single `(no data row)` bucket — they display the same as today.

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
│ Full data source included (all rows, with tags)               │
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
  includeDataSourceSnapshot: boolean; // default: true
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

**Status:** ✅ Complete (2026-05-02) | Branch: `feature/parameterized-tests`

**Priority: Medium | Effort: Medium**

#### 6.1 Data Source on Workflow HTTP Nodes

Extend `HttpNodeData` in workflow types:

```typescript
export interface HttpNodeData {
  // ... existing fields ...
  
  /** Optional data source for parameterized execution of this HTTP node. */
  dataSource?: DataSource;
}
```

When an HTTP node in a workflow has a data source, the graph runner should:
- **Single run (Quick Test):** Execute the node once per enabled data row, collecting results for each
- **Load test (Harness):** Each workflow iteration picks one row (round-robin or random)

#### 6.2 Loop Node + Data Source Integration

The existing Loop node (type: `forEach`) already supports iterating over arrays. A natural integration:

```
[Start] → [Loop (forEach: dataRows)] → [HTTP Node (uses {{item.vin}}, {{item.channel}})] → [End]
```

When a Loop node's `sourceExpression` references a data source, the graph runner injects data rows as the iterable collection. Each iteration sets `{{item.vin}}`, `{{item.channel}}`, etc. from the current row.

This requires no new node types — just the ability for Loop nodes to reference a data source as their source.

#### 6.3 Data Source as Workflow Variable Source

Add support for data sources at the workflow level (not just per-node):

```typescript
export interface Workflow {
  // ... existing fields ...
  
  /** Workflow-level data sources — accessible to all nodes via variables. */
  dataSources?: DataSource[];
}
```

**Use case:** A workflow that tests user registration → login → profile update, with 100 different user/password combinations. The data source feeds variables into the workflow's `VariableContext`, and each HTTP node references `{{username}}`, `{{password}}`.

#### 6.4 Implementation Notes (Phase 6)

- **Started:** 2026-05-02 | **Completed:** 2026-05-02
- **Files Modified:**
  - `src/features/workflow/types/workflow.ts` — Added `dataSource?: DataSource` to `HttpNodeData` and `LoopNodeData`
  - `src/features/workflow/engine/graphRunnerNodeHandlers.ts` — Extracted `logHttpResult()` helper; added data-source expansion path in `handleHttpNode`; added inline `data.dataSource` support in `handleLoopNode` forEach mode
  - `src/features/workflow/engine/graphRunnerHelpers.ts` — Added `dataRowId`/`dataRowLabel` propagation from expanded scenario to `RequestResult` in `executeHttpNode`
  - `src/features/workflow/engine/graphRunner.ts` — Engine runs with inline data sources per node (no shared `dataSources` parameter)
- **Tests Added:**
  - `src/features/workflow/engine/graphRunnerNodeHandlers.test.ts` — 8 new tests (data source expansion on HTTP node: basic expansion, failure propagation, logging, no-enabled-rows fallback, URL substitution; loop data source: inline iteration, fallback to sourceExpression)
- **Test Results:** 124 handler tests passing, 0 regressions, tsc clean
- **Design Decisions:**
  1. Data source on HTTP nodes uses existing `expandDataSource()` from `dataSourceExpander.ts` — same expansion logic as the test runner
  2. Loop `data.dataSource` converts enabled rows to JSON objects (column name → value) for the `item` variable, consistent with existing forEach behavior
  3. Graceful fallback: if no `dataSource` is set, falls back to `sourceExpression` parsing
  4. **Inline-per-node approach** (not shared/centralized): each node owns its own `dataSource` inline, matching Harness-style UX — simpler, more user-friendly than a shared registry

---

### Phase 6B: Workflow Data Source Config UI

**Status:** ✅ Complete (6B.1–6B.4 all done)

**Priority: Medium | Effort: Medium**

Phase 6 added engine support for data sources on workflow HTTP and Loop nodes. Phase 6B adds the UI controls so users can attach and configure data sources without touching code.

**Architecture: Inline-per-node** — Each node owns its own `dataSource` inline (like Harness parameterized tests), rather than a shared/centralized registry. This is simpler and more user-friendly.

#### 6B.1 Data Source Tab on HTTP Node Config

Add a `'data'` tab to `HttpConfig.tsx` (alongside Params / Headers / Body / Extract):

```
┌─ HTTP — Vehicle Offers ──────────────────────────────────┐
│ Params │ Headers │ Body │ Extract │ Data Source (3)       │
├──────────────────────────────────────────────────────────┤
│ ┌── Data Source ───────────────────────────────────────┐ │
│ │ ☑ │ itemId  │ channel  │ validate:$.status          │ │
│ │ ☑ │ AAA     │ WEBRNW   │ active                    │ │
│ │ ☑ │ BBB     │ DEALER   │ pending                   │ │
│ │ ☐ │ CCC     │ WEBRNW   │ (skip)                    │ │
│ └──────────────────────────────────────────────────────┘ │
│ [+ Add Row] [+ Add Column] [Import CSV]                  │
│ [Run Preview: 2 enabled rows → 2 requests per iteration] │
└──────────────────────────────────────────────────────────┘
```

**Implementation:**
- Reuse the existing `DataSourceEditor` component from `src/features/scenarios/components/DataSourceEditor.tsx`
- Add `'data'` to `HttpTab` union type in `HttpConfig.tsx`
- Read `data.scenario.dataSource` and pass it as the `draft` prop
- On change, call `onChange({ scenario: { ...s, dataSource: newDs } })`
- Show row count badge on the tab: `Data Source (N)` where N = enabled rows
- The `autoDetectColumns()` utility works unchanged — it reads the scenario's URL/headers/body

**Files modified:**
- `src/features/workflow/components/configs/HttpConfig.tsx` — added `'data'` tab + DataSourceEditor rendering

#### 6B.2 Inline Data Source on Loop Node Config

When the Loop node is in `forEach` mode, show a collapsible "📊 Data Source" section with an inline `DataSourceEditor`:

```
┌─ LOOP — Iterate Users ───────────────────────────────────┐
│ Mode: [For Each ▼]                                        │
│                                                            │
│ Source array: {{items}} (overridden by data source)        │
│ Item variable: [row]                                      │
│ Index variable: [i]                                       │
│                                                            │
│ ▾ 📊 Data Source  (3)                                     │
│ ┌── DataSourceEditor (inline) ──────────────────────────┐ │
│ │ ☑ │ userId │ role   │                                 │ │
│ │ ☑ │ U1     │ admin  │                                 │ │
│ │ ☑ │ U2     │ viewer │                                 │ │
│ └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Implementation:**
- `LoopConfig.tsx` wraps `data.dataSource` in a minimal `Scenario` for `DataSourceEditor`
- `handleDraftChange()` extracts `scenario.dataSource` back to `LoopNodeData`
- When data source has rows, source array field shows "(overridden by data source)" hint and is disabled
- Toggle button with `▾`/`▸` disclosure indicator

**Files modified:**
- `src/features/workflow/components/configs/LoopConfig.tsx` — rewritten with inline DataSourceEditor
- `src/features/workflow/types/workflow.ts` — changed `dataSourceId?: string` to `dataSource?: DataSource` on `LoopNodeData`

#### ~~6B.3 Workflow-Level Data Sources Manager~~ (Removed)

~~Originally planned as a centralized shared data source registry with toolbar button and CRUD modal.~~
**Removed in favor of inline-per-node approach.** Each node owns its own data source — simpler UX, no shared state to manage.

**Removed files/code:**
- Deleted `src/features/workflow/components/modals/WorkflowDataSourcesModal.tsx`
- Removed `dataSources?: DataSource[]` from `Workflow` type
- Removed `dataSources` from `NodeHandlerContext`, `runGraph()`, `useWorkflowExecution`, `useWorkflowPersistence`, `useWorkflowCanvasSync`
- Removed "📊 Data Sources" button from `WorkflowToolbar`
- Removed `.wf-datasources-*` CSS (~120 lines)

#### 6B.4 HTTP Node Visual Indicator

Show a small data source badge on the HTTP node in the canvas when `scenario.dataSource` is attached:

```
┌─ HTTP ─────────────────────┐
│ 📊 3 rows │ GET │ Vehicle  │
│ .../items/{{itemId}}       │
└────────────────────────────┘
```

**Files modified:**
- `src/features/workflow/components/nodes/HttpStepNode.tsx` — added `📊 N rows` badge when `data.scenario?.dataSource` has enabled rows

#### 6B.5 Implementation Notes (Phase 6B)

- **Started:** 2026-05-02 | **Completed:** 2026-05-02
- **Architecture pivot:** Started with shared/centralized data source registry (6B.3), pivoted to inline-per-node approach after UX review — simpler, matches Harness-style parameterized tests
- **UI consistency:** Removed close (×) and expand/shrink buttons from Verify & Inspect modals (`DataSourceVerifyModal`, `DataTableVerifyModal`) and Insert Variable modal (`WorkflowVariableInsertModal`) for cleaner appearance
- Added `showExpandButton` prop to `AppModalFrame` to support suppressing expand buttons
- **Test Results:** 124 handler tests passing, tsc clean, 0 regressions

---

### Phase 7: File Source Management (CSV / Excel / JSON)

**Priority: Medium | Effort: Small**

All three file formats are first-class citizens — CSV (`.csv`), Excel (`.xlsx`), and JSON (`.json`). The existing parsing pipelines (`csvTemplateCsv.ts`, `csvTemplateExcel.ts`, `csvTemplateJson.ts`) are reused and extended for data source file sources. Both import and export support all three formats, so users can choose whichever their workflow prefers.

| Format | Parser (existing) | Generator (existing) | Notes |
|---|---|---|---|
| CSV | `parseCsvToScenarios` | `generateCsvTemplate` | Simplest; universal tool support |
| Excel (.xlsx) | `parseExcelToScenarios` | `generateExcelTemplate` | Styled sheets, metadata tab, column-type prefixes |
| JSON | `parseJsonToScenarios` | `generateJsonTemplate` | Best for CI/CD pipelines, programmatic generation |

#### 7.1 File Picker in Data Source Editor

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

#### 7.4 Implementation Notes (Completed 2026-05-03)

**What was implemented:**
- **Import button** in DataSourceEditor toolbar accepts `.csv`, `.xlsx`, `.xls`, `.json` files
- **Export buttons**: CSV, Excel (.xlsx), JSON — all in the toolbar action bar
- **File origin tracking**: `DataSourceOrigin` metadata (`filePath`, `fileLastRead`, `fileRowCount`) set on import
- **File source info bar**: When `source.type === 'file'`, shows file name, import timestamp, row count, Reload button, and "Switch to Inline" link
- **Excel fallback parsing**: `parseExcelSimple()` reads generic spreadsheets (first row = headers) when `parseExcelToScenarios()` fails (non-template format)
- **Column auto-mapping**: `buildColumnsAndRowsFromParseResult()` and `parseExcelSimple()` both match imported headers against existing columns and detect type prefixes (`path:`, `param:`, `expect:`, `header:`, `body:`)

**What was deferred:**
- 7.3 File Watch (Tauri only) — requires Tauri file watcher API
- Column mapping UI wizard (7.2 manual remapping for unmatched columns)
- Source type radio toggle (Inline vs File) — currently managed implicitly via import action

---

### Phase 8: Capture & Validate Flow

**Priority: Medium | Effort: Medium**

#### 8.1 "Run & Capture" Mode

Add a button to the Data Source editor: **"Run & Capture"**

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

**Trigger:** "Pre-Validate Data" button in the Data Source editor toolbar (next to "Run & Capture").

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
- ☐ Remove failed rows from the data source
- ☐ Export failed rows to CSV for external review
- ☐ Fix and re-validate (edit values inline, then re-run pre-validation on failed rows only)
- ☐ **Update validation rules per row** (see 8.4 below)

#### 8.4 Inline Validation Rule Editing from Pre-Validation Results

When pre-validation reveals failures, users often need to **adjust the expected values** — the data was correct, but the expectation was wrong (e.g., a product's price changed, a user's status was updated). Instead of navigating back to the data source, editing blind, and re-running, the user can fix validation rules **directly from the pre-validation results panel**.

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
| **Update to "..."** | Overwrites the `validate:` column value in the data source with the actual response value. The row now expects the new value. |
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

#### 8.5 Implementation Notes (Completed 2026-05-02)

**What was implemented in DataSourceVerifyModal:**
- **Run & Capture button** — executes all enabled rows sequentially, extracts values via JSONPath for all validate columns, populates cells in the data table as baselines
- **Warn status (`'warn'`)** — rows that return HTTP 2xx but have no validate column values get 🟡 instead of ✓, with a message suggesting adding validate columns or running capture
- **Update Expected per-cell** — each failed cell in the diff table has an "Update" button that overwrites the expected value with the actual API response
- **Accept All Changes per-row** — button on each failed row to accept all mismatches at once
- **Accept All Changes global** — footer button to update all failed rows across the entire result set
- **actualCells tracking** — `VerifyResult` now captures actual extracted values for ALL validate columns (not just failed ones) to support future bulk operations

**What was deferred:**
- 8.4 Inline Validation Rule Editing (manual edit input, remove validation per cell) — can be added as follow-up
- Bulk pattern grouping ("12 rows failed on validate:$.status") — future UX enhancement
- Pre-validation status icons on DataSourceEditor table rows (🟢🟡🔴 in the row itself) — requires passing verify results back to the editor

---

### Phase 9: CLI Support

**Priority: Low | Effort: Small**

#### 9.1 CLI Data Source Execution

The CLI (`cli/index.ts`) should support:

```bash
redfireforge run --scenario "Vehicle Purchase Offers" --data ./vehicles.csv
```

- `--data` overrides the inline data source with an external file
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

Add new entries to `testSampleCatalog` (or a new `parameterizedTestCatalog`) with pre-populated `DataSource` objects. Each sample demonstrates a different data-driven pattern at increasing difficulty:

| Sample | Difficulty | API | Data Source Pattern | Rows |
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
        dataSource: {
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
  tags: ['parameterized', 'data-driven', 'users', 'jsonplaceholder', 'data-source'],
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
| `parameterized-basics-easy.html` | Easy | `data-driven/` | Introduction to data sources: create a 3-row table, run, view grouped results |
| `parameterized-file-import-easy.html` | Easy | `data-driven/` | Import CSV/Excel/JSON file as data source |
| `parameterized-validation-medium.html` | Medium | `data-driven/` | Add validation columns, run & capture baselines, detect regressions |
| `parameterized-pre-validate-medium.html` | Medium | `data-driven/` | Pre-validate bulk data against real API before running full test |
| `parameterized-workflow-advanced.html` | Advanced | `data-driven/` | Attach data source to workflow HTTP nodes, loop over data rows |
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
- Filters the data source to only the failed `dataRowId` values
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
  const dt = baseScenario.dataSource;
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

Tags turn a flat data source into a categorized test matrix. Users can tag rows, then run only specific subsets — "run all edge cases," "run only US region," "run happy-path only."

#### 12.1 Row Tags

Each `DataSourceRow` gets an optional `tags` field:

```typescript
export interface DataSourceRow {
  id: string;
  values: Record<string, string>;
  enabled: boolean;
  /** User-assigned tags for categorization and filtered execution */
  tags?: string[];
  /** Optional note/annotation for this row */
  note?: string;
}
```

#### 12.2 Tag UI in Data Source Editor

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

export interface DataSource {
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

This lets users do targeted regression passes without editing the data source.

---

### Phase 13: Edge Case Auto-Generation

**Priority: Medium | Effort: Medium**

This is a unique differentiator — no competitor offers it. Given a column's data type and sample values, auto-generate boundary/negative/edge-case rows to catch what manual data misses.

#### 13.1 Column Type Inference

When a user creates or imports a data source, infer column types from existing values:

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
- Rows are added to the existing data source, not replacing anything

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
  columns: DataSourceColumn[],
  existingRows: DataSourceRow[],
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

### Phase 14: Chained Data Capture (API Response → Data Source)

**Priority: Medium | Effort: Medium**

Use one API's response as the data source for another test — a common real-world pattern. "Fetch all users, then test each user's profile endpoint."

#### 14.1 Concept

```
Step 1: GET https://jsonplaceholder.typicode.com/users
        → Response: [{ id: 1, name: "Leanne" }, { id: 2, name: "Ervin" }, ...]

Step 2: Auto-populate data source from response array:
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

In the Data Source editor, add a button: **"Populate from API Response"**

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

| Pattern | Source API | Data Source Test |
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

The existing Export Template → Edit → Import flow is preserved and enhanced to bridge with the new DataSource concept. The same `CsvTemplateExportModal` and `CsvImportModal` components are extended — not replaced.

#### Export Enhancements

| Scenario | Current Behavior | Enhanced Behavior |
|---|---|---|
| Test **without** DataSource | Exports a template with 1 sample row | Same (no change) |
| Test **with** DataSource (inline) | N/A (new) | Exports pattern + all data rows as a batch template. Metadata sheet stores column type mappings. Data sheet contains all enabled rows. |
| Test **with** DataSource (file source) | N/A (new) | Exports pattern + metadata only (no data rows). Metadata sheet includes `fileSource: /path/to/file.csv` reference. |

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
│   ◉ Parameterized test (1 test with 100-row data source)      │
│   ○ Individual tests (100 separate Scenario clones)           │
│                                                               │
│ [Cancel]                                    [Import]          │
└───────────────────────────────────────────────────────────────┘
```

- **Parameterized test** (new default): Creates one `Scenario` with a `DataSource` containing the imported rows. Pattern (URL, headers, auth, body template) is reconstructed from the metadata sheet. Validation columns (if present) populate `validate:` columns in the data source.
- **Individual tests** (legacy): Creates N separate `Scenario` objects via `buildScenarioFromRow()` — same as current behavior.

#### Round-Trip Fidelity

A full round-trip is now supported:
1. Create a parameterized test with data source
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
- HTTP nodes with data sources are expanded per-row
- Each workflow iteration can pick different data rows
- Results are tagged with both `workflowNodeId` and `dataRowId`

### 5.5 Shared / Reusable Data Sources

A single data source can be referenced by multiple tests — change the data once, all tests update. This avoids duplicating the same 100-row dataset across 5 tests that hit different endpoints but share the same parameter space (e.g., same VINs tested against `/offers`, `/status`, `/enrollment`).

#### Storage Model

```typescript
// src/shared/types/index.ts

export interface SharedDataSource extends DataSource {
  /** Human-readable name: "Production VIN Set" */
  name: string;
  /** Which Scenario IDs reference this table */
  referencedBy: string[];
}
```

Shared data sources are stored at the `FeatureGroup` level (sibling to `scenarios`):

```typescript
export interface FeatureGroup {
  // ... existing fields ...
  /** Shared data sources available to all scenarios in this group */
  sharedDataSources?: SharedDataSource[];
}
```

A `Scenario` references a shared table via ID instead of embedding it:

```typescript
export interface Scenario {
  // ... existing fields ...
  dataSource?: DataSource;
  /** Reference to a shared data source (mutually exclusive with inline dataSource) */
  sharedDataSourceId?: string;
}
```

#### UI

In the Data Source tab, source selector adds a third option:

```
Source: ○ Inline  ○ CSV/Excel/JSON File  ◉ Shared Table
        [Production VIN Set (100 rows) ▼]
        
        Also used by: Vehicle Offers, Enrollment Check, Status API
```

The shared table is edited from a central location (FeatureGroup settings or a dedicated "Data Sources" tab on the test editor), and changes propagate to all referencing tests automatically.

### 5.6 Environment-Specific Data Sets

Different environments have different valid data — dev has test user IDs 1–10, staging has 100–200, production has real VINs. Rather than maintaining separate data sources per environment, allow **environment-scoped row filtering**.

#### Approach A: Environment Column

Add an `env` column type to `DataSourceColumn`:

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

- `dataSource` is optional on `Scenario` — existing scenarios work unchanged
- `dataRowId`/`dataRowLabel` are optional on `RequestResult` — existing results work unchanged
- All new types are additive
- Storage format remains JSON — new fields are naturally persisted (now via IndexedDB for feature groups)

### 6.2 Migration Path from N-Clone Pattern

For users who already have N cloned Scenarios from the current Export/Import flow, offer a **"Merge to Parameterized"** utility:

1. User selects multiple Scenarios in the same TestScenario group
2. Tool detects the common pattern (same URL structure, headers, auth, body)
3. Extracts varying parts into columns, merges into one Scenario with a DataSource
4. Removes the N clones, replaces with the single parameterized test

This is a quality-of-life feature for Phase 2 or later.

---

## 7. Priority Sequencing

| Phase | Name | Priority | Effort | Depends On |
|---|---|---|---|---|
| 1 | Data Source Core (types) | Critical | Small | — |
| 2 | Inline Data Source Editor (+ Smart Paste, Bulk Ops) | Critical | Large | Phase 1 |
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
| 15 | Adaptive Tabs + Create Parameterized Copy | High | Small | Phase 1, 2 |
| 16 | QA Handoff Workflow (Wizard Step 3 + Sample Rows) | High | Medium | Phase 2 |

**Recommended implementation order:**

```
Phase 1 (types)
  ├─→ Phase 2 (editor + paste + bulk) ─┬─→ Phase 4 (runner UI) ─→ Phase 11 (re-run failed)
  │                                     ├─→ Phase 7 (file sources)
  │                                     ├─→ Phase 12 (tags) ─→ Phase 13 (edge case gen)
  │                                     ├─→ Phase 14 (chained capture)
  │                                     ├─→ Phase 15 (adaptive tabs + create param copy)
  │                                     ├─→ Phase 16 (QA handoff: Step 3 + samples)
  │                                     └─→ ...
  └─→ Phase 3 (engine) ────────────────┬─→ Phase 5 (results)
                                        ├─→ Phase 8 (capture + pre-validate) ─→ Phase 10 (gallery)
                                        ├─→ Phase 6 (workflow)
                                        └─→ Phase 9 (CLI)
```

**Wave 1 (Critical):** 1 → 2 + 3 (parallel)
**Wave 2 (High):** 4 + 5 + 11 + 15 + 16 (parallel, builds on Wave 1)
**Wave 4 (Medium-core):** 7 + 8 + 12 (parallel)
**Wave 5 (Medium-advanced):** 10 + 13 + 14 + 6 (parallel)
**Wave 6 (Low):** 9

---

## 8. Design Principles

1. **One pattern, many data.** A parameterized test is ONE test definition with attached data, not N clones. Changes to the pattern (URL, headers, auth, body structure) automatically apply to all data rows.

2. **Data is first-class.** Data rows are visible, editable, and manageable within the UI — not hidden behind an export/import round-trip.

3. **Backward compatible.** All existing tests, exports, imports, and results continue to work unchanged. Data tables are purely additive.

4. **Reuse existing infrastructure.** The CSV/Excel parsing pipeline (`csvTemplateShared.ts`, `csvTemplateExcel.ts`) is reused for file source loading. The `{{variable}}` resolution system is reused for data injection. The existing result grouping system is extended, not replaced.

5. **Progressive complexity.** Simple case (3 rows inline) requires zero knowledge of files or column types. Advanced case (10K rows from Excel with file-watch) builds on the same model. Users start simple and grow.

6. **Validation is optional — always.** A data source works perfectly without any `validate:` columns. When no validations exist, the test runs as a **pure smoke test** — each row is executed and the result is pass/fail based on HTTP status code only (2xx = pass, 4xx/5xx = fail). Users can add validation columns at any time via "Run & Capture" (auto-populate from live responses) or manually. The system never forces users to define expected values. This means:
   - A 100-row data source with zero `validate:` columns → 100 smoke tests (HTTP status check only)
   - A 100-row data source with `validate:$.status` column → 100 regression tests (status code + field value)
   - Pre-validation mode shows 🟡 (warn) for rows without validation columns to distinguish from fully validated 🟢 (pass) rows

---

## 9. Non-Goals (Out of Scope)

- **Database-driven data sources** — No JDBC, MongoDB, or other database connectors. Data comes from inline tables, CSV/Excel/JSON files, or API responses (Phase 14) only.
- **Full faker/factory library** — Edge case auto-generation (Phase 13) suggests boundary values from column analysis, but does not include a general-purpose data generation library (no random names, addresses, etc.)
- **Cross-test data dependencies** — Each parameterized test is self-contained; no data flow between different parameterized tests (workflows handle inter-step dependencies)
- **Spreadsheet-level formulas** — Data table cells are plain strings, not computed values. No `=SUM()`, `=IF()`, or cell references.
- **Real-time collaborative editing** — Data tables are local; no multi-user sync or conflict resolution
- **Data table version control** — No built-in git-like history for data source changes (use standard file versioning for external CSV/Excel files)

---

### Phase 15B: IndexedDB Persistence Fix

#### Problem
localStorage has a ~5MB quota. With 18 Feature Groups containing 388+ parameterized tests (~700KB JSON), the total localStorage usage exceeded the quota. Adding test #389 triggered a `QuotaExceededError`, silently dropping all feature group data on refresh. This caused parameterized test data to "disappear" after conversion.

#### Root Cause
`saveFeatureGroups()` in `storage.ts` wrote feature groups as a single JSON blob to localStorage key `perf-test-v3-feature-groups`. Combined with other app keys (test runs, requests, catalogs, workflows, auth profiles), total localStorage exceeded ~5MB.

#### Solution
Migrated feature group storage from localStorage to IndexedDB (50MB+ capacity):

1. **Shared IDB connection** — `idbOpen.ts` provides a single `openDB()` for the "redfireforge" DB at version 2. Both `idbTestRuns.ts` (v1 store) and `idbFeatureGroups.ts` (v2 store) share this connection to avoid upgrade race conditions.
2. **3-second timeout** — If IDB is stuck (corrupted state, DevTools lock, stale tab connections), `openDB()` rejects after 3s. The rejected promise is cached so subsequent callers get instant rejection rather than sequential 3s waits.
3. **`onblocked` handler** — If another tab holds an old connection, the handler deletes the DB and retries with a fresh one.
4. **`onversionchange` listener** — Active connections close themselves when another tab triggers an upgrade.
5. **Automatic migration** — On first load, data migrates from localStorage to IDB. localStorage copy is cleared on first successful IDB save.
6. **Graceful fallback** — If IDB is unavailable (timeout, error, test environment), all operations fall back to localStorage transparently.

#### Implementation Notes (Phase 15B)
- **Started:** 2026-05-03 | **Completed:** 2026-05-03
- **Branch:** `feature/parameterized-tests`
- **Files Created:**
  - `src/shared/utils/idbOpen.ts` — Shared IDB connection with timeout, onblocked, onversionchange
  - `src/shared/utils/idbFeatureGroups.ts` — IDB load/save/migrate for feature groups
  - `e2e/idb-loading.spec.ts` — Playwright tests: clean load, migration, blocked IDB fallback
- **Files Modified:**
  - `src/shared/utils/storage.ts` — `saveFeatureGroups()` and `loadFeatureGroups()` now use IDB-first with localStorage fallback
  - `src/shared/utils/idbTestRuns.ts` — Removed local `openDB()`, now imports from `idbOpen.ts`
  - `src/features/scenarios/hooks/useProjects.ts` — Fixed env persistence (Gallery Samples revert on refresh)
  - `src/features/scenarios/components/DataSourceEditor.tsx` — Added resize handle to ROW NAME column
- **Tests Added:**
  - `e2e/idb-loading.spec.ts` — 3 tests (clean load, localStorage migration, blocked IDB timeout fallback)
  - `e2e/page-persistence.spec.ts` — 4 tests (env selection persistence across refresh)
  - `src/shared/utils/storage.test.ts` — 105 tests pass (existing, updated for IDB fallback)
- **Deviations from Plan:**
  - Original plan assumed FGs would stay in localStorage with a "use file source for 500+ rows" guidance. Reality: even moderate usage (18 FGs, 388 tests) exceeded localStorage quota when combined with other app data. IDB migration was necessary, not optional.
  - Two separate `openDB()` functions (one per IDB module) caused upgrade race conditions — extracted shared `idbOpen.ts`.
  - Added 3-second timeout because IDB can hang indefinitely with corrupted state or DevTools locks.
- **Env Persistence Fix (bonus):**
  - Root cause: `useWorkflowResolvers.ts` restored workflow's `lastSelectedEnvId` (Gallery Samples) on initial mount
  - Fix: Guard with `wasSwitch = prevWfIdForEnv.current !== null` — only restore on actual workflow switch
- **Follow-ups:**
  - Consider migrating other large localStorage keys (requests, catalog) to IDB if quota issues recur

### Phase 16B — Verify & Inspect: Auth Fix + Error Detail + E2E (2026-05-03)

- **Validation mode label rename:** Changed "None/Selective/Full" → "No Rows/Sample Rows Only/All Rows" across DataSourceSetupModal, DataSourceEditor, and TestRunner to avoid confusion with Test Validation tab terminology
- **`{{placeholder}}` leak fix:** `applyParamColumns` in `dataSourceExpander.ts` now runs `substituteVariables()` first (replacing `{{placeholder}}` with values including empty strings), then uses `new URL()` for encoding. Previously skipped empty values, leaving `{{varName}}` in URL which got URL-encoded to `%7B%7BvarName%7D%7D`
- **Error detail display:** Verify modal error rows now show resolved URL, response body (pretty-printed JSON), and request headers. DataSourceEditor inline fetch error banner also shows URL and response body
- **Verify modal transparency:** Modal overlay is fully transparent with no backdrop blur; modal itself has glass-effect (92% opacity + `backdrop-filter: blur(12px)`); row cards and summary bar use semi-transparent backgrounds. Background content is visible immediately on open (matches dragged-modal visual)
- **E2E tests (`e2e/parameterized-verify.spec.ts`):**
  1. "Verify All sends Authorization header for inherited OAuth2 auth" — intercepts `/__proxy`, verifies `Authorization: Bearer` present
  2. "Verify All resolves empty param values without {{placeholder}} leak" — verifies no `%7B%7B` in URL
  3. "Inline fetch (⚡ button) sends Authorization header" — verifies ⚡ button includes auth
- **Key finding:** E2E tests initially failed because localStorage key `perf-test-v3-global-auth-profiles` was wrong (correct key: `perf-test-global-auth-profiles`). After fixing, all 3 tests pass — confirming auth IS sent correctly through the proxy
- **Known issue:** Verify modal "Request Headers" display shows pre-auth headers (captured from `buildHeaders()` before `handleFetchRow` adds Authorization). Needs fix to show actual sent headers

---

## 11. Phase Status Tracker

| Phase | Name | Status | Started | Completed | Commits |
|---|---|---|---|---|---|
| 1 | Data Source Core (types) | ✅ Complete | 2026-05-01 | 2026-05-01 | feature/parameterized-tests |
| 2A | Data Source Editor — Core | ✅ Complete | 2026-05-01 | 2026-05-02 | feature/parameterized-tests |
| 2B | Data Source Editor — Bulk Ops + Drag | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 2C | Data Source Editor — Search + Polish | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 3 | Execution Engine Expansion | ✅ Complete | 2026-05-01 | 2026-05-01 | feature/parameterized-tests |
| 4 | Runner UI Updates | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 5 | Results Display + Report Generation | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 6 | Workflow Integration | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 6B | Workflow Data Source Config UI | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 7 | File Source Management (CSV/Excel/JSON) | ✅ Complete | 2026-05-03 | 2026-05-03 | feature/parameterized-tests |
| 8 | Capture & Validate + Pre-Validation | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 9 | CLI Support | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 10 | Gallery Samples & Training Manuals | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 11 | Re-run Failed Rows | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 12 | Row Tags & Data Subsets | ✅ Complete | 2026-05-02 | 2026-05-02 | feature/parameterized-tests |
| 13 | Edge Case Auto-Generation | ❌ Removed | 2026-05-03 | 2026-05-03 | feature/parameterized-tests |
| 14 | Chained Data Capture (API → Table) | ❌ Removed | 2026-05-03 | 2026-05-03 | feature/parameterized-tests |
| 15 | Adaptive Tabs + Create Parameterized Copy | ✅ Complete | 2026-05-02 | 2026-05-03 | feature/parameterized-tests |
| 15B | IndexedDB Persistence Fix | ✅ Complete | 2026-05-03 | 2026-05-03 | feature/parameterized-tests |
| 16 | QA Handoff Workflow (Wizard Step 3 + Sample Rows) | ✅ Complete | 2026-05-03 | 2026-05-03 | feature/parameterized-tests |
| 16B | Verify & Inspect — Auth Fix + Error Detail + E2E | ✅ Complete | 2026-05-03 | 2026-05-03 | feature/parameterized-tests |
| 17 | Backlog Polish Items | ✅ Complete | 2026-05-03 | 2026-05-03 | feature/parameterized-tests |
| 18 | Docs / Samples / Training Manuals Refresh | ✅ Complete (Core) | 2026-05-02 | 2026-05-04 | feature/parameterized-tests |
| 19A | Populate from API Response | ✅ Complete | 2026-05-03 | 2026-05-03 | feature/parameterized-tests |
| 19B | Shared Data Sources (Full Redesign) | ✅ Complete | 2026-05-03 | 2026-05-04 | feature/parameterized-tests |
| 19C | Environment-Specific Data Filtering | ❌ Removed | 2026-05-03 | 2026-05-03 | — |

> **Note:** Phase 19B (Shared Data Sources) was fully redesigned and completed. See [shared-data-sources-plan.md](./shared-data-sources-plan.md) for the detailed 10-phase implementation plan, which covers: Data Model & Storage, Hook Extraction, SharedDataSourceModal (Shell, Editor, Fetch Config), Promote/Demote Workflows, Create Test from Shared DS, Migration & Cleanup, Unit & E2E Tests, and Gallery Samples & Training Manuals.

---

## 12. Success Criteria

### Core (Phases 1–5)
- [x] User can add a Data Source tab to any test and define columns + rows inline
- [x] Data table columns auto-detect from URL path variables and query parameters
- [x] Execution engine expands one Scenario + N data rows into N concrete requests
- [x] Each result is tagged with `dataRowId` and `dataRowLabel`
- [x] Results dashboard groups parameterized test results by data row
- [x] Failed rows are instantly filterable in results view

### Data Management (Phases 2, 7, 12)
- [x] Smart paste from Excel/Google Sheets/Notion detects TSV/HTML and maps columns
- [x] Bulk select, enable/disable, delete, tag, find & replace across rows
- [x] Search/filter rows by text, tag, or pre-validation status within the data source
- [x] Row-level notes/annotations visible in the table
- [x] CSV, Excel (.xlsx), and JSON files can be linked as external data source (all three formats)
- [x] Row tags with built-in suggestions (happy-path, edge-case, negative, boundary)
- [x] Named data subsets for filtered execution ("US Only", "Edge Cases")

### Execution & Results (Phases 5, 8, 11, 14)
- [x] Results view splits parameterized test rows into **Failed** (expanded) and **Passed** (collapsed) batches with colored headers
- [x] Four result view modes: Split (default), Flat, Failures Only, Comparison
- [x] Expanding a failed row shows full request/response detail and validation diff
- [x] "Run & Capture" pre-populates validation columns from live responses
- [x] "Pre-Validate Data" runs all rows against the real API and shows pass/warn/fail per row
- [x] Pre-validation with no validation columns shows 🟡 warn (smoke test), not 🟢 pass
- [x] Pre-validation failure results show inline "Update Expected" / "Ignore" / "Remove" per assertion
- [x] Bulk update validation rules across rows with identical failure patterns
- [x] "Re-validate Updated Rows" re-runs only rows whose validation was modified
- [x] Validation is fully optional — tests run as smoke tests (status-only) when no `validate:` columns exist
- [x] "Re-run Failed" re-executes only failed rows and merges results back
- [x] Selective row re-run — cherry-pick specific rows to re-test
- [ ] "Populate from API Response" extracts an array from one API call into the data source
- [x] "Generate Report" produces self-contained HTML, PDF, JSON, or Markdown reports
- [x] HTML report includes summary, failed/passed tables, charts (pie + response time), and data source snapshot
- [x] Auto-report option: auto-save report to file when test finishes

### Intelligent Features (Phase 13)
- [ ] Column type inference from existing values (integer, email, enum, country-code, etc.)
- [ ] Edge case auto-generation suggests boundary, negative, empty, and format-violation rows
- [ ] Auto-generated rows are tagged `auto-edge` for easy filtering

### Export/Import (Section 5.1)
- [x] Export batch template produces .xlsx, .csv, or .json with metadata + data rows
- [x] Import batch template offers "Parameterized test" vs "Individual tests" import mode
- [x] Existing Export Template / Import Template flows continue to work (backward compatible)
- [x] Full round-trip: create → export → edit externally → re-import preserves pattern
- [x] JSON export follows `ParameterizedTestJson` schema (version, metadata, columns, validation, rows)
- [x] JSON import validates schema, maps columns, reconstructs DataSourceConfig
- [x] JSON handles complex values natively (nested objects, arrays, null) without escaping issues
- [x] CSV export encodes `expect:$response` column as properly escaped JSON strings

### Adaptive Tabs & QA Handoff (Sections 3.5–3.9)
- [x] Tab visibility adapts based on `dataSource` presence and shape (no ScenarioType enum)
- [x] Validation/Extract tabs hidden when data source has `validate:` columns
- [x] Create menu offers "+ Test" and "+ Parameterized Test" buttons per scenario
- [x] "+ Parameterized Test" creates blank test and auto-opens Data Source Setup Wizard
- [x] "Create Parameterized Copy →" button on test editor duplicates test with data source
- [x] Copy sets optional `sourceTestId` for backlink badge in tree view ("🔗 from source" tag)
- [x] 📋 icon in tree view for tests with data source ("Parameterized" badge)
- [x] Wizard Step 3: validation mode selection (None / Full / Selective)
- [x] Wizard Step 3: "Fetch Sample Response" + JsonPathBuilder for field selection
- [x] Selected fields generate `validate:` columns in data source
- [x] Sample row creation: enter inputs → Fetch → auto-fill expects → save as sample
- [x] Sample rows visually distinguished (badge/highlight) in Data Source Editor
- [x] Runtime validation mode override in Run Options panel
- [x] "No Body Validation" run skips `validate:` columns even if they exist in data

### Advanced (Phases 5.5, 5.6, 6, 10)
- [ ] Shared data sources referenced by multiple tests, edited centrally
- [ ] Environment-specific data filtering via tags or dedicated env column
- [x] Gallery includes 6+ parameterized test samples using real public APIs (no setup required)
- [x] Training manuals cover data source basics, file import, validation, pre-validation, and workflow integration
- [ ] Sample data files ship in `test-data/` in CSV, Excel, and JSON formats
- [x] Workflow HTTP nodes support data sources for per-row execution

### CLI (Phase 9)
- [x] CLI supports `--data` flag to override inline data with external file
- [x] CLI supports inline `data:` block in YAML/JSON test definitions
- [x] CLI supports `--scenario` flag to filter to specific test
- [x] CLI outputs data row breakdown in console summary
- [x] CLI includes `dataRowLabel` in JUnit XML testcase names
- [x] CLI includes data row summary in Markdown reports
- [x] CLI supports `--data-rows-summary` flag for CI/CD JSON output
- [x] Non-zero exit code on data row failures via `--fail-on-error`

### Performance
- [x] No performance regression: expanding 1000 data rows adds < 100ms to test startup

---

## 13. Phase 17 — Backlog Polish Items

**Status:** ✅ Complete (2026-05-03) | Branch: `feature/parameterized-tests`

All items from the original backlog have been implemented or confirmed already existing in the codebase. The remaining unchecked items in Success Criteria are deferred/future enhancements not part of the parameterized test core:

### Completed in Phase 17
- [x] Fix Verify modal "Request Headers" to show post-auth headers (Phase 17A — `sentHeaders` on HttpResponse)
- [x] Bulk failure pattern grouping in Verify modal (Phase 17B — `failurePatterns` memo + collapsible panel)
- [x] Auto-report option: auto-download report when test finishes (Phase 17C — `autoReport` + format selector in TestRunner)
- [x] CSV export uses Papa.unparse for proper escaping of JSON values in validate columns (Phase 17D)
- [x] CSV import strips type prefixes (`path:`, `param:`, `expect:`) when matching columns (bugfix for roundtrip)

### Previously Existing (confirmed during Phase 17 evaluation)
- [x] Expanding a failed row shows full request/response detail (ResponseDetailModal)
- [x] Run & Capture pre-populates validation columns (DataSourceVerifyModal.runCapture)
- [x] Pre-validation warn state for no validate columns (🟡 warn)
- [x] Inline "Update Expected" per assertion cell
- [x] "Accept All Changes" bulk update
- [x] "Re-validate Updated Rows" / refetch failed rows
- [x] Selective row re-run via ResultsDashboard → failedRowIds
- [x] Tab visibility adapts to dataSource presence
- [x] Validation/Extract tabs hidden when validate: columns exist
- [x] Create menu: "+ Test" and "+ Param Test"
- [x] "+ Parameterized Test" auto-opens Data Source Setup Wizard
- [x] JSON export/import follows ParameterizedTestJson schema
- [x] JSON handles complex values (JSON.stringify for nested objects)

### Deferred → Phase 19
The following items are tracked in Phase 19 below:
- Shared data sources edited centrally
- Environment-specific data filtering
- "Populate from API Response" array extraction

---

## 14. Phase 18 — Docs / Samples / Training Manuals Refresh

> **Status:** Largely complete via Phase 10 + Shared Data Sources Phase 10. Remaining items are documentation hygiene.

Revisit all documentation, gallery samples, and training manuals to reflect enhancements made in Phases 1–15B.

### 18.1 Gallery Samples
- [x] Review existing parameterized test gallery samples — update to use current features (tags, notes, row names, data subsets)
- [x] Ensure all gallery samples still work end-to-end with current app version
- [x] Gallery includes 7+ parameterized test samples using real public APIs (no setup required)
  - ✅ 7 parameterized samples: User Sweep, Product Search, Country Validation, Pokémon Contract, Multi-Endpoint, Row Tags Demo, Auth Rotation
  - ✅ 4 shared data source samples: Shared User IDs, Shared Product Catalog, Cross-FG Pokémon, Shared Auth Users
- [x] Add "Populate from API" gallery sample — covered by `parameterized-populate-api-medium.html` training manual
- [x] Row Tags Demo gallery sample demonstrates row tagging and filtering

### 18.2 Training Manuals
- [x] Review `docs/training-manuals/` — update all parameterized test walkthroughs for current UI
- [x] Add walkthrough for: row tags, tag filtering, named data subsets — `parameterized-advanced-features-medium.html`
- [x] Add walkthrough for: file import (CSV/Excel/JSON) into data source — `parameterized-file-import-easy.html`
- [x] Add walkthrough for: Verify All + Re-fetch workflow — `parameterized-pre-validate-medium.html`
- [x] Add walkthrough for: "Populate from API Response" — `parameterized-populate-api-medium.html`
- [x] Training manuals cover data source basics, file import, validation, pre-validation
- [x] Follow conventions in `docs/training-manuals/CONVENTIONS.md`
- [x] Shared Data Sources manuals: easy, fetch-medium, cross-fg-medium, advanced — 4 manuals completed
- [x] Add walkthrough for: creating a parameterized copy from existing test — `parameterized-create-copy-easy.html`
- [x] Add walkthrough for: re-running failed rows — `parameterized-rerun-failed-easy.html`

### 18.3 Sample Data Files
- [x] `examples/` directory has sample CSV, JSON, YAML files for data-driven tests
- [x] Sample files updated with row tags and notes columns — `users-data.csv`, `json-data-simple.json`, `parameterized-users.yaml`

### 18.4 API Docs & Plan Files
- [x] Review `docs/plan/` — `shared-data-sources-plan.md` is fully complete
- [x] Updated README.md with IndexedDB storage details and parameterized test feature summary
- [x] Updated CHANGELOG.md with all Phase 1–19B changes

> **Assessment:** ✅ All Phase 18 items are now complete. Documentation, gallery samples, sample data files, README, and CHANGELOG have all been updated.

---

## 15. Phase 19 — Advanced Data Source Features

### 19A. "Populate from API Response" Array Extraction

Add a button in the Data Source editor: **"Populate from API Response"** that calls an API, extracts an array from the JSON response (via JSONPath), and maps each element's fields to data source columns.

**Capabilities:**
- Source selection: Send a request now / Use last response from this test / Use response from another test
- JSONPath picker for the array root (e.g., `$.data`, `$` for root array)
- Auto-detect arrays in the response and suggest JSONPath options
- Field-to-column mapping UI: map response fields → `path:`, `param:`, `validate:` columns
- Preview row count before populating
- Append or replace existing rows

### 19A-2. Shared Data Sources Modal — Detailed Phase Breakdown

> **Reference:** `/docs/shared-data-sources-modal-mockup.html` — HTML mockup showing full-featured modal with fetch config, toolbar, advanced table, and integration with DataSourceEditor.

---

#### **Phase 3 (Modal Shell + List Panel)** — ✅ Complete (2026-05-03)

**Completed Features:**
- Modal frame with header (title + expand/close buttons) and footer (stats + Close button)
- Left panel: List of shared data sources
  - "+ New Shared Data Source" button at top
  - List items with name, row count, context menu (Rename/Duplicate/Delete)
  - Inline rename editing
  - Active item highlighting
  - Search/filter support (prepared for Phase 5)
- Right panel: Placeholder for editor
- Resizable vertical divider between panels (220-400px dynamic width)
- Modal geometry: Full-panel, non-movable, left sidebar visible

**Files:**
- `src/features/scenarios/components/SharedDataSourceModal.tsx` — 350+ lines
- `src/styles/shared-data-sources.css` — 200+ lines CSS
- `src/features/scenarios/ScenarioBuilder.tsx` — Button + state + render

**Tests:** 11/11 E2E passing (covers geometry, list CRUD, resize, empty state)

---

#### **Phase 4 (Editor Header + Fetch Configuration)** — ✅ Complete

**Effort:** 2-3 hours
**Pattern:** Reuse existing request builder and scenario API-population modules (do not create new parsers)

**Concrete Reuse Targets (already in repo):**
- cURL parser: `parseCurl` from `src/shared/utils/curlParser.ts`
- cURL import UI pattern: `RequestEditor` cURL import flow in `src/features/requests/components/RequestEditor.tsx`
- Response-to-rows detection/mapping flow: `PopulateFromApiModal` in `src/features/scenarios/components/PopulateFromApiModal.tsx`
- Data-source fetch/re-fetch + validate extraction: `useDataSourceFetch` in `src/features/scenarios/hooks/useDataSourceFetch.ts`
- JSON path + flatten helpers: `extractJsonPath` and `expandPatternFromResponse` in `src/features/scenarios/utils/dataSourceImport.ts`

**User Flow (Updated):**
1. **Input Stage (Manual or cURL):**
  - Keep URL/method/headers/body editor inline in Shared Data Sources panel
  - Add "Import cURL" action that calls existing `parseCurl(...)`
  - Parsed values patch `shared.fetchConfig` directly

2. **Fetch & Preview Stage:**
  - Use existing scenario fetch stack (`proxyFetch`/`onFetchRow` pattern used by `PopulateFromApiModal` and `useDataSourceFetch`)
  - Show response status + compact preview and fetch errors

3. **Field Selection Stage (Reuse mapping UX):**
  - Reuse array detection + mapping behavior from `PopulateFromApiModal`
  - User chooses array path and enables/disables extracted fields
  - Build columns/rows using existing DataSource shapes (`values: Record<colId, string>`)

4. **Persist + Apply:**
  - Save request config in `SharedDataSource.fetchConfig`
  - Apply mapped rows into `shared.dataSource` (append/replace)
  - Ensure compatibility with later toolbar actions: "From API", "Verify All", "Re-fetch"

**Data Structure (Reuse Existing Type):**
Use existing `SharedDataSourceFetchConfig` from `src/shared/types/index.ts` (already defined):
```typescript
export interface SharedDataSourceFetchConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: KeyValue[];
  body?: string;
  bodyType?: BodyType;
  auth?: AuthConfig;
}
```

**Implementation Plan (Concrete Tasks):**
1. **Wire cURL import into SharedDataSourceModal**
  - Add cURL input panel/toggle
  - Call `parseCurl` and map output to `fetchConfig`
  - Preserve existing name/url if fields are missing in cURL

2. **Attach fetch config editor to selected shared source**
  - URL + method + headers + body controls
  - Use same input styling/pattern as request builder
  - Write through `onUpdate` for selected shared source

3. **Hook Populate-from-API behavior**
  - Reuse `PopulateFromApiModal` logic directly or extract shared helper from it
  - Keep selected array + field mapping + append/replace flow
  - Ensure rows initialize all column IDs to empty strings before mapping

4. **Connect re-fetch/verify compatibility**
  - Keep fetchConfig schema aligned with `useDataSourceFetch`
  - Ensure resulting columns/mappings are compatible with `extractJsonPath` and validation contracts

**Tests Expected (Reuse-Focused):**
- cURL import uses `parseCurl` correctly (method/url/headers/body/bodyType)
- fetchConfig edits persist per selected shared data source
- API fetch + array detection + mapping populates rows as expected
- append vs replace modes work
- non-JSON / no-array responses show clear errors
- resulting data works with existing verify/re-fetch hooks (no schema mismatch)

**Implementation Notes (2026-05-03):**
- Implemented fetch configuration UI in `src/features/scenarios/components/SharedDataSourceModal.tsx`:
  - Method + URL editor
  - Header add/remove controls
  - Body editor
  - cURL import panel wired to shared `parseCurl` from `src/shared/utils/curlParser.ts`
- Reused existing API mapping workflow by integrating `PopulateFromApiModal` (no new parser module added).
- Added Phase 4 fetch panel styling in `src/styles/shared-data-sources.css`.
- Added focused Phase 4 E2E coverage in `e2e/shared-data-sources-modal.spec.ts`:
  - cURL import maps method/url/headers/body into fetch config
  - Fetch config persists correctly per selected shared source
  - Populate from API supports append and replace row modes
- Added a Detect Variables customization panel in Shared DS fetch config (aligned with Create Parameterized Copy Step 1 UX):
  - URL Path Segments with checkbox + variable naming
  - Query Parameters (auto-detected)
  - Test Configuration (fixed)
  - URL Template Preview with `{{variable}}` placeholders
- Refined Detect Variables (Step 1) to a clearer step-by-step scope model in `DataSourceSetupModal`:
  - Path variables: selectable segments + custom variable names
  - Query variables: enable/disable each query key and rename mapped variable
  - Header variables: optional enable/rename per detected header
  - Body variables: optional enable/rename for cURL-derived `{{placeholder}}` tokens
  - Auth configuration moved into Step 1 so validation/fetch uses the same auth context
- Persisted URL path-variable mappings in `SharedDataSourceFetchConfig.pathVariables`.
- Persisted raw cURL text in `SharedDataSourceFetchConfig.rawCurl` so teams can revisit/edit original cURL input later.
- Added Fetch Auth options aligned to existing auth model (`inherit`, `none`, `bearer`, `basic`, `apikey`, `oauth2`) with type-specific fields.
- Added footer action trio in modal: `Cancel` (revert to last saved snapshot), `Save` (commit snapshot), `Close`.
- Fixed a Step 1 runtime crash from unescaped placeholder copy (`{{payloadVar}}`) in wizard description text.
- Validation run:
  - `npx tsc --noEmit` ✅
  - `npx playwright test e2e/shared-data-sources-modal.spec.ts --reporter=list` ✅ (18/18)

**Design Rethink (2026-05-03, based on original mockup):**
- Re-anchor modal behavior to two distinct operating views:
  - `Fetch Config Collapsed`: compact, cURL-derived request summary view (method + URL + key headers/auth cue), optimized for table space.
  - `With Selection (editing)`: full Shared Data Source authoring view (fetch config editor + table + row actions).
- Clarify row mapping between the two views with one canonical contract (no separate mapping models):
  - `path` columns map to URL path placeholders (`{{var}}`).
  - `param` columns map to query string keys.
  - `header` columns map to header keys.
  - `body` columns map to body placeholders.
  - `validate` columns map to JSONPath assertions.
- Add explicit “Mapping Preview” behavior in collapsed mode:
  - Show compact chips/counts for active mappings (for example: `path:1`, `param:3`, `header:1`, `body:0`, `validate:4`).
  - Clicking the summary expands directly into `With Selection (editing)` at the relevant section.
- Enforce single source of truth for fetch config:
  - cURL import updates `fetchConfig` and `rawCurl` only.
  - all table-driven execution (`From API`, `Verify All`, `Re-fetch`) resolves request data from `fetchConfig` + row values using the canonical mapping contract above.
- UX guardrail to prevent hidden drift:
  - if mappings reference missing placeholders/keys, show inline warnings before execute actions.
  - collapsed summary surfaces warning badge count so issues are visible without expansion.

**Implementation Notes (2026-05-03, redesign follow-through):**
- Updated Shared DS fetch panel to support explicit collapsed summary mode:
  - Request summary strip now shows method, URL snapshot, auth mode, and cURL-template indicator.
  - Mapping preview chips now show counts by mapping type (`path`, `param`, `header`, `body`, `validate`).
- Added canonical mapping health checks in modal logic (`SharedDataSourceModal`):
  - Compares table column mappings against current fetch config placeholders/keys.
  - Flags drift cases (for example `param:x` without query key `x`, `path:vin` without `{{vin}}` in URL path).
- Added warning surfacing in both states:
  - Collapsed mode shows a warning badge count.
  - Expanded mode shows inline warning details (warning-only; does not block `Populate Rows from API`).
- Added focused E2E coverage for collapsed summary and mapping chip expansion behavior.
- Fixed wizard auth propagation in `DataSourceSetupModal` validate step:
  - Step 3 sample-fetch now passes the currently selected Step 1 auth (`workingAuth`) to parent fetch resolver.
  - Prevents stale parent fetch auth from being used after user edits auth in wizard before validation fetch.

**Implementation Notes (2026-05-04, populate HTTP debugging):**
- Added bottom-panel request/response diagnostics in `PopulateFromApiModal` fetch step.
  - Request section now prints effective method, resolved URL, full sent headers, and request body.
  - Response section now prints HTTP status/statusText, error text (if any), and response body payload.
- Extended Shared DS auth-aware fetch wrapper to return sent-request metadata (`sentHeaders`, `sentUrl`, `sentMethod`, `sentBody`) so diagnostics reflect the actual request after auth resolution/token injection.
- Fixed stale column name/mapping drift that could leave query values blank at runtime:
  - `dataSourceExpander` now applies compatibility fallback to column `name` when `mapping` no longer matches URL placeholders/query keys.
  - Shared DS mapping warnings now account for both `mapping` and `name` to reduce false-positive mismatch warnings after column renames.
  - Shared DS table editor now keeps `mapping` aligned when renaming a column whose mapping previously mirrored its name.
- Fixed Populate-from-API modal viewport clipping (top/bottom not visible):
  - Modal overlay now scrolls (`overflow-y:auto`) and anchors from top with viewport padding.
  - Dialog now uses constrained viewport height and internal body scroll to keep header/footer reachable.
- Fixed Shared DS wizard apply not syncing URL placeholder mapping:
  - Applying "Configure Variables + Auth" now writes wizard `urlTemplate` back into `fetchConfig.url`.
  - Path placeholders are re-derived and saved into `fetchConfig.pathVariables`.
  - Result: configured variables are reflected in fetch URL/mapping checks immediately after apply.
- Fixed request resolution behavior that could blank preconfigured URL variables at runtime:
  - `dataSourceExpander` now skips path/param substitution when row value is empty (no empty-string overwrite).
  - Query parameters are no longer forcibly set to empty when a mapped row cell is blank.
  - Wizard apply now always seeds first-row defaults for path/param columns when values are empty, even for existing mapped columns.
  - Result: preconfigured URL/query values remain populated instead of becoming `.../management//...` or `channel=`.
- Fixed placeholder-token leakage and value-loss during Shared DS configure/apply:
  - Wizard migration now preserves values by matching prior columns via both `(type + mapping)` and `(type + name)` to avoid dropping existing row data after remap.
  - URL-derived defaults now ignore template tokens (e.g. `{{vin}}`) so placeholders are not copied into row values.
  - Populate-from-API now blocks send when unresolved template tokens remain in URL/headers/body and surfaces explicit missing variables in the error panel.
- Fixed unresolved query placeholder normalization in final request URL:
  - Any leftover query token like `{{vehicleUsageCode}}` is now normalized to an empty value during URL resolution.
  - Applies both when param columns exist and when the URL contains query placeholders without a matching param column mapping.
  - Prevents `%7B%7B...%7D%7D` from leaking to backend for missing optional query values.
- Fixed post-populate row-value wipe and noisy param-mapping drift:
  - Populate-generated rows now inherit baseline values from the first enabled row for all existing columns, then overwrite only mapped response fields.
  - Replacing rows after Populate no longer clears request-variable columns (`path`/`param`/`header`/`body`) to empty by default.
  - Auto-detected response fields in Populate now default to `validate` type (instead of `param`) to avoid accidental query-key mismatch warnings for output fields.
- Fixed Configure Variables + Auth persistence on re-open:
  - Wizard Step 1 state now hydrates from saved data-source columns first (param/header/body), not only from literal URL/header/body placeholders.
  - Remembered enable/disable state and custom variable names are restored when reopening after final save.
  - Initial cURL-derived defaults remain the fallback when no prior saved configuration exists.
- Fixed placeholder URL encoding regression (`%7B%7Bvar%7D%7D`):
  - Wizard URL-template normalization now preserves template braces when serializing URL updates.
  - Runtime data-source resolver now decodes encoded template braces before substitution and after URL normalization.
  - Result: placeholders remain as `{{var}}` in editable templates and resolve correctly with row values.
- Fixed missing `vin` path default on wizard re-open:
  - Path default seeding now falls back to literal path segments from the wizard scenario URL when template path segments are placeholders.
  - Shared DS wizard scenario now prefers literal URL parsed from saved raw cURL when `fetchConfig.url` is templated.
  - Result: first-row path variables (for example `vin`) are re-seeded from original cURL context instead of staying blank after reopen/reapply.
- Improved shared table row deletion affordance:
  - Replaced icon-only row delete control with explicit `Delete` button in shared data source row actions.
  - Makes row deletion discoverable without relying on tiny icon interpretation.
- Fixed wizard step-memory gaps for Parameterized Copy flow:
  - Query variables in Step 1 now default to enabled from URL when remembered param columns are missing, preventing "vin-only" Step 2 output.
  - Validate Fields step now preloads remembered validate columns/expected values from existing data-source columns/rows.
  - Array validation mode now initializes from saved `arrayValidationMode` so ordering preferences persist across re-open.
- Validation run:
  - `npx tsc --noEmit` ✅
  - `npx playwright test e2e/shared-data-sources-modal.spec.ts --reporter=list` ✅ (20/20)

**Refactor Plan (2026-05-04, user-requested consolidation):**
- Goal:
  - Stop behavior drift between Parameterized Test Data Source UI and Shared Data Sources UI.
  - Reuse existing, stable Data Source execution/mapping flows instead of duplicating logic.
  - Add a first-class "Promote Data Source to Shared Data Sources" feature from Parameterized Test.

- Step 1 — Consolidate request/mapping contracts:
  - Define one canonical row-resolution contract for path/query/header/body/validate.
  - Route both Parameterized Test and Shared Data Source flows through the same resolver and value-seeding rules.
  - Remove duplicate fallback logic where Shared DS path diverges from DataSourceEditor behavior.

- Step 2 — Consolidate setup wizard behavior:
  - Make Configure Variables + Auth initialization/readback use one source of truth (saved data source columns + fetch config + raw cURL fallback).
  - Align Step 1/2/3 persistence rules with Parameterized flow defaults (query/path retention, validate field retention, array mode retention).

- Step 3 — Consolidate verify/populate behavior:
  - Reuse the same fetch diagnostics and auth-resolution path in both UIs.
  - Ensure populate defaults avoid mutating request-input mappings unintentionally.
  - Keep explicit unresolved-variable handling consistent across both flows.

- Step 4 — Add Promote to Shared Data Source feature:
  - Entry point: Parameterized Test Data Source toolbar/action menu.
  - Action: clone current data source + fetch config/auth mapping into selected Feature Group shared data source catalog.
  - UX:
    - New prompt: choose existing shared source (merge/replace) or create new.
    - Preserve link options: keep local copy vs switch test to linked sharedDataSourceId.
  - Data safety:
    - Non-destructive by default (create new shared source).
    - Explicit confirmation for overwrite/replace.

- Step 5 — Cleanup and drift removal:
  - Remove duplicated ad-hoc utilities once shared abstractions are in place.
  - Keep one implementation path for mapping summary/warnings, resolver defaults, and persisted wizard state.

- Step 6 — Test plan for consolidation + promote feature:
  - Unit tests: resolver parity, wizard persistence parity, promote payload mapping.
  - E2E tests:
    - Promote local parameterized data source to shared catalog.
    - Reopen both UIs and confirm identical columns/rows/mappings/auth/validate settings.
    - Link promoted shared source back to test and verify request URL/auth/validation parity.
  - Regression gate:
    - `npx tsc --noEmit`
    - `npx playwright test e2e/shared-data-sources-modal.spec.ts --reporter=list`
    - Additional promote-flow spec to be added.

**Refactor Progress (2026-05-04, Step 1 started):**
- Introduced shared contract utility: `src/features/scenarios/utils/dataSourceContract.ts`.
  - Consolidates template-variable extraction.
  - Consolidates query-key extraction.
  - Consolidates mapping-summary + warning rules (path/param/header/body).
- Refactored Shared DS modal to consume shared contract utility:
  - Removed local duplicate implementations from `SharedDataSourceModal`.
- Refactored `dataSourceUtils` to consume shared template-variable extraction from the same utility.
- Validation after consolidation:
  - `npx tsc --noEmit` ✅
  - `npx playwright test e2e/shared-data-sources-modal.spec.ts --reporter=list` ✅ (20/20)

**Next Execution Chunk (Step 1 continuation):**
- Continue replacing remaining duplicated mapping helpers in setup/editor paths with shared contract utility.
- Then start Step 4 implementation: add "Promote Data Source to Shared" action in Parameterized Test Data Source toolbar with create/overwrite/link options.

**Implementation Notes (2026-05-04, populate column reuse fix):**
- Fixed `Populate Rows from API` creating incorrect extra validate columns in Shared DS table.
  - Populate matching now reuses existing columns in priority order:
    1. same `type + mapping`
    2. same `type + name`
    3. for `validate`, existing JSONPath mapping whose field suffix matches selected response field
    4. fallback same-name match
  - This prevents adding duplicate fields like `associatedOfferingCode` / `offerName` when existing validate columns already exist as custom names (for example `offers0_assoc`, `offers0_offerN`) with JSONPath mappings.
  - Result: populate updates expected existing columns instead of expanding schema unexpectedly.
- Validation run:
  - `npx tsc --noEmit` ✅
  - `npx playwright test e2e/shared-data-sources-modal.spec.ts --reporter=list` ✅ (20/20)

---

#### **Phase 5 (Toolbar + Row/Column Actions)** — 🔲 Not Started

**Scope:**
- Toolbar (flex row with separators):
  - **Row/Column Management:** "+ Row", "+ Sample", "+ Column" buttons
  - **Separator** (visual divider)
  - **API Actions:**
    - "⬇ From API" button (primary color) — populates rows from fetch config
    - "▶ Verify All" button (success color) — runs fetch + validation on all enabled rows
    - "↻ Re-fetch" button — re-fetches failed or dirty rows
  - **Separator**
  - **Data Management:**
    - "📥 Import" button — opens file picker (CSV/Excel/JSON)
    - "Distribution ▾" dropdown — choose row distribution strategy
    - "Validation ▾" dropdown — validation mode options (if needed)
    - "Contract" button — show data source schema/contract (optional Phase 6+ feature)
  - **Separator**
  - **Bulk Delete:** "🗑" button (danger color) — with confirmation
  - **Search Input:** "🔍 Search rows..." (right-aligned)

**Implementation Details:**
- Buttons should be context-aware (e.g., disable "+ Sample" if fetch config missing)
- Distribution dropdown shows options like: "Balanced", "Equal", "Weighted"
- Validation dropdown shows: "Strict", "Selective", "Smoke Test"
- Search input is live-filter on table (client-side regex or exact match)
- All buttons should show tooltips on hover

**Tests Expected:**
- Toolbar renders and buttons are accessible
- +Row, +Sample, +Column add items to table
- From API, Verify All, Re-fetch trigger correct handlers
- Import opens file picker
- Bulk delete works with confirmation
- Search filters table in real-time

---

#### **Phase 6 (Advanced Table Features)** — 🔲 Not Started

**Scope:**

**Column 1: Drag Handle (⠿)**
- Text: ⠿ (Braille pattern, width: 36px)
- Function: Click + drag to reorder rows
- Cursor: grab / grabbing
- Color: text-muted, hover → text

**Column 2: Checkbox (☑)**
- Function: Enable/disable row (checkbox = enabled)
- Width: 36px
- Checked state → row executes in run; unchecked → row skipped
- "Select All" in table header (select/deselect all checkboxes)

**Column 3: Sample Badge (optional)**
- Width: 28px
- Shows "S" badge if row is marked as sample
- Color: success/green background
- Used for "+ Sample" button to mark rows

**Columns 4+: Data Columns**
- Each column header shows: `name <type>`
- Types: path | param | body | header | validate
- Validate columns highlighted in warning color
- Inline editing: Click cell → input → blur to commit
- Monospace font for data

**Column N: Row Actions (✎ ⚡ ⧉ ×)**
- Width: 80px
- Hidden by default, shown on row hover
- ✎ Edit row details (opens modal with row label, tags, notes)
- ⚡ Fetch this row (runs fetch config for single row, populates data)
- ⧉ Duplicate row (clone with all data)
- × Delete row (with confirmation if row is referenced)

**Row States:**
- Normal: White text, normal opacity
- Hover: Background tint, actions visible
- Selected: Checkbox checked, row highlighted
- Disabled: Checkbox unchecked, row at 40% opacity, grayed out
- Has Tags: Row shows inline tag pills (e.g., "premium", "edge-case")
- Has Label: Row shows label at start (optional user annotation)

**Table Styling:**
- Sticky header (top: 0, z-index: 1)
- Cell padding: 8px 10px
- Hover: Background tint (rgba(255,255,255,0.02))
- Selected row: Primary color tint (rgba(108,99,255,0.08))
- Validate cells: Warning color text
- Cell input focus: Primary color border + accent background
- Scrollbar: Custom styled (width: 6px, gray)

**Data Structure Updates:**
```typescript
interface DataSourceRow {
  id: string;
  values: Record<string, string>;  // Column id → value
  enabled: boolean;  // Checkbox state
  label?: string;  // User-provided row label
  tags?: string[];  // Row tags (e.g., "premium", "edge-case", "boundary")
  isSample?: boolean;  // Sample badge marker
  notes?: string;  // Optional row notes (shown in edit modal)
}
```

**Row Details Modal (✎ action):**
- Shows: Label input, Notes textarea, Tags editor
- Allows editing row metadata without affecting data
- Save/Cancel buttons

**Tests Expected:**
- Drag handle reorders rows
- Checkbox enables/disables rows (affects execution)
- Sample badge appears when marked
- Cell editing works with monospace styling
- Row actions (edit, fetch, duplicate, delete) work
- Row states (hover, selected, disabled) display correctly
- Tag pills render
- Row details modal opens and saves

---

#### **Phase 7 (Used-By Section + Persistent State)** — 🔲 Not Started

**Scope:**

**Used-By Footer Section:**
- Appears below table, above modal footer
- Border-top separator
- Text: "Used by:" (bold label)
- List of test references: "FeatureGroup / Scenario / Test"
- Each reference is a pill with background tint
- Format: "VIN Decode / smoke / decode-vin-test", "Inventory / regression / lookup-vehicle"
- Click reference → navigate to test (optional, can defer)
- Empty state: "Not used by any tests" (optional)

**Persistent State:**
- Modal width (if expanded) should be saved to localStorage/state
- Last selected data source ID should be saved (re-open modal → same DS selected)
- Fetch config collapsed/expanded state per data source
- Table scroll position reset on data source change

**Files to Modify:**
- `src/features/scenarios/components/SharedDataSourceModal.tsx` — Add used-by section
- `src/features/scenarios/hooks/useProjects.ts` — Compute used-by map from feature groups

**Tests Expected:**
- Used-by section renders with correct tests
- Tests are clickable (navigation works)
- State persists across open/close
- Last selected DS re-opens correctly

---

#### **Phase 8 (DataSourceEditor Integration — "Use Shared")** — 🔲 Not Started

**Scope:**

**DataSourceEditor Changes:**
- Add data source mode selector:
  - Radio buttons / tabs: "Inline" vs "Linked to Shared"
  - Default: "Inline" for backward compatibility

**When "Linked to Shared":**
- Add "📋 Use Shared… ▾" button that shows dropdown
- Dropdown lists all shared data sources (from FeatureGroup.sharedDataSources)
- Shows row count for each
- Selection highlights currently linked DS
- Add "✂ Detach" button (red/danger color)
- Show link status: "🔗 Linked: **Production VINs** (12 rows) — read-only"
- Data table becomes read-only (all cells, columns, + Row button disabled)
- Disable "+" button and edit actions

**When "Inline" (existing behavior):**
- Full edit access to data table
- No "Use Shared…" dropdown or detach button
- Normal editing

**Linking Mechanism:**
- Set `Scenario.sharedDataSourceId = <id>`
- Keep `Scenario.dataSource` as null or clear (optional, can keep for rollback)
- At execution: Resolve from `FeatureGroup.sharedDataSources[id]`

**Unlinking (Detach):**
- Show confirmation: "Unlink from shared? This will copy current data to inline."
- Set `sharedDataSourceId = null`
- Copy shared data to `Scenario.dataSource`
- Re-enable editing

**Read-Only Data Table:**
- Input cells: disabled, grayed out, opacity 0.4
- Row buttons (add/delete/reorder): disabled
- Context menu (if any): hidden
- Toolbar in DataSourceEditor: Most buttons disabled except maybe a "Refresh" button

**Files to Modify:**
- `src/features/scenarios/components/DataSourceEditor.tsx` — Add mode selector, dropdown, detach, read-only state
- `src/features/scenarios/components/TestEditorModal.tsx` — Pass sharedDataSources prop
- `src/engine/dataSourceExpander.ts` or similar — Add logic to resolve shared DS at execution time

**Data Structure Update:**
```typescript
interface Scenario {
  // ... existing fields
  sharedDataSourceId?: string;  // Ref to SharedDataSource.id
  // dataSource is still present, either:
  //   - null/undefined when linked
  //   - populated when inline
  dataSource?: DataSource;
}
```

**Tests Expected:**
- "Use Shared…" dropdown shows all shared DS
- Linking works (sets sharedDataSourceId)
- Linked state shows read-only status
- Detach works (creates inline copy)
- Execution correctly resolves linked DS
- Read-only table disables all edits

---

### Summary of Phase Breakdown

| Phase | Name | Scope | Status |
|-------|------|-------|--------|
| 3 | Modal Shell + List Panel | Modal frame, left list, resize divider | ✅ Done |
| 4 | Fetch Configuration | URL/method/headers/body inputs, expandable panel | 🔲 Todo |
| 5 | Toolbar + Row/Column Actions | Buttons for +Row, From API, Verify, Import, search | 🔲 Todo |
| 6 | Advanced Table Features | Drag, checkbox, tags, sample badge, row actions, states | 🔲 Todo |
| 7 | Used-By Section + State | Show which tests use this DS, persist state | 🔲 Todo |
| 8 | DataSourceEditor Integration | Link/unlink from tests, read-only when linked | 🔲 Todo |

**Estimated Effort (Rough):**
- Phase 4: 1-2 hours (form inputs + state management)
- Phase 5: 2-3 hours (toolbar layout + button handlers)
- Phase 6: 3-4 hours (table drag/checkbox/tags/row actions + modal)
- Phase 7: 1 hour (used-by computation + persistence)
- Phase 8: 2-3 hours (mode selector + linking logic + read-only state)

**Total: ~10-13 hours** to fully implement all phases from mockup.

---

### 19B. Shared Data Sources (Full Redesign) — ✅ Complete

> **Status:** ✅ **Complete** (2026-05-04)
> **Detailed Plan:** See [shared-data-sources-plan.md](./shared-data-sources-plan.md) for comprehensive 10-phase implementation.

Shared Data Sources were fully redesigned and promoted from a per-FeatureGroup concern to a **top-level, harness-wide resource**. Any parameterized test across any feature group / scenario can reference a shared data source.

**Final Capabilities:**
- [x] `SharedDataSource` type with `fetchConfig` (URL, method, headers, body, auth) and `tags`
- [x] Top-level storage (`loadSharedDataSources()` / `saveSharedDataSources()`) in IndexedDB
- [x] `sharedDataSourceId` on `Test` — link to shared data by reference
- [x] `SharedDataSourceModal` — dedicated modal with list panel, editor panel, fetch config
- [x] Promote from inline test → shared data source (with copy or link)
- [x] Demote/detach shared → inline (creates independent copy)
- [x] Create Test from Shared Data Source — picker modal with new test creation
- [x] "Used by" section — shows all tests linked to a shared data source
- [x] Impact warning modal — when saving changes, shows affected tests
- [x] API-driven population (Populate from API) and verification (Verify against API)
- [x] Auth inheritance from linked tests
- [x] Row tags for categorization and filtering
- [x] CSV/Excel import and export
- [x] Resizable/collapsible list panel
- [x] Full migration from per-FG to top-level structure
- [x] 4 gallery samples using public APIs
- [x] 4 training manuals (Easy, Medium, Advanced)
- [x] Comprehensive unit tests and E2E tests

**Key Implementation Details:**
- Old `SharedDataSourceManager` component deleted; replaced by `SharedDataSourceModal`
- Old per-FG `sharedDataSources` field migrated to top-level and removed from `FeatureGroup` type
- `dataSourceExpander.ts` simplified to use top-level `SharedDataSource[]` only
- `useProjects` exposes `sharedDataSources` / `setSharedDataSources` at app level
- Gallery samples: Shared User IDs, Shared Product Catalog, Cross-FG Pokémon Roster, Shared Auth Users

### 19C. ~~Environment-Specific Data Filtering~~ — ❌ Removed

> **Removed 2026-05-03.** Duplicate of existing functionality. The Runner's environment selector + Phase 12 row tags already cover this use case. The harness structure (Environment → Microservice → Run) inherently handles env-specific execution, and row tags allow ad-hoc `env:xxx` tagging if needed.

---

_Created: 2026-05-01 | Last Updated: 2026-05-04 | Status: ✅ All Phases Complete | Related: [shared-data-sources-plan.md](./shared-data-sources-plan.md), [workflow-harness-integration-plan.md](./workflow-harness-integration-plan.md), [CsvTemplateExportModal](../../src/features/scenarios/components/CsvTemplateExportModal.tsx), [csvTemplateShared.ts](../../src/features/scenarios/utils/csvTemplateShared.ts)_
