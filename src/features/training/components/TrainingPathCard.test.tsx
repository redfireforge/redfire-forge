/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrainingPathCard } from './TrainingPathCard';
import type { TrainingPath } from '../../../data/galleries/trainingPaths/types';

describe('TrainingPathCard', () => {
  const defaultPath: TrainingPath = {
    id: 'test-path',
    name: 'Test Suites',
    icon: '🧪',
    description: 'Build and run test suites.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'Manual 1',
            description: 'First manual',
            difficulty: 'easy',
            manualPath: 'tests/manual1.html',
          },
          {
            title: 'Manual 2',
            description: 'Second manual',
            difficulty: 'medium',
            manualPath: 'tests/manual2.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Advanced',
        manuals: [
          {
            title: 'Manual 3',
            description: 'Third manual',
            difficulty: 'advanced',
            manualPath: 'tests/manual3.html',
          },
        ],
      },
    ],
  };

  const mockGetManualProgress = vi.fn().mockReturnValue(undefined);
  const mockGetBadge = vi.fn().mockReturnValue(null);
  const mockOnNavigateToSample = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders path name, icon, and description', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
      />
    );

    expect(screen.getByText('🧪')).toBeInTheDocument();
    expect(screen.getByText('Test Suites')).toBeInTheDocument();
    expect(screen.getByText('Build and run test suites.')).toBeInTheDocument();
  });

  it('renders progress bar with correct text', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
      />
    );

    expect(screen.getByText('0/3 manuals (0%)')).toBeInTheDocument();
  });

  it('calculates progress correctly when some manuals completed', () => {
    mockGetManualProgress.mockImplementation((path: string) => {
      if (path === 'tests/manual1.html') {
        return { manualPath: path, status: 'completed', completedAt: Date.now() };
      }
      return undefined;
    });

    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
      />
    );

    expect(screen.getByText('1/3 manuals (33%)')).toBeInTheDocument();
  });

  it('shows in-progress count', () => {
    mockGetManualProgress.mockImplementation((path: string) => {
      if (path === 'tests/manual1.html') {
        return { manualPath: path, status: 'in_progress', lastViewedAt: Date.now() };
      }
      if (path === 'tests/manual2.html') {
        return { manualPath: path, status: 'in_progress', lastViewedAt: Date.now() };
      }
      return undefined;
    });

    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
      />
    );

    expect(screen.getByText('2 in progress')).toBeInTheDocument();
  });

  it('is collapsed by default', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={false}
      />
    );

    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
  });

  it('can be expanded by default', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('toggles expand/collapse on header click', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={false}
      />
    );

    const header = screen.getByRole('button', { name: /test suites/i });
    
    // Initially collapsed
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(header);
    expect(screen.getByText('Getting Started')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(header);
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
  });

  it('has keyboard accessibility', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={false}
      />
    );

    const header = screen.getByRole('button', { name: /test suites/i });
    
    // Verify aria-expanded
    expect(header).toHaveAttribute('aria-expanded', 'false');

    // Press Enter to expand
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(header).toHaveAttribute('aria-expanded', 'true');

    // Press Space to collapse
    fireEvent.keyDown(header, { key: ' ' });
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders chevron with expanded class when expanded', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    const chevron = document.querySelector('.training-path-chevron');
    expect(chevron).toHaveClass('expanded');
  });

  it('renders chevron without expanded class when collapsed', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={false}
      />
    );

    const chevron = document.querySelector('.training-path-chevron');
    expect(chevron).not.toHaveClass('expanded');
  });

  it('passes props to child phases', () => {
    render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        onNavigateToSample={mockOnNavigateToSample}
        defaultExpanded={true}
      />
    );

    // Expand a phase to see manuals
    const gettingStartedHeader = screen.getByRole('button', { name: /getting started/i });
    fireEvent.click(gettingStartedHeader); // It's expanded by default, so this collapses it
    fireEvent.click(gettingStartedHeader); // Expand again

    // getManualProgress should have been called for all manuals
    expect(mockGetManualProgress).toHaveBeenCalled();
  });

  it('adds expanded class to card when expanded', () => {
    const { container } = render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    const card = container.querySelector('.training-path-card');
    expect(card).toHaveClass('expanded');
  });

  it('does not add expanded class when collapsed', () => {
    const { container } = render(
      <TrainingPathCard
        path={defaultPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={false}
      />
    );

    const card = container.querySelector('.training-path-card');
    expect(card).not.toHaveClass('expanded');
  });
});
