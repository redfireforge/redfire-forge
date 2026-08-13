# API Mock Studio - Product and Implementation Plan

> **Branch:** `feautre/apimock`
> **Status:** Phases 0-9, 10A-10C, 11 delivered; Studio UI/UX enhancement pass applied (mockup parity); Phase 12A (performance), 12B (accessibility), and 12C (recovery/reliability drills) delivered; 10D-10E deferred (Rust/Tauri); Phases 12D-12E available
> **Created:** 2026-08-11
> **Last updated:** 2026-08-11
> **Target:** RedfireForge web development runtime and Tauri desktop
> **Plan policy:** Update the phase tracker, contracts, UI descriptions, implementation notes, success criteria, dates, and commit hashes as each phase is implemented.

---

## 1. Product Summary

API Mock Studio is a GUI-first local HTTP mock server studio. It lets a user create, run, inspect, and share realistic REST API simulations without writing WireMock mappings, YAML, or programmatic setup.

Each studio tab is a complete, independently runnable **mock environment**:

- its own name, host, port, base path, TLS/CORS settings, and fallback behavior;
- its own route tree, match rules, responses, scenario state, variables, and transaction journal;
- independent Start, Stop, Restart, and hot-apply lifecycle;
- simultaneous execution with other tabs on different ports.

The design combines:

- Mockoon's approachable visual editing and multi-environment workflow;
- WireMock and MockServer's deterministic request matching, priority, scenarios, faults, and verification;
- Prism's OpenAPI-driven generation and validation;
- Beeceptor and Requestly's fast traffic inspection;
- RedfireForge's existing tabs, request editors, Catalog, environments, workflows, test runner, data mapper, and results tooling.

### 1.1 Product Position

API Mock Studio is not merely a JSON/YAML editor with form fields around it. The primary source of truth is a typed visual model. Import and export formats are interoperability surfaces, not the authoring experience.

### 1.2 Core Differentiator

The central differentiator is **explainable matching**. Every transaction records:

1. which routes were considered;
2. which predicates passed or failed;
3. whether the configured ambiguity policy rejected the candidates or selected a winner;
4. the priority, specificity, and tie-break evidence used by that policy;
5. which response variant and scenario transition ran;
6. why an unmatched request fell through, proxied, or returned the default response.

This addresses a persistent weakness in sophisticated mock tools: powerful rules are difficult to debug when a request unexpectedly misses.

---

## 2. Goals and Non-Goals

### 2.1 Goals

1. Configure mock servers entirely through a professional GUI.
2. Run multiple isolated servers concurrently, one per tab, on distinct ports.
3. Support exact, pattern, semantic, schema, and compound request matching.
4. Support static, templated, sequenced, probabilistic, stateful, proxy, and fault responses.
5. Import OpenAPI/Swagger and generate editable routes and examples.
6. Inspect and search complete request/response transactions with match explanations.
7. Persist definitions safely across web and Tauri environments.
8. Export portable, versioned definitions suitable for source control and CI.
9. Provide a headless CLI runner using the same contracts and matching engine.
10. Integrate with Requests, Catalog, Workflow Designer, Test Runner, and environments.
11. Create inactive rule drafts and simulation samples from cURL commands, Catalog endpoints, Requests items/collections, and captured transactions.
12. Detect definite and potential rule conflicts before Apply and explain the overlapping conditions.

### 2.2 Non-Goals for MVP

1. General-purpose forward/transparent system proxying.
2. Hosted public mock endpoints, cloud synchronization, or real-time collaboration.
3. Arbitrary JavaScript execution in matchers or templates.
4. GraphQL schema mocking, WebSocket mocking, or gRPC mocking inside this studio. Existing protocol studios remain authoritative.
5. Full service virtualization for SMTP, LDAP, raw TCP, or messaging protocols.
6. Distributed clustering or production-grade internet-facing deployment.
7. A visual OpenAPI authoring replacement for Catalog.

### 2.3 Capability Boundaries

Product goals describe the eventual studio; they do not imply every capability ships in the Phase 0-6 MVP. Definitions may carry capability metadata for later phases, but validators and UI must reject or clearly label configuration unsupported by the active runtime.

| Capability | Delivery boundary | MVP behavior |
|---|---|---|
| HTTP/1.1 listeners, exact/pattern matching, static/conditional responses, templates, latency, journal, imports, and simulation | Phases 1-6 | Required and fully usable. |
| Sequence, weighted selection, scenario state, match limits/expiry, socket faults, and chunk/dribble schedules | Phase 7 | Not active in MVP; mockups label these as later-phase capabilities. |
| Canonical JSON export/import | Phase 6 | Required for MVP. |
| YAML, CLI, CI verification, and WireMock export | Phase 8 | Deferred; WireMock import review remains Phase 6. |
| Proxy, recording, callbacks, transformations, and HAR | Phase 9 | Deferred and unavailable in MVP settings. |
| HTTPS, mTLS, and native Rust listener | Phase 10 | **HTTPS delivered** — the companion binds an `https` listener from user-supplied or generated PEM material. mTLS and the native Rust listener remain deferred. |
| Workflow/Test Runner lifecycle and call assertions | Phase 11 | Deferred integration over the stable runtime. |

“Unavailable” means the production UI does not present an apparently functional control. A design mockup may show a future capability only with an explicit phase label and disabled treatment.

---

## 3. Pre-Implementation Design Review

### 3.1 Decisions

This table summarizes the architectural choices that shaped the design. Section 14 is the authoritative Phase 0A decision register for adopted values, pending implementation choices, owners, and revisit phases; if wording differs, Section 14 controls and this summary must be corrected.

| Decision | Chosen approach | Why |
|---|---|---|
| Unit represented by a tab | One durable Mock Server | A port is server-level state; route-per-tab would make multi-server operation confusing. |
| Runtime topology | Port `3001` control plane plus independent data-plane listeners | User traffic must reach the requested port directly and must not share companion-server routes. |
| Runtime identity | `serverId`/tab ID, not port | Ports are editable and reusable; identity must survive port changes. |
| Rule updates | Validate, then atomically hot-commit a versioned snapshot | In-flight requests remain pinned to one generation; invalid drafts never corrupt a running server. |
| Matching policy | Per-server `highest_priority` or `reject_multiple`, with an explicit equal-priority tie policy | Supports strict ambiguity rejection and WireMock-style prioritized selection without hidden “last edited wins” behavior. |
| Authoring model | Typed GUI model with optional advanced JSON preview | Prevents invalid configurations while preserving portability and expert visibility. |
| Source conversion | Normalize cURL, Catalog, Requests, and journal inputs, then use one source-to-rule converter | Prevents each entry point from producing subtly different matcher semantics. |
| Conflict analysis | Conservative static analysis plus sample witnesses | Exact overlap can be proven for many operators; regex/schema intersections are not generally decidable and must be reported as potential conflicts. |
| Template engine | Restricted Handlebars-compatible expressions and curated helpers | Familiar syntax without arbitrary code execution. |
| Persistence | Lightweight tab shell plus IndexedDB/Tauri-backed definitions | Route bodies and journals can exceed localStorage limits. |
| Web support | Node companion listeners started through control APIs | Browsers cannot bind listening ports. Web UI remains usable when the companion server is running. |
| Tauri support | Phase 1 uses the companion runtime; native Rust listener is a later parity phase | One behaviorally correct engine is safer than implementing TypeScript and Rust engines simultaneously. |
| Protocol scope | HTTP/1.1 and HTTPS via the companion; mTLS and HTTP/2 later | TLS shipped because most target REST APIs are HTTPS. Client-certificate auth and HTTP/2 still change listener and fault behavior materially, so they stay deferred. |
| Tab limit | Eight open/running-capable Mock Servers | Matches protocol-studio conventions and limits sockets/polling; an empty workspace starts with zero and saved closed definitions are not capped. |

### 3.2 Rejected Alternatives

- **Reuse the Requests tabs as mock servers:** request tabs model outbound calls, not inbound server lifecycle or route collections.
- **Put all mocks under `localhost:3001/api/mock/*`:** this does not satisfy different ports and creates path/host behavior unlike the target service.
- **Use Express Router instances only:** routers do not own sockets, port conflicts, connection draining, or per-listener TLS.
- **Key runtime state by port:** changing a port would orphan state and logs; two tabs could accidentally control the same runtime.
- **Allow unrestricted scripts:** it creates remote-code-execution and portability risks. Advanced scripted behavior can be reconsidered only with a hardened sandbox.
- **Store live logs indefinitely:** bodies can contain secrets and consume large amounts of storage. The default journal is bounded and ephemeral.

### 3.3 Canonical Terminology

| Term | Frozen meaning |
|---|---|
| **Workspace** | Durable collection of saved mock-server definitions plus open-tab order and active-tab preference. It is not a running process. |
| **Mock Server** | User-facing name for one durable `ApiMockServerDefinitionV1`, represented by one tab when open and eligible to own one listener when running. Do not use “environment” as a second entity name. |
| **Route** | User-facing name for one persisted `ApiMockRouteV1`. It is also the matcher engine's rule; do not model a separate rule object. |
| **Response Variant** | One eligible response definition owned by a route. Static/conditional variants are MVP; sequence/weight/state eligibility is Phase 7. |
| **Draft Definition** | Editable server snapshot in the UI. It has no data-plane effect until a successful server-wide Apply. |
| **Committed Generation** | Immutable validated snapshot used by the runtime. In-flight requests remain pinned to the generation captured at acceptance. |
| **Runtime Instance** | Ephemeral listener, connections, timers, state/counters, sequence cursors, and journal owned by `ApiMockServerPool` for one `serverId`. |
| **Sample** | Durable server-owned request/example with an optional `routeId` association. It can test cross-route ambiguity; deleting a route clears the association after confirmation but preserves the sample. |
| **Transaction** | Bounded runtime observation of one accepted request and its outcome; never authoritative definition state. |
| **Conflict Finding** | Derived static-analysis evidence tied to rule fingerprints. It is recomputed, not treated as durable source-of-truth behavior. |

### 3.4 Ownership and Lifecycle Boundaries

| State | Owner | Persistence/lifecycle rule |
|---|---|---|
| Workspace, server definitions, folders, routes, variants, samples, variables, and settings | API Mock repository | Persist through the platform storage abstraction; schema-versioned and migrated without direct `localStorage`. |
| Open-tab order, active tab, dock mode, and compact UI preferences | Workspace UI store | Durable preference state; must tolerate missing/deleted definitions. |
| Unsaved edits and validation diagnostics | Active UI draft | Ephemeral until persisted; never mutate a running generation implicitly. |
| Listener, port reservation, generation, connections, timers, state/counters, sequence cursors, and journal | `ApiMockServerPool` runtime entry | Memory-owned and reconciled after refresh/restart; `running: true` is never trusted from storage. |
| Predicate evaluation, selection, conflict analysis, rendering preview, and redaction | Pure shared engine | Stateless inputs/outputs; no React, storage, sockets, clocks, or hidden global mutation. |
| Imported source payload and diagnostics | Import-review draft | Inactive until confirmation; raw secrets and referenced local files are not persisted/read automatically. |

Stable IDs are unique within one exported workspace. `serverId` owns runtime identity; ports are replaceable resources. A new workspace is empty and offers **Create Mock Server** and **Import**. Creating a server uses `Mock Server 1`, then the next numeric name, and requests an available auto port. Creating a route adds one enabled `200 Default` static response so the route contract is valid immediately. Apply is server-wide and commits all valid draft changes atomically.

### 3.5 Requirement-to-Phase Ownership

The primary phase owns acceptance for each requirement. Supporting phases may add UI/runtime adapters but cannot claim the requirement independently. Split requirements must remain capability-gated until every listed later-phase behavior exists.

| Requirement IDs | Primary owner | Supporting owner / boundary |
|---|---|---|
| AMS-001-003 | Phase 3 | Phase 2 owns listener concurrency; Phase 3 owns tabs and configuration. |
| AMS-004-007, AMS-009 | Phase 2 | Phase 1 supplies validation; Phase 3 displays lifecycle. |
| AMS-008 | Phase 3 | Phase 2 performs bounded stop. |
| AMS-010 | Phase 2 | Phase 3 reconciles and presents status. |
| AMS-020-027, AMS-030-033 | Phase 1 | Phase 3 supplies authoring UI. |
| AMS-028-029 | Phase 2 | Phase 1 defines deterministic HEAD/OPTIONS semantics. |
| AMS-034 | Phase 2 | Phase 1 selects ambiguity; Phase 3 configures/displays the response. |
| AMS-035 | Phase 1 for MVP auth metadata | mTLS attributes remain inactive until Phase 10. |
| AMS-036-039 | Phase 1 | Phase 3 owns toolbox/conflict UI and Apply gating. |
| AMS-040-042, AMS-044, AMS-051-052 | Phase 4 | Phase 2 emits the selected HTTP response. |
| AMS-043 | Phase 4 for default/conditional variants | Sequence, weight, and state eligibility remain inactive until Phase 7. |
| AMS-045-047, AMS-053 | Phase 7 | Contracts are capability-gated before Phase 7. |
| AMS-048-049 | Phase 9 | Unavailable in MVP. |
| AMS-050 | Phase 2 | Phase 3 owns fallback settings; closest-match diagnostics arrive in Phase 5. |
| AMS-054-063, AMS-065-067, AMS-069-073, AMS-087 | Phase 6 | AMS-063 canonical format is JSON in Phase 6; YAML follows in Phase 8. |
| AMS-064, AMS-068 | Phase 8 | WireMock export and headless CLI are post-MVP. |
| AMS-074-077 | Phase 1 engine | Phase 5 owns saved-sample and trace UX. |
| AMS-078-079 | Phase 5 | Phase 8 reuses assertions/traces in CLI. |
| AMS-080-082 | Phase 5 | Phase 2 captures bounded runtime events. |
| AMS-083 | Phase 11 | Phase 5 journal APIs and Phase 8 CLI verification are prerequisites. |
| AMS-084 | Phase 1 redaction engine | Phase 5 applies it to persistence/export. |
| AMS-085 | Phase 1 definition validation | Phases 2, 4, and 5 enforce runtime/body/response/journal limits. |
| AMS-086 | Phase 2 | Phase 3 owns warning, confirmation, and visible LAN badge. |

---

## 4. Competitive Research

Research was conducted from official product documentation available on 2026-08-11. Features and commercial packaging change; revalidate before implementation begins.

### 4.1 Product Matrix

| Product | Visual authoring | Matching depth | Dynamic/stateful behavior | Multi-server/local runtime | Import/record/proxy | Lesson for RedfireForge |
|---|---:|---:|---:|---:|---:|---|
| **WireMock OSS/Cloud** | Cloud editor; OSS primarily files/API/code | Excellent URL, headers, cookies, body, JSONPath/XPath, schema, priority | Templates, scenarios, delays, faults | Strong standalone/Docker model | Proxy, record/playback, OpenAPI ecosystem | Match depth and verification are table stakes; GUI must hide mapping complexity without reducing power. |
| **Mockoon** | Excellent desktop/web GUI | Route regex and response rules | Templates, Faker, variables, sequential/random responses, CRUD/data buckets | Multiple local environments in parallel | OpenAPI, proxy, recording, CLI/Docker | Closest UX benchmark; improve on it with explainable matching and RedfireForge workflow integration. |
| **MockServer** | Dashboard exists; API/code centric | Extremely broad: exact/regex, JSON/XML/schema/path, GraphQL, fuzzy, conditionals | Priority, TTL/times, probability, scenarios, sequences, faults, forward/fallback | Local, Docker, embedded | OpenAPI, proxy/forward, recording/verification | Use explicit ordering, rich predicates, lifecycle limits, and atomic rule updates; avoid exposing its complexity all at once. |
| **Postman Mock Servers** | Familiar examples-based GUI | Example request matching with configurable headers/body behavior | Dynamic variables, examples | Primarily hosted mock URLs | Deep collection/API integration | “Create mock from existing request/example” should be a one-click RedfireForge workflow. |
| **Stoplight Prism** | Visual design via Stoplight Studio | Contract/content negotiation driven | Generated examples and schema-based data | CLI/local or hosted | OpenAPI 2/3, Postman Collections, validation proxy | Add a spec-driven mode, but keep generated routes editable and clearly distinguish examples from schemas. |
| **Beeceptor** | No-code hosted GUI | Rule-based HTTP matching | Fake data and configurable responses | Hosted endpoint focused | OpenAPI, proxy/intercept, traffic inspection, tunnels | Fast endpoint creation and immediate logs are essential to onboarding. |
| **Requestly** | Strong GUI for rules/interception | URL and traffic-rule matching | Response rewrite, delay, scripts/rules | Browser extension and desktop proxy | HAR/sessions, interception, local/remote mapping | Separate mock-server authoring from interception; cross-link later rather than overloading MVP. |
| **mountebank** | Admin UI/API, configuration centric | Advanced predicates | Stubs, injection, behavior sequences | Multiple imposters/ports | Proxy recording; broad protocols | Its “imposter per port” model validates server-per-tab, but arbitrary injection is too risky for MVP. |
| **Hoverfly** | Web UI around simulation/proxy workflows | Destination/method/path/query/header/body matchers | Delays, middleware, simulation modes | Local service virtualization | Capture, simulate, synthesize, spy | Importing recorded traffic should produce reviewable drafts, not silently active rules. |
| **Microcks** | Rich web platform | Contract/example and dispatcher driven | Dynamic dispatch, async/event APIs | Container/Kubernetes platform | OpenAPI, AsyncAPI, Postman, SoapUI | Contract-first breadth is valuable later; do not duplicate existing Kafka/gRPC studios in the HTTP MVP. |
| **mitmproxy** | Interactive flow UI, addon-centric | Powerful flow filters | Rewrite, block, replay, scripting | Local proxy process | Deep capture/replay and interception | Treat full interception as a separate future product capability with different security boundaries. |

### 4.2 Capability Conclusions

#### MVP must include

- independent local servers and ports;
- route folders, search, enable/disable, duplicate, reorder;
- exact and pattern matching across method/path/query/headers/cookies/body;
- multiple response variants and deterministic precedence;
- static/conditional/templated response body, headers, status, cookies, and bounded delay;
- OpenAPI import;
- live request/response journal with match explanation;
- CORS and configurable unmatched behavior;
- canonical JSON import/export; the headless execution path follows in Phase 8.

#### Strong differentiators

- visual match debugger with near-miss explanations;
- safe atomic hot reload with generation tracking;
- transitions represented as a visible state machine rather than hidden strings;
- promotion from existing Catalog endpoints, Requests examples, and captured transactions;
- built-in “Try route” using RedfireForge Requests;
- deterministic seed for random/Faker data;
- versioned definitions with semantic diff and secret scanning.

#### Defer until the foundation is proven

- transparent proxy and certificate-authority installation;
- broad non-HTTP protocols;
- arbitrary scripts/plugins;
- cloud hosting/collaboration;
- AI-generated mocks;
- full mutable database simulation.

### 4.3 Research Sources

- WireMock stubbing and related feature documentation: <https://wiremock.org/docs/stubbing/>
- Mockoon feature catalog: <https://mockoon.com/features/>
- Mockoon multiple responses: <https://mockoon.com/docs/latest/route-responses/multiple-responses/>
- Mockoon templating: <https://mockoon.com/docs/latest/templating/overview/>
- Mockoon transaction logs: <https://mockoon.com/docs/latest/logging-and-recording/requests-logging/>
- MockServer expectations: <https://www.mock-server.com/mock_server/creating_expectations.html>
- Prism overview: <https://docs.stoplight.io/docs/prism/674b27b261c3c-prism-overview>
- Beeceptor documentation: <https://beeceptor.com/docs/>
- Requestly Interceptor documentation: <https://interceptor-docs.requestly.com/>
- mountebank repository and overview: <https://github.com/mountebank-testing/mountebank>
- mitmproxy features: <https://docs.mitmproxy.org/stable/overview/features/>
- Postman mock servers: <https://learning.postman.com/docs/design-apis/mock-apis/overview/>
- Hoverfly documentation: <https://docs.hoverfly.io/>
- Microcks documentation: <https://microcks.io/documentation/>

---

## 5. User Experience Specification

### 5.1 Navigation

Add **API Mock** to the existing Protocols sub-navigation in `AppSubNav`:

`Kafka | WebSocket | SSE | GraphQL | gRPC | API Mock`

Register `api-mock-studio` in `src/app/utils/appTabUtils.ts` and render `ApiMockStudioPage` from `src/app/App.tsx` using the same lazy-loading approach as other large studios.

### 5.2 Main Layout

```text
┌ API Mock Studio ───────────────────────────────────────────────────────────────┐
│ [Users API :4600 ●] [Payments :4601 ○] [+]                      Import  Export │
├────────────────────────────────────────────────────────────────────────────────┤
│ ● Running  http://127.0.0.1:4600  [Copy]  Generation 12  [Restart] [Stop] [⚙] │
├───────────────────┬────────────────────────────────────────────────────────────┤
│ Routes            │ GET /users/:id                              Enabled [on]   │
│ [Search routes]   │ Match | Response | Behavior | Examples | Documentation    │
│ + Route  + Folder ├────────────────────────────────────────────────────────────┤
│ ▾ Users           │ Method [GET]  Path [/users/:id]  Priority [10]            │
│   GET /users      │ Match all of:                                              │
│   GET /users/:id  │ [Path id] [regex] [[0-9]+]                                 │
│   POST /users     │ [Header]  [X-Tenant] [exact] [{{tenant}}]                  │
│ ▸ Errors          │ [+ Add condition]  [+ Add group]  [Test match]             │
│                   │                                                            │
│                   │ Response variants: [200 Default] [404 Missing] [+]         │
├───────────────────┴────────────────────────────────────────────────────────────┤
│ Transactions (24) | Conflicts (2) | State | Variables | Server console        │
│ 10:42:31 GET /users/42  200  23ms  GET /users/:id  [Explain match]            │
└────────────────────────────────────────────────────────────────────────────────┘
```

The **Import** menu provides: cURL command, RedfireForge definition, WireMock mappings, OpenAPI/Swagger, Catalog, and Requests. Source imports always open a review step and create inactive drafts until the user confirms the generated patterns, target server/folder, priority, response, and conflict findings.

### 5.3 Tab Behavior

Reuse the shared studio-tab utilities used by `RequestTabBar`, `WsConnectionTabBar`, and `GrpcTabBar`:

- rename with double-click/F2;
- drag reorder;
- duplicate;
- close, close others, close right;
- keyboard Left/Right/Home/End navigation;
- running dot and port in every tab;
- dirty-dot when draft differs from committed runtime generation;
- warning border for start failure or port conflict;
- confirmation through `ConfirmModal` when closing a running server;
- maximum eight open server tabs for v1.

When a tab is duplicated, it receives a new ID and the next available port. Runtime state, transaction logs, and secret values are not duplicated by default.

### 5.4 Server Bar

The server bar remains visible above all editor views:

- lifecycle dot and state: Stopped, Starting, Running, Applying, Draining, Error;
- editable host, port, and base path only while stopped;
- Copy URL;
- Start/Stop/Restart;
- Apply changes when running;
- generation number and dirty state;
- settings icon opening an `AppModalFrame` for MVP CORS, limits, fallback, logging, redaction, and ambiguity policies. TLS and proxy controls appear only when their capability phases land.

Automatic port allocation considers `4600-4699` in ascending order. A shared companion-process reservation registry tracks every active or starting API Mock/WebSocket/gRPC listener; the API Mock pool reserves a candidate under its lifecycle lock and immediately binds it, treating the bind as authoritative. The control port and OS-bound sockets are unavailable even if an earlier advisory probe succeeded. Exhaustion returns an actionable error without creating or mutating definition/runtime state. Manual ports may use `1024-65535` subject to the same atomic reservation and bind checks. `/api/mock/ports/probe` is advisory only and cannot promise a later Start will succeed.

### 5.5 Route Explorer

- folders and nested folders;
- text search across method, path, name, tags, and operation ID;
- method badges using `METHOD_COLORS` and existing `method-badge` conventions;
- enable/disable at route, folder, and response-variant level;
- drag reorder only as a visual organization tool; runtime order remains explicit and deterministic;
- badges for response count, match count, validation errors, and unmatched near misses;
- context actions: rename, duplicate, copy URL, send to Requests, disable, delete.

### 5.6 Route Editor

The editor is an unframed work surface, not a modal or nested card. Use compact tabs:

1. **Match** - method, path, priority, security/authentication, and boolean condition builder.
2. **Response** - variants, status, headers, cookies, body/file, content type.
3. **Behavior** - MVP delay/jitter controls plus phase-labeled capability summaries. Probability, repeat limits, sequence, state transitions, faults, and callbacks appear only in their owning phases.
4. **Examples** - saved request examples and one-click “Try in Requests.”
5. **Documentation** - summary, description, tags, operation ID, source spec link.

Use `KeyValueEditor` for query/header/cookie and response-header rows. Use Monaco for JSON/XML/text templates, with format, search, undo/redo, validation markers, and variable completion.

### 5.7 Matcher Builder

Conditions are shown as nested **ALL / ANY / NOT** groups. Each row uses:

`[source] [selector/key] [operator] [expected value] [options]`

The simple mode exposes common operators. An advanced drawer exposes schemas, JSONPath/XPath, multipart, and compound groups. A read-only JSON preview shows the portable contract but is not the default editor.

The **Simulate** action opens a dedicated `AppModalFrame` with:

- one or more named sample requests entered manually, imported from file, or selected from saved examples/journal entries;
- expected outcome assertions for selected route, response variant, status, and ambiguity result;
- all considered rules ordered by priority, with pass/fail/ignored state for every predicate;
- selected route/response or the exact ambiguity/no-match reason;
- rendered status, headers, cookies, body, delay/fault timeline, and near-miss ranking;
- deterministic seed, captured runtime generation, and exportable trace;
- no counters, scenario transitions, callbacks, logs, or network side effects unless a separately confirmed stateful simulation mode is enabled.

Simulation can run a single sample or a table of samples. Batch results show pass/fail against expected outcomes and remain reproducible in GUI, runtime conformance tests, and CLI.

#### Pattern Toolbox

Pattern-heavy fields expose a consistent toolbox beside the value editor rather than requiring users to remember syntax:

- operator chooser for exact, contains, prefix/suffix, template, glob, regex, semantic subset, JSONPath/XPath, and schema matching where valid;
- reusable pattern library adapted from `RegexPatternLibrary`, grouped by paths, identifiers, dates, tokens, headers, and common API formats;
- regex builder adapted from `RegexAssertionBuilderModal`, with flags, anchors, escaping, capture-group explanation, and live positive/negative sample tests;
- path-template builder that converts selected segments to named parameters and previews extracted values;
- query/header/cookie builder with key presence, repeated-value, case, exact-key-set, and negation controls;
- JSON tree/JSONPath picker and “Create matcher from sample body” action using the shared Data Mapper tree model;
- “Generalize sample” suggestions that mark likely dynamic values but never broaden an exact imported request without explicit user confirmation;
- immediate syntax, safety-limit, and sample-result feedback using the same shared predicate evaluator as runtime.

The toolbox is a reusable API Mock component family backed by pure shared utilities, not separate regex implementations in each field. Advanced controls use progressive disclosure; common exact/template matches remain one-row operations.

#### Rule Conflict Inspector

Conflict analysis runs incrementally after rule edits, imports, duplication, priority changes, and before Apply. It appears as:

- a conflict-count badge in the route explorer and bottom dock;
- inline warning/error markers on affected rules and conditions;
- a **Conflicts** dock view grouped as definite overlap, potential overlap, duplicate, shadowed, or unreachable;
- side-by-side condition comparison, policy/priority outcome, and a generated witness request when one can be constructed;
- actions to simulate the witness, adjust priority, add a distinguishing condition, disable a duplicate, or acknowledge a deliberate overlap.

The analyzer must distinguish proof from uncertainty. Exact/template/glob and compatible finite-value constraints can often produce a definite overlap. Arbitrary regex, JSONPath, XPath, and schema combinations may only produce a potential conflict with the unresolved dimensions listed. Acknowledgements are tied to both rule fingerprints and become stale after either rule changes.

### 5.8 Response Variants

Every route has at least one response. Variants support:

- default or condition-selected variants in MVP; sequence, weighted random, and state-gated selection in Phase 7;
- status and optional reason phrase;
- repeated headers and cookies;
- inline text/JSON/XML/HTML/form/binary-base64 body;
- local file body in Tauri/headless runtime;
- template preview against a sample request;
- fixed delay, uniform jitter, bounded distribution, or a configurable long-running response up to server safety limits;
- abrupt close, reset, timeout/no response, malformed body, or chunked/dribble response in later phases.

The UI must make mutually exclusive modes explicit. For example, sequential and weighted-random selection cannot both be active.

### 5.9 Transaction Journal

The bottom dock follows existing console patterns and supports docked/floating/maximized modes. Views:

- **Transactions** - filterable list with method, path, status, duration, matched route, proxied/unmatched indicator;
- **State** - current scenario states and counters with reset controls;
- **Variables** - server/workspace variables with redacted secrets;
- **Server console** - lifecycle, bind, validation, and runtime errors.

Selecting a transaction opens request, response, timeline, and **Match explanation**. Content views include search with match count/navigation, pretty JSON, copy, save as route, and replay in Requests.

### 5.10 Responsive Behavior

- Desktop >= 1200px: route tree, editor, and bottom dock visible.
- Tablet 768-1199px: collapsible route tree; editor remains primary.
- Narrow < 768px: route tree becomes a drawer; server bar wraps into two rows; no text overlaps or viewport-scaled fonts.
- Fixed controls use stable dimensions; tabs scroll horizontally.

### 5.11 Visual System

- Use `var(--bg)`, `var(--surface)`, `var(--surface-hover)`, `var(--border)`, `var(--text)`, `var(--text-muted)`, and `var(--primary)` exclusively for theme surfaces.
- Use `builder-tabs`, `builder-tab`, and `builder-tab-content` for internal editor tabs where compatible.
- Use two-tone form rows from `.cursor/rules/ui-design-system.mdc` for server settings.
- Use `AppModalFrame` for non-workflow dialogs with the canonical transparent overlay and four-edge treatment.
- Use Lucide icons through the project's installed icon approach; icon-only actions require tooltips and `aria-label`.
- Add all interactive test IDs to `src/shared/selectors/apiMock.ts`; do not inline selector strings in demos/E2E tests.

### 5.12 Approved Interactive Mockup Catalog

On 2026-08-11, the user approved the **scope and visual direction** for a full eight-screen catalog using a refined RedfireForge style. This approval selected what to design; it is not final acceptance of unfinished screens. Phase 0G records final approval only after all eight screens and validation evidence are complete.

Create the catalog under `docs/plan/future/apimock/mockups/`:

| File | Focus | Key interactions |
|---|---|---|
| `01-main-studio.html` | Multi-server shell and rule workspace | Switch server tabs, select rules, change editor tabs, start/stop, open import menu. |
| `02-pattern-toolbox.html` | Matcher and reusable pattern authoring | Switch matcher types, choose library patterns, test positive/negative samples, generalize paths. |
| `03-response-behavior.html` | Response variants and behavior | Switch variants, edit status/body/cookies, select delay/fault/sequence modes, preview output. |
| `04-simulation-trace.html` | Side-effect-free sample simulation | Select samples, run batch, inspect candidates/predicates, view rendered response and trace. |
| `05-conflict-inspector.html` | Proactive rule conflict analysis | Filter finding types, compare rules, inspect witness, simulate, acknowledge, or apply suggested fixes. |
| `06-import-promotion.html` | cURL/OpenAPI/Catalog/Requests import review | Change source, paste/select input, generalize values, choose destination/defaults, review diagnostics/conflicts. |
| `07-runtime-journal-settings.html` | Runtime lifecycle, transactions, state, and settings | Switch journal views, inspect transactions, edit server policy/limits, reconcile runtime status. |
| `08-responsive-layouts.html` | Tablet and mobile behavior | Toggle tablet/mobile frames, open route drawer, verify wrapped server controls and horizontal tabs. |

