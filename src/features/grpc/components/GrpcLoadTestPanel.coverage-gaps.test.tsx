/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import { buildAdvancedMock, makeLoadTestSummary } from '../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcLoadTestPanel } from './GrpcLoadTestPanel';

describe('GrpcLoadTestPanel coverage gaps', () => {
  it('renders server streaming badge, max messages field, and profile CRUD', async () => {
    const patchLoadTestConfig = vi.fn();
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
          setSelectedLoadTestProfileId,
          loadLoadTestProfile,
          saveLoadTestProfile,
          renameLoadTestProfile,
          removeLoadTestProfile,
          cancelLoadTest,
          loadTestProfiles: [{ id: 'prof-1', name: 'Smoke profile' }],
          selectedLoadTestProfileId: 'prof-1',
          loadTest: {
            config: { concurrency: 2, maxMessagesPerStream: 10 },
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-call-type-badge').textContent).toMatch(/Server stream/i);
    expect(screen.getByTestId('grpc-load-test-max-messages-per-stream')).toBeTruthy();
    fireEvent.change(screen.getByTestId('grpc-load-test-max-messages-per-stream'), { target: { value: '25' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ maxMessagesPerStream: 25 });

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
            },
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-load-test-stop-btn'));
    expect(cancelLoadTest).toHaveBeenCalled();
    expect(screen.queryByTestId('grpc-advanced-progress__bar')).toBeNull();
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
});
