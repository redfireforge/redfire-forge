# API Catalog — Implementation Phases

> Step-by-step build plan for the API Catalog feature, from foundation to polish.

---

## Phase Overview

| Phase | Name | Summary | Est. Effort |
|---|---|---|---|
| 1 | Foundation | Types, parser, thin sidebar, import modal | Large |
| 2 | Endpoint Browser | Endpoint nav + read-only detail view | Large |
| 3 | Interactive Testing | Host & auth bar, "Try It" execution | Medium |
| 4 | cURL Integration | Extend existing cURL generator, add popover | Small |
| 5 | Versioning | Re-import, version history, endpoint diff | Medium |
| 6 | Polish & Bridges | Overview page, "Send to Workbench", search UX | Medium |

---

## Phase 1 — Foundation

> **Goal**: Import an OpenAPI spec and see it listed in the sidebar.

### Deliverables

- [ ] **New types** (`src/types/catalog.ts`)
  - `CatalogEntry`, `CatalogVersion`, `CatalogFolder`, `CatalogEndpoint`
  - `CatalogParameter`, `CatalogRequestBody`, `CatalogResponse`
  - `CatalogServer`, `CatalogSecurityScheme`
  - `HostConfig`, `CatalogAuthConfig`, `ResolutionStrategy`

- [ ] **Install dependency**: `@apidevtools/swagger-parser`

- [ ] **OpenAPI / Swagger parser** (`src/utils/openApiParser.ts`)
  - Accept raw YAML or JSON string (Swagger 2.0, OpenAPI 3.0.x, OpenAPI 3.1.x)
  - Validate + dereference with swagger-parser (auto-normalizes Swagger 2.0 → 3.x internally)
  - Walk `paths` → produce `CatalogEndpoint[]` per method/path
  - Group endpoints by tag → produce `CatalogFolder[]`
  - Extract `servers[]` → `CatalogServer[]`
  - Extract `securitySchemes` → `CatalogSecurityScheme`
  - Generate sample request bodies from JSON Schema (`schemaStubGenerator.ts`)
  - Return `{ entry: CatalogEntry, warnings: string[] }`

- [ ] **Schema stub generator** (`src/utils/schemaStubGenerator.ts`)
  - Convert JSON Schema to a sample JSON object
  - Use `example` or `default` values when present
  - Fall back to type-based stubs (`string` → `"string"`, `integer` → `0`, etc.)
  - Handle `$ref` (already dereferenced by swagger-parser)
  - Handle `oneOf`/`anyOf` (pick first option)
  - Handle arrays (single-item stub)
  - Handle nested objects recursively
  - Guard against circular references (max depth)

- [ ] **Storage hook** (`src/hooks/useCatalog.ts`)
  - Load/save `CatalogEntry[]` via storage abstraction (lightweight — no raw specs at startup)
  - Save raw specs in separate keys: `catalog-spec-{entryId}-{versionId}`
  - `addEntry()`, `removeEntry()`, `updateEntry()`
  - `selectEntry(id)`, `selectEndpoint(id)`
  - `loadRawSpec(entryId, versionId)` — on-demand loader for version history/export
  - State: `entries`, `selectedEntryId`, `selectedEndpointId`

- [ ] **Catalog sidebar** (`src/components/catalog/CatalogSidebar.tsx`)
  - List of API names with version badges (e.g., `Sales Product API v3.2.1 • 14 eps`)
  - Search/filter input at top
  - `[+ Import Spec]` button
  - Click entry → select it
  - Active entry highlighted

- [ ] **Import modal** (`src/components/catalog/CatalogImportModal.tsx`)
  - File picker: `.yaml`, `.yml`, `.json` (reuse Tauri `openJsonFile` pattern)
  - Parse + validate on pick → show preview:
    - Spec title, version, description
    - Server URLs found
    - Endpoint count by tag
    - Any validation warnings
  - "Import" button → save to storage → select in sidebar

- [ ] **Wire into App.tsx**
  - Add `'catalog'` to `Tab` type
  - Add third sidebar tab button between Workbench and Projects
  - Render `<CatalogSidebar>` when `activeTab === 'catalog'`
  - Render `<ApiCatalog>` (placeholder) in main area

- [ ] **Catalog styles** (`src/styles/catalog.css`)
  - Sidebar entry cards, version badges, import button
  - `@import './catalog.css'` in `index.css`

