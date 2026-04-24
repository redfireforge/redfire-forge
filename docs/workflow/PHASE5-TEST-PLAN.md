# Phase 5: Webhook & Schedule Runtime - Test Plan

> **Comprehensive Testing Guide for feature/webhook-schedule-triggers branch**
> 
> Date: April 23, 2026  
> Status: Ready for Testing after Tasks #3-5 Complete

---

## 📋 Test Environment Setup

### Prerequisites

```bash
# 1. Install all dependencies
npm install

# 2. Build server
npm run build:server

# 3. Verify no TypeScript errors
npx tsc --noEmit

# 4. Run unit tests
npm run test

# 5. Run E2E tests
npm run test:e2e
```

### Test Data Preparation

```bash
# 1. Create test workflow directory
mkdir -p ~/Library/Application\ Support/redfireforge/workflows/

# 2. Clear old execution data (optional)
rm -rf ~/Library/Application\ Support/redfireforge/executions/
rm -rf ~/Library/Application\ Support/redfireforge/webhook-deliveries/

# 3. Clear trigger configurations (optional)
rm -f ~/Library/Application\ Support/redfireforge/triggers/webhook-triggers.json
rm -f ~/Library/Application\ Support/redfireforge/triggers/schedule-triggers.json
```

### Test Servers

```bash
# Terminal 1: Start webhook server
npm run server

# Terminal 2: Start UI dev server
npm run dev

# Verify both servers
curl http://localhost:3001/health  # Should return JSON
curl http://localhost:5173         # Should return HTML
```

---

## 🧪 Test Scenarios

---

## **Category 1: Server Foundation (Phase 5.1)**

### **Test 1.1: Server Startup**

**Objective:** Verify webhook server starts correctly

**Steps:**
1. Run `npm run server`
2. Observe console output

**Expected Results:**
- ✅ ASCII banner displays with box drawing characters
- ✅ Port 3001 shown in banner
- ✅ Health check URL displayed: `http://127.0.0.1:3001/health`
- ✅ Webhook format displayed: `POST http://127.0.0.1:3001/webhooks/{workflowId}/{triggerId}`
- ✅ "Cron scheduler initialized" message appears
- ✅ No error messages
- ✅ Server responds within 1 second

**Pass Criteria:** All checkpoints met

---

### **Test 1.2: Health Check Endpoint**

**Objective:** Verify health endpoint returns correct data

**Steps:**
```bash
curl http://localhost:3001/health
```

**Expected Results:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-23T...",
  "port": 3001
}
```
- ✅ HTTP 200 status code
- ✅ Valid JSON response
- ✅ Timestamp is ISO 8601 format
- ✅ Port is 3001

**Pass Criteria:** Response matches expected format

---

### **Test 1.3: Server Graceful Shutdown**

**Objective:** Verify server shuts down cleanly

**Steps:**
1. Start server: `npm run server`
2. Press `Ctrl+C`
3. Observe shutdown logs

**Expected Results:**
- ✅ "Received SIGINT, shutting down gracefully..." message
- ✅ "Stopping cron scheduler..." message
- ✅ "Server closed" message
- ✅ Process exits with code 0
- ✅ No orphaned processes (check with `lsof -i :3001`)

**Pass Criteria:** Clean shutdown with no errors

---

### **Test 1.4: Port Already in Use**

**Objective:** Verify error handling when port is occupied

**Steps:**
1. Start first server: `npm run server`
2. In another terminal, start second server: `npm run server`

**Expected Results:**
- ✅ Second server shows error: "EADDRINUSE" or "Port 3001 is already in use"
- ✅ First server continues running
- ✅ Error message is clear and actionable

**Pass Criteria:** Proper error handling displayed

---

### **Test 1.5: CORS Headers**

**Objective:** Verify CORS is enabled for UI access

**Steps:**
```bash
curl -I http://localhost:3001/health \
  -H "Origin: http://localhost:5173"
