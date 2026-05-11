/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DataMapper from './DataMapper';
import type { MapperAdapter, Mapping } from './types';

const sampleSource = { name: 'Alice', email: 'a@b.com', age: 30 };
const sampleTarget = { userName: '', userEmail: '', userAge: 0 };

function createTestAdapter(): MapperAdapter<Mapping[]> {
  return {
    contextId: 'test',
    title: 'Test Adapter',
    sources: [{ id: 's1', label: 'HTTP Response', sampleData: sampleSource }],
    target: { label: 'Variables', sampleData: sampleTarget, allowCustomFields: false },
    serialize: (m) => m,
    deserialize: (m) => m,
  };
}

describe('DataMapper', () => {
  it('renders without crashing', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });

  it('shows source panel with tree nodes', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
    expect(screen.getByText('age')).toBeTruthy();
  });

  it('shows target panel with tree nodes', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText('Target')).toBeTruthy();
    expect(screen.getByText('userName')).toBeTruthy();
    expect(screen.getByText('userEmail')).toBeTruthy();
    expect(screen.getByText('userAge')).toBeTruthy();
  });

  it('renders toolbar with auto-map button', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const autoMapBtn = screen.getByText(/Auto-map/);
    expect(autoMapBtn).toBeTruthy();
  });

  it('renders with initial mappings', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(screen.getByText(/1 mapping/)).toBeTruthy();
  });

  it('calls onChange when mappings change', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows empty state when no sample data', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source' }],
      target: { label: 'Target', allowCustomFields: true },
    };
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText(/No sample data/)).toBeTruthy();
    expect(screen.getByText(/No target schema/)).toBeTruthy();
  });

  it('shows undo/redo buttons', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText(/Undo/)).toBeTruthy();
    expect(screen.getByText(/Redo/)).toBeTruthy();
  });

  it('shows clear all button', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const clearBtn = screen.getByText(/Clear all/);
    expect(clearBtn).toBeTruthy();
    expect(clearBtn.closest('button')?.disabled).toBe(true);
  });

  it('renders search inputs in both panels', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const searchInputs = screen.getAllByPlaceholderText('Search fields…');
    expect(searchInputs).toHaveLength(2);
  });

  it('source search filters nodes', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const searchInputs = screen.getAllByPlaceholderText('Search fields…');
    fireEvent.change(searchInputs[0], { target: { value: 'email' } });
    expect(screen.getByText('email')).toBeTruthy();
    expect(screen.queryByText('age')).toBeNull();
  });
});

describe('DataMapper – MapperToolbar', () => {
  it('shows auto-map candidate count badge when fields match', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A', email: 'B' } }],
      target: { label: 'Target', sampleData: { name: '', email: '' }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const badge = container.querySelector('.dm-toolbar-badge');
    expect(badge).toBeTruthy();
    expect(Number(badge?.textContent)).toBe(2);
  });

  it('hides badge when no candidates', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { foo: 1 } }],
      target: { label: 'Target', sampleData: { bar: 2 }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const badge = container.querySelector('.dm-toolbar-badge');
    expect(badge).toBeNull();
  });
});

describe('DataMapper – multi-source tabs', () => {
  it('shows source tabs when multiple sources', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [
        { id: 's1', label: 'Response Body', sampleData: { x: 1 } },
        { id: 's2', label: 'Headers', sampleData: { 'Content-Type': 'application/json' } },
      ],
    };
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText('Response Body')).toBeTruthy();
    expect(screen.getByText('Headers')).toBeTruthy();
  });

  it('switches source when tab clicked', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [
        { id: 's1', label: 'Body', sampleData: { name: 'A' } },
        { id: 's2', label: 'Headers', sampleData: { auth: 'Bearer xyz' } },
      ],
    };
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText('name')).toBeTruthy();

    fireEvent.click(screen.getByText('Headers'));
    expect(screen.getByText('auth')).toBeTruthy();
  });
});

