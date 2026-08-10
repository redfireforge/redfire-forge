# API Catalog — Design Document

> A standalone top-level feature for importing, browsing, testing, and versioning OpenAPI/Swagger specifications inside RedfireForge.

---

## 1. Problem Statement

RedfireForge has two existing pillars: **Requests** (ad-hoc request editor) and **Harness** (structured performance tests). Neither provides a way to:

- Import an OpenAPI/Swagger spec and immediately browse all its endpoints
- Test endpoints interactively from the spec's own documentation
- Track spec versions over time and see what changed between releases
- Generate cURL commands from spec-defined endpoints

Teams working with microservices frequently receive API specs (YAML/JSON). Today they must manually recreate each endpoint in Requests. The API Catalog eliminates this entirely.

---

## 2. Feature Name & Positioning

| | |
|---|---|
| **Feature name** | API Catalog |
| **Sidebar tab label** | `Catalog` |
| **Storage key prefix** | `catalog-*` |
| **Internal module prefix** | `catalog/` |

The name "API Catalog" was chosen because:
- It implies a managed collection of APIs (not just one spec)
- It's the standard enterprise term (Backstage, Kong, Apigee)
- It's clearly distinct from "Requests" and "Harness"

---

## 3. Supported Specifications

The API Catalog supports **both** Swagger and OpenAPI specifications:

| Spec Format | Versions | File Types | Status |
|---|---|---|---|
| **Swagger** | 2.0 | `.yaml`, `.yml`, `.json` | Full support |
| **OpenAPI** | 3.0.x, 3.1.x | `.yaml`, `.yml`, `.json` | Full support |

### How Both Formats Are Handled

A **custom, dependency-light parser** (`src/features/catalog/utils/openApiParser.ts`,
built on the `yaml` package) normalizes both formats into the same internal model:

- **Swagger 2.0 specs** are normalized into the `CatalogEntry` model — the parser maps
  `host` + `basePath` + `schemes` into server URLs, `definitions` into schemas,
  `body` parameters into `requestBody`, and `securityDefinitions` into
  `securitySchemes`. The internal data model uses an OpenAPI 3.x-shaped structure, so
  the rest of the app never has to care which format was imported. **This is a model
  normalization, not a file conversion** — the raw spec text is stored unchanged (a
  Swagger 2.0 import re-exports as Swagger 2.0). Producing an actual OpenAPI 3 file is a
  separate, explicit **Convert / Upgrade to OpenAPI** action (see §13).

- **OpenAPI 3.0.x / 3.1.x specs** are parsed as-is with support for `servers[]`,
  `components`, `requestBody`, `securitySchemes`, and schema features including `oneOf`,
  `anyOf`, and `allOf`.

Both formats support:
- **Internal `$ref` resolution only** (`#/...` within the same document) — external-file,
  URL, and circular references are **not** resolved (bundle multi-file specs first)
- Basic structural validation with clear error messages for malformed / unsupported specs
- HTTP methods: GET, POST, PUT, PATCH, DELETE
- Parameter locations: path, query, header, cookie
- Authentication schemes: HTTP (Bearer, Basic), API Key, OAuth2, OpenID Connect

### Why Not Just OpenAPI 3.x?

Many enterprise teams still have Swagger 2.0 specs — especially for legacy
microservices or auto-generated docs from older frameworks (Spring Boot
Swagger annotations, .NET Swashbuckle, etc.). Requiring users to manually
convert specs would create unnecessary friction. By supporting both formats
out of the box, teams can import any spec they have.

---

## 4. Navigation Model — Three Pillars

```
┌────────────────────────────────────────────────────────────────┐
│  🔥 RedfireForge — Redfire Performance Workbench        v0.x  │
├────────────────┬───────────────────────────────────────────────┤
│ Sidebar        │  Main Content Area                            │
│                │                                               │
│ ┌────────────┐ │  (depends on active nav rail section)         │
│ │ Requests   │ │                                               │
│ │ Catalog    │ │  Requests → request editor                    │
│ │ Harness    │ │  Catalog  → endpoint browser + detail         │
│ └────────────┘ │  Harness  → feature groups / runner / results │
│                │                                               │
│ (tree changes  │                                               │
│  per tab)      │                                               │
│                │                                               │
│ ⚙ Settings     │                                               │
└────────────────┴───────────────────────────────────────────────┘
```

