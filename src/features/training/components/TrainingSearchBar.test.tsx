/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrainingSearchBar } from './TrainingSearchBar';

describe('TrainingSearchBar', () => {
  const defaultProps = {
    searchTerm: '',
    difficulty: 'all' as const,
    status: 'all' as const,
    matchCount: 50,
    totalCount: 100,
    hasActiveFilters: false,
    onSearchChange: vi.fn(),
    onDifficultyChange: vi.fn(),
    onStatusChange: vi.fn(),
    onClearFilters: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input', () => {
    render(<TrainingSearchBar {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search manuals...')).toBeInTheDocument();
  });

  it('renders difficulty filter buttons', () => {
    render(<TrainingSearchBar {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'All Levels' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Easy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
  });

  it('renders status filter buttons', () => {
    render(<TrainingSearchBar {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not Started' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In Progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<TrainingSearchBar {...defaultProps} onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('Search manuals...');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('shows clear button when search term exists', () => {
    render(<TrainingSearchBar {...defaultProps} searchTerm="test" />);

    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('does not show clear button when search term is empty', () => {
    render(<TrainingSearchBar {...defaultProps} searchTerm="" />);

    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('clears search when clear button clicked', () => {
    const onSearchChange = vi.fn();
    render(<TrainingSearchBar {...defaultProps} searchTerm="test" onSearchChange={onSearchChange} />);

    const clearBtn = screen.getByRole('button', { name: 'Clear search' });
    fireEvent.click(clearBtn);

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('calls onDifficultyChange when difficulty button clicked', () => {
    const onDifficultyChange = vi.fn();
    render(<TrainingSearchBar {...defaultProps} onDifficultyChange={onDifficultyChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Medium' }));

    expect(onDifficultyChange).toHaveBeenCalledWith('medium');
  });

  it('calls onStatusChange when status button clicked', () => {
    const onStatusChange = vi.fn();
    render(<TrainingSearchBar {...defaultProps} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

    expect(onStatusChange).toHaveBeenCalledWith('completed');
  });

  it('marks active difficulty button', () => {
    render(<TrainingSearchBar {...defaultProps} difficulty="easy" />);

    const easyBtn = screen.getByRole('button', { name: 'Easy' });
    expect(easyBtn).toHaveClass('active');
    expect(easyBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks active status button', () => {
    render(<TrainingSearchBar {...defaultProps} status="in_progress" />);

    const inProgressBtn = screen.getByRole('button', { name: 'In Progress' });
    expect(inProgressBtn).toHaveClass('active');
    expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows "Clear filters" button when hasActiveFilters is true', () => {
    render(<TrainingSearchBar {...defaultProps} hasActiveFilters={true} />);

    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('does not show "Clear filters" button when hasActiveFilters is false', () => {
    render(<TrainingSearchBar {...defaultProps} hasActiveFilters={false} />);

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('calls onClearFilters when "Clear filters" clicked', () => {
    const onClearFilters = vi.fn();
    render(<TrainingSearchBar {...defaultProps} hasActiveFilters={true} onClearFilters={onClearFilters} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onClearFilters).toHaveBeenCalled();
  });

  it('shows results count when hasActiveFilters is true', () => {
    render(<TrainingSearchBar {...defaultProps} hasActiveFilters={true} matchCount={25} totalCount={100} />);

    expect(screen.getByText('Showing 25 of 100 manuals')).toBeInTheDocument();
  });

  it('does not show results count when hasActiveFilters is false', () => {
    render(<TrainingSearchBar {...defaultProps} hasActiveFilters={false} matchCount={25} totalCount={100} />);

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('has accessible label on search input', () => {
    render(<TrainingSearchBar {...defaultProps} />);

    expect(screen.getByRole('textbox', { name: 'Search training manuals' })).toBeInTheDocument();
  });
});
