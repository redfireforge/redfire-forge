# gRPC Studio — Demo Lesson Plan

> **Last updated:** 2026-07-05 (L6 Transport Modes shipped as roster #19; L5 TLS/mTLS previously shipped; all Docker fixtures done via Phase 12D; workflow node config modals complete; native diagnostics tab added; selector corrections; L15 Tauri Desktop lesson added)
> **Status:** Authoring in progress — 6/15 shipped (L1–L6)
> **Lessons:** 15 total — 6 shipped (L1–L6 wrappers exist), 9 planned
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
| Spring Boot buried at #15 | Dedicated lesson (L7) covering `net.devh`, reflection, health, servlet vs Netty |
| Schema diff standalone | Schema diff in its own lesson and referenced in workflow lesson |
| Tauri-only features invisible in web | Dedicated lesson (L15) gated with `desktopOnly: true` — disabled in web, active in desktop app |

### Quality bar

Each lesson must demonstrate a **single powerful capability** a developer will use on day one. Steps must include real visible actions — click, fill, read result — not narration-only steps. All observable outcomes must be verifiable with existing `GRPC.*` selectors.

### Roster ID migration note

The lesson contract in `grpc-lesson-contract/roster.ts` currently registers the old 15-lesson IDs (`grpc-server-reflection`, `grpc-proto-import`, etc.) with shipped wrappers for L1–L4. Before Phase 12H authoring completes, the roster must be updated to the new 14-lesson IDs below. The four shipped wrappers (`grpc-first-call`, `grpc-schema-discovery`, `grpc-streaming`, `grpc-metadata-auth`) will remain; old IDs 2+3 have already been consolidated into `grpc-schema-discovery` (L2), and old streaming IDs 6+7+8 into `grpc-streaming` (L3).

---

## Four Learning Tracks

| Track | Lessons | Focus |
|---|---|---|
| **Foundation** | 1–3 | First call, schema, streaming |
| **Configuration** | 4–7 | Auth, TLS, transport, Spring Boot |
| **Productivity** | 8–10 | Proto form, environments, collections |
| **Advanced** | 11–15 | Load test, mock, schema diff, workflow, Tauri desktop |

---

## Lesson Roster

| # | ID | Title | Track | Duration | Status |
|---|---|---|---|---|---|
| 1 | `grpc-first-call` | Your First gRPC Call | Foundation | ~5 min | ✅ Shipped |
| 2 | `grpc-schema-discovery` | Schema Discovery: Reflection & Proto Import | Foundation | ~8 min | ✅ Shipped |
| 3 | `grpc-streaming` | Streaming RPCs: All Four Patterns | Foundation | ~7 min | ✅ Shipped |
| 4 | `grpc-metadata-auth` | Request Metadata & Authentication | Configuration | ~5 min | ✅ Shipped |
| 5 | `grpc-tls` | TLS, mTLS & Certificate Configuration | Configuration | ~5 min | ✅ Shipped |
| 6 | `grpc-transport-modes` | Transport Modes: Express, gRPC-Web & Spring Servlet | Configuration | ~6 min | ✅ Shipped |
| 7 | `grpc-spring-boot` | Spring Boot & Spring gRPC Integration | Configuration | ~6 min | ✅ Shipped |
| 8 | `grpc-proto-form` | Proto Form Builder: Schema-Driven Request Editing | Productivity | ~5 min | ✅ Shipped |
| 9 | `grpc-env-collections` | Environments, Collections & History | Productivity | ~6 min | 🔲 Planned |
| 10 | `grpc-grpcurl` | grpcurl Interop, Replay & Sharing | Productivity | ~4 min | 🔲 Planned |
| 11 | `grpc-load-testing` | Load Testing: Concurrent Calls & Metrics | Advanced | ~6 min | 🔲 Planned |
| 12 | `grpc-mock-server` | Mocking gRPC APIs: Rules & Network Listener | Advanced | ~8 min | 🔲 Planned |
| 13 | `grpc-schema-diff` | Proto Schema Diff & Breaking Change Detection | Advanced | ~5 min | 🔲 Planned |
| 14 | `grpc-workflow` | gRPC in Workflows: Nodes, Assertions & Chaining | Advanced | ~7 min | 🔲 Planned |
| 15 | `grpc-tauri-desktop` | Tauri Desktop: Native Transport, Diagnostics & Mock Listener | Advanced | ~6 min | 🔲 Planned 🖥️ Desktop only |

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

The following services were required to be added to the Docker fixture for the indicated lessons — all are now available as of **Phase 12D**:

| Port | Service | Needed for | Notes |
|---|---|---|---|
| `:50443` | TLS echo server (CA-signed cert) | L5 | ✅ Done — `docker/grpc/certs/` cert material in place |
| `:50444` | mTLS echo server (client cert validation) | L5 | ✅ Done |
| `:50055` | Envoy sidecar with gRPC-Web transcoding for `:50051` | L6 | ✅ Done — envoy proxy config in `docker/grpc/` |
| `:9090` / `:8080` | Spring Boot gRPC server (Netty/Servlet) | L7 | ✅ Done — `docker compose --profile spring` |
| Schema v2 variant | Echo server with a modified proto (field removed) | L13 | ✅ Done — `schema-v2` compose profile available |
| `CreateComplexEcho` method | Echo server with nested/repeated/map/oneof/WKT fields | L8 | ✅ Done — added to `echo.proto` |

All Docker fixtures for lessons L5–L8 and L13 are now available. Phase 12D delivered all fixture expansions.

Proto files live at `docker/grpc/proto/`, not `docker/grpc/fixtures/`. CA cert material goes in `docker/grpc/certs/`.

---

---

## Lesson 1 — Your First gRPC Call

> **ID:** `grpc-first-call` | **Track:** Foundation | **Duration:** ~5 min | **Status:** ✅ Shipped
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

**Steps (10):**

1. **Intro: gRPC Studio** — Orient the learner to the three main areas: connection bar (`GRPC.CONNECTION_BAR`), Service Explorer, and the request/response workspace. Step id: `grpc1-intro`. The lesson also calls `navigateToGrpcStudio` and `closeGrpcSettingsDrawerQuiet` here.

2. **Set the target** — Fill `localhost:50051` into the target field (`GRPC.TARGET_INPUT`). Watch the `GRPC.TARGET_STATUS_OK` badge appear. Step id: `grpc1-target`. **Verify:** `GRPC.TARGET_STATUS_OK`.

3. **Reflect** — Click **Reflect** (`GRPC.REFLECT_BTN`). Watch the Service Explorer (`GRPC.SERVICE_EXPLORER`) populate with `echo.EchoService` and its four methods. Step id: `grpc1-reflect`. **Verify:** `GRPC.EXPLORER_TREE` (not `EXPLORER_SOURCE`/`TOTAL` — those are informational only). Note: before Reflect fires, `normalizeGrpcConnectionForReflection` quietly resets auth to `none` and TLS to `disabled` so the lesson fixture doesn't fail due to stale session settings.

4. **Select Echo** — Expand `echo.EchoService` (`GRPC.SERVICE('echo.EchoService')`) and click **Echo** (`GRPC.METHOD('echo.EchoService', 'Echo')`) — unary, badge **U**. The Call Panel opens with a schema-driven form. Step id: `grpc1-select-method`. **Verify:** `GRPC.PROTO_FORM`.

5. **Fill the request** — Type `Hello from gRPC Studio` (`GRPC_DEMO_MESSAGE` constant) into the `message` field (`GRPC.PROTO_FIELD_INPUT_MESSAGE`). `GRPC.PROTO_FIELD_INPUT(fieldName)` is the generic pattern for any proto field. Step id: `grpc1-fill-message`.

6. **Send** — Click **Send** (`GRPC.SEND_BTN`). RedfireForge routes through the Express gRPC proxy (port 3001) to the Docker echo server on port 50051. Step id: `grpc1-send`. **Verify:** `GRPC.RESPONSE_BODY` (the body is present in DOM once the response arrives — this is what the implementation checks, not `RESPONSE_STATUS`).

7. **Read the response** — The implementation highlights `GRPC.RESPONSE_PANEL` and directs the learner to inspect visually — it does **not** programmatically click individual tabs. Point out: status **OK** (`GRPC.RESPONSE_STATUS`), duration (`GRPC.RESPONSE_DURATION`), response size (`GRPC.RESPONSE_SIZE`), echoed body in the **Body** tab (`GRPC.RESPONSE_TAB_BODY`). Instruct learner to click **Trailers** (`GRPC.RESPONSE_TAB_TRAILERS`) to see `grpc-status: 0`. Briefly note the other tabs: **Headers** (`GRPC.RESPONSE_TAB_HEADERS`), **Metadata**, **Timing**, **Tracing**, and the **Proto** top-tab (`GRPC.RESPONSE_TOP_TAB_PROTO`). Step id: `grpc1-response`.

8. **Click Call History sub-nav** — Spotlight `GRPC.SUB_NAV_HISTORY` with a 1200ms hold so the viewer can locate the tab, then click it to open the History panel. Added as a dedicated step (split from the original step 8) so the tab navigation moment is clearly visible rather than being buried in a longer action sequence. Step id: `grpc1-history-tab`. **Verify:** `GRPC.HISTORY_PANEL`.

9. **Replay from History** — Click the `echo.EchoService/Echo` row to expand it, then spotlight `GRPC.HISTORY_REPLAY_BTN` with a 1200ms hold so the viewer can read the button label, then click **Replay** to restore the request in the Call Panel. Step id: `grpc1-history`. **Verify:** `GRPC.SEND_BTN`.

10. **Send after replay** — Spotlight `GRPC.SEND_BTN` with a 1400ms hold (longer than normal so the viewer is ready), then click **Send Unary** to execute the replayed request. The response body reappears confirming the replay round-trip. Step id: `grpc1-replay`. **Verify:** `GRPC.RESPONSE_BODY`.

**Verify (lesson-level):** `GRPC.RESPONSE_BODY` is present after steps 6 and 10. `GRPC.HISTORY_PANEL` renders in step 8.

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

> **ID:** `grpc-schema-discovery` | **Track:** Foundation | **Duration:** ~8 min | **Status:** 🔨 Shipped (roster entry #16)
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

**Steps (17):**

1. **Intro: Descriptor sources** — `grpc16-intro`. Orient to the Service Explorer in its "no descriptor" state. Explain why five sources exist — reflection is convenient in dev/staging but production environments often disable it. Highlight `GRPC.CONNECTION_BAR`.

2. **Set target** — `grpc16-target`. Fill `localhost:50051` (`GRPC.TARGET_INPUT`) and verify `GRPC.TARGET_STATUS_OK`.

3. **Reflect** — `grpc16-reflect`. Click **Reflect** (`GRPC.REFLECT_BTN`). Service Explorer populates. **Verify:** `GRPC.EXPLORER_TREE`.

4. **Confirm reflection source badge** — `grpc16-source`. Highlight `GRPC.EXPLORER_SOURCE` — it shows **Reflection**, confirming the tree is driven by runtime descriptor exchange. Use Explorer search (`GRPC.EXPLORER_SEARCH`) to filter to "Echo" then clear it, demonstrating how to navigate large service catalogs. **Verify:** `GRPC.EXPLORER_SOURCE`.

5. **Open Manage Schemas** — `grpc16-manage-open`. Click `GRPC.MANAGE_SCHEMAS_BTN` to open the Manage Schemas modal (`GRPC.PROTO_MANAGE_MODAL`). Show the five tabs: **Proto Files** (`GRPC.PROTO_TAB_PROTO_FILES`), **Protoset** (`GRPC.PROTO_TAB_PROTOSET`), **URL** (`GRPC.PROTO_TAB_URL`), **BSR** (`GRPC.PROTO_TAB_BSR`), **Schema Browser** (`GRPC.PROTO_TAB_SCHEMA_BROWSER`). Note: there is no separate Reflection tab — reflection is triggered by the **Reflect** button in the main explorer. **Verify:** `GRPC.PROTO_MANAGE_MODAL`.

6. **Proto Files: Root-aware ingest** — `grpc16-proto-roots`. Navigate to the **Proto Files** tab and highlight `GRPC.PROTO_ROOT_MANAGER`. Explain the `protoRoots` model: uploaded files belong to a named virtual root; each file is normalized to a canonical path `<mountPath>/<file>`. The **Canonical paths** preview panel (`GRPC.PROTO_CANONICAL_PREVIEW`) shows resolved paths live. Collision warnings appear if two roots produce ambiguous basenames. This step is orientation only — the actual upload happens in step 8. **Verify:** `GRPC.PROTO_CANONICAL_PREVIEW`.

7. **Quick orientation: source tabs** — `grpc16-tabs`. Switch across the four file-based tabs and show one concrete example per tab:
   Proto Files → `examples/grpc/schema-discovery/proto-files/api/service.proto` + `examples/grpc/schema-discovery/proto-files/shared/common.proto`
   Protoset (`GRPC.PROTO_PROTOSET_ZONE`) → `examples/grpc/schema-discovery/protoset/echo.protoset`
   URL (`GRPC.PROTO_URL_INPUT`) → `http://localhost:5173/grpc-samples/url/echo.proto`
   BSR (`GRPC.PROTO_BSR_MODULE_INPUT`) → `buf.build/connectrpc/eliza` + version `main`
   Explain use cases: Proto Files for local repos, Protoset for CI bundles, URL for hosted descriptors, BSR for module-based contract distribution. Note that the BSR example depends on internet access. This is an orientation pass; the next three steps are a full Proto Files walkthrough. **Verify:** `GRPC.PROTO_UPLOAD_ZONE`.

8. **Proto Files: upload two files** — `grpc16-proto-files`. Stay on **Proto Files** and add both files into `GRPC.PROTO_UPLOAD_ZONE`:
   1) `examples/grpc/schema-discovery/proto-files/shared/common.proto`
   2) `examples/grpc/schema-discovery/proto-files/api/service.proto`
   Use drag-and-drop or click-to-browse with multi-select. Confirm both filenames appear in the file list. **Verify:** `GRPC.PROTO_UPLOAD_ZONE`.

