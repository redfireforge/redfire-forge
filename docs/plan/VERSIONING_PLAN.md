# RedfireForge — Versioning Plan

> Master plan for version control, history tracking, and audit capabilities across the entire platform.
> Updated: 2026-05-21
> Status: **ALL PHASES COMPLETE** (V-Phase 1–7)
> Current version: v0.5.9 stable / 0.5.9-beta.2 release branch

---

## Current State

### What Already Has Versioning

| Feature | Type | Storage | Diff | Restore | Export/Import |
|---|---|---|---|---|---|
| **Response Versions** | Snapshot per test | In `validation.responseVersions[]` (localStorage) | json-diff-kit side-by-side | ✅ | ✅ (selective) |
| **Rules Versions** | Snapshot per test | In `validation.rulesVersions[]` (localStorage) | json-diff-kit side-by-side | ✅ | ✅ (selective) |
| **Catalog Spec Versions** | Per OpenAPI import | Per-version localStorage key | Endpoint add/remove/change diff | ✅ (switch active) | ❌ |
| **Response History** (Requests) | Per-request response cache | In-memory only (max 10) | ❌ | ✅ (restore body) | ❌ |
| **Workflow Undo/Redo** | In-memory state stack | localStorage (last 10, key `perf-test-wf-undo-{id}`) | ❌ | ✅ (undo/redo) | ❌ |
| **Test Runs** | Execution results | IndexedDB / file (capped at max) | ❌ | ❌ | ❌ |
| **Export Metadata** | `_exportMeta` envelope | In exported files only | ❌ | ❌ | ✅ |
| **Workflow Version History** | Snapshot per save | In `workflow.versions[]` (localStorage) | Multi-tab structural diff | ✅ | ✅ (strip/count) |
| **Test Definition Versions** | Snapshot per test | In `definitionVersions[]` (localStorage) | json-diff-kit 5-tab diff | ✅ | ✅ (selective) |
| **Request Definition Versions** | Snapshot per request | In `RequestItem.definitionVersions[]` (localStorage) | json-diff-kit 4-tab diff | ✅ | ✅ (strip/count) |
| **Audit Log** | Change tracking | localStorage (`perf-test-audit-log`) | Inline field-level old→new | N/A | ✅ (JSON/CSV) |
| **Structure Change Log** | Per-FG changelog | In `featureGroup.structureLog[]` (localStorage) | N/A (event log) | N/A | ✅ (selective) |
| **Script Library Versions** | Snapshot per edit | In `ScriptLibrary.versions[]` (localStorage) | 2-tab diff (overview + code) | ✅ | ✅ (strip/count) |
| **Trash Box** | Soft-deleted items | IndexedDB / localStorage / Tauri FS | N/A | ✅ (restore + undo) | ❌ |

### What Does NOT Have Versioning

| Entity | Current Behavior | Risk |
|---|---|---|
| ~~**TestScenario**~~ | ~~Overwrites in place~~ | ~~Cannot track structural changes~~ (V-Phase 6 ✅) |
| ~~**FeatureGroup**~~ | ~~Overwrites in place~~ | ~~No audit of group-level changes~~ (V-Phase 6 ✅) |
| ~~**RequestItem**~~ | ~~Request definition not tracked~~ | ~~Cannot compare old vs new request config~~ (V-Phase 5 ✅) |
| **RequestCollection** | No history | Collection structure changes untracked |
| ~~**Script Libraries**~~ | ~~No history~~ | ~~Script edits are irreversible~~ (V-Phase 7 ✅) |
| **TestConfig** | No history | Load profile tuning has no record |

---

## Versioning Phases

### V-Phase 1: Workflow Version History (High Priority) — COMPLETED

**Why**: Workflows are the most complex data structure (19 node types, edges, variables, services). They take significant time to build. A single accidental save can destroy hours of work. The existing undo/redo was in-memory only — lost on page refresh.

