# Test Tagging — Implementation Plan

> Label tests, scenarios, and feature groups with tags (`smoke`, `regression`, `critical`, etc.) and run only matching tests from the UI or CLI.

**Status:** In Progress — Phases 1, 2, 3, 4, 5A & 5B complete (Data Model & Storage, Scenario Builder UI, Test Runner Filtering, CLI Integration, Search Integration, Results Dashboard Filtering)
**Estimated effort:** 5–7 days across 5 phases
**Branch:** `feature/continue-plan-implementation`
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
10. [Implementation Checklist](#10-implementation-checklist)

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

| Layer | Status | File | Line |
|---|---|---|---|
| `DataSourceRow.tags?: string[]` | ✅ Implemented | `src/shared/types/index.ts` | ~209 |
| `BUILT_IN_TAGS` suggestions | ✅ Implemented | `src/engine/dataSourceExpander.ts` | 328 |
| Tag filter bar in Data Source Editor | ✅ Implemented | `src/features/scenarios/components/DataSourceEditor.tsx` | ~529 |
| `filterRowsByTags()` engine function | ✅ Implemented | `src/engine/dataSourceExpander.ts` | 336 |
| Runner tag filter (comma-separated) | ✅ Implemented | `src/features/test-runner/hooks/useRunnerOrchestration.ts` | ~38 |
| CLI `--tags` / `--tag-mode` | ✅ Implemented | `cli/index.ts` | 61, 62 |
| `DataSubset` named filters | ✅ Implemented | `src/shared/types/index.ts` | ~258 |

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
  │   buildSelectedTests.ts (copy scenarioTags to each test)
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

**Estimated effort:** 1 day

### Sub-Phase 1A: Type System Updates

#### 1A.1 — Add `tags` to `TestScenario`

**File:** `src/shared/types/index.ts` (line ~337)

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

#### 1A.2 — Add `scenarioTags` to `Scenario` (transient field)

**File:** `src/shared/types/index.ts` (after line ~332)

```typescript
export interface Scenario {
  // ... existing fields ...
  sourceSpecVersionLabel?: string;
  /** Transient: inherited from parent TestScenario for result tagging */
  scenarioTags?: string[];
}
```

#### 1A.3 — Add `scenarioTags` to `RequestResult`

**File:** `src/shared/types/index.ts` (after line ~541, after `dataRowLabel`)

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

#### 1A.4 — Unit tests

**File:** `src/shared/types/index.test.ts` (extend or create)

| # | Test Case |
|---|-----------|
| 1 | `TestScenario` accepts `tags` array |
| 2 | `TestScenario` works without `tags` (backward compat) |
| 3 | `Scenario` accepts `scenarioTags` transient field |
| 4 | `RequestResult` accepts `scenarioTags` |
| 5 | Round-trip: `FeatureGroup` with `TestScenario.tags` → JSON.stringify → JSON.parse → verify tags preserved |

---

### Sub-Phase 1B: Tag Helper Functions

#### 1B.1 — Add built-in scenario tag suggestions

**File:** `src/engine/dataSourceExpander.ts` (after line 328)

```typescript
export const BUILT_IN_TAGS = ['happy-path', 'edge-case', 'negative', 'boundary', 'regression', 'smoke'] as const;

/** Built-in scenario-level tag suggestions (different purpose than data row tags). */
export const BUILT_IN_SCENARIO_TAGS = [
  'smoke',        // Fast sanity checks
  'regression',   // Full test suite
  'critical',     // Business-critical paths
  'integration',  // Cross-service tests
  'e2e',          // End-to-end flows
  'performance',  // Load/stress tests
  'slow',         // Long-running tests (>30s)
  'flaky',        // Known unstable tests
  'wip',          // Work in progress
  'skip',         // Temporarily disabled
] as const;
```

#### 1B.2 — Add `filterScenariosByTags()` function

**File:** `src/engine/dataSourceExpander.ts` (new export, after `filterRowsByTags`)

```typescript
/**
 * Filter TestScenarios by tags.
 * @param scenarios  The scenarios to filter
 * @param tags       Tags to match against (lowercase)
 * @param mode       'any' = scenario matches if it has ANY of the tags, 'all' = must have ALL tags
 */
export function filterScenariosByTags(
  scenarios: TestScenario[],
  tags: string[],
  mode: 'any' | 'all' = 'any',
): TestScenario[] {
  if (tags.length === 0) return scenarios;
  const normalizedTags = tags.map(t => t.toLowerCase());
  return scenarios.filter(sc => {
    const scTags = sc.tags ?? [];
    if (scTags.length === 0) return false;
    return mode === 'any'
      ? normalizedTags.some(t => scTags.includes(t))
      : normalizedTags.every(t => scTags.includes(t));
  });
}
```

#### 1B.3 — Add `collectAllScenarioTags()` function

**File:** `src/engine/dataSourceExpander.ts`

```typescript
/**
 * Collect all unique tags across all scenarios in all feature groups.
 */
export function collectAllScenarioTags(featureGroups: FeatureGroup[]): string[] {
  const tagSet = new Set<string>();
  for (const fg of featureGroups) {
    for (const sc of fg.scenarios) {
      for (const tag of sc.tags ?? []) tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
}
```

#### 1B.4 — Add `countScenariosByTag()` function

**File:** `src/engine/dataSourceExpander.ts`

```typescript
/**
 * Count how many scenarios have each tag.
 */
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

#### 1B.5 — Add `normalizeTag()` function

**File:** `src/engine/dataSourceExpander.ts`

```typescript
/**
 * Normalize a tag: lowercase, trim, remove special characters.
 */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '');
}
```

#### 1B.6 — Unit tests

**File:** `src/engine/dataSourceExpander.test.ts` (extend existing)

| # | Test Case |
|---|-----------|
| 1 | `filterScenariosByTags()` — returns all when no filter tags |
| 2 | `filterScenariosByTags()` — mode 'any' matches if any tag present |
| 3 | `filterScenariosByTags()` — mode 'all' requires all tags |
| 4 | `filterScenariosByTags()` — excludes untagged scenarios |
| 5 | `filterScenariosByTags()` — handles empty scenarios array |
| 6 | `filterScenariosByTags()` — case-insensitive matching |
| 7 | `collectAllScenarioTags()` — returns empty for no groups |
| 8 | `collectAllScenarioTags()` — collects from single group |
| 9 | `collectAllScenarioTags()` — deduplicates across groups |
| 10 | `collectAllScenarioTags()` — returns sorted |
| 11 | `countScenariosByTag()` — returns empty for no tags |
| 12 | `countScenariosByTag()` — counts correctly across groups |
| 13 | `normalizeTag()` — lowercases and trims |
| 14 | `normalizeTag()` — removes special characters |

---

### Sub-Phase 1C: Storage Verification

#### 1C.1 — Verify JSON round-trip in storage

**Files to verify (no changes expected — passthrough):**

| File | Function | Status |
|---|---|---|
| `src/shared/utils/storage.ts` | `loadFeatureGroups`, `saveFeatureGroups` | Verify passthrough |
| `src/features/scenarios/utils/scenarioImportExport.ts` | `wrapExport`, `unwrapImport` | Verify passthrough |
| `src/features/scenarios/hooks/useScenarioExportImport.ts` | `exportAll`, `exportFeatureGroup`, `importAll` | Verify passthrough |

#### 1C.2 — Unit tests for storage round-trip

**File:** `src/features/scenarios/hooks/useScenarioExportImport.test.ts` (extend)

| # | Test Case |
|---|-----------|
| 1 | Export → import preserves `TestScenario.tags` |
| 2 | Import handles missing `tags` field (backward compat) |
| 3 | Export all feature groups preserves tags on all scenarios |

---

### Sub-Phase 1D: Result Tagging Pipeline

#### 1D.1 — Copy `scenarioTags` in `buildSelectedTests`

**File:** `src/features/test-runner/utils/buildSelectedTests.ts` (line ~61)

Update the `tests.push()` call to include `scenarioTags`:

```typescript
tests.push({
  ...test,
  url,
  auth,
  validation,
  dataSource,
  featureGroupName: fg.name,
  groupName: sc.name,
  scenarioTags: sc.tags,  // NEW — copy from parent TestScenario
});
```

#### 1D.2 — Copy `scenarioTags` in `SelectedTest` interface

**File:** `src/features/test-runner/utils/buildSelectedTests.ts` (line ~6)

```typescript
export interface SelectedTest extends Scenario {
  featureGroupName: string;
  groupName: string;
  scenarioTags?: string[];  // NEW
}
```

#### 1D.3 — Copy `scenarioTags` to `RequestResult` in executor

**File:** `src/engine/requestExecution.ts`

In `executeRequest()` and related functions, ensure `scenarioTags` is copied from `scenario` to result.

Find where `RequestResult` is constructed and add:

```typescript
scenarioTags: scenario.scenarioTags,
```

#### 1D.4 — Copy `scenarioTags` in Rust bridge

**File:** `src/features/test-runner/utils/rustBridge.ts`

In `mapRustResult()` and `mapRustResultWithoutValidation()`, copy `scenarioTags`:

```typescript
scenarioTags: scenario.scenarioTags,
```

#### 1D.5 — Unit tests

**File:** `src/features/test-runner/utils/buildSelectedTests.test.ts` (extend)

| # | Test Case |
|---|-----------|
| 1 | `buildSelectedTests` copies `scenarioTags` from `TestScenario` to each test |
| 2 | `buildSelectedTests` handles missing `tags` (undefined) |
| 3 | `buildSelectedTests` handles empty `tags` array |

**File:** `src/features/test-runner/utils/rustBridge.test.ts` (extend)

| # | Test Case |
|---|-----------|
| 1 | `mapRustResult` copies `scenarioTags` to result |
| 2 | `mapRustResultWithoutValidation` copies `scenarioTags` to result |

---

## 4. Phase 2 — Scenario Builder UI

> Add tag pills, inline editing, and context menu actions to the Scenario Builder sidebar tree.

**Estimated effort:** 2 days

### Sub-Phase 2A: Tag Hook

#### 2A.1 — Create `useScenarioTags` hook

**New file:** `src/features/scenarios/hooks/useScenarioTags.ts`

```typescript
import { useCallback, useMemo } from 'react';
import type { FeatureGroup } from '../../../shared/types';
import { BUILT_IN_SCENARIO_TAGS, collectAllScenarioTags, countScenariosByTag, normalizeTag } from '../../../engine/dataSourceExpander';

