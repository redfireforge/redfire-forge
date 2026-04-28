# Correlation Wait Node — User Guide

The **Correlation Wait** node pauses a workflow execution and waits for an external system to send a webhook callback before resuming. This is the fundamental building block for asynchronous, event-driven workflows.

---

## When to Use

Use a Correlation Wait node when your workflow needs to:

- **Wait for a payment gateway** to confirm a charge
- **Wait for manager approval** via an external approval system
- **Wait for a CI/CD build** to complete
- **Wait for any async external process** that will send a callback when done

## How It Works

```
1. Workflow reaches CorrelationWait node
2. Node evaluates the Correlation ID Expression (e.g., "{{paymentId}}")
3. Workflow PAUSES — node shows amber "⏸ PAUSED" indicator
4. External system sends POST to /webhooks/callback/<your-path>
5. Server matches the incoming webhook to the paused workflow by correlation ID
6. Workflow RESUMES — extracted variables are injected into context
7. Execution continues to the next node
```

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Label** | Yes | Display name for the node |
| **Correlation ID Expression** | Yes | Expression that resolves to a unique ID for matching (e.g., `{{paymentId}}`) |
| **Webhook Path** | Yes | The path the external system will POST to (e.g., `/webhooks/callback/payment`) |
| **Correlation Source** | Yes | Where to find the correlation ID in incoming webhooks: `body`, `header`, or `query` |
| **Correlation JSONPath** | If source=body | JSONPath to extract the correlation ID from the webhook body (e.g., `$.paymentId`) |
| **Header Name** | If source=header | HTTP header name containing the correlation ID (e.g., `X-Correlation-ID`) |
| **Query Parameter** | If source=query | Query parameter name (e.g., `buildId` for `?buildId=xxx`) |
| **Extract Variables** | No | Variables to extract from the webhook payload into workflow context |
| **Timeout** | Yes | How long to wait before failing. Supports ms, seconds, or minutes. 0 = unlimited |
| **Webhook Filter** | No | Expression to filter incoming webhooks (e.g., `{{webhook.type}} == payment`) |

## Correlation Sources

### Body (JSONPath)

The most common source. The external system includes the correlation ID in the JSON body.

**Config:**
- Correlation Source: `body`
- Correlation JSONPath: `$.paymentId`

**Expected webhook:**
```json
POST /webhooks/callback/payment
{
  "paymentId": "pay_123",
  "status": "approved",
  "transactionId": "txn_456"
}
```

### Header

The correlation ID is sent as an HTTP header. Useful when integrating with systems that use standard correlation headers.

**Config:**
- Correlation Source: `header`
- Header Name: `X-Correlation-ID`

**Expected webhook:**
```
POST /webhooks/callback/approval
X-Correlation-ID: REQ-2024-0042

{ "decision": "approved", "comment": "Looks good" }
```

### Query Parameter

The correlation ID is in the URL query string. Useful for simple callback URLs.

**Config:**
- Correlation Source: `query`
- Query Parameter: `buildId`

**Expected webhook:**
```
POST /webhooks/callback/build-complete?buildId=build_789

{ "status": "success", "artifactUrl": "https://..." }
```

## Extract Variables

Extract fields from the webhook payload into workflow variables for use in subsequent nodes.

| Variable Name | JSONPath | Example Value |
|---------------|----------|---------------|
| `paymentStatus` | `$.status` | `"approved"` |
| `transactionId` | `$.transactionId` | `"txn_456"` |
| `processedAt` | `$.processedAt` | `"2024-01-15T10:30:00Z"` |

Extracted variables are available as `{{paymentStatus}}`, `{{transactionId}}`, etc. in all subsequent nodes.

## Webhook Filter Expressions

Filter incoming webhooks to only accept specific types. The filter is evaluated before resuming the workflow.

### Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `==` | `{{webhook.type}} == payment` | Equality |
| `!=` | `{{webhook.status}} != pending` | Inequality |
| `contains` | `{{webhook.message}} contains success` | Substring match |
| `exists` | `{{webhook.paymentId}} exists` | Field existence |
| `>`, `<`, `>=`, `<=` | `{{webhook.amount}} > 100` | Numeric comparison |
| `&&` | `{{type}} == payment && {{status}} == success` | AND |
| `\|\|` | `{{type}} == payment \|\| {{type}} == refund` | OR |

