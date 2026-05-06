# Workflow Triggers Guide

Configure triggers to start workflows automatically — webhooks, schedules, and event-based activation.

## Overview

**Workflow Triggers** define how workflows are started:

| Trigger Type | Activation |
|--------------|------------|
| **Manual** | Click "Run" in UI or CLI |
| **Webhook** | HTTP request to an endpoint |
| **Schedule** | Cron-based time schedule |

## Manual Triggers

### From UI

1. Open workflow
2. Click **Quick Test** or **Run in Harness**

### From CLI

```bash
redfireforge workflow run workflow.yaml
```

### From API

```bash
curl -X POST http://localhost:3001/api/workflows/run \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "wf-123", "variables": {"userId": "456"}}'
```

## Webhook Triggers

### What is a Webhook Trigger?

A webhook trigger creates an HTTP endpoint that starts the workflow when called:

```
External System → POST /webhooks/order-created → Workflow Starts
```

### Creating a Webhook Trigger

1. Open workflow
2. Replace Start node with **Webhook Trigger** node
3. Configure:
   - Path: `/webhooks/my-workflow`
   - Method: `POST` (or GET, etc.)
   - Extractions: Variables from request

### Webhook Configuration

```
┌─────────────────────────────────────────────────────────┐
│ Webhook Trigger: Order Webhook                          │
├─────────────────────────────────────────────────────────┤
│ Endpoint: /webhooks/orders                              │
│ Method: POST                                            │
│                                                         │
│ Extractions:                                            │
│ ┌────────────────┬──────────────┬─────────────────────┐ │
│ │ Variable       │ Source       │ Expression          │ │
│ ├────────────────┼──────────────┼─────────────────────┤ │
│ │ orderId        │ body         │ $.order.id          │ │
│ │ customerId     │ body         │ $.customer.id       │ │
│ │ webhookId      │ header       │ X-Webhook-ID        │ │
│ └────────────────┴──────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Available Variables

In webhook-triggered workflows:

| Variable | Content |
|----------|---------|
| `{{$webhook.body}}` | Full request body |
| `{{$webhook.headers}}` | All request headers |
| `{{$webhook.query}}` | Query parameters |
| `{{$webhook.method}}` | HTTP method |
| `{{$webhook.path}}` | Request path |

Plus extracted variables.

### Webhook URL

Once configured, the webhook is available at:

```
http://localhost:3001/webhooks/orders
```

In production, this would be your server URL.

### Testing Webhooks

Send a test request:

```bash
curl -X POST http://localhost:3001/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Webhook-ID: test-123" \
  -d '{
    "order": {"id": "ord-456"},
    "customer": {"id": "cust-789"}
  }'
```

### Webhook Response

The workflow can send a response back to the caller:

```yaml
Webhook Trigger:
  Response Mode: Sync
  Timeout: 30s
```

| Mode | Behavior |
|------|----------|
| **Async** | Immediate 202 Accepted, workflow runs in background |
| **Sync** | Wait for workflow completion, return result |

### Webhook Security

Secure your webhooks:

#### Signature Verification

```yaml
Webhook Trigger:
  Security:
    Type: Signature
    Header: X-Webhook-Signature
    Secret: {{WEBHOOK_SECRET}}
    Algorithm: HMAC-SHA256
```

#### API Key

```yaml
Webhook Trigger:
  Security:
    Type: API Key
    Header: X-API-Key
    Expected: {{API_KEY}}
```

## Schedule Triggers

### What is a Schedule Trigger?

Run workflows automatically on a schedule:

```
Every day at 9 AM → Workflow Starts
```

### Creating a Schedule Trigger

1. Open workflow
2. Add **Schedule Trigger** node
3. Configure cron expression

### Cron Expression Format

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sun=0)
│ │ │ │ │
* * * * *
```

### Common Schedules

| Cron | Description |
|------|-------------|
| `0 * * * *` | Every hour at :00 |
| `*/15 * * * *` | Every 15 minutes |
| `0 9 * * *` | Daily at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `0 0 1 * *` | First day of month at midnight |

