# GraphQL Studio — Living Plan

> Status: Phase 1–4 complete, Phase 5 (Demo Lessons) in progress
> Last Updated: 2026-06-20 (lesson plan audit)
> Scope: Completed phase task tables removed (use git history for those). Forward-looking plan content (Phase 5 spec, task list, success criteria, reference sections) is kept in full.

## Implementation Status

| Area | Status | Notes |
|---|---|---|
| Phase 1 (Core Studio) | ✅ Complete | Editor, schema explorer, execution, auth, environments |
| Phase 2 (Advanced Studio) | ✅ Complete | Subscriptions, incremental delivery, upload, builder, tracing |
| Phase 2 Deferred Items | ✅ Complete | Alias/directives, fragment panel, histogram, config UI |
| Phase 3 (Power Features) | ✅ Complete | Collections/history/scripts, schema diff, mock server, APQ/batch/dedup |
| Phase 4 (Workflow Integration) | ✅ Complete | GraphQL workflow nodes + runner + config panels + gallery templates |
| Phase 4 live E2E subset | ✅ Complete | Live specs for subscriptions, schema explorer, query builder, collections, code-gen |
| Phase 5 (Demo Lessons) | ✅ Complete | Lessons 1–13 implemented, including optional Mock Server coverage |

> Phase 1–4 per-task details: `git show 94d99dce:docs/plan/future/graphql/graphql-studio-plan.md`

---

## Phase 5 — Demo Lessons (4E)

Lessons are registered under `protocolsDomain` → `graphql` category (new, alongside `websocket` and `sse`). They share existing lesson infrastructure (`useDemoHub`, `DemoHubContext`, lesson step engine).

**Lesson registration file**: `src/features/demo-player/lessons/protocols/graphql-lessons.ts`

### Lesson Catalog (12 core + 1 optional)

| # | Lesson title | Steps | Est. time | Status | Key concepts covered |
|---|---|---|---|---|---|
| 1 | Your First GraphQL Query | 7 | 3 min | ✅ | Endpoint, introspect, schema browse, write query, execute, response, history auto-save |
| 2 | Variables & Arguments | 8 | 3 min | ✅ | Variables panel, `$id: ID!` syntax, query reuse with different values |
| 3 | Mutations — Create, Delete & Input Types | 9 | 4 min | ✅ | Mutation syntax, input types (`OrderInput!`), create/delete, idempotent delete |
| 4 | Schema Exploration | 7 | 3 min | ✅ | Type browser, type-name search, field table, Try → insert, SDL export |
| 5 | Subscriptions — Real-Time Data | 10 | 4 min | ✅ | WS subscribe, live log, pause/filter, assertion panel, disconnect |
| 6 | Authentication & Headers | 7 | 3 min | ✅ | Auth popover, Bearer/API key, env vars, request headers in Metadata, connection profiles |
| 7 | Query Builder — Visual Operations | 10 | 4 min | ✅ | Builder mode toggle, field tree, args, aliases/directives, code preview, Edit in Editor |
| 8 | Collections & History | 8 | 3 min | ✅ | History load vs run, save to collection, rename via context menu, export/import |
| 9 | Export & Share Queries | 5 | 3 min | ✅ | Builder code preview, copy SDL, Edit in Editor, history Copy as cURL |
| 10 | Performance Tracing | 7 | 4 min | ✅ | Complexity badge, tracing tab/waterfall, sort, latency histogram |
| 11 | Workflow Integration | 8 | 4 min | ✅ | graphqlQuery + graphqlAssert nodes, output binding, Quick Test pass/fail |
| 12 | Schema Diff & Breaking Changes | 7 | 3 min | ✅ | Save snapshot, changelog, diff modal, BREAKING count, severity filters, export JSON |
| 13 *(optional P2)* | Mock Server | 7 | 3 min | ✅ | Desktop-only mock proxy, resolver overrides, latency simulation, restore live endpoint |

> **Lesson 9 rework (2026-06-20):** The original “Code Generation & Export” spec assumed a multi-target Code Gen panel (`typescript-graphql-request`, `python-gql`, file download). **That UI is not implemented.** Shipped codegen is the Query Builder live preview (`gql-qb-code`) + copy/edit toolbar, plus History **Copy as cURL** in the context menu. Lesson 9 is retitled and scoped to match.
>
> **Lesson 13 (optional):** Mock Server (Phase 3E) is a major shipped feature with no lesson coverage. Add as P2 after core 12 if bandwidth allows.

