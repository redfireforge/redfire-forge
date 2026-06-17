# GraphQL Studio — Feature Plan

> **Status**: Planning  
> **Target Version**: v0.8.x  
> **Prerequisites**: WebSocket Studio (done), Kafka Studio (done), SSE Studio (done)  
> **Last Updated**: 2026-06-16  
> **Editor**: Monaco (already in project via `@monaco-editor/react`)

---

## 1. Executive Summary

Add a **GraphQL Studio** tab to RedfireForge's Protocol Studios, enabling users to:
- Compose and execute queries, mutations, and subscriptions against any GraphQL endpoint
- Explore schemas via introspection with a visual Schema Explorer
- Build operations visually with a point-and-click query builder
- Manage variables, headers, and authentication per-connection
- Track response performance (latency, resolver tracing)
- Save operations to collections and share them
- Integrate with the workflow engine for automated GraphQL testing

This follows the established protocol studio pattern (WebSocket → Kafka → SSE → **GraphQL**).

---

## 2. Market Research & Tool Landscape

### 2.1 Commercial Tools

| Tool | Key Features | Subscription Support | Strengths |
|------|-------------|---------------------|-----------|
| **Postman** | Visual query builder, schema introspection, collections, environments, auth (OAuth2/JWT/AWS), collaboration | ✅ (filterable stream) | Unified platform, team collaboration, multi-protocol |
| **Apollo Studio (GraphOS)** | Schema registry, operation metrics, traces, breaking change detection, Explorer IDE | ✅ (via gateway) | Deep federation support, production monitoring, supergraph management |
| **Insomnia** | Query editor with autocomplete, environment variables, plugins, code generation | ✅ (basic) | Fast, lightweight, open-source core |
| **Thunder Client (VS Code)** | Inline VS Code GraphQL client, collections, env variables | ❌ | IDE-native, zero-config |
| **Hoppscotch** | Open-source Postman alternative, GraphQL tab, real-time subscriptions, collections | ✅ | Free, fast, web-based |
| **RapidAPI/Paw** | Schema explorer, history, code gen, team features | ✅ | Mac-native (Paw), API marketplace |

### 2.2 Open-Source Tools

| Tool | Stars | Key Features | Status |
|------|-------|-------------|--------|
| **GraphiQL** | 16.8k | Official reference IDE, CodeMirror 6/Monaco modes, plugin API, explorer plugin, language service (LSP) | Active (monorepo) |
| **Altair GraphQL Client** | 5k+ | Desktop/Chrome/Firefox, environments, pre-request scripts, file upload, collections, plugin system, auto-schema refresh, query generation from schema | Active (v8.5.4) |
| **GraphQL Playground** | 8.8k | Multi-tab, subscriptions, docs sidebar, tracing, schema polling, sharing (GraphQL Bin) | **Archived** (2026) — merged into GraphiQL |
| **Banana Cake Pop** | — | .NET HotChocolate ecosystem, schema explorer, document sync | Active |
| **GraphQL Voyager** | 7k+ | Visual schema relationship explorer (ER-diagram style) | Maintained |
| **Stellate** | — | Edge caching, rate limiting, metrics dashboard (acquired by The Guild) | Active |
| **Hive (The Guild)** | — | Schema registry, composition checks, observability, gateway, federation audit | Active (MIT) |

### 2.3 Key Libraries for Integration

| Library | Purpose | Notes |
|---------|---------|-------|
| `graphql` (npm) | Core parser/validator/executor | Required — parse, validate, introspect |
| `monaco-graphql` | Monaco editor GraphQL mode | From GraphiQL monorepo — syntax, autocomplete, validation |
| `graphql-language-service` | Autocomplete, diagnostics, hover | Powers `monaco-graphql` under the hood |
| `graphql-ws` | WebSocket subscriptions (spec-compliant) | Modern `graphql-transport-ws` protocol |
| `subscriptions-transport-ws` | Legacy subscription protocol | Deprecated but still used by Apollo Server ≤v3 |
| `@graphql-tools/utils` | Schema utilities, merging | The Guild ecosystem |
| `@graphql-tools/mock` | Auto-mock schema resolvers | For mock server feature |
| `graphql-request` | Minimal GraphQL client | Code-gen target only — not installed as a runtime dependency |
| `extract-files` | File upload (multipart) | GraphQL multipart request spec |
| `meros` | Incremental delivery parsing | `@defer`/`@stream` multipart response |

### 2.4 Key Differentiating Features from Research

Features discovered across competitors that we should prioritize:

| Feature | Found In | Priority for Us |
|---------|----------|----------------|
| **Pre-request / post-response scripts** | Altair, Postman | P2 — dynamic auth tokens, response chaining, advanced testing |
| **File upload (multipart)** | Altair, Postman | P1 — common GraphQL pattern |
| **Persisted queries (APQ)** | Apollo Studio | P2 — production workflow |
| **`@defer`/`@stream` incremental delivery** | Apollo Studio, GraphiQL | P1 — modern spec feature |
| **Query batching** | Apollo, Hoppscotch | P2 — performance optimization |
| **Schema polling / auto-refresh** | GraphQL Playground, Altair | P1 — great DX |
| **Environment variables** | Altair, Postman, Hoppscotch | P0 — essential for teams |
| **Operation collections with folders** | Postman, Apollo, Altair | P1 — organization |
| **Federation-aware introspection** | Apollo Studio, Hive | P2 — enterprise GraphQL |
| **Two-step schema search** (find field → find path) | Apollo Studio | P1 — superior UX |
| **GraphQL Config support** | GraphQL Playground, GraphiQL | P2 — project integration |

---

## 3. Feature Specification

### 3.1 Core Features (Phase 1 — MVP)

Phase 1 is organized into five subsystems (1A–1E).

---

#### 1A — Monaco Editor Integration

**`monacoGraphqlSetup.ts`** — the most complex Phase 1 utility:
1. Register the `monaco-graphql` Web Worker (lazy — loaded only when the GraphQL tab is first activated):
   ```typescript
   // In GraphqlStudioPage.tsx, on first mount:
   import { initializeMode } from 'monaco-graphql/esm/initializeMode';
   const api = initializeMode({ diagnosticSettings: { validateVariables: true } });
   ```
2. Bind the introspected schema to the language worker: `api.setSchemaConfig([{ introspectionJSON, uri: 'schema.graphql' }])` — called every time a new schema is introspected
3. Create one Monaco model per operation tab (`monaco.editor.createModel(query, 'graphql', modelUri)`) — each tab gets its own isolated model with its own diagnostics
4. Dispose unused models when tabs close (memory management)

**Multi-tab operations** (`GraphqlStudioPage.tsx`):
- Up to 8 tabs (same limit as WebSocket Studio)
- Each tab: `{ id, label, modelUri, variables, headers }`
- Tab bar: shows operation name (extracted from query AST) or "Untitled" for anonymous operations
- `[+]` button opens a new blank tab; `×` closes a tab (prompts to save if unsaved changes)
- `⌘T` / `Ctrl+T` keyboard shortcut (Tauri only — conflicts with new-tab in browsers, see Section 15)

**Operation name selector** (multi-operation documents):
- If a single document contains multiple named operations (e.g. `query A { ... } query B { ... }`), a dropdown appears in the connection bar: "Executing: [A ▾]"
- `graphql.parse(query).definitions` extracts named operations; `OperationDefinitionNode.name.value` gets the name
- If only one operation is defined, the dropdown is hidden

**Variables panel** (`GraphqlVariablesPanel.tsx`):
- Monaco editor in JSON mode (`language: 'json'`)
- JSON schema derived from the operation's variable definitions fed to Monaco's JSON validation
- When the query changes (debounced 300ms): extract `VariableDefinitionNode[]`, build a JSON Schema matching those types, register via `monaco.languages.json.jsonDefaults.setDiagnosticsOptions`

**Headers panel** (`GraphqlHeadersPanel.tsx`):
- Same key-value row component as WebSocket Studio's headers panel (reuse existing component)
- `{{var}}` interpolation: values are resolved against the active environment before request

---

#### 1B — Schema Explorer

**Introspection flow** (`useGraphqlSchema.ts` + `schemaParser.ts`):
1. User clicks "Introspect" or connects to an endpoint
2. `POST /api/graphql/introspect` sends the standard introspection query: `query IntrospectionQuery { __schema { ... } }`
3. Proxy forwards to upstream GraphQL endpoint, returns raw introspection JSON
4. `schemaParser.ts` converts `IntrospectionQuery` result → `GraphqlSchemaInfo` (navigable `GraphqlTypeNode[]` tree)
5. `monacoGraphqlSetup.ts` feeds the introspection JSON directly to the `monaco-graphql` worker for live autocomplete/validation
6. Schema cached in memory and `localStorage` (keyed by endpoint URL) — cache used on reconnect to avoid re-introspecting

**`schemaParser.ts`**:
- Input: raw `IntrospectionQuery.__schema`
- Output: `GraphqlSchemaInfo` with `types: GraphqlTypeNode[]`, root type names, full SDL
- Uses `graphql` library: `buildClientSchema(introspectionData)` → `GraphQLSchema`, then `printSchema()` for SDL
- Filters out built-in types (`__Schema`, `__Type`, etc.) and scalar built-ins from the type list

**Schema Explorer UI** (`GraphqlSchemaExplorer.tsx`):
- **Type list**: left sidebar with all types grouped by kind (Objects, Inputs, Enums, Interfaces, Unions, Scalars)
- **Search bar**: live filter — matches type name, field name, and description. Results show `TypeName.fieldName` with description excerpt
- **Type detail view**: click a type → right panel shows all fields with types + arguments + descriptions in a table
- **Click-to-insert**: clicking a field name or type name inserts it at the Monaco editor cursor position (via `editor.executeEdits()`)
- **SDL tab**: raw SDL view using Monaco in read-only GraphQL mode (syntax highlighted); "Copy SDL" + "Download .graphql" buttons

**Schema hash** (`useGraphqlSchema.ts`):
Schema change detection uses `crypto.subtle.digest('SHA-256', new TextEncoder().encode(sdl))` — no external hashing library required. The resulting `ArrayBuffer` is hex-encoded for storage. This is the same approach used by Phase 3's `apqClient.ts` for APQ hashes.

**Schema polling** (`useGraphqlSchema.ts`):
- Configurable interval from `GraphqlConnection.schemaPollingInterval` (default 30000ms, 0 = disabled)
- `setInterval` restarts on connection change; cleared on unmount or when tab is not focused
- On each poll: re-introspect; compare hash (`sha256(newSdl)` vs cached); if different → update all Monaco models + optionally toast "Schema updated"

**Introspection failure handling**:
| Scenario | User-facing message |
|---|---|
| Network unreachable / timeout | Red banner: "Cannot reach endpoint — check URL and network" |
| HTTP 401 | Red banner: "Authentication required — add a Bearer token or API key in Auth settings" |
| HTTP 403 | Red banner: "Access denied — token valid but lacks introspection permission" |
| HTTP 5xx | Red banner: "Server error (5xx) — endpoint returned an error during introspection" |
| Introspection disabled | Yellow banner: "Introspection is disabled on this server. You can still execute operations manually, but autocomplete and schema explorer will not work." |
| Response is not introspection JSON | Red banner: "Response is not a valid GraphQL introspection result — check the endpoint URL" |

**Detecting introspection-disabled**: When the server returns a `{ errors: [{ message: "..." }] }` response with HTTP 200 but an empty `data.__schema`, the error message is inspected for phrases like `"introspection"`, `"disabled"`, `"not allowed"` to show the specific yellow banner above rather than a generic error.

---

#### 1C — Execution Engine

**`useGraphqlExecution.ts`** — query/mutation lifecycle:
```typescript
interface ExecutionState {
  status:     'idle' | 'loading' | 'success' | 'error';
  response?:  GraphqlResponse;
  abortCtrl?: AbortController;
}
```

**Execution flow**:
1. User clicks Execute (or `⌘Enter`)
2. Interpolate `{{var}}` in headers against active environment
3. Inject auth header based on `GraphqlConnection.auth` type
4. Create `AbortController` → store in state
5. `POST /api/graphql/query` with `{ query, variables, operationName }`
6. On response: parse JSON → build `GraphqlResponse` → update state
7. On abort: catch `AbortError` → set status `'idle'` (no error shown)

**Request cancellation**:
- Escape key → `abortCtrl.abort()` — cancels the in-flight request (AbortController)
- Also available as a `[Cancel]` button that appears next to the Execute button while loading
- Proxy route forwards the `AbortSignal` through Node's `AbortController` to the upstream `fetch()`

**Client-side pre-execution validation** (`useGraphqlExecution.ts`):

Before sending the request, two client-side checks block execution and show an inline error:

1. **Invalid variables JSON**: `JSON.parse(variables)` throws → Execute button is disabled; a red border + "Invalid JSON" label appears on the Variables panel. Resolves as soon as the JSON becomes valid again (debounced 300ms parse check).

2. **Query AST validation** (when schema is available): `graphql.validate(schema, graphql.parse(query))` — runs against the introspected schema after every query edit (debounced 500ms). If validation errors are found:
   - They are shown as Monaco squiggles immediately (replacing any stale execution-time markers)
   - The Execute button shows a `⚠ N errors` badge (still clickable — server may be more permissive)
   - This is advisory, not blocking — some servers accept non-standard SDL; the user can override

If schema is not yet introspected, skip step 2 and let the server report errors.

The `ExecutionState` interface gains `operationName?: string` to carry the selected operation name when the document contains multiple named operations:
```typescript
interface ExecutionState {
  status:         'idle' | 'loading' | 'success' | 'error';
  response?:      GraphqlResponse;
  abortCtrl?:     AbortController;
  operationName?: string;   // active operation name when document has multiple named operations
}
```

**`GraphqlResponseViewer.tsx`**:
- Three tabs: **Response** (formatted JSON), **Headers** (HTTP response headers), **Metadata**
- Response tab: Monaco in read-only JSON mode (syntax highlighted, collapsible, searchable)
- Copy button: copies raw JSON to clipboard
- "Expand all" / "Collapse all" toggles for nested objects
- **Metadata tab**: shows HTTP status (colored: green 2xx, amber 3xx, red 4xx/5xx), latency ms, response size (bytes + humanized), content-type

**Error highlighting** in the editor:
- After execution: if `errors[].locations` present → call `monaco.editor.setModelMarkers(model, 'graphql-execution', markers)` with error squiggles at the reported line/column
- If `errors[].extensions.code` present → display code prominently in the Errors sub-tab (e.g. `UNAUTHENTICATED`, `NOT_FOUND`)
- Partial data: show both `data` and `errors` when both are present ("partial success" — 200 status but errors in body)

---

#### 1D — Connection Management

**`GraphqlConnectionBar.tsx`** — the horizontal bar at the top of the page:
- Endpoint URL input with `{{var}}` autocomplete dropdown
- Recent endpoints dropdown (last 10, stored in `localStorage`)
- Auth badge: `[Bearer ▾]` → opens auth config popover
- `[Execute ▶]` button (or `⌘Enter`)
- `[Introspect ⟳]` button (or `⌘Shift+I`)
- TLS skip toggle (⚠ icon, only shown when URL is `https://`)
- Schema polling indicator (green pulsing dot when polling is active)

**Auth header injection** (`graphqlClient.ts`):
```typescript
function buildAuthHeaders(auth?: GraphqlAuth): Record<string, string> {
  if (!auth) return {};
  switch (auth.type) {
    case 'bearer': return { Authorization: `Bearer ${auth.token}` };
    case 'basic':  return { Authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` };
    case 'apiKey': return { [auth.headerName!]: auth.headerValue! };
    case 'oauth2': return {};  // token fetched in pre-request script or via useGraphqlOAuth2 hook
    case 'custom': return {};  // arbitrary headers added directly in Headers panel
  }
}
```

**Auth config popover** (opens when clicking the auth badge in the connection bar):

The popover has a `Type` dropdown at the top:

| Selected type | Fields shown |
|---|---|
| None | _(no fields)_ |
| Bearer | `Token` text input (password-masked); "Test" button validates the token against `/api/graphql/introspect` |
| Basic | `Username` + `Password` inputs |
| API Key | `Header name` input (default `X-API-Key`) + `Header value` input (password-masked) |
| OAuth 2.0 | Read-only message: "OAuth2 token injection is handled by pre-request scripts (Phase 3). Set `Bearer` type here if you already have a token." |
| Custom | "Custom headers added directly in the Headers panel take precedence." |

All sensitive values (Bearer token, Basic password, API Key value) are stored in `localStorage` under the connection profile — not in plain text. Note: `localStorage` is not a secure credential store; advise users to use `{{secretVar}}` environment variable references for production tokens.

**Connection profiles** (`useGraphqlState.ts`):
- `GraphqlConnection[]` persisted in `localStorage` (same pattern as WebSocket Studio connections)
- Sorted by `updatedAt` descending (most recently used first)
- "Save as profile" button in connection bar → prompts for profile name
- Profile switcher dropdown shows all saved profiles with endpoint preview + auth type badge
- Delete profile: long-press or right-click on the profile name in the dropdown

---

#### 1E — Environment Variables (Phase 1 basics)

Phase 1 implements the foundation: `{{var}}` resolution in URL and headers. The full environment management UI (multiple named environments) is also Phase 1 since it is listed in Section 13.

**`useGraphqlEnvironments.ts`**:
- Manages `GraphqlEnvironment[]` — each has `id`, `name`, `variables: Record<string, string>`, `isActive: boolean`
- Active environment is the one with `isActive: true` (only one at a time)
- `resolveVars(str, env)` — replaces `{{key}}` in a string with the matching value; unresolved refs left as-is with a warning marker

**`GraphqlEnvironments.tsx`** — environment manager UI:
- Dropdown badge in connection bar: `[Staging ▾]` — shows active environment name
- Opens environment editor modal: left panel = environment list; right panel = key-value table
- Masked values toggle (eye icon) for secrets
- Quick-switch environments without losing current operation
- Import/export environments as JSON (Postman format compatible for import)

**`resolveVars` implementation details**:
```typescript
export function resolveVars(str: string, env: GraphqlEnvironment | undefined): string {
  if (!env) return str;
  // Single-pass replacement — nested/chained vars (e.g. {{a}} where a = "{{b}}") are NOT resolved
  return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => env.variables[key.trim()] ?? match);
  // Unresolved references are left as-is (e.g. "{{unknownVar}}" stays literal)
}
```
**Single-pass only**: `{{baseUrl}}` where `baseUrl = "{{scheme}}://api.example.com"` is NOT double-resolved. Phase 1 intentionally avoids recursive resolution to prevent infinite loops and to keep behavior predictable.

**Unresolved variable warnings**: When a header value or URL contains a `{{key}}` that is not in the active environment, the header row shows a `!` warning icon and a tooltip "Variable '{{key}}' not found in active environment". This is a visual warning only — the request still proceeds with the literal `{{key}}` string.

**Postman environment import format**:
```json
{
  "id": "...",
  "name": "My Environment",
  "values": [
    { "key": "baseUrl", "value": "https://api.example.com", "enabled": true },
    { "key": "token",   "value": "abc123",                  "enabled": true, "type": "secret" }
  ]
}
```
The importer reads `values[].key` → `value`, skips disabled entries (`enabled: false`). The `type: "secret"` field maps to `masked: true` in `GraphqlEnvironment.variables` metadata.

### 3.2 Advanced Features (Phase 2)

Phase 2 is organized into seven subsystems (2A–2G). Each subsystem is independently shippable and has its own component, hook, and proxy-route footprint.

---

#### 2A — WebSocket Subscriptions

**Transports**:
- **Primary**: `graphql-ws` npm package, WebSocket subprotocol `graphql-transport-ws` (modern, spec-compliant, maintained by The Guild)
- **Legacy fallback**: `subscriptions-transport-ws` npm package, WebSocket subprotocol `graphql-ws` (deprecated Apollo Server ≤v3 protocol)

**Proxy route — `WS /api/graphql/subscribe`**:
- Accept WebSocket upgrade from client
- Negotiate subprotocol with upstream: first try `graphql-transport-ws`; if server closes with `4406` (Subprotocol Not Acceptable) or `4400` (Bad Request) → re-connect advertising `graphql-ws` legacy subprotocol
- Relay all frames bidirectionally: `connection_init`, `subscribe`, `next`, `complete`, `error`, `ping`, `pong`
- Track active subscriptions by `id` to support multiplexing over a single WebSocket connection

**Protocol auto-detection algorithm**:
1. Open WebSocket to `wsEndpoint` with subprotocol `graphql-transport-ws`
2. Await handshake — three outcomes:
   - Server accepts `graphql-transport-ws` → use `graphql-ws` client library ✓
   - Server closes with `4406` or `4400` → retry with subprotocol `graphql-ws` (legacy)
   - Server closes with `1000` (normal) — ambiguous; do **not** retry; show "Connection closed unexpectedly" message
3. If legacy retry succeeds → use `subscriptions-transport-ws` client library ✓
4. If legacy retry also fails → surface error to user with manual protocol dropdown override in connection settings

**Subscription state machine** (in `useGraphqlSubscription.ts`):
```
idle → connecting → connected → subscribing → active ─┐
                                   ↑                    │
                            reconnecting ←──────────────┘ (on unexpected close)
                                   │
                                 error (max retries exceeded or permanent close code)
                                   │
                             disconnected (user-initiated complete frame)
