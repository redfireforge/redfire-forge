/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ManualRow } from './ManualRow';
import { TrainingManual, ManualProgress } from '../../../data/galleries/trainingPaths/types';

describe('ManualRow', () => {
  const defaultManual: TrainingManual = {
    title: 'Parameterized Testing Basics',
    description: 'Introduction to data sources and row iteration.',
    difficulty: 'easy',
    manualPath: 'tests/parameterized-basics-easy.html',
    sampleId: 'test-param-basics',
  };

  it('renders manual title and description', () => {
    render(<ManualRow manual={defaultManual} progress={undefined} badge={null} />);

    expect(screen.getByText('Parameterized Testing Basics')).toBeInTheDocument();
    expect(screen.getByText('Introduction to data sources and row iteration.')).toBeInTheDocument();
  });

  it('renders link to manual', () => {
    render(<ManualRow manual={defaultManual} progress={undefined} badge={null} />);

    const link = screen.getByRole('link', { name: 'Parameterized Testing Basics' });
    expect(link).toHaveAttribute('href', '/docs/training-manuals/tests/parameterized-basics-easy.html');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows not_started status when no progress', () => {
    render(<ManualRow manual={defaultManual} progress={undefined} badge={null} />);

    const statusEl = document.querySelector('.training-manual-status-not_started');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent('○');
  });

  it('shows in_progress status with half-filled circle', () => {
    const progress: ManualProgress = {
      manualPath: defaultManual.manualPath!,
      status: 'in_progress',
      lastViewedAt: Date.now(),
    };
    render(<ManualRow manual={defaultManual} progress={progress} badge={null} />);

    const statusEl = document.querySelector('.training-manual-status-in_progress');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent('◐');
  });

  it('shows completed status with checkmark', () => {
    const progress: ManualProgress = {
      manualPath: defaultManual.manualPath!,
      status: 'completed',
      lastViewedAt: Date.now(),
      completedAt: Date.now(),
    };
    render(<ManualRow manual={defaultManual} progress={progress} badge={null} />);

    const statusEl = document.querySelector('.training-manual-status-completed');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent('✓');
  });

  it('shows NEW badge when badge is new', () => {
    render(<ManualRow manual={defaultManual} progress={undefined} badge="new" />);

    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(document.querySelector('.training-badge-new')).toBeInTheDocument();
  });

  it('shows UPDATED badge when badge is updated', () => {
    render(<ManualRow manual={defaultManual} progress={undefined} badge="updated" />);

    expect(screen.getByText('UPDATED')).toBeInTheDocument();
    expect(document.querySelector('.training-badge-updated')).toBeInTheDocument();
  });

  it('renders difficulty dots for easy level', () => {
    render(<ManualRow manual={defaultManual} progress={undefined} badge={null} />);

    const difficultyEl = document.querySelector('.training-difficulty-easy');
    expect(difficultyEl).toBeInTheDocument();
    const dots = difficultyEl?.querySelectorAll('.training-difficulty-dot');
    expect(dots?.length).toBe(1);
  });

  it('renders difficulty dots for medium level', () => {
    const mediumManual = { ...defaultManual, difficulty: 'medium' as const };
    render(<ManualRow manual={mediumManual} progress={undefined} badge={null} />);

    const difficultyEl = document.querySelector('.training-difficulty-medium');
    expect(difficultyEl).toBeInTheDocument();
    const dots = difficultyEl?.querySelectorAll('.training-difficulty-dot');
    expect(dots?.length).toBe(2);
  });

  it('renders difficulty dots for advanced level', () => {
    const advancedManual = { ...defaultManual, difficulty: 'advanced' as const };
    render(<ManualRow manual={advancedManual} progress={undefined} badge={null} />);

    const difficultyEl = document.querySelector('.training-difficulty-advanced');
    expect(difficultyEl).toBeInTheDocument();
    const dots = difficultyEl?.querySelectorAll('.training-difficulty-dot');
    expect(dots?.length).toBe(3);
  });

  it('renders sample button when sampleId and onNavigateToSample provided', () => {
    const onNavigateToSample = vi.fn();
    render(
      <ManualRow
        manual={defaultManual}
        progress={undefined}
        badge={null}
        onNavigateToSample={onNavigateToSample}
      />
    );

    const sampleBtn = screen.getByRole('button', { name: '🧪' });
    expect(sampleBtn).toBeInTheDocument();

    fireEvent.click(sampleBtn);
    expect(onNavigateToSample).toHaveBeenCalled();
  });

  it('does not render sample button when no sampleId', () => {
    const manualWithoutSample = { ...defaultManual, sampleId: undefined };
    const onNavigateToSample = vi.fn();
    render(
      <ManualRow
        manual={manualWithoutSample}
        progress={undefined}
        badge={null}
        onNavigateToSample={onNavigateToSample}
      />
    );

    expect(screen.queryByRole('button', { name: '🧪' })).not.toBeInTheDocument();
  });

  it('does not render sample button when onNavigateToSample not provided', () => {
    render(<ManualRow manual={defaultManual} progress={undefined} badge={null} />);

    expect(screen.queryByRole('button', { name: '🧪' })).not.toBeInTheDocument();
  });

  it('calls onStatusChange with next status when status button clicked', () => {
    const onStatusChange = vi.fn();
    render(
      <ManualRow
        manual={defaultManual}
        progress={undefined}
        badge={null}
        onStatusChange={onStatusChange}
      />
    );

    const statusBtn = screen.getByRole('button', { name: /not started/i });
    fireEvent.click(statusBtn);

    expect(onStatusChange).toHaveBeenCalledWith(defaultManual.manualPath, 'in_progress');
  });

  it('cycles status from in_progress to completed', () => {
    const onStatusChange = vi.fn();
    const progress = {
      manualPath: defaultManual.manualPath!,
      status: 'in_progress' as const,
      lastViewedAt: Date.now(),
    };
    render(
      <ManualRow
        manual={defaultManual}
        progress={progress}
        badge={null}
        onStatusChange={onStatusChange}
      />
    );

    const statusBtn = screen.getByRole('button', { name: /in progress/i });
    fireEvent.click(statusBtn);

    expect(onStatusChange).toHaveBeenCalledWith(defaultManual.manualPath, 'completed');
  });

  it('cycles status from completed to not_started', () => {
    const onStatusChange = vi.fn();
    const progress = {
      manualPath: defaultManual.manualPath!,
      status: 'completed' as const,
      lastViewedAt: Date.now(),
      completedAt: Date.now(),
    };
    render(
      <ManualRow
        manual={defaultManual}
        progress={progress}
        badge={null}
        onStatusChange={onStatusChange}
      />
    );

    const statusBtn = screen.getByRole('button', { name: /completed/i });
    fireEvent.click(statusBtn);

    expect(onStatusChange).toHaveBeenCalledWith(defaultManual.manualPath, 'not_started');
  });

  it('calls onOpenManual when manual link clicked', () => {
    const onOpenManual = vi.fn();
    render(
      <ManualRow
        manual={defaultManual}
        progress={undefined}
        badge={null}
        onOpenManual={onOpenManual}
      />
    );

    const link = screen.getByRole('link', { name: defaultManual.title });
    fireEvent.click(link);

    expect(onOpenManual).toHaveBeenCalledWith(defaultManual.manualPath);
  });

  it('passes sampleId to onNavigateToSample', () => {
    const onNavigateToSample = vi.fn();
    render(
      <ManualRow
        manual={defaultManual}
        progress={undefined}
        badge={null}
        onNavigateToSample={onNavigateToSample}
      />
    );

    const sampleBtn = screen.getByRole('button', { name: '🧪' });
    fireEvent.click(sampleBtn);

    expect(onNavigateToSample).toHaveBeenCalledWith(defaultManual.sampleId);
  });

  it('has accessible label on status button', () => {
    render(<ManualRow manual={defaultManual} progress={undefined} badge={null} />);

    const statusBtn = screen.getByRole('button', { name: /not started/i });
    expect(statusBtn).toHaveAttribute('aria-label', 'Not started. Click to mark as in progress.');
  });
});
