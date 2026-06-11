# WebSocket Tabs & Persistence Test Scenarios

> **File:** `ws-tabs-persistence-test-scenarios.md`
> **Covers:** Phases 9, 10, 11, 12, 13 — Multiple Connections, Tab Persistence, History, Bookmarks, Recording/Replay, Stats, Drag/Keyboard
> **Created:** 2026-06-10
> **Tested on:** Web (Chrome), Tauri (macOS)
> **Docker:** Echo server (`jmalloc/echo-server` on port 8765)

---

## Before You Start

### Docker Setup

```bash
docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
```

### Dev Servers

```bash
npm run dev          # Frontend → http://localhost:5173
npm run server       # Backend (proxy mode)
```

### Navigation

1. Open **http://localhost:5173** → **Protocols** → **WebSocket**
2. Tab bar is at the top of the WebSocket Studio page
3. View tabs (Connect/Messages/Saved/Mock) are below the connection tab bar

---

## Multiple Concurrent Connections — Phase 9

### WT-01: Add tabs up to 8; 9th blocked

**Goal:** Verify tab limit enforcement

**Steps:**
1. Start with default single tab
2. Click "+" button to add new tabs until 8 tabs exist
3. Click "+" one more time (9th attempt)

**Expected Results:**
- [ ] Tabs 1–8 can be added successfully
- [ ] 9th tab addition is blocked — "+" button may disable or show max-tabs message
- [ ] Each tab shows "New Connection" label with grey (disconnected) dot
- [ ] Tab bar scrolls/shrinks gracefully with 8 tabs (min-width 60px per tab)

---

### WT-02: Independent connection state per tab

**Goal:** Verify tabs are independent

**Steps:**
1. In tab 1: type `ws://localhost:8765`, click Connect
2. Switch to tab 2 (click "+" to create it)
3. Observe tab 2's state

**Expected Results:**
- [ ] Tab 1: Connected (green dot), URL filled, messages visible
- [ ] Tab 2: Disconnected (grey dot), URL empty, no messages
- [ ] Switching tabs preserves each tab's connection state
- [ ] Message counters are per-tab

---

### WT-03: Background tab stays connected

**Goal:** Verify connections persist when tab is not active

**Steps:**
1. Connect tab 1 to echo server
2. Send a message in tab 1
3. Switch to tab 2
4. Wait 10+ seconds
5. Switch back to tab 1

**Expected Results:**
- [ ] Tab 1 still shows Connected status
- [ ] Any messages received while on tab 2 appear in tab 1's log
- [ ] Uptime counter reflects full connection duration
- [ ] No data loss from background connection

---

### WT-04: Close tab with confirmation for connected tabs

**Goal:** Verify tab close behavior

**Steps:**
1. Connect tab 1 to echo server (Connected state)
2. Click the × (close) button on tab 1
3. Observe confirmation behavior

**Expected Results:**
- [ ] Close button (×) only visible on hover or for active tab
- [ ] Connected tab: confirmation dialog before closing
- [ ] Disconnected tab: closes immediately without confirmation
- [ ] After closing: adjacent tab becomes active
- [ ] Cannot close the last remaining tab (close button hidden or disabled)

---

### WT-05: Tab auto-label from URL; double-click to rename

**Goal:** Verify tab label behavior

**Steps:**
1. Type `ws://localhost:8765` in URL input
2. Observe tab label update
3. Double-click the tab label
4. Type "My Echo Server"
5. Press Enter

**Expected Results:**
- [ ] Tab label auto-updates from URL: "New Connection" → "localhost:8765"
- [ ] Double-click enables inline editing on the tab label
- [ ] Typing replaces the auto-generated label
- [ ] Press Enter confirms the rename
- [ ] Custom label persists across view tab switches

---

## Tab Persistence — Phase 10.1

### WT-06: Navigate away and back — tabs restored

**Goal:** Verify tab persistence across navigation

**Steps:**
1. Create 3 tabs with different URLs and labels
2. Click **Kafka** in sub-nav (navigate away)
3. Click **WebSocket** (navigate back)

