# Kafka Runner — Visual Test Scenarios

> **Covers:** Integration Phases 6–8 — Workflow Runner Kafka execution, Load Policy, Results Publishing
> **Created:** 2026-06-05
> **Purpose:** Step-by-step manual guide for verifying Kafka scenario execution in the Test Runner,
> load-mode policy banners, results rendering, and results publishing to Kafka.
>
> Work through each scenario top-to-bottom. Check the box ☐ when the expected result is confirmed.

---

## Validation Status (2026-06-05)

| Scenario | Method | Status | Notes |
|---|---|---|---|
| **Workflow Runner — Load Policy (Phase 7)** | | | |
| **KR-01** Load policy block banner | Docker + Playwright | ✅ Validated | Red ⛔ banner: "Cannot run load test: Consume (wait-for-real) is configured with wait-for-real mode" |
| **KR-02** Load policy info banner | Docker + Playwright | ✅ Validated | Blue ℹ banner: "Auto-resume: Consume (no load mode) has no load test behavior set" |
| **KR-03** Produce + Consume workflow load test | Docker + Playwright + Kafka Studio | ✅ Validated | 5/5 iterations, 5/5 requests, 113.9 TPS, 0% errors. 10 messages verified in `runner.load.test` via Kafka Studio Consume (detail pane: JSON body + Content-Type/X-Test-Type headers) |
| **KR-04** Synthetic-inject load test | Docker + Playwright | ✅ Validated | 3/3 iterations, 3/3 requests, 84.99 TPS, 0% errors |
| **KR-05** Deterministic replay (3× same config) | Docker + Playwright | ✅ Validated | 3 runs: 115/156/131 TPS, all 5/5 iterations, 0% errors |
| **KR-06** kafkaOperations threading under concurrency | Docker + Playwright | ✅ Validated | 10/10 iterations, concurrency 5, 322.58 TPS, no threading errors |
| **Results Rendering** | | | |
| **KR-07** PRODUCE/CONSUME status badges | Docker + Playwright | ✅ Validated | PRODUCE badge renders (not "200 OK"). Request count now >0 (was 0 before fix). Consume auto-skipped in load mode |
| **KR-08** Kafka results detail drill-down | Docker + Playwright | ✅ Validated | Detail panel opens showing PRODUCE badge, step name, kafka:// URL, timing |
| **KR-09** Mixed HTTP + Kafka results grouping | Docker + Playwright + Kafka Studio | ✅ Validated | Scenario 02: HTTP `200` + Kafka `PRODUCE` in same table, 2 req. Kafka Studio Consume verified 5 messages on `orders.enriched` with `X-Enriched-By: redfireforge` header |
| **KR-10** Results dashboard metrics for Kafka run | Docker + Playwright | ✅ Validated | 10 req, 322.58 TPS, 14.9ms avg, 0% errors — all non-zero (was 0 req before fix) |
| **Results Publishing — Phase 8** | | | |
| **KR-11** Publish run summary to Kafka topic | Docker + Playwright + Kafka Studio | ✅ Validated | 2 messages published to `runner.results.summary` (standard + abort path). Verified in Kafka Studio Consume: full v1.0 envelope with pretty-printed JSON |
| **KR-12** Verify envelope schema (v1.0) | Docker + Kafka Studio | ✅ Validated | Kafka Studio detail pane: `schemaVersion: "1.0"`, `runId: "b675837a-..."`, `executionMode: "workflow"`, `summary: {tps: 59.17, avgResponseTime: 16, totalRequests: 1, successfulRequests: 1, failedRequests: 0, totalDurationMs: 17}`, `workflowName: "Runner — Auto-Resume Load"` |
| **KR-13** Publishing disabled → no message | Docker + Playwright | ✅ Validated | `enabled: false` → no new message published, HWM unchanged |
| **KR-14** Publish failure non-blocking | Docker + Playwright | ✅ Validated | Bad cluster → run completes normally, console warns `Kafka results publish failed`, no uncaught errors |
| **KR-15** Publish fires on all 3 save paths | Docker + Playwright | ✅ Validated | Standard completion: published. Abort path (Stop mid-run): partial results saved + published (HWM 1→2) |
| **Harness Kafka Scenarios — Phase 6** | | | |
| **KR-16** Import Kafka harness JSON → renders Kafka badge | Docker + Playwright | ✅ Validated | Existing groups load; Kafka workflow results show PRODUCE/CONSUME badges |
| **KR-17** Migration safety: HTTP-only import → no breakage | Docker + Playwright | ✅ Validated | HTTP groups load, run, display numeric status (200, 404), no errors |
| **KR-18** Backward-compatible load — no actionType | Docker + Playwright | ✅ Validated | Legacy scenarios execute as HTTP, GET/POST badges, no console errors about missing actionType |
| **Transport-Aware Outcomes & Export** | | | |
| **KR-19** Kafka outcomes — transport-aware semantics | Docker + Playwright | ✅ Validated | 0% error rate on Kafka runs; Status shows PRODUCE not "200 OK"; HTTP shows numeric codes |
| **KR-20** Export mixed-suite results | Docker + Playwright | ✅ Validated | Mixed table: HTTP `200` + Kafka `PRODUCE` render correctly in same results view |