```

**Expected Results:**
- ✅ `Access-Control-Allow-Origin: *` header present
- ✅ `Access-Control-Allow-Methods` header includes GET, POST, PUT, PATCH, DELETE
- ✅ `Access-Control-Allow-Headers` includes Content-Type

**Pass Criteria:** All CORS headers present

---

## **Category 2: File Storage (Phase 5.1)**

### **Test 2.1: AppData Path Resolution**

**Objective:** Verify correct platform-specific paths

**Platform: macOS**
```bash
# Check directory exists after server start
ls -la ~/Library/Application\ Support/redfireforge/
```

**Expected Results:**
- ✅ Directory exists at `~/Library/Application Support/redfireforge/`
- ✅ Subdirectories created: workflows/, triggers/, executions/, webhook-deliveries/
- ✅ Correct permissions (user read/write)

**Platform: Windows (PowerShell)**
```powershell
ls "$env:APPDATA\redfireforge"
```
Expected: Directory at `%APPDATA%\redfireforge\`

**Platform: Linux**
```bash
ls -la ~/.local/share/redfireforge/
```
Expected: Directory at `~/.local/share/redfireforge/`

**Pass Criteria:** Correct paths for all platforms

---

### **Test 2.2: Workflow File Loading**

**Objective:** Verify workflows can be loaded from JSON

**Steps:**
1. Create test workflow in UI
2. Save workflow
3. Check file exists:
```bash
ls ~/Library/Application\ Support/redfireforge/workflows/
cat ~/Library/Application\ Support/redfireforge/workflows/{workflow-id}.json
```

**Expected Results:**
- ✅ JSON file exists with workflow ID as filename
- ✅ Valid JSON format
- ✅ Contains workflow metadata (id, name, nodes, edges)
- ✅ File size is reasonable (< 1MB for typical workflow)

**Pass Criteria:** File exists and contains valid workflow data

---

### **Test 2.3: Execution Result Storage**

**Objective:** Verify execution results are saved correctly

**Steps:**
1. Trigger a webhook execution (see Test 3.1)
2. Check execution file:
```bash
ls ~/Library/Application\ Support/redfireforge/executions/$(date +%Y-%m-%d)/
cat ~/Library/Application\ Support/redfireforge/executions/$(date +%Y-%m-%d)/{execution-id}.json
```

**Expected Results:**
- ✅ File saved in dated folder (YYYY-MM-DD)
- ✅ Valid JSON with execution data
- ✅ Contains: id, workflowId, triggerId, triggerType, status, duration, results, variables, timestamp
- ✅ Results array contains step details (url, statusCode, responseTime, body)

**Pass Criteria:** Execution data persisted correctly

---

### **Test 2.4: Webhook Delivery Logging**

**Objective:** Verify webhook deliveries are logged to JSONL

**Steps:**
1. Trigger webhook (see Test 3.1)
2. Check log file:
```bash
cat ~/Library/Application\ Support/redfireforge/webhook-deliveries/$(date +%Y-%m-%d).jsonl
```

**Expected Results:**
- ✅ File is JSONL format (one JSON object per line)
- ✅ Each line contains: triggerId, method, payload, status, duration, timestamp
- ✅ Multiple deliveries append to same file
- ✅ No corrupted JSON lines

**Pass Criteria:** JSONL format with valid delivery records

---

## **Category 3: Webhook Triggers (Phase 5.2)**

### **Test 3.1: Basic Webhook Execution**

**Objective:** Verify webhook triggers workflow correctly

**Prerequisites:**
1. Create workflow with webhook trigger node
2. Configure webhook trigger: POST method, path `/api/orders/incoming`
3. Add HTTP request node
4. Save workflow (note workflow ID)

**Steps:**
```bash
curl --noproxy "*" -X POST \
  http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_NODE_ID} \
  -H "Content-Type: application/json" \
  -d '{"orderId": "12345", "customerId": "C001", "amount": 99.99}'
```

**Expected Results:**
- ✅ HTTP 200 response
- ✅ JSON response contains: `executionId`, `status: "success"`, `duration`, `steps`
- ✅ Server logs show: "[Webhook] Received request", "Workflow execution completed"
- ✅ Execution saved to AppData/executions/
- ✅ Delivery logged to webhook-deliveries/

**Pass Criteria:** Workflow executes successfully

---

### **Test 3.2: Variable Extraction - Body Fields**

**Objective:** Verify JSONPath extraction from request body

**Prerequisites:**
1. Create workflow with webhook trigger
2. Configure extract variables:
   - `orderId` → `$.orderId`
   - `customerId` → `$.customerId`
   - `amount` → `$.amount`
3. Add HTTP node that uses these variables in URL or body

**Steps:**
```bash
curl --noproxy "*" -X POST \
  http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID} \
  -H "Content-Type: application/json" \
  -d '{"orderId": "TEST-001", "customerId": "CUST-999", "amount": 250.50}'
```

**Expected Results:**
- ✅ Response includes `variables` object with extracted values
- ✅ `variables.orderId === "TEST-001"`
- ✅ `variables.customerId === "CUST-999"`
- ✅ `variables.amount === 250.50`
- ✅ Variables used correctly in subsequent HTTP steps

**Pass Criteria:** All variables extracted and used correctly

---

### **Test 3.3: Variable Extraction - Explicit Paths**

**Objective:** Verify extraction from headers and query params

**Prerequisites:**
1. Configure extract variables:
   - `userId` → `$.headers.x-user-id`
   - `apiKey` → `$.headers.authorization`
   - `source` → `$.query.source`

**Steps:**
```bash
curl --noproxy "*" -X POST \
  "http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID}?source=mobile" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -H "Authorization: Bearer token-xyz" \
  -d '{"data": "test"}'
```

**Expected Results:**
- ✅ `variables.userId === "user-123"`
- ✅ `variables.apiKey === "Bearer token-xyz"`
- ✅ `variables.source === "mobile"`

**Pass Criteria:** Headers and query params extracted correctly

---

### **Test 3.4: HTTP Method Validation**

**Objective:** Verify webhook respects configured HTTP method

**Prerequisites:**
1. Create webhook trigger with POST method only

**Steps:**
```bash
# Try GET (should fail)
curl --noproxy "*" -X GET \
  http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID}

