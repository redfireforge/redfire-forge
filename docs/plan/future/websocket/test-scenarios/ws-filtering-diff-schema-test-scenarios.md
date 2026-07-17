# WebSocket Filtering, Diff & Schema — Test Scenarios

> **File:** `ws-filtering-diff-schema-test-scenarios.md`
> **Covers:** Phases 14, 15, 19 — Advanced Filtering, Message Diff/Compare, Schema Validation
> **Last verified:** 2026-06-13 (Chrome E2E 33/33 + Tauri desktop manual, macOS)
> **Result:** 40/40 scenarios pass — no app bugs found
> **Requires:** Backend server (`npm run server` on port 3001), Echo server or Mock server

---

## Quick Start

### 1. Start the App

Open **two** terminals in the project root:

```bash
# Terminal 1 — Backend server (must start first)
npm run server

# Terminal 2 — Frontend dev server
npm run dev
```

### 2. Navigate to WebSocket Studio & Connect

1. Open **http://localhost:5173** → click **Protocols** → **WebSocket** in the sidebar
2. You're in **Client** mode by default (mode switch bar: **Client | Mock Server | Saved**)
3. There are two ways to get an echo server running:

   **Option A — Use the built-in Mock Server:**
   - Click **Mock Server** in the mode bar
   - Click the green **Start** button (port `9876`)
   - Switch back to **Client** mode
   - In the **Connect** tab (left pane), enter `ws://localhost:9876`, click **Connect**

   **Option B — Use a Docker echo server:**
   ```bash
   docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
   ```
   - In the **Connect** tab, enter `ws://localhost:8765`, click **Connect**

4. Wait for the green **Connected** status to appear

### 3. Send Test Messages

Switch to the **Compose** tab (left pane) and send these 5 messages one at a time (type and click **Send**):

```
Hello text message
{"type":"greeting","name":"Alice","count":1}
{"type":"error","code":500,"message":"Server error"}
{"type":"greeting","name":"Bob","count":2}
{"type":"status","active":true,"name":"Carol"}
```

### 4. What You Should See

Switch to the **Events** tab (right pane). You should see:

- **11 messages** total — 5 sent (↑) + 5 received/echoed (↓) + 1 system "Connected" message
- A **toolbar row** above the messages with: search mode pills, a search input, a direction dropdown ("All"), and a validation dropdown
- A **button bar** below the toolbar: **Filters | Compare | Clear | Export | ● Rec | Import**
- Each message row shows: star icon, direction arrow (↑/↓), timestamp, content-type badge (**TEXT** / **JSON** / **SYS**), message preview, and byte size

**Visual Anatomy of the Events Toolbar:**

| Element | Location | Description |
|---|---|---|
| **Text** / **Regex** / **JSONPath** | Left side, pill buttons | Search mode selector — one is always active (default: Text) |
| Search input | Center | Free-text input; placeholder "Search messages…" |
| Direction dropdown | Right of search | Filter by All / Sent / Received |
| Validation dropdown | Far right | Filter by All / Valid / Invalid (visible only when validation enabled) |
| **Filters** | Button bar, left | Toggle the attribute filter bar; shows badge count "(N)" when filters active |
| **Compare** | Button bar | Enter two-message diff/compare mode |
| **Clear** | Button bar | Clear all messages from the log |

---

## Search Modes — Phase 14.1

### WF-01: Search Mode Pills

**Goal:** Verify the search mode selector renders and switches modes.

1. Look at the toolbar above the message list
2. ✅ Three pills visible: **Text** | **Regex** | **JSONPath**
3. ✅ **Text** is active by default (highlighted)
4. Click **Regex** — it becomes highlighted, **Text** is deselected
5. Click **JSONPath** — it becomes highlighted, **Regex** is deselected
6. Click **Text** to return to default

---

### WF-02: Text Search — Substring Match

**Goal:** Verify text search filters messages by substring.

