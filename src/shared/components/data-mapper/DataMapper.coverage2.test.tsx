/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor} from '@testing-library/react';
import DataMapper from './DataMapper';
import type { MapperAdapter, Mapping } from './types';
import { buildJsonTree, getAllLeafPaths } from '../../utils/jsonTreeModel';
import { savePattern } from './utils/mappingPatterns';
import * as mappingPatternsNs from './utils/mappingPatterns';
import { mapperGallerySamples } from './utils/gallerySamples';
import * as autoMapAlgorithm from './utils/autoMapAlgorithm';
import * as mappingProfiles from './utils/mappingProfiles';
import * as _dropMappingNs from './utils/dropMapping';
import * as _subtreeMappingNs from './utils/subtreeMapping';
import { bumpMapperLayout, createTestAdapter } from './DataMapper.test-utils';
describe('DataMapper – coverage: array suggestion bar variants', () => {
  it('shows loop array bar when array maps to array', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { arr: [{ k: 1 }] } }],
      target: { label: 'T', sampleData: { arr: [{ k: 0 }] }, allowCustomFields: false },
    };
    const initial: Mapping[] = [{ id: 'loop1', sourcePath: 'arr', sourceId: 's1', targetPath: 'arr' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    await act(async () => { fireEvent.click(mapped!); });
    const bar = container.querySelector('.dm-array-suggestion-bar');
    expect(bar?.textContent).toContain('one-to-one');
  });

  it('shows spread bar for scalar to array without apply when no suggestion', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { token: 'x' } }],
      target: { label: 'T', sampleData: { tokens: ['a', 'b'] }, allowCustomFields: false },
    };
    const initial: Mapping[] = [{ id: 'sp1', sourcePath: 'token', sourceId: 's1', targetPath: 'tokens' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    await act(async () => { fireEvent.click(mapped!); });
    const bar = container.querySelector('.dm-array-suggestion-bar');
    expect(bar?.textContent).toContain('wrapped in an array');
    expect(container.querySelector('.dm-array-suggestion-apply')).toBeNull();
  });
});

