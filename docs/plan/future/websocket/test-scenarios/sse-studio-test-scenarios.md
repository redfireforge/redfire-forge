# SSE Studio Test Scenarios

> **File:** `sse-studio-test-scenarios.md`
> **Covers:** Phase 18 — SSE (Server-Sent Events) Support
> **Created:** 2026-06-10
> **Tested on:** Web (Chrome), Tauri (macOS)
> **Docker:** SSE test server (or simple Node.js SSE endpoint)
>
> **2026-06-12 — Shell-IA doc refresh:** SSE Studio now uses a split-pane shell — **left-pane tabs** (Connect | Auth) and **right-pane tabs** (Events | Console), plus an SSE command line. The flat single-column layout was replaced. Visual re-validation deferred to the merge gate.

---

## Before You Start

### SSE Test Server

For testing SSE, you need a server that emits Server-Sent Events. Options:

**Option A: Use the built-in backend SSE endpoint (if available)**
```bash
npm run server       # Backend server may include SSE test endpoints
```

**Option B: Quick Node.js SSE server**
```bash
# Create a simple SSE server for testing
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
    }, 2000);
    req.on('close', () => clearInterval(interval));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(3002, () => console.log('SSE server on port 3002'));
" &
# → http://localhost:3002/events
```

### Dev Server

```bash
npm run dev          # Frontend → http://localhost:5173
```

### Navigation

1. Open **http://localhost:5173** → **Protocols** → **SSE**
2. SSE Studio page renders with URL input, headers, and event log

---

## Navigation & Connection

### SE-01: SSE entry in Protocols sub-nav

**Goal:** Verify SSE navigation

**Steps:**
1. Click **Protocols** in the left activity bar
2. Observe the sub-navigation tabs

**Expected Results:**
- [ ] Sub-nav shows three tabs: **Kafka** | **WebSocket** | **SSE**
- [ ] Clicking **SSE** activates the SSE Studio page
- [ ] URL changes to `?tab=sse-studio`

---

### SE-02: SSE Studio page layout

**Goal:** Verify SSE Studio UI elements

**Steps:**
1. Navigate to SSE Studio
2. Observe the page structure

**Expected Results:**
- [ ] Left pane shows **Connect** and **Auth** tabs; right pane shows **Events** and **Console** tabs
- [ ] On the **Connect** left tab: URL input with placeholder "https://api.example.com/events"
- [ ] **Connect** button (disabled when URL empty)
- [ ] **Headers** button for adding custom HTTP headers (or the **Auth** left tab for auth/headers)
- [ ] Connection status indicator: "Disconnected"
- [ ] **Events** right tab: event log area with toolbar (search, type filter, bookmark, export, clear)
- [ ] **Console** right tab available for SSE command-line history
- [ ] An SSE command line is present below the panes
- [ ] Footer: Events: 0, Showing: 0, Uptime: —

---

### SE-03: Connect to SSE endpoint

**Goal:** Verify SSE connection

**Steps:**
1. Type `http://localhost:3002/events` in URL input
2. Click **Connect**

**Expected Results:**
- [ ] Connection established via `fetch()` + `ReadableStream` (not EventSource API)
- [ ] Status transitions to "Connected"
- [ ] Events start appearing in the event log
- [ ] Each event shows: type badge (color-coded), data preview, timestamp
- [ ] Events counter increments

---

### SE-04: Custom headers support

**Goal:** Verify custom headers via fetch-based implementation

**Steps:**
1. Click **Headers** button
2. Add header: `Authorization: Bearer test-token`
3. Connect to SSE endpoint