9. **Proto Files: select root + review canonical paths** — `grpc16-select-root`. Click a root from the left virtual root list and confirm the right panel switches to that root. Review `GRPC.PROTO_CANONICAL_PREVIEW` to validate normalized paths before loading. **Verify:** `GRPC.PROTO_CANONICAL_PREVIEW`.

10. **Proto Files: load schema** — `grpc16-proto-load`. Click `GRPC.PROTO_LOAD_BTN` to parse uploaded files + import roots into an active descriptor source. Expected: no error, and Schema Browser can navigate the loaded service. If load fails, correct file set/import roots and retry. **Verify:** `GRPC.PROTO_LOAD_BTN`.

11. **Use loaded schema in Schema Browser** — `grpc16-schema-browser`. Switch to the **Schema Browser** tab (`GRPC.PROTO_TAB_SCHEMA_BROWSER`). Wait for `GRPC.SCHEMA_BROWSER` and `GRPC.SCHEMA_BROWSER_TREE`. If Proto Files load succeeded, browse the loaded `api.ApiService`. For the automated lesson path, reflected Echo remains as fallback so the tree is deterministic. Use search (`GRPC.SCHEMA_BROWSER_SEARCH`) to locate "Lookup". Expand and select the node to show the `LookupRequest`/`LookupResponse` signature in the detail panel. **Verify:** `GRPC.SCHEMA_BROWSER`.

12. **Copy grpcurl** — `grpc16-copy-grpcurl`. With the selected method node active in Schema Browser, click **Copy as grpcurl** (`GRPC.SCHEMA_COPY_GRPCURL_BTN`) to copy a ready-to-run terminal command. Separated from step 13 so viewers can see the copy action clearly before the modal closes. **Verify:** `GRPC.SCHEMA_COPY_GRPCURL_BTN`.

13. **Open in tab and execute unary** — `grpc16-open-method`. Click **Open in tab** (`GRPC.SCHEMA_OPEN_TAB_BTN`). The modal closes and the call panel opens with the method pre-selected. Execute a unary call (JSON body `{"ref":{"id":"A-100"}}` or reflected Echo fallback) and confirm a response arrives. **Verify:** `GRPC.RESPONSE_BODY`.

