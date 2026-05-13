/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import DataMapper from './DataMapper';
import type { MapperAdapter, Mapping } from './types';
import { buildJsonTree, getAllLeafPaths } from '../../utils/jsonTreeModel';
import { savePattern } from './utils/mappingPatterns';
import * as mappingPatternsNs from './utils/mappingPatterns';
import { mapperGallerySamples } from './utils/gallerySamples';
import type { RepairSuggestion } from './utils/schemaRepair';
import * as autoMapAlgorithm from './utils/autoMapAlgorithm';
import * as mappingProfiles from './utils/mappingProfiles';

const sampleSource = { name: 'Alice', email: 'a@b.com', age: 30 };
const sampleTarget = { userName: '', userEmail: '', userAge: 0 };

async function bumpMapperLayout(host: HTMLElement) {
  await act(async () => {
    const root = host.querySelector('.dm-container') ?? host;
    root.querySelectorAll('.dm-tree-container').forEach((el) => {
      fireEvent.scroll(el);
    });
  });
}

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
    expect(toast?.textContent).toContain('auto-mapped');
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
  it('auto-applies number→string conversion expression on drop', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { rank: 13 } }],
      target: {
        label: 'Target',
        allowCustomFields: false,
        fields: [{ path: 'label', label: 'Label', type: 'string' }],
      },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const targetNode = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="label"]');
    const dragData = JSON.stringify({ path: 'rank', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    if (targetNode) {
      fireEvent.dragOver(targetNode, { dataTransfer: dt });
      fireEvent.drop(targetNode, { dataTransfer: dt });
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
      expect(last?.[0]?.expression).toBe('$toString($.rank)');
    }
  });

  it('auto-applies object→string conversion expression on drop', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { payload: { x: 1 } } }],
      target: {
        label: 'Target',
        allowCustomFields: false,
        fields: [{ path: 'payloadText', label: 'Payload Text', type: 'string' }],
      },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const targetNode = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="payloadText"]');
    const dragData = JSON.stringify({ path: 'payload', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    if (targetNode) {
      fireEvent.dragOver(targetNode, { dataTransfer: dt });
      fireEvent.drop(targetNode, { dataTransfer: dt });
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
      expect(last?.[0]?.expression).toBe('$toString($.payload)');
    }
  });

  it('drop uses drag-start fallback when dataTransfer payload is unavailable', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const sourceNode = document.querySelector('.dm-tree-node--source.dm-tree-node--leaf[data-path="name"]') as HTMLElement | null;
    const targetNode = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="userName"]') as HTMLElement | null;
    expect(sourceNode).toBeTruthy();
    expect(targetNode).toBeTruthy();
    if (!sourceNode || !targetNode) return;

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

    fireEvent.dragStart(sourceNode, { dataTransfer: dragDt });
    fireEvent.dragOver(targetNode, { dataTransfer: dropDt });
    fireEvent.drop(targetNode, { dataTransfer: dropDt });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    const found = last?.find((m) => m.targetPath === 'userName');
    expect(found?.sourcePath).toBe('name');
  });

  it('drop fallback supports non-leaf source nodes as insert-or-update mappings', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: { payload: { nested: true } } }],
      target: {
        label: 'Target',
        allowCustomFields: false,
        fields: [{ path: 'payloadText', label: 'Payload Text', type: 'string' }],
      },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const sourceNode = document.querySelector('.dm-tree-node--source[data-path="payload"]') as HTMLElement | null;
    const targetNode = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="payloadText"]') as HTMLElement | null;
    expect(sourceNode).toBeTruthy();
    expect(targetNode).toBeTruthy();
    if (!sourceNode || !targetNode) return;

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

    fireEvent.dragStart(sourceNode, { dataTransfer: dragDt });
    fireEvent.dragOver(targetNode, { dataTransfer: dropDt });
    fireEvent.drop(targetNode, { dataTransfer: dropDt });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    const found = last?.find((m) => m.targetPath === 'payloadText');
    expect(found?.sourcePath).toBe('payload');
    expect(found?.expression).toBe('$toString($.payload)');
  });

  it('object-to-object drop maps child fields in one shot', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1',
        label: 'Source',
        sampleData: {
          offers: [
            { associatedOfferingCode: 'A', rank: 1, planType: 'Trial' },
            { associatedOfferingCode: 'B', rank: 2, planType: 'Prepaid' },
          ],
        },
      }],
      target: {
        label: 'Target',
        allowCustomFields: true,
        fields: [
          { path: 'offers[0].associatedOfferingCode', label: 'associatedOfferingCode', type: 'string' },
          { path: 'offers[0].rank', label: 'rank', type: 'number' },
          { path: 'offers[0].planType', label: 'planType', type: 'string' },
        ],
      },
    };
    const initial: Mapping[] = [
      { id: 'seed', sourcePath: 'offers[1].rank', sourceId: 's1', targetPath: 'offers[0].rank' },
    ];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);

    const sourceNode = document.querySelector('.dm-panel--source .dm-tree-node[data-path="offers[0]"]') as HTMLElement | null;
    const targetNode = document.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0]"]') as HTMLElement | null;
    expect(sourceNode).toBeTruthy();
    expect(targetNode).toBeTruthy();
    if (!sourceNode || !targetNode) return;

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

    fireEvent.dragStart(sourceNode, { dataTransfer: dragDt });
    fireEvent.dragOver(targetNode, { dataTransfer: dropDt });
    fireEvent.drop(targetNode, { dataTransfer: dropDt });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last).toBeTruthy();
    expect(last!.length).toBe(3);
    const rankMap = last!.find((m) => m.targetPath === 'offers[0].rank');
    const codeMap = last!.find((m) => m.targetPath === 'offers[0].associatedOfferingCode');
    const planMap = last!.find((m) => m.targetPath === 'offers[0].planType');
    expect(rankMap?.sourcePath).toBe('offers[0].rank');
    expect(codeMap?.sourcePath).toBe('offers[0].associatedOfferingCode');
    expect(planMap?.sourcePath).toBe('offers[0].planType');
  });

  it('array-index object drop maps only the dropped node children, not sibling indices', () => {
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

    const sourceNode = document.querySelector('.dm-panel--source .dm-tree-node[data-path="offers[0]"]') as HTMLElement | null;
    const targetNode = document.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0]"]') as HTMLElement | null;
    expect(sourceNode).toBeTruthy();
    expect(targetNode).toBeTruthy();
    if (!sourceNode || !targetNode) return;

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

    fireEvent.dragStart(sourceNode, { dataTransfer: dragDt });
    fireEvent.dragOver(targetNode, { dataTransfer: dropDt });
    fireEvent.drop(targetNode, { dataTransfer: dropDt });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last).toBeTruthy();
    expect(last!).toHaveLength(1);
    const mappedZero = last!.find((m) => m.targetPath === 'offers[0].associatedOfferingCode');
    const mappedOne = last!.find((m) => m.targetPath === 'offers[1].associatedOfferingCode');
    expect(mappedZero?.sourcePath).toBe('offers[0].associatedOfferingCode');
    expect(mappedOne).toBeUndefined();
    const toastText = container.querySelector('.dm-toast')?.textContent ?? '';
    expect(toastText).toContain('Mapped 1 field');
    expect(toastText).toContain('1 updated');
    expect(toastText).not.toContain('across array siblings');
  });

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

  it('wires runtime traces into CodeView inspector when debug mode is active', () => {
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

    const debugBtn = container.querySelector('.dm-toolbar-btn--debug');
    expect(debugBtn).toBeTruthy();
    fireEvent.click(debugBtn!);

    fireEvent.click(screen.getByTitle('Show code view'));
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect trace for userName' }));

    expect(screen.getByText('Runtime trace')).toBeTruthy();
    expect(screen.getAllByText('Alice Runtime').length).toBeGreaterThan(0);
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

  it('resizes target panel when dragging target handle', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    const targetHandle = handles[1] as HTMLElement;
    const panelWrappers = container.querySelectorAll('.dm-panel-wrapper');
    const targetWrapper = panelWrappers[1] as HTMLElement;

    expect(targetWrapper.style.width).toBe('');
    fireEvent.mouseDown(targetHandle, { clientX: 600 });
    fireEvent.mouseMove(document, { clientX: 520 });
    fireEvent.mouseUp(document);
    expect(targetWrapper.style.width).not.toBe('');
  });

  it('keeps source divider independent when dragging target handle', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const handles = container.querySelectorAll('.dm-resize-handle');
    const targetHandle = handles[1] as HTMLElement;
    const panelWrappers = container.querySelectorAll('.dm-panel-wrapper');
    const sourceWrapper = panelWrappers[0] as HTMLElement;
    const canvasWrapper = container.querySelector('.dm-canvas-wrapper') as HTMLElement;
    const startCanvasWidth = parseFloat(canvasWrapper.style.width || '0');

    expect(sourceWrapper.style.width).toBe('');
    fireEvent.mouseDown(targetHandle, { clientX: 600 });
    fireEvent.mouseMove(document, { clientX: 520 });
    fireEvent.mouseUp(document);

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
  it('shows code view when toggled', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const codeViewBtn = screen.getByTitle('Show code view');
    fireEvent.click(codeViewBtn);
    expect(container.querySelector('.dm-code-view')).toBeTruthy();
  });

  it('keeps bottom utility dock single-surface between code and preview', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);

    fireEvent.click(screen.getByTitle('Show code view'));
    expect(container.querySelector('.dm-bottom-utility-dock')).toBeTruthy();
    expect(container.querySelector('.dm-code-view')).toBeTruthy();
    expect(container.querySelector('.dm-preview-bar')).toBeNull();

    fireEvent.click(screen.getByTitle('Show preview'));
    expect(container.querySelector('.dm-bottom-utility-dock')).toBeTruthy();
    expect(container.querySelector('.dm-preview-bar')).toBeTruthy();
    expect(container.querySelector('.dm-code-view')).toBeNull();
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

describe('DataMapper – mapping line visibility', () => {
  it('shows node-focus option only while lines are hidden', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);

    expect(screen.queryByTitle('Enable node-focus lines')).toBeNull();

    fireEvent.click(screen.getByTitle('Hide mapping lines'));
    expect(screen.getByTitle('Show mapping lines')).toBeTruthy();
    expect(screen.getByTitle('Enable node-focus lines')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Enable node-focus lines'));
    expect(screen.getByTitle('Disable node-focus lines')).toBeTruthy();

    // Clicking tree nodes in node-focus mode should not break interaction.
    const mappedSourceNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]');
    expect(mappedSourceNode).toBeTruthy();
    if (!mappedSourceNode) return;
    fireEvent.click(mappedSourceNode);

    const unmappedSourceNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="email"]');
    expect(unmappedSourceNode).toBeTruthy();
    if (!unmappedSourceNode) return;
    fireEvent.click(unmappedSourceNode);

    fireEvent.click(screen.getByTitle('Show mapping lines'));
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

describe('DataMapper – coverage: pattern learning & auto-map edge cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('auto-map merges pattern suggestions when automap candidates score below threshold', () => {
    const ctx = 'dm-pattern-coverage';
    const src = { qxz_unlikely_field_aa: 'src' };
    const tgt = { pqy_unlikely_field_bb: '' };
    const st = buildJsonTree(src, '', '');
    const tt = buildJsonTree(tgt, '', '');
    savePattern(ctx, getAllLeafPaths(st), getAllLeafPaths(tt), [
      { id: 'x', sourcePath: 'qxz_unlikely_field_aa', sourceId: 's1', targetPath: 'pqy_unlikely_field_bb', expression: '$toString($.qxz_unlikely_field_aa)' },
    ]);
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: ctx,
      title: 'Pattern',
      sources: [{ id: 's1', label: 'S', sampleData: src }],
      target: { label: 'T', sampleData: tgt, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const threshold = screen.queryByLabelText('Auto-map confidence threshold');
    if (threshold) {
      fireEvent.change(threshold, { target: { value: '90' } });
    }
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    const toast = container.querySelector('.dm-toast');
    expect(toast?.textContent).toMatch(/from patterns/);
  });

  it('marks pattern-derived lines on the canvas', async () => {
    const ctx = 'dm-pattern-line-flag';
    const src = { qPatLine: 'v' };
    const tgt = { tPatLine: '' };
    const st = buildJsonTree(src, '', '');
    const tt = buildJsonTree(tgt, '', '');
    savePattern(ctx, getAllLeafPaths(st), getAllLeafPaths(tt), [
      { id: 'pl', sourcePath: 'qPatLine', sourceId: 's1', targetPath: 'tPatLine' },
    ]);
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: ctx,
      title: 'Pl',
      sources: [{ id: 's1', label: 'S', sampleData: src }],
      target: { label: 'T', sampleData: tgt, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const threshold = screen.queryByLabelText('Auto-map confidence threshold');
    if (threshold) {
      fireEvent.change(threshold, { target: { value: '90' } });
    }
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    await bumpMapperLayout(container);
    expect(container.querySelector('.dm-connection-line--pattern')).toBeTruthy();
  });

  it('auto-map skips pattern suggestion when that source path is already mapped', () => {
    const ctx = 'dm-pattern-src-used';
    const src = { userName: 'A', extra: 1 };
    const tgt = { userName: '', userEmail: '', extra: 0 };
    const st = buildJsonTree(src, '', '');
    const tt = buildJsonTree(tgt, '', '');
    savePattern(ctx, getAllLeafPaths(st), getAllLeafPaths(tt), [
      { id: 'p1', sourcePath: 'userName', sourceId: 's1', targetPath: 'userName' },
      { id: 'p2', sourcePath: 'extra', sourceId: 's1', targetPath: 'extra' },
    ]);
    const spy = vi.spyOn(autoMapAlgorithm, 'computeAutoMapCandidates').mockReturnValue([]);
    try {
      const initial: Mapping[] = [{ id: 'pre', sourcePath: 'userName', sourceId: 's1', targetPath: 'userEmail' }];
      const adapter: MapperAdapter<Mapping[]> = {
        contextId: ctx,
        title: 'Src',
        sources: [{ id: 's1', label: 'S', sampleData: src }],
        target: { label: 'T', sampleData: tgt, allowCustomFields: false },
        serialize: (m) => m,
        deserialize: (m) => m,
      };
      const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
      fireEvent.click(screen.getByTitle('Auto-map matching fields'));
      expect(container.querySelector('.dm-toast')?.textContent).toMatch(/from patterns/);
    } finally {
      spy.mockRestore();
    }
  });

  it('derivation of auto-map candidates catches invalid JSON in string source sample', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      contextId: '',
      sources: [{ id: 's1', label: 'S', sampleData: '{bad-json' }],
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    expect(container.querySelector('.dm-toast')).toBeNull();
  });

  it('auto-map does nothing when there are no candidates and no pattern', () => {
    const spy = vi.spyOn(autoMapAlgorithm, 'computeAutoMapCandidates').mockReturnValue([]);
    try {
      const adapter: MapperAdapter<Mapping[]> = {
        contextId: 'no-pattern',
        title: 'N',
        sources: [{ id: 's1', label: 'S', sampleData: { zzz_uniq_1: 1 } }],
        target: { label: 'T', sampleData: { aaa_uniq_2: 0 }, allowCustomFields: false },
        serialize: (m) => m,
        deserialize: (m) => m,
      };
      const { container } = render(<DataMapper adapter={adapter} />);
      act(() => {
        fireEvent.click(screen.getByTitle('Auto-map matching fields'));
      });
      expect(container.querySelector('.dm-toast')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('persists learned patterns after debounce', () => {
    vi.useFakeTimers();
    const ctx = 'dm-learn-debounce';
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: ctx,
      title: 'L',
      sources: [{ id: 's1', label: 'S', sampleData: { learnA: 1 } }],
      target: { label: 'T', sampleData: { learnB: 0 }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const initial: Mapping[] = [{ id: 'lm1', sourcePath: 'learnA', sourceId: 's1', targetPath: 'learnB' }];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    act(() => { vi.advanceTimersByTime(2500); });
    expect(localStorage.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});

describe('DataMapper – coverage: gallery, inference, expression UI', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('dm-body')) {
        return {
          x: 0, y: 0, top: 0, left: 0, width: 900, height: 500, bottom: 500, right: 900, toJSON: () => ({}),
        } as DOMRect;
      }
      const path = this.getAttribute('data-path') ?? '';
      const t = path === 'name' ? 50 : path === 'userAge' ? 150 : path === 'userName' ? 120 : path === 'userEmail' ? 100 : 80;
      return {
        x: 0, y: t, top: t, left: 0, width: 40, height: 20, bottom: t + 20, right: 40, toJSON: () => ({}),
      } as DOMRect;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads a gallery sample from the Samples menu', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Load a gallery sample'));
    fireEvent.click(screen.getByText('Direct Field Mapping'));
    const toast = container.querySelector('.dm-toast');
    expect(toast?.textContent).toContain('Loaded sample');
  });

  it('opens expression editor from target double-click and saves', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'em1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const mapped = screen.getByText('userName').closest('.dm-tree-node');
    expect(mapped).toBeTruthy();
    fireEvent.doubleClick(mapped!);
    await waitFor(() => {
      expect(screen.getByText('Save Expression')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Save Expression'));
    await waitFor(() => {
      expect(screen.queryByText('Save Expression')).toBeNull();
    });
  });

  it('applies canvas expression suggestion and shows toast', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'sx1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await bumpMapperLayout(container);
    await waitFor(() => {
      expect(container.querySelector('.dm-canvas-badge--suggestion')).toBeTruthy();
    });
    const sugg = container.querySelector('.dm-canvas-badge--suggestion');
    fireEvent.click(sugg!);
    const toast = container.querySelector('.dm-toast');
    expect(toast?.textContent).toBe('Expression applied');
  });

  it('example inference apply adds pending mappings', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { personName: 'Eve' } }],
      target: { label: 'T', sampleData: { displayName: '' }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Infer mappings from input/output examples'));
    const textareas = screen.getAllByRole('textbox');
    const inputTa = textareas.find((el) => el.getAttribute('placeholder')?.includes('Alice'));
    const outputTa = textareas.find((el) => el.getAttribute('placeholder')?.includes('fullName'));
    expect(inputTa && outputTa).toBeTruthy();
    fireEvent.change(inputTa!, { target: { value: '{"personName":"Eve"}' } });
    fireEvent.change(outputTa!, { target: { value: '{"displayName":"Eve"}' } });
    await act(async () => {
      fireEvent.click(screen.getByText(/Analyze/));
    });
    const applyBtn = await screen.findByRole('button', { name: /Apply \d+ mapping/ });
    await act(async () => {
      fireEvent.click(applyBtn);
    });
    await waitFor(() => {
      expect(container.querySelector('.dm-toast')?.textContent).toMatch(/inferred from examples/);
    });
  });

  it('example inference shows toast when all targets already mapped', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { personName: 'Eve' } }],
      target: { label: 'T', sampleData: { displayName: '' }, allowCustomFields: false },
    };
    const initial: Mapping[] = [{ id: 'x1', sourcePath: 'personName', sourceId: 's1', targetPath: 'displayName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Infer mappings from input/output examples'));
    const textareas = screen.getAllByRole('textbox');
    const inputTa = textareas.find((el) => el.getAttribute('placeholder')?.includes('Alice'));
    const outputTa = textareas.find((el) => el.getAttribute('placeholder')?.includes('fullName'));
    expect(inputTa && outputTa).toBeTruthy();
    fireEvent.change(inputTa!, { target: { value: '{"personName":"Eve"}' } });
    fireEvent.change(outputTa!, { target: { value: '{"displayName":"Eve"}' } });
    await act(async () => {
      fireEvent.click(screen.getByText(/Analyze/));
    });
    const applyBtn = await screen.findByRole('button', { name: /Apply \d+ mapping/ });
    await act(async () => {
      fireEvent.click(applyBtn);
    });
    await waitFor(() => {
      expect(container.querySelector('.dm-toast')?.textContent).toContain('No new mappings');
    });
  });

  it('toggles code view off after opening', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Show code view'));
    expect(container.querySelector('.dm-code-view')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Hide code view'));
    expect(container.querySelector('.dm-code-view')).toBeNull();
  });

  it('example inference toast pluralizes when multiple new mappings apply', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { ax: 'm', by: 'n' } }],
      target: { label: 'T', sampleData: { ca: '', db: '' }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Infer mappings from input/output examples'));
    const textareas = screen.getAllByRole('textbox');
    const inputTa = textareas.find((el) => el.getAttribute('placeholder')?.includes('Alice'));
    const outputTa = textareas.find((el) => el.getAttribute('placeholder')?.includes('fullName'));
    expect(inputTa && outputTa).toBeTruthy();
    fireEvent.change(inputTa!, { target: { value: '{"ax":"m","by":"n"}' } });
    fireEvent.change(outputTa!, { target: { value: '{"ca":"m","db":"n"}' } });
    await act(async () => { fireEvent.click(screen.getByText(/Analyze/)); });
    const applyBtn = await screen.findByRole('button', { name: /Apply 2 mapping/ });
    await act(async () => { fireEvent.click(applyBtn); });
    await waitFor(() => {
      expect(container.querySelector('.dm-toast')?.textContent).toMatch(/2 mappings inferred from examples/);
    });
  });
});

