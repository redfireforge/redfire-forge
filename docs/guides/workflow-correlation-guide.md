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

### Quick Test Mode

In Quick Test, CorrelationWait uses mock payload:

1. Configure mock payload in node
2. Run Quick Test
3. Node immediately continues with mock data

### Manual Testing

Test real correlation:

1. Run workflow (pauses at CorrelationWait)
2. In another terminal:
   ```bash
   curl -X POST http://localhost:3001/api/correlations/resume \
     -H "Content-Type: application/json" \
     -d '{"correlationKey": "ORD-001", "payload": {...}}'
   ```
3. Workflow resumes

### Load Testing

For performance testing with CorrelationWait:

```yaml
Workflow Runner Settings:
  Correlation Mode: Mock
  
  # All CorrelationWait nodes use their mock payloads
  # No actual waiting, enables high throughput testing
```

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
