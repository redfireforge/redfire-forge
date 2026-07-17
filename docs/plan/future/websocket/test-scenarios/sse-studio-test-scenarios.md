# SSE Studio — Test Scenarios

> **File:** `sse-studio-test-scenarios.md`
> **Covers:** Phase 18 — SSE (Server-Sent Events) Support
> **Last verified:** 2026-06-13 (Chrome + Tauri, Playwright 16/16 pass, macOS)
> **Result:** 16/16 scenarios pass
> **Requires:** SSE test server running on port 3002

---

## Quick Start

### 1. Start the App

Open **three** terminals in the project root:

```bash
# Terminal 1 — Backend server
npm run server

# Terminal 2 — Frontend dev server
npm run dev

# Terminal 3 — SSE test server
node -e "
const http = require('http');
let id = 0;
http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    const interval = setInterval(() => {
      id++;
      const type = ['message','update','alert'][id % 3];
      res.write('id: ' + id + '\n');
      res.write('event: ' + type + '\n');
      res.write('data: ' + JSON.stringify({id, type, time: new Date().toISOString()}) + '\n\n');
    }, 1500);
    req.on('close', () => clearInterval(interval));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(3002, () => console.log('SSE server on port 3002'));
"
```

### 2. Navigate to SSE Studio

1. Open your browser to **http://localhost:5173**
2. In the sidebar, click **Protocols**
3. Click the **SSE** sub-nav tab at the top (next to Kafka and WebSocket)

### 3. What You Should See

The SSE Studio page is split into two resizable panes:

**Top bar:**
- A **URL input** with placeholder `https://api.example.com/events`
- A green **Connect** button on the right
- A **status strip** below: "Disconnected · Auto-reconnect: On · Events: 0"

**Left pane — two tabs:**
- **Connect** tab (default) — Headers section with a `+ Add` button, and a Reconnect card
- **Auth** tab — Connection Auth with a Type dropdown ("No Auth")

**Right pane — two tabs:**
- **Events** tab (default) — Toolbar: search input, "All types" dropdown, ★ 0 bookmark badge, Export button, Clear button. Empty area: "Waiting for events…"
- **Console** tab — Structured log view with Structured/Raw toggle, severity filters (All/Info/Warn/Error), category dropdown, search, and commands (Auto-scroll, Copy, Export, Clear)

**Footer:**
- Events: 0 · Showing: 0 · Uptime: —

Each **event row** (when connected) has this visual layout:

| Element | Where | What It Looks Like |
|---|---|---|
| Bookmark button | Far left | ☆ (empty star) — click to toggle to ★ (filled) |
| Timestamp | After bookmark | e.g., `12:51:35 AM` |
| Type badge | After timestamp | Color-coded label: `message` (blue), `update` (orange), `alert` (red) |
| Data preview | Center | JSON preview in monospace, truncated to one line |
| Size | Far right | e.g., `60B`, `59B` |

---

## SE-01: SSE Entry in Protocols Sub-Nav

**Goal:** Verify SSE navigation works from the sidebar.

1. Click **Protocols** in the left activity bar
2. Look at the sub-navigation tabs at the top of the page
3. ✅ Sub-nav shows three tabs: **Kafka** | **WebSocket** | **SSE**
4. ✅ Clicking **SSE** activates the SSE Studio page
5. ✅ URL changes to `?tab=sse-studio`

---

## SE-02: SSE Studio Page Layout

**Goal:** Verify all SSE Studio UI elements are present.

1. Navigate to SSE Studio (Protocols → SSE)
2. Check the page structure:
3. ✅ Left pane shows **Connect** and **Auth** tabs
4. ✅ Right pane shows **Events** and **Console** tabs
5. ✅ URL input with placeholder `https://api.example.com/events`
6. ✅ Green **Connect** button (right side of URL bar)
7. ✅ Status strip shows "Disconnected · Auto-reconnect: On · Events: 0"
8. ✅ Events toolbar has: search input, "All types" dropdown, ★ 0 badge, Export, Clear
9. ✅ "Waiting for events…" placeholder in the events area
10. ✅ Footer shows: Events: 0 · Showing: 0 · Uptime: —

---

## SE-03: Connect and Disconnect

**Goal:** Verify SSE connection lifecycle.

1. Type `http://localhost:3002/events` in the URL input
2. Click **Connect**
3. ✅ Status changes to **"Connected"** with a green indicator
4. ✅ Button text changes to **"Disconnect"**
5. ✅ Events start appearing in the events list (one every ~1.5 seconds)
6. ✅ Events counter in status strip increments
7. ✅ Uptime starts counting (e.g., "5s", "10s")
8. Click **Disconnect**
9. ✅ Status returns to **"Disconnected"**
10. ✅ Button returns to **"Connect"**
11. ✅ Events stop arriving

---

## SE-04: Custom Headers and Auth Tab

**Goal:** Verify headers can be added and the Auth tab is functional.

