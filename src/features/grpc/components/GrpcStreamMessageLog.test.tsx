/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrpcStreamMessageLog } from './GrpcStreamMessageLog';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number; getScrollElement?: () => unknown }) => {
    opts.getScrollElement?.();
    return {
      getVirtualItems: () =>
        Array.from({ length: opts.count }, (_, i) => ({
          index: i,
          start: i * opts.estimateSize(),
          size: opts.estimateSize(),
        })),
      getTotalSize: () => opts.count * opts.estimateSize(),
    };
  },
}));

describe('GrpcStreamMessageLog', () => {
  it('renders empty state', () => {
    render(<GrpcStreamMessageLog messages={[]} />);
    expect(screen.getByTestId('grpc-stream-log-empty')).toBeTruthy();
    expect(screen.queryByTestId('grpc-stream-log-count')).toBeNull();
  });

  it('renders message rows and count badge', () => {
    render(
      <GrpcStreamMessageLog
        messages={[
          {
            sequence: 1,
            timestamp: '2026-01-01T00:00:00.000Z',
            direction: 'inbound',
            data: { message: 'hello' },
          },
        ]}
      />,
    );
    expect(screen.getByTestId('grpc-stream-log-row-1')).toBeTruthy();
    expect(screen.getByTestId('grpc-stream-log-count').textContent).toContain('1 message');
    expect(screen.getByTestId('grpc-stream-log-count').textContent).toContain('cap: 10,000');
  });

  it('renders direction legend and per-row arrows', () => {
    render(
      <GrpcStreamMessageLog
        messages={[
          {
            sequence: 1,
            timestamp: '2026-01-01T00:00:00.000Z',
            direction: 'inbound',
            data: { message: 'in' },
          },
          {
            sequence: 2,
            timestamp: '2026-01-01T00:00:01.000Z',
            direction: 'outbound',
            data: { message: 'out' },
          },
        ]}
      />,
    );
    expect(screen.getByTestId('grpc-stream-direction-legend').textContent).toContain('↓ inbound');
    expect(screen.getByTestId('grpc-stream-direction-legend').textContent).toContain('↑ outbound');
    expect(screen.getByLabelText('inbound').textContent).toBe('↓');
    expect(screen.getByLabelText('outbound').textContent).toBe('↑');
  });
});
