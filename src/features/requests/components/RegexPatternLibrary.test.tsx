/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import RegexPatternLibrary from './RegexPatternLibrary';

describe('RegexPatternLibrary', () => {
  it('renders without testIds by default', () => {
    render(<RegexPatternLibrary onSelect={vi.fn()} />);
    expect(screen.queryByTestId('pattern-library')).toBeNull();
    expect(screen.getByText('Contains text')).toBeInTheDocument();
  });

  it('renders all patterns, filters by category, and selects an entry', () => {
    const onSelect = vi.fn();
    render(<RegexPatternLibrary onSelect={onSelect} testIds />);

    expect(screen.getByTestId('pattern-library')).toBeInTheDocument();
    expect(screen.getByTestId('pattern-entry-0')).toBeInTheDocument();
    expect(screen.queryByText(/^\/\/$/)).toBeNull();

    const categoryButtons = screen.getAllByRole('button').filter((btn) => btn.textContent !== 'All');
    expect(categoryButtons.length).toBeGreaterThan(0);

    fireEvent.click(categoryButtons[0]!);
    expect(categoryButtons[0]).toHaveClass('btn-active');

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByTestId('pattern-entry-1'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.any(String), category: expect.any(String) }),
    );
  });
});
