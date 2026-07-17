/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcResponseSnapshotDiffModal } from './GrpcResponseSnapshotDiffModal';

describe('GrpcResponseSnapshotDiffModal (Phase 5I)', () => {
  it('does not render when closed', () => {
    render(
      <GrpcResponseSnapshotDiffModal
        open={false}
        diffs={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('grpc-snapshot-diff-modal')).toBeNull();
  });

  it('renders diff rows and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <GrpcResponseSnapshotDiffModal
        open
        diffs={[
          { path: 'message', change: 'changed', baselineValue: 'a', actualValue: 'b' },
        ]}
        baseline={{ capturedAt: '2026-06-29T12:00:00.000Z', grpcStatus: 0, body: { message: 'a' } }}
        actual={{
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          durationMs: 1,
          body: { message: 'b' },
        }}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('grpc-snapshot-diff-row-0')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('filters diff rows via search', () => {
    render(
      <GrpcResponseSnapshotDiffModal
        open
        diffs={[
          { path: 'message', change: 'changed', baselineValue: 'a', actualValue: 'b' },
          { path: 'count', change: 'removed', baselineValue: 1 },
        ]}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-snapshot-diff-search'), { target: { value: 'count' } });
    expect(screen.getByTestId('grpc-snapshot-diff-match-count').textContent).toBe('1/1');
    expect(screen.queryByTestId('grpc-snapshot-diff-row-1')).toBeNull();
  });
});
