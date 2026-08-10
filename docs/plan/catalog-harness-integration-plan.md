# Catalog Enhancement Plan (v3)

> **Goal:** Enhance the Catalog with better spec visibility and request versioning. RedfireForge is a **performance testing workbench** — the Catalog helps users browse specs and import endpoints with version tracking.

---

## What RedfireForge Is

| Aspect | Description |
|--------|-------------|
| **Name** | RedfireForge — Redfire Performance Workbench |
| **Primary Use Case** | Performance testing, load testing HTTP APIs |
| **Core Value** | Execution pools, load profiles, parallel testing, results comparison/trend analysis |

**The Catalog is a spec browser with version tracking, not a contract test generator.**

---

## What Already Works

| Feature | Status | Notes |
|---------|--------|-------|
| Import OpenAPI specs | ✅ Done | File, paste, URL, gallery |
| Browse endpoints | ✅ Done | Tag groups, filter, search |
| Try It Out | ✅ Done | Send request from spec with parameter hints |
| API Info panel | ✅ Done | Shows parameter types, descriptions, response codes |
| Send to Requests | ✅ Done | Export endpoints to Requests tab |
| `catalogMeta` on RequestItem | ✅ Done | Links request back to source spec |

---

## Implementation Status

| Phase | Name | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 1 | API Info on Exported Requests | High | Small | ✅ Done |
| 2 | Coverage Badges in Catalog | Medium | Small | ✅ Done |
| 3 | Ensure catalogMeta with Version | High | Tiny | ✅ Done |
| 4 | Version Info in Export Modal | Medium | Small | ✅ Done |
| 5 | Request Versioning System | High | Medium | ✅ Done |
| 6 | Requests ↔ Harness Integration | Medium | Medium | ✅ Done |

---

## Phase 1: API Info on Exported Requests

**Priority: High | Effort: Small**

The "API Info" button currently only appears in the "Test Spec" section. Make it appear for ALL requests that have `catalogMeta` (i.e., came from a spec).

#### 1.1 Show API Info Button for Linked Requests

**File:** `src/features/requests/components/RequestEditor.tsx`

```tsx
{request.catalogMeta && (
  <button 
    className="api-info-btn"
    onClick={() => setShowApiReference(true)}
  >
    API Info
  </button>
)}
```

#### 1.2 Reuse Existing API Reference Panel

```tsx
{showApiReference && request.catalogMeta && (
  <ApiReferencePanel
    endpoint={findEndpointFromMeta(request.catalogMeta)}
    onClose={() => setShowApiReference(false)}
  />
)}
```

#### 1.3 Helper to Find Endpoint from Meta

```typescript
function findEndpointFromMeta(
  meta: CatalogRequestMeta,
  catalogEntries: CatalogEntry[],
): CatalogEndpoint | undefined {
  const entry = catalogEntries.find(e => e.id === meta.catalogEntryId);
  if (!entry) return undefined;
  return entry.endpoints.find(ep => ep.id === meta.catalogEndpointId);
}
```

Implementation note: the exported-request drawer also tolerates legacy `catalogMeta` objects that may be missing arrays like `tags`, `parameters`, or `expectedResponses`, so older saved requests still open safely.

#### 1.4 Unit Tests

| # | Test Case |
|---|-----------|
| 1 | API Info button appears when request has catalogMeta |
| 2 | API Info button hidden when no catalogMeta |
| 3 | Clicking button opens API Reference panel |
| 4 | Panel shows correct endpoint info (params, responses) |
| 5 | Drawer tolerates legacy catalogMeta objects with missing arrays |

---

## Phase 2: Coverage Badges in Catalog

**Priority: Medium | Effort: Small | Status: ✅ Done**

Show which endpoints have been exported to Requests via a blue "IN REQUESTS" pill badge on the endpoint header.

#### 2.1 Coverage Checker Utility

**File:** `src/features/catalog/utils/coverageChecker.ts`

- `buildCoverageMap(sourceSpec, collections)` — scans all collections, matches by `catalogMeta.sourceSpec` + `catalogMeta.originalPath` + HTTP method
- `getEndpointCoverage(method, path, coverageMap)` — lookup from pre-built map
- `coverageKey(method, path)` — generates `"METHOD /path"` key
- `getAllRequests(collection)` — walks top-level + nested folders

```typescript
export interface EndpointCoverage {
  exported: boolean;
  count: number;
}
```

#### 2.2 Badge on Endpoint Card

**File:** `src/features/catalog/components/CatalogEndpointCard.tsx`

Badge renders in the header row between summary and deprecated/lock badges:

```tsx
{coverage?.exported && (
  <span className="sw-coverage-badge" title={`Exported to Requests (${coverage.count})`}>
    IN REQUESTS{coverage.count > 1 ? ` (${coverage.count})` : ''}
  </span>
)}
```

#### 2.3 Data Flow

`App.tsx` passes `wb.collections` → `ApiCatalog` computes `coverageMap` via `useMemo` → `CatalogEndpointBrowser` → per-endpoint `getEndpointCoverage()` → `CatalogEndpointCard` receives `coverage` prop.

#### 2.4 CSS

**File:** `src/styles/catalog.css` — `.sw-coverage-badge` (blue pill, `var(--primary)` color, 10px border-radius)

#### 2.5 Unit Tests (10 cases)

**File:** `src/features/catalog/utils/coverageChecker.test.ts`

| # | Test Case |
|---|-----------|
| 1 | coverageKey produces METHOD + path string |
| 2 | Empty map when no collections match |
| 3 | Counts matching requests by sourceSpec + originalPath + method |
| 4 | Ignores requests from a different spec |
| 5 | Ignores requests without catalogMeta |
| 6 | Finds requests inside nested folders |
| 7 | Counts across multiple collections |
| 8 | Distinguishes different methods for the same path |
| 9 | getEndpointCoverage returns coverage when in map |
| 10 | getEndpointCoverage returns default when not in map |

---

## Phase 3: Ensure catalogMeta with Version

**Priority: High | Effort: Tiny | Status: ✅ Done**

Ensure that `catalogMeta` on exported requests includes `catalogEntryId`, `catalogEndpointId`, and `catalogVersion` for downstream features (version badges, versioning system).

#### 3.1 Add Fields to CatalogRequestMeta Type

**File:** `src/shared/types/index.ts`

Added three new optional fields at the top of `CatalogRequestMeta`:

```typescript
export interface CatalogRequestMeta {
  catalogEntryId?: string;
  catalogEndpointId?: string;
  catalogVersion?: string;
  // ... existing fields (operationId, originalPath, etc.)
}
```

#### 3.2 Update Export Pipeline