**Expected Results:**
- [ ] All 3 tabs restored with correct labels
- [ ] URLs preserved in each tab
- [ ] View tab positions (Connect/Messages) preserved
- [ ] Active tab selection preserved

---

### WT-07: Restored tabs start disconnected

**Goal:** Verify connection state reset on restore

**Steps:**
1. Connect tab 1 to echo server
2. Navigate to Kafka and back
3. Observe tab 1

**Expected Results:**
- [ ] Tab 1 shows Disconnected status (grey dot)
- [ ] URL input still shows `ws://localhost:8765`
- [ ] Connection is not automatically resumed
- [ ] User must click Connect to re-establish

---

### WT-08: Tauri FS persistence across app restart

**Goal:** Verify persistence in Tauri desktop mode

**Steps:**
1. In Tauri desktop app, create tabs and set URLs
2. Close the app completely
3. Reopen the app

**Expected Results:**
- [ ] Tabs restored from Tauri FS storage
- [ ] Labels, URLs, and view positions preserved
- [ ] All tabs start disconnected
- [ ] This is a **Tauri-only** test (web mode uses localStorage)

---

### WT-09: Rename persists across navigation

**Goal:** Verify renamed tab persistence

**Steps:**
1. Rename tab to "Test Server"
2. Navigate away (Kafka) and back (WebSocket)

**Expected Results:**
- [ ] Tab label "Test Server" preserved after navigation
- [ ] Custom label takes priority over auto-generated URL label

---

### WT-10: First visit — default single tab

**Goal:** Verify clean-state initialization

**Steps:**
1. Clear localStorage (DevTools → Application → Local Storage → clear)
2. Reload the page
3. Navigate to WebSocket

**Expected Results:**
- [ ] Single "New Connection" tab created
- [ ] Tab has Disconnected status
- [ ] No saved state conflicts

---

## Connection History — Phase 10.2

### WT-11: Connect adds URL to history dropdown

**Goal:** Verify history recording

**Steps:**
1. Connect to `ws://localhost:8765`
2. Disconnect
3. Click the URL input's history trigger (▾ in tab bar or near URL)

**Expected Results:**
- [ ] History dropdown shows `ws://localhost:8765` entry
- [ ] Entry includes protocol badge (e.g., "Raw" or "Auto")
- [ ] Relative timestamp shown (e.g., "just now" or "1 min ago")

---

### WT-12: History row details

**Goal:** Verify history entry display

**Steps:**
1. Connect to multiple URLs in sequence
2. Open history dropdown

**Expected Results:**
- [ ] Each row shows: URL, protocol badge, relative timestamp
- [ ] Most recent connections at top
- [ ] Duplicate URLs update timestamp (not duplicated)

---

### WT-13: Click history row → fills URL + protocol

**Goal:** Verify history selection

**Steps:**
1. Open history dropdown
2. Click a history entry

**Expected Results:**
- [ ] URL input filled with selected URL
- [ ] Protocol mode set to the protocol used when connecting
- [ ] Dropdown closes after selection
- [ ] Ready to click Connect

---

### WT-14: Clear History button

**Goal:** Verify history clearing

**Steps:**
1. With history entries present, open dropdown
2. Click "Clear History" at the bottom

**Expected Results:**
- [ ] All history entries removed
- [ ] Dropdown closes or shows empty state
- [ ] History trigger (▾) hidden when history is empty

---

### WT-15: History is global across tabs

**Goal:** Verify shared history

**Steps:**
1. In tab 1, connect to `ws://localhost:8765`
2. Switch to tab 2
3. Open history dropdown in tab 2

**Expected Results:**
- [ ] History shows `ws://localhost:8765` (from tab 1)
- [ ] History is shared — not per-tab
- [ ] Can use history to quickly connect in any tab

---

## Quick Connect from Tab Bar — Phase 10.3

### WT-16: Tab bar dropdown (▾) shows recent URLs

**Goal:** Verify quick connect dropdown

