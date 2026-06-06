/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowRunner from './WorkflowRunner';
import {
  mockWorkflows,
  allWorkflowVariants,
  selectWorkflowById,
} from './__test-utils__/workflowRunnerTestHelpers';
import type { RequestResult, TestSummary } from '../../../shared/types';
import { saveWorkflowRunConfig } from './utils/workflowRunConfigStorage';

const runnerProgressMocks = vi.hoisted(() => ({
  saveProgress: vi.fn(),
  loadProgress: vi.fn().mockReturnValue(null),
  clearProgress: vi.fn(),
  thinkTimeLabel: vi.fn().mockReturnValue(null),
}));

const storageMocks = vi.hoisted(() => ({
  saveRunnerConfig: vi.fn().mockResolvedValue(undefined),
  loadRunnerConfig: vi.fn().mockResolvedValue(null),
}));

const webhookDriverMocks = vi.hoisted(() => ({
  calculateTotalRequests: vi.fn((rate?: { mode: string; rps?: number; durationSec?: number }) =>
    typeof rate?.rps === 'number' && typeof rate?.durationSec === 'number'
      ? Math.ceil(rate.rps * rate.durationSec)
      : 10
  ),
  runWebhookLoadTest: vi.fn(),
}));

const webhookScenarioMocks = vi.hoisted(() => ({
  loadWebhookScenarios: vi.fn(() => [] as import('./components/MultiWebhookTestingPanel').WebhookScenario[]),
  saveWebhookScenario: vi.fn(
    (
      _workflowId: string,
      scenario: Omit<import('./components/MultiWebhookTestingPanel').WebhookScenario, 'id' | 'createdAt'>
    ): import('./components/MultiWebhookTestingPanel').WebhookScenario => ({
      id: 'scenario-generated',
      createdAt: Date.now(),
      ...scenario,
    })
  ),
  deleteWebhookScenario: vi.fn(),
  fireWebhook: vi.fn().mockResolvedValue(undefined),
  buildPayloadWithCorrelationId: vi.fn(
    (payload: Record<string, unknown>, correlationId: string) => ({ ...payload, correlationId })
  ),
}));

const testExec = vi.hoisted(() => {
  const defaultStartExternalExecution = vi.fn(() => {
    const ac = new AbortController();
    return {
      reportProgress: vi.fn(),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn(),
      abortSignal: ac.signal,
    };
  });

  return {
    isRunning: false,
    completed: 0,
    total: 0,
    liveSummary: null as TestSummary | null,
    liveResults: [] as unknown[],
    profileMeta: null,
    timeSeries: [] as unknown[],
    error: null as string | null,
    execute: vi.fn(),
    abort: vi.fn(),
    finalRun: null as { results: unknown[]; summary: { totalDurationMs: number } } | null,
    pendingRun: null as unknown,
    confirmSavePendingRun: vi.fn(),
    dismissPendingRun: vi.fn(),
    startExternalExecution: defaultStartExternalExecution,
  };
});

vi.mock('../workflow/engine/webhookLoadDriver', () => ({
  calculateTotalRequests: (...args: unknown[]) => webhookDriverMocks.calculateTotalRequests(...args),
  runWebhookLoadTest: (...args: unknown[]) => webhookDriverMocks.runWebhookLoadTest(...args),
}));

vi.mock('./utils/webhookScenarioStorage', () => ({
  loadWebhookScenarios: (...args: unknown[]) => webhookScenarioMocks.loadWebhookScenarios(...args),
  saveWebhookScenario: (...args: unknown[]) => webhookScenarioMocks.saveWebhookScenario(...args),
  deleteWebhookScenario: (...args: unknown[]) => webhookScenarioMocks.deleteWebhookScenario(...args),
  fireWebhook: (...args: unknown[]) => webhookScenarioMocks.fireWebhook(...args),
  buildPayloadWithCorrelationId: (...args: unknown[]) =>
    webhookScenarioMocks.buildPayloadWithCorrelationId(...args),
}));

