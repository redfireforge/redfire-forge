/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DifficultyDots } from './DifficultyDots';
import { LiveApiBadge } from './LiveApiBadge';
import { DomainBadge } from './DomainBadge';
import { GalleryCard } from './GalleryCard';
import { GalleryDetailPanel } from './GalleryDetailPanel';
import { GalleryFilters, defaultFilterState, apiHostname } from './GalleryFilters';
import { GalleryGrid } from './GalleryGrid';
import type { GalleryEntry } from '../../../data/galleries/types';

/* ── Helpers ── */

const defaultFilterProps = {
  mode: 'samples' as const,
  onModeChange: vi.fn(),
  trainingPaths: [],
};

function makeEntry(overrides: Partial<GalleryEntry<string>> = {}): GalleryEntry<string> {
  return {
    id: 'test-1',
    domain: 'requests',
    name: 'Test Entry',
    description: 'A test gallery entry',
    icon: '🔌',
    category: 'crud',
    difficulty: 'easy',
    tags: ['rest', 'users'],
    liveApis: ['https://jsonplaceholder.typicode.com'],
    factory: () => 'result',
    ...overrides,
  };
}

/* ── DifficultyDots ── */

describe('DifficultyDots', () => {
  it('renders 3 dots', () => {
    const { container } = render(<DifficultyDots level="easy" />);
    expect(container.querySelectorAll('.gallery-dot')).toHaveLength(3);
  });

  it('sets data-level attribute', () => {
    const { container } = render(<DifficultyDots level="advanced" />);
    expect(container.querySelector('.gallery-difficulty-dots')!.getAttribute('data-level')).toBe('advanced');
  });

  it('shows label by default', () => {
    render(<DifficultyDots level="medium" />);
    expect(screen.getByText('medium')).toBeTruthy();
  });

  it('hides label when showLabel=false', () => {
    render(<DifficultyDots level="medium" showLabel={false} />);
    expect(screen.queryByText('medium')).toBeNull();
  });
});

/* ── LiveApiBadge ── */

describe('LiveApiBadge', () => {
  it('renders hostname from full URL', () => {
    render(<LiveApiBadge api="https://jsonplaceholder.typicode.com/users" />);
    expect(screen.getByText(/jsonplaceholder\.typicode\.com/)).toBeTruthy();
  });

  it('renders raw string if not a valid URL', () => {
    render(<LiveApiBadge api="not-a-url" />);
    expect(screen.getByText(/not-a-url/)).toBeTruthy();
  });

  it('sets title to full URL', () => {
    const { container } = render(<LiveApiBadge api="https://fakestoreapi.com/products" />);
    expect(container.querySelector('.gallery-live-api-badge')!.getAttribute('title')).toBe('https://fakestoreapi.com/products');
  });
});

/* ── DomainBadge ── */

describe('DomainBadge', () => {
  it('renders domain label and icon', () => {
    render(<DomainBadge domain="requests" />);
    expect(screen.getByText('Requests')).toBeTruthy();
  });

  it('sets data-domain attribute', () => {
    const { container } = render(<DomainBadge domain="tests" />);
    expect(container.querySelector('.gallery-domain-badge')!.getAttribute('data-domain')).toBe('tests');
  });
});

/* ── GalleryCard ── */