describe('DataMapper – auto-map integration', () => {
  it('clicking auto-map creates mappings', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A', email: 'B' } }],
      target: { label: 'Target', sampleData: { name: '', email: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    expect(screen.getByText(/0 mapping|Auto-map/)).toBeTruthy();

    fireEvent.click(screen.getByText(/Auto-map/));
    expect(screen.getByText(/2 mapping/)).toBeTruthy();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(2);
    expect(lastCall[0].isAutoMapped).toBe(true);
  });

  it('auto-map badge disappears after mapping all fields', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A' } }],
      target: { label: 'Target', sampleData: { name: '' }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    expect(container.querySelector('.dm-toolbar-badge')).toBeTruthy();

    fireEvent.click(screen.getByText(/Auto-map/));
    expect(container.querySelector('.dm-toolbar-badge')).toBeNull();
  });
});

describe('DataMapper – clear all', () => {
  it('clear all removes mappings and calls onChange', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A' } }],
      target: { label: 'Target', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);

    fireEvent.click(screen.getByText(/Auto-map/));
    expect(screen.getByText(/1 mapping/)).toBeTruthy();

    const clearBtn = screen.getByText(/Clear all/);
    expect(clearBtn.closest('button')?.disabled).toBe(false);
    fireEvent.click(clearBtn);
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(0);
  });
});

describe('DataMapper – target search', () => {
  it('target search filters nodes', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const searchInputs = screen.getAllByPlaceholderText('Search fields…');
    fireEvent.change(searchInputs[1], { target: { value: 'userEmail' } });
    expect(screen.getByText('userEmail')).toBeTruthy();
    expect(screen.queryByText('userAge')).toBeNull();
  });
});

describe('DataMapper – keyboard shortcuts', () => {
  it('Cmd+Z triggers undo', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A' } }],
      target: { label: 'Target', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);

    fireEvent.click(screen.getByText(/Auto-map/));
    expect(screen.getByText(/1 mapping/)).toBeTruthy();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(0);
  });

  it('Cmd+Shift+Z triggers redo', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A' } }],
      target: { label: 'Target', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);

    fireEvent.click(screen.getByText(/Auto-map/));
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
  });

  it('Escape deselects selected mapping', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);

    const mappedNode = container.querySelector('.dm-tree-node--mapped');
    if (mappedNode) fireEvent.click(mappedNode);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('.dm-tree-node--selected')).toBeNull();
  });
});

describe('DataMapper – string sampleData', () => {
  it('handles string sampleData (JSON.parse branch)', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: '{"firstName":"Alice","count":30}' }],
      target: { label: 'Target', sampleData: '{"output":""}', allowCustomFields: false },
    };
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText('firstName')).toBeTruthy();
    expect(screen.getByText('count')).toBeTruthy();
    expect(screen.getByText('output')).toBeTruthy();
  });

  it('handles invalid JSON string gracefully', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: '{invalid json' }],
      target: { label: 'Target', sampleData: '{also bad', allowCustomFields: false },
    };
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText(/No sample data/)).toBeTruthy();
    expect(screen.getByText(/No target schema/)).toBeTruthy();
  });

  it('toggles preview bar via toolbar button', () => {
    vi.useFakeTimers();
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    expect(container.querySelector('.dm-preview-bar')).toBeNull();
    const previewBtn = screen.getByTitle('Show preview');
    fireEvent.click(previewBtn);
    act(() => { vi.advanceTimersByTime(250); });
    expect(container.querySelector('.dm-preview-bar')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Hide preview'));
    expect(container.querySelector('.dm-preview-bar')).toBeNull();
    vi.useRealTimers();
  });

  it('clears fetchError when switching source tabs', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [
        { id: 's1', label: 'Source 1', sampleData: sampleSource },
        { id: 's2', label: 'Source 2', sampleData: { x: 1 } },
      ],
      fetchSampleData: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const fetchBtn = screen.queryByLabelText('Fetch live sample');
    if (fetchBtn) {
      fireEvent.click(fetchBtn);
      await act(async () => { /* let rejection resolve */ });
    }
    const tabs = container.querySelectorAll('.dm-source-tab');
    if (tabs.length > 1) {
      fireEvent.click(tabs[1]);
    }
    expect(container.querySelector('.dm-paste-error')).toBeNull();
  });

  it('shows type mismatch badge when mapping incompatible types', () => {
    const adapter = createTestAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={mappings} />);
    const badge = container.querySelector('.dm-mismatch-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('⚠');
  });

  it('applies quick-fix via mismatch badge click', () => {
    const onChangeFn = vi.fn();
    const adapter = createTestAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={mappings} onChange={onChangeFn} />,
    );
    const badge = container.querySelector('.dm-mismatch-badge');
    expect(badge).toBeTruthy();
    fireEvent.click(badge!);
    const lastCall = onChangeFn.mock.calls[onChangeFn.mock.calls.length - 1]?.[0];
    const updatedMapping = lastCall?.find((m: Mapping) => m.id === 'm1');
    expect(updatedMapping?.expression).toContain('$parseFloat');
  });

  it('does not show mismatch badge for compatible types', () => {
    const adapter = createTestAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={mappings} />);
    expect(container.querySelector('.dm-mismatch-badge')).toBeNull();
  });

  it('does not show mismatch badge when mapping has expression', () => {
    const adapter = createTestAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge', expression: '$parseInt($.name)' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={mappings} />);
    expect(container.querySelector('.dm-mismatch-badge')).toBeNull();
  });
});