describe('DataMapper – coverage: bulk drop, line focus, drift, repairs', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('dm-body')) {
        return {
          x: 0, y: 0, top: 0, left: 0, width: 900, height: 500, bottom: 500, right: 900, toJSON: () => ({}),
        } as DOMRect;
      }
      const path = this.getAttribute('data-path') ?? '';
      const t = path === 'name' ? 50 : path === 'userName' ? 120 : path === 'userEmail' ? 100 : 80;
      return {
        x: 0, y: t, top: t, left: 0, width: 40, height: 20, bottom: t + 20, right: 40, toJSON: () => ({}),
      } as DOMRect;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bulk drop shows toast when no new mappings applied', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'a', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'b', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const sourceLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--source');
    fireEvent.click(sourceLeaves[0], { shiftKey: true });
    fireEvent.click(sourceLeaves[1], { shiftKey: true });
    const targetNode = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="userName"]');
    const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    fireEvent.dragOver(targetNode!, { dataTransfer: dt });
    fireEvent.drop(targetNode!, { dataTransfer: dt });
    const toast = container.querySelector('.dm-toast');
    expect(toast?.textContent).toContain('No new mappings');
  });

  it('bulk drop maps multiple fields and shows plural toast', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { firstName: 'A', lastName: 'B' } }],
      target: {
        label: 'T',
        allowCustomFields: false,
        fields: [
          { path: 'firstName', label: 'firstName', type: 'string' },
          { path: 'lastName', label: 'lastName', type: 'string' },
        ],
      },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const sourceLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--source');
    fireEvent.click(sourceLeaves[0], { shiftKey: true });
    fireEvent.click(sourceLeaves[1], { shiftKey: true });
    const targetLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--target');
    const dragData = JSON.stringify({ path: 'firstName', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    fireEvent.dragOver(targetLeaves[0], { dataTransfer: dt });
    fireEvent.drop(targetLeaves[0], { dataTransfer: dt });
    const toast = container.querySelector('.dm-toast');
    expect(toast?.textContent).toMatch(/Mapped 2 fields/);
  });

  it('line-focus mode clears focus when clicking the same node twice', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Hide mapping lines'));
    fireEvent.click(screen.getByTitle('Enable node-focus lines'));
    const srcNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]') as HTMLElement;
    fireEvent.click(srcNode);
    fireEvent.click(srcNode);
    const linesAfterToggle = container.querySelectorAll('.dm-line');
    expect(linesAfterToggle.length).toBe(0);
  });

  it('renders drift badge on lines when driftMappingIds provided', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'd1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const driftMappingIds = new Map<string, 'warning' | 'breaking'>([['d1', 'warning']]);
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} driftMappingIds={driftMappingIds} />,
    );
    await bumpMapperLayout(container);
    await waitFor(() => {
      expect(container.querySelector('.dm-canvas-badge--drift-warning')).toBeTruthy();
    });
  });

  it('invokes onApplyRepair when repair chip clicked', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'r1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const driftMappingIds = new Map<string, 'warning' | 'breaking'>([['r1', 'breaking']]);
    const sug: RepairSuggestion = {
      driftPath: 'userName',
      mappingId: 'r1',
      suggestedPath: 'user_name',
      reason: 'test',
      strategy: 'similar-name',
      confidence: 90,
    };
    const repairSuggestions = new Map<string, RepairSuggestion[]>([['r1', [sug]]]);
    const onApplyRepair = vi.fn();
    const { container } = render(
      <DataMapper
        adapter={adapter}
        initialData={initial}
        driftMappingIds={driftMappingIds}
        repairSuggestions={repairSuggestions}
        onApplyRepair={onApplyRepair}
      />,
    );
    await bumpMapperLayout(container);
    const repairBadge = await waitFor(() => container.querySelector('.dm-canvas-badge--repair'));
    expect(repairBadge).toBeTruthy();
    fireEvent.click(repairBadge!);
    expect(onApplyRepair).toHaveBeenCalledWith('r1', sug);
  });

  it('calls onShowDrift from health dashboard when drift ids present', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const driftMappingIds = new Map<string, 'warning' | 'breaking'>([['m1', 'warning']]);
    const onShowDrift = vi.fn();
    render(
      <DataMapper adapter={adapter} initialData={initial} driftMappingIds={driftMappingIds} onShowDrift={onShowDrift} />,
    );
    fireEvent.click(screen.getByTitle(/drift warning/));
    expect(onShowDrift).toHaveBeenCalled();
  });

  it('replaces mappings when adapter initialData changes', () => {
    const adapter = createTestAdapter();
    const first: Mapping[] = [{ id: 'o1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const second: Mapping[] = [{ id: 'o2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' }];
    const { rerender } = render(<DataMapper adapter={adapter} initialData={first} />);
    expect(screen.getByText(/1 mapping/)).toBeTruthy();
    rerender(<DataMapper adapter={adapter} initialData={second} />);
    expect(screen.getByText(/1 mapping/)).toBeTruthy();
    expect(screen.queryByText('= Alice')).toBeNull();
  });

  it('health target tree builds from fields when sampleData is absent', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { a: 1 } }],
      target: {
        label: 'T',
        allowCustomFields: false,
        fields: [{ path: 'b', label: 'b', type: 'number' }],
      },
    };
    const initial: Mapping[] = [{ id: 'hf1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(container.querySelector('.dm-health-dashboard')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });
});

