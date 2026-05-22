/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import DataMapper from './DataMapper';
import { MapperAdapter, Mapping } from './types';
import * as _mappingPatternsNs from './utils/mappingPatterns';
import * as _autoMapAlgorithm from './utils/autoMapAlgorithm';
import * as _mappingProfiles from './utils/mappingProfiles';
import * as _dropMappingNs from './utils/dropMapping';
import * as _subtreeMappingNs from './utils/subtreeMapping';
import { sampleSource, sampleTarget, createTestAdapter } from './DataMapper.test-utils';

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

  it('hydrates target fields from existing mappings when schema is absent', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { foo: 'bar' } }],
      target: { label: 'Target', allowCustomFields: true },
    };
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'foo', sourceId: 's1', targetPath: 'expectedFooValue' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(screen.queryByText(/No target schema/)).toBeNull();
    expect(screen.getByText('expectedFooValue')).toBeTruthy();
  });

  it('reorders target fields by drag-and-drop in fields mode', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      target: {
        label: 'Target',
        allowCustomFields: true,
        fields: [
          { path: 'first', label: 'First', type: 'string' },
          { path: 'second', label: 'Second', type: 'string' },
          { path: 'third', label: 'Third', type: 'string' },
        ],
      },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const secondNode = screen.getByText('Second').closest('.dm-tree-node')! as HTMLElement;
    const firstNode = screen.getByText('First').closest('.dm-tree-node')!;
    const dragDt = {
      setData: vi.fn(),
      getData: () => '',
      effectAllowed: 'none',
      dropEffect: 'none',
    };
    const dropDt = {
      getData: () => '',
      dropEffect: 'none',
    };
    fireEvent.dragStart(secondNode, { dataTransfer: dragDt });
    fireEvent.dragOver(firstNode, { dataTransfer: dropDt });
    fireEvent.drop(firstNode, { dataTransfer: dropDt });

    const targetNodes = Array.from(container.querySelectorAll('.dm-panel--target .dm-tree-node[data-path]'))
      .map((el) => el.getAttribute('data-path'))
      .filter((path): path is string => !!path);
    expect(targetNodes.slice(0, 3)).toEqual(['second', 'first', 'third']);

    // keep node refs used above alive to avoid unused TS pruning in strict transforms
    expect(secondNode).toBeTruthy();
  });

  it('shows undo/redo buttons', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByTitle('Undo (⌘Z)')).toBeTruthy();
    expect(screen.getByTitle('Redo (⌘⇧Z)')).toBeTruthy();
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