**Files:**
- `src/features/catalog/utils/catalogExport.ts` — `buildExportRequests()` now accepts `catalogEntryId` and `catalogVersion` params; sets `catalogEndpointId` from `ep.id` per endpoint. `CatalogExportContext` gains `catalogEntryId` field. `buildCatalogExport()` passes all three through.
- `src/app/App.tsx` — Passes `catalogEntryId: sendToReqEntry?.id` to the export context.

#### 3.3 Unit Tests (6 new cases)

**File:** `src/features/catalog/utils/catalogExport.test.ts`

| # | Test Case |
|---|-----------|
| 1 | Sets catalogEntryId when provided |
| 2 | Sets catalogEndpointId from endpoint id |
| 3 | Sets catalogVersion when provided |
| 4 | Leaves catalogEntryId/catalogVersion undefined when not provided |
| 5 | buildCatalogExport populates all three fields from context |
| 6 | Multiple endpoints each get their own catalogEndpointId |

---

## Phase 4: Version Info in Export Modal

**Priority: Medium | Effort: Small | Status: ✅ Done**

Show version info for all endpoints in the Export to Requests tab — whether they're new or already exported.

#### 4.1 Version Status Utility

**File:** `src/features/catalog/utils/versionStatus.ts`

- `getEndpointVersionInfo(endpointId, collections)` — scans all collections for matching `catalogMeta.catalogEndpointId`, returns `{ status: 'new' }` or `{ status: 'exported', exportedVersion }`.
- `getNewEndpointsCount(endpoints, collections)` — convenience counter.
- `buildVersionInfoMap(endpoints, collections)` — batch lookup: builds `Map<endpointId, EndpointVersionInfo>` for efficient rendering.

#### 4.2 Version Badges in Export Tab Endpoint Table

**File:** `src/features/catalog/components/CatalogSendToRequestsModal.tsx`

Added "Version" column (7th column) to the endpoint table. Each row shows:
- **NEW** (green pill) — endpoint never exported before
- **from 1.0.7** (gray pill) — previously exported from that spec version

#### 4.3 New Endpoints Summary

In the Collection Name section header, shows:
- `3 new endpoints` (green count badge) when some endpoints are new
- `all previously exported` (muted text) when all have been exported before

#### 4.4 CSS Styles

**File:** `src/styles/catalog.css`

- `.cat-send-version-badge.new` — green pill (matches success color)
- `.cat-send-version-badge.exported` — gray pill with border
- `.cat-send-new-count` — green count badge next to Collection Name label
- `.cat-send-all-exported` — muted text

#### 4.5 Unit Tests (10 cases)

**File:** `src/features/catalog/utils/versionStatus.test.ts`

| # | Test Case |
|---|-----------|
| 1 | Returns 'new' when no matching requests exist |
| 2 | Returns 'exported' with version when matching request found |
| 3 | Returns 'exported' without version when catalogVersion is missing |
| 4 | Finds requests in nested folders |
| 5 | Searches across multiple collections |
| 6 | Counts all as new when no exports exist |
| 7 | Excludes exported endpoints from new count |
| 8 | Returns 0 when all are exported |
| 9 | Builds a map for all endpoints |
| 10 | Returns empty map for no endpoints |

---

## Phase 5: Request Versioning System

**Priority: High | Effort: Medium | Dependencies: Phase 3 ✅, Phase 4 ✅**

**Core Principle:** Any request exported from a spec keeps versioning info. When the same spec is re-exported, the system finds existing requests by `catalogEndpointId` and adds a new **spec version** instead of duplicating. Users can switch versions. Workflow and Harness both respect request versioning.

**Important design note:** `RequestItem` already has `definitionVersions` (auto-saved edit history snapshots managed by `requestDefinitionVersioning.ts`). Spec versioning is **orthogonal** — it tracks which spec version a request came from, not per-keystroke edit history. We use a separate `specVersions` field to avoid conflating the two concepts.

---

### Sub-Phase 5A: Type System — Add Spec Version Fields

**Effort: Tiny | Dependencies: None**

Add spec version tracking types and fields to `RequestItem`.

#### 5A.1 Add `SpecVersion` Type

**File:** `src/shared/types/index.ts`

```typescript
export interface SpecVersion {
  id: string;                    // UUID
  catalogVersion: string;        // e.g. "1.0.7"
  catalogEntryId: string;
  catalogEndpointId: string;
  importedAt: number;            // Date.now() timestamp
  url: string;                   // Full URL snapshot
  method: HttpMethod;
  headers: KeyValue[];
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  savedQueryParams?: SavedQueryParam[];
  savedPathParams?: PathParamEntry[];
}
```

#### 5A.2 Add Fields to `RequestItem`

**File:** `src/shared/types/index.ts`

```typescript
export interface RequestItem {
  // ... existing fields ...
  specVersions?: SpecVersion[];    // Ordered list of spec versions
  activeSpecVersionId?: string;    // Currently active spec version
}
```

#### 5A.3 Unit Tests (3 cases)

| # | Test Case |
|---|-----------|
| 1 | SpecVersion type is properly assignable |
| 2 | RequestItem accepts specVersions array |
| 3 | RequestItem works without specVersions (backward compat) |

---

### Sub-Phase 5B: Version-Aware Export Pipeline

**Effort: Medium | Dependencies: 5A**

Modify the export pipeline so re-exporting a spec **updates existing requests** instead of creating duplicates. This is the most critical sub-phase.

#### 5B.1 Create `mergeExportIntoCollections` Utility

**File:** `src/features/catalog/utils/versionMerge.ts`

This is the core merge logic. Given a freshly built export collection and existing collections:

1. For each request in the new export, look for an existing request where `catalogMeta.catalogEndpointId` matches AND belongs to the same catalog entry.
2. **If found:** Add a new `SpecVersion` snapshot to the existing request, set it as active, update the request's current fields to match.
3. **If not found:** Create the request normally (first spec version).
4. Return: `{ mergedCount, newCount, updatedRequests, newCollection }`.

```typescript
export interface MergeResult {
  mergedCount: number;           // Requests updated with new version
  newCount: number;              // Brand new requests created
  newCollection: RequestCollection;  // Collection with only truly new requests
  updates: Array<{              // Existing requests that got new versions
    collectionId: string;
    requestId: string;
    patch: Partial<RequestItem>;
  }>;
}

export function mergeExportIntoCollections(
  exportedCollection: RequestCollection,
  existingCollections: RequestCollection[],
  catalogVersion: string,
  catalogEntryId: string,
): MergeResult { ... }
```

#### 5B.2 Create `buildSpecVersion` Helper

**File:** `src/features/catalog/utils/versionMerge.ts`

Extracts a `SpecVersion` snapshot from a `RequestItem`:

```typescript
export function buildSpecVersion(
  request: RequestItem,
  catalogVersion: string,
  catalogEntryId: string,
): SpecVersion { ... }
```