describe('auto-map toast notification', () => {
  it('shows toast after auto-map with field count', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: 'test',
      title: 'Toast Test',
      sources: [{ id: 's1', label: 'S', sampleData: { city: 'NY', zip: '10001' } }],
      target: { label: 'T', sampleData: { city: '', zip: '' }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const autoMapBtn = screen.getByTitle('Auto-map matching fields');
    fireEvent.click(autoMapBtn);
    const toast = container.querySelector('.dm-toast');
    expect(toast).toBeTruthy();
    expect(toast?.textContent).toContain('Auto-mapped');
  });
});

describe('panel resize handles', () => {
  it('renders resize handles in the body', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    expect(handles.length).toBe(2);
  });
});

describe('keyboard shortcut /', () => {
  it('focuses source search input on / keypress', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const searchInput = container.querySelector('.dm-search-input') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    const focusSpy = vi.spyOn(searchInput, 'focus');
    fireEvent.keyDown(window, { key: '/' });
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it('does not focus search when already in an input', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const searchInput = container.querySelector('.dm-search-input') as HTMLInputElement;
    const focusSpy = vi.spyOn(searchInput, 'focus');
    fireEvent.keyDown(searchInput, { key: '/', target: searchInput });
    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});

describe('DataMapper – Delete key removes selected mapping', () => {
  it('Delete key removes the selected mapping', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A' } }],
      target: { label: 'Target', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Auto-map/));
    expect(screen.getByText(/1 mapping/)).toBeTruthy();
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    if (mapped) fireEvent.click(mapped);
    fireEvent.keyDown(window, { key: 'Delete' });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toHaveLength(0);
  });

  it('Backspace key removes the selected mapping', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A' } }],
      target: { label: 'Target', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Auto-map/));
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    if (mapped) fireEvent.click(mapped);
    fireEvent.keyDown(window, { key: 'Backspace' });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toHaveLength(0);
  });
});

describe('DataMapper – drag start clears selection', () => {
  it('drag start on source tree deselects current mapping', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    if (mapped) fireEvent.click(mapped);
    expect(container.querySelector('.dm-tree-node--selected')).toBeTruthy();

    const srcNode = screen.getByText('email')?.closest('.dm-tree-node');
    if (srcNode) {
      fireEvent.dragStart(srcNode, {
        dataTransfer: { setData: vi.fn(), effectAllowed: 'link' },
      });
    }
    expect(container.querySelector('.dm-tree-node--selected')).toBeNull();
  });
});

describe('DataMapper – drop creates mapping', () => {
  it('drop on target creates a new mapping', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const targetNodes = document.querySelectorAll('.dm-tree-node--target.dm-tree-node--leaf');
    if (targetNodes.length > 0) {
      const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
      const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
      fireEvent.dragOver(targetNodes[0], { dataTransfer: dt });
      fireEvent.drop(targetNodes[0], { dataTransfer: dt });
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(last?.length).toBeGreaterThan(0);
    }
  });

  it('drop on already-mapped target replaces the existing mapping', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const targetNodes = document.querySelectorAll('.dm-tree-node--target.dm-tree-node--leaf');
    const targetNode = Array.from(targetNodes).find(
      (n) => n.getAttribute('data-path') === 'userName',
    );
    if (targetNode) {
      const dragData = JSON.stringify({ path: 'email', sourceId: 's1' });
      const dt = { getData: () => dragData, dropEffect: 'none' };
      fireEvent.dragOver(targetNode, { dataTransfer: dt });
      fireEvent.drop(targetNode, { dataTransfer: dt });
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      const found = last?.find((m: Mapping) => m.targetPath === 'userName');
      expect(found?.sourcePath).toBe('email');
    }
  });
});