# Try POST (should succeed)
curl --noproxy "*" -X POST \
  http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID} \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Results:**
- ✅ GET returns 404 with error: "Trigger not found or method mismatch"
- ✅ POST returns 200 with execution result

**Pass Criteria:** Method validation working

---

### **Test 3.5: Invalid Workflow/Trigger ID**

**Objective:** Verify error handling for non-existent IDs

**Steps:**
```bash
curl --noproxy "*" -X POST \
  http://127.0.0.1:3001/webhooks/invalid-workflow/invalid-trigger \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Results:**
- ✅ HTTP 404 status code
- ✅ JSON error response: `{"error": "Workflow not found: invalid-workflow"}`

**Pass Criteria:** Proper 404 error handling

---

### **Test 3.6: Large Payload Handling**

**Objective:** Verify server handles large JSON payloads

**Steps:**
```bash
# Generate 5MB payload
node -e "console.log(JSON.stringify({data: 'x'.repeat(5000000)}))" > large-payload.json

curl --noproxy "*" -X POST \
  http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID} \
  -H "Content-Type: application/json" \
  -d @large-payload.json
```

**Expected Results:**
- ✅ Request succeeds (within 10mb limit)
- ✅ No server crash or memory leak
- ✅ Response time < 5 seconds

**Pass Criteria:** Large payloads handled gracefully

---

### **Test 3.7: Concurrent Webhook Requests**

**Objective:** Verify server handles multiple simultaneous requests

**Steps:**
```bash
# Send 10 concurrent requests
for i in {1..10}; do
  curl --noproxy "*" -X POST \
    http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID} \
    -H "Content-Type: application/json" \
    -d "{\"requestId\": \"$i\"}" &
done
wait
```

**Expected Results:**
- ✅ All 10 requests return 200
- ✅ All 10 executions saved to AppData
- ✅ No race conditions or data corruption
- ✅ Server remains responsive

**Pass Criteria:** Concurrent execution works correctly

---

## **Category 4: Schedule Triggers (Phase 5.2)**

### **Test 4.1: Schedule Registration**

**Objective:** Verify schedules load and register at startup

**Prerequisites:**
1. Create workflow with schedule trigger node
2. Configure schedule: `* * * * *` (every minute), timezone: `America/New_York`
3. Save workflow

**Steps:**
1. Stop server if running
2. Start server: `npm run server`
3. Observe logs

**Expected Results:**
- ✅ Log shows: "Loading schedule triggers..."
- ✅ Log shows: "Registered schedule: {trigger-id} - Cron: * * * * * - Timezone: America/New_York"
- ✅ No registration errors

**Pass Criteria:** Schedule registers successfully

---

### **Test 4.2: Schedule Execution - Every Minute**

**Objective:** Verify scheduled workflow executes at correct time

**Prerequisites:**
1. Create schedule trigger: `* * * * *` (every minute)
2. Add HTTP request node that calls `https://jsonplaceholder.typicode.com/posts/1`

**Steps:**
1. Start server
2. Wait and observe logs for 2-3 minutes

**Expected Results:**
- ✅ Log shows execution every minute: "[Schedule] Executing trigger: {id}"
- ✅ Log shows: "Execution completed - Duration: {X}ms"
- ✅ Execution files created in AppData/executions/ for each run
- ✅ Timing is consistent (within 1-2 seconds of expected time)

**Pass Criteria:** Executes every minute consistently

---

### **Test 4.3: Automatic Time Variables**

**Objective:** Verify automatic variables are injected correctly

**Prerequisites:**
1. Create schedule trigger
2. Add HTTP POST node that sends automatic variables in body:
```json
{
  "time": "{{triggerTime}}",
  "timestamp": "{{triggerTimestamp}}",
  "date": "{{triggerDate}}",
  "hour": "{{triggerHour}}",
  "minute": "{{triggerMinute}}"
}
```

**Steps:**
1. Wait for schedule to execute
2. Check execution result file

**Expected Results:**
- ✅ `triggerTime` is ISO timestamp: "2026-04-23T14:30:00.000Z"
- ✅ `triggerTimestamp` is Unix milliseconds: 1745414400000
- ✅ `triggerDate` is YYYY-MM-DD: "2026-04-23"
- ✅ `triggerHour` is HH: "14"
- ✅ `triggerMinute` is MM: "30"

**Pass Criteria:** All automatic variables populated correctly

---

### **Test 4.4: Timezone Support**

**Objective:** Verify timezone-aware scheduling

**Prerequisites:**
1. Create schedule: `0 9 * * *` (9 AM daily)
2. Set timezone: `America/New_York` (EST/EDT)
3. Set timezone: `Asia/Tokyo` (JST)

**Steps:**
1. Register both schedules
2. Check when they execute (may need to adjust system time or wait)

