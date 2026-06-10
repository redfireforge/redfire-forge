# WebSocket Test Scenarios Plan

> **Purpose:** Master plan for all WebSocket Studio visual test-scenarios MD files.
> **Created:** 2026-06-10
> **Updated:** 2026-06-10
> **Completed:** None yet
> **In Progress:** None
> **Remaining:** 7 files
>
> **Source documents referenced:**
> - `websocket-studio-plan.md` — Phase definitions and scope (Phases 1–19 + Phase 18 SSE)
> - Phase Status Dashboard — All 19 phases complete (1261 WS + 47 SSE tests, 0 type errors)
>
> Each file follows the same workflow:
> 1. Write the test-scenarios MD file with click-by-click instructions
> 2. Manually validate every scenario in the browser with Docker
> 3. Fix any bugs or issues found
> 4. Export test data where applicable
> 5. Re-import and validate from scratch
> 6. User validates independently using the MD file

---

## Status Summary

| # | File | Covers | WS Plan Phases | Count | Status |
|---|---|---|---|---|---|
| | `ws-core-connect-test-scenarios.md` | Core connect, compose, message log, saved connections, templates, auto-reconnect, env vars, virtualized log | Phases 1, 2, 7, 8 | ~30 | Pending |
| | `ws-protocols-transport-test-scenarios.md` | Protocol codecs (Socket.IO, STOMP, GraphQL-WS), TLS/mTLS, protocol detection, Tauri native transport | Phases 3, 6 | ~20 | Pending |
| | `ws-tabs-persistence-test-scenarios.md` | Multiple tabs, tab persistence, connection history, bookmarks, session recording/replay, stats dashboard, drag reorder, keyboard nav | Phases 9, 10, 11, 12, 13 | ~30 | Pending |
| | `ws-filtering-diff-schema-test-scenarios.md` | Regex/JSONPath search, attribute filters, saved presets, message diff/compare, schema validation | Phases 14, 15, 19 | ~25 | Pending |
| | `ws-mock-server-test-scenarios.md` | Mock server core, response rules engine, live rule sync, broadcast, meta-testing | Phase 16 | ~18 | Pending |
| | `ws-load-test-scenarios.md` | Load test config (constant/ramp/burst), real-time metrics, latency histogram, results export | Phase 17 | ~15 | Pending |
| | `sse-studio-test-scenarios.md` | SSE connection, event log, type filtering, bookmarks, auto-reconnect, stats | Phase 18 | ~15 | Pending |

---

## File 1: `ws-core-connect-test-scenarios.md`

**Covers:** Phases 1, 2, 7, 8 — Core Connect & Send/Receive, Saved Connections, Templates, Auto-Reconnect, Env Variables, Virtualized Log
**Navigation:** Left activity bar → **Protocols** → **WebSocket** domain tab → **Connect** / **Messages** / **Saved Connections** view tabs
**Docker:** Echo server (`jmalloc/echo-server` on port 8765)
**Priority:** Highest — core debug UI surface

### Scenario Breakdown

#### Navigation & Layout (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-01 | Activity bar → Protocols → WebSocket sub-nav renders; page shows default tab with Connect view | No | No |
| WC-02 | Page layout: tab bar at top, view tabs (Connect / Messages / Saved Connections) below | No | No |
| WC-03 | Initial state: URL input empty, status "Disconnected", Connect button enabled, Disconnect disabled | No | No |

#### Connection Lifecycle (7 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-04 | Enter `ws://localhost:8765`, click Connect → status transitions: Connecting → Connected (green indicator) | ✅ | ✅ |
| WC-05 | Click Disconnect → status transitions: Disconnecting → Disconnected; latency and counters reset | ✅ | ✅ |
| WC-06 | Connect with custom headers (Authorization: Bearer xxx) → connection succeeds via server proxy | ✅ | ✅ |
| WC-07 | Connect with custom query params → params appended to URL correctly | ✅ | ✅ |
| WC-08 | Connect with subprotocol field → subprotocol negotiated | ✅ | ✅ |
| WC-09 | Connect to invalid URL → error message displayed, status stays Disconnected | No | No |
| WC-10 | Connect to `wss://` endpoint (with valid cert) → TLS connection succeeds | ✅ | ✅ |

#### Compose & Messaging (8 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-11 | Type text message, click Send → message appears in log with ↑ (sent) arrow + timestamp | ✅ | ✅ |
| WC-12 | Echo server response appears with ↓ (received) arrow + timestamp | ✅ | ✅ |
| WC-13 | Ctrl/Cmd+Enter shortcut sends message (same as clicking Send) | ✅ | ✅ |
| WC-14 | Send JSON message → auto-detected as JSON in message log | ✅ | ✅ |
| WC-15 | Format selector: Text / JSON / Binary modes in compose bar | No | No |
| WC-16 | Send binary message (Base64 or Hex input) → received as binary frame | ✅ | ✅ |
| WC-17 | Ping button sends WebSocket ping frame; pong response shown when system frames visible | ✅ | ✅ |
| WC-18 | Send button disabled when not connected; compose bar disabled during replay | No | No |