interface UseScenarioTagsResult {
  /** Add a tag to a scenario */
  addTag: (fgId: string, scId: string, tag: string) => void;
  /** Remove a tag from a scenario */
  removeTag: (fgId: string, scId: string, tag: string) => void;
  /** Add a tag to multiple scenarios at once */
  bulkAddTag: (targets: Array<{ fgId: string; scId: string }>, tag: string) => void;
  /** Remove a tag from multiple scenarios at once */
  bulkRemoveTag: (targets: Array<{ fgId: string; scId: string }>, tag: string) => void;
  /** Clear all tags from a scenario */
  clearTags: (fgId: string, scId: string) => void;
  /** All unique tags across all scenarios (sorted) */
  allTags: string[];
  /** Tag → scenario count */
  tagCounts: Record<string, number>;
  /** Combined suggestions: built-in + existing tags (deduplicated, sorted) */
  tagSuggestions: string[];
}

export function useScenarioTags(
  featureGroups: FeatureGroup[],
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>,
): UseScenarioTagsResult {
  
  const allTags = useMemo(() => collectAllScenarioTags(featureGroups), [featureGroups]);
  const tagCounts = useMemo(() => countScenariosByTag(featureGroups), [featureGroups]);
  
  const tagSuggestions = useMemo(() => {
    const set = new Set([...BUILT_IN_SCENARIO_TAGS, ...allTags]);
    return [...set].sort();
  }, [allTags]);

  const addTag = useCallback((fgId: string, scId: string, tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== fgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== scId) return sc;
          const existing = sc.tags ?? [];
          if (existing.includes(normalized)) return sc;
          return { ...sc, tags: [...existing, normalized] };
        }),
      };
    }));
  }, [setFeatureGroups]);

  const removeTag = useCallback((fgId: string, scId: string, tag: string) => {
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== fgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== scId) return sc;
          const filtered = (sc.tags ?? []).filter(t => t !== tag);
          return { ...sc, tags: filtered.length > 0 ? filtered : undefined };
        }),
      };
    }));
  }, [setFeatureGroups]);

  const bulkAddTag = useCallback((targets: Array<{ fgId: string; scId: string }>, tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    const targetSet = new Set(targets.map(t => `${t.fgId}:${t.scId}`));
    setFeatureGroups(prev => prev.map(fg => ({
      ...fg,
      scenarios: fg.scenarios.map(sc => {
        if (!targetSet.has(`${fg.id}:${sc.id}`)) return sc;
        const existing = sc.tags ?? [];
        if (existing.includes(normalized)) return sc;
        return { ...sc, tags: [...existing, normalized] };
      }),
    })));
  }, [setFeatureGroups]);

  const bulkRemoveTag = useCallback((targets: Array<{ fgId: string; scId: string }>, tag: string) => {
    const targetSet = new Set(targets.map(t => `${t.fgId}:${t.scId}`));
    setFeatureGroups(prev => prev.map(fg => ({
      ...fg,
      scenarios: fg.scenarios.map(sc => {
        if (!targetSet.has(`${fg.id}:${sc.id}`)) return sc;
        const filtered = (sc.tags ?? []).filter(t => t !== tag);
        return { ...sc, tags: filtered.length > 0 ? filtered : undefined };
      }),
    })));
  }, [setFeatureGroups]);

  const clearTags = useCallback((fgId: string, scId: string) => {
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== fgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== scId) return sc;
          return { ...sc, tags: undefined };
        }),
      };
    }));
  }, [setFeatureGroups]);

  return { addTag, removeTag, bulkAddTag, bulkRemoveTag, clearTags, allTags, tagCounts, tagSuggestions };
}
```

#### 2A.2 — Unit tests for hook

**New file:** `src/features/scenarios/hooks/useScenarioTags.test.ts`

| # | Test Case |
|---|-----------|
| 1 | `addTag` — adds to empty tags array |
| 2 | `addTag` — adds to existing tags |
| 3 | `addTag` — normalizes to lowercase |
| 4 | `addTag` — deduplicates (no-op if already present) |
| 5 | `addTag` — ignores empty/invalid tags |
| 6 | `removeTag` — removes existing tag |
| 7 | `removeTag` — no-op for missing tag |
| 8 | `removeTag` — sets `tags: undefined` when last tag removed |
| 9 | `bulkAddTag` — adds to multiple scenarios |
| 10 | `bulkRemoveTag` — removes from multiple scenarios |
| 11 | `clearTags` — removes all tags |
| 12 | `allTags` — computes from feature groups |
| 13 | `tagCounts` — counts scenarios per tag |
| 14 | `tagSuggestions` — merges built-in + existing, sorted |

---

### Sub-Phase 2B: Tag Pills UI

#### 2B.1 — Add tag pills to scenario card header

**File:** `src/features/scenarios/ScenarioBuilder.tsx` (line ~531, after the `PARAM` badge)

```tsx
{sc.tags && sc.tags.length > 0 && (
  <span className="scenario-tag-pills">
    {sc.tags.map(tag => (
      <span key={tag} className="scenario-tag-pill" title={`Tag: ${tag}`}>
        {tag}
        <button
          className="scenario-tag-pill-remove"
          onClick={(e) => { e.stopPropagation(); removeTag(fg.id, sc.id, tag); }}
          title={`Remove tag "${tag}"`}
          aria-label={`Remove tag ${tag}`}
        >×</button>
      </span>
    ))}
  </span>
)}
```

#### 2B.2 — Add inline "add tag" button

**File:** `src/features/scenarios/ScenarioBuilder.tsx`

After tag pills, add a `+` button:

```tsx
<button
  className="scenario-tag-add-btn"
  onClick={(e) => { e.stopPropagation(); setEditingTagScenario({ fgId: fg.id, scId: sc.id }); }}
  title="Add tag"
  aria-label="Add tag"