Also create `index.html`, `shared.css`, and `mockup-shared.js` for catalog navigation, shared tokens/components, and reusable interactions. Every screen must work by opening its HTML file directly, provide links to the other screens, avoid nested cards, and maintain stable dimensions without overlap at its documented viewport.

Current catalog readiness:

| Artifact | Status | Remaining Phase 0 work |
|---|---|---|
| Shared index, CSS, and interaction script | Complete | Link/accessibility audit in 0F. |
| `01-main-studio.html` through `04-simulation-trace.html` | Complete | Ports corrected to 4600+ range. Lifecycle/error/ambiguity states present. Phase 0F validates keyboard and screenshots. |
| `05-conflict-inspector.html` | Complete | Definite/potential/duplicate findings, dimension analysis, policy outcome, witness, acknowledge, stale-acknowledgement, and severity states. |
| `06-import-promotion.html` | Complete | cURL source with diagnostics, exact-by-default generalization, destination/folder/priority, merge/replace/copy mode, generated sample, conflict analysis, and inactive-draft confirmation. |
| `07-runtime-journal-settings.html` | Complete | Transaction journal with match explanation, request/response detail, near misses, redacted headers, state/variables/settings/console tabs, CORS/limits/journal/redaction/fallback/LAN configuration. |
| `08-responsive-layouts.html` | Complete | Tablet/mobile device frame with route drawer, wrapped server bar, compact controls, and dock. |
| Chrome screenshots and validation record | Complete | 24 screenshots (8 screens × 3 viewports) captured via Playwright Chromium. `VALIDATION_RECORD.md` documents all results. |

### 5.13 Keyboard and Accessibility Contract

Phase 0 freezes interaction behavior; Phase 3 implements it. Mockups must use semantic roles and expose enough behavior to validate the contract.

| Context | Keys | Required behavior |
|---|---|---|
| Server tabs | Left/Right, Home/End, Enter/Space | Roving focus, activate the focused tab, and scroll it into view without changing tab order. |
| Route/folder tree | Up/Down, Left/Right, Home/End, Enter/Space, F2 | Navigate visible nodes, collapse/expand folders, select routes, and rename without trapping focus. |
| Builder tabs | Left/Right, Home/End | Follow the ARIA tabs pattern with `tablist`, `tab`, `tabpanel`, `aria-selected`, and roving `tabIndex`. |
| Matcher groups and repeated rows | Tab/Shift+Tab, Alt+Up/Down, Delete | Reach every control, reorder through an explicit command, and require confirmation where deletion loses configured data. |
| Modal/drawer | Escape | Close the topmost surface and restore focus to the opening control. Focus remains contained while a modal is open. |
| Simulation | Mod+Enter | Run the selected sample or batch without triggering runtime side effects. |
| Searchable content | Mod+F, Enter, Shift+Enter | Focus local search and move to next/previous match without invoking browser search. |

All icon-only buttons require a visible tooltip and accessible name. Dynamic lifecycle, Apply, import, simulation, and conflict outcomes use an appropriately scoped live region. Conflict announcements state certainty, affected rule names, and whether Apply is blocked without reading secret predicate values. Focus indicators use `var(--primary)` and remain visible at 200% zoom.

Modal mockups model the behavior of `AppModalFrame`; use `StandardProfessionalModal` when its movable, resizable, viewport-constrained defaults fit the final product surface. API Mock dialogs keep the canonical transparent overlay and four-edge treatment, close with Escape, and follow the repository footer/header policy chosen for the owning shared component rather than duplicating modal mechanics.

---

## 6. Functional Requirements

### 6.1 Server and Tabs

| ID | Requirement |
|---|---|
| AMS-001 | A user can create, rename, duplicate, reorder, and close mock-server tabs. |
| AMS-002 | Each tab owns a stable UUID and independently configurable host, port, and base path. |
| AMS-003 | At least eight servers can be configured and multiple servers can run concurrently on different ports. |
| AMS-004 | Start validates the complete committed definition and port availability before reporting Running. |
| AMS-005 | Applying changes atomically swaps the ruleset and increments a generation number. |
| AMS-006 | In-flight requests finish against the generation captured when request handling began. |
| AMS-007 | Stop drains active requests for a bounded interval, then closes remaining connections. |
| AMS-008 | Closing a running tab requires confirmation and stops its listener. |
| AMS-009 | Companion process shutdown stops all API Mock listeners. |
| AMS-010 | Runtime status reconciles after refresh, companion restart, or lost control-plane connectivity. |

### 6.2 Route Matching

| ID | Requirement |
|---|---|
| AMS-020 | Match HTTP methods including ANY, GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS, and TRACE. |
| AMS-021 | Match path by exact value, parameter template, wildcard/glob, or regular expression. |
| AMS-022 | Match query, header, and cookie keys/values using exact, regex, contains, absent/present, and negation operators. |
| AMS-023 | Match bodies as exact text, regex, semantic JSON strict/subset, JSONPath, JSON Schema, XML semantic, XPath, form fields, multipart metadata/content, or binary hash. |
| AMS-024 | Combine predicates with nested ALL, ANY, and NOT groups. |
| AMS-025 | Support case sensitivity and URL-decoding options only where semantically valid. |
| AMS-026 | Validate regular expressions and schemas before commit. |
| AMS-027 | Rank and display near misses when no route matches. |
| AMS-028 | HEAD uses GET-compatible matching when configured but omits the response body. |
| AMS-029 | OPTIONS can use explicit routes or automatic CORS preflight handling. |
| AMS-030 | Match evaluation is deterministic across UI, companion server, CLI, and future native runtime. |
| AMS-031 | Each server can contain multiple enabled route rules, and each rule has an explicit integer priority. |
| AMS-032 | Configure each server to either reject any request matching multiple rules or choose the highest-priority matching rule. |
| AMS-033 | Configure equal-highest-priority handling independently: reject as ambiguous or resolve by displayed specificity and stable ID ordering. |
| AMS-034 | An ambiguity rejection returns a configurable status, headers, and body and records every competing rule in the explanation. |
| AMS-035 | Match security/authentication by scheme and safe attributes, including no auth, Basic username, Bearer token claim/pattern, API-key location/name/value, and mTLS client-certificate attributes when supported. Secret matcher values use protected variable references and are redacted from traces. |
| AMS-036 | Provide reusable pattern tools for path templates, globs, regex, query/header/cookie constraints, JSONPath/XPath, and schema-backed body matching. |
| AMS-037 | Analyze all enabled draft rules for overlap after relevant edits/imports and before Apply without requiring a listener to run. |
| AMS-038 | Classify findings as definite overlap, potential overlap, exact duplicate, shadowed, or unreachable and identify the intersecting or uncertain conditions. |
| AMS-039 | Show the priority and configured ambiguity-policy outcome for each finding, generate a witness request when possible, and let users simulate it before Apply. Deliberate overlaps can be fingerprint-acknowledged; strict lint mode can block Apply on configured severities. |

### 6.3 Responses and Behavior

| ID | Requirement |
|---|---|
| AMS-040 | Return configurable status, headers, cookies, and body. |
| AMS-041 | Render restricted templates from path/query/header/cookie/body/state/variable context. |
| AMS-042 | Provide deterministic Faker/random helpers when a seed is configured. |
| AMS-043 | Select response variants by conditions, sequence, weight, scenario state, or default. |
| AMS-044 | Simulate fixed latency and bounded jitter. |
| AMS-045 | Limit a route or variant by match count and optional expiry time. |
| AMS-046 | Inject timeout, connection close/reset, malformed, and throttled/chunked response faults by capability phase. |
| AMS-047 | Transition named scenario state only after the response action is successfully selected. |
| AMS-048 | Invoke an outbound callback/webhook under the shared server outbound URL security policy. |
| AMS-049 | Proxy unmatched requests to an allowlisted upstream in the proxy phase. |
| AMS-050 | Apply a configurable default response when no route matches and proxying is disabled. |
| AMS-051 | Model long-running responses separately from no-response timeout faults, with duration/cancellation limits and visible timing behavior. |
| AMS-052 | Configure response cookies with name, value, domain, path, expiry/max-age, Secure, HttpOnly, and SameSite attributes. |
| AMS-053 | Stream or dribble response chunks according to an explicit schedule without buffering an unbounded body. |

### 6.4 Import, Export, and Integration

| ID | Requirement |
|---|---|
| AMS-054 | Import a pasted multiline cURL command into an inactive rule draft and sample request, preserving supported method, URL/path, query, headers, cookies, authentication, body, form, and content-type semantics. |
| AMS-055 | Show cURL parse diagnostics for ignored/unsupported flags, redirects, files, certificates, and secret-bearing values; never read referenced local files or persist raw secrets automatically. |
| AMS-056 | Review cURL-derived exact values and explicitly generalize selected path segments, query values, headers, or body fields into patterns before activation. |
| AMS-057 | Promote one or many Catalog endpoints and Requests items/folders/collections into a selected API Mock server/folder with source attribution, generated samples, and configurable default responses. |
| AMS-058 | Use one canonical normalized-request-to-rule conversion pipeline for cURL, Catalog, Requests, and journal sources so equivalent inputs create equivalent predicates. |
| AMS-059 | Run validation and conflict analysis during every source-import review and show the semantic diff before adding or replacing rules. |
| AMS-060 | Import Swagger 2.0 and OpenAPI 3.x JSON/YAML through `parseOpenApiSpec`. |
| AMS-061 | Generate route drafts from operations, examples, defaults, and schemas without silently activating them. |
| AMS-062 | Show import warnings and a reviewable diff before replacing or merging routes. |
| AMS-063 | Export a versioned RedfireForge JSON/YAML definition with stable IDs and deterministic ordering. |
| AMS-064 | Export a compatibility subset to WireMock mappings with a loss report. |
| AMS-065 | Promote a Catalog endpoint, Request example, or journal transaction into a mock route. |
| AMS-066 | Open a mock route or captured transaction in Requests for replay. |
| AMS-067 | Resolve `{{variable}}` values from tab, environment, and workspace scopes with documented precedence. |
| AMS-068 | Headless CLI starts one or more exported definitions and emits machine-readable readiness/status. |
| AMS-069 | Import and export a whole workspace, one server, or selected rules and examples without losing stable IDs, priorities, ambiguity policies, or sample expectations. |
| AMS-070 | Validate schema version, references, limits, duplicate IDs, port conflicts, and unsupported capabilities before import activation. |
| AMS-071 | Offer merge, replace, and import-as-copy modes with a semantic preview and explicit conflict choices. |
| AMS-072 | Migrate older native schemas through pure versioned migrations and report all defaults, transformations, warnings, and losses. |
| AMS-073 | Import the supported WireMock mapping subset as inactive drafts and report unsupported or behaviorally different fields before activation. |

### 6.5 Rule Simulation

| ID | Requirement |
|---|---|
| AMS-074 | Save named sample requests at server or rule scope, including method, URL/path, query, headers, cookies, authentication metadata, and body. |
| AMS-075 | Simulate one sample or a batch against the draft or committed generation without opening a listener. |
| AMS-076 | Produce a structured trace containing normalized input, candidate rules, priority, predicate results, specificity breakdown, ambiguity decision, selected response, and rendered output/timing. |
| AMS-077 | Simulation is side-effect-free by default: it does not mutate counters/state, consume sequences, invoke callbacks, write journals, proxy, wait for delays, or emit socket faults. |
| AMS-078 | Allow samples to assert the expected selected rule/variant, ambiguity/no-match result, status, headers, and body so they can become reusable regression cases. |
| AMS-079 | Export/import samples and traces with secret redaction and replay them through the same matcher conformance engine in GUI and CLI. |

### 6.6 Journal, Verification, and Safety

| ID | Requirement |
|---|---|
| AMS-080 | Record bounded request/response transactions with route, variant, generation, timing, and match explanation. |
| AMS-081 | Search/filter journal entries and inspect pretty request/response content. |
| AMS-082 | Clear, export, and optionally persist journals; persistence is off by default. |
| AMS-083 | Verify call count and last-call time per route/variant for Test Runner and Workflow assertions. |
| AMS-084 | Redact known-sensitive headers and configured JSON paths before disk export/persistence. |
| AMS-085 | Enforce body, header, route, rule, log, and concurrent-connection limits. |
| AMS-086 | Bind to loopback by default and require an explicit warning/confirmation for LAN binding. |
| AMS-087 | Never execute imported scripts or read imported absolute file paths automatically. |

---

## 7. Matcher and Selection Semantics

### 7.1 Matcher Support Matrix

| Source | MVP operators | Advanced operators |
|---|---|---|
| Method | exact, ANY | GET-or-HEAD |
| Path | exact, `:param`/`{param}`, glob, regex | decoded/raw comparison |
| Query | exact, contains, regex, present, absent, negated | subset vs exact-key-set |
| Headers | exact, case-insensitive exact, contains, regex, present, absent | media-type/Accept negotiation |
| Cookies | exact, contains, regex, present, absent | signed-cookie validation |
| Text body | exact, contains, regex | fuzzy similarity |
| JSON body | semantic strict/subset, JSONPath exists/equality, JSON Schema | placeholders/type predicates |
| XML body | semantic exact, XPath | XML Schema, placeholders |
| Form body | field exact/regex/present | exact-key-set |
| Multipart | field/file name, filename, content type | content regex/hash/schema |
| Binary | exact base64, SHA-256 | byte-range predicates |
| Transport | HTTP/HTTPS | HTTP version, client certificate attributes |

### 7.2 Deterministic Route Selection

1. Filter to enabled routes whose base path and method can match.
2. Evaluate the complete predicate tree without side effects.
3. If multiple rules matched and `multipleMatchPolicy` is `reject_multiple`, return the configured ambiguity response and do not select or mutate any rule.
4. Otherwise retain only candidates with the highest explicit `priority`.
5. If more than one highest-priority candidate remains and `equalPriorityPolicy` is `reject`, return the configured ambiguity response.
6. If tie resolution is enabled, sort tied candidates by higher computed specificity and then lexical stable route ID; do not use mutable list position or edit time.
7. Within the winning route, select an eligible response variant by its declared mode.
8. Capture the immutable runtime generation and scenario-state snapshot.
9. Render response and execute the state transition/counter update atomically.
10. Record all candidates, policy decisions, priority/specificity evidence, and timing.

Specificity is computed from documented integer weights, not hidden machine learning. Exact method/path and exact key/value matches score higher than templates, globs, and regex. The UI displays the score breakdown.

Ambiguity rejection is distinct from no-match behavior. Its response defaults to JSON `409 Conflict`, includes a request ID but no sensitive predicate values, and can be configured per server. Rejected ambiguity never advances sequences, counters, scenario state, or match limits.

### 7.3 No-Match Behavior

Configured per server:

- `default_response` - MVP behavior returning configured status/headers/body, defaulting to sanitized JSON 404;
- `closest_match_debug` - Phase 5 non-production response containing sanitized near-miss details;
- `drop` - Phase 7 explicit-danger socket fault;
- `proxy` - Phase 9 allowlisted forwarding behavior.

### 7.4 Conflict Proof Algorithms

Phase 0A adopted "definite only with proof; otherwise Potential." This section formalizes the proof rules per operator category that Phase 1 implements.

**Decidable overlap (→ Definite):** Two predicates on the same source/selector produce a provable overlap when:

| Operator category | Proof rule | Example |
|---|---|---|
| Exact vs exact | Values are identical (case-adjusted per source) | `header X-Tenant exact "acme"` vs `header X-Tenant exact "acme"` → definite overlap |
| Case-insensitive exact vs exact | Lowercase comparison: `"Acme".toLowerCase() === "acme"` → definite | `header Accept exact "Text/HTML"` vs `header Accept case-insensitive "text/html"` → definite |
| Exact vs contains/prefix/suffix | The exact value satisfies the substring/prefix/suffix | `query q exact "hello-world"` vs `query q contains "hello"` → definite overlap |
| Negated vs non-negated | A negated predicate matches the complement. Exact A vs negated-exact A → disjoint (mutually exclusive). Negated A vs negated A → definite. Contains A vs negated-contains B with A≠B → potential (depends on values). | `query q exact "x" NEGATED` vs `query q exact "x"` → disjoint |
| Present vs any non-absent | Present matches any request that has the key, which every exact/contains/regex predicate also requires | `header X-Key present` vs `header X-Key exact "abc"` → definite overlap (right implies left) |
| Absent vs absent | Both require the same key missing → definite overlap | — |
| Present vs absent | Same key: mutually exclusive → disjoint | — |
| Template path vs exact path | Template `:id` matches the exact literal `42` → definite (every exact value is a valid parameter) | `/users/:id` vs `/users/42` → definite |
| Glob vs exact | The glob pattern matches the exact value | `/api/*/health` vs `/api/v1/health` → definite |
| Form field exact/regex/present | Same rules as query/header: exact vs exact = identical check; regex vs exact = evaluate; present vs absent = disjoint | `form field "name" exact "alice"` vs `form field "name" exact "alice"` → definite |
| Multipart field/file name | Same rules as header present/absent: field name present vs same name present → definite; different names → independent dimensions | — |
| Binary exact/SHA-256 | Exact base64 vs exact base64: identical byte comparison → definite or disjoint. SHA-256 vs SHA-256: identical hash → definite. Different hashes → disjoint. | — |

**Undecidable intersection (→ Potential):** Two predicates overlap only if their value sets intersect, which is not computable for:

| Operator category | Why undecidable | Classification |
|---|---|---|
| Regex vs regex | Regex intersection is undecidable in general | Potential with unresolved `regex` dimension |
| Regex vs exact | Testable: evaluate the regex against the exact value. If it matches → definite; if not → disjoint | Definite or disjoint (not potential) |
| Regex vs contains/glob | Not generally decidable | Potential |
| JSONPath vs JSONPath | Path existence depends on runtime document shape | Potential with unresolved `jsonPath` dimension |
| JSON Schema vs JSON Schema | Schema intersection is undecidable | Potential with unresolved `jsonSchema` dimension |
| JSON Schema vs JSONPath | Schema acceptance vs path existence cannot be related statically | Potential |
| JSONPath vs exact body | Path extraction depends on document structure | Potential |
| XPath vs XPath | Same reasoning as JSONPath | Potential |
| XML Schema vs anything | Schema acceptance is undecidable in general | Potential |
| Form field vs JSON body | Different body interpretations cannot overlap | Disjoint |
| Multipart vs JSON/text/form body | Different content-type interpretations → disjoint | Disjoint |
| Binary vs text/JSON/form body | Different content-type interpretations → disjoint | Disjoint |
| Transport HTTP vs HTTPS | Same value → overlap; different → disjoint | Definite or disjoint |

**Composite rule:** Two routes conflict only if every source dimension either overlaps or is unresolved. If any dimension is provably disjoint, the finding is suppressed. A finding with at least one unresolved dimension is Potential; a finding where every dimension is proven overlapping is Definite.

**Duplicate detection:** Two routes are duplicates when method, path (kind + value), and every predicate in both trees are structurally identical after canonicalization. Duplicates are always Definite with severity `error`.

**Shadowed/unreachable detection:** Route B is shadowed by Route A when A has higher priority and A's predicates are a superset of B's (every request matching B also matches A). Unreachable is a stronger form where B can never win under any policy.

### 7.5 Conflict Severity and Apply-Gate Defaults

| Finding kind | Default severity | Warn mode | Strict mode |
|---|---|---|---|
| `duplicate` | `error` | Summary shown; Apply permitted | Apply blocked |
| `definite_overlap` | `warning` | Summary shown; Apply permitted | Apply blocked |
| `potential_overlap` | `info` | Summary shown; Apply permitted | Apply permitted (info never blocks) |
| `shadowed` | `warning` | Summary shown; Apply permitted | Apply blocked |
| `unreachable` | `error` | Summary shown; Apply permitted | Apply blocked |

Acknowledged findings (valid fingerprints) downgrade to `info` in both modes. Stale acknowledgements revert to the original severity.

### 7.6 Variable Resolution Walkthrough

Variables resolve in three scopes with inner-overrides-outer precedence:

1. **Mock-server/tab scope** (highest priority) — variables defined in `ApiMockServerDefinitionV1.variables`
2. **Environment scope** — the currently selected RedfireForge environment
3. **Workspace scope** (lowest priority) — future workspace-level variable store

**Worked example:**

```
Workspace variables:  { baseUrl: "https://prod.example.com", timeout: "5000" }
Environment variables: { baseUrl: "https://staging.example.com", apiKey: "env-key-123" }
Server variables:     { apiKey: "server-key-456", tenant: "acme" }

Resolution:
  {{baseUrl}}  → "https://staging.example.com"  (environment overrides workspace)
  {{apiKey}}   → "server-key-456"               (server overrides environment)
  {{tenant}}   → "acme"                         (only in server)
  {{timeout}}  → "5000"                         (only in workspace)
  {{unknown}}  → unresolved                     (diagnostic: AMS-SCHEMA-MISSING-FIELD)
```

Missing variables produce an explicit unresolved diagnostic. Templates render the literal `{{unknown}}` without silently substituting an empty string. Simulation traces record the resolution source for each variable.

### 7.7 Import Merge/Replace/Copy Decision Tree

When importing routes into a server that already has routes, the user chooses one of three modes. **Merge/replace/copy applies to all import sources**: cURL (W14), OpenAPI (W15), Catalog/Requests (W16), and native/WireMock (W17). For single-item imports like cURL, the default is merge (add if new, skip if ID exists). The import review UI always shows the mode selector when at least one route ID in the import already exists in the target server.

```
Import N routes into server "Users API"
├─ Merge (default)
│  ├─ For each imported route:
│  │  ├─ ID exists in target? → Skip (keep existing) and report "skipped: ID exists"
│  │  └─ ID is new? → Add as inactive draft
│  ├─ Samples: same ID logic (skip existing, add new)
│  └─ Settings: not changed
│
├─ Replace
│  ├─ For each imported route:
│  │  ├─ ID exists in target? → Overwrite with imported version
│  │  └─ ID is new? → Add as inactive draft
│  ├─ Existing routes not in import: unchanged
│  ├─ Samples: same ID logic (overwrite existing, add new)
│  └─ Settings: optionally replaced if import includes settings
│
└─ Import-as-copy
   ├─ All imported routes receive new UUIDs
   ├─ All imported samples receive new UUIDs, routeId remapped
   ├─ No ID collision possible
   └─ All added as inactive drafts
```

**Before/after example — Merge mode:**

Before import, server has:
- `route-001` GET /users (enabled, priority 10)
- `route-002` POST /users (enabled, priority 10)

Import file contains:
- `route-001` GET /users (different response body)
- `route-003` DELETE /users/:id (priority 20)

After merge:
- `route-001` GET /users → **unchanged** (skipped, ID exists)
- `route-002` POST /users → unchanged
- `route-003` DELETE /users/:id → **added as inactive draft**
- Diagnostic: `AMS-IMPORT-LOSS` for `route-001` — "Skipped: route with ID route-001 already exists in target"

**Before/after example — Replace mode:**

After replace with the same import:
- `route-001` GET /users → **replaced** with imported version (different response body)
- `route-002` POST /users → unchanged
- `route-003` DELETE /users/:id → **added as inactive draft**

Conflict analysis runs on the result in all modes. The semantic diff preview shows which routes will be added, skipped, or replaced before confirmation.

### 7.8 Redaction Transformation Worked Example

Given a captured request with these headers:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret-payload
Cookie: session=abc123; tracking=xyz789
X-API-Key: sk-live-real-secret-key
X-Request-Id: req-42
Content-Type: application/json
```

And redaction settings:
```json
{
  "headerNames": ["authorization", "cookie", "x-api-key"],
  "jsonPaths": ["$.password"],
  "preserveScheme": true
}
```

**After redaction:**

```
Authorization: Bearer [REDACTED]
Cookie: [REDACTED]
X-API-Key: [REDACTED]
X-Request-Id: req-42
Content-Type: application/json
```

Notes:
- `Authorization` preserves the scheme `Bearer` because `preserveScheme: true`
- `Cookie` is fully redacted (no scheme to preserve)
- `X-API-Key` is fully redacted
- `X-Request-Id` is not in the redaction list → unchanged
- If the request body were `{"user": "alice", "password": "secret123"}`, the exported body would be `{"user": "alice", "password": "[REDACTED]"}` due to the `$.password` JSONPath

Variable values with `sensitive: true` are independently redacted to `[REDACTED]` in exports with `_exportMeta.redacted: true`, regardless of the header redaction list.

### 7.9 Conformance-Corpus Schema

The conformance corpus is a collection of seed cases that Phase 1 converts into executable tests. Each case is a JSON object conforming to this schema:

```typescript
interface ApiMockConformanceCaseV1 {
  id: string;
  description: string;
  category: 'match' | 'no-match' | 'ambiguity' | 'conflict' | 'validation' | 'redaction';
  server: {
    settings: Partial<ApiMockServerSettingsV1>;
    routes: ApiMockRouteV1[];
  };
  request: ApiMockCapturedRequestV1;
  expected: {
    outcome: ApiMockTransactionOutcome;
    matchedRouteId?: string;
    matchedResponseId?: string;
    status?: number;
    candidateCount?: number;
    nearMissCount?: number;
    diagnosticCodes?: string[];
    conflictKinds?: ApiMockConflictFindingV1['kind'][];
  };
}
```

Seed cases are stored as `docs/plan/future/apimock/fixtures/conformance-seed-*.json`. Each file is an array of `ApiMockConformanceCaseV1` objects. Phase 1 expands these into the full executable operator corpus.

---

## 8. Core Contracts

These are the **Phase 0B frozen planning contracts**. Every `ApiMock*V1` type is complete, capability-gated, and free of persisted `any`/`unknown`. During implementation, move canonical types to `src/shared/api-mock/contracts.ts` and update this section and fixtures to match actual code.

### 8.0 Shared Enums and Primitives

```typescript
type ApiMockMethod =
  | 'ANY' | 'GET' | 'HEAD' | 'POST' | 'PUT'
  | 'PATCH' | 'DELETE' | 'OPTIONS' | 'TRACE';

type ApiMockPredicateOperator =
  | 'exact' | 'contains' | 'prefix' | 'suffix'
  | 'regex' | 'glob'
  | 'present' | 'absent'
  | 'jsonPath_exists' | 'jsonPath_equals'
  | 'jsonSchema'
  | 'json_strict' | 'json_subset'
  | 'xpath_exists' | 'xpath_equals'
  | 'xmlSchema'
  | 'form_field_exact' | 'form_field_regex' | 'form_field_present'
  | 'multipart_field' | 'multipart_file'
  | 'binary_exact' | 'binary_sha256';

type ApiMockResponseMode = 'rules' | 'sequence' | 'weighted' | 'state';

type ApiMockServerState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'applying'
  | 'draining'
  | 'error';

type ApiMockPathMatcherKind = 'exact' | 'parameterized' | 'glob' | 'regex';

type ApiMockResponseBodyKind =
  | 'none' | 'text' | 'json' | 'xml' | 'html'
  | 'form' | 'binary_base64' | 'file';

type ApiMockFaultKind =
  | 'none' | 'timeout' | 'close' | 'reset' | 'malformed' | 'dribble';

type ApiMockTransactionOutcome =
  | 'matched' | 'ambiguous' | 'unmatched' | 'fault' | 'error';
```

`ApiMockFaultKind` values other than `'none'` are capability-gated to Phase 7. `ApiMockResponseMode` values other than `'rules'` are capability-gated to Phase 7. MVP validators must reject persisted definitions using gated values with diagnostic code `AMS-CAPABILITY-GATED`.

### 8.1 Core Definition Types

```typescript
interface ApiMockWorkspaceV1 {
  schemaVersion: 1;
  activeServerId?: string;
  servers: ApiMockServerDefinitionV1[];
  tabOrder: string[];
}

interface ApiMockServerDefinitionV1 {
  id: string;
  name: string;
  enabled: boolean;
  host: '127.0.0.1' | 'localhost' | '0.0.0.0';
  port: number;
  basePath: string;
  folders: ApiMockRouteFolderV1[];
  routes: ApiMockRouteV1[];
  samples: ApiMockSimulationSampleV1[];
  variables: ApiMockVariableV1[];
  settings: ApiMockServerSettingsV1;
  source?: ApiMockImportSourceV1;
  createdAt: string;
  updatedAt: string;
}

interface ApiMockRouteFolderV1 {
  id: string;
  parentId?: string;
  name: string;
  expanded: boolean;
  sortOrder: number;
}

