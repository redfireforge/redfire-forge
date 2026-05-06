# Workflow Correlation Guide

Handle async patterns with CorrelationWait — pause workflows until external events arrive, matched by correlation keys.

## Overview

**CorrelationWait** enables async workflow patterns:

```
[Create Order] → [CorrelationWait] → [Process Payment]
                        ↑
                   External payment
                   callback arrives
```

## What is Correlation?

### The Problem

Many real-world flows are async:
1. Start a process (e.g., create order)
2. Wait for external event (e.g., payment callback)
3. Continue processing

Without correlation, you can't connect the callback to the right workflow instance.

### The Solution

CorrelationWait nodes:
1. Pause workflow execution
2. Wait for matching event (by correlation key)
3. Resume with event payload

## CorrelationWait Node

### Configuration

```
┌─────────────────────────────────────────────────────────┐
│ CorrelationWait: Wait for Payment                       │
├─────────────────────────────────────────────────────────┤
│ Correlation Key: [{{orderId}}______________]            │
│                                                         │
│ Timeout: [300___] seconds                               │
│                                                         │
│ On Timeout:                                             │
│   ○ Fail workflow                                       │
│   ● Continue with default payload                       │
│   ○ Retry N times                                       │
│                                                         │
│ Mock Payload (for testing):                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ {                                                   │ │
│ │   "status": "completed",                            │ │
│ │   "transactionId": "txn_mock123"                    │ │
│ │ }                                                   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Correlation Key

The key that matches incoming events to waiting workflows:

```
Workflow Instance 1: orderId = "ORD-001" → waits for key "ORD-001"
Workflow Instance 2: orderId = "ORD-002" → waits for key "ORD-002"

Event arrives: key = "ORD-001"
→ Workflow Instance 1 resumes
→ Workflow Instance 2 keeps waiting
```

### Timeout Handling

| Option | Behavior |
|--------|----------|
| **Fail workflow** | Mark as failed, end execution |
| **Continue with default** | Use mock payload, continue |
| **Retry** | Re-enter wait state |

## Sending Correlation Events

### Via API

Send event to resume waiting workflow:

```bash
POST http://localhost:3001/api/correlations/resume
Content-Type: application/json

{
  "correlationKey": "ORD-001",
  "payload": {
    "status": "completed",
    "transactionId": "txn_abc123",
    "amount": 99.99
  }
}
```

### Via Webhook

Configure external system to call your webhook endpoint:

```
Payment Gateway → POST /webhooks/payments
                  Body: { orderId, status, ... }
                        ↓
                  Route to correlation API
                        ↓
                  Resume matching workflow
```

## Accessing Event Payload

After CorrelationWait, the event payload is available:

```
{{$correlation.payload.status}}
{{$correlation.payload.transactionId}}
{{$correlation.payload.amount}}
```

Or extract to variables:

```yaml
CorrelationWait:
  Extractions:
    - name: paymentStatus
      expression: $.status
    - name: transactionId
      expression: $.transactionId
```

## Common Patterns

### Payment Flow

```
[Create Order]
     ↓
  orderId = "ORD-123"
     ↓
[CorrelationWait: key={{orderId}}]
     ↓ (payment gateway calls back)
[Check Payment Status]
     ↓
[Condition: status == "completed"?]
   ├─ Yes → [Fulfill Order]
   └─ No → [Cancel Order]
```

### Approval Flow

```
[Submit Request]
     ↓
  requestId = "REQ-456"
     ↓
[Send Approval Email]
     ↓
[CorrelationWait: key={{requestId}}]
     ↓ (approver clicks link)
[Process Approval Decision]
```

### Third-Party Integration

```
[Call External API]
     ↓
  jobId = "JOB-789"
     ↓
[CorrelationWait: key={{jobId}}]
     ↓ (external system sends webhook on completion)
[Download Results]
```

## Testing with Correlation

### Quick Test vs Workflow Runner

| Feature | Quick Test | Workflow Runner |
|---------|------------|-----------------|
| **Purpose** | Debug single workflow runs | Load/performance testing |
| **CorrelationWait behavior** | Always waits for real webhooks | Respects Load Test Behavior setting |
| **Auto-Resume mode** | ❌ Not applied | ✅ Skips wait, injects mock payload |
| **Synthetic Inject mode** | ❌ Not applied | ✅ Waits configured delay, then injects |
| **Use case** | Verify workflow logic works | Test workflow under load |

### Quick Test Mode

**Important:** Quick Test always waits for real webhook callbacks, regardless of the Load Test Behavior setting. This is intentional — Quick Test is for debugging and verifying that your actual integration works.

To test in Quick Test:
1. Run workflow (pauses at CorrelationWait)
2. Send a real webhook callback (see Manual Testing below)
3. Workflow resumes with the real payload

### Workflow Runner (Load Testing)

For performance testing with CorrelationWait, configure the **CorrelationWait Behavior** in the **Workflow Runner** settings panel (not the node itself).

| Mode | Behavior |
|------|----------|
| **Auto-Resume (Skip Wait)** | Immediately inject mock payload and continue (default for load tests) |
| **Synthetic Inject (Delayed)** | Wait configured delay + jitter, then inject mock payload |
| **Wait for Real Webhook** | Same as Quick Test — waits for actual callback (not recommended for load tests) |

**To test with Auto-Resume:**
1. Go to **Workflow Runner** (not Quick Test)
2. Select the workflow that has CorrelationWait nodes
3. The "CorrelationWait Behavior" section appears automatically
4. Select "Auto-Resume (Skip Wait)" mode
5. Configure the **Mock Webhook Response**:
   - **Dynamic fields** (like `paymentStatus`) — enter the scenario you want to test (e.g., "completed", "failed")
   - **Mock Payload preview** — shows the complete JSON that will be injected
6. Configure iterations/concurrency and Run

**Example UI:**
```
Wait for Payment Callback