#### Message Log (6 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-19 | Message log auto-scrolls to bottom on new messages | ✅ | ✅ |
| WC-20 | Direction filter (All / Sent / Received) filters messages correctly | ✅ | ✅ |
| WC-21 | Text search (Cmd+F): match counter shows N results, prev/next navigation highlights matches | ✅ | ✅ |
| WC-22 | Click message row → detail panel opens with JSON / Raw / Hex tabs | ✅ | ✅ |
| WC-23 | Clear button removes all messages from log; counters reset to 0 | ✅ | ✅ |
| WC-24 | Export messages as JSON via toolbar button (Tauri: native save dialog) | ✅ | ✅ |

#### Saved Connection Profiles (6 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-25 | Saved Connections tab: list is empty initially with "No saved connections" message | No | No |
| WC-26 | Save current connection as profile (name, URL, headers, query params, subprotocol) | ✅ | ✅ |
| WC-27 | Load profile → fills URL, headers, query params, subprotocol into connect form | No | No |
| WC-28 | Delete profile → removed from list with confirmation | No | No |
| WC-29 | Import/Export profiles: export JSON, clear all, import JSON → profiles restored | No | No |
| WC-30 | Config lock: editing connection fields disabled while connected; must disconnect first | ✅ | ✅ |

#### Message Templates (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-31 | Save message template: name + body + format; appears in template list | No | No |
| WC-32 | Load template → fills compose bar with saved body + format | No | No |
| WC-33 | Delete template from list; "No saved templates" when empty | No | No |
| WC-34 | Templates persist across page reload (localStorage / Tauri FS) | No | No |
| WC-35 | Template selector dropdown in compose bar lists saved templates | No | No |

#### Auto-Reconnect (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-36 | Auto-reconnect setting: None / Immediate / Backoff (configurable in profile) | No | No |
| WC-37 | Disconnect echo server → auto-reconnect triggers with backoff badge visible | ✅ | ✅ |
| WC-38 | Close with code/reason: custom close code (1000) + reason text sent on disconnect | ✅ | ✅ |
| WC-39 | Reconnect controls: "Reconnecting in Xs" badge, Retry Now button, Cancel button | ✅ | ✅ |

#### Environment Variable Interpolation (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-40 | URL with `{{wsBaseUrl}}` placeholder → resolved preview shown below URL input | No | No |
| WC-41 | Select environment from AppHeader → `{{baseUrl}}`, `{{host}}`, `{{envName}}` resolve correctly | No | No |
| WC-42 | Unresolved variable warning shown when no environment selected | No | No |
| WC-43 | Profiles store raw templates — resolved at connect time from current env context | No | No |

#### Virtualized Message Log (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WC-44 | Send 1000+ messages rapidly → log remains smooth, no DOM explosion (virtual rendering) | ✅ | ✅ |
| WC-45 | Message cap (10,000): oldest messages evicted when cap reached; count shows cap indicator | ✅ | ✅ |
| WC-46 | Profile editor: configurable cap (100 / 500 / 1,000 / 10,000 / 50,000) | No | No |

---

## File 2: `ws-protocols-transport-test-scenarios.md`

**Covers:** Phases 3, 6 — Protocol Support (Socket.IO, STOMP, GraphQL-WS), TLS/mTLS, Tauri Native Transport
**Navigation:** Left activity bar → **Protocols** → **WebSocket** → Connect view (protocol selector + TLS panel)
**Docker:** Echo server + Socket.IO server + RabbitMQ/STOMP + GraphQL subscription server
**Priority:** High — protocol correctness is critical for real-world use

### Scenario Breakdown

#### Protocol Detection & Selector (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WP-01 | Protocol selector dropdown: Raw / Socket.IO / STOMP / GraphQL-WS / Auto-detect | No | No |
| WP-02 | Auto-detect from URL: `/socket.io/` → Socket.IO; `/stomp` → STOMP; `graphql-transport-ws` subprotocol → GraphQL-WS | No | No |
| WP-03 | Auto-detect from first message: EIO open packet → Socket.IO; STOMP CONNECTED → STOMP | ✅ | ✅ |

#### Socket.IO v4 (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WP-04 | Connect to Socket.IO server → EIO handshake (open packet), auto-upgrade, connected state | ✅ | ✅ |
| WP-05 | Send Socket.IO event → encoded as `42["eventName", data]`; response decoded correctly | ✅ | ✅ |
| WP-06 | Ping/Pong: EIO ping interval + timeout displayed; auto-pong responses (visible with system frames) | ✅ | ✅ |
| WP-07 | Disconnect from Socket.IO server → clean close with SIO disconnect packet | ✅ | ✅ |