#### 5B.3 Create `applySpecVersion` Helper

**File:** `src/features/catalog/utils/versionMerge.ts`

Applies a `SpecVersion` snapshot back to a `RequestItem` (used when switching versions):

```typescript
export function applySpecVersion(
  request: RequestItem,
  version: SpecVersion,
): Partial<RequestItem> { ... }
```

#### 5B.4 Update Export Confirm Handlers in App.tsx

**File:** `src/app/App.tsx`

Modify `handleSendToReqConfirm` and `handleInlineExportConfirm`:

- After `buildCatalogExport()`, call `mergeExportIntoCollections()`.
- Apply `updates` to existing collections via `wb.updateRequest()`.
- Only `wb.importCollection()` with the new-only collection (skip if empty).
- Show toast with merge summary: "Updated 5 requests, added 3 new".

#### 5B.5 Update `buildExportRequests` to Create First SpecVersion

**File:** `src/features/catalog/utils/catalogExport.ts`

When creating a request, also populate `specVersions: [firstVersion]` and `activeSpecVersionId`.

#### 5B.6 Unit Tests (8 cases)

| # | Test Case |
|---|-----------|
| 1 | buildSpecVersion creates correct snapshot from RequestItem |
| 2 | applySpecVersion restores all fields correctly |
| 3 | mergeExportIntoCollections: no existing → all new |
| 4 | mergeExportIntoCollections: all existing → all merged, no new collection |
| 5 | mergeExportIntoCollections: mixed → correct split |
| 6 | mergeExportIntoCollections: merged request gets new SpecVersion appended |
| 7 | mergeExportIntoCollections: merged request activeSpecVersionId updated |
| 8 | First export creates specVersions array with one entry |

---

### Sub-Phase 5C: Version Switcher UI in Request Editor

**Effort: Small | Dependencies: 5A, 5B**

Add a version switcher dropdown in the Request Editor so users can switch between spec versions.

#### 5C.1 Add Version Switcher Component

**File:** `src/features/requests/components/SpecVersionSwitcher.tsx`

A compact inline component that shows:
- Current version label (e.g., "v1.0.7")
- Dropdown to switch versions
- Version count badge

Renders in the `req-req-name-bar` next to the API Info button when `request.specVersions?.length > 1`.

#### 5C.2 Wire `handleSpecVersionChange` in RequestEditor

**File:** `src/features/requests/components/RequestEditor.tsx`

```typescript
const handleSpecVersionChange = useCallback((versionId: string) => {
  const version = request.specVersions?.find(v => v.id === versionId);
  if (!version) return;
  onUpdateRequest(applySpecVersion(request, version));
}, [request, onUpdateRequest]);
```

#### 5C.3 Add CSS Styles

**File:** `src/styles/requests.css`

- `.spec-version-switcher` — compact inline container
- `.spec-version-select` — styled dropdown matching dark theme
- `.spec-version-badge` — pill showing version count

#### 5C.4 Unit Tests (4 cases)

| # | Test Case |
|---|-----------|
| 1 | Switcher hidden when no specVersions |
| 2 | Switcher hidden when only 1 version |
| 3 | Switcher shows dropdown when 2+ versions |
| 4 | Switching version calls onUpdateRequest with correct patch |

---

### Sub-Phase 5D: Version Comparison

**Effort: Small | Dependencies: 5C**

Allow users to compare what changed between spec versions.

#### 5D.1 Create `computeSpecVersionDiff` Utility

**File:** `src/features/catalog/utils/versionDiff.ts`

```typescript
export interface VersionChange {
  type: 'added' | 'removed' | 'modified';
  field: string;          // e.g. 'URL', 'Header: X-Api-Key', 'Query: status'
  oldValue?: string;
  newValue?: string;
}

export function computeSpecVersionDiff(
  left: SpecVersion,
  right: SpecVersion,
): VersionChange[] { ... }
```

Compares: URL, method, headers (added/removed/changed), query params, path params, body.

#### 5D.2 Create `SpecVersionCompareModal` Component

**File:** `src/features/requests/components/SpecVersionCompareModal.tsx`

- Two version selectors (left/right dropdowns)
- Diff table showing changes with color coding (green=added, red=removed, amber=modified)
- Opened from the version switcher via a "Compare" button

#### 5D.3 Add CSS Styles

**File:** `src/styles/requests.css`

- `.spec-compare-modal` — modal layout
- `.spec-compare-change` with `.added`, `.removed`, `.modified` variants
- `.spec-compare-header` — version selector row

#### 5D.4 Unit Tests (6 cases)

| # | Test Case |
|---|-----------|
| 1 | No changes when versions are identical |
| 2 | Detects URL change |
| 3 | Detects added header |
| 4 | Detects removed header |
| 5 | Detects modified query param value |
| 6 | Detects method change |

---

### Sub-Phase 5E: Workflow Integration — Version Pinning

**Effort: Medium | Dependencies: 5A, 5B**

Allow workflow nodes to pin to a specific spec version or always use latest.

#### 5E.1 Add Version Fields to HttpNodeData

**File:** `src/features/workflow/types/workflow.ts`

```typescript
export interface HttpNodeData {
  // ... existing fields ...
  sourceSpecVersionId?: string;
  sourceSpecVersionLabel?: string;
  specVersionMode?: 'pinned' | 'latest';  // Default: 'latest'
}
```

#### 5E.2 Update Scenario Resolution

**File:** `src/features/workflow/engine/useWorkflowNodeActions.ts`

In `handleAddFromRequest`: when creating a scenario from a request, also capture `sourceSpecVersionId` from the request's `activeSpecVersionId`.

#### 5E.3 Add Version Mode UI in Workflow Node Settings

**File:** `src/features/workflow/components/HttpNodeSettings.tsx` (or equivalent)

When the source request has `specVersions.length > 1`:
- Radio buttons: "Always use latest" / "Pin to version"
- If pinned: version selector dropdown
- Warning banner if newer version is available

#### 5E.4 Update Workflow Runner — Version Resolution

**File:** `src/engine/workflow/graphRunner.ts` (or create helper)

When resolving a scenario for execution:
- If `specVersionMode === 'pinned'`: use the pinned `SpecVersion` snapshot
- If `specVersionMode === 'latest'` (default): use the request's current active version

#### 5E.5 Unit Tests (5 cases)

| # | Test Case |
|---|-----------|
| 1 | New workflow node defaults to 'latest' mode |
| 2 | Pinned mode preserves specific version on request update |
| 3 | Latest mode resolves to activeSpecVersionId |
| 4 | Detects newer version available when pinned |
| 5 | applySpecVersion + scenario rebuild produces correct result |

---

### Sub-Phase 5F: Harness (Test Runner) Integration

**Effort: Small | Dependencies: 5A**

