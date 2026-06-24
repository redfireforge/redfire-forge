/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangelogPanel } from './ChangelogPanel';
import type { GraphqlSchemaSnapshot } from '../../../../shared/types/graphql';
import { CHANGELOG_VISIBLE_CAP } from '../../utils/changelogPanelUtils';

const SDL = 'type Query { health: String }';

function makeSnapshot(
  id: string,
  overrides: Partial<GraphqlSchemaSnapshot> = {},
): GraphqlSchemaSnapshot {
  return {
    id,
    label: `Snapshot ${id}`,
    capturedAt: Date.now() - Number(id.replace(/\D/g, '') || '0') * 1000,
    typesCount: 3,
    sdl: SDL,
    connectionId: 'conn-1',
    ...overrides,
  };
}

function makeManySnapshots(count: number): GraphqlSchemaSnapshot[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) =>
    makeSnapshot(`snap-${i}`, {
      label: i === 0 ? 'Latest release' : `Snapshot · ${i}`,
      capturedAt: now - i * 60_000,
    }),
  );
}

describe('ChangelogPanel — empty state', () => {
  it('renders empty placeholder when no snapshots', () => {
    render(<ChangelogPanel snapshots={[]} currentSdl={SDL} />);
    expect(screen.getByTestId('gql-changelog-empty')).toBeTruthy();
    expect(screen.getByText('No snapshots yet')).toBeTruthy();
  });
});

describe('ChangelogPanel — list and selection', () => {
  let confirmMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders panel with snapshot rows and compare bar', () => {
    const snaps = [makeSnapshot('a'), makeSnapshot('b', { capturedAt: Date.now() - 86_400_000 })];
    render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} />);
    expect(screen.getByTestId('gql-changelog-panel')).toBeTruthy();
    expect(screen.getAllByTestId('gql-changelog-row')).toHaveLength(2);
    expect(screen.getByTestId('gql-changelog-compare-bar')).toBeTruthy();
    expect(screen.getByText('Latest')).toBeTruthy();
  });

  it('selects a row on click', () => {
    const snaps = [makeSnapshot('a'), makeSnapshot('b', { capturedAt: Date.now() - 1000 })];
    render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} />);
    const rows = screen.getAllByTestId('gql-changelog-row');
    fireEvent.click(rows[1]);
    expect(rows[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('filters snapshots by search query', () => {
    const snaps = [
      makeSnapshot('a', { label: 'Production baseline' }),
      makeSnapshot('b', { label: 'Staging draft', capturedAt: Date.now() - 1000 }),
    ];
    render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} />);
    fireEvent.change(screen.getByTestId('gql-changelog-search'), { target: { value: 'staging' } });
    expect(screen.getByText('1 match')).toBeTruthy();
    expect(screen.getAllByTestId('gql-changelog-row')).toHaveLength(1);
  });

  it('shows no-results message when search matches nothing', () => {
    render(<ChangelogPanel snapshots={[makeSnapshot('a')]} currentSdl={SDL} />);
    fireEvent.change(screen.getByTestId('gql-changelog-search'), { target: { value: 'zzz-not-found' } });
    expect(screen.getByTestId('gql-changelog-no-results')).toBeTruthy();
  });

  it('shows and expands hidden snapshots via show more / show fewer', () => {
    const snaps = makeManySnapshots(CHANGELOG_VISIBLE_CAP + 3);
    render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} />);
    expect(screen.getAllByTestId('gql-changelog-row')).toHaveLength(CHANGELOG_VISIBLE_CAP);
    fireEvent.click(screen.getByTestId('gql-changelog-show-more'));
    expect(screen.getAllByTestId('gql-changelog-row')).toHaveLength(snaps.length);
    fireEvent.click(screen.getByTestId('gql-changelog-show-less'));
    expect(screen.getAllByTestId('gql-changelog-row')).toHaveLength(CHANGELOG_VISIBLE_CAP);
  });

  it('calls onOpenDiff with selected snapshot and compare target', () => {
    const onOpenDiff = vi.fn();
    const snaps = [makeSnapshot('a'), makeSnapshot('b', { capturedAt: Date.now() - 1000 })];
    render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} onOpenDiff={onOpenDiff} />);
    fireEvent.change(screen.getByTestId('gql-changelog-compare-select'), { target: { value: 'b' } });
    fireEvent.click(screen.getByTestId('gql-changelog-diff-btn'));
    expect(onOpenDiff).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'b');
  });

  it('calls onOpenDiff without compare id for current schema', () => {
    const onOpenDiff = vi.fn();
    render(<ChangelogPanel snapshots={[makeSnapshot('a')]} currentSdl={SDL} onOpenDiff={onOpenDiff} />);
    fireEvent.click(screen.getByTestId('gql-changelog-diff-btn'));
    expect(onOpenDiff).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), undefined);
  });

  it('disables diff button when no current SDL and no compare target', () => {
    render(<ChangelogPanel snapshots={[makeSnapshot('a')]} currentSdl="" />);
    expect((screen.getByTestId('gql-changelog-diff-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onDelete when row delete is confirmed', () => {
    const onDelete = vi.fn();
    const snaps = [makeSnapshot('a'), makeSnapshot('b', { capturedAt: Date.now() - 1000 })];
    render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} onDelete={onDelete} />);
    fireEvent.click(screen.getAllByTestId('gql-changelog-row-delete-btn')[0]);
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('skips onDelete when confirm is cancelled', () => {
    confirmMock.mockReturnValue(false);
    const onDelete = vi.fn();
    render(<ChangelogPanel snapshots={[makeSnapshot('a')]} currentSdl={SDL} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('gql-changelog-delete-btn'));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('clears older snapshots when confirmed', async () => {
    const onClearOlder = vi.fn().mockResolvedValue(2);
    const snaps = makeManySnapshots(4);
    render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} onClearOlder={onClearOlder} />);
    fireEvent.click(screen.getByTestId('gql-changelog-clear-older-btn'));
    await waitFor(() => expect(onClearOlder).toHaveBeenCalledWith(1));
  });

  it('skips clear older when confirm is cancelled', async () => {
    confirmMock.mockReturnValue(false);
    const onClearOlder = vi.fn();
    const snaps = makeManySnapshots(3);
    render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} onClearOlder={onClearOlder} />);
    fireEvent.click(screen.getByTestId('gql-changelog-clear-older-btn'));
    expect(onClearOlder).not.toHaveBeenCalled();
  });

  it('resets selection when selected snapshot is removed', () => {
    const snaps = makeManySnapshots(3);
    const { rerender } = render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} onDelete={vi.fn()} />);
    fireEvent.click(screen.getAllByTestId('gql-changelog-row')[2]);
    rerender(<ChangelogPanel snapshots={snaps.slice(0, 2)} currentSdl={SDL} />);
    expect(screen.getAllByTestId('gql-changelog-row')[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('clears compareToId when compared snapshot is removed', () => {
    const snaps = [makeSnapshot('a'), makeSnapshot('b', { capturedAt: Date.now() - 1000 })];
    const { rerender } = render(<ChangelogPanel snapshots={snaps} currentSdl={SDL} />);
    fireEvent.change(screen.getByTestId('gql-changelog-compare-select'), { target: { value: 'b' } });
    rerender(<ChangelogPanel snapshots={[snaps[0]]} currentSdl={SDL} />);
    expect((screen.getByTestId('gql-changelog-compare-select') as HTMLSelectElement).value).toBe('');
  });
});