The `Tab` union covers the nav rail (Environments, Requests, Catalog, Harness) and harness sub-views:

```typescript
type Tab = 'environments' | 'requests' | 'catalog' | 'scenarios' | 'runner' | 'results';
```

---

## 5. Architectural Decision: Thin Sidebar + Master-Detail Main Panel

### The Problem with Endpoint Trees in the Sidebar

A real-world OpenAPI spec can have 50–100+ endpoints. Rendering them all in the
app sidebar creates an endless scroll that overwhelms navigation and pushes other
API entries out of view.

### The Solution

The sidebar shows **only API entry names** (lightweight). When an API is selected,
the **main panel** splits into an internal **Endpoint Nav** strip (left) and
a **Detail Panel** (right). The endpoint tree lives inside the main panel where
there is room for it.

```
┌─ Sidebar ──┐┌─ Main Panel ──────────────────────────────────────┐
│            ││ ┌─ Endpoint Nav ──────┐┌─ Detail Panel ──────────┐│
│ ▸ Sales    ││ │ 🔍 Search...        ││                          ││
│   v3.2.1   ││ │                     ││  POST /v1/assign         ││
│            ││ │ auto-assign    (2)  ││  (Swagger-UI-style view) ││
│ ▸ Payment  ││ │   POST /assign   ●  ││                          ││
│   v2.0.0   ││ │   GET  /status     ││  [Try It] [Copy cURL]    ││
│            ││ │ products       (8)  ││                          ││
│            ││ │   ...               ││                          ││
│ ⚙ Settings ││ └─────────────────────┘└──────────────────────────┘│
└────────────┘└────────────────────────────────────────────────────┘
```

### Why This Works

| Concern | How it's addressed |
|---|---|
| Sidebar stays compact | Only API names + version badges (5–10 entries) |
| Large specs (100+ endpoints) | Endpoint Nav has its own scroll area + search/filter |
| Context switching between APIs | Click different API in sidebar → Endpoint Nav refreshes |
| Screen real estate | Endpoint Nav is collapsible → full-width detail view |
| Consistency with Requests | Requests: sidebar=collections, main=editor. Catalog: sidebar=APIs, main=browser+detail |

---

## 6. Component Architecture

```
src/
├── types/
│   └── catalog.ts (NEW)                  — all Catalog type definitions
│
├── pages/
│   └── ApiCatalog.tsx (NEW)              — main panel orchestrator
│
├── components/catalog/ (NEW)
│   ├── CatalogSidebar.tsx                — thin sidebar: API names + version badges
│   ├── CatalogSidebarContextMenu.tsx     — right-click: versions, config, edit, delete
│   ├── CatalogMainPanel.tsx              — routes between welcome/overview/endpoint
│   ├── CatalogWelcome.tsx                — empty state with import prompt
│   ├── CatalogOverview.tsx               — API-level summary + stats
│   ├── CatalogEndpointBrowser.tsx        — tag-grouped endpoint list + host/auth bar
│   ├── CatalogEndpointCard.tsx           — Swagger-UI-style interactive endpoint detail
│   ├── CatalogAuthPanel.tsx              — auth strategy selector (inherit, global, manual)
│   ├── CatalogEditModal.tsx              — edit entry: manage environments (CRUD)
│   ├── CatalogImportModal.tsx            — file picker + paste YAML + preview + validation
│   ├── CatalogVersionHistory.tsx         — version list + diff view
│   └── CatalogVersionDiff.tsx            — endpoint-level changelog renderer
│
├── hooks/
│   └── useCatalog.ts (NEW)              — CRUD, version management, storage
│
├── utils/
│   ├── openApiParser.ts (NEW)           — parse spec → CatalogEntry
│   ├── schemaStubGenerator.ts (NEW)     — JSON Schema → sample request body
│   └── catalogSpecDiff.ts (NEW)         — diff two CatalogVersion snapshots
│
├── styles/
│   ├── index.css                         — add @import './catalog.css'
│   └── catalog.css (NEW)                — all Catalog-specific styles
│
├── App.tsx                               — add 3rd nav rail section + <ApiCatalog/>
```

