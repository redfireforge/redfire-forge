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
    endpoints: [{ id: 'ep0', method: 'get', path: '/root', summary: 'Root EP', exposedToWorkflow: true }],
    folders: [
      {
        id: 'cf1',
        name: 'Cat Folder',
        endpoints: [{ id: 'ep1', method: 'post', path: '/create', summary: 'Create thing', exposedToWorkflow: true }],
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

  it('filters catalog by search query', () => {
    setup();
    fireEvent.click(screen.getByText('Catalog'));
    const search = screen.getByPlaceholderText('Search catalog…');
    fireEvent.change(search, { target: { value: 'create' } });
    expect(screen.getByText('Catalog One')).toBeTruthy();
  });
});
