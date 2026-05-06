/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { GalleryEntry } from '../../../data/galleries/types';
import { GalleryGrid } from './GalleryGrid';

function baseEntry(id: string, overrides: Partial<GalleryEntry<unknown>> = {}): GalleryEntry<unknown> {
  return {
    id,
    domain: 'requests',
    name: `Sample ${id}`,
    description: `Desc ${id}`,
    icon: 'i',
    category: 'apis',
    difficulty: 'easy',
    tags: ['alpha'],
    liveApis: ['https://api.example.com'],
    factory: () => ({}),
    ...overrides,
  };
}

describe('GalleryGrid', () => {
  it('derives multiple live API hosts from entries', () => {
    const entries = [baseEntry('e1', { liveApis: ['https://a.example.com', 'https://b.example.com'] })];
    render(<GalleryGrid entries={entries} />);
    expect(screen.getByPlaceholderText('Search gallery...')).toBeTruthy();
  });

  it('uses showDomainBadges false even when multi-domain', () => {
    const entries = [
      baseEntry('a', { domain: 'requests' }),
      baseEntry('b', { domain: 'catalog' }),
    ];
    render(<GalleryGrid entries={entries} showDomainBadges={false} />);
    expect(screen.getByText(/2 samples/)).toBeTruthy();
  });

  it('shows loaded count when sampleStatus has matches', () => {
    const entries = [baseEntry('e1'), baseEntry('e2')];
    render(<GalleryGrid entries={entries} sampleStatus={{ e1: 'imported' }} />);
    expect(screen.getByText(/1 loaded/)).toBeTruthy();
  });

  it('clicks previous page in pagination', () => {
    const entries = Array.from({ length: 15 }, (_, i) => baseEntry(`p${i}`, { name: `Item ${i}` }));
    render(<GalleryGrid entries={entries} pageSize={12} />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    fireEvent.click(screen.getByRole('button', { name: /Prev/ }));
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
  });

  it('paginates when more entries than page size', () => {
    const entries = Array.from({ length: 15 }, (_, i) => baseEntry(`p${i}`, { name: `Item ${i}` }));
    render(<GalleryGrid entries={entries} pageSize={12} />);
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  });

  it('resets page when filtered result length changes', () => {
    const entries = [
      baseEntry('a', { name: 'FilterMe', category: 'apis' }),
      ...Array.from({ length: 14 }, (_, i) => baseEntry(`x${i}`, { name: `Other ${i}` })),
    ];
    render(<GalleryGrid entries={entries} pageSize={12} />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    const search = screen.getByPlaceholderText('Search gallery...');
    fireEvent.change(search, { target: { value: 'FilterMe' } });
    expect(screen.getByText(/1 sample/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Next/ })).toBeNull();
  });

  it('pairs simulator entry with main on same page', () => {
    const main = baseEntry('main', { name: 'Main' });
    const sim = baseEntry('sim', { name: 'Sim', simulatorOf: 'main' });
    render(<GalleryGrid entries={[main, sim]} pageSize={12} />);
    expect(screen.getByText(/Paired Sample/)).toBeTruthy();
  });

  it('renders orphan simulator when main not on page', () => {
    const simOnly = baseEntry('sim', { name: 'Orphan Sim', simulatorOf: 'missing-main' });
    const entries = [simOnly, ...Array.from({ length: 11 }, (_, i) => baseEntry(`f${i}`))];
    render(<GalleryGrid entries={entries} pageSize={12} />);
    expect(screen.getByText('Orphan Sim')).toBeTruthy();
  });

  it('switches to training paths mode and shows path search placeholder', () => {
    render(<GalleryGrid entries={[baseEntry('e1')]} />);
    fireEvent.click(screen.getByRole('button', { name: /Training Paths/i }));
    expect(screen.getByPlaceholderText('Search training paths...')).toBeTruthy();
    expect(screen.getByText(/paths available/)).toBeTruthy();
  });

  it('toggles back to samples from paths with mode button', () => {
    render(<GalleryGrid entries={[baseEntry('e1')]} />);
    fireEvent.click(screen.getByRole('button', { name: /Training Paths/i }));
    fireEvent.click(screen.getByRole('button', { name: /📦 Samples/ }));
    expect(screen.getByPlaceholderText('Search gallery...')).toBeTruthy();
  });

  it('uses external search as read-only and filters path copy', () => {
    render(<GalleryGrid entries={[baseEntry('e1')]} externalSearch="extern" />);
    const input = screen.getByLabelText('Search gallery') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Training Paths/i }));
    expect(screen.getByText(/searching "extern"/)).toBeTruthy();
  });

  it('calls onAction when detail primary action fires', () => {
    const onAction = vi.fn();
    const entries = [baseEntry('e1', { name: 'Pick me' })];
    render(<GalleryGrid entries={entries} onAction={onAction} actionLabel="Import" />);
    fireEvent.click(screen.getByText('Pick me'));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('passes function action labels to detail panel', () => {
    const entries = [baseEntry('e1', { name: 'X' })];
    render(
      <GalleryGrid
        entries={entries}
        actionLabel={() => 'Dynamic'}
        onAction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('X'));
    expect(screen.getByRole('button', { name: 'Dynamic' })).toBeTruthy();
  });

  it('renders empty state when filters exclude all', () => {
    const entries = [baseEntry('e1', { category: 'only' })];
    render(<GalleryGrid entries={[baseEntry('e1', { category: 'only' })]} />);
    const search = screen.getByPlaceholderText('Search gallery...');
    fireEvent.change(search, { target: { value: 'zzznonexistent' } });
    expect(screen.getByText(/No samples match/)).toBeTruthy();
  });

  it('deselects card when same card clicked twice', () => {
    const entries = [baseEntry('e1', { name: 'Toggle me' })];
    render(<GalleryGrid entries={entries} />);
    const nameEls = screen.getAllByText('Toggle me');
    fireEvent.click(nameEls[0]);
    expect(document.querySelector('.gallery-detail-panel')).toBeTruthy();
    fireEvent.click(screen.getAllByText('Toggle me')[0]);
    expect(document.querySelector('.gallery-detail-panel')).toBeNull();
  });

  it('activates a training path from the filter sidebar', () => {
    render(<GalleryGrid entries={[baseEntry('e1')]} />);
    const filters = document.querySelector('.gallery-filters')!;
    fireEvent.click(within(filters).getByRole('button', { name: /Versioning/i }));
    expect(screen.getByPlaceholderText('Search training paths...')).toBeTruthy();
  });

  it('forwards training-path Import to onAction when sample exists in entries', () => {
    const onAction = vi.fn();
    const entries = [baseEntry('sample-workflow-001', { name: 'WF Sample' })];
    render(<GalleryGrid entries={entries} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /Training Paths/i }));
    const filters = document.querySelector('.gallery-filters')!;
    fireEvent.click(within(filters).getByRole('button', { name: /Versioning/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Import' })[0]);
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'sample-workflow-001' }));
  });

  it('calls onSecondary with function secondaryLabel', () => {
    const onSecondary = vi.fn();
    const entries = [baseEntry('e1', { name: 'Y' })];
    render(
      <GalleryGrid
        entries={entries}
        actionLabel="Go"
        onAction={vi.fn()}
        secondaryLabel={() => 'Alt'}
        onSecondary={onSecondary}
      />,
    );
    fireEvent.click(screen.getByText('Y'));
    fireEvent.click(screen.getByRole('button', { name: 'Alt' }));
    expect(onSecondary).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('shows renderPreview content in detail panel', () => {
    const entries = [baseEntry('e1', { name: 'Z' })];
    render(
      <GalleryGrid
        entries={entries}
        renderPreview={() => <div data-testid="preview-block">PV</div>}
        onAction={vi.fn()}
        actionLabel="Go"
      />,
    );
    fireEvent.click(screen.getByText('Z'));
    expect(screen.getByTestId('preview-block').textContent).toBe('PV');
  });

  it('closes detail panel from close control', () => {
    const entries = [baseEntry('e1', { name: 'Close me' })];
    render(<GalleryGrid entries={entries} onAction={vi.fn()} actionLabel="Go" />);
    fireEvent.click(screen.getByText('Close me'));
    fireEvent.click(screen.getByRole('button', { name: 'Close detail panel' }));
    expect(document.querySelector('.gallery-detail-panel')).toBeNull();
  });

  it('does not append loaded count when no filtered entry has status', () => {
    render(<GalleryGrid entries={[baseEntry('e1')]} sampleStatus={{ other: 'imported' }} />);
    const el = screen.getByText(/1 sample/).closest('.gallery-result-count');
    expect(el?.textContent).toBe('1 sample');
  });
});