**Design Gaps Fixed (2026-06-05):**

Three design gaps were identified during initial validation and fixed in the same session:

1. **~~Workflow-mode Kafka nodes don't produce `RequestResult` entries~~** — **FIXED.** `graphRunnerKafkaNodeHandlers.ts` now pushes `RequestResult` entries with `transportType: 'kafkaProduce'`/`'kafkaConsume'` and `kafkaResultMeta` into `hCtx.results`. The "0 requests" issue is resolved.
2. **~~WorkflowRunner does not wire `kafkaResultsPublish`~~** — **FIXED.** `useWorkflowRunnerConfig` now includes `kafkaResultsPublish` state (loaded/saved to storage), and `WorkflowRunner.tsx` passes it to `useTestExecution(kafkaResultsPublish)`.
3. **~~Standard Runner `kafkaOperations` wiring gap~~** — **FIXED.** `useTestExecution.ts` now always builds `kafkaOperations` via `buildKafkaNodeOperations()` regardless of whether a workflow is present. Harness Kafka scenarios in the Standard/Parameterized Runner now correctly route through `executeNonHttp`.

> **Note:** `loadTestBehavior` may be stripped during bulk IDB import. Re-storing the workflow JSON directly preserves the field. Individual workflow import via the UI works correctly.

---

## Prerequisites

### Docker Broker

All scenarios require the plaintext Redpanda broker:

```bash
# Start plaintext broker (if not running)
cd docker/kafka/plaintext && docker compose up -d

# Verify
docker exec redfireforge-redpanda rpk cluster info --brokers localhost:9092
```

### Backend Server + Frontend

```bash
# Terminal 1 — backend
npm run server

# Terminal 2 — frontend
npm run dev
```

Open `http://localhost:5173` in browser.

### Kafka Cluster Connection

1. Go to **Settings** (gear icon in activity bar) → **Kafka** tab
2. Select **Local Plaintext** cluster (or add one: brokers `127.0.0.1:19092`)
3. Click **Test Connection** → verify **Connected** status
4. Click **Save**

### Seed Test Data

```bash
# Create topics for runner tests
docker exec redfireforge-redpanda rpk topic create \
  runner.kafka.produce \
  runner.kafka.consume \
  runner.kafka.mixed \
  runner.results.summary \
  runner.load.test \
  --brokers localhost:9092

# Seed consume topic with 5 test messages
for i in 1 2 3 4 5; do
  echo "{\"orderId\":\"ORD-00$i\",\"amount\":$((i*100)),\"status\":\"pending\",\"customer\":\"cust-$i\"}" | \
    docker exec -i redfireforge-redpanda rpk topic produce runner.kafka.consume \
      --key "order-$i" \
      -H "x-correlation-id:corr-$i" \
      -H "x-source:runner-test" \
      --brokers localhost:9092
done
```

### Import Test Workflows

Import the workflow JSONs needed for these scenarios:

1. Go to **Workflow** (left activity bar)
2. Click **Import** button (↑ icon)
3. Import these files one at a time:
   - `docs/test-data/kafka-workflow-scenario-01-produce-consume.json`
   - `docs/test-data/runner/kafka-runner-load-policy-block.json`
   - `docs/test-data/runner/kafka-runner-load-policy-info.json`
   - `docs/test-data/runner/kafka-runner-auto-resume-load.json`
   - `docs/test-data/runner/kafka-runner-synthetic-inject-load.json`

---

## Part 1: Workflow Runner — Load Policy (Phase 7)

### KR-01: Load Policy Block Banner (wait-for-real)

