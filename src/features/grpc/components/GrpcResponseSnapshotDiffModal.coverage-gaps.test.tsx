/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcResponseSnapshotDiffModal } from './GrpcResponseSnapshotDiffModal';

const diffs = [
  { path: 'message', change: 'changed' as const, baselineValue: 'a', actualValue: 'b' },
  { path: 'count', change: 'removed' as const, baselineValue: 1 },
];

describe('GrpcResponseSnapshotDiffModal coverage gaps', () => {
  it('resets search when reopened and shows empty-table message', () => {
    const { rerender } = render(
      <GrpcResponseSnapshotDiffModal
        open
        diffs={diffs}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-snapshot-diff-search'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No diff rows match your search/i)).toBeTruthy();

    rerender(
      <GrpcResponseSnapshotDiffModal
        open={false}
        diffs={diffs}
        onClose={vi.fn()}
      />,
    );
    rerender(
      <GrpcResponseSnapshotDiffModal
        open
        diffs={diffs}
        onClose={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-snapshot-diff-search') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('grpc-snapshot-diff-match-count').textContent).toBe('1/2');
  });

  it('navigates matches with prev/next buttons and Enter/Shift+Enter', () => {
    render(
      <GrpcResponseSnapshotDiffModal
        open
        diffs={diffs}
        onClose={vi.fn()}
      />,
    );

    const search = screen.getByTestId('grpc-snapshot-diff-search');
    fireEvent.click(screen.getByTestId('grpc-snapshot-diff-next'));
    expect(screen.getByTestId('grpc-snapshot-diff-match-count').textContent).toBe('2/2');
    expect(screen.getByTestId('grpc-snapshot-diff-row-1').className).toMatch(/active/);

    fireEvent.click(screen.getByTestId('grpc-snapshot-diff-prev'));
    expect(screen.getByTestId('grpc-snapshot-diff-match-count').textContent).toBe('1/2');

    search.focus();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('grpc-snapshot-diff-match-count').textContent).toBe('2/2');

    fireEvent.keyDown(window, { key: 'Enter', shiftKey: true });
    expect(screen.getByTestId('grpc-snapshot-diff-match-count').textContent).toBe('1/2');
  });

  it('focuses search on Cmd+F and closes from footer button', () => {
    const onClose = vi.fn();
    render(
      <GrpcResponseSnapshotDiffModal
        open
        diffs={diffs}
        onClose={onClose}
      />,
    );

    const search = screen.getByTestId('grpc-snapshot-diff-search');
    const focusSpy = vi.spyOn(search, 'focus');
    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    expect(focusSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('grpc-snapshot-diff-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders baseline-only and actual-only preview cards', () => {
    const { rerender } = render(
      <GrpcResponseSnapshotDiffModal
        open
        diffs={[]}
        baseline={{ capturedAt: '2026-06-29T12:00:00.000Z', grpcStatus: 0, body: { message: 'a' } }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Baseline body')).toBeTruthy();
    expect(screen.queryByText('Actual body')).toBeNull();

    rerender(
      <GrpcResponseSnapshotDiffModal
        open
        diffs={[]}
        actual={{
          callType: 'unary',
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          durationMs: 1,
          body: { message: 'b' },
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Actual body')).toBeTruthy();
    expect(screen.queryByText('Baseline body')).toBeNull();
  });
});
