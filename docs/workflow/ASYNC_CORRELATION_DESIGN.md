# Async Correlation Workflows — Design & Implementation

> Future Phase feature — Pause/resume workflows with webhook callbacks and correlation matching

## Executive Summary

**Problem:** Current workflows run synchronously from start to finish. No support for long-running external processes that callback asynchronously (payment gateways, async APIs, manual approvals, long-polling operations).

**Solution:** Add correlation-based pause/resume capability where workflows can:
1. Send request to external system
2. Pause execution and save state
3. Wait for webhook callback (minutes/hours/days)
4. Resume from paused state with callback data

**Industry precedent:** Temporal (signals), Camunda (message correlation), AWS Step Functions (task tokens), n8n (webhook wait nodes).

---

## Use Cases

### 1. Payment Gateway Integration
```
Start → HTTP: Initiate Payment → CorrelationWait → HTTP: Process Result → End
                ↓ (returns paymentId)        ↑
                                              | Webhook: /payment-callback
                                              | { paymentId: "abc", status: "approved" }
```

### 2. Approval Workflows
```
Start → HTTP: Create PR → CorrelationWait → Condition: approved? → Merge/Reject
                ↓ (returns prId)        ↑
                                        | Webhook: /github-webhook
                                        | { action: "approved", prId: "123" }
```

### 3. Long-Running Job Polling
```
Start → HTTP: Submit Job → CorrelationWait → HTTP: Get Results → End
              ↓ (returns jobId)        ↑
                                       | Webhook: /job-complete
                                       | { jobId: "xyz", status: "done" }
```

### 4. Multi-Step API Orchestration
```
Order Service → Payment Service (pause) → Inventory Service (pause) → Shipping Service
```

---

## Industry Analysis

### Pattern Comparison

| Platform | Correlation Method | Persistence | Max Timeout | Code-First | Visual Designer |
|----------|-------------------|-------------|-------------|------------|-----------------|
| **Temporal** | Signals | Event sourcing | Unlimited | ✅ TypeScript | ❌ |
| **Camunda** | BPMN messages | PostgreSQL | Unlimited | ❌ | ✅ BPMN |
| **AWS Step Functions** | Task tokens | DynamoDB | 1 year | ✅ ASL JSON | ✅ Console |
| **n8n** | Webhook URLs | PostgreSQL | Config | ❌ | ✅ Node editor |
| **Prefect** | Pause API | PostgreSQL | Config | ✅ Python | ⚠️ Limited |
| **Airflow** | Sensors (polling) | PostgreSQL | Task timeout | ✅ Python | ❌ |
| **RedfireForge** | Correlation IDs | SQLite/file | Config | ❌ | ✅ Visual graph |

### Key Learnings

1. **Correlation Strategy:**
   - Temporal: Workflow ID + signal name
   - Camunda: Business key (orderId, transactionId)
   - Step Functions: Opaque task tokens
   - n8n: Execution ID in webhook URL
   - **→ We should support both:** correlation variable (flexible) + execution ID (secure)

2. **State Persistence:**
   - All production systems use database (PostgreSQL, DynamoDB, Cassandra)
   - In-memory only viable for dev/test (like n8n test webhooks)
   - **→ Start with abstraction, support both**

3. **Webhook Security:**
   - Temporal: Namespace auth
   - Step Functions: IAM + API Gateway
   - n8n: Signed URLs with secrets
   - Camunda: REST API with OAuth2
   - **→ Use signed tokens in webhook URLs**

4. **Timeout Handling:**
   - All platforms support timeouts
   - Most use background cleanup jobs
   - Boundary events (Camunda) or timer conditions (Temporal)
   - **→ Cleanup job + timeout metadata**

---

