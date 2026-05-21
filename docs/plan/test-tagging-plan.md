# Test Tagging — Implementation Plan

> Label tests, scenarios, and feature groups with tags (`smoke`, `regression`, `critical`, etc.) and run only matching tests from the UI or CLI.

**Status:** Not started
**Estimated effort:** 5–7 days across 5 phases
**Branch:** `feature/test-tagging`
**Dependencies:** None (additive feature, no breaking changes)

---

## Table of Contents

1. [Motivation & Competitive Context](#1-motivation--competitive-context)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1 — Data Model & Storage](#3-phase-1--data-model--storage)
4. [Phase 2 — Scenario Builder UI](#4-phase-2--scenario-builder-ui)
5. [Phase 3 — Test Runner Filtering](#5-phase-3--test-runner-filtering)
6. [Phase 4 — CLI Integration](#6-phase-4--cli-integration)
7. [Phase 5 — Search, Results & Polish](#7-phase-5--search-results--polish)
8. [Testing Strategy](#8-testing-strategy)
9. [File Change Summary](#9-file-change-summary)

---

## 1. Motivation & Competitive Context

### The problem

QA teams need to run subsets of their test suite based on context:

- **CI/CD PRs** → run `smoke` tests only (fast feedback, <2 min)
- **Nightly builds** → run `regression` tests (full coverage, 30+ min)
- **Pre-release** → run `critical` tests (business-critical paths)
- **Debugging** → run tests tagged `payments` or `checkout` (focused investigation)

Today, RedfireForge has no way to filter tests by category. The only options are manual checkbox selection in the UI or `--scenario <name>` in the CLI (single test, exact name match).

### What competitors offer

| Tool | Tagging model |
|---|---|
| pytest | `@pytest.mark.smoke` decorators, `pytest -m "smoke and not slow"` |
| TestNG | `@Test(groups = {"smoke"})`, `<groups>` in suite XML |
| JUnit 5 | `@Tag("smoke")`, `--include-tags smoke` |
| k6 | `--tag` on metrics (not test selection) |
| Postman | No tagging, folder-based selection only |

### What we already have

RedfireForge has a **mature tagging system for data source rows** that we can leverage:

| Layer | Status | File |
|---|---|---|
| `DataSourceRow.tags?: string[]` | Implemented | `src/shared/types/index.ts:209` |
| `BUILT_IN_TAGS` suggestions | Implemented | `src/engine/dataSourceExpander.ts:328` |
| Tag filter bar in Data Source Editor | Implemented | `src/features/scenarios/components/DataSourceEditor.tsx:529` |
| `filterRowsByTags()` engine function | Implemented | `src/engine/dataSourceExpander.ts:336` |
| Runner tag filter (comma-separated) | Implemented | `src/features/test-runner/hooks/useRunnerOrchestration.ts:157` |
| CLI `--tags` / `--tag-mode` | Implemented | `cli/index.ts:61,95` |
| `DataSubset` named filters | Implemented | `src/shared/types/index.ts:258` |

**Missing:** tags on `Scenario`, `TestScenario`, or `FeatureGroup`. No scenario-level tag filtering anywhere.

---

## 2. Architecture Overview

### Tag hierarchy

```
FeatureGroup (tags: ['payments'])
  └─ TestScenario (tags: ['smoke', 'regression'])
      └─ Scenario / Test (tags: ['critical', 'checkout'])
          └─ DataSourceRow (tags: ['happy-path', 'edge-case'])  ← already exists
```

Tags apply at **scenario level** (`TestScenario.tags`) — the natural grouping unit. Rationale:

- Scenarios map 1:1 to test suites (e.g., "User CRUD Smoke Tests")
- Tests within a scenario share the same purpose/category
- Feature groups are organizational containers, not test categories
- Row-level tags serve a different purpose (data variation filtering)

**Decision:** Add `tags?: string[]` to `TestScenario` only. Feature groups inherit tag display (aggregate child tags) but don't have their own tags. Individual `Scenario` (test) objects don't get tags — they inherit from their parent `TestScenario`.

### Tag semantics

- Tags are **lowercase strings**, normalized on assignment (matches existing `DataSourceRow.tags` convention)
- Tags are **free-form** (no predefined enum), with built-in suggestions
- Filtering modes: `any` (OR — test matches if it has any listed tag) and `all` (AND — test must have all listed tags)
- Empty/missing tags = untagged, excluded by tag filters (same as row-tag behavior)

### Data flow

```
ScenarioBuilder UI
  │ assign/remove tags on TestScenario
  ▼
useProjects.ts → saveFeatureGroups() → IDB/localStorage/Tauri FS
  │
  ├─► ScenarioSelector (filter by tag before checkbox selection)
  │     ▼
  │   useRunnerOrchestration.ts (filter tests by scenario tags + row tags)
  │     ▼
  │   executor.ts → RequestResult (carries scenarioTags for reporting)
  │     ▼
  │   ResultsDashboard (filter results by tag)
  │
  ├─► CLI: --scenario-tags smoke,regression --scenario-tag-mode all
  │     ▼
  │   cli/loader.ts → filter scenarios → runTest → reporters (include tags)
  │
  └─► scenarioSearch.ts (index tags for text search)
```

---

## 3. Phase 1 — Data Model & Storage

> Add the `tags` field to `TestScenario`, update storage, migration, and serialization.

### Step 1.1 — Add `tags` to `TestScenario`

**File:** `src/shared/types/index.ts` (line 337)

```typescript
export interface TestScenario {
  id: string;
  name: string;
  kind: ScenarioKind;
  tags?: string[];    // NEW — e.g. ['smoke', 'regression', 'critical']
  auth?: AuthConfig;
  tests: Scenario[];
}
```

### Step 1.2 — Add built-in scenario tag suggestions

**File:** `src/engine/dataSourceExpander.ts` (after line 328)

```typescript
export const BUILT_IN_TAGS = ['happy-path', 'edge-case', 'negative', 'boundary', 'regression', 'smoke'] as const;

export const BUILT_IN_SCENARIO_TAGS = ['smoke', 'regression', 'critical', 'integration', 'e2e', 'performance', 'slow', 'flaky'] as const;
```

### Step 1.3 — Add tag helper functions

**File:** `src/engine/dataSourceExpander.ts` (new exports, after existing tag helpers)

```typescript
export function filterScenariosByTags(
  scenarios: TestScenario[],
  tags: string[],
  mode: 'any' | 'all' = 'any',
): TestScenario[] {
  if (tags.length === 0) return scenarios;
  return scenarios.filter(sc => {
    const scTags = sc.tags ?? [];
    if (scTags.length === 0) return false;
    return mode === 'any'
      ? tags.some(t => scTags.includes(t))
      : tags.every(t => scTags.includes(t));
  });
}

export function collectAllScenarioTags(featureGroups: FeatureGroup[]): string[] {
  const tagSet = new Set<string>();
  for (const fg of featureGroups) {
    for (const sc of fg.scenarios) {
      for (const tag of sc.tags ?? []) tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
}

export function countScenariosByTag(
  featureGroups: FeatureGroup[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const fg of featureGroups) {
    for (const sc of fg.scenarios) {
      for (const tag of sc.tags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
  }
  return counts;
}
```

### Step 1.4 — Storage: no migration needed

Tags are an optional field (`tags?: string[]`). Existing data loads with `tags === undefined`, which is handled correctly by all filtering functions (treated as "untagged"). No migration step is required — the field is simply absent on old data.

**Verify in `loadFeatureGroups()`** (`src/shared/utils/storage.ts:426`): no changes needed. The existing JSON blob round-trips unknown fields. Confirm with a test that loads a `FeatureGroup` without `tags` and verifies `sc.tags === undefined`.

### Step 1.5 — JSON import/export round-trip

**Files to verify (no changes expected — passthrough):**

| File | Function | Status |
|---|---|---|
| `src/features/scenarios/utils/scenarioImportExport.ts` | `wrapExport`, `unwrapImport` | Passthrough — tags preserved in JSON blob |
| `src/features/scenarios/hooks/useScenarioExportImport.ts` | `exportAll`, `exportFeatureGroup`, `importAll` | Passthrough |
| `src/features/settings/SettingsExportImportTab.tsx` | Full app export | Passthrough |

**Write a round-trip unit test:** export a `FeatureGroup` with tagged scenarios → import → verify tags preserved.

### Step 1.6 — Add `scenarioTags` to `RequestResult`

**File:** `src/shared/types/index.ts` (after line 529)

```typescript
export interface RequestResult {
  // ... existing fields ...
  dataRowId?: string;
  dataRowLabel?: string;
  /** Tags from the parent TestScenario (for result filtering/reporting) */
  scenarioTags?: string[];
  // ... remaining fields ...
}
```

### Step 1.7 — Populate `scenarioTags` during execution

Tags flow from `TestScenario` → `Scenario` (transient) → `RequestResult`.

**File:** `src/shared/types/index.ts` — add transient field to `Scenario` (after line 332):

```typescript
export interface Scenario {
  // ... existing fields ...
  sourceSpecVersionLabel?: string;
  /** Transient: inherited from parent TestScenario for result tagging */
  scenarioTags?: string[];
}
```

**File:** `src/engine/executor.ts` (line ~143) — copy `scenarioTags` to result:

Where `RequestResult` is built, add:
```typescript
scenarioTags: scenario.scenarioTags,
```

**File:** `src/features/test-runner/hooks/useRunnerOrchestration.ts` — when building `selectedTests` from `TestScenario`, copy tags:

In the test-flattening logic where `TestScenario.tests` are spread into `Scenario[]`, add `scenarioTags: sc.tags` to each test.

**File:** `src/features/test-runner/utils/rustBridge.ts` — same pattern for Rust executor results:

In `mapRustResult()` / `mapRustResultWithoutValidation()`, copy `scenarioTags` from the source scenario.

### Step 1.8 — Unit tests

**New file:** `src/engine/dataSourceExpander.test.ts` (extend existing file)

- `filterScenariosByTags()` — 8 tests: empty tags, single tag any/all, multi-tag any/all, untagged scenarios, mixed
- `collectAllScenarioTags()` — 3 tests: empty, single group, multiple groups with overlapping tags
- `countScenariosByTag()` — 3 tests: empty, single, multiple

**New file:** `src/shared/types/index.test.ts` (or extend existing)

- Round-trip test: `FeatureGroup` with `TestScenario.tags` → JSON.stringify → JSON.parse → verify

---

## 4. Phase 2 — Scenario Builder UI

> Add tag pills, inline editing, and context menu actions to the Scenario Builder sidebar tree.

### Step 2.1 — Tag pills on scenario cards

**File:** `src/features/scenarios/ScenarioBuilder.tsx`

In the scenario card header (line ~531, after the `PARAM` badge), add tag pills:

```tsx
{sc.tags && sc.tags.length > 0 && (
  <span className="scenario-tag-pills">
    {sc.tags.map(tag => (
      <span key={tag} className="scenario-tag-pill">
        {tag}
        <button
          className="scenario-tag-pill-remove"
          onClick={(e) => { e.stopPropagation(); handleRemoveTag(fg.id, sc.id, tag); }}
          title={`Remove tag "${tag}"`}
        >×</button>
      </span>
    ))}
  </span>
)}
```

### Step 2.2 — useScenarioTags hook

**New file:** `src/features/scenarios/hooks/useScenarioTags.ts`

```typescript
interface UseScenarioTagsResult {
  addTag: (fgId: string, scId: string, tag: string) => void;
  removeTag: (fgId: string, scId: string, tag: string) => void;
  bulkAddTag: (targets: Array<{ fgId: string; scId: string }>, tag: string) => void;
  bulkRemoveTag: (targets: Array<{ fgId: string; scId: string }>, tag: string) => void;
  allTags: string[];         // unique tags across all scenarios
  tagCounts: Record<string, number>;  // tag → scenario count
  tagSuggestions: string[];  // built-in + existing tags for autocomplete
}

export function useScenarioTags(
  featureGroups: FeatureGroup[],
  setFeatureGroups: (fgs: FeatureGroup[]) => void,
): UseScenarioTagsResult {
  // addTag: normalize to lowercase, deduplicate, update FeatureGroup state
  // removeTag: filter out tag, set to undefined if empty
  // allTags: derived from collectAllScenarioTags()
  // tagSuggestions: merge BUILT_IN_SCENARIO_TAGS + allTags, deduplicate
}
```

Follow the same patterns as `useDataSourceTags.ts` (lines 41–122).

### Step 2.3 — Inline "add tag" button on scenario cards

**File:** `src/features/scenarios/ScenarioBuilder.tsx`

After tag pills, add a `+` button:

```tsx
<button
  className="scenario-tag-add-btn"
  onClick={(e) => { e.stopPropagation(); setEditingTagScenario({ fgId: fg.id, scId: sc.id }); }}
  title="Add tag"
>+</button>
```

When `editingTagScenario` matches, render an inline input with `<datalist>` for suggestions (same pattern as `DataSourceGridTable.tsx` lines 243–285):

```tsx
{editingTagScenario?.fgId === fg.id && editingTagScenario?.scId === sc.id && (
  <input
    className="scenario-tag-input"
    autoFocus
    list="scenario-tag-suggestions"
    placeholder="tag name"
    onKeyDown={(e) => {
      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
        addTag(fg.id, sc.id, e.currentTarget.value.trim());
        e.currentTarget.value = '';
      }
      if (e.key === 'Escape') setEditingTagScenario(null);
    }}
    onBlur={() => setEditingTagScenario(null)}
  />
)}
<datalist id="scenario-tag-suggestions">
  {tagSuggestions.map(t => <option key={t} value={t} />)}
</datalist>
```

### Step 2.4 — Context menu for tagging

**File:** `src/features/scenarios/ScenarioBuilder.tsx`

Add `onContextMenu` handler on `.scenario-group-header` (line ~520):

```tsx
onContextMenu={(e) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY, fgId: fg.id, scId: sc.id });
}}
```

**New component:** `src/features/scenarios/components/ScenarioContextMenu.tsx`

```tsx
interface Props {
  x: number;
  y: number;
  scenario: TestScenario;
  tagSuggestions: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClose: () => void;
}
```

Menu items:
- "Add Tag" → submenu with `tagSuggestions` (checkboxes, already-applied tags checked)
- "Remove All Tags" (danger, only if `tags.length > 0`)
- Separator
- Existing actions (rename, duplicate, delete — move from inline buttons)

### Step 2.5 — Feature group tag summary badge

**File:** `src/features/scenarios/ScenarioBuilder.tsx` (line ~392)

Show aggregated tags from child scenarios as a subtle summary:

```tsx
{(() => {
  const fgTags = [...new Set(fg.scenarios.flatMap(sc => sc.tags ?? []))];
  return fgTags.length > 0 ? (
    <span className="fg-tag-summary" title={`Tags: ${fgTags.join(', ')}`}>
      🏷 {fgTags.length}
    </span>
  ) : null;
})()}
```

### Step 2.6 — CSS

**File:** `src/styles/scenario-builder.css` (append)

```css
/* ─── Scenario Tags ─── */
.scenario-tag-pills { display: flex; flex-wrap: wrap; gap: 3px; margin-left: 6px; }
.scenario-tag-pill {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 1px 6px; border-radius: 3px; font-size: 0.65rem;
  background: var(--tag-bg, rgba(66,153,225,0.15));
  color: var(--tag-color, #63b3ed);
  white-space: nowrap;
}
.scenario-tag-pill-remove {
  background: none; border: none; color: inherit;
  cursor: pointer; font-size: 0.6rem; padding: 0 2px;
  opacity: 0.6;
}
.scenario-tag-pill-remove:hover { opacity: 1; color: var(--danger, #fc8181); }
.scenario-tag-add-btn {
  background: none; border: 1px dashed var(--border, #3b4a60);
  border-radius: 3px; color: var(--text-muted); cursor: pointer;
  font-size: 0.6rem; padding: 1px 5px; margin-left: 4px;
  opacity: 0.5;
}
.scenario-tag-add-btn:hover { opacity: 1; border-color: var(--accent); }
.scenario-tag-input {
  width: 80px; font-size: 0.65rem; padding: 1px 4px;
  background: var(--input-bg); border: 1px solid var(--accent);
  border-radius: 3px; color: var(--text);
}
.fg-tag-summary {
  font-size: 0.6rem; color: var(--text-muted); margin-left: 4px;
}
```

### Step 2.7 — Unit tests

**New file:** `src/features/scenarios/hooks/useScenarioTags.test.ts`

- `addTag()` — adds to empty, adds to existing, normalizes to lowercase, deduplicates
- `removeTag()` — removes existing, no-op for missing, sets undefined when last removed
- `bulkAddTag()` — adds to multiple scenarios
- `allTags` — computes from feature groups
- `tagSuggestions` — merges built-in + existing, sorted

---

## 5. Phase 3 — Test Runner Filtering

> Filter tests by scenario tags in the Scenario Selector and the runner execution pipeline.

### Step 3.1 — ScenarioSelector tag filter bar

**File:** `src/features/test-runner/components/ScenarioSelector.tsx`

Add props (after line 9):

```typescript
interface Props {
  // ... existing props ...
  scenarioTagFilter?: string[];
  onScenarioTagFilterChange?: (tags: string[]) => void;
}
```

Add tag-based filtering memo (after line 61, after `kind` filtering):

```typescript
const tagFilteredGroups = useMemo(() => {
  if (!scenarioTagFilter || scenarioTagFilter.length === 0) return featureGroups;
  return featureGroups
    .map(fg => ({
      ...fg,
      scenarios: fg.scenarios.filter(sc => {
        const scTags = sc.tags ?? [];
        return scTags.length > 0 && scenarioTagFilter.some(t => scTags.includes(t));
      }),
    }))
    .filter(fg => fg.scenarios.length > 0);
}, [featureGroups, scenarioTagFilter]);
```

Add tag filter bar UI (after line ~205, in `.selection-header`):

```tsx
{allScenarioTags.length > 0 && (
  <div className="scenario-tag-filter-bar">
    <span className="scenario-tag-filter-label">Tags:</span>
    <button
      className={`scenario-tag-filter-btn ${scenarioTagFilter.length === 0 ? 'active' : ''}`}
      onClick={() => onScenarioTagFilterChange([])}
    >All</button>
    {allScenarioTags.map(tag => (
      <button
        key={tag}
        className={`scenario-tag-filter-btn ${scenarioTagFilter.includes(tag) ? 'active' : ''}`}
        onClick={() => toggleTag(tag)}
      >{tag} ({tagCounts[tag]})</button>
    ))}
  </div>
)}
```

Derive `allScenarioTags` and `tagCounts` from `rawFeatureGroups` (pre-kind-filter) using the helpers from Phase 1.

### Step 3.2 — Tag filter state in TestRunner and ParameterizedRunner

**File:** `src/features/test-runner/TestRunner.tsx` (line ~34)

```typescript
const [scenarioTagFilter, setScenarioTagFilter] = useState<string[]>([]);
```

Pass to `ScenarioSelector`:

```tsx
<ScenarioSelector
  // ... existing props ...
  scenarioTagFilter={scenarioTagFilter}
  onScenarioTagFilterChange={setScenarioTagFilter}
/>
```

Same in `src/features/test-runner/ParameterizedRunner.tsx`.

### Step 3.3 — Copy scenario tags to tests during flattening

**File:** `src/features/test-runner/hooks/useRunnerOrchestration.ts`

When `selectedTests` is derived from `TestScenario[]`, each `Scenario` needs `scenarioTags`:

Find where tests are flattened from scenarios and add:

```typescript
const testsWithTags = scenario.tests.map(t => ({
  ...t,
  scenarioTags: scenario.tags,
}));
```

### Step 3.4 — Extend handleRun for scenario-level tag filtering

**File:** `src/features/test-runner/hooks/useRunnerOrchestration.ts` (line ~157)

Before the existing row-tag filter, add scenario-tag filter:

```typescript
const handleRun = () => {
  let testsToRun = selectedTests as Scenario[];

  // Scenario-level tag filter (NEW — filter entire tests by their scenario tags)
  // This is already handled by ScenarioSelector filtering, but for safety:
  // if scenarioTagFilter is set, ensure only matching tests pass through.

  // Row-level tag filter (EXISTING — filter data rows within each test)
  if (runnerTagFilter) {
    // ... existing logic unchanged ...
  }
```

Since the `ScenarioSelector` already filters scenarios before checkbox selection (Step 3.1), the scenario-level filter is applied at the UI level. No changes needed in `handleRun` — it receives already-filtered tests.

### Step 3.5 — Upgrade the row-tag filter fieldset to chip bar

**File:** `src/features/test-runner/TestRunner.tsx` (line ~177)

Replace the text input with a chip-style filter bar (reusing `data-source-tag-filter-bar` pattern):

```tsx
{selectedTests.some(t => t.dataSource?.rows.some(r => r.tags?.length)) && (
  <div className="runner-row-tag-filter-bar">
    <span className="runner-tag-label">Row Tags:</span>
    <button className={`runner-tag-btn ${!runnerTagFilter ? 'active' : ''}`}
      onClick={() => setRunnerTagFilter('')}>All rows</button>
    {allRowTags.map(tag => (
      <button key={tag}
        className={`runner-tag-btn ${runnerTagFilter.includes(tag) ? 'active' : ''}`}
        onClick={() => toggleRowTag(tag)}>
        {tag} ({rowTagCounts[tag]})
      </button>
    ))}
  </div>
)}
```

### Step 3.6 — CSS for runner tag filters

**File:** `src/styles/test-runner.css` (append)

Reuse the same visual style as `data-source-tag-filter-bar` from `scenario-builder.css`.

### Step 3.7 — Unit tests

**File:** `src/features/test-runner/components/ScenarioSelector.test.tsx` (extend)

- Tag filter bar renders when scenarios have tags
- Tag filter bar hidden when no scenarios are tagged
- Clicking tag chip filters scenarios
- Clicking "All" clears filter
- Kind + tag filtering compose correctly

**File:** `src/features/test-runner/hooks/useRunnerOrchestration.test.ts` (extend)

- `scenarioTags` propagated from `TestScenario` to `Scenario` to `RequestResult`
- Tag filter does not affect untagged tests when not active

---

## 6. Phase 4 — CLI Integration

> Add `--scenario-tags` and `--scenario-tag-mode` flags, update reporters.

### Step 4.1 — Add `tags` to CLI test file schema

**File:** `cli/loader.ts` (line 19)

```typescript
interface TestFileScenario {
  name: string;
  url: string;
  // ... existing fields ...
  data?: { columns?: string[]; rows: (string[] | Record<string, unknown>)[] };
  tags?: string[];    // NEW — scenario-level tags for CLI filtering
}
```

### Step 4.2 — Copy tags in `buildScenarios`

**File:** `cli/loader.ts` (line ~184, in the `return` of the map)

```typescript
return {
  // ... existing fields ...
  dataSource,
  scenarioTags: t.tags,  // NEW
};
```

### Step 4.3 — Add CLI flags

**File:** `cli/index.ts` (after line 62, after `--tag-mode`)

```typescript
  .option('--scenario-tags <tags>', 'Run only tests with these scenario tags (comma-separated)')
  .option('--scenario-tag-mode <mode>', 'Scenario tag matching mode: any (default) or all', 'any')
```

### Step 4.4 — Implement scenario-tag filtering

**File:** `cli/index.ts` (after line 93, before row-tag filtering)

```typescript
      // ─── Scenario-level tag filtering ──────────────────
      if (opts.scenarioTags) {
        const filterTags = (opts.scenarioTags as string).split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
        const tagMode = (opts.scenarioTagMode === 'all' ? 'all' : 'any') as 'any' | 'all';
        const before = scenarios.length;
        scenarios = scenarios.filter(sc => {
          const scTags = sc.scenarioTags ?? [];
          if (scTags.length === 0) return false;
          return tagMode === 'any'
            ? filterTags.some(t => scTags.includes(t))
            : filterTags.every(t => scTags.includes(t));
        });
        if (!opts.quiet) {
          console.log(`  Scenario tags: ${filterTags.join(', ')} (mode: ${tagMode}, ${scenarios.length}/${before} tests matched)`);
        }
        if (scenarios.length === 0) {
          console.error('\n  ❌ No tests match the specified scenario tags.\n');
          process.exit(1);
        }
      }
```

### Step 4.5 — Include tags in reporters

**File:** `cli/reporters.ts`

**JUnit XML** (line ~88, in testcase attributes):

```typescript
const tagAttr = r.scenarioTags?.length
  ? ` tags="${escapeXml(r.scenarioTags.join(','))}"`
  : '';
lines.push(`    <testcase ... ${tagAttr}>`);
```

**Markdown report** (line ~134, in summary section):

```markdown
| Tags | smoke, regression |
```

**JSON report** — no changes needed; `RequestResult.scenarioTags` is already in the results array.

**Console summary** (line ~215):

```typescript
if (results.some(r => r.scenarioTags?.length)) {
  const allTags = [...new Set(results.flatMap(r => r.scenarioTags ?? []))].sort();
  console.log(`  Tags:     ${allTags.join(', ')}`);
}
```

### Step 4.6 — Update `validate` command

**File:** `cli/index.ts` (line ~407)

Show tags in validation output:

```typescript
const tagSuffix = s.scenarioTags?.length ? `  [${s.scenarioTags.join(', ')}]` : '';
console.log(`    - ${s.method} ${s.url}  (${s.name})${dataSuffix}${tagSuffix}`);
```

### Step 4.7 — Update YAML examples and docs

**File:** `examples/cli-basic-test.yaml` — add a `tags` field example:

```yaml
tests:
  - name: List Users
    url: https://jsonplaceholder.typicode.com/users
    method: GET
    tags: [smoke, regression]
    validation:
      status: "200"
```

**File:** `docs/guides/cli-reference.md` — add `--scenario-tags` and `--scenario-tag-mode` to the flag table, add usage examples:

```bash
# Run only smoke tests
redfireforge run tests.yaml --scenario-tags smoke

# Run tests tagged both "regression" AND "critical"
redfireforge run tests.yaml --scenario-tags regression,critical --scenario-tag-mode all

# Combine scenario tags with data row tags
redfireforge run tests.yaml --scenario-tags smoke --tags happy-path
```

### Step 4.8 — Unit tests

**File:** `cli/loader.test.ts` (extend)

- `buildScenarios` preserves `tags` from YAML → `scenarioTags` on `Scenario`
- Missing `tags` → `scenarioTags === undefined`

**File:** `cli/reporters.test.ts` (extend)

- JUnit XML includes `tags` attribute when present
- Markdown report includes tags row
- Console summary shows tags

**File:** `cli/index.test.ts` (or integration test)

- `--scenario-tags smoke` filters to matching tests only
- `--scenario-tags smoke,critical --scenario-tag-mode all` requires both tags
- `--scenario-tags nonexistent` exits with error
- Combined `--scenario-tags` + `--tags` applies both filters

---

## 7. Phase 5 — Search, Results & Polish

> Index tags in search, add tag filtering to Results Dashboard, add gallery samples and documentation.

### Step 5.1 — Index tags in scenario search

**File:** `src/features/scenarios/utils/scenarioSearch.ts` (line ~105)

Extend `buildSearchText`:

```typescript
export function buildSearchText(t: Scenario): string {
  const parts = [
    t.name, t.url, t.method, t.body,
    ...t.headers.flatMap((h) => [h.key, h.value]),
    t.auth.type,
    t.auth.tokenUrl ?? '', t.auth.clientId ?? '', t.auth.username ?? '',
    t.validation.mode,
    ...(t.validation.expectedFields ?? []).flatMap((f) => [f.jsonPath ?? '', f.expectedValue ?? '']),
    t.validation.expectedJson ?? '',
    ...(t.scenarioTags ?? []),    // NEW — index scenario tags
  ];
  return parts.join(' ');
}
```

**File:** `src/features/scenarios/hooks/useScenarioBuilderSearch.ts` (line ~22)

Extend `scenarioMatches` to include scenario-level tags:

```typescript
const scenarioMatches = (sc: TestScenario, query: QNode): boolean => {
  const scText = [sc.name, ...(sc.tags ?? [])].join(' ').toLowerCase();
  if (evaluateQuery(query, scText)) return true;
  return sc.tests.some(t => testMatches(t, query));
};
```

Update search help text in `ScenarioBuilder.tsx` (line ~366) to mention tags.

### Step 5.2 — Results Dashboard tag filtering

**File:** `src/features/results/ResultsDashboard.tsx`

Add state (after line ~95):

```typescript
const [resultTagFilter, setResultTagFilter] = useState<string | null>(null);
```

Extend `filteredResults` memo (after line ~208):

```typescript
if (resultTagFilter && !(r.scenarioTags ?? []).includes(resultTagFilter)) return false;
```

Add tag filter chips in the filter row (after line ~739):

```tsx
{resultTags.length > 0 && (
  <div className="results-tag-filter">
    <button className={`tag-chip ${!resultTagFilter ? 'active' : ''}`}
      onClick={() => setResultTagFilter(null)}>All</button>
    {resultTags.map(tag => (
      <button key={tag}
        className={`tag-chip ${resultTagFilter === tag ? 'active' : ''}`}
        onClick={() => setResultTagFilter(tag)}>
        {tag}
      </button>
    ))}
  </div>
)}
```

Derive `resultTags` from `selectedRun?.results`:

```typescript
const resultTags = useMemo(() => {
  if (!selectedRun) return [];
  const tags = new Set<string>();
  for (const r of selectedRun.results) {
    for (const t of r.scenarioTags ?? []) tags.add(t);
  }
  return [...tags].sort();
}, [selectedRun]);
```

### Step 5.3 — Include tags in search text for results

In the `filteredResults` memo (line ~208), extend the search matching:

```typescript
(r.scenarioTags ?? []).some(tag => tag.includes(q))
```

### Step 5.4 — Gallery sample with tags

**File:** `src/data/galleries/tests/presets.ts` (add a new factory)

```typescript
export function createTaggedTestSuite(): FeatureGroup {
  return {
    id: 'test-tagged-suite',
    name: 'Tagged Test Suite Demo',
    scenarios: [
      ts({
        id: 'ts-smoke',
        name: 'Smoke Tests',
        tags: ['smoke', 'critical'],
        tests: [
          s({ id: 'ts-smoke-health', name: 'Health Check', url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET', validation: { mode: 'status', statusAssertion: '200' } }),
        ],
      }),
      ts({
        id: 'ts-regression',
        name: 'Regression Tests',
        tags: ['regression'],
        tests: [
          s({ id: 'ts-reg-list', name: 'List All Users', url: 'https://jsonplaceholder.typicode.com/users', method: 'GET', validation: { mode: 'status', statusAssertion: '200' } }),
          s({ id: 'ts-reg-posts', name: 'List All Posts', url: 'https://jsonplaceholder.typicode.com/posts', method: 'GET', validation: { mode: 'status', statusAssertion: '200' } }),
        ],
      }),
      ts({
        id: 'ts-perf',
        name: 'Performance Tests',
        tags: ['performance', 'slow'],
        tests: [
          s({ id: 'ts-perf-bulk', name: 'Bulk Fetch (100 items)', url: 'https://jsonplaceholder.typicode.com/photos', method: 'GET', validation: { mode: 'status', statusAssertion: '200' } }),
        ],
      }),
    ],
  };
}
```

Register in `src/data/galleries/tests/index.ts`.

### Step 5.5 — Training manual

Create an HTML training manual for test tagging, following the existing pattern in `src/data/galleries/trainingPaths/`. Register in `manualMetadata.ts` and link from the gallery entry.

### Step 5.6 — Update documentation

| File | Update |
|---|---|
| `ROADMAP.md` | Mark "Test Tagging" as complete; add to Phase checklist |
| `CHANGELOG.md` | Add Test Tagging entry under `[Unreleased]` |
| `README.md` | Add "Test Tagging" to feature list |
| `docs/guides/cli-reference.md` | Document `--scenario-tags` and `--scenario-tag-mode` |
| `.cursor/rules/project-conventions.mdc` | Add new files to Key Files table |

### Step 5.7 — E2E tests

**New file:** `e2e/test-tagging.spec.ts`

- Create a feature group with scenarios, add tags via UI
- Verify tag pills render
- Verify tag filter in Scenario Selector filters correctly
- Verify context menu "Add Tag" works
- Remove tag, verify pill disappears
- Search by tag name, verify scenario found

---

## 8. Testing Strategy

| Phase | Test type | Scope | Target |
|---|---|---|---|
| 1 | Unit | `filterScenariosByTags`, `collectAllScenarioTags`, `countScenariosByTag` | 14+ tests |
| 1 | Unit | JSON import/export round-trip with tags | 2 tests |
| 2 | Unit | `useScenarioTags` hook | 10+ tests |
| 3 | Unit | `ScenarioSelector` tag filtering | 5+ tests |
| 3 | Unit | `useRunnerOrchestration` tag propagation | 3+ tests |
| 4 | Unit | CLI loader `buildScenarios` with tags | 3+ tests |
| 4 | Unit | CLI reporters with tags | 4+ tests |
| 4 | Integration | CLI `--scenario-tags` end-to-end | 4+ tests |
| 5 | Unit | `scenarioSearch` with tags | 3+ tests |
| 5 | E2E | Full UI flow (create → tag → filter → run → view results) | 6+ tests |

**Total estimated:** 55+ new tests

---

## 9. File Change Summary

### New files

| File | Purpose |
|---|---|
| `src/features/scenarios/hooks/useScenarioTags.ts` | Tag CRUD hook |
| `src/features/scenarios/hooks/useScenarioTags.test.ts` | Hook tests |
| `src/features/scenarios/components/ScenarioContextMenu.tsx` | Right-click tag menu |
| `src/features/scenarios/components/ScenarioContextMenu.test.tsx` | Menu tests |
| `e2e/test-tagging.spec.ts` | E2E tests |

### Modified files

| File | Changes |
|---|---|
| `src/shared/types/index.ts` | `TestScenario.tags`, `Scenario.scenarioTags` (transient), `RequestResult.scenarioTags` |
| `src/engine/dataSourceExpander.ts` | `BUILT_IN_SCENARIO_TAGS`, `filterScenariosByTags`, `collectAllScenarioTags`, `countScenariosByTag` |
| `src/engine/dataSourceExpander.test.ts` | Tests for new functions |
| `src/features/scenarios/ScenarioBuilder.tsx` | Tag pills, add button, context menu handler |
| `src/features/test-runner/components/ScenarioSelector.tsx` | Tag filter bar, tag-based scenario filtering |
| `src/features/test-runner/TestRunner.tsx` | `scenarioTagFilter` state, pass to selector |
| `src/features/test-runner/ParameterizedRunner.tsx` | Same as TestRunner |
| `src/features/test-runner/hooks/useRunnerOrchestration.ts` | Copy `scenarioTags` to tests |
| `src/engine/executor.ts` | Copy `scenarioTags` to `RequestResult` |
| `src/features/test-runner/utils/rustBridge.ts` | Copy `scenarioTags` to Rust result mapping |
| `src/features/scenarios/utils/scenarioSearch.ts` | Index `scenarioTags` in search text |
| `src/features/scenarios/hooks/useScenarioBuilderSearch.ts` | Include tags in scenario matching |
| `src/features/results/ResultsDashboard.tsx` | Tag filter state, chips, result filtering |
| `cli/loader.ts` | `TestFileScenario.tags`, copy to `scenarioTags` |
| `cli/index.ts` | `--scenario-tags`, `--scenario-tag-mode` flags and filtering logic |
| `cli/reporters.ts` | Tags in JUnit, Markdown, console output |
| `src/styles/scenario-builder.css` | Tag pill styles |
| `src/styles/test-runner.css` | Runner tag filter bar styles |
| `src/data/galleries/tests/presets.ts` | Tagged suite gallery sample |
| `src/data/galleries/tests/index.ts` | Register gallery entry |
| `docs/guides/cli-reference.md` | Document new CLI flags |
| `examples/cli-basic-test.yaml` | Add tags example |
| `ROADMAP.md`, `CHANGELOG.md`, `README.md` | Documentation updates |

---

## Implementation Order

```
Phase 1 (Day 1)     — Data model, helpers, storage verification, result type
  ↓
Phase 2 (Day 2-3)   — Scenario Builder UI (pills, hook, context menu, CSS)
  ↓
Phase 3 (Day 3-4)   — Test Runner filtering (selector, orchestration, state)
  ↓
Phase 4 (Day 4-5)   — CLI (flags, filtering, reporters, examples, docs)
  ↓
Phase 5 (Day 5-7)   — Search, Results Dashboard, gallery, training, polish
```

Each phase is independently testable and committable. Phase 1 must be done first; Phases 2-5 can be partially parallelized.
