/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildAdvancedMock, makeLoadTestSummary } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcLoadTestPanel } from './GrpcLoadTestPanel';

describe('GrpcLoadTestPanel (inner) coverage gaps', () => {
  it('toggles config and results collapse chevrons', () => {
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            lastSummary: makeLoadTestSummary(),
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-method-select')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Hide configuration'));
    expect(screen.queryByTestId('grpc-load-test-method-select')).toBeNull();

    fireEvent.click(screen.getByTitle('Show configuration'));
    expect(screen.getByTestId('grpc-load-test-method-select')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Hide results'));
    expect(screen.queryByTestId('grpc-load-test-summary-metrics')).toBeNull();

    fireEvent.click(screen.getByTitle('Show results'));
    expect(screen.getByTestId('grpc-load-test-summary-metrics')).toBeTruthy();
  });

  it('syncs profile name when selected profile changes and auto-selects compare run', () => {
    const summaryA = makeLoadTestSummary();
    summaryA.runId = 'run-a';
    const summaryB = makeLoadTestSummary();
    summaryB.runId = 'run-b';

    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfiles: [
            { id: 'prof-1', name: 'Baseline', updatedAt: '2026-07-01T00:00:00.000Z', config: { concurrency: 2, totalCalls: 10 } },
          ],
          selectedLoadTestProfileId: 'prof-1',
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            lastSummary: summaryA,
            selectedRunId: 'run-a',
            runHistory: [
              { summary: summaryA },
              { summary: summaryB },
            ],
          },
        })}
      />,
    );

    expect((screen.getByTestId('grpc-load-test-profile-name') as HTMLInputElement).value).toBe('Baseline');

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfiles: [
            { id: 'prof-2', name: 'Heavy', updatedAt: '2026-07-01T00:00:00.000Z', config: { concurrency: 8, totalCalls: 80 } },
          ],
          selectedLoadTestProfileId: 'prof-2',
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            lastSummary: summaryA,
            selectedRunId: 'run-a',
            runHistory: [
              { summary: summaryA },
              { summary: summaryB },
            ],
          },
        })}
      />,
    );

    expect((screen.getByTestId('grpc-load-test-profile-name') as HTMLInputElement).value).toBe('Heavy');
    expect(screen.getByTestId('grpc-load-test-run-compare-select')).toBeTruthy();
  });

  it('clears profile name for stale selection and omits compare UI without enough history', () => {
    const summary = makeLoadTestSummary();
    summary.runId = 'run-only';

    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfiles: [],
          selectedLoadTestProfileId: 'missing-profile',
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            lastSummary: summary,
            runHistory: [{ summary }],
          },
        })}
      />,
    );

    expect((screen.getByTestId('grpc-load-test-profile-name') as HTMLInputElement).value).toBe('');

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
          },
        })}
      />,
    );

    expect(screen.queryByTestId('grpc-load-test-summary-metrics')).toBeNull();
    expect(screen.queryByTestId('grpc-load-test-run-compare-select')).toBeNull();
  });

  it('preserves manually selected compare run when current summary changes', () => {
    const summaryA = makeLoadTestSummary();
    summaryA.runId = 'run-a';
    const summaryB = makeLoadTestSummary();
    summaryB.runId = 'run-b';
    const summaryC = makeLoadTestSummary();
    summaryC.runId = 'run-c';

    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            lastSummary: summaryA,
            selectedRunId: 'run-a',
            runHistory: [
              { summary: summaryA },
              { summary: summaryB },
              { summary: summaryC },
            ],
          },
        })}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-load-test-run-compare-select'), {
      target: { value: 'run-c' },
    });

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            lastSummary: summaryB,
            selectedRunId: 'run-b',
            runHistory: [
              { summary: summaryA },
              { summary: summaryB },
              { summary: summaryC },
            ],
          },
        })}
      />,
    );

    expect((screen.getByTestId('grpc-load-test-run-compare-select') as HTMLSelectElement).value).toBe('run-c');
  });

  it('clears compare run when history has no alternate run id', () => {
    const summary = makeLoadTestSummary();
    summary.runId = 'run-a';
    const duplicate = makeLoadTestSummary();
    duplicate.runId = 'run-a';

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
            lastSummary: summary,
            runHistory: [{ summary }, { summary: duplicate }],
          },
        })}
      />,
    );

    expect((screen.getByTestId('grpc-load-test-run-compare-select') as HTMLSelectElement).value).toBe('');
  });

  it('clears profile name when selected profile id is cleared', () => {
    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfiles: [
            { id: 'prof-1', name: 'Baseline', updatedAt: '2026-07-01T00:00:00.000Z', config: { concurrency: 2, totalCalls: 10 } },
          ],
          selectedLoadTestProfileId: 'prof-1',
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
          },
        })}
      />,
    );

    expect((screen.getByTestId('grpc-load-test-profile-name') as HTMLInputElement).value).toBe('Baseline');

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTestProfiles: [
            { id: 'prof-1', name: 'Baseline', updatedAt: '2026-07-01T00:00:00.000Z', config: { concurrency: 2, totalCalls: 10 } },
          ],
          selectedLoadTestProfileId: '',
          loadTest: {
            config: { concurrency: 2, totalCalls: 10 },
          },
        })}
      />,
    );

    expect((screen.getByTestId('grpc-load-test-profile-name') as HTMLInputElement).value).toBe('');
  });
});
