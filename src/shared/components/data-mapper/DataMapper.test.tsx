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
    const fetchBtn = screen.queryByTitle('Fetch live sample');
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
    expect(updatedMapping?.expression).toContain('$parseInt');
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
    const mapped = container.querySelector('.dm-tree-node--mapped');
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
    const mapped = container.querySelector('.dm-tree-node--mapped');
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
    const mapped = container.querySelector('.dm-tree-node--mapped');
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
    const fetchBtn = screen.getByTitle('Fetch live sample');
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
    const fetchBtn = screen.getByTitle('Fetch live sample');
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
    const fetchBtn = screen.getByTitle('Fetch live sample');
    fireEvent.click(fetchBtn);
    await act(async () => {});
    expect(screen.getByText('fetched')).toBeTruthy();
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
});

describe('DataMapper – expression editor modal', () => {
  it('opens expression editor on double-click of mapped target node', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const expandBtns = screen.getAllByTitle('Expand all');
    expandBtns.forEach((b) => fireEvent.click(b));
    const targetMapped = container.querySelector('.dm-panel--target .dm-tree-node--mapped');
    expect(targetMapped).toBeTruthy();
    fireEvent.doubleClick(targetMapped!);
    expect(container.querySelector('.dm-expr-overlay')).toBeTruthy();
  });

  it('closes expression editor on cancel', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const expandBtns = screen.getAllByTitle('Expand all');
    expandBtns.forEach((b) => fireEvent.click(b));
    const mapped = container.querySelector('.dm-panel--target .dm-tree-node--mapped');
    fireEvent.doubleClick(mapped!);
    expect(container.querySelector('.dm-expr-overlay')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(container.querySelector('.dm-expr-overlay')).toBeNull();
  });

  it('saves expression and closes modal on save', () => {
    const onChange = vi.fn();
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} onChange={onChange} />,
    );
    const expandBtns = screen.getAllByTitle('Expand all');
    expandBtns.forEach((b) => fireEvent.click(b));
    const mapped = container.querySelector('.dm-panel--target .dm-tree-node--mapped');
    fireEvent.doubleClick(mapped!);
    const textarea = container.querySelector('.dm-expr-textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    fireEvent.change(textarea, { target: { value: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(container.querySelector('.dm-expr-overlay')).toBeNull();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    const updated = last?.find((m: Mapping) => m.id === 'm1');
    expect(updated?.expression).toBe('$upper($.name)');
  });
});

describe('DataMapper – resize handles', () => {
  it('mousedown on source resize handle initiates resize', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    expect(handles.length).toBe(2);

    const addSpy = vi.spyOn(document, 'addEventListener');
    fireEvent.mouseDown(handles[0], { clientX: 200 });
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    addSpy.mockRestore();
    document.dispatchEvent(new MouseEvent('mouseup'));
  });

  it('mousedown on target resize handle initiates resize', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');

    const addSpy = vi.spyOn(document, 'addEventListener');
    fireEvent.mouseDown(handles[1], { clientX: 400 });
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    addSpy.mockRestore();
    document.dispatchEvent(new MouseEvent('mouseup'));
  });
});

describe('DataMapper – auto-map with no candidates', () => {
  it('auto-map does nothing when source/target have no matches', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { abc: 1 } }],
      target: { label: 'T', sampleData: { xyz: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(last).toHaveLength(0);
  });

  it('auto-map handles no source data gracefully', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: undefined }],
      target: { label: 'T', sampleData: { x: '' }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    expect(container.querySelector('.dm-toast')).toBeNull();
  });

  it('auto-map handles no target data gracefully', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { x: 1 } }],
      target: { label: 'T', sampleData: undefined, allowCustomFields: false },
    };
    render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
  });
});

describe('DataMapper – keyboard shortcuts suppressed when editing', () => {
  it('does not trigger undo when expression editor is open', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const onChange = vi.fn();
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} onChange={onChange} />,
    );
    const mapped = container.querySelector('.dm-tree-node--mapped');
    if (mapped) fireEvent.doubleClick(mapped);
    expect(container.querySelector('.dm-expr-overlay')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(last).toHaveLength(1);
  });
});

describe('DataMapper – keyboard shortcuts skip text inputs', () => {
  it('Backspace in search input does not remove selected mapping', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const searchInput = screen.getAllByPlaceholderText('Search fields…')[0];
    fireEvent.keyDown(searchInput, { key: 'Backspace' });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(last).toHaveLength(1);
  });

  it('Ctrl+Z in search input does not trigger mapper undo', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const searchInput = screen.getAllByPlaceholderText('Search fields…')[0];
    fireEvent.keyDown(searchInput, { key: 'z', metaKey: true });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(last).toHaveLength(1);
  });
});

describe('DataMapper – accept/reject pending', () => {
  it('accept all pending converts pending to permanent', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { name: 'A' } }],
      target: { label: 'T', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    const mappingsBeforeAccept = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(mappingsBeforeAccept[0]?.isPending).toBe(true);
    const acceptBtn = screen.queryByTitle('Accept all pending');
    if (acceptBtn) {
      fireEvent.click(acceptBtn);
      const mappingsAfterAccept = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(mappingsAfterAccept[0]?.isPending).toBeUndefined();
    }
  });

  it('reject all pending removes all pending mappings', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { name: 'A' } }],
      target: { label: 'T', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    const rejectBtn = screen.queryByTitle('Reject all pending');
    if (rejectBtn) {
      fireEvent.click(rejectBtn);
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(last).toHaveLength(0);
    }
  });
});

describe('DataMapper – preview with expression editor', () => {
  it('shows preview bar with mappings that include expressions', () => {
    vi.useFakeTimers();
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$upper($.name)' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Show preview'));
    act(() => { vi.advanceTimersByTime(250); });
    expect(container.querySelector('.dm-preview-bar')).toBeTruthy();
    vi.useRealTimers();
  });
});
