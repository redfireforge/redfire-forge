# API Catalog — Data Model

> Type definitions, storage design, and OpenAPI/Swagger-to-Catalog field mapping.
> Supports both **Swagger 2.0** and **OpenAPI 3.0.x / 3.1.x** specifications.

---

## 1. Type Definitions

All types live in `src/types/catalog.ts`.

### Core Entry

```typescript
export interface CatalogEnvironment {
  id: string;
  name: string;                         // e.g. "Test", "Staging", "Production"
  baseUrl: string;                      // e.g. "https://api.test.example.com/v1"
}

export interface CatalogEntry {
  id: string;
  name: string;                         // from info.title
  description?: string;                 // from info.description
  currentVersionId: string;             // points to active CatalogVersion
  versions: CatalogVersion[];           // ordered by importedAt descending
  servers: CatalogServer[];             // from servers[]
  securitySchemes: Record<string, CatalogSecurityScheme>;
  folders: CatalogFolder[];             // endpoints grouped by tag
  endpoints: CatalogEndpoint[];         // untagged endpoints (no tag)
  hostConfig: HostConfig;               // how to resolve the base URL
  authConfig: CatalogAuthConfig;        // how to resolve auth
  savedAuth?: AuthConfig;               // persisted auth configuration
  environments?: CatalogEnvironment[];  // user-defined environments (Edit modal)
  activeEnvironmentId?: string;         // currently selected environment
}
```

### Versioning

```typescript
export interface CatalogVersion {
  id: string;
  version: string;                      // from info.version (e.g. "3.2.1")
  importedAt: number;                   // timestamp
  specHash: string;                     // SHA-256 of rawSpec for quick change detection
  changelog?: string;                   // optional user note on what changed
  specSize: number;                     // rawSpec byte length (for storage UI)
  // rawSpec is NOT stored here — see "Lazy-Loaded Raw Specs" below
}
```

### Folder & Endpoint Structure

```typescript
export interface CatalogFolder {
  id: string;
  name: string;                         // tag name or custom grouping
  description?: string;                 // from tag description in spec
  endpoints: CatalogEndpoint[];
  folders: CatalogFolder[];             // sub-grouping if needed
}

export interface CatalogEndpoint {
  id: string;
  operationId?: string;                 // from operationId
  summary: string;                      // from summary or operationId fallback
  description?: string;                 // from description
  method: HttpMethod;                   // GET, POST, PUT, PATCH, DELETE
  path: string;                         // e.g. "/v1/products/{id}"
  parameters: CatalogParameter[];
  requestBody?: CatalogRequestBody;
  responses: CatalogResponse[];
  security?: string[];                  // security scheme names required
  deprecated?: boolean;
  tags: string[];                       // original tag names for cross-reference
}
```

### Parameters

```typescript
export interface CatalogParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema: SchemaObject;
  example?: unknown;
}

export type SchemaObject = {
  type?: string;                        // "string", "integer", "number", "boolean", "array", "object"
  format?: string;                      // "date-time", "email", "uuid", etc.
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;                 // for arrays
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  allOf?: SchemaObject[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};
```

### Request Body & Responses

```typescript
export interface CatalogRequestBody {
  required: boolean;
  description?: string;
  contentTypes: CatalogContentType[];
}

export interface CatalogContentType {
  mediaType: string;                    // "application/json", "application/xml", etc.
  schema: SchemaObject;
  example?: unknown;
}

export interface CatalogResponse {
  statusCode: string;                   // "200", "404", "default"
  description: string;
  schema?: SchemaObject;
  example?: unknown;
  headers?: Record<string, CatalogParameter>;
}
```

### Server & Security

