/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcResponseSnapshotPanel } from './GrpcResponseSnapshotPanel';

const baseline = {
  capturedAt: '2026-06-29T12:00:00.000Z',
  grpcStatus: 0,
  statusMessage: 'OK',
  body: { message: 'hello' },
};

const lastResult = {
  callType: 'unary' as const,
  status: 0,
  statusMessage: 'OK',
  headers: {},
  trailers: {},
  durationMs: 10,
  body: { message: 'hello' },
};

describe('GrpcResponseSnapshotPanel coverage gaps', () => {
  it('formats invalid baseline timestamps verbatim', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="other.Service"
        method="Other"
        baseline={{ ...baseline, capturedAt: 'not-a-valid-date' }}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.getByText(/not-a-valid-date/)).toBeTruthy();
  });

  it('shows baseline hint when no active result is available to compare', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        baseline={baseline}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.getByText(/Baseline recorded/i)).toBeTruthy();
    expect(screen.queryByTestId('grpc-snapshot-badge-match')).toBeNull();
  });

  it('shows status mismatch note and plural diff count', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        baseline={baseline}
        lastResult={{
          ...lastResult,
          status: 13,
          statusMessage: 'INTERNAL',
          body: { message: 'changed', extra: true },
        }}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-snapshot-badge-diff')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/differences from baseline/i);
    expect(screen.getByRole('status').textContent).toMatch(/includes gRPC status/i);
  });

  it('disables update baseline when last unary result failed', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        lastResult={{ ...lastResult, status: 13, statusMessage: 'INTERNAL' }}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-snapshot-update-baseline') as HTMLButtonElement).disabled).toBe(true);
  });

  it('closes diff modal from footer control', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        baseline={baseline}
        lastResult={{ ...lastResult, body: { message: 'changed' } }}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-snapshot-view-diff'));
    expect(screen.getByTestId('grpc-snapshot-diff-modal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-snapshot-diff-close'));
    expect(screen.queryByTestId('grpc-snapshot-diff-modal')).toBeNull();
  });

  it('shows singular diff count for one changed field', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        baseline={baseline}
        lastResult={{ ...lastResult, body: { message: 'changed' } }}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/1 difference from baseline/i);
  });

  it('updates baseline from a successful unary result', () => {
    const onUpdateBaseline = vi.fn();
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        lastResult={lastResult}
        onUpdateBaseline={onUpdateBaseline}
        onClearBaseline={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-snapshot-update-baseline'));
    expect(onUpdateBaseline).toHaveBeenCalledWith(expect.objectContaining({
      grpcStatus: 0,
      body: lastResult.body,
    }));
  });

  it('renders snapshot panel for streaming call types with stream hint', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="server_streaming"
        service="echo.EchoService"
        method="ServerStream"
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-response-snapshot-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-snapshot-update-baseline')).toHaveProperty('disabled', true);
    expect(screen.getByTitle(/finish a stream/i)).toBeTruthy();
  });
});
