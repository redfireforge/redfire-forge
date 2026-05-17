# Catalog ↔ Harness Integration Plan

> **Goal:** Make the API Catalog a *spec-intelligence layer* that adds unique value beyond what Requests provides — contract-aware testing, spec coverage tracking, and smart test generation. Catalog specs become a **virtual test source** directly selectable in the Test Runner alongside hand-built Harness tests.

---

## Design Principle: Unified Harness Experience

**From the user's perspective, there is only ONE Harness.** Whether a test originated from:
- A hand-crafted `Scenario` in the Requests tab
- An auto-generated test from a Catalog OpenAPI spec

...the experience should be **identical**:

| Aspect | Unified Behavior |
|--------|------------------|
| **Selection UI** | Same `ScenarioSelector` with checkboxes |
| **Assertions** | Same Data Mapper, same 24 operators, same DSL |
| **Results** | Same results grid, same pass/fail badges |
| **Host override** | Same `HostSelector` component applies to both |
| **Auth** | Same auth config applies to both |
| **Execution modes** | Same sequential/batch/pool/load-profile options |
| **Results Explorer** | Same detailed view (request/response/assertions) |
| **Export** | Same JUnit/HTML/CSV export formats |

The only difference is **where the test definition comes from** — user-authored vs spec-derived. But once a test is in the execution queue, it's just a `Scenario` like any other.

**Key Implication:** All new features built for Harness tests (e.g., Data Mapper validation, DSL code view, Results Explorer) must work seamlessly with catalog-generated tests. No second-class citizens.

---

## 0. The Core Question: Why Have Both Catalog and Requests?

### The Problem

If clicking a catalog endpoint opens a RequestEditor-style detail view, we end up with **two nearly identical features**. Users will ask: *"Why not just use Requests?"*

### The Answer: Different Jobs

| Aspect | **Requests** | **Catalog** |
|---|---|---|
| **Source of truth** | User-defined (freeform) | OpenAPI spec (immutable contract) |
| **Identity** | URL you typed | Operation from a versioned spec |
| **Schema awareness** | None — just sends what you typed | Knows parameter types, enums, required fields, response schemas |
| **Validation** | Manual assertion setup | Can auto-generate assertions from spec response schemas |
| **Coverage** | No concept | Knows which operations exist vs which are tested |
| **Drift detection** | No concept | Detects when spec changes break existing tests |
| **Lifespan** | Disposable / ad-hoc | Tied to a versioned API contract |

**Requests** is a *scratchpad* — build and send anything.
**Catalog** is a *contract dashboard* — the spec tells you what the API *should* do, and the Catalog tracks whether your tests cover it.

### What the Catalog Should Uniquely Provide

The following capabilities are **impossible in the Requests tab** because Requests has no schema awareness:

1. **Spec Coverage Matrix** — "5 of 8 endpoints have Harness tests"
2. **Auto-generated assertions** — "Spec says 200 returns `{ offers: array }`, generate validation rules"
3. **Contract test scaffolding** — One-click "Generate tests for all untested endpoints"
4. **Spec drift alerts** — "v1.0.1 removed the `country` parameter — 2 tests are affected"
5. **Schema-validated Try It** — Parameter inputs that enforce types, enums, and required fields
6. **Response schema validation** — Compare live response against spec schema (not just status code)
7. **Virtual test source** — Catalog specs selectable directly in Test Runner without saving to Harness

---

## 1. Architecture Decision: Virtual Test Source (Option 4)

### The Chosen Approach

Catalog specs become a **second test source** in the Test Runner, alongside the existing `FeatureGroup[]`. The user sees both in the same `ScenarioSelector` and can run them together in a single test execution. Catalog-backed tests are **generated on-the-fly** from the live spec at run time — never saved, never stale.

### Why This Approach

| Criteria | Decision |
|---|---|
| **Spec stays source of truth** | Yes — tests regenerated from current spec every run |
| **No data duplication** | Yes — no copy of endpoint data in `FeatureGroup[]` |
| **Can mix with hand-built tests** | Yes — unified `ScenarioSelector` |
| **Works with load testing** | Yes — all execution modes (sequential, batch, pool, load-profile) |
| **No clutter** | Yes — nothing persisted unless user explicitly saves |
| **Spec changes auto-reflected** | Yes — next run picks up spec changes automatically |

### How It Works

```
ScenarioSelector sees TWO sections:

  YOUR TESTS (from FeatureGroup[])
  ☑ Sales Auto Assign
    ☑ VehiclePurchaseOffers        ← 2 hand-built Scenario objects
    ☐ TrialOffers                   ← 1 hand-built Scenario object

  ─────────────────────────────────

  CATALOG SPECS (from CatalogEntry[])           ← NEW virtual test source
  ☐ Sales Auto Assign Products v1.0.0
    ☐ VehiclePurchaseOffers (1 endpoint)        ← live CatalogEndpoint, not saved
    ☐ TrialOffersManagement (2 endpoints)
    ☐ Offers Static Metadata (3 endpoints)

  Catalog Test Level: [▼ Contract]
```

When the user clicks Run:

```
Step 1: Build from YOUR TESTS (existing — unchanged)
  FeatureGroup[] → selected TestScenario[] → Scenario[]
  Apply host, auth, validation overrides
  Result: [Scenario A, Scenario B]

Step 2: Build from CATALOG SPECS (new)
  Selected CatalogEndpoint[] → testGenerator.ts → Scenario[]
  Generate assertions based on selected level (basic/contract/full)
  Catalog's hostConfig provides the DEFAULT base URL during generation
  Result: [Scenario C, Scenario D, Scenario E]

Step 2b: Apply unified host override to catalog tests (new)
  If HostSelector mode = "Settings" or "Custom" → replaceHost() on catalog URLs
  If HostSelector mode = "Original" → keep catalog's resolved URL as-is
  This is the SAME host override logic that Harness tests use

Step 3: Merge both sources
  Final: [Scenario A, Scenario B, Scenario C, Scenario D, Scenario E]
  All tests now use the same host if overridden

Step 4: Build TestConfig (existing — unchanged)
  scenarioWeights for all 5 scenarios
  executionMode, concurrency, iterations, etc.

Step 5: Execute (existing — unchanged)
  executor.runTest(config, allScenarios)
  → Executor doesn't know or care which came from Harness vs Catalog
```

### What Changes vs What Stays

| Component | Changes? | Details |
|---|---|---|
| `executor.ts` | **No** | Receives `Scenario[]` — doesn't care about source |
| `runTest()` | **No** | Same contract: `TestConfig + Scenario[]` |
| `TestConfig` | **No** | Same interface |
| `Scenario` type | **Yes** (minor) | Add optional `catalogMeta` field (Phase 1.1). Generated scenarios are otherwise standard `Scenario` objects. |
| `useTestExecution.ts` | **No** | Calls `runTest()` with whatever it receives |
| `ScenarioSelector.tsx` | **Yes** | New "CATALOG SPECS" section rendering `CatalogEntry[]` |
| `buildSelectedTests.ts` | **Yes** | New branch for catalog-backed selections → `testGenerator` |
| `useRunnerOrchestration.ts` | **Yes** | Pass catalog entries + selections to `buildSelectedTests` |
| `TestRunner.tsx` | **Yes** | Pass catalog props to `ScenarioSelector` |
| `App.tsx` (`src/app/App.tsx`) | **Yes** | Pass `CatalogEntry[]` to Test Runner |

### Unified Host Resolution

A key design question: **Should catalog tests use the Test Runner's HostSelector, or the Catalog's own host config?**

**Answer: Both — layered.**

The Catalog's `hostConfig` determines the **default base URL** during scenario generation (Step 2 above). The Test Runner's `HostSelector` can then **override** it — exactly like how Harness tests work with their stored URLs.

#### How It Works

| HostSelector Mode | Harness Tests | Catalog Tests |
|---|---|---|
| **Original** | Use stored URL as-is | Use catalog's resolved URL from `entry.hostConfig` (From Spec / Environment / Custom URL) |
| **Settings** | Replace host with `resolvedBaseUrl` from env/microservice settings | **Same** — replace host with `resolvedBaseUrl` |
| **Custom** | Replace host with user-typed custom URL | **Same** — replace host with user-typed custom URL |

#### Why This Approach