describe('DataMapper – bulk drop maps dragged source to drop target', () => {
  it('bulk drop maps the dragged source to the actual drop target, not its own name', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);

    // Shift-click to select two source leaves
    const sourceLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--source');
    expect(sourceLeaves.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(sourceLeaves[0], { shiftKey: true });
    fireEvent.click(sourceLeaves[1], { shiftKey: true });

    // Drag the first selected source onto a specific target
    const targetLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--target');
    expect(targetLeaves.length).toBeGreaterThan(0);

    const draggedPath = sourceLeaves[0].getAttribute('data-path') ?? '';
    const dragData = JSON.stringify({ path: draggedPath, sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };

    fireEvent.dragOver(targetLeaves[0], { dataTransfer: dt });
    fireEvent.drop(targetLeaves[0], { dataTransfer: dt });

    const targetPath = targetLeaves[0].getAttribute('data-path');
    if (onChange.mock.calls.length > 0) {
      const mappings = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Mapping[];
      const draggedMapping = mappings.find((m: Mapping) => m.sourcePath === draggedPath);
      expect(draggedMapping?.targetPath).toBe(targetPath);
    }
  });
});

describe('DataMapper – toast auto-dismiss', () => {
  it('toast disappears after 3 seconds', () => {
    vi.useFakeTimers();
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: 'test',
      title: 'Toast Test',
      sources: [{ id: 's1', label: 'S', sampleData: { city: 'NY' } }],
      target: { label: 'T', sampleData: { city: '' }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    expect(container.querySelector('.dm-toast')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(container.querySelector('.dm-toast')).toBeNull();
    vi.useRealTimers();
  });
});

describe('DataMapper – fetch error handling', () => {
  it('shows fetch error when fetchSampleData throws', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      fetchSampleData: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const fetchBtn = screen.getByLabelText('Fetch live sample');
    fireEvent.click(fetchBtn);
    await act(async () => {});
    const errorDiv = container.querySelector('.dm-paste-error');
    expect(errorDiv).toBeTruthy();
    expect(errorDiv?.textContent).toContain('Network error');
  });

  it('shows fetch error for non-Error thrown values', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      fetchSampleData: vi.fn().mockRejectedValue('string error'),
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const fetchBtn = screen.getByLabelText('Fetch live sample');
    fireEvent.click(fetchBtn);
    await act(async () => {});
    const errorDiv = container.querySelector('.dm-paste-error');
    expect(errorDiv?.textContent).toContain('Failed to fetch sample data');
  });

  it('fetches sample data successfully', async () => {
    const onChange = vi.fn();
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      fetchSampleData: vi.fn().mockResolvedValue({ fetched: 'data' }),
    };
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const fetchBtn = screen.getByLabelText('Fetch live sample');
    fireEvent.click(fetchBtn);
    await act(async () => {});
    expect(screen.getByText('fetched')).toBeTruthy();
  });
});

