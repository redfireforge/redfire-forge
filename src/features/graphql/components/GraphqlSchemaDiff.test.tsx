/**
 * GraphqlSchemaDiff.test.tsx
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GraphqlSchemaDiff } from './GraphqlSchemaDiff';
import type { GraphqlSchemaDiffResult, GraphqlSchemaDiffChange } from '../../../shared/types/graphql';

const mockSaveJsonFile = vi.fn().mockResolvedValue(undefined);
const mockSaveFile = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveJsonFile: (...args: unknown[]) => mockSaveJsonFile(...args),
  saveFile: (...args: unknown[]) => mockSaveFile(...args),
}));

function makeChange(overrides: Partial<GraphqlSchemaDiffChange> = {}): GraphqlSchemaDiffChange {
  return {
    criticality: 'BREAKING',
    path: 'Query.users',
    description: 'Field removed from Query',
    acknowledged: false,
    acknowledgeNote: undefined,
    ...overrides,
  };
}

function makeResult(overrides: Partial<GraphqlSchemaDiffResult> = {}): GraphqlSchemaDiffResult {
  return {
    changes: [],
    breakingCount: 0,
    dangerousCount: 0,
    safeCount: 0,
    deprecatedCount: 0,
    ...overrides,
  };
}

const defaultProps = {
  result: makeResult(),
  oldSdl: 'type Query { users: [User] }',
  newSdl: 'type Query { user(id: ID!): User }',
  oldLabel: 'v1.0 snapshot',
  newLabel: 'Current schema',
  onClose: vi.fn(),
};

// Mock scroll + timers
beforeEach(() => {
  vi.clearAllMocks();
  mockSaveJsonFile.mockResolvedValue(undefined);
  mockSaveFile.mockResolvedValue(undefined);
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GraphqlSchemaDiff', () => {
  // ─── Rendering ─────────────────────────────────────────────────────────────

  it('renders modal with correct title and labels', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    expect(screen.getByText('Schema Diff')).toBeInTheDocument();
    expect(screen.getByText('v1.0 snapshot')).toBeInTheDocument();
    expect(screen.getByText('Current schema')).toBeInTheDocument();
  });

  it('renders aria-label with old/new labels', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Schema diff: v1.0 snapshot → Current schema');
  });

  it('shows No changes when result has no changes', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    expect(screen.getByText('No changes')).toBeInTheDocument();
  });

  it('shows empty state when no changes', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    expect(screen.getByTestId('gql-diff-empty')).toBeInTheDocument();
    expect(screen.getByText('Schemas match')).toBeInTheDocument();
  });

  // ─── Summary counts ────────────────────────────────────────────────────────

  it('shows breaking count when > 0', () => {
    const result = makeResult({ breakingCount: 2, changes: [makeChange(), makeChange({ path: 'Mutation.deleteUser' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    expect(screen.getByText('2 Breaking')).toBeInTheDocument();
  });

  it('shows dangerous count', () => {
    const result = makeResult({ dangerousCount: 1, changes: [makeChange({ criticality: 'DANGEROUS' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    expect(screen.getByText('1 Dangerous')).toBeInTheDocument();
  });

  it('shows safe count', () => {
    const result = makeResult({ safeCount: 3, changes: [makeChange({ criticality: 'SAFE' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    expect(screen.getByText('3 Safe')).toBeInTheDocument();
  });

  it('shows deprecated count', () => {
    const result = makeResult({ deprecatedCount: 1, changes: [makeChange({ criticality: 'DEPRECATED' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    expect(screen.getByText('1 Deprecated')).toBeInTheDocument();
  });

  it('does not show breaking count span when breakingCount is 0', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    // The summary span "N Breaking" should not be present (filter tabs still have "Breaking")
    expect(screen.queryByText(/^\d+ Breaking$/)).not.toBeInTheDocument();
  });

  // ─── Change rows ───────────────────────────────────────────────────────────

  it('renders change rows', () => {
    const result = makeResult({
      breakingCount: 1,
      changes: [makeChange({ path: 'Query.users', description: 'Field removed' })],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    expect(screen.getByText('Query.users')).toBeInTheDocument();
    expect(screen.getByText('Field removed')).toBeInTheDocument();
    expect(screen.getAllByTestId('gql-diff-row')).toHaveLength(1);
  });

  it('shows badge with correct criticality label', () => {
    const result = makeResult({ breakingCount: 1, changes: [makeChange()] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    // Badge is in gql-diff-badge element; filter tabs also have "Breaking" text
    const badges = document.querySelectorAll('.gql-diff-badge');
    expect(Array.from(badges).some(b => b.textContent === 'Breaking')).toBe(true);
  });

  it('shows SAFE badge for safe changes', () => {
    const result = makeResult({ safeCount: 1, changes: [makeChange({ criticality: 'SAFE' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    const badges = document.querySelectorAll('.gql-diff-badge');
    expect(Array.from(badges).some(b => b.textContent === 'Safe')).toBe(true);
  });

  it('shows DANGEROUS badge for dangerous changes', () => {
    const result = makeResult({ dangerousCount: 1, changes: [makeChange({ criticality: 'DANGEROUS' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    const badges = document.querySelectorAll('.gql-diff-badge');
    expect(Array.from(badges).some(b => b.textContent === 'Dangerous')).toBe(true);
  });

  it('shows DEPRECATED badge for deprecated changes', () => {
    const result = makeResult({ deprecatedCount: 1, changes: [makeChange({ criticality: 'DEPRECATED' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    const badges = document.querySelectorAll('.gql-diff-badge');
    expect(Array.from(badges).some(b => b.textContent === 'Deprecated')).toBe(true);
  });

  // ─── Acknowledge button ────────────────────────────────────────────────────

  it('shows Acknowledge button for breaking changes when snapshotId is set', () => {
    const result = makeResult({ breakingCount: 1, changes: [makeChange()] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onAcknowledge={vi.fn()} />);
    expect(screen.getByTestId('gql-diff-ack-btn')).toBeInTheDocument();
    expect(screen.getByTestId('gql-diff-ack-btn')).toHaveTextContent('Acknowledge');
  });

  it('does NOT show Acknowledge button when snapshotId is undefined', () => {
    const result = makeResult({ breakingCount: 1, changes: [makeChange()] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    expect(screen.queryByTestId('gql-diff-ack-btn')).not.toBeInTheDocument();
  });

  it('does NOT show Acknowledge button for non-breaking changes', () => {
    const result = makeResult({ safeCount: 1, changes: [makeChange({ criticality: 'SAFE' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" />);
    expect(screen.queryByTestId('gql-diff-ack-btn')).not.toBeInTheDocument();
  });

  it('toggles ack form on Acknowledge button click', () => {
    const result = makeResult({ breakingCount: 1, changes: [makeChange()] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onAcknowledge={vi.fn()} />);
    fireEvent.click(screen.getByTestId('gql-diff-ack-btn'));
    expect(screen.getByTestId('gql-diff-ack-note')).toBeInTheDocument();
    expect(screen.getByTestId('gql-diff-ack-btn')).toHaveTextContent('Cancel');
  });

  it('collapses ack form on second Acknowledge button click (cancel)', () => {
    const result = makeResult({ breakingCount: 1, changes: [makeChange()] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onAcknowledge={vi.fn()} />);
    fireEvent.click(screen.getByTestId('gql-diff-ack-btn'));
    fireEvent.click(screen.getByTestId('gql-diff-ack-btn'));
    expect(screen.queryByTestId('gql-diff-ack-note')).not.toBeInTheDocument();
  });

  it('submits acknowledgement on Confirm button click', () => {
    const onAcknowledge = vi.fn();
    const result = makeResult({ breakingCount: 1, changes: [makeChange({ path: 'Query.users' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onAcknowledge={onAcknowledge} />);
    fireEvent.click(screen.getByTestId('gql-diff-ack-btn'));
    fireEvent.change(screen.getByTestId('gql-diff-ack-note'), { target: { value: 'Intentional' } });
    fireEvent.click(screen.getByTestId('gql-diff-ack-confirm'));
    expect(onAcknowledge).toHaveBeenCalledWith('Query.users', 'Intentional');
  });

  it('submits acknowledgement on Enter key in note input', () => {
    const onAcknowledge = vi.fn();
    const result = makeResult({ breakingCount: 1, changes: [makeChange({ path: 'Query.users' })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onAcknowledge={onAcknowledge} />);
    fireEvent.click(screen.getByTestId('gql-diff-ack-btn'));
    fireEvent.keyDown(screen.getByTestId('gql-diff-ack-note'), { key: 'Enter' });
    expect(onAcknowledge).toHaveBeenCalledWith('Query.users', '');
  });

  // ─── Acknowledged section ──────────────────────────────────────────────────

  it('shows acknowledged section when there are acknowledged changes', () => {
    const result = makeResult({
      breakingCount: 1,
      changes: [makeChange({ acknowledged: true })],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onUnacknowledge={vi.fn()} />);
    expect(screen.getByTestId('gql-diff-acked-section')).toBeInTheDocument();
    expect(screen.getByText(/acknowledged \(1\)/i)).toBeInTheDocument();
  });

  it('expands acknowledged section on click', () => {
    const result = makeResult({
      breakingCount: 1,
      changes: [makeChange({ acknowledged: true, path: 'Query.acked' })],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onUnacknowledge={vi.fn()} />);
    fireEvent.click(screen.getByText(/acknowledged \(1\)/i));
    expect(screen.getByText('Query.acked')).toBeInTheDocument();
  });

  it('shows unacknowledge button for acknowledged changes with snapshotId', () => {
    const onUnacknowledge = vi.fn();
    const result = makeResult({
      breakingCount: 1,
      changes: [makeChange({ acknowledged: true })],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onUnacknowledge={onUnacknowledge} />);
    fireEvent.click(screen.getByText(/acknowledged \(1\)/i));
    expect(screen.getByTestId('gql-diff-unack-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-diff-unack-btn'));
    expect(onUnacknowledge).toHaveBeenCalledWith('Query.users');
  });

  it('shows acknowledge note when change has acknowledgeNote', () => {
    const result = makeResult({
      changes: [makeChange({ acknowledged: true, acknowledgeNote: 'Intentional' })],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} snapshotId="snap-1" onUnacknowledge={vi.fn()} />);
    fireEvent.click(screen.getByText(/acknowledged \(1\)/i));
    expect(screen.getByText(/intentional/i)).toBeInTheDocument();
  });

  it('does NOT show unacknowledge button when snapshotId is undefined', () => {
    const result = makeResult({ changes: [makeChange({ acknowledged: true })] });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    fireEvent.click(screen.getByText(/acknowledged \(1\)/i));
    expect(screen.queryByTestId('gql-diff-unack-btn')).not.toBeInTheDocument();
  });

  // ─── Severity filters ──────────────────────────────────────────────────────

  it('renders filter tabs', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /breaking/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /dangerous/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /safe/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /deprecated/i })).toBeInTheDocument();
  });

  it('filters changes by breaking severity', () => {
    const result = makeResult({
      breakingCount: 1,
      safeCount: 1,
      changes: [
        makeChange({ criticality: 'BREAKING', path: 'Query.users' }),
        makeChange({ criticality: 'SAFE', path: 'Query.newField' }),
      ],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    fireEvent.click(screen.getByRole('tab', { name: /breaking/i }));
    expect(screen.getByText('Query.users')).toBeInTheDocument();
    expect(screen.queryByText('Query.newField')).not.toBeInTheDocument();
  });

  it('shows "no match" message when filter produces empty results', () => {
    const result = makeResult({
      safeCount: 1,
      changes: [makeChange({ criticality: 'SAFE' })],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    fireEvent.click(screen.getByRole('tab', { name: /breaking/i }));
    expect(screen.getByText('No matching changes')).toBeInTheDocument();
  });

  it('filters by dangerous', () => {
    const result = makeResult({
      dangerousCount: 1,
      breakingCount: 1,
      changes: [
        makeChange({ criticality: 'DANGEROUS', path: 'Query.dangerous' }),
        makeChange({ criticality: 'BREAKING', path: 'Query.breaking' }),
      ],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    fireEvent.click(screen.getByRole('tab', { name: /dangerous/i }));
    expect(screen.getByText('Query.dangerous')).toBeInTheDocument();
    expect(screen.queryByText('Query.breaking')).not.toBeInTheDocument();
  });

  it('filters by deprecated', () => {
    const result = makeResult({
      deprecatedCount: 1,
      safeCount: 1,
      changes: [
        makeChange({ criticality: 'DEPRECATED', path: 'Query.deprecated' }),
        makeChange({ criticality: 'SAFE', path: 'Query.safe' }),
      ],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    fireEvent.click(screen.getByRole('tab', { name: /deprecated/i }));
    expect(screen.getByText('Query.deprecated')).toBeInTheDocument();
    expect(screen.queryByText('Query.safe')).not.toBeInTheDocument();
  });

  // ─── Close behavior ────────────────────────────────────────────────────────

  it('calls onClose when Done button clicked', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-diff-done'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when backdrop clicked', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-diff-backdrop'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('does NOT call onClose when clicking inside modal', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-diff-modal'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('cleans up Escape listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<GraphqlSchemaDiff {...defaultProps} />);
    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });

  // ─── Export buttons ────────────────────────────────────────────────────────

  it('calls saveJsonFile for JSON export', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-diff-export-json'));
    expect(mockSaveJsonFile).toHaveBeenCalledWith(
      expect.objectContaining({ oldLabel: 'v1.0 snapshot', newLabel: 'Current schema' }),
      expect.stringMatching(/^schema-diff-\d+\.json$/),
    );
  });

  it('calls saveFile for HTML export', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-diff-export-html'));
    expect(mockSaveFile).toHaveBeenCalled();
  });

  it('calls saveFile for SDL download', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-diff-download-sdl'));
    expect(mockSaveFile).toHaveBeenCalled();
  });

  // ─── SDL diff view ─────────────────────────────────────────────────────────

  it('switches to SDL diff view on SDL Diff button click', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    const sdlBtn = screen.getAllByText('SDL Diff').find(el => el.tagName === 'BUTTON') ||
      screen.getByRole('button', { name: 'SDL Diff' });
    fireEvent.click(sdlBtn!);
    expect(screen.getByTestId('gql-diff-sdl-view')).toBeInTheDocument();
  });

  it('hides filter tabs in SDL diff view', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('switches back to changes view', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    fireEvent.click(screen.getByRole('button', { name: 'Changes' }));
    expect(screen.queryByTestId('gql-diff-sdl-view')).not.toBeInTheDocument();
    expect(screen.getByText('Schemas match')).toBeInTheDocument();
  });

  it('renders SDL diff with line numbers and syntax tokens', () => {
    render(<GraphqlSchemaDiff
      {...defaultProps}
      oldSdl={'type Query {\n  users: [User]\n}'}
      newSdl={'type Query {\n  user(id: ID!): User\n}'}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(document.querySelector('.gql-diff-sdl-ln')).toBeTruthy();
    expect(document.querySelector('.gql-diff-sdl-row--modified, .gql-diff-sdl-row--removed, .gql-diff-sdl-row--added')).toBeTruthy();
  });

  it('shows SDL diff stats and search bar', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(screen.getByPlaceholderText('Search SDL… (Cmd+F)')).toBeInTheDocument();
    expect(screen.getByText(/unchanged/)).toBeInTheDocument();
  });

  it('shows full SDL diff by default; Changes only collapses unchanged rows', () => {
    render(<GraphqlSchemaDiff
      {...defaultProps}
      oldSdl={'type Query {\n  users: [User]\n  posts: [Post]\n}'}
      newSdl={'type Query {\n  user(id: ID!): User\n  posts: [Post]\n}'}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    const fullView = document.querySelectorAll('[data-testid="gql-diff-sdl-row"]').length;
    fireEvent.click(screen.getByTestId('gql-diff-sdl-hide-unchanged'));
    const changesOnly = document.querySelectorAll('[data-testid="gql-diff-sdl-row"]').length;
    expect(fullView).toBeGreaterThan(changesOnly);
  });

  it('pairs modified SDL lines side by side', () => {
    render(<GraphqlSchemaDiff
      {...defaultProps}
      oldSdl={'type Query {\n  users: [User]\n}'}
      newSdl={'type Query {\n  user(id: ID!): User\n}'}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(document.querySelector('.gql-diff-sdl-row--modified')).toBeTruthy();
  });

  it('shows no-edits banner for identical SDLs', () => {
    const sameSdl = 'type Query { hello: String }';
    render(<GraphqlSchemaDiff {...defaultProps} oldSdl={sameSdl} newSdl={sameSdl} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(screen.getByTestId('gql-diff-sdl-no-edits')).toBeInTheDocument();
  });

  it('applies wide modal class in SDL diff view', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(screen.getByTestId('gql-diff-modal')).toHaveClass('gql-diff-modal--wide');
  });

  it('renders draggable header with grip', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    const header = screen.getByTestId('gql-diff-header');
    expect(header).toHaveClass('gql-diff-header--draggable');
    expect(header.querySelector('.gql-diff-drag-grip')).toBeTruthy();
  });

  it('moves modal on header drag', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    const modal = screen.getByTestId('gql-diff-modal');
    const header = screen.getByTestId('gql-diff-header');
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 80, width: 900, height: 600,
      right: 1000, bottom: 680, x: 100, y: 80, toJSON: () => ({}),
    });
    fireEvent.mouseDown(header, { clientX: 120, clientY: 90 });
    fireEvent.mouseMove(window, { clientX: 170, clientY: 130 });
    fireEvent.mouseUp(window);
    expect(modal.style.left).toBeTruthy();
    expect(modal.style.top).toBeTruthy();
  });

  it('renders modal resize handles', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    const modal = screen.getByTestId('gql-diff-modal');
    expect(modal.querySelector('.modal-resize-corner')).toBeTruthy();
    expect(modal.querySelector('.modal-resize-edge-right')).toBeTruthy();
    expect(modal.querySelector('.modal-resize-edge-bottom')).toBeTruthy();
  });

  it('resizes modal from the corner handle', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    const modal = screen.getByTestId('gql-diff-modal');
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 80, width: 900, height: 600,
      right: 1000, bottom: 680, x: 100, y: 80, toJSON: () => ({}),
    });
    const corner = modal.querySelector('.modal-resize-corner')!;
    fireEvent.mouseDown(corner, { clientX: 1000, clientY: 680 });
    fireEvent.mouseMove(window, { clientX: 1060, clientY: 740 });
    fireEvent.mouseUp(window);
    expect(modal.style.width).toBeTruthy();
    expect(modal.style.height).toBeTruthy();
  });

  it('renders connector gutter between SDL panes', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    const connectors = document.querySelectorAll('[data-testid="gql-diff-sdl-connector"]');
    expect(connectors.length).toBeGreaterThan(0);
    expect(document.querySelector('.gql-diff-sdl-connector--modified, .gql-diff-sdl-connector--removed, .gql-diff-sdl-connector--added')).toBeTruthy();
  });

  it('renders added lines in the right pane slot and removed lines in the left pane slot', () => {
    render(
      <GraphqlSchemaDiff
        {...defaultProps}
        oldSdl={'type Old {\n  a: String\n}'}
        newSdl={'type New {\n  b: String\n}'}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));

    const addedRow = document.querySelector('.gql-diff-sdl-row--added');
    const removedRow = document.querySelector('.gql-diff-sdl-row--removed');
    expect(addedRow).toBeTruthy();
    expect(removedRow).toBeTruthy();

    const addedRight = addedRow!.querySelector('.gql-diff-sdl-pane--slot-right');
    const addedLeft = addedRow!.querySelector('.gql-diff-sdl-pane--slot-left');
    expect(addedRight?.textContent).toContain('type New');
    expect(addedLeft?.querySelector('.gql-diff-sdl-placeholder-cell')).toBeTruthy();

    const removedLeft = removedRow!.querySelector('.gql-diff-sdl-pane--slot-left');
    const removedRight = removedRow!.querySelector('.gql-diff-sdl-pane--slot-right');
    expect(removedLeft?.textContent).toContain('type Old');
    expect(removedRight?.querySelector('.gql-diff-sdl-placeholder-cell')).toBeTruthy();

    expect(addedRow!.querySelector('.gql-diff-sdl-connector-shape--added')).toBeTruthy();
    expect(removedRow!.querySelector('.gql-diff-sdl-connector-shape--removed')).toBeTruthy();
  });

  it('keeps Changes only toggle on one line in SDL toolbar', () => {
    render(<GraphqlSchemaDiff {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    const toggle = screen.getByTestId('gql-diff-sdl-hide-unchanged').closest('.gql-diff-sdl-toggle');
    expect(toggle).toHaveClass('gql-diff-sdl-toggle');
    expect(toggle).toHaveTextContent('Changes only');
  });

  it('shows total change count when changes exist', () => {
    const result = makeResult({
      breakingCount: 1,
      changes: [makeChange()],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    expect(screen.getByText('1 total')).toBeInTheDocument();
  });

  // ─── Broken items banner ───────────────────────────────────────────────────

  it('shows broken items banner when brokenItemCount > 0', () => {
    render(<GraphqlSchemaDiff {...defaultProps} brokenItemCount={3} />);
    expect(screen.getByTestId('gql-diff-broken-banner')).toBeInTheDocument();
    expect(screen.getByText(/3 collection operations/i)).toBeInTheDocument();
  });

  it('shows singular "operation" for 1 broken item', () => {
    render(<GraphqlSchemaDiff {...defaultProps} brokenItemCount={1} />);
    expect(screen.getByText(/1 collection operation no longer/i)).toBeInTheDocument();
  });

  it('does not show broken banner when brokenItemCount is 0', () => {
    render(<GraphqlSchemaDiff {...defaultProps} brokenItemCount={0} />);
    expect(screen.queryByTestId('gql-diff-broken-banner')).not.toBeInTheDocument();
  });

  it('hides broken banner in SDL diff view', () => {
    render(<GraphqlSchemaDiff {...defaultProps} brokenItemCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(screen.queryByTestId('gql-diff-broken-banner')).not.toBeInTheDocument();
  });

  // ─── HTML report with acknowledged note ───────────────────────────────────

  it('generates HTML report with acknowledged changes with note', () => {
    const result = makeResult({
      breakingCount: 1,
      changes: [makeChange({ acknowledged: true, acknowledgeNote: 'Done' })],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    fireEvent.click(screen.getByTestId('gql-diff-export-html'));
    expect(mockSaveFile).toHaveBeenCalled();
  });

  // ─── Filter count display ──────────────────────────────────────────────────

  it('shows filter count spans for non-all filters', () => {
    const result = makeResult({
      breakingCount: 2,
      changes: [makeChange(), makeChange({ path: 'Mutation.delete' })],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    // Filter counts are shown inside the filter buttons
    const filterBtns = screen.getAllByRole('tab');
    expect(filterBtns.length).toBe(5); // all, breaking, dangerous, safe, deprecated
  });

  // ─── Multiple changes visible ──────────────────────────────────────────────

  it('renders multiple change rows', () => {
    const result = makeResult({
      breakingCount: 2,
      safeCount: 1,
      changes: [
        makeChange({ path: 'Query.a', description: 'Change A' }),
        makeChange({ path: 'Query.b', description: 'Change B' }),
        makeChange({ criticality: 'SAFE', path: 'Query.c', description: 'Change C' }),
      ],
    });
    render(<GraphqlSchemaDiff {...defaultProps} result={result} />);
    expect(screen.getAllByTestId('gql-diff-row')).toHaveLength(3);
  });

  // ─── SDL diff view with identical SDLs ────────────────────────────────────

  it('renders SDL diff for identical SDLs', () => {
    const sameSdl = 'type Query { hello: String }';
    render(<GraphqlSchemaDiff {...defaultProps} oldSdl={sameSdl} newSdl={sameSdl} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(screen.getByTestId('gql-diff-sdl-view')).toBeInTheDocument();
    expect(screen.getByTestId('gql-diff-sdl-no-edits')).toBeInTheDocument();
  });

  it('renders SDL diff fallback for empty old+new SDLs', () => {
    // Both empty: computeLineDiff('', '') → both have 1 element [''] each
    render(<GraphqlSchemaDiff {...defaultProps} oldSdl="" newSdl="" />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    expect(screen.getByTestId('gql-diff-sdl-view')).toBeInTheDocument();
  });

  it('SDL diff search filters lines and navigates matches with keyboard', () => {
    const oldSdl = 'type Query {\n  users: [User]\n  posts: [Post]\n}';
    const newSdl = 'type Query {\n  user(id: ID!): User\n  posts: [Post]\n}';
    render(<GraphqlSchemaDiff {...defaultProps} oldSdl={oldSdl} newSdl={newSdl} />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));

    const searchInput = screen.getByLabelText('Search SDL diff');
    fireEvent.change(searchInput, { target: { value: 'user' } });
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(document.querySelector('.gql-diff-sdl-row-wrap--search-active')).toBeTruthy();

    fireEvent.keyDown(searchInput, { key: 'Enter' });
    fireEvent.keyDown(searchInput, { key: 'Enter', shiftKey: true });

    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    expect(document.activeElement).toBe(searchInput);

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(searchInput).toHaveValue('');
  });

  it('SDL diff search scrolls active match into view', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<GraphqlSchemaDiff
      {...defaultProps}
      oldSdl={'type Query {\n  alpha: String\n  beta: String\n}'}
      newSdl={'type Query {\n  alpha: String\n  gamma: String\n}'}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'SDL Diff' }));
    fireEvent.change(screen.getByLabelText('Search SDL diff'), { target: { value: 'gamma' } });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });
});
