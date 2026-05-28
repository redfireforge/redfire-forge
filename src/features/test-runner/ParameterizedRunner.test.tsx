/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ParameterizedRunner from './ParameterizedRunner';
import type { FeatureGroup } from '../../shared/types';

const orch = vi.hoisted(() => ({
  overrides: {} as Record<string, unknown>,
  mockHandleRun: vi.fn(),
  mockAbort: vi.fn(),
  mockHandleClearProgress: vi.fn(),
  mockConfirmSavePendingRun: vi.fn(),
  mockDismissPendingRun: vi.fn(),
  mockSetWeights: vi.fn(),
  mockSetWeightsExpanded: vi.fn(),
  mockSetRunnerTagFilter: vi.fn(),
  mockSetThinkTime: vi.fn(),
  mockOnComplete: vi.fn(),
}));

function baseOrchestration() {
  return {
    config: {
      concurrency: 1, setConcurrency: vi.fn(), iterations: 5, setIterations: vi.fn(),
      selectedScenarios: new Set<string>(['sc-param']), setSelectedScenarios: vi.fn(),
      weights: { t2: 1 }, setWeights: orch.mockSetWeights,
      skipValidation: false, setSkipValidation: vi.fn(),
      validationOverride: 'default', setValidationOverride: vi.fn(),
      forceUnordered: 'default' as const, setForceUnordered: vi.fn(),
      hostMode: 'hardcoded', setHostMode: vi.fn(),
      customBaseUrl: '', setCustomBaseUrl: vi.fn(),
      executionMode: 'sequential', setExecutionMode: vi.fn(),
      loadProfile: { phases: [], maxConcurrency: 10 }, setLoadProfile: vi.fn(),
      thinkTime: { mode: 'none' }, setThinkTime: orch.mockSetThinkTime,
      timeoutSec: 0, setTimeoutSec: vi.fn(), retryCount: 0, setRetryCount: vi.fn(),
      retryDelayMs: 1000, setRetryDelayMs: vi.fn(),
      errorPolicy: 'continue', setErrorPolicy: vi.fn(),
      maxErrors: 0, setMaxErrors: vi.fn(), maxErrorRate: 0, setMaxErrorRate: vi.fn(),
      autoReport: false, setAutoReport: vi.fn(), autoReportFormat: 'html', setAutoReportFormat: vi.fn(),
    },
    execution: {
      isRunning: false, liveResults: [], error: null, abort: orch.mockAbort,
      finalRun: null, pendingRun: null,
      confirmSavePendingRun: orch.mockConfirmSavePendingRun,
      dismissPendingRun: orch.mockDismissPendingRun,
    },
    selectedTests: [
      {
        id: 't2', name: 'POST User', method: 'POST', url: '/api/users', headers: [],
        validation: { mode: 'none' }, auth: { type: 'none' },
        dataSource: {
          columns: [{ id: 'c1', name: 'name' }],
          rows: [
            { id: 'r1', values: { c1: 'Alice' }, enabled: true },
            { id: 'r2', values: { c1: 'Bob' }, enabled: true },
          ],
        },
      },
    ],
    activeTests: [],
    activeTestCount: 1,
    allocation: {
      kind: 'parameterized' as const,
      totalRequests: 10,
      items: [{ testId: 't2', testName: 'POST User', iterations: 5, rowCount: 2, totalRequests: 10 }],
    },
    isLoadProfile: false,
    isGalleryEnv: false,
    weightsExpanded: true,
    setWeightsExpanded: orch.mockSetWeightsExpanded,
    runnerTagFilter: '',
    setRunnerTagFilter: orch.mockSetRunnerTagFilter,
    savedProgress: null,
    handleClearProgress: orch.mockHandleClearProgress,
    handleRun: orch.mockHandleRun,
    updateProfile: vi.fn(),
    showProgress: false,
    displaySummary: null,
    displayTimeSeries: [],
    displayCompleted: 0,
    displayTotal: 0,
    displayProfileMeta: null,
    displayExecMode: 'sequential' as const,
    displayConc: 1,
    displayLoadProfile: { phases: [], maxConcurrency: 10, durationSec: 60, type: 'constant' },
    displayThinkTime: { mode: 'none' },
    hostLabel: 'Original',
    runnerSlaTargets: [],
    setRunnerSlaTargets: vi.fn(),
    selectedSlaScenarioNames: [],
    selectedSlaTestNames: [],
    definitionSlaTargetCount: 0,
    definitionSlaTargets: [],
  };
}