#### STOMP (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WP-08 | Connect to STOMP server → auto-CONNECT frame sent, CONNECTED frame received with server version | ✅ | ✅ |
| WP-09 | SUBSCRIBE to destination → messages received; MESSAGE frame decoded with headers + body | ✅ | ✅ |
| WP-10 | SEND message to destination → STOMP frame serialized correctly | ✅ | ✅ |
| WP-11 | Heart-beat negotiation: client/server heart-beat values displayed | ✅ | ✅ |

#### GraphQL-WS (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WP-12 | Connect with `graphql-transport-ws` subprotocol → `connection_init` sent, `connection_ack` received | ✅ | ✅ |
| WP-13 | Send `subscribe` operation with query → `next` messages received with subscription data | ✅ | ✅ |
| WP-14 | Operation name displayed in compose UI | ✅ | ✅ |
| WP-15 | Complete subscription → `complete` message sent/received cleanly | ✅ | ✅ |

#### TLS / mTLS (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WP-16 | TLS panel: CA certificate, client cert, client key file inputs visible | No | No |
| WP-17 | `rejectUnauthorized` toggle controls strict cert validation | No | No |
| WP-18 | Proxy-only banner: TLS config only applies in server-proxy mode (not direct browser WS) | No | No |

#### Tauri Native Transport (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WP-19 | Desktop mode: connection uses `tokio-tungstenite` (no Express proxy); messages arrive via Tauri events | ✅ | N/A |
| WP-20 | Desktop mode: `ws_connect` / `ws_disconnect` / `ws_send` / `ws_ping` / `ws_status` Rust commands work | ✅ | N/A |
| WP-21 | Desktop mode: TLS/mTLS config applied via `rustls` (same behavior as proxy mode) | ✅ | N/A |
| WP-22 | Browser mode: direct WebSocket when no custom headers; server proxy when headers needed | ✅ | ✅ |
| WP-23 | Transport parity: same message sequence produces identical log entries across both transports | ✅ | ✅ |

---

## File 3: `ws-tabs-persistence-test-scenarios.md`

**Covers:** Phases 9, 10, 11, 12, 13 — Multiple Connections, Tab Persistence, History, Bookmarks, Recording/Replay, Stats, Drag/Keyboard
**Navigation:** Left activity bar → **Protocols** → **WebSocket** → tab bar + view tabs
**Docker:** Echo server (port 8765)
**Priority:** High — core UX features

### Scenario Breakdown

#### Multiple Concurrent Connections — Phase 9 (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-01 | Click "+" to add tabs up to 8; 9th tab blocked with max-tabs message | No | No |
| WT-02 | Each tab has independent connection state (connect tab 1, tab 2 stays disconnected) | ✅ | ✅ |
| WT-03 | Background tab stays connected: connect tab 1, switch to tab 2, switch back → tab 1 still connected with messages | ✅ | ✅ |
| WT-04 | Close tab: confirmation for connected tabs; disconnects and removes tab | ✅ | ✅ |
| WT-05 | Tab auto-label from URL (e.g., `localhost:8765`); double-click to rename | ✅ | ✅ |

#### Tab Persistence — Phase 10.1 (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-06 | Navigate away (Kafka page) and back → all tabs restored with correct labels, URLs, view positions | No | No |
| WT-07 | Restored tabs start disconnected (connections not resumable) but show previously-typed URL | No | No |
| WT-08 | Close app and reopen (Tauri) → tabs restored from Tauri FS persistence | ✅ | N/A |
| WT-09 | Rename a tab → name persists across navigation | No | No |
| WT-10 | Storage migration: first visit with no saved state → default single "New Connection" tab created | No | No |

#### Connection History — Phase 10.2 (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-11 | Connect to echo server → URL appears in history dropdown (▾ trigger next to URL input) | ✅ | ✅ |
| WT-12 | History dropdown: each row shows URL, protocol badge, relative timestamp ("2 min ago") | ✅ | ✅ |
| WT-13 | Click history row → fills URL + sets protocol mode; dropdown closes | ✅ | ✅ |
| WT-14 | "Clear History" button at dropdown bottom → all entries removed; trigger hidden | ✅ | ✅ |
| WT-15 | History is global: connect from tab 1 → history visible in tab 2 dropdown | ✅ | ✅ |

#### Quick Connect from Tab Bar — Phase 10.3 (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-16 | Dropdown arrow (▾) next to "+" shows recent URLs from history | ✅ | ✅ |
| WT-17 | Click URL in tab bar dropdown → new tab created with pre-filled URL | ✅ | ✅ |
| WT-18 | No history → ▾ arrow hidden; only "+" button shown | No | No |

