/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GRPC_STREAM_MESSAGE_CAP, type GrpcStreamLogEntry } from '../../../shared/grpc/contracts';
import { GrpcStreamMessageLog } from './GrpcStreamMessageLog';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number; getScrollElement?: () => unknown }) => {
    opts.getScrollElement?.();
    opts.estimateSize();
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

function makeMessage(sequence: number, direction: GrpcStreamLogEntry['direction'] = 'inbound'): GrpcStreamLogEntry {
  return {
    sequence,
    timestamp: '2026-01-01T00:00:00.000Z',
    direction,
    data: { message: `msg-${sequence}` },
  };
}

describe('GrpcStreamMessageLog coverage gaps', () => {
  it('renders plural count label and cap reached banner', () => {
    const messages = [makeMessage(1), makeMessage(2)];
    render(<GrpcStreamMessageLog messages={messages} />);
    expect(screen.getByTestId('grpc-stream-log-count').textContent).toContain('2 messages');

    const capped = Array.from({ length: GRPC_STREAM_MESSAGE_CAP }, (_, index) => makeMessage(index + 1));
    render(<GrpcStreamMessageLog messages={capped} />);
    expect(screen.getByText(/cap reached/i)).toBeTruthy();
  });

  it('truncates long JSON previews and handles non-serializable data', () => {
    const circular: Record<string, unknown> = { message: 'x' };
    circular.self = circular;

    render(
      <GrpcStreamMessageLog
        messages={[{
          sequence: 1,
          timestamp: '2026-01-01T00:00:00.000Z',
          direction: 'outbound',
          data: {
            payload: 'x'.repeat(200),
            circular,
          },
        }]}
      />,
    );

    const preview = screen.getByTestId('grpc-stream-log-row-1').textContent ?? '';
    expect(preview.length).toBeGreaterThan(0);
    expect(preview).toContain('↑');
  });

  it('marks list as disabled when disabled prop is true', () => {
    render(<GrpcStreamMessageLog messages={[makeMessage(1)]} disabled />);
    expect(screen.getByTestId('grpc-stream-log-list').getAttribute('aria-disabled')).toBe('true');
  });
});