14. **Protoset: upload descriptor bundle** — `grpc16-protoset`. Return to **Manage Schemas** → **Protoset** tab. Drop the sample `.protoset` file (`examples/grpc/schema-discovery/protoset/echo.protoset`) onto `GRPC.PROTO_PROTOSET_ZONE`. Click **Load** and verify the source chip switches to `protoset` on success. This is a real descriptor load — the step only advances after the source chip confirms success. **Verify:** `GRPC.PROTO_PROTOSET_ZONE`.

15. **URL: load descriptor from remote proto** — `grpc16-url`. Switch to the **URL** tab (`GRPC.PROTO_TAB_URL`). Fill `http://localhost:5173/grpc-samples/url/echo.proto` into `GRPC.PROTO_URL_INPUT`. Click **Load** to run a real remote descriptor fetch. Depending on fixture/network policy, the load may succeed or return a guarded fetch error. **Verify:** `GRPC.PROTO_URL_INPUT`.

16. **BSR: load descriptor from registry module** — `grpc16-bsr`. Switch to the **BSR** tab (`GRPC.PROTO_TAB_BSR`). Fill module `buf.build/connectrpc/eliza` and version `main`. Click **Load** to perform a real BSR network fetch. If blocked by network, inspect the error banner. **Verify:** `GRPC.PROTO_BSR_MODULE_INPUT`.

17. **Schema drift awareness** — `grpc16-drift`. Close the modal and return to the main Studio view. Explain schema drift: when a running server's reflection changes after Studio has already cached descriptors, Studio surfaces a `GRPC.SCHEMA_DRIFT_BANNER` showing which services are affected. The banner offers per-service rebind (`GRPC.SCHEMA_DRIFT_REBIND(service, method)`) and a **Dismiss** button (`GRPC.SCHEMA_DRIFT_DISMISS_BTN`). ⚠️ **Deferred:** Active drift simulation requires a second Docker compose profile with a modified proto — this fixture does not exist yet. This step is informational only (banner is shown conceptually; no programmatic drift trigger). **Highlight:** `GRPC.SERVICE_EXPLORER`.

**Verify (lesson-level):** `GRPC.RESPONSE_BODY` is present after step 13. `GRPC.SCHEMA_BROWSER` renders in step 11.

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

> **ID:** `grpc-metadata-auth` | **Track:** Configuration | **Duration:** ~5 min | **Status:** ✅ Shipped
> **Wrapper:** `packages/demo-hub/src/lessons/protocols/grpc-metadata-auth.ts`
> **Helpers:** `packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.ts`

**Description:** Add custom request metadata headers, configure bearer token auth, try basic auth, API key, and inherited auth-profile modes, understand how RedfireForge detects conflicts between manual metadata and structured auth, and use environment variables in metadata values.

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Add and edit gRPC request metadata (key-value pairs sent as HTTP/2 headers)
- Configure bearer, basic, API key, and inherited auth-profile modes without editing raw metadata
- Understand that auth config takes precedence over manual `authorization` metadata
- Preview how metadata is resolved when environment variables are used in values

**Key concepts:**
| Term | Definition |
|---|---|
| Request metadata | Key-value pairs sent as HTTP/2 headers alongside the RPC — gRPC's equivalent of HTTP request headers. |
| Auth precedence | When Auth Panel has a type other than `none`, it generates the `authorization` header. Manual metadata with the same key is flagged as a conflict. |
| OAuth2 | Client-credentials flow: RedfireForge fetches a token from the token URL server-side before each call. The raw secret never reaches the browser. |

**Steps (9):**

1. **Intro: split settings surfaces** — Click the **gear icon** (`GRPC.CONNECTION_SETTINGS_BTN`) to open the Connection Settings drawer (`GRPC.SETTINGS_DRAWER`). The drawer now covers **TLS / mTLS**, **Call settings**, **Compression**, **Health check**, **K8s port-forward**, and **Transport**. Then click the **Auth** request-composer tab (`GRPC.REQUEST_TAB_AUTH`) or the connection-bar **Auth** badge (`GRPC.AUTH_BADGE`) to open the dedicated bottom Auth panel (`GRPC.AUTH_PANEL`).

2. **Metadata editor** — In the Call Panel, click the **Metadata** tab (`GRPC.REQUEST_TAB_METADATA`). Add a custom key-value: `x-request-id: lesson-4-demo`. This goes as an HTTP/2 header alongside the RPC.

3. **Send with metadata** — Click **Send** (`GRPC.SEND_BTN`). Inspect the response — verify the call succeeded. (If the echo server reflects request metadata, it can appear in the response body.)

4. **Bearer auth** — In the bottom **Auth** tab (`GRPC.REQUEST_TAB_AUTH`), choose **Bearer Token** from the auth-type dropdown (`GRPC.AUTH_TYPE_SELECT`). Fill a demo token value and click **Send** again.

5. **Basic auth** — Switch the auth-type dropdown to **Basic Auth**. Fill username `demo` and password `secret`.

6. **API Key auth** — Switch the auth-type dropdown to **API Key**. Fill key name `x-api-key` and value `my-key-123`. Note the custom metadata header that will be added.

7. **Inherit from Auth Profile** — If the active microservice/environment has a linked auth profile, switch the auth-type dropdown to **Inherit from Auth Profile** and review the profile selector (`grpc-auth-profile-select`). Explain that RedfireForge resolves the concrete auth mode at execute time, while custom non-auth headers still belong in the Metadata tab.

8. **Conflict detection** — While API Key auth is active, manually add `x-api-key` in the Metadata tab with a different value. Show the **conflict indicator** (`GRPC.AUTH_CONFLICTS`) that warns the auth panel owns this key. Show the auth preview (`GRPC.AUTH_PREVIEW`) that displays the merged metadata output.

9. **OAuth2** — Switch the auth-type dropdown to **OAuth 2.0 (Client Credentials)**. Fill token URL, client ID, and client secret fields. Explain that the server side fetches the token before each call — the raw credentials are held in the session secret vault.

10. **Env-var in metadata** — Add `x-env-token: {{authToken}}` in the Metadata editor. Show the interpolation preview strip (`GRPC.INTERPOLATION_PREVIEW_STRIP`) resolving the variable from the active environment. If the variable is unresolved, the `GRPC.INTERPOLATION_ERROR_BANNER` appears with the missing token path (`GRPC.INTERPOLATION_ERROR_TOKEN_PATH`).

**Verify:** `GRPC.AUTH_TYPE_PILL('bearer')` has active state; `GRPC.AUTH_CONFLICTS` appears when a conflicting metadata key is added.

**Implementation notes:**
- Selectors used: `GRPC.CONNECTION_SETTINGS_BTN`, `GRPC.SETTINGS_DRAWER`, `GRPC.AUTH_PANEL`, `GRPC.AUTH_TYPE_SELECT`, `GRPC.AUTH_BADGE`, `GRPC.REQUEST_TAB_AUTH`, `GRPC.AUTH_CONFLICTS`, `GRPC.AUTH_PREVIEW`, `GRPC.REQUEST_TAB_METADATA`, `GRPC.METADATA_EDITOR`, `GRPC.METADATA_ADD_BTN`, `GRPC.INTERPOLATION_PREVIEW_STRIP`, `GRPC.INTERPOLATION_ERROR_BANNER`, `GRPC.INTERPOLATION_ERROR_TOKEN_PATH`
- `GRPC.METADATA_ADD_BTN` (`grpc-metadata-add-btn`) is already in `src/shared/selectors/grpc.ts` ✅
- `AUTH_TYPE_PILLS` / `AUTH_TYPE_PILL(type)` do **not** exist in selectors — use `GRPC.AUTH_TYPE_SELECT` (a `<select>` dropdown) to change auth type
- Also available: `GRPC.AUTH_ISSUES` for validation issues on auth config, `GRPC.AUTH_PREVIEW` for the merged metadata preview

---

---

## Lesson 5 — TLS, mTLS & Certificate Configuration