### Phase 5 Lesson Audit (2026-06-20)

Audit method: cross-checked each lesson step against implemented UI (`src/features/graphql/`), Docker test server (`docker/graphql/server.js`), `src/shared/selectors.ts`, and implemented lessons 1–4.

| Lesson | Verdict | Issues found & resolution |
|---|---|---|
| **1** | ✅ Accurate | Implemented. Step 4 correctly uses Schema tab browse (deeper exploration deferred to Lesson 4). |
| **2** | ✅ Accurate | Implemented. Setup `seedDemoUsers()` documented. |
| **3** | ⚠️ Catalog fixed | Title was “Create, Update, Delete” but server has **no `updateUser`**. Catalog + steps already corrected in expanded detail; title updated in catalog. |
| **4** | ⚠️ Catalog fixed | “Field documentation” misleading — test server SDL has **no field descriptions**. Lesson focuses on field **table** (name, type, args). Search filters **type names** only. |
| **5** | ✅ Implemented | Lesson file + helpers + tests. Selectors corrected (`gql-sub-log`, `gql-sub-pause-btn`, `gql-stop-sub-btn`). Setup seeds order via `createDemoOrder()`. |
| **6** | ✅ Implemented | Lesson file + helpers + tests. Plan corrected: Auth/Profiles are connection-bar popovers (no “Auth tab”). **Request headers** section added to Metadata tab (`gql-rv-request-headers`) so learners can verify outgoing `Authorization` / `X-API-Key`. Test server does not enforce auth. |
| **7** | ✅ Implemented | Lesson file + helpers + tests. Builder is **mode toggle** (`gql-mode-builder`). Aliases/directives in Summary panel (`gql-fo-alias-user.id`, `gql-fo-include-user.id`). Select-all: `gql-qb-select-all`. Flat `User` type — expand `user` row for subfields, alias on `user.id`. |
| **8** | ✅ Implemented | Lesson file + helpers + tests. History: single-click preview, **Load** vs **Run**. Collection items rename via **context menu** (double-click loads). Export/import with merge dialog. Lesson 1 history step corrected (no double-click re-run). |
| **9** | ✅ Implemented | Lesson file + helpers + tests. No multi-target Code Gen panel — lesson uses Builder SDL preview/copy/edit + History **Copy as cURL**. Step 5 always executes before cURL so the history entry matches the lesson query. |
| **10** | ✅ Implemented | Lesson file + helpers + tests. Selectors corrected: `gql-rv-tab-tracing`, `gql-trace-view`, `gql-trace-sort-duration` (not stale `gql-tracing-*` ids). Histogram appears after **≥2** executions (not 3). Docker server returns Apollo Tracing v1. |
| **11** | ✅ Implemented | Lesson file + helpers + tests. Cross-feature: `allowedTabs: ['workflow', 'workflow-runner']`. Assert uses **Output** binding `latencyMs` → `gqlLatency` (not raw `{{GraphQL Query.latencyMs}}`). Step 7 uses **Quick Test** for visible green nodes (Workflow Runner available for harness runs). Operator: `less_than` (UI label `<`). |
| **12** | ⚠️ UX fixes | **Save snapshot** has no label prompt — auto-timestamped label. Changelog tab: `gql-se-tab-changelog`. Diff breaking count uses `gql-diff-count--breaking` in modal, not a standalone `gql-breaking-badge`. Schema-change flow: compare via changelog **or** re-introspect + `gql-schema-change-toast` — switching physical endpoint optional. |
| **13** *(new)* | 💡 Recommended | Mock Server panel (`gql-activity-mock`) is shipped but uncovered. Optional P2 lesson. |

**Additional lesson content considered (not added to core 12):**

| Topic | Shipped? | Recommendation |
|---|---|---|
| Mock Server | ✅ Phase 3E | **Lesson 13 (optional P2)** — high value |
| Custom Headers panel | ✅ `gql-bottom-tab-headers` | Fold into Lesson 6 (step added) |
| File Upload (`@defer`/multipart) | ✅ Phase 2E | Defer — niche; mention in advanced docs only |
| APQ / Batch / Dedup | ✅ Phase 3F | Defer — power-user; not demo-lesson material |
| Fragment panel / directives in editor | ✅ Phase 2 | Partially covered by Lesson 7 Summary panel |
| `ws-graphql` (WebSocket category) | ✅ separate | Keep separate — protocol transport, not GraphQL Studio |