vi.mock('./components/MultiWebhookTestingPanel', async () => {
  const { MultiWebhookStub } = await import('./__test-utils__/workflowRunnerTestHelpers');
  return { default: MultiWebhookStub };
});

vi.mock('./hooks/useWorkflowRunnerConfig', async () => {
  const ReactMod = await import('react');
  const {
    defaultLoadProfile: dl,
    defaultThinkTime,
  }: typeof import('./hooks/useRunnerConfig') = await import('./hooks/useRunnerConfig');

  return {
    useWorkflowRunnerConfig() {
      const [concurrency, setConcurrency] = ReactMod.useState(1);
      const [iterations, setIterations] = ReactMod.useState(1);
      const [executionMode, setExecutionMode] = ReactMod.useState<
        import('../../../shared/types').ExecutionMode
      >('batch');
      const [loadProfile, setLoadProfile] = ReactMod.useState({ ...dl });
      const [thinkTime, setThinkTime] = ReactMod.useState({ ...defaultThinkTime });
      const [timeoutSec, setTimeoutSec] = ReactMod.useState(10);
      const [retryCount, setRetryCount] = ReactMod.useState(0);
      const [retryDelayMs, setRetryDelayMs] = ReactMod.useState(1000);
      const [errorPolicy, setErrorPolicy] = ReactMod.useState<
        import('../../../shared/types').ErrorPolicy
      >('continue');
      const [maxErrors, setMaxErrors] = ReactMod.useState(10);
      const [maxErrorRate, setMaxErrorRate] = ReactMod.useState(50);
      const [selectedWorkflowId, setSelectedWorkflowId] = ReactMod.useState<string | null>(null);
      const [traceOptions, setTraceOptions] = ReactMod.useState({
        captureFullTrace: false,
        alwaysCaptureFailures: true,
      });
      const [configLoaded] = ReactMod.useState(true);

      return {
        concurrency,
        setConcurrency,
        iterations,
        setIterations,
        executionMode,
        setExecutionMode,
        loadProfile,
        setLoadProfile,
        thinkTime,
        setThinkTime,
        timeoutSec,
        setTimeoutSec,
        retryCount,
        setRetryCount,
        retryDelayMs,
        setRetryDelayMs,
        errorPolicy,
        setErrorPolicy,
        maxErrors,
        setMaxErrors,
        maxErrorRate,
        setMaxErrorRate,
        selectedWorkflowId,
        setSelectedWorkflowId,
        traceOptions,
        setTraceOptions,
        configLoaded,
      };
    },
  };
});

vi.mock('./hooks/useTestExecution', () => ({
  useTestExecution: () => ({ ...testExec }),
}));

vi.mock('../../../shared/utils/storage', () => ({
  saveRunnerConfig: (...a: unknown[]) => storageMocks.saveRunnerConfig(...a),
  loadRunnerConfig: (...a: unknown[]) => storageMocks.loadRunnerConfig(...a),
}));


vi.mock('./utils/runnerProgressStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/runnerProgressStorage')>();
  return {
    ...actual,
    saveProgress: (...a: unknown[]) => runnerProgressMocks.saveProgress(...a),
    loadProgress: (...a: unknown[]) => runnerProgressMocks.loadProgress(...a),
    clearProgress: (...a: unknown[]) => runnerProgressMocks.clearProgress(...a),
    thinkTimeLabel: (...a: unknown[]) => runnerProgressMocks.thinkTimeLabel(...a),
  };
});

vi.mock('./utils/workflowRunConfigStorage', () => ({
  getWorkflowRunConfigs: vi.fn().mockReturnValue([]),
  saveWorkflowRunConfig: vi.fn(),
  saveWorkflowRunConfigManually: vi.fn(),
  updateWorkflowRunConfigLabel: vi.fn(),
  deleteWorkflowRunConfig: vi.fn(),
  formatConfigLabel: vi.fn().mockReturnValue('Config'),
  formatRelativeTime: vi.fn().mockReturnValue('just now'),
}));