### Modified Existing Files

| File | Change |
|---|---|
| `src/App.tsx` | Add `'catalog'` to `Tab` type, add third nav rail button, render `<CatalogSidebar>` and `<ApiCatalog>` |
| `src/styles/base.css` | Vertical `.usb-nav-rail` with `.usb-nav-btn` for section switcher |
| `src/styles/index.css` | Add `@import './catalog.css'` |
| `src/utils/curlGenerator.ts` | Extend `buildCurlCommand` to accept catalog endpoint shape (or add parallel function) |

---

## 7. Dependencies

**Import parsing uses no dedicated OpenAPI library.** The parser
(`openApiParser.ts`) is custom code on top of the already-installed **`yaml`**
package. It intentionally does only what the Catalog model needs: YAML/JSON parse,
internal `#/` `$ref` resolution, and normalization into `CatalogEntry`. It does **not**
do external/URL/circular `$ref` resolution or full spec validation.

> **Historical note:** `@apidevtools/swagger-parser` appears in `package.json` but is
> **not imported anywhere in `src/`** — it is a dead dependency and does **not** perform
> Swagger 2→3 conversion. Earlier revisions of this document claimed it handled the spec
> lifecycle; that was never the shipped implementation. It can be removed in a cleanup PR.

**Convert / Upgrade to OpenAPI (§13)** adds lazy-loaded conversion/lint packages, imported
via dynamic `import()` so they stay out of the main bundle:

| Package | Role | Notes |
|---|---|---|
| `swagger2openapi` | Default 2.0 → 3.0.x converter | Battle-tested; correctness-proven; emits 3.0.x |
| `@scalar/openapi-upgrader` | Selectable alternate + upgrader | Only engine that can target 3.1 / 3.2; used for all 3.x → higher upgrades |
| `oas-validator` | On-demand Deep lint | Schema + best-practice rules for OpenAPI 3.0.x; advisory only, never blocks |

---

## 8. Data Flow

```
Swagger 2.0 YAML/JSON  ──┐
                          ├──▶  openApiParser.ts (custom, on `yaml`)
OpenAPI 3.x YAML/JSON  ──┘     (parse + internal #/ $ref resolution
                                 + normalize Swagger 2.0 → model internally)
    │
    ▼
CatalogEntry { name, versions[], folders[], endpoints[], servers[], ... }
    │
    ├──▶ useCatalog.ts (persist via storage abstraction)
    │
    ├──▶ CatalogSidebar (thin: name + version badge only)
    │
    └──▶ CatalogMainPanel
            ├── CatalogOverview (stats, servers, description)
            ├── CatalogEndpointNav (tag-grouped endpoint list)
            └── CatalogEndpointView
                  ├── CatalogHostAuthBar
                  ├── CatalogParameterEditor
                  ├── Request body editor (schema stub)
                  ├── [Try It] → httpFetch() → CatalogResponseViewer
                  └── [Copy cURL] → buildCurlCommand() → CurlPreview
```

---

## 9. Storage Budget & Optimization

### What Gets Stored

There is **no compilation**. The UI renders from pre-extracted plain JS objects
at runtime — the same pattern Requests uses for `RequestItem`. The only
stored data is:

| Data | Where | Purpose |
|---|---|---|
| `CatalogEntry` (parsed structure) | `catalog-entries` key | Endpoint tree, parameters, schemas — what the UI reads |
| `rawSpec` (original YAML/JSON text) | Inside each `CatalogVersion` | Re-export, version diff, re-parse if internal format changes |

### Size Estimates

| Scenario | rawSpec | Parsed Entry | Versions (3) | Total |
|---|---|---|---|---|
| Small API (10 endpoints) | ~10 KB | ~5 KB | ~35 KB | **~40 KB** |
| Medium API (50 endpoints) | ~80 KB | ~40 KB | ~280 KB | **~320 KB** |
| Large API (200 endpoints) | ~400 KB | ~150 KB | ~1.35 MB | **~1.5 MB** |

Realistic workspace: **10 APIs × 3 versions avg ≈ 2–3 MB**.

### Platform Limits