```typescript
export interface CatalogServer {
  url: string;                          // "https://api.example.com/v1"
  description?: string;                 // "Production", "Staging"
  variables?: Record<string, CatalogServerVariable>;
}

export interface CatalogServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

export interface CatalogSecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;                        // for apiKey: header/query param name
  in?: 'header' | 'query' | 'cookie';  // for apiKey
  scheme?: string;                      // for http: "bearer", "basic"
  bearerFormat?: string;                // for http bearer: "JWT"
  description?: string;
  // OAuth2 flows stored but not fully modeled for MVP
  flows?: Record<string, unknown>;
}
```

### Host & Auth Configuration

```typescript
export type ResolutionStrategy = 'global' | 'inherited' | 'hardcoded' | 'environment';

export interface HostConfig {
  strategy: ResolutionStrategy;
  hardcodedUrl?: string;                // when strategy = 'hardcoded'
  selectedServerIndex?: number;         // index into CatalogEntry.servers[]
  globalEnvId?: string;                 // link to global environment (Requests / shared config)
  environmentId?: string;               // link to CatalogEntry.environments[] (when strategy = 'environment')
}

export interface CatalogAuthConfig {
  strategy: ResolutionStrategy;
  hardcoded?: AuthConfig;               // reuses existing AuthConfig from types/index.ts
  globalProfileId?: string;             // link to app GlobalAuthProfile
  inheritedSchemeId?: string;           // which securityScheme from the spec
}
```

---

## 2. OpenAPI / Swagger → Catalog Mapping

Both Swagger 2.0 and OpenAPI 3.x specs are normalized into the same `CatalogEntry`
structure by the custom parser (`src/features/catalog/utils/openApiParser.ts`, built on
the `yaml` package). The mapping below describes that unified output. Normalization
happens **in the model only** — the raw spec text is stored unchanged, and only internal
`#/` `$ref` are resolved (no external-file / URL / circular resolution).

### OpenAPI 3.x Field Mapping

| OpenAPI Field | CatalogEntry Field | Notes |
|---|---|---|
| `info.title` | `name` | |
| `info.description` | `description` | |
| `info.version` | `versions[0].version` | |
| `servers[]` | `servers[]` | Each server → `CatalogServer` |
| `servers[].variables` | `servers[].variables` | |
| `components.securitySchemes` | `securitySchemes` | |
| `paths./foo.get` | Endpoint with `method: 'GET'`, `path: '/foo'` | |
| `paths./foo.get.operationId` | `endpoint.operationId` | |
| `paths./foo.get.summary` | `endpoint.summary` | Falls back to operationId or path |
| `paths./foo.get.description` | `endpoint.description` | |
| `paths./foo.get.tags` | Used to group into `CatalogFolder` | One folder per unique tag |
| `paths./foo.get.parameters` | `endpoint.parameters[]` | Merged with path-level params |
| `paths./foo.get.requestBody` | `endpoint.requestBody` | |
| `paths./foo.get.responses` | `endpoint.responses[]` | |
| `paths./foo.get.security` | `endpoint.security[]` | Scheme names |
| `paths./foo.get.deprecated` | `endpoint.deprecated` | |

### Swagger 2.0 Field Mapping

Swagger 2.0 specs use a different structure. The parser normalizes these into the
same `CatalogEntry` shape so the rest of the app doesn't need to care which format
was imported.

| Swagger 2.0 Field | CatalogEntry Field | Normalization |
|---|---|---|
| `host` + `basePath` + `schemes` | `servers[].url` | Compose: `{scheme}://{host}{basePath}` for each scheme |
| `info.title` | `name` | Direct mapping (same as OpenAPI 3.x) |
| `info.version` | `versions[0].version` | Direct mapping |
| `definitions` | (inlined into schemas) | parser resolves internal `#/definitions/*` `$ref` |
| `paths./foo.get` | Endpoint with `method: 'GET'` | Same as OpenAPI 3.x |
| `parameters[].in: 'body'` | `endpoint.requestBody` | Body param → `requestBody` with `application/json` content type |
| `parameters[].in: 'formData'` | `endpoint.requestBody` | Form params → `requestBody` with `form-urlencoded` or `form-data` |
| `produces` | `endpoint.responses[].contentTypes` | Global `produces` applied to all responses unless overridden |
| `consumes` | `endpoint.requestBody.contentTypes` | Global `consumes` applied to all request bodies unless overridden |
| `securityDefinitions` | `securitySchemes` | Renamed; `type: 'basic'` → `type: 'http', scheme: 'basic'` |
| `tags[]` (top-level) | `folders[].description` | Tag descriptions applied to folder metadata |

