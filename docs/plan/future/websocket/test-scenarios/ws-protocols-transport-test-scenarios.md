# WebSocket Protocols & Transport Test Scenarios

> **File:** `ws-protocols-transport-test-scenarios.md`
> **Covers:** Phases 3, 6 — Protocol Support (Socket.IO, STOMP, GraphQL-WS), TLS/mTLS, Tauri Native Transport
> **Created:** 2026-06-10
> **Tested on:** Web (Chrome), Tauri (macOS)
> **Docker:** Echo server + Socket.IO + RabbitMQ/STOMP + GraphQL subscription server

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
```

### Dev Servers

```bash
npm run dev          # Frontend → http://localhost:5173
npm run server       # Backend (proxy mode)
```

### Navigation

1. Open **http://localhost:5173** → **Protocols** → **WebSocket**
2. Protocol selector is in the Connect view, below the URL input

---

## Protocol Detection & Selector

### WP-01: Protocol selector dropdown

**Goal:** Verify protocol selector options

**Steps:**
1. Navigate to WebSocket Studio → Connect view
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
- [ ] EIO handshake succeeds: open packet received with `sid`, `pingInterval`, `pingTimeout`
- [ ] Status transitions to Connected
- [ ] System message shows Socket.IO connection details
- [ ] Message log shows decoded EIO/SIO packets (not raw wire format)

---

### WP-05: Send Socket.IO event

**Goal:** Verify Socket.IO event encoding

**Steps:**
1. While connected to Socket.IO server
2. Type event payload (e.g., `["chat","Hello"]` or use SIO event form)
3. Click **Send**

**Expected Results:**
- [ ] Message encoded as `42["chat","Hello"]` on the wire
- [ ] Log shows decoded event name + data
- [ ] Echo response decoded correctly
- [ ] Type badge shows "sio" or "json" based on content

---

### WP-06: Socket.IO Ping/Pong

**Goal:** Verify EIO heartbeat

**Steps:**
1. While connected to Socket.IO server, wait for ping interval (~25s default)
2. Observe system frames toggle to see ping/pong

**Expected Results:**
- [ ] EIO ping (`2`) and pong (`3`) frames visible in log (when system frames enabled)
- [ ] Ping interval and timeout values displayed in connection info
- [ ] Connection stays alive through heartbeat cycle

---

### WP-07: Disconnect from Socket.IO

**Goal:** Verify clean Socket.IO disconnect

**Steps:**
1. While connected, click **Disconnect**

**Expected Results:**
- [ ] SIO disconnect packet sent before connection close
- [ ] Clean disconnect without errors
- [ ] Status returns to Disconnected

---

## STOMP

### WP-08: Connect to STOMP server

**Goal:** Verify STOMP CONNECT frame

**Steps:**
1. Select protocol: **STOMP**
2. Enter URL: `ws://localhost:15674/ws`
3. Click **Connect**

**Expected Results:**
- [ ] Auto-CONNECT frame sent with appropriate headers
- [ ] CONNECTED frame received with server version info
- [ ] System message confirms STOMP connection
- [ ] Status shows Connected

---

### WP-09: SUBSCRIBE to destination

**Goal:** Verify STOMP message subscription

**Steps:**
1. While connected to STOMP server
2. Send SUBSCRIBE frame with destination (e.g., `/queue/test`)
3. Publish a message to that destination

**Expected Results:**
- [ ] MESSAGE frame received with headers (destination, content-type, etc.) and body
- [ ] Log shows decoded STOMP frame with headers + body separated
- [ ] Frame type displayed in message row

---

### WP-10: SEND message to destination

**Goal:** Verify STOMP SEND frame serialization

**Steps:**
1. While connected, compose a STOMP SEND message
2. Include destination and body

**Expected Results:**
- [ ] STOMP SEND frame serialized correctly with headers + body
- [ ] Null byte terminator included
- [ ] Server acknowledges if receipt requested

---

### WP-11: Heart-beat negotiation

**Goal:** Verify STOMP heart-beat values

**Steps:**
1. Connect to STOMP server
2. Observe CONNECTED frame heart-beat header

**Expected Results:**
- [ ] Client heart-beat values sent in CONNECT frame
- [ ] Server heart-beat values displayed from CONNECTED frame
- [ ] Heart-beats visible in system frames when enabled

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
- [ ] `connection_init` message sent automatically
- [ ] `connection_ack` response received
- [ ] Status shows Connected
- [ ] System message confirms GraphQL-WS connection

---

### WP-13: GraphQL subscription

**Goal:** Verify GraphQL subscribe operation

**Steps:**
1. While connected, send a `subscribe` message with a GraphQL query
2. Example: `{"id":"1","type":"subscribe","payload":{"query":"subscription { messageAdded { text } }"}}`

**Expected Results:**
- [ ] `subscribe` frame sent correctly
- [ ] `next` messages received with subscription data
- [ ] Decoded payload shown in message log
- [ ] Subscription ID visible in message details

---

### WP-14: Operation name in compose

**Goal:** Verify GraphQL operation name display

**Steps:**
1. Send a subscription with a named operation
2. Observe compose UI and log display

**Expected Results:**
- [ ] Operation name displayed in compose bar or message detail
- [ ] Named operations distinguishable in the log

---

### WP-15: Complete subscription

**Goal:** Verify GraphQL subscription completion

**Steps:**
1. While subscribed, send a `complete` message with the subscription ID
2. Example: `{"id":"1","type":"complete"}`

**Expected Results:**
- [ ] `complete` message sent
- [ ] Server acknowledges with `complete` response
- [ ] Subscription ends cleanly
- [ ] Connection remains open for new subscriptions

---

## TLS / mTLS

### WP-16: TLS panel UI elements

**Goal:** Verify TLS configuration panel

**Steps:**
1. On Connect view, look for TLS configuration section
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
- [ ] TLS settings applied via `rustls`
- [ ] Same behavior as proxy mode TLS
- [ ] Self-signed certs work with `rejectUnauthorized: false`

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

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| *(populated during testing)* | | | | |

---

## Test Data Export

Protocol-specific test data requires live servers and is not easily exportable as static JSON. Use the Docker setup above to reproduce all scenarios.
