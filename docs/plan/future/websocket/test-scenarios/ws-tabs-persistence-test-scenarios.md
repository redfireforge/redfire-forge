# WebSocket Tabs & Persistence — Test Manual

> **File:** `ws-tabs-persistence-test-scenarios.md`
> **Covers:** Phases 9–13 — Multiple Connections, Tab Persistence, History, Bookmarks, Recording/Replay, Stats, Drag/Keyboard
> **Last verified:** 2026-06-13 (Chrome E2E 60/60, macOS)
> **E2E files:** `ws-tabs-persistence.spec.ts` (32), `ws-session-replay.spec.ts` (7), `ws-tab-keyboard-nav.spec.ts` (16), `ws-tab-drag-reorder.spec.ts` (5)
> **Platforms:** Web (Chrome/Firefox), Tauri Desktop (macOS)

---

## Before You Start

### 1. Install Dependencies

```bash
cd redfire-forge
npm install
```

### 2. Start the Echo Server (Docker)

The echo server reflects every message you send back to you — perfect for testing.

```bash
docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
```

Verify it's running:

```bash
curl -s http://localhost:8765 && echo " ✓ Echo server up"
```

### 3. Start Development Servers

```bash
npm run dev          # Frontend → http://localhost:5173
npm run server       # Backend (WebSocket proxy for browser auth)
```

> **Why both?** In browser mode, WebSocket handshakes can't carry custom HTTP headers (e.g., `Authorization`). The backend proxy relays auth headers on behalf of the browser. In the Tauri desktop app, native transport is used instead and the backend isn't strictly required for basic echo tests.

### 4. (Optional) Start the Tauri Desktop App

Only needed for Tauri-specific tests (WT-08).

```bash
npm run tauri dev
# Or if you have a debug binary:
./src-tauri/target/debug/redfireforge &
```

### 5. Navigate to WebSocket Studio

1. Open **http://localhost:5173** in your browser
2. Click **Protocols** in the left sidebar
3. Click the **WebSocket** sub-tab at the top

You should see the WebSocket Studio page with a single "New Connection" tab.

---

## Understanding the UI Layout

Before running tests, familiarize yourself with the WebSocket Studio layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Connection Tab Bar                                                 │
│  ┌───────────────┐ ┌───────────────┐                                │
│  │ ● localhost:.. │ │ ● New Conn..  │  [+]  [▾]                     │
│  └───────────────┘ └───────────────┘                                │
├─────────────────────────────────────────────────────────────────────┤
│  Mode Switch:  [ Client ]  [ Mock Server ]  [ Saved ]               │
├──────────────────────────┬──────────────────────────────────────────┤
│  LEFT PANE (440px min)   │  RIGHT PANE (200px min)                  │
│                          │                                          │
│  Left Tabs:              │  Right Tabs:                             │
│  Connect|Params|Auth|    │  Events|Console|Stats|Load Test|Schema   │
│  Headers|Compose         │                                          │
│                          │                                          │
│  ┌────────────────────┐  │  ┌────────────────────────────────────┐  │
│  │                    │  │  │  Status bar: Connected / ws://...  │  │
│  │  (tab content      │  │  │  Search bar + filters              │  │
│  │   depends on       │  │  │  Toolbar: Filters|Compare|Clear|  │  │
│  │   selected tab)    │  │  │    Export|● Rec|Import             │  │
│  │                    │  │  │                                    │  │
│  │                    │  │  │  Message rows (Events tab)         │  │
│  │                    │  │  │  ☆ ◆ 22:35:35 sent "Hello"  12B  │  │
│  │                    │  │  │  ☆ ◇ 22:35:35 recv "Hello"  12B  │  │
│  └────────────────────┘  │  └────────────────────────────────────┘  │
│                          │                                          │
│  Status: Connected       │                                          │
│  ↑ 3  ↓ 3               │                                          │
├──────────────────────────┴──────────────────────────────────────────┤
│  ← drag the vertical divider between the panes to resize →         │
└─────────────────────────────────────────────────────────────────────┘
```

**Key areas:**

| Area | What it contains |
|---|---|
| **Connection Tab Bar** (top) | One tab per connection. Green/grey/orange/red dot = connected/disconnected/connecting/error. `[+]` adds a tab. `[▾]` opens the **tab bar history dropdown** to quick-connect from recent URLs. |
| **Mode Switch** | Client (normal), Mock Server, Saved. Most tests use **Client** mode. |
| **Left Pane** | **Connect** tab: URL input, subprotocols, protocol selector, auto-reconnect, Connect/Disconnect buttons. **Auth** tab: auth type selector and credentials. **Compose** tab: message input and Send button. **Params** / **Headers**: query params and custom headers. |
| **Right Pane** | **Events** tab: message log with search, filters, bookmark stars, recording/replay, and the toolbar (Clear, Export, ● Rec, Import). **Console** tab: structured/raw log viewer. **Stats** tab: live metrics dashboard. **Load Test** / **Schema**: advanced features. |
| **Split Divider** | Vertical bar between left and right panes. Drag to resize. |

> **Two different history dropdowns — don't confuse them:**
> - The `[▾]` in the **Connection Tab Bar** (next to the `[+]` button) creates a *new tab* with the selected URL pre-filled.
> - The `[▾]` inside the **URL input field** (on the Connect left tab) fills the *current tab's* URL without creating a new tab.
>
> They share the same history data but behave differently. Most test scenarios reference the **tab bar** dropdown.

### Key Storage Keys (for DevTools inspection)

In browser DevTools: **Application** tab → **Local Storage** → select `http://localhost:5173`.

