/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

  it('uses load profile and think-time patches from execution config when running', async () => {
    render(
      <WorkflowRunner
        workflows={mockWorkflows}
        onComplete={vi.fn()}
        initialWorkflowId="wf1"
        onClearInitialWorkflowId={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Execution Mode:')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'Load Profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ramp-Up' }));
    const loadProfileSection = document.querySelector('.load-profile-section');
    expect(loadProfileSection).toBeTruthy();
    const [durationInput] = within(loadProfileSection as HTMLElement).getAllByRole('spinbutton');
    fireEvent.change(durationInput, { target: { value: '200' } });

    fireEvent.click(screen.getByRole('radio', { name: 'Constant' }));
    const thinkSection = document.querySelector('.think-time-section');
    expect(thinkSection).toBeTruthy();
    const delayInput = within(thinkSection as HTMLElement).getByRole('spinbutton');
    fireEvent.change(delayInput, { target: { value: '1500' } });

    testExec.execute.mockClear();
    fireEvent.click(screen.getByText('▶ Run Workflow'));
    expect(testExec.execute).toHaveBeenCalled();
    const cfg = testExec.execute.mock.calls[0][0] as { iterations: number; loadProfile?: unknown };
    expect(cfg.iterations).toBe(0);
    expect(cfg.loadProfile).toBeDefined();
  });

  it('webhook-triggered workflow shows harness mode switching and optional load controls', async () => {
    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
    selectWorkflowById('wf-wh');

    await waitFor(() => {
      expect(screen.getByText('Run Mode:')).toBeInTheDocument();
      expect(screen.getByText(/Run workflow once using sample payload/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load Test' }));
    await waitFor(() => {
      expect(screen.getByText(/Send many requests to webhook endpoint/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Run Webhook Load Test/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Single Run' }));
    await waitFor(() => expect(screen.getByText(/Run workflow once using sample payload/)).toBeInTheDocument());
  });

  it('does not expose webhook-trigger mode when webhook is fed by upstream HTTP nodes', async () => {
    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
    selectWorkflowById('wf-wh-mid');

    await waitFor(() => expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument());
    expect(screen.queryByText('Run Mode:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load Test' })).not.toBeInTheDocument();
  });

  it('drops webhook harness controls after leaving a webhook-triggered workflow', async () => {
    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
    selectWorkflowById('wf-wh');
    await waitFor(() => expect(screen.getByText('Run Mode:')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Load Test' }));
    selectWorkflowById('wf1');

    await waitFor(() => {
      expect(screen.queryByText('Run Mode:')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Run Webhook Load Test/ })).not.toBeInTheDocument();
  });

  it('invokes webhook load driver, saves config, and finishes external executions', async () => {
    const complete = vi.fn().mockResolvedValue(undefined);

    testExec.startExternalExecution.mockImplementation(() => {
      const ac = new AbortController();
      return {
        reportProgress: vi.fn(),
        complete,
        fail: vi.fn(),
        abortSignal: ac.signal,
      };
    });

    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);

    selectWorkflowById('wf-wh');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Load Test' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Load Test' }));

    fireEvent.click(screen.getByRole('button', { name: /Run Webhook Load Test/ }));

    await waitFor(() => {
      expect(testExec.startExternalExecution).toHaveBeenCalled();
      expect(webhookDriverMocks.runWebhookLoadTest).toHaveBeenCalled();
      expect(webhookDriverMocks.runWebhookLoadTest.mock.calls[0][0]).toMatchObject({
        webhookUrl: `http://localhost:3001/webhooks/wf-wh/wh-trigger`,
      });
      expect(complete).toHaveBeenCalled();
    });

    expect(vi.mocked(saveWorkflowRunConfig)).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf-wh',
      }),
    );

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `http://${window.location.hostname}:3001/api/workflows/wf-wh`,
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('maps registration downtime to webhook server guidance messages', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'));

    const fail = vi.fn();
    testExec.startExternalExecution.mockImplementation(() => ({
      reportProgress: vi.fn(),
      complete: vi.fn(),
      fail,
      abortSignal: new AbortController().signal,
    }));

    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
    selectWorkflowById('wf-wh');
    fireEvent.click(screen.getByRole('button', { name: 'Load Test' }));
    fireEvent.click(screen.getByRole('button', { name: /Run Webhook Load Test/ }));

    await waitFor(() => {
      expect(fail).toHaveBeenCalledWith(expect.stringContaining('Webhook server not running'));
    });

    expect(webhookDriverMocks.runWebhookLoadTest).not.toHaveBeenCalled();
  });

  it('maps failed workflow registration responses to failure messages', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Boom',
    } as Response);

    const fail = vi.fn();
    testExec.startExternalExecution.mockImplementation(() => ({
      reportProgress: vi.fn(),
      complete: vi.fn(),
      fail,
      abortSignal: new AbortController().signal,
    }));

    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
    selectWorkflowById('wf-wh');
    fireEvent.click(screen.getByRole('button', { name: 'Load Test' }));
    fireEvent.click(screen.getByRole('button', { name: /Run Webhook Load Test/ }));

    await waitFor(() =>
      expect(fail).toHaveBeenCalledWith(expect.stringContaining('Failed to register workflow')),
    );
  });

  it('suppresses webhook load failures after the external controller aborts', async () => {
    const aborted = new AbortController();
    aborted.abort();

    const fail = vi.fn();
    testExec.startExternalExecution.mockImplementationOnce(() => ({
      reportProgress: vi.fn(),
      complete: vi.fn(),
      fail,
      abortSignal: aborted.signal,
    }));

    webhookDriverMocks.runWebhookLoadTest.mockRejectedValueOnce(new Error('cancelled'));

    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);

    selectWorkflowById('wf-wh');
    fireEvent.click(screen.getByRole('button', { name: 'Load Test' }));
    fireEvent.click(screen.getByRole('button', { name: /Run Webhook Load Test/ }));

    await waitFor(() => expect(webhookDriverMocks.runWebhookLoadTest).toHaveBeenCalled());
    await Promise.resolve();

    expect(fail).not.toHaveBeenCalled();
  });

  it('stops generic workflow executions through the abort helper', async () => {
    testExec.isRunning = true;
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} initialWorkflowId="wf1" onClearInitialWorkflowId={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /■ Stop/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /■ Stop/ }));
    expect(testExec.abort).toHaveBeenCalled();
  });

  it('shows CorrelationWait settings, loads scenarios, and wires multi webhook callbacks', async () => {
    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);

    selectWorkflowById('wf-corr');
    await waitFor(() => {
      expect(webhookScenarioMocks.loadWebhookScenarios).toHaveBeenCalledWith('wf-corr');
      expect(screen.getByRole('heading', { name: 'CorrelationWait Behavior' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: /Wait for Real Webhook/ }));
    await waitFor(() => expect(screen.getByTestId('multi-webhook-stub')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('stub-save-webhook-scenario'));
    expect(webhookScenarioMocks.saveWebhookScenario).toHaveBeenCalledWith(
      'wf-corr',
      expect.objectContaining({
        name: 'Stub scenario',
      }),
    );

    fireEvent.click(screen.getByTestId('stub-delete-webhook-scenario'));
    expect(webhookScenarioMocks.deleteWebhookScenario).toHaveBeenCalledWith('wf-corr', 'sc-1');

    fireEvent.click(screen.getByTestId('stub-fire-webhook'));
    await waitFor(() =>
      expect(webhookScenarioMocks.fireWebhook).toHaveBeenCalledWith(
        'corr-1',
        expect.objectContaining({ correlationId: 'corr-1', x: true }),
        '/cb',
      ),
    );

    webhookScenarioMocks.fireWebhook.mockClear();
    fireEvent.click(screen.getByTestId('stub-fire-webhook-unknown-node'));
    await waitFor(() => expect(webhookScenarioMocks.fireWebhook).not.toHaveBeenCalled());

    webhookScenarioMocks.loadWebhookScenarios.mockClear();

    selectWorkflowById('wf1');

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'CorrelationWait Behavior' })).not.toBeInTheDocument(),
    );

    selectWorkflowById('wf-corr');

    await waitFor(() =>
      expect(webhookScenarioMocks.loadWebhookScenarios).toHaveBeenCalledWith('wf-corr'),
    );
  });

});
