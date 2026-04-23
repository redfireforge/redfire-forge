# Phase 5: Webhook Runtime & Schedule Execution Architecture

> **Design Document for Production-Ready Webhook Server & Cron Scheduler**
> 
> Status: 📋 Design Phase  
> Author: Architecture Team  
> Date: April 23, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Component Design](#component-design)
5. [Implementation Approach](#implementation-approach)
6. [Production Deployment Strategy](#production-deployment-strategy)
7. [Security Considerations](#security-considerations)
8. [Scaling & Performance](#scaling--performance)
9. [Monitoring & Observability](#monitoring--observability)
10. [Migration Path](#migration-path)

---

## Executive Summary

**Objective:** Implement production-ready webhook HTTP server and cron-based scheduler to enable automated workflow triggering.

**Scope:**
- **Webhook Server**: Accept incoming HTTP requests and trigger workflows with payload extraction
- **Schedule Execution**: Run workflows on cron schedules with timezone support
- **Workflow Registry**: Manage active workflows, enable/disable triggers
- **Execution Queue**: Async workflow execution with retry, timeout, and failure handling
- **Audit & Logging**: Track webhook deliveries, schedule runs, execution history

**Key Requirements:**
- ✅ Real-time webhook processing (<100ms response)
- ✅ Reliable cron execution (no missed schedules)
- ✅ High availability (99.9% uptime)
- ✅ Horizontal scaling for webhook load
- ✅ Zero data loss (at-least-once delivery)

---

## Architecture Overview

### Deployment Models

RedfireForge supports **two deployment modes**:

#### 1. **Desktop Mode (Current)** — Tauri App
- Runs on user's local machine
- Single-user, localhost-only
- Data stored in AppData/localStorage
- No server infrastructure needed

#### 2. **Server Mode (Phase 5)** — Standalone Node.js Service
- Runs on a server (cloud VM, container, on-prem)
- Multi-user, network accessible
- Persistent database (PostgreSQL/SQLite)
- Webhook URLs accessible from internet
- Deployed via Docker/Kubernetes/systemd

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Systems                         │
│  (GitHub, Kafka, Stripe, etc. sending webhooks)            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ HTTP POST/PUT/PATCH
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Webhook HTTP Server (Express.js)              │
│  • Route: POST /webhooks/:workflowId/:triggerId             │
│  • Validates signature (optional)                           │
│  • Extracts payload variables via JSONPath                  │
│  • Enqueues workflow execution                              │
│  • Returns 202 Accepted immediately                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│             Execution Queue (Bull/BullMQ + Redis)           │
│  • Job: { workflowId, triggerId, variables, payload }      │
│  • Retry policy: 3 attempts with exponential backoff       │
│  • Dead letter queue for failed jobs                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Workflow Executor Workers                  │
│  • Pulls jobs from queue                                    │
│  • Loads workflow definition from DB                        │
│  • Runs graphRunner.ts with extracted variables             │
│  • Records execution results to DB                          │
│  • Sends notifications on failure (optional)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                Cron Scheduler (node-cron)                   │
│  • Polls DB for active schedule triggers                    │
│  • Evaluates cron expressions with timezone                 │
│  • Injects automatic variables (triggerTime, timestamp)     │
│  • Enqueues workflow execution                              │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (PostgreSQL or SQLite)                │
│  Tables:                                                    │
│    • workflows (id, name, definition_json, created_at)     │
│    • webhook_triggers (id, workflow_id, method, path)      │
│    • schedule_triggers (id, workflow_id, cron, timezone)   │
│    • execution_logs (id, workflow_id, status, duration)    │
│    • webhook_deliveries (id, trigger_id, payload, status)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Runtime

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **HTTP Server** | Express.js (Node.js) | Fast, mature, extensive middleware ecosystem |
| **Job Queue** | BullMQ + Redis | Production-proven, scales horizontally, great monitoring |
| **Scheduler** | node-cron | Simple, reliable cron syntax support with timezone |
| **Database** | PostgreSQL (prod) / SQLite (dev) | JSONB support for workflows, full ACID compliance |
| **Workflow Engine** | Existing graphRunner.ts | Reuse battle-tested execution logic |
| **Validation** | Joi / Zod | Request payload validation for webhook routes |

### Infrastructure

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Containerization** | Docker + Docker Compose | Simple local dev, easy cloud deployment |
| **Orchestration** | Kubernetes (optional) | For high-scale production deployments |
| **Reverse Proxy** | Nginx / Traefik | SSL termination, load balancing, rate limiting |
| **Monitoring** | Prometheus + Grafana | Metrics, alerting, dashboards |
| **Logging** | Winston + Loki/ELK | Structured logs, aggregation, search |
| **Secrets** | Docker Secrets / Vault | API keys, DB passwords, webhook signing keys |

### Development Tools

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript (Node.js 20+) |
| **Package Manager** | npm (existing) |
| **Testing** | Vitest (unit), Playwright (E2E), supertest (API) |
| **Linting** | ESLint (existing config) |
| **Process Manager** | PM2 (systemd alternative) |

---

## Component Design

### 1. Webhook HTTP Server

**File:** `src-server/webhook-server.ts`

```typescript
import express, { Request, Response } from 'express';
import { validateWebhookSignature } from './security';
import { extractWebhookVariables } from './webhook-extractor';
import { enqueueWorkflow } from './execution-queue';
import { getWebhookTrigger } from './database';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoint
app.all('/webhooks/:workflowId/:triggerId', async (req: Request, res: Response) => {
  const { workflowId, triggerId } = req.params;
  const { method, headers, query, body } = req;

  try {
    // 1. Load webhook trigger config from DB
    const trigger = await getWebhookTrigger(workflowId, triggerId);
    if (!trigger || !trigger.enabled) {
      return res.status(404).json({ error: 'Webhook trigger not found or disabled' });
    }

    // 2. Validate HTTP method
    if (method !== trigger.method) {
      return res.status(405).json({ error: `Method ${method} not allowed. Expected ${trigger.method}` });
    }

    // 3. Optional: Validate webhook signature (GitHub, Stripe, etc.)
    if (trigger.signatureHeader && trigger.signingSecret) {
      const isValid = validateWebhookSignature(
        body,
        headers[trigger.signatureHeader.toLowerCase()],
        trigger.signingSecret,
        trigger.signatureAlgorithm
      );
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // 4. Extract variables from payload using JSONPath
    const extractedVars = extractWebhookVariables(trigger.extractVariables, {
      body,
      headers,
      query,
      params: req.params,
    });

    // 5. Enqueue workflow execution (async, non-blocking)
    const jobId = await enqueueWorkflow({
      workflowId,
      triggerId,
      triggerType: 'webhook',
      variables: extractedVars,
      rawPayload: body,
      requestMeta: {
        method,
        headers,
        query,
        ip: req.ip,
        userAgent: headers['user-agent'],
      },
    });

    // 6. Log webhook delivery
    await logWebhookDelivery({
      triggerId,
      jobId,
      payload: body,
      status: 'accepted',
      receivedAt: new Date(),
    });

    // 7. Return 202 Accepted immediately (don't wait for workflow to complete)
    res.status(202).json({
      message: 'Workflow execution queued',
      jobId,
      workflowId,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
```

**Key Features:**
- **Non-blocking**: Returns 202 immediately, workflow runs asynchronously
- **Method validation**: Checks POST/PUT/PATCH/DELETE matches config
- **Signature validation**: Optional webhook signature verification (HMAC-SHA256)
- **JSONPath extraction**: Extracts variables from body, headers, query params
- **Error handling**: Proper HTTP status codes, error logging
- **Delivery logging**: Tracks all webhook deliveries for audit

---

### 2. Execution Queue

**File:** `src-server/execution-queue.ts`

```typescript
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { runWorkflow } from '../engine/workflow/workflowRunner';
import { VariableContext } from '../engine/workflow/variableContext';
import { getWorkflow, saveExecutionLog } from './database';

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Job data interface
interface WorkflowJobData {
  workflowId: string;
  triggerId: string;
  triggerType: 'webhook' | 'schedule' | 'manual';
  variables: Record<string, string>;
  rawPayload?: unknown;
  requestMeta?: {
    method?: string;
    headers?: Record<string, string>;
    query?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  };
}

// Create queue
export const workflowQueue = new Queue<WorkflowJobData>('workflow-execution', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds, then 4s, 8s
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 1000,    // Keep last 1000 failed jobs for debugging
  },
});

// Enqueue workflow execution
export async function enqueueWorkflow(data: WorkflowJobData): Promise<string> {
  const job = await workflowQueue.add('execute', data, {
    jobId: `${data.workflowId}-${data.triggerId}-${Date.now()}`,
  });
  return job.id!;
}

// Worker to process jobs
export const workflowWorker = new Worker<WorkflowJobData>(
  'workflow-execution',
  async (job: Job<WorkflowJobData>) => {
    const { workflowId, triggerId, triggerType, variables } = job.data;
    const startTime = Date.now();

    try {
      console.log(`Executing workflow ${workflowId} from ${triggerType} trigger ${triggerId}`);

      // 1. Load workflow definition from DB
      const workflow = await getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // 2. Create variable context with extracted variables
      const ctx = new VariableContext(workflow.variables);
      Object.entries(variables).forEach(([key, value]) => {
        ctx.set(key, value);
      });

      // 3. Execute workflow using existing graphRunner
      const results = await runWorkflow(
        workflow.steps, // Converted from workflow.nodes/edges
        {
          timeoutMs: 30000,
          tokenManager: null, // Load from workflow config
          breaker: { shouldStop: false, isBroken: false },
          abortSignal: new AbortController().signal,
        },
        ctx
      );

      const duration = Date.now() - startTime;
      const hasErrors = results.some(r => r.statusCode >= 400);

      // 4. Save execution log to DB
      await saveExecutionLog({
        workflowId,
        triggerId,
        triggerType,
        status: hasErrors ? 'failed' : 'success',
        duration,
        results,
        variables,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });

      console.log(`Workflow ${workflowId} completed in ${duration}ms`);
      return { success: true, duration, results };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Workflow ${workflowId} failed:`, error);

      // Save failure log
      await saveExecutionLog({
        workflowId,
        triggerId,
        triggerType,
        status: 'error',
        duration,
        error: error.message,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });

      throw error; // Let BullMQ handle retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 workflows concurrently per worker
  }
);

// Event handlers
workflowWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

workflowWorker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, error);
});
```

**Key Features:**
- **Async execution**: Workflows don't block webhook responses
- **Retry policy**: 3 attempts with exponential backoff (2s, 4s, 8s)
- **Concurrency**: Process multiple workflows simultaneously
- **Job persistence**: Redis stores jobs, survives crashes
- **Dead letter queue**: Failed jobs stored for manual retry/debugging

---

### 3. Cron Scheduler

**File:** `src-server/cron-scheduler.ts`

```typescript
import cron from 'node-cron';
import { getAllScheduleTriggers, updateLastRun } from './database';
import { enqueueWorkflow } from './execution-queue';
import { CronExpression, parseExpression } from 'cron-parser';

interface ScheduleTrigger {
  id: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  inputVariables: Record<string, string>;
  lastRunAt: Date | null;
}

// Global map of active cron jobs
const activeJobs = new Map<string, cron.ScheduledTask>();

// Initialize scheduler: load triggers and start cron jobs
export async function initializeScheduler() {
  console.log('Initializing cron scheduler...');
  const triggers = await getAllScheduleTriggers();
  
  for (const trigger of triggers) {
    if (trigger.enabled) {
      registerScheduleTrigger(trigger);
    }
  }

  console.log(`Scheduler initialized with ${activeJobs.size} active schedules`);
}

// Register a single schedule trigger
export function registerScheduleTrigger(trigger: ScheduleTrigger) {
  const { id, cronExpression, timezone, workflowId, inputVariables } = trigger;

  // Stop existing job if re-registering
  if (activeJobs.has(id)) {
    activeJobs.get(id)!.stop();
    activeJobs.delete(id);
  }

  try {
    // Validate cron expression
    parseExpression(cronExpression, { tz: timezone });

    // Schedule cron job
    const task = cron.schedule(
      cronExpression,
      async () => {
        console.log(`Cron trigger ${id} fired for workflow ${workflowId}`);

        const now = new Date();
        const triggerTime = now.toISOString(); // ISO 8601 format
        const triggerTimestamp = Math.floor(now.getTime() / 1000); // Unix epoch

        // Enqueue workflow with automatic time variables
        await enqueueWorkflow({
          workflowId,
          triggerId: id,
          triggerType: 'schedule',
          variables: {
            ...inputVariables,
            triggerTime,        // Automatic: "2026-04-23T09:00:00.000Z"
            triggerTimestamp: String(triggerTimestamp), // Automatic: "1714737600"
          },
        });

        // Update last run timestamp
        await updateLastRun(id, now);
      },
      {
        scheduled: true,
        timezone,
      }
    );

    activeJobs.set(id, task);
    console.log(`Registered schedule trigger ${id}: ${cronExpression} (${timezone})`);

  } catch (error) {
    console.error(`Failed to register schedule trigger ${id}:`, error);
  }
}

// Unregister a schedule trigger
export function unregisterScheduleTrigger(triggerId: string) {
  const task = activeJobs.get(triggerId);
  if (task) {
    task.stop();
    activeJobs.delete(triggerId);
    console.log(`Unregistered schedule trigger ${triggerId}`);
  }
}

// Reload all schedules (called when schedules are updated)
export async function reloadSchedules() {
  console.log('Reloading schedules...');
  
  // Stop all existing jobs
  for (const [id, task] of activeJobs.entries()) {
    task.stop();
    activeJobs.delete(id);
  }

  // Re-initialize
  await initializeScheduler();
}

// Graceful shutdown
export function shutdownScheduler() {
  console.log('Shutting down scheduler...');
  for (const [id, task] of activeJobs.entries()) {
    task.stop();
  }
  activeJobs.clear();
}
```

**Key Features:**
- **Timezone support**: Cron expressions respect IANA timezone (e.g., America/New_York)
- **Automatic variables**: Injects `triggerTime` (ISO 8601) and `triggerTimestamp` (Unix epoch)
- **Hot reload**: Can update schedules without restart
- **Validation**: Parses cron expressions at registration time to catch errors early
- **Graceful shutdown**: Stops all cron jobs cleanly on process exit

---

### 4. Database Schema

**File:** `src-server/migrations/001_initial_schema.sql`

```sql
-- Workflows table
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  definition_json TEXT NOT NULL,  -- Full Workflow object as JSON
  schema_version INTEGER DEFAULT 4,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,  -- User ID (for multi-user deployments)
  enabled BOOLEAN DEFAULT TRUE
);

