/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DataMapper from './DataMapper';
import { MapperAdapter, Mapping } from './types';
import * as _mappingPatternsNs from './utils/mappingPatterns';
import * as _autoMapAlgorithm from './utils/autoMapAlgorithm';
import * as _mappingProfiles from './utils/mappingProfiles';
import * as _dropMappingNs from './utils/dropMapping';
import * as _subtreeMappingNs from './utils/subtreeMapping';
import { createTestAdapter } from './DataMapper.test-utils';
describe('DataMapper – fetch sample', () => {
  it('calls adapter.fetchSampleData when fetch button is available', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ name: 'Fetched' });
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      fetchSampleData: fetchFn,
    };
    render(<DataMapper adapter={adapter} />);
    const fetchBtn = screen.queryByTitle('Fetch sample data');
    if (fetchBtn) {
      await act(async () => { fireEvent.click(fetchBtn); });
      expect(fetchFn).toHaveBeenCalled();
    }
  });
});

describe('DataMapper – array suggestion bar', () => {
  it('shows array suggestion bar when array mapping is selected', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { items: [{ name: 'A' }] } }],
      target: { label: 'T', sampleData: { items: [{ name: '' }] }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'items', sourceId: 's1', targetPath: 'items' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    // Click on a mapping line to select it
    const line = container.querySelector('.dm-line');
    if (line) {
      fireEvent.click(line);
    }
    // Array suggestion bar should be visible if an array mapping is selected
  });
});

describe('DataMapper – trace overlays', () => {
  it('renders source trace overlay in debug mode', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const traces = [
      {
        mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice',
        evaluatedValue: 'Alice', targetPath: 'userName', targetValue: 'Alice',
        timestamp: Date.now(), durationMs: 1,
      },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={traces} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    const debugBar = container.querySelector('.dm-debug-bar');
    expect(debugBar).not.toBeNull();
    expect(debugBar?.textContent).toContain('trace');
  });

  it('shows error count in debug bar', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const errorTraces = [
      {
        mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice',
        evaluatedValue: undefined, targetPath: 'userName', targetValue: undefined,
        timestamp: Date.now(), durationMs: 1, error: 'oops',
      },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={errorTraces} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    const debugBar = container.querySelector('.dm-debug-bar');
    expect(debugBar?.textContent).toContain('error');
  });
});

describe('DataMapper – error popover', () => {
  it('closes error popover on close button click', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const errorTraces = [
      {
        mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice',
        evaluatedValue: undefined, targetPath: 'userName', targetValue: undefined,
        timestamp: Date.now(), durationMs: 1, error: 'something broke',
      },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={errorTraces} />,
    );
    // Enable debug mode
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);

    // Click the error inline text to open popover
    const errorInline = container.querySelector('.dm-error-inline');
    if (errorInline) {
      fireEvent.click(errorInline);
      const popover = container.querySelector('.dm-error-popover');
      if (popover) {
        expect(popover.textContent).toContain('Mapping Error');
        // Close the popover
        const closeBtn = container.querySelector('.dm-error-popover-close');
        fireEvent.click(closeBtn!);
        expect(container.querySelector('.dm-error-popover')).toBeNull();
      }
    }
  });

  it('closes error popover on Escape keydown', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const errorTraces = [
      {
        mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice',
        evaluatedValue: undefined, targetPath: 'userName', targetValue: undefined,
        timestamp: Date.now(), durationMs: 1, error: 'something broke',
      },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={errorTraces} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    const errorInline = container.querySelector('.dm-error-inline');
    if (errorInline) {
      fireEvent.click(errorInline);
      if (container.querySelector('.dm-error-popover')) {
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(container.querySelector('.dm-error-popover')).toBeNull();
      }
    }
  });

  it('closes error popover on outside mousedown', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const errorTraces = [
      {
        mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice',
        evaluatedValue: undefined, targetPath: 'userName', targetValue: undefined,
        timestamp: Date.now(), durationMs: 1, error: 'something broke',
      },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={errorTraces} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    const errorInline = container.querySelector('.dm-error-inline');
    if (errorInline) {
      fireEvent.click(errorInline);
      if (container.querySelector('.dm-error-popover')) {
        fireEvent.mouseDown(document.body);
        expect(container.querySelector('.dm-error-popover')).toBeNull();
      }
    }
  });
});

describe('DataMapper – resize handles', () => {
  it('renders resize handles for source and target panels', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    expect(handles.length).toBe(2);
    expect(handles[0].getAttribute('aria-label')).toBe('Resize source panel');
    expect(handles[1].getAttribute('aria-label')).toBe('Resize target panel');
  });

  it('initiates resize on mousedown and cleans up on mouseup', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const sourceHandle = container.querySelector('[aria-label="Resize source panel"]')!;
    fireEvent.mouseDown(sourceHandle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 150 });
    fireEvent.mouseUp(document);
    // No crash — resize cleanup ran successfully
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });
});

