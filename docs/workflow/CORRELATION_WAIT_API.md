# Correlation Wait — API Reference

Server-side API endpoints for managing paused workflow correlations and processing webhook callbacks.

**Base URL:** `http://localhost:3001`

---

## Endpoints

### Register a Paused Correlation

```
POST /api/correlations/pause
```

Register a workflow as paused, waiting for a webhook callback.

**Request Body:**
```json
{
  "correlationId": "pay_123",
  "webhookPath": "/webhooks/callback/payment",
  "executionId": "exec-abc",
  "workflowId": "wf-1",
  "pausedNodeId": "cw-1",
  "timeoutMs": 300000,
  "correlationSource": "body",
  "correlationJsonPath": "$.paymentId",
  "webhookFilter": "{{webhook.type}} == payment"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `correlationId` | string | Yes | Unique ID to match against incoming webhooks |
| `webhookPath` | string | Yes | Webhook path to match (e.g., `/webhooks/callback/payment`) |
| `executionId` | string | Yes | Workflow execution ID |
| `workflowId` | string | No | Workflow definition ID |
| `pausedNodeId` | string | No | ID of the CorrelationWait node |
| `timeoutMs` | number | No | Timeout in milliseconds. 0 = no timeout |
| `correlationSource` | string | No | `body`, `header`, or `query`. Default: `body` |
| `correlationJsonPath` | string | No | JSONPath for body-based correlation |
| `correlationHeader` | string | No | Header name for header-based correlation |
| `correlationQueryParam` | string | No | Query param for query-based correlation |
| `webhookFilter` | string | No | Filter expression to validate incoming webhooks |

**Response (201):**
```json
{
  "paused": true,
  "correlationId": "pay_123",
  "timeoutAt": 1706097600000,
  "webhookToken": {
    "correlationId": "pay_123",
    "webhookPath": "/webhooks/callback/payment",
    "issuedAt": 1706097300000,
    "expiresAt": 1706183700000,
    "signature": "a1b2c3..."
  }
}
```

> `webhookToken` is only included when `WEBHOOK_SECURITY_ENABLED=true`.

**Error (409):**
```json
{
  "error": "Correlation ID \"pay_123\" is already paused"
}
```

---

### Resume a Paused Correlation (Direct)

```
POST /api/correlations/resume
```

Directly resume a paused workflow by its correlation ID. Used by the "Resume Manually" button and the Test Webhook feature.

**Request Body:**
```json
{
  "correlationId": "pay_123",
  "webhookData": {
    "status": "approved",
    "transactionId": "txn_456"
  }
}
```

**Response (200) — matched:**
```json
{
  "resumed": true,
  "correlationId": "pay_123",
  "executionId": "exec-abc",
  "workflowId": "wf-1",
  "webhookData": { "status": "approved", "transactionId": "txn_456" }
}
```

**Response (200) — no match:**
```json
{
  "resumed": false,
  "correlationId": "pay_123"
}
```

---

### List Paused Correlations

```
GET /api/correlations
```

Returns all currently paused workflow correlations.

**Response (200):**
```json
{
  "correlations": [
    {
      "correlationId": "pay_123",
      "webhookPath": "/webhooks/callback/payment",
      "executionId": "exec-abc",
      "workflowId": "wf-1",
      "pausedNodeId": "cw-1",
      "pausedAt": 1706097300000,
      "timeoutAt": 1706097600000,
      "correlationSource": "body",
      "correlationJsonPath": "$.paymentId"
    }
  ],
  "count": 1
}
```

---

### Cancel a Paused Correlation

```
DELETE /api/correlations/:correlationId
```

Cancel a paused workflow, removing it from the waiting list.

**Response (200):**
```json
{
  "cancelled": true,
  "correlationId": "pay_123"
}
```

**Error (404):**
```json
{
  "error": "Correlation \"pay_123\" not found"
}
```

---

### Webhook Callback (Generic)

```
POST /webhooks/callback/:path
GET  /webhooks/callback/:path
PUT  /webhooks/callback/:path
```

The primary endpoint that external systems call to resume paused workflows. Accepts any HTTP method.

**Example — Body-based correlation:**
```bash
curl -X POST http://localhost:3001/webhooks/callback/payment \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "pay_123",
    "status": "approved",
    "transactionId": "txn_456"
  }'