-- Webhook triggers table
CREATE TABLE webhook_triggers (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,  -- ID of webhook node in workflow.nodes array
  method TEXT NOT NULL CHECK(method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  path TEXT NOT NULL,
  extract_variables TEXT,  -- JSON array of { name, jsonPath } mappings
  signature_header TEXT,   -- Optional: e.g., "X-Hub-Signature-256"
  signing_secret TEXT,     -- Optional: secret for HMAC validation
  signature_algorithm TEXT,  -- Optional: "sha256", "sha1"
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedule triggers table
CREATE TABLE schedule_triggers (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  schedule_description TEXT,  -- Human-readable: "Every day at 9 AM EST"
  input_variables TEXT,       -- JSON object { "reportType": "daily_sales" }
  enabled BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,      -- Calculated from cron expression
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Execution logs table
CREATE TABLE execution_logs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('webhook', 'schedule', 'manual')),
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'error', 'timeout')),
  duration_ms INTEGER,
  results_json TEXT,  -- Full RequestResult[] array
  variables_json TEXT,  -- Variables used for this execution
  error_message TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  INDEX idx_workflow_started (workflow_id, started_at DESC),
  INDEX idx_trigger_started (trigger_id, started_at DESC)
);

-- Webhook deliveries table (audit log)
CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  trigger_id TEXT NOT NULL REFERENCES webhook_triggers(id) ON DELETE CASCADE,
  job_id TEXT,  -- BullMQ job ID
  payload_json TEXT,  -- Raw HTTP body
  request_meta_json TEXT,  -- { method, headers, query, ip, userAgent }
  status TEXT NOT NULL CHECK(status IN ('accepted', 'rejected', 'failed')),
  status_code INTEGER,
  error_message TEXT,
  received_at TIMESTAMP NOT NULL,
  processed_at TIMESTAMP,
  INDEX idx_trigger_received (trigger_id, received_at DESC)
);
```

**Key Features:**
- **Workflows as JSON**: Store full workflow definition (nodes, edges, variables)
- **Trigger associations**: Link triggers to specific workflow nodes
- **Execution history**: Full audit trail of all workflow runs
- **Webhook deliveries**: Track every incoming webhook for compliance/debugging
- **Indexes**: Optimize queries for execution history and delivery logs

---

## Implementation Approach

### Phase 5.1: Foundation (Week 1-2)

**Goal:** Set up server infrastructure and database

**Tasks:**
1. ✅ Create `src-server/` directory structure
2. ✅ Set up Express.js server with basic routes
3. ✅ Implement database migrations (PostgreSQL + SQLite)
4. ✅ Create database client layer (`src-server/database.ts`)
5. ✅ Set up Redis connection for queue
6. ✅ Add Docker Compose for local development
7. ✅ Write unit tests for database operations

**Deliverables:**
- Server runs on `http://localhost:3001`
- Database schema created
- Health check endpoint `/health` returns 200 OK
- Redis connection established