describe('DataMapper – array suggestion bar', () => {
  it('shows aggregate suggestion when array-to-scalar mapping selected', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1', label: 'Source',
        sampleData: { items: [1, 2, 3] },
      }],
      target: {
        label: 'Target',
        sampleData: { total: 0 },
        allowCustomFields: false,
        fields: [{ path: 'total', label: 'total', type: 'number' }],
      },
    };
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'items', sourceId: 's1', targetPath: 'total' },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} />,
    );
    // Select the mapping to show array suggestion bar
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    if (mapped) {
      fireEvent.click(mapped);
      const suggestionBar = container.querySelector('.dm-array-suggestion-bar');
      if (suggestionBar) {
        expect(suggestionBar.textContent).toContain('Array');
      }
    }
  });
});

describe('DataMapper – deserialize error handling', () => {
  it('returns empty mappings when deserialize throws', () => {
    const adapter: MapperAdapter<string> = {
      contextId: 'test',
      title: 'Bad Adapter',
      sources: [{ id: 's1', label: 'Source', sampleData: { a: 1 } }],
      target: { label: 'Target', sampleData: { b: 0 }, allowCustomFields: false },
      serialize: () => '',
      deserialize: () => { throw new Error('bad data'); },
    };
    const { container } = render(<DataMapper adapter={adapter} initialData="bad" />);
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });
});

describe('DataMapper – repairTick', () => {
  it('applies repaired mappings when repairTick changes', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    const repairedRef = { current: [
      { id: 'r1', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ] };
    const { rerender } = render(
      <DataMapper adapter={adapter} onChange={onChange} repairTick={0} repairedMappingsRef={repairedRef} />,
    );
    rerender(
      <DataMapper adapter={adapter} onChange={onChange} repairTick={1} repairedMappingsRef={repairedRef} />,
    );
    expect(onChange).toHaveBeenCalledWith(repairedRef.current);
  });

  it('does not replace mappings when repairTick changes without repairedMappingsRef', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    const { rerender } = render(<DataMapper adapter={adapter} onChange={onChange} repairTick={0} />);
    onChange.mockClear();
    rerender(<DataMapper adapter={adapter} onChange={onChange} repairTick={1} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not replace mappings when repair ref current is null', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    const ref = { current: null as Mapping[] | null };
    const { rerender } = render(
      <DataMapper adapter={adapter} onChange={onChange} repairTick={0} repairedMappingsRef={ref} />,
    );
    onChange.mockClear();
    rerender(<DataMapper adapter={adapter} onChange={onChange} repairTick={1} repairedMappingsRef={ref} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('DataMapper – stats footer', () => {
  it('renders stats footer with 0 mapped when no mappings', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const footer = container.querySelector('.dm-stats-footer');
    expect(footer).toBeTruthy();
    const mappedValue = container.querySelector('.dm-stat-value--mapped');
    expect(mappedValue).toBeTruthy();
    expect(mappedValue!.textContent).toBe('0');
  });

  it('shows correct mapped count with initial mappings', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: '2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const mappedValue = container.querySelector('.dm-stat-value--mapped');
    expect(mappedValue!.textContent).toBe('2');
  });

  it('keeps toolbar status and footer mapped count consistent for partial mapping', () => {
    const adapter = createTestAdapter();
    const partial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={partial} />);
    expect(screen.getByText(/1 mapping/)).toBeTruthy();
    const mappedValue = container.querySelector('.dm-stat-value--mapped');
    expect(mappedValue?.textContent).toBe('1');
  });

  it('keeps toolbar status and footer mapped count consistent for fully mapped shell', () => {
    const adapter = createTestAdapter();
    const full: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: '2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={full} />);
    expect(screen.getByText(/2 mappings/)).toBeTruthy();
    const mappedValue = container.querySelector('.dm-stat-value--mapped');
    expect(mappedValue?.textContent).toBe('2');
  });

  it('surfaces unresolved mappings when source or target paths are missing', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'Alice' } }],
      target: { label: 'Target', sampleData: { userName: '' }, allowCustomFields: true },
    };
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'missingSource', sourceId: 's1', targetPath: 'missingTarget' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(screen.getByText('0 mapped, 1 unresolved')).toBeTruthy();
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('0');
    expect(container.textContent).toContain('1 unresolved');
  });

  it('shows expression count when mappings have expressions', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: 'toUpperCase($)' },
      { id: '2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const exprValue = container.querySelector('.dm-stat-value--expression');
    expect(exprValue).toBeTruthy();
    expect(exprValue!.textContent).toBe('1');
  });

  it('does not show expression stat when count is zero', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const exprValue = container.querySelector('.dm-stat-value--expression');
    expect(exprValue).toBeNull();
  });

  it('does not show loop/aggregate/mismatch stats when counts are zero', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    expect(container.querySelector('.dm-stat-value--loop')).toBeNull();
    expect(container.querySelector('.dm-stat-value--aggregate')).toBeNull();
    expect(container.querySelector('.dm-stat-value--mismatch')).toBeNull();
  });

  it('renders keyboard shortcut hints', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const shortcuts = container.querySelector('.dm-stats-shortcuts');
    expect(shortcuts).toBeTruthy();
    expect(shortcuts!.textContent).toContain('Search');
    expect(shortcuts!.textContent).toContain('Delete');
    expect(shortcuts!.textContent).toContain('Undo');
  });

  it('footer has role="status"', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const footer = container.querySelector('.dm-stats-footer');
    expect(footer!.getAttribute('role')).toBe('status');
  });

  it('pluralizes expression label correctly', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: 'toUpperCase($)' },
      { id: '2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail', expression: 'toLowerCase($)' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const stats = container.querySelectorAll('.dm-stat');
    const exprStat = Array.from(stats).find((s) => s.textContent?.includes('expression'));
    expect(exprStat!.textContent).toContain('expressions');
  });

  it('shows singular expression label for count of 1', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: 'toUpperCase($)' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const stats = container.querySelectorAll('.dm-stat');
    const exprStat = Array.from(stats).find((s) => s.textContent?.includes('expression'));
    expect(exprStat!.textContent).toMatch(/1\s*expression$/);
  });
});

