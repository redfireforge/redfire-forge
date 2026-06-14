# WebSocket Core Connect Test Scenarios

> **File:** `ws-core-connect-test-scenarios.md`
> **Covers:** Phases 1, 2, 7, 8 — Core Connect & Send/Receive, Saved Connections, Templates, Auto-Reconnect, Env Variables, Virtualized Log
> **Created:** 2026-06-10
> **Last verified:** 2026-06-13 (Chrome E2E 42/42 + Tauri desktop manual, macOS)
> **E2E file:** `e2e/ws-core-connect.spec.ts` (42 tests)
> **Tested on:** Web (Chrome), Tauri (macOS)
> **Docker:** Echo server (`jmalloc/echo-server` on port 8765)
>
> **2026-06-12 — Shell-IA doc refresh:** navigation steps re-mapped from the removed legacy view tabs (Connect/Messages/Saved/Mock) to the split-pane shell — **Connect/Params/Auth/Headers/Compose** left tabs, **Events/Console/Stats/Load Test/Schema** right tabs, and **Client/Mock Server/Saved** modes. Message log now lives in the right-pane **Events** tab; the message-count badge is on the **Compose** left tab; **Saved** is a mode. Visual re-validation deferred to the merge gate.

---

## Before You Start

### Docker Setup

```bash
# Start the echo server
docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
# Verify: docker ps --filter name=ws-echo

# Secure wss:// stack for WC-10 / WC-10a (nginx TLS → echo, CA→leaf chain)
bash docker/websocket/generate-cert.sh
docker compose -f docker/websocket/docker-compose.tls.yml up -d
# → wss://localhost:8766  (paste docker/websocket/certs/ca.crt into the TLS panel)
```

### Dev Server

```bash
# Start the frontend
npm run dev
# → http://localhost:5173

# Start the backend (needed for proxy mode / Ping)
npm run server
```

### Navigation

1. Open **http://localhost:5173** in Chrome
2. Click **Protocols** in the left activity bar
3. Click **WebSocket** in the sub-navigation tabs
4. You should see the WebSocket Studio page with a default "New Connection" tab

---

## Navigation & Layout

### WC-01: Activity bar → Protocols → WebSocket sub-nav renders

**Goal:** Verify navigation path to WebSocket Studio

**Steps:**
1. Open the app at `http://localhost:5173`
2. Click **Protocols** in the left activity bar (5th icon from top)
3. Observe the sub-navigation tabs at the top of the main content area

**Expected Results:**
- [ ] Activity bar shows "Protocols" button with icon
- [ ] Sub-navigation renders three tabs: **Kafka** | **WebSocket** | **SSE**
- [ ] Default selection is Kafka (the first protocol tab)
- [ ] Clicking **WebSocket** activates it and shows the WebSocket Studio page

---

### WC-02: Page layout — connection tab bar, mode switch, split pane

**Goal:** Verify the WebSocket Studio page structure (split-pane shell)

**Steps:**
1. Navigate to **Protocols → WebSocket**
2. Observe the page layout

**Expected Results:**
- [ ] Connection tab bar at top: shows one default tab "New Connection" with a status dot and a "+" button
- [ ] Mode switch below the tab bar: **Client** | **Mock Server** | **Saved** (Client selected by default)
- [ ] In Client mode, the split pane shows a **left pane** with tabs **Connect** | **Params** | **Auth** | **Headers** | **Compose** (setup-first phase order: URL → query params → auth → headers → message body) and a **right pane** with tabs **Events** | **Console** | **Stats** | **Load Test** | **Schema**
- [ ] A draggable divider separates the left and right panes
- [ ] Left pane shows the **Connect** tab by default while disconnected; on a successful (re)connect the left pane auto-switches to the **Compose** tab so the user lands on the send screen; right pane shows the **Events** log by default
- [ ] Status bar (within the Events pane): shows "Disconnected" status and counters "↑ 0 ↓ 0"

---

### WC-03: Initial state — URL input, status, buttons

**Goal:** Verify default UI state before any interaction

**Steps:**
1. Navigate to **Protocols → WebSocket** (fresh page load)
2. On the **Connect** left tab, observe the form elements

**Expected Results:**
- [ ] URL input field: empty, with placeholder text "ws://localhost:8765 or wss://..."
- [ ] Subprotocols input: empty, with placeholder "e.g. graphql-ws, json (comma-separated)"
- [ ] Headers section: shows "+ Add" button, no rows
- [ ] Query Parameters section: shows "+ Add" button, no rows
- [ ] Protocol selector: dropdown showing "Auto-detect" (options: Raw, Socket.IO, STOMP, GraphQL-WS)
- [ ] Auto-Reconnect Settings: collapsible section with checkbox
- [ ] **Connect** button: **disabled** (no URL entered)
- [ ] **Disconnect** button: disabled
- [ ] **Close with code** (▾) button: disabled
- [ ] **Save as Profile** button: disabled
- [ ] Status bar: "Disconnected" with "↑ 0 ↓ 0"

> **Note:** Connect button is disabled when URL is empty. It enables once a valid URL is entered. This is correct UX behavior — prevents connecting to empty URLs.

---

## Connection Lifecycle

### WC-04: Connect to echo server

**Goal:** Verify successful WebSocket connection

**Steps:**
1. Type `ws://localhost:8765` in the URL input field
2. Click **Connect**
3. Observe the status transition

**Expected Results:**
- [ ] Status transitions: Disconnected → Connecting → Connected (green indicator)
- [ ] Tab label changes to "localhost:8765" with green status dot
- [ ] Status bar shows "Connected" with URL display
- [ ] Connection lock banner appears: "🔒 Connection settings are locked while connected. Disconnect to edit."
- [ ] URL input becomes read-only (greyed out)
- [ ] **Connect** button becomes disabled; **Disconnect** button becomes enabled
- [ ] **Compose** left tab shows a badge with the message count (system message + echo server welcome)
- [ ] "Recent connections" dropdown (▾) appears next to "+" in tab bar
- [ ] Status bar also shows latency (e.g. "22ms"), **Uptime: Ns**, a **Raw** protocol badge, and a **Direct** transport badge (transport becomes **Proxy** when custom headers are set)

---

### WC-05: Disconnect from echo server

**Goal:** Verify clean disconnection

**Steps:**
1. While connected (from WC-04), click **Disconnect**
2. Observe the status transition

**Expected Results:**
- [ ] Status transitions: Connected → Disconnecting → Disconnected
- [ ] Tab status dot changes from green to grey
- [ ] Status bar shows "Disconnected" with final latency value
- [ ] Connection lock banner disappears
- [ ] URL input becomes editable again
- [ ] **Connect** button re-enables; **Disconnect** button disables
- [ ] Message counters retain their final values (↑ N ↓ M)

---

### WC-06: Connect with custom headers

**Goal:** Verify custom header support via server proxy

**Steps:**
1. Type `ws://localhost:8765` in URL input
2. Click **+ Add** next to "Headers"
3. Enter key: `Authorization`, value: `Bearer test-token-123`
4. Click **Connect**

**Expected Results:**
- [ ] Connection succeeds (proxy mode activated due to custom headers)
- [ ] Status shows "Connected"
- [ ] Ping button becomes **enabled** (proxy transport supports ping)
- [ ] System message in log confirms connection

> **Note:** Adding custom headers forces proxy mode (server-side WS connection), as browser WebSocket API doesn't support custom headers.

---

### WC-07: Connect with query parameters

**Goal:** Verify query parameter appending

**Steps:**
1. Type `ws://localhost:8765` in URL input
2. Click **+ Add** next to "Query Parameters"
3. Enter key: `token`, value: `abc123`
4. Click **Connect**

