# gRPC Studio — Demo Lesson Plan

> **Last updated:** 2026-07-02 (re-evaluated against codebase; Spring Boot extracted to dedicated lesson)
> **Status:** Spec complete — authoring starts at Phase 12H
> **Lessons:** 14 total — 3 shipped (L1–L3 wrappers exist), 11 planned
> **Reference:** [`grpc-studio-plan.md`](grpc-studio-plan.md) Phase 12 · [`demo-player-lessons.mdc`](../../../../.cursor/rules/demo-player-lessons.mdc)

---

## Guiding Principles

### Why these 14 lessons — not 15 separate thin ones

The original Phase 12 roster had 15 lessons mapped one-to-one with product phases (one lesson per streaming type, metadata alone, etc.). The result was too granular — a learner would get three separate lessons for server, client, and bidi streaming instead of one cohesive lesson about **how gRPC streaming works**.

This plan groups features by **learning goal**, not by implementation phase:

| Old roster problem | This plan's fix |
|---|---|
| 3 separate streaming lessons | 1 lesson: all four patterns side-by-side |
| `grpc-metadata` alone too thin | Metadata + Auth combined (natural pairing) |
| Proto form builder never shown | Dedicated lesson on schema-driven editing |
| No transport-mode lesson | Full lesson: proxy vs gRPC-Web vs Spring Servlet |
| Spring Boot buried at #15 | Dedicated lesson (L14) covering `net.devh`, reflection, health, servlet vs Netty |
| Schema diff standalone | Schema diff in its own lesson and referenced in workflow lesson |

### Quality bar

Each lesson must demonstrate a **single powerful capability** a developer will use on day one. Steps must include real visible actions — click, fill, read result — not narration-only steps. All observable outcomes must be verifiable with existing `GRPC.*` selectors.

### Roster ID migration note

The lesson contract in `grpc-lesson-contract/roster.ts` currently registers the old 15-lesson IDs (`grpc-server-reflection`, `grpc-proto-import`, etc.) with shipped wrappers for L1–L3. Before Phase 12H authoring, the roster must be updated to the new 13-lesson IDs below. The three shipped wrappers (`grpc-first-call`, `grpc-server-reflection`, `grpc-proto-import`) will be **consolidated** into the new lesson shells — `grpc-first-call` stays, the other two become `grpc-schema-discovery` (L2) with content from both old wrappers.

---

## Four Learning Tracks

| Track | Lessons | Focus |
|---|---|---|
| **Foundation** | 1–3 | First call, schema, streaming |
| **Configuration** | 4–7 | Auth, TLS, transport, Spring Boot |
| **Productivity** | 8–10 | Proto form, environments, collections |
| **Advanced** | 11–14 | Load test, mock, schema diff, workflow |

---

## Lesson Roster

| # | ID | Title | Track | Duration | Status |
|---|---|---|---|---|---|
| 1 | `grpc-first-call` | Your First gRPC Call | Foundation | ~4 min | ✅ Shipped |
| 2 | `grpc-schema-discovery` | Schema Discovery: Reflection & Proto Import | Foundation | ~5 min | ✅ Shipped |
| 3 | `grpc-streaming` | Streaming RPCs: All Four Patterns | Foundation | ~7 min | ✅ Shipped |
| 4 | `grpc-metadata-auth` | Request Metadata & Authentication | Configuration | ~5 min | 🔲 Planned |
| 5 | `grpc-tls-mtls` | TLS, mTLS & Certificate Configuration | Configuration | ~5 min | 🔲 Planned |
| 6 | `grpc-transport-modes` | Transport Modes: Express, gRPC-Web & Spring Servlet | Configuration | ~5 min | 🔲 Planned |
| 7 | `grpc-spring-boot` | Spring Boot & Spring gRPC Integration | Configuration | ~6 min | 🔲 Planned |
| 8 | `grpc-proto-form` | Proto Form Builder: Schema-Driven Request Editing | Productivity | ~5 min | 🔲 Planned |
| 9 | `grpc-env-collections` | Environments, Collections & History | Productivity | ~6 min | 🔲 Planned |
| 10 | `grpc-grpcurl` | grpcurl Interop, Replay & Sharing | Productivity | ~4 min | 🔲 Planned |
| 11 | `grpc-load-testing` | Load Testing: Concurrent Calls & Metrics | Advanced | ~6 min | 🔲 Planned |
| 12 | `grpc-mock-server` | Mocking gRPC APIs: Rules & Network Listener | Advanced | ~7 min | 🔲 Planned |
| 13 | `grpc-schema-diff` | Proto Schema Diff & Breaking Change Detection | Advanced | ~5 min | 🔲 Planned |
| 14 | `grpc-workflow` | gRPC in Workflows: Nodes, Assertions & Chaining | Advanced | ~7 min | 🔲 Planned |

---

## Docker Fixtures

`docker-compose.yml` currently runs **one gRPC service**:

| Port | Service | Status |
|---|---|---|
| `:50051` | Echo server (`echo.EchoService`) with reflection — exposes `Echo`, `ServerStream`, `ClientStream`, `BidiStream` | ✅ Exists |
| `:50052` | HTTP health endpoint (`/health`) for prerequisite probes | ✅ Exists |

**Proto field reference** (`docker/grpc/proto/echo.proto`):
- `EchoRequest { message: string }`
- `EchoResponse { message: string }`
- `StreamRequest { message: string, repeat_count: int32, interval_ms: int32 }`

The following services must be **added** to the Docker fixture before authoring the indicated lessons:

| Port | Service | Needed for | Notes |
|---|---|---|---|
| `:50443` | TLS echo server (CA-signed cert) | L5 | `docker/grpc/tls/` cert dir needed |
| `:50444` | mTLS echo server (client cert validation) | L5 | — |
| `:50055` | Envoy sidecar with gRPC-Web transcoding for `:50051` | L6 | envoy proxy config file needed |
| `:9090` / `:8080` | Spring Boot gRPC server (Netty/Servlet) | L7 | separate compose profile |
| Schema v2 variant | Echo server with a modified proto (field removed) | L13 | second compose profile or `/admin/swap` endpoint |
| `CreateComplexEcho` method | Echo server with nested/repeated/map/oneof/WKT fields | L8 | add method to `echo.proto` |

Proto files live at `docker/grpc/proto/`, not `docker/grpc/fixtures/`. CA cert material goes in `docker/grpc/certs/`.

---

---

## Lesson 1 — Your First gRPC Call

> **ID:** `grpc-first-call` | **Track:** Foundation | **Duration:** ~4 min | **Status:** ✅ Shipped
> **Wrapper:** `packages/demo-hub/src/lessons/protocols/grpc-first-call.ts`
> **Helpers:** `packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.ts`

**Description:** Set a gRPC target, discover RPCs with server reflection, execute a unary Echo call, inspect the response and trailing metadata, and confirm the invocation in Call History.

**Prerequisites:** None.

**Learning objectives:**
- Understand what a gRPC target looks like (`host:port`, no scheme)
- Use server reflection to populate the Service Explorer without local `.proto` files
- Invoke a unary RPC and read status code, duration, response body, and trailers
- Locate the call in History for replay and troubleshooting

**Key concepts:**
| Term | Definition |
|---|---|
| Unary RPC | Single request → single response. The simplest gRPC pattern, analogous to a function call over the network. |
| Server reflection | A built-in gRPC API that returns the server's proto descriptors at runtime — no local `.proto` files needed. |
| Status code | Every gRPC response carries a status (OK, NOT_FOUND, INTERNAL, etc.) in the trailer, not the HTTP status line. |
| Trailers | HTTP/2 trailing metadata sent after the response body — the only place gRPC terminal status lives. |
| Session settings | The gear button (`GRPC.CONNECTION_SETTINGS_BTN`) opens per-tab gRPC session settings (TLS, auth, call options, transport) without leaving Studio. |

**Concept panel (shipped):** The lesson concept card contains an SVG architecture diagram illustrating the 5-step flow: Set target → Reflect → Open Echo → Send call → Inspect + History.

**Steps (8):**

1. **Intro: gRPC Studio** — Orient the learner to the three main areas: connection bar (`GRPC.CONNECTION_BAR`), Service Explorer, and the request/response workspace. Step id: `grpc1-intro`. The lesson also calls `navigateToGrpcStudio` and `closeGrpcSettingsDrawerQuiet` here.

2. **Set the target** — Fill `localhost:50051` into the target field (`GRPC.TARGET_INPUT`). Watch the `GRPC.TARGET_STATUS_OK` badge appear. Step id: `grpc1-target`. **Verify:** `GRPC.TARGET_STATUS_OK`.

3. **Reflect** — Click **Reflect** (`GRPC.REFLECT_BTN`). Watch the Service Explorer (`GRPC.SERVICE_EXPLORER`) populate with `echo.EchoService` and its four methods. Step id: `grpc1-reflect`. **Verify:** `GRPC.EXPLORER_TREE` (not `EXPLORER_SOURCE`/`TOTAL` — those are informational only). Note: before Reflect fires, `normalizeGrpcConnectionForReflection` quietly resets auth to `none` and TLS to `disabled` so the lesson fixture doesn't fail due to stale session settings.

4. **Select Echo** — Expand `echo.EchoService` (`GRPC.SERVICE('echo.EchoService')`) and click **Echo** (`GRPC.METHOD('echo.EchoService', 'Echo')`) — unary, badge **U**. The Call Panel opens with a schema-driven form. Step id: `grpc1-select-method`. **Verify:** `GRPC.PROTO_FORM`.

5. **Fill the request** — Type `Hello from gRPC Studio` (`GRPC_DEMO_MESSAGE` constant) into the `message` field (`GRPC.PROTO_FIELD_INPUT_MESSAGE`). `GRPC.PROTO_FIELD_INPUT(fieldName)` is the generic pattern for any proto field. Step id: `grpc1-fill-message`.

6. **Send** — Click **Send** (`GRPC.SEND_BTN`). RedfireForge routes through the Express gRPC proxy (port 3001) to the Docker echo server on port 50051. Step id: `grpc1-send`. **Verify:** `GRPC.RESPONSE_BODY` (the body is present in DOM once the response arrives — this is what the implementation checks, not `RESPONSE_STATUS`).

7. **Read the response** — The implementation highlights `GRPC.RESPONSE_PANEL` and directs the learner to inspect visually — it does **not** programmatically click individual tabs. Point out: status **OK** (`GRPC.RESPONSE_STATUS`), duration (`GRPC.RESPONSE_DURATION`), response size (`GRPC.RESPONSE_SIZE`), echoed body in the **Body** tab (`GRPC.RESPONSE_TAB_BODY`). Instruct learner to click **Trailers** (`GRPC.RESPONSE_TAB_TRAILERS`) to see `grpc-status: 0`. Briefly note the other tabs: **Headers** (`GRPC.RESPONSE_TAB_HEADERS`), **Metadata**, **Timing**, **Tracing**, and the **Proto** top-tab (`GRPC.RESPONSE_TOP_TAB_PROTO`). Step id: `grpc1-response`.

8. **History** — Click **History** sub-nav (`GRPC.SUB_NAV_HISTORY`). Wait for `GRPC.HISTORY_PANEL`, then `GRPC.HISTORY_LIST`. Show the auto-logged row (target, service, method, status). Explain replay (`GRPC.HISTORY_REPLAY_BTN`) and grpcurl copy (`GRPC.HISTORY_COPY_GRPCURL`). Step id: `grpc1-history`. **Verify:** `GRPC.HISTORY_LIST`.

**Verify (lesson-level):** `GRPC.HISTORY_LIST` has at least one row. The `grpc1-send` step verifies `GRPC.RESPONSE_BODY`.