---

### Phase 5.2: Webhook Server (Week 3-4)

**Goal:** Accept webhook HTTP requests and enqueue workflows

**Tasks:**
1. ✅ Implement webhook route `/webhooks/:workflowId/:triggerId`
2. ✅ Add JSONPath variable extraction logic
3. ✅ Set up BullMQ job queue
4. ✅ Implement webhook delivery logging
5. ✅ Add HMAC signature validation (optional)
6. ✅ Write API tests with supertest
7. ✅ Add E2E test: POST webhook → verify job enqueued

**Deliverables:**
- Webhook endpoint accepts POST/PUT/PATCH/DELETE
- Variables extracted from body/headers/query
- Jobs enqueued in Redis
- 202 Accepted response returned

---

### Phase 5.3: Workflow Executor (Week 5-6)

**Goal:** Process queued jobs and execute workflows

**Tasks:**
1. ✅ Implement BullMQ worker to pull jobs from queue
2. ✅ Integrate existing `graphRunner.ts` for workflow execution
3. ✅ Add execution result storage to database
4. ✅ Implement retry policy (3 attempts, exponential backoff)
5. ✅ Add dead letter queue for failed jobs
6. ✅ Write unit tests for workflow executor
7. ✅ Add E2E test: Enqueue job → verify workflow executed → check logs