### Timezone

Set the timezone for schedule evaluation:

```yaml
Schedule Trigger:
  Cron: "0 9 * * *"
  Timezone: "America/New_York"
```

### Schedule Variables

Available in scheduled workflows:

| Variable | Content |
|----------|---------|
| `{{$triggerTime}}` | ISO timestamp of trigger |
| `{{$triggerTimestamp}}` | Unix timestamp |

### Enabling/Disabling Schedules

Toggle schedules without deleting:

```yaml
Schedule Trigger:
  Enabled: false  ← Temporarily disabled
  Cron: "0 9 * * *"
```

## Event-Based Triggers

### CorrelationWait Pattern

Start workflows in response to async events:

```
[Main Workflow]
     │
     ├─── [Create Order] ───► orderId
     │
     ├─── [CorrelationWait] ──── Wait for payment callback
     │         │
     │    [Payment System] ───► Sends callback with orderId
     │         │
     └─── [Continue Processing]
```

### How Correlation Works

1. Workflow pauses at CorrelationWait
2. External system sends event with correlation key
3. Matching workflow resumes

```yaml
CorrelationWait:
  Correlation Key: {{orderId}}
  Timeout: 300s
```

### Triggering Correlation Events

Send event to resume workflow:

```bash
curl -X POST http://localhost:3001/api/correlations/resume \
  -H "Content-Type: application/json" \
  -d '{
    "correlationKey": "ord-456",
    "payload": {"status": "paid", "amount": 99.99}
  }'
```

## Multiple Triggers

### Combining Triggers

Workflows can have multiple entry points:

```
[Webhook Trigger] ──┐
                    │
[Schedule Trigger] ─┼──► [Shared Logic] → [End]
                    │
[Manual Start] ─────┘
```

### Conditional Logic by Trigger

Detect trigger type in workflow:

```yaml
Condition:
  Left: {{$triggerType}}
  Operator: equals
  Right: "webhook"
```

## Production Considerations

### Webhook Reliability

For production webhooks:

1. **Acknowledge quickly**: Return 2xx within seconds
2. **Process async**: Use async mode for long workflows
3. **Implement retry handling**: Idempotency keys
4. **Log all requests**: For debugging

### Schedule Reliability

For scheduled workflows:

1. **Handle missed runs**: What if server was down?
2. **Prevent overlap**: Don't start if previous is still running
3. **Monitor execution**: Alert on failures

### Scaling Webhooks

High-volume webhooks:

1. **Use a queue**: Buffer incoming requests
2. **Rate limit**: Prevent overload
3. **Horizontal scale**: Multiple workers

## Testing Triggers

### Testing Webhooks

1. Use **Quick Test** with mock request
2. Or use curl/Postman to send real requests
3. Check workflow executed correctly

### Testing Schedules

1. Use **Run Now** to trigger immediately
2. Or temporarily set to `* * * * *` (every minute)
3. Verify execution, then restore schedule

### Mock Payloads

For Quick Test, provide mock webhook data:

```yaml
Webhook Trigger:
  Mock Payload:
    order:
      id: "test-order-123"
      amount: 99.99
    customer:
      id: "test-customer-456"
```

## Tips & Best Practices

### 1. Use Meaningful Paths

```
✓ /webhooks/orders/created
✓ /webhooks/users/registered
✗ /webhooks/hook1
```

### 2. Always Validate Input

Add conditions after webhook to validate data:

```yaml
Condition: Validate Payload
  Left: {{orderId}}
  Operator: exists
```

### 3. Return Appropriate Status

```
200 OK - Processed successfully
202 Accepted - Processing started (async)
400 Bad Request - Invalid payload
401 Unauthorized - Auth failed
```

### 4. Secure Production Webhooks

Always use signature verification or API keys in production.

### 5. Log Trigger Events

Track all trigger activations for debugging and audit.

## Related Guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Building workflows
- [Workflow Nodes Reference](./workflow-nodes-reference.md) — CorrelationWait details
- [CLI Reference](./cli-reference.md) — Running workflows from CLI