**Implementation notes:**
- **Session run flags:** The helpers use `grpcLessonSession` flags (`targetSet`, `reflected`, `methodSelected`, `messageFilled`, `executed`) tracked via `setGrpcLessonRunFlag` / `getGrpcLessonRunFlags`. Each `preAction` checks these flags so steps are idempotent — re-entering a step won't re-execute side effects if the flag is already set.
- **`closeGrpcSettingsDrawerQuiet`:** Every `preAction` calls this to dismiss any stale Connection Settings drawer before the step renders. Do not remove it when authoring future lessons.
- **`ensureGrpcStudioSubNavQuiet`:** Ensures the main Studio sub-nav (not Collections / History) is active before each step.
- **`normalizeGrpcConnectionForReflection`:** Called inside `ensureGrpcReflected`. Opens Settings, sets auth → `none` and TLS → `disabled`, then closes. Guards against leftover session config blocking reflection.
- **`GRPC_DEMO_TARGET`** = `'localhost:50051'` · **`GRPC_DEMO_MESSAGE`** = `'Hello from gRPC Studio'` — both defined in helpers.
- Response panel also supports: raw toggle (`GRPC.RESPONSE_RAW_TOGGLE`), copy response (`GRPC.RESPONSE_COPY`), in-flight state (`GRPC.RESPONSE_IN_FLIGHT`), cancelled state (`GRPC.RESPONSE_CANCELLED`).
- Latency footer (`GRPC.RESPONSE_LATENCY_FOOTER`) shows min/avg/p95/max after multiple calls to the same method — informational only in L1, featured in L11.
- Selectors used: `GRPC.CONNECTION_BAR`, `GRPC.CONNECTION_SETTINGS_BTN`, `GRPC.TARGET_INPUT`, `GRPC.TARGET_STATUS_OK`, `GRPC.REFLECT_BTN`, `GRPC.SERVICE_EXPLORER`, `GRPC.EXPLORER_TREE`, `GRPC.SERVICE('echo.EchoService')`, `GRPC.METHOD('echo.EchoService','Echo')`, `GRPC.PROTO_FORM`, `GRPC.PROTO_FIELD_INPUT_MESSAGE`, `GRPC.SEND_BTN`, `GRPC.RESPONSE_PANEL`, `GRPC.RESPONSE_BODY`, `GRPC.RESPONSE_STATUS`, `GRPC.RESPONSE_DURATION`, `GRPC.RESPONSE_SIZE`, `GRPC.RESPONSE_TAB_BODY`, `GRPC.RESPONSE_TAB_TRAILERS`, `GRPC.RESPONSE_TAB_HEADERS`, `GRPC.RESPONSE_TOP_TAB_PROTO`, `GRPC.SUB_NAV_HISTORY`, `GRPC.HISTORY_PANEL`, `GRPC.HISTORY_LIST`, `GRPC.HISTORY_REPLAY_BTN`, `GRPC.HISTORY_COPY_GRPCURL`, `GRPC.SUB_NAV_STUDIO`, `GRPC.SETTINGS_DRAWER`, `GRPC.SETTINGS_CLOSE`

---

---

## Lesson 2 — Schema Discovery: Reflection & Proto Import

> **ID:** `grpc-schema-discovery` | **Track:** Foundation | **Duration:** ~5 min | **Status:** 🔨 Shipped (roster entry #16)
> **Wrapper:** `packages/demo-hub/src/lessons/protocols/grpc-schema-discovery.ts`
> **Helpers:** `packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.ts`
> **Consolidates:** old GRPC-2 (`grpc-server-reflection`) + GRPC-3 (`grpc-proto-import`) — both old wrappers remain live until Phase 12H roster migration

**Description:** Learn the five ways to load proto schemas into gRPC Studio — server reflection, `.proto` file upload, `.protoset` binary, URL descriptor, and BSR. Use the Schema Browser to explore message types, copy grpcurl commands, and open methods directly into the call panel. Understand schema drift and how Studio surfaces it.

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Understand the descriptor source priority: Reflection → Proto → Protoset → URL → BSR
- Use server reflection to populate the Service Explorer without local `.proto` files
- Open Manage Schemas and understand all five ingest source tabs
- Run a complete Proto Files workflow: upload two files, add import root, and load descriptors
- Use the Schema Browser to explore types, copy grpcurl, and open a method in the call panel
- Recognise schema drift and understand how Studio's drift banner guides remediation

**Key concepts:**
| Term | Definition |
|---|---|
| Descriptor source | Where gRPC Studio gets proto type information — reflection, local file, binary protoset, URL, or BSR. |
| Server reflection | A built-in gRPC API that returns the server's proto descriptors at runtime — no local `.proto` files needed. |
| Import path | A search directory used to resolve relative imports across multi-file protobuf packages. |
| Protoset | A pre-compiled binary bundle (`.pb`) containing all proto descriptors — useful for CI / offline environments. |
| Schema Browser | A navigable tree of all services, messages, and enum types in the loaded descriptor. |
| Schema drift | When the descriptors on file no longer match the running server's reflection — Studio surfaces a banner. |

**Sample pack used in this lesson:**
- **Proto Files:** `examples/grpc/schema-discovery/proto-files/api/service.proto` + `examples/grpc/schema-discovery/proto-files/shared/common.proto`
- **Import root:** `shared`
- **Protoset:** `examples/grpc/schema-discovery/protoset/echo.protoset`
- **URL:** `http://localhost:5173/grpc-samples/url/echo.proto` (works in local dev because server-side proto fetch allows `http://localhost`)
- **BSR:** `buf.build/connectrpc/eliza` @ `main` (requires internet / public module availability)

**Steps (12):**

1. **Intro: Descriptor sources** — `grpc16-intro`. Orient to the Service Explorer in its "no descriptor" state. Explain why five sources exist — reflection is convenient in dev/staging but production environments often disable it. Highlight `GRPC.CONNECTION_BAR`.

2. **Set target** — `grpc16-target`. Fill `localhost:50051` (`GRPC.TARGET_INPUT`) and verify `GRPC.TARGET_STATUS_OK`.

3. **Reflect** — `grpc16-reflect`. Click **Reflect** (`GRPC.REFLECT_BTN`). Service Explorer populates. **Verify:** `GRPC.EXPLORER_TREE`.

4. **Confirm reflection source badge** — `grpc16-source`. Highlight `GRPC.EXPLORER_SOURCE` — it shows **Reflection**, confirming the tree is driven by runtime descriptor exchange. Use Explorer search (`GRPC.EXPLORER_SEARCH`) to filter to "Echo" then clear it, demonstrating how to navigate large service catalogs. **Verify:** `GRPC.EXPLORER_SOURCE`.

5. **Open Manage Schemas** — `grpc16-manage-open`. Click `GRPC.MANAGE_SCHEMAS_BTN` to open the Manage Schemas modal (`GRPC.PROTO_MANAGE_MODAL`). Show the five tabs: **Proto Files** (`GRPC.PROTO_TAB_PROTO_FILES`), **Protoset** (`GRPC.PROTO_TAB_PROTOSET`), **URL** (`GRPC.PROTO_TAB_URL`), **BSR** (`GRPC.PROTO_TAB_BSR`), **Schema Browser** (`GRPC.PROTO_TAB_SCHEMA_BROWSER`). Note: there is no separate Reflection tab — reflection is triggered by the **Reflect** button in the main explorer. **Verify:** `GRPC.PROTO_MANAGE_MODAL`.

6. **Quick orientation: source tabs** — `grpc16-tabs`. Switch across the four file-based tabs and show one concrete example per tab:
   Proto Files → `examples/grpc/schema-discovery/proto-files/api/service.proto` + `examples/grpc/schema-discovery/proto-files/shared/common.proto`
   Protoset (`GRPC.PROTO_PROTOSET_ZONE`) → `examples/grpc/schema-discovery/protoset/echo.protoset`
   URL (`GRPC.PROTO_URL_INPUT`) → `http://localhost:5173/grpc-samples/url/echo.proto`
   BSR (`GRPC.PROTO_BSR_MODULE_INPUT`) → `buf.build/connectrpc/eliza` + version `main`
   Explain use cases: Proto Files for local repos, Protoset for CI bundles, URL for hosted descriptors, BSR for module-based contract distribution. Note that the BSR example depends on internet access. This is an orientation pass; the next three steps are a full Proto Files walkthrough. **Verify:** `GRPC.PROTO_UPLOAD_ZONE`.

7. **Proto Files: upload two files** — `grpc16-proto-files`. Stay on **Proto Files** and add both files into `GRPC.PROTO_UPLOAD_ZONE`:
   1) `examples/grpc/schema-discovery/proto-files/shared/common.proto`
   2) `examples/grpc/schema-discovery/proto-files/api/service.proto`
   Use drag-and-drop or click-to-browse with multi-select. Confirm both filenames appear in the file list. **Verify:** `GRPC.PROTO_UPLOAD_ZONE`.

8. **Proto Files: select root + review canonical paths** — `grpc16-select-root`. Click a root from the left virtual root list and confirm the right panel switches to that root. Review `GRPC.PROTO_CANONICAL_PREVIEW` to validate normalized paths before loading. **Verify:** `GRPC.PROTO_CANONICAL_PREVIEW`.

9. **Proto Files: load schema** — `grpc16-proto-load`. Click `GRPC.PROTO_LOAD_BTN` to parse uploaded files + import roots into an active descriptor source. Expected: no error, and Schema Browser can navigate the loaded service. If load fails, correct file set/import roots and retry. **Verify:** `GRPC.PROTO_LOAD_BTN`.

10. **Use loaded schema in Schema Browser** — `grpc16-schema-browser`. Switch to the **Schema Browser** tab (`GRPC.PROTO_TAB_SCHEMA_BROWSER`). Wait for `GRPC.SCHEMA_BROWSER` and `GRPC.SCHEMA_BROWSER_TREE`. If Proto Files load succeeded, browse the loaded Echo service. For the automated lesson path, reflected Echo remains as fallback so the tree is deterministic. Use search (`GRPC.SCHEMA_BROWSER_SEARCH`) to locate `Echo`. Expand `echo.EchoService` → `Echo` to show the `message: string` field in the detail panel (`GRPC.SCHEMA_BROWSER_DETAIL`). **Verify:** `GRPC.SCHEMA_BROWSER`.

11. **Copy grpcurl and Open in tab** — `grpc16-open-method`. With the Echo node selected in Schema Browser, click **Copy grpcurl** (`GRPC.SCHEMA_COPY_GRPCURL_BTN`). Note: grpcurl copy lives in the Schema Browser, not on the Service Explorer tree. Then click **Open in tab** (`GRPC.SCHEMA_OPEN_TAB_BTN`) to bind Echo into the call panel. The modal closes and the call panel opens with Echo pre-selected and the schema-driven form ready. The concrete sample pack is for the four ingest tabs; the scripted verify path still uses reflected Echo. **Verify:** `GRPC.PROTO_FORM`.

12. **Schema drift awareness** — `grpc16-drift`. Close the modal and return to the main Studio view. Explain schema drift: when a running server's reflection changes after Studio has already cached descriptors, Studio surfaces a `GRPC.SCHEMA_DRIFT_BANNER` showing which services are affected. The banner offers per-service rebind (`GRPC.SCHEMA_DRIFT_REBIND(service, method)`) and a **Dismiss** button (`GRPC.SCHEMA_DRIFT_DISMISS_BTN`). ⚠️ **Deferred:** Active drift simulation requires a second Docker compose profile with a modified proto — this fixture does not exist yet. This step is informational only (banner is shown conceptually; no programmatic drift trigger). **Highlight:** `GRPC.PROTO_FORM`.

**Verify (lesson-level):** `GRPC.PROTO_FORM` is present after step 9; `GRPC.SCHEMA_BROWSER` renders in step 7.