> **ID:** `grpc-tls` | **Track:** Configuration | **Duration:** ~5 min | **Status:** ✅ Shipped
> **Wrapper:** `packages/demo-hub/src/lessons/protocols/grpc-tls.ts`
> **Helpers:** `packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.ts` + lesson-local TLS modal helpers
> **Docker fixture:** TLS echo server (`:50443`) and mTLS echo server (`:50444`) available in `docker/grpc/` — Phase 12D ✅

**Description:** Connect to a TLS-protected gRPC server, paste a CA certificate to validate server identity, configure mutual TLS with a client certificate and private key, run the local TLS validation test, send calls over both the TLS and mTLS channels, and learn how PEM material is kept in an in-session secret vault.

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Understand the three TLS modes: Plaintext, TLS, mTLS
- Paste PEM-encoded CA cert, client cert, and private key into the secret fields
- Use the server name override (SNI) field for CN/SAN hostname mismatches
- Run the local TLS validation test before sending a call
- Send unary calls over both TLS and mTLS channels

**Key concepts:**
| Term | Definition |
|---|---|
| TLS (Transport Layer Security) | Encrypts the gRPC channel. Requires the server's certificate to be trusted by the client's CA. |
| Mutual TLS (mTLS) | Both client and server present certificates — the server verifies the client's identity in addition to the usual server-side TLS. |
| CA Certificate | The Certificate Authority cert used to validate the server's identity. |
| Server name override (SNI) | Used when the server certificate CN/SAN does not match the target hostname (e.g. `localhost` vs `127.0.0.1`). |
| Secret vault | PEM content is held in an in-session secret vault — never written to localStorage or included in collection/history exports. |

**UI access — TLS lives behind the connection-bar badge, NOT the settings drawer.** The **TLS badge** (`GRPC.TLS_BADGE`) in the connection bar opens the **TLS / mTLS Configuration** modal (`GRPC.TLS_MODAL_BODY`). The gear/session-settings drawer has no TLS tab. The modal renders `GrpcTlsConfigBody` inside the shared `TlsConfigModal` (`testIdPrefix="grpc-tls"`).

**Steps (8):**

1. **TLS badge & channel modes** — Spotlight `GRPC.TLS_BADGE`, open the modal, and spotlight each of the three mode buttons in turn (`GRPC.TLS_MODE('disabled'|'tls'|'mtls')`). Explain that Auth (credentials) and TLS (channel encryption) are independent. Close the modal. Step id: `grpc5-intro`.

2. **Plaintext Reflect fails on a TLS server** — Set target `localhost:50443`. **Changing the target clears the service tree** — click **Reflect** (not Send). With Plaintext still active, reflection fails; spotlight the error in the Services panel (`GRPC.EXPLORER_ERROR`). Step id: `grpc5-plaintext-fail`. **Verify:** `GRPC.SERVICE_EXPLORER`.

3. **Configure TLS: CA cert & test** — Open modal, click **TLS** (`GRPC.TLS_MODE('tls')`), paste the fixture `ca.crt` into `grpc-tls-server-ca`, spotlight the **Set** badge, click **Test TLS Connection** (`GRPC.TLS_MODAL_TEST`) and spotlight the result (`GRPC.TLS_TEST_RESULT`), then **Save** (`GRPC.TLS_MODAL_SAVE`). Badge flips to 🔒 TLS. Step id: `grpc5-configure-tls`. **Verify:** `GRPC.TLS_BADGE`.

4. **Reflect + Send over TLS** — With TLS enabled on `:50443`, click **Reflect**, select **Echo**, then **Send**; call returns OK. Spotlight `GRPC.RESPONSE_BODY` then the badge. Step id: `grpc5-send-tls`. **Verify:** `GRPC.RESPONSE_BODY`.

5. **Server name override (SNI)** — Open modal, type `localhost` into the SNI hostname field (`grpc-tls-server-name`), spotlight the filled value, **Save**. Step id: `grpc5-server-name`. **Verify:** `GRPC.TLS_BADGE`.

6. **Configure mTLS** — Set target `localhost:50444`, open modal, click **mTLS** (`GRPC.TLS_MODE('mtls')`). Spotlight and fill the new **Client Certificate** (`grpc-tls-client-cert`) and **Client Private Key** (`grpc-tls-client-key`) fields (CA carried over). **Save** → badge flips to 🛡 mTLS. Step id: `grpc5-configure-mtls`. **Verify:** `GRPC.TLS_BADGE`.

7. **Reflect + Send over mTLS** — With mTLS enabled on `:50444`, click **Reflect**, select **Echo**, then **Send**; server validates the client cert and returns OK. Spotlight `GRPC.RESPONSE_PANEL` then the badge. Step id: `grpc5-send-mtls`. **Verify:** `GRPC.RESPONSE_PANEL`.

8. **Secret vault & cleanup** — Reopen modal, spotlight the **Set** badges (`.ws-tls-field-set-badge`) and a **Clear stored** control, explain the vault guarantees, then **Reset to Defaults** (`GRPC.TLS_MODAL_RESET`) back to Plaintext and restore target to `localhost:50051`. Step id: `grpc5-secret-vault`. **Verify:** `GRPC.CONNECTION_BAR`.

**Verify (lesson-level):** TLS badge reflects the active mode after steps 3/6; Echo returns OK over TLS (step 4) and mTLS (step 7); channel is reset to Plaintext at cleanup.

**Implementation notes:**
- **Access path:** TLS badge (`GRPC.TLS_BADGE`) opens the modal via `openRequest` increment on the headless `GrpcTlsPanel`. The settings drawer does **not** host TLS.
- **Target change clears reflection:** `updateTab` with a new target invalidates the descriptor cache and method binding — each TLS/mTLS target requires a fresh **Reflect** + method selection before Send.
- **preAction is badge-driven, not modal-driven:** helpers read the connection-bar badge label (`currentTlsBadgeMode()`) to decide whether reconfiguration is needed, so the "Preparing" phase never flashes the modal during normal sequential playback. The modal is only opened (quietly) on rapid-Next / restart recovery.
- PEM input is via masked `PemField` textareas (paste, not file-picker) — no "Upload" buttons. A **Set** badge marks vault-stored fields; **Clear stored** wipes them.
- **Save is disabled unless the modal is dirty** (`disabled={!dirty}`). Reset-to-defaults marks dirty, re-enabling Save.
- TLS test (`GRPC.TLS_MODAL_TEST`) performs local PEM/credential validation (`grpc-tls-test-result` = `GRPC.TLS_TEST_RESULT`), not a live handshake probe.
- Fixture PEM material is embedded in the wrapper (`DEMO_CA_CERT`, `DEMO_CLIENT_CERT`, `DEMO_CLIENT_KEY`) from `docker/grpc/certs/` — Phase 12D ✅
- Highlights use `showSpotlightRing` (a persistent box, not a flash); multi-element steps spotlight one element at a time with a digest pause.

---

---

## Lesson 6 — Transport Modes: Express, gRPC-Web & Spring Servlet

> **ID:** `grpc-transport-modes` | **Roster #:** 19 | **Track:** Configuration | **Duration:** ~6 min | **Status:** ✅ Shipped (GRPC-19)
> **Docker fixture:** Go echo server on `:50051` + Envoy gRPC-Web sidecar on `:50055` — Phase 12D ✅

**Description:** Understand why gRPC requires a proxy in browsers and how RedfireForge's transport modes serve different deployment scenarios. Switch between Express proxy, gRPC-Web browser-direct, and Spring Servlet. Observe the Express fallback retry when browser-direct fails. Confirm transport is configured per-tab. Spring Boot-specific configuration is covered in depth in Lesson 15 (Spring Boot).

**Prerequisites:** Lesson 1 (`grpc-first-call`).

**Learning objectives:**
- Explain why browsers cannot call gRPC services directly without a proxy or grpc-web adapter
- Switch to gRPC-Web browser-direct mode for Envoy-fronted services
- Recognise the retry-with-Express offer when browser-direct transport fails
- Enable gzip compression and read the live header preview
- Understand that transport is per-tab and independent across Studio tabs
- Identify the fourth mode, Tauri Native, and why it is desktop-only

