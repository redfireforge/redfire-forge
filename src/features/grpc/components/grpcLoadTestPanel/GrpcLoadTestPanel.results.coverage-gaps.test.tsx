/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getCustomSelectValue, selectOption } from '../../../../test-utils/customSelectHelper';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../../grpcStudioAdvancedTypes';
import { buildAdvancedMock, makeLoadTestSummary } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcLoadTestPanel } from './GrpcLoadTestPanel';
import {
  completedRuntime,
  makeExportSource,
  makeSummaryWithAttempts,
} from './grpcLoadTestPanelCoverageGaps.testHelpers';

describe('GrpcLoadTestPanel results coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clicks start load test and disables start when validation fails', () => {
    const startLoadTest = vi.fn();
    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          startLoadTest,
          loadTest: { config: { concurrency: 2, totalCalls: 10 } },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-load-test-start-btn'));
    expect(startLoadTest).toHaveBeenCalled();

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          startLoadTest,
          loadTestValidationError: 'Concurrency must be positive',
          loadTest: { config: { concurrency: 2, totalCalls: 10 } },
        })}
      />,
    );
    const startBtn = screen.getByTestId('grpc-load-test-start-btn') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
    expect(screen.getByTestId('grpc-load-test-validation-error').textContent).toMatch(/Concurrency/i);
  });

  it('downloads JSON and CSV when lastExportSource is present', () => {
    vi.useFakeTimers();
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const summary = makeLoadTestSummary();
    summary.runId = 'run-export';

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }],
            lastExportSource: makeExportSource(),
          },
          runtime: completedRuntime(),
        })}
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

  it('copies JSON and CSV exports to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const exportLoadTestJson = vi.fn(() => '{"kind":"grpc_load_test_summary"}');
    const exportLoadTestCsv = vi.fn(() => 'metric,value');

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          exportLoadTestJson,
          exportLoadTestCsv,
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: makeLoadTestSummary(),
            selectedRunId: 'run-ui',
            runHistory: [{ summary: makeLoadTestSummary() }],
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-load-test-export-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-export-csv'));
    expect(exportLoadTestJson).toHaveBeenCalled();
    expect(exportLoadTestCsv).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('auto-selects compare baseline and renders p99 and measured attempts rows', () => {
    const latest = makeSummaryWithAttempts('run-latest');
    latest.metrics.throughput.measuredAttemptsPerSecond = 8.5;
    latest.metrics.latency.p50Ms = 12;
    latest.metrics.latency.p95Ms = 22;
    latest.metrics.latency.p99Ms = 44;
    latest.metrics.statusDistribution.measuredAttempts = 120;
    latest.metrics.statusDistribution.failedAttempts = 2;
    latest.metrics.statusDistribution.byStatusCode = { '0': 118, '14': 2 };

    const baseline = makeSummaryWithAttempts('run-baseline');
    baseline.metrics.throughput.measuredAttemptsPerSecond = 5.25;
    baseline.metrics.latency.p50Ms = 20;
    baseline.metrics.latency.p95Ms = 35;
    baseline.metrics.latency.p99Ms = 70;
    baseline.metrics.statusDistribution.measuredAttempts = 90;
    baseline.metrics.statusDistribution.failedAttempts = 5;
    baseline.metrics.statusDistribution.byStatusCode = { '0': 85, '14': 5 };

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: latest,
            selectedRunId: latest.runId,
            runHistory: [{ summary: latest }, { summary: baseline }],
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    const compareSelect = screen.getByTestId('grpc-load-test-run-compare-select');
    expect(getCustomSelectValue(compareSelect)).toBe('run-baseline');
    expect(screen.getByText('p99 latency (ms)')).toBeTruthy();
    expect(screen.getByText('Measured attempts')).toBeTruthy();
    expect(screen.getByText('70.00')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
  });

  it('changes compare baseline via compare select', () => {
    const latest = makeSummaryWithAttempts('run-latest');
    latest.metrics.throughput.measuredAttemptsPerSecond = 10;
    latest.metrics.latency.p99Ms = 30;
    latest.metrics.statusDistribution.measuredAttempts = 50;

    const baselineA = makeSummaryWithAttempts('run-baseline-a');
    baselineA.metrics.throughput.measuredAttemptsPerSecond = 4;
    baselineA.metrics.latency.p99Ms = 60;
    baselineA.metrics.statusDistribution.measuredAttempts = 40;

    const baselineB = makeSummaryWithAttempts('run-baseline-b');
    baselineB.metrics.throughput.measuredAttemptsPerSecond = 7;
    baselineB.metrics.latency.p99Ms = 90;
    baselineB.metrics.statusDistribution.measuredAttempts = 70;

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: latest,
            selectedRunId: latest.runId,
            runHistory: [
              { summary: latest },
              { summary: baselineA },
              { summary: baselineB },
            ],
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    const compareSelect = screen.getByTestId('grpc-load-test-run-compare-select');
    selectOption(compareSelect, 'run-baseline-b');
    expect(getCustomSelectValue(compareSelect)).toBe('run-baseline-b');
    expect(screen.getByText('90.00')).toBeTruthy();
    expect(screen.getByText('70')).toBeTruthy();
  });

  it('renders latency histogram and throughput timeline when summary has attempt data', () => {
    const summary = makeSummaryWithAttempts('run-charts');

    const { container } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }],
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    expect(container.querySelectorAll('.grpc-load-test-histogram-row').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.grpc-load-test-throughput-point').length).toBeGreaterThan(0);
    expect(screen.getByTestId('grpc-load-test-status-breakdown').textContent).toContain('unknown');
    expect(screen.getByTestId('grpc-load-test-latency-histogram')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-throughput-timeline')).toBeTruthy();
  });

  it('renders single-bucket latency histogram when all durations match', () => {
    const summary = makeLoadTestSummary();
    summary.startedAt = '2026-07-01T00:00:00.000Z';
    summary.attempts = [
      {
        attemptNumber: 1,
        warmup: false,
        startedAt: '2026-07-01T00:00:00.100Z',
        finishedAt: '2026-07-01T00:00:00.300Z',
        durationMs: 25,
        ok: true,
        statusCode: 0,
      },
      {
        attemptNumber: 2,
        warmup: false,
        startedAt: '2026-07-01T00:00:01.000Z',
        finishedAt: '2026-07-01T00:00:01.250Z',
        durationMs: 25,
        ok: true,
        statusCode: 0,
      },
    ];

    const { container } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }],
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    expect(container.querySelectorAll('.grpc-load-test-histogram-row')).toHaveLength(1);
    expect(screen.getByText('25ms')).toBeTruthy();
  });

  it('shows runtime error detail and resets completed status', () => {
    const resetLoadTestStatus = vi.fn();
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          resetLoadTestStatus,
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: makeLoadTestSummary(),
            selectedRunId: 'run-ui',
            runHistory: [{ summary: makeLoadTestSummary() }],
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: {
              status: 'failed',
              cancellationRequested: false,
              error: { message: 'Load test crashed' },
            },
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-status').textContent).toMatch(/Load test crashed/i);
    fireEvent.click(screen.getByTestId('grpc-load-test-reset-status'));
    expect(resetLoadTestStatus).toHaveBeenCalled();
  });

  it('renders live progress bar and ignores invalid ramp-up seconds', () => {
    const patchLoadTestConfig = vi.fn();
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          patchLoadTestConfig,
          loadTestRunning: true,
          loadTest: {
            config: { concurrency: 2, totalCalls: 10, rampUpMs: 500 },
            live: {
              counts: {
                scheduled: 10,
                completed: 4,
                succeeded: 4,
                failed: 0,
                warmupScheduled: 0,
                warmupCompleted: 0,
                peakInFlight: 2,
              },
              progressPercent: 40,
            },
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-live-completed').textContent).toBe('4');
    expect(document.querySelector('.grpc-advanced-progress__fill')).toBeTruthy();
    fireEvent.change(screen.getByTestId('grpc-load-test-ramp-up'), { target: { value: '-1' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ rampUpMs: undefined });
  });

  it('changes profile select and skips clipboard copy when export text is empty', () => {
    const setSelectedLoadTestProfileId = vi.fn();
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          setSelectedLoadTestProfileId,
          exportLoadTestJson: vi.fn(() => undefined),
          exportLoadTestCsv: vi.fn(() => ''),
          loadTestProfiles: [{ id: 'prof-2', name: 'Second profile' }],
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: makeLoadTestSummary(),
            selectedRunId: 'run-ui',
            runHistory: [{ summary: makeLoadTestSummary() }],
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    selectOption(screen.getByTestId('grpc-load-test-profile-select'), 'Second profile');
    expect(setSelectedLoadTestProfileId).toHaveBeenCalledWith('prof-2');
    fireEvent.click(screen.getByTestId('grpc-load-test-export-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-export-csv'));
    expect(writeText).not.toHaveBeenCalled();
  });

  it('handles invalid throughput timestamps and non-numeric status codes in compare', () => {
    const latest = makeSummaryWithAttempts('run-latest');
    latest.startedAt = 'not-a-valid-date';
    latest.metrics.statusDistribution.byStatusCode = { CANCELLED: 2, DEADLINE: 1 };
    latest.metrics.statusDistribution.measuredAttempts = 3;
    latest.metrics.statusDistribution.failedAttempts = 3;
    latest.metrics.throughput.measuredAttemptsPerSecond = 2;
    latest.metrics.latency.p99Ms = 100;

    const baseline = makeSummaryWithAttempts('run-baseline');
    baseline.metrics.statusDistribution.byStatusCode = { CANCELLED: 1, UNKNOWN_CODE: 1 };
    baseline.metrics.statusDistribution.measuredAttempts = 2;
    baseline.metrics.statusDistribution.failedAttempts = 2;
    baseline.metrics.throughput.measuredAttemptsPerSecond = 5;
    baseline.metrics.latency.p99Ms = 50;
    baseline.attempts[1] = {
      ...baseline.attempts[1]!,
      finishedAt: 'also-invalid',
    };

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: latest,
            selectedRunId: latest.runId,
            runHistory: [{ summary: latest }, { summary: baseline }],
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-throughput-timeline').textContent).toMatch(/No measured attempts yet/i);
    expect(screen.getByTestId('grpc-load-test-run-compare-status-row-CANCELLED')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-run-compare-status-row-UNKNOWN_CODE')).toBeTruthy();
    expect(screen.getByText('-3.00')).toBeTruthy();
  });

  it('uses fallback download filename when run id has no safe characters', () => {
    vi.useFakeTimers();
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const summary = makeLoadTestSummary();
    summary.runId = '!!!@@@';

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }],
            lastExportSource: makeExportSource(),
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-load-test-download-json'));
    vi.runAllTimers();
    const linkArg = createObjectURLSpy.mock.calls[0]?.[0] as Blob;
    expect(linkArg).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows empty chart hints when measured attempts produce no histogram buckets', () => {
    const summary = makeLoadTestSummary();
    summary.metrics.statusDistribution.measuredAttempts = 0;
    summary.metrics.statusDistribution.byStatusCode = {};
    summary.attempts = [];

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: summary,
            selectedRunId: summary.runId,
            runHistory: [{ summary }],
          },
          runtime: completedRuntime(),
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-status-breakdown').textContent).toMatch(/No measured attempts yet/i);
    expect(screen.getByTestId('grpc-load-test-latency-histogram').textContent).toMatch(/No measured attempts yet/i);
  });
});
