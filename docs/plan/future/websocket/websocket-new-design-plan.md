# WebSocket / SSE — New Design (Redesign) Plan

> Branch (target for implementation): `feature/websocket` → new `feature/ws-redesign-*` branches per phase
> Created: 2026-06-10
> Status: **✅ Complete & default** — Phases 0–11 all implemented + tested on `feature/websocket` (uncommitted). The redesigned split-pane shell is now the **default (and only) studio layout**: the `redfire-ws-studio-shell-v2` / `redfire-sse-studio-shell-v2` feature flags and the **Settings → Labs** toggles were **removed** (2026-06-11). The legacy flat-tab / stacked layouts are retained as dead code, reachable only via an optional `shellV2` test prop. **Remaining:** commit/merge + full merge-gate verification (see [§13](#13-global-success-criteria)).
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
- Reuse the shared [AuthConfigPanel.tsx](../../../src/features/requests/components/AuthConfigPanel.tsx) component **in place** — it is already fully presentational (props-only, no Requests coupling), so no extraction/move is needed (resolved in Phase 8.1). Thin `WebSocketAuthPanel` / `SseAuthPanel` wrappers add the resolved-as preview + browser-mode callout around it.
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
| 0 | Foundations: shared CSS, mode/pane state, mockup honesty | Scaffolding | ✅ |
| 1 | Split-pane shell + mode switch + persistence migration | Presentation | ✅ |
| 2 | Left pane: Connect / Params / Headers relocation | Presentation | ✅ |
| 3 | Left pane: Compose relocation | Presentation | ✅ |
| 4 | Right pane: Events + detail relocation | Presentation | ✅ |
| 5 | Right pane: Stats / Load Test / Schema as tabs | Presentation | ✅ |
| 6 | Saved mode + Mock mode reskin (6a Saved ✅ / 6b Mock ✅) | Presentation | ✅ |
| 7 | SSE split-pane reskin | Presentation | ✅ |
| 8 | ⭐ Auth feature (WS + SSE) | New feature | ✅ |
| 9 | ⭐ Console — structured log (B) + Raw timeline toggle (A) | New feature | ✅ |
| 10 | ⭐ Console — command line (C) | New feature | ✅ |
| 11 | Polish, a11y, keyboard, theme QA, E2E | Hardening | ✅ |

Status legend: 🔲 not started · 🔨 in progress · ✅ complete.

---

## 9. Phased Implementation Plan

> Each phase is independently shippable, keeps all tests green, and is presentation-additive until Phases 8–10.

### Phase 0 — Foundations ✅
- Promote the mockup `mockup.css` patterns into a real stylesheet plan (map each mockup class → production CSS module / existing class) — see [§10.1](#101-mockup-css--production-css-mapping).
- Introduce the studio-layout foundation in [src/shared/websocket/types.ts](../../../src/shared/websocket/types.ts) (pure, no runtime wiring):
  - `WsStudioMode`, `WsLeftTab`, `WsRightTab` union types + `WS_STUDIO_MODES` / `WS_LEFT_TABS` / `WS_RIGHT_TABS` const tuples (single source of truth).
  - Defaults `WS_DEFAULT_MODE` / `WS_DEFAULT_LEFT_TAB` / `WS_DEFAULT_RIGHT_TAB`.
  - Type guards `isWsStudioMode` / `isWsLeftTab` / `isWsRightTab` (consumed by the Phase 1 persistence validator).
  - Pure `mapViewTabToStudioLocation(viewTab)` implementing the [§4.2](#42-mapping-old--new) old→new mapping. **Not wired into any component or persistence yet** — Phase 1 consumes it.
- **Mockup honesty:** add a real `Auth` left tab + dedicated `ws-auth.html`, and badge `Console` "NEW" across the mockups. ✅ done.
- **Success:** `npx tsc -b --noEmit` → 0 errors; new helpers/guards unit-tested in `types.test.ts`; mockups updated; **no runtime change** (nothing imports the new types yet).

> **Implementation notes (retrospective):**
> - Foundation landed in [src/shared/websocket/types.ts](../../../src/shared/websocket/types.ts) (adjacent to the existing `WsViewTab` / `WsPersistedTabState` block) rather than a new module, matching the file's existing convention of co-locating pure helpers with types.
> - **Design delta vs original §11 draft:** union types are now **derived from the const tuples** (`type WsStudioMode = (typeof WS_STUDIO_MODES)[number]`) instead of standalone literal unions. This makes the tuples a true single source of truth and eliminates type/runtime drift — important because Phase 1's persistence validator iterates the tuples.
> - **Scope refinement:** the pure `mapViewTabToStudioLocation` helper was pulled into Phase 0 (natural companion to the new types and unit-testable). It is intentionally **not wired** into persistence or any component, so Phase 0 stays runtime-neutral; Phase 1 owns wiring it into `loadWsTabState`.
> - 14 unit tests added to `types.test.ts` (41 total, all green). `npx tsc -b --noEmit` and `eslint` on touched files both pass.

### Phase 1 — Split-pane shell + mode switch ✅

**Approach: Option A — de-risked wrapper.** Land the non-UI foundation (persistence migration + feature flag + tests) and a minimal-but-real `WebSocketStudioShell` that wraps the **existing** `WsConnectionTabContent` in new mode-switch + split-pane chrome. The shell becomes the single source of navigation truth when the flag is on; existing content stays put and is progressively relocated into the real left/right panes in Phases 2–5. No behavior change when the flag is off.

**1. Persistence model + back-compat migration** (`src/shared/websocket/types.ts` + `websocketStorage.ts`)
- Extend `WsPersistedTab` with **optional** `mode?: WsStudioMode`, `leftTab?: WsLeftTab`, `rightTab?: WsRightTab`. Keep `viewTab: WsViewTab` (required) for back-compat — old builds and the flag-off path keep working, and the migration is fully reversible.
- Stay on the **same** storage key `redfire-ws-tab-state-v1` (additive optional fields; no v2 key needed).
- `loadWsTabState` **normalizes** every valid tab so `mode`/`leftTab`/`rightTab` are always populated after load: use present-and-valid values (validated with Phase 0 guards `isWsStudioMode`/`isWsLeftTab`/`isWsRightTab`); otherwise derive from `mapViewTabToStudioLocation(viewTab)`. Invalid present values fall back to the derived value (tolerant, never drops the tab).
- `isValidPersistedTab` is unchanged in its accept/reject logic (still keyed on `viewTab` ∈ `VALID_VIEW_TABS`); the new fields are validated/normalized during load, not used to reject tabs.
- `saveWsTabState` is unchanged (persists whatever shape it is given).

**2. Feature flag** (`src/shared/websocket/wsStudioShellFlag.ts`, new)
- Tiny module over `readKey`/`writeKey` (key `redfire-ws-studio-shell-v2`, default `false`): `loadWsShellV2Enabled(): Promise<boolean>` + `saveWsShellV2Enabled(enabled: boolean): Promise<void>`. No new framework — mirrors the existing single-key settings pattern (e.g. `perf-test-theme`).
- A visible QA toggle in the studio header is **out of scope** for Phase 1; the flag is set programmatically/in storage for side-by-side QA. (A header toggle can land in Phase 11 polish.)

**3. `WebSocketStudioShell`** (`src/features/websocket/WebSocketStudioShell.tsx`, new)
- Presentational wrapper. Props: `mode`, `onModeChange`, `leftTab`, `onLeftTabChange`, `rightTab`, `onRightTabChange`, plus `children` (the existing `WsConnectionTabContent`) and badge counts.
- Renders: **mode switch** (Client / Mock / Saved) → **resizable split pane** (Client mode only): left rail with the `WsLeftTab` strip (Compose/Connect/Auth/Params/Headers), a draggable divider, and a right area with the `WsRightTab` strip (Events/Console/Stats/LoadTest/Schema). Mock/Saved modes render full-width.
- The divider reuses an adapted single-axis resizer (the existing `useResizablePanels` is palette/config-specific; Phase 1 adds a small dedicated `ws-studio-split` resizer or generalizes it).
- New CSS in `websocket-studio.css`: `.ws-studio-modes` / `.ws-studio-mode`, `.ws-studio-split` / `.ws-studio-left` / `.ws-studio-right` / `.ws-studio-divider` (see [§10.1](#101-mockup-css--production-css-mapping)).

**4. `WsConnectionTabContent` — backward-compatible controlled mode**
- Add optional `controlledViewTab?: WsViewTab`. When provided, the child renders that view instead of internal state **and hides its own `.ws-studio-tabs` bar** (the shell owns nav). When absent, the component behaves **exactly as today** (uncontrolled) — old callers unaffected.
- Existing `onViewTabChange` continues to report changes.

**5. `WebSocketStudioPage` wiring**
- Track `mode`/`leftTab`/`rightTab` per tab (refs + debounced save), seeded from the normalized `loadWsTabState` result; persist them in `debouncedSave` and the unmount flush.
- Read the flag on mount. When **on**, wrap each `WsConnectionTabContent` in `WebSocketStudioShell` and derive the child's `controlledViewTab` from `(mode, leftTab)`: `mock`→`'mock'`, `saved`→`'saved'`, `client`+`leftTab==='connect'`→`'connect'`, else→`'messages'`. When **off**, render exactly as today.
- Tabs whose new left/right selections have no dedicated content yet (Auth/Params/Headers/Console/Stats/LoadTest/Schema) map to the nearest existing view (`connect` or `messages`) for Phase 1; Phases 2–5 give them real panes.

**Test plan**
- `websocketStorage.test.ts`: round-trip with new fields; back-compat read of a legacy `viewTab`-only blob (fields derived); tolerant fallback when a new field is invalid; `activeTabId`/`renamedTabIds` behavior preserved.
- `wsStudioShellFlag.test.ts` (new): default `false`; persists `true`/`false`; tolerates malformed/missing storage.
- `WebSocketStudioShell.test.tsx` (new): renders mode switch; `onModeChange`/`onLeftTabChange`/`onRightTabChange` fire; split pane only in Client mode; children render.
- `WsConnectionTabContent`: controlled mode hides own tab bar and renders the controlled view; uncontrolled path unchanged (existing tests stay green).

- **Success:** flag **off** ⇒ zero behavior change (all existing tests green); flag **on** ⇒ new chrome wraps existing content, every flow reachable without data loss; persistence migrates cleanly from legacy blobs; `npx tsc -b --noEmit` + touched tests + lint all green.

> **Scope note vs original plan:** the original Phase 1 bullet listed "connection bar → mode switch → URL bar → status strip → split pane". The connection bar (`WsConnectionTabBar`) already exists and is unchanged; the **URL bar and status strip relocation stays with their content** (Phases 2/4/5) since they currently live inside `WebSocketConnectPanel`/`WebSocketMessageLog`. Phase 1 delivers the mode switch, the split-pane container + divider, the persistence migration, and the flag.

> **Implementation notes (retrospective):**
> - **`deriveViewTabFromStudio` added** to [src/shared/websocket/types.ts](../../../src/shared/websocket/types.ts) — the *inverse* of `mapViewTabToStudioLocation`. The plan described the derivation inline ("`mock`→`'mock'`, `saved`→`'saved'`, …"); it was extracted into a pure, unit-tested helper so the page wiring and the persistence builder share one round-trippable mapping (`deriveViewTabFromStudio(loc.mode, loc.leftTab)` round-trips with `mapViewTabToStudioLocation` for every view tab).
> - **Persistence `buildPersistState` is bidirectional.** Flag **on** + a known studio location ⇒ the location is the source of truth and the legacy `viewTab` is recomputed via `deriveViewTabFromStudio`. Flag **off** (or no location yet) ⇒ `viewTab` leads and `mode`/`leftTab`/`rightTab` are derived from it. This keeps the legacy field consistent in both directions and means even flag-off saves now carry the (derived) new fields — harmless and forward-compatible.
> - **Divider implemented locally**, not via `useResizablePanels`. The shell owns a tiny `leftWidth` state + window `mousemove`/`mouseup` listeners, clamped to `MIN_LEFT_PX` (320) … `container.clientWidth - MIN_RIGHT_PX` (220). `useResizablePanels` is palette/config-specific and generalizing it was unnecessary for a single divider. Pane width is **not persisted** in Phase 1 (resets to 560px on remount) — a candidate for Phase 11 polish.
> - **`controlledViewTab` extension** to `WsConnectionTabContent`: internal state renamed `internalViewTab`; `const viewTab = controlledViewTab ?? internalViewTab` and the `.ws-studio-tabs` bar is wrapped in `{!isControlled && …}`. Child-initiated nav (e.g. "Save as profile" → `changeViewTab('saved')`) still fires `onViewTabChange`, which the page maps back into `studioLoc` so the shell follows.
> - **`studioLoc` cleanup on tab close** added alongside the other per-tab map deletions, so closed tabs leave no stale location entries.
> - **Mount-stability fix (round-2 re-eval):** the first shell draft rendered `{children}` in two separate ternary branches (`.ws-studio-split` for client mode vs `.ws-studio-mode-body` for mock/saved). Switching mode would move the child between branches and **remount** `WsConnectionTabContent`, dropping the live WebSocket connection + in-memory message log — a regression vs. the flag-off path where switching views never remounted. Fixed by **always** rendering `.ws-studio-split` with the child fixed at `.ws-studio-split > .ws-studio-left > .ws-studio-left-body`; only the left-tab strip, divider, and right pane are toggled per mode (conditional `&&`, which preserves positional reconciliation). Non-client modes add `.ws-studio-split-single` so the single pane goes full-width. A regression test asserts the child DOM node identity is preserved across Client→Mock→Client.
> - **Right-pane orthogonality fix (round-3 re-eval):** `handleViewTabChange` (child-initiated nav, e.g. "Edit Connection" → `connect`, "Save as profile" → `saved`) replaced the whole `studioLoc` entry via `mapViewTabToStudioLocation`, which **reset `rightTab` to its default (`'events'`)**. The right pane is an independent axis from the left/mode strips, so a left-side nav must not clobber the user's right-pane selection. Fixed by merging — the mode + left tab follow the `viewTab`, but `rightTab` is preserved (`{ ...mapped, rightTab: cur?.rightTab ?? mapped.rightTab }`). `handleModeChange`/`handleLeftTabChange` already preserved the other axes via spread. A test locks right-tab persistence across left-tab and mode round-trips.
> - **CSS added** to [src/styles/websocket-studio.css](../../../src/styles/websocket-studio.css): `.ws-studio-shell`, `.ws-studio-modes`/`.ws-studio-mode`, `.ws-studio-split`/`.ws-studio-split-single`/`.ws-studio-left`/`.ws-studio-left-body`/`.ws-studio-divider`/`.ws-studio-right`/`.ws-studio-right-body`, and `.ws-studio-pane-placeholder`(+`-title`/`-hint`). Matches the file's existing `var(--token, fallback)` convention (e.g. `--bg-secondary`, `--accent-color`).
> - **Right pane is a labelled placeholder** in Client mode for Phase 1 (the real Events/Console/Stats/LoadTest/Schema content relocates in Phases 3–5). The left pane carries the full existing `WsConnectionTabContent`, so no flow is lost.
> - **Verification:** `npx tsc -b --noEmit` → 0 errors. Touched tests green: `types.test.ts` (46), `websocketStorage.test.ts` (52, incl. 5 new migration tests), `wsStudioShellFlag.test.ts` (6, new), `WebSocketStudioShell.test.tsx` (9, new — incl. a mode-switch mount-stability test), `WsConnectionTabContent.test.tsx` (67, incl. 4 new controlled-mode tests), `WebSocketStudioPage.test.tsx` (79, incl. 5 new flag-on integration tests), plus existing `WebSocketStudioPage.callbacks`. `eslint` clean on all touched files.

### Phase 2 — Left: Connect / Params / Headers ✅
- Split the monolithic `connect` view into the three left-pane tabs the Phase 1 shell already renders (`Connect` / `Params` / `Headers`), driven by the active `leftTab`:
  - **Connect tab** → `WebSocketConnectPanel` (URL, subprotocols, protocol selector, auto-reconnect, close-code, connect/disconnect actions) + `WebSocketTlsPanel` + the existing message-log preview/guard. **Headers and Query Params are no longer rendered inline here** (they have dedicated tabs).
  - **Headers tab** → a standalone `KeyValueEditor` bound to `studio.draft.headers`.
  - **Params tab** → a standalone `KeyValueEditor` bound to `studio.draft.queryParams`.
  - **Auth tab** → continues to map to the Connect config for now (real Auth panel lands in Phase 8); no regression.
- **Architecture (mirrors the Phase 1 `controlledViewTab` pattern):**
  - `WebSocketConnectPanel` gains `showHeaders?: boolean` / `showQueryParams?: boolean` (both default `true`, so the uncontrolled / flag-off path is byte-for-byte unchanged). The unresolved-`{{var}}` warning computations stay regardless of these flags (they still inform the URL-row warning even when the editors are relocated).
  - `WsConnectionTabContent` gains `controlledLeftTab?: WsLeftTab`. When present (shell controls it), the `connect` view branches on it: `headers` → standalone Headers editor, `params` → standalone Params editor, else → `WebSocketConnectPanel` with `showHeaders={false}`/`showQueryParams={false}`. When absent (flag off) the component renders exactly as today.
  - The standalone editors reuse the same `KeyValueEditor` test-id prefixes (`headers` / `query-params`) and the same disabled logic as the panel (`busy || reconnecting`); they are never rendered simultaneously with the panel's copies, so no duplicate test-ids.
- Keep the config-lock-while-connected banner — shown above the editor on the Connect, Headers, and Params tabs while connected; the relocated `KeyValueEditor`s are disabled when busy/reconnecting (same as today).
- **Deferred to keep Phase 2 focused:** per-tab count badges on Headers/Params (the counts live in the child's `studio` draft, not at page level — would require lifting state; revisit in Phase 11 polish). The unified top URL bar relocation also stays deferred (Phase 1 scope note).
- **Mount stability:** switching left tabs only changes which JSX the always-mounted child renders — the `studio` hook (live WS connection + message log) is never remounted (same guarantee as the Phase 1 mode switch).
- **Test plan:**
  - `WebSocketConnectPanel.test.tsx`: `showHeaders={false}` hides the headers section; `showQueryParams={false}` hides the params section; defaults still render both.
  - `WsConnectionTabContent.test.tsx`: with `controlledLeftTab='headers'` only the Headers editor renders (no params, no URL panel); `='params'` only Params; `='connect'` renders the panel **without** inline headers/params; uncontrolled path still renders headers + params inline.
- **Success:** identical behavior; relocated only. `npx tsc -b --noEmit` + touched tests + lint all green.

> **Implementation notes (retrospective):**
> - **`controlledLeftTab?: WsLeftTab` added** to `WsConnectionTabContent` (mirrors the Phase 1 `controlledViewTab` pattern). Inside the `connect` view it branches: `headers` → standalone `KeyValueEditor` bound to `studio.draft.headers`; `params` → standalone editor bound to `studio.draft.queryParams`; everything else (`connect`/`auth`) → `WebSocketConnectPanel`. The page passes `controlledLeftTab={shellV2 ? loc.leftTab : undefined}` so the flag-off path is fully unaffected.
> - **`showHeaders` / `showQueryParams` props added** to `WebSocketConnectPanel` (both default `true`). When the shell splits the config, the Connect tab renders the panel with both `false` so headers/params are not duplicated; they live in their own tabs. The unresolved-`{{var}}` warning computations are kept regardless of these flags (the URL-row warning still reflects the whole connection).
> - **Disabled parity:** the relocated editors compute `connectInputsDisabled` (`connected || connecting || closing || reconnectState.active`) which exactly equals the panel's internal `inputsDisabled`, so the config-lock-while-connected behavior is identical. The lock banner is hoisted above the per-tab branch and now shows on the Connect, Headers, and Params tabs while connected.
> - **No new CSS** — the standalone editors reuse `.ws-connect-kv-section` inside the existing `.ws-studio-content` wrapper; they share the panel's `KeyValueEditor` test-id prefixes (`headers` / `query-params`) and are never rendered alongside the panel's copies, so no duplicate test-ids.
> - **Mount stability preserved:** switching left tabs only changes which JSX the always-mounted child renders — the `studio` hook (live connection + buffered messages) is never remounted. The transient `WebSocketConnectPanel` local UI state (open dropdowns, close-code form) resets on tab switch, which already matched the legacy connect↔messages behavior.
> - **Known incremental limitation:** Connect/Disconnect is only on the Connect tab until the unified top URL bar lands (deferred per the Phase 1 scope note). Per-tab Headers/Params count badges are also deferred (counts live in the child's draft, not at page level) — candidate for Phase 11 polish.
> - **`auth` left tab** still maps to the connect config (panel without headers/params) as a no-regression placeholder until Phase 8 replaces it with the real Auth panel.
> - **Verification:** `npx tsc -b --noEmit` → 0 errors. Touched tests green: `WebSocketConnectPanel.test.tsx` (+4 relocated-section tests), `WsConnectionTabContent.test.tsx` (+6 controlled-left-tab tests), `WebSocketStudioPage.test.tsx` (80, +1 left-tab split integration test). Full WS-redesign touched set 371 green; `eslint` clean on all touched files.

### Phase 3 — Left: Compose ✅
- Move composer + protocol composers + templates to the left `Compose` tab; keep ⌘↵ send + ping.
- **Success:** send/receive parity; templates parity.

> **Re-evaluation finding (architectural coupling with Phase 4):** The composer currently lives *inside* `WebSocketMessageLog` (rendered as `{!isReplaying && composeBar}` at the bottom of the events list, via the `useWebSocketCompose` hook). In the target mockup the Compose tab (left pane) and the Events list (right pane) are shown **side-by-side simultaneously** — so a composer-only Compose tab is only meaningful once the events list lives in the right pane. But the **right pane is still a placeholder** (Phase 1), and the live `studio` hook (WebSocket connection + message buffer) is owned **inside** `WsConnectionTabContent`, while the right pane is rendered by `WebSocketStudioShell` *around* that child. Feeding events into the right pane therefore requires **inverting the shell composition** so the studio-owning child renders both panes — a non-trivial change that is the natural home of **Phase 4** (events relocation). Doing it in Phase 3 would merge two phases and risk the 371 green tests.
- **Chosen Phase 3 scope (focused, low-risk, parity-preserving — matches the Phase 1/2 cadence):**
  - **Extract the composer into a standalone, reusable `WebSocketComposePane`** that wraps `useWebSocketCompose` and renders the existing `composeBar` (text/binary editor, format selector, protocol-specific composers for Socket.IO / STOMP / GraphQL-WS, templates dropdown, send + ping). This decouples the composer from `WebSocketMessageLog` so Phase 4 can relocate **only** the events list to the right pane while the composer stays in the left Compose tab.
  - **Add `showComposer?: boolean` (default `true`) to `WebSocketMessageLog`** (mirrors the Phase 2 `showHeaders`/`showQueryParams` pattern). When `false`, the inline `composeBar` is suppressed so the events list renders without its own composer. Default `true` keeps the uncontrolled / flag-off path byte-for-byte unchanged.
  - **In `WsConnectionTabContent`, the `messages` view** (which the shell reaches via `leftTab === 'compose'` → `deriveViewTabFromStudio` → `'messages'`) renders the events `WebSocketMessageLog` with `showComposer={controlledLeftTab !== 'compose'}` and, when `controlledLeftTab === 'compose'`, the standalone `WebSocketComposePane` below it (same on-screen position as today's inline composer, so the visual + UX is unchanged). The composer is hidden during replay (`hidden={isReplaying}`), matching the log's `{!isReplaying && composeBar}` behavior.
- **Architecture (mirrors Phase 1 `controlledViewTab` / Phase 2 `controlledLeftTab`):** no new controlled prop is needed — the existing `controlledLeftTab` already distinguishes the Compose tab. The standalone pane and the log's inline composer are **never rendered simultaneously** (one is gated off when the other is on), so there are no duplicate `send-btn` / `ping-btn` / `compose-footer` test-ids.
- **Transitional state (resolved in Phase 4):** because the right pane is not yet wired, the events list remains visible in the Compose tab (above the standalone composer) for now. Phase 4 introduces the right-pane content slot (shell composition inversion) and relocates the events list there, at which point the Compose tab becomes composer-only and matches the mockup. This is an intentional, documented intermediate that keeps every flow reachable and all tests green.
- **No new CSS** — the standalone pane reuses the existing `.ws-compose-bar` markup produced by `useWebSocketCompose`; it sits inside the existing `.ws-studio-content` wrapper exactly where the inline composer rendered before.
- **Test plan:**
  - `WebSocketMessageLog.test.tsx`: `showComposer={false}` hides the composer (no `send-btn`); default / `showComposer={true}` still renders it.
  - `WebSocketComposePane.test.tsx` (new): renders the composer (`send-btn`, `ping-btn`); `hidden` returns nothing; send/ping wired to callbacks; protocol-specific fields appear for `socket-io` / `stomp` / `graphql-ws`.
  - `WsConnectionTabContent.test.tsx`: with `controlledLeftTab='compose'` the standalone composer renders and the log's inline composer is suppressed (exactly one `send-btn`); uncontrolled path still renders the inline composer.
- **Success:** identical send/receive + template behavior; composer decoupled and relocated into the Compose tab; `npx tsc -b --noEmit` + touched tests + lint all green.

> **Implementation notes (retrospective):**
> - **`WebSocketComposePane` added** ([src/features/websocket/WebSocketComposePane.tsx](../../../src/features/websocket/WebSocketComposePane.tsx)) — a thin standalone wrapper over `useWebSocketCompose` that renders the existing `composeBar`. It takes the same option set as the hook plus a `hidden?: boolean` (returns `null` when hidden, mirroring the log's `{!isReplaying && composeBar}`). This is the decoupling deliverable: the composer no longer *must* live inside `WebSocketMessageLog`. (The plan's original §10 component map named a broader `WsStudioLeftPane.tsx`; consistent with the Phase 1/2 de-risked-wrapper divergence, a focused `WebSocketComposePane` was added instead.)
> - **`showComposer?: boolean` (default `true`) added to `WebSocketMessageLog`** — gates the inline composer (`{!isReplaying && showComposer && composeBar}`). Default `true` keeps every existing caller (the connect-tab preview at line 533, the uncontrolled/flag-off messages view) byte-for-byte unchanged. Only the Compose-tab render passes `showComposer={controlledLeftTab !== 'compose'}`.
> - **No new `controlledLeftTab` value or prop needed** — the existing Phase 2 `controlledLeftTab` already carries `'compose'` (it is one of `WS_LEFT_TABS`). In `WsConnectionTabContent`'s `messages` view (reached via `leftTab === 'compose'` → `deriveViewTabFromStudio` → `'messages'`), the events log renders with the inline composer suppressed and the standalone `WebSocketComposePane` renders below it, hidden during replay (`recordingState === 'replaying' || 'paused'`).
> - **Exactly one composer at a time:** the log's inline composer and the standalone pane are mutually exclusive (`showComposer={false}` ⇔ pane rendered), so there are never duplicate `send-btn` / `ping-btn` / `compose-footer` test-ids. The hidden log still *calls* `useWebSocketCompose` internally (hook runs unconditionally) but doesn't render it — harmless, and it attaches no global listeners while its template dropdown is closed.
> - **Parity preserved:** the standalone pane receives the same `onSend` / `onPing` / templates / `effectiveProtocol` / `transportMode` / `totalCount` / `maxMessages` as the log, so ⌘↵ send, ping (proxy/native only), the Socket.IO / STOMP / GraphQL-WS protocol composers, and template save/load/delete all behave identically. Verified the only production `WebSocketMessageLog` callers are the two in `WsConnectionTabContent`.
> - **Documented transitional state:** because the right-pane content slot is not yet wired, the **events list remains visible in the Compose tab** (above the standalone composer), so the on-screen layout is essentially unchanged from before (events list + composer). **Phase 4** introduces the right-pane content slot (shell composition inversion so the studio-owning child can feed both panes) and relocates the events list there; the Compose tab then becomes composer-only and matches the mockup. This keeps every flow reachable and all tests green in the interim.
> - **No new CSS** — the standalone pane reuses the `.ws-compose-bar` markup from `useWebSocketCompose` inside the existing `.ws-studio-content` wrapper.
> - **Verification:** `npx tsc -b --noEmit` → 0 errors. New/updated tests green: `WebSocketComposePane.test.tsx` (10, new), `WebSocketMessageLog.test.tsx` (+3 `showComposer` tests, 204 total), `WsConnectionTabContent.test.tsx` (+4 compose-tab tests), `WebSocketStudioPage.test.tsx` (81, +1 Compose-tab integration test). Full WS feature + shared suite **1887 tests green** (52 files); `eslint` clean on all touched files.


### Phase 4 — Right: Events + detail ✅
- Move `WebSocketMessageLog` to right `Events` tab; filter bar + presets + recording in toolbar; `WebSocketMessageDetail` below (resizable).
- **Success:** virtualization, filters, bookmarks, diff, export/import all parity.

> **Re-evaluation finding (the shell composition inversion deferred from Phase 3):** Through Phase 3 the studio-owning child (`WsConnectionTabContent`) was rendered *inside* `WebSocketStudioShell` by the page (`<Shell>{child}</Shell>`), and the shell's right pane was a hardcoded `.ws-studio-pane-placeholder`. The events list (`WebSocketMessageLog`) needs the live `studio` hook (connection + message buffer + filters + bookmarks + recording + schema), which is owned **inside** the child. The right pane is rendered by the shell **around** the child, so the child cannot feed it. Therefore Phase 4 must **invert the composition**: the studio-owning child renders the shell itself, supplying both the left body (`children`) and a new right-pane slot. Neither the page nor the shell own studio state, so this is the only place that can drive both panes from one hook instance.
>
> **Chosen Phase 4 design (low-risk, additive, flag-gated):**
> - **`WebSocketStudioShell` gains an additive `rightPane?: ReactNode` slot.** When provided it renders in `.ws-studio-right-body` *instead of* the placeholder; when omitted the placeholder renders exactly as before. `children` stays the left body. This keeps the shell's own unit tests unchanged (they pass `children` only) and keeps non-events right tabs on the placeholder until Phase 5.
> - **Invert composition in `WsConnectionTabContent`.** Add controlled shell props: `controlledMode?: WsStudioMode`, `controlledRightTab?: WsRightTab`, and `onModeChange` / `onLeftTabChange` / `onRightTabChange`. When `controlledMode` is set ("shell mode", flag on) the child renders `<WebSocketStudioShell …>{leftBody}</WebSocketStudioShell>` with `rightPane={rightBody}`, deriving `viewTab` from `deriveViewTabFromStudio(mode, leftTab)`. The legacy uncontrolled path (flag off → own view-tab bar + flat blocks) is **untouched**; the pre-existing `controlledViewTab`/`controlledLeftTab` flat path is retained for component-level unit coverage of the inner panels.
>   - **Left body (client mode):** `compose` → `WebSocketComposePane` only (no events list above it — the Phase 3 transitional state is now resolved); `connect`/`auth` → lock banner + `WebSocketConnectPanel` (`showHeaders`/`showQueryParams={false}`) + `WebSocketTlsPanel`; `params` → query-params `KeyValueEditor`; `headers` → headers `KeyValueEditor`. (`mock`/`saved` modes render their full-width views as `children`; the shell hides the divider + right pane.)
>   - **Right body (client mode):** `events` → `WebSocketMessageLog` with `showComposer={false}` + `showStatusBar` (brings its filter bar, presets, recording toolbar, virtualization, bookmarks, diff, export/import, and the `WebSocketMessageDetail` panel it already contains), plus the `WebSocketLoadTest` panel when toggled; every other right tab → `undefined` (shell placeholder, relocated in Phase 5/9).
> - **`WebSocketStudioPage` stops wrapping the child in the shell.** When `shellV2` it renders `<WsConnectionTabContent controlledMode controlledLeftTab controlledRightTab onModeChange onLeftTabChange onRightTabChange …/>` directly (no `controlledViewTab` — the child derives it). The page still owns `studioLoc` (mode/leftTab/rightTab per tab) and persistence; the handlers are unchanged. The child now supplies the shell's `messageCount` / `mockRunning` badges from its own `studio`/`mockServer` (the page could not before).
> - **Parity & risk:** the events log component is reused verbatim (only `showComposer`/`showStatusBar` differ), so virtualization/filters/bookmarks/diff/export/import are unchanged. The flag-off path is byte-identical. All shell testids (`ws-studio-shell`, `mode-*`, `left-tab-*`, `right-tab-*`, `ws-studio-split`, `ws-studio-divider`) still render — now from the child — so the page integration tests continue to pass.
>
> **Implementation notes (done):**
> - `WebSocketStudioShell` gained `rightPane?: ReactNode`, rendered as `{rightPane ?? <placeholder>}` in `.ws-studio-right-body` — fully backward compatible (shell's own tests pass `children` only and still hit the placeholder).
> - `WsConnectionTabContent` now owns the inversion: new props `controlledMode`, `controlledRightTab`, `onModeChange`, `onLeftTabChange`, `onRightTabChange`. When `controlledMode !== undefined` it renders `<div.ws-conn-tab-content><WebSocketStudioShell rightPane={rightBody}>{leftBody}</WebSocketStudioShell></div>` and returns early. `viewTab` is derived via `deriveViewTabFromStudio(controlledMode, shellLeftTab)` so the mock-server polling hook, status bar, etc. keep working.
> - Shared content nodes (`lockBannerNode`, `headersEditorNode`, `queryParamsEditorNode`, `connectPanelNode`, `composePaneNode`, `savedConnectionsNode`, `mockServerNode`) were extracted and reused by **both** the legacy flat render and the shell render, so the two paths cannot drift.
> - `WebSocketStudioPage` stopped importing/rendering `WebSocketStudioShell`; it now passes `controlledMode`/`controlledLeftTab`/`controlledRightTab` + the three nav handlers to the child and no longer passes `controlledViewTab` (child derives it). Badges (`messageCount`, `mockRunning`) are now fed from the child's own `studio`/`mockServer` — which the page could not do before.
> - **Re-eval fix 1:** `changeViewTab` is now shell-aware. In shell mode it translates the legacy view-tab intent into shell navigation via `mapViewTabToStudioLocation` (`onModeChange` + `onLeftTabChange`), so "Save as Profile" → Saved mode and "Use connection" / "Edit" → Connect tab work again (they previously no-op'd because `viewTab` is derived).
> - **Re-eval fix 2:** the connect panel suppresses its inline Headers/Params sections whenever `controlledMode` is set (not just when `controlledLeftTab` is set), preventing duplication with the dedicated Headers/Params left tabs.
> - **Tests:** added a `shell mode (controlledMode)` describe to `WsConnectionTabContent.test.tsx` (9 tests): shell strips render; events log in right pane with no composer; composer in Compose left tab + log on right; headers editor in Headers left tab; placeholder for non-events right tabs; single-pane Mock/Saved (no divider); nav callbacks forwarded; Save-as-Profile → Saved mode. Existing controlled-mode / controlled-left-tab / controlled-compose-tab suites retained as component-level coverage. Verified: `tsc -b` 0 errors; 52 files / 1896 tests pass; eslint clean.
> - **Deviation from §10 file map:** the planned `WsStudioRightPane.tsx` component was not created; the right pane is the existing `WebSocketMessageLog` fed through the shell's `rightPane` slot (it already contains `WebSocketMessageDetail` + `WebSocketSchemaPanel`), consistent with the Phase 3 `WebSocketComposePane` slot approach.

### Phase 5 — Right: Stats / Load Test / Schema as tabs ✅

**Goal:** In shell-v2 Client mode, the right pane already exposes the tab bar
`Events · Console · Stats · Load Test · Schema` (`WS_RIGHT_TABS`, wired in Phase 4).
Today only `Events` renders real content; the other tabs (except `console`) fall through
to the shell placeholder, and Stats / Load Test / Schema are still **toggle buttons +
inline drawers inside the Events message log**. Phase 5 promotes those three into
dedicated right-pane tab content and removes their toggles from the Events toolbar.
This is **presentation only** — no metrics/load/schema logic changes.

**Scope clarification (re-eval):**
- Only **Stats**, **Load Test**, and **Schema** become tabs. **Recording/Replay** and
  **Compare/Diff** stay in the Events toolbar — they operate directly on the events
  stream (record/replay frames, diff two selected events) and have banner/overlay UIs,
  not standalone panels. (The `ws-advanced.html` mockup drew Recording and Compare as
  tabs too, but production keeps them event-scoped; `WS_RIGHT_TABS` has no such tabs.)
- The **validation-direction filter** dropdown (`validation-filter`) stays in the Events
  toolbar — it filters the events list (All/Valid/Invalid) and only appears when
  validation is enabled with active schemas. Validation is now **enabled/disabled from
  the Schema tab**, the filter consumes that state.
- `console` remains a placeholder until Phase 9. After Phase 5, `console` is the **only**
  right tab still showing the shell placeholder.

**Design:**

1. **`WebSocketMessageLog` — add `showAuxPanels?: boolean` (default `true`).**
   When `false` (shell-mode Events pane only):
   - Hide the **Stats** (`stats-toggle-btn`), **Load Test** (`load-test-toggle-btn`),
     and **Schema** (`schema-toggle-btn`) toolbar toggle buttons.
   - Do not render the inline **Stats** panel (`showStats && metrics`) or inline
     **Schema** panel (`schemasVisible && …`).
   - Keep everything else: search/filter rows, direction filter, validation-direction
     filter, Filters, Compare, Clear, Export, Recording controls, message list + detail.

2. **`WsConnectionTabContent` — make the shell `rightBody` a per-`shellRightTab` switch**
   (client mode only):
   ```tsx
   const rightBody =
     controlledMode !== 'client' ? undefined
     : shellRightTab === 'events' ? (
         <div className="ws-studio-content">
           <WebSocketMessageLog {...messageLogProps} showComposer={false} showStatusBar showAuxPanels={false} />
         </div>
       )
     : shellRightTab === 'stats' ? (
         <div className="ws-studio-tab-pane" data-testid="ws-studio-stats-pane">
           <WebSocketStatsPanel metrics={metrics} />
         </div>
       )
     : shellRightTab === 'loadtest' ? (
         <div className="ws-studio-tab-pane" data-testid="ws-studio-loadtest-pane">
           <WebSocketLoadTest loadTest={loadTest} isConnected={isConnected} />
         </div>
       )
     : shellRightTab === 'schema' ? (
         <div className="ws-studio-tab-pane" data-testid="ws-studio-schema-pane">
           <WebSocketSchemaPanel
             schemas={schemaHook.schemas}
             validationEnabled={schemaHook.validationEnabled}
             onSetValidationEnabled={schemaHook.setValidationEnabled}
             onAddSchema={schemaHook.addSchema}
             onUpdateSchema={schemaHook.updateSchema}
             onRemoveSchema={schemaHook.removeSchema}
             onToggleSchema={schemaHook.toggleSchema}
             onGenerateSchema={schemaHook.generateSchema}
             messages={studio.messages}
           />
         </div>
       )
     : undefined; // console → shell placeholder (Phase 9)
   ```
   - The previous `{showLoadTest && <WebSocketLoadTest/>}` that hung off the Events pane
     is **removed** (Load Test now lives in its own tab).
   - Add imports for `WebSocketStatsPanel` and `WebSocketSchemaPanel` (currently only used
     transitively inside `WebSocketMessageLog`). `metrics`, `loadTest`, `schemaHook`,
     `isConnected`, and `studio.messages` are already in scope.

3. **CSS — add a `.ws-studio-tab-pane` wrapper** so Stats/Load Test/Schema fill the right
   pane and scroll cleanly, and override the inline-drawer constraints in tab context:
   ```css
   .ws-studio-tab-pane { flex: 1; min-height: 0; overflow-y: auto; }
   .ws-studio-tab-pane .ws-schema-panel { max-height: none; border-bottom: none; overflow-y: visible; flex: none; }
   .ws-studio-tab-pane .ws-stats-panel { border-top: none; }
   .ws-studio-tab-pane .ws-lt-container { border-top: none; }
   ```
   (The schema panel's `max-height: 300px` drawer cap would otherwise leave dead space in a
   full tab; the `border-top` on stats/load-test is a drawer divider that's redundant as a
   tab.)

4. **Tests:**
   - Update the existing `WsConnectionTabContent.test.tsx` shell-mode test
     *"shows a placeholder for non-events right tabs"* to use `controlledRightTab: 'console'`
     (stats is no longer a placeholder).
   - Add shell-mode tests: `stats` tab renders `stats-panel`; `loadtest` tab renders
     `load-test-panel`; `schema` tab renders `ws-schema-panel`; Events pane in shell mode
     does **not** render `stats-toggle-btn` / `load-test-toggle-btn` / `schema-toggle-btn`.
   - Add `WebSocketMessageLog.test.tsx` cases: with `showAuxPanels={false}` the three toggle
     buttons are absent; default (`true`) keeps them.

5. **Parity / empty-state notes:** Stats `metrics` is always defined (zeros when idle);
   Load Test already shows "Connect … first" when disconnected; Schema works offline.
   Legacy flat layout (`viewTab === 'messages'`) is untouched — it keeps the inline toggles.

- **Success:** Each of Stats / Load Test / Schema renders identical content/behavior in its
  own right-pane tab; Events toolbar no longer shows those three toggles in shell mode;
  legacy layout unchanged; `tsc -b` clean, touched-file tests + eslint clean; visual check
  in shell-v2 across all five right tabs.

> **Implementation notes / retrospective (Phase 5 done):**
> - `WebSocketMessageLog` gained `showAuxPanels?: boolean` (default `true`). When `false`,
>   the Stats / Load Test / Schema toolbar toggles **and** their inline drawer panels are
>   suppressed (one `showAuxPanels &&` guard on each of the three buttons + the two inline
>   panels). Filters/Compare/Clear/Export/Recording and the validation-direction filter are
>   untouched. The legacy flat layout passes nothing → keeps the inline toggles.
> - `WsConnectionTabContent` shell `rightBody` is now a per-`shellRightTab` ternary chain:
>   `events` → `WebSocketMessageLog` (`showComposer={false} showStatusBar showAuxPanels={false}`)
>   in `.ws-studio-content`; `stats` → `WebSocketStatsPanel`; `loadtest` → `WebSocketLoadTest`;
>   `schema` → `WebSocketSchemaPanel`; `console`/default → `undefined` (shell placeholder).
>   The previous `{showLoadTest && <WebSocketLoadTest/>}` that hung off the Events pane was
>   removed — Load Test is now its own tab (the tab itself is the show/hide). `showLoadTest`
>   state remains for the legacy flat path only.
> - Added imports for `WebSocketStatsPanel` and `WebSocketSchemaPanel` to
>   `WsConnectionTabContent` (previously only used transitively inside the message log).
> - CSS: new `.ws-studio-tab-pane` (`flex:1; min-height:0; overflow-y:auto`) wraps the three
>   panels with testids `ws-studio-stats-pane` / `ws-studio-loadtest-pane` /
>   `ws-studio-schema-pane`. Overrides strip the inline-drawer constraints in tab context:
>   `.ws-schema-panel { max-height:none; border-bottom:none; overflow-y:visible; flex:none }`
>   and `border-top:none` on `.ws-stats-panel` / `.ws-lt-container`.
> - **Re-eval finding:** Recording/Replay and Compare/Diff intentionally stay in the Events
>   toolbar (event-scoped, banner/overlay UIs) — `WS_RIGHT_TABS` has no tabs for them, so the
>   `ws-advanced.html` mockup's Recording/Compare tabs are not part of production IA. After
>   Phase 5, `console` is the only right tab still showing the shell placeholder.
> - **Tests:** updated the shell-mode placeholder test to target `console` (stats is no longer
>   a placeholder); added shell-mode tests for the stats/loadtest/schema panes + a test that
>   the shell Events pane omits the three relocated toggles; added a `showAuxPanels` describe
>   to `WebSocketMessageLog.test.tsx` (toggles present by default, absent + no inline stats
>   panel when `false`). Verified: `tsc -b` 0 errors; `WsConnectionTabContent.test.tsx` +
>   `WebSocketMessageLog.test.tsx` = 297 tests pass; eslint clean; live visual check in
>   shell-v2 (echo ws on :9876, connected) across Events / Console / Stats / Load Test /
>   Schema — Stats shows live metrics, Load Test shows config, Schema fills the pane with no
>   drawer cap, Events toolbar has no Stats/Load Test/Schema toggles, Console keeps the
>   placeholder.
>
> **Follow-up fix (Load Test re-run UX):** user reported that after a load test the panel
>   "only shows the status" and they "can't do any more Load Test". Root cause was
>   discoverability — the results view only had a small "New Test" text button
>   (`lt-clear-btn` -> `clearResult`, which returns to the config form and still needs a
>   second Start click); there was no obvious one-click re-run. Added a primary **"Run
>   Again"** button (`lt-run-again-btn`) to the `isDone` results view that re-runs the same
>   config immediately via `loadTest.start()` (start() works from the `done` state; it only
>   early-returns while `running`). It is disabled when `!isConnected`, with a
>   `lt-done-disconnected` hint banner. `WebSocketLoadTest` is shared by the legacy and
>   shell paths, so the fix applies to both. tsc -b clean, 38 `WebSocketLoadTest` tests pass
>   (2 new), eslint clean.
>
> **Follow-up fix (live Stats inside the running Load Test):** user wanted to watch the
>   connection Stats (Msg/s, Bytes In/Out, Frame Types) without leaving the Load Test tab
>   while a test runs. Added an optional `statsPanel?: ReactNode` slot to `WebSocketLoadTest`;
>   `WsConnectionTabContent` feeds it `<WebSocketStatsPanel metrics={metrics} />` at both
>   render sites (shell + legacy). The slot renders in the `isRunning` view only, under a
>   `LIVE CONNECTION STATS` subsection (`lt-live-stats`) between the progress metrics and the
>   Stop button. Stats remains a separate top-level tab too (user agreed it stays separate);
>   this is purely an inline convenience while running. CSS: `.ws-lt-live-stats` (top border +
>   spacing) and a reset of the nested `.ws-stats-panel` padding/border/background. Verified
>   live in shell-v2 against an echo server. tsc -b clean, 41 `WebSocketLoadTest` tests pass
>   (3 new), eslint clean.

### Phase 6 — Saved + Mock reskin ✅

> **Scope decision (user-confirmed):** faithful mockup UI (`mockups/ws-saved.html`,
> `mockups/ws-mock.html`) **AND** reuse the shell's divider + right pane for `mock`/`saved`
> too (NOT a component-internal split). This is the established composition-inversion
> pattern from Phase 4: `WsConnectionTabContent` owns the hooks and feeds the shell its
> left body + `rightPane` (+ new `topBar`). Because both components grow from a single
> column into a shell-driven two-pane layout (with selection / internal-tab UI state that
> must live above both panes), Phase 6 is split into two independently shippable,
> independently verified sub-phases:
>
> - **Phase 6a — Saved reskin** (rail + detail).
> - **Phase 6b — Mock reskin** (server bar topBar + clients/broadcast left + rules/tester/log right).
>
> Each sub-phase keeps the build green on its own. The shared shell change (split for
> mock/saved + `topBar` slot) lands with 6a and is reused by 6b.

#### Shared shell change (lands in 6a, reused by 6b)

`WebSocketStudioShell` today only renders the divider + right pane for `mode === 'client'`
(all other modes get `.ws-studio-split-single`, a single full-width pane). Phase 6 makes
the split available to any mode that supplies a right pane, and adds a full-width slot
above the split for the mock server bar:

- Add `topBar?: ReactNode` prop. When present, render it full-width **above**
  `.ws-studio-split` inside a `.ws-studio-topbar` wrapper. `client`/`saved` pass nothing.
- Replace the split condition `mode === 'client'` with `const isSplit = mode === 'client' || rightPane != null;`
  Render the `.ws-studio-divider` + `.ws-studio-right` whenever `isSplit`.
- Apply the `leftWidth` inline width + enable divider drag whenever `isSplit` (not just
  client). Keep `MIN_LEFT_PX` / `MIN_RIGHT_PX` clamps.
- `.ws-studio-split-single` class only when `!isSplit`.
- **Tab strips stay client-only.** The left-tab bar and right-tab bar (`left-tab-*` /
  `right-tab-*`) render only for `mode === 'client'`. Mock/saved panes carry their own
  internal headers/tabs (rail header, mock pane tabs) — no shell tab strip.
- Default `leftWidth` stays 560 (resizable). Mock/saved both look correct at that width and
  the user can drag.
- The existing right-pane placeholder ("part of the redesigned layout") is unaffected:
  mock/saved always pass a concrete `rightPane`, so the placeholder only ever shows for
  client mode without a pane.

New shell prop surface: `topBar?: ReactNode` (additive; all existing tests stay valid).

#### Phase 6a — Saved reskin (rail + detail) ✅

Target = `mockups/ws-saved.html`: a left **rail** (`Saved Profiles · N` header with
import / export icon buttons + `+ New` primary button; search filter; compact list of
`name` + `url` items) and a right **detail** pane (selected profile card with name +
protocol tag + `Load & Connect`; URL sub; action toolbar Edit / Duplicate / Export /
Delete; a summary metrics grid — Subprotocols / Headers / Query params / Auto-reconnect /
Protocol mode / Max messages; Notes). The profile **editor modal** is unchanged.

Refactor (state lifting):

- Extract `ProfileEditorModal` (already a private sub-component) into a named export within
  the file (or keep private but reachable) — no behavior change.
- New `useWebSocketSavedUi(props): SavedUi` hook holding all UI state currently inside
  `WebSocketSavedConnections`: `search`, `selectedId`, editor open/editing-profile, import
  UI state, confirm-delete id. It derives `filteredProfiles` and `selectedProfile`, and
  exposes every handler (`handleLoad`, `handleEdit`, `handleDuplicate`, `requestDelete`,
  `confirmDelete`, `cancelDelete`, `handleSave`, `handleImport`, `handleExport`, `setSearch`,
  `select`). All CRUD wiring (`onSaveProfile`, `onUpdateProfile`, `onDeleteProfile`,
  `onDuplicateProfile`, `onImportProfiles`, `onExportProfiles`, `onLoadProfile`,
  `onApplyDraft`, `onSwitchToConnect`, `prefillDraft`) preserved verbatim.
- New presentational `WebSocketSavedRail` (left): rail header (`+ New` → `new-profile-btn`,
  import → existing import affordance, export → `export-btn`), `saved-search` input, and the
  compact list (`saved-list`; items `profile-card-${id}` carrying name + url; clicking an
  item calls `select(id)` and highlights `.selected`). Loading (`saved-loading`) / empty
  (`saved-empty`) / no-match states live here.
- New presentational `WebSocketSavedDetail` (right): when a profile is selected, the detail
  card with `Load & Connect` (`load-btn-${id}`), action toolbar `edit-btn-${id}` /
  `dup-btn-${id}` / per-profile export / `delete-btn-${id}` (+ inline `confirm-delete-${id}`),
  the summary metrics grid, and notes. When nothing is selected (or after delete), an
  empty-detail placeholder. **Testids preserved** so existing assertions keep working — but
  the action buttons now live in the detail pane, so action tests must select the rail item
  first (`select`) before the buttons exist. Auto-select the first profile when the list is
  non-empty and nothing is selected, so the detail is populated by default and most existing
  tests need only minimal changes.
- `WebSocketSavedConnections(props)` becomes a thin wrapper used by the **legacy flat path**
  and by existing tests: `const ui = useWebSocketSavedUi(props)` then render
  `<div className="ws-saved-flat"><WebSocketSavedRail ui={ui}/><WebSocketSavedDetail ui={ui}/><ProfileEditorModal …/></div>`
  (single container, both panes stacked/flat). This keeps the component importable and the
  test surface intact.
- `WsConnectionTabContent` (shell mode, `controlledMode === 'saved'`): call
  `useWebSocketSavedUi(savedProps)` once, then pass `children = <WebSocketSavedRail ui={ui}/>`
  (left), `rightPane = <WebSocketSavedDetail ui={ui}/>`, and render `<ProfileEditorModal …/>`
  once. No `topBar`.

CSS (`websocket-studio.css`): add `.ws-studio-topbar`; saved rail classes
(`.ws-saved-rail`, `.ws-saved-rail-head`, `.ws-saved-rail-search`, `.ws-saved-rail-list`,
`.ws-saved-rail-item`(.selected) with `.ri-title`/`.ri-sub`); saved detail classes
(`.ws-saved-detail`, detail card, `.ws-saved-detail-toolbar`, `.ws-saved-summary-grid`,
`.ws-saved-notes`, empty-detail). `.ws-saved-flat` stacks rail+detail for the legacy/test
path. Responsive: stack under a min width.

Tests: update `WebSocketSavedConnections.test.tsx` — flat wrapper still renders rail+detail,
so loading/empty/list/search/header-tag/error/export-disabled tests pass unchanged (auto
first-select makes detail populated). Action tests (`load`/`edit`/`dup`/`delete`/
`confirm-delete`) target the auto-selected first profile or add a `select` click. Add a
small `useWebSocketSavedUi` / split-render test if useful. Add a `WsConnectionTabContent`
shell-mode saved test (rail in left body, detail in right pane).

**Success (6a):** profile CRUD + import/export + load-into-draft parity; faithful rail +
detail layout in shell-v2 saved mode using the shell divider; legacy flat path intact;
tsc/tests/eslint green; visual check passes.

**Implementation Notes / Retrospective (6a) — ✅ done:**

- **Shared shell change** landed as planned: `WebSocketStudioShell` gained `topBar?: ReactNode`
  (rendered full-width in `.ws-studio-topbar` above `.ws-studio-split` only when non-null), and
  `const isSplit = mode === 'client' || rightPane != null;` now drives the divider, right pane,
  left-pane width, and divider drag. `.ws-studio-split-single` applies only when `!isSplit`.
  Left/right tab strips (`left-tab-*` / `right-tab-*`) remain `mode === 'client'`-only.
- **State lifting**: added exported `interface SavedUi` + `useWebSocketSavedUi(props): SavedUi`
  holding all previously-internal state plus a new `selectedProfileId` and an **auto-select-first**
  `useEffect` (selects `filtered[0].id` when selection is null/invalid; clears when the filtered
  list is empty). Module-level `headerCount`/`paramCount` helpers were hoisted out of the component.
  The hook carries an inline `// eslint-disable-next-line react-refresh/only-export-components`
  (repo convention — co-locating a hook with components trips that rule).
- **Presentational split**: `WebSocketSavedRail({ ui })` (header `Saved Profiles · N`,
  import/paste/export icon buttons, `+ New Profile`, search, list of `.ws-saved-rail-item`
  → `profile-card-${id}` with `.ri-title`/`.ri-sub`, count) and `WebSocketSavedDetail({ ui })`
  (private `SavedDetailCard`: name + protocol tag, `load-btn-${id}`, toolbar
  `edit-btn`/`dup-btn`/Export/`delete-btn` (+inline `confirm-delete-${id}`), 6-cell
  `.ws-saved-summary-grid`, env-var/mTLS tags, notes, updated timestamp; empty-detail otherwise;
  hosts `ProfileEditorModal`). **All testids preserved.**
- **Thin wrapper**: `WebSocketSavedConnections(props)` = `useWebSocketSavedUi` →
  `<div className="ws-saved-flat"><WebSocketSavedRail/><WebSocketSavedDetail/></div>`, keeping the
  legacy flat path + existing tests importable.
- **Wiring**: `WsConnectionTabContent` calls `useWebSocketSavedUi(savedProps)` once at top level;
  shell saved mode passes `<WebSocketSavedRail>` as `children` and `<WebSocketSavedDetail>` as
  `rightPane` (no `topBar`); legacy path still renders `<WebSocketSavedConnections>`.
- **Test fixes**: 3 Saved assertions switched from `getByText` to `getAllByText(...).length`
  / testid queries (name now appears in both rail item + auto-selected detail); the
  `WsConnectionTabContent` saved-mode test was renamed to assert the divider + `saved-connections`
  + `saved-detail`; 4 new `WebSocketStudioShell` tests cover the topBar slot + split-for-non-client.
- **Verification**: `tsc -b --noEmit` clean; eslint clean on touched files; Saved 59 / Shell 12 /
  TabContent 90 tests pass. Visual check in shell-v2 saved mode confirmed faithful rail+detail+divider
  layout (created/auto-selected/deleted an `Echo Server` profile; summary grid + Load & Connect +
  toolbar all render correctly). Flag reset to `false` and test profile removed afterward.

**Profile-editor UX polish (post-6a):** the `New Profile` / `Edit Profile` modal looked
unfinished — `.ws-editor-overlay` had `background: transparent` (no scrim, so the right-pane
content bled through), and because the modal was rendered *inside* the detail pane it was offset
to the right instead of centered. **Resolved by migrating to our modal standard** — the editor
now renders through the shared `AppModalFrame` (default export) via `createPortal(…, document.body)`,
exactly like `PopulateFromApiModal` / the insomnia-style dialogs: `AppModalFrame` owns the
`modal-overlay` + `modal` chrome, the header (h3 title + standard `ram-modal-close` `×`), the body,
and the footer; we pass `overlayClassName="ws-editor-overlay"`, `dialogClassName="ws-editor-modal"`,
`headerClassName="ws-editor-header modal-header"`, `bodyClassName="ws-editor-body"`,
`footerClassName="ws-editor-footer"`, `showExpandButton={false}`, `showResizeHandles={false}`, and a
`footer` with the existing `profile-cancel-btn` / `profile-save-btn` buttons. The form body is
wrapped in `.ws-editor-form` (carries the `profile-editor-modal` testid + `onKeyDown` for Esc-cancel
/ Enter-save). CSS now only *overrides* the shared base: `.ws-editor-overlay.modal-overlay`
(fixed `inset:0`, centered, transparent + `backdrop-filter: blur(1px)`, matching
`.populate-api-overlay`/`.insomnia-modal-overlay`) and `.ws-editor-modal.modal` (520px card,
`padding:0`, flex column, surface bg, border/radius/shadow). The auto-reconnect row was also rebuilt
— the native checkbox used to be vertically centered against the two-line label and "floated"; it's
now a top-aligned `.ws-editor-toggle` (checkbox + stacked title/sub) with the 3 reconnect fields
wrapped in a bordered `.ws-editor-group` card so they read as one unit. The earlier hand-rolled
overlay/scrim/`ws-editor-close` button were removed (they didn't follow the modal standard). The
close test now targets the standard `getByRole('button', { name: 'Close' })`. `tsc -b` clean, eslint
clean, Saved 60 tests pass (added a Close-button test); visually verified in shell-v2 (centered
standard modal, × close, checkbox alignment, toggle enabling the grouped fields). Flag reset to
`false` afterward.


#### Phase 6b — Mock reskin (server bar + clients/broadcast + rules/tester/log) ✅

Target = `mockups/ws-mock.html`: a full-width **server bar** (`topBar`: `WS` proto badge +
readonly URL + port input + Start/Stop) and a full-width **status strip** (Running pill,
Clients count, Rules N active, Fallback select, Uptime) — both above the split; a left pane
(`Connected Clients` + broadcast composer) and a right pane (`Rules` / `Server Log` internal
tabs: rule toolbar + rule cards + inline editors + Rule Tester + Activity Log).

Refactor: the `useWebSocketMockServer` hook already lives in `WsConnectionTabContent`. Lift
the local UI state currently in `WebSocketMockServer` (`editingRuleId`, `broadcastText`,
`testInput`, `portInput`, plus a new right-pane `Rules | Server Log` tab) into a
`useMockServerUi(mock): MockUi` hook with all existing handlers (`handlePortChange`,
`handleFallbackChange`, `handleStart`/`handleStop`, `handleBroadcast`, `updateRules`,
`handleAddRule`, `handleDeleteRule`, `handleToggleRule`, `handleUpdateRule`, `handleMoveRule`,
`testResult`). Then three presentational sub-components fed `ui`:
`WebSocketMockServerBar` (topBar: proto/url/port/start-stop + status strip),
`WebSocketMockClientsPane` (left: clients list + broadcast composer),
`WebSocketMockRulesPane` (right: Rules/Server-Log tabs, rule cards + editors + tester + log).
**All existing testids preserved** (`mock-start-btn`, `mock-port-input`, `mock-fallback-select`,
`mock-broadcast-input/btn`, `mock-add-rule`, `rule-*`, `mock-test-*`, `mock-log`, etc.) so the
mock test suite stays green; `mock-server-panel` stays on the right pane root.
`WebSocketMockServer(props)` becomes a thin wrapper for the legacy/test path rendering all
three stacked. `WsConnectionTabContent` (mock mode) passes `topBar`, `children` (clients
pane), `rightPane` (rules pane).

CSS: mock split classes (left clients/broadcast; right rules/log with internal tabs) +
status strip within `.ws-studio-topbar`. Responsive stacking.

**Success (6b):** rule engine + broadcast + client management + log parity; faithful server
bar / status strip / clients / rules / tester layout in shell-v2 mock mode using the shell
divider; legacy flat path intact; tsc/tests/eslint green; visual check passes.

**Implementation Notes / Retrospective (6b) — ✅ done:**

- **State lifting**: added exported `interface MockUi` + `useMockServerUi(mock): MockUi`
  (carries `mock`, the destructured `status`/`logs`/`rules`/`config`/`starting`,
  `editingRuleId`, `broadcastText`, `testInput`, `portInput`, `portValid`, a new right-pane
  `rightTab: 'rules' | 'log'`, derived `enabledRuleCount`/`reversedLogs`/`testResult`, the
  `startedAt` uptime anchor, and every handler — `handlePortChange`, `handleFallbackChange`,
  `handleStart`/`handleStop`/`handleBroadcast`, `handleAddRule`/`handleDeleteRule`/
  `handleToggleRule`/`handleUpdateRule`/`handleMoveRule`). The hook carries the inline
  `// eslint-disable-next-line react-refresh/only-export-components` (same repo convention as 6a).
- **Async handler shape**: `handleStart`/`handleStop`/`handleBroadcast` wrap their awaited work in
  `void (async () => { … })()` so they satisfy the `() => void` `MockUi` signature (the underlying
  `mock.start/stop/broadcast` stay async).
- **Client-side uptime**: `WsMockStatus` carries no `startedAt`, so the hook stamps `startedAt` when
  `status.running` flips true (cleared when false). **The per-second ticker was deliberately pulled
  out of the hook into a tiny `<MockUptime startedAt={…}/>` leaf** that owns its own `now` interval —
  so only the uptime text re-renders each second instead of the whole mock pane (the original
  hook-level `setNow` ticker forced a full clients+rules+log re-render every tick). `MockUi` now
  exposes `startedAt: number | null`; the server bar renders `<MockUptime>` only while running.
- **Presentational split** (all fed `ui`): exported `WebSocketMockServerBar` (topBar:
  `.ws-mock-serverbar` with `WS` badge + readonly `ws://localhost:{port}` + `mock-port-input` +
  `mock-start-btn`/`mock-stop-btn`, then `.ws-mock-statusstrip` with the running/stopped pill
  +`mock-status-label`, `mock-client-count`, `Rules N active`, `Fallback`+`mock-fallback-select`,
  spacer, `Uptime`); exported `WebSocketMockClientsPane` (left: `Connected Clients` tab + badge,
  empty states, `mock-clients` list, broadcast composer `mock-broadcast-input`/`mock-broadcast-btn`
  while running); exported `WebSocketMockRulesPane` (right, root `data-testid="mock-server-panel"`).
  Private `MockRuleCard`/`MockRuleList`/`MockRuleTester`/`MockActivityLog` hold the rule cards +
  inline editors + tester + log. **All existing testids preserved.**
- **`showTabs` prop**: `WebSocketMockRulesPane({ ui, showTabs = true })`. The thin-wrapper / legacy
  / test path renders it with `showTabs={false}` → list + tester + log **stacked** (so every testid
  is reachable without a tab click, keeping the ~40-test suite green); the shell passes the default
  `true` → `Rules | Server Log` internal tabs (`mock-tab-rules`/`mock-tab-log`), rules tab =
  list+tester, log tab = activity log.
- **Thin wrapper**: `WebSocketMockServer({ mock })` = `useMockServerUi` →
  `<div className="ws-mock-flat"><WebSocketMockServerBar/><div className="ws-mock-flat-body">
  <WebSocketMockClientsPane/><WebSocketMockRulesPane showTabs={false}/></div></div>`.
- **Wiring**: `WsConnectionTabContent` calls `useMockServerUi(mockServer)` once at top level;
  shell mock mode passes `topBar={<WebSocketMockServerBar>}`, `children={<WebSocketMockClientsPane>}`,
  `rightPane={<WebSocketMockRulesPane>}`; the legacy path still renders `<WebSocketMockServer>`.
- **CSS**: added a "Mock shell layout (Phase 6b)" block (`.ws-mock-flat`/`-flat-body`,
  `.ws-mock-serverbar`(+`-wrap`/`-proto`/`-url`), `.ws-mock-statusstrip`/`-statuspill`(.running)/
  `-strip-stat`/`-strip-fallback`/`-strip-spacer`, `.ws-mock-clients-pane`/`-rules-pane`,
  `.ws-mock-pane-tabs`/`-pane-tab`(.active)/`-pane-badge`, `.ws-mock-clients-body`/`-clients-empty`,
  responsive stacking at `max-width:640px`). Legacy `.ws-mock-container`/`-header`/`-config` rules
  remain (now unused by the shell, harmless).
- **Bug fixes found during re-eval (fix-all-similar)**: JSX **attribute** strings don't process JS
  escapes, so literal `\u2026`/`\u2013` were rendering verbatim. Fixed the broadcast + Rule-Tester
  placeholders and the `mock-port-input` `title` here, and the same pattern in the unrelated
  `TrashPanel` search placeholder. (Expression-form `\u2026`, e.g. the `Starting…` button label,
  was already correct.)
- **Test update**: the `WsConnectionTabContent` mock-mode test was renamed to assert the divider +
  `ws-studio-topbar` + `mock-server-panel` (was asserting *no* divider).
- **Verification**: `tsc -b --noEmit` clean; eslint clean on touched files; Mock 60 / TabContent 90 /
  TrashPanel 30 tests pass (180 total across the affected suites). Full visual check in shell-v2 mock
  mode: stopped layout (server bar + status strip + divider + empty clients + Rules/Server-Log tabs +
  tester), running state (running pill, port disabled, `Uptime` ticking, broadcast composer, Send
  disabled at 0 clients), Server-Log tab (color-coded `server-start`/`server-stop` entries + Clear),
  and a configured rule (Exact `ping` → Static `pong`) with the Rule Tester showing
  `Matched rule: Rule 1 → static` and the fallback path `No rule matched → fallback: echo`. The
  leaf-ticker refactor was confirmed — uptime ticks while editing the rule/tester without disruption.
  Mock server stopped and the `redfire-ws-studio-shell-v2` flag reset to `false` afterward.

**Re-evaluation pass (post-6a/6b):** read every Phase 6 file end-to-end again
(`WebSocketSavedConnections.tsx` — rail + detail + `SavedDetailCard` + thin wrapper + hook,
`WebSocketMockServer.tsx`, `WebSocketStudioShell.tsx` topBar/`isSplit`/divider-drag, and the
`WsConnectionTabContent` shell+legacy wiring). No code, type, lint, or test regressions found:
`tsc -b --noEmit` clean, eslint clean on touched files, and the four Phase 6 suites pass
(Mock 60 / Saved 59 / Shell 12 / TabContent 90 = 221). Detail-toolbar "Export" intentionally
calls the all-profiles `onExportProfiles()` (no per-id export API exists; mockup is ambiguous).
The lone `act()` warning in the TabContent save-as-profile test is benign React test noise from
the prefill-consumed effect cascade, not a product bug. **Doc fix:** two headings (Phase 4 and
Phase 6) had a corrupt `U+FFFD` byte instead of the ✅ status emoji — both restored.

### Phase 7 — SSE split-pane reskin ✅
Mirror WS **Client mode** for SSE: a flag-gated split-pane shell with the connection config on the
**left** and the Events stream + detail on the **right**, replacing today's stacked
`sse-connect-panel` → `SseMessageLog` layout. Auth and Console are explicitly **out of scope** here
(Auth = Phase 8, Console = Phase 9); §2.6 still holds ("No Auth, no Console") until those phases.
SSE has a single connection (no multi-tab bar, no Mock/Saved modes), so the SSE shell is a
**simplified** mirror of the WS shell: no mode switch, no left/right *tab strips* yet (each pane has
a single view → a plain pane-title header). The left/right tab strips arrive when Phase 8 adds the
left `Auth` tab and Phase 9 adds the right `Console` tab.

**Feature flag (independent rollout):** add a dedicated `redfire-sse-studio-shell-v2` flag
(`src/features/sse/sseStudioShellFlag.ts`, mirroring `wsStudioShellFlag.ts` — single string key over
`readKey`/`writeKey`, default `false`) plus a second Labs toggle ("SSE Studio — new split-pane
shell"). A separate flag lets SSE be QA'd without forcing the WS shell on, and keeps the WS flag's
scope honest ("Applies to the WebSocket Studio page").

**Components:**
- `SseStudioShell.tsx` ⭐ — presentational split-pane shell. Props: `topBar` (full-width URL bar),
  `statusStrip` (full-width, below the top bar), `left` + `leftTitle` (config pane), `right` +
  `rightTitle` (events pane). Owns the resizable divider (mirrors the WS shell's
  `mousemove`/`mouseup` drag with `MIN_LEFT_PX`/`MIN_RIGHT_PX` clamping and a `leftWidth` state).
  Renders `.sse-studio-shell` → `.sse-studio-topbar` → `.sse-studio-status-strip?` →
  `.sse-studio-split` ( `.sse-studio-left` [`.sse-studio-pane-title` + `.sse-studio-left-body`] ·
  `.sse-studio-divider` · `.sse-studio-right` [`.sse-studio-pane-title` + `.sse-studio-right-body`] ).
- `SseStudioPage.tsx` ♻️ — loads the flag once at mount (`loadSseShellV2Enabled().then(setShellV2)`,
  cancel-guarded). When **on**, renders `SseStudioShell`:
  - `topBar`: state dot + URL input + Connect/Disconnect (the legacy `sse-headers-toggle` is dropped —
    headers live in the left pane now).
  - `statusStrip`: state label + auto-reconnect badge + event count + Last-Event-ID + retry info.
  - `left`: the **always-visible** config body (headers key/value editor + add-header + auto-reconnect
    checkbox + maxRetries/retry info) — the same JSX the legacy headers-panel uses, extracted into a
    shared `configBody` const so there is no duplication.
  - `right`: the existing `SseMessageLog` (unchanged — keeps its own toolbar, virtualized list,
    `SseEventDetail`, and status bar).
  When **off**, renders the existing legacy layout **unchanged** (all current testids preserved →
  existing `SseStudioPage` tests keep passing without mocking the flag, since default is `false`).

**CSS:** add the `.sse-studio-*` shell classes to [sse-studio.css](../../../src/styles/sse-studio.css)
mirroring the WS `.ws-studio-*` split-pane values (flex column shell; `.sse-studio-split` flex row,
`flex:1`, `min-height:0`, `overflow:hidden`; `.sse-studio-left` fixed `width` via inline style,
`flex-shrink:0`; `.sse-studio-divider` 5px `col-resize` with accent hover; `.sse-studio-right`
`flex:1`; pane bodies `min-height:0; overflow:hidden`). The `.sse-studio` theme-alias shim already
provides `--accent-color`/`--border-color`/etc., so the shell inherits SSE theming.

**Success criteria:**
- [x] SSE parity — every legacy capability (URL connect/disconnect, headers CRUD, auto-reconnect +
  maxRetries, search/type-filter/bookmark/export/clear, event detail, Last-Event-ID, uptime) is
  reachable in the shell layout; nothing removed.
- [x] Flag off → byte-for-byte the legacy layout; flag on → split-pane shell.
- [x] Resizable divider clamps to min widths and persists during the session.
- [x] `tsc -b --noEmit` clean; eslint clean on touched files; new `SseStudioShell`,
  `sseStudioShellFlag`, updated `SseStudioPage`, and `SettingsLabsTab` test suites pass.
- [x] Visually verified in shell-v2 (left config, right events, divider drag, connect flow); flag
  reset to `false` afterward.

**Retrospective (2026-06-11):** Implemented as specced with a few refinements:
- **Independent flag** `redfire-sse-studio-shell-v2` (`src/features/sse/sseStudioShellFlag.ts`,
  mirroring `wsStudioShellFlag.ts`) + a second Labs toggle (`data-testid="sse-shell-v2-toggle"`).
  Both Labs checkboxes now use testids (`ws-shell-v2-toggle` / `sse-shell-v2-toggle`) because two
  checkboxes made `getByRole('checkbox')` ambiguous.
- **Simplified mirror:** `SseStudioShell` carries no mode switch and no per-pane tab strips (single
  config/events view) — tab strips arrive with Auth (Phase 8) and Console (Phase 9).
- **Shared JSX extraction:** `SseStudioPage` extracts `urlControls`, `configBody`, and `messageLog`
  consts reused by both the flag-off legacy layout and the flag-on shell, so there is zero
  duplication and all legacy testids are preserved (legacy `SseStudioPage` tests pass unchanged).
- **Status strip** is richer than the legacy state label (always-on auto-reconnect badge + event
  count + conditional Last-Event-ID) since the split-pane has horizontal room.
- **act() warnings:** the async flag-load `useEffect` produces benign React `act()` warnings on the
  synchronous legacy tests (same as the WS page); the cancel-guard prevents real post-unmount
  updates, so these are accepted (consistent with the established WS pattern). A short-lived
  `afterEach` flush attempt was reverted (it didn't help and broke imports).
- **Verification:** `tsc -b --noEmit` clean, eslint clean on touched files, **77/77** touched tests
  pass (`SseStudioShell`, `SseStudioPage`, `sseStudioShellFlag`, `SettingsLabsTab`). Browser-verified
  the split-pane (left Connection config / right Events), Connect-enable on URL entry, and divider
  drag (left pane `360px → 480px`); flag reset to `false` afterward.

### Phase 8 — ⭐ Auth ✅

> **Goal:** add a first-class **Auth** tab/section to both the WebSocket and SSE studios that reuses the
> existing shared `AuthConfig` / `GlobalAuthProfile` system (the same one Requests, Catalog, and Scenarios
> use). Auth is resolved at **connect time** into request headers and/or query parameters, persisted with
> the connection draft/profile/config, and surfaces transport-specific browser-mode limitations.

#### 8.0 Key transport facts (drive the whole design)

> **Resolved design decisions (this session, with user sign-off):**
> 1. **WS browser-mode = proxy auto-route + honest info callout (NOT a hard block).** The studio already
>    auto-routes custom headers / TLS overrides through the proxy sidecar (`/api/ws/connect`) in browser mode,
>    not just Tauri. Auth headers are just headers, so they ride the same path — consistent with today's
>    behavior, technically correct (the proxy *can* send them), and lowest-maintenance/future-proof (a future
>    proxy health-probe slots in at the transport layer for all proxy traffic). The Auth panel shows an
>    **info** callout for header-based types explaining the auto-route + offering apikey-query as the
>    direct-browser option. apikey-query stays on the direct transport. The transport badge (Proxy/Native/Direct)
>    already shows which path is live. (This supersedes the earlier "block connect" idea.)
> 2. **SSE = a real tab strip** (Connect / Auth) on `SseStudioShell`, mirroring the WS Auth tab, instead of a
>    stacked config section — closest to the mockup's "Auth is its own tab" intent.
> 3. **Always persist auth** with the connection (add storage if drafts/config aren't persisted today).

- **WebSocket** browser transport (`connectDirect`, raw `new WebSocket()`) **cannot set request headers**.
  Header-based auth (`basic` / `bearer` / `digest` / `oauth2`, and `apikey` with `apiKeyIn: 'header'`)
  therefore **requires the proxy / Tauri transport** (`connectProxy`, which forwards a `headers` map to the
  Node/Tauri side). `apikey` with `apiKeyIn: 'query'` is appended to the URL and works in **browser direct**
  mode. → `connect()` must treat "resolved auth produced headers" as a reason to force `connectProxy`
  (same gate as `hasCustomHeaders`).
- **SSE** transport (`useSseConnection.doConnect`) uses `fetch()` with a streaming body — it **can set custom
  headers in the browser**. So **all** SSE auth types (including header-based) work in browser mode; only the
  `apikey`-query case appends to the URL. → **No browser-mode limitation callout for SSE** (this differs from WS).
- **OAuth2** (`type: 'oauth2'`, client-credentials): the token is fetched at connect time via
  `acquireOAuth2Token(auth)` (already used by `useAuthVerify`), then sent as `Authorization: Bearer <token>`.
  In browser WS this requires the proxy; in SSE the `fetch` works directly. Token acquisition is async, so
  `resolveWsAuth` / `resolveSseAuth` are **async**.
- **`{{var}}` interpolation** must apply to every auth field (token, key, username, password, tokenUrl,
  clientId, clientSecret) via the existing `resolveEnvVars(value, envVarMap)` — same as headers/params today.

#### 8.1 Reuse, don't reinvent (component strategy)

- **Reuse the existing presentational `AuthConfigPanel`** (default export at
  `src/features/requests/components/AuthConfigPanel.tsx`) **in place** — it is already fully presentational
  (props-only, no feature coupling) and renders the Type dropdown + every per-type form + inherit profile
  selector + Verify Auth button matching the mockup. **Do not extract/move it** to `src/shared/components`
  in this phase (it is imported by Requests/Scenarios via relative paths; moving risks churn for zero gain).
  The plan's earlier "♻️ extract shared if needed" is resolved to **reuse-in-place**.
- **Reuse `useAuthVerify()`** (`src/features/requests/hooks/useAuthVerify.ts`) for the Verify Auth button
  state + OAuth2 token fetch — it is feature-agnostic (already reused by Catalog/Scenarios/Settings).
- **New thin wrappers** bake the boilerplate (the `useAuthVerify` wiring, `showSecret` state, the
  **resolved-at-connect masked preview**, and the **browser-mode callout**) around `AuthConfigPanel`:
  - `WebSocketAuthPanel.tsx` — wraps `AuthConfigPanel`, adds the resolved-as preview + WS browser-mode callout.
  - `SseAuthPanel.tsx` — wraps `AuthConfigPanel`, adds the resolved-as preview, **no** browser-mode callout.
  - Both compute the masked preview from a shared pure helper (see 8.3) so the preview always matches the wire.

#### 8.2 Types (additive)

- `src/shared/websocket/types.ts`:
  - `WsConnectionDraft` ➕ `auth?: AuthConfig` (optional; absent ⇒ `{ type: 'none' }`). `createDefaultDraft()`
    leaves it `undefined` (no behavior change for existing drafts). `profileToDraft` / `draftToProfileFields`
    copy `auth` through (deep-clone like headers).
  - `WsConnectionProfile` ➕ `auth?: AuthConfig` (persisted with the profile).
- `src/features/sse/sseTypes.ts`:
  - `SseConnectionConfig` ➕ `auth?: AuthConfig`. `createDefaultSseConfig()` leaves it `undefined`.
- No changes to `AuthConfig` / `AuthType` / `GlobalAuthProfile` — used as-is from `src/shared/types`.

#### 8.3 Connect-time resolution (`wsAuthResolve.ts`, shared by WS **and** SSE)

> One module, two protocols. Lives at `src/features/websocket/wsAuthResolve.ts` (WS owns the auth utility; SSE
> already imports `resolveEnvVars` from `../websocket/wsMessageUtils`, so importing the resolver from
> `../websocket/wsAuthResolve` is consistent and avoids a redundant copy).

```ts
export interface ResolvedAuth {
  headers: { key: string; value: string }[];   // ready to merge into the headers map
  queryParams: { key: string; value: string }[]; // ready to append to the URL
}

/** Resolve an AuthConfig (following `inherit` → GlobalAuthProfile) into headers + query params.
 *  - Interpolates {{vars}} in every field via resolveEnvVars(value, envVarMap).
 *  - apikey: header → headers[]; query → queryParams[].
 *  - basic/digest/bearer → Authorization header (reuses resolveAuthHeaders).
 *  - oauth2 → await acquireOAuth2Token(resolvedAuth) then Bearer header.
 *  - inherit → look up profile by auth.globalProfileId in `profiles`, resolve THAT.
 *  Async because OAuth2 fetches a token. Returns empty arrays for type 'none'/missing config. */
export async function resolveAuthForConnect(
  auth: AuthConfig | undefined,
  profiles: GlobalAuthProfile[],
  envVarMap: Record<string, string>,
): Promise<ResolvedAuth>;

/** Pure, synchronous masked one-liner for the "Resolved at connect" preview (no token fetch).
 *  e.g. 'Authorization: Bearer ●●●●●●●● (masked)' / 'X-API-Key: ●●●●●●●● (header · masked)'. */
export function describeResolvedAuth(
  auth: AuthConfig | undefined,
  profiles: GlobalAuthProfile[],
): string | null;
```

- `resolveAuthForConnect` first interpolates env vars into a working copy, follows `inherit` to the bound
  `GlobalAuthProfile.auth` (via `auth.globalProfileId`), then maps by type. Header mapping **reuses
  `resolveAuthHeaders`** from `src/shared/utils/authHeaders.ts` (extended only if needed) so there is a single
  source of truth for auth→header. `apikey`-query is the one case `resolveAuthHeaders` does not cover →
  emitted into `queryParams`.
- `describeResolvedAuth` mirrors the mockup's `resolvedMap` (masked, never reveals secrets).

#### 8.4 Wiring — WebSocket

- `useWebSocketStudio`:
  - Accept `globalAuthProfiles` (from the page) and store in a ref (like `envVarMapRef`).
  - In `connect()`: compute `const resolved = await resolveAuthForConnect(draft.auth, profiles, evm)`.
    - Merge `resolved.queryParams` into the effective URL (alongside `draft.queryParams`).
    - Force `connectProxy` when `resolved.headers.length > 0` (browser cannot send them on direct). In
      `connectProxy`, merge `resolved.headers` into `headersMap` **before** dispatching `connect`.
    - Tauri already proxies, so headers flow through unchanged.
  - Because `connect()` becomes async-dependent, resolve auth first, then branch to the existing
    `connectDirect` / `connectProxy` (both stay sync internally; the resolved values are passed in / merged via
    refs to avoid reordering the existing flow).
- `WsConnectionTabContent`:
  - Add an **`'auth'` case** to the shell `leftBody` switch (currently falls through to `connectPanel`) →
    render `<WebSocketAuthPanel auth={studio.draft.auth ?? {type:'none'}} onChange={(a)=>studio.setDraft({auth:a})} globalAuthProfiles={…} envVarMap={envVarMap} isTauri={isTauri()} disabled={isConnected} />`.
  - Add the same `controlledLeftTab === 'auth'` branch to the **legacy (flat) connect view** for parity.
  - `WS_LEFT_TABS` already contains `'auth'` and the shell renders the tab button — only the body is missing.
  - The `WebSocketAuthPanel` shows an **info** callout for header-based types (browser-mode auto-route via
    proxy) — informative, never blocks connect.
- `WebSocketStudioPage` → pass `globalAuthProfiles` down to `WsConnectionTabContent` → `useWebSocketStudio`.

#### 8.5 Wiring — SSE

- `useSseConnection.doConnect`:
  - `const resolved = await resolveAuthForConnect(cfg.auth, profiles, map)` (accept `globalAuthProfiles` like
    `envVarMap`). Merge `resolved.headers` into the `headers` object; append `resolved.queryParams` to `url`
    (build query string the same way WS does). All header types work here (fetch transport).
- `SseStudioPage`:
  - **Add a real tab strip to `SseStudioShell`** (Connect / Auth) mirroring the WS Auth tab. The left pane
    body switches on the active SSE left tab: `connect` → the existing `configBody` (Headers + Reconnect);
    `auth` → `<SseAuthPanel … />`. The shell gains a minimal `leftTab` / `onLeftTabChange` prop pair + a
    `SSE_LEFT_TABS = ['connect','auth']` tuple (parallels `WS_LEFT_TABS`). Legacy (flag-off) layout adds an
    `sse-auth-toggle` button + `sse-auth-panel` for parity (mirrors the existing Headers/Reconnect toggles).
  - Pass `globalAuthProfiles` into `useSseConnection`.

#### 8.6 Threading `globalAuthProfiles` to the studios

- `App.tsx` already holds `appGlobalAuthProfiles`. Pass it to both pages:
  `<WebSocketStudioPage … globalAuthProfiles={appGlobalAuthProfiles} />` and
  `<SseStudioPage … globalAuthProfiles={appGlobalAuthProfiles} />`. Both page props become
  `globalAuthProfiles?: GlobalAuthProfile[]` (default `[]`).

#### 8.7 Persistence

- **Persist the WHOLE draft/config** for both protocols (user decision) — auth is not half-persisted.
  - **WS per-tab draft:** today only `url` + tab layout persist (`WsPersistedTab`). Extend `WsPersistedTab`
    with the full draft (`subprotocols`, `headers`, `queryParams`, `auth?`) so the active draft survives
    reload. `loadWsTabState` normalizes/validates the new fields (defaults: `[]` / `''` / `undefined`),
    back-compat with old persisted tabs. `WebSocketStudioPage.buildPersistState()` writes them; the studio
    seeds the draft from the persisted tab on mount. `WsConnectionProfile.auth?` continues to persist with
    Saved profiles (already in scope).
  - **SSE config:** today nothing persists. Add `src/features/sse/sseStorage.ts` (`loadSseConfig` /
    `saveSseConfig`, key `redfire-sse-config-v1`, using `readKey`/`writeKey`) persisting the full
    `SseConnectionConfig` (`url`, `headers`, `autoReconnect`, `maxRetries`, `auth?`). `SseStudioPage` loads it
    on mount (cancel-guarded effect, like the shell flag) and saves on `config` change (debounced/simple
    effect). Validate + default on load (back-compat / corrupt-safe like `websocketStorage`).
  - Reuse `readKey`/`writeKey` from `shared/utils/storage` (never raw `localStorage`). Secrets are stored
    as-is (same as Requests/headers today); `{{var}}` indirection is the recommended way to avoid persisting
    raw secrets. Both persistence additions get unit tests (round-trip + corrupt/missing → defaults).

#### 8.8 CSS

- Reuse the existing Requests auth panel classes (`scenario-auth-panel` / `.auth-type-select` / `.form-row two-col`
  / `.radio-group` / `.auth-verify-*`) via `AuthConfigPanel`'s `panelClassName`. Because the WS/SSE pages use the
  theme-alias shims (`.ws-studio-page` / `.sse-studio`), verify these classes resolve their colors there (they
  use canonical tokens already; add shim entries only if something renders gray).
- New small classes for the wrappers: `.ws-auth-resolved` / `.sse-auth-resolved` (the `→ code` masked line,
  mockup `.auth-resolved`), `.ws-auth-callout` (mockup `.auth-callout`, WS-only browser-mode warning). Map to
  canonical tokens (no `--accent-color` etc.).

#### 8.9 Tests

- `wsAuthResolve.test.ts` (⭐): every type → expected headers/queryParams; `inherit` follows the profile;
  `{{var}}` interpolation; `apikey` header vs query; `oauth2` awaits the token (mock `acquireOAuth2Token`);
  `none`/missing → empty; `describeResolvedAuth` masked strings per type.
- `WebSocketAuthPanel` / `SseAuthPanel`: render per type, onChange propagation, resolved-preview text, callout
  visible for header types on WS / absent on SSE.
- `useWebSocketStudio`: connect forces proxy when auth yields headers; apikey-query lands in the URL.
- `useSseConnection`: auth headers reach the `fetch` call; apikey-query in URL.
- `WsConnectionTabContent`: Auth left tab renders the panel (shell + legacy).
- `SseStudioPage`: Auth toggle/section renders the panel; persisted.

#### 8.10 Acceptance criteria

- [x] WS `Auth` left tab (shell + legacy) renders the shared auth panel; all 7 types selectable.
- [x] SSE `Authentication` section/toggle renders the shared auth panel.
- [x] `resolveAuthForConnect` resolves every type correctly (incl. `inherit` + OAuth2 token fetch + `{{var}}`).
- [x] WS header-based auth forces the proxy/Tauri transport; apikey-query works in browser direct.
- [x] SSE auth (all types) reaches the `fetch` request; apikey-query appends to the URL.
- [x] Resolved-at-connect masked preview matches the wire; WS browser-mode callout shown for header types only.
- [x] `auth` persists with the WS profile / SSE config (matching existing headers/params persistence).
- [x] `tsc -b --noEmit` clean; touched-file vitest + eslint clean; live-verified on WS + SSE.
- [x] Plan §8/§10/§11 + Phase Status dashboard updated; mockup matches shipped UI.

#### 8.11 Implementation Notes / Retrospective (2026-06-11)

> **Status:** ✅ Complete on `feature/websocket` (uncommitted). `tsc -b --noEmit` clean; touched-file
> vitest green (468 tests across 8 files: `useSseConnection`, `useWebSocketStudio`, `WebSocketStudioPage`,
> `WsConnectionTabContent`, `SseStudioPage`, `sseStorage`, `wsAuthResolve`, `websocketStorage`); eslint clean;
> live-verified in-browser on both WS (shell-v2) and SSE.

**Design decisions that differ from / refine the plan above:**

1. **`resolveEffectiveAuth` synchronous fast-path (NEW helper in `wsAuthResolve.ts`).** Making `connect()`
   fully `async` broke ~74 existing tests that call `act(() => connect())` and then synchronously assert on
   `mockInstances[…]` / `fetch` call counts. Fix: a pure synchronous `resolveEffectiveAuth(auth, profiles)`
   that returns the effective `AuthConfig` (following `inherit`) or `null`. Both `useWebSocketStudio.connect()`
   and `useSseConnection.doConnect()` only `await resolveAuthForConnect(...)` when `resolveEffectiveAuth(...)`
   is truthy; the no-auth path stays fully synchronous (legacy timing preserved). This keeps OAuth2's async
   token fetch while not regressing the synchronous transport tests.
2. **SSE re-entrancy guard ordering.** `updateState('connecting')` + abort-controller arming must run
   **before** the auth `await` in `doConnect`, otherwise a second synchronous `connect()` is not blocked by
   the `'connecting'` re-entrancy guard (the "prevents connect when already connecting" test asserts the
   fetch call count synchronously).
3. **Pull-model draft persistence (refines §8.7).** Rather than lifting the entire live draft into
   `WebSocketStudioPage` state on every keystroke, the page reads each tab's live draft on demand via an
   imperative handle: `WsConnectionTabContent` exposes `getDraft()` through `useImperativeHandle`, and the
   page's `buildPersistState()` pulls `{subprotocols, headers, queryParams, auth}` per tab via
   `readTabDraftFields(id)`. An `onDraftChange(tabId)` callback (debounced save) is fired from a
   JSON-snapshot diff effect inside the tab so edits trigger a persist without per-field prop plumbing. A
   mount-only seeding effect (guarded by an `initialUrlApplied` ref) restores the draft from `initialDraft`
   (seeded from `initialDraftsRef`), and the save-on-unmount effect captures live drafts (all tabs stay
   mounted via `display:none`). This avoids a large controlled-draft refactor and keeps the studio hook the
   single owner of draft state.
4. **Storage hardening shared between WS and SSE.** `websocketStorage.ts` and the new `sseStorage.ts` share
   the same sanitizers: `VALID_AUTH_TYPES` set, `sanitizeKeyValueEntries` (drops non-objects, defaults
   key/value `''`, `enabled` true) and `sanitizeAuthConfig` (returns `undefined` unless the payload is an
   object with a valid `type`). `loadSseConfig` also `clampInt`s `maxRetries` to 0–1000. `isValidPersistedTab`
   is unchanged (the new draft fields are optional ⇒ old persisted tabs still load — back-compat verified by
   the existing 52 `websocketStorage` tests).
5. **Browser-mode callout is WS-only and class-driven.** `.ws-auth-callout` (flex, blue-tint, 10/12 padding)
   renders only when `resolveEffectiveAuth` yields header-based auth **and** `!isTauri()`; apikey-query stays
   on the direct transport and shows no callout. SSE has no callout (the `fetch` transport sets headers in the
   browser). Live-verified: WS callout text + styling present; SSE absent.
6. **New files (update §10 File Map + §11):** `src/features/websocket/wsAuthResolve.ts` (+ `.test.ts`, 28
   tests), `src/features/websocket/WebSocketAuthPanel.tsx`, `src/features/sse/SseAuthPanel.tsx`,
   `src/features/sse/sseStorage.ts` (+ `.test.ts`, 7 tests). Edited: `websocketStorage.ts`,
   `WebSocketStudioPage.tsx`, `WsConnectionTabContent.tsx`, `useWebSocketStudio.ts`, `useSseConnection.ts`,
   `SseStudioPage.tsx`, `SseStudioShell.tsx`, `App.tsx`, types (`shared/websocket/types.ts`,
   `features/sse/sseTypes.ts`), CSS (`websocket-studio.css`, `sse-studio.css`).
7. **Live verification (2026-06-11).** SSE: Bearer token → masked `Authorization: Bearer my-s…3456`
   "Will send" line; `redfire-sse-config-v1` persisted `{url, headers, autoReconnect, maxRetries, auth}`;
   reload restored url + auth dot. WS (shell-v2): `left-tab-auth` renders the panel; Bearer → masked
   preview + browser-mode proxy callout (styled); `redfire-ws-tab-state-v1` persisted the full draft
   (`url`, `subprotocols`, `headers`, `queryParams`, `auth`, `leftTab`, `rightTab`); reload restored url +
   auth type + token + preview.

**Test-file updates required by this phase:**
- `WsConnectionTabContent.test.tsx`: hook spy assertion updated to `toHaveBeenCalledWith(envMap, [])` (the
  hook now receives `globalAuthProfiles`).
- `WebSocketStudioPage.test.tsx`: the stale "seeds shell mode from persisted studio-layout fields" divider
  assertion was replaced with a `data-mode` check (pre-existing failure from the uncommitted mock-redesign —
  mock mode now renders a two-pane split so the divider is present; confirmed not a Phase 8 regression).

**Re-evaluation bug-fix pass (2026-06-11, post-implementation):** A second exhaustive review of all Phase 8
code surfaced four issues, all fixed (touched-file vitest now 471 + 4 new = green; `tsc -b`/eslint clean):

1. **API-key (header) silently dropped.** Selecting "API Key" leaves `apiKeyIn` *undefined* while the panel's
   "Header" radio appears selected (`checked={apiKeyIn !== 'query'}`). `resolveAuthForConnect` delegated to the
   app-wide `resolveAuthHeaders`, which only emits an apikey header when `apiKeyIn === 'header'` — so a
   header-default key was dropped on the wire even though `describeResolvedAuth` previewed "(header)".
   Fix: `resolveAuthForConnect` now handles `type === 'apikey'` explicitly — `query` → query param, `header`
   **or unspecified** → header — matching the panel default, the masked preview, and the browser-callout
   logic (`+2 tests`). The app-wide `resolveAuthHeaders`/executor were left unchanged (out of scope).
2. **`btoa` crash on non-Latin1 credentials (render-path).** `describeResolvedAuth` (a pure, *synchronous*
   `useMemo` in both auth panels) called `btoa()` for basic/digest. `btoa` throws on chars outside Latin1
   (e.g. an accented username "José") → the panel render crashes (white screen). The connect path already
   catches this (async `try/catch` → error state), but the in-render preview did not. Fix: a `safeBtoaMask`
   wrapper returns a masked placeholder on failure (`+1 test`).
3. **SSE config not flushed on unmount (data loss parity).** The WS studio flushes its persist state on
   unmount; the SSE page only had a 300 ms debounced save, so an edit made within 300 ms of navigating away
   was lost. Fix: added an unmount-only effect that flushes the latest config via a `configRef` (mirrors the
   WS page). This required mocking `sseStorage` in `SseStudioPage.test.tsx` for isolation — the real
   `saveSseConfig` on unmount + the mocked `setConfig` re-applying the loaded config was polluting state
   across tests.
4. **`resolveEffectiveAuth` crash on a malformed persisted profile.** `loadGlobalAuthProfiles` does not
   sanitize (`JSON.parse` only), so a corrupt persisted profile missing `auth` would make
   `profile.auth.type` throw during render. Fix: added a `!profile.auth` guard to the inherit branch
   (`+1 test`).

### Phase 9 — ⭐ Console: structured log (B) + Raw toggle (A) ✅
- `WsConsoleEntry` model + `WsConsoleSettings` + view-agnostic `useWebSocketConsole` listener; handshake capture.
- Right `Console` tab with **structured** default view (severity + category filter, search, expandable rows) and a **Raw** toggle that re-renders the same entries as the Insomnia curl-verbose timeline; export/clear/auto-scroll.
- SSE console parity (both views).
- **Success criteria:**
  - [x] every lifecycle transition + handshake recorded
  - [x] both views render the same data
  - [x] filters (severity + category + search) work
  - [x] ring-buffer capped (default 1000)
  - [x] tested (217 tests across new + touched files green)

> **⚠️ Re-evaluation (2026-06-11) — plan corrections before implementation.** A code-level review of the
> live hooks surfaced two assumptions in §7 that are wrong, plus several design decisions worth recording.
>
> **A. There is NO event bus to "subscribe" to.** §7.3 says the hook subscribes to "events already emitted
> by `useWebSocketStudio`". In reality neither `useWebSocketStudio` nor `useSseConnection` emits events — they
> expose **React state only** (`connection: WsConnectionSnapshot` / `SseConnectionSnapshot`, `reconnectState`,
> `detectedProtocol`, `sentCount`/`receivedCount`, etc.). **Correction:** the console hook is an **observer**
> that records entries by diffing successive state values inside `useEffect`s (previous values held in refs to
> avoid duplicate entries). No changes to the transport hooks. The hook is still "view-agnostic" (both views
> read its `WsConsoleEntry[]`). This mirrors the Phase 8 precedent where `useSseConnection` reuses
> `wsAuthResolve` from the websocket feature — so the **shared console core lives in `src/features/websocket/`
> and SSE imports it.**
>
> **B. Raw handshake wire headers are not accessible — entries are reconstructed honestly.** The browser
> `WebSocket` API does not expose the real upgrade request/response headers (`Sec-WebSocket-Key` /
> `Sec-WebSocket-Accept` are generated/consumed inside the browser); the proxy sidecar returns only
> `{protocol, extensions, latencyMs}`. **Correction:** the handshake console entry is **reconstructed from the
> data we actually have** — request line + `Host`/`Upgrade`/`Connection`/`Sec-WebSocket-Version` + requested
> `Sec-WebSocket-Protocol` (from `draft.subprotocols`) + the **masked** resolved `Authorization`/api-key header
> (via `describeResolvedAuth`); response = `101 Switching Protocols` + negotiated `Sec-WebSocket-Protocol`
> (`connection.protocol`) + `Sec-WebSocket-Extensions` (`connection.extensions`). The fabricated
> `Sec-WebSocket-Key`/`Accept` lines from the mockup are **omitted** (we do not invent wire data). SSE's
> handshake uses the **actual** `fetch` request headers we set (`Accept: text/event-stream`,
> `Cache-Control: no-cache`, `Last-Event-ID` on resume, masked auth) + the real response status — so SSE is
> fully accurate.
>
> **C. Data model — one entry may carry a multi-line `detail`.** Each `WsConsoleEntry` has
> `{ id; level; direction; category; message; detail?; timestamp }`. `detail` is a curl-verbose block whose
> lines are individually prefixed (`> ` request / `< ` response / `* ` info). **Structured view (B)** renders
> one row per entry; rows with `detail` are **expandable** (chevron) → `<pre>` of the detail. **Raw view (A)**
> renders the entry's primary row using the `direction` glyph (`* / > / < / $`), then expands `detail` into
> grouped sub-rows, deriving each sub-row's glyph from its line prefix via a **pure `parseRawConsoleLines`
> helper**. Both views render the **same `WsConsoleEntry[]`** — they differ only in presentation, satisfying
> "no data divergence".
>
> **D. No virtualization.** Unlike `WebSocketMessageLog` (`@tanstack/react-virtual`), the console renders the
> ring-buffered list directly. The `maxEntries` cap (default **1000**) bounds the DOM, and expandable
> variable-height rows make virtualization costly for little gain. Revisit only if profiling shows jank.
>
> **E. Phase 9 ships B + A only — no command line.** The `.con-cmd` input and `command`/`$`-direction echoes
> are **Phase 10**. The `command` direction + `command` category stay in the model (so Phase 10 is additive),
> but no command UI is rendered now.
>
> **F. Control frames (ping/pong) are best-effort.** The studio sets `connection.latencyMs` once at the
> handshake; there is no per-pong RTT stream. The observer emits a `control` entry only when `latencyMs`
> **changes after** the initial handshake value while `connected`. Lifecycle + handshake + protocol +
> reconnect + error are the guaranteed-recorded set (the success criteria); control is additive.
>
> **G. Scope = shell-v2 (the redesign), flag-gated.** WS shell-v2 already lists `console` in `WS_RIGHT_TABS`
> (currently a placeholder); Phase 9 fills it. The **SSE shell gains a right-pane tab strip** (`Events` |
> `Console`) — it currently renders a plain `Events` title. Legacy (non-shell) layouts do **not** get the
> Console (consistent with Phase 8 keeping new features in the flag-gated redesign).
>
> **Files (new ⭐ unless noted):**
> - ⭐ `src/features/websocket/wsConsoleTypes.ts` — `WsConsoleLevel`/`WsConsoleDirection`/`WsConsoleCategory`
>   unions + const tuples, `WsConsoleEntry`, `WsConsoleSettings`, `WS_CONSOLE_DEFAULT_SETTINGS`,
>   `WS_CONSOLE_MAX_ENTRIES`, label maps.
> - ⭐ `src/features/websocket/wsConsoleEntries.ts` — pure helpers: entry builders
>   (`buildConnectingEntry`, `buildHandshakeEntry`, `buildEstablishedEntry`, `buildProtocolEntry`,
>   `buildClosedEntry`, `buildErrorEntry`, `buildReconnectEntry`, `buildControlEntry` + SSE variants),
>   `filterConsoleEntries(entries, settings, search)`, `parseRawConsoleLines(entry)`, `appendCapped`.
> - ⭐ `src/features/websocket/useConsoleBuffer.ts` — generic ring-buffer + settings hook (append/clear,
>   load/save settings) reused by WS + SSE.
> - ⭐ `src/features/websocket/useWebSocketConsole.ts` — WS observer (records on `connection`/`reconnectState`/
>   `detectedProtocol`/`latencyMs` transitions).
> - ⭐ `src/features/sse/useSseConsole.ts` — SSE observer (records on `connection`/`reconnectAttempt`/
>   `lastEventId` transitions).
> - ⭐ `src/features/websocket/ConsolePanel.tsx` — shared UI (toolbar: Structured/Raw toggle, severity +
>   category filters, search, auto-scroll, copy, export, clear; structured + raw renderers). Reused by WS + SSE.
> - `src/shared/websocket/websocketStorage.ts` (edit) — `WS_CONSOLE_SETTINGS_KEY` + shared
>   `loadConsoleSettings(key)`/`saveConsoleSettings(key, s)` sanitizers.
> - `src/features/sse/sseStorage.ts` (edit) — `SSE_CONSOLE_SETTINGS_KEY` (reuses the shared sanitizer).
> - `src/features/websocket/WsConnectionTabContent.tsx` (edit) — `shellRightTab === 'console'` renders
>   `<ConsolePanel>`.
> - `src/features/sse/SseStudioShell.tsx` + `SseStudioPage.tsx` (edit) — right-pane `Events`/`Console` tab strip.
> - `src/styles/websocket-studio.css` (+ `sse-studio.css` as needed) — `.ws-console-*` classes.
> - Tests: `wsConsoleEntries.test.ts`, `useWebSocketConsole.test.ts`, `useSseConsole.test.ts`,
>   `ConsolePanel.test.tsx`, plus right-tab integration assertions in the existing page tests.

> **✅ Implementation Notes / Retrospective (2026-06-11).** Phase 9 shipped (B + A) on `feature/websocket`.
> Verified: `npx tsc -b --noEmit` 0 errors; `npx eslint` on all 17 touched files 0 errors; **217 tests green**
> across the new + touched suites.
>
> **Deviations from the plan (both deliberate):**
> 1. **Console settings storage lives in the feature layer, not `shared/websocket`.** The plan said to edit
>    `src/shared/websocket/websocketStorage.ts` + `src/features/sse/sseStorage.ts`. Instead the sanitizer +
>    load/save live in a new **`src/features/websocket/wsConsoleStorage.ts`** (`WS_CONSOLE_SETTINGS_KEY` =
>    `redfire-ws-console-settings-v1`, `SSE_CONSOLE_SETTINGS_KEY` = `redfire-sse-console-settings-v1`). Putting
>    it in `shared/` would have created a `shared → feature` import inversion (the sanitizer references the
>    feature-owned `WsConsoleSettings` type). SSE imports the feature module, matching the Phase 8 precedent.
> 2. **Console CSS is a dedicated `src/styles/console-panel.css` imported by `ConsolePanel.tsx`**, not appended
>    to `websocket-studio.css`. `websocket-studio.css` only loads on the WS page; the SSE page loads
>    `sse-studio.css`. A panel-owned stylesheet guarantees the `.ws-console-*` classes load on **both** pages.
>    The duplicate block was removed from `websocket-studio.css` (pointer comment left in its place).
>
> **Bugs found and fixed during the post-implementation re-evaluation passes:**
> - **Reconnect entries dropped after the attempt counter resets.** The observer used `attempt > prevAttempt`,
>   which silently skipped the first attempts of a *new* reconnect cycle once the counter reset to 0 on a
>   successful reconnect (e.g. prev=3 → 0 → 1, `1 > 3` is false). Fixed to
>   `active && attempt >= 1 && attempt !== prevAttempt` in **both** `useWebSocketConsole` and `useSseConsole`;
>   added a regression test (`records the first attempt of a new cycle after the counter resets`).
> - **Settings change lost on quick tab switch.** A filter/view change within the 300ms debounce followed by an
>   unmount lost the save (same class of bug fixed for SSE config in Phase 8). Added an unmount-flush effect to
>   `useConsoleBuffer` that persists the latest settings on teardown (guarded by `settingsLoaded`).
> - **Stale test.** `WsConnectionTabContent.test.tsx` still asserted the console right-tab showed the
>   "part of the redesigned layout" placeholder; updated to assert the real `<ConsolePanel>` (`ws-console`)
>   renders and the events-log search input is absent.
> - **Protocol effect emitted an orphan entry on mid-connection mount.** Unlike the lifecycle/reconnect effects
>   (which seed on first observation), the protocol-detection effect emitted a "Protocol detected" entry on its
>   first run if a protocol was already present — producing an entry with no preceding handshake. Added a
>   `protocolSeededRef` so the first observation seeds without emitting (matches the other two effects);
>   added a regression test (`does not emit a protocol entry for a protocol already detected at mount`).
>
> **Other decisions:** no virtualization (D); no command line (E — Phase 10); control frames best-effort on
> latency change (F); WS testids prefixed by `variant` (`ws`/`sse`) except per-entry rows which use the unique
> entry id; the WS console hook var is named `wsConsole` to avoid shadowing the global `console`.

### Phase 10 — ⭐ Console: command line (C) ✅
- Bottom command input, parser, dispatch to existing studio actions, history, `/help`; echoes as `command`-direction entries.
- **Success:** `/ping /close /connect /disconnect /clear /send /template` work; SSE limited to `/connect /disconnect /clear`; tested.

> **Re-evaluation (2026-06-11) — plan expansion before implementation.** The console (Phase 9) ships
> a presentational `ConsolePanel` shared by WS + SSE, but with **no command line** (the panel doc
> explicitly says "No command line (that is Phase 10)."). The entry model already supports command
> echoes: `WsConsoleDirection` includes `'command'` (Raw glyph `$`) and `WsConsoleCategory` includes
> `'command'`. The studio already exposes every action a command needs
> (`connect`, `disconnect(detail?)`, `send(data, format?)`, `sendPing`, `clearMessages`,
> `setDraft({url})`), and `templatesHook.templates` (`WsMessageTemplate { name, body, format }`) is in
> scope in `WsConnectionTabContent`. SSE exposes `connect`, `disconnect`, `setConfig({url})`, and the
> console buffer's `clear`.
>
> **Sub-tasks (the work):**
> 1. **10A — Pure parser + command registry** (`wsConsoleCommands.ts`, no React):
>    `parseConsoleCommand(input)` → discriminated union (`empty` | `command{name,args,rest}` | `plain{text}`);
>    `ConsoleCommandSpec { name, usage, description }`; `WS_CONSOLE_COMMANDS` / `SSE_CONSOLE_COMMANDS`
>    spec lists; `buildCommandHint(specs)`; `navigateHistory(direction, index, length)` pure helper for ↑↓.
> 2. **10B — Command entry builders** (`wsConsoleEntries.ts`): `buildCommandEchoEntry(input)`
>    (direction `command`, category `command`, glyph `$`), `buildCommandResultEntry(message, detail?)`,
>    `buildCommandErrorEntry(message)` (level `error`), `buildHelpEntry(specs)` (multi-line `detail`).
> 3. **10C — Dispatch hook** (`useConsoleCommands.ts`): takes `{ append, clearConsole, capabilities }`,
>    returns `runCommand(input)` + the `hint` string. Parses, echoes, validates (connection state, args),
>    dispatches to capabilities, appends result/error. Capabilities are variant-shaped: WS provides
>    `ping/send/sendTemplate`, SSE omits them.
> 4. **10D — Command-line UI in `ConsolePanel`**: optional props `onCommand?`, `commandHint?`. When
>    `onCommand` is provided, render `.ws-console-cmd` (prompt `›` + input + hint) and own input state +
>    ↑↓ history recall (UI-only). Back-compatible: no command line when `onCommand` absent.
> 5. **10E — Wire WS + SSE**: `WsConnectionTabContent` builds full capabilities (incl. `/ping`, `/close`,
>    `/send`, `/template` via `templatesHook`); `SseStudioPage` builds the limited set
>    (`/connect`, `/disconnect`, `/clear`, `/help`). CSS `.ws-console-cmd` (+ `.ws-console-prompt`,
>    `.ws-console-cmd-hint`) added to `console-panel.css` so it loads on both pages.
>
> **Decisions:** non-slash, non-empty input → error directing to `/help` (the explicit `/send` is required
> to send); `/clear` clears the **console buffer** (terminal convention), not the message/event log;
> `/connect` while already connected → error ("use /disconnect first"); `/close [code] [reason]` validates
> the code is an integer; history is in-session only (↑↓ recall, not persisted).
>
> **Tests:** `wsConsoleCommands.test.ts` (parser + history + specs), command-entry builders in
> `wsConsoleEntries.test.ts`, `useConsoleCommands.test.ts` (dispatch + validation, WS and SSE shapes),
> `ConsolePanel` command-line behavior (render gating, submit, ↑↓ history) in its `.test.tsx`; plus a
> Playwright spec exercising `/help`, `/clear`, `/connect`.

> **✅ Implementation notes / retrospective (2026-06-11).** Shipped as planned across 10A–10E.
> - **10A** `wsConsoleCommands.ts` — `parseConsoleCommand` returns `empty | command{name,args,rest} | plain`;
>   `rest` preserves inner spacing (for `/send` JSON payloads). `WS_CONSOLE_COMMANDS` (8) +
>   `SSE_CONSOLE_COMMANDS` (4) specs; `buildCommandHint` + precomputed `WS_CONSOLE_HINT` / `SSE_CONSOLE_HINT`
>   constants (stable refs, so `ConsolePanel`'s `commandHint` prop identity is constant); pure
>   `navigateHistory('up'|'down', index|null, length)` for ↑↓ (null = live line).
> - **10B** added `buildCommandEchoEntry` / `buildCommandResultEntry` / `buildCommandErrorEntry` /
>   `buildHelpEntry` to `wsConsoleEntries.ts` (reusing the private `makeEntry`); help aligns usage columns
>   via `padEnd`.
> - **10C** `useConsoleCommands.ts` — `runCommand` is **stable across renders** (capabilities/append/clear
>   read from refs, deps `[commandNames]` where `commandNames` derives from the module-const spec list), so
>   the command-line keeps its input/history state. Echoes first, then validates args **before** connection
>   state, then dispatches. SSE rejects `/ping /send /template` as unknown (they're absent from its spec list).
> - **10D** `ConsolePanel` gained optional `onCommand?` + `commandHint?`; the `.ws-console-cmd` block
>   (prompt `›` + input + hint) renders only when `onCommand` is provided (back-compatible). A small
>   `CommandLine` subcomponent owns input + history state (UI-only); `onChange` returns to the live line.
> - **10E** WS wired in `WsConnectionTabContent` (full caps; `/template <name>` resolves case-insensitively
>   against `templatesHook.templates` and sends `body`/`format`); SSE wired in `SseStudioPage` (limited caps).
>   Both pass an `isConnected` + `isConnecting` pair so connection-state gating is precise (see hardening note).
>   CSS added to `console-panel.css` (`.ws-console-cmd`, `.ws-console-prompt`, `.ws-console-cmd-input`,
>   `.ws-console-cmd-hint`) so it loads on both pages.
> - **Verification:** `tsc -b --noEmit` clean; eslint clean; touched vitest **103/103** (parser 20, entries 34,
>   hook 33, panel 16) + WS/SSE consumer suites **265/265**; Playwright `websocket-console-cmd.spec.ts` **5/5**.
> - **Deviation from plan:** `/clear` intentionally clears the echo too (terminal `clear` convention — the
>   `append(echo)` + `clear()` functional updaters compose to an empty buffer). `useConsoleCommands` returns
>   only `runCommand` (the hint is exposed as a module constant rather than from the hook).
>
> **🔧 Re-evaluation / hardening (2026-06-11).** A deep re-audit of the shipped Phase 10 code found and fixed
> three bugs (all covered by new unit tests):
> 1. **Parser whitespace-after-slash.** `/  send hi` mis-sliced `rest` (old `slice(parts[0].length)` logic).
>    `parseConsoleCommand` now trims the body after the slash and locates the first whitespace, so the name
>    and `rest` are always correct regardless of leading whitespace.
> 2. **`/close` could crash the socket.** An out-of-range code (e.g. `/close 5`, `/close 9999`) passed the
>    digit check then called `ws.close(code)` → native `InvalidAccessError`. The handler now validates the
>    code is in **1000–4999** and the reason is **≤123 bytes** (mirroring `WebSocketConnectPanel`'s
>    `byteLength` check) before disconnecting.
> 3. **Connection-state gating was a single boolean.** `isConnected` alone could not express the
>    *connecting* transition: WS would tear down + reconnect on a redundant `/connect` while connecting, and
>    SSE (passing `isBusy`) reported "Already connected" while still connecting. Added an `isConnecting`
>    capability — `/connect` is blocked while connected **or** connecting; `/disconnect` is allowed (aborts)
>    while connecting; send/ping/close/template still require a live connection. Both WS and SSE now pass the
>    precise `isConnected` + `isConnecting` pair.
>
> **🔧 Re-evaluation round 2 (2026-06-11) — source-level close-code guard.** A deeper pass found a latent
> bug shared by the `/close` command **and the existing close-code picker UI** (`WebSocketConnectPanel`):
> the native browser `WebSocket.close(code)` only accepts `1000` or `3000–4999`, yet the close-code presets
> include reserved codes (`1001/1002/1003/1008/1011`) and both the UI and the command accepted `1000–4999`.
> Closing a **native** (browser, non-proxy) socket with a reserved code threw `InvalidAccessError`. Fixed at
> the single source: a pure `sanitizeNativeCloseCode(code)` in `wsMessageUtils.ts` (passes `1000` / `3000–4999`,
> else falls back to `1000`) is now applied in `useWebSocketStudio.disconnect()`'s native `ws.close()` branches.
> The Tauri **proxy** path is unchanged (tungstenite sends the real code over IPC). The `SENT close` frame log
> was moved into each branch so it reports the code actually sent (proxy = original, native = sanitized; the
> no-socket path logs nothing). Covered by `sanitizeNativeCloseCode` unit tests + an updated studio test
> (reserved `1001` → native `1000`).
>
> **Success criteria:**
> - [x] `/ping /close /connect /disconnect /clear /send /template` work (WS).
> - [x] SSE limited to `/connect /disconnect /clear` (+ `/help`); WS-only commands rejected as unknown.
> - [x] Command echoes render as `command`-direction entries (`$` glyph in Raw view).
> - [x] ↑↓ history recall; `/help` lists commands; tested (unit + E2E).

### Phase 11 — Polish & QA ✅
- Keyboard nav, ARIA, focus order; pane resize persistence; theme QA (dark/light/dim/steel/sapphire); E2E (`--reporter=list`).
- **Success:** a11y pass; 0 type/lint/test errors; E2E green; mockups match shipped UI.

> **⚠️ Re-evaluation (2026-06-11) — plan expansion before implementation.** A code-level audit of the
> shipped shells (`WebSocketStudioShell.tsx`, `SseStudioShell.tsx`) found the Phase 11 success criteria are
> not yet met. The terse two-bullet scope is expanded into the concrete, grounded sub-phases below. Phase 10
> (console command line) is **independent** and remains out of scope here.
>
> **Gaps found (the work):**
> 1. **Pane width is not persisted.** Both shells hold the left-pane width in local `useState`
>    (WS `560`, SSE `360`) with a mouse-drag handler; the width resets to the default on every remount/reload.
> 2. **The divider is mouse-only / not keyboard-accessible.** `role="separator"` + `aria-orientation` are
>    present, but there is no `tabIndex`, no key handler, and no `aria-valuenow/valuemin/valuemax` or
>    `aria-label`. Keyboard users cannot resize.
> 3. **Tab strips are not a full ARIA tablist.** `role="tablist"`/`role="tab"`/`aria-selected` are present,
>    but there is **no roving `tabIndex`**, **no Arrow/Home/End navigation**, and the tab buttons are not
>    linked to their panels (`aria-controls` → `role="tabpanel"`/`aria-labelledby`). This affects the WS mode
>    strip + left/right strips and the SSE left/right strips.
> 4. **Missing `:focus-visible` styles.** Only `.ws-conn-tab` has a focus ring; `.ws-studio-tab`,
>    `.ws-studio-mode`, `.ws-studio-divider` and the SSE equivalents have none, so keyboard focus is invisible.
> 5. **Duplicated resize logic.** The drag effect + `startDrag` + min-width clamp is copy-pasted in both
>    shells (and a third variant lives in `useResizablePanels` for the data mapper). Per the project's
>    extract-reusable rule, the WS + SSE resize is unified into one shared hook.
>
> **Sub-phases:**
>
> - **11A — Shared resizable split-pane hook (persistence + a11y divider).** New
>   `src/shared/hooks/useSplitPaneResize.ts`: owns the left-pane width, persists it (async `readKey` load on
>   mount + debounced `writeKey` save + unmount flush, mirroring the Phase 9 console-settings pattern), keeps
>   the existing **mouse**-drag mechanics (so existing drag tests stay valid), and adds keyboard resize
>   (`ArrowLeft`/`ArrowRight` ± step, `Shift`+Arrow / `PageUp`/`PageDown` ± page step, `Home` → min,
>   `End` → max) with clamping against the container. Returns `{ width, maxWidth, dividerProps }` where
>   `dividerProps` carries `role="separator"`, `aria-orientation`, `aria-label`, `aria-valuenow/min/max`,
>   `tabIndex={0}`, `onMouseDown`, `onKeyDown`. Both `WebSocketStudioShell` and `SseStudioShell` adopt it.
>   Storage keys: `redfire-ws-split-v1`, `redfire-sse-split-v1`.
> - **11B — Tablist keyboard nav + ARIA linkage.** New pure helper
>   `src/shared/utils/tabListKeyboard.ts` → `handleTabListArrowKeys(e)` (finds `[role="tab"]` siblings, moves
>   focus + activates on Arrow/Home/End via `focus()` + `click()`; automatic-activation pattern matching the
>   immediate panel swap). Each tab button gets roving `tabIndex={selected ? 0 : -1}`, an `id`, and
>   `aria-controls` pointing at its panel; the left/right pane bodies become `role="tabpanel"` +
>   `aria-labelledby` + `tabIndex={0}`. Applied to the WS mode/left/right strips and the SSE left/right strips.
> - **11C — Focus-visible + theme QA.** Add `:focus-visible` outlines for `.ws-studio-tab`, `.ws-studio-mode`,
>   `.ws-studio-divider`, `.sse-studio-tab`, `.sse-studio-divider` (reuse the `.ws-conn-tab` accent pattern).
>   Audit the studio + console CSS to confirm every color resolves through a theme `var()` (with a sensible
>   fallback) so dark/light/dim/steel/sapphire all render correctly; fix any hardcoded color.
> - **11D — Tests + static checks.** Unit tests for `useSplitPaneResize` (default, persist load/save, clamp,
>   keyboard steps, unmount flush) and `tabListKeyboard` (wrap-around, Home/End, no-op keys), plus shell tests
>   for divider ARIA + roving tabIndex + arrow nav. `npx tsc -b --noEmit`, `npx vitest run` on touched files,
>   and `npx eslint` all clean.
> - **11E — E2E.** A Playwright spec that enables the WS shell-v2 flag via `localStorage`, loads the WS page
>   (no backend needed for the shell chrome), and asserts: divider keyboard resize, width persists across
>   reload, and Arrow-key tab navigation. Run with `--reporter=list` at the merge gate.
>
> **Success criteria (refined):**
> - [x] Left-pane width persists across reload (WS + SSE), clamped to min/max.
> - [x] Divider is focusable and resizable by keyboard with correct `aria-value*`.
> - [x] Tab strips support roving `tabIndex` + Arrow/Home/End; tabs linked to `role="tabpanel"` bodies.
> - [x] All interactive shell elements have a visible `:focus-visible` ring across all five themes.
> - [x] `npx tsc -b --noEmit` clean; touched-file vitest green; `eslint` clean.
> - [x] E2E spec green (`--reporter=list`).
>
> **✅ Implementation notes / retrospective (2026-06-11).**
> Implemented exactly as the 11A–11E plan above, with these grounded decisions:
>
> - **11A — `src/shared/hooks/useSplitPaneResize.ts`** owns `width` + `maxWidth` state, `readKey` load on
>   mount, debounced (`300ms`) `writeKey` save, and an unmount flush — both writes guarded by a `loadedRef`
>   so the default never overwrites a not-yet-loaded persisted value. The original **mouse** drag mechanics
>   are preserved verbatim (window `mousemove`/`mouseup`) so the existing shell drag tests stay valid; pointer
>   events were deliberately **not** adopted. Keyboard: `Arrow` ± `step` (16), `Shift`+Arrow / `Page*` ±
>   `pageStep` (64), `Home` → min, `End` → container max. `dividerProps` spreads the full `separator`
>   semantics; `aria-valuemax` is `round(max(maxWidth, width))` so it can never be less than `aria-valuenow`.
>   Storage keys `redfire-ws-split-v1` / `redfire-sse-split-v1`. **Known limitation:** `maxWidth` (for
>   `aria-valuemax`) re-measures on mount + `window` resize but not on container-only resize (e.g. sidebar
>   collapse) — acceptable polish; the prior shells exposed no value at all.
>
>   **🔧 Re-evaluation / hardening (2026-06-11).** The `measure` effect previously updated only `maxWidth`
>   on window resize, so when the window shrank the left pane kept its larger explicit width
>   (`flex-shrink: 0`) and squeezed the right pane below its minimum / clipped it. The effect now also
>   re-clamps the current `width` down (`setWidth((w) => (w > max ? max : w))`) so the left pane can never
>   overflow after a window resize (a no-op — and no spurious save — when the width already fits). Covered by
>   two new unit tests (shrink → clamp down; grow → width unchanged, only `maxWidth` grows). The container-only
>   resize case (sidebar collapse without a window resize) remains the documented limitation — a `ResizeObserver`
>   was deliberately not added (it is only a no-op stub in the test env and the window-resize path covers the
>   common case).
> - **11B — `src/shared/utils/tabListKeyboard.ts`** exports `getNextTabIndex` (pure, wrap-around + Home/End)
>   and `handleTabListArrowKeys` (DOM-scoped to the tablist container; automatic-activation via
>   `focus()` + `click()`). The WS mode strip uses `aria-controls="ws-studio-split"`; the left/right pane
>   bodies became `role="tabpanel"` + `aria-labelledby` + roving `tabIndex` **only in client mode** (the
>   Mock/Saved panes carry their own headers, so they intentionally stay non-tabpanel). SSE mirrors this,
>   gated on `leftTab`/`rightTab != null`.
> - **11C** — added `:focus-visible` rings for `.ws-studio-tab` / `.ws-studio-mode` / `.ws-studio-divider`
>   and `.sse-studio-tab` / `.sse-studio-divider`, reusing the `.ws-conn-tab` accent pattern (SSE resolves
>   through the `--ws-accent-color → --accent-color` fallback chain).
> - **11D** — new unit tests: `useSplitPaneResize.test.ts` (16, incl. the two window-resize re-clamp tests),
>   `tabListKeyboard.test.ts` (11), plus a11y assertions added to `WebSocketStudioShell.test.tsx` (→ 18) and
>   `SseStudioShell.test.tsx` (→ 12). Existing
>   shell tests required a `localStorage.clear()` `beforeEach` so the new async width-load no longer leaks a
>   sibling test's persisted value (this also removed an `act(...)` warning). `tsc -b` + `eslint` clean; the
>   broader `websocket`/`sse`/`shared` suites stay green (3322 tests).
> - **11E — `e2e/websocket-studio-shell.spec.ts`** (5 tests, all green via `--reporter=list`): divider ARIA,
>   keyboard resize (Arrow + Home → 320), width persists across reload, and Arrow-key nav on the left + mode
>   strips. SSE reuses the same shared hook/util, covered by the unit layer, so no separate SSE E2E was added.
>   **Caught during E2E:** an `addInitScript` that reset the split key re-ran on `page.reload()` and wiped the
>   saved width — a test-only bug; Playwright already isolates storage per test, so the reset was removed.

---

## 10. Component & File Map

> New files marked ⭐. Relocations reuse existing components inside new containers.

```
src/features/websocket/
  WebSocketStudioShell.tsx           ✅ split-pane shell (mode switch, URL bar, status strip, divider) — Phase 1
  WsStudioLeftPane.tsx               (NOT created — left tabs render inside WsConnectionTabContent leftBody, Phase 2/4)
  WsStudioRightPane.tsx              (NOT created — right tabs render inside WsConnectionTabContent rightBody, Phase 4/5)
  WebSocketAuthPanel.tsx             ✅⭐ Auth tab (thin wrapper around shared AuthConfigPanel + resolved-as preview + WS browser-mode callout) — Phase 8
  wsAuthResolve.ts                   ✅⭐ resolveAuthForConnect(auth, profiles, envVarMap) → { headers[], queryParams[] } (+ OAuth2 fetch) + describeResolvedAuth() + resolveEffectiveAuth() (sync fast-path) — SHARED by WS + SSE — Phase 8
  wsAuthResolve.test.ts              ✅⭐ 28 tests — Phase 8
  WebSocketConsole.tsx               ⭐ Console tab — structured view (B) + Raw timeline toggle (A) + command line (C)
  useWebSocketConsole.ts             ⭐ lifecycle/handshake listener + ring buffer
  useWebSocketConsole.test.ts        ⭐
  wsConsoleTypes.ts                  ⭐ WsConsoleEntry, levels, categories
  (existing components reused unchanged: WebSocketConnectPanel, WebSocketTlsPanel,
   KeyValueEditor, WebSocketProtocolSelector, WebSocketMessageLog, WebSocketMessageDetail,
   WebSocketStatsPanel, WebSocketLoadTest, WebSocketMessageDiff, WebSocketSchemaPanel,
   WebSocketSavedConnections, WebSocketMockServer, all hooks)

src/features/sse/
  SseStudioShell.tsx                 ✅ split-pane SSE shell + Connect/Auth tab strip (SSE_LEFT_TABS) — Phase 7/8
  sseStudioShellFlag.ts              ✅ redfire-sse-studio-shell-v2 flag — Phase 7
  SseAuthPanel.tsx                   ✅⭐ thin wrapper around shared AuthConfigPanel + resolved-as preview (NO browser-mode callout — fetch transport sets headers) — Phase 8
  sseStorage.ts                      ✅⭐ loadSseConfig/saveSseConfig (key redfire-sse-config-v1) persisting the full SseConnectionConfig (url, headers, autoReconnect, maxRetries, auth?) — Phase 8
  sseStorage.test.ts                 ✅⭐ round-trip + corrupt/missing → defaults + maxRetries clamp — Phase 8
  SseConsole.tsx                     ⭐
  useSseConsole.ts                   ⭐

src/shared/
  components/AuthConfigPanel.tsx     ♻️ reused IN PLACE from features/requests/components (already presentational — NOT moved; resolved Phase 8.1)
  utils/authHeaders.ts               ♻️ resolveAuthHeaders reused as the single auth→header source (extended only if needed) — Phase 8
  requests/hooks/useAuthVerify.ts    ♻️ reused for Verify Auth + OAuth2 token fetch — Phase 8
  websocket/types.ts                 ➕ WsConnectionDraft.auth? + WsConnectionProfile.auth? (Phase 8); studio mode/pane-tab types (Phase 0–1); console types (Phase 9)

src/features/sse/sseTypes.ts         ➕ add auth?: AuthConfig — Phase 8

docs/plan/future/websocket/mockups/  ➕ ws-auth.html (Auth tab), ws-console.html (3 options), ws-console-final.html (combined)
```

### 10.1 Mockup CSS → Production CSS mapping

> Phase 0 deliverable. The mockups use a self-contained `mockups/mockup.css`; production already ships [src/styles/websocket-studio.css](../../../src/styles/websocket-studio.css) + [src/styles/sse-studio.css](../../../src/styles/sse-studio.css). This table maps each mockup class group to its production target so later phases reuse/extend existing classes instead of inventing parallel ones. `♻️ existing` = production class already exists; `⭐ new` = add in the named phase.

| Mockup area | Mockup class(es) | Production target (websocket-studio.css) | Status |
|---|---|---|---|
| Page shell | `.ws` | `.ws-studio-page` | ♻️ existing |
| Connection bar | `.ws-conns` / `.ws-conn` / `.ws-conn-add` | `.ws-conn-tab-bar` / `.ws-conn-tab` / `.ws-conn-tab-add` | ♻️ existing |
| Mode switch | `.ws-modes` / `.ws-mode` | `.ws-studio-modes` / `.ws-studio-mode` | ⭐ new (Phase 1) |
| URL bar | `.ws-urlbar` / `.ws-proto` / `.ws-url` / `.ws-url-actions` | `.ws-connect-url-row` / `.ws-connect-url-wrapper` / `.ws-connect-url-input` (regroup into a top bar) | ♻️ existing + ⭐ regroup (Phase 1) |
| Status strip | `.ws-statusstrip` / `.pill` / `.stat` | `.ws-status-bar` / `.ws-status-badge` / `.ws-status-metric` | ♻️ existing |
| Split pane | `.ws-split` / `.ws-left` / `.ws-right` / `.ws-divider` | `.ws-studio-split` / `.ws-studio-left` / `.ws-studio-right` / `.ws-studio-divider` | ⭐ new (Phase 1) |
| Pane tabs | `.tabs` / `.tab` / `.badge` / `.tdot` | `.ws-studio-tabs` / `.ws-studio-tab` / `.ws-studio-tab-badge` (+ `-dot` modifier) | ♻️ existing + ⭐ dot modifier |
| Config body | `.cfg` / `.field` / `.panel` / `.kv-row` | `.ws-connect-panel` / `.ws-connect-kv-section` / `.ws-connect-kv-row` | ♻️ existing |
| Composer | `.composer` / `.editor` / `.composer-toolbar` / `.send-btn` | `.ws-compose-bar` / `.ws-compose-input` / `.ws-compose-send-btn` | ♻️ existing |
| Events list | `.ev-list` / `.ev-toolbar` / `.ev-colhead` | `.ws-message-list` / `.ws-message-log-toolbar` / `.ws-message-row` | ♻️ existing |
| Segmented ctrl | `.seg` | `.ws-message-direction-filter` pattern (generalize to `.ws-seg`) | ⭐ new (Phase 5/9) |
| Auth panel | `.auth-radio` / `.auth-resolved` / `.auth-secret` / `.auth-callout` | reuse Requests `scenario-auth-panel` / `.auth-type-select` / `.form-row` (shared `AuthConfigPanel`) | ♻️ existing (Phase 8) |
| Console | `.con` / `.con2` / `.con2-detail` / `.con-cmd` | `.ws-console-row` / `.ws-console-row-structured` / `.ws-console-detail` / `.ws-console-cmd` | ⭐ new (Phase 9/10) |
| SSE shell | (sse.html classes) | [src/styles/sse-studio.css](../../../src/styles/sse-studio.css) — mirror the WS split-pane classes | ⭐ new (Phase 7) |


---

## 11. Type Definitions

```ts
// src/shared/websocket/types.ts (additive)

// ── Studio-layout foundation (Phase 0 — pure, no runtime wiring) ──────
// Const tuples are the single source of truth; the union types are DERIVED
// from them so the two can never drift. The Phase 1 persistence validators
// iterate the tuples.
export const WS_STUDIO_MODES = ['client', 'mock', 'saved'] as const;
export const WS_LEFT_TABS = ['compose', 'connect', 'auth', 'params', 'headers'] as const;
export const WS_RIGHT_TABS = ['events', 'console', 'stats', 'loadtest', 'schema'] as const;

export type WsStudioMode = (typeof WS_STUDIO_MODES)[number];
export type WsLeftTab = (typeof WS_LEFT_TABS)[number];
export type WsRightTab = (typeof WS_RIGHT_TABS)[number];

export const WS_DEFAULT_MODE: WsStudioMode = 'client';
export const WS_DEFAULT_LEFT_TAB: WsLeftTab = 'compose';
export const WS_DEFAULT_RIGHT_TAB: WsRightTab = 'events';

export function isWsStudioMode(v: unknown): v is WsStudioMode;
export function isWsLeftTab(v: unknown): v is WsLeftTab;
export function isWsRightTab(v: unknown): v is WsRightTab;

export interface WsStudioLocation {
  mode: WsStudioMode;
  leftTab: WsLeftTab;
  rightTab: WsRightTab;
}

// §4.2 mapping old WsViewTab → new mode + pane tabs. Phase 0 ships the pure
// function; Phase 1 wires it into loadWsTabState for persistence migration.
export function mapViewTabToStudioLocation(viewTab: WsViewTab): WsStudioLocation;

// ⭐ Phase 1 — inverse of mapViewTabToStudioLocation. Derives the legacy
// WsViewTab from the studio (mode, leftTab) so the persisted `viewTab` stays
// consistent when the shell owns navigation. Round-trips with the mapping
// above for every WsViewTab. (mock→'mock', saved→'saved',
// client+leftTab==='compose'→'messages', else→'connect'.)
export function deriveViewTabFromStudio(mode: WsStudioMode, leftTab: WsLeftTab): WsViewTab;

// Phase 1 — persistence: extend the persisted tab with the new studio
// location. Optional + back-compat; `viewTab` stays required so legacy blobs
// (and the flag-off path) keep working. loadWsTabState normalizes missing
// fields via mapViewTabToStudioLocation(viewTab).
export interface WsPersistedTab {
  id: string;
  label: string;
  url: string;
  viewTab: WsViewTab;       // kept for back-compat
  mode?: WsStudioMode;      // ⭐ Phase 1
  leftTab?: WsLeftTab;      // ⭐ Phase 1
  rightTab?: WsRightTab;    // ⭐ Phase 1
}

// Phase 1 — feature flag (src/shared/websocket/wsStudioShellFlag.ts)
// Single storage key over readKey/writeKey, default false.
export function loadWsShellV2Enabled(): Promise<boolean>;
export function saveWsShellV2Enabled(enabled: boolean): Promise<void>;

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
| Q3 | Feature-flag the new shell, or hard cut-over? | ✅ **DONE:** feature-flagged during development, then **removed (2026-06-11)** — v2 is now the default/only layout. The `redfire-ws-studio-shell-v2` / `redfire-sse-studio-shell-v2` flags + the Settings → Labs toggles were deleted; the legacy branches are retained as dead code, reachable only via an optional `shellV2` test prop. |

**Q3 explained — "feature-flag vs. hard cut-over":** This is about *how* we switch users from the old 4-tab UI to the new split-pane UI.
- **Hard cut-over** = delete the old UI and replace it with the new one in a single change. Simpler, but if the new shell has a bug, there is no way to fall back, and every phase would have to be perfect before shipping.
- **Feature flag** = keep BOTH UIs in the code behind a setting (e.g., a "New WebSocket UI (preview)" toggle). Users (and we, during QA) can flip between old and new to compare side-by-side. We build the new shell incrementally across Phases 1–7 while the old UI still works, then once parity is verified we **remove the flag and the old code** at Phase 11. **Recommended** because the redesign spans many phases and the flag de-risks each step.

---

## 13. Global Success Criteria

- [x] 100% feature parity with Phases 1–19 (every row in [§5](#5-feature-parity-matrix-nothing-is-lost) verified in the new shell).
- [x] Persisted WS tab state migrates from `viewTab` to mode + pane tabs without data loss.
- [x] ⭐ Auth: all `AuthType`s resolve to correct headers/params; global-profile inheritance works; persisted on profiles; browser limitations surfaced.
- [x] ⭐ Console: structured view (severity + category filter, search, expandable rows) **and** Raw timeline toggle render the same captured stream; every lifecycle transition + handshake captured; export/clear/auto-scroll; ring-buffer cap; SSE parity. Command line (Phase 10) shipped for WS (`/help /clear /connect /disconnect /ping /close /send /template`) and SSE (limited set).
- [x] Theme-correct in dark + light (+ dim/steel/sapphire by inheritance); `:focus-visible` rings on all interactive shell elements (Phase 11).
- [x] `npx tsc -b --noEmit` → 0 errors.
- [x] Touched-file unit tests pass during dev; WS/SSE/shared suites green (8892 tests as of 2026-06-11); E2E specs `websocket-console-cmd.spec.ts` + `websocket-studio-shell.spec.ts` green (`--reporter=list`). _Full suite + complete E2E run still required at the merge gate._
- [x] Mockups updated to match shipped UI (Auth tab real, Console badged then implemented).
- [x] No regression to workflow WS nodes or harness assertions.

### ⏳ What's left / not yet implemented (as of 2026-06-11)

The redesign is **functionally complete, tested, and now the default layout** (the feature flag and Labs toggles were removed). The following remains:

1. **~~Flip the flag default / hard cut-over.~~** ✅ Done (2026-06-11) — `shellV2` now defaults to `true`; the `redfire-ws-studio-shell-v2` / `redfire-sse-studio-shell-v2` flag modules and the `SettingsLabsTab` toggles were deleted.
2. **Remove the legacy flat-tab code path.** Deferred by choice. The old `WsViewTab` (`connect/messages/saved/mock`) rendering in `WsConnectionTabContent`, the legacy stacked `SseStudioPage` layout, and the `controlledViewTab` transitional API remain as **dead code**, reachable only via the optional `shellV2={false}` test prop. They can be deleted in a later cleanup once v2 has soaked. The `viewTab → mode/leftTab/rightTab` persistence migration in `loadWsTabState` should be kept for back-compat.
3. **Commit / merge.** All Phase 0–11 work (incl. this flag removal) is currently **uncommitted** on `feature/websocket` (per the project branching rules, awaiting explicit user go-ahead before commit/merge).
4. **Merge-gate verification.** Run the **full** unit suite + the **complete** Playwright E2E set (`--reporter=list`) before merging to `develop` (per the testing-strategy rules), and update CHANGELOG / RELEASE docs.

> Everything in the Phase Status Dashboard ([§8](#8-phase-status-dashboard)) is ✅; the items above are *post-implementation rollout*, not unbuilt features.

---

### Retrospective / Implementation Notes
_(append per phase: start/end dates, commit hashes, design deltas vs this plan)_

> **2026-06-11 — Re-evaluation / status sync.** All 12 phases (0–11) are implemented and tested on
> `feature/websocket` (uncommitted). Per-phase retrospectives are inline in [§9](#9-phased-implementation-plan).
> Post-implementation hardening this session (documented in the Phase 9/10/11 retrospectives): console-command
> parser whitespace fix, `isConnecting` connection-state gating, a source-level `sanitizeNativeCloseCode` guard
> (fixes a latent crash shared with the existing close-code picker UI), and a split-pane window-resize re-clamp
> fix. The **only** non-implementation work outstanding is the flag rollout / legacy-removal / commit items in
> the "What's left" note above.
