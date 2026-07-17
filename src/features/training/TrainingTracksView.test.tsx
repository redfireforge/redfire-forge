// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock the data module so we control active vs coming-soon paths and the
//    "Continue Learning" manual lookup ──
vi.mock('../../data/galleries/trainingPaths', () => ({
  trainingPaths: [
    {
      id: 'p1',
      name: 'Path One',
      icon: '🧪',
      description: 'First path',
      comingSoon: false,
      phases: [
        {
          id: 1,
          name: 'Phase 1',
          manuals: [
            { title: 'Manual One', difficulty: 'easy', manualPath: 'p1/m1.html' },
          ],
        },
      ],
    },
    {
      id: 'p2',
      name: 'Coming Soon Path',
      icon: '🔒',
      description: 'Not ready',
      comingSoon: true,
      phases: [],
    },
  ],
}));

// ── Mock the hooks so each branch can be driven deterministically ──
vi.mock('./hooks/useTrainingProgress', () => ({ useTrainingProgress: vi.fn() }));
vi.mock('./hooks/useWhatsNew', () => ({ useWhatsNew: vi.fn() }));
vi.mock('./hooks/useManualSearch', () => ({ useManualSearch: vi.fn() }));

// ── Stub child components: just surface props/callbacks ──
vi.mock('./components/TrainingProgressDashboard', () => ({
  TrainingProgressDashboard: (props: { stats: { totalManuals: number } }) => (
    <div data-testid="dashboard">{props.stats.totalManuals}</div>
  ),
}));
vi.mock('./components/ContinueLearningCard', () => ({
  ContinueLearningCard: (props: { manualTitle: string; onContinue: () => void }) => (
    <button data-testid="continue" onClick={props.onContinue}>{props.manualTitle}</button>
  ),
}));
vi.mock('./components/WhatsNewBanner', () => ({
  WhatsNewBanner: (props: { onItemClick: (p: string) => void }) => (
    <button data-testid="whatsnew" onClick={() => props.onItemClick('wn/path.html')}>whatsnew</button>
  ),
}));
vi.mock('./components/TrainingSearchBar', () => ({
  TrainingSearchBar: (props: { matchCount: number; totalCount: number }) => (
    <div data-testid="searchbar">{props.matchCount}/{props.totalCount}</div>
  ),
}));
vi.mock('./components/TrainingPathCard', () => ({
  TrainingPathCard: (props: {
    path: { id: string; name: string };
    onStatusChange: (p: string, s: string) => void;
    onOpenManual: (p: string) => void;
    onNavigateToSample: (s: string) => void;
  }) => (
    <div data-testid={`pathcard-${props.path.id}`}>
      <span>{props.path.name}</span>
      <button data-testid={`status-${props.path.id}`} onClick={() => props.onStatusChange('m/x.html', 'completed')}>status</button>
      <button data-testid={`open-${props.path.id}`} onClick={() => props.onOpenManual('m/x.html')}>open</button>
      <button data-testid={`nav-${props.path.id}`} onClick={() => props.onNavigateToSample('sample-1')}>nav</button>
    </div>
  ),
}));

import TrainingTracksView from './TrainingTracksView';
import { useTrainingProgress } from './hooks/useTrainingProgress';
import { useWhatsNew } from './hooks/useWhatsNew';
import { useManualSearch } from './hooks/useManualSearch';

const mockedTrainingProgress = vi.mocked(useTrainingProgress);
const mockedWhatsNew = vi.mocked(useWhatsNew);
const mockedManualSearch = vi.mocked(useManualSearch);

const updateManualStatus = vi.fn();
const markViewed = vi.fn();
const getManualProgress = vi.fn();
const getBadge = vi.fn();