### `preAction` Guard Requirements

Mandatory per `demo-player-lessons` rules — all stateful steps need guards:

| Lesson | Stateful steps requiring `preAction` | Guard responsibility |
|---|---|---|
| 1 | Steps 2–7 | Ensure connection is set to the test endpoint; restore introspected schema if absent |
| 2 | Steps 2–8 | Ensure a valid parameterized query is in the editor; restore introspected schema |
| 3 | Steps 2–9 | Ensure mutation operation is loaded; ensure `$id` variable is set to last created ID |
| 4 | Steps 2–7 | Ensure introspection has completed (schema tree populated) |
| 5 | Steps 2–10 | Ensure endpoint set; order created for `orderId`; subscription connected/paused as needed |
| 6 | Steps 2–7 | Ensure auth popover configured; profile selected if demonstrating profiles |
| 7 | Steps 2–10 | Ensure Builder mode active (`gql-mode-builder`); introspected schema loaded |
| 8 | Steps 2–8 | Ensure at least one history entry exists |
| 9 | Steps 2–5 | Ensure Builder mode with fields selected (generated preview visible) |
| 10 | Steps 2–7 | Ensure query executed against tracing-enabled server; tracing data in response |
| 11 | Steps 2–8 | Ensure workflow canvas has graphqlQuery node configured |
| 12 | Steps 2–7 | Ensure at least one schema snapshot saved in Changelog tab |
| 13 | Steps 2–7 | Ensure mock server enabled with introspected schema |

### Expanded Step Detail — Lesson 1

| Lesson 1 — Your First GraphQL Query (7 steps) |
|---|
| Step 1: GraphQL Studio overview — connection bar (endpoint, Introspect, Execute) |
| Step 2: Enter `http://localhost:4010/graphql` in the endpoint field |
| Step 3: Click **Introspect** — wait for green schema badge |
| Step 4: Open **Schema** right tab — browse type list (`Query`, `health`, `user`) |
| Step 5: Switch to **Editor** mode — write `query { health }` in Monaco |
| Step 6: Click **Execute** — read HTTP status, latency, and JSON response body |
| Step 7: Open **History** activity panel — verify auto-saved entry from execution |

> **Prerequisite:** Docker GraphQL test server on port **4010** (`cd docker/graphql && docker compose up -d`).
> **Note:** `ws-graphql` (WebSocket category, port 4100) covers subscription protocol frames — it does **not** satisfy this lesson.
> **Next:** Lesson 2 builds on the same server with parameterized `user(id: $id)` queries.
> **Deeper dive:** Lesson 4 expands Schema Explorer (search, Try → insert, SDL export) beyond the brief browse in step 4 here.

### Expanded Step Detail — Lesson 2

| Lesson 2 — Variables & Arguments (8 steps) |
|---|
| Step 1: Introduce the **Variables** bottom tab — JSON keys map to `$variables` in the query |
| Step 2: Enter `http://localhost:4010/graphql` in the endpoint field |
| Step 3: Click **Introspect** — wait for green schema badge |
| Step 4: Write `query GetUser($id: ID!) { user(id: $id) { id name email } }` in the editor |
| Step 5: Open the **Variables** tab — observe the JSON editor |
| Step 6: Set `{ "id": "<alice-id>" }` (Alice seeded via `createUser` in setup) → **Execute** → read Alice in response |
| Step 7: Change `id` to Bob's ID → **Execute** again → read Bob in response |
| Step 8: Compare responses — same query text, different variable values, different users |

> **Setup note:** Lesson 2 `setup()` quietly calls `createUser` twice (Alice & Bob) because the test server's user store starts empty. IDs are captured at runtime (`usr-N`) — not hardcoded.
> **Next:** Lesson 3 covers mutations (`createUser`, `createOrder`, `deleteUser`) on the same server.

### Expanded Step Detail — Lesson 3

