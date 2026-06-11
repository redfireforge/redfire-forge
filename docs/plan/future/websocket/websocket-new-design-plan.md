# WebSocket / SSE — New Design (Redesign) Plan

> Branch (target for implementation): `feature/websocket` → new `feature/ws-redesign-*` branches per phase
> Created: 2026-06-10
> Status: **🔲 Proposed** — design + plan only, no production code yet
> Companion artifacts:
> - Mockups: [docs/plan/future/websocket/mockups/](mockups/) (`index.html`, `ws-messages.html`, `ws-connect.html`, `ws-auth.html`, `ws-advanced.html`, `ws-saved.html`, `ws-mock.html`, `ws-console.html`, `ws-console-final.html`, `sse.html`)
> - Feature-complete predecessor plan: [websocket-studio-plan.md](websocket-studio-plan.md) (Phases 1–19, all ✅)
>
> This plan re-architects the **presentation layer** of the existing, fully-implemented WebSocket Studio + SSE Studio into an Insomnia-style split-pane workspace that reuses the **Requests** design language, and adds two genuinely new capabilities: **Auth** and **Console**.

---

## Table of Contents

1. [Goals & Non-Goals](#1-goals--non-goals)
2. [Current Implementation Audit](#2-current-implementation-audit)
3. [Mockup ↔ Reality Gap Analysis](#3-mockup--reality-gap-analysis)
4. [New Information Architecture](#4-new-information-architecture)
5. [Feature Parity Matrix](#5-feature-parity-matrix-nothing-is-lost)
6. [New Feature — Auth](#6-new-feature--auth)
7. [New Feature — Console](#7-new-feature--console)
8. [Phase Status Dashboard](#8-phase-status-dashboard)
9. [Phased Implementation Plan](#9-phased-implementation-plan)
10. [Component & File Map](#10-component--file-map)
11. [Type Definitions](#11-type-definitions)
12. [Risks & Open Questions](#12-risks--open-questions)
13. [Global Success Criteria](#13-global-success-criteria)

---

## 1. Goals & Non-Goals

### Goals
- **Re-skin, don't rewrite.** Preserve 100% of the existing WebSocket + SSE behavior (Phases 1–19) while moving to a split-pane, Requests-consistent UI.
- **Single workspace.** Replace the four sibling view tabs (`Connect / Messages / Saved / Mock`) with a **mode switch** + **split-pane** so users configure on the left and watch traffic on the right simultaneously.
- **Add Auth** as a first-class config section, reusing the Requests `AuthConfig` / `GlobalAuthProfile` system.
- **Add Console** as a unified diagnostics + command log (lifecycle, handshake, errors, reconnect activity), distinct from the message Events stream.
- **Theme-correct.** Use real `--primary/--surface/--border/...` tokens; verified in dark + light (and dim/steel/sapphire by inheritance).

### Non-Goals
- No change to the transport layer (`useWebSocketStudio`, Tauri native transport, Express proxy).
- No change to the workflow-engine WS nodes or the test-harness assertion engine.
- No change to persisted data shapes except **additive** fields (Auth, Console settings).
- No regression to the 1782 WS + 137 SSE tests; new code is additive + covered.

---

## 2. Current Implementation Audit

> Source of truth as of 2026-06-10. Verified against the code, not the mockups.

### 2.1 Top-level structure
- **Multi-connection tab bar** — `WsConnectionTabBar` (drag-reorder, keyboard nav, per-tab connection-state dot, rename, close, `+`).
- **Per-connection view tabs** — `WsViewTab = 'connect' | 'messages' | 'saved' | 'mock'` (in [src/shared/websocket/types.ts](../../../src/shared/websocket/types.ts)). Rendered in [WsConnectionTabContent.tsx](../../../src/features/websocket/WsConnectionTabContent.tsx).
- There is **no** `Console`, **no** `Auth`, and **no** top-level `Handshake`/`Stats` tab. Stats and Load Test live **inside** the Messages view as toggles.

### 2.2 Connect view (`WebSocketConnectPanel` + `WebSocketTlsPanel`)
- URL input + connect/disconnect, resolved-URL preview (env interpolation), connection history dropdown.
- Subprotocols (comma-separated).
- **Headers** (`KeyValueEditor`) and **Query Params** (`KeyValueEditor`) — enable/disable, trash, `{{var}}` insertion.
- **Protocol selector** (`WebSocketProtocolSelector`): `auto` / `raw` / `socket-io` / `stomp` / `graphql-ws` with auto-detect result + Socket.IO server params.
- **Auto-reconnect**: enable, `maxReconnectAttempts`, `reconnectIntervalMs`, `backoffMultiplier` (1 / 1.5 / 2), live reconnect state + retry-now/cancel.
- **TLS panel**: `rejectUnauthorized`, `caCert`, `clientCert`, `clientKey` (wss only / proxy mode).
- **Close with code**: `WS_CLOSE_CODE_PRESETS` (1000/1001/1002/1003/1008/1011/4000/4001) + custom reason.
- Config **lock banner** while connected.

### 2.3 Messages view (`WebSocketMessageLog` + children)
- **Composer** (`useWebSocketCompose`): formats `text | json | binary`; protocol composers for Socket.IO (event + namespace + payload), STOMP (command + destination + body), GraphQL-WS (query + variables + op name); beautify; **templates** save/load/delete (`WsMessageTemplate`); send (⌘↵); ping.
- **Filter bar** (`WebSocketFilterBar`): search modes `text | regex | jsonpath`; `sizeFilter` (all / <1K / 1–10K / >10K); `timeFilter` (all / 30s / 5m / 30m); `contentTypeFilter` (all / json / text / binary / control); **filter presets** (`WsFilterPreset`, `useWebSocketFilterPresets`).
- **Toolbar**: Filters, Compare (diff), Schema, Clear, Export, Import, Stats toggle, Load Test toggle, Recording (Rec/Stop/Load), bookmarks.
- **Message rows** (`WebSocketMessageRow`, virtualized): bookmark ★, direction ↑/↓/◆, timestamp, type badge, content preview, size, validation badge ✓/✗.
- **Message detail** (`WebSocketMessageDetail`): tabs **JSON / Raw / Hex / Validation**; prev/next; copy; word-wrap.
- **Stats** (`WebSocketStatsPanel`): msg/s, bytes in/out, frame-type stacked bar, sparkline (`useWebSocketMetrics`).
- **Load Test** (`WebSocketLoadTest`, `useWebSocketLoadTest`, `wsLoadTestMetrics`): profiles, rate/duration, template vars `{{counter}}/{{timestamp}}/{{random}}`, progress, latency histogram, results export.
- **Diff** (`WebSocketMessageDiff`, `wsMessageDiffEngine`): A/B structural + unified.
- **Schema validation** (`WebSocketSchemaPanel`, `useWebSocketSchema`, `wsSchemaValidator`, `wsSchemaInference`): per-direction schemas, generate-from-messages, per-message badges.
- **Recording/Replay** (`useWebSocketRecording`): record/stop/load, replay speeds `1 | 2 | 5 | 10 | 0(custom)`.
- **Bookmarks** (`useWebSocketBookmarks`); **uptime** (`useWebSocketUptime`).

### 2.4 Saved view (`WebSocketSavedConnections`)
- `WsConnectionProfile` CRUD: save / update / delete / duplicate / import / export / load-as-draft; profile editor with all connect fields + `maxMessages` + `notes`.

### 2.5 Mock view (`WebSocketMockServer`, `useWebSocketMockServer`, `wsMockRuleEngine`)
- Server start/stop, port, fallback `echo | ignore | close`, connected clients, broadcast.
- Rules: match `any | exact | contains | regex | jsonpath` × response `echo | static | template | close`; enable/reorder/delete; live rule test.

### 2.6 SSE Studio (`SseStudioPage` + children)
- Config: `url`, `headers` (key/value), `autoReconnect`, `maxRetries` (in [sseTypes.ts](../../../src/features/sse/sseTypes.ts)).
- Connection states: `idle | connecting | connected | disconnected | error`; `lastEventId`, `retryMs`, `reconnectAttempt`.
- Events (`SseEvent`): `eventType`, `data`, `lastEventId`, `size`, `timestamp`.
- `SseMessageLog` (search, type filter, bookmarks, export, clear) + `SseEventDetail` (pretty/raw, JSON badge, Last-Event-ID).
- Stats: `eventCount`, `eventTypeCounts`.
- **No Auth, no Console.**

---

## 3. Mockup ↔ Reality Gap Analysis

The first-pass mockups contained **two fabricated tabs** that do not exist in code. This plan formalizes them as **new features** (per user request) rather than silently shipping fake UI.

| Mockup element | Exists today? | Resolution in this plan |
|---|---|---|
| `Console` tab (ws-messages, ws-connect) | ❌ No | **Promote to NEW feature** → [§7](#7-new-feature--console) |
| `Handshake` tab | ❌ No (only internal Socket.IO handshake logic) | Fold into **Console** as a "Handshake" detail section (not a separate top-level tab) |
| `Auth` (shown only as an `Authorization` header row) | ⚠️ Partial (manual header/param only) | **Promote to NEW feature** → [§6](#6-new-feature--auth) |
| `Stats` / `Load Test` / `Schema` as right-pane tabs | ⚠️ Exist but as **toggles inside Messages**, not tabs | Keep as right-pane tabs in new design (pure presentation move; behavior unchanged) |
| Everything else in mockups | ✅ Yes | Direct 1:1 mapping ([§5](#5-feature-parity-matrix-nothing-is-lost)) |

**Action item (tracked in Phase 0):** update the mockup HTML so `Auth` appears as a real left-pane config tab and `Console` is documented as new (badged "NEW" in the mockup) — keeping mockups honest per the project's mockup-accuracy rule.

---

## 4. New Information Architecture

### 4.1 From 4 sibling tabs → mode switch + split pane

```
┌──────────────────────────────────────────────────────────────────┐
│ [conn-1 ●] [conn-2 ○] [conn-3 ⚠]  (+)        ← multi-connection bar │
├──────────────────────────────────────────────────────────────────┤
│ ( 💬 Client ) ( 🤖 Mock Server ) ( 📋 Saved )   ← MODE switch       │
├──────────────────────────────────────────────────────────────────┤
│ [WS] ws://…                                   [ Connect / ✕ ]      │  ← unified URL bar
├──────────────────────────────────────────────────────────────────┤
│ 101 Switching Protocols · latency · sent · recv · uptime · proto   │  ← status strip
├───────────────────────────────┬──────────────────────────────────┤
│ LEFT (config / compose)        │ RIGHT (events / response)         │
│ Tabs:                          │ Tabs:                             │
│  Compose | Connect | Auth ★    │  Events | Console ★ | Stats |     │
│  Params | Headers              │  Load Test | Schema               │
└───────────────────────────────┴──────────────────────────────────┘
                         ★ = NEW
```

- **Mode switch** replaces the `Connect/Messages/Saved/Mock` semantics:
  - `Client` → split pane (Compose/Connect/Auth/Params/Headers on left; Events/Console/Stats/Load Test/Schema on right).
  - `Mock Server` → the existing Mock view (clients + rule engine).
  - `Saved` → the existing profiles collection + editor.
- **Connect config** moves to the **left pane**; **Events** stream lives in the **right pane** → configure + observe at once (the core UX win).
- **Message detail** keeps its existing JSON/Raw/Hex/Validation tabs, shown below the Events list (resizable).

### 4.2 Mapping old → new

| Old `WsViewTab` | New location |
|---|---|
| `connect` | `Client` mode → left pane tabs `Connect` / `Auth` / `Params` / `Headers` |
| `messages` | `Client` mode → left `Compose` + right `Events` (+ `Stats` / `Load Test` / `Schema` tabs) |
| `saved` | `Saved` mode |
| `mock` | `Mock Server` mode |

`WsViewTab` is retained for **persistence back-compat** (migration in Phase 1) but the UI is driven by a new `WsStudioMode` + per-pane active-tab state.

---

## 5. Feature Parity Matrix (nothing is lost)

| Capability | Component (today) | New-design home | Status |
|---|---|---|---|
| Multi-connection tabs | `WsConnectionTabBar` | Connection bar (unchanged) | ✅ keep |
| URL + connect/disconnect | `WebSocketConnectPanel` | Unified URL bar | ♻️ move |
| Resolved-URL preview | `WebSocketConnectPanel` | Status strip / URL bar tooltip | ♻️ move |
| Connection history | `WebSocketConnectPanel` | URL bar ▾ dropdown | ♻️ move |
| Subprotocols | `WebSocketConnectPanel` | Left `Connect` tab | ♻️ move |
| Headers / Query params | `KeyValueEditor` | Left `Headers` / `Params` tabs | ♻️ move |
| Protocol selector | `WebSocketProtocolSelector` | Left `Connect` tab | ♻️ move |
| Auto-reconnect | `WebSocketConnectPanel` | Left `Connect` tab (panel) | ♻️ move |
| TLS / mTLS | `WebSocketTlsPanel` | Left `Connect` tab (panel) | ♻️ move |
| Close with code | `WebSocketConnectPanel` | Left `Connect` tab (panel) | ♻️ move |
| Composer (text/json/binary) | `useWebSocketCompose` | Left `Compose` tab | ♻️ move |
| Protocol composers (SIO/STOMP/GQL-WS) | `useWebSocketCompose` | Left `Compose` tab | ♻️ move |
| Templates | `WsMessageTemplate` | `Compose` → Templates ▾ | ♻️ move |
| Events list (virtualized) | `WebSocketMessageLog` | Right `Events` tab | ♻️ move |
| Filter bar + presets | `WebSocketFilterBar` | Right `Events` toolbar | ♻️ move |
| Message detail JSON/Raw/Hex/Validation | `WebSocketMessageDetail` | Right `Events` detail pane | ✅ keep |
| Bookmarks | `useWebSocketBookmarks` | Events row ★ | ✅ keep |
| Stats dashboard | `WebSocketStatsPanel` | Right `Stats` tab | ♻️ toggle→tab |
| Load test | `WebSocketLoadTest` | Right `Load Test` tab | ♻️ toggle→tab |
| Diff / compare | `WebSocketMessageDiff` | Modal from Events toolbar | ✅ keep |
| Schema validation | `WebSocketSchemaPanel` | Right `Schema` tab | ♻️ toggle→tab |
| Recording / replay | `useWebSocketRecording` | Right `Events` toolbar | ✅ keep |
| Saved profiles | `WebSocketSavedConnections` | `Saved` mode | ♻️ move |
| Mock server + rules | `WebSocketMockServer` | `Mock Server` mode | ♻️ move |
| SSE studio | `SseStudioPage` | SSE split-pane (mirror of Client mode) | ♻️ move |
| **Auth** | — | Left `Auth` tab | ⭐ NEW |
| **Console** | — | Right `Console` tab | ⭐ NEW |

Legend: ✅ keep as-is · ♻️ relocate (presentation only) · ⭐ new feature.

---

## 6. New Feature — Auth

### 6.1 Rationale
Today, auth is only achievable by hand-typing an `Authorization` header or a `?token=` query param. The **Requests** feature already has a complete, tested auth system (`AuthConfig`, `GlobalAuthProfile`, `AuthConfigPanel`). Reusing it gives WebSocket/SSE consistent, reusable, profile-backed auth.

> **DECIDED (2026-06-10):** Auth is its **own dedicated tab** in the left pane (exactly like the Requests editor's `Auth` tab), not a panel nested inside `Connect`. This matches the established Requests mental model and leaves room for OAuth2 fields.

### 6.2 Scope
- New **left-pane `Auth` tab** in Client mode (and an `Auth` panel in SSE).
- Reuse the shared types from [src/shared/types/index.ts](../../../src/shared/types/index.ts):
  - `AuthType = 'none' | 'inherit' | 'basic' | 'bearer' | 'apikey' | 'digest' | 'oauth2'`
  - `AuthConfig`, `GlobalAuthProfile`
- Reuse the shared [AuthConfigPanel.tsx](../../../src/features/requests/components/AuthConfigPanel.tsx) component (extract to a shared location if it currently couples to Requests-only props).
- **Resolution at connect time** → `AuthConfig` is compiled into the existing transport primitives so the transport layer is untouched:
  - `bearer` → `Authorization: <prefix> <token>` header
  - `basic` → `Authorization: Basic base64(user:pass)` header
  - `apikey` → header **or** query param (`apiKeyIn`)
  - `oauth2` (client-credentials) → fetch token from `tokenUrl`, then bearer header
  - `digest` → header (best-effort; document limitation for browser transport)
  - `inherit` / `globalProfileId` → resolve from app-level `GlobalAuthProfile[]`
- `{{var}}` interpolation supported in all auth fields (consistent with headers/params).
- **WSS note:** custom headers require proxy/Tauri transport (browser `WebSocket` can't set headers); when in browser mode, surface the existing proxy-mode hint and offer query-param fallback for `apikey`.

### 6.3 Persistence
- Add `auth?: AuthConfig` and `globalAuthProfileId?: string` to `WsConnectionProfile` and to the per-connection draft state (additive, back-compat).
- Add `auth?: AuthConfig` to `SseConnectionConfig` (additive).

### 6.4 UI
- Auth type dropdown + conditional fields (mirror Requests): Token / Username+Password / Key Name+Value+In / Token URL+Client ID+Secret.
- Global profile selector ("Use shared profile…") when app profiles exist.
- "Resolved as" preview line (e.g., `→ Authorization: Bearer ●●●●`) so users see what hits the wire.
- A small **Auth** badge on the left tab strip (dot when auth ≠ `none`).
- Mockup: [mockups/ws-auth.html](mockups/ws-auth.html) (live Type-dropdown switch through all auth forms + resolved-as preview + browser-mode callout).

### 6.5 Tests
- Resolution unit tests per auth type → correct header/param.
- OAuth2 token fetch (mocked).
- Profile inheritance resolution.
- Round-trip persistence (profile save/load with auth).
- Panel render/interaction tests.

---

## 7. New Feature — Console

> **DECIDED (2026-06-10):** Build the **combined design** — Option **B**'s filterable structured log as the default view, with an Option **A** “Raw” toggle that flips the same data into an Insomnia-style curl-verbose timeline, plus Option **C**'s command line added in a later phase. Mockup comparison: [mockups/ws-console.html](mockups/ws-console.html) (Options A / B / C); canonical combined mockup: [mockups/ws-console-final.html](mockups/ws-console-final.html) (live Structured/Raw toggle).
>
> **Modeled on Insomnia's WebSocket "Timeline" tab.** In Insomnia, the WebSocket response pane has two tabs: **Events** (the message stream) and **Timeline** (a curl-verbose-style network log of the connection). The Timeline uses line prefixes:
> - `*` — info / system (gray): `* Preparing request…`, `* SSL connection using TLS1.3…`, `* WebSocket connection established`
> - `>` — sent (the upgrade request line + request headers `Upgrade: websocket`, `Sec-WebSocket-Key`, control frames)
> - `<` — received (`< HTTP/1.1 101 Switching Protocols`, response headers, negotiated protocol/extensions)
> - red — errors
>
> RedfireForge's **Console** keeps Insomnia's transparency (the Raw timeline) **and** adds app-native filtering + an optional command line that Insomnia does not have.

### 7.1 Rationale
The Events list shows **message frames**. There is currently nowhere to see the **connection-level network log**: handshake request/response, lifecycle transitions, errors, warnings, reconnect attempts, ping/pong control activity, and protocol auto-detection results. A **Console** consolidates these — exactly the role Insomnia's Timeline plays — while staying consistent with the rest of RedfireForge.

### 7.2 Scope — one data stream, two views, one command line

All three options render the **same** `WsConsoleEntry[]` stream; they are just presentations of it plus an input. This is why “do all of them” is cheap: the model and listener are shared, and each view is a thin renderer.

**B — Structured log (default view).** Mirrors the Events list styling: `time · LEVEL badge · category chip · message`, left color rail for warn/error, expandable rows that reveal full detail (e.g., handshake headers). Toolbar: segmented **severity** filter (`all | info | warn | error`), **category** filter (`all | handshake | lifecycle | control | reconnect | protocol`), search, export, clear, auto-scroll lock. Easiest to scan and filter.

**A — Raw timeline (toggle).** A `Raw` switch in the Console toolbar flips the same entries into the Insomnia curl-verbose log using the `direction` prefix glyphs `* / > / <` and grouped handshake header lines. Read-only, copy-paste friendly. No re-fetch — it is the identical data, re-rendered.
- **Handshake (curl-verbose, Raw view)**: `* Preparing request to <url>` → `* Connecting…` → (`* SSL connection using <tls>…` for wss) → `> GET / HTTP/1.1` + request headers (`Host`, `Upgrade: websocket`, `Connection: Upgrade`, `Sec-WebSocket-Key`, `Sec-WebSocket-Protocol`, resolved auth header **masked**) → `< HTTP/1.1 101 Switching Protocols` + response headers (negotiated `Sec-WebSocket-Protocol`, `extensions`) → `* WebSocket connection established`. *(This absorbs the fabricated “Handshake” tab from the mockup — it is a section of the Console, not a separate tab.)*
- Lifecycle transitions: `connecting → open (101) → closing → closed(code/reason)` / `error`.
- Reconnect activity: attempt N/max, next-retry countdown, backoff.
- Protocol detection result + Socket.IO auto-handshake packets.
- Control frames: ping/pong with latency.
- Warnings/errors (parse failures, schema validation summaries, oversized frames).

**C — Command line (later phase).** An optional input pinned to the bottom of the Console for quick keyboard actions Insomnia lacks:
- `/ping`, `/close [code] [reason]`, `/connect`, `/disconnect`, `/clear`, `/send <text>`, `/template <name>`.
- Command history (↑/↓), unknown-command help (`/help`); echoed into the log with a `$` prefix.
- Phase-gated: ship **B + A** first (Phase 9); add **C** in Phase 10, gated behind user approval.

### 7.3 Data model
- New `WsConsoleEntry { id; level: 'info'|'warn'|'error'|'debug'; direction: 'out'|'in'|'info'|'command'; category: 'lifecycle'|'handshake'|'reconnect'|'protocol'|'control'|'command'|'system'; message; detail?; timestamp }`. `level` + `category` drive view **B**; `direction` drives the `* / > / < / $` prefixes in view **A** (and command echoes).
- New `useWebSocketConsole` hook subscribing to existing transport/lifecycle events already emitted by `useWebSocketStudio` (no transport changes; it listens and records). The hook is **view-agnostic** — both B and A read its output; C appends `command`-direction entries and dispatches existing studio actions.
- New `WsConsoleSettings { view: 'structured' | 'raw'; levelFilter; categoryFilter; autoScroll; maxEntries }` (persisted per studio, default `structured`, `maxEntries` 1000 ring buffer).

### 7.4 SSE parity
- SSE gets the same Console (both views): `* Preparing request` → `> GET … Accept: text/event-stream` → `< HTTP/1.1 200 OK` + `Content-Type: text/event-stream` → `* SSE stream open`, then retry/`Last-Event-ID` resume, comment/keep-alive lines, parse warnings. Command line (C) for SSE is limited to `/connect`, `/disconnect`, `/clear` (no send on a one-way stream).

### 7.5 UI
- Right-pane `Console` tab (sits beside `Events`, mirroring Insomnia's Events/Timeline pairing) with a count/severity badge (red dot on `error`).
- Default = **structured** rows (`.con2` in the mockup); a `Raw` toggle in the toolbar switches to the **timeline** rows (`.con` in the mockup). Command line = `.con-cmd`.
- Reuses the mockup classes already added to `mockup.css`: `.con-list`, `.con` / `.con-divider` (Raw, view A), `.con2` / `.con2-detail` (structured, view B), `.con-cmd` (command line, view C).

### 7.6 Tests
- Entry recording for each lifecycle transition.
- Handshake capture (request line, request/response headers, negotiated protocol/extensions, 101 code) with correct `direction` prefixes in Raw view.
- Structured view: severity + category filtering, search, row expand/collapse.
- Raw view toggle renders the same entries with `* / > / <` prefixes (no data divergence between views).
- Ring-buffer cap; auto-scroll lock.
- Command parsing + dispatch + history (Phase 10 / view C).

---

## 8. Phase Status Dashboard

| Phase | Title | Type | Status |
|---|---|---|---|
| 0 | Foundations: shared CSS, mode/pane state, mockup honesty | Scaffolding | 🔲 |
| 1 | Split-pane shell + mode switch + persistence migration | Presentation | 🔲 |
| 2 | Left pane: Connect / Params / Headers relocation | Presentation | 🔲 |
| 3 | Left pane: Compose relocation | Presentation | 🔲 |
| 4 | Right pane: Events + detail relocation | Presentation | 🔲 |
| 5 | Right pane: Stats / Load Test / Schema as tabs | Presentation | 🔲 |
| 6 | Saved mode + Mock mode reskin | Presentation | 🔲 |
| 7 | SSE split-pane reskin | Presentation | 🔲 |
| 8 | ⭐ Auth feature (WS + SSE) | New feature | 🔲 |
| 9 | ⭐ Console — structured log (B) + Raw timeline toggle (A) | New feature | 🔲 |
| 10 | ⭐ Console — command line (C) | New feature | 🔲 |
| 11 | Polish, a11y, keyboard, theme QA, E2E | Hardening | 🔲 |

Status legend: 🔲 not started · 🔨 in progress · ✅ complete.

---

## 9. Phased Implementation Plan

> Each phase is independently shippable, keeps all tests green, and is presentation-additive until Phases 8–10.

### Phase 0 — Foundations 🔲
- Promote the mockup `mockup.css` patterns into a real stylesheet plan (map each mockup class → production CSS module / existing class).
- Introduce `WsStudioMode = 'client' | 'mock' | 'saved'` and left/right active-pane-tab state types (no behavior yet).
- **Mockup honesty:** add a real `Auth` left tab to `ws-connect.html`/`ws-messages.html` and badge `Console` as "NEW".
- **Success:** types compile; mockups updated; no runtime change.

### Phase 1 — Split-pane shell + mode switch 🔲
- New `WebSocketStudioShell` rendering: connection bar → mode switch → URL bar → status strip → split pane (resizable divider).
- Map old `WsViewTab` → new mode + pane tabs; **migrate persisted state** (`WsPersistedTab.viewTab` → mode + pane tab) with a back-compat reader.
- Feature-flag the new shell behind a setting to allow side-by-side QA.
- **Success:** all existing flows reachable in new shell; persistence migrates cleanly; tests green.

### Phase 2 — Left: Connect / Params / Headers 🔲
- Render `WebSocketConnectPanel` fields, `KeyValueEditor` (Headers/Params), protocol selector, auto-reconnect, TLS, close-code inside left-pane tabs.
- Keep the config-lock-while-connected banner.
- **Success:** identical behavior; relocated only.

### Phase 3 — Left: Compose 🔲
- Move composer + protocol composers + templates to the left `Compose` tab; keep ⌘↵ send + ping.
- **Success:** send/receive parity; templates parity.

### Phase 4 — Right: Events + detail 🔲
- Move `WebSocketMessageLog` to right `Events` tab; filter bar + presets + recording in toolbar; `WebSocketMessageDetail` below (resizable).
- **Success:** virtualization, filters, bookmarks, diff, export/import all parity.

### Phase 5 — Right: Stats / Load Test / Schema as tabs 🔲
- Convert the in-Messages toggles into dedicated right-pane tabs (presentation only).
- **Success:** identical metrics/load/schema behavior.

### Phase 6 — Saved + Mock reskin 🔲
- `Saved` mode = profiles collection + editor (reuse `WebSocketSavedConnections`).
- `Mock Server` mode = `WebSocketMockServer` reskinned to the mockup layout (clients/broadcast left, rules + tester right).
- **Success:** CRUD + rule engine parity.

### Phase 7 — SSE split-pane reskin 🔲
- Mirror Client mode for SSE: left config (headers, auto-reconnect, **Auth**), right Events + detail (+ Console in Phase 9).
- **Success:** SSE parity.

### Phase 8 — ⭐ Auth 🔲
- Extract/share `AuthConfigPanel`; add `auth` to draft + `WsConnectionProfile` + `SseConnectionConfig`.
- Implement connect-time resolution (`resolveWsAuth(auth, profiles, envVarMap) → { headers[], queryParams[] }`).
- Left `Auth` tab + resolved-as preview + profile selector.
- **Success:** all auth types resolve correctly; persisted; tested; browser-mode limitations surfaced.

### Phase 9 — ⭐ Console: structured log (B) + Raw toggle (A) 🔲
- `WsConsoleEntry` model + `WsConsoleSettings` + view-agnostic `useWebSocketConsole` listener; handshake capture.
- Right `Console` tab with **structured** default view (severity + category filter, search, expandable rows) and a **Raw** toggle that re-renders the same entries as the Insomnia curl-verbose timeline; export/clear/auto-scroll.
- SSE console parity (both views).
- **Success:** every lifecycle transition + handshake recorded; both views render the same data; filters work; ring-buffer capped; tested.

### Phase 10 — ⭐ Console: command line (C) 🔲
- Bottom command input, parser, dispatch to existing studio actions, history, `/help`; echoes as `command`-direction entries.
- **Success:** `/ping /close /connect /disconnect /clear /send /template` work; SSE limited to `/connect /disconnect /clear`; tested.

### Phase 11 — Polish & QA 🔲
- Keyboard nav, ARIA, focus order; pane resize persistence; theme QA (dark/light/dim/steel/sapphire); E2E (`--reporter=list`).
- **Success:** a11y pass; 0 type/lint/test errors; E2E green; mockups match shipped UI.

---

## 10. Component & File Map

> New files marked ⭐. Relocations reuse existing components inside new containers.

```
src/features/websocket/
  WebSocketStudioShell.tsx           ⭐ split-pane shell (mode switch, URL bar, status strip, divider)
  WsStudioLeftPane.tsx               ⭐ left tabs: Compose | Connect | Auth | Params | Headers
  WsStudioRightPane.tsx              ⭐ right tabs: Events | Console | Stats | Load Test | Schema
  WebSocketAuthPanel.tsx             ⭐ Auth tab (wraps shared AuthConfigPanel)
  wsAuthResolve.ts                   ⭐ AuthConfig → { headers, queryParams } (+ OAuth2 fetch)
  wsAuthResolve.test.ts              ⭐
  WebSocketConsole.tsx               ⭐ Console tab — structured view (B) + Raw timeline toggle (A) + command line (C)
  useWebSocketConsole.ts             ⭐ lifecycle/handshake listener + ring buffer
  useWebSocketConsole.test.ts        ⭐
  wsConsoleTypes.ts                  ⭐ WsConsoleEntry, levels, categories
  (existing components reused unchanged: WebSocketConnectPanel, WebSocketTlsPanel,
   KeyValueEditor, WebSocketProtocolSelector, WebSocketMessageLog, WebSocketMessageDetail,
   WebSocketStatsPanel, WebSocketLoadTest, WebSocketMessageDiff, WebSocketSchemaPanel,
   WebSocketSavedConnections, WebSocketMockServer, all hooks)

src/features/sse/
  SseStudioShell.tsx                 ⭐ split-pane SSE shell
  SseAuthPanel.tsx                   ⭐ (reuses shared AuthConfigPanel)
  SseConsole.tsx                     ⭐
  useSseConsole.ts                   ⭐

src/shared/
  components/AuthConfigPanel.tsx     ♻️ (extract shared if needed) — currently in features/requests/components
  websocket/types.ts                 ➕ add WsStudioMode, pane-tab types, auth fields, console types
  websocket/authResolve shared util  (if cross-protocol)

src/features/sse/sseTypes.ts         ➕ add auth?: AuthConfig

docs/plan/future/websocket/mockups/  ➕ ws-auth.html (Auth tab), ws-console.html (3 options), ws-console-final.html (combined)
```

---

## 11. Type Definitions

```ts
// src/shared/websocket/types.ts (additive)

export type WsStudioMode = 'client' | 'mock' | 'saved';
export type WsLeftTab = 'compose' | 'connect' | 'auth' | 'params' | 'headers';
export type WsRightTab = 'events' | 'console' | 'stats' | 'loadtest' | 'schema';

// Auth (reuse shared AuthConfig/GlobalAuthProfile from src/shared/types)
import type { AuthConfig } from '../types';

export interface WsConnectionProfile {
  // …existing fields…
  auth?: AuthConfig;             // ⭐ additive
  globalAuthProfileId?: string;  // ⭐ additive
}

// Console
export type WsConsoleLevel = 'info' | 'warn' | 'error' | 'debug';
export type WsConsoleCategory =
  | 'lifecycle' | 'handshake' | 'reconnect' | 'protocol' | 'control' | 'command' | 'system';

export type WsConsoleDirection = 'out' | 'in' | 'info' | 'command'; // drives * / > / < / $ prefix in Raw view

export interface WsConsoleEntry {
  id: string;
  level: WsConsoleLevel;
  direction: WsConsoleDirection;
  category: WsConsoleCategory;
  message: string;
  detail?: string;     // e.g., full handshake headers, stack, raw frame
  timestamp: string;
}

export interface WsConsoleSettings {
  view: 'structured' | 'raw';                 // B = structured (default), A = raw timeline
  maxEntries: number;                          // default 1000 (ring buffer)
  levelFilter: 'all' | WsConsoleLevel;
  categoryFilter: 'all' | WsConsoleCategory;
  autoScroll: boolean;
}
```

```ts
// src/features/sse/sseTypes.ts (additive)
import type { AuthConfig } from '../../shared/types';

export interface SseConnectionConfig {
  // …existing…
  auth?: AuthConfig;   // ⭐ additive
}
```

```ts
// src/features/websocket/wsAuthResolve.ts (new)
export interface ResolvedAuth {
  headers: WsKeyValueEntry[];
  queryParams: WsKeyValueEntry[];
}
export function resolveWsAuth(
  auth: AuthConfig | undefined,
  profiles: GlobalAuthProfile[],
  envVarMap: Record<string, string>,
): Promise<ResolvedAuth>;   // async for oauth2 token fetch
```

---

## 12. Risks & Open Questions

| # | Risk / question | Mitigation / proposal |
|---|---|---|
| R1 | Browser `WebSocket` can't set headers → Auth (bearer/basic) only works via proxy/Tauri | Reuse existing proxy-mode detection; for `apikey`, offer query-param mode in browser; document clearly. |
| R2 | Persistence migration (`viewTab` → mode + pane tab) | Back-compat reader + default mapping (`connect/messages → client`, `saved → saved`, `mock → mock`); covered by tests. |
| R3 | `AuthConfigPanel` may be coupled to Requests-only props (`verifyAuth`, etc.) | Phase 8 extracts a slimmer shared panel or passes no-op verify for WS/SSE. |
| R4 | OAuth2 token fetch from the client (CORS/secret exposure) | Perform via existing proxy/Tauri where available; warn on browser; never persist tokens, only config. |
| R5 | Console listening could add overhead on high-throughput sockets | Ring buffer + batched updates + category filtering; reuse the metrics throttling pattern. |
| R6 | Scope creep (rewrite vs reskin) | Phases 1–7 are strictly presentation; transport/hooks untouched; only Phases 8–10 add code. |
| Q1 | Should `Auth` be its own left tab or a panel inside `Connect`? | ✅ **DECIDED:** own dedicated tab (matches Requests). |
| Q2 | Console design — A, B, C, or a mix? | ✅ **DECIDED:** build all three combined — B structured log (default) + A Raw timeline toggle (Phase 9), C command line (Phase 10). |
| Q3 | Feature-flag the new shell, or hard cut-over? | ✅ **DECIDED:** feature-flag during Phases 1–7, remove the flag at Phase 11 (rationale below). |

**Q3 explained — "feature-flag vs. hard cut-over":** This is about *how* we switch users from the old 4-tab UI to the new split-pane UI.
- **Hard cut-over** = delete the old UI and replace it with the new one in a single change. Simpler, but if the new shell has a bug, there is no way to fall back, and every phase would have to be perfect before shipping.
- **Feature flag** = keep BOTH UIs in the code behind a setting (e.g., a "New WebSocket UI (preview)" toggle). Users (and we, during QA) can flip between old and new to compare side-by-side. We build the new shell incrementally across Phases 1–7 while the old UI still works, then once parity is verified we **remove the flag and the old code** at Phase 11. **Recommended** because the redesign spans many phases and the flag de-risks each step.

---

## 13. Global Success Criteria

- [ ] 100% feature parity with Phases 1–19 (every row in [§5](#5-feature-parity-matrix-nothing-is-lost) verified in the new shell).
- [ ] Persisted WS tab state migrates from `viewTab` to mode + pane tabs without data loss.
- [ ] ⭐ Auth: all `AuthType`s resolve to correct headers/params; global-profile inheritance works; persisted on profiles; browser limitations surfaced.
- [ ] ⭐ Console: structured view (severity + category filter, search, expandable rows) **and** Raw timeline toggle render the same captured stream; every lifecycle transition + handshake captured; export/clear/auto-scroll; ring-buffer cap; SSE parity. (Command line in Phase 10.)
- [ ] Theme-correct in dark + light (+ dim/steel/sapphire by inheritance).
- [ ] `npx tsc -b --noEmit` → 0 errors.
- [ ] Touched-file unit tests pass during dev; full suite + E2E (`--reporter=list`) green before any merge to develop.
- [ ] Mockups updated to match shipped UI (Auth tab real, Console badged then implemented).
- [ ] No regression to workflow WS nodes or harness assertions.

---

### Retrospective / Implementation Notes
_(append per phase: start/end dates, commit hashes, design deltas vs this plan)_