**Deliverables:**
- Workers process jobs concurrently
- Workflow execution results saved to DB
- Failed jobs retried automatically
- Execution logs queryable via API

---

### Phase 5.4: Cron Scheduler (Week 7-8)

**Goal:** Run workflows on cron schedules

**Tasks:**
1. ✅ Implement cron scheduler with node-cron
2. ✅ Add timezone support (IANA timezones)
3. ✅ Inject automatic time variables (triggerTime, triggerTimestamp)
4. ✅ Implement hot reload when schedules updated
5. ✅ Add schedule validation (parse cron expression)
6. ✅ Write unit tests for scheduler
7. ✅ Add E2E test: Create schedule → wait for trigger → verify execution

**Deliverables:**
- Cron jobs registered for active schedules
- Schedules respect timezone configuration
- Automatic variables injected correctly
- Schedules can be enabled/disabled without restart

---

### Phase 5.5: Management API (Week 9-10)

**Goal:** REST API for managing workflows, triggers, and executions

**Tasks:**
1. ✅ Implement CRUD endpoints for workflows
   - `GET /api/workflows` — List all workflows
   - `POST /api/workflows` — Create workflow
   - `GET /api/workflows/:id` — Get workflow
   - `PUT /api/workflows/:id` — Update workflow
   - `DELETE /api/workflows/:id` — Delete workflow
2. ✅ Implement trigger management endpoints
   - `GET /api/webhooks` — List webhook triggers
   - `POST /api/webhooks` — Create webhook trigger
   - `PUT /api/webhooks/:id/enable` — Enable/disable trigger
   - `DELETE /api/webhooks/:id` — Delete trigger
   - (Same for `/api/schedules`)
3. ✅ Implement execution history endpoints
   - `GET /api/executions?workflowId=xxx` — List executions
   - `GET /api/executions/:id` — Get execution details
4. ✅ Add authentication middleware (API keys)
5. ✅ Write API documentation (OpenAPI/Swagger)

**Deliverables:**
- Full REST API for workflow management
- API key authentication
- Swagger UI at `/api/docs`

---

### Phase 5.6: UI Integration (Week 11-12)

**Goal:** Update Workflow Designer UI to manage server-side triggers

**Tasks:**
1. ✅ Add "Deploy" button in Workflow Designer
   - Saves workflow to server
   - Registers webhook/schedule triggers
2. ✅ Add trigger status indicators (enabled/disabled)
3. ✅ Add webhook URL display with copy button
4. ✅ Add execution history viewer in UI
5. ✅ Add webhook delivery logs viewer
6. ✅ Add schedule next run time preview
7. ✅ Update E2E tests for new UI

**Deliverables:**
- UI can deploy workflows to server
- Webhook URLs displayed and copyable
- Execution history visible in UI
- Trigger enable/disable controls

---

### Phase 5.7: Production Hardening (Week 13-14)

**Goal:** Security, monitoring, and production readiness

**Tasks:**
1. ✅ Add rate limiting (express-rate-limit)
2. ✅ Add request size limits (10MB default)
3. ✅ Implement webhook signature validation
4. ✅ Add Prometheus metrics endpoint `/metrics`
5. ✅ Add structured logging (Winston)
6. ✅ Set up Grafana dashboard templates
7. ✅ Add Docker production image (multi-stage build)
8. ✅ Write deployment documentation
9. ✅ Add load testing with k6/artillery
10. ✅ Security audit (npm audit, Snyk)

**Deliverables:**
- Production-ready Docker image
- Prometheus + Grafana monitoring
- Security hardening complete
- Load test results documented

---

## Production Deployment Strategy

### Deployment Options

#### Option 1: Docker Compose (Small Scale)

**Best for:** Single server, <1000 workflows, <10k webhooks/day