### Acceptance Criteria
- User can import a valid **OpenAPI 3.0 / 3.1** YAML or JSON file
- User can import a valid **Swagger 2.0** YAML or JSON file
- Both formats produce the same `CatalogEntry` structure (Swagger 2.0 is normalized)
- The API appears in the sidebar with its name and version
- Invalid specs show clear error messages
- Data persists across page reloads

---

## Phase 2 — Endpoint Browser

> **Goal**: Browse all endpoints of an imported API with full spec documentation.

### Deliverables

- [ ] **Main panel orchestrator** (`src/pages/ApiCatalog.tsx`)
  - Three view modes:
    - No entry selected → `CatalogWelcome`
    - Entry selected, no endpoint → `CatalogOverview` (basic placeholder, completed in Phase 6)
    - Entry + endpoint selected → `CatalogEndpointView`
  - Manages the endpoint nav + detail split layout

- [ ] **Endpoint nav strip** (`src/components/catalog/CatalogEndpointNav.tsx`)
  - Lives inside the main panel (NOT in the app sidebar)
  - ~260px width, resizable with drag handle, collapsible
  - Search/filter input: filters by path, method, operationId, summary
  - Tag sections that expand/collapse (one level only)
  - Method color badges: GET=green, POST=amber, PUT=blue, PATCH=purple, DELETE=red
  - Endpoint count per tag
  - Deprecated endpoints shown with strikethrough + muted style
  - Active endpoint highlighted
  - Click API name at top → go to overview

- [ ] **Endpoint detail view** (`src/components/catalog/CatalogEndpointView.tsx`)
  - Header: method badge + full path + summary
  - Description text (from spec)
  - Parameters section grouped by location (path, query, header, cookie):
    - Name, type, required badge, description
    - Read-only display for now (interactive in Phase 3)
  - Request body section:
    - Media type tabs if multiple content types
    - JSON Schema display with expandable nested objects
    - Sample body (from `schemaStubGenerator`)
  - Response schemas section (`CatalogResponseSchemas.tsx`):
    - Accordion per status code (200, 400, 401, etc.)
    - Description + schema display + example

- [ ] **Welcome page** (`src/components/catalog/CatalogWelcome.tsx`)
  - Empty state: "Import an OpenAPI spec to get started"
  - `[+ Import Spec]` button
  - Supported formats note: OpenAPI 3.0, 3.1, Swagger 2.0 / YAML, JSON

### Acceptance Criteria
- Clicking an API in sidebar shows its endpoints in the nav strip
- Clicking an endpoint shows full spec documentation (params, body, responses)
- Endpoint nav search filters correctly
- Tag sections expand/collapse
- Collapsing endpoint nav gives full-width detail view

---

## Phase 3 — Interactive Testing

> **Goal**: Fill in parameters and execute requests directly from spec documentation.

### Deliverables

- [ ] **Host & auth bar** (`src/components/catalog/CatalogHostAuthBar.tsx`)
  - Appears at top of endpoint detail view
  - Host strategy dropdown: `Global | Inherited | Hardcoded`
    - Global: pick from Workbench environments
    - Inherited: select from spec's `servers[]`
    - Hardcoded: text input for custom URL
  - Auth strategy dropdown: `Global | Inherited | Hardcoded`
    - Global: pick from app's `GlobalAuthProfile`
    - Inherited: uses spec's `securitySchemes` (show scheme type as label)
    - Hardcoded: inline auth editor (reuse `RequestAuthEditor`)
  - Configuration saved per `CatalogEntry`

- [ ] **Parameter editor** (`src/components/catalog/CatalogParameterEditor.tsx`)
  - Editable form fields for each parameter:
    - Path params: text input (pre-filled with `{paramName}` placeholder)
    - Query params: key-value with enable/disable toggles
    - Header params: key-value rows
  - Required fields marked with red asterisk
  - Type hints shown (string, integer, enum dropdown, boolean toggle)
  - Enum parameters render as `<select>` dropdowns
  - Default values pre-populated from schema

- [ ] **Editable request body**
  - JSON editor pre-filled with schema stub from Phase 1
  - User can edit the body before sending
  - Reuse existing `BodyEditor` component

- [ ] **"Try It" execution**
  - Build full URL: resolved host + path (with path params substituted)
  - Append query params
  - Add headers (from params + auth)
  - Use `httpFetch()` from existing `httpClient.ts`
  - Display response via `CatalogResponseViewer.tsx`:
    - Status code + status text
    - Response time
    - Response size
    - Body: reuse `JsonTreePreview` for JSON, raw for others
    - Response headers table
  - Loading spinner during request
  - Error handling for network failures, timeouts

