# WebSocket Filtering, Diff & Schema Test Scenarios

> **File:** `ws-filtering-diff-schema-test-scenarios.md`
> **Covers:** Phases 14, 15, 19 — Advanced Filtering, Message Diff/Compare, Schema Validation
> **Created:** 2026-06-10
> **Tested on:** Web (Chrome), Tauri (macOS)
> **Docker:** Echo server (`jmalloc/echo-server` on port 8765)
>
> **2026-06-12 — Shell-IA doc refresh:** In the Client-mode split-pane shell, the message log, filtering, and diff/compare controls live in the **Events** right-pane tab; schema validation lives in the dedicated **Schema** right-pane tab. The legacy "Messages view tab" / single-toolbar layout is gone. Visual re-validation deferred to the merge gate.

---

## Before You Start

### Docker Setup

```bash
docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
```

### Dev Servers

```bash
npm run dev          # Frontend → http://localhost:5173
npm run server       # Backend
```

### Navigation

1. Open **http://localhost:5173** → **Protocols** → **WebSocket**
2. Connect to `ws://localhost:8765`
3. In Client mode, open the **Events** right-pane tab (filtering & diff controls live here); schema validation is on the **Schema** right-pane tab

### Test Data Preparation

Send these messages before testing (to have diverse data):
```
Hello text message
{"type":"greeting","name":"Alice","count":1}
{"type":"error","code":500,"message":"Server error"}
{"type":"greeting","name":"Bob","count":2}
A very long message with lots of content to exceed 1KB threshold for size filter testing...
```

---

## Search Modes — Phase 14.1

### WF-01: Search mode pills — T / R / JP

**Goal:** Verify search mode selector

**Steps:**
1. Observe the toolbar above the message log
2. Find the search mode pills next to the search input

**Expected Results:**
- [ ] Three pills visible: **T** (Text) | **R** (Regex) | **JP** (JSONPath)
- [ ] Default selection: **T** (Text mode)
- [ ] Clicking a pill switches search mode
- [ ] Active pill is visually highlighted

---

### WF-02: Text mode — substring match

**Goal:** Verify text search

**Steps:**
1. Ensure T (Text) mode is selected
2. Type "Hello" in search input

**Expected Results:**
- [ ] Messages containing "Hello" are shown/highlighted
- [ ] Case-insensitive matching ("hello" matches "Hello")
- [ ] Non-matching messages filtered out or dimmed
- [ ] Match counter visible

---

### WF-03: Regex mode — pattern matching

**Goal:** Verify regex search

**Steps:**
1. Click **R** (Regex) mode pill
2. Type `"type":\s*"error"` in search input
3. Try invalid regex: `[invalid`

**Expected Results:**
- [ ] Valid regex filters messages matching the pattern
- [ ] Invalid regex: search input border turns red, tooltip "Invalid regex" shown
- [ ] Regex matches within JSON message content

---

### WF-04: JSONPath mode — structured queries

**Goal:** Verify JSONPath search

**Steps:**
1. Click **JP** (JSONPath) mode pill
2. Type `$.type` in search input
3. Type `$.type=error` for exact value match

**Expected Results:**
- [ ] `$.type`: matches messages that have a `type` field (existence check)
- [ ] `$.type=error`: matches messages where `type` equals "error"
- [ ] Non-JSON messages filtered out (no match)
- [ ] JSONPath evaluated against parsed message content

---

### WF-05: Match counter updates

**Goal:** Verify real-time match counting

**Steps:**
1. With a search active, send new messages
2. Observe the match counter

**Expected Results:**
- [ ] Counter shows "N of M" (e.g., "2 of 8")
- [ ] N = number of matching messages
- [ ] M = total messages
- [ ] Counter updates as new messages arrive

---

## Attribute Filters — Phase 14.2

### WF-06: Filter bar toggle

**Goal:** Verify filter bar visibility

**Steps:**
1. Click **Filters** button in toolbar
2. Observe the filter bar appearing

**Expected Results:**
- [ ] Filter bar slides in below toolbar (or inline)
- [ ] Shows: Size dropdown, Time dropdown, Content Type dropdown
- [ ] Click Filters again to collapse
- [ ] Auto-shows when a saved preset is applied

---

### WF-07: Size filter

**Goal:** Verify message size filtering

