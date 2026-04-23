# Phase 5: Simple Webhook & Schedule Runtime

> **Lightweight Extension for Performance Workbench Desktop App**  
> **No Database • No Infrastructure • Local-First**
> 
> Status: 📋 Design Phase  
> Date: April 23, 2026

---

## Executive Summary

**Objective:** Add webhook HTTP server and cron scheduler to the existing Tauri desktop app as a **lightweight companion process**.

**Philosophy: Simple Extension, Not Production Server**

- ✅ Runs locally on user's machine (localhost:3001)
- ✅ File-based storage (JSON files in AppData)
- ✅ Auto-starts with Tauri app, auto-stops when closed
- ✅ Zero configuration required
- ✅ No database, no Redis, no Docker
- ✅ Single-user, development/testing focus

**Use Cases:**
- Test webhooks from Insomnia/Postman locally
- Schedule workflows to run daily reports
- Automate repetitive API testing tasks
- Learn webhook/schedule concepts before production deployment

---

## Architecture Overview

### Two-Process Design

```
┌──────────────────────────────────────────────────────────┐
│           Tauri App (Port 5173) - EXISTING               │
│  • Workflow Designer UI                                  │
│  • Manual workflow execution                             │
│  • Data stored in AppData                                │
└────────────────────┬─────────────────────────────────────┘
                     │ Spawns on startup
                     ▼
┌──────────────────────────────────────────────────────────┐
│        Node.js Companion Server (Port 3001) - NEW        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Webhook Server (Express.js)                        │  │
│  │  • GET/POST/PUT/PATCH /webhooks/:wfId/:triggerId  │  │
│  │  • Extracts variables from body/headers/query     │  │
│  │  • Executes workflow synchronously                │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Cron Scheduler (node-cron)                         │  │
│  │  • Loads schedules from JSON file                  │  │
│  │  • Runs workflows at scheduled times               │  │
│  │  • Supports timezone-aware cron expressions        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              AppData/redfireforge/                       │
│  workflows/         # Existing workflow JSON files       │
│  triggers/          # NEW: webhook-triggers.json         │
│    └─ schedule-triggers.json                             │
│  executions/        # NEW: Dated execution results       │
│    └─ 2026-04-23/exec-001.json                           │
│  webhook-deliveries/  # NEW: Daily JSONL logs            │
│  server.log         # NEW: Server startup log            │
└──────────────────────────────────────────────────────────┘
```

---

## Technology Stack (Minimal)

| Component | Technology | Size | Why? |
|-----------|-----------|------|------|
| HTTP Server | Express.js | 14KB | Industry standard, simple API |
| Scheduler | node-cron | 36KB | Pure JS, no dependencies |
| Storage | Node.js `fs` | Built-in | JSON files, no setup |
| IPC | HTTP (localhost) | Built-in | Simple communication |

**Total New Dependencies:** 2 packages (express, node-cron)  
**Memory Overhead:** ~30-50MB  
**Startup Time:** <500ms

---

## Component Design

### 1. Webhook Server (Synchronous Execution)

**File:** `src-server/webhook-server.ts` (new file)

