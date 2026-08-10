/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrpcLoadTestPanel } from './GrpcLoadTestPanel';

vi.mock('./GrpcLoadTestConfigSection', () => ({
  GrpcLoadTestConfigSection: (props: Record<string, unknown>) => (
    <div data-testid="config-section" data-profile={props.profileName as string} data-collapsed={String(props.collapsed)} />
  ),
}));

vi.mock('./GrpcLoadTestResultsSection', () => ({
  GrpcLoadTestResultsSection: (props: Record<string, unknown>) => (
    <div data-testid="results-section" data-collapsed={String(props.collapsed)} />
  ),
}));

vi.mock('../../utils/grpcStudioAdvancedModel', () => ({
  formatGrpcLoadTestCallTypeBadge: (t: string) => `badge-${t}`,
  presentGrpcAdvancedOperationStatus: (s: string, c: boolean) => c ? 'cancelling' : s,
}));

vi.mock('./grpcLoadTestPanelUtils', () => ({
  buildStatusBreakdown: () => [],
  buildLatencyHistogram: () => [],
  buildThroughputTimeline: () => [],
  buildCompareDeltas: () => ({}),
  buildCompareDetailRows: () => [],
  buildCompareStatusComposition: () => [],
}));

function makeAdvanced(overrides: Record<string, unknown> = {}) {
  return {
    selectedLoadTestProfileId: null,
    loadTestProfiles: [],
    loadTestRunning: false,
    activeLoadTestCallType: 'unary',
    runtime: { loadTest: { status: 'idle', cancellationRequested: false } },
    loadTest: {
      lastSummary: null,
      selectedRunId: null,
      runHistory: [],
      config: { rps: 10, durationMs: 5000 },
      live: null,
    },
    ...overrides,
  } as unknown as Parameters<typeof GrpcLoadTestPanel>[0]['advanced'];
}

describe('GrpcLoadTestPanel', () => {
  it('renders config and results sections', () => {
    render(<GrpcLoadTestPanel advanced={makeAdvanced()} />);
    expect(screen.getByTestId('config-section')).toBeTruthy();
    expect(screen.getByTestId('results-section')).toBeTruthy();
  });

  it('sets profileName from selected profile id', () => {
    const adv = makeAdvanced({
      selectedLoadTestProfileId: 'p1',
      loadTestProfiles: [{ id: 'p1', name: 'My Profile' }],
    });
    render(<GrpcLoadTestPanel advanced={adv} />);
    expect(screen.getByTestId('config-section').dataset.profile).toBe('My Profile');
  });

  it('clears profileName when no profile selected', () => {
    render(<GrpcLoadTestPanel advanced={makeAdvanced({ selectedLoadTestProfileId: null })} />);
    expect(screen.getByTestId('config-section').dataset.profile).toBe('');
  });

  it('sets profile to empty when selected id not found in profiles', () => {
    const adv = makeAdvanced({
      selectedLoadTestProfileId: 'missing',
      loadTestProfiles: [{ id: 'p1', name: 'Prof' }],
    });
    render(<GrpcLoadTestPanel advanced={adv} />);
    expect(screen.getByTestId('config-section').dataset.profile).toBe('');
  });

  it('auto-selects compareRunId from run history', () => {
    const summary = { runId: 'run-2', totalRequests: 100, statusDistribution: {}, latencyPercentiles: {}, throughput: [] };
    const adv = makeAdvanced({
      loadTest: {
        lastSummary: summary,
        selectedRunId: null,
        runHistory: [
          { summary: { runId: 'run-1', totalRequests: 50, statusDistribution: {}, latencyPercentiles: {}, throughput: [] } },
          { summary: { runId: 'run-2', totalRequests: 100, statusDistribution: {}, latencyPercentiles: {}, throughput: [] } },
        ],
        config: {},
        live: null,
      },
    });
    render(<GrpcLoadTestPanel advanced={adv} />);
    // Just verify render doesn't crash
    expect(screen.getByTestId('results-section')).toBeTruthy();
  });

  it('handles cancellation status', () => {
    const adv = makeAdvanced({
      loadTestRunning: true,
      runtime: { loadTest: { status: 'running', cancellationRequested: true } },
    });
    render(<GrpcLoadTestPanel advanced={adv} />);
    expect(screen.getByTestId('config-section')).toBeTruthy();
  });
});
