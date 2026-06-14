# WebSocket Load Test — Test Scenarios

> **File:** `ws-load-test-scenarios.md`
> **Covers:** Phase 17 — Load & Stress Testing
> **Last verified:** 2026-06-13 (Chrome E2E 19/19 + Tauri desktop manual, macOS)
> **Result:** 15/15 scenarios pass — no app bugs found
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
3. Get an echo server running:

   **Option A — Built-in Mock Server (recommended):**
   - Click **Mock Server** in the mode bar → click the green **Start** button (port `9876`)
   - Switch back to **Client** mode
   - In the **Connect** tab, enter `ws://localhost:9876`, click **Connect**

   **Option B — Docker echo server:**
   ```bash
   docker run -d --name ws-echo -p 8765:8080 jmalloc/echo-server
   ```
   - In the **Connect** tab, enter `ws://localhost:8765`, click **Connect**

4. Wait for the green **Connected** status

### 3. Open the Load Test Tab

Click the **Load Test** tab in the right pane tabs (next to Events / Console / Stats / Schema).

### 4. What You Should See

The Load Test tab shows a configuration form:

**Visual Anatomy of the Load Test Panel:**

| Element | Location | Description |
|---|---|---|
| **Profile pills** | Top | Three mode selectors: **Constant** \| **Ramp-up** \| **Burst** (default: Constant) |
| **Message Template** | Below profile | Textarea with placeholder variables hint: `{{counter}} {{timestamp}} {{random}}` |
| **Rate (msg/s)** | Left of duration | Number input (Constant/Ramp modes only) |
| **Duration (seconds)** | Right of rate | Preset buttons 5s \| 10s \| 15s \| 30s \| 60s + number input (Constant/Ramp only) |
| **End Rate** | Next to Rate | Only visible in Ramp-up mode |
| **Total Messages** | Replaces Rate/Duration | Only visible in Burst mode |
| **Summary** | Below fields | "Expected: ~N messages over Xs" |
| **Start Load Test** | Bottom left | Green button (disabled if disconnected or template empty) |
| **Reset** | Next to Start | Resets configuration to defaults |

---

## Load Test Configuration — Phase 17.1

### WL-01: Load Test Panel Renders

**Goal:** Verify the Load Test tab renders its configuration form.

1. Click the **Load Test** tab in the right pane
2. ✅ Panel shows "Load Test Configuration" header
3. ✅ Profile pills visible: **Constant** | **Ramp-up** | **Burst**
4. ✅ Message Template textarea visible with placeholder hint
5. ✅ Rate and Duration fields visible
6. ✅ **Start Load Test** and **Reset** buttons visible
7. ✅ Summary shows expected message count

---

### WL-02: Must Be Connected; Button States

**Goal:** Verify the Start button requires both connection and a template.

1. **Disconnected:** Navigate to Load Test tab without connecting first
2. ✅ A warning banner appears: **"Connect to a WebSocket endpoint first to run a load test."**
3. ✅ **Start Load Test** button is disabled
4. **Connected, empty template:** Connect, then clear the template textarea
5. ✅ **Start Load Test** button is disabled
6. **Connected + template filled:** Type any text in the template
7. ✅ **Start Load Test** button becomes enabled

---

### WL-03: Message Template with Placeholders

**Goal:** Verify template variable expansion.

1. In the template textarea, type:
   ```
   {"id":{{counter}},"ts":"{{timestamp}}","r":"{{random}}"}
   ```
2. ✅ The summary updates to show expected message count
3. ✅ Template accepts all three placeholder types without error
4. Start a quick test (3s at 5 msg/s) and check Events tab messages
5. ✅ `{{counter}}` expands to incrementing integers (1, 2, 3…)
6. ✅ `{{timestamp}}` expands to ISO timestamps
7. ✅ `{{random}}` expands to random alphanumeric strings

---

### WL-04: Load Profile Selector — Constant / Ramp / Burst

**Goal:** Verify switching between the three profiles changes the visible fields.

1. Click **Constant** (default) — observe the fields
2. ✅ Shows: **Rate (msg/s)** input + **Duration (seconds)** with preset buttons
3. Click **Ramp-up**
4. ✅ Shows: **Start Rate** input + **End Rate** input + **Duration**
5. ✅ Ramp-up pill is highlighted
6. Click **Burst**
7. ✅ Shows: **Total Messages** input only (no rate or duration)
8. ✅ Burst pill is highlighted

---

### WL-05: Duration Presets

**Goal:** Verify the 5s/10s/15s/30s/60s preset buttons.

1. In **Constant** mode, look at the Duration row
2. ✅ Five preset buttons: **5s** | **10s** | **15s** | **30s** | **60s**
3. ✅ A number input next to them for custom values
4. Click **15s** → the number input updates to `15`
5. Click **30s** → updates to `30`
6. Type `7` in the number input manually → custom duration accepted
7. ✅ Max 60 seconds enforced

---