describe('DataMapper - explicit bulk actions and path parity', () => {
  it('maps selected subtree via Map subtree action', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1',
        label: 'Source',
        sampleData: { offers: [{ associatedOfferingCode: 'A', rank: 1 }] },
      }],
      target: {
        label: 'Target',
        allowCustomFields: true,
        fields: [
          { path: 'offers[0].associatedOfferingCode', label: 'associatedOfferingCode', type: 'string' },
          { path: 'offers[0].rank', label: 'rank', type: 'number' },
        ],
      },
    };
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} onChange={onChange} />);

    const sourceNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="offers[0]"]');
    const targetNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0]"]');
    expect(sourceNode).toBeTruthy();
    expect(targetNode).toBeTruthy();
    if (!sourceNode || !targetNode) return;
    fireEvent.click(sourceNode);
    fireEvent.click(targetNode);
    fireEvent.click(screen.getByRole('button', { name: 'Map subtree' }));

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last).toBeTruthy();
    expect(last).toHaveLength(2);
    expect(last?.some((m) => m.targetPath === 'offers[0].associatedOfferingCode')).toBe(true);
    expect(last?.some((m) => m.targetPath === 'offers[0].rank')).toBe(true);
  });

  it('maps sibling indices via Map siblings action', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1',
        label: 'Source',
        sampleData: {
          offers: [
            { associatedOfferingCode: 'A' },
            { associatedOfferingCode: 'B' },
          ],
        },
      }],
      target: {
        label: 'Target',
        allowCustomFields: true,
        fields: [
          { path: 'offers[0].associatedOfferingCode', label: 'associatedOfferingCode 0', type: 'string' },
          { path: 'offers[1].associatedOfferingCode', label: 'associatedOfferingCode 1', type: 'string' },
        ],
      },
    };
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} onChange={onChange} />);

    const sourceNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="offers[0]"]');
    const targetNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0]"]');
    expect(sourceNode).toBeTruthy();
    expect(targetNode).toBeTruthy();
    if (!sourceNode || !targetNode) return;
    fireEvent.click(sourceNode);
    fireEvent.click(targetNode);
    fireEvent.click(screen.getByRole('button', { name: 'Map siblings' }));

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last).toBeTruthy();
    expect(last).toHaveLength(2);
    expect(last?.some((m) => m.targetPath === 'offers[0].associatedOfferingCode')).toBe(true);
    expect(last?.some((m) => m.targetPath === 'offers[1].associatedOfferingCode')).toBe(true);
    expect(container.querySelector('.dm-toast')?.textContent).toContain('across array siblings');
  });

  it('shows propagation preview from selected indexed mapping and applies it', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1',
        label: 'Source',
        sampleData: {
          offers: [
            { associatedOfferingCode: 'A' },
            { associatedOfferingCode: 'B' },
          ],
        },
      }],
      target: {
        label: 'Target',
        allowCustomFields: true,
        fields: [
          { path: 'offers[0].associatedOfferingCode', label: 'associatedOfferingCode 0', type: 'string' },
          { path: 'offers[1].associatedOfferingCode', label: 'associatedOfferingCode 1', type: 'string' },
        ],
      },
    };
    const initial: Mapping[] = [{
      id: 'anchor',
      sourcePath: 'offers[0].associatedOfferingCode',
      sourceId: 's1',
      targetPath: 'offers[0].associatedOfferingCode',
    }];
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);

    const anchorNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0].associatedOfferingCode"]');
    expect(anchorNode).toBeTruthy();
    if (!anchorNode) return;
    fireEvent.click(anchorNode);
    fireEvent.click(screen.getByRole('button', { name: 'Preview propagate' }));

    expect(screen.getByText(/Propagation preview from/)).toBeTruthy();
    expect(screen.getByText(/1 new/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply propagation' }));

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last).toBeTruthy();
    expect(last).toHaveLength(2);
    expect(last?.some((m) => m.targetPath === 'offers[1].associatedOfferingCode')).toBe(true);
    expect(container.querySelector('.dm-toast')?.textContent).toContain('Propagated pattern');
  });

  it('shows guidance toast when propagation preview is requested without selected mapping', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview propagate' }));
    expect(container.querySelector('.dm-toast')?.textContent).toContain('Select an indexed mapping first');
  });

  it('clears selected target subtree via Clear subtree action', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1',
        label: 'Source',
        sampleData: { offers: [{ code: 'A', rank: 1 }], meta: { trace: 'x' } },
      }],
      target: {
        label: 'Target',
        allowCustomFields: true,
        fields: [
          { path: 'offers[0].code', label: 'code', type: 'string' },
          { path: 'offers[0].rank', label: 'rank', type: 'number' },
          { path: 'meta.trace', label: 'trace', type: 'string' },
        ],
      },
    };
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'offers[0].code', sourceId: 's1', targetPath: 'offers[0].code' },
      { id: 'm2', sourcePath: 'offers[0].rank', sourceId: 's1', targetPath: 'offers[0].rank' },
      { id: 'm3', sourcePath: 'meta.trace', sourceId: 's1', targetPath: 'meta.trace' },
    ];
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);

    const targetNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0]"]');
    expect(targetNode).toBeTruthy();
    if (!targetNode) return;
    fireEvent.click(targetNode);
    fireEvent.click(screen.getByRole('button', { name: 'Clear subtree' }));

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last).toBeTruthy();
    expect(last).toHaveLength(1);
    expect(last?.[0].targetPath).toBe('meta.trace');
    expect(container.querySelector('.dm-toast')?.textContent).toContain('Cleared 2 mappings');
  });

  it('replaces selected target subtree via Replace subtree action', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1',
        label: 'Source',
        sampleData: { offers: [{ associatedOfferingCode: 'A' }, { associatedOfferingCode: 'B' }] },
      }],
      target: {
        label: 'Target',
        allowCustomFields: true,
        fields: [{ path: 'offers[0].associatedOfferingCode', label: 'associatedOfferingCode', type: 'string' }],
      },
    };
    const initial: Mapping[] = [
      {
        id: 'seed',
        sourcePath: 'offers[1].associatedOfferingCode',
        sourceId: 's1',
        targetPath: 'offers[0].associatedOfferingCode',
      },
    ];
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);

    const sourceNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="offers[0]"]');
    const targetNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0]"]');
    expect(sourceNode).toBeTruthy();
    expect(targetNode).toBeTruthy();
    if (!sourceNode || !targetNode) return;
    fireEvent.click(sourceNode);
    fireEvent.click(targetNode);
    fireEvent.click(screen.getByRole('button', { name: 'Replace subtree' }));

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last).toBeTruthy();
    expect(last).toHaveLength(1);
    expect(last?.[0].sourcePath).toBe('offers[0].associatedOfferingCode');
    expect(container.querySelector('.dm-toast')?.textContent).toContain('Replaced subtree');
  });

  it('normalizes dot-before-index paths when resolving mapped source overlays', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { offers: [{ associatedOfferingCode: 'A' }] } }],
      target: {
        label: 'T',
        allowCustomFields: true,
        fields: [{ path: 'offers[0].associatedOfferingCode', label: 'associatedOfferingCode', type: 'string' }],
      },
    };
    const initial: Mapping[] = [
      {
        id: 'norm',
        sourcePath: '$.offers.[0].associatedOfferingCode',
        sourceId: 's1',
        targetPath: 'offers[0].associatedOfferingCode',
      },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const sourceLeaf = container.querySelector('.dm-panel--source .dm-tree-node[data-path="offers[0].associatedOfferingCode"]');
    expect(sourceLeaf).toBeTruthy();
    expect(sourceLeaf?.classList.contains('dm-tree-node--mapped')).toBe(true);
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
      sources: [{ id: 's1', label: 'Source', sampleData: { foo: 'hello' } }],
      target: { label: 'Target', sampleData: { bar: true }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const badge = container.querySelector('.dm-toolbar-badge');
    expect(badge).toBeNull();
  });

  it('collapses advanced controls by default in dense sessions', () => {
    const adapter = createTestAdapter();
    const initialData: Mapping[] = Array.from({ length: 8 }, (_, i) => ({
      id: `dense-${i}`,
      sourcePath: 'name',
      sourceId: 's1',
      targetPath: `denseTarget${i}`,
    }));
    const { container } = render(<DataMapper adapter={adapter} initialData={initialData} />);
    expect(container.querySelector('.dm-toolbar-advanced-panel')).toBeNull();
    fireEvent.click(screen.getByLabelText('Toggle advanced controls'));
    expect(container.querySelector('.dm-toolbar-advanced-panel')).toBeTruthy();
  });

  it('closes advanced controls when compact mode is enabled', async () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const advancedToggle = screen.getByLabelText('Toggle advanced controls');
    if (advancedToggle.getAttribute('aria-expanded') !== 'true') {
      fireEvent.click(advancedToggle);
    }
    await waitFor(() => expect(container.querySelector('.dm-toolbar-advanced-panel')).toBeTruthy());
    fireEvent.click(screen.getByTitle('Switch to compact mode'));
    await waitFor(() => expect(container.querySelector('.dm-toolbar-advanced-panel')).toBeNull());
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

  it('auto-maps in fields-only target mode (no target sampleData)', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1',
        label: 'Source',
        sampleData: {
          offers: [
            { associatedOfferingCode: 'A' },
            { associatedOfferingCode: 'B' },
            { associatedOfferingCode: 'C' },
          ],
        },
      }],
      target: {
        label: 'Target',
        allowCustomFields: true,
        fields: [
          { path: 'offers[0].associatedOfferingCode', label: 'associatedOfferingCode', type: 'string' },
          { path: 'offers[1].associatedOfferingCode', label: 'associatedOfferingCode', type: 'string' },
          { path: 'offers[2].associatedOfferingCode', label: 'associatedOfferingCode', type: 'string' },
        ],
      },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);

    fireEvent.click(screen.getByText(/Auto-map/));
    expect(screen.getByText(/3 mapping/)).toBeTruthy();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(3);
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

  it('auto-fetches sample data in validation context when no source data and has mappings', async () => {
    const fetchSampleData = vi.fn().mockResolvedValue({ autoFetched: true });
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: 'validation',
      sources: [{ id: 's1', label: 'Response', sampleData: undefined }],
      target: { label: 'Target', sampleData: sampleTarget, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (d) => d ?? [],
      fetchSampleData,
    };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'field', sourceId: 's1', targetPath: 'userName' },
    ];
    render(<DataMapper adapter={adapter} initialData={mappings} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(fetchSampleData).toHaveBeenCalled();
  });

  it('does not auto-fetch in validation context when source data already exists', async () => {
    const fetchSampleData = vi.fn().mockResolvedValue({ autoFetched: true });
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: 'validation',
      sources: [{ id: 's1', label: 'Response', sampleData: { existing: 'data' } }],
      target: { label: 'Target', sampleData: sampleTarget, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (d) => d ?? [],
      fetchSampleData,
    };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'field', sourceId: 's1', targetPath: 'userName' },
    ];
    render(<DataMapper adapter={adapter} initialData={mappings} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(fetchSampleData).not.toHaveBeenCalled();
  });

  it('does not auto-fetch in validation context when no mappings', async () => {
    const fetchSampleData = vi.fn().mockResolvedValue({ autoFetched: true });
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: 'validation',
      sources: [{ id: 's1', label: 'Response', sampleData: undefined }],
      target: { label: 'Target', sampleData: sampleTarget, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (d) => d ?? [],
      fetchSampleData,
    };
    render(<DataMapper adapter={adapter} initialData={[]} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(fetchSampleData).not.toHaveBeenCalled();
  });

  it('handles auto-fetch error gracefully in validation context', async () => {
    const fetchSampleData = vi.fn().mockRejectedValue(new Error('Fetch failed'));
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: 'validation',
      sources: [{ id: 's1', label: 'Response', sampleData: undefined }],
      target: { label: 'Target', sampleData: sampleTarget, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (d) => d ?? [],
      fetchSampleData,
    };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'field', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={mappings} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(fetchSampleData).toHaveBeenCalled();
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });
});