```
- `idle`: no active subscription; subscribe button enabled
- `connecting`: WebSocket SYN in progress; spinner + "Connecting…"
- `connected`: WebSocket open, `connection_init` sent, awaiting `connection_ack`
- `subscribing`: `connection_ack` received; `subscribe` frame sent
- `active`: receiving `next` frames; live message count shown
- `reconnecting`: unexpected close; exponential backoff countdown visible ("Reconnecting in 4s…")
- `error`: unrecoverable — close code `4401` (Unauthorized), `4499` (terminate), `error` frame with non-retryable reason
- `disconnected`: clean exit via user-initiated `complete` frame or explicit disconnect click

**`wsEndpoint` URL derivation** (`graphqlClient.ts`):

When `GraphqlConnection.wsEndpoint` is not explicitly set, the WebSocket endpoint is derived from the HTTP endpoint:
```typescript
export function deriveWsEndpoint(httpEndpoint: string): string {
  return httpEndpoint
    .replace(/^https:\/\//i, 'wss://')
    .replace(/^http:\/\//i,  'ws://');
}
// e.g. "https://api.example.com/graphql" → "wss://api.example.com/graphql"
// e.g. "http://localhost:4000/graphql"   → "ws://localhost:4000/graphql"
```
If `wsEndpoint` is explicitly set (e.g. subscriptions on a different path like `wss://api.example.com/subscriptions`), that value is used as-is.

**Authenticated subscriptions via `connection_init_payload`**:

For the `graphql-transport-ws` (modern) and `graphql-ws` (legacy) protocols, auth tokens are **not** sent in HTTP headers — WebSocket upgrades only support query params or the `Sec-WebSocket-Protocol` header. The standard pattern is to pass auth in the `connection_init` message payload (`connectionParams`):

```typescript
// In graphqlClient.ts — building the graphql-ws Client
const client = createClient({
  url: wsEndpoint,
  connectionParams: async () => {
    // Dynamically fetch the current token (may be refreshed by pre-request script)
    const token = resolveVars('{{accessToken}}', activeEnv);
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
```

The server reads `connectionParams` from `context.connectionParams` and validates the token before allowing subscriptions. If `connectionParams` is rejected, the server closes with close code `4401` (Unauthorized) — which the state machine maps to the permanent `error` state (no retry).

`connectionParams` is built from `GraphqlConnection.auth` — the same `buildAuthHeaders()` function used for HTTP, but the result is passed as the `connectionParams` payload object instead of HTTP headers.

**Auto-reconnect**:
- Delay formula: `min(1000 × 2^attempt, 30_000)` ms ± 20% jitter (to avoid thundering herd)
- Max 5 attempts; count shown in status indicator
- Aborts immediately on close codes signaling permanent failure: `4400`, `4401`, `4499`
- User can click "Stop Reconnecting" at any time to cancel

**Connection status indicator** (colored pill in connection bar):
| State | Color | Label |
|-------|-------|-------|
| `idle` | Gray | Idle |
| `connecting` | Blue pulsing | Connecting… |
| `connected` | Blue | Handshaking… |
| `subscribing` | Blue | Subscribing… |
| `active` | Green | Active · N msgs |
| `reconnecting` | Orange | Reconnecting (N/5)… |
| `error` | Red | Error — {reason} |
| `disconnected` | Gray | Disconnected |

---

#### 2B — SSE Subscriptions

GraphQL over SSE follows the [`graphql-sse`](https://github.com/enisdenjo/graphql-sse) spec (distinct from the WebSocket protocols). The server must also use `graphql-sse` server-side.

**Two modes** (per `graphql-sse` spec):
- **Distinct connections mode** (default): Each subscription opens a new `GET {endpoint}` with `Accept: text/event-stream`. Operation is encoded in query params. Simple to implement; one SSE stream per subscription.
- **Single connection mode**: POST `{endpoint}/stream` once to establish a shared stream; multiplex multiple subscriptions via `id` within the event data. More efficient for many concurrent subscriptions.

**Proxy route — `GET /api/graphql/sse`**:
- Relay upstream SSE stream with correct `Content-Type: text/event-stream; charset=utf-8` and `Cache-Control: no-cache` headers
- Handle CORS for the upstream endpoint
- Forward `Last-Event-ID` header for resumability

**Client implementation** (in `graphqlClient.ts`):
- Use `graphql-sse` `createClient({ url, fetchFn })` — `fetchFn` routed through the proxy
- Expose same `subscribe(operation) → AsyncIterator` interface as the WebSocket client methods (same hook API, different transport under the hood)

**Auto-detection heuristics**:
- URL path ending in `/graphql/stream` → default to SSE single-connection mode
- Explicit `sseMode: 'distinct' | 'single'` setting in connection profile
- Manual transport override dropdown in connection settings: `WebSocket (modern) | WebSocket (legacy) | SSE`

**SSE error handling and reconnect**:

Unlike WebSocket, SSE connections are managed by the browser's `EventSource` API (or the `graphql-sse` client's fetch-based implementation). Reconnect behavior differs from WebSocket:

- **Automatic reconnect**: `graphql-sse`'s `createClient` handles reconnect automatically via its `retry` configuration. The client retries failed connections with increasing backoff, up to 5 attempts (same limit as WS).
- **`Last-Event-ID` resumability**: When the proxy forwards `Last-Event-ID` from the client, the upstream SSE server can resume the stream from the last acknowledged event ID — no messages are lost after a brief network interruption.
- **SSE state machine**: SSE uses a simplified version of the WS state machine (no `connected`/`subscribing` distinction since SSE has no handshake):
  ```
  idle → connecting → active ─┐
                ↑              │
          reconnecting ←───────┘ (on EventSource error)
                │
              error (max retries exceeded)
          disconnected (user-initiated close)
  ```
- **Error scenarios**: 
  | Scenario | Behavior |
  |---|---|
  | Network drop | `reconnecting` state; retry with Last-Event-ID |
  | HTTP 401/403 | Permanent `error` state (no retry — server rejected the subscription) |
  | CORS blocked | Red banner: "SSE blocked by CORS — route through proxy" |
  | Server sends `event: error` | Map to subscription `error` event; display in message log |
- **Status pill**: SSE uses the same colored status pill as WS (same 2C subscription log UI); the state labels differ slightly: no `handshaking/subscribing` steps.

---

#### 2C — Subscription UI (`GraphqlSubscriptionLog.tsx`)

The subscription log is the central UI for Phase 2 — all subscription transports (WS modern, WS legacy, SSE) feed the same log component.

**Message list**:
- Virtualized scrolling (CSS `contain: strict` + programmatic scroll-to-bottom) for performance at high message rates (>100 msg/s)
- Each message row:
  - `#N` index (sequential since subscribe)
  - Direction badge: `IN` (server push) in green, `OUT` (client send — e.g. ping/pong) in gray
  - Operation name (from subscription query)
  - Relative timestamp: `+1.23s` since subscribe started
  - Delivery latency: time from `subscribe` send to this `next` receipt (first message only) or inter-message gap
  - Collapsible JSON body with syntax highlighting (reuse `GraphqlResponseViewer` renderer)
  - Error indicator if message contains a GraphQL `errors` array

**Sticky header bar**:
- Total message count
- Error count (messages containing `errors`)
- Messages/sec: rolling 5-second average
- Connected duration: `HH:MM:SS` stopwatch

**Toolbar**:
- `[Pause]` / `[Resume]` — buffer new messages when paused; resume scrolls to newest
- `[Clear]` — wipe the log (connection stays active)
- `[Export JSON]` — download all messages as a JSON array
- `[Filter…]` — toggle inline filter bar

**Inline filter bar** (appears below toolbar when active):
- Text input with a mode toggle button: `[Text]` / `[JSONPath]`
  - **Text mode** (default): substring match against the JSON-stringified message body
  - **JSONPath mode**: evaluates the expression against each message's `data` object; messages where the result is falsy are hidden. Expressions can be simple path existence (`$.data.order.id`) or comparisons (`$.data.order.status == "SHIPPED"`). Uses `jsonpath-plus`.
- Live filter — messages not matching are hidden (not deleted from buffer)
- Match count: `Showing 4/17 messages`

**Message buffer limit**:
- Maximum 5,000 messages stored in the in-memory buffer (configurable 100–10,000 in connection settings)
- When the buffer is full, the oldest message is evicted (ring buffer / FIFO)
- A `⚠ Buffer capped at 5,000 messages — oldest removed` warning appears in the sticky header
- The `[Export JSON]` button exports only the current buffer (not evicted messages)

**`[Export JSON]` format** (downloaded as `graphql-subscription-{operationName}-{timestamp}.json`):
```json
{
  "_meta": {
    "exportedAt":    "2026-06-17T12:00:00Z",
    "operationName": "OnOrderStatusChanged",
    "totalMessages": 17,
    "durationMs":    45320,
    "transport":     "graphql-transport-ws"
  },
  "messages": [
    { "index": 1, "offsetMs": 120,  "data": { "order": { "status": "PENDING" } }, "errors": null },
    { "index": 2, "offsetMs": 3400, "data": { "order": { "status": "SHIPPED" } }, "errors": null }
  ]
}
```

**Assertion panel** (right sidebar, toggle):
- User defines N JSONPath assertions applied to every incoming message
- JSONPath evaluation uses `jsonpath-plus` npm package (`JSONPath.query(message, expression)`)
- Supported expression forms:
  - Existence: `$.data.order.id` (non-null/non-undefined result = pass)
  - Equality: `$.data.order.status == "SHIPPED"` (evaluated as JS expression after path resolution)
  - Numeric: `$.data.order.total > 0`
- Pass (green ✓) / Fail (red ✗) badge on each message row
- Aggregate footer: `N/M assertions pass` across all messages received
- **Note**: `jsonpath-plus` must be added to Phase 2 npm client dependencies

---

#### 2D — Incremental Delivery (`@defer` / `@stream`)

GraphQL `@defer` defers a fragment's resolution to a subsequent chunk. `@stream` streams list items one by one. Both use `multipart/mixed` HTTP responses.

**Example `@defer` response stream** (what `multipartParser.ts` processes):
```
HTTP/1.1 200 OK
Content-Type: multipart/mixed; boundary="---"
Transfer-Encoding: chunked

-----
Content-Type: application/json

{"data": {"user": {"id": "1", "name": "Alice"}}, "hasNext": true}
-----
Content-Type: application/json

{"incremental": [{"path": ["user", "reviews"], "data": [{"id":"r1","rating":5}]}], "hasNext": true}
-----
Content-Type: application/json

{"incremental": [{"path": ["user", "stats"], "data": {"orderCount": 42}}], "hasNext": false}
-----
```

**`multipartParser.ts`** responsibilities:
1. Use `meros` to split the `ReadableStream` into boundary-separated parts
2. Parse each part's JSON body
3. Apply incremental patches to the accumulated result using path-based merge: `merge(base, patch.path, patch.data)`
4. Emit events: `{ type: 'initial' | 'patch', patchIndex, path, merged }` — subscribed to by `useGraphqlExecution.ts`
5. Set `hasNext: false` signals completion of the incremental stream

**`GraphqlResponseViewer.tsx` updates for incremental delivery**:
- Fields covered by `@defer` show a **shimmer/skeleton** placeholder while their patch hasn't arrived
- Once a patch arrives, the skeleton dissolves and the real data renders with a brief green flash
- `@stream` lists show items appending in real time with a `[Streaming...]` badge at the bottom
- **Chunk tracker** toolbar above the response JSON:
  - `Chunk 1 of ? received` → progresses to `All 3 chunks received (890ms total)` when `hasNext: false`
  - Individual chunk timing shown on hover: `Chunk 2: +340ms`
- The fully-merged final JSON is what gets copied/exported (not the raw multipart stream)

**`@defer` / `@stream` AST detection** (in `useGraphqlExecution.ts`):

Before sending the request, the client checks whether the query uses incremental delivery:
```typescript
import { parse, visit } from 'graphql';

export function hasIncrementalDirective(query: string): boolean {
  try {
    const doc = parse(query);
    let found = false;
    visit(doc, {
      Directive(node) {
        if (node.name.value === 'defer' || node.name.value === 'stream') {
          found = true;
        }
      },
    });
    return found;
  } catch {
    return false; // parse error — let server report the problem
  }
}
```
If `hasIncrementalDirective(query)` is `true`:
- Set `Accept: multipart/mixed` on the request
- Route response through `multipartParser.ts` instead of a single `response.json()` call

If `false`: normal single-response path (no multipart overhead).

**Proxy route update** (`POST /api/graphql/query`):
- Client sends `Accept: multipart/mixed` in the request headers when the query contains `@defer` or `@stream`
- Proxy detects `Content-Type: multipart/mixed` in upstream response
- Passes through chunked response body without buffering (`Transfer-Encoding: chunked` preserved)
- Normalizes upstream boundary string to a fixed value for predictable client-side parsing

**Constraint — file upload and `@defer`/`@stream` cannot be combined**:
The `graphql-multipart-request-spec` uses `multipart/form-data`, while `@defer`/`@stream` responses use `multipart/mixed`. These are different multipart formats and cannot be mixed in a single request/response cycle. If the user adds a file variable AND uses `@defer`, show a validation error before execution: "File upload operations cannot use `@defer` or `@stream` — remove the `@defer` directive or the file variable."

**`IncrementalDeliveryResult` type** (used internally by `multipartParser.ts`):
```typescript
export interface IncrementalDeliveryResult {
  type:       'initial' | 'patch';
  patchIndex: number;
  path?:      Array<string | number>;   // path to the field being patched (undefined for initial)
  data?:      unknown;                  // the patched fragment data
  errors?:    GraphqlError[];           // errors for this specific patch
  merged:     unknown;                  // accumulated merged result so far
  hasNext:    boolean;                  // false on the final part
}
```

---

#### 2E — File Upload

GraphQL file upload follows the [graphql-multipart-request-spec](https://github.com/jaydenseric/graphql-multipart-request-spec) (used by Apollo Server, Yoga, Altair, Hasura).

**Request construction** (client-side):
1. In Variables panel, user marks file variable slots with `null` placeholder: `{"avatar": null}` or `{"files": [null, null]}`
2. In the new **Files tab** of the Variables panel, user assigns actual `File` objects to each `null` slot
3. `extract-files` library walks the variables object, extracts `File` objects, and returns `{ clone, files }` where `clone` has `null` in place of each file
4. Client constructs `FormData`:
   - `operations`: `JSON.stringify({ query, variables: clone })`
   - `map`: `JSON.stringify({ "0": ["variables.avatar"] })`
   - `0`: the actual `File` blob
5. Client POSTs `multipart/form-data` to `POST /api/graphql/upload`

**Proxy route** (`POST /api/graphql/upload`):
- `busboy` parses incoming `multipart/form-data`
- Reconstructs the equivalent `multipart/form-data` targeting the upstream GraphQL endpoint
- Streams file bytes to upstream — no buffering in memory (pipe directly)
- Sends `X-Upload-Progress: {bytesUploaded}/{totalBytes}` SSE-style progress events back to client during upload

**`GraphqlFileUpload.tsx`** (integrated as "Files" tab inside Variables bottom panel):
- Dropzone: drag-and-drop or "Browse" button opens file picker
- File list: each row shows filename, MIME type, size (humanized), a `×` remove button
- Auto-injects `null` placeholder into the Variables JSON for each file's variable path
- Multiple files: numbered keys `files.0`, `files.1` etc., or user-specified variable path
- Upload progress bar per file (filled as proxy reports `X-Upload-Progress`)

**File size validation** (client-side, before upload starts):
- **On file selection** (drag-drop or browse picker): `file.size` is checked immediately against `maxFileSize` from `GraphqlConnection`
- If `file.size > maxFileSize`: the file is rejected at selection time with an inline error on the file row: `"File too large (48 MB) — maximum is 50 MB"`. The file is added to the list in a red error state and cannot be submitted.
- If `file.size > 200 MB` (hard cap): same immediate rejection with `"File exceeds the 200 MB hard cap and cannot be uploaded"`
- The `[Execute]` button is disabled while any file row shows a size error

**`X-Upload-Progress` event format**:

The proxy sends progress as chunked SSE-style lines in the response body **before** the JSON result:
```
X-Upload-Progress: 1048576/10485760

X-Upload-Progress: 5242880/10485760

X-Upload-Progress: 10485760/10485760

{"data": {"uploadAvatar": {"url": "..."}}}
```
The client reads the response as a `ReadableStream`, splits on `
`, interprets lines starting with `X-Upload-Progress:` as progress updates (`bytesUploaded/totalBytes`), and the final non-prefix line is the GraphQL JSON response.

---

#### 2F — Visual Query Builder

The query builder lets users construct a GraphQL operation by clicking checkboxes on a schema tree — no manual typing required. The generated SDL is kept in sync with the Monaco editor.

**Architecture**:
```
GraphqlSchemaInfo (from useGraphqlSchema)
      ↓
GraphqlQueryBuilder.tsx  ←→  useGraphqlQueryBuilder.ts
      ↓ generates SDL via
  queryBuilder.ts
      ↓
  Monaco editor (read-only preview panel)
      ↓ "Edit in Editor" escape hatch
  Monaco editor (full edit mode — builder deactivated)
```

**Builder state** (`useGraphqlQueryBuilder.ts`):
```typescript
interface QueryBuilderState {
  operationType:  'query' | 'mutation' | 'subscription';
  operationName:  string;
  // Map from dot-notation field path ("user.preferences.theme") → selection options
  selectedFields: Record<string, FieldSelectionOptions>;
  // Map from "fieldPath.argName" → literal value or "$varRef"
  argValues:      Record<string, string>;
  // Map from field path → alias string
  aliases:        Record<string, string>;
  // Map from field path → applied directives
  directives:     Record<string, DirectiveApplication[]>;
  // Named fragments defined by the user
  fragments:      FragmentDefinition[];
}

interface FieldSelectionOptions {
  selected: boolean;
  partial:  boolean;  // true when an object-type field has only some children selected
}

interface DirectiveApplication {
  name:     '@skip' | '@include';
  ifVar:    string;   // name of the Boolean variable (auto-created in variables)
}

interface FragmentDefinition {
  name:     string;
  onType:   string;
  fields:   Record<string, FieldSelectionOptions>;
}
```

**SDL generator** (`queryBuilder.ts`):
- Recursively builds selection sets from `selectedFields` tree
- Inlines arguments as GraphQL literal values OR `$varName` references (auto-generates `$varName: TypeName` variable definitions)
- Appends `@skip(if: $var)` / `@include(if: $var)` directives per field
- Prefixes aliased fields: `alias: fieldName`
- Appends used fragment spreads (`...FragmentName`) and full fragment definitions at document end
- Returns a valid, prettily-formatted GraphQL document string

**Field tree UI** (`GraphqlQueryBuilder.tsx`):
- Root renders fields of the Query/Mutation/Subscription root type
- Each field row:
  - Checkbox (or partial-select `−`) to toggle selection
  - `⊕` button as alternative to checkbox (same toggle action)
  - Expand arrow `›` for Object/Interface/Union types (navigates into children)
  - Field name
  - Type badge: blue for Scalar, purple for Object, amber for Enum, teal for Interface/Union
  - `[DEPRECATED]` badge in gray for deprecated fields
  - On hover: short description from schema tooltip
- Expanded object type shows children indented; breadcrumb updates: `Query › user › preferences`
- Argument accordion: collapses under the field row when selected; shows per-arg input widget (text, number, boolean toggle, enum dropdown, `$var` reference switch)

**Two-step schema search** (Apollo Studio pattern):
1. User types in the search box at the top of the field tree
2. List immediately filters to matching fields across **all** types (not just root type)
3. Each result shows field name + parent type name + description excerpt
4. Clicking a result: auto-expands the tree to that field's full path from root + updates breadcrumb
5. Pressing Escape returns to the unfiltered root view

**Fragment panel** (right column in the builder, collapsible):
- `[+ New Fragment]` — name input + type selector (from schema types)
- Fragment list: each with its own mini field-selector for the chosen type
- Insert a fragment into the main query: click `Use` → inserts `...FragmentName` at the current selection level
- Highlights which fragments are used vs. defined but unused (unused shown in amber)

**Directive toggles** (per field row, visible on hover):
- `@skip` / `@include` buttons; click opens a popover to choose or create a Boolean variable
- The chosen variable is auto-added to the Variables panel as `{ "condVar": true }` (editable)
- Directive indicators shown inline on the field row label: `fieldName @skip($hideField)`

**Alias support**:
- Inline alias input appears on hover/focus of a selected field row
- User types the alias (validated: no spaces, no reserved names); field row updates: `alias: fieldName`

**Union and Interface type handling** (inline fragments):

When a field returns a Union or Interface type, the query builder must generate inline fragments (`... on ConcreteTypeName { }`), since you cannot select fields directly on abstract types.

Example: `OrderResult` is `union OrderResult = Order | OrderError`
```graphql
query GetOrder($id: ID!) {
  order(id: $id) {
    ... on Order  { id status total { amount currency } }
    ... on OrderError { code message }
  }
}
```

**Builder handling**:
- When the user expands a Union/Interface field in the tree, the children are grouped under concrete type headers: `─── Order ───` / `─── OrderError ───`
- Each group is an inline fragment target — selecting any field under a group automatically wraps it in `... on TypeName { }`
- The `selectedFields` map uses path keys like `order.__on_Order.id` and `order.__on_OrderError.code` to represent inline fragment selections
- The SDL generator detects `__on_TypeName` path segments and emits `... on TypeName { ... }` selection sets
- Interface fields common to all implementors (e.g. `id` on a `Node` interface) are shown at the top of the expansion, outside of concrete type groups

**"Select All" / "Deselect All"** (in builder toolbar):
- `[Select All]` — selects all fields at the current tree level (the root type, or the currently expanded object type). Does not recurse into child types (recursion would create enormous queries).
- `[Deselect All]` — deselects all fields at the current tree level and clears any argument values set for those fields.
- Both buttons are scoped to the current breadcrumb context (e.g. pressing "Select All" while at `Query › user › preferences` selects all `preferences` fields, not all `Query` fields).

**`QueryBuilderState` persistence** (`useGraphqlQueryBuilder.ts`):
- Builder state IS persisted across page reloads, stored in `localStorage` keyed by `${tabId}:builderState`
- Serialization: `JSON.stringify(builderState)` — all fields are JSON-serializable
- On reload: if `localStorage` has a saved state for the tab, it is restored; the builder renders in its previous selection state
- This allows users to build a complex query over multiple sessions without losing work
- `unsavedChanges` flag (from `GraphqlOperationTab`) is set to `true` when the builder state changes the generated SDL

**"Edit in Editor" escape hatch** (button in builder toolbar):
- Copies current generated SDL into the Monaco editor
- Deactivates the query builder (switches sub-tab back to Editor)
- Builder state is reset (two-way sync from editor-written SDL back to builder is out of scope — too complex; one-way only)

---

#### 2G — Performance & Tracing

**Apollo Tracing Waterfall** (`GraphqlTracingView.tsx`):

Renders when `extensions.tracing` is present in the response (Apollo Server returns this when `tracing: true` config is set, or when `apollo-tracing` plugin is enabled).

**Note on tracing formats**: This implementation targets Apollo Tracing v1 (`extensions.tracing.version === 1`). Other servers may return tracing data in different locations:
- **OpenTelemetry** (`extensions.opentelemetry`): structured differently; not supported in Phase 2 — flagged for Phase 3+
- **Yoga / Envelop**: `extensions.tracing` but with slightly different resolver paths — same v1 format, compatible
- When `extensions.tracing` is absent: the Tracing tab is hidden from the response panel

Structure of `extensions.tracing`:
```json
{
  "version": 1,
  "startTime": "...",
  "endTime": "...",
  "duration": 1234000,
  "execution": {
    "resolvers": [
      { "path": ["user"], "parentType": "Query", "fieldName": "user",
        "returnType": "User", "startOffset": 1000, "duration": 50000 }
    ]
  }
}
```

Display:
- Each resolver shown as a horizontal bar: position = `startOffset / totalDuration * width`, width = `duration / totalDuration * width`
- Label: `ParentType.fieldName → ReturnType`
- Color-coded duration: green < 50ms, amber 50–200ms, red > 200ms
- Hover tooltip: exact start offset, duration, return type
- Click row → scrolls the response JSON panel to the corresponding field
- Sort options: by start time (default), by duration descending (slowest resolvers first), by path alphabetical

**Query Complexity Estimator**:

Pre-execution cost estimate based on the query AST and schema structure.

Cost model (configurable per connection):
- Each scalar field selected: +1
- Each object-type field: +2
- Each list-type field: cost × `listMultiplier` (default 10, configurable)
- Inline fragment (`... on Type { }`) fields: same cost as their parent type contribution
- Named fragment spreads (`...FragmentName`): cost = sum of all fields within the fragment definition (resolved from the document)
- Directive `@defer` on a fragment: reduce its cost contribution by 50%
- Maximum depth penalty: each level beyond configurable `maxDepth` (default 10) doubles sub-tree cost

Display:
- Estimated cost badge next to the Execute button: `Cost: ~42`
- Badge color: green (< threshold / 2), amber (between threshold / 2 and threshold), red (> threshold)
- Configurable warning threshold (default 500) — located in a new **"Performance" tab** of the connection settings popover, alongside `listMultiplier` (default 10) and `maxDepth` (default 10) inputs
- Blocks execution with a confirmation dialog if cost > 2× threshold ("This query is very expensive — execute anyway?")

**Response Time Histogram**:
- Activated automatically after ≥3 executions of the same operation
- **Same-query detection**: uses a `SHA-256` hash of the normalized query text (`print(parse(query))` — normalizes whitespace and formatting) keyed by that hash. Named operations additionally group by `operationName`. Anonymous operations group by hash only.
- Stored in memory only (not persisted across sessions)
- Mini histogram (7 buckets) displayed in a collapsible strip at the bottom of the response panel
- Shows: min, P50, P95, P99, max with axis labels; bucket heights proportional to count
- Resets when the query hash changes (i.e. when the user edits the query text itself)

### 3.3 Power Features (Phase 3)

Phase 3 is organized into six subsystems (3A–3F). Each subsystem is independently shippable.

---

#### 3A — Collections & History

**Two data stores, one sidebar:**
- **History**: auto-saved ring buffer of every executed operation (last 100 per connection, configurable 10–500). Stored in IndexedDB. Never requires user action.
- **Collections**: named, user-curated sets of operations organized in a folder hierarchy. Also IndexedDB-persisted.

**History storage design** (`useGraphqlHistory.ts` + IndexedDB):
- Each entry is a `GraphqlHistoryItem` (operation + full response + timestamp)
- Keyed by `connectionId + timestamp` — enables fast range queries per connection
- Eviction: when `maxItems` is reached, the oldest entry is deleted (FIFO)
- Grouped by recency in the UI: **Today**, **Yesterday**, **Last 7 days**, **Older** — dividers auto-computed at render time

**History UI** (`GraphqlHistoryPanel.tsx`):
- Full-height sidebar with search bar at top (filters by operation name or query text)
- Each entry shows: operation type badge (Q/M/S), operation name, timestamp, latency, status (✓ / ✗)
- Hover → preview operation + response JSON in tooltip
- Click → load into current editor tab (does not execute)
- Double-click → load AND execute immediately
- Context menu: "Save to Collection", "Copy query", "Delete"

**Collections data model** (uses `GraphqlCollectionFolder` + `GraphqlCollectionItem` from Section 4.3):
- Infinite folder nesting via `parentId` reference
- Root items have `folderId: undefined`
- Items support pinning (`isPinned: true` → float to top of folder), tags, and per-item pre/post scripts
- Drag-and-drop reorder of items and folders (within-folder only; cross-folder via context menu)

**Collections UI** (`GraphqlCollections.tsx`):
- Folder tree with expand/collapse chevrons
- Right-click context menu: Rename, Duplicate, Move to folder, Delete
- Double-click folder name for inline rename
- "Save current operation" button in response panel adds directly to selected folder
- Badge per item: last-run status (green ✓ / red ✗ / gray —), latency
- "Run" button: loads + executes immediately
- Global search bar filters across all folders by name/tag

**Export/Import format:**
```json
{
  "_exportMeta": {
    "version": "1.0",
    "exportedAt": "2026-06-17T10:00:00Z",
    "source": "RedfireForge/GraphQL"
  },
  "collections": [{
    "id": "...",
    "name": "E-Commerce API",
    "folders": [{ "id": "f1", "name": "User Auth", "parentId": null }],
    "items": [{
      "id": "...",
      "name": "GetUserProfile",
      "folderId": "f1",
      "operation": { "query": "...", "variables": "{}", "operationType": "query" },
      "scripts": { "preRequest": "// rf.setHeader(...)", "postResponse": "" },
      "isPinned": false,
      "tags": ["auth", "user"]
    }]
  }]
}
```

**Import merge vs. replace behavior**:
- **Replace** (default): all existing collections are deleted first, then the imported data is inserted with its original IDs. If an ID collision occurs, the imported item wins.
- **Merge**: existing collections are kept. Imported items are matched by `id`:
  - If the `id` does not exist locally → inserted as new
  - If the `id` exists → user is prompted: "Overwrite?" / "Keep both" (which generates a new UUID for the imported copy) / "Skip"
- Import always validates the `_exportMeta.version` — schema version mismatches show a warning but proceed.
- The import file picker accepts `.json` only; files > 10 MB show an error before parsing.

**IndexedDB object stores** (created in `idbOpen.ts`, schema version incremented at Phase 3):
| Store name | Key | Indexes |
|---|---|---|
| `graphql-history` | `id` | `connectionId`, `timestamp` |
| `graphql-collections` | `id` | `name` |
| `graphql-collection-folders` | `id` | `name`, `parentId` |
| `graphql-schema-snapshots` | `id` | `connectionId`, `timestamp` |

**History max-items configuration**: The configurable ring buffer limit (10–500) is set in a new **"History" tab** of the connection settings popover (alongside the polling interval). The connection-level setting overrides the global default. A "Clear all history" button with confirmation dialog is also in this tab.

---

#### 3B — Pre-Request / Post-Response Scripts

The full `rf.*` scripting API is documented in **Section 14**. This subsection covers the implementation and UI.

**Sandbox implementation** (`preRequestScriptRunner.ts`):

Scripts run in a strict sandboxed context using `new Function` with scope injection — the same pattern used by Postman and Altair. Direct access to `window`, `document`, `globalThis`, `process`, `require`, and `eval` is blocked by variable shadowing:

```typescript
async function runScript(source: string, rfContext: RfContext, timeoutMs = 5000): Promise<void> {
  const wrapped = `(async function execute(rf) {
    "use strict";
    const window = undefined, document = undefined, globalThis = undefined,
          process = undefined, require = undefined, eval = undefined;
    ${source}
  })`;
  const fn = new Function('return ' + wrapped)();
  await Promise.race([
    fn(rfContext),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Script timeout after ' + timeoutMs + 'ms')), timeoutMs)
    ),
  ]);
}
```

Key behaviors:
- `rf.assert(false, msg)` throws `GraphqlAssertionError` which aborts execution and blocks the request
- `rf.fetch()` is routed through the proxy — no direct network access from scripts
- All `rf.log()` calls are captured and displayed in the script console
- Timeout (default 5s) is configurable per collection item in `GraphqlScriptConfig.timeout`

**`RfContext` interface** (the `rf` object injected into scripts):
```typescript
interface RfContext {
  // Environment
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  // Request modification (pre-request only — no-op in post-response)
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
  // Response (populated only in post-response scripts; undefined in pre-request)
  response?: {
    httpStatus:  number;
    httpHeaders: Record<string, string>;
    data:        unknown;
    errors?:     GraphqlError[];
    latencyMs:   number;
  };
  // Assertions
  assert(condition: boolean, message?: string): void;  // throws GraphqlAssertionError if false
  // Logging (captured into script console)
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  // HTTP fetch (proxied)
  fetch(url: string, init?: RequestInit): Promise<Response>;
}
```

**Post-response script timing and error handling**:
- Pre-request script runs **before** the HTTP request is sent; if it throws or `rf.assert` fails → request is blocked, error shown in script console, response panel shows "Blocked by pre-request script"
- Post-response script runs **after** the response is received and rendered. The response is shown to the user regardless — post-response failures are non-blocking.
- Post-response script failure: logged as `warn` in the script console with an amber `⚠ Post-script error` indicator on the collection item row. The next execution clears this indicator.

**Script scope isolation** (per-tab, per-execution):
- Each execution creates a fresh `RfContext` object — no state carries over between runs
- Variables set via `rf.setEnv()` modify the active environment and persist across executions (they are written to `GraphqlEnvironment.variables` immediately)
- Variables set via `rf.setHeader()` apply only to the current execution — they are not persisted to the connection's header table

**Script editor UI** (integrated into each collection item's detail panel):
- Monaco editor in JavaScript mode — height 120px, resizable; reuses existing Monaco instance
- Custom completions for `rf.*` methods (registered via `monaco.languages.registerCompletionItemProvider`)
- "Test Script" button: runs the script against the most recent history response (dry-run without execution)
- Script console panel below: `rf.log()` output, errors, assertion failures — color-coded (gray log, amber warn, red error)
- Tab indicator shows if a script is set: `[Script]` badge on the collection item row

**Script template library** (dropdown in editor toolbar):

| Template | Inserts |
|---|---|
| OAuth2 Token Refresh | Check expiry, fetch new token, `rf.setEnv` + `rf.setHeader` |
| JWT Decode (debug) | Decode payload, `rf.log` claims |
| Inject Tenant ID | `rf.setHeader('X-Tenant-ID', rf.getEnv('tenantId'))` |
| Assert No GraphQL Errors | `rf.assert(rf.response.errors === undefined, ...)` |
| Extract and Chain ID | `rf.setEnv('createdId', (rf.response.data as any).createX.id)` |

---

#### 3C — Code Generation

**Supported targets and their output format:**

| Target | Library | Generated output |
|---|---|---|
| `typescript-graphql-request` | `graphql-request` | `async function getUser(vars): Promise<GetUserQuery>` |
| `typescript-urql` | `urql` | `const [result] = useQuery<GetUserQuery>({ query: GET_USER, variables })` |
| `typescript-apollo` | `@apollo/client` | `const { data } = useQuery<GetUserQuery>(GET_USER, { variables })` |
| `typescript-fetch` | native `fetch` | Typed `fetch()` with JSON body + response type cast |
| `python-gql` | `gql` | `client.execute(gql("..."), variable_values={...})` |
| `curl` | cURL | `curl -X POST -H "Authorization: Bearer $TOKEN" ...` |
| `httpie` | HTTPie | `http POST .../graphql Authorization:"Bearer $TOKEN" ...` |

**TypeScript type generation** (built-in — no `graphql-code-generator` dependency):

`codeGenerator.ts` walks the operation AST against `GraphqlSchemaInfo` to produce types:
1. `graphql.parse(operation.query)` → `DocumentNode`
2. For each `OperationDefinitionNode`: walk selection set recursively, resolve types via schema `fields` map
3. Build `interface` for each named object type in the selection (`GetUserQuery`, `GetUserQuery_user`, etc.)
4. Emit variable types from `variableDefinitions` (using schema input type definitions)
5. Assemble the full `.ts` output string

**TypeScript type generation rules** (applied while walking the AST):
- **Nullable fields**: GraphQL fields are nullable by default (`String` = `string | null`); non-null (`String!`) = `string`. In generated TypeScript: nullable → `fieldName?: string | null`, non-null → `fieldName: string`.
- **Enum types**: emit as a TypeScript string literal union: `type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING'`. If the enum is used in multiple places, it is emitted once at the top of the file.
- **Anonymous operations**: if the operation has no `name`, use the operation type as prefix: `QueryResult` / `MutationResult` / `SubscriptionResult`. Variables interface: `QueryVariables` etc.
- **No-schema fallback**: if `GraphqlSchemaInfo` is not yet available (user hasn't introspected), code gen proceeds WITHOUT type information — TypeScript output uses `any` for the result type; a warning banner shows "Schema not introspected — types are untyped. Introspect first for accurate types." The generated client code (function signature, gql call) is still correct.

Example output for `typescript-graphql-request`:
```typescript
// Auto-generated by RedfireForge — do not edit manually
export interface GetUserQuery_user_preferences { theme: string; language: string; }
export interface GetUserQuery_user {
  id: string; name: string; preferences: GetUserQuery_user_preferences;
}
export interface GetUserQuery { user: GetUserQuery_user; }
export interface GetUserQueryVariables { id: string; }

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) { id name preferences { theme language } }
  }
`;

export async function getUser(
  client: GraphQLClient, variables: GetUserQueryVariables
): Promise<GetUserQuery> {
  return client.request<GetUserQuery>(GET_USER, variables);
}
```

**Code gen UI** (tab inside `GraphqlCollections.tsx` or dedicated code gen panel):
- Language selector: 7 tab buttons at top
- Options checkboxes: "Include TypeScript types", "Use `{{env}}` vars in URL/headers", "Include error handling"
- Monaco output panel (read-only, syntax highlighted for target language)
- `[Copy]` button → copies to clipboard
- `[Download]` button → downloads as `.ts` / `.py` / `.sh` with filename derived from operation name

---

#### 3D — Schema Diff & Validation

Uses `@graphql-inspector/core` — the industry-standard GraphQL diff library (used by Hive, GitHub's GraphQL, Hasura).

**Snapshot lifecycle** (`schemaSnapshot.ts`):
1. User clicks "Save snapshot" in Schema Explorer toolbar → captures current SDL + `GraphqlSchemaInfo` + timestamp
2. User can add a label: "v2.3 — before user model refactor"
3. Stored in IndexedDB per `connectionId`; limit 20 per connection (oldest evicted)
4. Snapshots listed in "Changelog" tab of Schema Explorer: date, label, type count, diff button

**Schema diff algorithm** (`schemaDiff.ts`):
```typescript
import { diff as inspectorDiff, CriticalityLevel } from '@graphql-inspector/core';
import { buildSchema } from 'graphql';

export function computeSchemaDiff(oldSdl: string, newSdl: string): GraphqlSchemaDiffResult {
  const changes = inspectorDiff(buildSchema(oldSdl), buildSchema(newSdl));
  return {
    changes: changes.map(c => ({
      criticality: c.criticality.level === CriticalityLevel.Breaking  ? 'BREAKING'
                 : c.criticality.level === CriticalityLevel.Dangerous ? 'DANGEROUS' : 'SAFE',
      path:        c.path ?? '',
      description: c.message,
      oldValue:    c.meta?.oldValue,
      newValue:    c.meta?.newValue,
    })),
    breakingCount:  changes.filter(c => c.criticality.level === CriticalityLevel.Breaking).length,
    dangerousCount: changes.filter(c => c.criticality.level === CriticalityLevel.Dangerous).length,
    safeCount:      changes.filter(c => c.criticality.level === CriticalityLevel.NonBreaking).length,
  };
}
```

**Breaking change severity categories:**

| Severity | Examples |
|---|---|
| `BREAKING` | Field removed, required argument added, field type changed incompatibly, enum value removed |
| `DANGEROUS` | Default value changed, argument type changed compatibly, union member removed |
| `SAFE` | Field added, optional argument added, description changed, directive added |

**Schema diff UI** (`GraphqlSchemaDiff.tsx`):
- Side-by-side SDL panels (left = old snapshot, right = current schema) with line-level diff highlights: red deleted lines, green added lines
- Change list panel below: severity badge, path, human-readable description, old/new value
- Summary header: `3 Breaking   2 Dangerous   8 Safe` with colored count pills
- Severity filter buttons: `All | Breaking | Dangerous | Safe`
- "Export diff as JSON" and "Download SDL" buttons
- Automatic diff toast on schema refresh: "Schema changed — view diff?"

**Snapshot vs. snapshot comparison** (in addition to snapshot-vs-current):
- In the "Changelog" tab of Schema Explorer, each snapshot row has a diff button AND a dropdown to select the comparison target: `vs. Current Schema` (default) or `vs. [other snapshot name]`
- When two snapshots are selected, `computeSchemaDiff(snapshot1.sdl, snapshot2.sdl)` is called — the same function, just using two historical SDLs instead of one + current
- The diff view header updates to show both snapshot labels: `"v2.2 — before migration" vs. "v2.3 — after migration"`
- This enables auditing historical schema evolution without needing the live endpoint

**Diff result persistence**:
- The diff result is NOT persisted — it is recomputed fresh every time the diff view is opened
- Recomputation is fast (<100ms for typical schemas) since `@graphql-inspector/core` is synchronous
- Benefit: always reflects the latest state; no stale cache to manage

---

#### 3E — Mock Server

The mock server runs inside the existing proxy server as a dedicated route. Users point their apps at `http://localhost:3001/api/graphql/mock` instead of the real endpoint.

**Proxy routes** (`src-server/routes/graphql/mock.ts`):
- `POST /api/graphql/mock` — execute `{ query, variables }` against in-memory mock schema
- `POST /api/graphql/mock/config` — activate/deactivate mock, set SDL, set custom resolvers, set latency
- `GET /api/graphql/mock/status` — return `{ enabled, schemaHash, activeResolverCount, latencyMs }`

**Server-side mock execution:**
```typescript
import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { execute, parse } from 'graphql';

let mockSchema: GraphQLSchema | null = null;
let mockConfig: GraphqlMockConfig | null = null;

function configureMock(sdl: string, config: GraphqlMockConfig): void {
  const mocks = buildMockMap(config.resolvers);  // MockResolver[] → graphql-tools mocks map
  mockSchema = addMocksToSchema({ schema: makeExecutableSchema({ typeDefs: sdl }), mocks });
  mockConfig = config;
}

async function executeMock(query: string, variables: object): Promise<ExecutionResult> {
  if (!mockSchema) throw new Error('Mock not configured — call POST /api/graphql/mock/config first');
  if (mockConfig?.globalLatencyMs) await delay(mockConfig.globalLatencyMs);
  return execute({ schema: mockSchema, document: parse(query), variableValues: variables });
}
```

**Mock resolver types** (3 modes per field):
- **Random** (default): `@graphql-tools/mock` generates realistic fake data (strings, numbers, IDs)
- **Fixed**: return a hardcoded value specified in the config
- **Script**: JavaScript expression evaluated per call, e.g. `() => new Date().toISOString()`

**Mock schema source**:
The mock server needs an SDL to generate its schema. Two sources are supported:
1. **Use introspected schema** (default): the SDL from the most recent successful introspection of the active connection is automatically sent to the mock server when it is activated. No user action required.
2. **Paste custom SDL**: a Monaco editor in SDL mode appears in the mock panel when "Custom SDL" radio is selected. The user pastes or types an SDL; it is sent to `POST /api/graphql/mock/config` immediately.

If neither source is available (never introspected, no custom SDL), the "Mock mode" toggle is disabled with a tooltip: "Introspect first or provide a custom SDL".

**`useGraphqlMockServer.ts` sync trigger**:
- Config is synced to the server (via `POST /api/graphql/mock/config`) on each of these events:
  1. User toggles mock mode ON → sync full config immediately
  2. User changes a resolver override (Random/Fixed/Script) → debounced 300ms, then sync
  3. User changes global latency or seed → debounced 300ms, then sync
  4. User pastes custom SDL → sync on blur of the SDL editor (not on every keystroke)
- Mock mode OFF: sends `{ enabled: false }` — server disables without losing resolver config
- If the sync POST fails (server unreachable): toast "Failed to update mock server — check that the proxy is running" + revert the toggle to OFF

**Mock server UI** (`GraphqlMockPanel.tsx`):
- Toggle switch in connection settings: "Mock mode" — endpoint pill turns amber + shows `[MOCK]` label
- **Schema source** radio: "Use introspected schema" / "Custom SDL" (shows Monaco editor if Custom selected)
- Type tree (same structure as Schema Explorer): each field row has a resolver override dropdown (Random / Fixed / Script)
- Fixed value: inline JSON input field
- Script: mini Monaco editor (1–3 lines)
- Global latency slider: 0–5000ms
- Seed input: integer for deterministic randomness
- "Reset all to defaults", "Copy mock endpoint URL" (`http://localhost:3001/api/graphql/mock`) buttons
- Status row: "Mock active — 3 custom resolvers — 200ms latency — endpoint: localhost:3001/api/graphql/mock"

---

#### 3F — Advanced Query Features

##### Persisted Queries (APQ)

Automatic Persisted Queries (Apollo APQ spec v1) reduce bandwidth by sending only the query hash on repeat executions.

**Two-step flow:**
1. Client sends hash-only: `{ extensions: { persistedQuery: { version: 1, sha256Hash: "abc..." } } }`
2. Server returns `PERSISTED_QUERY_NOT_FOUND` if not cached
3. Client resends with full query + hash — server caches and responds
4. All subsequent requests use hash-only (cache hit)

**`apqClient.ts`** implementation using browser `crypto.subtle` (no extra npm package):
```typescript
import { parse, print } from 'graphql';

export async function computeAPQHash(query: string): Promise<string> {
  const normalized = print(parse(query));  // normalize whitespace before hashing
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function executeWithAPQ(
  sendFn: (body: object) => Promise<GraphqlResponse>,
  operation: GraphqlOperation,
): Promise<GraphqlResponse> {
  const hash = await computeAPQHash(operation.query);
  const exts = { persistedQuery: { version: 1, sha256Hash: hash } };
  const r1 = await sendFn({ extensions: exts });
  if (isPersistedQueryNotFound(r1)) {
    return sendFn({ query: operation.query, extensions: exts });
  }
  return r1;
}
```

**APQ UI:**
- Toggle in connection settings: "Automatic Persisted Queries" (default: off)
- Request metadata panel shows `APQ: abc123ef…` (16-char prefix, hover for full hash)
- First send: `[Cache miss]` amber indicator; subsequent: `[Cache hit]` green indicator

**APQ — server not supported fallback**:
If the server returns a 400 error or an error with `extensions.code !== 'PERSISTED_QUERY_NOT_FOUND'` on the hash-only first request, it likely doesn't support APQ. In this case:
- `apqClient.ts` falls back to a standard full-query request automatically (transparent to user)
- A `[APQ unsupported]` amber badge is shown in the Metadata tab
- The APQ toggle is automatically disabled for this connection with a toast: "This server does not support APQ — disabled for this connection"
- The detection is cached per `connectionId` in `localStorage` so the fallback test is not repeated

##### Query Batching

Send multiple GraphQL operations in one HTTP request as a JSON array — supported by Apollo Server, Yoga, and most modern servers.

**UI:**
- "Batch" checkbox per operation tab (appears on hover)
- When ≥2 tabs checked: `Send Batch (N)` button appears in connection bar
- Results: stacked N response cards, one per batched operation
- Warning badge if a subscription tab is checked: "Subscriptions cannot be batched — will be skipped"

**Proxy route** `POST /api/graphql/batch`: relay each operation to upstream individually, collect results, return as `ExecutionResult[]`

**Server-side batch handling:** detect whether upstream supports array batching (`array-batch` header or config flag) — if yes, forward as array; if no, execute sequentially and aggregate.

**Batch response error display**:
- Each batched operation gets its own response card, independent of others
- Success card: green header with operation name + latency
- Error card (HTTP error or GraphQL errors): red/amber header; same error display as single-operation response panel
- Partial batch success: `Batch: 3 passed, 1 failed` summary row above the cards
- Individual card body shows full `data` + `errors` if both are present (partial success per-operation is supported)

##### Request Deduplication

Detect when the same query + variables is fired while an identical request is still in-flight.

**Detection mechanism** (`useGraphqlExecution.ts`):
- In-flight requests tracked in a `Map<string, AbortController>` keyed by `hash(trimmed query + sorted JSON variables)`
- When a duplicate hash is about to fire: show a non-blocking inline badge on the Execute button

**Duplicate warning UX:**
- Execute button area shows `[Duplicate in flight]` amber badge
- Dropdown with three choices:
  - **Wait and merge** — share the existing in-flight response when it resolves (0 extra network calls)
  - **Cancel original** — `AbortController.abort()` the in-flight request, then fire fresh
  - **Send anyway** — allow both; skip dedup for this one execution
- Toggle per connection: "Request deduplication" (default: on)

### 3.4 Workflow Integration (Phase 4)

Phase 4 integrates GraphQL as a first-class protocol in the Workflow Designer — alongside HTTP, WebSocket, and Kafka. It also ships 12 interactive demo lessons. It is organized into six subsystems (4A–4F).

---

#### 4A — Node Type Definitions

GraphQL nodes follow the same structural contract as all other workflow nodes:
- A `XxxNodeData` interface in `src/features/workflow/types/workflow.ts`
- A factory case in `src/features/workflow/utils/workflowNodeFactory.ts`
- Execution branch in `src/features/workflow/engine/graphRunner.ts`
- A visual config panel component `GraphqlXxxConfigPanel.tsx`

**Node types added to `WorkflowNodeType`**:
```typescript
// Append to the existing union in workflow.ts:
type WorkflowNodeType = /* existing types */ |
  'graphqlQuery' | 'graphqlMutation' | 'graphqlSubscription' |
  'graphqlIntrospect' | 'graphqlAssert';
```

**Shared helper types** (added to `workflow.ts`):
```typescript
export interface GraphqlNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface GraphqlExtractionRule {
  variableName: string;   // name to store the extracted value under
  jsonPath: string;       // JSONPath applied to the response `data` object
}

export interface GraphqlOutputBinding {
  field: 'data' | 'errors' | 'latencyMs' | 'httpStatus' | 'operationName';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlQueryNodeData`** (used for both `graphqlQuery` and `graphqlMutation` — they are structurally identical):
```typescript
export interface GraphqlQueryNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP endpoint ({{var}} supported)
  query: string;                 // GraphQL operation text
  variables: string;             // JSON string ({{var}} interpolated at runtime)
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;            // reuses shared GraphqlAuth type from graphql.ts
  skipTlsVerify?: boolean;
  timeoutMs: number;             // default 30000
  extractionRules: GraphqlExtractionRule[];   // JSONPath extractions from response.data
  outputBindings: GraphqlOutputBinding[];
}
```

**`GraphqlSubscriptionNodeData`**:
```typescript
export interface GraphqlSubscriptionNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP/WS endpoint; wss:// derived automatically
  subscriptionQuery: string;     // must start with `subscription`
  variables: string;             // JSON string
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  // Stop conditions — first condition reached wins
  stopAfterMessages?: number;    // stop after collecting N messages (0 = unlimited)
  stopAfterMs?: number;          // stop after N ms of wall time
  stopCondition?: string;        // JSONPath expression on last message: e.g. "$.data.status == 'COMPLETE'"
  extractionRules: GraphqlExtractionRule[];   // applied to each individual message
  outputBindings: GraphqlSubscriptionOutputBinding[];
}

export interface GraphqlSubscriptionOutputBinding {
  field: 'messages' | 'messageCount' | 'firstMessage' | 'lastMessage' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlIntrospectNodeData`**:
```typescript
export interface GraphqlIntrospectNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  timeoutMs: number;              // default 30000; introspection can be slow on cold starts
  // Optional validation rules — if any fail, the node errors
  minTypeCount?: number;          // error if schema has fewer types than this
  requiredTypes?: string[];       // error if any of these type names are missing from schema
  requiredFields?: Array<{ typeName: string; fieldName: string }>; // error if field not found on type
  outputBindings: GraphqlIntrospectOutputBinding[];
}

export interface GraphqlIntrospectOutputBinding {
  field: 'sdl' | 'typeCount' | 'fieldCount' | 'schemaHash' | 'queryTypeName';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlAssertNodeData`**:
```typescript
export interface GraphqlAssertNodeData {
  [key: string]: unknown;
  label: string;
  // Source: reference a variable from a previous node's output binding
  sourceVariable: string;        // variable name containing the data to assert on
  assertions: GraphqlWorkflowAssertion[];
  failBehavior: 'error' | 'warn'; // 'error' = halt workflow; 'warn' = continue with warning badge
}

export interface GraphqlWorkflowAssertion {
  id: string;
  jsonPath: string;              // applied to the value of sourceVariable
  operator: 'eq' | 'neq' | 'contains' | 'not_contains' | 'exists' | 'not_exists' |
           'gt' | 'gte' | 'lt' | 'lte' | 'matches_regex';
  expectedValue?: string;        // stringified expected value; omitted for 'exists'/'not_exists'
  description?: string;          // human-readable label shown in the run timeline
}
```

---

#### 4B — Graph Runner Execution Logic

All five node types are implemented as new `else if` branches in `src/features/workflow/engine/graphRunner.ts`. The execution follows the same async context pattern as existing HTTP and WebSocket nodes.

**Shared utility imports required** (add to `graphRunner.ts` import block):
```typescript
import { JSONPath }         from 'jsonpath-plus';
import { buildClientSchema, printSchema, isObjectType } from 'graphql';
import { computeAPQHash }   from '../../graphql/utils/apqClient';   // sha256 via crypto.subtle
import { evaluateAssertionOp } from '../../engine/fieldOperatorEvaluation';  // existing 24-op evaluator
import { buildAuthHeaders } from '../../graphql/utils/graphqlClient'; // defined in Phase 1 alongside other transport helpers
```

The `sha256` helper used in the `graphqlIntrospect` branch delegates to `computeAPQHash` (which internally uses `crypto.subtle.digest('SHA-256', ...)`). `buildAuthHeaders` is implemented in Phase 1 and converts a `GraphqlAuth` config into an HTTP `Authorization` header string. `evaluateAssertionOp` is the shared 24-operator evaluator already used by HTTP node assertions.

**`graphqlQuery` / `graphqlMutation` execution**:
```typescript
else if (node.type === 'graphqlQuery' || node.type === 'graphqlMutation') {
  const d = node.data as GraphqlQueryNodeData;
  const endpoint  = resolveVars(d.endpoint,  vars);
  const variables = resolveVars(d.variables, vars); // {{var}} in JSON string values
  const headers   = buildGraphqlHeaders(d.headers, d.auth, env);

  let parsedVariables: Record<string, unknown>;
  try {
    parsedVariables = variables ? JSON.parse(variables) : {};
  } catch (e) {
    return { status: 'error', message: `Invalid JSON in variables after interpolation: ${variables}` };
  }

  const start = performance.now();
  const resp  = await httpFetch(`${proxyBase}/api/graphql/query`, {
    method:  'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query: d.query, variables: parsedVariables }),
    signal:  ctx.abortSignal,
  });
  const latencyMs = performance.now() - start;
  const body = await resp.json() as { data?: unknown; errors?: unknown[] };

  // Apply extraction rules
  for (const rule of d.extractionRules) {
    const extracted = JSONPath.query(body.data, rule.jsonPath)?.[0];
    vars[rule.variableName] = extracted;
  }
  // Bind standard outputs
  applyOutputBindings(d.outputBindings, { data: body.data, errors: body.errors,
    latencyMs, httpStatus: resp.status, operationName: d.label }, vars);

  // Fail node if GraphQL errors present and no extraction rules consumed them
  if (body.errors?.length) {
    return { status: 'error', message: `GraphQL errors: ${JSON.stringify(body.errors)}` };
  }
}
```

**`graphqlSubscription` execution**:
```typescript
else if (node.type === 'graphqlSubscription') {
  const d = node.data as GraphqlSubscriptionNodeData;
  const wsEndpoint  = deriveWsEndpoint(resolveVars(d.endpoint, vars));
  const messages: unknown[] = [];
  let firstMsgLatency = -1;
  const start = performance.now();

  let parsedSubVariables: Record<string, unknown>;
  try {
    parsedSubVariables = d.variables ? JSON.parse(resolveVars(d.variables, vars)) : {};
  } catch (e) {
    return { status: 'error', message: `Invalid JSON in subscription variables: ${d.variables}` };
  }

  // Guard: check abort before opening WebSocket
  if (ctx.abortSignal?.aborted) return { status: 'error', message: 'Aborted before subscription started' };

  await new Promise<void>((resolve, reject) => {
    const client = createGraphqlWsClient(wsEndpoint, d.subscriptionTransport, d.auth);
    // timer and cleanup are forward-referenced; cleanup assigned immediately after subscribe() call
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (d.stopAfterMs) timer = setTimeout(() => { cleanup(); resolve(); }, d.stopAfterMs);

    const cleanup = client.subscribe(
      { query: d.subscriptionQuery, variables: parsedSubVariables },
      {
        next(msg) {
          if (firstMsgLatency < 0) firstMsgLatency = performance.now() - start;
          messages.push(msg.data);
          if (d.stopAfterMessages && messages.length >= d.stopAfterMessages) {
            if (timer) clearTimeout(timer); cleanup(); resolve();
          }
          if (d.stopCondition) {
            const condMet = JSONPath.query(msg.data, d.stopCondition)?.[0];
            if (condMet) { if (timer) clearTimeout(timer); cleanup(); resolve(); }
          }
        },
        error(err) { if (timer) clearTimeout(timer); reject(err); },
        complete()  { if (timer) clearTimeout(timer); resolve(); },
      }
    );
    if (ctx.abortSignal) ctx.abortSignal.addEventListener('abort', () => { cleanup(); resolve(); });
  });

  applyOutputBindings(d.outputBindings, {
    messages, messageCount: messages.length,
    firstMessage: messages[0], lastMessage: messages.at(-1),
    latencyMs: firstMsgLatency,
  }, vars);
}
```

**`graphqlIntrospect` execution**:
```typescript
else if (node.type === 'graphqlIntrospect') {
  const d = node.data as GraphqlIntrospectNodeData;
  const headers = buildGraphqlHeaders(d.headers, d.auth, env);
  const resp = await httpFetch(`${proxyBase}/api/graphql/introspect`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: resolveVars(d.endpoint, vars) }),
    signal: ctx.abortSignal,
  });
  const introspectionResult = await resp.json();
  const schema  = buildClientSchema(introspectionResult.data);
  const sdl     = printSchema(schema);
  const types   = Object.values(schema.getTypeMap()).filter(t => !t.name.startsWith('__'));
  const fields  = types.reduce((n, t) => n + (isObjectType(t) ? Object.keys(t.getFields()).length : 0), 0);
  const sdlHash = await sha256(sdl);

  // Validate rules
  if (d.minTypeCount && types.length < d.minTypeCount) {
    return { status: 'error', message: `Schema has ${types.length} types; expected ≥ ${d.minTypeCount}` };
  }
  for (const req of d.requiredTypes ?? []) {
    if (!schema.getType(req)) return { status: 'error', message: `Required type "${req}" missing from schema` };
  }
  for (const { typeName, fieldName } of d.requiredFields ?? []) {
    const t = schema.getType(typeName);
    if (!isObjectType(t) || !t.getFields()[fieldName]) {
      return { status: 'error', message: `Required field "${typeName}.${fieldName}" missing from schema` };
    }
  }

  applyOutputBindings(d.outputBindings, {
    sdl, typeCount: types.length, fieldCount: fields,
    schemaHash: sdlHash, queryTypeName: schema.getQueryType()?.name ?? 'Query',
  }, vars);
}
```

**`graphqlAssert` execution**:
```typescript
else if (node.type === 'graphqlAssert') {
  const d = node.data as GraphqlAssertNodeData;
  const source = vars[d.sourceVariable];
  const failures: string[] = [];

  for (const assertion of d.assertions) {
    const actual = JSONPath.query(source, assertion.jsonPath)?.[0];
    const passed = evaluateAssertionOp(assertion.operator, actual, assertion.expectedValue);
    if (!passed) {
      failures.push(assertion.description
        ?? `${assertion.jsonPath} ${assertion.operator} ${assertion.expectedValue ?? ''}: got ${JSON.stringify(actual)}`
      );
    }
  }

  if (failures.length > 0 && d.failBehavior === 'error') {
    return { status: 'error', message: failures.join('
') };
  }
  if (failures.length > 0 && d.failBehavior === 'warn') {
    ctx.log('warn', `GraphQL assert warnings:
${failures.join('
')}`);
  }
}
```

**Shared helper** (`buildGraphqlHeaders`):
```typescript
function buildGraphqlHeaders(
  rows: GraphqlNodeHeaderRow[],
  auth: GraphqlAuth | undefined,
  env: Record<string, string>
): Record<string, string> {
  const base = Object.fromEntries(
    rows.filter(r => r.enabled).map(r => [resolveVars(r.key, env), resolveVars(r.value, env)])
  );
  return { ...base, ...buildAuthHeaders(auth) };
}
```

---

#### 4C — Node Configuration Panel UI

Each node type has a dedicated config panel rendered in the workflow designer's right sidebar when the node is selected. Config panels follow the same two-column tab layout as existing node panels.

**`GraphqlQueryConfigPanel.tsx`** (used for both `graphqlQuery` and `graphqlMutation`):

Tabs:
1. **Operation** — endpoint URL input with `{{var}}` autocomplete; Monaco editor in GraphQL mode (height 200px, min; full screen button); "Import from Collections" button (picks an operation from Phase 3 collections)
2. **Variables** — Monaco JSON editor (height 120px) with `{{var}}` interpolation note
3. **Headers** — key-value table (same component as existing HTTP node headers tab)
4. **Auth** — auth type selector (Bearer / Basic / API Key); same as HTTP node auth tab
5. **Extraction** — JSONPath extraction rules table: variable name + JSONPath expression + "Test" button
6. **Output** — output binding table: field dropdown (`data | errors | latencyMs | httpStatus`) + variable name

**"Import from Collections" empty state**: if Phase 3 collections are empty or haven't been set up, the collection picker shows: "No saved operations yet — save one from GraphQL Studio first." with a link that navigates to the GraphQL Studio page in a new tab.

**Extraction tab "Test" button behavior**: runs the JSONPath expression against the most recent successful run output stored in the workflow's run trace (`ctx.runTrace`). If no run exists yet for this node, shows a tooltip "No run data available yet — execute the workflow first." Test result shown inline: `→ "value"` (green) or `→ undefined` (amber).

**Panel validation**: inline validation errors shown in the relevant tab's header with a red dot:
- Operation tab: endpoint URL must be non-empty; editor must not be empty (no blank query); invalid `{{var}}` references shown as amber underlines (warn, not block)
- Variables tab: JSON must parse without error; invalid JSON shows red underline + error message below editor
- Extraction tab: JSONPath expression must be non-empty; variable name must be a valid identifier (`[a-zA-Z_][a-zA-Z0-9_]*`)
- Output tab: variable name must be non-empty and a valid identifier; duplicate variable names within the node show a warning

Field on the canvas node card:
- Shows operation type icon (Q / M) + label + endpoint host (truncated)
- Status badge: last run result (green ✓ / red ✗ / gray —), latency

**`GraphqlSubscriptionConfigPanel.tsx`**:

Tabs:
1. **Subscription** — endpoint URL; Monaco GraphQL editor; variables JSON; transport dropdown (`Auto / graphql-transport-ws / graphql-ws / SSE`)
2. **Stop Conditions** — radio: `After N messages` / `After N seconds` / `When condition met` (JSONPath expression input); defaults to `After 10 messages`
3. **Headers & Auth** — same as query panel
4. **Extraction** — per-message JSONPath extractions (applied to each individual message in the array)
5. **Output** — `messages | messageCount | firstMessage | lastMessage | latencyMs`

**`GraphqlIntrospectConfigPanel.tsx`**:

Tabs:
1. **Endpoint** — URL input + auth + headers
2. **Schema Validation** — optional rules: min type count input; required type names (tag input); required fields (TypeName.fieldName chips)
3. **Output** — `sdl | typeCount | fieldCount | schemaHash | queryTypeName`

**`GraphqlAssertConfigPanel.tsx`**:

Tabs:
1. **Source** — variable picker dropdown (populated from output bindings of upstream nodes via `workflowVariableHints`)
2. **Assertions** — assertion table: JSONPath | operator dropdown | expected value | description; `[+ Add assertion]` button; "Run test" button tests assertions against the most recent run output of the node referenced in `sourceVariable`. If no run data exists, shows "No data — run the workflow first." Operator dropdown includes all 11 operators: `eq, neq, contains, not_contains, exists, not_exists, gt, gte, lt, lte, matches_regex`
3. **Behavior** — fail behavior radio: `Halt workflow (error)` / `Continue with warning`

---

#### 4D — Output Bindings and Variable Chain

The extracted and bound values from GraphQL nodes become available as workflow variables for downstream nodes — identical to how HTTP nodes export `{{nodeLabel.data.user.id}}`.

**Variable naming convention** (same as HTTP nodes):
- `{{nodeLabel.data}}` — full `data` object from query response
- `{{nodeLabel.data.user.id}}` — nested field (dot notation)
- `{{nodeLabel.errors}}` — errors array (usually empty)
- `{{nodeLabel.latencyMs}}` — execution time
- `{{nodeLabel.httpStatus}}` — HTTP status code (usually 200)
- Custom extractions: `{{myVar}}` — named by extraction rule variable name

**For subscription nodes**:
- `{{nodeLabel.messages}}` — array of all collected message payloads
- `{{nodeLabel.messageCount}}` — total messages received
- `{{nodeLabel.firstMessage}}` — first message payload
- `{{nodeLabel.lastMessage}}` — last message payload

**`workflowVariableHints.ts` additions**:

A `WorkflowVariableHint` object has this shape (already defined in the workflow types):
```typescript
interface WorkflowVariableHint {
  category:     string;      // e.g. 'GraphQL Steps', 'HTTP Steps'
  nodeLabel:    string;      // node's label (user-facing)
  variablePath: string;      // full variable reference, e.g. '{{GetUser.data.user.id}}'
  displayLabel: string;      // human-readable label shown in picker, e.g. 'data.user.id'
  valueType:    'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown';
}
```

New branches to add:
- **`graphqlQuery` / `graphqlMutation`** branch: emits hints for `data`, `errors`, `latencyMs`, `httpStatus`, `operationName`, plus one hint per `extractionRule` (variableName → `valueType: 'unknown'`)
- **`graphqlSubscription`** branch: emits hints for `messages` (array), `messageCount` (number), `firstMessage` (object), `lastMessage` (object), `latencyMs` (number)
- **`graphqlIntrospect`** branch: emits hints for `sdl` (string), `typeCount` (number), `fieldCount` (number), `schemaHash` (string), `queryTypeName` (string)
- Source category for all: `'GraphQL Steps'` (distinct from `'HTTP Steps'`, `'WebSocket Steps'`)

**`countWorkflowDesignerVariables.ts` update**: this utility counts how many exported variables a workflow design contains (used for the variable counter badge in the toolbar). Add cases for all five GraphQL node types:
- `graphqlQuery` / `graphqlMutation`: count = 5 (standard outputs) + `extractionRules.length`
- `graphqlSubscription`: count = 5 (messages, messageCount, firstMessage, lastMessage, latencyMs)
- `graphqlIntrospect`: count = 5 (sdl, typeCount, fieldCount, schemaHash, queryTypeName)
- `graphqlAssert`: count = 0 (assert nodes consume variables, they don't produce them)

**Canvas node rendering** (`workflowNodeFactory.ts` additions):
```typescript
case 'graphqlQuery': return {
  label: 'GraphQL Query',
  icon: 'GqlQ',    // purple Q badge
  color: 'var(--workflow-node-purple)',
  data: { label: 'GraphQL Query', endpoint: '', query: 'query {
  
}',
          variables: '{}', headers: [], timeoutMs: 30000,
          extractionRules: [], outputBindings: [] } as GraphqlQueryNodeData,
};
case 'graphqlMutation': return {
  label: 'GraphQL Mutation',
  icon: 'GqlM',    // amber M badge
  color: 'var(--workflow-node-amber)',
  data: { label: 'GraphQL Mutation', endpoint: '', query: 'mutation {
  
}',
          variables: '{}', headers: [], timeoutMs: 30000,
          extractionRules: [], outputBindings: [] } as GraphqlQueryNodeData,
};
case 'graphqlSubscription': return {
  label: 'GraphQL Subscription',
  icon: 'GqlS',    // teal S badge
  color: 'var(--workflow-node-teal)',
  data: { label: 'GraphQL Subscription', endpoint: '', subscriptionQuery: 'subscription {
  
}',
          variables: '{}', headers: [], stopAfterMessages: 10,
          extractionRules: [], outputBindings: [] } as GraphqlSubscriptionNodeData,
};
case 'graphqlIntrospect': return {
  label: 'GraphQL Introspect',
  icon: 'GqlI',    // blue I badge
  color: 'var(--workflow-node-blue)',
  data: { label: 'GraphQL Introspect', endpoint: '', headers: [],
          timeoutMs: 30000, outputBindings: [] } as GraphqlIntrospectNodeData,
};
case 'graphqlAssert': return {
  label: 'GraphQL Assert',
  icon: 'GqlA',    // green/red A badge
  color: 'var(--workflow-node-green)',
  data: { label: 'GraphQL Assert', sourceVariable: '',
          assertions: [], failBehavior: 'error' } as GraphqlAssertNodeData,
};
```

---

#### 4E — Demo Lessons (12 planned)

Lessons are registered under `protocolsDomain` → `graphql` category (new category, alongside existing `websocket` and `sse`). They share the existing lesson infrastructure (`useDemoHub`, `DemoHubContext`, lesson step engine).

**Lesson registration** (`src/features/demo-player/lessons/protocols/graphql-lessons.ts`):

| # | Lesson title | Steps | Est. time | Key concepts covered |
|---|---|---|---|---|
| 1 | Your First GraphQL Query | 7 | 3 min | Endpoint input, introspect, write query, execute, read response |
| 2 | Variables & Arguments | 8 | 3 min | Variables panel, `$id: ID!` syntax, query reuse with different values |
| 3 | Mutations — Create, Update, Delete | 9 | 4 min | Mutation syntax, input types, optimistic UI preview, error handling |
| 4 | Schema Exploration | 7 | 3 min | Type browser, search, click-to-insert, SDL view, field documentation |
| 5 | Subscriptions — Real-Time Data | 10 | 4 min | WS connection, subscribe, live log, pause/filter, disconnect |
| 6 | Authentication & Headers | 6 | 3 min | Connection profiles, Bearer token, API key, environment variable secrets |
| 7 | Query Builder — Visual Operations | 9 | 4 min | Builder tab, checkbox selection, arguments, aliases, directives, "Edit in Editor" |
| 8 | Collections & History | 8 | 3 min | Save operation, folders, history groups, double-click to re-run |
| 9 | Code Generation & Export | 6 | 2 min | Language selector, TypeScript types, copy/download, cURL snippet |
| 10 | Performance Tracing | 7 | 3 min | Enable tracing, waterfall view, slow resolver identification, complexity badge |
| 11 | Workflow Integration | 8 | 4 min | Add graphqlQuery node, wire to graphqlAssert, run workflow, inspect results |
| 12 | Schema Diff & Breaking Changes | 7 | 3 min | Save snapshot, modify schema, compute diff, BREAKING change badge |

**`preAction` guard requirements** (mandatory per demo-player-lessons rules — all stateful steps need guards):

| Lesson | Stateful steps requiring `preAction` | Guard responsibility |
|---|---|---|
| 1 | Steps 2–7 | Ensure connection is set to the test endpoint; restore introspected schema if absent |
| 2 | Steps 2–8 | Ensure a valid parameterized query is in the editor; restore introspected schema |
| 3 | Steps 2–9 | Ensure mutation operation is loaded; ensure `$id` variable is set to last created ID |
| 4 | Steps 2–7 | Ensure introspection has completed (schema tree populated) |
| 5 | Steps 2–10 | Ensure subscription is set up and in the correct state (connected/paused) |
| 6 | Steps 2–6 | Ensure the selected auth profile is active on the connection |
| 7 | Steps 2–9 | Ensure builder tab is active; restore selection state from `localStorage` key |
| 8 | Steps 2–8 | Ensure at least one operation is saved in history |
| 9 | Steps 2–6 | Ensure an introspected schema and an operation are loaded |
| 10 | Steps 2–7 | Ensure a query with Apollo Tracing response is pre-loaded in the response panel |
| 11 | Steps 2–8 | Ensure workflow has the `graphqlQuery` node added and configured |
| 12 | Steps 2–7 | Ensure at least one snapshot is saved in the Changelog tab |

**Lessons 6–12 expanded step detail**:

| Lesson 6 — Authentication & Headers (6 steps) |
|---|
| Step 1: Navigate to Connection settings → "Auth" tab (observe available auth types) |
| Step 2: Select "Bearer Token", paste `{{authToken}}` env var in the token field |
| Step 3: Open the Environment panel, set `authToken` to a test JWT value |
| Step 4: Execute a query — observe `Authorization: Bearer <token>` in the request metadata |
| Step 5: Switch to "API Key" auth, set header name `X-API-Key`, value `{{apiKey}}` |
| Step 6: Execute again — observe header changed in request metadata |

| Lesson 7 — Query Builder (9 steps) |
|---|
| Step 1: Click the "Builder" sub-tab in the editor area |
| Step 2: Expand the `Query` root — observe all available fields |
| Step 3: Check 3 fields — observe generated SDL update live |
| Step 4: Click "Select All" in the builder toolbar (scope: current level) |
| Step 5: Expand a nested object field — add child fields, observe inline fragment handling |
| Step 6: Click on an argument input for a required argument — fill in a test value |
| Step 7: Set an alias on a field — observe alias: fieldName in SDL |
| Step 8: Click "Edit in Editor" — SDL is copied to Monaco editor; builder deactivates |
| Step 9: Edit the SDL in the editor; observe one-way sync (builder does not re-parse) |

| Lesson 8 — Collections & History (8 steps) |
|---|
| Step 1: Execute any query — confirm it appears in History panel with timestamp |
| Step 2: Click a history entry — observe query loaded into editor (not executed) |
| Step 3: Double-click the entry — observe query loads AND executes immediately |
| Step 4: From response panel, click "Save to Collection" — pick or create a folder |
| Step 5: Open Collections panel — verify the saved item appears in the correct folder |
| Step 6: Drag the item to a different folder — confirm it moves |
| Step 7: Click "Export" — download the collections JSON file |
| Step 8: Delete the collection, then import from the downloaded file — verify restore |

| Lesson 9 — Code Generation (6 steps) |
|---|
| Step 1: Select a query with nested fields — ensure schema is introspected |
| Step 2: Open Code Gen panel — default target is `typescript-graphql-request` |
| Step 3: Check "Include TypeScript types" — observe interface definitions appear above the function |
| Step 4: Switch to `curl` target — observe valid curl command with `-H` Authorization header |
| Step 5: Switch to `python-gql` — observe `client.execute(gql(...))` pattern |
| Step 6: Click "Download" — verify a `.ts` file downloads named from the operation |

| Lesson 10 — Performance Tracing (7 steps) |
|---|
| Step 1: Observe the complexity badge next to Execute button (e.g. "Cost: ~14") |
| Step 2: Add a list field to the query — watch complexity badge increase |
| Step 3: Execute a query against an Apollo Server with tracing enabled |
| Step 4: Click the "Tracing" tab in the response panel — observe waterfall |
| Step 5: Hover a slow bar — read exact duration in tooltip |
| Step 6: Click "Sort by duration" — observe slowest resolvers float to top |
| Step 7: Execute 3 more times — observe histogram strip appears at bottom of response panel |

| Lesson 11 — Workflow Integration (8 steps) |
|---|
| Step 1: Navigate to Workflow Designer — create a new blank workflow |
| Step 2: Drag "GraphQL Query" from node palette — observe purple Q node on canvas |
| Step 3: Click the node — open config panel; fill endpoint + write a simple query |
| Step 4: Add a "GraphQL Assert" node — wire it after the query node |
| Step 5: In the Assert panel Source tab — pick `{{GetUser.latencyMs}}` from variable picker |
| Step 6: Add assertion: `$` lt `500` — "Latency must be under 500ms" |
| Step 7: Run the workflow — observe both nodes turn green |
| Step 8: Change assertion to `lt 1` — re-run, observe assert node turns red with failure detail |

| Lesson 12 — Schema Diff (7 steps) |
|---|
| Step 1: In Schema Explorer, click "Save snapshot" — enter label "baseline" |
| Step 2: Observe the Changelog tab now shows the snapshot entry |
| Step 3: Simulate a schema change (switch to a different endpoint with a modified schema) |
| Step 4: Re-introspect — observe the "Schema changed — view diff?" toast |
| Step 5: Click the toast — observe the diff view opens with side-by-side SDL |
| Step 6: Observe the BREAKING badge count and the specific removed/changed field |
| Step 7: Click "Export diff as JSON" — verify the download contains all change entries |

**Lesson step selectors** (`src/shared/selectors.ts` additions — new `GQL` namespace):
```typescript
export const GQL = {
  // Connection bar
  ENDPOINT_INPUT:      '[data-testid="gql-endpoint-input"]',
  INTROSPECT_BTN:      '[data-testid="gql-introspect-btn"]',
  EXECUTE_BTN:         '[data-testid="gql-execute-btn"]',
  CANCEL_BTN:          '[data-testid="gql-cancel-btn"]',
  CONNECTION_STATUS:   '[data-testid="gql-connection-status"]',
  // Editor
  EDITOR_CONTAINER:    '[data-testid="gql-editor-container"]',
  VARIABLES_PANEL:     '[data-testid="gql-variables-panel"]',
  HEADERS_PANEL:       '[data-testid="gql-headers-panel"]',
  // Response
  RESPONSE_VIEWER:     '[data-testid="gql-response-viewer"]',
  RESPONSE_ERRORS_TAB: '[data-testid="gql-response-errors-tab"]',
  TRACING_TAB:         '[data-testid="gql-tracing-tab"]',
  TRACING_WATERFALL:   '[data-testid="gql-tracing-waterfall"]',
  // Schema Explorer
  SCHEMA_EXPLORER:     '[data-testid="gql-schema-explorer"]',
  SCHEMA_SEARCH:       '[data-testid="gql-schema-search"]',
  SCHEMA_TYPE_ITEM:    '[data-testid="gql-schema-type-item"]',
  // Subscription Log
  SUBSCRIPTION_LOG:    '[data-testid="gql-subscription-log"]',
  SUBSCRIPTION_PAUSE:  '[data-testid="gql-subscription-pause"]',
  SUBSCRIPTION_FILTER: '[data-testid="gql-subscription-filter"]',
  // Query Builder
  BUILDER_TAB:         '[data-testid="gql-builder-tab"]',
  BUILDER_FIELD_ROW:   '[data-testid="gql-builder-field-row"]',
  BUILDER_EDIT_BTN:    '[data-testid="gql-builder-edit-btn"]',
  // History & Collections
  HISTORY_PANEL:       '[data-testid="gql-history-panel"]',
  HISTORY_ENTRY:       '[data-testid="gql-history-entry"]',
  COLLECTIONS_PANEL:   '[data-testid="gql-collections-panel"]',
  SAVE_TO_COLLECTION:  '[data-testid="gql-save-to-collection"]',
  // Code gen
  CODE_GEN_PANEL:      '[data-testid="gql-code-gen-panel"]',
  CODE_GEN_LANG_BTN:   '[data-testid="gql-code-gen-lang-btn"]',
  CODE_GEN_COPY:       '[data-testid="gql-code-gen-copy"]',
  // Environments
  ENV_BADGE:           '[data-testid="gql-env-badge"]',
  ENV_MODAL:           '[data-testid="gql-env-modal"]',
  // Schema diff & snapshots (Lesson 12)
  SNAPSHOT_BTN:        '[data-testid="gql-snapshot-btn"]',
  CHANGELOG_TAB:       '[data-testid="gql-changelog-tab"]',
  DIFF_BTN:            '[data-testid="gql-diff-btn"]',
  DIFF_VIEW:           '[data-testid="gql-diff-view"]',
  BREAKING_BADGE:      '[data-testid="gql-breaking-badge"]',
  // Query builder toolbar (Lesson 7)
  BUILDER_SELECT_ALL:  '[data-testid="gql-builder-select-all"]',
  BUILDER_DESELECT:    '[data-testid="gql-builder-deselect"]',
  BUILDER_ARG_INPUT:   '[data-testid="gql-builder-arg-input"]',
  BUILDER_ALIAS_INPUT: '[data-testid="gql-builder-alias-input"]',
  // Code gen (Lesson 9)
  CODE_GEN_DOWNLOAD:   '[data-testid="gql-code-gen-download"]',
  CODE_GEN_TYPES_OPT:  '[data-testid="gql-code-gen-types-option"]',
  // Performance tracing (Lesson 10)
  COMPLEXITY_BADGE:    '[data-testid="gql-complexity-badge"]',
  TRACING_SORT_BTN:    '[data-testid="gql-tracing-sort-btn"]',
  HISTOGRAM_STRIP:     '[data-testid="gql-histogram-strip"]',
  // Mock server
  MOCK_TOGGLE:         '[data-testid="gql-mock-toggle"]',
  MOCK_ENDPOINT_URL:   '[data-testid="gql-mock-endpoint-url"]',
  // Workflow node config panels (Lesson 11)
  WF_QUERY_PANEL:      '[data-testid="gql-wf-query-panel"]',
  WF_ASSERT_PANEL:     '[data-testid="gql-wf-assert-panel"]',
  WF_IMPORT_BTN:       '[data-testid="gql-wf-import-collections-btn"]',
  WF_EXTRACTION_TABLE: '[data-testid="gql-wf-extraction-table"]',
  WF_OUTPUT_TABLE:     '[data-testid="gql-wf-output-table"]',
};
```

---

#### 4F — Gallery Workflow Templates + E2E Coverage

**Gallery templates** (added to `src/features/workflow/data/emptyCanvasTemplates.ts`):

Four GraphQL-themed quick-start workflows available from the empty canvas gallery:

| Template name | Nodes | Description |
|---|---|---|
| `graphql-health-check` | Start → graphqlIntrospect → graphqlQuery → graphqlAssert → End | Verifies schema is reachable, runs a sentinel query, asserts response time < 500ms |
| `graphql-e-commerce-flow` | Start → graphqlMutation (create order) → graphqlSubscription (watch status) → graphqlAssert → End | Creates an order, subscribes to status updates until `COMPLETE`, asserts final status |
| `graphql-schema-watchdog` | Schedule (existing `scheduleTrigger` node) → graphqlIntrospect → condition (existing `condition` node, checks hash changed) → logDebug (existing `logDebug` node) → End | Polls schema on a cron schedule; logs a warning if the schema hash changes |
| `graphql-user-crud` | Start → graphqlMutation (create) → graphqlQuery (fetch) → graphqlAssert (verify) → graphqlMutation (delete) → End | Full user lifecycle: create → read → verify → delete |

**Variable wiring between nodes** (how data flows in each template):

`graphql-health-check` wiring:
- `graphqlIntrospect` (label: "Introspect API") outputs `schemaHash` → bound to workflow var `apiSchemaHash`
- `graphqlQuery` (label: "Sentinel Query") outputs `latencyMs` → bound to `sentinelLatency`; outputs `data` → bound to `sentinelData`
- `graphqlAssert` (label: "Assert Health") source: `sentinelLatency`; assertion: `$` lt `500`; failBehavior: `error`

`graphql-e-commerce-flow` wiring:
- `graphqlMutation` (label: "Create Order") outputs `data.createOrder.id` (via extraction rule: `$.createOrder.id`) → var `orderId`
- `graphqlSubscription` (label: "Watch Order Status") variables: `{ "orderId": "{{orderId}}" }`; stopCondition: `$.data.orderStatus.status == 'COMPLETE'`; outputs `lastMessage` → var `finalStatus`
- `graphqlAssert` source: `finalStatus`; assertion: `$.data.orderStatus.status` eq `COMPLETE`

`graphql-schema-watchdog` wiring:
- `graphqlIntrospect` (label: "Check Schema") outputs `schemaHash` → var `currentHash`
- `condition` node: expression `{{currentHash}} !== {{lastKnownHash}}`; true branch → `logDebug`; false branch → End
- Template ships with `lastKnownHash` as an empty string workflow variable (user fills it after first run)

`graphql-user-crud` wiring:
- `graphqlMutation` (label: "Create User") extraction rule: `$.createUser.id` → var `createdUserId`
- `graphqlQuery` (label: "Fetch User") variables: `{ "id": "{{createdUserId}}" }`; outputs `data` → var `fetchedUser`
- `graphqlAssert` (label: "Verify User") source: `fetchedUser`; assertion: `$.user.id` eq `{{createdUserId}}`
- `graphqlMutation` (label: "Delete User") variables: `{ "id": "{{createdUserId}}" }`

**Docker test server** (used by E2E tests in 4F-5, 4F-6):

A minimal GraphQL test server is required for E2E tests that hit a real endpoint. This server runs in Docker alongside the Playwright test suite:
- Image: `node:22-alpine` with Apollo Server 4 + `@faker-js/faker`
- Port: `4010` (GraphQL endpoint: `http://localhost:4010/graphql`, WS: `ws://localhost:4010/graphql`)
- Schema: exposes `Query.user(id: ID!): User`, `Mutation.createOrder(input: OrderInput!): Order`, `Subscription.orderStatus(orderId: ID!): OrderStatus`
- Apollo Tracing: enabled (for Lesson 10 E2E)
- Configuration: `e2e/docker-compose.yml` with service `graphql-test-server`
- Pre-test setup hook in `playwright.config.ts`: `globalSetup: './e2e/global-setup.ts'` which starts Docker Compose and waits for the health endpoint `GET /health` → 200
- APQ: enabled on the test server (for Phase 3 APQ E2E)

**E2E test files** (Playwright, `e2e/` directory):

| File | Scenarios covered |
|---|---|
| `e2e/graphql-query-execution.spec.ts` | Query executes, variables interpolated, response rendered, errors displayed |
| `e2e/graphql-subscriptions.spec.ts` | WS subscription connects, messages appear in log, filter works, disconnect |
| `e2e/graphql-schema-explorer.spec.ts` | Introspect renders type tree, search finds field, click-to-insert works |
| `e2e/graphql-query-builder.spec.ts` | Field selection generates SDL, argument filled, directive toggle, "Edit in Editor" |
| `e2e/graphql-collections.spec.ts` | Save to collection, rename folder, drag-drop, export/import round-trip |
| `e2e/graphql-code-gen.spec.ts` | TypeScript + cURL targets generate valid output |
| `e2e/graphql-workflow-nodes.spec.ts` | Health check workflow runs; `graphqlAssert` fails correctly on bad response |
| `e2e/graphql-lessons.spec.ts` | First 3 lessons complete without error (auto-play mode) |
| `e2e/graphql-schema-diff.spec.ts` | Snapshot saved; re-introspect triggers diff toast; diff view shows BREAKING changes; "Export diff JSON" downloads correctly |
| `e2e/graphql-mock-server.spec.ts` | Mock mode enabled; query returns mock data from test server schema; fixed resolver override returns configured value; latency slider adds correct delay |

---

## 4. Architecture

### 4.1 Directory Structure

```
src/features/graphql/
├── GraphqlStudioPage.tsx          # Main page component (tab content)
├── components/
│   ├── GraphqlEditor.tsx          # Monaco editor with monaco-graphql mode
│   ├── GraphqlSchemaExplorer.tsx  # Type browser sidebar (tree + search)
│   ├── GraphqlVariablesPanel.tsx  # Monaco JSON editor for variables
│   ├── GraphqlHeadersPanel.tsx    # Key-value headers with {{var}} support
│   ├── GraphqlResponseViewer.tsx  # Formatted JSON response + metadata
│   ├── GraphqlSubscriptionLog.tsx # Live subscription message stream
│   ├── GraphqlQueryBuilder.tsx    # Visual field selector (Phase 2)
│   ├── GraphqlConnectionBar.tsx   # URL + auth + introspect/execute buttons
│   ├── GraphqlHistoryPanel.tsx    # Operation history sidebar
│   ├── GraphqlCollections.tsx     # Saved collections with folders (Phase 3)
│   ├── GraphqlEnvironments.tsx    # Environment variable management
│   ├── GraphqlFileUpload.tsx      # File variable picker (Phase 2)
│   ├── GraphqlTracingView.tsx     # Apollo Tracing waterfall (Phase 2)
│   ├── GraphqlSchemaDiff.tsx      # Schema diff viewer: side-by-side SDL + change list (Phase 3)
│   ├── GraphqlMockPanel.tsx       # Mock server control panel: resolver overrides + latency (Phase 3)
│   ├── GraphqlQueryConfigPanel.tsx     # Workflow node config panel for graphqlQuery + graphqlMutation (nodeType prop; no separate mutation file) (Phase 4)
│   ├── GraphqlSubscriptionConfigPanel.tsx  # Workflow node config panel for graphqlSubscription (Phase 4)
│   ├── GraphqlIntrospectConfigPanel.tsx    # Workflow node config panel for graphqlIntrospect (Phase 4)
│   └── GraphqlAssertConfigPanel.tsx        # Workflow node config panel for graphqlAssert (Phase 4)
├── hooks/
│   ├── useGraphqlState.ts         # Main state management hook
│   ├── useGraphqlSchema.ts        # Schema introspection + caching + polling
│   ├── useGraphqlExecution.ts     # Query/mutation execution + @defer/@stream
│   ├── useGraphqlSubscription.ts  # Subscription lifecycle (connect/messages/disconnect/reconnect)
│   ├── useGraphqlQueryBuilder.ts  # Visual query builder state (selectedFields, args, aliases, directives, fragments) — Phase 2
│   ├── useGraphqlHistory.ts       # Operation history persistence
│   ├── useGraphqlCollections.ts   # Collection + folder CRUD (add/update/delete/reorder)
│   ├── useGraphqlMockServer.ts    # Mock server enable/disable, custom resolvers, sync to proxy — Phase 3
│   └── useGraphqlEnvironments.ts  # Environment variable resolution
├── types/
│   └── graphql.ts                 # GraphQL-specific types (re-exports from src/shared/types/graphql.ts)
└── utils/
    ├── graphqlClient.ts           # HTTP + WS transport (fetch + graphql-ws + graphql-sse)
    ├── schemaParser.ts            # Introspection result → navigable tree
    ├── queryBuilder.ts            # Visual builder → SDL generation
    ├── codeGenerator.ts           # Generate client code snippets (TypeScript/Python/cURL)
    ├── monacoGraphqlSetup.ts      # Monaco language registration + schema binding
    ├── multipartParser.ts         # @defer/@stream multipart response parser
    ├── preRequestScriptRunner.ts  # Sandboxed pre/post-request script executor (rf.* API)
    ├── schemaDiff.ts              # @graphql-inspector/core wrapper → GraphqlSchemaDiffResult (Phase 3)
    ├── schemaSnapshot.ts          # Snapshot capture + IndexedDB storage/retrieval (Phase 3)
    └── apqClient.ts               # APQ: SHA-256 hash via crypto.subtle + two-step retry logic (Phase 3)

src/features/demo-player/lessons/protocols/
└── graphql-lessons.ts             # 12 demo lesson definitions for the GraphQL Studio (Phase 4)

# Workflow engine files modified in Phase 4:
src/features/workflow/
├── types/workflow.ts              # +GraphqlQueryNodeData, +GraphqlSubscriptionNodeData, +GraphqlIntrospectNodeData, +GraphqlAssertNodeData, +helper types
├── utils/workflowNodeFactory.ts   # +factory cases for all 5 graphql node types
├── utils/workflowVariableHints.ts # +graphqlQuery/Mutation/Subscription/Introspect hint branches
├── utils/countWorkflowDesignerVariables.ts  # +graphqlAssert extraction rule counting
└── engine/graphRunner.ts          # +execution branches for all 5 graphql node types
```

### 4.2 Transport Layer (Proxy Server)

```
src-server/routes/graphql/
├── index.ts                       # Route registration
├── query.ts                       # POST /api/graphql/query (+ multipart for @defer)
├── introspect.ts                  # POST /api/graphql/introspect
├── subscribe.ts                   # WS upgrade /api/graphql/subscribe (Phase 2)
├── sse.ts                         # GET /api/graphql/sse — SSE subscription relay (Phase 2)
├── upload.ts                      # POST /api/graphql/upload (multipart file upload, Phase 2)
├── batch.ts                       # POST /api/graphql/batch (array of operations, Phase 3)
└── mock.ts                        # POST /api/graphql/mock + /mock/config + GET /mock/status (Phase 3)
```

**Note on schema diff**: `schemaDiff.ts` runs entirely client-side using `@graphql-inspector/core`. There is no `/api/graphql/schema-diff` proxy route — the diff computation happens in the browser and requires no server interaction.

**Why proxy?** (Same rationale as WebSocket/Kafka/SSE Studios)
- Bypass CORS restrictions on target GraphQL endpoints
- Handle mTLS/cert validation server-side (skip-cert-verify option)
- Normalize subscription protocol differences (`graphql-ws` vs `subscriptions-transport-ws`)
- Stream `@defer`/`@stream` multipart responses through to client
- Handle file uploads (multipart form-data → target server)
- Enable Tauri IPC transport compatibility (same API surface)
- Add request/response logging for debugging

### 4.3 Shared Types

```typescript
// src/shared/types/graphql.ts

export interface GraphqlConnection {
  id: string;
  name: string;
  endpoint: string;
  wsEndpoint?: string;       // subscription endpoint (default: swap http(s) → ws(s) from endpoint URL)
  headers: Record<string, string>;
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  schemaPollingInterval?: number;  // ms between schema re-fetches; 0 = disabled (default: 30000)
  createdAt: number;               // Unix ms — used for sorting profiles in the profile switcher dropdown
  updatedAt: number;               // Unix ms — updated whenever the user edits the connection
  // Phase 2 — subscription transport selection
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'; // default: 'auto'
  sseMode?: 'distinct' | 'single';  // only relevant when subscriptionTransport is 'sse'; default: 'distinct'
  // Phase 2 — query complexity estimator thresholds
  complexityThreshold?: number;  // cost badge turns red above this value (default: 500)
  complexityListMultiplier?: number; // list field cost multiplier (default: 10)
  complexityMaxDepth?: number;   // depth beyond which sub-tree cost doubles (default: 10)
  // Phase 2 — subscription log
  subscriptionBufferSize?: number; // max messages in memory (default: 5000)
  // Phase 2 — file upload
  maxFileSize?: number;            // client-side per-file size limit in bytes (default: 50 * 1024 * 1024 = 50 MB)
  // Phase 3 — history
  historyMaxItems?: number;        // ring buffer size for operation history (default: 100, range: 10–500)
  // Phase 3 — APQ
  apqEnabled?: boolean;            // enable Automatic Persisted Queries (default: false)
  apqUnsupportedDetected?: boolean; // true after server-not-supported detection; disables APQ toggle UI
}

// Phase 1 — represents a single editor tab in GraphqlStudioPage
export interface GraphqlOperationTab {
  id: string;
  label: string;              // operation name from AST, or "Untitled" for anonymous operations
  modelUri: string;           // Monaco model URI — unique per tab (e.g. "graphql://operation/{id}")
  operationType?: 'query' | 'mutation' | 'subscription'; // derived from AST; undefined = not yet parsed
  variables: string;          // JSON string for the Variables panel
  headers: GraphqlHeaderRow[]; // per-tab header overrides (in addition to connection-level headers)
  unsavedChanges: boolean;    // true when query/variables/headers changed since last save/load
  connectionId?: string;      // which connection profile this tab is using (undefined = none)
}

export interface GraphqlHeaderRow {
  id: string;
  key: string;
  value: string;              // {{var}} supported; resolved at runtime
  enabled: boolean;
}

export interface GraphqlAuth {
  type: 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'custom';
  token?: string;             // bearer token value
  username?: string;          // basic auth
  password?: string;          // basic auth
  headerName?: string;        // apiKey / custom header name
  headerValue?: string;       // apiKey / custom header value
  oauth2?: {                  // oauth2 client_credentials flow
    tokenUrl: string;
    clientId: string;
    clientSecret: string;     // stored as masked env var reference e.g. {{oauth_secret}}
    scope?: string;
    audience?: string;
  };
}

export interface GraphqlOperation {
  id: string;
  name?: string;
  query: string;
  variables?: string;        // JSON string
  operationType: 'query' | 'mutation' | 'subscription';
}

export interface GraphqlResponse {
  data?: unknown;
  errors?: GraphqlError[];
  extensions?: Record<string, unknown>;
  latencyMs: number;
  httpStatus: number;
  httpHeaders: Record<string, string>;
  timestamp: number;
}

export interface GraphqlError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphqlSchemaInfo {
  sdl: string;
  types: GraphqlTypeNode[];
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
  fetchedAt: number;
}

export interface GraphqlTypeNode {
  name: string;
  kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR';
  description?: string;
  fields?: GraphqlFieldNode[];
  enumValues?: string[];
  interfaces?: string[];
  possibleTypes?: string[];
}

export interface GraphqlFieldNode {
  name: string;
  type: string;              // formatted type string e.g. "[User!]!"
  description?: string;
  args?: GraphqlArgNode[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphqlArgNode {
  name: string;
  type: string;
  description?: string;
  defaultValue?: string;
}

export interface GraphqlHistoryItem {
  id: string;
  operation: GraphqlOperation;
  response: GraphqlResponse;
  connectionId: string;
  timestamp: number;           // denormalized from response.timestamp for fast sorting/indexing without deserializing the full response
  latencyMs: number;           // denormalized from response for fast display in history list without parsing response
}

// Phase 1 — named environment containing resolved key-value variable pairs
export interface GraphqlEnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  masked?: boolean;            // true = display as ••••• in the UI (for secrets/tokens)
}

export interface GraphqlEnvironment {
  id: string;
  name: string;                // e.g. "Staging", "Production", "Local Dev"
  variables: GraphqlEnvironmentVariable[];
  isActive: boolean;           // only one environment per workspace can be active at a time
  createdAt: number;
  updatedAt: number;
}

// Phase 2 — individual message received on a live subscription (WS or SSE)
export interface GraphqlSubscriptionMessage {
  id:          string;          // unique within this subscription session (UUID or sequential int as string)
  sessionId:   string;          // ties message to the active subscription session (shared across all messages in one subscribe call)
  index:       number;          // sequential 1-based counter since subscribe() was called
  direction:   'in' | 'out';   // 'in' = server push (`next`); 'out' = client send (e.g. `ping`)
  timestampMs: number;          // absolute Unix ms when this frame was received
  offsetMs:    number;          // ms elapsed since subscribe() was called
  data:        unknown;         // parsed JSON body of the `next` frame payload
  errors?:     GraphqlError[];  // present if the `next` frame contains an `errors` array
  transport:   'graphql-transport-ws' | 'graphql-ws' | 'sse';
}

// Phase 2 — result shape emitted by multipartParser.ts for @defer / @stream responses
export interface IncrementalDeliveryResult {
  type:       'initial' | 'patch';
  patchIndex: number;
  path?:      Array<string | number>;   // undefined for the initial chunk; array path for patches
  data?:      unknown;                  // the patched fragment or list item data
  errors?:    GraphqlError[];           // partial errors for this chunk only
  merged:     unknown;                  // fully merged accumulated result up to this point
  hasNext:    boolean;                  // false when the final chunk has been received
}

export interface GraphqlCollectionFolder {
  id: string;
  name: string;
  parentId?: string;           // undefined = root
  createdAt: number;
}

export interface GraphqlCollectionItem {
  id: string;
  name: string;
  description?: string;        // user-written notes for this operation
  folderId?: string;           // undefined = root collection
  operation: GraphqlOperation;
  connectionId?: string;       // optional — saved connection context
  scripts?: GraphqlScriptConfig;  // per-item pre/post-request scripts (Phase 3)
  isPinned?: boolean;
  tags?: string[];             // user-defined tags for filtering/grouping
  createdAt: number;
  updatedAt: number;
}

export interface GraphqlScriptConfig {
  preRequest?: string;         // JavaScript source for pre-request script (sandboxed)
  postResponse?: string;       // JavaScript source for post-response script (sandboxed)
  timeout?: number;            // max execution time ms (default: 5000)
  enabled?: boolean;           // false = scripts defined but not executed (default: true)
}

export interface RfResponseContext {
  httpStatus:  number;
  httpHeaders: Record<string, string>;
  data:        unknown;
  errors?:     GraphqlError[];
  latencyMs:   number;
}

// The `rf` object injected into pre-request and post-response scripts
export interface RfContext {
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
  response?: RfResponseContext;  // undefined in pre-request; populated in post-response
  assert(condition: boolean, message?: string): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  // Operation metadata (read-only, populated before script runs)
  operation: {
    name: string | undefined;        // current operation name (undefined for anonymous operations)
    type: 'query' | 'mutation' | 'subscription';
    variables: Record<string, unknown>;  // parsed variables object (read-only snapshot)
  };
}

export interface GraphqlCodeGenOptions {
  target: 'typescript-graphql-request' | 'typescript-urql' | 'typescript-apollo' |
          'typescript-fetch' | 'python-gql' | 'curl' | 'httpie';
  includeTypes: boolean;          // prepend TypeScript interface definitions
  useEnvVarsForHeaders: boolean;  // replace {{var}} with process.env / os.environ / $VAR
  includeErrorHandling: boolean;  // wrap client call in try/catch (TS) or try/except (Python);
                                  // adds GraphQL errors check (if result.errors throw/raise)
}

export interface GraphqlSchemaSnapshot {
  id: string;
  connectionId: string;
  sdl: string;
  typesCount: number;
  capturedAt: number;
  label?: string;              // user-assigned label e.g. "v2.3 — before migration"
}

export interface GraphqlSchemaDiffChange {
  criticality: 'BREAKING' | 'DANGEROUS' | 'SAFE';
  path: string;                // e.g. "Query.user" or "Order.items[first: Int]"
  description: string;         // human-readable change description
  oldValue?: string;
  newValue?: string;
}

export interface GraphqlSchemaDiffResult {
  changes: GraphqlSchemaDiffChange[];
  breakingCount: number;
  dangerousCount: number;
  safeCount: number;
}

export type MockResolver =
  | { type: 'random' }
  | { type: 'fixed';  value: unknown }
  | { type: 'script'; code: string };  // JS arrow function body: "() => new Date().toISOString()"

export interface GraphqlMockConfig {
  connectionId: string;
  enabled: boolean;
  resolvers: Record<string, Record<string, MockResolver>>;  // typeName → fieldName → resolver
  globalLatencyMs: number;    // added to every mock response (0 = no delay)
  seed?: number;              // random seed for deterministic mock data generation
}

export interface GraphqlAPQConfig {
  enabled: boolean;
  hashAlgorithm: 'sha256';    // only SHA-256 is defined in APQ spec v1
}

export interface GraphqlEnvironment {
  id: string;
  name: string;               // e.g. "Production", "Staging", "Local"
  variables: Record<string, string>;  // key → value (values can reference other vars: {{other}})
  isActive: boolean;
}

// ── Phase 4 — Workflow Node Types ─────────────────────────────────────────────
// These types live in src/features/workflow/types/workflow.ts alongside WsConnectNodeData etc.

export interface GraphqlNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface GraphqlExtractionRule {
  variableName: string;   // name under which the extracted value is stored in workflow vars
  jsonPath: string;       // JSONPath applied to the response `data` object
}

export interface GraphqlOutputBinding {
  field: 'data' | 'errors' | 'latencyMs' | 'httpStatus' | 'operationName';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlQueryNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP endpoint; {{var}} supported
  query: string;                 // GraphQL operation text (query or mutation)
  variables: string;             // JSON string; {{var}} interpolated at runtime
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  timeoutMs: number;             // default 30000
  extractionRules: GraphqlExtractionRule[];
  outputBindings: GraphqlOutputBinding[];
}

export interface GraphqlSubscriptionOutputBinding {
  field: 'messages' | 'messageCount' | 'firstMessage' | 'lastMessage' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlSubscriptionNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP or WS endpoint; wss:// derived via deriveWsEndpoint() if needed
  subscriptionQuery: string;     // must be a `subscription { }` operation
  variables: string;             // JSON string
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'; // default: 'auto'
  stopAfterMessages?: number;    // stop after collecting N messages (0 = unlimited)
  stopAfterMs?: number;          // stop after N ms of wall time
  stopCondition?: string;        // JSONPath expression on latest message: stop when truthy
  extractionRules: GraphqlExtractionRule[];
  outputBindings: GraphqlSubscriptionOutputBinding[];
}

export interface GraphqlIntrospectOutputBinding {
  field: 'sdl' | 'typeCount' | 'fieldCount' | 'schemaHash' | 'queryTypeName';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlIntrospectNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  minTypeCount?: number;          // error if schema type count is below this value
  requiredTypes?: string[];       // error if any of these type names are absent from schema
  requiredFields?: Array<{ typeName: string; fieldName: string }>; // error if field not found on type
  outputBindings: GraphqlIntrospectOutputBinding[];
}

export interface GraphqlWorkflowAssertion {
  id: string;
  jsonPath: string;              // applied to the value of sourceVariable
  operator: 'eq' | 'neq' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt' | 'matches_regex';
  expectedValue?: string;        // stringified; omitted for 'exists' / 'not_exists'
  description?: string;          // human-readable label shown in workflow run timeline
}

export interface GraphqlAssertNodeData {
  [key: string]: unknown;
  label: string;
  sourceVariable: string;        // name of the workflow variable to assert on (from a prior node's output)
  assertions: GraphqlWorkflowAssertion[];
  failBehavior: 'error' | 'warn'; // 'error' halts the workflow; 'warn' continues with a warning badge
}
```

### 4.4 Tab Registration

```typescript
// In src/app/utils/appTabUtils.ts — add to Tab union and PROTOCOLS_TABS set
type Tab = ... | 'graphql';

// PROTOCOLS_TABS.add('graphql');
```

### 4.5 Workflow Node Registration

```typescript
// New workflow node types
type WorkflowNodeType = ... 
  | 'graphqlQuery' 
  | 'graphqlMutation' 
  | 'graphqlSubscription' 
  | 'graphqlIntrospect' 
  | 'graphqlAssert';
```

### 4.6 UI Layout (Three-Panel Design)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Connection Bar: [URL input] [Auth ▾] [Headers ▾] [▶ Execute] [⟳]  │
├───────────┬─────────────────────────────────┬───────────────────────┤
│           │  Operation Editor (Monaco)      │                       │
│  Schema   │  ┌───────────────────────────┐  │  Response Viewer      │
│  Explorer │  │ query GetUser($id: ID!) { │  │  ┌─────────────────┐  │
│           │  │   user(id: $id) {         │  │  │ { "data": {     │  │
│  [Types]  │  │     name                  │  │  │   "user": {     │  │
│  [Search] │  │     email                 │  │  │     "name": ... │  │
│           │  │   }                       │  │  │   }             │  │
│           │  │ }                         │  │  │ } }             │  │
│           │  └───────────────────────────┘  │  └─────────────────┘  │
│           │  ┌─Variables──┬──Headers──────┐  │  [200 OK] [145ms]    │
│           │  │ {          │ Authorization │  │  [Tracing] [Headers] │
│           │  │   "id": 1  │ Bearer {{t}}  │  │                       │
│           │  │ }          │               │  │                       │
│           │  └────────────┴───────────────┘  │                       │
├───────────┴─────────────────────────────────┴───────────────────────┤
│ Tabs: [Op 1] [Op 2] [Op 3] [+]    | History ▾ | Collections ▾      │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout notes:**
- Left sidebar: Schema Explorer (collapsible, like Kafka Topics panel)
- Center: Editor (top) + Variables/Headers tabs (bottom) — resizable split
- Right: Response viewer (collapsible, auto-shows on execute)
- Bottom bar: Operation tabs + History/Collections access
- Follows existing resizable split-panel pattern from SSE Studio

---

## 5. Implementation Phases

### Phase 1 — MVP (Core Editor + Execution)
**Estimated scope**: ~16 files, ~2800 LOC

**New client dependencies**: `graphql`, `monaco-graphql`, `graphql-language-service`  
**New server dependencies**: `graphql` (already in the project)

#### 1A — Foundation

| # | Task | Priority |
|---|------|----------|
| 1A-1 | Create `src/features/graphql/` directory structure: all subdirectories (`components/`, `hooks/`, `utils/`, `types/`) with empty index files | P0 |
| 1A-2 | Define all Phase 1 shared types in `src/shared/types/graphql.ts`: `GraphqlConnection`, `GraphqlAuth`, `GraphqlOperation`, `GraphqlResponse`, `GraphqlError`, `GraphqlSchemaInfo`, `GraphqlTypeNode`, `GraphqlFieldNode`, `GraphqlArgNode`, `GraphqlEnvironment` | P0 |
| 1A-3 | Register `graphql` tab in `src/app/utils/appTabUtils.ts` (`PROTOCOLS_TABS.add('graphql')`) and render `<GraphqlStudioPage />` in `App.tsx` | P0 |
| 1A-4 | Add `GRAPHQL = { ... }` test selector namespace to `src/shared/selectors.ts` (connection bar, editor, response viewer, schema explorer, variables panel) | P0 |
| 1A-5 | `GraphqlStudioPage.tsx`: three-panel layout (Schema Explorer | Editor + Variables/Headers bottom split | Response Viewer) with resizable panels; operation tab bar; follows existing SSE Studio panel pattern | P0 |

#### 1B — Monaco Editor Integration

| # | Task | Priority |
|---|------|----------|
| 1B-1 | `monacoGraphqlSetup.ts`: lazy-load `monaco-graphql` Web Worker on first tab activation; `initializeMode()` with `validateVariables: true`; `api.setSchemaConfig()` binding; per-tab model create/dispose lifecycle | P0 |
| 1B-2 | `GraphqlEditor.tsx`: Monaco editor with `graphql` language; `⌘Enter` / `Ctrl+Enter` shortcut fires execute; `F1` opens command palette; editor height fills available space with min-height | P0 |
| 1B-3 | Multi-tab operations: up to 8 tabs; tab label = operation name extracted from AST (or "Untitled"); `[+]` add tab; `×` close tab (confirm if unsaved changes); `⌘W` close shortcut | P1 |
| 1B-4 | Operation name selector: parse `DocumentNode` for multiple named `OperationDefinitionNode`; show "Executing: [name ▾]" dropdown in connection bar when >1 operations defined; single operation = no dropdown | P1 |
| 1B-5 | `GraphqlVariablesPanel.tsx`: Monaco editor in JSON mode; derive JSON Schema from `VariableDefinitionNode[]` and register via `setDiagnosticsOptions` for inline variable type validation; debounce 300ms on query change | P0 |
| 1B-6 | `GraphqlHeadersPanel.tsx`: key-value row editor with `{{var}}` placeholder support; reuse key-value component from existing WebSocket/SSE Studio header panels | P0 |
| 1B-7 | Define `GraphqlOperationTab` and `GraphqlHeaderRow` types in `src/shared/types/graphql.ts`; `unsavedChanges` flag set on every query/variables/headers keystroke, cleared on save/load; tab label derives operation name from `graphql.parse(query).definitions[0].name.value` (or "Untitled" if anonymous/invalid) | P1 |

#### 1C — Schema Explorer

| # | Task | Priority |
|---|------|----------|
| 1C-1 | `POST /api/graphql/introspect` proxy route: forward the standard introspection query to the upstream endpoint; return raw introspection JSON; support `skipTlsVerify` option | P0 |
| 1C-2 | `schemaParser.ts`: `buildClientSchema(introspectionData)` + `printSchema()` → full SDL; map type nodes to `GraphqlTypeNode[]`; filter `__`-prefixed built-in types and built-in scalars; extract root type names | P0 |
| 1C-3 | `useGraphqlSchema.ts`: trigger introspection on connect; cache result in `localStorage` keyed by endpoint URL; polling via `setInterval` (respects `schemaPollingInterval`, clears on unmount/blur); SHA-256 hash change detection; feed introspection JSON to `monacoGraphqlSetup.ts` on every schema update | P0 |
| 1C-4 | `GraphqlSchemaExplorer.tsx`: left sidebar type list (grouped by kind: Object, Input, Enum, Interface, Union, Scalar) with filter bar; right detail panel showing field table (name, type, args, description); `[Introspect ⟳]` button | P0 |
| 1C-5 | Click-to-insert: clicking a field name in Schema Explorer calls `editor.executeEdits()` to insert the field name at the current Monaco cursor position | P1 |
| 1C-6 | Schema search: live text filter across type names, field names, and descriptions; results show `TypeName.fieldName` with description excerpt; Escape clears filter | P1 |
| 1C-7 | Schema SDL tab: Monaco read-only GraphQL mode rendering the full SDL; "Copy SDL" button; "Download .graphql" file button | P1 |
| 1C-8 | Introspection failure error handling: detect HTTP errors (401, 403, 5xx), introspection-disabled response (HTTP 200 but error in body mentioning "introspection"/"disabled"), network failure; display per-scenario banners from Section 12.1; yellow "introspection disabled" banner allows continued manual use of the editor | P1 |
| 1C-9 | Client-side pre-execution validation: (a) `JSON.parse(variables)` fail → disable Execute, red border on Variables panel; (b) `graphql.validate(schema, graphql.parse(query))` after schema introspected → Monaco squiggles + `⚠ N errors` badge on Execute button (advisory, not blocking); debounce both checks at 300–500ms | P1 |

#### 1D — Execution Engine

| # | Task | Priority |
|---|------|----------|
| 1D-1 | `POST /api/graphql/query` proxy route: forward `{ query, variables, operationName }` to upstream endpoint; inject auth headers; support `skipTlsVerify`; return `{ data, errors, extensions }` + latency + HTTP status + response headers | P0 |
| 1D-2 | `graphqlClient.ts` HTTP transport: `executeQuery(operation, connection) → Promise<GraphqlResponse>`; `buildAuthHeaders(GraphqlAuth)` (Bearer, Basic `btoa`, API Key); `{{var}}` interpolation in URL and headers; `AbortController` signal forwarding | P0 |
| 1D-3 | `useGraphqlExecution.ts`: state machine `idle → loading → success | error`; store `AbortController` in state; Escape key + `[Cancel]` button both call `abort()`; measure latency with `performance.now()` | P0 |
| 1D-4 | `GraphqlResponseViewer.tsx`: Monaco JSON read-only viewer for Response tab; HTTP Headers tab; Metadata tab (HTTP status badge, latency ms, response size, content-type); "Copy" button; "Expand all" / "Collapse all" toggles | P0 |
| 1D-5 | Error handling: HTTP-level errors → colored banner with message + suggestion (Section 12.1 matrix); GraphQL `errors[]` → Monaco markers via `setModelMarkers` at `locations[].line/column`; partial data display (show `data` + `errors` simultaneously) | P1 |
| 1D-6 | Auth config popover UI: `Type` dropdown (None / Bearer / Basic / API Key / OAuth 2.0 / Custom); per-type fields (Bearer: masked token input; Basic: username + password; API Key: header name + value; OAuth 2.0: read-only Phase 3 message); all sensitive values stored under `GraphqlConnection` in `localStorage`; `!` warning when sensitive value stored in plain text (not a `{{var}}` reference) | P1 |

#### 1E — Connection Management & State

| # | Task | Priority |
|---|------|----------|
| 1E-1 | `GraphqlConnectionBar.tsx`: URL input with recent-endpoints autocomplete dropdown (last 10 stored in `localStorage`); auth type badge dropdown; `[Execute ▶]` + `[Introspect ⟳]` buttons; TLS skip toggle (⚠ icon); schema polling active indicator (green pulse dot) | P0 |
| 1E-2 | Connection profiles in `useGraphqlState.ts`: `GraphqlConnection[]` persisted in `localStorage`; "Save as profile" button (prompts for name); profile switcher dropdown; delete profile | P1 |
| 1E-3 | `useGraphqlState.ts`: top-level state hook managing operation tabs, active connection ID, active environment ID; persists tab content (query, variables, headers), active connection, recent endpoints to `localStorage` | P0 |
| 1E-4 | `useGraphqlEnvironments.ts`: manage `GraphqlEnvironment[]` in `localStorage`; `resolveVars(str, env)` replaces `{{key}}` references; one active environment at a time; warn on unresolved vars | P0 |
| 1E-5 | `GraphqlEnvironments.tsx`: environment manager modal — left panel = environment list; right panel = key-value table; masked values toggle (eye icon); active environment switcher; import/export environments as JSON | P1 |
| 1E-6 | Schema polling configuration UI: toggle (on/off) + interval input in connection settings popover; "Polling active" indicator shows time-to-next-poll countdown | P1 |

### Phase 2 — Subscriptions + Query Builder
**Estimated scope**: ~20 files, ~4500 LOC

**New client dependencies**: `graphql-ws`, `subscriptions-transport-ws`, `graphql-sse`, `meros`, `extract-files`, `jsonpath-plus`  
**New server dependencies**: `graphql-ws`, `subscriptions-transport-ws`, `busboy` (all already listed in Section 6)

#### 2A — WebSocket Subscriptions

| # | Task | Priority |
|---|------|----------|
| 2A-1 | Add `WS /api/graphql/subscribe` proxy route: WebSocket upgrade, subprotocol negotiation (`graphql-transport-ws` / `graphql-ws`), bidirectional frame relay, subscription multiplexing by `id` | P0 |
| 2A-2 | Implement `graphql-ws` Client integration in `graphqlClient.ts`: `subscribe(operation) → AsyncIterator<ExecutionResult>` using the modern subprotocol | P0 |
| 2A-3 | Implement `subscriptions-transport-ws` legacy SubscriptionClient integration in `graphqlClient.ts` | P1 |
| 2A-4 | Protocol auto-detection in `graphqlClient.ts`: attempt `graphql-transport-ws`; on close code `4406`/`4400` retry with `graphql-ws` legacy subprotocol; surface permanent failure on `1000` or other codes | P1 |
| 2A-5 | Subscription state machine in `useGraphqlSubscription.ts`: `idle → connecting → connected → subscribing → active → reconnecting → error | disconnected` with full lifecycle events | P0 |
| 2A-6 | Auto-reconnect with exponential backoff: delay = `min(1000 × 2^attempt, 30_000)` ms ± 20% jitter; max 5 attempts; abort on permanent close codes `4400`, `4401`, `4499` | P1 |
| 2A-7 | Connection status indicator in connection bar: colored pill showing current state label + message count when `active`; "Stop Reconnecting" cancel button when `reconnecting` | P1 |
| 2A-8 | `connection_init_payload` auth: `buildConnectionParams(auth)` returns an object passed as `connectionParams` in `connection_init` frame; handles `bearer`, `basic`, `apiKey` auth types; `4401` close code maps to permanent `error` state (no retry) | P1 |
| 2A-9 | `wsEndpoint` URL derivation: `deriveWsEndpoint(httpEndpoint)` in `graphqlClient.ts` — `https://` → `wss://`, `http://` → `ws://`; fallback used when `GraphqlConnection.wsEndpoint` is not explicitly set; `subscriptionTransport` and `sseMode` fields persisted on `GraphqlConnection` | P2 |

#### 2B — SSE Subscriptions

| # | Task | Priority |
|---|------|----------|
| 2B-1 | Add `graphql-sse` to Phase 2 npm client dependencies | P1 |
| 2B-2 | Implement SSE subscription transport in `graphqlClient.ts` using `graphql-sse` `createClient({ url, fetchFn })`; expose same `subscribe(operation) → AsyncIterator` interface as WS clients | P1 |
| 2B-3 | Add `GET /api/graphql/sse` proxy route: relay upstream SSE stream, forward `Last-Event-ID` for resumability, set `Content-Type: text/event-stream; charset=utf-8` + `Cache-Control: no-cache`, handle CORS | P1 |
| 2B-4 | SSE mode detection: default to SSE when URL path ends in `/stream`; manual transport override dropdown (WebSocket modern / WebSocket legacy / SSE) in connection settings | P1 |

#### 2C — Subscription UI

| # | Task | Priority |
|---|------|----------|
| 2C-1 | `GraphqlSubscriptionLog.tsx` — virtualized scrolling message list (index, direction badge, operation name, relative timestamp +Ns, delivery latency, collapsible JSON body with syntax highlighting) | P0 |
| 2C-2 | Sticky stats bar: total messages, error count, rolling 5s messages/sec, connected duration stopwatch | P1 |
| 2C-3 | Log toolbar: Pause/Resume toggle (buffering new messages when paused), Clear, Export JSON download | P1 |
| 2C-4 | Inline filter bar (toggle): full-text or JSONPath expression filter across message bodies; live filtering with match count `Showing N/M messages` | P1 |
| 2C-5 | Assertion panel (right sidebar toggle): user defines JSONPath assertions evaluated against each incoming message; pass/fail badge per message row + aggregate footer `N/M assertions pass` | P2 |

#### 2D — Incremental Delivery (`@defer` / `@stream`)

| # | Task | Priority |
|---|------|----------|
| 2D-1 | `multipartParser.ts`: use `meros` to split `multipart/mixed` stream into boundary-separated parts; apply incremental patches to accumulated result via path-based merge; emit `{ type, patchIndex, path, merged }` events | P1 |
| 2D-2 | Update `POST /api/graphql/query` proxy route: detect `Content-Type: multipart/mixed` in upstream response; pass through chunked body without buffering (`Transfer-Encoding: chunked` preserved); normalize boundary string | P1 |
| 2D-3 | Update `GraphqlResponseViewer.tsx` for incremental delivery: shimmer/skeleton on deferred fields while patch pending; dissolve + green flash when patch arrives; `@stream` lists show items appending in real time | P1 |
| 2D-4 | Chunk tracker toolbar above response JSON: `Chunk N of ? received` → `All N chunks received (Xms total)` when `hasNext: false`; per-chunk hover timing (`Chunk 2: +340ms`) | P2 |
| 2D-5 | `hasIncrementalDirective(query)` utility in `graphqlClient.ts`: `graphql.parse()` + `graphql.visit()` checks for `@defer`/`@stream` `DirectiveNode`; returns `false` on parse error; used by `useGraphqlExecution.ts` to set `Accept: multipart/mixed` header conditionally | P1 |

#### 2E — File Upload

| # | Task | Priority |
|---|------|----------|
| 2E-1 | `GraphqlFileUpload.tsx`: "Files" tab inside Variables bottom panel; drag-and-drop + browse file picker; file list (name, MIME, size, remove); auto-injects `null` placeholder into Variables JSON; max file size warning (configurable, default 50 MB) | P1 |
| 2E-2 | Client-side multipart construction: `extract-files` extracts `File` objects from variables map; builds `FormData` with `operations`, `map`, and file entries per graphql-multipart-request-spec | P1 |
| 2E-3 | `POST /api/graphql/upload` proxy route: `busboy` parses incoming FormData; reconstructs equivalent multipart request targeting upstream; streams file bytes without memory buffering | P1 |
| 2E-4 | Upload progress indicator: proxy sends `X-Upload-Progress: {bytesUploaded}/{totalBytes}` chunked lines before the JSON result; client reads response as `ReadableStream` to parse progress lines; per-file progress bar fills in real time | P2 |
| 2E-5 | Client-side file size validation on selection (before upload): check `file.size` against configurable `maxFileSize` (default 50 MB) and hard cap (200 MB) immediately on drag-drop or browse pick; rejected files shown in red error state on file row; Execute button disabled while any file has a size error | P1 |

#### 2F — Visual Query Builder

| # | Task | Priority |
|---|------|----------|
| 2F-1 | `useGraphqlQueryBuilder.ts`: builder state management (`selectedFields` path map, `argValues`, `aliases`, `directives`, `fragments`); actions: toggleField, setArgValue, setAlias, addDirective, addFragment, reset | P1 |
| 2F-2 | `queryBuilder.ts`: SDL generator — recursively builds selection sets from state; inlines args as literals or `$varName` references with auto-generated variable definitions; appends directives, aliases, fragment spreads + definitions | P1 |
| 2F-3 | `GraphqlQueryBuilder.tsx`: field selector tree — checkbox/⊕ toggle, expand arrow for Object types, partial-select `−` indicator, type badge (blue scalar, purple object, amber enum, teal interface), deprecated badge, hover description tooltip | P1 |
| 2F-4 | Argument inputs: accordion per selected field; per-arg input widget matched to arg type (text input, number input, boolean toggle, enum dropdown, `$varRef` switch); type hint shown next to each input | P1 |
| 2F-5 | Two-step schema search: text input filters fields across all types → click result auto-expands tree to field's root path + updates breadcrumb; Escape returns to unfiltered root view | P1 |
| 2F-6 | Fragment panel (right column, collapsible): `[+ New Fragment]` with name input + type selector; fragment field-selector; `[Use]` inserts `...FragmentName` spread; unused fragments highlighted amber | P2 |
| 2F-7 | Directive toggles (`@skip` / `@include`): hover button per field row; popover to choose or create Boolean variable; directive indicator inline on field row label; auto-adds variable to Variables panel | P2 |
| 2F-8 | Alias support: inline alias text input on hover/focus of a selected field; field row updates to `alias: fieldName`; validated (no spaces, no reserved words) | P2 |
| 2F-9 | "Edit in Editor" escape hatch: button in builder toolbar promotes current generated SDL into Monaco editor and deactivates the builder (one-way sync only) | P1 |
| 2F-10 | Union/Interface inline fragment support: when a field's return type is Union or Interface, render child fields grouped under concrete type headers; `selectedFields` map uses `__on_TypeName` path segment convention; SDL generator emits `... on TypeName { ... }` selection sets; interface common fields shown above concrete type groups | P2 |
| 2F-11 | `QueryBuilderState` persistence: serialize and store state in `localStorage` keyed by `${tabId}:builderState` on every state change (debounced 500ms); restore on tab load; "Select All" / "Deselect All" toolbar buttons scoped to current breadcrumb level | P2 |

#### 2G — Performance & Tracing

| # | Task | Priority |
|---|------|----------|
| 2G-1 | `GraphqlTracingView.tsx`: Apollo Tracing waterfall Gantt chart from `extensions.tracing`; horizontal bars (position = startOffset, width = duration); labels `ParentType.fieldName`; color-coded green/amber/red by duration; sortable by start time / duration / path; hover tooltip; click row highlights response field | P2 |
| 2G-2 | Query complexity estimator: pre-execution AST cost calculation (scalar +1, object +2, list × configurable multiplier, depth penalty); cost badge near Execute button (green/amber/red); configurable threshold; confirmation dialog when cost > 2× threshold | P2 |
| 2G-3 | Response time histogram: track P50/P95/P99 latency in-memory across ≥3 executions of the same operation; 7-bucket mini histogram in collapsible strip at bottom of response panel; resets on query text change | P2 |
| 2G-4 | Complexity estimator configuration: add "Performance" tab to connection settings popover with `threshold` input (default 500), `listMultiplier` input (default 10), `maxDepth` input (default 10); values persisted on `GraphqlConnection`; cost badge and confirmation dialog use these values | P2 |
| 2G-5 | Histogram same-query detection: normalize query via `print(parse(query))` and SHA-256 hash the result (`crypto.subtle`); group latency samples by hash; named operations additionally key by `operationName`; reset samples when hash changes | P2 |

### Phase 3 — Collections + Code Gen
**Estimated scope**: ~18 files, ~3800 LOC

**New client dependencies**: `@graphql-inspector/core`  
**New server dependencies**: none beyond Phase 1–2 (uses existing `graphql` + `@graphql-tools/*` already listed)

#### 3A — Collections & History

| # | Task | Priority |
|---|------|----------|
| 3A-1 | `useGraphqlHistory.ts`: IndexedDB-backed ring buffer (max 100/configurable); FIFO eviction; keyed by `connectionId + timestamp`; load/save/clear/search operations | P0 |
| 3A-2 | `GraphqlHistoryPanel.tsx`: full-height sidebar with recency groups (Today/Yesterday/7 days/Older), operation type badge, status icon, hover preview, click-to-load, double-click-to-execute, context menu | P0 |
| 3A-3 | `useGraphqlCollections.ts`: IndexedDB-persisted collection + folder CRUD (add, update, delete, reorder, move); drag-and-drop reorder within folders; pin/unpin | P1 |
| 3A-4 | `GraphqlCollections.tsx`: folder tree (expand/collapse, inline rename, right-click context menu), item list (run/duplicate/delete), global search bar, "Save current operation" shortcut from response panel | P1 |
| 3A-5 | Export/import collections: serialize to `_exportMeta` + `collections[]` JSON format; import via file picker with validation; merge vs replace import mode | P1 |
| 3A-6 | History entry "Save to Collection" flow: prompt for collection + folder + name; pre-fills name from operation name | P1 |

#### 3B — Pre-Request / Post-Response Scripts

| # | Task | Priority |
|---|------|----------|
| 3B-1 | `preRequestScriptRunner.ts`: `new Function`-based sandbox with scope shadowing (`window`, `document`, `globalThis`, `process`, `require`, `eval` → `undefined`); async support; configurable timeout (default 5s) via `Promise.race` | P2 |
| 3B-2 | Script editor UI: Monaco in JavaScript mode (120px resizable) inside collection item detail panel; custom `rf.*` completions via `registerCompletionItemProvider`; "Test Script" dry-run button | P2 |
| 3B-3 | Script console panel: capture and display `rf.log()` / `rf.warn()` / `rf.error()` output + assertion failures + timeout errors; color-coded; clear button | P2 |
| 3B-4 | Script template library: 5 built-in templates (OAuth2 refresh, JWT decode, inject tenant, assert no errors, extract ID); insertable via dropdown in editor toolbar | P2 |
| 3B-5 | `GraphqlScriptConfig` per collection item: store `preRequest`, `postResponse`, `timeout` on `GraphqlCollectionItem`; badge indicator `[Script]` on item rows that have a script set | P2 |
| 3B-6 | Script error propagation: if `rf.assert` fails or script throws → abort request with inline error message in response panel; if post-response script fails → show as warning (non-blocking) | P2 |

#### 3C — Code Generation

| # | Task | Priority |
|---|------|----------|
| 3C-1 | `codeGenerator.ts`: AST walker producing TypeScript interface types (operation result + variables) from `DocumentNode` + `GraphqlSchemaInfo`; handles nested objects, lists, optional fields, enums | P1 |
| 3C-2 | TypeScript targets: `typescript-graphql-request` (async function), `typescript-urql` (`useQuery`/`useMutation` hook), `typescript-apollo` (`useQuery`/`useMutation` hook), `typescript-fetch` (native fetch) | P1 |
| 3C-3 | Shell + Python targets: `curl` (full `curl -X POST ...` command with header flags), `httpie` (`http POST ...` command), `python-gql` (`gql()` + `client.execute()` call) | P1 |
| 3C-4 | Code gen UI: language selector tabs (7 options), options checkboxes (include types, use `{{env}}` vars, include error handling), Monaco read-only output panel, Copy + Download buttons | P1 |
| 3C-5 | "Include TypeScript types" option: when checked, prefix the output with generated `interface` + variable type definitions | P1 |
| 3C-6 | `{{env}}` variable substitution in generated code: replace `{{varName}}` references in URL/headers with `process.env.VAR_NAME` (TypeScript) or `os.environ["VAR_NAME"]` (Python) or `$VAR_NAME` (shell) | P2 |

#### 3D — Schema Diff & Validation

| # | Task | Priority |
|---|------|----------|
| 3D-1 | `schemaSnapshot.ts`: capture `GraphqlSchemaSnapshot` (SDL + type count + timestamp + optional label); store in IndexedDB per connection (max 20, FIFO eviction); load/save/delete/list snapshots | P2 |
| 3D-2 | "Save snapshot" button in Schema Explorer toolbar + "Changelog" tab showing snapshot list (timestamp, label, type count, diff button) | P2 |
| 3D-3 | `schemaDiff.ts`: wrap `@graphql-inspector/core` `diff()` to produce `GraphqlSchemaDiffResult` with `BREAKING` / `DANGEROUS` / `SAFE` change classification | P2 |
| 3D-4 | `GraphqlSchemaDiff.tsx`: side-by-side SDL diff (red deleted / green added line highlights), change list panel with severity badges, summary counts, severity filter, "Export diff JSON" + "Download SDL" buttons | P2 |
| 3D-5 | Automatic diff toast: when `useGraphqlSchema` detects schema hash change on refresh, show toast "Schema changed — view diff?" linking to diff view against the most recent snapshot | P2 |

#### 3E — Mock Server

| # | Task | Priority |
|---|------|----------|
| 3E-1 | `src-server/routes/graphql/mock.ts`: `POST /api/graphql/mock` — execute against in-memory `mockSchema`; `POST /api/graphql/mock/config` — configure SDL + resolvers + latency; `GET /api/graphql/mock/status` | P2 |
| 3E-2 | Server-side mock execution: `@graphql-tools/mock` `addMocksToSchema()` with dynamic resolver map built from `GraphqlMockConfig`; global latency via `await delay(ms)` before `execute()` | P2 |
| 3E-3 | `useGraphqlMockServer.ts`: hook managing mock enable/disable, custom resolvers (per typeName.fieldName), latency, seed; syncs config to server via `POST /api/graphql/mock/config` | P2 |
| 3E-4 | `GraphqlMockPanel.tsx`: toggle switch in connection settings (endpoint pill turns amber with `[MOCK]` label when active); type tree with resolver dropdown per field (Random / Fixed / Script); latency slider; seed input | P2 |
| 3E-5 | Fixed resolver UI: inline JSON value input per field with type validation | P2 |
| 3E-6 | Script resolver UI: mini Monaco editor (1–3 lines) per field; evaluated as `() => value` arrow function by the server | P2 |

#### 3F — Advanced Query Features

| # | Task | Priority |
|---|------|----------|
| 3F-1 | `apqClient.ts`: SHA-256 hash via `crypto.subtle` (no extra package); query normalization via `parse` + `print`; two-step APQ flow (hash-only → retry with full query on `PERSISTED_QUERY_NOT_FOUND`) | P2 |
| 3F-2 | APQ UI: toggle in connection settings; request metadata shows `APQ: {hash}` with `[Cache miss]` / `[Cache hit]` indicator; retry is transparent to user | P2 |
| 3F-3 | Query batching: "Batch" checkbox per operation tab; `Send Batch (N)` button in connection bar when ≥2 checked; sends `[{query, variables}, ...]` to `POST /api/graphql/batch` proxy route | P2 |
| 3F-4 | Batch result UI: N stacked response cards (one per operation); "Batch of N" header with aggregate timing | P2 |
| 3F-5 | Request deduplication in `useGraphqlExecution.ts`: in-flight request `Map<hash, AbortController>`; duplicate detection shows amber `[Duplicate in flight]` badge with three-choice dropdown (Wait/Cancel/Send anyway) | P2 |
| 3F-6 | Deduplication "Wait and merge": share the single in-flight `Promise<GraphqlResponse>` with the waiting caller — both callers get the same response, 0 extra network requests | P2 |

#### 3A — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3A-7 | History max-items configuration UI: "History" tab in connection settings popover with numeric input (10–500), "Clear all history" button with confirmation; connection-level setting stored in `GraphqlConnection.historyMaxItems`; global default in app settings | P2 |

#### 3B — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3B-7 | `RfContext` + `RfResponseContext` type definitions in `src/features/graphql/types/graphql.ts`; post-response script non-blocking error handling (amber `⚠ Post-script error` indicator); script scope isolation guarantee (fresh `RfContext` per execution) | P1 |

#### 3C — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3C-7 | TypeScript enum generation: emit string literal union (`type Status = 'ACTIVE' \| 'INACTIVE'`) per enum used in the selection; nullable field handling (`field?: T \| null` vs. `field: T`); anonymous operation fallback names (`QueryResult` / `MutationResult` / `SubscriptionResult`); no-schema warning banner with `any` result type | P1 |

#### 3E — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3E-7 | Mock schema source UI: "Use introspected schema" / "Custom SDL" radio in `GraphqlMockPanel`; Monaco SDL editor for custom SDL; disable mock toggle when neither source is available; `useGraphqlMockServer.ts` sync triggers (debounced 300ms on resolver changes, on-blur for SDL, immediate on toggle) | P1 |

#### 3F — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3F-7 | APQ non-supported server detection: if first hash-only request returns non-APQ error → fall back to full query, show `[APQ unsupported]` badge, auto-disable APQ for this connection with toast, cache detection result in `localStorage` per `connectionId`; batch individual error cards: each batched operation shows its own success/error state, `Batch: N passed / M failed` summary row | P2 |

### Phase 4 — Workflow Integration + Lessons
**Estimated scope**: ~22 files, ~3800 LOC

**New client dependencies**: none (reuses `graphql-ws`, `graphql-sse`, `graphql` from Phases 1–2)  
**New server dependencies**: none (reuses `/api/graphql/query`, `/api/graphql/introspect`, `/api/graphql/subscribe` proxy routes from Phases 1–2)

#### 4A — Node Type Definitions

| # | Task | Priority |
|---|------|----------|
| 4A-1 | Add `graphqlQuery`, `graphqlMutation`, `graphqlSubscription`, `graphqlIntrospect`, `graphqlAssert` to `WorkflowNodeType` union in `workflow.ts` | P0 |
| 4A-2 | Define shared helper types in `workflow.ts`: `GraphqlNodeHeaderRow`, `GraphqlExtractionRule`, `GraphqlOutputBinding`, `GraphqlSubscriptionOutputBinding`, `GraphqlIntrospectOutputBinding`, `GraphqlWorkflowAssertion`, `GraphqlAssertNodeData` | P0 |
| 4A-3 | Define `GraphqlQueryNodeData` interface (used for both `graphqlQuery` + `graphqlMutation`): endpoint, query, variables, headers, auth, skipTlsVerify, timeoutMs, extractionRules, outputBindings | P0 |
| 4A-4 | Define `GraphqlSubscriptionNodeData` interface: endpoint, subscriptionQuery, variables, headers, auth, subscriptionTransport, stopAfterMessages, stopAfterMs, stopCondition, extractionRules, outputBindings | P0 |
| 4A-5 | Define `GraphqlIntrospectNodeData` interface: endpoint, headers, auth, skipTlsVerify, minTypeCount, requiredTypes, requiredFields, outputBindings | P1 |
| 4A-6 | Define `GraphqlAssertNodeData` interface: sourceVariable, assertions (`GraphqlWorkflowAssertion[]`), failBehavior | P1 |
| 4A-7 | Append all five new node types to `WorkflowNodeData` union type in `workflow.ts` | P0 |

#### 4B — Graph Runner Execution Logic

| # | Task | Priority |
|---|------|----------|
| 4B-1 | Implement `graphqlQuery` + `graphqlMutation` branch in `graphRunner.ts`: resolve `{{var}}` in endpoint/variables/headers, POST to `/api/graphql/query`, apply extraction rules via `jsonpath-plus`, bind outputs; surface GraphQL `errors` array as node error | P0 |
| 4B-2 | Implement `buildGraphqlHeaders(rows, auth, env)` shared helper in `graphRunner.ts` — merges enabled header rows with resolved `{{var}}` values + auth headers from `buildAuthHeaders()` | P0 |
| 4B-3 | Implement `graphqlSubscription` branch: derive WS endpoint via `deriveWsEndpoint()`, create `graphql-ws` (or SSE) client, subscribe, collect messages until first stop condition (count / ms / JSONPath condition) is met; expose `messages[]`, `messageCount`, `firstMessage`, `lastMessage`, `latencyMs` via output bindings | P1 |
| 4B-4 | Implement `graphqlIntrospect` branch: POST introspection to `/api/graphql/introspect`; use `buildClientSchema` + `printSchema` from `graphql` package; validate `minTypeCount`, `requiredTypes`, `requiredFields`; SHA-256 hash SDL; bind `sdl`, `typeCount`, `fieldCount`, `schemaHash`, `queryTypeName` outputs | P1 |
| 4B-5 | Implement `graphqlAssert` branch: resolve `sourceVariable` from workflow vars; apply each `GraphqlWorkflowAssertion` using `jsonpath-plus` + `evaluateAssertionOp`; collect failures; halt or warn based on `failBehavior`; log failure details to run trace | P1 |
| 4B-6 | Implement `applyGraphqlOutputBindings(bindings, values, vars)` helper — mirrors existing `applyOutputBindings` pattern but for GraphQL field names | P0 |
| 4B-7 | Unit tests for all five execution branches: `graphRunner.graphqlQuery.test.ts`, `graphRunner.graphqlSubscription.test.ts`, `graphRunner.graphqlAssert.test.ts` — mock `httpFetch`, `graphql-ws` client, `buildClientSchema` | P1 |

#### 4C — Node Configuration Panel UI

| # | Task | Priority |
|---|------|----------|
| 4C-1 | `GraphqlQueryConfigPanel.tsx` — 6-tab panel (Operation, Variables, Headers, Auth, Extraction, Output); Monaco GraphQL editor in Operation tab with height 200px; "Import from Collections" button opens collection picker modal | P0 |
| 4C-2 | Mutation node uses `GraphqlQueryConfigPanel.tsx` with `nodeType="graphqlMutation"` prop — no separate file created; the `nodeType` prop changes the default query template to `mutation { }` and the amber color accent. This is NOT a new file — update the existing `GraphqlQueryConfigPanel.tsx` to accept and handle `nodeType`. | P0 |
| 4C-3 | `GraphqlSubscriptionConfigPanel.tsx` — 5-tab panel (Subscription, Stop Conditions, Headers & Auth, Extraction, Output); Stop Conditions tab: radio (N messages / N seconds / JSONPath condition); transport dropdown | P1 |
| 4C-4 | `GraphqlIntrospectConfigPanel.tsx` — 3-tab panel (Endpoint, Schema Validation, Output); Schema Validation tab: min type count input, required types tag input, required fields `TypeName.fieldName` chips | P1 |
| 4C-5 | `GraphqlAssertConfigPanel.tsx` — 3-tab panel (Source, Assertions, Behavior); Source tab: variable picker dropdown populated from upstream node output bindings via `workflowVariableHints`; Assertions tab: editable table with JSONPath + operator + expected + description + "Run test" button | P1 |
| 4C-6 | Add all five config panel components to the workflow designer's node properties panel switch statement | P0 |
| 4C-7 | Add `data-testid` attributes to all interactive elements in config panels (using `GQL.*` constants from `selectors.ts`) | P1 |

#### 4D — Output Bindings and Variable Chain

| # | Task | Priority |
|---|------|----------|
| 4D-1 | Add `graphqlQuery`/`graphqlMutation` branch to `workflowVariableHints.ts`: expose `data`, `errors`, `latencyMs`, `httpStatus` + named extraction rule variables; source category `'GraphQL Steps'` | P0 |
| 4D-2 | Add `graphqlSubscription` branch to `workflowVariableHints.ts`: expose `messages`, `messageCount`, `firstMessage`, `lastMessage`, `latencyMs` | P1 |
| 4D-3 | Add `graphqlIntrospect` branch to `workflowVariableHints.ts`: expose `sdl`, `typeCount`, `fieldCount`, `schemaHash`, `queryTypeName` | P1 |
| 4D-4 | Add `graphqlAssert` node to `countWorkflowDesignerVariables.ts` (count extraction rules toward variable total) | P1 |
| 4D-5 | Add factory cases for all 5 node types in `workflowNodeFactory.ts`: `nodeTypes` map + `createWorkflowNode` switch; default `GraphqlQueryNodeData` with `query: 'query {
  
}'`, empty arrays; `GraphqlSubscriptionNodeData` default with `stopAfterMessages: 10`; assign distinct canvas colors (purple for query, amber for mutation, teal for subscription, blue for introspect, green for assert) | P0 |
| 4D-6 | Canvas node card renderer: Q/M/S/I/A badge icons for each graphql node type; show endpoint host (truncated); show last-run status badge and latency | P1 |

#### 4E — Demo Lessons

| # | Task | Priority |
|---|------|----------|
| 4E-1 | Create `src/features/demo-player/lessons/protocols/graphql-lessons.ts` — lesson registry file with all 12 lesson definitions | P1 |
| 4E-2 | Register `graphql` category in `protocolsDomain` lesson catalog (alongside `websocket`, `sse`) | P1 |
| 4E-3 | Lesson 1 "Your First GraphQL Query" (7 steps): endpoint input → introspect → observe schema → write query → execute → read response → save to history | P1 |
| 4E-4 | Lesson 2 "Variables & Arguments" (8 steps): write parameterized query → open Variables panel → fill `$id` var → execute with value A → re-run with value B → compare results | P1 |
| 4E-5 | Lesson 3 "Mutations" (9 steps): write `mutation` → input type fields → execute create → observe response → execute update → execute delete → show idempotency | P1 |
| 4E-6 | Lesson 4 "Schema Exploration" (7 steps): open Schema Explorer → browse types → search for field → read documentation → click-to-insert → SDL view → export SDL | P1 |
| 4E-7 | Lesson 5 "Subscriptions" (10 steps): write subscription → click Subscribe → observe live messages → pause → use filter → resume → view assertion panel → disconnect | P1 |
| 4E-8 | Lessons 6–9 (Auth, Query Builder, Collections, Code Gen) — 4 lesson files, 6–9 steps each | P2 |
| 4E-9 | Lessons 10–12 (Performance Tracing, Workflow Integration, Schema Diff) — 3 lesson files, 7–8 steps each | P2 |
| 4E-10 | Add `GQL.*` selector constants to `src/shared/selectors.ts` — full namespace covering all lesson-interactive elements | P1 |
| 4E-11 | Unit tests for all 12 lesson files (`graphql-lessons.test.ts`): step count, IDs, `estimatedMinutes`, `preAction` guards for stateful steps | P1 |

#### 4F — Gallery Templates and E2E

| # | Task | Priority |
|---|------|----------|
| 4F-1 | Gallery template `graphql-health-check`: Start → graphqlIntrospect → graphqlQuery → graphqlAssert (latency < 500ms) → End; registered in `emptyCanvasTemplates.ts` | P2 |
| 4F-2 | Gallery template `graphql-e-commerce-flow`: Start → graphqlMutation (create order) → graphqlSubscription (collect until `COMPLETE`) → graphqlAssert → End | P2 |
| 4F-3 | Gallery template `graphql-schema-watchdog`: Schedule → graphqlIntrospect → condition (hash changed?) → logDebug → End | P2 |
| 4F-4 | Gallery template `graphql-user-crud`: Start → graphqlMutation (create) → graphqlQuery (fetch) → graphqlAssert (verify) → graphqlMutation (delete) → End | P2 |
| 4F-5 | E2E test `e2e/graphql-query-execution.spec.ts`: query executes against local Docker test server; variables interpolated; response rendered; GraphQL errors surface correctly | P1 |
| 4F-6 | E2E test `e2e/graphql-workflow-nodes.spec.ts`: health-check workflow runs end-to-end; `graphqlAssert` fails correctly when latency threshold exceeded; all variable bindings resolved | P1 |
| 4F-7 | E2E test `e2e/graphql-lessons.spec.ts`: first 3 lessons complete auto-play without errors (smoke test) | P2 |
| 4F-8 | Test scenario file `docs/plan/graphql-workflow-nodes-test-scenarios.md`: manual test scenarios for all 5 node types with exact click-by-click steps and expected results | P1 |
| 4F-9 | E2E test `e2e/graphql-schema-diff.spec.ts`: save snapshot, re-introspect with modified schema, diff toast shown, BREAKING badge count correct, "Export diff JSON" downloads | P2 |
| 4F-10 | E2E test `e2e/graphql-mock-server.spec.ts`: mock mode ON, query returns data, fixed resolver returns configured value, latency slider adds delay, mock mode OFF restores real endpoint | P2 |
| 4F-11 | `e2e/docker-compose.yml` + `e2e/global-setup.ts`: Docker Compose definition for `graphql-test-server` (Apollo Server 4 on port 4010 with tracing + APQ); `globalSetup` starts and awaits health check before tests | P1 |

#### 4B / 4C — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 4B-8 | Add `JSON.parse` try-catch for variables in `graphqlQuery`, `graphqlMutation`, `graphqlSubscription` branches — return `{ status: 'error', message: '...' }` on parse failure rather than throwing | P0 |
| 4B-9 | Add abort-before-start guard in `graphqlSubscription` branch: check `ctx.abortSignal?.aborted` before creating the WS client; return early if already aborted | P1 |
| 4C-8 | Config panel validation: endpoint non-empty, query non-empty, valid JSON in Variables tab, valid identifiers in extraction/output variable names; tab headers show red dot on validation error | P1 |

#### 4D — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 4D-7 | `countWorkflowDesignerVariables.ts`: add cases for all 5 GraphQL node types per the spec (5 standard + `extractionRules.length` for query/mutation; 5 for subscription; 5 for introspect; 0 for assert) | P1 |

---

## 6. Dependencies (npm packages)

### Required (Phase 1)
```json
{
  "graphql": "^16.x",
  "monaco-graphql": "^1.x",
  "graphql-language-service": "^5.x"
}
```
**Note**: `@monaco-editor/react` (v4.7.0) is already installed. `monaco-graphql` adds GraphQL language support to the existing Monaco instance.

### Phase 2
```json
{
  "graphql-ws": "^6.x",
  "subscriptions-transport-ws": "^0.11.x",
  "graphql-sse": "^2.x",
  "meros": "^1.x",
  "extract-files": "^13.x"
}
```
**Notes**:
- `subscriptions-transport-ws` is the deprecated Apollo legacy package needed for backward-compat with Apollo Server ≤v3. It uses the WebSocket subprotocol `graphql-ws` (note the naming swap — the modern `graphql-ws` npm package uses subprotocol `graphql-transport-ws`).
- `graphql-sse` implements the GraphQL over SSE transport spec (by the same author as `graphql-ws`). Required for 2B SSE subscriptions. The server must also use `graphql-sse` server-side.
- `meros` streams and splits `multipart/mixed` HTTP responses — required for `@defer`/`@stream` support (2D).
- `extract-files` extracts `File` / `Blob` objects from GraphQL variables for the file upload multipart spec (2E).

### Phase 3
```json
{
  "@graphql-tools/mock": "^9.x",
  "@graphql-tools/schema": "^10.x",
  "@graphql-tools/utils": "^10.x",
  "@graphql-inspector/core": "^5.x"
}
```
**Notes**:
- `@graphql-tools/mock` generates realistic fake resolvers from a schema — powers the mock server (3E).
- `@graphql-tools/schema` builds executable schemas from SDL + resolvers — required by the mock server.
- `@graphql-tools/utils` provides schema utilities (merging, pruning, filtering) used throughout Phase 3.
- `@graphql-inspector/core` is the industry-standard GraphQL diff library (used by Hive, GitHub's GraphQL, Hasura) — required for schema diff + breaking change detection (3D).

### Server-side (src-server) — all phases
```json
{
  "graphql": "^16.x",
  "graphql-ws": "^6.x",
  "subscriptions-transport-ws": "^0.11.x",
  "ws": "^8.x",
  "busboy": "^1.x"
}
```
**Note**: `ws` is already installed for WebSocket proxy. `busboy` handles multipart file upload parsing. `subscriptions-transport-ws` is needed server-side to proxy legacy Apollo subscription connections to upstream servers.

---

## 7. Registration Checklist

Following the established protocol pattern (WebSocket/Kafka/SSE):

- [ ] `src/features/graphql/` — Feature directory with page + components + hooks
- [ ] `src/shared/types/graphql.ts` — Shared TypeScript types
- [ ] `GraphqlStudioPage.tsx` — Main page component
- [ ] Register tab `'graphql'` in `src/app/utils/appTabUtils.ts`
- [ ] Render in `App.tsx` conditional on tab
- [ ] `src-server/routes/graphql/` — Proxy server routes
- [ ] `src/features/graphql/utils/graphqlClient.ts` — Frontend transport client (HTTP + WebSocket)
- [ ] `src/shared/selectors.ts` — Add `GRAPHQL = { ... }` test selectors
- [ ] Workflow nodes: `graphqlQuery`, `graphqlMutation`, `graphqlSubscription`, `graphqlIntrospect`, `graphqlAssert`
- [ ] Node config components with `InsertVarField` + `variableHints`
- [ ] Demo lessons registered in `src/features/demo-player/lessons/index.ts`
- [ ] Storage persistence via existing localStorage/IndexedDB patterns
- [ ] E2E test selectors + Playwright tests

---

## 8. Competitive Differentiation

What makes RedfireForge's GraphQL Studio unique vs. standalone tools:

| Feature | Postman | Apollo Studio | GraphiQL | Altair | **RedfireForge** |
|---------|---------|--------------|----------|--------|-----------------|
| Integrated test runner | ✅ | ❌ | ❌ | ❌ | ✅ (workflow engine + SLA) |
| Multi-protocol in one app | ✅ | ❌ | ❌ | ❌ | ✅ (WS+Kafka+SSE+GraphQL) |
| Workflow automation | ✅ (Flows) | ❌ | ❌ | ❌ | ✅ (DAG workflows) |
| SLA evaluation on responses | ❌ | ❌ | ❌ | ❌ | ✅ |
| Desktop native | ❌ | ❌ | ❌ | ✅ (Electron 200MB+) | ✅ (Tauri ~15MB) |
| Demo/Training system | ❌ | ❌ | ❌ | ❌ | ✅ (interactive lessons) |
| Schema diff + breaking changes | ✅ (paid) | ✅ (paid) | ❌ | ❌ | ✅ (built-in free) |
| `@defer`/`@stream` support | ❌ | ✅ | Partial | ❌ | ✅ |
| Pre-request scripts | ✅ | ✅ (scripting) | ❌ | ✅ | ✅ |
| File upload (multipart) | ✅ | ❌ | ❌ | ✅ | ✅ |
| Cross-protocol workflows | ❌ | ❌ | ❌ | ❌ | ✅ (GraphQL→Kafka→WS in one flow) |
| Open source | ❌ | ❌ | ✅ | ✅ | ✅ |
| Free (no account required) | ❌ (free tier) | ❌ (account) | ✅ | ✅ | ✅ |

**Unique value proposition**: The only tool that lets you build **cross-protocol automated test workflows** combining GraphQL + WebSocket + Kafka + SSE nodes with SLA evaluation — all in a lightweight native desktop app with interactive training.

---

## 9. Design Decisions

### Editor Choice: Monaco with `monaco-graphql`
- **Why**: Project already uses `@monaco-editor/react` (v4.7.0) — zero new editor dependency
- **`monaco-graphql`** provides: syntax highlighting, autocomplete, validation, hover docs, jump-to-definition
- **Schema binding**: Feed introspected schema into `monaco-graphql` worker for live validation
- **Alternative considered**: CodeMirror 6 + `cm6-graphql` (used by GraphiQL) — rejected because it adds a second editor library to the bundle
- **Multi-model**: Each operation tab gets its own Monaco model (same pattern as multi-file editors)

### Subscription Protocol: `graphql-ws` primary
- **Why**: Modern spec-compliant protocol, maintained by The Guild
- **npm package**: `graphql-ws` (the npm package name) uses the WebSocket subprotocol **`graphql-transport-ws`**
- **Legacy**: `subscriptions-transport-ws` (the npm package) uses the WebSocket subprotocol **`graphql-ws`** — this naming is intentionally confusing; the package and subprotocol names are swapped between the two generations
- **Detection algorithm**: Attempt WebSocket handshake advertising subprotocol `graphql-transport-ws` (modern). If server closes with `4406` (subprotocol not acceptable) or `4400` (bad request), retry advertising subprotocol `graphql-ws` (legacy `subscriptions-transport-ws`). Close code `1000` (normal closure) is ambiguous and must not trigger a retry.
- **SSE fallback**: If server responds to HTTP POST with `Content-Type: text/event-stream`, switch to SSE transport

### Proxy vs Direct
- **Decision**: Always proxy through `src-server` (port 3001) by default
- **Why**: CORS bypass, TLS handling, protocol normalization, file upload relay, Tauri compatibility
- **Direct mode**: Optional toggle for local development when CORS isn't an issue
- **Tauri**: Uses same IPC proxy pattern as WebSocket/Kafka (`invoke('graphql_query', {...})`)

### Incremental Delivery (`@defer`/`@stream`)
- **Decision**: Support from Phase 2
- **Why**: Increasingly adopted (Apollo Router, Yoga, Hive Gateway all support it)
- **Implementation**: Parse `multipart/mixed` response with boundary splitting; progressively merge into response JSON
- **UX**: Show partial response immediately with loading indicators on deferred fields

### State Management
- **Decision**: Custom hook (`useGraphqlState`) with localStorage persistence
- **Why**: Matches existing pattern (`useWebsocketState`, `useKafkaState`)
- **No Redux/Zustand**: Keep consistent with other protocol studios
- **Persistence**: Active operation tabs + environments + recent endpoints saved to localStorage

### File Upload
- **Decision**: Follow `graphql-multipart-request-spec` (used by Apollo, Yoga, Altair)
- **Implementation**: Client constructs FormData with operations + file map; proxy relays to target
- **UX**: Files selected via drag-drop or file picker in Variables panel

---

## 10. Success Criteria

### Phase 1 (MVP)
- [ ] Execute a GraphQL query against any public endpoint (e.g., GitHub API, SpaceX API) — receives `data` in Response panel
- [ ] Execute a mutation — response includes the created/updated resource
- [ ] Introspect schema and browse types/fields/arguments in Schema Explorer
- [ ] Autocomplete in the editor suggests fields, arguments, and types from the introspected schema
- [ ] Inline error diagnostics shown for invalid queries (syntax errors, unknown fields) before execution (client-side `graphql.validate()`)
- [ ] GraphQL errors (`errors[]` in 200 response) highlighted in editor with location markers at the correct line/column
- [ ] Partial response (data + errors simultaneously) shows both in the Response panel
- [ ] HTTP-level errors (401, 403, 5xx, CORS) show the correct error banner from Section 12.1
- [ ] Multi-tab: open 3 separate operations, switch between them without losing content; tab label shows operation name from AST
- [ ] `⌘Enter` (or `Ctrl+Enter`) executes the current operation; Escape cancels it
- [ ] Click-to-insert inserts the field name at the current editor cursor position
- [ ] Schema search finds types and fields by name in <100ms for a 500-type schema
- [ ] Environment variable `{{token}}` set in an environment resolves in the Authorization header; unresolved `{{unknownVar}}` shows `!` warning icon on the header row
- [ ] Connection profile saved, page reloaded — profile loads correctly with endpoint + auth; profile list is sorted by most-recently-used
- [ ] Operations (query text, variables) persist across page reloads
- [ ] Schema polling: schema automatically re-fetched after the configured interval (verify by changing the upstream schema)
- [ ] Invalid JSON in Variables panel: Execute button is disabled and "Invalid JSON" error shown on the Variables panel
- [ ] Auth popover: setting Bearer token → Authorization header appears in outgoing request; switching to API Key type → custom header name/value appear in request
- [ ] Server with introspection disabled: yellow "Introspection disabled" banner shown; editor still usable for manual operations
- [ ] Pre-execution `graphql.validate()`: querying a field that doesn't exist on the schema shows a Monaco squiggle immediately (before execution) with `⚠ 1 error` badge on Execute button

### Phase 2
- [ ] WebSocket subscription (modern `graphql-transport-ws`) connects, receives live `next` messages, and displays them in the subscription log
- [ ] Legacy Apollo subscription server (`graphql-ws` subprotocol) is auto-detected via close code `4406`/`4400` and reconnected successfully with `subscriptions-transport-ws`
- [ ] SSE subscription connects (via `graphql-sse`) and receives data in the same subscription log UI as WS
- [ ] Auto-reconnect triggers on unexpected WebSocket disconnect; exponential backoff countdown visible; recovers within the backoff window (≤30s)
- [ ] Authenticated WebSocket subscription: Bearer token from connection auth flows through `connection_init_payload` (`connectionParams`); subscription data reflects authorized user; `4401` close code → permanent error state (no retry)
- [ ] `subscriptionTransport` manual override: selecting "SSE" in connection settings routes the subscription through the SSE proxy instead of WebSocket; selecting "WebSocket (legacy)" forces `graphql-ws` subprotocol
- [ ] `@defer` / `@stream` partial responses render incrementally — deferred fields show skeleton placeholder then fill in on patch arrival; chunk tracker shows `All N chunks received (Xms total)`
- [ ] Combining `@defer` and file upload in the same operation triggers a pre-execution validation error ("cannot combine")
- [ ] File upload mutation executes end-to-end: file selected in Files tab → multipart POST → proxy relays without buffering → server confirms
- [ ] Upload progress indicator fills correctly as the proxy reports bytes transferred
- [ ] Visual query builder generates syntactically valid GraphQL SDL from point-and-click field selection (verified by `graphql.parse()` without throwing)
- [ ] Union/Interface field in query builder: expanding a Union type shows concrete type groups; selecting a field under a concrete type generates correct `... on TypeName { fieldName }` inline fragment in SDL
- [ ] Two-step schema search finds any field by name across all types and auto-expands the tree to its root path
- [ ] Fragment created in builder is correctly inlined in generated SDL as spread + definition; unused fragments show amber warning
- [ ] Subscription log JSONPath assertion `$.data.order.status == "SHIPPED"` correctly hides messages where status is not "SHIPPED"; pass/fail badges update live per message
- [ ] Apollo Tracing waterfall renders when `extensions.tracing` is present; resolver bars are color-coded by duration; sort-by-duration shows slowest resolver first
- [ ] Query complexity badge appears before execution with correct color; a deeply nested query (depth > `maxDepth`) shows red badge; a query costing > 2× threshold shows a confirmation dialog
- [ ] SSE subscription reconnects after a simulated network drop: `Last-Event-ID` is forwarded; no messages are skipped after reconnect; `reconnecting` state is shown in the status pill
- [ ] File exceeding `maxFileSize` (e.g. 51 MB against a 50 MB limit) is rejected immediately at selection time with an inline error; the Execute button stays disabled until the oversized file is removed
- [ ] Query builder state persists across page reload: complex selection (3+ fields with arguments) is restored in the builder after refresh; generated SDL matches pre-reload state
- [ ] A query containing `@defer` automatically triggers multipart response handling; deferred fields show skeleton then fill in; a query without `@defer` does NOT send `Accept: multipart/mixed`

### Phase 3
- [ ] Operation history auto-saves every execution and displays in recency groups (Today / Yesterday / Last 7 days)
- [ ] History entry loads into the editor with one click; double-click loads and immediately executes
- [ ] Collections are organized in folders with drag-and-drop reorder and persist across reloads
- [ ] "Save to Collection" flow from response panel saves operation with correct folder and name
- [ ] Collections export to JSON file; imported file restores all folders and items correctly
- [ ] Import with "Merge" mode keeps existing collections and inserts new items; import with "Replace" mode deletes existing collections first
- [ ] Pre-request script runs before execution — `rf.setHeader` value appears in the outgoing request
- [ ] `rf.assert(false)` in pre-request script blocks the request and shows error in script console
- [ ] Post-response script failure is non-blocking: response is displayed and an amber `⚠ Post-script error` indicator appears on the item row
- [ ] Code generator produces runnable TypeScript (`typescript-graphql-request`), Python (`python-gql`), and cURL snippets for any introspected operation
- [ ] "Include TypeScript types" option prepends correct interface definitions for the selected fields; nullable fields use `?: T | null`; enum fields use string literal union types
- [ ] Code gen with no schema introspected: output uses `any` result type; warning banner "Schema not introspected" is shown
- [ ] Schema snapshot saved and diff computed correctly: `@graphql-inspector/core` reports `BREAKING` for a removed field
- [ ] Snapshot-vs-snapshot comparison: selecting two historical snapshots in the Changelog tab computes and displays their diff correctly
- [ ] Mock server active — simple query returns mock data when pointed at `localhost:3001/api/graphql/mock`; "Use introspected schema" mode loads the active connection's SDL automatically
- [ ] Fixed mock resolver returns the configured value; latency slider adds correct delay
- [ ] APQ enabled — first request is a cache miss; identical second request shows `[Cache hit]` and is hash-only
- [ ] APQ with unsupported server: client falls back to full query, shows `[APQ unsupported]` badge, auto-disables APQ for this connection
- [ ] Batch of 2 operations returns 2 result cards with correct data each; if one fails its card shows an error state while the other shows success

### Phase 4
- [ ] `graphqlQuery` workflow node: executes a query against the proxy, resolves `{{var}}` in endpoint/variables/headers, returns `data` + `latencyMs` in output bindings accessible as `{{nodeLabel.data.fieldName}}` in downstream nodes
- [ ] `graphqlMutation` workflow node: executes a mutation identically to `graphqlQuery`; canvas card shows amber M badge
- [ ] GraphQL errors in query/mutation node: when response contains a `errors[]` array, node enters error state and the run timeline shows the GraphQL error message (not just HTTP error)
- [ ] JSONPath extraction rule in query node: `$.user.id` correctly extracts the nested value and stores it in the named variable; downstream `graphqlQuery` node uses that variable in its variables JSON
- [ ] `graphqlSubscription` workflow node: connects via WebSocket (`graphql-transport-ws`), collects messages until `stopAfterMessages` is reached, exposes `messages[]` and `messageCount` as output bindings
- [ ] `graphqlSubscription` stop condition: `stopCondition` JSONPath expression stops collection when first matching message is received
- [ ] `graphqlIntrospect` workflow node: fetches schema, outputs `typeCount` and `schemaHash`; `requiredTypes` validation fails the node correctly when a specified type is absent; `timeoutMs` is respected (node errors on timeout)
- [ ] `graphqlAssert` workflow node: evaluates JSONPath assertions against an upstream variable; assertion failure with `failBehavior: 'error'` halts the workflow and shows failure detail; `failBehavior: 'warn'` continues with warning badge
- [ ] `graphqlAssert` `gte`/`lte` operators work correctly: `latencyMs gte 0` passes; `latencyMs lt 1` fails when actual latency > 1ms
- [ ] Invalid JSON in `graphqlQuery` variables: node enters error state with "Invalid JSON in variables" message rather than crashing the workflow
- [ ] `graphqlSubscription` already-aborted abort signal: node returns error immediately without opening WebSocket connection
- [ ] "Import from Collections" in `GraphqlQueryConfigPanel`: operation saved in Phase 3 collections can be loaded into a workflow node without re-typing; empty-state is shown when no collections exist
- [ ] `'GraphQL Steps'` variable category appears in the variable picker of downstream nodes, showing `data`, `errors`, `latencyMs` from prior graphql nodes
- [ ] `countWorkflowDesignerVariables` counts GraphQL nodes correctly: query node with 2 extraction rules contributes 7 variables (5 standard + 2 extraction)
- [ ] Health-check gallery template loads from empty canvas gallery; variable wiring is pre-configured (`{{sentinelLatency}}` flows to assert node); runs end-to-end against local Docker test server
- [ ] E-commerce gallery template: mutation extraction rule wires `orderId` to subscription variables; subscription stops on `COMPLETE` condition; assert verifies final status
- [ ] Demo lesson 1 "Your First GraphQL Query" completes in auto-play mode: all 7 steps execute with visible ripple animations and correct narration
- [ ] Demo lessons 1–5 are navigable: Restart → play through each step → preAction guards recover state correctly on forward-skip
- [ ] Demo lessons 6–12 are playable: each lesson's steps are navigable, narration is visible, and key interactions complete without error

### Performance
- [ ] Schema introspection < 2s for schemas with ≤500 types
- [ ] Query execution overhead < 100ms (proxy round-trip only)
- [ ] Monaco editor loads within 500ms (lazy-loaded GraphQL worker)

---

## 11. Public GraphQL APIs for Testing

| API | Endpoint | Auth | Features | Subscriptions |
|-----|----------|------|----------|---------------|
| Countries | `https://countries.trevorblades.com/graphql` | None | Simple schema, continents/countries/languages | ❌ |
| Rick and Morty | `https://rickandmortyapi.com/graphql` | None | Characters/episodes/locations, pagination | ❌ |
| Star Wars (SWAPI) | `https://swapi-graphql.netlify.app/.netlify/functions/index` | None | Classic demo API, films/people/planets | ❌ |
| GitHub GraphQL | `https://api.github.com/graphql` | Bearer token | Rich schema, mutations, real data | ❌ |
| SpaceX (unofficial) | `https://spacex-production.up.railway.app/graphql` | None | Launches/rockets/missions | ❌ |
| GraphQL Pokémon | `https://graphql-pokemon2.vercel.app/` | None | Simple, no auth | ❌ |
| Hasura Cloud (demo) | Varies | None | Real-time subscriptions, CRUD mutations | ✅ |
| GraphQL WS Demo | Self-hosted (Docker) | None | Subscriptions via `graphql-ws` | ✅ |

### 11.1 Local Test Server (Docker)

For development and E2E testing, the project ships a local GraphQL test server defined in `e2e/docker-compose.yml` (detailed fully in Section 3.4 4F). Summary:

```yaml
# e2e/docker-compose.yml  (authoritative — see Section 3.4 4F for full spec)
services:
  graphql-test-server:
    image: node:22-alpine
    ports:
      - "4010:4010"    # http://localhost:4010/graphql + ws://localhost:4010/graphql
    command: npx tsx /app/server.ts
```

The pre-test setup hook (`e2e/global-setup.ts`) starts the server and waits for `GET http://localhost:4010/health → 200` before Playwright begins.

Features of the test server:
- **Queries**: `user(id: ID!): User`
- **Mutations**: `createUser`, `updateUser`, `deleteUser`, `createOrder(input: OrderInput!): Order`
- **Subscriptions**: `orderStatus(orderId: ID!): OrderStatus`
- **File upload**: `uploadAvatar(file: Upload!)`
- **`@defer`/`@stream`**: Supports incremental delivery
- **Apollo Tracing**: Returns resolver timing (`extensions.tracing`) for Lesson 10 E2E
- **APQ**: Enabled (for Phase 3 APQ E2E tests)
- **Latency simulation**: Configurable delays per resolver via query param `?latency=N`

---

## 12. Error Handling UX

GraphQL has two error layers — HTTP-level errors and GraphQL-level errors inside a 200 response — both must be handled visibly.

### 12.1 HTTP-Level Errors

| Scenario | Display |
|----------|---------|
| Network unreachable | Red banner: "Cannot connect to endpoint — check URL and network" |
| 401 Unauthorized | Red banner: "Authentication failed — token missing or expired. Update in connection settings." |
| 403 Forbidden | Red banner: "Access denied — token is valid but lacks required permissions for this operation." |
| 5xx server error | Red banner + raw response body shown in Response panel |
| CORS blocked (direct mode) | Yellow banner: "CORS blocked — switch to Proxy mode or enable CORS on server" |
| TLS/cert error | Red banner with option to "Skip TLS verification" (toggle in connection settings) |

### 12.2 GraphQL-Level Errors (200 with `errors` array)

- **Error icon** in Response panel header (⚠ instead of ✓)
- **Errors tab** appears automatically when `errors` array is non-empty
- **Error location markers** — if `locations` is present, highlight the corresponding line(s) in the Monaco editor using error squiggles
- **Path highlighting** — if `path` is present, show which field in the response tree caused the error
- **`extensions.code` display** — show error codes like `UNAUTHENTICATED`, `NOT_FOUND`, `RATE_LIMITED` prominently
- **Partial data** — still display `data` even alongside errors (GraphQL allows partial success)

### 12.3 Subscription Errors

- **Connection close codes** — display WebSocket close code + reason in the message log (e.g., `4400 Bad Request`)
- **`next` payload errors** — surface `errors` array within subscription messages (same treatment as query errors)
- **Auto-reconnect failed** — show retry count and "Give up" option after 5 failed attempts
- **Protocol mismatch** — if server rejects `graphql-transport-ws`, show a "Try legacy protocol?" prompt

---

## 13. Environment Variable Management

### 13.1 Environment Structure

See `GraphqlEnvironment` in Section 4.3 Shared Types for the full interface definition.

### 13.2 Variable Resolution Order

Variables are resolved in this precedence order (highest wins):

1. **Operation-level variables** (set in Variables panel — raw JSON, not `{{var}}` syntax)
2. **Per-tab overrides** (not persisted — scratch values set in the Environments tab of a session)
3. **Active environment variables** (persisted per named environment)
4. **Global defaults** (e.g. `{{baseUrl}}` from connection profile)

### 13.3 `{{var}}` Interpolation Scope

The `{{var}}` syntax is supported in:
- **Endpoint URL** field (e.g. `{{baseUrl}}/graphql`)
- **Headers** values (e.g. `Authorization: Bearer {{accessToken}}`)
- **Variable values** in the Variables JSON panel (e.g. `"userId": "{{currentUserId}}"`)
- **Pre-request scripts** via `rf.getEnv('varName')`

It is **not** applied to the query/operation text itself — GraphQL variables serve that purpose.

### 13.4 UI: Environment Manager

- Accessible from a dropdown badge in the connection bar (e.g. `[Staging]`)
- Environment editor modal: list of named environments on the left, key-value table on the right
- Masked values: toggle visibility per variable (for secrets like tokens)
- Import/export environments as JSON (compatible with Postman environment format)
- Quick-switch between environments without losing the current operation

---

## 14. Pre-Request Script API Reference

Pre-request scripts run in a sandboxed context before each operation execution. The `rf` (RedfireForge) helper object is the scripting API.

### 14.1 Available API

```typescript
// Environment variable access
rf.getEnv(key: string): string | undefined
rf.setEnv(key: string, value: string): void

// HTTP utilities (for fetching tokens, etc.)
await rf.fetch(url: string, options?: RequestInit): Response

// Logging (visible in the script console below the editor)
rf.log(...args: unknown[]): void
rf.warn(...args: unknown[]): void
rf.error(...args: unknown[]): void

// Assertions (fail fast if preconditions aren't met)
rf.assert(condition: boolean, message?: string): void

// Request mutation (headers only — query is immutable)
rf.setHeader(name: string, value: string): void
rf.removeHeader(name: string): void

// Operation metadata (read-only)
rf.operation.name: string | undefined  // current operation name (undefined for anonymous operations)
rf.operation.type: 'query' | 'mutation' | 'subscription'
rf.operation.variables: object         // parsed variables object (read-only)
```

### 14.2 Common Patterns

```javascript
// Pattern 1: Refresh OAuth token before request
const stored = rf.getEnv('accessToken');
const expiry = parseInt(rf.getEnv('tokenExpiry') || '0');
if (Date.now() > expiry) {
  const resp = await rf.fetch('{{authUrl}}/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: rf.getEnv('clientId') ?? '',
      client_secret: rf.getEnv('clientSecret') ?? '',
    }),
  });
  const data = await resp.json();
  rf.setEnv('accessToken', data.access_token);
  rf.setEnv('tokenExpiry', String(Date.now() + data.expires_in * 1000));
}
rf.setHeader('Authorization', `Bearer ${rf.getEnv('accessToken')}`);

// Pattern 2: Inject per-tenant header
rf.setHeader('X-Tenant-ID', rf.getEnv('tenantId'));

// Pattern 3: Assert precondition
rf.assert(!!rf.getEnv('userId'), 'userId environment variable must be set');
```

### 14.3 Post-Response Script API

Post-response scripts run after the response is received:

```typescript
// Response access
rf.response.httpStatus: number
rf.response.data: unknown        // parsed JSON data (from `data` field)
rf.response.errors: GraphqlError[] | undefined
rf.response.latencyMs: number
rf.response.headers: Record<string, string>

// Chaining — extract values into env vars for subsequent operations
// Note: rf.response.data is typed as unknown; cast to access fields safely
rf.setEnv('createdUserId', (rf.response.data as any).createUser.id);

// Assertions
rf.assert(rf.response.errors === undefined, 'Expected no GraphQL errors');
rf.assert(rf.response.latencyMs < 500, 'Response took too long');
```

---

## 15. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ Enter` / `Ctrl Enter` | Execute operation |
| `⌘ K` | Focus schema search (schema explorer) — note: `⌘K` is Monaco's chord prefix; only intercept when editor is **not** focused |
| `⌘ Shift F` | Format / prettify operation |
| `⌘ /` | Toggle line comment |
| `⌘ Shift I` | Trigger schema introspection |
| `⌘ T` | New operation tab — note: conflicts with "new browser tab" in web (non-Tauri) mode; Tauri intercepts it correctly |
| `⌘ W` | Close current tab |
| `⌘ ]` / `⌘ [` | Next / previous tab |
| `⌘ B` | Toggle schema explorer sidebar |
| `F1` | Monaco command palette |
| `⌘ Shift C` | Open code generator |
| `⌘ Shift H` | Open operation history |
| `⌘ L` | Clear response |
| `Escape` | Cancel in-progress execution |
| `⌘ Z` / `⌘ Shift Z` | Undo / redo in editor |

---

## 16. Mockup Reference

The `mockups/` directory contains seven HTML mockups illustrating key screens:

| File | Screen | Phase |
|------|--------|-------|
| `graphql-studio-main.html` | Three-panel main editor view: schema explorer + Monaco editor + response viewer | Phase 1 |
| `graphql-schema-explorer.html` | Full-screen schema browser: type list + field detail table + SDL panel | Phase 1 |
| `graphql-subscription-testing.html` | Subscription editor + live message stream + test assertions + stats | Phase 2 |
| `graphql-test-runner.html` | Test collections sidebar + results table with SLA badges + assertion detail panel | Phase 3 |
| `graphql-workflow-testing.html` | Workflow canvas with GraphQL nodes + properties panel + run timeline | Phase 4 |
| `graphql-query-builder.html` | Visual field selector: schema tree + field checkbox grid + live query preview | Phase 2 |
| `graphql-code-generation.html` | Code generation panel: operation + target language selector + generated output + collections | Phase 3 |

All mockups use the Catppuccin Mocha dark theme (`#1e1e2e` base) consistent with the rest of the app.

---

## 17. Phase Status Tracker

| Phase | Status | Start | Complete |
|-------|--------|-------|----------|
| Phase 1 — MVP | Not Started | — | — |
| Phase 2 — Subscriptions + Builder | Not Started | — | — |
| Phase 3 — Collections + Code Gen | Not Started | — | — |
| Phase 4 — Workflow + Lessons | Not Started | — | — |

---

## 18. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `monaco-graphql` bundle size | Medium | Tree-shake, lazy-load the GraphQL worker only when tab is active |
| Subscription protocol fragmentation | Medium | Auto-detect protocol; provide manual override in connection settings |
| Public test APIs going down | Low | Local Docker test server as primary; public APIs as secondary |
| Schema introspection disabled on production APIs | Medium | Allow manual schema upload (SDL file or paste) as alternative |
| `@defer`/`@stream` not widely adopted yet | Low | Feature is additive; basic query/mutation works without it |
| File upload spec variations across servers | Medium | Stick to standard `graphql-multipart-request-spec`; document known server quirks |
| Monaco editor memory with many tabs | Medium | Dispose unused models; limit to 8 tabs (same as WebSocket Studio) |

---

## 19. Testing Strategy

### Unit Tests
- `schemaParser.test.ts` — introspection result → navigable type tree
- `queryBuilder.test.ts` — field selection → valid SDL output
- `codeGenerator.test.ts` — operation → TypeScript/cURL/Python snippets
- `multipartParser.test.ts` — chunked response → merged JSON
- `preRequestScriptRunner.test.ts` — rf.* API, sandbox isolation, env mutation, abort on rf.assert failure
- `graphqlClient.test.ts` — HTTP transport, WS transport, protocol detection, auth header injection
- `useGraphqlExecution.test.ts` — hook behavior for query/mutation lifecycle
- `useGraphqlSubscription.test.ts` — connection states, message buffering, reconnect logic
- `useGraphqlSchema.test.ts` — introspection caching, polling interval, stale detection
- `useGraphqlHistory.test.ts` — save/load/clear history, max 100 items enforcement
- `useGraphqlQueryBuilder.test.ts` — toggleField adds/removes from selectedFields; SDL generator produces valid document; alias/directive/fragment state mutations; reset clears all state
- `useGraphqlHistory.test.ts` — save/load/clear history, max-items FIFO eviction, recency grouping, search filter
- `useGraphqlCollections.test.ts` — add/update/delete items and folders, pin/unpin, drag-and-drop reorder, persistence round-trip
- `useGraphqlMockServer.test.ts` — mock enable/disable, custom resolver CRUD, config sync to server, reset to defaults
- `useGraphqlEnvironments.test.ts` — variable resolution precedence order, `{{var}}` interpolation
- `codeGenerator.test.ts` — each target language produces syntactically valid output; TypeScript types match selected fields; variables interface includes all operation variables
- `schemaDiff.test.ts` — removed field is `BREAKING`; added optional field is `SAFE`; changed type is `BREAKING`; zero changes for identical schemas
- `schemaSnapshot.test.ts` — capture saves to IndexedDB; max-20 FIFO eviction; load/delete round-trip
- `apqClient.test.ts` — SHA-256 hash is deterministic for same query; normalized whitespace produces same hash; two-step flow fires full query on `PERSISTED_QUERY_NOT_FOUND`; cache-hit path sends hash-only
- `preRequestScriptRunner.test.ts` — rf.* API, sandbox isolation (window/document undefined), env mutation, abort on rf.assert failure, script timeout at configured limit

### E2E Tests (Playwright)
- `e2e/graphql-basic.spec.ts` — connect, introspect, execute query, verify response
- `e2e/graphql-mutations.spec.ts` — execute mutation, verify state change
- `e2e/graphql-subscriptions.spec.ts` — subscribe, receive messages, unsubscribe
- `e2e/graphql-schema-explorer.spec.ts` — search types, click-to-insert
- `e2e/graphql-collections.spec.ts` — save, organize, re-run operations
- `e2e/graphql-variables.spec.ts` — variable interpolation, environment variables
- `e2e/graphql-file-upload.spec.ts` — upload file via multipart
- `e2e/graphql-workflow-nodes.spec.ts` — workflow with GraphQL nodes executes

### Test Scenarios (docs/plan/future/graphql/test-scenarios/)
- `graphql-editor-test-scenarios.md`
- `graphql-schema-explorer-test-scenarios.md`
- `graphql-subscriptions-test-scenarios.md`
- `graphql-workflow-nodes-test-scenarios.md`
- `graphql-collections-test-scenarios.md`
- `graphql-file-upload-test-scenarios.md`
- `graphql-code-generation-test-scenarios.md`
- `graphql-pre-request-scripts-test-scenarios.md`

---

## 20. References

- [GraphiQL Monorepo](https://github.com/graphql/graphiql) — 16.8k stars, official GraphQL IDE
- [Altair GraphQL Client](https://altairgraphql.dev/) — v8.5.4, Desktop/browser, environments, plugins, file upload
- [GraphQL Playground](https://github.com/graphql/graphql-playground) — Archived May 2026 (merged into GraphiQL)
- [Postman GraphQL](https://www.postman.com/graphql/) — Visual builder, schema introspection, subscriptions
- [Apollo GraphOS Explorer](https://www.apollographql.com/docs/graphos/explorer/) — Monaco-based, two-step search, operation collections, scripting
- [Hive (The Guild)](https://the-guild.dev/graphql/hive) — Schema registry, federation, observability, MIT licensed
- [Hoppscotch](https://hoppscotch.io/) — Open-source Postman alternative with GraphQL tab
- [graphql-ws](https://github.com/enisdenjo/graphql-ws) — Spec-compliant WebSocket subscriptions (`graphql-transport-ws` protocol)
- [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) — Legacy Apollo subscription protocol (deprecated)
- [graphql-sse](https://github.com/enisdenjo/graphql-sse) — GraphQL over Server-Sent Events transport spec
- [monaco-graphql](https://github.com/graphql/graphiql/tree/main/packages/monaco-graphql) — Monaco GraphQL language mode
- [cm6-graphql](https://github.com/graphql/graphiql/tree/main/packages/cm6-graphql) — CodeMirror 6 GraphQL extension (not used; reference only)
- [GraphQL Multipart Request Spec](https://github.com/jaydenseric/graphql-multipart-request-spec) — File upload standard
- [Incremental Delivery RFC](https://github.com/graphql/graphql-spec/blob/main/rfcs/DeferStream.md) — `@defer`/`@stream` specification
- [GraphQL Spec](https://spec.graphql.org/) — June 2018 + October 2021 editions
- [GraphQL Voyager](https://github.com/graphql-kit/graphql-voyager) — Visual schema relationship explorer
- [WebSocket Studio Plan](../websocket/websocket-studio-plan.md) — Pattern reference for connection management, proxy architecture, and tab layout