**Scope**:
- [x] Define `WorkflowVersion` type (id, timestamp, label, fingerprint, snapshot of nodes+edges+variables+services)
- [x] Store workflow versions in `workflow.versions[]` array (localStorage / Tauri)
- [x] Auto-save a version on each explicit save (fingerprint-based dedup, cap at 30, FIFO eviction)
- [x] `WorkflowVersionPanel` component — list, name, restore, delete, checkbox-based multi-select compare
- [x] `WorkflowVersionDiff` — visual side-by-side comparison of two workflow versions
  - Node list diff (added/removed/changed nodes)
  - Edge diff (connections changed)
  - Variable diff (added/removed/modified)
  - Service diff (added/removed/modified)
  - Per-node config diff (json-diff-kit for node data)
- [x] Persist undo/redo stack to localStorage (survive page refresh, last 10 snapshots, debounced 500ms)
- [x] Export/import: `stripWorkflowVersions()` / `countWorkflowVersions()` utilities integrated
- [x] Unit tests (>90% coverage) — 108 tests across 4 test files

**Implementation Details**:
- Utility module: `src/features/workflow/utils/workflowVersioning.ts` (230 lines)
  - `computeWorkflowFingerprint()` — cyrb53 hash for dedup
  - `createWorkflowVersion()` — returns null if fingerprint matches latest (no-op save)
  - `addVersionToList()` — newest-first with FIFO cap at 30
  - `generateChangeSummary()` — "2 nodes added, 1 var changed, 3 nodes modified"
  - `computeVersionDiff()` — `VersionDiffResult` with added/removed/modified nodes, edges, variables, services
  - `stripWorkflowVersions()`, `countWorkflowVersions()` — export/import helpers
- Panel: `src/features/workflow/components/panels/WorkflowVersionPanel.tsx` (201 lines)
  - Checkbox multi-select (max 2) for comparison
  - Inline rename, restore (with undo snapshot), delete
  - Change summary between consecutive versions
- Diff viewer: `src/features/workflow/components/modals/WorkflowVersionDiff.tsx` (263 lines)
  - Multi-tab diff: Nodes, Edges, Variables, Services, per-node config (json-diff-kit)
- Hook: `src/features/workflow/hooks/useWorkflowVersioning.ts` (101 lines)
  - Manages panel state, diff selection, restore, delete, rename
- Save integration: `src/features/workflow/hooks/useWorkflowPersistence.ts`
  - `handleSave()` auto-creates version via `createWorkflowVersion()` before persisting
- Undo persistence: `src/features/workflow/hooks/useUndoRedo.ts`
  - Storage key: `perf-test-wf-undo-{workflowId}` in localStorage
  - Last 10 snapshots persisted (debounced 500ms), max 50 in-memory
  - Loaded on workflow switch, survives page refresh
- Tests: 49 (utility) + 25 (panel) + 22 (diff) + 12 (hook) = 108 tests, all passing

**Data Model**:
```typescript
interface WorkflowVersion {
  id: string;
  timestamp: number;
  label?: string;
  fingerprint: string;
  nodeCount: number;
  edgeCount: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, string>;
  services?: WorkflowService[];
}
```

**Dependencies**: json-diff-kit (already installed), localStorage/Tauri storage

---

### V-Phase 2: Test Definition History (High Priority) — COMPLETED

**Why**: Test definitions (Scenario) are frequently edited — URL, headers, body, validation rules all change during development. Currently there's no way to answer "what did this test look like last week?" or "who changed the expected response?". Response/Rules versions only capture validation config, not the full test definition.

**Scope**:
- [x] Define `TestDefinitionVersion` type (id, timestamp, label, snapshot of full Scenario minus response/rules versions)
- [x] Store in `Scenario.definitionVersions[]` array
- [x] Auto-save a version when test is saved with meaningful changes (deep equality check via fingerprinting to skip no-ops)
- [x] `TestDefinitionVersionPanel` component in Test Editor modal
  - List versions with timestamp + change summary
  - Restore a previous version
  - Compare two versions (json-diff-kit)
  - Delete individual versions
  - Rename versions with inline editing
- [x] Change summary generation — "URL changed", "3 headers added", "body modified", "auth type changed"
- [x] Cap at configurable max versions per test (default 20)
- [x] Include in export/import versioning options (3rd checkbox in ExportOptionsPopover / ImportVersionModal)
- [x] `TestDefinitionVersionDiff` — 5-tab diff modal (Overview, Headers, Body, Auth, Extractions) using json-diff-kit
- [x] Unit tests (>90% coverage) — 62 tests across 3 new test files
- [x] E2E tests updated for 3-checkbox export/import popover

