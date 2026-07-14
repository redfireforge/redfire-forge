/**
 * Unit tests for cron-scheduler.ts
 *
 * Covers: initScheduler, reloadSchedules, stopScheduler, getSchedulerStatus,
 * registerSchedule (via initScheduler), executeTrigger (via cron callback).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScheduleTrigger } from '../src/shared/types/server-api';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockLoadScheduleTriggers = vi.fn<() => Promise<ScheduleTrigger[]>>();
const mockGetWorkflow = vi.fn();
const mockExecuteWorkflow = vi.fn();
const mockSaveErrorResult = vi.fn();

const mockCronValidate = vi.fn<(expr: string) => boolean>();
const mockCronSchedule = vi.fn();

vi.mock('./file-storage.js', () => ({
  loadScheduleTriggers: (...args: unknown[]) => mockLoadScheduleTriggers(...(args as [])),
  getWorkflow: (...args: unknown[]) => mockGetWorkflow(...args),
}));

vi.mock('./executeWorkflow.js', () => ({
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args),
  saveErrorResult: (...args: unknown[]) => mockSaveErrorResult(...args),
}));

vi.mock('node-cron', () => ({
  default: {
    validate: (expr: string) => mockCronValidate(expr),
    schedule: (...args: unknown[]) => mockCronSchedule(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTrigger(overrides?: Partial<ScheduleTrigger>): ScheduleTrigger {
  return {
    id: 'trigger-1',
    workflowId: 'wf-1',
    nodeId: 'node-1',
    enabled: true,
    cronExpression: '*/5 * * * *',
    timezone: 'UTC',
    ...overrides,
  };
}