| Lesson 3 — Mutations — Create, Delete & Input Types (9 steps) |
|---|
| Step 1: Introduce **mutations** — tab badge switches from Q to **M** (amber) |
| Step 2: Enter `http://localhost:4010/graphql` |
| Step 3: Click **Introspect** — load `Mutation` type in schema |
| Step 4: Write `mutation CreateUser($name: String!, $email: String!) { createUser … }` |
| Step 5: Set variables `{ "name": "Carol", "email": "carol@demo.local" }` → **Execute** |
| Step 6: Read create response — capture `data.createUser.id` for later delete |
| Step 7: Write `mutation CreateOrder($input: OrderInput!) { … }` — demonstrates **input object** type |
| Step 8: Write `mutation DeleteUser($id: ID!) { … }` — set `$id` to Carol's created id |
| Step 9: **Execute** delete twice — first `success: true`, second `success: false` (idempotency) |

> **Plan correction:** The port **4010** test server has `createUser`, `createOrder`, and `deleteUser` — **no `updateUser` mutation**. Lesson 3 uses create → input-type order → delete → idempotent re-delete instead of update. There is no optimistic UI preview in GraphQL Studio (removed from scope).

### Expanded Step Detail — Lesson 4

| Lesson 4 — Schema Exploration (7 steps) |
|---|
| Step 1: Introduce **Schema** right tab — type list + detail panel after introspection |
| Step 2: Enter `http://localhost:4010/graphql` |
| Step 3: Click **Introspect** — wait for green schema badge |
| Step 4: Open Schema tab → select **Query** → browse fields (`health`, `user(id: ID!)`) |
| Step 5: **Search** `User` → select **User** type → inspect field table (`id`, `name`, `email`) |
| Step 6: Select **Query** → click **Try →** on `health` → field inserted into editor + toast |
| Step 7: **SDL** tab on Query → **Export SDL** downloads full schema |

> **Plan note:** Schema search filters **type names**, not individual field names. The test server SDL has no field descriptions — the lesson focuses on the field table (name, type, args columns). Export button testid is `gql-se-export-sdl-btn` (toolbar). Save-snapshot for Lesson 12 is `gql-se-save-snapshot` (separate from export).

### Expanded Step Detail — Lesson 5

| Lesson 5 — Subscriptions — Real-Time Data (10 steps) |
|---|
| Step 1: Introduce **subscriptions** — operation badge shows **S**; Execute becomes **Subscribe** |
| Step 2: Enter `http://localhost:4010/graphql` → **Introspect** |
| Step 3: Run `createOrder` mutation (from Lesson 3 pattern) — capture `orderId` for the subscription variable |
| Step 4: Write `subscription OrderUpdates($orderId: ID!) { orderStatus(orderId: $orderId) { status updatedAt } }` |
| Step 5: Set variables `{ "orderId": "<ord-id>" }` → click **Subscribe** — observe connecting → active status |
| Step 6: Watch **subscription log** — PENDING → PROCESSING → COMPLETE messages arrive (~300ms apart) |
| Step 7: Click **Pause** — messages buffer; click resume — buffered messages appear |
| Step 8: Type a filter term in the log filter — only matching rows shown |
| Step 9: Open **Assertion panel** — add JSONPath assertion on `$.orderStatus.status` |
| Step 10: Click **Disconnect** — session ends; log remains visible for review |

> **Prerequisite:** Same Docker server; WS at `ws://localhost:4010/graphql`. **Not** the `ws-graphql` WebSocket-category lesson (port 4100, raw protocol frames).
> **Setup note:** `setup()` quietly calls `createDemoOrder()` when Docker is up — `orderStatus` requires a valid `orderId`.
> **Selector note:** Disconnect uses `gql-stop-sub-btn` (connection bar) or `gql-sub-stop-btn` (log toolbar). Log panel testid is `gql-sub-log`.

### Expanded Step Detail — Lessons 6–13

| Lesson 6 — Authentication & Headers (7 steps) |
|---|
| Step 1: Click **Auth badge** on connection bar → Auth popover opens (`gql-auth-badge-btn`) |
| Step 2: Select **Bearer Token** → enter `{{authToken}}` in token field |
| Step 3: Click **Env badge** → set `authToken` to a test JWT in the environment modal |
| Step 4: Execute `query { health }` → open response **Metadata** tab → **Request headers** section (`gql-rv-request-headers`) → confirm `Authorization: Bearer …` sent |
| Step 5: Switch auth type to **API Key** → header name `X-API-Key`, value `{{apiKey}}` |
| Step 6: Execute again → Metadata tab → **Request headers** shows `X-API-Key: …` |
| Step 7: Click **Profiles badge** → save current endpoint + auth as a named connection profile |