**Implementation Details**:
- Utility module: `src/features/scenarios/utils/testDefinitionVersioning.ts`
  - `createSnapshot()`, `computeSnapshotFingerprint()`, `hasChanged()`, `generateChangeSummary()`
  - `autoSaveVersion()` — fingerprint-based dedup, FIFO eviction at cap
  - `countDefinitionVersions()`, `stripDefinitionVersions()`, `hasDefinitionVersions()` — export/import integration
- Components: `TestDefinitionVersionPanel.tsx`, `TestDefinitionVersionDiff.tsx`
- Integrated into `TestEditorModal.tsx` as "History" tab with badge count
- Auto-save wired in `ScenarioBuilder.saveTest()` for existing tests only
- Export/Import: `VersionCheckboxGroup` now renders 3 checkboxes, `scenarioImportExport.ts` handles `includeDefinitionVersions`
- CSS: `test-def-version-*` and `test-def-diff-*` classes in `scenario-builder.css`

**Data Model**:
```typescript
interface TestDefinitionVersion {
  id: string;
  timestamp: number;
  label?: string;
  changeSummary?: string; // auto-generated: "URL changed, 2 headers added"
  snapshot: Omit<Scenario, 'id' | 'validation'>; // full test minus validation (which has its own versions)
}
```

---

### V-Phase 3: Environment & Service Audit Log (Medium Priority) — COMPLETED

**Why**: When tests start failing, the first question is "did the environment change?" Currently there's no record of when base URLs, auth profiles, or environment configs were modified.

**Scope**:
- [x] Define `AuditEntry` type (id, timestamp, entityType, entityId, entityName, action, changes)
- [x] Centralized audit log stored in localStorage/Tauri (`perf-test-audit-log`)
- [x] Track changes to:
  - Environment: created, deleted
  - Microservice: created, deleted, baseUrl changed per env, authProfile assignment changed
  - GlobalAuthProfile: created, renamed, deleted, auth type changed
- [x] `AuditLogPanel` in Settings → Preferences page — searchable, filterable timeline
- [x] Change diff display for modified entities (inline old→new with field-level detail)
- [x] Cap at configurable max entries (default 500, FIFO eviction)
- [x] Export audit log as JSON/CSV
- [x] Unit tests (42 tests, >90% coverage)

**Implementation Details**:
- Utility module: `src/features/audit/utils/auditLog.ts`
  - Types: `AuditEntityType`, `AuditAction`, `AuditChange`, `AuditEntry`
  - Core: `loadAuditLog()`, `addAuditEntry()`, `clearAuditLog()`, `deleteAuditEntry()`
  - Diff: `computeChanges(oldObj, newObj, fields?)` — generic field-level change detection
  - Convenience loggers: `logEnvironmentCreated/Deleted/Renamed`, `logMicroserviceCreated/Deleted/Updated`, `logAuthProfileCreated/Deleted/Updated/Renamed`
  - Export: `auditLogToCsv(entries)`, `formatAction()`, `formatEntityType()`
- Component: `src/features/audit/components/AuditLogPanel.tsx`
  - Search input, entity type filter, action filter dropdowns
  - Reverse-chronological timeline with action icons (+, ~, ×, →) and color-coded badges
  - Field-level change display (old→new values)
  - Export JSON / Export CSV buttons via `saveFile()` utility
  - Clear with confirmation, Refresh button
- CSS: `.audit-log-*` classes in `src/styles/settings.css`
- Wired into `EnvironmentManager.tsx`: env add/delete, svc add/delete, base URL save, auth profile assignment
- Wired into `SettingsModal.tsx` (now `SettingsPage`): auth profile create/delete/rename/type-change
- Tests: `auditLog.test.ts` (30 tests), `AuditLogPanel.test.tsx` (12 tests)

