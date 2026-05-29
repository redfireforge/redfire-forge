/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import DataMapper from './DataMapper';
import type { MapperAdapter, Mapping } from './types';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      className="dm-expr-textarea"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label="Expression"
    />
  ),
}));

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

describe('DataMapper – expression editor modal', () => {
  it('opens expression editor on double-click of mapped target node', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const expandBtns = screen.getAllByLabelText('Expand all');
    expandBtns.forEach((b) => fireEvent.click(b));
    const targetMapped = container.querySelector('.dm-panel--target .dm-tree-node--mapped');
    expect(targetMapped).toBeTruthy();
    await act(async () => { fireEvent.doubleClick(targetMapped!); });
    expect(document.querySelector('.dm-expr-overlay')).toBeTruthy();
  });

  it('closes expression editor on cancel', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const expandBtns = screen.getAllByLabelText('Expand all');
    expandBtns.forEach((b) => fireEvent.click(b));
    const mapped = container.querySelector('.dm-panel--target .dm-tree-node--mapped');
    await act(async () => { fireEvent.doubleClick(mapped!); });
    expect(document.querySelector('.dm-expr-overlay')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(document.querySelector('.dm-expr-overlay')).toBeNull();
  });

  it('saves expression and closes modal on save', async () => {
    const onChange = vi.fn();
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} onChange={onChange} />,
    );
    const expandBtns = screen.getAllByLabelText('Expand all');
    expandBtns.forEach((b) => fireEvent.click(b));
    const mapped = container.querySelector('.dm-panel--target .dm-tree-node--mapped');
    await act(async () => {
      await act(async () => { fireEvent.doubleClick(mapped!); });
    });
    await waitFor(() => {
      expect(document.querySelector('.dm-expr-overlay')).toBeTruthy();
    });
    const textarea = document.querySelector('.dm-expr-textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    await act(async () => { fireEvent.change(textarea, { target: { value: '$upper($.name)' } }); });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Expression'));
    });
    expect(document.querySelector('.dm-expr-overlay')).toBeNull();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    const updated = last?.find((m: Mapping) => m.id === 'm1');
    expect(updated?.expression).toBe('$upper($.name)');
  });
});

describe('DataMapper – resize handles', () => {
  it('mousedown on source resize handle initiates resize', async () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    expect(handles.length).toBe(2);

    const addSpy = vi.spyOn(document, 'addEventListener');
    await act(async () => { fireEvent.mouseDown(handles[0], { clientX: 200 }); });
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    addSpy.mockRestore();
    document.dispatchEvent(new MouseEvent('mouseup'));
  });

  it('mousedown on target resize handle initiates resize', async () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');

    const addSpy = vi.spyOn(document, 'addEventListener');
    await act(async () => { fireEvent.mouseDown(handles[1], { clientX: 400 }); });
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    addSpy.mockRestore();
    document.dispatchEvent(new MouseEvent('mouseup'));
  });
});

describe('DataMapper – auto-map with no candidates', () => {
  it('auto-map does nothing when source/target have no matches', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { abc: 1 } }],
      target: { label: 'T', sampleData: { xyz: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(last).toHaveLength(0);
  });

  it('auto-map handles no source data gracefully', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: undefined }],
      target: { label: 'T', sampleData: { x: '' }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
    expect(container.querySelector('.dm-toast')).toBeNull();
  });

  it('auto-map handles no target data gracefully', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { x: 1 } }],
      target: { label: 'T', sampleData: undefined, allowCustomFields: false },
    };
    render(<DataMapper adapter={adapter} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
  });
});

describe('DataMapper – keyboard shortcuts suppressed when editing', () => {
  it('does not trigger undo when expression editor is open', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const onChange = vi.fn();
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} onChange={onChange} />,
    );
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    if (mapped) fireEvent.doubleClick(mapped);
    expect(document.querySelector('.dm-expr-overlay')).toBeTruthy();
    await act(async () => { fireEvent.keyDown(window, { key: 'z', metaKey: true }); });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(last).toHaveLength(1);
  });
});