vi.mock('./hooks/useRunnerOrchestration', () => ({
  useRunnerOrchestration: () => ({
    ...baseOrchestration(),
    ...orch.overrides,
  }),
}));

const mixedFeatureGroups: FeatureGroup[] = [
  {
    id: 'fg1',
    name: 'User API',
    scenarios: [
      {
        id: 'sc-std',
        name: 'Standard Scenario',
        kind: 'standard',
        tests: [
          { id: 't1', name: 'GET User', method: 'GET', url: '/api/users', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } },
        ],
      },
      {
        id: 'sc-param',
        name: 'Parameterized Scenario',
        kind: 'parameterized',
        tests: [
          {
            id: 't2',
            name: 'POST User',
            method: 'POST',
            url: '/api/users',
            headers: [],
            validation: { mode: 'none' },
            auth: { type: 'none' },
            dataSource: {
              columns: [{ id: 'c1', name: 'name' }],
              rows: [
                { id: 'r1', values: { c1: 'Alice' }, enabled: true },
                { id: 'r2', values: { c1: 'Bob' }, enabled: true },
              ],
            },
          },
        ],
      },
    ],
  },
];

const emptyStandardOnlyGroups: FeatureGroup[] = [
  {
    id: 'fg1',
    name: 'Standard Only',
    scenarios: [
      {
        id: 'sc1',
        name: 'Standard',
        kind: 'standard',
        tests: [{ id: 't1', name: 'Test', method: 'GET', url: '/api', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }],
      },
    ],
  },
];

const defaultProps = {
  onComplete: orch.mockOnComplete,
  envName: 'Test Env',
  svcName: 'Test Svc',
};

const selectedTestsWithTags = [
  {
    id: 't-tag',
    name: 'Tagged Test',
    method: 'GET',
    url: '/api/x',
    headers: [],
    validation: { mode: 'none' },
    auth: { type: 'none' },
    dataSource: {
      columns: [{ id: 'c1', name: 'n' }],
      rows: [
        { id: 'r1', values: { c1: 'a' }, enabled: true, tags: ['happy-path'] },
      ],
    },
  },
];