> **Plan correction:** There is no “Connection settings → Auth tab”. Auth and Profiles are separate popovers on the connection bar. The test server does not reject bad tokens — the lesson teaches configuration and request visibility via the **Request headers** block in Metadata (`GraphqlResponse.requestHeaders`).

| Lesson 7 — Query Builder (10 steps) |
|---|
| Step 1: Click **Builder** mode toggle (`gql-mode-builder`) — field tree appears after introspection |
| Step 2: Expand **Query** root — observe available fields (`health`, `user`) |
| Step 3: Check `health` — observe generated SDL update live in preview (`gql-qb-code`) |
| Step 4: Click **Select All** (`gql-qb-select-all`) at current tree level — then deselect |
| Step 5: Check `user` → fill required `id` argument in builder arg input |
| Step 6: Expand field row in **Summary panel** → set an **alias** (`gql-fo-alias-*`) |
| Step 7: Toggle **@include** directive on a field — observe directive in generated SDL |
| Step 8: Click **Copy** (`gql-qb-copy`) — SDL copied to clipboard |
| Step 9: Click **Edit in Editor** (`gql-qb-edit`) — SDL transfers to Monaco; Builder mode off |
| Step 10: Edit SDL in editor — confirm one-way sync (Builder does not re-parse edits) |

> **Plan correction:** Builder is a **mode toggle**, not a sub-tab. Aliases/directives are in the Summary panel, not inline on tree rows. Test schema has flat `User` type (no nested object fields).

| Lesson 8 — Collections & History (8 steps) |
|---|
| Step 1: Execute `query { health }` — entry appears in **History** activity panel |
| Step 2: Single-click a history entry — preview panel shows query + response |
| Step 3: Click **Load** (`gql-history-load`) — query loads into editor **without** executing |
| Step 4: Click **Run** (`gql-history-run`) — query loads **and** executes immediately |
| Step 5: Click **Save to Collection** on history entry — pick folder in modal |
| Step 6: Open **Collections** panel — verify saved item; **right-click → Rename** (item double-click loads into editor) |
| Step 7: Click **Export** (`gql-collections-export`) — download collections JSON |
| Step 8: Delete collection → **Import** (`gql-collections-import`) from downloaded file — verify restore |

> **Plan correction:** History double-click = **load only**, not execute. No drag-and-drop between folders — use rename via double-click instead.

| Lesson 9 — Export & Share Queries (5 steps) |
|---|
| Step 1: Switch to **Builder** mode — select `health` + `user` fields |
| Step 2: Read live generated query in preview panel (`gql-qb-code`) |
| Step 3: Click **Copy** — paste elsewhere to confirm clipboard contents |
| Step 4: Click **Edit in Editor** — confirm Monaco receives the generated SDL |
| Step 5: Execute a query → History → right-click entry → **Copy as cURL** — valid curl command |

> **Plan correction:** Multi-target Code Gen panel (TypeScript types, `python-gql`, file download) is **not shipped**. This lesson covers the actual export surfaces: Builder preview/copy/edit + History cURL.

| Lesson 10 — Performance Tracing (7 steps) |
|---|
| Step 1: Observe **complexity badge** next to Execute (`gql-complexity-badge`, e.g. "Cost: ~N") |
| Step 2: Add `user(id:)` field to query — watch complexity badge increase |
| Step 3: Execute query — test server returns Apollo Tracing v1 in `extensions.tracing` |
| Step 4: Click **Tracing badge** (`gql-rv-tracing-badge`) or Tracing tab — waterfall appears (`gql-trace-view`) |
| Step 5: Hover a resolver row (`gql-trace-resolver-row`) — read duration tooltip on the Gantt bar |
| Step 6: Click **Slowest first** (`gql-trace-sort-duration`) — slowest resolvers first |
| Step 7: Execute 2+ times total — **histogram strip** appears (`gql-histogram-strip`) after ≥2 latencies |

