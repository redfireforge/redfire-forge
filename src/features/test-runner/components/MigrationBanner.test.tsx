/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MigrationBanner from './MigrationBanner';

describe('MigrationBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing when no migration occurred', () => {
    const { container } = render(<MigrationBanner onNavigateToParamRunner={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when already dismissed', () => {
    localStorage.setItem('migration-v4-split-count', '2');
    localStorage.setItem('migration-v4-notified', '1');
    const { container } = render(<MigrationBanner onNavigateToParamRunner={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows banner when migration split occurred', () => {
    localStorage.setItem('migration-v4-split-count', '3');
    render(<MigrationBanner onNavigateToParamRunner={vi.fn()} />);
    expect(screen.getByText(/3 mixed scenarios were split/)).toBeInTheDocument();
  });

  it('uses singular form for 1 split', () => {
    localStorage.setItem('migration-v4-split-count', '1');
    render(<MigrationBanner onNavigateToParamRunner={vi.fn()} />);
    expect(screen.getByText(/1 mixed scenario was split/)).toBeInTheDocument();
  });

  it('dismisses on button click and sets flag', () => {
    localStorage.setItem('migration-v4-split-count', '2');
    render(<MigrationBanner onNavigateToParamRunner={vi.fn()} />);

    expect(screen.getByText(/2 mixed scenarios were split/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Dismiss'));

    expect(screen.queryByText(/mixed scenario/)).not.toBeInTheDocument();
    expect(localStorage.getItem('migration-v4-notified')).toBe('1');
  });

  it('calls onNavigateToParamRunner when link is clicked', () => {
    localStorage.setItem('migration-v4-split-count', '1');
    const nav = vi.fn();
    render(<MigrationBanner onNavigateToParamRunner={nav} />);

    fireEvent.click(screen.getByText('Parameterized Runner'));
    expect(nav).toHaveBeenCalled();
  });

  it('renders nothing for split count of 0', () => {
    localStorage.setItem('migration-v4-split-count', '0');
    const { container } = render(<MigrationBanner onNavigateToParamRunner={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
