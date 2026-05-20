/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor} from '@testing-library/react';
import DataMapper from './DataMapper';
import type { MapperAdapter, Mapping } from './types';
import { buildJsonTree, getAllLeafPaths } from '../../utils/jsonTreeModel';
import { savePattern } from './utils/mappingPatterns';
import * as _mappingPatternsNs from './utils/mappingPatterns';
import type { RepairSuggestion } from './utils/schemaRepair';
import * as autoMapAlgorithm from './utils/autoMapAlgorithm';
import * as _mappingProfiles from './utils/mappingProfiles';
import * as _dropMappingNs from './utils/dropMapping';
import * as _subtreeMappingNs from './utils/subtreeMapping';
import { bumpMapperLayout, createTestAdapter } from './DataMapper.test-utils';
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

