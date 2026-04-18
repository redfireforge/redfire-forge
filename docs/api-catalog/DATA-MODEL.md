# API Catalog — Data Model

> Type definitions, storage design, and OpenAPI/Swagger-to-Catalog field mapping.
> Supports both **Swagger 2.0** and **OpenAPI 3.0.x / 3.1.x** specifications.

---

## 1. Type Definitions

All types live in `src/types/catalog.ts`.

### Core Entry

```typescript
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
}
```

### Versioning

```typescript
export interface CatalogVersion {
  id: string;
  version: string;                      // from info.version (e.g. "3.2.1")
  importedAt: number;                   // timestamp
  rawSpec: string;                      // original YAML/JSON for re-parse & export
  specHash: string;                     // SHA-256 of rawSpec for quick change detection
  changelog?: string;                   // optional user note on what changed
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
export type ResolutionStrategy = 'global' | 'inherited' | 'hardcoded';

export interface HostConfig {
  strategy: ResolutionStrategy;
  hardcodedUrl?: string;                // when strategy = 'hardcoded'
  selectedServerId?: string;            // index into CatalogEntry.servers[]
  globalEnvId?: string;                 // link to Workbench environment
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
structure. The parser uses `@apidevtools/swagger-parser` which handles Swagger 2.0
internally, so the mapping below describes the unified output.

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
| `definitions` | (dereferenced into schemas) | swagger-parser resolves `$ref` to `#/definitions/*` |
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
'catalog-entries'  →  CatalogEntry[]
```

Uses the same `loadData<T>(key)` / `saveData<T>(key, value)` abstraction that
powers Projects and Workbench. Works in both web (localStorage) and desktop
(Tauri FS plugin).

### Size Considerations

| Concern | Mitigation |
|---|---|
| Large raw YAML specs (1–5 MB each) | Store compressed or only last N versions; raw spec is only for re-parse/export |
| Many endpoints per entry | Endpoints are plain objects, lightweight in JSON |
| Version accumulation | Default: keep last 10 versions; configurable in settings |
| Total storage | localStorage limit ~5–10 MB; Tauri FS has no limit. Warn user if approaching limit |

### Save Triggers

Catalog data is saved whenever:
- A new spec is imported
- A spec is re-imported (new version)
- Host/auth config is changed
- An entry is deleted
- Version is restored

Debounced save (200ms) to avoid excessive writes during rapid config changes.

---

## 4. Relationship to Existing Types

The Catalog types are deliberately **separate** from Workbench and Project types.
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

When "Send to Workbench" is implemented, a mapper function converts:

```typescript
function catalogEndpointToWorkbenchRequest(
  endpoint: CatalogEndpoint,
  hostConfig: HostConfig,
  authConfig: CatalogAuthConfig,
  servers: CatalogServer[],
): WorkbenchRequest
```

This is a one-way copy — changes in Workbench do not flow back to the Catalog.

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

## 6. Runtime State (Not Persisted)

Some state is session-only and not saved to storage:

```typescript
interface CatalogSessionState {
  // Per-endpoint filled parameter values (lost on refresh)
  filledParams: Map<string, Record<string, string>>;  // endpointId → paramName → value
  filledBody: Map<string, string>;                      // endpointId → edited body string

  // Last response per endpoint (lost on refresh)
  lastResponse: Map<string, CatalogTryItResponse>;

  // UI state
  endpointNavCollapsed: boolean;
  endpointNavWidth: number;
  expandedTags: Set<string>;
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

This state lives in the `useCatalog` hook as React state. It resets on page
reload, which is acceptable for an interactive testing tool.

---

_Created: 2026-04-18_
