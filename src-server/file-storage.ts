import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import type { Workflow } from '../src/types/workflow.js';

// ── Type Definitions ──────────────────────────────────────────────────

export interface ExecutionResult {
  id: string;
  workflowId: string;
  triggerId: string;
  triggerType: 'webhook' | 'schedule';
  status: 'success' | 'failed' | 'error';
  duration: number;
  results: Array<{
    url: string;
    statusCode: number;
    responseTime: number;
    body?: string;
  }>;
  variables: Record<string, unknown>;
  timestamp: string;
  error?: string;
}

export interface WebhookDelivery {
  triggerId: string;
  method: string;
  payload: unknown;
  status: 'success' | 'failed' | 'error';
  duration?: number;
  timestamp: string;
  error?: string;
}

export interface ScheduleTrigger {
  id: string;
  workflowId: string;
  nodeId: string;
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  inputVariables?: Record<string, string>;
}

export interface WebhookTrigger {
  id: string;
  workflowId: string;
  nodeId: string;
  enabled: boolean;
  method: string;
  path: string;
}

// ── AppData Path Resolution ───────────────────────────────────────────

/**
 * Get the AppData path for the application (same as Tauri uses).
 * - macOS: ~/Library/Application Support/redfireforge
 * - Windows: %APPDATA%/redfireforge
 * - Linux: ~/.local/share/redfireforge
 */
export function getAppDataPath(): string {
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

// ── Workflow Storage ──────────────────────────────────────────────────

/**
 * Load a workflow from JSON file.
 */
export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const path = join(getAppDataPath(), 'workflows', `${id}.json`);
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data) as Workflow;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Save a workflow to JSON file so the webhook server can execute it.
 */
export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const dir = join(getAppDataPath(), 'workflows');
  await fs.mkdir(dir, { recursive: true });
  const path = join(dir, `${workflow.id}.json`);
  await fs.writeFile(path, JSON.stringify(workflow, null, 2));
}

/**
 * List all workflow IDs.
 */
export async function listWorkflows(): Promise<string[]> {
  try {
    const workflowsDir = join(getAppDataPath(), 'workflows');
    const files = await fs.readdir(workflowsDir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// ── Execution Results Storage ─────────────────────────────────────────

/**
 * Save execution result to dated folder.
 * Results are organized by date: executions/2026-04-23/exec-001.json
 */
export async function saveExecutionResult(result: ExecutionResult): Promise<void> {
  const date = new Date().toISOString().split('T')[0]; // "2026-04-23"
  const dir = join(getAppDataPath(), 'executions', date);

  await fs.mkdir(dir, { recursive: true });

  const filePath = join(dir, `${result.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(result, null, 2));
}

/**
 * Get execution history (most recent first).
 */
export async function getExecutionHistory(
  workflowId?: string,
  limit = 50
): Promise<ExecutionResult[]> {
  const execDir = join(getAppDataPath(), 'executions');

  try {
    // List date folders (2026-04-23, 2026-04-22, etc.)
    const dates = await fs.readdir(execDir);
    dates.sort().reverse(); // Newest first

    const executions: ExecutionResult[] = [];

    for (const date of dates) {
      if (executions.length >= limit) break;

      const datePath = join(execDir, date);
      const stat = await fs.stat(datePath);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(datePath);

      for (const file of files) {
        if (executions.length >= limit) break;
        if (!file.endsWith('.json')) continue;

        const execPath = join(datePath, file);
        const data = await fs.readFile(execPath, 'utf-8');
        const execution: ExecutionResult = JSON.parse(data);

        if (!workflowId || execution.workflowId === workflowId) {
          executions.push(execution);
        }
      }
    }

    return executions;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// ── Webhook Delivery Logs ─────────────────────────────────────────────

/**
 * Log webhook delivery (append to daily JSONL file).
 * Each line is a JSON object.
 */
export async function logWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const dir = join(getAppDataPath(), 'webhook-deliveries');
  const file = join(dir, `${date}.jsonl`);

  await fs.mkdir(dir, { recursive: true });

  const logLine = JSON.stringify(delivery) + '\n';
  await fs.appendFile(file, logLine);
}

/**
 * Read webhook deliveries for a specific date.
 */
export async function getWebhookDeliveries(date: string): Promise<WebhookDelivery[]> {
  try {
    const file = join(getAppDataPath(), 'webhook-deliveries', `${date}.jsonl`);
    const content = await fs.readFile(file, 'utf-8');

    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as WebhookDelivery);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// ── Schedule Triggers Storage ─────────────────────────────────────────

/**
 * Load all schedule triggers from JSON file.
 */
export async function loadScheduleTriggers(): Promise<ScheduleTrigger[]> {
  try {
    const triggersPath = join(getAppDataPath(), 'triggers', 'schedule-triggers.json');
    const data = await fs.readFile(triggersPath, 'utf-8');
    return JSON.parse(data) as ScheduleTrigger[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Save schedule triggers to JSON file.
 */
export async function saveScheduleTriggers(triggers: ScheduleTrigger[]): Promise<void> {
  const triggersDir = join(getAppDataPath(), 'triggers');
  await fs.mkdir(triggersDir, { recursive: true });

  const triggersPath = join(triggersDir, 'schedule-triggers.json');
  await fs.writeFile(triggersPath, JSON.stringify(triggers, null, 2));
}

// ── Webhook Triggers Storage ──────────────────────────────────────────

/**
 * Load all webhook triggers from JSON file.
 */
export async function loadWebhookTriggers(): Promise<WebhookTrigger[]> {
  try {
    const triggersPath = join(getAppDataPath(), 'triggers', 'webhook-triggers.json');
    const data = await fs.readFile(triggersPath, 'utf-8');
    return JSON.parse(data) as WebhookTrigger[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Save webhook triggers to JSON file.
 */
export async function saveWebhookTriggers(triggers: WebhookTrigger[]): Promise<void> {
  const triggersDir = join(getAppDataPath(), 'triggers');
  await fs.mkdir(triggersDir, { recursive: true });

  const triggersPath = join(triggersDir, 'webhook-triggers.json');
  await fs.writeFile(triggersPath, JSON.stringify(triggers, null, 2));
}
