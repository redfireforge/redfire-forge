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
16. [Phase 11 — Advanced Features (Load Testing, Mock Server, Reflection Diff)](#phase-11--advanced-features)
17. [Phase 12 — Demo Lessons & Demo Hub](#phase-12--demo-lessons--demo-hub)
18. [Phase Dependency Map](#phase-dependency-map)
19. [File Map](#file-map)
20. [Type Definitions](#type-definitions)
21. [Open Questions / Risks](#open-questions--risks)

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

### 1. Descriptor source priority: Reflection → Proto Files → Protoset

gRPC Studio must discover service/method schemas before it can build form inputs or serialize requests. Priority order:

1. **Server Reflection** (gRPC reflection v1 / v1alpha) — works at runtime with no files needed; widely supported by grpc-go, Java, Python etc.
2. **`.proto` source files** — user uploads one or more `.proto` files; Studio resolves imports automatically or via an import-path list
3. **Protoset binary** — pre-compiled `FileDescriptorSet` produced by `protoc --descriptor_set_out`; zero proto toolchain needed at runtime

This mirrors how `grpcui` and `grpcurl` work, which developers already understand.

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
| **12** — Demo Lessons | 12+ guided demo lessons in Demo Hub | 🔲 Not started | ~60 |

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
│ Service Tree │  Target: [grpc.example.com:50051_____] [Connect] │
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

### Request shape (Phase 1)

```ts
// POST /api/grpc/call
interface GrpcCallRequest {
  target: string;           // "host:port"
  service: string;          // "com.example.OrderService"
  method: string;           // "CreateOrder"
  body: Record<string, unknown>;    // JSON-encoded proto message
  metadata?: Record<string, string>;
  tlsConfig?: GrpcTlsConfig;
  timeoutMs?: number;       // default 30000
  encodingSource: 'reflection' | 'proto_files' | 'protoset';
  descriptorKey?: string;   // cached descriptor set key in session
}

// Response envelope
interface GrpcCallResult {
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

### Message log UI

- Same virtualized rendering pattern as WebSocket Studio (`@tanstack/react-virtual`)
- Message rows: `↓` = server message, `↑` = client message
- Timestamp, sequence number, JSON body (expandable)
- Stream status bar: active / ended / cancelled / error
- "End Stream" button (client/bidi only, disabled for server-streaming)
- Cap: 10,000 messages (configurable)

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

### Schema Registry browser

A dedicated sub-tab shows all loaded services, with:
- Package hierarchy tree
- Message type list (all message types in scope, not just top-level request/response)
- Field-level documentation from proto comments
- Enum values
- Service method signatures (`rpc Foo(Bar) returns (stream Baz)`)
- "Copy as grpcurl" shortcut

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
| gRPC `ALTS` | Enterprise (Phase 4 deferred) | `@PreAuthorize` + GCP service account |

Auth config stored per saved connection profile.

### Health Check panel — Spring Actuator hint

When the gRPC server returns `NOT_SERVING` or health call fails:
- Standard empty service name `""` = overall server health
- **Spring-specific named services**: add a tooltip/hint — *"Spring Boot apps expose Actuator health as named gRPC health services (e.g. `db`, `redis`, `diskSpace`). Enter the indicator name to check a specific component."*

### PERMISSION_DENIED response hint

When gRPC Studio receives status code **7 (PERMISSION_DENIED)**:
- Show a dismissible info card: *"Status 7 PERMISSION_DENIED — if this is a Spring Boot server, the endpoint may be protected by `@PreAuthorize`. Check the required role or scope and ensure your Bearer token includes it."*

---

## Phase 5 — Saved Requests, Collections & History

> **Goal:** Users can save and organize gRPC requests by service + method, with a recent call history and grpcurl interop.

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

### grpcurl Import / Export

- **Import**: parse `grpcurl -d '{"field":"value"}' host:port Service/Method` command line into Studio form
- **Export**: "Copy as grpcurl" button on any saved request / active call
- Supports `-plaintext`, `-H`, `-cert`, `-key`, `-cacert` flags

---

## Phase 6 — Workflow Integration

> **Goal:** gRPC calls can be used as workflow nodes, enabling multi-step test scenarios mixing gRPC with HTTP, Kafka, WebSocket, etc.

### New workflow node types

| Node Type | Config Panel | Description |
|---|---|---|
| `grpcUnary` | `GrpcUnaryNodeConfig` | Execute a unary gRPC call; store response in variables |
| `grpcServerStream` | `GrpcServerStreamNodeConfig` | Collect N streaming messages (or until condition); assert on each |
| `grpcAssert` | `GrpcAssertNodeConfig` | Assert on a stored gRPC response (status, field values) |

### Variables

- `{{grpc.response.body.fieldName}}` — extract field from last gRPC response
- `{{grpc.response.status}}` — gRPC status code integer
- `{{grpc.stream[0].body.fieldName}}` — message at index from last server stream

### Integration with existing infrastructure

- Node handlers go in `src/features/workflow/engine/graphRunnerGrpcNodeHandlers.ts`
- Config panels in `src/features/workflow/components/nodes/grpc/`
- Results explorer shows gRPC response body + stream messages in the Results tab

---

## Phase 7 — Tauri Native Transport (tonic)

> **Goal:** On desktop, bypass the Express proxy and use Rust `tonic` for true HTTP/2 gRPC with event-driven streaming.

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

---

## Phase 8 — Test Runner Integration & Assertions

> **Goal:** gRPC calls can be defined as test scenarios in the harness, with proto-typed field assertions and status code checks.

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

### Data source expansion

gRPC scenarios participate in the same CSV/JSON data source expansion as HTTP scenarios, enabling parameterized gRPC testing across multiple input rows.

---

## Phase 9 — Environment Variable Interpolation

> **Goal:** `{{grpcHost}}`, `{{grpcPort}}`, and other environment tokens are resolved from the active environment before each call.

The environment manager already defines `{{grpcHost}}` as a `host:port` string (see `environment-manager-expansion-plan.md` §gRPC tab). This phase wires it up in the Studio:

- Target address field shows `{{grpcHost}}` by default
- Resolution happens in `useGrpcStudio` hook, same as `useKafkaState` / WebSocket environment resolution
- Fallback: if no `grpcHost` is set in the active environment, show validation warning
- `{{grpcPort}}` optionally resolved separately if a `host`-only variant is preferred
- All saved collection request bodies also support `{{variable}}` interpolation

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

### Transport selector options

| Option | When to use |
|---|---|
| `gRPC` (default) | Standard gRPC over HTTP/2 — Go, Java Netty, Python, Rust tonic |
| `gRPC-Web` | Envoy/grpc-web-proxy in front of the server |
| `Spring Servlet` | Spring Boot with `spring-grpc-server-web-spring-boot-starter`; also works with `net.devh` servlet configs |
| `Tauri native` | Desktop only (Phase 7); bypasses Express proxy entirely |

### Relevance

- Increasingly common: Envoy sidecar + gRPC-Web is a standard microservice pattern
- Spring Boot Servlet mode is a major use case — teams behind load balancers that don't support HTTP/2
- ezy (now abandoned) was one of few tools to support gRPC-Web; RedfireForge fills the gap
- Works without Tauri: enables full gRPC-Web testing in the browser build of RedfireForge

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

### Phase 11B — gRPC Mock Server

Based on proto schema (service + message types):
- Auto-generate mock responses from schema defaults + user-defined rules
- Rules: `method == "GetOrder" AND request.order_id == "123" → response { status: "FOUND", ... }`
- Runs as a separate in-process gRPC server (Rust `tonic` server on desktop; Go subprocess on web)
- Live rule sync: edit rules in UI, mock server reacts immediately

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

---

## Phase 12 — Demo Lessons & Demo Hub

> **Goal:** Guided interactive lessons for gRPC Studio in the Demo Hub, enabling onboarding and training.

### Proposed lesson roster (12)

| GRPC | id | Title | Key Concept |
|-----|-----|-------|-------------|
| 1 | `grpc-first-call` | Your First gRPC Call | Unary RPC, service explorer |
| 2 | `grpc-server-reflection` | Service Discovery with Reflection | Reflection API |
| 3 | `grpc-proto-import` | Importing Proto Files | Proto management |
| 4 | `grpc-metadata` | Request Metadata & Headers | Metadata key-value |
| 5 | `grpc-tls` | TLS & Secure Connections | TLS config panel |
| 6 | `grpc-server-streaming` | Server Streaming RPC | Message log |
| 7 | `grpc-client-streaming` | Client Streaming RPC | EOF / send multiple |
| 8 | `grpc-bidi-streaming` | Bidirectional Streaming | Full duplex |
| 9 | `grpc-collections` | Saving & Organizing Requests | Collections tree |
| 10 | `grpc-env-variables` | Environments & Variables | `{{grpcHost}}` |
| 11 | `grpc-workflow-integration` | gRPC in Workflows | Workflow node |
| 12 | `grpc-load-testing` | Load Testing with gRPC Studio | ghz-style metrics |

Lesson format follows the same pattern as `graphql-lessons.ts` and `ws-lessons.ts` in `packages/demo-hub/src/lessons/protocols/`.

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
   │       └─► Phase 11C (Schema Diff)                  │
   │                                                    │
   ├─► Phase 4 (TLS / Auth)                             │
   │                                                    │
   ├─► Phase 5 (Collections) ─► Phase 8 (Harness)      │
   │                                                    │
   ├─► Phase 7 (Tauri tonic) [parallel to Phase 1/2]    │
   │                                                    │
   ├─► Phase 9 (Env Vars) [after Phase 1]               │
   │                                                    │
   └─► Phase 11A/B (Load Testing / Mock) [after Phase 2]│
                                                        │
Phase 12 (Demo Lessons) ◄──────────────────────────────┘
  (requires Phases 1–9 complete)
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
export type GrpcDescriptorSource = 'reflection' | 'proto_files' | 'protoset' | 'bsr';
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
  target: GrpcTarget;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata?: Record<string, string>;
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

export interface GrpcSavedRequest {
  id: string;
  name: string;
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
  target: string;
  descriptorSource: GrpcDescriptorSource;
  requests: GrpcSavedRequest[];
}

export interface GrpcMockRule {
  id: string;
  method?: string;
  when?: string;
  responseStatus?: number;
  responseBody?: Record<string, unknown>;
  enabled: boolean;
}

export interface GrpcMockConfig {
  connectionId: string;
  enabled: boolean;
  rules: GrpcMockRule[];
  defaultLatencyMs?: number;
  jitterMs?: number;
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
| OQ-5 | gRPC-Web requires an Envoy/grpc-web-proxy between Studio and the backend. How do we handle plain HTTP/2 gRPC endpoints from the browser? | Medium | For browser, always use the Express proxy (same as Phase 1). gRPC-Web Phase 10 only applies to endpoints that already expose a gRPC-Web compatible interface. Document clearly. |
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