**Steps:**
1. Open filter bar
2. Select "< 1KB" from size dropdown
3. Select "1–10KB"
4. Select "> 10KB"

**Expected Results:**
- [ ] **All:** No filtering by size
- [ ] **< 1KB:** Only messages with `size < 1024` bytes shown
- [ ] **1–10KB:** Only messages with `1024 ≤ size ≤ 10240` bytes
- [ ] **> 10KB:** Only messages with `size > 10240` bytes
- [ ] Filter is based on `message.size` (byte count)

---

### WF-08: Time filter

**Goal:** Verify message time filtering

**Steps:**
1. Open filter bar
2. Select "Last 30s" from time dropdown
3. Wait 60 seconds, observe filter behavior
4. Select "Last 5m" and "Last 30m"

**Expected Results:**
- [ ] **All:** No time filtering
- [ ] **Last 30s:** Only messages from the last 30 seconds shown
- [ ] **Last 5m:** Only messages from the last 5 minutes
- [ ] **Last 30m:** Only messages from the last 30 minutes
- [ ] Filter updates dynamically (old messages disappear as they age out)

---

### WF-09: Content type filter

**Goal:** Verify content type classification

**Steps:**
1. Open filter bar
2. Select each content type option

**Expected Results:**
- [ ] **All:** No filtering by content type
- [ ] **JSON:** Only messages detected as JSON
- [ ] **Text:** Only plain text messages
- [ ] **Binary:** Only binary frame messages
- [ ] **Control:** Only system/control frames (ping, pong, close)
- [ ] Classification matches the type badge in message rows

---

### WF-10: Filter composition

**Goal:** Verify multiple filters combine correctly

**Steps:**
1. Set direction filter to "Sent"
2. Set size filter to "< 1KB"
3. Set time filter to "Last 5m"
4. Set content type to "JSON"
5. Enter "greeting" in text search

**Expected Results:**
- [ ] All filters compose with AND logic
- [ ] Only messages matching ALL active criteria are shown
- [ ] Filter count updates correctly
- [ ] Removing one filter broadens results

---

### WF-11: Active filter count badge

**Goal:** Verify filter indicator

**Steps:**
1. Set 3 non-default filters
2. Observe the Filters button

**Expected Results:**
- [ ] Badge on "Filters" button shows count of active (non-default) filters
- [ ] "Clear" link visible to reset all filters to default
- [ ] Click "Clear" → all dropdowns reset, badge disappears

---

## Saved Filter Presets — Phase 14.3

### WF-12: Save current filters as preset

**Goal:** Verify preset saving

**Steps:**
1. Set up: Text search "error", Size "< 1KB", Direction "Received"
2. Click "Save current" (or "Save Preset") in filter bar
3. Enter preset name: "Error Messages"

**Expected Results:**
- [ ] Preset saved with all current filter settings
- [ ] Appears in presets dropdown/list
- [ ] Success feedback (toast or inline confirmation)

---

### WF-13: Apply preset → restores filters

**Goal:** Verify preset application

**Steps:**
1. Reset all filters to default
2. Open presets dropdown
3. Click "Error Messages" preset

**Expected Results:**
- [ ] All filter fields restored to saved values
- [ ] Search mode: Text, query: "error"
- [ ] Size: "< 1KB", Direction: "Received"
- [ ] Messages filtered immediately

---

### WF-14: Delete preset; persistence

**Goal:** Verify preset management

**Steps:**
1. Open presets dropdown
2. Click × (delete) on a preset
3. Reload the page
4. Check presets

**Expected Results:**
- [ ] Preset deleted from list
- [ ] Presets persist across page reload (max 20 presets)
- [ ] Presets are global (shared across all tabs)
- [ ] Functional state updates prevent stale data (fixed in Round 1 audit)

---

## Two-Message Diff — Phase 15.1

### WF-15: Compare mode toggle

**Goal:** Verify compare mode activation

**Steps:**
1. Click **Compare** button in toolbar

**Expected Results:**
- [ ] Compare button shows active state
- [ ] Banner appears: "Click a message to select it for comparison"
- [ ] Cancel button available in banner
- [ ] Message rows become selectable for comparison

---

### WF-16: Select A and B → diff modal opens

**Goal:** Verify A/B selection and diff display

