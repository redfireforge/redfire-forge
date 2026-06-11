# WebSocket Load Test Scenarios

> **File:** `ws-load-test-scenarios.md`
> **Covers:** Phase 17 — Load & Stress Testing
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
npm run server       # Backend (for proxy mode if needed)
```

### Navigation

1. Open **http://localhost:5173** → **Protocols** → **WebSocket**
2. Connect to `ws://localhost:8765`
3. Switch to **Messages** view tab
4. Click **Load Test** button in toolbar

---

## Load Test Configuration — Phase 17.1

### WL-01: Load Test panel toggle

**Goal:** Verify load test panel visibility

**Steps:**
1. While connected, click **Load Test** button in toolbar

**Expected Results:**
- [ ] Load test panel expands below the toolbar
- [ ] Shows: message template input, profile selector, duration, rate
- [ ] Start button available
- [ ] Click Load Test again to collapse panel

---

### WL-02: Must be connected; button states

**Goal:** Verify prerequisites

**Steps:**
1. While disconnected, observe the Load Test panel
2. While connected but with empty template, observe Start button

**Expected Results:**
- [ ] **Disconnected:** Start button disabled, tooltip explains prerequisite
- [ ] **Connected, empty template:** Start button disabled
- [ ] **Connected, template filled:** Start button enabled
- [ ] Clear state distinction

---

### WL-03: Message template with placeholders

**Goal:** Verify template variables

**Steps:**
1. In load test panel, type in template input:
   ```
   {"id":{{counter}},"ts":"{{timestamp}}","r":"{{random}}"}
   ```

**Expected Results:**
- [ ] `{{counter}}`: auto-incrementing integer (1, 2, 3, ...)
- [ ] `{{timestamp}}`: ISO timestamp at send time
- [ ] `{{random}}`: random alphanumeric string
- [ ] Template preview may show an example expansion
- [ ] Invalid template syntax handled gracefully

---

### WL-04: Load profile selector

**Goal:** Verify profile options

**Steps:**
1. Find the profile selector pills/dropdown

**Expected Results:**
- [ ] Three profile options: **Constant rate** | **Ramp-up** | **Burst**
- [ ] Default: Constant rate
- [ ] Selecting Ramp-up shows start rate + end rate fields
- [ ] Selecting Burst shows message count field

---

### WL-05: Duration presets

**Goal:** Verify duration options

**Steps:**
1. Find the duration selector

**Expected Results:**
- [ ] Presets: 5s / 10s / 15s / 30s / 60s
- [ ] Custom input field for arbitrary duration
- [ ] Duration applies to Constant and Ramp profiles (not Burst)
- [ ] Max 60 seconds enforced

---

### WL-06: Safety limits and confirmation

**Goal:** Verify high-rate safety guard

**Steps:**
1. Set rate to 150 msg/s
2. Click Start
3. For ramp: set end rate to 200 msg/s

**Expected Results:**
- [ ] Confirmation dialog appears for rate > 100 msg/s
- [ ] Dialog text: describes the rate and duration
- [ ] For ramp profile: shows "Ramp from X to Y msg/s over Zs?"
- [ ] Max limits enforced: 1,000 msg/s, 60s, 60,000 burst messages
- [ ] Summary warning: "(high rate — may impact UI responsiveness)"

---

## Real-Time Metrics — Phase 17.2

### WL-07: Constant-rate test execution

**Goal:** Verify live test execution

**Steps:**
1. Set profile: Constant rate, 10 msg/s, 10s
2. Fill template: `{"test":{{counter}}}`
3. Click **Start**

**Expected Results:**
- [ ] Progress bar advances from 0% to 100%
- [ ] Live counters update: sent / received / elapsed / errors
- [ ] Messages appear in the message log in real time
- [ ] Test completes after configured duration

---

### WL-08: Ramp-up profile

**Goal:** Verify ramp-up rate progression

**Steps:**
1. Set profile: Ramp-up, start rate: 5 msg/s, end rate: 50 msg/s, duration: 10s
2. Start test