1. **Unified experience** — The HostSelector controls _all_ tests in the run, regardless of source. Users don't need to think about which tests come from which source.
2. **Sensible defaults** — When the user picks "Original", catalog tests use the host configured in the Catalog tab (the spec's server URL, an environment, or a custom URL). This preserves the catalog's configured host.
3. **Easy overrides** — When the user picks "Settings" or "Custom", catalog tests get the same host override as Harness tests. This is essential for running all tests against a staging/QA server.
4. **Consistent with existing patterns** — `buildSelectedTests` already applies `replaceHost()` to Harness test URLs. Adding the same logic for catalog tests is a natural extension.

#### Implementation

In `buildSelectedTests.ts`, after generating catalog scenarios, apply the same host override:

```typescript
// Generate the scenario with catalog's own base URL
const generated = generateTestsFromEndpoint(ep, {
  resolvedBaseUrl: catalogResolvedBaseUrl ?? '',  // from catalog's hostConfig
  ...
});

// Then apply the runner's host override (same logic as Harness tests)
for (const gt of generated) {
  const effectiveBaseUrl = hostMode === 'settings'
    ? (resolvedBaseUrl || '')
    : hostMode === 'custom'
      ? customBaseUrl.trim()
      : '';  // 'hardcoded' / Original → keep catalog's resolved URL

  const url = effectiveBaseUrl
    ? replaceHost(gt.scenario.url, effectiveBaseUrl)
    : gt.scenario.url;

  tests.push({
    ...gt.scenario,
    url,
    featureGroupName: entry.name,
    groupName: gt.tagName,
  });
}
```

#### Comparison: Catalog Tab vs Test Runner Host

| Context | Host Source | User Changes It In |
|---|---|---|
| **Catalog Tab** (Browse / Try It Out) | `entry.hostConfig` → `resolveBaseUrl()` | Host strategy bar in `CatalogEndpointBrowser` (From Spec / Environment / Custom URL) |
| **Test Runner** (HostSelector = Original) | `entry.hostConfig` → `resolveBaseUrl()` | Same as above — preserves catalog's config |
| **Test Runner** (HostSelector = Settings) | `resolvedBaseUrl` from env/microservice | Environment Manager settings |
| **Test Runner** (HostSelector = Custom) | User-typed URL | HostSelector text input |

This means the Catalog's host config is the **source** URL, and the Test Runner's HostSelector is the **override** layer — matching how Harness tests already work.

### Optional: "Save to Harness" Bridge

After running catalog-backed tests, the user can click **"Save to Harness"** on the results to persist the generated `Scenario[]` into `FeatureGroup[]`. This converts virtual tests into permanent hand-built tests — a one-way bridge from Option 4 to the traditional Harness workflow.

---

## 2. Current State Audit

### What Exists Today

| Layer | Component | Status | Notes |
|---|---|---|---|
| **Catalog UI** | `ApiCatalog.tsx` | ✅ Done | Two tabs: Overview, Endpoints. "Send All to Requests" button |
| **Endpoint Browser** | `CatalogEndpointBrowser.tsx` | ✅ Done | Tag groups, filter, host strategy, auth panel |
| **Endpoint Card** | `CatalogEndpointCard.tsx` | ✅ Done | Swagger-style accordion: Try It Out, cURL, live response, spec responses |
| **Send to Requests** | `CatalogSendToRequestsModal.tsx` | ✅ Done | Bulk export to `RequestCollection` |
| **Test Runner** | `TestRunner.tsx` | ✅ Done | Reads from `FeatureGroup[]` only |
| **ScenarioSelector** | `ScenarioSelector.tsx` | ✅ Done | Shows `FeatureGroup[]` as selectable tree |
| **buildSelectedTests** | `buildSelectedTests.ts` | ✅ Done | Walks `FeatureGroup[]` → `Scenario[]` |
| **Executor** | `executor.ts` | ✅ Done | Runs `TestConfig + Scenario[]` |
| **catalogMeta** | On `RequestItem` | ✅ Done | Tracks origin spec/operation but not used for coverage |

### Key Gaps

| Gap | Impact |
|---|---|
| Test Runner only reads from `FeatureGroup[]` | Catalog endpoints can't be tested without manual promotion |
| No `testGenerator` utility | Can't convert `CatalogEndpoint` → `Scenario` with spec-aware assertions |
| No spec coverage tracking | Users can't see which endpoints have tests |
| No schema validation engine | Can't compare live response against spec schema |
| `ScenarioSelector` has no catalog awareness | Can't select catalog endpoints for testing |

---

## 3. Phased Implementation Plan

### Phase 1: Test Generator Engine (Foundation)

**Priority: Critical | Effort: Small-Medium**

The core utility that everything else depends on: converting `CatalogEndpoint` → `Scenario[]`.

#### 1.1 Add `catalogMeta` to `Scenario` Type

**File:** `src/shared/types/index.ts`

Currently `Scenario` has no `catalogMeta` field (only `RequestItem` does). Add an optional field so generated scenarios carry traceability back to their origin spec.

**Steps:**
1. Open `src/shared/types/index.ts`, locate the `Scenario` interface (line 300)
2. Add `catalogMeta?: CatalogRequestMeta` as an optional field after `sourceTestId`
3. Also add three new fields to `CatalogRequestMeta` (line 778) for entry/endpoint tracking:
   - `catalogEntryId?: string` — links back to the `CatalogEntry.id`
   - `catalogEndpointId?: string` — links back to the `CatalogEndpoint.id`
   - `catalogVersion?: string` — records the spec version at generation time
4. Run `npx tsc -b --noEmit` — no downstream breakage expected since both fields are optional

**Why:** Every later phase (coverage tracking, save-to-harness, drift detection, bidirectional navigation) depends on being able to identify which `Scenario` objects originated from a catalog endpoint.

#### 1.2 Create `collectAllEndpoints` Helper

**File:** `src/features/catalog/utils/catalogEndpointCollector.ts` (new)

A small pure function that flattens a `CatalogEntry`'s recursive `CatalogFolder[]` tree + root `endpoints[]` into a single `CatalogEndpoint[]` array with tag names preserved.

```typescript
interface TaggedEndpoint {
  endpoint: CatalogEndpoint;
  tagName: string;          // folder name, or 'Untagged' for root endpoints
  folderId: string;         // folder id, or '' for root
}

function collectAllEndpoints(entry: CatalogEntry): TaggedEndpoint[];
```

**Steps:**
1. Create the file with the above signature
2. Implement recursive folder traversal: for each `CatalogFolder`, collect its `endpoints` with `tagName = folder.name`, then recurse into `folder.folders`
3. Also collect `entry.endpoints` (root-level, not inside any folder) with `tagName = 'Untagged'`
4. Return flat array of `TaggedEndpoint[]`
5. Add unit tests: nested folders, empty folders, root-only endpoints, mixed

**Why:** Multiple phases need this traversal (testGenerator, ScenarioSelector rendering, coverage analyzer). Centralizing it avoids duplication and bugs from inconsistent traversal.

#### 1.3 Create `testGenerator.ts`

**File:** `src/features/catalog/utils/testGenerator.ts` (new)

The core engine that converts `CatalogEndpoint` objects into executable `Scenario[]` with spec-derived assertions.

**Types:**

```typescript
export type GenerationLevel = 'basic' | 'contract' | 'full';

export interface GenerateOptions {
  level: GenerationLevel;
  resolvedBaseUrl: string;
  auth: AuthConfig;
  paramValues?: Record<string, string>;     // user-supplied overrides for path/query params
  bodyText?: string;                         // user-supplied request body override
  sourceSpec?: string;                       // e.g., "Sales Auto Assign v1.0.0"
  catalogEntryId?: string;
  catalogEndpointId?: string;
}

export interface GeneratedTest {
  scenario: Scenario;
  tagName: string;                   // from endpoint's tag/folder for grouping in results
  description: string;               // human-readable test description
}
```

**Public API:**

```typescript
export function generateTestsFromEndpoint(
  endpoint: CatalogEndpoint,
  options: GenerateOptions,
): GeneratedTest[];

export function generateTestsFromEntry(
  entry: CatalogEntry,
  options: GenerateOptions,
): GeneratedTest[];
```

**Implementation steps:**

**Step 1 — URL construction:**
- Build `fullUrl = resolvedBaseUrl + endpoint.path`
- For path parameters: substitute `{paramName}` with values from `options.paramValues` if provided, else use `param.schema.example` or `param.schema.default`, else use placeholder `__PARAM_NAME__`
- For query parameters: append `?key=value` for params that have defaults/examples, but only if `param.in === 'query'` and `param.required` is true or a value is provided
- Use the existing `buildFullUrl` from `catalogCurlGenerator.ts` as reference — it already handles this pattern for the "Try It Out" feature

**Step 2 — Header construction:**
- Collect `endpoint.parameters.filter(p => p.in === 'header')` → `KeyValue[]`
- Add `Content-Type: application/json` for POST/PUT/PATCH if `endpoint.requestBody` has a `contentTypes` entry with `application/json`

**Step 3 — Body construction (POST/PUT/PATCH only):**
- If `options.bodyText` is provided, use it directly
- Else if `endpoint.requestBody` exists:
  - Find the `application/json` content type
  - If `example` exists on the content type, use `JSON.stringify(example, null, 2)`
  - Else call `generateSchemaStub(contentType.schema)` (see Step 5) to create a skeleton JSON body
- For GET/DELETE: empty body

**Step 4 — Assertion generation per level:**

| Level | Logic |
|---|---|
| `basic` | Generate exactly **1 scenario**. Single assertion: `{ type: 'status', expected: '200' }` (or the first 2xx status from `endpoint.responses`). No field-level assertions. |
| `contract` | Generate **1 scenario per response code** in `endpoint.responses`. Each scenario gets a status assertion matching that response code. For non-2xx codes (400, 404, 500), seed the URL or body with intentionally bad values: empty required path params for 400, non-existent resource ID for 404. |
| `full` | Same as `contract` (1 per response code), **plus** for each 2xx response that has a `schema`: walk the schema recursively and generate `ExpectedField[]` entries using selective validation mode: |
|  | — `is_type` assertion for each property (e.g., `jsonPath: $.offers`, `operator: is_type`, `operatorValue: array`) |
|  | — `exists` assertion for each field listed in `schema.required[]` (e.g., `jsonPath: $.offers[0].offerId`, `operator: exists`) |
|  | — `in` assertion for fields with `schema.enum` (e.g., `jsonPath: $.offers[0].type`, `operator: in`, `operatorValue: JSON.stringify(enum)`) |
|  | — `regex` assertion for fields with `schema.pattern` |

**Important design decision — Assertions vs ExpectedFields:**
The validator supports two parallel assertion systems:
1. **`Assertion[]`** (in `validation.assertions`) — status, responseTime, header, regex, arrayLength, numeric, date
2. **`ExpectedField[]`** (in `validation.expectedFields`) — field-level checks with rich operators: `is_type`, `in`, `exists`, `regex`, etc.

For `basic` and `contract` levels, use `Assertion[]` with `type: 'status'` since we only check status codes.
For `full` level, use **`ExpectedField[]`** with `validation.mode = 'selective'` + `selectiveMode = 'include'` because it already supports `is_type`, `exists`, `in`, `regex` operators. Add a `status` assertion in `validation.assertions` as well.

This means **no new operators need to be added to `validator.ts`** — all needed operators (`is_type`, `in`, `exists`, `regex`) already exist in the `ExpectedField` / `FieldOperator` system.

**Step 5 — Schema stub generator:**

Create an internal helper `generateSchemaStub(schema: SchemaObject): unknown`:
- `type: 'string'` → use `schema.example ?? schema.enum?.[0] ?? ''`
- `type: 'number'` / `type: 'integer'` → use `schema.example ?? schema.default ?? 0`
- `type: 'boolean'` → use `schema.example ?? false`
- `type: 'array'` → `[generateSchemaStub(schema.items)]` if items exists, else `[]`
- `type: 'object'` → recurse into `schema.properties`, building `{ key: generateSchemaStub(propSchema) }`
- `allOf / oneOf / anyOf` → use first element
- `null` / unknown → `null`

**Step 6 — Schema walker for assertions (`full` level):**

Create internal helper `walkSchemaForAssertions(schema: SchemaObject, basePath: string): ExpectedField[]`:
- Recursively walk `schema.properties`
- For each property at `parentPath.propName`:
  - Add `is_type` check: `{ jsonPath: parentPath.propName, expectedValue: '', operator: 'is_type', operatorValue: schema.type }`
  - If property name is in parent `schema.required[]`: add `exists` check
  - If property has `enum`: add `in` check with `operatorValue: JSON.stringify(enum)`
  - If property has `pattern`: add `regex` check
- For arrays: add `is_type` check for `array`, then recurse into `items` with `basePath[0]` notation
- Limit recursion depth to 4 levels to avoid massive assertion sets
- Limit total assertions to 50 per scenario to keep results manageable

**Step 7 — Scenario assembly:**

For each scenario to generate:
```typescript
const scenario: Scenario = {
  id: uuidv4(),
  name: `${endpoint.method} ${endpoint.path} → ${statusCode} ${description}`,
  url: fullUrl,
  method: endpoint.method,
  headers: headerKvs,
  body: bodyText,
  bodyType: bodyText ? 'json' : undefined,
  auth: options.auth,
  validation: {
    mode: level === 'full' ? 'selective' : 'none',
    selectiveMode: level === 'full' ? 'include' : undefined,
    expectedFields: level === 'full' ? expectedFields : undefined,
    assertions: [{ type: 'status', expected: statusCode }],
  },
  catalogMeta: {
    operationId: endpoint.operationId,
    description: endpoint.description,
    originalPath: endpoint.path,
    tags: endpoint.tags,
    deprecated: endpoint.deprecated || undefined,
    parameters: endpoint.parameters.map(p => ({
      name: p.name, in: p.in, required: p.required,
      description: p.description, type: p.schema?.type,
    })),
    expectedResponses: endpoint.responses.map(r => ({
      statusCode: r.statusCode, description: r.description,
    })),
    security: endpoint.security,
    sourceSpec: options.sourceSpec,
    catalogEntryId: options.catalogEntryId,
    catalogEndpointId: options.catalogEndpointId,
  },
};
```

**Step 8 — `generateTestsFromEntry` convenience wrapper:**

Calls `collectAllEndpoints(entry)`, then for each tagged endpoint calls `generateTestsFromEndpoint`, forwarding `options` with `catalogEntryId` set from `entry.id`.

#### 1.4 Unit Tests for `testGenerator.ts`

**File:** `src/features/catalog/utils/testGenerator.test.ts` (new)

| # | Test Case | What It Validates |
|---|---|---|
| 1 | `basic` level generates exactly 1 scenario | Minimum viable output |
| 2 | `basic` scenario has a single `status` assertion for `200` | Default happy-path status |
| 3 | `basic` with no 2xx response in spec uses first response code | Graceful fallback |
| 4 | `contract` level generates N scenarios for N spec response codes | Per-status-code splitting |
| 5 | `contract` 400 scenario has altered params (bad values) | Error seeding |
| 6 | `contract` scenario names include method + path + status | Readable naming |
| 7 | `full` level includes `is_type` assertions from schema | Schema type checking |
| 8 | `full` level includes `exists` assertions for `required` fields | Required field checking |
| 9 | `full` level includes `in` assertions for `enum` fields | Enum validation |
| 10 | `full` level includes `regex` assertions for `pattern` fields | Pattern validation |
| 11 | URL construction with `resolvedBaseUrl` + path | Correct URL assembly |
| 12 | Path param substitution uses `paramValues` override | User value override |
| 13 | Path param substitution falls back to `example` → `default` → placeholder | Fallback chain |
| 14 | POST/PUT/PATCH body seeded from spec `example` | Example body |
| 15 | POST/PUT/PATCH body seeded from schema stub when no example | Schema stub generation |
| 16 | GET/DELETE body is empty | No body for safe methods |
| 17 | `catalogMeta` populated with all fields on generated scenarios | Traceability |
| 18 | `generateTestsFromEntry` flattens all folders and generates for all endpoints | Entry-level convenience |
| 19 | Handles endpoints with 0 parameters, 0 responses | Edge case |
| 20 | Handles deeply nested response schemas (4+ levels) | Recursion limit |
| 21 | Assertion count capped at 50 per scenario | Size guard |
| 22 | Schema stub handles `allOf`/`oneOf`/`anyOf` → uses first element | Composition types |
| 23 | Schema stub handles `nullable` types | Nullable |
| 24 | Header params added to request headers | Header param mapping |
| 25 | `Content-Type: application/json` added for JSON body methods | Content type header |

#### 1.5 Verify Existing Assertion Operator Support

**No changes needed to `validator.ts`.**

After analyzing the codebase, the test generator will use two assertion mechanisms that already exist:

| Mechanism | Used By | Already Supported |
|---|---|---|
| `Assertion` with `type: 'status'` | All levels | ✅ `evaluateAssertions` in `validator.ts` handles `status` via `matchesStatusPattern` |
| `ExpectedField` with `operator: 'is_type'` | `full` level | ✅ `evaluateFieldOperator` in `fieldOperatorEvaluation.ts` (line 187) |
| `ExpectedField` with `operator: 'exists'` | `full` level | ✅ `evaluateFieldOperator` in `fieldOperatorEvaluation.ts` (line 181) |
| `ExpectedField` with `operator: 'in'` | `full` level | ✅ `evaluateFieldOperator` in `fieldOperatorEvaluation.ts` (line 196) |
| `ExpectedField` with `operator: 'regex'` | `full` level | ✅ `evaluateFieldOperator` in `fieldOperatorEvaluation.ts` (line 135) |

The initial plan mentioned needing `type` and `oneOf` as new `Assertion` operators, but those are unnecessary because the `ExpectedField` system (used by selective validation mode) already provides `is_type` and `in` operators with full implementation. This avoids touching the stable `validator.ts` code.

---

### Phase 2: Virtual Test Source in ScenarioSelector

**Priority: Critical | Effort: Medium**

The core UX change: catalog specs appear as a selectable second section in the Test Runner.

#### 2.1 Create `catalogTestCount` Helper

**File:** `src/features/catalog/utils/catalogTestCount.ts` (new)

A pure function that calculates how many tests would be generated for an endpoint at a given level, **without** actually generating the full `Scenario` objects. Used for display counts in the UI.

```typescript
export function countTestsForEndpoint(
  endpoint: CatalogEndpoint,
  level: GenerationLevel,
): number;

export function countTestsForFolder(
  folder: CatalogFolder,
  level: GenerationLevel,
): number;

export function countTestsForEntry(
  entry: CatalogEntry,
  level: GenerationLevel,
): number;
```

**Steps:**
1. `basic` → always 1 per endpoint
2. `contract` → `endpoint.responses.length` (or 1 if no responses defined)
3. `full` → same count as `contract` (same number of scenarios, just richer assertions)
4. Folder/entry counts = sum of endpoint counts

**Why:** The `ScenarioSelector` needs to display counts like "3 endpoints → 9 tests" without the cost of full scenario generation on every render.

#### 2.2 Update `ScenarioSelector.tsx`

**File:** `src/features/test-runner/components/ScenarioSelector.tsx`

**Step 1 — Add new props to the `Props` interface:**

```typescript
// Add after existing props
catalogEntries?: CatalogEntry[];
selectedCatalogEndpoints?: Set<string>;
onSelectedCatalogEndpointsChange?: (ids: Set<string>) => void;
catalogTestLevel?: GenerationLevel;
onCatalogTestLevelChange?: (level: GenerationLevel) => void;
```

**Step 2 — Add catalog-aware state:**
- Add `expandedCatalogEntries: Set<string>` state (tracks which catalog entries are expanded)
- Initialize with all `catalogEntries?.map(e => e.id)` (all expanded by default)

**Step 3 — Add catalog selection handlers:**
- `toggleCatalogEndpoint(endpointId: string)` — add/remove from `selectedCatalogEndpoints`; when adding, apply gallery exclusion (clear gallery selections)
- `toggleCatalogFolder(folderId: string, entry: CatalogEntry)` — select/deselect all endpoints in the folder
- `toggleCatalogEntry(entryId: string, entry: CatalogEntry)` — select/deselect all endpoints in the entry (all folders + root endpoints)

**Step 4 — Update "Select All" / "Deselect All":**
- `selectAll`: add all catalog endpoint IDs to `selectedCatalogEndpoints` AND all scenario IDs to `selectedScenarios`
- `deselectAll`: clear both sets
- Maintain gallery exclusion: if catalog endpoints are selected, clear gallery scenarios and vice versa

**Step 5 — Update test count display:**
- Current: `selectedTests.length` — only counts FeatureGroup-based tests
- New: add catalog test count from `countTestsForEndpoint` for each selected catalog endpoint
- Display: `"5 scenarios + 12 catalog tests selected (17 total tests)"`

**Step 6 — Render CATALOG SPECS section:**

After the Gallery Samples section (or after YOUR TESTS if no gallery), add:

```
<div className="selection-section-header selection-section-catalog">
  <span className="selection-section-label">📋 CATALOG SPECS</span>
  <span className="selection-section-hint">
    Tests generated from live spec — regenerated fresh each run
  </span>
</div>
```

Followed by:
- A "Test Level" dropdown: `<select>` with options `basic` / `contract` / `full`
- For each `CatalogEntry`: collapsible group header (checkbox + entry name + version + endpoint count)
  - For each `CatalogFolder` in entry: nested group header (checkbox + folder name + endpoint count + test count)
    - For each `CatalogEndpoint` in folder: leaf row (checkbox + method badge + path + summary + test count)
  - For each root `CatalogEndpoint` in `entry.endpoints`: leaf row (same format)
- Test count per endpoint: `countTestsForEndpoint(ep, catalogTestLevel)` displayed as count badge

**Step 7 — Add CSS classes:**

Add to `src/styles/scenario-builder.css` (which already styles `ScenarioSelector`):
- `.selection-section-catalog` — section header styling with distinct accent color
- `.catalog-endpoint-row` — method badge + path + summary layout
- `.catalog-level-picker` — inline dropdown styling
- `.catalog-test-count` — test count badge for generated tests (different color from harness badges)

#### 2.3 Update `buildSelectedTests.ts`

**File:** `src/features/test-runner/utils/buildSelectedTests.ts`

**Step 1 — Add new parameters to function signature:**

```typescript
export function buildSelectedTests(
  featureGroups: FeatureGroup[],
  selectedScenarios: Set<string>,
  hostMode: 'hardcoded' | 'settings' | 'custom',
  customBaseUrl: string,
  resolvedBaseUrl: string | undefined,
  skipValidation: boolean,
  validationOverride: RunnerConfig['validationOverride'],
  forceUnordered: boolean,
  globalAuthProfiles: GlobalAuthProfile[],
  envFallbackAuth?: AuthConfig,
  // NEW: catalog virtual test source
  catalogEntries?: CatalogEntry[],
  selectedCatalogEndpoints?: Set<string>,
  catalogTestLevel?: GenerationLevel,
  catalogResolvedBaseUrl?: string,
  catalogAuth?: AuthConfig,
): SelectedTest[] {
```

**Step 2 — Add imports:**

```typescript
import type { CatalogEntry } from '../../catalog/types/catalog';
import type { GenerationLevel } from '../../catalog/utils/testGenerator';
import { generateTestsFromEndpoint } from '../../catalog/utils/testGenerator';
import { collectAllEndpoints } from '../../catalog/utils/catalogEndpointCollector';
```

**Step 3 — Add catalog processing loop after the existing FeatureGroup loop (before `return tests`):**

```typescript
if (catalogEntries && selectedCatalogEndpoints && selectedCatalogEndpoints.size > 0) {
  for (const entry of catalogEntries) {
    const tagged = collectAllEndpoints(entry);
    const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
    const versionLabel = currentVersion?.version ?? '?';

    for (const { endpoint: ep, tagName } of tagged) {
      if (!selectedCatalogEndpoints.has(ep.id)) continue;

      // Step A: Generate scenario with catalog's own base URL
      const generated = generateTestsFromEndpoint(ep, {
        level: catalogTestLevel ?? 'basic',
        resolvedBaseUrl: catalogResolvedBaseUrl ?? '',
        auth: catalogAuth ?? { type: 'none' },
        sourceSpec: `${entry.name} v${versionLabel}`,
        catalogEntryId: entry.id,
        catalogEndpointId: ep.id,
      });

      // Step B: Apply unified host override (same logic as Harness tests)
      // "Original" → keep catalog's resolved URL
      // "Settings" → replace host with resolvedBaseUrl from env/microservice
      // "Custom"   → replace host with user-typed custom URL
      const effectiveBaseUrl = hostMode === 'settings'
        ? (resolvedBaseUrl || '')
        : hostMode === 'custom'
          ? customBaseUrl.trim()
          : '';  // 'hardcoded' / Original → keep catalog's resolved URL

      for (const gt of generated) {
        const url = effectiveBaseUrl
          ? replaceHost(gt.scenario.url, effectiveBaseUrl)
          : gt.scenario.url;

        tests.push({
          ...gt.scenario,
          url,
          featureGroupName: `${entry.name} v${versionLabel}`,
          groupName: tagName,
        });
      }
    }
  }
}
```

**Why two steps?** The test generator uses the catalog's `hostConfig` to build the initial URL (Step A). Then the runner's HostSelector can override the host (Step B). This is the same pattern as Harness tests: they have stored URLs that get overridden by `replaceHost()` when `hostMode` is `settings` or `custom`.

**Step 4 — Add `replaceHost` import** (already imported for Harness tests — no change needed):

```typescript
import { replaceHost } from '../../../shared/utils/urlUtils';
```

**Step 5 — Verify no regressions:**
- When `catalogEntries` is `undefined` or `selectedCatalogEndpoints` is empty, the existing behavior is completely unchanged
- When `hostMode === 'hardcoded'` (Original), catalog tests keep their original URL from `entry.hostConfig` — no override applied
- When `hostMode === 'settings'` or `'custom'`, both Harness and Catalog tests get the same host swap via `replaceHost()`
- The returned `SelectedTest[]` type is unchanged — both Harness and Catalog tests are the same shape
- The executor downstream receives standard `Scenario[]` objects

#### 2.4 Update `useRunnerOrchestration.ts`

**File:** `src/features/test-runner/hooks/useRunnerOrchestration.ts`

**Step 1 — Add catalog props to `RunnerOrchestrationOptions`:**

```typescript
interface RunnerOrchestrationOptions {
  // ... existing fields ...
  catalogEntries?: CatalogEntry[];
  catalogResolvedBaseUrl?: string;
  catalogAuth?: AuthConfig;
}
```

**Step 2 — Add catalog state:**

```typescript
const [selectedCatalogEndpoints, setSelectedCatalogEndpoints] = useState<Set<string>>(new Set());
const [catalogTestLevel, setCatalogTestLevel] = useState<GenerationLevel>('basic');
```

**Step 3 — Update `selectedTests` useMemo:**

Add the 5 new catalog params to the `buildSelectedTests` call (lines ~97-104 currently):

```typescript
const selectedTests = useMemo(
  () => buildSelectedTests(
    featureGroups, selectedScenarios, hostMode, customBaseUrl,
    resolvedBaseUrl, skipValidation, validationOverride, forceUnordered,
    globalAuthProfiles, envFallbackAuth,
    // NEW
    catalogEntries, selectedCatalogEndpoints, catalogTestLevel,
    catalogResolvedBaseUrl, catalogAuth,
  ),
  [featureGroups, selectedScenarios, hostMode, customBaseUrl, resolvedBaseUrl,
   skipValidation, validationOverride, forceUnordered, globalAuthProfiles, envFallbackAuth,
   catalogEntries, selectedCatalogEndpoints, catalogTestLevel,
   catalogResolvedBaseUrl, catalogAuth]
);
```

**Step 4 — Expose new state in return object:**

Add to `RunnerOrchestrationResult` and the return statement:

```typescript
selectedCatalogEndpoints, setSelectedCatalogEndpoints,
catalogTestLevel, setCatalogTestLevel,
```

**Step 5 — Update `hasAnyTests` logic in `TestRunner.tsx`:**

The "No tests defined" empty state currently checks only `featureGroups`. Update to also consider catalog entries:

```typescript
const hasAnyTests = featureGroups.some(fg => fg.scenarios.some(sc => sc.tests.length > 0))
  || (catalogEntries && catalogEntries.length > 0);
```

#### 2.5 Update `TestRunner.tsx`

**File:** `src/features/test-runner/TestRunner.tsx`

**Step 1 — Add `catalogEntries` to `Props`:**

```typescript
interface Props {
  // ... existing props ...
  catalogEntries?: CatalogEntry[];
  catalogResolvedBaseUrl?: string;
  catalogAuth?: AuthConfig;
}
```

**Step 2 — Pass catalog props to `useRunnerOrchestration`:**

```typescript
const runner = useRunnerOrchestration({
  featureGroups, kind: 'standard', envId, svcId, envName, svcName,
  resolvedBaseUrl, globalAuthProfiles, envFallbackAuth, sharedDataSources,
  catalogEntries, catalogResolvedBaseUrl, catalogAuth,       // NEW
});
```

**Step 3 — Destructure catalog state from runner:**

```typescript
const { selectedCatalogEndpoints, setSelectedCatalogEndpoints,
        catalogTestLevel, setCatalogTestLevel } = runner;
```

**Step 4 — Pass catalog props to `ScenarioSelector`:**

```typescript
<ScenarioSelector
  // ... existing props ...
  catalogEntries={catalogEntries}
  selectedCatalogEndpoints={selectedCatalogEndpoints}
  onSelectedCatalogEndpointsChange={setSelectedCatalogEndpoints}
  catalogTestLevel={catalogTestLevel}
  onCatalogTestLevelChange={setCatalogTestLevel}
/>
```

#### 2.6 Update `ParameterizedRunner.tsx`

**File:** `src/features/test-runner/ParameterizedRunner.tsx`

Apply the same changes as `TestRunner.tsx`:
- Add `catalogEntries`, `catalogResolvedBaseUrl`, `catalogAuth` to Props
- Pass to `useRunnerOrchestration`
- Pass catalog selection state to `ScenarioSelector`

This ensures catalog specs are available in both standard and parameterized runners.

#### 2.7 Update `App.tsx`

**File:** `src/app/App.tsx`

**Step 1 — Resolve catalog base URL and auth for the currently selected catalog entry:**

The Test Runner needs the resolved base URL and auth from the catalog's `hostConfig` and `savedAuth`. Compute these in `App.tsx`:

```typescript
const catalogResolvedBaseUrl = useMemo(() => {
  if (!catalog.entries.length) return undefined;
  // Use the first entry's hostConfig as default; user can override in runner
  const entry = catalog.entries[0];
  return resolveBaseUrl(
    entry.hostConfig,
    entry.servers,
    entry.environments,
    linkedMicroservice,
  );
}, [catalog.entries, linkedMicroservice]);

const catalogAuth = useMemo(() => {
  if (!catalog.entries.length) return undefined;
  return catalog.entries[0].savedAuth ?? { type: 'none' as const };
}, [catalog.entries]);
```

**Step 2 — Pass to Test Runner and Parameterized Runner:**

```typescript
<TestRunner
  featureGroups={filteredFeatureGroups}
  catalogEntries={catalog.entries}
  catalogResolvedBaseUrl={catalogResolvedBaseUrl}
  catalogAuth={catalogAuth}
  // ... existing props ...
/>
```

(Same for `ParameterizedRunner`.)

#### 2.8 Unit Tests

**File:** `src/features/test-runner/utils/buildSelectedTests.test.ts` (update existing)

| # | Test Case | What It Validates |
|---|---|---|
| 1 | Existing tests: no catalog params → same output as before | No regression |
| 2 | Catalog entries provided but no selections → no extra scenarios | Empty selection edge |
| 3 | 1 catalog endpoint selected, basic level → 1 SelectedTest added | Minimum catalog run |
| 4 | 1 catalog endpoint selected, contract level, 3 responses → 3 SelectedTests | Per-response splitting |
| 5 | Mixed: 2 Harness + 3 catalog → 5 SelectedTests total | Mixed merge |
| 6 | Catalog SelectedTest has correct `featureGroupName` (entry name + version) | Result grouping |
| 7 | Catalog SelectedTest has correct `groupName` (tag name) | Result sub-grouping |
| 8 | Catalog SelectedTest has `catalogMeta` with correct `catalogEntryId` and `catalogEndpointId` | Traceability |
| 9 | Multiple entries, selections across both → correct SelectedTests | Multi-entry |
| 10 | Changing `catalogTestLevel` produces different assertion counts | Level sensitivity |
| 11 | `hostMode: 'hardcoded'` → catalog tests keep catalog's resolved URL | Original mode |
| 12 | `hostMode: 'settings'` → catalog test URLs get host replaced with `resolvedBaseUrl` | Settings override |
| 13 | `hostMode: 'custom'` → catalog test URLs get host replaced with `customBaseUrl` | Custom override |
| 14 | `hostMode: 'settings'` → both Harness and catalog tests use same host | Unified host |

**File:** `src/features/test-runner/components/ScenarioSelector.test.tsx` (update existing)

| # | Test Case | What It Validates |
|---|---|---|
| 1 | Renders "CATALOG SPECS" section when `catalogEntries` is provided | UI rendering |
| 2 | Does not render "CATALOG SPECS" when no catalog entries | Conditional rendering |
| 3 | Renders entry names with version numbers | Entry display |
| 4 | Renders folder names with endpoint counts | Folder display |
| 5 | Renders endpoint rows with method badge + path | Endpoint display |
| 6 | Clicking endpoint checkbox calls `onSelectedCatalogEndpointsChange` | Selection callback |
| 7 | Clicking folder checkbox selects all endpoints in folder | Bulk selection |
| 8 | Clicking entry checkbox selects all endpoints in entry | Entry-level selection |
| 9 | Test count badge shows correct count for current level | Count display |
| 10 | Changing test level dropdown calls `onCatalogTestLevelChange` | Level change |
| 11 | Gallery mutual exclusion: selecting catalog clears gallery | Exclusion |
| 12 | "Select All" selects both YOUR TESTS and CATALOG SPECS | Unified select |
| 13 | "Deselect All" clears both sections | Unified deselect |

---

### Phase 3: Catalog Endpoint Detail View with Spec Context

**Priority: High | Effort: Medium**

The browsing experience that shows spec-aware information unique to Catalog.

#### 3.1 Add Navigation State to `ApiCatalog.tsx`

**File:** `src/features/catalog/ApiCatalog.tsx`

**Step 1 — Add state:**

```typescript
const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
const [selectedEndpointFolderId, setSelectedEndpointFolderId] = useState<string | null>(null);
```

**Step 2 — Conditional rendering:**

When `selectedEndpointId` is set:
- Hide the `CatalogEndpointBrowser` component
- Render the new `CatalogEndpointDetail` component instead
- Pass a `onBack` handler that clears `selectedEndpointId`

When `selectedEndpointId` is null:
- Render the current `CatalogEndpointBrowser` as before

**Step 3 — Thread click handler:**

Pass `onEndpointClick` prop to `CatalogEndpointBrowser` → `CatalogEndpointCard`. When the user clicks an endpoint card (not the "Try It Out" accordion, but the card title or a new "Details" button), set `selectedEndpointId`.

#### 3.2 Create `CatalogEndpointDetail.tsx`

**File:** `src/features/catalog/components/CatalogEndpointDetail.tsx` (new)

**Props:**

```typescript
interface Props {
  endpoint: CatalogEndpoint;
  entry: CatalogEntry;
  hostConfig: HostConfig;
  servers: CatalogServer[];
  environments?: CatalogEnvironment[];
  linkedMicroservice?: Microservice;
  auth: AuthConfig;
  globalAuthProfiles: GlobalAuthProfile[];
  featureGroups: FeatureGroup[];     // for coverage data
  onBack: () => void;
}
```

**Layout — Two-pane, similar to `RequestEditor`:**

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Endpoints                                    │
│                                                          │
│  [GET]  /vehicles/{vin}/onboarding/vehiclePurchaseOffers │
│  ┌──────────────────────┐  ┌───────────────────────────┐ │
│  │ Resolved URL:        │  │ [▶ Send]  [cURL]          │ │
│  │ https://api.example  │  │                           │ │
│  │ .com/vehicles/{vin}/ │  │                           │ │
│  └──────────────────────┘  └───────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────┬─────────────────────────┐   │
│  │ LEFT PANE               │ RIGHT PANE              │   │
│  │ [Params][Body][Auth]    │ [Response][Headers]      │   │
│  │ [Spec Contract]        │ [Schema Match]           │   │
│  │                         │                         │   │
│  │ (content varies by tab) │ (content varies by tab) │   │
│  └─────────────────────────┴─────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Step 1 — Top bar:**
- "← Back to Endpoints" button → calls `onBack()`
- Method badge (colored, read-only)
- Resolved URL display (using `resolveBaseUrl(hostConfig, servers, environments, linkedMicroservice)` + `endpoint.path`)
- "Send" button → executes HTTP request using `httpFetch` (same as `CatalogEndpointCard`'s execute)
- Response status badge + time

**Step 2 — Left pane tabs:**

| Tab | Implementation |
|---|---|
| **Params** | List all `endpoint.parameters`, grouped by `in` (path, query, header). Each param shows: name, type from `schema.type`, required badge, description. If `schema.enum` → dropdown. If `schema.format` → hint label. Editable input fields for values (seeded from `schema.example` or `schema.default`). |
| **Body** | Only shown for POST/PUT/PATCH/DELETE. Code editor (same as RequestEditor body editor). Seeded from `endpoint.requestBody.contentTypes[0].example` or `generateSchemaStub`. Shows "Content-Type" label from `contentTypes[0].mediaType`. |
| **Auth** | Same `CatalogAuthPanel` component, pre-configured with the catalog entry's `savedAuth`. Editable. |
| **Spec Contract** | **Unique to Catalog.** See Step 3 below. |

**Step 3 — "Spec Contract" tab (CatalogSpecContract component):**

**File:** `src/features/catalog/components/CatalogSpecContract.tsx` (new)

Displays spec-defined information that Requests can never show:

- **Expected Responses** table:
  | Status | Description | Has Schema |
  |--------|-------------|------------|
  | 200    | Success — returns offers array | ✅ |
  | 400    | Invalid VIN format | ✅ |
  | 404    | Vehicle not found | ❌ |

- **Response Schema Tree** (for the selected response code):
  - Expandable JSON tree showing the schema structure
  - Each node shows: property name, type, required/optional badge, format, enum values
  - Uses the existing `buildJsonTree` from `src/shared/utils/jsonTreeModel.ts` adapted for `SchemaObject`

- **Security Requirements:**
  - Lists security scheme names from `endpoint.security`
  - Shows scheme type (bearer, apiKey, etc.) from `entry.securitySchemes`

- **Deprecation Warning** (if `endpoint.deprecated === true`)

**Step 4 — Right pane tabs:**

| Tab | Implementation |
|---|---|
| **Response** | JSON tree view of the live response (reuse existing `JsonTreeView` or `CodeMirror` preview). Only populated after "Send" is clicked. |
| **Headers** | Table of response headers. Same as `CatalogEndpointCard`'s response header display. |
| **Schema Match** | **Unique to Catalog.** See Step 5 below. |

**Step 5 — "Schema Match" tab (CatalogSchemaMatch component):**

**File:** `src/features/catalog/components/CatalogSchemaMatch.tsx` (new)

Only populated after a "Send" produces a response. Calls `validateResponseAgainstSpec` from `schemaValidator.ts` (Step 3.3) and displays:

- Overall status badge: ✅ Pass / ⚠️ Warning / ❌ Fail
- Status code match: "Expected: 200, Got: 200 ✅"
- Field-by-field results table:
  | Field Path | Expected Type | Actual Type | Match |
  |---|---|---|---|
  | `$.offers` | array | array | ✅ |
  | `$.offers[0].offerId` | string | string | ✅ |
  | `$.offers[0].type` | enum(purchase,lease) | "purchase" | ✅ |
  | `$.offers[0].discount` | — | number | ⚠️ Extra field |
- Missing required fields list
- Unexpected extra fields list

#### 3.3 Create `schemaValidator.ts`

**File:** `src/features/catalog/utils/schemaValidator.ts` (new)

```typescript
export interface SchemaMatchResult {
  status: 'pass' | 'warn' | 'fail';
  statusCodeMatch: boolean;
  expectedStatusCode: string;
  actualStatusCode: number;
  fieldResults: SchemaFieldResult[];
  unexpectedFields: string[];
  missingRequiredFields: string[];
  summary: string;                    // e.g., "15/17 fields match, 2 missing required"
}

export interface SchemaFieldResult {
  path: string;                       // JSONPath, e.g., "$.offers[0].offerId"
  expectedType: string;               // from schema: "string", "number", "array", etc.
  actualType: string | null;          // null if field is missing
  match: boolean;
  enumValues?: unknown[];             // expected enum values if applicable
  enumViolation?: string;             // actual value when it doesn't match enum
  required: boolean;
}

export function validateResponseAgainstSpec(
  responseBody: unknown,
  responseStatus: number,
  specResponses: CatalogResponse[],
  specSchema: SchemaObject | undefined,
): SchemaMatchResult;
```

**Implementation steps:**

1. **Status code matching:** Find the `CatalogResponse` whose `statusCode` matches `responseStatus` (as string). If no match, set `status: 'warn'` and skip field-level validation.

2. **Schema resolution:** Get the `schema` from the matching `CatalogResponse`, or use the provided `specSchema` fallback.

3. **Recursive field walk:** Walk the `SchemaObject` and the actual response in parallel:
   - For each property in `schema.properties`:
     - Resolve the JSONPath (e.g., `$.offers[0].offerId`)
     - Get the actual value at that path using `getByPath` from `src/shared/utils/jsonPath.ts`
     - Compare `schema.type` vs `typeof actualValue` (with array detection)
     - If `schema.enum`, check if actual value is in the enum list
     - If property is in `schema.required`, mark `required: true`
   - For arrays: validate `items` schema against `actualArray[0]` (first element sample)
   - Track recursion depth (max 6 levels)

4. **Extra field detection:** Walk the actual response and find keys not present in `schema.properties`

5. **Overall status:** `pass` if all required fields present and all types match; `warn` if extra fields found but no mismatches; `fail` if missing required fields or type mismatches

#### 3.4 Add CSS

**File:** `src/styles/catalog.css` (new or extend existing)

- `.catalog-endpoint-detail` — two-pane layout (flex, responsive)
- `.catalog-detail-top-bar` — method badge + URL + Send button
- `.catalog-detail-left-pane`, `.catalog-detail-right-pane` — tab containers
- `.catalog-spec-contract` — schema tree, response table
- `.catalog-schema-match` — field results table with pass/fail highlighting
- `.schema-field-pass` → green, `.schema-field-fail` → red, `.schema-field-warn` → yellow

#### 3.5 Unit Tests

**File:** `src/features/catalog/utils/schemaValidator.test.ts` (new)

| # | Test Case |
|---|---|
| 1 | Status code match: 200 expected, 200 actual → pass |
| 2 | Status code mismatch: 200 expected, 404 actual → fail |
| 3 | All required fields present and correct types → pass |
| 4 | Missing required field → fail |
| 5 | Wrong type on a field (expected string, got number) → fail |
| 6 | Extra field in response not in schema → warn |
| 7 | Enum field with valid value → pass |
| 8 | Enum field with invalid value → fail with enumViolation |
| 9 | Nested object validation (2 levels deep) → correct paths |
| 10 | Array items validation → checks first element schema |
| 11 | Empty response body → all fields reported as missing |
| 12 | No matching response code in spec → warn status |
| 13 | Schema with nullable: true → null value passes |
| 14 | Deep nesting (6+ levels) → stops at recursion limit |

**File:** `src/features/catalog/components/CatalogEndpointDetail.test.tsx` (new)

| # | Test Case |
|---|---|
| 1 | Renders method badge and resolved URL |
| 2 | "Back to Endpoints" button calls onBack |
| 3 | Params tab shows all endpoint parameters grouped by `in` |
| 4 | Required params have required badge |
| 5 | Enum params render as dropdown |
| 6 | Body tab shown for POST, hidden for GET |
| 7 | Body seeded from spec example |
| 8 | Spec Contract tab shows expected responses table |
| 9 | Spec Contract tab shows security requirements |
| 10 | Schema Match tab shows "Send a request first" when no response |
| 11 | After mock send, Schema Match shows field results |

---

### Phase 4: Spec Coverage Tracking

**Priority: High | Effort: Medium**

Track which catalog endpoints have tests (both hand-built Harness tests via `catalogMeta` and virtual catalog tests via selection state).

#### 4.1 Create Coverage Types

**File:** `src/features/catalog/types/coverage.ts` (new)

```typescript
import type { HttpMethod } from '../../../shared/types';

export type CoverageStatus = 'untested' | 'partial' | 'covered';

export interface EndpointCoverage {
  endpointId: string;
  method: HttpMethod;
  path: string;
  operationId?: string;
  status: CoverageStatus;
  harnessTests: EndpointTestLink[];
  coveredStatusCodes: string[];          // response codes that have assertions in Harness tests
  missingStatusCodes: string[];          // response codes from spec with no assertion coverage
  hasSchemaValidation: boolean;          // at least one test uses selective/full validation
}

export interface EndpointTestLink {
  featureGroupId: string;
  featureGroupName: string;
  scenarioId: string;
  scenarioName: string;
  testId: string;
  testName: string;
}

export interface EntryCoverageSummary {
  entryId: string;
  entryName: string;
  totalEndpoints: number;
  coveredCount: number;
  partialCount: number;
  untestedCount: number;
  coveragePercent: number;              // 0-100
  endpointCoverages: EndpointCoverage[];
}
```

#### 4.2 Create `coverageAnalyzer.ts`

**File:** `src/features/catalog/utils/coverageAnalyzer.ts` (new)

```typescript
export function computeCoverage(
  catalogEntry: CatalogEntry,
  featureGroups: FeatureGroup[],
): EntryCoverageSummary;
```

**Implementation steps:**

**Step 1 — Collect all catalog endpoints:**
Use `collectAllEndpoints(catalogEntry)` to get a flat list of all endpoints with tag info.

**Step 2 — Build Harness test index:**
Walk all `featureGroups → scenarios → tests` and collect tests that have `catalogMeta`:
```typescript
interface TestIndex {
  byEndpointId: Map<string, TestReference[]>;       // catalogMeta.catalogEndpointId → tests
  byPathMethod: Map<string, TestReference[]>;       // `${method}:${originalPath}` → tests
}
```

This dual-key index allows matching by:
1. **Exact ID match** (tests saved via "Save to Harness" with `catalogEndpointId`)
2. **Path + method match** (tests manually created with same path, or exported via "Send to Requests")

**Step 3 — Compute per-endpoint coverage:**

For each `CatalogEndpoint`:
1. Find matching Harness tests via `testIndex.byEndpointId.get(ep.id)` OR `testIndex.byPathMethod.get(method:path)`
2. If no matching tests: `status: 'untested'`
3. If matching tests exist:
   - Extract covered status codes by analyzing `test.validation.assertions` for `type: 'status'` entries
   - Extract covered status codes from `test.validation.expectedFields` for selective validation
   - Compare against `ep.responses.map(r => r.statusCode)` to find missing status codes
   - Check if any test uses `validation.mode !== 'none'` to determine `hasSchemaValidation`
   - If all spec response codes are covered: `status: 'covered'`
   - If some but not all: `status: 'partial'`

**Step 4 — Compute entry-level summary:**
Aggregate: `coveredCount`, `partialCount`, `untestedCount`, `coveragePercent = (covered + partial * 0.5) / total * 100`

#### 4.3 Create `CatalogCoverageSummary.tsx`

**File:** `src/features/catalog/components/CatalogCoverageSummary.tsx` (new)

Coverage widget for the Overview tab.

**Props:**

```typescript
interface Props {
  coverageSummary: EntryCoverageSummary;
  onSelectUntested?: () => void;        // "Select Untested in Runner" action
  onViewReport?: () => void;            // expand to full coverage report
}
```

**Rendering:**

```
┌──────────────────────────────────────────────────────────┐
│  Test Coverage                                            │
│  ████████████░░░░░░  5/8 endpoints (63%)                │
│                                                           │
│  ✅ 3 fully covered   ⚠️ 2 partial   ❌ 3 untested      │
│                                                           │
│  [Select Untested in Runner →]  [View Full Report]       │
└──────────────────────────────────────────────────────────┘
```

**Step 1 — Progress bar:** CSS-based percentage bar with green fill
**Step 2 — Status counts:** Three badges with icons
**Step 3 — Action buttons:**
- "Select Untested in Runner" → calls `onSelectUntested` which should navigate to Test Runner tab and pre-select all untested catalog endpoints
- "View Full Report" → scrolls to or expands the endpoint coverage detail table

#### 4.4 Add Coverage Badge to `CatalogEndpointBrowser.tsx`

**File:** `src/features/catalog/components/CatalogEndpointBrowser.tsx`

**Step 1 — Accept `featureGroups` prop** (threaded from `ApiCatalog.tsx`)
**Step 2 — Compute `coverageSummary`** using `computeCoverage(entry, featureGroups)` in a `useMemo`
**Step 3 — Pass per-endpoint coverage status to each `CatalogEndpointCard`**

Add a small coverage badge to each endpoint card header:
- ✅ green checkmark for `covered`
- ⚠️ yellow dot for `partial`
- No badge for `untested` (or subtle gray ○)

#### 4.5 Add Coverage Tab to `CatalogEndpointDetail`

**File:** `src/features/catalog/components/CatalogTestCoverage.tsx` (new)

Full coverage detail for a single endpoint, shown as a tab in the endpoint detail view.

**Content:**
- Coverage status badge (covered/partial/untested)
- **Linked Harness Tests** table:
  | Feature Group | Scenario | Test Name | Status Codes Covered |
  |---|---|---|---|
  | Sales Auto Assign | VehiclePurchaseOffers | Happy Path | 200 |
  | Sales Auto Assign | VehiclePurchaseOffers | Error Path | 400, 404 |
- Each row is clickable → navigates to the test in Scenario Builder (Phase 7)
- **Missing Coverage** section:
  - Lists response codes from spec that have no corresponding test assertion
  - "Generate test for this status code" → opens Test Runner with this endpoint pre-selected

#### 4.6 Integrate `CatalogCoverageSummary` into `CatalogOverview.tsx`

**File:** `src/features/catalog/components/CatalogOverview.tsx`

**Step 1 — Accept `featureGroups` prop** from `ApiCatalog.tsx`
**Step 2 — Compute coverage** using `computeCoverage`
**Step 3 — Render `CatalogCoverageSummary`** in the overview panel, below the existing spec metadata section

#### 4.7 "Select Untested in Runner" Action

**Implementation flow:**

1. User clicks "Select Untested in Runner" in `CatalogCoverageSummary`
2. Handler computes the list of untested endpoint IDs from `coverageSummary.endpointCoverages.filter(c => c.status === 'untested')`
3. Triggers a cross-tab navigation:
   - Switches to the Test Runner tab (via the tab switching mechanism in `App.tsx`)
   - Sets `selectedCatalogEndpoints` to the untested endpoint IDs
   - Sets `catalogTestLevel` to `'contract'` (default for coverage runs)
4. This requires a **callback pattern** from `ApiCatalog` up through `App.tsx` to the `TestRunner` state.

**Step 1 — Add `onSelectInRunner` callback to `ApiCatalog` props:**

```typescript
interface ApiCatalogProps {
  // ... existing props ...
  onSelectInRunner?: (endpointIds: string[], level: GenerationLevel) => void;
}
```

**Step 2 — In `App.tsx`, implement the handler:**

```typescript
const handleSelectCatalogInRunner = useCallback((endpointIds: string[], level: GenerationLevel) => {
  setActiveTab('harness');                          // switch to Test Runner tab
  setSelectedCatalogEndpoints(new Set(endpointIds));
  setCatalogTestLevel(level);
}, []);
```

(This requires lifting `selectedCatalogEndpoints` and `catalogTestLevel` state to `App.tsx` instead of `useRunnerOrchestration`. Alternatively, use a ref-based command pattern.)

#### 4.8 Unit Tests

**File:** `src/features/catalog/utils/coverageAnalyzer.test.ts` (new)

| # | Test Case |
|---|---|
| 1 | Endpoint with no matching Harness tests → untested |
| 2 | Endpoint matched by `catalogEndpointId` → covered |
| 3 | Endpoint matched by `originalPath` + method → covered |
| 4 | Endpoint with some status codes covered → partial |
| 5 | Endpoint with all status codes covered → covered |
| 6 | Multiple tests covering same endpoint → merged coverage |
| 7 | Test with `validation.mode: 'none'` → `hasSchemaValidation: false` |
| 8 | Test with selective validation → `hasSchemaValidation: true` |
| 9 | Entry summary: correct totals and percentages |
| 10 | Empty feature groups → all endpoints untested |
| 11 | Feature groups with no `catalogMeta` → path/method fallback matching |
| 12 | Coverage percentage rounds correctly |

---

### Phase 5: Save to Harness Bridge

**Priority: Medium | Effort: Small**

After running catalog-backed virtual tests, allow users to persist them as permanent Harness tests.

#### 5.1 Detect Catalog-Backed Results

**File:** `src/features/results/utils/resultClassifier.ts` (new)

```typescript
export function isCatalogBackedResult(result: RequestResult): boolean {
  return !!result.scenario?.catalogMeta?.catalogEntryId;
}

export function getCatalogBackedResults(results: RequestResult[]): RequestResult[] {
  return results.filter(isCatalogBackedResult);
}
```

**Why:** Multiple components need to check if a result came from a catalog virtual test — the results dashboard, the "Save to Harness" button, and the per-test save icon.

#### 5.2 Create `SaveToHarnessModal.tsx`

**File:** `src/features/results/components/SaveToHarnessModal.tsx` (new)

**Props:**

```typescript
interface Props {
  scenarios: Scenario[];                     // catalog-backed scenarios to save
  featureGroups: FeatureGroup[];             // existing groups for target picker
  onSave: (targetFgId: string, targetScId: string, scenarios: Scenario[]) => void;
  onClose: () => void;
}
```

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  Save Catalog Tests to Harness                            │
│                                                           │
│  {N} tests from {spec name} will be saved as permanent   │
│  Harness tests.                                           │
│                                                           │
│  Target Feature Group: [▼ Sales Auto Assign     ]        │
│                        [ + Create New Group     ]        │
│                                                           │
│  Target Scenario:      [▼ VehiclePurchaseOffers ]        │
│                        [ + Create New Scenario  ]        │
│                                                           │
│  Tests to Save:                                           │
│  ☑ GET /vehicles/{vin}/… → 200 OK                        │
│  ☑ GET /vehicles/{vin}/… → 400 Invalid VIN               │
│  ☑ GET /vehicles/{vin}/… → 404 Not Found                 │
│                                                           │
│  [Cancel]  [Save {N} Tests →]                            │
└──────────────────────────────────────────────────────────┘
```

**Implementation steps:**

**Step 1 — Feature Group picker:**
- Dropdown listing existing `featureGroups` by name
- "+ Create New Group" option → shows inline text input
- Default: auto-suggest group matching the catalog entry name

**Step 2 — Scenario picker:**
- Dropdown listing scenarios within the selected feature group
- "+ Create New Scenario" option → shows inline text input
- Default: auto-suggest scenario matching the catalog endpoint's tag/folder name

**Step 3 — Test list:**
- Checkboxes for each scenario to save (all checked by default)
- Shows method badge + name for each

**Step 4 — Save action:**
- Strip the `catalogMeta` from scenarios? **No** — preserve it for traceability and future drift detection
- Generate new IDs for each scenario (to avoid ID collisions with the virtual versions)
- Call `onSave(targetFgId, targetScId, cleanedScenarios)`

**Step 5 — Parent integration:**

In the results page component that renders after a test run:
- Check if `getCatalogBackedResults(results).length > 0`
- If yes, show a "Save to Harness" button
- On click, open `SaveToHarnessModal` with the catalog-backed scenarios
- `onSave` calls the appropriate methods from `useScenarioMutations`:
  - If creating new group: `addFeatureGroup(newName)`, then `addScenario(fgId, scenarioName)`, then for each test: `saveTest(draft)` workflow
  - If using existing group/scenario: loop `saveTest` for each scenario

#### 5.3 Per-Test "Save" Icon

**Where:** In the test results table/list, for each result row where `isCatalogBackedResult(result)` is true.

**Implementation:**
- Small floppy-disk or "pin" icon button next to the result
- On click, opens a simplified `SaveToHarnessModal` pre-populated with just that one scenario
- Same save flow as bulk, but for a single test

#### 5.4 Unit Tests

| # | Test Case |
|---|---|
| 1 | `isCatalogBackedResult` returns true for results with `catalogMeta.catalogEntryId` |
| 2 | `isCatalogBackedResult` returns false for regular Harness results |
| 3 | `SaveToHarnessModal` renders with correct scenario count |
| 4 | Feature group dropdown lists existing groups |
| 5 | "Create New Group" shows inline input |
| 6 | Scenario dropdown filters by selected feature group |
| 7 | Unchecking a test excludes it from save |
| 8 | Save button calls `onSave` with correct target and scenarios |
| 9 | Saved scenarios get new IDs (not same as virtual IDs) |
| 10 | Saved scenarios preserve `catalogMeta` for traceability |

---

### Phase 6: Spec Drift Detection

**Priority: Medium | Effort: Small**

When a catalog spec is re-imported with changes, detect impact on existing Harness tests.

#### 6.1 Extend `CatalogSpecDiff` with Test Impact

**File:** `src/features/catalog/types/catalog.ts`

The existing `CatalogSpecDiff` type already tracks `added`, `removed`, and `changed` endpoints. Extend it with test impact information:

```typescript
export interface EndpointDiff {
  method: HttpMethod;
  path: string;
  changeType: EndpointChangeType;
  details?: string[];
  // NEW: test impact
  affectedTestCount?: number;
  affectedTests?: AffectedTestReference[];
}

export interface AffectedTestReference {
  featureGroupName: string;
  scenarioName: string;
  testName: string;
  testId: string;
  impactType: 'broken' | 'warning' | 'info';
  impactDescription: string;          // e.g., "Parameter 'country' was removed — test uses it"
}
```

#### 6.2 Create `driftAnalyzer.ts`

**File:** `src/features/catalog/utils/driftAnalyzer.ts` (new)

```typescript
export interface DriftReport {
  specDiff: CatalogSpecDiff;
  testImpact: DriftTestImpact;
  hasCriticalImpact: boolean;
  summary: string;
}

export interface DriftTestImpact {
  brokenTests: AffectedTestReference[];    // tests that reference removed endpoints/params
  warningTests: AffectedTestReference[];   // tests that may need updating (changed schemas)
  newUntested: EndpointDiff[];             // new endpoints with no tests
  totalAffectedTests: number;
}

export function analyzeDrift(
  oldSpec: CatalogEntry,
  newSpec: CatalogEntry,
  featureGroups: FeatureGroup[],
): DriftReport;
```

**Implementation steps:**

**Step 1 — Compute spec diff:**
Reuse or call the existing `CatalogSpecDiff` computation (already exists in `catalog.ts` types and presumably in the version comparison flow).

**Step 2 — Cross-reference with Harness tests:**

For each `removed` endpoint in the diff:
- Find Harness tests via `coverageAnalyzer`'s matching logic (by `catalogEndpointId` or path+method)
- Mark those tests as `impactType: 'broken'`
- Description: "Endpoint was removed in {newVersion}"

For each `changed` endpoint:
- Analyze the `details[]` to determine what changed (parameters, response schema, etc.)
- Find matching Harness tests
- If a removed parameter is used in the test URL or headers: `impactType: 'broken'`
- If response schema changed: `impactType: 'warning'` — assertions may need updating
- Description: specific change detail

For each `added` endpoint:
- Add to `newUntested` list — these are opportunities for new tests

**Step 3 — Determine severity:**
- `hasCriticalImpact = true` if any `brokenTests.length > 0`

#### 6.3 Enhance `CatalogRequestMeta` (if not already done in Phase 1)

Verify that `CatalogRequestMeta` has:
- `catalogEntryId?: string`
- `catalogEndpointId?: string`
- `catalogVersion?: string`

These are needed to match Harness tests back to their origin spec version for drift comparison.

#### 6.4 Create `DriftBanner.tsx`

**File:** `src/features/catalog/components/DriftBanner.tsx` (new)

Shown at the top of the Catalog tab after a spec re-import detects drift.

```
┌──────────────────────────────────────────────────────────┐
│ ⚠️ Spec Changed: v1.0.0 → v1.0.1                        │
│                                                           │
│ 2 Harness tests may be affected:                          │
│ • Parameter 'country' was removed — 1 test uses it       │
│ • Response schema for GET /offers changed — 1 test has   │
│   assertions on the old schema                            │
│                                                           │
│ 3 new endpoints have no tests.                            │
│                                                           │
│ [Review Affected Tests]  [Select New in Runner]  [✕]     │
└──────────────────────────────────────────────────────────┘
```

**Implementation:**

**Step 1 — Trigger:** After a new version is imported (in the existing `addVersionToEntry` flow in `useCatalog.ts`), run `analyzeDrift(oldEntry, newEntry, featureGroups)` and store the `DriftReport` in state.

**Step 2 — Display:** Show `DriftBanner` at the top of `ApiCatalog` when `driftReport` state is non-null and `driftReport.testImpact.totalAffectedTests > 0`.

**Step 3 — Actions:**
- "Review Affected Tests" → opens a modal listing all affected tests with impact descriptions, with links to navigate to each test
- "Select New in Runner" → calls `onSelectInRunner` with the new untested endpoint IDs
- "✕" → dismisses the banner (sets `driftReport` to null)

#### 6.5 Integration with Version Switching

When the user switches between spec versions (existing version dropdown in `ApiCatalog`), re-compute drift between the previous version's snapshot and the current version. This is a `useMemo` that depends on the current `entry` and `featureGroups`.

#### 6.6 Unit Tests

**File:** `src/features/catalog/utils/driftAnalyzer.test.ts` (new)

| # | Test Case |
|---|---|
| 1 | Removed endpoint with matching Harness tests → brokenTests populated |
| 2 | Removed endpoint with no matching tests → no impact |
| 3 | Changed parameter (removed) with test using it → brokenTests |
| 4 | Changed response schema → warningTests |
| 5 | Added endpoints → newUntested populated |
| 6 | No changes → empty report, hasCriticalImpact: false |
| 7 | Multiple changes across multiple endpoints → aggregated correctly |
| 8 | Tests matched by catalogEndpointId → found |
| 9 | Tests matched by path+method fallback → found |
| 10 | Summary string is human-readable |

---

### Phase 7: Bidirectional Navigation

**Priority: Medium | Effort: Small**

Cross-linking between Catalog and Harness for seamless navigation.

#### 7.1 "View in Catalog" from Harness (Scenario Builder)

**File:** `src/features/scenarios/components/TestEditorModal.tsx`

**Step 1 — Detect catalog origin:**
When the `editingTest` (draft `Scenario`) has `catalogMeta?.catalogEntryId` and `catalogMeta?.catalogEndpointId`, show a "View in Catalog" link.

**Step 2 — Add link:**
Below the test name or in the test editor header:
```
📋 From: Sales Auto Assign v1.0.0 → GET /vehicles/{vin}/...
[View in Catalog →]
```

**Step 3 — Navigation handler:**
- The link needs to switch to the Catalog tab and select the correct entry + endpoint
- Add `onNavigateToCatalog?: (entryId: string, endpointId: string) => void` callback prop
- Thread it up through `ScenarioBuilder.tsx` → `App.tsx`
- In `App.tsx`: switch to the Catalog tab, set `selectedEntryId` and `selectedEndpointId` in `useCatalog` state

#### 7.2 "View Tests" from Catalog Endpoint Detail

**File:** `src/features/catalog/components/CatalogTestCoverage.tsx` (from Phase 4.5)

In the coverage detail table, each linked Harness test row should be clickable:
- Click → navigate to Scenario Builder tab → scroll to the feature group → expand the scenario → highlight the test
- Add `onNavigateToTest?: (featureGroupId: string, scenarioId: string, testId: string) => void` callback
- Thread through `CatalogEndpointDetail` → `ApiCatalog` → `App.tsx`
- In `App.tsx`: switch to the Scenario Builder tab, set focus state

#### 7.3 "Run in Harness" from Catalog Endpoint Detail

**File:** `src/features/catalog/components/CatalogEndpointDetail.tsx`

**Step 1 — Add "Run in Harness" button** in the detail view top bar (next to "Send"):

```
[▶ Send]  [Run in Harness →]  [cURL]
```

**Step 2 — Handler:**
- Calls `onSelectInRunner?.([endpoint.id], catalogTestLevel)` (from Phase 4.7's callback pattern)
- Switches to Test Runner tab
- Auto-selects just this one endpoint in the CATALOG SPECS section
- User can immediately click "▶ Run"

**Step 3 — Also add "Run in Harness" to `CatalogEndpointCard.tsx`:**

Add a small icon button or menu item in each endpoint card in the browser view:
- Click → same handler as above, but only for this one endpoint

#### 7.4 "View in Catalog" from Test Results

**File:** Results dashboard component (where `RequestResult` rows are displayed)

For results that have `catalogMeta`:
- Show a small "📋" icon or "View Spec" link
- Click → navigate to Catalog tab → endpoint detail view

#### 7.5 Navigation State Management

All cross-tab navigation requires a coordinated state mechanism in `App.tsx`:

```typescript
// Navigation command pattern
interface NavigationCommand {
  target: 'catalog' | 'harness' | 'test-runner' | 'scenario-builder';
  payload?: {
    catalogEntryId?: string;
    catalogEndpointId?: string;
    featureGroupId?: string;
    scenarioId?: string;
    testId?: string;
    selectedCatalogEndpoints?: string[];
    catalogTestLevel?: GenerationLevel;
  };
}

const [pendingNavigation, setPendingNavigation] = useState<NavigationCommand | null>(null);
```

When a component sets `pendingNavigation`:
1. `App.tsx` switches the active tab
2. The target tab component reads `pendingNavigation` from props and applies the focus/selection
3. `App.tsx` clears `pendingNavigation` after the target component acknowledges it

This avoids deeply threading state across unrelated components and keeps the cross-tab communication centralized.

#### 7.6 Unit Tests

| # | Test Case |
|---|---|
| 1 | TestEditorModal shows "View in Catalog" link when test has catalogMeta |
| 2 | TestEditorModal hides link when test has no catalogMeta |
| 3 | Clicking "View in Catalog" calls onNavigateToCatalog with correct IDs |
| 4 | CatalogTestCoverage rows are clickable and call onNavigateToTest |
| 5 | "Run in Harness" button in endpoint detail calls onSelectInRunner |
| 6 | "Run in Harness" navigates to Test Runner tab |
| 7 | Results view shows "View Spec" for catalog-backed results |
| 8 | NavigationCommand correctly switches tabs and applies payload |

---

## 4. Implementation Priority & Sequencing

```
Phase 1 (testGenerator engine)
    │
    ▼
Phase 2 (Virtual Test Source in ScenarioSelector + buildSelectedTests)
    │
    ├──────────────────────────┐
    ▼                          ▼
Phase 3 (Detail View)    Phase 4 (Coverage Tracking)
    │                          │
    ▼                          ▼
Phase 5 (Save to Harness)   Phase 6 (Drift Detection)
    │                          │
    └──────────┬───────────────┘
               ▼
         Phase 7 (Navigation)
```

| Phase | Priority | Effort | Depends On | What Changes |
|---|---|---|---|---|
| 1. Test Generator Engine | Critical | S-M | — | New types + utilities only. No UI changes. No engine changes. |
| 2. Virtual Test Source | Critical | M | Phase 1 | `ScenarioSelector`, `buildSelectedTests`, `useRunnerOrchestration`, `TestRunner`, `ParameterizedRunner`, `App` |
| 3. Detail View + Schema Match | High | M | Phase 1 | New catalog components. No Test Runner changes. |
| 4. Coverage Tracking | High | M | Phase 1, Phase 2 | New catalog utility + UI. Cross-tab "Select Untested" requires Phase 2's catalog selection state. |
| 5. Save to Harness | Medium | S | Phase 2 | Results UI addition. Uses existing `useScenarioMutations`. |
| 6. Drift Detection | Medium | S | Phase 4 | Catalog re-import enhancement. Reuses coverage matching logic. |
| 7. Bidirectional Nav | Medium | S | Phase 3, Phase 4 | Cross-link UI additions. Requires NavigationCommand pattern. |

**Phase 1 + 2 are the critical path.** Once complete, users can select catalog endpoints in the Test Runner and execute them. Phases 3-7 add polish, visibility, and deeper integration.

**Estimated total new files:** ~15 files (types, utilities, components, tests)
**Estimated modified files:** ~10 files (existing components receiving new props/sections)

---

## 5. Component Architecture

### New Components

| Component | Path | Phase | Purpose |
|---|---|---|---|
| `CatalogEndpointDetail` | `src/features/catalog/components/CatalogEndpointDetail.tsx` | 3 | Spec-aware endpoint detail view |
| `CatalogSpecContract` | `src/features/catalog/components/CatalogSpecContract.tsx` | 3 | Expected responses, schemas from spec |
| `CatalogSchemaMatch` | `src/features/catalog/components/CatalogSchemaMatch.tsx` | 3 | Response vs spec validation |
| `CatalogTestCoverage` | `src/features/catalog/components/CatalogTestCoverage.tsx` | 4 | Linked tests, missing coverage |
| `CatalogCoverageSummary` | `src/features/catalog/components/CatalogCoverageSummary.tsx` | 4 | Overview-tab coverage widget |
| `DriftBanner` | `src/features/catalog/components/DriftBanner.tsx` | 6 | Spec change notification banner |
| `SaveToHarnessModal` | `src/features/results/components/SaveToHarnessModal.tsx` | 5 | Target picker + save flow |

### New Utilities

| Utility | Path | Phase | Purpose |
|---|---|---|---|
| `testGenerator` | `src/features/catalog/utils/testGenerator.ts` | 1 | `CatalogEndpoint` → `Scenario[]` with spec-derived assertions |
| `catalogEndpointCollector` | `src/features/catalog/utils/catalogEndpointCollector.ts` | 1 | Flatten recursive folder tree to `TaggedEndpoint[]` |
| `catalogTestCount` | `src/features/catalog/utils/catalogTestCount.ts` | 2 | Count tests without generating full scenarios |
| `schemaValidator` | `src/features/catalog/utils/schemaValidator.ts` | 3 | Response vs spec schema validation |
| `coverageAnalyzer` | `src/features/catalog/utils/coverageAnalyzer.ts` | 4 | Endpoint coverage from Harness data |
| `driftAnalyzer` | `src/features/catalog/utils/driftAnalyzer.ts` | 6 | Spec change → test impact analysis |
| `resultClassifier` | `src/features/results/utils/resultClassifier.ts` | 5 | Detect catalog-backed test results |

### New Types

| Type File | Path | Phase | Purpose |
|---|---|---|---|
| `coverage.ts` | `src/features/catalog/types/coverage.ts` | 4 | `EndpointCoverage`, `EntryCoverageSummary`, etc. |

### Modified Components

| Component | Phase | Changes |
|---|---|---|
| `Scenario` type in `index.ts` | 1 | Add optional `catalogMeta?: CatalogRequestMeta` |
| `CatalogRequestMeta` in `index.ts` | 1 | Add `catalogEntryId`, `catalogEndpointId`, `catalogVersion` |
| `ScenarioSelector.tsx` | 2 | New "CATALOG SPECS" section, catalog selection state, level picker |
| `buildSelectedTests.ts` | 2 | New branch for catalog-backed endpoint → `Scenario` generation |
| `useRunnerOrchestration.ts` | 2 | Catalog state + pass to `buildSelectedTests` |
| `TestRunner.tsx` | 2 | Accept + forward `catalogEntries` and catalog config props |
| `ParameterizedRunner.tsx` | 2 | Same as TestRunner changes |
| `App.tsx` | 2, 4, 7 | Pass `catalog.entries` to runners, resolve catalog URL/auth, NavigationCommand state |
| `ApiCatalog.tsx` | 3, 4, 6 | Endpoint detail view state, coverage data, drift banner |
| `CatalogEndpointBrowser.tsx` | 4 | Coverage badges per endpoint card |
| `CatalogOverview.tsx` | 4 | Coverage summary widget |
| `CatalogEndpointCard.tsx` | 7 | "Run in Harness" button |
| `TestEditorModal.tsx` | 7 | "View in Catalog" link |
| `EndpointDiff` type in `catalog.ts` | 6 | Add test impact fields |

---

## 6. End-to-End Data Flow

### Complete Run: Harness + Catalog Mixed

```
User opens Test Runner
    │
    ▼
ScenarioSelector renders:
  FeatureGroup[] → YOUR TESTS section
  CatalogEntry[] → CATALOG SPECS section (new, Phase 2)
    │
    ▼
User selects:
  ☑ VehiclePurchaseOffers (Harness — 2 hand-built tests)
  ☑ Offers Static Metadata (Catalog — 3 endpoints)
  Level: Contract
    │
    ▼
User clicks [▶ Run]
    │
    ▼
useRunnerOrchestration.handleRun()
    │
    ▼
buildSelectedTests(featureGroups, selectedScenarios, ...,
                   catalogEntries, selectedCatalogEndpoints, 'contract', ...)
    │
    ├─ Loop 1: FeatureGroup[] → 2 hand-built Scenarios (unchanged logic)
    │   Uses: resolveAuth(), replaceHost()
    │
    ├─ Loop 2: CatalogEntry[] → selectedCatalogEndpoints → testGenerator
    │   Uses: collectAllEndpoints(), generateTestsFromEndpoint()
    │   ├─ POST /save/static-offers → [Scenario: 200, Scenario: 400]
    │   ├─ GET /metadata/offers-details → [Scenario: 200, Scenario: 404]
    │   └─ POST /manage/static-offers-details → [Scenario: 200, Scenario: 400, Scenario: 500]
    │
    └─ Merged: 2 + 7 = 9 SelectedTest[] (same type, same interface)
    │
    ▼
handleRun() continues (unchanged):
  Tag filter → scenarioWeights → TestConfig
    │
    ▼
TestConfig built:
  scenarioWeights: 9 entries (weight 1 each)
  executionMode: 'sequential' (or whatever user configured)
  concurrency: N
  iterations: M
    │
    ▼
resolveSharedDataSources(testsToRun, sharedDataSources) → no-op for catalog tests
    │
    ▼
executor.execute(config, resolvedTests, { envName, svcName, baseUrl })
    │  ← UNCHANGED: executor receives Scenario[], doesn't know about catalog
    ▼
Results: 9 RequestResult[]
  ├─ 2 from Harness tests (featureGroupName: "Sales Auto Assign")
  └─ 7 from Catalog tests (featureGroupName: "Sales Auto Assign Products v1.0.0")
    │
    ▼
Results Dashboard shows all 9 results
  ├─ Grouped by featureGroupName → groupName (standard grouping)
  ├─ Catalog-backed results detected by isCatalogBackedResult()
  ├─ [Save to Harness] action shown for catalog results (Phase 5)
  ├─ [View Spec] link for catalog results (Phase 7)
  └─ Normal export/report functionality (unchanged)
```

---

## 7. Why This Is Different From Requests (Decision Matrix)

| User Question | **Requests** | **Catalog (Virtual Test Source)** |
|---|---|---|
| "What endpoints does this API have?" | Only what I created | Full spec — all operations |
| "Which endpoints have I tested?" | No tracking | Coverage matrix: 5/8 tested |
| "Does the response match the contract?" | I don't know the contract | Schema validation: ✓ / ✗ |
| "What assertions should I add?" | You build them | Auto-generated from spec schemas |
| "The spec changed — are tests valid?" | No idea | Drift detection with impact report |
| "Run all spec endpoints as tests" | Impossible | Check CATALOG SPECS → Run |
| "Mix my custom tests with spec tests" | N/A | Both in same ScenarioSelector |
| "Tests always reflect current spec" | N/A | Yes — regenerated each run |

---

## 8. Testing Strategy

### Unit Tests

| Test File | Phase | Coverage Targets |
|---|---|---|
| `testGenerator.test.ts` | 1 | All 3 levels, assertion generation, URL construction, schema walking, edge cases (25 cases) |
| `catalogEndpointCollector.test.ts` | 1 | Recursive folder traversal, root endpoints, empty entries |
| `catalogTestCount.test.ts` | 2 | Count accuracy for basic/contract/full levels |
| `buildSelectedTests.test.ts` (update) | 2 | Catalog branch: generation, merging, empty selections, regression (10 cases) |
| `ScenarioSelector.test.tsx` (update) | 2 | Catalog section rendering, selection, level switching, count display (13 cases) |
| `schemaValidator.test.ts` | 3 | Type matching, enum validation, missing/extra fields, nested objects, arrays (14 cases) |
| `CatalogEndpointDetail.test.tsx` | 3 | Spec contract, schema match, param editing, send (11 cases) |
| `coverageAnalyzer.test.ts` | 4 | Path/method matching, coverage status, test linking, percentages (12 cases) |
| `resultClassifier.test.ts` | 5 | Catalog-backed detection |
| `SaveToHarnessModal.test.tsx` | 5 | Target picker, save flow (10 cases) |
| `driftAnalyzer.test.ts` | 6 | Spec change → test impact, severity (10 cases) |

### E2E Tests

| Scenario | Phase | Steps |
|---|---|---|
| Catalog → Runner → Execute | 2 | Import spec → open Runner → select catalog endpoints → set level → run → verify results show method/path names |
| Mixed Harness + Catalog run | 2 | Create Harness test + select catalog endpoints → run → verify merged results with correct grouping |
| Level switching | 2 | Select endpoints → switch basic → contract → full → verify test count changes in selector |
| Endpoint detail + Schema Match | 3 | Click endpoint → verify params/body/spec contract tabs → Send → verify Schema Match tab |
| Coverage matrix | 4 | Import spec + create matching Harness test → verify coverage badge on endpoint → verify summary widget |
| Save to Harness after run | 5 | Run catalog tests → click Save to Harness → pick target → verify tests appear in Scenario Builder |
| Drift detection | 6 | Import spec v1 → create Harness test → import v2 with removed endpoint → verify drift banner |
| Cross-tab navigation | 7 | Click "View in Catalog" from Harness → verify tab switch + correct endpoint selected |

---

## 9. Design Principles

1. **Catalog ≠ Requests.** Catalog is spec-aware; Requests is freeform. They serve different purposes.

2. **Spec is the source of truth.** Virtual tests are regenerated from the live spec every run. No stale copies.

3. **Unified runner.** Users shouldn't need a separate "contract test runner." Catalog specs are a second test source in the same Test Runner they already know.

4. **Zero engine changes.** The executor receives `Scenario[]`. It doesn't know or care about the source. All conversion happens in `buildSelectedTests`.

5. **Opt-in persistence.** Virtual tests are ephemeral by default. "Save to Harness" makes them permanent when the user explicitly wants it.

6. **Coverage drives action.** The coverage matrix motivates users to select untested endpoints. "Select Untested in Runner" is one click to action.

7. **Use existing assertion infrastructure.** No new operators needed — `ExpectedField` with `FieldOperator` already supports `is_type`, `exists`, `in`, `regex`. The test generator uses `selective` validation mode with `ExpectedField[]` for rich assertions.

8. **Centralized navigation.** Cross-tab navigation uses a `NavigationCommand` pattern in `App.tsx` to avoid deeply threading callbacks.

---

## 10. Competitive Analysis

### 10.1 Market Landscape

The API testing market has several tools that address parts of the OpenAPI-to-test workflow. This section analyzes competitors to validate our approach and identify differentiation opportunities.

### 10.2 Commercial Tools

| Tool | Vendor | Pricing | Key Approach |
|------|--------|---------|--------------|
| **ReadyAPI** | SmartBear | $$$$ (Enterprise) | Full-featured desktop IDE with AI-powered test generation, coverage dashboards |
| **Postman + Portman** | Postman Labs | Freemium | Collection-centric; Portman CLI converts OpenAPI → Postman tests |
| **noSwag** | noSwag.io | SaaS | AI-powered test generation, exports to pytest/Postman |
| **Pactflow** | SmartBear | $$$$ | Consumer-driven contract testing with Pact broker |
| **Swagger Contract Testing** | SmartBear | Part of Swagger tooling | AI-powered Pact generation from specs |

#### ReadyAPI (SmartBear)

**Strengths:**
- ✅ Comprehensive coverage tracking (parameters, payloads, response codes)
- ✅ AI-powered test generation from natural language + spec
- ✅ Visual dashboard with coverage metrics
- ✅ Enterprise features (team collaboration, CI/CD integration)

**Weaknesses:**
- ❌ Tests are **separate artifacts** from the spec (not virtual)
- ❌ Expensive enterprise licensing
- ❌ Windows-centric desktop application
- ❌ No mixed hand-built + spec-generated test runs

**Our Differentiator:** Virtual test source that regenerates tests from live spec each run, eliminating stale test copies.

#### Postman + Portman

**Strengths:**
- ✅ Portman generates contract tests with minimal config
- ✅ Familiar Postman UI for test execution
- ✅ Good CI/CD integration via Postman CLI

**Weaknesses:**
- ❌ **One-way export** — OpenAPI → Postman collection (no sync)
- ❌ No coverage tracking built-in
- ❌ No drift detection
- ❌ Tests become disconnected from spec after generation

**Our Differentiator:** Bidirectional flow — tests stay connected to spec, can be saved to Harness when needed.

#### Pactflow

**Strengths:**
- ✅ Industry-standard contract testing
- ✅ Broker-based verification between services
- ✅ Can generate Pact contracts from OpenAPI

**Weaknesses:**
- ❌ **Consumer-driven** — requires coordinating producer/consumer
- ❌ Focused on inter-service contracts, not API testing
- ❌ Complex setup for simple use cases
- ❌ No GUI for interactive testing

**Our Differentiator:** Simpler provider-side testing with immediate execution, no broker setup required.

### 10.3 Open-Source Tools

| Tool | Language | Key Approach | GitHub Stars |
|------|----------|--------------|--------------|
| **Dredd** | Node.js | Spec-as-test — validates API against documented examples | ~4.1k |
| **Schemathesis** | Python | Property-based fuzzing from OpenAPI schemas | ~2.2k |
| **Portman** | Node.js | OpenAPI → Postman collection converter | ~700 |
| **swagger-coverage** | Python | Coverage reporting for pytest + requests | ~200 |
| **TraceCov** | Web | Schema-level coverage analysis | New |

#### Dredd — **Closest Conceptual Match**

**How it works:**
```bash
dredd api-description.yml http://127.0.0.1:3000
```
Dredd treats the spec as the test. It makes HTTP requests based on documented examples and validates responses match the spec.

**Strengths:**
- ✅ **Spec IS the test** — no separate test creation (similar to our virtual source)
- ✅ Automatic drift detection (tests fail when spec changes)
- ✅ Multiple language hooks for setup/teardown

**Weaknesses:**
- ❌ **CLI-only** — no GUI, no interactive experience
- ❌ No mixed test sources (can't combine with hand-built tests)
- ❌ Limited assertion customization (pass/fail only)
- ❌ No coverage tracking beyond pass/fail
- ❌ No "Save to permanent test" capability
- ❌ Maintenance concerns (less active development)

**Our Differentiator:** GUI-integrated experience with 3-level assertions (basic/contract/full), mixed test runs, and Save to Harness capability.

#### Schemathesis — **Most Sophisticated**

**How it works:**
```bash
schemathesis run https://api.example.com/openapi.json
```
Uses property-based testing (Hypothesis) to generate thousands of test cases from schema constraints.

**Strengths:**
- ✅ **Tests regenerated fresh each run** (like our virtual source)
- ✅ Property-based fuzzing finds edge cases humans miss
- ✅ Schema-level coverage tracking
- ✅ Adaptive testing learns from responses
- ✅ Active development and community

**Weaknesses:**
- ❌ **Fuzzing-focused** — finds crashes/500s, not contract validation
- ❌ CLI/Python only — no GUI
- ❌ Can't mix with hand-built tests
- ❌ No human-readable test names (generated hashes)
- ❌ Overkill for simple "does endpoint return 200?" testing

**Our Differentiator:** Contract testing focus with human-readable tests, GUI integration, and explicit control over assertion depth.

#### swagger-coverage / TraceCov — **Coverage-Only**

**How they work:**
Record HTTP traffic during test runs and compare against OpenAPI spec to calculate coverage.

**Strengths:**
- ✅ Detailed coverage metrics (endpoints, parameters, status codes, schema keywords)
- ✅ Works with any test framework (passive recording)
- ✅ TraceCov has beautiful visualizations

**Weaknesses:**
- ❌ **Coverage only** — doesn't generate tests
- ❌ Requires separate test execution tool
- ❌ No assertions, just measurement

**Our Differentiator:** Integrated test generation + coverage in one tool.

### 10.4 Feature Comparison Matrix

| Capability | ReadyAPI | Postman+Portman | Dredd | Schemathesis | **RedfireForge (Planned)** |
|------------|----------|-----------------|-------|--------------|---------------------------|
| **GUI Test Selection** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Virtual Test Source** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Mixed Test Runs** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **3-Level Assertions** | ⚠️ Manual | ⚠️ Manual | ❌ | ❌ | ✅ |
| **Coverage Tracking** | ✅ | ⚠️ Via Portman | ❌ | ✅ | ✅ |
| **Drift Detection** | ⚠️ Manual | ❌ | ✅ Auto | ✅ Auto | ✅ With test impact |
| **Save to Permanent** | N/A | ❌ | ❌ | ❌ | ✅ |
| **Bidirectional Nav** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Load Testing** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Schema Validation** | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| **Cost** | $$$$ | Free/$$$ | Free | Free | Free (OSS) |

### 10.5 Unique Value Proposition

Based on competitive analysis, RedfireForge's Catalog ↔ Harness integration offers a **unique combination** not found in any single tool:

1. **Virtual + Permanent in One Tool**
   - Competitors: Either spec-as-test (Dredd/Schemathesis) OR separate test artifacts (Postman/ReadyAPI)
   - RedfireForge: Both — start virtual, save to permanent when needed

2. **Mixed Test Runs**
   - Competitors: Run spec tests OR hand-built tests separately
   - RedfireForge: Mix both in same ScenarioSelector, same execution, same results

3. **GUI-Integrated Contract Testing**
   - Competitors: CLI tools (Dredd, Schemathesis) or expensive enterprise (ReadyAPI)
   - RedfireForge: Free GUI with interactive test selection

4. **Assertion Level Control**
   - Competitors: All-or-nothing (full schema validation or pass/fail)
   - RedfireForge: User-selectable basic/contract/full depth

5. **Drift Detection with Test Impact**
   - Competitors: Drift breaks tests (Dredd) or no drift detection (Postman)
   - RedfireForge: "Parameter 'country' removed — 2 tests affected" with navigation

6. **Load Testing Integration**
   - Competitors: Separate load testing tools
   - RedfireForge: Same catalog virtual tests can run in load-profile mode

### 10.6 Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| **Schemathesis is "good enough"** | Target users who want GUI + mixed tests, not CLI power users |
| **ReadyAPI has more features** | Position as free OSS alternative with virtual source innovation |
| **Users prefer Postman workflow** | Support Postman collection export from catalog tests |
| **Contract testing is niche** | Market as "spec coverage" and "API documentation validation" |

### 10.7 Future Competitive Features (Inspired by Research)

| Feature | Inspired By | Priority | Description |
|---------|-------------|----------|-------------|
| **Fuzz Testing Mode** | Schemathesis | Medium | Add `fuzz` level that generates boundary/negative cases |
| **HAR Import for Coverage** | TraceCov | Low | Import HAR recordings to auto-match traffic to spec |
| **Pact Export** | Pactflow | Low | Export generated tests as Pact contracts |
| **Spec Linting** | Spectral | Medium | Lint spec quality before test generation |
| **Adaptive Testing** | Schemathesis | Future | Learn from responses to refine test cases |

---

## 11. Future Enhancements (Out of Scope)

| Feature | Description | When |
|---|---|---|
| Contract test scheduling | Run catalog contract tests on a schedule | After Phase 2 |
| Schema evolution tracking | Track how schemas change across spec versions | After Phase 6 |
| Mock server from spec | Generate mock responses for offline testing | Future |
| Spec-driven parameterized tests | Generate CSV from spec parameter enums/examples | After Phase 2 |
| Coverage CI gate | `--fail-if-coverage-below 80%` in CLI | After Phase 4 |
| Contract test in CLI | `redfireforge contract spec.yaml --level full` | After Phase 2 |
| Catalog virtual source in Workflow Runner | Select catalog endpoints as HTTP nodes in workflow tests | Future |
| Per-entry host/auth in Test Runner | Let user configure different host/auth per catalog entry in the runner | After Phase 2 |
| Fuzz testing mode | Add `fuzz` level with boundary/negative test generation (inspired by Schemathesis) | After Phase 2 |
| HAR import for coverage | Import HAR recordings to auto-match traffic to spec (inspired by TraceCov) | Future |
| Pact export | Export generated tests as Pact contracts (inspired by Pactflow) | Future |
| Spec linting integration | Lint spec quality before test generation (inspired by Spectral) | After Phase 1 |

---

## 12. Implementation Status Audit (2026-05-16)

### Current Codebase State

| Component | Planned Location | Status | Notes |
|---|---|---|---|
| **Phase 1: Test Generator Engine** ||||
| `catalogMeta` on `Scenario` type | `src/shared/types/index.ts` | ❌ **Missing** | `catalogMeta` exists on `RequestItem` (line 830) but NOT on `Scenario` (lines 300-327). Must add. |
| `catalogEntryId`, `catalogEndpointId`, `catalogVersion` on `CatalogRequestMeta` | `src/shared/types/index.ts` | ❌ **Missing** | `CatalogRequestMeta` (lines 778-797) only has `sourceSpec`. Must add all three fields. |
| `schemaStubGenerator.ts` | `src/features/catalog/utils/schemaStubGenerator.ts` | ✅ **Exists** | `generateStub()` and `generateStubJson()` implemented with allOf/oneOf/anyOf support. Can be reused. |
| `catalogEndpointCollector.ts` | `src/features/catalog/utils/catalogEndpointCollector.ts` | ❌ **Not created** | Note: Similar `collectEndpoints()` exists in `catalogSpecDiff.ts` (line 3-13) but lacks `tagName`/`folderId` tracking. Extract + enhance. |
| `testGenerator.ts` | `src/features/catalog/utils/testGenerator.ts` | ❌ **Not created** | |
| **Phase 2: Virtual Test Source** ||||
| `catalogTestCount.ts` | `src/features/catalog/utils/catalogTestCount.ts` | ❌ **Not created** | |
| `ScenarioSelector` catalog section | `src/features/test-runner/components/ScenarioSelector.tsx` | ❌ **Not implemented** | Currently only renders YOUR TESTS and Gallery sections. |
| `buildSelectedTests` catalog branch | `src/features/test-runner/utils/buildSelectedTests.ts` | ❌ **Not implemented** | Currently only processes `FeatureGroup[]`. |
| `useRunnerOrchestration` catalog state | `src/features/test-runner/hooks/useRunnerOrchestration.ts` | ❌ **Not implemented** | No catalog-related state or props. |
| `TestRunner` catalog props | `src/features/test-runner/TestRunner.tsx` | ❌ **Not implemented** | Props don't include `catalogEntries`. |
| `ParameterizedRunner` catalog props | `src/features/test-runner/ParameterizedRunner.tsx` | ❌ **Not implemented** | Props don't include `catalogEntries`. |
| `App.tsx` catalog→runner pass-through | `src/app/App.tsx` | ❌ **Not implemented** | `<TestRunner>` (lines 712-723) doesn't receive `catalogEntries`. Catalog entries available via `catalog.entries` from `useCatalog`. |
| **Phase 3: Endpoint Detail View** ||||
| `CatalogEndpointDetail.tsx` | `src/features/catalog/components/CatalogEndpointDetail.tsx` | ❌ **Not created** | |
| `CatalogSpecContract.tsx` | `src/features/catalog/components/CatalogSpecContract.tsx` | ❌ **Not created** | |
| `CatalogSchemaMatch.tsx` | `src/features/catalog/components/CatalogSchemaMatch.tsx` | ❌ **Not created** | |
| `schemaValidator.ts` | `src/features/catalog/utils/schemaValidator.ts` | ❌ **Not created** | |
| **Phase 4: Coverage Tracking** ||||
| `coverage.ts` types | `src/features/catalog/types/coverage.ts` | ❌ **Not created** | |
| `coverageAnalyzer.ts` | `src/features/catalog/utils/coverageAnalyzer.ts` | ❌ **Not created** | |
| `CatalogCoverageSummary.tsx` | `src/features/catalog/components/CatalogCoverageSummary.tsx` | ❌ **Not created** | |
| `CatalogTestCoverage.tsx` | `src/features/catalog/components/CatalogTestCoverage.tsx` | ❌ **Not created** | |
| **Phase 5: Save to Harness** ||||
| `resultClassifier.ts` | `src/features/results/utils/resultClassifier.ts` | ❌ **Not created** | |
| `SaveToHarnessModal.tsx` | `src/features/results/components/SaveToHarnessModal.tsx` | ❌ **Not created** | |
| **Phase 6: Drift Detection** ||||
| `driftAnalyzer.ts` | `src/features/catalog/utils/driftAnalyzer.ts` | ❌ **Not created** | |
| `DriftBanner.tsx` (catalog) | `src/features/catalog/components/DriftBanner.tsx` | ❌ **Not created** | Note: A different `DriftBanner.tsx` exists for Data Mapper schema drift. |
| `EndpointDiff` test impact fields | `src/features/catalog/types/catalog.ts` | ❌ **Not added** | `EndpointDiff` exists (line 167) but lacks `affectedTestCount` and `affectedTests`. |
| **Phase 7: Bidirectional Navigation** ||||
| NavigationCommand pattern | `src/app/App.tsx` | ❌ **Not implemented** | |
| "View in Catalog" from Harness | `src/features/scenarios/components/TestEditorModal.tsx` | ❌ **Not implemented** | |
| "Run in Harness" from Catalog | `src/features/catalog/components/CatalogEndpointDetail.tsx` | ❌ **Not created** | |

### Existing Infrastructure to Reuse

| Component | Location | How to Reuse |
|---|---|---|
| `schemaStubGenerator.ts` | `src/features/catalog/utils/schemaStubGenerator.ts` | Call `generateStub()` in `testGenerator.ts` for request body generation. Already handles allOf/oneOf/anyOf, format-aware string stubs (date-time, email, uuid, uri, ipv4, ipv6). |
| `catalogSpecDiff.ts` | `src/features/catalog/utils/catalogSpecDiff.ts` | Provides `diffCatalogEntries()` for spec diff computation. **Also has internal `collectEndpoints()` (line 3-13) that does folder traversal** — consider extracting to shared `catalogEndpointCollector.ts`. |
| `catalogCurlGenerator.ts` | `src/features/catalog/utils/catalogCurlGenerator.ts` | **Key functions:** `buildFullUrl()` (line 154-175) for URL + path param + query construction, `resolveBaseUrl()` (line 123-152) for host resolution. `testGenerator.ts` should import these directly. |
| `replaceHost()` | `src/shared/utils/urlUtils.ts` | Already used in `buildSelectedTests.ts` for host override. Same pattern for catalog tests. |
| `resolveAuth()` | `src/features/requests/utils/authResolver.ts` | May need adaptation for catalog auth resolution. |
| `ExpectedField` operators | `src/engine/fieldOperatorEvaluation.ts` | All operators confirmed: `is_type` (line 187), `exists` (line 181), `in` (line 196), `regex` (line 135). No new validators needed. |
| `FieldOperator` type | `src/shared/types/index.ts` (lines 48-72) | Includes: `is_type`, `exists`, `in`, `not_in`, `regex`, plus 18 others. Full operator set available. |

### Key Blockers for Phase 1

Before any other phase can proceed, these must be completed:

1. **Add `catalogMeta` to `Scenario` interface** (critical path)
   - Without this, generated scenarios cannot carry traceability metadata
   - Affects: coverage tracking, save-to-harness, drift detection, navigation

2. **Extend `CatalogRequestMeta` with entry/endpoint IDs** (critical path)
   - Add `catalogEntryId?: string`
   - Add `catalogEndpointId?: string`  
   - Add `catalogVersion?: string`
   - These enable cross-referencing between generated tests and their spec origin

3. **Create `collectAllEndpoints` helper** (dependency for test generator)
   - Flattens nested `CatalogFolder[]` tree to `TaggedEndpoint[]`
   - Used by: testGenerator, ScenarioSelector rendering, coverageAnalyzer

4. **Create `testGenerator.ts`** (core engine)
   - The 3-level generation logic (basic/contract/full)
   - URL construction with path param substitution
   - Assertion generation using `ExpectedField[]`

### Recommendation: Implementation Order

```
Week 1: Phase 1.1-1.4 (Type updates + testGenerator + tests)
        ↓
Week 2: Phase 2.1-2.4 (ScenarioSelector + buildSelectedTests)
        ↓
Week 3: Phase 2.5-2.8 (Runner integration + App.tsx wiring)
        ↓
Week 4: Phase 3 (Detail view + schema validation)
        ↓
Week 5: Phase 4 (Coverage tracking)
        ↓
Week 6: Phase 5-6 (Save to Harness + Drift detection)
        ↓
Week 7: Phase 7 (Bidirectional navigation polish)
```

---

## 13. Data Mapper Integration

### 13.1 Overview

The **Data Mapper** component is a visual tool for creating field-level mappings and validation rules. It has an **adapter pattern** that allows different use cases to plug into the same visual UI. The existing `validationAdapter.ts` already bridges the Data Mapper to the validation workflow.

**Unified Experience Principle:** Users should configure assertions for catalog-generated tests using the **exact same Data Mapper UI** they use for hand-built Harness tests. No separate "catalog assertion editor" — just one tool, one workflow, one learning curve.

**Key Integration Opportunity:** Instead of generating `ExpectedField[]` assertions in `testGenerator.ts` with hardcoded logic, we can leverage the Data Mapper's existing infrastructure to:

1. **Visually configure assertions** for catalog-generated tests — same UI as Harness
2. **Reuse the DSL parser/serializer** (`validationDsl.ts`) for code view — same syntax
3. **Leverage operator evaluation** already implemented in `fieldOperatorEvaluation.ts` — same 24 operators

### 13.2 Existing Data Mapper Capabilities (Reusable)

| Component | Location | How It Helps |
|-----------|----------|--------------|
| `validationAdapter.ts` | `src/shared/components/data-mapper/adapters/validationAdapter.ts` | Converts `Mapping[]` → `ExpectedField[]` with operator support |
| `validationDsl.ts` | `src/shared/components/data-mapper/utils/validationDsl.ts` | DSL parser/serializer for text-based rule editing |
| `ValidationRulesModal.tsx` | `src/shared/components/data-mapper/ValidationRulesModal.tsx` | 3-mode UI (docked/floating/maximized) with DSL Reference panel |
| `ValidationCodeEditor.tsx` | `src/shared/components/data-mapper/ValidationCodeEditor.tsx` | Monaco-based DSL editor with syntax highlighting + autocomplete |
| `useValidationVerify.ts` | `src/shared/components/data-mapper/hooks/useValidationVerify.ts` | Verification engine: evaluates operators, shows pass/fail counts |
| `DslReferencePanel.tsx` | `src/shared/components/data-mapper/DslReferencePanel.tsx` | 10-category, 39-entry reference for operators |
| All 24 `FieldOperator` types | `src/shared/types/index.ts` | `equals`, `is_type`, `exists`, `in`, `regex`, `between`, etc. |

### 13.3 Proposed Integration: Catalog Validation Adapter

Create a new **`catalogValidationAdapter.ts`** that generates validation rules from OpenAPI response schemas:

**File:** `src/shared/components/data-mapper/adapters/catalogValidationAdapter.ts` (new)

```typescript
export interface CatalogValidationAdapterOptions {
  responseSchema: SchemaObject;        // from CatalogResponse.schema
  sampleResponseBody?: unknown;        // live response or generated stub
  specResponses: CatalogResponse[];    // all expected responses for status code mapping
  level: GenerationLevel;              // basic / contract / full
}

export function createCatalogValidationAdapter(
  opts: CatalogValidationAdapterOptions,
): MapperAdapter<ValidationAdapterOutput>;
```

**Behavior:**

| Level | Adapter Behavior |
|-------|------------------|
| `basic` | Empty mappings — no field-level assertions |
| `contract` | Auto-generate `exists` for required fields, `is_type` for all fields |
| `full` | Full schema walk: `exists` + `is_type` + `in` (enums) + `regex` (patterns) |

**How it differs from `validationAdapter.ts`:**

| Aspect | `validationAdapter` | `catalogValidationAdapter` |
|--------|---------------------|---------------------------|
| **Source** | User-provided sample JSON | OpenAPI schema (with optional sample) |
| **Target** | User-defined expected fields | Schema-derived expected fields |
| **Auto-map** | Name matching | Schema constraint-based (required, enum, pattern) |
| **Mode** | Manual field selection | Level-based auto-generation |

### 13.4 Integration Points with Existing Phases

#### Phase 1.3: testGenerator.ts Enhancement

Instead of hardcoding assertion generation in `testGenerator.ts`, delegate to the catalog validation adapter:

```typescript
// In testGenerator.ts — generateTestsFromEndpoint()

import { createCatalogValidationAdapter } from '../../shared/components/data-mapper/adapters/catalogValidationAdapter';

// For 'full' level, use the adapter to generate ExpectedField[]
if (options.level === 'full' && responseSchema) {
  const adapter = createCatalogValidationAdapter({
    responseSchema,
    sampleResponseBody: generateStub(responseSchema),
    specResponses: endpoint.responses,
    level: 'full',
  });
  
  // Generate initial mappings from schema
  const autoMappings = adapter.autoMapFromSchema?.() ?? [];
  
  // Serialize to ExpectedField[]
  const { expectedFields } = adapter.serialize(autoMappings);
  
  scenario.validation.expectedFields = expectedFields;
  scenario.validation.mode = 'selective';
  scenario.validation.selectiveMode = 'include';
}
```

#### Phase 3.2: CatalogEndpointDetail Enhancement

Add a **"Configure Assertions"** button that opens the Data Mapper with `catalogValidationAdapter`:

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Endpoints                                    │
│                                                          │
│  [GET]  /vehicles/{vin}/offers                          │
│  [▶ Send]  [Configure Assertions]  [cURL]              │
│                                                          │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

Clicking **"Configure Assertions"** opens `DataMapperModal` with the catalog validation adapter:

```typescript
<DataMapperModal
  adapter={createCatalogValidationAdapter({
    responseSchema: endpoint.responses.find(r => r.statusCode === '200')?.schema,
    sampleResponseBody: lastResponse?.body,
    specResponses: endpoint.responses,
    level: selectedLevel,
  })}
  initialMappings={existingMappings}
  onSave={(mappings) => {
    // Store customized assertions for this endpoint
    setEndpointAssertions(endpoint.id, mappings);
  }}
/>
```

#### Phase 4: Coverage with Assertion Depth

Extend coverage tracking to consider assertion depth:

| Coverage Level | Criteria |
|----------------|----------|
| `untested` | No tests for this endpoint |
| `basic` | Has test with status assertion only |
| `contract` | Has test with type/existence assertions |
| `full` | Has test with enum/pattern assertions |

### 13.5 User Workflow with Data Mapper

**Scenario: User wants to customize assertions for a catalog endpoint**

1. User selects endpoint in Catalog → "Configure Assertions"
2. Data Mapper opens with schema-derived source tree (left) and target tree (right)
3. Auto-generated mappings show `is_type`, `exists` checks from schema
4. User can:
   - **Drag additional fields** to add assertions
   - **Change operators** (e.g., `equals` → `contains`)
   - **Add custom expressions** (e.g., `$.price > 0`)
   - **Edit in DSL mode** (code editor with autocomplete)
5. User clicks "Done" → assertions saved
6. When running catalog tests, custom assertions override auto-generated ones

### 13.6 Benefits of Data Mapper Integration

| Benefit | Description |
|---------|-------------|
| **Unified Experience** | Same visual UI for catalog tests and hand-built tests — users learn one tool |
| **No code duplication** | Reuse 180+ existing Data Mapper files instead of recreating assertion logic |
| **Visual editing** | Users can see schema structure and configure assertions visually |
| **DSL support** | Power users can write assertions in text format with autocomplete |
| **Operator parity** | All 24 `FieldOperator` types available without extra work |
| **Live verification** | `useValidationVerify` shows pass/fail counts against sample data |
| **Schema drift** | Existing `schemaDrift.ts` can detect when response schema changes |
| **Profiles** | Users can save assertion profiles per endpoint (via `mappingProfiles.ts`) |
| **Results consistency** | Same `AssertionResult[]` format flows to Results Explorer for both test types |

### 13.7 Implementation Checklist

| Task | Phase | Effort | Description |
|------|-------|--------|-------------|
| Create `catalogValidationAdapter.ts` | 1 | Medium | New adapter for schema → mappings |
| Add `autoMapFromSchema()` method | 1 | Small | Schema-based auto-mapping (required, types, enums) |
| Integrate adapter in `testGenerator.ts` | 1 | Small | Delegate `full` level assertion generation |
| Add "Configure Assertions" to `CatalogEndpointDetail` | 3 | Small | Button + modal integration |
| Store per-endpoint custom assertions | 3 | Small | Persist in `CatalogEntry.customAssertions` |
| Extend coverage levels | 4 | Small | Track assertion depth in coverage |

---

## 14. Missing Plan Items Identified

### 14.1 Workflow Runner Integration (Future Enhancement)

The plan mentions "Catalog virtual source in Workflow Runner" as a future enhancement but lacks detail. When implemented:

- Workflow HTTP nodes should be able to reference catalog endpoints
- The node editor would show a "From Catalog" option
- Selecting a catalog endpoint would:
  - Pre-fill URL, method, headers from the endpoint
  - Attach `catalogMeta` for traceability
  - Enable response schema validation against spec

**Suggested location:** `src/features/workflow/components/HttpNodeConfig.tsx`

### 14.2 Catalog CLI Commands (Future Enhancement)

For CI/CD integration, add CLI commands:

```bash
# Run contract tests from catalog
redfireforge catalog run <spec-file-or-url> --level full --output results.json

# Check coverage
redfireforge catalog coverage --harness harness.json --spec spec.yaml --min-coverage 80

# Detect drift
redfireforge catalog drift --old-spec v1.yaml --new-spec v2.yaml --harness harness.json
```

**Suggested location:** `cli/commands/catalog.ts` (new)

### 14.3 Per-Entry Host/Auth Override in Test Runner

When multiple catalog entries are selected, the user may want different host/auth per entry:

```
CATALOG SPECS
☑ Sales Auto Assign v1.0.0     [Host: staging-sales.api.com ▼]  [Auth: Sales Bearer ▼]
  ☑ VehiclePurchaseOffers
  ☑ TrialOffers
☑ Inventory Service v2.1.0     [Host: staging-inv.api.com ▼]   [Auth: Inventory Key ▼]
  ☑ GetInventory
```

This requires extending `RunnerOrchestrationOptions` with `catalogEntryOverrides: Map<entryId, { baseUrl, auth }>`.

### 14.4 Catalog Test Results Grouping

When displaying results from mixed Harness + Catalog runs:

- Results should show a "Source" badge: `[Harness]` or `[Catalog v1.0.0]`
- Catalog results should show the spec response expectation alongside the actual response
- Filter controls: "Show Harness Only" | "Show Catalog Only" | "Show All"

**Affected files:**
- `src/features/results/components/ResultsTable.tsx`
- `src/features/results/components/ResultsDashboard.tsx`

### 14.5 Schema Validation Severity Levels

For `schemaValidator.ts`, add configurable severity:

| Issue | Strict Mode | Lenient Mode |
|---|---|---|
| Missing required field | FAIL | FAIL |
| Wrong type | FAIL | FAIL |
| Extra field not in schema | FAIL | WARN |
| Nullable field is null | PASS | PASS |
| Enum value not in list | FAIL | WARN |

User setting: `catalogValidationStrictness: 'strict' | 'lenient'`

### 14.6 Test Generator Parameter Strategies

For `full` level, the test generator should support different parameter value strategies:

| Strategy | Description |
|---|---|
| `example-first` | Use spec examples, fall back to defaults, then placeholders |
| `boundary` | Generate min/max values for numeric params, empty/max-length for strings |
| `negative` | Generate invalid values to test error handling (e.g., wrong types, out-of-range) |
| `combinatorial` | Generate multiple tests covering different enum value combinations |

This is an advanced enhancement for Phase 1.3 — initially implement `example-first` only.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-16 | **Unified Harness Experience principle.** Added new design principle section emphasizing that catalog-generated tests and hand-built tests should feel identical to users: same ScenarioSelector, same Data Mapper, same results, same host/auth override, same execution modes. "No second-class citizens." Updated Section 13 (Data Mapper Integration) to reinforce this unified approach. |
| 2026-05-16 | **Data Mapper integration.** Added Section 13 documenting how to leverage the existing Data Mapper component (180+ files) for catalog validation. Proposed `catalogValidationAdapter.ts` that generates mappings from OpenAPI schemas. Identified integration points with Phases 1, 3, and 4. Added implementation checklist with 6 tasks. Benefits: visual editing, DSL support, 24 operators, live verification, schema drift detection, profiles. Renumbered Section 14 (Missing Items). |
| 2026-05-16 | **Competitive analysis.** Added Section 10 with comprehensive market research: analyzed ReadyAPI, Postman+Portman, Pactflow (commercial) and Dredd, Schemathesis, swagger-coverage, TraceCov (open-source). Created feature comparison matrix. Identified unique value proposition: virtual + permanent in one tool, mixed test runs, GUI-integrated contract testing, assertion level control, drift detection with test impact, load testing integration. Added 4 new future enhancements inspired by competitors: fuzz testing mode, HAR import, Pact export, spec linting. Renumbered sections 11→12, 12→13. |
| 2026-05-16 | **Implementation status audit.** Added Section 12 with detailed codebase audit showing all phases are unimplemented. Confirmed `schemaStubGenerator.ts` exists and can be reused. Identified that `catalogMeta` is missing from `Scenario` type (only on `RequestItem`). Added Section 14 with 6 missing plan items: Workflow Runner integration, CLI commands, per-entry host/auth, results grouping, validation severity, and parameter strategies. Updated status to "Not Started". |
| 2026-05-13 | **Unified host resolution.** Added "Unified Host Resolution" section to Architecture Decision: catalog tests use catalog's `hostConfig` as default URL, but the Test Runner's HostSelector can override it (same `replaceHost()` logic as Harness tests). Updated Phase 2.3 `buildSelectedTests` with two-step host resolution (generate with catalog URL, then apply runner override). Added 4 new host-related unit tests. |
| 2026-05-13 | **Thorough detail pass.** Expanded all 7 phases with precise implementation steps, file paths, code signatures, design decisions (Assertion vs ExpectedField system), edge cases, and per-phase unit/E2E test matrices. Added `catalogEndpointCollector`, `catalogTestCount`, `resultClassifier`, `driftAnalyzer` utilities. Corrected assertion strategy: test generator uses existing `ExpectedField` operators (`is_type`, `in`, `exists`, `regex`) — no new operators needed in `validator.ts`. Added NavigationCommand pattern for Phase 7. Updated component architecture table with phase assignments. |
| 2026-05-13 | Restructured plan around **Option 4: Virtual Test Source**. Catalog specs become a second test source directly in `ScenarioSelector`. Tests generated on-the-fly from live spec at run time, never saved. Reordered phases: (1) Test Generator Engine, (2) Virtual Test Source in ScenarioSelector, (3) Detail View, (4) Coverage, (5) Save to Harness bridge, (6) Drift, (7) Navigation. Added complete end-to-end data flow and modified component list. |
| 2026-05-13 | Added Section 9: Catalog Operations → Test Runner Integration with Path A/B analysis. |
| 2026-05-13 | Rewrote plan from scratch. Positioned Catalog as contract testing workbench with spec coverage, schema validation, and smart test generation. |

---

_Created: 2026-05-13 | Last Updated: 2026-05-16 | Status: **Not Started — Detailed Plan Complete** | Related: [Workflow-Harness Integration](finished/workflow-harness-integration-plan.md), [Catalog Guide](../guides/catalog-guide.md)_