**Steps:**
1. In compare mode, click message row 1 → "A" badge appears
2. Click message row 3 → "B" badge appears
3. Diff modal auto-opens

**Expected Results:**
- [ ] First click: "A" badge on selected message, banner updates to "Click a second message"
- [ ] Second click: "B" badge on selected message
- [ ] Diff modal opens automatically after both selected
- [ ] Modal title: "Message Diff"

---

### WF-17: Diff modal — side-by-side JSON

**Goal:** Verify diff visualization

**Steps:**
1. With diff modal open (JSON messages selected), observe the content

**Expected Results:**
- [ ] Two-column view with message A (left) and B (right)
- [ ] Labels: "A" with direction/timestamp/size and "B" with same
- [ ] Size difference shown (e.g., "+11 B")
- [ ] Line-level diff highlighting: green (+) for additions, red (-) for removals
- [ ] Line numbers displayed

---

### WF-18: JSON structural changes summary

**Goal:** Verify structural diff header

**Steps:**
1. Observe the summary section in diff modal (above the line diff)

**Expected Results:**
- [ ] Summary: "N structural changes: X added, Y changed, Z removed"
- [ ] Each change listed by JSONPath (e.g., `$.id`, `$.name`, `$.role`)
- [ ] Change type: added / changed / removed
- [ ] For "changed": old value → new value shown

---

### WF-19: Swap sides and Copy diff

**Goal:** Verify diff actions

**Steps:**
1. Click ⇄ (Swap) button in diff modal header
2. Click **Copy** button

**Expected Results:**
- [ ] **Swap:** A and B positions flip (left↔right)
- [ ] **Copy:** Unified diff format copied to clipboard
- [ ] Diff recalculates with swapped positions
- [ ] Copy confirmation (toast or visual feedback)

---

### WF-20: Close diff → exits compare mode

**Goal:** Verify compare mode cleanup

**Steps:**
1. Click × (close) button on diff modal
2. Observe the message log state

**Expected Results:**
- [ ] Diff modal closes
- [ ] Compare mode exits — Compare button no longer active
- [ ] A/B badges removed from message rows
- [ ] Normal message interaction restored

---

## Quick Diff — Phase 15.2

### WF-21: Detail panel — Diff ↑ / Diff ↓ buttons

**Goal:** Verify quick diff buttons

**Steps:**
1. Click a message to open detail panel
2. Find the Diff buttons in the detail panel header

**Expected Results:**
- [ ] **Diff ↑** button: available when a previous same-direction message exists
- [ ] **Diff ↓** button: available when a next same-direction message exists
- [ ] Buttons disabled when no adjacent same-direction message

---

### WF-22: Click Diff ↑ → diff modal pre-loaded

**Goal:** Verify quick diff from detail panel

**Steps:**
1. In detail panel, click **Diff ↑**

**Expected Results:**
- [ ] Diff modal opens with current message as B, previous as A
- [ ] Same diff visualization as two-message compare
- [ ] No need to enter compare mode first

---

### WF-23: D keyboard shortcut

**Goal:** Verify diff keyboard shortcut

**Steps:**
1. Click a message row to select it
2. Press **D** key

**Expected Results:**
- [ ] Diff modal opens with current + previous same-direction message
- [ ] Same as clicking Diff ↑ from detail panel
- [ ] Only works when a message is selected/focused

---

## Schema Management — Phase 19.1

### WF-24: Schema toolbar button

**Goal:** Verify schema panel toggle

**Steps:**
1. Click **Schema** button in toolbar

**Expected Results:**
- [ ] Schema panel opens (collapsible)
- [ ] Shows schema list (empty initially)
- [ ] "Add Schema" button available
- [ ] Toggle button to enable/disable validation

---

### WF-25: Add schema

**Goal:** Verify schema creation

**Steps:**
1. Click **Add Schema** (or similar)
2. Paste a JSON Schema:
   ```json
   {
     "type": "object",
     "properties": {
       "type": {"type": "string"},
       "name": {"type": "string"}
     },
     "required": ["type"]
   }
   ```
3. Set name: "Greeting Schema"
4. Set direction: "Both" (sent and received)
5. Enable the schema

**Expected Results:**
- [ ] Schema saved and appears in list
- [ ] Name, direction, and enabled status shown
- [ ] Invalid JSON Schema rejected with error message