**Steps:**
1. With history entries, look for ▾ arrow next to "+" in tab bar
2. Click the ▾ arrow

**Expected Results:**
- [ ] Dropdown shows recent URLs from connection history
- [ ] Each entry shows URL and protocol badge
- [ ] Clicking an entry creates a new tab

---

### WT-17: Click URL → new tab with pre-filled URL

**Goal:** Verify quick connect tab creation

**Steps:**
1. Open tab bar dropdown (▾)
2. Click a URL entry

**Expected Results:**
- [ ] New tab created and activated
- [ ] URL pre-filled with selected URL
- [ ] Protocol mode set from history entry
- [ ] Ready to connect immediately

---

### WT-18: No history → ▾ arrow hidden

**Goal:** Verify dropdown visibility with empty history

**Steps:**
1. Clear all history
2. Observe tab bar

**Expected Results:**
- [ ] ▾ arrow (Recent connections button) not visible
- [ ] Only "+" button shown in tab bar
- [ ] ▾ appears again when first connection is made

---

## Message Bookmarks — Phase 11.1

### WT-19: Click star to bookmark message

**Goal:** Verify bookmark toggle (on)

**Steps:**
1. Connect and send messages
2. Switch to Messages view
3. Click the ☆ (empty star) icon on a message row

**Expected Results:**
- [ ] Star fills: ☆ → ★
- [ ] Row may get a subtle highlight
- [ ] Aria-label changes from "Add bookmark" to "Remove bookmark"
- [ ] Bookmark count in direction filter updates

---

### WT-20: Click star again to remove bookmark

**Goal:** Verify bookmark toggle (off)

**Steps:**
1. Click the ★ (filled star) on a bookmarked message

**Expected Results:**
- [ ] Star empties: ★ → ☆
- [ ] Highlight removed
- [ ] Aria-label changes back to "Add bookmark"
- [ ] Bookmark count decrements

---

### WT-21: Direction filter — Bookmarked (N)

**Goal:** Verify bookmark filtering

**Steps:**
1. Bookmark 2-3 messages
2. Select "Bookmarked" from direction filter dropdown

**Expected Results:**
- [ ] Only bookmarked messages shown
- [ ] Filter label shows "Bookmarked" with count (e.g., "Bookmarked (3)")
- [ ] Non-bookmarked messages hidden
- [ ] Switching back to "All" shows all messages

---

### WT-22: Clear messages — bookmarks behavior

**Goal:** Verify bookmark behavior on clear

**Steps:**
1. Bookmark some messages
2. Click **Clear** button

**Expected Results:**
- [ ] All messages removed (including bookmarked ones)
- [ ] Message log empty
- [ ] Bookmark count resets to 0

---

### WT-23: Export includes bookmark flag

**Goal:** Verify bookmarks in export

**Steps:**
1. Bookmark some messages, leave others unbookmarked
2. Click **Export** button
3. Open the exported JSON file

**Expected Results:**
- [ ] Each message in JSON has `bookmarked: true` or `bookmarked: false`
- [ ] Bookmarked messages identifiable in exported data

---

## Session Recording — Phase 11.2

### WT-24: Click Record → red REC indicator

**Goal:** Verify recording start

**Steps:**
1. While connected, click **● Rec** button in toolbar

**Expected Results:**
- [ ] Recording starts — button shows red "REC" with pulsing animation
- [ ] Recording indicator visible
- [ ] Messages are captured with timestamps

---

### WT-25: Send/receive during recording

**Goal:** Verify recording captures messages

**Steps:**
1. While recording, send several messages
2. Observe echo responses

**Expected Results:**
- [ ] All sent and received messages captured
- [ ] Each event has a relative timestamp (from recording start)
- [ ] Message content and direction preserved

---

### WT-26: Stop recording → save file

**Goal:** Verify recording save

**Steps:**
1. While recording, click Stop (or the recording button again)
2. Save dialog appears

**Expected Results:**
- [ ] Browser: file download with `.wsrecording.json` extension
- [ ] Tauri: native save dialog
- [ ] File contains all recorded events

