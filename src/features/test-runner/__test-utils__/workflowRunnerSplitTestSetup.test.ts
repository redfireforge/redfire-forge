// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupWorkflowRunnerSplitTestGlobals,
  resetWorkflowRunnerSplitTestState,
} from './workflowRunnerSplitTestSetup';

function makeMocks() {
  return {
    testExec: {
      execute: vi.fn(),
      abort: vi.fn(),
      confirmSavePendingRun: vi.fn(),
      dismissPendingRun: vi.fn(),
      startExternalExecution: vi.fn(),
      isRunning: true,
      completed: 5,
      total: 10,
      liveSummary: { totalRequests: 1 } as never,
      timeSeries: [{}],
      finalRun: { results: [], summary: { totalDurationMs: 1 } },
      error: 'err',
      pendingRun: { id: 'pending' },
    },
    runnerProgressMocks: {
      saveProgress: vi.fn(),
      loadProgress: vi.fn(),
    },
    storageMocks: {
      loadRunnerConfig: vi.fn().mockResolvedValue({ id: 'cfg' }),
      saveRunnerConfig: vi.fn(),
    },
    webhookDriverMocks: {
      runWebhookLoadTest: vi.fn(),
      calculateTotalRequests: vi.fn(),
    },
    webhookScenarioMocks: {
      loadWebhookScenarios: vi.fn(),
      saveWebhookScenario: vi.fn(),
      deleteWebhookScenario: vi.fn(),
      fireWebhook: vi.fn(),
      buildPayloadWithCorrelationId: vi.fn(),
    },
    saveWorkflowRunConfigMock: vi.fn(),
  };
}

describe('workflowRunnerSplitTestSetup', () => {
  afterEach(() => {
    cleanupWorkflowRunnerSplitTestGlobals();
  });

  it('resetWorkflowRunnerSplitTestState clears execution state and stubs fetch', async () => {
    const mocks = makeMocks();
    resetWorkflowRunnerSplitTestState(mocks);

    expect(mocks.testExec.isRunning).toBe(false);
    expect(mocks.testExec.error).toBeNull();
    expect(mocks.storageMocks.loadRunnerConfig).not.toHaveBeenCalled();

    const handle = mocks.testExec.startExternalExecution();
    expect(handle.reportProgress).toBeTypeOf('function');
    handle.reportProgress(1, 2);
    handle.fail(new Error('boom'));
    await expect(handle.complete()).resolves.toBeUndefined();

    const calc = mocks.webhookDriverMocks.calculateTotalRequests;
    expect(calc({ rps: 2, durationSec: 5 })).toBe(10);
    expect(calc({ rps: 2 })).toBe(10);
    expect(calc({})).toBe(10);

    await mocks.webhookDriverMocks.runWebhookLoadTest({}, {
      onProgress: vi.fn(),
      onRequestComplete: vi.fn(),
    });
    expect(mocks.webhookDriverMocks.runWebhookLoadTest).toHaveBeenCalled();

    await expect(fetch('http://example.test')).resolves.toMatchObject({ ok: true });
  });
});
