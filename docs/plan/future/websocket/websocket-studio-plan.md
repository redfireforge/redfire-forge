# WebSocket Studio — Implementation Plan

> Branch: `feature/websocket-studio`  
> Created: 2026-06-07  
> Last Reviewed: 2026-06-09 (Full plan re-evaluation — Phase 4 verified complete; Phase 5A–5E verified complete; all checklists/trackers corrected)
> Status: 🚧 In Progress — Phase 1–3E complete; Phase 4A–4E complete; Phase 5A–5E complete (573+ tests); **Remaining: Phase 5F + Phase 6**

---

## Table of Contents

1. [Overview & Goals](#overview--goals)
2. [Context: Why WebSocket Studio?](#context-why-websocket-studio)
3. [Competitive Landscape](#competitive-landscape)
4. [Design Decisions](#design-decisions)
5. [Navigation & Page Structure](#navigation--page-structure)
6. [Phase 1 — Core Connect & Send/Receive](#phase-1--core-connect--sendreceive)
7. [Phase 2 — Saved Connections, Message Templates & Auto-Reconnect](#phase-2--saved-connections-message-templates--auto-reconnect)
8. [Phase 3 — Protocol Support (Socket.IO, STOMP, TLS/mTLS, GraphQL-WS)](#phase-3--protocol-support-socketio-stomp-tlsmtls-graphql-ws)
9. [Phase 4 — Workflow Integration](#phase-4--workflow-integration)
10. [Phase 5 — Runner & Assertions](#phase-5--runner--assertions)
11. [Phase 6 — Tauri Native Transport](#phase-6--tauri-native-transport)
12. [Test Plan](#test-plan)
13. [Type Definitions](#type-definitions)
14. [File Map](#file-map)
15. [Phase Status Tracker](#phase-status-tracker)
16. [Open Questions / Risks](#open-questions--risks)

---

## Overview & Goals

**WebSocket Studio** is a standalone, interactive debug tool for connecting to WebSocket endpoints, sending messages, and inspecting received messages in real time — analogous to how **Kafka Studio** works for Kafka brokers and **Requests** works for HTTP testing.

Unlike workflow node configs (`wsSendConfig`, `wsReceiveConfig`) which will be embedded inside workflow edges and used at design time, WebSocket Studio is a **first-class page** where developers and testers can:

- Connect to any WebSocket endpoint (`ws://` or `wss://`) with optional auth headers, subprotocols, and query parameters
- Send text or binary messages and immediately see acknowledgments
- Receive and inspect messages in a live, auto-scrolling message log with timestamps
- Filter received messages by content, type (text/binary), or direction (sent/received)
- Save connection profiles and message templates for reuse
- Measure connection timing, message latency, and throughput
- Feed received messages into workflows ("Use as Workflow Input")

### Key Analogy

| HTTP world | Kafka world | WebSocket world |
|---|---|---|
| Requests page (send HTTP, see response) | Publish Studio (produce message, see offset) | Send Panel (send frame, see echo/response) |
| — | Consume Studio (poll messages) | Message Log (real-time incoming frames) |
| Catalog (organized tests) | Templates (saved sessions) | Saved Connections (endpoint profiles) |
| Environments (base URL, auth) | Kafka Settings (clusters, auth) | Connection Profiles (URL, headers, subprotocols) |

---

## Context: Why WebSocket Studio?

### The gap today

RedfireForge supports HTTP (Requests, Catalog, Test Runner) and Kafka (Studio, Topics, Schema Registry) as first-class protocols. WebSocket is the third most common real-time protocol in modern APIs, used for:

- **Chat and messaging** — Slack, Discord, Intercom
- **Live dashboards** — Financial tickers, monitoring feeds, IoT telemetry
- **Collaborative editing** — Google Docs, Figma multiplayer
- **Gaming** — Real-time game state synchronization
- **Streaming APIs** — Live sports scores, social feeds, notification systems

Developers testing WebSocket APIs currently use standalone tools (Postman, Insomnia, wscat, websocat) with no integration into their test harness, workflow automation, or assertion framework. RedfireForge can provide a unified experience.

### What makes WebSocket different from HTTP and Kafka

| Dimension | HTTP | Kafka | WebSocket |
|---|---|---|---|
| Connection model | Stateless request/response | Long-lived consumer/producer sessions | Persistent full-duplex connection |
| Message direction | Client → Server → Client (per request) | Produce (push) / Consume (pull) | Bidirectional (either side can send anytime) |
| Message format | Structured (headers + body) | Key + Value + Headers | Frames (text or binary, no built-in structure) |
| Protocol overhead | HTTP headers per request | Kafka protocol framing | Minimal (2-byte frame header after handshake) |
| Lifecycle | Open → Request → Response → Close | Connect → Produce/Consume → Disconnect | Handshake → Open → Messages ↔ → Close |
| Real-time nature | Polling or SSE for push | Consumer polls or long-poll | Native push from server |
| Auth model | Per-request (header/cookie) | Per-connection (SASL/TLS) | Per-handshake (header/query/cookie) + message-level tokens |

### Why it belongs in Protocols domain

WebSocket Studio fits the established Protocols domain pattern:

```
Activity Bar: API | Workflow | Harness | Gallery | Protocols | Settings

Protocols sub-nav:
  kafka-message-studio   → "Kafka"      (internal tabs: Publish | Consume | Topics | Schema Registry)
  websocket-studio       → "WebSocket"  (internal tabs: Connect | Messages | Saved [Phase 2A])
  (future) graphql-studio → "GraphQL"
  (future) grpc-studio    → "gRPC"
```

Connection configuration (endpoint profiles) stays in the WebSocket Studio page itself (unlike Kafka where cluster configs live in Settings) because WebSocket connections are typically per-endpoint and per-session, not shared infrastructure.

---

## Competitive Landscape

> **Last researched:** 2026-06-08 — Deep analysis of 7 commercial/open-source WebSocket clients.

### Feature Matrix

| Feature | Postman | Insomnia | Hoppscotch | Firecamp | WS King | wscat/websocat | **RedfireForge** |
|---|---|---|---|---|---|---|---|
| Connect/Disconnect | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Phase 1 |
| Custom Headers | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ (CLI) | ✅ Phase 1B |
| Query Parameters | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ Phase 1B |
| Subprotocols | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ Phase 1 |
| Message Format Selector | ✅ (Text/JSON/XML/HTML/Binary) | ✅ (Text/JSON) | ❌ | ✅ (Text/JSON/Binary) | ❌ | ❌ | ✅ Phase 2B |
| JSON Pretty-Print / Beautify | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 2B |
| Binary (Base64/Hex) Send | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ Phase 2B |
| Hexdump View | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ Phase 2B |
| Save Messages/Payloads | ✅ (saved messages) | ❌ | ❌ | ✅ (message collection) | ✅ (saved payloads) | ❌ | ✅ Phase 2B |
| Save Connection Profiles | ✅ (collections) | ✅ (workspace) | ❌ | ✅ (collections) | ✅ (projects) | ❌ | ✅ Phase 2A |
| Auto-Reconnect | ✅ (configurable) | ❌ | ❌ | ✅ (configurable) | ✅ | ✅ (websocat) | ✅ Phase 2C |
| Close with Code/Reason | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ Phase 2C |
| Message Filtering | ❌ | ✅ (basic) | ❌ | ❌ | ❌ | ❌ | ✅ Phase 1 |
| Env Variables in URL | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 🔶 Partial (validation + preview; full env context deferred) |
| Config Lock While Connected | ❌ | ✅ (read-only banner) | ❌ | ❌ | ❌ | N/A | ✅ Phase 2A |
| Virtualized Message Log | ❌ | ✅ (event-log-view) | ❌ | ❌ | ❌ | N/A | ⬜ Future |
| Ping/Pong Visibility | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ⬜ Future |
| Multiple Concurrent Connections | ❌ | ❌ | ❌ | ❌ | ✅ (tabs) | ❌ | ⬜ Future |
| Socket.IO Protocol | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ Phase 3B |
| STOMP Protocol | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 3C |
| GraphQL-WS Protocol | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 3E |
| TLS / mTLS Support | ✅ (Electron) | ✅ (Electron) | ❌ | ❌ | ❌ | ✅ | ✅ Phase 3D |
| Keyboard Navigation (log) | ❌ | ✅ | ❌ | ❌ | ❌ | N/A | ✅ Phase 2B |
| Resizable Message Detail | ❌ | ✅ | ❌ | ❌ | ❌ | N/A | ✅ Phase 2B |
| Workflow Integration | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 4 |
| Assertion Engine | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 5 |
| Native Desktop Transport | ❌ (Electron) | ❌ (Electron) | ❌ | ❌ (Electron) | N/A | N/A | ⬜ Phase 6 |

### Per-Tool Analysis

#### Postman (Market Leader)

**Architecture:** Electron app → Node.js `ws` library (same proxy pattern we use). Desktop-only; WebSocket requires the installed app (not web client).

**Message Composition:** Rich format selector at bottom-left of editor: Text, JSON, XML, HTML, Binary (Base64 or Hexadecimal). JSON/XML/HTML get syntax highlighting + Beautify button. This is a key UX differentiator.

**Saved Messages:** "Saved Messages" pane beside the compose area. Save current message, create blank messages, load saved messages into editor. Messages are saved with the request, not globally.

**Collections:** WebSocket requests are saved into collections but with limitations — they can't coexist with HTTP requests in the same collection (beta state). Each saved request preserves URL, headers, params, and auth config.

**Settings Tab:** Server certificate verification toggle, handshake timeout, reconnection attempts, reconnection interval, max message size.

**Scripting:** JavaScript pre-request scripts and on-message event handlers for WebSocket. This enables automated assertions but is code-heavy (not visual like our assertion engine).

**Viewing Messages:** Response pane shows all messages with connection status badge. Each message expandable to show full content with format switching (Text/HTML/JSON/XML) and hexdump toggle. Search within expanded messages.

**Key takeaway for us:** Message format selector and JSON beautify are table-stakes features we're missing. Add to Phase 2B.

#### Insomnia (Developer-Focused)

**Architecture:** Electron app → `ws` library in main process. Event log stored as NDJSON on disk. Observer pattern (push) replaced polling in late 2025 for better performance.

**WebSocket Request Pane:** Tabs for Params, Headers, Auth, Docs. Uses `WebSocketActionBar` for Connect/Disconnect. Config fields are locked (read-only banner) while connected — nice UX to prevent accidental changes.

**Event Log:** Virtualized list (`EventLogView`) with keyboard navigation (up/down arrows to navigate events, Enter to expand). Resizable detail panel. Filtering by event type.

**Environment Variables:** Full environment variable support in WebSocket URLs and headers (e.g., `{{ base_ws_url }}`), same system as REST requests. Critical for dev/staging/prod switching.

**Key takeaway for us:** Config-lock-while-connected and env variable support are professional touches we should add to Phase 2A. Keyboard navigation in log for Phase 2B.

#### Firecamp (Open Source, AGPL-3.0)

**Architecture:** TypeScript + Electron. Focuses on multi-protocol playground concept.

**Unique features:**
- **Close with status code and reason** — User can specify a numeric close code (1000, 1001, etc.) and text reason when disconnecting. This is unique among GUI tools and very useful for testing close-code handling.
- **Ping/Pong visibility** — Heartbeat events shown in the log with distinct styling. Toggle to show/hide.
- **Message Collection** — Save and organize WebSocket messages as a collection. Team collaboration built-in.
- **Binary payload support** — Send as Text, JSON, Binary, ArrayBuffer.
- **Reconnect config** — Max reconnect attempts, protocol version, max payload size.

**Key takeaway for us:** Close-with-code/reason is a missing feature that's easy to implement and very useful for testing. Add to Phase 2C.

#### Hoppscotch (Open Source, MIT → Proprietary)

**Architecture:** Nuxt.js web app (PWA). Simple but clean. Single-protocol tab selector (WebSocket, SSE, Socket.IO, MQTT).

**WebSocket features:** Basic — URL, protocols, connect/disconnect, send text, see logs. No custom headers (browser limitation, no proxy). No saved connections or message templates. No filtering.

**Key takeaway for us:** Hoppscotch validates our architectural choice — without a server proxy, you can't support custom headers. Our proxy approach is correct.

#### WebSocket King (Chrome Extension / Web App)

**Architecture:** Browser-based, Chrome extension. Simple but effective.

**Unique features:**
- **Multiple concurrent connections** — Open several connections side-by-side.
- **Saved Payloads** — Save frequently used messages with "Save As" button. Payloads are scoped per project.
- **Projects** — Organize connections by project. Switch between projects.
- **Auto-reconnect** — Toggle to auto-reconnect on disconnection.

**Key takeaway for us:** The "Saved Payloads" terminology and project-scoped organization are good patterns. Multiple connections are a differentiator we could add later.

### RedfireForge Differentiators (vs ALL competitors)

1. **Workflow integration** — WebSocket nodes in workflow designer (connect → send → wait for response → assert → HTTP call). **No competitor has this.**
2. **Visual assertion engine** — Reuse the existing 24-operator validation engine on WebSocket message payloads. **No competitor has visual assertions; Postman only has scripted.**
3. **Data Mapper** — `wsExtractionAdapter` for visual message extraction and transformation. **Unique to RedfireForge.**
4. **Dual native platform** — Browser + Tauri desktop with native `tokio-tungstenite` for performance. **No competitor uses native desktop transport (all are Electron).**
5. **Test Runner** — WebSocket scenarios in the existing test harness with parameterized data sources. **No competitor integrates WS into a perf test runner.**
6. **Results publishing** — WebSocket test results alongside HTTP and Kafka in unified dashboard. **No competitor provides cross-protocol results aggregation.**
7. **Server proxy with browser fallback** — Dual transport (proxy for headers, direct for speed). **Postman/Insomnia always use proxy; Hoppscotch is always direct.**

---

## Design Decisions

### Decision 1: Browser-native WebSocket for web, Tauri-native for desktop

**Options:**
- A. Browser connects directly to WebSocket endpoint (no server proxy)
- B. Express server proxies all WebSocket connections
- C. Hybrid: browser-native for web, Tauri-native for desktop

**Chosen: C (Hybrid)**

**Rationale:**
- Browser `WebSocket` API is well-supported, low-latency, and handles `ws://` and `wss://` natively
- No need for server-side proxying for the studio use case (unlike Kafka which needs kafkajs on the server)
- Server proxy is still needed for: (a) custom TLS certificates, (b) bypassing CORS, (c) workflow execution in Node.js context
- Tauri uses `tokio-tungstenite` for native performance and custom TLS/cert support
- The Express server provides a **proxy route** for connections requiring custom TLS or CORS bypass, but the default path is direct browser connection

**Updated implication (after Phase 1 architecture review):** Because the browser `WebSocket` API cannot send custom HTTP headers on the handshake, the **server proxy is the default transport** — matching Kafka's pattern where all operations route through Express. This simplifies the architecture:

1. **Server proxy (default)** — Express holds the WebSocket connection, UI polls for messages (same as Kafka). Supports custom headers, auth tokens, custom TLS.
2. **Browser-direct (optimization)** — When no custom headers are needed (URL + subprotocols only), the UI may connect directly via `new WebSocket()` for lower latency. This is transparent to the user.
3. **Tauri native (Phase 6)** — `tokio-tungstenite` via Tauri commands replaces the server proxy on desktop.

### Decision 2: Connection-centric page with message log

**Layout:** Single-page with three internal tabs:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Connect]  [Messages]  [Saved Connections]                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Connect tab:                                                           │
│  ┌─────────────────────────────────────────┬───────────────────────────┐│
│  │  URL: [ws://localhost:8765_____________] │  Status: ● Connected     ││
│  │  Subprotocols: [_____________________ ] │  Latency: 42ms           ││
│  │  Headers: [+ Add Header]                │  Uptime: 2m 15s          ││
│  │  Query Params: [+ Add Param]            │  Messages: ↑12 ↓34       ││
│  │  [Connect] [Disconnect]                 │                           ││
│  ├─────────────────────────────────────────┴───────────────────────────┤│
│  │  Compose:  [Message body________________________]  [Send]  [Ping]  ││
│  │  Format: [Text ▾]  Template: [None ▾]                               ││
│  ├────────────────────────────────────────────────────────────────────-┤│
│  │  Message Log (real-time, auto-scroll):                              ││
│  │  ↑ 12:00:01.234  text   {"type":"subscribe","channel":"orders"}     ││
│  │  ↓ 12:00:01.456  text   {"type":"subscribed","channel":"orders"}    ││
│  │  ↓ 12:00:02.789  text   {"type":"message","data":{"id":1,...}}      ││
│  │  ↓ 12:00:03.012  text   {"type":"message","data":{"id":2,...}}      ││
│  │  ↑ 12:00:04.100  text   {"type":"ping"}                            ││
│  │  ↓ 12:00:04.102  text   {"type":"pong"}                            ││
│  │  ↑ 12:00:05.500  binary [42 bytes]                                  ││
│  └────────────────────────────────────────────────────────────────────-┘│
└─────────────────────────────────────────────────────────────────────────┘
```

**Rationale:** WebSocket is inherently bidirectional — splitting send/receive into separate panels (like Kafka Publish/Consume) would be unnatural. A single unified view with a compose bar and message log matches how developers think about WebSocket conversations.

### Decision 3: Connection profiles (not centralized settings)

**Options:**
- A. Store WebSocket endpoint configs in Settings → WebSocket (like Kafka clusters)
- B. Store as "Saved Connections" inside the WebSocket Studio page
- C. Reuse Environments with a `wsEndpoint` field

**Chosen: B (Saved Connections inside the studio)**

**Rationale:**
- WebSocket endpoints are typically per-API, per-environment — not shared infrastructure like Kafka clusters
- Users often connect to many different endpoints in a session (chat server, trading feed, notification service)
- Saved Connections can include the full profile: URL + headers + query params + subprotocols + notes
- Environments can still be referenced for base URL resolution (e.g., `{{baseWsUrl}}/feed`)

### Decision 4: Message log model

**Options:**
- A. Ring buffer (fixed size, oldest messages dropped) — like Kafka streaming
- B. Append-only with virtual scrolling — show all messages, virtualize rendering
- C. Capped list with explicit "Clear" — configurable max, manual clear

**Chosen: C (Capped list with explicit Clear)**

**Rationale:**
- WebSocket sessions can generate thousands of messages; unbounded lists cause memory issues
- Default cap: 1000 messages (configurable per session: 100 / 500 / 1000 / 5000)
- "Max reached" indicator when cap is hit (same pattern as Kafka consume)
- Clear button resets the log
- Export before clearing for analysis

### Decision 5: Ping/Pong visibility

WebSocket has built-in ping/pong frames for keepalive. Show these in the message log as a toggle:

- **Default: hidden** — most users don't care about keepalive frames
- **Toggle: "Show Control Frames"** — reveals ping, pong, and close frames in the log
- Control frames rendered with a distinct style (muted, smaller font, labeled `[PING]`/`[PONG]`/`[CLOSE]`)

---

## Navigation & Page Structure

### Changes to `src/app/utils/appTabUtils.ts`

```ts
// Extend Tab union:
export type Tab = ... | 'kafka-message-studio' | 'websocket-studio';

// Extend PROTOCOLS_TABS:
const PROTOCOLS_TABS = new Set<Tab>(['kafka-message-studio', 'websocket-studio']);
```

### Changes to `src/app/components/AppSubNav.tsx`

```ts
protocols: [
  { tab: 'kafka-message-studio', label: 'Kafka' },
  { tab: 'websocket-studio', label: 'WebSocket' },
],
```

### Changes to `src/app/App.tsx`

```tsx
import { WebSocketStudioPage } from '../features/websocket/WebSocketStudioPage';

// In the render block:
{activeTab === 'websocket-studio' && (
  <div className="app-tab-pane" style={{ display: 'flex', flexDirection: 'column' }}>
    <WebSocketStudioPage />
  </div>
)}
```

No sidebar needed — same pattern as Kafka (full-width pane in Protocols domain).

---

## Phase 1 — Core Connect & Send/Receive

> **Goal:** Users can connect to any WebSocket endpoint, send text messages, and see received messages in a real-time log.

### Phase 1 Scope

- WebSocket URL input with protocol detection (`ws://` / `wss://`)
- Connect/Disconnect lifecycle with status indicator
- Custom headers and query parameters for the handshake (via extracted `KeyValueEditor`)
- Subprotocol negotiation field
- Compose bar: type a message and send (text mode)
- Real-time message log with direction arrows, timestamps, and auto-scroll
- Connection timing display (latency, uptime, message counts)
- Error display for connection failures (DNS, TLS, auth, timeout)
- Guard state when no connection is configured
- Search bar with content filtering + direction filter (all/sent/received)
- Server proxy for custom headers (browser `WebSocket` API limitation)
- Browser-direct optimization when no custom headers needed

**Deferred from original Phase 1 scope:**
- ~~Ping button for manual keepalive~~ — browser `WebSocket` API cannot send raw ping frames; deferred until proxy support or Phase 6 native transport
- ~~Control frame toggle (ping/pong/close visibility)~~ — browser `WebSocket.onmessage` doesn't surface WebSocket control frames; protocol-level keepalives (Socket.IO, STOMP, GraphQL-WS) are handled by `wsProtocolHelpers` in Phase 3
- ~~Export button for message log~~ — not implemented in toolbar; profile export exists in Saved tab

### Phase 1 Architecture

#### Transport Layer

> **Implementation note:** During development, several planned-as-separate components were consolidated into fewer files. The compose bar, status bar, and guard state are integrated into their parent components rather than being standalone. The two planned hooks (`useWebSocketConnection` + `useWebSocketMessageLog`) were merged into a single `useWebSocketStudio` hook that manages all connection, message, and UI state. This reduced inter-component prop drilling and simplified the data flow.

```
src/shared/websocket/
  websocketClient.ts          — WebSocket dispatch client (proxy or browser-direct)
  types.ts                    — All shared types (WsFrame, WsConnectionState, WsConnectionDraft,
                                 WsConnectionProfile, WsReconnectState, WsCloseDetail,
                                 WsFrameProtocolMeta, WsTlsConfig, + factory helpers)

src/features/websocket/
  WebSocketStudioPage.tsx     — Top-level page (Connect | Messages | Saved tabs), guard state inline
  WebSocketConnectPanel.tsx   — URL input, headers, params, subprotocols, connect/disconnect buttons,
                                 status display (latency, uptime, counters), protocol selector,
                                 auto-reconnect toggle + status
  WebSocketMessageLog.tsx     — Real-time message log + compose bar (message input, send button,
                                 format selector, template dropdown) + protocol compose modes
                                 (Socket.IO event, STOMP command, GraphQL query)
  useWebSocketStudio.ts       — Unified hook: connection lifecycle, message log state, filtering,
                                 reconnect logic, protocol detection, TLS state
  wsProtocolHelpers.ts        — Protocol-aware helpers: auto-respond (SIO ping/pong, STOMP heartbeat,
                                 GQL-WS pong), frame annotation, filter logic
  wsMessageUtils.ts           — Message formatting utilities (JSON pretty-print, hex dump, size format)
```

#### Server-side work for Phase 1: Proxy required for custom headers

**Critical browser limitation:** The browser `WebSocket` API (`new WebSocket(url, protocols)`) does **not** support custom HTTP headers on the handshake request. Only `Sec-WebSocket-Protocol` (subprotocols) and cookies can be sent. This means:

- Auth tokens in `Authorization: Bearer xxx` headers **cannot** be sent via browser-native WebSocket
- Custom headers (e.g., `X-API-Key`, `X-Request-ID`) are **impossible** without a proxy

**Solution for Phase 1:** Implement a lightweight Express proxy from the start:

```
POST /api/ws/connect     → open server-side WebSocket, return connectionId
POST /api/ws/send        → send message on connectionId
GET  /api/ws/messages    → poll received messages (ring buffer per connection)
POST /api/ws/disconnect  → close server-side connection
GET  /api/ws/status      → connection state, uptime, counters
```

This follows the same pattern as Kafka (all operations routed through Express). The browser never holds the WebSocket connection directly — the server does, and the UI polls for messages (same as Kafka streaming).

**When browser-direct is used:** If no custom headers are configured (URL + optional subprotocols only), the UI may optionally use `new WebSocket()` directly for lower latency. This is a transparent optimization, not a user-visible mode switch.

**Implication:** Phase 3D (server proxy for custom TLS, CORS bypass, mTLS) is **no longer separate** — the proxy exists from Phase 1. Phase 3D just adds TLS certificate upload and mTLS support to the existing proxy.

```
src-server/websocket/
  contracts.ts                — WebSocket operation types and envelopes
  websocket-service.ts        — Connection manager (ws library)

src-server/routes/
  websocket-routes.ts         — Express proxy routes (/api/ws/*)

src-server/
  webhook-server.ts           MODIFY — Mount websocket routes via createWebSocketRouter()
```

### Phase 1 Type Definitions

```ts
// ── Connection Types ──────────────────────────────────────────────────

// Note: unlike Kafka's 'testing' state (used for optimistic connect UX), WebSocket uses
// 'connecting' which maps to WebSocket.CONNECTING (readyState=0).
// 'closing' is WebSocket-specific — the close handshake is a distinct protocol step
// (WebSocket.CLOSING, readyState=2) that Kafka's TCP disconnect doesn't have.
export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'closing' | 'error';

export interface WsConnectionSnapshot {
  state: WsConnectionState;
  url?: string;
  connectedAt?: string;
  closedAt?: string;
  closeCode?: number;
  closeReason?: string;
  lastError?: string;
  protocol?: string;           // negotiated subprotocol
  extensions?: string;         // negotiated extensions
  latencyMs?: number;          // handshake time (ms)
}

// WsConnectionProfile is defined but not used until Phase 2 (Saved Connections).
// Phase 1 uses WsConnectionDraft for the active connection form only.
// See Phase 2 types for the full WsConnectionProfile with persistence fields.

export interface WsConnectionDraft {
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  queryParams: { key: string; value: string; enabled: boolean }[];
  subprotocols: string;        // comma-separated for input field
}

// ── Message Types ─────────────────────────────────────────────────────

export type WsFrameDirection = 'sent' | 'received';
export type WsFrameType = 'text' | 'binary' | 'ping' | 'pong' | 'close';

export interface WsFrame {
  id: string;                  // unique ID for React keys
  direction: WsFrameDirection;
  type: WsFrameType;
  data: string;                // text content or base64 for binary
  size: number;                // bytes
  timestamp: string;           // ISO 8601 with milliseconds
  protocolMeta?: WsFrameProtocolMeta;  // decoded protocol info (Phase 3B+)
}
// Note: System frames (e.g. "Connected to...", "CLOSE SENT", "CLOSE ACK") are WsFrame
// instances with an ad-hoc `isSystem: true` property added via type cast:
//   (frame as WsFrame & { isSystem?: boolean }).isSystem = true
// This avoids adding a formal field to WsFrame for what is a rendering-only concern.
// Detection in MessageLog also checks frame.type === 'close' and protocolMeta?.isSystemPacket.

// ── Hook Return Type ──────────────────────────────────────────────────
// Note: the original plan had separate UseWebSocketConnectionReturn and
// UseWebSocketMessageLogReturn interfaces. During implementation, these
// were consolidated into a single UseWebSocketStudioReturn that manages
// all connection, message, reconnect, protocol, and TLS state.

export interface UseWebSocketStudioReturn {
  // Connection
  draft: WsConnectionDraft;
  setDraft: (patch: Partial<WsConnectionDraft>) => void;
  connection: WsConnectionSnapshot;
  connect: () => void;
  disconnect: (detail?: WsCloseDetail) => void;
  send: (data: string, format?: 'text' | 'json' | 'binary') => void;

  // Messages
  messages: WsFrame[];
  filteredMessages: WsFrame[];
  maxMessages: number;
  setMaxMessages: (n: number) => void;
  isMaxReached: boolean;
  searchText: string;
  setSearchText: (v: string) => void;
  directionFilter: 'all' | 'sent' | 'received';
  setDirectionFilter: (v: 'all' | 'sent' | 'received') => void;
  clearMessages: () => void;

  // Status
  sentCount: number;
  receivedCount: number;
  uptime: number | null;
  transportMode: 'direct' | 'proxy';

  // Reconnect (Phase 2C)
  autoReconnect: boolean;
  setAutoReconnect: (enabled: boolean) => void;
  reconnectState: WsReconnectState;
  cancelReconnect: () => void;
  reconnectIntervalMs: number;
  setReconnectIntervalMs: (ms: number) => void;
  maxReconnectAttempts: number;
  setMaxReconnectAttempts: (n: number) => void;

  // Protocol (Phase 3A)
  protocolMode: WsProtocolMode;
  setProtocolMode: (mode: WsProtocolMode) => void;
  detectedProtocol: WsProtocolDetectionResult | null;

  // TLS (Phase 3D)
  tlsConfig: WsTlsConfig;
  setTlsConfig: (patch: Partial<WsTlsConfig>) => void;
}
```

### Phase 1 Component Render Flow

1. **`WebSocketStudioPage`** — top-level container
   - Internal tab bar: Connect | Messages | Saved
   - Default tab: Connect
   - Instantiates `useWebSocketStudio()` (unified hook for all connection, message, and UI state)
   - Instantiates `useWebSocketProfiles()` and `useWebSocketTemplates()` (persistence hooks)
   - Guard state is inline (rendered directly when URL blank + disconnected)

2. **Connect tab content:**
   - Config lock banner (inline `<div>`, visible only when connected)
   - `WebSocketConnectPanel` — URL, headers, query params, subprotocols, Connect/Disconnect buttons, status display (state badge, latency, uptime, counters), protocol selector, auto-reconnect toggle
   - `WebSocketTlsPanel` — collapsible TLS/mTLS configuration
   - Guard state OR `WebSocketMessageLog` (with compose bar integrated)

3. **Messages tab content:**
   - `WebSocketMessageLog` (full height, with compose bar)

4. **Saved tab content:**
   - `WebSocketSavedConnections` — profile list with CRUD, load, import/export

### Phase 1 UI Sections

#### 1.1 Connection Panel (`WebSocketConnectPanel`)

> **Note:** The connection panel also includes the status display (state badge, latency, uptime, counters) which was originally planned as a separate `WebSocketStatusBar` component but was integrated for simplicity.

| Field | Type | Validation | Default |
|---|---|---|---|
| URL | text input | Required, must start with `ws://` or `wss://` | `wss://` |
| Headers | key-value list | Key required when value present | Empty |
| Query Parameters | key-value list | Key required when value present | Empty |
| Subprotocols | text input | Comma-separated, trimmed | Empty |

**Status display (integrated):**

| Metric | Display | Update Frequency |
|---|---|---|
| State | Badge: ● Connected (green) / ◌ Disconnected (gray) / ⟳ Connecting (amber) / ✕ Error (red) | Instant |
| Latency | `42ms` — time from `new WebSocket()` to `onopen` | Once on connect |
| Uptime | `2m 15s` — live counter since connection opened | Every second |
| Messages | `↑12 ↓34` — sent/received counters | Instant |
| Protocol | `graphql-ws` — negotiated subprotocol (if any) | Once on connect |

**Buttons:**
- **Connect** — disabled when URL empty or already connected/connecting; shows "Connecting…" during handshake
- **Disconnect** — disabled when not connected; sends close frame with code 1000
- **Clear URL** — small × icon to reset URL field

#### 1.2 Message Log + Compose Bar (`WebSocketMessageLog`)

> **Note:** The compose bar was originally planned as a separate `WebSocketComposeBar` component but is integrated directly into `WebSocketMessageLog` for tighter coupling between message composition and the log display. Protocol-specific compose modes (Socket.IO event, STOMP command, GraphQL query) also live here.

**Compose bar (integrated at top of log):**

| Element | Behavior |
|---|---|
| Message input | Multi-line textarea, monospace font, auto-grows (max 6 lines) |
| Format selector | `Text` (default) / `JSON` / `Binary (Base64)` dropdown |
| Send button | `Cmd+Enter` / `Ctrl+Enter` shortcut (platform-aware); disabled when disconnected or input empty |
| Beautify button | Pretty-prints JSON in compose area (visible in JSON mode only) |
| Template dropdown | `▾` button with saved templates list + save current |

**Message log:**

| Column | Width | Content |
|---|---|---|
| Direction | 24px | `↑` (sent, blue) or `↓` (received, green) |
| Timestamp | 100px | `HH:mm:ss.SSS` |
| Type | 50px | `text` / `binary` / `ping` / `pong` / `close` |
| Content | flex | Message body (truncated at 500 chars in list; full in detail) |
| Size | 60px | `42 B` / `1.2 KB` |

**Behaviors:**
- Auto-scroll to bottom when new messages arrive (unless user has scrolled up)
- Click row → resizable detail panel at bottom (pretty-printed JSON/Raw/Hex tabs, Copy button)
- Search bar filters messages by content (case-insensitive substring match)
- Direction filter: All / Sent only / Received only
- Control frame toggle (ping/pong/close visibility)
- Max messages indicator: `"1000/1000 — max reached"` badge
- Clear button: resets log
- Export button: downloads JSON file with all messages

### Phase 1 CSS Classes (in `src/styles/websocket-studio.css`)

> **Note:** During implementation, several CSS class names diverged from the original plan. The list below reflects the **actual** class names in the codebase.

```
.ws-studio-page             — Page container
.ws-studio-tabs             — Internal tab strip
.ws-connect-panel            — URL + headers + params form
.ws-connect-url-row          — URL input row
.ws-connect-url-input        — URL text input
.ws-connect-protocol-hint    — "ws://" / "wss://" prefix hint
.ws-connect-kv-section       — Key-value section (headers / query params)
.ws-connect-kv-header        — Section header (Headers / Query Parameters)
.ws-connect-kv-row           — Key-value pair row
.ws-connect-kv-input         — Key or value input
.ws-connect-kv-add-btn       — "+ Add" button
.ws-connect-kv-remove-btn    — Remove row button
.ws-connect-kv-checkbox      — Enable/disable checkbox
.ws-connect-subprotocols     — Subprotocols input
.ws-connect-actions          — Connect/Disconnect button row
.ws-status-bar               — Status indicator strip
.ws-status-badge             — Connection state badge
.ws-status-badge.state-connected    — Green
.ws-status-badge.state-connecting   — Amber
.ws-status-badge.state-disconnected — Gray
.ws-status-badge.state-error        — Red
.ws-status-metric            — Individual metric (latency, uptime, etc.)
.ws-compose-bar              — Compose area
.ws-compose-input            — Message textarea
.ws-compose-controls         — Send button row + format selector
.ws-compose-format-select    — Format dropdown
.ws-message-log              — Message list container
.ws-message-row              — Individual message row
.ws-message-row.direction-sent      — Sent message styling
.ws-message-row.direction-received  — Received message styling
.ws-message-row.type-control        — Ping/pong/close muted styling
.ws-message-direction        — Direction arrow
.ws-message-timestamp        — Timestamp column
.ws-message-type             — Frame type badge
.ws-message-content          — Message body (truncated)
.ws-message-size             — Size column
.ws-detail-panel             — Resizable bottom detail panel
.ws-message-log-toolbar      — Search, filter, clear bar
.ws-message-max-reached      — Max messages indicator badge
.ws-guard                    — Guard state container
.ws-guard-prompt             — "Enter a URL" prompt text
```

### Phase 1 New Files (Actual Implementation)

> **Architecture note:** Several planned-as-separate components were consolidated during implementation:
> - `WebSocketComposeBar` → integrated into `WebSocketMessageLog`
> - `WebSocketStatusBar` → integrated into `WebSocketConnectPanel`
> - `WebSocketStudioGuard` → inline JSX in `WebSocketStudioPage`
> - `useWebSocketConnection` + `useWebSocketMessageLog` → merged into `useWebSocketStudio`
> - `websocketConfig.ts` → merged into `types.ts`
> - `features/websocket/types.ts` → not needed; `shared/websocket/types.ts` covers all
>
> **Additionally**, two extracted helper modules were created during implementation that were not in the original plan:
> - `KeyValueEditor` — reusable key-value pair editor (headers, query params)
> - `useDropdownClose` — shared dropdown close-on-click-outside hook

```
src/shared/websocket/
  websocketClient.ts                   NEW — WebSocket dispatch client (proxy-mode HTTP dispatch)
  websocketClient.test.ts              NEW — Client tests
  types.ts                             NEW — All shared types + factory helpers
  types.test.ts                        NEW — Type helper tests

src/features/websocket/
  WebSocketStudioPage.tsx              NEW — Top-level page with tabs + guard state
  WebSocketStudioPage.test.tsx         NEW — Page tests
  WebSocketConnectPanel.tsx            NEW — Connection form + status display + protocol selector
  WebSocketConnectPanel.test.tsx       NEW — Connection panel tests
  WebSocketMessageLog.tsx              NEW — Message log + compose bar (integrated)
  WebSocketMessageLog.test.tsx         NEW — Log + compose tests
  useWebSocketStudio.ts                NEW — Unified hook (connection + messages + reconnect + protocol + TLS)
  useWebSocketStudio.test.ts           NEW — Hook tests
  wsMessageUtils.ts                    NEW — Message formatting utilities (JSON pretty-print, hex dump,
                                              size format, URL validation, base64 validation, JSON tokenizer)
  wsMessageUtils.test.ts               NEW — Formatting tests
  wsProtocolHelpers.ts                 NEW (Phase 1 stub; filled in Phase 3B/3C/3E) — Auto-respond, protocolMeta annotation, filtering
  wsProtocolHelpers.test.ts            NEW (Phase 1 stub; filled in Phase 3B/3C/3E) — Protocol helpers tests
  KeyValueEditor.tsx                   NEW — Reusable key-value pair editor (extracted from ConnectPanel)
  KeyValueEditor.test.tsx              NEW — KeyValueEditor tests
  useDropdownClose.ts                  NEW — Shared dropdown close-on-click-outside hook
  useDropdownClose.test.ts             NEW — Hook tests

src-server/websocket/
  contracts.ts                         NEW — WebSocket operation types and envelopes
  contracts.test.ts                    NEW — Contract tests
  websocket-service.ts                 NEW — Server-side connection manager (ws library)
  websocket-service.test.ts            NEW — Service tests

src-server/routes/
  websocket-routes.ts                  NEW — Express proxy routes (/api/ws/*)
  websocket-routes.test.ts             NEW — Route tests

src-server/
  webhook-server.ts                    MODIFY — Mount websocket routes via createWebSocketRouter()

src/app/utils/appTabUtils.ts          MODIFY — Add 'websocket-studio' to Tab union + PROTOCOLS_TABS
src/app/components/AppSubNav.tsx      MODIFY — Add WebSocket sub-tab to protocols
src/app/App.tsx                       MODIFY — Add render branch for websocket-studio
src/styles/websocket-studio.css        NEW — All ws-* CSS classes (separate file, not in settings.css)
```

> **Note:** WebSocket CSS goes in a dedicated `websocket-studio.css` file (not `settings.css`) to avoid the monolithic file issue. The Kafka CSS was added to `settings.css` historically but grew to ~250+ lines; WebSocket will be separate from the start.
>
> **Transport note:** `websocketClient.ts` provides proxy-mode HTTP dispatch only (`dispatchWsOperation` → `httpFetch` to `/api/ws/*`). Browser-direct `new WebSocket()` connections are managed directly in `useWebSocketStudio.ts` based on the `needsProxy` flag. The `setWsClientTransport()` override for Tauri native transport will be added in Phase 6D.

### Phase 1 Success Criteria

- [x] `'websocket-studio'` tab visible in Protocols sub-nav
- [x] WebSocket Studio page renders with Connect tab active by default
- [x] Guard shown when URL is blank and not connected
- [x] URL input with `ws://`/`wss://` detection and validation
- [x] Headers and Query Parameters key-value list with add/remove/enable/disable
- [x] Subprotocols input field
- [x] Connect button establishes WebSocket connection to entered URL
- [x] Status bar shows connection state (disconnected/connecting/connected/error)
- [x] Status bar shows latency (handshake time) after successful connect
- [x] Status bar shows live uptime counter while connected
- [x] Status bar shows sent/received message counters
- [x] Status bar shows negotiated subprotocol when applicable
- [x] Compose bar with multi-line textarea, Text/Binary format selector
- [x] Send button sends text message, message appears in log as "sent"
- [x] Incoming messages appear in log in real-time with auto-scroll
- [ ] ~~Ping button sends WebSocket ping frame~~ → **Deferred** (browser `WebSocket` API cannot send raw ping frames; requires proxy `ws.ping()` support — see Re-evaluation Note #98)
- [x] Message log shows direction (↑/↓), timestamp (ms precision), type, content, size
- [x] Click message row → detail panel with pretty-printed JSON, Copy button, raw toggle
- [x] Search bar filters messages by content
- [x] Direction filter: All / Sent / Received
- [ ] ~~Control frame toggle (show/hide ping/pong/close)~~ → **Deferred** (ping/pong frames are not surfaced by browser `WebSocket.onmessage`; protocol-level control frames like Socket.IO ping/pong are handled by `wsProtocolHelpers` — see Re-evaluation Note #99)
- [x] Max messages cap (default 1000) with "max reached" indicator
- [x] Clear button resets message log
- [ ] ~~Export button downloads JSON with all messages~~ → **Not implemented** (message log export was omitted from the toolbar; profile export exists in Saved tab — see Re-evaluation Note #100)
- [x] Disconnect button sends close frame (code 1000)
- [x] Error display for failed connections (DNS, TLS, CORS, timeout)
- [x] Auto-scroll stops when user scrolls up, resumes when scrolled to bottom
- [x] All buttons disabled appropriately during connecting/disconnected states
- [x] `Cmd+Enter` / `Ctrl+Enter` shortcut to send message (platform-aware)
- [x] TypeScript check passes: `npx tsc -b --noEmit` → 0 errors
- [x] Unit test coverage >90% across all new files

---

## Phase 2 — Saved Connections, Message Templates & Auto-Reconnect

> **Goal:** Users can save connection profiles for quick reuse, save/load message templates from the compose bar, and enable auto-reconnect for resilient connections.

### Phase 2 Re-evaluation Notes (2026-06-08)

The original Phase 2 scope was too large (7 features in one phase). After re-evaluation:

**Moved OUT of Phase 2 (to Phase 2B or later):**
- ~~Persistent message history across sessions~~ → Deferred. High storage complexity, low value. Users rarely replay old messages; they care about profiles and templates.
- ~~Advanced filtering (JSONPath, regex, size range)~~ → Deferred. Phase 1 already has text search + direction filter. Power-user filters belong after core CRUD patterns are solid.
- ~~Message bookmarking~~ → Deferred. Polish feature that depends on expanded message interactions.
- ~~Session snapshots~~ → Deferred. Depends on persistent history.

**Kept in Phase 2 (core CRUD + resilience):**
- Saved Connections: CRUD, load into draft, duplicate, import/export
- Message Templates: save/load/delete from compose bar, format selector, JSON beautify
- Auto-Reconnect: toggle with configurable retry policy, close-with-code/reason

**New features added after competitive research (2026-06-08):**
- **Message format selector** (from Postman): Text / JSON / Binary compose modes with syntax highlighting
- **JSON Pretty-Print / Beautify** (from Postman): Auto-format JSON in compose and in message log
- **Close with status code & reason** (from Firecamp): Specify close code + reason text when disconnecting
- **Config lock while connected** (from Insomnia): Read-only banner on connection fields when connected
- **Environment variable support in URLs** (from Insomnia/Postman): `{{baseWsUrl}}/feed` resolution
- **Keyboard navigation in message log** (from Insomnia): Arrow keys to navigate, Enter to expand/collapse
- **Resizable message detail panel** (from Insomnia): Drag to resize expanded message view

**Key design decisions:**
1. **Follow Kafka template pattern** — `useWebSocketProfiles` and `useWebSocketTemplates` hooks in `src/app/hooks/` (not `src/features/websocket/`), matching `useKafkaTemplates.ts` location and interface shape.
2. **Storage in `src/shared/websocket/websocketStorage.ts`** — Dual-mode persistence via the existing `readKey/writeKey` abstraction (same as `kafkaStorage.ts`).
3. **Saved Connections is a third tab** — `WsStudioTab = 'connect' | 'messages' | 'saved'`. Not a separate page.
4. **Templates are a compose bar dropdown** — No separate tab/page. Template selector appears as a `▾` dropdown next to the Send button (matching Kafka's pattern).
5. **Load Profile UX** — Clicking a saved connection populates the draft but does NOT auto-connect. If there's an active connection, user is prompted to disconnect first or the draft is simply replaced (same as editing the URL manually).
6. **Auto-reconnect lives in the hook** — `useWebSocketStudio` gains `autoReconnect` state + retry logic. The profile stores the preference; the hook executes it.
7. **Message format selector** (NEW from Postman research) — Compose bar has a format dropdown: Text (default), JSON (with syntax highlighting + Beautify), Binary (Base64 input). Message log entries also get a format viewer with JSON pretty-print and hexdump toggle for binary.
8. **Config lock while connected** (NEW from Insomnia research) — Connection config fields (URL, headers, params, subprotocols) become read-only when connected. A "Disconnect to edit" banner appears. This prevents accidental changes during an active session.
9. **Close with code/reason** (NEW from Firecamp research) — Disconnect button shows a small dropdown: "Disconnect (Normal)" vs "Disconnect with Code..." which opens a modal with close code (1000-4999) and reason text inputs.

### Phase 2 Sub-phases

#### Phase 2A — Saved Connection Profiles + Config Lock

**Scope:**
- `websocketStorage.ts`: dual-mode persistence for connection profiles (save/load/delete arrays via `readKey/writeKey`)
- `useWebSocketProfiles.ts` hook: CRUD operations (save, update, delete, duplicate, list, import, export)
- `WebSocketSavedConnections.tsx` component: profile list UI with create/edit/delete/duplicate/load actions
- Third tab "Saved" added to `WebSocketStudioPage.tsx`
- Load profile → populates `draft` in `useWebSocketStudio`
- Import/Export as JSON (download file for export / file upload for import — paste JSON deferred)
- **Config lock while connected** (from Insomnia): URL, headers, params, subprotocols inputs become disabled when `connection.state === 'connected'` or connecting/closing. A config lock banner with lock icon (⊘) and inline "Disconnect" link appears above the form (rendered in `WebSocketStudioPage`, not `ConnectPanel`).
- **Save as Profile**: Opens profile editor modal pre-filled with current draft (Mockup Alignment M14 — replaced auto-name; matches "edit before save" UX)

**Implemented (Mockup Alignment 2026-06-08 — 40 initial fixes + 4 re-evaluation fixes):**
- **Environment variable support in URLs (M1, M2)** — `isValidWsUrl()` relaxed to accept `{{var}}` placeholders. `resolveEnvVars(url, env)` helper added to `wsMessageUtils.ts`. Connect panel shows `→ Resolved: {url}` preview below URL input. Currently resolves against empty env map (`{}`) — will be wired to app's environment context in a future change.
- **Profile card enhancements (M7–M9)** — Meta tags show "N headers", "N params", "auto-reconnect", "env vars", "TLS/mTLS". Footer count. Card selection highlight.
- **Status bar (M11–M12)** — Connection state dot, latency, uptime, message counters in Connect panel.
- **Config lock (M13)** — Lock icon + inline "Disconnect" link (replaces generic banner text).
- **Save as Profile (M14)** — Opens profile editor modal pre-filled with current draft (replaced auto-save).
- **Compose bar (M18)** — Moved to bottom of message log (matching Postman/Insomnia convention).
- **Row styling (M19–M20)** — Sent=blue, received=green background tints; selected row has left accent border.
- **Messages status bar (M21)** — State dot + sent/received counts in Messages tab.
- **JSON syntax coloring in log (M22)** — Keys, strings, numbers, booleans, null colored in message rows.
- **Binary hex preview in log (M23)** — Inline hex preview for binary messages.
- **Detail timestamp milliseconds (M24)** — Detail panel shows ms-precision timestamps.
- **Hex column colors (M25)** — Offset=gray, bytes=blue, ASCII=green in hex tab.
- **Reconnect settings inline (M26–M28)** — Bordered "Auto-Reconnect Settings" card on Connect tab.
- **Backoff multiplier (M29)** — Configurable dropdown (1×/1.5×/2×) on Connect tab + profile editor.
- **Reconnect UI (M30–M33)** — Spinner + animated progress dots + countdown timer.
- **Disconnect button (M34)** — Danger-red styling.
- **System frames (M35–M37)** — "Connected to...", "CLOSE SENT", "CLOSE ACK" in message log.
- **Reconnect failed (M38–M40)** — Red failed banner with "Retry Now" button.
- **Proxy system frame fix (M41)** — Proxy path was creating system frame with `type: 'close'` instead of `type: 'text'` with `isSystem: true`.
- **isSystem detection (M42)** — MessageLog `isSystem` check now includes frames explicitly marked with `isSystem: true`.
- **System frame filter (M43)** — `visibleMessages` filter correctly excludes `isSystem: true` frames when system frames toggle is off.
- **CSS specificity fix (M44)** — System messages no longer receive direction classes (`ws-message-sent`/`ws-message-received`), preventing CSS cascade override of `ws-message-system` styling.

**Files:**
```
src/shared/websocket/websocketStorage.ts          NEW — Dual-mode persistence (profiles + templates)
src/shared/websocket/websocketStorage.test.ts      NEW
src/app/hooks/useWebSocketProfiles.ts              NEW — Profile CRUD hook
src/app/hooks/useWebSocketProfiles.test.ts         NEW
src/features/websocket/WebSocketSavedConnections.tsx   NEW — Saved connections list UI
src/features/websocket/WebSocketSavedConnections.test.tsx NEW
src/features/websocket/WebSocketStudioPage.tsx     MODIFY — Add "Saved" tab
src/features/websocket/WebSocketStudioPage.test.tsx MODIFY
src/features/websocket/WebSocketConnectPanel.tsx   MODIFY — Add config lock + "Save as Profile" button
src/features/websocket/WebSocketConnectPanel.test.tsx MODIFY
src/styles/websocket-studio.css                    MODIFY — Saved connections + lock banner CSS
```

#### Phase 2B — Message Templates + Format Selector + JSON Beautify

**Scope:**
- `websocketStorage.ts`: add template persistence (save/load/delete arrays)
- `useWebSocketTemplates.ts` hook: save, load, delete, list templates
- Template dropdown in compose bar: `▾` button opens template list, click loads body into compose textarea
- Save current compose text as named template (name input modal or inline)
- Delete template from dropdown
- **Message format selector** (from Postman): Compose bar gains a format dropdown — Text (default), JSON (with syntax highlighting + Beautify button), Binary (Base64 input). Compose textarea adapts styling per format.
- **JSON Pretty-Print in log** (from Postman): Messages containing valid JSON are auto-detected and displayed with formatted indentation. A "Raw" toggle switches between formatted and raw views.
- **Expanded message detail** (from Insomnia): Clicking a message in the log opens a resizable detail panel below the log showing full message content with format switching, word wrap toggle, and copy button. Arrow keys navigate between messages while detail panel stays open.
- **Hexdump view** (from Postman): Binary messages show hex + ASCII side-by-side view in the detail panel.

**Files:**
```
src/shared/websocket/websocketStorage.ts           MODIFY — Add template persistence
src/app/hooks/useWebSocketTemplates.ts             NEW — Template CRUD hook
src/app/hooks/useWebSocketTemplates.test.ts        NEW
src/features/websocket/WebSocketMessageLog.tsx      MODIFY — Template dropdown, format selector, detail panel
src/features/websocket/WebSocketMessageLog.test.tsx MODIFY
src/features/websocket/WebSocketMessageDetail.tsx   NEW — Expanded message detail panel
src/features/websocket/WebSocketMessageDetail.test.tsx NEW
src/styles/websocket-studio.css                    MODIFY — Template dropdown + format selector + detail panel CSS
```

#### Phase 2C — Auto-Reconnect + Close with Code/Reason

**Scope:**
- `useWebSocketStudio.ts`: add `autoReconnect`, `maxReconnectAttempts`, `reconnectIntervalMs`, `backoffMultiplier` state with individual setters
- When connection drops unexpectedly (close code !== 1000, or error), auto-reconnect triggers retry loop with exponential backoff
- Reconnect banner with CSS spinner + animated progress dots (done/current/pending) + countdown timer + backoff label
- Reconnect failed state with last error message, total downtime, and "Retry Now" button for manual retry
- Stop reconnecting on: manual disconnect, max attempts reached, or successful reconnect
- Profile stores auto-reconnect preferences (including `backoffMultiplier`); loaded along with other profile fields
- Works with both direct and proxy transport modes
- System frames appended to message log: "Connected to {url} (protocol: {proto})" on open, "CLOSE SENT" before disconnect, "CLOSE ACK" on close event
- **Close with status code & reason** (from Firecamp): Disconnect button (danger-red) gains a small dropdown caret. Click the main button for normal close (1000). Click the caret for "Close with Code..." which opens a small inline form: close code input (1000–4999, with preset descriptions) + reason text input (max 123 bytes per RFC 6455). The chosen close code and reason are passed to `ws.close(code, reason)` or `dispatchWsOperation('disconnect', { code, reason })`.
- **Auto-Reconnect Settings inline on Connect panel**: Bordered settings card with Max Attempts, Retry Interval, and Backoff Multiplier (1×/1.5×/2×) inputs visible when auto-reconnect toggle is on

**Files:**
```
src/shared/websocket/types.ts                       MODIFY — Add WsCloseDetail, WsReconnectState, close code presets
src/features/websocket/useWebSocketStudio.ts        MODIFY — Add auto-reconnect logic + close code/reason
src/features/websocket/useWebSocketStudio.test.ts   MODIFY — Add reconnect + close code tests
src/features/websocket/WebSocketConnectPanel.tsx     MODIFY — Auto-reconnect toggle + close dropdown + status
src/features/websocket/WebSocketConnectPanel.test.tsx MODIFY
src/features/websocket/WebSocketStudioPage.tsx       MODIFY — Wire reconnect props
src/features/websocket/WebSocketStudioPage.test.tsx  MODIFY — Update mock return type
src/styles/websocket-studio.css                     MODIFY — Reconnect indicator + close code dropdown CSS
```

> **Note:** Server-side files (`contracts.ts`, `websocket-service.ts`, `websocket-routes.ts`) already support
> `code` and `reason` fields on disconnect — no server changes are needed for Phase 2C.

### Phase 2 Type Definitions

```ts
// ── Saved Connection Profile ─────────────────────────────────────────
// Reuses WsKeyValueEntry from src/shared/websocket/types.ts

export interface WsConnectionProfile {
  id: string;
  name: string;
  url: string;                    // may contain {{envVar}} placeholders
  headers: WsKeyValueEntry[];
  queryParams: WsKeyValueEntry[];
  subprotocols: string;           // comma-separated (matches WsConnectionDraft.subprotocols)
  protocolMode: string;           // Phase 3A addition: 'auto' | 'raw' | 'socket-io' | 'stomp' | 'graphql-ws'
  autoReconnect: boolean;
  maxReconnectAttempts: number;    // default: 5
  reconnectIntervalMs: number;    // default: 3000
  backoffMultiplier?: WsBackoffMultiplier; // default: 1.5 (Mockup Alignment M29)
  maxMessages: number;            // default: 1000
  tlsConfig?: WsTlsConfig;       // Phase 3D addition: TLS/mTLS settings
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Message Template ─────────────────────────────────────────────────

export type WsMessageFormat = 'text' | 'json' | 'binary';

export interface WsMessageTemplate {
  id: string;
  name: string;
  body: string;
  format: WsMessageFormat;       // compose format (text/json/binary)
  tags?: string[];                // optional categorization
  createdAt: string;
  updatedAt: string;
}

// ── Backoff Multiplier ───────────────────────────────────────────────

export type WsBackoffMultiplier = 1 | 1.5 | 2;
export const DEFAULT_BACKOFF_MULTIPLIER: WsBackoffMultiplier = 1.5;
export function resolveBackoffMultiplier(value?: WsBackoffMultiplier | null): WsBackoffMultiplier;

// ── Auto-Reconnect State ─────────────────────────────────────────────

export interface WsReconnectState {
  active: boolean;                // whether a reconnect loop is currently running
  attempt: number;                // current retry attempt (0 = not retrying)
  maxAttempts: number;
  nextRetryAt: number | null;     // timestamp of next retry, null when not retrying
  lastError?: string;             // last error message (Mockup Alignment M41)
  lostAt?: number;                // timestamp when connection was lost (Mockup Alignment)
}
// Note: backoffMultiplier is configurable via WsBackoffMultiplier type (1 | 1.5 | 2), default 1.5
// Note: intervalMs lives as `reconnectIntervalMs` on the hook, not on this state object

// ── Close Detail ─────────────────────────────────────────────────────

export interface WsCloseDetail {
  code: number;                   // 1000–4999 (RFC 6455)
  reason?: string;                // max 123 bytes (optional)
}

// ── Hook Return Types ────────────────────────────────────────────────

export interface UseWebSocketProfilesReturn {
  profiles: WsConnectionProfile[];
  loading: boolean;
  error: string | null;

  saveProfile: (profile: Omit<WsConnectionProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProfile: (id: string, patch: Partial<WsConnectionProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  duplicateProfile: (id: string) => Promise<void>;
  importProfiles: (json: string) => Promise<{ imported: number; errors: string[] }>;
  exportProfiles: () => string;   // returns JSON string

  /** Converts a profile into a WsConnectionDraft for loading into the Connect tab */
  loadProfileAsDraft: (id: string) => WsConnectionDraft | null;
}
// Also exported from types.ts: profileToDraft(), draftToProfileFields(),
// createDefaultReconnectState(), formatUptime() — standalone helper functions

export interface UseWebSocketTemplatesReturn {
  templates: WsMessageTemplate[];
  loading: boolean;
  error: string | null;

  saveTemplate: (name: string, body: string, format: WsMessageFormat) => Promise<void>;
  updateTemplate: (id: string, patch: Partial<WsMessageTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  loadTemplate: (id: string) => { body: string; format: WsMessageFormat } | null;
}
```

### Phase 2 Storage Layer (`websocketStorage.ts`)

```ts
// ── Storage Keys ─────────────────────────────────────────────────────
const WS_PROFILES_KEY = 'redfire-ws-profiles-v1';
const WS_TEMPLATES_KEY = 'redfire-ws-templates-v1';

// ── Profile CRUD ─────────────────────────────────────────────────────
export async function loadWsProfiles(): Promise<WsConnectionProfile[]>;
export async function saveWsProfiles(profiles: WsConnectionProfile[]): Promise<void>;

// ── Template CRUD ────────────────────────────────────────────────────
export async function loadWsTemplates(): Promise<WsMessageTemplate[]>;
export async function saveWsTemplates(templates: WsMessageTemplate[]): Promise<void>;
```

Uses the existing `readKey/writeKey` from `src/utils/storage.ts` for dual-mode persistence (localStorage for web, Tauri FS plugin for desktop). Same pattern as `kafkaStorage.ts`.

### Phase 2A Component Render Flow (Actual)

```
WebSocketStudioPage
├── Tab bar: [Connect] [Messages] [Saved]
│
├── activeTab === 'connect'
│   ├── ConfigLockBanner (rendered in WebSocketStudioPage, not ConnectPanel)
│   │   └── "Connection settings are locked. Disconnect to edit."
│   ├── WebSocketConnectPanel (all inputs disabled when connected via configLocked/isBusy)
│   │   ├── URL input + env preview (→ Resolved: {url})
│   │   ├── Headers (key-value list)
│   │   ├── Query Params (key-value list)
│   │   ├── Subprotocols input
│   │   ├── Protocol selector (Auto/Raw/Socket.IO/STOMP/GraphQL-WS)
│   │   ├── Status bar: state badge (dot), latency, uptime, msg counters (integrated)
│   │   ├── [Connect] / [Disconnect ▾] buttons (danger-red Disconnect)
│   │   ├── Auto-reconnect toggle
│   │   ├── Bordered "Auto-Reconnect Settings" card (when toggle ON):
│   │   │   ├── Max Attempts input (1–50, default 5)
│   │   │   ├── Retry Interval input (500–60000 ms, default 3000)
│   │   │   └── Backoff Multiplier dropdown (1× / 1.5× / 2×, default 1.5×)
│   │   ├── Reconnect banner / failed state (when reconnecting)
│   │   └── [Save as Profile] button
│   ├── WebSocketTlsPanel (collapsible TLS/mTLS config)
│   ├── Guard state (inline) OR WebSocketMessageLog (with compose bar)
│
├── activeTab === 'messages'
│   └── WebSocketMessageLog (full height, with compose bar)
│
└── activeTab === 'saved'
    └── WebSocketSavedConnections
        ├── "Saved Connections" title header
        ├── SavedHeader: search input + [+ New Profile] button
        ├── SavedList: scrollable list of ProfileCards (selected card highlighted)
        │   └── ProfileCard (for each profile)
        │       ├── Name (bold)
        │       ├── URL (monospace, truncated)
        │       ├── Meta tags: "N headers", "N params", "auto-reconnect", "env vars", "TLS/mTLS"
        │       ├── Updated timestamp
        │       └── Hover actions: [Load] [Edit] [Duplicate] [Delete]
        ├── EmptyState (when profiles.length === 0)
        │   └── "No saved connections. Create one or use Save as Profile."
        ├── ImportExportBar: [Import JSON] [Export All]
        └── Footer: "{N} saved connections" count
```

#### Saved Tab — ProfileCard Interaction

| Action | Behavior |
|---|---|
| **Load** | Calls `profileToDraft(id)`, sets `studio.setDraft(result)`, switches to Connect tab |
| **Edit** | Opens profile editor modal (same fields as create, pre-filled) |
| **Duplicate** | Calls `duplicateProfile(id)`, new card appears with "(copy)" suffix |
| **Delete** | Confirmation dialog → calls `deleteProfile(id)` |
| **Search** | Filters profiles by name or URL substring (case-insensitive) |
| **Import** | File upload → validates JSON → calls `importProfiles(json)` (paste JSON deferred) |
| **Export** | Calls `exportProfiles()` → triggers browser download as `.json` file |

#### Config Lock Behavior

| State | URL | Headers | Params | Subprotocols | Connect Btn | Disconnect Btn |
|---|---|---|---|---|---|---|
| Disconnected | editable | editable | editable | editable | enabled | disabled |
| Connecting | readOnly | readOnly | readOnly | readOnly | disabled ("Connecting...") | disabled |
| Connected | readOnly | readOnly | readOnly | readOnly | disabled | enabled |
| Closing | readOnly | readOnly | readOnly | readOnly | disabled | disabled |
| Error | editable | editable | editable | editable | enabled | disabled |

### Phase 2A Profile Editor Modal

| Field | Type | Validation | Default |
|---|---|---|---|
| Profile Name | text | Required, max 100 chars, unique | "" |
| WebSocket URL | text | Required, must start with `ws://` or `wss://` | "wss://" |
| Subprotocols | text | Comma-separated, trimmed | "" |
| Headers | key-value list | Key required when value present | [] |
| Query Params | key-value list | Key required when value present | [] |
| Auto-Reconnect | toggle | — | off |
| Max Attempts | number | 1–50 | 5 |
| Retry Interval | number | 500–60000 ms | 3000 |
| Backoff Multiplier | dropdown | 1× / 1.5× / 2× | 1.5× |
| Max Messages | number | 100–10000 | 1000 |
| Notes | textarea | Optional, max 500 chars | "" |

**Footer:** [Cancel] [Save Profile]

> **Note:** The profile editor modal does not expose `protocolMode` or `tlsConfig` fields —
> these are saved/loaded with profiles automatically from the current studio state but
> cannot be edited inline in the saved connections editor. This is an acceptable UX trade-off:
> users configure protocol and TLS in the Connect tab, then save the profile.

### Phase 2B Component Changes (Actual)

```
WebSocketMessageLog (MODIFIED — compose bar is integrated, not separate)
├── Compose bar (integrated at bottom — moved from top during Mockup Alignment M18)
│   ├── Textarea: message body
│   ├── Format selector: [Text ▾] / [JSON ▾] / [Binary (Base64) ▾]
│   │   ├── JSON mode: format label + [Beautify] button
│   │   └── Binary mode: textarea accepts Base64 input, validates on type
│   ├── Template dropdown: [Templates ▾]
│   │   ├── Template list: name + preview + [×] delete button per item
│   │   └── Save footer: name input + [Save] button
│   ├── [Send] button (Cmd/Ctrl+Enter shortcut)
│   └── Protocol compose modes (Socket.IO event, STOMP command, GraphQL query)
├── Toolbar: search, direction filter, clear, export
├── Message list
│   └── Each row: click → opens detail panel below
│       └── JSON messages: auto-detect + pretty-print (via wsMessageUtils)
└── WebSocketMessageDetail panel (separate component, rendered below log)
    ├── Header: "↓ Received — 12:00:02 — 284 B" + [JSON] [Raw] [Hex] tabs + [Wrap] [Copy] [×]
    └── Body: formatted content
        ├── JSON tab: indented JSON with colored keys/strings/numbers
        ├── Raw tab: raw message string, monospace
        └── Hex tab: hex offset | hex bytes | ASCII (for binary messages)
```

#### Format Selector Behavior

| Format | Textarea | Beautify | Send encoding |
|---|---|---|---|
| Text | Plain text, no formatting | Hidden | `ws.send(text)` as text frame |
| JSON | Plain text + format mode label; Beautify button formats JSON | Visible — auto-formats valid JSON | `ws.send(text)` as text frame (JSON is text) |
| Binary | Monospace font, accepts Base64 string; invalid Base64 disables Send | Hidden | Decode Base64 → `ws.send(buffer)` as binary frame |

> **Note:** HTML `<textarea>` cannot render syntax highlighting. JSON syntax coloring is only available in the message detail panel.

#### Message Detail Panel

| Element | Behavior |
|---|---|
| **Resize handle** | 4px bar between log and detail; drag to resize. Min height: 100px |
| **JSON tab** | Pretty-printed JSON with syntax highlighting (keys: blue, strings: orange, numbers: green) |
| **Raw tab** | Raw message content, monospace, no formatting |
| **Hex tab** | `offset | hex bytes | ASCII` — 16 bytes per line (only for binary messages) |
| **Wrap toggle** | Toggles word-wrap on/off in the content area |
| **Copy button** | Copies content to clipboard (raw format, not HTML-highlighted) |
| **Close (×)** | Hides the detail panel |
| **Keyboard ↑/↓** | Navigate to prev/next message while detail stays open |

#### Template Dropdown UX

| Action | Behavior |
|---|---|
| Click `📋 Templates ▾` | Opens dropdown above the compose bar (flyout upward) |
| Click template item | Loads body into compose textarea, sets format selector, closes dropdown |
| Click `×` on item | Deletes template (with instant removal, no confirmation for lightweight UX) |
| Type name + click `Save` | Saves current compose text + format as a new template |
| Empty state | "No saved templates. Type a message and save it." |
| Outside click / Escape | Closes dropdown |

### Phase 2C Hook Changes (`useWebSocketStudio`)

```ts
// ── New state added to useWebSocketStudio ────────────────────────────

// Existing return extended with:
export interface UseWebSocketStudioReturn {
  // ... existing fields from Phase 1 ...

  // Phase 2C additions:
  reconnectState: WsReconnectState;       // { active, attempt, maxAttempts, nextRetryAt, lastError?, lostAt? }
  autoReconnect: boolean;                 // whether auto-reconnect is enabled
  setAutoReconnect: (enabled: boolean) => void;
  reconnectIntervalMs: number;            // retry interval (default 3000)
  setReconnectIntervalMs: (ms: number) => void;
  maxReconnectAttempts: number;           // max retry attempts (default 5)
  setMaxReconnectAttempts: (n: number) => void;
  backoffMultiplier: WsBackoffMultiplier; // backoff multiplier (default 1.5)
  setBackoffMultiplier: (m: WsBackoffMultiplier) => void;
  cancelReconnect: () => void;            // manually stop reconnect loop
  retryNow: () => void;                  // manual reconnect after failure (Mockup Alignment M40)

  // Close with code/reason:
  disconnect: (detail?: WsCloseDetail) => void;   // overloads existing disconnect()
}
// Note: backoffMultiplier is now configurable via setBackoffMultiplier() — type WsBackoffMultiplier = 1 | 1.5 | 2
//       Default is 1.5; exposed as dropdown on Connect panel + profile editor modal (Mockup Alignment M29)
// Note: reconnect config (max attempts, interval, backoff) is set from profile load or via
//       individual setters: setMaxReconnectAttempts(), setReconnectIntervalMs(), setBackoffMultiplier()
```

#### Auto-Reconnect Logic

```
Connection drops (onclose/onerror)
  │
  ├── Is closeCode === 1000 (Normal)?  → NO reconnect (intentional close)
  ├── Was disconnect() called manually? → NO reconnect (user-initiated)
  ├── Is autoReconnect.enabled === false? → NO reconnect
  ├── Is attempt >= maxAttempts? → STOP, set state to "failed", set lastError
  │
  └── Otherwise → START reconnect:
      1. Set connection.state = 'connecting'
      2. Set reconnectState.active = true, attempt += 1, lostAt = Date.now() (first attempt only)
      3. Calculate delay = intervalMs × (resolveBackoffMultiplier(backoffMultiplier) ^ (attempt - 1))
      4. Set reconnectState.nextRetryAt = Date.now() + delay
      5. setTimeout(delay) → call connect() again
      6. On success → reset reconnectState to { active: false, attempt: 0, nextRetryAt: null }
      7. On failure → set lastError, goto step 1 (loop)
      8. On manual retryNow() → clear failed state, restart from attempt 1
```

**Transport handling:**
- **Direct (browser WebSocket):** Reconnect creates a new `WebSocket` instance with the same draft
- **Proxy (server):** Reconnect calls `dispatchWsOperation('connect', ...)` again to get a new `connectionId`
- In both cases, the existing `proxyPollTimerRef` and `proxyCursorRef` are reset

#### Close with Code/Reason

```
Disconnect button layout:
┌──────────────┬───┐
│  Disconnect  │ ▾ │
└──────────────┴───┘
       │          │
       │          └── Click caret → opens close-code dropdown
       └── Click main → ws.close(1000) (normal close)

Close-code dropdown:
┌─────────────────────────────────────┐
│  Close Connection with Code         │
├─────────────────────────────────────┤
│  Code: [1001    ]                   │
│  Presets: [1000 Normal] [1001 Away] │
│           [1002 Protocol] [1008]    │
│           [4000 Custom] [4001]      │
│  Reason: [Client shutting down___ ] │
│                          45/123 bytes│
├─────────────────────────────────────┤
│               [Cancel] [Close Code] │
└─────────────────────────────────────┘
```

- Close code and reason passed to `ws.close(code, reason)` for direct transport
- For proxy transport: `dispatchWsOperation('disconnect', { connectionId, code, reason })`
- Server-side `websocket-service.ts` passes code/reason to `ws.close(code, reason)`
- System messages rendered in message log with `isSystem: true` flag and `ws-message-system` CSS:
  ```
  ◆ 12:10:10  Connected to wss://example.com/feed (protocol: none)       [ws-message-system]
  ◆ 12:10:12  CLOSE SENT — code: 1001 (Going Away) reason: "Client..."   [ws-message-close-sent]
  ◆ 12:10:12  CLOSE ACK  — code: 1001 (Going Away) reason: "Goodbye"     [ws-message-close-ack]
  ```
  - System messages do NOT receive direction classes (`ws-message-sent`/`ws-message-received`) to prevent CSS cascade issues (M44)
  - "System Frames" toggle correctly filters all system messages including `isSystem` flag (M43)

### Phase 2 CSS Classes (additions to `src/styles/websocket-studio.css`)

```
/* ── Phase 2A: Saved Connections ── */
.ws-saved-container               — Saved tab content container (plan had .ws-saved-tab)
.ws-saved-header                  — Header with search + New Profile button
.ws-saved-list                    — Scrollable profile card list
.ws-saved-card                    — Individual profile card
.ws-saved-card-name               — Profile name (bold)
.ws-saved-card-url                — URL display (monospace, truncated)
.ws-saved-card-tags               — Meta tags row (plan had .ws-saved-card-meta)
.ws-saved-tag                     — Individual tag ("2 headers", "env vars") (plan had .ws-saved-card-tag)
.ws-saved-card-actions            — Hover action buttons
.ws-saved-empty                   — Empty state container
.ws-saved-footer                  — Import/Export footer bar (plan had .ws-saved-import-export)
.ws-saved-success                 — Import feedback flash message
.ws-config-lock-banner            — "Disconnect to edit" info banner
.ws-editor-*                      — Profile editor modal CSS (modal, field, label, etc.)
Note: Search input reuses .ws-message-search from Phase 1

/* ── Phase 2B: Templates + Format ── */
.ws-template-trigger              — Template dropdown trigger button
.ws-template-dropdown             — Flyout dropdown container
.ws-template-dropdown.show        — Visible state
.ws-template-list                 — Scrollable template list
.ws-template-item                 — Individual template row
.ws-template-item-name            — Template name
.ws-template-item-preview         — Body preview (truncated, monospace)
.ws-template-item-delete          — Delete × button
.ws-template-save-row             — Name input + Save button row
.ws-format-select                 — Format <select> element (no .ws-format-selector wrapper)
.ws-beautify-btn                  — JSON Beautify button
.ws-detail-panel                  — Expanded message detail panel
.ws-detail-resize                 — Drag-to-resize handle
.ws-detail-header                 — Detail panel header
.ws-detail-tabs                   — JSON / Raw / Hex tab switcher
.ws-detail-body                   — Detail content area (JSON uses token spans within)
.ws-detail-hex                    — Hex dump view
.ws-json-key                      — JSON key syntax color
.ws-json-string                   — JSON string syntax color
.ws-json-number                   — JSON number syntax color
.ws-json-bool                     — JSON boolean syntax color
.ws-json-null                     — JSON null syntax color (not in original plan)

/* ── Phase 2C: Reconnect + Close ── */
.ws-reconnect-banner              — Reconnecting status banner with spinner + progress dots
.ws-reconnect-spinner             — CSS spinner animation during reconnect
.ws-reconnect-progress            — Progress dots container
.ws-reconnect-dot                 — Individual animated dot (3 sequential dots)
.ws-reconnect-label               — Reconnecting label text
.ws-reconnect-text                — Reconnecting attempt counter text
.ws-reconnect-cancel-btn          — Cancel reconnect button
.ws-reconnect-countdown           — Countdown timer before next retry
.ws-reconnect-failed              — Failed state banner (red)
.ws-reconnect-failed-retry-btn    — "Retry Now" button on failed banner
.ws-disconnect-group              — Split button container
.ws-disconnect-btn-danger         — Danger-red Disconnect button
.ws-disconnect-caret              — Dropdown caret button
.ws-close-code-dropdown           — Close-code dropdown (plan had .ws-close-code-menu)
.ws-close-code-title              — Dropdown title
.ws-close-code-field              — Code/reason input fields (plan had .ws-close-code-form)
.ws-close-code-input              — Close code number input
.ws-close-reason-input            — Reason text input
.ws-close-code-presets            — Preset code buttons
.ws-close-preset-btn              — Individual preset button (plan had .ws-close-code-preset)
.ws-close-preset-btn.active       — Selected preset (plan had .ws-close-code-preset.selected)
.ws-close-reason-counter          — Byte counter for reason text
.ws-close-code-actions            — Cancel/Close footer buttons
.ws-close-code-error              — Validation error message
.ws-reconnect-settings-card       — Bordered auto-reconnect settings card
.ws-reconnect-settings-row        — 3-column grid row for reconnect inputs

/* ── Phase 2 Mockup Alignment: Additional CSS Classes ── */
.ws-connect-env-preview           — Resolved URL preview below URL input
.ws-messages-status-bar           — Messages tab status bar (state, msg counts)
.ws-status-dot                    — Colored state indicator dot
.ws-message-sent                  — Sent message row background tint (blue)
.ws-message-received              — Received message row background tint (green)
.ws-message-system                — System message row styling (gray, ◆ icon)
.ws-message-close-sent            — CLOSE SENT system event styling (yellow)
.ws-message-close-ack             — CLOSE ACK system event styling (yellow)
.ws-message-selected              — Selected message row left accent border
.ws-saved-card.selected           — Selected profile card highlight
.ws-saved-card-updated            — Profile card "updated" timestamp
.ws-saved-count                   — Footer profile count display
.ws-hex-offset                    — Hex tab offset column color
.ws-hex-byte                      — Hex tab byte column color
.ws-hex-ascii                     — Hex tab ASCII column color
.ws-compose-footer                — Compose bar footer container (bottom-positioned)
```

> **Note:** The reconnect UI was updated during Mockup Alignment to use a spinner +
> animated progress dots (matching Phase 2C mockup `websocket-phase2c-reconnect-close.html`)
> instead of the simpler text-only banner from the initial implementation.

### Phase 2 New Files Summary

```
src/shared/websocket/
  websocketStorage.ts                  NEW — Dual-mode persistence (profiles, templates)
  websocketStorage.test.ts             NEW

src/app/hooks/
  useWebSocketProfiles.ts              NEW — Profile CRUD hook (follows useKafkaTemplates pattern)
  useWebSocketProfiles.test.ts         NEW
  useWebSocketTemplates.ts             NEW — Template CRUD hook
  useWebSocketTemplates.test.ts        NEW

src/features/websocket/
  WebSocketSavedConnections.tsx        NEW — Saved connections list + CRUD UI
  WebSocketSavedConnections.test.tsx   NEW
  WebSocketMessageDetail.tsx           NEW — Resizable detail panel (JSON/Raw/Hex)
  WebSocketMessageDetail.test.tsx      NEW
  WebSocketStudioPage.tsx              MODIFY — Add "Saved" tab + config lock banner
  WebSocketStudioPage.test.tsx         MODIFY — Add saved tab + mock profiles tests
  WebSocketMessageLog.tsx              MODIFY — Template dropdown, format selector, detail panel
  WebSocketMessageLog.test.tsx         MODIFY — Template + format selector + detail tests
  WebSocketConnectPanel.tsx            MODIFY — Config lock props, auto-reconnect toggle, close dropdown
  WebSocketConnectPanel.test.tsx       MODIFY — Config lock + reconnect + close code tests
  useWebSocketStudio.ts               MODIFY — Auto-reconnect logic, close code/reason

src/shared/websocket/
  types.ts                             MODIFY — Add WsCloseDetail, WsMessageFormat, WsReconnectState
                                               (with lastError?, lostAt?), WsBackoffMultiplier,
                                               DEFAULT_BACKOFF_MULTIPLIER, resolveBackoffMultiplier(),
                                               protocolMode & tlsConfig on WsConnectionProfile,
                                               profileToDraft(), draftToProfileFields(),
                                               createDefaultReconnectState(), WS_CLOSE_CODE_PRESETS

src/features/websocket/
  wsMessageUtils.ts                    MODIFY — resolveEnvVars(), formatTimeAgo(), buildBinaryPreview(),
                                               buildHexDumpLines(); isValidWsUrl() relaxed for {{var}}

src/styles/
  websocket-studio.css                 MODIFY — All Phase 2 CSS classes
```

> **Note on server-side files:** `src-server/websocket/contracts.ts`, `websocket-service.ts`,
> and `websocket-routes.ts` already had `code?` and `reason?` support for disconnect
> before Phase 2C — these fields were part of Phase 1's proxy implementation.
> No server modifications were needed for Phase 2C.

### Phase 2 Success Criteria

#### Phase 2A — Saved Connections + Config Lock ✅ Done
- [x] "Saved" tab renders in the tab bar
- [x] "Saved Connections" title header displayed at top of saved tab
- [x] Create a new connection profile (name + all connection fields)
- [x] Edit an existing connection profile via profile editor modal (pre-filled fields)
- [x] Delete a connection profile with confirmation
- [x] Duplicate a connection profile (appends "(copy)" to name)
- [x] Click "Load" → populates draft fields in the Connect tab
- [x] Export all profiles as JSON file download
- [x] Import profiles from JSON (file upload; paste JSON deferred)
- [x] Profiles persist across page reloads (localStorage / Tauri FS)
- [x] **Save as Profile**: opens editor modal pre-filled with current draft (Mockup Alignment M14)
- [x] Empty state when no saved connections exist
- [x] **Config lock**: URL, headers, params, subprotocols are read-only when connected
- [x] **Config lock**: Lock icon + "Disconnect" inline link (Mockup Alignment M13)
- [x] **Profile card meta tags**: "N headers", "N params", "auto-reconnect", "env vars", "TLS/mTLS" (M7)
- [x] **Profile count**: Footer shows "{N} saved connections" (Mockup Alignment M8)
- [x] **Selected card highlight**: Clicked profile card shows selection state (Mockup Alignment M9)
- [x] **Profile editor backoff**: Backoff Multiplier dropdown (1× / 1.5× / 2×) in editor (M29)
- [x] **Env vars (partial)**: `{{var}}` accepted in URL validation; `resolveEnvVars()` helper; resolved URL preview shown (M1, M2) — full env context wiring deferred
- ~~**Env vars (full)**: Interpolation from selected environment~~ → Deferred (no generic interpolation engine yet)
- [x] Unit test coverage >90%

#### Phase 2B — Message Templates + Format Selector + JSON Beautify ✅ Done
- [x] Template dropdown `▾` appears next to Send button in compose bar
- [x] Save current compose text as a named template (with name input)
- [x] Load a template → fills compose textarea with saved body + format
- [x] Delete a template from the dropdown list
- [x] Templates persist across page reloads (via `websocketStorage.ts`)
- [x] Template dropdown shows empty state when no templates exist
- [x] **Format selector**: Dropdown with Text / JSON / Binary (Base64) in compose bar
- [x] **JSON mode**: Format indicator + Beautify button (textarea syntax highlighting infeasible — see Phase 2B notes)
- [x] **JSON Beautify**: Button to auto-format JSON in compose area (disabled for invalid JSON)
- [x] **Log JSON pretty-print**: JSON messages auto-formatted in message rows with syntax coloring (M22)
- [x] **Log binary hex preview**: Binary messages show inline hex preview in log rows (M23)
- [x] **Message detail panel**: Click message → resizable detail panel opens below log (min height 100px)
- [x] **Detail panel**: Full content with JSON/Raw/Hex tabs, word wrap toggle, copy button, close button
- [x] **Detail timestamp**: Includes milliseconds (M24)
- [x] **Hex tab coloring**: Offset, byte, and ASCII columns use distinct colors (M25)
- [x] **Keyboard navigation**: Arrow keys navigate messages in log (opens detail), Escape deselects
- [x] **Binary hexdump**: Binary messages show hex offset + hex bytes + ASCII (16 bytes/line) in detail panel
- [x] **Binary Base64 validation**: Invalid Base64 disables Send and shows hint in binary mode
- [x] **Template dropdown Escape**: Outside click or Escape key closes the dropdown
- [x] **Compose bar at bottom**: Compose bar moved to bottom of message log (M18)
- [x] **Sent/received row tints**: Sent=blue, Received=green background tints (M19)
- [x] **Selected row accent**: Selected message has left accent border (M20)
- [x] **Messages status bar**: State dot + message counts in Messages tab (M21)
- [x] Unit test coverage >90%

#### Phase 2C — Auto-Reconnect + Close with Code/Reason ✅ Done
- [x] Auto-reconnect toggle in Connect panel (default: off)
- [x] Configure max attempts (default: 5) and interval (default: 3s) — inline on Connect tab in bordered settings card (M26–M28)
- [x] **Backoff multiplier dropdown**: 1× / 1.5× / 2× — configurable on Connect tab and profile editor (M29)
- [x] Reconnect banner with spinner + animated progress dots + countdown timer (M30–M33)
- [x] Reconnect stops on: manual disconnect, max attempts, or success
- [x] Works with both direct and proxy transport
- [x] Close code 1000 (normal) does NOT trigger reconnect
- [x] Settings are saved with connection profiles (save uses current values; load restores them)
- [x] **Close with code**: Disconnect button (danger red, M34) has a caret dropdown with "Close with Code..."
- [x] **Close code form**: Input for code (1000–4999) with 8 preset codes, reason text (max 123 bytes with counter)
- [x] **Close code passed**: Code and reason sent to `ws.close(code, reason)` or proxy disconnect
- [x] **System frames**: "Connected to {url} (protocol: {proto})" on open, "CLOSE SENT", "CLOSE ACK" in log (M35–M37)
- [x] **System frame filtering**: System Frames toggle correctly filters all system messages including `isSystem` flag (M43)
- [x] **System frame CSS**: System messages use distinct styling without direction class conflicts (M44)
- [x] **Reconnect failed indicator**: Shows "Reconnect failed after N attempts" with "Retry Now" button (M38–M40)
- [x] **Exponential backoff**: Delay = intervalMs × backoffMultiplier^(attempt-1)
- [x] **Retry Now**: Manual reconnect after failure clears state and re-attempts (M40)
- [x] **Status bar integration**: Connection state dot + latency + uptime in Connect panel (M11–M12)
- [x] Unit test coverage >90% (470 tests across 11 WebSocket test files)

---

## Phase 3 — Protocol Support (Socket.IO, STOMP, TLS/mTLS, GraphQL-WS)

> **Goal:** Support higher-level WebSocket protocols that layer on top of raw WebSocket frames, plus advanced TLS/mTLS configuration.

### Phase 3 Rationale

Many real-world WebSocket APIs don't use raw frames — they use protocol layers:

| Protocol | Use Case | Framing | Status |
|---|---|---|---|
| **Raw WebSocket** | Custom APIs, simple echo | Text/binary frames | ✅ Phase 1 |
| **Socket.IO** | Real-time apps (chat, collaboration) | Packet types (0-6), namespace, acknowledgments | ✅ Phase 3B |
| **STOMP** | Enterprise messaging (RabbitMQ, ActiveMQ) | CONNECT/SUBSCRIBE/SEND/MESSAGE/DISCONNECT commands | ✅ Phase 3C |
| **GraphQL over WS** | Live queries, subscriptions | `graphql-ws` protocol | ✅ Phase 3E |
| **SockJS** | WebSocket fallback (xhr-streaming, xhr-polling) | Transport-agnostic framing | ⬜ Deferred |

> **Note:** SockJS was originally in scope but has been **deferred**. SockJS is primarily a fallback transport for environments where WebSocket is blocked; it adds complexity with minimal value for a testing tool where WebSocket connectivity is assumed. The protocol auto-detection framework (Phase 3A) can accommodate SockJS in the future if needed.

Supporting these protocols makes RedfireForge usable for enterprise and modern web development alike.

### Phase 3A — Protocol Abstraction, Detection & Selector Foundation

> **Goal:** Introduce the protocol abstraction layer, auto-detection engine, protocol selector UI, and hook/profile integration that future phases (3B Socket.IO, 3C STOMP, 3E GraphQL-WS) plug into. Raw is the only functional codec in this phase — all others show as "Coming Soon" in the selector.

#### 3A.1 — Protocol Type System & Codec Interface

- [x] ✅ Done — `WsProtocolMode` union type: `'auto' | 'raw' | 'socket-io' | 'stomp' | 'graphql-ws'`
- [x] ✅ Done — `WsProtocolInfo` metadata: `{ id, label, description, available }` for each protocol
- [x] ✅ Done — `PROTOCOL_REGISTRY` constant: ordered list of all supported protocols with human-readable info
- [x] ✅ Done — `WsProtocolDetectionResult` interface: `{ protocol, confidence, reason }`
- [x] ✅ Done — `WsDetectionConfidence` type: `'high' | 'medium' | 'low'`
- [x] ✅ Done — `getProtocolInfo(mode)` helper: lookup protocol metadata from registry
- [x] ✅ Done — File: `src/shared/websocket/protocols/protocolTypes.ts`

#### 3A.2 — Protocol Detection Engine

- [x] ✅ Done — `detectFromUrl(url)` — URL path heuristics:
  - `/socket.io/` path → `socket-io` (high confidence)
  - `?EIO=` or `?transport=websocket` params → `socket-io` (medium)
  - `/graphql` path → `graphql-ws` (medium)
  - `/stomp` path → `stomp` (medium)
- [x] ✅ Done — `detectFromSubprotocols(subprotocols)` — negotiated subprotocol matching:
  - `graphql-ws` or `graphql-transport-ws` → `graphql-ws` (high)
  - `stomp`, `v11.stomp`, `v12.stomp` → `stomp` (high)
- [x] ✅ Done — `detectFromMessage(data)` — first-message content heuristics:
  - Starts with `0{` or `0{"sid":` → `socket-io` (high)
  - Starts with `CONNECTED\n` → `stomp` (high)
  - JSON with `"type":"connection_ack"` → `graphql-ws` (high)
- [x] ✅ Done — `detectProtocol(url, subprotocols, firstMessage?)` — cascading detection (subprotocol > URL > message > fallback to raw)
- [x] ✅ Done — File: `src/shared/websocket/protocols/protocolDetector.ts`
- [x] ✅ Done — Tests: `src/shared/websocket/protocols/protocolDetector.test.ts`

#### 3A.3 — Protocol Selector UI

- [x] ✅ Done — `WebSocketProtocolSelector` component: dropdown/select with all protocol modes
- [x] ✅ Done — Options: Auto-detect, Raw, Socket.IO, STOMP, GraphQL-WS (all available)
- [x] ✅ Done — Originally showed "(coming soon)" suffix for unavailable protocols; all now enabled after 3B/3C/3E
- [x] ✅ Done — Disabled while connected (follows `configLocked` pattern)
- [x] ✅ Done — Detected protocol indicator: shows badge when auto-detect resolves a protocol after connection
- [x] ✅ Done — Placed in `WebSocketConnectPanel` between Subprotocols and Auto-reconnect
- [x] ✅ Done — File: `src/features/websocket/WebSocketProtocolSelector.tsx`
- [x] ✅ Done — Tests: `src/features/websocket/WebSocketProtocolSelector.test.tsx`

#### 3A.4 — Hook & Profile Integration

- [x] ✅ Done — `useWebSocketStudio` hook: new state `protocolMode` (default `'auto'`) and `setProtocolMode`
- [x] ✅ Done — `detectedProtocol` derived state: result of auto-detection (null when not yet detected or manual mode)
- [x] ✅ Done — On first received message in auto mode: run `detectFromMessage()` and store result
- [x] ✅ Done — On connect: run `detectFromUrl()` + `detectFromSubprotocols()` for early detection
- [x] ✅ Done — `WsConnectionProfile.protocolMode` field for save/restore
- [x] ✅ Done — `WebSocketStudioPage` passes protocol props and handles profile save/load
- [x] ✅ Done — `UseWebSocketStudioReturn` exports: `protocolMode`, `setProtocolMode`, `detectedProtocol`

#### 3A.5 — Status Bar Protocol Badge

- [x] ✅ Done — Protocol badge in status bar showing effective protocol (manual or auto-detected)
- [x] ✅ Done — Badge uses protocol label from `PROTOCOL_REGISTRY`
- [x] ✅ Done — CSS: `.ws-protocol-badge` styling consistent with existing status bar metrics

#### 3A — Design Decisions

| Decision | Rationale |
|---|---|
| **No raw frame inspector (opcode/mask/FIN)** | Browser WebSocket API doesn't expose raw frame metadata. This would require server-proxy interception, deferred to a future enhancement. |
| **Auto-detect as default mode** | Users shouldn't need to manually identify their protocol; detection handles common cases transparently. |
| **Coming-soon protocols are visible but disabled** | Lets users see the roadmap without blocking current functionality. |
| **Detection cascade: subprotocol > URL > message** | Subprotocol negotiation is the most reliable signal; URL heuristics are secondary; message content is last resort. |

#### 3A Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/protocols/protocolTypes.ts` | NEW | Protocol mode type, registry, detection result, `WsDetectionConfidence`, `getProtocolInfo()` |
| `src/shared/websocket/protocols/protocolDetector.ts` | NEW | Auto-detection engine (URL, subprotocol, message heuristics) |
| `src/shared/websocket/protocols/protocolDetector.test.ts` | NEW | Detection engine tests |
| `src/features/websocket/WebSocketProtocolSelector.tsx` | NEW | Protocol selector dropdown component |
| `src/features/websocket/WebSocketProtocolSelector.test.tsx` | NEW | Selector UI tests |
| `src/shared/websocket/types.ts` | MODIFY | Add `protocolMode` to `WsConnectionProfile`, `WsFrameProtocolMeta` with `isSystemPacket?` |
| `src/features/websocket/useWebSocketStudio.ts` | MODIFY | Add protocol state, auto-detection on connect/message |
| `src/features/websocket/useWebSocketStudio.test.ts` | MODIFY | Protocol detection integration tests |
| `src/features/websocket/WebSocketConnectPanel.tsx` | MODIFY | Integrate protocol selector + detected badge |
| `src/features/websocket/WebSocketConnectPanel.test.tsx` | MODIFY | Protocol selector rendering tests |
| `src/features/websocket/WebSocketStudioPage.tsx` | MODIFY | Pass protocol props, profile save/load integration |
| `src/features/websocket/WebSocketStudioPage.test.tsx` | MODIFY | Update makeStudioReturn with protocol fields |
| `src/styles/websocket-studio.css` | MODIFY | Protocol selector (`.ws-protocol-selector-wrapper`, `.ws-protocol-select`) and badge (`.ws-protocol-badge`, `.ws-protocol-detected-badge`) styles |

#### 3A Success Criteria

- [x] Protocol selector dropdown with 5 options (Auto, Raw, Socket.IO, STOMP, GraphQL-WS)
- [x] All protocols now fully available and selectable (originally showed "coming soon" during Phase 3A; enabled in 3B/3C/3E)
- [x] Auto-detection resolves protocol from URL patterns
- [x] Auto-detection resolves protocol from subprotocol headers
- [x] Auto-detection resolves protocol from first received message content
- [x] Protocol mode persisted in connection profiles (save + load)
- [x] Status bar shows protocol badge when connected
- [x] Selector disabled while connected (config lock)
- [x] Unit test coverage >90% for protocolDetector and protocolTypes
- [x] All existing tests continue to pass

### Phase 3B — Socket.IO Codec & Integration

> **Goal:** Full Socket.IO v4/Engine.IO v4 packet codec, auto-handshake (ping/pong, CONNECT), decoded message log display, and Socket.IO event compose mode.

#### 3B.1 — Socket.IO Codec

- [x] ✅ Done — Engine.IO packet types: OPEN(0), CLOSE(1), PING(2), PONG(3), MESSAGE(4), UPGRADE(5), NOOP(6)
- [x] ✅ Done — Socket.IO packet types: CONNECT(0), DISCONNECT(1), EVENT(2), ACK(3), CONNECT_ERROR(4), BINARY_EVENT(5), BINARY_ACK(6)
- [x] ✅ Done — `decodeSioPacket(raw)` → `SioDecodedPacket { engineType, socketType?, namespace?, eventName?, data?, ackId? }`
- [x] ✅ Done — `encodeSioEvent(event, data, namespace?, ackId?)` → raw string (e.g. `42["msg","hi"]`)
- [x] ✅ Done — `encodeSioConnect(namespace?)` → raw string (e.g. `40` or `40/chat,`)
- [x] ✅ Done — `getSioPacketSummary(packet)` → human-readable label for message log
- [x] ✅ Done — `encodeSioPong()` → Engine.IO PONG response (type `3`)
- [x] ✅ Done — `isSioPing(raw)` / `isSioOpen(raw)` → detection helpers for auto-handshake
- [x] ✅ Done — `ENGINE_TYPES`, `ENGINE_TYPE_NAMES`, `SOCKET_TYPES`, `SOCKET_TYPE_NAMES` constants
- [x] ✅ Done — `SioOpenPayload` interface: `{ sid, upgrades, pingInterval, pingTimeout }`
- [x] ✅ Done — File: `src/shared/websocket/protocols/socketIoCodec.ts`
- [x] ✅ Done — Tests: `src/shared/websocket/protocols/socketIoCodec.test.ts`

#### 3B.2 — Frame Protocol Metadata

- [x] ✅ Done — `WsFrameProtocolMeta` interface on `WsFrame` (optional field)
- [x] ✅ Done — Fields: `protocol`, `packetType`, `summary`, `namespace?`, `eventName?`, `ackId?`, `isSystemPacket?`
- [x] ✅ Done — `isSystemPacket` flag drives muted rendering of PING/PONG/OPEN/CONNECT/heartbeat/init/ack frames
- [x] ✅ Done — Codec annotates frames when effective protocol is `socket-io`

#### 3B.3 — Hook Integration (Auto-Handshake)

- [x] ✅ Done — When effective protocol is `socket-io`:
  - Auto-respond to Engine.IO PING (type `2`) with PONG (type `3`)
  - Auto-send Socket.IO CONNECT (`40`) after Engine.IO OPEN packet received
  - Parse Engine.IO OPEN to extract `pingInterval`/`pingTimeout` (parsed into `SioOpenPayload` but not displayed in UI — deferred polish)
- [x] ✅ Done — Annotate all frames with `protocolMeta` using the codec
- [x] ✅ Done — System frames (PING/PONG/OPEN) marked as non-user messages

#### 3B.4 — Message Log Enhancement

- [x] ✅ Done — When frame has `protocolMeta`, show packet type badge and event name instead of raw data
- [x] ✅ Done — System packets (PING/PONG/OPEN/CONNECT) visually distinct (muted, smaller)
- [x] ✅ Done — EVENT packets show event name prominently
- [x] ✅ Done — ACK packets show ack ID

#### 3B.5 — Socket.IO Event Compose Mode

- [x] ✅ Done — When effective protocol is `socket-io`, compose bar shows event name input
- [x] ✅ Done — Event name field + JSON data textarea
- [x] ✅ Done — On send, encodes using `encodeSioEvent()` before sending
- [x] ✅ Done — Namespace field (defaults to `/`)

#### 3B.6 — Enable in Protocol Selector

- [x] ✅ Done — Mark `socket-io` as `available: true` in `PROTOCOL_REGISTRY`

#### 3B — Design Decisions

| Decision | Rationale |
|---|---|
| **No HTTP polling transport** | Testing tool connects via WebSocket directly (`?transport=websocket`). Users provide the WS URL. |
| **No Socket.IO-specific reconnect** | Phase 2C's generic auto-reconnect handles this adequately. |
| **No BINARY_EVENT/BINARY_ACK** | Multi-packet binary attachment protocol is complex; deferred to future enhancement. |
| **Auto ping/pong is essential** | Without it, Socket.IO server disconnects after `pingTimeout` (default 20s). |
| **Auto CONNECT after OPEN** | Without it, the server won't deliver events. This is mandatory handshake. |

#### 3B Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/protocols/socketIoCodec.ts` | NEW | Engine.IO + Socket.IO packet codec (`decodeSioPacket`, `encodeSioEvent`, `encodeSioPong`, etc.) |
| `src/shared/websocket/protocols/socketIoCodec.test.ts` | NEW | Codec tests |
| `src/shared/websocket/types.ts` | MODIFY | Add `WsFrameProtocolMeta` (with `isSystemPacket?`) to `WsFrame` |
| `src/shared/websocket/protocols/protocolTypes.ts` | MODIFY | Mark socket-io available |
| `src/features/websocket/wsProtocolHelpers.ts` | MODIFY | Add `buildSioMeta`, SIO auto-respond (PING→PONG, OPEN→CONNECT) |
| `src/features/websocket/wsProtocolHelpers.test.ts` | MODIFY | SIO annotation + auto-respond tests |
| `src/features/websocket/useWebSocketStudio.ts` | MODIFY | Wire `checkAutoRespond` for SIO, frame annotation |
| `src/features/websocket/WebSocketMessageLog.tsx` | MODIFY | SIO compose mode (event name, namespace) + protocol-aware display |
| `src/features/websocket/WebSocketMessageLog.test.tsx` | MODIFY | SIO compose + display tests |
| `src/styles/websocket-studio.css` | MODIFY | Socket.IO message styling (`.ws-sio-compose-fields`, `[data-type="EVENT"]`, etc.) |

### Phase 3C — STOMP Codec & Integration

> **Goal:** Full STOMP v1.2 frame codec, heartbeat auto-response, decoded message log display, and STOMP SEND compose mode.

#### 3C.1 — STOMP Codec

- [x] ✅ Done — STOMP frame format: `COMMAND\n` + `headers\n` + `\n` + `body\0`
- [x] ✅ Done — Client commands: CONNECT, STOMP, SEND, SUBSCRIBE, UNSUBSCRIBE, ACK, NACK, DISCONNECT, BEGIN, COMMIT, ABORT
- [x] ✅ Done — Server commands: CONNECTED, MESSAGE, RECEIPT, ERROR
- [x] ✅ Done — `decodeStompFrame(raw)` → `StompFrame { command, headers, body, raw }`
- [x] ✅ Done — `encodeStompFrame(command, headers, body?)` → raw string
- [x] ✅ Done — `encodeStompConnect(host?, login?, passcode?, heartBeat?)` → CONNECT frame
- [x] ✅ Done — `encodeStompSend(destination, body?, contentType?, headers?)` → SEND frame
- [x] ✅ Done — `encodeStompSubscribe(destination, id, ack?)` → SUBSCRIBE frame
- [x] ✅ Done — `encodeStompDisconnect(receipt?)` → DISCONNECT frame
- [x] ✅ Done — `getStompFrameSummary(frame)` → human-readable label
- [x] ✅ Done — `isStompHeartbeat(raw)` → detect heartbeat (empty line / LF / CR+LF)
- [x] ✅ Done — `encodeStompHeartbeat()` → heartbeat auto-response (LF)
- [x] ✅ Done — `isStompFrame(raw)` → detect valid STOMP frame
- [x] ✅ Done — `STOMP_CLIENT_COMMANDS`, `STOMP_SERVER_COMMANDS` constants
- [x] ✅ Done — File: `src/shared/websocket/protocols/stompCodec.ts`
- [x] ✅ Done — Tests: `src/shared/websocket/protocols/stompCodec.test.ts`

#### 3C.2 — Hook Integration (Heartbeat & Annotation)

- [x] ✅ Done — When effective protocol is `stomp`:
  - Auto-respond to heartbeat frames (empty/LF) with heartbeat (LF)
  - Annotate all frames with `protocolMeta` using the codec
  - System frames (heartbeats, CONNECTED) marked as non-user messages
- [x] ✅ Done — **No auto-CONNECT**: STOMP CONNECT requires host/credentials; user sends manually

#### 3C.3 — Message Log Enhancement

- [x] ✅ Done — When frame has STOMP `protocolMeta`, show command + destination
- [x] ✅ Done — MESSAGE frames show destination prominently
- [x] ✅ Done — System packets (heartbeats, CONNECTED) visually muted

#### 3C.4 — STOMP Compose Mode

- [x] ✅ Done — When effective protocol is `stomp`, compose bar shows STOMP fields
- [x] ✅ Done — Command selector (SEND, SUBSCRIBE, UNSUBSCRIBE, DISCONNECT, CONNECT, ACK, NACK)
- [x] ✅ Done — Input field: Destination (SEND/SUBSCRIBE), Host (CONNECT), ID (UNSUBSCRIBE/ACK/NACK)
- [x] ✅ Done — Body textarea
- [x] ✅ Done — On send, encodes using `encodeStompFrame()` before sending

#### 3C.5 — Enable in Protocol Selector

- [x] ✅ Done — Mark `stomp` as `available: true` in `PROTOCOL_REGISTRY`

#### 3C — Design Decisions

| Decision | Rationale |
|---|---|
| **No auto-CONNECT** | STOMP CONNECT requires host/login/passcode — user must provide these. Unlike Socket.IO, it's not a parameterless handshake. |
| **Heartbeat auto-response** | Without it, server disconnects after negotiated heart-beat timeout. Trivial to implement (send LF). |
| **No subscription management UI** | User can send SUBSCRIBE/UNSUBSCRIBE manually via the compose mode. Full subscription tracking is a future enhancement. |
| **No transactions** | BEGIN/COMMIT/ABORT are advanced features; user can send raw frames. |

#### 3C Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/protocols/stompCodec.ts` | NEW | STOMP frame codec (`decodeStompFrame`, `encodeStompFrame`, `encodeStompHeartbeat`, etc.) |
| `src/shared/websocket/protocols/stompCodec.test.ts` | NEW | Codec tests |
| `src/shared/websocket/protocols/protocolTypes.ts` | MODIFY | Mark stomp available |
| `src/features/websocket/wsProtocolHelpers.ts` | MODIFY | Add `buildStompMeta`, STOMP heartbeat auto-respond |
| `src/features/websocket/wsProtocolHelpers.test.ts` | MODIFY | STOMP annotation + heartbeat tests |
| `src/features/websocket/useWebSocketStudio.ts` | MODIFY | Wire `checkAutoRespond` for STOMP |
| `src/features/websocket/WebSocketMessageLog.tsx` | MODIFY | STOMP compose mode (command/destination/body) + message display |
| `src/features/websocket/WebSocketMessageLog.test.tsx` | MODIFY | STOMP compose + display tests |
| `src/styles/websocket-studio.css` | MODIFY | STOMP message styling (`.ws-stomp-compose-fields`, `[data-type="MESSAGE"]`, etc.) |

### Phase 3D — Advanced TLS & mTLS Support

> **Goal:** Add TLS certificate customization to the proxy transport for testing against servers with self-signed certs, internal CAs, or mTLS requirements.

> **Note:** TLS options only apply to the server proxy transport. Direct browser WebSocket connections use the browser's built-in TLS handling and cannot be customized.

#### 3D.1 — Contract & Service Changes

- [x] ✅ Done — Add `WsTlsConfig` to `contracts.ts`: `{ caCert?, clientCert?, clientKey?, rejectUnauthorized? }`
- [x] ✅ Done — Extend `WsProxyConnectRequest` with optional `tls?: WsTlsConfig`
- [x] ✅ Done — In `websocket-service.ts`, map TLS config to `ws` ClientOptions (`ca`, `cert`, `key`, `rejectUnauthorized`)
- [x] ✅ Done — Unit tests for TLS pass-through in service

#### 3D.2 — Client Types & Hook Integration

- [x] ✅ Done — Add `WsTlsConfig` type to shared WebSocket types
- [x] ✅ Done — Store `tlsConfig` state in `useWebSocketStudio`
- [x] ✅ Done — Pass `tlsConfig` to proxy connect request
- [x] ✅ Done — `createDefaultTlsConfig()` factory for empty TLS state
- [x] ✅ Done — `hasTlsOverrides(config)` helper: detects non-default TLS settings (used for transport routing)

#### 3D.3 — TLS Configuration Panel UI

- [x] ✅ Done — New `WebSocketTlsPanel.tsx` component
- [x] ✅ Done — Toggle: "Skip certificate validation" (maps to `rejectUnauthorized: false`)
- [x] ✅ Done — Textarea: CA certificate (PEM format)
- [x] ✅ Done — Textarea: Client certificate (PEM format, for mTLS)
- [x] ✅ Done — Textarea: Client private key (PEM format, for mTLS)
- [x] ✅ Done — Info banner: "TLS options only apply when using proxy transport"
- [x] ✅ Done — Collapsible panel in the connect area

#### 3D.4 — Profile Persistence

- [x] ✅ Done — `WsConnectionProfile` includes `tlsConfig`
- [x] ✅ Done — Save/load TLS settings with profiles
- [x] ✅ Done — Sensitive fields (clientKey) stored with profiles
- Note: `exportProfiles()` currently exports full JSON including `clientKey` — plan intended to strip sensitive fields; documented as known limitation (see Re-evaluation Note #131)

#### 3D — Design Decisions

| Decision | Rationale |
|---|---|
| **PEM paste only (no file picker)** | Avoids FS access complexity across web/Tauri platforms. Users can paste cert contents. |
| **Proxy transport only** | Browser WebSocket API has no TLS customization. Only the Node.js proxy can use custom certs. |
| **rejectUnauthorized default true** | Safe by default. User must explicitly opt-in to skip validation. |
| **No PKCS12 support** | Requires binary handling + passphrase prompt. PEM covers 95% of use cases. |

#### 3D Files

| File | Action | Purpose |
|---|---|---|
| `src-server/websocket/contracts.ts` | MODIFY | Add `WsTlsConfig` to `WsProxyConnectRequest.tls?` |
| `src-server/websocket/websocket-service.ts` | MODIFY | Map TLS config to `ws` ClientOptions (`buildTlsAgent`: `ca`, `cert`, `key`, `rejectUnauthorized`) |
| `src-server/websocket/websocket-service.test.ts` | MODIFY | TLS integration tests (3 cases) |
| `src/shared/websocket/types.ts` | MODIFY | Add `WsTlsConfig`, `createDefaultTlsConfig()`, `hasTlsOverrides()` |
| `src/features/websocket/WebSocketTlsPanel.tsx` | NEW | TLS config UI panel (collapsible) |
| `src/features/websocket/WebSocketTlsPanel.test.tsx` | NEW | Panel tests |
| `src/features/websocket/useWebSocketStudio.ts` | MODIFY | TLS state (`tlsConfig`, `setTlsConfig`) + proxy pass-through |
| `src/features/websocket/useWebSocketStudio.test.ts` | MODIFY | TLS state tests |
| `src/features/websocket/WebSocketStudioPage.tsx` | MODIFY | Include TLS panel + wire TLS props |
| `src/features/websocket/WebSocketStudioPage.test.tsx` | MODIFY | TLS prop tests |
| `src/app/hooks/useWebSocketProfiles.ts` | MODIFY | `tlsConfig` persistence in profile save/load |
| `src/styles/websocket-studio.css` | MODIFY | TLS panel styling (`.ws-tls-panel`, `.ws-tls-toggle`, `.ws-tls-body`, `.ws-tls-textarea`, `.ws-tls-info-banner`) |

### Phase 3E — GraphQL over WebSocket (graphql-ws)

> **Goal:** Full `graphql-ws` protocol codec, auto-init handshake, ping/pong keepalive, operation compose mode with query + variables, and decoded message log display.

#### 3E.1 — GraphQL-WS Codec

- [x] ✅ Done — Client→Server: `connection_init`, `subscribe`, `complete`, `ping`, `pong`
- [x] ✅ Done — Server→Client: `connection_ack`, `next`, `error`, `complete`, `ping`, `pong`
- [x] ✅ Done — `decodeGqlWsMessage(raw)` → `GqlWsMessage { type, id?, payload? }`
- [x] ✅ Done — `encodeGqlWsConnectionInit(payload?)` → JSON string
- [x] ✅ Done — `encodeGqlWsSubscribe(id, query, variables?, operationName?)` → JSON string
- [x] ✅ Done — `encodeGqlWsComplete(id)` → JSON string
- [x] ✅ Done — `encodeGqlWsPing(payload?)` / `encodeGqlWsPong(payload?)` → JSON string
- [x] ✅ Done — `getGqlWsMessageSummary(msg)` → human-readable label
- [x] ✅ Done — `isGqlWsPing(msg)` → boolean for auto-pong trigger
- [x] ✅ Done — `isGqlWsConnectionAck(msg)` → boolean for connection ack detection
- [x] ✅ Done — `GQL_CLIENT_TYPES`, `GQL_SERVER_TYPES` constants
- [x] ✅ Done — File: `src/shared/websocket/protocols/graphqlWsCodec.ts`
- [x] ✅ Done — Tests: `src/shared/websocket/protocols/graphqlWsCodec.test.ts`

#### 3E.2 — Hook Integration (Auto-Init & Ping/Pong)

- [x] ✅ Done — When effective protocol is `graphql-ws`:
  - Auto-send `connection_init` after WebSocket opens
  - Auto-respond to server `ping` with `pong`
  - Annotate all frames with `protocolMeta`
  - System packets: `connection_init`, `connection_ack`, `ping`, `pong`

#### 3E.3 — Message Log Enhancement

- [x] ✅ Done — Show decoded message type + operation ID
- [x] ✅ Done — `next` frames show truncated data preview
- [x] ✅ Done — `error` frames highlighted in red
- [x] ✅ Done — System packets (init, ack, ping, pong) visually muted

#### 3E.4 — GraphQL Compose Mode

- [x] ✅ Done — When effective protocol is `graphql-ws`, compose bar shows GraphQL fields
- [x] ✅ Done — Query textarea (for GraphQL query/subscription/mutation text)
- [x] ✅ Done — Variables textarea (JSON)
- [x] ✅ Done — Auto-incrementing operation IDs
- [x] ✅ Done — On send, encodes as `subscribe` message
- Note: `operationName` parameter is supported by the codec but not exposed in the compose UI (deferred polish)

#### 3E.5 — Enable in Protocol Selector

- [x] ✅ Done — Mark `graphql-ws` as `available: true` in `PROTOCOL_REGISTRY`

#### 3E — Design Decisions

| Decision | Rationale |
|---|---|
| **Auto-send `connection_init`** | Like Socket.IO auto-CONNECT, the graphql-ws handshake requires init before any operation. Empty payload works for most servers. |
| **Auto-respond to `ping`** | Without it, server may disconnect. Same pattern as STOMP heartbeat. |
| **Sequential string IDs** | `"1"`, `"2"`, `"3"` — simple, spec-compliant, easy to track. |
| **No introspection** | Auto-complete from schema is a stretch goal deferred to a future phase. |
| **All messages are JSON** | Unlike Socket.IO/STOMP, graphql-ws has no custom framing — all messages are standard JSON. |

#### 3E Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/protocols/graphqlWsCodec.ts` | NEW | graphql-ws message codec (`decodeGqlWsMessage`, `encodeGqlWsSubscribe`, `isGqlWsConnectionAck`, etc.) |
| `src/shared/websocket/protocols/graphqlWsCodec.test.ts` | NEW | Codec tests |
| `src/shared/websocket/protocols/protocolTypes.ts` | MODIFY | Mark graphql-ws available |
| `src/features/websocket/wsProtocolHelpers.ts` | MODIFY | Add `buildGqlWsMeta`, `buildGqlWsInitAction`, GQL ping→pong auto-respond |
| `src/features/websocket/wsProtocolHelpers.test.ts` | MODIFY | GQL annotation + auto-respond tests |
| `src/features/websocket/useWebSocketStudio.ts` | MODIFY | Wire auto-init on connect + `checkAutoRespond` for GQL |
| `src/features/websocket/WebSocketMessageLog.tsx` | MODIFY | GraphQL compose mode (query/variables/opId) + message display |
| `src/features/websocket/WebSocketMessageLog.test.tsx` | MODIFY | GQL compose + display tests |
| `src/styles/websocket-studio.css` | MODIFY | GraphQL message styling (`.ws-gql-compose-fields`, `[data-type="subscribe"]`, `[data-type="next"]`, etc.) |

### Phase 3 New Files Summary

```
src/shared/websocket/
  protocols/
    protocolTypes.ts               NEW (3A) — Protocol mode type, registry, detection result
    protocolDetector.ts            NEW (3A) — Auto-detect protocol from URL/subprotocol/message
    protocolDetector.test.ts       NEW (3A)
    socketIoCodec.ts               NEW (3B) — Socket.IO packet encoder/decoder
    socketIoCodec.test.ts          NEW (3B)
    stompCodec.ts                  NEW (3C) — STOMP frame parser/serializer
    stompCodec.test.ts             NEW (3C)
    graphqlWsCodec.ts              NEW (3E) — graphql-ws message codec
    graphqlWsCodec.test.ts         NEW (3E)

src/features/websocket/
  WebSocketProtocolSelector.tsx    NEW (3A) — Protocol mode picker dropdown
  WebSocketProtocolSelector.test.tsx NEW (3A)
  WebSocketTlsPanel.tsx            NEW (3D) — TLS/mTLS certificate config UI (collapsible panel)
  WebSocketTlsPanel.test.tsx       NEW (3D)
  wsProtocolHelpers.ts             MODIFY (3B/3C/3E) — Auto-handshake + protocolMeta annotation + compose filter logic
  wsProtocolHelpers.test.ts        MODIFY (3B/3C/3E) — Protocol helper tests

  useWebSocketStudio.ts            MODIFY (3A–3E) — Protocol state, detection, TLS state, auto-respond calls
  useWebSocketStudio.test.ts       MODIFY (3A–3E) — Protocol integration tests
  WebSocketConnectPanel.tsx        MODIFY (3A/3D) — Protocol selector + TLS panel placement
  WebSocketConnectPanel.test.tsx   MODIFY (3A/3D) — Selector + TLS rendering tests
  WebSocketMessageLog.tsx          MODIFY (3B/3C/3E) — Protocol compose modes + protocol-aware display
  WebSocketMessageLog.test.tsx     MODIFY (3B/3C/3E) — Protocol compose + display tests
  WebSocketStudioPage.tsx          MODIFY (3A/3D) — Protocol + TLS props wiring
  WebSocketStudioPage.test.tsx     MODIFY (3A/3D) — Updated mock return types

src/shared/websocket/
  types.ts                         MODIFY (3A–3D) — WsFrameProtocolMeta, WsTlsConfig, protocolMode/tlsConfig on profile

src-server/websocket/
  contracts.ts                     MODIFY (3D) — WsTlsConfig on connect request
  websocket-service.ts             MODIFY (3D) — TLS → ws ClientOptions mapping
  websocket-service.test.ts        MODIFY (3D) — TLS integration tests

src/styles/
  websocket-studio.css             MODIFY (3A–3E) — Protocol selector, TLS panel, protocol message styling
```

> **Note:** `contracts.ts`, `websocket-service.ts`, and `websocket-routes.ts` already exist from Phase 1. Phase 3 only modifies the service to add TLS features.

> **Note:** Socket.IO, STOMP, and GraphQL-WS compose modes are integrated directly into `WebSocketMessageLog.tsx` rather than as separate panel components. The compose bar adapts its UI (event name field for Socket.IO, command/destination for STOMP, query/variables for GraphQL-WS) based on the effective protocol.

> **Note:** `wsProtocolHelpers.ts` was originally created in Phase 1 as a stub but filled with all protocol logic during Phase 3B/3C/3E. It is the central module for auto-handshake (SIO PING→PONG, OPEN→CONNECT; STOMP heartbeat; GQL ping→pong), `protocolMeta` annotation, and compose-mode filter logic. It bridges the codecs and the hook.

### Phase 3 Success Criteria ✅ All Done

- [x] Protocol selector: Auto / Raw / Socket.IO / STOMP / GraphQL-WS
- [x] Auto-detection from URL pattern, subprotocol, and first message content
- [x] Socket.IO: auto-handshake (OPEN → CONNECT), emit event, receive events with parsed packet display
- [x] Socket.IO: namespace in compose, ACK tracking in decoded log
- [x] STOMP: CONNECT, SUBSCRIBE, SEND frames with destination input in compose mode
- [x] STOMP: MESSAGE frames displayed with headers and body
- [x] STOMP: heartbeat auto-response + display
- [x] GraphQL-WS: auto-init handshake (`connection_init`), subscribe operation with variables editor
- [x] GraphQL-WS: incoming `next`/`error`/`complete` messages parsed and displayed
- [x] GraphQL-WS: auto-respond to server `ping` with `pong`
- [x] TLS config: custom CA certificate paste (PEM format) via existing server proxy
- [x] TLS config: self-signed cert skip validation toggle (`rejectUnauthorized`)
- [x] TLS config: mutual TLS (client cert + key) authentication
- [x] TLS config: collapsible panel with "proxy only" info banner
- [x] TLS config persisted in connection profiles
- [x] Message log correctly identifies protocol-specific message types with `protocolMeta`
- [x] System packets (PING/PONG/OPEN/CONNECT/heartbeat/connection_init/connection_ack) visually muted
- [x] Unit test coverage >90% for all codec modules + protocol detection + TLS panel

---

## Phase 4 — Workflow Integration

> **Goal:** WebSocket nodes in the Workflow Designer for automated testing sequences.

### Phase 4 Scope

Four new workflow node types:

| Node | Purpose | Category |
|---|---|---|
| `wsConnect` | Open a WebSocket connection and hold it for the workflow duration | Integration |
| `wsSend` | Send a message on an open connection | Integration |
| `wsReceive` | Wait for a message matching criteria (with timeout) | Integration |
| `wsTrigger` | Start a workflow when a WebSocket message arrives | Trigger |

### Phase 4 Architecture

```ts
// ── Workflow Node Types ───────────────────────────────────────────────

// Added to WorkflowNodeType union in workflow.ts:
// 'wsConnect' | 'wsSend' | 'wsReceive' | 'wsTrigger'

export interface WsConnectNodeData {
  [key: string]: unknown;         // required index signature (all WorkflowNodeData types have this)
  label: string;                  // node display label (all WorkflowNodeData types have this)
  url: string;                    // supports {{variable}} interpolation
  headers: WsKeyValueEntry[];     // reuses WsKeyValueEntry from src/shared/websocket/types.ts
  queryParams: WsKeyValueEntry[];
  subprotocols: string[];
  connectionId: string;           // label for this connection (used by downstream nodes)
  timeoutMs: number;              // connection timeout
  outputBindings: WsConnectOutputBinding[];
}

export interface WsConnectOutputBinding {
  field: 'protocol' | 'extensions' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsSendNodeData {
  [key: string]: unknown;
  label: string;
  connectionId: string;           // references wsConnect node's connectionId
  message: string;                // supports {{variable}} interpolation
  type: 'text' | 'binary';
  waitForResponse: boolean;       // if true, waits for next message after send
  responseTimeoutMs: number;      // timeout for waitForResponse
  outputBindings: WsSendOutputBinding[];
}

export interface WsSendOutputBinding {
  field: 'responseBody' | 'responseType' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsReceiveNodeData {
  [key: string]: unknown;
  label: string;
  connectionId: string;
  timeoutMs: number;
  matchCriteria: WsMatchCriteria;
  extractionRules: WsExtractionRule[];
  outputBindings: WsReceiveOutputBinding[];
}

export interface WsMatchCriteria {
  contentContains?: string;       // substring match
  contentRegex?: string;          // regex match
  jsonPathMatch?: string;         // JSONPath expression that must match
  jsonPathValue?: string;         // expected value for jsonPathMatch
  messageType?: 'text' | 'binary' | 'any';
}

export interface WsExtractionRule {
  variableName: string;
  jsonPath: string;               // extract value at this path
}

export interface WsReceiveOutputBinding {
  field: 'messageBody' | 'messageType' | 'matchedAt' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface WsTriggerNodeData {
  [key: string]: unknown;
  label: string;
  url: string;
  connectionId: string;
  matchCriteria: WsMatchCriteria;
  extractionRules: WsExtractionRule[];
  samplePayload?: string;         // for Quick Test dry runs
}
```

### Phase 4 Sub-Phases

Phase 4 is broken into five sub-phases to manage complexity:

| Sub-Phase | Scope | Dependencies |
|---|---|---|
| **4A** — Types, Factory & Canvas Nodes | Type definitions, default data, nodeTypes map, canvas components, icons, palette | None |
| **4B** — Config Panels | 4 config panel components + modal dispatch + variable hints | 4A |
| **4C** — Engine Handlers & Operations Bridge | WsNodeOperations interface, bridge, handlers, context wiring | 4A |
| **4D** — Runner Wiring & Trace Capture | graphRunner dispatch, trace enrichment, sub-workflow passthrough, load runner | 4C |
| **4E** — Results Explorer & Labels | Node type labels, trace rendering, console log reconstruction | 4D |

---

### Phase 4A — Types, Factory & Canvas Nodes

> **Goal:** Define all WebSocket node types, register them in the factory, create canvas components, add to palette with icons.

#### 4A.1 — Type Definitions

- [x] ✅ Done — Add `'wsConnect' | 'wsSend' | 'wsReceive' | 'wsTrigger'` to `WorkflowNodeType` union
- [x] ✅ Done — Add `WsConnectNodeData | WsSendNodeData | WsReceiveNodeData | WsTriggerNodeData` to `WorkflowNodeData` union
- [x] ✅ Done — Define all 4 `*NodeData` interfaces (from architecture section above)
- [x] ✅ Done — File: `src/features/workflow/types/workflow.ts`

#### 4A.2 — Factory Registration

- [x] ✅ Done — Add `defaultWsConnectNodeData()`, `defaultWsSendNodeData()`, `defaultWsReceiveNodeData()`, `defaultWsTriggerNodeData()` helper functions
- [x] ✅ Done — Add 4 cases to `defaultNodeData()` switch
- [x] ✅ Done — Add 4 entries to `nodeTypes` map (canvas component references)
- [x] ✅ Done — File: `src/features/workflow/utils/workflowNodeFactory.ts`

#### 4A.3 — Canvas Node Components

- [x] ✅ Done — `WsConnectNode.tsx` — uses `useNodeBase`, shows URL preview, `wf-node-wsConnect` CSS class
- [x] ✅ Done — `WsSendNode.tsx` — shows connectionId + message preview
- [x] ✅ Done — `WsReceiveNode.tsx` — shows connectionId + match criteria preview
- [x] ✅ Done — `WsTriggerNode.tsx` — trigger-style node (single outgoing handle), shows URL
- [x] ✅ Done — Follow existing pattern: `NodeIcon`, `NodeConfigureButton`, `NodeStatusBadge`, handles
- [x] ✅ Done — Files: `src/features/workflow/components/nodes/WsConnectNode.tsx`, `WsSendNode.tsx`, `WsReceiveNode.tsx`, `WsTriggerNode.tsx`
- [x] ✅ Done — Tests: `src/features/workflow/components/nodes/WsNodes.test.tsx`

#### 4A.4 — Palette Entries

- [x] ✅ Done — Add `wsConnect` to `ALL_BLOCKS` — category: `'actions'`, title: "WS Connect", desc: "Open a WebSocket connection"
- [x] ✅ Done — Add `wsSend` to `ALL_BLOCKS` — category: `'actions'`, title: "WS Send", desc: "Send a message on a WebSocket connection"
- [x] ✅ Done — Add `wsReceive` to `ALL_BLOCKS` — category: `'actions'`, title: "WS Receive", desc: "Wait for a matching WebSocket message"
- [x] ✅ Done — Add `wsTrigger` to `ALL_BLOCKS` — category: `'triggers'`, title: "WS Trigger", desc: "Start workflow from a WebSocket message"
- [x] ✅ Done — File: `src/features/workflow/components/canvas/WorkflowPalette.tsx`

#### 4A.5 — Node Icons

- [x] ✅ Done — Add `wsConnect: { category: 'integration', svg: ... }` — WebSocket plug icon
- [x] ✅ Done — Add `wsSend: { category: 'integration', svg: ... }` — outgoing arrow icon
- [x] ✅ Done — Add `wsReceive: { category: 'integration', svg: ... }` — incoming arrow icon
- [x] ✅ Done — Add `wsTrigger: { category: 'trigger', svg: ... }` — WebSocket lightning icon
- [x] ✅ Done — File: `src/features/workflow/components/nodes/NodeIcon.tsx`

#### 4A.6 — Variable Hints Inclusion

- [x] ✅ Done — Add `'wsConnect', 'wsSend', 'wsReceive', 'wsTrigger'` to the condition-variable-hints inclusion list in `useWorkflowVariableHints()` (exported from `useWorkflowCanvasSync.ts`)
- [x] ✅ Done — This controls which node types get upstream variable hints in the config modal (not modal width — all config modals already use `expandMode="fullscreen"`)
- [x] ✅ Done — File: `src/features/workflow/hooks/useWorkflowCanvasSync.ts`

#### 4A.7 — CSS

- [x] ✅ Done — Add `.wf-node-wsConnect`, `.wf-node-wsSend`, `.wf-node-wsReceive`, `.wf-node-wsTrigger` canvas node styles
- [x] ✅ Done — File: `src/styles/workflow.css`

#### 4A Files

| File | Action | Purpose |
|---|---|---|
| `src/features/workflow/types/workflow.ts` | MODIFY | Add WS types to unions + 4 data interfaces |
| `src/features/workflow/utils/workflowNodeFactory.ts` | MODIFY | nodeTypes map + defaultNodeData switch + 4 default helpers |
| `src/features/workflow/components/nodes/WsConnectNode.tsx` | NEW | wsConnect canvas node |
| `src/features/workflow/components/nodes/WsSendNode.tsx` | NEW | wsSend canvas node |
| `src/features/workflow/components/nodes/WsReceiveNode.tsx` | NEW | wsReceive canvas node |
| `src/features/workflow/components/nodes/WsTriggerNode.tsx` | NEW | wsTrigger canvas node |
| `src/features/workflow/components/canvas/WorkflowPalette.tsx` | MODIFY | Add 4 palette entries |
| `src/features/workflow/components/nodes/NodeIcon.tsx` | MODIFY | Add 4 icon entries |
| `src/features/workflow/hooks/useWorkflowCanvasSync.ts` | MODIFY | Add WS types to variable-hints inclusion list in `useWorkflowVariableHints()` |
| `src/features/workflow/utils/workflowVariableHints.ts` | MODIFY | Add WS types to `NON_HTTP_TYPES` set for `isHttpWorkflowNode()` |
| `src/styles/workflow.css` | MODIFY | Add WS node CSS classes |

---

### Phase 4B — Config Panels

> **Goal:** Config panels for all 4 WebSocket node types with variable insertion support, wired into the config modal.

#### 4B.1 — WsConnectConfig

- [x] ✅ Done — URL input with `{{variable}}` insertion
- [x] ✅ Done — Headers key-value editor (add/remove/toggle)
- [x] ✅ Done — Query params key-value editor
- [x] ✅ Done — Subprotocols input (comma-separated)
- [x] ✅ Done — Connection ID label (auto-generated or user-supplied, referenced by downstream nodes)
- [x] ✅ Done — Timeout input (ms)
- [x] ✅ Done — Output bindings table (protocol, extensions, latencyMs)
- [x] ✅ Done — File: `src/features/workflow/components/configs/WsConnectConfig.tsx`

#### 4B.2 — WsSendConfig

- [x] ✅ Done — Connection ID selector (dropdown of upstream `wsConnect` nodes' connectionIds)
- [x] ✅ Done — Message textarea with `{{variable}}` insertion
- [x] ✅ Done — Message type selector (text / binary)
- [x] ✅ Done — "Wait for response" checkbox + timeout input
- [x] ✅ Done — Output bindings table (responseBody, responseType, latencyMs)
- [x] ✅ Done — File: `src/features/workflow/components/configs/WsSendConfig.tsx`

#### 4B.3 — WsReceiveConfig

- [x] ✅ Done — Connection ID selector
- [x] ✅ Done — Timeout input (ms)
- [x] ✅ Done — Match criteria section:
  - Content contains (substring)
  - Content regex
  - JSONPath match expression + expected value
  - Message type filter (text / binary / any)
- [x] ✅ Done — Extraction rules table (variableName + jsonPath pairs)
- [x] ✅ Done — Output bindings table (messageBody, messageType, matchedAt, latencyMs)
- [x] ✅ Done — File: `src/features/workflow/components/configs/WsReceiveConfig.tsx`

#### 4B.4 — WsTriggerConfig

- [x] ✅ Done — URL input with `{{variable}}` insertion
- [x] ✅ Done — Connection ID label
- [x] ✅ Done — Match criteria section (same as WsReceive)
- [x] ✅ Done — Extraction rules table
- [x] ✅ Done — Sample payload textarea (for Quick Test dry runs)
- [x] ✅ Done — File: `src/features/workflow/components/configs/WsTriggerConfig.tsx`

#### 4B.5 — Config Modal Dispatch

- [x] ✅ Done — Add 4 conditional blocks to `WorkflowNodeConfigModal.tsx` for WS node types
- [x] ✅ Done — File: `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx`

#### 4B.6 — Variable Hints

- [x] ✅ Done — Add `NODE_TYPE_DISPLAY` entries for all 4 WS types:
  - `wsConnect: { icon: '⇌', category: 'Integrations' }`
  - `wsSend: { icon: '⇢', category: 'Integrations' }`
  - `wsReceive: { icon: '⇠', category: 'Integrations' }`
  - `wsTrigger: { icon: '⚡', category: 'Triggers' }`
- [x] ✅ Done — Add all 4 types to `NON_HTTP_TYPES` set (done in Phase 4A.6)
- [x] ✅ Done — Add variable hint collectors in `collectConditionVariableHints()` for output bindings + extraction rules (`ws.connect.*`, `ws.send.*`, `ws.receive.*`, `ws.trigger.*`)
- [x] ✅ Done — File: `src/features/workflow/utils/workflowVariableHints.ts`

#### 4B.7 — Shared Row Factories

- [x] ✅ Done — Create `wsConfigFactories.ts` with `createWsHeaderRow()` and `createWsExtractionRule()` helpers (mirrors `kafkaConfigFactories.ts`)
- [x] ✅ Done — File: `src/features/workflow/components/configs/wsConfigFactories.ts`
- [x] ✅ Done — `WsConfigShared.tsx` — shared sub-components (ConnectionIdInput, MatchCriteriaSection, ExtractionRulesTable, OutputBindingsTable)

#### 4B.8 — CSS

- [x] ✅ Done — Add `.wf-ws-section` and `.wf-ws-section-title` CSS classes for config panel sections (mirrors `.wf-kafka-section`)
- [x] ✅ Done — File: `src/styles/workflow.css`

#### 4B Files

| File | Action | Purpose |
|---|---|---|
| `src/features/workflow/components/configs/WsConnectConfig.tsx` | NEW | wsConnect config panel |
| `src/features/workflow/components/configs/WsSendConfig.tsx` | NEW | wsSend config panel |
| `src/features/workflow/components/configs/WsReceiveConfig.tsx` | NEW | wsReceive config panel |
| `src/features/workflow/components/configs/WsTriggerConfig.tsx` | NEW | wsTrigger config panel |
| `src/features/workflow/components/configs/wsConfigFactories.ts` | NEW | Shared row factory functions |
| `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx` | MODIFY | Add 4 config panel conditionals + WS type imports |
| `src/features/workflow/utils/workflowVariableHints.ts` | MODIFY | NODE_TYPE_DISPLAY + hint collectors (NON_HTTP_TYPES already in 4A) |
| `src/styles/workflow.css` | MODIFY | Add wf-ws-section config panel CSS |

---

### Phase 4C — Engine Handlers & Operations Bridge

> **Goal:** Implement the execution handlers for all 4 WS node types, the `WsNodeOperations` interface, and the bridge that wires proxy dispatch to the operations.

#### 4C.0 — Shared Types (prerequisite)

- [x] ✅ Done — Widen `transportType` on `RequestResult` from `KafkaActionType` to a new `TransportType` union that includes WS types
- [x] ✅ Done — Define `TransportType = 'http' | 'kafkaProduce' | 'kafkaConsume' | 'wsConnect' | 'wsSend' | 'wsReceive'` in `src/shared/types/kafka.ts`
- [x] ✅ Done — Update `RequestResult.transportType` to use the new union
- [x] ✅ Done — Define `CapturedWsNodeDetails` in `src/shared/types/trace.ts`
- [x] ✅ Done — Define `WsFailureClass` in `src/shared/types/trace.ts`
- [x] ✅ Done — Add `wsDetails?: CapturedWsNodeDetails` and `wsTriggerDetails?` to `ExecutionEventDetails`
- [x] ✅ Done — Re-export new types from `src/shared/types/index.ts`
- [x] ✅ Done — File: `src/shared/types/kafka.ts` (MODIFY — add WS transport types to union)
- [x] ✅ Done — File: `src/shared/types/trace.ts` (MODIFY — add CapturedWsNodeDetails, WsFailureClass)
- [x] ✅ Done — File: `src/shared/types/index.ts` (MODIFY — re-export new types)

#### 4C.1 — WsNodeOperations Interface

- [x] ✅ Done — Define `WsNodeOperations` interface with:
  - `connect(params: { url, headers?, queryParams?, subprotocols?, timeoutMs? }): Promise<WsConnectResult>`
  - `send(params: { connectionId, data, type? }): Promise<WsSendResult>`
  - `waitForMessage(params: { connectionId, timeoutMs, matchCriteria? }): Promise<WsReceivedMessage>`
  - `disconnect(params: { connectionId, code?, reason? }): Promise<void>`
  - `disconnectAll(): Promise<void>` — cleanup all held connections
- [x] ✅ Done — Define `WsConnectResult`, `WsSendResult`, `WsReceivedMessage` types
- [x] ✅ Done — Add `wsOperations?: WsNodeOperations` to `NodeHandlerContext`
- [x] ✅ Done — Add `capturedWsDetails?: Map<string, CapturedWsNodeDetails>` to `NodeHandlerContext`
- [x] ✅ Done — File: `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts`

> **NOTE (gap found):** The original plan omitted `queryParams` from the `connect()` params.
> `WsConnectNodeData` includes both `headers: WsNodeHeaderRow[]` and `queryParams: WsNodeHeaderRow[]`.
> Both must be resolved and passed through the operations interface.

#### 4C.2 — Operations Bridge

- [x] ✅ Done — `buildWsNodeOperations()` — wraps `dispatchWsOperation()` to implement `WsNodeOperations`
- [x] ✅ Done — Maintains an internal connection registry (Map of connectionId → proxyConnectionId)
- [x] ✅ Done — `connect()` — calls proxy connect, stores mapping, returns result
- [x] ✅ Done — `send()` — looks up proxy connection, calls proxy send
- [x] ✅ Done — `waitForMessage()` — polls proxy messages endpoint with 200ms poll interval, applies match criteria client-side, returns first match or timeout
- [x] ✅ Done — `disconnect()` — calls proxy disconnect, removes from registry
- [x] ✅ Done — `disconnectAll()` — iterates registry, disconnects each (ignores individual errors)
- [x] ✅ Done — File: `src/shared/websocket/buildWsNodeOperations.ts`
- [x] ✅ Done — Tests: `src/shared/websocket/buildWsNodeOperations.test.ts`

> **NOTE (gap found):** Plan was missing poll interval constant for `waitForMessage()`.
> Using 200ms poll interval (WS_POLL_INTERVAL_MS) as a concrete default.

#### 4C.3 — Node Handlers

- [x] ✅ Done — `handleWsConnectNode(nodeId, node, hCtx, passedFlag)`:
  - Resolves URL, headers, queryParams, subprotocols via `hCtx.ctx.resolve()`
  - Validates `wsOperations` is present
  - Calls `wsOperations.connect()`
  - Sets output bindings in `hCtx.ctx`
  - Stores connection info in `capturedWsDetails`
  - Pushes `RequestResult` with `transportType: 'wsConnect'`
  - Calls `hCtx.visitOutgoing()`
- [x] ✅ Done — `handleWsSendNode(nodeId, node, hCtx, passedFlag)`:
  - Resolves `data.message` (not `messageBody`) via `hCtx.ctx.resolve()`
  - Calls `wsOperations.send()`
  - If `waitForResponse`, calls `wsOperations.waitForMessage()` with responseTimeoutMs
  - Sets output bindings
  - Pushes `RequestResult` with `transportType: 'wsSend'`
  - Calls `hCtx.visitOutgoing()`
- [x] ✅ Done — `handleWsReceiveNode(nodeId, node, hCtx, passedFlag)`:
  - Calls `wsOperations.waitForMessage()` with match criteria + timeout
  - Applies extraction rules (JSONPath) to received message — maps `WsExtractionRule { variableName, jsonPath }` → `ExtractVariableMapping { name, jsonPath }` for `extractPayloadVariables()`
  - Sets extracted variables + output bindings in `hCtx.ctx`
  - Pushes `RequestResult` with `transportType: 'wsReceive'`
  - Calls `hCtx.visitOutgoing()`
- [x] ✅ Done — `handleWsTriggerNode(nodeId, node, hCtx)`:
  - Reads `__wsTriggerMessage` from context (pre-set by external trigger runner)
  - Falls back to `samplePayload` for Quick Test (mirrors Kafka trigger pattern)
  - Seeds `ws.trigger.*` variables (url, connectionId, message, messageType)
  - Applies extraction rules from trigger data — maps `WsExtractionRule` → `ExtractVariableMapping`
  - Clears internal key after use
  - Calls `hCtx.visitOutgoing()`
- [x] ✅ Done — File: `src/features/workflow/engine/graphRunnerWsNodeHandlers.ts`
- [x] ✅ Done — Tests: `src/features/workflow/engine/graphRunnerWsNodeHandlers.test.ts`

> **NOTE (gap found):** `WsExtractionRule { variableName, jsonPath }` field names differ from
> `ExtractVariableMapping { name, jsonPath }`. Handlers must map `variableName → name` before
> calling `extractPayloadVariables()`.

> **NOTE (gap found):** `WsSendNodeData` field is `message`, not `messageBody` — corrected above.

> **NOTE (gap found):** `handleWsTriggerNode` was missing `samplePayload` fallback for Quick Test mode.
> Added to mirror the Kafka trigger pattern where `data.samplePayload` is used when no runtime message exists.

#### 4C.4 — Handler Barrel Re-export

- [x] ✅ Done — Re-export all 4 handlers + `WsNodeOperations` + result types from `graphRunnerNodeHandlers.ts`
- [x] ✅ Done — File: `src/features/workflow/engine/graphRunnerNodeHandlers.ts`

#### 4C.5 — Test Utils Update

- [x] ✅ Done — Update `makeHandlerContext` in `graphRunnerNodeHandlers.test-utils.ts` to accept `wsOperations` and `capturedWsDetails` overrides
- [x] ✅ Done — File: `src/features/workflow/engine/graphRunnerNodeHandlers.test-utils.ts`

#### 4C Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/types/kafka.ts` | MODIFY | Widen transport type union to include WS |
| `src/shared/types/trace.ts` | MODIFY | Add CapturedWsNodeDetails, WsFailureClass, wsDetails on ExecutionEventDetails |
| `src/shared/types/index.ts` | MODIFY | Re-export new WS types |
| `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts` | MODIFY | Add WsNodeOperations + capturedWsDetails |
| `src/features/workflow/engine/graphRunnerNodeHandlers.test-utils.ts` | MODIFY | Support wsOperations/capturedWsDetails |
| `src/shared/websocket/buildWsNodeOperations.ts` | NEW | Operations bridge with connection registry |
| `src/shared/websocket/buildWsNodeOperations.test.ts` | NEW | Bridge tests |
| `src/features/workflow/engine/graphRunnerWsNodeHandlers.ts` | NEW | 4 node handlers |
| `src/features/workflow/engine/graphRunnerWsNodeHandlers.test.ts` | NEW | Handler tests |
| `src/features/workflow/engine/graphRunnerNodeHandlers.ts` | MODIFY | Re-export WS handlers |

---

### Phase 4D — Runner Wiring & Trace Capture

> **Goal:** Wire WS handlers into the graph runner dispatch, add trace enrichment, pass operations through sub-workflows and load runner.

#### 4D.1 — Graph Runner Dispatch

- [x] ✅ Done — Add `wsOperations` parameter to `runGraph()` function signature
- [x] ✅ Done — Initialize `capturedWsDetails` map in handler context construction
- [x] ✅ Done — Add 4 dispatch branches in the `if/else if` chain inside `visit()`: `wsConnect`, `wsSend`, `wsReceive`, `wsTrigger`
- [x] ✅ Done — Connection cleanup: `wsOperations?.disconnectAll()` — placed AFTER the error handler block so error handler nodes can use WS connections. Sub-workflow runs get a neutered `disconnectAll` (no-op) so children don't tear down the parent's connections.
- [x] ✅ Done — File: `src/features/workflow/engine/graphRunner.ts`

> **Note:** `runGraph()` already has 18 positional parameters. Adding `wsOperations` as 19th is functionally correct
> but increasingly fragile. Consider consolidating `kafkaOperations` + `wsOperations` into a single
> `transportOperations?: { kafka?: KafkaNodeOperations; ws?: WsNodeOperations }` parameter in a future refactor.

#### 4D.2 — Trace Enrichment

- [x] ✅ Done — Add post-handler trace enrichment blocks for all 4 WS node types (like Kafka)
- [x] ✅ Done — Populate `ExecutionEventDetails` with WS-specific fields
- [x] ✅ Done — File: `src/features/workflow/engine/graphRunner.ts`

#### 4D.3 — Start Node Discovery

- [x] ✅ Done — Add `'wsTrigger'` to `findStartNodes()` trigger type filter
- [x] ✅ Done — File: `src/features/workflow/engine/graphRunnerHelpers.ts`

#### 4D.4 — Execution Hook Wiring

- [x] ✅ Done — Import and call `buildWsNodeOperations()` in `useWorkflowExecution.ts`
- [x] ✅ Done — Pass `wsOperations` to `runGraph()` call
- [x] ✅ Done — File: `src/features/workflow/hooks/useWorkflowExecution.ts`

#### 4D.5 — Load Runner Passthrough

- [x] ✅ Done — Add `wsOperations?: WsNodeOperations` to `GraphLoadRunOpts`
- [x] ✅ Done — Pass `wsOperations` through to `runGraph()` calls in load runner iterations
- [x] ✅ Done — File: `src/features/workflow/engine/graphLoadRunner.ts`

#### 4D.6 — Sub-Workflow Passthrough

- [x] ✅ Done — Pass `hCtx.wsOperations` to child `runGraph()` calls in `graphRunnerSubWorkflowHandler.ts`
- [x] ✅ Done — Wrap wsOperations with `{ ...hCtx.wsOperations, disconnectAll: async () => {} }` so child `runGraph` completion does not tear down the parent's open connections
- [x] ✅ Done — File: `src/features/workflow/engine/graphRunnerSubWorkflowHandler.ts`

#### 4D.7 — Trace Types (**DONE in Phase 4C.0**)

> Already implemented in Phase 4C.0. `CapturedWsNodeDetails`, `WsFailureClass`, `wsDetails`/`wsTriggerDetails` on
> `ExecutionEventDetails`, `ExecutionEvent.nodeType` extension — all completed.

#### 4D.8 — Transport Type Extension (**DONE in Phase 4C.0**)

> Already implemented in Phase 4C.0. `TransportType` union added to `kafka.ts`, `RequestResult.transportType`
> widened in `index.ts`. `KafkaActionType` preserved for backward compatibility.

#### 4D.9 — TraceCollector hasOwnTiming (gap found — moved from 4E.5)

- [x] ✅ Done — Add `wsConnect`, `wsSend`, `wsReceive` to `hasOwnTiming` in `traceCollector.ts`
- [x] ✅ Done — WS nodes report `responseTimeMs` via their `RequestResult` — same pattern as HTTP
- [x] ✅ Done — File: `src/features/workflow/engine/traceCollector.ts`

> **NOTE (gap found):** Plan originally placed this under 4E.5 (Results Explorer & Labels) but it's
> trace capture infrastructure that belongs in 4D. WsTrigger does NOT need hasOwnTiming (it's instant).

#### 4D Files

| File | Action | Purpose |
|---|---|---|
| `src/features/workflow/engine/graphRunner.ts` | MODIFY | Dispatch branches + trace enrichment + cleanup |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | MODIFY | Add wsTrigger to findStartNodes |
| `src/features/workflow/hooks/useWorkflowExecution.ts` | MODIFY | Wire buildWsNodeOperations |
| `src/features/workflow/engine/graphLoadRunner.ts` | MODIFY | Add wsOperations to opts + passthrough |
| `src/features/workflow/engine/graphRunnerSubWorkflowHandler.ts` | MODIFY | Pass wsOperations to child runs |
| `src/features/workflow/engine/traceCollector.ts` | MODIFY | Add WS nodes to hasOwnTiming |
| `src/engine/executor.ts` | MODIFY | Add `wsOperations` param, pass to `runGraphLoad` |
| `src/engine/executionWorker.ts` | MODIFY | Import `buildWsNodeOperations`, pass to `runTest` |
| `src/features/test-runner/hooks/useTestExecution.ts` | MODIFY | Build + pass `wsOperations` to `runTest` |

---

### Phase 4E — Results Explorer & Labels

> **Goal:** Proper display of WebSocket node results in the Results Explorer, console logs, and summary tables.

#### 4E.1 — Node Type Labels

- [x] ✅ Done — Add console labels: `wsConnect: 'WS Connect'`, `wsSend: 'WS Send'`, `wsReceive: 'WS Receive'`, `wsTrigger: 'WS Trigger'`
- [x] ✅ Done — Add explorer labels: `wsConnect: 'WS CONNECT'`, `wsSend: 'WS SEND'`, `wsReceive: 'WS RECEIVE'`, `wsTrigger: 'WS TRIGGER'`
- [x] ✅ Done — File: `src/features/results/utils/nodeTypeLabels.ts`

#### 4E.2 — Results Explorer Detail Panel

- [x] ✅ Done — Add WS-specific overview section in `DetailOverviewTab.tsx`:
  - wsConnect: show URL, protocol, extensions, latencyMs
  - wsSend: show connectionId, message preview, response preview (if waitForResponse)
  - wsReceive: show connectionId, matched message preview, match timing
  - wsTrigger: show trigger URL, message body preview
- [x] ✅ Done — File: `src/features/results/components/ResultsExplorerDetailPanel.tsx` / `DetailOverviewTab.tsx`

#### 4E.3 — Console Log Reconstruction

- [x] ✅ Done — Add WS-specific log line formatting in `reconstructLogLines.ts`
- [x] ✅ Done — Show connection URL, message previews, match results, timing
- [x] ✅ Done — File: `src/features/results/utils/reconstructLogLines.ts`

#### 4E.4 — Results Summary Tables

- [x] ✅ Done — Extend status column ternary chains to handle WS `transportType` values
- [x] ✅ Done — Hide HTTP-specific columns (status code, method) for WS results
- [x] ✅ Done — Files: `DataRowSummaryTable`, `ResultsRequestDetailsTab`, `reportGenerator.ts`, and other files that have transport-type ternary chains

#### 4E.5 — Trace Collector Timing (**DONE in Phase 4D.9**)

> Already implemented in Phase 4D. `wsConnect`, `wsSend`, `wsReceive` added to `hasOwnTiming`.

#### 4E.6 — Extract `formatTransportStatus` helper

- [x] ✅ Done — Create `src/features/results/utils/transportStatus.ts` with shared `formatTransportStatus(r)` helper
- [x] ✅ Done — Replaces 7 duplicated ternary chains: `(r.transportType ?? 'http') === 'http' ? ... : ...`
- [x] ✅ Done — Covers HTTP, Kafka (PRODUCE/CONSUME), WS (CONNECT/SEND/RECEIVE) with fallback to uppercase type
- [x] ✅ Done — Update all call sites + tests: `src/features/results/utils/transportStatus.test.ts`

#### 4E Files

| File | Action | Purpose |
|---|---|---|
| `src/features/results/utils/nodeTypeLabels.ts` | MODIFY | Add 4 WS + 4 Kafka labels (console + explorer) |
| `src/features/results/components/DetailOverviewTab.tsx` | MODIFY | Add WS overview sections |
| `src/features/results/components/ResultsExplorerDetailPanel.tsx` | MODIFY | Add WS node type gating |
| `src/features/results/utils/reconstructLogLines.ts` | MODIFY | Add WS + Kafka log line formatting |
| `src/features/results/utils/transportStatus.ts` | NEW | Shared `formatTransportStatus` helper |
| `src/features/results/components/DataRowSummaryTable.tsx` | MODIFY | Use `formatTransportStatus` |
| `src/features/results/components/ResultsRequestDetailsTab.tsx` | MODIFY | Use `formatTransportStatus` |
| `src/features/results/components/WorkflowResultsSummary.tsx` | MODIFY | Use `formatTransportStatus` |
| `src/features/results/utils/reportGenerator.ts` | MODIFY | Use `formatTransportStatus` |

---

### Phase 4 — Connection Lifecycle Design (New Infrastructure)

Unlike Kafka (stateless per-call — each `produce`/`consume` is independent), WebSocket connections are **stateful** — a `wsConnect` node opens a connection that must remain alive for downstream `wsSend`/`wsReceive` nodes. This requires explicit lifecycle management that does **not** exist in the Kafka integration:

```
WsNodeOperations (internal connection registry)
├── connect()  → opens connection, stores in registry as { userConnectionId → proxyConnectionId }
├── send()     → looks up registry, sends via proxy
├── waitForMessage() → polls proxy, applies match criteria
├── disconnect()     → closes single connection, removes from registry
└── disconnectAll()  → cleanup: iterates registry, closes all (called by graphRunner on complete)

graphRunner finally block:
  if (wsOperations) await wsOperations.disconnectAll();
```

The connection registry lives **inside** `WsNodeOperations` (not on `hCtx`) so that:
1. It's encapsulated — handlers don't manage raw proxy IDs
2. It's testable — mock `WsNodeOperations` for unit tests
3. Sub-workflows share the parent's operations instance (connections span sub-workflow boundaries)

### Phase 4 Execution Flow

```
Workflow Canvas → User clicks "Run"
  → useWorkflowExecution builds wsOperations = buildWsNodeOperations()
  → runGraph(..., wsOperations)
    → visit(wsConnect) → handleWsConnectNode()
      → wsOperations.connect(url, headers) → registry stores connectionId mapping
      → output bindings: ws.connect.protocol, ws.connect.latencyMs
    → visit(wsSend) → handleWsSendNode()
      → wsOperations.send(connectionId, message)
      → if waitForResponse: wsOperations.waitForMessage(connectionId, timeout)
      → output bindings: ws.send.responseBody, ws.send.latencyMs
    → visit(wsReceive) → handleWsReceiveNode()
      → wsOperations.waitForMessage(connectionId, matchCriteria, timeoutMs)
      → applies extraction rules (JSONPath) → ctx.set()
      → output bindings: ws.receive.messageBody, ws.receive.latencyMs
    → workflow continues with extracted variables available downstream
  → finally: wsOperations.disconnectAll() — cleanup all held connections
```

### Phase 4 Success Criteria ✅ All Done

- [x] `wsConnect` node in palette, drag to canvas, configure URL/headers/subprotocols
- [x] `wsSend` node references a `connectionId` from an upstream `wsConnect`
- [x] `wsReceive` node waits for matching message with timeout
- [x] `wsTrigger` node starts workflow from WebSocket message
- [x] Quick Test: wsConnect → wsSend → wsReceive chain executes against live endpoint
- [x] Output bindings: extracted variables flow to downstream nodes
- [x] Connection cleanup: all WebSocket connections closed when workflow completes (via `disconnectAll`)
- [x] Error handling: connection failure, timeout, match failure → proper error state with `passedFlag`
- [x] Console logs show WebSocket operation details (connect, send, receive, timing)
- [x] Results Explorer shows WebSocket node results with message details (overview tab)
- [x] Config panels: all fields with variable insertion support (`useVariableInsertModal`)
- [x] `WsNodeOperations` injected via `hCtx` (testable with mocks)
- [x] Node type labels in console + explorer for all 4 types
- [x] `findStartNodes` recognizes `wsTrigger` as a trigger type
- [x] Variable hints: `NODE_TYPE_DISPLAY` + `NON_HTTP_TYPES` + output binding hint collectors
- [x] `transportType` extended for WS result rows
- [x] Sub-workflow passthrough: `wsOperations` forwarded to child runs
- [x] Load runner passthrough: `wsOperations` in `GraphLoadRunOpts`
- [x] Unit test coverage >90%

### Phase 4 All Files Summary

#### New Files (16)

| File | Purpose |
|---|---|
| `src/features/workflow/components/nodes/WsConnectNode.tsx` | wsConnect canvas node component |
| `src/features/workflow/components/nodes/WsSendNode.tsx` | wsSend canvas node component |
| `src/features/workflow/components/nodes/WsReceiveNode.tsx` | wsReceive canvas node component |
| `src/features/workflow/components/nodes/WsTriggerNode.tsx` | wsTrigger canvas node component |
| `src/features/workflow/components/nodes/WsNodes.test.tsx` | Canvas node tests |
| `src/features/workflow/components/configs/WsConnectConfig.tsx` | wsConnect config panel |
| `src/features/workflow/components/configs/WsSendConfig.tsx` | wsSend config panel |
| `src/features/workflow/components/configs/WsReceiveConfig.tsx` | wsReceive config panel |
| `src/features/workflow/components/configs/WsTriggerConfig.tsx` | wsTrigger config panel |
| `src/features/workflow/components/configs/WsConfigShared.tsx` | Shared config sub-components (ConnectionIdInput, MatchCriteria, ExtractionRules, OutputBindings) |
| `src/features/workflow/components/configs/wsConfigFactories.ts` | Row factory helpers (createWsHeaderRow, createWsExtractionRule) |
| `src/features/workflow/components/configs/WsConfigs.test.tsx` | Config panel tests |
| `src/features/workflow/engine/graphRunnerWsNodeHandlers.ts` | 4 WS node execution handlers |
| `src/features/workflow/engine/graphRunnerWsNodeHandlers.test.ts` | Handler unit tests |
| `src/shared/websocket/buildWsNodeOperations.ts` | Bridge: dispatch → WsNodeOperations with connection registry |
| `src/shared/websocket/buildWsNodeOperations.test.ts` | Bridge unit tests |

#### Modified Files

| File | Change |
|---|---|
| `src/features/workflow/types/workflow.ts` | Add 4 WS types to unions + 4 data interfaces |
| `src/features/workflow/utils/workflowNodeFactory.ts` | nodeTypes map + defaultNodeData + 4 default helpers |
| `src/features/workflow/components/canvas/WorkflowPalette.tsx` | Add 4 palette entries (actions + triggers) |
| `src/features/workflow/components/nodes/NodeIcon.tsx` | Add 4 icon mappings (integration + trigger) |
| `src/features/workflow/hooks/useWorkflowCanvasSync.ts` | Add WS types to variable-hints inclusion list |
| `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx` | Add 4 config panel conditionals |
| `src/features/workflow/utils/workflowVariableHints.ts` | NODE_TYPE_DISPLAY + NON_HTTP_TYPES + hint collectors |
| `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts` | Add WsNodeOperations + capturedWsDetails |
| `src/features/workflow/engine/graphRunnerNodeHandlers.ts` | Re-export WS handlers |
| `src/features/workflow/engine/graphRunner.ts` | Dispatch branches + trace enrichment + disconnectAll cleanup |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | Add wsTrigger to findStartNodes |
| `src/features/workflow/hooks/useWorkflowExecution.ts` | Wire buildWsNodeOperations |
| `src/features/workflow/engine/graphLoadRunner.ts` | Add wsOperations to opts + passthrough |
| `src/features/workflow/engine/graphRunnerSubWorkflowHandler.ts` | Pass wsOperations to child runs |
| `src/shared/types/trace.ts` | Add CapturedWsNodeDetails + trace fields + ExecutionEvent.nodeType |
| `src/shared/types/kafka.ts` | Extend KafkaActionType with WS transport types |
| `src/shared/types/index.ts` | Re-export updated transport type union |
| `src/features/workflow/engine/traceCollector.ts` | Add WS types to hasOwnTiming if applicable |
| `src/features/results/utils/nodeTypeLabels.ts` | Add 4 WS labels (console + explorer) |
| `src/features/results/components/DetailOverviewTab.tsx` | Add WS overview sections |
| `src/features/results/utils/reconstructLogLines.ts` | Add WS log line formatting |
| `src/styles/workflow.css` | Add WS node CSS classes |

---

## Phase 5 — Runner & Assertions

> **Goal:** WebSocket scenarios in the Test Runner with full assertion engine support — from scenario authoring in the editor, through execution with parameterized data sources, to assertion evaluation and results rendering.

### Phase 5 Rationale

Phase 4 adds WebSocket nodes to the Workflow Designer. Phase 5 brings WebSocket into the **Harness** domain — Feature Groups, Test Scenarios, and the Test Runner. This follows the same pattern established by Kafka:

| Layer | HTTP | Kafka | WebSocket (Phase 5) |
|---|---|---|---|
| **Transport type** | `'http'` (default) | `'kafkaProduce'` / `'kafkaConsume'` | `'wsConnect'` / `'wsSend'` / `'wsReceive'` |
| **Action config** | URL + method + headers + body | `kafkaProduceAction` / `kafkaConsumeAction` | `wsConnectAction` / `wsSendAction` / `wsReceiveAction` |
| **Execution** | `executeRequest()` | `executeKafkaAction()` via `executeNonHttp` | `executeWsAction()` via `executeNonHttp` |
| **Operations bridge** | Direct fetch/undici | `buildKafkaNodeOperations()` | `buildWsNodeOperations()` (from Phase 4) |
| **Assertion context** | `httpStatus`, `responseHeaders`, etc. | `kafkaContext` (key, offset, partition, topic) | `wsContext` (connectionId, frameType, protocol, latencyMs) |
| **Assertion type (string)** | `status`, `header`, `body`, `jsonPath`, etc. | `kafkaField` | `wsField` |
| **Assertion type (numeric)** | `numeric`, `responseTime` | — | `wsNumericField` (latencyMs, size) |
| **Result meta** | `httpStatus`, `responseHeaders` | `kafkaResultMeta` | `wsResultMeta` |

### Phase 5 Scope

- ✅ Extend transport union: add `wsConnect`, `wsSend`, `wsReceive` action types + `method: 'WEBSOCKET'` (5A)
- ✅ Define `WsConnectActionConfig`, `WsSendActionConfig`, `WsReceiveActionConfig` interfaces with shared Studio type re-exports (5A)
- ✅ WebSocket execution engine (`wsExecution.ts`, 337 lines) wired via existing `executeNonHttp` hook (5B)
- ✅ Assertion engine extended with `wsContext`, `wsField` (string) and `wsNumericField` (numeric) assertion types (5C)
- ✅ Parameterized WebSocket scenarios via data source expansion with column type policy (5B)
- ✅ Greenfield transport selector in `TestEditorModal` — enables Kafka authoring as side effect (5D)
- ✅ Scenario Editor UI for authoring WS scenarios (`WsScenarioEditor.tsx`) (5D)
- ✅ Transport-aware results rendering: labels, detail modal (WS/Kafka panels), reports, metrics (5E)
- ⬜ Data Mapper `wsExtractionAdapter` for visual message extraction (5F — pending)
- ✅ Worker path fix for non-HTTP scenarios — fixes Kafka too (5B)
- ✅ Rust executor guard for non-HTTP scenarios — fixes Kafka too (5B)
- ✅ `buildValidationResult` HTTP status skip for non-HTTP transport — fixes Kafka `(http)` bug (5C)
- ✅ `kafkaField` assertion UI rendering added alongside `wsField` (5D)
- ⬜ Export/import normalization for WS fields + `TestDefinitionSnapshot` transport extension (5F — pending)
- ✅ CLI reporter WS support: JUnit XML, Console, Markdown transport labels (5B bonus)
- ✅ `computeMetrics` transport guard: non-HTTP failures via `!r.passed` (5E — bug fix)
- ✅ `runBaselines` per-scenario non-HTTP error counting + cancelled filter (5E — bug fix)

### Phase 5 Sub-Phases

| Sub-Phase | Status | Scope | Dependencies |
|---|---|---|---|
| **5A** — Types & Transport Extension | ✅ | Transport union, action configs, result meta, assertion types (`wsField` + `wsNumericField`), scenario defaults, method union (206 tests) | Phase 4 types only |
| **5B** — Execution Engine | ✅ | `wsExecution.ts`, executor wiring, data source expander, worker/Rust fixes, CLI reporters, column type policy (383 tests) | 5A + `buildWsNodeOperations` from Phase 4C |
| **5C** — Assertion Engine | ✅ | `wsField` + `wsNumericField` assertion types, `wsContext`, custom expression paths, validation result, HTTP skip fix, Kafka `(http)` bug fix (59 tests) | 5A |
| **5D** — Scenario Editor UI (Greenfield) | ✅ | Greenfield transport selector, `WsScenarioEditor.tsx`, assertion presets (WS + Kafka), test factory, kafkaField rendering (184 tests + 4 review passes with 18 bugs fixed) | 5A, 5C |
| **5E** — Results & Reporting | ✅ | Transport labels, ResponseDetailModal WS/Kafka panels, report generator, metrics transport guard, baseline fix (205 tests) | 5B |
| **5F** — Data Mapper & Export/Import | ⬜ Pending | `wsExtractionAdapter`, import normalization, export round-trip, snapshot extension, versioning diff | 5A |

**Actual execution order**: 5A → 5B → 5C → 5D → 5E (sequential due to bug fixes cascading). 5F remains pending — independent of 5B-5E, blocked only on 5A (complete).

---

### Phase 5A — Types & Transport Extension ✅ COMPLETED

> **Goal:** Define all WebSocket-specific types for the test harness: transport discriminant, action configs, assertion target type, result metadata, and scenario validation/defaults.

**Implementation Notes (Phase 5A — 2026-06-08):**
- Created `src/shared/types/websocket.ts` with `WsActionType`, `ScenarioActionType`, `WsHarnessMatchCriteria`, `WsConnectActionConfig`, `WsSendActionConfig`, `WsReceiveActionConfig`, `WsResultMeta`, `WsAssertionTarget`, `WsNumericAssertionTarget`, `isWsActionType()`, `isWsNumericTarget()`. Re-exports `WsTlsConfig` and `WsProtocolMode` from Studio types.
- Modified `src/shared/types/index.ts`: `Scenario.method` extended with `'WEBSOCKET'`; `Scenario.actionType` widened from `KafkaActionType` to `ScenarioActionType`; added `wsConnectAction?`, `wsSendAction?`, `wsReceiveAction?` fields; added `wsResultMeta?` to `RequestResult`; added `wsField` and `wsNumericField` to `Assertion` union; `TestDefinitionSnapshot.method` extended with `'WEBSOCKET'`; added `export * from './websocket'`.
- Modified `src/shared/utils/kafkaScenarioDefaults.ts`: `resolveKafkaActionType()` return type widened from `KafkaActionType` to `ScenarioActionType` to accommodate the broader `Scenario.actionType` union. `KafkaActionType` import removed (now unused locally; re-exported via `export * from './kafka'`).
- Created `src/shared/utils/wsScenarioDefaults.ts`: `createDefaultWsConnectAction()` (timeoutMs=10000), `createDefaultWsSendAction()` (messageType=text, waitForResponse=false, responseTimeoutMs=5000), `createDefaultWsReceiveAction()` (timeoutMs=10000), `isWsScenario()`, `resolveWsActionType()`, `getWsActionType()`, `validateWsActionConfig()`.
- Created `src/shared/types/websocket.test.ts`: 73 tests covering type contracts, helper guards, assertion construction, and Scenario/RequestResult integration.
- Created `src/shared/utils/wsScenarioDefaults.test.ts`: 80 tests covering defaults, type guards, validation (all 3 action types), and integration with Scenario type.
- `scenarioMigration.ts` **NOT modified** — WS is new (no legacy data to migrate); existing `normalizeScenarioActionType()` correctly handles absent `actionType → 'http'` and passes through WS values unchanged.
- Gate: `npx tsc -b --noEmit` → 0 errors; 206 tests passing (153 WS/Kafka contracts + 53 Kafka execution).

**Design decisions:**
- **`ScenarioActionType` instead of renaming `KafkaActionType`**: Created a new combined type `ScenarioActionType = 'http' | 'kafkaProduce' | 'kafkaConsume' | WsActionType` rather than renaming/extending `KafkaActionType`. This avoids cascading renames across Kafka-specific code while correctly typing `Scenario.actionType`.
- **`WsHarnessMatchCriteria` independently defined**: Same shape as workflow `WsMatchCriteria` but defined in harness types to avoid coupling. Harness and workflow can evolve independently.
- **`connectionId` on `WsConnectActionConfig`**: Added as optional field (not in original plan) to support multi-connection harness scenarios where Send/Receive reference a specific connection.
- **No message validation on `wsSend`**: Empty messages are valid WebSocket content (e.g., ping frames), so `validateWsActionConfig()` only validates that a connection target exists (either `connectionRef` or `url`).
- **`WsKeyValueEntry` NOT re-exported**: Harness configs use `KeyValue` (from core types) instead, since it's the same shape (`{ key, value }`) and already used throughout the Scenario model.

#### 5A.1 — Transport Union Extension

- [x] Created `WsActionType = 'wsConnect' | 'wsSend' | 'wsReceive'` in `src/shared/types/websocket.ts`
- [x] Created `ScenarioActionType` combining HTTP + Kafka + WS action types
- [x] Updated `Scenario.actionType` from `KafkaActionType` to `ScenarioActionType`
- [x] Added `wsConnectAction?`, `wsSendAction?`, `wsReceiveAction?` fields to `Scenario`
- [x] Added `method: 'WEBSOCKET'` to `Scenario.method` and `TestDefinitionSnapshot.method` unions
- [x] Harness types in `src/shared/types/websocket.ts` import/re-export Studio types (`WsTlsConfig`, `WsProtocolMode`)
- [x] File: `src/shared/types/index.ts` (MODIFY), `src/shared/types/websocket.ts` (NEW)

#### 5A.2 — Action Config Interfaces

- [x] `WsConnectActionConfig`: `url`, `headers?`, `queryParams?`, `subprotocols?`, `timeoutMs?`, `protocolMode?`, `tlsConfig?`, `connectionId?` (bonus field)
- [x] `WsSendActionConfig`: `connectionRef?`, `url?`, `message`, `messageType?`, `waitForResponse?`, `responseTimeoutMs?`
- [x] `WsReceiveActionConfig`: `connectionRef?`, `url?`, `timeoutMs?`, `matchCriteria?: WsHarnessMatchCriteria`
- [x] `WsHarnessMatchCriteria`: `contentContains?`, `contentRegex?`, `jsonPathMatch?`, `jsonPathValue?`, `messageType?`
- [x] File: `src/shared/types/websocket.ts` (NEW)

#### 5A.3 — Result Metadata

- [x] `WsResultMeta`: `connectionId?`, `frameType?`, `protocol?`, `url?`, `closeCode?`, `messageSize?`
- [x] Added `wsResultMeta?: WsResultMeta` to `RequestResult`
- [x] `RequestResult.transportType` already includes WS values via `TransportType` (Phase 4)
- [x] File: `src/shared/types/websocket.ts` (NEW), `src/shared/types/index.ts` (MODIFY)

#### 5A.4 — Assertion Type

- [x] Added `wsField` to `Assertion` union: `{ type: 'wsField'; target: WsAssertionTarget; operator: AssertionOperator; value?: string }`
- [x] Added `wsNumericField` to `Assertion` union: `{ type: 'wsNumericField'; target: WsNumericAssertionTarget; operator: ComparisonOperator; value: number }` — **chose option (b)**
- [x] Defined `WsAssertionTarget`: `'ws.body' | 'ws.type' | 'ws.size' | 'ws.latencyMs' | 'ws.protocol' | 'ws.connectionId' | 'ws.header.${string}' | 'ws.$.${string}'`
- [x] Defined `WsNumericAssertionTarget`: `'ws.latencyMs' | 'ws.size'`
- [x] Added `isWsNumericTarget()` helper guard
- [x] File: `src/shared/types/index.ts` (MODIFY), `src/shared/types/websocket.ts` (NEW)

#### 5A.5 — Scenario Defaults & Validation

- [x] `createDefaultWsConnectAction(url?)` — defaults: timeoutMs=10000
- [x] `createDefaultWsSendAction(message?)` — defaults: messageType='text', waitForResponse=false, responseTimeoutMs=5000
- [x] `createDefaultWsReceiveAction()` — defaults: timeoutMs=10000
- [x] `isWsScenario(scenario)` — type guard using `isWsActionType()`
- [x] `resolveWsActionType(scenario)` — returns `ScenarioActionType`, absent `actionType` → `'http'`
- [x] `getWsActionType(scenario)` — returns `WsActionType | undefined` (bonus helper)
- [x] `validateWsActionConfig(scenario)` — validates config bag presence, required fields (URL for connect, connectionRef/url for send/receive), matchCriteria consistency
- [x] File: `src/shared/utils/wsScenarioDefaults.ts` (NEW)

#### 5A.6 — Scenario Migration

- [x] **No changes needed** — `normalizeScenarioActionType()` already handles absent `actionType → 'http'` and passes through WS values unchanged. WS is new (no legacy data exists to migrate).
- [x] Verified: `normalizeGroupActionTypes()` works correctly with WS action types (tests pass).
- [x] File: `src/shared/utils/scenarioMigration.ts` (NO CHANGE)

#### 5A Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/types/websocket.ts` | NEW | WsActionType, ScenarioActionType, WsHarnessMatchCriteria, action configs (Connect/Send/Receive), WsResultMeta, WsAssertionTarget, WsNumericAssertionTarget, isWsActionType(), isWsNumericTarget(); re-exports WsTlsConfig, WsProtocolMode from Studio |
| `src/shared/types/websocket.test.ts` | NEW | 73 type contract + helper guard tests |
| `src/shared/types/index.ts` | MODIFY | Scenario (actionType widened to ScenarioActionType, method +'WEBSOCKET', +3 WS action fields), RequestResult (+wsResultMeta), Assertion (+wsField, +wsNumericField), TestDefinitionSnapshot (method +'WEBSOCKET'), export * from './websocket' |
| `src/shared/utils/wsScenarioDefaults.ts` | NEW | createDefaultWs*Action factories, isWsScenario, resolveWsActionType, getWsActionType, validateWsActionConfig |
| `src/shared/utils/wsScenarioDefaults.test.ts` | NEW | 80 defaults + validation tests |
| `src/shared/utils/kafkaScenarioDefaults.ts` | MODIFY | resolveKafkaActionType return type widened to ScenarioActionType |
| `src/shared/utils/scenarioMigration.ts` | NO CHANGE | Existing normalization already handles WS types correctly |

---

### Phase 5B — Execution Engine ✅

> **Goal:** Execute WebSocket scenarios in the test runner via the existing `executeNonHttp` dispatch hook, with parameterized data source support and correct worker/Rust routing.

#### 5B.1 — WS Execution Module ✅

- [x] `executeWsAction(scenario, wsOperations, timeoutMs)`:
  - Resolve action type → `wsConnect` / `wsSend` / `wsReceive`
  - Dispatch to `executeWsConnect()`, `executeWsSend()`, `executeWsReceive()`
  - Each returns `RequestResult` with:
    - `responseBody`: message content (for receive/send-with-response)
    - `responseTimeMs`: operation latency
    - `httpStatus`: 200 on success, 0 on error (unified result shape)
    - `transportType`: WS action type
    - `wsResultMeta`: connection/frame metadata
  - Handles errors: connection timeout, send failure, receive timeout, match failure
  - Uses `classifyWsFailure()` from `graphRunnerWsNodeHandlers.ts` for error classification (mirrors Kafka pattern with `classifyKafkaFailure`)
- [x] `executeWsConnect(config, wsOps)`:
  - Call `wsOps.connect({ url, headers, queryParams, subprotocols, timeoutMs })`
  - Convert `KeyValue[]` headers/queryParams to `Record<string, string>` via `kvToRecord()` helper
  - Parse comma-separated subprotocols string into array
  - Return result with protocol, extensions, latencyMs
  - `responseBody` is JSON-serialized connect metadata for JSONPath assertions
- [x] `executeWsSend(config, wsOps)`:
  - Requires `connectionRef` (must reference a prior wsConnect's connectionId)
  - Call `wsOps.send({ connectionId, data, type })`
  - If `waitForResponse`: snapshot cursor via `wsOps.snapshotCursor()` BEFORE send to avoid capturing our own sent message, then call `wsOps.waitForMessage({ connectionId, timeoutMs, sinceCursor })`
  - Return result with response body (if any), latencyMs, messageSize
- [x] `executeWsReceive(config, wsOps)`:
  - Requires `connectionRef` (must reference a prior wsConnect's connectionId)
  - Call `wsOps.waitForMessage({ connectionId, timeoutMs, matchCriteria })`
  - Map `WsHarnessMatchCriteria` → `WsMessageMatchCriteria` (same shape, field-by-field copy)
  - Return result with matched message body, frameType, messageSize
- [x] Run validation via `buildValidationResult({ ..., wsContext, transportType })` after each action
- [x] Shared `buildWsResult()` helper constructs `wsContext` from `wsResultMeta` and delegates to `buildValidationResult`
- [x] File: `src/engine/wsExecution.ts` (NEW — 337 lines)
- [x] Tests: `src/engine/wsExecution.test.ts` (NEW — 35 tests covering connect/send/receive success, errors, validation, edge cases)

**Implementation Notes:**
- Error classification reuses `classifyWsFailure()` from `graphRunnerWsNodeHandlers.ts`, same pattern as Kafka's `classifyKafkaFailure()`. Non-'network' classes prefix the error message with `[timeout]`, `[protocol]`, `[connection]`, or `[validation]`.
- `connectionRef` is mandatory for `wsSend` and `wsReceive` — no auto-connect from URL. This is consistent with the harness sequential model where a `wsConnect` scenario must precede send/receive.
- `snapshotCursor` before send-with-response is critical to avoid capturing the outgoing message as the response.
- `responseBody` is truncated to 10,000 chars (same as Kafka pattern) to prevent oversized results.
- `kvToRecord()` helper filters empty-key entries from `KeyValue[]` arrays.

#### 5B.2 — Executor Wiring ✅

- [x] **Correction**: `runTest()` already receives `kafkaOperations` and `wsOperations` as parameters (lines 117-119). Only the `executeNonHttp` callback needed extension.
- [x] Extend `executeNonHttp` callback to dispatch both Kafka and WS action types:
  - Activates when either `kafkaOperations` or `wsOperations` is available (was previously Kafka-only)
  - Uses `isWsActionType(at)` for WS dispatch (type-safe guard)
  - Throws descriptive error if operations object is missing for the requested action type
- [x] Added `try/finally` block around non-workflow execution paths calling `wsOperations?.disconnectAll()` for connection cleanup after harness runs (workflow path has its own cleanup in `graphRunner.ts`)
- [x] File: `src/engine/executor.ts` (MODIFY)

**Design Decision:** The `try/finally` wraps only the harness execution paths (sequential/batch/pool/load-profile). The workflow path (`runGraphLoad`/`runWorkflow`/`runWorkflowLoad`) already handles WS cleanup internally via `graphRunner.ts`.

#### 5B.3 — Data Source Expansion ✅

- [x] Add WS action field interpolation to `dataSourceExpander.ts` in `resolveScenarioFromDataRow()`:
  - Use body-type column vars (same pattern as Kafka — `{{varName}}` substitution)
  - Interpolate `wsConnectAction.url`, `wsConnectAction.headers[].value`, `wsConnectAction.connectionId`, `wsConnectAction.queryParams[].value`
  - Interpolate `wsSendAction.message`, `wsSendAction.url`, `wsSendAction.connectionRef`
  - Interpolate `wsReceiveAction.url`, `wsReceiveAction.connectionRef`, `wsReceiveAction.matchCriteria.contentContains/jsonPathValue`
  - Note: `contentRegex` is NOT substituted — regex patterns should not be modified by data source values
- [x] Add `wsField` assertion value interpolation (merged into existing `kafkaField` block: `a.type === 'kafkaField' || a.type === 'wsField'`)
- [x] Include `wsConnectAction`, `wsSendAction`, `wsReceiveAction` in returned expanded scenario object
- [x] File: `src/engine/dataSourceExpander.ts` (MODIFY)

**Design Decision:** `wsNumericField` assertion values (numeric) are NOT substituted — data source variables are strings, and coercing them to numbers in the expander would be fragile. Numeric assertion values are set at design time.

#### 5B.4 — Worker Path Fix ✅

- [x] In `executionWorker.ts`: build `wsOperations` and `kafkaOperations` unconditionally for ALL execution modes (removed `msg.workflow ? ... : undefined` guards)
- [x] **Safe to build unconditionally**: Both `buildKafkaNodeOperations()` and `buildWsNodeOperations()` are lightweight factory functions with lazy initialization (no eager connections or resource allocation)
- [x] File: `src/engine/executionWorker.ts` (MODIFY — 2-line change)

#### 5B.5 — Rust Executor Guard ✅

- [x] In `canUseRustExecutor()`: added `if (scenarios.some((s) => s.actionType && s.actionType !== 'http')) return false;`
- [x] This excludes ALL non-HTTP action types (WS + Kafka) from the Rust executor — fixes the existing Kafka gap too
- [x] `prepareRustScenario()` is safe: the guard prevents non-HTTP scenarios from reaching it; no changes needed
- [x] File: `src/features/test-runner/utils/rustBridge.ts` (MODIFY — 1-line addition)

#### 5B.6 — Test Execution Hook ✅ (Already Implemented)

- [x] In `useTestExecution.ts`: `wsOps = buildWsNodeOperations()` is already built alongside `kafkaOps`
- [x] Both are passed to `runTest()` on the JS execution path (lines 336-349)
- [x] HTTP error metric tracking: `trackResult()` already guards via `(r.transportType ?? 'http') === 'http'` check — WS results are excluded automatically
- [x] **Circuit breaker**: `breaker.record(result)` uses `result.passed` flag — WS failures correctly set `passed = false`, which is correct behavior (connection failures should trip the breaker)
- [x] No changes needed in this file

#### 5B.7 — CLI Reporter WS Support ✅ (Bonus — discovered during re-evaluation)

- [x] Refactored `cli/reporters.ts`: replaced Kafka-only ternary chains with `formatTransportLabel()` and `formatTransportErrorFallback()` helpers
- [x] JUnit XML: WS results now use `WebSocketError` failure type (was incorrectly `KafkaError`) and `WS_CONNECT`/`WS_SEND`/`WS_RECEIVE` labels
- [x] Console/Markdown: WS results display correct transport labels instead of `CONSUME`
- [x] Updated `cli/reporters.console.test.ts` test expectations to match new label format
- [x] File: `cli/reporters.ts` (MODIFY), `cli/reporters.console.test.ts` (MODIFY)

#### 5B Files

| File | Action | Purpose |
|---|---|---|
| `src/engine/wsExecution.ts` | NEW | WS action dispatcher (connect/send/receive → RequestResult) |
| `src/engine/wsExecution.test.ts` | NEW | 35 execution tests |
| `src/engine/executor.ts` | MODIFY | Extend executeNonHttp to dispatch WS actions + `disconnectAll()` cleanup in finally block |
| `src/engine/dataSourceExpander.ts` | MODIFY | WS action + assertion field interpolation (body-type column vars) |
| `src/engine/executionWorker.ts` | MODIFY | Build WS + Kafka ops for ALL execution modes (fix harness worker gap) |
| `src/features/test-runner/utils/rustBridge.ts` | MODIFY | Exclude WS (and Kafka) from `canUseRustExecutor()` |
| `cli/reporters.ts` | MODIFY | WS-aware transport labels in JUnit/Console/Markdown reporters |
| `cli/reporters.console.test.ts` | MODIFY | Updated test expectations for new label format |

#### 5B Verification Results

- **TypeScript**: `npx tsc -b --noEmit` — 0 errors
- **Linter**: 0 errors across all modified files
- **Tests**: 383 tests passed across 11 files + 54 executor tests (wsExecution: 35, wsAssertionEvaluation: 59, kafkaExecution: 53, websocket types: 41, wsScenarioDefaults: 60, CLI reporters: 67, executor: 54, requestExecution, rustBridge)
- **Regression**: All existing Kafka, HTTP, and CLI reporter tests continue to pass

#### 5B Post-Implementation Re-evaluation (Round 3)

Two bugs found and fixed during thorough re-evaluation:

1. **Legacy workflow paths outside cleanup block** — `runWorkflow()`/`runWorkflowLoad()` execution paths in `executor.ts` were outside the `try/finally` block that calls `wsOperations?.disconnectAll()`. If WS scenarios ran through these legacy paths, connections would leak. **Fix:** Restructured `executor.ts` to wrap ALL non-graph-runner paths (legacy workflow + harness) in the `try/finally` cleanup block, while keeping the graph-based `runGraphLoad()` path separate (it has its own cleanup).

2. **Optional chaining `.catch()` crash** — The original code `await wsOperations?.disconnectAll().catch(...)` would crash with `TypeError: Cannot read properties of undefined (reading 'catch')` when `wsOperations` is `undefined` (HTTP-only tests). `wsOperations?.disconnectAll()` returns `undefined` when the optional chain short-circuits, and `.catch()` on `undefined` throws. **Fix:** Changed to explicit `if (wsOperations)` guard before calling `disconnectAll().catch()`.

- **Verification**: 383 tests across 11 files + 54 executor tests — all passing. 0 TypeScript errors. 0 lint errors.

---

### Phase 5C — Assertion Engine ✅

> **Goal:** Extend the assertion engine to evaluate WebSocket-specific assertion targets (`ws.body`, `ws.type`, `ws.latencyMs`, etc.) and integrate with the validation result pipeline.

#### 5C.1 — Assertion Context Extension

- [x] Add `wsContext` to `AssertionContext`:
  ```ts
  wsContext?: {
    connectionId?: string;
    frameType?: 'text' | 'binary';
    protocol?: string;
    messageSize?: number;
    latencyMs?: number;
    url?: string;
  };
  ```
- [x] Add `wsContext` to `ValidationInput` (for `buildValidationResult`)
- [x] File: `src/engine/validator.ts` (MODIFY), `src/engine/validationResult.ts` (MODIFY)

#### 5C.2 — wsField Assertion Evaluation (String Targets)

- [x] Add `wsField` case to `evaluateAssertions()` switch (string-based, uses `AssertionOperator`):
  - Resolve target value from `wsContext`, `rawBody`, or `responseHeaders` — all stringified
  - `ws.body` → `rawBody`
  - `ws.type` → `wsContext.frameType`
  - `ws.protocol` → `wsContext.protocol`
  - `ws.connectionId` → `wsContext.connectionId`
  - `ws.header.*` → response headers (if available) via `findHeader`
  - `ws.$.*` → JSONPath into parsed message body (reuse existing `getByPath`)
- [x] Use same `evaluateHeaderOp` for string comparison operators (equals/contains/regex/exists)
- [x] **Note**: `ws.latencyMs` and `ws.size` are handled by `wsNumericField` (5C.5) for numeric comparison. They may also appear here as string equality checks — both paths should work
- [x] File: `src/engine/validator.ts` (MODIFY)

#### 5C.3 — Custom Expression Paths

- [x] Extend `resolveVariable()` in custom assertion expressions to recognize `ws.*` paths
- [x] `ws.body`, `ws.type`, `ws.latencyMs`, etc. resolve from `wsContext`
- [x] **Correct location**: `resolveVariable()` is a **local function defined inline** inside the `case 'custom'` block of `evaluateAssertions()` in `validator.ts` (lines ~817–858). It is NOT exported from `validatorCustomExpression.ts` — that file only exports `isTruthy` and `wrapCustomExprDollarPaths`. Added `ws.*` paths alongside existing `kafka.*` paths in this inline resolver
- [x] File: `src/engine/validator.ts` (MODIFY — same file as 5C.2, not `validatorCustomExpression.ts`)

#### 5C.4 — Validation Result Integration

- [x] In `buildValidationResult()`: pass `wsContext` through to `evaluateAssertions()`
- [x] For WS actions: skip HTTP-specific failure checks (status code 0/4xx) — use `passed` flag only
- [x] **Kafka latent bug fixed**: Added `transportType` parameter to `ValidationInput`. When `transportType` is non-HTTP, the `(http)` failure check is skipped entirely. Updated `kafkaExecution.ts` to pass `transportType: 'kafkaProduce'` / `'kafkaConsume'` — this fixes the spurious `{ path: '(http)', expected: '2xx' }` failure that was added to Kafka error results
- [x] **Defensive non-HTTP failure**: For non-HTTP transports, `passed = false` when `errorMessage` is set OR `httpStatus === 0`, ensuring errors are never silently ignored even if execution code forgets to set `errorMessage`
- [x] File: `src/engine/validationResult.ts` (MODIFY), `src/engine/kafkaExecution.ts` (MODIFY — transportType pass-through)

#### 5C.5 — wsNumericField Assertion Evaluation

- [x] Add `wsNumericField` case to `evaluateAssertions()`:
  - Resolve numeric value from `wsContext` (`ws.latencyMs` → `wsContext.latencyMs`, `ws.size` → `wsContext.messageSize`)
  - Use existing `ComparisonOperator` evaluation (same as `numeric` assertion type)
  - Return failure with `(wsNumericField:ws.latencyMs)` path format
- [x] File: `src/engine/validator.ts` (MODIFY — same file as 5C.2)

#### 5C Files

| File | Action | Purpose |
|---|---|---|
| `src/engine/validator.ts` | MODIFY | wsField + wsNumericField cases in evaluateAssertions, ws.* in resolveVariable, wsContext on AssertionContext |
| `src/engine/validationResult.ts` | MODIFY | wsContext passthrough, transportType-aware HTTP status skip (fixes Kafka too) |
| `src/engine/kafkaExecution.ts` | MODIFY | Pass transportType to buildValidationResult (Kafka bug fix) |
| `src/engine/wsAssertionEvaluation.test.ts` | NEW | 59 tests: wsField, wsNumericField, custom ws.* paths, transportType-aware validation |

#### 5C Implementation Notes

- **wsField target resolution**: `ws.size` and `ws.latencyMs` are resolved as stringified values (e.g., `'256'`, `'45.5'`) for string comparison via `evaluateHeaderOp`. This allows both `wsField` (string) and `wsNumericField` (numeric) assertions on the same targets
- **JSONPath for ws.$.***: The `ws.$.data.orderId` target strips the `ws.$.` prefix and prepends `$.` for `getByPath()`, resolving against `ctx.responseBody` (the parsed message body). Non-string values are JSON-stringified
- **resolveVariable for custom expressions**: Added `ws.body`, `ws.type`, `ws.protocol`, `ws.connectionId`, `ws.latencyMs`, `ws.size`, `ws.url`, `ws.header.*` selectors. Unlike `wsField` where size/latency are stringified, here they return their native numeric type for expression arithmetic
- **transportType-aware validation**: `isHttpTransport = !input.transportType || input.transportType === 'http'`. Existing HTTP callers (requestExecution, graphRunnerHelpers, rustBridge) don't pass transportType, defaulting to HTTP behavior. Only kafkaExecution now passes it explicitly
- **Kafka bug fix**: `kafkaExecution.ts` now passes `transportType: 'kafkaProduce'|'kafkaConsume'` to `buildValidationResult`, preventing the spurious `(http)` failure detail that was previously added to Kafka error results
- **Test coverage**: 59 tests covering all wsField targets, wsNumericField operators, custom expression ws.* paths, negate flag, missing wsContext, mixed WS + standard assertions, and all transportType scenarios (HTTP/Kafka/WS with various status/error combinations)

---

### Phase 5D — Scenario Editor UI

> **Goal:** UI for authoring WebSocket test scenarios — action type selector, WS-specific config panels, assertion presets, and integration into the existing scenario builder.

#### 5D.1 — Action Type Selector (Greenfield)

- [x] **Greenfield work**: `TestEditorModal` is currently **HTTP-only** — there is NO existing action type selector, and NO Kafka-specific panels despite Kafka types existing in the data model. This is net-new UI for both Kafka and WS, not an extension
- [x] Add a transport mode dropdown/selector at the top of `TestEditorModal`:
  - HTTP (GET/POST/PUT/PATCH/DELETE) — default, existing behavior
  - Kafka Produce
  - Kafka Consume
  - WS Connect
  - WS Send
  - WS Receive
- [x] When action type changes:
  - HTTP → show URL bar, method dropdown, tabs (params/body/auth/headers/validation/extract/data/history)
  - Kafka → show Kafka-specific config panel (cluster, topic, key, value, etc.) — **also new; Kafka has backend support but no editor UI**
  - WS → show `WsScenarioEditor` panel (URL, headers, message, etc.)
- [x] Common tabs (validation, data source, history) remain visible for all transport types
- [x] Update `emptyTest()` factory to accept optional action type parameter and return appropriate defaults
- [x] File: `src/features/scenarios/components/TestEditorModal.tsx` (MODIFY), `src/features/scenarios/utils/testEditorUtils.ts` (MODIFY)

#### 5D.2 — WS Scenario Editor

- [x] `WsScenarioEditor.tsx` — conditional panel rendered inside `TestEditorModal` when action type is WS:
  - **WS Connect mode**: URL input, headers editor, query params, subprotocols, timeout, protocol mode selector
  - **WS Send mode**: connection ref selector (dropdown of sibling connect tests), message textarea with `{{variable}}` insertion, format selector (text/binary), wait-for-response checkbox + timeout
  - **WS Receive mode**: connection ref selector, timeout, match criteria (contains/regex/jsonpath), extraction rules
- [x] All fields support `{{variable}}` interpolation (reuse existing variable insertion pattern)
- [x] Validation feedback: highlight missing required fields (URL for connect, message for send)
- [x] File: `src/features/scenarios/components/WsScenarioEditor.tsx` (NEW)
- [x] Tests: `src/features/scenarios/components/WsScenarioEditor.test.tsx` (NEW)

#### 5D.3 — Assertion Presets for WS

- [x] Add WS assertion presets to `ADD_ASSERTION_MENU_ROWS`:
  - "WS Body" → `{ type: 'wsField', target: 'ws.body', operator: 'contains' }`
  - "WS Frame Type" → `{ type: 'wsField', target: 'ws.type', operator: 'equals', value: 'text' }`
  - "WS Latency" → `{ type: 'wsNumericField', target: 'ws.latencyMs', operator: '<', value: 1000 }` (uses `ComparisonOperator`, not `AssertionOperator`)
  - "WS Protocol" → `{ type: 'wsField', target: 'ws.protocol', operator: 'equals' }`
  - "WS JSON Path" → `{ type: 'wsField', target: 'ws.$.', operator: 'equals' }`
  - "WS Message Size" → `{ type: 'wsNumericField', target: 'ws.size', operator: '<', value: 65536 }`
- [x] Add Kafka presets: Kafka Body, Kafka Key, Kafka Partition
- [x] Add transport-conditional visibility: filter presets by current scenario `actionType` (HTTP presets for `'http'`, Kafka for `'kafkaProduce'|'kafkaConsume'`, WS for WS types). Implemented via `getTransportFilter()` + `isRowVisibleForTransport()` helpers and `transport` field on each row
- [x] File: `src/features/scenarios/components/testEditorValidationAddMenu.ts` (MODIFY)

#### 5D.4 — Assertion Row Editor for wsField

- [x] Add `wsField` rendering branch to `AssertionRowEditor.tsx`:
  - Target selector: `ws.body`, `ws.type`, `ws.protocol`, `ws.connectionId`, custom (`ws.$.path`)
  - Operator selector (reuse existing `AssertionOperator` dropdown — equals/contains/regex/exists)
  - Value input (reuse existing), hidden for `exists` operator
  - JSONPath inline input for `ws.$.` targets (dynamic path entry)
- [x] Add `wsNumericField` rendering branch:
  - Target selector: `ws.latencyMs`, `ws.size`
  - Operator selector (reuse `ComparisonOperator` dropdown via `ComparisonSelect` — same as `numeric` assertion)
  - Numeric value input
- [x] **Kafka gap fixed**: `kafkaField` rendering branch added with:
  - Target selector: `kafka.body`, `kafka.key`, `kafka.partition`, `kafka.offset`, `kafka.header.name`
  - Dynamic header name input for `kafka.header.*` targets
  - Same operator set as `wsField` (equals/contains/regex/exists)
- [x] Add `getAssertionTypeBadgeLabel` cases in `testEditorValidationConstants.ts`: `wsField` → `'WS'`, `wsNumericField` → `'WS#'`, `kafkaField` → `'KAFKA'`
- [x] File: `src/features/scenarios/components/AssertionRowEditor.tsx` (MODIFY), `src/features/scenarios/components/testEditorValidationConstants.ts` (MODIFY)

#### 5D.5 — Extraction Editor Wiring

- [ ] **DEFERRED to Phase 5F** — `wsExtractionAdapter` does not exist yet (created in 5F.1)
- [ ] For now, hide the extraction tab when `actionType` is a WS or Kafka type (no adapter available)
- [ ] When 5F lands, swap adapters based on transport type
- [ ] File: `src/features/scenarios/components/TestEditorModal.tsx` (MODIFY — same as 5D.1)

#### 5D — Plan Evaluation Notes

Issues found during plan review and addressed in implementation:

1. **Save button validation**: Currently `disabled={!draft.url.trim()}` but WS scenarios store URL in action configs, not `draft.url`. Save must use transport-aware validation (`validateWsActionConfig()`).
2. **cURL modes**: cURL Import/Export are HTTP-only. Must hide/disable for non-HTTP transports.
3. **Method sentinel**: Switching transport must set `draft.method` to `'WEBSOCKET'` or `'KAFKA'` so downstream consumers (results, reports) show correct labels.
4. **Tab visibility**: Params tab is HTTP-only. Body tab is HTTP-only. Auth tab stays for all. Headers tab: visible for HTTP and WS Connect. Extract tab: hidden for non-HTTP (until 5F). Validation, data source, history tabs: visible for all.
5. **Connection ref source**: `WsScenarioEditor` needs access to sibling WS Connect tests from the same feature group/scenario for the `connectionRef` dropdown.
6. **Kafka assertion presets**: Plan mentions "for completeness" but doesn't list specifics. Added: Kafka Body, Kafka Key, Kafka Partition presets.
7. **5D.5 deferred**: `wsExtractionAdapter` depends on Phase 5F. Extraction tab simply hidden for non-HTTP until then.

#### 5D Files

| File | Action | Purpose |
|---|---|---|
| `src/features/scenarios/components/WsScenarioEditor.tsx` | NEW | WS-specific scenario config panel (connect/send/receive modes) |
| `src/features/scenarios/components/WsScenarioEditor.test.tsx` | NEW | Editor tests (24 tests) |
| `src/features/scenarios/components/testEditorValidationAddMenu.test.ts` | NEW | Transport filter and preset tests (14 tests) |
| `src/features/scenarios/components/TestEditorModal.tsx` | MODIFY | Greenfield transport selector + conditional panel rendering |
| `src/features/scenarios/utils/testEditorUtils.ts` | MODIFY | emptyTest() accepts optional action type |
| `src/features/scenarios/components/testEditorValidationAddMenu.ts` | MODIFY | WS + Kafka assertion presets with transport-conditional visibility |
| `src/features/scenarios/components/AssertionRowEditor.tsx` | MODIFY | wsField + wsNumericField + kafkaField rendering branches |
| `src/features/scenarios/components/testEditorValidationConstants.ts` | MODIFY | Badge labels for wsField, wsNumericField, kafkaField |
| `src/features/scenarios/components/TestEditorValidationTab.tsx` | MODIFY | Import transport filter, apply to assertion menu + empty-state |
| `src/features/scenarios/utils/testEditorUtils.test.ts` | MODIFY | Added 7 emptyTest() action type tests |
| `src/features/scenarios/components/testEditorValidationConstants.test.ts` | MODIFY | Added badge label tests for new types |
| `src/features/scenarios/components/AssertionRowEditor.test.tsx` | MODIFY | Added wsField, wsNumericField, kafkaField tests (12 tests) |

#### 5D Implementation Notes

**Architecture:**
- Transport selector uses `<optgroup>` for clean grouping: HTTP / WebSocket / Kafka
- `handleTransportChange()` clears all WS configs before setting new ones (prevents stale config)
- Auto-resets input mode to 'builder' and tab to 'validation' when switching away from HTTP
- Save button uses transport-aware validation via `canSave` (wsConnect requires URL, others always saveable)
- `WsScenarioEditor` receives sibling tests for connectionRef dropdown via `siblingTests` prop

**Transport Filter System:**
- `getTransportFilter(actionType)` maps `ScenarioActionType` → `'http' | 'ws' | 'kafka'`
- `isRowVisibleForTransport(row, filter)` controls per-row visibility
- Rows without `transport` property are visible for all transports (transport-agnostic assertions)
- Applied to both category rendering and empty-state detection in `TestEditorValidationTab`

**Tab Visibility:**
- HTTP: all tabs (params, body, auth, headers, validation, extract, data, history)
- WS/Kafka: validation, data, history only (params/body/auth/headers/extract hidden)
- Extract tab deferred to Phase 5F (wsExtractionAdapter doesn't exist yet)

**Design Decisions:**
| Decision | Rationale |
|---|---|
| Clear all WS configs on transport switch | Prevents stale config from old type leaking through |
| Auto-switch to 'validation' tab on transport change | Avoids blank content pane when HTTP-only tab was active |
| `WsKvEditor` inline component | Reuses existing `kv-section` CSS, avoids extra file for small helper |
| Kafka placeholder panel | Backend exists but UI deferred; placeholder prevents confusion |
| Transport-agnostic assertions | Regex, numeric, date, etc. work on all response bodies (HTTP/WS/Kafka) |

#### 5D Verification Results

- **TypeScript**: `npx tsc -b --noEmit` — 0 errors
- **Linter**: 0 errors across all 12 modified files
- **Tests**: 184 tests passed across 6 core test files + regression:
  - WsScenarioEditor: 24 tests (connect/send/receive modes, edge cases)
  - AssertionRowEditor: 32 tests (incl. 13 new wsField/wsNumericField/kafkaField + ws.header tests)
  - testEditorValidationAddMenu: 14 tests (transport filter + 7 WS presets, 3 Kafka presets)
  - testEditorValidationConstants: 6 tests (incl. new badge labels)
  - testEditorUtils: 14 tests (incl. 7 new emptyTest action type tests)
  - websocket.test.ts: 46 tests (WS type assertion discriminants)
- **Regression**: All 114 existing validation tab tests pass (part1-3 verified)

#### 5D Post-Implementation Review

Issues found and fixed during re-evaluation:

1. **JSONPath slice offset** — `AssertionRowEditor` for `ws.$.path` targets used `a.target.slice(4)` instead of `slice(5)` to strip the `'ws.$.'` prefix (5 chars). Produced `.data.status` instead of `data.status`. **Fixed:** Changed to `slice(5)`.

2. **Old WS config not cleared on transport switch** — Switching from `wsConnect` to `wsSend` left stale `wsConnectAction` on the draft. **Fixed:** `handleTransportChange()` now explicitly sets all three WS config fields to `undefined` before applying the new one.

3. **Input mode not reset for non-HTTP** — Switching transport while in cURL Import/Export mode would hide the mode buttons but leave the panel showing. **Fixed:** `handleTransportChange()` auto-resets to 'builder' mode when switching away from HTTP.

4. **Active tab invisibility** — Switching to WS while on 'params' tab left user on invisible tab. **Fixed:** `handleTransportChange()` auto-switches to 'validation' tab when current tab becomes HTTP-only.

5. **Empty-state check missing transport filter** — The "No matching assertions" empty state in `TestEditorValidationTab` used unfiltered category check, could fail to show empty state for transport-filtered searches. **Fixed:** Applied `isRowVisibleForTransport` filter to empty-state detection.

6. **Missing `ws.header.<name>` target in wsField dropdown** — The `WsAssertionTarget` type includes `ws.header.${string}` for asserting upgrade response headers, and the `kafkaField` UI already supports `kafka.header.<name>` with a dynamic input — but the `wsField` dropdown in `AssertionRowEditor` was missing this option entirely. Users couldn't create WS header assertions through the UI. **Fixed:** Added `ws.header.` option to the wsField `<select>`, added a dynamic header name `<input>` (matching the kafka pattern), updated the select value logic to handle the `ws.header.` prefix, added a "WS Header" preset to the assertion menu (7 WS presets total), and updated tests (preset count + header name rendering test).

---

### Phase 5E — Results & Reporting

> **Goal:** Display WebSocket test results with transport-aware labels, metadata panels, and correct report generation.

#### 5E — Plan Evaluation Notes

1. **5E.1 is mostly complete**: `formatTransportStatus()` already exists in `transportStatus.ts` (with tests). All three summary table components (`ResultsRequestDetailsTab`, `DataRowSummaryTable`, `WorkflowResultsSummary`) already import and use it. No inline ternary chains to replace. **Remaining**: add `getTransportMethodLabel()` helper for method badge display.
2. **5E.2 is the biggest gap**: `ResponseDetailModal` is entirely HTTP-centric — WS results show `ERR` status badge because `httpStatus` is `0`. Needs transport-aware status badge, WS details panel, Kafka details panel.
3. **5E.3 mostly done**: HTML/MD reports already use `formatTransportStatus()`. **Remaining**: JSON `failedRowDetails` only exports `httpStatus` (no `transportType`); no WS test coverage in `reportGenerator.test.ts`.
4. **5E.4 has a bug**: `computeMetrics()` in `metrics.ts` has NO transport guard — counts all results with `httpStatus >= 400 || httpStatus === 0` as HTTP failures. WS/Kafka results always have `httpStatus: 0`, inflating error rates. `runBaselines` and `trackResult()` are already correctly guarded.
5. **`ResultsMetricsCards` tooltip** says "non-2xx HTTP status" — should say "failed requests" for mixed-transport runs.
6. **`transportLabels.ts` NOT needed**: `transportStatus.ts` already serves this purpose. Plan should not create a duplicate file. Add `getTransportMethodLabel()` to the existing `transportStatus.ts`.

#### 5E.1 — Transport Status Labels ✅

- [x] `formatTransportStatus()` — already implemented in `transportStatus.ts` (with full tests)
- [x] Summary tables — already use `formatTransportStatus()` (no inline ternaries)
- [x] Added `getTransportMethodLabel(result)` to `transportStatus.ts` — returns concise method badge text for all transports
- [x] Added `isHttpResult()` and `getTransportFamily()` helpers for transport classification
- [x] Files: `src/features/results/utils/transportStatus.ts` (MODIFIED), `transportStatus.test.ts` (MODIFIED — added 14 tests)

#### 5E.2 — Response Detail Modal ✅

- [x] Made `ResponseDetailModal` transport-aware:
  - Uses `formatTransportStatus(result)` for status badge instead of raw `httpStatus`
  - Transport-aware badge styling: HTTP uses status-code-based color (2xx=blue, 4xx/5xx=red), non-HTTP uses `result.passed`
  - Shows `getTransportMethodLabel()` for the method badge
  - HTTP: existing behavior preserved (status badge, headers, body, timing waterfall)
  - WS: "WebSocket Details" section with `wsResultMeta` fields (connectionId, frameType, protocol, messageSize, url, closeCode)
  - Kafka: "Kafka Details" section with `kafkaResultMeta` fields (topic, partition, offset, key, matchedMessages)
  - Timing waterfall hidden for non-HTTP (WS/Kafka don't have HTTP timing phases)
- [x] File: `src/features/requests/components/ResponseDetailModal.tsx` (MODIFIED)
- [x] Tests: `src/features/requests/components/ResponseDetailModal.test.tsx` (NEW — 25 tests)

#### 5E.3 — Report Generator ✅

- [x] HTML/MD reports — already use `formatTransportStatus()` for status labels
- [x] JSON export: added `transportType` and `transportStatus` fields to `failedRowDetails`
- [x] Added WS report test coverage (HTML CONNECT/SEND/RECEIVE, MD CONNECT, passed rows, JSON transport fields)
- [x] Added Kafka JSON transport field test
- [x] File: `src/features/results/utils/reportGenerator.ts` (MODIFIED), `reportGenerator.test.ts` (MODIFIED — added 7 WS/JSON tests)

#### 5E.4 — Metrics Transport Guard ✅

- [x] `runBaselines.ts` — already guarded with `(r.transportType ?? 'http') === 'http'` ✓
- [x] `trackResult()` in `useTestExecution.ts` — already guarded ✓
- [x] **BUG FIXED**: `computeMetrics()` in `metrics.ts` — added transport guard: HTTP failures use `httpStatus >= 400 || httpStatus === 0`, non-HTTP failures use `!r.passed`. WS/Kafka results with `httpStatus: 0` no longer inflate error rates.
- [x] Updated `ResultsMetricsCards.tsx` tooltip: "failed requests (HTTP errors + transport failures)"
- [x] Files: `src/engine/metrics.ts` (MODIFIED), `src/engine/metrics.test.ts` (MODIFIED — added 4 WS/Kafka/mixed tests), `src/features/results/components/ResultsMetricsCards.tsx` (MODIFIED)

#### 5E Files

| File | Action | Purpose |
|---|---|---|
| `src/features/results/utils/transportStatus.ts` | MODIFIED | Added `getTransportMethodLabel()`, `isHttpResult()`, `getTransportFamily()` |
| `src/features/results/utils/transportStatus.test.ts` | MODIFIED | Added 14 tests for new helpers |
| `src/features/requests/components/ResponseDetailModal.tsx` | MODIFIED | Transport-aware status badge, WS/Kafka details panels |
| `src/features/requests/components/ResponseDetailModal.test.tsx` | NEW | 25 tests for HTTP/WS/Kafka rendering |
| `src/features/results/utils/reportGenerator.ts` | MODIFIED | JSON `failedRowDetails` includes `transportType` + `transportStatus` |
| `src/features/results/utils/reportGenerator.test.ts` | MODIFIED | Added 7 WS/Kafka/JSON transport tests |
| `src/engine/metrics.ts` | MODIFIED | Transport guard: non-HTTP failures via `!r.passed` |
| `src/engine/metrics.test.ts` | MODIFIED | Added 4 WS/Kafka/mixed metrics tests |
| `src/features/results/components/ResultsMetricsCards.tsx` | MODIFIED | Transport-aware error rate tooltip |

#### 5E Implementation Notes

1. **No `transportLabels.ts` needed**: The existing `transportStatus.ts` already served this purpose. Added new helpers alongside existing `formatTransportStatus()`.
2. **Status badge color logic**: HTTP uses HTTP-status-based semantics (200=blue, 500=red). Non-HTTP uses `result.passed` (true=blue, false=red). This was discovered during re-evaluation — initial implementation incorrectly used `result.passed` for all transports, which would show HTTP 200 in red for validation-only failures.
3. **`computeMetrics` bug fix**: WS/Kafka results always set `httpStatus: 0`, which the old code counted as HTTP errors. The fix uses `(r.transportType ?? 'http') === 'http'` guard (matching `runBaselines` and `trackResult` patterns) and counts non-HTTP failures via `!r.passed`.
4. **Method badge duplication**: For WS/Kafka results, both the method badge and status badge show the same label (e.g., "CONNECT") since there's no separate HTTP method vs status distinction. Tests use `getAllByText` to handle this correctly.

#### 5E Verification Results

- TypeScript: **0 errors** (`npx tsc -b --noEmit`)
- Linter: **0 errors** across all modified files
- Tests: **118 tests passed** across 4 test files:
  - `transportStatus.test.ts` — 23 tests (9 existing + 14 new)
  - `metrics.test.ts` — 22 tests (18 existing + 4 new)
  - `ResponseDetailModal.test.tsx` — 25 tests (all new)
  - `reportGenerator.test.ts` — 48 tests (41 existing + 7 new)

#### 5E Post-Implementation Review

1. **Bug found and fixed during initial re-evaluation**: Status badge color logic for HTTP results with validation failures. Initial implementation used `result.passed` uniformly, which would incorrectly show HTTP 200 in red when validations fail. Fixed to use HTTP-status-based color for HTTP and `result.passed` for non-HTTP.
2. **Bug found and fixed during thorough re-evaluation**: `trackResult()` and `failedInWindow` in `useTestExecution.ts` were NOT counting WS/Kafka `passed: false` results as failures. This caused live error rates to under-report for WS/Kafka runs compared to the final summary (which uses `computeMetrics`). Fixed both to mirror the `computeMetrics` pattern: HTTP failures via status codes, non-HTTP failures via `!r.passed`.
3. **Pre-existing test failures fixed**: 3 tests in `useTestExecution.execute.test.ts` were failing because `runTest` now accepts a 10th argument (`wsManager`) added in a previous WS phase. Updated tests to expect the additional `wsManager` argument with `expect.objectContaining({ connect, send })`.
4. **JSDoc mismatch fixed**: `getTransportMethodLabel` JSDoc incorrectly stated "WS CONNECT" but implementation returns "CONNECT". Fixed to match actual output.

#### 5E Final Verification Results

- TypeScript: **0 errors** (`npx tsc -b --noEmit`)
- Linter: **0 errors** across all modified files
- Tests: **205 tests passed** across 11 test files (Phase 5E files + useTestExecution suite)

---

#### Phase 5 Cross-Phase Review (comprehensive re-evaluation)

A thorough cross-phase review of all Phase 5 (5A–5E) implementations identified and fixed the following bugs:

**Bugs fixed:**

1. **`TestEditorModal.canSave` too permissive for `wsSend`/`wsReceive`** (Phase 5D): `canSave` returned `true` for wsSend/wsReceive without checking `connectionRef`, allowing users to save invalid tests that would fail at runtime. Fixed to require `connectionRef?.trim()` for both wsSend and wsReceive action types.

2. **`WsScenarioEditor` connectionRef dropdown used test `id` fallback** (Phase 5D): When a sibling `wsConnect` test had no explicit `connectionId`, the dropdown used `t.id` (UUID) as the ref value. But `buildWsNodeOperations.connect()` only registers user-facing IDs when `connectionId` is explicitly set, so selecting a UUID ref would fail at runtime. Fixed to exclude connect tests without `connectionId` from the dropdown and show the "No wsConnect tests found" warning instead.

3. **`handleTransportChange` didn't clear Kafka configs** (Phase 5D): Switching transport type cleared WS configs (`wsConnectAction`, `wsSendAction`, `wsReceiveAction`) but not Kafka configs (`kafkaProduceAction`, `kafkaConsumeAction`). This left stale Kafka configs attached to the wrong action type. Fixed to clear both WS and Kafka configs on transport change.

4. **`runBaselines.groupByScenario` under-counted non-HTTP errors** (Phase 5E): Per-scenario error rate only counted HTTP status failures (`httpStatus >= 400 || httpStatus === 0`) and ignored WS/Kafka `passed: false` failures. This meant baseline comparisons showed 0% error rate for failing Kafka/WS scenarios. Fixed to add `else if (!isHttp && !r.passed) g.errorCount++` to match `computeMetrics` pattern. Updated test to expect correct behavior.

5. **`ResponseDetailModal` showed empty "WebSocket Details" section for `wsResultMeta: {}`** (Phase 5E): An empty `wsResultMeta` object is truthy, so the section header and empty table rendered even with no populated fields. Fixed to check for at least one populated field before rendering the section.

6. **`buildErrorResult` didn't propagate `dataRowId`, `dataRowLabel`, or `transportType`** (Phase 5A/5C cross-cutting): Early errors in WS/Kafka execution (missing config, missing connectionRef) produced results without `dataRowId`/`dataRowLabel` (losing row attribution) and without `transportType` (causing `computeMetrics` to miscount them as HTTP errors via `httpStatus=0`). Fixed to propagate all three fields from the scenario.

**Design limitations documented (not fixed — require architectural changes):**

- `ws.header.*` assertions: execution engine passes `responseHeaders: {}` because WS proxy doesn't capture upgrade handshake headers. Known limitation.
- Queue shuffle in executor: can break WS connect→send→receive ordering in multi-test scenarios. Pre-existing design limitation.
- Column mapper doesn't scan WS action fields: `parseScenarioTemplate()` only scans HTTP fields. Future enhancement for Phase 5F+.
- Standalone send/receive via `url` (auto-connect): documented in types but not implemented in UI or engine. Deferred feature.

**Verification:**

- TypeScript: **0 errors** (`npx tsc -b --noEmit`)
- Linter: **0 errors** across all modified files
- Tests: **415 tests passed** across 12 test files (all Phase 5 affected files)

#### Phase 5 Second Review Pass (additional fixes)

A second thorough re-evaluation confirmed all previous fixes are correct and aligned, then identified and fixed 3 additional issues:

1. **WsScenarioEditor warning text inaccuracy** (Phase 5D): When sibling `wsConnect` tests exist but lack a `connectionId`, the warning incorrectly said "No wsConnect tests found." Fixed to display a contextual message: "Sibling wsConnect tests exist but have no Connection ID set." vs "No wsConnect tests found" when none exist at all.

2. **Method badge inconsistency in `ResultsRequestDetailsTab` and `WorkflowResultsSummary`** (Phase 5E): Both components used raw `r.method` (e.g. `WEBSOCKET`, `KAFKA`) for method badge text instead of `getTransportMethodLabel(r)` (e.g. `CONNECT`, `PRODUCE`). `ResponseDetailModal` was already fixed; these two were missed. Now all result-rendering components consistently use transport-aware method labels.

3. **`runBaselines.groupByScenario` didn't exclude cancelled results** (Phase 5E): Unlike `computeMetrics` which filters `!r.cancelled`, the baseline per-scenario grouping included cancelled results in count and error rate. A cancelled non-HTTP result with `passed: false` would inflate per-scenario error rates. Fixed to `continue` on `r.cancelled`.

**Verification:**

- TypeScript: **0 errors** (`npx tsc -b --noEmit`)
- Linter: **0 errors** across all modified files
- Tests: **416 tests passed** across 12 test files

#### Phase 5 Third Review Pass (final fixes)

A third review pass confirmed all previous 12 fixes are correct, then identified and fixed 3 more issues:

1. **Stale `wsResultMeta` on send+wait failure** (Phase 5A): When `wsSend` with `waitForResponse` succeeds the send but the `waitForMessage` throws (e.g. timeout), the catch block set `httpStatus: 0` and `errorMessage` but left `wsResultMeta` with the send-time `messageSize` and no `frameType`. This was misleading in the results UI. Fixed to clear `messageSize` and `frameType` on error, preserving only `connectionId` for debugging.

2. **`failedInWindow` didn't exclude cancelled results** (Phase 5E): `trackResult` and `computeMetrics` both skip `r.cancelled`, but the time-series `failedInWindow` calculation didn't. Cancelled HTTP results (with `httpStatus === 0`) would inflate the time-series error rate during aborted runs. Fixed to filter cancelled from the window before computing error percentage.

3. **`computePerScenarioTrend` counted cancelled results in scenario ranking** (Phase 5E): The top-N scenario ranking loop included cancelled results in request counts, skewing which scenarios appeared in trend charts. Fixed to `continue` on `r.cancelled`.

**Verification:**

- TypeScript: **0 errors** (`npx tsc -b --noEmit`)
- Linter: **0 errors** across all modified files
- Tests: **416 tests passed** across 12 test files

#### Phase 5 Fourth Review Pass (critical save bug + expander gaps)

A fourth review pass confirmed all 15 prior fixes are correct, then identified and fixed 3 more issues:

1. **`saveTest` silently no-ops for WS/Kafka tests** (Phase 5D, **critical**): `useScenarioMutations.saveTest` guarded on `draft.url.trim()`, which is empty for WS tests (they store URL in `wsConnectAction.url`). The `canSave` fix from Round 1 correctly enabled the Save button, but clicking it did nothing. Fixed to skip the `draft.url` check for non-HTTP transports (`isWsActionType` or Kafka).

2. **`dataSourceExpander` missing `matchCriteria` substitution fields** (Phase 5C): The WS receive `matchCriteria` expansion only substituted `contentContains` and `jsonPathValue`, but not `contentRegex` or `jsonPathMatch`. Parameterized tests using regex or JSONPath match criteria with `{{variable}}` placeholders would not expand. Fixed to substitute all four `matchCriteria` string fields.

3. **`dataSourceExpander` `wsConnectAction.url` crash risk** (Phase 5C): Investigated but determined to be a non-issue — `WsConnectActionConfig.url` is a required `string` field, so `substituteVariables` always receives a valid string.

**Known design limitations documented (not bugs):**
- `ws.header.*` assertions: always fail at runtime because `wsExecution` passes empty `responseHeaders` (WS upgrade headers not captured by proxy layer). Documented since Round 1.
- `validateWsActionConfig` accepts url-only configs but `wsExecution` requires `connectionRef`: auto-connect is a planned future feature.
- `TestEditorModal` import validation rejects WS/Kafka tests without top-level `url`: pre-existing import gap, not Phase 5 scope.
- `computeMetrics.totalRequests` includes cancelled while `successfulRequests` excludes them: pre-existing metrics design affecting pass-rate calculations, not Phase 5 specific.

**Verification:**

- TypeScript: **0 errors** (`npx tsc -b --noEmit`)
- Linter: **0 errors** across all modified files
- Tests: **573 tests passed** across 16 test files

---

### Phase 5F — Data Mapper & Export/Import

> **Goal:** Data Mapper adapter for visual WebSocket message extraction, and correct export/import round-trip for WS scenarios.

#### 5F.1 — WS Extraction Adapter

- [ ] `wsExtractionAdapter`: implements `MapperAdapter<Extraction[]>`:
  - `contextId: 'ws-extraction-{scenarioId}'`
  - `title: 'WebSocket Message Extraction'`
  - `category: 'messaging'`
  - `sources`: single source from last received WS message body (JSON)
  - `target`: extraction variable names
  - `fetchSampleData()`: use captured frame from WS Studio or saved profile to fetch sample
  - `serialize()`: mappings → `Extraction[]` (same format as HTTP extractions)
  - `deserialize()`: `Extraction[]` → mappings
- [ ] Wire into extraction editor when `actionType` is WS
- [ ] File: `src/shared/components/data-mapper/adapters/wsExtractionAdapter.ts` (NEW)
- [ ] Tests: `src/shared/components/data-mapper/adapters/wsExtractionAdapter.test.ts` (NEW)

#### 5F.2 — Export/Import Normalization

- [ ] WS action config fields export automatically (generic JSON serialization)
- [ ] Add import validation: `validateWsActionConfig()` on imported WS scenarios
- [ ] Update `normalizeTestFields()` if WS-specific legacy field aliases emerge
- [ ] **`TestDefinitionSnapshot` gap**: Currently `HttpDefinitionSnapshotBase` only captures HTTP fields (name, url, method, headers, body, auth) — has no `actionType`, no Kafka config, no WS config. This means version history/diff cannot track transport config changes. Extend `TestDefinitionSnapshot` in `src/shared/types/index.ts` to include `actionType?` and transport-specific config fields. This also benefits Kafka (currently untracked in versioning)
- [ ] Update `generateHttpChangeSummary()` in `definitionVersioning.ts` to handle WS/Kafka action config diffs (or create a transport-aware equivalent)
- [ ] File: `src/features/scenarios/utils/scenarioImportExport.ts` (MODIFY), `src/shared/types/index.ts` (MODIFY), `src/shared/utils/definitionVersioning.ts` (MODIFY)

#### 5F Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/components/data-mapper/adapters/wsExtractionAdapter.ts` | NEW | DM adapter for WS messages (pattern: `webhookExtractionAdapter.ts`) |
| `src/shared/components/data-mapper/adapters/wsExtractionAdapter.test.ts` | NEW | Adapter tests |
| `src/features/scenarios/utils/scenarioImportExport.ts` | MODIFY | Import validation for WS scenarios |
| `src/shared/utils/definitionVersioning.ts` | MODIFY | Transport-aware snapshot diff (extend beyond HTTP-only) |

---

### Phase 5 — Connection Lifecycle in Harness

Unlike workflow execution (Phase 4) where `wsConnect` opens a connection that persists across nodes, harness execution treats each `Scenario` as independent. However, WS scenarios within the same `TestScenario` may chain via `connectionRef`:

```
TestScenario "Chat flow"
  ├── Test 1: wsConnect (url: wss://chat.example.com, creates connection "chat")
  ├── Test 2: wsSend   (connectionRef: "chat", message: {"type":"join","room":"general"})
  ├── Test 3: wsReceive (connectionRef: "chat", match: {"type":"joined"}, timeout: 5000)
  └── Test 4: wsSend   (connectionRef: "chat", message: {"type":"message","text":"hello"})
```

Connection lifecycle:
1. `wsConnect` test → opens connection, stores in `WsNodeOperations` registry
2. `wsSend`/`wsReceive` tests with `connectionRef` → reuse the connection
3. Standalone `wsSend`/`wsReceive` (no `connectionRef`) → auto-connect, use, and disconnect
4. On test group completion → `wsOperations.disconnectAll()` cleanup

This design reuses the same `WsNodeOperations` interface and `buildWsNodeOperations()` factory from Phase 4.

### Phase 5 — Design Decisions

| Decision | Rationale |
|---|---|
| **Reuse `WsNodeOperations` from Phase 4** | Same proxy dispatch, same connection registry. Avoids duplicate infrastructure. |
| **`executeNonHttp` hook (same as Kafka)** | `requestExecution.ts` is already transport-agnostic via this callback. No need to fork the dispatcher. |
| **`wsField` assertion type (not generalize `kafkaField`)** | Cleaner separation; different target sets. Generalization can happen later if warranted. |
| **`connectionRef` for chaining** | Simpler than implicit connection sharing; user explicitly names connections. |
| **Auto-connect for standalone send/receive** | Users shouldn't need a separate connect test for simple one-shot WS tests. |
| **Unified `RequestResult` shape** | WS populates `responseBody`, `responseTimeMs`, `transportType`, and `wsResultMeta` — same pipeline as HTTP and Kafka. |
| **Fix worker/Rust paths proactively** | Kafka has the same broken worker path; fixing it for WS fixes Kafka too. |
| **Transport label helper** | Eliminates scattered ternary chains; single source of truth for all transport display labels. |
| **Separate `wsNumericField` assertion type** | Keeps `wsField` string-based (consistent with `kafkaField`/`header`); numeric WS targets (`latencyMs`, `size`) use `ComparisonOperator` consistent with existing `numeric` assertion type. |
| **`method: 'WEBSOCKET'` on Scenario** | Follows Kafka precedent (`method: 'KAFKA'`); `method` carries transport category, `actionType` carries specific variant. Both discriminants serve different consumers. |
| **Types in `src/shared/types/websocket.ts`** | Harness-specific types (action configs, assertion targets, result meta) live here; Studio types stay in `src/shared/websocket/types.ts`. Shared types (`WsTlsConfig`, `WsKeyValueEntry`) are imported/re-exported. |
| **Transport-aware `buildValidationResult`** | Adding `transportType` parameter to skip HTTP failure checks benefits both WS and Kafka (latent Kafka bug). |
| **Greenfield transport selector (Kafka + WS)** | `TestEditorModal` is HTTP-only today. Building the transport selector adds Kafka editor support as a side effect — not just WS. |

### Phase 5 Success Criteria

- [x] `wsConnect`, `wsSend`, `wsReceive` action types selectable in scenario editor ✅ (5D)
- [x] Greenfield transport selector in `TestEditorModal` with conditional config panels (HTTP, Kafka, WS) ✅ (5D)
- [x] `WsScenarioEditor` renders URL, headers, message, match criteria fields per WS action type ✅ (5D)
- [x] Feature Group can contain mixed HTTP + Kafka + WebSocket scenarios ✅ (5A/5B)
- [x] Test Runner executes WebSocket scenarios via `executeNonHttp` → `executeWsAction` ✅ (5B)
- [x] Connection chaining: `connectionRef` allows sequential WS tests to share a connection ✅ (5B)
- [ ] Standalone WS tests auto-connect and disconnect — **Deferred**: types support `url` on send/receive, but UI and execution require `connectionRef`
- [x] `wsField` assertions evaluate `ws.body`, `ws.type`, `ws.protocol`, `ws.connectionId`, `ws.header.*`, `ws.$.jsonpath` (string operators) ✅ (5C)
- [x] `wsNumericField` assertions evaluate `ws.latencyMs`, `ws.size` (numeric operators: `<`, `>`, `<=`, `>=`, `=`, `!=`) ✅ (5C)
- [x] Custom expressions resolve `ws.*` paths (e.g., `ws.body`, `ws.latencyMs`, `ws.protocol`) ✅ (5C)
- [x] `wsField` + `wsNumericField` assertion presets in add-assertion menu (transport-conditional visibility) ✅ (5D)
- [x] `AssertionRowEditor` renders `wsField`, `wsNumericField`, and `kafkaField` assertions with target selectors ✅ (5D)
- [x] Parameterized WebSocket scenarios: CSV rows interpolate into URL, message, assertion values ✅ (5B)
- [x] Data source expansion covers `wsConnectAction`, `wsSendAction`, `wsReceiveAction` fields with correct column type policy ✅ (5B)
- [x] Results page renders WS results with transport-aware labels (CONNECT/SEND/RECEIVE) ✅ (5E)
- [x] Response detail modal shows WS metadata (URL, frame type, protocol, latency) ✅ (5E)
- [x] Report generator includes WS results with correct labels ✅ (5E)
- [x] Worker execution path correctly routes WS (and Kafka) via `executeNonHttp` for ALL execution modes (not just workflow) ✅ (5B)
- [x] Rust executor guard (`canUseRustExecutor` in `rustBridge.ts`) excludes WS and Kafka scenarios ✅ (5B)
- [x] `buildValidationResult` skips HTTP-specific failure checks for non-HTTP transport (fixes Kafka latent bug) ✅ (5C)
- [ ] `wsExtractionAdapter` for Data Mapper visual extraction from WS messages — **Phase 5F (pending)**
- [ ] Extraction editor in `TestEditorModal` swaps to `wsExtractionAdapter` for WS scenarios — **Phase 5F (pending)**
- [ ] Export/import round-trip preserves WS action configs and assertions — **Phase 5F (pending)**
- [ ] Import validation for WS scenarios via `validateWsActionConfig()` — **Phase 5F (pending)**
- [ ] `TestDefinitionSnapshot` extended with `actionType` and transport config (versioning) — **Phase 5F (pending)**
- [x] `Scenario.method` union includes `'WEBSOCKET'` ✅ (5A)
- [x] Circuit breaker correctly handles WS failure semantics ✅ (5B — uses `result.passed`)
- [x] Unit test coverage >90% ✅ (573+ tests across 5A–5E)

### Phase 5 — Kafka Parity Benefits

Several Phase 5 changes fix existing Kafka issues as a side effect:

| Fix | Kafka Issue | WS Benefit |
|---|---|---|
| Worker ops build (5B.4) | Kafka harness scenarios broken in worker mode | WS harness scenarios work in worker mode |
| Rust executor guard (5B.5) | Kafka scenarios not excluded from Rust executor | WS scenarios correctly excluded |
| HTTP status skip (5C.4) | Kafka failures get spurious `(http)` failure detail | WS failures don't get HTTP artifacts |
| `kafkaField` UI (5D.4) | `kafkaField` assertions have no rendering branch | Both `kafkaField` and `wsField` rendered |
| Assertion presets (5D.3) | No Kafka presets in assertion menu | Both Kafka and WS presets added |
| Transport selector (5D.1) | No Kafka scenario authoring UI | Both Kafka and WS authoring UI |
| `TestDefinitionSnapshot` (5F.2) | Kafka transport config not in version snapshots | Both transports tracked in versioning |

### Phase 5 All Files Summary

#### New Files (16 — actual, includes test files discovered during implementation)

| File | Sub-Phase | Status | Purpose |
|---|---|---|---|
| `src/shared/types/websocket.ts` | 5A | ✅ | WsActionType, ScenarioActionType, action configs, WsResultMeta, WsAssertionTarget, WsNumericAssertionTarget; re-exports from Studio |
| `src/shared/types/websocket.test.ts` | 5A | ✅ | 73 type contract + helper guard tests |
| `src/shared/utils/wsScenarioDefaults.ts` | 5A | ✅ | Default factories, `isWsScenario`, validation, type resolution |
| `src/shared/utils/wsScenarioDefaults.test.ts` | 5A | ✅ | 80 defaults + validation tests |
| `src/engine/wsExecution.ts` | 5B | ✅ | WS action dispatcher (connect/send/receive → RequestResult, 337 lines) |
| `src/engine/wsExecution.test.ts` | 5B | ✅ | 35 execution tests |
| `src/engine/wsAssertionEvaluation.test.ts` | 5C | ✅ | 59 assertion tests (wsField, wsNumericField, custom ws.* paths, transportType) |
| `src/features/scenarios/components/WsScenarioEditor.tsx` | 5D | ✅ | WS-specific scenario config panel (connect/send/receive modes) |
| `src/features/scenarios/components/WsScenarioEditor.test.tsx` | 5D | ✅ | 24 editor tests |
| `src/features/scenarios/components/testEditorValidationAddMenu.test.ts` | 5D | ✅ | 14 transport filter + preset tests |
| `src/features/requests/components/ResponseDetailModal.test.tsx` | 5E | ✅ | 25 HTTP/WS/Kafka rendering tests |
| `src/shared/components/data-mapper/adapters/wsExtractionAdapter.ts` | 5F | ⬜ | WS message extraction adapter |
| `src/shared/components/data-mapper/adapters/wsExtractionAdapter.test.ts` | 5F | ⬜ | Adapter tests |

#### Modified Files (24 — actual, includes files discovered during implementation and review passes)

| File | Sub-Phase | Status | Change |
|---|---|---|---|
| `src/shared/types/index.ts` | 5A | ✅ | Scenario (actionType → ScenarioActionType, method +'WEBSOCKET', +3 WS action fields), RequestResult (+wsResultMeta), Assertion (+wsField, +wsNumericField), TestDefinitionSnapshot, `export * from './websocket'` |
| `src/shared/utils/kafkaScenarioDefaults.ts` | 5A | ✅ | `resolveKafkaActionType` return type widened to `ScenarioActionType` |
| `src/engine/executor.ts` | 5B | ✅ | Extend executeNonHttp to dispatch WS + Kafka; `disconnectAll()` cleanup in try/finally |
| `src/engine/dataSourceExpander.ts` | 5B | ✅ | WS action + assertion field interpolation (body-type column vars) |
| `src/engine/executionWorker.ts` | 5B | ✅ | Build WS + Kafka ops unconditionally for ALL execution modes |
| `src/features/test-runner/utils/rustBridge.ts` | 5B | ✅ | Exclude non-HTTP from `canUseRustExecutor()` |
| `cli/reporters.ts` | 5B | ✅ | WS-aware transport labels in JUnit/Console/Markdown reporters |
| `cli/reporters.console.test.ts` | 5B | ✅ | Updated test expectations for new label format |
| `src/engine/validator.ts` | 5C | ✅ | wsField + wsNumericField in evaluateAssertions, ws.* in resolveVariable, wsContext on AssertionContext |
| `src/engine/validationResult.ts` | 5C | ✅ | wsContext passthrough, transportType-aware HTTP status skip (fixes Kafka bug) |
| `src/engine/kafkaExecution.ts` | 5C | ✅ | Pass transportType to buildValidationResult (Kafka `(http)` failure bug fix) |
| `src/features/scenarios/components/TestEditorModal.tsx` | 5D | ✅ | Greenfield transport selector + conditional panel rendering |
| `src/features/scenarios/utils/testEditorUtils.ts` | 5D | ✅ | emptyTest() accepts optional action type |
| `src/features/scenarios/components/testEditorValidationAddMenu.ts` | 5D | ✅ | WS + Kafka assertion presets with transport-conditional visibility |
| `src/features/scenarios/components/AssertionRowEditor.tsx` | 5D | ✅ | wsField + wsNumericField + kafkaField rendering branches |
| `src/features/scenarios/components/testEditorValidationConstants.ts` | 5D | ✅ | Badge labels for wsField, wsNumericField, kafkaField |
| `src/features/scenarios/components/TestEditorValidationTab.tsx` | 5D | ✅ | Transport filter applied to assertion menu + empty-state |
| `src/features/results/utils/transportStatus.ts` | 5E | ✅ | Added `getTransportMethodLabel()`, `isHttpResult()`, `getTransportFamily()` |
| `src/features/requests/components/ResponseDetailModal.tsx` | 5E | ✅ | Transport-aware status badge, WS/Kafka details panels |
| `src/features/results/utils/reportGenerator.ts` | 5E | ✅ | JSON failedRowDetails includes transportType + transportStatus |
| `src/engine/metrics.ts` | 5E | ✅ | Transport guard: non-HTTP failures via `!r.passed` |
| `src/features/results/components/ResultsMetricsCards.tsx` | 5E | ✅ | Transport-aware error rate tooltip |
| `src/features/test-runner/hooks/useTestExecution.ts` | 5E | ✅ | `trackResult` + `failedInWindow` transport-aware counting |
| `src/features/results/utils/runBaselines.ts` | 5E | ✅ | Per-scenario non-HTTP error counting + cancelled filter |
| `src/features/results/components/ResultsRequestDetailsTab.tsx` | 5E | ✅ | Transport method label via `getTransportMethodLabel()` |
| `src/features/results/components/WorkflowResultsSummary.tsx` | 5E | ✅ | Transport method label via `getTransportMethodLabel()` |
| `src/features/results/utils/reportGenerator.ts` | 5E | ✅ | JSON failedRowDetails includes transportType + transportStatus |
| `src/features/results/utils/reportGenerator.test.ts` | 5E | ✅ | 7 WS/Kafka/JSON transport tests |
| `src/features/results/utils/transportStatus.test.ts` | 5E | ✅ | 14 new helper tests |
| `src/engine/metrics.test.ts` | 5E | ✅ | 4 WS/Kafka/mixed metrics tests |
| `src/features/test-runner/hooks/useTestExecution.execute.test.ts` | 5E | ✅ | Updated wsManager argument expectations |
| `src/features/scenarios/utils/testEditorUtils.test.ts` | 5D | ✅ | 7 emptyTest() action type tests |
| `src/features/scenarios/components/testEditorValidationConstants.test.ts` | 5D | ✅ | Badge label tests for new types |
| `src/features/scenarios/components/AssertionRowEditor.test.tsx` | 5D | ✅ | 12 wsField/wsNumericField/kafkaField tests |
| `src/features/scenarios/utils/scenarioImportExport.ts` | 5F | ⬜ | Import validation for WS scenarios |
| `src/shared/utils/definitionVersioning.ts` | 5F | ⬜ | Transport-aware snapshot diff |

**Note:** `src/shared/utils/scenarioMigration.ts` was NOT modified — existing `normalizeScenarioActionType()` handles WS types correctly without changes.

---

## Phase 6 — Tauri Native Transport

> **Goal:** Desktop app uses native `tokio-tungstenite` for WebSocket connections, eliminating the dependency on the Express server proxy for Tauri builds. This follows the same pattern established by the Kafka Tauri module.

### Phase 6 Rationale

Today, WebSocket Studio on Tauri desktop relies on the Express server proxy (`/api/ws/*`) for all operations — connect, send, poll messages. This has several limitations:

1. **Extra process dependency** — Tauri desktop must bundle and run the Express server
2. **Polling latency** — Messages are polled every 200ms instead of being pushed via events
3. **TLS indirection** — TLS certificates are handled by Node.js `https.Agent`, not native Rust
4. **No offline capability** — Cannot use WebSocket Studio without the Express server running

Phase 6 replaces the Express proxy with native Rust `tokio-tungstenite` commands, matching the proven pattern used by the Kafka native module (`src-tauri/src/kafka/`).

| Aspect | Kafka Module (Reference) | WebSocket Phase 6 |
|---|---|---|
| **Rust crate** | `rdkafka` | `tokio-tungstenite` + `tokio-rustls` |
| **State** | `KafkaState` — `Mutex<HashMap<ClusterId, ClientHandle>>` | `WsState` — `Mutex<HashMap<String, ConnectionHandle>>` |
| **Commands** | `kafka_connect`, `kafka_produce`, etc. | `ws_connect`, `ws_send`, etc. |
| **Events** | `kafka-subscription-message` | `ws-message` |
| **TS Bridge** | `kafkaNativeTauriTransport.ts` + `setKafkaClientTransport()` | `websocketNativeTauriTransport.ts` + `setWsClientTransport()` |
| **Registration** | `main.tsx`: `setKafkaClientTransport(kafkaNativeTauriTransport)` | `main.tsx`: `setWsClientTransport(wsNativeTauriTransport)` |
| **Envelope** | `Result<Value, String>` + `success_envelope`/`error_envelope` | Same pattern |
| **TLS** | `KafkaTlsConfig` → `apply_tls_config()` | `WsTlsConfig` → `build_ws_connector()` |

### Phase 6 Scope

- Rust `tokio-tungstenite` WebSocket client in Tauri (9 new Rust files)
- Tauri commands: `ws_connect`, `ws_disconnect`, `ws_send`, `ws_ping`, `ws_receive_next`, `ws_status` (6 commands)
- Background read loop with `ws-message` Tauri event emission (replaces 200ms polling)
- Custom TLS certificate support via native Rust (`rustls` — consistent with `reqwest`, not with Kafka's OpenSSL)
- Major `websocketClient.ts` refactor: extract `defaultHttpTransport`, add `WsClientTransport`/`setWsClientTransport()` infrastructure
- `main.tsx` wiring for automatic native transport on Tauri desktop
- WebSocket Studio integration: event-driven messages on Tauri (no polling), protocol auto-respond in event path
- Transport selection logic: native Tauri replaces proxy for all WS operations on desktop; `transportMode: 'native'` added
- Transport parity tests (Express proxy vs Tauri native produce identical results)
- Connection pool management in Rust (multiple concurrent connections with `CancellationToken`)
- Error codes aligned with server `contracts.ts` (not original plan shorthand)
- Ping/pong validation with split-stream architecture

### Phase 6 Sub-Phases

| Sub-Phase | Scope | Dependencies |
|---|---|---|
| **6A** — Rust Module Foundation | Types (aligned with `contracts.ts`), envelope (`pub(super)`), state, `mod.rs`, `Cargo.toml`, `lib.rs` registration | Phase 1 (types alignment) |
| **6B** — Rust Lifecycle & TLS | `ws_connect` (with URL validation + ping/pong spike), `ws_disconnect`, `ws_status`, TLS config builder | 6A |
| **6C** — Rust Operations & Events | `ws_send`, `ws_ping`, background read loop, `ws-message`/`ws-connection-closed` events, `ws_receive_next`, optional idle GC | 6B |
| **6D** — TypeScript Bridge | `websocketNativeTauriTransport.ts`, major `websocketClient.ts` refactor (`WsClientTransport`, `setWsClientTransport()`), `main.tsx` wiring | 6C |
| **6E** — Studio Integration & Parity | `useWebSocketStudio` event-driven mode, protocol auto-respond in events, transport selection (`'native'` mode), TLS/Connect panel updates, parity tests | 6D |

---

### Phase 6A — Rust Module Foundation

> **Goal:** Establish the Rust module structure, types, envelope helpers, and state management — mirroring `src-tauri/src/kafka/` exactly.

#### 6A.1 — Cargo Dependencies

- [ ] Add to `src-tauri/Cargo.toml`:
  ```toml
  tokio-tungstenite = { version = "0.28", features = ["rustls-tls-native-roots"] }
  rustls-pemfile = "2"
  ```
- [ ] **Version note**: `tokio-tungstenite` version must be `0.28` (not `0.24` from original plan). The Tauri lockfile already includes `0.28` and `0.29` from Tauri plugins (`tauri-plugin-http`, `tauri-plugin-websocket`). Using `0.28` avoids incompatible `rustls`/`tungstenite` version conflicts
- [ ] **`rustls-pemfile`**: Required for PEM cert loading in `config.rs` (6B.1). Crate version `2` works with current `rustls` in the Tauri dependency tree
- [ ] `tokio-tungstenite` uses `rustls` by default — consistent with `reqwest`'s TLS stack in this project
- [ ] File: `src-tauri/Cargo.toml` (MODIFY)

#### 6A.2 — Module Declaration

- [ ] Create `src-tauri/src/websocket/mod.rs` with sub-module declarations:
  ```rust
  pub mod commands;
  pub mod config;
  pub mod envelope;
  pub mod lifecycle;
  pub mod message;
  pub mod operations;
  pub mod state;
  pub mod types;
  ```
- [ ] Add `mod websocket;` to `src-tauri/src/lib.rs`
- [ ] Files: `src-tauri/src/websocket/mod.rs` (NEW), `src-tauri/src/lib.rs` (MODIFY)

#### 6A.3 — Rust Types (aligned with `contracts.ts`)

- [ ] `WsConnectRequest` (input): `url`, `headers`, `subprotocols`, `tls` (NOT `tls_config` — server contracts use `tls`), `timeout_ms`
- [ ] `WsDisconnectRequest`: `connection_id`, `code`, `reason`
- [ ] `WsSendRequest`: `connection_id`, `data` (NOT `message` — server contracts use `data`), `message_type` (`type` via serde alias)
- [ ] `WsPingRequest`: `connection_id`
- [ ] `WsReceiveRequest`: `connection_id`, `timeout_ms`
- [ ] `WsStatusRequest`: `connection_id`
- [ ] `WsTlsConfig`: `reject_unauthorized`, `ca_cert`, `client_cert`, `client_key` (align with `contracts.ts` camelCase naming via serde `rename_all`, not Kafka's `ca_pem`/`cert_pem`/`key_pem`)
- [ ] `WsConnectResult` (output): `connection_id`, `protocol`, `extensions`, `latency_ms`
- [ ] `WsMessagePayload` (event): `connection_id`, `data`, `message_type`, `timestamp`
- [ ] `WsConnectionClosedPayload` (event): `connection_id`, `code`, `reason`
- [ ] `WsStatusResult`: `state`, `url`, `connected_since`, `uptime_ms`, `sent_count`, `received_count`, `close_code` (richer shape matching server's `WsProxyStatusResult` for parity)
- [ ] All input types: `#[derive(Deserialize)] #[serde(rename_all = "camelCase")]`
- [ ] All output types: `#[derive(Serialize)] #[serde(rename_all = "camelCase")]`
- [ ] File: `src-tauri/src/websocket/types.rs` (NEW)

#### 6A.4 — Envelope Helpers

- [ ] `success_envelope(op, data, duration_ms)` → `Value` with `{ ok: true, op, data, meta: { durationMs, timestamp } }`
- [ ] `error_envelope(op, code, message, retryable)` → `Value` with `{ ok: false, op, error: { code, message, retryable }, meta: { timestamp } }`
- [ ] Include `meta.timestamp` (ISO string) — server's `WsEnvelopeMeta` includes `timestamp` and optional `requestId`/`durationMs`
- [ ] **Note**: Kafka's `envelope.rs` marks these as `pub(super)` (not crate-public) — follow same visibility
- [ ] Error codes aligned with `contracts.ts` (server uses these exact strings):
  - `WS_INVALID_URL` — malformed WebSocket URL
  - `WS_CONNECT_TIMEOUT` — connection timeout exceeded
  - `WS_CONNECT_FAILED` — connection refused or network error (NOT `WS_CONNECT_ERROR`)
  - `WS_NOT_FOUND` — connection_id not in state
  - `WS_NOT_CONNECTED` — connection exists but disconnected
  - `WS_SEND_FAILED` — write channel closed or frame error (NOT `WS_SEND_ERROR`)
  - `WS_RECEIVE_TIMEOUT` — `ws_receive_next` timeout
  - `WS_TLS_ERROR` — certificate/TLS handshake failure (new for native; server wraps in `WS_CONNECT_FAILED`)
- [ ] **Removed**: `WS_ALREADY_CONNECTED` — not in server contracts; allow multiple connections per URL
- [ ] Follow Kafka's philosophy: `Result<Value, String>` where app errors return `Ok(error_envelope(...))` and only mutex poison returns `Err`
- [ ] File: `src-tauri/src/websocket/envelope.rs` (NEW)

#### 6A.5 — Connection State

- [ ] `WsState`:
  ```rust
  pub struct WsState {
      pub inner: Mutex<HashMap<String, ConnectionHandle>>,
  }
  ```
- [ ] `ConnectionHandle`:
  ```rust
  pub struct ConnectionHandle {
      pub url: String,
      pub connected_since: Instant,
      pub messages_sent: AtomicU64,
      pub messages_received: AtomicU64,
      pub write_tx: mpsc::Sender<WsOutboundMessage>,           // channel to write half
      pub broadcast_tx: broadcast::Sender<WsInboundMessage>,   // for ws_receive_next consumers
      pub cancel_token: CancellationToken,                      // stops read loop
      pub protocol: Option<String>,
  }
  ```
- [ ] Design: The WebSocket connection is split into read/write halves. The write half is driven via an `mpsc` channel (sender stored in handle, receiver consumed by write loop). The read half runs in a `tokio::spawn` loop that both emits `ws-message` events (for Studio UI) and sends to `broadcast_tx` (for `ws_receive_next` callers). The `broadcast::channel(256)` allows multiple concurrent receivers without state contention.
- [ ] `WsState::new()` → empty `HashMap`
- [ ] Register in `lib.rs`: `.manage(WsState::new())`
- [ ] File: `src-tauri/src/websocket/state.rs` (NEW), `src-tauri/src/lib.rs` (MODIFY)

#### 6A.6 — Commands Module (Tests Only)

- [ ] `commands.rs` — **NOT a re-export surface** (contrary to original plan assumption). Kafka's `commands.rs` only contains integration test comments. `lib.rs` registers commands via **direct module paths** (`websocket::lifecycle::ws_connect`, etc.), not through re-exports
- [ ] Use `commands.rs` for cross-module integration tests (same as Kafka pattern)
- [ ] File: `src-tauri/src/websocket/commands.rs` (NEW — integration test file)

#### 6A.7 — Command Registration

- [ ] Add to `lib.rs` `generate_handler!` using **direct module paths** (NOT via `commands.rs` re-exports — this is how Kafka does it):
  ```rust
  websocket::lifecycle::ws_connect,
  websocket::lifecycle::ws_disconnect,
  websocket::lifecycle::ws_status,
  websocket::operations::ws_send,
  websocket::operations::ws_ping,
  websocket::operations::ws_receive_next,
  ```
- [ ] Add `.manage(websocket::state::WsState::new())`
- [ ] **Note**: 6 commands (Kafka has 9: connect, disconnect, status, topics, produce, consume_once, subscribe, unsubscribe, subscriptions). WS is simpler — no topic listing, no subscription management. `ws_ping` added per 6C.5
- [ ] File: `src-tauri/src/lib.rs` (MODIFY)

#### 6A.8 — Tauri Capabilities/Permissions

- [ ] Add WebSocket command permissions to `src-tauri/capabilities/default.json`:
  ```json
  "websocket:allow-ws-connect",
  "websocket:allow-ws-disconnect",
  "websocket:allow-ws-send",
  "websocket:allow-ws-ping",
  "websocket:allow-ws-receive-next",
  "websocket:allow-ws-status"
  ```
- [ ] **Missing step from original plan**: Without explicit permissions, `invoke('ws_connect', ...)` will fail with a Tauri permission error at runtime. This mirrors how Kafka commands required explicit permissions in `default.json`
- [ ] File: `src-tauri/capabilities/default.json` (MODIFY)

#### 6A Files

| File | Action | Purpose |
|---|---|---|
| `src-tauri/Cargo.toml` | MODIFY | Add `tokio-tungstenite` + `rustls-pemfile` dependencies |
| `src-tauri/src/websocket/mod.rs` | NEW | Module tree declaration |
| `src-tauri/src/websocket/types.rs` | NEW | Rust types aligned with `contracts.ts` (field names: `tls`, `data`, `message_type`) |
| `src-tauri/src/websocket/envelope.rs` | NEW | Success/error envelope helpers (`pub(super)` visibility) |
| `src-tauri/src/websocket/state.rs` | NEW | `WsState` + `ConnectionHandle` + `broadcast::Sender` for `ws_receive_next` |
| `src-tauri/src/websocket/commands.rs` | NEW | Integration tests only (NOT re-exports — follows Kafka pattern) |
| `src-tauri/src/lib.rs` | MODIFY | `mod websocket`, `.manage()`, `generate_handler!` with direct paths |
| `src-tauri/capabilities/default.json` | MODIFY | Add `websocket:allow-ws-*` permissions (6 commands) |

---

### Phase 6B — Rust Lifecycle & TLS

> **Goal:** Implement `ws_connect`, `ws_disconnect`, `ws_status` commands with full TLS support via `rustls`.

#### 6B.1 — TLS Config Builder

- [ ] `build_ws_connector(tls_config: Option<&WsTlsConfig>)`:
  - When TLS config absent or all defaults → use `tokio-tungstenite`'s default `connect_async`
  - When custom CA cert → add to `rustls` `RootCertStore` via `rustls_pemfile::certs()`
  - When client cert + key → add to `rustls` `ClientConfig` via `with_client_auth_cert()`
  - When `reject_unauthorized: false` → custom `ServerCertVerifier` that accepts all certs (dangerous)
  - PEM format only (consistent with Express proxy's `https.Agent`; drop PKCS12 from scope)
- [ ] File: `src-tauri/src/websocket/config.rs` (NEW)

#### 6B.2 — `ws_connect` Command

- [ ] Signature: `pub async fn ws_connect(app: AppHandle, state: State<'_, WsState>, request: WsConnectRequest) -> Result<Value, String>` — **`AppHandle` is first arg** because `ws_connect` spawns the read loop that calls `app.emit()` (same pattern as Kafka's `kafka_subscribe`)
- [ ] Flow:
  1. Validate URL → `WS_INVALID_URL` if malformed
  2. Generate `connection_id` via `uuid::Uuid::new_v4()`
  3. Build TLS connector from `request.tls` (note: field is `tls`, not `tls_config`)
  4. Build request with `tokio_tungstenite::connect_async_tls_with_config()` with URL, headers, subprotocols
  5. Wrap with `tokio::time::timeout()` for connection timeout
  6. Measure connection latency (`Instant::now()`)
  7. Split connection into `(write, read)` halves via `StreamExt::split()`
  8. Create `mpsc::channel` for outbound messages
  9. Spawn read loop: `tokio::spawn` with `CancellationToken` + `select!`
  10. Spawn write loop: consumes `mpsc::Receiver`, forwards to `write` half
  11. Store `ConnectionHandle` in `WsState` (lock mutex once, brief hold)
  12. Return `success_envelope("connect", WsConnectResult { connection_id, protocol, latency_ms })`
- [ ] **Ping/pong caveat**: With split streams, tungstenite queues pong responses when reading, but pongs only flush through the write half on subsequent write activity. The write loop must periodically flush or the read loop must send pongs via the write channel. Validate this in a spike before implementation
- [ ] Error cases: malformed URL → `WS_INVALID_URL`, timeout → `WS_CONNECT_TIMEOUT`, connection refused → `WS_CONNECT_FAILED`, TLS error → `WS_TLS_ERROR`
- [ ] File: `src-tauri/src/websocket/lifecycle.rs` (NEW)

#### 6B.3 — `ws_disconnect` Command

- [ ] Signature: `pub async fn ws_disconnect(state: State<'_, WsState>, request: WsDisconnectRequest) -> Result<Value, String>`
- [ ] Flow:
  1. Remove `ConnectionHandle` from `WsState` (lock once)
  2. Send close frame via write channel (with code + reason if provided)
  3. Cancel read loop via `CancellationToken`
  4. Drop channel senders (write loop exits on sender drop)
  5. Return `success_envelope("disconnect", { ok: true })`
- [ ] If `connection_id` not found → `error_envelope("disconnect", "WS_NOT_FOUND", ...)`
- [ ] File: `src-tauri/src/websocket/lifecycle.rs` (NEW)

#### 6B.4 — `ws_status` Command

- [ ] Signature: `pub async fn ws_status(state: State<'_, WsState>, request: WsStatusRequest) -> Result<Value, String>`
- [ ] Flow:
  1. Lock state, look up handle by `connection_id`
  2. Read counters (`messages_sent`, `messages_received` from `AtomicU64`)
  3. Compute `connected_since` duration
  4. Check if cancel token is cancelled (connection dead)
  5. Return `success_envelope("status", WsStatusResult { ... })`
- [ ] File: `src-tauri/src/websocket/lifecycle.rs` (NEW)

#### 6B Files

| File | Action | Purpose |
|---|---|---|
| `src-tauri/src/websocket/config.rs` | NEW | TLS config builder (`rustls` + PEM parsing) |
| `src-tauri/src/websocket/lifecycle.rs` | NEW | `ws_connect`, `ws_disconnect`, `ws_status` commands |

---

### Phase 6C — Rust Operations & Events

> **Goal:** Implement `ws_send` and `ws_receive_next` commands, plus the background read loop that emits `ws-message` events to the frontend.

#### 6C.1 — Message Types

- [ ] `WsOutboundMessage`: enum for text/binary/ping/close frames sent via the `mpsc` channel:
  ```rust
  pub enum WsOutboundMessage {
      Text(String),
      Binary(Vec<u8>),
      Ping(Vec<u8>),   // for ws_ping command AND pong forwarding
      Close(Option<u16>, Option<String>),
  }
  ```
- [ ] **Ping/Pong with split streams**: With `StreamExt::split()`, tungstenite's auto-pong queues pong responses when reading but they only flush through the write half on subsequent write activity. The read loop must detect `Message::Ping` and forward a `WsOutboundMessage::Ping` (which the write loop sends as `Message::Pong`) through the write channel. Without this, idle connections will be disconnected by servers that expect pong responses
- [ ] `WsInboundMessage`: struct for received frames (data, message_type, timestamp)
- [ ] Frame type conversion: `tokio_tungstenite::Message` ↔ application types
- [ ] File: `src-tauri/src/websocket/message.rs` (NEW)

#### 6C.2 — Read Loop

- [ ] Spawned by `ws_connect` after connection established
- [ ] Loop:
  ```rust
  tokio::select! {
      _ = cancel_token.cancelled() => break,
      msg = read.next() => match msg {
          Some(Ok(Message::Text(t))) => emit_message(app, connection_id, t, "text"),
          Some(Ok(Message::Binary(b))) => emit_message(app, connection_id, b, "binary"),
          Some(Ok(Message::Ping(_))) => { /* auto-pong handled by tungstenite */ },
          Some(Ok(Message::Close(_))) => { cleanup; break; },
          Some(Err(e)) => { emit_error; cleanup; break; },
          None => break,  // stream ended
      }
  }
  ```
- [ ] Increment `messages_received` counter on each message
- [ ] On stream end: remove from `WsState`, emit `ws-connection-closed` event
- [ ] File: `src-tauri/src/websocket/operations.rs` (NEW)

#### 6C.3 — Event Emission

- [ ] `ws-message` event payload (uses `WsMessagePayload` from types.rs):
  ```rust
  #[derive(Serialize, Clone)]
  #[serde(rename_all = "camelCase")]
  pub struct WsMessagePayload {
      pub connection_id: String,
      pub data: String,            // text content or base64-encoded binary
      pub message_type: String,    // "text" | "binary"
      pub timestamp: u64,          // epoch ms
  }
  ```
- [ ] `ws-connection-closed` event payload (uses `WsConnectionClosedPayload` from types.rs): `{ connection_id, code, reason }`
- [ ] Use `app.emit(event_name, payload)` — same pattern as `kafka-subscription-message`
- [ ] **Note**: Field is `data` (not `message`) for consistency with server contracts
- [ ] File: `src-tauri/src/websocket/operations.rs` (NEW)

#### 6C.4 — `ws_send` Command

- [ ] Signature: `pub async fn ws_send(state: State<'_, WsState>, request: WsSendRequest) -> Result<Value, String>`
- [ ] Flow:
  1. Lock state, get `ConnectionHandle.write_tx` by `connection_id`
  2. Send `WsOutboundMessage` via channel (non-blocking)
  3. Increment `messages_sent` counter
  4. Return `success_envelope("send", { ok: true, sentAt: epoch_ms })`
- [ ] If `connection_id` not found → `error_envelope("send", "WS_NOT_FOUND", ...)`
- [ ] If channel send fails (connection dead) → `error_envelope("send", "WS_NOT_CONNECTED", ...)`
- [ ] File: `src-tauri/src/websocket/operations.rs` (NEW)

#### 6C.5 — `ws_ping` Command

- [ ] Signature: `pub async fn ws_ping(state: State<'_, WsState>, request: WsPingRequest) -> Result<Value, String>`
- [ ] Flow:
  1. Lock state, get `ConnectionHandle.write_tx` by `connection_id`
  2. Send `WsOutboundMessage::Ping(vec![])` via channel
  3. Return `success_envelope("ping", { ok: true })`
- [ ] **Rationale**: Server proxy supports `ping` operation used by Studio's `sendPing()` button. Without a native `ws_ping` command, the ping button would break on Tauri desktop
- [ ] If `connection_id` not found → `error_envelope("ping", "WS_NOT_FOUND", ...)`
- [ ] File: `src-tauri/src/websocket/operations.rs` (NEW — same file as 6C.4)

#### 6C.7 — `ws_receive_next` Command

- [ ] Signature: `pub async fn ws_receive_next(state: State<'_, WsState>, request: WsReceiveRequest) -> Result<Value, String>`
- [ ] **Channel architecture** (critical design — was underspecified):
  - Each `ConnectionHandle` stores a `broadcast::Sender<WsInboundMessage>` alongside the existing `write_tx`
  - The **read loop** does two things with each received message:
    1. `app.emit("ws-message", payload)` — for Studio UI (event-driven)
    2. `broadcast_tx.send(inbound_msg)` — for programmatic consumers
  - `ws_receive_next` creates a **new** `broadcast::Receiver` from `broadcast_tx.subscribe()` each call, then awaits with `tokio::time::timeout`
  - This allows multiple concurrent `ws_receive_next` calls (each gets its own receiver) without interfering with the event stream
  - `broadcast` channel capacity: 256 messages (missed messages return `RecvError::Lagged` — acceptable for programmatic use; Studio uses events anyway)
- [ ] Flow:
  1. Lock state briefly → clone `broadcast_tx`, drop lock immediately
  2. `let mut rx = broadcast_tx.subscribe()`
  3. `tokio::time::timeout(Duration::from_millis(timeout_ms), rx.recv()).await`
  4. Return `success_envelope("receive", { data, messageType, receivedAt })`
- [ ] Design note: The read loop emits events for the Studio UI; `ws_receive_next` is for programmatic use (Phase 5 runner, Phase 4 workflow engine). The `broadcast::Receiver` approach avoids any mutex contention or message buffering in the state
- [ ] Timeout → `error_envelope("receive", "WS_RECEIVE_TIMEOUT", ...)`
- [ ] File: `src-tauri/src/websocket/operations.rs` (NEW)

#### 6C.8 — Idle Connection GC

- [ ] The Express proxy has a 5-minute idle TTL + 60-second GC cycle to clean up leaked connections. The native module should implement equivalent idle cleanup:
  - Track `last_activity` timestamp on each `ConnectionHandle` (updated on send/receive)
  - Optional background `tokio::spawn` GC task that runs every 60s, cancels connections idle > 5 minutes
  - Emit `ws-connection-closed` event with reason `"idle_timeout"` on GC cleanup
- [ ] Alternatively, rely on Studio's explicit disconnect and read-loop self-cleanup on stream end (simpler; defer full GC to a polish pass)
- [ ] File: `src-tauri/src/websocket/state.rs` (MODIFY — add `last_activity` field and optional GC)

#### 6C Files

| File | Action | Purpose |
|---|---|---|
| `src-tauri/src/websocket/message.rs` | NEW | Frame type conversion, outbound/inbound types (`WsOutboundMessage` enum incl. `Ping`) |
| `src-tauri/src/websocket/operations.rs` | NEW | `ws_send`, `ws_ping`, `ws_receive_next`, read loop, event emission |

---

### Phase 6D — TypeScript Bridge

> **Goal:** TypeScript transport bridge that maps `dispatchWsOperation()` calls to native Tauri `invoke()` commands, with event listeners for streaming messages — mirroring `kafkaNativeTauriTransport.ts`.

#### 6D.1 — Native Tauri Transport Module

- [ ] `websocketNativeTauriTransport.ts`:
  - `COMMAND_MAP`: maps `WsProxyOperation` → Rust command name + `paramKey`
    ```ts
    const COMMAND_MAP: Record<WsProxyOperation, { command: string; paramKey: string } | '_events'> = {
      connect:    { command: 'ws_connect',      paramKey: 'request' },
      disconnect: { command: 'ws_disconnect',   paramKey: 'request' },
      send:       { command: 'ws_send',         paramKey: 'request' },
      ping:       { command: 'ws_ping',         paramKey: 'request' },
      status:     { command: 'ws_status',       paramKey: 'request' },
      messages:   '_events',  // NOT mapped to ws_receive_next — Studio uses events, not polling
    };
    ```
  - **`messages` operation semantics**: Server proxy's `messages` returns buffered frames from a ring buffer (polling model). On native Tauri, Studio receives messages via `ws-message` events — no need to poll. The `messages` operation should return an empty array or be a no-op when native transport is active. `ws_receive_next` is for programmatic use (Phase 5 runner, Phase 4 workflow), not for Studio UI
  - `wsNativeTauriTransport(request)`:
    - Dynamic `import('@tauri-apps/api/core')` (safe in browser dev)
    - `invoke<WsEnvelope>(command, { [paramKey]: body })`
    - IPC errors → `WsClientError` with `WS_INVOKE_ERROR`
    - **Note**: Kafka's connect has special-case param wrapping (no `paramKey`). WS connect uses consistent `{ request: body }` wrapping for all commands
  - Export `listenWsMessage(callback)`:
    - Dynamic `import('@tauri-apps/api/event')`
    - `listen<WsMessagePayload>('ws-message', e => callback(e.payload))`
    - Returns cleanup `() => void`
  - Export `listenWsConnectionClosed(callback)`:
    - `listen<WsConnectionClosedPayload>('ws-connection-closed', e => callback(e.payload))`
- [ ] File: `src/shared/websocket/websocketNativeTauriTransport.ts` (NEW)
- [ ] Tests: `src/shared/websocket/websocketNativeTauriTransport.test.ts` (NEW)

#### 6D.2 — Transport Override in `websocketClient.ts`

- [ ] **Current state**: `websocketClient.ts` has NO transport override infrastructure — `dispatchWsOperation()` is hardcoded HTTP-only. This is significant new work (not just "add an override"):
  - Define `WsClientTransport` type: `(op: WsProxyOperation, body: Record<string, unknown>) => Promise<WsEnvelope>`
  - Define `WsDispatchRequest` type for the transport function parameter
  - Add transport override pattern (mirror `kafkaClient.ts`):
    ```ts
    let transportOverride: WsClientTransport | null = null;
    export function setWsClientTransport(transport: WsClientTransport | null): void { ... }
    ```
  - Refactor `dispatchWsOperation()` to use `transportOverride ?? defaultHttpTransport`
  - Extract current HTTP fetch logic into `defaultHttpTransport` function and **export it** (needed by `buildWsNodeOperations` for web-mode fallback)
  - Add shared `throwIfEnvelopeNotOk()` helper (Kafka has this; WS currently has inline parsing in `parseEnvelope`)
- [ ] **GET query handling**: `ws_status` is currently a GET request with `?connectionId=...` on proxy. Native transport passes structured params via `invoke`. Ensure Kafka's `restoreQueryTypes` pattern is followed if needed, or use consistent struct params for all operations
- [ ] File: `src/shared/websocket/websocketClient.ts` (MODIFY)

#### 6D.3 — Registration in `main.tsx`

- [ ] Add alongside Kafka registration:
  ```ts
  if (isTauri()) {
    setKafkaClientTransport(kafkaNativeTauriTransport);
    setWsClientTransport(wsNativeTauriTransport);
  }
  ```
- [ ] File: `src/app/main.tsx` (MODIFY)

#### 6D Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/websocketNativeTauriTransport.ts` | NEW | Tauri `invoke` bridge + event listeners + `messages` → events mapping |
| `src/shared/websocket/websocketNativeTauriTransport.test.ts` | NEW | Bridge tests (mock invoke) |
| `src/shared/websocket/websocketClient.ts` | MODIFY | Major refactor: extract `defaultHttpTransport`, add `WsClientTransport` type, `setWsClientTransport()`, `throwIfEnvelopeNotOk()` |
| `src/app/main.tsx` | MODIFY | Register native WS transport on Tauri |

---

### Phase 6E — Studio Integration & Parity

> **Goal:** WebSocket Studio switches from polling to event-driven messages on Tauri, transport selection logic is updated, and parity tests verify identical behavior between Express proxy and Tauri native.

#### 6E.1 — Event-Driven Message Reception

- [ ] In `useWebSocketStudio.ts`: when `isTauri()` and native transport active:
  - Replace 200ms polling loop (`setInterval` → `/api/ws/messages`) with `listenWsMessage()` event listener
  - On `ws-message` event: append to message log using `appendMessage(createFrame(...))` (NOT `appendFrame` — actual helpers are `appendMessage()` / `appendMessages()`)
  - On `ws-connection-closed` event: update connection state, trigger auto-reconnect if enabled
- [ ] **Protocol auto-respond**: The current polling loop runs `checkAutoRespond()` after receiving messages (handles Socket.IO PING/PONG, STOMP heartbeats, GraphQL-WS keepalive). This MUST be duplicated in the event handler path — without it, protocol-level keepalive breaks on native transport
- [ ] **GraphQL-WS init**: On proxy connect, the hook sends `connection_init` via `dispatchWsOperation('send')`. On native transport, the same init must be sent via the native `ws_send` command. The existing `handleAutoHandshake()` logic should work transparently if `dispatchWsOperation` is already routed through native transport
- [ ] **Event listener cleanup**: When disconnecting on native Tauri, the `listenWsMessage` and `listenWsConnectionClosed` cleanup functions must be called. Store the unlisten callbacks in hook state and invoke them in the disconnect handler. Failure to clean up causes stale event handlers accumulating on reconnect cycles
- [ ] Keep polling as fallback for non-Tauri or when `transportOverride` is null
- [ ] File: `src/features/websocket/useWebSocketStudio.ts` (MODIFY)

#### 6E.2 — Transport Selection Logic

- [ ] Current logic in `useWebSocketStudio.ts`: `needsProxy` = true when custom headers, TLS overrides, or `hasTlsOverrides(tlsConfig)`. Uses `connectProxy()` vs `connectDirect()` bifurcation
- [ ] Current `transportMode`: `'direct' | 'proxy'` — needs `'native'` added
- [ ] On Tauri with native transport:
  - Custom headers → native Tauri (replaces proxy)
  - TLS overrides → native Tauri (replaces proxy)
  - No need for Express proxy for any WS operation
  - All operations route through `dispatchWsOperation()` which delegates to native transport
- [ ] Add `useNativeTauri` flag: `isTauri() && wsClientTransportOverride !== null`
- [ ] When `useNativeTauri`:
  - `dispatchWsOperation()` routes through `wsNativeTauriTransport` (transparent — handled by transport override in `websocketClient.ts`)
  - Messages arrive via events (not polling) — register `listenWsMessage()` on connect
  - Direct browser `WebSocket` mode bypasses `dispatchWsOperation()` entirely — still available for debugging
  - `sendPing()` uses `dispatchWsOperation('ping')` which routes to `ws_ping` native command
- [ ] **`isProxyMode` for TLS banner**: Currently computed from draft state (`hasCustomHeaders || hasTlsOverrides`), not from actual transport. Should reflect actual transport mode after connection for accuracy
- [ ] File: `src/features/websocket/useWebSocketStudio.ts` (MODIFY)

#### 6E.3 — TLS Panel UX Update

- [ ] `WebSocketTlsPanel.tsx`: remove "only applies when using proxy transport" language
- [ ] On Tauri: display "TLS configuration applies to native desktop connections"
- [ ] On web: display "TLS configuration applies when using proxy transport"
- [ ] File: `src/features/websocket/WebSocketTlsPanel.tsx` (MODIFY)

#### 6E.4 — Connect Panel Transport Indicator

- [ ] `WebSocketConnectPanel.tsx`: show transport mode indicator in status area alongside existing status badges (latency, uptime, counters, protocol):
  - "Native" (Tauri native) — green badge
  - "Proxy" (Express proxy) — amber badge
  - "Direct" (browser WebSocket) — blue badge
- [ ] Only show when connected (irrelevant when disconnected)
- [ ] File: `src/features/websocket/WebSocketConnectPanel.tsx` (MODIFY)

#### 6E.5 — Parity Tests

- [ ] `websocketParity.test.ts`: test that operations produce identical results regardless of transport:
  - Connect: both transports return same envelope shape
  - Send: both transports accept same input format
  - Messages: both transports deliver messages with same shape
  - Disconnect: both transports handle close codes/reasons identically
  - Errors: both transports produce same error codes
- [ ] These are integration tests that require both Express proxy and Tauri commands running
- [ ] File: `src/shared/websocket/websocketParity.test.ts` (NEW)

#### 6E Files

| File | Action | Purpose |
|---|---|---|
| `src/features/websocket/useWebSocketStudio.ts` | MODIFY | Event-driven mode + transport selection logic |
| `src/features/websocket/WebSocketTlsPanel.tsx` | MODIFY | Platform-aware TLS description |
| `src/features/websocket/WebSocketConnectPanel.tsx` | MODIFY | Transport mode indicator |
| `src/shared/websocket/websocketParity.test.ts` | NEW | Cross-transport parity tests |

---

### Phase 6 — Connection Architecture

```
┌─────────────────────────────────────────────┐
│  TypeScript (useWebSocketStudio)            │
│                                             │
│  dispatchWsOperation('connect', {...})      │
│        │                                    │
│        ▼                                    │
│  transportOverride?─── YES ──► invoke()     │
│        │ NO                      │          │
│        ▼                         ▼          │
│  httpFetch('/api/ws/connect')   ws_connect  │
│        │ (Express proxy)        (Rust)      │
│        ▼                         │          │
│  Poll /api/ws/messages           │          │
│  (200ms interval)                ▼          │
│                            tokio::spawn     │
│                            read loop        │
│                                │            │
│                                ▼            │
│                          app.emit(          │
│                            'ws-message')    │
│                                │            │
│                                ▼            │
│                          listen()           │
│                          → appendMessage()  │
└─────────────────────────────────────────────┘
```

### Phase 6 — Read/Write Split Design

Each WebSocket connection in Rust is split into independent read and write halves:

```
ws_connect()
  ├── connect_async_tls_with_config(url, ...)
  ├── stream.split() → (write_half, read_half)
  │
  ├── mpsc::channel() → (write_tx, write_rx)
  │     write_tx stored in ConnectionHandle
  │     write_rx consumed by write loop
  │
  ├── tokio::spawn(write_loop):
  │     loop { recv from write_rx → write_half.send() }
  │
  ├── tokio::spawn(read_loop):
  │     loop {
  │       select! {
  │         _ = cancel.cancelled() => break,
  │         msg = read_half.next() => {
  │           app.emit("ws-message", payload);
  │           messages_received.fetch_add(1);
  │         }
  │       }
  │     }
  │     // on exit: remove from WsState, emit ws-connection-closed
  │
  └── store ConnectionHandle { write_tx, cancel_token, ... }

ws_send(connection_id, message)
  ├── lock state → get handle.write_tx
  └── write_tx.send(WsOutboundMessage::Text(message))

ws_disconnect(connection_id)
  ├── lock state → remove handle
  ├── write_tx.send(WsOutboundMessage::Close(code, reason))
  └── cancel_token.cancel()  // stops read loop
```

### Phase 6 — Design Decisions

| Decision | Rationale |
|---|---|
| **Mirror Kafka module structure exactly** | Proven pattern, consistent codebase, familiar for maintainers. `commands.rs` for integration tests (not re-exports), direct paths in `generate_handler!` |
| **`rustls` (not `native-tls`)** | Consistent with `reqwest` in this project; `tokio-tungstenite` supports `rustls-tls-native-roots` feature. Note: Kafka uses **librdkafka/OpenSSL** for its TLS — the rustls alignment is with reqwest, not with Kafka |
| **PEM only (drop PKCS12)** | Express proxy only supports PEM via `https.Agent`; PKCS12 adds complexity with no precedent |
| **`mpsc` channel for write half** | Decouples `ws_send` from write I/O; no lock during write; write loop handles backpressure |
| **`CancellationToken` per connection** | Clean shutdown of read loop; consistent with Kafka subscription pattern. Already used in executor + Kafka |
| **Event-driven (not polling) on Tauri** | Eliminates 200ms polling latency; real-time message delivery via `app.emit()`. `messages` op returns empty on native — Studio uses events |
| **Keep Express proxy as web fallback** | Browser builds still need proxy for custom headers and TLS; Tauri desktop skips it |
| **Transport override in `websocketClient.ts`** | Same pattern as `kafkaClient.ts`; single dispatch function, swappable transport |
| **`std::sync::Mutex` (not `tokio::sync::Mutex`)** | Consistent with Kafka state; lock held only briefly for HashMap lookup, never across I/O |
| **Native `ws_ping` command** | Server proxy supports `ping` operation; Studio's `sendPing()` button must work on native transport |
| **Align Rust field names with `contracts.ts`** | Use `tls` (not `tls_config`), `data` (not `message`) to maintain parity with server contracts |
| **Defer idle GC to polish** | Read-loop self-cleanup on stream end + explicit disconnect covers most cases; full idle timeout GC can be added later |

### Phase 6 Success Criteria

- [ ] `ws_connect` establishes WebSocket connection via `tokio-tungstenite` with configurable TLS, URL validation
- [ ] `ws_send` sends text and binary frames via `mpsc` channel to write loop
- [ ] `ws_ping` sends WebSocket ping frame via write channel
- [ ] `ws_receive_next` blocks until next message or timeout (for runner/workflow use, NOT for Studio UI)
- [ ] `ws_disconnect` sends close frame and cleans up (cancel read loop, remove state)
- [ ] `ws_status` returns rich status matching server's `WsProxyStatusResult` shape (uptimeMs, sentCount, receivedCount, closeCode)
- [ ] Incoming messages emitted as `ws-message` Tauri events in real-time (field: `data`, not `message`)
- [ ] Connection close emitted as `ws-connection-closed` event
- [ ] Custom TLS certificates supported (PEM format: CA cert, client cert, client key)
- [ ] `reject_unauthorized: false` supported for self-signed certs
- [ ] Ping/pong works correctly with split streams (validated via spike)
- [ ] Connection pool: multiple concurrent connections managed safely via `WsState` HashMap
- [ ] Lock discipline: `std::sync::Mutex` locked once per operation, never across I/O
- [ ] Read/write loops in `tokio::spawn` with `CancellationToken` for clean shutdown
- [ ] Read loop self-cleans from `WsState` on stream end and emits close event
- [ ] `websocketNativeTauriTransport.ts` bridges `WsProxyOperation` to Rust `invoke()` — `messages` op returns empty (Studio uses events)
- [ ] `listenWsMessage()` and `listenWsConnectionClosed()` event listeners exported
- [ ] `websocketClient.ts` refactored: `WsClientTransport` type, `setWsClientTransport()`, `defaultHttpTransport` extracted
- [ ] `setWsClientTransport()` wired in `main.tsx` for automatic Tauri registration
- [ ] WebSocket Studio uses event-driven messages on Tauri (no 200ms polling)
- [ ] Protocol auto-respond (`checkAutoRespond`) works in both polling and event-driven paths
- [ ] Transport mode `'native'` added to `transportMode` union
- [ ] Transport selection: Tauri desktop uses native for all operations (headers, TLS, connect, ping)
- [ ] TLS panel displays platform-aware description
- [ ] Connect panel shows transport mode indicator badge (Native/Proxy/Direct)
- [ ] Error codes align with `contracts.ts`: `WS_CONNECT_FAILED` (not `_ERROR`), `WS_SEND_FAILED` (not `_ERROR`), `WS_INVALID_URL`
- [ ] `commands.rs` follows Kafka pattern (integration tests, not re-exports)
- [ ] `lib.rs` registers commands via direct module paths
- [ ] Parity tests pass: Express proxy and Tauri native produce identical envelope shapes
- [ ] Unit test coverage >90%

### Phase 6 All Files Summary

#### New Files — Rust (9)

| File | Sub-Phase | Purpose |
|---|---|---|
| `src-tauri/src/websocket/mod.rs` | 6A | Module tree declaration |
| `src-tauri/src/websocket/types.rs` | 6A | Rust types aligned with `contracts.ts` (`tls`, `data`, rich `WsStatusResult`) |
| `src-tauri/src/websocket/envelope.rs` | 6A | Success/error envelope helpers (`pub(super)` visibility, ISO timestamp) |
| `src-tauri/src/websocket/state.rs` | 6A | `WsState` + `ConnectionHandle` + `Mutex<HashMap>` + optional `last_activity` for GC |
| `src-tauri/src/websocket/commands.rs` | 6A | Integration tests only (NOT re-exports — follows Kafka pattern) |
| `src-tauri/src/websocket/config.rs` | 6B | TLS config builder (`rustls` + PEM parsing) |
| `src-tauri/src/websocket/lifecycle.rs` | 6B | `ws_connect` (with URL validation + ping/pong caveat), `ws_disconnect`, `ws_status` |
| `src-tauri/src/websocket/message.rs` | 6C | Frame type conversion, `WsOutboundMessage` enum (Text/Binary/Ping/Close) |
| `src-tauri/src/websocket/operations.rs` | 6C | `ws_send`, `ws_ping`, `ws_receive_next`, read loop, event emission |

#### New Files — TypeScript (3)

| File | Sub-Phase | Purpose |
|---|---|---|
| `src/shared/websocket/websocketNativeTauriTransport.ts` | 6D | Tauri `invoke` bridge + event listeners + `messages` → events semantics |
| `src/shared/websocket/websocketNativeTauriTransport.test.ts` | 6D | Bridge tests (mock invoke) |
| `src/shared/websocket/websocketParity.test.ts` | 6E | Cross-transport parity tests |

#### Modified Files (8)

| File | Sub-Phase | Change |
|---|---|---|
| `src-tauri/Cargo.toml` | 6A | Add `tokio-tungstenite` 0.28 + `rustls-pemfile` 2 |
| `src-tauri/src/lib.rs` | 6A | `mod websocket`, `.manage(WsState)`, `generate_handler!` with 6 direct-path commands |
| `src-tauri/capabilities/default.json` | 6A | Add `websocket:allow-ws-*` permissions (6 commands) |
| `src/shared/websocket/websocketClient.ts` | 6D | Major refactor: extract `defaultHttpTransport`, add `WsClientTransport` type, `setWsClientTransport()`, `throwIfEnvelopeNotOk()` |
| `src/app/main.tsx` | 6D | Register native WS transport on Tauri |
| `src/features/websocket/useWebSocketStudio.ts` | 6E | Event-driven mode, transport selection, protocol auto-respond in event path, `transportMode: 'native'` |
| `src/features/websocket/WebSocketTlsPanel.tsx` | 6E | Platform-aware TLS description |
| `src/features/websocket/WebSocketConnectPanel.tsx` | 6E | Transport mode indicator badge |

---

## Test Plan

### Per-Phase Test Coverage

> **Note:** The actual test files differ from the original plan because several components were consolidated during implementation. The compose bar and status bar tests are part of their parent component test files.

| Phase | Module | Test File | Key Test Cases |
|---|---|---|---|
| 1 | `useWebSocketStudio` | `useWebSocketStudio.test.ts` | connect/disconnect lifecycle, send, message append, filtering, max cap, status updates, cleanup on unmount |
| 1 | `WebSocketStudioPage` | `WebSocketStudioPage.test.tsx` | Tab rendering, tab switching, guard state, connected state, profile/template wiring |
| 1 | `WebSocketConnectPanel` | `WebSocketConnectPanel.test.tsx` | URL validation, header CRUD, connect/disconnect buttons, disabled states, status display, reconnect UI |
| 1 | `WebSocketMessageLog` | `WebSocketMessageLog.test.tsx` | Message rendering, compose bar (send text/binary, format selector, templates), auto-scroll, search, keyboard nav |
| 1 | `wsMessageUtils` | `wsMessageUtils.test.ts` | JSON pretty-print, hex dump, size formatting |
| 1 | `wsProtocolHelpers` | `wsProtocolHelpers.test.ts` | Auto-respond logic, frame annotation, filter helpers |
| 1 | `websocketClient` | `websocketClient.test.ts` | Dispatch operations, proxy/direct transport selection |
| 1 | `types` | `types.test.ts` | Factory helpers, createFrame, createDefaultDraft, buildEffectiveUrl |
| 1 | `contracts` | `contracts.test.ts` | Server-side type validation |
| 1 | `websocket-service` | `websocket-service.test.ts` | Connection manager, message buffering, TLS |
| 1 | `websocket-routes` | `websocket-routes.test.ts` | Express route handlers |
| 2A | `useWebSocketProfiles` | `useWebSocketProfiles.test.ts` | CRUD, duplicate, import/export, persistence |
| 2A | `WebSocketSavedConnections` | `WebSocketSavedConnections.test.tsx` | Profile list UI, load, delete, search |
| 2B | `useWebSocketTemplates` | `useWebSocketTemplates.test.ts` | Save/load/delete/update templates, persistence |
| 2B | `WebSocketMessageDetail` | `WebSocketMessageDetail.test.tsx` | JSON/Raw/Hex tabs, resize, copy, keyboard nav |
| 2 | `websocketStorage` | `websocketStorage.test.ts` | Dual-mode persistence, corrupt data handling |
| 3A | `protocolTypes` | `protocolTypes` (inline) | Registry entries, `getProtocolInfo()`, `WsDetectionConfidence` |
| 3A | `protocolDetector` | `protocolDetector.test.ts` | URL pattern matching, subprotocol sniffing, message heuristics |
| 3A | `WebSocketProtocolSelector` | `WebSocketProtocolSelector.test.tsx` | Dropdown rendering, disabled state, all-available labels |
| 3B | `socketIoCodec` | `socketIoCodec.test.ts` | Encode/decode all packet types, namespace, SioOpenPayload |
| 3C | `stompCodec` | `stompCodec.test.ts` | Parse/serialize STOMP frames, heart-beat, receipt |
| 3D | `WebSocketTlsPanel` | `WebSocketTlsPanel.test.tsx` | TLS toggle, cert inputs, proxy-only banner, conditional rendering |
| 3D | `websocket-service` | `websocket-service.test.ts` | TLS config pass-through, buildTlsAgent, case-insensitive URL |
| 3E | `graphqlWsCodec` | `graphqlWsCodec.test.ts` | connection_init, subscribe, next, error, complete, ping/pong |
| 3B/3C/3E | `wsProtocolHelpers` | `wsProtocolHelpers.test.ts` | Auto-respond logic (SIO/STOMP/GQL), protocolMeta annotation, compose filter |
| 3A–3E | `useWebSocketStudio` | `useWebSocketStudio.test.ts` | Protocol detection, auto-handshake wiring, TLS state, frame annotation |
| 4 | `graphRunnerWsNodeHandlers` | `graphRunnerWsNodeHandlers.test.ts` | Connect/send/receive/trigger node execution, error paths, cleanup |
| 4 | `buildWsNodeOperations` | `buildWsNodeOperations.test.ts` | Dispatch bridge, error mapping |
| 5 | `wsExecution` | `wsExecution.test.ts` | Action dispatch, assertion context, parameterized |
| 5 | `wsExtractionAdapter` | `wsExtractionAdapter.test.ts` | Mapping round-trip, source tree, target tree |
| 6 | `websocketNativeTauriTransport` | `websocketNativeTauriTransport.test.ts` | Invoke bridge, event listeners, error mapping |
| 6 | `websocketParity` | `websocketParity.test.ts` | Cross-transport equivalence |

### Testing Infrastructure

| Layer | Tool | Purpose |
|---|---|---|
| Unit tests | Vitest + JSDOM | Hook/component tests with mocked WebSocket |
| WebSocket mock | `vitest` MockWebSocket class | Simulate server messages, connection events |
| Docker E2E | `websockify` / custom echo server | Real WebSocket server for manual validation |
| Transport parity | Golden fixture comparison | Browser vs Tauri produce identical shapes |

---

## Type Definitions

All types are defined in their respective sections above. The canonical type files are:

| File | Contents | Status |
|---|---|---|
| `src/shared/websocket/types.ts` | `WsConnectionState`, `WsFrame`, `WsFrameDirection`, `WsFrameType`, `WsConnectionSnapshot`, `WsConnectionDraft`, `WsConnectionProfile`, `WsKeyValueEntry`, `WsMessageTemplate`, `WsMessageFormat`, `WsReconnectState`, `WsCloseDetail`, `WsFrameProtocolMeta`, `WsTlsConfig` | ✅ Exists |
| `src/shared/websocket/protocols/protocolTypes.ts` | `WsProtocolMode`, `WsProtocolInfo`, `PROTOCOL_REGISTRY`, `WsProtocolDetectionResult` | ✅ Exists |
| `src/shared/websocket/protocols/socketIoCodec.ts` | `SioDecodedPacket`, encode/decode functions | ✅ Exists |
| `src/shared/websocket/protocols/stompCodec.ts` | `StompFrame`, encode/decode functions | ✅ Exists |
| `src/shared/websocket/protocols/graphqlWsCodec.ts` | `GqlWsMessage`, encode/decode functions | ✅ Exists |
| `src/features/workflow/types/workflow.ts` | `WsConnectNodeData`, `WsSendNodeData`, `WsReceiveNodeData`, `WsTriggerNodeData` | ✅ Phase 4A |
| `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts` | `WsNodeOperations`, `WsConnectResult`, `WsSendResult`, `WsReceivedMessage` | ✅ Phase 4C |
| `src/shared/types/trace.ts` | `CapturedWsNodeDetails` | ✅ Phase 4D |
| `src/shared/types/websocket.ts` | `WsActionType`, action configs for scenarios | ✅ Phase 5A |

---

## File Map

### Phase 1 Files (Actual)

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/websocketClient.ts` | NEW | WebSocket dispatch client (proxy-mode HTTP dispatch) |
| `src/shared/websocket/websocketClient.test.ts` | NEW | Client tests |
| `src/shared/websocket/types.ts` | NEW | All shared types + factory helpers |
| `src/shared/websocket/types.test.ts` | NEW | Type helper tests |
| `src-server/websocket/contracts.ts` | NEW | Server-side WebSocket operation types |
| `src-server/websocket/contracts.test.ts` | NEW | Contract tests |
| `src-server/websocket/websocket-service.ts` | NEW | Server-side connection manager (ws library) |
| `src-server/websocket/websocket-service.test.ts` | NEW | Service tests |
| `src-server/routes/websocket-routes.ts` | NEW | Express proxy routes (/api/ws/*) |
| `src-server/routes/websocket-routes.test.ts` | NEW | Route tests |
| `src-server/webhook-server.ts` | MODIFY | Mount websocket routes via createWebSocketRouter() |
| `src/features/websocket/WebSocketStudioPage.tsx` | NEW | Top-level page with tabs + guard state |
| `src/features/websocket/WebSocketStudioPage.test.tsx` | NEW | Page tests |
| `src/features/websocket/WebSocketConnectPanel.tsx` | NEW | Connection form + status display |
| `src/features/websocket/WebSocketConnectPanel.test.tsx` | NEW | Panel tests |
| `src/features/websocket/WebSocketMessageLog.tsx` | NEW | Message log + compose bar (integrated) |
| `src/features/websocket/WebSocketMessageLog.test.tsx` | NEW | Log + compose tests |
| `src/features/websocket/useWebSocketStudio.ts` | NEW | Unified hook (connection + messages + state) |
| `src/features/websocket/useWebSocketStudio.test.ts` | NEW | Hook tests |
| `src/features/websocket/wsMessageUtils.ts` | NEW | Message formatting + URL/JSON/base64 validation |
| `src/features/websocket/wsMessageUtils.test.ts` | NEW | Formatting tests |
| `src/features/websocket/wsProtocolHelpers.ts` | NEW (stub; filled in Phase 3) | Protocol auto-respond, `protocolMeta` annotation, filtering |
| `src/features/websocket/wsProtocolHelpers.test.ts` | NEW (stub; filled in Phase 3) | Protocol helper tests |
| `src/features/websocket/KeyValueEditor.tsx` | NEW | Reusable key-value pair editor (headers, query params) |
| `src/features/websocket/KeyValueEditor.test.tsx` | NEW | KeyValueEditor tests |
| `src/features/websocket/useDropdownClose.ts` | NEW | Shared dropdown close-on-click-outside hook |
| `src/features/websocket/useDropdownClose.test.ts` | NEW | Hook tests |
| `src/app/utils/appTabUtils.ts` | MODIFY | Add 'websocket-studio' tab |
| `src/app/components/AppSubNav.tsx` | MODIFY | Add sub-nav entry |
| `src/app/App.tsx` | MODIFY | Add render branch |
| `src/styles/websocket-studio.css` | NEW | All ws-* CSS classes (dedicated file) |

### Phase 2A Files (Saved Connection Profiles) — Actual

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/websocketStorage.ts` | NEW | Dual-mode persistence (profiles + templates) |
| `src/shared/websocket/websocketStorage.test.ts` | NEW | Storage layer tests |
| `src/app/hooks/useWebSocketProfiles.ts` | NEW | Profile CRUD hook (follows `useKafkaTemplates` pattern) |
| `src/app/hooks/useWebSocketProfiles.test.ts` | NEW | Profile hook tests |
| `src/features/websocket/WebSocketSavedConnections.tsx` | NEW | Saved connections list + CRUD UI |
| `src/features/websocket/WebSocketSavedConnections.test.tsx` | NEW | Saved connections component tests |
| `src/features/websocket/WebSocketStudioPage.tsx` | MODIFY | "Saved" tab + config lock banner + Save as Profile wiring |
| `src/features/websocket/WebSocketStudioPage.test.tsx` | MODIFY | Update tab tests + config lock + saved tab tests |
| `src/features/websocket/WebSocketConnectPanel.tsx` | MODIFY | Config lock props (`configLocked`), Save as Profile button |
| `src/features/websocket/WebSocketConnectPanel.test.tsx` | MODIFY | Config lock + Save as Profile tests |
| `src/styles/websocket-studio.css` | MODIFY | Saved connections CSS + config lock banner + editor modal CSS |

### Phase 2B Files (Message Templates + Format Selector + Detail Panel) — Actual

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/websocketStorage.ts` | Already done | Template persistence (loadWsTemplates/saveWsTemplates) |
| `src/shared/websocket/types.ts` | Already done | WsMessageFormat, WsMessageTemplate types |
| `src/app/hooks/useWebSocketTemplates.ts` | NEW | Template CRUD hook |
| `src/app/hooks/useWebSocketTemplates.test.ts` | NEW | Template hook tests |
| `src/features/websocket/WebSocketMessageDetail.tsx` | NEW | Resizable detail panel (JSON/Raw/Hex tabs) |
| `src/features/websocket/WebSocketMessageDetail.test.tsx` | NEW | Detail panel tests |
| `src/features/websocket/WebSocketMessageLog.tsx` | MODIFY | Template dropdown, format selector, detail panel, keyboard nav (compose bar integrated here) |
| `src/features/websocket/WebSocketMessageLog.test.tsx` | MODIFY | Template + format + detail + compose UI tests |
| `src/features/websocket/wsMessageUtils.ts` | MODIFY | JSON pretty-print, hex dump utilities; added `resolveEnvVars()`, `formatTimeAgo()`, `buildBinaryPreview()`, `buildHexDumpLines()`; relaxed `isValidWsUrl()` for `{{var}}` |
| `src/features/websocket/WebSocketStudioPage.tsx` | MODIFY | Wire templates hook, pass to MessageLog |
| `src/features/websocket/WebSocketStudioPage.test.tsx` | MODIFY | Templates integration tests |
| `src/styles/websocket-studio.css` | MODIFY | Template dropdown + format selector + detail panel CSS |

**Phase 2B Re-evaluation Notes (2026-06-08):**
- **Textarea syntax highlighting is infeasible**: HTML `<textarea>` cannot render styled content. JSON mode uses a format indicator label + Beautify button. Actual syntax highlighting only appears in the detail panel and message log rows.
- **`send()` format awareness**: `onSend` callback gains an optional `format` parameter for binary (Base64 → Uint8Array) support.
- **Inline expanded view replaced**: The Phase 1 inline expand (click-to-toggle `<pre>`) is replaced by the detail panel at the bottom of the log. Clicking a message selects it and opens the detail panel; clicking Close or pressing Escape hides it.
- **Binary Base64 validation**: Compose bar (integrated in MessageLog) validates Base64 input in binary mode and disables Send for invalid Base64.
- **Compose bar at bottom**: Mockup Alignment M18 moved compose bar from top to bottom of message log, matching Postman/Insomnia convention.
- **JSON syntax coloring in log rows**: Mockup Alignment M22 added `tokenizeJson()` for inline key/string/number/boolean/null coloring.
- **Row background tints**: Mockup Alignment M19 added sent (blue) / received (green) row tints.
- **Detail timestamp milliseconds**: Mockup Alignment M24 added `.mmm` precision to detail panel timestamps.
- **Hex column colors**: Mockup Alignment M25 added distinct colors for offset/bytes/ASCII in hex tab.

### Phase 2C Files (Auto-Reconnect + Close with Code/Reason) — Actual

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/types.ts` | MODIFY | Add `WsCloseDetail`, `WsReconnectState` (with `lastError?`, `lostAt?`), `WsBackoffMultiplier`, `DEFAULT_BACKOFF_MULTIPLIER`, `resolveBackoffMultiplier()`, `WS_CLOSE_CODE_PRESETS`, `WsCloseCodePreset`, `getCloseCodeLabel()`, `createDefaultReconnectState()` |
| `src/features/websocket/useWebSocketStudio.ts` | MODIFY | Add auto-reconnect logic + close code/reason |
| `src/features/websocket/useWebSocketStudio.test.ts` | MODIFY | Reconnect + close code tests |
| `src/features/websocket/WebSocketConnectPanel.tsx` | MODIFY | Auto-reconnect toggle + reconnect banner + close dropdown |
| `src/features/websocket/WebSocketConnectPanel.test.tsx` | MODIFY | Reconnect + close code UI tests |
| `src/features/websocket/WebSocketStudioPage.tsx` | MODIFY | Wire reconnect + close props |
| `src/features/websocket/WebSocketStudioPage.test.tsx` | MODIFY | Update mock return type |
| `src/styles/websocket-studio.css` | MODIFY | Reconnect banner + close code dropdown CSS |

> **Note:** Server-side files (`contracts.ts`, `websocket-service.ts`, `websocket-routes.ts`) already
> supported `code` and `reason` on disconnect since Phase 1's proxy implementation — no server
> modifications were needed for Phase 2C.

### Phase 3 Files

| File | Action | Purpose |
|---|---|---|
| `src/shared/websocket/protocols/protocolTypes.ts` | NEW (3A) | Protocol mode type, registry, detection result, `WsDetectionConfidence`, `getProtocolInfo()` |
| `src/shared/websocket/protocols/protocolDetector.ts` | NEW (3A) | Protocol auto-detection engine |
| `src/shared/websocket/protocols/protocolDetector.test.ts` | NEW (3A) | Detection tests |
| `src/features/websocket/WebSocketProtocolSelector.tsx` | NEW (3A) | Protocol mode picker dropdown |
| `src/features/websocket/WebSocketProtocolSelector.test.tsx` | NEW (3A) | Selector tests |
| `src/shared/websocket/protocols/socketIoCodec.ts` | NEW (3B) | Socket.IO codec (decode, encode, SioOpenPayload, etc.) |
| `src/shared/websocket/protocols/socketIoCodec.test.ts` | NEW (3B) | Socket.IO tests |
| `src/shared/websocket/protocols/stompCodec.ts` | NEW (3C) | STOMP codec (decode, encode, heartbeat, etc.) |
| `src/shared/websocket/protocols/stompCodec.test.ts` | NEW (3C) | STOMP tests |
| `src/shared/websocket/protocols/graphqlWsCodec.ts` | NEW (3E) | GraphQL-WS codec (decode, encode, ping/pong, etc.) |
| `src/shared/websocket/protocols/graphqlWsCodec.test.ts` | NEW (3E) | GraphQL-WS tests |
| `src/features/websocket/WebSocketTlsPanel.tsx` | NEW (3D) | TLS/mTLS collapsible config panel |
| `src/features/websocket/WebSocketTlsPanel.test.tsx` | NEW (3D) | TLS panel tests |
| `src-server/websocket/contracts.ts` | MODIFY (3D) | Add `WsTlsConfig` to `WsProxyConnectRequest.tls?` |
| `src-server/websocket/websocket-service.ts` | MODIFY (3D) | Map TLS to `buildTlsAgent` (`ca`, `cert`, `key`, `rejectUnauthorized`) |
| `src-server/websocket/websocket-service.test.ts` | MODIFY (3D) | TLS integration tests (3 cases) |
| `src/shared/websocket/types.ts` | MODIFY (3A/3B/3D) | Protocol mode, `WsFrameProtocolMeta` (incl. `isSystemPacket?`), `WsTlsConfig`, `createDefaultTlsConfig()`, `hasTlsOverrides()` |
| `src/features/websocket/wsProtocolHelpers.ts` | MODIFY (3B/3C/3E) | Auto-handshake (`checkAutoRespond`), `protocolMeta` annotation (`buildSioMeta`, `buildStompMeta`, `buildGqlWsMeta`), `buildGqlWsInitAction`, `applyFilters` |
| `src/features/websocket/wsProtocolHelpers.test.ts` | MODIFY (3B/3C/3E) | Protocol helper tests |
| `src/features/websocket/useWebSocketStudio.ts` | MODIFY (3A–3E) | Protocol detection, auto-respond wiring, TLS state |
| `src/features/websocket/useWebSocketStudio.test.ts` | MODIFY (3A–3E) | Protocol + TLS integration tests |
| `src/features/websocket/WebSocketMessageLog.tsx` | MODIFY (3B/3C/3E) | Protocol compose modes (SIO/STOMP/GQL) + protocol-aware display |
| `src/features/websocket/WebSocketMessageLog.test.tsx` | MODIFY (3B/3C/3E) | Compose mode + display tests |
| `src/features/websocket/WebSocketConnectPanel.tsx` | MODIFY (3A/3D) | Protocol selector + TLS panel integration |
| `src/features/websocket/WebSocketConnectPanel.test.tsx` | MODIFY (3A/3D) | Protocol selector + TLS rendering tests |
| `src/features/websocket/WebSocketStudioPage.tsx` | MODIFY (3A/3D) | Protocol + TLS props wiring |
| `src/features/websocket/WebSocketStudioPage.test.tsx` | MODIFY (3A/3D) | Updated mock return types |
| `src/app/hooks/useWebSocketProfiles.ts` | MODIFY (3D) | `tlsConfig` persistence in profiles |
| `src/styles/websocket-studio.css` | MODIFY (3A–3E) | Protocol selector, badge, SIO/STOMP/GQL message styling, TLS panel CSS |

### Phase 4 Files

#### New Files (12)

| File | Sub-Phase | Purpose |
|---|---|---|
| `src/features/workflow/components/nodes/WsConnectNode.tsx` | 4A | wsConnect canvas node |
| `src/features/workflow/components/nodes/WsSendNode.tsx` | 4A | wsSend canvas node |
| `src/features/workflow/components/nodes/WsReceiveNode.tsx` | 4A | wsReceive canvas node |
| `src/features/workflow/components/nodes/WsTriggerNode.tsx` | 4A | wsTrigger canvas node |
| `src/features/workflow/components/configs/WsConnectConfig.tsx` | 4B | wsConnect config panel |
| `src/features/workflow/components/configs/WsSendConfig.tsx` | 4B | wsSend config panel |
| `src/features/workflow/components/configs/WsReceiveConfig.tsx` | 4B | wsReceive config panel |
| `src/features/workflow/components/configs/WsTriggerConfig.tsx` | 4B | wsTrigger config panel |
| `src/features/workflow/engine/graphRunnerWsNodeHandlers.ts` | 4C | 4 WS node execution handlers |
| `src/features/workflow/engine/graphRunnerWsNodeHandlers.test.ts` | 4C | Handler unit tests |
| `src/shared/websocket/buildWsNodeOperations.ts` | 4C | Operations bridge with connection registry |
| `src/shared/websocket/buildWsNodeOperations.test.ts` | 4C | Bridge unit tests |

#### Modified Files (22)

| File | Sub-Phase | Change |
|---|---|---|
| `src/features/workflow/types/workflow.ts` | 4A | Add 4 WS types to unions + 4 `*NodeData` interfaces (with `label` + index sig) |
| `src/features/workflow/utils/workflowNodeFactory.ts` | 4A | nodeTypes map + defaultNodeData + 4 default helpers |
| `src/features/workflow/components/canvas/WorkflowPalette.tsx` | 4A | Add 4 palette entries (actions + triggers) |
| `src/features/workflow/components/nodes/NodeIcon.tsx` | 4A | Add 4 icon mappings to `ICON_MAP` (integration + trigger) |
| `src/features/workflow/hooks/useWorkflowCanvasSync.ts` | 4A | Add WS types to variable-hints inclusion list in `useWorkflowVariableHints()` |
| `src/styles/workflow.css` | 4A | Add WS node CSS classes (`.wf-node-wsConnect`, etc.) |
| `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx` | 4B | Add 4 config panel conditionals (eager import + conditional JSX) |
| `src/features/workflow/utils/workflowVariableHints.ts` | 4B | `NODE_TYPE_DISPLAY` + `NON_HTTP_TYPES` + hint collectors |
| `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts` | 4C | Add `WsNodeOperations` interface + `wsOperations?` + `capturedWsDetails?` map |
| `src/features/workflow/engine/graphRunnerNodeHandlers.ts` | 4C | Re-export WS handlers |
| `src/features/workflow/engine/graphRunner.ts` | 4D | Dispatch branches + trace enrichment + `disconnectAll()` cleanup in finally block |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | 4D | Add `wsTrigger` to `findStartNodes()` trigger filter |
| `src/features/workflow/hooks/useWorkflowExecution.ts` | 4D | Import + call `buildWsNodeOperations()`, pass to `runGraph()` |
| `src/features/workflow/engine/graphLoadRunner.ts` | 4D | Add `wsOperations?` to `GraphLoadRunOpts` + passthrough |
| `src/features/workflow/engine/graphRunnerSubWorkflowHandler.ts` | 4D | Pass `hCtx.wsOperations` to child `runGraph()` calls |
| `src/shared/types/trace.ts` | 4D | Add `CapturedWsNodeDetails`, WS trace fields, extend `ExecutionEvent.nodeType` union |
| `src/shared/types/kafka.ts` | 4D | Extend `KafkaActionType` with WS transport types (consider rename to `TransportActionType`) |
| `src/shared/types/index.ts` | 4D | Re-export updated transport type union |
| `src/features/results/utils/nodeTypeLabels.ts` | 4E | Add 4 WS labels (console + explorer) |
| `src/features/results/components/DetailOverviewTab.tsx` | 4E | Add WS overview sections |
| `src/features/results/utils/reconstructLogLines.ts` | 4E | Add WS log line formatting |
| `src/features/workflow/engine/traceCollector.ts` | 4E | Add WS types to `hasOwnTiming` if applicable |

### Phase 5 Files

#### New Files (12)

| File | Sub-Phase | Purpose |
|---|---|---|
| `src/shared/types/websocket.ts` | 5A | WsActionType, action configs, WsResultMeta, WsAssertionTarget |
| `src/shared/types/websocket.test.ts` | 5A | Type helper tests |
| `src/shared/utils/wsScenarioDefaults.ts` | 5A | Default factories, validation, type resolution |
| `src/shared/utils/wsScenarioDefaults.test.ts` | 5A | Defaults + validation tests |
| `src/engine/wsExecution.ts` | 5B | WS action dispatcher (connect/send/receive → RequestResult) |
| `src/engine/wsExecution.test.ts` | 5B | Execution tests |
| `src/features/scenarios/components/WsScenarioEditor.tsx` | 5D | WS-specific scenario config panel |
| `src/features/scenarios/components/WsScenarioEditor.test.tsx` | 5D | Editor tests |
| `src/features/results/utils/transportLabels.ts` | 5E | Shared transport status/method label helpers |
| `src/features/results/utils/transportLabels.test.ts` | 5E | Label tests |
| `src/shared/components/data-mapper/adapters/wsExtractionAdapter.ts` | 5F | WS message extraction adapter |
| `src/shared/components/data-mapper/adapters/wsExtractionAdapter.test.ts` | 5F | Adapter tests |

#### Modified Files (16)

| File | Sub-Phase | Change |
|---|---|---|
| `src/shared/types/index.ts` | 5A | Extend Scenario, RequestResult, Assertion with WS fields |
| `src/shared/utils/scenarioMigration.ts` | 5A | Add WS to action type normalization |
| `src/engine/executor.ts` | 5B | Build wsOps, extend executeNonHttp, cleanup, Rust guard |
| `src/engine/dataSourceExpander.ts` | 5B | WS action + assertion field interpolation |
| `src/engine/executionWorker.ts` | 5B | Wire WS ops for worker harness runs |
| `src/features/test-runner/hooks/useTestExecution.ts` | 5B | Build wsOps, pass to runTest |
| `src/engine/validator.ts` | 5C | wsField case + wsContext on AssertionContext |
| `src/engine/validatorCustomExpression.ts` | 5C | ws.* paths in resolveVariable |
| `src/engine/validationResult.ts` | 5C | wsContext passthrough, skip HTTP status checks for WS |
| `src/features/scenarios/components/TestEditorModal.tsx` | 5D | Action type selector + conditional panel rendering |
| `src/features/scenarios/utils/testEditorUtils.ts` | 5D | emptyTest() accepts action type |
| `src/features/scenarios/components/testEditorValidationAddMenu.ts` | 5D | WS assertion presets |
| `src/features/scenarios/components/AssertionRowEditor.tsx` | 5D | wsField rendering branch |
| `src/features/results/components/ResultsRequestDetailsTab.tsx` | 5E | Use transport label helper |
| `src/features/requests/components/ResponseDetailModal.tsx` | 5E | Transport-aware detail panels |
| `src/features/results/utils/reportGenerator.ts` | 5E | WS labels in reports |

### Phase 6 Files

#### New Files — Rust (9)

| File | Sub-Phase | Purpose |
|---|---|---|
| `src-tauri/src/websocket/mod.rs` | 6A | Module tree declaration |
| `src-tauri/src/websocket/types.rs` | 6A | Rust types aligned with `contracts.ts` |
| `src-tauri/src/websocket/envelope.rs` | 6A | Success/error envelope helpers |
| `src-tauri/src/websocket/state.rs` | 6A | `WsState` + `ConnectionHandle` |
| `src-tauri/src/websocket/commands.rs` | 6A | Re-export surface |
| `src-tauri/src/websocket/config.rs` | 6B | TLS config builder (rustls) |
| `src-tauri/src/websocket/lifecycle.rs` | 6B | `ws_connect`, `ws_disconnect`, `ws_status` |
| `src-tauri/src/websocket/message.rs` | 6C | Frame type conversion |
| `src-tauri/src/websocket/operations.rs` | 6C | `ws_send`, `ws_receive_next`, read loop, events |

#### New Files — TypeScript (3)

| File | Sub-Phase | Purpose |
|---|---|---|
| `src/shared/websocket/websocketNativeTauriTransport.ts` | 6D | Tauri `invoke` bridge + event listeners |
| `src/shared/websocket/websocketNativeTauriTransport.test.ts` | 6D | Bridge tests |
| `src/shared/websocket/websocketParity.test.ts` | 6E | Cross-transport parity tests |

#### Modified Files (7)

| File | Sub-Phase | Change |
|---|---|---|
| `src-tauri/Cargo.toml` | 6A | Add `tokio-tungstenite` dependency |
| `src-tauri/src/lib.rs` | 6A | `mod websocket`, `.manage()`, `generate_handler!` |
| `src/shared/websocket/websocketClient.ts` | 6D | Add `setWsClientTransport()` override |
| `src/app/main.tsx` | 6D | Register native WS transport |
| `src/features/websocket/useWebSocketStudio.ts` | 6E | Event-driven mode + transport selection |
| `src/features/websocket/WebSocketTlsPanel.tsx` | 6E | Platform-aware TLS description |
| `src/features/websocket/WebSocketConnectPanel.tsx` | 6E | Transport mode indicator |

---

## Phase Status Tracker

| Phase | Status | Start | Complete | Manual Test | Commit |
|---|---|---|---|---|---|
| Phase 1A — Minimal Viable (direct browser WS) | ✅ Done | 2026-06-07 | 2026-06-07 | Pending | — |
| Phase 1B — Server Proxy + Custom Headers | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 2A — Saved Connection Profiles + Config Lock | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 2B — Message Templates + Format + Detail | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 2C — Auto-Reconnect + Close with Code/Reason | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 3A — Protocol Abstraction & Selector | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 3B — Socket.IO Codec & Integration | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 3C — STOMP Codec & Integration | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 3D — Advanced TLS & mTLS Support | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 3E — GraphQL over WebSocket (graphql-ws) | ✅ Done | 2026-06-08 | 2026-06-08 | Pending | — |
| Phase 4A — Types, Factory & Canvas Nodes | ✅ Done | 2026-06-08 | 2026-06-08 | N/A | — |
| Phase 4B — Config Panels | ✅ Done | 2026-06-08 | 2026-06-08 | N/A | — |
| Phase 4C — Engine Handlers & Operations Bridge | ✅ Done | 2026-06-08 | 2026-06-08 | N/A | — |
| Phase 4D — Runner Wiring & Trace Capture | ✅ Done | 2026-06-08 | 2026-06-08 | N/A | — |
| Phase 4E — Results Explorer & Labels | ✅ Done | 2026-06-08 | 2026-06-09 | N/A | — |
| Phase 5A — Types & Transport Extension | ✅ Done | 2026-06-08 | 2026-06-08 | N/A | — |
| Phase 5B — Execution Engine | ✅ Done | 2026-06-08 | 2026-06-08 | N/A | — |
| Phase 5C — Assertion Engine | ✅ Done | 2026-06-08 | 2026-06-08 | N/A | — |
| Phase 5D — Scenario Editor UI | ✅ Done | 2026-06-08 | 2026-06-09 | N/A | — |
| Phase 5E — Results & Reporting | ✅ Done | 2026-06-09 | 2026-06-09 | N/A | — |
| Phase 5F — Data Mapper & Export/Import | 📋 Planned | — | — | — | — |
| Phase 6A — Rust Module Foundation | 📋 Planned | — | — | — | — |
| Phase 6B — Rust Lifecycle & TLS | 📋 Planned | — | — | — | — |
| Phase 6C — Rust Operations & Events | 📋 Planned | — | — | — | — |
| Phase 6D — TypeScript Bridge | 📋 Planned | — | — | — | — |
| Phase 6E — Studio Integration & Parity | 📋 Planned | — | — | — | — |

---

## Manual Testing Protocol

### How to run the app for manual testing

```bash
# Terminal 1 — start the backend server (needed for Phase 1B proxy + Phase 3+ features)
npm run dev:server

# Terminal 2 — start the frontend (Vite)
npm run dev
# → opens http://localhost:5173
```

### Starting a local WebSocket echo server for manual tests

**Phase 1 (local Docker echo server recommended):**

```bash
# Run a local echo server with Docker (most reliable):
docker run -p 8765:8765 --rm jmalloc/echo-server
# → ws://localhost:8765

# Alternative: Node.js echo server (no Docker needed):
npx -y ws-echo-server --port 8765
# → ws://localhost:8765

# Public echo servers (use as fallback only — uptime not guaranteed):
# wss://ws.postman-echo.com/raw   — Postman echo server
# wss://echo.websocket.events     — community echo server
```

> **Note:** `echo.websocket.org` has been offline since 2022. Do NOT reference it in code, tests, or documentation. Always prefer the Docker echo server for reliable local testing.

**Phase 3+ (protocol-specific servers):**

```bash
# Socket.IO echo server
cd docker/websocket/socketio && docker compose up -d
# → http://localhost:3456/socket.io/

# STOMP broker (RabbitMQ with STOMP plugin)
cd docker/websocket/stomp && docker compose up -d
# → ws://localhost:15674/ws (STOMP over WebSocket)

# GraphQL subscription server
cd docker/websocket/graphql && docker compose up -d
# → ws://localhost:4000/graphql
```

### Docker infrastructure (to be created)

```
docker/websocket/
  echo/
    docker-compose.yml          — Simple echo server
    smoke-test.sh               — Basic connect/send/receive verification
  socketio/
    docker-compose.yml          — Socket.IO echo server
    smoke-test.sh               — Socket.IO handshake + emit/event test
  stomp/
    docker-compose.yml          — RabbitMQ + STOMP plugin
    smoke-test.sh               — STOMP CONNECT/SUBSCRIBE/SEND test
  graphql/
    docker-compose.yml          — GraphQL subscription server
    smoke-test.sh               — subscribe/next/complete flow
  e2e/
    run-all-smoke.sh            — Start all Docker profiles + run all smoke tests
    ui-test-seed.sh             — Seed test data for manual UI testing
```

---

## Open Questions / Risks

### Open Questions

| # | Question | Impact | Status |
|---|---|---|---|
| Q1 | Should we support WebSocket compression (permessage-deflate)? | Browser supports it natively; Tauri would need manual implementation | **Deferred** — add in Phase 6 if needed |
| Q2 | Should binary message display support hex view, base64, or both? | UX decision for binary frame inspection | **Resolved ✅** — Phase 2B: both hex and Base64 in detail panel tabs |
| Q3 | Should the server proxy use WebSocket relay or HTTP long-polling for frame forwarding? | Affects latency and complexity of proxy mode | **Resolved ✅** — Phase 1B: HTTP polling (proxy holds WS, UI polls `/messages`) |
| Q4 | Should connection profiles be per-environment or global? | Affects how URL templates work with environments | **Global** — env var interpolation (`{{var}}`) deferred until a shared engine is built |
| Q5 | Should we support WebSocket extensions beyond permessage-deflate? | Custom extensions are rare but exist | **Deferred** — only standard extensions initially |
| Q6 | How should the workflow runner manage WebSocket connection lifetime across iterations? | Load testing concern — one connection per iteration or shared? | **Resolved ✅** — Phase 4 design: `WsNodeOperations` with connection registry; `disconnectAll()` in `graphRunner` finally block; one connection set per workflow run |
| Q7 | Should the message log use a virtual list (react-window / tanstack-virtual) from the start? | Performance with 1000+ messages; the current `overflow-y: auto` approach may lag on large logs | **Deferred** — Phase 1 uses capped list (max 1000) with `overflow-y: auto`; virtualization is a future optimization |
| Q8 | How should server-side proxy connections be garbage-collected? | Leaked connections if UI disconnects without calling disconnect | **TTL-based** — auto-close connections idle for >5 minutes; heartbeat polling from UI keeps alive |

### Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Browser CORS blocks WebSocket connections | Medium | Phase 1 blocked for some endpoints | **Mitigated ✅** — Server proxy is default from Phase 1B; custom TLS added in Phase 3D |
| R2 | Large message payloads cause UI jank | Medium | Message log becomes slow | Virtual scrolling, message truncation, cap enforcement |
| R3 | Long-lived connections leak memory in the hook | Low | Browser tab becomes unresponsive | Cleanup on unmount, max message cap, WeakRef for event listeners |
| R4 | Socket.IO protocol changes break codec | Low | Phase 3B regression | Pin to Socket.IO v4 protocol; test against multiple versions |
| R5 | `tokio-tungstenite` API changes break Tauri transport | Low | Phase 6 regression | Pin dependency version; wrapper abstraction |
| R6 | WebSocket echo servers become unreliable for testing | Medium | Manual testing blocked | Docker-based local echo server as primary; public servers as fallback |
| R7 | Server proxy connection pool leaks memory on abnormal UI disconnect | Medium | Server OOM over time | TTL-based garbage collection (5-min idle timeout); max connection cap per client |
| R8 | Message polling latency too high for real-time feel | Low | UX feels sluggish compared to direct WebSocket | SSE (Server-Sent Events) push for messages instead of polling; fallback to 100ms polling interval |

---

## Dependencies & Prerequisites

| Dependency | Required For | Status | Notes |
|---|---|---|---|
| Browser `WebSocket` API | Phase 1 | ✅ In use | Universal support (all modern browsers) |
| `ws` npm package | Phase 1B (server proxy) | ✅ In use | Server-side WebSocket library; used from Phase 1B onward |
| `tokio-tungstenite` crate | Phase 6 | ⬜ Future | Async WebSocket client for Rust/Tauri |
| Docker + echo server image | All phases (testing) | ✅ Available | `jmalloc/echo-server` for manual testing |
| Socket.IO echo server | Phase 3B (testing) | ✅ Available | Docker compose in `docker/websocket/socketio/` |
| RabbitMQ + STOMP plugin | Phase 3C (testing) | ✅ Available | Docker compose in `docker/websocket/stomp/` |
| GraphQL subscription server | Phase 3E (testing) | ✅ Available | Docker compose in `docker/websocket/graphql/` |

---

## Implementation Order & Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5A–5E ──→ Phase 5F
  ✅           ✅          ✅           ✅           ✅            📋 Next
                                                                    │
Phase 6 (independent, can start anytime after Phase 1)              │
  📋                                                                │
                                                   Only 2 items remain ─┘
```

- **Phase 1** ✅ — Foundation: UI, server proxy, connection lifecycle, message log
- **Phase 2** ✅ — Depends on Phase 1: persistence, profiles, templates, auto-reconnect
- **Phase 3** ✅ — Depends on Phase 2: protocol codecs, auto-handshakes, TLS config, profiles store protocol mode
- **Phase 4** ✅ — Depends on Phase 1 + Phase 3 (workflow nodes reuse the server proxy and protocol codecs). **Complete.**
- **Phase 5** ✅ (5A–5E) / 📋 (5F) — Phase 5A–5E complete. Phase 5F (Data Mapper & Export/Import) pending.
- **Phase 6** 📋 — Depends on Phase 1 only (types alignment with `contracts.ts`): sub-phases 6A → 6B → 6C → 6D → 6E

### Estimated Effort

| Phase | Estimated Effort | New Files | Modified Files | Tests | Status |
|---|---|---|---|---|---|
| Phase 1 (1A + 1B) | 4–5 days | ~20 | ~3 | ~140 test cases | ✅ Done |
| Phase 2 (2A + 2B + 2C) | 2–3 days | ~10 | ~8 | ~180 test cases | ✅ Done |
| Phase 3 (3A–3E) | 3–4 days | ~12 | ~14 | ~200+ test cases | ✅ Done |
| Phase 4 (4A–4E) | 5–7 days | 12 | 19 | ~120 test cases | ✅ Done |
| Phase 5A–5E | 7–9 days | 12 | 19 | 573+ test cases | ✅ Done |
| Phase 5F | 1–2 days | 2 | 2 | ~20 test cases | 📋 Next |
| Phase 6 (6A–6E) | 6–8 days | 12 | 7 | ~90 test cases | 📋 Planned |
| **Total** | **26–35 days** | **~78 files** | **~67 modifications** | **~1300+ test cases** |

> **Note:** Phase 4 completed with 12 new files + 19 modified files. 5 bugs found and fixed during implementation (see "Bugs Found & Fixed" section below). All sub-phases (4A–4E) delivered including canvas nodes, config panels, engine handlers, runner wiring, trace capture, and Results Explorer labels.

> **Note:** Phase 5A–5E completed with 573+ tests. 18 bugs found and fixed across 4 review passes. Phase 5F (Data Mapper + Export/Import) remains pending — estimated 1–2 days for `wsExtractionAdapter` + import normalization.

> **Note:** Phase 6 effort was revised upward from original 3–4 days to 6–8 days after the detailed re-evaluation revealed 19 files (12 new + 7 modified) across 5 sub-phases. The scope increase from 5–7 to 6–8 days reflects: `ws_ping` native command (missing from original), major `websocketClient.ts` refactor (no transport override infrastructure existed), protocol auto-respond duplication for event-driven path, error code alignment with `contracts.ts`, ping/pong split-stream validation spike, and idle connection GC consideration. The original plan only listed 10 files and missed the entire TypeScript bridge layer (`setWsClientTransport`, `main.tsx` registration), Studio event-driven integration, transport selection logic, platform-aware UX updates, and the read/write split architecture for the Rust connection handler.

---

## Re-evaluation Notes

### Phase 1–2 Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 1 | **Accuracy** | `echo.websocket.org` referenced as public echo server — offline since 2022 | Replaced with Docker `jmalloc/echo-server` as primary, added note never to reference `echo.websocket.org` |
| 2 | **Accuracy** | ASCII mockup URL used `wss://echo.websocket.org` | Changed to `ws://localhost:8765` |
| 3 | **Architecture (critical)** | Plan stated "no server-side work for Phase 1" — but browser `WebSocket` API **cannot set custom HTTP headers** on handshake | Added Express proxy from Phase 1 (same pattern as Kafka); documented browser-direct as optional optimization |
| 4 | **Documentation** | `WsConnectionState` includes `'closing'` without explaining why it differs from Kafka's states | Added inline comment explaining WebSocket-specific `closing` state (readyState=2) |
| 5 | **Type duplication** | `WsConnectionProfile` defined twice — Phase 1 and Phase 2 with different fields | Removed Phase 1 definition; Phase 1 uses `WsConnectionDraft` only; `WsConnectionProfile` deferred to Phase 2 |
| 6 | **Consistency** | `websocketStorage.ts` listed in Phase 1 architecture tree but not in Phase 1 new files (storage is Phase 2) | Removed from Phase 1 architecture; storage stays in Phase 2 |
| 7 | **Architecture** | Phase 1 New Files didn't include server-side files after adding the proxy | Added `contracts.ts`, `websocket-service.ts`, `websocket-routes.ts` to Phase 1 files |
| 8 | **Phase overlap** | Phase 3D (server proxy) was entirely redundant with the new Phase 1 proxy | Phase 3D now only covers advanced TLS/mTLS features on top of existing proxy |
| 9 | **File map error** | Phase 3 file map still listed `contracts.ts`, `websocket-proxy-service.ts`, `websocket-routes.ts` as NEW | Updated to `MODIFY` for existing service; removed duplicate entries |
| 10 | **Phase 3 criteria** | Success criteria referenced "CORS bypass mode" as Phase 3 feature — now handled by Phase 1 proxy | Updated to focus on TLS-specific criteria |
| 11 | **Cross-platform** | `Cmd+Enter` shortcut not cross-platform for Tauri desktop (Windows/Linux use Ctrl) | Added `Ctrl+Enter` as alternative throughout |
| 12 | **CSS architecture** | CSS was planned to go in `settings.css` (already ~250+ lines of Kafka CSS) | Created dedicated `websocket-studio.css` file to avoid monolithic file |
| 13 | **File map inconsistency** | Bottom file map referenced `settings.css MODIFY` instead of new CSS file | Fixed to `websocket-studio.css NEW` |
| 14 | **Dependency diagram** | Phase 6 shown branching from Phase 4; actually only depends on Phase 1 | Updated diagram to show Phase 6 branching directly from Phase 1 |
| 15 | **Effort estimate** | Phase 1 estimate (3-4 days) didn't account for server proxy work | Updated to 4-5 days with ~20 files |
| 16 | **Missing risk** | No mention of server proxy connection leak risk | Added Q8 (TTL-based GC) and R7 (connection pool leak mitigation) |
| 17 | **Missing risk** | No mention of polling latency vs real-time feel | Added R8 (SSE push alternative to polling) |

### Phase 3D Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 18 | **Bug** | Profile loading doesn't reset TLS config — old TLS settings leaked into profiles without explicit TLS fields | `handleLoadProfile` now resets all TLS fields to `createDefaultTlsConfig()` before merging profile data |
| 19 | **Bug** | Case-sensitive `wss://` URL checks — `startsWith('wss://')` failed for `WSS://` or `Wss://` URLs | Added `.toLowerCase()` before all `wss://`/`ws://` checks in `useWebSocketStudio.ts`, `WebSocketStudioPage.tsx`, and `websocket-service.ts` |

### Phase 3E Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 20 | **CSS** | Missing styling for GraphQL-WS `ping` message type — `data-type="pong"` had muted styling but `ping` inherited default bright color | Combined `ping` and `pong` rules: `.ws-message-type-protocol[data-type="ping"], [data-type="pong"]` → `color: var(--text-tertiary)` |

### Phase 4 Plan Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 21 | **Plan gap (critical)** | Original Phase 4 plan was too broad and missed 12+ required integration points | Broke Phase 4 into 5 sub-phases (4A–4E) with exhaustive file lists for each |
| 22 | **Missing files** | No canvas node components planned; config panels placed in wrong directory (`modals/` instead of `configs/`) | Added 4 canvas node files; corrected config panel paths to `components/configs/` |
| 23 | **Missing integration** | `graphRunnerHelpers.ts` (`findStartNodes`) not listed — `wsTrigger` wouldn't be recognized as trigger type | Added 4D.3 step for `findStartNodes` update |
| 24 | **Missing integration** | `workflowVariableHints.ts` not listed — WS node types would have no variable hints in the UI | Added 4B.6 step for `NODE_TYPE_META`, `NON_HTTP_TYPES`, and hint collectors |
| 25 | **Missing integration** | `useWorkflowExecution.ts` not listed — `buildWsNodeOperations()` would never be called | Added 4D.4 step for execution hook wiring |
| 26 | **Missing integration** | `graphLoadRunner.ts` and `graphRunnerSubWorkflowHandler.ts` not listed — load testing and sub-workflows would fail with WS nodes | Added 4D.5 and 4D.6 steps for passthrough |
| 27 | **Missing integration** | `useWorkflowCanvasSync.ts` not listed — WS node config modals would use narrow width | Added 4A.6 step for wide modal types list |
| 28 | **Missing integration** | `nodeTypeLabels.ts` not listed — WS results would show as "Unknown" in console/explorer | Added 4E.1 step for labels |
| 29 | **Missing type** | `CapturedWsNodeDetails` and trace enrichment fields not defined | Added 4D.7 for trace types in `src/shared/types/trace.ts` |
| 30 | **Missing type** | `transportType` on `RequestResult` not extended for WS types | Added 4D.8 for `transportType` union extension in `src/shared/types/index.ts` |
| 31 | **Architecture** | No design for stateful WebSocket connection lifecycle management within workflows | Added "Connection Lifecycle Design" section with `WsNodeOperations` interface, internal connection registry, and `disconnectAll()` cleanup in `graphRunner` finally block |
| 32 | **Missing CSS** | No workflow CSS classes for WS node canvas styling | Added 4A.7 step for workflow CSS |
| 33 | **Effort estimate** | Original 3–4 days severely underestimated for 31 files (12 new + 19 modified) | Revised to 5–7 days |

### Plan Document Update (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 34 | **Status tracker** | Phase 3C–3E grouped as "Planned" despite being completed | Split into separate rows: 3C, 3D, 3E all marked ✅ Done; Phase 4 broken into 5 sub-phase rows |
| 35 | **Feature matrix** | 14 features still showed ⬜ despite being completed in Phases 2A–3E | Updated all to ✅ with correct phase; added GraphQL-WS and TLS/mTLS rows |
| 36 | **Phase 3 title** | Heading said "(SockJS, STOMP, Socket.IO)" — SockJS was never implemented; GraphQL-WS and TLS missing | Changed to "(Socket.IO, STOMP, TLS/mTLS, GraphQL-WS)"; added SockJS deferral note |
| 37 | **Protocol table** | SockJS listed without noting it was deferred | Added status column; SockJS marked "⬜ Deferred" with rationale |
| 38 | **Phase 3 files** | Listed non-existent `WebSocketSocketIoPanel.tsx`, `WebSocketStompPanel.tsx`, `WebSocketGraphQLPanel.tsx` | Removed; compose modes are inline in `WebSocketMessageLog.tsx` |
| 39 | **Phase 3 files** | Listed `WebSocketTlsConfig.tsx` — actual file is `WebSocketTlsPanel.tsx` | Corrected filename |
| 40 | **Phase 3 files** | Bottom file map missing 10+ modified files (hook, connect panel, studio page, tests, CSS) | Added all modified files with sub-phase annotations |
| 41 | **Phase 4 files** | Bottom file map only had 9 entries — actual plan requires 31 (12 new + 19 modified) | Replaced with full new/modified tables with sub-phase annotations |
| 42 | **Type defs** | Referenced non-existent `websocketConfig.ts` | Updated to reflect actual files; added status column (✅ Exists / ⬜ Future) |
| 43 | **Dependencies** | `ws` package listed as "Phase 3D" — actually used from Phase 1B | Updated to "Phase 1B (server proxy)" with ✅ In use status |
| 44 | **3A success criteria** | Said protocols show "(coming soon)" — all are now available | Updated to note original coming-soon was enabled in 3B/3C/3E |
| 45 | **Open questions** | Q2, Q3, Q6 resolved during implementation but still showed original status | Updated with "Resolved ✅" status and implemented details |
| 46 | **Effort estimates** | Phase totals didn't include test counts from completed phases | Updated all phases with actual test counts; added status column |

### File Architecture Alignment (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 47 | **File mismatch** | Plan listed `WebSocketComposeBar.tsx` as separate component — never created; compose bar integrated into `WebSocketMessageLog.tsx` | Updated Phase 1 architecture, file tree, component render flow, and bottom file map |
| 48 | **File mismatch** | Plan listed `WebSocketStatusBar.tsx` as separate component — status display integrated into `WebSocketConnectPanel.tsx` | Updated Phase 1 UI sections and component render flow |
| 49 | **File mismatch** | Plan listed `WebSocketStudioGuard.tsx` as separate component — guard rendered inline in `WebSocketStudioPage.tsx` | Updated component render flow |
| 50 | **Hook consolidation** | Plan listed `useWebSocketConnection.ts` + `useWebSocketMessageLog.ts` as separate hooks — consolidated into single `useWebSocketStudio.ts` | Updated Phase 1 architecture, file tree, test plan |
| 51 | **File mismatch** | Plan listed `websocketConfig.ts` as separate types file — merged into `types.ts` | Updated architecture tree and file map |
| 52 | **File mismatch** | Plan listed `src/features/websocket/types.ts` — never created; all types in `src/shared/websocket/types.ts` | Updated file tree |
| 53 | **Route location** | Plan listed `src-server/websocket/websocket-routes.ts` — actual location is `src-server/routes/websocket-routes.ts` | Updated server-side file tree |
| 54 | **Missing files in plan** | `wsMessageUtils.ts`, `wsProtocolHelpers.ts`, test files for client/types/contracts not in plan | Added all actual files to file tree and test plan |
| 55 | **Test plan** | Test plan referenced non-existent `useWebSocketConnection.test.ts`, `useWebSocketMessageLog.test.ts`, `WebSocketComposeBar.test.tsx`, `WebSocketStatusBar.test.tsx` | Replaced with actual test files; added 11 entries for server-side and utility test files |
| 56 | **Phase 2 render flow** | Phase 2A render flow still referenced `StatusBar` and `MessageLog (inline)` | Updated to actual component structure with integrated status display and TLS panel |

### Phase 5 Plan Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 57 | **Plan gap (critical)** | Original Phase 5 was ~70 lines with no sub-phases, missing 16+ required integration points | Broke Phase 5 into 6 sub-phases (5A–5F) with 12 new files, 16 modified files, and exhaustive integration checklists |
| 58 | **Missing sub-phasing** | Single monolithic phase for types + execution + assertions + UI + results + data mapper | Created 6 sub-phases with clear dependency chain: 5A → (5B, 5C, 5F parallel) → 5D → 5E |
| 59 | **Missing executor wiring** | Plan mentioned `wsExecution.ts` but didn't detail how it hooks into `requestExecution.ts` | Added 5B.2 detailing `executeNonHttp` dispatch extension, same pattern as Kafka |
| 60 | **Missing data source expansion** | Plan mentioned parameterized scenarios but didn't specify `dataSourceExpander.ts` changes | Added 5B.3 with specific interpolation targets for all 3 WS action config fields |
| 61 | **Missing worker path fix** | Plan didn't address broken worker routing for non-HTTP scenarios (Kafka has same bug) | Added 5B.4 — `executionWorker.ts` must build ops for all execution modes, not just workflow |
| 62 | **Missing Rust executor guard** | Plan didn't address `canUseRustExecutor()` silently routing WS scenarios to Rust HTTP executor | Added 5B.5 — exclude WS (and Kafka) from Rust executor path |
| 63 | **Missing assertion context** | Plan listed assertion paths but didn't specify `AssertionContext.wsContext` interface or `buildValidationResult` integration | Added 5C.1 with full `wsContext` interface and 5C.4 for validation result passthrough |
| 64 | **Missing custom expression paths** | Plan didn't address `resolveVariable()` in custom assertion expressions for `ws.*` paths | Added 5C.3 for `validatorCustomExpression.ts` modification |
| 65 | **Missing assertion presets** | Plan didn't specify `ADD_ASSERTION_MENU_ROWS` extension for WS-specific assertion templates | Added 5D.3 with 5 WS assertion presets and transport-conditional visibility |
| 66 | **Missing assertion row editor** | Plan didn't detail `AssertionRowEditor.tsx` changes for `wsField` rendering | Added 5D.4 with target selector, operator dropdown, and badge label |
| 67 | **Missing action type selector** | Plan listed `WsScenarioEditor.tsx` but didn't specify the `TestEditorModal` changes needed to switch between transport types | Added 5D.1 with full transport selector design (HTTP/Kafka/WS) |
| 68 | **Missing results consolidation** | Plan mentioned results rendering but didn't address scattered inline ternary chains across 4+ result components | Added 5E.1 with shared `transportLabels.ts` helper to replace all inline chains |
| 69 | **Missing response detail modal** | Plan didn't address `ResponseDetailModal` which always shows HTTP status badge even for non-HTTP results | Added 5E.2 — transport-aware detail sections for HTTP/Kafka/WS |
| 70 | **Missing report generator** | Plan didn't address HTML/MD/JSON report generation for WS results | Added 5E.3 for `reportGenerator.ts` updates |
| 71 | **Missing connection lifecycle design** | Plan didn't explain how WS connections are managed across chained tests within a TestScenario | Added "Connection Lifecycle in Harness" section with `connectionRef` chaining design and cleanup strategy |
| 72 | **Missing design decisions** | Plan didn't document rationale for key architectural choices (reuse WsNodeOperations, wsField vs generalize, etc.) | Added "Design Decisions" table with 8 rationale entries |
| 73 | **Missing scenario migration** | Plan didn't address `scenarioMigration.ts` for backward compatibility of WS action types | Added 5A.6 for action type normalization |
| 74 | **Missing import validation** | Plan mentioned export/import but didn't specify import-time validation for WS scenarios | Added 5F.2 with `validateWsActionConfig()` on import |
| 75 | **Missing test execution hook** | Plan didn't address `useTestExecution.ts` which needs to build and pass `wsOperations` | Added 5B.6 for test execution hook wiring |
| 76 | **Incomplete rationale table** | Plan had no transport comparison table showing HTTP vs Kafka vs WS patterns | Added "Phase 5 Rationale" section with 7-row comparison table showing the parallel patterns |
| 77 | **Effort underestimate** | Original plan implied ~6 files; actual scope is 28 files (12 new + 16 modified) | Updated effort estimate to 7–9 days across 6 sub-phases |

### Phase 6 Plan Re-evaluation #2 (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 177 | **Wrong `commands.rs` role (critical)** | Plan 6A.6 says `commands.rs` is a re-export surface (`pub use super::lifecycle::{...}`). Kafka's `commands.rs` only contains integration test comments. `lib.rs` registers commands via **direct module paths** (`kafka::lifecycle::kafka_connect`, etc.) | Rewrote 6A.6 as "integration tests only"; updated 6A.7 to use direct paths; corrected 6A Files table |
| 178 | **Rust file count** | Plan listed 8 new Rust files; Kafka module has 9 files (including `commands.rs` as a full file, not just re-exports) | Updated to 9 new Rust files in summary |
| 179 | **Error code mismatch (critical)** | Plan used `WS_CONNECT_ERROR`, `WS_SEND_ERROR`, `WS_ALREADY_CONNECTED` — server contracts use `WS_CONNECT_FAILED`, `WS_SEND_FAILED`, no `WS_ALREADY_CONNECTED`; server has `WS_INVALID_URL` which plan omitted | Updated 6A.4 with corrected error codes aligned to `contracts.ts`; added `WS_INVALID_URL`; removed `WS_ALREADY_CONNECTED` |
| 180 | **TLS field naming mismatch** | Plan used `request.tls_config` but server `contracts.ts` uses `tls` as the field name; plan used `message` but server uses `data` | Updated 6A.3 types: `tls` (not `tls_config`), `data` (not `message`); added design decision |
| 181 | **Missing `ws_ping` command (critical)** | Server proxy supports `ping` operation used by Studio's `sendPing()` button, but plan only listed 5 native commands (no ping). Without `ws_ping`, the ping button breaks on Tauri desktop | Added 6C.5 `ws_ping` command; updated `generate_handler!` to 6 commands; added `Ping` variant to `WsOutboundMessage`; updated COMMAND_MAP |
| 182 | **`messages` vs events semantics** | Plan mapped proxy `messages` operation to `ws_receive_next`, but they serve different purposes: `messages` = ring-buffer poll for Studio UI; `ws_receive_next` = programmatic blocking receive for runner/workflow. Studio on native should use **events**, not `ws_receive_next` | Updated 6D.1 COMMAND_MAP: `messages` → `'_events'` (no invoke); added design notes clarifying the distinction |
| 183 | **Studio helper name wrong** | Plan said `appendFrame()` for message append — actual helpers are `appendMessage()` and `appendMessages()` | Corrected in 6E.1 |
| 184 | **`websocketClient.ts` missing infrastructure** | Plan said "add transport override" implying minor change, but `websocketClient.ts` currently has NO `transportOverride`, NO `setWsClientTransport()`, NO `WsClientTransport` type, NO `WsDispatchRequest` type — this is a **major refactor**, not a small addition | Updated 6D.2 to list all required new infrastructure; updated 6D Files to note "major refactor" |
| 185 | **Kafka connect param wrapping** | Kafka's native transport has special-case connect (no `paramKey` — body is `{ connection: {...} }` directly). WS connect should use consistent `{ request: body }` wrapping | Added note to 6D.1 about consistent param wrapping |
| 186 | **`messages` server-proxy escape hatch** | Kafka's native transport still routes certain ops via `'_server_proxy'` (schema registry, subscription-messages, topic-detail). WS may need similar for operations not implemented in native | Documented as consideration; `messages` mapped to `'_events'` which handles the main case |
| 187 | **Missing idle connection GC** | Express proxy has 5-minute idle TTL + 60-second GC cycle. Native module has no equivalent — leaked connections would persist until app restart | Added 6C.8 with optional idle GC design; deferred to polish per design decision |
| 188 | **`isProxyMode` based on draft, not actual transport** | TLS panel's `isProxyMode` is computed from draft state (`hasCustomHeaders \|\| hasTlsOverrides`), not from actual `transportMode` after connection | Added note to 6E.2 that `isProxyMode` should reflect actual transport |
| 189 | **Kafka TLS uses OpenSSL, not rustls** | Plan's rustls rationale said "consistent with Kafka" — wrong. Kafka native uses **librdkafka/OpenSSL**. The rustls alignment is with `reqwest`, not Kafka | Corrected design decisions table to note the distinction |
| 190 | **Protocol auto-respond in event handler (critical)** | `checkAutoRespond()` runs inside the polling loop after receiving messages (handles Socket.IO PING/PONG, STOMP heartbeats, GraphQL-WS keepalive). Without duplicating this in the event handler, protocol-level keepalive breaks on native transport | Added to 6E.1 checklist with emphasis |
| 191 | **GraphQL-WS init on native connect** | Proxy connect sends `connection_init` via `dispatchWsOperation('send')`. On native transport, the same init must fire — should work transparently if `dispatchWsOperation` is already routed through native transport | Added note to 6E.1 confirming transparent handling |
| 192 | **Status result shape mismatch** | Plan simplified `WsStatusResult` to 5 fields; server returns rich `WsProxyStatusResult` with `uptimeMs`, `sentCount`, `receivedCount`, `closeCode`, etc. Rust types must match for parity | Updated 6A.3 `WsStatusResult` to include all server fields |
| 193 | **Missing `meta.timestamp` in envelope** | Server's `WsEnvelopeMeta` includes `timestamp` (ISO string) and optional `requestId`/`durationMs` — plan's envelope only had `durationMs` | Updated 6A.4 envelope to include `timestamp` |
| 194 | **`transportMode` extension** | Current `transportMode: 'direct' \| 'proxy'` needs `'native'` added for Tauri native transport | Added to 6E.2 and success criteria |
| 195 | **Ping/pong split-stream caveat** | With `StreamExt::split()`, tungstenite queues pong on read but pongs only flush through write half on subsequent activity. Plan's "auto-pong handled by tungstenite" is **partially incorrect** for split-stream architecture | Added caveat note to 6B.2; added "validate via spike" to success criteria |
| 196 | **Effort revision** | Scope expanded with `ws_ping` command, major `websocketClient.ts` refactor, protocol auto-respond duplication, and error code alignment | Revised from 5–7 to 6–8 days; updated test estimate to ~90 |

### Phase 6 Plan Re-evaluation #1 (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 78 | **Plan gap (critical)** | Original Phase 6 was ~60 lines with no sub-phases, missing the entire TypeScript bridge layer, Studio integration, and transport selection logic | Broke Phase 6 into 5 sub-phases (6A–6E) with 12 new files, 7 modified files, and exhaustive integration checklists |
| 79 | **Missing sub-phasing** | Single monolithic phase for Rust + TS bridge + Studio integration + parity tests | Created 5 sub-phases with sequential dependency chain: 6A → 6B → 6C → 6D → 6E |
| 80 | **Missing TypeScript transport override** | Plan listed `websocketNativeTauriTransport.ts` but didn't specify `setWsClientTransport()` pattern in `websocketClient.ts` (Kafka has `setKafkaClientTransport()`) | Added 6D.2 with transport override pattern mirroring `kafkaClient.ts` |
| 81 | **Missing `main.tsx` registration** | Plan didn't address how native transport is wired on app startup (Kafka does this in `main.tsx`) | Added 6D.3 with `setWsClientTransport(wsNativeTauriTransport)` alongside Kafka registration |
| 82 | **Missing event listeners** | Plan mentioned `ws-message` events but didn't define `listenWsMessage()` or `listenWsConnectionClosed()` TypeScript helpers | Added 6D.1 with both event listener exports (mirror `listenKafkaSubscriptionMessage`) |
| 83 | **Missing Studio integration** | Plan didn't address how `useWebSocketStudio.ts` switches from 200ms polling to event-driven on Tauri | Added 6E.1 with event-driven message reception replacing polling loop |
| 84 | **Missing transport selection logic** | Plan didn't specify when native Tauri replaces proxy (custom headers, TLS overrides → native, not proxy) | Added 6E.2 with `useNativeTauri` flag and transport selection rules |
| 85 | **Missing TLS UX update** | `WebSocketTlsPanel` says "only applies when using proxy transport" — wrong once native Tauri transport exists | Added 6E.3 with platform-aware description |
| 86 | **Missing transport indicator** | Plan didn't specify how the user knows which transport is active (native vs proxy vs direct) | Added 6E.4 with transport mode indicator in `WebSocketConnectPanel` |
| 87 | **Missing read/write split design** | Plan didn't explain how the Rust WebSocket connection handles concurrent read and write operations | Added "Read/Write Split Design" section with `mpsc` channel for writes and `tokio::spawn` for read loop |
| 88 | **Missing message module** | Kafka has `message.rs` for format conversion; original plan omitted equivalent for WebSocket | Added 6C.1 with `message.rs` for `tokio_tungstenite::Message` ↔ application type conversion |
| 89 | **Missing connection close event** | Plan only mentioned `ws-message` events; didn't specify `ws-connection-closed` event for connection state tracking | Added `ws-connection-closed` event emission from read loop + `listenWsConnectionClosed()` listener |
| 90 | **PKCS12 scope creep** | Plan mentioned "PEM/PKCS12" support but Express proxy only supports PEM; no PKCS12 precedent in codebase | Scoped to PEM only; documented rationale in Design Decisions |
| 91 | **Missing `Cargo.toml` specifics** | Plan said "requires Rust toolchain" but didn't specify `tokio-tungstenite` dependency or TLS feature flags | Added 6A.1 with exact dependency line and feature flag: `rustls-tls-native-roots` |
| 92 | **Missing `lib.rs` specifics** | Plan listed `.manage()` and `generate_handler!` vaguely; didn't identify all 5 commands to register | Added 6A.7 with exact command paths for `generate_handler!` |
| 93 | **Missing connection architecture diagram** | Plan had no diagram showing how TypeScript dispatches through native vs proxy transport | Added "Connection Architecture" diagram and "Read/Write Split Design" diagram |
| 94 | **TLS field naming mismatch** | Kafka Rust uses `ca_pem`/`cert_pem`/`key_pem`; WS `contracts.ts` uses `caCert`/`clientCert`/`clientKey` | Specified 6A.3: WS Rust types align with `contracts.ts` naming (serde handles case mapping) |
| 95 | **Missing design decisions table** | Plan didn't document rationale for key choices (rustls vs native-tls, Mutex type, PEM only, etc.) | Added "Design Decisions" table with 9 rationale entries |
| 96 | **Effort underestimate** | Original plan estimated 3–4 days with 10 files; actual scope is 19 files (12 new + 7 modified) | Updated to 5–7 days across 5 sub-phases |
| 97 | **Missing Kafka comparison table** | Plan didn't show how WebSocket Tauri module maps to the proven Kafka module pattern | Added "Phase 6 Rationale" table with 8-row Kafka vs WebSocket comparison |

### Phase 1 Plan Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 98 | **False success criterion** | "Ping button sends WebSocket ping frame" marked ✅ but not implemented — browser `WebSocket` API cannot send raw ping frames (`ws.ping()` is only available server-side in the `ws` library) | Unmarked ✅ → deferred with explanation; added to "Deferred from original Phase 1 scope" list |
| 99 | **False success criterion** | "Control frame toggle (show/hide ping/pong/close)" marked ✅ but not implemented — browser `WebSocket.onmessage` does not surface WebSocket-level control frames (ping/pong are handled internally by the browser) | Unmarked ✅ → deferred; protocol-level keepalives are handled by `wsProtocolHelpers` in Phase 3 |
| 100 | **False success criterion** | "Export button downloads JSON with all messages" marked ✅ but not present in `WebSocketMessageLog` toolbar | Unmarked ✅ → noted as not implemented; profile export exists in Saved tab (Phase 2A) |
| 101 | **Missing type field** | `WsConnectionSnapshot.latencyMs` exists in implementation but was absent from plan's Phase 1 type block | Added `latencyMs?: number` to plan's `WsConnectionSnapshot` definition |
| 102 | **Stale type field** | `WsFrame.latencyMs` was in plan but not in implementation; `WsFrame.protocolMeta` exists in implementation but not in plan | Updated plan: removed `latencyMs`, added `protocolMeta?: WsFrameProtocolMeta` (Phase 3B+) |
| 103 | **Route mount path** | Plan said `src-server/routes/index.ts MODIFY` — file does not exist; routes are mounted in `src-server/webhook-server.ts` via `createWebSocketRouter()` | Updated all references from `routes/index.ts` to `webhook-server.ts` |
| 104 | **CSS class names** | 9 CSS class names in plan diverged from implementation (e.g., `.ws-compose-actions` → `.ws-compose-controls`, `.ws-connect-headers` → `.ws-connect-kv-section`, `.ws-message-detail` → `.ws-detail-panel`) | Updated entire CSS class list to match actual implementation |
| 105 | **Detail panel UX** | Plan said "detail panel slides in from right" — actual implementation is a resizable bottom panel with JSON/Raw/Hex tabs (Phase 2B redesign) | Updated description to "resizable detail panel at bottom" |
| 106 | **Undocumented files** | `KeyValueEditor.tsx` and `useDropdownClose.ts` (+ their tests) extracted during implementation but not in plan's Phase 1 file list | Added 4 files to Phase 1 New Files and bottom file map |
| 107 | **Client transport description** | Plan described `websocketClient.ts` as "proxy or browser-direct" — it's proxy-only HTTP dispatch; browser-direct `new WebSocket()` lives in `useWebSocketStudio.ts` | Updated description and added transport note |
| 108 | **Missing import** | `WebSocketConnectPanel.tsx` uses `WsKeyValueEntry` type at lines 123 and 128 but never imports it — TypeScript infers it from `WsConnectionDraft.headers` type but it's a code quality issue | Documented as implementation bug to fix |

### Phase 2 Plan Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 109 | **Type drift** | `WsReconnectState.enabled` in plan but actual implementation uses `active`; plan includes `intervalMs` and `backoffMultiplier` on state object but they're not on the actual state (interval lives as `reconnectIntervalMs` on hook, backoff was hardcoded) | Updated `WsReconnectState` interface: `active`, `attempt`, `maxAttempts`, `nextRetryAt`, `lastError?`, `lostAt?`; backoff is now configurable via `setBackoffMultiplier()` (Mockup Alignment M29) |
| 110 | **CSS class naming drift** | 14 CSS class names in plan differ from actual implementation (e.g., `.ws-saved-tab` → `.ws-saved-container`, `.ws-saved-card-meta` → `.ws-saved-card-tags`, `.ws-saved-card-tag` → `.ws-saved-tag`, `.ws-saved-import-export` → `.ws-saved-footer`, `.ws-close-code-menu` → `.ws-close-code-dropdown`, `.ws-close-code-preset` → `.ws-close-preset-btn`) | Updated all CSS class names in plan to match actual implementation |
| 111 | **Missing CSS classes** | Plan didn't list 10+ CSS classes that exist in implementation: `.ws-saved-success`, `.ws-reconnect-label`, `.ws-reconnect-text`, `.ws-reconnect-cancel-btn`, `.ws-close-code-title`, `.ws-close-code-input`, `.ws-close-reason-input`, `.ws-close-code-actions`, `.ws-close-code-error`, `.ws-json-null`, `.ws-editor-*` classes | Added all missing CSS classes to plan |
| 112 | **Reconnect UI restored** | Plan originally specified spinner + progress dots but implementation initially used simpler text banner | Mockup Alignment M30–M33 added spinner (`.ws-reconnect-spinner`), progress dots (done/current/pending with pulse animation), countdown timer, backoff label, and failed state with "Retry Now" button to match Phase 2C mockup — fully implemented |
| 113 | **Hook return naming** | Plan says `profileToDraft(id)` on hook but actual implementation is `loadProfileAsDraft(id)` (standalone `profileToDraft()` exists as helper in `types.ts`) | Updated `UseWebSocketProfilesReturn` to use `loadProfileAsDraft` |
| 114 | **Missing hook function** | `updateTemplate(id, patch)` exists on `useWebSocketTemplates` hook but not documented in plan's `UseWebSocketTemplatesReturn` | Added `updateTemplate` to plan type definition |
| 115 | **WsCloseDetail.reason optionality** | Plan says `reason: string` (required) but actual implementation is `reason?: string` (optional) | Updated plan to `reason?: string` |
| 116 | **Profile type undocumented fields** | `WsConnectionProfile` in plan's Phase 2 type block omits `protocolMode` (Phase 3A) and `tlsConfig?` (Phase 3D) which are in the actual type since Phases 3A/3D | Added both fields to plan's Phase 2 type block with phase annotations |
| 117 | **Undocumented helper functions** | `profileToDraft()`, `draftToProfileFields()`, `createDefaultReconnectState()`, `formatUptime()` exported from `types.ts` but not in plan | Added note listing standalone helper functions |
| 118 | **Server-side contradiction** | Plan line 889 says "no server changes needed for Phase 2C" but Phase 2 New Files Summary lists `contracts.ts`, `websocket-service.ts`, `websocket-routes.ts` as MODIFY | Removed server files from Phase 2 New Files Summary; added clarifying note that server support predates Phase 2C |
| 119 | **Import is file-only** | Plan says "File upload or paste JSON" for import but actual implementation only supports file upload (no paste JSON UI) | Updated plan to "file upload" only; paste JSON marked as deferred |
| 120 | **Config lock banner location** | Plan says "ConfigLockBanner (inline `<div>`)" in ConnectPanel but it's actually rendered in `WebSocketStudioPage.tsx` | Updated render flow to show banner rendered by StudioPage, not ConnectPanel |
| 121 | **Save as Profile UX** | Plan says profile editor modal opens for "Save as Profile" with name prompt, but implementation originally auto-named `Profile N` | Mockup Alignment M3: changed to open profile editor modal pre-filled with current draft via `prefillDraft` prop |
| 122 | **Reconnect config location** | Plan success criteria says "Configure max attempts and interval" in Connect panel but they were only in the profile editor modal | Mockup Alignment M30: added Auto-Reconnect Settings section with Max Attempts, Retry Interval, and Backoff Multiplier on the Connect panel |
| 123 | **Bottom file map incomplete** | Phase 2A bottom file map omits `WebSocketConnectPanel.tsx MODIFY` even though it's listed in Phase 2A scope | Added `WebSocketConnectPanel.tsx` and all test files to Phase 2 New Files Summary |
| 124 | **Missing mockup files** | Three Phase 2 mockup HTML files exist (`websocket-phase2a-saved-connections.html`, `phase2b-templates-format.html`, `phase2c-reconnect-close.html`) but aren't listed in plan or bottom file map | Documented as reference mockups (no plan update needed — mockups are working artifacts) |
| 125 | **Profile editor missing fields** | Profile editor modal doesn't expose `protocolMode` or `tlsConfig` fields — these are saved from studio state but not editable in the modal | Added note explaining this is acceptable UX (configure in Connect tab, save includes all) |
| 126 | **Import ignores tlsConfig** | `importProfiles()` does not restore `tlsConfig` from imported JSON (only `protocolMode` and reconnect fields) | Documented as known limitation — TLS configs contain sensitive material; import should probably skip them |

### Phase 2 Mockup Alignment (2026-06-08)

Compared implementation against three mockup HTML files and applied all corrections:
- `docs/mockups/websocket-phase2a-saved-connections.html`
- `docs/mockups/websocket-phase2b-templates-format.html`
- `docs/mockups/websocket-phase2c-reconnect-close.html`

| # | Phase | Gap | Fix Applied |
|---|---|---|---|
| M1 | 2A | `isValidWsUrl()` rejected `{{var}}` template URLs | Relaxed validation to accept `{{var}}` placeholders |
| M2 | 2A | No env variable resolution preview below URL | Added `→ Resolved: {url}` preview line; added `resolveEnvVars()` helper (resolves against empty env map until env context is wired) |
| M3 | 2A | "Save as Profile" silently auto-named `Profile N` | Changed to open profile editor modal pre-filled with current draft via `prefillDraft` prop |
| M4 | 2A | Config lock banner had no lock icon or Disconnect link | Added ⊘ icon + inline "Disconnect" link in banner |
| M5 | 2A | No `"Saved Connections"` title in Saved tab header | Added title text |
| M6 | 2A | Cards missing "Updated X ago" tag | Added `formatTimeAgo()` helper; render `updatedAt` relative time tag |
| M7 | 2A | Cards missing "env vars" tag for URLs with `{{` | Added detection + tag |
| M8 | 2A | Cards missing "mTLS" tag when `tlsConfig` has client cert/key | Added detection + tag |
| M9 | 2A | Cards missing "no headers" tag when zero enabled headers | Added tag |
| M10 | 2A | Footer missing `"N saved profiles"` count | Added count text |
| M11 | 2A | No card selection highlight on click | Added `.selected` class + click handler |
| M12 | 2A | Connect panel field order wrong (URL→Headers→Query→Sub) | Reordered to URL→Subprotocols→Headers→Query (matches mockup) |
| M13 | 2A | Profile editor missing "Connection Settings" section label | Added section label |
| M14 | 2A | Profile editor: 3 fields not in one 3-column row | Aligned Max Attempts / Retry Interval / Max Messages to 3-column layout |
| M15 | 2A | Profile editor: auto-reconnect label too short | Expanded label text |
| M16 | 2B | No Messages-tab status bar | Added status bar with dot, Connected label, URL, Uptime, counters, keyboard hints |
| M17 | 2B | No JSON syntax coloring in message log rows | Applied `tokenizeJson()` to log row body |
| M18 | 2B | Binary rows showed raw text instead of hex preview | Added `buildBinaryPreview()`: `[N bytes] 0x.. 0x.. ...` format |
| M19 | 2B | No sent/received row background tints | Added `ws-message-sent` / `ws-message-received` CSS tints |
| M20 | 2B | Message count not always visible in compose footer | Added permanent `{count} / {max} messages` in compose bottom bar |
| M21 | 2B | Template dropdown missing "Saved Templates" header | Added header text |
| M22 | 2B | Format selector missing "Format:" label | Added label before select element |
| M23 | 2B | Selected message row had no left accent border | Added 3px left accent border via `ws-msg-selected` class |
| M24 | 2B | Compose bar at top of message log (should be at bottom) | Moved compose bar below message list + detail panel |
| M25 | 2B | Detail panel timestamp missing milliseconds | Updated `formatDetailTimestamp` to include `.mmm` |
| M26 | 2B | Hex tab had no color differentiation | Added CSS color classes to offset/bytes/ascii columns via `buildHexDumpLines()` |
| M27 | 2B | No "Connected to URL" system message on connect | Added system frame on `ws.onopen` / proxy connect |
| M28 | 2B | No CLOSE SENT / CLOSE ACK system messages | Added CLOSE SENT frame before `ws.close()` and CLOSE ACK frame on `ws.onclose` |
| M29 | 2C | Backoff multiplier hardcoded (`1.5`), no UI | Added `WsBackoffMultiplier` type (`1 | 1.5 | 2`), `backoffMultiplier` field on `WsConnectionProfile`, dropdown on Connect panel + profile editor, configurable in hook |
| M30 | 2C | Max Attempts / Retry Interval only in profile editor, not on Connect panel | Added Auto-Reconnect Settings section with all three fields on Connect panel |
| M31 | 2C | Reconnect banner was plain text only | Added CSS spinner (`.ws-reconnect-spinner`), progress dots (done/current/pending with pulse animation), countdown text, backoff multiplier label |
| M32 | 2C | Reconnect failed was plain text | Added styled error card with last error, total downtime, Retry Now + Edit Connection buttons |
| M33 | 2C | `WsReconnectState` missing error tracking | Added `lastError` and `lostAt` fields; populated during reconnect lifecycle |
| M34 | 2C | Disconnect button not danger-styled | Added `ws-connect-btn-danger` CSS class |
| M35 | 2C | Close button label showed code number | Changed label to "Close with Code" (static text) |
| M36 | 2C | Status bar missing colored dot | Added `ws-status-dot` with connected/disconnected color states |
| M37 | 2C | Status bar missing "Uptime:" prefix | Added prefix |
| M38 | 2C | Status bar missing connected URL | Added URL display |
| M39 | 2C | Status bar counters not spaced | Added spaces: `↑ N ↓ N` |
| M40 | 2C | No `retryNow()` function for manual retry after failed reconnect | Added `retryNow()` to hook return interface |

**Type changes:**
- `WsConnectionProfile.backoffMultiplier?: WsBackoffMultiplier` — optional for backward compat
- `WsReconnectState.lastError?: string` — tracks last reconnect error
- `WsReconnectState.lostAt?: number` — timestamp when connection was lost
- `WsBackoffMultiplier = 1 | 1.5 | 2` — new type
- `resolveBackoffMultiplier(v)` — helper to resolve optional value to default
- `DEFAULT_BACKOFF_MULTIPLIER = 1.5` — exported constant

**New utility functions (`wsMessageUtils.ts`):**
- `resolveEnvVars(url, env)` — replaces `{{key}}` with env values
- `formatTimeAgo(isoDate)` — returns "Xm ago", "Xh ago", etc.
- `buildBinaryPreview(data, byteCount)` — hex snippet for log rows
- `buildHexDumpLines()` — structured hex dump with typed columns

**CSS additions (`websocket-studio.css`):**
- `.ws-reconnect-settings` — bordered reconnect settings card
- `.ws-reconnect-spinner` — spinning border animation
- `.ws-reconnect-dot`, `.done`, `.current`, `.pending` — progress dots
- `.ws-message-sent`, `.ws-message-received` — row background tints
- `.ws-status-dot`, `.connected`, `.disconnected` — colored status dots
- `.ws-connect-btn-danger` — red disconnect button
- `.ws-connect-env-preview` — env resolution preview text
- `.ws-messages-status-bar` — Messages tab status bar
- `.ws-reconnect-settings-row` — 3-column settings layout
- `.ws-message-close-sent`, `.ws-message-close-ack` — close event row styling
- `.ws-hex-offset`, `.ws-hex-bytes`, `.ws-hex-ascii` — hex view column colors

### Phase 2 Mockup Alignment Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| M41 | **Proxy system frame type (critical)** | Proxy transport connect appended system frame with `type: 'close'` instead of `type: 'text'`, causing it to render as a close event instead of an informational system message. Direct transport was correctly fixed in prior round but proxy path was missed | Changed proxy connect frame to `createFrame('received', 'text', ...)` with `isSystem: true` flag, matching the direct transport path |
| M42 | **System frame detection in MessageLog** | `isSystem` detection in message log only checked `frame.type === 'close'` or `meta?.isSystemPacket`, missing frames with the `isSystem` flag (e.g. "Connected to..." frames) | Added `(frame as WsFrame & { isSystem?: boolean }).isSystem` check to the `isSystem` const in the render loop |
| M43 | **System frame filter consistency** | When user unchecked "System Frames" toggle, `visibleMessages` filter only excluded `CONTROL_FRAME_TYPES` (ping/pong/close) and `isSystemPacket` — frames with `isSystem: true` flag would still appear | Added `isSystem` flag check to the `visibleMessages` filter alongside existing conditions |
| M44 | **System message CSS specificity** | System messages (e.g. "Connected to...") got both `ws-message-received` and `ws-message-system` classes, but `.ws-message-received` was defined later in CSS than `.ws-message-system`, overriding the system background. Per mockup, system rows should not have direction tints | Changed row class logic: when `isSystem` is true, the direction class (`ws-message-sent`/`ws-message-received`) is no longer applied, so `.ws-message-system` background takes effect. CLOSE SENT/ACK rows still get their own specific classes which override correctly |

**Re-evaluation rounds completed:** 4 rounds total (R1–R4). All rounds verified:
- `tsc -b --noEmit`: 0 errors
- `vitest`: 470 tests passed, 0 failures
- Files reviewed per round: `useWebSocketStudio.ts`, `WebSocketMessageLog.tsx`, `WebSocketConnectPanel.tsx`, `WebSocketSavedConnections.tsx`, `WebSocketMessageDetail.tsx`, `WebSocketStudioPage.tsx`, `wsMessageUtils.ts`, `types.ts`, `websocket-studio.css`, all test files
- R1: Found M41 (proxy system frame type) + M42 (isSystem detection)
- R2: Found M43 (system frame filter consistency)
- R3: Found M44 (CSS specificity)
- R4: Clean — no new issues found. Implementation confirmed stable.

### Phase 3 Plan Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 127 | **Undocumented type** | `WsFrameProtocolMeta.isSystemPacket?` field drives muted system packet rendering but not listed in plan's 3B.2 field list | Added `isSystemPacket?` to 3B.2 field list with rendering explanation |
| 128 | **Undocumented types** | `WsDetectionConfidence` type and `getProtocolInfo()` helper exported from `protocolTypes.ts` but not in plan's 3A.1 | Added both to 3A.1 checklist |
| 129 | **Undocumented codec exports** | All three codecs have extra constants and helpers not in plan (e.g., `ENGINE_TYPES`, `SOCKET_TYPES`, `encodeSioPong()`, `isSioPing()`, `isSioOpen()`, `SioOpenPayload`, `STOMP_CLIENT_COMMANDS`, `encodeStompHeartbeat()`, `isStompFrame()`, `GQL_CLIENT_TYPES`, `isGqlWsConnectionAck()`) | Added all extra exports to their respective 3B.1, 3C.1, 3E.1 checklists |
| 130 | **wsProtocolHelpers attribution** | `wsProtocolHelpers.ts` listed under Phase 1 actual files as NEW but contains entirely Phase 3 logic (auto-handshake, protocolMeta annotation, compose filtering) | Updated Phase 1 listing to "NEW (stub; filled in Phase 3)"; added to all Phase 3B/3C/3E file tables; added to Phase 3 bottom file map with 8 key exports documented |
| 131 | **clientKey export security** | Plan 3D.4 says "Sensitive fields (clientKey) NOT exported by default" but `exportProfiles()` dumps full JSON including clientKey | Updated plan to document this as a known limitation; stripped "NOT exported" claim |
| 132 | **pingInterval/pingTimeout display** | Plan 3B.3 says "for display" on Engine.IO OPEN payload parsing but values are never shown in the UI | Updated plan to clarify: "parsed into `SioOpenPayload` but not displayed in UI — deferred polish" |
| 133 | **operationName in GQL compose** | `encodeGqlWsSubscribe()` codec supports `operationName` parameter but compose UI has no field for it | Added note to 3E.4: "supported by codec but not exposed in compose UI — deferred polish" |
| 134 | **Missing Phase 3 file map entries** | Bottom file map missing 5 entries: `wsProtocolHelpers.ts`, `wsProtocolHelpers.test.ts`, `WebSocketConnectPanel.test.tsx`, `WebSocketStudioPage.test.tsx`, `useWebSocketProfiles.ts` | Added all 5 to Phase 3 bottom file map with sub-phase annotations |
| 135 | **WsConnectionProfile.protocolMode typing** | Plan type block says `WsProtocolMode` but actual implementation types it as `string` | Documented as minor implementation gap — works at runtime due to JavaScript's duck typing; strict typing is a future polish item |
| 136 | **CSS naming drift** | Plan referenced `.ws-protocol-selector` but actual classes are `.ws-protocol-selector-wrapper`, `.ws-protocol-select`; status bar uses `.ws-protocol-badge` (separate from selector's `.ws-protocol-detected-badge`) | Updated 3A Files table CSS description with actual class names |
| 137 | **TLS service test gap** | Server-side TLS tests use `ws://` URLs with TLS config (verifies acceptance) but don't test actual `wss://` agent creation | Documented as test coverage improvement opportunity — not a functional bug |
| 138 | **Phase 3A.3 stale wording** | Checklist bullets still described "coming soon" suffix despite all protocols being available since 3B/3C/3E | Updated bullets: "all available" and "originally showed coming soon; now enabled" |
| 139 | **TLS helper functions** | `createDefaultTlsConfig()` and `hasTlsOverrides()` exported from `types.ts` but not in plan's 3D.2 | Added both to 3D.2 checklist |
| 140 | **Control frame toggle inconsistency** | Plan re-eval #99 says deferred but a `showControlFrames` checkbox exists in MessageLog; it only filters raw frame types (ping/pong/close), not protocol system packets | Documented as plan/implementation inconsistency — checkbox partially works for raw mode; protocol system packets use separate `isSystemPacket` muting |

### Phase 5 Plan Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 155 | **Dependency clarity** | Phase 5 depends on `buildWsNodeOperations()` from Phase 4C. Plan didn't explicitly note which 5A–5C work could proceed independently of Phase 4 | Phase 4C is now ✅ complete. All Phase 5 dependencies resolved. Phase 5B uses `WsNodeOperations` interface from Phase 4C |
| 156 | **Wrong file (critical)** | Plan 5C.3 says extend `resolveVariable()` in `validatorCustomExpression.ts` — but `resolveVariable()` is a **local function** defined inline inside the `case 'custom'` block of `evaluateAssertions()` in `validator.ts` (lines ~748–776). `validatorCustomExpression.ts` only exports `isTruthy` and `wrapCustomExprDollarPaths` | Corrected 5C.3 to target `validator.ts`; removed `validatorCustomExpression.ts` from 5C Files table |
| 157 | **Wrong file** | Plan 5B.5 says `canUseRustExecutor()` is in `executor.ts` or `useTestExecution.ts` — actually in `src/features/test-runner/utils/rustBridge.ts` | Corrected file path; added `rustBridge.ts` to 5B Files table; noted `prepareScenarioForRust()` also needs transport awareness |
| 158 | **Greenfield (critical)** | Plan 5D.1 says "extend TestEditorModal with action type dropdown" implying an existing selector — `TestEditorModal` is **HTTP-only** with no transport selector, no Kafka panels. This is greenfield UI for both Kafka and WS | Rewritten 5D.1 as "greenfield" with explicit note; added Kafka editor panel as side-effect work |
| 159 | **Missing Kafka UI gap** | Plan 5D.4 assumes only `wsField` needs rendering in `AssertionRowEditor` — `kafkaField` also has no rendering branch (falls through to default `'SUBSET'` badge label) | Added kafkaField fix alongside wsField in 5D.4; added `testEditorValidationConstants.ts` to 5D Files |
| 160 | **Types location conflict** | Plan creates `src/shared/types/websocket.ts` but Studio types already exist at `src/shared/websocket/types.ts` (`WsTlsConfig`, `WsConnectionProfile`, `WsKeyValueEntry`, etc.) — risks duplicating shared types | Added import/re-export strategy in 5A.1: harness types in new file, shared types imported from Studio types file |
| 161 | **Assertion operator mismatch (critical)** | Plan 5D.3 WS latency preset uses `operator: 'less_than'` but `AssertionOperator` only has `'equals' \| 'contains' \| 'regex' \| 'exists'`. No `less_than` operator exists | Introduced `wsNumericField` assertion type using `ComparisonOperator` (like existing `numeric` assertions); updated 5A.4, 5C.5, 5D.3, 5D.4, success criteria, and file summaries |
| 162 | **Kafka latent bug** | Plan 5C.4 says skip HTTP checks for WS — same bug affects Kafka: `httpStatus === 0` triggers extra `(http)` failure in `validationResult.ts` | Updated 5C.4 to add `transportType` parameter and fix for both WS and Kafka; added to Kafka Parity Benefits section |
| 163 | **Missing snapshot fields** | `TestDefinitionSnapshot` has no `actionType` or transport config — Kafka isn't captured either. Plan mentions this vaguely but doesn't commit to fixing it | Updated 5F.2 with explicit `TestDefinitionSnapshot` extension; added `definitionVersioning.ts` to 5F Files |
| 164 | **Worker gap broader** | Plan 5B.4 mentions `executionWorker.ts` but misses that `workerBridge.ts` also never passes `kafkaOperations` into worker messages — the worker must self-build ops | Added note to 5B.4 clarifying worker self-builds ops; not a file change (worker approach is correct) |
| 165 | **Misleading hook description** | Plan 5B.6 says "import and build wsOperations" in `useTestExecution.ts` but `executeNonHttp` is assembled inside `runTest()` in `executor.ts`, not by the hook | Corrected description: hook passes operations parameter; callback assembly is in `executor.ts` |
| 166 | **Dual method discriminant** | `Scenario` has both `method: 'KAFKA'` and `actionType: 'kafkaProduce'\|'kafkaConsume'`. Plan didn't address whether WS adds `method: 'WEBSOCKET'` or only uses `actionType` | Added `method: 'WEBSOCKET'` to 5A.1 for consistency with Kafka precedent; added to design decisions |
| 167 | **Data source column policy** | Plan 5B.3 says interpolate WS fields but doesn't specify which column types apply. Kafka uses body-type columns only | Added 5B.7 with explicit column type policy: URL → param columns, message → body columns, headers → header columns |
| 168 | **Missing file in 5B** | `rustBridge.ts` not in 5B Files table | Added `rustBridge.ts` to 5B Files table |
| 169 | **Missing extraction wiring** | Plan 5F.1 mentions `wsExtractionAdapter` but doesn't specify how it's wired into `TestEditorModal`'s extraction tab | Added 5D.5 for extraction editor transport-aware adapter wiring |
| 170 | **Circuit breaker impact** | `breaker.record(result)` runs for all results. Plan doesn't mention verifying WS failure semantics don't falsely trip breakers | Added circuit breaker note to 5B.6 and success criteria |
| 171 | **Missing Kafka parity section** | Several Phase 5 changes fix existing Kafka issues (worker, Rust guard, HTTP skip, UI, presets) but plan didn't document this | Added "Kafka Parity Benefits" section with 7-row table |
| 172 | **File count mismatch** | Plan said 12 new + 16 modified = 28 files; actual count after corrections is 12 new + 19 modified = 31 files | Updated file counts in all summaries |
| 173 | **Missing `testEditorValidationConstants.ts`** | Badge label function `getAssertionTypeBadgeLabel` needs `wsField`, `wsNumericField`, `kafkaField` cases but file not in 5D Files | Added to 5D Files table |
| 174 | **Assertion context for numeric** | Adding `wsNumericField` requires `wsContext` to carry `latencyMs` and `messageSize` as numeric values — already planned in 5C.1 `wsContext` interface but not explicitly linked to `wsNumericField` evaluation path | Added 5C.5 for `wsNumericField` evaluation using existing `ComparisonOperator` logic |
| 175 | **Effort revision** | Scope expanded from 28 to 31 files with additional Kafka parity work, `wsNumericField` branch, and `definitionVersioning.ts` changes | Revised effort from 7–9 to 8–10 days |
| 176 | **`requestExecution.ts` dispatch** | Plan correctly describes `executeNonHttp` dispatch but doesn't mention `requestExecution.ts` where the actual `if (opts.executeNonHttp && actionType !== 'http')` check lives — not a file change (it already dispatches generically) but important for understanding the execution flow | Documented as reference; no plan change needed |

### Phase 4 Plan Re-evaluation (2026-06-08)

| # | Category | Issue | Fix |
|---|---|---|---|
| 141 | **Wrong constant name** | Plan references `NODE_TYPE_META` in 4B.6 but actual constant is `NODE_TYPE_DISPLAY` in `workflowVariableHints.ts` | Renamed to `NODE_TYPE_DISPLAY` in all 4B.6 references and success criteria |
| 142 | **Wrong integration point** | Plan 4A.6 says "wide modal types list in `useWorkflowCanvasSync.ts`" — no such list exists; actual integration point is the condition-variable-hints inclusion list in `useWorkflowVariableHints()` (exported from same file). All config modals already use `expandMode="fullscreen"` | Corrected description and purpose in 4A.6 |
| 143 | **Missing type fields** | `Ws*NodeData` interfaces omit `label: string` and `[key: string]: unknown` index signature — ALL existing `WorkflowNodeData` types have both | Added `label` and index signature to all 4 `Ws*NodeData` interfaces |
| 144 | **Wrong header type** | Plan uses `{ key: string; value: string }[]` for headers/queryParams but existing WebSocket Studio uses `WsKeyValueEntry` (`key`, `value`, `enabled`) and Kafka uses `{ id, key, value, enabled }` rows | Changed to `WsKeyValueEntry[]` for consistency with existing WS types |
| 145 | **disconnectAll() is new infra** | Plan implies `disconnectAll()` in graphRunner completion follows Kafka pattern — but Kafka is stateless (no connection registry, no cleanup). This is **new infrastructure** unique to WebSocket | Added explicit note that this is new design, not mirroring Kafka |
| 146 | **runGraph() parameter sprawl** | Adding `wsOperations` as 19th positional parameter to `runGraph()` is fragile. `kafkaOperations` is already the 18th | Added note suggesting future refactor to consolidated `transportOperations` bag |
| 147 | **Missing ExecutionEvent.nodeType** | Plan only mentions `ExecutionEventDetails` extension but `ExecutionEvent.nodeType` union in `trace.ts` also needs 4 WS types | Added to 4D.7 checklist |
| 148 | **Wrong transportType location** | Plan says extend `transportType` in `src/shared/types/index.ts` but `KafkaActionType` is defined in `src/shared/types/kafka.ts` and re-exported | Updated 4D.8 to reference both files; suggested renaming `KafkaActionType` → `TransportActionType` |
| 149 | **Results labeling is greenfield** | Plan assumes Kafka has labels/log formatting in `nodeTypeLabels.ts` and `reconstructLogLines.ts` — Kafka types actually fall through to raw strings and generic `extractedVariables` lines | Added notes to 4E.1 and 4E.3 that this is greenfield; suggested adding Kafka labels too |
| 150 | **Missing traceCollector.ts** | `hasOwnTiming` in `traceCollector.ts` only special-cases `http`, `correlationWait`, `subWorkflow`; WS connect/receive timing may need similar treatment for Results Explorer | Added 4E.5 step for `traceCollector.ts` and entry in 4E Files table |
| 151 | **Missing config factories** | Kafka has `kafkaConfigFactories.ts` for shared row factory functions in config panels; WS configs may benefit from equivalent `wsConfigFactories.ts` or reusing `KeyValueEditor` from WebSocket Studio | Added note to 4B.1 about reusing `KeyValueEditor` |
| 152 | **Load runner WS guard** | Kafka has a load-policy guard in `graphLoadRunner.ts` for consume nodes under load test. WS receive/trigger may need equivalent guards to prevent connection exhaustion under load | Documented as consideration in Phase 4D.5 (not blocking, but important for robustness) |
| 153 | **External trigger runner** | `handleKafkaTriggerNode` reads `__kafkaTriggerMessage` from context set by an external subscription dispatcher. `wsTrigger` will need parallel `__wsTriggerMessage` + runtime wiring — plan mentions this but doesn't detail the external subscription setup | Documented as known gap — trigger subscription infrastructure is outside Phase 4 scope (requires a listener service) |
| 154 | **Missing Phase 4 bottom file map** | Bottom file map sections for Phase 4 (lines 3718–3741) now need to include `src/shared/types/kafka.ts` and `traceCollector.ts` as modified files | Updated bottom file map |

### Phase 4 Implementation Review (2026-06-09)

A thorough review of all Phase 4 implementations (4A–4E) identified and fixed 5 bugs:

1. **WsReceiveNode canvas preview ignores `messageType` filter** (Phase 4A): The match preview showed "any message" even when `messageType` was set to `'text'` or `'binary'`. Also, the timeout was only shown when content/regex/JSONPath filters existed, despite always being used by the engine. Fixed to include `messageType` in preview and show timeout unconditionally.

2. **Sub-workflow creates fresh wsOperations registry** (Phase 4D, **high severity**): `graphRunnerSubWorkflowHandler.ts` called `buildWsNodeOperations()` to create an isolated registry per child run, preventing sub-workflows from reusing parent WS connections. Kafka operations are passed through shared (`hCtx.kafkaOperations`). Fixed to pass `{ ...hCtx.wsOperations, disconnectAll: async () => {} }` — child shares parent connections but can't tear them down on completion.

3. **Connect handler doesn't capture `protocol`/`extensions` in trace details** (Phase 4C/4E): `handleWsConnectNode` received `protocol` and `extensions` from `ops.connect()` and logged them, but didn't store them in `CapturedWsNodeDetails`. Results Explorer couldn't show negotiated protocol. Fixed by adding `protocol` and `extensions` fields to `CapturedWsNodeDetails` type and populating them in the handler. Also updated `DetailOverviewTab.tsx` to render them.

4. **Timeout `0` coerced to default via `||`** (Phase 4C): `handleWsConnectNode` used `data.timeoutMs || DEFAULT_CONNECT_TIMEOUT_MS` and `handleWsReceiveNode` used `data.timeoutMs || DEFAULT_RECEIVE_TIMEOUT_MS`. Both coerce `0` to default. Fixed to use `??` (nullish coalescing) instead.

5. **Unused import in sub-workflow handler** (Phase 4D): After fixing bug #2, the `buildWsNodeOperations` import became unused. Removed.

**Known design limitations documented (not bugs):**
- Connection ID selector in config modal collects from all nodes, not just upstream ancestors (would need topology info in modal)
- Workflow `RequestResult` doesn't populate `wsResultMeta` (workflow uses `capturedWsNodeDetails` for traces)
- Config panel timeout inputs use `|| default` (appropriate for UI since 0ms timeout is meaningless)

**Verification:**

- TypeScript: **0 errors** (`npx tsc -b --noEmit`)
- Linter: **0 errors** across all modified files
- Tests: **331 tests passed** across 11 test files
