# RedfireForge — Versioning Plan

> Master plan for version control, history tracking, and audit capabilities across the entire platform.
> Updated: 2026-04-30

---

## Current State

### What Already Has Versioning

| Feature | Type | Storage | Diff | Restore | Export/Import |
|---|---|---|---|---|---|
| **Response Versions** | Snapshot per test | In `validation.responseVersions[]` (localStorage) | json-diff-kit side-by-side | ✅ | ✅ (selective) |
| **Rules Versions** | Snapshot per test | In `validation.rulesVersions[]` (localStorage) | json-diff-kit side-by-side | ✅ | ✅ (selective) |
| **Catalog Spec Versions** | Per OpenAPI import | Per-version localStorage key | Endpoint add/remove/change diff | ✅ (switch active) | ❌ |
| **Response History** (Requests) | Per-request response cache | In-memory only (max 10) | ❌ | ✅ (restore body) | ❌ |
| **Workflow Undo/Redo** | In-memory state stack | In-memory only (max 50, lost on refresh) | ❌ | ✅ (undo/redo) | ❌ |
| **Test Runs** | Execution results | IndexedDB / file (capped at max) | ❌ | ❌ | ❌ |
| **Export Metadata** | `_exportMeta` envelope | In exported files only | ❌ | ❌ | ✅ |

### What Does NOT Have Versioning

| Entity | Current Behavior | Risk |
|---|---|---|
| **Workflow** | Overwrites on save; undo lost on refresh | Complex workflows lost to accidental changes |
| **Scenario (Test definition)** | Overwrites in place | Cannot track "when did this test change?" |
| **TestScenario** | Overwrites in place | Cannot track structural changes |
| **FeatureGroup** | Overwrites in place | No audit of group-level changes |
| **Environment** | Simple CRUD, no history | Debugging "when did this URL change?" is impossible |
| **Microservice** | Simple CRUD, no history | Base URL changes are invisible |
| **GlobalAuthProfile** | Simple CRUD, no history | Credential changes have no audit trail |
| **RequestItem** | Request definition not tracked | Cannot compare old vs new request config |
| **RequestCollection** | No history | Collection structure changes untracked |
| **Script Libraries** | No history | Script edits are irreversible |
| **TestConfig** | No history | Load profile tuning has no record |

---

## Versioning Phases

### V-Phase 1: Workflow Version History (High Priority)

**Why**: Workflows are the most complex data structure (20 node types, edges, variables, services). They take significant time to build. A single accidental save can destroy hours of work. The existing undo/redo is in-memory only — lost on page refresh.

**Scope**:
- [ ] Define `WorkflowVersion` type (id, timestamp, label, snapshot of nodes+edges+variables+services)
- [ ] Store workflow versions in `workflow.versions[]` array (server-side JSON file)
- [ ] Auto-save a version on each explicit save (cap at configurable max, e.g. 30)
- [ ] `WorkflowVersionPanel` component — list, name, restore, delete versions
- [ ] `WorkflowVersionDiff` — visual side-by-side comparison of two workflow versions
  - Node list diff (added/removed/changed nodes)
  - Edge diff (connections changed)
  - Variable diff
  - Per-node config diff (json-diff-kit for node data)
- [ ] Persist undo/redo stack to workflow file (survive page refresh)
- [ ] Export/import: selective version inclusion (reuse `ExportOptionsPopover` pattern)
- [ ] Unit tests (>90% coverage)

**Data Model**:
```typescript
interface WorkflowVersion {
  id: string;
  timestamp: number;
  label?: string;
  nodeCount: number;
  edgeCount: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, string>;
  services?: Record<string, ServiceRegistryEntry>;
}
```

**Dependencies**: json-diff-kit (already installed), server file storage (already exists)

---

### V-Phase 2: Test Definition History (High Priority)

**Why**: Test definitions (Scenario) are frequently edited — URL, headers, body, validation rules all change during development. Currently there's no way to answer "what did this test look like last week?" or "who changed the expected response?". Response/Rules versions only capture validation config, not the full test definition.

**Scope**:
- [ ] Define `TestDefinitionVersion` type (id, timestamp, label, snapshot of full Scenario minus response/rules versions)
- [ ] Store in `Scenario.definitionVersions[]` array
- [ ] Auto-save a version when test is saved with meaningful changes (deep equality check to skip no-ops)
- [ ] `TestDefinitionVersionPanel` component in Test Editor modal
  - List versions with timestamp + change summary
  - Restore a previous version
  - Compare two versions (json-diff-kit)
  - Delete individual versions
- [ ] Change summary generation — "URL changed", "3 headers added", "body modified", "auth type changed"
- [ ] Cap at configurable max versions per test (default 20)
- [ ] Include in export/import versioning options
- [ ] Unit tests (>90% coverage)

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

### V-Phase 3: Environment & Service Audit Log (Medium Priority)

**Why**: When tests start failing, the first question is "did the environment change?" Currently there's no record of when base URLs, auth profiles, or environment configs were modified.

**Scope**:
- [ ] Define `AuditEntry` type (id, timestamp, entityType, entityId, entityName, action, changes, userId?)
- [ ] Centralized audit log stored in localStorage/Tauri (`perf-test-audit-log`)
- [ ] Track changes to:
  - Environment: created, renamed, deleted
  - Microservice: created, renamed, deleted, baseUrl changed per env, authProfileIds changed
  - GlobalAuthProfile: created, renamed, deleted, auth type/config changed
- [ ] `AuditLogPanel` in Settings tab — searchable, filterable timeline
- [ ] Change diff display for modified entities
- [ ] Cap at configurable max entries (default 500)
- [ ] Export audit log as JSON/CSV
- [ ] Unit tests (>90% coverage)