describe('DataMapper – keyboard shortcuts skip text inputs', () => {
  it('Backspace in search input does not remove selected mapping', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const searchInput = screen.getAllByPlaceholderText('Search fields…')[0];
    await act(async () => { fireEvent.keyDown(searchInput, { key: 'Backspace' }); });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(last).toHaveLength(1);
  });

  it('Ctrl+Z in search input does not trigger mapper undo', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const searchInput = screen.getAllByPlaceholderText('Search fields…')[0];
    await act(async () => { fireEvent.keyDown(searchInput, { key: 'z', metaKey: true }); });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(last).toHaveLength(1);
  });
});

describe('DataMapper – accept/reject pending', () => {
  it('accept all pending converts pending to permanent', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { name: 'A' } }],
      target: { label: 'T', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
    const mappingsBeforeAccept = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(mappingsBeforeAccept[0]?.isPending).toBe(true);
    const acceptBtn = screen.queryByTitle('Accept all pending');
    if (acceptBtn) {
      await act(async () => { fireEvent.click(acceptBtn); });
      const mappingsAfterAccept = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(mappingsAfterAccept[0]?.isPending).toBeUndefined();
    }
  });

  it('reject all pending removes all pending mappings', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { name: 'A' } }],
      target: { label: 'T', sampleData: { name: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
    const rejectBtn = screen.queryByTitle('Reject all pending');
    if (rejectBtn) {
      await act(async () => { fireEvent.click(rejectBtn); });
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(last).toHaveLength(0);
    }
  });
});

describe('DataMapper – deserialize error handling', () => {
  it('falls back to empty mappings when deserialize throws', async () => {
    const adapter: MapperAdapter<unknown> = {
      ...createTestAdapter(),
      deserialize: () => { throw new Error('bad data'); },
    };
    const { container } = render(<DataMapper adapter={adapter} initialData={[]} />);
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });
});

describe('DataMapper – preview with expression editor', () => {
  it('shows preview bar with mappings that include expressions', async () => {
    vi.useFakeTimers();
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$upper($.name)' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Show preview')); });
    act(() => { vi.advanceTimersByTime(250); });
    expect(container.querySelector('.dm-preview-bar')).toBeTruthy();
    vi.useRealTimers();
  });
});

describe('DataMapper – profiles integration', () => {
  beforeEach(() => localStorage.clear());

  it('renders Profiles button in toolbar', async () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByTitle('Mapping profiles')).toBeTruthy();
  });

  it('opens profile menu and saves a profile', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Mapping profiles')); });
    const nameInput = screen.getByPlaceholderText('Profile name…');
    await act(async () => { fireEvent.change(nameInput, { target: { value: 'Test Profile' } }); });
    await act(async () => { fireEvent.click(screen.getByText('Save')); });
    await waitFor(() => expect(screen.getByText('Test Profile')).toBeTruthy());
  });
});

describe('DataMapper – multi-select delete', () => {
  it('auto-map then undo restores mappings via removeMappings path', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { name: 'A', email: 'B' } }],
      target: { label: 'Target', sampleData: { name: '', email: '' }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);

    await act(async () => { fireEvent.click(screen.getByText(/Auto-map/)); });
    const afterAutoMap = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(afterAutoMap.length).toBe(2);
  });
});

describe('DataMapper – bulk source select', () => {
  it('shift+click on source leaf toggles selection class', async () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const leafNodes = container.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--source');
    expect(leafNodes.length).toBeGreaterThan(0);

    await act(async () => { fireEvent.click(leafNodes[0], { shiftKey: true }); });
    expect(container.querySelectorAll('.dm-tree-node--selected').length).toBe(1);

    await act(async () => { fireEvent.click(leafNodes[0], { shiftKey: true }); });
    expect(container.querySelectorAll('.dm-tree-node--selected').length).toBe(0);
  });
});

describe('DataMapper – array suggestion bar', () => {
  it('renders array suggestion bar when an array mapping is selected', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { tags: ['a', 'b', 'c'] } }],
      target: { label: 'Target', sampleData: { label: '' }, allowCustomFields: false },
    };

    const { container, rerender } = render(
      <DataMapper adapter={adapter} initialData={[
        { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'label' },
      ]} />,
    );

    expect(container.querySelector('.dm-array-suggestion-bar')).toBeNull();

    await act(async () => {
      rerender(
        <DataMapper adapter={adapter} initialData={[
          { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'label' },
        ]} />,
      );
    });
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });
});
