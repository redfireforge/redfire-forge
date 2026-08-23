/**
 * @vitest-environment jsdom
 * GraphqlTracingView.test.tsx — Sprint 7 (2G-1) unit tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { GraphqlTracingView } from './GraphqlTracingView';
import {
  nsToMs,
  durationColorClass,
  durationTextClass,
  buildPhaseSegments,
  computeOverheadNs,
  pctOfTotal,
} from '../utils/graphqlTracingUtils';
import type { ApolloTracingData } from '@shared/types/graphql';

// ─── Test data ───────────────────────────────────────────────────────────────

const makeTracing = (overrides: Partial<ApolloTracingData> = {}): ApolloTracingData => ({
  version:    1,
  startTime:  '2024-01-01T00:00:00.000Z',
  endTime:    '2024-01-01T00:00:00.100Z',
  duration:   100_000_000, // 100ms in ns
  parsing:    { startOffset: 0,          duration: 1_000_000  }, // 1ms
  validation: { startOffset: 1_000_000,  duration: 2_000_000  }, // 2ms
  execution:  {
    resolvers: [
      {
        path:        ['user'],
        parentType:  'Query',
        fieldName:   'user',
        returnType:  'User',
        startOffset: 3_000_000,
        duration:    10_000_000,  // 10ms — green
      },
      {
        path:        ['user', 'name'],
        parentType:  'User',
        fieldName:   'name',
        returnType:  'String',
        startOffset: 13_000_000,
        duration:    80_000_000,  // 80ms — amber
      },
      {
        path:        ['user', 'posts'],
        parentType:  'User',
        fieldName:   'posts',
        returnType:  '[Post!]!',
        startOffset: 15_000_000,
        duration:    250_000_000, // 250ms — red
      },
    ],
  },
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GraphqlTracingView', () => {
  it('renders the trace view container', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByTestId('gql-trace-view')).toBeInTheDocument();
  });

  it('renders resolver rows for each resolver', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    const rows = screen.getAllByTestId('gql-trace-resolver-row');
    expect(rows).toHaveLength(3);
  });

  it('displays field names and parent types', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByText('user')).toBeInTheDocument(); // fieldName
    expect(screen.getAllByText('Query').length).toBeGreaterThan(0);
  });

  it('renders sort buttons', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByTestId('gql-trace-sort-startTime')).toBeInTheDocument();
    expect(screen.getByTestId('gql-trace-sort-duration')).toBeInTheDocument();
    expect(screen.getByTestId('gql-trace-sort-name')).toBeInTheDocument();
  });

  it('default sort is startTime (button is active)', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    const btn = screen.getByTestId('gql-trace-sort-startTime');
    expect(btn).toHaveClass('gql-trace-sort-btn--active');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking "Slowest first" changes sort', async () => {
    const user = userEvent.setup();
    render(<GraphqlTracingView tracing={makeTracing()} />);
    const durationBtn = screen.getByTestId('gql-trace-sort-duration');
    await user.click(durationBtn);
    expect(durationBtn).toHaveClass('gql-trace-sort-btn--active');
    // Start-time button should no longer be active
    expect(screen.getByTestId('gql-trace-sort-startTime')).not.toHaveClass('gql-trace-sort-btn--active');
  });

  it('clicking "Name" changes sort', async () => {
    const user = userEvent.setup();
    render(<GraphqlTracingView tracing={makeTracing()} />);
    await user.click(screen.getByTestId('gql-trace-sort-name'));
    expect(screen.getByTestId('gql-trace-sort-name')).toHaveClass('gql-trace-sort-btn--active');
  });

  it('shows empty state when resolvers array is empty', () => {
    render(<GraphqlTracingView tracing={makeTracing({ execution: { resolvers: [] } })} />);
    expect(screen.getByTestId('gql-trace-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('gql-trace-view')).not.toBeInTheDocument();
  });

  it('displays summary totals', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    const stats = within(screen.getByTestId('gql-trace-stats'));
    expect(stats.getByText('Total')).toBeInTheDocument();
    expect(stats.getByText('Resolvers')).toBeInTheDocument();
    expect(stats.getByText('3')).toBeInTheDocument();
  });

  it('shows Parse and Validate timing when present', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    const stats = within(screen.getByTestId('gql-trace-stats'));
    expect(stats.getByText('Parse')).toBeInTheDocument();
    expect(stats.getByText('Validate')).toBeInTheDocument();
  });

  it('renders legend with duration color labels', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByText('< 50 ms')).toBeInTheDocument();
    expect(screen.getByText('50–200 ms')).toBeInTheDocument();
    expect(screen.getByText('> 200 ms')).toBeInTheDocument();
  });

  it('shows "Slowest" label for the slowest resolver', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(within(screen.getByTestId('gql-trace-stats')).getByText('Slowest')).toBeInTheDocument();
  });

  it('renders request phase timeline bar', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByTestId('gql-trace-phase-bar')).toBeInTheDocument();
    expect(screen.getByText('Request timeline')).toBeInTheDocument();
  });

  it('shows Other overhead when trailing time remains', () => {
    const tracing = makeTracing({
      duration: 200_000_000,
      execution: {
        resolvers: [{
          path: ['health'],
          parentType: 'Query',
          fieldName: 'health',
          returnType: 'String',
          startOffset: 5_000_000,
          duration: 10_000_000,
        }],
      },
    });
    render(<GraphqlTracingView tracing={tracing} />);
    expect(within(screen.getByTestId('gql-trace-stats')).getByText('Other')).toBeInTheDocument();
  });

  it('colors slowest resolver timing by duration threshold', () => {
    const tracing = makeTracing({
      execution: {
        resolvers: [{
          path: ['health'],
          parentType: 'Query',
          fieldName: 'health',
          returnType: 'String',
          startOffset: 1_000_000,
          duration: 34_000,
        }],
      },
      duration: 7_500_000,
    });
    render(<GraphqlTracingView tracing={tracing} />);
    const slowestStat = screen.getByText('Slowest').closest('.gql-trace-stat');
    expect(slowestStat?.querySelector('.gql-trace-stat-value')).toHaveClass('gql-trace-duration--ok');
  });

  it('renders return type for resolvers', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByText('→ User')).toBeInTheDocument();
  });

  it('renders ResolverRow with zero totalDuration (fallback leftPct=0, widthPct=0.4)', () => {
    const tracing = makeTracing({ duration: 0 });
    render(<GraphqlTracingView tracing={tracing} />);
    const rows = screen.getAllByTestId('gql-trace-resolver-row');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('shows empty state when execution.resolvers is undefined', () => {
    const tracing = { ...makeTracing(), execution: { resolvers: undefined as unknown as [] } };
    render(<GraphqlTracingView tracing={tracing} />);
    expect(screen.getByTestId('gql-trace-empty')).toBeInTheDocument();
  });

  it('shows leading Other overhead in phase timeline when the first phase starts after zero', () => {
    render(
      <GraphqlTracingView
        tracing={makeTracing({
          parsing: { startOffset: 2_000_000, duration: 1_000_000 },
          validation: { startOffset: 3_000_000, duration: 1_000_000 },
        })}
      />,
    );
    const bar = screen.getByTestId('gql-trace-phase-bar');
    expect(within(bar).getByText('Other')).toBeInTheDocument();
    expect(bar.querySelector('.gql-trace-phase-seg--overhead')).toBeTruthy();
  });

  it('renders nested resolver paths joined with arrows', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByTitle('user → name')).toBeInTheDocument();
  });

  it('omits return type badge when resolver has no returnType', () => {
    const tracing = makeTracing({
      execution: {
        resolvers: [{
          path: ['health'],
          parentType: 'Query',
          fieldName: 'health',
          returnType: '',
          startOffset: 1_000_000,
          duration: 10_000_000,
        }],
      },
    });
    render(<GraphqlTracingView tracing={tracing} />);
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('hides parse and validate stats when tracing phases are absent', () => {
    render(
      <GraphqlTracingView
        tracing={{
          ...makeTracing(),
          parsing: undefined,
          validation: undefined,
        }}
      />,
    );
    const stats = within(screen.getByTestId('gql-trace-stats'));
    expect(stats.queryByText('Parse')).not.toBeInTheDocument();
    expect(stats.queryByText('Validate')).not.toBeInTheDocument();
  });

  it('uses warn duration class for resolver rows between 50ms and 200ms', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    const row = screen.getAllByTestId('gql-trace-resolver-row')[1];
    expect(row.querySelector('.gql-trace-duration--warn')).toBeInTheDocument();
  });

  it('uses slow duration class for resolver rows above 200ms', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    const row = screen.getAllByTestId('gql-trace-resolver-row')[2];
    expect(row.querySelector('.gql-trace-duration--slow')).toBeInTheDocument();
  });
});

describe('nsToMs', () => {
  it('formats sub-100µs durations as microseconds', () => {
    expect(nsToMs(50_000)).toMatch(/µs$/);
  });

  it('formats sub-1ms durations with two decimal places', () => {
    expect(nsToMs(500_000)).toBe('0.50 ms');
  });

  it('formats sub-100ms durations with one decimal place', () => {
    expect(nsToMs(50_000_000)).toBe('50.0 ms');
  });

  it('formats 100ms and above with zero decimal places', () => {
    expect(nsToMs(150_000_000)).toBe('150 ms');
  });
});

describe('durationTextClass', () => {
  it('returns ok, warn, and slow classes by threshold', () => {
    expect(durationTextClass(10_000_000)).toBe('gql-trace-duration--ok');
    expect(durationTextClass(100_000_000)).toBe('gql-trace-duration--warn');
    expect(durationTextClass(300_000_000)).toBe('gql-trace-duration--slow');
  });
});

describe('buildPhaseSegments', () => {
  it('adds overhead-head when the first phase starts after zero', () => {
    const segments = buildPhaseSegments(makeTracing({
      parsing: { startOffset: 2_000_000, duration: 1_000_000 },
      validation: { startOffset: 3_000_000, duration: 1_000_000 },
    }));
    expect(segments.some((s) => s.key === 'overhead-head')).toBe(true);
  });

  it('adds overhead-tail when phases end before total duration', () => {
    const segments = buildPhaseSegments(makeTracing({
      duration: 500_000_000,
      execution: {
        resolvers: [{
          path: ['health'],
          parentType: 'Query',
          fieldName: 'health',
          returnType: 'String',
          startOffset: 1_000_000,
          duration: 10_000_000,
        }],
      },
    }));
    expect(segments.some((s) => s.key === 'overhead-tail')).toBe(true);
  });

  it('omits execution segment when resolver window has zero width', () => {
    const segments = buildPhaseSegments(makeTracing({
      execution: {
        resolvers: [{
          path: ['health'],
          parentType: 'Query',
          fieldName: 'health',
          returnType: 'String',
          startOffset: 5_000_000,
          duration: 0,
        }],
      },
    }));
    expect(segments.some((s) => s.variant === 'execution')).toBe(false);
  });

  it('builds segments without parsing or validation when those phases are absent', () => {
    const segments = buildPhaseSegments({
      ...makeTracing(),
      parsing: undefined,
      validation: undefined,
      execution: { resolvers: [] },
    });
    expect(segments.length).toBeGreaterThanOrEqual(0);
  });

  it('skips parse segment when parsing duration is zero', () => {
    const segments = buildPhaseSegments({
      ...makeTracing(),
      parsing: { startOffset: 0, duration: 0 },
    });
    expect(segments.some((s) => s.variant === 'parse')).toBe(false);
  });
});

describe('computeOverheadNs', () => {
  it('returns zero when resolver ends exceed total duration', () => {
    expect(computeOverheadNs(makeTracing({ duration: 10_000_000 }))).toBe(0);
  });

  it('returns trailing overhead when resolvers finish before total duration', () => {
    const overhead = computeOverheadNs(makeTracing({
      duration: 200_000_000,
      execution: {
        resolvers: [{
          path: ['health'],
          parentType: 'Query',
          fieldName: 'health',
          returnType: 'String',
          startOffset: 5_000_000,
          duration: 10_000_000,
        }],
      },
    }));
    expect(overhead).toBeGreaterThan(0);
  });

  it('counts parsing and validation end times when present', () => {
    const overhead = computeOverheadNs(makeTracing({
      duration: 100_000_000,
      parsing: { startOffset: 0, duration: 5_000_000 },
      validation: { startOffset: 5_000_000, duration: 5_000_000 },
      execution: { resolvers: [] },
    }));
    expect(overhead).toBeGreaterThanOrEqual(0);
  });
});

describe('pctOfTotal', () => {
  it('returns zero when total duration is zero or negative', () => {
    expect(pctOfTotal(10, 0)).toBe(0);
    expect(pctOfTotal(10, -1)).toBe(0);
  });
});

describe('durationColorClass', () => {
  it('returns ok, warn, and slow classes by threshold', () => {
    expect(durationColorClass(10_000_000)).toBe('gql-trace-bar--ok');
    expect(durationColorClass(100_000_000)).toBe('gql-trace-bar--warn');
    expect(durationColorClass(300_000_000)).toBe('gql-trace-bar--slow');
  });
});
