/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowPalette from './WorkflowPalette';
import type { RequestCollection } from '../../../../shared/types';
import type { CatalogEntry } from '../../../catalog/types/catalog';

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
        endpoints: [{ id: 'ep1', method: 'post', path: '/create', summary: 'Create thing', workflowExposure: 'preview' }],
        folders: [
          { id: 'cf2', name: 'Cat Nested', endpoints: [{ id: 'ep2', method: 'put', path: '/edit', summary: 'Edit thing', exposedToWorkflow: true }], folders: [] },
        ],
      },
    ],
  } as unknown as CatalogEntry,
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

  it('toggles a category open/closed', () => {
    setup();
    const header = screen.getByText('Triggers').closest('button') as Element;
    expect(screen.getByText('Manual Start')).toBeTruthy();
    fireEvent.click(header);
    expect(screen.queryByText('Manual Start')).toBeNull();
    fireEvent.click(header);
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
    const search = screen.getByPlaceholderText('Search blocks…');
    fireEvent.change(search, { target: { value: 'zzzznotfound' } });
    expect(screen.getByText(/No blocks matching/)).toBeTruthy();
  });

  it('filters blocks to a matching block and clears search', () => {
    setup();
    const search = screen.getByPlaceholderText('Search blocks…');
    fireEvent.change(search, { target: { value: 'kafka' } });
    expect(document.querySelector('.wf-palette-block-kafkaProduce')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Manual Start')).toBeTruthy();
  });

  it('renders gRPC blocks and adds each gRPC non-advanced node type', () => {
    const { onAddNode } = setup();
    fireEvent.click(screen.getByText('gRPC Unary'));
    fireEvent.click(screen.getByText('gRPC Server Stream'));
    fireEvent.click(screen.getByText('gRPC Assert'));
    expect(onAddNode).toHaveBeenNthCalledWith(1, 'grpcUnary');
    expect(onAddNode).toHaveBeenNthCalledWith(2, 'grpcServerStream');
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
      endpoints: [{ id: 'epH', method: 'get', path: '/hidden', summary: 'Hidden', exposedToWorkflow: false }],
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
    const search = screen.getByPlaceholderText('Search blocks…');
    fireEvent.change(search, { target: { value: 'cron-based' } });
    expect(screen.getByText('Schedule Trigger')).toBeTruthy();
    expect(document.querySelector('.wf-palette-match')).toBeTruthy();
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
      endpoints: [{ id: 'epP', method: 'delete', path: '/no-summary', exposedToWorkflow: true }],
      folders: [{
        id: 'cfEmpty',
        name: 'Empty On Search',
        endpoints: [{ id: 'epX', method: 'get', path: '/other', summary: 'Other', exposedToWorkflow: true }],
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
      endpoints: [{ id: 'epF', method: 'foo', path: '/exotic-path', exposedToWorkflow: true }],
      folders: [{
        id: 'cf1',
        name: 'Nested',
        endpoints: [{ id: 'epN', method: 'bar', path: '/nested-path', summary: 'Nested EP', exposedToWorkflow: true }],
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
});