**Architecture Change (during V-Phase 3)**:
- Settings converted from modal overlay (`WorkflowEditorModalFrame`) to inline page tab
- `SettingsModal` → `SettingsPage` — renders as `<div className="settings-page">` matching EnvironmentManager pattern
- New `'preferences'` tab added to App.tsx routing; gear icon navigates to tab instead of opening modal
- Sub-nav `[Environments] [Preferences]` — both are real page tabs with consistent look & feel
- Removed `showSettings` state, modal overlay, and Close button

**Data Model**:
```typescript
type AuditEntityType = 'environment' | 'microservice' | 'authProfile';
type AuditAction = 'created' | 'updated' | 'deleted' | 'renamed';

interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface AuditEntry {
  id: string;
  timestamp: number;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  action: AuditAction;
  changes?: AuditChange[];
}
```

---

### V-Phase 4: Run Baselines & Comparison (Medium Priority) ✅ COMPLETED

> Aligns with ROADMAP Phase 0.11.0 — Run Comparison & Trends

**Why**: Performance testing is meaningless without baselines. Teams need to answer "is this release faster or slower than the last one?"

**Status**: Fully implemented and tested.

**Scope**:
- [x] Mark a test run as "baseline" (star/pin in UI)
- [x] Baseline comparison in Results Dashboard:
  - Side-by-side TPS, P50, P95, P99 deltas
  - Per-scenario delta table (which endpoints regressed?)
  - Regression alerts banner
- [x] Regression detection:
  - Auto-compare selected run against chosen baseline
  - Highlight regressions (P95 >10%, P50 >15%, P99 >15%, Avg >10%, Error Rate >1pp, TPS >10%)
  - Critical severity when regression exceeds 2x threshold
  - Configurable thresholds via `RegressionThresholds` interface
- [x] Trend analysis: LineChart (Recharts) for P50/P95/P99/Avg/TPS/Error Rate across all runs
  - Baseline runs highlighted with larger yellow dots
  - Metric selector dropdown
- [x] P50 response time added to `TestSummary`, `computeMetrics`, and ResultsDashboard
- [x] Unit tests: 18 utility tests + 9 component tests (27 total)

**Implementation**:
- `src/features/results/utils/runBaselines.ts` — Baseline CRUD (localStorage), `compareRuns()`, `computeMetricDeltas()`, `computeScenarioDeltas()`, `detectRegressions()`, `computeTrend()` (~370 lines)
- `src/features/results/components/RunComparisonPanel.tsx` — `RunComparisonPanel` (3-tab comparison view), `MetricDeltaTable`, `ScenarioDeltaTable`, `RegressionList`, `TrendChart` (~240 lines)
- `src/features/results/ResultsDashboard.tsx` — Baseline star toggle, comparison baseline selector, trend toggle, wired-in components
- `src/engine/metrics.ts` — Added P50 percentile calculation
- `src/shared/types/index.ts` — Added `p50ResponseTime` to `TestSummary`
- `src/styles/base.css` — Baseline controls, comparison panel, regression alerts, trend chart CSS

**Storage**: `perf-test-baselines` key in localStorage (max 10 baselines)

**Data Model** (as implemented):
```typescript
interface BaselineMark {
  runId: string;
  label?: string;
  markedAt: number;
}

interface RunComparison {
  baselineRun: TestRun;
  currentRun: TestRun;
  metricDeltas: MetricDelta[];
  scenarioDeltas: ScenarioDelta[];
  regressions: RegressionAlert[];
}

interface RegressionThresholds {
  p50Percent: number;   // default 15
  p95Percent: number;   // default 10
  p99Percent: number;   // default 15
  avgPercent: number;    // default 10
  errorRateAbsolute: number; // default 1 (percentage points)
  tpsPercent: number;    // default 10
}
```

---

### V-Phase 5: Request Definition History (Lower Priority) ✅ COMPLETED

**Why**: The Requests feature (ad-hoc API testing) has response history but not request definition history. Developers frequently tweak headers, auth, and body during debugging and want to go back to "what worked before."