**Key concepts:**
| Term | Definition |
|---|---|
| Express proxy | Default transport: RedfireForge's Node server acts as a gRPC proxy via `@grpc/grpc-js`. Works with all servers and call types, on web and desktop. |
| gRPC-Web | A browser-compatible subset of gRPC using `fetch` with grpc-web framing. Requires server-side or proxy (e.g. Envoy) support. Unary + server streaming only. |
| Spring Servlet | HTTP/1.1 POST transport (`/<service>/<method>`) — compatible with Spring Boot servlet mode. Unary + server streaming only. Full Spring Boot walkthrough in Lesson 15. |
| Tauri Native | Desktop-only transport: uses Rust `tonic` for a direct native gRPC channel, no Node.js hop. Grayed out with a "Desktop only" reason label in the web app. |
| Express retry | When browser-direct fails (server lacks gRPC-Web/Servlet support), a **Retry with Express Proxy** button appears in the response panel and switches the tab's transport permanently. |
| Reflection routing | `Reflect` always dispatches through the Express backend regardless of the tab's selected transport — only the actual RPC **call** uses the tab's chosen mode. |

**Steps (8):**

1. **`grpc19-intro`** — Open Settings drawer → **Transport** (`GRPC.SETTINGS_NAV_ITEM('transport')`). Spotlight each of the four mode cards in turn — **Express Proxy**, **Tauri Native** (grayed out on web), **gRPC-Web**, **Spring Servlet** — with a short digest pause on each, landing back on Express before closing. Explain the browser limitation: raw HTTP/2 gRPC is blocked by `fetch`/XHR, requiring a proxy or grpc-web adapter.

2. **`grpc19-express-baseline`** — With **Express Proxy** active (the default), send an Echo call to `localhost:50051`. Succeeds — this is the control case kept in mind for the rest of the lesson.

3. **`grpc19-grpc-web-live`** — Switch to **gRPC-Web**, change target to `localhost:50055` (Envoy sidecar). Changing target clears the service tree, so **Reflect** runs again (always via Express) before Echo can be selected. Send — the call succeeds fully browser-direct, no Node hop.

4. **`grpc19-grpc-web-fallback`** — Still in gRPC-Web mode, switch target back to `localhost:50051` (raw gRPC, no grpc-web support). Reflect succeeds (Express-routed) but **Send** fails — the browser transport hint (`GRPC.RESPONSE_BROWSER_TRANSPORT_HINT`) explains why. Spotlight and click **Retry with Express Proxy** (`GRPC.RETRY_EXPRESS_BTN`) — the tab switches transport and the same call now succeeds.

5. **`grpc19-spring-servlet-intro`** — Select **Spring Servlet**. One-sentence introduction: HTTP/1.1 POST to `/<service>/<method>`, matching Spring Boot servlet mode. Full walkthrough deferred to **Lesson 15**.

6. **`grpc19-compression`** — Back on Express Proxy, open Settings → **Compression** (`GRPC.SETTINGS_NAV_ITEM('compression')`). Enable and select **gzip** (`GRPC.COMPRESSION_ALGORITHM`). Spotlight the live **Effective headers** preview (`GRPC.COMPRESSION_PREVIEW`) showing `grpc-encoding: gzip`, then send a call to confirm it still succeeds.

7. **`grpc19-per-tab`** — Confirm tab 1 is Express Proxy. Add a second tab (`GRPC.ADD_TAB`), switch **only** the new tab to gRPC-Web, then switch back to tab 1 and reopen Transport — it still reads Express Proxy, unaffected. Close the extra tab to tidy up.

8. **`grpc19-tauri-native`** — Open Transport again and spotlight the **Tauri Native** card. On web it is disabled with a `GRPC.TRANSPORT_MODE_REASON('tauri')` "Desktop only" label; on desktop (Tauri) it is selectable like any other mode. Full interactive walkthrough (channel diagnostics, native streaming, Mock Network Listener) is **Lesson 15 (Tauri Desktop)**.

**Verify:** `GRPC.RESPONSE_BODY` after each successful send (steps 2, 3, 6); `GRPC.RESPONSE_PANEL` shows the failure + retry flow in step 4; `GRPC.TAB_BAR` confirms per-tab isolation in step 7.

**Implementation notes:**
- Roster entry added as **#19** (not renumbered into the historical 1–18 sequence) — step IDs use the `grpc19-` prefix per lesson-contract convention (`grpc\d+-...`).
- Retry button: `grpc-retry-express-btn` in `GrpcResponsePanel` (unary); `grpc-stream-retry-express-btn` in `GrpcCallPanel` (streaming) — both already exist; added `GRPC.RETRY_EXPRESS_BTN`, `GRPC.STREAM_RETRY_EXPRESS_BTN`, `GRPC.RESPONSE_ERROR_MESSAGE`, `GRPC.RESPONSE_BROWSER_TRANSPORT_HINT`, `GRPC.TRANSPORT_MODE_REASON`, `GRPC.TRANSPORT_LOCKED_HINT` to `src/shared/selectors/grpc.ts`.
- `Reflect` is Express-routed regardless of transport mode — step 3/4 rely on this so re-reflecting after a target change always succeeds even while gRPC-Web is selected.
- Clicking **Retry with Express Proxy** permanently switches the tab's transport mode to Express — step 5's `preAction` explicitly restores Express before introducing Spring Servlet.
- Compression is demonstrated over Express Proxy (not gRPC-Web) for reliability — compression negotiation is guaranteed end-to-end at the HTTP/2 gRPC layer there.
- Step 8 does not attempt a live Tauri call in a web-only lesson run — it spotlights the disabled/enabled state and defers the full demo to Lesson 15, matching the Spring Servlet brief-intro pattern in step 5.
- Shared spotlight/target/settings-drawer helpers (`spotlightAndPause`, `spotlightElementAndPause`, `setGrpcTargetQuiet`, `openGrpcSettingsDrawerQuiet`) were extracted from `grpc-tls.ts` / `grpc-metadata-auth.ts` duplicates into `grpc-lesson-helpers.ts` as part of this lesson's implementation, and both lessons now import the shared versions.

---

---

## Lesson 7 — Spring Boot & Spring gRPC Integration

> **ID:** `grpc-spring-boot` | **Track:** Configuration | **Duration:** ~6 min | **Status:** 🔲 Planned
> **Docker fixture:** Spring Boot gRPC servers on `:9090` (Netty) and `:8080` (Servlet) available in `docker/grpc/` — Phase 12D ✅

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

> **ID:** `grpc-proto-form` | **Track:** Productivity | **Duration:** ~5 min | **Status:** ✅ Shipped
> **Docker fixture:** `CreateComplexEcho` on the Go echo fixture (`docker/grpc/proto/echo.proto` + `go-server/main.go`) with nested/repeated/map/oneof/WKT fields — same `GO_ECHO_FIXTURE` as Lessons 1–4, no separate rebuild required.

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

2. **Select complex method** — Select `echo.EchoService / CreateComplexEcho` from the Service Explorer. The form renders one row per top-level field: `message` (string), `labels` (repeated string), `attributes` (map<string, string>), `shipping_address` (nested message), `deadline` (`google.protobuf.Timestamp`), and the `payment_method` oneof (`card` / `invoice`).

3. **Scalar field** — Fill the `message` string field. Notice the `#1 optional` note and `string` type badge beside the input — this fixture's only top-level scalar is a string; other RedfireForge schemas render the same badge/note convention for int32, bool, and enum fields.

4. **Nested message (JSON sub-editor)** — Locate the `shipping_address` row. Nested `message`-type fields render as a small **inline JSON textarea**, not expanded sub-fields — this keeps the form compact for arbitrarily deep schemas. Type a JSON object with `street`, `city`, and `country` directly into the textarea. Switch to the JSON tab to confirm the same nested object appears under `shipping_address`.

5. **Repeated field** — Click **+ Add item** (`GRPC.PROTO_FIELD_REPEATED_ADD('labels')`) on the `labels` row three times, filling each new text input. Remove the second entry via its `×` button. Switch to JSON — verify a two-element `labels` array.

6. **Map field** — Click **+ Add entry** (`GRPC.PROTO_FIELD_MAP_ADD('attributes')`) on the `attributes` row twice: `env` → `prod` and `region` → `us-east`. Switch to JSON — verify the `attributes` object shape.

