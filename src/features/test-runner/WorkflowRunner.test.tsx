/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowRunner from './WorkflowRunner';
import type { Workflow } from '../workflow/types/workflow';
import { defaultLoadProfile } from './hooks/useRunnerConfig';
import type { PersistedProgress } from './utils/runnerProgressStorage';

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

const testExec = vi.hoisted(() => ({
  isRunning: false,
  completed: 0,
  total: 0,
  liveSummary: null as import('../../../shared/types').TestSummary | null,
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
}));

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
  updateWorkflowRunConfigLabel: vi.fn(),
  deleteWorkflowRunConfig: vi.fn(),
  formatConfigLabel: vi.fn().mockReturnValue('Config'),
  formatRelativeTime: vi.fn().mockReturnValue('just now'),
}));

const mockWorkflows: Workflow[] = [
  {
    id: 'wf1',
    name: 'Test Workflow',
    nodes: [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Get Users' } },
      { id: 'n2', type: 'http', position: { x: 100, y: 0 }, data: { label: 'Get Orders' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    variables: { baseUrl: 'https://api.example.com' },
  },
  {
    id: 'wf2',
    name: 'Another Workflow',
    nodes: [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Health Check' } },
    ],
    edges: [],
    variables: {},
  },
];

describe('WorkflowRunner', () => {
  beforeEach(() => {
    testExec.execute.mockClear();
    testExec.abort.mockClear();
    testExec.confirmSavePendingRun.mockClear();
    testExec.dismissPendingRun.mockClear();
    testExec.isRunning = false;
    testExec.completed = 0;
    testExec.total = 0;
    testExec.liveSummary = null;
    testExec.finalRun = null;
    testExec.error = null;
    testExec.pendingRun = null;
    runnerProgressMocks.loadProgress.mockReturnValue(null);
    storageMocks.loadRunnerConfig.mockReset();
    storageMocks.loadRunnerConfig.mockResolvedValue(null);
    storageMocks.saveRunnerConfig.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders page header', () => {
    render(<WorkflowRunner workflows={[]} onComplete={vi.fn()} />);
    
    expect(screen.getByText('Workflow Runner')).toBeInTheDocument();
  });

  it('renders empty state when no workflows', () => {
    render(<WorkflowRunner workflows={[]} onComplete={vi.fn()} />);
    
    expect(screen.getByText('No workflows available')).toBeInTheDocument();
    expect(screen.getByText(/Create a workflow in the Workflow Designer first/)).toBeInTheDocument();
  });

  it('renders workflow selector when workflows exist', () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    expect(screen.getByText('Select a workflow...')).toBeInTheDocument();
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText('Another Workflow')).toBeInTheDocument();
  });

  it('shows run button after selecting a workflow and invokes execute when clicked', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText('▶ Run Workflow')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('▶ Run Workflow'));
    expect(testExec.execute).toHaveBeenCalled();
  });

  it('shows workflow step count after selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText('2 HTTP steps')).toBeInTheDocument();
    });
  });

  it('shows workflow step names after selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText(/Get Users → Get Orders/)).toBeInTheDocument();
    });
  });

  it('shows variables section when workflow has variables', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
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
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
    await waitFor(() => {
      expect(screen.getByText('Execution Mode:')).toBeInTheDocument();
    });
  });

  it('allows clearing workflow selection', async () => {
    render(<WorkflowRunner workflows={mockWorkflows} onComplete={vi.fn()} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'wf1' } });
    
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
      expect(onClearInitialWorkflowId).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText('▶ Run Workflow')).not.toBeInTheDocument();
    });
  });

  it('shows completion banner and calls onComplete after final run', async () => {
    const onComplete = vi.fn();
    const { rerender } = render(<WorkflowRunner workflows={mockWorkflows} onComplete={onComplete} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wf1' } });
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
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wf1' } });
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
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wf1' } });
    await waitFor(() => expect(screen.getByTitle('Clear progress')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Clear progress'));
    expect(runnerProgressMocks.clearProgress).toHaveBeenCalled();
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
    const combo = screen.getByRole('combobox') as HTMLSelectElement;
    if (combo.value !== 'wf1') {
      fireEvent.change(combo, { target: { value: 'wf1' } });
    }
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
    const cfg = testExec.execute.mock.calls[0][0] as { totalTransactions: number; loadProfile?: unknown };
    expect(cfg.totalTransactions).toBe(0);
    expect(cfg.loadProfile).toBeDefined();
  });
});