## Architecture Design

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Workflow Designer)                                │
│                                                               │
│  ┌──────┐    ┌──────────────────┐    ┌──────┐              │
│  │ HTTP │───▶│ CorrelationWait  │───▶│ HTTP │              │
│  │      │    │ correlationId:   │    │ Next │              │
│  │      │    │  {{paymentId}}   │    │ Step │              │
│  └──────┘    └──────────────────┘    └──────┘              │
│                     │                                         │
│                     │ PAUSE (save state)                     │
│                     ▼                                         │
└─────────────────────────────────────────────────────────────┘
                      │
                      │ POST /api/workflows/pause
                      │ { executionId, correlationId, state }
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (src-server/)                                        │
│                                                               │
│  ┌─────────────────────┐         ┌──────────────────────┐  │
│  │ PausedWorkflowStore │◀────────│ /api/workflows/pause │  │
│  │  - save()           │         └──────────────────────┘  │
│  │  - findByCorrelation│                                    │
│  │  - delete()         │         ┌──────────────────────┐  │
│  │  - cleanupExpired() │────────▶│  Cleanup Job (cron)  │  │
│  └─────────────────────┘         └──────────────────────┘  │
│           ▲                                                  │
│           │                                                  │
│  ┌────────┴─────────────┐                                   │
│  │ /webhooks/:path      │◀─────── External System          │
│  │  - Extract corrId    │         POST /webhooks/payment    │
│  │  - Match paused wf   │         { correlationId, data }  │
│  │  - Resume execution  │                                   │
│  └──────────────────────┘                                   │
│           │                                                  │
│           │ POST /api/workflows/resume                      │
│           │ { executionId, webhookData }                    │
│           ▼                                                  │
└─────────────────────────────────────────────────────────────┘
                      │
                      │ Resume with injected webhook variables
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Continue Execution)                                │
│                                                               │
│  {{webhook.status}} = "approved"                             │
│  {{webhook.amount}} = "99.99"                                │
│  ... continue from paused node ...                           │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
src/features/workflow/
├── types/workflow.ts
│   └── + CorrelationWaitNodeData
│
├── engine/
│   ├── graphRunner.ts
│   │   └── + case 'correlationWait': handleCorrelationWaitNode()
│   ├── graphRunnerNodeHandlers.ts
│   │   └── + handleCorrelationWaitNode()
│   ├── workflowStateSerializer.ts          [NEW]
│   │   ├── serializeWorkflowState()
│   │   └── deserializeWorkflowState()
│   └── correlationStore.ts                 [NEW]
│       ├── interface ICorrelationStore
│       ├── InMemoryCorrelationStore
│       └── DatabaseCorrelationStore (future)
│
├── components/
│   ├── nodes/CorrelationWaitNode.tsx        [NEW]
│   └── configs/CorrelationWaitConfig.tsx    [NEW]
│
└── utils/
    └── workflowResume.ts                    [NEW]

src-server/
├── correlationStore.ts                      [NEW]
│   ├── interface PausedWorkflow
│   ├── saveWorkflow()
│   ├── findByCorrelation()
│   ├── deleteWorkflow()
│   └── cleanupExpired()
│
├── webhookRouter.ts                         [MODIFY]
│   └── + correlation matching logic
│
└── routes/
    └── workflows.ts                         [NEW]
        ├── POST /api/workflows/pause
        ├── POST /api/workflows/resume
        └── GET /api/workflows/paused
```

---

## Data Models

### Frontend Types

```typescript
// src/features/workflow/types/workflow.ts

export interface CorrelationWaitNodeData {
  [key: string]: unknown;
  label: string;
  
  /** Expression resolving to correlation ID (e.g. "{{paymentId}}"). */
  correlationIdExpression: string;
  
  /** Webhook path pattern to match (e.g. "/webhooks/payment-callback"). */
  webhookPath: string;
  
  /** How to extract correlationId from webhook payload. */
  correlationSource: 'body' | 'header' | 'query';
  
  /** JSONPath to extract correlation ID from webhook (e.g. "$.paymentId"). */
  correlationJsonPath?: string;
  
  /** Header name if correlationSource is 'header'. */
  correlationHeader?: string;
  
  /** Query param name if correlationSource is 'query'. */
  correlationQueryParam?: string;
  
  /** Variables to extract from webhook payload. */
  extractVariables?: Array<{ name: string; jsonPath: string }>;
  
  /** Timeout in ms (workflow fails if no callback received). */
  timeoutMs: number;
  