> **Plan correction:** Tracing UI lives in the response viewer (`gql-rv-tab-tracing`), not a standalone `gql-tracing-tab`. Waterfall testid is `gql-trace-view`. Sort button testid is `gql-trace-sort-duration`. Histogram threshold is **2** executions (implementation), not 3.

| Lesson 11 — Workflow Integration (8 steps) |
|---|
| Step 1: Navigate to **Workflow Designer** — create blank workflow (`allowedTabs` must include designer) |
| Step 2: Drag **GraphQL Query** from palette — purple Q node on canvas |
| Step 3: Configure node — endpoint `http://localhost:4010/graphql` + `query { health }` |
| Step 4: Add **GraphQL Assert** node — wire Query → Assert → End |
| Step 5: Assert **Source** tab — set source variable to `gqlLatency` (from query Output binding) |
| Step 6: Add assertion: JSONPath `$`, operator `less_than` (`<`), value `500` — "Latency under 500ms" |
| Step 7: **Quick Test** — query + assert nodes turn green (pass) |
| Step 8: Change assertion expected to `1` — Quick Test again — assert node red with failure detail |

> **Plan correction:** Latency assert requires an **Output** binding on the query node (`latencyMs` → `gqlLatency`). Source variable is the binding name, not `{{GraphQL Query.latencyMs}}`. Quick Test (not Workflow Runner) is used for visible pass/fail node coloring on the canvas.

| Lesson 12 — Schema Diff (7 steps) |
|---|
| Step 1: Schema Explorer → click **Save snapshot** (`gql-se-save-snapshot`) — auto-labeled entry |
| Step 2: Open **Changelog** tab (`gql-se-tab-changelog`) — snapshot listed |
| Step 3: Select snapshot → **Compare to current** (or pick second snapshot in compare dropdown) |
| Step 4: Diff modal opens (`gql-diff-modal`) — side-by-side SDL with change rows |
| Step 5: Observe **Breaking** count badge (`gql-diff-count--breaking`) and affected fields |
| Step 6: Filter diff by severity (breaking / safe / deprecated) |
| Step 7: Click **Export diff as JSON** (`gql-diff-export-json`) — verify download |

> **Plan correction:** Save snapshot has **no label prompt** (auto timestamp). Prefer changelog **vs. Current Schema** over switching physical endpoints. Setup silently seeds a **Prior release (demo)** baseline snapshot in IDB so compare-to-current shows real BREAKING/SAFE rows against the unchanged Docker server. Breaking count uses CSS class `.gql-diff-count--breaking` (not a standalone testid). Severity filters use `.gql-diff-filter--breaking|safe|deprecated`. `gql-schema-change-toast` is an alternate entry path after re-introspect — not used in this lesson flow.

| Lesson 13 *(optional)* — Mock Server (7 steps) |
|---|
| Step 1: Open **Mock** activity panel (`gql-activity-mock`) |
| Step 2: Toggle mock server **on** (`gql-mock-toggle`) — **MOCK** status row appears |
| Step 3: Point editor endpoint at mock URL `http://localhost:3001/api/graphql/mock` → **Introspect** |
| Step 4: **Resolvers** is the default tab — expand **Query** and override `health` with fixed value `"mock-ok"` |
| Step 5: Execute `query { health }` — response returns overridden value |
| Step 6: Adjust **latency slider** (`gql-mock-latency-slider`) — execute again and observe higher response latency |
| Step 7: Toggle mock off — switch back to `localhost:4010` — live server restored |

> **Plan correction:** This lesson is **desktop-only** because the mock proxy lives inside the Tauri app; the web build shows `gql-mock-guard` instead of interactive controls. The flow does **not** depend on the footer copy button (it has no dedicated testid and is optional). The real teaching path is: introspect live Docker schema → enable mock using that SDL → switch the connection bar directly to the known mock URL → override `Query.health` in the default **Resolvers** tab → simulate latency via the response latency badge/metadata → disable mock and restore the live endpoint.

### Selector Namespace (`src/shared/selectors.ts` — `GQL` object)

**Canonical source:** `src/shared/selectors.ts` — the `GQL` export (lines ~553–776). Do **not** duplicate a stale inline list here.

**Naming conventions (verified 2026-06-20):**

