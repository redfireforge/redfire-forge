/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcStreamStatusBar } from './GrpcStreamStatusBar';

describe('GrpcStreamStatusBar', () => {
  it('renders lifecycle badge and direction counts', () => {
    render(
      <GrpcStreamStatusBar
        lifecycle="streaming"
        inboundCount={3}
        outboundCount={1}
        startedAt="2026-01-01T00:00:00.000Z"
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-status-badge').textContent).toBe('Streaming');
    expect(screen.getByTestId('grpc-stream-inbound-count').textContent).toContain('3');
    expect(screen.getByTestId('grpc-stream-outbound-count').textContent).toContain('1');
    expect(screen.getByTestId('grpc-stream-elapsed').textContent).toContain('Elapsed');
  });

  it('shows duration label when stream is terminal', () => {
    render(
      <GrpcStreamStatusBar
        lifecycle="ended"
        inboundCount={2}
        outboundCount={0}
        startedAt="2026-01-01T00:00:00.000Z"
        endedAt="2026-01-01T00:01:30.000Z"
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-status-badge').textContent).toBe('Ended');
    expect(screen.getByTestId('grpc-stream-elapsed').textContent).toContain('Duration');
    expect(screen.getByTestId('grpc-stream-elapsed').textContent).toContain('1m 30s');
  });

  it('invokes export when messages exist', () => {
    const onExport = vi.fn();
    render(
      <GrpcStreamStatusBar
        lifecycle="streaming"
        inboundCount={1}
        outboundCount={0}
        onClear={vi.fn()}
        onExport={onExport}
      />,
    );
    expect(screen.getByTestId('grpc-stream-export-log-btn')).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByTestId('grpc-stream-export-log-btn'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('disables export when log is empty or handler missing', () => {
    const { rerender } = render(
      <GrpcStreamStatusBar
        lifecycle="idle"
        inboundCount={0}
        outboundCount={0}
        onClear={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-export-log-btn')).toHaveProperty('disabled', true);

    rerender(
      <GrpcStreamStatusBar
        lifecycle="streaming"
        inboundCount={1}
        outboundCount={0}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-export-log-btn')).toHaveProperty('disabled', true);
  });

  it('disables clear when no messages or disabled prop', () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <GrpcStreamStatusBar
        lifecycle="idle"
        inboundCount={0}
        outboundCount={0}
        onClear={onClear}
      />,
    );
    expect(screen.getByTestId('grpc-stream-clear-log')).toHaveProperty('disabled', true);

    rerender(
      <GrpcStreamStatusBar
        lifecycle="streaming"
        inboundCount={1}
        outboundCount={0}
        disabled
        onClear={onClear}
      />,
    );
    expect(screen.getByTestId('grpc-stream-clear-log')).toHaveProperty('disabled', true);

    rerender(
      <GrpcStreamStatusBar
        lifecycle="streaming"
        inboundCount={1}
        outboundCount={0}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-stream-clear-log'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('renders all lifecycle labels', () => {
    const labels: Array<[import('../../../shared/grpc/streamLifecycle').GrpcStreamLifecycle, string]> = [
      ['idle', 'Idle'],
      ['starting', 'Starting…'],
      ['streaming', 'Streaming'],
      ['ending', 'Ending…'],
      ['ended', 'Ended'],
      ['cancelled', 'Cancelled'],
      ['error', 'Error'],
    ];
    for (const [lifecycle, text] of labels) {
      const { unmount } = render(
        <GrpcStreamStatusBar
          lifecycle={lifecycle}
          inboundCount={0}
          outboundCount={0}
          onClear={vi.fn()}
        />,
      );
      expect(screen.getByTestId('grpc-stream-status-badge').textContent).toBe(text);
      unmount();
    }
  });

  it('shows em dash when startedAt is missing or invalid', () => {
    render(
      <GrpcStreamStatusBar
        lifecycle="idle"
        inboundCount={0}
        outboundCount={0}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-elapsed').textContent).toContain('—');

    render(
      <GrpcStreamStatusBar
        lifecycle="ended"
        inboundCount={0}
        outboundCount={0}
        startedAt="not-a-date"
        onClear={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('grpc-stream-elapsed').pop()?.textContent).toContain('—');
  });
});
