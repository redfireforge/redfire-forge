/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrainingProgressDashboard } from './TrainingProgressDashboard';

describe('TrainingProgressDashboard', () => {
  const defaultStats = {
    totalCompleted: 10,
    totalInProgress: 5,
    totalManuals: 50,
    pathsStarted: 3,
    totalPaths: 8,
    streak: 4,
  };

  it('renders completed count', () => {
    render(<TrainingProgressDashboard stats={defaultStats} />);
    
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('of 50 manuals (20%)')).toBeInTheDocument();
  });

  it('renders in-progress count with encouraging message', () => {
    render(<TrainingProgressDashboard stats={defaultStats} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('keep going!')).toBeInTheDocument();
  });

  it('renders paths started count', () => {
    render(<TrainingProgressDashboard stats={defaultStats} />);
    
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Paths Started')).toBeInTheDocument();
    expect(screen.getByText('of 8 total paths')).toBeInTheDocument();
  });

  it('renders streak with fire emoji', () => {
    render(<TrainingProgressDashboard stats={defaultStats} />);
    
    expect(screen.getByText('🔥 4')).toBeInTheDocument();
    expect(screen.getByText('Day Streak')).toBeInTheDocument();
    expect(screen.getByText('Keep it up!')).toBeInTheDocument();
  });

  it('shows different message when in-progress is zero', () => {
    render(<TrainingProgressDashboard stats={{ ...defaultStats, totalInProgress: 0 }} />);
    
    expect(screen.getByText('start a manual')).toBeInTheDocument();
  });

  it('shows different message when streak is zero', () => {
    render(<TrainingProgressDashboard stats={{ ...defaultStats, streak: 0 }} />);
    
    expect(screen.getByText('Complete a manual to start')).toBeInTheDocument();
  });

  it('calculates completion percentage correctly', () => {
    render(<TrainingProgressDashboard stats={{ ...defaultStats, totalCompleted: 25, totalManuals: 100 }} />);
    
    expect(screen.getByText('of 100 manuals (25%)')).toBeInTheDocument();
  });

  it('handles zero total manuals gracefully', () => {
    render(<TrainingProgressDashboard stats={{ ...defaultStats, totalCompleted: 0, totalManuals: 0 }} />);
    
    expect(screen.getByText('of 0 manuals (0%)')).toBeInTheDocument();
  });
});