7. **Oneof group** — Show the `payment_method` oneof (`GRPC.PROTO_ONEOF('payment_method')`) with **card** / **invoice** radio pills. Select **card** — a JSON sub-editor for `CardPayment` appears; type `card_number`/`expiry`. Switch to **invoice** — the card sub-editor is replaced by an `InvoicePayment` sub-editor (`invoice_number`/`due_date`); the two members are mutually exclusive, exactly like a native proto oneof.

8. **Timestamp WKT** — Locate the `deadline` field. `google.protobuf.Timestamp` renders as a **plain text input** pre-filled with the current instant as an RFC3339/ISO8601 string (not a `seconds`/`nanos` JSON object, and not a native date picker) — point out the placeholder hint and edit the value. Switch to JSON to confirm the same ISO string appears verbatim under `deadline`.

9. **Edit in JSON then return** — Switch to the JSON tab. Manually edit the `message` value in the raw JSON. Switch back to Form — the `message` field reflects the updated value. The two views stay in sync in both directions.

10. **Send and verify** — Click **Send**. The server echoes back `request_id`, `message`, `labels`, `attributes`, `shipping_address`, `deadline`, and the active `payment_method` member, confirming the proto encoding for every field type was correct.

**Verify:** `GRPC.PROTO_FORM` renders with nested and repeated controls; `GRPC.REQUEST_TAB_FORM` and `GRPC.REQUEST_TAB_JSON` switch correctly.

**Implementation notes (updated after live verification):**
- `CreateComplexEcho` ships on the **Go echo fixture** (`docker/grpc/proto/echo.proto` + `docker/grpc/go-server/main.go`), not a separate rebuild — confirmed live via `grpcurl describe echo.ComplexEchoRequest` against the running `grpc-test-server` container. Uses the standard `GO_ECHO_FIXTURE` / `GO_ECHO_DOCKER` roster fixture, same as Lessons 1–4.
- Field names in the actual fixture: `message` (string), `labels` (repeated string — **not** `tags`), `attributes` (map<string,string> — **not** `labels`), `shipping_address` (nested `ShippingAddress` message), `deadline` (`google.protobuf.Timestamp`), `payment_method` oneof with `card` (`CardPayment`) / `invoice` (`InvoicePayment`) members.
- There is **no top-level int32/bool/enum scalar** on `ComplexEchoRequest` — step 3 above was corrected to only cover the `message` string field.
- **Nested messages and oneof message members do not render as expanded inline sub-fields.** `GrpcProtoNestedMessageFieldRow` and the oneof's active message member both delegate to `GrpcProtoJsonObjectEditor` — a `<textarea>` JSON sub-editor. This applies to `shipping_address`, `card`, and `invoice`. Steps 4 and 7 above were corrected accordingly.
- **Timestamp WKT does not render a datetime picker.** `GrpcProtoWktScalarFieldRow` renders a plain `<input type="text">` with placeholder `RFC3339 / ISO8601`, defaulting to `new Date().toISOString()`. Step 8 above was corrected accordingly.
- There is **no "Generate Default"** button — do not include a step for it
- All required `data-testid` attributes already exist in the codebase — no component changes were needed: `grpc-proto-repeated-add-${fieldName}` (`GRPC.PROTO_FIELD_REPEATED_ADD`), `grpc-proto-map-add-${fieldName}` (`GRPC.PROTO_FIELD_MAP_ADD`), `grpc-proto-field-input-${fieldName}-${index}` (`GRPC.PROTO_FIELD_INPUT_INDEXED`), `grpc-proto-field-input-${fieldName}-key-${index}` / `-value-${index}` (`GRPC.PROTO_FIELD_MAP_KEY` / `MAP_VALUE`).
- Existing: `GRPC.REQUEST_TAB_FORM`, `GRPC.REQUEST_TAB_JSON`, `GRPC.PROTO_FORM`, `GRPC.PROTO_FIELD(fieldName)`, `GRPC.PROTO_FIELD_INPUT(fieldName)`, `GRPC.PROTO_ONEOF(oneofName)`, `GRPC.PROTO_ONEOF_RADIO(oneofName, member)`

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

1. **Intro: Advanced sub-nav** — Navigate to **Advanced** (`GRPC.SUB_NAV_ADVANCED`). Show the advanced shell (`GRPC.ADVANCED_SHELL`) with its nav bar (`GRPC.ADVANCED_NAV`) and five tabs: **Load testing** (`GRPC.ADVANCED_TAB('load_test')`), **Mock server** (`GRPC.ADVANCED_TAB('mock_server')`), **Schema diff** (`GRPC.ADVANCED_TAB('schema_diff')`), **RPC statistics** (`GRPC.ADVANCED_TAB('rpc_stats')`), and **Native Diagnostics** (`GRPC.ADVANCED_TAB('native_diagnostics')`) — desktop only, grayed out in web. This lesson focuses on Load testing.

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

> **ID:** `grpc-mock-server` | **Track:** Advanced | **Duration:** ~8 min | **Status:** 🔲 Planned

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

12. **Stop and export** — Click **Stop mock runtime** (`GRPC.MOCK_STOP`). Switch to the **JSON** tab (`GRPC.MOCK_TAB_JSON`) to view the raw JSON rule set (`GRPC.MOCK_RULES_JSON`). Click **Export JSON** (`GRPC.MOCK_EXPORT_JSON`). Show the exported rule set — it can be committed to source control and imported on another machine.

13. **Network Listener (desktop / Tauri only)** — On the Tauri desktop app, a **Network Listener** toggle (`GRPC.MOCK_EXPOSE_NETWORK`) appears at the bottom of the Runtime tab. Enabling it binds a real TCP port — external gRPC clients connect directly to the mock without going through Studio. The listen address appears in `GRPC.MOCK_LISTEN_TARGET`. This step is narration-only in web mode — spotlight the toggle and copy button, explain the concept, but do not click. **Full interactive walkthrough** including external grpcurl calls, hot-swap behaviour, and the listener log is in **Lesson 15 (Tauri Desktop)**.

**Verify:** `GRPC.MOCK_STATUS` shows Running; response body matches mock rule config; different rules fire based on predicate.

**Implementation notes:**
- Predicate kinds: method equals, service equals, metadata equals, metadata exists, body path equals, body path exists — **NOT** free-form `message` field with regex operator
- Latency is **global** (on the runtime tab), **not per-rule** — remove any per-rule latency step
- No **"Commit"** step needed — rules hot-swap as you add/remove them
- Mock panel has three sub-tabs: Builder (`GRPC.MOCK_TAB_BUILDER`), JSON (`GRPC.MOCK_TAB_JSON`), Runtime (`GRPC.MOCK_TAB_RUNTIME`)
- **Step 13 (Network Listener)** is narration-only in web — spotlight `GRPC.MOCK_EXPOSE_NETWORK` and `GRPC.MOCK_LISTEN_TARGET` without clicking; guard `action()` with `if (isTauri()) { ... }` and fall through with a descriptive delay for web viewers
- Network listener selectors (desktop only): `GRPC.MOCK_EXPOSE_NETWORK`, `GRPC.MOCK_LISTEN_TARGET`, `GRPC.MOCK_COPY_LISTEN_TARGET`, `GRPC.MOCK_LISTENER_GENERATION`, `GRPC.MOCK_LISTENER_LOG`
- Selectors: `GRPC.ADVANCED_TAB('mock_server')`, `GRPC.MOCK_SERVER_PANEL`, `GRPC.MOCK_TAB_BUILDER`, `GRPC.MOCK_TAB_JSON`, `GRPC.MOCK_TAB_RUNTIME`, `GRPC.MOCK_BUILDER_PANEL`, `GRPC.MOCK_BUILDER_ADD_RULE`, `GRPC.MOCK_BUILDER_RULE`, `GRPC.MOCK_START`, `GRPC.MOCK_STOP`, `GRPC.MOCK_STATUS`, `GRPC.MOCK_EXPORT_JSON`, `GRPC.MOCK_RULES_JSON`
- Estimated minutes: ~8 min (13 steps)

---

---

## Lesson 13 — Proto Schema Diff & Breaking Change Detection