1. On the **Connect** tab (left pane), click **+ Add** under Headers
2. ✅ A new row appears with **Key** and **Value** inputs, a ✓ (save) button, and a 🗑️ (delete) button
3. ✅ A **Delete all** button appears above the header list
4. Type `Authorization` as the key and `Bearer test-token` as the value
5. Click ✓ to save the header
6. Click the **Auth** tab (left pane)
7. ✅ Auth tab shows "Connection Auth" with a description: "Applied when the connection is established"
8. ✅ Type dropdown shows "No Auth" (default)

---

## SE-05: Event List Display

**Goal:** Verify events render correctly in the events list.

1. Connect to `http://localhost:3002/events` and wait for 10+ events
2. Scroll through the event list
3. ✅ Each event row shows: bookmark button (☆), timestamp, type badge, JSON data preview, size in bytes
4. ✅ Type badges are color-coded: `message` (blue), `update` (orange), `alert` (red)
5. ✅ Data preview shows truncated JSON (e.g., `{"id":14,"type":"message","time":"2026-06-13T04:51:35.466Z"}`)
6. ✅ Size shows byte count (e.g., `60B`, `59B`, `58B`)
7. ✅ Smooth scrolling — no flickering or DOM explosion with many events

---

## SE-06: Event Detail Panel

**Goal:** Verify clicking an event shows its full detail.

1. Click any event row in the events list
2. ✅ An **Event Detail** panel appears below the events list
3. ✅ Detail shows: **TYPE** (badge), **LAST-EVENT-ID** (number), **SIZE** (bytes), **TIMESTAMP**
4. ✅ **DATA** section shows the full event payload
5. ✅ A close button (✕) dismisses the detail panel

---

## SE-07: JSON Auto-Detection

**Goal:** Verify JSON events are pretty-printed in the detail panel.

1. Click on any event (the test server sends JSON data)
2. ✅ A **JSON** badge appears next to the "DATA" label
3. ✅ The JSON is pretty-printed with proper indentation:
   ```json
   {
     "id": 14,
     "type": "message",
     "time": "2026-06-13T04:51:35.466Z"
   }
   ```
4. ✅ Non-JSON events (if any) would show as raw text without the JSON badge

---

## SE-08: Clear and Export

**Goal:** Verify event log management buttons.

1. With events in the list, click **Clear**
2. ✅ All events are removed
3. ✅ Events counter resets to 0
4. ✅ Footer shows: Events: 0 · Showing: 0
5. Wait for new events to arrive, then click **Export**
6. ✅ A JSON file is downloaded containing all current events

---

## SE-09: Text Search

**Goal:** Verify real-time search filtering across event data.

1. With events in the log, type `alert` in the **Search events…** input
2. ✅ Only events containing "alert" in their data are shown
3. ✅ The Showing count in the footer decreases (fewer than total Events)
4. ✅ Search is case-insensitive
5. Clear the search input
6. ✅ All events reappear

---

## SE-10: Event Type Filter

**Goal:** Verify filtering events by their SSE event type.

1. Click the **All types** dropdown in the toolbar
2. ✅ Options include: All types, alert, message, update (auto-populated from received events)
3. Select **update**
4. ✅ Only events with the `update` type badge are shown
5. ✅ The Showing count in the footer updates accordingly
6. Switch back to **All types**
7. ✅ All events reappear

---

## SE-11: Bookmark Toggle

**Goal:** Verify event bookmarking and bookmark filter.

1. Click the ☆ (star) button on any two event rows
2. ✅ The star fills in: ☆ → ★
3. ✅ The bookmark badge in the toolbar updates: **★ 2**
4. Click the **★ 2** badge to filter
5. ✅ Only the 2 bookmarked events are shown
6. ✅ Footer Showing count matches the bookmark count
7. Click the **★ 2** badge again to unfilter
8. ✅ All events reappear

---

## SE-12: Auto-Reconnect

**Goal:** Verify the client automatically reconnects when the server drops.

1. Connect to the SSE endpoint and receive some events
2. In the Reconnect section (left pane), verify:
   - ✅ **Auto-reconnect** toggle is on (blue checkmark)
   - ✅ **Retry interval: 3000ms** · **Max 10 attempts**
3. Stop the SSE test server (Ctrl+C in Terminal 3)
4. ✅ Status changes to indicate disconnection or reconnecting
5. ✅ Console tab logs the stream closing
6. Restart the SSE test server (run the same command again)
7. ✅ Client automatically reconnects within the retry interval
8. ✅ Events resume flowing

---

## SE-13: Last-Event-ID Persistence

**Goal:** Verify the last event ID is tracked and shown.

1. Connect and receive events — note the IDs in the data (e.g., id: 14, 15, 16…)
2. ✅ Footer shows **Last-Event-ID:** followed by the latest event ID number
3. ✅ Status strip shows the same Last-Event-ID value
4. Disconnect
5. ✅ Last-Event-ID is preserved in the status strip after disconnecting
6. Reconnect
7. ✅ The reconnection sends `Last-Event-ID` header, allowing the server to resume