function setProgress(overrides: Record<string, unknown> = {}) {
  mockedTrainingProgress.mockReturnValue({
    isLoading: false,
    progress: { manuals: {}, lastUpdated: 0, streak: 0 },
    overallStats: { totalCompleted: 0, totalInProgress: 0, totalManuals: 5, pathsStarted: 0, totalPaths: 2 },
    lastViewedInProgress: null,
    getManualProgress,
    updateManualStatus,
    markViewed,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function setWhatsNew(overrides: Record<string, unknown> = {}) {
  mockedWhatsNew.mockReturnValue({
    allItems: [],
    displayedItems: [],
    counts: { new: 0, updated: 0, total: 0 },
    isExpanded: false,
    showAll: false,
    hasMore: false,
    toggleExpanded: vi.fn(),
    toggleShowAll: vi.fn(),
    getBadge,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function setSearch(overrides: Record<string, unknown> = {}) {
  mockedManualSearch.mockReturnValue({
    searchTerm: '',
    difficulty: 'all',
    status: 'all',
    matchCount: 0,
    hasActiveFilters: false,
    filteredPaths: [],
    setSearchTerm: vi.fn(),
    setDifficulty: vi.fn(),
    setStatus: vi.fn(),
    clearFilters: vi.fn(),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe('TrainingTracksView', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.stubGlobal('open', vi.fn());
    setProgress();
    setWhatsNew();
    setSearch();
  });

  it('renders loading state when isLoading is true', () => {
    setProgress({ isLoading: true });
    render(<TrainingTracksView onNavigateToSample={vi.fn()} />);
    expect(screen.getByText('Loading training progress...')).toBeInTheDocument();
  });

  it('renders header, dashboard, whatsnew, searchbar and active path cards (skips comingSoon)', () => {
    render(<TrainingTracksView onNavigateToSample={vi.fn()} />);
    expect(screen.getByText('Training Manual Tracks')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toHaveTextContent('5');
    expect(screen.getByTestId('whatsnew')).toBeInTheDocument();
    expect(screen.getByTestId('searchbar')).toHaveTextContent('0/5');
    expect(screen.getByText('1 paths available • 5 manuals total')).toBeInTheDocument();
    // Active path rendered, coming-soon path skipped
    expect(screen.getByTestId('pathcard-p1')).toBeInTheDocument();
    expect(screen.queryByTestId('pathcard-p2')).not.toBeInTheDocument();
    // No continue card without lastViewedInProgress
    expect(screen.queryByTestId('continue')).not.toBeInTheDocument();
  });

  it('renders ContinueLearningCard when a matching last-viewed manual exists and triggers continue', () => {
    setProgress({ lastViewedInProgress: { manualPath: 'p1/m1.html' } });
    render(<TrainingTracksView onNavigateToSample={vi.fn()} />);
    const cont = screen.getByTestId('continue');
    expect(cont).toHaveTextContent('Manual One');
    fireEvent.click(cont);
    expect(markViewed).toHaveBeenCalledWith('p1/m1.html');
    expect(window.open).toHaveBeenCalledWith('/docs/training-manuals/p1/m1.html', '_blank');
  });

  it('does not render ContinueLearningCard when last-viewed manual is not found', () => {
    setProgress({ lastViewedInProgress: { manualPath: 'unknown/none.html' } });
    render(<TrainingTracksView onNavigateToSample={vi.fn()} />);
    expect(screen.queryByTestId('continue')).not.toBeInTheDocument();
  });

  it('hides ContinueLearningCard and WhatsNewBanner when filters are active', () => {
    setProgress({ lastViewedInProgress: { manualPath: 'p1/m1.html' } });
    setSearch({ hasActiveFilters: true, filteredPaths: [] });
    render(<TrainingTracksView onNavigateToSample={vi.fn()} />);
    expect(screen.queryByTestId('continue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('whatsnew')).not.toBeInTheDocument();
  });

  it('renders filtered path cards when filters active and matches exist', () => {
    setSearch({
      hasActiveFilters: true,
      filteredPaths: [{ path: { id: 'p1', name: 'Path One' }, phases: [], matchCount: 1 }],
    });
    render(<TrainingTracksView onNavigateToSample={vi.fn()} />);
    expect(screen.getByTestId('pathcard-p1')).toBeInTheDocument();
  });

  it('renders no-results message when filters active and there are no matches', () => {
    setSearch({ hasActiveFilters: true, filteredPaths: [] });
    render(<TrainingTracksView onNavigateToSample={vi.fn()} />);
    expect(screen.getByText('No manuals found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
  });

  it('wires path card callbacks: status change, open manual and navigate to sample', () => {
    const onNavigateToSample = vi.fn();
    render(<TrainingTracksView onNavigateToSample={onNavigateToSample} />);
    fireEvent.click(screen.getByTestId('status-p1'));
    expect(updateManualStatus).toHaveBeenCalledWith('m/x.html', 'completed');
    fireEvent.click(screen.getByTestId('open-p1'));
    expect(markViewed).toHaveBeenCalledWith('m/x.html');
    expect(window.open).toHaveBeenCalledWith('/docs/training-manuals/m/x.html', '_blank');
    fireEvent.click(screen.getByTestId('nav-p1'));
    expect(onNavigateToSample).toHaveBeenCalledWith('sample-1');
  });

  it('forwards WhatsNewBanner item clicks to markViewed', () => {
    render(<TrainingTracksView onNavigateToSample={vi.fn()} />);
    fireEvent.click(screen.getByTestId('whatsnew'));
    expect(markViewed).toHaveBeenCalledWith('wn/path.html');
  });
});
