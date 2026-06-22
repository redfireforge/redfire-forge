/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GqlLatencyHistogram } from './GqlLatencyHistogram';

describe('GqlLatencyHistogram', () => {
  it('renders header stats and request count', () => {
    render(<GqlLatencyHistogram latencyHistory={[40, 60, 120, 400, 1500]} />);

    expect(screen.getByTestId('gql-histogram-strip')).toBeTruthy();
    expect(screen.getByText('Latency')).toBeTruthy();
    expect(screen.getByText(/avg/)).toBeTruthy();
    expect(screen.getByText(/p95/)).toBeTruthy();
    expect(screen.getByText('n=5')).toBeTruthy();
  });

  it('renders bucket labels and non-zero counts', () => {
    render(<GqlLatencyHistogram latencyHistory={[10, 70, 110, 300, 1200, 35000]} />);

    expect(screen.getByText('<50ms')).toBeTruthy();
    expect(screen.getByText('50–100')).toBeTruthy();
    expect(screen.getByText('100–200')).toBeTruthy();
    expect(screen.getByText('200–500')).toBeTruthy();
    expect(screen.getByText('1–2s')).toBeTruthy();
    expect(screen.getByText('≥30s')).toBeTruthy();

    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('shows request counts above non-empty buckets', () => {
    render(<GqlLatencyHistogram latencyHistory={[10, 70, 110, 300, 1200, 35000]} />);

    const counts = document.querySelectorAll('.gql-hist-count');
    expect(counts.length).toBeGreaterThan(0);
    expect(Array.from(counts).some((el) => el.textContent === '1')).toBe(true);
  });

  it('applies bar speed classes across buckets', () => {
    const { container } = render(
      <GqlLatencyHistogram latencyHistory={[20, 80, 150, 300, 800, 1500, 4000]} />,
    );

    expect(container.querySelector('.gql-hist-bar--ok')).toBeTruthy();
    expect(container.querySelector('.gql-hist-bar--warn')).toBeTruthy();
    expect(container.querySelector('.gql-hist-bar--slow')).toBeTruthy();
  });

  it('handles empty history gracefully', () => {
    render(<GqlLatencyHistogram latencyHistory={[]} />);

    expect(screen.getByText('n=0')).toBeTruthy();
    expect(screen.getByText('avg 0ms')).toBeTruthy();
    expect(screen.getByText('p95 0ms')).toBeTruthy();
  });
});
