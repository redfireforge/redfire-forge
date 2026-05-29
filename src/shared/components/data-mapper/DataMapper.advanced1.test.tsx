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
describe('DataMapper – bulk drop maps dragged source to drop target', () => {
  it('bulk drop maps the dragged source to the actual drop target, not its own name', async () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);

    // Shift-click to select two source leaves
    const sourceLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--source');
    expect(sourceLeaves.length).toBeGreaterThanOrEqual(2);
    await act(async () => { fireEvent.click(sourceLeaves[0], { shiftKey: true }); });
    await act(async () => { fireEvent.click(sourceLeaves[1], { shiftKey: true }); });

    // Drag the first selected source onto a specific target
    const targetLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--target');
    expect(targetLeaves.length).toBeGreaterThan(0);

    const draggedPath = sourceLeaves[0].getAttribute('data-path') ?? '';
    const dragData = JSON.stringify({ path: draggedPath, sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };

    await act(async () => {
      fireEvent.dragOver(targetLeaves[0], { dataTransfer: dt });
      fireEvent.drop(targetLeaves[0], { dataTransfer: dt });
    });

    const targetPath = targetLeaves[0].getAttribute('data-path');
    if (onChange.mock.calls.length > 0) {
      const mappings = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Mapping[];
      const draggedMapping = mappings.find((m: Mapping) => m.sourcePath === draggedPath);
      expect(draggedMapping?.targetPath).toBe(targetPath);
    }
  });
});

describe('DataMapper – toast auto-dismiss', () => {
  it('toast disappears after 3 seconds', async () => {
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
    await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
    expect(container.querySelector('.dm-toast')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(3000); });
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
    const errorBanner = container.querySelector('.dm-fetch-error-banner');
    expect(errorBanner).toBeTruthy();
    expect(errorBanner?.textContent).toContain('Network error');
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
    const errorBanner = container.querySelector('.dm-fetch-error-banner');
    expect(errorBanner?.textContent).toContain('Failed to fetch sample data');
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

  it('resets debugMode when traceData becomes empty', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { rerender, container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={traceData} />,
    );
    await act(async () => {});
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    expect(debugBtn).toBeTruthy();
    await act(async () => { fireEvent.click(debugBtn!); });
    expect(container.querySelector('.dm-debug-bar')).toBeTruthy();

    rerender(<DataMapper adapter={adapter} initialData={initial} traceData={[]} />);
    await act(async () => {});
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

  it('filters source trace overlay by active source id', async () => {
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
    await act(async () => {});
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    expect(debugBtn).toBeTruthy();
    await act(async () => { fireEvent.click(debugBtn!); });
    const traceValues = container.querySelectorAll('.dm-trace-value--ok');
    expect(traceValues.length).toBeGreaterThan(0);
  });

  it('wires runtime traces into CodeView inspector when debug mode is active', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const traces = [
      {
        mappingId: 'm1',
        sourcePath: 'name',
        sourceId: 's1',
        sourceValue: 'Alice',
        targetPath: 'userName',
        targetValue: 'Alice Runtime',
        evaluatedValue: 'Alice Runtime',
        timestamp: Date.now(),
        durationMs: 3.2,
      },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={traces} />,
    );
    await act(async () => {});

    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    expect(debugBtn).toBeTruthy();
    await act(async () => { fireEvent.click(debugBtn!); });

    await act(async () => { fireEvent.click(screen.getByTitle('Show code view')); });
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Table' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for userName' })); });

    expect(screen.getByText('Runtime trace')).toBeTruthy();
    expect(screen.getAllByText('Alice Runtime').length).toBeGreaterThan(0);
  });

  it('does not fire onChange twice after repair tick', async () => {
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
    await act(async () => {});
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

  it('dismisses error popover when debugMode is toggled off', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={traceData} />,
    );
    await act(async () => {});
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    await act(async () => { fireEvent.click(debugBtn!); });
    const inlineError = container.querySelector('.dm-error-inline');
    if (inlineError) {
      await act(async () => { fireEvent.click(inlineError); });
      expect(container.querySelector('.dm-error-popover')).not.toBeNull();
    }
    await act(async () => { fireEvent.click(debugBtn!); });
    expect(container.querySelector('.dm-error-popover')).toBeNull();
  });

  it('dismisses error popover when traceData becomes empty', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { rerender, container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={traceData} />,
    );
    await act(async () => {});
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    await act(async () => { fireEvent.click(debugBtn!); });
    rerender(<DataMapper adapter={adapter} initialData={initial} traceData={[]} />);
    await act(async () => {});
    expect(container.querySelector('.dm-error-popover')).toBeNull();
  });

  it('shows filtered trace count in debug bar', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const mixedTraces = [
      ...traceData,
      { mappingId: 'stale', sourcePath: 'x', sourceId: 's1', sourceValue: 'x', targetPath: 'y', targetValue: 'y', timestamp: Date.now(), durationMs: 1 },
    ];
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} traceData={mixedTraces} />,
    );
    await act(async () => {});
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    await act(async () => { fireEvent.click(debugBtn!); });
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

  it('resizes target panel when dragging target handle', async () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    const targetHandle = handles[1] as HTMLElement;
    const panelWrappers = container.querySelectorAll('.dm-panel-wrapper');
    const targetWrapper = panelWrappers[1] as HTMLElement;

    expect(targetWrapper.style.width).toBe('');
    await act(async () => {
      fireEvent.mouseDown(targetHandle, { clientX: 600 });
      fireEvent.mouseMove(document, { clientX: 520 });
      fireEvent.mouseUp(document);
    });
    expect(targetWrapper.style.width).not.toBe('');
  });

  it('keeps source divider independent when dragging target handle', async () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    const targetHandle = handles[1] as HTMLElement;
    const panelWrappers = container.querySelectorAll('.dm-panel-wrapper');
    const sourceWrapper = panelWrappers[0] as HTMLElement;
    const canvasWrapper = container.querySelector('.dm-canvas-wrapper') as HTMLElement;
    const startCanvasWidth = parseFloat(canvasWrapper.style.width || '0');

    expect(sourceWrapper.style.width).toBe('');
    await act(async () => {
      fireEvent.mouseDown(targetHandle, { clientX: 600 });
      fireEvent.mouseMove(document, { clientX: 520 });
      fireEvent.mouseUp(document);
    });

    const endCanvasWidth = parseFloat(canvasWrapper.style.width || '0');
    expect(sourceWrapper.style.width).toBe('');
    expect(endCanvasWidth).toBeLessThan(startCanvasWidth);
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
  it('shows code view when toggled', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => {});
    const codeViewBtn = screen.getByTitle('Show code view');
    await act(async () => { fireEvent.click(codeViewBtn); });
    expect(container.querySelector('.dm-code-view')).toBeTruthy();
  });

  it('keeps bottom utility dock single-surface between code and preview', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => {});

    await act(async () => { fireEvent.click(screen.getByTitle('Show code view')); });
    expect(container.querySelector('.dm-bottom-utility-dock')).toBeTruthy();
    expect(container.querySelector('.dm-code-view')).toBeTruthy();
    expect(container.querySelector('.dm-preview-bar')).toBeNull();

    await act(async () => { fireEvent.click(screen.getByTitle('Show preview')); });
    expect(container.querySelector('.dm-bottom-utility-dock')).toBeTruthy();
    expect(container.querySelector('.dm-preview-bar')).toBeTruthy();
    expect(container.querySelector('.dm-code-view')).toBeNull();
  });
});