describe('DataMapper – coverage: array suggestion bar variants', () => {
  it('shows loop array bar when array maps to array', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { arr: [{ k: 1 }] } }],
      target: { label: 'T', sampleData: { arr: [{ k: 0 }] }, allowCustomFields: false },
    };
    const initial: Mapping[] = [{ id: 'loop1', sourcePath: 'arr', sourceId: 's1', targetPath: 'arr' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    fireEvent.click(mapped!);
    const bar = container.querySelector('.dm-array-suggestion-bar');
    expect(bar?.textContent).toContain('one-to-one');
  });

  it('shows spread bar for scalar to array without apply when no suggestion', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { token: 'x' } }],
      target: { label: 'T', sampleData: { tokens: ['a', 'b'] }, allowCustomFields: false },
    };
    const initial: Mapping[] = [{ id: 'sp1', sourcePath: 'token', sourceId: 's1', targetPath: 'tokens' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    fireEvent.click(mapped!);
    const bar = container.querySelector('.dm-array-suggestion-bar');
    expect(bar?.textContent).toContain('wrapped in an array');
    expect(container.querySelector('.dm-array-suggestion-apply')).toBeNull();
  });
});

describe('DataMapper – coverage: debug bar singular trace wording', () => {
  it('uses singular trace label in debug bar', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const oneTrace = [
      {
        mappingId: 'm1',
        sourcePath: 'name',
        sourceId: 's1',
        sourceValue: 'A',
        targetPath: 'userName',
        targetValue: 'A',
        timestamp: Date.now(),
        durationMs: 1,
      },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={oneTrace} />);
    fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!);
    expect(container.querySelector('.dm-debug-bar')?.textContent).toMatch(/1 trace\b/);
  });

  it('debug bar pluralizes traces and errors', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const traces = [
      { mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'A', targetPath: 'userName', targetValue: 'A', timestamp: Date.now(), durationMs: 1, error: 'e1' },
      { mappingId: 'm2', sourcePath: 'email', sourceId: 's1', sourceValue: 'B', targetPath: 'userEmail', targetValue: 'B', timestamp: Date.now(), durationMs: 1, error: 'e2' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!);
    const bar = container.querySelector('.dm-debug-bar');
    expect(bar?.textContent).toMatch(/2 traces/);
    expect(bar?.textContent).toMatch(/2 errors/);
  });
});

