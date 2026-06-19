/**
 * @vitest-environment jsdom
 * GraphqlTracingView.test.tsx — Sprint 7 (2G-1) unit tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { GraphqlTracingView } from './GraphqlTracingView';
import type { ApolloTracingData } from '../../../shared/types/graphql';

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
    // Should show "Total" and "Resolvers" labels
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Resolvers')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 resolvers count
  });

  it('shows Parse and Validate timing when present', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByText('Parse')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
  });

  it('renders legend with duration color labels', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByText('< 50ms')).toBeInTheDocument();
    expect(screen.getByText('50–200ms')).toBeInTheDocument();
    expect(screen.getByText('> 200ms')).toBeInTheDocument();
  });

  it('shows "Slowest" label for the slowest resolver', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByText('Slowest')).toBeInTheDocument();
  });

  it('renders return type for resolvers', () => {
    render(<GraphqlTracingView tracing={makeTracing()} />);
    expect(screen.getByText('→ User')).toBeInTheDocument();
  });
});

  // ─── totalDuration = 0 edge case (lines 55-56 in ResolverRow) ───────────────

  it('renders ResolverRow with zero totalDuration (fallback leftPct=0, widthPct=0.3)', () => {
    const tracing = makeTracing({ duration: 0 });
    render(<GraphqlTracingView tracing={tracing} />);
    // With duration=0, ResolverRow falls back to leftPct=0 and widthPct=0.3
    const rows = screen.getAllByTestId('gql-trace-resolver-row');
    expect(rows.length).toBeGreaterThan(0);
  });

  // ─── null/undefined resolvers (lines 104, 122 — `?? []` false branch) ───────

  it('shows empty state when execution.resolvers is undefined', () => {
    const tracing = { ...makeTracing(), execution: { resolvers: undefined as unknown as [] } };
    render(<GraphqlTracingView tracing={tracing} />);
    expect(screen.getByTestId('gql-trace-empty')).toBeInTheDocument();
  });