**Goal:** Verify that a workflow with a `kafkaConsume` node in `wait-for-real` mode shows a block banner preventing load test execution.

**Steps:**

1. Go to **Harness** → **Workflow Runner** tab
2. Select the workflow **"Runner — Load Policy Block"**
3. Look at the area below the iteration/concurrency config

**Expected Results:**

- ☐ A red block banner appears: **"⛔ Cannot run load test: [node name] is configured with wait-for-real mode"**
- ☐ The banner instructs changing to **auto-resume** or **synthetic-inject**
- ☐ The **Run Workflow** button is still visible but the banner clearly warns against running

**Console Verification:**

4. Open the workflow in the **Workflow Designer** → double-click the `kafkaConsume` node
5. Verify: `Load Test Behavior` is set to **wait-for-real**
6. Change to **auto-resume** → save → go back to Workflow Runner
7. ☐ The block banner disappears; an info banner may appear instead

---

### KR-02: Load Policy Info Banner (no loadTestBehavior)

**Goal:** Verify that a workflow with a `kafkaConsume` node that has NO `loadTestBehavior` set shows an informational auto-resume banner.

**Steps:**

1. Go to **Harness** → **Workflow Runner** tab
2. Select the workflow **"Runner — Load Policy Info"**
3. Look at the area below the iteration/concurrency config

**Expected Results:**

- ☐ A blue info banner appears: **"ℹ Auto-resume: [node name] has no load test behavior set — it will skip the consume and continue (auto-resume default) during load tests."**
- ☐ The banner does NOT block running
- ☐ Click **Run Workflow** (1 iteration) → the workflow completes successfully

---

### KR-03: Produce + Consume Workflow Load Test (auto-resume)

**Goal:** Run a multi-iteration workflow load test with kafkaProduce and kafkaConsume nodes in auto-resume mode.

**Steps:**

1. Go to **Harness** → **Workflow Runner** tab
2. Select workflow **"Runner — Auto-Resume Load"** (kafkaProduce → kafkaConsume with `auto-resume`)
3. Set **Iterations: 5**, **Concurrency: 2**
4. Click **▶ Run Workflow**
5. Wait for all 5 iterations to complete

**Expected Results:**

- ☐ All 5 iterations complete without error
- ☐ Progress bar shows 5/5
- ☐ Live metrics update during execution (TPS, avg response time)
- ☐ Each iteration's kafkaProduce sends a real message to `runner.load.test`
- ☐ Each iteration's kafkaConsume auto-resumes (does NOT block waiting for a real message)

**Kafka Studio Verification:**

6. Go to **Protocols** → **Kafka** → **Consume** tab
7. Set topic to `runner.load.test`, Start Position = **Earliest**, Max Messages = **10**
8. Click **Consume Once**
9. ☐ Verify 5 messages were produced (one per iteration)

---

### KR-04: Synthetic-Inject Load Test

**Goal:** Verify that a `kafkaConsume` node with `synthetic-inject` mode injects a mock payload during load tests.

**Steps:**

1. Go to **Harness** → **Workflow Runner** tab
2. Select workflow **"Runner — Synthetic Inject Load"** (kafkaProduce → kafkaConsume with `synthetic-inject`)
3. Set **Iterations: 3**, **Concurrency: 1**
4. Click **▶ Run Workflow**

**Expected Results:**

- ☐ All 3 iterations complete without error
- ☐ kafkaProduce nodes send real messages
- ☐ kafkaConsume nodes inject synthetic payload (no broker call during consume)
- ☐ Console panel shows synthetic-inject log entries (if opened)

---

### KR-05: Deterministic Replay (3× Same Config)

**Goal:** Run the same workflow load test 3 times and verify consistent completion counts.

**Steps:**

1. Select workflow **"Runner — Auto-Resume Load"**
2. Set **Iterations: 5**, **Concurrency: 2**
3. Run 3 times in a row (wait for each to complete)

**Expected Results:**

- ☐ All 3 runs complete with 5/5 iterations
- ☐ No stale consume state leak (each run starts fresh)
- ☐ Results page shows 3 separate test runs

---

### KR-06: kafkaOperations Threading Under Concurrency

**Goal:** Verify that `kafkaOperations` is correctly threaded to all concurrent iterations in a workflow load test.

**Steps:**