describe('WorkflowRunner', () => {

  beforeEach(() => {
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
    vi.mocked(saveWorkflowRunConfig).mockClear();
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
          : 10
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
      } as Response)
    );
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('respects disabled trace sampling checkbox in execute options', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    selectWorkflowById('wf1');
    fireEvent.click(screen.getByRole('radio', { name: 'Full' }));

    const sampling = await screen.findByRole('checkbox', { name: /sampling/i });
    fireEvent.click(sampling);

    testExec.execute.mockClear();
    fireEvent.click(screen.getByText('▶ Run Workflow'));

    expect(testExec.execute.mock.calls[0][0]).toMatchObject({
      traceOptions: expect.objectContaining({
        captureFullTrace: true,
        samplingEnabled: false,
      }),
    });
  });

  it('allows editing trace sampling threshold when sampling stays enabled', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    selectWorkflowById('wf1');

    fireEvent.click(screen.getByRole('radio', { name: 'Full' }));
    const thresholdInput = await waitFor(() => {
      const el = document.querySelector('.wf-sampling-threshold-input') as HTMLInputElement;
      expect(el).toBeTruthy();
      return el;
    });
    expect(thresholdInput).toHaveValue(50);
    fireEvent.change(thresholdInput, {
      target: { value: '90' },
    });

    expect(thresholdInput).toHaveValue(90);
  });

  describe('Kafka load policy banners (Phase 7C)', () => {
    it('renders block banner when kafkaConsume node has wait-for-real mode', async () => {
      render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
      selectWorkflowById('wf-kafka-wfr');

      await waitFor(() => {
        expect(document.querySelector('.kafka-load-warning--block')).toBeTruthy();
      });
      expect(document.querySelector('.kafka-load-warning--block')).toHaveTextContent('wait-for-real');
      expect(document.querySelector('.kafka-load-info')).toBeNull();
    });

    it('renders no banner when kafkaConsume node has auto-resume mode', async () => {
      render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
      selectWorkflowById('wf-kafka-ar');

      await waitFor(() => screen.getByText('▶ Run Workflow'));
      expect(document.querySelector('.kafka-load-warning--block')).toBeNull();
      expect(document.querySelector('.kafka-load-warning--warn')).toBeNull();
      expect(document.querySelector('.kafka-load-info')).toBeNull();
    });

    it('renders no banner when kafkaConsume node has synthetic-inject mode', async () => {
      render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
      selectWorkflowById('wf-kafka-si');

      await waitFor(() => screen.getByText('▶ Run Workflow'));
      expect(document.querySelector('.kafka-load-warning--block')).toBeNull();
      expect(document.querySelector('.kafka-load-warning--warn')).toBeNull();
      expect(document.querySelector('.kafka-load-info')).toBeNull();
    });

    it('renders info advisory when kafkaConsume node has no loadTestBehavior', async () => {
      render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
      selectWorkflowById('wf-kafka-nlb');

      await waitFor(() => {
        expect(document.querySelector('.kafka-load-info')).toBeTruthy();
      });
      expect(document.querySelector('.kafka-load-info')).toHaveTextContent('auto-resume');
      expect(document.querySelector('.kafka-load-warning--block')).toBeNull();
    });

    it('renders no banners when workflow has no kafkaConsume nodes', async () => {
      render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
      selectWorkflowById('wf1');

      await waitFor(() => screen.getByText('▶ Run Workflow'));
      expect(document.querySelector('.kafka-load-warning--block')).toBeNull();
      expect(document.querySelector('.kafka-load-warning--warn')).toBeNull();
      expect(document.querySelector('.kafka-load-info')).toBeNull();
    });

    it('shows only the block banner (not the info advisory) when both block and info nodes exist — priority rule', async () => {
      render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
      selectWorkflowById('wf-kafka-mixed');

      await waitFor(() => {
        expect(document.querySelector('.kafka-load-warning--block')).toBeTruthy();
      });
      expect(document.querySelector('.kafka-load-warning--block')).toHaveTextContent('wait-for-real');
      // Info advisory must be suppressed when a block banner is present
      expect(document.querySelector('.kafka-load-info')).toBeNull();
    });
  });
});