**Expected Results:**
- ✅ America/New_York schedule executes at 9 AM Eastern Time
- ✅ Asia/Tokyo schedule executes at 9 AM Japan Time
- ✅ UTC offsets calculated correctly

**Pass Criteria:** Schedules respect timezone settings

---

### **Test 4.5: Schedule with Input Variables**

**Objective:** Verify custom input variables are passed to workflow

**Prerequisites:**
1. Create schedule trigger
2. Define input variables:
   - `reportType` → "daily"
   - `lookbackDays` → "7"
3. Use these variables in HTTP request URL or body

**Steps:**
1. Wait for schedule execution
2. Check execution result

**Expected Results:**
- ✅ Input variables present in execution results
- ✅ Variables used correctly in HTTP requests
- ✅ Both input variables AND automatic variables available

**Pass Criteria:** Input variables work alongside automatic variables

---

### **Test 4.6: Disabled Schedule**

**Objective:** Verify disabled schedules don't execute

**Prerequisites:**
1. Create schedule trigger
2. Set `enabled: false` in triggers/schedule-triggers.json

**Steps:**
1. Restart server
2. Wait past scheduled time

**Expected Results:**
- ✅ Schedule not registered (not in startup logs)
- ✅ No executions created
- ✅ No errors in logs

**Pass Criteria:** Disabled schedules are skipped

---

### **Test 4.7: Invalid Cron Expression**

**Objective:** Verify error handling for invalid cron syntax

**Prerequisites:**
1. Manually edit schedule-triggers.json
2. Set invalid cron: `"invalid cron syntax"`

**Steps:**
1. Restart server
2. Observe logs