#### Message Bookmarks — Phase 11.1 (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-19 | Click star icon (☆) on message row → fills to ★, row highlighted | ✅ | ✅ |
| WT-20 | Click star again → bookmark removed (★ → ☆) | ✅ | ✅ |
| WT-21 | Direction filter: "Bookmarked (N)" option → only bookmarked messages shown | ✅ | ✅ |
| WT-22 | Clear messages → bookmarks preserved; "Bookmarked" filter still works | ✅ | ✅ |
| WT-23 | Export messages → bookmarked messages have `bookmarked: true` flag in JSON | ✅ | ✅ |

#### Session Recording — Phase 11.2 (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-24 | Click Record button → red "REC" indicator with pulsing animation | ✅ | ✅ |
| WT-25 | Send/receive messages while recording → events captured with relative timestamps | ✅ | ✅ |
| WT-26 | Click Stop → `.wsrecording.json` file saved (Tauri: native save dialog; web: download) | ✅ | ✅ |
| WT-27 | Recording format: `_format: 'ws-recording-v1'`, metadata (url, protocol, duration, count), events array | No | No |

#### Session Replay — Phase 11.3 (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-28 | Import `.wsrecording.json` → replay controls appear (▶/⏸, speed, progress, ✕ Exit) | No | No |
| WT-29 | Play → messages appear at original pace; Speed 2×/5×/10× accelerates; Max = all at once | No | No |
| WT-30 | Pause/Resume toggle works mid-replay; progress counter updates correctly | No | No |
| WT-31 | Exit Replay → clears replayed messages, returns to normal mode; compose bar re-enabled | No | No |

#### Connection Stats Dashboard — Phase 12 (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-32 | Toggle "Stats" button in toolbar → collapsible stats panel appears below message log | ✅ | ✅ |
| WT-33 | Live metrics: Msg/s (↑+↓), Bytes In, Bytes Out, Frame type distribution bar | ✅ | ✅ |
| WT-34 | Sparkline shows 60-second rolling messages/sec history | ✅ | ✅ |
| WT-35 | Stats per-tab: each tab shows independent metrics; disconnect zeros rates | ✅ | ✅ |

#### Tab Drag-and-Drop Reorder — Phase 13.1 (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-36 | Drag tab to new position → tab bar reorders with drop indicator; order persists | No | No |
| WT-37 | Dragged tab has 40% opacity; drop position shown with accent box-shadow | No | No |
| WT-38 | Tab order preserved after navigation away and back | No | No |

#### Keyboard Navigation — Phase 13.2 (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WT-39 | Arrow Left/Right moves focus between tabs with visible focus ring | No | No |
| WT-40 | Enter/Space activates the focused tab; Home/End focus first/last tab | No | No |
| WT-41 | Delete key closes focused tab (with confirmation for connected tabs) | No | No |
| WT-42 | F2 key starts rename on focused tab; focus ring visible (keyboard-only) | No | No |

---

## File 4: `ws-filtering-diff-schema-test-scenarios.md`

**Covers:** Phases 14, 15, 19 — Advanced Filtering, Message Diff/Compare, Schema Validation
**Navigation:** Left activity bar → **Protocols** → **WebSocket** → Messages view (toolbar + filter bar + schema panel)
**Docker:** Echo server (port 8765) for generating message volume
**Priority:** Medium-High — power-user features

### Scenario Breakdown

#### Search Modes — Phase 14.1 (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WF-01 | Search mode pills: T (Text) / R (Regex) / JP (JSONPath); default = Text | No | No |
| WF-02 | Text mode: substring match, case-insensitive on message data (unchanged from Phase 1) | ✅ | ✅ |
| WF-03 | Regex mode: valid regex filters messages; invalid regex shows red border + "Invalid regex" tooltip | ✅ | ✅ |
| WF-04 | JSONPath mode: `$.type` matches messages with that path; `$.type=error` matches exact value | ✅ | ✅ |
| WF-05 | Match counter: "{N} of {M}" shown next to search input; updates as messages arrive | ✅ | ✅ |

#### Attribute Filters — Phase 14.2 (6 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WF-06 | Filter bar: toggle via "Filters" button in toolbar; auto-shows when preset applied | No | No |
| WF-07 | Size filter dropdown: All / < 1KB / 1–10KB / > 10KB — filters by `m.size` bytes | ✅ | ✅ |
| WF-08 | Time filter dropdown: All / Last 30s / Last 5m / Last 30m — shows only messages in time window | ✅ | ✅ |
| WF-09 | Content type filter: All / JSON / Text / Binary / Control — correctly categorizes messages | ✅ | ✅ |
| WF-10 | Filter composition: direction + size + time + content type + search all compose correctly | ✅ | ✅ |
| WF-11 | Active filter count badge on "Filters" button; "Clear" link resets all to default | No | No |

#### Saved Filter Presets — Phase 14.3 (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WF-12 | "Save current" button → name prompt → preset saved; appears in presets dropdown | No | No |
| WF-13 | Click preset → restores all filter fields (search mode, query, attribute filters) | No | No |
| WF-14 | Delete preset (× button); presets persist across page reload (max 20, global) | No | No |

