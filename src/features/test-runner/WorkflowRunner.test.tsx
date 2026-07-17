/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowRunner from './WorkflowRunner';
import {
  mockWorkflows,
  selectWorkflowById,
} from './__test-utils__/workflowRunnerTestHelpers';
import {
  cleanupWorkflowRunnerSplitTestGlobals,
  resetWorkflowRunnerSplitTestState,
} from './__test-utils__/workflowRunnerSplitTestSetup';
import { defaultLoadProfile } from './hooks/runnerConfigDefaults';
import type { PersistedProgress } from './utils/runnerProgressStorage';
import type { TestSummary } from '../../../shared/types';
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
    resetWorkflowRunnerSplitTestState({
      testExec,
      runnerProgressMocks,
      storageMocks,
      webhookDriverMocks,
      webhookScenarioMocks,
      saveWorkflowRunConfigMock: vi.mocked(saveWorkflowRunConfig),
    });
  });

  afterEach(() => {
    cleanupWorkflowRunnerSplitTestGlobals();
  });

  it('renders page header', () => {
    render(<WorkflowRunner workflows={[]} onComplete={vi.fn()} />);
    
    expect(screen.getByText('Workflow Runner')).toBeInTheDocument();
  });

  it('renders empty state when no workflows', () => {
    render(<WorkflowRunner workflows={[]} onComplete={vi.fn()} />);
    
    expect(screen.getByText('No workflows available')).toBeInTheDocument();
    expect(screen.getByText(/Create a workflow in the Workflow Designer/)).toBeInTheDocument();
  });

  it('renders workflow selector when workflows exist', () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    expect(screen.getByText('Select a workflow…')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('workflow-select'));
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText('Another Workflow')).toBeInTheDocument();
  });

  it('shows run button after selecting a workflow and invokes execute when clicked', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    selectWorkflowById('wf1');
    
    await waitFor(() => {
      expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('▶ Run Workflow'));
    expect(testExec.execute).toHaveBeenCalled();
  });

  it('shows workflow step count after selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    selectWorkflowById('wf1');
    
    await waitFor(() => {
      expect(screen.getByText('2 HTTP steps')).toBeInTheDocument();
    });
  });

  it('shows workflow step names after selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    selectWorkflowById('wf1');
    
    await waitFor(() => {
      expect(screen.getByText(/Get Users → Get Orders/)).toBeInTheDocument();
    });
  });

  it('shows variables section when workflow has variables', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    selectWorkflowById('wf1');
    
    await waitFor(() => {
      expect(screen.getByText('Initial Variables')).toBeInTheDocument();
      expect(screen.getByText('baseUrl')).toBeInTheDocument();
    });
  });

  it('does not show execution config before selecting workflow', () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    expect(screen.queryByText('Execution Mode:')).not.toBeInTheDocument();
  });

  it('shows execution config after selecting workflow', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    selectWorkflowById('wf1');
    
    await waitFor(() => {
      expect(screen.getByText('Execution Mode:')).toBeInTheDocument();
    });
  });

  it('allows clearing workflow selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    selectWorkflowById('wf1');
    
    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Clear'));
    
    await waitFor(() => {
      expect(screen.queryByText('▶ Run Workflow')).not.toBeInTheDocument();
    });
  });

  it('pre-selects workflow when initialWorkflowId is provided', async () => {
    const onClearInitialWorkflowId = vi.fn();
    render(
      <WorkflowRunner
        workflows={mockWorkflows}
        onComplete={vi.fn()}
        initialWorkflowId="wf2"
        onClearInitialWorkflowId={onClearInitialWorkflowId}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument();
      expect(screen.getByText('1 HTTP step')).toBeInTheDocument();
    });
    
    expect(onClearInitialWorkflowId).toHaveBeenCalled();
  });

  it('does not pre-select if initialWorkflowId does not match any workflow', async () => {
    const onClearInitialWorkflowId = vi.fn();
    render(
      <WorkflowRunner
        workflows={mockWorkflows}
        onComplete={vi.fn()}
        initialWorkflowId="non-existent"
        onClearInitialWorkflowId={onClearInitialWorkflowId}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('▶ Run Workflow')).not.toBeInTheDocument();
    });

    expect(onClearInitialWorkflowId).not.toHaveBeenCalled();
  });

  it('shows completion banner and calls onComplete after final run', async () => {
    const onComplete = vi.fn();
    const { rerender } = render(<WorkflowRunner workflows={mockWorkflows} onComplete={onComplete} />);
    selectWorkflowById('wf1');
    await waitFor(() => expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument());
    testExec.finalRun = { results: [{}, {}], summary: { totalDurationMs: 4000 } };
    rerender(<WorkflowRunner workflows={mockWorkflows} onComplete={onComplete} />);
    expect(screen.getByText(/Workflow completed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Full Results/ }));
    expect(onComplete).toHaveBeenCalledWith('workflow');
  });

  it('shows error banner when execution error is set', () => {
    testExec.error = 'Run blew up';
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    expect(screen.getByText('Run blew up')).toBeInTheDocument();
  });

  it('shows storage quota banner with confirm action', async () => {
    testExec.pendingRun = {} as unknown;
    const { rerender } = render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    rerender(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    expect(screen.getByText(/Storage full/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Yes, remove old runs/ }));
    expect(testExec.confirmSavePendingRun).toHaveBeenCalled();
  });

  it('shows storage quota banner with discard action', async () => {
    testExec.pendingRun = {} as unknown;
    const { rerender } = render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    rerender(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Discard this run/ }));
    expect(testExec.dismissPendingRun).toHaveBeenCalled();
  });

  it('shows last run banner from persisted progress', async () => {
    const summary = {
      tps: 1,
      avgResponseTime: 10,
      minResponseTime: 10,
      maxResponseTime: 10,
      p50ResponseTime: 10,
      p95ResponseTime: 10,
      p99ResponseTime: 10,
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: 1,
      successfulRequests: 1,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs: 1000,
    };
    const saved: PersistedProgress = {
      summary,
      timeSeries: [],
      completed: 1,
      total: 1,
      profileMeta: null,
      isTimeBased: false,
      executionMode: 'workflow',
      concurrency: 1,
      loadProfile: { ...defaultLoadProfile },
      resultCount: 5,
      durationMs: 6000,
    };
    runnerProgressMocks.loadProgress.mockReturnValue(saved);
    const onComplete = vi.fn();
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={onComplete} />);
    selectWorkflowById('wf1');
    await waitFor(() => expect(screen.getByText(/Last run — 5 requests/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Full Results/ }));
    expect(onComplete).toHaveBeenCalledWith('workflow');
  });

  it('clears saved progress from the live progress panel', async () => {
    const summary = {
      tps: 1,
      avgResponseTime: 10,
      minResponseTime: 10,
      maxResponseTime: 10,
      p50ResponseTime: 10,
      p95ResponseTime: 10,
      p99ResponseTime: 10,
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: 1,
      successfulRequests: 1,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs: 1000,
    };
    const saved: PersistedProgress = {
      summary,
      timeSeries: [],
      completed: 1,
      total: 1,
      profileMeta: null,
      isTimeBased: false,
      executionMode: 'workflow',
      concurrency: 1,
      loadProfile: { ...defaultLoadProfile },
      resultCount: 2,
      durationMs: 1000,
    };
    runnerProgressMocks.loadProgress.mockReturnValue(saved);
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    selectWorkflowById('wf1');
    await waitFor(() => expect(screen.getByTitle('Clear progress')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Clear progress'));
    expect(runnerProgressMocks.clearProgress).toHaveBeenCalled();
  });

  // ── Phase 3C: initialWorkflowVariables ─────────────────────────────────

  it('applies initialWorkflowVariables to local state and clears', async () => {
    const onClear = vi.fn();
    render(
      <WorkflowRunner
        workflows={mockWorkflows}
        onComplete={vi.fn()}
        initialWorkflowVariables={{ kafka_message: '{"id":1}', kafka_topic: 'orders' }}
        onClearInitialWorkflowVariables={onClear}
      />,
    );

    selectWorkflowById('wf1');

    await waitFor(() => {
      expect(onClear).toHaveBeenCalled();
    });
  });

  it('ignores null initialWorkflowVariables', async () => {
    const onClear = vi.fn();
    render(
      <WorkflowRunner
        workflows={mockWorkflows}
        onComplete={vi.fn()}
        initialWorkflowVariables={null}
        onClearInitialWorkflowVariables={onClear}
      />,
    );

    selectWorkflowById('wf1');

    await waitFor(() => {
      expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument();
    });

    expect(onClear).not.toHaveBeenCalled();
  });

  // ── Phase 3D: onWorkflowOutputAvailable ────────────────────────────────

  it('calls onWorkflowOutputAvailable when finalRun has trace variables', async () => {
    const onOutput = vi.fn();
    const { rerender } = render(
      <WorkflowRunner
        workflows={mockWorkflows}
        onComplete={vi.fn()}
        onWorkflowOutputAvailable={onOutput}
      />,
    );

    selectWorkflowById('wf1');

    await waitFor(() => {
      expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument();
    });

    testExec.finalRun = {
      results: [{}],
      summary: { totalDurationMs: 1000 },
      executionTrace: {
        iterations: [
          { finalVariables: { result: '42', total: '100' } },
        ],
      },
    } as unknown as typeof testExec.finalRun;

    rerender(
      <WorkflowRunner
        workflows={mockWorkflows}
        onComplete={vi.fn()}
        onWorkflowOutputAvailable={onOutput}
      />,
    );

    await waitFor(() => {
      expect(onOutput).toHaveBeenCalledWith({ result: '42', total: '100' });
    });
  });

  it('__wfRunnerSelectAndRun returns false when workflow name is missing', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    await waitFor(() => {
      expect(
        (window as unknown as { __wfRunnerSelectAndRun?: (n: string) => boolean }).__wfRunnerSelectAndRun,
      ).toBeDefined();
    });
    const selectAndRun = (window as unknown as { __wfRunnerSelectAndRun: (n: string) => boolean })
      .__wfRunnerSelectAndRun;
    expect(selectAndRun('Missing Workflow')).toBe(false);
    expect(testExec.execute).not.toHaveBeenCalled();
  });

  it('__wfRunnerSelectAndRun selects by name and starts execution', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    await waitFor(() => {
      expect(
        (window as unknown as { __wfRunnerSelectAndRun?: (n: string) => boolean }).__wfRunnerSelectAndRun,
      ).toBeDefined();
    });
    const win = window as unknown as {
      __wfRunnerApplyBatchConfig: (i: number, c: number) => boolean;
      __wfRunnerSelectAndRun: (n: string) => boolean;
    };
    expect(win.__wfRunnerApplyBatchConfig(3, 1)).toBe(true);
    expect(win.__wfRunnerSelectAndRun('Test Workflow')).toBe(true);
    expect(testExec.execute).toHaveBeenCalled();
    const config = testExec.execute.mock.calls[0]?.[0] as {
      iterations: number;
      concurrency: number;
      traceOptions?: { traceLevel?: string };
    };
    expect(config.iterations).toBe(3);
    expect(config.concurrency).toBe(1);
    expect(config.traceOptions?.traceLevel).toBe('standard');
  });

});