**Expected Results:**
- ✅ Error logged: "Failed to register schedule {id}: Invalid cron expression"
- ✅ Server continues running (doesn't crash)
- ✅ Other valid schedules still register

**Pass Criteria:** Invalid cron handled gracefully

---

## **Category 5: UI Integration (Phase 5.3)**

### **Test 5.1: Webhook URL Display**

**Objective:** Verify webhook URL shows in node config

**Steps:**
1. Open UI: http://localhost:5173
2. Navigate to Workflow tab
3. Create new workflow
4. Add webhook trigger node
5. Double-click webhook node to configure

**Expected Results:**
- ✅ Configuration modal opens
- ✅ "🔗 Webhook URL" section visible
- ✅ URL format: `http://127.0.0.1:3001/webhooks/{workflowId}/{nodeId}`
- ✅ URL is read-only (cannot edit)
- ✅ "Copy" button present
- ✅ Tip message: "Server must be running on port 3001"

**Pass Criteria:** Webhook URL displayed correctly

---

### **Test 5.2: Copy Webhook URL**

**Objective:** Verify copy button works

**Steps:**
1. Open webhook node config
2. Click "Copy" button
3. Paste into text editor or terminal

**Expected Results:**
- ✅ Button text changes to "✓ Copied!" for 2 seconds
- ✅ URL copied to clipboard
- ✅ Pasted URL matches displayed URL
- ✅ Button returns to "Copy" after 2 seconds

**Pass Criteria:** Copy functionality works

---

### **Test 5.3: Execution History Navigation**

**Objective:** Verify execution history is accessible

**Steps:**
1. Open UI: http://localhost:5173
2. Click "Workflow" in left sidebar
3. Check top navigation tabs

**Expected Results:**
- ✅ Tabs visible: Feature Groups | Test Runner | Results | Workflow | 📊 Execution History
- ✅ "📊 Execution History" tab present
- ✅ Clicking tab switches to execution history view
- ✅ Left sidebar still shows workflow list

**Pass Criteria:** Navigation works correctly

---

### **Test 5.4: Execution History - Empty State**

**Objective:** Verify empty state when no executions exist

**Steps:**
1. Clear all executions:
```bash
rm -rf ~/Library/Application\ Support/redfireforge/executions/
```
2. Navigate to Execution History tab

**Expected Results:**
- ✅ Empty state message: "📊 No executions found"
- ✅ Helpful text: "Trigger a webhook or wait for a schedule to see executions here"
- ✅ No errors or crashes
- ✅ "Refresh" button visible and functional

**Pass Criteria:** Empty state displayed properly

---

### **Test 5.5: Execution History - List View**

**Objective:** Verify execution list displays correctly

**Prerequisites:**
1. Trigger 5+ webhook executions
2. Wait for 2+ schedule executions

**Steps:**
1. Navigate to Execution History tab
2. Observe execution list

**Expected Results:**
- ✅ All executions listed in reverse chronological order (newest first)
- ✅ Each card shows:
  - Trigger icon (🪝 for webhook, ⏰ for schedule)
  - Workflow ID
  - Timestamp (formatted)
  - Status badge (SUCCESS/FAILED/ERROR with appropriate color)
  - Duration, step count, variable count
- ✅ List scrolls if many executions

**Pass Criteria:** Execution list renders correctly

---

### **Test 5.6: Execution History - Filtering**

**Objective:** Verify filter dropdown works

**Steps:**
1. Navigate to Execution History tab
2. Change filter from "All Types" to "🪝 Webhooks"
3. Change to "⏰ Schedules"
4. Change back to "All Types"

**Expected Results:**
- ✅ "🪝 Webhooks" shows only webhook executions
- ✅ "⏰ Schedules" shows only schedule executions
- ✅ "All Types" shows all executions
- ✅ Count updates correctly: "X executions (Y total)"
- ✅ No flickering or loading issues

**Pass Criteria:** Filtering works correctly

---

### **Test 5.7: Execution History - Detail View**

**Objective:** Verify execution details display correctly

**Steps:**
1. Click on an execution in the list
2. Review detail panel

**Expected Results:**
- ✅ Detail panel opens on right side
- ✅ **Info Section** shows:
  - Execution ID (truncated, full in tooltip)
  - Workflow ID
  - Trigger type
  - Status (colored)
  - Duration (ms)
  - Timestamp
- ✅ **Variables Section** shows:
  - JSON formatted variables
  - Syntax highlighted
  - Scrollable if many variables
- ✅ **Results Section** shows:
  - Each HTTP step as a card
  - URL, status code, response time
  - Status code colored (green for 2xx, red for errors)
  - "Response Body" collapsible section
- ✅ **Error Section** shows if execution failed
- ✅ Close button (✕) closes detail panel

**Pass Criteria:** All execution details visible and formatted correctly

---

### **Test 5.8: Execution History - Refresh**

**Objective:** Verify refresh button updates list

**Steps:**
1. View execution history
2. Trigger new webhook in terminal
3. Click "🔄 Refresh" button

**Expected Results:**
- ✅ New execution appears at top of list
- ✅ Count updates
- ✅ No full page reload
- ✅ Selected execution stays selected (if still in filtered list)

**Pass Criteria:** Refresh works without full reload

---

### **Test 5.9: Execution History - Server Offline**

**Objective:** Verify error handling when server is not running

**Steps:**
1. Stop webhook server
2. Navigate to Execution History tab

**Expected Results:**
- ✅ Error message displayed: "❌ Error Loading Executions"
- ✅ Error details: connection refused or similar
- ✅ Helpful text: "Make sure the webhook server is running: npm run server"
- ✅ "Retry" button visible
- ✅ Clicking "Retry" re-attempts fetch

**Pass Criteria:** Error state handled gracefully

---

### **Test 5.10: Execution History - API Error Handling**

**Objective:** Verify handling of malformed API responses

**Steps:**
1. Temporarily break API (e.g., return invalid JSON)
2. Navigate to Execution History tab

**Expected Results:**
- ✅ Error state displayed
- ✅ Error message indicates parsing failure
- ✅ "Retry" button works
- ✅ No React component crashes

**Pass Criteria:** API errors don't crash UI

---

## **Category 6: Workflow Integration**

### **Test 6.1: End-to-End Webhook Workflow**

**Objective:** Verify complete webhook → execution → results flow

**Steps:**
1. Create workflow in UI:
   - Webhook trigger (POST /api/orders)
   - Extract variables: orderId, customerId
   - Condition: Check if orderId starts with "URGENT"
   - HTTP: POST to https://jsonplaceholder.typicode.com/posts
   - End node
2. Save workflow
3. Copy webhook URL from config
4. Trigger webhook:
```bash
curl --noproxy "*" -X POST {WEBHOOK_URL} \
  -H "Content-Type: application/json" \
  -d '{"orderId": "URGENT-123", "customerId": "C999"}'
```
5. Check Execution History in UI

**Expected Results:**
- ✅ Webhook returns 200 with execution ID
- ✅ Execution appears in UI within 5 seconds
- ✅ All workflow steps show in results
- ✅ Variables extracted correctly
- ✅ Condition evaluated correctly
- ✅ HTTP request succeeded (200 OK)

**Pass Criteria:** Complete flow works end-to-end

---

### **Test 6.2: End-to-End Schedule Workflow**

**Objective:** Verify complete schedule → execution → results flow

**Steps:**
1. Create workflow in UI:
   - Schedule trigger (every minute)
   - Input variables: reportType=daily
   - HTTP: GET https://jsonplaceholder.typicode.com/posts
   - Delay: 1000ms
   - HTTP: POST result to https://jsonplaceholder.typicode.com/posts
   - End node
2. Save workflow
3. Wait for schedule to execute
4. Check Execution History in UI

**Expected Results:**
- ✅ Execution appears automatically when schedule fires
- ✅ Automatic time variables populated
- ✅ Input variables available
- ✅ All steps executed in order
- ✅ Delay respected (visible in timestamps)

**Pass Criteria:** Schedule workflow completes successfully

---

### **Test 6.3: Fork-Join with Webhook**

**Objective:** Verify parallel execution in webhook-triggered workflow

**Steps:**
1. Create workflow:
   - Webhook trigger
   - Fork node (parallel execution)
   - Branch A: HTTP GET posts
   - Branch B: HTTP GET users
   - Join node
   - HTTP: POST combined results
   - End node
2. Trigger webhook

**Expected Results:**
- ✅ Fork node triggers both branches
- ✅ Branch A and B execute in parallel (overlapping timestamps)
- ✅ Join node waits for both branches
- ✅ Combined results passed to final HTTP step
- ✅ Total duration < sum of individual durations (proving parallelism)

**Pass Criteria:** Parallel execution works correctly

---

### **Test 6.4: Error Handling in Workflow**

**Objective:** Verify error propagation and status reporting

**Steps:**
1. Create workflow:
   - Webhook trigger
   - HTTP: GET https://httpstat.us/500 (simulates error)
   - End node
2. Trigger webhook

**Expected Results:**
- ✅ Webhook returns 200 (webhook itself succeeded)
- ✅ Execution status: "failed" or "error"
- ✅ Error details captured in execution result
- ✅ Execution appears in UI with ERROR badge
- ✅ Error message visible in detail view

**Pass Criteria:** Errors handled and reported correctly

---

### **Test 6.5: Sample Workflows**

**Objective:** Verify sample workflows work with triggers

**Steps:**
1. Navigate to Workflow tab
2. Click "Browse Samples"
3. Load "🪝 Webhook Trigger" sample
4. Click "Use as Template"
5. Save workflow
6. Copy webhook URL and trigger it

**Expected Results:**
- ✅ Sample loads correctly
- ✅ All nodes properly configured
- ✅ Webhook URL displays
- ✅ Triggering webhook executes workflow
- ✅ Execution succeeds with realistic test data

**Pass Criteria:** Sample workflow works out-of-the-box

---

## **Category 7: Cross-Platform Testing**

### **Test 7.1: macOS Compatibility**

**Platform:** macOS 11+ (Intel or Apple Silicon)

**Steps:**
1. Install dependencies: `npm install`
2. Start servers: `npm run server` and `npm run dev`
3. Run all Category 1-6 tests

**Expected Results:**
- ✅ All tests pass
- ✅ AppData at `~/Library/Application Support/redfireforge/`
- ✅ File permissions correct (user read/write)
- ✅ No permission errors

**Pass Criteria:** All features work on macOS

---

### **Test 7.2: Windows Compatibility**

**Platform:** Windows 10/11

**Steps:**
1. Install dependencies: `npm install`
2. Start servers in PowerShell or CMD
3. Run all Category 1-6 tests (adjust curl commands for PowerShell)

**Expected Results:**
- ✅ All tests pass
- ✅ AppData at `%APPDATA%\redfireforge\`
- ✅ Backslash paths work correctly
- ✅ No path separator issues

**Pass Criteria:** All features work on Windows

---

### **Test 7.3: Linux Compatibility**

**Platform:** Ubuntu 20.04+ or equivalent

**Steps:**
1. Install dependencies: `npm install`
2. Start servers: `npm run server` and `npm run dev`
3. Run all Category 1-6 tests

**Expected Results:**
- ✅ All tests pass
- ✅ AppData at `~/.local/share/redfireforge/`
- ✅ GTK dependencies satisfied
- ✅ No permission errors

**Pass Criteria:** All features work on Linux

---

## **Category 8: Performance & Stress Testing**

### **Test 8.1: High-Frequency Webhooks**

**Objective:** Verify server handles burst traffic

**Steps:**
```bash
# Send 100 requests as fast as possible
for i in {1..100}; do
  curl --noproxy "*" -X POST \
    http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID} \
    -H "Content-Type: application/json" \
    -d "{\"id\": \"$i\"}" &