**Expected Results:**
- [ ] Connection succeeds
- [ ] URL is resolved as `ws://localhost:8765?token=abc123`
- [ ] System message shows the resolved URL with query params

---

### WC-08: Connect with subprotocol

**Goal:** Verify subprotocol negotiation

**Steps:**
1. Type `ws://localhost:8765` in URL input
2. Type `json` in the Subprotocols field
3. Click **Connect**

**Expected Results:**
- [ ] The requested subprotocol(s) are offered on the handshake (`Sec-WebSocket-Protocol: json`)
- [ ] **If the server negotiates the subprotocol:** connection succeeds and the negotiated protocol is shown
- [ ] **If the server does NOT negotiate it** (e.g. the `jmalloc/echo-server` used in these scenarios): the browser rejects the connection and the status bar shows **Error** — `Connection failed: Server sent no subprotocol [WS_CONNECT_FAILED]`. This is correct per the WebSocket spec: when a client offers subprotocols the server must select one, otherwise the client must fail the connection.

> **Note:** The local `jmalloc/echo-server` does **not** echo/negotiate subprotocols, so requesting `json` against it fails with "Server sent no subprotocol". To exercise a *successful* negotiation, use a server that selects a subprotocol (e.g. a Socket.IO/STOMP/GraphQL-WS endpoint, or run the connection without a subprotocol).

---

### WC-09: Connect to invalid URL

**Goal:** Verify error handling for invalid URLs

**Steps:**
1. Type `ws://invalid-host-that-does-not-exist:9999` in URL input
2. Click **Connect**

**Expected Results:**
- [ ] Status transitions: Disconnected → Connecting → Error/Disconnected
- [ ] Error message displayed in status bar or system message
- [ ] Connection does not remain in "Connecting" state indefinitely
- [ ] UI remains responsive; can retry with a different URL

---

### WC-10: Connect to WSS endpoint

**Goal:** Verify TLS WebSocket connection

**Steps:**
1. Type `wss://echo.websocket.org` (or another valid WSS endpoint) in URL input
2. Click **Connect**

**Expected Results:**
- [ ] Connection succeeds over TLS
- [ ] Status shows "Connected"
- [ ] All messaging features work identically to ws:// connections

---

### WC-10a: Public echo over wss:// (`wss://echo.websocket.org`)

**Goal:** Verify a real public `wss://` endpoint with a system-trusted cert.

**Steps:**
1. Set the URL field (`data-testid="ws-url-input"`) to `wss://echo.websocket.org`,
   no TLS overrides.
2. Connect, then send a message via the Compose tab / console `/send`.

**Expected / Verified Results (2026-06-12, corporate network):**
- [x] **Browser direct transport** → Connected (~384ms), status bar
      `Connected · wss://echo.websocket.org · 384ms · ↑1 ↓4 · Raw · Direct`
      (`↓4` = server greeting + echo). Left tab auto-switches to **Compose**.
- [x] **Tauri native transport** → `Connection timed out after 10000ms
      [WS_CONNECT_TIMEOUT]` on this network — native connects outbound directly
      and does not use the corporate HTTP proxy, which blocks the egress. Clean
      timeout, no panic.

> The browser direct transport reaches public endpoints because it uses the
> system / corporate proxy; the Tauri native and Node-proxy transports connect
> directly and are blocked by the corporate firewall here. On an unrestricted
> network all transports should connect. For deterministic offline testing use
> the docker TLS stack (`wss://localhost:8766`) — see the protocols/transport
> scenarios (WP-24…WP-30).

---

## Compose & Messaging

### WC-11: Send text message

**Goal:** Verify text message sending

**Steps:**
1. Connect to `ws://localhost:8765` (from WC-04)
2. Select the **Compose** left tab
3. Type `Hello WebSocket!` in the compose bar
4. Click **Send**

**Expected Results:**
- [ ] Sent message appears in the **Events** log (right pane) with ↑ (sent) arrow
- [ ] Message shows timestamp (HH:MM:SS.mmm format)
- [ ] Message type badge shows "text"
- [ ] Message size shows "16 B"
- [ ] Compose bar input clears after send
- [ ] Counter updates: ↑ increments by 1

---

### WC-12: Echo server response

**Goal:** Verify received message display

**Steps:**
1. After sending message (WC-11), observe the message log

**Expected Results:**
- [ ] Echo response appears with ↓ (received) arrow
- [ ] Same content as sent message: "Hello WebSocket!"
- [ ] Timestamp slightly after the sent message
- [ ] Type badge shows "text"
- [ ] Counter updates: ↓ increments by 1

---

### WC-13: Cmd+Enter shortcut sends message

**Goal:** Verify keyboard shortcut

**Steps:**
1. While connected, type `Shortcut test` in compose bar
2. Press **Cmd+Enter** (Mac) or **Ctrl+Enter** (Windows/Linux)

**Expected Results:**
- [ ] Message is sent (same as clicking Send button)
- [ ] Sent + echo response appear in log
- [ ] Compose bar clears

---

### WC-14: Send JSON message — auto-detection

**Goal:** Verify JSON auto-detection in message log

**Steps:**
1. While connected, type `{"type":"greeting","message":"Hello JSON"}` in compose bar
2. Click **Send**

**Expected Results:**
- [ ] Sent message appears with type badge "json" (not "text")
- [ ] Echo response also shows "json" type badge
- [ ] Message preview in log shows formatted JSON snippet
- [ ] Clicking the message row opens detail panel with pretty-printed JSON

---

### WC-15: Format selector — Text / JSON / Binary modes

**Goal:** Verify format selector in compose bar

**Steps:**
1. While connected, observe the compose bar bottom row
2. Click the "Format:" dropdown

**Expected Results:**
- [ ] Three format options: **Text** (default) | **JSON** | **Binary (Base64)**
- [ ] Selecting JSON doesn't change compose behavior but sets the format header
- [ ] Selecting Binary (Base64) changes placeholder to indicate Base64 input expected

---

### WC-16: Send binary message

**Goal:** Verify binary frame transmission

**Steps:**
1. While connected, select "Binary (Base64)" from format dropdown
2. Type `SGVsbG8gQmluYXJ5IQ==` (Base64 for "Hello Binary!")
3. Click **Send**

**Expected Results:**
- [ ] Sent message appears with type badge showing "binary"
- [ ] Echo response shows binary type badge
- [ ] Detail panel shows Hex view with byte values
- [ ] Invalid Base64 input shows error in `connection.lastError`

---

### WC-16a: Type badge inference (content-based, not format-based)

**Goal:** Verify the message-row type badge is inferred from the message **content**, independent of the compose Format selector

**Steps:**
1. Connect to `ws://localhost:8765`
2. Observe the first **system** message ("Connected to ws://localhost:8765…")
3. With **Format: Text** still selected, type `{"hello":"world"}` and click **Send**
4. Send a plain string `hello there` (Format: Text)

**Expected Results:**
- [ ] System/connection messages show a **`sys`** badge with a ◆ direction marker
- [ ] The `{"hello":"world"}` message shows a **`json`** badge even though Format was **Text** (badge is inferred from valid-JSON content, not the Format dropdown)
- [ ] Its echo response also shows a **`json`** badge
- [ ] The plain `hello there` message shows a **`text`** badge
- [ ] Binary frames show a **`binary`** badge (see WC-16)
- [ ] Close frames (`CLOSE SENT` / `CLOSE ACK`) render as `sys` badges

> **Note:** The badge label comes from `protocolMeta.packetType` when a protocol is detected; otherwise it falls back to `sys` (system/close), then `json` (valid JSON), then the raw frame type (`text` / `binary`). The compose **Format** selector only sets the outgoing frame encoding — it does **not** drive the badge.

---

### WC-17: Ping button

**Goal:** Verify WebSocket ping frame