function makeTask() {
  return {
    stop: vi.fn(),
    getStatus: vi.fn(() => 'scheduled'),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('cron-scheduler', () => {
  let scheduler: typeof import('./cron-scheduler.js');

  beforeEach(async () => {
    resetAllMocks();
    mockCronValidate.mockReturnValue(true);
    mockCronSchedule.mockReturnValue(makeTask());
    mockLoadScheduleTriggers.mockResolvedValue([]);

    // Re-import to reset module-level activeJobs Map
    vi.resetModules();
    scheduler = await import('./cron-scheduler.js');
  });

  afterEach(() => {
    // Clean up any active jobs
    scheduler.stopScheduler();
  });

  // ── initScheduler ────────────────────────────────────────────────────────

  describe('initScheduler', () => {
    it('does nothing when no triggers exist', async () => {
      mockLoadScheduleTriggers.mockResolvedValue([]);

      await scheduler.initScheduler();

      expect(mockCronSchedule).not.toHaveBeenCalled();
      expect(scheduler.getSchedulerStatus()).toEqual([]);
    });

    it('registers enabled triggers only', async () => {
      const task = makeTask();
      mockCronSchedule.mockReturnValue(task);
      mockLoadScheduleTriggers.mockResolvedValue([
        makeTrigger({ id: 'enabled-1', enabled: true }),
        makeTrigger({ id: 'disabled-1', enabled: false }),
        makeTrigger({ id: 'enabled-2', enabled: true }),
      ]);

      await scheduler.initScheduler();

      expect(mockCronSchedule).toHaveBeenCalledTimes(2);
      const statuses = scheduler.getSchedulerStatus();
      expect(statuses).toHaveLength(2);
      expect(statuses.map(s => s.id)).toEqual(['enabled-1', 'enabled-2']);
    });

    it('handles loadScheduleTriggers failure gracefully', async () => {
      mockLoadScheduleTriggers.mockRejectedValue(new Error('disk error'));

      // Should not throw
      await scheduler.initScheduler();

      expect(scheduler.getSchedulerStatus()).toEqual([]);
    });

    it('skips triggers with invalid cron expression', async () => {
      mockCronValidate.mockReturnValue(false);
      mockLoadScheduleTriggers.mockResolvedValue([makeTrigger()]);

      await scheduler.initScheduler();

      expect(mockCronSchedule).not.toHaveBeenCalled();
      expect(scheduler.getSchedulerStatus()).toEqual([]);
    });

    it('uses trigger timezone for scheduling', async () => {
      mockCronSchedule.mockReturnValue(makeTask());
      mockLoadScheduleTriggers.mockResolvedValue([
        makeTrigger({ timezone: 'America/New_York' }),
      ]);

      await scheduler.initScheduler();

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '*/5 * * * *',
        expect.any(Function),
        { scheduled: true, timezone: 'America/New_York' },
      );
    });

    it('defaults to UTC when timezone is empty', async () => {
      mockCronSchedule.mockReturnValue(makeTask());
      mockLoadScheduleTriggers.mockResolvedValue([
        makeTrigger({ timezone: '' }),
      ]);

      await scheduler.initScheduler();

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '*/5 * * * *',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' },
      );
    });

    it('handles cron.schedule throwing an error', async () => {
      mockCronSchedule.mockImplementation(() => {
        throw new Error('cron internal error');
      });
      mockLoadScheduleTriggers.mockResolvedValue([makeTrigger()]);

      // Should not throw
      await scheduler.initScheduler();
      expect(scheduler.getSchedulerStatus()).toEqual([]);
    });
  });

  // ── stopScheduler ────────────────────────────────────────────────────────

  describe('stopScheduler', () => {
    it('stops all active jobs and clears the map', async () => {
      const task1 = makeTask();
      const task2 = makeTask();
      mockCronSchedule
        .mockReturnValueOnce(task1)
        .mockReturnValueOnce(task2);
      mockLoadScheduleTriggers.mockResolvedValue([
        makeTrigger({ id: 't-1' }),
        makeTrigger({ id: 't-2' }),
      ]);

      await scheduler.initScheduler();
      expect(scheduler.getSchedulerStatus()).toHaveLength(2);

      scheduler.stopScheduler();

      expect(task1.stop).toHaveBeenCalled();
      expect(task2.stop).toHaveBeenCalled();
      expect(scheduler.getSchedulerStatus()).toEqual([]);
    });

    it('is safe to call when no jobs are active', () => {
      // Should not throw
      scheduler.stopScheduler();
      expect(scheduler.getSchedulerStatus()).toEqual([]);
    });
  });

  // ── reloadSchedules ──────────────────────────────────────────────────────

  describe('reloadSchedules', () => {
    it('stops existing jobs then re-initializes', async () => {
      const oldTask = makeTask();
      const newTask = makeTask();
      mockCronSchedule.mockReturnValueOnce(oldTask);
      mockLoadScheduleTriggers.mockResolvedValue([makeTrigger({ id: 'old-1' })]);

      await scheduler.initScheduler();
      expect(scheduler.getSchedulerStatus()).toHaveLength(1);

      // Reload with new triggers
      mockCronSchedule.mockReturnValueOnce(newTask);
      mockLoadScheduleTriggers.mockResolvedValue([makeTrigger({ id: 'new-1' })]);

      await scheduler.reloadSchedules();

      expect(oldTask.stop).toHaveBeenCalled();
      const statuses = scheduler.getSchedulerStatus();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].id).toBe('new-1');
    });
  });

  // ── getSchedulerStatus ───────────────────────────────────────────────────

  describe('getSchedulerStatus', () => {
    it('returns running status from task.getStatus()', async () => {
      const runningTask = makeTask();
      runningTask.getStatus.mockReturnValue('scheduled');
      const stoppedTask = makeTask();
      stoppedTask.getStatus.mockReturnValue('stopped');

      mockCronSchedule
        .mockReturnValueOnce(runningTask)
        .mockReturnValueOnce(stoppedTask);
      mockLoadScheduleTriggers.mockResolvedValue([
        makeTrigger({ id: 'running' }),
        makeTrigger({ id: 'stopped' }),
      ]);

      await scheduler.initScheduler();

      const statuses = scheduler.getSchedulerStatus();
      expect(statuses).toEqual([
        { id: 'running', running: true },
        { id: 'stopped', running: false },
      ]);
    });
  });

  // ── executeTrigger (via cron callback) ───────────────────────────────────

  describe('executeTrigger (cron callback)', () => {
    it('executes workflow with correct variables', async () => {
      const task = makeTask();
      let cronCallback: () => Promise<void> = async () => {};
      mockCronSchedule.mockImplementation((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb;
        return task;
      });
      mockLoadScheduleTriggers.mockResolvedValue([
        makeTrigger({
          inputVariables: { env: 'prod' },
        }),
      ]);

      const mockWorkflow = {
        id: 'wf-1',
        name: 'Test Workflow',
        variables: { baseUrl: 'http://api.com' },
      };
      mockGetWorkflow.mockResolvedValue(mockWorkflow);
      mockExecuteWorkflow.mockResolvedValue({
        status: 'passed',
        duration: 150,
        results: [{ nodeId: 'n1' }],
      });

      await scheduler.initScheduler();
      await cronCallback();

      expect(mockGetWorkflow).toHaveBeenCalledWith('wf-1');
      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow: mockWorkflow,
          triggerType: 'schedule',
          triggerId: 'trigger-1',
          initialVariables: expect.objectContaining({
            baseUrl: 'http://api.com',
            env: 'prod',
            triggerDate: expect.any(String),
            triggerTime: expect.any(String),
            triggerTimestamp: expect.any(String),
            triggerHour: expect.any(String),
            triggerMinute: expect.any(String),
          }),
        }),
      );
    });

    it('handles workflow not found', async () => {
      let cronCallback: () => Promise<void> = async () => {};
      mockCronSchedule.mockImplementation((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb;
        return makeTask();
      });
      mockLoadScheduleTriggers.mockResolvedValue([makeTrigger()]);
      mockGetWorkflow.mockResolvedValue(null);

      await scheduler.initScheduler();
      // Should not throw
      await cronCallback();

      expect(mockExecuteWorkflow).not.toHaveBeenCalled();
    });

    it('saves error result when execution throws', async () => {
      let cronCallback: () => Promise<void> = async () => {};
      mockCronSchedule.mockImplementation((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb;
        return makeTask();
      });
      mockLoadScheduleTriggers.mockResolvedValue([makeTrigger()]);
      mockGetWorkflow.mockResolvedValue({ id: 'wf-1', variables: {} });
      mockExecuteWorkflow.mockRejectedValue(new Error('network error'));
      mockSaveErrorResult.mockResolvedValue(undefined);

      await scheduler.initScheduler();
      await cronCallback();

      expect(mockSaveErrorResult).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'wf-1',
          triggerId: 'trigger-1',
          triggerType: 'schedule',
          error: 'network error',
        }),
      );
    });

    it('input variables override workflow variables', async () => {
      let cronCallback: () => Promise<void> = async () => {};
      mockCronSchedule.mockImplementation((_expr: string, cb: () => Promise<void>) => {
        cronCallback = cb;
        return makeTask();
      });
      mockLoadScheduleTriggers.mockResolvedValue([
        makeTrigger({ inputVariables: { baseUrl: 'http://override.com' } }),
      ]);
      mockGetWorkflow.mockResolvedValue({
        id: 'wf-1',
        variables: { baseUrl: 'http://original.com' },
      });
      mockExecuteWorkflow.mockResolvedValue({ status: 'passed', duration: 10, results: [] });

      await scheduler.initScheduler();
      await cronCallback();

      const callArgs = mockExecuteWorkflow.mock.calls[0][0];
      expect(callArgs.initialVariables.baseUrl).toBe('http://override.com');
    });
  });
});