```yaml
# docker-compose.yml
version: '3.8'

services:
  redfireforge-server:
    image: redfireforge/server:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:pass@db:5432/redfireforge
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - PORT=3001
      - WORKER_CONCURRENCY=5
    volumes:
      - ./data:/app/data
    depends_on:
      - db
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=redfireforge
      - POSTGRES_USER=redfireforge
      - POSTGRES_PASSWORD=changeme
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - redfireforge-server
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
```

**Deployment Steps:**
```bash
# 1. Clone repo
git clone https://github.com/your-org/redfireforge.git
cd redfireforge

# 2. Configure environment
cp .env.example .env
# Edit .env with production values

# 3. Start services
docker-compose up -d

# 4. Run migrations
docker-compose exec redfireforge-server npm run migrate

# 5. Verify health
curl http://localhost:3001/health
```

---

#### Option 2: Kubernetes (Large Scale)

**Best for:** High availability, >1000 workflows, >100k webhooks/day

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redfireforge-server
spec:
  replicas: 3  # Horizontal scaling
  selector:
    matchLabels:
      app: redfireforge-server
  template:
    metadata:
      labels:
        app: redfireforge-server
    spec:
      containers:
      - name: server
        image: redfireforge/server:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: redfireforge-secrets
              key: database-url
        - name: REDIS_HOST
          value: "redis-service"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: redfireforge-service
spec:
  type: LoadBalancer
  selector:
    app: redfireforge-server
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: redfireforge-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: redfireforge-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Deployment Steps:**
```bash
# 1. Create namespace
kubectl create namespace redfireforge

# 2. Create secrets
kubectl create secret generic redfireforge-secrets \
  --from-literal=database-url="postgres://..." \
  --from-literal=api-key="xxx" \
  -n redfireforge

# 3. Deploy
kubectl apply -f k8s/ -n redfireforge

# 4. Verify
kubectl get pods -n redfireforge
kubectl logs -f deployment/redfireforge-server -n redfireforge

# 5. Get load balancer IP
kubectl get svc redfireforge-service -n redfireforge
```

---

#### Option 3: Systemd Service (Bare Metal)

**Best for:** On-premise servers, single machine, tight control

```bash
# /etc/systemd/system/redfireforge.service
[Unit]
Description=RedfireForge Workflow Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=redfireforge
WorkingDirectory=/opt/redfireforge
Environment="NODE_ENV=production"
Environment="PORT=3001"
EnvironmentFile=/opt/redfireforge/.env
ExecStart=/usr/bin/node /opt/redfireforge/dist-server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=redfireforge

[Install]
WantedBy=multi-user.target
```

**Deployment Steps:**
```bash
# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Create user
sudo useradd -r -s /bin/false redfireforge

# 3. Install app
sudo mkdir -p /opt/redfireforge
cd /opt/redfireforge
sudo git clone https://github.com/your-org/redfireforge.git .
sudo npm ci --production
sudo npm run build:server

# 4. Configure environment
sudo cp .env.example .env
sudo nano .env  # Set production values

# 5. Set permissions
sudo chown -R redfireforge:redfireforge /opt/redfireforge

# 6. Install systemd service
sudo cp redfireforge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable redfireforge
sudo systemctl start redfireforge

# 7. Verify
sudo systemctl status redfireforge
sudo journalctl -u redfireforge -f
```

---

### Cloud Provider Guides

#### AWS Deployment

```bash
# Option A: ECS Fargate (Serverless)
aws ecs create-cluster --cluster-name redfireforge
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs create-service --cluster redfireforge --service-name redfireforge-server \
  --task-definition redfireforge --desired-count 3 --launch-type FARGATE

# Option B: EC2 + Docker
aws ec2 run-instances --image-id ami-xxx --instance-type t3.medium \
  --user-data file://install-docker.sh
# SSH in and run docker-compose
```

**Resources:**
- RDS PostgreSQL for database
- ElastiCache Redis for queue
- ALB for load balancing
- Route 53 for DNS
- ACM for SSL certificates

---

#### Azure Deployment

```bash
# Option A: Container Apps (Serverless)
az containerapp create \
  --name redfireforge-server \
  --resource-group redfireforge-rg \
  --environment redfireforge-env \
  --image redfireforge/server:latest \
  --target-port 3001 \
  --ingress external \
  --min-replicas 3 \
  --max-replicas 20

# Option B: AKS (Kubernetes)
az aks create --resource-group redfireforge-rg --name redfireforge-aks \
  --node-count 3 --enable-addons monitoring --generate-ssh-keys
az aks get-credentials --resource-group redfireforge-rg --name redfireforge-aks
kubectl apply -f k8s/
```

**Resources:**
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Application Gateway for load balancing
- Azure DNS for domains
- Key Vault for secrets

---

#### GCP Deployment

```bash
# Option A: Cloud Run (Serverless)
gcloud run deploy redfireforge-server \
  --image redfireforge/server:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 3 \
  --max-instances 20 \
  --port 3001

# Option B: GKE (Kubernetes)
gcloud container clusters create redfireforge-cluster \
  --num-nodes 3 --machine-type n1-standard-2
gcloud container clusters get-credentials redfireforge-cluster
kubectl apply -f k8s/
```

**Resources:**
- Cloud SQL (PostgreSQL)
- Memorystore (Redis)
- Cloud Load Balancing
- Cloud DNS
- Secret Manager

---

### SSL/TLS Configuration

**Let's Encrypt with Certbot (Free SSL):**

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d webhooks.example.com

