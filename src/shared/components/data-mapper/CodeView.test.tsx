/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CodeView from './CodeView';
import type { MapperSource, Mapping } from './types';
import type { MappingTrace } from './utils/mappingTrace';

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

  it('switches to table mode and shows before/after preview status', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' },
      { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'user.age' },
    ];
    const sources: MapperSource[] = [
      {
        id: 's1',
        label: 'Source',
        sampleData: { name: 'Alice', age: 31 },
      },
    ];
    const targetSampleData = {
      user: { name: 'Bob', age: 31 },
    };

    render(
      <CodeView
        mappings={mappings}
        sources={sources}
        activeSourceId="s1"
        targetSampleData={targetSampleData}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));

    expect(screen.getByText('Target')).toBeTruthy();
    expect(screen.getByText('Source / Expression')).toBeTruthy();
    expect(screen.getByText('changed')).toBeTruthy();
    expect(screen.getByText('unchanged')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('supports table search with focus mode', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'profile.first', sourceId: 's1', targetPath: 'user.firstName' },
      { id: 'm2', sourcePath: 'profile.last', sourceId: 's1', targetPath: 'user.lastName' },
    ];
    const sources: MapperSource[] = [
      {
        id: 's1',
        label: 'Source',
        sampleData: { profile: { first: 'Jane', last: 'Doe' } },
      },
    ];

    render(<CodeView mappings={mappings} sources={sources} activeSourceId="s1" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.change(screen.getByLabelText('Search mapping rows'), { target: { value: 'lastName' } });

    // Search highlights matches while still showing all rows.
    expect(screen.getByText('1 match')).toBeTruthy();
    expect(screen.getByText('user.firstName')).toBeTruthy();
    expect(screen.getByText('user.lastName')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Focus matches'));
    expect(screen.queryByText('user.firstName')).toBeNull();
    expect(screen.getByText('user.lastName')).toBeTruthy();
  });

  it('renders expression rows in table mode', () => {
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourcePath: 'a',
        sourceId: 's1',
        targetPath: 'result',
        expression: '$parseFloat($.price)',
      },
    ];
    const sources: MapperSource[] = [
      {
        id: 's1',
        label: 'Source',
        sampleData: { price: '13.5' },
      },
    ];

    render(<CodeView mappings={mappings} sources={sources} activeSourceId="s1" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));

    expect(screen.getByText('fx $parseFloat($.price)')).toBeTruthy();
    expect(screen.getByText('13.5')).toBeTruthy();
  });

  it('shows row-level preview trace inspector with step timeline', () => {
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourcePath: 'name',
        sourceId: 's1',
        targetPath: 'user.name',
        expression: '$upper($.name)',
      },
    ];
    const sources: MapperSource[] = [
      {
        id: 's1',
        label: 'Source',
        sampleData: { name: 'Alice' },
      },
    ];

    render(<CodeView mappings={mappings} sources={sources} activeSourceId="s1" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for user.name' }));

    expect(screen.getByLabelText('Row trace inspector')).toBeTruthy();
    expect(screen.getByText('Preview trace')).toBeTruthy();
    expect(screen.getByText('Source Input')).toBeTruthy();
    expect(screen.getByText('Final Result')).toBeTruthy();
    expect(screen.getByText('Target Output')).toBeTruthy();
  });

  it('uses runtime traces in inspector when debug mode is enabled', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' },
    ];
    const sources: MapperSource[] = [
      {
        id: 's1',
        label: 'Source',
        sampleData: { name: 'Alice' },
      },
    ];
    const traceByMappingId = new Map<string, MappingTrace>([
      ['m1', {
        mappingId: 'm1',
        sourcePath: 'name',
        sourceId: 's1',
        sourceValue: 'Alice',
        targetPath: 'user.name',
        targetValue: 'Alice Runtime',
        evaluatedValue: 'Alice Runtime',
        timestamp: Date.now(),
        durationMs: 2.45,
      }],
    ]);

    render(
      <CodeView
        mappings={mappings}
        sources={sources}
        activeSourceId="s1"
        debugMode
        traceByMappingId={traceByMappingId}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for user.name' }));

    expect(screen.getByText('Runtime trace')).toBeTruthy();
    expect(screen.getByText(/Duration: 2\.450 ms/)).toBeTruthy();
    expect(screen.getAllByText('Alice Runtime').length).toBeGreaterThan(0);
  });

  it('shows runtime trace errors in inspector', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name', expression: '$upper($.name)' },
    ];
    const sources: MapperSource[] = [
      {
        id: 's1',
        label: 'Source',
        sampleData: { name: 'Alice' },
      },
    ];
    const traceByMappingId = new Map<string, MappingTrace>([
      ['m1', {
        mappingId: 'm1',
        sourcePath: 'name',
        sourceId: 's1',
        sourceValue: 'Alice',
        targetPath: 'user.name',
        targetValue: undefined,
        evaluatedValue: undefined,
        expression: '$upper($.name)',
        error: 'Runtime transform failed',
        timestamp: Date.now(),
        durationMs: 1.12,
      }],
    ]);

    render(
      <CodeView
        mappings={mappings}
        sources={sources}
        activeSourceId="s1"
        debugMode
        traceByMappingId={traceByMappingId}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for user.name' }));

    expect(screen.getByText('Runtime trace')).toBeTruthy();
    expect(screen.getAllByText('Error: Runtime transform failed').length).toBeGreaterThan(0);
  });

  describe('pivot table layout', () => {
    const arrayMappings: Mapping[] = [
      { id: 'm1', sourcePath: 'offers[0].code', sourceId: 's1', targetPath: 'offers[0].code' },
      { id: 'm2', sourcePath: 'offers[0].name', sourceId: 's1', targetPath: 'offers[0].name' },
      { id: 'm3', sourcePath: 'offers[1].code', sourceId: 's1', targetPath: 'offers[1].code' },
      { id: 'm4', sourcePath: 'offers[1].name', sourceId: 's1', targetPath: 'offers[1].name' },
      { id: 'm5', sourcePath: 'offers[2].code', sourceId: 's1', targetPath: 'offers[2].code' },
      { id: 'm6', sourcePath: 'offers[2].name', sourceId: 's1', targetPath: 'offers[2].name' },
    ];
    const arraySources: MapperSource[] = [
      {
        id: 's1',
        label: 'Source',
        sampleData: {
          offers: [
            { code: 'A1', name: 'Offer A' },
            { code: 'B2', name: 'Offer B' },
            { code: 'C3', name: 'Offer C' },
          ],
        },
      },
    ];

    it('shows List/Table toggle for array mappings', () => {
      render(<CodeView mappings={arrayMappings} sources={arraySources} activeSourceId="s1" />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));

      expect(screen.getByRole('tab', { name: 'List' })).toBeTruthy();
      const tableTabs = screen.getAllByRole('tab', { name: 'Table' });
      expect(tableTabs.length).toBe(2);
    });

    it('defaults to list layout', () => {
      render(<CodeView mappings={arrayMappings} sources={arraySources} activeSourceId="s1" />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));

      const listBtn = screen.getByRole('tab', { name: 'List' });
      expect(listBtn.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Target')).toBeTruthy();
      expect(screen.getByText('Source / Expression')).toBeTruthy();
    });

    it('switches to pivot table and shows columns and row indices', () => {
      render(<CodeView mappings={arrayMappings} sources={arraySources} activeSourceId="s1" />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));

      const tableTabs = screen.getAllByRole('tab', { name: 'Table' });
      fireEvent.click(tableTabs[1]);

      expect(screen.getByText('code')).toBeTruthy();
      expect(screen.getByText('name')).toBeTruthy();
      expect(screen.getByText('#0')).toBeTruthy();
      expect(screen.getByText('#1')).toBeTruthy();
      expect(screen.getByText('#2')).toBeTruthy();
    });

    it('renders pivot cell values from source data', () => {
      render(<CodeView mappings={arrayMappings} sources={arraySources} activeSourceId="s1" />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));

      const tableTabs = screen.getAllByRole('tab', { name: 'Table' });
      fireEvent.click(tableTabs[1]);

      expect(screen.getByText('A1')).toBeTruthy();
      expect(screen.getByText('Offer A')).toBeTruthy();
      expect(screen.getByText('B2')).toBeTruthy();
      expect(screen.getByText('Offer B')).toBeTruthy();
    });

    it('does not show List/Table toggle for non-array mappings', () => {
      const flatMappings: Mapping[] = [
        { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' },
        { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'user.age' },
      ];
      render(<CodeView mappings={flatMappings} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));

      expect(screen.queryByRole('tab', { name: 'List' })).toBeNull();
    });
  });

  it('switching to Code tab from Table clears selected trace row', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    render(<CodeView mappings={mappings} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Code');
  });

  it('clicking List button when already on list is a no-op', () => {
    const arrMappings: Mapping[] = [
      { id: 'm1', sourcePath: 'items[0].a', sourceId: 's1', targetPath: 'items[0].a' },
      { id: 'm2', sourcePath: 'items[1].a', sourceId: 's1', targetPath: 'items[1].a' },
    ];
    render(<CodeView mappings={arrMappings} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    const listBtn = screen.queryByRole('tab', { name: 'List' });
    if (listBtn) {
      fireEvent.click(listBtn);
      expect(listBtn.className).toContain('is-active');
    }
  });
});