---

### WT-27: Recording file format

**Goal:** Verify recording JSON structure

**Steps:**
1. Open a saved `.wsrecording.json` file
2. Inspect the structure

**Expected Results:**
- [ ] `_format: "ws-recording-v1"` identifier
- [ ] Metadata: URL, protocol, duration, event count
- [ ] Events array with: type, data, timestamp, direction
- [ ] Valid JSON — parseable with `JSON.parse()`

---

## Session Replay — Phase 11.3

### WT-28: Import recording → replay controls

**Goal:** Verify replay mode activation

**Steps:**
1. Click **Import** button in toolbar
2. Select a `.wsrecording.json` file

**Expected Results:**
- [ ] Replay controls appear: ▶ Play, ⏸ Pause, Speed selector, Progress, ✕ Exit
- [ ] Message log cleared (ready for replay)
- [ ] Compose bar disabled during replay

---

### WT-29: Play → messages at original pace

**Goal:** Verify replay timing

**Steps:**
1. Click ▶ Play
2. Observe messages appearing
3. Change speed to 2× / 5× / 10× / Max

**Expected Results:**
- [ ] Messages appear at original recorded timing (1× speed)
- [ ] 2× speed: messages appear twice as fast
- [ ] Max speed: all messages appear at once
- [ ] Progress counter updates (e.g., "3/15 events")

---

### WT-30: Pause/Resume during replay

**Goal:** Verify pause functionality

**Steps:**
1. During replay, click ⏸ Pause
2. Click ▶ Resume

**Expected Results:**
- [ ] Pause stops message playback
- [ ] Progress counter freezes
- [ ] Resume continues from paused position
- [ ] No messages lost during pause

---

### WT-31: Exit Replay → clears messages

**Goal:** Verify replay exit

**Steps:**
1. During or after replay, click ✕ Exit

**Expected Results:**
- [ ] Replayed messages cleared from log
- [ ] Returns to normal (non-replay) mode
- [ ] Compose bar re-enabled
- [ ] Can start a new connection or import another recording

---

## Connection Stats Dashboard — Phase 12

### WT-32: Toggle Stats panel

**Goal:** Verify stats panel visibility

**Steps:**
1. While connected, click **Stats** button in toolbar

**Expected Results:**
- [ ] Collapsible stats panel appears below the toolbar (above message log)
- [ ] Panel shows: Msg/s, Bytes In, Bytes Out, Frame Types
- [ ] Click Stats again to collapse the panel

---

### WT-33: Live metrics during messaging

**Goal:** Verify real-time metric updates

**Steps:**
1. With Stats panel open, send messages rapidly
2. Observe metric values updating

**Expected Results:**
- [ ] **Msg/s:** Updates in real time (e.g., 2, 5, 10)
- [ ] **Bytes In:** Cumulative bytes received, with per-second rate
- [ ] **Bytes Out:** Cumulative bytes sent, with per-second rate
- [ ] **Frame Types:** Bar chart with Text/Binary/Control percentages and a legend (Text / Binary / Control counts)
- [ ] **Errors** card is **NOT shown** while the error count is 0 (the panel shows only Msg/s, Bytes In, Bytes Out, Frame Types)

> **Note:** Verified — with a healthy echo connection the Stats panel renders exactly four cards (Msg/s, Bytes In, Bytes Out, Frame Types). The **Errors** card (`ws-stats-card-error`) is conditional and only mounts when `errorCount > 0` (see WT-33a).

---

### WT-33a: Errors card appears only when errors occur

**Goal:** Verify the conditional Errors stats card

**Steps:**
1. With Stats panel open on a healthy connection, confirm there is no Errors card
2. Trigger a frame/transport error (e.g., send invalid Base64 in Binary format, or hit a connection error)
3. Observe the Stats panel

**Expected Results:**
- [ ] No **Errors** card while `errorCount` is 0
- [ ] Once an error is recorded, an **Errors** card appears with the error count value
- [ ] The Errors card uses the error styling (`ws-stats-card-error`)
- [ ] When a fresh connection with no errors is shown, the Errors card disappears again

