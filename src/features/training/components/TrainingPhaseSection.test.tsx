/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrainingPhaseSection } from './TrainingPhaseSection';
import type { TrainingPhase } from '../../../data/galleries/trainingPaths/types';

describe('TrainingPhaseSection', () => {
  const defaultPhase: TrainingPhase = {
    id: 1,
    name: 'Getting Started',
    manuals: [
      {
        title: 'Manual 1',
        description: 'First manual',
        difficulty: 'easy',
        manualPath: 'tests/manual1.html',
        sampleId: 'sample-1',
      },
      {
        title: 'Manual 2',
        description: 'Second manual',
        difficulty: 'medium',
        manualPath: 'tests/manual2.html',
      },
    ],
  };

  const mockGetManualProgress = vi.fn().mockReturnValue(undefined);
  const mockGetBadge = vi.fn().mockReturnValue(null);
  const mockOnNavigateToSample = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders phase header with name and count', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
      />
    );

    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('2 manuals')).toBeInTheDocument();
  });

  it('is expanded by default', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    expect(screen.getByText('Manual 1')).toBeInTheDocument();
    expect(screen.getByText('Manual 2')).toBeInTheDocument();
  });

  it('can be collapsed by default', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={false}
      />
    );

    expect(screen.queryByText('Manual 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual 2')).not.toBeInTheDocument();
  });

  it('toggles expand/collapse on header click', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    const header = screen.getByRole('button', { name: /getting started/i });
    
    // Initially expanded
    expect(screen.getByText('Manual 1')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(header);
    expect(screen.queryByText('Manual 1')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(header);
    expect(screen.getByText('Manual 1')).toBeInTheDocument();
  });

  it('has keyboard accessibility', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    const header = screen.getByRole('button', { name: /getting started/i });
    
    // Verify aria-expanded
    expect(header).toHaveAttribute('aria-expanded', 'true');

    // Press Enter to collapse
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    // Press Space to expand
    fireEvent.keyDown(header, { key: ' ' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders chevron with expanded class when expanded', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    const chevron = document.querySelector('.training-phase-chevron');
    expect(chevron).toHaveClass('expanded');
  });

  it('renders chevron without expanded class when collapsed', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={false}
      />
    );

    const chevron = document.querySelector('.training-phase-chevron');
    expect(chevron).not.toHaveClass('expanded');
  });

  it('passes getManualProgress to ManualRow', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    expect(mockGetManualProgress).toHaveBeenCalledWith('tests/manual1.html');
    expect(mockGetManualProgress).toHaveBeenCalledWith('tests/manual2.html');
  });

  it('passes getBadge to ManualRow', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    expect(mockGetBadge).toHaveBeenCalledWith('tests/manual1.html');
    expect(mockGetBadge).toHaveBeenCalledWith('tests/manual2.html');
  });

  it('passes onNavigateToSample only for manuals with sampleId', () => {
    render(
      <TrainingPhaseSection
        phase={defaultPhase}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        onNavigateToSample={mockOnNavigateToSample}
        defaultExpanded={true}
      />
    );

    // Manual 1 has sampleId, so should have sample button
    const sampleBtns = screen.getAllByRole('button', { name: '🧪' });
    expect(sampleBtns).toHaveLength(1);
  });

  it('filters out manuals without manualPath', () => {
    const phaseWithMissingPath: TrainingPhase = {
      id: 1,
      name: 'Test Phase',
      manuals: [
        {
          title: 'With Path',
          description: 'Has path',
          difficulty: 'easy',
          manualPath: 'tests/with-path.html',
        },
        {
          title: 'Without Path',
          description: 'No path',
          difficulty: 'easy',
        },
      ],
    };

    render(
      <TrainingPhaseSection
        phase={phaseWithMissingPath}
        getManualProgress={mockGetManualProgress}
        getBadge={mockGetBadge}
        defaultExpanded={true}
      />
    );

    expect(screen.getByText('1 manuals')).toBeInTheDocument();
    expect(screen.getByText('With Path')).toBeInTheDocument();
    expect(screen.queryByText('Without Path')).not.toBeInTheDocument();
  });
});