Track spec version in scenarios created from requests.

#### 5F.1 Add Version Fields to Scenario

**File:** `src/shared/types/index.ts`

```typescript
export interface Scenario {
  // ... existing fields ...
  sourceRequestId?: string;
  sourceSpecVersionId?: string;
  sourceSpecVersionLabel?: string;
  specVersionMode?: 'pinned' | 'latest';
}
```

#### 5F.2 Update Scenario Creation

**File:** `src/features/workflow/engine/useWorkflowNodeActions.ts`

When creating scenarios from requests, populate the new fields from the request's active spec version.

#### 5F.3 Show Version Label in Test Runner

When a scenario has `sourceSpecVersionLabel`, show it as a subtle badge next to the scenario name.

#### 5F.4 Unit Tests (3 cases)

| # | Test Case |
|---|-----------|
| 1 | Scenario created from versioned request has sourceSpecVersionId |
| 2 | Scenario sourceSpecVersionLabel matches the version label |
| 3 | Scenario without source request has no version fields |

---

### Implementation Order

| Order | Sub-Phase | Effort | Can Parallelize? |
|-------|-----------|--------|------------------|
| 1 | **5A** — Type System | Tiny | Start here |
| 2 | **5B** — Version-Aware Export | Medium | After 5A |
| 3 | **5C** — Version Switcher UI | Small | After 5B |
| 4 | **5D** — Version Comparison | Small | After 5C |
| 5 | **5E** — Workflow Integration | Medium | After 5B (parallel with 5C/5D) |
| 6 | **5F** — Harness Integration | Small | After 5A (parallel with 5B) |

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Separate from `definitionVersions`? | **Yes** — use `specVersions` | `definitionVersions` is auto-saved edit history. Spec versions are explicit imports from catalog. Different lifecycle and semantics. |
| Merge into existing collection or create new? | **Merge updates + new-only collection** | Re-exporting should update in-place for versioned endpoints. Only truly new endpoints get a new collection/folder. |
| Version switching mutates request fields? | **Yes** — `applySpecVersion` patches all fields | The request always reflects the "active" version. Other versions are stored as snapshots. |
| Workflow default version mode? | **`'latest'`** | Most users want workflows to track the latest version. Pinning is opt-in for stability. |
| How to find existing request for merge? | **Match by `catalogMeta.catalogEndpointId`** | Unique per endpoint per spec. Same endpoint re-exported from same spec = same lineage. |

### Total Unit Tests for Phase 5

| Sub-Phase | Tests |
|-----------|-------|
| 5A — Types | 3 |
| 5B — Export Pipeline | 8 |
| 5C — Version Switcher | 4 |
| 5D — Version Compare | 6 |
| 5E — Workflow | 11 (3 node actions + 8 resolveNodeSpecVersion) |
| 5F — Harness | 3 |
| **Total** | **35** |

---

## Phase 6: Requests ↔ Harness Integration

**Priority: Medium | Effort: Medium | Dependencies: Phase 5 ✅**

**Core Principle: One-Time Promotion (Snapshot, Not Live Sync)**

Promotion from Requests to Harness is a **one-time copy**. Once a test is created from a request, it lives independently in the Harness. The user owns the test from that point — request changes do NOT auto-propagate. This keeps both systems simple and avoids complex bidirectional sync.

> **Why disconnected?** Users customize tests with validation rules, extractions, data sources, and parameterization after promotion. Auto-sync would risk overwriting that work. A snapshot approach respects the user's harness-side edits.

---

### Architecture Gap Analysis

| Area | Requests | Harness (Test Runner) | Resolution |
|------|----------|----------------------|------------|
| **Data model** | `RequestItem` in `RequestCollection` | `Scenario` in `TestScenario` in `FeatureGroup` | One-time conversion via `createScenarioFromRequest` |
| **Storage** | `localStorage` (`useRequests`) | IndexedDB (`useProjects`) | Cross-hook bridge in `useProjects` |
| **URL** | Relative path + `collection.baseUrls[envId]` | Absolute or `{{baseUrl}}` URL | Resolve to absolute at promotion time |
| **Auth** | `inherit` → walks Requests chain | `inherit` → walks Harness chain | Resolve to concrete auth at promotion time |
| **Validation** | Not on RequestItem | `ValidationConfig` on Scenario | Default `{ mode: 'none' }` with optional quick presets |
| **Params** | `savedQueryParams`, `savedPathParams` | Not on Scenario | Bake into URL at promotion time |
| **Organization** | Collections → Folders → Requests | FeatureGroups → TestScenarios → Tests | Target picker in promotion dialog |

---

### Sub-Phase 6A: Promotion Utility — `createScenarioFromRequest`

**Effort: Small | Dependencies: Phase 5**

Pure utility that converts a `RequestItem` into a `Scenario` with full field resolution.

#### 6A.1 Create `requestToScenario.ts` Utility

**File:** `src/features/requests/utils/requestToScenario.ts`

```typescript
export interface PromotionContext {
  collection: RequestCollection;
  folderId?: string;
  selectedEnvId?: string;
  environments: RequestEnv[];
  globalAuthProfiles: GlobalAuthProfile[];
  microservices: Microservice[];
}

export interface PromotionOptions {
  validationPreset?: 'none' | 'status-200';
  authMode?: 'concrete' | 'inherit';   // 'concrete' resolves, 'inherit' defers to Harness chain
  openEditorAfter?: boolean;
}

export function createScenarioFromRequest(
  request: RequestItem,
  context: PromotionContext,
  options?: PromotionOptions,
): Scenario { ... }
```

**Resolution logic (all one-time, no live link):**
1. **URL:** Resolve relative URL → absolute using `collection.baseUrls[envId]`. Bake enabled `savedQueryParams` into query string. Resolve `savedPathParams` placeholders. Note: Harness `replaceHost` mode will rewrite the host at runtime if the user switches environments — so one test already works across envs.
2. **Auth:** Based on `options.authMode`:
   - `'concrete'` (default): Walk the Requests chain (subfolder → `authPerEnv` → collection → microservice → global) and resolve to a concrete `AuthConfig`. Safe snapshot — won't change.
   - `'inherit'`: Set `{ type: 'inherit' }` — test defers to FeatureGroup/global auth at runtime. Better for long-lived tests where credentials rotate.
3. **Method:** Cast to Scenario's union type.
4. **Validation:** Based on `options.validationPreset`:
   - `'none'` (default): `{ mode: 'none' }`
   - `'status-200'`: `{ mode: 'selective', assertions: [{ type: 'status', expected: '200' }] }`
5. **Origin metadata:** Set `sourceRequestId` and `sourceSpecVersionLabel` for the read-only origin badge. These are **informational only** — not used for sync. If the source request is deleted, the badge shows the label but disables click navigation.
6. **Headers, body, bodyType, bodyForm:** Direct copy.