**Scope**:
- [x] Define `RequestDefinitionVersion` type
- [x] Store in `RequestItem.definitionVersions[]`
- [x] Auto-save version on significant changes (URL, headers, body, auth)
- [x] Version panel in Request Editor sidebar (History tab with badge count)
- [x] Compare two versions (4-tab diff modal: Overview, Headers, Body, Auth)
- [x] Restore, delete, rename (inline double-click) previous versions
- [x] Cap at configurable max versions (default 15, FIFO eviction)
- [x] Unit tests (32 tests passing)

**Implementation Details**:
- Utility module: `src/features/requests/utils/requestDefinitionVersioning.ts` (~210 lines)
  - `createSnapshot()` — extracts name/url/method/headers/body/bodyType/bodyForm/auth (excludes id, savedQueryParams, catalogMeta)
  - `computeSnapshotFingerprint()` — canonical JSON stringify for deep equality
  - `hasChanged()`, `generateChangeSummary()` — change detection + human-readable summaries
  - `autoSaveVersion()` — fingerprint-based dedup, FIFO eviction at cap of 15
  - `computeSnapshotDiff()` → `SnapshotDiffResult` with headersAdded/Removed/Modified, bodyChanged, authChanged, etc.
  - `restoreFromVersion()`, `deleteVersion()`, `renameVersion()` — CRUD operations
  - `countRequestDefinitionVersions()`, `stripRequestDefinitionVersions()`, `hasRequestDefinitionVersions()` — export/import helpers
- Panel: `src/features/requests/components/RequestDefinitionVersionPanel.tsx`
  - Checkbox multi-select (max 2) for comparison
  - Inline rename (double-click label), restore, delete actions per version
  - Change summary display, relative timestamps
  - Reuses `.test-def-version-*` CSS classes from scenario version panel
- Diff viewer: `src/features/requests/components/RequestDefinitionVersionDiff.tsx`
  - 4-tab diff modal: Overview (field-level old→new), Headers (added/removed/modified), Body (json-diff-kit), Auth (json-diff-kit)
  - Reuses `.test-def-diff-*` CSS classes from test definition diff
- Auto-save hook: `src/features/requests/hooks/useRequests.ts`
  - `selectRequest()` — auto-saves version for the *previous* request before switching
  - `selectCollection()` — auto-saves version for the current request before switching collections
  - Fingerprint dedup prevents duplicate versions from consecutive switches without changes
- Tab: `src/features/requests/components/RequestEditor.tsx`
  - "History" tab added after Headers, with badge count of versions
  - Restore → applies `restoreFromVersion()` patch via `onUpdateRequest()`
  - Delete/Rename → updates `definitionVersions` via `onUpdateRequest()`
  - Compare → opens `RequestDefinitionVersionDiff` modal overlay
- Tests: `src/features/requests/utils/requestDefinitionVersioning.test.ts` — 32 tests
  - createSnapshot, fingerprint, hasChanged, generateChangeSummary, autoSaveVersion, computeSnapshotDiff,
    restoreFromVersion, deleteVersion, renameVersion, MAX_VERSIONS cap, export/import helpers

**Data Model**:
```typescript
interface RequestDefinitionSnapshot {
  name: string;
  url: string;
  method: HttpMethod;
  headers: KeyValue[];
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  auth: AuthConfig;
}

interface RequestDefinitionVersion {
  id: string;
  timestamp: number;
  label?: string;
  changeSummary?: string; // auto-generated: "URL changed, 2 headers added"
  snapshot: RequestDefinitionSnapshot;
}
```

**Dependencies**: json-diff-kit (already installed), localStorage/Tauri storage

---

### V-Phase 6: Feature Group & Scenario Structure History (Lower Priority) ✅ COMPLETED

**Why**: When tests are moved, renamed, or reorganized between scenarios and feature groups, there's no record. Useful for teams collaborating via export/import.

**Scope**:
- [x] Lightweight structure changelog per FeatureGroup
- [x] Track: scenario added/removed/renamed, test added/removed/moved/copied, FG renamed
- [x] `StructureChangeLogPanel` toggled via "History" button in Feature Group header
- [x] Include structure history in export/import (`includeStructureLog` option)
- [x] Unit tests (36 tests — 26 utility + 10 component)