| Platform | Storage Limit | Risk Level |
|---|---|---|
| **Tauri (desktop)** | Unlimited (file system) | None |
| **Web (localStorage)** | ~5–10 MB | Moderate — tight with many large specs |

### Optimization Strategies

**1. Separate storage for raw specs (lazy loading)**

The `rawSpec` string is by far the largest field — typically 70–80% of total
storage. It's only needed when the user opens Version History, re-imports, or
exports. By storing it in a separate key, it doesn't need to load into memory
at startup:

```
'catalog-entries'                    → CatalogEntry[] (without rawSpec)
'catalog-spec-{entryId}-{versionId}' → string (rawSpec, loaded on demand)
```

This cuts initial load from ~3 MB to ~500 KB for 10 APIs.

**2. Version cap (default: 10)**

Old versions auto-purge when the cap is reached. Most users only care about
the last few imports. Configurable via Settings.

**3. Optional LZ compression for raw specs**

YAML/JSON text compresses extremely well (~80% reduction). A 400 KB spec
compresses to ~80 KB with `lz-string` (browser-compatible, no dependencies).
This is opt-in — enabled by default in web mode, optional in desktop.

**4. Storage usage indicator**

Show a bar in Settings: "Catalog storage: 1.8 MB / 5 MB". Warn when
approaching the limit. Suggest pruning old versions or deleting unused entries.

**5. Strip rawSpec from old versions**

For versions older than N (configurable), drop the `rawSpec` and only keep
the `specHash` + diff summary. The user loses the ability to re-export or
restore that specific version, but saves significant space.

### What Is NOT Stored

- No compiled or rendered HTML — the UI is React components reading data
- No duplicate schemas — internal `#/` `$ref` is dereferenced once at import, stored flat
- No response cache — "Try It" responses are session-only (lost on refresh)
- No filled parameter values — session-only (lost on refresh)

---

## 10. Host & Auth Resolution

Each `CatalogEntry` has a host and auth configuration with a **strategy** selector:

### Host Strategies

| Strategy | Host Behavior |
|---|---|
| **From Spec** (inherited) | Uses the server URL from the spec's `servers[]` |
| **Environment** | Uses a base URL from a user-defined environment (configured via Edit modal) |
| **Custom URL** (hardcoded) | User types a custom URL directly |

Environments are configured per API entry via right-click → **Edit** in the sidebar.
Each environment has a name (e.g., "Test", "Staging", "Production") and a base URL.
When the "Environment" strategy is active, users select from a dropdown of their
configured environments.

### Auth Strategies

| Strategy | Auth Behavior |
|---|---|
| **Inherit from Spec** | Uses the spec's `securitySchemes` with user-provided credentials |
| **Global Auth Profile** | Uses an app-level `GlobalAuthProfile` (including OAuth2 client credentials) |
| **None / Manual** | User configures auth inline (bearer, basic, API key, OAuth2) |

Auth configuration is persisted per `CatalogEntry` and restored across sessions.
OAuth2 tokens are acquired automatically at request execution time via client
credentials flow.

### Persistence

Both host and auth configuration are saved on the `CatalogEntry` and survive
browser refresh and server restart. Endpoint-level form values (parameters,
headers, request body) are also persisted in a separate storage key per entry.

---

## 11. Reuse from Existing Code

| Existing Code | Reused In |
|---|---|
| `curlGenerator.ts` (`buildCurlCommand`) | cURL button — extend to accept catalog endpoint shape |
| `httpFetch()` from `httpClient.ts` | "Try It" execution |
| `RequestAuthEditor.tsx` | Auth editing within `CatalogHostAuthBar` |
| `BodyEditor` component | Request body editing in endpoint view |
| `ParamsEditor` component | Query/header parameter editing |
| `JsonTreePreview` | Response body display |
| `ConsoleLog` | Response headers/timing display |
| `SidebarContextMenu` pattern | `CatalogSidebarContextMenu` |
| Storage abstraction (`loadData`/`saveData`) | Catalog persistence |
| `yaml` package | Already installed for raw YAML handling |

Roughly 40–50% of UI components can be reused or lightly adapted from the
existing Requests implementation.

---