**Implementation notes:**
- **Local helpers:** `ensureManageModalOpen` and `ensureManageModalClosed` are defined locally in the wrapper (same pattern as `grpc-proto-import.ts`) — not exported from the shared helpers file.
- **Session flags:** `ensureGrpcReflected` (from helpers) handles `grpcLessonSession.reflected` idempotency. `ensureGrpcTarget` handles `targetSet` flag.
- **Roster entry:** Added as `grpc-schema-discovery` number 16 in `roster.ts`. The old entries (#2 `grpc-server-reflection` and #3 `grpc-proto-import`) remain untouched until Phase 12H migration.
- **Sample assets shipped with this lesson:** `examples/grpc/schema-discovery/proto-files/api/service.proto`, `examples/grpc/schema-discovery/proto-files/shared/common.proto`, `examples/grpc/schema-discovery/protoset/echo.protoset`, and `public/grpc-samples/url/echo.proto`.
- **BSR example:** `buf.build/connectrpc/eliza` @ `main` is included as a concrete public-module example, but it still depends on external network access and public BSR availability.
- **Post-load demo flow:** After successful Proto Files, Protoset, or BSR loads, the lesson now advances into the **Schema Browser** tab so the loaded schema is visible instead of leaving the user parked on the ingest tab.
- **`GRPC.PROTO_EXPORT_PROTOSET`** — **NOT in `GRPC.*` selectors object** (no `grpc-proto-export-protoset` data-testid in the selectors file). Remove from step descriptions until it is added to `grpc.ts`.
- **Drift simulation (step 10):** Deferred — requires Docker compose profile v2 with a modified `echo.proto`. Once built, this step can become interactive: trigger drift → show banner → click Dismiss.
- **`GRPC.SCHEMA_TREE_NODE('method', 'echo.EchoService', 'Echo')`** — dynamic selector used in step 8/9 to click the Echo node. The same pattern as `grpc-proto-import.ts`.
- **Old wrappers:** `grpc-server-reflection.ts` and `grpc-proto-import.ts` remain shipped and registered. `grpc-schema-discovery.ts` coexists as the consolidated Phase 12H preview lesson.
- **Selectors used:** `GRPC.CONNECTION_BAR`, `GRPC.TARGET_INPUT`, `GRPC.TARGET_STATUS_OK`, `GRPC.REFLECT_BTN`, `GRPC.EXPLORER_TREE`, `GRPC.EXPLORER_SOURCE`, `GRPC.EXPLORER_SEARCH`, `GRPC.MANAGE_SCHEMAS_BTN`, `GRPC.PROTO_MANAGE_MODAL`, `GRPC.PROTO_TAB_PROTO_FILES`, `GRPC.PROTO_TAB_PROTOSET`, `GRPC.PROTO_TAB_URL`, `GRPC.PROTO_TAB_BSR`, `GRPC.PROTO_TAB_SCHEMA_BROWSER`, `GRPC.PROTO_UPLOAD_ZONE`, `GRPC.PROTO_PROTOSET_ZONE`, `GRPC.PROTO_URL_INPUT`, `GRPC.PROTO_BSR_MODULE_INPUT`, `GRPC.PROTO_LOAD_ERROR`, `GRPC.PROTO_CANCEL_BTN`, `GRPC.PROTO_ROOT_LIST`, `GRPC.PROTO_CANONICAL_PREVIEW`, `GRPC.SCHEMA_BROWSER`, `GRPC.SCHEMA_BROWSER_TREE`, `GRPC.SCHEMA_BROWSER_SEARCH`, `GRPC.SCHEMA_BROWSER_DETAIL`, `GRPC.SCHEMA_TREE_NODE('method', 'echo.EchoService', 'Echo')`, `GRPC.SCHEMA_COPY_GRPCURL_BTN`, `GRPC.SCHEMA_OPEN_TAB_BTN`, `GRPC.SCHEMA_DRIFT_BANNER`, `GRPC.SCHEMA_DRIFT_REBIND(service, method)`, `GRPC.SCHEMA_DRIFT_DISMISS_BTN`, `GRPC.PROTO_FORM`

---

---

## Lesson 3 — Streaming RPCs: All Four Patterns

> **ID:** `grpc-streaming` | **Track:** Foundation | **Duration:** ~7 min | **Status:** ✅ Shipped
> **Wrapper:** `packages/demo-hub/src/lessons/protocols/grpc-streaming.ts`
> **Helpers:** `packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.ts`

**Description:** Walk through all four gRPC streaming patterns: server streaming (read a live feed), client streaming (upload a batch), and bidirectional streaming (interactive exchange). Understand the message log, stream controls, and stream status lifecycle.

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Recognise the four call-type badges (U / SS / CS / BD) and when to use each pattern
- Start and read a server-streaming RPC with `repeat_count` to control message volume
- Queue and flush messages in a client-streaming RPC and read the aggregated response
- Participate in a bidirectional stream: send and receive messages interleaved
- Cancel a stream mid-flight and understand how cancellation propagates

**Key concepts:**
| Term | Definition |
|---|---|
| Server streaming | Server sends many messages after one client request — ideal for feeds, large dataset reads, progress updates. |
| Client streaming | Client sends many messages; server responds once — ideal for batch uploads or aggregation. |
| Bidirectional streaming | Both sides send independently over a single HTTP/2 stream — real-time chat or collaborative edit patterns. |
| Message log | The live pane showing every message in both directions with direction arrows (↓ server, ↑ client). |
| Stream status | OPEN → HALF-CLOSED → FINISHED / CANCELLED / ERROR — shown in the stream status bar. |

**Steps (11):**

1. **Intro: Call type selector** — Highlight the call-type selector row (`GRPC.CALL_TYPE_SELECTOR`). Explain that `echo.EchoService` exposes all four patterns. The badge letters: **U** = unary, **SS** = server streaming, **CS** = client streaming, **BD** = bidirectional.

2. **Server streaming: select method** — Click `echo.EchoService / ServerStream` in the explorer (`GRPC.METHOD('echo.EchoService', 'ServerStream')`). The Call Panel switches to the server-streaming layout.

3. **Server streaming: fill and start** — Fill `repeat_count: 5` and `message: "stream-demo"` in the form. Click **Start** (`GRPC.STREAM_START_BTN`). Watch five messages arrive in the message log (`GRPC.STREAM_MESSAGE_LOG`), each with a ↓ arrow.

4. **Server streaming: status** — Highlight the stream status bar (`GRPC.STREAM_STATUS_BAR`): status transitions OPEN → FINISHED. Show inbound count (5) and elapsed time.

5. **Client streaming: select method** — Click `echo.EchoService / ClientStream`. Explain the pending queue — messages are staged before the server sees them.

6. **Client streaming: queue messages** — Click **Add to queue** (`GRPC.STREAM_ADD_QUEUE_BTN`) three times, filling a different `message` value each time. Messages appear in the pending queue panel (`GRPC.STREAM_PENDING_PANEL`) with a count chip (`GRPC.STREAM_PENDING_COUNT`). Individual items can be inspected via `GRPC.STREAM_PENDING_ITEM(index)` and removed via `GRPC.STREAM_PENDING_REMOVE(index)`.

7. **Client streaming: start, send all, end** — First click **Start** (`GRPC.STREAM_START_BTN`) to open the stream. The pending queue panel's **Send all** button becomes enabled once the stream is active. Click **▶ Send all** (`GRPC.STREAM_SEND_ALL_BTN`) to flush all queued messages through the open stream. Then click **End** (`GRPC.STREAM_PENDING_END_BTN`) to signal the client is done sending. The server echoes back one aggregated response after the client-side write end. Note: the `Send all` button (`canSendAll`) requires `streamActive === true` — clicking **Start** is a prerequisite. **End** (`GRPC.STREAM_PENDING_END_BTN`) and **End stream** (`GRPC.STREAM_END_BTN`) are distinct selectors — `STREAM_PENDING_END_BTN` is in the pending queue panel, `STREAM_END_BTN` is in the compose panel (bidi streaming).

8. **Bidi streaming: select method** — Click `echo.EchoService / BidiStream`. Layout shows the compose panel and live message log.

9. **Bidi: interactive exchange** — Click **Start** (`GRPC.STREAM_START_BTN`), fill `message: "hello"`, click **Send** (`GRPC.STREAM_SEND_MESSAGE_BTN`). The server echoes it back. Send a second message. Show the interleaved ↑↓ arrows in the log.

10. **Cancel mid-stream** — Click **Cancel** (`GRPC.STREAM_CANCEL_BTN`) while the bidi stream is open. Status changes to CANCELLED. Explain that gRPC cancellation sends RST_STREAM to the server.

11. **Export log** — Click the **Export log** button (`GRPC.STREAM_EXPORT_LOG_BTN`) to download a JSON transcript of the stream session.

**Verify:** `GRPC.STREAM_STATUS_BAR` shows FINISHED after server stream ends; `GRPC.STREAM_LOG_LIST` has rows after bidi exchange.

**Implementation notes:**
- Echo server already exposes all four methods — `StreamRequest { message: string, repeat_count: int32, interval_ms: int32 }`
- `GRPC.STREAM_START_BTN` and `GRPC.STREAM_CANCEL_BTN` are **the same button** with different `data-testid` depending on `streamActive` — `grpc-stream-start-btn` before stream, `grpc-stream-cancel-btn` during stream.
- Client streaming queue: `canSendAll` requires `streamActive === true`, so **Start must be clicked before Send all**. Step 7 covers Start → Send all → End.
- `GRPC.STREAM_PENDING_END_BTN` (in `GrpcStreamPendingQueuePanel`) vs `GRPC.STREAM_END_BTN` (in `GrpcStreamComposePanel` bidi only) — distinct buttons.
- `GRPC.STREAM_SEND_MESSAGE_BTN` is the bidi compose panel send button. Client streaming uses `GRPC.STREAM_SEND_NOW_BTN` for immediate inline send (not used in this lesson).
- Session flags: Use local flags in the lesson wrapper (not `grpcLessonSession.*`) since the global flags only track unary state.
- Step IDs use `grpc3-*` prefix. Roster entry number 17 with `id: 'grpc-streaming'`.
- Selectors used: `GRPC.CALL_TYPE_SELECTOR`, `GRPC.METHOD('echo.EchoService','ServerStream')`, `GRPC.METHOD('echo.EchoService','ClientStream')`, `GRPC.METHOD('echo.EchoService','BidiStream')`, `GRPC.PROTO_FIELD_INPUT('message')`, `GRPC.PROTO_FIELD_INPUT('repeat_count')`, `GRPC.PROTO_FIELD_INPUT('interval_ms')`, `GRPC.STREAM_START_BTN`, `GRPC.STREAM_CANCEL_BTN`, `GRPC.STREAM_MESSAGE_LOG`, `GRPC.STREAM_LOG_LIST`, `GRPC.STREAM_STATUS_BAR`, `GRPC.STREAM_STATUS_BADGE`, `GRPC.STREAM_INBOUND_COUNT`, `GRPC.STREAM_ADD_QUEUE_BTN`, `GRPC.STREAM_PENDING_PANEL`, `GRPC.STREAM_PENDING_COUNT`, `GRPC.STREAM_PENDING_ITEM(0)`, `GRPC.STREAM_SEND_ALL_BTN`, `GRPC.STREAM_PENDING_END_BTN`, `GRPC.STREAM_SEND_MESSAGE_BTN`, `GRPC.STREAM_EXPORT_LOG_BTN`

---

---

## Lesson 4 — Request Metadata & Authentication

> **ID:** `grpc-metadata-auth` | **Track:** Configuration | **Duration:** ~5 min | **Status:** 🔲 Planned

**Description:** Add custom request metadata headers, configure bearer token auth, try basic auth and API key modes, understand how RedfireForge detects conflicts between manual metadata and structured auth, and use environment variables in metadata values.

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Add and edit gRPC request metadata (key-value pairs sent as HTTP/2 headers)
- Configure bearer, basic, and API key auth without editing raw metadata
- Understand that auth config takes precedence over manual `authorization` metadata
- Preview how metadata is resolved when environment variables are used in values

**Key concepts:**
| Term | Definition |
|---|---|
| Request metadata | Key-value pairs sent as HTTP/2 headers alongside the RPC — gRPC's equivalent of HTTP request headers. |
| Auth precedence | When Auth Panel has a type other than `none`, it generates the `authorization` header. Manual metadata with the same key is flagged as a conflict. |
| OAuth2 | Client-credentials flow: RedfireForge fetches a token from the token URL server-side before each call. The raw secret never reaches the browser. |

**Steps (9):**

1. **Intro: Connection Settings drawer** — Click the **gear icon** (`GRPC.CONNECTION_SETTINGS_BTN`) to open the Connection Settings drawer (`GRPC.SETTINGS_DRAWER`). The drawer has seven panels across three groups:
   - **Connection:** TLS / mTLS (`GRPC.SETTINGS_NAV_ITEM('tls')`), Authentication (`GRPC.SETTINGS_NAV_ITEM('auth')`)
   - **Call config:** Call settings (`GRPC.SETTINGS_NAV_ITEM('call')`), Compression (`GRPC.SETTINGS_NAV_ITEM('compression')`)
   - **Advanced:** Health check (`GRPC.SETTINGS_NAV_ITEM('health')`), K8s port-forward (`GRPC.SETTINGS_NAV_ITEM('k8s')`), Transport (`GRPC.SETTINGS_NAV_ITEM('transport')`)

2. **Metadata editor** — In the Call Panel, click the **Metadata** tab (`GRPC.REQUEST_TAB_METADATA`). Add a custom key-value: `x-request-id: lesson-4-demo`. This goes as an HTTP/2 header alongside the RPC.

3. **Send with metadata** — Click **Send** (`GRPC.SEND_BTN`). Inspect the response — verify the call succeeded. (If the echo server reflects request metadata, it can appear in the response body.)

4. **Bearer auth** — In Settings → **Authentication** (`GRPC.SETTINGS_NAV_ITEM('auth')`), select the **Bearer** pill (`GRPC.AUTH_TYPE_PILL('bearer')`). Fill a demo token value. Close the drawer and click **Send** again.

5. **Basic auth** — Switch to the **Basic** pill. Fill username `demo` and password `secret`.

6. **API Key auth** — Switch to the **API Key** pill. Fill key name `x-api-key` and value `my-key-123`. Note the custom metadata header that will be added.

7. **Conflict detection** — While API Key auth is active, manually add `x-api-key` in the Metadata tab with a different value. Show the **conflict indicator** (`GRPC.AUTH_CONFLICTS`) that warns the auth panel owns this key. Show the auth preview (`GRPC.AUTH_PREVIEW`) that displays the merged metadata output.

8. **OAuth2** — Switch to the **OAuth2** pill (`GRPC.AUTH_TYPE_PILL('oauth2')`). Fill token URL, client ID, and client secret fields. Explain that the server side fetches the token before each call — the raw credentials are held in the session secret vault.

9. **Env-var in metadata** — Add `x-env-token: {{authToken}}` in the Metadata editor. Show the interpolation preview strip (`GRPC.INTERPOLATION_PREVIEW_STRIP`) resolving the variable from the active environment. If the variable is unresolved, the `GRPC.INTERPOLATION_ERROR_BANNER` appears with the missing token path (`GRPC.INTERPOLATION_ERROR_TOKEN_PATH`).

**Verify:** `GRPC.AUTH_TYPE_PILL('bearer')` has active state; `GRPC.AUTH_CONFLICTS` appears when a conflicting metadata key is added.

**Implementation notes:**
- Selectors to use: `GRPC.CONNECTION_SETTINGS_BTN`, `GRPC.SETTINGS_NAV_ITEM('auth')`, `GRPC.SETTINGS_PANEL('auth')`, `GRPC.AUTH_PANEL`, `GRPC.AUTH_TYPE_PILLS`, `GRPC.AUTH_TYPE_PILL(type)`, `GRPC.AUTH_CONFLICTS`, `GRPC.AUTH_PREVIEW`, `GRPC.REQUEST_TAB_METADATA`, `GRPC.METADATA_EDITOR`, `GRPC.INTERPOLATION_PREVIEW_STRIP`
- `grpc-metadata-add-btn` (KeyValueEditor add row) is not exported in `GRPC.*` — add `GRPC.METADATA_ADD_BTN` to `src/shared/selectors/grpc.ts` before authoring
- Also available: `GRPC.AUTH_ISSUES` for validation issues on auth config, `GRPC.AUTH_PREVIEW` for the merged metadata preview

---

---

## Lesson 5 — TLS, mTLS & Certificate Configuration

> **ID:** `grpc-tls-mtls` | **Track:** Configuration | **Duration:** ~5 min | **Status:** 🔲 Planned
> **Docker requirement:** TLS and mTLS echo servers on `:50443` / `:50444` must be added to the fixture

**Description:** Connect to a TLS-protected gRPC server, paste a CA certificate to validate server identity, configure mutual TLS with a client certificate and private key, and run the TLS connection test to verify the handshake before executing a call.

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Understand the three TLS modes: Plaintext, TLS, mTLS
- Paste PEM-encoded CA cert, client cert, and private key into the secret fields
- Use the server name override field for CN/SAN hostname mismatches
- Run the TLS connection test to verify a secure connection before sending a call

**Key concepts:**
| Term | Definition |
|---|---|
| TLS (Transport Layer Security) | Encrypts the gRPC channel. Requires the server's certificate to be trusted by the client's CA. |
| Mutual TLS (mTLS) | Both client and server present certificates — the server verifies the client's identity in addition to the usual server-side TLS. |
| CA Certificate | The Certificate Authority cert used to validate the server's identity. |
| Server name override | Used when the server certificate CN/SAN does not match the target hostname (e.g. `localhost` vs `127.0.0.1`). |
| Secret vault | PEM content is held in an in-session secret vault — never written to localStorage or included in collection/history exports. |

**Steps (9):**

1. **Intro: TLS panel** — Click **gear icon** → navigate to **TLS / mTLS** (`GRPC.SETTINGS_NAV_ITEM('tls')`). Show the three mode buttons. Note the labels: **Plaintext** (no encryption), **TLS**, **mTLS**.

2. **Observe plaintext failure** — Change target to `localhost:50443` (TLS-only server). Click **Send**. The call fails with a TLS handshake error — the server requires encryption but the mode is still Plaintext.

3. **Switch to TLS mode** — Click the **TLS** button (`GRPC.TLS_MODE('tls')`). New fields appear: CA certificate and server name override.

4. **Paste CA cert** — Paste the contents of `docker/grpc/certs/ca.pem` into the CA Certificate secret field (`GRPC.TLS_PANEL`). The field is masked and stored in the session vault.

5. **Test TLS connection** — Click **Test TLS Connection** (`GRPC.TLS_MODAL_TEST`). A local validation check runs; `grpc-tls-test-result` shows the result. The TLS badge (`GRPC.TLS_BADGE`) in the connection bar updates.

6. **Send over TLS** — Close the drawer. Click **Send** on a unary Echo. The call succeeds. Show the TLS badge active in the connection bar.

7. **Server name override** — Change target to `127.0.0.1:50443` (IP — cert CN is `localhost`). The TLS test fails with an x509 hostname mismatch. Add `localhost` to the **Server Name Override** field. Test again — succeeds.

8. **mTLS** — Switch to **mTLS** mode (`GRPC.TLS_MODE('mtls')`). Two additional secret fields appear: Client Certificate and Client Key. Paste `client.pem` and `client-key.pem` from the fixture certs directory. Run the TLS test — both certificates are validated.

9. **Secret vault reminder** — Point out the lock icon on cert fields: the PEM content stays in the in-session vault and is stripped from all collection exports, history records, and grpcurl output.

**Verify:** `GRPC.TLS_BADGE` is active in connection bar; Echo call returns OK over TLS.

**Implementation notes:**
- PEM input is via `GrpcSecretField` (paste, not file-picker) — there are no "Upload" buttons for certs
- TLS test (`GRPC.TLS_MODAL_TEST`) performs local credential validation, not a live handshake probe
- TLS test result shown in `grpc-tls-test-result` — add `GRPC.TLS_TEST_RESULT` to selectors
- Docker TLS servers (`:50443`, `:50444`) and cert material in `docker/grpc/certs/` must be created before this lesson can be authored

---

---

## Lesson 6 — Transport Modes: Express, gRPC-Web & the Browser Proxy Model

> **ID:** `grpc-transport-modes` | **Track:** Configuration | **Duration:** ~5 min | **Status:** 🔲 Planned
> **Docker requirement:** Envoy sidecar on `:50055` must be added to the fixture

**Description:** Understand why gRPC requires a proxy in browsers and how RedfireForge's transport modes serve different deployment scenarios. Switch between Express proxy, gRPC-Web browser-direct, and Spring Servlet. Observe the Express fallback retry when browser-direct fails. Spring Boot-specific configuration is covered in depth in Lesson 7.

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Explain why browsers cannot call gRPC services directly without a proxy or grpc-web adapter
- Switch to gRPC-Web browser-direct mode for envoy-fronted services
- Recognise the retry-with-Express offer when browser-direct transport fails
- Enable gzip compression on a per-tab basis
- Understand that transport is per-tab and independent across Studio sessions

**Key concepts:**
| Term | Definition |
|---|---|
| Express proxy | Default transport: RedfireForge's Node server acts as a gRPC proxy via `@grpc/grpc-js`. Works with all servers. |
| gRPC-Web | A browser-compatible subset of gRPC using HTTP/1.1 or HTTP/2 with a special framing codec. Requires server-side or proxy (e.g. envoy) support. |
| Spring Servlet | HTTP/1.1 POST transport wrapping gRPC payloads — compatible with Spring Boot servlet mode. Full Spring Boot walkthrough in Lesson 7. |
| Tauri Native | Desktop-only transport: uses Rust `tonic` for a direct native gRPC channel. Not available in the web app. |
| Express retry | When browser-direct fails (server lacks gRPC-Web support), a **Retry with Express Proxy** button appears in the response panel. |

**Steps (7):**

1. **Intro: Transport panel** — Open Settings drawer → **Transport** (`GRPC.SETTINGS_NAV_ITEM('transport')`). Show all four mode options: **Express Proxy**, **gRPC-Web**, **Spring Servlet**, **Tauri Native** (desktop only, grayed out in web). Explain the browser limitation: raw HTTP/2 gRPC is blocked by browsers, requiring a proxy or grpc-web adapter.

2. **Express proxy (default)** — Confirm **Express Proxy** is selected (`GRPC.TRANSPORT_MODE('express')`). Send an Echo call to `localhost:50051`. Succeeds. This is the universally safe default.

3. **Switch to gRPC-Web** — Select **gRPC-Web** (`GRPC.TRANSPORT_MODE('grpc-web')`). Change target to `localhost:50055` (envoy sidecar). Send Echo. The call goes directly from the browser — no Node proxy hop.

4. **gRPC-Web fallback** — Switch target back to `localhost:50051` (raw gRPC, no gRPC-Web support). Send Echo with gRPC-Web mode. The call fails. A **Retry with Express Proxy** button (`grpc-retry-express-btn`) appears in the response panel. Click it — call retries and succeeds via Express.

5. **Spring Servlet — brief introduction** — Select **Spring Servlet** (`GRPC.TRANSPORT_MODE('spring-servlet')`). Explain in one sentence: this is for Spring Boot servers running in servlet mode on `:8080`. Full configuration and a live Spring Boot walkthrough are in **Lesson 7**.

6. **Compression** — Open Settings → **Compression** (`GRPC.SETTINGS_NAV_ITEM('compression')`). Enable and select **gzip** (`GRPC.COMPRESSION_ALGORITHM`). Send a call. Response headers show `grpc-encoding: gzip`.

7. **Per-tab transport** — Open a second Studio tab. Set it to gRPC-Web while tab 1 stays on Express Proxy. Transport is per-tab — changing one tab does not affect another session.

**Verify:** `GRPC.TRANSPORT_MODE('grpc-web')` is active; `grpc-retry-express-btn` appears when gRPC-Web call fails against a non-gRPC-Web server.

**Implementation notes:**
- Retry button: `grpc-retry-express-btn` in `GrpcResponsePanel` (unary); `grpc-stream-retry-express-btn` in `GrpcCallPanel` (streaming) — add `GRPC.RETRY_EXPRESS_BTN` and `GRPC.STREAM_RETRY_EXPRESS_BTN` to `src/shared/selectors/grpc.ts`
- Envoy sidecar compose config needed for step 3; Spring Boot Docker fixture lives in Lesson 7
- Spring Servlet step (5) is intentionally brief — it just introduces the concept and directs learners to L7

---

---

## Lesson 7 — Spring Boot & Spring gRPC Integration

> **ID:** `grpc-spring-boot` | **Track:** Configuration | **Duration:** ~6 min | **Status:** 🔲 Planned
> **Docker requirement:** Spring Boot gRPC server on `:9090` (Netty) and `:8080` (Servlet) must be added to the fixture

**Description:** Connect RedfireForge to a Spring Boot gRPC server using both the Express proxy and the Spring Servlet transport. Enable server reflection via `application.yml`, explore services, call the gRPC Health Check, understand the Spring hint card, and authenticate calls through a Spring Security gRPC interceptor.

**Prerequisites:** Lessons 1 (`grpc-first-call`) and 6 (`grpc-transport-modes`).

**Learning objectives:**
- Connect to a Spring Boot gRPC server using Express proxy on the Netty port (`:9090`)
- Switch to Spring Servlet transport for servlet-mode Spring Boot servers (`:8080`)
- Enable gRPC server reflection in Spring Boot with `grpc.server.reflection.enabled=true`
- Use the Health Check panel with `grpc.health.v1.Health` and interpret the Spring hint card
- Authenticate calls through a Spring Security interceptor using bearer token auth

**Key concepts:**
| Term | Definition |
|---|---|
| `net.devh` starter | The most common Spring Boot gRPC starter (`grpc-server-spring-boot-starter`). Starts a Netty server on `:9090` by default. |
| `spring-grpc` | The official Spring project for gRPC integration (Spring Boot 3.x). Uses servlet-compatible transport on standard Spring ports. |
| Reflection in Spring | Enabled by setting `grpc.server.reflection.enabled=true` (net.devh) or `grpc.server.reflection=true` (spring-grpc) in `application.yml`. |
| Spring Servlet transport | RedfireForge transport mode for Spring Boot servers running in servlet mode — sends HTTP/1.1 POST requests with gRPC-Web compatible framing. |
| Spring hint card | A contextual tip Studio shows when calling `grpc.health.v1.Health` methods on a Spring server, guiding Health Check / Watch usage. |

**Steps (10):**

1. **Intro: Spring Boot gRPC servers** — Show two Spring Boot server configurations side by side in the Docker fixture: `localhost:9090` (Netty, `net.devh` starter) and `localhost:8080` (servlet, `spring-grpc`). Explain when each is used.

2. **Connect to Spring Boot Netty** — Set target to `localhost:9090`. Use **Express Proxy** transport (the standard gRPC proxy mode). Click **Reflect**. The Service Explorer populates with Spring-defined services.

3. **Reflection not enabled** — If reflection is not configured, the Reflect button returns an error. Show how to enable it: in `application.yml`, add `grpc.server.reflection.enabled=true` (net.devh) or `grpc.server.reflection: true` (spring-grpc). Re-reflect after the fix.

4. **Execute a Spring service call** — Select a Spring service method (e.g. `com.example.HelloService / SayHello`). Fill the request body and click **Send**. The response arrives via the Express proxy.

5. **Spring Servlet transport** — Open Settings → Transport. Switch to **Spring Servlet** (`GRPC.TRANSPORT_MODE('spring-servlet')`). Change target to `localhost:8080`. Re-reflect and send the same call. Explain the difference: gRPC payload wrapped in HTTP/1.1 POST, compatible with servlet containers.

6. **Health Check** — Select `grpc.health.v1.Health / Check` from the Service Explorer (if the Spring server exposes it). A **Spring hint card** (`GRPC.SPRING_HINT('spring_health_actuator')`) appears, guiding usage of the `service` field and `ServingStatus` enum. Fill `service: ""` (global check) and send. Show the `SERVING` response.

7. **Health Watch** — Switch to the Health Watch method (server streaming). Click **Start**. Receive live health-status events. Stop the stream.

8. **Bearer auth with Spring Security** — Open Settings → Authentication. Set **Bearer** type with a valid Spring Security JWT. Send a protected service call. Show that the `authorization: Bearer …` header is forwarded by the proxy and validated by the Spring interceptor.

9. **Proto stubs from Spring** — Open Manage Schemas. Show that after Reflect, all Spring-generated proto types appear in the Schema Browser. Expand a domain message to see its fields — identical to the Java `@GrpcService` method signature.

10. **Per-environment Spring targets** — In the env selector, set `grpcHost` for `local` to `localhost:9090` and for `staging` to `staging-grpc.internal:9090`. Switch environments in the target field showing `{{grpcHost}}` — Studio re-resolves without re-typing the address.

**Verify:** `GRPC.SERVICE_EXPLORER` populates after Reflect against Spring Boot; `GRPC.SPRING_HINT('spring_health_actuator')` appears on Health method; call returns OK via Express Proxy.

**Implementation notes:**
- Docker fixture needs two Spring Boot compose services:
  - `spring-grpc-netty`: `net.devh` starter with reflection enabled, port `:9090`
  - `spring-grpc-servlet`: `spring-grpc` starter or `net.devh` with servlet mode, port `:8080`
- Both services should expose at least one domain service + `grpc.health.v1.Health`
- Spring hint trigger: `spring_health_actuator` fires when the selected method is `grpc.health.v1.Health/Check` or `Health/Watch`
- Selectors to use: `GRPC.TRANSPORT_MODE('spring-servlet')`, `GRPC.SETTINGS_NAV_ITEM('transport')`, `GRPC.SPRING_HINT('spring_health_actuator')`, `GRPC.SPRING_HINT_DISMISS('spring_health_actuator')`, `GRPC.HEALTH_PANEL`, `GRPC.HEALTH_CHECK_BTN`, `GRPC.HEALTH_WATCH_BTN`, `GRPC.HEALTH_RESULT`, `GRPC.AUTH_TYPE_PILL('bearer')`

---

---

## Lesson 8 — Proto Form Builder: Schema-Driven Request Editing

> **ID:** `grpc-proto-form` | **Track:** Productivity | **Duration:** ~5 min | **Status:** 🔲 Planned
> **Docker requirement:** `CreateComplexEcho` method with nested/repeated/map/oneof/WKT fields must be added to `echo.proto`

**Description:** Use the Proto Form Builder to compose complex nested messages without writing JSON by hand. Explore scalar fields, repeated arrays, map entries, oneof groups, and the `google.protobuf.Timestamp` well-known type. Sync between form mode and JSON mode.

**Prerequisites:** Lesson 2 (`grpc-schema-discovery`).

**Learning objectives:**
- Fill scalar, nested message, repeated, and map fields using the form UI
- Understand how `oneof` groups work — only one field per group can be set at a time
- Use well-known type helpers (Timestamp) without memorising raw JSON format
- Switch to JSON mode to fine-tune the raw payload, then return to form mode with the edit preserved

**Key concepts:**
| Term | Definition |
|---|---|
| Proto Form Builder | RedfireForge's schema-aware form that renders one input per proto field, with correct type labels and validation. |
| Repeated field | A list/array field in proto. The form shows an **+ Add item** button and renders each element as a row. |
| Map field | A key-value field. The form renders a table with Add/Remove row controls. |
| Oneof | A group where only one field can be set. Selecting one radio clears the others — reflected in the JSON output. |
| Well-Known Types (WKT) | Google's standard proto types: Timestamp, Duration, Any, Struct — each rendered with a specialised form control. |

**Steps (10):**

1. **Intro: Form vs JSON** — Show the two request-body tabs: **Form** (`GRPC.REQUEST_TAB_FORM`) and **JSON** (`GRPC.REQUEST_TAB_JSON`). Explain that Form is driven by the loaded proto schema — only possible with typed RPC tools.

2. **Select complex method** — Select `echo.EchoService / CreateComplexEcho` from the Service Explorer. The form renders all field types defined in the proto.

3. **Scalar fields** — Fill string, int32, bool, and enum fields. Notice type labels beside each input.

4. **Nested message** — Expand a nested `Address` message field. Sub-fields render inline. Fill street, city, and country. Switch to the JSON tab to see the nested object representation.

5. **Repeated field** — Click **+ Add item** on a `repeated string tags` field. Add three entries. Remove the second via the trash icon. Switch to JSON — verify a two-element array.

6. **Map field** — Add two entries to a `map<string, string> labels` field: `env: prod` and `region: us-east`. Switch to JSON — verify the object shape.

7. **Oneof group** — Show a `oneof payment_method` group (e.g. `card` or `invoice`). Select **Card** — card sub-fields appear. Switch to **Invoice** — card fields clear, invoice fields appear.

8. **Timestamp WKT** — Expand a `google.protobuf.Timestamp deadline` field. A datetime picker renders instead of raw `seconds`/`nanos` JSON. Pick a date/time. Switch to JSON to verify the encoded value.

9. **Edit in JSON then return** — Switch to the JSON tab. Manually edit a field value. Switch back to Form — the field reflects the updated value. The two views stay in sync.

10. **Send and verify** — Click **Send**. The server should accept and echo back the complex message, confirming the proto encoding was correct.

**Verify:** `GRPC.PROTO_FORM` renders with nested and repeated controls; `GRPC.REQUEST_TAB_FORM` and `GRPC.REQUEST_TAB_JSON` switch correctly.

**Implementation notes:**
- `CreateComplexEcho` method must be added to `docker/grpc/proto/echo.proto` and the Docker image rebuilt — this is the primary blocker for this lesson
- There is **no "Generate Default"** button — do not include a step for it
- Repeated/map add buttons use CSS classes (no `data-testid`) — add `data-testid` attributes to `GrpcProtoRepeatedMapRows.tsx` before authoring: `grpc-proto-repeated-add` and `grpc-proto-map-add`
- Selectors to add: `GRPC.PROTO_FIELD_REPEATED_ADD`, `GRPC.PROTO_FIELD_MAP_ADD` (after adding testids above)
- Existing: `GRPC.REQUEST_TAB_FORM`, `GRPC.REQUEST_TAB_JSON`, `GRPC.PROTO_ONEOF(oneofName)`, `GRPC.PROTO_ONEOF_RADIO(oneofName, member)`

---

---

## Lesson 9 — Environments, Collections & History

> **ID:** `grpc-env-collections` | **Track:** Productivity | **Duration:** ~6 min | **Status:** 🔲 Planned

**Description:** Use `{{grpcHost}}` to drive the target address from the active environment, add custom variables for metadata and body values, save calls to a named collection folder, and replay from History with one click.

**Prerequisites:** Lessons 1 (`grpc-first-call`) and 4 (`grpc-metadata-auth`).

**Learning objectives:**
- Use `{{grpcHost}}` and custom environment variables in the target, metadata, and body

- Save a call to a named collection folder and recall it later
- Replay a history entry back into a Studio tab with all connection settings restored
- Export a collection to JSON and import it on a different machine

**Key concepts:**
| Term | Definition |
|---|---|
| `{{grpcHost}}` | Reserved gRPC variable. Resolves to `host:port` from the active environment (no scheme). |
| Interpolation | Template syntax (`{{var}}`) for injecting env values into target, metadata, auth, and body fields at execute time. |
| Collections | A tree of saved gRPC call snapshots — organised into folders, persistent in IndexedDB. |
| History | An automatic log of every invocation stored locally. Entries include full request/response snapshots; secrets are stripped on persist. |

**Steps (11):**

1. **Intro: Environments** — Open the environment selector (top nav). Show two environments: `local` (grpcHost = `localhost:50051`) and `staging` (grpcHost = `staging.api.internal:50051`).

2. **Use `{{grpcHost}}` in target** — Replace the literal target with `{{grpcHost}}`. The interpolation preview strip (`GRPC.INTERPOLATION_PREVIEW_STRIP`) shows the resolved address. The target validation badge updates.

3. **Switch environment** — Change active environment from `local` to `staging`. The preview strip updates instantly. Note: the staging server may not be reachable — this is intentional, showing that template resolution is separate from connectivity.

4. **Custom variable in metadata** — Add `x-request-id: {{requestId}}` in the Metadata tab. Show the preview strip resolving `requestId` from the environment.

5. **Variable in JSON body** — Switch to JSON mode and add `"userId": "{{userId}}"`. Show the in-body template syntax. Preview strip shows the resolved value.

6. **Interpolation error** — Delete the `{{requestId}}` variable from the environment. Show the orange **Interpolation Error** banner (`GRPC.INTERPOLATION_ERROR_BANNER`) with the unresolved token path.

7. **Save to collection** — Switch back to `local` env. Execute a unary Echo. Click **Save request** (`GRPC.SAVE_REQUEST_BTN`). Name the request `Echo — Hello World`. Create a folder `Echo Demos`. Save.

8. **Collections tree** — Open the **Collections** sub-nav (`GRPC.SUB_NAV_COLLECTIONS`). Show the `Echo Demos` folder with the saved request. Rename it via the context menu.

9. **Replay from Collections** — Click the saved request → **Open in tab**. A new Studio tab opens with all settings (target template, method, metadata, auth) restored.

10. **History replay** — Open the **History** sub-nav (`GRPC.SUB_NAV_HISTORY`). Show auto-logged entries. Click **Replay** on one — it opens in a new tab. Note: secrets are stripped from history persist — the token value will not be present.

11. **Export / import collection** — Click **Export** on the `Echo Demos` folder. Download the JSON. Click **Import** and re-import the file — the folder reappears with all requests intact.

**Verify:** `GRPC.COLLECTIONS_PANEL` shows saved folder; `GRPC.INTERPOLATION_PREVIEW_STRIP` updates on env switch; `GRPC.INTERPOLATION_ERROR_BANNER` appears on unresolved token.

---

---

## Lesson 10 — grpcurl Interop, Replay & Sharing

> **ID:** `grpc-grpcurl` | **Track:** Productivity | **Duration:** ~4 min | **Status:** 🔲 Planned

**Description:** Import a grpcurl command directly into gRPC Studio, execute the call, then export it back as a grpcurl command for sharing with teammates. Understand what gets filtered from exports (auth tokens, PEM paths).

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Import a grpcurl command and have Studio populate target, method, metadata, and body automatically
- Understand the grpcurl ↔ Studio field mapping
- Export a call as grpcurl for terminal reproduction
- Know which values are intentionally omitted from exports (token values, PEM certificate content)

**Key concepts:**
| Term | Definition |
|---|---|
| grpcurl | A popular CLI tool for gRPC. RedfireForge can import and export to/from grpcurl syntax. |
| Import mapping | `-d` → body, `-H` → metadata, `-plaintext` → Plaintext TLS mode, `-cert/-key` → TLS file paths (not PEM content). |
| Export filtering | Auth token values are replaced with `# secret omitted`. PEM files appear as paths, never as embedded content. |

**Steps (8):**

1. **Intro: grpcurl workflow** — Show a grpcurl command (text block). Explain that developers often share these but manually recreating all Studio fields is tedious.

2. **Open import modal** — Click the **Import grpcurl** button on the connection bar (`GRPC.IMPORT_GRPCURL_BTN`). The import modal opens with a large text area (`GRPC.IMPORT_GRPCURL_MODAL`).

3. **Paste the command** — Paste a full grpcurl command including `-H 'authorization: bearer demo-token'`, `-d '{"message":"hello"}'`, and the method. Click **Import** (`GRPC.IMPORT_GRPCURL_SUBMIT`).

4. **Review populated fields** — Studio fills target, method, metadata, body, and TLS mode from the imported flags. Point out each field briefly. Show any warnings for unsupported flags (`GRPC.IMPORT_GRPCURL_WARNINGS`).

5. **Execute imported call** — Click **Send** (`GRPC.SEND_BTN`). The call succeeds. History logs the entry.

6. **Export as grpcurl** — Open History → click **Copy grpcurl** (`GRPC.HISTORY_COPY_GRPCURL`) on the entry. The command preview opens.

7. **Secret filtering** — Point out that the `authorization` header value is replaced with a comment: `# secret omitted`. Explain: sharing commands with embedded tokens is a security risk.

8. **Proto path export** — Switch descriptor source to **Proto File** and export grpcurl. The output includes `-proto echo.proto` with the import path — no PEM content, only file paths.

**Verify:** `GRPC.IMPORT_GRPCURL_MODAL` opens; Studio fields populate after import; exported command does not contain raw token values.

**Implementation notes:**
- Import trigger is the **"Import grpcurl"** button (`GRPC.IMPORT_GRPCURL_BTN`) on the connection bar — not an Import dropdown
- Correct selector for import submit: `GRPC.IMPORT_GRPCURL_SUBMIT`; history copy: `GRPC.HISTORY_COPY_GRPCURL` (not `HISTORY_COPY_GRPCURL_BTN`)
- The grpcurl command to import should be hardcoded in the lesson fixture for reproducibility

---

---

## Lesson 11 — Load Testing: Concurrent Calls & Metrics

> **ID:** `grpc-load-testing` | **Track:** Advanced | **Duration:** ~6 min | **Status:** 🔲 Planned

**Description:** Run a concurrent load test against a unary gRPC method, read the latency percentiles and throughput metrics, configure a load-test profile, export results, and explore server-streaming load testing with message-count caps.

**Prerequisites:** Lessons 1 (`grpc-first-call`) and 9 (`grpc-env-collections`).

**Learning objectives:**
- Configure and run a concurrent unary gRPC load test with custom concurrency, total requests, and duration
- Interpret p50/p95/p99 latency, throughput (RPS), and error-rate metrics
- Save a load-test profile for reproducible benchmark runs
- Run a bounded server-streaming load test with a max-messages-per-stream cap

**Key concepts:**
| Term | Definition |
|---|---|
| Concurrency | Number of in-flight gRPC calls at the same time during the test. |
| Total requests | The total number of calls to execute across all workers. |
| p95 latency | The latency below which 95% of calls complete — a standard SLO measurement. |
| Load-test profile | A named, saved configuration for reproducible benchmarks. |
| Server-streaming load | Sends the same server-streaming RPC concurrently; each run is capped by max messages per stream. |

**Steps (11):**

1. **Intro: Advanced sub-nav** — Navigate to **Advanced** (`GRPC.SUB_NAV_ADVANCED`). Show the advanced shell (`GRPC.ADVANCED_SHELL`) with its nav bar (`GRPC.ADVANCED_NAV`) and four tabs: **Load testing** (`GRPC.ADVANCED_TAB('load_test')`), **Mock server** (`GRPC.ADVANCED_TAB('mock_server')`), **Schema diff** (`GRPC.ADVANCED_TAB('schema_diff')`), **RPC statistics** (`GRPC.ADVANCED_TAB('rpc_stats')`).

2. **Configure load test** — Open the **Load testing** panel. Select `echo.EchoService / Echo`. Set: Concurrency = 5, Total requests = 20. Note: the field is **"Total requests"** not "Iterations". Also note the optional Duration and ramp-up fields.

3. **Set request body** — Fill the body template (`message: "load-test-run"`). The same body is used for all concurrent calls.

4. **Start load test** — Click **Start load test** (`GRPC.LOAD_TEST_START`). Watch the live progress counter (calls in-flight, completed, errors).

5. **Read metrics** — When complete, highlight the results panel (`GRPC.LOAD_TEST_RESULTS`): total calls, success rate, errors, throughput (RPS), p50/p95/p99/max latency.

6. **Error drill-down** — If any calls fail, the error count links to a sample error with gRPC status code and message.

7. **Export JSON** — Click **Export JSON** (`grpc-load-test-export-json`). Show the exported file with `sourceMetadata` (method, target, transport, descriptor key) and the `attempts[]` summary.

8. **Export CSV** — Click **Export CSV** (`grpc-load-test-export-csv`). Show the tabular format suitable for spreadsheet analysis.

9. **Save profile** — Click **Save profile** (`GRPC.LOAD_TEST_PROFILE_SAVE`). Name it `Echo Baseline`. It appears in the profile dropdown for future runs.

10. **Load profile** — Select `Echo Baseline` from the dropdown. All fields restore. Change Concurrency to 10 and run again for a higher-concurrency comparison.

11. **Server-streaming load** — Switch the method to `echo.EchoService / ServerStream`. A **Max messages / stream** field appears. Set to 5. Start the test. Each concurrent run receives at most 5 messages; the metrics show per-stream message counts.

**Verify:** `GRPC.LOAD_TEST_RESULTS` shows metrics panel after run; profile saves and restores correctly.

**Implementation notes:**
- Load test field names: **"Total requests"** (`grpc-load-test-total-calls`), **"Duration (ms)"** (optional), no "Iterations" or "Deadline" fields
- Call type badge: `GRPC.LOAD_TEST_CALL_TYPE_BADGE` shows the current method call type (unary / server_streaming)
- Server-streaming: `GRPC.LOAD_TEST_MAX_MESSAGES_PER_STREAM` field appears only for streaming methods
- Selectors: `GRPC.ADVANCED_TAB('load_test')`, `GRPC.LOAD_TEST_PANEL`, `GRPC.LOAD_TEST_START`, `GRPC.LOAD_TEST_STOP`, `GRPC.LOAD_TEST_STATUS`, `GRPC.LOAD_TEST_RESULTS`, `GRPC.LOAD_TEST_SUMMARY_METRICS`, `GRPC.LOAD_TEST_PROFILE_SELECT`, `GRPC.LOAD_TEST_PROFILE_NAME`, `GRPC.LOAD_TEST_PROFILE_SAVE`, `GRPC.LOAD_TEST_PROFILE_LOAD`, `GRPC.LOAD_TEST_PROFILE_RENAME`, `GRPC.LOAD_TEST_PROFILE_DELETE`, `GRPC.LOAD_TEST_CALL_TYPE_BADGE`, `GRPC.LOAD_TEST_MAX_MESSAGES_PER_STREAM`
- **Not in `GRPC.*` selectors** (data-testid only): `grpc-load-test-export-json`, `grpc-load-test-export-csv`, `grpc-load-test-export-error` — add to selectors file before authoring

---

---

## Lesson 12 — Mocking gRPC APIs: Rules & Network Listener

> **ID:** `grpc-mock-server` | **Track:** Advanced | **Duration:** ~7 min | **Status:** 🔲 Planned

**Description:** Build mock rules for a gRPC service using the visual rule builder — define predicates on request body paths and metadata, configure response bodies and status codes, simulate global latency, and start the in-process mock runtime. Verify that the correct rules fire from a second Studio tab.

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Build a mock rule using body-path and metadata predicates
- Configure per-rule response body, gRPC status code, and error message
- Set global latency simulation on the mock runtime
- Start the in-process mock runtime and verify correct rule matching
- Understand the difference between in-process mock (web) and network listener (desktop)

**Key concepts:**
| Term | Definition |
|---|---|
| Mock rule | A predicate + response pair. When an incoming request matches the predicate, the mock returns the configured response. |
| Predicate | A condition on a request field. Supported predicates: method equals, service equals, metadata key equals/exists, body path equals/exists. |
| In-process mock | Web mock mode: Studio intercepts outbound calls before they leave the browser. No real server needed. |
| Network listener | Desktop (Tauri) mode: a real gRPC server listens on a configurable port and accepts calls from external clients. |
| Global latency | A configurable baseline delay applied to all mock responses — simulates realistic server response times. |

**Steps (12):**

1. **Intro: Mock use case** — Scenario: the real echo server is unavailable. We want to test against a mock that returns canned responses based on the request content.

2. **Open Mock Server panel** — Navigate to **Advanced → Mock server** (`GRPC.ADVANCED_TAB('mock_server')`). The mock panel has three tabs: **Builder** (`GRPC.MOCK_TAB_BUILDER`), **JSON** (`GRPC.MOCK_TAB_JSON`), and **Runtime** (`GRPC.MOCK_TAB_RUNTIME`). Start on the **Builder** tab. Show the empty rule list.

3. **Add first rule: body path match** — Click **+ Add rule** (`GRPC.MOCK_BUILDER_ADD_RULE`). In the predicate section: kind = **Body path equals**, path = `message`, value = `ping`. In the response section: body = `{"message": "pong"}`, status = **OK**.

4. **Add second rule: body path exists** — Click **+ Add rule** (`GRPC.MOCK_BUILDER_ADD_RULE`). Predicate: kind = **Body path exists**, path = `message`. Response: status = **INTERNAL**, error message = `Simulated error`. Note: this matches any request that has the `message` field — useful for fallback error rules.

5. **Add metadata rule** — Click **+ Add rule** (`GRPC.MOCK_BUILDER_ADD_RULE`). Predicate: **Metadata equals**, key = `x-test-mode`, value = `mock`. Response: body = `{"message": "metadata-matched"}`, status = **OK**.

6. **Rule ordering** — Explain that rules are evaluated top-to-bottom; the first matching rule wins. Drag the metadata rule to the top.

7. **Global latency** — Switch to the **Runtime** tab (`GRPC.MOCK_TAB_RUNTIME`). Find the **Latency** section (not per-rule — latency is global). Set default latency = 200ms and jitter = 50ms.

8. **Start mock runtime** — Click **Start mock runtime** (`GRPC.MOCK_START`). The status badge changes to **Running** (`GRPC.MOCK_STATUS`). In web mode, the mock intercepts Studio's outbound calls.

9. **Test rule: body path match** — In a second Studio tab, select Echo, fill `message = ping`, click **Send**. Response: `{"message": "pong"}`. Body-path rule matched.

10. **Test rule: metadata match** — Add metadata `x-test-mode: mock` in the second tab. Send again. The metadata rule (now first) fires: response `{"message": "metadata-matched"}`.

11. **Test fallback** — Remove the metadata header. Send `message = anything-else`. The body-path-exists rule fires with INTERNAL status.

12. **Stop and export** — Click **Stop mock runtime** (`GRPC.MOCK_STOP`). Switch to the **JSON** tab (`GRPC.MOCK_TAB_JSON`) to view the raw JSON rule set (`GRPC.MOCK_RULES_JSON`). Click **Export JSON** (`GRPC.MOCK_EXPORT_JSON`). Show the exported rule set. Mention the **network listener** toggle (`GRPC.MOCK_EXPOSE_NETWORK`) available on desktop (Tauri) at the bottom of the Runtime tab — a real port-bound gRPC server for external clients. The listen target is shown in `GRPC.MOCK_LISTEN_TARGET` with a copy button (`GRPC.MOCK_COPY_LISTEN_TARGET`).

**Verify:** `GRPC.MOCK_STATUS` shows Running; response body matches mock rule config; different rules fire based on predicate.

**Implementation notes:**
- Predicate kinds: method equals, service equals, metadata equals, metadata exists, body path equals, body path exists — **NOT** free-form `message` field with regex operator
- Latency is **global** (on the runtime tab), **not per-rule** — remove any per-rule latency step
- No **"Commit"** step needed — rules hot-swap as you add/remove them
- Mock panel has three sub-tabs: Builder (`GRPC.MOCK_TAB_BUILDER`), JSON (`GRPC.MOCK_TAB_JSON`), Runtime (`GRPC.MOCK_TAB_RUNTIME`)
- Network listener selectors (desktop only): `GRPC.MOCK_EXPOSE_NETWORK`, `GRPC.MOCK_LISTEN_TARGET`, `GRPC.MOCK_COPY_LISTEN_TARGET`, `GRPC.MOCK_LISTENER_GENERATION`, `GRPC.MOCK_LISTENER_LOG`
- Selectors: `GRPC.ADVANCED_TAB('mock_server')`, `GRPC.MOCK_SERVER_PANEL`, `GRPC.MOCK_TAB_BUILDER`, `GRPC.MOCK_TAB_JSON`, `GRPC.MOCK_TAB_RUNTIME`, `GRPC.MOCK_BUILDER_PANEL`, `GRPC.MOCK_BUILDER_ADD_RULE`, `GRPC.MOCK_BUILDER_RULE`, `GRPC.MOCK_START`, `GRPC.MOCK_STOP`, `GRPC.MOCK_STATUS`, `GRPC.MOCK_EXPORT_JSON`, `GRPC.MOCK_RULES_JSON`

---

---

## Lesson 13 — Proto Schema Diff & Breaking Change Detection

> **ID:** `grpc-schema-diff` | **Track:** Advanced | **Duration:** ~5 min | **Status:** 🔲 Planned
> **Docker requirement:** A modified proto variant (field removed) must be available via a second compose profile

**Description:** Capture a proto schema baseline, introduce a breaking change (field removal), run a comparison, interpret the three severity levels, export the diff report, and acknowledge the diff.

**Prerequisites:** Lesson 2 (`grpc-schema-discovery`).

**Learning objectives:**
- Capture a proto schema baseline as the reference point for future comparisons
- Understand the three diff severity levels: `informational`, `non_breaking`, `breaking`
- Identify breaking proto changes: field removal, field number reuse, type change, enum value removal
- Export the diff as clipboard JSON for CI consumption
- Acknowledge a diff to dismiss the drift banner without discarding the diff history

**Key concepts:**
| Term | Definition |
|---|---|
| Schema baseline | A snapshot of the proto descriptors captured at a known-good point in time. |
| Breaking change | A proto change that breaks existing clients — field removal, number reuse, type change. Severity = `breaking`. |
| Non-breaking | A structural change that existing clients tolerate but that alters API surface — e.g. a new required field. Severity = `non_breaking`. |
| Informational | Pure additions: new methods, new optional fields. Severity = `informational`. |
| Field number | Proto uses field numbers (not names) on the wire. Reusing a number for a different type silently corrupts serialized data. |

**Steps (9):**

1. **Intro: Why schema diff matters** — gRPC is typed — a proto change that removes a field silently breaks all existing clients. Studio can detect this before deployment.

2. **Open Schema Diff panel** — Navigate to **Advanced → Schema diff** (`GRPC.ADVANCED_TAB('schema_diff')`). Show the empty state (no baseline captured yet).

3. **Capture baseline** — Click **Capture baseline** (`GRPC.SCHEMA_DIFF_CAPTURE_BASELINE`) while connected to `localhost:50051`. A baseline snapshot is stored with a timestamp and the full method/type list.

4. **Simulate a breaking change** — Restart the demo server using the v2 compose profile (one field removed from `EchoRequest`, one new optional field added). When the server restarts, Studio's reflection cache is stale.

5. **Run comparison** — Click **Compare** (`GRPC.SCHEMA_DIFF_COMPARE`). The schema diff engine re-reflects the server and compares descriptors against the baseline.

6. **Read the diff** — Show the results panel (`GRPC.SCHEMA_DIFF_RESULTS`) with the change list (`GRPC.SCHEMA_DIFF_CHANGE_LIST`):
   - Removed field `message` — severity **breaking** (red)
   - Added field `text` — severity **informational** (blue)
   Filter by **Breaking** to show only the critical change.

7. **Understand severities** — Expand a breaking row to see: field number, old type, new type (or `removed`). Explain that field number reuse would also appear as `breaking`.

8. **Export diff** — Click **Copy JSON** (`grpc-schema-diff-export-json`). The diff report goes to clipboard with `exportMeta`, `changes[]` array, and a breaking count summary. Export also available as **Copy Markdown** (`grpc-schema-diff-export-markdown`) for human-readable changelogs.

9. **Acknowledge diff** — Click **Acknowledge** (`GRPC.SCHEMA_DIFF_ACK_BTN`) on a change row. A confirmation dialog explains the diff is dismissed for the current session but preserved in the diff history. Toggle **Hide acknowledged** (`GRPC.SCHEMA_DIFF_HIDE_ACKNOWLEDGED`) to filter out reviewed changes. The `GRPC.SCHEMA_DRIFT_BANNER` on the explorer also clears. Acknowledge means "we've reviewed it" — not "the change is safe".

**Verify:** `GRPC.SCHEMA_DIFF_CHANGE_LIST` shows diff rows; breaking severity count is non-zero; export goes to clipboard successfully.

**Implementation notes:**
- "Run Diff" button is labelled **"Compare"** — selector is `GRPC.SCHEMA_DIFF_COMPARE` which maps to `grpc-schema-diff-compare-btn` data-testid
- Severity names are `breaking`, `non_breaking`, `informational` — not `info`/`warning`/`breaking`
- Export is **copy to clipboard** (not a file download)
- The v2 docker compose profile or `/admin/swap` endpoint must be built before this lesson can be authored
- `GRPC.SCHEMA_DIFF_BREAKING_COUNT` is not a dedicated selector — read the count from `GRPC.SCHEMA_DIFF_CHANGE_LIST` row filter results
- Selectors: `GRPC.ADVANCED_TAB('schema_diff')`, `GRPC.SCHEMA_DIFF_PANEL`, `GRPC.SCHEMA_DIFF_CAPTURE_BASELINE`, `GRPC.SCHEMA_DIFF_COMPARE`, `GRPC.SCHEMA_DIFF_STATUS`, `GRPC.SCHEMA_DIFF_RESULTS`, `GRPC.SCHEMA_DIFF_CHANGE_LIST`, `GRPC.SCHEMA_DIFF_HIDE_ACKNOWLEDGED`, `GRPC.SCHEMA_DIFF_ACK_BTN`
- **Not in `GRPC.*` selectors** (data-testid only): `grpc-schema-diff-export-json`, `grpc-schema-diff-export-markdown`, `grpc-schema-diff-export-error` — add to selectors file before authoring

---

---

## Lesson 14 — gRPC in Workflows: Nodes, Assertions & Chaining

> **ID:** `grpc-workflow` | **Track:** Advanced | **Duration:** ~7 min | **Status:** 🔲 Planned
> **Dependency:** Workflow Designer gRPC node config modals are deferred to Phase 13. This lesson may use a pre-seeded workflow JSON loaded via adapter until the modals are ready.

**Description:** Add a gRPC unary node to a workflow, configure its request body, add an assertion node to verify the response field, chain a second gRPC call that uses the first call's output, and run the workflow in Quick Test to see step-level pass/fail results.

**Prerequisites:** Lessons 1 (`grpc-first-call`) and 9 (`grpc-env-collections`).

**Learning objectives:**
- Add a `grpcUnary` workflow node and understand its configuration (service, method, body)
- Map gRPC response fields to workflow output variables using the `steps.{nodeId}.grpc.*` namespace
- Add an assertion node to verify a response field value
- Run Quick Test and interpret step-level pass/fail in the Results Explorer
- Understand how gRPC workflow nodes differ from HTTP nodes (proto types, trailers as metadata)

**Key concepts:**
| Term | Definition |
|---|---|
| `grpcUnary` node | A workflow node that executes a single gRPC unary call and publishes response fields as output variables. |
| Output namespace | `steps.{nodeId}.grpc.*` — the path used to reference gRPC node outputs in downstream nodes. |
| Quick Test | Runs the workflow once without saving results — shows live step status and variable bindings. |
| Assertion node | A workflow node that evaluates a condition on a variable and marks the step pass/fail. |

**Steps (12):**

1. **Intro: Workflows** — Navigate to the Workflow Designer. Show an empty canvas. Explain that workflows chain protocol calls with assertions and data mapping.

2. **Add gRPC unary node** — Open the node palette → **gRPC Unary**. Drag onto the canvas. Note: if the node config modal is not yet available (Phase 13 dependency), use a pre-seeded workflow JSON imported via the adapter.

3. **Configure node: connection** — In the config panel, set target `{{grpcHost}}` (active environment). Select service `echo.EchoService`, method `Echo`.

4. **Configure node: request body** — In the **Body** tab, fill `message: "workflow-test"`.

5. **Configure node: output** — In the **Output** tab, note that `steps.grpc_echo.grpc.response.message` is auto-mapped. Add a custom output alias `echoReply`.

6. **Add assertion node** — Drag an **Assert** node from the palette. Connect it after the gRPC node.

7. **Configure assertion** — Set condition: `steps.grpc_echo.grpc.response.message` **equals** `workflow-test`. Label: `Echo reply matches input`.

8. **Add second gRPC node** — Drag a second `grpcUnary` node. Connect it after the assertion. Set body: `message: "{{steps.grpc_echo.grpc.response.message}} (chained)"`. This uses the first call's response in the next request.

9. **Run Quick Test** — Click **Quick Test** (`WF.QUICK_TEST_BTN`). The workflow executes; live step status overlays appear on the canvas nodes.

10. **Results Explorer** — After completion, open the Results Explorer. Show the three-panel view: diagram (step status colours), detail panel (request/response for each gRPC node), matrix.

11. **Inspect gRPC node result** — Click the first gRPC node in the diagram. Show the **Response** tab: body, status code, trailers. Note that trailing metadata is preserved in workflow results.

12. **Make assertion fail** — Edit the assertion condition to expect `wrong-value`. Re-run Quick Test. The assertion step turns red. Show the failure detail in the Results Explorer.

**Verify:** Quick Test pass turns gRPC node steps green; assertion failure turns step red; response body from the first gRPC node is visible in the detail panel.

**Implementation notes:**
- Workflow Designer gRPC node config modals (palette/config UI) are listed as deferred in Phase 13 — this lesson may need to be authored as a read-only walkthrough of a pre-built workflow until the modals are ready
- `WF.QUICK_TEST_BTN` exists in `src/shared/selectors/wf.ts` — verify the selector before authoring
- `WF.NODE_PALETTE_GRPC_UNARY`, `WF.GRPC_NODE_CONFIG_MODAL`, and `GRPC.WORKFLOW_RESULTS_GRPC_DETAIL` **do not yet exist** in the selectors files — add them as part of Phase 13 / 12H authoring
- The gRPC output namespace (`steps.{nodeId}.grpc.*`) is defined in `src/shared/grpc/buildGrpcNodeOperations.ts`
- Workflow gRPC node types available: `grpcUnary` (L14), `grpcServerStream` (with collect config: `maxMessages`, `untilExpression`, `maxDurationMs`), `grpcAssert` (assertion types: `grpcStatus`, `grpcField`, `grpcTrailer`, `grpcDuration`, `grpcStreamLength`)
- Advanced workflow nodes also exist (`grpcLoadTest`, `grpcMockAssert`, `grpcSchemaDiff`) but their palette/config modals are deferred to Phase 13

---

---

## Features Not Covered by Lessons (Intentional)

The following shipped features are **intentionally not given dedicated lessons** but are referenced as sub-steps or sidebar notes in other lessons:

| Feature | Where referenced | Rationale |
|---|---|---|
| **RPC Statistics** (`GRPC.ADVANCED_TAB('rpc_stats')`) | L11 step 1 intro (mentioned as 4th advanced tab) | Statistics accumulate automatically from regular usage — no "teaching step" needed. Covered by showing `GRPC.RPC_STATS_PANEL`, `GRPC.RPC_STATS_TABLE`, `GRPC.RPC_STATS_RESET` in the L11 intro. |
| **Response Snapshot Baseline** (`GRPC.RESPONSE_SNAPSHOT_PANEL`) | L9 step 10 (sidebar note after History replay) | Snapshots are a secondary feature used in CI / harness scenarios. Note the `SNAPSHOT_UPDATE_BASELINE`, `SNAPSHOT_VIEW_DIFF`, `SNAPSHOT_BADGE_*` selectors for Phase 12H if a step is added. |
| **K8s Port-Forward** (`GRPC.K8S_PANEL`) | L4 step 1 (listed in Settings drawer tour) | Requires actual K8s cluster — cannot be demonstrated in Docker-only lessons. |
| **Call Settings / Timeout** (`GRPC.CALL_SETTINGS_PANEL`) | L4 step 1 (listed in Settings drawer tour) | Simple config — `GRPC.CALL_SETTINGS_TIMEOUT` and `GRPC.CALL_SETTINGS_PREVIEW` shown during drawer walkthrough. |
| **BSR (Buf Schema Registry)** (`GRPC.PROTO_TAB_BSR`) | L2 step 3 (shown as a tab) | Requires BSR account — cannot be demonstrated without credentials. Fields: `GRPC.PROTO_BSR_MODULE_INPUT`, `GRPC.PROTO_BSR_VERSION_INPUT`, `GRPC.PROTO_BSR_TOKEN_INPUT`. |
| **URL descriptor fetch** (`GRPC.PROTO_TAB_URL`) | L2 step 3 (shown as a tab) | Requires externally hosted proto — briefly mentioned. Field: `GRPC.PROTO_URL_INPUT`. |
| **Saved request actions** (duplicate, delete, run load test) | L9, L11 | `GRPC.SAVED_REQUEST_DUPLICATE`, `GRPC.SAVED_REQUEST_DELETE`, `GRPC.SAVED_REQUEST_RUN_LOAD_TEST` are available in collections context menu — reference in L9/L11 sidebar. |
| **Proto `Any` type hint** (`GRPC.PROTO_ANY_HINT`) | L8 | Shown when a `google.protobuf.Any` field is encountered in the form. |
| **Spring `PERMISSION_DENIED` hint** (`GRPC.SPRING_HINT('spring_permission_denied')`) | L7 step 8 | Triggered on gRPC status code 7 — mention in auth troubleshooting sidebar. |

---

---

## Roster ID Migration Plan

The lesson contract in `grpc-lesson-contract/roster.ts` currently registers the **old 15-lesson IDs**. Before Phase 12H authoring, the roster must be migrated to the new 14-lesson IDs.

### Old → New Mapping

| Old roster # | Old ID | New # | New ID | Action |
|---|---|---|---|---|
| 1 | `grpc-first-call` | 1 | `grpc-first-call` | Keep (✅ shipped) |
| 2 | `grpc-server-reflection` | 2 | `grpc-schema-discovery` | Merge into L2 |
| 3 | `grpc-proto-import` | 2 | `grpc-schema-discovery` | Merge into L2 |
| 4 | `grpc-metadata` | 4 | `grpc-metadata-auth` | Rename + expand with auth |
| 5 | `grpc-tls` | 5 | `grpc-tls-mtls` | Rename |
| 6 | `grpc-server-streaming` | 3 | `grpc-streaming` | Merge all streaming into L3 |
| 7 | `grpc-client-streaming` | 3 | `grpc-streaming` | Merge all streaming into L3 |
| 8 | `grpc-bidi-streaming` | 3 | `grpc-streaming` | Merge all streaming into L3 |
| 9 | `grpc-collections` | 9 | `grpc-env-collections` | Merge with env vars |
| 10 | `grpc-env-variables` | 9 | `grpc-env-collections` | Merge with collections |
| 11 | `grpc-workflow-integration` | 14 | `grpc-workflow` | Renumber |
| 12 | `grpc-load-testing` | 11 | `grpc-load-testing` | Renumber |
| 13 | `grpc-mock-server` | 12 | `grpc-mock-server` | Renumber |
| 14 | `grpc-schema-diff` | 13 | `grpc-schema-diff` | Renumber |
| 15 | `grpc-spring-boot` | 7 | `grpc-spring-boot` | Renumber |
| — | _(new)_ | 6 | `grpc-transport-modes` | New lesson |
| — | _(new)_ | 8 | `grpc-proto-form` | New lesson |
| — | _(new)_ | 10 | `grpc-grpcurl` | New lesson |

---

---

## Authoring Checklist (per lesson)

Before marking any lesson as shipped:

```
[ ] 1. Manual 1× playthrough at real speed — every step visible, no steps too fast
[ ] 2. E2E smoke spec passes (e2e/demo-grpc-<lesson-id>.spec.ts)
[ ] 3. Helper unit tests pass (grpc-lesson-helpers.ts functions used in this lesson)
[ ] 4. All selectors used exist in src/shared/selectors/grpc.ts
[ ] 5. tsc + scoped vitest pass with zero errors
```

See [`docs/guides/demo-lesson-done-checklist.md`](../../../guides/demo-lesson-done-checklist.md) for the canonical format.

---

## Dependency Map

```
Lesson 1 (grpc-first-call)
 ├─► 2 (schema-discovery) — consolidates old GRPC-2 + GRPC-3
 │    └─► 8 (proto-form) — needs CreateComplexEcho fixture method
 │    └─► 13 (schema-diff) — needs baseline capability
 ├─► 3 (streaming)
 ├─► 4 (metadata-auth)
 │    └─► 9 (env-collections)
 │         └─► 11 (load-testing)
 │         └─► 14 (workflow)
 ├─► 5 (tls-mtls) — needs TLS/mTLS docker fixture
 ├─► 6 (transport-modes) — needs envoy sidecar docker fixture
 │    └─► 7 (spring-boot) — needs Spring Boot docker fixture
 ├─► 10 (grpcurl)
 └─► 12 (mock-server)
```

Lessons 11–14 can be taken independently after completing at least Lessons 1 and 9. Lessons 5, 6, and 7 have Docker build requirements and can only be authored after those services exist.

---

## Selector Reference — Gaps and Corrections

### Genuinely missing from `GRPC.*` (must be added to `src/shared/selectors/grpc.ts` before authoring)

| Selector to add | Used by | Where `data-testid` lives |
|---|---|---|
| `GRPC.TLS_TEST_RESULT` | L5 | `GrpcTlsConfigBody.tsx` — `grpc-tls-test-result` already in DOM |
| `GRPC.RETRY_EXPRESS_BTN` | L6 | `GrpcResponsePanel.tsx` — `grpc-retry-express-btn` already in DOM |
| `GRPC.STREAM_RETRY_EXPRESS_BTN` | L6 | `GrpcCallPanel.tsx` — `grpc-stream-retry-express-btn` already in DOM |
| `GRPC.PROTO_FIELD_REPEATED_ADD` | L8 | `GrpcProtoRepeatedMapRows.tsx` — add `data-testid="grpc-proto-repeated-add"` (CSS class exists, no testid) |
| `GRPC.PROTO_FIELD_MAP_ADD` | L8 | `GrpcProtoRepeatedMapRows.tsx` — add `data-testid="grpc-proto-map-add"` (CSS class exists, no testid) |
| `GRPC.METADATA_ADD_BTN` | L4 | KeyValueEditor in `GrpcMetadataEditor` — add `data-testid="grpc-metadata-add-btn"` |
| `GRPC.LOAD_TEST_EXPORT_JSON` | L11 | `GrpcLoadTestPanel.tsx` — `grpc-load-test-export-json` already in DOM |
| `GRPC.LOAD_TEST_EXPORT_CSV` | L11 | `GrpcLoadTestPanel.tsx` — `grpc-load-test-export-csv` already in DOM |
| `GRPC.LOAD_TEST_EXPORT_ERROR` | L11 | `GrpcLoadTestPanel.tsx` — `grpc-load-test-export-error` already in DOM |
| `GRPC.SCHEMA_DIFF_EXPORT_JSON` | L13 | `GrpcSchemaDiffPanel.tsx` — `grpc-schema-diff-export-json` already in DOM |
| `GRPC.SCHEMA_DIFF_EXPORT_MARKDOWN` | L13 | `GrpcSchemaDiffPanel.tsx` — `grpc-schema-diff-export-markdown` already in DOM |
| `GRPC.SCHEMA_DIFF_EXPORT_ERROR` | L13 | `GrpcSchemaDiffPanel.tsx` — `grpc-schema-diff-export-error` already in DOM |
| `WF.NODE_PALETTE_GRPC_UNARY` | L14 | Workflow node palette — Phase 13 work |
| `WF.GRPC_NODE_CONFIG_MODAL` | L14 | Workflow node config modal — Phase 13 work |

### Already in `GRPC.*` (no action needed — corrected from original review)

| Selector | Status |
|---|---|
| `GRPC.SCHEMA_DIFF_COMPARE` | ✅ Exists — maps to `grpc-schema-diff-compare-btn` |
| `GRPC.SCHEMA_DIFF_CHANGE_LIST` | ✅ Exists |
| `GRPC.SCHEMA_DIFF_RESULTS` | ✅ Exists |
| `GRPC.SCHEMA_DIFF_STATUS` | ✅ Exists |
| `GRPC.SCHEMA_DIFF_HIDE_ACKNOWLEDGED` | ✅ Exists |
| `GRPC.MOCK_TAB_BUILDER` / `MOCK_TAB_JSON` / `MOCK_TAB_RUNTIME` | ✅ Exist |
| `GRPC.MOCK_BUILDER_ADD_RULE` | ✅ Exists |
| `GRPC.MOCK_BUILDER_PANEL` | ✅ Exists |
| `GRPC.MOCK_EXPORT_JSON` | ✅ Exists |
| `GRPC.MOCK_RULES_JSON` | ✅ Exists |
| `GRPC.PROTO_EXPORT_PROTOSET` | ✅ Exists |
| `GRPC.PROTO_TAB_PROTO_FILES` | ✅ Exists |

### Incorrect names in the original plan (corrected in this file)

| Original plan name | Correct selector | Notes |
|---|---|---|
| `GRPC.DRIFT_BANNER` | `GRPC.SCHEMA_DRIFT_BANNER` | — |
| `GRPC.DRIFT_REBIND_BTN` | `GRPC.SCHEMA_DRIFT_REBIND(service, method)` | — |
| `GRPC.CALL_TYPE_SERVER_STREAM` | `GRPC.CALL_TYPE_TAB('server_streaming')` | — |
| `GRPC.CALL_TYPE_CLIENT_STREAM` | `GRPC.CALL_TYPE_TAB('client_streaming')` | — |
| `GRPC.CALL_TYPE_BIDI` | `GRPC.CALL_TYPE_TAB('bidi_streaming')` | — |
| `GRPC.STREAM_PENDING_QUEUE` | `GRPC.STREAM_PENDING_PANEL` | — |
| `GRPC.STREAM_SEND_ALL` | `GRPC.STREAM_SEND_ALL_BTN` | — |
| `GRPC.STREAM_EXPORT_BTN` | `GRPC.STREAM_EXPORT_LOG_BTN` | — |
| `GRPC.AUTH_CONFLICT_WARNING` | `GRPC.AUTH_CONFLICTS` | — |
| `GRPC.TLS_PROBE_BTN` | `GRPC.TLS_MODAL_TEST` | — |
| `GRPC.TLS_CHIP` | `GRPC.TLS_BADGE` | — |
| `GRPC.PROTO_MANAGE_BTN` | `GRPC.MANAGE_SCHEMAS_BTN` | — |
| `GRPC.PROTO_FORM_FORM_TAB` | `GRPC.REQUEST_TAB_FORM` | — |
| `GRPC.PROTO_FORM_JSON_TAB` | `GRPC.REQUEST_TAB_JSON` | — |
| `GRPC.LOAD_TEST_METRICS_PANEL` | `GRPC.LOAD_TEST_RESULTS` | — |
| `GRPC.LOAD_TEST_SAVE_PROFILE_BTN` | `GRPC.LOAD_TEST_PROFILE_SAVE` | — |
| `GRPC.SCHEMA_DIFF_CAPTURE_BTN` | `GRPC.SCHEMA_DIFF_CAPTURE_BASELINE` | — |
| `GRPC.MOCK_SERVER_STATUS` | `GRPC.MOCK_STATUS` | — |
| `GRPC.MOCK_ADD_RULE` | `GRPC.MOCK_BUILDER_ADD_RULE` | Builder tab context |
| `GRPC.MOCK_EXPORT` | `GRPC.MOCK_EXPORT_JSON` | — |
| `GRPC.MOCK_RULE_LIST` | `GRPC.MOCK_BUILDER_RULE` | Uses `data-testid^=` prefix match |
| `GRPC.SCHEMA_DIFF_TABLE` | `GRPC.SCHEMA_DIFF_CHANGE_LIST` | — |
| `GRPC.ADVANCED_SUB_NAV_LOAD_TEST` | `GRPC.ADVANCED_TAB('load_test')` | — |
| `GRPC.ADVANCED_SUB_NAV_MOCK` | `GRPC.ADVANCED_TAB('mock_server')` | — |
| `GRPC.SPRING_HINT_CARD` | `GRPC.SPRING_HINT('spring_health_actuator')` | — |
| `GRPC.FALLBACK_BANNER` | _(does not exist — use `GRPC.RETRY_EXPRESS_BTN`)_ | — |
| `GRPC.FALLBACK_USE_PROXY_BTN` | `grpc-retry-express-btn` (needs `GRPC.RETRY_EXPRESS_BTN` alias) | — |