> **ID:** `grpc-schema-diff` | **Track:** Advanced | **Duration:** ~5 min | **Status:** 🔲 Planned
> **Docker fixture:** Schema v2 compose profile available in `docker/grpc/` — Phase 12D ✅

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
- The v2 docker compose profile is available in `docker/grpc/` — Phase 12D ✅. Start with `docker compose --profile schema-v2 up` to get the modified echo server.
- `GRPC.SCHEMA_DIFF_BREAKING_COUNT` is not a dedicated selector — read the count from `GRPC.SCHEMA_DIFF_CHANGE_LIST` row filter results
- Selectors: `GRPC.ADVANCED_TAB('schema_diff')`, `GRPC.SCHEMA_DIFF_PANEL`, `GRPC.SCHEMA_DIFF_CAPTURE_BASELINE`, `GRPC.SCHEMA_DIFF_COMPARE`, `GRPC.SCHEMA_DIFF_STATUS`, `GRPC.SCHEMA_DIFF_RESULTS`, `GRPC.SCHEMA_DIFF_CHANGE_LIST`, `GRPC.SCHEMA_DIFF_HIDE_ACKNOWLEDGED`, `GRPC.SCHEMA_DIFF_ACK_BTN`
- **Not in `GRPC.*` selectors** (data-testid only): `grpc-schema-diff-export-json`, `grpc-schema-diff-export-markdown`, `grpc-schema-diff-export-error` — add to selectors file before authoring

---

---

## Lesson 14 — gRPC in Workflows: Nodes, Assertions & Chaining

> **ID:** `grpc-workflow` | **Track:** Advanced | **Duration:** ~7 min | **Status:** 🔲 Planned
> **Dependency:** Workflow Designer gRPC node palette and config modals are **complete** — `GrpcUnaryConfig.tsx`, `GrpcServerStreamConfig.tsx`, `GrpcAssertConfig.tsx`, `GrpcLoadTestConfig.tsx`, `GrpcSchemaDiffConfig.tsx`, `GrpcMockAssertConfig.tsx` all shipped. No pre-seeded workflow fallback needed.

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

2. **Add gRPC unary node** — Open the node palette → **gRPC Unary**. Drag onto the canvas. The node config modal opens automatically. Configure it in the next steps.

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
- Workflow Designer gRPC node config modals (palette/config UI) are **shipped** — `GrpcUnaryConfig.tsx`, `GrpcServerStreamConfig.tsx`, `GrpcAssertConfig.tsx`, `GrpcLoadTestConfig.tsx`, `GrpcSchemaDiffConfig.tsx`, `GrpcMockAssertConfig.tsx` all available; pre-seeded workflow fallback is no longer needed
- `WF.QUICK_TEST_BTN` exists in `src/shared/selectors/wf.ts` — verify the selector before authoring
- `WF.NODE_PALETTE_GRPC_UNARY`, `WF.GRPC_NODE_CONFIG_MODAL`, and `GRPC.WORKFLOW_RESULTS_GRPC_DETAIL` **do not yet exist** in the selectors files — add them as part of Phase 13 / 12H authoring
- The gRPC output namespace (`steps.{nodeId}.grpc.*`) is defined in `src/shared/grpc/buildGrpcNodeOperations.ts`
- Workflow gRPC node types available: `grpcUnary` (L14), `grpcServerStream` (with collect config: `maxMessages`, `untilExpression`, `maxDurationMs`), `grpcAssert` (assertion types: `grpcStatus`, `grpcField`, `grpcTrailer`, `grpcDuration`, `grpcStreamLength`)
- Advanced workflow nodes also exist (`grpcLoadTest`, `grpcMockAssert`, `grpcSchemaDiff`) — their palette/config modals are **shipped** (`GrpcLoadTestConfig.tsx`, `GrpcMockAssertConfig.tsx`, `GrpcSchemaDiffConfig.tsx`)

---

---

## Lesson 15 — Tauri Desktop: Native Transport, Diagnostics & Mock Listener

> **ID:** `grpc-tauri-desktop` | **Track:** Advanced | **Duration:** ~6 min | **Status:** 🔲 Planned
> **Platform gate:** `desktopOnly: true` — disabled in web app, active in Tauri desktop app
> **Fixture flag:** `fixtures: { requiresTauri: true, requireGoEcho: true }`
> **Wrapper:** `packages/demo-hub/src/lessons/protocols/grpc-tauri-desktop.ts`

**Description:** Unlock the features that only exist on the RedfireForge desktop app. Switch to native Rust `tonic` transport for a proxy-free gRPC channel, read live channel diagnostics, run a streaming call via the native stack, and expose the Mock Network Listener so external clients — terminal, microservices, CI — can call the mock over a real TCP port.

**Prerequisites:** Lessons 1 (`grpc-first-call`), 6 (`grpc-transport-modes`), 12 (`grpc-mock-server`).

**Learning objectives:**
- Switch to Tauri Native transport and understand why it differs from Express Proxy
- Interpret channel pool stats, call counters, and stream lifecycle data in the Native Diagnostics panel
- Run a server-streaming call through the native `tonic` stack and observe stream counters update
- Enable the Mock Network Listener and send a real gRPC call to it from outside Studio
- Understand hot-swap rule behaviour and the listener generation counter

**Key concepts:**
| Term | Definition |
|---|---|
| Tauri Native transport | Rust `tonic` gRPC channel managed by the Tauri backend. No Node.js Express proxy — the call goes directly from Rust to the target server. |
| Channel pool | A pool of reusable `tonic` channels keyed by target + TLS config. Stats visible in the Native Diagnostics panel. |
| Native Diagnostics | A read-only Advanced tab showing channel pool, active call/stream counts, listener tracking, and last error taxonomy. |
| Mock Network Listener | Desktop-only mode: a Rust `tonic` gRPC server bound to a real TCP port. External clients connect directly — no Studio tab or proxy involved. |
| Listener generation | A counter that increments each time the mock rule set hot-swaps into the running listener without a restart. |

**Desktop-only gating — authoring rules:**
- Set `desktopOnly: true` on the `DemoLesson` wrapper
- Set `fixtures: { requiresTauri: true, requireGoEcho: true }` on the roster entry
- Every `preAction` must guard with `if (!isTauri()) return` to skip interactive steps silently when tested in non-Tauri E2E
- E2E coverage: the lesson has no automated E2E spec (Tauri binary not available in CI) — manual walkthrough on the desktop app is the verification path (checklist items 1 and 3)

**Steps (10):**

1. **Intro: Desktop-only features** — Highlight the Settings drawer Transport panel. In the desktop app, **Tauri Native** is a selectable option, not grayed out. Explain the difference: Express Proxy routes through the Node.js `@grpc/grpc-js` layer on port 3001; Tauri Native routes through a Rust `tonic` channel pool — no JavaScript in the critical path. Step id: `grpc15-intro`. **Highlight:** `GRPC.CONNECTION_SETTINGS_BTN`.

2. **Switch to Tauri Native** — Open Settings → Transport → select **Tauri Native** (`GRPC.TRANSPORT_MODE('tauri-native')`). Close the drawer. A native transport indicator appears in the connection bar. Step id: `grpc15-native-mode`. **Verify:** `GRPC.TRANSPORT_MODE('tauri-native')` has active state.

3. **Send a unary call natively** — Click **Send** on an Echo unary call. Observe `GRPC.RESPONSE_DURATION` — native calls typically show lower latency than the Express proxy path because they skip the Node.js relay hop. The response body and status are identical. Step id: `grpc15-native-call`. **Verify:** `GRPC.RESPONSE_BODY`.

4. **Open Native Diagnostics** — Navigate to **Advanced** → **Native Diagnostics** (`GRPC.ADVANCED_TAB('native_diagnostics')`). The panel shows a snapshot of the channel pool: active channels, call registry counter (calls completed this session), and last transport mode used. Step id: `grpc15-diagnostics`. **Highlight:** `GRPC.ADVANCED_TAB('native_diagnostics')`.

5. **Refresh snapshot** — Click **Refresh** in the diagnostics panel. The snapshot timestamp updates. Click **Copy JSON** — the full diagnostic payload goes to clipboard, useful for bug reports and support tickets. Step id: `grpc15-diag-refresh`.

