/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { selectOption } from '../../../../test-utils/customSelectHelper';
import { buildAdvancedMock, makeLoadTestSummary } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcLoadTestResultsSection } from './GrpcLoadTestResultsSection';
import { makeExportSource, makeSummaryWithAttempts } from './grpcLoadTestPanelCoverageGaps.testHelpers';
import {
  buildCompareDetailRows,
  buildCompareDeltas,
  buildCompareStatusComposition,
  buildLatencyHistogram,
  buildStatusBreakdown,
  buildThroughputTimeline,
} from './grpcLoadTestPanelUtils';

describe('GrpcLoadTestResultsSection coverage gaps', () => {
  it('returns null when there is neither live progress nor a summary', () => {
    const { container } = render(
      <GrpcLoadTestResultsSection
        advanced={buildAdvancedMock()}
        summary={undefined}
        live={undefined}
        config={{ concurrency: 1 }}
        selectedRunId={undefined}
        runHistory={[]}
        compareRunId=""
        setCompareRunId={vi.fn()}
        compareSummary={undefined}
        compareDeltas={undefined}
        compareDetailRows={[]}
        compareStatusComposition={[]}
        statusBreakdown={[]}
        latencyHistogram={[]}
        throughputTimeline={[]}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="grpc-load-test-results"]')).toBeNull();
  });

  it('selects a historical run and no-ops downloads without lastExportSource', () => {
    const selectLoadTestRunSummary = vi.fn();
    const summary = makeLoadTestSummary();
    summary.runId = 'run-history';
    const prior = makeLoadTestSummary();
    prior.runId = 'run-prior';

    render(
      <GrpcLoadTestResultsSection
        advanced={buildAdvancedMock({
          selectLoadTestRunSummary,
          loadTest: {
            config: { concurrency: 1 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }, { summary: prior }],
            lastExportSource: undefined,
          },
        })}
        summary={summary}
        live={undefined}
        config={{ concurrency: 1 }}
        selectedRunId={summary.runId}
        runHistory={[{ summary }, { summary: prior }]}
        compareRunId=""
        setCompareRunId={vi.fn()}
        compareSummary={undefined}
        compareDeltas={undefined}
        compareDetailRows={[]}
        compareStatusComposition={[]}
        statusBreakdown={[]}
        latencyHistogram={[]}
        throughputTimeline={[]}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    selectOption(screen.getByTestId('grpc-load-test-run-history-select'), 'run-prior');
    expect(selectLoadTestRunSummary).toHaveBeenCalledWith('run-prior');

    fireEvent.click(screen.getByTestId('grpc-load-test-download-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-download-csv'));
  });

  it('downloads JSON/CSV when lastExportSource is present', () => {
    vi.useFakeTimers();
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const summary = makeLoadTestSummary();
    summary.runId = 'run-download';

    render(
      <GrpcLoadTestResultsSection
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 1 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }],
            lastExportSource: makeExportSource(),
          },
        })}
        summary={summary}
        live={undefined}
        config={{ concurrency: 1 }}
        selectedRunId={summary.runId}
        runHistory={[{ summary }]}
        compareRunId=""
        setCompareRunId={vi.fn()}
        compareSummary={undefined}
        compareDeltas={undefined}
        compareDetailRows={[]}
        compareStatusComposition={[]}
        statusBreakdown={[]}
        latencyHistogram={[]}
        throughputTimeline={[]}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-load-test-download-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-download-csv'));
    vi.runAllTimers();
    expect(createObjectURLSpy).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(revokeSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('copies JSON/CSV to clipboard and dismisses finished results', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const exportLoadTestJson = vi.fn(() => '{"ok":true}');
    const exportLoadTestCsv = vi.fn(() => 'a,b');
    const resetLoadTestStatus = vi.fn();
    const summary = makeLoadTestSummary();

    render(
      <GrpcLoadTestResultsSection
        advanced={buildAdvancedMock({
          exportLoadTestJson,
          exportLoadTestCsv,
          resetLoadTestStatus,
          loadTest: {
            config: { concurrency: 1 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }],
            lastExportSource: makeExportSource(),
          },
        })}
        summary={summary}
        live={undefined}
        config={{ concurrency: 1 }}
        selectedRunId={summary.runId}
        runHistory={[{ summary }]}
        compareRunId=""
        setCompareRunId={vi.fn()}
        compareSummary={undefined}
        compareDeltas={undefined}
        compareDetailRows={[]}
        compareStatusComposition={[]}
        statusBreakdown={[]}
        latencyHistogram={[]}
        throughputTimeline={[]}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-load-test-export-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-export-csv'));
    fireEvent.click(screen.getByTestId('grpc-load-test-reset-status'));
    expect(exportLoadTestJson).toHaveBeenCalled();
    expect(exportLoadTestCsv).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(resetLoadTestStatus).toHaveBeenCalled();
  });

  it('skips clipboard write when export helpers return empty text', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const summary = makeLoadTestSummary();

    render(
      <GrpcLoadTestResultsSection
        advanced={buildAdvancedMock({
          exportLoadTestJson: vi.fn(() => ''),
          exportLoadTestCsv: vi.fn(() => ''),
          loadTest: {
            config: { concurrency: 1 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }],
          },
        })}
        summary={summary}
        live={undefined}
        config={{ concurrency: 1 }}
        selectedRunId={summary.runId}
        runHistory={[{ summary }]}
        compareRunId=""
        setCompareRunId={vi.fn()}
        compareSummary={undefined}
        compareDeltas={undefined}
        compareDetailRows={[]}
        compareStatusComposition={[]}
        statusBreakdown={[]}
        latencyHistogram={[]}
        throughputTimeline={[]}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-load-test-export-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-export-csv'));
    expect(writeText).not.toHaveBeenCalled();
  });

  it('renders live progress, collapse toggle, charts, and compare deltas', () => {
    const onToggleCollapse = vi.fn();
    const setCompareRunId = vi.fn();
    const latest = makeSummaryWithAttempts('run-latest');
    const baseline = makeSummaryWithAttempts('run-baseline');
    baseline.metrics.throughput.measuredAttemptsPerSecond = 2;
    baseline.metrics.latency.p50Ms = 40;
    baseline.metrics.latency.p95Ms = 80;
    baseline.metrics.statusDistribution.failedAttempts = 4;

    const compareDeltas = buildCompareDeltas(latest, baseline);
    const compareDetailRows = [
      ...buildCompareDetailRows(latest, baseline),
      {
        label: 'custom-worse',
        baseline: '1',
        current: '2',
        delta: '+1',
        improved: false,
      },
      {
        label: 'custom-better',
        baseline: '2',
        current: '1',
        delta: '-1',
        improved: true,
      },
    ];
    const compareStatusComposition = [
      ...buildCompareStatusComposition(latest, baseline),
      {
        statusCode: 'custom',
        baselineCount: 1,
        currentCount: 3,
        baselinePct: 10,
        currentPct: 30,
        deltaCount: 2,
        deltaPct: 20,
      },
      {
        statusCode: '0',
        baselineCount: 5,
        currentCount: 2,
        baselinePct: 50,
        currentPct: 20,
        deltaCount: -3,
        deltaPct: -30,
      },
    ];

    const { rerender } = render(
      <GrpcLoadTestResultsSection
        advanced={buildAdvancedMock({
          loadTestRunning: true,
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            live: {
              progressPercent: undefined,
              counts: { completed: 4, succeeded: 3, failed: 1 },
              metrics: undefined,
            },
          },
        })}
        summary={undefined}
        live={{
          progressPercent: undefined,
          counts: { completed: 4, succeeded: 3, failed: 1 },
          metrics: undefined,
        }}
        config={{ concurrency: 2, totalCalls: 10 }}
        selectedRunId={undefined}
        runHistory={[]}
        compareRunId=""
        setCompareRunId={setCompareRunId}
        compareSummary={undefined}
        compareDeltas={undefined}
        compareDetailRows={[]}
        compareStatusComposition={[]}
        statusBreakdown={[]}
        latencyHistogram={[]}
        throughputTimeline={[]}
        collapsed={false}
        onToggleCollapse={onToggleCollapse}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-live-completed').textContent).toContain('4');
    fireEvent.click(screen.getByTitle('Hide results'));
    expect(onToggleCollapse).toHaveBeenCalled();

    const worseBaseline = {
      ...baseline,
      metrics: {
        ...baseline.metrics,
        throughput: { ...baseline.metrics.throughput, measuredAttemptsPerSecond: 20 },
        latency: { ...baseline.metrics.latency, p50Ms: 1, p95Ms: 1 },
        statusDistribution: {
          ...baseline.metrics.statusDistribution,
          failedAttempts: 0,
          measuredAttempts: 100,
        },
      },
    };
    const worseDeltas = buildCompareDeltas(latest, worseBaseline);

    rerender(
      <GrpcLoadTestResultsSection
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: latest,
            selectedRunId: latest.runId,
            runHistory: [{ summary: latest }, { summary: baseline }],
            lastExportSource: makeExportSource(),
          },
        })}
        summary={latest}
        live={undefined}
        config={{ concurrency: 2 }}
        selectedRunId={latest.runId}
        runHistory={[{ summary: latest }, { summary: baseline }]}
        compareRunId={baseline.runId}
        setCompareRunId={setCompareRunId}
        compareSummary={baseline}
        compareDeltas={worseDeltas.throughputDelta < 0 ? worseDeltas : {
          throughputDelta: -1,
          p50Delta: 5,
          p95Delta: 5,
          errorRateDelta: 5,
        }}
        compareDetailRows={compareDetailRows}
        compareStatusComposition={compareStatusComposition}
        statusBreakdown={[]}
        latencyHistogram={[]}
        throughputTimeline={[]}
        collapsed={false}
        onToggleCollapse={onToggleCollapse}
      />,
    );

    expect(screen.getAllByText(/No measured attempts yet/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('grpc-load-test-run-compare')).toBeTruthy();
    selectOption(screen.getByTestId('grpc-load-test-run-compare-select'), baseline.runId);
    expect(setCompareRunId).toHaveBeenCalledWith(baseline.runId);

    rerender(
      <GrpcLoadTestResultsSection
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: latest,
            selectedRunId: latest.runId,
            runHistory: [{ summary: latest }, { summary: baseline }],
            lastExportSource: makeExportSource(),
          },
        })}
        summary={latest}
        live={undefined}
        config={{ concurrency: 2 }}
        selectedRunId={latest.runId}
        runHistory={[{ summary: latest }, { summary: baseline }]}
        compareRunId={baseline.runId}
        setCompareRunId={setCompareRunId}
        compareSummary={baseline}
        compareDeltas={compareDeltas}
        compareDetailRows={compareDetailRows}
        compareStatusComposition={compareStatusComposition}
        statusBreakdown={buildStatusBreakdown(latest)}
        latencyHistogram={buildLatencyHistogram(latest)}
        throughputTimeline={buildThroughputTimeline(latest)}
        collapsed={false}
        onToggleCollapse={onToggleCollapse}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-status-breakdown')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-latency-histogram')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-throughput-timeline')).toBeTruthy();
  });
});