```typescript
import express from 'express';
import { getWorkflow, saveExecutionResult, logWebhookDelivery } from './file-storage';
import { runWorkflow } from '../engine/workflow/workflowRunner';
import { VariableContext } from '../engine/workflow/variableContext';
import { extractWebhookVariables } from './webhook-extractor';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: 3001, timestamp: new Date().toISOString() });
});

// Webhook endpoint (executes workflow synchronously)
app.all('/webhooks/:workflowId/:triggerId', async (req, res) => {
  const { workflowId, triggerId } = req.params;
  const startTime = Date.now();

  try {
    // 1. Load workflow from AppData JSON file
    const workflow = await getWorkflow(workflowId);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // 2. Find webhook trigger node
    const triggerNode = workflow.nodes.find(n => n.id === triggerId && n.type === 'webhook');
    if (!triggerNode) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    // 3. Extract variables from request
    const extracted = extractWebhookVariables(
      triggerNode.data.extractVariables,
      { body: req.body, headers: req.headers, query: req.query }
    );

    // 4. Execute workflow immediately (no queue)
    const ctx = new VariableContext(workflow.variables);
    Object.entries(extracted).forEach(([k, v]) => ctx.set(k, v));

    const results = await runWorkflow(workflow.steps, { timeoutMs: 30000 }, ctx);

    // 5. Save execution result to JSON
    await saveExecutionResult({
      id: `${workflowId}-${Date.now()}`,
      workflowId,
      triggerId,
      type: 'webhook',
      duration: Date.now() - startTime,
      status: results.some(r => r.statusCode >= 400) ? 'failed' : 'success',
      results,
      variables: extracted,
      timestamp: new Date().toISOString(),
    });

    // 6. Log delivery
    await logWebhookDelivery({
      triggerId,
      method: req.method,
      payload: req.body,
      status: 'success',
      timestamp: new Date().toISOString(),
    });

    // 7. Return results
    res.json({ message: 'Workflow executed', duration: Date.now() - startTime, results });

  } catch (error) {
    await logWebhookDelivery({
      triggerId,
      method: req.method,
      error: error.message,
      status: 'error',
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ error: error.message });
  }
});

// Start server on localhost only
const PORT = 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Webhook Server] http://127.0.0.1:${PORT}`);
});
```

**Key Points:**
- **Synchronous**: No job queue, executes immediately (simpler)
- **Localhost-only**: `127.0.0.1` binding (not `0.0.0.0`)
- **~80 lines**: Much simpler than production versions
- **File-based**: No database queries

---

### 2. File Storage (JSON Files)

**File:** `src-server/file-storage.ts` (new file)

```typescript
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

// Get AppData path (same as existing Tauri storage)
function getAppDataPath(): string {
  const platform = os.platform();
  const home = os.homedir();
  
  if (platform === 'darwin') {
    return join(home, 'Library/Application Support/redfireforge');
  } else if (platform === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData/Roaming'), 'redfireforge');
  } else {
    return join(home, '.local/share/redfireforge');
  }
}

// Load workflow
export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const path = join(getAppDataPath(), 'workflows', `${id}.json`);
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Save execution result (organized by date)
export async function saveExecutionResult(result: ExecutionResult): Promise<void> {
  const date = new Date().toISOString().split('T')[0]; // "2026-04-23"
  const dir = join(getAppDataPath(), 'executions', date);
  
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, `${result.id}.json`), JSON.stringify(result, null, 2));
}

// Log webhook delivery (append to daily JSONL file)
export async function logWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const dir = join(getAppDataPath(), 'webhook-deliveries');
  const file = join(dir, `${date}.jsonl`);
  
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(file, JSON.stringify(delivery) + '\n');
}
```

**File Structure:**
```
~/Library/Application Support/redfireforge/  (macOS)
├─ workflows/
│  ├─ workflow-123.json
│  └─ workflow-456.json
├─ triggers/
│  ├─ webhook-triggers.json
│  └─ schedule-triggers.json
├─ executions/
│  ├─ 2026-04-23/
│  │  ├─ exec-001.json
│  │  └─ exec-002.json
│  └─ 2026-04-24/
└─ webhook-deliveries/
   └─ 2026-04-23.jsonl
```

---

### 3. Cron Scheduler

**File:** `src-server/cron-scheduler.ts` (new file)

```typescript
import cron from 'node-cron';
import { loadScheduleTriggers, getWorkflow, saveExecutionResult } from './file-storage';
import { runWorkflow } from '../engine/workflow/workflowRunner';
import { VariableContext } from '../engine/workflow/variableContext';

const activeJobs = new Map<string, cron.ScheduledTask>();

// Initialize scheduler on server start
export async function initScheduler() {
  const triggers = await loadScheduleTriggers();
  
  for (const trigger of triggers) {
    if (trigger.enabled) {
      registerSchedule(trigger);
    }
  }
  
  console.log(`[Scheduler] Loaded ${activeJobs.size} schedules`);
}