### Examples

```
# Only accept "payment" type webhooks
{{webhook.type}} == payment

# Accept approved payments over $100
{{webhook.status}} == approved && {{webhook.amount}} > 100

# Accept either payment or refund events
{{webhook.type}} == payment || {{webhook.type}} == refund

# Only accept webhooks where a transaction ID exists
{{webhook.transactionId}} exists
```

## Timeout Behavior

- If timeout is reached, the node **fails** and the workflow reports an error
- Timeout is in milliseconds (e.g., `300000` = 5 minutes)
- Common timeouts:
  - Payment callback: 5 minutes (`300000`)
  - Human approval: 72 hours (`259200000`)
  - CI/CD build: 30 minutes (`1800000`)
  - No timeout: `0` (wait forever)

## Test Webhook

The config modal includes a **Test Webhook** section that lets you:

1. See a pre-generated sample webhook payload based on your configuration
2. Edit the payload
3. Send it to the server to test the webhook callback flow

This is useful for testing without needing the actual external system.

## Paused Workflow Visibility

When a workflow is paused at a CorrelationWait node:

- The canvas node shows an **amber border** and **⏸ PAUSED** badge
- The **Execution History** panel has a "Paused" filter tab showing:
  - Correlation ID
  - Time elapsed since pause
  - Timeout countdown
  - "Resume Manually" button for testing

## Security (Production)

When `WEBHOOK_SECURITY_ENABLED=true`:

- Webhook URLs can be signed with HMAC-SHA256 tokens
- Incoming webhooks are validated against request signatures
- IP whitelist restricts which IPs can send callbacks
- See [API Reference](./CORRELATION_WAIT_API.md) for details

## Common Patterns

### Pattern 1: Submit → Wait → Process

The simplest pattern. Submit a request, wait for callback, process the result.

```
Start → HTTP (submit) → CorrelationWait → HTTP (process result) → End
```

See: [easy-payment-callback-workflow.yaml](../../examples/easy-payment-callback-workflow.yaml)

### Pattern 2: Submit → Wait → Branch

Wait for callback, then route based on the result.

```
Start → HTTP (submit) → CorrelationWait → Switch/Condition → [Branch A | Branch B] → End
```

See: [medium-approval-workflow.yaml](../../examples/medium-approval-workflow.yaml)

### Pattern 3: Parallel Waits (Fork/Join)

Wait for multiple async callbacks in parallel.

```
Start → Fork → [CorrelationWait A | CorrelationWait B] → Join → Process → End
```

See: [hard-parallel-payment-workflow.yaml](../../examples/hard-parallel-payment-workflow.yaml)

---

## Troubleshooting

### Webhook not matching

**Symptom:** Webhook returns 404 "No matching paused workflow found"

**Check:**
1. Is the webhook path exactly right? (e.g., `/webhooks/callback/payment`)
2. Does the correlation ID in the webhook body/header/query match what the workflow sent?
3. Has the workflow timed out? Check the Execution History paused tab
4. Is the correlation source configured correctly? (body vs header vs query)

### Workflow stuck in PAUSED state

**Symptom:** Node shows amber "⏸ PAUSED" but never resumes

**Check:**
1. Has the external system actually sent the callback?
2. Check the "Unmatched Webhooks" log (`GET /api/correlations/unmatched`)
3. Use the "Resume Manually" button in Execution History to test
4. Verify the webhook filter isn't rejecting the incoming payload

### Timeout too short

**Symptom:** Workflow fails before the callback arrives

**Fix:** Increase the timeout value. For human-driven processes, use hours or days (e.g., `259200000` for 72h).

### Duplicate webhook handling

**Symptom:** External system sends the same webhook twice

**Behavior:** The first webhook resumes the workflow. The second returns the cached response (idempotency). No duplicate execution.

### Extract variables empty

**Symptom:** Variables extracted from webhook are empty

**Check:**
1. Verify the JSONPath matches the actual webhook payload structure
2. Use the Test Webhook feature to inspect the payload
3. Check for nested paths (e.g., `$.data.status` not `$.status`)