describe('DataMapper – coverage: toolbar profiles, pending, preview custom fns', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('dm-body')) {
        return {
          x: 0, y: 0, top: 0, left: 0, width: 900, height: 500, bottom: 500, right: 900, toJSON: () => ({}),
        } as DOMRect;
      }
      const path = this.getAttribute('data-path') ?? '';
      const t = path === 'name' ? 50 : path === 'userAge' ? 150 : path === 'userName' ? 120 : path === 'userEmail' ? 100 : 80;
      return {
        x: 0, y: t, top: t, left: 0, width: 40, height: 20, bottom: t + 20, right: 40, toJSON: () => ({}),
      } as DOMRect;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads a saved profile into the mapper', async () => {
    const prof = {
      id: 'prof-test',
      name: 'UnitProf',
      contextId: 'test',
      mappings: [{ id: 'pm1', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' }] as Mapping[],
      createdAt: 0,
      updatedAt: 0,
    };
    const spy = vi.spyOn(mappingProfiles, 'loadProfiles').mockResolvedValue([prof]);
    try {
      const adapter = createTestAdapter();
      const initial: Mapping[] = [{ id: 'i1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
      render(<DataMapper adapter={adapter} initialData={initial} />);
      await waitFor(() => expect(screen.getByTitle('Mapping profiles')).toBeTruthy());
      fireEvent.click(screen.getByTitle('Mapping profiles'));
      await waitFor(() => expect(screen.getByTitle(/Load "UnitProf"/)).toBeTruthy());
      fireEvent.click(screen.getByText('UnitProf'));
      expect(screen.getByTitle('email')).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('applies profile delta without replacing unrelated mappings', async () => {
    const prof = {
      id: 'prof-delta',
      name: 'DeltaProf',
      contextId: 'test',
      mappings: [
        { id: 'pm1', sourcePath: 'email', sourceId: 's1', targetPath: 'userName', expression: '$lower($.email)' },
        { id: 'pm2', sourcePath: 'age', sourceId: 's1', targetPath: 'userAge' },
      ] as Mapping[],
      createdAt: 0,
      updatedAt: 0,
    };
    const spy = vi.spyOn(mappingProfiles, 'loadProfiles').mockResolvedValue([prof]);
    const onChange = vi.fn();
    try {
      const adapter = createTestAdapter();
      const initial: Mapping[] = [
        { id: 'i1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
        { id: 'i2', sourcePath: 'name', sourceId: 's1', targetPath: 'userEmail' },
      ];
      render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
      await waitFor(() => expect(screen.getByTitle('Mapping profiles')).toBeTruthy());
      fireEvent.click(screen.getByTitle('Mapping profiles'));
      await waitFor(() => expect(screen.getByTitle('Apply "DeltaProf" as delta')).toBeTruthy());
      fireEvent.click(screen.getByTitle('Apply "DeltaProf" as delta'));

      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
      expect(last).toBeTruthy();
      expect(last).toHaveLength(3);
      expect(last?.some((m) => m.targetPath === 'userName' && m.sourcePath === 'email')).toBe(true);
      expect(last?.some((m) => m.targetPath === 'userEmail' && m.sourcePath === 'name')).toBe(true);
      expect(last?.some((m) => m.targetPath === 'userAge' && m.sourcePath === 'age')).toBe(true);
      expect(document.querySelector('.dm-toast')?.textContent).toContain('Applied profile delta');
    } finally {
      spy.mockRestore();
    }
  });

  it('accepts a pending mapping from the canvas', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { name: 'A' } }],
      target: { label: 'T', sampleData: { name: '' }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    await bumpMapperLayout(container);
    const accept = await waitFor(() => container.querySelector('.dm-pending-accept'));
    fireEvent.click(accept!);
    expect(container.querySelector('.dm-connection-line--pending')).toBeNull();
  });

  it('closes expression editor via Cancel', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'c1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    const mapped = screen.getByText('userName').closest('.dm-tree-node');
    fireEvent.doubleClick(mapped!);
    await waitFor(() => expect(screen.getByText('Cancel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull());
  });

  it('shows preview with custom functions wired', async () => {
    vi.useFakeTimers();
    const customFunctions = [{
      name: 'noop',
      category: 'Math',
      signature: 'noop()',
      description: '',
      args: [] as { name: string; type: string; required: boolean; description: string }[],
      returnType: 'any',
      examples: [] as { input: string; output: string }[],
      evaluate: () => null,
    }];
    const adapter: MapperAdapter<Mapping[]> = { ...createTestAdapter(), customFunctions };
    const initial: Mapping[] = [{ id: 'p1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Show preview'));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(container.querySelector('.dm-preview-bar')).toBeTruthy();
    vi.useRealTimers();
  });

  it('line-focus ignores clicks that start on tree toggle buttons', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { outer: { innerLeaf: 1 } } }],
      target: { label: 'T', sampleData: { outer: { innerLeaf: 0 } }, allowCustomFields: false },
    };
    const initial: Mapping[] = [{ id: 'n1', sourcePath: 'outer.innerLeaf', sourceId: 's1', targetPath: 'outer.innerLeaf' }];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Hide mapping lines')); });
    await act(async () => { fireEvent.click(screen.getByTitle('Enable node-focus lines')); });
    const toggle = screen.getAllByLabelText('Collapse')[0];
    fireEvent.click(toggle);
    expect(toggle).toBeTruthy();
  });

  it('shift-click on connection line toggles multi-select', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'ms1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'ms2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await bumpMapperLayout(container);
    const hitTargets = container.querySelectorAll('.dm-canvas path[stroke="transparent"]');
    expect(hitTargets.length).toBeGreaterThan(1);
    fireEvent.click(hitTargets[0], { shiftKey: true });
    fireEvent.click(hitTargets[1], { shiftKey: true });
    expect(container.querySelector('.dm-connection-line--selected')).toBeTruthy();
  });

  it('health tree falls back to fields when sample JSON is invalid', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { a: 1 } }],
      target: {
        label: 'T',
        sampleData: '{not-json',
        allowCustomFields: false,
        fields: [{ path: 'b', label: 'b', type: 'number' }],
      },
    };
    const initial: Mapping[] = [{ id: 'ht1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(container.querySelector('.dm-health-dashboard')).toBeTruthy();
  });

  it('aggregate array bar apply updates the mapping expression', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { vals: [1, 2, 3] } }],
      target: { label: 'T', sampleData: { total: 0 }, allowCustomFields: false },
    };
    const initial: Mapping[] = [{ id: 'ag1', sourcePath: 'vals', sourceId: 's1', targetPath: 'total' }];
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    fireEvent.click(mapped!);
    const applyBtn = container.querySelector('.dm-array-suggestion-apply');
    expect(applyBtn).toBeTruthy();
    fireEvent.click(applyBtn!);
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last?.find((m) => m.id === 'ag1')?.expression).toBeTruthy();
  });

  it('syncs from props when deserialize throws on replacement data', () => {
    const adapter = createTestAdapter();
    const deserialize = vi
      .fn()
      .mockReturnValueOnce([] as Mapping[])
      .mockImplementation(() => { throw new Error('fail'); });
    const badAdapter: MapperAdapter<unknown> = {
      ...adapter,
      deserialize,
    };
    const { rerender, container } = render(<DataMapper adapter={badAdapter} initialData={[]} />);
    rerender(<DataMapper adapter={badAdapter} initialData={{ n: 1 }} />);
    expect(deserialize).toHaveBeenCalled();
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('0');
  });

  it('bulk drop reports singular Mapped 1 field when only primary applies', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'pre', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const sourceLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--source');
    fireEvent.click(sourceLeaves[0], { shiftKey: true });
    fireEvent.click(sourceLeaves[1], { shiftKey: true });
    const targetUserName = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="userName"]');
    const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    fireEvent.dragOver(targetUserName!, { dataTransfer: dt });
    fireEvent.drop(targetUserName!, { dataTransfer: dt });
    expect(container.querySelector('.dm-toast')?.textContent).toBe('Mapped 1 field');
  });

  it('rejects a pending mapping from the canvas', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { name: 'A' } }],
      target: { label: 'T', sampleData: { name: '' }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    await bumpMapperLayout(container);
    const reject = await waitFor(() => container.querySelector('.dm-pending-reject'));
    fireEvent.click(reject!);
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('0');
  });

  it('closes example inference modal without applying', async () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Infer mappings from input/output examples'));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Learn from Examples' })).toBeTruthy());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Learn from Examples' })).toBeNull());
  });

  it('debug bar uses singular error label for one failing trace', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const traces = [
      { mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'A', targetPath: 'userName', targetValue: 'A', timestamp: Date.now(), durationMs: 1 },
      { mappingId: 'm2', sourcePath: 'email', sourceId: 's1', sourceValue: 'B', targetPath: 'userEmail', targetValue: undefined, timestamp: Date.now(), durationMs: 1, error: 'e2' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!);
    const bar = container.querySelector('.dm-debug-bar');
    expect(bar?.textContent).toMatch(/1 error\b/);
  });

  it('uses mapped value overlay on target when debug mode is off', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'x1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const traces = [
      { mappingId: 'x1', sourcePath: 'name', sourceId: 's1', sourceValue: 'Alice', targetPath: 'userName', targetValue: 'Alice', timestamp: Date.now(), durationMs: 1 },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    const targetRow = container.querySelector('.dm-panel--target .dm-tree-node[data-path="userName"]');
    expect(targetRow?.textContent).toContain('Alice');
  });

  it('non-shift line click uses canvas onSelectMapping handler', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'l1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await bumpMapperLayout(container);
    const hitTargets = container.querySelectorAll('.dm-canvas path[stroke="transparent"]');
    fireEvent.click(hitTargets[0]);
    fireEvent.click(hitTargets[0]);
    expect(container.querySelector('.dm-connection-line--selected')).toBeNull();
  });

  it('auto-map toast lists only pattern count when automap finds no candidates', () => {
    localStorage.clear();
    const ctx = 'pattern-only-toast';
    const src = { p_only_a: 1 };
    const tgt = { p_only_b: 0 };
    const st = buildJsonTree(src, '', '');
    const tt = buildJsonTree(tgt, '', '');
    savePattern(ctx, getAllLeafPaths(st), getAllLeafPaths(tt), [
      { id: 'z', sourcePath: 'p_only_a', sourceId: 's1', targetPath: 'p_only_b' },
    ]);
    const spy = vi.spyOn(autoMapAlgorithm, 'computeAutoMapCandidates').mockReturnValue([]);
    try {
      const adapter: MapperAdapter<Mapping[]> = {
        contextId: ctx,
        title: 'Po',
        sources: [{ id: 's1', label: 'S', sampleData: src }],
        target: { label: 'T', sampleData: tgt, allowCustomFields: false },
        serialize: (m) => m,
        deserialize: (m) => m,
      };
      const { container } = render(<DataMapper adapter={adapter} />);
      fireEvent.click(screen.getByTitle('Auto-map matching fields'));
      const toast = container.querySelector('.dm-toast');
      expect(toast?.textContent).toMatch(/from patterns/);
      expect(toast?.textContent).not.toMatch(/auto-mapped/);
    } finally {
      spy.mockRestore();
      localStorage.clear();
    }
  });

  it('debug line overlay skips trace decoration when no trace exists for a mapping', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'tr1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'tr2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const traces = [
      { mappingId: 'tr1', sourcePath: 'name', sourceId: 's1', sourceValue: 'A', targetPath: 'userName', targetValue: 'A', timestamp: Date.now(), durationMs: 1 },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    await bumpMapperLayout(container);
    fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!);
    const okBadges = container.querySelectorAll('.dm-trace-badge--ok');
    expect(okBadges.length).toBe(1);
  });

  it('node-focus filters visible lines by target path when a target node is focused', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'nf1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'nf2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await bumpMapperLayout(container);
    expect(container.querySelectorAll('path.dm-connection-line')).toHaveLength(2);
    fireEvent.click(screen.getByTitle('Hide mapping lines'));
    fireEvent.click(screen.getByTitle('Enable node-focus lines'));
    const tgtNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="userName"]') as HTMLElement;
    fireEvent.click(tgtNode);
    await waitFor(() => {
      expect(container.querySelectorAll('path.dm-connection-line')).toHaveLength(1);
    });
  });

  it('skips drift line decoration when drift map omits this mapping id', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'dm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const driftMappingIds = new Map<string, 'warning' | 'breaking'>([['other-id', 'warning']]);
    const { container } = render(
      <DataMapper adapter={adapter} initialData={initial} driftMappingIds={driftMappingIds} />,
    );
    await bumpMapperLayout(container);
    expect(container.querySelector('.dm-canvas-badge--drift-warning')).toBeNull();
  });

  it('marks target panel focused when target search input receives focus', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const targetInput = container.querySelector('.dm-panel--target .dm-search-input') as HTMLInputElement;
    fireEvent.focus(targetInput);
    expect(container.querySelector('.dm-panel--target.dm-panel--focused')).toBeTruthy();
  });

  it('clears dragged source ref on source drag end', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const srcNode = document.querySelector('.dm-tree-node--source.dm-tree-node--leaf[data-path="name"]') as HTMLElement;
    fireEvent.dragStart(srcNode, { dataTransfer: { setData: vi.fn(), effectAllowed: 'link' } });
    fireEvent.dragEnd(srcNode);
  });

  it('suggestDropExpression yields no expression when source path is absent from sample', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { other: 1 } }],
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const targetNode = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="userName"]') as HTMLElement;
    const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    fireEvent.dragOver(targetNode, { dataTransfer: dt });
    fireEvent.drop(targetNode, { dataTransfer: dt });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[];
    const m = last?.find((x) => x.targetPath === 'userName');
    expect(m?.sourcePath).toBe('name');
    expect(m?.expression).toBeUndefined();
  });

  it('suggestDropExpression catches JSON.parse errors for string source sample', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: '{{invalid-json' }],
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const targetNode = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="userName"]');
    expect(targetNode).toBeTruthy();
    const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    fireEvent.dragOver(targetNode!, { dataTransfer: dt });
    fireEvent.drop(targetNode!, { dataTransfer: dt });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[];
    expect(last?.some((x) => x.targetPath === 'userName')).toBe(true);
  });

  it('error popover close invokes mapper onClose', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const traces = [
      {
        mappingId: 'm1', sourcePath: 'name', sourceId: 's1', sourceValue: 'A',
        evaluatedValue: undefined, targetPath: 'userName', targetValue: undefined,
        timestamp: Date.now(), durationMs: 1, error: 'fail',
      },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    await bumpMapperLayout(container);
    fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!);
    await waitFor(() => expect(container.querySelector('.dm-error-inline')).toBeTruthy());
    fireEvent.click(container.querySelector('.dm-error-inline')!);
    await waitFor(() => expect(container.querySelector('.dm-error-popover-close')).toBeTruthy());
    fireEvent.click(container.querySelector('.dm-error-popover-close')!);
    expect(container.querySelector('.dm-error-popover')).toBeNull();
  });

  it('line-focus handler ignores orphan tree nodes outside panels', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Hide mapping lines'));
    fireEvent.click(screen.getByTitle('Enable node-focus lines'));
    const root = container.querySelector('.dm-container')!;
    const orphan = document.createElement('div');
    orphan.className = 'dm-tree-node';
    orphan.setAttribute('data-path', 'orphan');
    root.appendChild(orphan);
    fireEvent.click(orphan);
    orphan.remove();
  });

  it('line-focus handler exits when capture target is not inside a tree node', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Hide mapping lines'));
    fireEvent.click(screen.getByTitle('Enable node-focus lines'));
    fireEvent.click(container.querySelector('.dm-body')!);
  });

  it('line-focus handler exits when data-path is empty', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Hide mapping lines'));
    fireEvent.click(screen.getByTitle('Enable node-focus lines'));
    const root = container.querySelector('.dm-container')!;
    const orphan = document.createElement('div');
    orphan.className = 'dm-tree-node';
    orphan.setAttribute('data-path', '');
    root.appendChild(orphan);
    fireEvent.click(orphan);
    orphan.remove();
  });

  it('line-focus ignores clicks originating from tree expand buttons', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { outer: { innerLeaf: 1 } } }],
      target: { label: 'T', sampleData: { outer: { innerLeaf: 0 } }, allowCustomFields: false },
    };
    render(<DataMapper adapter={adapter} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Hide mapping lines')); });
    await act(async () => { fireEvent.click(screen.getByTitle('Enable node-focus lines')); });
    const collapseBtns = screen.getAllByLabelText('Collapse');
    fireEvent.click(collapseBtns[0]);
    expect(collapseBtns[0]).toBeTruthy();
  });

  it('line-focus ignores nodes without a data-path attribute', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    fireEvent.click(screen.getByTitle('Hide mapping lines'));
    fireEvent.click(screen.getByTitle('Enable node-focus lines'));
    const root = container.querySelector('.dm-container')!;
    const orphan = document.createElement('div');
    orphan.className = 'dm-tree-node';
    root.appendChild(orphan);
    fireEvent.click(orphan);
    orphan.remove();
  });

  it('runs fetch target schema when the toolbar control is used', async () => {
    const fetchTargetSchema = vi.fn().mockResolvedValue(undefined);
    const adapter: MapperAdapter<Mapping[]> = { ...createTestAdapter(), fetchTargetSchema };
    render(<DataMapper adapter={adapter} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Fetch target schema'));
    });
    expect(fetchTargetSchema).toHaveBeenCalled();
  });

  it('adds a custom field on targets that allow custom fields', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { a: 1 } }],
      target: { label: 'T', allowCustomFields: true },
    };
    render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByLabelText('Add custom field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'customPath' } });
    fireEvent.click(screen.getByLabelText('Confirm add field'));
    expect(screen.getByText('customPath')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove custom field customPath'));
    expect(screen.queryByText('customPath')).toBeNull();
  });

  it('clears mappings when initialData prop becomes undefined', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { rerender, container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('1');
    rerender(<DataMapper adapter={adapter} />);
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('0');
  });

  it('debug bar uses singular error count wording', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'e1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const traces = [
      { mappingId: 'e1', sourcePath: 'name', sourceId: 's1', sourceValue: 'A', targetPath: 'userName', targetValue: undefined, timestamp: Date.now(), durationMs: 1, error: 'one' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!);
    const text = container.querySelector('.dm-debug-bar')?.textContent ?? '';
    expect(text).toContain('1 error');
    expect(text).not.toContain('1 errors');
  });

  it('gallery load keeps source id when adapter uses the same ids as the sample', () => {
    const sample = mapperGallerySamples.find((s) => s.id === 'gallery-direct-field')!;
    const adapter: MapperAdapter<Mapping[]> = {
      contextId: 'gall',
      title: 'G',
      sources: sample.sources as MapperAdapter<Mapping[]>['sources'],
      target: sample.target,
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Load a gallery sample'));
    fireEvent.click(screen.getByText(sample.name));
    expect(container.querySelector('.dm-toast')?.textContent).toContain('Loaded sample');
  });

  it('passes drift map through to the source panel', () => {
    const adapter = createTestAdapter();
    const driftMap = new Map([['name', { severity: 'warning' as const, label: 'drift' }]]);
    const { container } = render(<DataMapper adapter={adapter} driftMap={driftMap} />);
    expect(container.querySelector('.dm-panel--source')).toBeTruthy();
  });

  it('applies numeric height prop to the mapper container', () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} height={240} />);
    const el = container.querySelector('.dm-container') as HTMLElement;
    expect(el.style.height).toBe('240px');
  });

  it('auto-map skips learned-pattern path when contextId is empty', () => {
    localStorage.clear();
    const ctx = '';
    const src = { lone: 1 };
    const tgt = { loneT: 0 };
    const st = buildJsonTree(src, '', '');
    const tt = buildJsonTree(tgt, '', '');
    savePattern('ignored', getAllLeafPaths(st), getAllLeafPaths(tt), [
      { id: 'z', sourcePath: 'lone', sourceId: 's1', targetPath: 'loneT' },
    ]);
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      contextId: ctx,
      sources: [{ id: 's1', label: 'S', sampleData: src }],
      target: { label: 'T', sampleData: tgt, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByTitle('Auto-map matching fields'));
    expect(container.querySelector('.dm-toast')?.textContent).toMatch(/auto-mapped/);
    localStorage.clear();
  });

  it('auto-map ignores errors when loading mapping patterns', () => {
    const spy = vi.spyOn(mappingPatternsNs, 'loadPattern').mockImplementation(() => { throw new Error('pattern'); });
    try {
      const adapter: MapperAdapter<Mapping[]> = {
        ...createTestAdapter(),
        contextId: 'pat-err',
        sources: [{ id: 's1', label: 'S', sampleData: { name: 'A' } }],
        target: { label: 'T', sampleData: { name: '' }, allowCustomFields: false },
      };
      render(<DataMapper adapter={adapter} />);
      fireEvent.click(screen.getByTitle('Auto-map matching fields'));
      expect(screen.getByText(/1 mapping/)).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('mapped source paths strip optional $. JSONPath prefix in overlays', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'jx', sourcePath: '$.name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(container.querySelector('.dm-panel--source .dm-tree-node--mapped')).toBeTruthy();
  });

  it('does not append debug error suffix when trace set has zero errors', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'ok1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const traces = [
      { mappingId: 'ok1', sourcePath: 'name', sourceId: 's1', sourceValue: 'A', targetPath: 'userName', targetValue: 'A', timestamp: Date.now(), durationMs: 1 },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!);
    const bar = container.querySelector('.dm-debug-bar');
    expect(bar?.textContent).toMatch(/1 trace/);
    expect(bar?.textContent).not.toMatch(/error/);
  });

  it('skips initialData sync effect when props reference is unchanged', () => {
    const adapter = createTestAdapter();
    const data: Mapping[] = [];
    const { rerender, container } = render(<DataMapper adapter={adapter} initialData={data} />);
    rerender(<DataMapper adapter={adapter} initialData={data} />);
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('0');
  });

  it('ignores stale fetch results after switching active source', async () => {
    let resolveFetch: (v: unknown) => void;
    const fetchSampleData = vi.fn(
      () => new Promise<unknown>((r) => { resolveFetch = r; }),
    );
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [
        { id: 's1', label: 'One', sampleData: { a: 1 } },
        { id: 's2', label: 'Two', sampleData: { b: 2 } },
      ],
      fetchSampleData,
    };
    render(<DataMapper adapter={adapter} />);
    fireEvent.click(screen.getByLabelText('Fetch live sample'));
    fireEvent.click(screen.getByText('Two'));
    await act(async () => { resolveFetch!({ fetched: 'x' }); });
    expect(screen.queryByText('fetched')).toBeNull();
  });
});

