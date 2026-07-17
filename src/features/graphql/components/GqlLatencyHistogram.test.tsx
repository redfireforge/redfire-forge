/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GqlLatencyHistogram } from './GqlLatencyHistogram';
import { bucketIndex, formatLatencyMs } from './gqlLatencyHistogramUtils';

describe('GqlLatencyHistogram helpers', () => {
  it('bucketIndex maps values to expected buckets', () => {
    expect(bucketIndex(10)).toBe(0);
    expect(bucketIndex(75)).toBe(1);
    expect(bucketIndex(1500)).toBe(5);
    expect(bucketIndex(35000)).toBe(9);
  });

  it('formatLatencyMs renders ms and seconds', () => {
    expect(formatLatencyMs(40)).toBe('40ms');
    expect(formatLatencyMs(1500)).toBe('1.5s');
    expect(formatLatencyMs(12000)).toBe('12s');
  });
});

describe('GqlLatencyHistogram', () => {
  it('renders heading, metric cards, and request count', () => {
    render(<GqlLatencyHistogram latencyHistory={[40, 60, 120, 400, 1500]} />);

    expect(screen.getByTestId('gql-histogram-strip')).toBeTruthy();
    expect(screen.getByText('Latency distribution')).toBeTruthy();
    expect(screen.getByText(/5 requests/)).toBeTruthy();
    expect(screen.getByText('Min')).toBeTruthy();
    expect(screen.getByText('Avg')).toBeTruthy();
    expect(screen.getByText('p95')).toBeTruthy();
    expect(screen.getByText('Max')).toBeTruthy();
  });

  it('renders bucket labels and non-zero counts once per filled bucket', () => {
    render(<GqlLatencyHistogram latencyHistory={[10, 70, 110, 300, 1200, 35000]} />);

    expect(screen.getByText('<50ms')).toBeTruthy();
    expect(screen.getByText('50–100')).toBeTruthy();
    expect(screen.getByText('100–200')).toBeTruthy();
    expect(screen.getByText('200–500')).toBeTruthy();
    expect(screen.getByText('1–2s')).toBeTruthy();
    expect(screen.getByText('≥30s')).toBeTruthy();

    const counts = document.querySelectorAll('.gql-hist-count');
    expect(counts.length).toBe(6);
  });

  it('shows percentage in bucket tooltip', () => {
    render(<GqlLatencyHistogram latencyHistory={[10, 70, 110, 300, 1200, 35000]} />);

    const col = screen.getByTestId('gql-hist-col-0');
    expect(col.getAttribute('title')).toContain('17%');
  });

  it('applies bar speed classes across buckets', () => {
    const { container } = render(
      <GqlLatencyHistogram latencyHistory={[20, 80, 150, 300, 800, 1500, 4000]} />,
    );

    expect(container.querySelector('.gql-hist-bar--ok')).toBeTruthy();
    expect(container.querySelector('.gql-hist-bar--warn')).toBeTruthy();
    expect(container.querySelector('.gql-hist-bar--slow')).toBeTruthy();
  });

  it('highlights the p95 bucket and shows footer note', () => {
    const { container } = render(
      <GqlLatencyHistogram latencyHistory={[40, 45, 50, 55, 60, 400, 1500]} />,
    );

    expect(container.querySelector('.gql-hist-col--p95')).toBeTruthy();
    expect(screen.getByTestId('gql-hist-p95-note')).toBeTruthy();
  });

  it('renders speed legend', () => {
    render(<GqlLatencyHistogram latencyHistory={[40, 60]} />);
    expect(screen.getByText('Fast')).toBeTruthy();
    expect(screen.getByText('Moderate')).toBeTruthy();
    expect(screen.getByText('Slow')).toBeTruthy();
  });

  it('handles empty history gracefully', () => {
    render(<GqlLatencyHistogram latencyHistory={[]} />);

    expect(screen.getByText(/0 requests/)).toBeTruthy();
    expect(screen.getAllByText('0ms').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('gql-hist-p95-note')).toBeNull();
  });
});