done
wait
```

**Expected Results:**
- ✅ All 100 requests succeed
- ✅ No dropped requests
- ✅ Server memory usage stays reasonable (< 500MB)
- ✅ Response times remain consistent
- ✅ No file corruption in AppData

**Pass Criteria:** Server handles 100 concurrent requests

---

### **Test 8.2: Long-Running Workflow**

**Objective:** Verify workflow with many steps completes

**Steps:**
1. Create workflow with 20+ HTTP request nodes
2. Trigger via webhook

**Expected Results:**
- ✅ All 20+ steps execute
- ✅ Execution completes (doesn't timeout)
- ✅ All results saved correctly
- ✅ Memory doesn't leak

**Pass Criteria:** Complex workflows execute successfully

---

### **Test 8.3: Schedule Accuracy Over Time**

**Objective:** Verify schedule maintains accuracy over extended period

**Steps:**
1. Create schedule: every minute
2. Let run for 1 hour (60 executions)
3. Analyze execution timestamps

**Expected Results:**
- ✅ 60 executions created (±1 tolerance)
- ✅ Average timing error < 2 seconds
- ✅ No drift over time
- ✅ Execution times consistent

**Pass Criteria:** Schedules remain accurate over time

---

### **Test 8.4: Execution History with 1000+ Records**

**Objective:** Verify UI performance with many executions

**Steps:**
1. Generate 1000+ executions (script or leave schedule running)
2. Open Execution History tab
3. Test filtering, scrolling, selecting

**Expected Results:**
- ✅ Initial load < 3 seconds
- ✅ Filtering instant (< 100ms)
- ✅ Scrolling smooth (no jank)
- ✅ Selecting execution < 200ms
- ✅ No memory leaks in browser

**Pass Criteria:** UI remains performant with large datasets

---

## **Category 9: Edge Cases & Error Scenarios**

### **Test 9.1: Missing Workflow File**

**Objective:** Verify handling of deleted workflow file

**Steps:**
1. Trigger webhook for workflow
2. Delete workflow file
3. Trigger webhook again

**Expected Results:**
- ✅ HTTP 404 with error: "Workflow not found"
- ✅ No server crash
- ✅ Error logged appropriately

**Pass Criteria:** Missing file handled gracefully

---

### **Test 9.2: Corrupted JSON File**

**Objective:** Verify handling of malformed workflow file

**Steps:**
1. Manually corrupt workflow JSON file
2. Trigger webhook

**Expected Results:**
- ✅ HTTP 500 with JSON parse error
- ✅ Server continues running
- ✅ Error logged with details

**Pass Criteria:** Corrupted file doesn't crash server

---

### **Test 9.3: Network Errors in Workflow**

**Objective:** Verify handling of network failures

**Steps:**
1. Create workflow with HTTP to unreachable host
2. Trigger workflow

**Expected Results:**
- ✅ Execution completes with failed status
- ✅ Network error captured in results
- ✅ Subsequent steps skipped appropriately
- ✅ Error visible in UI

**Pass Criteria:** Network errors handled gracefully

---

### **Test 9.4: Variable Resolution Failure**

**Objective:** Verify handling of missing variables

**Steps:**
1. Create workflow using variable `{{missingVar}}`
2. Trigger workflow without providing variable

**Expected Results:**
- ✅ Variable resolves to empty string or error placeholder
- ✅ Workflow continues (doesn't crash)
- ✅ Error logged or reported

**Pass Criteria:** Missing variables don't break execution

---

### **Test 9.5: Circular Workflow Detection**

**Objective:** Verify protection against infinite loops

**Steps:**
1. Create workflow with cycle (if possible)
2. Trigger workflow

**Expected Results:**
- ✅ Execution doesn't hang indefinitely
- ✅ Timeout or max iterations limit applied
- ✅ Error reported

**Pass Criteria:** Infinite loops prevented

---

## **Category 10: Security Testing**

### **Test 10.1: Localhost-Only Access**

**Objective:** Verify server only listens on localhost

**Steps:**
```bash
# Check listening address
lsof -i :3001 | grep LISTEN