```

**Example — Header-based correlation:**
```bash
curl -X POST http://localhost:3001/webhooks/callback/approval \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: REQ-2024-0042" \
  -d '{
    "decision": "approved",
    "comment": "Looks good"
  }'
```

**Example — Query-based correlation:**
```bash
curl -X POST "http://localhost:3001/webhooks/callback/build-complete?buildId=build_789" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "artifactUrl": "https://artifacts.example.com/build_789.tar.gz"
  }'
```

**Response (200) — matched:**
```json
{
  "resumed": true,
  "correlationId": "pay_123",
  "executionId": "exec-abc",
  "workflowId": "wf-1",
  "webhookData": { "paymentId": "pay_123", "status": "approved" }
}
```

**Response (404) — no match:**
```json
{
  "resumed": false,
  "error": "No matching paused workflow found",
  "webhookPath": "/webhooks/callback/payment"
}
```

**Response (401) — security rejected (when enabled):**
```json
{
  "error": "Signature verification failed"
}
```

**Response (403) — IP blocked (when enabled):**
```json
{
  "error": "IP not allowed",
  "ip": "203.0.113.50"
}
```

**Response (422) — filter rejected:**
```json
{
  "resumed": false,
  "error": "Webhook filter rejected: type: \"refund\" != \"payment\"",
  "correlationId": "pay_123"
}
```

---

### Unmatched Webhook Log

```
GET /api/correlations/unmatched
```

Returns a log of webhook callbacks that did not match any paused workflow.

**Response (200):**
```json
{
  "unmatched": [
    {
      "path": "/webhooks/callback/payment",
      "correlationId": "unknown_123",
      "payload": { "paymentId": "unknown_123" },
      "receivedAt": 1706097400000
    }
  ],
  "count": 1
}
```

---

### Cleanup Expired

```
POST /api/correlations/cleanup
```

Remove expired paused entries and idempotency records.

**Response (200):**
```json
{
  "cleaned": 2,
  "idempotencyCleared": 5,
  "remaining": 3
}
```

---

### Idempotency Stats

```
GET /api/correlations/idempotency
```

Returns the current size of the idempotency cache.

**Response (200):**
```json
{
  "size": 42
}
```

---

## Security Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `WEBHOOK_SECURITY_ENABLED` | `false` | Enable webhook security (HMAC, IP whitelist) |
| `WEBHOOK_HMAC_SECRET` | (random) | HMAC-SHA256 secret key for signing |
| `WEBHOOK_TOKEN_EXPIRY_MS` | `86400000` (24h) | Token expiration time |

### Request Signature Validation

When security is enabled, incoming webhooks are validated against these headers (in priority order):

1. `x-webhook-signature` — raw HMAC-SHA256 hex digest
2. `x-hub-signature-256` — GitHub-style `sha256=<hex>` format
3. `x-signature` — generic signature header

**Signing example:**
```javascript
const crypto = require('crypto');
const body = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', WEBHOOK_HMAC_SECRET)
  .update(body)
  .digest('hex');

// Send as header
headers['x-webhook-signature'] = signature;
// Or GitHub-style
headers['x-hub-signature-256'] = `sha256=${signature}`;
```

### Idempotency Headers

Prevent duplicate processing by including one of these headers:

| Header | Description |
|--------|-------------|
| `x-idempotency-key` | Explicit idempotency key (highest priority) |
| `x-request-id` | Request identifier (fallback) |

If neither is provided, the combination of `correlationId + webhookPath` is used as an implicit idempotency key.

---

## Storage Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `CORRELATION_STORE_TYPE` | `memory` | `memory`, `sqlite`, or `postgres` |
| `DATABASE_URL` | — | PostgreSQL connection string (for `postgres` type) |

- **memory** — In-memory only, lost on restart. Best for development.
- **sqlite** — File-based, persists across restarts. Best for local development/testing.
- **postgres** — Production-grade. Requires a PostgreSQL instance.
