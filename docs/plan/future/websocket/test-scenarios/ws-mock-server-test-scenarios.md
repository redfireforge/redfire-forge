# WebSocket Mock Server Test Scenarios

> **File:** `ws-mock-server-test-scenarios.md`
> **Covers:** Phase 16 — WebSocket Mock Server (Express-hosted)
> **Created:** 2026-06-10
> **Tested on:** Web (Chrome), Tauri (macOS)
> **Docker:** Echo server (optional, for meta-testing)
> **Requires:** Backend server (`npm run server`)
>
> **2026-06-12 — Shell-IA doc refresh:** Mock Server is now a **mode** in the mode switch (Client | Mock Server | Saved), not a legacy "view tab". In Mock Server mode the shell shows a server bar (Start/Stop + port + fallback) on top, a connected-clients pane on the left, and a response-rules pane on the right. Visual re-validation deferred to the merge gate.

---

## Before You Start

### Dev Servers

```bash
npm run dev          # Frontend → http://localhost:5173
npm run server       # Backend — REQUIRED for mock server (Express companion)
```

### Navigation

1. Open **http://localhost:5173** → **Protocols** → **WebSocket**
2. Click the **Mock Server** mode in the mode switch (Client | **Mock Server** | Saved)

> **Note:** Mock Server is now a **mode** (not a sibling "view tab"). In Mock Server mode the shell shows a **server bar** at the top (Start/Stop toggle + port + fallback mode), a **connected-clients pane** in the left pane, and a **response-rules pane** in the right pane. The activity log appears within the mock panes.

---

## Mock Server Core — Phase 16.1

### WM-01: Mock Server mode renders

**Goal:** Verify the Mock Server mode layout

**Steps:**
1. Navigate to WebSocket Studio
2. Click the **Mock Server** mode

**Expected Results:**
- [ ] Selecting **Mock Server** mode switches the shell into the mock layout
- [ ] Server bar (top): Start/Stop toggle with status indicator "Stopped" (red/grey)
- [ ] Server bar: Port configuration (default 9876) and Fallback mode selector
- [ ] Right pane: Response Rules section + Test Rules preview
- [ ] Activity Log section visible within the mock panes

---

### WM-02: Port configuration

**Goal:** Verify port settings

**Steps:**
1. In **Mock Server** mode, find the Port input (server bar)
2. Change port to `9999`
3. Try invalid ports: `80` (below 1024), `70000` (above 65535)

**Expected Results:**
- [ ] Default port: 9876
- [ ] Port input accepts valid range: 1024–65535
- [ ] Invalid ports rejected or clamped
- [ ] Port value saved in state

---

### WM-03: Start mock server

**Goal:** Verify mock server startup

**Steps:**
1. Set port to 9876 (default)
2. Click **Start Server**

**Expected Results:**
- [ ] Status changes to "Running" (green indicator)
- [ ] Button text changes to "Stop Server"
- [ ] External WebSocket clients can connect to `ws://localhost:9876`
- [ ] Activity log shows "Server started on port 9876"

---

### WM-04: Auto-echo mode

**Goal:** Verify default echo behavior

**Steps:**
1. Start the mock server (WM-03)
2. Open a second tab, connect to `ws://localhost:9876`
3. Send a message from tab 2

**Expected Results:**
- [ ] Mock server echoes every received message back
- [ ] Activity log in Mock Server mode shows incoming + outgoing events
- [ ] Response is identical to the sent message

---

### WM-05: Connected client list

**Goal:** Verify client tracking

**Steps:**
1. Start mock server
2. Connect from tab 2 and tab 3

**Expected Results:**
- [ ] Client list shows 2 entries
- [ ] Each entry: client ID, connected-at timestamp, message count
- [ ] Count updates as messages are exchanged
- [ ] Disconnecting a client removes it from the list

---

### WM-06: Activity log

**Goal:** Verify activity log entries

**Steps:**
1. Start mock server, connect clients, send messages
2. Observe the Activity Log section

**Expected Results:**
- [ ] Scrollable list of events
- [ ] Event types: connect, disconnect, message-in, response-out
- [ ] Each entry shows timestamp and details
- [ ] Auto-scrolls to latest event

---

### WM-07: Stop mock server

**Goal:** Verify clean server shutdown

**Steps:**
1. While mock server is running, click **Stop Server**

**Expected Results:**
- [ ] Status changes to "Stopped"
- [ ] All connected clients disconnected with close code 1001 (Going Away)
- [ ] Activity log shows "Server stopped" event
- [ ] Port freed for reuse

---

## Broadcast

### WM-08: Broadcast to all clients

**Goal:** Verify broadcast functionality

**Steps:**
1. Start mock server, connect 2+ clients from separate tabs
2. Find the Broadcast input/button in **Mock Server** mode
3. Type a message and click Broadcast

**Expected Results:**
- [ ] Message sent to ALL connected clients simultaneously
- [ ] Each client's tab shows the received broadcast
- [ ] Activity log shows broadcast event with recipient count

---

### WM-09: Broadcast with no clients