| Area | Prefix / pattern | Examples |
|---|---|---|
| Schema Explorer | `gql-se-*` | `gql-se-search`, `gql-se-type-Query`, `gql-se-save-snapshot`, `gql-se-tab-changelog` |
| Query Builder | `gql-qb-*` / `gql-fo-*` | `gql-qb-field-tree`, `gql-qb-code`, `gql-qb-copy`, `gql-qb-edit`, `gql-fo-alias-user.id` |
| Editor mode | `gql-mode-*` | `gql-mode-editor`, `gql-mode-builder` (not `gql-builder-tab`) |
| Response / tracing | `gql-rv-*` / `gql-trace-*` | `gql-rv-tracing-badge`, `gql-rv-tab-tracing-btn`, `gql-trace-view` |
| Subscriptions | `gql-sub-*` | `gql-sub-log`, `gql-sub-pause-btn`, `gql-sub-filter-input`, `gql-stop-sub-btn` |
| Schema diff | `gql-diff-*` | `gql-diff-modal`, `gql-diff-export-json` |
| Workflow import | `gql-wf-import-col-*` | Modal for importing collection items into workflow nodes |

**Selectors to add before Lessons 5–13** (missing from `GQL` today):

| Constant | testid | Needed for |
|---|---|---|
| `AUTH_BADGE_BTN` | `gql-auth-badge-btn` | Lesson 6 |
| `AUTH_BEARER_INPUT` | `gql-auth-bearer-input` | Lesson 6 |
| `AUTH_APIKEY_VAL` | `gql-auth-apikey-val` | Lesson 6 |
| `PROFILE_BADGE` | `gql-profile-badge` | Lesson 6 |
| `ENV_BADGE` | `gql-env-badge` | Lesson 6 |
| `RV_TAB_METADATA` | `gql-rv-tab-metadata` | Lesson 6 ✅ |
| `RV_REQUEST_HEADERS` | `gql-rv-request-headers` | Lesson 6 ✅ |
| `QB_CODE` | `gql-qb-code` | Lessons 7, 9 ✅ |
| `QB_COPY` | `gql-qb-copy` | Lessons 7, 9 ✅ |
| `QB_EDIT` | `gql-qb-edit` | Lessons 7, 9 ✅ |
| `QB_SELECT_ALL` | `gql-qb-select-all` | Lesson 7 ✅ |
| `CHANGELOG_TAB` | `gql-se-tab-changelog` | Lesson 12 ✅ |
| `SCHEMA_CHANGE_TOAST` | `gql-schema-change-toast` | Lesson 12 ✅ |
| `DIFF_EXPORT_JSON` | `gql-diff-export-json` | Lesson 12 ✅ |
| `SAVE_SNAPSHOT_BTN` | `gql-se-save-snapshot` | Lesson 12 ✅ |
| `CHANGELOG_ROW` / `CHANGELOG_DIFF_BTN` | `gql-changelog-row` / `gql-changelog-diff-btn` | Lesson 12 ✅ |
| `DIFF_COUNT_BREAKING` / `DIFF_FILTER_*` | `.gql-diff-count--breaking` / `.gql-diff-filter--*` | Lesson 12 ✅ |

Task **4E-10** tracks adding these before implementing the corresponding lessons.

---

## Phase 5 — Task List

### 4E — Demo Lessons

| # | Task | Priority | Status |
|---|------|----------|--------|
| 4E-1 | Create `src/features/demo-player/lessons/protocols/graphql-lessons.ts` — lesson registry file with all 12 lesson definitions | P1 | 🔨 |
| 4E-2 | Register `graphql` category in `protocolsDomain` lesson catalog (alongside `websocket`, `sse`) | P1 | ✅ |
| 4E-3 | Lesson 1 "Your First GraphQL Query" (7 steps): endpoint input → introspect → observe schema → write query → execute → read response → save to history | P1 | ✅ |
| 4E-4 | Lesson 2 "Variables & Arguments" (8 steps): write parameterized query → open Variables panel → fill `$id` var → execute with value A → re-run with value B → compare results | P1 | ✅ |
| 4E-5 | Lesson 3 "Mutations" (9 steps): createUser → observe response → createOrder (input type) → deleteUser → idempotent re-delete | P1 | ✅ |
| 4E-6 | Lesson 4 "Schema Exploration" (7 steps): browse types → search → field table → Try → insert → SDL tab → export SDL | P1 | ✅ |
| 4E-7 | Lesson 5 "Subscriptions" (10 steps): createOrder → subscribe → live log → pause/filter → assertions → disconnect | P1 | ✅ |
| 4E-8 | Lessons 6–9 (Auth, Query Builder, Collections, Export & Share) — 4 lesson files | P2 | ✅ |
| 4E-9 | Lessons 10–12 (Performance Tracing, Workflow Integration, Schema Diff) — 3 lesson files | P2 | ✅ |
| 4E-9b | Lesson 13 *(optional P2)* "Mock Server" (7 steps) — mock toggle, resolver override, latency | P2 | ✅ |
| 4E-10 | Add missing `GQL.*` selectors listed in audit (auth, builder export, changelog, diff) before Lessons 5–13 | P1 | ✅ |
| 4E-11 | Unit tests for all lesson files: step count, IDs, `estimatedMinutes`, `preAction` guards | P1 | 🔨 |

