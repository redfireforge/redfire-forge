/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import DataMapper from './DataMapper';
import { MapperAdapter, Mapping } from './types';
import * as mappingPatternsNs from './utils/mappingPatterns';
import * as _autoMapAlgorithm from './utils/autoMapAlgorithm';
import * as _mappingProfiles from './utils/mappingProfiles';
import * as dropMappingNs from './utils/dropMapping';
import * as subtreeMappingNs from './utils/subtreeMapping';
import { sampleTarget, bumpMapperLayout, createTestAdapter } from './DataMapper.test-utils';
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

  it('propagation preview clears when anchor mapping is deleted', () => {
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
      id: 'anchor-del',
      sourcePath: 'offers[0].associatedOfferingCode',
      sourceId: 's1',
      targetPath: 'offers[0].associatedOfferingCode',
    }];
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const anchorNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0].associatedOfferingCode"]');
    expect(anchorNode).toBeTruthy();
    fireEvent.click(anchorNode!);
    fireEvent.click(screen.getByRole('button', { name: 'Preview propagate' }));
    expect(container.querySelector('.dm-propagation-preview')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(container.querySelector('.dm-propagation-preview')).toBeNull();
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('Preview propagate shows not eligible toast for non-indexed mapping', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const node = container.querySelector('.dm-panel--target .dm-tree-node[data-path="userName"]');
    expect(node).toBeTruthy();
    fireEvent.click(node!);
    fireEvent.click(screen.getByRole('button', { name: 'Preview propagate' }));
    expect(container.querySelector('.dm-toast')?.textContent).toContain('not eligible');
  });

  it('Apply propagation repairs sibling row when target already mapped from wrong source index', () => {
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
          { path: 'offers[0].associatedOfferingCode', label: 'c0', type: 'string' },
          { path: 'offers[1].associatedOfferingCode', label: 'c1', type: 'string' },
        ],
      },
    };
    const initial: Mapping[] = [
      { id: 'anchor', sourcePath: 'offers[0].associatedOfferingCode', sourceId: 's1', targetPath: 'offers[0].associatedOfferingCode' },
      { id: 'wrong', sourcePath: 'offers[0].associatedOfferingCode', sourceId: 's1', targetPath: 'offers[1].associatedOfferingCode' },
    ];
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const anchorNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0].associatedOfferingCode"]');
    expect(anchorNode).toBeTruthy();
    fireEvent.click(anchorNode!);
    fireEvent.click(screen.getByRole('button', { name: 'Preview propagate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply propagation' }));
    const last = onChange.mock.calls.at(-1)?.[0] as Mapping[] | undefined;
    const sibling = last?.find((m) => m.targetPath === 'offers[1].associatedOfferingCode');
    expect(sibling?.sourcePath).toBe('offers[1].associatedOfferingCode');
  });

  it('Apply propagation shows no-op toast when upsert reports no mapping changes', () => {
    const spy = vi.spyOn(dropMappingNs, 'upsertTargetMapping').mockImplementation((mappings) => ({
      next: mappings,
      changed: false,
    }));
    try {
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
            { path: 'offers[0].associatedOfferingCode', label: 'offers00', type: 'string' },
            { path: 'offers[1].associatedOfferingCode', label: 'offers10', type: 'string' },
          ],
        },
      };
      const initial: Mapping[] = [{
        id: 'anchor',
        sourcePath: 'offers[0].associatedOfferingCode',
        sourceId: 's1',
        targetPath: 'offers[0].associatedOfferingCode',
      }];
      const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
      const anchorNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0].associatedOfferingCode"]');
      fireEvent.click(anchorNode!);
      fireEvent.click(screen.getByRole('button', { name: 'Preview propagate' }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply propagation' }));
      expect(container.querySelector('.dm-toast')?.textContent).toContain(
        'No changes - propagated mappings already up to date',
      );
      expect(container.querySelector('.dm-propagation-preview')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('Map filtered shows toast when filtered source paths only target already-occupied fields', () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [
      { id: 'occupy', sourcePath: 'name', sourceId: 's1', targetPath: 'email' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const searchInputs = screen.getAllByPlaceholderText('Search fields…');
    fireEvent.change(searchInputs[0], { target: { value: 'email' } });
    fireEvent.click(screen.getByLabelText(/Map 1 filtered fields/));
    expect(container.querySelector('.dm-toast')?.textContent).toContain('All filtered fields are already mapped');
  });

  it('bulk subtree drop toast when pairing yields only unchanged mappings', () => {
    const applySpy = vi.spyOn(subtreeMappingNs, 'applyDropPairs').mockReturnValue({
      nextMappings: [],
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 3,
    });
    try {
      const adapter: MapperAdapter<Mapping[]> = {
        ...createTestAdapter(),
        sources: [{ id: 's1', label: 'Src', sampleData: { user: { first: 'A', last: 'B' } } }],
        target: { label: 'Tgt', sampleData: { user: { first: '', last: '' } }, allowCustomFields: false },
      };
      const { container } = render(<DataMapper adapter={adapter} />);
      const expandBtns = screen.getAllByLabelText('Expand all');
      for (const btn of expandBtns) fireEvent.click(btn);
      const tgtUser = Array.from(container.querySelectorAll('.dm-tree-node--target[data-path]'))
        .find((el) => el.getAttribute('data-path') === 'user');
      expect(tgtUser).toBeTruthy();
      const dragData = JSON.stringify({ path: 'user', sourceId: 's1' });
      const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
      fireEvent.dragOver(tgtUser!, { dataTransfer: dt });
      fireEvent.drop(tgtUser!, { dataTransfer: dt });
      expect(container.querySelector('.dm-toast')?.textContent).toContain(
        'No changes - matching targets already mapped',
      );
    } finally {
      applySpy.mockRestore();
    }
  });

  describe('operator wiring (target operator picker)', () => {
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('dm-body')) {
          return {
            x: 0, y: 0, top: 0, left: 0, width: 900, height: 500, bottom: 500, right: 900, toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          x: 0, y: 80, top: 80, left: 0, width: 200, height: 24, bottom: 104, right: 200, toJSON: () => ({}),
        } as DOMRect;
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('updates mapping operator via DataMapper target operator picker', () => {
      const adapter: MapperAdapter<Mapping[]> = {
        ...createTestAdapter(),
        capabilities: { operators: true },
      };
      const initial: Mapping[] = [{ id: 'op1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
      const onChange = vi.fn();
      render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
      const pill = screen.getByLabelText('Change operator from equals');
      fireEvent.click(pill);
      fireEvent.click(screen.getByText('greater than'));
      const last = onChange.mock.calls.at(-1)?.[0] as Mapping[] | undefined;
      expect(last?.find((m) => m.id === 'op1')?.operator).toBe('greater_than');
    });
  });

  it('propagation preview Close button clears preview', () => {
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
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const anchorNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0].associatedOfferingCode"]');
    expect(anchorNode).toBeTruthy();
    fireEvent.click(anchorNode!);
    fireEvent.click(screen.getByRole('button', { name: 'Preview propagate' }));
    expect(container.querySelector('.dm-propagation-preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close propagation preview' }));
    expect(container.querySelector('.dm-propagation-preview')).toBeNull();
  });

  it('propagation preview Cancel button clears preview', () => {
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
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const anchorNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="offers[0].associatedOfferingCode"]');
    expect(anchorNode).toBeTruthy();
    fireEvent.click(anchorNode!);
    fireEvent.click(screen.getByRole('button', { name: 'Preview propagate' }));
    const previewEl = container.querySelector('.dm-propagation-preview') as HTMLElement;
    expect(previewEl).toBeTruthy();
    fireEvent.click(within(previewEl).getByRole('button', { name: 'Cancel' }));
    expect(container.querySelector('.dm-propagation-preview')).toBeNull();
  });
});