| Key | Contents | Scope |
|---|---|---|
| `redfire-ws-tab-state-v1` | Tabs array, activeTabId, renamedTabIds, per-tab auth/draft | Per session |
| `redfire-ws-history-v1` | Connection history entries (max 20) | Global |
| `redfire-ws-console-settings-v1` | Console view mode, filters, autoscroll, maxEntries | Global |
| `redfire-ws-split-v1` | Split pane left width (px) | Global |
| `redfire-ws-profiles-v1` | Saved connection profiles | Global |
| `redfire-ws-templates-v1` | Message templates | Global |
| `redfire-ws-schemas-v1` | Inferred/manual message schemas | Global |

> **Browser:** stored in `localStorage`. **Tauri Desktop:** stored as `~/Library/Application Support/com.redfireforge.desktop/{key}.json` files on disk. The app's `readKey/writeKey` abstraction handles the dispatch transparently.

---

## How to Send a Message (referenced by many tests)

Several scenarios say "send messages." Here's how:

1. Make sure you're **Connected** (green dot on the tab, status says "Connected")
2. In the **left pane**, click the **Compose** tab
3. Type your message in the text area (e.g., `Hello World`)
4. Click **Send** (or use the keyboard shortcut)
5. The echo server will reflect your message back — check the **Events** tab in the right pane to see both the sent (◆) and received (◇) rows

> **Format selector:** Below the message input, the "Format" dropdown lets you choose Text, JSON, or Binary (Base64). For most tests, leave it on **Text**.

---

## Multiple Concurrent Connections — Phase 9

### WT-01: Add tabs up to 8; 9th blocked

**Goal:** Verify tab limit enforcement

**Steps:**
1. Start with the default single tab
2. Click the **+** button (`data-testid="conn-tab-add"`) to add new tabs — repeat until you have 8 tabs
3. Look for the **+** button — it should be gone

**Expected Results:**
- [ ] Tabs 1–8 can be added successfully
- [ ] At 8 tabs: the **+** button is hidden (MAX_TABS = 8)
- [ ] Each new tab shows "New Connection" label with a grey disconnected dot
- [ ] Tab bar shrinks tabs gracefully (min-width 60px per tab)

---

### WT-02: Independent connection state per tab

**Goal:** Verify tabs are independent

**Steps:**
1. In **tab 1**: click the **Connect** left tab, type `ws://localhost:8765` in the URL input, click **Connect**
2. Wait for the green dot and "Connected" status in the bottom-left
3. Click the **+** button to create **tab 2** — it auto-selects
4. Observe tab 2's left pane — the URL input should be empty, status says "Disconnected"
5. Click on **tab 1** in the tab bar to switch back

**Expected Results:**
- [ ] Tab 1: Connected (green dot), URL filled, "Connected" status
- [ ] Tab 2: Disconnected (grey dot), URL empty, "Disconnected" status
- [ ] Switching back to tab 1 shows its connected state and any messages in the Events tab
- [ ] Message counters (↑/↓) are per-tab

---

### WT-03: Background tab stays connected

**Goal:** Verify connections persist when tab is not active

**Steps:**
1. In tab 1: connect to `ws://localhost:8765`
2. Click the **Compose** left tab, type `Hello`, click **Send** — verify you see the sent and echoed message in the **Events** right tab
3. Click the **+** button to switch to a new tab 2
4. Wait 10+ seconds
5. Click on **tab 1** to switch back

**Expected Results:**
- [ ] Tab 1 still shows Connected status (green dot)
- [ ] The uptime counter in the status bar reflects the full connection duration (not reset)
- [ ] No data loss from the background connection

---

### WT-04: Close tab with confirmation for connected tabs

**Goal:** Verify tab close behavior

