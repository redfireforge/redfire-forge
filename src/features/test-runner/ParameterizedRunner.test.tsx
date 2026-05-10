/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ParameterizedRunner from './ParameterizedRunner';
import type { FeatureGroup } from '../../shared/types';

const mockHandleRun = vi.fn();
const mockAbort = vi.fn();
const mockHandleClearProgress = vi.fn();
const mockConfirmSavePendingRun = vi.fn();
const mockDismissPendingRun = vi.fn();
const mockOnComplete = vi.fn();

let orchestrationOverrides: Record<string, unknown> = {};

vi.mock('./hooks/useRunnerOrchestration', () => ({
  useRunnerOrchestration: () => ({
    config: {
      concurrency: 1, setConcurrency: vi.fn(), iterations: 5, setIterations: vi.fn(),
      selectedScenarios: new Set<string>(['sc-param']), setSelectedScenarios: vi.fn(),
      weights: { t2: 1 }, setWeights: vi.fn(),
      skipValidation: false, setSkipValidation: vi.fn(),
      validationOverride: 'default', setValidationOverride: vi.fn(),
      forceUnordered: false, setForceUnordered: vi.fn(),
      hostMode: 'hardcoded', setHostMode: vi.fn(),
      customBaseUrl: '', setCustomBaseUrl: vi.fn(),
      executionMode: 'sequential', setExecutionMode: vi.fn(),
      loadProfile: { phases: [], maxConcurrency: 10 }, setLoadProfile: vi.fn(),
      thinkTime: { mode: 'none' }, setThinkTime: vi.fn(),
      timeoutSec: 0, setTimeoutSec: vi.fn(), retryCount: 0, setRetryCount: vi.fn(),
      retryDelayMs: 1000, setRetryDelayMs: vi.fn(),
      errorPolicy: 'continue', setErrorPolicy: vi.fn(),
      maxErrors: 0, setMaxErrors: vi.fn(), maxErrorRate: 0, setMaxErrorRate: vi.fn(),
      autoReport: false, setAutoReport: vi.fn(), autoReportFormat: 'html', setAutoReportFormat: vi.fn(),
    },
    execution: {
      isRunning: false, liveResults: [], error: null, abort: mockAbort,
      finalRun: null, pendingRun: null,
      confirmSavePendingRun: mockConfirmSavePendingRun,
      dismissPendingRun: mockDismissPendingRun,
    },
    selectedTests: [
      { id: 't2', name: 'POST User', method: 'POST', url: '/api/users', headers: [],
        validation: { mode: 'none' }, auth: { type: 'none' },
        dataSource: { columns: [{ id: 'c1', name: 'name' }], rows: [
          { id: 'r1', values: { c1: 'Alice' }, enabled: true },
          { id: 'r2', values: { c1: 'Bob' }, enabled: true },
        ] },
      },
    ],
    activeTests: [],
    activeTestCount: 1,
    allocation: { kind: 'parameterized', totalRequests: 10, items: [] },
    isLoadProfile: false,
    isGalleryEnv: false,
    weightsExpanded: true,
    setWeightsExpanded: vi.fn(),
    runnerTagFilter: '',
    setRunnerTagFilter: vi.fn(),
    savedProgress: null,
    handleClearProgress: mockHandleClearProgress,
    handleRun: mockHandleRun,
    updateProfile: vi.fn(),
    showProgress: false,
    displaySummary: null,
    displayTimeSeries: [],
    displayCompleted: 0,
    displayTotal: 0,
    displayProfileMeta: null,
    displayExecMode: 'sequential',
    displayConc: 1,
    displayLoadProfile: { phases: [], maxConcurrency: 10 },
    displayThinkTime: { mode: 'none' },
    hostLabel: 'Original',
    ...orchestrationOverrides,
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
  onComplete: vi.fn(),
  envName: 'Test Env',
  svcName: 'Test Svc',
};

describe('ParameterizedRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('renders execution config section', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Execution Mode:')).toBeInTheDocument();
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

  it('renders data rows badge for parameterized tests', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getAllByText(/📊 2 rows/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Test Distribution legend', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText(/Test Distribution/)).toBeInTheDocument();
  });

  it('renders weight input for selected tests', () => {
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    const weightInputs = screen.getAllByRole('spinbutton');
    expect(weightInputs.length).toBeGreaterThanOrEqual(1);
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

  it('renders completion section when finalRun exists', () => {
    orchestrationOverrides = {
      execution: {
        isRunning: false, liveResults: [], error: null, abort: mockAbort,
        finalRun: { id: 'r1', results: [1, 2, 3], summary: { totalDurationMs: 5000 } },
        pendingRun: null, confirmSavePendingRun: vi.fn(), dismissPendingRun: vi.fn(),
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} onComplete={mockOnComplete} envName="E" svcName="S" />);
    expect(screen.getByText(/Test completed/)).toBeInTheDocument();
    expect(screen.getByText('View Full Results →')).toBeInTheDocument();
    orchestrationOverrides = {};
  });

  it('renders saved progress when available', () => {
    orchestrationOverrides = {
      savedProgress: { resultCount: 42, durationMs: 3000, summary: {} },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} onComplete={mockOnComplete} envName="E" svcName="S" />);
    expect(screen.getByText(/Last run/)).toBeInTheDocument();
    expect(screen.getByText(/42 requests/)).toBeInTheDocument();
    orchestrationOverrides = {};
  });

  it('renders error banner when error exists', () => {
    orchestrationOverrides = {
      execution: {
        isRunning: false, liveResults: [], error: 'Connection failed', abort: mockAbort,
        finalRun: null, pendingRun: null, confirmSavePendingRun: vi.fn(), dismissPendingRun: vi.fn(),
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    orchestrationOverrides = {};
  });

  it('renders stop button when running', () => {
    orchestrationOverrides = {
      execution: {
        isRunning: true, liveResults: [], error: null, abort: mockAbort,
        finalRun: null, pendingRun: null, confirmSavePendingRun: vi.fn(), dismissPendingRun: vi.fn(),
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText('■ Stop')).toBeInTheDocument();
    orchestrationOverrides = {};
  });

  it('renders pending run storage banner', () => {
    orchestrationOverrides = {
      execution: {
        isRunning: false, liveResults: [], error: null, abort: mockAbort,
        finalRun: null, pendingRun: { id: 'p1' },
        confirmSavePendingRun: mockConfirmSavePendingRun, dismissPendingRun: mockDismissPendingRun,
      },
    };
    render(<ParameterizedRunner featureGroups={mixedFeatureGroups} {...defaultProps} />);
    expect(screen.getByText(/Storage full/)).toBeInTheDocument();
    expect(screen.getByText(/Yes, remove old runs/)).toBeInTheDocument();
    expect(screen.getByText(/Discard this run/)).toBeInTheDocument();
    orchestrationOverrides = {};
  });
});