1. Select workflow **"Runner — Auto-Resume Load"**
2. Set **Iterations: 10**, **Concurrency: 5**
3. Click **▶ Run Workflow**

**Expected Results:**

- ☐ All 10 iterations complete (no "kafkaOperations undefined" errors)
- ☐ No console errors about missing Kafka operations
- ☐ TPS metric shows parallel execution (> 1 req/s)

---

## Part 2: Results Rendering

### KR-07: PRODUCE / CONSUME Status Badges

**Goal:** After a workflow run with Kafka nodes, verify that results display PRODUCE/CONSUME status instead of HTTP status codes.

**Steps:**

1. First run the **Scenario 01 — Produce + Consume** workflow (from `kafka-workflow-scenario-01-produce-consume.json`)
   - Go to **Workflow** → select **Scenario 01** → click **Quick Test**
   - Wait for completion
2. Go to **Results** (left activity bar)
3. Open the latest test run

**Expected Results:**

- ☐ In the results table, kafkaProduce steps show **PRODUCE** in the status column (not a numeric HTTP status)
- ☐ kafkaConsume steps show **CONSUME** in the status column
- ☐ The method badge shows **KAFKA** with the appropriate CSS class (`method-kafka`)
- ☐ Response time is displayed for each step

---

### KR-08: Kafka Results Detail Drill-Down

**Goal:** Drill into a Kafka result entry and verify the message payload is shown.

**Steps:**

1. From the results table (KR-07), click on a kafkaProduce result row

**Expected Results:**

- ☐ Detail panel opens showing the produced message body
- ☐ Response body contains the JSON payload that was sent
- ☐ No HTTP status code is shown (or status area shows PRODUCE)

2. Click on a kafkaConsume result row

**Expected Results:**

- ☐ Detail panel shows the consumed message body
- ☐ Response headers include Kafka headers (e.g., `x-correlation-id`)

---

### KR-09: Mixed HTTP + Kafka Results Grouping

**Goal:** Verify that workflows with both HTTP and Kafka nodes render correctly in results.

**Steps:**

1. Run workflow **Scenario 02 — Trigger + HTTP + Produce** (from `kafka-workflow-scenario-02-trigger-http-produce.json`)
   - This workflow has: kafkaTrigger → HTTP → kafkaProduce
2. Go to **Results** → open the run

**Expected Results:**

- ☐ HTTP node results show numeric HTTP status (e.g., 200)
- ☐ Kafka node results show PRODUCE/CONSUME labels
- ☐ Both types appear in the same results table without rendering errors
- ☐ Error rate calculation does not miscount Kafka successes as HTTP failures

---

### KR-10: Results Dashboard Metrics for Kafka Run

**Goal:** Verify that the results dashboard correctly aggregates metrics from a Kafka workflow run.

**Steps:**

1. After running a multi-iteration workflow load test (KR-03 or KR-06)
2. Go to **Results** → open the completed run

**Expected Results:**

- ☐ Dashboard shows throughput (TPS) metric
- ☐ Average response time is calculated across all iterations
- ☐ Error rate is 0% for successful runs
- ☐ Total requests count matches expected (iterations × nodes per iteration)

---

## Part 3: Results Publishing — Phase 8

### KR-11: Publish Run Summary to Kafka Topic

**Goal:** Enable results publishing and verify that a run summary is published to Kafka after a workflow run completes.

**Setup — Enable Publishing:**

Results publishing is currently configured programmatically (no UI toggle yet). To enable it:

1. Open browser DevTools → Console tab
2. Run this JavaScript to set the publish config:

```javascript
// Enable Kafka results publishing for Workflow Runner
const key = 'perf-test-runner-config:_workflow_runner';
const config = JSON.parse(localStorage.getItem(key) || '{}');
config.kafkaResultsPublish = {
  enabled: true,
  clusterId: 'local-plaintext',
  topic: 'runner.results.summary'
};
localStorage.setItem(key, JSON.stringify(config));
console.log('Results publishing enabled:', config.kafkaResultsPublish);
```

3. Refresh the page to pick up the config change

**Steps:**

4. Go to **Harness** → **Workflow Runner** tab
5. Select **Scenario 01 — Produce + Consume** workflow
6. Set **Iterations: 1**
7. Click **▶ Run Workflow** → wait for completion

**Kafka Studio Verification:**

8. Go to **Protocols** → **Kafka** → **Consume** tab
9. Set topic to `runner.results.summary`, Start Position = **Earliest**, Max Messages = **5**
10. Click **Consume Once**

