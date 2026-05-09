/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ParameterizedRunner from './ParameterizedRunner';
import type { FeatureGroup } from '../../shared/types';

vi.mock('./hooks/useTestExecution', () => ({
  useTestExecution: () => ({
    isRunning: false,
    completed: 0,
    total: 0,
    liveSummary: null,
    liveResults: [],
    profileMeta: null,
    timeSeries: [],
    error: null,
    execute: vi.fn(),
    abort: vi.fn(),
    finalRun: null,
    pendingRun: null,
    confirmSavePendingRun: vi.fn(),
    dismissPendingRun: vi.fn(),
  }),
}));

vi.mock('./hooks/useRunnerConfig', () => ({
  useRunnerConfig: () => ({
    concurrency: 1,
    setConcurrency: vi.fn(),
    iterations: 5,
    setIterations: vi.fn(),
    selectedScenarios: new Set<string>(),
    setSelectedScenarios: vi.fn(),
    weights: {},
    setWeights: vi.fn(),
    skipValidation: false,
    setSkipValidation: vi.fn(),
    validationOverride: 'default' as const,
    setValidationOverride: vi.fn(),
    forceUnordered: false,
    setForceUnordered: vi.fn(),
    hostMode: 'hardcoded' as const,
    setHostMode: vi.fn(),
    customBaseUrl: '',
    setCustomBaseUrl: vi.fn(),
    executionMode: 'sequential' as const,
    setExecutionMode: vi.fn(),
    loadProfile: { phases: [], maxConcurrency: 10 },
    setLoadProfile: vi.fn(),
    thinkTime: { mode: 'none' as const },
    setThinkTime: vi.fn(),
    timeoutSec: 0,
    setTimeoutSec: vi.fn(),
    retryCount: 0,
    setRetryCount: vi.fn(),
    retryDelayMs: 1000,
    setRetryDelayMs: vi.fn(),
    errorPolicy: 'continue' as const,
    setErrorPolicy: vi.fn(),
    maxErrors: 0,
    setMaxErrors: vi.fn(),
    maxErrorRate: 0,
    setMaxErrorRate: vi.fn(),
    autoReport: false,
    setAutoReport: vi.fn(),
    autoReportFormat: 'html' as const,
    setAutoReportFormat: vi.fn(),
  }),
}));

vi.mock('./utils/runnerProgressStorage', () => ({
  saveProgress: vi.fn(),
  loadProgress: () => null,
  clearProgress: vi.fn(),
}));

vi.mock('../results/utils/reportGenerator', () => ({
  generateReport: vi.fn(),
  downloadReport: vi.fn(),
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
});
