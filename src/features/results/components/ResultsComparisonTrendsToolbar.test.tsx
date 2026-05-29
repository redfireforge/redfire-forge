// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsComparisonTrendsToolbar } from './ResultsComparisonTrendsToolbar';

describe('ResultsComparisonTrendsToolbar', () => {
  it('calls compare selection and trend toggles', () => {
    const onCompareSelectionChange = vi.fn();
    const onClearComparison = vi.fn();
    const onToggleTrend = vi.fn();

    render(
      <ResultsComparisonTrendsToolbar
        isBaselineMode={false}
        compareBaselineId=""
        runs={[]}
        baselines={[]}
        selectedRunId="run-1"
        showTrend={false}
        onCompareSelectionChange={onCompareSelectionChange}
        onClearComparison={onClearComparison}
        onToggleTrend={onToggleTrend}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Trend' }));
    expect(onToggleTrend).toHaveBeenCalledTimes(1);
  });

  it('shows baseline mode text when baseline compare is active', () => {
    render(
      <ResultsComparisonTrendsToolbar
        isBaselineMode
        compareBaselineId="baseline-1"
        runs={[]}
        baselines={[]}
        selectedRunId="run-1"
        showTrend
        onCompareSelectionChange={vi.fn()}
        onClearComparison={vi.fn()}
        onToggleTrend={vi.fn()}
      />,
    );

    expect(screen.getByText('Baseline Mode')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide Trend' })).toBeTruthy();
  });
});