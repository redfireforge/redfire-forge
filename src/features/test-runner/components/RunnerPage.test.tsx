/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import RunnerPage from './RunnerPage';
import { STANDARD_VARIANT } from './runnerVariants';
import type { FeatureGroup } from '@shared/types';

const orch = vi.hoisted(() => ({
  overrides: {} as Record<string, unknown>,
  setApiMockFixture: vi.fn(),
  setThinkTime: vi.fn(),
  setWeights: vi.fn(),
  setWeightsExpanded: vi.fn(),
  setRunnerTagFilter: vi.fn(),
  handleClearProgress: vi.fn(),
  handleRun: vi.fn(),
  abort: vi.fn(),
  confirmSavePendingRun: vi.fn(),
  dismissPendingRun: vi.fn(),
  onComplete: vi.fn(),
}));

function baseOrchestration() {
  return {
    config: {
      concurrency: 1, setConcurrency: vi.fn(), iterations: 1, setIterations: vi.fn(),
      selectedScenarios: new Set<string>(['sc1']), setSelectedScenarios: vi.fn(),
      weights: { t1: 1 }, setWeights: orch.setWeights,
      skipValidation: false, setSkipValidation: vi.fn(),
      skipAssertions: false, setSkipAssertions: vi.fn(),
      validationOverride: 'default', setValidationOverride: vi.fn(),
      forceUnordered: 'default' as const, setForceUnordered: vi.fn(),
      hostMode: 'hardcoded' as const, setHostMode: vi.fn(),
      customBaseUrl: '', setCustomBaseUrl: vi.fn(),
      executionMode: 'sequential', setExecutionMode: vi.fn(),
      loadProfile: { phases: [], maxConcurrency: 10 },
      arrivalRate: { rate: 0 },
      thinkTime: { mode: 'none' }, setThinkTime: orch.setThinkTime,
      timeoutSec: 0, setTimeoutSec: vi.fn(), retryCount: 0, setRetryCount: vi.fn(),
      retryDelayMs: 1000, setRetryDelayMs: vi.fn(),
      errorPolicy: 'continue', setErrorPolicy: vi.fn(),
      maxErrors: 0, setMaxErrors: vi.fn(), maxErrorRate: 0, setMaxErrorRate: vi.fn(),
      autoReport: false, setAutoReport: vi.fn(), autoReportFormat: 'html', setAutoReportFormat: vi.fn(),
      apiMockFixture: undefined, setApiMockFixture: orch.setApiMockFixture,
    },
    execution: {
      isRunning: false, liveResults: [], error: null, abort: orch.abort,
      finalRun: null, pendingRun: null,
      confirmSavePendingRun: orch.confirmSavePendingRun, dismissPendingRun: orch.dismissPendingRun,
      fixtureStatus: null,
    },
    selectedTests: [
      {
        id: 't1',
        name: 'GET User',
        method: 'GET',
        url: '/api/users',
        headers: [],
        validation: { mode: 'none' },
        auth: { type: 'none' },
        dataSource: {
          columns: [{ id: 'c1', name: 'name' }],
          rows: [{ id: 'r1', values: { c1: 'A' }, enabled: true }],
        },
        slaTargets: [{ id: 'sla-1', metric: 'p95', thresholdMs: 200 }],
      },
    ],
    activeTestCount: 1,
    allocation: {
      kind: 'standard' as const,
      totalRequests: 1,
      items: [{ testId: 't1', testName: 'GET User', iterations: 1, rowCount: 1, totalRequests: 1 }],
    },
    isLoadProfile: false,
    isConstantArrival: false,
    isGalleryEnv: false,
    weightsExpanded: true,
    setWeightsExpanded: orch.setWeightsExpanded,
    runnerTagFilter: '',
    setRunnerTagFilter: orch.setRunnerTagFilter,
    scenarioTagFilter: '',
    setScenarioTagFilter: vi.fn(),
    allScenarioTags: [],
    scenarioTagCounts: {},
    savedProgress: null,
    handleClearProgress: orch.handleClearProgress,
    handleRun: orch.handleRun,
    updateProfile: vi.fn(),
    updateArrivalRate: vi.fn(),
    showProgress: false,
    displaySummary: null,
    displayTimeSeries: [],
    displayCompleted: 0,
    displayTotal: 0,
    displayProfileMeta: null,
    displayExecMode: 'sequential' as const,
    displayConc: 1,
    displayLoadProfile: { phases: [], maxConcurrency: 10, durationSec: 60, type: 'constant' },
    displayArrivalRate: { rate: 0 },
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

vi.mock('../hooks/useRunnerOrchestration', () => ({
  useRunnerOrchestration: () => {
    const base = baseOrchestration();
    const extra = orch.overrides;
    return {
      ...base,
      ...extra,
      config: {
        ...base.config,
        ...((extra.config as Record<string, unknown> | undefined) ?? {}),
      },
    };
  },
}));

vi.mock('./ApiMockFixturePanel', () => ({
  default: () => <div data-testid="api-mock-fixture-panel">fixture</div>,
}));

const groups: FeatureGroup[] = [{
  id: 'fg1',
  name: 'API',
  scenarios: [{
    id: 'sc1',
    name: 'Std',
    kind: 'standard',
    tests: [{
      id: 't1', name: 'GET User', method: 'GET', url: '/api/users',
      headers: [], validation: { mode: 'none' }, auth: { type: 'none' },
    }],
  }],
}];

function renderPage(props: Record<string, unknown> = {}) {
  return render(
    <RunnerPage
      variant={STANDARD_VARIANT}
      featureGroups={groups}
      onComplete={orch.onComplete}
      envName="Staging"
      svcName="Users"
      {...props}
    />,
  );
}

describe('RunnerPage coverage gaps', () => {
  beforeEach(() => {
    orch.overrides = {};
    orch.setApiMockFixture.mockReset();
    orch.setThinkTime.mockReset();
    orch.setWeights.mockReset();
    orch.setWeightsExpanded.mockReset();
    orch.setRunnerTagFilter.mockReset();
    orch.handleClearProgress.mockReset();
    orch.handleRun.mockReset();
    orch.abort.mockReset();
    orch.confirmSavePendingRun.mockReset();
    orch.dismissPendingRun.mockReset();
    orch.onComplete.mockReset();
  });

  it('marks an additional environment in the header', () => {
    renderPage({ isAdditionalEnv: true });
    expect(document.querySelector('.env-tag-additional')).toBeTruthy();
    expect(document.querySelector('.additional-env-indicator')).toHaveTextContent('+');
  });

  it('enables the mock fixture when Mock Server is selected', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('har-host-mock'));
    expect(orch.setApiMockFixture).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, overrideBaseUrl: true }),
    );
  });

  it('clears a missing fixture when leaving Mock Server', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Custom'));
    expect(orch.setApiMockFixture).toHaveBeenCalledWith(undefined);
  });

  it('disables an existing fixture when leaving Mock Server', () => {
    orch.overrides = {
      config: {
        apiMockFixture: { enabled: true, serverId: 'srv-1', isolateRun: true },
        setApiMockFixture: orch.setApiMockFixture,
      },
    };
    renderPage();
    expect(screen.getByTestId('api-mock-fixture-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Original'));
    expect(orch.setApiMockFixture).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, serverId: 'srv-1' }),
    );
  });

  it('shows data-row and SLA badges on weight rows', () => {
    renderPage();
    expect(document.querySelector('.weight-row .count-badge-data')).toHaveTextContent('1 rows');
    expect(document.querySelector('.weight-row .count-badge-sla')).toHaveTextContent('1 SLA');
  });

  it('merges think-time patches and toggles weight controls', () => {
    const { container } = renderPage();
    fireEvent.click(within(container.querySelector('.think-time-section') as HTMLElement).getByRole('radio', { name: 'Constant' }));
    const updater = orch.setThinkTime.mock.calls[0][0] as (prev: { mode: string }) => Record<string, unknown>;
    expect(updater({ mode: 'none' })).toEqual({ mode: 'constant' });

    fireEvent.click(screen.getByText(/Test Distribution/));
    expect(orch.setWeightsExpanded).toHaveBeenCalled();
    const toggle = orch.setWeightsExpanded.mock.calls[0][0] as (v: boolean) => boolean;
    expect(toggle(true)).toBe(false);

    fireEvent.click(screen.getByTestId('har-weights-reset-1'));
    expect(orch.setWeights).toHaveBeenCalledWith({ t1: 1 });
    fireEvent.click(screen.getByTestId('har-weights-reset-0'));
    expect(orch.setWeights).toHaveBeenCalledWith({ t1: 0 });
    fireEvent.change(container.querySelector('input.weight-input') as HTMLInputElement, { target: { value: '4' } });
    expect(orch.setWeights).toHaveBeenCalledWith({ t1: 4 });
  });

  it('filters tagged data rows and shows empty / progress / completion states', () => {
    orch.overrides = {
      selectedTests: [{
        id: 't1',
        name: 'GET User',
        method: 'GET',
        url: '/api/users',
        headers: [],
        validation: { mode: 'none' },
        auth: { type: 'none' },
        dataSource: {
          columns: [{ id: 'c1', name: 'n' }],
          rows: [{ id: 'r1', values: {}, enabled: true, tags: ['smoke'] }],
        },
        slaTargets: [],
      }],
      runnerTagFilter: 'smoke',
    };
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/happy-path/), { target: { value: 'a' } });
    expect(orch.setRunnerTagFilter).toHaveBeenCalledWith('a');
    expect(screen.getByText(/Only rows matching these tags will run/)).toBeInTheDocument();
  });

  it('shows the empty state when no tests exist', () => {
    renderPage({ featureGroups: [] });
    expect(screen.getByText(/No tests defined/)).toBeInTheDocument();
  });

  it('scrolls the monitor while a run is in progress', () => {
    orch.overrides = {
      showProgress: true,
      displayTotal: 2,
      execution: {
        isRunning: true, liveResults: [], error: null, abort: orch.abort,
        finalRun: null, pendingRun: null,
        confirmSavePendingRun: orch.confirmSavePendingRun,
        dismissPendingRun: orch.dismissPendingRun,
        fixtureStatus: null,
      },
    };
    renderPage();
    expect(screen.getByTestId('har-runner-monitor')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('har-stop-btn'));
    expect(orch.abort).toHaveBeenCalled();
  });

  it('shows final-run completion and saved-progress completion', () => {
    orch.overrides = {
      execution: {
        isRunning: false, liveResults: [], error: null, abort: orch.abort,
        finalRun: { id: 'r1', results: [1], summary: { totalDurationMs: 1000 } },
        pendingRun: null,
        confirmSavePendingRun: orch.confirmSavePendingRun,
        dismissPendingRun: orch.dismissPendingRun,
        fixtureStatus: null,
      },
    };
    const first = renderPage();
    fireEvent.click(screen.getByTestId('har-view-results'));
    expect(orch.onComplete).toHaveBeenCalledWith('test');
    first.unmount();

    orch.overrides = {
      savedProgress: { resultCount: 2, durationMs: 2000, summary: {} },
    };
    renderPage();
    fireEvent.click(screen.getByTestId('har-view-results'));
    expect(orch.onComplete).toHaveBeenCalledWith('test');
  });

  it('shows error and pending-run banners', () => {
    orch.overrides = {
      execution: {
        isRunning: false, liveResults: [], error: 'boom', abort: orch.abort,
        finalRun: null, pendingRun: { id: 'p1' },
        confirmSavePendingRun: orch.confirmSavePendingRun,
        dismissPendingRun: orch.dismissPendingRun,
        fixtureStatus: null,
      },
    };
    renderPage();
    expect(screen.getByText('boom')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Yes, remove old runs/));
    fireEvent.click(screen.getByText(/Discard this run/));
    expect(orch.confirmSavePendingRun).toHaveBeenCalled();
    expect(orch.dismissPendingRun).toHaveBeenCalled();
  });

  it('clears saved progress from the live panel', () => {
    orch.overrides = {
      showProgress: true,
      displayTotal: 1,
      savedProgress: { resultCount: 1, durationMs: 500, summary: {} },
    };
    renderPage();
    fireEvent.click(screen.getByTitle('Clear progress'));
    expect(orch.handleClearProgress).toHaveBeenCalled();
  });
});