**Steps:**
1. Connect to `ws://localhost:8765` **with a custom header** (to force proxy mode)
   - On the **Headers** left tab, add header: `X-Test: 1`
2. Select the **Compose** left tab
3. Click **Ping** button

**Expected Results:**
- [ ] Ping button is **enabled** (proxy or native transport active)
- [ ] Ping frame sent; system or control message appears in log
- [ ] Pong response visible when system frames are shown

> **Note:** Ping is **disabled** in direct browser WebSocket mode because the browser API doesn't support sending ping frames. The tooltip says "Ping requires proxy or native transport". Use proxy mode (add any header) or Tauri desktop mode for this test.
>
> The **Console** `/ping` slash command mirrors this: in direct browser mode it reports `/ping is not supported here.` (error), and only sends a ping (`Ping sent.`) when connected over proxy/native transport. See WC-C07.

---

### WC-18: Send button disabled states

**Goal:** Verify compose bar disabled states

**Steps:**
1. With no connection (disconnected state), observe compose bar
2. Connect, then observe compose bar

**Expected Results:**
- [ ] **Disconnected:** Message input shows placeholder "Connect to send messages" and is disabled
- [ ] **Disconnected:** Send button disabled, Ping button disabled
- [ ] **Connected (empty input):** Send button disabled, input enabled with "Type a message…" placeholder
- [ ] **Connected (with text):** Send button enabled
- [ ] **During replay mode:** Compose bar disabled (separate test in WT-28–31)

---

## Message Log

### WC-19: Auto-scroll to bottom

**Goal:** Verify log auto-scrolls on new messages

**Steps:**
1. While connected, send 20+ messages rapidly
2. Observe the scroll position

**Expected Results:**
- [ ] Log auto-scrolls to show the newest message at the bottom
- [ ] Scrolling up manually pauses auto-scroll
- [ ] New messages arriving while scrolled up don't force scroll

---

### WC-20: Direction filter

**Goal:** Verify direction filtering

**Steps:**
1. While connected with several sent/received messages, find the direction filter dropdown
2. Select "Sent"
3. Select "Received"
4. Select "All"

**Expected Results:**
- [ ] **All:** Shows all messages (sent + received + system)
- [ ] **Sent:** Shows only ↑ messages
- [ ] **Received:** Shows only ↓ messages
- [ ] **Bookmarked:** Shows only ★ bookmarked messages (with count)
- [ ] Filter dropdown shows current selection

---

### WC-21: Text search with Cmd+F

**Goal:** Verify search functionality

**Steps:**
1. With messages in the log, click in the search input (or press Cmd+F)
2. Type "Hello" in the search field

**Expected Results:**
- [ ] Search input accepts text
- [ ] Matching messages are highlighted/filtered
- [ ] Match counter shows "N of M" results
- [ ] Search is case-insensitive

---

### WC-22: Click message → detail panel

**Goal:** Verify message detail panel

**Steps:**
1. Click on a JSON message row in the log

**Expected Results:**
- [ ] Detail panel slides in from the right (or bottom)
- [ ] Header shows direction (↑/↓), timestamp, and size
- [ ] Three content tabs: **JSON** | **Raw** | **Hex**
- [ ] JSON tab shows pretty-printed, syntax-highlighted JSON
- [ ] Navigation buttons: ▲ (prev) / ▼ (next) to navigate between messages
- [ ] **Diff ↑** button available for quick diff with previous same-direction message
- [ ] **Wrap** toggle for line wrapping
- [ ] **Copy** button to copy content to clipboard
- [ ] **×** button to close detail panel

---

### WC-23: Clear messages

**Goal:** Verify log clearing

**Steps:**
1. With messages in the log, click **Clear** button in toolbar

**Expected Results:**
- [ ] All messages removed from the log
- [ ] Counter shows "0 / 10000 messages"
- [ ] Empty state: "No messages yet" placeholder shown
- [ ] Bookmarks are NOT preserved after clear (messages are removed)

---

### WC-24: Export messages as JSON

**Goal:** Verify message export

**Steps:**
1. With messages in the log, click **Export** button in toolbar
2. Browser: file download dialog; Tauri: native save dialog

**Expected Results:**
- [ ] JSON file downloaded containing the message array
- [ ] Each message includes: `id`, `direction`, `type`, `data`, `size`, `timestamp`
- [ ] `bookmarked: true` appears **only** on bookmarked messages (the key is omitted on non-bookmarked messages)
- [ ] File name includes timestamp

> **Note:** The toolbar **Export** button exports the message array (above). The toolbar **Import** button (title "Import recording", `accept=".json,.wsrecording.json"`) is **asymmetric** — it imports a Phase 11 session *recording*, not the exported message array. Re-importing an exported message array via the Import button is not supported.

---

## Saved Connection Profiles

### WC-25: Saved mode — empty state

**Goal:** Verify empty saved connections

**Steps:**
1. Click the **Saved** mode in the mode switch
2. Observe the empty state

**Expected Results:**
- [ ] Heading: **Saved Profiles · 0** (count appended to the heading)
- [ ] Search input (placeholder "Search profiles...")
- [ ] **+ New Profile** button
- [ ] Footer/header actions: **Import** (file), **Paste** (JSON), **Export** — plus **+ New Profile**
- [ ] Empty state message: "No saved connections. Create one or use Save as Profile from the Connect tab."
- [ ] Footer: "0 saved profiles"
- [ ] The **Export** button is **disabled** when no profiles exist

---

### WC-26: Save current connection as profile

**Goal:** Verify profile saving

**Steps:**
1. On the **Connect** left tab (Client mode), enter URL: `ws://localhost:8765`
2. Add a header: `X-Test: value1`
3. Add a query param: `key1: val1`
4. Type `json` in Subprotocols field
5. Click **Save as Profile**
6. The app switches to the **Saved** view and opens a **New Profile editor** (it does NOT just prompt for a name)
7. Adjust the auto-filled **Profile Name** to "Echo Server Test"
8. Click **Save Profile**

**Expected Results:**
- [ ] Clicking **Save as Profile** navigates to the **Saved** view and opens a full **New Profile editor** pre-filled from the current connection
- [ ] Editor fields: **Profile Name** (auto-defaults to "Profile 1", placeholder "My WebSocket Server"), **WebSocket URL**, **Subprotocols**, **Headers**, **Query Parameters**, **Auto-reconnect settings**, **Max Messages** (default `10000`), and **Notes**
- [ ] Editor has **Cancel** and **Save Profile** buttons
- [ ] After saving, the profile card appears showing the name, URL, and config-summary badges (e.g. "json" subprotocol, "1 header", "1 param", "Auto-reconnect off", "Protocol mode auto", "Max messages 10000", "Updated just now")
- [ ] Each profile card exposes **Load & Connect | Edit | Duplicate | Delete** actions
- [ ] Profile count updates: heading shows **Saved Profiles · 1** and footer "1 saved profile"

---

### WC-27: Load profile → fills connect form

**Goal:** Verify profile loading

**Steps:**
1. In **Saved** mode, click the **Load & Connect** button on the "Echo Server Test" profile card
2. Observe the **Connect** left tab form (the app switches to Client mode)

**Expected Results:**
- [ ] The profile card's primary action is **Load & Connect** — it loads the config into the Client-mode form **and** immediately initiates the connection (it does not merely fill the form)
- [ ] URL field filled with `ws://localhost:8765`
- [ ] Header row shows `X-Test: value1`
- [ ] Query param shows `key1: val1`
- [ ] Subprotocol field shows `json`
- [ ] If the loaded subprotocol/headers prevent the handshake (e.g. `json` against the echo server — see WC-08), the form is still fully populated and the connection reports the corresponding error

---

### WC-28: Delete profile

**Goal:** Verify profile deletion

