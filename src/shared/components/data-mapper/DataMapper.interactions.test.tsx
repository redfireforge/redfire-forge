/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataMapper from './DataMapper';
import { MapperAdapter, Mapping } from './types';
import * as _mappingPatternsNs from './utils/mappingPatterns';
import * as _autoMapAlgorithm from './utils/autoMapAlgorithm';
import * as _mappingProfiles from './utils/mappingProfiles';
import * as _dropMappingNs from './utils/dropMapping';
import * as _subtreeMappingNs from './utils/subtreeMapping';
import { createTestAdapter } from './DataMapper.test-utils';
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