### Format Detection

The parser auto-detects the spec format:

| Indicator | Detected As |
|---|---|
| `swagger: "2.0"` field present | Swagger 2.0 |
| `openapi: "3.0.x"` field present | OpenAPI 3.0 |
| `openapi: "3.1.x"` field present | OpenAPI 3.1 |
| Neither field present | Invalid spec (parser rejects with error) |

---

## 3. Storage Design

### Storage Keys

```typescript
// In src/utils/storage.ts, add:

// Primary key — loaded at app startup (lightweight, no raw specs)
'catalog-entries'  →  CatalogEntry[]

// Per-version raw spec — loaded on demand only
'catalog-spec-{entryId}-{versionId}'  →  string   // raw YAML/JSON text
```

Uses the same `loadData<T>(key)` / `saveData<T>(key, value)` abstraction that
powers Harness and Requests. Works in both web (localStorage) and desktop
(Tauri FS plugin).

### Lazy-Loaded Raw Specs

The `rawSpec` (original YAML/JSON text) is the largest piece of data per version
— typically 70–80% of total catalog storage. It is only needed for:

- **Re-export** — "Export Original Spec" in context menu
- **Version diff** — comparing two versions in Version History
- **Version restore** — re-parsing an older version's spec

Since these are infrequent actions, `rawSpec` is stored in **separate keys** and
loaded on demand:

```typescript
// Saving a raw spec (at import time):
saveData(`catalog-spec-${entryId}-${versionId}`, rawYamlString);

// Loading a raw spec (only when user opens Version History, exports, etc.):
const rawSpec = await loadData<string>(`catalog-spec-${entryId}-${versionId}`);
```

This means the primary `catalog-entries` key stays small (only parsed
`CatalogEntry` objects without raw text), keeping app startup fast.

### Storage Access Patterns

```
App Startup
    │
    └──▶ loadData('catalog-entries')        ~50–500 KB (parsed entries only)
         Fast — no raw specs loaded

User clicks "Version History"
    │
    └──▶ loadData('catalog-spec-abc-v1')    ~80 KB (one raw spec)
    └──▶ loadData('catalog-spec-abc-v2')    ~80 KB (another raw spec)
         On-demand — only when diffing

User clicks "Export Original Spec"
    │
    └──▶ loadData('catalog-spec-abc-v3')    ~80 KB (current version raw spec)
         On-demand — only when exporting
```

### Size Budget

| Item | Typical Size | Stored In |
|---|---|---|
| `CatalogEntry` (50 endpoints, no rawSpec) | ~40 KB | `catalog-entries` |
| `CatalogEntry` (200 endpoints, no rawSpec) | ~150 KB | `catalog-entries` |
| `rawSpec` (50-endpoint YAML) | ~80 KB | `catalog-spec-{id}-{vid}` |
| `rawSpec` (200-endpoint YAML) | ~400 KB | `catalog-spec-{id}-{vid}` |

Realistic workspace: **10 APIs × 3 versions each**

| Data | Size | Loaded At |
|---|---|---|
| 10 × `CatalogEntry` (avg 50 eps) | ~400 KB | Startup |
| 30 × `rawSpec` (avg 80 KB) | ~2.4 MB | On demand |
| **Total** | **~2.8 MB** | |
| **In memory at startup** | **~400 KB** | |

### Version Cap

Default: keep the **last 10 versions** per entry. Configurable in Settings.

