# GraphQL Studio — Feature Plan

> **Status**: Phase 1 ✅ Complete (1A–1E) | Phase 2 ✅ Complete (2A–2G, 8 sprints) | Phase 3 ✅ Complete — 3279 tests pass, 0 type errors | Phase 4 🔲 Planned
> **Target Version**: v0.8.x  
> **Prerequisites**: WebSocket Studio (done), Kafka Studio (done), SSE Studio (done)  
> **Last Updated**: 2026-06-18
> **Editor**: Monaco (already in project via `@monaco-editor/react`)

## Implementation Status

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **1A** | Monaco Editor Integration | ✅ **Done** | Multi-tab editor, variables/headers panels, localStorage persistence, `monaco-graphql` worker, **close-tab two-click confirm** |
| **1B** | Schema Introspection + Explorer | ✅ **Done** | Introspect button, schema parser, schema caching, polling, type explorer with SDL highlighting |
| **1C** | Query Execution Engine | ✅ **Done** | HTTP POST execution, 3-tab response viewer, cancellation, vars validation, **query AST validation squiggles + ⚠ badge**, **Prettify button** |
| **1D** | Connection Management | ✅ **Done** | Auth config popover (Bearer/Basic/API Key), recent endpoints dropdown, **Connection Profiles (save/load endpoint+auth)** |
| **1E** | Environment Variables | ✅ **Done** | `{{var}}` interpolation, two-panel env manager modal, unresolved-var warnings |
| **2A** | Subscription (WS/SSE) | ✅ **Done** | `graphql-ws`, SSE streaming, reconnect, pause/resume, stats, message log |
| **2B–2E Sprint 3–5** | SSE + File Upload + Legacy WS | ✅ **Done** | `graphql-sse` transport, subscription filter bar, multipart file upload, legacy compat, storage.ts migration |
| **2D Sprint 7** | Incremental Delivery + Tracing | ✅ **Done** | `@defer`/`@stream` multipart streaming, `GraphqlTracingView.tsx` Gantt waterfall, query complexity estimator |
| **2F Sprint 6** | Visual Query Builder MVP | ✅ **Done** | `useGraphqlQueryBuilder.ts` (state hook) + `queryBuilderGenerator.ts` (SDL gen) + `GraphqlQueryBuilder.tsx` (field tree, arg inputs, schema search, Edit in Editor) — full-width builder mode with 3-column layout |
| **2C-5 + 2E-4 Sprint 8** | Subscription Assertions + Upload Progress | ✅ **Done** | JSONPath assertion panel, per-message badges, aggregate stats bar, XHR upload progress bar |
| **Phase 2 Deferred (P2 items)** | Fragment Panel, Directive Toggles, Alias, Histogram, Config UI | ⏸ **Deferred** | All P2-priority items explicitly deferred in §23.11 — ship after MVP feedback. See §23.11 for full list. |
| **Phase 3** | Collections + Code Gen | 🔲 Planned — **Re-evaluated 2026-06-18 (27 gaps addressed)** | History (side-panel preview, recent section), collections (runner, variables, fork, schema validation badges), scripts (collection-level + global, rf.test/abort/skip/store, 10s timeout, prototype-safe), code gen (10 targets incl. react-query/go/kotlin, live regen, batch zip), schema diff (lazy-loaded, DEPRECATED, acknowledge, HTML export, op validation, deprecated tracker), mock server (desktop-only, Error mode, scenarios, scalar factories, request log), APQ (hash cache, GET), batching (order, timeout, compat detect), dedup (Promise-store, abort isolation), complexity gate |
| **Phase 4** | Workflow Integration + Lessons | 🔲 Planned | Workflow nodes, demo lessons, gallery templates, E2E tests |

> Key implementation files: `GraphqlStudioPage.tsx`, `useGraphqlExecution.ts`, `useGraphqlSchema.ts`, `graphqlClient.ts`, `monacoGraphqlSetup.ts`.

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

## 3. Feature Specification

### 3.1 Core Features (Phase 1 — MVP) — ✅ Complete