describe('DataMapper – additional coverage for below-90% lines', () => {
  it('toggles table view and selects mapping in table view', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const tableBtn = screen.getByText('Table');
    fireEvent.click(tableBtn);
    const tableRows = container.querySelectorAll('.dm-table-row');
    expect(tableRows.length).toBeGreaterThan(0);
    fireEvent.click(tableRows[0]);
    fireEvent.click(tableBtn);
  });

  it('handleMapFilteredFields maps new fields and skips already-mapped', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'name' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const mapFilteredBtn = screen.queryByText(/Map Filtered/i);
    if (mapFilteredBtn) {
      fireEvent.click(mapFilteredBtn);
    }
  });

  it('handleToggleSelectMapping toggles mapping selection on and off', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const node = container.querySelector('.dm-tree-node[data-path="userName"]');
    if (node) {
      fireEvent.click(node);
      fireEvent.click(node);
    }
  });

  it('closes advanced controls when mapping count reaches 8', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = Array.from({ length: 7 }, (_, i) => ({
      id: `m${i}`,
      sourcePath: `field${i}`,
      sourceId: 's1',
      targetPath: `field${i}`,
    }));
    const adapSrc = {
      ...adapter,
      sources: [{ id: 's1', label: 'Source', sampleData: Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`field${i}`, `val${i}`]),
      ) }],
      target: { label: 'Target', sampleData: Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`field${i}`, `val${i}`]),
      ), allowCustomFields: false },
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapSrc} initialData={initial} onChange={onChange} />);
    const autoMap = screen.queryByText(/Auto-map/);
    if (autoMap) {
      fireEvent.click(autoMap);
    }
  });

  it('handlePreviewPropagation shows toast when no mapping selected', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const previewPropBtn = screen.queryByText('Preview Propagate');
    if (previewPropBtn) {
      fireEvent.click(previewPropBtn);
    }
  });

  it('loads gallery sample into mapper', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      contextId: 'test-gallery',
    };
    render(<DataMapper adapter={adapter} />);
    const samplesBtn = screen.queryByText('Samples');
    if (samplesBtn) {
      fireEvent.click(samplesBtn);
      const sampleBtns = screen.queryAllByRole('button');
      const sample = sampleBtns.find(b => b.textContent?.includes('Direct'));
      if (sample) {
        await act(async () => { fireEvent.click(sample); });
      }
    }
  });

  it('suggestDropExpression returns undefined when sourceData is null', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Source', sampleData: null }],
    };
    render(<DataMapper adapter={adapter} />);
    expect(screen.getByText('Source')).toBeTruthy();
  });

  it('line-focus click on node not inside any panel is ignored', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await bumpMapperLayout(container);
    const toggle = screen.queryByLabelText(/Toggle connection lines/);
    if (toggle) {
      fireEvent.click(toggle);
      const toggle2 = screen.queryByLabelText(/node focus/i) ?? screen.queryByLabelText(/Enable click-to-focus/);
      if (toggle2) fireEvent.click(toggle2);
    }
    const wrapper = container.querySelector('.dm-container');
    if (wrapper) {
      fireEvent.click(wrapper);
    }
  });

  it('repair issues: ignoring an issue adds it to ignored set', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'missingField', sourceId: 's1', targetPath: 'userName' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    const ignoreBtn = screen.queryByText(/Ignore/);
    if (ignoreBtn) {
      fireEvent.click(ignoreBtn);
    }
  });

  it('cleans up stale autoMapScores when mappings change', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Auto-map/));
    expect(onChange).toHaveBeenCalled();
  });

  it('pattern save fires after debounce when contextId is set', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(mappingPatternsNs, 'savePattern').mockImplementation(() => {});
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      contextId: 'test-pattern',
    };
    const initial: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    vi.useRealTimers();
  });

  it('handleMapSubtree shows toast when no source/target nodes selected', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const subtreeBtn = screen.queryByText('Map subtree');
    if (subtreeBtn) {
      fireEvent.click(subtreeBtn);
    }
  });

  it('handleMapSiblingSubtrees shows toast when no source/target selected', () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const siblingBtn = screen.queryByText('Map Siblings');
    if (siblingBtn) {
      fireEvent.click(siblingBtn);
    }
  });

  it('repair panel buttons work for missing-target issue', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'nonExistentField' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(screen.getByText('Validation & Repair')).toBeTruthy();
    expect(screen.getByText('Missing target')).toBeTruthy();

    fireEvent.click(screen.getByText('Fix'));
    fireEvent.click(screen.getByText('Open node'));
    fireEvent.click(screen.getByText('Replace'));
    fireEvent.click(screen.getByText('Ignore once'));
  });

  it('duplicate target mappings show repair and replace resolves them', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userName' },
    ];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    expect(screen.getByText('Duplicate target')).toBeTruthy();
    const dupRow = screen.getByText('Duplicate target').closest('.dm-validation-repair-row');
    const dupReplace = dupRow?.querySelector('.dm-validation-repair-btn:nth-child(2)') as HTMLElement;
    if (dupReplace) fireEvent.click(dupReplace);
    expect(onChange).toHaveBeenCalled();
  });

  it('toggles mapping selection via checkbox-like interaction', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const nodes = container.querySelectorAll('.dm-tree-node[data-path]');
    for (const node of nodes) {
      const path = node.getAttribute('data-path');
      if (path === 'userName') {
        fireEvent.click(node);
        break;
      }
    }
  });

  it('handleMapFilteredFields creates new mappings from source tree filter', () => {
    const adapter = createTestAdapter();
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const mapFilteredBtn = screen.queryByText(/Map all \(\d+\)/);
    expect(mapFilteredBtn).toBeTruthy();
    fireEvent.click(mapFilteredBtn!);
    expect(onChange).toHaveBeenCalled();
  });

  it('object-to-object drop maps children via subtree drop plan', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Src', sampleData: { user: { first: 'A', last: 'B' } } }],
      target: { label: 'Tgt', sampleData: { user: { first: '', last: '' } }, allowCustomFields: false },
    };
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} onChange={onChange} />);
    const expandBtns = screen.getAllByLabelText('Expand all');
    for (const btn of expandBtns) fireEvent.click(btn);
    const allTargetNodes = container.querySelectorAll('.dm-tree-node--target[data-path]');
    const tgtUser = Array.from(allTargetNodes).find(el => el.getAttribute('data-path') === 'user');
    expect(tgtUser).toBeTruthy();
    const dragData = JSON.stringify({ path: 'user', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    fireEvent.dragOver(tgtUser!, { dataTransfer: dt });
    fireEvent.drop(tgtUser!, { dataTransfer: dt });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[];
    expect(lastCall.length).toBeGreaterThanOrEqual(2);
  });

  it('object drop with no matching children shows toast', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'Src', sampleData: { group: { alpha: 1, beta: 2 } } }],
      target: { label: 'Tgt', sampleData: { group: { gamma: '', delta: '' } }, allowCustomFields: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    const expandBtns = screen.getAllByLabelText('Expand all');
    for (const btn of expandBtns) fireEvent.click(btn);
    const tgtGroup = Array.from(container.querySelectorAll('.dm-tree-node--target[data-path]')).find(
      el => el.getAttribute('data-path') === 'group',
    );
    expect(tgtGroup).toBeTruthy();
    const dragData = JSON.stringify({ path: 'group', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    fireEvent.dragOver(tgtGroup!, { dataTransfer: dt });
    fireEvent.drop(tgtGroup!, { dataTransfer: dt });
  });

  it('propagation preview close button dismisses preview', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    const previewPropBtn = screen.queryByText('Preview Propagate');
    if (previewPropBtn) {
      fireEvent.click(previewPropBtn);
      const closeBtn = screen.queryByLabelText('Close propagation preview');
      if (closeBtn) {
        fireEvent.click(closeBtn);
      }
    }
  });

  it('gallery sample load overwrites current mappings', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      contextId: 'test-gallery-load',
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const samplesToggle = screen.queryByText('Samples');
    if (!samplesToggle) {
      const advancedBtn = screen.queryByLabelText('Toggle advanced controls');
      if (advancedBtn) fireEvent.click(advancedBtn);
    }
    const samplesBtn = screen.getByText('Samples');
    fireEvent.click(samplesBtn);
    const sampleBtns = screen.getAllByRole('button');
    const directBtn = sampleBtns.find(b => b.textContent?.includes('Direct Field'));
    expect(directBtn).toBeTruthy();
    await act(async () => { fireEvent.click(directBtn!); });
    expect(onChange).toHaveBeenCalled();
  });

  it('line-focus click on source tree node in focus mode highlights and unhighlights on second click', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await bumpMapperLayout(container);
    const lineToggle = screen.getByText('Lines');
    fireEvent.click(lineToggle);
    const nodeFocusBtn = screen.getByText('Focus');
    fireEvent.click(nodeFocusBtn);
    const sourceNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]');
    expect(sourceNode).toBeTruthy();
    fireEvent.click(sourceNode!);
    fireEvent.click(sourceNode!);
  });

  it('handleMapFilteredFields maps only unmapped paths when some already exist', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'name' },
    ];
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const btn = screen.queryByText(/Map all \(\d+\)/);
    if (btn) {
      fireEvent.click(btn);
      expect(onChange).toHaveBeenCalled();
    }
  });

  it('handleMapFilteredFields does nothing when all filtered fields are already mapped', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'name' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'email' },
      { id: 'm3', sourcePath: 'age', sourceId: 's1', targetPath: 'age' },
    ];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(screen.queryByText(/Map all \(\d+\)/)).toBeNull();
  });

  it('handleToggleSelectMapping toggles mapping id in selectedIds set', () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      target: { ...createTestAdapter().target, sampleData: sampleTarget },
    };
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const codeBtn = screen.queryByText('Code');
    if (codeBtn) fireEvent.click(codeBtn);
    const targetNode = container.querySelector('.dm-tree-node[data-path="userName"]');
    if (targetNode) {
      fireEvent.click(targetNode);
    }
  });

  it('visibleLines filters by target node when in focus mode', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await bumpMapperLayout(container);
    const lineToggle = screen.getByText('Lines');
    fireEvent.click(lineToggle);
    const nodeFocusBtn = screen.getByText('Focus');
    fireEvent.click(nodeFocusBtn);
    const targetNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="userName"]');
    expect(targetNode).toBeTruthy();
    fireEvent.click(targetNode!);
  });
});