## 12. Bridge to Requests (Future)

A "Send to Requests" button on any endpoint or entire catalog entry copies
endpoint(s) as `RequestItem` objects into a Requests collection. This
gives users the full request editor experience for more advanced ad-hoc testing.

The Catalog stays **spec-driven** (read from the imported YAML). Requests
stays **user-driven** (free-form editing). They complement each other.

---

## 13. Convert / Upgrade to OpenAPI

Import normalizes Swagger 2.0 (and OpenAPI 3.x) into the internal model but keeps the raw
spec unchanged. The **Convert / Upgrade** action produces an actual OpenAPI YAML file — the
primary use case is feeding OpenAPI Generator / Maven / Spring Boot codegen, which require
OpenAPI 3.x input. The same modal handles two flows, chosen automatically from the source
format (`detectSpecFormat`):

- **Convert** — Swagger 2.0 → OpenAPI **3.0** or **3.1**
- **Upgrade** — OpenAPI **3.0** → 3.1 / 3.2, or OpenAPI **3.1** → 3.2

**Entry points:** sidebar context menu **Convert / Upgrade OpenAPI YAML…** and the overview
**Convert / Upgrade OpenAPI** button. The opener loads the raw spec once and only opens the
modal when at least one forward target exists (`availableTargets`); an already-latest 3.2 or
unsupported spec gets a "Nothing to convert" info toast instead.

**Modal** (`CatalogConvertOpenApiModal.tsx`):

| Concern | Design |
|---|---|
| Engine | **Convert flow:** `swagger2openapi` (default, 3.0.x) or `@scalar/openapi-upgrader` (Scalar; path to 3.1). **Upgrade flow:** Scalar only (fixed — the only engine that emits 3.1 / 3.2). Both lazy-loaded via dynamic `import()` |
| Target | **Convert:** `3.0` (both engines) / `3.1` (Scalar only; disabled + auto-corrected for swagger2openapi). **Upgrade:** offered targets come from `availableTargets` (3.0 source → 3.1 / 3.2; 3.1 source → 3.2) |
| Validation gate | Every result is repaired by `normalizeConvertedOpenApi3` then run through an owned structural `validateOpenApi3` check; a ✅/❌ badge + error list surface invalid output. Download / Save are gated on valid output |
| Auto-fallback | **Convert flow only:** on engine throw **or** invalid output, the dispatcher falls back to the other engine and records the reason (a chip shows `fell back … (error \| invalid output)`). The upgrade flow is Scalar-only and never falls back |
| Deep lint | On-demand **Deep lint** button runs `oas-validator` (schema + best-practice rules) on the converted doc. Advisory only — **never blocks** Download / Save; targets OpenAPI **3.0.x** (for 3.1 / 3.2 only the structural checks above apply); lazy-loaded with graceful degradation |
| Output | **Download YAML** (`{name}-openapi-{target}.yaml`) or **Save as new version** (re-parse + `addVersionToEntry`, tagged with a changelog line — "Converted …" or "Upgraded …" — prunes at `MAX_VERSIONS`) |
| Prefs | Last-used `{engine, target}` persisted via the storage abstraction (convert flow only) |

**Key modules:** `swaggerToOpenApi.ts` (dispatchers `convertSwaggerToOpenApiYaml` +
`upgradeOpenApi3Yaml`, format detection `detectSpecFormat` / `availableTargets`, structural
`validateOpenApi3` + `normalizeConvertedOpenApi3`), `engines/{swagger2openapi,scalar}Engine.ts`
(adapters), `convertPrefs.ts` (persistence), `openApiLint.ts` (lazy `oas-validator` deep lint),
`CatalogConvertOpenApiModal.tsx` (UI). Full design + tooling research:
[`docs/plan/future/catalog/convert-swagger-to-openapi-plan.md`](../../plan/future/catalog/convert-swagger-to-openapi-plan.md).

---

## Related Documents

- [Data Model](./DATA-MODEL.md) — Type definitions and storage design
- [UI Wireframes](./UI-WIREFRAMES.md) — Detailed ASCII wireframes for all screens
- [Implementation Phases](./PHASES.md) — Step-by-step build plan with deliverables

---

_Created: 2026-04-18_
