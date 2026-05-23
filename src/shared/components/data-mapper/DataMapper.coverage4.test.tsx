/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor} from '@testing-library/react';
import DataMapper from './DataMapper';
import type { MapperAdapter, Mapping } from './types';
import * as _mappingPatternsNs from './utils/mappingPatterns';
import * as _autoMapAlgorithm from './utils/autoMapAlgorithm';
import * as _mappingProfiles from './utils/mappingProfiles';
import * as _dropMappingNs from './utils/dropMapping';
import * as _subtreeMappingNs from './utils/subtreeMapping';
import type { Assertion } from '../../../types';
import { sampleTarget, bumpMapperLayout, createTestAdapter } from './DataMapper.test-utils';
describe('DataMapper hover-to-highlight', () => {
  function createIdenticalAdapter(): MapperAdapter<Mapping[]> {
    return {
      contextId: 'hover-test',
      title: 'Hover Test',
      sources: [{ id: 's1', label: 'API', sampleData: { id: 1, name: 'Alice' } }],
      target: { label: 'Target', sampleData: { id: 0, name: '' }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
  }

  it('highlights both source and target nodes when a mapping is selected', async () => {
    const adapter = createIdenticalAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'id', sourceId: 's1', targetPath: 'id' },
      { id: 'm2', sourcePath: 'name', sourceId: 's1', targetPath: 'name' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={mappings} />);
    await bumpMapperLayout(container);

    const sourceIdNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="id"]');
    const targetIdNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="id"]');
    expect(sourceIdNode).toBeTruthy();
    expect(targetIdNode).toBeTruthy();

    expect(sourceIdNode!.classList.contains('dm-tree-node--hover-highlight')).toBe(false);
    expect(targetIdNode!.classList.contains('dm-tree-node--hover-highlight')).toBe(false);

    const svgLine = container.querySelector('.dm-connection-line');
    if (svgLine) {
      const hitArea = svgLine.previousElementSibling;
      if (hitArea) {
        await act(async () => { fireEvent.click(hitArea); });
      }
    }

    await act(async () => {});

    const sourceIdAfter = container.querySelector('.dm-panel--source .dm-tree-node[data-path="id"]');
    const targetIdAfter = container.querySelector('.dm-panel--target .dm-tree-node[data-path="id"]');
    const sourceNameAfter = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]');

    if (sourceIdAfter?.classList.contains('dm-tree-node--hover-highlight')) {
      expect(targetIdAfter!.classList.contains('dm-tree-node--hover-highlight')).toBe(true);
      expect(sourceNameAfter!.classList.contains('dm-tree-node--hover-highlight')).toBe(false);
    }
  });

  it('highlights source node when hovering over its corresponding target node', async () => {
    const adapter = createIdenticalAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'id', sourceId: 's1', targetPath: 'id' },
      { id: 'm2', sourcePath: 'name', sourceId: 's1', targetPath: 'name' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={mappings} />);
    await bumpMapperLayout(container);

    const body = container.querySelector('.dm-body');
    expect(body).toBeTruthy();

    const targetIdNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="id"]');
    expect(targetIdNode).toBeTruthy();

    await act(async () => { fireEvent.mouseOver(targetIdNode!); });
    await act(async () => {});

    const sourceIdNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="id"]');
    expect(sourceIdNode).toBeTruthy();
    expect(sourceIdNode!.classList.contains('dm-tree-node--hover-highlight')).toBe(true);

    const sourceNameNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]');
    expect(sourceNameNode!.classList.contains('dm-tree-node--hover-highlight')).toBe(false);
  });

  it('clears highlight when mouse leaves the body area', async () => {
    const adapter = createIdenticalAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'id', sourceId: 's1', targetPath: 'id' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={mappings} />);
    await bumpMapperLayout(container);

    const body = container.querySelector('.dm-body');
    const targetIdNode = container.querySelector('.dm-panel--target .dm-tree-node[data-path="id"]');
    expect(body).toBeTruthy();
    expect(targetIdNode).toBeTruthy();

    await act(async () => { fireEvent.mouseOver(targetIdNode!); });
    await act(async () => {});

    const sourceIdBefore = container.querySelector('.dm-panel--source .dm-tree-node[data-path="id"]');
    expect(sourceIdBefore!.classList.contains('dm-tree-node--hover-highlight')).toBe(true);

    await act(async () => { fireEvent.mouseLeave(body!); });
    await act(async () => {});

    const sourceIdAfter = container.querySelector('.dm-panel--source .dm-tree-node[data-path="id"]');
    expect(sourceIdAfter!.classList.contains('dm-tree-node--hover-highlight')).toBe(false);
  });
});

