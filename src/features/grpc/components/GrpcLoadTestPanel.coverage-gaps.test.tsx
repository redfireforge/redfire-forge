/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import { buildGrpcAdvancedFeatureSourceMetadata } from '../../../shared/grpc/grpcAdvancedFeatureExport';
import { captureGrpcLoadTestExecuteSnapshot } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { FIXTURE_DESCRIPTOR_KEY } from '../../../shared/grpc/contractFixtures';
import { buildAdvancedMock, makeLoadTestSummary } from '../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcLoadTestPanel } from './GrpcLoadTestPanel';

function makeSummaryWithAttempts(runId: string, attemptOverrides: Partial<{
  durationMs: number;
  ok: boolean;
  warmup: boolean;
  finishedAt: string;
  statusCode: number | string;
}> = {}) {
  const summary = makeLoadTestSummary();
  summary.runId = runId;
  summary.startedAt = '2026-07-01T00:00:00.000Z';
  summary.completedAt = '2026-07-01T00:00:05.000Z';
  summary.metrics.latency.p50Ms = 20;
  summary.metrics.latency.p95Ms = 40;
  summary.metrics.latency.p99Ms = 80;
  summary.metrics.throughput.measuredAttemptsPerSecond = 6.5;
  summary.metrics.statusDistribution.measuredAttempts = 4;
  summary.metrics.statusDistribution.failedAttempts = 1;
  summary.metrics.statusDistribution.byStatusCode = { '0': 3, '14': 1, unknown: 1 };
  summary.attempts = [
    {
      attemptNumber: 1,
      warmup: true,
      startedAt: '2026-07-01T00:00:00.050Z',
      finishedAt: '2026-07-01T00:00:00.150Z',
      durationMs: 100,
      ok: true,
      statusCode: 0,
    },
    {
      attemptNumber: 2,
      warmup: false,
      startedAt: '2026-07-01T00:00:01.000Z',
      finishedAt: attemptOverrides.finishedAt ?? '2026-07-01T00:00:01.200Z',
      durationMs: attemptOverrides.durationMs ?? 20,
      ok: attemptOverrides.ok ?? true,
      statusCode: 0,
    },
    {
      attemptNumber: 3,
      warmup: false,
      startedAt: '2026-07-01T00:00:02.000Z',
      finishedAt: '2026-07-01T00:00:02.500Z',
      durationMs: 50,
      ok: true,
      statusCode: 0,
    },
    {
      attemptNumber: 4,
      warmup: false,
      startedAt: '2026-07-01T00:00:03.000Z',
      finishedAt: '2026-07-01T00:00:03.800Z',
      durationMs: 80,
      ok: false,
      statusCode: 14,
      errorMessage: 'UNAVAILABLE',
    },
  ];
  return summary;
}

function makeExportSource() {
  return buildGrpcAdvancedFeatureSourceMetadata(
    captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-ui',
      executeSnapshot: {
        tabId: 'tab-ui',
        requestId: 'req-ui',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      config: { concurrency: 2, totalCalls: 4 },
    }).executeSnapshot,
  );
}

function completedRuntime() {
  return {
    ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
    loadTest: { status: 'completed' as const, cancellationRequested: false },
  };
}

