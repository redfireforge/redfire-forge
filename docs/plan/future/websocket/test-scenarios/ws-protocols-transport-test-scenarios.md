# WebSocket Protocols & Transport Test Scenarios

> **File:** `ws-protocols-transport-test-scenarios.md`
> **Covers:** Phases 3, 6 — Protocol Support (Socket.IO, STOMP, GraphQL-WS), TLS/mTLS, Tauri Native Transport
> **Created:** 2026-06-10
> **Last verified:** 2026-06-13 (Chrome E2E 28/28, macOS — Docker containers required for protocol tests)
> **E2E files:** `ws-protocols-transport.spec.ts` (11), `ws-protocols-console.spec.ts` (5), `ws-protocols-socketio.spec.ts` (4), `ws-protocols-stomp.spec.ts` (4), `ws-protocols-graphql.spec.ts` (4)
> **Tested on:** Web (Chrome), Tauri (macOS)
> **Docker:** Echo server + Socket.IO + RabbitMQ/STOMP + GraphQL subscription server
>
> **2026-06-12 — Shell-IA doc refresh:** "Connect view" is now the **Connect left-pane tab** (Connect | Params | Auth | Headers | Compose) in the Client-mode split-pane shell. The protocol selector and TLS config live on this Connect left tab. Visual re-validation deferred to the merge gate.
>
> **2026-06-12 — Secure `wss://` campaign:** Full TLS matrix verified across all three transports (browser direct, browser proxy, Tauri native) plus a public echo endpoint — see **Secure WebSocket (wss://) — Verified Transport × TLS Matrix** (WP-24…WP-30) and **Bugs Found During Testing** below. Two fixes landed: a rustls `CryptoProvider` install (native wss no longer panics) and a CA→leaf cert chain in `generate-cert.sh`.

---

## Before You Start

### Docker Setup

```bash
# Echo server (basic testing)
docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server

# Socket.IO echo server (WP-04 to WP-07)
cd docker/websocket/socketio && docker compose up -d
# → ws://localhost:3001

# RabbitMQ + STOMP (WP-08 to WP-11)
cd docker/websocket/stomp && docker compose up -d
# → ws://localhost:15674/ws

# GraphQL-WS server (WP-12 to WP-15)
cd docker/websocket/graphql && docker compose up -d
# → ws://localhost:4000/graphql

# Secure WebSocket (wss://) TLS stack — WP-16 to WP-30
# nginx TLS-terminating reverse proxy in front of a jmalloc echo backend.
bash docker/websocket/generate-cert.sh          # generates ca.crt + server leaf (CA→leaf chain)
docker compose -f docker/websocket/docker-compose.tls.yml up -d
# → wss://localhost:8766  (leaf CN=localhost, issued by "RedfireForge Dev Root CA")
# Paste docker/websocket/certs/ca.crt into the TLS panel "CA Certificate (PEM)" field.
```

> **Why a CA→leaf chain (not a single self-signed cert)?** rustls/webpki (the
> Tauri native transport) rejects a `CA:TRUE` cert used directly as the server
> cert with `CaUsedAsEndEntity`. `generate-cert.sh` therefore mints a root CA
> plus a proper end-entity leaf (`CA:FALSE`, SAN `localhost`) signed by it, so
> the custom-CA validation path can be exercised across all transports.

### Dev Servers

```bash
npm run dev          # Frontend → http://localhost:5173
npm run server       # Backend (proxy mode)
```

### Navigation

1. Open **http://localhost:5173** → **Protocols** → **WebSocket**
2. Protocol selector is on the **Connect** left-pane tab, below the URL input

---

## Protocol Detection & Selector

### WP-01: Protocol selector dropdown

**Goal:** Verify protocol selector options

**Steps:**
1. Navigate to WebSocket Studio → **Connect** left-pane tab
2. Find the "Protocol" section
3. Click the protocol dropdown

**Expected Results:**
- [ ] Dropdown shows five options: **Auto-detect** (default) | **Raw** | **Socket.IO** | **STOMP** | **GraphQL-WS**
- [ ] "Auto-detect" is selected by default
- [ ] Selection is saved with connection profiles

---

### WP-02: Auto-detect from URL patterns

**Goal:** Verify URL-based protocol auto-detection

**Steps:**
1. Set protocol to "Auto-detect"
2. Enter URL: `ws://localhost:3001/socket.io/?EIO=4&transport=websocket`
3. Observe protocol indicator
4. Try URL: `ws://localhost:15674/ws` (STOMP)
5. Try URL with `graphql-transport-ws` subprotocol

**Expected Results:**
- [ ] `/socket.io/` in URL → Socket.IO codec detected
- [ ] `/stomp` or `/ws` with STOMP port → STOMP codec considered
- [ ] `graphql-transport-ws` subprotocol → GraphQL-WS codec selected
- [ ] Detection happens before or after first message exchange

---

### WP-03: Auto-detect from first message

**Goal:** Verify message-based protocol auto-detection

**Steps:**
1. Set protocol to "Auto-detect"
2. Connect to Socket.IO server → observe first received packet

**Expected Results:**
- [ ] EIO open packet (e.g., `0{"sid":"...","upgrades":[],...}`) → Socket.IO detected
- [ ] STOMP CONNECTED frame → STOMP detected
- [ ] Protocol badge/indicator updates to show detected protocol

---

## Socket.IO v4

### WP-04: Connect to Socket.IO server

**Goal:** Verify Socket.IO EIO handshake

**Steps:**
1. Select protocol: **Socket.IO** (or Auto-detect)
2. Enter URL: `ws://localhost:3001/socket.io/?EIO=4&transport=websocket`
3. Click **Connect**

**Expected Results:**
- [x] EIO handshake succeeds: open packet received with `sid`, `pingInterval`, `pingTimeout`
- [x] Status transitions to Connected
- [x] System message shows Socket.IO connection details
- [x] Message log shows decoded EIO/SIO packets (not raw wire format)

> ✅ **Automated:** `e2e/ws-protocols-socketio.spec.ts` — WP-04 (verified 2026-06-13)

---

### WP-05: Send Socket.IO event

**Goal:** Verify Socket.IO event encoding

**Steps:**
1. While connected to Socket.IO server
2. Type event payload (e.g., `["chat","Hello"]` or use SIO event form)
3. Click **Send**

**Expected Results:**
- [x] Message encoded as `42["chat","Hello"]` on the wire
- [x] Log shows decoded event name + data
- [x] Echo response decoded correctly
- [x] Type badge shows "sio" or "json" based on content

> ✅ **Automated:** `e2e/ws-protocols-socketio.spec.ts` — WP-05 (verified 2026-06-13)

---

### WP-06: Socket.IO Ping/Pong

**Goal:** Verify EIO heartbeat

**Steps:**
1. While connected to Socket.IO server, wait for ping interval (~25s default)
2. Observe system frames toggle to see ping/pong

**Expected Results:**
- [x] EIO ping (`2`) and pong (`3`) frames visible in log (when system frames enabled)
- [x] Ping interval and timeout values displayed in connection info
- [x] Connection stays alive through heartbeat cycle

> ✅ **Automated:** `e2e/ws-protocols-socketio.spec.ts` — WP-06 verifies server params from EIO open packet (verified 2026-06-13)

---

### WP-07: Disconnect from Socket.IO

**Goal:** Verify clean Socket.IO disconnect

**Steps:**
1. While connected, click **Disconnect**

**Expected Results:**
- [x] SIO disconnect packet sent before connection close
- [x] Clean disconnect without errors
- [x] Status returns to Disconnected

> ✅ **Automated:** `e2e/ws-protocols-socketio.spec.ts` — WP-07 (verified 2026-06-13)

---

## STOMP

### WP-08: Connect to STOMP server

**Goal:** Verify STOMP CONNECT frame

**Steps:**
1. Select protocol: **STOMP**
2. Enter URL: `ws://localhost:15674/ws`
3. Click **Connect**

**Expected Results:**
- [x] Auto-CONNECT frame sent with appropriate headers
- [x] CONNECTED frame received with server version info
- [x] System message confirms STOMP connection
- [x] Status shows Connected

> ✅ **Automated:** `e2e/ws-protocols-stomp.spec.ts` — WP-08 (verified 2026-06-13). Note: STOMP does NOT auto-send CONNECT — user sends CONNECT frame manually via Compose.

---

### WP-09: SUBSCRIBE to destination

**Goal:** Verify STOMP message subscription

**Steps:**
1. While connected to STOMP server
2. Send SUBSCRIBE frame with destination (e.g., `/queue/test`)
3. Publish a message to that destination

**Expected Results:**
- [x] MESSAGE frame received with headers (destination, content-type, etc.) and body
- [x] Log shows decoded STOMP frame with headers + body separated
- [x] Frame type displayed in message row

> ✅ **Automated:** `e2e/ws-protocols-stomp.spec.ts` — WP-09 (verified 2026-06-13)

---

### WP-10: SEND message to destination

**Goal:** Verify STOMP SEND frame serialization

**Steps:**
1. While connected, compose a STOMP SEND message
2. Include destination and body

**Expected Results:**
- [x] STOMP SEND frame serialized correctly with headers + body
- [x] Null byte terminator included
- [x] Server acknowledges if receipt requested

> ✅ **Automated:** `e2e/ws-protocols-stomp.spec.ts` — WP-10 verifies compose fields layout and command switching (verified 2026-06-13)

---

### WP-11: Heart-beat negotiation

**Goal:** Verify STOMP heart-beat values

**Steps:**
1. Connect to STOMP server
2. Observe CONNECTED frame heart-beat header

**Expected Results:**
- [x] Client heart-beat values sent in CONNECT frame
- [x] Server heart-beat values displayed from CONNECTED frame
- [x] Heart-beats visible in system frames when enabled

> ✅ **Automated:** `e2e/ws-protocols-stomp.spec.ts` — WP-11 verifies clean STOMP disconnect (verified 2026-06-13)

---

## GraphQL-WS

### WP-12: GraphQL-WS connection init

**Goal:** Verify graphql-transport-ws handshake

**Steps:**
1. Select protocol: **GraphQL-WS**
2. Enter URL: `ws://localhost:4000/graphql`
3. Set subprotocol: `graphql-transport-ws`
4. Click **Connect**

**Expected Results:**
- [x] `connection_init` message sent automatically
- [x] `connection_ack` response received
- [x] Status shows Connected
- [x] System message confirms GraphQL-WS connection

> ✅ **Automated:** `e2e/ws-protocols-graphql.spec.ts` — WP-12 (verified 2026-06-13). Requires `graphql-transport-ws` subprotocol.

---

### WP-13: GraphQL subscription

**Goal:** Verify GraphQL subscribe operation

**Steps:**
1. While connected, send a `subscribe` message with a GraphQL query
2. Example: `{"id":"1","type":"subscribe","payload":{"query":"subscription { messageAdded { text } }"}}`

**Expected Results:**
- [x] `subscribe` frame sent correctly
- [x] `next` messages received with subscription data
- [x] Decoded payload shown in message log
- [x] Subscription ID visible in message details

> ✅ **Automated:** `e2e/ws-protocols-graphql.spec.ts` — WP-13 tests countdown subscription with event-driven wait for `complete` (verified 2026-06-13)

---

### WP-14: Operation name in compose

**Goal:** Verify GraphQL operation name display

**Steps:**
1. Send a subscription with a named operation
2. Observe compose UI and log display

**Expected Results:**
- [x] Operation name displayed in compose bar or message detail
- [x] Named operations distinguishable in the log

> ✅ **Automated:** `e2e/ws-protocols-graphql.spec.ts` — WP-14 verifies Op ID auto-increment (`Op #1`, `Op #2`) (verified 2026-06-13)

---

### WP-15: Complete subscription

**Goal:** Verify GraphQL subscription completion

**Steps:**
1. While subscribed, send a `complete` message with the subscription ID
2. Example: `{"id":"1","type":"complete"}`

**Expected Results:**
- [x] `complete` message sent
- [x] Server acknowledges with `complete` response
- [x] Subscription ends cleanly
- [x] Connection remains open for new subscriptions

> ✅ **Automated:** `e2e/ws-protocols-graphql.spec.ts` — WP-15 verifies clean disconnect (verified 2026-06-13)

---

## TLS / mTLS

### WP-16: TLS panel UI elements

**Goal:** Verify TLS configuration panel

**Steps:**
1. On the **Connect** left-pane tab, look for TLS configuration section
2. Observe the available fields

**Expected Results:**
- [ ] CA certificate file input
- [ ] Client certificate file input
- [ ] Client key file input
- [ ] All inputs accept PEM file paths or content

---

### WP-17: rejectUnauthorized toggle

**Goal:** Verify strict cert validation toggle

**Steps:**
1. Find the `rejectUnauthorized` toggle in TLS settings
2. Toggle it on and off

**Expected Results:**
- [ ] Toggle controls strict certificate validation
- [ ] When off: self-signed certs accepted
- [ ] When on: invalid certs cause connection failure

---

### WP-18: Proxy-only banner for TLS

**Goal:** Verify TLS config scope indicator

**Steps:**
1. Observe the TLS configuration panel in browser mode

**Expected Results:**
- [ ] Banner or note: TLS config only applies in server-proxy mode
- [ ] Browser direct WebSocket uses browser's TLS stack
- [ ] Tauri native transport uses `rustls` with these settings

---

## Tauri Native Transport

### WP-19: Desktop mode uses tokio-tungstenite

**Goal:** Verify Tauri native transport activation

**Steps:**
1. Open the app in **Tauri desktop mode** (`npm run tauri:dev`)
2. Connect to `ws://localhost:8765`

**Expected Results:**
- [ ] Connection established via `tokio-tungstenite` (not browser WS or Express proxy)
- [ ] Messages arrive via Tauri events
- [ ] Transport indicator shows "native" mode

---

### WP-20: Tauri Rust commands

**Goal:** Verify all Rust WS commands work

**Steps:**
1. In Tauri desktop, test each operation:
   - Connect → sends via `ws_connect`
   - Disconnect → `ws_disconnect`
   - Send message → `ws_send`
   - Ping → `ws_ping`
   - Status check → `ws_status`

**Expected Results:**
- [ ] All Rust commands execute without errors
- [ ] Behavior identical to browser proxy mode
- [ ] No JavaScript WebSocket fallback used

---

### WP-21: Desktop TLS/mTLS via rustls

**Goal:** Verify Tauri TLS config application

**Steps:**
1. In Tauri desktop, configure TLS settings (CA cert, client cert, key)
2. Connect to a WSS endpoint

**Expected Results:**
- [x] TLS settings applied via `rustls` (`build_ws_connector` in `src-tauri/src/websocket/config.rs`)
- [x] Same behavior as proxy mode TLS (skip-cert connects; CA cert validates; default rejects untrusted)
- [x] Self-signed/dev certs work with `rejectUnauthorized: false`

> See the verified **WP-27 / WP-28 / WP-29** results in the matrix below for exact outcomes. Native wss requires the process-level rustls `CryptoProvider` installed at startup (see Bugs Found During Testing).

---

### WP-22: Browser transport mode selection

**Goal:** Verify automatic transport mode in browser

**Steps:**
1. In web browser, connect **without** custom headers → should use direct WebSocket
2. Add a custom header → should switch to server proxy

**Expected Results:**
- [ ] No headers: direct browser WebSocket (Ping disabled, no proxy overhead)
- [ ] With headers: server proxy mode (Ping enabled, headers forwarded)
- [ ] Transport mode reflected in UI (e.g., transport indicator or Ping button state)

---

### WP-23: Transport parity

**Goal:** Verify identical behavior across transports

**Steps:**
1. Send the same message sequence via:
   - Browser direct mode
   - Browser proxy mode
   - Tauri native mode
2. Compare message log entries

**Expected Results:**
- [ ] Same messages produce identical log entries across all transports
- [ ] Timestamps, sizes, and type badges match
- [ ] No data corruption or encoding differences

---

## Auth Tab — Protocol & Transport Interactions

### WP-A01: Auth tab renders with type selector

**Goal:** Verify Auth left-pane tab UI elements

**Steps:**
1. Navigate to WebSocket Studio → click **Auth** left-pane tab
2. Observe the auth type dropdown

**Expected Results:**
- [ ] Auth type selector shows: None | Inherit | Basic | Bearer | API Key | Digest | OAuth2
- [ ] "None" selected by default
- [ ] `data-testid="ws-auth-resolved"` preview area shows "No auth configured"

---

### WP-A02: Header auth forces proxy transport

**Goal:** Verify that header-based auth switches transport to proxy in browser mode

**Steps:**
1. Select auth type **Bearer** → enter a token value
2. Switch to **Connect** tab and observe the transport indicator

**Expected Results:**
- [ ] `data-testid="ws-auth-callout"` info callout appears: "Auth headers require proxy transport in browser mode"
- [ ] Transport is automatically set to **proxy** (badge shows "proxy")
- [ ] Switching back to **None** restores the default transport option

---

### WP-A03: Query auth works on all transports

**Goal:** Verify API Key in query param mode works without forcing proxy

**Steps:**
1. Select auth type **API Key** → set `apiKeyIn` to **query**
2. Enter `key` = `X-API-Key`, `value` = `test-secret`
3. Switch to Connect tab → observe URL preview or transport indicator

**Expected Results:**
- [ ] No browser callout shown (query params work on all transports)
- [ ] Transport stays at **direct** (not forced to proxy)
- [ ] `data-testid="ws-auth-resolved"` shows the masked query parameter preview

---

### WP-A04: Auth with Socket.IO protocol

**Goal:** Verify auth + Socket.IO compose interact correctly

**Steps:**
1. Set protocol to **Socket.IO** via the protocol selector
2. Switch to **Auth** tab → select **Bearer** → enter token
3. Switch to **Connect** tab and connect to `ws://localhost:3001` (Socket.IO Docker)

**Expected Results:**
- [ ] Connection uses proxy transport (header auth)
- [ ] Socket.IO handshake completes (Engine.IO upgrade → SIO connect)
- [ ] Auth headers are forwarded by the proxy to the Socket.IO server
- [ ] Protocol badge shows "Socket.IO" alongside "proxy" transport badge

---

### WP-A05: Auth with STOMP protocol (login/passcode via headers)

**Goal:** Verify STOMP server can receive auth credentials via headers

**Steps:**
1. Set protocol to **STOMP**
2. Set auth type **Basic** → username `guest`, password `guest`
3. Connect to `ws://localhost:15674/ws` (RabbitMQ STOMP Docker)

**Expected Results:**
- [ ] Connection uses proxy transport (basic auth → headers)
- [ ] STOMP CONNECTED frame received (RabbitMQ accepts guest/guest)
- [ ] Console shows lifecycle entry: "STOMP CONNECTED" or similar

---

### WP-A06: Auth with GraphQL-WS (connectionParams alternative)

**Goal:** Verify GraphQL-WS subscription works with bearer auth

**Steps:**
1. Set protocol to **GraphQL-WS**
2. Set auth type **Bearer** → enter token
3. Connect to `ws://localhost:4000/graphql` (GraphQL Docker)

**Expected Results:**
- [ ] Proxy transport used (bearer token in header)
- [ ] `connection_init` handshake → `connection_ack` received
- [ ] GraphQL subscriptions function normally with auth active

> **Note:** This app sends auth at the WebSocket transport level (HTTP headers via proxy). It does **not** inject auth into GraphQL's `connection_init` payload. Servers that require `connectionParams` auth must be configured to also accept header auth.

---

## Console — Protocol-Specific Behavior

### WP-C01: Console shows protocol lifecycle events

**Goal:** Verify Console logs connection lifecycle entries

**Steps:**
1. Set protocol to **Socket.IO** and connect to the Socket.IO Docker server
2. Switch to the **Console** right-pane tab (`data-testid="right-tab-console"`)
3. Observe entries as the connection establishes

**Expected Results:**
- [x] Console shows "Connecting to ws://..." entry (category: `lifecycle`)
- [x] Console shows "101 Switching Protocols" entry (category: `handshake`, expandable with curl-verbose headers)
- [x] Console shows "Connected (latency: ...ms)" entry (category: `lifecycle`)
- [x] Console entry count badge shows ≥ 3 entries
- [x] Categories `lifecycle` and `handshake` present in structured view

> ✅ **Automated:** `e2e/ws-protocols-console.spec.ts` — WP-C01 (verified 2026-06-13)
> **Note:** "Protocol detected" entry is NOT emitted for SIO because early URL-based detection seeds the hook without triggering a state transition.

---

### WP-C02: Console /send sends raw message

**Goal:** Verify `/send` from Console sends raw (unframed) text

**Steps:**
1. Connect to Socket.IO server (protocol = Socket.IO)
2. In Console, type `/send hello` and press Enter

**Expected Results:**
- [x] Console shows command echo "/send hello"
- [x] Console shows "Message sent." confirmation entry
- [x] `/send` sends raw text — does NOT apply Socket.IO framing (that’s the Compose panel’s job)

> ✅ **Automated:** `e2e/ws-protocols-console.spec.ts` — WP-C02 (verified 2026-06-13)
> **Note:** Raw text sent to a SIO server violates Engine.IO framing and causes server disconnect. Tests verify Console output only.

---

### WP-C03: Console /ping not supported on direct transport

**Goal:** Verify `/ping` reports unsupported on direct transport

**Steps:**
1. Connect via **direct** transport (no auth, no custom headers)
2. Open Console tab → type `/ping`

**Expected Results:**
- [x] Console shows error entry: "/ping is not supported here."
- [x] No actual ping frame sent (browser WebSocket API cannot send ping frames)

> ✅ **Automated:** `e2e/ws-protocols-console.spec.ts` — WP-C03 (verified 2026-06-13)
> **Note:** All Docker E2E tests connect via `connectDirect()` (no custom headers), so transport is always `direct`. Proxy transport would require adding custom headers.

---

### WP-C04: Console structured vs raw view toggle

**Goal:** Verify both Console views render correctly

**Steps:**
1. Connect to Socket.IO server (generates lifecycle entries)
2. Open Console → verify **Structured** view is active by default
3. Click **Raw** view button
4. Click **Structured** button to switch back

**Expected Results:**
- [x] **Structured view** (`data-testid="ws-console-view-structured"`): `.ws-console-row` entries with `.ws-console-level-badge` and `.ws-console-cat` spans
- [x] **Raw view** (`data-testid="ws-console-view-raw"`): `.ws-console-raw-row` entries with `*`/`>`/`<`/`$` glyph prefixes in `.ws-console-raw-pfx`
- [x] Switching views toggles active button class and swaps rendered entry format
- [x] Structured rows not visible in raw mode; raw rows not visible in structured mode

> ✅ **Automated:** `e2e/ws-protocols-console.spec.ts` — WP-C04 (verified 2026-06-13)

---

### WP-C05: Console filtering by category

**Goal:** Verify category filter isolates entries

**Steps:**
1. Connect (generates `lifecycle` + `handshake` entries)
2. Run `/help` command (generates `command` category entries)
3. Use category dropdown (`data-testid="ws-console-category"`) → select **Handshake**
4. Select **All categories** to restore

**Expected Results:**
- [x] Only handshake entries shown when filtered (includes "101 Switching Protocols")
- [x] Count badge updates to reflect filtered vs total count
- [x] Switching back to **All categories** restores full log

> ✅ **Automated:** `e2e/ws-protocols-console.spec.ts` — WP-C05 (verified 2026-06-13)
> **Note:** Tests filter by `handshake` (always present after SIO connect) instead of `protocol` (not emitted due to early detection).

---

## Secure WebSocket (wss://) — Verified Transport × TLS Matrix

> **Verified 2026-06-12** against the docker TLS stack (`wss://localhost:8766`,
> nginx TLS → echo backend, CA→leaf chain from `generate-cert.sh`).
> Driven via the console command input (`/connect`, `/send`, `/disconnect`) and
> the TLS panel (`data-testid="tls-toggle"`, `tls-reject-unauthorized`,
> `tls-ca-cert`). Transport shown in the status bar badge.

**How the transport is chosen:**
- **Browser direct** — default browser `WebSocket`. Used when there are no custom
  headers and no TLS overrides. Uses the browser's own TLS stack + system proxy.
- **Browser proxy** — Node server (port 3001). The browser auto-switches to proxy
  for `wss://` when *any* TLS override is set (skip-cert checkbox OR a pasted CA).
- **Tauri native** — Rust `tokio-tungstenite` + `rustls`. Always used in the
  desktop app; honours the TLS panel via `build_ws_connector`.

| # | Transport | TLS config | Result | Evidence |
|---|---|---|---|---|
| WP-24 | Browser **direct** | default (validate) | ❌ **Reject** | `net::ERR_CERT_AUTHORITY_INVALID`; "Connection failed — check URL, network, or CORS". Dev CA not trusted by browser. TLS panel does not apply to direct. |
| WP-25 | Browser **proxy** | Skip cert (`rejectUnauthorized:false`) | ✅ **Connect** | 101 → Connected (~14ms), badge **Proxy**, `/send` → ↑1 ↓1 echo. |
| WP-26 | Browser **proxy** | CA cert pasted (`ca.crt`, validate on) | ✅ **Connect** | 101 → Connected (~11ms), badge **Proxy**. Node agent validates leaf → CA. |
| WP-27 | Tauri **native** | default (validate) | ❌ **Reject** | `invalid peer certificate: UnknownIssuer [WS_CONNECT_FAILED]`. Clean error, no panic. |
| WP-28 | Tauri **native** | Skip cert (`rejectUnauthorized:false`) | ✅ **Connect** | 101 → Connected (~11ms), badge **Native**, `/send` → ↑1 ↓1 echo (rustls `NoVerifier`). |
| WP-29 | Tauri **native** | CA cert pasted (`ca.crt`, validate on) | ✅ **Connect** | 101 → Connected (~493ms), badge **Native**, `/send` → echo. rustls validates leaf against custom root. |

**Notes:**
- The connect → **Compose** left-tab auto-switch fires on every successful connect
  (browser and Tauri).
- A bare self-signed cert (`CA:TRUE` used as the leaf) connects in browser-proxy
  with skip-cert but is rejected by rustls with `CaUsedAsEndEntity` even when the
  CA is trusted — hence the CA→leaf chain in `generate-cert.sh`.

---

### WP-30: Public echo endpoint (`wss://echo.websocket.org`)

**Goal:** Connect to a real public echo over `wss://` (valid, system-trusted cert).

**Steps:**
1. Set URL to `wss://echo.websocket.org`, no TLS overrides.
2. Connect, then `/send` a message.

**Expected / Verified Results (2026-06-12, corporate network):**
- [x] **Browser direct** → ✅ Connected (~384ms), badge **Direct**, `/send` → `↑1 ↓4`
      (server greeting + echo). Browser routes the WebSocket through the system /
      corporate HTTP proxy.
- [x] **Tauri native** → ❌ `Connection timed out after 10000ms [WS_CONNECT_TIMEOUT]`.
      The native transport connects outbound **directly** and does not honour the
      corporate HTTP proxy, so the firewall blocks it. Clean timeout, no panic.

> **Environment limitation:** This corporate network blocks direct outbound `wss`
> but allows it via the HTTP proxy. So public-internet endpoints work from the
> **browser direct** transport (system proxy) but not from **Tauri native** or the
> **Node proxy** (neither uses the corporate proxy for outbound WS). On an
> unrestricted network all three transports should reach the public echo.

---

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| 2026-06-12 | WP-27/28/29 (Tauri native wss) | First `wss://` handshake in the desktop app panicked on a tokio worker thread (`Could not automatically determine the process-level CryptoProvider from Rustls crate features`); UI hung in "Connecting…" forever. | rustls 0.23 requires a process-level `CryptoProvider`. `tokio-tungstenite`'s `rustls-tls-native-roots` feature unifies in rustls's `aws-lc-rs` alongside our explicit `ring`, making auto-detection ambiguous. The default (no-override) TLS path used `ClientConfig::builder()` without an explicit provider → panic. | Install the provider once at startup: `rustls::crypto::ring::default_provider().install_default()` at the top of `run()` in `src-tauri/src/lib.rs`. Native wss now connects (skip/CA) and rejects untrusted chains cleanly. |
| 2026-06-12 | WP-29 (Tauri native CA validation) | CA-validation connect failed with `invalid peer certificate: CaUsedAsEndEntity` even with the correct CA trusted. | The test cert was a single self-signed cert with `CA:TRUE` used directly as the server leaf. rustls/webpki rejects a CA cert used as an end-entity. (The Node proxy was lenient and accepted it.) | Rewrote `docker/websocket/generate-cert.sh` to mint a root CA + a proper end-entity leaf (`CA:FALSE`, SAN `localhost`) signed by it. Paste `ca.crt` (not the leaf) into the TLS panel. |

---

## Test Data Export

Protocol-specific test data requires live servers and is not easily exportable as static JSON. Use the Docker setup above to reproduce all scenarios.

---

## Automated E2E Coverage (Playwright)

**Total automated tests:** 28 passing (Chrome)
**Last validated:** 2026-06-13

### Prerequisites
- Backend running on port 3001: `npm run server`
- Vite dev server on port 5173: `npm run dev`
- Mock echo server started automatically by `test.beforeAll` via `POST /api/ws/mock/start` (transport spec only)
- Docker protocol servers running: `docker compose -f docker/websocket/docker-compose.all.yml up -d`

### Run Commands
```bash
# All protocol E2E tests
npx playwright test e2e/ws-protocols-*.spec.ts --reporter=list

# Individual spec files
npx playwright test e2e/ws-protocols-transport.spec.ts --reporter=list   # 11 tests (mock echo)
npx playwright test e2e/ws-protocols-socketio.spec.ts --reporter=list    #  4 tests (Docker SIO)
npx playwright test e2e/ws-protocols-stomp.spec.ts --reporter=list       #  4 tests (Docker RabbitMQ)
npx playwright test e2e/ws-protocols-graphql.spec.ts --reporter=list     #  4 tests (Docker GraphQL-WS)
npx playwright test e2e/ws-protocols-console.spec.ts --reporter=list     #  5 tests (Docker SIO)
```

### Spec: `ws-protocols-transport.spec.ts` — 11 tests (mock echo)
| ID | Scenario | Status |
|------|----------|--------|
| WP-01 | Protocol selector visible on Connect tab | ✅ |
| WP-02 | URL-based auto-detection hint | ✅ |
| WP-04a | Socket.IO compose fields visible | ✅ |
| WP-08a | STOMP compose fields layout | ✅ |
| WP-16 | TLS panel elements visible | ✅ |
| WP-17 | rejectUnauthorized toggle | ✅ |
| WP-18 | Proxy-only banner for TLS | ✅ |
| WP-22 | Transport mode shows in badge after connect | ✅ |
| WP-23 | Protocol badge shows after connect | ✅ |
| WP-A01 | Auth tab renders with type selector | ✅ |
| WP-A02 | Auth forces proxy transport | ✅ |

### Spec: `ws-protocols-socketio.spec.ts` — 4 tests (Docker Socket.IO :3100)
| ID | Scenario | Status |
|------|----------|--------|
| WP-04 | SIO connect + EIO handshake + SIO `40` event log | ✅ |
| WP-05 | SIO emit event → echo → decoded in Events tab | ✅ |
| WP-06 | SIO server params (pingInterval, pingTimeout) in EIO open | ✅ |
| WP-07 | SIO clean disconnect → Disconnected status | ✅ |

### Spec: `ws-protocols-stomp.spec.ts` — 4 tests (Docker RabbitMQ :15674)
| ID | Scenario | Status |
|------|----------|--------|
| WP-08 | STOMP CONNECT → CONNECTED frame received | ✅ |
| WP-09 | STOMP SUBSCRIBE + SEND → MESSAGE received | ✅ |
| WP-10 | STOMP compose fields (command select, destination, headers, body) | ✅ |
| WP-11 | STOMP clean DISCONNECT → Disconnected status | ✅ |

### Spec: `ws-protocols-graphql.spec.ts` — 4 tests (Docker GraphQL-WS :4100)
| ID | Scenario | Status |
|------|----------|--------|
| WP-12 | GraphQL-WS connection_init → connection_ack | ✅ |
| WP-13 | GraphQL subscription → next messages → complete | ✅ |
| WP-14 | Op ID auto-increment (Op #1, Op #2) | ✅ |
| WP-15 | GraphQL-WS clean disconnect | ✅ |

### Spec: `ws-protocols-console.spec.ts` — 5 tests (Docker Socket.IO :3100)
| ID | Scenario | Status |
|------|----------|--------|
| WP-C01 | Console lifecycle entries (Connecting, 101, Connected) | ✅ |
| WP-C02 | Console `/send hello` → command echo + "Message sent." | ✅ |
| WP-C03 | Console `/ping` → "not supported" error on direct transport | ✅ |
| WP-C04 | Console structured ↔ raw view toggle | ✅ |
| WP-C05 | Console category filter (handshake → filtered count) | ✅ |

### Not Automated (manual or environment-specific)
- WP-03: Auto-detect from first message (partially covered by WP-04 SIO auto-detect)
- WP-19–21: Tauri native transport (requires `npm run tauri:dev`)
- WP-22–23: Transport parity across all three modes (partially covered)
- WP-24–30: TLS/SSL scenarios (manually verified 2026-06-12, see matrix above)
- WP-A03–A06: Auth tab protocol interactions (manual)

---

## Appendix: `data-testid` & Selector Reference

**Connection & Transport:**
- `connect-btn` / `disconnect-btn` — connect/disconnect buttons
- `status-badge` — connection status
- `transport-badge` — transport mode (Direct/Proxy/Native)
- `protocol-badge` — detected protocol badge
- `protocol-select` — protocol selector dropdown
- `connection-error` — connection error message
- `conn-tab-bar` — connection tab bar
- `mode-client` — client mode switch
- `left-tab-auth` — auth left tab

**TLS Panel:**
- `tls-toggle` — TLS panel expand/collapse
- `tls-body` — TLS panel body
- `tls-reject-unauthorized` — reject unauthorized toggle
- `tls-ca-cert` — CA certificate textarea
- `tls-proxy-notice` — proxy-required notice for TLS

**Auth Tab:**
- `ws-auth-callout` — proxy-required callout

**Socket.IO:**
- `sio-event-name` — Socket.IO event name input
- `sio-mode-badge` — Socket.IO mode badge
- `sio-server-params` — server parameters display

**STOMP:**
- `stomp-command` — STOMP command selector
- `stomp-destination` — STOMP destination input
- `stomp-compose-fields` — STOMP compose fields container

**GraphQL-WS:**
- `gql-operation-name` — GraphQL operation name input
- `gql-op-id` — GraphQL operation ID display
- `gql-variables` — GraphQL variables textarea
- `gql-compose-fields` — GraphQL compose fields container

**Console:**
- `ws-studio-console-pane` — console pane container
- `ws-console-cmd-input` — command line input
- `ws-console-view-structured` / `ws-console-view-raw` — view toggles
- `ws-console-category` — category filter dropdown
- `ws-console-count` — filtered/total count badge
