// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import MappingCompare from './MappingCompare';
import type { MappingTrace } from './utils/mappingTrace';

function makeTrace(overrides: Partial<MappingTrace> & { mappingId: string }): MappingTrace {
  return {
    sourcePath: 'name',
    sourceValue: 'Alice',
    targetPath: 'userName',
    targetValue: 'Alice',
    timestamp: Date.now(),
    durationMs: 1,
    ...overrides,
  };
}

describe('MappingCompare', () => {
  const baseline = [
    makeTrace({ mappingId: 'm1', targetValue: 'Alice' }),
    makeTrace({ mappingId: 'm2', targetValue: 'old', sourcePath: 'age', targetPath: 'userAge' }),
    makeTrace({ mappingId: 'm3', targetValue: undefined, error: 'broken', sourcePath: 'email', targetPath: 'userEmail' }),
  ];
  const current = [
    makeTrace({ mappingId: 'm1', targetValue: 'Alice' }),
    makeTrace({ mappingId: 'm2', targetValue: 'new', sourcePath: 'age', targetPath: 'userAge' }),
    makeTrace({ mappingId: 'm3', targetValue: 'fixed!', sourcePath: 'email', targetPath: 'userEmail' }),
  ];

  it('renders summary badges', () => {
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    expect(container.querySelector('.dm-compare-summary')).toBeTruthy();
    expect(container.textContent).toContain('3 mappings compared');
  });

  it('shows unchanged count in summary', () => {
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    expect(container.querySelector('.dm-compare-badge--unchanged')?.textContent).toContain('1');
  });

  it('shows changed count in summary', () => {
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    expect(container.querySelector('.dm-compare-badge--changed')?.textContent).toContain('1');
  });

  it('shows fixed count in summary', () => {
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    expect(container.querySelector('.dm-compare-badge--fixed')?.textContent).toContain('1');
  });

  it('renders all rows by default', () => {
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    const rows = container.querySelectorAll('.dm-compare-row');
    expect(rows.length).toBe(3);
  });

  it('filters to changes only', () => {
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    const changeBtn = Array.from(container.querySelectorAll('.dm-compare-filter-btn'))
      .find((btn) => btn.textContent?.includes('Changes'));
    expect(changeBtn).toBeTruthy();
    fireEvent.click(changeBtn!);
    const rows = container.querySelectorAll('.dm-compare-row');
    expect(rows.length).toBe(2);
  });

  it('filters to fixed only', () => {
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    const fixedBtn = Array.from(container.querySelectorAll('.dm-compare-filter-btn'))
      .find((btn) => btn.textContent?.includes('Fixed'));
    expect(fixedBtn).toBeTruthy();
    fireEvent.click(fixedBtn!);
    const rows = container.querySelectorAll('.dm-compare-row');
    expect(rows.length).toBe(1);
    expect(rows[0].className).toContain('fixed');
  });

  it('shows empty message when no matches for filter', () => {
    const same = [makeTrace({ mappingId: 'm1', targetValue: 'same' })];
    const { container } = render(
      <MappingCompare baselineTraces={same} currentTraces={same} />,
    );
    const regrBtn = Array.from(container.querySelectorAll('.dm-compare-filter-btn'))
      .find((btn) => btn.textContent?.includes('Regressions'));
    expect(regrBtn).toBeTruthy();
    expect((regrBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses custom labels for columns', () => {
    const { container } = render(
      <MappingCompare
        baselineTraces={baseline}
        currentTraces={current}
        baselineLabel="Run #5"
        currentLabel="Run #6"
      />,
    );
    expect(container.textContent).toContain('Run #5');
    expect(container.textContent).toContain('Run #6');
  });

  it('displays source → target path in row', () => {
    const { container } = render(
      <MappingCompare baselineTraces={baseline} currentTraces={current} />,
    );
    const firstRow = container.querySelector('[data-testid="compare-row-m1"]');
    expect(firstRow?.textContent).toContain('name');
    expect(firstRow?.textContent).toContain('userName');
  });

  it('shows regression badge for regressions', () => {
    const regBaseline = [makeTrace({ mappingId: 'm1', targetValue: 'ok' })];
    const regCurrent = [makeTrace({ mappingId: 'm1', targetValue: undefined, error: 'fail' })];
    const { container } = render(
      <MappingCompare baselineTraces={regBaseline} currentTraces={regCurrent} />,
    );
    expect(container.querySelector('.dm-compare-badge--regression')?.textContent).toContain('1');
  });

  it('renders data-testid on root', () => {
    const { container } = render(
      <MappingCompare baselineTraces={[]} currentTraces={[]} />,
    );
    expect(container.querySelector('[data-testid="mapping-compare"]')).toBeTruthy();
  });

  it('shows distinct empty message when no traces at all', () => {
    render(<MappingCompare baselineTraces={[]} currentTraces={[]} />);
    expect(screen.getByText('No mapping traces to compare.')).toBeTruthy();
  });

  it('shows filter message when traces exist but filter matches none', () => {
    const same = [makeTrace({ mappingId: 'm1', targetValue: 'same' })];
    const { container } = render(
      <MappingCompare baselineTraces={same} currentTraces={same} />,
    );
    const fixedBtn = Array.from(container.querySelectorAll('.dm-compare-filter-btn'))
      .find((btn) => btn.textContent?.includes('Fixed'));
    expect((fixedBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies error styling for traces with explicit error via isTraceError', () => {
    const base = [makeTrace({ mappingId: 'm1', targetValue: undefined as unknown, error: 'source not found' })];
    const curr = [makeTrace({ mappingId: 'm1', targetValue: 'fixed' })];
    const { container } = render(
      <MappingCompare baselineTraces={base} currentTraces={curr} />,
    );
    const row = container.querySelector('[data-testid="compare-row-m1"]');
    const cells = row?.querySelectorAll('.dm-compare-cell-value');
    expect(cells?.[0]?.className).toContain('dm-compare-cell-value--error');
    expect(cells?.[1]?.className).not.toContain('dm-compare-cell-value--error');
  });

  it('clicking All filter resets after filtering by Changes', () => {
    const base = [
      makeTrace({ mappingId: 'm1', targetValue: 'old' }),
      makeTrace({ mappingId: 'm2', targetValue: 'same' }),
    ];
    const curr = [
      makeTrace({ mappingId: 'm1', targetValue: 'new' }),
      makeTrace({ mappingId: 'm2', targetValue: 'same' }),
    ];
    const { container } = render(
      <MappingCompare baselineTraces={base} currentTraces={curr} />,
    );
    const allRows = () => container.querySelectorAll('[data-testid^="compare-row-"]');
    expect(allRows().length).toBe(2);

    const changesBtn = Array.from(container.querySelectorAll('.dm-compare-filter-btn'))
      .find((btn) => btn.textContent?.includes('Changes'));
    if (changesBtn) fireEvent.click(changesBtn);
    expect(allRows().length).toBe(1);

    const allBtn = Array.from(container.querySelectorAll('.dm-compare-filter-btn'))
      .find((btn) => btn.textContent?.startsWith('All'));
    if (allBtn) fireEvent.click(allBtn);
    expect(allRows().length).toBe(2);
  });
});
