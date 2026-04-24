import cron from 'node-cron';
import {
  loadScheduleTriggers,
  getWorkflow,
} from './file-storage.js';
import type { ScheduleTrigger } from '../src/types/server-api.js';
import { executeWorkflow, saveErrorResult } from './executeWorkflow.js';
import { generateExecutionId, getErrorMessage } from '../src/utils/serverFormatters.js';

// Map to keep track of active cron jobs
const activeJobs = new Map<string, cron.ScheduledTask>();

/**
 * Initialize the scheduler by loading all enabled schedule triggers from JSON file
 * and registering cron jobs for each.
 */
export async function initScheduler(): Promise<void> {
  console.log('[Scheduler] Initializing...');
  
  try {
    const triggers = await loadScheduleTriggers();
    
    if (triggers.length === 0) {
      console.log('[Scheduler] No schedule triggers found');
      return;
    }

    let enabledCount = 0;
    for (const trigger of triggers) {
      if (trigger.enabled) {
        await registerSchedule(trigger);
        enabledCount++;
      }
    }

    console.log(`[Scheduler] Loaded ${enabledCount} of ${triggers.length} schedule triggers`);
  } catch (error) {
    console.error('[Scheduler] Failed to initialize:', error);
  }
}

/**
 * Register a single schedule trigger as a cron job.
 */
async function registerSchedule(trigger: ScheduleTrigger): Promise<void> {
  try {
    // Validate cron expression
    if (!cron.validate(trigger.cronExpression)) {
      console.error(`[Scheduler] Invalid cron expression for trigger ${trigger.id}: ${trigger.cronExpression}`);
      return;
    }

    // Create cron job
    const task = cron.schedule(
      trigger.cronExpression,
      async () => {
        await executeTrigger(trigger);
      },
      {
        scheduled: true,
        timezone: trigger.timezone || 'UTC',
      }
    );

    activeJobs.set(trigger.id, task);

    console.log(
      `[Scheduler] Registered: ${trigger.id} - "${trigger.cronExpression}" (${trigger.timezone || 'UTC'})`
    );
  } catch (error) {
    console.error(`[Scheduler] Failed to register trigger ${trigger.id}:`, error);
  }
}

/**
 * Execute a scheduled workflow trigger.
 */
async function executeTrigger(trigger: ScheduleTrigger): Promise<void> {
  const startTime = Date.now();
  const now = new Date();
  const executionId = generateExecutionId(trigger.workflowId, trigger.id);

  console.log(`[Scheduler] Executing trigger: ${trigger.id} for workflow: ${trigger.workflowId}`);

  try {
    const workflow = await getWorkflow(trigger.workflowId);
    if (!workflow) {
      console.error(`[Scheduler] Workflow not found: ${trigger.workflowId}`);
      return;
    }

    // Prepare initial variables with automatic time variables
    const initialVariables: Record<string, string> = {
      ...workflow.variables,
      ...trigger.inputVariables,
      triggerTime: now.toISOString(),
      triggerTimestamp: String(Math.floor(now.getTime() / 1000)),
      triggerDate: now.toISOString().split('T')[0],
      triggerHour: String(now.getHours()),
      triggerMinute: String(now.getMinutes()),
    };

    const result = await executeWorkflow({
      executionId,
      workflow,
      initialVariables,
      triggerType: 'schedule',
      triggerId: trigger.id,
      startTime,
    });

    console.log(
      `[Scheduler] Execution ${result.status}: ${executionId} (${result.duration}ms, ${result.results.length} steps)`
    );
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`[Scheduler] Execution error for ${trigger.id}:`, error);

    await saveErrorResult({
      executionId,
      workflowId: trigger.workflowId,
      triggerId: trigger.id,
      triggerType: 'schedule',
      startTime,
      error: errorMessage,
    });
  }
}

/**
 * Reload all schedule triggers (stop existing jobs and re-register).
 * Useful when schedules are updated via the UI.
 */
export async function reloadSchedules(): Promise<void> {
  console.log('[Scheduler] Reloading schedules...');

  // Stop all existing jobs
  for (const [id, task] of activeJobs.entries()) {
    task.stop();
    console.log(`[Scheduler] Stopped: ${id}`);
  }
  activeJobs.clear();

  // Re-initialize
  await initScheduler();
}

/**
 * Stop all scheduled jobs (called on server shutdown).
 */
export function stopScheduler(): void {
  console.log('[Scheduler] Stopping all scheduled jobs...');

  for (const [id, task] of activeJobs.entries()) {
    task.stop();
  }

  activeJobs.clear();
  console.log('[Scheduler] All scheduled jobs stopped');
}

/**
 * Get status of all active scheduled jobs.
 */
export function getSchedulerStatus(): Array<{ id: string; running: boolean }> {
  return Array.from(activeJobs.entries()).map(([id, task]) => ({
    id,
    running: task.getStatus() === 'scheduled',
  }));
}