6. **Streaming in native mode** — Select `echo.EchoService / ServerStream`. Fill `repeat_count: 5`. Click **Start** (`GRPC.STREAM_START_BTN`). Five messages arrive via the native `tonic` stream relay. Return to Native Diagnostics → Refresh — the stream registry counter reflects the completed stream. Step id: `grpc15-native-stream`. **Verify:** `GRPC.STREAM_STATUS_BAR` shows FINISHED.

7. **Set up mock rules** — Navigate to **Advanced → Mock Server → Builder** tab. Add a rule: body path equals `message` → value `ping` → response `{"message":"pong"}`, status OK. Start the mock runtime (`GRPC.MOCK_START`). Step id: `grpc15-mock-setup`. **Verify:** `GRPC.MOCK_STATUS` shows Running.

8. **Enable the Network Listener** — In the **Runtime** tab, enable the **Network Listener** toggle (`GRPC.MOCK_EXPOSE_NETWORK`). A Rust gRPC server binds to a local port. `GRPC.MOCK_LISTEN_TARGET` shows the address (e.g. `127.0.0.1:50099`). Click `GRPC.MOCK_COPY_LISTEN_TARGET` to copy. Step id: `grpc15-listener-enable`. **Verify:** `GRPC.MOCK_LISTEN_TARGET` is visible.

9. **Call the listener externally** — (Narration + action step.) Paste the listen target into this grpcurl command and run it in a terminal:
   ```
   grpcurl -plaintext -d '{"message":"ping"}' 127.0.0.1:50099 echo.EchoService/Echo
   ```
   Studio receives the call, matches the body-path rule, and returns `{"message":"pong"}`. Show the **Listener log** (`GRPC.MOCK_LISTENER_LOG`) — the request appears with matched rule name and latency. Step id: `grpc15-external-call`.

10. **Hot-swap a rule** — Back in the **Builder** tab, add a second rule: body path equals `message` → value `hello` → response `{"message":"world"}`. The listener log shows `GRPC.MOCK_LISTENER_GENERATION` increment — rule hot-swapped without restart. Run grpcurl with `"message":"hello"` — new rule fires. Stop the listener and reset transport to Express Proxy. Step id: `grpc15-hot-swap`.

**Verify (lesson-level):** `GRPC.TRANSPORT_MODE('tauri-native')` active in step 2; `GRPC.MOCK_LISTEN_TARGET` visible in step 8; stream registry counter updates in step 6.

**Implementation notes:**
- Set `desktopOnly: true` on the `DemoLesson` wrapper — `isLessonDesktopOnlyBlocked()` in `lessonPlatform.ts` blocks this lesson on web automatically
- `fixtures: { requiresTauri: true, requireGoEcho: true }` — `requiresTauri` is a new field added to `GrpcLessonFixtureRequirements` in `grpc-lesson-contract/types.ts`
- Every `preAction` must call `if (!isTauri()) return` as the first guard so the lesson is safe to run in E2E shims and non-desktop test runners
- Step 9 (external grpcurl call) is a narration-heavy step — the `action()` should spotlight `GRPC.MOCK_LISTENER_LOG` and `GRPC.MOCK_LISTEN_TARGET`, show a ripple on the copy button, then pause for 2500ms to give the viewer time to read the grpcurl snippet
- **No automated E2E spec** — the lesson is marked `desktopOnly: true`. Manual walkthrough on the desktop build is the verification path (done checklist items 1 and 3)
- When the lesson ends (cleanup), always: stop mock runtime if running, disable network listener, reset transport to Express Proxy
- Selectors: `GRPC.CONNECTION_SETTINGS_BTN`, `GRPC.TRANSPORT_MODE('tauri-native')`, `GRPC.ADVANCED_TAB('native_diagnostics')`, `GRPC.STREAM_START_BTN`, `GRPC.STREAM_STATUS_BAR`, `GRPC.MOCK_START`, `GRPC.MOCK_STOP`, `GRPC.MOCK_STATUS`, `GRPC.MOCK_EXPOSE_NETWORK`, `GRPC.MOCK_LISTEN_TARGET`, `GRPC.MOCK_COPY_LISTEN_TARGET`, `GRPC.MOCK_LISTENER_GENERATION`, `GRPC.MOCK_LISTENER_LOG`, `GRPC.RESPONSE_BODY`, `GRPC.RESPONSE_DURATION`

---

---

## Features Not Covered by Lessons (Intentional)

The following shipped features are **intentionally not given dedicated lessons** but are referenced as sub-steps or sidebar notes in other lessons:

| Feature | Where referenced | Rationale |
|---|---|---|
| **RPC Statistics** (`GRPC.ADVANCED_TAB('rpc_stats')`) | L11 step 1 intro (mentioned as 5th advanced tab) | Statistics accumulate automatically from regular usage — no "teaching step" needed. Covered by showing `GRPC.RPC_STATS_PANEL`, `GRPC.RPC_STATS_TABLE`, `GRPC.RPC_STATS_RESET` in the L11 intro. Export actions: `GRPC.RPC_STATS_EXPORT_JSON_BTN`, `GRPC.RPC_STATS_EXPORT_CSV_BTN`. |
| **Native Diagnostics** (`GRPC.ADVANCED_TAB('native_diagnostics')`) | L11 step 1 (intro mention) + **L15 steps 4–5** (dedicated) | Desktop-only panel. L11 step 1 briefly names it as the 5th Advanced tab; L15 (Tauri Desktop) is the dedicated lesson that walks through refresh, copy JSON, and stream counter behaviour. |
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
| 5 | `grpc-tls` | 5 | `grpc-tls` | Keep (✅ shipped — TLS, mTLS & Certificate Configuration) |
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
| — | _(new)_ | 6 | `grpc-transport-modes` | New lesson (✅ shipped — actual roster #19) |
| — | _(new)_ | 8 | `grpc-proto-form` | New lesson |
| — | _(new)_ | 10 | `grpc-grpcurl` | New lesson |
| — | _(new)_ | 15 | `grpc-tauri-desktop` | New lesson — desktop-only |

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
 ├─► 5 (tls-mtls)
 ├─► 6 (transport-modes)
 │    └─► 7 (spring-boot)
 │    └─► 15 (tauri-desktop) — requires L6 + L12; desktopOnly
 ├─► 10 (grpcurl)
 └─► 12 (mock-server)
      └─► 15 (tauri-desktop) — requires L6 + L12; desktopOnly
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
| `GRPC.LOAD_TEST_EXPORT_JSON` | L11 | `GrpcLoadTestPanel.tsx` — `grpc-load-test-export-json` already in DOM |
| `GRPC.LOAD_TEST_EXPORT_CSV` | L11 | `GrpcLoadTestPanel.tsx` — `grpc-load-test-export-csv` already in DOM |
| `GRPC.LOAD_TEST_EXPORT_ERROR` | L11 | `GrpcLoadTestPanel.tsx` — `grpc-load-test-export-error` already in DOM |
| `GRPC.SCHEMA_DIFF_EXPORT_JSON` | L13 | `GrpcSchemaDiffPanel.tsx` — `grpc-schema-diff-export-json` already in DOM |
| `GRPC.SCHEMA_DIFF_EXPORT_MARKDOWN` | L13 | `GrpcSchemaDiffPanel.tsx` — `grpc-schema-diff-export-markdown` already in DOM |
| `GRPC.SCHEMA_DIFF_EXPORT_ERROR` | L13 | `GrpcSchemaDiffPanel.tsx` — `grpc-schema-diff-export-error` already in DOM |
| `WF.NODE_PALETTE_GRPC_UNARY` | L14 | Workflow node palette — verify exists after Phase 13 palette work |
| `WF.GRPC_NODE_CONFIG_MODAL` | L14 | Workflow node config modal — verify exists after Phase 13 modal work |

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
| `GRPC.METADATA_ADD_BTN` | ✅ Exists — maps to `grpc-metadata-add-btn` (was listed as missing; confirmed present) |
| `GRPC.RPC_STATS_EXPORT_JSON_BTN` | ✅ Exists — maps to `grpc-rpc-stats-export-json-btn` (added in post-GA P1 quick win) |
| `GRPC.RPC_STATS_EXPORT_CSV_BTN` | ✅ Exists — maps to `grpc-rpc-stats-export-csv-btn` (added in post-GA P1 quick win) |

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
