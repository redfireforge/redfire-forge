/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GalleryCard } from './GalleryCard';
import { GalleryDetailPanel } from './GalleryDetailPanel';
import { GalleryFilters } from './GalleryFilters';
import { defaultFilterState } from './galleryFiltersUtils';
import { GalleryGrid } from './GalleryGrid';
import { TrainingPathsView } from './TrainingPathsView';
import { trainingPaths } from '../../../data/galleries/trainingPaths';
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

/* ── Additional GalleryCard tests ── */

describe('GalleryCard — sampleStatus', () => {
  it('shows imported badge', () => {
    render(<GalleryCard entry={makeEntry()} sampleStatus="imported" />);
    expect(screen.getByText('✓ Loaded')).toBeTruthy();
  });

  it('shows updated badge', () => {
    render(<GalleryCard entry={makeEntry()} sampleStatus="updated" />);
    expect(screen.getByText('↻ Updated')).toBeTruthy();
  });

  it('adds status CSS class', () => {
    const { container } = render(<GalleryCard entry={makeEntry()} sampleStatus="imported" />);
    expect(container.querySelector('.gallery-card-imported')).toBeTruthy();
  });

  it('does not show badge when no status', () => {
    render(<GalleryCard entry={makeEntry()} />);
    expect(screen.queryByText('✓ Loaded')).toBeNull();
    expect(screen.queryByText('↻ Updated')).toBeNull();
  });
});

/* ── Additional GalleryDetailPanel tests ── */

