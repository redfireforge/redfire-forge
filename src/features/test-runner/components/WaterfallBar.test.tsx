// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WaterfallBar, { AggregatedTimingTable } from './WaterfallBar';
import type { TimingBreakdown } from '@shared/types';

function makeTiming(overrides: Partial<TimingBreakdown> = {}): TimingBreakdown {
  return {
    dnsLookup: 5,
    tcpConnect: 10,
    tlsHandshake: 15,
    ttfb: 50,
    download: 20,
    total: 100,
    ...overrides,
  };
}

describe('WaterfallBar', () => {
  it('renders all phases when every phase has a positive duration', () => {
    const { container } = render(<WaterfallBar timing={makeTiming()} />);
    // 5 track segments, one per phase
    expect(container.querySelectorAll('.wf-bar-segment')).toHaveLength(5);
    // labels include all phase names plus total
    expect(screen.getByText('DNS:')).toBeInTheDocument();
    expect(screen.getByText('TCP:')).toBeInTheDocument();
    expect(screen.getByText('TLS:')).toBeInTheDocument();
    expect(screen.getByText('TTFB:')).toBeInTheDocument();
    expect(screen.getByText('Download:')).toBeInTheDocument();
    expect(screen.getByText('Total:')).toBeInTheDocument();
  });

  it('does NOT show the "phases hidden" note when all phases are visible', () => {
    render(<WaterfallBar timing={makeTiming()} />);
    expect(screen.queryByText(/Phases at 0 ms/)).not.toBeInTheDocument();
  });

  it('hides zero-duration segments and shows the note when some phases are missing', () => {
    const timing = makeTiming({ dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0, ttfb: 50, download: 20, total: 70 });
    const { container } = render(<WaterfallBar timing={timing} />);
    // only ttfb + download have positive ms
    expect(container.querySelectorAll('.wf-bar-segment')).toHaveLength(2);
    expect(screen.getByText(/Phases at 0 ms \(connection reused\) are hidden\./)).toBeInTheDocument();
    // hidden phases should not have labels
    expect(screen.queryByText('DNS:')).not.toBeInTheDocument();
  });

  it('does NOT show the note when showLegend is false even if phases are hidden', () => {
    const timing = makeTiming({ dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0, ttfb: 50, download: 20, total: 70 });
    render(<WaterfallBar timing={timing} showLegend={false} />);
    expect(screen.queryByText(/Phases at 0 ms/)).not.toBeInTheDocument();
  });

  it('returns null when there are no visible phases and ttfb is zero', () => {
    const timing = makeTiming({ dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0, ttfb: 0, download: 0, total: 0 });
    const { container } = render(<WaterfallBar timing={timing} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses a minimum 2% width for very small segments and a title with the ms value', () => {
    const timing = makeTiming({ dnsLookup: 0.1, tcpConnect: 0, tlsHandshake: 0, ttfb: 0.1, download: 0, total: 1000 });
    const { container } = render(<WaterfallBar timing={timing} />);
    const segments = container.querySelectorAll<HTMLElement>('.wf-bar-segment');
    // 2 positive phases -> 2 segments
    expect(segments).toHaveLength(2);
    // (0.1 / 1000) * 100 = 0.01 -> clamped to 2%
    expect(segments[0].style.width).toBe('2%');
    expect(segments[0].getAttribute('title')).toBe('DNS: 0.1 ms');
  });

  it('falls back to total=1 when timing.total is zero to avoid divide-by-zero', () => {
    // total 0 but a phase is positive -> not null, total used as 1
    const timing = makeTiming({ dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0, ttfb: 5, download: 0, total: 0 });
    const { container } = render(<WaterfallBar timing={timing} />);
    const segments = container.querySelectorAll<HTMLElement>('.wf-bar-segment');
    expect(segments).toHaveLength(1);
    // (5 / 1) * 100 = 500 -> width 500%
    expect(segments[0].style.width).toBe('500%');
  });
});

describe('AggregatedTimingTable', () => {
  it('returns null when no results have timing data', () => {
    const { container } = render(<AggregatedTimingTable results={[{}, { timing: undefined }]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders averages across results that have timing', () => {
    const results = [
      { timing: makeTiming({ dnsLookup: 10, total: 100 }) },
      { timing: makeTiming({ dnsLookup: 20, total: 200 }) },
      {}, // no timing -> excluded
    ];
    render(<AggregatedTimingTable results={results} />);
    expect(screen.getByText('Avg Timing Breakdown (2 requests)')).toBeInTheDocument();
    // dnsLookup average (10 + 20) / 2 = 15.0 (collides with tls=15, so just assert presence)
    expect(screen.getAllByText('15.0 ms').length).toBeGreaterThanOrEqual(1);
    // ttfb average (50 + 50) / 2 = 50.0 is unique
    expect(screen.getByText('50.0 ms')).toBeInTheDocument();
    // all 5 phase labels present
    expect(screen.getByText('DNS')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });
});