  /** Optional webhook validation expression (e.g. "{{webhook.type}} == payment"). */
  webhookFilter?: string;
  
  /** Optional notes. */
  notes?: string;
}

export interface WorkflowState {
  /** Current workflow execution ID. */
  executionId: string;
  
  /** Workflow definition. */
  workflow: Workflow;
  
  /** Variable context snapshot. */
  variables: Record<string, string>;
  
  /** Visited node IDs. */
  visitedNodes: string[];
  
  /** Current paused node ID. */
  currentNodeId: string;
  
  /** Thread ID for parallel execution tracking. */
  threadId: string;
  
  /** Join arrival tracking. */
  joinArrived: Record<string, number>;
  
  /** Results collected so far. */
  results: RequestResult[];
  
  /** Execution start timestamp. */
  startTime: number;
}

// Update WorkflowNodeType union
export type WorkflowNodeType = 
  | 'http' 
  | 'condition' 
  | 'delay' 
  | 'start' 
  | 'fork' 
  | 'join' 
  | 'end' 
  | 'webhook' 
  | 'schedule' 
  | 'switch' 
  | 'loop' 
  | 'setVariable' 
  | 'aggregate' 
  | 'errorHandler' 
  | 'logDebug' 
  | 'waitForCondition' 
  | 'subWorkflow' 
  | 'script'
  | 'correlationWait';  // NEW

// Update WorkflowNodeData union
export type WorkflowNodeData = 
  | HttpNodeData 
  | ConditionNodeData 
  | DelayNodeData 
  | StartNodeData 
  | ForkNodeData 
  | JoinNodeData 
  | EndNodeData 
  | WebhookTriggerNodeData 
  | ScheduleTriggerNodeData 
  | SwitchNodeData 
  | LoopNodeData 
  | SetVariableNodeData 
  | AggregateNodeData 
  | ErrorHandlerNodeData 
  | LogDebugNodeData 
  | WaitForConditionNodeData 
  | SubWorkflowNodeData 
  | ScriptNodeData
  | CorrelationWaitNodeData;  // NEW
```

### Backend Types

```typescript
// src-server/types.ts

export interface PausedWorkflow {
  /** Unique execution ID. */
  executionId: string;
  
  /** Workflow definition ID. */
  workflowId: string;
  
  /** Correlation ID extracted from workflow variables. */
  correlationId: string;
  
  /** Webhook path pattern to match. */
  webhookPath: string;
  
  /** Serialized workflow state (variables, visited nodes, etc.). */
  state: string;  // JSON.stringify(WorkflowState)
  
  /** When the workflow was paused. */
  pausedAt: number;
  
  /** When the workflow should timeout. */
  timeoutAt: number;
  
  /** Optional webhook filter expression. */
  webhookFilter?: string;
}

export interface WebhookCallbackPayload {
  /** Correlation ID extracted from webhook. */
  correlationId: string;
  
  /** Full webhook payload. */
  body: Record<string, unknown>;
  
  /** Webhook headers. */
  headers: Record<string, string>;
  
  /** Query parameters. */
  query: Record<string, string>;
  
  /** Matched paused workflow (if found). */
  matched?: PausedWorkflow;
}
```

### Storage Schema (Future - SQLite)

```sql
-- src-server/schema.sql

