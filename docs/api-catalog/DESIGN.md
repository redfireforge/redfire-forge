# API Catalog — Design Document

> A standalone top-level feature for importing, browsing, testing, and versioning OpenAPI/Swagger specifications inside RedfireForge.

---

## 1. Problem Statement

RedfireForge has two existing pillars: **Workbench** (ad-hoc request editor) and **Projects** (structured performance tests). Neither provides a way to:

- Import an OpenAPI/Swagger spec and immediately browse all its endpoints
- Test endpoints interactively from the spec's own documentation
- Track spec versions over time and see what changed between releases
- Generate cURL commands from spec-defined endpoints

Teams working with microservices frequently receive API specs (YAML/JSON). Today they must manually recreate each endpoint in Workbench. The API Catalog eliminates this entirely.

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
- It's clearly distinct from "Workbench" and "Projects"

---

## 3. Supported Specifications

The API Catalog supports **both** Swagger and OpenAPI specifications:

| Spec Format | Versions | File Types | Status |
|---|---|---|---|
| **Swagger** | 2.0 | `.yaml`, `.yml`, `.json` | Full support |
| **OpenAPI** | 3.0.x, 3.1.x | `.yaml`, `.yml`, `.json` | Full support |

### How Both Formats Are Handled

The `@apidevtools/swagger-parser` library handles both formats natively:

- **Swagger 2.0 specs** are parsed directly — the parser resolves `host` +
  `basePath` + `schemes` into server URLs, converts `definitions` to schemas,
  transforms `body` parameters into `requestBody`, and maps
  `securityDefinitions` to `securitySchemes`. The internal data model
  (`CatalogEntry`) uses the OpenAPI 3.x structure, so Swagger 2.0 is normalized
  on import.

- **OpenAPI 3.0.x / 3.1.x specs** are parsed as-is with full support for
  `servers[]`, `components`, `requestBody`, `securitySchemes`, and all schema
  features including `oneOf`, `anyOf`, `allOf`, and `discriminator`.

Both formats support:
- Full `$ref` resolution (internal, external files, URLs, circular references)
- Validation with clear error messages for malformed specs
- Multi-file specs (external `$ref` to other files)
- All HTTP methods: GET, POST, PUT, PATCH, DELETE
- All parameter locations: path, query, header, cookie
- All authentication schemes: HTTP (Bearer, Basic), API Key, OAuth2, OpenID Connect

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
│ ┌────────────┐ │  (depends on active sidebar tab)              │
│ │ Workbench  │ │                                               │
│ │ Catalog    │ │  Workbench → request editor                   │
│ │ Projects   │ │  Catalog   → endpoint browser + detail        │
│ └────────────┘ │  Projects  → feature groups / runner / results│
│                │                                               │
│ (tree changes  │                                               │
│  per tab)      │                                               │
│                │                                               │
│ ⚙ Settings     │                                               │
└────────────────┴───────────────────────────────────────────────┘
```

The `Tab` type changes from:
```typescript
type Tab = 'scenarios' | 'runner' | 'results' | 'workbench';
```
to:
```typescript
type Tab = 'workbench' | 'catalog' | 'scenarios' | 'runner' | 'results';
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
| Consistency with Workbench | Workbench: sidebar=collections, main=editor. Catalog: sidebar=APIs, main=browser+detail |

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
│   ├── CatalogSidebarContextMenu.tsx     — right-click: versions, config, delete
│   ├── CatalogMainPanel.tsx              — routes between welcome/overview/endpoint
│   ├── CatalogWelcome.tsx                — empty state with import prompt
│   ├── CatalogOverview.tsx               — API-level summary + stats
│   ├── CatalogEndpointNav.tsx            — tag-grouped endpoint list (inside main panel)
│   ├── CatalogEndpointView.tsx           — Swagger-UI-style interactive endpoint detail
│   ├── CatalogParameterEditor.tsx        — editable path/query/header param forms
│   ├── CatalogHostAuthBar.tsx            — host + auth strategy selector
│   ├── CatalogResponseViewer.tsx         — live response after "Try It"
│   ├── CatalogResponseSchemas.tsx        — spec-defined response schemas display
│   ├── CurlPreview.tsx                   — cURL popover with copy button
│   ├── CatalogImportModal.tsx            — file picker + preview + validation
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
├── App.tsx                               — add 3rd sidebar tab + <ApiCatalog/>
```

### Modified Existing Files

| File | Change |
|---|---|
| `src/App.tsx` | Add `'catalog'` to `Tab` type, add third sidebar tab button, render `<CatalogSidebar>` and `<ApiCatalog>` |
| `src/styles/base.css` | Adjust `.usb-top-tab` flex for 3 tabs |
| `src/styles/index.css` | Add `@import './catalog.css'` |
| `src/utils/curlGenerator.ts` | Extend `buildCurlCommand` to accept catalog endpoint shape (or add parallel function) |

---

## 7. Dependency

One new dependency: **`@apidevtools/swagger-parser`**

| | |
|---|---|
| Package | `@apidevtools/swagger-parser` |
| Size | ~50KB gzipped |
| Browser support | Yes (works in browser and Node) |
| Swagger 2.0 | Yes |
| OpenAPI 3.0 / 3.1 | Yes |
| `$ref` resolution | Full (external files, URLs, circular) |
| Validation | Built-in |
| Weekly downloads | ~1.5M |

The existing `yaml` package is already installed but swagger-parser handles the
full spec lifecycle (validation, `$ref` dereferencing, bundling) which is critical
for real-world specs with deep reference chains.

---

## 8. Data Flow

```
Swagger 2.0 YAML/JSON  ──┐
                          ├──▶  openApiParser.ts
OpenAPI 3.x YAML/JSON  ──┘     (swagger-parser: validate + dereference
                                 + normalize Swagger 2.0 → 3.x internally)
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
at runtime — the same pattern Workbench uses for `WorkbenchRequest`. The only
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
- No duplicate schemas — `$ref` is dereferenced once at import, stored flat
- No response cache — "Try It" responses are session-only (lost on refresh)
- No filled parameter values — session-only (lost on refresh)

---

## 10. Host & Auth Resolution

Each `CatalogEntry` has a host and auth configuration with a **strategy** selector:

| Strategy | Host Behavior | Auth Behavior |
|---|---|---|
| **Global** | Uses a Workbench environment's base URL | Uses an app-level `GlobalAuthProfile` |
| **Inherited** | Uses the server URL from the spec's `servers[]` | Uses the spec's `securitySchemes` |
| **Hardcoded** | User types a custom URL directly | User configures auth inline (bearer, basic, etc.) |

The strategy is set at the `CatalogEntry` level (applies to all endpoints) and
can be overridden per-endpoint in a future phase.

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
existing Workbench implementation.

---

## 12. Bridge to Workbench (Future)

A "Send to Workbench" button on any endpoint or entire catalog entry copies
endpoint(s) as `WorkbenchRequest` objects into a Workbench collection. This
gives users the full request editor experience for more advanced ad-hoc testing.

The Catalog stays **spec-driven** (read from the imported YAML). The Workbench
stays **user-driven** (free-form editing). They complement each other.

---

## Related Documents

- [Data Model](./DATA-MODEL.md) — Type definitions and storage design
- [UI Wireframes](./UI-WIREFRAMES.md) — Detailed ASCII wireframes for all screens
- [Implementation Phases](./PHASES.md) — Step-by-step build plan with deliverables

---

_Created: 2026-04-18_