**Prerequisite:** You need at least 2 tabs (you can't close the last one). Create a second tab with **+** first.

**Steps:**
1. Connect **tab 1** to the echo server (green dot shows "Connected")
2. Hover over **tab 1** in the tab bar — a small **×** button appears on the right side of the tab
3. Click the **×** button
4. A styled **ConfirmModal** dialog should appear with the title *"Close Active Connection"* and message *"This connection is active. Close and disconnect?"*
5. Click **Cancel** — the tab should stay
6. Click **×** again, this time click the red **Close** button — the tab should be removed

**Expected Results:**
- [ ] × button only visible on hover (or always visible on the active tab)
- [ ] Connected/connecting tab: styled `ConfirmModal` with **Cancel** and red **Close** buttons
- [ ] Clicking Cancel keeps the tab open
- [ ] Clicking Close removes the tab and disconnects
- [ ] Disconnected tab: closes immediately without any confirmation prompt
- [ ] After closing: the adjacent tab becomes active
- [ ] Cannot close the last remaining tab (× button hidden when only 1 tab)

---

### WT-05: Tab auto-label from URL; double-click to rename

**Goal:** Verify tab label behavior

**Steps:**
1. Click the **Connect** left tab. Type `ws://localhost:8765` in the URL input
2. Watch the tab label in the tab bar — it should update from "New Connection" to "localhost:8765"
3. **Double-click** the tab label text in the tab bar (or press **F2** while the tab is focused)
4. An inline text input appears — type `My Echo Server` (max 40 characters)
5. Press **Enter** to confirm (or click away to confirm; press **Escape** to cancel)

**Expected Results:**
- [ ] Tab label auto-updates from URL: "New Connection" → "localhost:8765"
- [ ] Double-click (or F2) turns the label into an editable `<input>`
- [ ] After renaming, the custom label sticks — future URL changes no longer auto-update it
- [ ] Custom label persists when switching between left/right pane tabs or modes

---

## Tab Persistence — Phase 10.1

### WT-06: Navigate away and back — tabs restored

**Goal:** Verify tab persistence across navigation

**Steps:**
1. Create 3 tabs. In each, type a different URL (e.g., `ws://localhost:8765`, `ws://localhost:1234`, `ws://example.com`)
2. Rename one tab to something custom (e.g., "Echo")
3. Click **Kafka** in the sub-nav bar at the top (this navigates away from WebSocket)
4. Click **WebSocket** to navigate back

**Expected Results:**
- [ ] All 3 tabs restored with correct labels and URLs
- [ ] The renamed tab still shows the custom label
- [ ] Per-tab left/right tab selection preserved (e.g., if you had Auth selected in tab 2, it's still Auth)
- [ ] The active tab selection preserved

---

### WT-07: Restored tabs start disconnected

**Goal:** Verify connection state resets on restore

**Steps:**
1. Connect tab 1 to the echo server (green dot)
2. Click **Kafka** to navigate away, then click **WebSocket** to come back
3. Observe tab 1

**Expected Results:**
- [ ] Tab 1 shows Disconnected (grey dot) — connections are not auto-resumed
- [ ] URL input still shows `ws://localhost:8765`
- [ ] User must click **Connect** manually to re-establish

---

### WT-08: Tauri FS persistence across app restart

**Goal:** Verify persistence in Tauri desktop mode

> **Tauri-only test.** Skip this if you're testing in the browser.

**Storage:** `~/Library/Application Support/com.redfireforge.desktop/redfire-ws-tab-state-v1.json`

**Steps:**
1. In the **Tauri desktop app**, create tabs and set URLs
2. Quit the app completely: **⌘Q** (macOS) or close the window
3. Reopen the app (run the binary or `npm run tauri dev`)
4. Navigate to **Protocols → WebSocket**

**Expected Results:**
- [ ] Tabs restored from disk storage
- [ ] Labels, URLs, and pane-tab positions preserved
- [ ] All tabs start disconnected (no auto-resume)

---

### WT-09: Rename persists across navigation

**Goal:** Verify renamed tab persistence

**Steps:**
1. Double-click a tab label and rename it to "Test Server"
2. Navigate to Kafka and back to WebSocket

**Expected Results:**
- [ ] Tab label "Test Server" preserved after round-trip
- [ ] Custom label takes priority over auto-generated URL label

---

### WT-10: First visit — default single tab

**Goal:** Verify clean-state initialization

**Steps:**
1. Open browser DevTools → **Application** tab → **Local Storage** → select `http://localhost:5173`
2. Delete the key `redfire-ws-tab-state-v1` (or click "Clear All" to wipe everything)
3. Reload the page (**F5** or **⌘R**)
4. Navigate to **Protocols → WebSocket**

**Expected Results:**
- [ ] A single "New Connection" tab created
- [ ] Tab shows Disconnected status
- [ ] No errors in browser console

---

## Connection History — Phase 10.2

> **How history works:** Every time a connection reaches the "connected" state, the URL and protocol are saved to a shared history list (max 20 entries, sorted by most recent). History is global — shared across all tabs. History is used by both the tab bar dropdown and the URL input dropdown.

### WT-11: Connect adds URL to history

**Goal:** Verify history recording

**Steps:**
1. In any tab, type `ws://localhost:8765` in the URL input and click **Connect**
2. Wait for the green "Connected" dot
3. Click **Disconnect**
4. Look at the **Connection Tab Bar** — a small **▾** arrow should now appear to the right of the **+** button
5. Click the **▾** arrow

**Expected Results:**
- [ ] History dropdown opens showing `ws://localhost:8765`
- [ ] Entry shows a relative timestamp (e.g., "just now")
- [ ] If the protocol was non-default, a protocol badge appears (e.g., "STOMP")
- [ ] The **▾** arrow is only visible when history is non-empty AND fewer than 8 tabs exist

---

### WT-12: History row details

**Goal:** Verify history entry display

**Steps:**
1. Connect to `ws://localhost:8765`, disconnect
2. Change the URL to `ws://localhost:1234`, click Connect (it will fail — that's OK, the attempt still gets recorded)
3. Open the tab bar history dropdown (**▾**)

**Expected Results:**
- [ ] Each row shows: URL, optional protocol badge, relative timestamp
- [ ] Most recent URL at top
- [ ] Connecting to the same URL again updates the timestamp (no duplicates)

---

### WT-13: Click history row in tab bar → creates new tab

**Goal:** Verify quick-connect from tab bar history

> **Important:** This is the **tab bar** history dropdown (**▾** next to **+**). It creates a *new* tab. This is different from the URL input history dropdown — see the "Two different history dropdowns" note in the UI Layout section above.

**Steps:**
1. Make sure history has at least one entry (from WT-11)
2. Click the **▾** arrow in the tab bar
3. Click a URL entry (e.g., `ws://localhost:8765`)

**Expected Results:**
- [ ] A **new tab** is created and becomes active
- [ ] The URL input in the new tab is pre-filled with the selected URL
- [ ] Protocol mode set from the history entry
- [ ] Dropdown closes after selection
- [ ] You can now click **Connect** to connect immediately

---

### WT-14: Clear History button

**Goal:** Verify history clearing

**Prerequisite:** History must have entries (run WT-11 first, or connect/disconnect to create history).

**Steps:**
1. Click the **▾** arrow in the tab bar to open the history dropdown
2. Scroll to the bottom of the dropdown — you should see a **Clear History** button below a thin divider line
3. Click **Clear History**

**Expected Results:**
- [ ] All history entries removed
- [ ] Dropdown closes
- [ ] The **▾** arrow disappears from the tab bar (hidden when history is empty)

---

### WT-15: History is global across tabs

**Goal:** Verify shared history

**Steps:**
1. In tab 1, connect to `ws://localhost:8765` (creates a history entry)
2. Click **+** to create tab 2
3. Look for the **▾** arrow in the tab bar, click it

**Expected Results:**
- [ ] History shows `ws://localhost:8765` (recorded from tab 1)
- [ ] History is shared across all tabs — not per-tab

---

## Quick Connect from Tab Bar — Phase 10.3

### WT-16: Tab bar dropdown (▾) shows recent URLs

**Goal:** Verify quick connect dropdown contents

**Prerequisite:** History must have entries (run WT-11 first).

**Steps:**
1. Look for the **▾** arrow to the right of the **+** button in the tab bar
2. Click the **▾** arrow

**Expected Results:**
- [ ] Dropdown titled "Recent Connections" shows URLs from connection history
- [ ] Each entry shows URL and optional protocol badge
- [ ] Clicking an entry creates a new tab with the URL pre-filled

---

### WT-17: Click URL → new tab with pre-filled URL

**Goal:** Verify quick connect tab creation

**Prerequisite:** History must have entries.

**Steps:**
1. Open tab bar dropdown (**▾**)
2. Click a URL entry

**Expected Results:**
- [ ] New tab created and activated
- [ ] URL pre-filled with the selected URL
- [ ] Protocol mode set from history entry
- [ ] Ready to click **Connect** immediately

---

### WT-18: No history → ▾ arrow hidden

**Goal:** Verify dropdown visibility with empty history

**Steps:**
1. Clear all history: open the **▾** dropdown → click **Clear History**. Or delete `redfire-ws-history-v1` from localStorage in DevTools.
2. Observe the tab bar

**Expected Results:**
- [ ] The **▾** arrow is not visible (no history entries)
- [ ] Also hidden when 8 tabs exist (no room for new tabs)
- [ ] Only the **+** button is shown
- [ ] The **▾** reappears after you connect to a URL (history entry created on successful connect)

---

## Message Bookmarks — Phase 11.1

> **Note:** Bookmarks are **in-memory only**. They are NOT saved to disk. Navigating away clears all bookmarks. The Export function includes the `bookmarked` flag.

### WT-19: Click star to bookmark message

**Goal:** Verify bookmark toggle (on)

**Prerequisite:** Connect to the echo server and send at least one message (see "How to Send a Message" section above).

**Steps:**
1. In the **right pane**, make sure the **Events** tab is selected — you should see your sent (◆) and received (◇) message rows
2. Each message row has a **☆** (empty star) icon on the left side
3. Click the **☆** on any message

**Expected Results:**
- [ ] Star fills: ☆ → ★
- [ ] Aria-label changes from "Add bookmark" to "Remove bookmark"

---

### WT-20: Click star again to remove bookmark

**Goal:** Verify bookmark toggle (off)

**Steps:**
1. Click the **★** (filled star) on a bookmarked message

**Expected Results:**
- [ ] Star empties: ★ → ☆
- [ ] Aria-label changes back to "Add bookmark"

---

### WT-21: Direction filter — Bookmarked

**Goal:** Verify bookmark filtering

**Steps:**
1. Send several messages and bookmark 2–3 of them (click ☆ to toggle)
2. In the **Events** tab toolbar area, find the **direction filter dropdown** (shows "All" by default, located near the search bar)
3. Select **Bookmarked** from the dropdown

**Expected Results:**
- [ ] Only bookmarked messages are shown
- [ ] Non-bookmarked messages hidden
- [ ] Switching back to "All" shows all messages again

---

### WT-22: Clear messages — bookmarks reset

**Goal:** Verify bookmark behavior on clear

**Steps:**
1. Bookmark some messages
2. In the Events tab toolbar, click the **Clear** button

**Expected Results:**
- [ ] All messages removed (including bookmarked ones)
- [ ] Message log is empty
- [ ] Bookmark count resets to 0

---

### WT-23: Export includes bookmark flag

**Goal:** Verify bookmarks in export

**Steps:**
1. Bookmark some messages, leave others unbookmarked
2. In the Events toolbar, click the **Export** button
3. Open the downloaded JSON file in a text editor

**Expected Results:**
- [ ] Each message object has a `bookmarked: true` or `bookmarked: false` field
- [ ] Bookmarked messages are identifiable in the exported data

---

## Session Recording — Phase 11.2

### WT-24: Start recording

**Goal:** Verify recording start

**Prerequisite:** Must be connected to the echo server (green dot).

**Steps:**
1. In the **right pane**, make sure the **Events** tab is selected
2. Look at the toolbar row below the search bar — it has buttons: Filters, Compare, Clear, Export, **● Rec**, Import
3. Click the **● Rec** button (`data-testid="start-recording-btn"`)

**Expected Results:**
- [ ] Button changes to show a red **REC** label with a pulsing animation
- [ ] Recording is now active — all sent/received messages will be captured with timestamps

---

### WT-25: Send/receive during recording

**Goal:** Verify recording captures messages

**Prerequisite:** Recording must be active (from WT-24).

**Steps:**
1. Switch to the **Compose** left tab and send 3–5 messages (type text, click Send, repeat)
2. The echo server reflects each message — you should see both sent (◆) and received (◇) entries in the Events tab

**Expected Results:**
- [ ] All sent and received messages are captured in the recording
- [ ] Each event has a timestamp relative to when recording started

---

### WT-26: Stop recording → save file

**Goal:** Verify recording save

**Steps:**
1. While recording (red REC indicator visible), click the recording button again to **stop**
2. A save dialog or file download should be triggered

**Expected Results:**
- [ ] **Browser:** a file download starts with filename like `ws-recording-2026-06-12T....json`
- [ ] **Tauri:** a native OS save dialog appears
- [ ] The file contains all recorded events in JSON format
- [ ] Keep this file — you'll need it for WT-28 (replay testing)

---

### WT-27: Recording file format

**Goal:** Verify recording JSON structure

**Steps:**
1. Open the saved recording file from WT-26 in a text editor (or run `cat <filename>.json | python3 -m json.tool`)
2. Inspect the structure

**Expected Results:**
- [ ] Top-level `_format: "ws-recording-v1"` identifier
- [ ] Metadata fields: `url`, `protocol`, `startedAt` (ISO string), `durationMs`, `messageCount`
- [ ] `events` array with objects containing: `type`, `data`, `timestamp` (ms from recording start), `direction`
- [ ] Valid JSON — parseable with `JSON.parse()`

---

## Session Replay — Phase 11.3

### WT-28: Import recording → replay controls

**Goal:** Verify replay mode activation

**Prerequisite:** You need a recording file from WT-26. You do **not** need to be connected — replay works offline.

**Steps:**
1. In the **right pane Events** tab toolbar, click the **Import** button (rightmost button in the toolbar row)
2. In the file picker, select the recording JSON file you saved in WT-26
3. Observe the Events tab

**Expected Results:**
- [ ] Replay controls appear above the message list: **▶ Play**, **⏸ Pause**, **Speed** selector, **Progress** counter, **✕ Exit**
- [ ] The Compose input in the left pane is disabled during replay
- [ ] Message log is cleared (ready for replay)

---

### WT-29: Play → messages at original pace

**Goal:** Verify replay timing

**Steps:**
1. Click **▶ Play**
2. Watch messages appearing in the Events tab
3. Try changing the speed dropdown: **1×**, **2×**, **5×**, **10×**, **Max**

**Expected Results:**
- [ ] At 1× speed: messages appear at their original recorded timing
- [ ] At 2× speed: messages appear twice as fast
- [ ] At Max speed: all messages appear instantly
- [ ] Progress counter updates (e.g., "3/15 events")

---

### WT-30: Pause/Resume during replay

**Goal:** Verify pause functionality

**Steps:**
1. During replay (messages appearing), click **⏸ Pause**
2. Wait a few seconds — no new messages should appear
3. Click **▶ Resume**

**Expected Results:**
- [ ] Pause stops message playback immediately
- [ ] Progress counter freezes
- [ ] Resume continues from the paused position
- [ ] No messages lost

---

### WT-31: Exit Replay → clears messages

**Goal:** Verify replay exit

**Steps:**
1. During or after replay, click **✕ Exit**

**Expected Results:**
- [ ] Replayed messages cleared from the log
- [ ] Returns to normal mode (replay controls disappear)
- [ ] Compose input re-enabled
- [ ] Can start a new connection or import another recording

---

## Connection Stats — Phase 12

### WT-32: View the Stats tab

**Goal:** Verify the Stats dashboard renders

**Prerequisite:** Must be connected to the echo server.

**Steps:**
1. In the **right pane**, click the **Stats** tab (between Console and Load Test)
2. The Stats dashboard should display metric cards

**Expected Results:**
- [ ] Dashboard shows cards: **Msg/s**, **Bytes In**, **Bytes Out**, **Frame Types**
- [ ] All values start at 0 for a fresh connection
- [ ] The **Errors** card is NOT shown when there are no errors (only 4 cards visible)

---

### WT-33: Live metrics during messaging

**Goal:** Verify real-time metric updates

**Prerequisite:** Stats right tab is selected, connected to echo server.

**Steps:**
1. Switch to the **Compose** left tab and send several messages rapidly (type → Send → type → Send)
2. Switch back to view the **Stats** right tab to check the values

**Expected Results:**
- [ ] **Msg/s:** Updates in real time as you send/receive
- [ ] **Bytes In:** Shows cumulative bytes received, with a per-second rate
- [ ] **Bytes Out:** Shows cumulative bytes sent, with a per-second rate
- [ ] **Frame Types:** Shows a bar chart with Text/Binary/Control percentages and a legend with counts
- [ ] **Errors** card still NOT shown (only appears when errors > 0)

---

### WT-33a: Errors card appears only when errors occur

**Goal:** Verify the conditional Errors stats card

**Steps:**
1. With the **Stats** tab open on a healthy connection, confirm there are only 4 cards (no Errors card)
2. To trigger an error: switch to the **Compose** left tab, change the **Format** dropdown (below the text area) from "Text" to **Binary (Base64)**, type some invalid text that is NOT valid Base64 (e.g., `!!!not-base64!!!`), and click **Send**
3. Switch back to the **Stats** right tab

**Expected Results:**
- [ ] Before the error: no Errors card visible
- [ ] After the error: an **Errors** card appears (5th card) with an error count
- [ ] The Errors card uses red/error styling
- [ ] If you disconnect and reconnect fresh, the Errors card disappears again

---

### WT-34: Sparkline 60-second history

**Goal:** Verify sparkline chart

**Steps:**
1. With the Stats tab open, send messages spread over ~60 seconds (e.g., one message every 5–10 seconds)
2. Observe the sparkline (mini line chart) in the **Msg/s** card

**Expected Results:**
- [ ] A sparkline is visible inside the Msg/s card
- [ ] It shows a rolling 60-second messages-per-second history
- [ ] The line rises when you send messages and flattens when idle

---

### WT-35: Stats per-tab; disconnect zeros rates

**Goal:** Verify per-tab stats isolation

**Steps:**
1. In tab 1: connect, send messages, check the Stats tab (rates should be > 0)
2. Click **+** to create tab 2 — switch to the **Stats** right tab in tab 2
3. Switch back to tab 1, click **Disconnect**, check the Stats tab

**Expected Results:**
- [ ] Tab 2 stats are all zeros (independent from tab 1)
- [ ] After disconnecting tab 1: Msg/s and per-second rates reset to 0
- [ ] Cumulative byte totals (Bytes In/Out) are preserved even after disconnect

---

## Tab Drag-and-Drop Reorder — Phase 13.1

### WT-36: Drag tab to new position

**Goal:** Verify drag-and-drop reorder

**Steps:**
1. Create 3+ tabs (click **+** repeatedly)
2. Rename them "A", "B", "C" for easy identification (double-click each label)
3. Click and **hold** tab "C" (don't release)
4. While holding, drag it to the left of tab "A"
5. Release the mouse button

**Expected Results:**
- [ ] While dragging, a visual drop indicator appears (a colored line/shadow showing where the tab will land)
- [ ] After releasing, the tab bar shows order: C, A, B
- [ ] Tab content is unaffected by reorder (each tab still has its own URL/state)
- [ ] Drag is disabled while a tab rename input is active

---

### WT-37: Drag visual feedback

**Goal:** Verify drag UX indicators

**Steps:**
1. Start dragging a tab (click, hold, and move)

**Expected Results:**
- [ ] Dragged tab has reduced opacity (~40%)
- [ ] Drop position indicated by an accent-color box-shadow or line between tabs

---

### WT-38: Tab order preserved after navigation

**Goal:** Verify order persistence

**Steps:**
1. Reorder tabs via drag-and-drop (e.g., move tab 3 to position 1)
2. Navigate to Kafka and back to WebSocket

**Expected Results:**
- [ ] Tab order matches the reordered state
- [ ] Labels and URLs correct in each position

---

## Keyboard Navigation — Phase 13.2

> **Focus model:** Only the active tab has `tabIndex=0`; inactive tabs have `tabIndex=-1` (roving tabindex pattern). You must click a tab first to enter keyboard navigation mode.

### WT-39: Arrow Left/Right moves tab focus

**Goal:** Verify keyboard tab navigation

**Steps:**
1. Click on any tab in the tab bar to give it focus
2. Press **→** (Right Arrow) — the focus ring should move to the next tab
3. Press **←** (Left Arrow) — the focus ring should move back

**Expected Results:**
- [ ] A focus ring (outline) moves between tabs
- [ ] Wraps around: pressing → on the last tab focuses the first tab, and vice versa

---

### WT-40: Enter/Space activates tab; Home/End

**Goal:** Verify keyboard tab activation

**Steps:**
1. Use arrow keys to move focus to a non-active tab (the focus ring is on a tab that isn't selected)
2. Press **Enter** or **Space**
3. Press **Home**, then press **End**

**Expected Results:**
- [ ] Enter/Space: the focused tab becomes the active tab (its content loads in the pane)
- [ ] Home: focuses the first tab
- [ ] End: focuses the last tab

---

### WT-41: Delete key closes focused tab

**Goal:** Verify keyboard tab close

**Prerequisite:** At least 2 tabs must exist.

**Steps:**
1. Use arrow keys to focus a tab
2. Press **Delete** (or **Fn+Backspace** on Mac keyboards without a Delete key)

**Expected Results:**
- [ ] Connected tab: the ConfirmModal dialog appears (same as WT-04)
- [ ] Disconnected tab: closes immediately without a prompt
- [ ] Focus moves to the adjacent tab after close
- [ ] Cannot delete the last remaining tab (nothing happens)

---

### WT-42: F2 key starts rename

**Goal:** Verify keyboard rename

**Steps:**
1. Use arrow keys to focus a tab
2. Press **F2**

**Expected Results:**
- [ ] An inline `<input>` appears over the tab label (max 40 characters)
- [ ] Current label is pre-filled for editing
- [ ] **Enter** confirms the new name, **Escape** cancels, clicking away (blur) confirms

---

## Persistence — Auth, Console, Split Pane

### WT-43: Auth draft persistence per-tab

**Goal:** Verify auth config survives tab switches and navigation

**Steps:**
1. In tab 1, click the **Auth** left tab in the left pane
2. Find the **Type** dropdown (shows "No Auth" by default), select **Bearer Token**
3. A "Token" input field appears below — type `my-secret-token-123`
4. Below the inputs, a preview line should appear showing: `Authorization: Bearer my-secret-token-123`
5. Click **+** to create tab 2 — it becomes active
6. Click on **tab 1** to switch back — click the **Auth** left tab to check
7. Navigate to **Kafka** and back to **WebSocket** — click tab 1, check the Auth tab again

**Expected Results:**
- [ ] Step 6: Tab 1 still shows "Bearer Token" with the token value `my-secret-token-123`
- [ ] Step 7: Same — auth config persists after navigation round-trip
- [ ] Tab 2 has independent auth config (defaults to "No Auth")
- [ ] The preview line below the inputs shows the resolved auth header

---

### WT-44: Console settings persistence

**Goal:** Verify console settings survive reload/navigation

**Steps:**
1. In the **right pane**, click the **Console** tab
2. At the top of the Console panel, you'll see controls:
   - A **view toggle** with two options: **Structured** (default) and **Raw**
   - An **Autoscroll** checkbox (checked by default)
   - **Category** and/or **Level** filter dropdowns
3. Click **Raw** to switch the view mode
4. Uncheck **Autoscroll**
5. Navigate to **Kafka** and back to **WebSocket** — click the Console right tab
6. Reload the page (**F5** or **⌘R**) — navigate back to WebSocket → Console tab

**Expected Results:**
- [ ] Step 5: Raw view mode and autoscroll-off preserved after navigation
- [ ] Step 6: Same settings preserved after full page reload
- [ ] Console settings are global (shared across all WebSocket tabs, not per-tab)

---

### WT-45: Split pane width persistence

**Goal:** Verify split pane left width survives reload/navigation

**Steps:**
1. Find the vertical **divider** between the left and right panes — it's a thin bar in the middle of the studio. Your cursor changes to a resize handle (↔) when you hover over it.
2. **Drag** the divider to the right to make the left pane noticeably wider
3. Navigate to **Kafka** and back to **WebSocket**
4. Reload the page (**F5** or **⌘R**)

**Expected Results:**
- [ ] Step 3: Left pane width preserved after navigation
- [ ] Step 4: Left pane width preserved after full page reload
- [ ] Width clamped: minimum left = 440px, minimum right = 200px (you can't drag beyond these limits)
- [ ] **Keyboard resize:** Click the divider to focus it (you should see a focus ring), then use **Arrow keys** (±16px per press) or **Shift+Arrow / PageUp/PageDown** (±64px per press)

---

## Bugs Found During Testing

> Record any bugs you find here. Include the date, which scenario failed, what you saw vs. what was expected, and any browser console errors.

| Date | Scenario | Bug Description | Browser Console Errors? | Status |
|---|---|---|---|---|
| *(fill in as you test)* | | | | |

---

## Test Completion Checklist

Use this to track your progress across the 46 scenarios:

| Section | Scenarios | Count | Passed |
|---|---|---|---|
| Multiple Connections | WT-01 to WT-05 | 5 | ✅ |
| Tab Persistence | WT-06 to WT-10 | 5 | ✅ |
| Connection History | WT-11 to WT-15 | 5 | ✅ |
| Quick Connect | WT-16 to WT-18 | 3 | ✅ |
| Bookmarks | WT-19 to WT-23 | 5 | ✅ |
| Recording | WT-24 to WT-27 | 4 | ✅ |
| Replay | WT-28 to WT-31 | 4 | ✅ |
| Stats | WT-32 to WT-35 (+33a) | 5 | ✅ |
| Drag & Drop | WT-36 to WT-38 | 3 | ✅ |
| Keyboard | WT-39 to WT-42 | 4 | ✅ |
| Persistence (Auth/Console/Split) | WT-43 to WT-45 | 3 | ✅ |
| **Total** | | **46** | |

---

## Tips for New Testers

- **Always check the browser console** (F12 → Console tab) for JavaScript errors after each test. Report any red errors in the Bugs table.
- **The echo server is your best friend.** It reflects everything you send, making it easy to verify send/receive behavior.
- **Don't skip prerequisites.** Some tests depend on state from earlier tests (e.g., WT-28 needs a recording file from WT-26). Follow them in order the first time.
- **Browser vs Tauri:** Most tests work identically in both. WT-08 is Tauri-only. In browser mode, auth headers require the backend proxy (`npm run server`).
- **To reset everything:** Clear localStorage in DevTools (Application → Local Storage → Clear All) and reload. This gives you a clean "first visit" state.
- **Mac keyboards:** The Delete key on Mac is actually Backspace. For the WT-41 Delete key test, press **Fn+Backspace** to get a forward-delete.

---

## Automated E2E Coverage (Playwright)

### Spec: `e2e/ws-tabs-persistence.spec.ts` — 32 tests
| ID | Scenario | Status |
|---|---|---|
| WT-01 | Tab lifecycle (add up to max, rename, close) | ✅ |
| WT-02 | Independent connections per tab | ✅ |
| WT-03 | Background tab stays connected | ✅ |
| WT-04 | Close connected tab → confirm modal | ✅ |
| WT-05 | Rename tab via double-click | ✅ |
| WT-06 | Navigate away and back → tabs restored | ✅ |
| WT-07 | Restored tabs start disconnected | ✅ |
| WT-09 | Rename persists across navigation | ✅ |
| WT-10 | First visit → default single tab | ✅ |
| WT-11 | Connect adds URL to history | ✅ |
| WT-13 | Click history row fills URL | ✅ |
| WT-14 | Clear History removes entries | ✅ |
| WT-15 | History is global across tabs | ✅ |
| WT-16 | Tab bar history dropdown | ✅ |
| WT-17 | Click URL in tab bar dropdown creates new tab | ✅ |
| WT-19–23 | Bookmarks: add, remove, filter, export | ✅ |
| WT-24–26 | Recording: start, indicator, stop → save | ✅ |
| WT-32–35 | Stats panel: msg rate, bytes, errors, per-tab | ✅ |
| WT-43 | Auth draft persistence per-tab | ✅ |
| WT-44 | Console settings persistence | ✅ |
| WT-45 | Split pane width persistence | ✅ |

### Spec: `e2e/ws-session-replay.spec.ts` — 7 tests
| ID | Scenario | Status |
|---|---|---|
| WT-24 | Record button → REC indicator | ✅ |
| WT-25 | Messages captured during recording | ✅ |
| WT-28 | Import recording → replay controls | ✅ |
| WT-28b | Invalid import shows error feedback | ✅ |
| WT-29 | Play → messages appear; speed changes | ✅ |
| WT-30 | Pause/Resume toggle | ✅ |
| WT-31 | Exit replay → clears messages | ✅ |

### Spec: `e2e/ws-tab-keyboard-nav.spec.ts` — 16 tests
| ID | Scenario | Status |
|---|---|---|
| WT-39 | Arrow keys move focus between tabs | ✅ |
| WT-40 | Enter/Space activates focused tab | ✅ |
| WT-41 | Home/End jump to first/last tab | ✅ |
| WT-42 | Delete removes focused tab | ✅ |
| — | Focus ring visible on keyboard nav | ✅ |
| — | Arrow wrapping (first↔last) | ✅ |
| — | F2 opens inline rename, Enter commits, Escape cancels | ✅ |
| — | Arrow keys suppressed during rename | ✅ |

### Spec: `e2e/ws-tab-drag-reorder.spec.ts` — 5 tests
| ID | Scenario | Status |
|---|---|---|
| WT-36 | Tabs are draggable | ✅ |
| WT-37 | Drag from position 0 to 2 reorders | ✅ |
| WT-38 | Drag from position 2 to 0 reorders | ✅ |
| — | Dragged tab has reduced opacity | ✅ |
| — | Reordered tabs survive navigation | ✅ |

### Not Automated (manual only)
- WT-08: Tauri native transport (requires `npm run tauri:dev`)

---

## Appendix: `data-testid` & Selector Reference

**Tab Bar:**
- `conn-tab-bar` — connection tab bar
- `conn-tab-add` — add new tab button
- `conn-tab-close-${tabId}` — close button per tab
- `conn-tab-history-trigger` / `conn-tab-history-dropdown` — tab bar history

**Connection:**
- `connect-btn` / `disconnect-btn` — connect/disconnect
- `send-btn` — send message button
- `mode-client` — client mode switch

**Left-Pane Tabs:**
- `left-tab-connect` / `left-tab-compose` / `left-tab-auth` — left pane tabs

**Right-Pane Tabs:**
- `right-tab-events` / `right-tab-console` / `right-tab-stats` / `right-tab-loadtest` / `right-tab-schema` — right pane tabs

**URL History:**
- `url-history-trigger` / `url-history-dropdown` — URL history dropdown
- `url-history-clear-btn` — clear history button

**Messages & Events:**
- `message-list` — message list container
- `filter-toggle-btn` — filter bar toggle
- `export-messages-btn` — export messages as JSON

**Recording & Replay:**
- `start-recording-btn` / `stop-recording-btn` — recording controls
- `import-recording-btn` — import recording button
- `recording-file-input` — file input for recording import
- `import-error` — import error message
- `start-replay-btn` — start replay button
- `replay-bar` — replay control bar
- `replay-playpause-btn` — play/pause toggle
- `replay-exit-btn` — exit replay button
- `replay-progress` — replay progress bar
- `replay-speed-select` — speed selector

**Stats Panel:**
- `stats-panel` — stats panel container
- `stats-msg-rate` / `stats-bytes-in` / `stats-bytes-out` / `stats-errors` — metric cards

**Split Pane:**
- `ws-studio-split` — split pane container
- `ws-studio-divider` — resizable divider

**Console:**
- `ws-console-view-structured` / `ws-console-view-raw` — view toggles