// Register a single schedule
function registerSchedule(trigger: ScheduleTrigger) {
  const task = cron.schedule(
    trigger.cronExpression,
    async () => {
      console.log(`[Scheduler] Triggered: ${trigger.workflowId}`);
      
      const workflow = await getWorkflow(trigger.workflowId);
      if (!workflow) return;

      // Inject automatic time variables
      const now = new Date();
      const ctx = new VariableContext({
        ...workflow.variables,
        ...trigger.inputVariables,
        triggerTime: now.toISOString(),  // "2026-04-23T09:00:00.000Z"
        triggerTimestamp: String(Math.floor(now.getTime() / 1000)),  // "1714737600"
      });

      try {
        const results = await runWorkflow(workflow.steps, { timeoutMs: 30000 }, ctx);
        
        await saveExecutionResult({
          id: `${trigger.workflowId}-${Date.now()}`,
          workflowId: trigger.workflowId,
          triggerId: trigger.id,
          type: 'schedule',
          status: 'success',
          results,
          timestamp: now.toISOString(),
        });
      } catch (error) {
        console.error('[Scheduler] Execution failed:', error);
      }
    },
    { timezone: trigger.timezone || 'UTC' }
  );

  activeJobs.set(trigger.id, task);
}

// Reload schedules (called when user updates schedules in UI)
export async function reloadSchedules() {
  // Stop all existing
  for (const task of activeJobs.values()) {
    task.stop();
  }
  activeJobs.clear();
  
  // Re-initialize
  await initScheduler();
}
```

**Key Features:**
- **Simple**: ~50 lines of code
- **Timezone-aware**: IANA timezone support (America/New_York, UTC, etc.)
- **Hot reload**: Can update schedules without restart
- **Automatic variables**: Injects `triggerTime` and `triggerTimestamp`

---

## Implementation Approach

### Phase 5.1: Server Foundation (Week 1)

**Goal:** Get basic HTTP server running

**Tasks:**
1. Create `src-server/` directory
2. Add dependencies: `npm install express node-cron`
3. Create `src-server/index.ts` (main entry point)
4. Implement `file-storage.ts` (AppData JSON file operations)
5. Implement `webhook-server.ts` (basic Express app)
6. Test: `curl http://localhost:3001/health`

**Deliverables:**
- Server starts on port 3001
- Health check endpoint works
- Can read workflows from AppData

---

### Phase 5.2: Webhook Functionality (Week 2)

**Goal:** Accept webhooks and execute workflows

**Tasks:**
1. Implement `webhook-extractor.ts` (JSONPath variable extraction)
2. Add webhook route `/webhooks/:wfId/:triggerId`
3. Integrate with existing `graphRunner.ts`
4. Implement `saveExecutionResult()` (JSON file storage)
5. Test with Insomnia: POST webhook → verify workflow runs

**Deliverables:**
- Webhooks trigger workflows successfully
- Variables extracted from payload
- Execution results saved to JSON

---

### Phase 5.3: Cron Scheduler (Week 3)

**Goal:** Run workflows on schedule

**Tasks:**
1. Implement `cron-scheduler.ts`
2. Create `loadScheduleTriggers()` (read from JSON)
3. Register cron jobs with timezone support
4. Inject automatic time variables
5. Test: Create schedule → wait for trigger → verify execution

**Deliverables:**
- Cron schedules registered correctly
- Workflows execute at scheduled times
- Timezone handling works

---

### Phase 5.4: Tauri Integration (Week 4)

**Goal:** Auto-start server with Tauri app

**Tasks:**
1. Add Tauri command to spawn Node.js server
2. Start server on app launch
3. Stop server on app close
4. Add UI indicator (server status: running/stopped)
5. Test: Launch app → server auto-starts

**Deliverables:**
- Server spawns automatically
- Graceful shutdown when app closes
- UI shows server status

---

### Phase 5.5: UI Integration (Week 5)

**Goal:** Manage triggers from UI

**Tasks:**
1. Add "Webhook URL" display in node config modal
2. Add "Enable/Disable" toggle for triggers
3. Add execution history viewer
4. Add webhook delivery logs viewer
5. Update E2E tests

**Deliverables:**
- Users can see webhook URLs
- Can enable/disable triggers from UI
- Can view execution history

---

## Desktop App Integration

### Auto-Start Server with Tauri

**File:** `src-tauri/src/lib.rs` (modify existing)