# Try accessing from another machine (should fail)
curl http://{YOUR_IP}:3001/health
```

**Expected Results:**
- ✅ Server bound to 127.0.0.1 only
- ✅ External access fails (connection refused)

**Pass Criteria:** Server only accessible locally

---

### **Test 10.2: Payload Size Limit**

**Objective:** Verify protection against oversized payloads

**Steps:**
```bash
# Generate 15MB payload (exceeds 10MB limit)
node -e "console.log(JSON.stringify({data: 'x'.repeat(15000000)}))" > huge-payload.json

curl --noproxy "*" -X POST \
  http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID} \
  -H "Content-Type: application/json" \
  -d @huge-payload.json
```

**Expected Results:**
- ✅ HTTP 413 (Payload Too Large) or similar
- ✅ Server doesn't crash
- ✅ Error message indicates size limit

**Pass Criteria:** Oversized payloads rejected

---

### **Test 10.3: Malformed JSON Handling**

**Objective:** Verify handling of invalid JSON

**Steps:**
```bash
curl --noproxy "*" -X POST \
  http://127.0.0.1:3001/webhooks/{WORKFLOW_ID}/{TRIGGER_ID} \
  -H "Content-Type: application/json" \
  -d 'this is not valid JSON'
```

**Expected Results:**
- ✅ HTTP 400 (Bad Request)
- ✅ Error message: "Invalid JSON"
- ✅ No server crash

**Pass Criteria:** Invalid JSON rejected cleanly

---

### **Test 10.4: SQL Injection Attempt**

**Objective:** Verify no SQL injection vulnerabilities (file-based storage)

**Steps:**
```bash
curl --noproxy "*" -X POST \
  "http://127.0.0.1:3001/webhooks/'; DROP TABLE users; --/trigger-id" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Results:**
- ✅ No database operations (file-based)
- ✅ Invalid ID rejected (404)
- ✅ No file system manipulation

**Pass Criteria:** Injection attempts have no effect

---

### **Test 10.5: Path Traversal Attempt**

**Objective:** Verify protection against path traversal