>+</button>
```

#### 2B.3 — Add inline tag input

**File:** `src/features/scenarios/ScenarioBuilder.tsx`

When `editingTagScenario` matches, render an inline input with `<datalist>`:

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
        setEditingTagScenario(null);
      }
      if (e.key === 'Escape') setEditingTagScenario(null);
    }}
    onBlur={() => setEditingTagScenario(null)}
  />
)}
```

Add the datalist at component root (render once):

```tsx
<datalist id="scenario-tag-suggestions">
  {tagSuggestions.map(t => <option key={t} value={t} />)}
</datalist>
```

#### 2B.4 — Add state for inline tag editing

**File:** `src/features/scenarios/ScenarioBuilder.tsx` (in component state)

```typescript
const [editingTagScenario, setEditingTagScenario] = useState<{ fgId: string; scId: string } | null>(null);
```

#### 2B.5 — Wire `useScenarioTags` hook

**File:** `src/features/scenarios/ScenarioBuilder.tsx`

```typescript
const { addTag, removeTag, clearTags, allTags, tagCounts, tagSuggestions } = useScenarioTags(featureGroups, setFeatureGroups);
```

---

### Sub-Phase 2C: Feature Group Tag Summary

#### 2C.1 — Add aggregated tag badge on feature group header

**File:** `src/features/scenarios/ScenarioBuilder.tsx` (line ~392, in FG header)

```tsx
{(() => {
  const fgTags = [...new Set(fg.scenarios.flatMap(sc => sc.tags ?? []))];
  return fgTags.length > 0 ? (
    <span className="fg-tag-summary" title={`Tags in this group: ${fgTags.join(', ')}`}>
      {fgTags.length} tag{fgTags.length !== 1 ? 's' : ''}
    </span>
  ) : null;
})()}
```

---

### Sub-Phase 2D: Context Menu

#### 2D.1 — Create `ScenarioContextMenu` component

**New file:** `src/features/scenarios/components/ScenarioContextMenu.tsx`

```typescript
import { useEffect, useRef } from 'react';
import type { TestScenario } from '../../../shared/types';

interface Props {
  x: number;
  y: number;
  scenario: TestScenario;
  tagSuggestions: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
  onClose: () => void;
}

export default function ScenarioContextMenu({
  x, y, scenario, tagSuggestions, onAddTag, onRemoveTag, onClearTags, onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const currentTags = scenario.tags ?? [];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="scenario-context-menu" style={{ left: x, top: y }}>
      <div className="context-menu-section">
        <div className="context-menu-label">Tags</div>
        {tagSuggestions.map(tag => (
          <label key={tag} className="context-menu-checkbox">
            <input
              type="checkbox"
              checked={currentTags.includes(tag)}
              onChange={(e) => e.target.checked ? onAddTag(tag) : onRemoveTag(tag)}
            />
            {tag}
          </label>
        ))}
      </div>
      {currentTags.length > 0 && (
        <>
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={onClearTags}>
            Remove All Tags
          </button>
        </>
      )}
    </div>
  );
}
```

#### 2D.2 — Wire context menu in ScenarioBuilder

**File:** `src/features/scenarios/ScenarioBuilder.tsx`

Add state:

```typescript
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  fgId: string;
  scId: string;
} | null>(null);
```

Add handler on `.scenario-group-header`:

```tsx
onContextMenu={(e) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY, fgId: fg.id, scId: sc.id });
}}
```

Render context menu:

```tsx
{contextMenu && (() => {
  const fg = featureGroups.find(f => f.id === contextMenu.fgId);
  const sc = fg?.scenarios.find(s => s.id === contextMenu.scId);
  if (!sc) return null;
  return (
    <ScenarioContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      scenario={sc}
      tagSuggestions={tagSuggestions}
      onAddTag={(tag) => addTag(contextMenu.fgId, contextMenu.scId, tag)}
      onRemoveTag={(tag) => removeTag(contextMenu.fgId, contextMenu.scId, tag)}
      onClearTags={() => clearTags(contextMenu.fgId, contextMenu.scId)}
      onClose={() => setContextMenu(null)}
    />
  );
})()}
```

#### 2D.3 — Unit tests for context menu

**New file:** `src/features/scenarios/components/ScenarioContextMenu.test.tsx`

| # | Test Case |
|---|-----------|
| 1 | Renders tag checkboxes for suggestions |
| 2 | Checkbox checked for existing tags |
| 3 | Checking checkbox calls `onAddTag` |
| 4 | Unchecking checkbox calls `onRemoveTag` |
| 5 | "Remove All Tags" button calls `onClearTags` |
| 6 | "Remove All Tags" hidden when no tags |
| 7 | Clicking outside closes menu |
| 8 | Escape key closes menu |