#### Two-Message Diff — Phase 15.1 (6 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WF-15 | "Compare" toolbar button toggles compare mode; banner: "Select two messages to compare" | ✅ | ✅ |
| WF-16 | Click message A → blue "A" badge; click message B → blue "B" badge → diff modal auto-opens | ✅ | ✅ |
| WF-17 | Diff modal: side-by-side JSON with line-level highlighting (green=added, red=removed) | ✅ | ✅ |
| WF-18 | JSON summary header: structural changes by path (added/removed/changed with counts) | ✅ | ✅ |
| WF-19 | "Swap sides" button flips left/right; "Copy diff" produces unified diff format | ✅ | ✅ |
| WF-20 | Close diff modal → exits compare mode, clears A/B selection | ✅ | ✅ |

#### Quick Diff — Phase 15.2 (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WF-21 | Detail panel: "Diff ↑" / "Diff ↓" buttons for adjacent same-direction messages | ✅ | ✅ |
| WF-22 | Click "Diff ↑" → diff modal opens pre-loaded with current + previous message | ✅ | ✅ |
| WF-23 | Keyboard shortcut: `D` within message list opens diff with previous same-direction message | ✅ | ✅ |

#### Schema Management — Phase 19.1 (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WF-24 | "Schema" toolbar button toggles collapsible schema panel | No | No |
| WF-25 | Add schema: paste JSON Schema + name + direction (sent/received/both) + enabled toggle | No | No |
| WF-26 | Edit schema → re-opens editor with existing content; Delete with confirmation | No | No |
| WF-27 | Max 20 schemas per session; validation on paste (invalid JSON Schema rejected) | No | No |

#### Real-Time Validation — Phase 19.2 (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WF-28 | Enable validation + add schema → messages show ✓ (green) or ✗ (red) badge on each row | ✅ | ✅ |
| WF-29 | Click message with ✗ → detail panel "Validation" tab shows schema name, errors with JSONPath + message | ✅ | ✅ |
| WF-30 | Validation filter dropdown: All / Valid / Invalid — filters messages by validation status | ✅ | ✅ |
| WF-31 | Performance: validation does not degrade log scrolling (< 1ms per message with compiled schema) | ✅ | ✅ |

#### Schema Generation — Phase 19.3 (2 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WF-32 | "Generate" button: analyzes JSON messages → produces inferred schema in editor for review | ✅ | ✅ |
| WF-33 | Generated schema uses multi-sample inference (union required fields, merge property types) | ✅ | ✅ |

---

## File 5: `ws-mock-server-test-scenarios.md`

**Covers:** Phase 16 — WebSocket Mock Server (Express-hosted)
**Navigation:** Left activity bar → **Protocols** → **WebSocket** → **Mock** view tab (4th view tab)
**Docker:** Echo server (optional, for meta-testing); **Requires:** `npm run dev:server` for Express companion
**Priority:** Medium-High — enables frontend development without real backends

### Scenario Breakdown

#### Mock Server Core — Phase 16.1 (7 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WM-01 | "Mock" view tab visible in every connection tab; shows Start/Stop toggle | No | ✅ |
| WM-02 | Configure port (default 9876, valid range 1024–65535); port conflict detection | No | ✅ |
| WM-03 | Start mock server → status indicator changes to "Running" (green); external client can connect to `ws://localhost:9876` | No | ✅ |
| WM-04 | Auto-echo mode: mock server echoes every received message back to sender | No | ✅ |
| WM-05 | Connected client list: client ID, connected-at timestamp, message count per client | No | ✅ |
| WM-06 | Activity log: scrollable list showing connect/disconnect/message-in/response-out events | No | ✅ |
| WM-07 | Stop mock server → all clients disconnected with code 1001 (Going Away); status = Stopped | No | ✅ |

#### Broadcast (2 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WM-08 | Broadcast message → sent to all connected clients simultaneously | No | ✅ |
| WM-09 | Broadcast with no connected clients → no error; activity log shows broadcast event | No | ✅ |

#### Response Rules Engine — Phase 16.2 (7 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WM-10 | Add rule: match condition (exact/contains/regex/JSONPath/any) + response action (static/echo/template/close) | No | ✅ |
| WM-11 | Rule priority: ▲/▼ reorder buttons; first-match-wins evaluation | No | ✅ |
| WM-12 | Delay per-rule (0–10000ms): delayed response arrives after configured delay | No | ✅ |
| WM-13 | Template variables: `{{message}}`, `{{timestamp}}`, `{{clientId}}`, `{{counter}}` expand correctly in responses | No | ✅ |
| WM-14 | Fallback mode: echo / ignore / close when no rules match | No | ✅ |
| WM-15 | Enable/Disable toggle per rule; disabled rules skipped during evaluation | No | ✅ |
| WM-16 | Rule test preview: type sample message → shows matched rule + response preview (no server needed) | No | No |