> **Condensed** — Phase 1 (1A–1E) is fully implemented with 167 bugs fixed. Detailed feature specs preserved in git history.
>
> - **1A** — Monaco Editor: multi-tab editor, `monaco-graphql` worker, variables/headers panels, `⌘ Enter` execute
> - **1B** — Schema Explorer: introspection, polling, 2-pane explorer, SDL tokenizer, click-to-navigate type refs
> - **1C** — Execution Engine: HTTP POST via proxy, 3-tab response viewer, abort, partial results, vars validation
> - **1D** — Connection Management: auth popover (Bearer/Basic/API Key/OAuth2/Custom), recent endpoints, connection profiles
> - **1E** — Environment Variables: `{{var}}` interpolation, two-panel env manager modal, Postman import, unresolved-var warnings

### 3.2 Advanced Features (Phase 2) — ✅ Complete

> **Condensed** — Phase 2 (2A–2G) is fully implemented across 8 sprints, 1015 tests. Detailed feature specs preserved in git history.
>
> - **2A** — WebSocket Subscriptions: `graphql-ws` + `subscriptions-transport-ws` legacy compat, state machine, reconnect, pause/resume
> - **2B** — SSE Subscriptions: `graphql-sse`, auto-detection, transport selector dropdown
> - **2C** — Subscription UI: message log with stats/toolbar/filter/export, JSONPath filter, assertion panel
> - **2D** — Incremental Delivery: `@defer`/`@stream` via `meros`, proxy streaming, chunk tracking
> - **2E** — File Upload: drag-drop UI, multipart FormData, busboy proxy, XHR progress, size validation
> - **2F** — Visual Query Builder: 3-column layout, field tree, arg inputs, schema search, "Edit in Editor"
> - **2G** — Performance & Tracing: Apollo Tracing waterfall, query complexity estimator
### 3.3 Power Features (Phase 3) — ✅ Complete

Phase 3 is fully implemented. Key architectural decisions preserved below.

**3A — Collections & History** (`useGraphqlHistory.ts`, `useGraphqlCollections.ts`, `idbGraphqlHistory.ts`, `idbGraphqlCollections.ts`)
- History entries keyed by `crypto.randomUUID()` — NOT `connectionId+timestamp` (two concurrent collection-runner executions in the same ms would cause silent IDB key collisions with a composite key)
- Compound IDB index `[connectionId, timestamp]` is required for efficient per-connection range queries; two separate single-field indexes do NOT enable compound range queries in IDB
- Response JSON stored as string capped at **512KB** (`__TRUNCATED__` sentinel appended); in-memory state mirrors the IDB cap so UI and persistence are always consistent
- FIFO eviction is **per-connection** (not global) — each connection has its own ring buffer up to `historyMaxItems` (default 100, range 10–500)
- `sortOrder: number` on folders and items drives display order; drag-and-drop writes new `sortOrder` values to IDB immediately; items are sorted by this field at load time
- Collection-level variables (`GraphqlCollection.variables`) are script-only — they do NOT participate in `{{var}}` URL/header interpolation automatically
- Execution order: `collection.preRequest → item.preRequest → HTTP → item.postResponse → collection.postResponse`
- Import Replace mode must be a **single atomic IDB transaction** (delete + insert); never two separate transactions
- `idbSaveHistoryItem` serializes concurrent saves through a per-connection `_saveQueues` Map to prevent TOCTOU exceeding `maxItems`

**3B — Scripts** (`preRequestScriptRunner.ts`)
- Sandbox: `new Function`-based with `window`, `document`, `globalThis`, `process`, `require`, `Function`, `constructor` all shadowed to block prototype-chain escape (`constructor.constructor('return process')()` pattern)
- `eval` intentionally NOT shadowed — `const eval = undefined` is a SyntaxError in strict mode
- Default timeout: **10 s** (not 5 s — OAuth flows can take 5–8 s on slow connections); `Promise.race` with a rejection timer
- `rf.abort(msg)` throws `ScriptAbortError` (blocks request); `rf.skip()` throws `ScriptSkipError` (skips in collection runner); neither is a simple `throw` so the runner can distinguish abort vs. skip vs. test failure
- `rf.test('name', fn)` registers `{ name, fn }` in a `pendingTests[]` array; the runner resolves all via `Promise.allSettled` AFTER the script body completes (not inline)
- `rf.store` is a `Map<string, unknown>` (superset of the planned get/set/delete interface); outside the collection runner, `rf.store` is a no-op `NoOpStore` class that extends `Map` with silent set/delete
- 3B-9 (global scripts) and 3B-12 (`rf.expect()` Chai-style assertions) explicitly deferred