---

### Sub-Phase 2E: CSS Styles

#### 2E.1 — Add tag styles

**File:** `src/styles/scenario-builder.css` (append)

```css
/* ─── Scenario Tags ─── */
.scenario-tag-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-left: 6px;
}

.scenario-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.65rem;
  background: var(--tag-bg, rgba(66, 153, 225, 0.15));
  color: var(--tag-color, #63b3ed);
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scenario-tag-pill-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.6rem;
  padding: 0 2px;
  opacity: 0.6;
  flex-shrink: 0;
}

.scenario-tag-pill-remove:hover {
  opacity: 1;
  color: var(--danger, #fc8181);
}

.scenario-tag-add-btn {
  background: none;
  border: 1px dashed var(--border, #3b4a60);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.6rem;
  padding: 1px 5px;
  margin-left: 4px;
  opacity: 0.5;
}

.scenario-tag-add-btn:hover {
  opacity: 1;
  border-color: var(--accent);
  color: var(--accent);
}

.scenario-tag-input {
  width: 80px;
  font-size: 0.65rem;
  padding: 1px 4px;
  background: var(--input-bg);
  border: 1px solid var(--accent);
  border-radius: 3px;
  color: var(--text);
}

.fg-tag-summary {
  font-size: 0.6rem;
  color: var(--text-muted);
  margin-left: 4px;
}

/* ─── Context Menu ─── */
.scenario-context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--panel-bg, #1e2530);
  border: 1px solid var(--border, #3b4a60);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 6px 0;
  min-width: 160px;
}

.context-menu-section {
  padding: 4px 8px;
}

.context-menu-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.context-menu-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  cursor: pointer;
  font-size: 0.75rem;
}

.context-menu-checkbox input {
  margin: 0;
}

.context-menu-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.context-menu-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  text-align: left;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  font-size: 0.75rem;
}

.context-menu-item:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.05));
}

.context-menu-item.danger {
  color: var(--danger, #fc8181);
}
```

---

## 5. Phase 3 — Test Runner Filtering

> Filter tests by scenario tags in the Scenario Selector and the runner execution pipeline.

**Estimated effort:** 1.5 days

### Sub-Phase 3A: ScenarioSelector Tag Filter

#### 3A.1 — Add tag filter props to `ScenarioSelector`

**File:** `src/features/test-runner/components/ScenarioSelector.tsx` (line ~6)

```typescript
interface Props {
  // ... existing props ...
  scenarioTagFilter?: string[];
  onScenarioTagFilterChange?: (tags: string[]) => void;
  allScenarioTags?: string[];
  scenarioTagCounts?: Record<string, number>;
}
```

#### 3A.2 — Add tag-based filtering memo

**File:** `src/features/test-runner/components/ScenarioSelector.tsx` (after line ~65)

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

Replace `featureGroups` usage in the render with `tagFilteredGroups`.

#### 3A.3 — Add tag filter bar UI

**File:** `src/features/test-runner/components/ScenarioSelector.tsx` (in `.selection-header`)

```tsx
{allScenarioTags && allScenarioTags.length > 0 && (
  <div className="scenario-tag-filter-bar">
    <span className="scenario-tag-filter-label">Tags:</span>
    <button
      className={`scenario-tag-filter-btn ${!scenarioTagFilter || scenarioTagFilter.length === 0 ? 'active' : ''}`}
      onClick={() => onScenarioTagFilterChange?.([])}
    >
      All
    </button>
    {allScenarioTags.map(tag => (
      <button
        key={tag}
        className={`scenario-tag-filter-btn ${scenarioTagFilter?.includes(tag) ? 'active' : ''}`}
        onClick={() => {
          const current = scenarioTagFilter ?? [];
          const next = current.includes(tag)
            ? current.filter(t => t !== tag)
            : [...current, tag];
          onScenarioTagFilterChange?.(next);
        }}
      >
        {tag} ({scenarioTagCounts?.[tag] ?? 0})
      </button>
    ))}
  </div>
)}
```

#### 3A.4 — Unit tests

**File:** `src/features/test-runner/components/ScenarioSelector.test.tsx` (extend)

| # | Test Case |
|---|-----------|
| 1 | Tag filter bar renders when `allScenarioTags` is non-empty |
| 2 | Tag filter bar hidden when no scenario tags |
| 3 | Clicking tag button toggles filter |
| 4 | Clicking "All" clears filter |
| 5 | Tag count badges show correct counts |
| 6 | Kind filter + tag filter compose correctly |
| 7 | Filtered scenarios list updates on tag change |

---

### Sub-Phase 3B: Runner State Integration

#### 3B.1 — Add tag filter state to `useRunnerOrchestration`

**File:** `src/features/test-runner/hooks/useRunnerOrchestration.ts`

Add to options interface:

```typescript
interface RunnerOrchestrationOptions {
  // ... existing ...
  scenarioTagFilter?: string[];
  onScenarioTagFilterChange?: (tags: string[]) => void;
}
```

Add to result interface:

```typescript
export interface RunnerOrchestrationResult {
  // ... existing ...
  scenarioTagFilter: string[];
  setScenarioTagFilter: React.Dispatch<React.SetStateAction<string[]>>;
  allScenarioTags: string[];
  scenarioTagCounts: Record<string, number>;
}
```

Add state and derived values:

```typescript
const [scenarioTagFilter, setScenarioTagFilter] = useState<string[]>([]);
const allScenarioTags = useMemo(() => collectAllScenarioTags(featureGroups), [featureGroups]);
const scenarioTagCounts = useMemo(() => countScenariosByTag(featureGroups), [featureGroups]);
```

#### 3B.2 — Wire in `RunnerPage` component

**File:** `src/features/test-runner/components/RunnerPage.tsx`

Pass tag filter props to `ScenarioSelector`:

```tsx
<ScenarioSelector
  // ... existing props ...
  scenarioTagFilter={scenarioTagFilter}
  onScenarioTagFilterChange={setScenarioTagFilter}
  allScenarioTags={allScenarioTags}
  scenarioTagCounts={scenarioTagCounts}
/>
```

#### 3B.3 — Unit tests

**File:** `src/features/test-runner/hooks/useRunnerOrchestration.test.ts` (extend)

| # | Test Case |
|---|-----------|
| 1 | `allScenarioTags` derives from feature groups |
| 2 | `scenarioTagCounts` derives from feature groups |
| 3 | `scenarioTagFilter` state updates correctly |

---

### Sub-Phase 3C: CSS for Runner Tag Filters

**File:** `src/styles/test-runner.css` (append)