---

### WF-26: Edit and Delete schema

**Goal:** Verify schema CRUD

**Steps:**
1. Click Edit on an existing schema
2. Modify the schema content
3. Save changes
4. Then click Delete on the schema

**Expected Results:**
- [ ] Edit re-opens editor with existing content pre-filled
- [ ] Save updates the schema in-place
- [ ] Delete removes the schema (with confirmation)
- [ ] Schema list updates after each operation

---

### WF-27: Max 20 schemas; validation on paste

**Goal:** Verify schema limits

**Steps:**
1. Try adding 21 schemas (if possible)
2. Try pasting invalid JSON: `{invalid json`

**Expected Results:**
- [ ] Max 20 schemas per session enforced
- [ ] Invalid JSON rejected with error message
- [ ] Valid JSON Schema accepted

---

## Real-Time Validation — Phase 19.2

### WF-28: Validation badges on messages

**Goal:** Verify per-message validation

**Steps:**
1. Add and enable a schema (from WF-25)
2. Send messages that match and don't match the schema

**Expected Results:**
- [ ] Matching messages: ✓ (green) badge on row
- [ ] Non-matching messages: ✗ (red) badge on row
- [ ] Badges appear on each new message in real time
- [ ] Validation is fast (< 1ms per message with compiled schema)

---

### WF-29: Click invalid message → Validation tab

**Goal:** Verify validation detail view

**Steps:**
1. Click a message with ✗ (red) badge
2. Open the detail panel

**Expected Results:**
- [ ] **Validation** tab available in detail panel
- [ ] Shows: schema name that failed
- [ ] Error list: JSONPath + error message for each validation error
- [ ] Example: `$.type required — "type" is a required property`

---

### WF-30: Validation filter dropdown

**Goal:** Verify filtering by validation status

**Steps:**
1. With validation enabled, find validation filter control
2. Select "Valid" then "Invalid"

**Expected Results:**
- [ ] **All:** Shows all messages regardless of validation
- [ ] **Valid:** Shows only ✓ messages
- [ ] **Invalid:** Shows only ✗ messages
- [ ] Filter composition works with other filters

---

### WF-31: Performance — no scroll degradation

**Goal:** Verify validation doesn't impact rendering

**Steps:**
1. Send 500+ messages with validation enabled
2. Scroll through the message log rapidly

**Expected Results:**
- [ ] Scrolling remains smooth
- [ ] No visible jank or lag
- [ ] Validation cache prevents re-computation (pruned when stale per Round 5 fix)

---

## Schema Generation — Phase 19.3

### WF-32: Generate schema from messages

**Goal:** Verify schema inference

**Steps:**
1. Send 5+ JSON messages with similar structure
2. Click **Generate** button in schema panel

**Expected Results:**
- [ ] Inferred schema generated and shown in editor
- [ ] Schema reflects common properties across messages
- [ ] Required fields: properties present in ALL messages
- [ ] Optional fields: properties present in SOME messages
- [ ] Type inference: string, number, boolean, object, array

---

### WF-33: Multi-sample inference

**Goal:** Verify schema generation quality

**Steps:**
1. Send messages with varying structures:
   - `{"id":1,"name":"Alice"}`
   - `{"id":2,"name":"Bob","age":30}`
   - `{"id":3,"name":"Carol","active":true}`
2. Generate schema

**Expected Results:**
- [ ] `id` (number) and `name` (string) → required (present in all)
- [ ] `age` (number) → optional (not in all)
- [ ] `active` (boolean) → optional (not in all)
- [ ] Union type handling for mixed-type fields

---

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| 2026-06-10 | WF-15 | Compare mode works correctly | N/A — verified as functional | No fix needed |
| 2026-06-10 | WF-17 | Diff modal shows excellent structural analysis | N/A — verified as functional | No fix needed |
| (prior) | WF-14 | Filter preset stale closures | Closure captured stale `filterPresets` | Fixed with functional `setFilterPresets(prev => ...)` |
| (prior) | WF-31 | Validation cache memory leak | `validationCacheRef` not pruned for evicted messages | Added cache pruning logic |

---

## Test Data Export

See `docs/test-data/ws-filtering-diff-schema-export.json` for importable test data.
