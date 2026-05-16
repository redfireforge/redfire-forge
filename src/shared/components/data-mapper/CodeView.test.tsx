/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CodeView from './CodeView';
import type { Assertion } from '../../types';
import type { MapperSource, Mapping } from './types';
import type { MappingTrace } from './utils/mappingTrace';
import * as mapperExpr from './utils/mapperExpressionEvaluator';

describe('CodeView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls trace panel into view when scrollIntoView exists', () => {
    const proto = HTMLElement.prototype as HTMLElement & { scrollIntoView?: typeof HTMLElement.prototype.scrollIntoView };
    const prev = proto.scrollIntoView;
    const scrollIntoView = vi.fn();
    proto.scrollIntoView = scrollIntoView as typeof HTMLElement.prototype.scrollIntoView;
    try {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' },
      ];
      render(
        <CodeView
          mappings={mappings}
          sources={[{ id: 's1', label: 'S', sampleData: { name: 'Pat' } }]}
          activeSourceId="s1"
        />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for user.name' }));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    } finally {
      proto.scrollIntoView = prev;
    }
  });

  it('renders assertion label fallback for unknown assertion types in table list layout', () => {
    const bizarre = { type: 'totallyUnknownAssertion', jsonPath: '$.z', operator: '=' as const, value: 1 } as unknown as Assertion;
    const mappings: Mapping[] = [{ id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' }];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { a: 1 } }]}
        activeSourceId="s1"
        assertions={[bizarre]}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByText('TOTALLYUNKNOWNASSERTION')).toBeTruthy();
  });

  it('renders assertion summary rows in pivot layout when assertions exist', () => {
    const assertions: Assertion[] = [{ type: 'arrayLength', jsonPath: 'offers', operator: '>=', value: 1 }];
    const arrayMappings: Mapping[] = [
      { id: 'm1', sourcePath: 'offers[0].code', sourceId: 's1', targetPath: 'offers[0].code' },
      { id: 'm2', sourcePath: 'offers[1].code', sourceId: 's1', targetPath: 'offers[1].code' },
    ];
    const arraySources: MapperSource[] = [
      {
        id: 's1',
        label: 'Source',
        sampleData: {
          offers: [{ code: 'A1' }, { code: 'B2' }],
        },
      },
    ];
    render(
      <CodeView mappings={arrayMappings} sources={arraySources} activeSourceId="s1" assertions={assertions} />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    const tableTabs = screen.getAllByRole('tab', { name: 'Table' });
    fireEvent.click(tableTabs[1]);
    expect(document.querySelector('.dm-code-assertion-summary')).toBeTruthy();
    expect(screen.getByText('LENGTH')).toBeTruthy();
  });

  it('renders unknown assertion type labels in pivot assertion summary table', () => {
    const bizarre = { type: 'customUnknown', jsonPath: '$.items', value: 'x' } as unknown as Assertion;
    const arrayMappings: Mapping[] = [
      { id: 'm1', sourcePath: 'items[0].n', sourceId: 's1', targetPath: 'items[0].n' },
      { id: 'm2', sourcePath: 'items[1].n', sourceId: 's1', targetPath: 'items[1].n' },
    ];
    render(
      <CodeView
        mappings={arrayMappings}
        sources={[{ id: 's1', label: 'S', sampleData: { items: [{ n: 1 }, { n: 2 }] } }]}
        activeSourceId="s1"
        assertions={[bizarre]}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    const tableTabs = screen.getAllByRole('tab', { name: 'Table' });
    fireEvent.click(tableTabs[1]);
    expect(screen.getByText('CUSTOMUNKNOWN')).toBeTruthy();
  });

  it('renders empty state when no mappings', () => {
    const { container } = render(<CodeView mappings={[]} />);
    expect(container.textContent).toContain('No mappings or assertions defined');
  });

  it('renders assertions section in code view', () => {
    const assertions: Assertion[] = [
      { type: 'arrayLength', jsonPath: 'offers', operator: '>=', value: 1 },
      { type: 'each', jsonPath: 'offers[*]', fieldPath: 'rank', operator: 'greater_than_or_equal', value: '0' },
    ];
    const { container } = render(<CodeView mappings={[]} assertions={assertions} />);
    expect(container.textContent).toContain('Assertions');
    expect(container.textContent).toContain('LENGTH');
    expect(container.textContent).toContain('EACH');
    expect(container.textContent).toContain('2 assertions');
    expect(container.textContent).not.toContain('No mappings or assertions defined');
  });

  it('shows assertion count in header', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const assertions: Assertion[] = [
      { type: 'arrayContains', jsonPath: 'items', value: '"foo"', mode: 'any' },
    ];
    const { container } = render(<CodeView mappings={mappings} assertions={assertions} />);
    expect(container.textContent).toContain('1 mapping');
    expect(container.textContent).toContain('1 assertion');
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

  it('displays double-digit line numbers in code view when there are many mappings', () => {
    const mappings: Mapping[] = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      sourcePath: `s${i}`,
      sourceId: 's1',
      targetPath: `t${String(i).padStart(2, '0')}`,
    }));
    const { container } = render(<CodeView mappings={mappings} />);
    const lineNos = container.querySelectorAll('.dm-code-view-line-no');
    expect(lineNos[lineNos.length - 1].textContent).toBe('10');
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
    expect(screen.getByText('△ changed')).toBeTruthy();
    expect(screen.getByText('— same')).toBeTruthy();
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

  it('shows empty table message when focus mode matches no rows', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'x' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { a: 1 } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.change(screen.getByLabelText('Search mapping rows'), { target: { value: 'nomatch-xyz' } });
    fireEvent.click(screen.getByLabelText('Focus matches'));
    expect(screen.getByText('No rows match the current search.')).toBeTruthy();
    expect(screen.getByText('0 matches')).toBeTruthy();
  });

  it('reports multiple search matches in toolbar meta', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'block.userName' },
      { id: 'm2', sourcePath: 'b', sourceId: 's1', targetPath: 'block.userAlias' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { a: 1, b: 2 } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.change(screen.getByLabelText('Search mapping rows'), { target: { value: 'user' } });
    expect(screen.getByText('2 matches')).toBeTruthy();
  });

  it('shows runtime trace count in table toolbar when debug hooks are enabled', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'u.x' },
    ];
    const traces = new Map<string, MappingTrace>([
      ['m1', {
        mappingId: 'm1',
        sourcePath: 'a',
        sourceId: 's1',
        sourceValue: 1,
        targetPath: 'u.x',
        targetValue: 1,
        evaluatedValue: 1,
        timestamp: Date.now(),
        durationMs: 0,
      }],
    ]);
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { a: 1 } }]}
        activeSourceId="s1"
        debugMode
        traceByMappingId={traces}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByText(/1 runtime trace$/)).toBeTruthy();
  });

  it('renders mappings that include operator metadata in code and table modes', () => {
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourcePath: 'qty',
        sourceId: 's1',
        targetPath: 'line.count',
        operator: 'greater_than',
        operatorValue: '0',
      },
    ];
    const { container } = render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { qty: 3 } }]}
        activeSourceId="s1"
      />,
    );
    expect(container.textContent).toContain('line.count ← qty');

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByText('line.count')).toBeTruthy();
    expect(screen.getByText('qty')).toBeTruthy();
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

  it('shows n/a duration for preview-origin traces', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { name: 'Pat' } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for user.name' }));
    expect(screen.getByText('Preview trace')).toBeTruthy();
    expect(screen.getByText('Duration: n/a')).toBeTruthy();
  });

  it('closes trace inspector via Close button', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { name: 'Pat' } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for user.name' }));
    expect(screen.getByLabelText('Row trace inspector')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByLabelText('Row trace inspector')).toBeNull();
  });

  it('clears trace selection when switching from Table back to Code mode', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { name: 'Pat' } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for user.name' }));
    expect(screen.getByLabelText('Row trace inspector')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));
    expect(screen.queryByLabelText('Row trace inspector')).toBeNull();
  });

  it('clears trace selection when the active mapping row disappears', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.name' },
    ];
    const { rerender } = render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { name: 'Pat' } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for user.name' }));
    expect(screen.getByLabelText('Row trace inspector')).toBeTruthy();
    rerender(
      <CodeView
        mappings={[]}
        sources={[{ id: 's1', label: 'S', sampleData: { name: 'Pat' } }]}
        activeSourceId="s1"
      />,
    );
    expect(screen.queryByLabelText('Row trace inspector')).toBeNull();
  });

  it('labels expression evaluation failures when the thrown value is not an Error instance', () => {
    vi.spyOn(mapperExpr, 'evaluateMapperExpression').mockImplementation(() => {
      throw 'not an error';
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out', expression: '$upper($.name)' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { name: 'x' } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByText(/Error: Evaluation failed/)).toBeTruthy();
  });

  it('shows evaluator error message when expression evaluation returns an error field', () => {
    vi.spyOn(mapperExpr, 'evaluateMapperExpression').mockReturnValue({
      value: undefined,
      preview: '',
      error: 'bad syntax',
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out', expression: '$broken()' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { name: 'x' } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByText(/Error: bad syntax/)).toBeTruthy();
  });

  it('formats circular evaluated values without crashing', () => {
    const circular: Record<string, unknown> = { tag: 'loop' };
    circular.self = circular;
    vi.spyOn(mapperExpr, 'evaluateMapperExpression').mockReturnValue({
      value: circular,
      preview: '',
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out', expression: '$noop()' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { name: 'x' } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByText('[object Object]')).toBeTruthy();
  });

  it('uses stringify fallback when comparing non-circular preview values fails', () => {
    const left = { tag: 'a' };
    const right = { tag: 'b' };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'snap', sourceId: 's1', targetPath: 'out' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { snap: right } }]}
        activeSourceId="s1"
        targetSampleData={{ out: left }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByText('△ changed')).toBeTruthy();
  });

  it('falls back when path resolution throws during table preview', () => {
    const spy = vi.spyOn(mapperExpr, 'resolveMapperPath').mockImplementation(() => {
      throw new Error('resolve failed');
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'x', sourceId: 's1', targetPath: 'y' },
    ];
    render(
      <CodeView
        mappings={mappings}
        sources={[{ id: 's1', label: 'S', sampleData: { x: 1 } }]}
        activeSourceId="s1"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(spy).toHaveBeenCalled();
    expect(screen.getAllByText('undefined')).toHaveLength(2);
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

    it('renders pivot placeholder for missing field cells', () => {
      const sparse: Mapping[] = [
        { id: 'm1', sourcePath: 'offers[0].code', sourceId: 's1', targetPath: 'offers[0].code' },
        { id: 'm2', sourcePath: 'offers[1].name', sourceId: 's1', targetPath: 'offers[1].name' },
      ];
      render(<CodeView mappings={sparse} sources={arraySources} activeSourceId="s1" />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      const tableTabs = screen.getAllByRole('tab', { name: 'Table' });
      fireEvent.click(tableTabs[1]);
      const dashes = document.querySelectorAll('.validation-fields-pivot-empty');
      expect(dashes.length).toBeGreaterThan(0);
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