describe('DataMapper – capability-gated branch coverage', () => {
  it('renders with arrayAssertions + codeEditor capabilities', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      capabilities: { arrayAssertions: true, codeEditor: true, verification: true, operators: true },
    };
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });

  it('renders with hideAdvanced capability false (advanced controls visible)', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      capabilities: { hideAdvanced: false },
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    expect(container.querySelector('.dm-container')).toBeTruthy();
    const profilesBtn = container.querySelector('button[title="Mapping profiles"]');
    expect(profilesBtn).toBeTruthy();
  });

  it('renders with allowCustomFields target for onRename path', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      target: { label: 'Target', sampleData: sampleTarget, allowCustomFields: true },
    };
    const initial: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });

  it('selectedMapping resolves from selectedMappingId', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{
        id: 's1',
        label: 'Source',
        sampleData: { items: [{ code: 'A' }, { code: 'B' }] },
      }],
      target: {
        label: 'Target',
        sampleData: { items: [{ code: '' }, { code: '' }] },
        allowCustomFields: false,
      },
    };
    const initial: Mapping[] = [
      { id: 'arr1', sourcePath: 'items[0].code', sourceId: 's1', targetPath: 'items[0].code' },
    ];
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} />);
    const expandBtns = screen.getAllByLabelText('Expand all');
    expandBtns.forEach((b) => fireEvent.click(b));
    const targetMapped = container.querySelector('.dm-panel--target .dm-tree-node--mapped');
    if (targetMapped) await act(async () => { fireEvent.click(targetMapped); });
    expect(container.querySelector('.dm-tree-node--selected')).toBeTruthy();
  });

  it('adapter with sources having empty id falls back', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [],
    };
    const { container } = render(<DataMapper adapter={adapter} />);
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });
});

