/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowPalette from './WorkflowPalette';
import type { RequestCollection } from '../../../../shared/types';
import type { CatalogEntry } from '../../../catalog/types/catalog';
import type { WorkflowPreviewEntry } from '../../../../shared/utils/workflowPreviewStorage';

vi.mock('../nodes/NodeIcon', () => ({ NodeIcon: ({ type }: { type: string }) => <span data-testid={`icon-${type}`} /> }));

const collections: RequestCollection[] = [
  {
    id: 'c1',
    name: 'Coll One',
    requests: [{ id: 'r1', name: 'Get User', method: 'GET', url: 'http://x/users' }],
    folders: [
      {
        id: 'f1',
        name: 'Folder A',
        isSubCollection: true,
        requests: [{ id: 'r2', name: 'Post User', method: 'POST', url: 'http://x/users' }],
        folders: [
          { id: 'f2', name: 'Nested', requests: [{ id: 'r3', name: 'Del User', method: 'DELETE', url: 'http://x/u/1' }], folders: [] },
        ],
      },
    ],
  } as unknown as RequestCollection,
];

const catalogEntries: CatalogEntry[] = [
  {
    id: 'e1',
    name: 'Catalog One',
    endpoints: [{ id: 'ep0', method: 'get', path: '/root', summary: 'Root EP', workflowExposure: 'published' }],
    folders: [
      {
        id: 'cf1',
        name: 'Cat Folder',
        endpoints: [{ id: 'ep1', method: 'post', path: '/create', summary: 'Create thing', workflowExposure: 'published' }],
        folders: [
          { id: 'cf2', name: 'Cat Nested', endpoints: [{ id: 'ep2', method: 'put', path: '/edit', summary: 'Edit thing', workflowExposure: 'published' }], folders: [] },
        ],
      },
    ],
  } as unknown as CatalogEntry,
];

const previewEndpoints: WorkflowPreviewEntry[] = [
  { entryId: 'e1', endpointId: 'ep-prev', method: 'patch', path: '/preview-ep', summary: 'Preview EP', entryName: 'Catalog One', addedAt: Date.now() },
];

function setup(over: Partial<Parameters<typeof WorkflowPalette>[0]> = {}) {
  const onAddNode = vi.fn();
  const onAddFromRequest = vi.fn();
  const onAddFromCatalog = vi.fn();
  render(
    <WorkflowPalette
      collections={collections}
      catalogEntries={catalogEntries}
      onAddNode={onAddNode}
      onAddFromRequest={onAddFromRequest}
      onAddFromCatalog={onAddFromCatalog}
      {...over}
    />,
  );
  return { onAddNode, onAddFromRequest, onAddFromCatalog };
}