# Auto-renewal (runs daily)
sudo systemctl enable certbot.timer
```

**Nginx SSL Config:**

```nginx
server {
    listen 443 ssl http2;
    server_name webhooks.example.com;

    ssl_certificate /etc/letsencrypt/live/webhooks.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webhooks.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Security Considerations

### 1. Authentication & Authorization

**API Key Authentication:**

```typescript
// src-server/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  req.user = getUserFromApiKey(apiKey);  // Attach user context
  next();
}

// Apply to management endpoints
app.use('/api/workflows', requireApiKey);
app.use('/api/webhooks', requireApiKey);
app.use('/api/schedules', requireApiKey);
```

**Webhook Signature Validation (HMAC-SHA256):**

```typescript
import crypto from 'crypto';

export function validateWebhookSignature(
  payload: unknown,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(payloadStr);
  const expectedSignature = `${algorithm}=${hmac.digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

### 2. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Webhook endpoint rate limiter
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 100,  // 100 requests per minute per IP
  message: 'Too many webhook requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/webhooks', webhookLimiter);

// Management API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,  // 1000 requests per 15 minutes
});

app.use('/api', apiLimiter);
```

---

### 3. Input Validation

```typescript
import { z } from 'zod';

const WebhookTriggerSchema = z.object({
  workflowId: z.string().uuid(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().regex(/^\/[a-zA-Z0-9\-_/]*$/),
  extractVariables: z.array(z.object({
    name: z.string().min(1),
    jsonPath: z.string().min(1),
  })),
});

app.post('/api/webhooks', (req, res) => {
  const result = WebhookTriggerSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors });
  }

  // Proceed with validated data
  const trigger = result.data;
  // ...
});
```

---

### 4. Secrets Management

**Docker Secrets:**

```yaml
# docker-compose.yml
services:
  redfireforge-server:
    secrets:
      - db_password
      - api_key
    environment:
      - DATABASE_PASSWORD_FILE=/run/secrets/db_password
      - API_KEY_FILE=/run/secrets/api_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    file: ./secrets/api_key.txt
```

**Kubernetes Secrets:**

```bash
# Create secret
kubectl create secret generic redfireforge-secrets \
  --from-literal=database-password="xxx" \
  --from-literal=api-key="yyy" \
  -n redfireforge

# Reference in deployment
env:
- name: DATABASE_PASSWORD
  valueFrom:
    secretKeyRef:
      name: redfireforge-secrets
      key: database-password
```

**HashiCorp Vault:**

```typescript
import Vault from 'node-vault';

const vault = Vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

// Fetch secrets at startup
const secrets = await vault.read('secret/data/redfireforge');
const dbPassword = secrets.data.data.db_password;
```

---

### 5. Network Security

**Firewall Rules:**

```bash
# Allow only HTTPS traffic to webhook server
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable

# Restrict database access to localhost
sudo ufw deny 5432/tcp
```

**Private Network (Docker):**

```yaml
# docker-compose.yml
services:
  postgres:
    networks:
      - internal  # Not exposed to internet

  redis:
    networks:
      - internal

  redfireforge-server:
    networks:
      - internal
      - external  # Exposed to internet

networks:
  internal:
    driver: bridge
  external:
    driver: bridge
```

---

## Scaling & Performance

### Horizontal Scaling

**Multi-Instance Deployment:**

```yaml
# docker-compose.yml
services:
  redfireforge-server:
    image: redfireforge/server:latest
    deploy:
      replicas: 5  # Run 5 instances
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
    environment:
      - WORKER_CONCURRENCY=10  # 10 concurrent workflows per instance
```

**Total Capacity:** 5 instances × 10 workers = **50 concurrent workflows**

---

### Performance Benchmarks

**Target Metrics:**

| Metric | Target | Notes |
|--------|--------|-------|
| Webhook response time | <100ms | 99th percentile, includes queue time |
| Workflow execution time | Varies | Depends on HTTP steps, aim <30s |
| Concurrent workflows | 50+ | With 5 instances @ 10 workers each |
| Webhooks/second | 1000+ | Rate limited per IP |
| Queue latency | <500ms | Time from enqueue to worker pickup |
| Database queries | <10ms | Local network, indexed queries |

**Load Testing:**

```bash
# Use k6 for load testing
cat << EOF > load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
};

export default function () {
  const payload = JSON.stringify({
    orderId: 'ORD-12345',
    customerId: '1',
    totalAmount: 59.98,
  });

  const res = http.post(
    'https://webhooks.example.com/webhooks/workflow-123/trigger-456',
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'status is 202': (r) => r.status === 202,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
}
EOF

k6 run load-test.js
```

---

### Caching Strategy

**Redis Caching:**

```typescript
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL,
});