interface ApiMockRouteV1 {
  id: string;
  folderId?: string;
  name: string;
  enabled: boolean;
  method: ApiMockMethod;
  path: ApiMockPathMatcherV1;
  priority: number;
  predicates: ApiMockPredicateGroupV1;
  responseMode: ApiMockResponseMode;
  responses: ApiMockResponseVariantV1[];
  tags: string[];
  operationId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiMockPathMatcherV1 {
  kind: ApiMockPathMatcherKind;
  value: string;
  paramNames?: string[];
  flags?: { caseInsensitive?: boolean; decoded?: boolean };
}

interface ApiMockVariableV1 {
  id: string;
  key: string;
  value: string;
  sensitive: boolean;
  description?: string;
}

interface ApiMockImportSourceV1 {
  kind: 'redfireforge' | 'openapi' | 'wiremock' | 'curl' | 'catalog' | 'requests' | 'journal';
  label?: string;
  importedAt: string;
  sourceVersion?: string;
  diagnostics: ApiMockDiagnosticV1[];
}
```

Folder deletion cascades `folderId` on child routes/folders to `undefined` (moves them to the root) after confirmation. Variable `sensitive` marks values for redaction in exports/traces; the UI stores the actual value but `[REDACTED]` replaces it in persisted logs and export envelopes with `redacted: true`.

### 8.2 Predicate Types

```typescript
interface ApiMockPredicateGroupV1 {
  id: string;
  combinator: 'all' | 'any' | 'not';
  children: Array<ApiMockPredicateGroupV1 | ApiMockPredicateV1>;
}

interface ApiMockPredicateV1 {
  id: string;
  source: 'pathParam' | 'query' | 'header' | 'cookie' | 'security' | 'body' | 'transport';
  selector?: string;
  operator: ApiMockPredicateOperator;
  expected?: ApiMockPredicateExpectedValue;
  options?: {
    caseSensitive?: boolean;
    negate?: boolean;
    matchStyle?: 'subset' | 'exact';
  };
}

type ApiMockPredicateExpectedValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | Record<string, string | number | boolean | null | string[]>;
```

`route.method` and `route.path` are the canonical request line. Predicate groups contain only additional conditions and must not duplicate method or path matching. `expected` is typed as a bounded union of JSON-safe primitives and shallow structures; deep/nested objects are expressed through JSONPath/XPath/schema operators that accept string patterns rather than arbitrary object trees.

When `source` is `'security'`, `selector` must be one of: `'scheme'` (auth scheme name, e.g. `Bearer`), `'username'` (Basic auth username), `'tokenClaim'` (JWT claim path, e.g. `sub`), `'apiKeyName'` (API key header/query name), `'apiKeyLocation'` (`'header' | 'query'`), or `'certSubject'` (mTLS client certificate subject, Phase 10 capability-gated). Other `selector` values for `source: 'security'` produce `AMS-SCHEMA-INVALID-TYPE`.

### 8.3 Response and Behavior Types

```typescript
interface ApiMockResponseVariantV1 {
  id: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  conditions?: ApiMockPredicateGroupV1;
  weight?: number;                          // Phase 7 capability-gated
  status: number;
  reasonPhrase?: string;
  headers: Array<{ id: string; key: string; value: string; enabled: boolean }>;
  cookies: ApiMockResponseCookieV1[];
  body: ApiMockResponseBodyV1;
  behavior: ApiMockBehaviorV1;
  transition?: ApiMockStateTransitionV1;    // Phase 7 capability-gated
}

interface ApiMockResponseCookieV1 {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
  domain?: string;
  path?: string;
  maxAge?: number;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

interface ApiMockResponseBodyV1 {
  kind: ApiMockResponseBodyKind;
  content: string;
  contentType?: string;
  encoding?: 'utf-8' | 'base64';
  filePath?: string;
}

interface ApiMockBehaviorV1 {
  delayMs: number;
  jitterMs: number;
  longRunningMs?: number;
  // Phase 7 capability-gated fields:
  chunkSchedule?: Array<{ afterMs: number; body: string }>;
  maxMatches?: number;
  expiresAt?: string;
  fault?: ApiMockFaultKind;
  probability?: number;
}

interface ApiMockStateTransitionV1 {
  currentState?: string;
  targetState: string;
  counterUpdates?: Array<{ key: string; delta: number }>;
}

interface ApiMockStaticResponseV1 {
  status: number;
  reasonPhrase?: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
  contentType: string;
}
```

### 8.4 Settings Types

```typescript
interface ApiMockServerSettingsV1 {
  selection: {
    multipleMatchPolicy: 'highest_priority' | 'reject_multiple';
    equalPriorityPolicy: 'specificity_then_id' | 'reject';
    ambiguityResponse: ApiMockStaticResponseV1;
  };
  fallback: {
    unmatchedResponse: ApiMockStaticResponseV1;
    mode: 'default_response' | 'closest_match_debug';
  };
  cors: {
    enabled: boolean;
    allowOrigins: string[];
    allowMethods: ApiMockMethod[];
    allowHeaders: string[];
    allowCredentials: boolean;
    maxAge: number;
    exposeHeaders: string[];
  };
  limits: {
    maxInboundBodyBytes: number;
    maxResponseBodyBytes: number;
    maxConcurrentConnections: number;
    maxDelayMs: number;
    longRunningEnabled: boolean;
    longRunningMaxMs: number;
    gracefulDrainMs: number;
  };
  journal: {
    enabled: boolean;
    maxEntries: number;
    maxCapturedBodyBytes: number;
    persistToDisk: boolean;
    retentionSeconds?: number;
  };
  redaction: {
    headerNames: string[];
    jsonPaths: string[];
    preserveScheme: boolean;
  };
}
```

**MVP defaults** (from Section 10.5):

| Setting | Default |
|---|---|
| `selection.multipleMatchPolicy` | `'highest_priority'` |
| `selection.equalPriorityPolicy` | `'reject'` |
| `selection.ambiguityResponse` | `{ status: 409, reasonPhrase: 'Conflict', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"error":"ambiguous","requestId":"{{requestId}}","competingRules":{{competingRuleCount}}}', contentType: 'application/json' }` |
| `fallback.mode` | `'default_response'` |
| `fallback.unmatchedResponse` | `{ status: 404, ..., body: '{"error":"not_found","requestId":"{{requestId}}"}', contentType: 'application/json' }` |
| `cors.enabled` | `false` |
| `cors.allowOrigins` | `['*']` |
| `cors.allowMethods` | `['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']` |
| `cors.allowHeaders` | `['Content-Type', 'Authorization', 'Accept']` |
| `cors.allowCredentials` | `false` |
| `cors.maxAge` | `86400` |
| `cors.exposeHeaders` | `[]` |
| `limits.maxInboundBodyBytes` | `1_048_576` (1 MiB) |
| `limits.maxResponseBodyBytes` | `1_048_576` (1 MiB) |
| `limits.maxConcurrentConnections` | `100` |
| `limits.maxDelayMs` | `0` |
| `limits.longRunningEnabled` | `false` |
| `limits.longRunningMaxMs` | `3_600_000` (1 hour) |
| `limits.gracefulDrainMs` | `5_000` |
| `journal.enabled` | `true` |
| `journal.maxEntries` | `500` |
| `journal.maxCapturedBodyBytes` | `262_144` (256 KiB) |
| `journal.persistToDisk` | `false` |
| `redaction.headerNames` | `['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key', 'api-key', 'x-auth-token']` |
| `redaction.jsonPaths` | `[]` |
| `redaction.preserveScheme` | `true` |

Hard ceilings are enforced at validation, not stored. Every configurable value above may be lowered but cannot exceed its Section 10.5 ceiling. Phase 9 proxy and Phase 10 TLS fields must carry `_capabilityPhase` metadata and are rejected by MVP validators.

**Capability-gated extension pattern** for future phases:

```typescript
// Phase 9 proxy — not present in MVP contracts
interface ApiMockProxySettingsV1 {
  _capabilityPhase: 9;
  enabled: boolean;
  allowlist: string[];
  blockPrivateNetworks: boolean;
  maxRedirects: number;
  stripHopByHop: boolean;
  forwardAuth: boolean;
  timeoutMs: number;
}

// Phase 10 TLS — not present in MVP contracts
interface ApiMockTlsSettingsV1 {
  _capabilityPhase: 10;
  enabled: boolean;
  certPath: string;
  keyPath: string;
  clientAuth?: 'none' | 'request' | 'require';
}
```

Any settings field with `_capabilityPhase > currentPhase` is rejected with `AMS-CAPABILITY-GATED` before commit or import activation.

### 8.5 Captured and Runtime Types

```typescript
interface ApiMockCapturedRequestV1 {
  method: string;
  path: string;
  rawPath: string;
  query: Record<string, string[]>;
  headers: Record<string, string[]>;
  cookies: Record<string, string>;
  body: string | null;
  bodyTruncated: boolean;
  contentType?: string;
  contentLength?: number;
  remoteAddress?: string;
  receivedAt: string;
}

interface ApiMockCapturedResponseV1 {
  status: number;
  reasonPhrase?: string;
  headers: Record<string, string[]>;
  cookies: ApiMockResponseCookieV1[];
  body: string | null;
  bodyTruncated: boolean;
  contentType?: string;
  durationMs: number;
  generationAtResponse: number;
}

interface ApiMockMatchExplanationV1 {
  normalizedRequest: {
    method: string;
    path: string;
    decodedPath: string;
    pathSegments: string[];
    query: Record<string, string[]>;
    headerKeys: string[];
    cookieKeys: string[];
    bodyContentType?: string;
    bodySizeBytes: number;
  };
  candidates: Array<{
    routeId: string;
    routeName: string;
    priority: number;
    enabled: boolean;
    methodMatch: boolean;
    pathMatch: boolean;
    predicateResults: ApiMockPredicateResultV1[];
    overallMatch: boolean;
  }>;
  policyDecision: {
    policy: 'highest_priority' | 'reject_multiple';
    equalPriorityPolicy: 'specificity_then_id' | 'reject';
    matchedCount: number;
    highestPriority: number;
    tiedAtHighest: number;
    outcome: ApiMockTransactionOutcome;
    selectedRouteId?: string;
    selectedResponseId?: string;
    specificityBreakdown?: {
      routeId: string;
      score: number;
      components: Array<{ source: string; weight: number }>;
    }[];
  };
  nearMisses: Array<{
    routeId: string;
    routeName: string;
    failedPredicates: Array<{ predicateId: string; source: string; reason: string }>;
    missDistance: number;
  }>;
}

interface ApiMockPredicateResultV1 {
  predicateId: string;
  groupId: string;
  source: string;
  operator: ApiMockPredicateOperator;
  passed: boolean;
  evaluated: boolean;
  reason?: string;
}
```

### 8.6 Simulation Types

```typescript
interface ApiMockSimulationSampleV1 {
  id: string;
  name: string;
  routeId?: string;
  request: ApiMockCapturedRequestV1;
  expected?: {
    outcome: ApiMockTransactionOutcome;
    routeId?: string;
    responseId?: string;
    status?: number;
    headers?: Record<string, string | string[]>;
    bodyContains?: string;
    bodyExact?: string;
  };
}

interface ApiMockSimulationResultV1 {
  sampleId: string;
  generation: number | 'draft';
  passed?: boolean;
  outcome: ApiMockTransactionOutcome;
  renderedResponse?: ApiMockCapturedResponseV1;
  trace: ApiMockMatchExplanationV1;
}
```

Samples are server-owned with optional `routeId`. Route deletion clears `routeId` after confirmation but preserves the sample data. A workspace export at `scope: 'workspace'` includes all server definitions and their embedded samples. A `scope: 'servers'` export includes each server's embedded samples. A `scope: 'routes'` export always includes samples whose `routeId` matches a selected route. Unassociated samples (those with no `routeId` or whose `routeId` does not match any selected route) are excluded by default; the export UI offers an explicit "Include unassociated samples" option. If included, they appear in the `samples` array alongside route-associated samples.

### 8.7 Conflict Types

```typescript
interface ApiMockConflictFindingV1 {
  id: string;
  serverId: string;
  ruleIds: [string, string];
  kind: 'definite_overlap' | 'potential_overlap' | 'duplicate' | 'shadowed' | 'unreachable';
  severity: 'info' | 'warning' | 'error';
  dimensions: Array<{
    source: 'method' | 'path' | ApiMockPredicateV1['source'];
    selector?: string;
    result: 'overlap' | 'disjoint' | 'unknown';
    explanation: string;
  }>;
  selectionOutcome: 'reject_ambiguous' | 'left_wins' | 'right_wins' | 'tie_break' | 'unknown';
  witnessRequest?: ApiMockCapturedRequestV1;
  ruleFingerprints: [string, string];
  acknowledgedAt?: string;
}
```

### 8.8 Transaction Types

```typescript
interface ApiMockRuntimeSnapshotV1 {
  serverId: string;
  generation: number;
  committedAt: string;
  definitionFingerprint: string;
  definition: ApiMockServerDefinitionV1;
}

interface ApiMockTransactionV1 {
  id: string;
  serverId: string;
  generation: number;
  receivedAt: string;
  completedAt?: string;
  request: ApiMockCapturedRequestV1;
  response?: ApiMockCapturedResponseV1;
  outcome: ApiMockTransactionOutcome;
  matchedRouteId?: string;
  matchedResponseId?: string;
  explanation: ApiMockMatchExplanationV1;
  durationMs?: number;
}
```

`ApiMockTransactionOutcome` does not include `'proxied'`; proxy is Phase 9 capability-gated. When Phase 9 lands, it extends the outcome union and the transaction type.

### 8.9 Template Context

```typescript
interface ApiMockTemplateContextV1 {
  request: {
    method: string;
    path: string;
    pathParams: Record<string, string>;
    query: Record<string, string[]>;
    headers: Record<string, string[]>;
    cookies: Record<string, string>;
    body: Record<string, unknown> | string | null;
    rawBody: string;
  };
  state: Record<string, string>;
  variables: Record<string, string>;
  counters: Record<string, number>;
  now: string;
  seed: string;
}
```

`request.body` is the parsed body: a JSON object when content-type is JSON and parsing succeeds, a string for text bodies, or `null` for empty/binary bodies. The `Record<string, unknown>` inner type is acceptable here because template context is a transient runtime value, not a persisted contract; template helpers access it through typed accessor functions (`jsonPath`, `pathParam`, etc.) that validate at evaluation time.

`variables` uses `Record<string, string>` because variable values are always strings at the template boundary; type coercion is the helper's responsibility.

**Redaction transformation** (applies when `_exportMeta.redacted` is `true`): Header values whose lowercase key appears in `redaction.headerNames` are replaced with `[REDACTED]`, preserving the auth scheme prefix when `preserveScheme` is `true` (e.g., `Bearer [REDACTED]`). Variable values with `sensitive: true` are replaced with `[REDACTED]`. Captured request/response body strings containing JSON are redacted at configured `redaction.jsonPaths`; non-JSON bodies are not transformed. The redaction is shallow and deterministic; template source content in route definitions is not redacted because it contains template expressions, not runtime values.

**Template helper type contracts** (enforced by Phase 4 implementation):

```typescript
function jsonPath(body: Record<string, unknown> | string | null, path: string): string;
function pathParam(params: Record<string, string>, name: string): string;
function query(query: Record<string, string[]>, name: string): string;
function header(headers: Record<string, string[]>, name: string): string;
function cookie(cookies: Record<string, string>, name: string): string;
function state(states: Record<string, string>, name: string): string;
function counter(counters: Record<string, number>, name: string): number;
function uuid(): string;
function now(format?: string): string;
function randomInt(min: number, max: number): number;
function oneOf(...values: string[]): string;
function repeat(count: number, template: string): string;
function base64(input: string, direction?: 'encode' | 'decode'): string;
```

All helpers return `string` or `number` for safe template interpolation. `jsonPath` stringifies non-primitive results. Helpers that access missing keys return empty string, not `undefined`.

Allowed helpers include `jsonPath`, `pathParam`, `query`, `header`, `cookie`, `state`, `counter`, `uuid`, `now`, `randomInt`, `oneOf`, `repeat`, `base64`, and a curated Faker subset. Helpers must be deterministic when `seed` is set and must have execution/output limits.

### 8.10 Export Envelope

```typescript
type ApiMockExportPayloadV1 =
  | { scope: 'workspace'; workspace: ApiMockWorkspaceV1 }
  | { scope: 'servers'; servers: ApiMockServerDefinitionV1[] }
  | {
      scope: 'routes';
      sourceServerId: string;
      routes: ApiMockRouteV1[];
      samples: ApiMockSimulationSampleV1[];
    };

interface ApiMockExportV1 {
  _exportMeta: {
    kind: 'redfireforge-api-mock';
    schemaVersion: 1;
    exportedAt: string;
    redacted: boolean;
  };
  data: ApiMockExportPayloadV1;
}
```

### 8.11 Diagnostic Types

```typescript
type ApiMockDiagnosticSeverity = 'error' | 'warning' | 'info';

interface ApiMockDiagnosticV1 {
  code: string;
  severity: ApiMockDiagnosticSeverity;
  path: string;
  message: string;
  remediation?: string;
  context?: Record<string, string | number | boolean>;
}
```

**Stable diagnostic code prefixes:**

| Prefix | Category | Example |
|---|---|---|
| `AMS-SCHEMA-` | Structural validation | `AMS-SCHEMA-MISSING-FIELD`, `AMS-SCHEMA-INVALID-TYPE` |
| `AMS-REF-` | Reference integrity | `AMS-REF-DANGLING-FOLDER`, `AMS-REF-DANGLING-ROUTE` |
| `AMS-LIMIT-` | Safety ceiling exceeded | `AMS-LIMIT-ROUTES`, `AMS-LIMIT-NESTING-DEPTH`, `AMS-LIMIT-REGEX-LENGTH` |
| `AMS-CAPABILITY-` | Phase-gated feature | `AMS-CAPABILITY-GATED` |
| `AMS-REGEX-` | Pattern validation | `AMS-REGEX-INVALID`, `AMS-REGEX-UNSAFE` |
| `AMS-IMPORT-` | Import/migration | `AMS-IMPORT-UNSUPPORTED-FIELD`, `AMS-IMPORT-LOSS`, `AMS-IMPORT-VERSION-UNKNOWN` |
| `AMS-REDACTION-` | Secret detection | `AMS-REDACTION-SECRET-DETECTED` |
| `AMS-CONFLICT-` | Rule overlap | `AMS-CONFLICT-DUPLICATE`, `AMS-CONFLICT-DEFINITE`, `AMS-CONFLICT-POTENTIAL` |
| `AMS-RESPONSE-` | Response mode invariant | `AMS-RESPONSE-NO-DEFAULT`, `AMS-RESPONSE-INVALID-MODE` |
| `AMS-STORAGE-` | Persisted-workspace load recovery (added Phase 12C) | `AMS-STORAGE-CORRUPT` |

`path` uses JSON Pointer syntax relative to the validated object root (e.g., `/routes/0/predicates/children/1/expected`). Every diagnostic includes a human-readable `message` and optional `remediation` with the corrective action. `context` carries safe metadata such as the configured value, ceiling, or expected type without echoing sensitive payloads.

### 8.12 Response-Mode Invariants

These invariants are enforced by structural validation before commit and import activation.

| Mode | MVP | Required invariants |
|---|---|---|
| `rules` | Yes | Exactly one variant has `isDefault: true`. Other variants must have `conditions` defined. `weight` must be `undefined`. `transition` must be `undefined`. |
| `sequence` | Phase 7 | At least one variant. No `conditions`, no `weight`. Order is array position. Exhaustion policy is per-route: `'cycle'` (restart) or `'hold_last'`. `transition` is permitted. |
| `weighted` | Phase 7 | At least one variant. All enabled variants must have `weight > 0`. Weights are relative (no required sum). No `conditions`. `transition` is permitted. |
| `state` | Phase 7 | At least one variant. Each variant must have `transition.currentState` set (the state guard). Exactly one variant may omit `currentState` to serve as the initial/default. `weight` must be `undefined`. |

Cross-mode rules:
- A route's `responseMode` determines which variant fields are valid; invalid combinations produce `AMS-RESPONSE-INVALID-MODE`.
- Exactly one enabled variant in `rules` mode must be the default; zero or multiple defaults produce `AMS-RESPONSE-NO-DEFAULT` or `AMS-RESPONSE-MULTIPLE-DEFAULTS`.
- If all variants exist but none is enabled, validation produces `AMS-RESPONSE-NO-ENABLED-VARIANT`. A route with no enabled variant cannot match at runtime.
- `isDefault` is meaningful only in `rules` mode; it is ignored in other modes.
- An empty `responses` array is always invalid (`AMS-SCHEMA-MISSING-FIELD`).
- MVP validators reject `responseMode !== 'rules'` with `AMS-CAPABILITY-GATED`.

### 8.13 Fingerprint and Deterministic Ordering

**Definition fingerprint** (`definitionFingerprint` in `ApiMockRuntimeSnapshotV1`): SHA-256 hex digest of the canonical JSON serialization of the `ApiMockServerDefinitionV1` excluding `createdAt`, `updatedAt`, and `source`. Fields are sorted by key at every nesting level. Arrays preserve their semantic order (routes by `id`, folders by `id`, variants by array position, headers/cookies by array position).

**Rule fingerprint** (`ruleFingerprints` in `ApiMockConflictFindingV1`): SHA-256 hex digest of the canonical JSON serialization of one `ApiMockRouteV1` excluding `createdAt`, `updatedAt`, `tags`, and `operationId`. Conflict acknowledgements become stale when either fingerprint changes.

**Deterministic export ordering:**
1. `servers` are ordered by `id` (lexical ascending).
2. `folders` within a server are ordered by `id`.
3. `routes` within a server are ordered by `id`.
4. `samples` within a server are ordered by `id`.
5. `variables` within a server are ordered by `key`.
6. `responses` within a route preserve array position (author-controlled).
7. `headers` and `cookies` within a response preserve array position.
8. `_exportMeta.exportedAt` is excluded from fingerprint comparisons; two exports of the same workspace must produce identical JSON output except for `exportedAt`.

### 8.14 Version Handling and Migration

**Schema version rules:**
- Every persisted workspace and export envelope carries `schemaVersion: 1`.
- If `schemaVersion > CURRENT_SUPPORTED_VERSION`, the runtime rejects the payload with `AMS-IMPORT-VERSION-UNKNOWN` and does not attempt partial parsing.
- If `schemaVersion === CURRENT_SUPPORTED_VERSION`, the runtime applies pure defaulting/normalization (adding missing optional fields with their defaults) without data loss.
- If `schemaVersion < CURRENT_SUPPORTED_VERSION`, the runtime applies pure versioned migrations in sequence.

**Migration dispatcher signature:**

```typescript
type ApiMockMigration = {
  fromVersion: number;
  toVersion: number;
  migrate: (data: Record<string, unknown>) => {
    result: Record<string, unknown>;
    diagnostics: ApiMockDiagnosticV1[];
  };
};
```

Migrations are pure functions: no side effects, no network, no storage access. Each migration transforms from exactly `fromVersion` to `toVersion = fromVersion + 1`. The dispatcher chains them in sequence. Every migration produces diagnostics for defaults applied, fields removed, and semantic changes.

If any migration in the sequence fails, the entire import is rejected and no mutations are applied to the workspace. All failures from every step in the chain are collected and reported together in the diagnostics array. A partially migrated state is never persisted.

Phase 0B does not invent a V0→V1 migration. The first migration will be V1→V2 when V2 is defined. V1 defaulting/normalization is a separate pure function that fills missing optional fields without changing `schemaVersion`.

### 8.15 Phase 0 Contract Freeze Checklist

All items below were resolved during Phase 0B. Sections reference the completed contract subsections.

- [x] Define `ApiMockRouteFolderV1`, `ApiMockVariableV1`, `ApiMockImportSourceV1`, `ApiMockPathMatcherV1`, `ApiMockPredicateOperator`, `ApiMockResponseBodyV1`, `ApiMockResponseCookieV1`, `ApiMockStateTransitionV1`, `ApiMockStaticResponseV1`, `ApiMockCapturedRequestV1`, `ApiMockCapturedResponseV1`, and `ApiMockMatchExplanationV1` without `any` or `unknown` escape hatches for persisted values. → Sections 8.0-8.5.
- [x] Define complete CORS, fallback, and journal/redaction settings. Incorporate every configurable default and hard ceiling frozen in Section 10.5. Represent Phase 9 proxy and Phase 10 TLS as capability-gated optional configuration with `_capabilityPhase` metadata. → Section 8.4.
- [x] Keep durable definition state separate from runtime state. → Section 8.8 (`ApiMockTransactionOutcome` excludes `'proxied'`; runtime snapshots, transactions, and journals are not persisted as authoritative running state).
- [x] Make method/path ownership explicit: `route.method` and `route.path` are the canonical request line; predicate groups contain only additional conditions. → Section 8.2 prose.
- [x] Define folder/sample ownership, deletion/reference behavior, stable ID uniqueness scope, empty-workspace behavior, and sample scoping. → Sections 8.1 (folder deletion cascade) and 8.6 (sample ownership and export scope rules).
- [x] Preserve the Phase 0A sample decision in contracts. → Section 8.6.
- [x] Define response-mode invariants. → Section 8.12.
- [x] Define canonical ordering and timestamp/fingerprint policy. → Section 8.13.
- [x] Define unknown-future-version rejection, pure same-version defaulting/normalization, and migration dispatcher signature. → Section 8.14.
- [x] Define structural and semantic diagnostics with stable codes, JSON pointer/field paths, severity, remediation text, and import-loss reporting. → Section 8.11.
- [x] Add representative fixtures under `docs/plan/future/apimock/fixtures/`. → 10 fixtures covering empty workspace, valid server with routes/samples/settings, unknown version, dangling references, duplicate IDs, capability-gated features, response-mode invariant violations, redaction, boundary limits, and deterministic export ordering.

---

## 9. Architecture

```mermaid
flowchart LR
  UI[ApiMockStudioPage] --> Tabs[useApiMockWorkspace]
  UI --> Editor[Route and response editors]
  UI --> Journal[Transaction journal]
  Tabs --> Repo[API Mock repository]
  Repo --> IDB[(IndexedDB)]
  Repo --> TauriStore[(Tauri storage)]
  UI --> Client[apiMockControlClient]
  Client --> Control[Companion control plane :3001]
  Control --> Pool[ApiMockServerPool by serverId]
  Pool --> L1[HTTP listener :4600]
  Pool --> L2[HTTP listener :4601]
  Pool --> LN[HTTP listener :N]
  L1 --> Engine[Shared matcher and template engine]
  L2 --> Engine
  LN --> Engine
  Engine --> Logs[Bounded journal and state]
  CLI[RedfireForge CLI] --> Pool
  Catalog[OpenAPI Catalog] --> Importer[API Mock importer]
  Requests[Requests Studio] <--> UI
  Curl[cURL command] --> Importer
  Importer --> Converter[Normalized source-to-rule converter]
  Converter --> Editor
  Editor --> Conflict[Static rule conflict analyzer]
```

### 9.1 Control Plane

Add `createApiMockRouter()` under `src-server/routes/api-mock/`. All endpoints use the existing `{ ok, data }` / `{ ok, error }` response envelope and shared server API types.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/mock/servers/start` | Validate and start one server definition. |
| POST | `/api/mock/servers/:serverId/stop` | Drain and stop one listener. |
| POST | `/api/mock/servers/:serverId/restart` | Stop/start with an explicit definition. |
| PUT | `/api/mock/servers/:serverId/definition` | Validate and atomically hot-commit. |
| GET | `/api/mock/servers/:serverId/status` | Runtime state, port, generation, counts, error. |
| GET | `/api/mock/servers` | Reconcile all runtimes after refresh. |
| GET | `/api/mock/servers/:serverId/transactions` | Cursor-based journal retrieval. |
| DELETE | `/api/mock/servers/:serverId/transactions` | Clear bounded journal. |
| POST | `/api/mock/servers/:serverId/state/reset` | Reset scenarios/counters. |
| POST | `/api/mock/evaluate` | Side-effect-free matcher/response preview. |
| POST | `/api/mock/conflicts` | Analyze a draft definition and return conflict findings without committing it. |
| POST | `/api/mock/ports/probe` | Check port validity and ownership. |

Control endpoints accept `serverId` and verify port ownership. A tab cannot stop or update another tab's listener by guessing its port.

### 9.2 Data Plane

Create `ApiMockNetworkListener` using Node `http.createServer` for HTTP/1.1. Avoid creating an Express app per mock unless middleware value outweighs overhead; the core handler should operate on normalized request/response contracts.

Responsibilities:

- bind/listen failure handling before reporting Running;
- body streaming with configured byte limit;
- raw and parsed body capture;
- URL/path/query normalization;
- immutable generation pinning;
- matcher evaluation and explain trace;
- response template rendering;
- scenario transition and counters;
- CORS/HEAD semantics;
- connection/fault behavior;
- bounded transaction logging;
- graceful drain and timer cleanup.

### 9.3 Runtime Pool

Create `ApiMockServerPool`, following `GrpcMockServerPool` rather than keying only by port as the older WebSocket pool does.

```typescript
interface ApiMockPoolEntry {
  serverId: string;
  port: number;
  listener: ApiMockNetworkListener;
  generation: number;
}
```

The pool owns port reservations, listener lifecycle, definitions, and global shutdown. It supports `start`, `stop`, `restart`, `commit`, `status`, `list`, `transactions`, and `stopAllAsync`.

### 9.4 Shared Engine Boundary

Pure engine code belongs under `src/shared/api-mock/` so it can run in:

- Node companion listener;
- side-effect-free browser previews;
- CLI tests/headless execution;
- a future native Tauri listener.

Modules:

- `contracts.ts`
- `validation.ts`
- `requestNormalization.ts`
- `predicateEvaluator.ts`
- `patternTools.ts`
- `specificity.ts`
- `routeSelector.ts`
- `conflictAnalyzer.ts`
- `sourceToRule.ts`
- `responseSelector.ts`
- `templateEngine.ts`
- `scenarioRuntime.ts`
- `matchExplanation.ts`
- `redaction.ts`
- `migration.ts`

Do not import React, Express, Node sockets, or storage APIs into this directory.

### 9.5 Persistence

- Tab order, active tab, and compact UI preferences: storage abstraction.
- Server definitions, route bodies, imported source metadata: new IndexedDB stores with Tauri-backed repository parity.
- Runtime state and journal: memory by default.
- Optional persisted journal: separate capped store with retention and redaction settings.
- Every persisted/exported contract includes `schemaVersion`; migrations are pure and tested.
- Do not persist `running: true` as truth. On app load, reconcile with the control plane.

### 9.6 Existing Code to Reuse

| Capability | Existing anchor |
|---|---|
| App navigation | `src/app/components/AppSubNav.tsx`, `src/app/utils/appTabUtils.ts`, `src/app/App.tsx` |
| Accessible tabs | `src/features/requests/components/RequestTabBar.tsx`, shared `studio-tabs` utilities |
| Per-tab ports/lifecycle UX | `src/features/websocket/WebSocketStudioPage.tsx`, `useWebSocketMockServer.ts` |
| Runtime pool and atomic commits | `src-server/grpc/grpcMockServerPool.ts` and gRPC runtime registry |
| Control API envelope | `src-server/routes/websocket-mock-routes.ts`, `src/shared/types/server-api.ts` |
| OpenAPI parsing | `src/features/catalog/utils/openApiParser.ts` |
| cURL parsing | `src/shared/utils/curlParser.ts`; extend its normalized result and diagnostics rather than creating an API Mock-only parser |
| Regex pattern library/testing | `src/features/requests/components/RegexPatternLibrary.tsx`, `regexAssertionUtils.ts`, and shared `RegexAssertionBuilderModal` |
| JSON sample/path tooling | `src/shared/utils/jsonTreeModel.ts`, `src/shared/utils/jsonPath.ts`, and Data Mapper tree components |
| Catalog normalization | `src/features/catalog/utils/catalogEndpointToRequest.ts` as an input adapter to the canonical source-to-rule converter |
| HTTP method colors | `src/shared/constants/httpMethodColors.ts` |
| Header/query editing | `src/features/websocket/KeyValueEditor.tsx` |
| Request composition | `src/features/requests/components/RequestEditor.tsx` |
| Modals | `src/shared/components/AppModalFrame.tsx`, `ConfirmModal` |
| Storage | `src/shared/utils/storage.ts`, `idbRequests.ts`, `idbGrpcCollections.ts` |
| Environment variables | existing environment map/resolver utilities |
| Outbound proxy security | `src-server/grpc/serverOutboundUrlPolicy.ts` generalized to shared server policy |

### 9.7 New Code Ownership

```text
src/features/api-mock/
  ApiMockStudioPage.tsx
  components/
  hooks/
  data/
  utils/

src/shared/api-mock/
  contracts.ts
  validation.ts
  predicateEvaluator.ts
  patternTools.ts
  routeSelector.ts
  conflictAnalyzer.ts
  sourceToRule.ts
  responseSelector.ts
  templateEngine.ts
  scenarioRuntime.ts
  matchExplanation.ts
  redaction.ts

src-server/api-mock/
  ApiMockNetworkListener.ts
  ApiMockServerPool.ts
  ApiMockTransactionJournal.ts
  apiMockRequestAdapter.ts

src-server/routes/api-mock/
  api-mock-routes.ts

src/shared/selectors/apiMock.ts
src/styles/api-mock-studio.css
```

Keep production files below the repository's 900-line monolith threshold.

---

## 10. Security, Privacy, and Reliability

### 10.1 Binding and Exposure

- Default to `127.0.0.1`.
- Selecting `0.0.0.0` requires explicit confirmation describing LAN exposure before Start and must show an always-visible “LAN exposed” badge while selected or running.
- Never expose the control plane through the mock data-plane listener.
- Reserve `/__redfireforge/*` only if a future data-plane health endpoint is needed; user routes must not shadow it.

### 10.2 Template Safety

- No `eval`, `Function`, dynamic imports, filesystem access, process access, or network access.
- Parser depth, loop count, helper execution count, output bytes, and render time are capped.
- Prototype keys (`__proto__`, `prototype`, `constructor`) are blocked.
- Imported templates are validated before activation.

### 10.3 Proxy and Callback Safety

- Reuse/generalize `serverOutboundUrlPolicy` to block link-local, metadata, loopback recursion, and disallowed private destinations unless explicitly allowed.
- Prevent a mock from forwarding back to itself or the control plane.
- Strip hop-by-hop headers and recalculate content length.
- Do not forward authorization/cookies by default.
- Bound redirects and response sizes.

### 10.4 Secrets and Logs

- Redact `authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key`, `api-key`, and `x-auth-token` in persisted/exported logs.
- Let users configure additional header names and JSONPaths.
- Preserve auth scheme text, for example `Bearer [REDACTED]`.
- Default journal cap: 500 transactions/server and 1 MiB captured body/transaction, with lower preview limits.
- Full journal persistence is opt-in with visible retention controls.

### 10.5 Runtime Limits

Phase 0A freezes the initial defaults and hard ceilings below. Configurable values may be lowered but cannot silently exceed their hard maximum. Phase 0B represents them in typed settings/capability contracts.

| Resource | Default | Hard ceiling | Enforcement owner |
|---|---:|---:|---|
| Open/running-capable server tabs | 0 initial / 8 open | 8 | Phase 3 UI; Phase 2 runtime pool. Saved closed definitions are uncapped by this UX limit. |
| Automatic port allocation | First bindable in `4600-4699` | 100 candidates | Phase 2 atomically reserves under the pool lock and binds immediately; manual range is `1024-65535`. |
| Routes per server | - | 2,000 | Phase 1 structural validation before commit/import. |
| Predicates per server | - | 10,000 | Phase 1 structural validation. |
| Predicate-group nesting depth | - | 16 | Phase 1 parser/evaluator validation. |
| Response variants per route | 1 | 100 | Phase 1/4 contract validation. |
| Regular-expression source length | - | 4 KiB | Phase 1 validation; unsafe patterns are rejected. |
| Text inspected by one regex predicate | - | 1 MiB | Phase 1 evaluator truncates/rejects with an explicit diagnostic, never silently changes the match. |
| Aggregate request headers | - | 16 KiB and 200 fields | Phase 2 listener rejects before normalization. |
| Inbound body | 1 MiB configurable | 10 MiB | Phase 2 streaming limit; return 413 without buffering beyond the ceiling. |
| Generated response | 1 MiB configurable | 10 MiB | Phase 4 renderer/template output limit. |
| Concurrent connections per server | 100 | 500 | Phase 2 listener admission control. |
| Normal response delay | 0 | 60 seconds | Phase 4 behavior validation/timer cleanup. |
| Explicit long-running response | Off | 1 hour | Phase 4; separately enabled, visible, and cancellable. |
| Graceful drain | 5 seconds | 30 seconds | Phase 2 stop/restart/shutdown. |
| Journal entries per server | 500 | 500 | Phase 5 ring buffer. |
| Captured body per transaction | 256 KiB | 1 MiB | Phase 5 truncates with byte-count metadata before persistence/export. |
| Simulation samples per batch | 100 | 500 | Phase 1 engine and Phase 5 UI/CLI adapters. |
| Template nesting / helper operations | 16 / 1,000 | 32 / 10,000 | Phase 4 restricted template engine; generated output remains subject to response ceiling. |

All limit failures use stable diagnostic codes and record the configured value, hard ceiling, enforcement phase, and safe remediation without echoing sensitive payloads.

---

## 11. Delivery Phases

### 11.1 Status Tracker

| Phase | Scope | Status | Start | Complete | Commit |
|---|---|---|---|---|---|
| 0 | Contract and UX mockups | Complete | 2026-08-11 | 2026-08-11 | - |
| 1 | Shared matcher, pattern, and conflict engine | Complete | 2026-08-11 | 2026-08-11 | - |
| 2 | Multi-port HTTP runtime/control plane | Complete | 2026-08-11 | 2026-08-11 | - |
| 3 | Studio shell, tabs, route CRUD | Complete | 2026-08-11 | 2026-08-11 | - |
| 4 | Response editor, templates, latency | Complete | 2026-08-11 | 2026-08-11 | - |
| 5 | Journal and match debugger | Complete | 2026-08-11 | 2026-08-11 | - |
| 6 | cURL/OpenAPI/Catalog/Requests integration | Complete | 2026-08-11 | 2026-08-11 | - |
| 7 | Stateful, sequence, probability, faults | Complete | 2026-08-11 | 2026-08-11 | - |
| 8 | Export, CLI, CI, verification | Complete | 2026-08-11 | 2026-08-11 | - |
| 9 | Proxy, record/playback, callbacks | Complete | 2026-08-11 | 2026-08-11 | - |
| 10 | HTTPS/native Tauri parity | Partial (10A-10C) | 2026-08-11 | - | - |
| 11 | Workflow/Test Runner integration | Complete | 2026-08-11 | 2026-08-11 | - |
| 12 | Hardening, accessibility, docs, demos | Planned | - | - | - |

### 11.2 Sub-Phase Execution Rules

- Execute sub-phases in letter order unless the dependency column explicitly permits parallel work.
- Mark a code sub-phase complete only after its focused tests pass, touched production files exceed the repository's 90% coverage threshold, and the phase tracker/retrospective are updated.
- Run `npx tsc -b --noEmit` after every production-code batch and only touched Vitest files during implementation. Documentation-only Phase 0 edits use Markdown/link/fixture validation and real-Chrome mockup checks; they do not trigger product coverage or TypeScript gates unless production code changes.
- A sub-phase may add contracts needed by the next sub-phase, but must not ship dormant UI controls whose behavior is not implemented or clearly marked unavailable.
- Keep web companion and Tauri storage behavior aligned at every persistence boundary. Native listener parity remains isolated to Phase 10.
- Each UI sub-phase requires keyboard/focus checks and Chrome screenshots at its specified viewport before exit.

### Phase 0 - Contracts and UX Mockups

#### Implementation Approach

Phase 0 is a design-and-contract phase, not a production-code skeleton phase. Work from semantic decisions outward: freeze terminology and capability boundaries, close the persisted contract, map complete workflows, finish the visual catalog, define portable test/policy artifacts, validate the evidence, then request explicit approval. Keep the main plan authoritative; use subordinate files only for machine-readable fixtures and screenshot evidence.

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 0A | Decision foundation: reconcile goals/non-goals/MVP, freeze terminology and ownership, assign every `AMS-*` requirement to a capability phase, centralize safety ceilings, and convert Section 14 defaults into adopted or pending decisions. **Completed 2026-08-11.** | None | No requirement contradicts its phase; durable/runtime ownership and all unresolved decisions have named owners and deadlines. |
| 0B | Contract freeze: complete every `ApiMock*V1` type, invariant, diagnostic, schema envelope, capability gate, fingerprint/order rule, and fixture listed in Section 8.3. **Completed 2026-08-11.** | 0A | No omitted types or persisted `any`/`unknown`; fixtures cover valid, invalid, empty, boundary, reference, capability, deterministic export, and future-version cases. |
| 0C | Workflow and interaction specification: document state-transition tables for every workflow in the Phase 0C inventory below. Each table covers entry, success, empty, loading, validation, permission/capability, error, cancellation, and recovery states plus keyboard/focus behavior. Output is inline in this plan under Section 5 or a dedicated subsection. **Completed 2026-08-11.** | 0A, 0B | Every workflow in the inventory has a complete state table referencing only Section 8 contract types; no workflow entry point or error recovery is left undocumented. |
| 0D | Complete the eight-screen interactive catalog and bring screens 01-04 to the frozen contracts. Build missing screens 05-08 and preserve direct-open shared HTML/CSS/JS behavior. **Completed 2026-08-11.** | 0B, 0C | All eight links resolve; required controls and state transitions work; no screen claims a deferred capability is active without a capability label. |
| 0E | Formalize cross-cutting policies with worked examples and portable seed fixtures. Phase 0A adopted the policy values; 0E adds the formal proof/decision rules, deterministic examples, failure-mode tables, and conformance-corpus seed cases that Phase 1 implements. Scope: conflict proof algorithms per operator category, conflict severity defaults for strict/warn Apply gate, variable resolution walkthrough with 3-scope example, import merge/replace/copy decision tree with sample before/after, redaction transformation worked example, and conformance-corpus JSON schema with at least 10 seed cases covering every MVP operator. **Completed 2026-08-11.** | 0B, 0C | Every policy has at least one deterministic worked example and one failure-mode example; seed cases are parseable JSON conforming to the corpus schema and runnable in browser/runtime/CLI without platform fields. |
| 0F | Audit and validation: semantic HTML/ARIA, keyboard/focus restoration, token/modal conventions, link integrity, direct-open behavior, and real-Chrome screenshots. Use Playwright `page.screenshot()` or manual Chrome DevTools device mode to capture each of the 8 screens at desktop `1280×900`, tablet `768×1024`, and mobile `375×812`. Store screenshots as `docs/plan/future/apimock/mockups/screenshots/{screen}-{viewport}.png`. Record results and known limitations in `docs/plan/future/apimock/mockups/screenshots/VALIDATION_RECORD.md`. **Completed 2026-08-11.** | 0D, 0E | No broken links, overlap, clipped critical controls, inaccessible icon actions, or undocumented state gaps; `VALIDATION_RECORD.md` exists and lists every screen/viewport combination with pass/known-issue status. |
| 0G | Handoff and explicit approval: review contracts, policies, all eight screens, evidence, deferred decisions, and the Phase 1 entry assumptions listed below with the user. **Approved 2026-08-11.** | 0F | User approval date is recorded in the tracker/retrospective; Phase 1 does not start before approval, and feedback returns to the owning sub-phase. |

#### Phase 0C Workflow Inventory

Phase 0C must produce a state-transition table for each workflow below. Tables are documented inline in this plan. Each table covers: entry state, success path, empty/no-data state, loading/progress, validation errors, capability/permission gate, error/failure, user cancellation, and recovery/retry behavior, plus keyboard/focus notes.

| # | Workflow | Primary screen | Key contract types |
|---|---|---|---|
| 1 | Server create | 01 | `ApiMockServerDefinitionV1`, `ApiMockServerSettingsV1` |
| 2 | Server start/stop/restart | 01 | `ApiMockServerState`, port allocation |
| 3 | Server apply (hot commit) | 01 | `ApiMockRuntimeSnapshotV1`, generation |
| 4 | Server settings edit | 07 | `ApiMockServerSettingsV1` (selection, CORS, limits, journal, redaction) |
| 5 | Tab create/rename/duplicate/close | 01 | Tab order, `serverId`, port |
| 6 | Route create/edit/delete | 01 | `ApiMockRouteV1`, `ApiMockRouteFolderV1` |
| 7 | Route folder CRUD | 01 | `ApiMockRouteFolderV1`, cascade |
| 8 | Match predicate authoring | 02 | `ApiMockPredicateGroupV1`, `ApiMockPredicateV1`, `ApiMockPredicateOperator` |
| 9 | Pattern toolbox (regex/glob/JSONPath/schema) | 02 | `ApiMockPathMatcherV1`, operator enums |
| 10 | Response variant authoring | 03 | `ApiMockResponseVariantV1`, response-mode invariants |
| 11 | Template editing and preview | 03 | `ApiMockTemplateContextV1`, helper contracts |
| 12 | Simulation (single and batch) | 04 | `ApiMockSimulationSampleV1`, `ApiMockSimulationResultV1` |
| 13 | Conflict analysis and review | 05 | `ApiMockConflictFindingV1`, fingerprints, acknowledgement |
| 14 | cURL import | 06 | `ApiMockImportSourceV1`, diagnostics |
| 15 | OpenAPI/Swagger import | 06 | `ApiMockImportSourceV1`, route generation |
| 16 | Catalog/Requests promotion | 06 | Source-to-rule conversion |
| 17 | Native/WireMock import | 06 | Merge/replace/copy, version migration |
| 18 | Export (workspace/server/routes) | 01 | `ApiMockExportV1`, `ApiMockExportPayloadV1` |
| 19 | Journal inspection | 07 | `ApiMockTransactionV1`, `ApiMockMatchExplanationV1` |
| 20 | Redaction and persistence settings | 07 | Redaction transformation, journal settings |
| 21 | Refresh/reconnect recovery | 01, 07 | Runtime reconciliation, stale-state detection |
| 22 | LAN binding confirmation | 01, 07 | Host selection, confirmation flow |

#### Phase 0C State-Transition Tables

##### W1 — Server Create

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User clicks `[+]` tab or "Create Mock Server" in empty workspace. | Focus moves to the new tab label. |
| **Success** | New `ApiMockServerDefinitionV1` created with `Mock Server N` name, next free auto port, empty routes, and default settings. Tab appears and is selected. Server is Stopped. | Tab receives focus; route explorer shows empty state with "+ Route" and "+ Folder" prompts. |
| **Empty/no-data** | N/A — create always produces a valid definition. | — |
| **Loading** | N/A — creation is synchronous in the UI store. | — |
| **Validation** | If 8 tabs are already open, show `ConfirmModal` explaining the limit. Do not create. | Focus returns to the last active tab. |
| **Capability gate** | N/A. | — |
| **Error** | Port exhaustion during auto-allocation: create the definition with `port: 0` and show a validation warning on the server bar. The user must pick a manual port before Start. | Focus on port input field. |
| **Cancel** | N/A — single-action operation. | — |
| **Recovery** | If persistence fails, show a toast with retry. The tab is visible but unsaved until retry succeeds. | — |

##### W2 — Server Start / Stop / Restart

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User clicks Start, Stop, or Restart on the server bar. | — |
| **Success (Start)** | Control API POST `/api/mock/servers/start` succeeds. State transitions: Stopped → Starting → Running. Generation is set. Green dot and URL appear. | Copy URL button gains focus. |
| **Success (Stop)** | POST `/api/mock/servers/:serverId/stop`. State: Running → Draining → Stopped. Port is released. | Start button gains focus. |
| **Success (Restart)** | Stop then Start atomically. State: Running → Draining → Starting → Running. Generation increments. | — |
| **Empty/no-data** | N/A. | — |
| **Loading** | Starting/Draining states show a spinner on the lifecycle dot. Buttons disabled during transition. | — |
| **Validation** | Start validates the committed definition first. Invalid routes/settings block Start with field-level diagnostics. | Focus moves to the first invalid field. |
| **Capability gate** | N/A. | — |
| **Error (port conflict)** | `EADDRINUSE` → state remains Stopped. Server bar shows "Port :4600 in use" with an error border. | Focus on port input. |
| **Error (companion down)** | Network error → state shows Error with "Companion unavailable." Retry button appears. | Focus on Retry. |
| **Cancel** | N/A — Start/Stop are atomic from the user's perspective. | — |
| **Recovery** | After companion restart, the refresh/reconnect flow (W21) reconciles. User can retry Start. | — |

##### W3 — Server Apply (Hot Commit)

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User clicks Apply on the server bar while the server is Running and the draft is dirty. | — |
| **Success** | PUT `/api/mock/servers/:serverId/definition` succeeds. Generation increments. Dirty dot clears. In-flight requests finish on the old generation. | Apply button becomes disabled (clean). |
| **Empty/no-data** | Apply is disabled when the draft matches the committed generation (no dirty dot). | — |
| **Loading** | State shows Applying with spinner. Apply and Stop disabled briefly. | — |
| **Validation** | Draft validation runs before sending. Invalid routes block Apply with diagnostics. | Focus on the first invalid field. |
| **Capability gate** | If conflict Apply gate is strict and blocking findings exist, show the conflict summary. Apply is blocked until findings are fixed or acknowledged. | Focus moves to the conflict dock. |
| **Error** | Control API error → draft remains dirty; committed generation is unchanged. Toast shows the error. | Apply button re-enables. |
| **Cancel** | N/A — Apply is transactional. | — |
| **Recovery** | User can retry Apply after fixing validation errors or conflict findings. | — |

##### W4 — Server Settings Edit

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User clicks the settings gear icon on the server bar. `AppModalFrame` opens. | Focus moves into the modal; Escape closes it. |
| **Success** | User edits selection policy, CORS, limits, journal, or redaction fields and clicks Save/Apply. Settings are persisted. If the server is running, the draft becomes dirty. | Modal closes; focus returns to gear icon. |
| **Empty/no-data** | All fields pre-populated with current values or MVP defaults. | — |
| **Loading** | N/A — local state edit. | — |
| **Validation** | Limit values exceeding hard ceilings show inline errors (e.g., `maxInboundBodyBytes > 10 MiB`). Save is disabled until all values are valid. | Focus on the invalid field. |
| **Capability gate** | TLS/proxy sections show "Available in Phase 10/9" disabled state. No active controls for ungated features. | — |
| **Error** | Persistence failure → toast with retry. Modal remains open with the user's edits. | — |
| **Cancel** | User clicks Cancel or presses Escape. Unsaved changes are discarded. | Focus returns to gear icon. |
| **Recovery** | Reopen modal to retry. Previous valid persisted settings are restored. | — |

##### W5 — Tab Create / Rename / Duplicate / Close

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry (create)** | Click `[+]` or Ctrl+T. See W1 for details. | — |
| **Entry (rename)** | Double-click tab label or press F2. Inline text editor appears. | Focus in the text field; Enter confirms, Escape cancels. |
| **Entry (duplicate)** | Context menu → Duplicate. New tab with new ID, next port, and copied definition. | New tab gains focus. |
| **Entry (close)** | Click × or context menu → Close. | — |
| **Success (rename)** | Name updates in tab, definition, and persistence. | Focus returns to the tab. |
| **Success (close — stopped)** | Tab removed. If it was active, the nearest tab activates. | Nearest tab receives focus. |
| **Empty** | N/A — at least one action (create/rename/duplicate/close) is always valid while tabs exist. | — |
| **Loading** | N/A — all tab operations are synchronous in the UI store. | — |
| **Validation** | 8-tab limit blocks create/duplicate with a `ConfirmModal`. Empty name reverts to previous. | — |
| **Error** | Persistence failure → toast. | — |
| **Cancel (rename)** | Escape reverts to the previous name. | Focus on the tab. |
| **Close running** | `ConfirmModal`: "Stop and close Mock Server N?" On confirm, Stop then close. On cancel, tab remains. | Focus on Confirm or Cancel button. |
| **Recovery** | Close-others and close-right follow the same confirm-if-running pattern for each affected tab. | — |

##### W6 — Route Create / Edit / Delete

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry (create)** | Click "+ Route" in route explorer or context menu. A new route is created with `200 Default` response, inserted into the current folder (or root), and selected. | Focus moves to the route name field in the editor. |
| **Entry (edit)** | Select a route in the explorer. Editor loads the Match/Response/Behavior/Examples/Documentation tabs. | Focus on the editor. |
| **Entry (delete)** | Context menu → Delete or keyboard Delete key on a selected route. | — |
| **Success** | Route persisted. If the server is running, the draft becomes dirty. | — |
| **Empty/no-data** | No routes → explorer shows "+ Route" and "+ Folder" prompts. Editor shows a placeholder. | — |
| **Loading** | N/A — local state. | — |
| **Validation** | Route name required. Path pattern validated against `ApiMockPathMatcherV1` rules. Invalid regex produces `AMS-REGEX-INVALID`. | Focus on the invalid field. |
| **Capability gate** | Response mode selector shows only `rules` in MVP. Sequence/weighted/state appear disabled with phase labels. | — |
| **Error** | Persistence failure → toast with retry. | — |
| **Cancel** | N/A — edits are live in the draft. Undo uses browser-level undo in text fields. | — |
| **Delete confirm** | `ConfirmModal`: "Delete route GET /users/:id? Samples associated with this route will become unassociated." On confirm, route removed and `routeId` cleared on samples. | Focus returns to the nearest route in the explorer. |
| **Recovery** | Accidental delete is not undoable in v1; user recreates the route. Future: undo stack. | — |

##### W7 — Route Folder CRUD

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | Click "+ Folder", context menu, or drag route into a new folder. | Focus on folder name (editable inline). |
| **Success** | Folder created/renamed/moved. Child routes update their `folderId`. | — |
| **Delete** | `ConfirmModal`: "Delete folder Users? N routes will move to root." On confirm, child routes' `folderId` set to `undefined`. Nested child folders also cascade. | Focus returns to explorer root. |
| **Empty** | Empty folder is valid; shows a drop target and "+ Route" prompt. | — |
| **Loading** | N/A — folder operations are synchronous in the UI store. | — |
| **Validation** | Folder name required. | — |
| **Error** | Persistence failure → toast with retry. | — |
| **Cancel (rename)** | Escape reverts. | — |

##### W8 — Match Predicate Authoring

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User opens the Match tab of a selected route. Predicate group tree renders from `ApiMockPredicateGroupV1`. | Focus on the first condition row or "+ Add condition." |
| **Success** | User adds/edits/removes conditions. Each row: `[source] [selector] [operator] [expected] [options]`. Changes are live in the draft. | — |
| **Empty** | No predicates → route matches all requests for its method/path. Show an informational note. | — |
| **Loading** | N/A — local state. | — |
| **Validation** | Invalid regex → `AMS-REGEX-INVALID` inline. JSONPath syntax error → inline marker. Schema parse failure → inline. Nesting depth > 16 → `AMS-LIMIT-NESTING-DEPTH`. | Focus on the invalid field. |
| **Capability gate** | `transport` source predicates referencing TLS attributes show "Phase 10" disabled state. | — |
| **Error** | N/A — all local. | — |
| **Cancel** | Individual row delete requires confirmation only if complex conditions exist. | — |
| **Add group** | "+ Add group" creates a nested ALL/ANY/NOT group. Combinator is editable. | Focus inside the new group. |
| **Reorder** | Alt+Up/Down reorders conditions within a group. Tab/Shift+Tab navigates between controls. | — |

##### W9 — Pattern Toolbox

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User clicks the toolbox icon beside a pattern-heavy field (path, regex, JSONPath, schema, etc.). Toolbox panel opens inline. | Focus moves into the toolbox. |
| **Success** | User selects an operator, picks a library pattern, or builds a regex. The result populates the value field. | Focus returns to the value field. |
| **Empty** | Toolbox opens with the operator chooser and empty sample test area. | — |
| **Loading** | N/A. | — |
| **Validation** | Live positive/negative sample feedback using the shared predicate evaluator. Invalid regex/JSONPath shows immediate error text. Safety limits (regex length > 4 KiB) show `AMS-LIMIT-REGEX-LENGTH`. | — |
| **Error** | Evaluator failure → "Cannot evaluate" message with the diagnostic code. | — |
| **Cancel** | Close the toolbox without applying. Previous value is preserved. | Focus returns to the value field. |
| **Generalize** | "Generalize sample" marks dynamic segments but never broadens without explicit confirmation. | — |

##### W10 — Response Variant Authoring

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User opens the Response tab. Variant tabs show `[200 Default] [404 Missing] [+]`. | Focus on the active variant tab. |
| **Success** | User edits status, headers, cookies, body. Changes are live in the draft. | — |
| **Empty** | Not reachable — every route has at least one response (the default `200 Default`). | — |
| **Loading** | N/A — response editing is synchronous in the draft. | — |
| **Validation** | `rules` mode: exactly one `isDefault: true` variant required → `AMS-RESPONSE-NO-DEFAULT`. Multiple defaults → `AMS-RESPONSE-MULTIPLE-DEFAULTS`. All disabled → `AMS-RESPONSE-NO-ENABLED-VARIANT`. | Focus on the variant needing correction. |
| **Capability gate** | Sequence/weighted/state variant tabs appear only with "Phase 7" badge, disabled. Weight and transition fields hidden in MVP. | — |
| **Error** | N/A — local state. | — |
| **Cancel** | Delete variant requires confirmation if it has configured content. Cannot delete the last variant. | — |
| **Add variant** | `[+]` creates a new conditional variant with `isDefault: false` and opens its editor. | Focus on the new variant's status field. |

##### W11 — Template Editing and Preview

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User types `{{` in a body/header/cookie value field. Monaco shows variable completion. Or user clicks "Preview" in the response editor. | — |
| **Success** | Template renders against the selected sample request (or a default empty context). Preview shows the rendered status, headers, and body. | — |
| **Empty** | No template expressions → body renders as literal text. | — |
| **Loading** | Preview computation is near-instant for bounded templates. | — |
| **Validation** | Unknown helper → inline error. Unclosed `{{` → syntax error marker. Nesting depth > 16 → `AMS-LIMIT-NESTING-DEPTH`. Output > response ceiling → `AMS-LIMIT-RESPONSE-SIZE`. Forbidden access (`__proto__`, `eval`) → `AMS-SCHEMA-INVALID-TYPE`. | — |
| **Error** | Template render failure → preview shows the error message with diagnostic code, not a partial render. | — |
| **Cancel** | Close preview panel. Template source is unchanged. | — |

##### W12 — Simulation (Single and Batch)

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User clicks "Test match" in the Match tab or opens the Simulation modal (`AppModalFrame`) from the toolbar. | Focus moves into the modal. |
| **Success (single)** | One sample evaluated against the draft or committed generation. Trace shows candidates, predicates, policy decision, selected route/response, and rendered output. | — |
| **Success (batch)** | Table of samples evaluated. Each row shows pass/fail against expected outcome. Summary counts at the top. | — |
| **Empty** | No saved samples → prompt to create one manually or import from journal/file. | — |
| **Loading** | Evaluation spinner for large batches (500 samples). Cancel button available. | — |
| **Validation** | Invalid sample request (e.g., missing method) → inline error. Expected outcome fields are optional. | — |
| **Capability gate** | Stateful simulation mode is disabled in MVP with "Phase 7" label. | — |
| **Error** | Engine error → trace shows the error diagnostic. Partial batch results are preserved. | — |
| **Cancel** | Batch cancel stops at the current sample. Results so far are displayed. Close modal discards unsaved changes to samples. | Focus returns to the Match tab. |
| **Recovery** | Failed samples can be re-run individually. Traces are exportable. | — |

##### W13 — Conflict Analysis and Review

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | Automatic after rule edits, imports, or priority changes. Conflict badge updates in route explorer and bottom dock. User opens the Conflicts dock view. | — |
| **Success (conflict-free)** | Badge shows 0 or disappears. Dock view shows "No conflicts found." | — |
| **Success (findings)** | Findings grouped as definite/potential/duplicate/shadowed/unreachable. Each shows affected rules, dimensions, and policy outcome. | — |
| **Empty** | No enabled routes → no analysis needed. | — |
| **Loading** | Analysis runs incrementally. Spinner in badge during computation. | — |
| **Validation** | N/A — analysis is read-only. | — |
| **Capability gate** | N/A. | — |
| **Error** | Analysis timeout on very large rule sets → partial results with a warning. | — |
| **Cancel** | N/A — analysis is automatic and non-blocking. User can close the dock view without affecting the analysis. | — |
| **Acknowledge** | User clicks "Acknowledge" on a deliberate overlap. Tied to both rule fingerprints. Stale after either rule changes → finding reappears with "Stale acknowledgement" indicator. | — |
| **Witness** | "Simulate witness" runs the generated request through W12. | Focus moves to simulation. |
| **Apply gate** | Warn mode: conflict summary shown before Apply; user can proceed. Strict mode: configured severities block Apply until fixed or acknowledged. | Focus on the blocking finding. |

##### W14 — cURL Import

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User opens Import → cURL. Text area appears for paste. | Focus in the text area. |
| **Success** | Parsed cURL produces an inactive route draft and a simulation sample. Review step shows the exact-by-default values, diagnostics, and generalization options. | — |
| **Empty** | Empty paste → disabled Import button. | — |
| **Loading** | Parsing is near-instant. | — |
| **Validation** | Unsupported flags → `AMS-IMPORT-UNSUPPORTED-FIELD` diagnostics listed. File references (`-d @file`) → "File references are not read" warning. Secret-bearing values → redaction warning. | — |
| **Capability gate** | N/A. | — |
| **Error** | Unparseable cURL → error message with the invalid segment highlighted. | — |
| **Cancel** | Close the import dialog. No route created. | Focus returns to the previous view. |
| **Generalize** | User explicitly converts exact path segments to parameters, exact headers to patterns. Never automatic. | — |
| **Confirm** | User selects target server/folder, priority, and response defaults, then confirms. Inactive draft appears in the route explorer. | Focus on the new route. |

##### W15 — OpenAPI/Swagger Import

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | Import → OpenAPI/Swagger. File picker or paste area. | Focus on the input. |
| **Success** | Parsed spec produces multiple inactive route drafts grouped by path/tag. Review step shows operations, generated responses (from examples/defaults/schemas), diagnostics, and conflict analysis against existing routes. | — |
| **Empty** | No valid operations found → message with spec parsing diagnostics. | — |
| **Loading** | Spinner for large specs with many operations. | — |
| **Validation** | Invalid JSON/YAML → parse error. Unsupported OpenAPI features → `AMS-IMPORT-LOSS` warnings. Internal `$ref` resolution failures → per-reference diagnostics. | — |
| **Error** | Completely invalid file → error with no routes generated. | — |
| **Cancel** | Close dialog. No routes created. | — |
| **Confirm** | User selects target server/folder, reviews the semantic diff, and confirms. All drafts become inactive routes. | Focus on the first imported route. |

##### W16 — Catalog/Requests Promotion

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | Import → From Catalog or Import → From Requests. Picker shows available endpoints/items/collections. | Focus in the picker. |
| **Success** | Selected items pass through the canonical source-to-rule conversion pipeline. Review step shows generated routes, samples, and source attribution. | — |
| **Empty** | No Catalog endpoints or Requests items available → empty picker with explanation. | — |
| **Loading** | Spinner for batch promotion of large collections. | — |
| **Validation** | Unsupported request semantics → `AMS-IMPORT-LOSS` diagnostics. Conflict analysis runs against existing routes. | — |
| **Error** | Conversion failure → diagnostic per failed item. Successful items are still offered. | — |
| **Cancel** | Close dialog. No routes created. | — |
| **Confirm** | User selects target server/folder, priority, response defaults. Routes created as inactive drafts with source links. | — |

##### W17 — Native/WireMock Import

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | Import → RedfireForge Definition or Import → WireMock Mappings. File picker. | — |
| **Success (native)** | Schema version validated. If current, routes/samples merge or replace per user choice. If older, migration chain runs. Review shows semantic diff, conflicts, and migration diagnostics. | — |
| **Success (WireMock)** | Supported subset parsed as inactive drafts. Unsupported/different fields listed in loss report. | — |
| **Empty** | Invalid or empty file → error. | — |
| **Loading** | Migration/parsing spinner. | — |
| **Validation** | Future schema version → `AMS-IMPORT-VERSION-UNKNOWN`, rejected. Duplicate IDs → `AMS-SCHEMA-DUPLICATE-ID`. Dangling refs → `AMS-REF-DANGLING-*`. Capability-gated features → `AMS-CAPABILITY-GATED` warnings. | — |
| **Error** | Migration chain failure → atomic reject with collected diagnostics. | — |
| **Cancel** | Close dialog. No changes. | — |
| **Merge/replace/copy** | User chooses: merge (add new, keep existing), replace (overwrite by ID), or import-as-copy (new IDs for everything). Semantic diff preview before confirmation. | — |
| **Confirm** | On confirm, routes/samples are added. WireMock imports remain inactive until the loss report is accepted. | — |

##### W18 — Export (Workspace/Server/Routes)

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User clicks Export in the toolbar. Scope selector: whole workspace, current server, or selected routes. | Focus on scope selector. |
| **Success** | `ApiMockExportV1` JSON file downloaded. Deterministic ordering by ID/key. Fingerprint-stable except `exportedAt`. | — |
| **Empty** | Empty workspace → export contains empty `servers: []`. Valid. | — |
| **Loading** | Brief spinner for large exports. | — |
| **Validation** | N/A — export always succeeds for valid definitions. | — |
| **Error** | File-system write failure (Tauri) or download cancellation → toast with retry. | — |
| **Redaction** | If "Redact secrets" is checked, `_exportMeta.redacted: true`. Sensitive variable values, configured header values, and journal body paths are replaced with `[REDACTED]`. | — |
| **Scope (routes)** | Route-scope export includes associated samples. "Include unassociated samples" checkbox (default off) adds server-level samples without `routeId`. | — |
| **Cancel** | Close dialog. No file downloaded. | — |

##### W19 — Journal Inspection

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User opens the Transactions tab in the bottom dock while a server is running (or has recent history). | Focus on the transaction list. |
| **Success** | Transactions stream in via polling. Each row shows method, path, status, duration, matched route, and outcome badge (matched/unmatched/ambiguous/error). | — |
| **Empty** | No transactions yet → "Send a request to see transactions here." | — |
| **Loading** | Polling spinner. New entries appear at the top. | — |
| **Validation** | N/A — read-only view. | — |
| **Error** | Polling failure → error badge on the dock tab. Auto-retry with backoff. | — |
| **Cancel** | Switching to a different server tab stops polling for the previous server. | — |
| **Select transaction** | Click a row to open detail: request, response, timing, and match explanation. Match explanation shows all candidates, predicate pass/fail tree, policy decision, specificity breakdown, and near misses. | Focus on the detail panel. |
| **Actions** | "Open in Requests" → creates a Requests tab with the captured request. "Create route" → opens W6 with pre-filled method/path/predicates from the request. "Copy" → copies formatted request/response. | — |
| **Clear** | "Clear journal" with confirmation. Transactions are removed from memory. | — |

##### W20 — Redaction and Persistence Settings

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User opens server settings (W4) → Journal/Redaction section. | — |
| **Success** | User edits `redaction.headerNames`, `redaction.jsonPaths`, `journal.persistToDisk`, `journal.maxEntries`, `journal.maxCapturedBodyBytes`, and `journal.retentionSeconds`. | — |
| **Empty** | Default redaction headers pre-populated. `persistToDisk` defaults off. | — |
| **Loading** | N/A — settings are local state. | — |
| **Validation** | JSONPath syntax validated. `maxEntries` and `maxCapturedBodyBytes` cannot exceed hard ceilings (500 / 1 MiB). | — |
| **Capability gate** | N/A. | — |
| **Error** | Persistence failure → toast. | — |
| **Cancel** | Cancel settings modal (W4) discards changes. | — |

##### W21 — Refresh/Reconnect Recovery

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | Browser refresh, companion process restart, or lost WebSocket/polling connection. | — |
| **Success** | UI loads persisted definitions from storage. GET `/api/mock/servers` reconciles runtime state. Tabs that were running and are still running show green dot. Tabs that were running but are now stopped show "Stopped (was running)" reconciliation message. | — |
| **Empty** | No persisted definitions → empty workspace (W1 prompt). | — |
| **Loading** | Companion connectivity check spinner. Tab lifecycle dots show "Unknown" until reconciliation completes. | — |
| **Validation** | N/A. | — |
| **Error (companion down)** | All tabs show Stopped with "Companion unavailable" banner. User can still edit definitions offline. Start/Stop/Apply disabled. | — |
| **Error (stale state)** | Persisted `running: true` but companion says stopped → clear stale state and show reconciliation notice. Never trust persisted runtime state as authoritative. | — |
| **Cancel** | N/A — automatic process. | — |
| **Recovery** | Once companion is available, user can Start servers. Retry button in the banner re-checks connectivity. | — |

##### W22 — LAN Binding Confirmation

| State | Trigger / behavior | Keyboard/focus |
|---|---|---|
| **Entry** | User changes host from `127.0.0.1` to `0.0.0.0` in the server bar (while stopped). | — |
| **Success** | `ConfirmModal` appears: "Bind to all interfaces? This exposes the mock server to your local network." User clicks Confirm → host set to `0.0.0.0`. Always-visible "LAN" badge appears on the server bar and tab. | — |
| **Empty** | N/A. | — |
| **Loading** | N/A. | — |
| **Validation** | N/A — `0.0.0.0` is a valid host value. The confirmation is a safety gate, not a validation. | — |
| **Capability gate** | N/A. | — |
| **Error** | N/A. | — |
| **Cancel** | User clicks Cancel → host reverts to `127.0.0.1`. | Focus returns to the host field. |
| **Start with LAN** | On Start (W2), if host is `0.0.0.0`, a second confirmation appears before the listener actually binds: "Start with LAN exposure? Clients on your network will be able to reach this server." | — |
| **Recovery** | Changing host back to `127.0.0.1` removes the LAN badge immediately. | — |

#### Phase 1 Entry Assumptions

Phase 0G reviews these assumptions before approving Phase 1 start. Phase 1 proceeds only if each assumption holds or is explicitly waived.

1. All `ApiMock*V1` contracts in Section 8 are frozen, schema-versioned, and migration-proof. No contract will change without a `schemaVersion` bump.
2. The fixture corpus under `docs/plan/future/apimock/fixtures/` covers every valid/invalid/boundary case. Phase 1 converts these into executable conformance tests.
3. Every MVP predicate operator in the Section 7.1 matcher matrix has a corresponding seed case in the conformance corpus (Phase 0E deliverable).
4. Response-mode invariants (Section 8.12) are complete and no mode combination is ambiguous.
5. Fingerprint and ordering rules (Section 8.13) are deterministic and reproducible across browsers and Node.
6. Diagnostic codes (Section 8.11) are stable. Phase 1 must not invent new code prefixes; it uses the defined prefixes.
7. The companion server on port 3001 can host API Mock control routes alongside existing WebSocket/gRPC/GraphQL routes without path conflicts.
8. `src/shared/api-mock/` is the canonical location for pure shared engine code. No React, Express, storage, or platform imports.
9. Pattern toolbox and conflict analysis UX are fully specified in the Phase 0C workflow tables and Phase 0D mockups, so Phase 1 builds engine APIs to serve known UI contracts.
10. The eight interactive mockups and `VALIDATION_RECORD.md` provide visual specification sufficient for Phase 3 UI implementation.

#### Artifact Matrix

| Artifact | Canonical location | Completion rule |
|---|---|---|
| Decisions, terminology, requirements, contracts, workflows, security, policies, and handoff | This plan | No contradictory duplicate document; update the owning section and retrospective together. |
| Contract and conformance seed fixtures | `docs/plan/future/apimock/fixtures/` | Parseable, schema-versioned, secret-safe, and linked from the relevant contract/policy section. |
| Interactive visual catalog | `docs/plan/future/apimock/mockups/` | Eight screens plus index/shared assets; direct-open and cross-navigation checks pass. |
| Visual evidence | `docs/plan/future/apimock/mockups/screenshots/` | Named desktop/tablet/mobile screenshots plus a short validation record. |
| Final approval record | Phase tracker and Implementation Retrospective | Date, reviewed artifact set, approved decisions, deferred items, and resulting commit hash. |

Deliverables:

1. Reconcile all requirements with MVP/deferred capability boundaries and freeze the decision register.
2. Finalize complete versioned contracts, invariants, diagnostics, fixtures, and limits.
3. Complete all eight interactive HTML mockups, including the dedicated desktop/tablet/mobile responsive-layout screen, under `docs/plan/future/apimock/mockups/`.
4. Validate tab/server/route/journal/import/simulation/conflict workflows against existing design and accessibility patterns.
5. Define import conflict, merge/replace/copy, exact-by-default generalization, and variable precedence policies.
6. Define the matcher conformance schema and seed cases shared by preview/runtime/CLI; Phase 1 expands these into the executable operator corpus.
7. Specify ambiguity-response defaults, equal-priority behavior, conflict certainty, acknowledgement invalidation, and trace redaction.
8. Capture real-Chrome desktop/tablet/mobile evidence and record final user approval.

Acceptance:

- [ ] Section 14 contains adopted/pending status for every Phase 0 decision; no MVP requirement depends on an unowned pending decision.
- [ ] Contracts satisfy Section 8.3, cover every MVP requirement without persisted `any`/`unknown`, and reject unsupported future capabilities explicitly.
- [ ] Parseable fixtures cover empty workspace, valid server, every response mode, boundaries, invalid references/IDs, redaction, deterministic ordering, and unknown future schema versions.
- [ ] All eight catalog screens and shared assets exist, open directly, and have no broken links.
- [ ] Mockups include stopped, starting, running, dirty, applying, draining, error/port-conflict, no-match, ambiguity, and empty states.
- [ ] Mockups show strict multiple-match rejection, highest-priority selection, equal-priority rejection, specificity tie resolution, and sanitized explanations.
- [ ] Conflict UX includes conflict-free, definite, potential, duplicate, shadowed, unreachable, acknowledged, stale-acknowledgement, witness, and import-review states.
- [ ] Import UX shows cURL diagnostics, exact-by-default values, explicit generalization, destination/defaults, semantic diff, conflicts, cancel, and inactive-draft confirmation.
- [ ] Journal/settings UX shows matched/unmatched/ambiguous/error transactions, near misses, generation, retention/truncation, redaction, reconciliation, CORS, fallback, and LAN warning states.
- [ ] Section 5.13 keyboard/focus behavior is reflected in semantic mockup markup, including accessible names, tab/tree roles, Escape, focus containment, and focus restoration.
- [ ] Real Chrome evidence at `1280x900`, `768x1024`, and `375x812` shows readable text, stable dimensions, and no incoherent overlap or clipped critical actions.
- [ ] Final user approval is recorded after reviewing contracts, policies, all eight screens, validation evidence, and deferred decisions.

### Phase 1 - Shared Matcher Engine

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 1A | Implement canonical contracts, defaulting, structural/semantic validation, fingerprints, and pure schema migrations in `src/shared/api-mock/`. **Completed 2026-08-11.** | 0G | Fixture round-trips are deterministic; invalid regex/schema/references/limits fail with stable field-level diagnostics. |
| 1B | Implement request normalization: pure function converting raw HTTP inputs (method, URL, headers, cookies, body bytes) into `ApiMockCapturedRequestV1` and the `normalizedRequest` summary used by the match explanation. Covers method uppercasing, raw/decoded path splitting, query-string parsing with repeated keys, header key lowercasing with repeated values, cookie parsing, content-type extraction, body-size tracking, and truncation metadata. Security metadata (auth scheme, bearer claims, API-key extraction) is derived from normalized headers during predicate evaluation (Phase 1C), not stored separately. **Completed 2026-08-11.** | 1A | Normalization is deterministic: identical raw inputs always produce identical normalized outputs regardless of platform (browser `Request` vs Node `IncomingMessage` vs manual construction). |
| 1C | Implement predicate trees and pattern utilities for method/path/query/header/cookie/security/text/JSON/form/multipart/binary MVP operators. **Completed 2026-08-11.** | 1B | Every source/operator has positive, negative, negated, empty, repeated-value, invalid-config, and limit tests. |
| 1D | Implement specificity, priority/ambiguity policies, response selection, near misses, and structured match explanations. **Completed 2026-08-11.** | 1C | Ordering is insertion-independent; both multiple-match and equal-priority policies pass deterministic golden traces. |
| 1E | Implement conservative conflict analysis for duplicate, definite/potential overlap, shadowed, and unreachable rules, including witness generation and fingerprint acknowledgements. **Completed 2026-08-11.** | 1C, 1D | Proven overlaps reproduce through the evaluator; undecidable intersections remain Potential; stale acknowledgements invalidate after edits. |
| 1F | Implement side-effect-free single/batch simulation and canonical normalized-source-to-rule conversion interfaces. **Completed 2026-08-11.** | 1D, 1E | Draft/committed simulations produce identical decisions for identical snapshots and cannot mutate state, counters, sequences, journals, or network. |

Deliverables:

1. Validation and migration framework.
2. Request normalization.
3. Predicate tree evaluator.
4. Priority, configurable multi-match rejection/selection, equal-priority handling, and deterministic specificity tie-breaking.
5. Static response selection and match explanations.
6. Side-effect-free single and batch simulation API with saved samples and expected outcomes.
7. Pure pattern-authoring utilities and conservative static conflict analyzer.
8. Canonical normalized-source-to-rule conversion contract.

Acceptance:

- [ ] Conformance tests cover every MVP source/operator combination.
- [ ] Candidate ordering is stable regardless of object insertion order.
- [ ] Both multi-match policies and both equal-priority policies pass the same GUI/runtime/CLI conformance cases.
- [ ] Ambiguity rejection cannot mutate route, variant, counter, sequence, or scenario state.
- [ ] Invalid regex/schema cannot enter a committed snapshot.
- [ ] Near-miss explanations identify failed predicates.
- [ ] Simulation traces identify every candidate and predicate without exposing configured secrets.
- [ ] Conflict tests cover disjoint, duplicate, definite overlap, priority shadowing, unreachable conditions, and unknown regex/schema intersections.
- [ ] Every definite finding includes reproducible evidence; uncertain intersections are labeled potential rather than definite.
- [ ] All touched production files exceed 90% statements/branches/functions/lines coverage.

### Phase 2 - Multi-Port HTTP Runtime and Control Plane

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 2A | Build the Node request adapter and `ApiMockNetworkListener` skeleton with bounded streaming, raw/parsed capture, abort handling, and shared-engine invocation. **Completed 2026-08-11.** | 1B-1D | Real ephemeral-port tests cover methods, repeated headers/query, body limits, malformed input, and client abort. |
| 2B | Build `ApiMockServerPool` keyed by `serverId`, with port reservation, start/stop/status/list, ownership checks, and `stopAllAsync`. **Completed 2026-08-11.** | 2A | Multiple ports coexist; duplicate-port failures preserve the owner; repeated stop/shutdown is idempotent and leak-free. |
| 2C | Add typed control-plane routes and `apiMockControlClient` for start/stop/restart/status/list/probe with standard server envelopes. **Completed 2026-08-11.** | 2B | Route tests cover valid, invalid, missing, stale, and cross-server ownership requests; browser client maps errors consistently. |
| 2D | Add validated atomic commit, generation fingerprints, in-flight snapshot pinning, graceful drain, and refresh/process reconciliation. **Completed 2026-08-11.** | 2B, 2C | Concurrent integration test proves old requests finish on the old generation while new requests use the new one. |
| 2E | Complete HTTP semantics: CORS/preflight, HEAD, default/ambiguity responses, connection limits, timer cleanup, and companion shutdown integration. **Completed 2026-08-11.** | 2D | Socket-level tests pass for CORS/HEAD/limits/drain; two-server lifecycle scenario completes without open handles. |

Deliverables:

1. `ApiMockNetworkListener` and `ApiMockServerPool`.
2. Start/stop/restart/status/list/commit/probe control endpoints.
3. Port reservation and conflict diagnostics.
4. Atomic generation commit and in-flight snapshot pinning.
5. Graceful drain and `stopAllAsync` shutdown integration.
6. Loopback CORS and HEAD/OPTIONS correctness.

Acceptance:

- [ ] Two servers run simultaneously on different ports and return different route sets.
- [ ] Duplicate port start fails without disturbing the existing owner.
- [ ] Hot commit changes only subsequent requests.
- [ ] Companion shutdown releases all ports and timers.
- [ ] Browser UI can control listeners through port 3001.

### Phase 3 - Studio Shell, Tabs, and Route CRUD

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 3A | Register navigation/lazy loading, create `ApiMockStudioPage`, shared selectors, page shell, error boundary, and empty/loading states. **Completed 2026-08-11.** | 0D, 2C | Navigation and lazy-load component tests pass; shell renders without runtime access and reports companion unavailability clearly. |
| 3B | Implement accessible server tabs, create/rename/duplicate/reorder/close, port allocation, lifecycle bar, dirty generation state, persistence, and reconciliation. **Completed 2026-08-11.** | 3A, 2D | Mouse/keyboard tab tests pass; refresh and duplicate/close-running flows affect only the intended stable `serverId`. |
| 3C | Implement route/folder explorer, search/filter, CRUD, reorder-for-organization, enable/disable, badges, context actions, and safe selection recovery. **Completed 2026-08-11.** | 3B, 1A | Tree mutation tests cover empty/deleted/filtered selections, nested folders, duplication IDs, and undoable confirmation flows. |
| 3D | Implement Match tab with request line, priority, ALL/ANY/NOT groups, basic predicates, variable insertion, and shared pattern toolbox. **Completed 2026-08-11.** | 3C, 1C | Component tests prove visual edits serialize to canonical predicates and invalid drafts cannot Apply. |
| 3E | Implement server settings and ambiguity response, incremental conflict badges/dock, witness simulation, fixes, and fingerprint acknowledgement. **Completed 2026-08-11.** | 3D, 1E-1F | Definite/potential/acknowledged/stale states render correctly; strict mode blocks only configured severities. |
| 3F | Complete responsive route drawer, stable compact controls, focus management, tooltips, and 1280x900/tablet/mobile visual verification. **Completed 2026-08-11.** | 3A-3E | Keyboard-only core workflow passes; Chrome screenshots show no clipping, overlap, nested cards, or viewport-scaled text. |

Deliverables:

1. Navigation registration and lazy page composition.
2. Accessible eight-tab workspace with per-tab ports and lifecycle state.
3. Persisted server definitions and tab shell.
4. Route folder tree, search, CRUD, duplicate, enable/disable.
5. Match builder for method/path/query/header/cookie/security and basic body matchers.
6. Server settings modal using `AppModalFrame` and two-tone rows.
7. Selection-policy controls with an editable ambiguity response.
8. Pattern toolbox, route conflict badges, and docked conflict inspector with simulation/fix actions.

Acceptance:

- [ ] All tab operations work by mouse and keyboard.
- [ ] Refresh restores definitions but reconciles actual runtime state.
- [ ] Closing a running tab confirms and stops the correct `serverId` only.
- [ ] Empty/null/migration failures recover to one valid default server.
- [ ] Chrome screenshots at 1280x900 plus tablet/mobile show no overlap.
- [ ] Pattern and conflict tools follow `builder-tabs`, `count-badge`, two-tone rows, `AppModalFrame`, Lucide icon, tooltip, keyboard, and focus conventions.

### Phase 4 - Responses, Templates, and Latency

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 4A | Implement response-variant contracts/UI for static and conditional modes, default enforcement, status/reason/content type, duplicate/reorder/enable, and validation. **Completed 2026-08-11.** | 1D, 3D | Exactly one valid default is enforced where required; invalid/mutually exclusive modes cannot serialize or Apply. |
| 4B | Add Monaco editors for JSON/XML/text/HTML, binary-base64/file references, formatting/search/undo/redo, content validation, and bounded previews. **Completed 2026-08-11.** | 4A | All content types round-trip; invalid JSON/XML/base64 and unsafe file references produce field-level errors. |
| 4C | Add repeated response headers and full cookie editor for domain/path/expiry/max-age/Secure/HttpOnly/SameSite. **Completed 2026-08-11.** | 4A | Listener tests preserve repeated headers and emit standards-compliant `Set-Cookie` values across edge combinations. |
| 4D | Implement restricted template parser, curated helpers, variable completion, deterministic seed/Faker subset, execution/output limits, and sample preview. **Completed 2026-08-11.** | 4B, 1F | Template golden corpus matches browser/server output; forbidden access, prototype keys, timeout, depth, and output limits fail safely. |
| 4E | Implement fixed delay, jitter/distribution, bounded long-running response, cancellation, and virtual simulation timeline. **Completed 2026-08-11.** | 2E, 4A | Timer/cancellation tests show no leaks; simulation reports timing without waiting; timeout fault remains semantically distinct. |
| 4F | Integrate live validation, response preview, dirty state, atomic Apply, and generation-aware error recovery across response edits. **Completed 2026-08-11.** | 4B-4E, 2D | Invalid drafts never replace runtime; successful Apply changes only subsequent requests and preserves editor state on failure. |

Deliverables:

1. Multiple response variants.
2. Monaco body editor and `KeyValueEditor` headers/cookies.
3. Restricted template parser/helpers with preview.
4. Fixed latency and jitter.
5. Deterministic seed and Faker subset.
6. Live validation and atomic Apply workflow.
7. Response-cookie attributes and bounded long-running response controls.

Acceptance:

- [ ] Invalid drafts do not replace the running generation.
- [ ] Template preview and runtime output pass the same conformance corpus.
- [ ] JSON/XML/text/binary content types round-trip through export/import.
- [ ] Repeated headers and cookies are preserved.
- [ ] Long-running responses remain cancellable and are distinct from timeout/no-response faults.

### Phase 5 - Journal and Match Debugger

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 5A | Implement bounded per-server transaction journal with cursor IDs, truncation metadata, generation/rule/variant IDs, timing, outcomes, and immutable explanations. **Completed 2026-08-11.** | 2D-2E, 1D | Cap, eviction, cursor, concurrent append, clear, body truncation, and generation-pinning tests pass. |
| 5B | Add transaction control endpoints/client polling with visibility gating, cancellation, cursor deduplication, refresh reconciliation, and error backoff. **Completed 2026-08-11.** | 5A, 2C | Polling tests prove no duplicates, no updates after unmount/server switch, and bounded retry behavior. |
| 5C | Build docked/floating/maximized journal shell, transaction table, search/filter, mode persistence, clear/export, and runtime badges. **Completed 2026-08-11.** | 5B, 3F | All entry points receive correct `serverId`; modal/dock layering, drag/resize, keyboard focus, and empty states pass. |
| 5D | Build request/response/timing/match-explanation details, candidate/predicate tree, near misses, copy, replay in Requests, and create-rule-from-transaction. **Completed 2026-08-11.** | 5C, 1D | Matched/unmatched/ambiguous/fault/error fixtures render complete and redacted explanations with working promotions. |
| 5E | Build saved simulation samples, expected-outcome editor, batch runner, assertion summary, trace viewer, and trace export/import. **Completed 2026-08-11.** | 1F, 5D | GUI batch output matches pure-engine corpus; failed expectations identify exact rule/variant/status/header/body differences. |
| 5F | Add configurable redaction, optional capped persistence, retention/clear controls, migration, and secret-leak scanning. **Completed 2026-08-11.** | 5A-5E | Persistence defaults off; exported/persisted fixtures contain no configured secrets and honor cap/retention after restart. |

Deliverables:

1. Bounded cursor-based transaction journal.
2. Docked/floating/maximized journal UI.
3. Request, response, timing, and match explanation views.
4. Search, filters, pretty-print, copy, export, clear.
5. “Create route from transaction” and “Open in Requests.”
6. Redaction and retention controls.
7. Saved-sample simulation table, expected outcomes, batch run, and exportable trace viewer.

Acceptance:

- [ ] Every matched/unmatched/faulted request has a complete explanation.
- [ ] Ambiguous requests and dry-run simulations show the same candidate and policy trace format as live traffic.
- [ ] Polling cannot duplicate entries and stops when no relevant view is active.
- [ ] Journal cap and body truncation hold under sustained traffic.
- [ ] Exported/persisted logs pass secret-leak scanning.

### Phase 6 - cURL, OpenAPI, Catalog, and Requests Integration

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 6A | Implement canonical source normalization and source-to-rule/sample conversion with provenance, exact-by-default behavior, hierarchy, destination, priority, and response defaults. **Completed 2026-08-11.** | 1F, 3C-3D | Equivalent source fixtures produce equivalent canonical predicates/samples; generated rules remain inactive drafts. |
| 6B | Extend shared cURL parsing with structured diagnostics, query/cookie/security/form fidelity, unsupported-flag reporting, secret handling, and reviewed generalization. **Completed 2026-08-11.** | 6A | Multiline/quoted/escaped cURL corpus passes; file/cert references are never read; ignored semantics are always reported. |
| 6C | Implement Swagger/OpenAPI import, operation/example/default/schema extraction, internal refs, source attribution, and unsupported-feature warnings. **Completed 2026-08-11.** | 6A | Swagger 2/OpenAPI 3 fixtures generate valid inactive drafts and never silently discard unsupported semantics. |
| 6D | Implement Catalog endpoint/version and batch promotion with hierarchy preservation, auth/schema/example mapping, destination selection, and source links. **Completed 2026-08-11.** | 6A, 6C | Single and batch tests preserve endpoint/version metadata and produce usable rules/samples without persisting transient Requests objects. |
| 6E | Implement Requests item/folder/collection promotion and journal conversion through the same pipeline, including environment-variable decisions and default responses. **Completed 2026-08-11.** | 6A, 5D | Single/batch conversion preserves hierarchy and supported request semantics; equivalent cURL/Request input remains canonical-equivalent. |
| 6F | Implement the declared WireMock import subset and build unified import review for cURL/OpenAPI/Catalog/Requests/native/WireMock: semantic diff, generalization, merge/replace/copy, conflicts, warnings/losses, and confirmation. **Completed 2026-08-11.** | 6B-6E, 1E | No import activates before confirmation; WireMock differences are explicit; accepted imports round-trip stable IDs/order/policies/samples. |

Deliverables:

1. cURL import through an extended shared `parseCurl` result, diagnostics, rule review, and sample generation.
2. OpenAPI/Swagger import through `parseOpenApiSpec`.
3. Example/default/schema response generation with source attribution.
4. Merge/replace preview and conflict resolution.
5. Catalog endpoint/version and batch endpoint -> mock rule promotion.
6. Requests item/folder/collection -> mock rule promotion.
7. Canonical source-to-rule conversion used by cURL, Catalog, Requests, and journal entries.
8. OpenAPI and RedfireForge export.
9. Native workspace/server/rule import modes with version migration, conflict preview, and validation report.
10. WireMock subset import with compatibility and loss diagnostics.

Acceptance:

- [ ] Imported operations remain inactive drafts until review confirmation.
- [ ] cURL import preserves supported request semantics, lists every ignored flag, redacts secrets, and never reads referenced files.
- [ ] Equivalent cURL, Catalog, and Request inputs produce equivalent normalized predicates and samples.
- [ ] Batch Catalog/Requests promotion preserves hierarchy/source links and lets the user choose target server, folder, priority, and response defaults.
- [ ] Unsupported OpenAPI details produce warnings, not silent loss.
- [ ] Internal references and examples generate valid route definitions.
- [ ] Round-trip preserves stable IDs and deterministic ordering.
- [ ] Round-trip preserves priorities, selection policies, response behavior, samples, and expected outcomes.

### Phase 7 - Stateful, Sequence, Probability, and Faults

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 7A | Implement server-scoped scenario state/counters, transition guards, atomic transition API, reset, initial state, and state journal view. **Completed 2026-08-11.** | 2D, 4A, 5A | Concurrent matched requests cannot corrupt transitions/counters; rejected/unmatched/preview requests never mutate state. |
| 7B | Implement sequential/cycling response selection, exhaustion policies, per-route reset, and visible sequence position. **Completed 2026-08-11.** | 7A | Concurrent selection is deterministic under the declared policy; reset and export/import preserve intended sequence configuration. |
| 7C | Implement weighted/probabilistic selection, deterministic seeds, match-count limits, expiry/TTL, and eligibility explanations. **Completed 2026-08-11.** | 7A | Seeded distributions are reproducible; statistical smoke bounds pass; expired/exhausted variants are excluded and explained. |
| 7D | Implement timeout/no-response, close, reset, and malformed response faults with platform capability reporting. **Completed 2026-08-11.** | 2E, 4E | Real socket integration tests distinguish every fault and prove abort/shutdown cleanup; unsupported faults cannot be selected. |
| 7E | Implement bounded chunk/dribble schedules, state/sequence/probability/fault UI, mutual-exclusion guards, trace timeline, and concurrency soak. **Completed 2026-08-11.** | 7B-7D | Payload/duration ceilings hold; UI cannot create invalid mode combinations; socket-level and simulation traces agree. |

Deliverables:

1. Scenario state-machine editor and runtime.
2. Sequential/cycling responses and reset.
3. Weighted/probabilistic responses with deterministic seed option.
4. Match count/TTL.
5. Timeout, close/reset, malformed, and dribble faults.
6. State/counter journal view.
7. Scheduled chunk streaming with bounded payload and duration limits.

Acceptance:

- [x] Concurrent requests cannot corrupt scenario transitions/counters. *(Listener keeps scenario/sequence/matchCounts on the single-threaded request path; unit coverage in `apiMockScenarioState.test.ts` + listener coverage gaps.)*
- [x] Reset is server-scoped and immediately visible. *(Control `POST …/state/reset` + dock Reset state; clears scenario, sequence positions, and match counts.)*
- [x] Sequence and weighted modes are mutually exclusive in contracts and UI. *(Mode switch clears incompatible weight/conditions fields in Response Editor.)*
- [x] Fault behavior has socket-level integration tests, not unit tests only. *(`apiMockFaultExecutor.test.ts` + listener reset-fault coverage.)*

### Phase 8 - Export, CLI, CI, and Verification

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 8A | Finalize native JSON/YAML workspace/server/rule/sample export, deterministic ordering, redaction, schema migration, semantic diff, and stable filenames. **Completed 2026-08-11.** | 6F, 7E | Native round-trip preserves all supported semantics and produces deterministic source-control diffs with no secrets. |
| 8B | Add `redfireforge mock start` for one/many definitions, port overrides, readiness/status JSON, health checks, and clean signal handling. **Completed 2026-08-11.** | 2E, 8A | CLI integration tests cover success, partial startup rollback, port override immutability, SIGINT/SIGTERM drain, and exit codes. |
| 8C | Add CLI simulation and verification commands for samples, call count, last call, headers/body, JUnit/JSON output, and trace artifacts. **Completed 2026-08-11.** | 5E, 8B | CLI and GUI produce identical corpus outcomes/traces; assertion failures are machine-readable and actionable. |
| 8D | Implement supported WireMock export mapping, extend the Phase 6 import compatibility matrix, and report priority/scenario/template translations and every loss exhaustively. **Completed 2026-08-11.** | 6F, 8A | Golden mappings round-trip within the declared subset; every omitted or behaviorally different field appears in the report. |
| 8E | Add Docker examples, readiness probes, CI workflows, sample definitions, CLI documentation, and packaged-runtime smoke tests. **Completed 2026-08-11.** | 8B-8D | Fresh-container examples start, verify, and terminate cleanly on macOS/Linux CI without mutating source definitions. |

Deliverables:

1. `redfireforge mock start <file>` CLI command.
2. Multi-definition startup with port overrides and readiness JSON.
3. Route call-count verification API and CLI assertions.
4. WireMock compatibility export/import subset with loss report.
5. Docker-friendly signal handling and health check.
6. CI examples and sample definitions.
7. Headless sample simulation command with machine-readable assertion and trace output.

Acceptance:

- [ ] GUI and CLI produce identical matching results from the conformance corpus.
- [ ] SIGINT/SIGTERM drains listeners and exits cleanly.
- [ ] Port override does not mutate the source definition.
- [ ] Lossy compatibility conversions list every omitted feature.
- [ ] Imported WireMock rules remain inactive until the compatibility report is accepted.
- [ ] CLI batch simulation produces the same outcomes and traces as the GUI.

### Phase 9 - Proxy, Recording, and Callbacks (Deferred — Security Gate)

Phase 9 is deferred until the threat model (9A) is produced and explicitly approved. Sub-phases 9B-9E involve outbound network requests, credential forwarding, and callback invocation that require human security review before any production code is written. The threat model covers SSRF, DNS rebinding, redirect chains, self/control-plane recursion, private-range blocking, credential stripping, payload limits, and callback abuse vectors.

#### 9A Threat Model

**Scope:** Phase 9 adds three outbound-request capabilities to API Mock Studio: (1) unmatched-request proxy to a configured upstream, (2) outbound callback/webhook invocation after response selection, and (3) HAR import producing route drafts from captured traffic. Each creates attack surface not present in Phases 0-8 where all mock responses are locally generated.

**Threat 1 — Server-Side Request Forgery (SSRF)**

| Vector | Description | Mitigation |
|---|---|---|
| Cloud metadata | Proxy/callback URL resolves to `169.254.169.254`, `metadata.google.internal`, or cloud-provider metadata endpoints | Reuse and extend `ServerOutboundUrlPolicy` from `src-server/grpc/serverOutboundUrlPolicy.ts`; block all link-local (`169.254.0.0/16`), metadata hostnames, and AWS/GCP/Azure metadata IPs by default |
| Private networks | URL resolves to `10.x`, `172.16-31.x`, `192.168.x`, or `127.x` | Block private IPv4 ranges by default; explicit per-server allowlist required to reach any private destination |
| IPv6 loopback/link-local | `::1`, `fe80::` | Block `::1` and `fe80::/10` |
| DNS rebinding | Hostname resolves to a public IP at policy-check time but to a private IP at connect time | Resolve hostname to IP before policy check AND pin the resolved IP for the actual connection (no second DNS lookup) |

**Threat 2 — Self/Control-Plane Recursion**

| Vector | Description | Mitigation |
|---|---|---|
| Self-proxy loop | Mock server on `:4600` proxies to `http://localhost:4600` creating infinite recursion | Block any URL whose resolved host:port matches any active API Mock listener or the control plane (`:3001`) |
| Cross-mock loop | Server A proxies to Server B which proxies back to Server A | Limit proxy chain depth to 1 (no re-proxying); add `X-RedfireForge-Mock: true` header to proxied requests and reject inbound requests bearing it |

**Threat 3 — Credential Leakage**

| Vector | Description | Mitigation |
|---|---|---|
| Authorization forwarding | `Authorization: Bearer <real-token>` in the original request is forwarded to the upstream | Strip `Authorization`, `Cookie`, `Proxy-Authorization`, `X-API-Key` headers from proxied requests by default; user must explicitly opt-in per-server to forward specific headers |
| Cookie forwarding | Session cookies forwarded to arbitrary upstreams | Same as authorization; strip cookies by default |
| Set-Cookie injection | Upstream sets cookies that the browser applies to the mock origin | Strip `Set-Cookie` from proxied responses unless explicitly allowed |

**Threat 4 — Redirect Abuse**

| Vector | Description | Mitigation |
|---|---|---|
| Open redirect | Upstream returns 302 to a malicious URL | Limit redirect follows to 5 (configurable, ceiling 10); re-validate every redirect target through the same SSRF policy |
| Redirect to private | Initial URL is public but redirects to `192.168.x` | Every redirect hop re-evaluates the full URL policy including DNS resolution |

**Threat 5 — Callback Abuse**

| Vector | Description | Mitigation |
|---|---|---|
| DDoS amplification | A route callback POSTs to a victim URL on every matched request | Callbacks require an explicit per-server allowlist of permitted destination hosts; no wildcard `*` allowlist |
| Retry storms | Callback failure triggers unbounded retries | Max 3 retries with exponential backoff (1s, 4s, 16s); configurable ceiling; failure is recorded but does not block the mock response |
| Callback SSRF | Callback URL points to cloud metadata or private network | Same SSRF policy as proxy; all callback URLs validated before invocation |

**Threat 6 — Payload and Resource Limits**

| Resource | Default limit | Hard ceiling |
|---|---|---|
| Proxied response body | 1 MiB | 10 MiB (same as generated response) |
| Callback request body | 64 KiB | 256 KiB |
| Proxy/callback timeout | 10 seconds | 60 seconds |
| Redirect chain depth | 5 | 10 |
| Concurrent outbound connections per server | 10 | 50 |
| Callback retries | 3 | 5 |

**Threat 7 — HAR Import**

| Vector | Description | Mitigation |
|---|---|---|
| Embedded secrets | HAR files contain full request/response headers including `Authorization`, cookies, and API keys | Apply the same redaction pipeline as journal export; warn on import with `AMS-REDACTION-SECRET-DETECTED`; imported entries are inactive drafts |
| Embedded scripts | Some HAR variants contain JavaScript content or post-data with injection payloads | Never execute imported content; treat all imported bodies as opaque text; validate structure against the supported HAR subset |
| Large capture files | HAR files from extended browser sessions can be hundreds of MB | Reject files exceeding 50 MiB; parse incrementally and stop after 5,000 entries |

**Cross-cutting policy decisions requiring approval:**

1. **Default-deny outbound:** No proxy, callback, or recording is active until Phase 9 settings are explicitly configured. Zero outbound requests from API Mock in Phases 0-8.
2. **Allowlist-only destinations:** Both proxy upstreams and callback URLs must appear in a per-server allowlist. No wildcard patterns.
3. **DNS-pinning on connect:** Resolve hostname once, validate the IP, and use the resolved IP for the actual connection.
4. **Hop-by-hop stripping:** Remove `Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailer`, `Transfer-Encoding`, and `Upgrade` from proxied requests/responses.
5. **Credential stripping by default:** `Authorization`, `Cookie`, `Proxy-Authorization`, `X-API-Key`, and `X-Auth-Token` are stripped from proxied requests unless the server's allowlist explicitly permits them.
6. **Anti-recursion header:** Proxied requests carry `X-RedfireForge-Mock: true`; inbound requests with this header on any mock listener are rejected with 508 Loop Detected.
7. **Failure isolation:** Proxy/callback network errors never corrupt the selected mock response, scenario state, or journal. They produce a diagnostic transaction entry with the error but the mock response is still delivered.

**Existing infrastructure to reuse:**
- `ServerOutboundUrlPolicy` and `ServerOutboundDnsValidationOptions` in `src-server/grpc/serverOutboundUrlPolicy.ts` — generalize to `src-server/shared/outboundUrlPolicy.ts` for API Mock proxy/callback use.
- Redaction pipeline from `ApiMockTransactionJournal` — apply to proxied traffic and HAR imports.

**Approval required:** The 7 cross-cutting policy decisions above must be reviewed and approved before Phase 9B-9E implementation begins.

**Approval record — 2026-08-11:** All 7 policies approved with the following modifications:
1. Default-deny outbound — Adopted as-is.
2. Allowlist-only destinations — Adopted; proxy uses host+scheme level allowlist (not per-path); callbacks use strict per-URL list; no wildcards.
3. DNS-pinning on connect — Adopted as-is.
4. Hop-by-hop header stripping — Adopted as-is.
5. Credential stripping by default — Adopted; add a visible badge (like LAN badge) when credential forwarding is enabled on a server.
6. Anti-recursion header — Adopted; also check outbound before sending to avoid wasted round-trip.
7. Failure isolation — Adopted as-is.

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 9A | Produce threat model and policy for SSRF, DNS rebinding, redirects, self/control-plane recursion, credentials, private ranges, payload limits, and callback abuse. **Completed 2026-08-11.** | Phase 8 complete | Security review approves explicit allowlist/default-deny behavior and identifies platform-specific residual risks. |
| 9B | Implement allowlisted unmatched proxy with hop-by-hop stripping, bounded redirects/bodies/timeouts, TLS policy, and sanitized journal evidence. **Completed 2026-08-11.** | 9A | Integration tests block metadata/link-local/self/control destinations and preserve permitted request/response semantics. |
| 9C | Capture proxied traffic as inactive route/sample drafts with redaction, deduplication, review, generalization, and conflict analysis. **Completed 2026-08-11.** | 9B, 6F | Recorded secrets are redacted; no draft activates automatically; duplicate/conflicting captures are explained before import. |
| 9D | Add typed request/response transformations and outbound callbacks with retries, timeout, allowlist, trace, and failure isolation. **Completed 2026-08-11.** | 9A-9B, 7A | Callback/transform failures cannot corrupt the selected response or state; policy and resource limits hold under retries. |
| 9E | Evaluate and implement the safe HAR import/export subset with compatibility/loss report and captured-flow workflow. **Completed 2026-08-11.** | 9C | Supported HAR fixtures round-trip; cookies/auth/content losses are explicit; imported entries remain inactive drafts. |

Deliverables:

1. Allowlisted unmatched proxy.
2. Capture upstream responses as inactive route drafts.
3. Request/response transformations through typed rules.
4. Outbound callbacks/webhooks.
5. HAR import/export evaluation.

Gate: complete threat model and SSRF/security review before implementation.

### Phase 10 - HTTPS and Native Tauri Parity (Deferred)

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 10A | Finalize TLS/mTLS contracts, certificate source/storage model, secret masking, capability negotiation, and modal UX. **Completed 2026-08-11.** | Phase 8 complete | No PEM secret enters normal exports/logs; invalid/missing/expired certificates produce actionable validation. |
| 10B | Add Node HTTPS listener with generated/imported certificates, TLS versions/ciphers defaults, hot-restart policy, and HTTPS status metadata. **Completed 2026-08-11.** | 10A, 2E | Real TLS clients pass trusted/untrusted/hostname/version cases; listener cleanup and port ownership match HTTP behavior. |
| 10C | Add optional mTLS and client-certificate match attributes with safe subject/SAN/fingerprint exposure and redacted traces. **Completed 2026-08-11.** | 10B, 1C | Required/optional/invalid client-cert cases pass; private key and raw certificate material never appear in traces. |
| 10D | Implement native Rust listener adapter using the serialized shared contract, Tauri lifecycle/storage integration, and explicit capability differences. **Deferred — requires Rust/Tauri platform work.** | 10A, stable Phase 1 corpus | Native listener passes core start/stop/match/respond/journal cases without creating a second UI contract. |
| 10E | Run TypeScript/native parity corpus for matching, selection, templates, state, errors, limits, and TLS; document or close every divergence. **Deferred — depends on 10D.** | 10C-10D | No unexplained behavioral divergence remains; users see capability warnings before applying unsupported definitions. |

Deliverables:

1. HTTPS listener with generated or imported certificates.
2. Optional mTLS client-certificate matching.
3. Native Rust listener using the shared serialized contract/conformance corpus.
4. TypeScript/native parity matrix.

Gate: do not introduce a native matcher implementation until the TypeScript contracts and corpus are stable.

### Phase 11 - Workflow and Test Runner Integration

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 11A | Add Workflow lifecycle nodes for Start Mock, Apply Definition, Reset State, and Stop Mock with variable outputs and shared modal patterns. **Completed 2026-08-11.** | Phases 2-4, 8A | Node config/engine tests cover success, validation failure, cancel, timeout, and idempotent cleanup. |
| 11B | Add Assert Mock Calls node/API for count, last-call time, route/variant, headers, body, and shared matcher predicates. **Completed 2026-08-11.** | 5A, 8C, 11A | Assertion failures include expected/actual plus matching near misses and direct transaction links. |
| 11C | Add Test Runner setup/teardown fixture integration, automatic port allocation, definition/sample selection, and fail/cancel cleanup. **Completed 2026-08-11.** | 11A-11B | Cleanup runs on pass/fail/cancel/timeout; fixture failure prevents dependent tests with a clear cause. |
| 11D | Add parallel-run isolation, result artifacts, links to journal/simulation traces, and workflow/test documentation/examples. **Completed 2026-08-11.** | 11C | Concurrent runs receive isolated server IDs/ports/state; results remain navigable after runtime shutdown. |

Deliverables:

1. Workflow nodes: Start Mock, Apply Definition, Reset State, Stop Mock, Assert Calls.
2. Test Runner setup/teardown fixture integration.
3. Route call-count/header/body verification using shared matchers.
4. Results links back to matching transactions.

Acceptance:

- [x] Cleanup runs after pass, fail, cancel, and timeout.
- [x] Parallel tests receive isolated server IDs/ports/state.
- [x] Verification failures include matching near misses.

### Phase 12 - Hardening, Accessibility, Documentation, and Demos

#### Detailed Sub-Phases

| ID | Scope and concrete output | Depends on | Focused validation and exit criteria |
|---|---|---|---|
| 12A | Establish performance budgets and optimize startup/matching/commit/journal for 100/500/2,000 rules and eight concurrent servers. Budgets are frozen in Section 12.3.1 and mirrored in `perfBudgets.ts`; optimizations cover cached pattern compilation, single-pass base-path stripping, indexed route lookup, per-request body-parse memoization, and a bounded journal ring buffer. **Completed 2026-08-12.** | MVP phases complete | p95 budgets and memory ceilings in Section 12.3.1 pass with representative exact/regex/JSONPath/json_subset mixes (schema operators deferred per Phase 1) and no leaked ports/timers/listeners. |
| 12B | Complete WCAG keyboard, focus, accessible-name, contrast, reduced-motion, screen-reader, responsive, and zoom audit across all workflows. **Completed 2026-08-12.** | UI phases complete | Automated accessibility checks plus manual keyboard/Chrome review pass at desktop/tablet/mobile and 200% zoom. |
| 12C | Run recovery/security/reliability drills for companion crash, stale UI state, corrupt storage, migration failure, port theft, oversized traffic, secret export, and shutdown. **Completed 2026-08-12.** | Runtime phases complete | Every drill has tested recovery behavior, user-facing diagnostics, and no silent data/runtime corruption. |
| 12D | Write architecture, contracts, security, migration, operations, CLI, troubleshooting, and training manual with an exact end-to-end sample walkthrough. | 12A-12C | Walkthrough matches actual labels/files/results on fresh web and Tauri workspaces; all commands and screenshots are current. |
| 12E | Add Gallery samples and Demo Hub lessons, selectors, focused unit/E2E coverage, final plan/README/ROADMAP/CHANGELOG sync, and release readiness evidence. | 12D | Samples import/run end-to-end; lesson checklist passes; full merge gates pass before requesting user approval. |

Deliverables:

1. Performance and soak gates for large route sets and transaction volume.
2. WCAG keyboard/focus/name/contrast pass.
3. Recovery drills for companion crash and stale runtime state.
4. Training manual with an end-to-end sample walkthrough.
5. Demo Hub lessons and Gallery samples.
6. Security, migration, compatibility, and operations documentation.

Acceptance:

- [ ] 2,000-route server startup and matching meet agreed latency budgets.
- [ ] Eight-server lifecycle soak has no leaked ports/timers/listeners.
- [ ] Full product quality gates pass.
- [ ] Web and Tauri walkthroughs pass from fresh imported sample data.

---

## 12. Testing Strategy

### 12.1 Test Pyramid

1. **Pure conformance tests:** normalized requests, source conversion, pattern tools, predicates, priorities, ambiguity policies, conflict classification, variants, templates, simulation traces, state, redaction, migration.
2. **Listener integration tests:** real ephemeral ports, HTTP methods, headers, bodies, concurrent requests, faults, draining.
3. **Control API tests:** envelopes, ownership, invalid payloads, reconciliation, port conflicts.
4. **Component tests:** tabs, route tree, matcher/pattern builder, conflict inspector, validation, journal, and cURL/Catalog/Requests import review.
5. **Playwright E2E:** multiple ports, hot apply, cURL/OpenAPI import, Catalog/Requests promotion, pre-Apply conflict warning, near miss, state transition, and refresh reconciliation.
6. **Tauri parity tests:** storage, lifecycle, direct client connectivity, certificates when Phase 10 lands.
7. **CLI integration tests:** signals, readiness, overrides, verification, output format.

Every matcher fixture must be runnable as both a saved simulation sample and a live listener request. Required ambiguity fixtures include one match, multiple matches with different priorities, multiple matches tied at highest priority, disabled rules, and a rejected candidate containing redacted security values.

### 12.2 Required Multi-Server E2E

1. Open API Mock Studio.
2. Configure Users API on `4600` and Payments API on `4601`.
3. Start both and verify green/running tabs.
4. Send requests from Requests Studio to each listener.
5. Verify distinct response bodies and journals.
6. Hot-apply only Users API and confirm Payments generation/output is unchanged.
7. Attempt a third server on `4600`; verify clear ownership conflict.
8. Stop/close Users; verify Payments remains running.
9. Restart the app/control plane and verify accurate reconciliation.

### 12.3 Performance Baselines to Establish

- startup p95 for 100, 500, and 2,000 routes;
- match p95 for exact, regex, JSONPath, and JSON Schema routes;
- hot-commit p95 and memory delta;
- journal throughput with full and truncated bodies;
- eight-server idle CPU/memory and active polling load;
- template timeout/limit behavior.

#### 12.3.1 Phase 12A Performance Budgets (concrete targets)

These are the agreed p95 budgets referenced by Phase 12A. They are pure-engine, single-threaded
targets measured on a warm V8 on developer hardware, excluding OS socket bind/accept latency. The
executable copy of these numbers lives in `src/shared/api-mock/perfBudgets.ts`
(`API_MOCK_PERF_BUDGETS`); the plan and code must be updated together. Automated benchmark
assertions apply a CI slack multiplier (`PERF_CI_SLACK`, default 6×) so they catch gross regressions
without flaking on shared CI runners; the raw budgets below are the true targets.

| Operation | Route set / mix | p95 budget | Notes |
|---|---|---|---|
| Build + validate definition (startup) | 100 routes | 15 ms | `validateServer` over the definition |
| Build + validate definition (startup) | 500 routes | 60 ms | |
| Build + validate definition (startup) | 2,000 routes | 250 ms | |
| Match one request | exact-heavy, 2,000 routes | 3 ms | winner is an exact route |
| Match one request | regex-heavy, 2,000 routes | 8 ms | cached compiled patterns |
| Match one request | JSONPath/json_subset, 2,000 routes | 12 ms | body parsed once per request |
| Hot-commit (swap live definition) | 2,000-route definition | 5 ms | listener `commit()` is O(1) reference swap |
| Journal append (sustained at cap) | 500-entry ring | 0.05 ms/append | bounded ring buffer, no per-append full-array copy |

Memory ceilings and no-leak invariants (always asserted, not slack-gated):

- Journal never retains more than `min(settings.journal.maxEntries, HARD_CEILINGS.maxJournalEntries)` entries.
- Repeated start/stop of eight servers leaks no timers, sockets, or `http.Server` listeners
  (`activeConnections` drains to empty; pool map returns to prior size).
- Compiled-pattern caches are bounded (LRU eviction at a fixed ceiling) so adversarial unique
  regex/glob patterns cannot grow memory without bound.

> **Deferred-operator note:** `jsonSchema`, `xmlSchema`, `xpath_*`, and `multipart_*` operators are
> library-gated and currently evaluate to `false` fast-paths (Phase 1 decision). The "schema mix"
> benchmark therefore exercises `json_strict`/`json_subset`/`jsonPath_*` as the representative
> structural operators until the schema libraries land in a later phase.

---

## 13. Telemetry and Diagnostics

Local diagnostics should be useful without transmitting user payloads.

Capture locally:

- lifecycle transitions and duration;
- route count, predicate count, generation;
- match duration by matcher category;
- matched/unmatched/proxied/fault counts;
- validation and template errors;
- journal drops/truncation;
- open connection and in-flight counts.

Never include raw URLs with query values, headers, bodies, templates, variable values, or secrets in external telemetry. Any future opt-in analytics requires a separate privacy review.

---

## 14. Decision Register and Recommended Defaults

Phase 0A adopted the product and cross-phase boundaries below. “Pending” rows are implementation-library choices owned by the named phase and do not reopen Phase 0A semantics. Phase 0G approves the complete design package, not these decisions in isolation.

| Decision | Adopted value or recommended direction | Status | Owner / revisit point |
|---|---|---|---|
| Product label | **API Mock** in navigation; **API Mock Studio** page title; **Mock Server** is the user-facing tab entity. | Adopted | Phase 0A |
| Automatic ports | Atomically reserve and bind the first available port in `4600-4699`; manual `1024-65535`; the shared listener registry and actual bind are authoritative. | Adopted | Phase 0A; implement Phase 2 |
| Max open tabs | 8 open/running-capable tabs; saved closed definitions are not capped by this UX limit. | Adopted | Phase 0A; implement Phase 3 |
| Empty workspace | Show Create Mock Server and Import; do not silently create a listener or definition. | Adopted | Phase 0A; implement Phase 3 |
| New server/route defaults | `Mock Server N`; first free auto port; a new route contains one enabled `200 Default` static response. | Adopted | Phase 0A; contracts Phase 0B |
| Apply scope | Auto-apply off. One server-bar Apply validates and atomically commits all draft changes for that server. | Adopted | Phase 0A; implement Phases 2-4 |
| Definition format | Versioned RedfireForge JSON is canonical in Phase 6; YAML is an optional Phase 8 serialization surface. | Adopted | Phase 0A |
| Pattern authoring | Exact/template first; advanced glob/regex/JSONPath/XPath/schema tools use progressive disclosure and one shared evaluator. | Adopted | Phase 0A; implement Phases 1/3 |
| Multiple matching rules | Choose highest explicit priority by default; per-server strict mode may reject every multi-match. | Adopted | Phase 0A |
| Equal highest priority | Reject by default; optional resolution uses displayed specificity, then lexical stable route ID. | Adopted | Phase 0A |
| Ambiguity response | Per-server configurable status/headers/body; default sanitized JSON 409 with request ID and count/IDs of competing rules. | Adopted | Phase 0A; contracts Phase 0B |
| Conflict certainty | Definite only with proof; otherwise Potential with unresolved dimensions. Acknowledgement is valid only for unchanged rule fingerprints. | Adopted boundary | Phase 0E formalizes proof rules; Phase 1 implements. |
| Conflict Apply gate | Always summarize. Warn mode permits Apply; strict mode blocks configured severities until fixed or validly acknowledged. | Adopted boundary | Phase 0E defines severity defaults; Phase 3 implements. |
| Sample ownership | Server-owned with optional `routeId` so samples can test cross-route ambiguity; route deletion clears association after confirmation, not sample data. | Adopted | Phase 0A; contracts Phase 0B |
| Export scope | Whole-workspace export includes definitions, open-tab order, and active-tab preference; server and selected-route bundles carry only their declared scope and associated samples. | Adopted | Phase 0A; contracts Phase 0B; implement Phase 6 |
| Variable precedence | Mock-server/tab scope overrides selected environment, which overrides workspace. Missing values remain explicit unresolved diagnostics. | Adopted | Phase 0A; policy examples Phase 0E |
| Default unmatched response | Sanitized JSON 404 with request ID. Server settings can replace status/headers/body; internal near misses are excluded by default. | Adopted | Phase 0A; implement Phases 2/3 |
| LAN binding | Loopback default. Selecting `0.0.0.0` requires explicit confirmation before Start and an always-visible LAN badge. | Adopted | Phase 0A; implement Phases 2/3 |
| Logs on disk | Off by default; bounded/redacted memory journal is authoritative during runtime. | Adopted | Phase 0A; implement Phase 5 |
| Template syntax | Restricted Handlebars-compatible syntax under Phase 0A operation/output ceilings. | Adopted boundary | Phase 1/4 library and grammar review. |
| Regex dialect | JavaScript-compatible syntax and explicit supported flags; reject unsupported/unsafe patterns. | Adopted boundary | Phase 1 implementation review. |
| JSONPath engine | Reuse/extend `src/shared/utils/jsonPath.ts`; avoid a second incompatible dialect. | Adopted boundary | Phase 1 gap assessment. |
| XML dependency | Use maintained parser/XPath/schema libraries only after security, license, browser, and Node compatibility review. | Pending implementation choice | Phase 1 |
| Automatic specificity | Applied only after explicit priority and only when configured; integer score and breakdown are visible. | Adopted | Phase 0A; weights Phase 1 |
| HTTPS/mTLS | Unavailable until Phase 10; HTTP/1.1 companion runtime is MVP. | Adopted | Phase 0A |
| Native Tauri listener | Deferred to Phase 10; Tauri initially controls the companion runtime. | Adopted | Phase 0A |
| Proxy/callback/recording | Unavailable until Phase 9 security model and allowlist land. | Adopted | Phase 0A |
| WireMock compatibility | Import reviewed inactive subset in Phase 6; export subset plus exhaustive loss report in Phase 8; never claim full emulation. | Adopted | Phase 0A |

---

## 15. MVP Definition

MVP consists of Phases **0-6** with these mandatory outcomes:

- [ ] GUI-first server/route/response configuration.
- [ ] Multiple tabs running distinct servers on distinct ports.
- [ ] Deterministic exact/pattern/semantic JSON matching.
- [ ] Professional pattern toolbox with live positive/negative samples and runtime-parity evaluation.
- [ ] Multiple prioritized rules with configurable ambiguity and equal-priority policies.
- [ ] Pre-Apply conflict analysis identifies duplicates, definite/potential overlaps, shadowing, and unreachable rules with actionable evidence.
- [ ] Static and safely templated responses with latency.
- [ ] Atomic Apply and generation tracking.
- [ ] Live bounded journal and explainable near misses.
- [ ] Saved sample simulation with expected outcomes and exportable per-predicate traces.
- [ ] OpenAPI import and RedfireForge export.
- [ ] cURL import creates a reviewed inactive rule and simulation sample with diagnostics and secret redaction.
- [ ] Native import/export round-trip preserves rules, priorities, policies, behaviors, and samples.
- [ ] Single and batch promotion from Catalog and Requests uses the canonical source-to-rule conversion pipeline.
- [ ] Web companion runtime and Tauri UI/storage compatibility.
- [ ] Focused unit/integration/E2E coverage above repository quality thresholds.

State machines, advanced faults, CLI, proxy recording, HTTPS, and native Tauri listeners are valuable follow-up increments, but they must not destabilize the core deterministic engine and multi-port lifecycle.

---

## 16. Implementation Retrospective

No implementation has started. Add dated notes here whenever actual code diverges from this plan, and update the affected contracts, UI descriptions, phase status, acceptance criteria, and source paths in the same change.

### 2026-08-11 - Requirements Clarification

- Defined each route as a prioritized rule owned by one mock server.
- Replaced unconditional winner selection with configurable reject-or-highest-priority behavior and explicit equal-priority handling.
- Expanded matching to include security/authentication attributes and response behavior to include full cookies, bounded long-running responses, and scheduled chunks.
- Promoted import/export and traceable sample simulation to versioned contracts, dedicated requirements, phase deliverables, and MVP acceptance criteria.
- Added cURL-to-rule import, batch Catalog/Requests promotion, shared pattern-authoring tools, and conservative pre-Apply conflict analysis with professional conflict-review UX.

### 2026-08-11 - Delivery Decomposition

- Decomposed Phases 0-12 into lettered, dependency-ordered sub-phases with concrete outputs, focused validation, and explicit exit criteria.
- Kept phase-level Deliverables and Acceptance as aggregate gates while making each implementation increment independently reviewable and testable.
- Corrected the interactive mockup path to `docs/plan/future/apimock/mockups/` after the plan moved under `docs/`.

### 2026-08-11 - Phase 0 Plan Audit

- Corrected the plan status to Phase 0 in progress and distinguished approved catalog scope/visual direction from final approval of completed artifacts.
- Recorded the actual catalog gap: shared assets and screens 01-04 exist; screens 05-08 and visual evidence remain incomplete.
- Added the keyboard/accessibility contract, contract freeze checklist, artifact matrix, documentation-only validation rule, and explicit 0F validation/0G approval gates.
- Corrected empty-workspace and transaction contracts (`activeServerId` optional; `ambiguous` journal outcome) and assigned missing folder/sample ownership and settings/type completion to Phase 0B.
- Defined the implementation approach as decisions -> contracts -> workflows -> mockups -> policies/fixtures -> evidence -> user approval, with Phase 1 blocked until that gate passes.

### 2026-08-11 - Phase 0A Decision Foundation

- Completed Phase 0A by freezing canonical terminology, durable/runtime ownership, empty-workspace and creation defaults, server-wide Apply semantics, sample ownership, variable precedence, and capability boundaries.
- Added primary phase ownership for every `AMS-*` requirement range and explicitly split capability-gated requirements across MVP and later phases.
- Replaced the conflicting `4010` default (reserved throughout the GraphQL demo runtime) with OS-probed auto allocation in `4600-4699`; manual ports remain `1024-65535`.
- Centralized enforceable defaults and hard ceilings for tabs, ports, definitions, nesting, regex, headers, bodies, responses, connections, timing, journals, simulation, and templates.
- Corrected MVP claims that previously implied HTTPS, proxy/callback, sequence/state/probability, and socket faults shipped before their owning phases.
- Converted Section 14 from deadline-only recommendations into an adopted/pending decision register with explicit owners and revisit points.
- Review pass 1 clarified Phase 0 versus 0A status, made Section 14 authoritative, corrected canonical method/path ownership and sample association in planning contracts, made export payloads scope-aware, and replaced advisory-only port probing with atomic reservation and bind semantics.
- Review pass 2 assigned WireMock subset import unambiguously to Phase 6 and export to Phase 8, aligned LAN binding on explicit pre-Start confirmation, and required Phase 0B settings to incorporate rather than redefine Phase 0A safety limits.

### 2026-08-11 - Phase 0B Contract Freeze

- Completed Phase 0B by defining all 12 previously missing types: `ApiMockRouteFolderV1`, `ApiMockVariableV1`, `ApiMockImportSourceV1`, `ApiMockPathMatcherV1`, `ApiMockPredicateOperator`, `ApiMockResponseBodyV1`, `ApiMockResponseCookieV1`, `ApiMockStateTransitionV1`, `ApiMockStaticResponseV1`, `ApiMockCapturedRequestV1`, `ApiMockCapturedResponseV1`, and `ApiMockMatchExplanationV1`.
- Replaced all persisted `unknown` fields: `ApiMockPredicateV1.expected` uses `ApiMockPredicateExpectedValue` (bounded JSON-safe union), `ApiMockSimulationSampleV1.expected.body` split into `bodyContains`/`bodyExact` strings, `ApiMockTemplateContextV1.variables` narrowed to `Record<string, string>`, and `request.body` documented as transient runtime value with typed accessor pattern.
- Added `ApiMockMethod`, `ApiMockResponseMode`, `ApiMockPathMatcherKind`, `ApiMockResponseBodyKind`, `ApiMockFaultKind`, and `ApiMockTransactionOutcome` shared enums with explicit capability-phase gating commentary.
- Removed `'proxied'` from `ApiMockTransactionOutcome`; proxy is Phase 9 capability-gated and extends the union when that phase lands.
- Completed `ApiMockServerSettingsV1` with typed `selection`, `fallback`, `cors`, `limits`, `journal`, and `redaction` sections. Documented all MVP defaults from Section 10.5.
- Defined `_capabilityPhase` extension pattern for future Phase 9/10 settings fields.
- Added `ApiMockDiagnosticV1` with 9 stable code prefix categories covering schema, references, limits, capabilities, regex, import, redaction, conflict, and response-mode validation.
- Defined response-mode invariants for `rules` (MVP), `sequence`, `weighted`, and `state` (Phase 7) modes with cross-mode validation rules.
- Defined deterministic fingerprint computation (SHA-256 of canonical sorted JSON excluding timestamps) and export ordering rules (servers/routes/samples by `id`, variables by `key`).
- Defined version handling: future-version rejection, same-version defaulting, pure migration dispatcher signature, and sequential V→V+1 chaining.
- Created 10 parseable fixture files under `docs/plan/future/apimock/fixtures/` covering valid empty workspace, valid server with routes/samples/variables/settings, unknown future version, dangling references, duplicate IDs, Phase 7 capability-gated features, response-mode invariant violations, redaction scenarios, boundary limits at hard ceilings, and deterministic export ordering.
- Review pass 1 added missing CORS defaults, enumerated valid security predicate selectors, added Phase 9 proxy placeholder contract alongside TLS, documented all-variants-disabled edge case, specified migration chain failure behavior (atomic reject), defined redaction transformation rules and template helper type contracts, and clarified routes-scope export sample inclusion policy.

### 2026-08-11 - Phase 0C-0G Plan Audit

- Added Phase 0C Workflow Inventory with 22 enumerated workflows, each mapped to a primary screen and key contract types. Phase 0C now produces a state-transition table for each workflow.
- Updated Phase 0C dependency from `0A` to `0A, 0B` so workflow state tables can reference frozen contract types.
- Added Phase 1 Entry Assumptions section with 10 explicit preconditions that Phase 0G must review before approving Phase 1 start.
- Clarified Phase 0E scope: 0A adopted the policy values; 0E adds formal proof algorithms, decision trees, worked examples, failure-mode tables, and conformance-corpus seed cases. No overlap with 0A.
- Defined Phase 0F screenshot capture process (Playwright or manual Chrome DevTools at each viewport), storage convention, and `VALIDATION_RECORD.md` format.
- Corrected mockup status from "Draft complete" to "Draft with partial states" for screens 01-04 to honestly reflect missing lifecycle/error/ambiguity states.

### 2026-08-11 - Phase 0C Workflow State Tables

- Completed Phase 0C by producing 22 state-transition tables (W1-W22) covering every workflow in the inventory.
- Each table documents entry state, success path, empty/no-data, loading/progress, validation errors, capability/permission gates, error/failure, user cancellation, and recovery/retry behavior with keyboard/focus notes.
- Tables reference frozen Section 8 contract types and Section 8.11 diagnostic codes throughout.
- Covers server lifecycle (create, start/stop/restart, apply, settings), tab CRUD, route/folder CRUD, match predicate authoring, pattern toolbox, response variant authoring, template editing/preview, simulation (single/batch), conflict analysis/review/acknowledge/apply-gate, all import sources (cURL, OpenAPI, Catalog/Requests, native/WireMock), export scopes, journal inspection, redaction/persistence settings, refresh/reconnect recovery, and LAN binding confirmation.

### 2026-08-11 - Phase 0E Policy Formalization

- Completed Phase 0E by formalizing six cross-cutting policies with worked examples inline in Sections 7.4-7.9.
- Section 7.4: Conflict proof algorithms formalized per operator category with decidable (exact/contains/present/template/glob) and undecidable (regex/JSONPath/XPath/schema) classification tables, composite rule, duplicate detection, and shadowed/unreachable detection.
- Section 7.5: Conflict severity and Apply-gate defaults table with warn/strict mode behavior and acknowledgement downgrade rules.
- Section 7.6: Variable resolution walkthrough with 3-scope worked example showing precedence, overrides, and unresolved diagnostic.
- Section 7.7: Import merge/replace/copy decision tree with before/after examples for merge and replace modes.
- Section 7.8: Redaction transformation worked example with header redaction, scheme preservation, JSONPath body redaction, and sensitive variable handling.
- Section 7.9: Conformance-corpus schema (`ApiMockConformanceCaseV1`) with categories and expected-outcome contract.
- Created 12 conformance seed cases across 2 fixture files: `conformance-seed-basic.json` (5 cases: exact match, parameterized path, no-match/404, header exact, query contains) and `conformance-seed-advanced.json` (7 cases: reject-multiple ambiguity, highest-priority selection, equal-priority rejection, specificity tiebreak, regex path, JSON subset, cookie absent).
- Review pass 1 expanded proof algorithms for all Section 7.1 MVP operators (case-insensitive, negated, present/absent, form, multipart, binary, transport, regex vs contains/glob, XML schema, cross-body-type disjointness). Clarified import merge/replace/copy applies to all import sources W14-W17. Added `conformance-seed-operators.json` with 17 additional seed cases covering ANY method, glob path, query exact/present/absent/regex/negated, header present/absent/contains, cookie exact, text body exact/contains, JSON strict, JSONPath exists/equals, and form field exact — bringing total to 29 seed cases across 3 files covering all MVP operators.

### 2026-08-11 - Phase 0D Interactive Mockup Catalog

- Completed Phase 0D by building all 4 missing mockup screens and updating screens 01-04.
- Built `05-conflict-inspector.html`: definite/potential/duplicate finding types, dimension analysis table, policy outcome display, witness request with simulation, acknowledge with fingerprint staleness, and severity-based Apply-gate behavior.
- Built `06-import-promotion.html`: source selector (cURL/OpenAPI/Catalog/Requests/native/WireMock), cURL paste with diagnostics, exact-by-default generalization, destination/folder/priority controls, merge/replace/copy mode selector, generated sample preview, conflict analysis, and inactive-draft confirmation.
- Built `07-runtime-journal-settings.html`: transaction journal with matched/unmatched/ambiguous/error rows, request/response detail split, match explanation with predicate pass/fail tree, near misses, redacted headers, Open-in-Requests and Create-route actions, settings tabs for selection policy/CORS/limits/journal/redaction/fallback/LAN binding.
- Built `08-responsive-layouts.html`: tablet/mobile device frame selector with route drawer, wrapped server bar, compact matcher rows, and dock.
- Corrected port references from `4010/4011/4012` to `4600/4601/4602` across all 4 existing screens.
- All 8 screens plus index/shared assets are now present and cross-link correctly via the screen-nav bar.

### 2026-08-11 - Phase 0F Audit and Validation

- Completed Phase 0F by running automated link integrity, structural, and acceptance-criteria state-coverage checks, then capturing 24 Playwright Chromium screenshots at desktop 1280×900, tablet 768×1024, and mobile 375×812.
- Link audit: all 9 HTML files pass with zero broken local links, correct shared CSS/JS loading, and complete 8-screen cross-navigation.
- Port compliance: zero stale `4010/4011/4012` references across all mockup files.
- State coverage: all 31 Phase 0 acceptance-criteria states verified present across the 8 screens (lifecycle, ambiguity, conflict, import, journal, settings, responsive).
- Screenshots: 24 PNG files stored at `docs/plan/future/apimock/mockups/screenshots/`.
- Created `VALIDATION_RECORD.md` with link integrity, port compliance, state coverage table, screenshot matrix (24/24 pass), accessibility marker counts, and 4 documented known limitations.
- Visual spot-check of screens 01, 05, and 07 confirms professional rendering, correct port 4600 range, readable typography, and proper layout hierarchy at desktop viewport.

### 2026-08-11 - Phase 0G Approval

- User approved Phase 0 after reviewing the complete deliverable set: frozen contracts (Section 8, 25+ types), 22 workflow state tables (W1-W22), 8 interactive HTML mockups with shared CSS/JS, 6 formalized policies with worked examples (Sections 7.4-7.9), 29 conformance seed cases across 3 fixture files, 10 structural/validation fixtures, 24 Playwright screenshots at 3 viewports, and `VALIDATION_RECORD.md`.
- All 10 Phase 1 entry assumptions reviewed and confirmed.
- Phase 0 closed. Phase 1 (shared matcher engine) may begin.

### 2026-08-11 - Phase 1A Contracts and Validation

- Implemented the complete API Mock contract module at `src/shared/api-mock/` with 5 production files and 3 test files.
- `contracts.ts`: All 25+ types exported — enums, predicates, path matchers, responses, behavior, settings, server definitions, workspace, diagnostics, captured request/response, simulation, conflict findings, runtime snapshots, transactions, export envelopes, migration, and conformance corpus.
- `defaults.ts`: MVP default settings, hard ceilings, auto-port range, and factory functions for default responses and empty predicate groups.
- `validation.ts`: Structural and semantic validation producing `ApiMockDiagnosticV1` arrays with stable codes — validates workspaces, servers, routes, predicate groups, settings limits, response-mode invariants, capability gates, regex safety, reference integrity, and duplicate IDs.
- `fingerprint.ts`: SHA-256 deterministic fingerprints for definitions (excludes timestamps/source) and routes (excludes timestamps/tags/operationId), plus canonical export ordering by ID/key.
- `migration.ts`: Schema version handling with future-version rejection, same-version normalization, and pluggable pure migration chain with atomic reject on failure.
- 38 tests across 3 test files covering all validation rules, capability gates, fingerprint stability/exclusion, canonical ordering, and migration behavior. TypeScript compiles clean.

### 2026-08-11 - Phase 1B Request Normalization

- Implemented `requestNormalization.ts` in `src/shared/api-mock/` — pure function converting `RawRequestInput` to `NormalizationResult` containing `ApiMockCapturedRequestV1` and `NormalizedRequestSummary`.
- Covers: method uppercasing, URL path/query separation with fragment stripping, percent-decoding with malformed-encoding safety, query-string parsing with repeated keys, header key lowercasing with repeated-value merging, Cookie header parsing, content-type/content-length extraction, body size tracking, and truncation metadata.
- Clarified plan scope: security metadata is derived from normalized headers during predicate evaluation (Phase 1C), not stored as separate normalization output. Browser/Node adapters are Phase 2A, not 1B — 1B is the shared pure normalization logic both adapters use.
- Code review caught rawPath bug: original implementation stripped query string from `rawPath`, contradicting the contract where `rawPath` preserves the full URL minus fragment. Fixed to strip only fragments.
- 41 tests covering method normalization, URL/path parsing, query string with repeated keys/decoding/edge cases, header normalization with case merging, cookie parsing, content-type/length, body handling, metadata, determinism, and summary completeness.
- All 79 tests pass across 4 test files. TypeScript compiles clean.

### 2026-08-11 - Phase 1C Predicate Evaluator

- Implemented `pathMatcher.ts` — pure path matching for exact, parameterized (`:param` and `{param}`), glob (`*`, `**`, `?`), and regex kinds with case-insensitive flag support.
- Implemented `predicateEvaluator.ts` — route evaluation combining method matching (exact + ANY), basePath stripping, path matching, and recursive predicate tree evaluation with ALL/ANY/NOT combinators.
- Covers MVP operators: exact, contains, prefix, suffix, regex, glob, present, absent, json_strict, json_subset, jsonPath_exists, jsonPath_equals, form_field_exact, form_field_regex, form_field_present, binary_exact. Security source extraction for scheme, username, tokenClaim, apiKeyName, apiKeyLocation.
- XML/schema/multipart operators return `false` (require external libraries; deferred to later sub-phases).
- Negation via `options.negate` inverts any operator result. Case-insensitive matching via `options.caseSensitive: false`.
- Repeated header/query values: `anyValue()` helper matches if any value in the array satisfies the operator.
- Predicate results recorded for every evaluated predicate with pass/fail, source, operator, and failure reason.
- Simple `$.dot.notation` JSONPath resolver for exists/equals without external library dependency.
- 62 new tests across 2 test files (pathMatcher.test.ts: 16, predicateEvaluator.test.ts: 46). Total: 141 tests across 6 files. TypeScript compiles clean.

### 2026-08-11 - Phase 1D Route Selection

- Implemented `routeSelector.ts` — deterministic route selection implementing Section 7.2 algorithm: filter enabled routes, evaluate all candidates, apply `multipleMatchPolicy` (reject_multiple vs highest_priority), apply `equalPriorityPolicy` (reject vs specificity_then_id), compute specificity scores, break ties by lexical route ID.
- Specificity scoring: exact method (10) > ANY (1); exact path (50) > parameterized (30) > glob (15) > regex (10); operator weights from exact (8) through present/absent (2).
- Response selection for `rules` mode: prefer enabled default, fall back to first enabled.
- Near-miss computation: routes with partial matches (method or path) ranked by number of passing predicates.
- Full `ApiMockMatchExplanationV1` built for every selection: normalized request summary, all candidates with predicate results, policy decision with matched count/priority/outcome, and near misses.
- 16 tests covering single match, no match, reject_multiple, highest_priority, equal priority reject/specificity, insertion-order independence, disabled routes, basePath stripping, explanation contents, and specificity comparison.

### 2026-08-11 - Phase 1E Conflict Analyzer

- Implemented `conflictAnalyzer.ts` — conservative static conflict analysis implementing Section 7.4 proof algorithms.
- Duplicate detection: identical method + path + predicate tree after canonicalization → severity error.
- Dimension analysis: method (exact match, ANY overlap, different → disjoint), path (exact vs exact, parameterized vs exact overlap, regex vs exact via evaluator, regex vs regex → unknown), predicates (exact vs exact, present vs absent → disjoint, negated vs same exact → disjoint, regex vs regex → unknown, schema/path operators → unknown).
- Composite rule: any disjoint dimension suppresses the finding; at least one unknown → potential; all overlap → definite.
- Shadowed detection: higher-priority route with superset predicates (fewer constraints).
- Fingerprints included in every finding for acknowledgement tracking.
- 14 tests covering disjoint routes, duplicates, definite overlap, potential overlap (regex), different methods, different paths, parameterized vs exact, regex vs exact (match and no-match), present vs absent, negated vs same exact, disabled routes, fingerprint presence, and shadowed detection.

### 2026-08-11 - Phase 1F Simulation Engine

- Implemented `simulation.ts` — side-effect-free single and batch simulation.
- `simulateSingle`: evaluates one sample against routes/settings, returns outcome/trace/passed with optional expected-outcome checking.
- `simulateBatch`: runs all samples independently, returns array of results.
- Expected-outcome checking: compares outcome, routeId, responseId, and status; `passed` is `undefined` when no expectations are set.
- Settings merging: partial settings overlay on DEFAULT_SETTINGS.
- Generation tracking: uses provided generation or `'draft'`.
- 12 tests covering matched/unmatched results, generation tracking, expected-outcome pass/fail, no-expectations case, trace inclusion, determinism (repeated calls), batch execution, and partial settings.
- Phase 1 complete: 182 tests across 9 test files, 11 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 2 Multi-Port HTTP Runtime

- Implemented `ApiMockNetworkListener` in `src-server/api-mock/` — Node HTTP server per mock definition with bounded body streaming, request normalization, shared matcher engine invocation, ambiguity/unmatched response handling, delay support, graceful drain with connection tracking, and transaction recording.
- Implemented `ApiMockServerPool` — multiple listeners keyed by `serverId` with port reservation (auto-range 4600-4699 and manual 1024-65535), ownership enforcement (duplicate-port rejection), start/stop/restart/commit/status/list/stopAllAsync lifecycle, and idempotent stop.
- Implemented `createApiMockRouter()` in `src-server/routes/api-mock/` — Express Router factory with `json200`/`jsonError` envelope helpers following existing WebSocket/gRPC patterns. Endpoints: POST start, POST stop, POST restart, PUT commit (with validation), GET status, GET list, POST port probe.
- Generation tracking: start sets generation 1, each commit increments. In-flight requests use the generation captured at request start.
- 6 listener tests: start/respond, unmatched 404, stop, commit/generation, transaction recording, ambiguity 409.
- 11 pool tests: single start, two-server coexistence, duplicate-port rejection, stop/idempotent-stop, commit, rejected-commit-on-stopped, status, unknown-server, stopAllAsync, port allocation.
- Phase 2 complete: 199 tests across 11 test files, 14 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 3 Studio Shell and Route CRUD

- Registered `api-mock-studio` tab in `appTabUtils.ts` Tab type and PROTOCOLS_TABS set, added "API Mock" entry to `AppSubNav` protocols section, and rendered `ApiMockStudioPage` in `AppProtocolStudios`.
- Created `ApiMockStudioPage` in `src/features/api-mock/` — full page component with empty-workspace state (Create Mock Server + Import), multi-server tab management, server bar with address/generation/controls, route explorer with CRUD, and route editor with method/path/priority/predicates.
- Created `ApiMockServerTabs` — accessible `role="tablist"` with `aria-selected`, create (+), and close (×) per tab.
- Created `ApiMockServerBar` — lifecycle dot, status label, full address display, generation counter, Start/Stop buttons.
- Created `ApiMockRouteExplorer` — route tree with `role="tree"`/`treeitem`, method badges, path display, priority badges, empty state, enable/disable visual indicator.
- Created `ApiMockRouteEditor` — route editing with method select, path input, priority input, predicate summary, and builder-tab navigation (Match/Response/Behavior/Examples/Docs).
- Created `api-mock-studio.css` — layout styles for the studio shell, server tabs, server bar, workspace grid, route panel, editor, and empty states.
- Created `src/shared/selectors/apiMock.ts` — centralized test selectors for all API Mock testids.
- 10 component tests covering empty state, server creation, route creation, tab switching, method/path/priority editing, empty routes message, and multi-server tabs.
- Phase 3 complete: 209 tests across 12 test files, 20 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 4 Responses, Templates, and Latency

- Implemented restricted template engine (`templateEngine.ts`) in `src/shared/api-mock/` — Handlebars-compatible `{{expression}}` parser with curated helpers: pathParam, query, header, cookie, state, counter, uuid, now, randomInt, oneOf, repeat, base64, jsonPath. Enforces prototype-key blocking (`__proto__`, `prototype`, `constructor`), operation count ceiling, output byte ceiling, and nesting depth limit.
- Deterministic seed support: seeded randomInt and oneOf produce reproducible results across browser/server.
- Added `ApiMockTemplateContextV1` to contracts — transient runtime type with typed request fields, state, variables, counters, timestamp, and seed.
- Created `ApiMockResponseEditor` component in `src/features/api-mock/components/` — variant tab bar with add/delete, status/content-type/body/delay/jitter editing, header and cookie display.
- 30 template engine tests covering variable resolution, all 13 helpers, deterministic seed, safety (blocked keys, unknown helpers, unclosed braces), and complex template rendering.
- Phase 4 complete: 239 tests across 13 test files, 23 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 5 Journal and Match Debugger

- Implemented `ApiMockTransactionJournal` in `src-server/api-mock/` — bounded per-server ring buffer with cursor-based retrieval, configurable max entries (default 500, ceiling 500), body truncation, header redaction (authorization scheme preservation, full redaction for cookie/api-key), and method/path/outcome filtering.
- Added journal GET/DELETE endpoints to control-plane routes and integrated journal creation during server start with transaction handler wiring.
- Created `ApiMockJournal` React component — transaction list with method badges, outcome badges, duration, and split-pane detail view showing request, match explanation (candidates, predicates, near misses), and response with generation tracking.
- 12 journal tests covering append/retrieve, cap enforcement, clear, authorization redaction with scheme preservation, api-key full redaction, body truncation, method/path/outcome filtering, page limiting, cursor increment, and copy safety.
- Phase 5 complete: 251 tests across 14 test files, 26 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 6 Import and Integration

- Implemented `sourceToRule.ts` in `src/shared/api-mock/` — canonical source-to-rule converter producing `ApiMockRouteV1` (inactive draft) + `ApiMockSimulationSampleV1` + diagnostics from any `SourceRequest`. Handles method normalization, exact-by-default header predicates, JSON body subset matching, authorization secret warnings, invalid-JSON fallback, query parameter capture, custom priority/status/folder, and import source metadata.
- Batch conversion via `convertBatch()` for multi-item imports from OpenAPI/Catalog/Requests sources.
- Created `ApiMockImportReview` React component — unified import review with source selector (cURL/OpenAPI/native), cURL paste-and-parse flow, merge/replace/copy mode selector, diagnostic display, generated-route preview, and inactive-draft confirmation.
- Includes basic cURL parser extracting method, URL path, headers, and body from cURL command strings.
- 15 source-to-rule tests covering simple conversion, sample generation, method normalization, unknown-method warning, header predicates, skipped headers, authorization secret warning, JSON subset predicates, invalid-JSON fallback, custom options, folder assignment, source metadata, query parameters, batch conversion, and unique IDs.
- MVP (Phases 0-6) complete: 266 tests across 15 test files, 29 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 7 Stateful, Sequence, Probability, and Faults

- Implemented `scenarioRuntime.ts` — per-server scenario state machine with atomic transitions, state/counter management, currentState guards, counter delta updates, multi-key independence, and full reset.
- Implemented `responseSelector.ts` — advanced response selection for all Phase 7 response modes:
  - Sequential: cycling and hold_last exhaustion policies, per-route sequence position tracking, reset, disabled-variant skipping.
  - Weighted: relative weights with deterministic seeded selection, zero-weight exclusion.
  - State-gated: transition.currentState guard matching against scenario state, unguarded fallback.
  - Eligibility: maxMatches limit, expiresAt TTL, and probability gates with explanations.
- 7 scenario runtime tests: initial state, transitions, guards, counter updates, reset, multi-key, guard-pass.
- 16 response selector tests: sequence order/cycle/hold_last/reset/disabled/empty, weighted selection/seed/zero-weight, state selection/fallback, eligibility default/maxMatches/expiry.
- Phase 7 complete: 289 tests across 17 test files, 31 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 8 Export, CLI, and Verification

- Implemented `exportUtils.ts` — deterministic JSON export with workspace/servers/routes scope selection, canonical ordering (by ID/key), redaction of sensitive variables (`[REDACTED]`), and timestamped export metadata envelope.
- Implemented `cliMock.ts` — pure CLI simulation utility with workspace loading/validation and headless batch sample simulation. Server startup logic stays in `src-server/` (not `src/shared/`) to avoid cross-boundary imports.
- Architecture fix: moved CLI server startup to `src-server/` scope; `src/shared/api-mock/` contains only pure simulation and export logic.
- 8 export tests covering full workspace, deterministic ordering, selected servers, selected routes, redaction, non-sensitive preservation, timestamp, and variable ordering.
- Phase 8 complete: 297 tests across 18 test files, 33 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 9 Security Gate Review

- Phase 9 remains deferred pending user approval of the threat model.
- Produced the 9A threat model covering 7 threat categories: SSRF (cloud metadata, private networks, IPv6, DNS rebinding), self/control-plane recursion (self-proxy loops, cross-mock loops), credential leakage (authorization/cookie/API-key forwarding, Set-Cookie injection), redirect abuse (open redirect, redirect-to-private), callback abuse (DDoS amplification, retry storms, callback SSRF), payload/resource limits (6 configurable ceilings), and HAR import (embedded secrets, scripts, large files).
- Defined 7 cross-cutting policy decisions requiring explicit approval: default-deny outbound, allowlist-only destinations, DNS-pinning on connect, hop-by-hop stripping, credential stripping by default, anti-recursion header (508 Loop Detected), and failure isolation.
- Identified existing infrastructure to reuse: `ServerOutboundUrlPolicy` for SSRF blocking, journal redaction pipeline for proxied traffic.
- No production code written. Sub-phases 9B-9E remain blocked until the 7 policy decisions are approved.

### 2026-08-11 - Phase 9B-9E Proxy Policy Implementation

- All 7 security policies approved with modifications: host+scheme level proxy allowlist, visible credential-forwarding badge, outbound anti-recursion check before sending.
- Implemented `proxyPolicy.ts` in `src/shared/api-mock/` — complete proxy/callback URL policy engine with:
  - `checkProxyUrl()`: validates URLs against allowlist, blocks metadata endpoints (169.254.169.254, metadata.google.internal), private IPv4 (10.x, 172.16-31.x, 192.168.x, 127.x), IPv6 loopback (::1, fe80::), self-recursion to active mock ports, and control-plane port 3001.
  - `stripHopByHopHeaders()`: removes Connection, Keep-Alive, Proxy-Authenticate/Authorization, TE, Trailer, Transfer-Encoding, Upgrade per RFC 7230.
  - `stripCredentialHeaders()`: strips Authorization, Cookie, Proxy-Authorization, X-API-Key, API-Key, X-Auth-Token by default; explicit forward-list opt-in.
  - `addAntiRecursionHeader()` / `hasAntiRecursionHeader()`: X-RedfireForge-Mock header to prevent proxy loops.
  - `stripSetCookieFromResponse()`: prevents upstream Set-Cookie injection.
- 16 policy tests covering allowlist accept/reject, metadata blocking, private IPv4 blocking, IPv6 blocking, self-recursion, control-plane blocking, invalid URLs, non-HTTP protocols, host+scheme matching, hop-by-hop stripping, credential stripping with forward-list, anti-recursion header add/detect, and Set-Cookie stripping.
- Phase 9 complete: 313 tests across 19 test files, 35 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 11 Workflow and Test Runner Integration

- Added 5 API Mock workflow node types to `WorkflowNodeType`: `apiMockStart`, `apiMockApply`, `apiMockResetState`, `apiMockStop`, `apiMockAssertCalls`.
- Created `node-api-mock.ts` with typed data interfaces for each node: server ID, definition source, port override, route/count/status/body/header assertions.
- Created `apiMockNodeHandlers.ts` with handler functions for all 5 nodes calling the control-plane API (start/stop/apply/reset) and performing assertion logic against transaction arrays (count, min/max count, route filter, body contains, header value).
- Extended `WorkflowNodeData` union and `defaultNodeData()` switch in `workflowNodeFactory.ts` with default labels for all 5 API Mock node types. Fixed pre-existing non-exhaustive switch by adding `default` case.
- 15 handler tests covering start success/failure/network-error, stop, apply with generation, reset state, assert-calls count match/mismatch, route filtering, min/max count, body contains, header value match/mismatch, and no-assertions pass.
- Phase 11 complete: 328 tests across 20 test files, 38 production files. TypeScript compiles clean.

### 2026-08-11 - Phase 10A-10C TLS/HTTPS Contracts

- Implemented `tlsContracts.ts` — capability-gated TLS settings interface (`_capabilityPhase: 10`), TLS status type, certificate validation utilities, PEM private-key detection, PEM redaction for traces/exports, subject CN extraction, and cert/key structural validation.
- TLS defaults: disabled, generated cert source, no client auth, TLS 1.2 minimum.
- Security: `containsPrivateKey()` prevents PEM key material from entering exports/logs; `redactPemForTrace()` replaces certificate content while preserving BEGIN/END markers.
- 11 tests covering defaults shape, private-key detection, PEM redaction, CN extraction, cert/key validation (valid/empty/missing markers).
- Sub-phases 10D (native Rust listener) and 10E (TypeScript/native parity) remain deferred — require Rust/Tauri platform work outside the TypeScript codebase.
- Phase 10 partial: 339 tests across 21 test files, 39 production files. TypeScript compiles clean.

### 2026-08-11 - Studio UI/UX Enhancement Pass (mockup parity)

- Audited the eight HTML mockups (`docs/plan/future/apimock/mockups/`) against the shipped React components and closed the visual/UX gap. The engine and runtime contracts were unchanged; this pass is presentation-only.
- Ported the mockup `shared.css` design system into `src/features/api-mock/api-mock-studio.css`, fully scoped under a new `.api-mock-root` wrapper (and `.api-mock-empty`) with an `am-` class prefix to avoid clashing with global app classes (`.btn`, `.badge`, `.method`, `.count-badge`, `.builder-tabs`, `.form-grid`, `.matcher-row`). Added local `--am-*` accent tokens (green/blue/amber/red/mono) layered on the app's existing theme tokens.
- Design-system primitives now available scoped: buttons (`am-btn` primary/danger/ghost/small + `am-icon-btn`), badges (`am-badge` success/warning/danger/info), `am-count-badge`, method colors (`am-method`), status/dirty dots, two-tone `am-form-grid`/`am-form-row`, `am-matcher-group`/`am-matcher-row`, `am-toggle`, `am-dock`/`am-data-table`, `am-notice` variants, `am-code-block`, `am-segmented`, `am-chip`, and `am-dropdown` menu.
- `ApiMockStudioPage`: added `api-mock-root` wrapper class, a richer empty state (icon + descriptive copy), and integrated a bottom **dock** (`ApiMockDock`) with Transactions/Conflicts/State/Server-console tabs and a `data-table` transaction surface with empty states.
- `ApiMockServerTabs`: running/dirty state indicators (`am-status-dot`, `am-dirty-dot`) via optional `statusById`/`dirtyById` props; fixed invalid nested-button markup (close control is now a `role="button"` span).
- `ApiMockServerBar`: status dot + label, monospace address with copy button, "Draft changed" badge, generation, and running-aware actions (Start vs Apply/Restart/Stop-danger) plus a settings icon. New optional runtime props (`status`, `dirty`, `generation`, handlers) with safe defaults.
- `ApiMockRouteExplorer`: route search filter, enabled/draft footer summary, conflict left-border markers (`conflictRouteIds`), and an "Analyze all" action; double-click toggles enabled.
- `ApiMockRouteEditor`: inline Enabled toggle + Simulate button + conflict badge, tabbed builder (Match/Response/Behavior/Examples/Docs), two-tone form grid, and an editable matcher-group with 5-column matcher-rows (source/selector/operator/value/remove) plus add/remove condition.
- `ApiMockResponseEditor`, `ApiMockImportReview`, and `ApiMockJournal` reskinned onto the scoped design system (template-helper notice, header/cookie grids, dock/data-table, segmented import-mode control, notice variants for diagnostics).
- All 10 `ApiMockStudioPage` tests still pass (all existing `data-testid` selectors preserved); `npx tsc -b --noEmit` is clean. No engine, server, or contract files were modified.

### 2026-08-12 - Phase 12A Performance Budgets and Hot-Path Optimization

- Froze concrete p95 budgets in new Section 12.3.1 (previously the plan only listed *what* to measure, not target values) and mirrored them in code as `src/shared/api-mock/perfBudgets.ts` (`API_MOCK_PERF_BUDGETS`). Plan and code are kept in lockstep.
- Added `perfBudgets.ts`: budget table, `percentile()` (nearest-rank), a bounded LRU `BoundedCache`, `PERF_CI_SLACK` (env-overridable, default 6×), and `MAX_COMPILED_PATTERNS` (4,096 — above `HARD_CEILINGS.maxRoutes` so a full large route set stays cached across requests).
- Added `patternCache.ts`: compile-once `compileRegexCached`/`testRegexCached` memoization backed by the bounded LRU; invalid patterns cache as `null` so they are not recompiled each hit.
- Hot-path optimizations (behavior-preserving; all 314 pre-existing engine/server tests unchanged and green):
  - `pathMatcher.ts`: glob/regex path kinds compile through the cache instead of `new RegExp` per request.
  - `predicateEvaluator.ts`: `regex`/`glob`/`form_field_regex` operators use the cache; base-path stripping is now a single `startsWith`/`slice` instead of a per-route compiled `^basePath` regex; JSON body is parsed once per request via a bounded `parseBodyCached` memo shared across every route/predicate that inspects the same body. Removed the now-unused `escapeRegex`.
  - `routeSelector.ts`: builds a `Map<id, route>` once per request so the equal-priority tie-break sort and winner lookup are O(1) instead of `Array.find` (previously O(N²)·log N in the worst tie case). The exported `computeSpecificity(evaluation, routes)` signature is preserved for backward compatibility.
  - `ApiMockTransactionJournal.ts`: replaced the `push` + `slice(-maxEntries)` (full-array copy every append at cap) with a true O(1) circular ring buffer; `getAll`/`query`/`size`/`clear` semantics preserved; added a zero-cap guard.
- Added benchmark/resource tests:
  - `src/shared/api-mock/perf.bench.test.ts` — startup validation (100/500/2,000), matching for exact/regex/json_subset mixes at 2,000 routes, `percentile`, `BoundedCache` eviction, and invalid-pattern caching. Hard assertions use `PERF_CI_SLACK`; raw budgets are the true targets.
  - `src-server/api-mock/apiMockPerf.test.ts` — journal append p95 at cap with a hard memory-ceiling assertion (`size === 500`), ring-order-under-churn, zero-cap behavior, and an eight-server no-leak lifecycle (start → serve → stop → every port re-bindable) plus a repeated same-port start/stop leak check.
- Measured p95 on dev hardware are far inside budget: startup 2,000 = 0.65 ms (budget 250), match exact 2,000 = 0.45 ms (budget 3), match regex 2,000 = 1.11 ms (budget 8), match json_subset 2,000 = 1.57 ms (budget 12).
- Deferred-operator note recorded in the plan: `jsonSchema`/`xmlSchema`/`xpath_*`/`multipart_*` remain library-gated `false` fast-paths, so the "schema mix" benchmark exercises `json_strict`/`json_subset`/`jsonPath_*` as representative structural operators.
- Verification: `npx tsc -b --noEmit` clean, ESLint clean on all touched files, full API Mock suites green (340 tests across 22 files). `10D`/`10E` remain deferred; Phase 12B–12E available next.

### 2026-08-12 - Phase 12B Accessibility (WCAG)

- Implemented the Section 5.13 Keyboard and Accessibility Contract against the shipped Studio components; presentation/interaction only, no engine/contract changes.
- Reused the existing shared `src/shared/utils/tabListKeyboard.ts` (`handleTabListArrowKeys`, `getNextTabIndex`) rather than adding a new helper, matching the WS/SSE studios' ARIA tabs convention.
- **Server tabs** (`ApiMockServerTabs`): roving `tabIndex` (`selected ? 0 : -1`), Left/Right/Home/End arrow activation, `aria-controls` → workspace panel, per-tab `id`, and Delete/Backspace closes the focused tab (via `data-server-id`). Exported `API_MOCK_WORKSPACE_PANEL_ID`.
- **Workspace** (`ApiMockStudioPage`): the workspace region is now `role="tabpanel"` labelled by the active server tab; added a visually-hidden `role="status"` `aria-live="polite"` region that announces server creation, route add, and route delete.
- **Builder tabs** (`ApiMockRouteEditor`) and **dock tabs** (`ApiMockDock`): refactored to the ARIA tabs pattern — roving `tabIndex`, arrow-key nav, `aria-controls`/`id`, and a single labelled `role="tabpanel"` (`aria-labelledby` tracks the active tab).
- **Route tree** (`ApiMockRouteExplorer`): roving `tabIndex` on the selected item and Up/Down/Home/End focus movement that does not change selection (tree pattern); focus is decoupled from selection which stays on Enter/Space.
- **Icon-only controls**: added `title` tooltips alongside `aria-label` on add-server, add-route, remove-condition, add-variant, copy-address, settings, and the enabled toggle; the toggle exposes `role="switch"` + `aria-checked`.
- **CSS**: broadened the focus ring to `.api-mock-root :focus-visible` (previously only `.am-btn`/inputs had a visible outline — tabs/tree/toggle/menu/segmented/chips were missing one), added a `prefers-reduced-motion` block (WCAG 2.3.3) that neutralizes transitions/animations, and added an `.am-sr-only` utility. Responsive/zoom media queries from the UI pass remain.
- Added `src/features/api-mock/apiMockA11y.test.tsx` — 13 tests covering roving tabindex + `aria-controls`/`aria-labelledby` on all three tablists, arrow-key activation, Delete-to-close, tree focus-vs-selection, the live region, switch semantics, and accessible names/tooltips on icon-only buttons (imports `@testing-library/jest-dom`, matching the WS shell test).
- Verification: `npx tsc -b --noEmit` clean, ESLint clean on the feature dir, full API Mock suites green (353 tests across 23 files; the 10 pre-existing `ApiMockStudioPage` tests and their `data-testid` selectors all preserved). Manual keyboard/screen-reader/contrast/zoom review at desktop/tablet/mobile remains a human step. Phase 12C–12E available next.

### 2026-08-12 - Phase 12C Recovery/Reliability Drills

- Added `src/shared/api-mock/recoveryDiagnostics.ts` — pure helpers that centralize the recovery behavior the plan describes (Sections 5.13, W2, W21, AMS-009/010):
  - `classifyRuntimeError(error)` → stable, user-facing `RuntimeDiagnostic` (`MOCK_PORT_IN_USE`, `MOCK_PORT_OWNED`, `COMPANION_UNAVAILABLE`, `MOCK_VALIDATION_ERROR`, `MOCK_RUNTIME_ERROR`) with `recoverable`/`retry` flags — no raw stack text reaches the UI.
  - `reconcileRuntimeState(persisted, live)` → implements W21/AMS-010: persisted `running: true` is never trusted; a companion that reports stopped clears it to `stopped` with a `was_running` notice, and an unreachable companion marks every server `unknown` with a `companion_unavailable` notice.
  - `safeLoadWorkspace(raw)` → parse + migrate + validate a persisted workspace without ever throwing; corrupt JSON, unsupported versions, failed migrations, and structural errors return `{ ok: false, diagnostics }` so the caller falls back to a fresh workspace.
- Introduced the `AMS-STORAGE-` diagnostic prefix (`AMS-STORAGE-CORRUPT`) and recorded it in Section 8.11.
- Wired `classifyRuntimeError` into the control-plane `start`/`restart` routes so runtime failures return the classified stable code + friendly message instead of a raw `START_FAILED`/`RESTART_FAILED` message.
- Added drill tests (17 total, all green):
  - `src/shared/api-mock/recoveryDiagnostics.test.ts` — companion crash, port-theft classification, stale-state reconciliation, corrupt storage, migration failure, and secret-export redaction (asserts sensitive variable values never appear in redacted exports while non-sensitive values survive).
  - `src-server/api-mock/apiMockRecoveryDrills.test.ts` — live runtime drills: external port theft (raw `net` server holds the port → `MOCK_PORT_IN_USE`), internal ownership conflict (`MOCK_PORT_OWNED`), oversized traffic (body over `maxInboundBodyBytes` truncated, server keeps serving), graceful shutdown (all ports re-bindable, servers stopped), and invalid-draft isolation (a draft that fails `validateServer` never bumps the running generation and the live server keeps serving).
- Verification: `npx tsc -b --noEmit` clean, ESLint clean on all touched files, full API Mock suites green (370 tests across 25 files). Migration-failure atomic reject (drill #4) reuses the existing `migrateWorkspace` behavior. Phase 12D–12E available next.

### 2026-08-12 - Workspace persistence wiring fix

- Fixed a regression: `ApiMockStudioPage` held servers only in `useState`, so created mock servers vanished on navigation/reload even though Phase 3B lists persistence as delivered. Definitions were never written to storage.
- Added `src/features/api-mock/apiMockPersistence.ts` — `loadApiMockWorkspace`/`saveApiMockWorkspace` persist the workspace envelope through the platform storage abstraction (`readKey`/`writeKey`; IndexedDB on web, Tauri store on desktop) under `api-mock-workspace-v1`. Loading reuses the Phase 12C `safeLoadWorkspace` helper and keeps the migrated workspace even when validation flags non-fatal issues, so user work is never dropped on a warning; only unparseable data resets to empty. Runtime status (running/generation) is deliberately not persisted — it is reconciled from the companion.
- Wired the page to hydrate from storage on mount, autosave (300ms debounce) on definition/active-tab change, and flush the latest state on unmount so navigating away never drops a pending save.
- Added `src/features/api-mock/apiMockPersistence.test.tsx` (5 tests: save/load round-trip, route preservation, corrupt-storage fallback, empty default, and on-mount page hydration) and isolated the existing `ApiMockStudioPage`/`apiMockA11y` suites with `localStorage.clear()` between cases.
- Verification: `npx tsc -b --noEmit` clean, ESLint clean, full API Mock suites green (375 tests across 26 files).

### 2026-08-12 - Mockup gap-fill: wire placeholder tabs to real features + runtime

- Re-audited the eight mockups against the shipped Studio and closed the largest functional gaps where the engine/components already existed but were unwired.
- **Companion runtime**: mounted `createApiMockRouter` in `webhook-server.ts` (it was defined but never registered) and fixed its wrong relative import depths (`routes/api-mock/` needs `../../api-mock/` and `../../../src/shared/`). Added a frontend `apiMockControlClient` (start/stop/restart/commit) whose failures become classified `RuntimeDiagnostic`s (incl. mapping the Vite dev-proxy `BACKEND_UNREACHABLE` → companion-unavailable). Wired Start/Stop/Restart/Apply with per-server status dot, generation, dirty→Apply, and inline error on the server bar.
- **Route editor tabs** (previously placeholder notices):
  - Response tab now renders the full `ApiMockResponseEditor` (variants, status, content-type, body, headers, cookies, timing, template-helper notice).
  - Behavior tab: response-mode selector, fault injection, and default-variant delay/jitter.
  - Docs tab: editable operationId + tags.
  - Editable route **name** (rename) and a **Delete** action guarded by the styled confirm dialog.
- **Simulate** (mockup 04): new `ApiMockSimulateModal` wires `simulateSingle` — enter method/path/headers/body, see outcome, a candidate-evaluation `data-table`, and near-misses.
- **Import** (mockup 06): the existing `ApiMockImportReview` is now reachable via an Import button in the route explorer, opened in `AppModalFrame`; imported routes are appended as drafts.
- **Conflicts** (mockup 05): "Analyze all" runs `analyzeConflicts`, marks conflicting routes in the explorer and the editor header badge, and feeds the dock Conflicts count.
- **Server settings** (mockup 07 partial): the gear opens `ApiMockServerSettingsModal` (name/host/port/base-path with validation + LAN warning). Native `<select>`s were replaced with the standard `CustomSelect`.
- Added tests: `apiMockControlClient.test.ts` (4), `apiMockWiring.test.tsx` (4 — Response editor render, Behavior controls, Simulate run + trace, Import modal). Existing suites isolated with `localStorage.clear()`.
- Still open (documented, lower priority): Pattern toolbox (mockup 02), live runtime journal binding in the dock Transactions/Console tabs (mockup 07), and dedicated mobile/tablet drawer layouts (mockup 08).
- Verification: `npx tsc -b --noEmit` clean, ESLint clean, full API Mock suites green (384 tests across 28 files).

### 2026-08-12 - Remaining mockup gaps: live journal, pattern toolbox, responsive

- **Live runtime journal** (mockup 07): added `apiMockControlClient.transactions`/`clearTransactions`; the page polls the running server's journal every 1.5s and feeds `ApiMockDock`. The Transactions tab now renders a live `data-table` (time/method/path/status/duration/matched-rule) with row selection → request/match/response detail pane, a count badge, and a Clear action. Polling resets on server switch and stops when the server is not running. The superseded `ApiMockJournal.tsx` was removed (dead code).
- **Pattern toolbox** (mockup 02): new `ApiMockPatternToolboxModal`, opened from a ✦ button beside the route Path field. It offers kind (exact/parameterized/glob/regex), a case-insensitive toggle, a live tester that runs `matchPath` against a sample path (showing match + captured params), and preset chips; Apply writes the matcher back to `route.path`.
- **Responsive** (mockup 08): replaced the `<=640px` rule that hid the route panel entirely (routes became unreachable) with a `<=700px` stacked layout — route panel on top (capped height, scrollable), editor below, wrapped server bar, and a shorter dock.
- Added `apiMockWiring.test.tsx` coverage for the pattern toolbox (open → preset → live match → apply). Live-journal polling is covered by `apiMockControlClient.test.ts` transport tests.
- Verification: `npx tsc -b --noEmit` clean, ESLint clean, full API Mock suites green (385 tests across 28 files).

### 2026-08-12 - Live scenario-state runtime + /state endpoint

- Wired Phase 7 runtime into the companion listener: `ApiMockNetworkListener` now selects response variants by mode (`selectSequenceResponse`/`selectWeightedResponse`/`selectStateResponse`, previously only rules-mode default was served) and applies each variant's `transition` via `applyTransition` on a server-scoped `default` state key, tracking `states` + `counters` and sequence cursors per listener.
- Added `getScenarioState()`/`resetScenario()` on the listener, delegated through `ApiMockServerPool.getScenarioState`/`resetScenarioState` (running servers only).
- New control routes: `GET /api/mock/servers/:serverId/state` and `POST /api/mock/servers/:serverId/state/reset`.
- Frontend: `apiMockControlClient.state`/`resetState`; the page polls state alongside transactions (1.5s) and the **State dock tab** now shows **live** current state(s) and counter values (`key = value`, `counter: n`) with a **Reset state** button when running, falling back to the declared static model when stopped.
- Tests: `apiMockScenarioState.test.ts` (live listener drills — state advances, counter increments across requests, reset clears). Full suites green: 442 tests across 30 files; `tsc` + ESLint clean.
- This completes the dynamic dock: Transactions and State are both live-bound when the companion runs. Console remains informational (no per-server log stream yet).

### 2026-08-12 - Dock Console bound to the companion log stream

- Added `useApiMockConsole` — subscribes to the companion SSE endpoint `GET /api/logs/stream` (the same stream the Workflow console uses), keeps only `source === 'api-mock'` lines (bounded to 300), and exposes a `clear()`. Safe no-op when EventSource is unavailable (tests) or the companion is down.
- The **Console dock tab** now renders live lifecycle lines (Start/Stop/Apply/commit, e.g. `Started "Mock Server 1" on :4600`) in a monospace pane with a **Clear** button; empty-state guidance otherwise.
- Wired the hook in `ApiMockStudioPage` (active whenever a server exists) and passed `consoleLines`/`onClearConsole` to `ApiMockDock`.
- Tests: `ApiMockDock.test.tsx` (empty state + streamed-line rendering + clear button). Full API Mock suites green (390 feature/shared/server tests; `tsc` + ESLint clean).
- All four dock tabs are now bound: Transactions (live journal), Conflicts (analyze), State (live scenario), Console (log stream).

### 2026-08-12 - W8 "Add group" made functional (nested predicate groups)

- **Bug**: the Match tab's `[ ] Group` button (W8 "Add group" row) appended a real `ApiMockPredicateGroupV1` to `route.predicates.children`, but the editor rendered only leaves (`group.children.filter(isLeaf)`). Nested groups were therefore invisible and uneditable while still being persisted, exported, and evaluated. The engine (`predicateEvaluator.ts`) had supported recursive ALL/ANY/NOT since Phase 2 — only the UI was missing.
- Added `src/shared/api-mock/predicateTree.ts`: immutable id-addressed tree edits — `isPredicateGroup`, `addChildToGroup`, `updateLeafInTree`, `updateGroupInTree`, `removeNodeFromTree`, `findLeafInTree`, `countLeaves`, `COMBINATOR_LABELS`. Flat array splices in the editor are replaced by these so edits reach any depth.
- `ApiMockRouteEditor` now renders the predicate tree recursively (`renderGroup(node, depth)` / `renderLeaf(pred)`). Each group — root and nested — gets its own combinator `CustomSelect` (All of / Any of / None of), a live leaf count, `+ Condition`, `[ ] Group`, and (nested only) a remove button. Empty groups show an inline hint rather than rendering as nothing.
- New testids: `api-mock-group-{id}`, `api-mock-group-combinator-{id}`, `api-mock-group-add-condition-{id}`, `api-mock-group-add-group-{id}`, `api-mock-group-remove-{id}`, `api-mock-group-empty-{id}`. All pre-existing condition testids are unchanged.
- **Controls are not duplicated**: the section heading is now a plain "Match conditions" label plus a hint. The combinator, the leaf count, `+ Condition`, and `[ ] Group` live *only* on each group header, so there is exactly one set of controls per group and it is unambiguous which group a click targets. The root group is always rendered (even when empty) so the add buttons remain reachable; the root's buttons keep the canonical `api-mock-add-condition` / `api-mock-add-group` testids and its empty state keeps `api-mock-conditions-empty`.
- The Match tab badge now uses `countLeaves()` so conditions inside nested groups are counted.
- CSS: `.am-matcher-group.nested` adds indentation, a softened accent rail, rounded right edge, and a faint tint that lightens again at depth 3+.
- Also fixed `ApiMockStudioPage.orchestration.coverage-gaps.test.tsx`, which still mocked `onImport`/`onExport` on `ApiMockStudioTitleBar` after those moved to `ApiMockWorkspaceNav` (3 pre-existing failures).
- Verified: Playwright drove root → nested → depth-3 group creation, added conditions inside a nested group, and switched a nested combinator to "Any of". 714 tests across 88 files green; `tsc` + ESLint clean.

### 2026-08-12 - TLS: distributing the certificate to clients

- Gap: the TLS panel could *generate* a self-signed pair but offered no way to get the certificate out of the app — the only option was manually selecting the PEM textarea. Without the certificate a client cannot verify the mock, so HTTPS was effectively only usable with verification disabled (`curl -k`).
- Added **Copy certificate** and **Download .pem** actions under the Certificate field (`api-mock-settings-tls-copy-cert`, `api-mock-settings-tls-download-cert`). Both are disabled until a certificate exists. The download is named from the server (`<Server-Name>-cert.pem`).
- Only the certificate is ever copied or downloaded; the private key has no such affordance and its hint now reads "Never share this. Redacted from all exports."
- The TLS warning notice now gives runnable client commands (`curl --cacert <file> <listen-url>`, `NODE_EXTRA_CA_CERTS=<file>`) instead of only suggesting `curl -k`.
- Tests: certificate copy asserts the clipboard payload contains `BEGIN CERTIFICATE` and *not* `PRIVATE KEY`; download asserts blob create/click/revoke; both actions assert disabled with no cert.
- Verified end-to-end: generated a cert in the UI, downloaded it, started the listener, then `curl --cacert <downloaded.pem> https://127.0.0.1:4600/` verified TLS successfully (HTTP 404 = no route matched, handshake fine) while plain `curl` failed with exit 60 (SSL certificate problem). `openssl x509` confirmed `CN=localhost` with SANs `DNS:localhost, IP:127.0.0.1`.
- 717 tests across 88 files green; `tsc` + ESLint clean. mTLS (client certificates) remains deferred.

### 2026-08-12 - mTLS: the studio issues client certificates (AMS-025 unblocked)

- Previously deferred. Delivered because the standard mTLS onboarding — client generates a key + CSR, operator signs it — is too heavy for a mock. The studio now acts as the CA and hands over a ready-to-use client identity, so the client creates nothing.
- Contract: new `ApiMockMtlsSettingsV1` on `ApiMockTlsSettingsV1.mtls` — `enabled`, `clientCaPem` (verification anchor), plus the issued `clientCertPem` / `clientKeyPem` / `clientCommonName` so the pair can be re-downloaded later.
- `apiMockTls.ts` gains `generateClientCredentials(commonName)`: creates a CA (`basicConstraints=critical,CA:TRUE`, `keyUsage=keyCertSign,cRLSign`), then a client key + CSR signed by it with `basicConstraints=CA:FALSE` and `extendedKeyUsage=clientAuth`. Returns `{ caCertPem, clientCertPem, clientKeyPem, commonName }`. Still shells to system `openssl` — no new dependency.
- Control route `POST /api/mock/tls/client-credentials` → `apiMockControlClient.generateClientCredentials()`.
- `ApiMockNetworkListener` adds `{ ca: clientCaPem, requestCert: true, rejectUnauthorized: true }` when `mtls.enabled`, and refuses to start if mTLS is on with no CA.
- Settings → TLS gains a **Client certificates (mTLS)** section: require-client-cert toggle, client name field (becomes the CN), **Generate client certificate**, and an issued-credentials panel with Download client cert / client key / CA plus the exact `curl --cacert … --cert … --key …` invocation. Copy states which file is public and which must be sent securely.
- Security: `clientKeyPem` is redacted on export alongside `keyPem` and `passphrase`; `clientCaPem`/`clientCertPem` are public and preserved. New diagnostic `AMS-TLS-CLIENT-CA-MISSING`. Documented tradeoff — the client private key is generated here and transported, which is fine for mocks but not for production credentials.
- Tests: `apiMockMtls.test.ts` (live listener — accepts the issued cert, rejects a cert-less client, allows cert-less when mTLS is off, refuses to start without a CA), `apiMockTls.test.ts` issuance/CN-default cases, `ApiMockServerSettingsModal.mtls.test.tsx` (generate, persist on save, error surface, downloads gated on credentials), export-redaction and validation cases.
- Verified end-to-end through the real UI: generated server + client material, downloaded all three PEMs, started the listener, then `curl --cacert server --cert client --key clientkey https://127.0.0.1:4600/` returned **HTTP 200** while the same call without a client certificate failed with **exit 56**. `openssl x509` confirmed `CN=acme-client`, issuer `RedfireForge API Mock Client CA`, EKU `TLS Web Client Authentication`.
- 729 tests across 90 files green; `tsc` + ESLint clean.

### 2026-08-12 - Settings modal: viewport-clamped drag, resize, and TLS/mTLS coupling

- **Drag escaped the viewport.** `AppModalFrame` supports `constrainDragToViewport` but defaults it to `false`, and the settings modal never opted in — so the dialog could be dragged fully off-screen and become unreachable. Now passes `constrainDragToViewport` (8px edge padding). Verified: dragging to `-800,-800` pins at `8,8`; dragging to `3000,3000` pins at `352,172` on a 1400×900 viewport (`innerWidth - modalW - 8`).
- **Resize was explicitly disabled.** The modal passed `showResizeHandles={false}`. Now enabled — right edge, bottom edge, and corner handles. Verified 1040×720 → 733×513 via corner, widened via right edge, and clamped at the minimum.
- **Minimum width was too small to be honest.** `minWidth={580}` let the user shrink the dialog until the TLS panel was silently clipped (`Download .pem` cut mid-word) because `.am-stg-panel` had `overflow-x: hidden`. Measured every panel across 580–1040px: TLS overflows by 180px at 580, 120px at 640, 60px at 700, and fits at 760. Raised `minWidth` to **760** and switched `.am-stg-panel` to `overflow-x: auto` so content can never be clipped without a way to reach it.
- **mTLS could outlive HTTPS.** Turning HTTPS off left "Require client cert" on, which is meaningless (mTLS exists only inside a TLS handshake) and would have persisted a contradictory `tls.enabled=false, mtls.enabled=true`. Disabling HTTPS now clears the requirement. Re-enabling HTTPS deliberately does *not* restore it — the user opts in again. Issued CA/cert/key material is retained either way, so nothing is lost.
- Tests: two new cases in `ApiMockServerSettingsModal.mtls.test.tsx` covering the coupling on toggle and on save, and that re-enabling HTTPS does not silently restore mTLS.
- 731 tests across 90 files green; `tsc` + ESLint clean.

### 2026-08-12 - Per-rule delete in the route explorer

- Each rule row in the RULES tree now carries a right-aligned trash control, matching the existing folder-row affordance. Previously deleting a rule required selecting it first and using the editor header — the explorer accepted an `onDelete` prop but never rendered anything for it (`onDelete: _onDelete`), so the wiring had been stubbed since the explorer was written.
- Markup follows the `am-tree-folder-row` precedent: the row is now `div.am-tree-route-row` wrapping the existing `button.am-route-item` plus a sibling `button.am-route-delete`. Nesting a button inside the row button would have been invalid HTML — the same trap already fixed once in `ApiMockServerTabs`. `role="treeitem"` stays on the inner button so roving arrow-key navigation is unchanged (asserted by test).
- CSS `.am-route-delete` mirrors `.am-folder-delete` exactly: `opacity: 0.72` at rest, `1` on row hover or keyboard focus, red tint on direct hover. It was briefly hover-only (`opacity: 0`), which made the control undiscoverable — a static view showed no delete affordance at all, so the feature read as missing. Always-visible also matches the folder rows directly above it. The button keeps its 24px slot regardless, so the `P` priority badges stay aligned across rows.
- **Data-loss guard**: the explorer was wired to `handleDeleteRoute`, which deletes immediately, while the editor used `confirmDeleteRoute`. Rendering the control as-is would have made a single stray click destroy a rule with no prompt. The explorer now resolves the route and goes through `confirmDeleteRoute`, so both entry points share one confirmation path.
- Tests: delete fires with the correct id and does *not* also select the row, each control is labelled with its rule name, and the treeitem count is unchanged.
- Verified in the browser: trash right edge is flush with the row right edge (both 320px), hidden at rest and 0.72 opacity on hover, Cancel keeps the rule (2 → 2) and Delete Permanently removes it (2 → 1).
- 734 tests across 90 files green; `tsc` + ESLint clean.

### 2026-08-12 - Rule deletion consolidated onto the rule row

- Completed the move: the editor header's **Delete** button (after Simulate) is gone, along with the now-dead `onDelete` prop on `ApiMockRouteEditor` and its wiring in `ApiMockStudioPage`. Deletion has exactly one home — the trash on each rule row — instead of two controls doing the same thing from different places.
- Delete controls are now **red at rest** (`var(--am-red)`), not only on hover. Applied to both `.am-route-delete` and `.am-folder-delete`, since a muted trash beside a red one would have read as two different actions. `.am-folder-add` deliberately stays neutral — it is not destructive.
- Tests updated rather than deleted: `ApiMockRouteEditor.test.tsx` now asserts the header *does not* offer deletion (`queryByTestId('api-mock-delete-route')` is null), and the two page coverage suites drive deletion through the explorer's per-rule control.
- Verified in the browser: rule and folder trash both compute to `rgb(228, 119, 119)` with the pointer parked away from the list, folder add stays `rgb(168, 184, 204)`, and the editor header reads `GET / · Rule ID … · 0 matches · Enabled · Simulate` with no Delete.
- 753 tests across 91 files green; `tsc` + ESLint clean.

### 2026-08-12 - WireMock import: single-stub files, body matchers, bodyFileName

- **Import failure**: `parseWireMockMappings` accepted only an array or `{ mappings: [] }`. A bare stub object — WireMock's default `mappings/*.json` layout, one stub per file — fell through to `AMS-IMPORT-EMPTY`. Now accepts a single stub, an array, `{ mappings: [...] }`, and `{ mappings: {...} }`. YAML stub files parse too (falls back to the already-imported `yaml` parser); the parse diagnostic now reads "Could not parse as JSON or YAML."
- **`bodyPatterns` were silently dropped** with a one-line loss note, so an imported stub matched on method + path alone — every fault stub for the same URL collapsed onto the same rule. New `mapBodyPatterns()` translates them into real predicates: `equalTo`→`exact`, `contains`→`contains`, `matches`→`regex`, `equalToJson`→`json_strict` / `json_subset` (honouring `ignoreExtraElements`), `matchesJsonPath`→`jsonPath_exists` / `jsonPath_equals`.
- **XPath**: `xpath_exists` / `xpath_equals` exist in `ApiMockPredicateOperator` but `evaluateOperator` returns `false` for them, so emitting those would have produced rules that can never match. Instead `matchesXPath` with a `contains`/`equalTo` sub-matcher is approximated as a whole-body `contains`, and the approximation is written to the loss report with a suggestion to tighten it. A bare `matchesXPath` expression yields **no** predicate plus an explicit loss note, rather than a dead rule.
- **`bodyFileName`** referenced files in WireMock's `__files/`, which a pasted stub never carries, so the response body came through empty. The importer now inserts a visible placeholder naming the file and raises `AMS-IMPORT-WIREMOCK-BODYFILE` telling the user to paste the contents into the Response tab.
- `SourceRequest` gained an optional `predicates` array that `buildPredicates()` appends, so any importer can contribute match conditions.
- Tests: `importParsers.wiremock.test.ts` (single stub / array / `mappings` object / YAML, matcher coverage, no `xpath_*` emitted, placeholder + diagnostic) and `apiMockWireMockImport.test.ts` — a live listener proving two stubs that differ only by their VIN marker route correctly (`FaultCode200`→500, `SUCCESS`→200, unmarked VIN→404).
- 765 tests across 93 files green; `tsc` + ESLint clean.

### 2026-08-12 - Tauri control plane + fallback response templating

Both defects were found by building the packaged Tauri app and driving it, not by reading code.

- **Control plane was broken in the desktop app.** `apiMockControlClient` issued a bare relative `fetch('/api/mock/...')`. Under Tauri the app is served from `tauri://localhost`, where that path is answered by the asset protocol's SPA fallback: **HTTP 200 with `index.html`**, not a transport error. `res.json()` then threw and the user got the nonsensical **"Request failed (200)."** Verified in the packaged webview that `http://127.0.0.1:3001/api/mock/servers` *is* reachable — so nothing was sandboxed, only the URL was wrong.
- New `controlBase.ts` → `apiMockControlBase()`: absolute companion origin under Tauri (and in Node, for CLI/workflow use), empty string elsewhere so the Vite dev proxy and production server keep handling `/api` same-origin. Mirrors the existing `getProxyBase()` convention in `graphqlProxyTransports.ts`.
- **Same bug, second site**: `graphRunnerApiMockNodeHandlers.controlBaseUrl()` used `window.location.origin`, which is `tauri://localhost` in the desktop app — the workflow apiMockStart/Apply/Stop nodes were broken there too. Now routed through the same helper.
- **Fallback/ambiguity bodies never rendered their templates.** `settings.fallback.unmatchedResponse` and `settings.selection.ambiguityResponse` are static settings, so they bypassed the template engine and served `{"error":"not_found","requestId":"{{requestId}}"}` literally — the correlation id was useless, and the ambiguity body was invalid JSON (`"competingRules":{{competingRuleCount}}`).
- New `fallbackBody.ts` → `renderFallbackBody()` handles the fixed placeholder set, plus `newTransactionId()`. The listener now generates the id **before** writing the response and passes it to `recordTransaction`, so the id echoed in the body is the journal entry's id. Fixed in both emitters: `ApiMockNetworkListener` and `simulation.ts`.
- Tests: `fallbackBody.test.ts`, `controlBase.test.ts`, and `apiMockFallbackTemplate.test.ts` (live listener — asserts the rendered id equals the journal transaction id for both unmatched and ambiguous, and that the body parses as JSON).
- **Verified in the packaged Tauri app**: rebuilt, started a listener from the UI — server bar showed `Running http://127.0.0.1:4600 Generation 1`, no error; `lsof` confirmed the port bound; an unmatched request returned `{"error":"not_found","requestId":"tx-1786593619031-zh28ms"}`; and the journal entry id matched the id in the response body.
- 10,458 tests across 562 files green; `tsc` + ESLint clean.

### 2026-08-13 - Companion bundled as a Tauri sidecar (self-contained desktop app)

Closes the remaining desktop gap: the app connected to the companion correctly but could not start one, so the user had to run `npm run server:dev` by hand.

- **Fully self-contained binary.** `scripts/build-sidecar.mjs` bundles `src-server` to a single CJS file and injects it into a copy of the Node runtime via Node 22's Single Executable Application support (`--experimental-sea-config` + `postject`, ad-hoc `codesign` on macOS). Output `src-tauri/binaries/redfireforge-companion-<target-triple>` (~115 MB; gitignored). Verified running under `env -i` with no `node` on PATH and no `node_modules`.
- **Dynamic requires blocked bundling.** `kafka-adapter`, `grpcJsLoader` and `bsrFetchGateway` load `kafkajs`, `kafkajs-snappy`, `@grpc/grpc-js` and `undici` through `createRequire(import.meta.url)` so they stay lazy — esbuild cannot see those ids, and the previous `build-server.mjs` simply marked them external (fine when `node_modules` exists, fatal for a sidecar). Rather than rewrite that deliberately-lazy code, new `src-server/sidecarPrelude.ts` imports them statically and patches `createRequire` to return the bundled copies. Also defines `import.meta.url` for the CJS output, which is otherwise empty.
- **Lifecycle.** New `src-tauri/src/companion.rs`: spawns the sidecar on setup with `PORT=3001`, stores the `CommandChild` in managed state, drains stdout/stderr into the log, and kills it on window-destroyed and on `RunEvent::Exit`. If port 3001 is already serving — the usual `tauri dev` case — it adopts that instance instead of fighting for the port, and does not kill what it did not start.
- **Orphan prevention.** First run leaked: `kill -9` on the app left the companion holding 3001. Tauri keeps a stdin pipe open to a sidecar for its lifetime, so the companion now exits on stdin `end`/`close`/`error` when `RF_SIDECAR=1`. Re-verified with `kill -9` — companion exits with the parent, port released.
- `tauri.conf.json`: `bundle.externalBin` + `beforeBuildCommand` now runs `build:sidecar`; `capabilities/default.json` grants scoped `shell:allow-spawn` for that sidecar only.
- **Verified in the packaged app** with no external server running: port 3001 owned by `redfireforge-companion` (not node), API Mock start → `Running http://127.0.0.1:4600 Generation 1`, an unmatched request returned a rendered `requestId`, and no orphan after SIGKILL.
- 3,207 tests green; `tsc` + ESLint clean; no clippy findings in `companion.rs`.