describe('ParameterizedRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orch.overrides = {};
  });

  afterEach(() => {
    orch.overrides = {};
  });

  it('renders with "Parameterized Runner" title', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Parameterized Runner')).toBeInTheDocument();
  });

  it('shows context tags for env and svc', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Test Env')).toBeInTheDocument();
    expect(screen.getByText('Test Svc')).toBeInTheDocument();
  });

  it('omits env/svc context tags when props are omitted', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} onComplete={orch.mockOnComplete} />);
    expect(screen.queryByText('Test Env')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Svc')).not.toBeInTheDocument();
  });

  it('shows parameterized scenarios only (hides standard)', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Parameterized Scenario')).toBeInTheDocument();
    expect(screen.queryByText('Standard Scenario')).not.toBeInTheDocument();
  });

  it('shows empty state when no parameterized scenarios exist', () => {
    render(<ParameterizedRunner featureGroups={emptyStandardOnlyGroups} {...defaultProps} />);
    expect(screen.getByText(/No parameterized scenarios defined/)).toBeInTheDocument();
  });

  it('shows empty state for empty feature groups', () => {
    render(<ParameterizedRunner featureGroups={[]} {...defaultProps} />);
    expect(screen.getByText(/No parameterized scenarios defined/)).toBeInTheDocument();
  });

  it('shows empty state when parameterized scenario has zero tests', () => {
    const noTests: FeatureGroup[] = [{
      id: 'fg',
      name: 'G',
      scenarios: [{
        id: 'sc-param', name: 'P', kind: 'parameterized', tests: [],
      }],
    }];
    render(<ParameterizedRunner featureGroups={noTests} {...defaultProps} />);
    expect(screen.getByText(/No parameterized scenarios defined/)).toBeInTheDocument();
  });

  it('renders execution config section', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Execution Mode:')).toBeInTheDocument();
  });

  it('merges think-time patch via functional setThinkTime updater', () => {
    const { container } = render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    const thinkSection = container.querySelector('.think-time-section');
    expect(thinkSection).toBeTruthy();
    fireEvent.click(within(thinkSection as HTMLElement).getByRole('radio', { name: 'Constant' }));
    expect(orch.mockSetThinkTime).toHaveBeenCalled();
    const updaterFn = orch.mockSetThinkTime.mock.calls[0][0] as (prev: { mode: string; constantMs?: number }) => Record<string, unknown>;
    expect(updaterFn({ mode: 'none' })).toEqual({ mode: 'constant' });
    expect(updaterFn({ mode: 'none', constantMs: 50 })).toEqual({ mode: 'constant', constantMs: 50 });
  });

  it('renders host selector', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Host:')).toBeInTheDocument();
  });

  it('does not show standard-only empty state when param scenarios exist', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.queryByText(/No parameterized scenarios defined/)).not.toBeInTheDocument();
  });

  it('renders Run Parameterized Test button', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('▶ Run Parameterized Test')).toBeInTheDocument();
  });

  it('invokes handleRun when Run is clicked', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    fireEvent.click(screen.getByText('▶ Run Parameterized Test'));
    expect(orch.mockHandleRun).toHaveBeenCalledTimes(1);
  });

  it('does not render Run control when hook reports no selected tests', () => {
    orch.overrides = { selectedTests: [] };
    const { container } = render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.queryByText('▶ Run Parameterized Test')).not.toBeInTheDocument();
    expect(container.querySelector('.form-actions')).toBeNull();
  });

  it('renders data rows badge for parameterized tests', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getAllByText(/📊 2 rows/).length).toBeGreaterThanOrEqual(1);
  });

  it('does not render rows badge on weight rows when no enabled data rows', () => {
    orch.overrides = {
      selectedTests: [{
        id: 't-empty',
        name: 'No rows',
        method: 'GET',
        url: '/x',
        headers: [],
        validation: { mode: 'none' },
        auth: { type: 'none' },
        dataSource: {
          columns: [{ id: 'c1', name: 'n' }],
          rows: [{ id: 'r1', values: {}, enabled: false }],
        },
      }],
    };
    const { container } = render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(container.querySelector('.weight-row .count-badge-data')).toBeNull();
  });

  it('renders Test Distribution legend', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText(/Test Distribution/)).toBeInTheDocument();
  });

  it('toggles weights section via collapsible legend', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    fireEvent.click(screen.getByText(/Test Distribution/));
    expect(orch.mockSetWeightsExpanded).toHaveBeenCalled();
    const updater = orch.mockSetWeightsExpanded.mock.calls[0][0] as (v: boolean) => boolean;
    expect(updater(true)).toBe(false);
    expect(updater(false)).toBe(true);
  });

  it('calls setWeights when weight input changes', () => {
    const { container } = render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    const weightInput = container.querySelector('input.weight-input') as HTMLInputElement;
    expect(weightInput).toBeTruthy();
    fireEvent.change(weightInput, { target: { value: '7' } });
    expect(orch.mockSetWeights).toHaveBeenCalledWith({ t2: 7 });
  });

  it('coerces non-numeric weight input to 0', () => {
    const { container } = render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    const weightInput = container.querySelector('input.weight-input') as HTMLInputElement;
    fireEvent.change(weightInput, { target: { value: '' } });
    expect(orch.mockSetWeights).toHaveBeenCalledWith({ t2: 0 });
  });

  it('sets all weights to 1 via Reset All to 1', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    fireEvent.click(screen.getByText('Reset All to 1'));
    expect(orch.mockSetWeights).toHaveBeenCalledWith({ t2: 1 });
  });

  it('sets all weights to 0 via Reset All to 0', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    fireEvent.click(screen.getByText('Reset All to 0'));
    expect(orch.mockSetWeights).toHaveBeenCalledWith({ t2: 0 });
  });

  it('renders weight input for selected tests when expanded', () => {
    const { container } = render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(container.querySelectorAll('input.weight-input').length).toBeGreaterThanOrEqual(1);
  });

  it('hides weight rows when weightsExpanded is false', () => {
    orch.overrides = { weightsExpanded: false };
    const { container } = render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(container.querySelector('input.weight-input')).toBeNull();
    expect(screen.getByText(/Test Distribution/)).toBeInTheDocument();
  });

  it('renders method badge for test', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('POST')).toBeInTheDocument();
  });

  it('renders Reset All to 1 and Reset All to 0 buttons', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Reset All to 1')).toBeInTheDocument();
    expect(screen.getByText('Reset All to 0')).toBeInTheDocument();
  });

  it('renders ExecutionPlan preview when not load profile', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Execution Plan')).toBeInTheDocument();
  });

  it('hides ExecutionPlan preview under load profile', () => {
    orch.overrides = { isLoadProfile: true };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.queryByText('Execution Plan')).not.toBeInTheDocument();
  });

  it('renders tag filter when tagged data rows exist', () => {
    orch.overrides = { selectedTests: selectedTestsWithTags };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText(/Tag Filter/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/happy-path/)).toBeInTheDocument();
  });

  it('updates tag filter via onChange', () => {
    orch.overrides = { selectedTests: selectedTestsWithTags };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    const input = screen.getByPlaceholderText(/happy-path/);
    fireEvent.change(input, { target: { value: 'smoke, a' } });
    expect(orch.mockSetRunnerTagFilter).toHaveBeenCalledWith('smoke, a');
  });

  it('shows hint when runnerTagFilter is preset', () => {
    orch.overrides = {
      selectedTests: selectedTestsWithTags,
      runnerTagFilter: 'tag-a',
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText(/Only rows matching these tags will run/)).toBeInTheDocument();
  });

  it('renders LiveProgressPanel when showProgress is true', () => {
    orch.overrides = { showProgress: true, displayTotal: 5 };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Progress/ })).toBeInTheDocument();
  });

  it('passes onClear when progress shown, not running, and savedProgress exists', () => {
    orch.overrides = {
      showProgress: true,
      displayTotal: 3,
      savedProgress: { resultCount: 1, durationMs: 1000, summary: {} },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Clear progress'));
    expect(orch.mockHandleClearProgress).toHaveBeenCalled();
  });

  it('does not render clear progress button when running', () => {
    orch.overrides = {
      showProgress: true,
      savedProgress: { resultCount: 1, durationMs: 1000, summary: {} },
      execution: {
        isRunning: true,
        liveResults: [],
        error: null,
        abort: orch.mockAbort,
        finalRun: null,
        pendingRun: null,
        confirmSavePendingRun: orch.mockConfirmSavePendingRun,
        dismissPendingRun: orch.mockDismissPendingRun,
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.queryByTitle('Clear progress')).not.toBeInTheDocument();
  });

  it('renders completion section when finalRun exists and calls onComplete', () => {
    orch.overrides = {
      execution: {
        isRunning: false,
        liveResults: [],
        error: null,
        abort: orch.mockAbort,
        finalRun: {
          id: 'r1',
          results: [1, 2, 3] as unknown[],
          summary: { totalDurationMs: 5000 },
        },
        pendingRun: null,
        confirmSavePendingRun: orch.mockConfirmSavePendingRun,
        dismissPendingRun: orch.mockDismissPendingRun,
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText(/Test completed/)).toBeInTheDocument();
    expect(screen.getByText(/3 requests in 5\.00s/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('View Full Results →'));
    expect(orch.mockOnComplete).toHaveBeenCalledWith('test');
  });

  it('renders saved progress when available without finalRun and calls onComplete', () => {
    orch.overrides = {
      savedProgress: { resultCount: 42, durationMs: 3000, summary: {} },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText(/Last run/)).toBeInTheDocument();
    expect(screen.getByText(/42 requests in 3\.00s/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('View Full Results →'));
    expect(orch.mockOnComplete).toHaveBeenCalledWith('test');
  });

  it('renders error banner when error exists', () => {
    orch.overrides = {
      execution: {
        isRunning: false,
        liveResults: [],
        error: 'Connection failed',
        abort: orch.mockAbort,
        finalRun: null,
        pendingRun: null,
        confirmSavePendingRun: orch.mockConfirmSavePendingRun,
        dismissPendingRun: orch.mockDismissPendingRun,
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('renders stop button when running and invokes abort', () => {
    orch.overrides = {
      execution: {
        isRunning: true,
        liveResults: [],
        error: null,
        abort: orch.mockAbort,
        finalRun: null,
        pendingRun: null,
        confirmSavePendingRun: orch.mockConfirmSavePendingRun,
        dismissPendingRun: orch.mockDismissPendingRun,
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('■ Stop')).toBeInTheDocument();
    fireEvent.click(screen.getByText('■ Stop'));
    expect(orch.mockAbort).toHaveBeenCalledTimes(1);
  });

  it('renders pending run storage banner and action buttons', () => {
    orch.overrides = {
      execution: {
        isRunning: false,
        liveResults: [],
        error: null,
        abort: orch.mockAbort,
        finalRun: null,
        pendingRun: { id: 'p1' },
        confirmSavePendingRun: orch.mockConfirmSavePendingRun,
        dismissPendingRun: orch.mockDismissPendingRun,
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText(/Storage full/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Yes, remove old runs/));
    expect(orch.mockConfirmSavePendingRun).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText(/Discard this run/));
    expect(orch.mockDismissPendingRun).toHaveBeenCalledTimes(1);
  });
});