CREATE TABLE IF NOT EXISTS paused_workflows (
  execution_id VARCHAR(64) PRIMARY KEY,
  workflow_id VARCHAR(64) NOT NULL,
  correlation_id VARCHAR(255) NOT NULL,
  webhook_path VARCHAR(255) NOT NULL,
  state_json TEXT NOT NULL,
  paused_at INTEGER NOT NULL,
  timeout_at INTEGER NOT NULL,
  webhook_filter TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_paused_workflows_correlation 
  ON paused_workflows(correlation_id);

CREATE INDEX idx_paused_workflows_timeout 
  ON paused_workflows(timeout_at);

CREATE INDEX idx_paused_workflows_webhook_path 
  ON paused_workflows(webhook_path);

-- Unmatched webhooks (for debugging)
CREATE TABLE IF NOT EXISTS unmatched_webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_path VARCHAR(255) NOT NULL,
  correlation_id VARCHAR(255),
  payload_json TEXT NOT NULL,
  received_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_unmatched_webhooks_received 
  ON unmatched_webhooks(received_at);
```

---

## Implementation Phases

### **Phase 7A: In-Memory Correlation (MVP)**
**Goal:** Proof-of-concept with in-memory storage  
**Duration:** 3-5 days  
**Dependencies:** None (can start immediately)

#### Tasks

**7A.1 — Data Model**
- [ ] Add `CorrelationWaitNodeData` to `workflow.ts`
- [ ] Add `WorkflowState` interface for serialization
- [ ] Update `WorkflowNodeType` and `WorkflowNodeData` unions
- [ ] Add default data in `workflowNodeFactory.ts`

**7A.2 — State Serialization**
- [ ] Create `workflowStateSerializer.ts`
- [ ] Implement `serializeWorkflowState(hCtx)`
- [ ] Implement `deserializeWorkflowState(state)`
- [ ] Unit tests for serialization (100% coverage)

**7A.3 — In-Memory Correlation Store**
- [ ] Create `correlationStore.ts` with `ICorrelationStore` interface
- [ ] Implement `InMemoryCorrelationStore` class
  - `pause(correlationId, state, timeoutMs): Promise<void>`
  - `resume(correlationId, webhookData): Promise<WorkflowState | null>`
  - `cleanup(): void` (removes expired)
- [ ] Unit tests (90%+ coverage)

**7A.4 — Node Handler**
- [ ] Implement `handleCorrelationWaitNode()` in `graphRunnerNodeHandlers.ts`
  - Resolve correlation ID from expression
  - Serialize workflow state
  - Call `correlationStore.pause()`
  - Wait for promise resolution (in-memory)
  - Inject webhook variables into context
  - Continue execution
- [ ] Add to switch statement in `graphRunner.ts`
- [ ] Unit tests (90%+ coverage)

**7A.5 — UI Components**
- [ ] Create `CorrelationWaitNode.tsx` (canvas node)
  - Display correlation ID preview
  - Display webhook path
  - Display timeout duration
  - Handles: `in` (top) → `out` (bottom)
- [ ] Create `CorrelationWaitConfig.tsx` (config panel)
  - Correlation ID expression field with variable insert
  - Webhook path field
  - Correlation source dropdown (body/header/query)
  - JSONPath/header/param extraction config
  - Extract variables table
  - Timeout duration field
  - Webhook filter expression (optional)
- [ ] Add to node palette
- [ ] Add to node icon mapping
- [ ] Component tests (90%+ coverage)

**7A.6 — Backend Webhook Handler (In-Memory)**
- [ ] Update `src-server/webhookRouter.ts`:
  - Extract correlation ID from webhook (body/header/query)
  - Call `correlationStore.resume(correlationId, webhookData)`
  - Return `{ resumed: true/false }`
- [ ] Log unmatched webhooks
- [ ] Integration tests

**7A.7 — E2E Tests**
- [ ] Simple correlation: HTTP → CorrelationWait → HTTP → End
- [ ] Timeout test: Correlation never called back
- [ ] Multiple pending correlations
- [ ] Webhook with JSONPath variable extraction
- [ ] Invalid correlation ID (no match)

**Deliverables:**
- ✅ CorrelationWait node works in-memory
- ✅ Supports basic pause/resume
- ✅ Max timeout: ~5 minutes (in-memory limit)
- ✅ No database required
- ✅ Ready for prototype/demo

---

### **Phase 7B: Execution History Integration**
**Goal:** Show paused workflows in UI  
**Duration:** 2-3 days  
**Dependencies:** Phase 7A

#### Tasks

**7B.1 — Execution Status Updates**
- [ ] Add `'paused'` to `NodeRunState` type
- [ ] Update node state change callback to show "PAUSED" badge
- [ ] Add pause icon/color to node styling

**7B.2 — Execution History Panel**
- [ ] Add "PAUSED" filter to execution history
- [ ] Show paused workflows with:
  - Correlation ID
  - Time paused
  - Time until timeout
  - "Resume Manually" button (for testing)
- [ ] Paginate paused executions

**7B.3 — Manual Resume (Testing)**
- [ ] Add "Test Webhook" button in config panel
- [ ] Generate sample webhook payload
- [ ] Call resume endpoint with test data
- [ ] Show result in console

**Deliverables:**
- ✅ Paused workflows visible in UI
- ✅ Manual testing capability
- ✅ Clear visual feedback

---

### **Phase 7C: Database Persistence (Production)**
**Goal:** Support long-running correlations (hours/days)  
**Duration:** 5-7 days  
**Dependencies:** Phase 7A, 7B

#### Tasks

**7C.1 — Database Schema**
- [ ] Create SQLite schema for `paused_workflows` table
- [ ] Create `unmatched_webhooks` table
- [ ] Migration script
- [ ] Indexes for correlation_id, timeout_at, webhook_path

**7C.2 — Database Correlation Store**
- [ ] Implement `DatabaseCorrelationStore` class
  - Uses `better-sqlite3` or similar
  - Implements `ICorrelationStore` interface
  - JSON serialization for state
- [ ] Connection pooling (if needed)
- [ ] Transaction support
- [ ] Unit tests (90%+ coverage)

**7C.3 — Cleanup Job**
- [ ] Implement background cleanup job (every 1 minute)
- [ ] Delete workflows where `timeout_at < now()`
- [ ] Update execution history with timeout failure
- [ ] Log cleanup events

**7C.4 — Configuration**
- [ ] Environment variable: `CORRELATION_STORE_TYPE` (memory | database)
- [ ] Dependency injection in `graphRunner.ts`
- [ ] Default to in-memory for dev, database for production

**7C.5 — Monitoring**
- [ ] Endpoint: `GET /api/workflows/paused` (list all paused)
- [ ] Endpoint: `GET /api/workflows/paused/:executionId` (get one)
- [ ] Endpoint: `DELETE /api/workflows/paused/:executionId` (cancel)
- [ ] Metrics: count of paused workflows, average wait time

**7C.6 — Migration Tests**
- [ ] Test migration from in-memory to database
- [ ] Data integrity checks
- [ ] Performance benchmarks

**Deliverables:**
- ✅ Production-ready persistence
- ✅ Survives server restarts
- ✅ Supports hours/days timeout
- ✅ Monitoring and management endpoints

---

### **Phase 7D: Advanced Features**
**Goal:** Enterprise-grade capabilities  
**Duration:** 5-7 days  
**Dependencies:** Phase 7C

#### Tasks

**7D.1 — Webhook Security**
- [ ] Signed webhook URLs with HMAC
- [ ] Token expiration
- [ ] IP whitelist support
- [ ] Request signature validation

**7D.2 — Retry & Idempotency**
- [ ] Handle duplicate webhook calls (same correlationId)
- [ ] Idempotency key support
- [ ] Webhook retry from external system

**7D.3 — Webhook Payload Validation**
- [ ] JSON schema validation for webhook payloads
- [ ] Webhook filter expressions (`{{webhook.type}} == "payment"`)
- [ ] Pre-validation before resume

**7D.4 — Multi-Correlation**
- [ ] Support multiple correlation waits in same workflow
- [ ] Parallel correlation waits (Fork → CorrelationWait × 3 → Join)
- [ ] Nested correlation waits

**7D.5 — Observability**
- [ ] Structured logging for pause/resume events
- [ ] Metrics: pause rate, resume rate, timeout rate
- [ ] Alert on high timeout rate
- [ ] Tracing with execution ID

**7D.6 — Admin UI**
- [ ] Full-screen paused workflows browser
- [ ] Search by correlation ID, workflow name, status
- [ ] Bulk operations (cancel all, retry all)
- [ ] Export paused workflow state (for debugging)

**Deliverables:**
- ✅ Production-grade security
- ✅ Reliable in high-volume scenarios
- ✅ Full observability
- ✅ Admin management tools

---

### **Phase 7E: Documentation & Examples**
**Goal:** User-facing docs and templates  
**Duration:** 2-3 days  
**Dependencies:** Phase 7D

#### Tasks

**7E.1 — User Documentation**
- [ ] Add CorrelationWait to workflow node docs
- [ ] Tutorial: Payment gateway integration
- [ ] Tutorial: Approval workflow
- [ ] Tutorial: Long-running job polling
- [ ] FAQ: Common issues and troubleshooting

**7E.2 — Example Workflows**
- [ ] Payment gateway workflow (YAML + visual)
- [ ] GitHub PR approval workflow
- [ ] AWS Lambda async invocation
- [ ] Manual approval with timeout

**7E.3 — API Reference**
- [ ] OpenAPI spec for webhook endpoints
- [ ] Webhook payload examples
- [ ] Correlation ID extraction patterns

**Deliverables:**
- ✅ Complete user documentation
- ✅ Ready-to-use examples
- ✅ API reference

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// correlationStore.test.ts
describe('InMemoryCorrelationStore', () => {
  test('pause and resume with matching correlationId', async () => {
    const store = new InMemoryCorrelationStore();
    const state = { executionId: 'e1', variables: { x: '1' }, ... };
    
    const resumePromise = store.pause('corr-123', state, 5000);
    await store.resume('corr-123', { status: 'ok' });
    
    const result = await resumePromise;
    expect(result.webhookData).toEqual({ status: 'ok' });
  });
  
  test('timeout after timeoutMs', async () => {
    const store = new InMemoryCorrelationStore();
    await expect(
      store.pause('corr-timeout', state, 100)
    ).rejects.toThrow('Correlation timeout');
  });
});

// workflowStateSerializer.test.ts
describe('serializeWorkflowState', () => {
  test('captures all context', () => {
    const hCtx = makeTestContext();
    const state = serializeWorkflowState(hCtx);
    
    expect(state.variables).toEqual(hCtx.ctx.snapshot());
    expect(state.visitedNodes).toEqual([...hCtx.visited]);
    expect(state.currentNodeId).toBe('node1');
  });
});
```

### Integration Tests

```typescript
// graphRunner.correlation.test.ts
describe('Correlation workflow execution', () => {
  test('HTTP → CorrelationWait → HTTP → End', async () => {
    const nodes = [
      startNode('s1'),
      httpNode('h1', { url: 'https://api.example.com/pay' }),
      correlationWaitNode('cw1', {
        correlationIdExpression: '{{paymentId}}',
        webhookPath: '/webhooks/payment',
        timeoutMs: 10_000,
      }),
      httpNode('h2', { url: 'https://api.example.com/confirm' }),
      endNode('e1'),
    ];
    
    const edges = [
      { source: 's1', target: 'h1' },
      { source: 'h1', target: 'cw1' },
      { source: 'cw1', target: 'h2' },
      { source: 'h2', target: 'e1' },
    ];
    
    // Mock HTTP responses
    fetchMock.post('*/pay', { paymentId: 'pay-123' });
    fetchMock.post('*/confirm', { success: true });
    
    // Start workflow (will pause at cw1)
    const resultPromise = runGraph(nodes, edges, {}, callbacks);
    
    // Wait for pause
    await vi.waitFor(() => 
      expect(correlationStore.isPaused('pay-123')).toBe(true)
    );
    
    // Simulate webhook callback
    await correlationStore.resume('pay-123', { 
      status: 'approved', 
      amount: 99.99 
    });
    
    // Workflow should complete
    const results = await resultPromise;
    expect(results).toHaveLength(2); // h1 + h2
    expect(callbacks.onComplete).toHaveBeenCalledWith(
      results, true, expect.any(Number)
    );
  });
});
```

### E2E Tests (Playwright)

```typescript
// workflow-correlation.spec.ts
test('create and execute correlation workflow', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab="workflow"]');
  
  // Create workflow
  await page.click('button:has-text("New Workflow")');
  await page.fill('input[placeholder="Workflow name"]', 'Payment Test');
  
  // Add nodes
  await dragNode(page, 'HTTP Request', 100, 100);
  await dragNode(page, 'Correlation Wait', 100, 200);
  await dragNode(page, 'HTTP Request', 100, 300);
  
  // Configure first HTTP node
  await page.click('.wf-node:has-text("HTTP Request")').first();
  await page.fill('[data-field="url"]', 'https://api.example.com/pay');
  await page.click('button:has-text("Extract")');
  await page.fill('[data-field="extract-name"]', 'paymentId');
  await page.fill('[data-field="extract-jsonpath"]', '$.id');
  
  // Configure correlation wait
  await page.click('.wf-node:has-text("Correlation Wait")');
  await page.fill('[data-field="correlationId"]', '{{paymentId}}');
  await page.fill('[data-field="webhookPath"]', '/webhooks/payment');
  await page.fill('[data-field="timeout"]', '10000');
  
  // Execute workflow
  await page.click('button:has-text("Quick Test")');
  
  // Should pause at correlation wait
  await expect(page.locator('.wf-node[data-state="paused"]')).toBeVisible();
  
  // Trigger webhook (via test endpoint)
  await page.click('button:has-text("Test Webhook")');
  await page.fill('textarea[data-field="webhook-payload"]', 
    JSON.stringify({ paymentId: 'pay-123', status: 'approved' })
  );
  await page.click('button:has-text("Send")');
  
  // Workflow should complete
  await expect(page.locator('.wf-node[data-state="pass"]')).toHaveCount(3);
});
```

### Coverage Requirements

- **Unit tests:** >90% line coverage, >85% branch coverage
- **Integration tests:** All node handler paths covered
- **E2E tests:** All UI flows + error cases covered

---

## Security Considerations

### 1. Webhook Authentication

```typescript
// Generate signed webhook URL
function generateWebhookUrl(executionId: string, secret: string): string {
  const token = crypto
    .createHmac('sha256', secret)
    .update(executionId)
    .digest('hex');
  
  return `${BASE_URL}/webhooks/callback?token=${token}&executionId=${executionId}`;
}

// Validate webhook signature
function validateWebhook(req: Request): boolean {
  const { token, executionId } = req.query;
  const expectedToken = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(executionId)
    .digest('hex');
  
  return token === expectedToken;
}
```

### 2. Rate Limiting

```typescript
// Prevent webhook spam
const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many webhook requests',
});

app.post('/webhooks/*', webhookRateLimiter, handleWebhook);
```

### 3. Input Validation

```typescript
// Validate webhook payload schema
const paymentWebhookSchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(['approved', 'rejected']),
  amount: z.number().positive(),
});

try {
  const validated = paymentWebhookSchema.parse(req.body);
} catch (error) {
  return res.status(400).json({ error: 'Invalid payload' });
}
```

---

## Performance Considerations

### 1. Database Indexes

```sql
-- Fast correlation ID lookup
CREATE INDEX idx_paused_workflows_correlation 
  ON paused_workflows(correlation_id);

-- Cleanup job efficiency
CREATE INDEX idx_paused_workflows_timeout 
  ON paused_workflows(timeout_at) 
  WHERE timeout_at IS NOT NULL;
```

### 2. Connection Pooling

```typescript
// Reuse database connections
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 3. Caching

```typescript
// Cache frequently accessed paused workflows
const pausedWorkflowCache = new LRU<string, PausedWorkflow>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});
```

---

## Monitoring & Observability

### Metrics to Track

```typescript
// Prometheus metrics
const pauseCounter = new Counter({
  name: 'workflow_pauses_total',
  help: 'Total number of workflow pauses',
  labelNames: ['workflow_id'],
});