```css
/* ─── Scenario Tag Filter Bar ─── */
.scenario-tag-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 8px 0;
  padding: 6px 8px;
  background: var(--panel-bg-alt, rgba(0, 0, 0, 0.1));
  border-radius: 4px;
}

.scenario-tag-filter-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-right: 4px;
}

.scenario-tag-filter-btn {
  padding: 2px 8px;
  font-size: 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--border, #3b4a60);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.scenario-tag-filter-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}

.scenario-tag-filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
```

---

## 6. Phase 4 — CLI Integration

> Add `--scenario-tags` and `--scenario-tag-mode` flags, update reporters.

**Estimated effort:** 1 day

### Sub-Phase 4A: CLI Schema & Loader

#### 4A.1 — Add `tags` to CLI test file schema

**File:** `cli/loader.ts` (line ~19)

```typescript
interface TestFileScenario {
  name: string;
  url: string;
  // ... existing fields ...
  data?: { columns?: string[]; rows: (string[] | Record<string, unknown>)[] };
  tags?: string[];    // NEW — scenario-level tags for CLI filtering
}
```

#### 4A.2 — Copy tags in `buildScenarios`

**File:** `cli/loader.ts` (in the return of the map, ~line 184)

```typescript
return {
  // ... existing fields ...
  dataSource,
  scenarioTags: t.tags,  // NEW — copy from YAML
};
```

#### 4A.3 — Unit tests

**File:** `cli/loader.test.ts` (extend)

| # | Test Case |
|---|-----------|
| 1 | `buildScenarios` preserves `tags` from YAML → `scenarioTags` |
| 2 | Missing `tags` → `scenarioTags === undefined` |
| 3 | Empty `tags` array handled correctly |

---

### Sub-Phase 4B: CLI Flags

#### 4B.1 — Add `--scenario-tags` and `--scenario-tag-mode` flags

**File:** `cli/index.ts` (after line 62)

```typescript
  .option('--scenario-tags <tags>', 'Run only scenarios with these tags (comma-separated)')
  .option('--scenario-tag-mode <mode>', 'Scenario tag matching mode: any (default) or all', 'any')
```

#### 4B.2 — Implement scenario-tag filtering

**File:** `cli/index.ts` (after line ~93, before row-tag filtering)

```typescript
      // ─── Scenario-level tag filtering ──────────────────
      if (opts.scenarioTags) {
        const filterTags = (opts.scenarioTags as string)
          .split(',')
          .map((t: string) => t.trim().toLowerCase())
          .filter(Boolean);
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
          console.log(`  Scenario tags: ${filterTags.join(', ')} (mode: ${tagMode}, ${scenarios.length}/${before} scenarios matched)`);
        }
        if (scenarios.length === 0) {
          console.error('\n  ❌ No scenarios match the specified tags.\n');
          process.exit(1);
        }
      }
```

#### 4B.3 — Update `validate` command

**File:** `cli/index.ts` (line ~407)

Show tags in validation output:

```typescript
const tagSuffix = s.scenarioTags?.length ? `  [${s.scenarioTags.join(', ')}]` : '';
console.log(`    - ${s.method} ${s.url}  (${s.name})${dataSuffix}${tagSuffix}`);
```

---

### Sub-Phase 4C: Reporter Updates

#### 4C.1 — JUnit XML reporter

**File:** `cli/reporters.ts` (line ~87)

Add `tags` attribute to testcase:

```typescript
const tagAttr = r.scenarioTags?.length
  ? ` tags="${escapeXml(r.scenarioTags.join(','))}"`
  : '';
lines.push(`    <testcase classname="${escapeXml(className)}" name="${escapeXml(r.scenarioName)} [${r.method} ${escapeXml(r.url)}]${rowSuffix}" time="${time}"${tagAttr}>`);
```

#### 4C.2 — Markdown reporter

**File:** `cli/reporters.ts` (line ~134, in summary table)

Add tags row when present:

```typescript
if (results?.some(r => r.scenarioTags?.length)) {
  const allTags = [...new Set(results.flatMap(r => r.scenarioTags ?? []))].sort();
  lines.push(`| **Tags** | ${allTags.join(', ')} |`);
}
```

#### 4C.3 — Console summary

**File:** `cli/reporters.ts` (in console output function)

```typescript
if (results.some(r => r.scenarioTags?.length)) {
  const allTags = [...new Set(results.flatMap(r => r.scenarioTags ?? []))].sort();
  console.log(`  Tags:     ${allTags.join(', ')}`);
}
```

#### 4C.4 — Unit tests

**File:** `cli/reporters.test.ts` (extend)

| # | Test Case |
|---|-----------|
| 1 | JUnit XML includes `tags` attribute when present |
| 2 | JUnit XML omits `tags` attribute when missing |
| 3 | Markdown report includes Tags row when present |
| 4 | Console summary shows tags |

---

### Sub-Phase 4D: Documentation & Examples

#### 4D.1 — Update YAML example

**File:** `examples/cli-basic-test.yaml`

```yaml
tests:
  - name: List Users
    url: https://jsonplaceholder.typicode.com/users
    method: GET
    tags: [smoke, regression]
    validation:
      status: "200"

  - name: Create User (Critical)
    url: https://jsonplaceholder.typicode.com/users
    method: POST
    tags: [smoke, critical]
    body: '{"name": "Test User"}'
    validation:
      status: "201"
```

#### 4D.2 — Update CLI reference

**File:** `docs/guides/cli-reference.md`

Add to flags table:

| Flag | Description |
|---|---|
| `--scenario-tags <tags>` | Run only scenarios with these tags (comma-separated) |
| `--scenario-tag-mode <mode>` | Tag matching: `any` (default, OR) or `all` (AND) |

Add usage examples:

```bash
# Run only smoke tests
redfireforge run tests.yaml --scenario-tags smoke

# Run tests tagged both "regression" AND "critical"
redfireforge run tests.yaml --scenario-tags regression,critical --scenario-tag-mode all

# Combine scenario tags with data row tags
redfireforge run tests.yaml --scenario-tags smoke --tags happy-path
```

---

## 7. Phase 5 — Search, Results & Polish

> Index tags in search, add tag filtering to Results Dashboard, add gallery samples and documentation.

**Estimated effort:** 1.5 days

### Sub-Phase 5A: Search Integration

#### 5A.1 — Index tags in scenario search

**File:** `src/features/scenarios/utils/scenarioSearch.ts` (line ~106)

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

#### 5A.2 — Include scenario-level tags in search

**File:** `src/features/scenarios/hooks/useScenarioBuilderSearch.ts` (line ~22)

```typescript
const scenarioMatches = (sc: TestScenario, query: QNode): boolean => {
  const scText = [sc.name, ...(sc.tags ?? [])].join(' ').toLowerCase();
  if (evaluateQuery(query, scText)) return true;
  return sc.tests.some(t => testMatches(t, query));
};
```

#### 5A.3 — Update search help text

**File:** `src/features/scenarios/ScenarioBuilder.tsx` (search input placeholder)

Update placeholder to mention tags: `"Search tests, URLs, methods, tags..."`