**Expected Results:**
- [ ] Send rate gradually increases from 5 to 50 msg/s
- [ ] Live rate counter reflects current ramp position
- [ ] Progress bar advances linearly
- [ ] Total messages ≈ average_rate × duration

---

### WL-09: Burst profile

**Goal:** Verify burst mode

**Steps:**
1. Set profile: Burst, message count: 500
2. Start test

**Expected Results:**
- [ ] Sends 500 messages as fast as possible (batched 50/tick)
- [ ] Completes quickly (depending on connection speed)
- [ ] All messages sent without rate limiting
- [ ] Counter shows final total: 500 sent

---

### WL-10: Stop button — mid-run halt

**Goal:** Verify stopping a running test

**Steps:**
1. Start a 30s constant-rate test
2. After 10s, click **Stop**

**Expected Results:**
- [ ] Test stops immediately
- [ ] Partial results produced with actual metrics
- [ ] Progress bar shows partial completion
- [ ] Duration reflects actual elapsed time (not configured)

---

### WL-11: Auto-stop on disconnect

**Goal:** Verify disconnect handling during test

**Steps:**
1. Start a load test
2. Stop the Docker echo server: `docker stop ws-echo`
3. Connection drops during test

**Expected Results:**
- [ ] Test auto-stops on connection disconnect
- [ ] Partial results produced
- [ ] Error count includes the disconnect event
- [ ] Actual duration and metrics reflect what was achieved

---

## Results Summary

### WL-12: Results summary — total metrics

**Goal:** Verify final results display

**Steps:**
1. Complete a load test (let it finish or stop manually)
2. Observe the results summary

**Expected Results:**
- [ ] Total sent messages
- [ ] Total received messages
- [ ] Actual duration
- [ ] Average send rate (msg/s)
- [ ] Error count (if any)
- [ ] Bytes sent / received (uses UTF-8 byte counting per Round 4 fix)

---

### WL-13: Latency percentiles

**Goal:** Verify latency statistics

**Steps:**
1. Complete a load test against the echo server
2. Observe the latency section in results

**Expected Results:**
- [ ] Min latency
- [ ] Mean latency
- [ ] p50 (median) latency
- [ ] p95 latency
- [ ] p99 latency
- [ ] Max latency
- [ ] All values in milliseconds
- [ ] Latency measured via nonce correlation (send→echo round-trip)

---

### WL-14: Latency histogram

**Goal:** Verify bucketed histogram display

**Steps:**
1. Observe the histogram section in results

**Expected Results:**
- [ ] Bucketed bar chart: 0-1ms, 1-2ms, 2-5ms, 5-10ms, ..., >5000ms
- [ ] Bars proportional to count of messages in each bucket
- [ ] Most echo server responses should be in the 0-10ms range
- [ ] Clear visual representation of latency distribution

---

### WL-15: Export results; New Test button

**Goal:** Verify results management

**Steps:**
1. After test completion, click **Export** (if available in results panel)
2. Click **New Test** button

**Expected Results:**
- [ ] **Export:** Results saved as JSON including all metrics, percentiles, histogram
- [ ] **New Test:** Clears results, resets to configuration view
- [ ] Fresh test can be configured immediately
- [ ] Previous results lost (not auto-saved unless exported)

---

## Bugs Found During Testing

| Date | Scenario | Bug | Root Cause | Fix |
|---|---|---|---|---|
| (prior) | WL-07 | bytesSent undercounted for non-ASCII | Used `.length` (UTF-16) instead of `byteLength()` (UTF-8) | Fixed to use `byteLength(withNonce)` |
| (prior) | WL-09 | Received frame fallback skips messages at cap | `startIdx = Math.max(0, len-1)` only processed last message | Changed fallback to `startIdx = 0` |
| (prior) | WL-06 | Ramp profile not checked for high-rate confirmation | Only checked `config.rate`, not `config.rateEnd` | Added ramp-specific rate check |

---

## Test Data Export

Load test results are transient. Export them via the Export button in the results panel to preserve as JSON.