describe('GrpcLoadTestPanel coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders server streaming badge, max messages field, and profile CRUD', async () => {
    const patchLoadTestConfig = vi.fn();
    const setLoadTestMethodOverride = vi.fn();
    const setSelectedLoadTestProfileId = vi.fn();
    const loadLoadTestProfile = vi.fn();
    const saveLoadTestProfile = vi.fn().mockResolvedValue(undefined);
    const renameLoadTestProfile = vi.fn().mockResolvedValue(undefined);
    const removeLoadTestProfile = vi.fn().mockResolvedValue(undefined);
    const cancelLoadTest = vi.fn();

    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          activeLoadTestCallType: 'server_streaming',
          patchLoadTestConfig,
          setLoadTestMethodOverride,
          setSelectedLoadTestProfileId,
          loadLoadTestProfile,
          saveLoadTestProfile,
          renameLoadTestProfile,
          removeLoadTestProfile,
          cancelLoadTest,
          loadTestProfiles: [{ id: 'prof-1', name: 'Smoke profile' }],
          selectedLoadTestMethodKey: 'echo.EchoService/Echo',
          selectedLoadTestProfileId: 'prof-1',
          loadTest: {
            config: { concurrency: 2, maxMessagesPerStream: 10 },
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-call-type-badge').textContent).toMatch(/Server stream/i);
    fireEvent.change(screen.getByTestId('grpc-load-test-method-select'), { target: { value: '' } });
    expect(setLoadTestMethodOverride).toHaveBeenCalledWith('');
    expect(screen.getByTestId('grpc-load-test-max-messages-per-stream')).toBeTruthy();
    fireEvent.change(screen.getByTestId('grpc-load-test-max-messages-per-stream'), { target: { value: '25' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ maxMessagesPerStream: 25 });
    fireEvent.change(screen.getByTestId('grpc-load-test-duration'), { target: { value: '2.5' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ durationMs: 2500 });
    fireEvent.change(screen.getByTestId('grpc-load-test-ramp-up'), { target: { value: '1.5' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ rampUpMs: 1500 });
    fireEvent.change(screen.getByTestId('grpc-load-test-request-rate'), { target: { value: '75' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ requestRateRps: 75 });

    expect((screen.getByTestId('grpc-load-test-profile-name') as HTMLInputElement).value).toBe('Smoke profile');
    fireEvent.change(screen.getByTestId('grpc-load-test-profile-name'), { target: { value: 'Renamed profile' } });
    fireEvent.click(screen.getByTestId('grpc-load-test-profile-load'));
    fireEvent.click(screen.getByTestId('grpc-load-test-profile-save'));
    fireEvent.click(screen.getByTestId('grpc-load-test-profile-rename'));
    fireEvent.click(screen.getByTestId('grpc-load-test-profile-delete'));
    expect(loadLoadTestProfile).toHaveBeenCalledWith('prof-1');
    expect(saveLoadTestProfile).toHaveBeenCalledWith('Renamed profile');
    expect(renameLoadTestProfile).toHaveBeenCalledWith('prof-1', 'Renamed profile');
    expect(removeLoadTestProfile).toHaveBeenCalledWith('prof-1');

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestRunning: true,
          cancelLoadTest,
          activeLoadTestCallType: 'server_streaming',
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            live: {
              counts: {
                scheduled: 10,
                completed: 2,
                succeeded: 2,
                failed: 0,
                warmupScheduled: 0,
                warmupCompleted: 0,
                peakInFlight: 2,
              },
              progressPercent: undefined,
              metrics: {
                measuredAttempts: 2,
                measuredAttemptsPerSecond: 16.5,
                successRatePercent: 100,
                errorRatePercent: 0,
                p50Ms: 12,
              },
            },
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-load-test-stop-btn'));
    expect(cancelLoadTest).toHaveBeenCalled();
    expect(screen.queryByTestId('grpc-advanced-progress__bar')).toBeNull();
    expect(screen.getByTestId('grpc-load-test-live-throughput').textContent).toContain('16.5');
    expect(screen.getByTestId('grpc-load-test-live-p50').textContent).toContain('12.0');
  });

  it('renders method/profile option lists and ignores invalid concurrency input', () => {
    const patchLoadTestConfig = vi.fn();
    const setSelectedLoadTestProfileId = vi.fn();
    const clearLoadTestProfileError = vi.fn();

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          activeRpcLabel: undefined,
          selectedLoadTestMethodKey: undefined,
          patchLoadTestConfig,
          setSelectedLoadTestProfileId,
          clearLoadTestProfileError,
          loadTestMethodOptions: [
            {
              key: 'echo.EchoService/Echo',
              service: 'echo.EchoService',
              method: 'Echo',
              callType: 'unary',
              label: 'echo.EchoService / Echo',
            },
            {
              key: 'echo.EchoService/ServerStream',
              service: 'echo.EchoService',
              method: 'ServerStream',
              callType: 'server_streaming',
              label: 'echo.EchoService / ServerStream',
            },
          ],
          loadTestProfiles: [
            { id: 'prof-1', name: 'Smoke profile' },
            { id: 'prof-2', name: 'Burst profile' },
          ],
          selectedLoadTestProfileId: 'prof-2',
        })}
      />,
    );

    expect(screen.getByText(/Use active Studio method \(none selected\)/)).toBeTruthy();
    expect(screen.getByRole('option', { name: 'echo.EchoService / ServerStream' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Burst profile' })).toBeTruthy();

    fireEvent.change(screen.getByTestId('grpc-load-test-concurrency'), { target: { value: 'abc' } });
    expect(patchLoadTestConfig).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('grpc-load-test-profile-select'), { target: { value: 'prof-1' } });
    expect(setSelectedLoadTestProfileId).toHaveBeenCalledWith('prof-1');
    expect(clearLoadTestProfileError).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByTestId('grpc-load-test-profile-name'), { target: { value: 'new profile' } });
    expect(clearLoadTestProfileError).toHaveBeenCalledTimes(2);
  });
  it('shows profile and export errors and zero error-rate summary branch', () => {
    const summaryZeroAttempts = makeLoadTestSummary();
    summaryZeroAttempts.metrics.statusDistribution.measuredAttempts = 0;
    summaryZeroAttempts.metrics.statusDistribution.failedAttempts = 0;

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfileError: 'Profile storage unavailable',
          advancedExportError: 'Export failed',
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: summaryZeroAttempts,
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: { status: 'completed', cancellationRequested: false },
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-profile-error').textContent).toMatch(/storage unavailable/i);
    expect(screen.getByTestId('grpc-load-test-export-error').textContent).toMatch(/Export failed/i);
    expect(screen.getByTestId('grpc-load-test-summary-metrics').textContent).toContain('0.0');
  });

  it('does not render success throughput bars when all measured attempts failed', () => {
    const summary = makeLoadTestSummary();
    summary.startedAt = '2026-07-01T00:00:00.000Z';
    summary.attempts = [
      {
        attemptNumber: 1,
        warmup: false,
        startedAt: '2026-07-01T00:00:00.100Z',
        finishedAt: '2026-07-01T00:00:00.500Z',
        durationMs: 400,
        ok: false,
        statusCode: 14,
        errorMessage: 'UNAVAILABLE',
      },
      {
        attemptNumber: 2,
        warmup: false,
        startedAt: '2026-07-01T00:00:00.600Z',
        finishedAt: '2026-07-01T00:00:00.900Z',
        durationMs: 300,
        ok: false,
        statusCode: 14,
        errorMessage: 'UNAVAILABLE',
      },
    ];

    const { container } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: summary,
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: { status: 'completed', cancellationRequested: false },
          },
        })}
      />,
    );

    expect(container.querySelectorAll('.grpc-load-test-throughput-point__bar--ok')).toHaveLength(0);
    expect(container.querySelectorAll('.grpc-load-test-throughput-point__bar--err').length).toBeGreaterThan(0);
  });

  it('renders unary request template editor and patches requestTemplateJson', () => {
    const patchLoadTestConfig = vi.fn();
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          activeLoadTestCallType: 'unary',
          patchLoadTestConfig,
          loadTest: {
            config: { concurrency: 2, requestTemplateJson: '{"hello":"world"}' },
          },
        })}
      />,
    );

    const editor = screen.getByTestId('grpc-load-test-request-template') as HTMLTextAreaElement;
    expect(editor.value).toContain('hello');
    fireEvent.change(editor, { target: { value: '{"message":"hi"}' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ requestTemplateJson: '{"message":"hi"}' });
  });

  it('does not truncate malformed integer inputs in load config', () => {
    const patchLoadTestConfig = vi.fn();
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          activeLoadTestCallType: 'server_streaming',
          patchLoadTestConfig,
          loadTest: {
            config: { concurrency: 2, totalCalls: 10, requestRateRps: 5, warmupCalls: 0, maxMessagesPerStream: 10 },
          },
        })}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-load-test-concurrency'), { target: { value: '1.5' } });
    expect(patchLoadTestConfig).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('grpc-load-test-total-calls'), { target: { value: '2.5' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ totalCalls: undefined });

    fireEvent.change(screen.getByTestId('grpc-load-test-request-rate'), { target: { value: '3.7' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ requestRateRps: undefined });

    fireEvent.change(screen.getByTestId('grpc-load-test-warmup'), { target: { value: '0.3' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ warmupCalls: undefined });

    fireEvent.change(screen.getByTestId('grpc-load-test-max-messages-per-stream'), { target: { value: '9.9' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ maxMessagesPerStream: undefined });
  });

  it('clears profile name when selection is cleared', () => {
    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfiles: [{ id: 'prof-1', name: 'Smoke profile' }],
          selectedLoadTestProfileId: 'prof-1',
        })}
      />,
    );
    expect((screen.getByTestId('grpc-load-test-profile-name') as HTMLInputElement).value).toBe('Smoke profile');

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfiles: [{ id: 'prof-1', name: 'Smoke profile' }],
          selectedLoadTestProfileId: '',
        })}
      />,
    );
    expect((screen.getByTestId('grpc-load-test-profile-name') as HTMLInputElement).value).toBe('');
  });

  it('disables profile select while profiles are loading', () => {
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfilesLoading: true,
        })}
      />,
    );
    expect((screen.getByTestId('grpc-load-test-profile-select') as HTMLSelectElement).disabled).toBe(true);
  });

  it('renders run history selector and compare card for multiple summaries', () => {
    const selectLoadTestRunSummary = vi.fn();
    const latest = makeLoadTestSummary();
    latest.runId = 'run-latest';
    latest.metrics.throughput.measuredAttemptsPerSecond = 8.5;
    latest.metrics.latency.p50Ms = 12;
    latest.metrics.latency.p95Ms = 22;
    latest.metrics.statusDistribution.measuredAttempts = 100;
    latest.metrics.statusDistribution.failedAttempts = 2;
    latest.metrics.statusDistribution.byStatusCode = { '0': 98, '14': 2 };

    const baseline = makeLoadTestSummary();
    baseline.runId = 'run-baseline';
    baseline.metrics.throughput.measuredAttemptsPerSecond = 5.25;
    baseline.metrics.latency.p50Ms = 20;
    baseline.metrics.latency.p95Ms = 35;
    baseline.metrics.statusDistribution.measuredAttempts = 100;
    baseline.metrics.statusDistribution.failedAttempts = 5;
    baseline.metrics.statusDistribution.byStatusCode = { '0': 95, '14': 5 };

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          selectLoadTestRunSummary,
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: latest,
            selectedRunId: latest.runId,
            runHistory: [
              { summary: latest },
              { summary: baseline },
            ],
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: { status: 'completed', cancellationRequested: false },
          },
        })}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-load-test-run-history-select'), {
      target: { value: baseline.runId },
    });
    expect(selectLoadTestRunSummary).toHaveBeenCalledWith(baseline.runId);
    expect(screen.getByTestId('grpc-load-test-run-compare')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-run-compare-select')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-percentile-legend')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-throughput-legend')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-run-compare-details')).toBeTruthy();
    expect(screen.getByText('Throughput (RPS)')).toBeTruthy();
    expect(screen.getByText('+3.25')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-run-compare-status-composition')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-run-compare-status-row-0')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-run-compare-status-row-14')).toBeTruthy();
  });

  it('does not attempt downloads when export source is unavailable', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: makeLoadTestSummary(),
            selectedRunId: 'run-ui',
            runHistory: [{ summary: makeLoadTestSummary() }],
            lastExportSource: undefined,
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: { status: 'completed', cancellationRequested: false },
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-load-test-download-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-download-csv'));
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('hides compare details when run history shrinks below compare threshold', () => {
    const latest = makeLoadTestSummary();
    latest.runId = 'run-latest';
    const baseline = makeLoadTestSummary();
    baseline.runId = 'run-baseline';

    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: latest,
            selectedRunId: latest.runId,
            runHistory: [{ summary: latest }, { summary: baseline }],
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: { status: 'completed', cancellationRequested: false },
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-run-compare-details')).toBeTruthy();

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2 },
            lastSummary: latest,
            selectedRunId: latest.runId,
            runHistory: [{ summary: latest }],
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: { status: 'completed', cancellationRequested: false },
          },
        })}
      />,
    );

    expect(screen.queryByTestId('grpc-load-test-run-compare-details')).toBeNull();
    expect(screen.queryByTestId('grpc-load-test-run-compare-status-composition')).toBeNull();
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

    const compareSelect = screen.getByTestId('grpc-load-test-run-compare-select') as HTMLSelectElement;
    expect(compareSelect.value).toBe('run-baseline');
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

    const compareSelect = screen.getByTestId('grpc-load-test-run-compare-select') as HTMLSelectElement;
    fireEvent.change(compareSelect, { target: { value: 'run-baseline-b' } });
    expect(compareSelect.value).toBe('run-baseline-b');
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

    fireEvent.change(screen.getByTestId('grpc-load-test-profile-select'), { target: { value: 'prof-2' } });
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