const resumeCounter = new Counter({
  name: 'workflow_resumes_total',
  help: 'Total number of workflow resumes',
  labelNames: ['workflow_id', 'status'], // success | timeout | error
});

const pauseDuration = new Histogram({
  name: 'workflow_pause_duration_seconds',
  help: 'Time workflows spend paused',
  buckets: [1, 60, 300, 600, 1800, 3600], // 1s, 1m, 5m, 10m, 30m, 1h
});
```

### Logging

```typescript
logger.info('Workflow paused', {
  executionId,
  correlationId,
  workflowId,
  nodeId,
  timeoutAt: new Date(timeoutAt).toISOString(),
});

logger.info('Workflow resumed', {
  executionId,
  correlationId,
  pauseDurationMs,
  webhookSource: req.ip,
});
```

---

## Migration Path from WaitForCondition

For users with existing polling workflows, provide migration guide:

### Before (WaitForCondition - Polling)
```yaml
- type: waitForCondition
  label: Wait for Job Complete
  conditionExpression: "{{status}} == done"
  pollIntervalMs: 5000
  timeoutMs: 300000
```

### After (CorrelationWait - Webhook)
```yaml
- type: correlationWait
  label: Wait for Job Complete
  correlationIdExpression: "{{jobId}}"
  webhookPath: "/webhooks/job-complete"
  timeoutMs: 300000
