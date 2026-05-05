/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WhatsNewBanner } from './WhatsNewBanner';
import type { WhatsNewItem } from '../hooks/useWhatsNew';

// Mock storage
vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn().mockResolvedValue(null),
  writeKey: vi.fn().mockResolvedValue(undefined),
}));

import { readKey, writeKey } from '../../../shared/utils/storage';

describe('WhatsNewBanner', () => {
  const mockItems: WhatsNewItem[] = [
    {
      type: 'new',
      metadata: { manualPath: 'tests/new-manual.html', addedAt: Date.now() },
      manual: { title: 'New Manual', description: 'A new manual', difficulty: 'easy' },
      pathName: 'Test Suites',
      pathIcon: '🧪',
      phaseName: 'Getting Started',
      timestamp: Date.now(),
    },
    {
      type: 'updated',
      metadata: { manualPath: 'tests/updated-manual.html', addedAt: Date.now() - 100000, updatedAt: Date.now() },
      manual: { title: 'Updated Manual', description: 'An updated manual', difficulty: 'medium' },
      pathName: 'Workflow Patterns',
      pathIcon: '⚡',
      phaseName: 'Advanced',
      timestamp: Date.now() - 1000,
    },
  ];

  const defaultProps = {
    items: mockItems,
    displayedItems: mockItems,
    counts: { newCount: 1, updatedCount: 1, total: 2 },
    isExpanded: true,
    showAll: false,
    hasMore: false,
    onToggleExpanded: vi.fn(),
    onToggleShowAll: vi.fn(),
    onItemClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (readKey as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('renders the What\'s New header', () => {
    render(<WhatsNewBanner {...defaultProps} />);

    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('renders all displayed items when expanded', () => {
    render(<WhatsNewBanner {...defaultProps} />);

    expect(screen.getByText('New Manual')).toBeInTheDocument();
    expect(screen.getByText('Updated Manual')).toBeInTheDocument();
  });

  it('hides items when collapsed', () => {
    render(<WhatsNewBanner {...defaultProps} isExpanded={false} />);

    expect(screen.queryByText('New Manual')).not.toBeInTheDocument();
    expect(screen.queryByText('Updated Manual')).not.toBeInTheDocument();
  });

  it('shows NEW badge for new items', () => {
    render(<WhatsNewBanner {...defaultProps} />);

    const newBadges = screen.getAllByText('NEW');
    expect(newBadges.length).toBe(1);
  });

  it('shows UPDATED badge for updated items', () => {
    render(<WhatsNewBanner {...defaultProps} />);

    const updatedBadges = screen.getAllByText('UPDATED');
    expect(updatedBadges.length).toBe(1);
  });

  it('calls onToggleExpanded when toggle button clicked', () => {
    const onToggleExpanded = vi.fn();
    render(<WhatsNewBanner {...defaultProps} onToggleExpanded={onToggleExpanded} />);

    const toggleBtn = screen.getByRole('button', { name: /hide/i });
    fireEvent.click(toggleBtn);

    expect(onToggleExpanded).toHaveBeenCalled();
  });

  it('shows "Show" text when collapsed', () => {
    render(<WhatsNewBanner {...defaultProps} isExpanded={false} />);

    expect(screen.getByRole('button', { name: /show/i })).toBeInTheDocument();
  });

  it('calls onItemClick when item is clicked', () => {
    const onItemClick = vi.fn();
    render(<WhatsNewBanner {...defaultProps} onItemClick={onItemClick} />);

    const firstItem = screen.getByText('New Manual').closest('a');
    fireEvent.click(firstItem!);

    expect(onItemClick).toHaveBeenCalledWith('tests/new-manual.html');
  });

  it('shows "Show all" button when hasMore is true', () => {
    render(<WhatsNewBanner {...defaultProps} hasMore={true} />);

    expect(screen.getByRole('button', { name: /show all 2 items/i })).toBeInTheDocument();
  });

  it('does not show "Show all" button when hasMore is false', () => {
    render(<WhatsNewBanner {...defaultProps} hasMore={false} />);

    expect(screen.queryByRole('button', { name: /show all/i })).not.toBeInTheDocument();
  });

  it('calls onToggleShowAll when "Show all" clicked', () => {
    const onToggleShowAll = vi.fn();
    render(<WhatsNewBanner {...defaultProps} hasMore={true} onToggleShowAll={onToggleShowAll} />);

    const showAllBtn = screen.getByRole('button', { name: /show all/i });
    fireEvent.click(showAllBtn);

    expect(onToggleShowAll).toHaveBeenCalled();
  });

  it('shows "Show less" when showAll is true', () => {
    render(<WhatsNewBanner {...defaultProps} hasMore={true} showAll={true} />);

    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });

  it('renders dismiss button', () => {
    render(<WhatsNewBanner {...defaultProps} />);

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissBtn).toBeInTheDocument();
  });

  it('hides banner when dismissed', async () => {
    const { container } = render(<WhatsNewBanner {...defaultProps} />);

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(container.querySelector('.training-whats-new')).not.toBeInTheDocument();
    });
  });

  it('persists dismiss state to storage', async () => {
    render(<WhatsNewBanner {...defaultProps} />);

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(writeKey).toHaveBeenCalledWith(
        'perf-test-whats-new-dismissed',
        expect.stringContaining('timestamp')
      );
    });
  });

  it('returns null when no items', () => {
    const { container } = render(
      <WhatsNewBanner
        {...defaultProps}
        items={[]}
        displayedItems={[]}
        counts={{ newCount: 0, updatedCount: 0, total: 0 }}
      />
    );

    expect(container.querySelector('.training-whats-new')).not.toBeInTheDocument();
  });

  it('shows banner again when new content arrives after dismiss', async () => {
    const oldTimestamp = Date.now() - 10000;
    (readKey as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ timestamp: oldTimestamp })
    );

    // Items are newer than the dismissed timestamp
    const newerItems: WhatsNewItem[] = [{
      ...mockItems[0],
      timestamp: Date.now(), // Newer than oldTimestamp
    }];

    render(
      <WhatsNewBanner
        {...defaultProps}
        items={newerItems}
        displayedItems={newerItems}
        counts={{ newCount: 1, updatedCount: 0, total: 1 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });
  });

  it('stays dismissed when no newer content', async () => {
    const recentTimestamp = Date.now();
    (readKey as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ timestamp: recentTimestamp })
    );

    // Items are older than the dismissed timestamp
    const olderItems: WhatsNewItem[] = [{
      ...mockItems[0],
      timestamp: recentTimestamp - 10000, // Older than recentTimestamp
    }];

    const { container } = render(
      <WhatsNewBanner
        {...defaultProps}
        items={olderItems}
        displayedItems={olderItems}
        counts={{ newCount: 1, updatedCount: 0, total: 1 }}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('.training-whats-new')).not.toBeInTheDocument();
    });
  });

  it('renders item links with correct href', () => {
    render(<WhatsNewBanner {...defaultProps} />);

    const link = screen.getByRole('link', { name: /new manual/i });
    expect(link).toHaveAttribute('href', '/docs/training-manuals/tests/new-manual.html');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('displays path info in item meta', () => {
    render(<WhatsNewBanner {...defaultProps} />);

    expect(screen.getByText(/Test Suites • easy/)).toBeInTheDocument();
    expect(screen.getByText(/Workflow Patterns • medium/)).toBeInTheDocument();
  });
});