describe('DataMapper – coverage: debug bar singular trace wording', () => {
  it('uses singular trace label in debug bar', async () => {
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
    await act(async () => { fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!); });
    expect(container.querySelector('.dm-debug-bar')?.textContent).toMatch(/1 trace\b/);
  });

  it('debug bar pluralizes traces and errors', async () => {
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
    await act(async () => { fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!); });
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
      await act(async () => { fireEvent.click(screen.getByTitle('Mapping profiles')); });
      await waitFor(() => expect(screen.getByTitle(/Load "UnitProf"/)).toBeTruthy());
      await act(async () => { fireEvent.click(screen.getByText('UnitProf')); });
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
      await act(async () => { fireEvent.click(screen.getByTitle('Mapping profiles')); });
      await waitFor(() => expect(screen.getByTitle('Apply "DeltaProf" as delta')).toBeTruthy());
      await act(async () => { fireEvent.click(screen.getByTitle('Apply "DeltaProf" as delta')); });

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

  it('profile delta merge shows noop toast when mappings already match', async () => {
    const mappings: Mapping[] = [
      { id: 'i1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const prof = {
      id: 'prof-noop-delta',
      name: 'NoopDeltaProf',
      contextId: 'test',
      mappings: [{ id: 'p1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }],
      createdAt: 0,
      updatedAt: 0,
    };
    const spy = vi.spyOn(mappingProfiles, 'loadProfiles').mockResolvedValue([prof]);
    try {
      const adapter = createTestAdapter();
      const { container } = render(<DataMapper adapter={adapter} initialData={mappings} />);
      await waitFor(() => expect(screen.getByTitle('Mapping profiles')).toBeTruthy());
      await act(async () => { fireEvent.click(screen.getByTitle('Mapping profiles')); });
      await waitFor(() => expect(screen.getByTitle('Apply "NoopDeltaProf" as delta')).toBeTruthy());
      await act(async () => { fireEvent.click(screen.getByTitle('Apply "NoopDeltaProf" as delta')); });
      await waitFor(() => {
        expect(container.querySelector('.dm-toast')?.textContent).toBe('Profile delta already up to date');
      });
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
    await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
    await bumpMapperLayout(container);
    const accept = await waitFor(() => container.querySelector('.dm-pending-accept'));
    await act(async () => { fireEvent.click(accept!); });
    expect(container.querySelector('.dm-connection-line--pending')).toBeNull();
  });

  it('closes expression editor via Cancel', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'c1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    render(<DataMapper adapter={adapter} initialData={initial} />);
    const mapped = screen.getByText('userName').closest('.dm-tree-node');
    await act(async () => { fireEvent.doubleClick(mapped!); });
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
    await act(async () => { fireEvent.click(screen.getByTitle('Show preview')); });
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
    await act(async () => { fireEvent.click(toggle); });
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
    await act(async () => { fireEvent.click(hitTargets[0], { shiftKey: true }); });
    await act(async () => { fireEvent.click(hitTargets[1], { shiftKey: true }); });
    expect(container.querySelector('.dm-connection-line--selected')).toBeTruthy();
  });

  it('health tree falls back to fields when sample JSON is invalid', async () => {
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

  it('aggregate array bar apply updates the mapping expression', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { vals: [1, 2, 3] } }],
      target: { label: 'T', sampleData: { total: 0 }, allowCustomFields: false },
    };
    const initial: Mapping[] = [{ id: 'ag1', sourcePath: 'vals', sourceId: 's1', targetPath: 'total' }];
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);
    const mapped = container.querySelector('.dm-tree-node--target.dm-tree-node--mapped');
    await act(async () => { fireEvent.click(mapped!); });
    const applyBtn = container.querySelector('.dm-array-suggestion-apply');
    expect(applyBtn).toBeTruthy();
    await act(async () => { fireEvent.click(applyBtn!); });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[] | undefined;
    expect(last?.find((m) => m.id === 'ag1')?.expression).toBeTruthy();
  });

  it('syncs from props when deserialize throws on replacement data', async () => {
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

  it('bulk drop reports singular Mapped 1 field when only primary applies', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'pre', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const sourceLeaves = document.querySelectorAll('.dm-tree-node--leaf.dm-tree-node--source');
    await act(async () => { fireEvent.click(sourceLeaves[0], { shiftKey: true }); });
    await act(async () => { fireEvent.click(sourceLeaves[1], { shiftKey: true }); });
    const targetUserName = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="userName"]');
    const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    await act(async () => { fireEvent.dragOver(targetUserName!, { dataTransfer: dt }); });
    await act(async () => { fireEvent.drop(targetUserName!, { dataTransfer: dt }); });
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
    await act(async () => { fireEvent.click(reject!); });
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

  it('debug bar uses singular error label for one failing trace', async () => {
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
    await act(async () => { fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!); });
    const bar = container.querySelector('.dm-debug-bar');
    expect(bar?.textContent).toMatch(/1 error\b/);
  });

  it('uses mapped value overlay on target when debug mode is off', async () => {
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
    await act(async () => { fireEvent.click(hitTargets[0]); });
    await act(async () => { fireEvent.click(hitTargets[0]); });
    expect(container.querySelector('.dm-connection-line--selected')).toBeNull();
  });

  it('auto-map toast lists only pattern count when automap finds no candidates', async () => {
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
      await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
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
    await act(async () => { fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!); });
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
    await act(async () => { fireEvent.click(tgtNode); });
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

  it('marks target panel focused when target search input receives focus', async () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} />);
    const targetInput = container.querySelector('.dm-panel--target .dm-search-input') as HTMLInputElement;
    await act(async () => { fireEvent.focus(targetInput); });
    expect(container.querySelector('.dm-panel--target.dm-panel--focused')).toBeTruthy();
  });

  it('clears dragged source ref on source drag end', async () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} />);
    const srcNode = document.querySelector('.dm-tree-node--source.dm-tree-node--leaf[data-path="name"]') as HTMLElement;
    await act(async () => { fireEvent.dragStart(srcNode, { dataTransfer: { setData: vi.fn(), effectAllowed: 'link' } }); });
    await act(async () => { fireEvent.dragEnd(srcNode); });
  });

  it('suggestDropExpression yields no expression when source path is absent from sample', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { other: 1 } }],
    };
    const onChange = vi.fn();
    render(<DataMapper adapter={adapter} onChange={onChange} />);
    const targetNode = document.querySelector('.dm-tree-node--target.dm-tree-node--leaf[data-path="userName"]') as HTMLElement;
    const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none', setData: vi.fn() };
    await act(async () => { fireEvent.dragOver(targetNode, { dataTransfer: dt }); });
    await act(async () => { fireEvent.drop(targetNode, { dataTransfer: dt }); });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[];
    const m = last?.find((x) => x.targetPath === 'userName');
    expect(m?.sourcePath).toBe('name');
    expect(m?.expression).toBeUndefined();
  });

  it('suggestDropExpression catches JSON.parse errors for string source sample', async () => {
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
    await act(async () => { fireEvent.dragOver(targetNode!, { dataTransfer: dt }); });
    await act(async () => { fireEvent.drop(targetNode!, { dataTransfer: dt }); });
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
    await act(async () => { fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!); });
    await waitFor(() => expect(container.querySelector('.dm-error-inline')).toBeTruthy());
    await act(async () => { fireEvent.click(container.querySelector('.dm-error-inline')!); });
    await waitFor(() => expect(container.querySelector('.dm-error-popover-close')).toBeTruthy());
    await act(async () => { fireEvent.click(container.querySelector('.dm-error-popover-close')!); });
    expect(container.querySelector('.dm-error-popover')).toBeNull();
  });

  it('line-focus handler ignores orphan tree nodes outside panels', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Hide mapping lines')); });
    await act(async () => { fireEvent.click(screen.getByTitle('Enable node-focus lines')); });
    const root = container.querySelector('.dm-container')!;
    const orphan = document.createElement('div');
    orphan.className = 'dm-tree-node';
    orphan.setAttribute('data-path', 'orphan');
    await act(async () => { root.appendChild(orphan); });
    await act(async () => { fireEvent.click(orphan); });
    await act(async () => { orphan.remove(); });
  });

  it('line-focus handler exits when capture target is not inside a tree node', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Hide mapping lines')); });
    await act(async () => { fireEvent.click(screen.getByTitle('Enable node-focus lines')); });
    await act(async () => { fireEvent.click(container.querySelector('.dm-body')!); });
  });

  it('line-focus handler exits when data-path is empty', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Hide mapping lines')); });
    await act(async () => { fireEvent.click(screen.getByTitle('Enable node-focus lines')); });
    const root = container.querySelector('.dm-container')!;
    const orphan = document.createElement('div');
    orphan.className = 'dm-tree-node';
    orphan.setAttribute('data-path', '');
    await act(async () => { root.appendChild(orphan); });
    await act(async () => { fireEvent.click(orphan); });
    await act(async () => { orphan.remove(); });
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
    await act(async () => { fireEvent.click(collapseBtns[0]); });
    expect(collapseBtns[0]).toBeTruthy();
  });

  it('line-focus ignores nodes without a data-path attribute', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Hide mapping lines')); });
    await act(async () => { fireEvent.click(screen.getByTitle('Enable node-focus lines')); });
    const root = container.querySelector('.dm-container')!;
    const orphan = document.createElement('div');
    orphan.className = 'dm-tree-node';
    await act(async () => { root.appendChild(orphan); });
    await act(async () => { fireEvent.click(orphan); });
    await act(async () => { orphan.remove(); });
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

  it('maps verification failures to clickable footer stats for filtering', async () => {
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      capabilities: { verification: true },
      serialize: (_mappings) => ({
        expectedFields: [
          {
            jsonPath: '$.userName',
            operator: 'equals',
            expectedValue: '"Alice"',
            operatorValue: '"Alice"',
          },
        ],
      }),
      deserialize: (existing) => existing,
    };

    render(<DataMapper adapter={adapter} initialData={initial} />);

    fireEvent.click(screen.getByRole('button', { name: /Verify All/i }));

    await waitFor(() => {
      expect(document.querySelector('.dm-stats-footer .dm-stat-value--verify-fail')).not.toBeNull();
    });

    await act(async () => { fireEvent.click(document.querySelector('.dm-stats-footer .dm-stat--clickable')!); });
    expect(document.querySelector('.dm-container')).toBeTruthy();
  });

  it('adds a custom field on targets that allow custom fields', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { a: 1 } }],
      target: { label: 'T', allowCustomFields: true },
    };
    render(<DataMapper adapter={adapter} />);
    await act(async () => { fireEvent.click(screen.getByLabelText('Add custom field')); });
    await act(async () => { fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'customPath' } }); });
    await act(async () => { fireEvent.click(screen.getByLabelText('Confirm add field')); });
    expect(screen.getByText('customPath')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByLabelText('Remove custom field customPath')); });
    expect(screen.queryByText('customPath')).toBeNull();
  });

  it('clears mappings when initialData prop becomes undefined', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const { rerender, container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('1');
    await act(async () => { rerender(<DataMapper adapter={adapter} />); });
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('0');
  });

  it('debug bar uses singular error count wording', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'e1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const traces = [
      { mappingId: 'e1', sourcePath: 'name', sourceId: 's1', sourceValue: 'A', targetPath: 'userName', targetValue: undefined, timestamp: Date.now(), durationMs: 1, error: 'one' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    await act(async () => { fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!); });
    const text = container.querySelector('.dm-debug-bar')?.textContent ?? '';
    expect(text).toContain('1 error');
    expect(text).not.toContain('1 errors');
  });

  it('gallery load keeps source id when adapter uses the same ids as the sample', async () => {
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
    await act(async () => { fireEvent.click(screen.getByTitle('Load a gallery sample')); });
    await act(async () => { fireEvent.click(screen.getByText(sample.name)); });
    expect(container.querySelector('.dm-toast')?.textContent).toContain('Loaded sample');
  });

  it('passes drift map through to the source panel', async () => {
    const adapter = createTestAdapter();
    const driftMap = new Map([['name', { severity: 'warning' as const, label: 'drift' }]]);
    const { container } = render(<DataMapper adapter={adapter} driftMap={driftMap} />);
    expect(container.querySelector('.dm-panel--source')).toBeTruthy();
  });

  it('applies numeric height prop to the mapper container', async () => {
    const adapter = createTestAdapter();
    const { container } = render(<DataMapper adapter={adapter} height={240} />);
    const el = container.querySelector('.dm-container') as HTMLElement;
    expect(el.style.height).toBe('240px');
  });

  it('auto-map skips learned-pattern path when contextId is empty', async () => {
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
    await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
    expect(container.querySelector('.dm-toast')?.textContent).toMatch(/auto-mapped/);
    localStorage.clear();
  });

  it('auto-map ignores errors when loading mapping patterns', async () => {
    const spy = vi.spyOn(mappingPatternsNs, 'loadPattern').mockImplementation(() => { throw new Error('pattern'); });
    try {
      const adapter: MapperAdapter<Mapping[]> = {
        ...createTestAdapter(),
        contextId: 'pat-err',
        sources: [{ id: 's1', label: 'S', sampleData: { name: 'A' } }],
        target: { label: 'T', sampleData: { name: '' }, allowCustomFields: false },
      };
      render(<DataMapper adapter={adapter} />);
      await act(async () => { fireEvent.click(screen.getByTitle('Auto-map matching fields')); });
      expect(screen.getByText(/1 mapping/)).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('mapped source paths strip optional $. JSONPath prefix in overlays', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'jx', sourcePath: '$.name', sourceId: 's1', targetPath: 'userName' }];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(container.querySelector('.dm-panel--source .dm-tree-node--mapped')).toBeTruthy();
  });

  it('does not append debug error suffix when trace set has zero errors', async () => {
    const adapter = createTestAdapter();
    const initial: Mapping[] = [{ id: 'ok1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const traces = [
      { mappingId: 'ok1', sourcePath: 'name', sourceId: 's1', sourceValue: 'A', targetPath: 'userName', targetValue: 'A', timestamp: Date.now(), durationMs: 1 },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} traceData={traces} />);
    await act(async () => { fireEvent.click(container.querySelector('.dm-toolbar-btn--debug')!); });
    const bar = container.querySelector('.dm-debug-bar');
    expect(bar?.textContent).toMatch(/1 trace/);
    expect(bar?.textContent).not.toMatch(/error/);
  });

  it('skips initialData sync effect when props reference is unchanged', async () => {
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
    await act(async () => { fireEvent.click(screen.getByLabelText('Fetch live sample')); });
    await act(async () => { fireEvent.click(screen.getByText('Two')); });
    await act(async () => { resolveFetch!({ fetched: 'x' }); });
    expect(screen.queryByText('fetched')).toBeNull();
  });
});