```

**Benefits:**
- ✅ No polling overhead
- ✅ Instant response (not delayed by poll interval)
- ✅ Lower server load
- ✅ Scales to thousands of concurrent waits

---

## Open Questions

1. **Max concurrent paused workflows?**
   - In-memory: ~1000-5000 (memory limit)
   - Database: ~100K+ (with proper indexes)

2. **Webhook URL format?**
   - Option A: `/webhooks/:path?executionId=xxx&token=yyy`
   - Option B: `/webhooks/:path/:executionId?token=yyy`
   - **Recommendation:** Option A (simpler, no path collision)

3. **Resume from UI?**
   - Manual resume button for testing/debugging
   - "Retry" button for timed-out correlations

4. **Correlation ID collision handling?**
   - Append execution ID to make globally unique
   - `${correlationId}:${executionId}`

5. **Sub-workflow correlation?**
   - Should sub-workflows inherit parent's correlation store?
   - Or separate correlation scope per sub-workflow?

---

## References

- [Temporal Signals](https://docs.temporal.io/workflows#signals)
- [Camunda Message Correlation](https://docs.camunda.org/manual/7.20/reference/bpmn20/events/message-events/)
- [AWS Step Functions Task Tokens](https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#connect-wait-token)
- [n8n Webhook Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Prefect Pause/Resume](https://docs.prefect.io/2.11.3/concepts/flows/#pausing-flow-runs)

---

## Appendix: Example Workflows

### Payment Gateway Integration

```yaml
name: Payment Gateway Workflow
nodes:
  - id: start
    type: start
    
  - id: initiate-payment
    type: http
    data:
      method: POST
      url: https://gateway.example.com/payments
      body: |
        {
          "amount": {{amount}},
          "currency": "USD",
          "returnUrl": "{{webhookUrl}}"
        }
      extractVariables:
        - name: paymentId
          jsonPath: $.id
        - name: paymentUrl
          jsonPath: $.checkoutUrl
          
  - id: wait-payment
    type: correlationWait
    data:
      correlationIdExpression: "{{paymentId}}"
      webhookPath: /webhooks/payment-complete
      correlationSource: body
      correlationJsonPath: $.paymentId
      extractVariables:
        - name: paymentStatus
          jsonPath: $.status
        - name: transactionId
          jsonPath: $.transactionId
      timeoutMs: 3600000  # 1 hour
      
  - id: check-status
    type: condition
    data:
      left: "{{paymentStatus}}"
      operator: "=="
      right: "approved"
      
  - id: fulfill-order
    type: http
    data:
      method: POST
      url: https://api.example.com/orders/{{orderId}}/fulfill
      
  - id: cancel-order
    type: http
    data:
      method: POST
      url: https://api.example.com/orders/{{orderId}}/cancel
      
  - id: end
    type: end

edges:
  - source: start
    target: initiate-payment
  - source: initiate-payment
    target: wait-payment
  - source: wait-payment
    target: check-status
  - source: check-status
    sourceHandle: "true"
    target: fulfill-order
  - source: check-status
    sourceHandle: "false"
    target: cancel-order
  - source: fulfill-order
    target: end
  - source: cancel-order
    target: end
```

---

**Status:** Design Complete, Ready for Implementation  
**Next Step:** Begin Phase 7A.1 (Data Model)  
**Target Completion:** 3-4 weeks for full implementation (Phases 7A-7E)