**Steps:**
1. In **Saved** mode, click the **Del** button on a profile card
2. Click the inline **Confirm** button that appears (or **No** to cancel)

**Expected Results:**
- [ ] The delete action is a text button labelled **Delete** (one of the card actions: Load & Connect | Edit | Duplicate | Delete), not a "×" icon
- [ ] Clicking **Delete** reveals inline **Confirm / No** buttons (NOT a separate modal dialog)
- [ ] Clicking **Confirm** removes the profile from the list
- [ ] Clicking **No** cancels the deletion
- [ ] Profile count updates (heading **Saved Profiles · N**)

---

### WC-29: Import/Export profiles

**Goal:** Verify profile import/export round-trip

**Steps:**
1. Save 2-3 profiles
2. Click **Export All** → save the JSON file
3. Delete all profiles (or clear storage)
4. Click **Import File** → select the exported JSON file

**Expected Results:**
- [ ] Export produces valid JSON with all profile data
- [ ] Import restores all profiles with correct URLs, headers, params
- [ ] Profile count matches the original count

---

### WC-29a: Duplicate a profile

**Goal:** Verify the Duplicate card action clones a profile

**Steps:**
1. In **Saved** mode, click the **Duplicate** button on a profile card

**Expected Results:**
- [ ] A copy of the profile is created (named "<name> (copy)")
- [ ] The duplicate retains URL, headers, query params, subprotocols, and settings
- [ ] Profile count increments by 1

---

### WC-29b: Edit a profile

**Goal:** Verify the Edit card action opens the profile editor

**Steps:**
1. In **Saved** mode, click the **Edit** button on a profile card
2. Change a field (e.g. Notes or Max Messages)
3. Click **Save Changes**

**Expected Results:**
- [ ] Edit opens a full profile editor (dialog titled **Edit Profile**), pre-filled with the profile's values
- [ ] The save button is labelled **Save Changes** (vs **Save Profile** in the New Profile editor)
- [ ] Saving updates the existing profile in place (no new card created; count unchanged)
- [ ] The card config-summary badges / notes reflect the edited values

---

### WC-29c: Import profiles via Paste JSON

**Goal:** Verify pasting a JSON profile array imports profiles

**Steps:**
1. In **Saved** mode, click **Paste** in the footer
2. Paste a profile array, e.g. `[{"name":"Pasted Profile","url":"wss://example.com/ws","subprotocols":"graphql-ws"}]`
3. Click **Import**

**Expected Results:**
- [ ] **Paste** opens an inline textarea (placeholder shows an example profile array)
- [ ] The **Import** button is disabled until text is entered; **Cancel** dismisses the textarea
- [ ] On import, a banner shows "Imported N profile(s)"
- [ ] The pasted profile(s) appear as new cards with correct URL/subprotocol badges
- [ ] Profile count updates accordingly

---

### WC-30: Config lock while connected

**Goal:** Verify connection fields are locked during active connection

**Steps:**
1. Connect to the echo server
2. Observe the **Connect** left tab form

**Expected Results:**
- [ ] Lock banner: "🔒 Connection settings are locked while connected. Disconnect to edit."
- [ ] URL input is read-only / disabled
- [ ] Headers, query params, subprotocol fields are read-only
- [ ] Protocol selector is disabled
- [ ] "Disconnect" link in the banner is clickable and disconnects

---

## Message Templates

### WC-31: Save message template

**Goal:** Verify template saving

**Steps:**
1. Type a message body in the compose input (e.g. `{"action":"subscribe","topic":"prices"}`)
2. Click **Templates ▾** in the compose bar
3. In the dropdown, type a name (e.g. "Subscribe Prices") into the **Template name…** field
4. Click **Save**

**Expected Results:**
- [ ] The dropdown opens **below** the Templates ▾ trigger and is fully visible (not clipped by the mode/tab bars above)
- [ ] The dropdown is headed **"Saved Templates"** with an empty state "No saved templates. Type a message and save it."
- [ ] The **Save** button is disabled until a template name is entered
- [ ] Template is saved with name, body content, and format (text/json/binary)
- [ ] The saved entry shows the **name**, a **body preview**, a **format badge**, and a **×** delete button

---

### WC-32: Load template → fills compose bar

**Goal:** Verify template loading

**Steps:**
1. Click **Templates ▾** dropdown
2. Click the "Greeting JSON" template

**Expected Results:**
- [ ] Compose bar input filled with template body
- [ ] Format selector set to template's saved format
- [ ] Ready to send immediately

---

### WC-33: Delete template

**Goal:** Verify template deletion

**Steps:**
1. Click **Templates ▾** dropdown
2. Click the delete button (×) on a template

**Expected Results:**
- [ ] Template removed from dropdown list
- [ ] When all templates deleted: "No saved templates" shown in dropdown

---

### WC-34: Templates persist across page reload

**Goal:** Verify template persistence

**Steps:**
1. Save a template
2. Navigate away (e.g., click "Kafka") and back to WebSocket
3. Open Templates dropdown

**Expected Results:**
- [ ] Template still present in the dropdown
- [ ] Full content and format preserved
- [ ] Works in both web (localStorage) and Tauri (FS persistence)

---

### WC-35: Template selector dropdown

**Goal:** Verify template dropdown UI

**Steps:**
1. Save 3+ templates with different names
2. Click **Templates ▾**

**Expected Results:**
- [ ] Dropdown lists all saved templates, each with name, body preview, and format badge
- [ ] A **Template name…** field + **Save** button (at the bottom) saves the current compose body as a new template
- [ ] Close on click outside

---

## Auto-Reconnect

### WC-36: Auto-reconnect settings

**Goal:** Verify auto-reconnect configuration UI

**Steps:**
1. On the **Connect** left tab, expand the "Auto-Reconnect Settings" section
2. Observe the configuration options

**Expected Results:**
- [ ] Checkbox: "Auto-reconnect on unexpected disconnect" with description "Automatically retry when the connection drops (close code ≠ 1000)"
- [ ] Header label "Saved with connection profile"
- [ ] When checked, three configuration fields appear, each with a hint:
  - **Max Attempts** (number input, default `5`) — hint "Stop retrying after this many failures"
  - **Retry Interval (ms)** (number input, default `3000`) — hint "Wait time between retry attempts"
  - **Backoff Multiplier** (dropdown: "None (fixed interval)" / "1.5×" / "2× (recommended)", default **2×**) — hint "Multiply interval after each failure"
- [ ] When unchecked, the three fields are disabled (greyed out)
- [ ] All fields become disabled while connected (settings lock)
- [ ] Settings are saved with the connection profile

---

### WC-37: Auto-reconnect triggers on server disconnect

**Goal:** Verify automatic reconnection

**Steps:**
1. Enable auto-reconnect checkbox
2. Connect to `ws://localhost:8765`
3. Stop the Docker echo server: `docker stop ws-echo`
4. Wait for connection to drop

**Expected Results:**
- [ ] Connection drops → status shows reconnecting
- [ ] Reconnect attempt counter visible (e.g., "Reconnecting... attempt 1/5")
- [ ] Backoff delay applied between attempts
- [ ] Restart server: `docker start ws-echo` → reconnection succeeds
- [ ] System message confirms reconnection

---

### WC-38: Close with code/reason

**Goal:** Verify custom close code and reason

**Steps:**
1. While connected, click the dropdown arrow (▾) next to Disconnect
2. Select "Close with code" option
3. Enter code: `1000`, reason: "Normal closure test"
4. Confirm