describe('DataMapper – targeted branch coverage (unmap, dock, verify nav, errors)', () => {
  let scrollIntoViewSpy: ReturnType<typeof vi.fn>;

  function deserializeMappingsPayload(data: unknown): Mapping[] {
    if (Array.isArray(data)) return data as Mapping[];
    if (data && typeof data === 'object' && 'mappings' in data && Array.isArray((data as { mappings: Mapping[] }).mappings)) {
      return (data as { mappings: Mapping[] }).mappings;
    }
    return [];
  }

  beforeEach(() => {
    scrollIntoViewSpy = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewSpy,
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('dm-body')) {
        return {
          x: 0, y: 0, top: 0, left: 0, width: 900, height: 500, bottom: 500, right: 900, toJSON: () => ({}),
        } as DOMRect;
      }
      const path = this.getAttribute('data-path') ?? '';
      const t = path === 'name' ? 50 : path === 'email' ? 70 : path === 'userAge' ? 150 : path === 'userName' ? 120 : path === 'userEmail' ? 100 : path === 'tagSummary' ? 140 : path === 'tags' ? 90 : 80;
      return {
        x: 0, y: t, top: t, left: 0, width: 40, height: 20, bottom: t + 20, right: 40, toJSON: () => ({}),
      } as DOMRect;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes mappings via source multi-select Unmap for mapped leaf paths', async () => {
    const adapter: MapperAdapter<unknown> = {
      ...createTestAdapter(),
      serialize: (m) => m,
      deserialize: deserializeMappingsPayload,
    };
    const initial: Mapping[] = [
      { id: 'u1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'u2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' },
    ];
    const { container } = render(<DataMapper adapter={adapter as MapperAdapter<Mapping[]>} initialData={initial} />);
    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('2');

    const nameLeaf = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]')!;
    const emailLeaf = container.querySelector('.dm-panel--source .dm-tree-node[data-path="email"]')!;
    await act(async () => { fireEvent.click(nameLeaf, { ctrlKey: true }); });
    await act(async () => { fireEvent.click(emailLeaf, { ctrlKey: true }); });
    await act(async () => { fireEvent.click(screen.getByLabelText(/Unmap 2 selected fields/)); });

    expect(container.querySelector('.dm-stat-value--mapped')?.textContent).toBe('0');
  });

  it('renders validation assertions in bottom Code dock when bundled initial assertions exist', async () => {
    const assertions: Assertion[] = [{ type: 'arrayLength', jsonPath: '$.userName', operator: '=', value: 5 }];
    const adapter: MapperAdapter<unknown> = {
      ...createTestAdapter(),
      capabilities: { codeEditor: true },
      serialize: (m) => m,
      deserialize: deserializeMappingsPayload,
    };
    const bundle = {
      mappings: [{ id: 'c1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }] satisfies Mapping[],
      assertions,
    };
    render(<DataMapper adapter={adapter as MapperAdapter<Mapping[]>} initialData={bundle} />);

    await act(async () => { fireEvent.click(screen.getByTitle('Show code view')); });
    expect(document.querySelector('.dm-bottom-utility-dock--code')).toBeTruthy();
    const codeRegion = screen.getByRole('region', { name: 'Mapping code view' });
    expect(codeRegion.textContent).toMatch(/1 assertion/);
    expect(codeRegion.textContent).toMatch(/— Assertions —/);
  });

  it('shows target fetch error banner when fetchTargetSchema rejects', async () => {
    const fetchTargetSchema = vi.fn().mockRejectedValue(new Error('schema_unreachable'));
    const adapter: MapperAdapter<Mapping[]> = { ...createTestAdapter(), fetchTargetSchema };
    const { container } = render(<DataMapper adapter={adapter} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Fetch target schema'));
    });
    await waitFor(() => {
      expect(container.querySelector('.dm-fetch-error-banner')).toBeTruthy();
    });
    expect(container.querySelector('.dm-fetch-error-banner')?.textContent).toContain('schema_unreachable');
  });

  it('hides advanced toolbar affordances when hideAdvanced prop is set', async () => {
    const adapter = createTestAdapter();
    render(<DataMapper adapter={adapter} hideAdvanced />);
    expect(screen.queryByTitle('Load a gallery sample')).toBeNull();
  });

  it('opens toolbar failure list and navigates via onNavigateToFailure', async () => {
    const initial: Mapping[] = [{ id: 'v1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      capabilities: { verification: true },
      serialize: (_mappings) => ({
        expectedFields: [
          {
            jsonPath: '$.userName',
            operator: 'equals',
            expectedValue: '"Someone Else"',
            operatorValue: '"Someone Else"',
          },
        ],
      }),
      deserialize: (existing) => existing as Mapping[],
    };

    render(<DataMapper adapter={adapter} initialData={initial} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Verify All/i })); });

    await waitFor(() => {
      expect(screen.getByTitle('Click to see failures')).toBeTruthy();
    });

    await act(async () => { fireEvent.click(screen.getByTitle('Click to see failures')); });
    expect(document.querySelector('.dm-toolbar-failure-list')).toBeTruthy();
    const row = document.querySelector('.dm-toolbar-failure-item');
    expect(row).toBeTruthy();
    await act(async () => { fireEvent.click(row!); });
    await waitFor(() => {
      expect(document.querySelector('.dm-toolbar-failure-list')).toBeNull();
    });
    expect(scrollIntoViewSpy).toHaveBeenCalled();
  });

  it('syncs DSL in Rules modal so Verify All fills rulesLineResults and assertionVerifyMap', async () => {
    const assertions: Assertion[] = [{ type: 'arrayLength', jsonPath: '$.tags', operator: '>=', value: 1 }];
    const base = createTestAdapter();
    const adapter: MapperAdapter<unknown> = {
      ...base,
      capabilities: { codeEditor: true, verification: true },
      target: {
        ...base.target,
        sampleData: { ...sampleTarget, tags: [1, 2] },
      },
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
      deserialize: deserializeMappingsPayload,
    };
    const bundle = {
      mappings: [{ id: 'dsl1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }] satisfies Mapping[],
      assertions,
    };
    render(<DataMapper adapter={adapter as MapperAdapter<Mapping[]>} initialData={bundle} />);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Rules$/ })); });

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Validation Rules' })).toBeTruthy();
    });

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Verify All/i })); });

    await waitFor(() => {
      expect(document.querySelector('.dm-toolbar-verify-pass')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Verify All/i }).textContent).not.toMatch(/Verifying/);
  });

  it('invokes custom-field rename from expression editor variable name commit', async () => {
    const base = createTestAdapter();
    const adapter: MapperAdapter<Mapping[]> = {
      ...base,
      target: { ...base.target, allowCustomFields: true },
    };
    const initial: Mapping[] = [{ id: 'rn1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' }];
    render(<DataMapper adapter={adapter} initialData={initial} />);

    const mapped = screen.getByText('userName').closest('.dm-tree-node');
    expect(mapped).toBeTruthy();
    await act(async () => { fireEvent.doubleClick(mapped!); });
    await waitFor(() => {
      expect(screen.getByLabelText('Variable name (target path)')).toBeTruthy();
    });

    const nameInput = screen.getByLabelText('Variable name (target path)');
    await act(async () => { fireEvent.change(nameInput, { target: { value: 'exprRenamedField' } }); });
    await act(async () => { fireEvent.blur(nameInput); });
    await waitFor(() => {
      expect(screen.getByText('exprRenamedField')).toBeTruthy();
    });
  });

  it('applies array aggregate suggestion from the suggestion bar', async () => {
    const adapter: MapperAdapter<Mapping[]> = {
      ...createTestAdapter(),
      sources: [{ id: 's1', label: 'S', sampleData: { tags: [1, 2, 3] } }],
      target: { label: 'T', sampleData: { tagSummary: 0 }, allowCustomFields: false },
      serialize: (m) => m,
      deserialize: (m) => m,
    };
    const initial: Mapping[] = [{ id: 'agg1', sourcePath: 'tags', sourceId: 's1', targetPath: 'tagSummary' }];
    const onChange = vi.fn();
    const { container } = render(<DataMapper adapter={adapter} initialData={initial} onChange={onChange} />);

    const tgtSummary = container.querySelector('.dm-panel--target .dm-tree-node[data-path="tagSummary"]')!;
    await act(async () => { fireEvent.click(tgtSummary); });
    const applyBtn = screen.getByRole('button', { name: /^Apply: / });
    expect(applyBtn.textContent).toContain('$count');
    await act(async () => { fireEvent.click(applyBtn); });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Mapping[];
    const m = last?.find((x) => x.id === 'agg1');
    expect(m?.expression).toContain('$count');
  });
});