describe('GalleryCard', () => {
  it('renders name and description', () => {
    render(<GalleryCard entry={makeEntry()} />);
    expect(screen.getByText('Test Entry')).toBeTruthy();
    expect(screen.getByText('A test gallery entry')).toBeTruthy();
  });

  it('calls onClick with entry', () => {
    const onClick = vi.fn();
    render(<GalleryCard entry={makeEntry()} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-1' }));
  });

  it('adds selected class', () => {
    const { container } = render(<GalleryCard entry={makeEntry()} selected />);
    expect(container.querySelector('.gallery-card-selected')).toBeTruthy();
  });

  it('shows domain badge when showDomain=true', () => {
    render(<GalleryCard entry={makeEntry()} showDomain />);
    expect(screen.getByText('Requests')).toBeTruthy();
  });

  it('hides domain badge by default', () => {
    render(<GalleryCard entry={makeEntry()} />);
    expect(screen.queryByText('Requests')).toBeNull();
  });

  it('renders tags', () => {
    render(<GalleryCard entry={makeEntry()} />);
    expect(screen.getByText('#rest')).toBeTruthy();
    expect(screen.getByText('#users')).toBeTruthy();
  });

  it('renders difficulty dots', () => {
    const { container } = render(<GalleryCard entry={makeEntry()} />);
    expect(container.querySelectorAll('.gallery-dot')).toHaveLength(3);
  });

  it('renders live API badge', () => {
    render(<GalleryCard entry={makeEntry()} />);
    expect(screen.getByText(/jsonplaceholder/)).toBeTruthy();
  });
});

/* ── GalleryDetailPanel ── */

describe('GalleryDetailPanel', () => {
  it('returns null when entry is null', () => {
    const { container } = render(<GalleryDetailPanel entry={null} />);
    expect(container.querySelector('.gallery-detail-panel')).toBeNull();
  });

  it('renders entry details', () => {
    render(<GalleryDetailPanel entry={makeEntry()} />);
    expect(screen.getByText('Test Entry')).toBeTruthy();
    expect(screen.getByText('A test gallery entry')).toBeTruthy();
  });

  it('calls onAction when import button clicked', () => {
    const onAction = vi.fn();
    render(<GalleryDetailPanel entry={makeEntry()} onAction={onAction} actionLabel="Import" />);
    fireEvent.click(screen.getByText('Import'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders secondary button when provided', () => {
    const onSecondary = vi.fn();
    render(
      <GalleryDetailPanel
        entry={makeEntry()}
        secondaryLabel="Try It"
        onSecondary={onSecondary}
      />,
    );
    fireEvent.click(screen.getByText('Try It'));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<GalleryDetailPanel entry={makeEntry()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close detail panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders custom preview via renderPreview', () => {
    render(
      <GalleryDetailPanel
        entry={makeEntry()}
        renderPreview={() => <div>Custom Preview</div>}
      />,
    );
    expect(screen.getByText('Custom Preview')).toBeTruthy();
  });
});

/* ── GalleryFilters ── */

describe('GalleryFilters', () => {
  const baseDomains = [
    { key: 'requests' as const, label: 'Requests', icon: '📡', description: '' },
    { key: 'tests' as const, label: 'Tests', icon: '🧪', description: '' },
  ];

  it('renders domain buttons', () => {
    render(
      <GalleryFilters
        domains={baseDomains}
        categories={[]}
        liveApis={[]}
        tags={[]}
        value={defaultFilterState()}
        onChange={vi.fn()}
        {...defaultFilterProps}
      />,
    );
    const domainBtns = document.querySelectorAll('.gallery-domain-btn');
    expect(domainBtns.length).toBe(3); // All + 2 domains
    expect(screen.getByText(/Requests/)).toBeTruthy();
    expect(screen.getByText(/Tests/)).toBeTruthy();
  });

  it('calls onChange when domain is selected', () => {
    const onChange = vi.fn();
    render(
      <GalleryFilters
        domains={baseDomains}
        categories={[]}
        liveApis={[]}
        tags={[]}
        value={defaultFilterState()}
        onChange={onChange}
        {...defaultFilterProps}
      />,
    );
    fireEvent.click(screen.getByText(/Requests/));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ domain: 'requests' }));
  });

  it('renders category select with options', () => {
    render(
      <GalleryFilters
        domains={baseDomains}
        categories={['crud', 'search']}
        liveApis={[]}
        tags={[]}
        value={defaultFilterState()}
        onChange={vi.fn()}
        {...defaultFilterProps}
      />,
    );
    expect(screen.getByLabelText('Filter by category')).toBeTruthy();
  });
});

/* ── apiHostname utility ── */

describe('apiHostname', () => {
  it('extracts hostname from URL', () => {
    expect(apiHostname('https://jsonplaceholder.typicode.com/users')).toBe('jsonplaceholder.typicode.com');
  });

  it('returns raw string for invalid URL', () => {
    expect(apiHostname('not-a-url')).toBe('not-a-url');
  });
});

/* ── GalleryGrid ── */

describe('GalleryGrid', () => {
  const entries: GalleryEntry<string>[] = [
    makeEntry({ id: 'e1', name: 'Alpha', difficulty: 'easy', category: 'crud', tags: ['rest'] }),
    makeEntry({ id: 'e2', name: 'Beta', difficulty: 'medium', category: 'search', domain: 'tests', tags: ['query'] }),
    makeEntry({ id: 'e3', name: 'Gamma', difficulty: 'advanced', category: 'crud', tags: ['admin'] }),
  ];

  it('renders all entry cards', () => {
    render(<GalleryGrid entries={entries} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  it('shows result count', () => {
    render(<GalleryGrid entries={entries} />);
    expect(screen.getByText('3 samples')).toBeTruthy();
  });

  it('filters by search text', () => {
    render(<GalleryGrid entries={entries} />);
    const input = screen.getByLabelText('Search gallery');
    fireEvent.change(input, { target: { value: 'beta' } });
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('1 sample')).toBeTruthy();
  });

  it('shows empty message when no results', () => {
    render(<GalleryGrid entries={entries} />);
    const input = screen.getByLabelText('Search gallery');
    fireEvent.change(input, { target: { value: 'zzzzz' } });
    expect(screen.getByText('No samples match the current filters.')).toBeTruthy();
  });

  it('opens detail panel on card click', () => {
    const { container } = render(<GalleryGrid entries={entries} />);
    const firstCard = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(firstCard);
    // detail panel should now be visible
    expect(screen.getByLabelText('Close detail panel')).toBeTruthy();
  });

  it('closes detail panel on close button', () => {
    const { container } = render(<GalleryGrid entries={entries} />);
    const firstCard = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(firstCard);
    fireEvent.click(screen.getByLabelText('Close detail panel'));
    expect(screen.queryByLabelText('Close detail panel')).toBeNull();
  });

  it('toggles detail panel on same card click', () => {
    const { container } = render(<GalleryGrid entries={entries} />);
    const firstCard = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(firstCard);
    expect(screen.getByLabelText('Close detail panel')).toBeTruthy();
    fireEvent.click(firstCard);
    expect(screen.queryByLabelText('Close detail panel')).toBeNull();
  });

  it('does not show pagination when entries fit on one page', () => {
    render(<GalleryGrid entries={entries} />);
    expect(screen.queryByText(/Page/)).toBeNull();
  });

  it('shows pagination when entries exceed page size', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makeEntry({ id: `p${i}`, name: `Item ${i}`, tags: ['t'] }),
    );
    render(<GalleryGrid entries={many} pageSize={6} />);
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect(screen.getByLabelText('Previous page').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Next page').hasAttribute('disabled')).toBe(false);
  });

  it('navigates between pages', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ id: `n${i}`, name: `Entry ${i}`, tags: ['t'] }),
    );
    const { container } = render(<GalleryGrid entries={many} pageSize={3} />);
    expect(container.querySelectorAll('.gallery-card')).toHaveLength(3);
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();

    // Go to page 2
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
    expect(container.querySelectorAll('.gallery-card')).toHaveLength(3);

    // Go to page 3
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('Page 3 of 3')).toBeTruthy();
    expect(container.querySelectorAll('.gallery-card')).toHaveLength(2);
    expect(screen.getByLabelText('Next page').hasAttribute('disabled')).toBe(true);

    // Go back
    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
  });

  it('resets to page 1 when search changes', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ id: `s${i}`, name: `Search${i}`, tags: ['t'] }),
    );
    render(<GalleryGrid entries={many} pageSize={4} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();

    const input = screen.getByLabelText('Search gallery');
    fireEvent.change(input, { target: { value: 'Search0' } });
    // Should reset to page 1 with 1 result
    expect(screen.getByText('1 sample')).toBeTruthy();
  });

  it('filters by category', () => {
    const entries: GalleryEntry<string>[] = [
      makeEntry({ id: 'c1', name: 'Crud Item', category: 'crud' }),
      makeEntry({ id: 'c2', name: 'Search Item', category: 'search' }),
    ];
    const { container } = render(<GalleryGrid entries={entries} />);
    const catSelect = screen.getByLabelText('Filter by category');
    fireEvent.change(catSelect, { target: { value: 'crud' } });
    expect(container.querySelectorAll('.gallery-card')).toHaveLength(1);
    expect(screen.getByText('Crud Item')).toBeTruthy();
  });

  it('filters by difficulty', () => {
    const entries: GalleryEntry<string>[] = [
      makeEntry({ id: 'd1', name: 'Easy', difficulty: 'easy' }),
      makeEntry({ id: 'd2', name: 'Hard', difficulty: 'advanced' }),
    ];
    const { container } = render(<GalleryGrid entries={entries} />);
    const diffSelect = screen.getByLabelText('Filter by difficulty');
    fireEvent.change(diffSelect, { target: { value: 'advanced' } });
    expect(container.querySelectorAll('.gallery-card')).toHaveLength(1);
    expect(screen.getByText('Hard')).toBeTruthy();
  });

  it('filters by live API', () => {
    const entries: GalleryEntry<string>[] = [
      makeEntry({ id: 'a1', name: 'Placeholder', liveApis: ['https://jsonplaceholder.typicode.com'] }),
      makeEntry({ id: 'a2', name: 'Poke', liveApis: ['https://pokeapi.co'] }),
    ];
    const { container } = render(<GalleryGrid entries={entries} />);
    const apiSelect = screen.getByLabelText('Filter by live API');
    fireEvent.change(apiSelect, { target: { value: 'pokeapi.co' } });
    expect(container.querySelectorAll('.gallery-card')).toHaveLength(1);
    expect(screen.getByText('Poke')).toBeTruthy();
  });
});
