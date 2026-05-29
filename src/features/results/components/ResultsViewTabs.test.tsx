// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsViewTabs } from './ResultsViewTabs';

const tabIds = {
  overview: { tab: 't-overview', panel: 'p-overview' },
  requests: { tab: 't-requests', panel: 'p-requests' },
  sla: { tab: 't-sla', panel: 'p-sla' },
  analysis: { tab: 't-analysis', panel: 'p-analysis' },
} as const;

describe('ResultsViewTabs', () => {
  it('renders all tabs with correct selected state', () => {
    render(
      <ResultsViewTabs
        resultsViewTab="overview"
        visibleBaselineCount={0}
        onChange={vi.fn()}
        tabIds={tabIds}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Request Details' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: 'SLA' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: 'Comparison & Trends' }).getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange for each tab click', () => {
    const onChange = vi.fn();
    render(
      <ResultsViewTabs
        resultsViewTab="overview"
        visibleBaselineCount={0}
        onChange={onChange}
        tabIds={tabIds}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Request Details' }));
    fireEvent.click(screen.getByRole('tab', { name: 'SLA' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Comparison & Trends' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 'requests');
    expect(onChange).toHaveBeenNthCalledWith(2, 'sla');
    expect(onChange).toHaveBeenNthCalledWith(3, 'analysis');
    expect(onChange).toHaveBeenNthCalledWith(4, 'overview');
  });

  it('shows baseline count in Comparison & Trends tab only when count is positive', () => {
    const { rerender } = render(
      <ResultsViewTabs
        resultsViewTab="analysis"
        visibleBaselineCount={0}
        onChange={vi.fn()}
        tabIds={tabIds}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Comparison & Trends' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Comparison & Trends (2)' })).toBeNull();

    rerender(
      <ResultsViewTabs
        resultsViewTab="analysis"
        visibleBaselineCount={2}
        onChange={vi.fn()}
        tabIds={tabIds}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Comparison & Trends (2)' })).toBeTruthy();
  });

  it('marks requests and sla tabs as selected when active', () => {
    const { rerender } = render(
      <ResultsViewTabs
        resultsViewTab="requests"
        visibleBaselineCount={0}
        onChange={vi.fn()}
        tabIds={tabIds}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Request Details' }).getAttribute('aria-selected')).toBe('true');

    rerender(
      <ResultsViewTabs
        resultsViewTab="sla"
        visibleBaselineCount={0}
        onChange={vi.fn()}
        tabIds={tabIds}
      />,
    );
    expect(screen.getByRole('tab', { name: 'SLA' }).getAttribute('aria-selected')).toBe('true');
  });
});