**Expected Results:**
- [ ] A "Close Connection with Code" dropdown opens with a numeric **Code** input (min 1000, max 4999)
- [ ] **Preset buttons** are available: `1000 Normal`, `1001 Going Away`, `1002 Protocol Error`, `1003 Unsupported`, `1008 Policy Violation`, `1011 Server Error`, `4000 Custom 4000`, `4001 Custom 4001` (clicking a preset fills the Code field)
- [ ] **Reason** input with placeholder "Optional close reason..." and a live byte counter showing **`0/123 bytes`**
- [ ] Reason input is capped at `maxLength=123`; the counter turns red (`over` style) only if the UTF-8 byte length exceeds 123 (possible with multi-byte characters)
- [ ] An error "Code must be 1000–4999" appears if the code is out of range
- [ ] WebSocket closed with specified code and reason
- [ ] System message in log shows close code and reason (e.g. `CLOSE SENT — code: 1000`)
- [ ] Status transitions to Disconnected
- [ ] Auto-reconnect does NOT trigger for code 1000 (normal closure)

---

### WC-39: Reconnect controls

**Goal:** Verify reconnect UI controls

**Steps:**
1. Enable auto-reconnect
2. Connect, then stop the echo server to trigger reconnect
3. Observe the reconnect state

**Expected Results:**
- [ ] "Reconnecting in Xs" countdown badge visible
- [ ] **Retry Now** button → immediately attempts reconnection
- [ ] **Cancel** button → stops reconnect attempts, sets status to Disconnected
- [ ] Reconnect attempt counter increments with each attempt

---

### WC-39a: Reconnect banner & reconnect-failed banner

**Goal:** Verify the reconnect progress banner and the failed-after-max-attempts banner

**Steps:**
1. Enable auto-reconnect (Max Attempts 5, Retry Interval 3000ms, Backoff 2×)
2. Connect to `ws://localhost:8765`
3. Stop the echo server: `docker stop ws-echo` to trigger an abnormal close (code 1006)
4. Observe the reconnect banner while retries are in progress
5. Leave the server stopped until all 5 attempts are exhausted

**Expected Results (reconnect banner — while retrying):**
- [ ] Banner shows **"Reconnecting (attempt N/5)…"** with a spinner
- [ ] "Connection lost at HH:MM:SS" timestamp shown
- [ ] "Next retry in Xs" countdown, with **(backoff: 2×)** suffix when backoff multiplier ≠ 1
- [ ] A row of **progress dots** (one per max attempt): completed = `done`, current = `current`, remaining = `pending`
- [ ] **Cancel** button stops the reconnect cycle and sets status to Disconnected

**Expected Results (reconnect-failed banner — after max attempts):**
- [ ] Banner shows **⚠ "Auto-reconnect failed after 5 attempts"**
- [ ] "Last error: …" line and **"Total downtime: …"** label
- [ ] **Retry Now** button (restarts the reconnect cycle) and **Edit Connection** button
- [ ] Progress dots all rendered in the failed (`done`) style
- [ ] Restarting the server (`docker start ws-echo`) and clicking **Retry Now** re-establishes the connection

> **Note:** Validated end-to-end in **browser mode** — stopping the echo server triggers an abnormal `code: 1006` close and the reconnect banner engages ("Reconnecting (attempt N/5)…", progress dots, Cancel). Restarting the server lets the in-progress cycle auto-reconnect and the banner clears. The same flow applies to the **Tauri native** close path. (Earlier a StrictMode `mountedRef` bug suppressed the banner in dev — see Bugs table; now fixed.)

---

## Environment Variable Interpolation

### WC-40: URL with {{wsBaseUrl}} placeholder

**Goal:** Verify environment variable preview in URL

**Steps:**
1. In URL input, type `{{wsBaseUrl}}/ws`
2. Observe any resolved preview

**Expected Results:**
- [ ] Placeholder text `{{wsBaseUrl}}` shown in URL input
- [ ] If an environment is selected: resolved preview shown below input
- [ ] If no environment selected: unresolved warning or placeholder remains as-is

---

### WC-41: Environment selector resolves variables

**Goal:** Verify environment context resolution

**Steps:**
1. In AppHeader, select an environment from the dropdown
2. Type `{{baseUrl}}` in URL input
3. Observe the resolved value

**Expected Results:**
- [ ] `{{baseUrl}}` resolves to the environment's base URL
- [ ] `{{host}}` resolves to the host portion
- [ ] `{{envName}}` resolves to the environment name
- [ ] Preview updates when environment selection changes

---

### WC-42: Unresolved variable warning

**Goal:** Verify warning for unresolved variables

**Steps:**
1. Clear any environment selection
2. Type `{{someVariable}}` in URL input

**Expected Results:**
- [ ] Warning indicator or tooltip showing variable is unresolved
- [ ] Connect still allowed (variable passed as literal if unresolved)

---

### WC-43: Profiles store raw templates

**Goal:** Verify profiles preserve template variables

**Steps:**
1. Type `{{wsBaseUrl}}/ws` in URL input
2. Save as profile "Template Profile"
3. Load the profile later

**Expected Results:**
- [ ] Profile stores `{{wsBaseUrl}}/ws` (raw template, not resolved value)
- [ ] Loading profile fills URL with raw template
- [ ] Resolution happens at connect time based on current environment

---

## Virtualized Message Log

### WC-44: 1000+ messages — smooth rendering

**Goal:** Verify virtualized rendering under load

**Steps:**
1. Connect to echo server
2. Use Load Test or rapidly send 1000+ messages
3. Scroll through the message log

**Expected Results:**
- [ ] Log remains smooth and responsive (no jank)
- [ ] Scrolling doesn't cause DOM explosion
- [ ] Only visible rows are rendered in the DOM
- [ ] Counter shows correct total count

---

### WC-45: Message cap — oldest evicted

**Goal:** Verify message cap behavior

**Steps:**
1. Set message cap to 100 (in profile settings)
2. Send 150+ messages
3. Observe the counter

**Expected Results:**
- [ ] Counter shows "100 / 100 messages" (capped)
- [ ] Oldest messages evicted; newest preserved
- [ ] Cap indicator visible (e.g., badge or text)
- [ ] Scrolling remains smooth

---

### WC-46: Configurable message cap

**Goal:** Verify message cap configuration

**Steps:**
1. Open the **Saved** view and create/edit a profile (or use **Save as Profile** from the Connect tab) to open the Profile Editor
2. Find the **Max Messages** field

**Expected Results:**
- [ ] **Max Messages** is a **number input** (not a discrete dropdown), accepting any value clamped to **100–50,000**
- [ ] The live studio default cap is **10,000** (the compose footer shows e.g. "N / 10000 messages"); a brand-new profile pre-fills **1,000**
- [ ] Changing the cap takes effect immediately for new messages
- [ ] Cap is saved with the connection profile (`maxMessages`)

---

## Connection Auth

> The **Auth** left tab (`data-testid="left-tab-auth"`) configures an auth scheme that is applied when the connection is established. Because browsers can't set custom headers on a WebSocket handshake, any header-based scheme forces the connection through the local proxy (or the native transport in the Tauri desktop app).

### WC-A01: Auth panel layout & type selector

**Goal:** Verify the Auth panel renders with all supported schemes

**Steps:**
1. Open WebSocket Studio in **Client** mode
2. Select the **Auth** left tab

**Expected Results:**
- [ ] Panel heading reads **Connection Auth** with subtitle "Applied when the connection is established"
- [ ] A **Type** dropdown lists: **No Auth** (default), **Basic Auth**, **Bearer Token**, **API Key**, **Digest Auth**, **OAuth2 Client Credentials**
- [ ] With **No Auth** selected, no credential fields and no proxy callout are shown

---

### WC-A02: Bearer Token fields & masked resolved preview

**Goal:** Verify Bearer auth fields and the masked "Will send" preview

**Steps:**
1. On the **Auth** tab, set **Type** = **Bearer Token**
2. Enter a token, e.g. `my-secret-token-abc123`
3. Observe the **Prefix** field and the resolved preview