describe('WorkflowPalette', () => {
  it('renders blocks tab with categories and adds a node on click', () => {
    const { onAddNode } = setup();
    expect(screen.getByText('Triggers')).toBeTruthy();
    fireEvent.click(screen.getByText('Manual Start'));
    expect(onAddNode).toHaveBeenCalledWith('start');
  });

  it('adds a node via keyboard (Enter and Space)', () => {
    const { onAddNode } = setup();
    const block = screen.getByText('Manual Start').closest('.wf-palette-block') as Element;
    fireEvent.keyDown(block, { key: 'Enter' });
    fireEvent.keyDown(block, { key: ' ' });
    expect(onAddNode).toHaveBeenCalledTimes(2);
  });

  it('switches category via rail button', () => {
    setup();
    expect(screen.getByText('Manual Start')).toBeTruthy();
    fireEvent.click(screen.getByTestId('wf-palette-rail-logic'));
    expect(screen.queryByText('Manual Start')).toBeNull();
    expect(screen.getByText('Condition')).toBeTruthy();
    fireEvent.click(screen.getByTestId('wf-palette-rail-triggers'));
    expect(screen.getByText('Manual Start')).toBeTruthy();
  });

  it('handles block drag start and end', () => {
    setup();
    const block = screen.getByText('Manual Start').closest('.wf-palette-block') as Element;
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(block, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalled();
    expect(document.querySelector('.wf-drag-ghost')).toBeTruthy();
    fireEvent.dragEnd(block);
    expect(document.querySelector('.wf-drag-ghost')).toBeNull();
  });

  it('filters blocks by search and shows no-results message', () => {
    setup();
    const search = screen.getByPlaceholderText('Search all blocks…');
    fireEvent.change(search, { target: { value: 'zzzznotfound' } });
    expect(screen.getByText(/No blocks matching/)).toBeTruthy();
  });

  it('filters blocks to a matching block and clears search', () => {
    setup();
    const search = screen.getByPlaceholderText('Search all blocks…');
    fireEvent.change(search, { target: { value: 'kafka' } });
    expect(document.querySelector('.wf-palette-block-kafkaProduce')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Manual Start')).toBeTruthy();
  });

  it('renders gRPC blocks via Actions rail and adds each node type', () => {
    const { onAddNode } = setup();
    fireEvent.click(screen.getByTestId('wf-palette-rail-actions'));
    fireEvent.click(screen.getByText('gRPC Unary'));
    fireEvent.click(screen.getByText('gRPC Server Stream'));
    expect(onAddNode).toHaveBeenNthCalledWith(1, 'grpcUnary');
    expect(onAddNode).toHaveBeenNthCalledWith(2, 'grpcServerStream');
    fireEvent.click(screen.getByTestId('wf-palette-rail-logic'));
    fireEvent.click(screen.getByText('gRPC Assert'));
    expect(onAddNode).toHaveBeenNthCalledWith(3, 'grpcAssert');
  });

  it('switches to requests tab and adds from a request', () => {
    const { onAddFromRequest } = setup();
    fireEvent.click(screen.getByText('Requests'));
    fireEvent.click(screen.getByText('Coll One'));
    fireEvent.click(screen.getByText('Get User'));
    expect(onAddFromRequest).toHaveBeenCalledWith('c1', 'r1');
  });

  it('expands nested request folders and adds nested request', () => {
    const { onAddFromRequest } = setup();
    fireEvent.click(screen.getByText('Requests'));
    fireEvent.click(screen.getByText('Coll One'));
    fireEvent.click(screen.getByText('Folder A'));
    fireEvent.click(screen.getByText('Post User'));
    expect(onAddFromRequest).toHaveBeenCalledWith('c1', 'r2');
    fireEvent.click(screen.getByText('Nested'));
    fireEvent.click(screen.getByText('Del User'));
    expect(onAddFromRequest).toHaveBeenCalledWith('c1', 'r3');
  });

  it('shows empty requests message and filters requests by search', () => {
    setup({ collections: [] });
    fireEvent.click(screen.getByText('Requests'));
    expect(screen.getByText('No request collections')).toBeTruthy();
  });

  it('filters requests by search query', () => {
    setup();
    fireEvent.click(screen.getByText('Requests'));
    const search = screen.getByPlaceholderText('Search requests…');
    fireEvent.change(search, { target: { value: 'get user' } });
    fireEvent.click(screen.getByText('Coll One'));
    expect(screen.getByText('Get User')).toBeTruthy();
  });

  it('switches to catalog tab and adds from a root endpoint', () => {
    const { onAddFromCatalog } = setup();
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.click(screen.getByText('Catalog One'));
    fireEvent.click(screen.getByText('Root EP'));
    expect(onAddFromCatalog).toHaveBeenCalledWith('e1', 'ep0');
  });

  it('expands catalog folders and adds nested catalog endpoints', () => {
    const { onAddFromCatalog } = setup();
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.click(screen.getByText('Catalog One'));
    fireEvent.click(screen.getByText('Cat Folder'));
    fireEvent.click(screen.getByText('Create thing'));
    expect(onAddFromCatalog).toHaveBeenCalledWith('e1', 'ep1');
    fireEvent.click(screen.getByText('Cat Nested'));
    fireEvent.click(screen.getByText('Edit thing'));
    expect(onAddFromCatalog).toHaveBeenCalledWith('e1', 'ep2');
  });

  it('shows empty catalog message when nothing exposed', () => {
    setup({ catalogEntries: [] });
    fireEvent.click(screen.getByText('Catalog'));
    expect(screen.getByText(/No endpoints exposed/)).toBeTruthy();
  });

  it('hides catalog entries when endpoints are not exposed to workflow', () => {
    const hiddenOnly: CatalogEntry[] = [{
      id: 'e2',
      name: 'Hidden Cat',
      endpoints: [{ id: 'epH', method: 'get', path: '/hidden', summary: 'Hidden' }],
      folders: [],
    } as unknown as CatalogEntry];
    setup({ catalogEntries: hiddenOnly });
    fireEvent.click(screen.getByText('Catalog'));
    expect(screen.getByText(/No endpoints exposed/)).toBeTruthy();
  });

  it('shows catalog no-results message when search has no matches', () => {
    setup();
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.change(screen.getByPlaceholderText('Search catalog…'), { target: { value: 'zzzznomatch' } });
    expect(screen.getByText(/No exposed endpoints matching/)).toBeTruthy();
  });

  it('filters catalog by search query', () => {
    setup();
    fireEvent.click(screen.getByText('Catalog'));
    const search = screen.getByPlaceholderText('Search catalog…');
    fireEvent.change(search, { target: { value: 'create' } });
    expect(screen.getByText('Catalog One')).toBeTruthy();
  });

  it('switches back to blocks tab and filters blocks by description', () => {
    setup();
    fireEvent.click(screen.getByText('Requests'));
    fireEvent.click(screen.getByText('Blocks'));
    const search = screen.getByPlaceholderText('Search all blocks…');
    fireEvent.change(search, { target: { value: 'cron-based' } });
    expect(screen.getByText('Schedule Trigger')).toBeTruthy();
    expect(document.querySelector('.wf-palette-match')).toBeTruthy();
  });

  it('shows protocol chips when Actions category is selected', () => {
    setup();
    fireEvent.click(screen.getByTestId('wf-palette-rail-actions'));
    expect(screen.getByTestId('wf-palette-chip-http')).toBeTruthy();
    expect(screen.getByTestId('wf-palette-chip-kafka')).toBeTruthy();
    expect(screen.getByTestId('wf-palette-chip-websocket')).toBeTruthy();
    expect(screen.getByTestId('wf-palette-chip-graphql')).toBeTruthy();
    expect(screen.getByTestId('wf-palette-chip-grpc')).toBeTruthy();
  });

  it('filters by protocol chip', () => {
    setup();
    fireEvent.click(screen.getByTestId('wf-palette-rail-actions'));
    fireEvent.click(screen.getByTestId('wf-palette-chip-kafka'));
    expect(screen.getByText('Kafka Produce')).toBeTruthy();
    expect(screen.queryByText('HTTP Request')).toBeNull();
  });

  it('search shows results across all categories', () => {
    setup();
    const search = screen.getByPlaceholderText('Search all blocks…');
    fireEvent.change(search, { target: { value: 'fork' } });
    expect(document.querySelector('.wf-palette-block-fork')).toBeTruthy();
  });

  it('does not show protocol chips for non-Actions categories', () => {
    setup();
    expect(screen.queryByTestId('wf-palette-chip-http')).toBeNull();
    fireEvent.click(screen.getByTestId('wf-palette-rail-logic'));
    expect(screen.queryByTestId('wf-palette-chip-http')).toBeNull();
  });

  it('shows no-results message when request search has no matches', () => {
    setup();
    fireEvent.click(screen.getByText('Requests'));
    fireEvent.change(screen.getByPlaceholderText('Search requests…'), { target: { value: 'zzzznomatch' } });
    expect(screen.getByText(/No requests matching/)).toBeTruthy();
  });

  it('filters requests by method and url', () => {
    const cols: RequestCollection[] = [{
      id: 'c2',
      name: 'API',
      requests: [{ id: 'r9', name: 'Misc', method: 'PATCH', url: 'http://x/patch-target' }],
      folders: [{
        id: 'f9',
        name: 'Plain Folder',
        isSubCollection: false,
        requests: [],
        folders: [],
      }],
    } as unknown as RequestCollection];
    setup({ collections: cols });
    fireEvent.click(screen.getByText('Requests'));
    fireEvent.change(screen.getByPlaceholderText('Search requests…'), { target: { value: 'patch' } });
    fireEvent.click(screen.getByText('API'));
    expect(screen.getByText('Misc')).toBeTruthy();
  });

  it('renders catalog endpoint path when summary is missing', () => {
    const noSummary: CatalogEntry[] = [{
      id: 'e3',
      name: 'Paths Only',
      endpoints: [{ id: 'epP', method: 'delete', path: '/no-summary', workflowExposure: 'published' }],
      folders: [{
        id: 'cfEmpty',
        name: 'Empty On Search',
        endpoints: [{ id: 'epX', method: 'get', path: '/other', summary: 'Other', workflowExposure: 'published' }],
        folders: [],
      }],
    } as unknown as CatalogEntry];
    const { onAddFromCatalog } = setup({ catalogEntries: noSummary });
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.click(screen.getByText('Paths Only'));
    fireEvent.click(screen.getByText('/no-summary'));
    expect(onAddFromCatalog).toHaveBeenCalledWith('e3', 'epP');

    fireEvent.change(screen.getByPlaceholderText('Search catalog…'), { target: { value: 'nomatchfolder' } });
    expect(screen.queryByText('Empty On Search')).toBeNull();
  });

  it('searches catalog by path and uses fallback color for unknown methods', () => {
    const exotic: CatalogEntry[] = [{
      id: 'e4',
      name: 'Exotic',
      endpoints: [{ id: 'epF', method: 'foo', path: '/exotic-path', workflowExposure: 'published' }],
      folders: [{
        id: 'cf1',
        name: 'Nested',
        endpoints: [{ id: 'epN', method: 'bar', path: '/nested-path', summary: 'Nested EP', workflowExposure: 'published' }],
        folders: [],
      }],
    } as unknown as CatalogEntry];
    setup({ catalogEntries: exotic });
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.change(screen.getByPlaceholderText('Search catalog…'), { target: { value: 'exotic-path' } });
    fireEvent.click(screen.getByText('Exotic'));
    expect(screen.getByText('/exotic-path')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search catalog…'), { target: { value: 'nested-path' } });
    fireEvent.click(screen.getByText('Nested'));
    expect(screen.getByText('Nested EP')).toBeTruthy();
  });

  it('filters nested request folders when only nested item matches search', () => {
    const nestedOnly: RequestCollection[] = [{
      id: 'c3',
      name: 'Deep',
      requests: [],
      folders: [{
        id: 'df1',
        name: 'Outer',
        requests: [],
        folders: [{ id: 'df2', name: 'Inner', requests: [{ id: 'rx', name: 'Leaf', method: 'CUSTOM', url: '' }], folders: [] }],
      }],
    } as unknown as RequestCollection];
    setup({ collections: nestedOnly });
    fireEvent.click(screen.getByText('Requests'));
    fireEvent.change(screen.getByPlaceholderText('Search requests…'), { target: { value: 'leaf' } });
    fireEvent.click(screen.getByText('Deep'));
    fireEvent.click(screen.getByText('Outer'));
    fireEvent.click(screen.getByText('Inner'));
    expect(screen.getByText('Leaf')).toBeTruthy();
  });

  it('collapses catalog folder when toggled without active search', () => {
    setup();
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.click(screen.getByText('Catalog One'));
    fireEvent.click(screen.getByText('Cat Folder'));
    expect(screen.getByText('Create thing')).toBeTruthy();
    fireEvent.click(screen.getByText('Cat Folder'));
    expect(screen.queryByText('Create thing')).toBeNull();
  });

  it('renders preview endpoints in a separate Preview section', () => {
    const { onAddFromCatalog } = setup({ previewEndpoints });
    fireEvent.click(screen.getByText('Catalog'));
    expect(screen.getByText('Preview (yours)')).toBeTruthy();
    expect(screen.getByText('Preview EP')).toBeTruthy();
    fireEvent.click(screen.getByText('Preview EP'));
    expect(onAddFromCatalog).toHaveBeenCalledWith('e1', 'ep-prev');
  });

  it('shows both Published and Preview section headers when both exist', () => {
    setup({ previewEndpoints });
    fireEvent.click(screen.getByText('Catalog'));
    expect(screen.getByText('Published')).toBeTruthy();
    expect(screen.getByText('Preview (yours)')).toBeTruthy();
  });

  it('shows both section headers when only published endpoints exist (preview shows empty hint)', () => {
    setup({ previewEndpoints: [] });
    fireEvent.click(screen.getByText('Catalog'));
    expect(screen.getByText('Published')).toBeTruthy();
    expect(screen.getByText('Preview (yours)')).toBeTruthy();
    expect(screen.getByTestId('wf-palette-preview-empty')).toBeTruthy();
    expect(screen.getByText('No preview endpoints')).toBeTruthy();
  });

  it('shows both section headers when only previews exist (published shows empty hint)', () => {
    setup({ catalogEntries: [], previewEndpoints });
    fireEvent.click(screen.getByText('Catalog'));
    expect(screen.getByText('Published')).toBeTruthy();
    expect(screen.getByText('Preview (yours)')).toBeTruthy();
    expect(screen.getByTestId('wf-palette-pub-empty')).toBeTruthy();
    expect(screen.getByText('No published endpoints')).toBeTruthy();
    expect(screen.getByText('Preview EP')).toBeTruthy();
  });

  it('collapses Published section when header is clicked', () => {
    setup({ previewEndpoints });
    fireEvent.click(screen.getByText('Catalog'));
    expect(screen.getByText('Catalog One')).toBeTruthy();
    fireEvent.click(screen.getByTestId('wf-palette-pub-section'));
    expect(screen.queryByText('Catalog One')).toBeNull();
    expect(screen.getByText('Preview EP')).toBeTruthy();
  });

  it('collapses Preview section when header is clicked', () => {
    setup({ previewEndpoints });
    fireEvent.click(screen.getByText('Catalog'));
    expect(screen.getByText('Preview EP')).toBeTruthy();
    fireEvent.click(screen.getByTestId('wf-palette-preview-section'));
    expect(screen.queryByText('Preview EP')).toBeNull();
    expect(screen.getByText('Catalog One')).toBeTruthy();
  });

  it('filters preview endpoints by search', () => {
    setup({ previewEndpoints });
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.change(screen.getByPlaceholderText('Search catalog…'), { target: { value: 'preview' } });
    expect(screen.getByText('Preview EP')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Search catalog…'), { target: { value: 'zzzznotfound' } });
    expect(screen.queryByText('Preview EP')).toBeNull();
  });

  it('filters preview endpoints by entryName', () => {
    setup({ previewEndpoints });
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.change(screen.getByPlaceholderText('Search catalog…'), { target: { value: 'Catalog One' } });
    expect(screen.getByText('Preview EP')).toBeTruthy();
  });

  it('shows endpoints published via workflowPublication (P2 field)', () => {
    const p2Entries: CatalogEntry[] = [{
      id: 'e5',
      name: 'P2 API',
      endpoints: [{
        id: 'ep-p2', method: 'post', path: '/p2-endpoint', summary: 'P2 Published',
        workflowPublication: { publishedAt: Date.now(), publishedFromVersionId: 'v1' },
      }],
      folders: [],
    } as unknown as CatalogEntry];
    const { onAddFromCatalog } = setup({ catalogEntries: p2Entries });
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.click(screen.getByText('P2 API'));
    fireEvent.click(screen.getByText('P2 Published'));
    expect(onAddFromCatalog).toHaveBeenCalledWith('e5', 'ep-p2');
  });

  it('shows stale badge for published endpoint when version differs', () => {
    const staleEntries: CatalogEntry[] = [{
      id: 'e6',
      name: 'Stale API',
      currentVersionId: 'v2',
      endpoints: [{
        id: 'ep-stale', method: 'get', path: '/stale', summary: 'Stale EP',
        workflowPublication: { publishedAt: 1000, publishedFromVersionId: 'v1' },
      }],
      folders: [],
    } as unknown as CatalogEntry];
    setup({ catalogEntries: staleEntries });
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.click(screen.getByText('Stale API'));
    expect(screen.getByTestId('wf-palette-stale-badge')).toBeTruthy();
  });

  it('does not show stale badge when version matches', () => {
    const currentEntries: CatalogEntry[] = [{
      id: 'e7',
      name: 'Current API',
      currentVersionId: 'v1',
      endpoints: [{
        id: 'ep-ok', method: 'get', path: '/current', summary: 'Current EP',
        workflowPublication: { publishedAt: 1000, publishedFromVersionId: 'v1' },
      }],
      folders: [],
    } as unknown as CatalogEntry];
    setup({ catalogEntries: currentEntries });
    fireEvent.click(screen.getByText('Catalog'));
    fireEvent.click(screen.getByText('Current API'));
    expect(screen.queryByTestId('wf-palette-stale-badge')).toBeNull();
  });
});