```rust
use tauri::{Manager, AppHandle};
use std::process::{Command, Child};
use std::sync::Mutex;

struct ServerProcess(Mutex<Option<Child>>);

fn start_webhook_server() -> Result<Child, std::io::Error> {
    // Start Node.js server as child process
    let child = Command::new("node")
        .arg("dist-server/index.js")
        .spawn()?;
    
    Ok(child)
}

#[tauri::command]
fn get_server_status() -> String {
    // Check if server is running
    "running".to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Start webhook server on app launch
            match start_webhook_server() {
                Ok(child) => {
                    app.manage(ServerProcess(Mutex::new(Some(child))));
                    println!("[Tauri] Webhook server started");
                }
                Err(e) => {
                    eprintln!("[Tauri] Failed to start webhook server: {}", e);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Key Points:**
- Server spawns as child process when Tauri app starts
- Server stops automatically when app closes (child process cleanup)
- UI can check server status via Tauri commands

---

## Local Testing & Deployment

### Development Mode

```bash
# Terminal 1: Start Tauri app (also starts webhook server)
npm run tauri:dev

# Terminal 2: Test webhook
curl -X POST http://localhost:3001/webhooks/wf-123/trigger-456 \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORD-12345", "customerId": "1", "totalAmount": 59.98}'
```

### Production Build

```bash
# Build both UI and server
npm run build
npm run build:server

# Create Tauri installer (bundles Node.js server)
npm run tauri:build

# Installer includes both:
# - Tauri app binary
# - Node.js server (dist-server/)
# - Auto-starts on launch
```

---

### Optional: Expose Webhooks to Internet (Testing)

**Using ngrok (free tunneling):**

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from ngrok.com

# Tunnel localhost:3001 to internet
ngrok http 3001

# Output:
# Forwarding: https://abc123.ngrok.io -> http://localhost:3001

# Now external systems can reach your webhook:
# POST https://abc123.ngrok.io/webhooks/wf-123/trigger-456
```

**Using Tailscale (VPN-based):**

```bash
# Install Tailscale
brew install tailscale  # macOS

# Share port with your Tailscale network
tailscale serve http://localhost:3001

# Accessible to your Tailscale devices at:
# http://your-machine.tailnet:3001/webhooks/...
```

---

## Future Scaling Path

### Current: Desktop Extension (Phase 5)

✅ **Pros:**
- Simple, no setup
- Runs locally, no infrastructure costs
- Perfect for testing and development
- Data stays on user's machine

⚠️ **Limitations:**
- Single-user only
- Laptop must stay on for schedules
- Webhooks only accessible via tunneling
- No high availability

---

### Future: Production Server (Optional Phase 6+)

When you need production deployment, upgrade to:

- **Database**: PostgreSQL for multi-user workflows
- **Job Queue**: BullMQ + Redis for async execution
- **Cloud Hosting**: AWS/Azure/GCP deployment
- **High Availability**: Kubernetes, load balancing
- **Multi-Tenant**: User authentication, RBAC

**Migration Path:**
1. Export workflows from desktop app (JSON)
2. Import into production server
3. Update webhook URLs to point to server
4. Keep desktop app for workflow design

See [phase5-runtime-architecture.md](./phase5-runtime-architecture.md) for full production architecture.

---

## Cost Comparison

| Approach | Infrastructure | Cost/month | Best For |
|----------|----------------|------------|----------|
| **Phase 5 (This)** | None (local) | $0 | Development, testing, single user |
| **Production Server** | Cloud VM + DB | $67-195 | Multiple users, always-on webhooks |
| **Enterprise** | Kubernetes + HA | $1,150+ | High scale, 24/7 uptime |

---

## Summary

**Phase 5 Simple Extension:**
- 🎯 **Goal**: Add webhook/schedule support to desktop app
- ⚡ **Approach**: Lightweight Node.js companion server
- 📁 **Storage**: JSON files (no database)
- 🏠 **Deployment**: Bundled with Tauri app
- ⏱️ **Timeline**: 5 weeks implementation
- 💰 **Cost**: $0 (runs locally)

**When to Use:**
- ✅ Testing webhooks from Insomnia/Postman
- ✅ Running scheduled reports locally
- ✅ Learning workflow automation concepts
- ✅ Single-user development environment

**When to Upgrade to Production:**
- 🔄 Need 24/7 uptime (webhooks from external systems)
- 🔄 Multiple team members sharing workflows
- 🔄 High webhook volume (>1000/day)
- 🔄 Compliance/audit requirements

---

**Next Steps:**
1. Review this simplified design
2. Approve approach (local-first vs. production-first)
3. Begin Phase 5.1 implementation

**Document Version:** 2.0 (Simplified)  
**Last Updated:** April 23, 2026