**Expected Results:**
- [ ] A **Token** field (placeholder `eyJhbGciOi...`) and a **Prefix** field (default value `Bearer`) appear
- [ ] A **Verify Auth** button is shown
- [ ] A resolved preview (`data-testid="ws-auth-resolved"`) shows the masked header, e.g. **Will send:** `` `Authorization: Bearer my-s…c123` `` (token is masked — only the first/last few chars are visible)
- [ ] A browser callout (`data-testid="ws-auth-callout"`) explains: "Browsers can't set custom headers on a WebSocket handshake, so this connection will be routed through the local proxy to apply the auth header. In the desktop app the native transport is used instead."

---

### WC-A03: Auth forces proxy transport (browser)

**Goal:** Verify that configuring header-based auth routes the connection through the proxy

**Steps:**
1. On the **Auth** tab, set **Type** = **Bearer Token** and enter any token
2. On the **Connect** tab, enter `ws://localhost:8765` and click **Connect**
3. Observe the status bar transport badge and the **Console** handshake entry

**Expected Results:**
- [ ] The status bar transport badge shows **Proxy** (not **Direct**) — in the desktop app it shows **Native**
- [ ] The connection establishes successfully (echo server reachable through the proxy)
- [ ] The Console handshake (Raw view) shows the `Authorization` header being sent on the upgrade request

---

## Console

> The **Console** right tab (`data-testid="right-tab-console"`, pane `data-testid="ws-studio-console-pane"`) is a structured event + slash-command console. It surfaces lifecycle, handshake, reconnect, protocol, control, command, and system events, and accepts slash commands on the command line.
>
> **Key testids** (the `ConsolePanel` is rendered with `variant="ws"`): view toggle `ws-console-view-structured` / `ws-console-view-raw`; severity `ws-console-level-all` / `ws-console-level-info` / `ws-console-level-warn` / `ws-console-level-error`; category `ws-console-category`; search `ws-console-search`; count `ws-console-count` (renders `filtered/total`); autoscroll `ws-console-autoscroll`; clear `ws-console-clear`; empty state `ws-console-empty`; command line input `ws-console-cmd-input`; per-entry rows `ws-console-entry-<id>`.

### WC-C01: Console pane layout

**Goal:** Verify the console toolbar and command line render

**Steps:**
1. Open WebSocket Studio, select the **Console** right tab

**Expected Results:**
- [ ] **View** group: **Structured** | **Raw** toggle
- [ ] **Severity** group: **All** | **Info** | **Warn** | **Error**
- [ ] **Category** dropdown: All categories / Lifecycle / Handshake / Reconnect / Protocol / Control / Command / System
- [ ] A **Search console…** box and an entry counter (e.g. `8/8`)
- [ ] Toolbar buttons: **Auto-scroll ✓** | **Copy** | **Export** | **Clear**
- [ ] A command line with placeholder "Type a command, e.g. /help"
- [ ] A hint line: `↑↓ history · /help · /clear · /connect · /disconnect · /ping · /close · /send · /template`

---

### WC-C02: Structured view — lifecycle & handshake entries

**Goal:** Verify structured event rendering on connect

**Steps:**
1. With **Structured** view active, connect to `ws://localhost:8765`

**Expected Results:**
- [ ] A `lifecycle` entry "Connecting to ws://localhost:8765" appears (INFO)
- [ ] A `handshake` entry "101 Switching Protocols" appears and is **expandable** (chevron `›`)
- [ ] A `lifecycle` entry "Connected (Nms)" appears with the handshake latency
- [ ] Each entry shows a timestamp, level (INFO/WARN/ERR), and category

---

### WC-C03: Raw view — curl-style handshake timeline

**Goal:** Verify the Raw view renders the handshake as a request/response timeline

**Steps:**
1. While connected, click the **Raw** view toggle

**Expected Results:**
- [ ] The handshake is shown curl-style: `>` lines for the upgrade request (`GET / HTTP/1.1`, `Host:`, `Connection: Upgrade`, `Upgrade: websocket`, `Sec-WebSocket-Version: 13`), `<` lines for the `101 Switching Protocols` response, and `*` lines for informational notes
- [ ] Toggling back to **Structured** restores the grouped event list

---

### WC-C04: Severity & category filters

**Goal:** Verify the console filters narrow the visible entries

**Steps:**
1. With several entries present, click **Severity → Error**
2. Reset to **All**, then pick **Category → Handshake**

**Expected Results:**
- [ ] **Severity → Error** shows only error-level entries; the counter updates (e.g. `1/12`)
- [ ] **Category → Handshake** shows only handshake entries; the counter updates
- [ ] Resetting to **All** / **All categories** restores the full list

---

### WC-C05: Search filter

**Goal:** Verify console search filters by message text

**Steps:**
1. Type `connected` into the **Search console…** box

**Expected Results:**
- [ ] Only entries whose message matches the query are shown
- [ ] The counter reflects the filtered subset (e.g. `2/12`)
- [ ] Clearing the search restores all entries

---

### WC-C06: `/help` and `/clear` commands

**Goal:** Verify the help and clear slash commands

**Steps:**
1. In the command line, type `/help` and press **Enter**
2. Type `/clear` and press **Enter**

**Expected Results:**
- [ ] `/help` echoes a `command` entry `/help`, followed by an expandable "Available commands (8)" entry listing the slash commands
- [ ] `/clear` empties the console (counter resets to `0/0`)

---

### WC-C07: `/ping` command — transport-gated

**Goal:** Verify `/ping` matches the Compose Ping button's transport gating

**Steps:**
1. Connect to `ws://localhost:8765` in **direct browser mode** (No Auth, no custom headers)
2. In the Console command line, run `/ping`
3. Disconnect, set **Bearer Token** auth (forces proxy), reconnect, and run `/ping` again