**Implementation Details**:
- Types: `StructureChangeAction` (12 actions), `StructureChangeEntry` in `shared/types/index.ts`
- Utility: `src/features/scenarios/utils/structureChangeLog.ts` — createEntry, appendToLog, 12 convenience loggers, CRUD, display helpers
- Component: `src/features/scenarios/components/StructureChangeLogPanel.tsx` — filter by category, delete entries, clear all with confirm
- CSS: `.structure-log-*` classes in `scenario-builder.css`
- Hooks: ScenarioBuilder (6 mutations) + useScenarioDragDrop (4 cross-FG moves)
- Export/Import: `VersionExportOptions.includeStructureLog`, `VersionImportOptions.importStructureLog`, `VersionCheckboxGroup` 4th checkbox, `countVersions.structureLogCount`

---

### V-Phase 7: Script Library Versioning ✅ COMPLETED

**Why**: Script nodes in workflows use reusable script libraries. Scripts are code — they need version control.

**Scope**:
- [x] Store script versions in `ScriptLibrary.versions[]` — `ScriptLibraryVersion` & `ScriptLibrarySnapshot` types
- [x] Auto-save version on edit — fingerprint-based dedup, FIFO eviction (max 15)
- [x] Diff viewer (overview + code tabs) — json-diff-kit for code, field-level for metadata
- [x] Restore previous versions — restore, delete, rename (double-click inline)
- [x] Impact analysis: "Which workflows use this script?" — `findLibraryUsages()` with workflow→node tags
- [x] Unit tests — 60 tests (41 utility + 10 panel + 9 diff component)

**Implementation**:
- `scriptLibraryVersioning.ts` — utility functions: `autoSaveVersion`, `restoreFromVersion`, `deleteVersion`, `renameVersion`, `computeSnapshotDiff`, `findLibraryUsages`, `stripLibraryVersions`
- `ScriptLibraryVersionPanel.tsx` — version list with checkbox multi-select (max 2), compare, restore, delete, rename, usage tags
- `ScriptLibraryVersionDiff.tsx` — 2-tab diff: Overview (name/description field-level) + Code (json-diff-kit viewer)
- Wired into `ScriptLibraryManager.tsx` — History button with badge count, auto-save before edit

---

## Cross-Cutting Concerns

### Version Storage Strategy

| Entity | Storage Location | Max Versions | Auto-Save Trigger |
|---|---|---|---|
| Workflow | localStorage (in `workflow.versions[]`) | 30 | Explicit save (fingerprint dedup) |
| Test Definition | localStorage (in `definitionVersions[]`) | 20 | Save with changes (fingerprint dedup) |
| Audit Log | localStorage (`perf-test-audit-log`) | 500 entries | Any env/svc/auth CRUD operation |
| Run Baselines | IndexedDB (in TestRun) | 10 baselines | Manual mark |
| Request Definition | localStorage (in RequestItem) | 15 | Request/collection switch (fingerprint dedup) |
| Feature Group Structure | localStorage (in FeatureGroup) | 50 | Any scenario/test/FG mutation |
| Script Library | localStorage | 15 | Edit save |
| Trash Box | IndexedDB / localStorage / Tauri FS | 100 (configurable 50–200) | Any delete operation (FG, scenario, test, shared DS) |

### Storage Size Management

- All version arrays are capped with FIFO eviction (oldest removed when cap reached)
- Users can manually delete individual versions
- "Purge all versions" option in Settings → Data Management
- Export includes version sizes in metadata for transparency
- localStorage quota monitoring (warn at 80% usage)

### Export/Import Integration

All new version types should integrate with the existing export/import versioning system:
- `ExportOptionsPopover` extended with new checkboxes per version type
- `ImportVersionModal` extended similarly
- `stripVersions()` and `countVersions()` updated for new version arrays
- `_exportMeta` updated with new inclusion flags
- Settings Export/Import tab updated with new toggles

### Diff Viewer Strategy

| Data Type | Diff Method |
|---|---|
| JSON (response body, validation config, test definition) | json-diff-kit (existing) |
| Workflow structure (nodes, edges) | Custom: node list diff + json-diff-kit for node data |
| Code (scripts) | Monaco diff editor or json-diff-kit on stringified content |
| Simple changes (URL, name) | Inline field-level before/after display |