When a new version is imported and the cap is reached:
1. Delete the oldest `CatalogVersion` from the entry's `versions[]` array
2. Delete the corresponding `catalog-spec-{entryId}-{versionId}` storage key
3. Save the updated entry

### Optional LZ Compression (Web Mode)

For web mode where localStorage is limited (~5–10 MB), raw specs can be
compressed before storage using `lz-string` (browser-compatible, zero
dependencies, ~5 KB library):

| Spec Size | Raw | Compressed | Savings |
|---|---|---|---|
| 80 KB YAML | 80 KB | ~16 KB | ~80% |
| 400 KB YAML | 400 KB | ~80 KB | ~80% |

YAML/JSON compresses extremely well because of repetitive structure (schema
definitions, response patterns, etc.).

Implementation:
```typescript
// Compress on save
saveData(`catalog-spec-${id}-${vid}`, lzCompress(rawSpec));

// Decompress on load
const rawSpec = lzDecompress(await loadData(`catalog-spec-${id}-${vid}`));
```

Compression is enabled by default in web mode, disabled in desktop (Tauri has
no storage limit so the CPU cost isn't worth it).

### Storage Usage Indicator

Show in Settings → Catalog section:

```
Catalog Storage
━━━━━━━━━━━━━━━━━━░░░░░░░  1.8 MB / 5 MB (36%)

  Sales Product API     3 versions    320 KB
  Payment Gateway       2 versions    180 KB
  Notification Svc      5 versions    890 KB
  ...

  [Purge Old Versions]  [Clear All]
```

Warn at 80% capacity. At 95%, block new imports until user frees space.

### Pruning Old Versions

For versions older than the configured cap, two pruning strategies:

| Strategy | What's Kept | What's Deleted | Use Case |
|---|---|---|---|
| **Soft prune** (default) | Version metadata + `specHash` + diff summary | `rawSpec` (the large string) | User sees history but can't re-export or restore old versions |
| **Hard prune** | Nothing | Entire `CatalogVersion` + `rawSpec` | Clean slate, minimal storage |

Soft prune preserves the version timeline while reclaiming ~90% of the storage
for that version.

### Save Triggers

Catalog data is saved whenever:
- A new spec is imported (entry + raw spec)
- A spec is re-imported (new version + raw spec)
- Host/auth config is changed (entry only)
- Auth config is changed (entry `savedAuth` updated)
- Environments are added/edited/removed (entry `environments` updated)
- Endpoint form values change (debounced, per-endpoint key)
- An entry is deleted (entry + all its raw specs + endpoint values)
- Version is restored (entry only)
- Version is pruned (entry + pruned raw specs)

Debounced save (200ms) for the primary `catalog-entries` key to avoid excessive
writes during rapid config changes. Raw spec saves are immediate (one-time on
import).

---

## 4. Relationship to Existing Types

The Catalog types are deliberately **separate** from Requests and Harness project types.
They share some primitives:

```
types/index.ts (existing)         types/catalog.ts (new)
─────────────────────────         ─────────────────────────
AuthConfig ◄──────────────────── CatalogAuthConfig.hardcoded
HttpMethod ◄──────────────────── CatalogEndpoint.method
KeyValue   (not used)             CatalogParameter (richer)
```

The `AuthConfig` type is reused directly when `strategy === 'hardcoded'`.
The `HttpMethod` type is reused for endpoint methods.
`KeyValue` is NOT reused because catalog parameters have richer metadata
(required, schema, description, location).

### Bridge Types (Phase 6)

When "Send to Requests" exports catalog endpoints, each `RequestItem` receives
a `catalogMeta` field carrying metadata from the original OpenAPI spec. This
is populated by `buildExportRequests()` in `src/utils/catalogExport.ts`.

```typescript
export interface CatalogRequestMeta {
  operationId?: string;                 // from endpoint.operationId
  description?: string;                 // from endpoint.description
  originalPath: string;                 // the OpenAPI path, e.g. "/v1/users/{id}"
  tags: string[];                       // from endpoint.tags
  deprecated?: boolean;                 // set only when true
  parameters?: {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required: boolean;
    description?: string;
    type?: string;                      // from parameter.schema.type
  }[];
  expectedResponses?: {
    statusCode: string;                 // "200", "404", "default"
    description: string;
  }[];
  security?: string[];                  // security scheme names required
  sourceSpec?: string;                  // e.g. "Payment API v2.3.1"
}
```

The `sourceSpec` string is composed from the catalog entry name and version
label at export time (e.g., `"Sales Product API 1.0.0"`).

This metadata is displayed in the **API Info Drawer** — an on-demand side
panel in the Request Editor toggled via the "ℹ API Info" button. The drawer
replaces the response panel when active and shows operation details,
parameter tables, response tables, security requirements, and source info.

Sidebar indicators: catalog-origin requests show a clipboard icon (📋) and
deprecated endpoints show a warning icon (⚠️) with strikethrough styling.

This is a one-way copy — changes in Requests do not flow back to the Catalog.

### Group Collections

Collections support a `groupId` field that links a collection to a parent
group collection (`mode: 'group'`). Groups are stored in the same flat
`RequestsData.collections[]` array and rendered hierarchically at display time.

```typescript
export interface RequestCollection {
  // ...existing fields...
  mode: 'direct' | 'multi-env' | 'group';  // 'group' is a container-only collection
  groupId?: string;                          // links to parent group's id
}
```

Groups support recursive nesting — a group can contain other groups.
Utility functions in `src/utils/requestTree.ts`:

| Function | Purpose |
|---|---|
| `countGroupRequests(groupId, collections)` | Recursively count all requests under a group |
| `collectGroupIds(groupId, collections)` | Collect all nested group IDs (for cascading deletes) |
| `collectAllGroups(collections, parentGroupId?, depth?)` | Build a flat list of groups with depth for dropdown rendering |

---

## 5. Diff Result Types (Phase 5)

```typescript
export type EndpointChangeType = 'added' | 'removed' | 'changed';

export interface EndpointDiff {
  method: HttpMethod;
  path: string;
  changeType: EndpointChangeType;
  details?: string[];                   // human-readable change descriptions
}

export interface CatalogSpecDiff {
  fromVersion: string;
  toVersion: string;
  added: EndpointDiff[];
  removed: EndpointDiff[];
  changed: EndpointDiff[];
  summary: {
    totalAdded: number;
    totalRemoved: number;
    totalChanged: number;
  };
}
```

---

## 6. Persisted & Runtime State

### Persisted (survives refresh / restart)

| Data | Storage Key | Notes |
|---|---|---|
| Auth configuration | `savedAuth` field on `CatalogEntry` | Bearer tokens, OAuth2 credentials, API keys |
| Endpoint form values | `perf-test-catalog-ep-{entryId}` | Parameter values, header values, request bodies per endpoint |
| Environments | `environments` field on `CatalogEntry` | User-defined name + baseUrl pairs |
| Active environment | `activeEnvironmentId` on `CatalogEntry` | Which environment is selected |
| Host strategy | `hostConfig` field on `CatalogEntry` | From Spec / Environment / Custom URL selection |

```typescript
export interface SavedEndpointValues {
  params: Record<string, string>;       // paramName → filled value
  headers: Record<string, string>;      // headerName → filled value
  body: string;                         // edited request body
}
```

### Session-only (lost on refresh)

```typescript
interface CatalogSessionState {
  lastResponse: Map<string, CatalogTryItResponse>;

  // UI state
  expandedTags: Set<string>;
  activeView: 'overview' | 'endpoints';
}

interface CatalogTryItResponse {
  status: number;
  statusText: string;
  responseTimeMs: number;
  responseSize: number;
  body: string;
  headers: Record<string, string>;
}
```

Session-only state lives in React component state. Response data resets on
page reload, which is acceptable for an interactive testing tool.

---

_Created: 2026-04-18 · Updated: 2026-04-19_
