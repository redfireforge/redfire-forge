// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultsRunTypeTabs } from './ResultsRunTypeTabs';

describe('ResultsRunTypeTabs', () => {
  it('renders counts and triggers tab changes', () => {
    const onChange = vi.fn();
    render(
      <ResultsRunTypeTabs
        runTypeFilter="all"
        runCounts={{ all: 5, test: 3, workflow: 2 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'All Runs (5)' }).className).toContain('active');
    fireEvent.click(screen.getByRole('button', { name: /🧪 Test Runs \(3\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /⚡ Workflow Runs \(2\)/i }));

    expect(onChange).toHaveBeenNthCalledWith(1, 'test');
    expect(onChange).toHaveBeenNthCalledWith(2, 'workflow');
  });
});
