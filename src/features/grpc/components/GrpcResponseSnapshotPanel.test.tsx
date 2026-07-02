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

describe('GrpcResponseSnapshotPanel (Phase 5I)', () => {
  it('renders stream baseline panel for streaming call types', () => {
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
    expect(screen.getByTestId('grpc-snapshot-update-baseline')).toBeTruthy();
  });

  it('captures baseline from multi-message stream session', () => {
    const onUpdateBaseline = vi.fn();
    render(
      <GrpcResponseSnapshotPanel
        callType="bidi_streaming"
        service="echo.EchoService"
        method="BidiEcho"
        streamComparisonEligible
        streamLifecycle="ended"
        streamMessages={[
          { sequence: 1, timestamp: '2026-06-29T12:00:00.000Z', direction: 'inbound', data: { id: 1 } },
          { sequence: 2, timestamp: '2026-06-29T12:00:01.000Z', direction: 'inbound', data: { id: 2 } },
        ]}
        onUpdateBaseline={onUpdateBaseline}
        onClearBaseline={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-snapshot-update-baseline'));
    expect(onUpdateBaseline).toHaveBeenCalledWith(expect.objectContaining({
      grpcStatus: 0,
      body: { inboundMessages: [{ id: 1 }, { id: 2 }] },
    }));
  });

  it('shows stream-specific guidance when update baseline is disabled for stream calls', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="server_streaming"
        service="echo.EchoService"
        method="ServerStream"
        streamComparisonEligible={false}
        streamLifecycle="streaming"
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-snapshot-update-baseline').getAttribute('title'))
      .toBe('Run and finish a stream in Studio first');
  });

  it('shows no-baseline badge and update action', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        lastResult={lastResult}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-snapshot-badge-none')).toBeTruthy();
    expect(screen.getByTestId('grpc-snapshot-update-baseline')).toBeTruthy();
  });

  it('shows match badge when baseline equals last result', () => {
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        baseline={baseline}
        lastResult={lastResult}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-snapshot-badge-match')).toBeTruthy();
  });

  it('opens diff modal when baseline differs', () => {
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
  });

  it('calls onUpdateBaseline when update clicked', () => {
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
      body: { message: 'hello' },
    }));
  });

  it('calls onClearBaseline when clear clicked', () => {
    const onClearBaseline = vi.fn();
    render(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        baseline={baseline}
        lastResult={lastResult}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={onClearBaseline}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-snapshot-clear-baseline'));
    expect(onClearBaseline).toHaveBeenCalledTimes(1);
  });

  it('closes diff modal when baseline is cleared', () => {
    const { rerender } = render(
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

    rerender(
      <GrpcResponseSnapshotPanel
        callType="unary"
        service="echo.EchoService"
        method="Echo"
        lastResult={lastResult}
        onUpdateBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('grpc-snapshot-diff-modal')).toBeNull();
  });
});