**Data Model**:
```typescript
interface AuditEntry {
  id: string;
  timestamp: number;
  entityType: 'environment' | 'microservice' | 'authProfile' | 'featureGroup';
  entityId: string;
  entityName: string;
  action: 'created' | 'updated' | 'deleted' | 'renamed';
  changes?: { field: string; oldValue: unknown; newValue: unknown }[];
}
```

---

### V-Phase 4: Run Baselines & Comparison (Medium Priority)

> Aligns with ROADMAP Phase 0.11.0 — Run Comparison & Trends

**Why**: Performance testing is meaningless without baselines. Teams need to answer "is this release faster or slower than the last one?"

**Scope**:
- [ ] Mark a test run as "baseline" (star/pin in UI)
- [ ] Baseline comparison in Results Dashboard:
  - Side-by-side TPS, P50, P95, P99 deltas
  - Response time distribution overlay (histogram)
  - Per-scenario delta table (which endpoints regressed?)
- [ ] Regression detection:
  - Auto-compare latest run against baseline
  - Highlight regressions (P95 increased >10%, error rate increased >1%)
  - Configurable thresholds
- [ ] Trend analysis: P95 across last N runs for selected scenarios
- [ ] CLI: `--baseline <run-id>` flag to compare in CI output
- [ ] Unit tests (>90% coverage)

**Data Model**:
```typescript
interface TestRunBaseline {
  runId: string;
  markedAt: number;
  label?: string;
}

interface RunComparison {
  baselineRunId: string;
  currentRunId: string;
  deltas: ScenarioDelta[];
  overallDelta: {
    tpsDelta: number;
    p50Delta: number;
    p95Delta: number;
    p99Delta: number;
    errorRateDelta: number;
  };
  regressions: RegressionAlert[];
}
```

---

### V-Phase 5: Request Definition History (Lower Priority)

**Why**: The Requests feature (ad-hoc API testing) has response history but not request definition history. Developers frequently tweak headers, auth, and body during debugging and want to go back to "what worked before."

**Scope**:
- [ ] Define `RequestDefinitionVersion` type
- [ ] Store in `RequestItem.definitionVersions[]`
- [ ] Auto-save version on significant changes (URL, headers, body, auth)
- [ ] Version panel in Request Editor sidebar
- [ ] Compare and restore previous versions
- [ ] Persist response history to localStorage (currently in-memory only, max 10)
- [ ] Cap at configurable max versions (default 15)
- [ ] Unit tests (>90% coverage)

---

### V-Phase 6: Feature Group & Scenario Structure History (Lower Priority)

**Why**: When tests are moved, renamed, or reorganized between scenarios and feature groups, there's no record. Useful for teams collaborating via export/import.

**Scope**:
- [ ] Lightweight structure changelog per FeatureGroup
- [ ] Track: scenario added/removed/renamed, test added/removed/moved
- [ ] `StructureChangeLog` panel in Feature Group context menu
- [ ] Include structure history in export
- [ ] Unit tests (>90% coverage)

---

### V-Phase 7: Script Library Versioning (Future)

**Why**: Script nodes in workflows use reusable script libraries. Scripts are code — they need version control.

**Scope**:
- [ ] Store script versions in `ScriptLibrary.versions[]`
- [ ] Auto-save version on edit
- [ ] Diff viewer (code diff, not JSON diff)
- [ ] Restore previous versions
- [ ] Impact analysis: "Which workflows use this script?" before editing
- [ ] Unit tests (>90% coverage)

---

## Cross-Cutting Concerns

### Version Storage Strategy

| Entity | Storage Location | Max Versions | Auto-Save Trigger |
|---|---|---|---|
| Workflow | Server-side JSON file | 30 | Explicit save |
| Test Definition | localStorage (in Scenario) | 20 | Save with changes |
| Audit Log | localStorage | 500 entries | Any CRUD operation |
| Run Baselines | IndexedDB (in TestRun) | 10 baselines | Manual mark |
| Request Definition | localStorage (in RequestItem) | 15 | Significant change |
| Feature Group Structure | localStorage (in FeatureGroup) | 20 | Structure change |
| Script Library | localStorage | 15 | Edit save |

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
| V-Phase 1: Workflow Versions | 🔴 Critical | Large | **P0** | Server file storage |
| V-Phase 2: Test Definition History | 🟠 High | Medium | **P1** | None |
| V-Phase 3: Audit Log | 🟡 Medium | Medium | **P2** | None |
| V-Phase 4: Run Baselines | 🟠 High | Large | **P2** | ROADMAP Phase 0.11.0 |
| V-Phase 5: Request Definition History | 🟡 Medium | Small | **P3** | None |
| V-Phase 6: Structure History | 🟢 Low | Small | **P4** | None |
| V-Phase 7: Script Library Versions | 🟢 Low | Medium | **P5** | Script libraries feature |

---

## Already Completed

- [x] Response version snapshots (save/compare/restore/delete per test)
- [x] Rules version snapshots (save/compare/restore/delete per test)
- [x] Catalog spec version history (import/diff/switch active version)
- [x] Response history dropdown in Requests (in-memory, max 10)
- [x] Workflow undo/redo (in-memory, max 50)
- [x] Export/import with selective version inclusion/exclusion
- [x] `ExportOptionsPopover` — version checkboxes for export
- [x] `ImportVersionModal` — version checkboxes for import
- [x] Settings Export/Import tab — version checkboxes
- [x] `stripVersions()` / `countVersions()` utilities
- [x] Version metadata in `_exportMeta` envelope
- [x] Duplicate version detection (fingerprint-based)
- [x] IntelliJ-style diff viewer (monokai, transparent rows, wider gutter)