**Expected Results:**
- [ ] **Direct mode:** `/ping` reports an **error** — `/ping is not supported here.` (the browser WebSocket API can't send ping frames, mirroring the disabled Compose **Ping** button — see WC-17)
- [ ] **Proxy / native mode:** `/ping` reports `Ping sent.` and a ping frame is dispatched
- [ ] When disconnected, `/ping` reports `Not connected.` regardless of transport

---

### WC-C08: `/connect`, `/disconnect`, `/close`, `/send`, `/template`

**Goal:** Verify the remaining slash commands delegate to studio actions

**Steps:**
1. While disconnected, run `/connect ws://localhost:8765`
2. Run `/send hello`
3. Run `/close 1000 bye`
4. Save a template named `greet`, then while connected run `/template greet`

**Expected Results:**
- [ ] `/connect <url>` sets the draft URL and initiates the connection ("Connecting to …")
- [ ] `/send <data>` sends a message ("Message sent.") when connected; reports `Not connected.` otherwise
- [ ] `/close 1000 bye` closes with code 1000 and reason "bye"; invalid/out-of-range codes are rejected with an error
- [ ] `/template <name>` resolves a saved template case-insensitively and sends it; an unknown name reports an error
- [ ] `/disconnect` closes the connection; reports `Not connected.` when already closed

---

### WC-C09: Command history & console Export

**Goal:** Verify history navigation and console export

**Steps:**
1. Run a few commands, then press **↑** / **↓** in the command line
2. Click the toolbar **Export** button

**Expected Results:**
- [ ] **↑** / **↓** cycle through previously entered commands
- [ ] **Export** saves the visible console entries (respecting active filters) to a JSON file
- [ ] **Copy** copies the visible entries to the clipboard

---

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| 2026-06-10 | WC-03 | Connect button disabled when URL is empty (plan said "enabled") | By design — prevents connecting to empty URL | Updated WC-03 expected results to reflect correct behavior |
| 2026-06-10 | WC-17 | Ping button disabled in direct browser mode | Browser WebSocket API doesn't expose ping frames | Documented that Ping requires proxy or native transport mode |
| 2026-06-10 | WC-39a | Auto-reconnect banner did not engage in **browser mode** — stopping the server produced an immediate `CLOSE ACK — code: 1006` and the connection went straight to Disconnected (no reconnect cycle) | React 18 StrictMode double-mount: `useWebSocketStudio` cleanup effect set `mountedRef.current = false` but the empty-dep mount effect never reset it to `true` on remount, so `scheduleReconnect`'s `!mountedRef.current` guard always early-returned in dev | **Fixed** — mount effect now sets `mountedRef.current = true` on (re)mount in `useWebSocketStudio.ts`. Re-validated in browser: banner engages on 1006 close and auto-reconnects on server restart. |
| 2026-06-11 | WC-24 | Doc claimed every exported message includes a `bookmarked` field | Export only adds `bookmarked: true` to bookmarked messages; the key is omitted otherwise. The Import button imports Phase 11 recordings (asymmetric) | Corrected exported-key list + added asymmetry note |
| 2026-06-11 | WC-26 | Doc implied "Save as Profile" just prompts for a name | It opens a full New Profile editor in the Saved view (incl. Max Messages, Notes) | Rewrote WC-26 to describe the editor + card actions (Load/Edit/Dup/Del) |
| 2026-06-11 | WC-27 | Doc said load by clicking the profile | Loading is via an explicit **Load** button; a resolved-URL preview is shown | Updated WC-27 |
| 2026-06-11 | WC-28 | Doc said delete via "×" + modal confirm | Delete is a **Del** text button with inline **Confirm/No** (no modal) | Updated WC-28 |
| 2026-06-11 | WC-29a/b/c | Dup (duplicate), Edit, and Paste JSON profile actions were undocumented | Card actions are Load/Edit/Dup/Del; footer has Paste JSON | Added WC-29a (Dup), WC-29b (Edit), WC-29c (Paste JSON) |
| 2026-06-11 | WC-04 | Status bar transport/protocol/uptime badges undocumented | Status bar shows latency, Uptime, Raw (protocol), Direct/Proxy (transport) | Added badge expectations to WC-04 |
| 2026-06-12 | WC-C07 | Console `/ping` reported `Ping sent.` in **direct browser mode** even though the Compose **Ping** button is disabled there (and `sendPing()` silently no-ops without a proxy connection id) | `buildWsConsoleCapabilities` always wired the `ping` capability regardless of transport, and `useConsoleCommands` checked `caps.ping` existence before the connection state | **Fixed** — `wsConsoleCapabilities.ts` now omits `ping` when `transportMode === 'direct'`, and `useConsoleCommands.ts` checks `isConnected` before the unsupported-capability guard. Direct mode now reports `/ping is not supported here.`; proxy/native send a real ping. Re-validated live in Chrome (direct → not supported, Bearer/proxy → Ping sent). |
| 2026-06-12 | WC-08 | Doc claimed connecting with a `json` subprotocol "succeeds" | The local `jmalloc/echo-server` does not negotiate subprotocols, so the browser correctly fails the connection with `Server sent no subprotocol [WS_CONNECT_FAILED]` (spec-compliant) | Rewrote WC-08 to cover both negotiated-success and not-negotiated-failure cases and noted the echo-server limitation. Re-validated live in Chrome. |
| 2026-06-12 | WC-25/26/27/28/29* | Saved-view labels drifted from the doc | Shipped UI uses heading **Saved Profiles · N**, footer actions **Import / Paste / Export** (not "Import File / Paste JSON / Export All"), and card actions **Load & Connect / Edit / Duplicate / Delete** (not "Load / Edit / Dup / Del"). The New Profile editor saves with **Save Profile**; the **Edit Profile** editor saves with **Save Changes**. **Load & Connect** also auto-connects (doesn't just fill the form) | Updated WC-25–29c to the shipped labels/behavior. Re-validated live in Chrome (save, duplicate→count 2, edit-in-place, delete inline Confirm/No→count 1, Paste JSON→"Imported 1 profile"). |
| 2026-06-13 | WC-31/32/33/35 | The **Templates ▾** dropdown was invisible/unclickable. Its content was present in the DOM (and JS-click worked) but a real user saw nothing and clicks landed on the studio mode/tab bars | `.ws-template-dropdown` used `bottom: 100%` (opened **upward**) but the Templates trigger sits in the **top** compose toolbar, so the dropdown opened into the `ws-studio-modes`/`ws-studio-tabs` bars and was clipped by the ancestor `overflow: hidden` on `.ws-studio-left`/`.ws-studio-left-body` | **Fixed** — `websocket-studio.css` flipped `.ws-template-dropdown` to open **downward** (`top: 100%`, `margin-top`, downward `box-shadow`). Re-validated live in Chrome: header/item/preview/format badge/delete ×/name field/Save are all visible and `elementFromPoint` at the Save button returns the Save button (no interception). The bottom-anchored `.ws-close-code-dropdown` correctly stays upward (verified not clipped). |
| 2026-06-13 | WC-46 | Doc claimed the message cap was a discrete dropdown (100/500/1,000/10,000/50,000) | Max Messages is a free **number input** clamped 100–50,000 in the Profile Editor; the live studio default is 10,000 but a new profile pre-fills 1,000 | Rewrote WC-46 to describe the number input, clamp range, and the two defaults (studio 10,000 vs new-profile 1,000). |
| 2026-06-13 | Pass 3 export | `docs/test-data/ws-core-connect-export.json` was **not importable** — it was wrapped in `{ _exportMeta, data: { profiles, templates, testMessages, schemas } }` with **nested** `autoReconnect: { enabled, maxRetries, initialDelay, backoffMultiplier }` objects | The Saved-profiles importer (`useWebSocketProfiles.importProfiles`) requires a **bare JSON array** of profiles (`!Array.isArray(parsed)` → "Expected a JSON array of profiles") with **flat** `autoReconnect` (boolean), `maxReconnectAttempts`, `reconnectIntervalMs`, `backoffMultiplier` (1/1.5/2), and `enabled` on header/queryParam entries. There is no template/schema JSON-import path at all | **Fixed** — rewrote the export file as a bare importable array matching the real `exportProfiles()` output; moved the non-importable templates/testMessages/schemas fixtures to a new `docs/test-data/ws-core-connect-reference.json`. Re-validated live in Chrome: Paste import reported **"Imported 6"** (2→8 cards); the Auto-Reconnect profile round-tripped with reconnect checked and 5/3000/10000 fields intact, and the env-template profile preserved the raw `{{wsBaseUrl}}/ws`. |
| 2026-06-13 | WC-31/32/35 | The **Templates ▾** dropdown looked unpolished: format labels (JSON/TEXT) hung orphaned on their own line under each item, row heights were inconsistent, and the delete **×** had a heavy full-height divider line | The format was a plain stacked `<span>` below the preview and the delete button used a permanent `border-left` divider and was always visible | **Cosmetic fix** — `useWebSocketCompose.tsx` now renders a per-item head row (name + format **pill badge**); `websocket-studio.css` styles `.ws-template-item-format` as a rounded pill (JSON = blue, TEXT = neutral, Binary = purple), gives items consistent padding and a rounded per-row hover highlight, and reveals the delete **×** only on row hover (divider removed). Verified live in Chrome with 3 templates. |

---

## E2E Test Summary

**Spec file:** `e2e/ws-core-connect.spec.ts` — 42 tests
**Run command:** `npx playwright test e2e/ws-core-connect.spec.ts --reporter=list`
**Prerequisites:** Backend on 3001 (`npm run server`), Vite on 5173 (`npm run dev`), Docker echo on 8765

| Test | Scenario(s) | Status |
|---|---|---|
| WC-01 | Activity bar → Protocols → WebSocket sub-nav | ✅ |
| WC-02 | Page layout — tab bar, mode switch, split pane | ✅ |
| WC-03 | Initial state — URL input, status, buttons | ✅ |
| WC-04 | Connect to echo server | ✅ |
| WC-05 | Disconnect from echo server | ✅ |
| WC-06 | Connect with custom headers (proxy mode) | ✅ |
| WC-07 | Connect with query parameters | ✅ |
| WC-09 | Connect to invalid URL | ✅ |
| WC-11 | Send text message | ✅ |
| WC-12 | Echo server response | ✅ |
| WC-13 | Cmd+Enter shortcut sends message | ✅ |
| WC-14 | Send JSON message — auto-detection | ✅ |
| WC-15 | Format selector — Text / JSON / Binary | ✅ |
| WC-16 | Send binary message | ✅ |
| WC-16a | Type badge inference (content-based) | ✅ |
| WC-18 | Send button disabled states | ✅ |
| WC-20 | Direction filter | ✅ |
| WC-21 | Text search | ✅ |
| WC-22 | Click message → detail panel | ✅ |
| WC-23 | Clear messages | ✅ |
| WC-24 | Export messages as JSON | ✅ |
| WC-25 | Saved mode — empty state | ✅ |
| WC-26 | Save current connection as profile | ✅ |
| WC-27 | Load profile → fills form & connects | ✅ |
| WC-28 | Delete profile | ✅ |
| WC-29a | Duplicate a profile | ✅ |
| WC-30 | Config lock while connected | ✅ |
| WC-31 | Save message template | ✅ |
| WC-32 | Load template → fills compose bar | ✅ |
| WC-33 | Delete template | ✅ |
| WC-36 | Auto-reconnect settings UI | ✅ |
| WC-38 | Close with code/reason | ✅ |
| WC-40 | URL with {{wsBaseUrl}} placeholder | ✅ |
| WC-A01 | Auth panel layout & type selector | ✅ |
| WC-A02 | Bearer Token fields & masked preview | ✅ |
| WC-A03 | Auth forces proxy transport (browser) | ✅ |
| WC-C01 | Console pane layout | ✅ |
| WC-C02 | Structured view — lifecycle & handshake | ✅ |
| WC-C06 | /help and /clear commands | ✅ |
| WC-C07 | /ping command — transport-gated | ✅ |
| WC-C08 | /send command | ✅ |
| WC-C08b | /connect and /disconnect commands | ✅ |

### Not Automated (manual or environment-specific)
- WC-08: Subprotocol negotiation (echo server doesn't negotiate)
- WC-10/10a: WSS/TLS connect (requires TLS Docker stack)
- WC-17: Ping button (proxy mode only)
- WC-19: Auto-scroll to bottom (visual observation)
- WC-29/29b/29c: Import/Export/Edit/Paste profiles
- WC-34/35: Template persistence / dropdown
- WC-37: Auto-reconnect on server disconnect (requires server restart)
- WC-39/39a: Reconnect controls & banners
- WC-41–45: Environment variables, unresolved warnings, profiles

---

## Appendix: `data-testid` & Selector Reference

**Connection & Status:**
- `ws-studio-shell` — main shell container
- `conn-tab-bar` — connection tab bar
- `connect-btn` / `disconnect-btn` — connect/disconnect buttons
- `disconnect-caret` — disconnect dropdown caret (Close with Code)
- `status-badge` — connection status (Disconnected/Connected/Error)
- `transport-badge` — transport mode (Direct/Proxy/Native)
- `protocol-badge` — detected protocol badge
- `protocol-select` — protocol selector dropdown

**Left-Pane Tabs:**
- `left-tab-connect` / `left-tab-params` / `left-tab-auth` / `left-tab-headers` / `left-tab-compose` — left pane tab switches

**Right-Pane Tabs:**
- `right-tab-events` / `right-tab-console` / `right-tab-stats` / `right-tab-loadtest` / `right-tab-schema` — right pane tab switches

**Messages & Events:**
- `message-list` — message list container
- `messages-status-bar` — status bar with counters
- `counters` — message count display
- `detail-panel` — message detail panel
- `search-input` — search text input
- `filter-toggle-btn` — filters toggle
- `clear-btn` — clear messages
- `export-messages-btn` — export messages as JSON
- `send-btn` — send message button
- `ping-btn` — ping button
- `format-select` — message format selector (Text/JSON/Binary)

**Auth Tab:**
- `ws-auth-callout` — proxy-required callout
- `ws-auth-resolved` — resolved auth preview (masked)

**Close with Code:**
- `close-code-input` — close code input
- `close-reason-input` — close reason input
- `close-with-code-btn` — close with code button

**Auto-Reconnect:**
- `auto-reconnect-toggle` — auto-reconnect on/off
- `reconnect-interval-ms` — reconnect interval input
- `max-reconnect-attempts` — max attempts input
- `backoff-multiplier` — backoff multiplier input

**Saved Profiles:**
- `mode-client` / `mode-mock` / `mode-saved` — mode switches
- `new-profile-btn` — new profile button
- `profile-name-input` — profile name in editor
- `profile-save-btn` — save profile button
- `save-as-profile-btn` — save current connection as profile

**Templates:**
- `template-trigger` — Templates ▾ dropdown trigger
- `template-dropdown` — dropdown container
- `template-list` — template list
- `template-save-btn` — save template button
- `template-save-name` — template name input

**Console:**
- `ws-console` — console container
- `ws-console-cmd-input` — command line input
- `ws-console-view-structured` / `ws-console-view-raw` — view toggles
- `ws-console-level-all` / `ws-console-level-info` / `ws-console-level-warn` / `ws-console-level-error` — severity filters

---

## Test Data Export

- `docs/test-data/ws-core-connect-export.json` — a **bare JSON array** of connection profiles, directly importable via the Saved view **Import** / **Paste** buttons (round-trips with `exportProfiles()`). Verified: Paste import → "Imported 6".
- `docs/test-data/ws-core-connect-reference.json` — reference fixtures (message templates, test messages, JSON schemas) that are **not** importable through the profiles flow; use them by typing into compose, the Templates ▾ dropdown, or the Schema tab.

---

## Tauri Desktop Validation (2026-06-13)

The full WC-* sweep was re-validated live in the **Tauri desktop app** (macOS) in addition to the web (Chrome) pass. No Tauri-specific regressions were found.

- **Templates ▾ dropdown** (WC-31–35): the CSS fix renders identically in the desktop webview — the dropdown opens **downward** and is fully visible/clickable (`getComputedStyle(...).top === "28px"`, `elementFromPoint` at the name field returns the input, no interception).
- **Pass 3 profile import**: Paste-importing the bare-array `ws-core-connect-export.json` reported **"Imported 6 profiles"** (Tauri starts at 0, uses **FS persistence** rather than localStorage). The Auto-Reconnect profile round-tripped (detail pane shows AUTO-RECONNECT: auto-reconnect) and the Environment Template kept the raw `{{wsBaseUrl}}/ws`.
- **Native transport connect/send/echo**: the status pill is labelled **Native** (not Direct/Proxy). `/connect` produced `101 Switching Protocols` → `Connected (4ms)`; `/send hello-from-tauri` round-tripped through the echo server with the Events tab showing both `↑ TEXT hello-from-tauri` and `↓ TEXT hello-from-tauri` (status `↑1 ↓1`). This exercises the Tauri `tokio-tungstenite` path with **no** Express proxy.
- **Driver note (for future Tauri passes):** simulating a JS `.click()` on the **Connect** button via the webview did not fire the connection (React synthetic-event gesture); driving the console command input (`.ws-console-cmd-input`) with `/connect`, `/send …`, `/disconnect` works reliably instead.