#### Live Rule Sync & Persistence (2 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WM-17 | Edit rules while server running → auto-pushed to server; new messages evaluated against updated rules | No | ✅ |
| WM-18 | Rules persist in `websocketStorage.ts` → survive page reload | No | No |

#### Meta-Testing (1 scenario)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WM-19 | Open tab 2, connect to `ws://localhost:9876` (own mock server) → send/receive messages between RedfireForge tabs | No | ✅ |

---

## File 6: `ws-load-test-scenarios.md`

**Covers:** Phase 17 — Load & Stress Testing
**Navigation:** Left activity bar → **Protocols** → **WebSocket** → Messages view → "Load Test" toolbar button
**Docker:** Echo server (port 8765) for load testing target
**Priority:** Medium — desk-check performance validation

### Scenario Breakdown

#### Load Test Configuration — Phase 17.1 (6 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WL-01 | "Load Test" toolbar button toggles load test panel below message log | ✅ | ✅ |
| WL-02 | Must be connected first; Start button disabled when disconnected or template empty | ✅ | ✅ |
| WL-03 | Message template with `{{counter}}`, `{{timestamp}}`, `{{random}}` placeholders | No | No |
| WL-04 | Load profile selector: Constant rate / Ramp-up / Burst (pill selector) | No | No |
| WL-05 | Duration presets: 5s / 10s / 15s / 30s / 60s + custom input | No | No |
| WL-06 | Safety limits: max 1,000 msg/s, max 60s, max 60,000 burst messages; confirmation for >100 msg/s | No | No |

#### Real-Time Metrics — Phase 17.2 (5 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WL-07 | Start constant-rate test → progress bar + live counters (sent/received/elapsed/errors) update in real time | ✅ | ✅ |
| WL-08 | Ramp-up profile: send rate gradually increases from start rate to end rate | ✅ | ✅ |
| WL-09 | Burst profile: sends N messages as fast as possible (batched 50/tick) | ✅ | ✅ |
| WL-10 | Stop button halts test mid-run; partial results produced | ✅ | ✅ |
| WL-11 | Auto-stop on connection disconnect; partial results with actual metrics | ✅ | ✅ |

#### Results Summary (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| WL-12 | Results summary: total sent/received, duration, avg send rate, errors | ✅ | ✅ |
| WL-13 | Latency percentiles: min / mean / p50 / p95 / p99 / max (for echo servers) | ✅ | ✅ |
| WL-14 | Latency histogram: bucketed bar chart (0-1ms, 1-2ms, ..., >5000ms) | ✅ | ✅ |
| WL-15 | Export results as JSON; "New Test" button clears results for fresh configuration | ✅ | ✅ |

---

## File 7: `sse-studio-test-scenarios.md`

**Covers:** Phase 18 — SSE (Server-Sent Events) Support
**Navigation:** Left activity bar → **Protocols** → **SSE** domain sub-nav entry
**Docker:** SSE test server (or simple Node.js SSE endpoint)
**Priority:** Medium — growing SSE adoption for LLM streaming APIs

### Scenario Breakdown

#### Navigation & Connection (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| SE-01 | Protocols sub-nav: "SSE" entry alongside Kafka and WebSocket | No | No |
| SE-02 | SSE Studio page: URL input, headers (key-value), Connect/Disconnect buttons | No | No |
| SE-03 | Connect to SSE endpoint → events appear in message log with type badges | ✅ | ✅ |
| SE-04 | Custom headers via fetch-based implementation (not EventSource API) | ✅ | ✅ |

#### Event Log (4 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| SE-05 | Virtualized event list: event type badge (color-coded), data preview (truncated), timestamp | ✅ | ✅ |
| SE-06 | Click event row → detail panel with full data, event type, ID, retry value | ✅ | ✅ |
| SE-07 | JSON events: auto-detected and pretty-printed in detail panel | ✅ | ✅ |
| SE-08 | Clear messages button; Export events as JSON | ✅ | ✅ |

#### Filtering & Bookmarks (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| SE-09 | Text search across event data | ✅ | ✅ |
| SE-10 | Event type filter: All + auto-populated from received event types | ✅ | ✅ |
| SE-11 | Toggle bookmark on events; filter to show only bookmarked events | ✅ | ✅ |

#### Auto-Reconnect & Stats (3 scenarios)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| SE-12 | Auto-reconnect with `Last-Event-ID` header on disconnect; configurable retry delay | ✅ | ✅ |
| SE-13 | Last-Event-ID displayed in status bar | ✅ | ✅ |
| SE-14 | Connection stats: event count, events/sec, uptime, event type breakdown | ✅ | ✅ |

#### Environment Variable Interpolation (1 scenario)

| ID | Scenario | Docker | Server |
|---|---|---|---|
| SE-15 | URL with `{{baseUrl}}` placeholder resolves from AppHeader env selection | No | No |