### UI Patterns

All version panels should follow the established patterns from `ResponseVersionPanel` / `RulesVersionPanel`:
- Version list with timestamp, label, optional badge
- Save Current / Restore / Compare / Delete actions
- Duplicate detection before saving
- json-diff-kit side-by-side viewer in a modal
- Consistent CSS classes (`.version-panel`, `.version-list`, `.version-diff-viewer`)

---

## Priority Matrix

| Phase | Impact | Effort | Priority | Dependencies |
|---|---|---|---|---|
| V-Phase 1: Workflow Versions | 🔴 Critical | Large | **P0** | ✅ Done |
| V-Phase 2: Test Definition History | 🟠 High | Medium | **P1** | ✅ Done |
| V-Phase 3: Audit Log | 🟡 Medium | Medium | **P2** | ✅ Done |
| V-Phase 4: Run Baselines | 🟠 High | Large | **✅ Done** | ROADMAP Phase 0.11.0 |
| V-Phase 5: Request Definition History | ✅ Done | Small | **P3** | None |
| V-Phase 6: Structure History | ✅ Done | Small | **P4** | None |
| V-Phase 7: Script Library Versions | ✅ Done | Medium | **P5** | Script libraries feature |

---

## Already Completed

- [x] Response version snapshots (save/compare/restore/delete per test)
- [x] Rules version snapshots (save/compare/restore/delete per test)
- [x] Catalog spec version history (import/diff/switch active version)
- [x] Response history dropdown in Requests (in-memory, max 10)
- [x] **V-Phase 1**: Workflow version history (108 tests, auto-save with fingerprint dedup, multi-tab diff, undo persistence to localStorage)
- [x] **V-Phase 2**: Test definition version history (auto-save/compare/restore/delete per test, export/import integration, 5-tab diff viewer)
- [x] **V-Phase 3**: Environment & service audit log (42 tests, searchable/filterable timeline, JSON/CSV export, Settings converted from modal to inline page tab)
- [x] **V-Phase 4**: Run baselines & comparison (27 tests, baseline star/pin, 3-tab comparison panel, trend chart, P50 metric, regression detection with configurable thresholds)
- [x] **V-Phase 5**: Request definition history (32 tests, auto-save on request/collection switch with fingerprint dedup, 4-tab diff viewer, History tab in Request Editor)
- [x] **V-Phase 6**: Feature Group & Scenario structure history (36 tests, per-FG structure changelog with filter/delete/clear, History button with badge count, export/import integration with 4th checkbox)
- [x] **V-Phase 7**: Script library versioning (60 tests, auto-save with fingerprint dedup, 2-tab diff viewer, impact analysis, restore/delete/rename)
- [x] Workflow undo/redo (max 50 in-memory, last 10 persisted to localStorage)
- [x] Export/import with selective version inclusion/exclusion
- [x] `ExportOptionsPopover` — version checkboxes for export
- [x] `ImportVersionModal` — version checkboxes for import
- [x] Settings Export/Import tab — version checkboxes
- [x] `stripVersions()` / `countVersions()` utilities
- [x] Version metadata in `_exportMeta` envelope
- [x] Duplicate version detection (fingerprint-based)
- [x] IntelliJ-style diff viewer (monokai, transparent rows, wider gutter)
- [x] **Trash Box** — Soft-delete & recovery for FGs, scenarios, tests, shared data sources (42 tests, undo toast, configurable retention/capacity, IDB + localStorage + Tauri FS)
- [x] Structure change log `restored` action type — tracks restored items from Trash Box (V-Phase 6 extension)

---

## Companion Improvements (feature/workflow-version-history branch)

Non-versioning improvements shipped alongside V-Phase 7:

| Improvement | Description |
|---|---|
| **Per-workflow environment** | Each workflow remembers its own selected environment (`lastSelectedEnvId`) — auto-restores on switch |
| **`__all__` env fallback** | Services configured for "All Environments" now properly resolve when any env is selected |
| **Non-blocking readiness check** | Quick Test no longer blocked by missing service configs — shows warning toast instead |
| **Alert→Toast migration** | All 20 `alert()` calls replaced with non-blocking toast notifications |
| **Monaco paste fix** | Ctrl/Cmd+V in script editor nodes no longer triggers workflow-level paste interception |
| **Response time distribution histogram** | Single-run and overlay (baseline vs current) histogram in Results Dashboard and Run Comparison panel (17 unit tests) |