---

## SE-14: Connection Stats Footer

**Goal:** Verify the footer statistics update in real time.

1. While connected, observe the footer bar at the bottom
2. ✅ **Events:** total count of events received (increments in real time)
3. ✅ **Showing:** number of events currently visible (changes with filters)
4. ✅ **Uptime:** time since connection (e.g., "10s", "1m 45s")
5. ✅ **Last-Event-ID:** latest event ID from the server
6. ✅ **Types:** breakdown by event type (e.g., `alert(7), message(9), update(7)`)

---

## SE-15: Console Tab

**Goal:** Verify the Console tab shows structured connection logs.

1. Click the **Console** tab (right pane)
2. ✅ Log shows structured entries with timestamps and severity badges:
   - `lifecycle` **INFO** — "Connecting to http://localhost:3002/events"
   - `handshake` **INFO** — "200 OK — stream open"
   - `lifecycle` **INFO** — "Stream closed" (after disconnect)
3. ✅ Toolbar has: **Structured** / **Raw** toggle, severity filters (**All** / **Info** / **Warn** / **Error**)
4. ✅ **All categories** dropdown for filtering by log category
5. ✅ Search input for searching console entries
6. ✅ **Auto-scroll** toggle (enabled by default), **Copy**, **Export**, **Clear** buttons
7. ✅ Bottom bar shows a command input: "Type a command, e.g. /help"
8. ✅ Quick command shortcuts: `/help` · `/clear` · `/connect` · `/disconnect`

---

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| (prior) | SE-12 | HTTP errors didn't trigger auto-reconnect | `maybeReconnect()` not called in error path | Added `maybeReconnect()` call after `updateState('error')` |
| (prior) | SE-12 | null body response didn't trigger reconnect | `!response.body` path missing `maybeReconnect()` | Added `maybeReconnect()` in null-body error path |
| (prior) | SE-12 | Reconnect overwrote error state | `maybeReconnect()` called `updateState('disconnected')` | Changed to update `reconnectAttempt` counter only |

> **Note:** No new bugs were found during 2026-06-13 testing. All 15 scenarios pass in both Chrome and Tauri.

---

## E2E Test Summary

**Spec file:** `e2e/sse-studio.spec.ts` — 16 tests
**Run command:** `npx playwright test e2e/sse-studio.spec.ts --reporter=list`
**Prerequisites:** Backend on 3001 (`npm run server`), SSE test server on 3002, Vite on 5173
**Last validated:** 2026-06-13

| Test | Scenario | Status |
|---|---|---|
| SE-01 | SSE entry in Protocols sub-nav | ✅ |
| SE-02 | SSE Studio layout — split pane, tabs | ✅ |
| SE-03 | Connect and disconnect | ✅ |
| SE-04 | Auth tab visible | ✅ |
| SE-05 | Events appear with type badges | ✅ |
| SE-06 | Click event → detail panel | ✅ |
| SE-07 | JSON events auto-detected | ✅ |
| SE-08 | Clear and export | ✅ |
| SE-09 | Text search across events | ✅ |
| SE-10 | Event type filter | ✅ |
| SE-11 | Bookmark toggle | ✅ |
| SE-14 | Connection stats in status strip | ✅ |
| SE-15 | Console tab layout | ✅ |
| SE-15b | Console lifecycle entries on connect | ✅ |
| SE-15c | Console /help command | ✅ |
| SE-15d | Console /clear command | ✅ |

### Not Automated (require manual testing)
- Auto-reconnect behavior on server disconnect
- Auth token injection (requires real auth server)
- Large event volume performance

---

## Appendix: `data-testid` & Selector Reference

| Element | Selector |
|---|---|
| Page container | `sse-studio` |
| Shell layout | `sse-studio-shell` |
| Top bar | `sse-studio-topbar` |
| URL input | `sse-url-input` |
| Connect / Disconnect button | `sse-connect-btn` |
| Status strip | `sse-studio-status-strip` |
| State label | `sse-state-label` |
| Left tab: Connect | `sse-left-tab-connect` |
| Left tab: Auth | `sse-left-tab-auth` |
| Right tab: Events | `sse-right-tab-events` |
| Right tab: Console | `sse-right-tab-console` |
| Config body (connect tab) | `sse-config-body` |
| Auth resolved preview | `sse-auth-resolved` |
| Message log container | `sse-message-log` |
| Search input | `sse-search` |
| Type filter dropdown | `sse-type-filter` |
| Bookmark filter badge | `sse-bookmark-filter` |
| Export button | `sse-export-btn` |
| Clear button | `sse-clear-btn` |
| Event list | `sse-list-container` |
| Event row | `sse-event-row` |
| Event detail panel | `sse-event-detail` |
| Split pane | `sse-studio-split` |
| Console pane | `sse-console-pane` |
| Console command input | `sse-console-cmd-input` |

> **Note:** SSE events are transient. Use the **Export** button to save event data as JSON during testing.
