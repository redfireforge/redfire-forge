# WebSocket Studio — Implementation Plan

> Branch: `feature/websocket-studio`
> Created: 2026-06-07
> Status: **✅ Phases 1–19 Complete** — All 19 phases implemented (1261 WS + 47 SSE tests, 0 type errors)
> Next: All planned phases complete (see [Deferred & Future Items](#deferred--future-items) for sub-phase roadmap)

---

## Table of Contents

1. [Overview](#overview)
2. [Competitive Landscape](#competitive-landscape)
3. [Design Decisions](#design-decisions)
4. [Phase Status Dashboard](#phase-status-dashboard)
5. [Phase 1 — Core Connect & Send/Receive](#phase-1--core-connect--sendreceive)
6. [Phase 2 — Saved Connections, Templates & Auto-Reconnect](#phase-2--saved-connections-templates--auto-reconnect)
7. [Phase 3 — Protocol Support](#phase-3--protocol-support)
8. [Phase 4 — Workflow Integration](#phase-4--workflow-integration)
9. [Phase 5 — Runner & Assertions](#phase-5--runner--assertions)
10. [Phase 6 — Tauri Native Transport](#phase-6--tauri-native-transport)
11. [Phase 7 — Environment Variable Interpolation](#phase-7--environment-variable-interpolation)
12. [Phase 8 — Virtualized Message Log](#phase-8--virtualized-message-log)
13. [Phase 9 — Multiple Concurrent Connections](#phase-9--multiple-concurrent-connections)
14. [Phases 10–13 (Completed)](#phases-1013-completed)
15. [Future Phases (14–19)](#future-phases-1419)
16. [File Map](#file-map)
17. [Manual Testing Guide](#manual-testing-guide)
18. [Deferred & Future Items](#deferred--future-items)

---

## Overview

**WebSocket Studio** is a standalone, interactive debug tool for connecting to WebSocket endpoints, sending messages, and inspecting received messages in real time — analogous to how **Kafka Studio** works for Kafka brokers.

It is a **first-class page** under the Protocols domain where developers can:

- Connect to any `ws://` or `wss://` endpoint with custom headers, query params, and subprotocols
- Send text or binary messages and see responses in a live, auto-scrolling message log
- Save connection profiles and message templates for reuse
- Use Socket.IO, STOMP, and GraphQL-WS protocol codecs with auto-handshake
- Integrate with the workflow engine (connect/send/receive/trigger nodes)
- Run WebSocket scenarios in the test harness with full assertion support
- Use native Tauri transport on desktop (no Express proxy dependency)
- Open multiple concurrent connection tabs

| HTTP world | Kafka world | WebSocket world |
|---|---|---|
| Requests page | Publish Studio | Send Panel + Message Log |
| Catalog | Templates | Saved Connections |
| Environments | Kafka Settings | Connection Profiles |

### Navigation

```
Activity Bar: API | Workflow | Harness | Gallery | Protocols | Settings

Protocols sub-nav:
  kafka-message-studio → "Kafka"
  websocket-studio     → "WebSocket"
```

---

## Competitive Landscape

> Last researched: 2026-06-08

| Feature | Postman | Insomnia | Hoppscotch | Firecamp | **RedfireForge** |
|---|---|---|---|---|---|
| Connect/Disconnect | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom Headers | ✅ | ✅ | ❌ | ✅ | ✅ |
| Message Format Selector | ✅ | ✅ | ❌ | ✅ | ✅ |
| JSON Pretty-Print | ✅ | ✅ | ❌ | ❌ | ✅ |
| Binary (Base64/Hex) Send | ✅ | ❌ | ❌ | ✅ | ✅ |
| Save Connection Profiles | ✅ | ✅ | ❌ | ✅ | ✅ |
| Auto-Reconnect | ✅ | ❌ | ❌ | ✅ | ✅ |
| Close with Code/Reason | ❌ | ❌ | ❌ | ✅ | ✅ |
| Virtualized Message Log | ❌ | ✅ | ❌ | ❌ | ✅ |
| Multiple Connections | ❌ | ❌ | ❌ | ❌ | ✅ |
| Socket.IO Protocol | ✅ | ❌ | ✅ | ✅ | ✅ |
| STOMP Protocol | ❌ | ❌ | ❌ | ❌ | ✅ |
| GraphQL-WS Protocol | ❌ | ❌ | ❌ | ❌ | ✅ |
| TLS / mTLS | ✅ | ✅ | ❌ | ❌ | ✅ |
| Workflow Integration | ❌ | ❌ | ❌ | ❌ | ✅ |
| Assertion Engine | ❌ | ❌ | ❌ | ❌ | ✅ |
| Native Desktop Transport | ❌ | ❌ | ❌ | ❌ | ✅ |
| Env Variable Interpolation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tab Persistence | ❌ | ❌ | ❌ | ❌ | ✅ Phase 10 |
| Connection History | ❌ | ✅ | ❌ | ❌ | ✅ Phase 10 |
| Message Bookmarks | ❌ | ❌ | ❌ | ❌ | ✅ Phase 11 |
| Session Recording | ❌ | ❌ | ❌ | ❌ | ✅ Phase 11 |
| Connection Stats | ❌ | ❌ | ❌ | ❌ | ✅ Phase 12 |
| Tab Drag Reorder | ❌ | ❌ | ❌ | ❌ | ✅ Phase 13 |
| Keyboard Nav (WAI-ARIA) | ❌ | ❌ | ❌ | ❌ | ✅ Phase 13 |
| JSONPath Message Filter | ❌ | ❌ | ❌ | ❌ | ✅ Phase 14 |
| Message Diff/Compare | ❌ | ❌ | ❌ | ❌ | ✅ Phase 15 |
| Built-in Mock Server | ❌ | ❌ | ❌ | ❌ | ✅ Phase 16 |
| Load/Stress Testing | ❌ | ❌ | ❌ | ❌ | ✅ Phase 17 |
| SSE Support | ❌ | ❌ | ❌ | ❌ | ✅ Phase 18 |
| Schema Validation | ❌ | ❌ | ❌ | ❌ | ✅ Phase 19 |

**Key differentiators vs all competitors:** Workflow integration, assertion engine, STOMP protocol, native Tauri transport, concurrent connection tabs, session recording/replay.

---

## Design Decisions

### 1. Hybrid transport: Browser-native for web, Tauri-native for desktop

- **Web default:** Express server proxy holds the WebSocket connection, UI polls for messages (needed for custom headers — browser `WebSocket` API cannot set handshake headers)
- **Web optimization:** Direct browser `new WebSocket()` when no custom headers needed (lower latency)
- **Desktop:** `tokio-tungstenite` via Tauri commands, event-driven messages (no polling)

### 2. Connection-centric page with message log

Single page with three tabs: **Connect** | **Messages** | **Saved Connections**. WebSocket is bidirectional — splitting send/receive into separate panels (like Kafka) would be unnatural. A unified view with compose bar + message log matches how developers think about WebSocket conversations.

```
┌─────────────────────────────────────────────────────────────────┐
│  Connection tabs:  [● localhost:8765 ×] [○ staging:443 ×] [+]  │
├─────────────────────────────────────────────────────────────────┤
│  [Connect]  [Messages]  [Saved Connections]                     │
├─────────────────────────────────────────────────────────────────┤
│  URL: [ws://localhost:8765_____________]   Status: ● Connected  │
│  Headers: [+ Add Header]                  Latency: 42ms        │
│  [Connect] [Disconnect]                   Messages: ↑12 ↓34    │
├─────────────────────────────────────────────────────────────────┤
│  Compose:  [Message body_______________]  [Send]  [Ping]       │
│  Format: [Text ▾]  Template: [None ▾]                          │
├─────────────────────────────────────────────────────────────────┤
│  ↑ 12:00:01  text   {"type":"subscribe","channel":"orders"}    │
│  ↓ 12:00:01  text   {"type":"subscribed","channel":"orders"}   │
│  ↓ 12:00:02  text   {"type":"message","data":{"id":1,...}}     │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Connection profiles stored inside Studio (not centralized Settings)

WebSocket endpoints are per-API, per-environment — not shared infrastructure like Kafka clusters. Saved Connections include URL + headers + query params + subprotocols + TLS config + notes.

### 4. Capped message log with explicit Clear

Default cap: 10,000 messages (configurable: 100 / 500 / 1,000 / 10,000 / 50,000). Virtualized rendering via `@tanstack/react-virtual` — only ~40-60 rows in DOM regardless of total.

### 5. Ping/Pong visibility

Hidden by default. "System Frames" toggle reveals ping, pong, close, and protocol keepalive frames with muted styling.

---

## Phase Status Dashboard

| Phase | What It Delivers | Status | Tests |
|---|---|---|---|
| **1** — Core Connect & Send/Receive | WebSocket URL input, connect/disconnect, compose bar, message log, server proxy | ✅ Done | ~140 |
| **2** — Saved Connections, Templates & Auto-Reconnect | Connection profiles, message templates, format selector, binary send, auto-reconnect, close with code/reason | ✅ Done | ~180 |
| **3** — Protocol Support | Socket.IO, STOMP, GraphQL-WS codecs; TLS/mTLS panel; protocol auto-detection | ✅ Done | ~200 |
| **4** — Workflow Integration | `wsConnect`, `wsSend`, `wsReceive`, `wsTrigger` workflow nodes; config panels; engine handlers; results explorer | ✅ Done | ~120 |
| **5** — Runner & Assertions | WS scenarios in Test Runner; `wsField`/`wsNumericField` assertions; data source expansion; WS extraction adapter; export/import | ✅ Done | 573+ (5A-5E) + 280 (5F) |
| **6** — Tauri Native Transport | Rust `tokio-tungstenite` module (9 files); TS bridge; event-driven messages; transport selection | ✅ Done | 69 Rust + 829 TS |
| **7** — Env Variable Interpolation | `{{baseUrl}}`, `{{wsBaseUrl}}`, `{{host}}` resolution from AppHeader env/svc selection | ✅ Done | ~33 |
| **8** — Virtualized Message Log | `@tanstack/react-virtual`, cap raised to 10,000, `React.memo` row extraction, Tauri-aware export | ✅ Done | 605 WS total |
| **9** — Multiple Concurrent Connections | Tabbed connections (max 8), independent state per tab, background connections stay alive | ✅ Done | 69 new |
| **10** — Tab Persistence & Connection History | Persist tabs across navigation, recent connections dropdown, auto-restore | ✅ Done | 103 |
| **11** — Message Bookmarks & Session Recording | Bookmark messages, record/replay sessions | ✅ Done | 24 new |
| **12** — Connection Stats Dashboard | Real-time throughput, byte rates, frame type distribution, sparkline history | ✅ Done | 22 new |
| **13** — Tab Drag-and-Drop Reorder + Keyboard Nav | Reorder tabs via drag, WAI-ARIA keyboard navigation (arrow keys) | ✅ Done | 33 new |
| **14** — Advanced Message Filtering & JSONPath Query | Regex/JSONPath search, size/time filters, saved presets | ✅ Done | 21 new |
| **15** — Message Comparison & Diff | Side-by-side JSON diff of any two messages | ✅ Done | 47 new |
| **16** — WebSocket Mock Server | Built-in mock server with rules engine, live rule sync | ✅ Done | 57 new |
| **17** — Load & Stress Testing | Configurable message bursts, real-time metrics, latency histogram | ✅ Done | 42 new |
| **18** — SSE (Server-Sent Events) Support | SSE endpoint connection, fetch+ReadableStream parser, event log, type filtering, bookmarks | ✅ Done | 44 new |
| **19** — Message Schema Validation | JSON Schema validation with real-time pass/fail + auto-detection | ✅ Done | 56 new |

---

## Phase 1 — Core Connect & Send/Receive

> **Goal:** Users can connect to any WebSocket endpoint, send text messages, and see received messages in a real-time log.

### What was built

- WebSocket URL input with `ws://` / `wss://` protocol detection
- Connect/Disconnect lifecycle with status indicator (connecting/connected/disconnecting/disconnected)
- Custom headers and query parameters via extracted `KeyValueEditor` component
- Subprotocol negotiation field
- Compose bar: text message input + Send button + Ctrl/Cmd+Enter shortcut
- Real-time message log with direction arrows (↑/↓), timestamps, auto-scroll
- Text search with Cmd+F, match counter, and prev/next navigation
- Message direction filter (All / Sent / Received)
- Server proxy for custom headers (`/api/ws/*` Express routes) — browser `WebSocket` cannot set handshake headers
- Direct browser WebSocket optimization when no custom headers needed

### Architecture

```
Browser (web mode):
  dispatchWsOperation('connect', {url, headers, ...})
    ├── needsProxy? → httpFetch('/api/ws/connect') → Express holds WS → poll /messages
    └── no proxy   → new WebSocket(url) → native event handlers

Tauri (desktop mode — added in Phase 6):
  dispatchWsOperation('connect', {...})
    └── invoke('ws_connect', {request}) → tokio-tungstenite → ws-message events
```

### Key files

| File | Purpose |
|---|---|
| `src/features/websocket/WebSocketStudioPage.tsx` | Top-level page with internal tabs |
| `src/features/websocket/WebSocketConnectPanel.tsx` | Connection form + status display |
| `src/features/websocket/WebSocketMessageLog.tsx` | Real-time message log with compose bar |
| `src/features/websocket/useWebSocketStudio.ts` | Core hook: connection lifecycle, messaging, state |
| `src/shared/websocket/websocketClient.ts` | Dispatch client (`dispatchWsOperation`) |
| `src/shared/websocket/types.ts` | Shared types + factory helpers |
| `src-server/websocket/websocket-service.ts` | Server-side connection manager |
| `src-server/routes/websocket-routes.ts` | Express proxy routes |
| `src-server/websocket/websocket-mock-service.ts` | Phase 16 — Mock WebSocket server class |
| `src-server/routes/websocket-mock-routes.ts` | Phase 16 — Express REST control routes for mock server |
| `src/styles/websocket-studio.css` | All WebSocket Studio CSS |

---

## Phase 2 — Saved Connections, Templates & Auto-Reconnect

> **Goal:** Persistence layer for connection profiles and message templates, plus UX refinements.

### Sub-phases

| Sub-Phase | Scope |
|---|---|
| **2A** | Saved Connection Profiles: CRUD, import/export, JSON paste, config lock while connected |
| **2B** | Message Templates: save/load/delete, format selector (Text/JSON/Binary), hex view, detail panel with tabs, keyboard nav |
| **2C** | Auto-Reconnect: configurable (none/immediate/backoff), close with code/reason, reconnect badge + controls |

### Mockup alignment updates (June 2026)

Compared implementation against `docs/mockups/websocket-phase2a-saved-connections.html`, `websocket-phase2b-templates-format.html`, and `websocket-phase2c-reconnect-close.html`. Fixes applied:

**Phase 2A — Saved Connections:**
- Fixed profile storage crash on minimally-stored profiles (missing `headers`/`queryParams` arrays) — added `normalizeProfile()` in `websocketStorage.ts`
- Config lock banner: changed icon from ⊘ to 🔒, updated text to "while connected", changed styling from amber to blue/info per mockup
- Card actions now show on hover only (CSS `opacity: 0` → `1` on hover/selected)
- Profile editor modal now dismisses on overlay click
- `formatTimeAgo()` now supports week unit (`1w ago`)

**Phase 2B — Templates & Format:**
- Message row type badge now infers `json` for valid JSON payloads and `sys` for system messages (was always showing `text`)
- Hex dump in detail panel now correctly decodes base64 for binary frames (was dumping base64 ASCII)
- `buildHexDumpLines()` / `buildHexDump()` now accept `isBinary` parameter

**Phase 2C — Auto-Reconnect & Close:**
- Default backoff multiplier changed from 1.5× to 2× (mockup spec), 2× now labeled "(recommended)"
- Auto-reconnect settings row now shows faded (opacity 0.4 + pointer-events: none) when toggle is off, instead of being hidden
- Field hints added below each settings field (e.g., "Stop retrying after this many failures")
- Reconnecting banner now shows "Connection lost at \<time\>" from `reconnectState.lostAt`
- Reconnect failed banner now shows ⚠ icon and total downtime
- Progress dots during reconnecting now use warning/orange color for completed attempts (was green)
- Close reason `maxLength` fixed from 200 to 123 (RFC 6455 limit)
- "Close with Code" button now uses danger/red styling (was primary/blue)

### Key files

| File | Purpose |
|---|---|
| `src/app/hooks/useWebSocketProfiles.ts` | Profile CRUD + persistence |
| `src/app/hooks/useWebSocketTemplates.ts` | Template CRUD + persistence |
| `src/features/websocket/WebSocketSavedConnections.tsx` | Profile list UI + import/export |
| `src/features/websocket/WebSocketMessageDetail.tsx` | Message detail panel (JSON/Raw/Hex tabs) |
| `src/shared/websocket/websocketStorage.ts` | Dual-mode persistence (localStorage / Tauri FS) |
| `src/features/websocket/KeyValueEditor.tsx` | Reusable key-value pair editor |

---

## Phase 3 — Protocol Support

> **Goal:** Socket.IO, STOMP, and GraphQL-WS protocol codecs with auto-detection, auto-handshake, and TLS/mTLS config.

### Sub-phases

| Sub-Phase | Scope |
|---|---|
| **3A** | Protocol abstraction layer: `PROTOCOL_REGISTRY`, `protocolDetector` (URL + subprotocol + message heuristics) |
| **3B** | Socket.IO v4 codec: encode/decode all packet types, EIO transport negotiation, `pingInterval`/`pingTimeout` display |
| **3C** | STOMP codec: parse/serialize STOMP frames, `heart-beat` negotiation, auto-CONNECT handshake |
| **3D** | Advanced TLS/mTLS: certificate file inputs (CA, client cert, client key), `rejectUnauthorized` toggle, proxy-only banner |
| **3E** | GraphQL-WS (`graphql-ws` subprotocol): `connection_init`/`subscribe`/`next`/`complete`, `operationName` in compose UI |

### Protocol registry

| Protocol | Detection | Auto-Handshake | Auto-Respond |
|---|---|---|---|
| Raw WebSocket | Default | — | — |
| Socket.IO v4 | URL `/socket.io/`, EIO open packet | EIO upgrade negotiation | PING→PONG |
| STOMP | URL `/stomp`, `stomp` subprotocol | CONNECT frame | Server heartbeats |
| GraphQL-WS | `graphql-transport-ws` subprotocol | `connection_init` | `ka` keepalive |

### Key files

| File | Purpose |
|---|---|
| `src/shared/websocket/protocols/protocolTypes.ts` | Protocol registry + detection types |
| `src/shared/websocket/protocols/protocolDetector.ts` | URL/subprotocol/message heuristic detector |
| `src/shared/websocket/protocols/socketIoCodec.ts` | Socket.IO v4 encode/decode |
| `src/shared/websocket/protocols/stompCodec.ts` | STOMP frame parse/serialize |
| `src/shared/websocket/protocols/graphqlWsCodec.ts` | GraphQL-WS message encode/decode |
| `src/features/websocket/WebSocketProtocolSelector.tsx` | Protocol dropdown UI |
| `src/features/websocket/WebSocketTlsPanel.tsx` | TLS certificate config panel |
| `src/features/websocket/wsProtocolHelpers.ts` | Auto-respond logic, frame annotation |

---

## Phase 4 — Workflow Integration

> **Goal:** Four new workflow node types (`wsConnect`, `wsSend`, `wsReceive`, `wsTrigger`) with config panels, engine handlers, and results explorer integration.

### Architecture

```
Workflow Designer:
  wsConnect → wsSend → wsReceive
       ↑                    ↓
  wsTrigger          (assertions)

Engine execution:
  graphRunner.ts dispatches to graphRunnerWsNodeHandlers.ts
  WsNodeOperations (buildWsNodeOperations.ts) wraps dispatchWsOperation()
  Connection registry: connect stores, send/receive reuse by connectionId
  disconnectAll() in finally block for cleanup
```

### Node types

| Node | Purpose | Key Config |
|---|---|---|
| `wsConnect` | Open a WebSocket connection | URL, headers, subprotocols, TLS, timeout, connectionId |
| `wsSend` | Send a message on an open connection | connectionRef, message body, format (text/binary) |
| `wsReceive` | Wait for a message matching criteria | connectionRef, match criteria (content, JSONPath), timeout |
| `wsTrigger` | Start node — waits for an external WS message | connectionRef, match criteria, timeout |

### Key files

| File | Purpose |
|---|---|
| `src/features/workflow/components/nodes/Ws{Connect,Send,Receive,Trigger}Node.tsx` | 4 canvas node components |
| `src/features/workflow/components/configs/Ws{Connect,Send,Receive,Trigger}Config.tsx` | 4 config panel components |
| `src/features/workflow/components/configs/WsConfigShared.tsx` | Shared config sub-components |
| `src/features/workflow/components/configs/wsConfigFactories.ts` | Config factory helpers |
| `src/features/workflow/engine/graphRunnerWsNodeHandlers.ts` | Engine handlers for all 4 WS node types |
| `src/shared/websocket/buildWsNodeOperations.ts` | `WsNodeOperations` interface bridge |
| `src/features/results/utils/transportStatus.ts` | Transport-aware status formatting |

---

## Phase 5 — Runner & Assertions

> **Goal:** WebSocket scenarios in the Test Runner with full assertion engine support, data source expansion, and Data Mapper integration.

### Sub-phases

| Sub-Phase | Scope |
|---|---|
| **5A** | Types: `WsActionType`, `ScenarioActionType`, action configs, `WsResultMeta`, `WsAssertionTarget` |
| **5B** | Execution: `wsExecution.ts` dispatches connect/send/receive → `RequestResult`; worker/Rust guards; data source expansion |
| **5C** | Assertions: `wsField` (string operators), `wsNumericField` (numeric operators), `ws.*` custom expressions |
| **5D** | Editor UI: Transport selector in `TestEditorModal`, `WsScenarioEditor`, assertion presets, assertion rendering |
| **5E** | Results: Transport-aware labels, response detail modal WS panel, report generator, metrics |
| **5F** | Data Mapper: `wsExtractionAdapter`, export/import normalization, `TestDefinitionSnapshot` transport extension |

### Assertion targets

| Assertion Type | Targets | Operators |
|---|---|---|
| `wsField` | `ws.body`, `ws.type`, `ws.protocol`, `ws.connectionId`, `ws.header.*`, `ws.$.jsonpath` | String: equals, contains, startsWith, regex, etc. |
| `wsNumericField` | `ws.latencyMs`, `ws.size` | Numeric: `<`, `>`, `<=`, `>=`, `=`, `!=` |
| Custom expression | `ws.body`, `ws.latencyMs`, `ws.protocol`, etc. | Full expression engine |

### Connection lifecycle in harness

```
TestScenario "Chat flow"
  ├── Test 1: wsConnect (creates connection "chat")
  ├── Test 2: wsSend   (connectionRef: "chat", sends join message)
  ├── Test 3: wsReceive (connectionRef: "chat", waits for joined response)
  └── On completion → disconnectAll() cleanup
```

### Key files

| File | Purpose |
|---|---|
| `src/shared/types/websocket.ts` | WS harness types (action configs, assertion targets, result meta) |
| `src/shared/utils/wsScenarioDefaults.ts` | Default factories, `isWsScenario`, validation |
| `src/engine/wsExecution.ts` | WS action dispatcher → `RequestResult` |
| `src/features/scenarios/components/WsScenarioEditor.tsx` | WS-specific scenario config panel |
| `src/shared/components/data-mapper/adapters/wsExtractionAdapter.ts` | Data Mapper adapter for WS messages |

### Kafka parity benefits

Several Phase 5 changes fixed existing Kafka issues as a side effect:

| Fix | Kafka Issue Fixed |
|---|---|
| Worker ops build (5B) | Kafka harness scenarios broken in worker mode |
| HTTP status skip (5C) | Kafka failures got spurious `(http)` failure detail |
| `kafkaField` UI (5D) | `kafkaField` assertions had no rendering branch |
| Transport selector (5D) | No Kafka scenario authoring UI |

---

## Phase 6 — Tauri Native Transport

> **Goal:** Desktop app uses native `tokio-tungstenite` for WebSocket connections, eliminating Express server proxy dependency.

### Architecture

```
TypeScript (useWebSocketStudio):
  dispatchWsOperation('connect', {...})
        │
  transportOverride? ─── YES ──► invoke('ws_connect') ──► tokio-tungstenite
        │ NO                                                    │
        ▼                                                       ▼
  httpFetch('/api/ws/connect')                           tokio::spawn read loop
  (Express proxy)                                               │
        ▼                                                       ▼
  Poll /api/ws/messages                                  app.emit('ws-message')
  (200ms interval)                                              │
                                                                ▼
                                                         listen() → appendMessage()
```

### Rust module (`src-tauri/src/websocket/` — 9 files, 2198 lines)

| File | Purpose |
|---|---|
| `types.rs` | Request/response types aligned with `contracts.ts` |
| `envelope.rs` | Success/error envelope helpers (`pub(super)`) |
| `state.rs` | `WsState` + `ConnectionHandle` + `Mutex<HashMap>` |
| `config.rs` | TLS config builder (`rustls` + PEM parsing) |
| `lifecycle.rs` | `ws_connect`, `ws_disconnect`, `ws_status` |
| `operations.rs` | `ws_send`, `ws_ping`, `ws_receive_next` |
| `message.rs` | Frame type conversion |
| `mod.rs` | Module tree |
| `commands.rs` | Integration tests |

### Tauri commands (6)

| Command | Purpose |
|---|---|
| `ws_connect` | Connect with TLS, headers, timeout; spawns read/write loops |
| `ws_disconnect` | Send close frame, cancel read loop, remove from state |
| `ws_send` | Text or binary frame via `mpsc` channel |
| `ws_ping` | WebSocket ping frame |
| `ws_receive_next` | Block until next message or timeout (for runner/workflow) |
| `ws_status` | Connection metrics (uptime, sent/received counts) |

### TypeScript bridge

| File | Purpose |
|---|---|
| `src/shared/websocket/websocketNativeTauriTransport.ts` | Maps `WsProxyOperation` → Rust `invoke()` + event listeners |
| `src/shared/websocket/websocketClient.ts` | Refactored: `WsClientTransport` type + `setWsClientTransport()` |
| `src/app/main.tsx` | `setWsClientTransport(wsNativeTauriTransport)` on Tauri |

### Key design decisions

| Decision | Rationale |
|---|---|
| Mirror Kafka module structure | Proven pattern, consistent codebase |
| `rustls` (not `native-tls`) | Consistent with `reqwest` in this project |
| `mpsc` channel for write half | Decouples `ws_send` from write I/O |
| Event-driven (not polling) on Tauri | Eliminates 200ms polling latency |
| `std::sync::Mutex` (not `tokio::sync::Mutex`) | Lock held briefly for HashMap lookup, never across I/O |

---

## Phase 7 — Environment Variable Interpolation

> **Goal:** `{{var}}` placeholders in URLs, headers, and query params resolve from the AppHeader env/svc selection.

### Available variables

| Variable | Source | Example |
|---|---|---|
| `{{baseUrl}}` | `resolvedBaseUrl` from `useDerivedViewState` | `https://api.staging.example.com` |
| `{{wsBaseUrl}}` | `baseUrl` with `https:` → `wss:` conversion | `wss://api.staging.example.com` |
| `{{host}}` | Hostname from `baseUrl` | `api.staging.example.com` |
| `{{envName}}` | Selected environment name | `Staging` |
| `{{svcName}}` | Selected microservice name | `UserService` |

### What was built

- `buildWsEnvVarMap()` builds the variable map from app context
- `buildResolvedEffectiveUrl()` resolves vars per-field BEFORE URL-encoding (prevents `{{token}}` → `%7B%7Btoken%7D%7D`)
- Resolved URL preview in connect panel when it differs from raw URL
- Unresolved var warnings (mutually exclusive: "vars unresolved" vs "no env selected")
- Profiles store raw templates — resolved at connect time from current env

### Known limitations

- Subprotocols are not interpolated (low-value edge case)
- Connect button stays enabled for unresolvable templates — user gets connection error feedback

---

## Phase 8 — Virtualized Message Log

> **Goal:** Replace O(n) DOM rendering with windowed virtual list, raise message cap from 1,000 to 10,000, fix export to use Tauri save dialog.

### What was built

- `@tanstack/react-virtual` v3.14.2 with fixed 26px row height, 15-row overscan
- `MessageRow` extracted as `React.memo` component with stable `onRowClick` handler
- Auto-scroll via `virtualizerRef.current.scrollToIndex` (replaces sentinel div)
- `DEFAULT_MAX_MESSAGES` raised to 10,000 (profile editor cap: 50,000)
- Export uses `saveJsonFile` from `fileSaver.ts` (native Tauri save dialog on desktop)

### Known constraints

- Fixed row height (`white-space: nowrap`) — multi-line rows would require `measureElement`
- JSDOM tests mock `useVirtualizer` (no layout simulation)

---

## Phase 9 — Multiple Concurrent Connections

> **Goal:** Tabbed connections (max 8) with independent state per tab.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Connection tabs:  [● localhost:8765 ×] [○ staging:443 ×] [+] │
├──────────────────────────────────────────────────────────────┤
│  ┌─ WsConnectionTabContent key="tab-1" (display: flex) ─────┐│
│  │  useWebSocketStudio()  ← own connection, messages, state  ││
│  │  View tabs: [Connect] [Messages] [Saved]                  ││
│  └───────────────────────────────────────────────────────────┘│
│  ┌─ WsConnectionTabContent key="tab-2" (display: none) ──────┐│
│  │  useWebSocketStudio()  ← independent, stays connected     ││
│  └───────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Key design decisions

- **Keyed component instances** — each tab renders `WsConnectionTabContent` with unique React `key`, calling `useWebSocketStudio()` independently. Zero hook refactoring.
- **Background tabs stay connected** — `display: none` keeps components mounted; messages continue arriving
- **Max 8 tabs** — caps memory (8 × 10k messages = 80k frames max)
- **Auto-labels from URL** — e.g., `localhost:8765`; double-click to rename
- **Close = disconnect + remove** — confirmation only for connected tabs
- **Shared resources** — profiles, templates, env vars shared across all tabs

### Key files

| File | Purpose |
|---|---|
| `src/features/websocket/WsConnectionTabContent.tsx` | Per-tab content (calls `useWebSocketStudio`) |
| `src/features/websocket/WsConnectionTabBar.tsx` | Tab bar with add/close/select/rename |

### Known constraints

- No cross-tab message routing (tabs are fully independent)
- ~~Tabs are session-only (not persisted to storage)~~ — **Resolved in Phase 10** (tab state persists across navigation and restarts)
- Resource scaling: 8 tabs = 40 proxy polls/sec in web mode

---

## Phases 10–13 (Completed)

> Post-foundation phases that built on the Phase 1–9 core. All four are complete.

### Phase 10 — Tab Persistence & Connection History

> **Goal:** Persist connection tab state across page navigation and app restarts; provide quick access to recently used WebSocket URLs.
>
> **Priority:** ★★★ High — directly addresses the biggest usability gap from Phase 9 (tabs lost on navigation)
>
> **Estimated effort:** 2–3 days

#### Rationale

Phase 9 added multiple concurrent connection tabs, but they are entirely session-only — navigating to another page (Kafka, Requests, etc.) and back destroys all tabs and their connections. Users who work with 3-4 WebSocket endpoints simultaneously lose their entire workspace on every page switch. This is the single highest-friction point in the current WebSocket Studio experience.

#### 10.1 — Tab State Persistence

**What:** Save and restore the complete tab bar state (tab IDs, labels, URLs, view positions, renamed flags) using the existing `websocketStorage.ts` dual-mode persistence layer.

- [x] Define `WsPersistedTab` type: `{ id: string, label: string, url: string, viewTab: 'connect' | 'messages' | 'saved' }`
- [x] Define `WsPersistedTabState` type: `{ tabs: WsPersistedTab[], activeTabId: string, renamedTabIds: string[] }`
- [x] Add `saveWsTabState()` / `loadWsTabState()` to `websocketStorage.ts` with validation
- [x] On `WebSocketStudioPage` mount: restore tabs from storage (fallback: single "New Connection" tab)
- [x] Advance `nextTabSeq` counter past the highest restored tab ID to prevent collisions
- [x] On tab add/close/rename/URL-change/view-tab-change: debounce-save tab state (300ms)
- [x] **Do NOT persist connection state** — connections are not resumable (WebSocket is stateful). Restored tabs start disconnected.
- [x] Add `initialUrl` prop to `WsConnectionTabContent` — applies stored URL on first render via one-time `useEffect`
- [x] Add `initialViewTab` prop to `WsConnectionTabContent` — used as `useState` initializer
- [x] Add `onViewTabChange(tabId, viewTab)` callback on `WsConnectionTabContent` — fires when user switches view tabs
- [x] Track per-tab URLs in `WsConnectionTabInfo.url` field via existing `onUrlChange` callback
- [x] Track per-tab view tabs in a `viewTabs` record in `WebSocketStudioPage`
- [x] Handle storage migration: if no saved state exists, create default single tab

**Files:**
| File | Change |
|---|---|
| `src/shared/websocket/websocketStorage.ts` | Add `saveWsTabState()` / `loadWsTabState()` |
| `src/shared/websocket/types.ts` | Add `WsPersistedTab`, `WsPersistedTabState` types |
| `src/features/websocket/WebSocketStudioPage.tsx` | Load on mount, save on change (debounced), track URLs + viewTabs |
| `src/features/websocket/WsConnectionTabContent.tsx` | Add `initialUrl`, `initialViewTab`, `onViewTabChange` props |
| `src/features/websocket/WsConnectionTabBar.tsx` | Add `url` field to `WsConnectionTabInfo` |

#### 10.2 — Connection History (Recent URLs)

**What:** Automatically record the last N unique WebSocket URLs the user connected to. Show a "Recent" dropdown on the URL input for one-click reconnection.

- [x] Define `WsConnectionHistoryEntry` type: `{ url: string, protocol: WsProtocolMode, lastUsed: string, connectCount: number }`
- [x] Add `useWebSocketHistory()` hook: `{ history, addEntry, removeEntry, clearHistory }`
- [x] Persist in `websocketStorage.ts` — max 20 entries, deduped by URL, sorted by `lastUsed` desc
- [x] On successful connect (detected via `onConnectionStateChange` → 'connected'): add/update entry with current URL, protocol, timestamp
- [x] URL input: dropdown trigger icon (▾) at the right side of the URL input
- [x] Each dropdown row: URL, protocol badge, relative timestamp ("2 min ago")
- [x] Click row → fills URL + sets protocol mode
- [x] "Clear History" button at dropdown bottom
- [x] History is global (not per-tab) — all tabs contribute to the same history

**Files:**
| File | Change |
|---|---|
| `src/shared/websocket/websocketStorage.ts` | Add `saveWsHistory()` / `loadWsHistory()` |
| `src/shared/websocket/types.ts` | Add `WsConnectionHistoryEntry` type |
| `src/app/hooks/useWebSocketHistory.ts` | NEW — history CRUD hook |
| `src/features/websocket/WebSocketConnectPanel.tsx` | URL input dropdown trigger + recent list |
| `src/features/websocket/WebSocketStudioPage.tsx` | Record history on successful connect |
| `src/features/websocket/WsConnectionTabContent.tsx` | Pass history + protocol mode to connect panel |
| `src/styles/websocket-studio.css` | Dropdown styling |

#### 10.3 — Quick Connect from Tab Bar

**What:** Dropdown arrow next to the "+" button shows recent URLs for instant one-click tab creation with a pre-filled URL.

- [x] Small dropdown arrow (▾) next to the "+" button in the tab bar
- [x] Click "+" → blank tab (unchanged behavior)
- [x] Click ▾ → dropdown with recent URLs from history
- [x] Click a URL → creates new tab with that URL pre-filled via `onAddWithUrl(url)` callback
- [x] If no history exists, hide the ▾ arrow (just show "+")

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/WsConnectionTabBar.tsx` | Add dropdown arrow + recent list next to "+" |
| `src/features/websocket/WebSocketStudioPage.tsx` | Pass history + `handleAddTabWithUrl` to tab bar |
| `src/styles/websocket-studio.css` | Dropdown styling for tab bar |

#### Phase 10 Success Criteria

- [x] Navigate away from WS Studio and back — all tabs restored with correct labels, URLs, and view positions
- [x] Close app and reopen — tabs restored (Tauri FS persistence)
- [x] Restored tabs show the previously-typed URL in the URL input field
- [x] URL input shows recent connections dropdown with last 20 URLs
- [x] Click recent URL → pre-fills URL and sets protocol mode
- [x] Tab bar "▾" dropdown shows recent URLs for quick tab creation
- [x] Unit tests for persistence round-trip, history CRUD, storage migration, and tab restoration
- [x] Zero type errors (`tsc -b --noEmit`)

---

### Phase 11 — Message Bookmarks & Session Recording

> **Goal:** Let users bookmark important messages during a debugging session and optionally record/replay entire WebSocket sessions.
>
> **Priority:** ★★☆ Medium-High — competitive differentiator (no competitor offers this)
>
> **Estimated effort:** 3–4 days

#### Rationale

When debugging real-time WebSocket flows, users often need to flag specific messages for later review ("this is the malformed payload", "this is where the disconnect happened"). Currently they must manually copy messages or scroll through hundreds of entries. Bookmarks solve this. Session recording goes further — capture an entire conversation for offline analysis or sharing with teammates.

#### 11.1 — Message Bookmarks

**What:** Star icon on any message row to bookmark it. Bookmarked messages survive Clear and appear in a dedicated "Bookmarked" filter.

**Architecture:** Bookmarks are a **UI-only concept** — `WsFrame` (the shared transport type used across engine/harness/workflow) is NOT modified. Instead, bookmark state is maintained as a parallel store inside `useWebSocketStudio`:
- `bookmarkedIds: Set<string>` — quick lookup for star rendering
- `bookmarkedMessages: WsFrame[]` — snapshot copies of bookmarked frames
- When a frame is bookmarked, it's copied into `bookmarkedMessages`. This ensures it survives both `clearMessages()` and cap eviction (the 10k message cap can drop old messages from the main array).
- The "Bookmarked" filter shows from `bookmarkedMessages`, not the live `messages` array.

- [x] Add `bookmarkedIds` (Set) and `bookmarkedMessages` (WsFrame[]) state to `useWebSocketStudio`
- [x] Add `toggleBookmark(id: string)` to `UseWebSocketStudioReturn` — toggles bookmark on/off, copies frame to/from `bookmarkedMessages`
- [x] Star icon (☆/★) on each `MessageRow` — click to toggle (no right-click context menu — simpler, sufficient)
- [x] Extend `WsDirectionFilter` type: `'all' | 'sent' | 'received' | 'bookmarked'`
- [x] Update `applyFilters()` in `wsProtocolHelpers.ts` to accept optional `bookmarkedMessages` param; when filter is `'bookmarked'`, return `bookmarkedMessages` instead of filtering `messages`
- [x] `clearMessages()` preserves `bookmarkedIds` and `bookmarkedMessages` — only clears the main `messages` array and counters
- [x] Cap eviction (`appendMessage`/`appendMessages`): when messages are trimmed, any bookmarked frames in the trimmed portion are already safe in `bookmarkedMessages` — no extra work needed
- [x] Export: `handleExportMessages` includes a `bookmarked: true` flag on messages whose IDs are in `bookmarkedIds`
- [x] Per-tab bookmarks — natural, since each tab has its own `useWebSocketStudio()` instance
- [x] Bookmark count shown in the filter dropdown option label: "Bookmarked (3)"

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/useWebSocketStudioTypes.ts` | Extend `WsDirectionFilter` with `'bookmarked'`, add bookmark fields to return type |
| `src/features/websocket/useWebSocketStudio.ts` | `toggleBookmark(id)`, bookmark state, bookmark-aware `clearMessages`, pass bookmarks to filter |
| `src/features/websocket/wsProtocolHelpers.ts` | Update `applyFilters()` signature to accept bookmarkedMessages for 'bookmarked' filter |
| `src/features/websocket/WebSocketMessageLog.tsx` | Star icon on `MessageRow`, bookmark filter option, pass bookmark props |
| `src/features/websocket/WsConnectionTabContent.tsx` | Wire new bookmark props through `messageLogProps` |
| `src/styles/websocket-studio.css` | Bookmark star icon + bookmarked row highlight styling |

#### 11.2 — Session Recording

**What:** Record all messages from a WebSocket session into a portable `.wsrecording.json` file that can be replayed in the Studio.

**Architecture:** New `useWebSocketRecording` hook is standalone — it receives messages and connection state from the parent component. It does NOT live inside `useWebSocketStudio` (loose coupling). Recording events use **relative timestamps** (ms from recording start) for replay accuracy.

- [x] Define recording types in `src/shared/websocket/types.ts`:
  - `WsRecordingEvent`: `{ type: 'message', relativeMs: number, frame: WsFrame }` | `{ type: 'state-change', relativeMs: number, state: string, url?: string }`
  - `WsRecording`: `{ _format: 'ws-recording-v1', metadata: { url, protocol, startedAt, durationMs, messageCount }, events: WsRecordingEvent[] }`
- [x] New `useWebSocketRecording.ts` hook: `{ isRecording, startRecording(metadata), stopRecording() → WsRecording, recordMessage(frame), recordStateChange(state, url?) }`
- [x] "Record" toggle button in toolbar (next to Export) — red dot + "REC" label when active, pulsing animation
- [x] `WsConnectionTabContent` calls `recordMessage()` whenever `studio.messages` grows (via useEffect diffing)
- [x] `WsConnectionTabContent` calls `recordStateChange()` on connection state transitions
- [x] "Stop Recording" triggers `stopRecording()` → saves via `saveJsonFile()` (Tauri save dialog on desktop, download on web)
- [x] Recording format validated on import (version check, required fields)
- [x] Per-tab recording — each tab can record independently

**Files:**
| File | Change |
|---|---|
| `src/shared/websocket/types.ts` | Add `WsRecordingEvent`, `WsRecording` types |
| `src/features/websocket/useWebSocketRecording.ts` | NEW — recording capture + replay state machine |
| `src/features/websocket/WebSocketMessageLog.tsx` | Record button in toolbar |
| `src/features/websocket/WsConnectionTabContent.tsx` | Wire recording hook to studio events |
| `src/styles/websocket-studio.css` | Recording indicator + pulsing animation |

#### 11.3 — Session Replay

**What:** Import a `.wsrecording.json` file and replay it in the message log at original or accelerated speed.

**Architecture:** Replay state lives in the same `useWebSocketRecording` hook (it's a state machine: `idle → recording → idle` or `idle → replaying → idle`). During replay, messages are injected into the parent's message log via a callback. The replay uses `setTimeout` chains with relative timestamps adjusted by speed multiplier.

- [x] `loadRecording(file: File)` parses and validates the recording JSON
- [x] `startReplay()` / `pauseReplay()` / `resumeReplay()` / `stopReplay()` / `setReplaySpeed(n)` on the hook
- [x] Replay speeds: 1×, 2×, 5×, 10×, Max (instant — all at once)
- [x] Replay progress: `{ current: number, total: number, elapsedMs: number, durationMs: number }`
- [x] During replay: compose bar disabled, connect/disconnect disabled, toolbar shows replay controls
- [x] Replay controls: ▶/⏸ toggle, speed selector dropdown, progress counter ("23 / 156 messages"), "✕ Exit" button
- [x] "Exit Replay" clears replayed messages and returns to normal mode
- [x] No timeline scrubber (deferred — complex drag interaction for modest value)

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/useWebSocketRecording.ts` | Replay state machine, timer logic, speed control |
| `src/features/websocket/WebSocketMessageLog.tsx` | Import button, replay controls bar, compose bar disable |
| `src/features/websocket/WsConnectionTabContent.tsx` | Wire replay callbacks (onReplayMessage → appendMessage) |
| `src/styles/websocket-studio.css` | Replay controls bar styling |

#### Phase 11 Success Criteria

- [x] Bookmark a message → star icon fills (★), row gets subtle highlight
- [x] Click star again → bookmark removed
- [x] Filter by "Bookmarked" → only bookmarked messages shown with count
- [x] Clear messages → bookmarks preserved, "Bookmarked" filter still works
- [x] Bookmarked messages survive cap eviction (10k message limit)
- [x] Export includes `bookmarked: true` flag on bookmarked messages
- [x] Record button starts recording → red indicator visible
- [x] Stop recording → `.wsrecording.json` file saved with correct format
- [x] Import recording → replay controls appear
- [x] Play → messages appear at original pace; Speed 2× doubles playback speed; Max shows all instantly
- [x] Pause/Resume work correctly mid-replay
- [x] Exit replay → returns to normal mode
- [x] Unit tests for bookmark CRUD, bookmark-survive-clear, recording capture, replay timing, recording format validation (24 new tests)
- [x] Zero type errors (`tsc -b --noEmit`)

---

### Phase 12 — Connection Stats Dashboard

> **Goal:** Real-time performance metrics for active WebSocket connections.
>
> **Priority:** ★★☆ Medium — valuable for performance debugging, no competitors offer this
>
> **Estimated effort:** 2–3 days

#### Rationale

Developers debugging WebSocket-heavy applications need visibility into connection health: message rates, byte throughput, frame type distribution, and error rates. The current UI shows basic sent/received counts and uptime, but lacks historical trends and performance breakdowns.

#### Architecture Decisions

1. **No latency tracking** — WebSocket is full-duplex; there's no reliable request/response correlation. A heuristic "time between send and next receive" would produce misleading numbers. Focus on what we CAN measure: throughput, bytes, frame types, errors.
2. **Stats panel placement** — Collapsible panel at the bottom of the Messages view (between the message list and compose bar), toggled via a "Stats" button in the toolbar. NOT a 4th view tab — users need to see messages AND stats simultaneously.
3. **Sparklines** — Minimal inline SVG `<polyline>` rendering (~20 lines). No chart library dependency.
4. **Metrics hook is standalone** — `useWebSocketMetrics` is a pure hook called in `WsConnectionTabContent`. It observes `studio.messages` to derive metrics. No changes needed to `useWebSocketStudio.ts`.

#### 12.1 — Metrics Collection

**What:** Collect and aggregate real-time metrics from each connection.

- [x] `WsMetricsSnapshot` type: current rates + totals + rolling 60-second history
- [x] `useWebSocketMetrics(messages, connectionState)` hook — derives metrics from messages array
- [x] Rolling window: last 60 per-second samples for sparkline data
- [x] 1-second `setInterval` sampling with proper cleanup on unmount/disconnect
- [x] Frame type breakdown: text vs binary vs control (ping/pong/close)
- [x] Error count tracking (close frames, connection errors)
- [x] Per-tab metrics (each `WsConnectionTabContent` creates its own hook instance)
- [x] Zero rates on disconnect; reset totals on clear messages
- [x] No double-counting on reconnect (prevCountRef preserved, accumulators reset)

#### 12.2 — Stats Panel UI

**What:** A collapsible stats panel in the Messages view showing live metrics.

- [x] Toggle button "Stats" in toolbar (next to Clear/Export)
- [x] Collapsible panel between message list and compose bar
- [x] Metric cards row: Msg/s (↑+↓) | Bytes In | Bytes Out | Frames breakdown
- [x] Inline SVG sparkline for messages/sec history (60 data points)
- [x] Frame type distribution bar: text ██████ 72% | binary ███ 28% | control █ 6%
- [x] Error count badge (only shown when > 0)
- [x] Collapsed state persisted in component state (not localStorage — resets on tab switch)
- [x] Auto-updates every 1 second (via hook re-render)

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/useWebSocketMetrics.ts` | NEW — metrics collection + aggregation hook |
| `src/features/websocket/WebSocketStatsPanel.tsx` | NEW — stats panel UI with sparklines + metric cards |
| `src/features/websocket/WsConnectionTabContent.tsx` | Wire metrics hook, pass stats props to MessageLog |
| `src/features/websocket/WebSocketMessageLog.tsx` | Stats toggle button in toolbar, render stats panel |
| `src/styles/websocket-studio.css` | Stats panel, sparkline, metric card styling |

#### Phase 12 Success Criteria

- [x] Connect to echo server, send messages rapidly → throughput updates in real time
- [x] Messages/sec sparkline shows historical trend (60-second window)
- [x] Frame type distribution reflects actual sent/received frame types
- [x] Stats panel collapses/expands via toolbar button
- [x] Panel works correctly across multiple tabs (independent stats per tab)
- [x] Stats rates zero on disconnect; totals preserved until clear
- [x] Zero type errors, all existing tests pass, 22 new tests for metrics hook + stats panel

---

### Phase 13 — Tab Drag-and-Drop Reorder + Keyboard Navigation

> **Goal:** Polish UX — reorder connection tabs by dragging, and add full WAI-ARIA keyboard navigation to the tab bar.
>
> **Priority:** ★☆☆ Medium-Low — polish feature matching browser-tab UX expectations
>
> **Estimated effort:** 1–2 days

#### Architecture Decisions

1. **HTML5 Drag and Drop API** — no library needed for a simple horizontal list reorder.
2. **`onReorder` callback** — `WsConnectionTabBar` receives an `onReorder(fromIndex, toIndex)` prop. `WebSocketStudioPage` provides the callback that reorders the `tabs` state array and calls `debouncedSave()`. No new persistence code — existing `debouncedSave` already saves the tabs array in order.
3. **Drop indicator** — CSS `::after` pseudo-element on the drop target with `ws-conn-tab-drop-before` / `ws-conn-tab-drop-after` classes for left/right edge indicator.
4. **Keyboard navigation** — follows WAI-ARIA Tabs pattern. The tab bar div already has `role="tablist"`. Each tab div already has `role="tab"` and `aria-selected`. We add `tabIndex`, `aria-orientation`, and a `onKeyDown` handler.
5. **Delete calls existing `onClose`** — the close confirmation for connected tabs is already handled in `handleCloseTab` in `WebSocketStudioPage`.

#### 13.1 — Drag-and-Drop Tab Reorder

**What:** Drag a connection tab to reorder it within the tab bar.

- [x] `draggable={!isEditing}` attribute on `.ws-conn-tab` elements
- [x] `onDragStart`: set `dataTransfer` with the tab's index, set `draggingTabId` state (state-driven, survives re-renders)
- [x] `onDragOver`: determine drop position (before/after target), show CSS indicator; skip if hovering dragged tab itself
- [x] `onDragEnd`: clear all drag states
- [x] `onDrop`: call `onReorder(fromIndex, toIndex)` via extracted `computeDropIndex` pure function
- [x] `onReorder` callback in `WebSocketStudioPage` — reorders `tabs` state + calls `debouncedSave()`
- [x] CSS: `.ws-conn-tab-dragging` (40% opacity), `.ws-conn-tab-drop-before` / `.ws-conn-tab-drop-after` (accent-color box-shadow indicator)

#### 13.2 — Keyboard Navigation

**What:** Full WAI-ARIA Tabs keyboard pattern for the connection tab bar.

- [x] `tabIndex={0}` on active tab, `tabIndex={-1}` on inactive tabs
- [x] `aria-orientation="horizontal"` on the tablist div
- [x] `onKeyDown` handler on each tab div (suppressed during rename editing):
  - Arrow Left/Right: move focus to adjacent tab (wraps)
  - Home/End: focus first/last tab
  - Enter/Space: activate (select) the focused tab
  - Delete: close the focused tab (calls `onClose`, which already has confirmation)
  - F2: start renaming the focused tab
- [x] Focus ring CSS: `.ws-conn-tab:focus-visible` outline (keyboard-only, no outline on mouse focus)
- [x] Close button `tabIndex={-1}` — excluded from tab order to prevent double-stops

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/WsConnectionTabBar.tsx` | DnD handlers, keyboard event handler, `tabIndex`, `aria-orientation` |
| `src/features/websocket/WebSocketStudioPage.tsx` | `handleReorderTab` callback + pass `onReorder` prop |
| `src/styles/websocket-studio.css` | Drag indicator, dragging opacity, focus ring styling |

#### Phase 13 Success Criteria

- [x] Drag a tab to a new position → tab bar reorders, order persists via existing save
- [x] Arrow keys navigate between tabs with visible focus ring
- [x] Enter/Space activates the focused tab
- [x] Delete closes focused tab, F2 starts rename
- [x] Screen reader announces tab via existing `aria-label` + `aria-selected`
- [x] Focus management: after Delete-key close, focus moves to nearest remaining tab (via `pendingFocusRef` + `prevTabsLenRef`)
- [x] Zero type errors, all existing tests pass, 33 new tests (11 computeDropIndex + 5 DnD + 15 keyboard + 2 ARIA/tabIndex)

---

### Phase Dependency Map (completed)

```
Phase 10 (Tab Persistence & History) ← builds on Phase 9 (tabs)          ✅ Done
     ↓
Phase 11 (Bookmarks & Recording) ← independent, after 10                 ✅ Done
     ↓
Phase 12 (Connection Stats) ← independent, after 10                      ✅ Done
     ↓
Phase 13 (Drag Reorder + Keyboard) ← requires Phase 10 (persistence)    ✅ Done
```

All four post-foundation phases are complete.

---

## Future Phases (14–19)

> Research-driven phases based on competitive analysis (Postman, Bowire, Pulse, Mockd, WS-Strike, WSHawk, Swell, FintX) and industry trends (2026). Ordered by user impact.

### Phase 14 — Advanced Message Filtering & JSONPath Query

> **Goal:** Power-user filtering: regex search, JSONPath queries on message content, filter by size/time range, saved filter presets.
>
> **Priority:** ★★★ High — transforms debugging sessions with thousands of messages; no competitor offers JSONPath filtering
>
> **Estimated effort:** 2–3 days
>
> **Builds on:** Phase 1 (text search), Phase 8 (virtualized log), Phase 11 (bookmark filter)

#### Rationale

Current search is plain-text substring matching via `applyFilters()` in `wsProtocolHelpers.ts`. When debugging a WebSocket feed with thousands of JSON messages, users need to query message content structurally ("show me all messages where `$.type` is `error`") or filter by characteristics (messages > 1KB, messages in the last 30 seconds). Chrome DevTools, Postman, and all competitors only offer basic text search. JSONPath filtering would be a unique differentiator.

#### Architecture Decisions

1. **Search is a filter, not a highlighter** — Current design hides non-matching messages. Phase 14 preserves this model. The match counter shows "N of M messages" (filtered count / total). No in-message text highlighting (would require per-character tracking in the virtualizer — high complexity, low value).
2. **JSONPath query syntax** — `getByPath()` from `src/shared/utils/jsonPath.ts` only resolves paths; it does NOT support comparison operators. Phase 14 uses a two-part approach: `$.path` alone checks existence (value is not null/undefined); `$.path=value` checks equality (string comparison of resolved value). The `=` separator is parsed in `applyFilters`, not in the JSONPath engine.
3. **Filter state lives in `useWebSocketStudio`** — alongside existing `searchText` and `directionFilter`. New state: `searchMode`, `sizeFilter`, `timeFilter`, `contentTypeFilter`. Each tab's `WsConnectionTabContent` gets independent filter state via its own hook instance.
4. **`showControlFrames` merged into content-type filter** — The existing local `showControlFrames` toggle in `WebSocketMessageLog` is replaced by the new `contentTypeFilter` in `applyFilters`. This eliminates the split between upstream (`applyFilters`) and local (`visibleMessages`) filtering.
5. **Time filter uses a tick ref, not a timer** — "Last 30s" does NOT use `setInterval`. Instead, `applyFilters` receives `Date.now()` at call time. The `useMemo` dependency includes a `filterTick` counter that increments every 5 seconds via a single `setInterval` in the hook. This avoids per-second re-renders while keeping the filter reasonably fresh.
6. **JSON parse caching** — Messages are parsed once per search invocation via a local try/catch in the filter loop. No global cache (messages are immutable once created, and the filter runs on every change anyway).
7. **Presets are global** — Shared across tabs, persisted in `websocketStorage.ts` with key `redfire-ws-filter-presets-v1`, max 20. Presets do NOT capture direction filter (direction is a separate, frequently-changed control).

#### 14.1 — Regex & JSONPath Search

**What:** Extend the existing search bar with a mode toggle: Text / Regex / JSONPath.

- [x] `WsSearchMode` type: `'text' | 'regex' | 'jsonpath'`
- [x] Search mode toggle: compact pill selector next to the search input (3 pills: T / R / JP)
- [x] **Text mode** (default): substring match, case-insensitive on `m.data` + protocol meta fields (unchanged behavior)
- [x] **Regex mode**: full JavaScript regex tested on `m.data`; invalid regex shows inline error indicator (red border + "Invalid regex" tooltip); falls back to showing all messages on invalid regex
- [x] **JSONPath mode**: `$.path` resolves via `getByPath()` — message matches if result is not `undefined`/`null`. `$.path=value` matches if `String(result) === value` (case-insensitive). Non-JSON messages are excluded from matches. Placeholder text changes to `$.path or $.path=value`
- [x] Match counter: "{N} of {M}" shown to the right of the search input — N = filtered message count, M = total message count (before search, after direction/attribute filters)
- [x] Search mode state: `searchMode` added to `useWebSocketStudio`, passed through `WsConnectionTabContent` → `WebSocketMessageLog`
- [x] Search mode NOT persisted to storage (component state only, resets to 'text' on mount)

#### 14.2 — Filter by Message Attributes

**What:** Filter toolbar row below the main toolbar with attribute-based filters that compose with direction + search.

- [x] **Size filter**: `WsSizeFilter` = `'all' | 'lt1k' | '1k-10k' | 'gt10k'`; dropdown — All | < 1KB | 1–10KB | > 10KB
- [x] **Time range filter**: `WsTimeFilter` = `'all' | 'last30s' | 'last5m' | 'last30m'`; dropdown with presets (no custom range — KISS)
- [x] **Content type filter**: `WsContentTypeFilter` = `'all' | 'json' | 'text' | 'binary' | 'control'`; dropdown — All | JSON | Text | Binary | Control
  - `json`: messages where `m.type === 'text'` and `m.data` starts with `{` or `[` (fast heuristic, no JSON.parse); excludes system packets
  - `text`: `m.type === 'text'` and NOT json-like and NOT system packet
  - `binary`: `m.type === 'binary'`
  - `control`: `m.type` in `['ping', 'pong', 'close']` or `m.protocolMeta?.isSystemPacket`
- [x] **Replaces `showControlFrames`** — removed the existing local toggle in `WebSocketMessageLog`; "System Frames" checkbox removed; control frames visible when `contentTypeFilter === 'all'` or `'control'`
- [x] Filter bar collapsible via "Filters" toggle button in toolbar; auto-shows when preset with attribute filters applied
- [x] Active filter count badge on the "Filters" button: shows count of non-default filters (0 = no badge)
- [x] "Clear" link resets all attribute filters to 'all'
- [x] Filters compose: direction → attribute filters (size + time + content) → search mode
- [x] `filterTick` counter: `useRef` + `setInterval(5000)` in `useWebSocketStudio` — increments to invalidate time-based filter memoization; only active when `timeFilter !== 'all'`
- [x] Filter state per-tab via `useWebSocketStudio` hook instance

#### 14.3 — Saved Filter Presets

**What:** Save frequently used filter+search combinations as named presets for quick recall.

- [x] `WsFilterPreset` type: `{ id: string, name: string, searchMode, searchQuery, sizeFilter, timeFilter, contentTypeFilter, createdAt }`
- [x] "Save current" button in filter bar — prompts for name via `window.prompt()`
- [x] Presets dropdown in filter bar — one-click apply restores all filter fields (with fallback defaults for corrupted presets)
- [x] Delete preset: small "×" on each preset row in dropdown
- [x] Presets global (shared across tabs), persisted via `loadWsFilterPresets()` / `saveWsFilterPresets()` in `websocketStorage.ts`
- [x] Max 20 presets; newest first, oldest auto-pruned
- [x] Preset state managed inline in `WebSocketMessageLog` — loads on mount, provides save/apply/delete callbacks

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/WebSocketMessageLog.tsx` | Search mode toggle pills, match counter, filter bar row, preset dropdown, remove `showControlFrames` |
| `src/features/websocket/wsProtocolHelpers.ts` | Extend `applyFilters()` signature with `WsSearchMode`, `WsSizeFilter`, `WsTimeFilter`, `WsContentTypeFilter`, `nowMs` |
| `src/features/websocket/useWebSocketStudio.ts` | Add `searchMode`, `sizeFilter`, `timeFilter`, `contentTypeFilter`, `filterTick` state; extend `useMemo` deps |
| `src/features/websocket/useWebSocketStudioTypes.ts` | `WsSearchMode`, `WsSizeFilter`, `WsTimeFilter`, `WsContentTypeFilter` types; extend `UseWebSocketStudioReturn` |
| `src/features/websocket/WsConnectionTabContent.tsx` | Wire new filter props through `messageLogProps` |
| `src/shared/websocket/types.ts` | `WsFilterPreset` type |
| `src/shared/websocket/websocketStorage.ts` | `loadWsFilterPresets()` / `saveWsFilterPresets()`, validation, key |
| `src/styles/websocket-studio.css` | Filter bar row, search mode pills, match counter, preset dropdown styling |

#### Phase 14 Success Criteria

- [x] Text search works identically to before (no regression)
- [x] Regex search filters messages matching the pattern; invalid regex shows error indicator
- [x] JSONPath `$.type` shows messages with that path; `$.type=error` shows messages where value equals "error"
- [x] Size filter correctly categorizes messages by `m.size` (bytes)
- [x] Time filter shows only messages within the selected time window
- [x] Content type filter distinguishes JSON/text/binary/control correctly; excludes system packets from text/json
- [x] Filters compose (e.g., "received + JSON + last 30s + regex match")
- [x] `showControlFrames` toggle removed; control frames governed by content-type filter
- [x] Saved presets recall the full filter state; delete works
- [x] Performance: filtering 10,000 messages completes in < 100ms (verified with both text and JSONPath benchmarks)
- [x] Zero type errors (tsc -b --noEmit), 1065 WS tests pass (21 new), 0 lint errors

---

### Phase 15 — Message Comparison & Diff

> **Goal:** Side-by-side JSON diff of any two messages, with structural change highlighting.
>
> **Priority:** ★★☆ Medium-High — unique differentiator (only WS-Strike/WSHawk offer any form of diffing, and they're security tools, not developer tools)
>
> **Estimated effort:** 2–3 days
>
> **Builds on:** Phase 1 (message log), Phase 2B (message detail panel)

#### Rationale

When debugging real-time WebSocket feeds (market data, game state, IoT telemetry), developers constantly compare consecutive messages to see what changed. Today they must manually copy-paste into external diff tools. Built-in visual diffing — especially for JSON — would save significant time and be a competitive advantage over every mainstream WebSocket tool.

#### Architecture Decisions

1. **Compare state is local to `WebSocketMessageLog`** — `compareMode: boolean` and `compareIds: [string | null, string | null]` are UI-only concerns; no need to lift to the hook.
2. **Click-to-select "A/B" pattern** (not checkboxes) — In compare mode, first click sets message A (blue "A" badge), second click sets message B (blue "B" badge) and auto-opens the diff modal. Simpler and less visually intrusive than adding checkboxes to every row.
3. **No right-click context menu** — No existing context menu infrastructure on message rows. The "Compare" toolbar button + quick-diff buttons in detail panel are sufficient entry points.
4. **Purpose-built JSON diff engine** — `computeHttpSnapshotDiff` is HTTP-specific (headers, method, body). Phase 15 uses a recursive JSON walker that returns a flat list of `JsonDiffEntry` objects with `path`, `type` (added/removed/changed), and old/new values.
5. **Arrays compared by index** — WebSocket messages are self-contained JSON objects. Array elements are compared positionally (`a[0]↔b[0]`, `a[1]↔b[1]`). No content-based matching.
6. **LCS-based line diff for pretty-printed JSON and raw text** — Both JSON and non-JSON messages use the same side-by-side view: pretty-print both, compute line-level diff via LCS, and highlight added (green) / removed (red) lines. For JSON, a "Summary" section at the top lists structural changes by path.
7. **Binary frames excluded** — Compare buttons are disabled for binary-type frames. Only `text`-type frames can be compared.
8. **Quick-diff searches `allMessages` (unfiltered)** — "Diff with previous" finds the nearest earlier message with the same direction in the full message list, not the filtered view.
9. **`D` shortcut scoped to message list focus** — Only fires within the `onKeyDown` handler of the message list container (not global), preventing conflicts with search/compose inputs.
10. **Unified diff format for copy** — `--- left (timestamp)\n+++ right (timestamp)\n@@ @@\n-removed\n+added\n same` format.

#### 15.1 — Two-Message Diff Modal

**What:** Select any two messages from the log and view a side-by-side structural diff.

- [x] **Compare mode**: "Compare" button in the message toolbar; toggles compare mode on/off
- [x] In compare mode, clicking a row selects it for comparison (A → B). A banner "Select two messages to compare" appears.
- [x] First click → message A (blue "A" badge on row). Second click → message B (blue "B" badge) → diff modal auto-opens.
- [x] Clicking a selected message deselects it (toggle). Escape exits compare mode.
- [x] Diff modal: side-by-side layout (left = message A, right = message B, ordered by timestamp)
- [x] JSON mode: pretty-printed side-by-side with line-level diff highlighting. Summary header shows structural changes by path (added/removed/changed with counts).
- [x] Text mode: line-by-line side-by-side diff for non-JSON messages
- [x] Header row shows timestamps, directions, sizes, and size delta
- [x] "Swap sides" button to flip left/right
- [x] Copy diff as text (unified diff format with `---`/`+++` headers)
- [x] Closing the diff modal exits compare mode and clears selection

#### 15.2 — Quick Diff (Adjacent Messages)

**What:** One-click diff between a message and its predecessor/successor of the same direction.

- [x] "Diff ↑" / "Diff ↓" buttons in the message detail panel action bar
- [x] Only enabled when there is an adjacent message of the same direction in `allMessages` (unfiltered)
- [x] Opens the diff modal pre-loaded with the two messages (no compare mode needed)
- [x] Keyboard shortcut: `D` within the message list `onKeyDown` handler opens diff with previous same-direction message for the selected frame

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/WebSocketMessageDiff.tsx` | NEW — diff modal with side-by-side JSON/text comparison |
| `src/features/websocket/wsMessageDiffEngine.ts` | NEW — JSON structural diff + LCS line diff + unified diff formatter |
| `src/features/websocket/WebSocketMessageLog.tsx` | Compare mode toggle, A/B selection, diff modal integration, `D` shortcut |
| `src/features/websocket/WebSocketMessageDetail.tsx` | "Diff ↑" / "Diff ↓" buttons |
| `src/styles/websocket-studio.css` | Diff modal, compare mode badges, change highlighting CSS |
| `src/features/websocket/wsMessageDiffEngine.test.ts` | NEW — diff engine unit tests |
| `src/features/websocket/WebSocketMessageDiff.test.tsx` | NEW — diff modal component tests |

#### Phase 15 Success Criteria

- [x] Select two JSON messages → diff modal shows structural differences with color coding
- [x] Added lines shown in green, removed in red
- [x] JSON summary section lists changed paths with old → new values
- [x] Non-JSON messages fall back to line-by-line text diff
- [x] "Diff ↑" in detail panel works for consecutive same-direction messages
- [x] Copy diff produces valid unified diff text
- [x] Binary frames cannot be selected for comparison
- [x] Performance: diffing two 50KB JSON messages completes in < 200ms
- [x] Zero type errors, all existing tests pass, new tests for diff engine + modal

---

### Phase 16 — WebSocket Mock Server

> **Goal:** Built-in mock WebSocket server that accepts connections and auto-responds based on configurable rules.
>
> **Priority:** ★★☆ Medium-High — competitive gap (Mockd, Bowire, Swell, Layang all offer mocking; Postman/Insomnia/Hoppscotch do not)
>
> **Estimated effort:** 4–5 days
>
> **Builds on:** Phase 1 (message log), Phase 11 (session recording format)

#### Rationale

Frontend developers and QA engineers often need to test WebSocket client code without access to a running backend. Today they must use external tools (Mockd, docker containers) or write custom scripts. A built-in mock server that can replay recorded sessions (from Phase 11) or respond based on pattern-matching rules would complete the development-to-testing loop within RedfireForge. The Express companion server already runs on port 3001 — adding a mock WS endpoint on a separate port is architecturally straightforward, following the same REST-control pattern as the existing WS proxy.

#### Architecture Decisions

1. **Express-hosted, web-only for Phase 16** — The mock `WebSocketServer` (from the `ws` package, already a dependency) runs inside the existing Express companion server process on a configurable port (default 9876). Tauri Rust implementation deferred to Phase 16B — it requires a new `tokio-tungstenite` server module and is independent effort.
2. **REST control API** — Same envelope pattern as the WS proxy (`/api/ws/mock/*` routes). Frontend calls `httpFetch('/api/ws/mock/start')` etc. via the existing Vite→Express proxy. Operations: `start`, `stop`, `status`, `broadcast`, `log`.
3. **Singleton mock server** — Only one mock server instance at a time. Starting a new server stops any existing one. This simplifies state management and avoids port conflicts.
4. **Rule engine is server-side with live sync** — Rules are sent to the server in the `start` request body and auto-pushed via `POST /api/ws/mock/rules` on every edit while running. The server evaluates them on each incoming message. The frontend has a shared `evaluateMatch` function for local test/preview.
5. **Mock server is global, not per-tab** — The "Mock" view tab appears in every connection tab, but all tabs show the same global mock server state. The hook polls `/api/ws/mock/status` and all tabs see identical data. This is correct because there is only one Express process running one mock server.
6. **Activity log via polling** — The mock server buffers recent activity events (connections, disconnections, messages received, responses sent) in a ring buffer (max 200 entries). The hook polls `/api/ws/mock/log` with a cursor, same pattern as the WS proxy's `GET /api/ws/messages?sinceCursor=N`.
7. **Rule matching: first-match-wins** — Rules are evaluated in priority order. First rule whose match condition succeeds determines the response. If no rule matches, the fallback mode applies (echo, ignore, or close).
8. **Template variables** — Response templates support `{{message}}` (received message), `{{timestamp}}` (ISO 8601), `{{clientId}}` (WebSocket client ID), `{{counter}}` (incrementing per-client counter). Evaluated server-side via simple string replacement.
9. **Port validation** — Port must be 1024–65535 and not conflict with Express (3001) or Vite (5173). Server returns `MOCK_PORT_IN_USE` error on EADDRINUSE.
10. **16.3 Recording Replay deferred** — Recording replay as mock responses adds significant complexity (timing modes, recording parsing, position tracking). Deferred to Phase 16C to keep this phase focused on core mock + rules.

#### 16.1 — Mock Server Core

**What:** Lightweight WebSocket server that accepts client connections and responds based on rules.

- [x] Mock server runs on a configurable port (default: 9876) via the existing Express companion server process
- [x] Start/Stop toggle in a new "Mock" view tab (4th view alongside Connect/Messages/Saved)
- [x] Server status indicator: Stopped / Running / Error (with error message)
- [x] Port configuration with validation (1024–65535, conflict detection)
- [x] Accept multiple client connections simultaneously
- [x] Connected client list display: client ID, connected-at timestamp, message count
- [x] Auto-echo mode: echo back every received message (default mode for quick testing)
- [x] Activity log: recent events (connect/disconnect/message-in/response-out) displayed in a scrollable list
- [x] Broadcast: send a message to all connected clients from the UI
- [x] Graceful stop: disconnect all clients with code 1001 (Going Away)

#### 16.2 — Response Rules Engine

**What:** Pattern-matching rules that determine what the mock server responds with.

- [x] Rule list UI with ▲/▼ reorder for priority (first match wins)
- [x] Match conditions: exact text | contains | regex | JSONPath expression (`$.path=value`) | any (catch-all)
- [x] Response actions: static message | echo | template with `{{variables}}` | close connection (with code/reason)
- [x] Delay configuration per-rule (simulate latency: 0–10000ms)
- [x] Fallback mode: what to do when no rules match (echo / ignore / close) — configurable in the UI
- [x] Add/Edit/Delete/Enable/Disable rules inline
- [x] Test panel: type a sample message → see which rule matches and what response would be sent (client-side preview)
- [x] Rules persist in `websocketStorage.ts` (loaded on mock tab open, sent to server on start)
- [x] Live rule sync: editing rules while running auto-pushes to server via `POST /api/ws/mock/rules`

#### 16.3 — Recording Replay as Mock *(deferred to Phase 16C)*

Deferred to keep Phase 16 focused. Will be implemented after core mock + rules are stable.

**Files:**
| File | Change |
|---|---|
| `src-server/websocket/websocket-mock-service.ts` | NEW — Mock WebSocket server class (start/stop, client tracking, rule evaluation, activity log) |
| `src-server/routes/websocket-mock-routes.ts` | NEW — Express REST control routes (`/api/ws/mock/*`) |
| `src-server/webhook-server.ts` | Mount mock routes |
| `src/features/websocket/WebSocketMockServer.tsx` | NEW — Mock server management UI (status, clients, rules, log, broadcast) |
| `src/features/websocket/useWebSocketMockServer.ts` | NEW — React hook: polls status/log, dispatches start/stop/broadcast |
| `src/features/websocket/wsMockRuleEngine.ts` | NEW — Shared rule matching logic (used by server for evaluation, client for preview) |
| `src/shared/websocket/types.ts` | `WsMockRule`, `WsMockServerConfig`, `WsMockLogEntry`, extend `WsViewTab` |
| `src/shared/websocket/websocketStorage.ts` | Mock rule + config persistence |
| `src/features/websocket/WsConnectionTabContent.tsx` | Add "Mock" view tab |
| `src/styles/websocket-studio.css` | Mock server panel, rule list, activity log styling |
| `src/features/websocket/wsMockRuleEngine.test.ts` | NEW — Rule matching unit tests |
| `src/features/websocket/WebSocketMockServer.test.tsx` | NEW — UI component tests |
| `src-server/websocket/websocket-mock-service.test.ts` | NEW — Mock service integration tests |

#### Phase 16 Success Criteria

- [x] Start mock server → external client can connect to `ws://localhost:9876`
- [x] Auto-echo mode echoes all received messages back
- [x] Pattern rules match incoming messages and respond correctly
- [x] Delayed responses arrive after configured delay
- [x] Multiple clients connect simultaneously without interference
- [x] Stop server gracefully disconnects all clients with code 1001
- [x] Activity log shows connection/disconnection/message events
- [x] Broadcast sends a message to all connected clients
- [x] RedfireForge itself can connect to its own mock server (meta-testing)
- [x] Rule test preview matches correct rule without starting the server
- [x] Rules persist across page reloads via `websocketStorage.ts`
- [x] Zero type errors, all existing tests pass, new tests for rule engine + mock service + UI (57 new, 1166 total)

---

### Phase 17 — Load & Stress Testing

> **Goal:** Send configurable message bursts to measure WebSocket server performance directly from the Studio.
>
> **Priority:** ★★☆ Medium — fills a gap between manual testing and dedicated load tools (Artillery/k6); unique for a desktop API client
>
> **Estimated effort:** 3–4 days
>
> **Builds on:** Phase 12 (stats dashboard), Phase 1 (message send)

#### Rationale

41% of backend engineers cite WebSocket load testing as their most difficult performance challenge (SmartBear 2024). Dedicated tools like Artillery and k6 require CLI scripting and CI setup. A built-in visual load tester — with real-time charts leveraging the existing Phase 12 stats dashboard — would let developers run quick sanity checks before deploying. This is not meant to replace Artillery/k6 for production load testing, but to provide "desk-check" performance validation.

#### Architecture Decisions

1. **Single-connection load test** — The load test runs on the currently connected WebSocket endpoint. Multi-connection load testing (opening separate headless connections) deferred to Phase 17B — it requires a separate connection manager outside the tab infrastructure.
2. **Rate control via self-adjusting setTimeout loop** — A recursive `setTimeout` loop measures actual elapsed time and sends messages to maintain the target rate. For burst mode, messages are sent in batches of 50 per event loop tick. This avoids `setInterval` drift and browser throttling.
3. **Latency correlation via embedded nonce** — Each sent JSON message gets a `"__lt_nonce":"__lt_{counter}_{timestamp}"` field injected. When an echo response is received, the nonce is extracted and round-trip time computed. Non-JSON messages or non-echo servers skip latency tracking (the UI shows "No latency data").
4. **Cap eviction handling** — The load test hook tracks received messages by last-seen message ID (not array length) to correctly handle the 10,000 message cap eviction, mirroring the pattern used by the recording hook.
5. **Percentile computation reuses `src/shared/utils/percentiles.ts`** — The shared `computePercentiles()` function provides min/max/mean/p50/p90/p95/p99/p999, avoiding duplication.
6. **Safety limits** — Max 1,000 msg/s, max 60s duration, max 60,000 burst messages. Rates > 100 msg/s require user confirmation. These prevent accidental DDoS of target servers.
7. **Load test panel in Messages view** — Toggled via a "Load Test" button in the toolbar. The panel appears below the message log (similar to the Stats panel placement). Users can see messages arriving while the test runs.
8. **Auto-stop on disconnect** — If the connection drops during a load test, the test automatically stops and produces partial results.

#### 17.1 — Load Test Configuration

**What:** Load test profile editor for configuring message patterns, rates, and duration.

- [x] Load Test view: toggled from Messages toolbar ("Load Test" button)
- [x] **Target**: current connection URL (must be connected first)
- [x] **Message template**: compose a message template with `{{counter}}`, `{{timestamp}}`, `{{random}}` placeholders
- [x] **Load profile**: Constant rate | Ramp-up | Burst (pill selector)
  - Constant: N messages/sec for D seconds
  - Ramp-up: start at N₁ msg/s, increase to N₂ msg/s over D seconds (linear interpolation)
  - Burst: send N messages as fast as possible (batched 50/tick)
- [x] **Duration**: 5s / 10s / 15s / 30s / 60s preset buttons + custom input
- [x] Safety limit: max 1,000 msg/s, max 60s duration, max 60,000 burst messages
- [x] "Start Load Test" / "Stop" buttons with confirmation dialog for >100 msg/s
- [x] Reset button to restore default configuration
- [x] Expected message count summary shown before starting
- [x] Start button disabled when not connected or template is empty

#### 17.2 — Real-Time Results Dashboard

**What:** Live metrics during and after load test.

- [x] Progress bar showing test completion percentage (time-based for constant/ramp, count-based for burst)
- [x] Real-time live metrics during test:
  - Messages sent / Messages received (counters)
  - Actual send rate (msg/s) vs target rate
  - Elapsed time
  - Error count (only shown when > 0)
- [x] Results summary after completion:
  - Metric cards: total sent, received, duration, avg send rate, errors
  - Round-trip latency percentiles (min / mean / p50 / p95 / p99 / max) with sample count
  - Latency distribution histogram (bucketed: 0-1ms, 1-2ms, ..., >5000ms) with horizontal bar chart
  - Throughput over time sparkline (SVG polyline, shows msg/s per second)
  - Bytes sent/received summary
- [x] Export results as JSON via `saveJsonFile()` (Tauri save dialog on desktop)
- [x] "New Test" button to clear results and configure a new test

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/WebSocketLoadTest.tsx` | NEW — Load test config UI + results dashboard (config form, running metrics, result cards, histogram, sparkline) |
| `src/features/websocket/useWebSocketLoadTest.ts` | NEW — Load test orchestration hook (rate control, send loop, nonce correlation, cap eviction tracking, auto-stop on disconnect) |
| `src/features/websocket/wsLoadTestMetrics.ts` | NEW — Latency tracker, throughput sampler, histogram bucketing, template expansion, result aggregation |
| `src/shared/websocket/types.ts` | `WsLoadProfile`, `WsLoadTestState`, `WsLoadTestConfig`, `WsLoadTestProgress`, `WsLoadTestResult` types |
| `src/features/websocket/WsConnectionTabContent.tsx` | Wire load test hook, toggle state, pass props to message log |
| `src/features/websocket/WebSocketMessageLog.tsx` | "Load Test" toggle button in toolbar, `onToggleLoadTest` + `loadTestActive` props |
| `src/styles/websocket-studio.css` | Load test panel, profile pills, progress bar, metric cards, latency cards, histogram bars, sparkline, bytes row styling |
| `src/features/websocket/wsLoadTestMetrics.test.ts` | NEW — 24 tests: latency tracker, throughput sampler, histogram, result builder, template expansion, rate computation |
| `src/features/websocket/WebSocketLoadTest.test.tsx` | NEW — 18 tests: config form, profile pills, confirmation flow, running state, results display, histogram, export |

#### Phase 17 Success Criteria

- [x] Configure and run a constant-rate load test → messages sent at target rate
- [x] Ramp-up profile gradually increases send rate as configured
- [x] Burst profile sends N messages as fast as possible
- [x] Real-time metrics update during test (throughput, sent/received counts, elapsed time)
- [x] Latency histogram shows distribution after test completion (for echo servers)
- [x] Safety limits prevent >1,000 msg/s and >60s duration; confirmation for >100 msg/s
- [x] Export results as JSON with all metrics
- [x] Load test auto-stops on connection disconnect with partial results
- [x] Cap eviction correctly handled (latency tracking works beyond 10k message cap)
- [x] "New Test" button resets state cleanly, including internal state ref
- [x] Load test does not break existing Studio functionality (messages still appear in log)
- [x] Zero type errors (`tsc -b --noEmit`), all existing tests pass, 42 new tests (24 metrics + 18 UI), 1209 total WS tests

---

### Phase 18 — SSE (Server-Sent Events) Support

> **Goal:** First-class support for Server-Sent Events (SSE) endpoints alongside WebSocket and Kafka in the Protocols section.
>
> **Priority:** ★☆☆ Medium-Low — growing adoption of SSE for LLM streaming (ChatGPT, Claude APIs) and real-time dashboards; Pulse and Bowire already support SSE
>
> **Estimated effort:** 3–4 days
>
> **Builds on:** Phase 1 (message log infrastructure), Phase 7 (env interpolation)

#### Rationale

SSE has seen a resurgence due to LLM APIs (OpenAI, Anthropic) using SSE for streaming responses. It's simpler than WebSocket (HTTP-based, server-to-client only) but lacks dedicated debugging tools. Most developers use `curl` or browser DevTools. Adding SSE to the Protocols page — reusing the existing message log, virtualization, search, and stats infrastructure — would be a natural extension with moderate effort.

#### Architecture Decisions

1. **Transport — `fetch()` + ReadableStream (not EventSource)**
   - `EventSource` API does not support custom headers — a hard requirement for testing authenticated SSE endpoints
   - `fetch()` with `ReadableStream` body parsing provides full control over connection lifecycle, headers, and reconnection
   - Consistent approach for both browser and Tauri (Tauri 2.x supports ReadableStream on fetch)
   - Trade-off: must implement SSE text protocol parsing ourselves (well-defined, ~60 lines)

2. **SSE Parser — dedicated module (`sseParser.ts`)**
   - Implements the [W3C SSE spec](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream)
   - Handles multi-line `data:` fields, `event:`, `id:`, `retry:`, comment lines (`:`)
   - Stateful line-by-line parser that buffers fields until an empty line (event delimiter)
   - Operates on `TextDecoderStream` chunks, splitting by `\n` with carry-over for partial lines

3. **Types — separate `SseEvent` type (not extending WsFrame)**
   - SSE and WebSocket have different semantics (server-to-client only, event types, Last-Event-ID)
   - Avoids polluting WebSocket types with SSE-specific fields
   - Clean separation of concerns; types live in `src/features/sse/sseTypes.ts`

4. **Message Log — dedicated `SseMessageLog` (not reusing WebSocketMessageLog)**
   - `WebSocketMessageLog` has 51 props, most WS-specific (send panel, recording, load test, protocol modes)
   - SSE needs: event type column, Last-Event-ID display, no send controls, no direction filter
   - A dedicated component follows the same visual patterns but avoids dead props and unused UI
   - Uses `@tanstack/react-virtual` for virtualization (same library as WS)

5. **Auto-reconnect — client-managed with exponential backoff**
   - On disconnect, wait for `retry` ms (from server) or default 3000ms
   - Send `Last-Event-ID` header on reconnection for event resumption
   - Configurable max retries (default 10)

#### 18.1 — SSE Connection & Message Log

**What:** Connect to an SSE endpoint and display events in a dedicated message log.

- [x] New Protocols sub-nav entry: "SSE" alongside Kafka and WebSocket
- [x] SSE Studio page with URL input, headers (key-value), and Connect/Disconnect
- [x] Connection uses `fetch()` + `ReadableStream` with SSE text protocol parsing
- [x] SSE parser handles `event:`, `data:`, `id:`, `retry:`, multi-line data, comments
- [x] Dedicated `SseMessageLog` component with virtualized list
  - Event type badge on each row (color-coded by type)
  - Data preview (truncated, with JSON detection)
  - Timestamp column
- [x] Auto-reconnect with `Last-Event-ID` header and configurable retry delay
- [x] Custom headers support via fetch-based implementation
- [x] Env variable interpolation for URL and headers (reuses `buildWsEnvVarMap` pattern)

#### 18.2 — Event Filtering & Inspection

**What:** Filter and inspect SSE events by type, with structured detail view.

- [x] Search filter: text search across event data
- [x] Event type filter: All | specific event types (auto-populated from received events)
- [x] Event detail panel: shows full data, event type, ID, retry value
- [x] JSON pretty-print for data payloads
- [x] Bookmarks: toggle bookmark on events, filter bookmarked

#### 18.3 — SSE-Specific Features

**What:** Features unique to SSE that don't exist in WebSocket.

- [x] Last-Event-ID display in status bar
- [x] Connection stats: event count, events/sec, connection uptime
- [x] Event count by type breakdown
- [x] Clear messages button
- [x] Export events as JSON

#### Files

| File | Change |
|---|---|
| `src/features/sse/sseTypes.ts` | NEW — SSE event types, connection state, config |
| `src/features/sse/sseParser.ts` | NEW — SSE text protocol parser (W3C spec) |
| `src/features/sse/useSseConnection.ts` | NEW — SSE connection hook (fetch + ReadableStream) |
| `src/features/sse/SseStudioPage.tsx` | NEW — SSE Studio page layout |
| `src/features/sse/SseMessageLog.tsx` | NEW — Dedicated SSE message log with virtualized list |
| `src/features/sse/SseEventDetail.tsx` | NEW — Event detail panel |
| `src/features/sse/sseParser.test.ts` | NEW — SSE parser unit tests |
| `src/features/sse/SseStudioPage.test.tsx` | NEW — SSE Studio page tests |
| `src/features/sse/SseMessageLog.test.tsx` | NEW — SSE message log tests |
| `src/app/utils/appTabUtils.ts` | Add `'sse-studio'` to Tab union, PROTOCOLS_TABS, ALL_TABS |
| `src/app/components/AppSubNav.tsx` | SSE sub-nav entry under Protocols |
| `src/app/App.tsx` | Import + render SseStudioPage for `sse-studio` tab |
| `src/styles/sse-studio.css` | NEW — SSE-specific styling |

#### Phase 18 Success Criteria

- [x] Connect to an SSE endpoint → events appear in the message log
- [x] Event types correctly parsed and displayed with type badges
- [x] Auto-reconnect with Last-Event-ID on disconnect
- [x] Custom headers work via fetch-based implementation
- [x] Env variable interpolation resolves `{{baseUrl}}` in SSE URLs
- [x] Search, bookmarks, and export work
- [x] Event type filter auto-populates from received events
- [x] JSON pretty-print in detail panel
- [x] Zero type errors, all existing tests pass, new tests for SSE parser + components

---

### Phase 19 — Message Schema Validation

> **Goal:** Validate incoming/outgoing WebSocket messages against JSON Schema definitions with real-time pass/fail indicators.
>
> **Priority:** ★☆☆ Low — advanced feature for API contract testing; natural extension of the assertion engine
>
> **Estimated effort:** 2–3 days
>
> **Builds on:** Phase 5 (assertion engine), Phase 14 (JSONPath filtering)

#### Rationale

When developing against a WebSocket API, message formats can drift without notice (unlike REST APIs where OpenAPI specs enforce contracts). Schema validation catches format violations in real time during debugging sessions. This also feeds into the test harness — validated schemas can auto-generate assertions for regression testing.

#### Architectural Decisions

1. **Schema location:** Managed from the Messages view via a collapsible panel (toolbar toggle), NOT in Saved Connections. Schemas are session-scoped per connection tab. Optionally persisted with connection profiles.
2. **Validation engine:** Reuse existing `ajv` + `ajv-formats` dependencies (already `^8.20.0`). Compile schemas once on add/edit, cache compiled validators. Per-message `validate()` is synchronous and sub-millisecond — no need for Web Workers or async batching.
3. **Schema inference:** Extend existing `generateJsonSchema()` from `schemaGenerator.ts` with multi-message merging (union required fields, merge property types across samples).
4. **Types isolation:** New types in dedicated `wsSchemaTypes.ts` to avoid bloating the already-large `types.ts`.

#### 19.1 — Schema Management

**What:** Store and manage JSON Schema definitions per connection tab.

- [x] Schema panel toggled via "Schema" button in Messages toolbar (same pattern as Filters/Compare toggle)
- [x] Add schema: paste JSON Schema into text area + validate on paste
- [x] Name + direction (sent / received / both) + enabled toggle per schema
- [x] Edit schema: re-open editor with existing content
- [x] Delete schema with confirmation
- [x] Max 20 schemas per session
- [x] Storage helpers ready in `websocketStorage.ts` (persistence deferred to profile save integration)

#### 19.2 — Real-Time Validation

**What:** Validate messages against enabled schemas with inline indicators.

- [x] When validation is enabled + schemas exist, each JSON message is validated on render
- [x] Validation badge on message rows: ✓ (green, pass) / ✗ (red, fail) — hidden for non-JSON or no matching schema
- [x] Validation details in message detail panel: new "Validation" tab alongside JSON/Raw/Hex
- [x] Validation tab shows: schema name, pass/fail status, list of errors with JSONPath + message
- [x] "Validation" filter in filter bar: All / Valid / Invalid (dedicated dropdown alongside size/time/content filters)
- [x] Global validation toggle (default: off — opt-in)
- [x] Performance: Ajv compiled once per schema change, cached `ValidateFunction`. Per-message validation <1ms.

#### 19.3 — Schema Generation

**What:** Infer a JSON Schema from observed messages.

- [x] "Generate" button in schema panel: analyzes JSON messages matching selected direction
- [x] Custom multi-sample inference engine (union required fields, merge property types, format detection)
- [x] Generated schema appears in editor for review before saving
- [x] Samples up to 50 most recent matching messages

**Files:**
| File | Change |
|---|---|
| `src/features/websocket/wsSchemaTypes.ts` | NEW — `WsSchemaDefinition`, `WsValidationResult`, `WsValidationError` types |
| `src/features/websocket/wsSchemaValidator.ts` | NEW — Ajv compile-once wrapper, cached validators, `validateMessage()` |
| `src/features/websocket/wsSchemaInference.ts` | NEW — Multi-message JSON Schema inference (extends `generateJsonSchema`) |
| `src/features/websocket/useWebSocketSchema.ts` | NEW — Schema CRUD hook, validation state, filter management |
| `src/features/websocket/WebSocketSchemaPanel.tsx` | NEW — Collapsible schema management panel UI |
| `src/features/websocket/wsSchemaValidator.test.ts` | NEW — Validator unit tests |
| `src/features/websocket/wsSchemaInference.test.ts` | NEW — Inference unit tests |
| `src/features/websocket/WebSocketSchemaPanel.test.tsx` | NEW — Schema panel component tests |
| `src/features/websocket/WebSocketMessageLog.tsx` | Schema toolbar button, validation badge on rows, validation filter |
| `src/features/websocket/WebSocketMessageDetail.tsx` | Validation tab in detail panel |
| `src/features/websocket/WsConnectionTabContent.tsx` | Wire `useWebSocketSchema` hook, pass to message log |
| `src/shared/websocket/websocketStorage.ts` | Schema persistence (load/save) |
| `src/styles/websocket-studio.css` | Schema panel, validation badge, validation tab styling |

#### Phase 19 Success Criteria

- [x] Add a JSON Schema → messages are validated in real time
- [x] Valid messages show ✓, invalid show ✗ with error details
- [x] Schema auto-detection produces a reasonable schema from 10+ messages
- [x] Validation filter shows only valid/invalid messages
- [x] Validation does not degrade message log performance (< 1ms per message with compiled schema)
- [x] Zero type errors, all existing tests pass, 56 new tests for validator + inference + panel

---

### Future Phase Dependency Map (14–19)

```
Phase 14 (Filtering) ← enhances Phase 1 search                    ✅ Done
     ↓
Phase 15 (Message Diff) ← independent, after 14                   ✅ Done
     ↓
Phase 16 (Mock Server) ← leverages Phase 11 recordings            ✅ Done
     ↓
Phase 17 (Load Testing) ← leverages Phase 12 stats                ✅ Done

Phase 18 (SSE Support) ← independent, reuses infra                ✅ Done

Phase 19 (Schema Validation) ← independent, after 14              ✅ Done
```

- **Phase 14 first** — highest impact, moderate effort, unlocks filtering for Phases 15/19
- **Phase 15 and 16** are independent — can be done in either order after 14
- **Phase 17** benefits from Phase 12 stats but is otherwise independent
- **Phase 18** is fully independent — new protocol page, reuses existing infrastructure
- **Phase 19** benefits from Phase 14's JSONPath engine

### Estimated Effort Summary (14–19)

| Phase | Effort | Priority | New Files | Modified Files |
|---|---|---|---|---|
| Phase 14 — Advanced Filtering | 2–3 days | ★★★ High | 0 | ~5 |
| Phase 15 — Message Diff | 2–3 days | ★★☆ Medium-High | ~2 | ~3 |
| Phase 16 — Mock Server | 4–5 days | ★★☆ Medium-High | ~4 | ~3 |
| Phase 17 — Load Testing | 3–4 days | ★★☆ Medium | ~3 | ~2 |
| Phase 18 — SSE Support | 3–4 days | ★☆☆ Medium-Low | ~4 | ~2 |
| Phase 19 — Schema Validation | 2–3 days | ★☆☆ Low | ~3 | ~4 |
| **Total** | **16–22 days** | | **~16** | **~19** |

---

## File Map

### Shared WebSocket Infrastructure

| File | Phase | Purpose |
|---|---|---|
| `src/shared/websocket/websocketClient.ts` | 1, 6D | Dispatch client + `WsClientTransport` override |
| `src/shared/websocket/types.ts` | 1, 10, 11, 12, 14, 16, 17 | Connection state, frame, draft, profile, template, TLS, persistence, recording, filter presets, mock server, load test types |
| `src/shared/websocket/websocketStorage.ts` | 2, 10, 14, 16, 19 | Dual-mode persistence (profiles, templates, tab state, history, filter presets, mock rules/config, schema storage) |
| `src/shared/websocket/protocols/protocolTypes.ts` | 3A | Protocol registry + detection types |
| `src/shared/websocket/protocols/protocolDetector.ts` | 3A | URL/subprotocol/message heuristic detector |
| `src/shared/websocket/protocols/socketIoCodec.ts` | 3B | Socket.IO v4 encode/decode |
| `src/shared/websocket/protocols/stompCodec.ts` | 3C | STOMP frame parse/serialize |
| `src/shared/websocket/protocols/graphqlWsCodec.ts` | 3E | GraphQL-WS encode/decode |
| `src/shared/websocket/buildWsNodeOperations.ts` | 4C | `WsNodeOperations` bridge for workflow/harness |
| `src/shared/websocket/websocketNativeTauriTransport.ts` | 6D | Tauri `invoke` bridge + event listeners |
| `src/shared/types/websocket.ts` | 5A | Harness types (action configs, assertion targets, result meta) |
| `src/shared/utils/wsScenarioDefaults.ts` | 5A | Default factories, validation, type resolution |

### WebSocket Studio UI

| File | Phase | Purpose |
|---|---|---|
| `src/features/websocket/WebSocketStudioPage.tsx` | 1, 9, 10, 13 | Top-level page + tab management + persistence + reorder |
| `src/features/websocket/WebSocketConnectPanel.tsx` | 1, 7, 10 | Connection form, status, env preview, history dropdown |
| `src/app/hooks/useWebSocketHistory.ts` | 10 | Connection history CRUD hook |
| `src/features/websocket/WebSocketMessageLog.tsx` | 1, 8, 11, 12, 14, 15, 17, 19 | Message log with virtualized rendering, bookmarks, recording/replay, stats toggle, search modes, filter bar, presets, compare mode, load test toggle, schema validation badges + filter |
| `src/features/websocket/useWebSocketRecording.ts` | 11 | Recording capture + replay state machine |
| `src/features/websocket/useWebSocketMetrics.ts` | 12 | Metrics collection + aggregation hook |
| `src/features/websocket/WebSocketStatsPanel.tsx` | 12 | Stats panel UI with sparklines + metric cards |
| `src/features/websocket/WebSocketMessageDetail.tsx` | 2B, 15, 19 | Detail panel (JSON/Raw/Hex/Validation tabs, Diff ↑/↓ buttons) |
| `src/features/websocket/wsMessageDiffEngine.ts` | 15 | JSON structural diff + LCS line diff + unified diff formatter |
| `src/features/websocket/WebSocketMessageDiff.tsx` | 15 | Diff modal with side-by-side JSON/text comparison |
| `src/features/websocket/WebSocketSavedConnections.tsx` | 2A | Profile list + import/export |
| `src/features/websocket/WebSocketProtocolSelector.tsx` | 3A | Protocol dropdown |
| `src/features/websocket/WebSocketTlsPanel.tsx` | 3D | TLS certificate config |
| `src/features/websocket/useWebSocketStudio.ts` | 1, 6E, 11, 14 | Core hook: lifecycle, messaging, events, bookmarks, filter state + tick |
| `src/features/websocket/useWebSocketStudioTypes.ts` | 1, 11, 14 | Types/constants: direction filter (bookmarked), filter types (WsSearchMode, WsSizeFilter, etc.) |
| `src/features/websocket/wsMessageUtils.ts` | 1, 7 | JSON pretty-print, hex dump, env var helpers |
| `src/features/websocket/wsProtocolHelpers.ts` | 3, 14 | Auto-respond, frame annotation, applyFilters with regex/JSONPath/size/time/content-type |
| `src/features/websocket/KeyValueEditor.tsx` | 1 | Reusable key-value pair editor |
| `src/features/websocket/useDropdownClose.ts` | 1 | Dropdown close-on-click-outside hook |
| `src/features/websocket/WsConnectionTabContent.tsx` | 9, 10, 11, 12, 16, 17, 19 | Per-tab content wrapper + persistence props + recording + metrics hook + mock tab + load test + schema validation integration |
| `src/features/websocket/WebSocketMockServer.tsx` | 16 | Mock server management UI (status, clients, rules, log, broadcast) |
| `src/features/websocket/useWebSocketMockServer.ts` | 16 | Mock server hook: polls status/log, dispatches start/stop/broadcast/rules |
| `src/features/websocket/wsMockRuleEngine.ts` | 16 | Shared rule matching logic (evaluateMatch, evaluateRules, expandTemplate) |
| `src/features/websocket/WebSocketLoadTest.tsx` | 17 | Load test config UI + results dashboard (histogram, sparkline, metric cards) |
| `src/features/websocket/useWebSocketLoadTest.ts` | 17 | Load test orchestration hook (rate control, nonce correlation, cap eviction tracking) |
| `src/features/websocket/wsLoadTestMetrics.ts` | 17 | Latency tracker, throughput sampler, histogram bucketing, template expansion |
| `src/features/websocket/WsConnectionTabBar.tsx` | 9, 13 | Tab bar: add/close/select/rename + DnD reorder + keyboard nav |
| `src/app/hooks/useWebSocketProfiles.ts` | 2A | Profile CRUD + persistence |
| `src/app/hooks/useWebSocketTemplates.ts` | 2B | Template CRUD + persistence |

### Schema Validation (Phase 19)

| File | Phase | Purpose |
|---|---|---|
| `src/features/websocket/wsSchemaTypes.ts` | 19 | Schema definition, validation result, validation error types |
| `src/features/websocket/wsSchemaValidator.ts` | 19 | Ajv compile-once wrapper, cached validators, `validateMessage()` |
| `src/features/websocket/wsSchemaInference.ts` | 19 | Multi-message JSON Schema inference with sample merging |
| `src/features/websocket/useWebSocketSchema.ts` | 19 | Schema CRUD hook, validation state, filter management |
| `src/features/websocket/WebSocketSchemaPanel.tsx` | 19 | Collapsible schema management panel UI |

### SSE Studio (Phase 18)

| File | Phase | Purpose |
|---|---|---|
| `src/features/sse/sseTypes.ts` | 18 | SSE event types, connection state, config |
| `src/features/sse/sseParser.ts` | 18 | W3C SSE text protocol parser |
| `src/features/sse/useSseConnection.ts` | 18 | SSE connection hook (fetch + ReadableStream) |
| `src/features/sse/SseStudioPage.tsx` | 18 | SSE Studio page layout |
| `src/features/sse/SseMessageLog.tsx` | 18 | Virtualized SSE message log |
| `src/features/sse/SseEventDetail.tsx` | 18 | Event detail panel |
| `src/styles/sse-studio.css` | 18 | SSE-specific styling |

### Workflow Nodes

| File | Phase | Purpose |
|---|---|---|
| `src/features/workflow/components/nodes/WsConnectNode.tsx` | 4A | Canvas node |
| `src/features/workflow/components/nodes/WsSendNode.tsx` | 4A | Canvas node |
| `src/features/workflow/components/nodes/WsReceiveNode.tsx` | 4A | Canvas node |
| `src/features/workflow/components/nodes/WsTriggerNode.tsx` | 4A | Canvas node |
| `src/features/workflow/components/configs/WsConnectConfig.tsx` | 4B | Config panel |
| `src/features/workflow/components/configs/WsSendConfig.tsx` | 4B | Config panel |
| `src/features/workflow/components/configs/WsReceiveConfig.tsx` | 4B | Config panel |
| `src/features/workflow/components/configs/WsTriggerConfig.tsx` | 4B | Config panel |
| `src/features/workflow/components/configs/WsConfigShared.tsx` | 4B | Shared config sub-components |
| `src/features/workflow/components/configs/wsConfigFactories.ts` | 4B | Config factory helpers |
| `src/features/workflow/engine/graphRunnerWsNodeHandlers.ts` | 4C | Engine handlers for 4 WS node types |

### Harness / Assertion Engine

| File | Phase | Purpose |
|---|---|---|
| `src/engine/wsExecution.ts` | 5B | WS action dispatcher → `RequestResult` |
| `src/engine/wsAssertionEvaluation.test.ts` | 5C | WS assertion evaluation tests |
| `src/features/scenarios/components/WsScenarioEditor.tsx` | 5D | WS scenario config panel |
| `src/shared/components/data-mapper/adapters/wsExtractionAdapter.ts` | 5F | Data Mapper adapter for WS messages |

### Server Proxy

| File | Phase | Purpose |
|---|---|---|
| `src-server/websocket/contracts.ts` | 1 | Server-side operation types |
| `src-server/websocket/websocket-service.ts` | 1 | Connection manager (`ws` library) |
| `src-server/routes/websocket-routes.ts` | 1 | Express routes (`/api/ws/*`) |

### Tauri Native Module

| File | Phase | Purpose |
|---|---|---|
| `src-tauri/src/websocket/types.rs` | 6A | Rust types aligned with `contracts.ts` |
| `src-tauri/src/websocket/envelope.rs` | 6A | Success/error envelope helpers |
| `src-tauri/src/websocket/state.rs` | 6A | `WsState` + `ConnectionHandle` |
| `src-tauri/src/websocket/config.rs` | 6B | TLS config builder (rustls) |
| `src-tauri/src/websocket/lifecycle.rs` | 6B | `ws_connect`, `ws_disconnect`, `ws_status` |
| `src-tauri/src/websocket/operations.rs` | 6C | `ws_send`, `ws_ping`, `ws_receive_next` |
| `src-tauri/src/websocket/message.rs` | 6C | Frame type conversion |
| `src-tauri/src/websocket/mod.rs` | 6A | Module tree |

### Modified Files (key cross-cutting changes)

| File | Phase | Change |
|---|---|---|
| `src/features/workflow/types/workflow.ts` | 4A | `WorkflowNodeType` union: `+ wsConnect \| wsSend \| wsReceive \| wsTrigger` |
| `src/features/workflow/engine/graphRunner.ts` | 4C | WS node dispatch + `wsOperations` param + `disconnectAll()` cleanup |
| `src/engine/executor.ts` | 5B | `executeWsAction` dispatch + `wsOperations` param |
| `src/engine/validator.ts` | 5C | `wsField` + `wsNumericField` assertion evaluation |
| `src/engine/dataSourceExpander.ts` | 5B | WS action + assertion field interpolation |
| `src/features/scenarios/components/TestEditorModal.tsx` | 5D | Transport selector + WS config panel |
| `src-tauri/src/lib.rs` | 6A | `mod websocket`, `.manage(WsState)`, 6 commands |
| `src-tauri/Cargo.toml` | 6A | `tokio-tungstenite` 0.28 + `rustls-pemfile` 2 |
| `src/app/main.tsx` | 6D | `setWsClientTransport(wsNativeTauriTransport)` |
| `src/app/App.tsx` | 1, 7 | WebSocket Studio route + env context props |

---

## Manual Testing Guide

### Starting the app

```bash
# Terminal 1 — backend server (needed for proxy mode)
npm run dev:server

# Terminal 2 — frontend
npm run dev
```

### Local echo server (Docker)

```bash
docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
# Connect to: ws://localhost:8765
```

### Protocol-specific servers

```bash
# Socket.IO echo server
cd docker/websocket/socketio && docker compose up -d
# Connect to: ws://localhost:3001 (protocol: Socket.IO)

# RabbitMQ + STOMP
cd docker/websocket/stomp && docker compose up -d
# Connect to: ws://localhost:15674/ws (protocol: STOMP)

# GraphQL subscription server
cd docker/websocket/graphql && docker compose up -d
# Connect to: ws://localhost:4000/graphql (protocol: GraphQL-WS)
```

---

## Deferred & Future Items

> Conscious scope decisions — none are bugs.

### Deferred sub-phases (planned but scoped out of initial implementation)

| Sub-Phase | What It Would Add | Origin |
|---|---|---|
| Phase 16B — Tauri Rust Mock Server | Native `tokio-tungstenite` mock server for desktop (currently Express-only) | Phase 16 |
| Phase 16C — Recording Replay as Mock | Replay `.wsrecording.json` files as mock server responses (timing modes, position tracking) | Phase 16 |
| Phase 17B — Multi-Connection Load Test | Open multiple headless connections for concurrent load testing (separate connection manager) | Phase 17 |
| Phase 19 — Schema Persistence | Wire `loadWsSchemas`/`saveWsSchemas` into connection profile save/load (helpers exist in `websocketStorage.ts`) | Phase 19 |

### Future features (not yet planned)

| Feature | Rationale | Origin |
|---|---|---|
| Raw frame inspector (opcode/mask/FIN) | Requires server-proxy interception; browser API doesn't expose frame metadata | Phase 1 |
| Standalone WS auto-connect (send/receive without explicit connect test) | Types have `url` field but executor/UI don't support auto-connect/disconnect | Phase 5 |
| Cross-tab message routing | Tabs are fully independent; routing needs shared connection registry | Phase 9 |

### Deferred UX items

| Item | Current State | Origin |
|---|---|---|
| Timeline scrubber for session replay | Complex drag interaction for modest value; current controls (play/pause/speed) suffice | Phase 11.3 |
| Subprotocol interpolation | `{{var}}` placeholders in subprotocol field are not resolved; low-value edge case | Phase 7 |
| Multi-line message rows (variable height) | Fixed 26px row height (`white-space: nowrap`); variable height would require `measureElement` from react-virtual | Phase 8 |

### Deferred protocol support

| Protocol | Rationale |
|---|---|
| SockJS | Fallback transport for blocked WS environments; low value for testing tool |
| Socket.IO BINARY_EVENT/BINARY_ACK | Complex multi-packet binary attachment protocol |
| GraphQL introspection / auto-complete | Schema-aware auto-complete is a stretch goal |

### Deferred technical items

| Item | Current State |
|---|---|
| Idle Connection GC (Rust) | `last_activity_ms` tracked; explicit disconnect + read-loop self-cleanup covers most cases |
| True cross-transport E2E parity tests | Mock-based parity verified; live Tauri + Express simultaneous testing needs E2E infrastructure |
| WebSocket compression (permessage-deflate) | Browser supports natively; Tauri would need manual `rustls` implementation |
| Version diff UI for `actionTypeChanged` flags | Flags computed in `testDefinitionVersioning.ts` but UI not surfaced |
| Runtime WS extraction application | Adapter stores extractions but `wsExecution.ts` doesn't apply during execution |