**Goal:** Verify broadcast graceful handling

**Steps:**
1. Start mock server (no clients connected)
2. Send a broadcast message

**Expected Results:**
- [ ] No error — operation succeeds silently
- [ ] Activity log shows broadcast event with "0 clients"
- [ ] No crash or exception

---

## Response Rules Engine — Phase 16.2

### WM-10: Add response rule

**Goal:** Verify rule creation

**Steps:**
1. In **Mock Server** mode, click **+ Add Rule**
2. Configure:
   - Match type: "Contains"
   - Match value: "ping"
   - Response action: "Static"
   - Response body: `{"type":"pong","timestamp":"{{timestamp}}"}`
3. Save the rule

**Expected Results:**
- [ ] Rule added to rules list
- [ ] Shows match condition and response action
- [ ] Match types available: exact / contains / regex / JSONPath / any
- [ ] Response actions available: static / echo / template / close

---

### WM-11: Rule priority — reorder

**Goal:** Verify rule ordering

**Steps:**
1. Add 3 rules with overlapping match conditions
2. Use ▲/▼ buttons to reorder rules

**Expected Results:**
- [ ] ▲ moves rule up, ▼ moves rule down
- [ ] First-match-wins: first matching rule's response is used
- [ ] Reorder persists in state

---

### WM-12: Per-rule delay

**Goal:** Verify response delay

**Steps:**
1. Add a rule with delay: 2000ms
2. Connect a client and trigger the rule

**Expected Results:**
- [ ] Response arrives ~2000ms after the matching message
- [ ] Delay configurable: 0–10000ms
- [ ] Activity log reflects the delay

---

### WM-13: Template variables in responses

**Goal:** Verify template variable expansion

**Steps:**
1. Add a rule with response body:
   ```
   Client {{clientId}} received {{message}} at {{timestamp}} (count: {{counter}})
   ```
2. Trigger the rule multiple times

**Expected Results:**
- [ ] `{{message}}`: replaced with the received message content
- [ ] `{{timestamp}}`: replaced with ISO timestamp
- [ ] `{{clientId}}`: replaced with the connecting client's ID
- [ ] `{{counter}}`: auto-incrementing counter (1, 2, 3, ...)

---

### WM-14: Fallback mode

**Goal:** Verify fallback behavior

**Steps:**
1. Set fallback mode to "Echo back" → send a non-matching message
2. Set fallback to "Ignore" → send a non-matching message
3. Set fallback to "Close connection" → send a non-matching message

**Expected Results:**
- [ ] **Echo back** (default): unmatched messages echoed
- [ ] **Ignore:** unmatched messages silently dropped
- [ ] **Close connection:** client disconnected when no rule matches

---

### WM-15: Enable/Disable toggle per rule

**Goal:** Verify rule toggle

**Steps:**
1. With 2 rules, disable the first one
2. Send a message that would match rule 1

**Expected Results:**
- [ ] Disabled rule skipped during evaluation
- [ ] Visual indicator shows disabled state (grey/strikethrough)
- [ ] Re-enabling restores the rule to active evaluation

---

### WM-16: Rule test preview

**Goal:** Verify offline rule testing

**Steps:**
1. In the "Test Rules" section, type a sample message
2. Observe the matched rule and response preview

**Expected Results:**
- [ ] Shows which rule matches the sample message
- [ ] Shows the response that would be sent
- [ ] No actual server needed — evaluates rules client-side
- [ ] Template variables expanded in preview

---

## Live Rule Sync & Persistence

### WM-17: Edit rules while server running

**Goal:** Verify live rule updates

**Steps:**
1. Start mock server with rules
2. While running, add/edit/remove rules
3. Send messages from a client

**Expected Results:**
- [ ] New rules take effect immediately
- [ ] No server restart needed
- [ ] Client messages evaluated against updated rules
- [ ] Activity log reflects new rule matches

---

### WM-18: Rules persist across reload

**Goal:** Verify rule persistence

**Steps:**
1. Add several rules
2. Reload the page
3. Switch to **Mock Server** mode

**Expected Results:**
- [ ] All rules restored from `websocketStorage.ts`
- [ ] Match conditions, responses, delays, and order preserved
- [ ] Toggle states (enabled/disabled) preserved

---

## Meta-Testing

### WM-19: Connect RedfireForge to its own mock server

**Goal:** Verify self-connection (meta-testing)

**Steps:**
1. In tab 1, start mock server on port 9876
2. In tab 2, connect to `ws://localhost:9876`
3. Send messages from tab 2
4. Observe both tabs

**Expected Results:**
- [ ] Tab 2 connects successfully to tab 1's mock server
- [ ] Messages appear in tab 2's message log (sent/received)
- [ ] Mock server's activity log in tab 1 shows the same events
- [ ] Rules applied to tab 2's messages
- [ ] Demonstrates end-to-end WebSocket workflow within the same app

---

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| *(populated during testing)* | | | | |

---

## Test Data Export

Mock server rules can be exported via the Saved Connections profile system. See the profile export feature for persisting rule configurations.