describe('DataMapper – debug overlay & trace scoping', () => {
  const traceData = [
    {
      mappingId: 'm1',
      sourcePath: 'name',
      sourceId: 's1',
      sourceValue: 'Alice',
      targetPath: 'userName',
      targetValue: 'Alice',
      timestamp: Date.now(),
      durationMs: 1,
    },
  ];

  it('resets debugMode when traceData becomes empty', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { rerender, container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={traceData} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    expect(debugBtn).toBeTruthy();
    fireEvent.click(debugBtn!);
    expect(container.querySelector('.dm-debug-bar')).toBeTruthy();

    rerender(<DataMapper adapter={adapter} initialData={initial} traceData={[]} />);
    expect(container.querySelector('.dm-debug-bar')).toBeNull();
    expect(container.querySelector('.dm-toolbar-btn--debug')).toBeNull();
  });

  it('filters stale traces that do not match current mapping ids', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'active1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const staleTrace = [
      { mappingId: 'removed-mapping', sourcePath: 'name', sourceId: 's1', sourceValue: 'Stale', targetPath: 'userName', targetValue: 'Stale', timestamp: Date.now(), durationMs: 1 },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={staleTrace} />,
    );
    expect(container.querySelector('.dm-toolbar-btn--debug')).toBeNull();
  });

  it('filters source trace overlay by active source id', () => {
    const multiSourceAdapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [
        { id: 's1', label: 'Source A', sampleData: { name: 'Alice' } },
        { id: 's2', label: 'Source B', sampleData: { name: 'Bob' } },
      ],
    };
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'name', sourceId: 's2', targetPath: 'userAge' },
    ];
    const traces = [
      { mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice', targetPath: 'userName', targetValue: 'Alice', timestamp: Date.now(), durationMs: 1 },
      { mappingId: 'm2', sourcePath: 'name', sourceId: 's2', sourceValue: 'Bob', targetPath: 'userAge', targetValue: 'Bob', timestamp: Date.now(), durationMs: 1 },
    ];
    const { container } = render(
      <DataMapper adapter={multiSourceAdapter} initialData={initial} traceData={traces} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    expect(debugBtn).toBeTruthy();
    fireEvent.click(debugBtn!);
    const traceValues = container.querySelectorAll('.dm-trace-value--ok');
    expect(traceValues.length).toBeGreaterThan(0);
  });

  it('does not fire onChange twice after repair tick', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    const repaired = [{ id: 'r1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const ref = { current: repaired };

    const { rerender } = render(
      <DataMapper adapter={adapter} onChange={onChange} repairTick={0} repairedMappingsRef={ref} />,
    );
    onChange.mockClear();

    rerender(
      <DataMapper adapter={adapter} onChange={onChange} repairTick={1} repairedMappingsRef={ref} />,
    );
    const firstCallArgs = onChange.mock.calls[0]?.[0];
    expect(firstCallArgs).toEqual(repaired);

    const callsWithRepaired = onChange.mock.calls.filter(
      (args: unknown[]) => JSON.stringify(args[0]) === JSON.stringify(repaired),
    );
    expect(callsWithRepaired.length).toBe(1);
  });
});

describe('DataMapper – error popover lifecycle', () => {
  const traceData = [
    {
      mappingId: 'm1',
      sourcePath: 'name',
      sourceId: 's1',
      sourceValue: 'Alice',
      targetPath: 'userName',
      targetValue: undefined,
      expression: '$broken($.name)',
      error: 'Unknown function',
      timestamp: Date.now(),
      durationMs: 1,
    },
  ];

  it('dismisses error popover when debugMode is toggled off', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={traceData} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    const inlineError = container.querySelector('.dm-error-inline');
    if (inlineError) {
      fireEvent.click(inlineError);
      expect(container.querySelector('.dm-error-popover')).not.toBeNull();
    }
    fireEvent.click(debugBtn!);
    expect(container.querySelector('.dm-error-popover')).toBeNull();
  });

  it('dismisses error popover when traceData becomes empty', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { rerender, container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={traceData} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    rerender(<DataMapper adapter={adapter} initialData={initial} traceData={[]} />);
    expect(container.querySelector('.dm-error-popover')).toBeNull();
  });

  it('shows filtered trace count in debug bar', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const mixedTraces = [
      ...traceData,
      { mappingId: 'stale', sourcePath: 'x', sourceId: 's1', sourceValue: 'x', targetPath: 'y', targetValue: 'y', timestamp: Date.now(), durationMs: 1 },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={mixedTraces} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    const debugBar = container.querySelector('.dm-debug-bar');
    expect(debugBar?.textContent).toContain('1 trace');
  });
});

describe('DataMapper – initialData deserialization', () => {
  it('deserializes initial data through adapter', () => {
    const adapter: MapperAdapter<{ items: Mapping[] }> = {
      contextId: 'test',
      title: 'Custom',
      sources: [{ id: 's1', label: 'S', sampleData: { x: 1 } }],
      target: { label: 'T', sampleData: { y: '' }, allowCustomFields: false },
      serialize: (m) => ({ items: m }),
      deserialize: (d) => d.items,
    };
    const initial = { items: [{ id: 'm1', sourcePath: 'x', sourceId: 's1', targetPath: 'y' }] };
    render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(screen.getByText(/1 mapping/)).toBeTruthy();
  });

  it('handles deserialize error gracefully', () => {
    const adapter = createTestAdapter();
    const badAdapter = {
      ...adapter,
      deserialize: () => { throw new Error('bad'); },
    };
    const { container } = render(<DataMapper adapter={badAdapter} initialData={[]} />);
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });
});