### WL-06: Safety Confirmation for High Rate

**Goal:** Verify the confirmation dialog appears when rate > 100 msg/s.

1. Fill the template with `{"test":{{counter}}}`
2. Set **Rate** to `150`
3. Click **Start Load Test**
4. ✅ A confirmation dialog appears: **"Send at 150 msg/s for 10s?"**
5. ✅ **Confirm** and **Cancel** buttons visible
6. Click **Cancel** → dialog closes, config still visible (test did NOT start)
7. For **Ramp-up**: set Start Rate `10`, End Rate `200`
8. ✅ Confirmation shows: **"Ramp from 10 to 200 msg/s over 10s?"**

> **Safety limits enforced:** Max 1,000 msg/s rate, 60s duration, 60,000 burst messages.

---

## Real-Time Metrics — Phase 17.2

### WL-07: Constant-Rate Test Execution

**Goal:** Verify a load test runs with live updating metrics.

1. Set: **Constant** rate, **5 msg/s**, **3s** duration
2. Fill template: `{"test":{{counter}}}`
3. Click **Start Load Test**
4. ✅ The view switches to "**Load Test Running**" with a progress bar
5. ✅ Live counters update: **Sent** / **Received** / **Actual Rate** / **Target Rate** / **Elapsed**
6. ✅ A red **Stop** button replaces the Start button
7. Wait for the test to complete (~3 seconds)
8. ✅ Results view appears automatically when done

---

### WL-08: Ramp-Up Profile

**Goal:** Verify ramp-up gradually increases the send rate.

1. Click **New Test** (if results showing), switch to **Ramp-up**
2. Set: Start Rate `2`, End Rate `10`, Duration `3s`
3. Fill template: `{"ramp":{{counter}}}`
4. Click **Start Load Test**
5. ✅ Live "Actual Rate" counter starts low and increases over time
6. ✅ Progress bar advances linearly
7. Wait for completion
8. ✅ Total messages ≈ average rate × duration

---

### WL-09: Burst Profile

**Goal:** Verify burst sends N messages as fast as possible.

1. Click **New Test**, switch to **Burst**
2. Set: Total Messages `50`
3. Fill template: `{"burst":{{counter}}}`
4. Click **Start Load Test**
5. ✅ Burst completes almost instantly (sub-second for small counts)
6. ✅ Result shows **50 Messages Sent**
7. ✅ Avg Send Rate shows a very high value (thousands/s)

> **Note:** In burst mode, the test finishes before echo responses arrive, so "Received" may be 0 and latency data may be empty. This is expected.

---

### WL-10: Stop Button — Mid-Run Halt

**Goal:** Verify stopping a running test produces partial results.

1. Start a **Constant** test: 5 msg/s, **30s** duration
2. After ~2–3 seconds, click the red **Stop** button
3. ✅ Test stops immediately
4. ✅ Results view appears with **partial data**
5. ✅ Duration shows actual elapsed time (much less than 30s)
6. ✅ Sent count reflects only what was sent before stopping

---

### WL-11: Auto-Stop on Disconnect

**Goal:** Verify the test stops if the WebSocket connection drops.

1. Start a **Constant** test: 5 msg/s, **30s** duration
2. While the test is running, switch to the **Connect** tab and click **Disconnect**
3. ✅ The load test auto-stops
4. ✅ Results view appears with partial metrics
5. ✅ A warning banner shows: **"Disconnected — reconnect to run another load test."**
6. ✅ The **Run Again** button is disabled (requires reconnection)

---

## Results Summary — Phase 17.3

### WL-12: Results Summary — Total Metrics

**Goal:** Verify the full results display after a completed test.

1. Run a complete test: **Constant**, 10 msg/s, 3s
2. When the results appear, observe the **summary cards**:
3. ✅ **Messages Sent** — total count
4. ✅ **Received** — echo count
5. ✅ **Duration** — actual elapsed time
6. ✅ **Avg Send Rate** — messages per second
7. ✅ **Errors** card appears only if errors occurred
8. At the bottom:
9. ✅ **Bytes sent: X.X KB** and **Bytes received: X.X KB**

---

### WL-13: Latency Percentiles

**Goal:** Verify round-trip latency statistics.

1. After a completed test (with an echo server), observe the latency section:
2. ✅ Header: **"Round-Trip Latency (N samples)"**
3. ✅ Six latency cards: **Min** | **Mean** | **P50** | **P95** | **P99** | **Max**
4. ✅ All values in milliseconds
5. ✅ P95 card is visually highlighted
6. ✅ Against an echo server, most values should be in the 1–20ms range

> Latency is measured via nonce correlation: each sent message embeds a unique nonce, and the round-trip time is calculated when the echo arrives.

---

### WL-14: Latency Histogram

**Goal:** Verify the bucketed latency distribution chart.

