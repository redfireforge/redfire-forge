/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CUSTOM_SELECT_SET_VALUE_EVENT } from '../../../shared/components/CustomSelect';
import { ApiMockRouteExplorer } from './ApiMockRouteExplorer';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'r1',
    name: 'Users Route',
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/users' },
    priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules',
    responses: [createDefaultResponse('resp-1')],
    tags: ['api'],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe('ApiMockRouteExplorer coverage gaps', () => {
  it('covers method filter, drawer close, folder rename, and End key', () => {
    const onCloseDrawer = vi.fn();
    const onRenameFolder = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[
          makeRoute(),
          makeRoute({ id: 'r2', method: 'DELETE', name: 'Delete user', path: { kind: 'exact', value: '/users/:id' } }),
        ]}
        folders={[{ id: 'f1', name: 'Core', sortOrder: 0, expanded: true }]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onRenameFolder={onRenameFolder}
        drawerOpen
        onCloseDrawer={onCloseDrawer}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-close-routes'));
    expect(onCloseDrawer).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('api-mock-route-filter'));
    fireEvent(
      screen.getByTestId('api-mock-filter-method'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'DELETE' }, bubbles: true }),
    );
    expect(screen.queryByTestId('api-mock-route-r1')).not.toBeInTheDocument();

    fireEvent.doubleClick(screen.getByTestId('api-mock-folder-f1').querySelector('.am-folder-name')!);
    fireEvent.change(screen.getByTestId('api-mock-folder-rename-input-f1'), { target: { value: 'Renamed' } });
    fireEvent.keyDown(screen.getByTestId('api-mock-folder-rename-input-f1'), { key: 'Enter' });
    expect(onRenameFolder).toHaveBeenCalledWith('f1', 'Renamed');

    const tree = screen.getByRole('tree', { name: 'Rule list' });
    const items = within(tree).getAllByRole('treeitem');
    items[0].focus();
    fireEvent.keyDown(tree, { key: 'End' });
    expect(items[items.length - 1]).toHaveFocus();
  });

  it('covers tag search and drag lifecycle', () => {
    render(
      <ApiMockRouteExplorer
        routes={[makeRoute({ id: 'r1', tags: ['billing'] })]}
        folders={[{ id: 'f1', name: 'Core', sortOrder: 0, expanded: true }]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onMoveRoute={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('api-mock-route-search'), { target: { value: 'billing' } });
    expect(screen.getByTestId('api-mock-route-r1')).toBeInTheDocument();

    const dragged = screen.getByTestId('api-mock-route-r1');
    fireEvent.dragStart(dragged, {
      dataTransfer: { setData: vi.fn(), getData: vi.fn(() => 'r1'), effectAllowed: 'move', dropEffect: 'move' },
    });
    fireEvent.dragEnd(dragged);
  });

  it('covers empty folder add shortcut', () => {
    const onCreate = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[]}
        folders={[{ id: 'f1', name: 'Empty folder', sortOrder: 0, expanded: true }]}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-folder-empty-add-f1'));
    expect(onCreate).toHaveBeenCalledWith('f1');
  });

  it('covers high priority styling, conflict tooltip, and same-folder drop guard', () => {
    const onMoveRoute = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[makeRoute({ id: 'r1', folderId: 'f1', priority: 120 })]}
        folders={[{ id: 'f1', name: 'Core', sortOrder: 0, expanded: true }]}
        selectedRouteId="r1"
        conflictRouteIds={['r1']}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onMoveRoute={onMoveRoute}
      />,
    );

    expect(screen.getByTestId('api-mock-route-r1')).toHaveAttribute('title', 'Potential overlap with another route');
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'r1'),
      effectAllowed: 'move',
      dropEffect: 'move',
    };
    fireEvent.dragStart(screen.getByTestId('api-mock-route-r1'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('api-mock-folder-f1'), { dataTransfer });
    expect(onMoveRoute).not.toHaveBeenCalled();
  });

  it('covers rename escape and filters-active indicator', () => {
    render(
      <ApiMockRouteExplorer
        routes={[makeRoute({ id: 'r1', enabled: false })]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onRenameFolder={vi.fn()}
        folders={[{ id: 'f1', name: 'Core', sortOrder: 0, expanded: true }]}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-route-filter'));
    fireEvent.click(screen.getByTestId('api-mock-filter-show-disabled'));
    expect(screen.getByTestId('api-mock-route-filter')).toHaveClass('active');

    fireEvent.doubleClick(screen.getByTestId('api-mock-folder-f1').querySelector('.am-folder-name')!);
    fireEvent.keyDown(screen.getByTestId('api-mock-folder-rename-input-f1'), { key: 'Escape' });
    expect(screen.queryByTestId('api-mock-folder-rename-input-f1')).not.toBeInTheDocument();
  });

  it('covers drag leave, ungrouped drop target, high priority badge, and collapsed folders', () => {
    const onMoveRoute = vi.fn();
    const onRenameFolder = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[
          makeRoute({ id: 'r1', folderId: 'f1', priority: 150 }),
          makeRoute({ id: 'r2', folderId: 'f1', method: 'ANY', path: { kind: 'exact', value: '/any' }, priority: 120 }),
        ]}
        folders={[
          { id: 'f1', name: 'Core', sortOrder: 0, expanded: true },
          { id: 'f2', name: 'Hidden', sortOrder: 1, expanded: false },
        ]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onMoveRoute={onMoveRoute}
        onRenameFolder={onRenameFolder}
      />,
    );

    expect(screen.getByTestId('api-mock-route-r2').querySelector('.success')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-route-r1')).toBeInTheDocument();

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn((type: string) => (type === 'application/x-api-mock-route' || type === 'text/plain' ? 'r2' : '')),
      effectAllowed: 'move',
      dropEffect: 'move',
    };
    fireEvent.dragStart(screen.getByTestId('api-mock-route-r2'), { dataTransfer });
    const folder = screen.getByTestId('api-mock-folder-f1');
    fireEvent.dragOver(folder, { dataTransfer });
    fireEvent.dragOver(folder, { dataTransfer });
    fireEvent.dragLeave(folder, { relatedTarget: document.body });
    fireEvent.dragOver(folder, { dataTransfer });

    const zone = screen.getByTestId('api-mock-ungrouped-zone');
    fireEvent.dragOver(zone, { dataTransfer });
    fireEvent.dragLeave(zone, { relatedTarget: document.body });
    fireEvent.drop(zone, { dataTransfer });
    expect(onMoveRoute).toHaveBeenCalledWith('r2', undefined);

    fireEvent.click(screen.getByTestId('api-mock-folder-f1').querySelector('.am-tree-folder')!);
    fireEvent.doubleClick(screen.getByTestId('api-mock-folder-f1').querySelector('.am-folder-name')!);
    fireEvent.change(screen.getByTestId('api-mock-folder-rename-input-f1'), { target: { value: '  Ops  ' } });
    fireEvent.blur(screen.getByTestId('api-mock-folder-rename-input-f1'));
    expect(onRenameFolder).toHaveBeenCalledWith('f1', 'Ops');

    fireEvent.change(screen.getByTestId('api-mock-route-search'), { target: { value: 'zzzzz' } });
    expect(screen.queryByTestId('api-mock-folder-f2')).not.toBeInTheDocument();
  });

  it('covers ANY method filter match and folder without toggle handler', () => {
    render(
      <ApiMockRouteExplorer
        routes={[makeRoute({ id: 'r-any', method: 'ANY' })]}
        folders={[{ id: 'f1', name: 'Core', sortOrder: 0, expanded: true }]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-route-filter'));
    fireEvent(
      screen.getByTestId('api-mock-filter-method'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'POST' }, bubbles: true }),
    );
    expect(screen.getByTestId('api-mock-route-r-any')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-folder-f1').querySelector('.am-tree-folder')!);
  });
});