#### 6A.2 Extract `resolveRequestAuth` Helper

**File:** `src/features/requests/utils/requestToScenario.ts`

Extract auth resolution from `RequestEditor.resolveEffectiveAuth` into a reusable pure function.

#### 6A.3 Unit Tests (8 cases)

| # | Test Case |
|---|-----------|
| 1 | Converts basic request to scenario with correct fields |
| 2 | Resolves relative URL to absolute using collection baseUrl |
| 3 | Bakes enabled query params into URL |
| 4 | Resolves `inherit` auth to concrete auth from collection |
| 5 | Sets `sourceRequestId` for origin badge |
| 6 | Defaults validation to `{ mode: 'none' }` |
| 7 | `status-200` preset creates correct validation config |
| 8 | Handles request without savedQueryParams |

---

### Sub-Phase 6B: "Send to Harness" Dialog

**Effort: Medium | Dependencies: 6A**

Modal dialog for promoting a single request to the Harness.

#### 6B.1 Create `SendToHarnessModal.tsx` Component

**File:** `src/features/requests/components/SendToHarnessModal.tsx`

**UI Design (3 steps in a single modal):**

**Step 1 — Target:**
- **Feature Group:** Dropdown of existing groups + "Create New" with inline name input
- **Test Scenario:** Dropdown of scenarios within selected group + "Create New" option
- Note: When creating a new FeatureGroup, auto-set `environmentId` and `microserviceId` from the current sidebar selection (so the group is visible in the Harness filter)

**Step 2 — Preview & Options:**
- Summary card: name, method, resolved URL, auth type
- **Auth mode:** Radio: "Use request's auth" (concrete snapshot, default) / "Use Harness auth" (inherit — adapts to group/global auth at runtime)
- **Quick Validation:** Radio: "No validation" (default) / "Check status 200" / "Custom (open editor after)"
- **Customize after:** Checkbox — "Open test editor after creation" (calls existing `startEditTest`)

**Step 3 — Origin Info:**
- Shows read-only badge: "From: GET /users (Petstore API v1.0.7)"
- Note: "Test will be independent after creation"

**Footer:** "Send to Harness" button + Cancel. On success: toast with link to locate the created test.

#### 6B.2 Add "Send to Harness" Button in RequestEditor

**File:** `src/features/requests/components/RequestEditor.tsx`

Button in the name bar area (next to existing buttons). Available for all requests, not just spec-exported ones.

#### 6B.3 CSS Styles

**File:** `src/styles/requests.css`

Styles for `.req-send-harness-btn`, `.send-harness-modal`, step layout, preview card.

#### 6B.4 Unit Tests (5 cases)

| # | Test Case |
|---|-----------|
| 1 | Modal shows available feature groups |
| 2 | "Create New" group option works |
| 3 | Modal shows test scenarios within selected group |
| 4 | Confirm calls onConfirm with correct params |
| 5 | Cancel closes modal |

---

### Sub-Phase 6C: State Bridge — `promoteRequestToHarness`

**Effort: Small | Dependencies: 6B**

Bridge between `useRequests` and `useProjects` hooks via App.tsx.

#### 6C.1 Add `promoteRequestToHarness` to `useProjects`

**File:** `src/features/scenarios/hooks/useProjects.ts`

```typescript
const promoteRequestToHarness = useCallback((
  scenario: Scenario,
  targetGroupId?: string,
  targetScenarioId?: string,
  newGroupName?: string,
  newScenarioName?: string,
) => {
  setFeatureGroups(prev => {
    // 1. Find or create FeatureGroup
    // 2. Find or create TestScenario within group
    // 3. Add scenario to TestScenario.tests
    // 4. Return updated groups (auto-persisted via useEffect)
  });
}, []);
```

#### 6C.2 Wire Through App.tsx

**File:** `src/app/App.tsx`

- Pass `featureGroups` and `promoteRequestToHarness` to `Requests` component
- Modal's `onConfirm` handler creates the scenario and calls promote
- After success: navigate to `scenarios` tab

#### 6C.3 Add `promotedToHarness` Badge on RequestItem

**File:** `src/shared/types/index.ts`

```typescript
export interface RequestItem {
  // ... existing fields ...
  promotedToHarness?: boolean;  // Set true after first promotion
}
```

Show a subtle "IN HARNESS" badge in the Requests sidebar (similar to "IN REQUESTS" in Catalog).

#### 6C.4 Unit Tests (5 cases)

| # | Test Case |
|---|-----------|
| 1 | Adds scenario to existing group and test scenario |
| 2 | Creates new feature group when newGroupName provided |
| 3 | Creates new test scenario when newScenarioName provided |
| 4 | Sets `promotedToHarness` on the source request |
| 5 | Handles duplicate scenario names gracefully |

---

### Sub-Phase 6D: Origin Badge & Read-Only Info

**Effort: Tiny | Dependencies: 6A**

Show where a test came from — purely informational, no sync.

#### 6D.1 Add Origin Badge in ScenarioBuilder

**File:** `src/features/scenarios/ScenarioBuilder.tsx`

When a scenario has `sourceRequestId`, show a small badge:
```
From: GET /users (Petstore API v1.0.7)
```

Clicking navigates to the source request if it still exists (graceful fallback if deleted).

#### 6D.2 Add Origin Badge in ScenarioSelector (Runner)

**File:** `src/features/test-runner/components/ScenarioSelector.tsx`

Subtle spec version label next to the scenario name when `sourceSpecVersionLabel` is set.

#### 6D.3 Unit Tests (2 cases)

| # | Test Case |
|---|-----------|
| 1 | Origin badge shows when sourceRequestId is set |
| 2 | Origin badge hidden when no sourceRequestId |

---

### Sub-Phase 6E: Batch Promotion

**Effort: Medium | Dependencies: 6A, 6B, 6C**

Promote an entire collection or folder to Harness at once.

#### 6E.1 Add "Send Collection to Harness" Context Menu

**File:** `src/features/requests/components/SidebarContextMenu.tsx`

Right-click on a collection → "Send to Harness" option. Creates:
- One **FeatureGroup** per collection
- One **TestScenario** per folder (or one for root requests)
- One **test (Scenario)** per request

#### 6E.2 Create `batchPromoteCollection` Utility

**File:** `src/features/requests/utils/requestToScenario.ts`

```typescript
export function batchPromoteCollection(
  collection: RequestCollection,
  context: PromotionContext,
  options?: PromotionOptions,
): { featureGroup: FeatureGroup } { ... }
```

Maps collection structure to harness structure:
- Collection name → FeatureGroup name
- Folder name → TestScenario name
- Each RequestItem → Scenario (via `createScenarioFromRequest`)

