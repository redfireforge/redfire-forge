import { vi, type Mock } from 'vitest';
import type { RequestResult, TestSummary } from '@shared/types';

type TestExecutionState = {
  execute: Mock;
  abort: Mock;
  confirmSavePendingRun: Mock;
  dismissPendingRun: Mock;
  startExternalExecution: Mock;
  isRunning: boolean;
  completed: number;
  total: number;
  liveSummary: TestSummary | null;
  timeSeries: unknown[];
  finalRun: { results: unknown[]; summary: { totalDurationMs: number } } | null;
  error: string | null;
  pendingRun: unknown;
};

type RunnerProgressMocks = {
  saveProgress: Mock;
  loadProgress: Mock;
};

type StorageMocks = {
  loadRunnerConfig: Mock;
  saveRunnerConfig: Mock;
};

type WebhookDriverMocks = {
  runWebhookLoadTest: Mock;
  calculateTotalRequests: Mock;
};

type WebhookScenarioMocks = {
  loadWebhookScenarios: Mock;
  saveWebhookScenario: Mock;
  deleteWebhookScenario: Mock;
  fireWebhook: Mock;
  buildPayloadWithCorrelationId: Mock;
};

type SetupParams = {
  testExec: TestExecutionState;
  runnerProgressMocks: RunnerProgressMocks;
  storageMocks: StorageMocks;
  webhookDriverMocks: WebhookDriverMocks;
  webhookScenarioMocks: WebhookScenarioMocks;
  saveWorkflowRunConfigMock: Mock;
};

export function resetWorkflowRunnerSplitTestState({
  testExec,
  runnerProgressMocks,
  storageMocks,
  webhookDriverMocks,
  webhookScenarioMocks,
  saveWorkflowRunConfigMock,
}: SetupParams): void {
  testExec.execute.mockClear();
  testExec.abort.mockClear();
  testExec.confirmSavePendingRun.mockClear();
  testExec.dismissPendingRun.mockClear();
  testExec.startExternalExecution.mockClear();
  testExec.startExternalExecution.mockImplementation(() => {
    const ac = new AbortController();
    return {
      reportProgress: vi.fn(),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn(),
      abortSignal: ac.signal,
    };
  });

  testExec.isRunning = false;
  testExec.completed = 0;
  testExec.total = 0;
  testExec.liveSummary = null;
  testExec.timeSeries = [];
  testExec.finalRun = null;
  testExec.error = null;
  testExec.pendingRun = null;

  runnerProgressMocks.saveProgress.mockClear();
  runnerProgressMocks.loadProgress.mockReturnValue(null);

  storageMocks.loadRunnerConfig.mockReset();
  storageMocks.loadRunnerConfig.mockResolvedValue(null);
  storageMocks.saveRunnerConfig.mockClear();

  saveWorkflowRunConfigMock.mockClear();

  webhookDriverMocks.runWebhookLoadTest.mockReset();
  webhookDriverMocks.runWebhookLoadTest.mockImplementation(async (_cfg, callbacks, _abort) => {
    const mockReq = {
      id: 'wb-mock-result',
      statusCode: 200,
      label: '',
      responseTimeMs: 1,
    } as unknown as RequestResult;
    callbacks?.onProgress?.(1, 1, 10, 0);
    callbacks?.onRequestComplete?.(mockReq, 1, 1);

    return {
      results: [mockReq],
      totalRequests: 1,
      successCount: 1,
      failureCount: 0,
      avgResponseTimeMs: 1,
      minResponseTimeMs: 1,
      maxResponseTimeMs: 1,
      actualDurationMs: 50,
      actualRps: 0,
    };
  });

  webhookDriverMocks.calculateTotalRequests.mockImplementation(
    (rate?: { rps?: number; durationSec?: number }) =>
      typeof rate?.rps === 'number' && typeof rate?.durationSec === 'number'
        ? Math.ceil(rate.rps * rate.durationSec)
        : 10,
  );

  webhookScenarioMocks.loadWebhookScenarios.mockClear();
  webhookScenarioMocks.saveWebhookScenario.mockClear();
  webhookScenarioMocks.deleteWebhookScenario.mockClear();
  webhookScenarioMocks.fireWebhook.mockClear();
  webhookScenarioMocks.buildPayloadWithCorrelationId.mockClear();

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
    } as Response),
  );

  localStorage.clear();
  sessionStorage.clear();
}

export function cleanupWorkflowRunnerSplitTestGlobals(): void {
  vi.unstubAllGlobals();
}