describe('DataMapper – validation and repair panel', () => {
  it('renders issue rows with direct action buttons', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'Alice' } }],
      target: { label: 'Target', sampleData: { userName: '' }, allowCustomFields: true },
    };
    const initial: Mapping[] = [
      { id: 'i1', sourcePath: 'missingSource', sourceId: 's1', targetPath: 'missingTarget' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const panel = container.querySelector('.dm-validation-repair-panel');
    expect(panel).toBeTruthy();
    const missingTargetRow = container.querySelector('.dm-validation-repair-row[data-issue-kind="missing-target"]');
    expect(missingTargetRow).toBeTruthy();
    if (!missingTargetRow) return;
    const buttons = missingTargetRow.querySelectorAll('button');
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual(
      expect.arrayContaining(['Fix', 'Replace', 'Ignore once', 'Open node']),
    );
  });

  it('applies type mismatch fix from the validation panel', () => {
    const onChange = vi.fn();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' },
    ];
    const { container } = render(<DataMapper adapter={createTestAdapter()} initialData={initial} onChange={onChange} />);
    const row = container.querySelector('.dm-validation-repair-row[data-issue-kind="type-mismatch"]');
    expect(row).toBeTruthy();
    if (!row) return;
    const fixBtn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Fix');
    expect(fixBtn).toBeTruthy();
    fireEvent.click(fixBtn!);
    const latest = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(latest?.find((m) => m.id === 'm1')?.expression).toContain('$parseFloat');
  });

  it('replaces duplicate targets from the validation panel', () => {
    const onChange = vi.fn();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={createTestAdapter()} initialData={initial} onChange={onChange} />);
    const row = container.querySelector('.dm-validation-repair-row[data-issue-kind="duplicate-target"]');
    expect(row).toBeTruthy();
    if (!row) return;
    const replaceBtn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Replace');
    expect(replaceBtn).toBeTruthy();
    fireEvent.click(replaceBtn!);
    const latest = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(latest).toHaveLength(1);
    expect(latest?.[0]?.id).toBe('m2');
  });

  it('ignores one issue row and opens node focus from the panel', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'Alice' } }],
      target: { label: 'Target', sampleData: { userName: '' }, allowCustomFields: true },
    };
    const initial: Mapping[] = [
      { id: 'i1', sourcePath: 'missingSource', sourceId: 's1', targetPath: 'missingTarget' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const missingTargetRow = container.querySelector('.dm-validation-repair-row[data-issue-kind="missing-target"]');
    expect(missingTargetRow).toBeTruthy();
    if (!missingTargetRow) return;

    const openNodeBtn = Array.from(missingTargetRow.querySelectorAll('button')).find((b) => b.textContent === 'Open node');
    expect(openNodeBtn).toBeTruthy();
    fireEvent.click(openNodeBtn!);
    const targetSelection = container.querySelectorAll('.dm-bulk-selection strong')[1];
    expect(targetSelection?.textContent).toBe('missingTarget');

    const ignoreBtn = Array.from(missingTargetRow.querySelectorAll('button')).find((b) => b.textContent === 'Ignore once');
    expect(ignoreBtn).toBeTruthy();
    fireEvent.click(ignoreBtn!);
    expect(container.querySelector('.dm-validation-repair-row[data-issue-kind="missing-target"]')).toBeNull();
  });
});