1. After a completed test, look below the latency cards:
2. ✅ Header: **"Latency Distribution"**
3. ✅ Horizontal bar chart with labeled buckets (e.g., 0-1ms, 1-2ms, 2-5ms, 5-10ms…)
4. ✅ Each bar shows a count on the right
5. ✅ Against an echo server, most bars cluster in the low-ms buckets

---

### WL-15: Export Results and New Test

**Goal:** Verify the results action buttons.

1. After a completed test, observe the three buttons at the top of results:
2. ✅ **Run Again** — re-runs the same configuration (disabled if disconnected)
3. ✅ **New Test** — clears results, returns to config form
4. ✅ **Export JSON** — downloads results as a JSON file
5. Click **New Test**
6. ✅ Configuration form reappears with default values
7. ✅ A fresh test can be configured immediately

---

## Bugs Found During Testing

| Date | Scenario | Bug | Fix |
|---|---|---|---|
| — | All | No app bugs found during Chrome E2E (19/19) or Tauri manual testing | — |

**Historical fixes (from earlier development rounds):**

| Round | Scenario | Bug | Fix |
|---|---|---|---|
| Round 4 | WL-12 | `bytesSent` undercounted for non-ASCII — used `.length` (UTF-16) instead of `byteLength()` (UTF-8) | Fixed to use `byteLength(withNonce)` |
| Round 4 | WL-09 | Received frame fallback skips messages at cap — `startIdx = Math.max(0, len-1)` only processed last message | Changed fallback to `startIdx = 0` |
| Round 4 | WL-06 | Ramp profile not checked for high-rate confirmation — only checked `config.rate`, not `config.rateEnd` | Added ramp-specific rate check |

**E2E test selector fixes (not app bugs):**

| Date | Test | Issue | Fix |
|---|---|---|---|
| 2026-06-13 | WL-05 | `:text("5s")` matched both "5s" and "15s" buttons | Changed to `:text-is("5s")` for exact match |
| 2026-06-13 | WL-06 | Start button disabled — template filled after rate, race condition | Fill template before setting rate |
| 2026-06-13 | WL-11 | `lt-running` check timeout too short (3s) | Increased to 5s with 500ms pre-wait |

---

## Appendix: `data-testid` Reference

These selectors are used in the Playwright E2E test suite (`e2e/ws-load-test.spec.mjs`).

**Configuration:**
- `load-test-panel` — root container
- `lt-config` — configuration section wrapper
- `lt-profile-pills` — profile pill group
- `lt-profile-constant` / `lt-profile-ramp` / `lt-profile-burst` — profile buttons
- `lt-message-template` — message template textarea
- `lt-rate` — rate input (msg/s)
- `lt-rate-end` — end rate input (ramp mode only)
- `lt-duration` — duration input (seconds)
- `lt-burst-count` — burst count input
- `lt-summary` — expected messages summary
- `lt-start-btn` — Start Load Test button
- `lt-reset-btn` — Reset button

**Safety Confirmation:**
- `lt-confirm` — high-rate confirmation dialog
- `lt-confirm-yes` / `lt-confirm-no` — confirm/cancel buttons

**Running State:**
- `lt-running` — running state wrapper
- `lt-stop-btn` — Stop button
- `lt-live-stats` — live connection stats panel

**Results:**
- `lt-results` — results wrapper
- `lt-result-cards` — summary metric cards
- `lt-histogram` — latency distribution histogram
- `lt-run-again-btn` — Run Again button
- `lt-clear-btn` — New Test button
- `lt-export-btn` — Export JSON button
- `lt-done-disconnected` — disconnected warning banner
- `lt-not-connected` — not-connected warning (idle state)

---

## E2E Test Summary

**Spec file:** `e2e/ws-load-test.spec.mjs` — 19 tests
**Run command:** `npx playwright test e2e/ws-load-test.spec.mjs --reporter=list`
**Prerequisites:** Backend on 3001 (`npm run server`), Vite on 5173, Mock echo on 9876 (started by test)

| Test | Scenario | Status |
|---|---|---|
| WL-01 | Load Test panel renders | ✅ |
| WL-01b | Tab switch preserves state | ✅ |
| WL-02 | Must be connected; button states | ✅ |
| WL-02b | Start disabled when template empty | ✅ |
| WL-03 | Message template with placeholders | ✅ |
| WL-04 | Load profile selector | ✅ |
| WL-05 | Duration presets | ✅ |
| WL-06 | Safety confirmation — high rate | ✅ |
| WL-06b | Safety confirmation — ramp end rate | ✅ |
| WL-07 | Constant-rate execution | ✅ |
| WL-08 | Ramp-up execution | ✅ |
| WL-09 | Burst execution | ✅ |
| WL-10 | Stop button — mid-run halt | ✅ |
| WL-11 | Auto-stop on disconnect | ✅ |
| WL-12 | Results summary | ✅ |
| WL-13 | Latency percentiles | ✅ |
| WL-14 | Latency histogram | ✅ |
| WL-15 | Export results and New Test | ✅ |
| Cleanup | Stop mock server | ✅ |