**Steps:**
```bash
curl --noproxy "*" -X POST \
  "http://127.0.0.1:3001/webhooks/../../etc/passwd/trigger-id" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Results:**
- ✅ Path normalized or rejected
- ✅ No access to files outside AppData
- ✅ 404 or 400 error

**Pass Criteria:** Path traversal prevented

---

## **Category 11: Regression Testing**

### **Test 11.1: Existing Manual Workflow Execution**

**Objective:** Verify manual workflow execution still works

**Steps:**
1. Create workflow WITHOUT trigger (start node only)
2. Click "Run" button in UI
3. Observe execution

**Expected Results:**
- ✅ Manual execution works as before
- ✅ Results displayed in UI
- ✅ No interference from trigger system

**Pass Criteria:** Manual workflows unaffected by trigger feature

---

### **Test 11.2: Unit Tests**

**Objective:** Verify all existing tests pass

**Steps:**
```bash
npm run test
```

**Expected Results:**
- ✅ All 1565+ unit tests pass
- ✅ No new failures introduced
- ✅ Test coverage maintained (>90%)

**Pass Criteria:** 0 test failures

---

### **Test 11.3: E2E Tests**

**Objective:** Verify end-to-end tests pass

**Steps:**
```bash
npm run test:e2e
```

**Expected Results:**
- ✅ All 90+ E2E tests pass
- ✅ Workflow trigger tests pass (20 tests)
- ✅ No flaky tests

**Pass Criteria:** 0 E2E failures

---

### **Test 11.4: TypeScript Compilation**

**Objective:** Verify no type errors

**Steps:**
```bash
npx tsc --noEmit
```

**Expected Results:**
- ✅ 0 TypeScript errors
- ✅ Clean compilation

**Pass Criteria:** Clean TypeScript build

---

## **Category 12: Documentation Verification**

### **Test 12.1: README Accuracy**

**Objective:** Verify README instructions work

**Steps:**
1. Follow quick start instructions
2. Follow build instructions

**Expected Results:**
- ✅ All commands work as documented
- ✅ No missing steps
- ✅ Cross-platform instructions accurate

**Pass Criteria:** Documentation matches implementation

---

### **Test 12.2: Example Files**

**Objective:** Verify example workflows work

**Steps:**
1. Load examples/webhook-trigger-workflow.yaml
2. Load examples/schedule-trigger-workflow.yaml
3. Execute both

**Expected Results:**
- ✅ Examples load without errors
- ✅ All nodes configured correctly
- ✅ Executions succeed

**Pass Criteria:** Example files are valid and working

---

### **Test 12.3: API Documentation**

**Objective:** Verify API docs match implementation

**Steps:**
1. Review docs/workflow/phase5.2-webhook-scheduler-testing.md
2. Test all documented endpoints and features

**Expected Results:**
- ✅ All documented endpoints exist
- ✅ Request/response formats match docs
- ✅ No undocumented breaking changes

**Pass Criteria:** Documentation is accurate

---

## 📊 Test Results Template

Use this template to record test results:

```markdown
## Test Execution Report

**Date:** YYYY-MM-DD  
**Tester:** [Your Name]  
**Branch:** feature/webhook-schedule-triggers  
**Commit:** [commit hash]  
**Platform:** macOS / Windows / Linux

### Summary

- **Total Tests:** 70+
- **Passed:** ___
- **Failed:** ___
- **Blocked:** ___
- **Skipped:** ___

### Failed Tests

| Test ID | Test Name | Failure Reason | Severity |
|---------|-----------|----------------|----------|
| 3.2 | Variable Extraction | Variables not extracted | HIGH |
| ... | ... | ... | ... |

### Blockers

- [ ] Issue #1: [Description]
- [ ] Issue #2: [Description]

### Notes

[Additional observations, performance notes, etc.]

### Sign-off

- [ ] All HIGH severity bugs fixed
- [ ] All tests pass on primary platform
- [ ] Cross-platform testing complete
- [ ] Documentation verified
- [ ] Ready for merge to develop

**Tester Signature:** _______________  
**Date:** _______________
```

---

## ✅ Acceptance Criteria

Before merging to `develop`, verify:

- [ ] All Category 1-6 tests pass (core functionality)
- [ ] At least 2 platforms tested (preferably all 3)
- [ ] No HIGH severity bugs
- [ ] Unit tests: 0 failures
- [ ] E2E tests: 0 failures
- [ ] TypeScript compilation: 0 errors
- [ ] Documentation reviewed and accurate
- [ ] Performance acceptable (no major regressions)
- [ ] Cross-platform compatibility verified

---

## 🚀 Next Steps After Testing

1. **Fix any bugs found during testing**
2. **Update documentation with test findings**
3. **Create GitHub Issues for future enhancements**
4. **Merge to develop branch** (following git-branching.mdc rules)
5. **Plan Phase 5.4:** Tauri integration (auto-start server)

---

## 📝 Notes

- **Test Environment:** Use separate machine or VM if possible
- **Data Cleanup:** Clear AppData between test runs for consistency
- **Logging:** Enable verbose logging during tests
- **Screenshots:** Capture UI screenshots for documentation
- **Performance Metrics:** Record execution times and memory usage

**Good luck with testing! 🎉**