#### 5A.4 — Unit tests

**File:** `src/features/scenarios/utils/scenarioSearch.test.ts` (extend)

| # | Test Case |
|---|-----------|
| 1 | `buildSearchText` includes `scenarioTags` |
| 2 | Search finds scenario by tag name |
| 3 | Search finds test when parent scenario has matching tag |

---

### Sub-Phase 5B: Results Dashboard Filtering

#### 5B.1 — Add tag filter state

**File:** `src/features/results/ResultsDashboard.tsx` (after line ~95)

```typescript
const [resultTagFilter, setResultTagFilter] = useState<string | null>(null);
```

#### 5B.2 — Derive result tags

**File:** `src/features/results/ResultsDashboard.tsx`

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

#### 5B.3 — Extend `filteredResults` memo

**File:** `src/features/results/ResultsDashboard.tsx` (in filter logic)

Add tag filter condition:

```typescript
if (resultTagFilter && !(r.scenarioTags ?? []).includes(resultTagFilter)) return false;
```

#### 5B.4 — Add tag filter chips UI

**File:** `src/features/results/ResultsDashboard.tsx` (in filter row)

```tsx
{resultTags.length > 0 && (
  <div className="results-tag-filter">
    <span className="results-tag-label">Tags:</span>
    <button
      className={`results-tag-chip ${!resultTagFilter ? 'active' : ''}`}
      onClick={() => setResultTagFilter(null)}
    >
      All
    </button>
    {resultTags.map(tag => (
      <button
        key={tag}
        className={`results-tag-chip ${resultTagFilter === tag ? 'active' : ''}`}
        onClick={() => setResultTagFilter(resultTagFilter === tag ? null : tag)}
      >
        {tag}
      </button>
    ))}
  </div>
)}
```

#### 5B.5 — Include tags in search text for results

In `filteredResults` search matching, extend to include tags:

```typescript
(r.scenarioTags ?? []).some(tag => tag.toLowerCase().includes(searchLower))
```

#### 5B.6 — CSS for results tag filter

**File:** `src/styles/results.css` (append)

```css
.results-tag-filter {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
}

.results-tag-label {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.results-tag-chip {
  padding: 2px 8px;
  font-size: 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.results-tag-chip:hover {
  border-color: var(--accent);
  color: var(--text);
}

.results-tag-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
```

---

### Sub-Phase 5C: Gallery Sample

#### 5C.1 — Create tagged test suite sample

**File:** `src/data/galleries/tests/presets.ts` (add new factory)

```typescript
export function createTaggedTestSuite(): FeatureGroup {
  return {
    id: 'gallery-tagged-suite',
    name: 'Tagged Test Suite Demo',
    source: 'gallery',
    scenarios: [
      {
        id: 'ts-smoke',
        name: 'Smoke Tests',
        kind: 'standard',
        tags: ['smoke', 'critical'],
        tests: [
          {
            id: 'test-smoke-health',
            name: 'Health Check',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none', assertions: [{ type: 'status', expected: '200' }] },
          },
        ],
      },
      {
        id: 'ts-regression',
        name: 'Regression Tests',
        kind: 'standard',
        tags: ['regression'],
        tests: [
          {
            id: 'test-reg-list',
            name: 'List All Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none', assertions: [{ type: 'status', expected: '200' }] },
          },
          {
            id: 'test-reg-posts',
            name: 'List All Posts',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none', assertions: [{ type: 'status', expected: '200' }] },
          },
        ],
      },
      {
        id: 'ts-edge',
        name: 'Edge Case Tests',
        kind: 'standard',
        tags: ['regression', 'edge-case'],
        tests: [
          {
            id: 'test-edge-404',
            name: 'Not Found Handling',
            url: 'https://jsonplaceholder.typicode.com/users/999999',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none', assertions: [{ type: 'status', expected: '404' }] },
          },
        ],
      },
    ],
  };
}
```

#### 5C.2 — Register in gallery index

**File:** `src/data/galleries/tests/index.ts`

```typescript
import { createTaggedTestSuite } from './presets';

export const galleryTestEntries: GalleryEntry[] = [
  // ... existing entries ...
  {
    id: 'tagged-test-suite',
    name: 'Tagged Test Suite',
    description: 'Demonstrates scenario-level tags (smoke, regression, critical) for filtered test runs',
    category: 'Examples',
    factory: createTaggedTestSuite,
  },
];
```

---

### Sub-Phase 5D: Documentation

#### 5D.1 — User guide

**New file:** `docs/guides/test-tagging-guide.md`

```markdown
# Test Tagging Guide

Tags let you organize and filter tests by category (smoke, regression, critical, etc.).

## Adding Tags in the UI

1. Open the **Harness** page → Scenario Builder
2. Right-click any scenario → Toggle tags via checkboxes
3. Or click the **+** button next to a scenario name to add inline
4. Tags appear as colored pills on scenario headers

## Running Tagged Tests

### UI Runner

1. Go to the **Runner** page
2. Use the **Tags** filter bar to show only matching scenarios
3. Check scenarios to include, then run

### CLI

```bash
# Run only smoke tests
redfireforge run tests.yaml --scenario-tags smoke

# Run tests tagged both "regression" AND "critical"
redfireforge run tests.yaml --scenario-tags regression,critical --scenario-tag-mode all
```

## Built-in Tag Suggestions

- `smoke` — Fast sanity checks (<2 min)
- `regression` — Full test suite
- `critical` — Business-critical paths
- `integration` — Cross-service tests
- `e2e` — End-to-end flows
- `performance` — Load/stress tests
- `slow` — Long-running tests
- `flaky` — Known unstable tests
- `wip` — Work in progress
- `skip` — Temporarily disabled

## Tag Hierarchy

Tags are assigned at the **scenario** level (TestScenario). All tests within a tagged scenario inherit that tag for filtering and reporting. This matches how test suites are typically organized.

## Filtering Results

After running tests, the Results Dashboard shows a tag filter bar. Click any tag to show only results from scenarios with that tag.
```

#### 5D.2 — Update ROADMAP.md

**File:** `ROADMAP.md` (add entry)

```markdown
## v0.6.0 (Test Tagging)

- [x] Phase 1: Data model (`TestScenario.tags`, helper functions)
- [x] Phase 2: Scenario Builder UI (tag pills, context menu)
- [x] Phase 3: Test Runner filtering
- [x] Phase 4: CLI integration (`--scenario-tags`, reporters)
- [x] Phase 5: Search, Results Dashboard, gallery sample
```

#### 5D.3 — Update CHANGELOG.md

**File:** `CHANGELOG.md` (add to [Unreleased])

```markdown
### Added
- **Test Tagging**: Label scenarios with tags (`smoke`, `regression`, `critical`, etc.)
  - Tag pills on scenario headers with inline editing
  - Right-click context menu for quick tag assignment
  - Tag filter bar in Test Runner to run subsets
  - CLI: `--scenario-tags`, `--scenario-tag-mode` flags
  - Tags in JUnit XML and Markdown reports
  - Tag-based filtering in Results Dashboard
  - Gallery sample: "Tagged Test Suite Demo"
```

