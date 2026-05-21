/** @vitest-environment jsdom */
import { useState } from 'react';
import type { JSX } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowRunner from './WorkflowRunner';
import {
  mockWorkflows,
  wfWebhookStart,
  allWorkflowVariants,
  selectWorkflowById,
  makeSummary,
} from './__test-utils__/workflowRunnerTestHelpers';
import type { Workflow } from '../workflow/types/workflow';
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


function ImportSampleHarness(): JSX.Element {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  return (
    <WorkflowRunner
      workflows={workflows}
      onComplete={vi.fn()}
      onImportSample={(wf) => {
        const newId = `imp-${wf.id}`;
        setWorkflows([{ ...wf, id: newId }]);
        return newId;
      }}
    />
  );
}

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

  it('passes configurable poll concurrency limits alongside wait-for-condition nodes', async () => {
    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
    selectWorkflowById('wf-poll');

    await waitFor(() => expect(screen.getByText('Poll limit')).toBeInTheDocument());

    const pollWrap = screen.getByText('Poll limit').closest('.wf-inline-option')!;
    const pollSpinner = within(pollWrap as HTMLElement).getByRole('spinbutton');

    fireEvent.change(pollSpinner, { target: { value: '37' } });
    selectWorkflowById('wf1');
    selectWorkflowById('wf-poll');

    testExec.execute.mockClear();
    fireEvent.click(screen.getByText('▶ Run Workflow'));

    expect(testExec.execute).toHaveBeenCalled();
    const dispatched = testExec.execute.mock.calls[0][0] as { maxConcurrentPolls?: number };
    expect(dispatched.maxConcurrentPolls).toBe(37);
  });

  it('shows recommended iteration hints when capturing full traces', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    selectWorkflowById('wf1');

    fireEvent.click(screen.getByRole('radio', { name: 'Full' }));
    await waitFor(() => expect(screen.getByText(/≤100 iters recommended/)).toBeInTheDocument());

    testExec.execute.mockClear();
    fireEvent.click(screen.getByText('▶ Run Workflow'));
    expect(testExec.execute.mock.calls[0][0]).toMatchObject({
      traceOptions: expect.objectContaining({ captureFullTrace: true, traceLevel: 'full' }),
    });
  });

  it('prioritizes single-transaction safeguards when correlations run in wait-for-real mode', async () => {
    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);

    selectWorkflowById('wf-corr');
    await waitFor(() => {
      expect(screen.getByText('CorrelationWait Behavior')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Load Profile' }));
    fireEvent.click(screen.getByRole('radio', { name: /Wait for Real Webhook/ }));

    testExec.execute.mockClear();
    fireEvent.click(screen.getByText('▶ Run Workflow'));

    const cfg = testExec.execute.mock.calls[0][0] as Record<string, unknown>;
    expect(cfg.concurrency).toBe(1);
    expect(cfg.iterations).toBe(1);
    expect(cfg.loadProfile).toBeUndefined();
    expect(cfg.correlationWaitConfig).toMatchObject({
      mode: 'wait-for-real',
    });
  });

  it('captures summarized progress blobs after synchronous workflow completions', async () => {
    const summary = makeSummary({ totalRequests: 2 });
    const { rerender } = render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);

    selectWorkflowById('wf1');
    fireEvent.click(screen.getByRole('radio', { name: 'Load Profile' }));

    testExec.finalRun = {
      results: [{ id: 'a' }],
      summary: { totalDurationMs: 2500 },
    };
    testExec.liveSummary = summary;
    testExec.isRunning = false;

    rerender(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);

    await waitFor(() =>
      expect(runnerProgressMocks.saveProgress).toHaveBeenCalledWith(
        '_workflow_runner_progress',
        expect.objectContaining({
          summary,
          isTimeBased: true,
          executionMode: 'workflow',
          resultCount: testExec.finalRun?.results?.length ?? 0,
          durationMs: 2500,
        }),
      ),
    );
  });

  it('creates flattened execution replay trace metadata for webhook load captures', async () => {
    const iterationTraces = [
      {
        index: 0,
        passed: true,
        durationMs: 40,
        events: [],
        finalVariables: {},
        traversedEdges: ['eas', 'ew'],
      },
    ];

    webhookDriverMocks.runWebhookLoadTest.mockResolvedValueOnce({
      results: [],
      totalRequests: 1,
      successCount: 1,
      failureCount: 0,
      avgResponseTimeMs: 10,
      minResponseTimeMs: 10,
      maxResponseTimeMs: 10,
      actualDurationMs: 400,
      actualRps: 1,
      iterationTraces,
    });

    const complete = vi.fn().mockResolvedValue(undefined);
    testExec.startExternalExecution.mockImplementation(() => ({
      reportProgress: vi.fn(),
      complete,
      fail: vi.fn(),
      abortSignal: new AbortController().signal,
    }));

    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);

    selectWorkflowById('wf-wh');
    fireEvent.click(screen.getByRole('button', { name: 'Load Test' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Full' }));
    fireEvent.click(screen.getByRole('button', { name: /Run Webhook Load Test/ }));

    await waitFor(() => expect(complete).toHaveBeenCalled());

    const traceArg = complete.mock.calls[0][1];

    expect(traceArg).toMatchObject({
      workflowId: wfWebhookStart.id,
      iterations: iterationTraces,
      fullTraceCaptured: true,
    });

    expect(traceArg.workflowSnapshot.nodes).toHaveLength(3);
  });

  it('allows gallery imports to hydrate workflow identifiers through onImportSample', async () => {
    render(<ImportSampleHarness />);

    fireEvent.click(screen.getByRole('button', { name: /Perf: Simple POST/ }));

    await waitFor(() => {
      expect(screen.queryByText('No workflows available')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('▶ Run Workflow'));
    expect(testExec.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: expect.stringContaining('perf-workflow-simple'),
      }),
      expect.any(Array),
      expect.objectContaining({
        projectName: 'Perf: Simple POST → GET',
      }),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('passes resolvedBaseUrl when workflow omits baseUrl variable', async () => {
    render(
      <WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} resolvedBaseUrl="https://env-host.example" />,
    );

    selectWorkflowById('wf2');
    await waitFor(() => expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument());

    testExec.execute.mockClear();
    fireEvent.click(screen.getByText('▶ Run Workflow'));

    const cfg = testExec.execute.mock.calls[0][0] as { workflowBaseUrl?: string };
    expect(cfg.workflowBaseUrl).toBe('https://env-host.example');
  });

  it('resolveSubWorkflow callback resolves gallery companion workflows by id', async () => {
    render(
      <WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} initialWorkflowId="wf1" onClearInitialWorkflowId={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument());

    fireEvent.click(screen.getByText('▶ Run Workflow'));

    const resolveSubWorkflow = testExec.execute.mock.calls[0][4] as ((id: string) => Workflow | undefined) | undefined;
    expect(resolveSubWorkflow).toBeTypeOf('function');
    const child = resolveSubWorkflow!('sample-subwf-child');
    expect(child?.id).toBe('sample-subwf-child');
    expect(child?.name).toContain('Child');
    expect(resolveSubWorkflow!('__no_such_workflow__')).toBeUndefined();
  });

  it('does not classify webhooks as entry triggers when start fans out beyond the webhook', async () => {
    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);
    selectWorkflowById('wf-wh-branch');

    await waitFor(() => expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument());
    expect(screen.queryByText('Run Mode:')).not.toBeInTheDocument();
  });

  it('surface non-network registration errors during webhook load startup', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('TLS handshake failed'));

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
      expect(fail).toHaveBeenCalledWith(expect.stringContaining('TLS handshake failed'));
    });
    expect(webhookDriverMocks.runWebhookLoadTest).not.toHaveBeenCalled();
  });

  it('defaults poll concurrency back to twenty when spinner value is emptied', async () => {
    render(<WorkflowRunner workflows={allWorkflowVariants} onComplete={vi.fn()} />);

    selectWorkflowById('wf-poll');
    await waitFor(() => expect(screen.getByText('Poll limit')).toBeInTheDocument());

    const pollWrap = screen.getByText('Poll limit').closest('.wf-inline-option')!;
    const pollSpinner = within(pollWrap as HTMLElement).getByRole('spinbutton');
    fireEvent.change(pollSpinner, { target: { value: '' } });

    testExec.execute.mockClear();
    fireEvent.click(screen.getByText('▶ Run Workflow'));

    const dispatched = testExec.execute.mock.calls[0][0] as { maxConcurrentPolls?: number };
    expect(dispatched.maxConcurrentPolls).toBe(20);
  });

  it('snapshots invalid sampling thresholds to the fifty-iteration safeguard', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    selectWorkflowById('wf1');
    fireEvent.click(screen.getByRole('radio', { name: 'Full' }));
    const thresholdInput = await waitFor(() => {
      const el = document.querySelector('.wf-sampling-threshold-input') as HTMLInputElement;
      expect(el).toBeTruthy();
      return el;
    });
    fireEvent.change(thresholdInput, {
      target: { value: 'not-a-number' },
    });

    testExec.execute.mockClear();
    fireEvent.click(screen.getByText('▶ Run Workflow'));

    expect(testExec.execute.mock.calls[0][0]).toMatchObject({
      traceOptions: expect.objectContaining({ samplingThreshold: 50 }),
    });
  });

});