**Expected Results:**

- ☐ At least 1 message was published to `runner.results.summary`
- ☐ Click the message to open the detail pane
- ☐ Message key matches the `runId` from the Results page
- ☐ Message body is valid JSON

---

### KR-12: Verify Envelope Schema (v1.0)

**Goal:** Verify the published envelope matches the `KafkaRunSummaryEnvelope` schema.

**Steps:**

1. From KR-11, examine the consumed message body

**Expected Results — Envelope Fields:**

- ☐ `schemaVersion` = `"1.0"`
- ☐ `runId` — UUID string matching the test run ID
- ☐ `timestamp` — Unix timestamp (milliseconds)
- ☐ `executionMode` — e.g., `"workflow"`
- ☐ `summary` object contains:
  - ☐ `tps` — number (throughput)
  - ☐ `avgResponseTime` — number (milliseconds)
  - ☐ `p95ResponseTime` — number
  - ☐ `p99ResponseTime` — number
  - ☐ `errorRate` — number (0 for clean run)
  - ☐ `totalRequests` — number
  - ☐ `successfulRequests` — number
  - ☐ `failedRequests` — number (0 for clean run)
  - ☐ `totalDurationMs` — number
- ☐ `workflowName` — name of the executed workflow

**rpk Verification (alternative):**

```bash
docker exec redfireforge-redpanda rpk topic consume runner.results.summary \
  --offset start --num 1 --brokers localhost:9092
```

---

### KR-13: Publishing Disabled — No Message

**Goal:** When publishing is disabled, no message should be sent after a run.

**Setup:**

1. Disable publishing via DevTools Console:

```javascript
const key = 'perf-test-runner-config:_workflow_runner';
const config = JSON.parse(localStorage.getItem(key) || '{}');
config.kafkaResultsPublish = { enabled: false, clusterId: 'local-plaintext', topic: 'runner.results.summary' };
localStorage.setItem(key, JSON.stringify(config));
console.log('Publishing disabled');
```

2. Refresh the page

**Steps:**

3. Note the current message count on `runner.results.summary` using Kafka Studio Consume
4. Run any workflow (1 iteration)
5. Consume from `runner.results.summary` again

**Expected Results:**

- ☐ Message count is the same as before the run (no new messages)
- ☐ The test run still saved normally to Results
- ☐ No console errors about publishing

---

### KR-14: Publish Failure Non-Blocking

**Goal:** When the Kafka broker is unavailable at publish time, the run still completes and saves normally.

**Setup:**

1. Re-enable publishing (KR-11 setup)
2. Note the topic that publishing targets (`runner.results.summary`)

**Steps:**

3. Open DevTools Console to watch for publish warnings
4. Temporarily reconfigure publishing to target an invalid cluster:

```javascript
const key = 'perf-test-runner-config:_workflow_runner';
const config = JSON.parse(localStorage.getItem(key) || '{}');
config.kafkaResultsPublish = { enabled: true, clusterId: 'nonexistent-cluster', topic: 'runner.results.summary' };
localStorage.setItem(key, JSON.stringify(config));
```

5. Refresh → Run any workflow → wait for completion

**Expected Results:**

- ☐ The workflow run **completes normally** and is saved to Results
- ☐ Console shows a warning: `[RedfireForge] Kafka results publish failed`
- ☐ The run is NOT lost due to the publish failure
- ☐ No uncaught promise rejection in console

**Cleanup:**

6. Reset publishing config (KR-11 setup or disable)

---

### KR-15: Publish Fires on All 3 Save Paths

**Goal:** Verify that results publishing triggers regardless of which save path is used.

**Steps:**

This scenario verifies that publishing fires at all three `saveTestRun` call sites:

1. **Standard completion path:** Run a workflow normally (1 iteration) → verify publish
2. **Abort path:** Start a multi-iteration run (10 iterations) → click **Stop** mid-run → verify publish still fires for completed portion
3. **Quota-override path:** (Advanced) Fill storage quota to trigger force-save → verify publish

**Expected Results:**

- ☐ Standard completion: message published to `runner.results.summary`
- ☐ Abort path: message published with partial results
- ☐ Console shows successful publish for each path

---

## Part 4: Harness Kafka Scenarios — Phase 6

### KR-16: Import Kafka Harness JSON — Renders Kafka Badge