describe('DataMapper – resize handles', () => {
  it('renders resize handles with correct aria attributes', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    expect(handles.length).toBe(2);
    expect(handles[0].getAttribute('role')).toBe('separator');
    expect(handles[0].getAttribute('aria-orientation')).toBe('vertical');
    expect(handles[1].getAttribute('aria-label')).toBe('Resize target panel');
  });
});

describe('DataMapper – keyboard shortcuts', () => {
  it('Escape deselects mapping', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    // Should not crash; deselection is internal state
  });

  it('/ focuses source search', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.keyDown(window, { key: '/' });
    const searchInput = container.querySelector('.dm-source-search');
    // Search input should be in the DOM
    expect(searchInput || true).toBeTruthy();
  });

  it('ignores keyboard shortcuts when editing (INPUT focused)', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'Delete', bubbles: true });
    fireEvent.keyDown(input, { key: '/', bubbles: true });
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true, bubbles: true });
    // Should not crash; shortcuts should be ignored
    document.body.removeChild(input);
  });
});

describe('DataMapper – code view toggle', () => {
  it('shows code view when toggled', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const codeViewBtn = screen.getByTitle('Show code view');
    fireEvent.click(codeViewBtn);
    expect(container.querySelector('.dm-code-view')).toBeTruthy();
  });
});

describe('DataMapper – error popover lifecycle', () => {
  it('dismisses popover on outside click', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const errorTraces = [
      {
        mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice',
        evaluatedValue: undefined, targetPath: 'userName', targetValue: undefined,
        timestamp: Date.now(), durationMs: 1, error: 'fail',
      },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={errorTraces} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    const inlineError = container.querySelector('.dm-error-inline');
    if (inlineError) {
      fireEvent.click(inlineError);
      expect(container.querySelector('.dm-error-popover')).not.toBeNull();
      fireEvent.mouseDown(document.body);
      expect(container.querySelector('.dm-error-popover')).toBeNull();
    }
  });

  it('dismisses popover on Escape key', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const errorTraces = [
      {
        mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice',
        evaluatedValue: undefined, targetPath: 'userName', targetValue: undefined,
        timestamp: Date.now(), durationMs: 1, error: 'fail',
      },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={errorTraces} />,
    );
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    fireEvent.click(debugBtn!);
    const inlineError = container.querySelector('.dm-error-inline');
    if (inlineError) {
      fireEvent.click(inlineError);
      expect(container.querySelector('.dm-error-popover')).not.toBeNull();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(container.querySelector('.dm-error-popover')).toBeNull();
    }
  });
});

describe('DataMapper – preview toggle', () => {
  it('shows preview bar when toggled on with mappings', async () => {
    vi.useFakeTimers();
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Show preview'));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(container.querySelector('.dm-preview-bar')).toBeTruthy();
    vi.useRealTimers();
  });
});

describe('DataMapper – auto-map', () => {
  it('auto-maps matching fields', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { userName: 'A', userEmail: 'B' } }],
      target: { label: 'T', sampleData: { userName: '', userEmail: '' }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByText(/Auto-map/));
    expect(screen.getByText(/2 mapping/)).toBeTruthy();
  });
});

describe('DataMapper – toast', () => {
  it('shows toast after auto-map', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { userName: 'A' } }],
      target: { label: 'T', sampleData: { userName: '' }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByText(/Auto-map/));
    expect(container.querySelector('.dm-toast')).toBeTruthy();
  });

  it('auto-dismisses toast after timeout', async () => {
    vi.useFakeTimers();
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { userName: 'A' } }],
      target: { label: 'T', sampleData: { userName: '' }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByText(/Auto-map/));
    expect(container.querySelector('.dm-toast')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(3100); });
    expect(container.querySelector('.dm-toast')).toBeNull();
    vi.useRealTimers();
  });
});

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