#### 6E.3 Batch Promotion Dialog

**File:** `src/features/requests/components/BatchSendToHarnessModal.tsx`

- Shows the collection tree with checkboxes (select/deselect requests)
- Preview: "Will create 1 Feature Group, 3 Test Scenarios, 15 tests"
- Quick validation preset selector (applies to all)
- Confirm / Cancel

#### 6E.4 Unit Tests (4 cases)

| # | Test Case |
|---|-----------|
| 1 | Maps collection to FeatureGroup correctly |
| 2 | Maps folders to TestScenarios |
| 3 | Maps each request to a test via createScenarioFromRequest |
| 4 | Respects selected/deselected checkboxes |

---

### Sub-Phase 6F: Catalog → Harness Direct Path

**Effort: Small | Dependencies: 6A, 6B, 6C**

Allow promoting directly from Catalog endpoint cards to Harness.

#### 6F.1 Add "Send to Harness" Button on CatalogEndpointCard

**File:** `src/features/catalog/components/CatalogEndpointCard.tsx`

Button next to the existing "Export to Request" button. Creates a temporary `RequestItem` from the endpoint, opens the same `SendToHarnessModal`.

#### 6F.2 Create `catalogEndpointToRequest` Adapter

**File:** `src/features/catalog/utils/catalogEndpointToRequest.ts`

Converts a `CatalogEndpoint` + server info into a temporary `RequestItem` (reuses logic from `buildExportRequests` for a single endpoint, without persisting).

#### 6F.3 Wire in App.tsx

Thread catalog → harness promotion through App.tsx.

#### 6F.4 Unit Tests (3 cases)

| # | Test Case |
|---|-----------|
| 1 | catalogEndpointToRequest creates correct temporary RequestItem |
| 2 | Temporary request has catalogMeta and specVersions |
| 3 | Promotion from catalog creates valid scenario |

---

### Sub-Phase 6G: "Try It Out" → Promote (Optional Enhancement)

**Effort: Small | Dependencies: 6A, 6C**

In the Catalog "Try It Out" view, after successfully sending a request (200 response), offer a quick "Send to Harness" button.

#### 6G.1 Add "Send to Harness" Button After Successful Response

**File:** `src/features/catalog/components/CatalogEndpointCard.tsx` (or the Try It Out response area)

When the user sends a request and gets a 200 response:
- Show a "Send to Harness" button below the response
- Pre-fills the scenario with the exact URL/headers/body that were used
- Auto-sets validation preset to `status-200`
- Opens the target picker (same as 6B but simplified — just group/scenario selection)

#### 6G.2 Unit Tests (2 cases)

| # | Test Case |
|---|-----------|
| 1 | "Send to Harness" only appears after successful response |
| 2 | Created scenario includes the actual request URL and status validation |

---

### Implementation Order

| Order | Sub-Phase | Effort | Dependencies |
|-------|-----------|--------|--------------|
| 1 | **6A** — Promotion Utility | Small | Phase 5 |
| 2 | **6B** — Send to Harness Dialog | Medium | 6A |
| 3 | **6C** — State Bridge | Small | 6B |
| 4 | **6D** — Origin Badge | Tiny | 6A |
| 5 | **6E** — Batch Promotion | Medium | 6A, 6B, 6C |
| 6 | **6F** — Catalog Direct Path | Small | 6A, 6B, 6C |
| 7 | **6G** — Try It Out → Promote | Small | 6A, 6C (optional) |

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Live sync vs snapshot? | **Snapshot (disconnected)** | Users customize tests with validation/extractions. Auto-sync would overwrite harness-side work. |
| Auth mode? | **User's choice: concrete (default) or inherit** | Concrete = safe snapshot. Inherit = adapts to Harness auth rotation. Dialog offers both. |
| URL format? | **Absolute URL** with resolved base | Harness `replaceHost` mode rewrites host at runtime for multi-env — one test works across envs automatically. |
| Validation default? | **`{ mode: 'none' }`** with optional `status-200` preset | Don't guess — let user decide. Quick preset saves time for common case. |
| `sourceRequestId` purpose? | **Origin badge only** — no sync | Informational "where did this come from" label, not a live reference. |
| `promotedToHarness` on RequestItem? | **Yes** — simple boolean flag | Enables "IN HARNESS" badge in sidebar (same pattern as coverage badges in Catalog). |
| Batch promotion? | **Yes** — collection/folder level | Common use case: "I just imported 30 endpoints, test them all." |
| FeatureGroup scoping? | **Auto-set `environmentId`/`microserviceId` from sidebar** | Required for visibility — Harness filters groups by env+microservice. |
| Post-promote flow? | **Optional "Open test editor"** | Uses existing `startEditTest` for immediate validation/extraction setup. |

### Known Limitations & Mitigations

| Limitation | Mitigation |
|-----------|------------|
| **No undo** — accidental promotion can't be reversed | Show confirmation toast with "Locate in Harness" link. User can delete the test manually. |
| **Standard kind only** — promoted tests are single-shot | User can convert to parameterized via existing "Create Parameterized Copy" in Harness, then attach DataSource. |
| **`fetchHostOverride` not set** — only affects editor sample/preview, not runner execution | Runner uses `hostMode` + `resolvedBaseUrl`. `fetchHostOverride` is for editor tooling only — safe to omit. |
| **Origin badge on imported tests** — `sourceRequestId` won't resolve on another machine | Badge shows label text but disables click navigation when source request is not found. Graceful fallback. |
| **`featureGroupName`/`groupName` not pre-set** — these are runtime fields | `buildSelectedTests` injects them at run time from FeatureGroup/TestScenario names. No need to persist on creation. |
| **Multi-env testing** — single absolute URL seems limiting | Harness `replaceHost` mode rewrites the host per selected env at runtime. One test covers all envs without duplication. |

### What Was Removed (vs Previous Plan)

| Removed | Reason |
|---------|--------|
| 6D: Version Sync | Disconnected design — no auto-propagation |
| `findScenariosFromRequest` utility | No sync needed |
| `updateScenarioFromRequest` utility | No sync needed |
| "Update from Request" action | No sync needed |
| "Update available" badge | No sync needed |
| `specVersionMode` on promoted scenarios | Only relevant for workflow (live link) |

### Total Unit Tests for Phase 6

| Sub-Phase | Tests |
|-----------|-------|
| 6A — Promotion Utility | 8 |
| 6B — Send to Harness Dialog | 5 |
| 6C — State Bridge | 5 |
| 6D — Origin Badge | 2 |
| 6E — Batch Promotion | 4 |
| 6F — Catalog Direct Path | 3 |
| 6G — Try It Out → Promote | 2 |
| **Total** | **29** |

---

## Implementation Checklist