---

## Docker Setup Reference

All test-scenarios files share the following Docker infrastructure:

```bash
# Start echo server (core testing — Files 1, 3, 4, 6)
docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
# Connect to: ws://localhost:8765

# Start Socket.IO echo server (File 2 — protocol tests)
cd docker/websocket/socketio && docker compose up -d
# Connect to: ws://localhost:3001 (protocol: Socket.IO)

# Start RabbitMQ + STOMP (File 2 — protocol tests)
cd docker/websocket/stomp && docker compose up -d
# Connect to: ws://localhost:15674/ws (protocol: STOMP)

# Start GraphQL subscription server (File 2 — protocol tests)
cd docker/websocket/graphql && docker compose up -d
# Connect to: ws://localhost:4000/graphql (protocol: GraphQL-WS)

# Start backend server (needed for proxy mode + mock server)
npm run dev:server

# Start frontend dev server
npm run dev
```

| Service | Port | Used by |
|---|---|---|
| Echo server | `ws://localhost:8765` | Files 1, 3, 4, 6 |
| Socket.IO server | `ws://localhost:3001` | File 2 (WP-04–WP-07) |
| RabbitMQ / STOMP | `ws://localhost:15674/ws` | File 2 (WP-08–WP-11) |
| GraphQL-WS server | `ws://localhost:4000/graphql` | File 2 (WP-12–WP-15) |
| Mock server (built-in) | `ws://localhost:9876` | File 5 (WM-*) |
| Backend server | `http://localhost:3001` | Files 1–6 (Server column) |
| Frontend (Vite) | `http://localhost:5173` | All files |

---

## Execution Order

Recommended order for writing and validating these files:

```
1. ws-core-connect-test-scenarios.md              (WC-01 → WC-46)   Pending — ~46 scenarios
2. ws-protocols-transport-test-scenarios.md        (WP-01 → WP-23)   Pending — ~23 scenarios
3. ws-tabs-persistence-test-scenarios.md           (WT-01 → WT-42)   Pending — ~42 scenarios
4. ws-filtering-diff-schema-test-scenarios.md      (WF-01 → WF-33)   Pending — ~33 scenarios
5. ws-mock-server-test-scenarios.md                (WM-01 → WM-19)   Pending — ~19 scenarios
6. ws-load-test-scenarios.md                       (WL-01 → WL-15)   Pending — ~15 scenarios
7. sse-studio-test-scenarios.md                    (SE-01 → SE-15)   Pending — ~15 scenarios
```

Each file should be completed end-to-end before moving to the next:
write MD → manual Docker validation → fix bugs → export data → reimport validation → user review.

---

## Relationship to Plan Phases

| Test Scenarios File | WS Plan Phases | Scenario ID Prefix | Est. Count |
|---|---|---|---|
| `ws-core-connect-test-scenarios.md` | 1, 2, 7, 8 | WC-* | ~46 |
| `ws-protocols-transport-test-scenarios.md` | 3, 6 | WP-* | ~23 |
| `ws-tabs-persistence-test-scenarios.md` | 9, 10, 11, 12, 13 | WT-* | ~42 |
| `ws-filtering-diff-schema-test-scenarios.md` | 14, 15, 19 | WF-* | ~33 |
| `ws-mock-server-test-scenarios.md` | 16 | WM-* | ~19 |
| `ws-load-test-scenarios.md` | 17 | WL-* | ~15 |
| `sse-studio-test-scenarios.md` | 18 | SE-* | ~15 |
| **Total** | **1–19** | | **~193** |

---

## Coverage Cross-Reference: WS Plan Phase → Test Scenarios File

Every completed phase from `websocket-studio-plan.md` must be covered by at least one test-scenarios file:

| Phase | Description | Covered By |
|---|---|---|
| Phase 1 — Core Connect & Send/Receive | URL input, connect/disconnect, compose bar, message log, search, server proxy | `ws-core-connect` WC-01–WC-24 |
| Phase 2A — Saved Connection Profiles | CRUD, import/export, JSON paste, config lock | `ws-core-connect` WC-25–WC-30 |
| Phase 2B — Message Templates | Save/load/delete, format selector, detail panel | `ws-core-connect` WC-31–WC-35 |
| Phase 2C — Auto-Reconnect | None/immediate/backoff, close with code/reason | `ws-core-connect` WC-36–WC-39 |
| Phase 3A — Protocol Detection | Registry, URL/subprotocol/message heuristics | `ws-protocols-transport` WP-01–WP-03 |
| Phase 3B — Socket.IO v4 | EIO negotiation, events, ping/pong | `ws-protocols-transport` WP-04–WP-07 |
| Phase 3C — STOMP | CONNECT, SUBSCRIBE, SEND, heart-beat | `ws-protocols-transport` WP-08–WP-11 |
| Phase 3D — TLS/mTLS | Certificate config, rejectUnauthorized | `ws-protocols-transport` WP-16–WP-18 |
| Phase 3E — GraphQL-WS | connection_init, subscribe, next, complete | `ws-protocols-transport` WP-12–WP-15 |
| Phase 6 — Tauri Native Transport | tokio-tungstenite, TS bridge, event-driven | `ws-protocols-transport` WP-19–WP-23 |
| Phase 7 — Env Variable Interpolation | `{{baseUrl}}`, `{{wsBaseUrl}}`, resolved preview | `ws-core-connect` WC-40–WC-43 |
| Phase 8 — Virtualized Message Log | Virtual rendering, 10k cap, export | `ws-core-connect` WC-44–WC-46 |
| Phase 9 — Multiple Concurrent Connections | Tabbed connections (max 8), independent state | `ws-tabs-persistence` WT-01–WT-05 |
| Phase 10.1 — Tab Persistence | Persist tabs across navigation, app restarts | `ws-tabs-persistence` WT-06–WT-10 |
| Phase 10.2 — Connection History | Recent URLs dropdown, clear history | `ws-tabs-persistence` WT-11–WT-15 |
| Phase 10.3 — Quick Connect from Tab Bar | Tab bar dropdown for quick URL tab creation | `ws-tabs-persistence` WT-16–WT-18 |
| Phase 11.1 — Message Bookmarks | Star toggle, bookmark filter, survive clear | `ws-tabs-persistence` WT-19–WT-23 |
| Phase 11.2 — Session Recording | Record toggle, capture events, save file | `ws-tabs-persistence` WT-24–WT-27 |
| Phase 11.3 — Session Replay | Import, play/pause, speed control, exit | `ws-tabs-persistence` WT-28–WT-31 |
| Phase 12 — Connection Stats Dashboard | Sparklines, byte rates, frame distribution | `ws-tabs-persistence` WT-32–WT-35 |
| Phase 13.1 — Tab Drag-and-Drop Reorder | Drag indicator, persist order | `ws-tabs-persistence` WT-36–WT-38 |
| Phase 13.2 — Keyboard Navigation | Arrow keys, Home/End, Enter/Space, Delete, F2 | `ws-tabs-persistence` WT-39–WT-42 |
| Phase 14.1 — Regex & JSONPath Search | Text/Regex/JSONPath modes, match counter | `ws-filtering-diff-schema` WF-01–WF-05 |
| Phase 14.2 — Attribute Filters | Size, time, content type, composition | `ws-filtering-diff-schema` WF-06–WF-11 |
| Phase 14.3 — Saved Filter Presets | Save/recall/delete presets, global | `ws-filtering-diff-schema` WF-12–WF-14 |
| Phase 15.1 — Two-Message Diff | Compare mode, A/B selection, diff modal | `ws-filtering-diff-schema` WF-15–WF-20 |
| Phase 15.2 — Quick Diff | Diff ↑/↓ buttons, D shortcut | `ws-filtering-diff-schema` WF-21–WF-23 |
| Phase 16.1 — Mock Server Core | Start/stop, echo mode, client list, activity log | `ws-mock-server` WM-01–WM-09 |
| Phase 16.2 — Response Rules Engine | Match/response rules, delay, template vars | `ws-mock-server` WM-10–WM-19 |
| Phase 17.1 — Load Test Configuration | Profiles, duration, safety limits | `ws-load-test` WL-01–WL-06 |
| Phase 17.2 — Real-Time Results | Progress, metrics, histogram, export | `ws-load-test` WL-07–WL-15 |
| Phase 18.1 — SSE Connection & Log | Fetch+ReadableStream, virtualized log | `sse-studio` SE-01–SE-08 |
| Phase 18.2 — SSE Event Filtering | Search, type filter, detail panel | `sse-studio` SE-09–SE-11 |
| Phase 18.3 — SSE-Specific Features | Auto-reconnect, Last-Event-ID, stats | `sse-studio` SE-12–SE-15 |
| Phase 19.1 — Schema Management | Add/edit/delete schemas, direction, toggle | `ws-filtering-diff-schema` WF-24–WF-27 |
| Phase 19.2 — Real-Time Validation | ✓/✗ badges, validation tab, filter | `ws-filtering-diff-schema` WF-28–WF-31 |
| Phase 19.3 — Schema Generation | Infer schema from messages | `ws-filtering-diff-schema` WF-32–WF-33 |

**Note:** Phases 4 (Workflow Integration) and 5 (Runner & Assertions) are engine/harness features with 800+ unit tests. They are not included in visual test scenarios because they require full workflow + test runner UI flows that are already covered by the existing test infrastructure. If visual workflow test scenarios are needed, a separate `ws-workflow-runner-test-scenarios.md` file would be added.

---

## Bugs Found & Fixed During Testing

| Date | File | Bug | Root Cause | Fix |
|---|---|---|---|---|
| *(populated during testing)* | | | | |