describe('GalleryDetailPanel — expanded coverage', () => {
  it('renders tags', () => {
    render(<GalleryDetailPanel entry={makeEntry({ tags: ['alpha', 'beta'] })} />);
    expect(screen.getByText('#alpha')).toBeTruthy();
    expect(screen.getByText('#beta')).toBeTruthy();
  });

  it('renders live API badges', () => {
    render(<GalleryDetailPanel entry={makeEntry({ liveApis: ['https://api.example.com'] })} />);
    expect(screen.getByText(/api\.example\.com/)).toBeTruthy();
  });

  it('renders difficulty dots', () => {
    const { container } = render(<GalleryDetailPanel entry={makeEntry({ difficulty: 'advanced' })} />);
    expect(container.querySelector('.gallery-difficulty-dots')).toBeTruthy();
  });

  it('opens expand modal on fallback expand button click', () => {
    render(
      <GalleryDetailPanel
        entry={makeEntry({ factory: () => 'plain text output' })}
        renderPreview={() => 'text preview'}
      />,
    );
    // Plain text preview should show expand button
    const expandBtn = screen.getByTitle('View full content in modal');
    fireEvent.click(expandBtn);
    // Should open modal with preview content
    expect(screen.getByText('Test Entry — Preview')).toBeTruthy();
  });

  it('renders rich preview without expand wrapper', () => {
    render(
      <GalleryDetailPanel
        entry={makeEntry()}
        renderPreview={() => <div>Rich Content</div>}
      />,
    );
    expect(screen.getByText('Rich Content')).toBeTruthy();
    // Should not show expand button for rich previews
    expect(screen.queryByTitle('View full content in modal')).toBeNull();
  });

  it('hides close button when onClose is not provided', () => {
    render(<GalleryDetailPanel entry={makeEntry()} />);
    expect(screen.queryByLabelText('Close detail panel')).toBeNull();
  });

  it('hides action button when actionLabel is not provided', () => {
    render(<GalleryDetailPanel entry={makeEntry()} onAction={vi.fn()} />);
    // No button text to find since no label
    const btns = document.querySelectorAll('.gallery-detail-btn-primary');
    expect(btns).toHaveLength(0);
  });

  it('opens expand modal via renderPreview onExpand callback', () => {
    render(
      <GalleryDetailPanel
        entry={makeEntry()}
        renderPreview={(_entry, onExpand) => (
          <button onClick={() => onExpand('Headers', '{"Content-Type":"application/json"}')}>
            Expand Headers
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByText('Expand Headers'));
    expect(screen.getByText('Test Entry — Headers')).toBeTruthy();
    expect(screen.getByText('{"Content-Type":"application/json"}')).toBeTruthy();
  });

  it('closes the expand modal', () => {
    render(
      <GalleryDetailPanel
        entry={makeEntry({ factory: () => 'text output' })}
        renderPreview={() => 'plain text'}
      />,
    );
    fireEvent.click(screen.getByTitle('View full content in modal'));
    expect(screen.getByText('Test Entry — Preview')).toBeTruthy();
    // Close button in modal footer
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Test Entry — Preview')).toBeNull();
  });

  it('handles non-serializable factory output in expand', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    render(
      <GalleryDetailPanel
        entry={makeEntry({ factory: () => circular })}
        renderPreview={() => 'text'}
      />,
    );
    fireEvent.click(screen.getByTitle('View full content in modal'));
    // Should fallback to String() output
    expect(screen.getByText('Test Entry — Preview')).toBeTruthy();
  });
});

/* ── Additional GalleryFilters tests ── */

describe('GalleryFilters — expanded coverage', () => {
  const baseDomains = [
    { key: 'requests' as const, label: 'Requests', icon: '📡', description: '' },
    { key: 'tests' as const, label: 'Tests', icon: '🧪', description: '' },
  ];

  it('calls onChange for difficulty change', () => {
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
    const select = screen.getByLabelText('Filter by difficulty');
    fireEvent.change(select, { target: { value: 'advanced' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 'advanced' }));
  });

  it('calls onChange for category change', () => {
    const onChange = vi.fn();
    render(
      <GalleryFilters
        domains={baseDomains}
        categories={['crud', 'search']}
        liveApis={[]}
        tags={[]}
        value={defaultFilterState()}
        onChange={onChange}
        {...defaultFilterProps}
      />,
    );
    const select = screen.getByLabelText('Filter by category');
    fireEvent.change(select, { target: { value: 'crud' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: 'crud' }));
  });

  it('renders live API filter when liveApis provided', () => {
    render(
      <GalleryFilters
        domains={baseDomains}
        categories={[]}
        liveApis={['jsonplaceholder.typicode.com']}
        tags={[]}
        value={defaultFilterState()}
        onChange={vi.fn()}
        {...defaultFilterProps}
      />,
    );
    expect(screen.getByLabelText('Filter by live API')).toBeTruthy();
  });

  it('hides live API filter when no liveApis', () => {
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
    expect(screen.queryByLabelText('Filter by live API')).toBeNull();
  });

  it('calls onChange for live API change', () => {
    const onChange = vi.fn();
    render(
      <GalleryFilters
        domains={baseDomains}
        categories={[]}
        liveApis={['api.example.com']}
        tags={[]}
        value={defaultFilterState()}
        onChange={onChange}
        {...defaultFilterProps}
      />,
    );
    const select = screen.getByLabelText('Filter by live API');
    fireEvent.change(select, { target: { value: 'api.example.com' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ liveApi: 'api.example.com' }));
  });

  it('highlights active domain button', () => {
    const { container } = render(
      <GalleryFilters
        domains={baseDomains}
        categories={[]}
        liveApis={[]}
        tags={[]}
        value={{ ...defaultFilterState(), domain: 'requests' }}
        onChange={vi.fn()}
        {...defaultFilterProps}
      />,
    );
    const activeBtn = container.querySelector('.gallery-domain-btn.active');
    expect(activeBtn?.textContent).toContain('Requests');
  });

  it('clicking All button sets domain to all', () => {
    const onChange = vi.fn();
    const { container } = render(
      <GalleryFilters
        domains={baseDomains}
        categories={[]}
        liveApis={[]}
        tags={[]}
        value={{ ...defaultFilterState(), domain: 'requests' }}
        onChange={onChange}
        {...defaultFilterProps}
      />,
    );
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const allBtn = domainBtns[0] as HTMLElement; // First button is "All"
    fireEvent.click(allBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ domain: 'all' }));
  });
});