**3D — Schema Diff** (`schemaDiff.ts`, `schemaSnapshot.ts`, `schemaDiffAck.ts`)
- Uses **synchronous `graphql` v17 built-ins** (`findBreakingChanges`, `findDangerousChanges`, `findSchemaChanges`) — NOT `@graphql-inspector/core` as originally planned (compatibility issue with graphql v17)
- Max 20 snapshots per connection; FIFO eviction deletes oldest before inserting new (atomic: delete + insert in single IDB tx)
- Acknowledgements stored in separate `graphql-diff-acknowledgements` store (snapshots are write-once; acks are mutable) — key format: `${connectionId}__${snapshotId}__${changePath}`

**3E — Mock Server** (`useGraphqlMockServer.ts`, `GraphqlMockPanel.tsx`, `src-server/routes/graphql/mock-routes.ts`)
- **Desktop-only**: network calls guarded by `isTauri()` — mock server runs inside the Tauri proxy, not available in web/browser mode
- `@graphql-tools/mock` + `addMocksToSchema()` on server; resolver overrides, custom scalar factories, scenario/fixture mode, request log (max 200)
- Seed field deferred (displays "(coming soon)" label); deterministic randomness not implemented

**3F — Advanced Query** (`apqClient.ts`, `useGraphqlBatchExecution.ts`, `dedupExecution.ts`)
- APQ: SHA-256 via `crypto.subtle`; **500-entry FIFO hash cache** in memory; two-step POST flow; GET support for queries only (mutations always POST); `isAPQUnsupported` requires `response.data === null` AND status 400/405 to avoid false positives from generic 400s
- Batch: 30 s timeout per connection; result cards in request-index order; try-and-cache-failure detection (no pre-flight probing)
- Dedup: **synchronous djb2 hash** of `connectionId + print(parse(query)) + JSON.stringify(sortedVars)` (NOT `crypto.subtle` — async SHA-256 is too slow on the hot path); `connectionId` MUST be in the key to prevent cross-connection false positives; stores `Promise<GraphqlResponse>` (not just AbortController) to enable "Wait and merge" without extra network call; within-tab scope only
- Complexity gate: optional; shows field-breakdown modal; "Remember for session" checkbox

> Phase 3 implementation completed 2026-06-18. Full spec in git history.


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

## 5. Implementation Phases


> **Phase 1 & Phase 2 task tables**: All tasks complete — 1A (7 tasks), 1B (8 tasks), 1C (6 tasks), 1D (8 tasks), 1E (6 tasks), 2A (9 tasks), 2B (4 tasks), 2C (5 tasks), 2D (5 tasks), 2E (5 tasks), 2F (11 tasks, 6 MVP + 5 deferred), 2G (5 tasks, 2 done + 3 deferred). Per-task details in git history.

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


## 10. Success Criteria

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


## 19. Testing Strategy

### Unit Tests
- `schemaParser.test.ts` — introspection result → navigable type tree
- `queryBuilder.test.ts` — field selection → valid SDL output
- `multipartParser.test.ts` — chunked response → merged JSON
- `preRequestScriptRunner.test.ts` — rf.* API, sandbox isolation, env mutation, abort on rf.assert failure
- `graphqlClient.test.ts` — HTTP transport, WS transport, protocol detection, auth header injection
- `useGraphqlExecution.test.ts` — hook behavior for query/mutation lifecycle
- `useGraphqlSubscription.test.ts` — connection states, message buffering, reconnect logic
- `useGraphqlSchema.test.ts` — introspection caching, polling interval, stale detection
- `useGraphqlHistory.test.ts` — save/load/clear history, max-items FIFO eviction, recency grouping, search filter, max 100 items enforcement
- `useGraphqlQueryBuilder.test.ts` — toggleField adds/removes from selectedFields; SDL generator produces valid document; alias/directive/fragment state mutations; reset clears all state
- `useGraphqlCollections.test.ts` — add/update/delete items and folders, pin/unpin, drag-and-drop reorder, persistence round-trip
- `useGraphqlMockServer.test.ts` — mock enable/disable, custom resolver CRUD, config sync to server, reset to defaults
- `useGraphqlEnvironments.test.ts` — variable resolution precedence order, `{{var}}` interpolation
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
