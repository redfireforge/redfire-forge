/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContinueLearningCard } from './ContinueLearningCard';

describe('ContinueLearningCard', () => {
  const defaultProps = {
    manualTitle: 'Parameterized Testing Basics',
    pathName: 'Test Suites',
    phaseName: 'Parameterized Testing',
    difficulty: 'easy' as const,
    manualPath: 'tests/parameterized-basics-easy.html',
  };

  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  it('renders the manual title', () => {
    render(<ContinueLearningCard {...defaultProps} />);
    
    expect(screen.getByText('Parameterized Testing Basics')).toBeInTheDocument();
  });

  it('renders the path and phase info', () => {
    render(<ContinueLearningCard {...defaultProps} />);
    
    expect(screen.getByText('Test Suites → Parameterized Testing • easy difficulty')).toBeInTheDocument();
  });

  it('renders the continue label', () => {
    render(<ContinueLearningCard {...defaultProps} />);
    
    expect(screen.getByText('CONTINUE LEARNING')).toBeInTheDocument();
  });

  it('renders the fire icon', () => {
    render(<ContinueLearningCard {...defaultProps} />);
    
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('renders the continue button', () => {
    render(<ContinueLearningCard {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeInTheDocument();
  });

  it('opens manual in new tab when continue button is clicked', () => {
    render(<ContinueLearningCard {...defaultProps} />);
    
    const button = screen.getByRole('button', { name: 'Continue →' });
    fireEvent.click(button);

    expect(window.open).toHaveBeenCalledWith(
      '/docs/training-manuals/tests/parameterized-basics-easy.html',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('shows medium difficulty', () => {
    render(<ContinueLearningCard {...defaultProps} difficulty="medium" />);
    
    expect(screen.getByText('Test Suites → Parameterized Testing • medium difficulty')).toBeInTheDocument();
  });

  it('shows advanced difficulty', () => {
    render(<ContinueLearningCard {...defaultProps} difficulty="advanced" />);
    
    expect(screen.getByText('Test Suites → Parameterized Testing • advanced difficulty')).toBeInTheDocument();
  });
});