- [ ] **State management for filled values**
  - Per-endpoint parameter values preserved during session (in-memory)
  - Clearing on API switch or page reload is acceptable for MVP

### Acceptance Criteria
- User can select host strategy and see resolved URL
- User can configure auth strategy
- User can fill in all parameter types and edit the request body
- "Try It" sends the request and displays the response
- Auth headers are correctly applied based on strategy

---

## Phase 4 — cURL Integration

> **Goal**: Generate and copy cURL commands from any endpoint configuration.

### Deliverables

- [ ] **Extend cURL generator**
  - Add function or overload in `src/utils/curlGenerator.ts` that accepts:
    - Resolved URL (host + path + query params)
    - Method
    - Headers (from parameters + custom)
    - Auth config (resolved)
    - Request body string + content type
  - Reuse existing logic (auth encoding, body escaping, form handling)
  - Return formatted cURL string

- [ ] **cURL preview popover** (`src/components/catalog/CurlPreview.tsx`)
  - Triggered by `[Copy cURL]` button in endpoint view toolbar
  - Displays formatted cURL command
  - Toggle: single-line vs multi-line format
  - `[Copy to Clipboard]` button with confirmation feedback
  - Syntax highlighting for the command (method, URL, headers in different colors)

- [ ] **cURL in context menu**
  - Right-click on endpoint in nav strip → "Copy as cURL"
  - Uses default/example parameter values (no user edits needed)

### Acceptance Criteria
- cURL reflects the current host, auth, parameters, and body
- Copy to clipboard works
- Single-line and multi-line toggle works
- Right-click copy uses schema defaults/examples

---

## Phase 5 — Versioning

> **Goal**: Track spec versions over time, re-import updates, and diff changes.

### Deliverables

- [ ] **Version storage with lazy-loaded raw specs**
  - Each `CatalogEntry` has `versions: CatalogVersion[]` (ordered by `importedAt` desc)
  - `CatalogVersion` stores: `id`, `version`, `importedAt`, `specHash`, `specSize`, `changelog`
  - `rawSpec` stored separately in `catalog-spec-{entryId}-{versionId}` key (not in the entry)
  - Current version linked via `currentVersionId`
  - Raw spec loaded on demand only (version history, export, restore)

- [ ] **Re-import flow**
  - "Re-import / Update" in sidebar context menu
  - Same import modal but detects existing entry by `info.title` match
  - Computes `specHash` — if identical, shows "No changes detected"
  - If changed, shows diff summary before applying

- [ ] **Spec diff engine** (`src/utils/catalogSpecDiff.ts`)
  - Compare two parsed `CatalogEntry` snapshots
  - Detect: added endpoints, removed endpoints, changed endpoints
  - For changed endpoints: diff parameters, request body schema, response schemas
  - Return structured diff result for UI rendering

- [ ] **Version history modal** (`src/components/catalog/CatalogVersionHistory.tsx`)
  - Triggered from sidebar context menu → "Version History"
  - List of versions with: version string, import date, optional changelog note
  - Click any version → shows diff against current
  - "Restore" button to switch active version (re-parses stored raw spec)
  - "Re-import New Version" button

- [ ] **Version diff view** (`src/components/catalog/CatalogVersionDiff.tsx`)
  - Visual diff between two versions:
    - `+ POST /v1/assign` (new endpoint — green)
    - `- DELETE /v1/products/bulk` (removed — red)
    - `~ PUT /v1/products/{id}` (changed — amber)
      - Sub-items: added/removed parameters, changed schemas
  - Summary counts: N added, N removed, N changed