/* ── defaultFilterState ── */

describe('defaultFilterState', () => {
  it('returns expected defaults', () => {
    const state = defaultFilterState();
    expect(state.domain).toBe('all');
    expect(state.category).toBe('');
    expect(state.difficulty).toBe('all');
    expect(state.liveApi).toBe('');
    expect(state.search).toBe('');
  });
});

/* ── TrainingPathsView ── */

const minimalPaths: import('../../../data/galleries/trainingPaths').TrainingPath[] = [
  {
    id: 'tp-a',
    name: 'Test Path A',
    icon: '🅰️',
    description: 'First test path for search filtering',
    phases: [
      {
        id: 1,
        name: 'Phase Alpha',
        manuals: [
          { title: 'Manual Alpha', description: 'Alpha desc', difficulty: 'easy', sampleId: 'sample-alpha', manualPath: 'alpha.html' },
          { title: 'Manual Beta', description: 'Beta desc', difficulty: 'medium', manualPath: 'beta.html' },
        ],
      },
      {
        id: 2,
        name: 'Phase Bravo',
        manuals: [
          { title: 'Manual Gamma', description: 'Gamma desc', difficulty: 'advanced', sampleId: 'sample-gamma', manualPath: 'gamma.html' },
        ],
      },
    ],
  },
  {
    id: 'tp-b',
    name: 'Test Path B',
    icon: '🅱️',
    description: 'Second test path about orchestration',
    phases: [
      {
        id: 1,
        name: 'Phase One',
        manuals: [
          { title: 'Manual Delta', description: 'Delta desc', difficulty: 'easy', sampleId: 'sample-delta', manualPath: 'delta.html' },
        ],
      },
    ],
  },
  {
    id: 'tp-soon',
    name: 'Coming Soon Path',
    icon: '⏳',
    description: 'This path is not yet available',
    comingSoon: true,
    phases: [
      { id: 1, name: 'Future Phase', manuals: [{ title: 'Future Manual', description: 'TBD', difficulty: 'easy' }] },
    ],
  },
];