### 4F — E2E (Phase 5 scope)

| # | Task | Priority | Status |
|---|------|----------|--------|
| 4F-7 | E2E test `e2e/graphql-lessons.spec.ts`: first 3 lessons complete auto-play without errors (smoke test) | P2 | 🔲 |

---

## Phase 5 — Success Criteria

- [x] Demo lesson 1 "Your First GraphQL Query" completes in auto-play mode: all 7 steps execute with visible ripple animations and correct narration
- [x] Demo lessons 1–4 are navigable: Restart → play through each step → `preAction` guards recover state correctly on forward-skip
- [ ] Demo lessons 5–13 are playable: each lesson's steps are navigable, narration is visible, and key interactions complete without error
- [x] `graphql` category appears in the Demo Player protocols domain alongside `kafka`, `websocket`, `sse`
- [ ] Unit tests pass: step count, IDs, `estimatedMinutes`, and `preAction` guard presence for all implemented lessons
- [ ] E2E smoke: first 3 lessons complete auto-play in `e2e/graphql-lessons.spec.ts`
- [x] `npx tsc -b --noEmit` passes with 0 errors after Phase 5 Lessons 1–4 implementation

---

## Quality Gates

Before marking any Phase 5 item done:
- `npx tsc -b --noEmit` passes
- Touched-unit tests pass
- Relevant E2E specs pass (when Docker environment is available)
- Plan row status updated in this file (🔲 → 🔨 → ✅)

---

## Canonical Implementation Map

### Main GraphQL Studio
- `src/features/graphql/GraphqlStudioPage.tsx`
- `src/features/graphql/components/`
- `src/features/graphql/hooks/`
- `src/features/graphql/utils/`

### Demo Lessons (Phase 5)
- `src/features/demo-player/lessons/index.ts` — add `graphql` category to `protocolsDomain`
- `src/features/demo-player/lessons/protocols/graphql-lessons.ts` — lesson registry (11 of 12 implemented)
- `src/features/demo-player/lessons/protocols/graphql-*.test.ts` — per-lesson unit tests (not yet consolidated)
- `src/shared/selectors.ts` — `GQL` namespace (exists; verify completeness)
- Reference pattern: `src/features/demo-player/lessons/protocols/ws-graphql.ts`

### Workflow Integration (Phase 4)
- `src/features/workflow/types/workflow.ts`
- `src/features/workflow/utils/workflowNodeFactory.ts`
- `src/features/workflow/utils/workflowVariableHints.ts`
- `src/features/workflow/utils/countWorkflowDesignerVariables.ts`
- `src/features/workflow/engine/graphRunnerGraphqlNodeHandlers.ts`

### Gallery Templates
- `src/data/galleries/workflows/graphql.ts`

### Server/Proxy Side
- `src-server/routes/graphql/`

### GraphQL E2E
- `e2e/graphql-*.spec.ts`

---

## Notes

- Phase 2 deferred items were re-reviewed and completed on 2026-06-20.
- Fragment panel safety fix applied for partial/legacy state handling in Summary panel.
- `ws-graphql.ts` (WebSocket Studio GraphQL subscription lesson) is in the `websocket` category — it is NOT Phase 5 scope. Phase 5 requires lessons for the dedicated GraphQL Studio tab.
- Completed phases (1–4) per-task detail: `git show 94d99dce:docs/plan/future/graphql/graphql-studio-plan.md`