---

## Plan Status: COMPLETE

All 7 versioning phases have been implemented and tested:
- **375+ unit tests** across all versioning features (+ 42 Trash Box tests = **417+ total**)
- All phases use consistent patterns: fingerprint-based dedup, FIFO eviction, json-diff-kit diff viewers
- Export/import integration with selective version inclusion/exclusion
- Audit log provides cross-cutting change tracking
- Trash Box provides soft-delete safety net complementing version history

**Remaining unversioned entities** (low priority, no current user demand):
- `RequestCollection` — collection-level structure changes
- `TestConfig` — load profile parameter tuning history

---

## Post-Completion Enhancements (v0.5.9+)

Features shipped after all V-Phases completed that extend or interact with the versioning infrastructure:

### Trash Box — Soft Delete & Recovery (v0.5.9-beta.2)

**Relationship to versioning**: The Trash Box is complementary to version history — versions track *what changed*, Trash Box prevents *accidental permanent loss*.

| Aspect | Detail |
|---|---|
| **Feature** | Deleted Feature Groups, Scenarios, Tests, and Shared Data Sources are moved to a Trash Box instead of permanent deletion |
| **Undo toast** | 5-second notification with Undo button for instant recovery |
| **Trash Panel** | Modal UI to browse, search, restore, permanently delete trashed items |
| **Automatic purge** | Expired items cleaned up on startup (configurable 7–90 day retention, max 50–200 items) |
| **Smart restoration** | Restores to original parent when available; creates "Restored Items" groups for orphans; handles ID collisions |
| **Structure change logging** | Restored items recorded in Feature Group change history (V-Phase 6) with `restored` action |
| **Persistence** | IndexedDB (web), localStorage fallback, Tauri FS (desktop) |
| **Tests** | 42 unit tests (`TrashPanel.test.tsx`, `TrashUndoToast.test.tsx`, `useTrash.test.ts`, `useTrash.restorePaths.test.ts`, `trashStorage.test.ts`, `idbTrash.test.ts`, `trashConstants.test.ts`) |

**Key files**:
- `src/shared/utils/trashStorage.ts` — dual-mode CRUD (IDB/localStorage/Tauri FS), purgeExpired, enforceMaxItems
- `src/shared/utils/idbTrash.ts` — IndexedDB backend
- `src/features/scenarios/hooks/useTrash.ts` — React hook (moveToTrash, restore, undo, settings)
- `src/features/scenarios/components/TrashPanel.tsx` — modal UI
- `src/features/scenarios/components/TrashUndoToast.tsx` — 5-second undo toast
- `src/styles/trash.css` — panel + toast CSS

### Test Suite Deduplication & Coverage Sweep (v0.5.9-beta.2)

Extracted shared test mocks, fixtures, and JSX render helpers into `__test-utils__/` modules across 4 feature areas. Net duplication reduction: 22,585 → 18,719 lines (4.48% → 3.73%). All production files ≥ 90% coverage on every metric.

---

## Future / Out of Scope

Items intentionally deferred from the versioning plan — tracked here for future consideration:

| Item | Originally In | Reason Deferred |
|---|---|---|
| CLI `--baseline <run-id>` flag for CI comparison output | V-Phase 4 | Belongs to a separate CLI enhancement phase |
| ~~Response time distribution overlay histogram~~ | ~~V-Phase 4~~ | ~~Implemented — see Companion Improvements~~ |
| Persist response history to localStorage | V-Phase 5 | Separate concern from definition versioning — it's HTTP response caching, not version control |
| Kafka message versioning / schema evolution tracking | Future | Depends on Kafka integration (see `docs/plan/future/kafka/integration-plan.md`) |
| Data Source version history | Future | Track changes to CSV/JSON data source content over time |
| Workflow execution trace archival | Future | Long-term storage of execution traces beyond in-memory/IndexedDB |