### Phase 1: API Info on Exported Requests
- [x] 1.1 Add API Info button to RequestEditor for linked requests
- [x] 1.2 Implement findEndpointFromMeta helper (via `RequestCatalogApiInfoDrawer`)
- [x] 1.3 Reuse ApiReferencePanel component (implemented as `RequestCatalogApiInfoDrawer`)
- [x] 1.4 Unit tests (4 cases)
- [x] Run `npx tsc -b --noEmit`

### Phase 2: Coverage Badges in Catalog
- [x] 2.1 Create `coverageChecker.ts` with buildCoverageMap + getEndpointCoverage
- [x] 2.2 Add badge to CatalogEndpointCard header
- [x] 2.3 Wire coverage data: App.tsx → ApiCatalog → Browser → Card
- [x] 2.4 Add CSS styles (`.sw-coverage-badge`)
- [x] 2.5 Unit tests (10 cases)
- [x] Run `npx tsc -b --noEmit`

### Phase 3: Ensure catalogMeta with Version
- [x] 3.1 Add catalogEntryId, catalogEndpointId, catalogVersion to CatalogRequestMeta type
- [x] 3.2 Update buildExportRequests + buildCatalogExport + CatalogExportContext
- [x] 3.3 Pass catalogEntryId from App.tsx
- [x] 3.4 Unit tests (6 new cases, 49 total passing)
- [x] Run `npx tsc -b --noEmit`

### Phase 4: Version Info in Export Modal
- [x] 4.1 Create `versionStatus.ts` with getEndpointVersionInfo, getNewEndpointsCount, buildVersionInfoMap
- [x] 4.2 Add "Version" column with NEW/exported badges to endpoint table
- [x] 4.3 Add new endpoints count summary in Collection Name label
- [x] 4.4 Add CSS styles (`.cat-send-version-badge`, `.cat-send-new-count`)
- [x] 4.5 Unit tests (10 cases, 74 total passing)
- [x] Run `npx tsc -b --noEmit`

### Phase 5: Request Versioning System ✅
#### 5A: Type System ✅
- [x] 5A.1 Add `SpecVersion` interface to `src/shared/types/index.ts`
- [x] 5A.2 Add `specVersions` and `activeSpecVersionId` to `RequestItem`
- [x] 5A.3 Add `sourceRequestId`, `sourceSpecVersionId`, `sourceSpecVersionLabel` to `Scenario`
- [x] 5A.4 Add `sourceSpecVersionId`, `sourceSpecVersionLabel`, `specVersionMode` to `HttpNodeData`
- [x] Run `npx tsc -b --noEmit`

#### 5B: Version-Aware Export Pipeline ✅
- [x] 5B.1 Create `versionMerge.ts` with `mergeExportIntoCollections`
- [x] 5B.2 Create `buildSpecVersion` helper
- [x] 5B.3 Create `applySpecVersion` helper
- [x] 5B.4 Update `handleSendToReqConfirm` and `handleInlineExportConfirm` in App.tsx
- [x] 5B.5 Update `buildExportRequests` to create first SpecVersion on export
- [x] 5B.6 Unit tests — `versionMerge.test.ts` (12 cases) + `catalogExport.test.ts` (3 new cases)
- [x] Run `npx tsc -b --noEmit`

#### 5C: Version Switcher UI ✅
- [x] 5C.1 Create `SpecVersionSwitcher.tsx` component with compare button
- [x] 5C.2 Wire into `RequestEditor.tsx` name bar (next to API Info button)
- [x] 5C.3 Add CSS styles for version switcher in `requests.css`
- [x] Run `npx tsc -b --noEmit`

#### 5D: Version Comparison ✅
- [x] 5D.1 Create `versionDiff.ts` with `computeSpecVersionDiff`
- [x] 5D.2 Create `SpecVersionCompareModal.tsx` component
- [x] 5D.3 Add CSS styles for compare modal in `requests.css`
- [x] 5D.4 Unit tests — `versionDiff.test.ts` (9 cases)
- [x] Run `npx tsc -b --noEmit`

#### 5E: Workflow Integration ✅
- [x] 5E.1 Add `sourceSpecVersionId`, `specVersionMode` to HttpNodeData
- [x] 5E.2 Update scenario creation in `useWorkflowNodeActions.ts` to populate version fields
- [x] 5E.3 Unit tests — 3 new cases in `useWorkflowNodeActions.test.ts`
- [x] 5E.4 Add version mode UI in workflow node settings (pinned/latest toggle in HttpConfig)
- [x] 5E.5 Create `resolveNodeSpecVersion.ts` utility + `detectNewerVersion` + 8 unit tests
- [x] Run `npx tsc -b --noEmit`

#### 5F: Harness Integration ✅
- [x] 5F.1 Add version tracking fields to Scenario type
- [x] 5F.2 Update scenario creation to populate version fields
- [x] 5F.3 Show version label in Test Runner ScenarioSelector (spec version badge)
- [x] Run `npx tsc -b --noEmit`

### Phase 6: Requests ↔ Harness Integration ✅
#### 6A: Promotion Utility ✅
- [x] 6A.1 Create `requestToScenario.ts` with `createScenarioFromRequest`
- [x] 6A.2 Extract `resolveRequestAuth` helper (pure function)
- [x] 6A.3 Unit tests (19 cases — 13 for createScenarioFromRequest, 6 for resolveRequestAuth)
- [x] Run `npx tsc -b --noEmit`

#### 6B: Send to Harness Dialog ✅
- [x] 6B.1 Create `SendToHarnessModal.tsx` with 2-step UI (target, preview with auth/validation options)
- [x] 6B.2 Add "Send to Harness" button in RequestEditor name bar
- [x] 6B.3 CSS styles for modal and button
- [x] 6B.4 `defaultValidationPreset` prop for auto-presetting validation (used by "Send to Harness")
- [x] 6B.5 Unit tests (5 cases)
- [x] Run `npx tsc -b --noEmit`

#### 6C: State Bridge ✅
- [x] 6C.1 Create `promoteToFeatureGroups` pure utility (not hook — cleaner for testing)
- [x] 6C.2 Wire through App.tsx (harnessPromotionContext, handleSendToHarnessConfirm)
- [x] 6C.3 Add `promotedToHarness` field on RequestItem + "IN HARNESS" badge in sidebar
- [x] 6C.4 Navigate to `scenarios` tab after promotion
- [x] 6C.5 Confirmation toast after promotion (success message with test name / batch count)
- [x] 6C.6 Wire `openEditorAfter` — `pendingEditTest` state → `ScenarioBuilder` auto-opens editor
- [x] 6C.7 Unit tests (5 cases)
- [x] Run `npx tsc -b --noEmit`