**Expected Results:**
- [ ] Headers sent with the `fetch()` request
- [ ] Connection succeeds with custom headers
- [ ] This works because SSE uses `fetch()` (not `EventSource` which doesn't support headers)

---

## Event Log

### SE-05: Virtualized event list

**Goal:** Verify event rendering

**Steps:**
1. While connected, let 20+ events arrive
2. Scroll through the event log

**Expected Results:**
- [ ] Virtualized rendering (smooth scrolling, no DOM explosion)
- [ ] Each event row shows:
  - Event type badge (color-coded by type)
  - Data preview (truncated for long messages)
  - Timestamp

---

### SE-06: Click event → detail panel

**Goal:** Verify event detail view

**Steps:**
1. Click an event row

**Expected Results:**
- [ ] Detail panel opens
- [ ] Shows full event data
- [ ] Event type displayed
- [ ] Event ID shown (if present)
- [ ] Retry value shown (if present from server)

---

### SE-07: JSON events auto-detected

**Goal:** Verify JSON pretty-printing

**Steps:**
1. Receive events with JSON data payloads
2. Click on a JSON event

**Expected Results:**
- [ ] JSON events auto-detected by content
- [ ] Detail panel shows pretty-printed JSON (indented, syntax-highlighted)
- [ ] Non-JSON events shown as raw text

---

### SE-08: Clear and Export buttons

**Goal:** Verify log management

**Steps:**
1. With events in log, click **Clear**
2. Receive more events, then click **Export**

**Expected Results:**
- [ ] **Clear:** All events removed, counter resets to 0
- [ ] **Export:** JSON file downloaded containing all events
- [ ] Export format: array of event objects with type, data, id, timestamp

---

## Filtering & Bookmarks

### SE-09: Text search across events

**Goal:** Verify event search

**Steps:**
1. With events in log, type a search query in the search input

**Expected Results:**
- [ ] Events matching the search text are shown/highlighted
- [ ] Non-matching events filtered out
- [ ] Search covers event data content
- [ ] Case-insensitive matching

---

### SE-10: Event type filter

**Goal:** Verify type-based filtering

**Steps:**
1. Find the type filter dropdown (next to search)
2. Observe the options

**Expected Results:**
- [ ] Default: "All types" (shows everything)
- [ ] Auto-populated with received event types (e.g., "message", "update", "alert")
- [ ] Selecting a type shows only events of that type
- [ ] Type count shown next to each option

---

### SE-11: Bookmark toggle

**Goal:** Verify SSE event bookmarks

**Steps:**
1. Click the ★ button on an event row
2. Click the bookmark filter button (★ N) in toolbar

**Expected Results:**
- [ ] Clicking ★ toggles bookmark on the event
- [ ] Bookmark counter in toolbar updates
- [ ] Filtering by bookmarks shows only bookmarked events
- [ ] Bookmarks work similarly to WebSocket message bookmarks

---

## Auto-Reconnect & Stats

### SE-12: Auto-reconnect with Last-Event-ID

**Goal:** Verify SSE auto-reconnect behavior

**Steps:**
1. Connect to SSE endpoint
2. Receive several events (note the latest event ID)
3. Kill the SSE server (Ctrl+C or stop process)
4. Restart the SSE server

**Expected Results:**
- [ ] Connection drops → auto-reconnect triggers
- [ ] Reconnect includes `Last-Event-ID` header with the last received event ID
- [ ] Server can use `Last-Event-ID` to resume from where the client left off
- [ ] Configurable retry delay applied between reconnect attempts

---

### SE-13: Last-Event-ID in status bar

**Goal:** Verify event ID display

**Steps:**
1. While connected, observe the status bar

**Expected Results:**
- [ ] Last-Event-ID displayed in status bar or connection info
- [ ] Updates as new events with IDs arrive
- [ ] Shows "—" when no events with IDs received

---

### SE-14: Connection stats

**Goal:** Verify SSE statistics

**Steps:**
1. While connected, observe the footer stats

**Expected Results:**
- [ ] **Event count:** Total events received
- [ ] **Events/sec:** Current event rate
- [ ] **Uptime:** Duration since connection established
- [ ] **Event type breakdown:** Count per event type

---

## Environment Variable Interpolation

### SE-15: URL with {{baseUrl}} placeholder

**Goal:** Verify environment variable resolution in SSE

**Steps:**
1. In URL input, type `{{baseUrl}}/events`
2. Select an environment from AppHeader

**Expected Results:**
- [ ] `{{baseUrl}}` resolves from the selected environment's configuration
- [ ] Resolved URL shown in preview (if available)
- [ ] Connection uses the resolved URL at connect time

---

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| (prior) | SE-12 | HTTP errors didn't trigger auto-reconnect | `maybeReconnect()` not called in error path | Added `maybeReconnect()` call after `updateState('error')` |
| (prior) | SE-12 | null body response didn't trigger reconnect | `!response.body` path missing `maybeReconnect()` | Added `maybeReconnect()` in null-body error path |
| (prior) | SE-12 | Reconnect overwrote error state | `maybeReconnect()` called `updateState('disconnected')` | Changed to update `reconnectAttempt` counter only |

---

## Test Data Export

SSE events are transient. Use the Export button to save event data as JSON during testing.