---

## 8. Testing Strategy

### Unit Test Coverage Target

| Module | File | Target |
|---|---|---|
| Types | `src/shared/types/index.test.ts` | 100% |
| Helpers | `src/engine/dataSourceExpander.test.ts` | >95% |
| Hook | `src/features/scenarios/hooks/useScenarioTags.test.ts` | >95% |
| Context Menu | `src/features/scenarios/components/ScenarioContextMenu.test.ts` | >90% |
| Selector | `src/features/test-runner/components/ScenarioSelector.test.ts` | >90% |
| Build | `src/features/test-runner/utils/buildSelectedTests.test.ts` | >95% |
| CLI Loader | `cli/loader.test.ts` | >90% |
| CLI Reporters | `cli/reporters.test.ts` | >90% |
| Search | `src/features/scenarios/utils/scenarioSearch.test.ts` | >90% |

### E2E Test Scenarios

**New file:** `e2e/test-tagging.spec.ts`

| # | Scenario |
|---|----------|
| 1 | Add tag to scenario via context menu → pill appears |
| 2 | Remove tag via pill × button → pill disappears |
| 3 | Add tag via inline input with Enter key |
| 4 | Tag autocomplete shows built-in + existing suggestions |
| 5 | Runner tag filter shows only matching scenarios |
| 6 | Runner: run tagged scenarios → results have correct tags |
| 7 | Results Dashboard: filter by tag shows only matching results |
| 8 | Search: query by tag name finds matching scenarios |
| 9 | Export/import preserves tags |
| 10 | Gallery sample loads with pre-configured tags |

### CLI E2E Tests

**New file:** `cli/test-tagging.test.ts`

| # | Scenario |
|---|----------|
| 1 | `--scenario-tags smoke` filters to tagged scenarios only |
| 2 | `--scenario-tag-mode all` requires all tags present |
| 3 | Untagged scenarios excluded by tag filter |
| 4 | JUnit report includes tags attribute |
| 5 | Markdown report includes tags row |
| 6 | `--scenario-tags invalid` exits with error (no match) |

---

## 9. File Change Summary

### New Files

| File | Description |
|---|---|
| `src/features/scenarios/hooks/useScenarioTags.ts` | Tag CRUD hook |
| `src/features/scenarios/hooks/useScenarioTags.test.ts` | Unit tests |
| `src/features/scenarios/components/ScenarioContextMenu.tsx` | Context menu component |
| `src/features/scenarios/components/ScenarioContextMenu.test.tsx` | Unit tests |
| `docs/guides/test-tagging-guide.md` | User documentation |
| `e2e/test-tagging.spec.ts` | E2E tests |
| `cli/test-tagging.test.ts` | CLI E2E tests |

### Modified Files

| File | Changes |
|---|---|
| `src/shared/types/index.ts` | Add `tags` to `TestScenario`, `scenarioTags` to `Scenario`/`RequestResult` |
| `src/engine/dataSourceExpander.ts` | Add `BUILT_IN_SCENARIO_TAGS`, helper functions |
| `src/engine/dataSourceExpander.test.ts` | Add unit tests for new functions |
| `src/features/scenarios/ScenarioBuilder.tsx` | Tag pills, context menu, inline input |
| `src/features/scenarios/utils/scenarioSearch.ts` | Index tags in search |
| `src/features/scenarios/utils/scenarioSearch.test.ts` | Test tag indexing |
| `src/features/test-runner/utils/buildSelectedTests.ts` | Copy `scenarioTags` to tests |
| `src/features/test-runner/utils/buildSelectedTests.test.ts` | Test tag copying |
| `src/features/test-runner/components/ScenarioSelector.tsx` | Tag filter bar |
| `src/features/test-runner/components/ScenarioSelector.test.tsx` | Test tag filtering |
| `src/features/test-runner/hooks/useRunnerOrchestration.ts` | Tag filter state |
| `src/features/test-runner/components/RunnerPage.tsx` | Wire tag filter props |
| `src/features/test-runner/utils/rustBridge.ts` | Copy `scenarioTags` in mappers |
| `src/features/test-runner/utils/rustBridge.test.ts` | Test tag copying |
| `src/features/results/ResultsDashboard.tsx` | Tag filter UI |
| `src/engine/requestExecution.ts` | Copy `scenarioTags` to results |
| `cli/index.ts` | Add `--scenario-tags`, `--scenario-tag-mode` flags |
| `cli/loader.ts` | Add `tags` to schema, copy to `scenarioTags` |
| `cli/loader.test.ts` | Test tag loading |
| `cli/reporters.ts` | Include tags in JUnit/Markdown |
| `cli/reporters.test.ts` | Test tag reporting |
| `src/data/galleries/tests/presets.ts` | Tagged test suite factory |
| `src/data/galleries/tests/index.ts` | Register gallery entry |
| `src/styles/scenario-builder.css` | Tag pill, context menu styles |
| `src/styles/test-runner.css` | Tag filter bar styles |
| `src/styles/results.css` | Results tag filter styles |
| `ROADMAP.md` | Add v0.6.0 entry |
| `CHANGELOG.md` | Add [Unreleased] entry |
| `examples/cli-basic-test.yaml` | Add tags example |
| `docs/guides/cli-reference.md` | Document new flags |

---

## 10. Implementation Checklist

### Phase 1 — Data Model & Storage

- [x] **1A.1** Add `tags?: string[]` to `TestScenario` interface ✅ (2026-05-22)
- [x] **1A.2** Add `scenarioTags?: string[]` to `Scenario` interface ✅ (2026-05-22)
- [x] **1A.3** Add `scenarioTags?: string[]` to `RequestResult` interface ✅ (2026-05-22)
- [ ] **1A.4** Write unit tests for type round-trip
- [x] **1B.1** Add `BUILT_IN_SCENARIO_TAGS` constant ✅ (2026-05-22)
- [x] **1B.2** Implement `filterScenariosByTags()` function ✅ (2026-05-22)
- [x] **1B.3** Implement `collectAllScenarioTags()` function ✅ (2026-05-22)
- [x] **1B.4** Implement `countScenariosByTag()` function ✅ (2026-05-22)
- [x] **1B.5** Implement `normalizeTag()` function ✅ (2026-05-22)
- [x] **1B.6** Write unit tests for all helper functions ✅ (2026-05-22)
- [x] **1C.1** Verify storage passthrough (manual check) ✅ (2026-05-22)
- [x] **1C.2** Write import/export round-trip test ✅ (2026-05-22)
- [x] **1D.1** Copy `scenarioTags` in `buildSelectedTests` ✅ (2026-05-22)
- [x] **1D.2** Update `SelectedTest` interface ✅ (2026-05-22)
- [x] **1D.3** Copy `scenarioTags` in executor ✅ (2026-05-22)
- [x] **1D.4** Copy `scenarioTags` in Rust bridge ✅ (2026-05-22)
- [x] **1D.5** Write unit tests for tag propagation ✅ (2026-05-22)
- [x] Run `npx tsc -b --noEmit` — 0 errors ✅ (2026-05-22)
- [x] Run `npx vitest run` — 0 failures ✅ (2026-05-22, 19326 tests passed)