#### 6D: Origin Badge ✅
- [x] 6D.1 Add read-only origin badge in ScenarioBuilder (test card)
- [x] 6D.2 Clickable origin badge — navigates to source request via `onLocateRequest`, with graceful fallback toast if deleted
- [x] 6D.3 Add promoted test count badge in ScenarioSelector (Runner)
- [x] 6D.3 Unit tests (4 cases)
- [x] Run `npx tsc -b --noEmit`

#### 6E: Batch Promotion ✅
- [x] 6E.1 Add "Send to Harness" in SidebarContextMenu (collection right-click)
- [x] 6E.2 Create `batchPromoteCollection` utility in promoteToHarness.ts
- [x] 6E.3 Create `BatchSendToHarnessModal.tsx` with checkbox selection, preview, auth/validation options
- [x] 6E.4 Unit tests (4 cases)
- [x] Run `npx tsc -b --noEmit`

#### 6F: Catalog → Harness Direct Path ✅
- [x] 6F.1 Add "Send to Harness" button on CatalogEndpointCard (next to Export to Requests)
- [x] 6F.2 Create `catalogEndpointToRequest` adapter
- [x] 6F.3 Wire through ApiCatalog → CatalogEndpointBrowser → CatalogEndpointCard → App.tsx
- [x] 6F.4 Unit tests (3 cases)
- [x] Run `npx tsc -b --noEmit`

#### 6G: "Try It Out" → Promote ✅
- [x] 6G.1 Add "Send to Harness" button after successful 2xx response in CatalogEndpointCard
- [x] 6G.2 Auto-preset validation to `status-200` when promoted from "Send to Harness" (`fromTryItOut` flag → `defaultValidationPreset`)
- [x] 6G.3 Unit tests (3 cases)
- [x] Run `npx tsc -b --noEmit`

---

## Why We're NOT Building Contract Testing

During planning, we explored complex features that were rejected:

| Rejected Idea | Reason |
|---------------|--------|
| Auto-generate assertions from spec | Users know their APIs; complexity explosion |
| Per-environment × per-scenario config | Too many combinations (126 cells!) |
| Test configuration wizard | Adds complexity, low value |
| Spec calibration against live API | Not core to performance testing |
| Contract/Full test levels | Spec validation is not RedfireForge's job |

**RedfireForge is a performance workbench.** For contract testing, use Dredd, Schemathesis, or similar tools.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Phases | 6 (all implemented) |
| Phase 5 Sub-Phases | 6 (5A–5F) — all implemented |
| Phase 5 Unit Tests | 35 new (8 added for resolveNodeSpecVersion) |
| Phase 6 Sub-Phases | 7 (6A–6G) — all implemented |
| Phase 6 Unit Tests | 43 new across 6 test files |
| Phase 6 Design | One-time snapshot promotion (disconnected) |
| Post-Plan Enhancements | Schema body gen, host warning, query de-dup, additional envs, viewport persistence |
| Focus | Spec visibility + Request versioning + Harness bridge |

**The Catalog is a spec browser with version tracking — not a contract test generator.**

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-18 | **Post-implementation enhancements (not in original plan).** Schema-based body generation for Send to Harness (`sampleFromSchema` in `catalogEndpointToRequest.ts`). Host strategy & placeholder URL warning (amber banner in `CatalogEndpointCard`). Query parameter de-duplication in `requestToScenario.ts` (`bakeQueryParams` strips existing query string before appending). Additional environment amber indicators throughout UI. Workflow canvas viewport persistence (`IntersectionObserver` in `WorkflowDesignerFlowCanvas`). Plan status table corrected: Phase 6 marked ✅ Done, Phase 1 checklist marked [x]. |
| 2026-05-17 | **Phase 5 deferred items completed.** 5E.4: Pinned/latest toggle in workflow HttpConfig. 5E.5: `resolveNodeSpecVersion.ts` utility + `detectNewerVersion` with 8 unit tests. 5F.3: Spec version badge in Test Runner ScenarioSelector. All Phase 5 sub-phases now fully implemented. |
| 2026-05-17 | **Phase 6 gap fixes.** Wired `openEditorAfter` (pendingEditTest → ScenarioBuilder auto-opens editor), confirmation toast after promotion, clickable origin badge (navigate to source request with fallback), auto-preset validation to `status-200` for "Send to Harness" from Try It Out. |
| 2026-05-17 | **Phase 6 gaps addressed.** Added auth mode choice (concrete/inherit), FG scoping (auto-set env/microservice), post-promote "Open editor" option, Known Limitations table (no undo, standard-only, import portability, multi-env via replaceHost). All minor additions within existing sub-phases. |
| 2026-05-17 | **Phase 6 plan redesigned.** Adopted "one-time snapshot" model (disconnected after promotion). Removed version sync complexity (6D old). Added batch promotion (6E), "Try It Out" → Promote (6G), origin badges (6D new), `promotedToHarness` flag. 7 sub-phases (6A–6G), 29 unit tests. Effort back to Medium. |
| 2026-05-17 | **Phase 6 plan detailed.** Broke into 5 sub-phases (6A–6E) with 28 unit tests. Added architecture gap analysis covering data model, URL resolution, auth inheritance, validation, and state management differences between Requests and Harness. Upgraded effort from Medium to Large. |
| 2026-05-17 | **Phase 5 implemented.** 6 sub-phases (5A–5F): SpecVersion type, version-aware merge export, version switcher UI, compare modal, workflow version pinning, scenario version tracking. 27 new unit tests (110 total across touched files). Remaining: 5E.4 workflow node settings UI, 5F.3 runner label badge. |
| 2026-05-17 | **Phase 5 plan detailed.** Broke into 6 sub-phases (5A–5F) with 29 unit tests. Key design: `specVersions` separate from `definitionVersions`, merge-on-reexport via `catalogEndpointId`, workflow version pinning. |
| 2026-05-17 | **Phase 4 complete.** Version Info in Export tab — NEW/exported badges per endpoint, new-count summary. `versionStatus.ts` utility with 10 unit tests (74 total). |
| 2026-05-17 | **Phase 3 complete.** Added `catalogEntryId`, `catalogEndpointId`, `catalogVersion` to `CatalogRequestMeta`. Export pipeline now populates all three fields. 6 new unit tests (49 total). |
| 2026-05-17 | **Phase 2 complete.** Coverage Badges in Catalog — blue "IN REQUESTS" pill badge on endpoint headers for exported endpoints, with count. `coverageChecker.ts` utility with 10 unit tests. |
| 2026-05-17 | **v3: Complete rewrite.** Simplified to 6 phases focused on spec visibility and request versioning. Removed all contract testing features. Added comprehensive versioning system integrated with Workflow and Harness. |
| 2026-05-17 | v2: Complex contract testing plan (11 phases). Rejected as too complex. |
| 2026-05-16 | v1: Initial plan. |
