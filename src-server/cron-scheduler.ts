import cron from 'node-cron';
import {
  loadScheduleTriggers,
  getWorkflow,
  saveExecutionResult,
  type ScheduleTrigger,
  type ExecutionResult,
} from './file-storage.js';
import { runGraph } from '../src/engine/workflow/graphRunner.js';
import type { NodeRunStatus } from '../src/types/workflow.js';
import type { RequestResult } from '../src/types/index.js';

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
  const executionId = `${trigger.workflowId}-${trigger.id}-${Date.now()}`;

  console.log(`[Scheduler] Executing trigger: ${trigger.id} for workflow: ${trigger.workflowId}`);

  try {
    // Load workflow
    const workflow = await getWorkflow(trigger.workflowId);
    if (!workflow) {
      console.error(`[Scheduler] Workflow not found: ${trigger.workflowId}`);
      return;
    }

    // Prepare initial variables with automatic time variables
    const initialVariables = {
      ...workflow.variables,
      ...trigger.inputVariables,
      // Automatic time variables
      triggerTime: now.toISOString(), // "2026-04-23T09:00:00.000Z"
      triggerTimestamp: String(Math.floor(now.getTime() / 1000)), // "1714737600"
      triggerDate: now.toISOString().split('T')[0], // "2026-04-23"
      triggerHour: String(now.getHours()), // "9"
      triggerMinute: String(now.getMinutes()), // "0"
    };

    // Execute workflow
    const executionResults: RequestResult[] = [];
    let executionPassed = true;
    let executionDuration = 0;

    await runGraph(
      workflow.nodes,
      workflow.edges,
      initialVariables,
      {
        onNodeStateChange: (nodeId: string, status: NodeRunStatus) => {
          // Optional: log state changes
          if (status.state === 'fail') {
            console.log(`[Scheduler] Node ${nodeId} failed`);
          }
        },
        onVariablesChange: (variables: Record<string, string>) => {
          // Optional: track variable changes
        },
        onComplete: (results: RequestResult[], passed: boolean, durationMs: number) => {
          executionResults.push(...results);
          executionPassed = passed;
          executionDuration = durationMs;
        },
      }
    );

    const totalDuration = Date.now() - startTime;
    const status: ExecutionResult['status'] = executionPassed ? 'success' : 'failed';

    // Save execution result
    await saveExecutionResult({
      id: executionId,
      workflowId: trigger.workflowId,
      triggerId: trigger.id,
      triggerType: 'schedule',
      status,
      duration: totalDuration,
      results: executionResults.map((r) => ({
        url: r.url,
        statusCode: r.httpStatus,
        responseTime: r.responseTimeMs,
        body: r.responseBody,
      })),
      variables: initialVariables,
      timestamp: now.toISOString(),
    });

    console.log(
      `[Scheduler] Execution ${status}: ${executionId} (${totalDuration}ms, ${executionResults.length} steps)`
    );
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[Scheduler] Execution error for ${trigger.id}:`, error);

    // Save error result
    try {
      await saveExecutionResult({
        id: executionId,
        workflowId: trigger.workflowId,
        triggerId: trigger.id,
        triggerType: 'schedule',
        status: 'error',
        duration: totalDuration,
        results: [],
        variables: {},
        timestamp: now.toISOString(),
        error: errorMessage,
      });
    } catch (saveError) {
      console.error('[Scheduler] Failed to save error result:', saveError);
    }
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
