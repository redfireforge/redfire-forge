import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import type { Workflow } from '../src/features/workflow/types/workflow';
import type {
  ExecutionResult,
  WebhookDelivery,
  ScheduleTrigger,
  WebhookTrigger,
} from '../src/shared/types/server-api';

export type { ExecutionResult, WebhookDelivery, ScheduleTrigger, WebhookTrigger };

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

// ── Generic file helpers ──────────────────────────────────────────────

/**
 * Read a JSON file and return parsed content, or return `defaultVal` if the file doesn't exist.
 * Re-throws any error other than ENOENT.
 */
export async function readJsonFileOrDefault<T>(filePath: string, defaultVal: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultVal;
    throw error;
  }
}

/**
 * Write JSON data to a file, creating parent directories if needed.
 */
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dir = join(filePath, '..');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// ── Workflow Storage ──────────────────────────────────────────────────

/**
 * Load a workflow from JSON file.
 */
export async function getWorkflow(id: string): Promise<Workflow | null> {
  const path = join(getAppDataPath(), 'workflows', `${id}.json`);
  return readJsonFileOrDefault<Workflow | null>(path, null);
}

/**
 * Save a workflow to JSON file so the webhook server can execute it.
 */
export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const path = join(getAppDataPath(), 'workflows', `${workflow.id}.json`);
  await writeJsonFile(path, workflow);
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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

// ── Execution Results Storage ─────────────────────────────────────────

/**
 * Save execution result to dated folder.
 * Results are organized by date: executions/2026-04-23/exec-001.json
 */
export async function saveExecutionResult(result: ExecutionResult): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const filePath = join(getAppDataPath(), 'executions', date, `${result.id}.json`);
  await writeJsonFile(filePath, result);
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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

// ── Schedule Triggers Storage ─────────────────────────────────────────

/**
 * Load all schedule triggers from JSON file.
 */
export async function loadScheduleTriggers(): Promise<ScheduleTrigger[]> {
  const path = join(getAppDataPath(), 'triggers', 'schedule-triggers.json');
  return readJsonFileOrDefault<ScheduleTrigger[]>(path, []);
}

/**
 * Save schedule triggers to JSON file.
 */
export async function saveScheduleTriggers(triggers: ScheduleTrigger[]): Promise<void> {
  const path = join(getAppDataPath(), 'triggers', 'schedule-triggers.json');
  await writeJsonFile(path, triggers);
}

// ── Webhook Triggers Storage ──────────────────────────────────────────

/**
 * Load all webhook triggers from JSON file.
 */
export async function loadWebhookTriggers(): Promise<WebhookTrigger[]> {
  const path = join(getAppDataPath(), 'triggers', 'webhook-triggers.json');
  return readJsonFileOrDefault<WebhookTrigger[]>(path, []);
}

/**
 * Save webhook triggers to JSON file.
 */
export async function saveWebhookTriggers(triggers: WebhookTrigger[]): Promise<void> {
  const path = join(getAppDataPath(), 'triggers', 'webhook-triggers.json');
  await writeJsonFile(path, triggers);
}
