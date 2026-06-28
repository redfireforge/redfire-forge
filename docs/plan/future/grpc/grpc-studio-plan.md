# gRPC Studio — Implementation Plan

> Branch: `feature/grpc-studio` (not yet started)
> Created: 2026-06-28
> Status: **📋 Planning** — Research complete; implementation not yet begun
> Prior art: See `long-term-enhancement-plan.md` backlog item P-2 and `environment-manager-expansion-plan.md` §gRPC tab

---

## Table of Contents

1. [Overview](#overview)
2. [Competitive Landscape](#competitive-landscape)
3. [Spring Boot Support](#spring-boot-support)
4. [Design Decisions](#design-decisions)
5. [Phase Status Dashboard](#phase-status-dashboard)
6. [Phase 1 — Core Service Explorer & Unary Calls](#phase-1--core-service-explorer--unary-calls)
7. [Phase 2 — Streaming (Server / Client / Bidirectional)](#phase-2--streaming-server--client--bidirectional)
8. [Phase 3 — Proto Management & Schema Registry](#phase-3--proto-management--schema-registry)
9. [Phase 4 — TLS, mTLS & Auth](#phase-4--tls-mtls--auth)
10. [Phase 5 — Saved Requests, Collections & History](#phase-5--saved-requests-collections--history)
11. [Phase 6 — Workflow Integration](#phase-6--workflow-integration)
12. [Phase 7 — Tauri Native Transport (tonic)](#phase-7--tauri-native-transport-tonic)
13. [Phase 8 — Test Runner Integration & Assertions](#phase-8--test-runner-integration--assertions)
14. [Phase 9 — Environment Variable Interpolation](#phase-9--environment-variable-interpolation)
15. [Phase 10 — gRPC-Web Support](#phase-10--grpc-web-support)
16. [Phase 11 — Advanced Features (Load Testing, Mock Server, Proto Schema Diff)](#phase-11--advanced-features)
17. [Phase 12 — Demo Lessons & Demo Hub](#phase-12--demo-lessons--demo-hub)
18. [Phase 13 — Production Hardening & GA Readiness](#phase-13--production-hardening--ga-readiness)
19. [Phase Dependency Map](#phase-dependency-map)
20. [File Map](#file-map)
21. [Type Definitions](#type-definitions)
22. [Open Questions / Risks](#open-questions--risks)

---

## Overview

**gRPC Studio** is a standalone, interactive debug tool for calling gRPC services — analogous to how **WebSocket Studio** works for WebSocket endpoints and **GraphQL Studio** works for GraphQL APIs.

It is a **first-class page** under the Protocols domain where developers and testers can:

- Connect to any gRPC server (plain-text or TLS/mTLS) using its proto schema or server reflection
- Browse available services and methods, including unary and all four streaming types
- Compose and send requests with type-aware form input (no raw binary guessing)
- Inspect full gRPC responses including headers, trailers, and status codes
- Save requests as reusable collections
- Run gRPC scenarios in the Test Runner with field-level assertions
- Integrate with the Workflow engine (`grpcUnary`, `grpcServerStream` nodes)
- Use native Tauri transport (`tonic`) on desktop for true HTTP/2 without proxy overhead
- Interpolate environment variables for target addresses (`{{grpcHost}}`)

The key analogy:

| HTTP world | WebSocket world | gRPC world |
|---|---|---|
| Requests page | Send Panel + Message Log | Service Explorer + Call Panel |
| Environments / Base URL | Connection Profiles | `{{grpcHost}}` per environment |
| Response Body | Message Log | Response Stream + Trailers |
| Catalog (organized tests) | Saved Connections | gRPC Collections |

### Navigation

```
Activity Bar: API | Workflow | Harness | Gallery | Protocols | Settings

Protocols sub-nav:
  kafka-message-studio   → "Kafka"
  websocket-studio       → "WebSocket"
  graphql-studio         → "GraphQL"
  sse-studio             → "SSE"
  grpc-studio            → "gRPC"       ← NEW
```

---

## Competitive Landscape

> Last researched: 2026-06-28

### Commercial products

| Tool | Type | Highlights | Gaps vs RedfireForge |
|---|---|---|---|
| **Postman** | Commercial SaaS + desktop | gRPC unary + all streaming types, proto import/reflection, collections, environments, team sharing | No workflow engine, cloud-first (privacy concerns), no test harness assertions, limited load testing |
| **Insomnia** | Commercial (Kong) + open core | gRPC unary + streaming, proto file import, environments, collections | No workflow integration, no assertion engine, no native desktop transport, limited TLS automation |
| **Kreya** | Commercial desktop (privacy-first) | gRPC + REST + GraphQL + SSE + WS in one workspace; proto import + reflection + grpcurl import; strong auth vault (OAuth2, mTLS, AWS SigV4, Kerberos, NTLM); snapshot tests, scripting, CI CLI; git-diffable project files | No workflow engine, no load testing built-in, scripting is JS-limited, no integrated Kafka |
| **Grip** | Commercial (native macOS only) | Native macOS gRPC client, clean UI, server reflection | macOS only, no cross-platform, no workflow or assertions |
| **grpcmd-gui** | Commercial + free tier | Cross-platform desktop, scripting framework, CI support | Less mature ecosystem, no workflow engine |
| **Apidog / Apifox** | Commercial SaaS + desktop | Multi-protocol workspace including gRPC, mock server, team collaboration | Cloud-first, no workflow automation |

### Open-source tools

| Tool | Stars | Highlights | Gaps |
|---|---|---|---|
| **grpcui** (FullStory) | 5.9k ⭐ | Browser-based web UI, Go library for embedding; dynamic HTML form; server reflection + proto + protoset; plain-text + TLS/mTLS; request JSON tab | CLI-launched only, no desktop UX, no streaming input UI, no saved collections, no assertions, no workflow |
| **Evans** | ~4k ⭐ | REPL-style CLI; tab completion via reflection; interactive streaming; clean UX for devs | CLI only, no GUI |
| **grpcurl** | ~10k ⭐ | Curl for gRPC; scriptable; widely used | CLI only |
| **ezy** | 1k ⭐ | Electron + TypeScript desktop; tabs; environments; persisted collections; gRPC-Web support; TLS/mTLS; all 4 call types; stream cancellation | Abandoned (last release 2023), no workflow, no assertions, no load testing |
| **Wombat** | 1.4k ⭐ | Qt + Go, not Electron; all 4 call types; multiple workspaces; reflection + proto file; TLS; RPC stats; well-known types | Abandoned (last release 2021), no assertions, no workflow |
| **BloomRPC** | 9k ⭐ | Pioneered GUI gRPC clients | **Archived Jan 2023** — team explicitly recommends alternatives |
| **gRPCox** | ~1.2k ⭐ | Web-based; reflection only; minimal UI | No saved requests, no streaming input, unmaintained |
| **Milkman** | ~1k ⭐ | Extensible Postman-like multi-protocol; gRPC plugin | Java-based (JVM overhead), plugin ecosystem fragmentation |
| **ghz** | ~6k ⭐ | CLI load testing for gRPC; histogram metrics; JSON/prometheus output | CLI only, no interactive UI |
| **Microcks** | ~1.2k ⭐ | gRPC mock server from proto; CNCF sandbox project | Service-oriented (deploy as infra), not a client tool |
| **Mediator** | ~400 ⭐ | gRPC debug proxy (like Charles but for gRPC); passive capture | Proxy mode only, not a direct call client |
| **Step CI** | ~3k ⭐ | YAML-based API testing + monitoring incl. gRPC | YAML-only, no GUI |

### Feature comparison matrix

| Feature | Postman | Insomnia | Kreya | grpcui | ezy | **RedfireForge** |
|---|---|---|---|---|---|---|
| Unary RPC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Server Streaming | ✅ | ✅ | ✅ | ⚠️ (batch) | ✅ | ✅ |
| Client Streaming | ✅ | ✅ | ✅ | ⚠️ (batch) | ✅ | ✅ |
| Bidirectional Streaming | ✅ | ✅ | ✅ | ⚠️ (batch) | ✅ | ✅ |
| Server Reflection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Proto File Import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Protoset Import | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Type-Aware Form Input | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Raw JSON Input | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Response Headers + Trailers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| gRPC Status Codes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Request Metadata | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TLS (server-side) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| mTLS (client cert) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saved Collections | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ Phase 5 |
| Environments / Variables | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ Phase 9 |
| OAuth2 / Bearer Auth | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ Phase 4 |
| gRPC-Web Support | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ Phase 10 |
| Spring Servlet Mode | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 10 |
| Spring Boot Quick-Connect | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 1 |
| Spring Actuator Health hint | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 4 |
| Workflow Integration | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 6 |
| Assertion Engine | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 8 |
| Native Desktop Transport | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 7 |
| Load / Stress Testing | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 11 |
| Built-in Mock Server | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 11 |
| Proto Schema Diff | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 11 |
| Demo Hub Lessons | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 12 |
| grpcurl Import/Export | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ Phase 5 |

**Key differentiators vs all competitors:** Workflow integration, assertion engine, native Tauri/tonic transport, grpc-Web support, load testing, proto schema diff, and built-in mock server.

---

## Spring Boot Support

> Researched: 2026-06-28 — covers Spring gRPC 1.1.0 (Spring Boot 4.1.x) and community starters (net.devh) for Spring Boot 2.x / 3.x

Spring Boot is the dominant Java microservice framework. Most enterprise gRPC backends in Java use Spring Boot, either via the new official **Spring gRPC** project or the long-standing **net.devh** community starter. gRPC Studio must handle Spring-specific defaults and behaviors out of the box.

### Spring gRPC ecosystem overview

| Ecosystem | Spring Boot version | Package | Default port | Notes |
|---|---|---|---|---|
| **Spring gRPC 1.0.x / 1.1.x** | 4.1.x (latest) | `org.springframework.grpc:spring-grpc-spring-boot-starter` | **9090** | Official Spring project (GA). Autoconfigures server + client, reflection, health, observability, security. Supports Netty and Servlet modes. |
| **Spring gRPC 0.x (milestone)** | 3.3–3.5.x | `org.springframework.grpc:spring-grpc-spring-boot-starter` (milestones) | **9090** | Pre-GA milestone releases. Large user base from early adopters. Same API as 1.0. |
| **net.devh grpc-spring-boot-starter** | 2.x / 3.x / 4.x | `net.devh:grpc-server-spring-boot-starter`, `net.devh:grpc-client-spring-boot-starter` | **9090** | Most widely used community starter (thousands of production apps). Uses `@GrpcService` / `@GrpcClient` annotations. Predates official Spring gRPC. |
| **LogNet grpc-spring-boot-starter** | 2.x / 3.x | `io.github.lognet:grpc-spring-boot-starter` | **6565** | Older, less active. Some legacy apps still use it. |

### Key Spring-specific behaviors Studio must handle

#### 1. Default port: 9090

All Spring gRPC implementations (official and net.devh) default to port **9090**, not the gRPC canonical 50051. This is the most common source of "why can't I connect?" confusion.

**Studio change (Phase 1):** The connection bar default placeholder should be `localhost:9090` when a "Spring Boot" quick-connect profile is selected, not `localhost:50051`.

#### 2. Two server transport modes (Spring Boot 4.1)

Spring gRPC can run in two distinct modes which require different client approaches:

| Mode | Config | How clients connect | Studio impact |
|---|---|---|---|
| **Netty native** (default) | Default; `spring.grpc.server.port=9090` | Standard gRPC over HTTP/2 — works with all gRPC clients | No change needed |
| **Servlet mode** | `spring-grpc-server-web-spring-boot-starter` dependency; no explicit config needed | HTTP POST to `/<ServiceName>/<MethodName>` — gRPC over HTTP/1.1 inside a servlet container | Needs "Spring Servlet" transport option — same as **gRPC-Web** Phase 10 |

The Servlet mode is essentially gRPC-over-HTTP/1.1. In practice this means users running Spring Boot behind a load balancer that doesn't support HTTP/2 can still expose gRPC services. gRPC Studio's Phase 10 gRPC-Web transport handles this correctly.

**Studio change (Phase 10 / connection bar):** Add a "Spring Servlet Mode" option in the transport selector that sets the HTTP method to POST and the path pattern to `/<service>/<method>`, making it clear to users why this is needed.

#### 3. Server Reflection: v1 preferred (not v1alpha)

Spring gRPC autoconfigures `grpc.reflection.v1.ServerReflection` (v1, not v1alpha) when `io.grpc:grpc-services` is on the classpath. This is already handled by the plan (try v1 → fall back to v1alpha), but note that Spring Boot apps will overwhelmingly respond on v1.

#### 4. Health Check: Spring Actuator integration

Spring gRPC auto-wires its gRPC health service to Spring Actuator health indicators. The health service may expose **named service statuses** beyond just the global `""` status:

```yaml
# application.yml — these become named health check services in grpc.health.v1.Health
spring.grpc.server.health.actuator.health-indicator-paths:
  - db
  - redis
  - diskSpace
```

When checking health from gRPC Studio's Health Check panel:
- The global `""` service name works for all Spring apps
- Service-specific status is available at names like `"db"`, `"redis"`, etc.
- The `Watch` (streaming) call shows real-time status transitions (e.g. db goes DOWN during maintenance)

**Studio change (Phase 4 Health panel):** Add a hint "Spring Boot apps expose Actuator health as named services (e.g. `db`, `redis`). Use the service name field to check a specific indicator." alongside the existing `Watch` button.

#### 5. Spring Security integration (server side)

Spring gRPC uses Spring Security for both Netty and Servlet server modes. The auth patterns relevant to **gRPC Studio** (connecting as a client):

| Auth type | Spring mechanism | Studio support |
|---|---|---|
| **HTTP Basic** | `httpBasic(withDefaults())` — sends `Authorization: Basic …` as gRPC metadata | ✅ Already in Phase 4 (Basic auth) |
| **Bearer JWT** | OAuth2 Resource Server — validates `Authorization: Bearer <jwt>` | ✅ Already in Phase 4 (Bearer) |
| **mTLS preauthentication** | TLS client cert principal matched to `UserDetailsService` | ✅ Already in Phase 4 (mTLS) |
| **OAuth2 opaque token** | Introspection endpoint — `Authorization: Bearer <opaque>` | ✅ Same as Bearer; Studio sends the token, server introspects |
| **Per-method `@PreAuthorize`** | Checked server-side; client gets `PERMISSION_DENIED` (status 7) | ✅ Studio surfaces PERMISSION_DENIED correctly |
| **ALTS (GCP)** | Application Layer Transport Security | 🔲 Not supported (Phase 4 deferred) |

**No new auth types are needed.** The existing Phase 4 auth panel covers all Spring Security scenarios.

**Studio change (Phase 4 Auth panel):** Add a Spring-specific hint for `PERMISSION_DENIED` responses: "If you see status 7 (PERMISSION_DENIED), the server may use Spring `@PreAuthorize`. Check the required role/scope."

#### 6. TLS via Spring SSL Bundles

Spring Boot 4.1 uses **SSL Bundles** (`spring.ssl.bundle.*`) to configure TLS. From the client (Studio) perspective, this is transparent — Studio still connects using standard PEM certificates. The only Spring-specific behavior is that Spring apps may use JKS/PKCS12 keystores internally, but they still present standard TLS certificates on the wire.

**No Studio change needed** — PEM-based TLS in Phase 4 works with any Spring gRPC server.

#### 7. In-process server target format

Spring gRPC supports in-process servers (used in tests): `spring.grpc.server.inprocess.name=<name>`. Clients must connect to `in-process:<name>`.

**Studio change (Phase 1 connection bar):** Accept `in-process:<name>` as a valid target format (useful for local dev/testing with Spring). Add to the target input validation.

#### 8. OkHttp vs Netty channel

Spring gRPC 1.1 supports both `grpc-netty` and `grpc-netty-shaded` and `grpc-okhttp` client implementations. From Studio's perspective this is irrelevant — Studio always uses `@grpc/grpc-js` (Node.js) or `tonic` (Rust) to connect; the Spring server's channel implementation doesn't affect the wire protocol.

### Spring Boot Quick-Connect Profiles

Add these as selectable profiles in the connection bar (Phase 1 enhancement):

| Profile | Target | TLS | Notes |
|---|---|---|---|
| Spring Boot (Netty, local dev) | `localhost:9090` | None | Standard Spring gRPC local |
| Spring Boot (Netty, TLS) | `<host>:9090` | TLS | Production Netty mode |
| Spring Boot (Servlet, HTTP) | `localhost:8080` | None | HTTP/1.1 servlet mode; uses Phase 10 transport |
| net.devh starter (local dev) | `localhost:9090` | None | Same defaults as Spring gRPC |
| LogNet starter (legacy) | `localhost:6565` | None | Legacy apps only |
| Generic gRPC (default) | `localhost:50051` | None | Non-Spring servers |

### Feature matrix update

| Feature | Spring gRPC 1.1 (Boot 4.1) | net.devh starter | Studio coverage |
|---|---|---|---|
| Server Reflection (v1) | ✅ (grpc-services dep required) | ✅ | ✅ Phase 3 |
| Server Reflection (v1alpha) | ✅ (fallback) | ✅ | ✅ Phase 3 |
| Health Check (global) | ✅ | ✅ | ✅ Phase 4 |
| Health Check (Actuator-named) | ✅ Spring gRPC only | ❌ | ✅ Phase 4 (with Spring hint) |
| mTLS | ✅ SSL Bundles | ✅ | ✅ Phase 4 |
| Bearer JWT / OAuth2 Resource Server | ✅ Spring Security | ✅ | ✅ Phase 4 |
| Basic Auth | ✅ Spring Security | ✅ | ✅ Phase 4 |
| Per-method `@PreAuthorize` | ✅ (PERMISSION_DENIED on violation) | ✅ | ✅ Phase 4 (status surfaced) |
| Netty native HTTP/2 | ✅ default | ✅ default | ✅ Phase 1 |
| Servlet mode (HTTP/1.1) | ✅ web starter | ⚠️ custom config | ✅ Phase 10 |
| In-process server | ✅ | ✅ | ✅ Phase 1 (target format) |
| Observability (Micrometer/OTEL) | ✅ auto-configured | ✅ | N/A (server-side) |
| Native Image (GraalVM) | ✅ | ⚠️ | N/A (server-side) |

### Demo lesson for Phase 12

Add **"Lesson 15 — Spring Boot 4.1 + Spring gRPC"** to Phase 12:
- Connect to a Spring Boot server at `localhost:9090`
- Discover services via Server Reflection v1
- Call a `@GrpcService`-annotated endpoint with Bearer JWT authentication
- Check Actuator health for the `db` service using the Health panel
- Show PERMISSION_DENIED response when calling a `@PreAuthorize`-restricted method without a token
- Demonstrate Servlet mode connection at `:8080` using the Phase 10 transport toggle

---

## Design Decisions

### 1. Descriptor source priority: Reflection → Proto Files → Protoset → BSR → URL Proto

gRPC Studio must discover service/method schemas before it can build form inputs or serialize requests. Priority order:

1. **Server Reflection** (gRPC reflection v1 / v1alpha) — works at runtime with no files needed; widely supported by grpc-go, Java, Python etc.
2. **`.proto` source files** — user uploads one or more `.proto` files; Studio resolves imports automatically or via an import-path list
3. **Protoset binary** — pre-compiled `FileDescriptorSet` produced by `protoc --descriptor_set_out`; zero proto toolchain needed at runtime
4. **Buf Schema Registry (BSR)** — pinned module reference for team-managed schemas (token-based access)
5. **URL Proto** — direct URL to a `.proto` file when no repository upload is available

This mirrors how `grpcui` and `grpcurl` work, which developers already understand.

Resolution rule: if a descriptor is already explicitly loaded for the active tab/session, preserve it until the user changes source. Never silently switch source due to transient reflection failures.

### 2. Form-first input with JSON fallback

Every request is surfaced as a **structured form** (one field per proto field, with type-aware widgets):
- Scalars: text inputs with type validation (int32 vs float vs bool)
- Enums: dropdown select
- Repeated fields: `+ Add` / `× Remove` rows
- Nested messages: collapsible sub-form
- `oneof`: radio-button group that shows only the active branch
- Well-known types: special widgets (`google.protobuf.Timestamp` → date-time picker, `google.protobuf.Duration` → duration input, etc.)

A **JSON tab** shows the live JSON-encoded representation of the current form state and allows direct editing. Changes in JSON sync back to the form.

This exactly matches what grpcui pioneered and what Kreya, Postman, and Insomnia all implement.

### 3. Transport architecture: Server-side proxy for web, tonic for desktop

gRPC requires HTTP/2 and binary framing — it cannot run natively in a browser or over a simple Express proxy.

| Mode | Transport | Phase |
|---|---|---|
| **Web (browser)** | Express → `@grpc/grpc-js` proxy, SSE/polling for streaming messages | Phase 1 |
| **Desktop (Tauri)** | Native Rust `tonic` via Tauri commands; event-driven streaming via `tauri::emit` | Phase 7 |

The server-side proxy approach is the same pattern used by Kafka and WebSocket studios. This decouples the UI entirely from gRPC protocol concerns.

### 4. Streaming as a first-class citizen

Unlike grpcui which treats all streaming as "send all messages at once, receive all at once", RedfireForge gRPC Studio treats streaming natively:

- **Server streaming**: live message log (same virtualized log pattern as WebSocket Studio)
- **Client streaming**: compose bar with "Add message to stream" + "End stream (EOF)" action
- **Bidirectional**: both compose bar and live message log, with directional message attribution

### 5. gRPC metadata as a key-value table

gRPC metadata is the equivalent of HTTP headers — arbitrary key-value pairs sent per call. The Studio exposes a `KeyValueEditor` table for metadata (same component as used in HTTP/WebSocket studios) with the ability to save metadata sets to a profile.

Special reserved keys (`content-type`, `grpc-timeout`, `grpc-encoding`, `grpc-accept-encoding`) are shown with subtle labels but are still editable.

### 6. Collections stored locally (not centralized Settings)

gRPC saved requests are per-service-per-environment, not shared infrastructure. The `GrpcCollection` tree mirrors the proto service hierarchy: top-level nodes are services (e.g. `OrderService`), children are methods (e.g. `CreateOrder`). Each leaf holds a saved request body + metadata + TLS config + notes.

### 7. `{{grpcHost}}` environment variable already reserved

The environment-manager-expansion-plan already defines `{{grpcHost}}` as a standard per-environment token of the form `host:port` (no scheme). gRPC Studio will read this variable from the active environment to pre-fill the target address field.

---

## Phase Status Dashboard

| Phase | What It Delivers | Status | Tests |
|---|---|---|---|
| **1** — Core Explorer & Unary | Service/method tree, unary call, form input, response panel, proxy | 🔲 Not started | ~200 |
| **2** — All Streaming Types | Server / client / bidirectional streaming, stream message log | 🔲 Not started | ~150 |
| **3** — Proto Management | Proto file upload, protoset import, reflection, import-path resolver | 🔲 Not started | ~100 |
| **4** — TLS, mTLS & Auth | TLS panel, client cert, OAuth2/Bearer token, per-call auth | 🔲 Not started | ~80 |
| **5** — Collections & History | Save requests, collection tree, recent calls, grpcurl import/export | 🔲 Not started | ~100 |
| **6** — Workflow Integration | `grpcUnary`, `grpcServerStream` workflow nodes; runner handlers; results | 🔲 Not started | ~100 |
| **7** — Tauri Native Transport | Rust `tonic` commands; event streaming; transport selection | 🔲 Not started | ~100 |
| **8** — Test Runner Assertions | gRPC scenarios in harness; `grpcField` assertions; status code checks | 🔲 Not started | ~150 |
| **9** — Env Variable Interpolation | `{{grpcHost}}`, `{{grpcPort}}` resolution from active environment | 🔲 Not started | ~40 |
| **10** — gRPC-Web | grpc-web transport via Envoy-compatible proxy; browser-native calls | 🔲 Not started | ~80 |
| **11** — Advanced Features | Load testing, mock server, proto schema diff | 🔲 Not started | ~120 |
| **12** — Demo Lessons | 15 guided demo lessons in Demo Hub | 🔲 Not started | ~80 |
| **13** — Production Hardening | Performance budgets, resiliency drills, accessibility and release gates | 🔲 Not started | ~70 |

---

## Phase 1 — Core Service Explorer & Unary Calls

> **Goal:** Users can connect to a gRPC server (plain-text or TLS), browse available services and methods via server reflection or uploaded `.proto` files, compose a unary request using the type-aware form, invoke the RPC, and inspect the full response (body, headers, trailers, status code).

> **Spring Boot note:** The connection bar default placeholder should be `localhost:9090` for Spring Boot profiles (see [Spring Boot Support](#spring-boot-support) for Quick-Connect Profiles). Accept `in-process:<name>` as a valid target format for Spring in-process testing servers.

### Server-side proxy architecture

```
Browser/Renderer
   ↓ POST /api/grpc/call   { target, service, method, metadata, body }
Express (src-server)
   ↓ @grpc/grpc-js DynamicClient
gRPC Server (user's service)
   ↓ unary response
Express
   ↓ JSON envelope { status, headers, trailers, body }
Browser/Renderer
```

Streaming messages (Phase 2) follow the same path but use chunked transfer or SSE.

### New server routes (Phase 1)

| Endpoint | Method | Purpose |
|---|---|---|
| `POST /api/grpc/call` | POST | Invoke a unary RPC |
| `DELETE /api/grpc/call/:requestId` | DELETE | Cancel in-flight unary RPC (tab close / user cancel) |
| `POST /api/grpc/reflect` | POST | Fetch service descriptor via server reflection |
| `POST /api/grpc/describe` | POST | Parse proto files/protoset and return descriptor |
| `GET /api/grpc/status` | GET | Health/reachability check for a target address |

All follow `sendEnvelope()` / `createGrpcErrorEnvelope()` patterns matching the Kafka routes.

### UI layout (Phase 1)

```
┌─────────────────────────────────────────────────────────────────┐
│  gRPC Studio                                          [New Tab +]│
├─────────────────────────────────────────────────────────────────┤
│  [Service Explorer]  [Call]  [Collections]  [Settings]         │
├──────────────┬──────────────────────────────────────────────────┤
│ Service Tree │  Target: [{{grpcHost}} or host:port__] [Connect] │
│              │  Method: OrderService / CreateOrder              │
│ ▶ OrderSvc   │  ─────────────────────────────────              │
│   CreateOrder│  [Form] [JSON]  Metadata [+ Add Header]         │
│   GetOrder   │  ┌──────────────────────────────────────────┐   │
│   ListOrders │  │ item_id   [string]  [_________________]  │   │
│ ▶ UserSvc    │  │ quantity  [int32]   [_________________]  │   │
│   ...        │  │ options   [message] ▶ [expand]           │   │
│              │  └──────────────────────────────────────────┘   │
│              │  [Send Unary]              gRPC status: —       │
│              │  ─────────────────────────────────────          │
│              │  Response (headers / body / trailers)           │
│              │  [OK 0] [12ms]                                   │
│              │  { "order_id": "abc123", "status": "PENDING" }  │
│              │  Trailers: grpc-status=0                        │
└──────────────┴──────────────────────────────────────────────────┘
```

### Tab-scoped connection and execution contract (Phase 1)

To avoid cross-tab bugs, Phase 1 must follow GraphQL's tab-scoped model:

- Each tab owns its own target, method, request body, metadata, and timeout.
- `Execute` always uses an immutable snapshot of the **active tab** at click time.
- Switching tabs during an in-flight call must not mutate the running request.
- Response state is keyed by `tabId` (status, body, headers, trailers, duration).
- Closing a tab cancels in-flight unary request for that tab and clears tab-local transient state.
- Tab duplication copies request/config state by value (new `tabId`, same initial payload).

Suggested parity utility (same spirit as GraphQL `resolveTabConnection`):

- `resolveGrpcTabConnection(tab, profiles, pageDefaults)`
- precedence: `tab override -> linked profile -> page default`

### Request shape (Phase 1)

```ts
// POST /api/grpc/call
interface GrpcCallRequest {
  callType: 'unary';
  requestId: string;        // client-generated UUID; used for cancellation and correlation
  target: GrpcTarget;       // { address: "host:port", tlsMode, tlsConfig? }
  service: string;          // "com.example.OrderService"
  method: string;           // "CreateOrder"
  body: Record<string, unknown>;    // JSON-encoded proto message
  metadata?: Record<string, string>; // keys normalized lowercase; *-bin values are base64
  auth?: GrpcAuthConfig;
  timeoutMs?: number;       // default 30000
  descriptorKey: string;    // required: descriptor resolved by reflect/describe first
}

// Response envelope
interface GrpcCallResult {
  callType: 'unary';
  status: number;           // gRPC status code (0 = OK)
  statusMessage: string;    // e.g. "OK", "NOT_FOUND"
  headers: Record<string, string>;
  trailers: Record<string, string>;
  body: Record<string, unknown>;
  durationMs: number;
}
```

### What gets built

- `GrpcStudioPage.tsx` — top-level page, tab management
- `GrpcServiceExplorer.tsx` — left panel, service/method tree from descriptors
- `GrpcCallPanel.tsx` — right panel, target input + form + send button + response
- `GrpcProtoFormBuilder.tsx` — recursive form renderer from field descriptors
- `GrpcResponsePanel.tsx` — status badge, headers, body (JSON pretty-print), trailers
- `useGrpcStudio.ts` — primary hook (target, descriptors, selected method, call state)
- `src-server/routes/grpc/grpc-routes.ts` — Express route handlers
- `src-server/grpc/grpcClient.ts` — `@grpc/grpc-js` dynamic client wrapper
- `src-server/grpc/descriptorLoader.ts` — reflection + proto + protoset descriptor resolution
- `docker/grpc/` — test gRPC server for E2E (Go with server reflection enabled)

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 1A — Contracts and scaffolding

Scope:
- Finalize request/response contracts for unary call + reflection/describe/status routes.
- Define tab-local state shape and request lifecycle states (`idle`, `connecting`, `calling`, `success`, `error`, `cancelled`).

Deliverables:
- Contract definitions aligned with `GrpcCallRequest` / `GrpcCallResult`.
- Error taxonomy for Phase 1 routes (`validation`, `unreachable`, `reflection_failed`, `call_failed`, `cancelled`).

Verification gates:
- Type-level contract checks compile cleanly.
- Contract examples for happy path + failure path added to docs/tests.

Exit criteria:
- No unresolved API shape ambiguity for `/api/grpc/status`, `/api/grpc/reflect`, `/api/grpc/describe`, `/api/grpc/call`.

#### Phase 1B — Backend unary route path

Scope:
- Implement backend route skeletons and envelope wiring for status/reflect/describe/call/cancel.
- Integrate request correlation (`requestId`) and tab-safe cancellation handling.

Deliverables:
- Route handlers in `src-server/routes/grpc/grpc-routes.ts`.
- gRPC client wrapper methods for unary invocation and cancellation.

Verification gates:
- Unit tests for route validation and error envelopes.
- Integration tests for successful unary call + cancelled unary call.

Exit criteria:
- Unary call can be invoked and cancelled deterministically via API only (no UI dependency).

#### Phase 1C — Descriptor resolution pipeline

Scope:
- Implement reflection-first descriptor discovery and explicit describe endpoint for uploaded sources.
- Normalize descriptor model for service/method/form rendering.

Deliverables:
- Descriptor loader orchestration in `src-server/grpc/descriptorLoader.ts`.
- Stable descriptor key generation for Phase 1 request usage.

Verification gates:
- Tests for reflection success/failure fallback behavior.
- Tests for descriptor normalization consistency across sources.

Exit criteria:
- Same service/method signature is produced regardless of source mode used in Phase 1.

#### Phase 1D — Studio shell and tab state

Scope:
- Build page shell, tab creation/close/duplicate behavior, and per-tab state isolation.
- Add target input validation (`host:port`, `in-process:<name>`).

Deliverables:
- `GrpcStudioPage.tsx` with tab-scoped state model.
- Core hook skeleton in `useGrpcStudio.ts` with immutable execute snapshot behavior.

Verification gates:
- UI tests for tab isolation, tab duplication by value, and tab-close cleanup.
- Validation tests for accepted/rejected target formats.

Exit criteria:
- Cross-tab mutation is impossible for target/method/body/response state.

#### Phase 1E — Service explorer and method binding

Scope:
- Render descriptor-backed service tree and bind method selection into active tab context.
- Handle large service sets with stable selection + filtering behavior.

Deliverables:
- `GrpcServiceExplorer.tsx` and method-selection wiring.
- Method metadata display (call type, request type, response type) for unary-ready methods.

Verification gates:
- UI tests for service/method selection persistence per tab.
- Snapshot tests for explorer rendering on representative descriptor fixtures.

Exit criteria:
- Selecting a method always binds request schema + endpoint context in the active tab only.

#### Phase 1F — Request composer and metadata editor

Scope:
- Build form/json input toggle with proto-aware request editing.
- Add metadata editor with key normalization and `-bin` handling hints.

Deliverables:
- `GrpcProtoFormBuilder.tsx` basic unary-compatible rendering.
- `GrpcCallPanel.tsx` request composer, timeout input, metadata editor.

Verification gates:
- Tests for form/json parity on equivalent payloads.
- Tests for metadata normalization and invalid metadata rejection.

Exit criteria:
- User can author a valid unary request payload from form or JSON without schema drift.

#### Phase 1G — Unary execution UX and response rendering

Scope:
- Wire send/cancel actions from UI to backend call/cancel routes.
- Render status, headers, body, trailers, and timing with deterministic lifecycle transitions.

Deliverables:
- `GrpcResponsePanel.tsx` for result rendering.
- Execute/cancel flow in `useGrpcStudio.ts` keyed by `tabId` and `requestId`.

Verification gates:
- Integration tests for success, deadline exceeded, unreachable target, and manual cancel.
- UI tests for in-flight lock states and post-call state restoration.

Exit criteria:
- Unary call lifecycle is fully observable and cancellable from UI without race conditions.

#### Phase 1H — Hardening gates before Phase 2

Scope:
- Final Phase 1 reliability checks, fixture-backed E2E, and docs alignment.
- Ensure Phase 2 streaming can reuse the same tab/request ownership primitives.

Deliverables:
- E2E scenarios for connect → reflect → unary call → cancel.
- Phase 1 runbook notes for local test server setup and troubleshooting.

Verification gates:
- CI green on unit + integration + E2E subset tagged for Phase 1.
- No open P0/P1 defects tied to unary flow or tab isolation.

Exit criteria:
- Phase 1 acceptance checklist fully satisfied and signed off for Phase 2 handoff.

### Phase 1 execution order and dependency chain

`1A -> 1B -> 1C -> 1D -> 1E -> 1F -> 1G -> 1H`

Notes:
- `1B` and `1C` can partially overlap after contracts stabilize in `1A`.
- `1D` can begin once route contracts are frozen, but should not wire final execute flow until `1B` is stable.
- `1H` is a strict gate; Phase 2 should not start until `1H` exit criteria pass.

### Phase 1 acceptance checklist

- Unary execution is tab-scoped and uses immutable active-tab snapshot at click time.
- Route contract (`/api/grpc/reflect`, `/api/grpc/describe`, `/api/grpc/call`) is implemented with correlation-safe request IDs.
- Connection target validation accepts `host:port` and `in-process:<name>` formats.
- Response panel consistently renders status, headers, trailers, and body with duration.
- Closing a tab cancels in-flight unary request and does not leak state to other tabs.

---

## Phase 2 — Streaming (Server / Client / Bidirectional)

> **Goal:** All four gRPC call types supported with appropriate UI for each.

### Call type UX mapping

| Call Type | Input | Output |
|---|---|---|
| Unary | Single form send | Single response |
| Server Streaming | Single send | Live message log (auto-scroll) |
| Client Streaming | Multiple sends + "End Stream (EOF)" button | Response on stream close |
| Bidirectional | Multiple sends + EOF | Live message log with send/receive attribution |

### Streaming server route

```
POST /api/grpc/stream/start   → returns streamId
GET  /api/grpc/stream/:id/events  → SSE stream of { type, data, metadata }
POST /api/grpc/stream/:id/send    → send message to client/bidi stream
POST /api/grpc/stream/:id/end     → send EOF (client/bidi)
DELETE /api/grpc/stream/:id       → cancel stream
```

Server-streaming messages are emitted as SSE `event: grpc-message` with JSON body. Status/trailers emitted as `event: grpc-end`.

### Tab-scoped stream ownership contract (Phase 2)

To keep parity with GraphQL/Kafka tab behavior and avoid cross-tab leaks:

- Each stream session is owned by exactly one `tabId` + one `requestId`.
- `POST /api/grpc/stream/start` is created from an immutable active-tab snapshot (same rule as Phase 1 unary).
- `send`, `end`, `events`, and `cancel` operations must verify ownership (`streamId` belongs to caller tab/session).
- Closing a tab auto-calls `DELETE /api/grpc/stream/:id` for all active streams of that tab.
- Stream registry cleanup occurs on: grpc-end, explicit cancel, SSE disconnect timeout, or tab close.
- `DELETE /api/grpc/stream/:id` is idempotent and returns success if stream already ended/cleaned.

Suggested registry shape:

```ts
Map<streamId, {
  tabId: string;
  requestId: string;
  callType: 'server_streaming' | 'client_streaming' | 'bidi_streaming';
  startedAt: number;
  status: 'active' | 'ended' | 'cancelled' | 'error';
  lastActivityAt: number;
}>;
```

### Stream start and event contracts (Phase 2)

```ts
interface GrpcStreamStartRequest extends GrpcCallRequest {
  callType: 'server_streaming' | 'client_streaming' | 'bidi_streaming';
  tabId: string;
}

interface GrpcStreamStartResponse {
  streamId: string;
  requestId: string;
  tabId: string;
}

interface GrpcStreamEvent {
  type: 'grpc-message' | 'grpc-end' | 'grpc-error' | 'grpc-heartbeat';
  streamId: string;
  requestId: string;
  tabId: string;
  sequence: number;
  timestamp: string;
  direction?: 'inbound' | 'outbound'; // message rows: server/client attribution
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  trailers?: Record<string, string>;
  status?: number;
  statusMessage?: string;
}
```

Notes:

- SSE should include periodic `grpc-heartbeat` to detect dead connections.
- UI should dedupe/reorder defensively using `sequence` for reconnect scenarios.
- `POST /api/grpc/stream/:id/end` is only valid for `client_streaming` and `bidi_streaming`; return `409` for `server_streaming`.

### Message log UI

- Same virtualized rendering pattern as WebSocket Studio (`@tanstack/react-virtual`)
- Message rows: `↓` = server message, `↑` = client message
- Timestamp, sequence number, JSON body (expandable)
- Stream status bar: active / ended / cancelled / error
- "End Stream" button (client/bidi only, disabled for server-streaming)
- Cap: 10,000 messages (configurable)

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 2A — Streaming contracts and state model

Scope:
- Finalize API/state contracts for stream start/events/send/end/cancel.
- Define canonical stream lifecycle and terminal-state precedence.

Deliverables:
- Contract definitions for `GrpcStreamStartRequest`, `GrpcStreamEvent`, and stream control routes.
- Stream state machine (`idle -> starting -> active -> ending -> ended|cancelled|error`).

Verification gates:
- Type-level contract validation in shared/server boundaries.
- State transition table documented with invalid-transition handling.

Exit criteria:
- No ambiguity in how each call type (`server_streaming`, `client_streaming`, `bidi_streaming`) transitions and terminates.

#### Phase 2B — Stream registry and ownership enforcement

Scope:
- Implement stream registry keyed by `streamId` with `tabId`/`requestId` ownership metadata.
- Enforce ownership checks on `events`, `send`, `end`, and `cancel` operations.

Deliverables:
- Registry manager utility with cleanup hooks and idempotent remove.
- Ownership guard middleware/helper for all stream-control endpoints.

Verification gates:
- Unit tests for ownership rejection and idempotent cancel/delete behavior.
- Leak tests for stale stream cleanup on timeout/disconnect/tab close.

Exit criteria:
- Cross-tab stream access is impossible and stream cleanup is deterministic.

#### Phase 2C — Backend start/events path (SSE)

Scope:
- Build `stream/start` and `stream/:id/events` route behavior with SSE channel lifecycle.
- Add heartbeats and sequence numbers for reconnect-safe rendering.

Deliverables:
- SSE emitter with event serialization, heartbeat scheduler, and safe close handling.
- Consistent event envelope including `sequence`, `timestamp`, `tabId`, `requestId`.

Verification gates:
- Integration tests for start->message->end ordering.
- Reconnect simulation tests validating dedupe/reorder support via `sequence`.

Exit criteria:
- SSE stream remains stable over long-lived sessions and reconnect scenarios.

#### Phase 2D — Backend send/end/cancel semantics

Scope:
- Implement call-type-aware `send`, `end`, `cancel` route semantics.
- Enforce protocol guards (`end` invalid for server-streaming).

Deliverables:
- Route handlers for send/end/delete with explicit status code mapping.
- Error mapping for invalid operation (`409`), unknown stream (`404`), ownership violation (`403`).

Verification gates:
- Integration tests for each call type + invalid operations.
- Idempotency tests for repeated end/cancel calls.

Exit criteria:
- Control routes are deterministic and safe under retries/user double-clicks.

#### Phase 2E — Client transport adapter and reconnection policy

Scope:
- Implement browser-side stream client adapter (start SSE, process events, reconnect policy).
- Define reconnect backoff and stop conditions for terminal states.

Deliverables:
- Hook-level transport module in streaming path (`useGrpcStream` integration).
- Event buffer policy with sequence-aware dedupe and gap handling.

Verification gates:
- Unit tests for reconnect backoff and terminal-state stop logic.
- Tests for duplicate/delayed event handling.

Exit criteria:
- Client-side stream adapter handles transient network interruptions without corrupting message log.

#### Phase 2F — Stream message log UI and UX controls

Scope:
- Build streaming message log with virtualization, status bar, and controls.
- Support direction labels, timestamping, expand/collapse JSON, and message cap policy.

Deliverables:
- `GrpcStreamMessageLog.tsx` with virtualized rows and status badges.
- Stream action controls in call panel (`Send`, `End Stream`, `Cancel`).

Verification gates:
- UI tests for render correctness at high message volume.
- Interaction tests for control enable/disable by call type and state.

Exit criteria:
- UI remains responsive and accurately reflects stream state under heavy traffic.

#### Phase 2G — Tab lifecycle integration

Scope:
- Ensure stream behavior is tab-scoped during tab switch/duplicate/close.
- Guarantee auto-cancel/cleanup when tab closes.

Deliverables:
- Tab lifecycle hooks wired to stream registry cleanup and UI state reset.
- Stream restoration rules for tab revisit during active stream.

Verification gates:
- UI integration tests for tab switch/close while stream active.
- Regression tests preventing cross-tab message bleed.

Exit criteria:
- Active streams and logs remain perfectly isolated by tab.

#### Phase 2H — Test harness and fixture expansion (streaming)

Scope:
- Extend docker fixture methods and test data for server/client/bidi flows.
- Add automated test matrix for success/error/cancel/timeouts per call type.

Deliverables:
- Expanded gRPC fixture coverage in `docker/grpc/` for deterministic stream scenarios.
- Integration/E2E test suites tagged for Phase 2 streaming.

Verification gates:
- CI subset for streaming path is stable and non-flaky across repeated runs.
- Deterministic test results for message order and terminal statuses.

Exit criteria:
- Streaming functionality is reproducibly testable before Phase 3 work begins.

#### Phase 2I — Hardening gate before Phase 3

Scope:
- Final reliability pass on long-running streams, cancellation races, and reconnect edge cases.
- Confirm docs and acceptance checklist align with observed runtime behavior.

Deliverables:
- Known-limits note for max messages/heartbeat interval/backoff defaults.
- Phase 2 release note summary + risk log updates.

Verification gates:
- No open P0/P1 defects in stream ownership, ordering, or cancellation.
- Phase 2 acceptance checklist fully green in CI + manual smoke.

Exit criteria:
- Phase 2 is signed off and safe to hand over to Phase 3 descriptor-heavy work.

### Phase 2 execution order and dependency chain

`2A -> 2B -> 2C -> 2D -> 2E -> 2F -> 2G -> 2H -> 2I`

Notes:
- `2B` and `2C` can overlap after `2A` contracts freeze.
- `2E` should start once SSE event envelope in `2C` is stable.
- `2F` can begin with mock data before backend completion, but final wiring waits for `2C/2D/2E`.
- `2I` is a strict gate before Phase 3 starts.

### Phase 2 acceptance checklist

- Tab A stream traffic never appears in Tab B message log.
- Switching tabs during active stream does not change stream target/method/body in flight.
- Tab close cancels all active streams for that tab within one cleanup cycle.
- Repeated cancel/end calls do not throw and produce stable final status.
- SSE disconnect/reconnect does not duplicate already-rendered messages.
- Server-streaming method cannot call `end`; client/bidi can.

---

## Phase 3 — Proto Management & Schema Registry

> **Goal:** Users can manage proto source files, import protosets, and use Buf Schema Registry, with full import-path resolution.

### Descriptor sources

| Source | How to add | When to use |
|---|---|---|
| **Server Reflection** | Auto-detected on connect | Development servers with reflection enabled |
| **Proto Files** | File picker or drag-and-drop `.proto` files | Any proto-based service |
| **Protoset File** | Upload `.pb` binary descriptor | CI/CD pipelines, offline use |
| **Buf Schema Registry (BSR)** | URL + token | Teams using Buf.build for proto management |
| **URL to proto** | HTTP URL returning a `.proto` file | Publicly hosted schemas |

### Import path resolver

Proto files often `import "google/protobuf/timestamp.proto"` or other dependencies. The Studio:
1. Bundles all Google Well-Known Types (WKT) internally
2. Accepts a list of additional import root directories when uploading protos
3. Auto-resolves common googleapis (`google.api.*`) protos from bundled cache

### URL/BSR fetch and cache safety

- URL-to-proto and BSR fetches must run server-side only (never direct browser fetch for private sources).
- Validate URL scheme (`https` by default; `http` allowed only for localhost/dev override).
- Block loopback/private-network SSRF by default except explicit localhost allowlist entries.
- Cache descriptor bundles by content hash (sha256 of normalized descriptor bytes), not only by source label.
- Cache identity should include source fingerprint (for example, BSR module+digest or URL+etag/last-modified) to avoid stale descriptor reuse.
- On cache miss/fetch error, preserve the last known-good descriptor for that tab and surface a non-destructive warning.

### Schema Registry browser

A dedicated sub-tab shows all loaded services, with:
- Package hierarchy tree
- Message type list (all message types in scope, not just top-level request/response)
- Field-level documentation from proto comments
- Enum values
- Service method signatures (`rpc Foo(Bar) returns (stream Baz)`)
- "Copy as grpcurl" shortcut

### Descriptor source selection and drift contract

- Active descriptor source is tab-scoped; switching source in Tab A must not mutate Tab B.
- Source priority default remains: `reflection -> proto_files -> protoset -> bsr -> url_proto`, but user explicit selection overrides auto-priority.
- Descriptor refresh is atomic per tab: either full replacement succeeds or previous descriptor remains active.
- If active method no longer exists after refresh, keep request draft but move tab into `schema_drift` warning state with guided rebind actions.
- Descriptor identity for call execution must include both `descriptorKey` and source fingerprint to prevent mixed-cache execution.

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 3A — Descriptor contracts and source policy

Scope:
- Freeze contracts for descriptor source metadata, source fingerprints, and tab-scoped selection state.
- Define deterministic source-selection precedence and explicit override behavior.

Deliverables:
- Final source-policy contract (`auto` vs `manual` selection modes).
- Error taxonomy for descriptor phase (`source_unavailable`, `import_resolution_failed`, `schema_drift`, `cache_stale`).

Verification gates:
- Contract compile checks across UI/server/shared types.
- Decision table for source conflict and fallback scenarios.

Exit criteria:
- No ambiguity in how Studio chooses or switches descriptor sources.

#### Phase 3B — Proto/protoset ingest pipeline

Scope:
- Build upload/parse flow for `.proto` trees and `.pb` protoset files.
- Normalize output into one canonical descriptor model.

Deliverables:
- Parser adapters for proto sources and protoset sources.
- Canonical descriptor normalization module.

Verification gates:
- Unit tests on mixed proto trees, repeated imports, and malformed protoset inputs.
- Cross-source equivalence tests for same schema represented via proto vs protoset.

Exit criteria:
- Proto and protoset ingestion produce stable, equivalent service/method trees.

#### Phase 3C — Import-path and dependency resolution

Scope:
- Implement import root handling, WKT bundling, and googleapis fallback resolution.
- Define deterministic error reporting for unresolved imports.

Deliverables:
- Import resolver engine with ordered search paths.
- Diagnostics payload for unresolved import graph nodes.

Verification gates:
- Tests for transitive import resolution across nested trees.
- Tests verifying WKT and common `google.api.*` imports resolve without user hacks.

Exit criteria:
- Uploading split proto repos resolves deterministically with actionable errors on failures.

#### Phase 3D — Reflection integration and fallback policy

Scope:
- Harden reflection fetch path (v1 first, v1alpha fallback).
- Prevent reflection failures from breaking active tab request context.

Deliverables:
- Reflection client path with fallback and structured diagnostics.
- Non-destructive refresh behavior in tab state.

Verification gates:
- Integration tests for v1 success, v1 failure->v1alpha success, and both-fail path.
- State-preservation tests for active method/request drafts.

Exit criteria:
- Reflection fallback works reliably without mutating active request state unexpectedly.

#### Phase 3E — BSR and URL fetch security path

Scope:
- Implement server-side fetch only for URL/BSR sources with SSRF controls and scheme policy.
- Add source fingerprint extraction (`etag`, digest, module ref) for cache safety.

Deliverables:
- Fetch gateway with host/scheme allow/deny enforcement.
- Source fingerprint model for URL and BSR.

Verification gates:
- Security tests for blocked private-network targets and disallowed schemes.
- Fetch tests for fingerprint-based stale-detection behavior.

Exit criteria:
- URL/BSR descriptor loading is secure by default and cache-safe.

#### Phase 3F — Descriptor cache and invalidation semantics

Scope:
- Implement content-hash keyed descriptor cache with source fingerprint augmentation.
- Ensure atomic swap and rollback-to-last-known-good behavior per tab.

Deliverables:
- Cache manager (`put/get/invalidate`) with hash+fingerprint identity.
- Atomic refresh transaction semantics for descriptor replacement.

Verification gates:
- Tests for cache hit/miss and proper invalidation on source change.
- Tests confirming failed refresh keeps prior descriptor active.

Exit criteria:
- Descriptor cache never serves stale/mismatched schema for active execution context.

#### Phase 3G — Schema browser UI and introspection ergonomics

Scope:
- Build schema registry sub-tab with package tree, types, enums, and method signatures.
- Add fast navigation/search and `Copy as grpcurl` affordance.

Deliverables:
- Registry browser components and descriptor-driven rendering hooks.
- Selection synchronization with service explorer.

Verification gates:
- UI tests for large descriptor sets and deep package hierarchies.
- Interaction tests for signature/details rendering and copy action behavior.

Exit criteria:
- Users can inspect and navigate full schema graph without leaving Studio context.

#### Phase 3H — Schema drift handling and active-tab continuity

Scope:
- Define/implement UI behavior when descriptor updates rename/remove active methods/fields.
- Preserve user drafts while guiding safe remap.

Deliverables:
- `schema_drift` warning state with rebind actions.
- Draft-preservation and remap helpers.

Verification gates:
- Tests for method removed/renamed and field removed/type-changed scenarios.
- UX tests confirming non-destructive warning flow.

Exit criteria:
- Descriptor refresh never causes silent request corruption or data loss.

#### Phase 3I — Hardening gate before Phase 4

Scope:
- Run full Phase 3 regression suite and security checks before TLS/Auth work.
- Validate docs and acceptance checklist traceability.

Deliverables:
- Phase 3 test matrix report (all descriptor sources + drift/fallback/security cases).
- Operational notes for descriptor source troubleshooting.

Verification gates:
- No open P0/P1 issues in descriptor ingestion, cache correctness, or source security.
- CI green for Phase 3 tagged unit/integration/E2E tests.

Exit criteria:
- Phase 3 is signed off with stable descriptor behavior ready for Phase 4 integration.

### Phase 3 execution order and dependency chain

`3A -> 3B -> 3C -> 3D -> 3E -> 3F -> 3G -> 3H -> 3I`

Notes:
- `3B` and `3D` can proceed in parallel once contracts in `3A` are frozen.
- `3E` and `3F` should overlap early to avoid insecure/stale cache behavior.
- `3H` must run after `3G` and `3F` are stable.
- `3I` is a strict gate before Phase 4 starts.

### Phase 3 acceptance checklist

- Uploading split proto trees with transitive imports resolves without manual reordering.
- Reflection v1 failure correctly falls back to v1alpha without changing active request state.
- Protoset, BSR, and URL descriptor sources all produce compatible service/method trees.
- Reloading unchanged source reuses cache; changed source invalidates cache via content hash.
- URL fetch policy blocks disallowed hosts/schemes and reports actionable error text.
- Existing active method selection remains stable after descriptor refresh when the method still exists.

---

## Phase 4 — TLS, mTLS & Auth

> **Goal:** Full TLS and authentication support parity with other studios.

> **Spring Boot note:** Spring gRPC uses Spring SSL Bundles (JKS/PKCS12) internally, but presents standard PEM certificates on the wire — no Studio changes needed for TLS. For auth, all Spring Security patterns (Basic, Bearer JWT, mTLS preauthentication, OAuth2 opaque tokens) are covered by the existing auth panel. Add a hint in the Health panel that Spring Actuator-backed health services expose named services (`"db"`, `"redis"` etc.) beyond the default `""`. Add a `PERMISSION_DENIED` response hint referencing Spring `@PreAuthorize`.

### TLS panel (per-target config)

| Setting | Description |
|---|---|
| TLS mode | `disabled` (plain-text) / `tls` / `mtls` |
| Server CA | PEM — override system roots or accept self-signed certs |
| Client cert | PEM — presented when server requires mTLS |
| Client key | PEM — private key for client cert |
| Server name override | SNI override for non-matching hostnames |

PEM values stored in `grpc_tls_certs_v1` local storage key (same pattern as GraphQL Studio TLS).

### Auth panel (per-request)

| Auth Type | Implementation | Spring Security mapping |
|---|---|---|
| None | — | — |
| Bearer Token | `Authorization: Bearer <token>` in metadata | OAuth2 Resource Server (JWT or opaque) |
| Basic | `Authorization: Basic base64(user:pass)` in metadata | `httpBasic(withDefaults())` |
| API Key (metadata) | `<custom-key>: <value>` in metadata | Custom server interceptor |
| OAuth2 (client credentials) | Token fetch + inject; token refresh handled by server-side helper | `spring.security.oauth2.authorizationserver.client.*` |
| gRPC `ALTS` | Enterprise (Phase 4 deferred; GCP-internal transport) | Not mapped to Spring Security auth mechanisms |

Auth config stored per saved connection profile.

### TLS/Auth validation and normalization rules

- `mtls` mode requires both `clientCertPem` and `clientKeyPem`; missing either must fail fast before network call.
- `serverNameOverride` is applied only in `tls`/`mtls` mode.
- TLS failures should be surfaced with category hints: unknown CA, hostname mismatch, expired cert, handshake timeout.
- Metadata keys are normalized to lowercase for wire transmission.
- Metadata keys ending in `-bin` are treated as base64-encoded binary values.
- If Auth panel provides `Authorization`, it becomes the canonical value and overrides conflicting manual `authorization` metadata.

### Secret handling requirements (Phase 4)

- Never persist secrets into call history, exports, runner artifacts, or toast/error text.
- Secret fields: `bearerToken`, `basicPassword`, `apiKeyValue`, `oauth2.clientSecret`, raw PEM/key values.
- Browser mode defaults to in-memory secrets for current session.
- Desktop mode should prefer OS keychain/secure credential storage for persisted secrets.
- Provide explicit "clear secret" actions in auth/tls profile UI.

### Health Check panel — Spring Actuator hint

When the gRPC server returns `NOT_SERVING` or health call fails:
- Standard empty service name `""` = overall server health
- **Spring-specific named services**: add a tooltip/hint — *"Spring Boot apps expose Actuator health as named gRPC health services (e.g. `db`, `redis`, `diskSpace`). Enter the indicator name to check a specific component."*

### PERMISSION_DENIED response hint

When gRPC Studio receives status code **7 (PERMISSION_DENIED)**:
- Show a dismissible info card: *"Status 7 PERMISSION_DENIED — if this is a Spring Boot server, the endpoint may be protected by `@PreAuthorize`. Check the required role or scope and ensure your Bearer token includes it."*

### Auth/secret trust-boundary contract

- Browser renderer must never directly fetch OAuth2 tokens from third-party token endpoints; token fetch occurs server-side only.
- Secrets are write-only from UI perspective when possible (mask on edit, never rehydrate raw secret text into logs/toasts).
- TLS/auth resolution used at execution time is snapshotted with the request; changing auth panel mid-flight does not affect active call.
- Redaction policy is centralized and reused by Studio, History, Workflow, Harness, exports, and diagnostics.
- Error envelopes must include actionable category + safe message, but never raw secret material or PEM payload fragments.

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 4A — Security contracts and threat model freeze

Scope:
- Finalize TLS/auth contracts, secret classes, and redaction guarantees.
- Define threat model for browser mode and desktop mode secret handling.

Deliverables:
- Contract docs for auth precedence, validation failures, and secret masking.
- Threat-model checklist covering token leaks, PEM leaks, and unsafe error surfaces.

Verification gates:
- Contract review with explicit negative cases (invalid certs, conflicting auth headers, malformed metadata).
- Redaction test vectors agreed across all consumers.

Exit criteria:
- No unresolved ambiguity on what is secret, where it can live, and how it is redacted.

#### Phase 4B — TLS config model and validation engine

Scope:
- Implement strict TLS/mTLS local validation before network calls.
- Normalize TLS settings for transport layer consumption.

Deliverables:
- TLS validation module (`disabled`/`tls`/`mtls` rules).
- Canonical TLS config normalization output.

Verification gates:
- Unit tests for missing cert/key, invalid PEM shape, and mode-specific constraints.
- Validation tests for `serverNameOverride` applicability only in tls/mtls.

Exit criteria:
- Invalid TLS configurations are blocked locally with deterministic, actionable feedback.

#### Phase 4C — Auth model, precedence, and metadata normalization

Scope:
- Implement auth-panel to metadata merge policy with deterministic precedence.
- Enforce metadata normalization (`lowercase`, `-bin` handling).

Deliverables:
- Auth resolution helper producing canonical request metadata.
- Conflict-resolution rules for `Authorization` header ownership.

Verification gates:
- Unit tests for Bearer/Basic/API Key/OAuth2 merge behavior.
- Binary metadata tests for base64 acceptance/rejection paths.

Exit criteria:
- Auth output is deterministic regardless of input ordering or duplicate entries.

#### Phase 4D — OAuth2 token acquisition and lifecycle path

Scope:
- Implement server-side client-credentials flow for token acquisition and refresh boundaries.
- Define token cache TTL/refresh behavior without exposing secrets client-side.

Deliverables:
- Server token helper and secure token injection path.
- Token error mapping (`invalid_client`, `invalid_scope`, endpoint unreachable, timeout).

Verification gates:
- Integration tests with mock authorization server for success/expiry/failure flows.
- Security tests ensuring token/client secret never appears in UI logs/errors.

Exit criteria:
- OAuth2 auth mode works end-to-end with secure server-side token handling only.

#### Phase 4E — Secret storage and redaction plumbing

Scope:
- Implement storage strategy split: browser in-memory by default, desktop secure storage preference.
- Wire centralized redaction across persistence/export/telemetry surfaces.

Deliverables:
- Secret vault adapter abstraction (memory + desktop secure backend).
- Shared redaction utility consumed by history/workflow/harness/export paths.

Verification gates:
- Tests proving secret fields are absent from persisted artifacts and diagnostics.
- Regression scans for accidental secret leakage in serialized objects.

Exit criteria:
- Secret data cannot leak through standard product surfaces.

#### Phase 4F — TLS/auth transport integration and error taxonomy

Scope:
- Integrate normalized TLS/auth config into unary and (future) streaming transport paths.
- Map low-level transport failures to user-facing categories.

Deliverables:
- Transport adapter integration for TLS/auth settings.
- Error categorization map: unknown CA, hostname mismatch, expired cert, handshake timeout, auth denied.

Verification gates:
- Integration tests against fixture servers for each TLS/auth failure class.
- Envelope tests confirming safe-message formatting and category stability.

Exit criteria:
- Runtime errors are categorized, understandable, and free of secret data.

#### Phase 4G — UI flows and hints (Health + PERMISSION_DENIED)

Scope:
- Implement TLS/Auth panel UX states, clear-secret actions, and validation messages.
- Add Spring-specific Health and status-7 hint behaviors.

Deliverables:
- UI components/states for TLS/Auth edit, mask/clear, and validation feedback.
- Dismissible Spring hint cards for health and permission-denied scenarios.

Verification gates:
- UI tests for visibility rules, dismissibility, and non-intrusive hint behavior.
- Accessibility checks for masked fields, tooltips, and keyboard flows.

Exit criteria:
- Users can configure TLS/auth safely with clear guidance and no noisy false hints.

#### Phase 4H — Cross-feature integration checks

Scope:
- Verify Phase 4 rules hold when requests are saved/replayed and used in workflow/harness.
- Ensure auth/tls config round-trips safely through import/export where supported.

Deliverables:
- Integration matrix spanning Studio, Collections (Phase 5), Workflow (Phase 6), Harness (Phase 8).
- Compatibility notes for grpcurl import/export mappings.

Verification gates:
- Scenario tests for saved request replay + environment interpolation + auth precedence.
- Tests proving redaction survives cross-feature boundaries.

Exit criteria:
- Phase 4 behavior remains correct when composed with adjacent phases.

#### Phase 4I — Hardening gate before Phase 5

Scope:
- Final security/reliability pass and release-readiness checks for TLS/auth.
- Confirm acceptance checklist traceability to automated/manual tests.

Deliverables:
- Phase 4 security validation report and defect triage summary.
- Updated runbook for TLS/auth troubleshooting and safe defaults.

Verification gates:
- No open P0/P1 security or data-leak issues.
- CI green for Phase 4 unit/integration/E2E security-tagged tests.

Exit criteria:
- Phase 4 is signed off with secure defaults and deterministic behavior before Phase 5 work.

### Phase 4 execution order and dependency chain

`4A -> 4B -> 4C -> 4D -> 4E -> 4F -> 4G -> 4H -> 4I`

Notes:
- `4B` and `4C` can overlap after `4A` contract freeze.
- `4D` should start once auth precedence from `4C` is stable.
- `4E` should begin early and be reused by `4F/4H` to prevent retrofit leaks.
- `4I` is a strict gate before Phase 5 starts.

### Phase 4 acceptance checklist

- `mtls` without cert or key is blocked locally with actionable validation.
- TLS hostname mismatch and unknown-CA paths show distinct, understandable errors.
- Auth panel and metadata `Authorization` conflicts resolve deterministically.
- `-bin` metadata values round-trip as base64 without corruption.
- Secret fields are redacted from persisted history and exports.
- Spring `PERMISSION_DENIED` hint appears only for status 7 and is dismissible.

---

## Phase 5 — Saved Requests, Collections & History

> **Goal:** Users can save and organize gRPC requests by service + method, with a recent call history and grpcurl interop.

### Persistence model and replay contract

To ensure saved requests replay deterministically across tabs/environments:

- A saved request stores `callType`, `target` (or environment token), `service`, `method`, `descriptorKey`, request body, and metadata.
- Saved request payload captures only execution inputs; runtime outputs (status, trailers, duration) belong to history, not collections.
- Collection items are immutable snapshots at save time; "Update saved request" creates a new revision timestamp.
- Re-running a saved request resolves variables from the active environment at execution time, then executes on the active tab snapshot.
- If descriptor refresh removes/renames method fields, saved request remains loadable with a non-blocking schema drift warning.

### Collection tree structure

```
GrpcCollection
├── service: "com.example.OrderService"
│   ├── saved request: "Create Order — Happy Path"
│   │     body: { item_id: "sku-1", qty: 2 }
│   │     metadata: { x-request-id: "test-1" }
│   ├── saved request: "Create Order — Missing Field"
│   └── method: GetOrder
│       └── saved request: "Get By ID"
└── service: "com.example.UserService"
    └── ...
```

### Recent call history

- Last 200 calls stored in `grpc_call_history_v1`
- Each entry: target, service, method, body snapshot, duration, status code, timestamp
- Click any history entry to re-populate the form
- Filter by service, method, status code, date

History safety and size rules:

- Redact secret-bearing metadata/auth fields before persistence (Phase 4 secret policy applies).
- Cap body snapshot size (for example 64 KB per entry) and truncate with marker when exceeded.
- Include `callType` and `descriptorKey` in history metadata so replay uses correct method shape.
- Keep history append-only by timestamp; manual clear supports all entries or filtered subset.

### grpcurl Import / Export

- **Import**: parse `grpcurl -d '{"field":"value"}' host:port Service/Method` command line into Studio form
- **Export**: "Copy as grpcurl" button on any saved request / active call
- Supports `-plaintext`, `-H`, `-cert`, `-key`, `-cacert` flags

Interop rules:

- Support `-authority` mapping to `serverNameOverride`.
- Support descriptor flags: `-proto`, `-protoset`, and repeated `-import-path`.
- Preserve repeated `-H` metadata headers and binary `-bin` header values.
- Export should include explicit transport flags derived from current TLS/auth config.
- Unsupported grpcurl options should be reported clearly on import with partial-import preview.

### Persistence identity and replay safety contract

- Saved request identity is immutable (`id`) and revisioned via `updatedAt`; replay always uses latest saved revision unless user opens historical revision explicitly.
- Replay execution snapshot must include `callType`, `descriptorKey`, `service`, `method`, and resolved target at run time.
- If descriptor drift is detected, load request in non-destructive compatibility mode with clear remap guidance (never silent field drops).
- History entries are append-only audit records; editing a saved request must not mutate existing history records.
- Secret redaction runs before any persistence write path (collections, history, export, telemetry).

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 5A — Persistence contracts and storage schema freeze

Scope:
- Finalize collection/history storage schemas, version keys, and migration rules.
- Define immutable identity + revision semantics for saved requests.

Deliverables:
- Storage schema spec for collections/history (`v1` keys + migration hooks).
- Contract for saved-request identity/revision and replay snapshot fields.

Verification gates:
- Schema validation tests for required/optional fields.
- Migration tests from prior/empty storage states.

Exit criteria:
- No ambiguity in what is persisted, versioned, or replayed.

#### Phase 5B — Collection repository and CRUD core

Scope:
- Implement collection CRUD with service/method tree organization.
- Support create/update/delete/duplicate and optimistic UI-safe operations.

Deliverables:
- Collection repository layer and selectors.
- Deterministic tree projection (service -> method -> saved requests).

Verification gates:
- Unit tests for CRUD operations and tree ordering stability.
- Concurrency tests for rapid create/update operations.

Exit criteria:
- Collection operations are deterministic and resilient to rapid UI interactions.

#### Phase 5C — Replay resolver and execution snapshot binding

Scope:
- Implement replay pipeline resolving environment variables at execution time.
- Ensure replay binds to active tab snapshot without cross-tab mutation.

Deliverables:
- Replay resolver utility (saved request -> executable runtime snapshot).
- Schema drift compatibility warnings with safe fallback behavior.

Verification gates:
- Integration tests for replay across different environments.
- Tests for drift scenarios (renamed/removed fields and method changes).

Exit criteria:
- Replayed requests execute predictably with explicit drift handling.

#### Phase 5D — Recent history recorder and retention policy

Scope:
- Implement append-only history capture with retention cap and filters.
- Add selective and full clear operations.

Deliverables:
- History recorder service and indexed query helpers.
- Retention enforcement (`max entries`, body size truncation policy).

Verification gates:
- Tests for capped retention and truncation markers.
- Tests for filter accuracy (service/method/status/date).

Exit criteria:
- History remains performant, bounded, and queryable at scale.

#### Phase 5E — Redaction and data-safety enforcement

Scope:
- Enforce Phase 4 secret redaction across all persistence/export paths.
- Block accidental secret persistence from metadata/auth/tls fields.

Deliverables:
- Shared redaction middleware for collection/history/export writes.
- Safe serialization utilities for UI previews.

Verification gates:
- Leak tests proving secrets never appear in stored or exported payloads.
- Regression tests across replay/history/export code paths.

Exit criteria:
- Persistence layer is safe by default with no secret leakage.

#### Phase 5F — grpcurl import parser and normalization

Scope:
- Build robust parser for grpcurl commands including descriptor/authority flags.
- Normalize imported command structure into Studio request model.

Deliverables:
- Parser module with partial-import diagnostics.
- Mapping logic for `-proto`, `-protoset`, `-import-path`, `-authority`, repeated `-H`.

Verification gates:
- Parser test corpus for valid/invalid/mixed-option commands.
- Round-trip tests preserving binary metadata and tls-related flags where supported.

Exit criteria:
- grpcurl import is reliable and transparent about unsupported options.

#### Phase 5G — grpcurl export builder and parity checks

Scope:
- Implement export generator from active request or saved request contexts.
- Ensure export reflects tls/auth/metadata semantics accurately.

Deliverables:
- Export builder utility and copy action integration.
- Option compatibility matrix documenting exact emitted flags.

Verification gates:
- Golden tests for exported command strings across scenarios.
- Import->export->import parity tests for semantic equivalence.

Exit criteria:
- Exported grpcurl commands are reproducible and semantically faithful.

#### Phase 5H — UI integration for collections/history/interop

Scope:
- Integrate collections panel, history list, replay actions, and grpcurl import/export UI.
- Ensure tab-scoped behavior and responsive UX under large datasets.

Deliverables:
- `GrpcCollectionsPanel` and related hooks wiring.
- UI actions for save/update/replay/history filter/import/export.

Verification gates:
- UI integration tests for full user flows (save -> replay -> history -> export/import).
- Performance checks for large collection and history sets.

Exit criteria:
- End-to-end collection/history workflows are stable and intuitive.

#### Phase 5I — Hardening gate before Phase 6

Scope:
- Final reliability and consistency pass before workflow integration.
- Confirm acceptance checklist traceability to tests.

Deliverables:
- Phase 5 validation report (persistence, replay, redaction, interop).
- Troubleshooting notes for import/export and drift scenarios.

Verification gates:
- No open P0/P1 issues in replay correctness, data safety, or grpcurl interop.
- CI green for Phase 5 unit/integration/E2E tagged tests.

Exit criteria:
- Phase 5 is signed off and safe for Phase 6 workflow integration.

### Phase 5 execution order and dependency chain

`5A -> 5B -> 5C -> 5D -> 5E -> 5F -> 5G -> 5H -> 5I`

Notes:
- `5B` and `5D` can overlap once storage contracts in `5A` are frozen.
- `5E` should start early and be reused by `5B/5D/5F/5G` to prevent retrofit leaks.
- `5F` and `5G` should iterate together to guarantee import/export parity.
- `5I` is a strict gate before Phase 6 starts.

### Phase 5 acceptance checklist

- Saving/reloading unary and streaming requests preserves `callType` and method binding.
- Replaying history uses active environment interpolation while keeping original method/descriptor identity.
- History entries redact secrets and enforce snapshot size cap.
- grpcurl import handles `-proto`/`-protoset`/`-import-path` and `-authority` correctly.
- grpcurl export round-trips a request back into Studio with no semantic drift.

---

## Phase 6 — Workflow Integration

> **Goal:** gRPC calls can be used as workflow nodes, enabling multi-step test scenarios mixing gRPC with HTTP, Kafka, WebSocket, etc.

### New workflow node types

| Node Type | Config Panel | Description |
|---|---|---|
| `grpcUnary` | `GrpcUnaryNodeConfig` | Execute a unary gRPC call; store response in variables |
| `grpcServerStream` | `GrpcServerStreamNodeConfig` | Collect N streaming messages (or until condition); assert on each |
| `grpcAssert` | `GrpcAssertNodeConfig` | Assert on a stored gRPC response (status, field values) |

### Workflow node config contracts

```ts
interface GrpcWorkflowBaseConfig {
  target: string;                 // literal host:port or {{grpcHost}}
  descriptorKey: string;
  service: string;
  method: string;
  metadata?: Record<string, string>;
  auth?: GrpcAuthConfig;
  timeoutMs?: number;             // per-node override
  retry?: { maxAttempts: number; backoffMs: number; retryOnStatuses?: number[] };
  onError?: 'fail' | 'continue';  // workflow engine policy
  saveAs?: string;                // namespace key for outputs, e.g. "createOrder"
}

interface GrpcUnaryNodeConfig extends GrpcWorkflowBaseConfig {
  callType: 'unary';
  body: Record<string, unknown>;
}

interface GrpcServerStreamNodeConfig extends GrpcWorkflowBaseConfig {
  callType: 'server_streaming';
  body: Record<string, unknown>;
  collect: {
    maxMessages?: number;         // stop after N messages
    untilExpression?: string;     // CEL-like or existing workflow expression syntax
    maxDurationMs?: number;       // hard stop for long streams
  };
}

interface GrpcAssertNodeConfig {
  source: string;                 // step id or saveAs key
  assertions: Array<
    | { grpcStatus: number }
    | { grpcField: string; equals?: unknown; contains?: unknown; exists?: boolean }
    | { grpcTrailer: string; equals?: string; exists?: boolean }
    | { grpcDuration: { max?: number; min?: number } }
    | { grpcStreamLength: { equals?: number; min?: number; max?: number } }
  >;
  onError?: 'fail' | 'continue';
}
```

### Runtime semantics (deterministic execution)

- `grpcUnary` and `grpcServerStream` execute from an immutable node snapshot at step start.
- Node-level timeout defaults to 30s unless overridden by `timeoutMs`.
- Retry is disabled by default; when enabled, retries apply only to transport/status failures in `retryOnStatuses`.
- `grpcServerStream` must close the underlying stream when `maxMessages`, `untilExpression`, or `maxDurationMs` is hit.
- `onError: continue` records node failure in results but allows downstream nodes to run.
- `grpcAssert` never performs network I/O; it only evaluates stored outputs.

### Workflow variable model

- Keep compatibility aliases: `{{grpc.response.*}}`, `{{grpc.stream[...]}}`.
- Canonical scoped output is per-node: `{{steps.<nodeId>.grpc.status}}`, `{{steps.<nodeId>.grpc.body}}`, `{{steps.<nodeId>.grpc.messages}}`.
- If `saveAs` is set, alias outputs at `{{grpc.<saveAs>.*}}` to avoid node-id coupling.
- Avoid global overwrite races by treating `{{grpc.response.*}}` as "last successful grpc node" only.

### Variables

- `{{grpc.response.body.fieldName}}` — extract field from last gRPC response
- `{{grpc.response.status}}` — gRPC status code integer
- `{{grpc.stream[0].body.fieldName}}` — message at index from last server stream

Result shape persisted by workflow runner:

```ts
interface GrpcWorkflowStepResult {
  nodeId: string;
  callType: 'unary' | 'server_streaming';
  status: 'success' | 'failed' | 'skipped';
  grpcStatus?: number;
  grpcStatusMessage?: string;
  durationMs?: number;
  body?: Record<string, unknown>;                // unary
  messages?: Record<string, unknown>[];          // server stream
  trailers?: Record<string, string>;
  errorDetail?: string;
  assertionFailures?: string[];
}
```

### Integration with existing infrastructure

- Node handlers go in `src/features/workflow/engine/graphRunnerGrpcNodeHandlers.ts`
- Config panels in `src/features/workflow/components/nodes/grpc/`
- Results explorer shows gRPC response body + stream messages in the Results tab

### Workflow namespace and alias safety contract

- Node output namespace is immutable per execution run (`steps.<nodeId>.grpc.*`) and must never be overwritten by other nodes.
- `saveAs` aliases must be unique per workflow graph at validation time; duplicate aliases are configuration errors.
- Compatibility alias `grpc.response.*` points to the last successful gRPC node in execution order and is read-only derived state.
- `grpcAssert` reads from frozen upstream step results only; it must not read mutable global state.
- Retries create attempt-local transient state, but only final attempt result is committed to canonical step output.

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 6A — Node contracts and workflow validation rules

Scope:
- Freeze config contracts for `grpcUnary`, `grpcServerStream`, and `grpcAssert`.
- Add graph-time validation rules (`saveAs` uniqueness, required fields, collect rules).

Deliverables:
- Node schema validators and validation error catalog.
- Contract matrix mapping node type -> required/optional fields.

Verification gates:
- Unit tests for valid/invalid node configurations.
- Graph validation tests for alias collisions and missing collect constraints.

Exit criteria:
- Workflow graph cannot start with structurally invalid gRPC node configs.

#### Phase 6B — Runtime adapter boundary and snapshot freezing

Scope:
- Build workflow runtime adapter that converts node config into immutable execution snapshot.
- Ensure interpolation occurs once at node start and is frozen for the attempt.

Deliverables:
- Snapshot builder utility for unary and server-stream nodes.
- Runtime boundary contract between workflow engine and gRPC transport layer.

Verification gates:
- Tests for frozen snapshot behavior under concurrent variable updates.
- Determinism tests for repeated run inputs producing identical outbound payloads.

Exit criteria:
- Node execution is deterministic and isolated from mid-run config mutation.

#### Phase 6C — grpcUnary executor and retry semantics

Scope:
- Implement unary node executor with timeout, retry, and `onError` policy.
- Distinguish retryable transport/status failures from non-retryable assertion/config failures.

Deliverables:
- Unary execution handler in workflow runner path.
- Retry policy evaluator (`retryOnStatuses`, max attempts, backoff).

Verification gates:
- Integration tests for retry/no-retry scenarios.
- Tests validating `onError: continue` result marking and downstream continuation.

Exit criteria:
- Unary workflow execution is resilient and policy-correct.

#### Phase 6D — grpcServerStream collector executor

Scope:
- Implement server-stream execution with bounded collection controls.
- Guarantee proper stream termination on any stop condition.

Deliverables:
- Stream collector handler supporting `maxMessages`, `untilExpression`, `maxDurationMs`.
- Terminal-state mapping for success/timeout/error/cancel conditions.

Verification gates:
- Integration tests for each stop condition and precedence behavior.
- Leak tests confirming stream close on all terminal paths.

Exit criteria:
- Server-stream nodes always terminate deterministically with bounded resource use.

#### Phase 6E — grpcAssert engine and assertion DSL mapping

Scope:
- Implement assertion evaluator over frozen source step outputs.
- Support field/trailer/status/duration/stream-length assertions with clear failures.

Deliverables:
- Assertion engine module + failure formatter.
- Path resolution helper for nested gRPC body/message assertions.

Verification gates:
- Unit tests for assertion operators and failure messaging.
- Tests ensuring assertion failures are never retried by transport retry policy.

Exit criteria:
- Assertions are precise, deterministic, and separated from transport retry logic.

#### Phase 6F — Output namespace and alias publication

Scope:
- Publish canonical per-node outputs and optional `saveAs` aliases safely.
- Enforce compatibility alias derivation without overwrite races.

Deliverables:
- Output publisher utility for `steps.<nodeId>.grpc.*` and alias projections.
- Collision-safe alias registry with graph-time + runtime guards.

Verification gates:
- Tests for multi-node workflows ensuring no namespace overwrite.
- Tests for alias collision rejection and last-success alias behavior.

Exit criteria:
- Workflow outputs are stable, traceable, and collision-free.

#### Phase 6G — Results explorer and observability integration

Scope:
- Expose per-step grpc outputs in results UI and structured execution logs.
- Include attempt metadata, timing, status, and assertion failure details.

Deliverables:
- Results adapter for gRPC node output visualization.
- Structured telemetry fields for node execution diagnostics.

Verification gates:
- UI tests for step-level result rendering in mixed-protocol workflows.
- Log schema tests for required diagnostic fields.

Exit criteria:
- Users can debug gRPC workflow behavior from results without ambiguity.

#### Phase 6H — Cross-protocol and harness compatibility checks

Scope:
- Validate gRPC nodes interoperate with HTTP/Kafka/WebSocket nodes in one run.
- Ensure future harness alignment by reusing compatible result contracts where possible.

Deliverables:
- Cross-protocol scenario suite with chained variable dependencies.
- Compatibility notes for Phase 8 harness ingestion of workflow gRPC results.

Verification gates:
- End-to-end tests for mixed protocol graphs and alias-based handoffs.
- Contract tests for result shape stability.

Exit criteria:
- gRPC workflow nodes behave consistently inside heterogeneous workflows.

#### Phase 6I — Hardening gate before Phase 7

Scope:
- Final reliability pass for workflow runtime determinism and output stability.
- Confirm acceptance checklist coverage and release-readiness for next phase.

Deliverables:
- Phase 6 validation report with retry/assertion/namespace outcomes.
- Runbook guidance for debugging gRPC workflow nodes.

Verification gates:
- No open P0/P1 issues in workflow determinism, output collision, or retry policy handling.
- CI green for Phase 6 unit/integration/E2E workflow-tagged tests.

Exit criteria:
- Phase 6 is signed off and safe for Phase 7 native-transport expansion.

### Phase 6 execution order and dependency chain

`6A -> 6B -> 6C -> 6D -> 6E -> 6F -> 6G -> 6H -> 6I`

Notes:
- `6C` and `6D` can overlap once snapshot boundary in `6B` is stable.
- `6E` should start after source-output contracts from `6B` are frozen.
- `6F` must complete before `6G` to ensure result rendering uses final namespace rules.
- `6I` is a strict gate before Phase 7 starts.

### Phase 6 acceptance checklist

- Two gRPC nodes in one workflow do not overwrite each other's scoped outputs.
- `onError: continue` allows downstream execution and marks node as failed with error detail.
- `grpcServerStream` always terminates by one of the configured collect stop conditions.
- Retry policy does not retry assertion failures from `grpcAssert`.
- `saveAs` aliases resolve correctly in downstream node expressions.
- Results explorer shows per-step gRPC output, not only global last response.

---

## Phase 7 — Tauri Native Transport (tonic)

> **Goal:** On desktop, bypass the Express proxy and use Rust `tonic` for true HTTP/2 gRPC with event-driven streaming.

### Native transport contract (desktop parity)

Phase 7 must preserve the same behavioral guarantees as web transport (Phases 1/2):

- Each unary/stream request carries `requestId` and `tabId` from renderer to Rust command handlers.
- Response and stream events must include `requestId` + `tabId` so UI can route updates to the correct tab.
- Tab close cancels native in-flight unary/stream operations for that tab.
- Native stream cancel/end operations are idempotent and return stable final state.
- Desktop result envelope shape must remain compatible with `GrpcCallResult` used by web path.

### Architecture

```
GrpcStudioPage (renderer)
   ↓  invoke("grpc_unary", { target, service, method, body, metadata, tls_config })
Tauri command (src-tauri)
   ↓  tonic::transport::Channel
gRPC Server
   ↓  response
Tauri command
   ↓  Ok(GrpcCallResult)
GrpcStudioPage
```

For streaming:
```
invoke("grpc_stream_start", { ... })   → stream_id
tauri::emit("grpc-message-{id}", msg)  → renderer listens
invoke("grpc_stream_send", { id, body })
invoke("grpc_stream_end", { id })
invoke("grpc_stream_cancel", { id })
```

### Tauri command and event schemas

```ts
interface GrpcTauriUnaryRequest extends GrpcCallRequest {
  tabId: string;
}

interface GrpcTauriStreamStartRequest extends GrpcCallRequest {
  callType: 'server_streaming' | 'client_streaming' | 'bidi_streaming';
  tabId: string;
}

interface GrpcTauriStreamControlRequest {
  streamId: string;
  requestId: string;
  tabId: string;
}

interface GrpcTauriEvent {
  type: 'grpc-message' | 'grpc-end' | 'grpc-error';
  streamId?: string;
  requestId: string;
  tabId: string;
  sequence?: number;
  timestamp: string;
  data?: Record<string, unknown>;
  trailers?: Record<string, string>;
  grpcStatus?: number;
  grpcStatusMessage?: string;
  errorDetail?: string;
}
```

Event channels should be scoped and consistent:

- `grpc-event-{tabId}` (single channel with typed payload) or
- `grpc-message-{streamId}` plus `grpc-end-{streamId}` and `grpc-error-{streamId}`.

Pick one strategy and use it consistently across renderer and Rust.

### Native channel/session lifecycle

- Maintain a channel pool keyed by normalized target + tls/auth fingerprint.
- Reuse healthy channels across calls; evict on transport failures or config changes.
- Maintain stream registry keyed by `streamId` with ownership (`tabId`, `requestId`, callType).
- Cleanup triggers: stream end, explicit cancel, tab close, window close, app shutdown.
- On renderer disconnect/crash, Rust side must time out orphan streams and release resources.

### Transport selection rules

- Desktop default transport: `Tauri native` when available.
- If native command fails before call starts, surface actionable error and allow one-click fallback to web proxy transport.
- If call has started in native mode, do not auto-fallback mid-flight; fail deterministically.

### Rust crates required

```toml
[dependencies]
tonic = { version = "0.12", features = ["tls"] }
prost = "0.13"
prost-reflect = "0.14"   # dynamic proto message from descriptors
tokio = { version = "1", features = ["full"] }
tokio-stream = "0.1"
```

### Dynamic dispatch without codegen

Since users can load arbitrary `.proto` files at runtime, we cannot use `protoc`-generated Rust stubs. Instead, use `prost-reflect` for dynamic message construction from `FileDescriptorPool`, mirroring how `grpcurl` and `grpcui` work.

### Native command/event trust-boundary contract

- Renderer never sends raw secrets to logs/telemetry; native command layer applies same redaction policy as web path before diagnostics emission.
- Command and event payloads are versioned (`schemaVersion`) for forward compatibility between renderer and Rust backend.
- Event ordering is monotonic per `streamId` via `sequence`; out-of-order events are ignored or buffered by renderer policy.
- Native fallback decision is one-time at call start; fallback outcome is persisted in result metadata for debuggability.
- Descriptor bytes/fingerprints passed to native layer must be integrity-checked before dynamic message construction.

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 7A — Native API contracts and versioning freeze

Scope:
- Finalize command/event schemas, versioning strategy, and parity requirements with web envelopes.
- Define compatibility policy for renderer-native mismatches.

Deliverables:
- `schemaVersion` strategy and compatibility matrix.
- Contract table for unary/stream commands, control commands, and event payloads.

Verification gates:
- Contract tests between TypeScript interfaces and Rust serde structures.
- Negative tests for version mismatch handling.

Exit criteria:
- No ambiguity in renderer-native protocol and upgrade behavior.

#### Phase 7B — Channel pool and transport fingerprinting

Scope:
- Implement channel-pool keying by target + tls/auth fingerprint.
- Define healthy reuse, eviction triggers, and pool limits.

Deliverables:
- Pool manager with reuse/evict semantics.
- Fingerprint builder aligned with Phase 4 tls/auth normalization.

Verification gates:
- Tests for reuse on identical fingerprint and eviction on config changes.
- Stress tests for pool growth/cleanup boundaries.

Exit criteria:
- Native connections are reused safely without cross-config contamination.

#### Phase 7C — Unary command execution path

Scope:
- Implement native unary invocation with request correlation, timeout, and cancellation hooks.
- Ensure result envelope parity with web transport.

Deliverables:
- `grpc_unary` handler with correlation-safe response mapping.
- Error mapping layer preserving grpc status/message/trailers/detail.

Verification gates:
- Integration tests for success, timeout, unreachable target, and TLS/auth failures.
- Parity tests against web `GrpcCallResult` shape.

Exit criteria:
- Native unary behaves as drop-in equivalent to web unary path.

#### Phase 7D — Stream start/events/control lifecycle

Scope:
- Implement native stream start/send/end/cancel with ownership checks.
- Emit deterministic event stream with sequence and terminal-state guarantees.

Deliverables:
- Stream registry in Rust keyed by `streamId` with `tabId`/`requestId` ownership.
- Event emitter pipeline and idempotent control handlers.

Verification gates:
- Integration tests for server/client/bidi stream control semantics.
- Idempotency tests for repeated end/cancel and late control commands.

Exit criteria:
- Native stream lifecycle is deterministic, bounded, and ownership-safe.

#### Phase 7E — Renderer event adapter and routing safety

Scope:
- Implement renderer listener strategy for selected channel scheme.
- Ensure tab-scoped routing, dedupe, and monotonic sequence handling.

Deliverables:
- Event adapter module for `grpc-event-{tabId}` or stream-scoped channels.
- Routing guards that reject mismatched `tabId`/`requestId` payloads.

Verification gates:
- UI integration tests for mixed concurrent streams across tabs.
- Reordering/duplicate event tests with sequence policy.

Exit criteria:
- No cross-tab event bleed or duplicate rendering from native events.

#### Phase 7F — Fallback orchestration and user controls

Scope:
- Implement pre-start fallback to web proxy when native startup fails.
- Keep in-flight behavior deterministic (no mid-flight auto-switch).

Deliverables:
- Fallback orchestrator with one-click retry in alternate transport.
- Result metadata field indicating selected transport and fallback reason.

Verification gates:
- Tests for native-start failure -> web fallback path.
- Tests proving no transport switch occurs after native call starts.

Exit criteria:
- Fallback is predictable, user-visible, and non-destructive.

#### Phase 7G — Descriptor-to-prost-reflect integration

Scope:
- Validate descriptor ingestion into `FileDescriptorPool` and dynamic message serialization/deserialization.
- Ensure compatibility with Phase 3 descriptor fingerprints and drift handling.

Deliverables:
- Descriptor bridge layer between shared descriptor model and Rust dynamic dispatch.
- Validation checks for unsupported/invalid descriptors.

Verification gates:
- Tests for representative proto schemas including WKTs and nested messages.
- Failure tests for invalid descriptor payloads and fingerprint mismatch.

Exit criteria:
- Native dynamic dispatch is robust for runtime-loaded schemas.

#### Phase 7H — Crash/disconnect recovery and resource cleanup

Scope:
- Handle renderer disconnect, app shutdown, and orphaned stream/channel cleanup.
- Guarantee bounded cleanup windows and leak prevention.

Deliverables:
- Recovery supervisor for orphan operation timeouts.
- Cleanup hooks for tab close, window close, and process shutdown.

Verification gates:
- Kill/restart simulations verifying no persistent orphan resources.
- Long-run stability tests for channel/stream counts.

Exit criteria:
- Native runtime recovers cleanly from renderer lifecycle failures.

#### Phase 7I — Hardening gate before Phase 8

Scope:
- Final parity/reliability pass prior to harness integration work.
- Confirm acceptance checklist coverage with automated and manual evidence.

Deliverables:
- Phase 7 parity report (native vs web behavior matrix).
- Operational runbook for native transport diagnostics and fallback troubleshooting.

Verification gates:
- No open P0/P1 issues in routing, lifecycle cleanup, or envelope parity.
- CI green for native transport unit/integration/E2E tagged suites.

Exit criteria:
- Phase 7 is signed off and stable for Phase 8 test-runner integration.

### Phase 7 execution order and dependency chain

`7A -> 7B -> 7C -> 7D -> 7E -> 7F -> 7G -> 7H -> 7I`

Notes:
- `7C` and `7D` can overlap after command/event contracts in `7A` are fixed.
- `7E` should begin once event schema from `7D` stabilizes.
- `7G` should run in parallel with `7C/7D` after descriptor contract alignment with Phase 3.
- `7I` is a strict gate before Phase 8 starts.

### Phase 7 acceptance checklist

- Native unary and stream responses always route to the correct tab via `tabId`/`requestId`.
- Closing a tab cancels native in-flight operations for that tab only.
- Repeated end/cancel requests are idempotent and do not panic the Rust side.
- Renderer restart/disconnect does not leak native streams/channels.
- Channel reuse works for repeated calls to same target and resets on TLS/auth changes.
- Native error envelopes preserve gRPC status, trailers, and detail parity with web transport.

---

## Phase 8 — Test Runner Integration & Assertions

> **Goal:** gRPC calls can be defined as test scenarios in the harness, with proto-typed field assertions and status code checks.

### Harness scenario contract (deterministic)

```yaml
type: grpc
id: grpc-create-order-001
callType: unary               # unary | server_streaming | client_streaming | bidi_streaming
target: "{{grpcHost}}"
descriptorKey: order-v1
service: com.example.OrderService
method: CreateOrder
timeoutMs: 30000
retry:
  maxAttempts: 1
  backoffMs: 0
metadata: {}
auth: {}
body: {}
collect:                       # required for streaming call types
  maxMessages: 100
  maxDurationMs: 5000
assertions: []
```

Contract rules:

- `callType` is required; default to `unary` only for backward compatibility.
- `descriptorKey` is required to lock schema version used for serialization/assertion.
- Streaming scenarios require `collect` section (`maxMessages` and/or `maxDurationMs`).
- Harness execution uses immutable scenario snapshot after data-source interpolation.

### gRPC scenario type in harness

```yaml
# Example gRPC test scenario (YAML representation)
type: grpc
target: "{{grpcHost}}"
service: com.example.OrderService
method: CreateOrder
metadata:
  authorization: "Bearer {{authToken}}"
body:
  item_id: "{{testItemId}}"
  quantity: 1
assertions:
  - grpcStatus: 0                          # OK
  - grpcField: "order_id"                  # field exists
  - grpcField: "status"                    # field exists  
    equals: "PENDING"
  - grpcDuration: { max: 500 }             # response within 500ms
```

### New assertion types

| Assertion | Description |
|---|---|
| `grpcStatus` | Assert exact gRPC status code (0 = OK, 5 = NOT_FOUND, etc.) |
| `grpcField` | Assert field exists / equals / contains in response body |
| `grpcNumericField` | Assert numeric field with >, <, >=, <=, == operators |
| `grpcStreamLength` | Assert number of stream messages received |
| `grpcStreamField` | Assert field value in a specific stream message by index |
| `grpcDuration` | Assert call duration is within bounds |
| `grpcTrailer` | Assert a specific trailer key/value is present |

### Assertion evaluation semantics

- Assertions execute in declared order and append failures with stable messages.
- `grpcField` and `grpcStreamField` use dotted-path lookup (for example `items[0].id`).
- Missing path is a failure unless `exists: false` is explicitly asserted.
- `grpcNumericField` must handle string-encoded int64/uint64 safely (no JS precision loss).
- `grpcTrailer` compares normalized lowercase keys.
- `grpcStatus` runs before body-field assertions to provide clearer root-cause output.

### Streaming collection semantics for harness

- `server_streaming`: collect until `maxMessages` or `maxDurationMs` and then cancel/close stream.
- `client_streaming`: send fixture messages in order, then EOF, then evaluate terminal response assertions.
- `bidi_streaming`: alternate/send-sequence must be deterministic from fixture; collect inbound messages with same bounds.
- If stream ends before required assertion indices exist, report assertion failure (not infra error).

### Harness result schema

```ts
interface GrpcHarnessResult {
  scenarioId: string;
  callType: 'unary' | 'server_streaming' | 'client_streaming' | 'bidi_streaming';
  status: 'passed' | 'failed' | 'error' | 'timeout';
  grpcStatus?: number;
  grpcStatusMessage?: string;
  durationMs: number;
  body?: Record<string, unknown>;
  messages?: Record<string, unknown>[];
  trailers?: Record<string, string>;
  assertionResults: Array<{ name: string; passed: boolean; message?: string }>;
  errorCategory?: 'network' | 'timeout' | 'serialization' | 'assertion' | 'internal';
  errorDetail?: string;
}
```

### Data source expansion

gRPC scenarios participate in the same CSV/JSON data source expansion as HTTP scenarios, enabling parameterized gRPC testing across multiple input rows.

Data-source rules:

- Each expanded row produces a unique `scenarioId` suffix for traceability.
- Interpolation occurs before serialization; unresolved variables fail fast with category `serialization`.
- Secret variables are redacted in exported harness reports.

### Harness assertion/result determinism contract

- Assertion evaluation uses immutable collected payload snapshots; no assertion may read mutable live stream state.
- Assertion order is deterministic and failure messages are stable across retries/runs for identical inputs.
- Retry policy applies to execution transport only; assertion failures are terminal for that attempt and never retried as transport errors.
- Result classification precedence is strict: `timeout` > `error` > `failed` > `passed`.
- Exported harness reports include redacted request context + assertion outcomes + category-safe diagnostics only.

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 8A — Scenario contracts and validation freeze

Scope:
- Finalize gRPC harness scenario schema and validation rules for all call types.
- Enforce required fields (`callType`, `descriptorKey`, `collect` for streaming).

Deliverables:
- Scenario validator and error catalog for grpc harness definitions.
- Contract matrix for unary/server/client/bidi scenario requirements.

Verification gates:
- Unit tests for valid/invalid scenario payloads.
- Backward-compat checks for default-unary legacy scenarios.

Exit criteria:
- Harness cannot execute malformed gRPC scenarios.

#### Phase 8B — Harness adapter boundary and execution snapshots

Scope:
- Implement unified harness adapter for all gRPC call types.
- Freeze resolved/interpolated scenario snapshots before execution.

Deliverables:
- Adapter layer from harness scenario -> runtime gRPC execution request.
- Snapshot lifecycle state model for attempts and retries.

Verification gates:
- Determinism tests for repeated runs with identical scenario inputs.
- Tests for snapshot immutability under concurrent data-source expansion.

Exit criteria:
- Execution inputs are deterministic and isolated per scenario row.

#### Phase 8C — Unary + streaming execution handlers in harness

Scope:
- Implement execution handlers for unary/server/client/bidi harness flows.
- Apply bounded collection rules and stop-condition precedence.

Deliverables:
- Unified call-type dispatch with per-type execution semantics.
- Stream collector with maxMessages/maxDuration enforcement.

Verification gates:
- Integration tests for all call types and stop conditions.
- Leak tests confirming stream closure on terminal conditions.

Exit criteria:
- Harness executes all gRPC call types with bounded, deterministic behavior.

#### Phase 8D — Assertion engine implementation and path resolution

Scope:
- Implement full assertion set (`grpcStatus`, `grpcField`, `grpcNumericField`, `grpcStreamField`, `grpcTrailer`, `grpcDuration`, `grpcStreamLength`).
- Add stable dotted-path resolver with array index support.

Deliverables:
- Assertion evaluator and failure formatter.
- Path-resolution utility with exists/equals/contains semantics.

Verification gates:
- Unit tests for each assertion type and edge conditions.
- Stable-message snapshot tests for failure outputs.

Exit criteria:
- Assertion behavior is predictable, expressive, and testable.

#### Phase 8E — Numeric safety and trailer normalization

Scope:
- Ensure int64/uint64 assertions are string-safe with no precision loss.
- Normalize trailer-key comparisons to lowercase.

Deliverables:
- Numeric comparator module supporting string and numeric forms safely.
- Trailer normalization helper for harness assertions.

Verification gates:
- Tests for large int64/uint64 boundaries and mixed representations.
- Tests for trailer key-case variations.

Exit criteria:
- Numeric and trailer assertions are robust and precision-safe.

#### Phase 8F — Data-source expansion integration and row traceability

Scope:
- Integrate gRPC scenarios into CSV/JSON row expansion pipeline.
- Ensure unique row-scoped scenario IDs and reproducible interpolation.

Deliverables:
- Row expander integration for gRPC harness type.
- Scenario identity generator with stable suffixing rules.

Verification gates:
- Multi-row tests for unique IDs and reproducible run ordering.
- Interpolation error tests with `serialization` categorization.

Exit criteria:
- Parameterized gRPC scenarios are traceable and reproducible across runs.

#### Phase 8G — Result model publication and categorization

Scope:
- Implement final `GrpcHarnessResult` publication with category precedence.
- Preserve assertion-level granularity and safe diagnostic context.

Deliverables:
- Result builder module with strict status/category precedence rules.
- Assertion result attachment and summary generators.

Verification gates:
- Tests for precedence (`timeout`/`error`/`failed`/`passed`) and category mapping.
- Result schema stability tests for downstream consumers.

Exit criteria:
- Harness outputs are deterministic, machine-readable, and debugging-friendly.

#### Phase 8H — Export/redaction and reporting safety

Scope:
- Apply Phase 4 redaction policy to harness exports and reports.
- Ensure no secret leakage through failure detail or assertion messages.

Deliverables:
- Redacted export serializer for gRPC harness artifacts.
- Safety filters for diagnostics and assertion context payloads.

Verification gates:
- Secret leak tests over exported JSON/markdown reports.
- Regression tests for redaction across all call types.

Exit criteria:
- Harness reporting is secure by default with no secret exposure.

#### Phase 8I — Hardening gate before Phase 9

Scope:
- Final reliability pass for adapter/assertion/result correctness.
- Confirm acceptance checklist traceability and release readiness.

Deliverables:
- Phase 8 validation report (call-type coverage, assertion fidelity, export safety).
- Runbook for debugging harness gRPC failures and assertion mismatches.

Verification gates:
- No open P0/P1 defects in harness determinism, assertion correctness, or redaction.
- CI green for Phase 8 unit/integration/E2E harness-tagged suites.

Exit criteria:
- Phase 8 is signed off and safe to proceed to Phase 9 interpolation work.

### Phase 8 execution order and dependency chain

`8A -> 8B -> 8C -> 8D -> 8E -> 8F -> 8G -> 8H -> 8I`

Notes:
- `8C` and `8D` can overlap once adapter boundaries in `8B` are stable.
- `8E` should complete before finalizing `8D` numeric assertion behavior.
- `8G` depends on stable outputs from `8C/8D` and row identity from `8F`.
- `8I` is a strict gate before Phase 9 starts.

### Phase 8 acceptance checklist

- Unary and streaming scenarios run through one unified harness adapter with explicit `callType`.
- Stream assertions are evaluated against bounded collection windows (`maxMessages`/`maxDurationMs`).
- int64/uint64 field assertions pass using string-safe comparisons.
- Failures are categorized (`assertion` vs `network` vs `timeout`) in result output.
- Data-source expansion keeps per-row scenario identity and reproducible assertion logs.
- Harness export redacts secret metadata/auth values.

---

## Phase 9 — Environment Variable Interpolation

> **Goal:** `{{grpcHost}}`, `{{grpcPort}}`, and other environment tokens are resolved from the active environment before each call.

The environment manager already defines `{{grpcHost}}` as a `host:port` string (see `environment-manager-expansion-plan.md` §gRPC tab). This phase wires it up in the Studio:

- Target address field shows `{{grpcHost}}` by default.

### Resolution precedence contract (Phase 9)

To keep parity with tab-scoped behavior in earlier phases, variable resolution must be deterministic:

1. Tab-level explicit override value (if literal and not tokenized)
2. Linked connection/profile value
3. Active environment variable set
4. Workspace default variable set

Notes:

- Resolution occurs in `useGrpcStudio` and workflow/harness adapters using one shared resolver utility.
- Execution uses immutable resolved snapshots at call start; switching environments mid-flight must not mutate running calls.
- `{{grpcHost}}` must resolve to `host:port` (no scheme) for native gRPC transport.

### Interpolation scope

Interpolation applies to:

- target address and port fields
- request body values (including nested objects/arrays)
- metadata values
- auth values (for example bearer token)
- saved collection requests when executed
- workflow/harness scenario inputs before serialization

Interpolation does not apply to structural keys such as field names, service names, method names, or `descriptorKey`.

### Failure and safety rules

- Unresolved required tokens fail fast before network call with category `serialization`/`validation` and actionable message.
- Provide escaping for literal braces (for example `\{{literal\}}`) to avoid accidental token expansion.
- Detect circular/self-referential variables and fail with explicit cycle error.
- Secret-backed variables follow Phase 4 redaction policy in logs/history/reports.
- Keep both raw template and resolved value in UI state for editability, but persist only template forms in saved requests.

### Resolver determinism and template persistence contract

- Resolver engine is shared across Studio, Workflow, Harness, and replay paths; no feature-specific interpolation forks.
- Resolution result for a given input snapshot and environment snapshot is deterministic and cacheable by fingerprint.
- Persisted entities (saved requests, workflow configs, harness scenarios) store template form only; resolved values are ephemeral runtime artifacts.
- Interpolation diagnostics include token path/context but never expose secret resolved values.
- Structural keys (`service`, `method`, `descriptorKey`, field names) are immutable to interpolation and validated pre-execution.

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 9A — Resolver contracts and token grammar freeze

Scope:
- Finalize token grammar, escaping rules, and supported value contexts.
- Define canonical error categories for interpolation failures.

Deliverables:
- Interpolation contract spec (token syntax, escape syntax, unsupported contexts).
- Error catalog (`missing_token`, `cycle`, `invalid_target`, `serialization`, `validation`).

Verification gates:
- Parser/grammar tests for normal and escaped templates.
- Contract tests for unsupported structural-key interpolation attempts.

Exit criteria:
- Token behavior is formally defined with no ambiguous parsing cases.

#### Phase 9B — Shared resolver engine implementation

Scope:
- Build one resolver utility consumed by Studio, Workflow, Harness, and replay layers.
- Support nested body/metadata/auth interpolation with immutable inputs.

Deliverables:
- Shared resolver module with path-aware traversal.
- Input/output typing helpers for resolved snapshot generation.

Verification gates:
- Unit tests for nested arrays/objects and mixed token/literal values.
- Cross-consumer parity tests (same input -> same output in all callers).

Exit criteria:
- All execution surfaces resolve templates identically.

#### Phase 9C — Precedence and environment snapshot binding

Scope:
- Implement precedence chain resolution and immutable environment snapshot binding.
- Ensure in-flight executions are insulated from environment switching.

Deliverables:
- Precedence evaluator (`tab override -> profile -> active env -> workspace default`).
- Snapshot binder attaching resolved context to execution request.

Verification gates:
- Tests for precedence collisions and override behavior.
- Tests proving environment switch affects only subsequent executions.

Exit criteria:
- Resolution precedence is deterministic and race-free.

#### Phase 9D — Target-specific validation (`grpcHost`/`grpcPort`)

Scope:
- Validate resolved target semantics for gRPC transport (`host:port`, no scheme).
- Provide actionable validation errors before network call.

Deliverables:
- Target validator for resolved endpoint fields.
- Validation message map with user-facing remediation hints.

Verification gates:
- Tests for missing/invalid host/port formats and illegal schemes.
- Tests for native/web parity on target validation outcomes.

Exit criteria:
- Invalid resolved targets are caught early with clear messages.

#### Phase 9E — Cycle detection and diagnostic safety

Scope:
- Implement cycle/self-reference detection in variable graphs.
- Emit safe diagnostics that avoid secret value disclosure.

Deliverables:
- Cycle detector with path trace output.
- Diagnostic sanitizer for secret-backed variables.

Verification gates:
- Cycle tests (direct, indirect, deep nested references).
- Secret-redaction tests for interpolation error payloads.

Exit criteria:
- Cycles are reliably detected and reported safely.

#### Phase 9F — Template persistence and replay compatibility

Scope:
- Enforce template-only persistence for collections/workflow/harness definitions.
- Ensure replay resolves templates at run time with current environment snapshot.

Deliverables:
- Persistence guards rejecting accidental resolved-value writes.
- Replay resolver path for saved request execution.

Verification gates:
- Storage tests proving only template forms are persisted.
- Replay tests verifying runtime re-resolution and deterministic snapshots.

Exit criteria:
- Persisted artifacts remain portable across environments without leaking resolved secrets.

#### Phase 9G — UI feedback, preview, and error UX

Scope:
- Provide user-visible interpolation preview and validation states.
- Add clear token-level error messaging without exposing secret values.

Deliverables:
- UI components/state for resolved-preview vs template view.
- Error banner/card patterns for interpolation failures.

Verification gates:
- UI tests for success/failure preview states and edge token paths.
- Accessibility tests for validation/error messaging controls.

Exit criteria:
- Users can understand resolution outcomes and fix templates quickly.

#### Phase 9H — Cross-phase integration verification

Scope:
- Validate interpolation behavior across Studio, Workflow (Phase 6), and Harness (Phase 8).
- Ensure saved request replay (Phase 5) and transport modes (Phase 10/7) consume identical resolved snapshots.

Deliverables:
- Cross-feature integration matrix and scenario suite.
- Contract checks for interpolation invariants in downstream phases.

Verification gates:
- End-to-end tests across mixed surfaces using same template inputs.
- Regression tests for escaped braces, nested tokens, and secret-backed variables.

Exit criteria:
- Interpolation semantics are uniform across all execution surfaces.

#### Phase 9I — Hardening gate before Phase 10

Scope:
- Final reliability/security pass for resolver determinism and data safety.
- Confirm acceptance checklist traceability to automated/manual tests.

Deliverables:
- Phase 9 validation report (precedence, cycles, persistence, cross-surface parity).
- Troubleshooting runbook for interpolation diagnostics.

Verification gates:
- No open P0/P1 issues in interpolation determinism, safety, or parity.
- CI green for Phase 9 unit/integration/E2E interpolation-tagged suites.

Exit criteria:
- Phase 9 is signed off and ready for Phase 10 transport expansion.

### Phase 9 execution order and dependency chain

`9A -> 9B -> 9C -> 9D -> 9E -> 9F -> 9G -> 9H -> 9I`

Notes:
- `9C` and `9D` can overlap once resolver contracts in `9A/9B` stabilize.
- `9E` should complete before finalizing user-facing diagnostics in `9G`.
- `9H` depends on stable replay/workflow/harness integrations from `9F` and existing phases.
- `9I` is a strict gate before Phase 10 starts.

### Phase 9 acceptance checklist

- Same input resolves identically across Studio call, Workflow node, and Harness scenario.
- Environment switch affects only subsequent calls; in-flight call keeps previous snapshot.
- Missing `grpcHost` blocks execution with clear validation error (not transport failure).
- Nested body/metadata/auth values interpolate correctly without mutating schema keys.
- Escaped braces remain literal and are not expanded.
- Secret variable values are never exposed in exported artifacts.

---

## Phase 10 — gRPC-Web Support

> **Goal:** Support gRPC-Web protocol, enabling Studio to call gRPC-Web endpoints directly from the browser without an HTTP/2 proxy.

> **Spring Boot note:** Spring gRPC's **Servlet mode** (`spring-grpc-server-web-spring-boot-starter`) exposes gRPC via HTTP POST to `/<ServiceName>/<MethodName>` over HTTP/1.1 inside a standard servlet container. This is functionally equivalent to gRPC-over-HTTP/1.1 and compatible with the gRPC-Web transport. Add a **"Spring Servlet Mode"** option in the transport selector that explicitly sets the path pattern to `/<service>/<method>` — this makes it clear to Spring users why Servlet mode requires a different transport.

### What is gRPC-Web

gRPC-Web is a standard (WHATWG Fetch-compatible) wire protocol that enables browser-native gRPC calls. It uses HTTP/1.1 with a special framing layer. An Envoy proxy (or grpc-web-proxy) typically sits between browser and gRPC server.

### Implementation

- New transport option in Studio: `gRPC` (HTTP/2 native proxy) vs `gRPC-Web` (HTTP/1.1 fetch) vs `Spring Servlet` (HTTP/1.1 POST to `/<service>/<method>`)
- gRPC-Web uses protobuf binary framing over `application/grpc-web+proto` content type
- Browser can call directly without Express proxy for gRPC-Web endpoints
- Supports: unary + server streaming (client-streaming and bidirectional are not supported by gRPC-Web spec)
- `protobufjs` or `@protobuf-ts` library for browser-side binary encoding/decoding

### Compatibility and execution contract (Phase 10)

- `gRPC-Web` and `Spring Servlet` transports must hard-block `client_streaming` and `bidi_streaming` at UI validation time.
- For unsupported call types, show deterministic error category `validation` (not runtime network failure).
- Unary/server-streaming calls preserve the same response envelope fields used by other transports (`grpcStatus`, `grpcStatusMessage`, headers/trailers, duration).
- Transport mode is snapshotted at execution start; changing selector mid-flight must not alter running call behavior.
- `Spring Servlet` path uses the resolved service/method from descriptors and includes package-qualified service names when required by server routing.

### Wire-level and browser constraints

- Support both `application/grpc-web+proto` and `application/grpc-web-text+proto` for proxy compatibility.
- Normalize gRPC-Web trailer extraction so `grpc-status` and `grpc-message` always map to standard status fields.
- Enforce CORS preflight requirements in docs/tooling hints (allowed headers must include grpc-web and metadata headers).
- Map transport/network errors to explicit categories: `cors`, `proxy_unreachable`, `protocol_mismatch`, `timeout`, `server_status`.
- Keep metadata key normalization and `-bin` base64 semantics consistent with Phase 4.

### Transport selector options

| Option | When to use |
|---|---|
| `gRPC` (default) | Standard gRPC over HTTP/2 — Go, Java Netty, Python, Rust tonic |
| `gRPC-Web` | Envoy/grpc-web-proxy in front of the server |
| `Spring Servlet` | Spring Boot with `spring-grpc-server-web-spring-boot-starter`; also works with `net.devh` servlet configs |
| `Tauri native` | Desktop only (Phase 7); bypasses Express proxy entirely |

Selection rules:

- Browser default remains `gRPC` (proxy-backed HTTP/2 path) for maximum feature parity.
- `gRPC-Web`/`Spring Servlet` are explicit opt-in modes.
- If a browser call in `gRPC-Web`/`Spring Servlet` fails with protocol mismatch, UI should suggest switching to `gRPC` proxy mode.

### Relevance

- Increasingly common: Envoy sidecar + gRPC-Web is a standard microservice pattern
- Spring Boot Servlet mode is a major use case — teams behind load balancers that don't support HTTP/2
- ezy (now abandoned) was one of few tools to support gRPC-Web; RedfireForge fills the gap
- Works without Tauri: enables full gRPC-Web testing in the browser build of RedfireForge

### Transport fallback and protocol-normalization contract

- Transport choice is part of immutable execution snapshot; selector changes never affect in-flight calls.
- For `gRPC-Web` and `Spring Servlet`, unsupported call types are blocked preflight with `validation` category before any network I/O.
- Protocol mismatch and proxy/CORS failures must map to stable categories and remediation hints (including one-click switch suggestion to `gRPC` proxy mode).
- Trailer/status normalization is transport-agnostic: downstream UI/workflow/harness always consumes canonical `grpcStatus`, `grpcStatusMessage`, headers, trailers.
- Metadata normalization and `-bin` semantics must match Phase 4 regardless of transport mode.

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 10A — Transport contracts and capability matrix freeze

Scope:
- Finalize mode capabilities (`gRPC`, `gRPC-Web`, `Spring Servlet`, desktop native boundary).
- Define call-type support matrix and preflight validation policy.

Deliverables:
- Capability matrix doc and validation rules per transport mode.
- Contract for mode-specific execution snapshot fields.

Verification gates:
- Contract tests for supported/unsupported callType combinations.
- Validation tests ensuring blocked modes fail before network request.

Exit criteria:
- No ambiguity in mode support and preflight behavior.

#### Phase 10B — Browser transport adapter and mode routing

Scope:
- Implement transport adapter selection in browser execution path.
- Route calls to proxy-backed gRPC vs direct grpc-web/servlet adapters.

Deliverables:
- Mode router module with deterministic dispatch.
- Adapter interface ensuring unified result envelope shape.

Verification gates:
- Integration tests for mode dispatch correctness.
- Snapshot tests for immutable mode binding at call start.

Exit criteria:
- Browser transport routing is deterministic and stable per execution.

#### Phase 10C — grpc-web binary/text framing support

Scope:
- Implement both binary and text grpc-web framing decode/encode paths.
- Normalize envelopes and trailers from both variants.

Deliverables:
- Framing codec layer for `application/grpc-web+proto` and `application/grpc-web-text+proto`.
- Canonical trailer/status extraction helpers.

Verification gates:
- Codec tests for mixed proxy implementations and framing variants.
- Parity tests proving equivalent canonical output from binary and text paths.

Exit criteria:
- grpc-web framing differences are fully abstracted behind canonical outputs.

#### Phase 10D — Spring Servlet mode path resolver

Scope:
- Implement service/method path mapping for Spring Servlet transport.
- Handle package-qualified service naming and routing edge cases.

Deliverables:
- Path resolver utility for `/<service>/<method>` patterns.
- Compatibility checks for Spring official and `net.devh` servlet configurations.

Verification gates:
- Integration tests against Spring servlet fixtures for qualified/unqualified service names.
- Error tests for unresolved path mapping scenarios.

Exit criteria:
- Spring Servlet mode resolves and routes method calls predictably.

#### Phase 10E — Error taxonomy, CORS/proxy diagnostics, and UX hints

Scope:
- Implement stable error categorization for browser transport failures.
- Surface actionable hints for protocol mismatch, CORS, and unreachable proxy.

Deliverables:
- Error mapper for `cors`, `proxy_unreachable`, `protocol_mismatch`, `timeout`, `server_status`.
- Hint strategy including mode-switch suggestions.

Verification gates:
- Integration tests for each error category and expected hint text.
- UI tests for deterministic hint visibility and non-noisy behavior.

Exit criteria:
- Transport failures are diagnosable and actionable for users.

#### Phase 10F — Metadata/auth/tls normalization parity

Scope:
- Ensure mode-independent normalization of metadata/auth/tls-derived behavior.
- Keep binary metadata and authorization precedence aligned with Phase 4.

Deliverables:
- Shared normalization path reused by all browser transport adapters.
- Parity checks between gRPC proxy mode and grpc-web/servlet modes.

Verification gates:
- Tests for metadata casing, `-bin` behavior, and auth override precedence across modes.
- Regression tests against Phase 4 secret/redaction rules.

Exit criteria:
- Transport mode changes do not alter metadata/auth semantics.

#### Phase 10G — Selector UX, persistence, and guardrails

Scope:
- Implement transport selector UX with sensible defaults and mode restrictions.
- Persist mode choice per tab/request context where appropriate.

Deliverables:
- Selector state model with tab-scoped persistence.
- Guardrails disabling unsupported modes/call types in UI.

Verification gates:
- UI tests for default mode behavior and tab isolation.
- Tests ensuring selector changes do not mutate in-flight call behavior.

Exit criteria:
- Transport selector behavior is clear, safe, and tab-scoped.

#### Phase 10H — Cross-surface parity verification

Scope:
- Verify canonical result envelope parity for Studio, Workflow, Harness consumers.
- Ensure downstream surfaces are transport-agnostic after normalization.

Deliverables:
- Parity test matrix across transport modes and consumer surfaces.
- Contract checks for `grpcStatus`, trailers, duration, headers across modes.

Verification gates:
- End-to-end tests for same scenario executed in different transport modes.
- Regression tests for workflow/harness assertions using grpc-web outputs.

Exit criteria:
- Downstream features consume uniform results regardless of transport mode.

#### Phase 10I — Hardening gate before Phase 11

Scope:
- Final reliability/security pass for browser transport modes.
- Confirm acceptance checklist traceability to tests and fixtures.

Deliverables:
- Phase 10 validation report (capabilities, errors, parity, spring servlet behavior).
- Operational runbook for grpc-web and servlet troubleshooting.

Verification gates:
- No open P0/P1 defects in mode routing, normalization, or diagnostics.
- CI green for Phase 10 unit/integration/E2E transport-tagged suites.

Exit criteria:
- Phase 10 is signed off and stable for Phase 11 advanced features.

### Phase 10 execution order and dependency chain

`10A -> 10B -> 10C -> 10D -> 10E -> 10F -> 10G -> 10H -> 10I`

Notes:
- `10C` and `10D` can overlap after transport contracts in `10A/10B` are fixed.
- `10E` should start as soon as baseline adapter errors are available from `10B/10C`.
- `10F` must complete before final parity verification in `10H`.
- `10I` is a strict gate before Phase 11 starts.

### Phase 10 acceptance checklist

- `client_streaming` and `bidi_streaming` are blocked for `gRPC-Web` and `Spring Servlet` with clear validation messaging.
- Unary and server-streaming responses preserve status/trailer mapping parity with other transports.
- `grpc-web-text` and binary grpc-web content modes interoperate with common Envoy/grpc-web-proxy setups.
- CORS/proxy failures are reported with actionable category-specific errors.
- Switching transport selector does not mutate in-flight call transport.
- Spring Servlet routing resolves service/method path correctly for package-qualified services.

---

## Phase 11 — Advanced Features

> **Goal:** Load testing, mock gRPC server, and proto schema diff. Addresses the feature gap vs all known competitors.

### Phase 11A — Load & Stress Testing

Powered by `ghz`-inspired logic (Go binary or Rust native):
- Configurable: concurrent workers, total calls, duration, ramp-up
- Metrics: p50/p95/p99 latency, calls/sec, error rate, status code distribution
- Real-time chart (latency histogram + throughput sparkline)
- Supports unary calls (streaming load test in a later iteration)
- Export results as JSON/CSV

Load test execution contract:

- Executes from immutable active-tab snapshot (`target`, `descriptorKey`, `service`, `method`, `body`, metadata/auth/tls).
- `callType` must be `unary` for Phase 11A; reject streaming call types with validation error.
- Safety limits: enforce max concurrency, max duration, and max total calls to avoid local resource exhaustion.
- Warm-up samples are excluded from percentile calculations.
- Export includes run config, resolved environment name, and timestamp for reproducibility.

Suggested load test result shape:

```ts
interface GrpcLoadTestResult {
  runId: string;
  startedAt: string;
  durationMs: number;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  callsPerSec: number;
  latencyMs: { p50: number; p95: number; p99: number; min: number; max: number; avg: number };
  statusDistribution: Record<string, number>; // grpc status code -> count
  errorSamples?: Array<{ grpcStatus?: number; message: string }>;
}
```

### Phase 11B — gRPC Mock Server

Based on proto schema (service + message types):
- Auto-generate mock responses from schema defaults + user-defined rules
- Rules: `method == "GetOrder" AND request.order_id == "123" → response { status: "FOUND", ... }`
- Runs as a separate in-process gRPC server (Rust `tonic` server on desktop; Go subprocess on web)
- Live rule sync: edit rules in UI, mock server reacts immediately

Rule evaluation contract:

- Rules evaluate in deterministic priority order (`priority` asc, then creation order).
- First matching enabled rule wins unless `fallthrough` is explicitly enabled.
- Matching context includes method, metadata, and request body expression predicates.
- If no rule matches, return configurable default (`UNIMPLEMENTED` by default) with optional default body.
- Rule evaluation and expression parsing must be sandboxed (no arbitrary code execution).

Mock runtime behavior:

- Unary and streaming call types can be mocked; streaming emits ordered message sequences with optional inter-message delay.
- Latency simulation uses `defaultLatencyMs` + bounded jitter and is deterministic when seed is provided.
- Hot rule updates must not break in-flight calls; new calls see latest committed rule set.
- Mock server lifecycle follows tab scope for execution, but process lifecycle is app-scoped with per-connection config resolution.

#### Per-tab behavior (aligned with GraphQL)

Mock server configuration must resolve from the active tab context, following the same inheritance model as GraphQL connection settings:

1. **Tab override** (`tab.mockConfig`) if explicitly set
2. **Linked connection/profile mock config** (`connectionId` / target-scoped)
3. **Workspace default mock config**

Execution and sync are **active-tab scoped**:
- Switching tabs immediately switches the effective mock rule set
- Running tab A cannot accidentally use tab B's rules
- Duplicating a tab copies mock override by value
- Closing a tab cleans up tab-local mock execution state

Storage keys:
- `grpc-mock-config-${resolvedTabConnectionId}` for connection-scoped config
- `grpc-mock-tab-override-${tabId}` for explicit per-tab override

Suggested utility parity with GraphQL (`tabConnectionResolution.ts`):
- `resolveGrpcTabConnection(tab, profiles, pageDefaults)`
- `resolveGrpcMockConnectionId(pageDefaultTarget, historyTarget, tabTarget, preferTabOverride)`
- `resolveGrpcTabMockConfig(tab, profile, pageDefaultMockConfig)`

### Phase 11C — Proto Schema Diff

- Compare two proto descriptor states (e.g., loaded from different branches)
- Highlights: added/removed/changed fields, renamed enums, breaking vs non-breaking changes
- Follows Buf's breaking change detection rules
- Useful for API review and regression detection in CI

Schema diff contract:

- Input supports any two descriptor sources (`reflection`, `proto_files`, `protoset`, `bsr`, `url_proto`).
- Output groups changes by severity: `breaking`, `non_breaking`, `informational`.
- Breaking examples: field removal, field number/type wire incompatibility, RPC signature changes.
- Non-breaking examples: adding optional fields, adding enum values (with compatibility caveat notes).
- Exportable report formats: JSON (machine-readable) and Markdown (PR review friendly).

Suggested diff output shape:

```ts
interface GrpcSchemaDiffReport {
  leftDescriptorKey: string;
  rightDescriptorKey: string;
  generatedAt: string;
  summary: { breaking: number; nonBreaking: number; informational: number };
  changes: Array<{
    severity: 'breaking' | 'non_breaking' | 'informational';
    entityType: 'service' | 'method' | 'message' | 'field' | 'enum' | 'enum_value';
    entityPath: string;
    changeType: string;
    description: string;
  }>;
}
```

### Advanced-features isolation and result contract

- Load testing, mock server, and schema diff operate on immutable run snapshots and must not mutate active tab request drafts.
- Phase 11 tools publish results into isolated namespaces (`loadTest`, `mockRuntime`, `schemaDiff`) to prevent cross-feature overwrite.
- Background operations (load tests, mock rule updates, diff generation) are cancellable and tab-safe.
- All exports (JSON/CSV/Markdown) must apply Phase 4 secret redaction and include source metadata for reproducibility.
- Errors are categorized per feature but normalized for UI consistency (`validation`, `runtime`, `timeout`, `io`, `internal`).

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 11A — Feature contracts and shared runtime boundaries

Scope:
- Freeze contracts for load-test, mock-server, and schema-diff modules.
- Define shared execution lifecycle, cancellation semantics, and result namespaces.

Deliverables:
- Cross-feature contract matrix and namespace ownership policy.
- Unified status/error model for advanced-feature operations.

Verification gates:
- Contract tests for namespace isolation and cancellation state transitions.
- Validation tests for feature-specific input schemas.

Exit criteria:
- No ambiguity in shared runtime boundaries or result ownership.

#### Phase 11B — Load-test config validation and scheduler core

Scope:
- Implement load-test config validation (unary-only, safety caps).
- Build run scheduler with bounded concurrency, duration, and stop conditions.

Deliverables:
- Config validator + safety limit enforcement.
- Scheduler/executor core with deterministic start/stop lifecycle.

Verification gates:
- Tests for limit enforcement, invalid configs, and run cancellation.
- Stress tests for bounded resource behavior.

Exit criteria:
- Load tests are safe, bounded, and predictable before metrics integration.

#### Phase 11C — Load-test metrics pipeline and export

Scope:
- Implement metric aggregation (latency percentiles, throughput, status distribution).
- Add JSON/CSV exports with reproducible run metadata.

Deliverables:
- Metrics aggregator and run summary serializer.
- Export builders including config, environment, and timestamp context.

Verification gates:
- Tests for percentile correctness and warm-up exclusion.
- Golden tests for JSON/CSV schema stability.

Exit criteria:
- Load-test outputs are accurate, reproducible, and consumable.

#### Phase 11D — Mock rule model and evaluator engine

Scope:
- Implement deterministic rule evaluation ordering and fallthrough semantics.
- Enforce sandboxed expression evaluation.

Deliverables:
- Rule evaluator core (`priority`, `enabled`, `fallthrough`, default response path).
- Sandbox boundary for predicate parsing/execution.

Verification gates:
- Tests for first-match behavior, fallthrough chains, and default responses.
- Security tests for blocked arbitrary code execution paths.

Exit criteria:
- Mock rule outcomes are deterministic and safe.

#### Phase 11E — Mock runtime lifecycle and hot-update behavior

Scope:
- Implement mock runtime lifecycle with per-connection config resolution.
- Support live rule updates without breaking in-flight calls.

Deliverables:
- Runtime manager for unary/stream mock execution.
- Hot-swap mechanism for rule set updates on new calls only.

Verification gates:
- Integration tests for in-flight stability during rule edits.
- Tests for latency/jitter simulation and optional seed determinism.

Exit criteria:
- Mock runtime is stable, live-editable, and lifecycle-safe.

#### Phase 11F — Schema diff engine and severity classification

Scope:
- Implement descriptor-to-descriptor diff engine with severity classification.
- Align breaking/non-breaking/informational logic with documented rules.

Deliverables:
- Diff comparator pipeline across all descriptor sources.
- Severity classifier for service/method/message/field/enum changes.

Verification gates:
- Test corpus for representative breaking and non-breaking changes.
- Consistency tests for diff output determinism across repeated runs.

Exit criteria:
- Diff classification is reliable and policy-consistent.

#### Phase 11G — Advanced feature UI surfaces and ergonomics

Scope:
- Build/align UI panels for load test, mock server, and schema diff.
- Ensure tab-scoped operation state, progress, cancellation, and result display.

Deliverables:
- `GrpcLoadTestPanel`, `GrpcMockServerPanel`, `GrpcSchemaDiffPanel` interaction flows.
- UI status model for running/completed/failed/cancelled operations.

Verification gates:
- UI tests for start/stop/cancel/result render paths.
- Performance checks for large result sets (high call counts, long diff lists).

Exit criteria:
- Advanced-feature workflows are usable, clear, and tab-safe.

#### Phase 11H — Cross-surface integration and export safety

Scope:
- Verify integration with collections/workflow/harness and history without cross-feature leakage.
- Ensure exports and logs remain redacted and reproducible.

Deliverables:
- Integration matrix across feature boundaries.
- Export safety layer with redaction + source metadata stamping.

Verification gates:
- End-to-end tests for invoking advanced features from saved/templated contexts.
- Secret-leak regression tests for all export types.

Exit criteria:
- Advanced features integrate safely with existing surfaces.

#### Phase 11I — Hardening gate before Phase 12

Scope:
- Final reliability/security/performance pass for all Phase 11 modules.
- Confirm acceptance checklist traceability and release readiness for Demo lessons.

Deliverables:
- Phase 11 validation report (load/mock/diff coverage + known limits).
- Troubleshooting runbook for advanced-feature operations.

Verification gates:
- No open P0/P1 defects in feature isolation, correctness, or export safety.
- CI green for Phase 11 unit/integration/E2E advanced-feature tagged suites.

Exit criteria:
- Phase 11 is signed off and stable for Phase 12 lesson integration.

### Phase 11 execution order and dependency chain

`11A -> 11B -> 11C -> 11D -> 11E -> 11F -> 11G -> 11H -> 11I`

Notes:
- `11B` and `11D` can overlap after contracts in `11A` are fixed.
- `11C` depends on scheduler outputs from `11B`; `11E` depends on evaluator outputs from `11D`.
- `11F` can run in parallel with load/mock paths once descriptor source contracts are stable.
- `11I` is a strict gate before Phase 12 starts.

### Phase 11 acceptance checklist

- Phase 11A rejects non-unary call types with clear validation feedback.
- Load-test exports contain full run config + reproducible metrics summary.
- Mock rule precedence is deterministic and stable across reloads.
- In-flight mocked calls are not disrupted by live rule edits.
- Schema diff correctly classifies representative breaking/non-breaking samples.
- Diff JSON/Markdown exports are generated and consumable by CI/PR workflows.

---

## Phase 12 — Demo Lessons & Demo Hub

> **Goal:** Guided interactive lessons for gRPC Studio in the Demo Hub, enabling onboarding and training.

### Proposed lesson roster (15)

| GRPC | id | Title | Key Concept | Requires |
|-----|-----|-------|-------------|----------|
| 1 | `grpc-first-call` | Your First gRPC Call | Unary RPC, service explorer | Phase 1 |
| 2 | `grpc-server-reflection` | Service Discovery with Reflection | Reflection API | Phases 1, 3 |
| 3 | `grpc-proto-import` | Importing Proto Files | Proto management | Phase 3 |
| 4 | `grpc-metadata` | Request Metadata & Headers | Metadata key-value | Phase 1 |
| 5 | `grpc-tls` | TLS & Secure Connections | TLS config panel | Phase 4 |
| 6 | `grpc-server-streaming` | Server Streaming RPC | Message log | Phase 2 |
| 7 | `grpc-client-streaming` | Client Streaming RPC | EOF / send multiple | Phase 2 |
| 8 | `grpc-bidi-streaming` | Bidirectional Streaming | Full duplex | Phase 2 |
| 9 | `grpc-collections` | Saving & Organizing Requests | Collections tree | Phase 5 |
| 10 | `grpc-env-variables` | Environments & Variables | `{{grpcHost}}` | Phase 9 |
| 11 | `grpc-workflow-integration` | gRPC in Workflows | Workflow node | Phase 6 |
| 12 | `grpc-load-testing` | Load Testing with gRPC Studio | ghz-style metrics | Phases 11B, 11C |
| 13 | `grpc-mock-server` | Mocking gRPC APIs | Rule-based mock responses | Phases 11D, 11E |
| 14 | `grpc-schema-diff` | Proto Schema Diff in CI | Breaking-change detection | Phase 11F |
| 15 | `grpc-spring-boot` | Spring Boot 4.1 + Spring gRPC | Netty vs Servlet transport behavior | Phases 1, 4, 10 |

Lesson format follows the same pattern as `graphql-lessons.ts` and `ws-lessons.ts` in `packages/demo-hub/src/lessons/protocols/`.

### Lesson runtime contract (Phase 12)

- Each lesson runs from a deterministic scenario snapshot (target, descriptor source, selected method, request payload, expected outcome).
- Steps are active-tab scoped; running or resetting lesson progress in one tab must not mutate other tabs.
- Lessons that depend on unfinished phases must be marked `locked` with a clear dependency message.
- Secret-bearing fields (tokens, api keys, passwords) must be redacted from lesson telemetry and exported progress artifacts.
- Lesson IDs are immutable once published to avoid progress migration breakage.

### Demo environment and fallback rules

- Demo Hub checks availability of required backend fixtures (Go server, Spring server, proxy) before allowing lesson execution.
- If fixture health checks fail, show actionable remediation hints instead of generic connection errors.
- Browser mode lessons that need unsupported transports/call types must either route via supported proxy path or remain locked.

### Lesson progress, telemetry, and fixture-safety contract

- Lesson progress state is isolated by lesson ID and workspace context; progress in one lesson must never mutate another lesson.
- Lesson runtime snapshots are immutable per run and include fixture version/fingerprint for reproducibility.
- Telemetry and exported lesson artifacts must redact all secret-bearing inputs and resolved variables.
- Lesson completion checks are deterministic and based on explicit step assertions, not timing heuristics.
- Fixture fallback behavior is explicit: when prerequisites are unavailable, lesson remains locked or degraded with clear remediation steps.

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 12A — Lesson contract model and authoring schema freeze

Scope:
- Finalize lesson schema, step types, checkpoints, and completion criteria model.
- Define versioning strategy for lesson content updates.

Deliverables:
- Canonical lesson definition schema for gRPC lessons.
- Versioning/migration policy for published lesson IDs.

Verification gates:
- Schema validation tests for all 15 lesson definitions.
- Backward-compat tests for lesson version updates.

Exit criteria:
- Lesson content contracts are stable and migration-safe.

#### Phase 12B — Lesson runtime engine integration

Scope:
- Implement lesson runner integration for deterministic step progression.
- Bind lesson runs to immutable scenario snapshots.

Deliverables:
- Runtime adapter from lesson step -> gRPC Studio actions/assertions.
- State machine for lesson states (idle/running/paused/completed/failed/locked).

Verification gates:
- Determinism tests for repeated runs with identical fixtures.
- Tests for resume/restart behavior and state transitions.

Exit criteria:
- Lesson execution flow is deterministic and recoverable.

#### Phase 12C — Progress persistence and isolation boundaries

Scope:
- Implement per-lesson progress persistence with workspace scoping.
- Ensure tab and lesson isolation for progress updates.

Deliverables:
- Progress storage model with lesson/workspace keys.
- Isolation guards preventing cross-lesson progress bleed.

Verification gates:
- Tests for concurrent lesson progress updates.
- Persistence tests across reload/session restore.

Exit criteria:
- Progress is stable, isolated, and resilient to reloads.

#### Phase 12D — Fixture discovery, health checks, and readiness gating

Scope:
- Implement fixture availability checks for Go server, Spring server, and required proxy paths.
- Gate lesson start by prerequisite health status.

Deliverables:
- Fixture health-check service and readiness summary UI.
- Mapping from lesson prerequisites to fixture capabilities.

Verification gates:
- Integration tests for healthy/unhealthy fixture states.
- Tests for locked/degraded lesson behavior on missing prerequisites.

Exit criteria:
- Lessons never run against unknown or invalid fixture conditions.

#### Phase 12E — Lesson UX flows and remediation guidance

Scope:
- Build guided step UI, callouts, validation hints, and remediation prompts.
- Ensure user can recover from expected mistakes without losing progress.

Deliverables:
- Lesson shell interactions (next/back/retry/reset/help).
- Contextual remediation copy for common failure categories.

Verification gates:
- UI tests for step navigation and retry/reset flows.
- Accessibility tests for callouts, focus order, and keyboard-only navigation.

Exit criteria:
- Lessons are clear, recoverable, and accessible.

#### Phase 12F — Locking/unlocking and dependency enforcement

Scope:
- Enforce phase dependency rules for lesson availability.
- Surface clear dependency reasons for locked lessons.

Deliverables:
- Dependency evaluator for lesson `Requires` metadata.
- Lock-state UI badges and explanatory messaging.

Verification gates:
- Tests for each lesson lock/unlock condition.
- Regression tests ensuring no premature unlocks.

Exit criteria:
- Lesson availability consistently matches prerequisite readiness.

#### Phase 12G — Telemetry, export, and redaction pipeline

Scope:
- Implement lesson telemetry/events and export reports with redaction.
- Ensure secret-safe diagnostics and reproducibility metadata.

Deliverables:
- Lesson analytics event schema + export serializer.
- Redaction layer for tokens, auth headers, and secret variables.

Verification gates:
- Secret leak tests for telemetry/export payloads.
- Contract tests for event schema consistency.

Exit criteria:
- Lesson observability is useful and safe by default.

#### Phase 12H — Lesson content validation and regression suite

Scope:
- Validate all lesson scripts against current product behavior and fixtures.
- Prevent drift between lesson instructions and actual UI/actions.

Deliverables:
- Automated lesson validation suite (script checks + smoke runs).
- Content linting rules for step assertions and IDs.

Verification gates:
- Full suite pass across all 15 lessons.
- Drift detection tests for renamed selectors/actions.

Exit criteria:
- Lesson content remains accurate and executable over time.

#### Phase 12I — Hardening gate before Phase 13

Scope:
- Final reliability pass for lesson engine, fixtures, and exports.
- Confirm acceptance checklist coverage and readiness for GA hardening phase.

Deliverables:
- Phase 12 validation report (completion determinism, lock logic, fixture readiness, telemetry safety).
- Operational runbook for lesson troubleshooting.

Verification gates:
- No open P0/P1 defects in lesson execution, isolation, or redaction.
- CI green for lesson runtime and content regression suites.

Exit criteria:
- Phase 12 is signed off and ready for Phase 13 production hardening.

### Phase 12 execution order and dependency chain

`12A -> 12B -> 12C -> 12D -> 12E -> 12F -> 12G -> 12H -> 12I`

Notes:
- `12C` and `12D` can overlap after runtime contracts from `12A/12B` are fixed.
- `12E` should begin once basic runtime and fixture gating are available (`12B/12D`).
- `12H` depends on stable lesson content contracts (`12A`) and UX/action surfaces (`12E/12F`).
- `12I` is a strict gate before Phase 13 starts.

### Phase 12 acceptance checklist

- Lesson roster and numbering are internally consistent (including Spring Boot lesson).
- Locked lessons correctly reflect unmet phase prerequisites.
- Per-tab lesson progress is isolated and survives workspace reload.
- Lesson completion criteria are deterministic and reproducible against provided fixtures.
- Redaction policy for secrets is enforced in lesson logs/exports.
- Demo fixtures for Go and Spring servers are documented and health-checkable from the UI.

---

## Phase 13 — Production Hardening & GA Readiness

> **Goal:** Ensure gRPC Studio is production-safe with clear SLOs, accessibility, reliability, and operational release gates before GA.

### Scope

- Performance budgets: descriptor load latency, unary p95 UI response time, and stream rendering throughput budgets.
- Reliability drills: proxy restarts, server disconnects, half-open stream cleanup, and retry/cancel correctness.
- Accessibility: keyboard navigation, focus order, screen-reader labels, color-contrast checks for all gRPC panels.
- Observability and diagnostics: structured logs, error categories, and anonymized usage metrics for key flows.
- Release gating: CI checks for core smoke tests, protocol regressions, and lesson integrity checks.

### GA hardening and release-governance contract

- GA decisions are evidence-based: each hardening area must publish measurable pass/fail artifacts (not narrative-only sign-off).
- SLO and reliability gates use fixed datasets/fixtures and stable measurement windows to avoid non-deterministic pass rates.
- Accessibility and redaction are release blockers, not optional post-GA improvements.
- Production diagnostics must preserve privacy: no secret-bearing request content in logs, telemetry, or exported artifacts.
- Rollback and kill-switch behavior is documented for every high-risk path (stream loops, proxy bridges, lesson runtime hooks).

### Detailed sub-phase plan (planning only; no implementation yet)

#### Phase 13A — SLO definitions, budgets, and measurement harness

Scope:
- Freeze performance SLO targets, budget thresholds, and measurement methodology.
- Define benchmark datasets and representative workloads for unary and streaming paths.

Deliverables:
- SLO specification document (p50/p95/p99 targets, error budgets, saturation thresholds).
- Reproducible measurement harness contract (fixtures, run window, machine profile assumptions).

Verification gates:
- Review pass for metric definitions and calculation formulas.
- Dry-run benchmark validations proving repeatability within tolerance bands.

Exit criteria:
- SLO budgets are unambiguous, reproducible, and automation-ready.

#### Phase 13B — Performance instrumentation and baseline capture

Scope:
- Add instrumentation for descriptor load, call execution, stream render throughput, and memory footprint.
- Capture baseline measurements across core gRPC workflows.

Deliverables:
- Performance telemetry hooks and baseline report per key flow.
- Regression threshold policy for CI performance checks.

Verification gates:
- Metric completeness tests (all required dimensions emitted).
- Baseline sanity checks across multiple runs and fixtures.

Exit criteria:
- Baselines exist and can detect meaningful regressions.

#### Phase 13C — Reliability failure-mode matrix and drills

Scope:
- Build fault matrix covering disconnects, proxy resets, partial failures, and cancellation races.
- Define expected recovery behavior and user-facing states.

Deliverables:
- Failure-mode catalog with expected transitions and timeout/cancel semantics.
- Drill scripts for deterministic failure injection.

Verification gates:
- Drill tests for orphan-stream prevention and stale-state cleanup.
- Assertions for retry/cancel correctness under concurrent operations.

Exit criteria:
- Reliability behavior is deterministic under documented fault conditions.

#### Phase 13D — Recovery and graceful-degradation controls

Scope:
- Specify recovery strategies for each failure class.
- Define degraded-mode UX and fallback indicators.

Deliverables:
- Recovery policy (backoff, reconnect, reset boundaries, user prompts).
- Graceful-degradation contract for unavailable transports/features.

Verification gates:
- Integration tests for degraded mode transitions and recovery exits.
- UX tests for actionable recovery messaging.

Exit criteria:
- Users can recover from expected failures without ambiguous state.

#### Phase 13E — Accessibility hardening and conformance

Scope:
- Validate keyboard-only navigation, focus management, semantic labeling, and contrast across gRPC surfaces.
- Enforce accessibility parity for advanced features and lesson flows.

Deliverables:
- Accessibility checklist mapped to critical journeys.
- Remediation backlog with severity classification and ownership.

Verification gates:
- Automated accessibility scans on primary pages/panels.
- Manual assistive-tech walkthroughs for high-risk interactions.

Exit criteria:
- No open critical accessibility blockers for GA journeys.

#### Phase 13F — Observability, diagnostics taxonomy, and redaction audit

Scope:
- Standardize diagnostics taxonomy across client/server/runtime surfaces.
- Audit telemetry/log/export streams for secret leakage.

Deliverables:
- Unified error/diagnostic schema and correlation policy.
- Redaction compliance report spanning logs, traces, and exports.

Verification gates:
- Contract tests for diagnostic category consistency.
- Secret-leak regression suite over representative payloads.

Exit criteria:
- Observability is actionable and privacy-safe.

#### Phase 13G — Release gating pipeline and policy automation

Scope:
- Encode hard release gates in CI for performance, reliability, accessibility, and lessons.
- Define gate ownership and escalation policy.

Deliverables:
- CI gate matrix with blocking/non-blocking tiers.
- Release checklist automation for pre-GA verification.

Verification gates:
- End-to-end CI dry runs validating gate behavior on pass/fail cases.
- Policy tests proving blockers fail release as expected.

Exit criteria:
- Release process is enforceable and auditable.

#### Phase 13H — Operational readiness, runbooks, and rollback drills

Scope:
- Prepare operational runbooks for incident triage and recovery.
- Validate rollback/kill-switch procedures for high-risk regressions.

Deliverables:
- On-call runbooks for common incident classes.
- Rollback and kill-switch playbook with decision thresholds.

Verification gates:
- Tabletop exercises for incident response flows.
- Rollback drill verification for minimal recovery time.

Exit criteria:
- Operational teams can respond and recover predictably.

#### Phase 13I — Final GA sign-off and post-GA guardrails

Scope:
- Aggregate evidence from all hardening tracks and perform final sign-off review.
- Define post-GA monitoring guardrails and stabilization window policy.

Deliverables:
- GA evidence pack (SLO, reliability, accessibility, observability, release gates).
- Post-GA watch plan (alerts, ownership, rollback triggers).

Verification gates:
- No open P0/P1 blockers in any hardening category.
- Executive/engineering sign-off checklist fully satisfied.

Exit criteria:
- Phase 13 is fully complete and GA-ready with enforceable post-release safeguards.

### Phase 13 execution order and dependency chain

`13A -> 13B -> 13C -> 13D -> 13E -> 13F -> 13G -> 13H -> 13I`

Notes:
- `13C` and `13E` can proceed in parallel once instrumentation/baselines from `13B` are available.
- `13F` should run continuously but is finalized before release gating in `13G`.
- `13H` starts after release policy is stable (`13G`) to ensure runbooks mirror actual gate behavior.
- `13I` is the strict final gate before GA release approval.

### Phase 13 acceptance checklist

- SLO budgets are documented and validated by automated checks.
- Failure-mode drills pass without orphaned streams or stale UI state.
- Accessibility audits pass for critical user journeys (connect, call, stream, save, lesson run).
- Error telemetry is categorized and redaction-safe.
- GA release checklist is codified and repeatable in CI.

---

## Phase Dependency Map

```
Phase 1 (Core Unary) ──────────────────────────────────┐
   │                                                    │
   ├─► Phase 2 (Streaming)                              │
   │       │                                            │
   │       └─► Phase 6 (Workflow) ─► Phase 8 (Harness) │
   │                                                    │
  ├─► Phase 3 (Proto Mgmt) ─► Phase 10 (gRPC-Web)     │
   │       │                                            │
  │       └─► Phase 11F (Schema Diff)                  │
   │                                                    │
   ├─► Phase 4 (TLS / Auth)                             │
   │                                                    │
   ├─► Phase 5 (Collections) ─► Phase 8 (Harness)      │
   │                                                    │
   ├─► Phase 7 (Tauri tonic) [parallel to Phase 1/2]    │
   │                                                    │
   ├─► Phase 9 (Env Vars) [after Phase 1]               │
   │                                                    │
  └─► Phase 11B-E (Load Testing / Mock) [after Phase 2]│
                                                        │
Phase 12 (Demo Lessons) ◄──────────────────────────────┐
  (base lessons require Phases 1-9; full roster requires Phases 10-11)
                                                       │
Phase 13 (Production Hardening) ◄──────────────────────┘
  (requires Phases 1-12 for GA sign-off)
```

Minimum viable product = **Phases 1–5 + 9** (core unary + all streaming + proto management + TLS + collections + env vars).

---

## File Map

> Projected layout when all phases are complete.

| Area | Path |
|---|---|
| Studio page | `src/features/grpc/GrpcStudioPage.tsx` |
| Service explorer | `src/features/grpc/components/GrpcServiceExplorer.tsx` |
| Call panel | `src/features/grpc/components/GrpcCallPanel.tsx` |
| Form builder | `src/features/grpc/components/GrpcProtoFormBuilder.tsx` |
| Response panel | `src/features/grpc/components/GrpcResponsePanel.tsx` |
| Stream message log | `src/features/grpc/components/GrpcStreamMessageLog.tsx` |
| TLS panel | `src/features/grpc/components/GrpcTlsPanel.tsx` |
| Auth panel | `src/features/grpc/components/GrpcAuthPanel.tsx` |
| Collections panel | `src/features/grpc/components/GrpcCollectionsPanel.tsx` |
| Load test panel | `src/features/grpc/components/GrpcLoadTestPanel.tsx` |
| Mock server panel | `src/features/grpc/components/GrpcMockServerPanel.tsx` |
| Proto diff panel | `src/features/grpc/components/GrpcSchemaDiffPanel.tsx` |
| Primary hook | `src/features/grpc/hooks/useGrpcStudio.ts` |
| Proto form hook | `src/features/grpc/hooks/useGrpcProtoForm.ts` |
| Stream hook | `src/features/grpc/hooks/useGrpcStream.ts` |
| TLS hook | `src/features/grpc/hooks/useGrpcTls.ts` |
| Collections hook | `src/features/grpc/hooks/useGrpcCollections.ts` |
| Slice | `src/features/grpc/grpcStudioSlice.ts` |
| Selectors | `src/shared/selectors/grpc.ts` |
| Type definitions | `src/shared/grpc/contracts.ts` |
| Server routes | `src-server/routes/grpc/grpc-routes.ts` |
| gRPC client | `src-server/grpc/grpcClient.ts` |
| Descriptor loader | `src-server/grpc/descriptorLoader.ts` |
| Reflection client | `src-server/grpc/reflectionClient.ts` |
| Proto file manager | `src-server/grpc/protoFileManager.ts` |
| Workflow node handlers | `src/features/workflow/engine/graphRunnerGrpcNodeHandlers.ts` |
| Workflow node configs | `src/features/workflow/components/nodes/grpc/` |
| Tauri Rust module | `src-tauri/src/grpc/` (mod.rs, client.rs, stream.rs, tls.rs) |
| Demo lessons | `packages/demo-hub/src/lessons/protocols/grpc-lessons.ts` |
| Docker test server | `docker/grpc/` (Go server with reflection + streaming methods) |
| E2E specs | `e2e/grpc-*.spec.ts` |

---

## Type Definitions

```ts
// src/shared/grpc/contracts.ts

export type GrpcCallType = 'unary' | 'server_streaming' | 'client_streaming' | 'bidi_streaming';
export type GrpcDescriptorSource = 'reflection' | 'proto_files' | 'protoset' | 'bsr' | 'url_proto';
export type GrpcTlsMode = 'disabled' | 'tls' | 'mtls';
export type GrpcAuthType = 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2';

export interface GrpcTarget {
  address: string;              // "host:port"
  tlsMode: GrpcTlsMode;
  tlsConfig?: GrpcTlsConfig;
}

export interface GrpcTlsConfig {
  serverCaPem?: string;         // override root CA
  clientCertPem?: string;       // mTLS client cert
  clientKeyPem?: string;        // mTLS client key
  serverNameOverride?: string;
}

export interface GrpcDescriptor {
  source: GrpcDescriptorSource;
  key: string;                  // cache key for the loaded descriptor set
  sourceRef?: string;           // source identity (e.g., bsr://module:ref, https://...)
  contentSha256?: string;       // descriptor content hash for cache invalidation
  services: GrpcServiceInfo[];
}

export interface GrpcServiceInfo {
  fullName: string;             // "com.example.OrderService"
  methods: GrpcMethodInfo[];
}

export interface GrpcMethodInfo {
  name: string;                 // "CreateOrder"
  callType: GrpcCallType;
  requestTypeName: string;      // "com.example.CreateOrderRequest"
  responseTypeName: string;     // "com.example.CreateOrderResponse"
  requestSchema: GrpcMessageSchema;
  responseSchema: GrpcMessageSchema;
  docComment?: string;
}

export interface GrpcMessageSchema {
  typeName: string;
  fields: GrpcFieldSchema[];
}

export interface GrpcFieldSchema {
  name: string;
  number: number;
  type: GrpcFieldType;
  label: 'optional' | 'repeated' | 'required';
  messageTypeName?: string;     // if type === 'message'
  enumTypeName?: string;        // if type === 'enum'
  enumValues?: { name: string; number: number }[];
  docComment?: string;
  isOneofMember?: boolean;
  oneofName?: string;
}

export type GrpcFieldType =
  | 'bool' | 'bytes' | 'string'
  | 'int32' | 'int64' | 'uint32' | 'uint64' | 'sint32' | 'sint64'
  | 'fixed32' | 'fixed64' | 'sfixed32' | 'sfixed64'
  | 'float' | 'double'
  | 'enum' | 'message'
  | 'google.protobuf.Timestamp'       // well-known → datetime picker
  | 'google.protobuf.Duration'        // well-known → duration input
  | 'google.protobuf.Any'             // well-known → raw JSON
  | 'google.protobuf.Struct'          // well-known → raw JSON object
  | 'google.protobuf.Value'           // well-known → JSON value
  | 'google.protobuf.BoolValue'       // well-known nullable scalar
  | 'google.protobuf.StringValue'
  | 'google.protobuf.Int32Value'
  | 'google.protobuf.Int64Value';

export interface GrpcCallRequest {
  callType: 'unary' | 'server_streaming' | 'client_streaming' | 'bidi_streaming';
  requestId: string;
  target: GrpcTarget;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata?: Record<string, string>; // keys normalized lowercase; *-bin values are base64
  auth?: GrpcAuthConfig;
  timeoutMs?: number;
  descriptorKey: string;
}

export interface GrpcCallResult {
  callType: GrpcCallType;
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  trailers: Record<string, string>;
  body?: Record<string, unknown>;       // unary
  messages?: Record<string, unknown>[]; // streaming
  durationMs: number;
  errorDetail?: string;
}

export interface GrpcLoadTestConfig {
  requestId: string;
  target: GrpcTarget;
  descriptorKey: string;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata?: Record<string, string>;
  auth?: GrpcAuthConfig;
  tlsConfig?: GrpcTlsConfig;
  concurrency: number;
  totalCalls?: number;
  durationMs?: number;
  rampUpMs?: number;
  warmupCalls?: number;
}

export interface GrpcLoadTestResult {
  runId: string;
  startedAt: string;
  durationMs: number;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  callsPerSec: number;
  latencyMs: { p50: number; p95: number; p99: number; min: number; max: number; avg: number };
  statusDistribution: Record<string, number>;
  errorSamples?: Array<{ grpcStatus?: number; message: string }>;
}

export interface GrpcSchemaDiffChange {
  severity: 'breaking' | 'non_breaking' | 'informational';
  entityType: 'service' | 'method' | 'message' | 'field' | 'enum' | 'enum_value';
  entityPath: string;
  changeType: string;
  description: string;
}

export interface GrpcSchemaDiffReport {
  leftDescriptorKey: string;
  rightDescriptorKey: string;
  generatedAt: string;
  summary: { breaking: number; nonBreaking: number; informational: number };
  changes: GrpcSchemaDiffChange[];
}

export interface GrpcSavedRequest {
  id: string;
  name: string;
  callType: GrpcCallType;
  target?: GrpcTarget;            // optional if resolved via environment/profile at run time
  descriptorKey: string;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata: Record<string, string>;
  auth?: GrpcAuthConfig;
  tlsConfig?: GrpcTlsConfig;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrpcCollection {
  id: string;
  name: string;
  target?: string;                // optional default target token, e.g. "{{grpcHost}}"
  descriptorSource: GrpcDescriptorSource;
  requests: GrpcSavedRequest[];
}

export interface GrpcMockRule {
  id: string;
  priority?: number;
  callType?: GrpcCallType;
  method?: string;
  when?: string;
  responseStatus?: number;
  responseBody?: Record<string, unknown>;
  responseHeaders?: Record<string, string>;
  streamMessages?: Array<Record<string, unknown>>;
  interMessageDelayMs?: number;
  fallthrough?: boolean;
  enabled: boolean;
}

export interface GrpcMockConfig {
  connectionId: string;
  enabled: boolean;
  rules: GrpcMockRule[];
  defaultResponseStatus?: number;
  defaultResponseBody?: Record<string, unknown>;
  defaultLatencyMs?: number;
  jitterMs?: number;
  seed?: number;
}

export interface GrpcStudioTab {
  id: string;
  title: string;
  target?: string;
  connectionId?: string;
  service?: string;
  method?: string;
  // undefined = inherit connection/workspace mock config; object = explicit per-tab override
  mockConfig?: GrpcMockConfig;
}

export interface GrpcAuthConfig {
  type: GrpcAuthType;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  oauth2?: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
  };
}
```

---

## Open Questions / Risks

| # | Question | Risk | Proposed Resolution |
|---|---|---|---|
| OQ-1 | `@grpc/grpc-js` does not support dynamic method invocation without generated stubs in Node.js. Does `grpc-js` support raw binary framing with dynamic proto encoding? | High | Use `protobufjs` for serialization + `@grpc/grpc-js` with `makeUnaryRequest` and raw Buffer. Validated by grpcui (Go), needs prototyping in JS. |
| OQ-2 | Server Reflection v1 vs v1alpha — which version to prefer? | Low | Try v1 first (grpc.reflection.v1), fall back to v1alpha. Same strategy as grpcui and grpcurl. |
| OQ-3 | Large proto files with many imports may cause descriptor resolution failures. | Medium | Cache resolved `FileDescriptorPool` in session. Allow user to upload transitive dependencies. Bundle Google WKT protos. |
| OQ-4 | `prost-reflect` (Rust) adds ~2MB to the Tauri binary for dynamic proto parsing. | Low | Acceptable. Bundle all Google WKT protos as bytes in the binary. |
| OQ-5 | gRPC-Web requires an Envoy/grpc-web-proxy between Studio and the backend. How do we handle plain HTTP/2 gRPC endpoints from the browser? | Medium | Browser uses proxy-backed `gRPC` mode for plain HTTP/2 endpoints. Use direct `gRPC-Web`/`Spring Servlet` transport only when backend interface is compatible. Provide transport-switch hint on protocol mismatch. |
| OQ-6 | Client streaming and bidirectional streaming require the Express server to hold a live gRPC connection across multiple HTTP requests. Memory and connection lifecycle management. | Medium | Stream registry pattern (same as WebSocket Studio). `Map<streamId, GrpcStream>` with cleanup on disconnect/timeout. |
| OQ-7 | How to handle `google.protobuf.Any` in the form builder? | Medium | Show a raw JSON text area with type URL hint. Advanced: allow users to pick a type from the loaded descriptor pool. |
| OQ-8 | 64-bit integer precision loss in JSON (JavaScript `number` only handles 53-bit integers). | Medium | Follow the same approach as ezy: wrap int64/uint64 values in JSON strings. Display as strings in the form; parse on serialize. |

---

## Docker Test Server

The E2E test suite requires a real gRPC server with:
- **Server Reflection** enabled (both v1 and v1alpha)
- **Unary**, **server streaming**, **client streaming**, **bidirectional** methods
- **TLS** and **mTLS** variants
- Known proto schema for deterministic assertions

Proposed: Go gRPC server in `docker/grpc/` exposing:
```
service EchoService {
  rpc Echo (EchoRequest) returns (EchoResponse);                  // unary
  rpc ServerStream (EchoRequest) returns (stream EchoResponse);   // server streaming
  rpc ClientStream (stream EchoRequest) returns (EchoResponse);   // client streaming
  rpc BidiStream (stream EchoRequest) returns (stream EchoResponse); // bidi
}

service OrderService {
  rpc CreateOrder (CreateOrderRequest) returns (CreateOrderResponse);
  rpc GetOrder (GetOrderRequest) returns (GetOrderResponse);
  rpc ListOrders (ListOrdersRequest) returns (stream Order);
}
```

Both services registered with `grpc.reflection.v1.ServerReflection`.

### Spring Boot test server (Phase 12 / Demo)

For the Spring Boot lesson (Phase 12, Lesson 15), add a second Docker service: a **Spring Boot 4.1 + Spring gRPC** server at port **9090** with:
- `spring-grpc-spring-boot-starter` (official, not net.devh)
- Same `EchoService` and `OrderService` proto schema
- Server Reflection v1 enabled (`io.grpc:grpc-services` on classpath)
- Spring Actuator health (`/actuator/health` + gRPC health service with `db` and `diskSpace` indicator names)
- Spring Security: `SayHello` requires `ROLE_USER` Bearer JWT; `Echo` open
- Both Netty mode (port 9090) and Servlet mode (port 8080) containers

```yaml
# docker/grpc/docker-compose.yml
services:
  grpc-go:
    build: ./go-server
    ports: ["50051:50051"]
  grpc-spring-boot:
    build: ./spring-boot-server
    ports:
      - "9090:9090"   # Netty native gRPC
      - "8080:8080"   # Servlet mode (HTTP/1.1 + Spring MVC)
```

This lets Phase 12 demos show the concrete difference between connecting to `:50051` (Go server, standard) vs `:9090` (Spring Boot, quick-connect profile).

---
