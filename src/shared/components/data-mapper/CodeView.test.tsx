/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CodeView from './CodeView';
import type { Mapping } from './types';

describe('CodeView', () => {
  it('renders empty state when no mappings', () => {
    const { container } = render(<CodeView mappings={[]} />);
    expect(container.textContent).toContain('No mappings defined');
  });

  it('renders mapping lines', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'userAge' },
    ];

    const { container } = render(<CodeView mappings={mappings} />);
    expect(container.textContent).toContain('userName ← name');
    expect(container.textContent).toContain('userAge ← age');
  });

  it('shows expression mappings with fx notation', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'price', sourceId: 's1', targetPath: 'total', expression: '$parseFloat($.price)' },
    ];

    const { container } = render(<CodeView mappings={mappings} />);
    expect(container.textContent).toContain('total ← $parseFloat($.price)');
  });

  it('sorts mappings by target path', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'z', sourceId: 's1', targetPath: 'z_target' },
      { id: 'm2', sourcePath: 'a', sourceId: 's1', targetPath: 'a_target' },
    ];

    const { container } = render(<CodeView mappings={mappings} />);
    const lines = container.querySelectorAll('.dm-code-view-line-text');
    expect(lines[0].textContent).toContain('a_target');
    expect(lines[1].textContent).toContain('z_target');
  });

  it('shows mapping count', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' },
      { id: 'm2', sourcePath: 'c', sourceId: 's1', targetPath: 'd' },
      { id: 'm3', sourcePath: 'e', sourceId: 's1', targetPath: 'f' },
    ];

    render(<CodeView mappings={mappings} />);
    expect(screen.getByText('3 mappings')).toBeTruthy();
  });

  it('shows singular "mapping" for single mapping', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' },
    ];

    render(<CodeView mappings={mappings} />);
    expect(screen.getByText('1 mapping')).toBeTruthy();
  });

  it('shows placeholder for empty target path', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'src', sourceId: 's1', targetPath: '' },
    ];
    const { container } = render(<CodeView mappings={mappings} />);
    expect(container.textContent).toContain('(unmapped) ← src');
  });

  it('shows placeholder for missing source path when no expression', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: '', sourceId: 's1', targetPath: 'tgt' },
    ];
    const { container } = render(<CodeView mappings={mappings} />);
    expect(container.textContent).toContain('tgt ← (unknown)');
  });

  it('displays line numbers', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' },
      { id: 'm2', sourcePath: 'c', sourceId: 's1', targetPath: 'd' },
    ];

    const { container } = render(<CodeView mappings={mappings} />);
    const lineNos = container.querySelectorAll('.dm-code-view-line-no');
    expect(lineNos[0].textContent).toBe('1');
    expect(lineNos[1].textContent).toBe('2');
  });
});