### Phase 2 — Scenario Builder UI

- [x] **2A.1** Create `useScenarioTags` hook ✅ (2026-05-22)
- [x] **2A.2** Write unit tests for hook (17 tests) ✅ (2026-05-22)
- [x] **2B.1** Add tag pills to scenario header ✅ (2026-05-22)
- [x] **2B.2** Add inline "add tag" button ✅ (2026-05-22)
- [x] **2B.3** Add inline tag input with datalist ✅ (2026-05-22)
- [x] **2B.4** Add `editingTagScenario` state ✅ (2026-05-22)
- [x] **2B.5** Wire `useScenarioTags` in ScenarioBuilder ✅ (2026-05-22)
- [x] **2C.1** Add aggregated tag badge on FG header ✅ (2026-05-22)
- [x] **2D.1** Create `ScenarioContextMenu` component ✅ (2026-05-22)
- [x] **2D.2** Wire context menu in ScenarioBuilder ✅ (2026-05-22)
- [x] **2D.3** Write unit tests for context menu (9 tests) ✅ (2026-05-22)
- [x] **2E.1** Add CSS for tag pills, context menu ✅ (2026-05-22)
- [x] Run `npx tsc -b --noEmit` — 0 errors ✅ (2026-05-22)
- [x] Run `npx vitest run` — 0 failures ✅ (2026-05-22)

### Phase 3 — Test Runner Filtering

- [x] **3A.1** Add tag filter props to `ScenarioSelector` ✅ (2026-05-22)
- [x] **3A.2** Add tag-based filtering memo ✅ (2026-05-22)
- [x] **3A.3** Add tag filter bar UI ✅ (2026-05-22)
- [x] **3A.4** Write unit tests for selector (12 new tests) ✅ (2026-05-22)
- [x] **3B.1** Add tag filter state to `useRunnerOrchestration` ✅ (2026-05-22)
- [x] **3B.2** Wire in `RunnerPage` ✅ (2026-05-22)
- [x] **3B.3** Write unit tests for orchestration hook (4 new tests) ✅ (2026-05-22)
- [x] **3C** Add CSS for runner tag filters ✅ (2026-05-22)
- [x] Run `npx tsc -b --noEmit` — 0 errors ✅ (2026-05-22)
- [x] Run `npx vitest run` — 0 failures ✅ (2026-05-22, 1069 test-runner tests)

### Phase 4 — CLI Integration

- [x] **4A.1** Add `tags` to CLI schema ✅ (2026-05-22)
- [x] **4A.2** Copy tags in `buildScenarios` ✅ (2026-05-22)
- [x] **4A.3** Write unit tests for loader (32 tests) ✅ (2026-05-22)
- [x] **4B.1** Add `--scenario-tags` and `--scenario-tag-mode` flags ✅ (2026-05-22)
- [x] **4B.2** Implement scenario-tag filtering logic ✅ (2026-05-22)
- [x] **4B.3** Update `validate` command to show tags ✅ (2026-05-22)
- [x] **4C.1** Update JUnit XML reporter ✅ (2026-05-22)
- [x] **4C.2** Update Markdown reporter ✅ (2026-05-22)
- [x] **4C.3** Update console summary ✅ (2026-05-22)
- [x] **4C.4** Write unit tests for reporters (29 tests) ✅ (2026-05-22)
- [x] **4D.1** Update YAML example (cli-basic-test.yaml) ✅ (2026-05-22)
- [x] Run `npx tsc -b --noEmit` — 0 errors ✅ (2026-05-22)
- [x] Run `npx vitest run` — 0 failures ✅ (2026-05-22, 61 CLI tests)

### Phase 5 — Search, Results & Polish

- [x] **5A.1** Index tags in `buildSearchText` ✅ (2026-05-22)
- [x] **5A.2** Include scenario tags in search ✅ (2026-05-22)
- [x] **5A.3** Update search placeholder text ✅ (2026-05-22)
- [x] **5A.4** Write unit tests for search (5 new tests) ✅ (2026-05-22)
- [x] **5A.5** Create useScenarioBuilderSearch.test.ts (13 tests) ✅ (2026-05-22)
- [x] **5B.1** Add tag filter state to ResultsDashboard ✅ (2026-05-22)
- [x] **5B.2** Derive result tags ✅ (2026-05-22)
- [x] **5B.3** Extend `filteredResults` memo ✅ (2026-05-22)
- [x] **5B.4** Add tag filter chips UI ✅ (2026-05-22)
- [x] **5B.5** Include tags in search text ✅ (2026-05-22)
- [x] **5B.6** Add CSS for results tag filter ✅ (2026-05-22)
- [x] **5B.7** Reset tag filter when changing runs (selector, delete, auto-select) ✅ (2026-05-22, review fix)
- [ ] **5C.1** Create tagged test suite gallery factory
- [ ] **5C.2** Register in gallery index
- [ ] **5D.1** Write user guide
- [ ] **5D.2** Update ROADMAP.md
- [ ] **5D.3** Update CHANGELOG.md
- [x] Run `npx tsc -b --noEmit` — 0 errors ✅ (2026-05-22)
- [ ] Run `npx vitest run` — 0 failures, >90% coverage

### Final Checks

- [ ] E2E tests pass (`npx playwright test e2e/test-tagging.spec.ts --reporter=html`)
- [ ] CLI E2E tests pass
- [ ] Manual smoke test: add tags, filter, run, check results
- [ ] Documentation reviewed
- [ ] Code review by teammate
- [ ] Merge to `develop`

---

## Appendix: Design Decisions

### Why tags on `TestScenario` only (not `Scenario`)?

1. **Semantic alignment**: Scenarios group related tests. Tags categorize scenarios by purpose (smoke, regression). Individual tests rarely need different tags within the same scenario.
2. **UI simplicity**: One place to manage tags per scenario, not per test.
3. **CLI compatibility**: YAML schema maps 1:1 to TestScenario; no extra nesting needed.
4. **Result aggregation**: All tests in a scenario share the same tags for reporting.

### Why not tags on `FeatureGroup`?

Feature groups are organizational containers (folders). Tags serve a different purpose — categorizing by test type, not by project structure. A feature group might contain both smoke and regression scenarios.

### Why lowercase tags?

Matches existing `DataSourceRow.tags` convention. Avoids case-sensitivity confusion (`Smoke` vs `smoke`).

### Why free-form tags (not enum)?

Teams have different naming conventions. Built-in suggestions cover common cases; custom tags allow flexibility.

---

*Last updated: 2026-05-22 (Phase 5A & 5B complete, test-scenarios.md created)*