describe('TrainingPathsView', () => {
  it('renders path cards', () => {
    render(<TrainingPathsView paths={trainingPaths} />);
    expect(screen.getByText('Versioning')).toBeTruthy();
    expect(screen.getByText('Workflow Patterns')).toBeTruthy();
  });

  it('shows all paths without coming soon', () => {
    render(<TrainingPathsView paths={trainingPaths} />);
    // All paths are now fully populated — none should show "Coming soon"
    expect(screen.queryAllByText('Coming soon').length).toBe(0);
  });

  it('highlights active path', () => {
    const { container } = render(<TrainingPathsView paths={trainingPaths} activePathId="versioning" />);
    expect(container.querySelector('.training-path-card-highlighted')).toBeTruthy();
  });

  it('shows phases when versioning path is highlighted', () => {
    render(<TrainingPathsView paths={trainingPaths} activePathId="versioning" />);
    expect(screen.getByText('Workflow Versioning')).toBeTruthy();
    expect(screen.getByText('Test Definition Versioning')).toBeTruthy();
  });

  it('shows manual rows with import buttons', () => {
    render(<TrainingPathsView paths={trainingPaths} activePathId="versioning" />);
    expect(screen.getByText('Workflow Version History')).toBeTruthy();
    const importBtns = screen.getAllByText('Import');
    expect(importBtns.length).toBeGreaterThan(0);
  });

  it('calls onImportSample when import is clicked', () => {
    const onImport = vi.fn();
    render(<TrainingPathsView paths={trainingPaths} activePathId="versioning" onImportSample={onImport} />);
    const importBtns = screen.getAllByText('Import');
    fireEvent.click(importBtns[0]);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  /* ── Search Filtering ── */

  it('filters paths by search query matching path name', () => {
    render(<TrainingPathsView paths={minimalPaths} search="Path A" />);
    expect(screen.getByText('Test Path A')).toBeTruthy();
    // "Path B" still visible because its description also renders; but comingSoon path is filtered out
    expect(screen.queryByText('Coming Soon Path')).toBeNull();
  });

  it('filters paths by search query matching description', () => {
    render(<TrainingPathsView paths={minimalPaths} search="orchestration" />);
    expect(screen.getByText('Test Path B')).toBeTruthy();
    expect(screen.queryByText('Test Path A')).toBeNull();
  });

  it('filters paths by search query matching manual title', () => {
    render(<TrainingPathsView paths={minimalPaths} search="Manual Gamma" />);
    expect(screen.getByText('Test Path A')).toBeTruthy();
    expect(screen.getByText('Manual Gamma')).toBeTruthy();
  });

  it('shows empty message when search has no results', () => {
    render(<TrainingPathsView paths={minimalPaths} search="zzz-no-match-zzz" />);
    expect(screen.getByText(/No training paths match/)).toBeTruthy();
  });

  /* ── Back Button ── */

  it('shows back button when activePathId is set with onClearActivePath', () => {
    const onClear = vi.fn();
    render(<TrainingPathsView paths={minimalPaths} activePathId="tp-a" onClearActivePath={onClear} />);
    const backBtn = screen.getByText('← All Training Paths');
    expect(backBtn).toBeTruthy();
    fireEvent.click(backBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not show back button when no activePathId', () => {
    render(<TrainingPathsView paths={minimalPaths} />);
    expect(screen.queryByText('← All Training Paths')).toBeNull();
  });

  it('hides subtitle when activePathId is set', () => {
    render(<TrainingPathsView paths={minimalPaths} activePathId="tp-a" />);
    expect(screen.queryByText(/Structured learning journeys/)).toBeNull();
  });

  /* ── Coming Soon Path ── */

  it('shows Coming soon badge on comingSoon paths', () => {
    render(<TrainingPathsView paths={minimalPaths} />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('does not expand comingSoon path on click', () => {
    render(<TrainingPathsView paths={minimalPaths} />);
    const card = screen.getByText('Coming Soon Path').closest('.training-path-card');
    expect(card?.classList.contains('training-path-card-soon')).toBe(true);
    fireEvent.click(screen.getByText('Coming Soon Path'));
    expect(screen.queryByText('Future Phase')).toBeNull();
  });

  /* ── Phase Expand/Collapse ── */

  it('expands path on hero click and shows phases', () => {
    render(<TrainingPathsView paths={minimalPaths} />);
    fireEvent.click(screen.getByText('Test Path A'));
    expect(screen.getByText('Phase Alpha')).toBeTruthy();
    expect(screen.getByText('Phase Bravo')).toBeTruthy();
  });

  it('collapses path on second hero click', () => {
    render(<TrainingPathsView paths={minimalPaths} />);
    fireEvent.click(screen.getByText('Test Path A'));
    expect(screen.getByText('Phase Alpha')).toBeTruthy();
    fireEvent.click(screen.getByText('Test Path A'));
    expect(screen.queryByText('Phase Alpha')).toBeNull();
  });

  it('toggles individual phase sections', () => {
    render(<TrainingPathsView paths={minimalPaths} activePathId="tp-a" />);
    // Phases start expanded — manual should be visible
    expect(screen.getByText('Manual Alpha')).toBeTruthy();
    // Click phase header to collapse
    fireEvent.click(screen.getByText('Phase Alpha'));
    expect(screen.queryByText('Manual Alpha')).toBeNull();
    // Click again to re-expand
    fireEvent.click(screen.getByText('Phase Alpha'));
    expect(screen.getByText('Manual Alpha')).toBeTruthy();
  });

  it('Collapse All / Expand All button works', () => {
    render(<TrainingPathsView paths={minimalPaths} activePathId="tp-a" />);
    // Initially all expanded
    expect(screen.getByText('Manual Alpha')).toBeTruthy();
    // Click "Collapse All"
    fireEvent.click(screen.getByText('▼ Collapse All'));
    expect(screen.queryByText('Manual Alpha')).toBeNull();
    // Click "Expand All"
    fireEvent.click(screen.getByText('▶ Expand All'));
    expect(screen.getByText('Manual Alpha')).toBeTruthy();
  });

  /* ── Manual Row Details ── */

  it('renders manual without sampleId (no import button)', () => {
    render(<TrainingPathsView paths={minimalPaths} activePathId="tp-a" />);
    expect(screen.getByText('Manual Beta')).toBeTruthy();
    // Manual Beta has no sampleId, so its row should not have an import button
    const betaRow = screen.getByText('Manual Beta').closest('.training-manual-row');
    expect(betaRow?.querySelector('.training-manual-import-btn')).toBeNull();
  });

  it('renders sample chip with sampleId', () => {
    render(<TrainingPathsView paths={minimalPaths} activePathId="tp-a" />);
    expect(screen.getByText('sample-alpha')).toBeTruthy();
  });

  it('shows imported badge when sampleStatus is imported', () => {
    const { container } = render(
      <TrainingPathsView
        paths={minimalPaths}
        activePathId="tp-a"
        sampleStatus={{ 'sample-alpha': 'imported' }}
      />,
    );
    expect(container.querySelector('.gallery-status-imported')).toBeTruthy();
  });

  it('shows updated badge when sampleStatus is updated', () => {
    const { container } = render(
      <TrainingPathsView
        paths={minimalPaths}
        activePathId="tp-a"
        sampleStatus={{ 'sample-alpha': 'updated' }}
      />,
    );
    expect(container.querySelector('.gallery-status-updated')).toBeTruthy();
  });

  /* ── Stats Display ── */

  it('shows manual and phase counts in path stats', () => {
    render(<TrainingPathsView paths={minimalPaths} />);
    // tp-a has 3 manuals, 2 phases, 2 samples
    expect(screen.getByText((_, el) => el?.textContent === '3 manuals')).toBeTruthy();
    expect(screen.getByText((_, el) => el?.textContent === '2 phases')).toBeTruthy();
    expect(screen.getByText((_, el) => el?.textContent === '2 samples')).toBeTruthy();
  });

  /* ── Filtering only active path ── */

  it('only shows the active path when activePathId is set', () => {
    render(<TrainingPathsView paths={minimalPaths} activePathId="tp-b" />);
    expect(screen.getByText('Test Path B')).toBeTruthy();
    expect(screen.queryByText('Test Path A')).toBeNull();
    expect(screen.queryByText('Coming Soon Path')).toBeNull();
  });
});

/* ── GalleryGrid mode toggle ── */

describe('GalleryGrid — mode toggle', () => {
  const entries: GalleryEntry<string>[] = [
    makeEntry({ id: 'm1', name: 'ModeEntry' }),
  ];

  it('renders mode toggle buttons', () => {
    render(<GalleryGrid entries={entries} />);
    expect(screen.getByText('📦 Samples')).toBeTruthy();
    expect(screen.getByText('📖 Training Paths')).toBeTruthy();
  });

  it('defaults to samples mode', () => {
    render(<GalleryGrid entries={entries} />);
    expect(screen.getByText('ModeEntry')).toBeTruthy();
  });

  it('switches to training paths view', () => {
    const { container } = render(<GalleryGrid entries={entries} />);
    fireEvent.click(screen.getByText('📖 Training Paths'));
    expect(container.querySelector('.training-paths-view')).toBeTruthy();
    expect(screen.queryByText('ModeEntry')).toBeNull();
  });

  it('switches back to samples mode', () => {
    render(<GalleryGrid entries={entries} />);
    fireEvent.click(screen.getByText('📖 Training Paths'));
    expect(screen.queryByText('ModeEntry')).toBeNull();
    fireEvent.click(screen.getByText('📦 Samples'));
    expect(screen.getByText('ModeEntry')).toBeTruthy();
  });
});