- [ ] **Sidebar version badge + context menu**
  - Right-click on API entry shows version submenu at top
  - Click a version → switch to it (re-parses that version's raw spec)
  - Current version has checkmark indicator

- [ ] **Storage optimization**
  - Version cap: auto-purge oldest versions when exceeding limit (default: 10)
  - Soft prune: strip `rawSpec` from old versions, keep metadata + diff summary
  - LZ compression for raw specs in web mode (`lz-string`, ~80% size reduction)
  - Storage usage indicator in Settings showing per-entry breakdown
  - Warning at 80% localStorage capacity, block new imports at 95%
  - Cleanup on entry deletion: remove all `catalog-spec-{id}-*` keys

### Acceptance Criteria
- Re-importing a changed spec creates a new version entry
- Re-importing an identical spec shows "no changes"
- Version history lists all past imports
- Diff accurately identifies added/removed/changed endpoints
- Restoring a previous version works correctly
- Raw specs load on demand (not at startup) — verified by checking startup load size
- Version cap auto-prunes oldest versions when exceeded
- Storage indicator shows accurate per-entry size breakdown

---

## Phase 6 — Polish & Bridges

> **Goal**: Complete the experience with overview stats, Workbench integration, and UX refinements.

### Deliverables

- [ ] **Overview page** (`src/components/catalog/CatalogOverview.tsx`)
  - Shown when an API entry is selected but no endpoint
  - API title, version, description, last import date
  - Server URLs list
  - Endpoint stats:
    - By tag (bar chart or table with counts)
    - By method (GET: 6, POST: 4, PUT: 2, etc.)
  - Quick links: "Re-import", "Export Spec", "Version History"
  - Host & auth status summary

- [ ] **"Send to Workbench" bridge**
  - Button on single endpoint → creates one `WorkbenchRequest` in a new or existing collection
  - Button on overview page → "Send All to Workbench" → creates a collection with all endpoints
  - Maps: method, path → URL, parameters → headers/query params, body stub, auth
  - Opens Workbench tab with the new collection selected

- [ ] **Export original spec**
  - Right-click → "Export Original Spec"
  - Saves the stored `rawSpec` as `.yaml` or `.json` file
  - Preserves the exact file that was imported

- [ ] **Search UX improvements**
  - Endpoint nav: fuzzy matching or substring across path + summary + operationId
  - Sidebar: filter API entries by name
  - Keyboard shortcut: `Ctrl/Cmd+K` to focus search (if not already used)

- [ ] **Deprecation handling**
  - Deprecated endpoints shown with strikethrough text + warning badge
  - Deprecated notice in endpoint detail view header
  - Optional filter: "Hide deprecated" toggle in endpoint nav

- [ ] **Swagger 2.0 + OpenAPI 3.x dual-format verification**
  - Test with real Swagger 2.0 specs (e.g., Petstore Swagger 2.0)
  - Test with real OpenAPI 3.0 and 3.1 specs
  - Verify Swagger 2.0 normalization: `host`+`basePath`→servers, `definitions`→schemas, body param→requestBody, `securityDefinitions`→securitySchemes, `produces`/`consumes`→content types
  - Verify both formats produce identical `CatalogEntry` structure for equivalent APIs

- [ ] **Unit tests**
  - `openApiParser.ts`: parse valid OpenAPI 3.0/3.1 specs, parse valid Swagger 2.0 specs, verify both produce normalized output, handle malformed YAML, $ref resolution
  - `schemaStubGenerator.ts`: all JSON Schema types, nested objects, arrays, enums, circular refs
  - `catalogSpecDiff.ts`: added/removed/changed detection, edge cases
  - `curlGenerator.ts`: catalog endpoint shape (extend existing test suite)
  - `useCatalog.ts`: CRUD operations, version management

- [ ] **E2E tests**
  - Import a spec → verify sidebar entry appears
  - Click endpoint → verify detail view renders
  - Fill params → "Try It" → verify response display
  - Copy cURL → verify clipboard content

### Acceptance Criteria
- Overview page shows meaningful stats
- "Send to Workbench" creates valid WorkbenchRequest objects
- All spec formats (OpenAPI 3.0, 3.1, Swagger 2.0) work correctly
- Test coverage for all new utilities

---

## Phase Dependencies

```
Phase 1 (Foundation)
    │
    ├──▶ Phase 2 (Endpoint Browser)
    │       │
    │       ├──▶ Phase 3 (Interactive Testing)
    │       │       │
    │       │       └──▶ Phase 4 (cURL Integration)
    │       │
    │       └──▶ Phase 5 (Versioning)    ← can parallel with Phase 3
    │
    └──────────────────▶ Phase 6 (Polish) ← after all above
```

Phases 3 and 5 are **independent** after Phase 2 — they can be built in parallel
or in either order. Phase 4 requires Phase 3 (needs the filled parameter values).
Phase 6 comes last as it ties everything together.

---

## Suggested Version Mapping

| Phase | RedfireForge Version | Branch |
|---|---|---|
| Phase 1–2 | Part of next minor | `feature/api-catalog-foundation` |
| Phase 3–4 | Same or next minor | `feature/api-catalog-interactive` |
| Phase 5 | Next minor | `feature/api-catalog-versioning` |
| Phase 6 | Same release as Phase 5 | `feature/api-catalog-polish` |

---

_Created: 2026-04-18_