// Cache workflow definitions (30 min TTL)
export async function getWorkflowCached(workflowId: string) {
  const cacheKey = `workflow:${workflowId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const workflow = await getWorkflow(workflowId);  // DB query
  await redis.setEx(cacheKey, 1800, JSON.stringify(workflow));  // Cache for 30 min
  
  return workflow;
}

// Invalidate cache when workflow updated
export async function updateWorkflow(workflowId: string, updates: Partial<Workflow>) {
  await saveWorkflow(workflowId, updates);
  await redis.del(`workflow:${workflowId}`);  // Invalidate cache
}
```

---

## Monitoring & Observability

### Metrics (Prometheus)

**File:** `src-server/metrics.ts`

```typescript
import client from 'prom-client';

// Register default metrics (CPU, memory, event loop lag)
client.collectDefaultMetrics();

// Custom metrics
export const webhookRequestsTotal = new client.Counter({
  name: 'redfireforge_webhook_requests_total',
  help: 'Total number of webhook requests received',
  labelNames: ['workflow_id', 'trigger_id', 'method', 'status'],
});

export const workflowExecutionDuration = new client.Histogram({
  name: 'redfireforge_workflow_execution_duration_seconds',
  help: 'Workflow execution duration in seconds',
  labelNames: ['workflow_id', 'status'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
});

export const queueJobsActive = new client.Gauge({
  name: 'redfireforge_queue_jobs_active',
  help: 'Number of jobs currently being processed',
});

export const queueJobsWaiting = new client.Gauge({
  name: 'redfireforge_queue_jobs_waiting',
  help: 'Number of jobs waiting in queue',
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

**Instrumentation:**

```typescript
// In webhook handler
webhookRequestsTotal.inc({ 
  workflow_id: workflowId, 
  trigger_id: triggerId, 
  method, 
  status: '202' 
});

// In workflow executor
const endTimer = workflowExecutionDuration.startTimer({ workflow_id: workflowId });
try {
  // Execute workflow
  const results = await runWorkflow(...);
  endTimer({ status: 'success' });
} catch (error) {
  endTimer({ status: 'error' });
}
```

---

### Grafana Dashboard

**Example Dashboard JSON:** (truncated for brevity)

```json
{
  "dashboard": {
    "title": "RedfireForge Workflow Server",
    "panels": [
      {
        "title": "Webhook Request Rate",
        "targets": [
          {
            "expr": "rate(redfireforge_webhook_requests_total[5m])",
            "legendFormat": "{{workflow_id}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Workflow Execution Duration (p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(redfireforge_workflow_execution_duration_seconds_bucket[5m]))",
            "legendFormat": "{{workflow_id}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Queue Depth",
        "targets": [
          {
            "expr": "redfireforge_queue_jobs_waiting",
            "legendFormat": "Waiting"
          },
          {
            "expr": "redfireforge_queue_jobs_active",
            "legendFormat": "Active"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

### Structured Logging

**File:** `src-server/logger.ts`

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'redfireforge-server' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Usage
logger.info('Webhook received', { 
  workflow_id: workflowId, 
  trigger_id: triggerId, 
  method, 
  ip: req.ip 
});

logger.error('Workflow execution failed', { 
  workflow_id: workflowId, 
  error: error.message, 
  stack: error.stack 
});
```

---

### Alerting Rules (Prometheus)

```yaml
# prometheus/alerts.yml
groups:
- name: redfireforge
  interval: 30s
  rules:
  - alert: HighWebhookErrorRate
    expr: |
      rate(redfireforge_webhook_requests_total{status!="202"}[5m]) > 10
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High webhook error rate ({{ $value }} errors/sec)"
      description: "Workflow {{ $labels.workflow_id }} has {{ $value }} webhook errors per second"

  - alert: QueueBacklogHigh
    expr: redfireforge_queue_jobs_waiting > 1000
    for: 10m
    labels:
      severity: critical
    annotations:
      summary: "Queue backlog high ({{ $value }} jobs waiting)"
      description: "Workflow execution queue has {{ $value }} jobs waiting. Consider scaling up workers."

  - alert: WorkflowExecutionSlow
    expr: |
      histogram_quantile(0.99, rate(redfireforge_workflow_execution_duration_seconds_bucket[5m])) > 60
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Slow workflow execution (p99 > 60s)"
      description: "Workflow {{ $labels.workflow_id }} p99 latency is {{ $value }}s"
```

---

## Migration Path

### Phase 1: Desktop-Only (Current)

- ✅ Users run Tauri app locally
- ✅ Workflows execute in browser/desktop context
- ✅ Data stored in localStorage/AppData
- ✅ No webhooks/schedules (manual trigger only)

### Phase 2: Hybrid Mode (Phase 5.1-5.4)

- ✅ Server deployed separately (optional)
- ✅ Desktop app can "publish" workflows to server
- ✅ Server handles webhooks/schedules
- ✅ Desktop app polls execution history from server
- 🔄 Two data stores: local (desktop) + remote (server)

### Phase 3: Server-First (Future)

- 🔮 Desktop app becomes thin client
- 🔮 All workflows stored on server
- 🔮 Desktop app is workflow designer only
- 🔮 Multi-user collaboration support
- 🔮 Role-based access control (RBAC)

---

## Summary & Next Steps

### Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 5.1** | 2 weeks | Server foundation + database |
| **Phase 5.2** | 2 weeks | Webhook server functional |
| **Phase 5.3** | 2 weeks | Workflow execution working |
| **Phase 5.4** | 2 weeks | Cron scheduler complete |
| **Phase 5.5** | 2 weeks | Management API + docs |
| **Phase 5.6** | 2 weeks | UI integration |
| **Phase 5.7** | 2 weeks | Production hardening |
| **Total** | **14 weeks** (~3.5 months) | Full Phase 5 complete |

---

### Key Decision Points

**Before Starting:**

1. **Deployment Model**: Docker Compose, Kubernetes, or systemd?
   - **Recommendation**: Start with Docker Compose, migrate to K8s if needed
2. **Database**: PostgreSQL or SQLite?
   - **Recommendation**: PostgreSQL for production, SQLite for dev/testing
3. **Queue**: BullMQ (Redis) or alternatives (RabbitMQ, AWS SQS)?
   - **Recommendation**: BullMQ (best Node.js integration, great UI)
4. **Hosting**: Self-hosted or cloud (AWS/Azure/GCP)?
   - **Recommendation**: Cloud (easier scaling), self-hosted for on-prem requirement

**Architecture Principles:**

- ✅ **Stateless servers**: All state in database/Redis (enables horizontal scaling)
- ✅ **Async execution**: Webhook responses immediate, workflows queued
- ✅ **At-least-once delivery**: Jobs retried on failure, idempotency important
- ✅ **Observability first**: Metrics, logs, tracing from day 1
- ✅ **Security by default**: API keys, rate limiting, input validation

---

### Success Criteria

Phase 5 is complete when:

- [ ] Webhook server accepts HTTP requests and enqueues workflows
- [ ] Workflows execute successfully from queue
- [ ] Cron scheduler triggers workflows on schedule
- [ ] Management API fully functional with authentication
- [ ] UI can deploy workflows and view execution history
- [ ] Docker Compose deployment works out-of-box
- [ ] Kubernetes deployment guide documented
- [ ] Prometheus metrics + Grafana dashboards operational
- [ ] Load testing shows 1000+ webhooks/sec capacity
- [ ] Security audit passes (no critical vulnerabilities)
- [ ] Documentation complete (architecture, deployment, API)

---

### Open Questions

1. **Multi-tenancy**: Support multiple organizations/teams on single server?
2. **Workflow versioning**: Track changes to workflows, rollback capability?
3. **Secrets management**: Integrate with external secret stores (Vault, AWS Secrets Manager)?
4. **Workflow marketplace**: Share/import workflows from community?
5. **Real-time updates**: WebSocket for live execution status in UI?
6. **Distributed tracing**: OpenTelemetry integration for request tracing?

---

## Appendix

### A. Example Workflow Execution Flow

```
1. External system sends POST to /webhooks/wf-123/trigger-456
   └─> Webhook server receives request (10ms)
       ├─> Validates method, signature (5ms)
       ├─> Extracts variables via JSONPath (5ms)
       ├─> Enqueues job in Redis (2ms)
       └─> Returns 202 Accepted (total: 22ms)

2. BullMQ worker picks up job from queue (latency: 100-500ms)
   └─> Loads workflow definition from DB (cache hit: 2ms)
       ├─> Creates VariableContext with extracted vars
       ├─> Calls graphRunner.ts to execute workflow
       │   └─> HTTP step 1: GET /users/1 (120ms)
       │   └─> Condition step: Check status (1ms)
       │   └─> HTTP step 2: POST /posts (150ms)
       │   └─> End node (1ms)
       ├─> Saves execution results to DB (10ms)
       └─> Job complete (total workflow time: 284ms)

3. UI polls /api/executions?workflowId=wf-123
   └─> Returns execution history with results
```

---

### B. Cost Estimation (AWS Example)

**Small Deployment** (100 workflows, 1k webhooks/day):

| Service | Resource | Cost/month |
|---------|----------|------------|
| EC2 | t3.small (2 vCPU, 2 GB RAM) | $15 |
| RDS PostgreSQL | db.t3.micro (1 vCPU, 1 GB RAM) | $15 |
| ElastiCache Redis | cache.t3.micro (1 vCPU, 0.5 GB RAM) | $12 |
| ALB | Application Load Balancer | $20 |
| Data transfer | 50 GB/month | $5 |
| **Total** | | **~$67/month** |

**Medium Deployment** (1000 workflows, 100k webhooks/day):

| Service | Resource | Cost/month |
|---------|----------|------------|
| ECS Fargate | 3 tasks (1 vCPU, 2 GB each) | $60 |
| RDS PostgreSQL | db.t3.small (2 vCPU, 2 GB RAM) | $30 |
| ElastiCache Redis | cache.t3.small (2 vCPU, 1.5 GB RAM) | $40 |
| ALB | Application Load Balancer | $20 |
| Data transfer | 500 GB/month | $45 |
| **Total** | | **~$195/month** |

**Large Deployment** (10k workflows, 1M webhooks/day):

| Service | Resource | Cost/month |
|---------|----------|------------|
| EKS Cluster | 10 nodes (t3.medium) | $300 |
| RDS PostgreSQL | db.r5.large (2 vCPU, 16 GB RAM, Multi-AZ) | $250 |
| ElastiCache Redis | cache.r5.large (2 vCPU, 13 GB RAM) | $150 |
| ALB | Application Load Balancer | $20 |
| Data transfer | 5 TB/month | $430 |
| **Total** | | **~$1,150/month** |

---

### C. Comparison with Alternatives

| Feature | RedfireForge Phase 5 | Zapier | n8n | Temporal |
|---------|---------------------|--------|-----|----------|
| **Self-hosted** | ✅ | ❌ | ✅ | ✅ |
| **Webhook triggers** | ✅ | ✅ | ✅ | ✅ |
| **Cron schedules** | ✅ | ✅ | ✅ | ✅ |
| **Visual workflow designer** | ✅ | ✅ | ✅ | ❌ (code-first) |
| **API testing focus** | ✅ | ❌ | ❌ | ❌ |
| **Open source** | ✅ | ❌ | ✅ | ✅ |
| **Horizontal scaling** | ✅ | ✅ | ⚠️ (limited) | ✅ |
| **Execution history** | ✅ | ✅ | ✅ | ✅ |
| **Retry policies** | ✅ | ✅ | ✅ | ✅ |
| **Load testing mode** | ✅ | ❌ | ❌ | ❌ |
| **Desktop app** | ✅ | ❌ | ❌ | ❌ |

**Unique Value Proposition:**
- RedfireForge is the **only tool** that combines workflow automation with performance testing
- Desktop app + server mode flexibility (start local, scale to cloud)
- API-first design with built-in validation, variable extraction, and load profiling

---

## Conclusion

Phase 5 transforms RedfireForge from a **desktop testing tool** into a **production-grade workflow automation platform**. The architecture is designed for:

- ✅ **Reliability**: At-least-once delivery, retry policies, health checks
- ✅ **Scalability**: Horizontal scaling, job queue, stateless servers
- ✅ **Security**: API keys, rate limiting, webhook signatures, input validation
- ✅ **Observability**: Metrics, logs, alerts, distributed tracing
- ✅ **Flexibility**: Docker, K8s, systemd deployment options
- ✅ **Performance**: <100ms webhook responses, 1000+ requests/sec

**Next Step:** Review this design with the team, gather feedback, and begin Phase 5.1 implementation.

---

**Document Version:** 1.0  
**Last Updated:** April 23, 2026  
**Status:** Ready for Review