---

### WT-34: Sparkline 60-second history

**Goal:** Verify sparkline chart

**Steps:**
1. With Stats panel open, send messages over ~60 seconds
2. Observe the sparkline in the Msg/s card

**Expected Results:**
- [ ] Sparkline image visible in the Msg/s section
- [ ] Shows rolling 60-second messages-per-second history
- [ ] Updates as new messages arrive
- [ ] Flat line when no messages being sent/received

---

### WT-35: Stats per-tab; disconnect zeros rates

**Goal:** Verify per-tab stats isolation

**Steps:**
1. Open Stats in tab 1, send messages (rates > 0)
2. Switch to tab 2, observe no stats
3. Switch back to tab 1, disconnect

**Expected Results:**
- [ ] Each tab has independent metrics
- [ ] Disconnect resets Msg/s and rate values to 0
- [ ] Cumulative byte totals preserved after disconnect
- [ ] Error state also zeros out rates

---

## Tab Drag-and-Drop Reorder — Phase 13.1

### WT-36: Drag tab to new position

**Goal:** Verify drag-and-drop reorder

**Steps:**
1. Create 3+ tabs
2. Click and hold tab 3
3. Drag it to position 1
4. Release

**Expected Results:**
- [ ] Tab moves to new position with visual drop indicator
- [ ] Tab bar reflects new order
- [ ] Order persists (saved to storage)
- [ ] All tab connections unaffected by reorder

---

### WT-37: Drag visual feedback

**Goal:** Verify drag UX indicators

**Steps:**
1. Start dragging a tab

**Expected Results:**
- [ ] Dragged tab has reduced opacity (~40%)
- [ ] Drop position indicated by accent color box-shadow or line
- [ ] Smooth animation during drag

---

### WT-38: Tab order preserved after navigation

**Goal:** Verify order persistence

**Steps:**
1. Reorder tabs via drag-and-drop
2. Navigate away (Kafka) and back (WebSocket)

**Expected Results:**
- [ ] Tab order matches the reordered state
- [ ] Labels and URLs correct in each position
- [ ] No jumbling of tab content

---

## Keyboard Navigation — Phase 13.2

### WT-39: Arrow Left/Right moves tab focus

**Goal:** Verify keyboard tab navigation

**Steps:**
1. Focus the tab bar (click on a tab)
2. Press → (Right Arrow) and ← (Left Arrow)

**Expected Results:**
- [ ] Focus ring moves between tabs
- [ ] Visual focus indicator (ring/outline) visible
- [ ] Does not wrap from last to first (or does, depending on design)

---

### WT-40: Enter/Space activates tab; Home/End

**Goal:** Verify keyboard tab activation

**Steps:**
1. Focus a tab with arrow keys
2. Press Enter or Space
3. Press Home, then End

**Expected Results:**
- [ ] Enter/Space: activates (selects) the focused tab
- [ ] Home: focuses the first tab
- [ ] End: focuses the last tab

---

### WT-41: Delete key closes focused tab

**Goal:** Verify keyboard tab close

**Steps:**
1. Focus a tab with arrow keys
2. Press Delete key

**Expected Results:**
- [ ] Connected tab: confirmation dialog appears
- [ ] Disconnected tab: closes immediately
- [ ] Focus moves to adjacent tab after close
- [ ] Cannot delete the last remaining tab

---

### WT-42: F2 key starts rename

**Goal:** Verify keyboard rename

**Steps:**
1. Focus a tab with arrow keys
2. Press F2

**Expected Results:**
- [ ] Inline text editor appears on the tab label
- [ ] Current label pre-filled for editing
- [ ] Enter confirms, Escape cancels
- [ ] Focus ring visible (keyboard-only indicator)

---

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| *(populated during testing)* | | | | |

---

## Test Data Export

Tab persistence data is stored in localStorage/Tauri FS and is not easily exportable as a static JSON file. Use the Docker + dev server setup to reproduce all scenarios.