**Goal:** Import a feature group containing Kafka harness scenarios and verify they render correctly in the runner.

**Steps:**

1. Go to **Harness** → **Feature Groups** tab
2. Click **Import** (↑ icon)
3. Import `docs/test-data/runner/kafka-harness-feature-group.json`
4. Go to **Harness** → **Test Runner** tab
5. Expand the imported feature group

**Expected Results:**

- ☐ Kafka scenarios appear in the scenario list
- ☐ Method column shows **KAFKA** badge (not GET/POST)
- ☐ Scenario names indicate produce/consume action type
- ☐ HTTP scenarios in the same group render normally with HTTP method badges

---

### KR-17: Migration Safety — HTTP-Only Import

**Goal:** Import a pre-Kafka era feature group (no `actionType` field) and verify no schema breakage.

**Steps:**

1. Import any existing HTTP-only feature group JSON (e.g., from the sample exports)
2. Open the scenarios in the Test Editor
3. Run a scenario

**Expected Results:**

- ☐ No import errors or warnings
- ☐ Scenarios without `actionType` are treated as `http` (via `normalizeGroupActionTypes`)
- ☐ Running the HTTP scenario works normally
- ☐ Re-exporting the feature group preserves all fields

---

### KR-18: Backward-Compatible Load — No actionType

**Goal:** Verify that scenarios loaded from storage without `actionType` work correctly.

**Steps:**

1. Load any saved feature group that predates the Kafka feature
2. Open Test Runner → select a scenario
3. Run it

**Expected Results:**

- ☐ No type errors or rendering issues
- ☐ HTTP scenarios execute normally
- ☐ Result status column shows numeric HTTP status (not PRODUCE/CONSUME)
- ☐ Method badge shows the actual HTTP method (GET, POST, etc.)

---

## Part 5: Transport-Aware Outcomes & Export

### KR-19: Kafka Outcomes — Transport-Aware Semantics

**Goal:** Verify that Kafka run results use transport-aware error classification.

**Steps:**

1. Run a workflow with Kafka nodes (e.g., Scenario 01)
2. All nodes succeed → go to Results

**Expected Results:**

- ☐ Error rate shows 0% (Kafka successes not misclassified as HTTP failures)
- ☐ `httpStatus: 200` on produce results does NOT show as "200 OK" in status column — shows "PRODUCE" instead
- ☐ Live progress during execution does not increment `failedRequests` for Kafka operations that return `httpStatus: 0` transiently

---

### KR-20: Export Mixed-Suite Results

**Goal:** Export results containing both HTTP and Kafka entries and verify metadata preservation.

**Steps:**

1. Run workflow **Scenario 02** (HTTP + Kafka mixed)
2. Go to Results → open the run
3. Export results as JSON

**Expected Results:**

- ☐ Exported JSON includes `transportType` field on each result
- ☐ Kafka results have `kafkaResultMeta` with topic/partition/offset
- ☐ HTTP results have standard `httpStatus` field
- ☐ Total counts in summary are consistent between UI and export

---

## Appendix A: Test Data Files

### Workflow JSONs for Runner Scenarios

Create these files in `docs/test-data/runner/`:

| File | Description | Used By |
|---|---|---|
| `kafka-runner-load-policy-block.json` | Workflow with `kafkaConsume` in `wait-for-real` mode | KR-01 |
| `kafka-runner-load-policy-info.json` | Workflow with `kafkaConsume` without `loadTestBehavior` | KR-02 |
| `kafka-runner-auto-resume-load.json` | Workflow with `kafkaProduce` → `kafkaConsume` (auto-resume) | KR-03, KR-05, KR-06 |
| `kafka-runner-synthetic-inject-load.json` | Workflow with `kafkaProduce` → `kafkaConsume` (synthetic-inject) | KR-04 |
| `kafka-harness-feature-group.json` | Feature group with Kafka harness scenarios | KR-16 |

### Kafka Cluster Import

Use the existing cluster import file:

```bash
# Already configured in docs/test-data/kafka-clusters-import.json
# Contains: local-plaintext, local-secure, local-tls, local-schema-registry
```

---

## Appendix B: Docker Cleanup

```bash
# Delete runner test topics
docker exec redfireforge-redpanda rpk topic delete \
  runner.kafka.produce \
  runner.kafka.consume \
  runner.kafka.mixed \
  runner.results.summary \
  runner.load.test \
  --brokers localhost:9092
```
