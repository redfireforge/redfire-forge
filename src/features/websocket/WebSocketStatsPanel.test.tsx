/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WebSocketStatsPanel } from './WebSocketStatsPanel';
import type { WsMetricsSnapshot } from './useWebSocketMetrics';

function makeSnapshot(overrides: Partial<WsMetricsSnapshot> = {}): WsMetricsSnapshot {
  return {
    msgPerSec: 0,
    sentPerSec: 0,
    receivedPerSec: 0,
    totalBytesIn: 0,
    totalBytesOut: 0,
    bytesInPerSec: 0,
    bytesOutPerSec: 0,
    textFrames: 0,
    binaryFrames: 0,
    controlFrames: 0,
    errorCount: 0,
    history: [],
    ...overrides,
  };
}

describe('WebSocketStatsPanel', () => {
  it('renders the panel container', () => {
    render(<WebSocketStatsPanel metrics={makeSnapshot()} />);
    expect(screen.getByTestId('stats-panel')).toBeTruthy();
  });

  it('displays message rate', () => {
    render(<WebSocketStatsPanel metrics={makeSnapshot({ msgPerSec: 42, sentPerSec: 20, receivedPerSec: 22 })} />);
    const card = screen.getByTestId('stats-msg-rate');
    expect(card.textContent).toContain('42');
    expect(card.textContent).toContain('↑ 20');
    expect(card.textContent).toContain('↓ 22');
  });

  it('displays bytes in/out', () => {
    render(<WebSocketStatsPanel metrics={makeSnapshot({ totalBytesIn: 1024, totalBytesOut: 2048 })} />);
    expect(screen.getByTestId('stats-bytes-in').textContent).toContain('1.0 KB');
    expect(screen.getByTestId('stats-bytes-out').textContent).toContain('2.0 KB');
  });

  it('displays frame type distribution bar', () => {
    render(<WebSocketStatsPanel metrics={makeSnapshot({ textFrames: 70, binaryFrames: 25, controlFrames: 5 })} />);
    const bar = screen.getByTestId('frame-type-bar');
    expect(bar).toBeTruthy();
    const segments = bar.querySelectorAll('.ws-stats-frame-seg');
    expect(segments.length).toBe(3);
  });

  it('shows "No frames" when all frame counts are 0', () => {
    render(<WebSocketStatsPanel metrics={makeSnapshot()} />);
    const frames = screen.getByTestId('stats-frames');
    expect(frames.textContent).toContain('No frames');
  });

  it('shows error card only when errorCount > 0', () => {
    const { rerender } = render(<WebSocketStatsPanel metrics={makeSnapshot({ errorCount: 0 })} />);
    expect(screen.queryByTestId('stats-errors')).toBeNull();

    rerender(<WebSocketStatsPanel metrics={makeSnapshot({ errorCount: 3 })} />);
    const errorCard = screen.getByTestId('stats-errors');
    expect(errorCard.textContent).toContain('3');
  });

  it('renders sparkline when history has >= 2 data points', () => {
    const { container } = render(
      <WebSocketStatsPanel metrics={makeSnapshot({ history: [5, 10, 3, 8] })} />,
    );
    const svg = container.querySelector('.ws-stats-sparkline');
    expect(svg).toBeTruthy();
    expect(svg?.querySelector('polyline')).toBeTruthy();
  });

  it('does not render sparkline with < 2 data points', () => {
    const { container } = render(
      <WebSocketStatsPanel metrics={makeSnapshot({ history: [5] })} />,
    );
    const svg = container.querySelector('.ws-stats-sparkline');
    expect(svg).toBeNull();
  });
});