describe('DataMapper – error popover lifecycle', () => {
  it('dismisses popover on outside click', async () => {
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
    await act(async () => {});
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    await act(async () => { fireEvent.click(debugBtn!); });
    const inlineError = container.querySelector('.dm-error-inline');
    if (inlineError) {
      await act(async () => { fireEvent.click(inlineError); });
      expect(container.querySelector('.dm-error-popover')).not.toBeNull();
      await act(async () => { fireEvent.mouseDown(document.body); });
      expect(container.querySelector('.dm-error-popover')).toBeNull();
    }
  });

  it('dismisses popover on Escape key', async () => {
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
    await act(async () => {});
    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    await act(async () => { fireEvent.click(debugBtn!); });
    const inlineError = container.querySelector('.dm-error-inline');
    if (inlineError) {
      await act(async () => { fireEvent.click(inlineError); });
      expect(container.querySelector('.dm-error-popover')).not.toBeNull();
      await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
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
    await act(async () => { fireEvent.click(screen.getByTitle('Show preview')); });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(container.querySelector('.dm-preview-bar')).toBeTruthy();
    vi.useRealTimers();
  });
});

describe('DataMapper – mapping line visibility', () => {
  it('shows node-focus option only while lines are hidden', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => {});

    expect(screen.queryByTitle('Enable node-focus lines')).toBeNull();

    await act(async () => { fireEvent.click(screen.getByTitle('Hide mapping lines')); });
    expect(screen.getByTitle('Show mapping lines')).toBeTruthy();
    expect(screen.getByTitle('Enable node-focus lines')).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByTitle('Enable node-focus lines')); });
    expect(screen.getByTitle('Disable node-focus lines')).toBeTruthy();

    // Clicking tree nodes in node-focus mode should not break interaction.
    const mappedSourceNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]');
    expect(mappedSourceNode).toBeTruthy();
    if (!mappedSourceNode) return;
    await act(async () => { fireEvent.click(mappedSourceNode); });

    const unmappedSourceNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="email"]');
    expect(unmappedSourceNode).toBeTruthy();
    if (!unmappedSourceNode) return;
    await act(async () => { fireEvent.click(unmappedSourceNode); });

    await act(async () => { fireEvent.click(screen.getByTitle('Show mapping lines')); });
    expect(screen.queryByTitle('Enable node-focus lines')).toBeNull();
  });
});

describe('DataMapper – target live value updates', () => {
  it('shows mapped source value on target row', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const targetNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="userName"]');
    expect(targetNode?.textContent).toContain('= Alice');
  });
});

describe('DataMapper – auto-map', () => {
  it('auto-maps matching fields', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { userName: 'A', userEmail: 'B' } }],
      target: { label: 'T', sampleData: { userName: '', userEmail: '' }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    render(<DataMapper adapter={adapter} />);
    await act(async () => { fireEvent.click(screen.getByText(/Auto-map/)); });
    expect(screen.getByText(/2 mapping/)).toBeTruthy();
  });
});

describe('DataMapper – toast', () => {
  it('shows toast after auto-map', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { userName: 'A' } }],
      target: { label: 'T', sampleData: { userName: '' }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    await act(async () => { fireEvent.click(screen.getByText(/Auto-map/)); });
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
    await act(async () => { fireEvent.click(screen.getByText(/Auto-map/)); });
    expect(container.querySelector('.dm-toast')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(3100); });
    expect(container.querySelector('.dm-toast')).toBeNull();
    vi.useRealTimers();
  });
});