1. Make sure **Text** mode is active
2. Type `Hello` in the search input
3. ✅ Only 2 messages remain visible (1 sent "Hello text message" + 1 echoed)
4. ✅ Match counter shows **"2 of 11"**
5. Clear the search input — all 11 messages return
6. Type `greeting` — matches the 4 JSON greeting messages (2 Alice sent/echo + 2 Bob sent/echo)
7. ✅ Counter updates to **"4 of 11"**

---

### WF-03: Regex Search — Pattern Matching

**Goal:** Verify regex mode with valid and invalid patterns.

1. Click the **Regex** pill
2. Type `"type":\s*"error"` in the search input
3. ✅ 2 messages shown (error sent + error echo)
4. ✅ Counter shows **"2 of 11"**
5. Clear the input and type `[invalid` (broken regex)
6. ✅ Search input border turns **red** — invalid regex indicator
7. Clear the input — border returns to normal

---

### WF-04: JSONPath Search — Structured Queries

**Goal:** Verify JSONPath mode filters JSON messages by path.

1. Click the **JSONPath** pill
2. Type `$.type` in the search input
3. ✅ All JSON messages with a `type` field are shown (existence check)
4. ✅ Text and system messages are excluded (they're not JSON)
5. Clear and type `$.type=error`
6. ✅ Only 2 messages shown (error sent + echo) — exact value match
7. Switch back to **Text** mode and clear the search

---

### WF-05: Match Counter Live Updates

**Goal:** Verify the match counter updates as messages arrive.

1. With **Text** mode and `Hello` typed in the search input, note the counter: **"2 of 11"**
2. Switch to the **Compose** tab and send `Hello again`
3. Switch back to **Events**
4. ✅ Counter now shows **"4 of 13"** (2 new: sent + echo)
5. Clear the search input

---

## Attribute Filters — Phase 14.2

### WF-06: Filter Bar Toggle

**Goal:** Verify the filter bar shows/hides with the Filters button.

1. Click the **Filters** button in the button bar
2. ✅ A filter bar slides in below the toolbar with three dropdowns: **Size**, **Time**, **Content Type**
3. Click **Filters** again
4. ✅ The filter bar collapses/hides

---

### WF-07: Size Filter

**Goal:** Verify message filtering by byte size.

1. Open the filter bar (click **Filters**)
2. The **Size** dropdown shows "All" by default
3. Select **< 1KB** — all test messages are small, so all should remain
4. ✅ All 11 messages visible (all are under 1KB)
5. Select **> 10KB**
6. ✅ 0 messages visible (none are that large)
7. Reset to **All**

---

### WF-08: Time Filter

**Goal:** Verify message filtering by time window.

1. In the filter bar, the **Time** dropdown shows "All" by default
2. Select **Last 5m**
3. ✅ If you sent messages within the last 5 minutes, they all appear
4. Select **Last 30s**
5. ✅ Only very recent messages appear (older ones excluded)
6. Reset to **All**

---

### WF-09: Content Type Filter

**Goal:** Verify filtering by detected content type.

1. In the filter bar, find the **Content Type** dropdown
2. Select **JSON**
3. ✅ Only JSON-badged messages shown — 8 visible (4 JSON messages × 2 sent/echo)
4. ✅ Text messages ("Hello text message") and system messages are hidden
5. Select **Text**
6. ✅ Only TEXT-badged messages shown — 2 visible (sent + echo)
7. Reset to **All**

---

### WF-10: Filter Composition (AND Logic)

**Goal:** Verify multiple filters compose with AND logic.

1. Set **Content Type** to **JSON**
2. Type `greeting` in the search input (**Text** mode)
3. ✅ Only greeting JSON messages shown (subset of JSON filtered by text search)
4. Set **Size** to **< 1KB**
5. ✅ Same results (all are small) — filters stack with AND logic
6. Remove the search text — JSON filter still active, all 8 JSON messages return
7. Reset all filters

---

### WF-11: Active Filter Badge & Clear

**Goal:** Verify the badge count on the Filters button and the Clear action.

1. Open the filter bar
2. Set **Size** to "< 1KB" and **Time** to "Last 5m" (two non-default filters)
3. ✅ The **Filters** button now shows **"Filters (2)"** — badge count matches active filters
4. ✅ A **Clear** button/link appears in the filter bar
5. Click **Clear**
6. ✅ All dropdowns reset to "All"
7. ✅ Badge disappears — button shows just **"Filters"**
8. Close the filter bar

---

## Saved Filter Presets — Phase 14.3

### WF-12: Save Current Filters as Preset

**Goal:** Verify saving the current filter combination as a named preset.

1. Set up filters: **Text** search `error`, **Content Type** to "JSON"
2. Click the **Presets** button (📋 icon or "Save Preset")
3. Enter a name: `Error Messages`
4. ✅ Preset saved — appears in the presets dropdown
5. ✅ Success feedback shown (toast or inline)

---

### WF-13: Apply Preset → Restores Filters

**Goal:** Verify applying a preset restores all filter settings.

1. Clear all filters and search
2. Open the presets dropdown
3. Click **Error Messages** preset
4. ✅ Search mode: Text, query: "error" — restored
5. ✅ Content Type: JSON — restored
6. ✅ Messages filtered immediately to match

---

### WF-14: Delete Preset & Persistence

**Goal:** Verify preset deletion and survival across reload.

1. Open the presets dropdown
2. Click × (delete) on the "Error Messages" preset
3. ✅ Preset removed from the list
4. Reload the page → reconnect → resend test messages
5. ✅ Any remaining presets survived the reload (persisted to localStorage)
6. ✅ Maximum 20 presets enforced

---

## Two-Message Diff — Phase 15.1

### WF-15: Enter Compare Mode

**Goal:** Verify compare mode activation and banner.

1. Click the **Compare** button in the button bar
2. ✅ A banner appears above the message list: **"Click a message to select it for comparison"**
3. ✅ A **Cancel** button appears at the right end of the banner
4. ✅ The Compare button shows an active/highlighted state

---

### WF-16: Select A and B → Diff Modal Opens

**Goal:** Verify two-message selection opens the diff viewer.

1. In compare mode, click any message row (e.g., "Hello text message")
2. ✅ An **"A"** badge appears on that row
3. ✅ Banner updates: "Click a second message"
4. Click a different message row (e.g., the JSON greeting for Alice)
5. ✅ A **"B"** badge appears on the second row
6. ✅ The **Message Diff** modal opens automatically

---

### WF-17: Diff Modal — Content Comparison

**Goal:** Verify the diff modal shows a meaningful comparison.

1. With the diff modal open, observe the header:
2. ✅ **A** label shows: direction (↓/↑), timestamp, byte size
3. ✅ **B** label shows: direction, timestamp, byte size, and size difference (e.g., "+26 B")
4. ✅ The body shows a **line-level diff**: red (`-`) lines for content in A only, green (`+`) lines for content in B only
5. ✅ Title: **"Message Diff"**

---

### WF-18: JSON Structural Diff Summary

**Goal:** Verify structural change summary for JSON messages.

1. Select two different JSON messages for compare (e.g., greeting-Alice vs error message)
2. ✅ A summary line appears: "N structural changes: X added, Y changed, Z removed"
3. ✅ Each change lists the JSONPath (e.g., `$.name`, `$.code`) and change type

> **Note:** This summary only appears when both A and B are valid JSON messages.

---

### WF-19: Swap Sides

**Goal:** Verify the swap button flips A and B.

1. In the diff modal, note which message is A (left) and B (right)
2. Click the **⇄ Swap** button (icon between the A/B headers)
3. ✅ A and B switch positions — the left side now shows what was on the right
4. ✅ Diff re-calculates with the swapped order
5. ✅ Size difference sign flips (e.g., "+26 B" → "-26 B")

---

### WF-20: Close Diff → Exits Compare Mode

**Goal:** Verify closing the diff modal cleans up compare state.

1. Click the **×** (close) button on the diff modal
2. ✅ Diff modal closes
3. ✅ Compare mode exits — banner disappears
4. ✅ A/B badges removed from message rows
5. ✅ Normal message interaction restored (clicking opens detail, not compare)

---

## Quick Diff — Phase 15.2

### WF-21: Detail Panel — Diff ↑ / Diff ↓ Buttons

**Goal:** Verify quick diff buttons in the message detail panel.

1. Click any message row to open the **detail panel** (right side or bottom)
2. Look at the detail panel header
3. ✅ **Diff ↑** button present — diffs with the previous same-direction message
4. ✅ **Diff ↓** button present — diffs with the next same-direction message
5. ✅ Buttons are disabled if no adjacent same-direction message exists

---

### WF-22: Quick Diff ↑ Opens Diff Modal

**Goal:** Verify quick diff opens the same diff viewer without entering compare mode.

1. Click a message row (e.g., the 2nd received JSON message)
2. In the detail panel, click **Diff ↑**
3. ✅ Diff modal opens with the current message as B and the previous same-direction message as A
4. ✅ Same diff visualization as the two-message compare (WF-17)
5. Close the modal

---

### WF-23: D Keyboard Shortcut

**Goal:** Verify the keyboard shortcut for quick diff.

1. Click a message row to focus/select it
2. Press the **D** key on your keyboard
3. ✅ Diff modal opens (same as Diff ↑ from the detail panel)
4. ✅ Only works when a message row is selected/focused

---

## Schema Management — Phase 19.1

### WF-24: Schema Tab

**Goal:** Verify the Schema right-pane tab renders correctly.

1. Click the **Schema** tab in the right pane tabs (next to Events / Console / Stats / Load Test)
2. ✅ Schema panel shows an empty schema list
3. ✅ A **Validation** toggle (on/off) is visible
4. ✅ An **Add** button (+ icon) is visible

**Visual Anatomy of the Schema Panel:**

| Element | Description |
|---|---|
| **Validation toggle** | Master switch to enable/disable real-time validation |
| **Add button** | Opens the schema editor form |
| **Schema cards** | One card per saved schema: name, direction, enabled toggle |
| **Schema editor** | Form with Name input, Direction select, JSON textarea, Save/Generate/Cancel buttons |

---

### WF-25: Add Schema Manually

**Goal:** Verify creating a schema by hand.

1. Click the **Add** button
2. ✅ An editor form appears with: **Name** input, **Direction** dropdown, **JSON** textarea, **Save** button, **Generate** button
3. Enter name: `Greeting Schema`
4. Leave direction as default (e.g., "Both")
5. Paste this JSON Schema into the textarea:
   ```json
   {
     "type": "object",
     "required": ["type", "name", "count"],
     "properties": {
       "type": { "type": "string", "enum": ["greeting"] },
       "name": { "type": "string" },
       "count": { "type": "integer" }
     }
   }
   ```
6. Click **Save**
7. ✅ Schema card appears in the list with the name "Greeting Schema"
8. ✅ The editor form closes

---

### WF-26: Edit and Delete Schema

**Goal:** Verify schema CRUD operations.

1. Click **Edit** on the "Greeting Schema" card
2. ✅ Editor reopens with the existing name and JSON pre-filled
3. Change the name to `Greeting v2` and click **Save**
4. ✅ Card updates to show "Greeting v2"
5. Click **Delete** on the card
6. ✅ Schema removed from the list (confirmation may be shown)

> Re-add the Greeting Schema (repeat WF-25) before continuing to WF-28.

---

### WF-27: Max 20 Schemas & Validation on Paste

**Goal:** Verify schema limits and JSON validation.

1. Try pasting invalid JSON: `{invalid json` — click Save
2. ✅ Error message shown — invalid JSON rejected
3. ✅ Maximum 20 schemas per session enforced (if you try adding a 21st)

---

## Real-Time Validation — Phase 19.2

### WF-28: Validation Badges on Messages

**Goal:** Verify per-message validation badges appear when validation is enabled.

1. Make sure the "Greeting Schema" is saved (from WF-25)
2. Turn on the **Validation** toggle
3. Switch to the **Events** tab
4. ✅ **Greeting messages** (Alice, Bob) show a **✓** (green checkmark) badge
5. ✅ **Error and status messages** show a **✗** (red X) badge — they don't match the Greeting Schema
6. ✅ **Text and system messages** have no validation badge (not JSON)
7. ✅ A **"Validation: All"** dropdown appears in the toolbar (far right)

---

### WF-29: Validation Detail on Click

**Goal:** Verify clicking an invalid message shows validation errors.

1. Click a message with a **✗** badge (e.g., the error message)
2. Open the detail panel
3. ✅ A **Validation** tab is available in the detail panel
4. ✅ Shows the schema name that failed
5. ✅ Lists specific errors by JSONPath (e.g., missing `name`, wrong `type` value)

---

### WF-30: Validation Filter Dropdown

**Goal:** Verify filtering messages by validation status.

1. Find the **"Validation: All"** dropdown in the toolbar (far right)
2. Select **Valid**
3. ✅ Only messages with ✓ badges shown
4. Select **Invalid**
5. ✅ Only messages with ✗ badges shown
6. Reset to **All**

---

### WF-31: Performance — No Scroll Degradation

**Goal:** Verify validation doesn't slow down the message log.

1. With validation enabled, send 100+ messages rapidly (or use the Load Test tab)
2. Scroll through the message log
3. ✅ Scrolling remains smooth — no visible jank
4. ✅ Validation badges render without delay on new messages

---

## Schema Generation — Phase 19.3

### WF-32: Generate Schema from Messages

**Goal:** Verify automatic schema inference from received messages.

1. In the **Schema** tab, click **Add**
2. Click the **Generate** button (instead of typing JSON manually)
3. ✅ A JSON Schema is generated automatically based on received messages
4. ✅ Schema includes `type`, `properties`, and `required` fields
5. ✅ Property types are inferred correctly (string, number, boolean, integer)
6. Review the generated schema and click **Save**

---

### WF-33: Multi-Sample Inference Quality

**Goal:** Verify schema generation handles varying message structures.

1. Send messages with different shapes:
   ```
   {"id":1,"name":"Alice"}
   {"id":2,"name":"Bob","age":30}
   {"id":3,"name":"Carol","active":true}
   ```
2. Generate a schema
3. ✅ `id` (integer) and `name` (string) → **required** (present in all)
4. ✅ `age` (integer) → **optional** (not in all messages)
5. ✅ `active` (boolean) → **optional** (not in all messages)

---

## Console vs Events Interplay — Phase 14/19 Cross-Tab Behavior

> **Context:** Events and Console are independent right-pane tabs with separate logs, search, and filters.
> Messages sent via Console `/send` command DO appear in the Events log (they are real WebSocket frames).
> Schema validation applies ONLY to Events tab entries, never to Console entries.
> Search/filter state in one tab does NOT affect the other tab.

### WF-34: Console /send appears in Events log

**Goal:** Verify that messages sent via Console `/send` command also appear in the Events tab (since they go through the real WebSocket send path)

**Steps:**
1. Start the mock echo server (Mock Server tab → Start) and connect in Client mode (`ws://localhost:9876`)
2. Switch to **Console** right-pane tab (`data-testid="right-tab-console"`)
3. Type `/send {"action":"test","value":42}` in the command input (`data-testid="ws-console-cmd-input"`) and press Enter
4. Switch to **Events** right-pane tab (`data-testid="right-tab-events"`)

**Expected Results:**
- [x] Console shows `/send {"action":"test","value":42}` command echo
- [x] Console shows "Message sent." confirmation entry
- [x] Events tab shows a **sent** (↑) frame with `{"action":"test","value":42}`
- [x] Events tab shows a **received** (↓) echo frame from the mock echo server
- [x] Both Events frames have timestamps, content-type badge (JSON), size, and direction indicators

> ✅ **Automated:** `e2e/ws-filter-diff-schema-test.spec.mjs` — WF-34 (verified 2026-06-13)
> **How it works:** Console `/send` → `caps.send()` → `studio.send()` → `appendMessage(frame)` → Events log

---

### WF-35: Events search does NOT affect Console

**Goal:** Verify Events search and Console search are independent state stores

**Steps:**
1. Connect and send several messages (populates Events with frames, Console with lifecycle entries)
2. On **Events** tab: type "error" in the search input (`data-testid="search-input"`)
3. Note the match counter (`data-testid="match-counter"`) shows filtered results
4. Switch to **Console** right-pane tab (`data-testid="right-tab-console"`)

**Expected Results:**
- [x] Console search input (`data-testid="ws-console-search"`) is empty
- [x] All Console entries are visible (unfiltered by Events search)
- [x] Console count (`data-testid="ws-console-count"`) shows the full `{total}/{total}` count
- [x] Switching back to Events tab preserves the "error" search text and filtered results

> ✅ **Automated:** `e2e/ws-filter-diff-schema-test.spec.mjs` — WF-35 (verified 2026-06-13)

---

### WF-36: Console search does NOT affect Events

**Goal:** Verify Console filtering is isolated from Events

**Steps:**
1. On **Console** tab: type "Connecting" in Console search (`data-testid="ws-console-search"`) — this matches lifecycle entries like "Connecting to ws://..."
2. Set category filter (`data-testid="ws-console-category"`) to **handshake**
3. Note Console count badge shows filtered results
4. Switch to **Events** tab (`data-testid="right-tab-events"`)

**Expected Results:**
- [x] Events tab shows all messages (no filter applied from Console)
- [x] Events search input (`data-testid="search-input"`) is empty
- [x] No active filters badge on the Filters button

> ✅ **Automated:** `e2e/ws-filter-diff-schema-test.spec.mjs` — WF-36 (verified 2026-06-13)
> **Note:** Console search text is local `useState` — it resets on tab switch (component unmounts via conditional rendering). Console category filter (`settings.categoryFilter`) is parent-hook state and *does* persist. The test only verifies Console→Events isolation, not switchback state.

---

### WF-37: Schema validation only applies to Events

**Goal:** Verify Console entries are never schema-validated (validation badges are Events-only)

**Steps:**
1. Switch to **Schema** right-pane tab (`data-testid="right-tab-schema"`)
2. Click Add (`data-testid="ws-schema-add-btn"`) and create a schema:
   - Name: "id-required", schema: `{"type":"object","required":["id"]}`
3. Enable the validation toggle (`data-testid="ws-validation-toggle"`)
4. Switch to **Console** tab and send a message that violates the schema: `/send {"name":"no-id"}`
5. Switch to **Events** tab — check for validation badge on the sent frame
6. Switch back to **Console** tab — check Console entries

**Expected Results:**
- [x] Events tab: sent frame shows ✗ validation badge (missing required `id` field)
- [x] Events tab: echo response also shows ✗ validation badge
- [x] Console tab: "Message sent." entry has NO validation badge
- [x] Console tab: lifecycle/command entries never show ✗ or ✓ badges (Console entries are `WsConsoleEntry`, not `WsFrame`)
- [x] Validation filter dropdown (`data-testid="validation-filter"`) only appears in Events toolbar, not Console

> ✅ **Automated:** `e2e/ws-filter-diff-schema-test.spec.mjs` — WF-37 (verified 2026-06-13)
> **Architecture:** Console `/send` → `studio.send()` creates a frame in `messages[]` (Events) and a "Message sent." entry in `entries[]` (Console). Validation runs on `messages[]` only.

---

### WF-38: Filter presets are Events-only

**Goal:** Verify saved filter presets don't affect Console

**Steps:**
1. On Events tab: click **Filters** (`data-testid="filter-toggle-btn"`), set content-type to JSON
2. Save as preset "JSON Only" via Presets button (`data-testid="presets-btn"` → `data-testid="save-preset-btn"`)
3. Apply the preset → Events filtered to JSON messages only
4. Switch to **Console** tab

**Expected Results:**
- [x] Console shows all entries regardless of Events preset
- [x] Console has no "presets" mechanism (only level/category/search)
- [x] Switching back to Events preserves the content-type filter (parent-hook state) — same filtered row count

> ✅ **Automated:** `e2e/ws-filter-diff-schema-test.spec.mjs` — WF-38 (verified 2026-06-13)
> **Note:** The preset *list* (`filterPresets` in `useWebSocketFilterPresets`) is local state inside `WebSocketMessageLog` and resets on unmount. However, the underlying filters (content-type, size, time) are parent-hook state and persist. The filter bar UI (`showFilterBar`) also resets but the active filter still applies to the message list.

---

### WF-39: Clearing one tab does not clear the other

**Goal:** Verify clear operations are tab-independent (`messages[]` vs `entries[]` are separate state stores)

**Steps:**
1. Populate both tabs (connect, send messages — generates Events frames + Console lifecycle entries)
2. On **Events** tab: click Clear (`data-testid="clear-btn"`)
3. Switch to **Console** tab

**Expected Results:**
- [x] Console retains all its entries (unaffected by Events clear)
- [x] Console count badge (`data-testid="ws-console-count"`) unchanged
- [x] Console still shows lifecycle, command, and system entries

4. On **Console** tab: click Console Clear (`data-testid="ws-console-clear"`)
5. Switch to **Events** tab

**Expected Results:**
- [x] Events tab remains empty (from step 2's clear)
- [x] Console is now also empty
- [x] Sending a new message creates an Events entry but Console only gets new lifecycle/command events

> ✅ **Automated:** `e2e/ws-filter-diff-schema-test.spec.mjs` — WF-39 (verified 2026-06-13)

---

### WF-40: Compare mode is Events-only (Console has no compare)

**Goal:** Verify Compare mode only operates on Events frames; Console has no compare capability

**Steps:**
1. Send 3+ messages to populate Events
2. On **Events** tab → click Compare (`data-testid="compare-btn"`)
3. Select message A (click a message row) then message B → diff modal opens
4. Close diff modal, cancel compare mode
5. Switch to **Console** tab

**Expected Results:**
- [x] Compare banner appears on Events tab with "Click a message to select it for comparison"
- [x] Diff modal opens showing the two selected Event frames
- [x] After canceling, compare banner disappears
- [x] Console has NO compare button — compare is an Events-only feature

> ✅ **Automated:** `e2e/ws-filter-diff-schema-test.spec.mjs` — WF-40 (verified 2026-06-13)
> **Note:** Compare state does NOT survive tab switching — Events component unmounts when switching to Console, so compare mode resets. This is expected behavior (conditional rendering). Test verifies compare works within Events and is absent from Console.

---

## Bugs Found During Testing

| Date | Scenario | Bug | Fix |
|---|---|---|---|
| 2026-06-13 | WF-36 | Original scenario used "lifecycle" as Console search text, but Console entry messages don't contain the word "lifecycle" — entries are categorized as lifecycle but have messages like "Connecting to ws://..." | Changed search text to "Connecting" which actually matches lifecycle entry content |
| 2026-06-13 | WF-36, WF-40 | Original scenarios assumed Console/Events local state (search text, category filter, compare mode) persists across tab switches. In reality, tab switching uses conditional rendering — components unmount and local state resets. | Updated scenarios and tests to verify isolation within the active tab only, not cross-tab state persistence |

**Historical fixes (from earlier development rounds):**

| Round | Scenario | Bug | Fix |
|---|---|---|---|
| Round 1 | WF-14 | Filter preset stale closures — closure captured stale `filterPresets` | Fixed with functional `setFilterPresets(prev => ...)` |
| Round 5 | WF-31 | Validation cache memory leak — `validationCacheRef` not pruned for evicted messages | Added cache pruning logic |

---

## E2E Test Summary

**Spec file:** `e2e/ws-filter-diff-schema-test.spec.mjs` — 33 tests
**Run command:** `npx playwright test e2e/ws-filter-diff-schema-test.spec.mjs --reporter=list`
**Prerequisites:** Backend on 3001 (`npm run server`), Vite on 5173, Mock echo on 9876 (started by test)

| Test | Scenario(s) | Status |
|---|---|---|
| WF-01 | Search mode pills | ✅ |
| WF-02 | Text mode substring match | ✅ |
| WF-03 | Regex mode pattern matching | ✅ |
| WF-04 | JSONPath mode structured queries | ✅ |
| WF-05 | Match counter updates | ✅ |
| WF-06 | Filter bar toggle | ✅ |
| WF-07 | Size filter | ✅ |
| WF-08 | Time filter | ✅ |
| WF-09 | Content type filter | ✅ |
| WF-10 | Filter composition (AND logic) | ✅ |
| WF-11 | Active filter count badge | ✅ |
| WF-12 | Save filters as preset | ✅ |
| WF-13+14 | Apply and delete preset | ✅ |
| WF-15 | Compare mode toggle | ✅ |
| WF-16+17 | Select A+B → diff modal | ✅ |
| WF-18 | JSON structural changes summary | ✅ |
| WF-19 | Swap sides and Copy diff | ✅ |
| WF-20 | Close diff → exits compare mode | ✅ |
| WF-21+22 | Detail panel Diff ↑/↓ buttons | ✅ |
| WF-24 | Schema panel toggle | ✅ |
| WF-25 | Add schema | ✅ |
| WF-26 | Edit and Delete schema | ✅ |
| WF-28+29 | Validation badges on messages | ✅ |
| WF-30 | Validation filter dropdown | ✅ |
| WF-32 | Generate schema from messages | ✅ |
| WF-34 | Console /send appears in Events | ✅ |
| WF-35 | Events search does NOT affect Console | ✅ |
| WF-36 | Console search does NOT affect Events | ✅ |
| WF-37 | Schema validation — Events only | ✅ |
| WF-38 | Filter presets — Events only | ✅ |
| WF-39 | Clear one tab ≠ clear other | ✅ |
| WF-40 | Compare mode — Events only | ✅ |
| Cleanup | Stop mock server | ✅ |

---

## Appendix: `data-testid` Reference

These selectors are used in the Playwright E2E test suite (`e2e/ws-filter-diff-schema-test.spec.mjs`).

**Search & Toolbar:**
- `search-mode-pills` — pill container
- `search-mode-text` / `search-mode-regex` / `search-mode-jsonpath` — individual mode pills
- `search-input` — search text input
- `match-counter` — "N of M" counter
- `filter-toggle-btn` — Filters button (with badge)
- `compare-btn` — Compare mode button
- `compare-banner` / `compare-cancel` — compare mode banner and cancel
- `clear-btn` — Clear all messages
- `schema-toggle-btn` — Schema panel toggle (in toolbar)
- `validation-filter` — Validation status dropdown

**Filter Bar:**
- `filter-bar` — filter bar container
- `size-filter` / `time-filter` / `content-type-filter` — attribute dropdowns
- `clear-filters-btn` — reset all filters
- `presets-btn` / `save-preset-btn` — preset management
- `preset-apply-${id}` — apply a saved preset

**Diff Modal:**
- `diff-overlay` / `diff-modal` — overlay and modal container
- `diff-swap` / `diff-copy` / `diff-close` — action buttons
- `diff-meta-left` / `diff-meta-right` — A/B metadata headers
- `diff-summary` — structural changes summary

**Schema Panel:**
- `ws-schema-panel` — panel container
- `ws-validation-toggle` — master validation on/off
- `ws-schema-add-btn` — add new schema
- `ws-schema-editor` — editor form
- `ws-schema-name-input` — schema name input
- `ws-schema-direction-select` — direction dropdown
- `ws-schema-textarea` — JSON schema textarea
- `ws-schema-generate-btn` / `ws-schema-save-btn` — generate and save buttons
- `ws-schema-card` / `ws-schema-toggle` — schema list cards and per-card toggle

**Message Detail:**
- `detail-diff-prev` / `detail-diff-next` — quick diff ↑/↓ buttons

**Console Panel (WF-34–WF-40):**
- `ws-console-search` — Console search input
- `ws-console-count` — Console filtered/total count badge
- `ws-console-clear` — Clear Console entries
- `ws-console-cmd-input` — Console command input (`/send`, `/ping`, etc.)
- `ws-console-category` — Console category filter dropdown (all/lifecycle/command/system/handshake)

**Right-Panel Tabs:**
- `right-tab-events` / `right-tab-console` / `right-tab-schema` — tab switches