paymentStatus    [completed                    ]
💡 Change this value to test different scenarios

Mock Payload:
{
  "paymentId": "{{correlationId}}",
  "paymentStatus": "completed",
  "transactionId": "sample_transactionId"
}
```

**Important:** All transactions use the same mock response values. The `{{correlationId}}` placeholder is automatically replaced with the actual correlation ID at runtime.

**Why is this in the Runner, not the Node?**
This design separates workflow logic from test configuration. The same workflow can be tested with different behaviors without modifying the workflow definition. Quick Test always waits for real webhooks (for debugging), while Workflow Runner uses your configured behavior (for load testing).

### Manual Testing

Test real correlation flow:

1. Run workflow via Quick Test (pauses at CorrelationWait)
2. In another terminal:
   ```bash
   curl -X POST http://localhost:3001/api/correlations/resume \
     -H "Content-Type: application/json" \
     -d '{"correlationKey": "ORD-001", "payload": {...}}'
   ```
3. Workflow resumes with the provided payload

### Test Webhook Button

In the CorrelationWait configuration panel, there's a "Test Webhook" section:
- Configure a test payload
- Click "Send Test Webhook"
- If a workflow is paused at this node, it will resume

**Note:** This requires an active workflow paused at this node (started via Quick Test).

## Multiple Correlations

### Sequential Waits

Wait for multiple events in sequence:

```
[CorrelationWait: payment] → [CorrelationWait: shipping]
                                         ↑
                              Different keys for each
```

### Parallel Waits

Wait for multiple events in parallel:

```
        ┌── [CorrelationWait: approval-1]
[Fork] ─┼── [CorrelationWait: approval-2]
        └── [CorrelationWait: approval-3]
                      ↓
                   [Join] (all approved)
```

### Any-of Pattern

Continue when any event arrives:

```
[CorrelationWait: primary]
         │
         ├── Timeout (5s) → [Use fallback]
         │
         └── Event arrives → [Process normally]
```

## Error Handling

### Timeout Errors

```yaml
CorrelationWait:
  Timeout: 300s
  OnTimeout: fail
  
# If no event in 5 minutes, workflow fails
```

### Invalid Payload

Add validation after CorrelationWait:

```
[CorrelationWait]
     ↓
[Condition: payload.status exists?]
   ├─ Yes → [Continue]
   └─ No → [Handle Invalid Event]
```

### Duplicate Events

Same correlation key received twice:
- First event resumes workflow
- Second event is ignored (workflow already resumed)

## Correlation Store

### How It Works

```
1. Workflow pauses at CorrelationWait
   → Store: { key: "ORD-001", workflowId: "wf-123", nodeId: "n-456" }

2. Event arrives with key "ORD-001"
   → Lookup in store
   → Find waiting workflow
   → Resume with payload

3. Store entry removed after resume
```

### Store Persistence

- In-memory by default
- Survives page refresh (localStorage backup)
- Cleared on application restart

## Tips & Best Practices

### 1. Use Unique Correlation Keys

```
✓ "ORDER-{{orderId}}-{{timestamp}}"
✓ "{{$uuid}}"
✗ "payment" (not unique)
```

### 2. Set Reasonable Timeouts

```
Quick callback expected: 30s
Normal async flow: 300s (5 min)
Long-running process: 3600s (1 hour)
```

### 3. Always Have Mock Payloads

Enable testing without external systems:

```yaml
Mock Payload:
  status: "completed"
  transactionId: "mock-txn-123"
```

### 4. Log Correlation Events

Add logging for debugging:

```
[CorrelationWait]
     ↓
[SetVariable: log = "Received: {{$correlation.payload}}"]
```

### 5. Handle Edge Cases

- What if event arrives before workflow reaches wait?
- What if correlation key is wrong?
- What if payload is malformed?

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Workflow Nodes Reference](./workflow-nodes-reference.md) — All node types
- [Workflow Triggers Guide](./workflow-triggers-guide.md) — Triggers
