/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockRouteExplorer } from './ApiMockRouteExplorer';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function route(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
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
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe('ApiMockRouteExplorer', () => {
  it('renders the empty state and add/import controls', () => {
    const onCreate = vi.fn();
    const onAddFolder = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[]}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onAddFolder={onAddFolder}
      />,
    );

    expect(screen.getByTestId('api-mock-routes-empty')).toHaveTextContent('No rules yet');
    expect(screen.getByTestId('api-mock-routes-empty').textContent).toMatch(/404/);
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    fireEvent.click(screen.getByTestId('api-mock-add-folder'));
    expect(onCreate).toHaveBeenCalled();
    expect(onAddFolder).toHaveBeenCalled();
  });

  it('explains unmatched 404 when the empty listener is running', () => {
    render(
      <ApiMockRouteExplorer
        routes={[]}
        running
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-routes-empty').textContent).toMatch(/listener is running/);
    expect(screen.getByTestId('api-mock-routes-empty').textContent).toMatch(/404/);
  });

  it('filters routes, shows no-match state, and renders conflict counts', () => {
    render(
      <ApiMockRouteExplorer
        routes={[route(), route({ id: 'r2', name: 'Orders Route', method: 'POST', path: { kind: 'exact', value: '/orders' } })]}
        selectedRouteId="r1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        conflictRouteIds={['r2']}
      />,
    );

    expect(screen.getByTitle('1 conflicts')).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-route-r1')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('api-mock-route-r2')).toHaveAttribute('tabindex', '-1');

    fireEvent.change(screen.getByTestId('api-mock-route-search'), { target: { value: 'missing' } });
    expect(screen.getByTestId('api-mock-routes-no-match')).toHaveTextContent('No rules match');

    fireEvent.change(screen.getByTestId('api-mock-route-search'), { target: { value: 'post' } });
    expect(screen.queryByTestId('api-mock-routes-no-match')).not.toBeInTheDocument();
    expect(screen.getByTestId('api-mock-route-r2')).toBeInTheDocument();
  });

  it('opens a non-native filter popover, toggles options, and closes on outside click', () => {
    render(
      <ApiMockRouteExplorer
        routes={[
          route(),
          route({ id: 'r2', enabled: false, method: 'POST', path: { kind: 'exact', value: '/orders' } }),
          route({ id: 'r3', method: 'PUT', path: { kind: 'exact', value: '/x' } }),
        ]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        conflictRouteIds={['r3']}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-route-filter'));
    const panel = screen.getByTestId('api-mock-route-filter-panel');
    expect(panel).toBeInTheDocument();
    expect(panel.querySelector('input[type="checkbox"]')).toBeNull();
    expect(panel.querySelector('select')).toBeNull();

    const showDisabled = screen.getByTestId('api-mock-filter-show-disabled');
    expect(showDisabled).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(showDisabled);
    expect(showDisabled).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByTestId('api-mock-route-r2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('api-mock-filter-conflicts-only'));
    expect(screen.getByTestId('api-mock-filter-conflicts-only')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('api-mock-route-r3')).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-route-r1')).not.toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('api-mock-route-filter-panel')).not.toBeInTheDocument();
  });

  it('closes the filter popover on Escape', () => {
    render(
      <ApiMockRouteExplorer
        routes={[route()]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-route-filter'));
    expect(screen.getByTestId('api-mock-route-filter-panel')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('api-mock-route-filter-panel')).not.toBeInTheDocument();
  });

  it('creates rules in a folder, deletes folders, and supports drag-and-drop filing', () => {
    const onCreate = vi.fn();
    const onDeleteFolder = vi.fn();
    const onMoveRoute = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[route({ id: 'r1' }), route({ id: 'r2', folderId: 'fld-1', path: { kind: 'exact', value: '/in-folder' } })]}
        folders={[{ id: 'fld-1', name: 'Folder 1', sortOrder: 0, expanded: true } as any]}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onDeleteFolder={onDeleteFolder}
        onMoveRoute={onMoveRoute}
      />,
    );

    expect(screen.getByTestId('api-mock-folder-fld-1').querySelector('.am-folder-name')).toHaveTextContent('Folder 1');
    fireEvent.click(screen.getByTestId('api-mock-folder-add-route-fld-1'));
    expect(onCreate).toHaveBeenCalledWith('fld-1');

    fireEvent.click(screen.getByTestId('api-mock-folder-delete-fld-1'));
    expect(onDeleteFolder).toHaveBeenCalledWith('fld-1');

    const dragged = screen.getByTestId('api-mock-route-r1');
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn((type: string) => (type === 'application/x-api-mock-route' || type === 'text/plain' ? 'r1' : '')),
      effectAllowed: 'none',
      dropEffect: 'none',
    };
    fireEvent.dragStart(dragged, { dataTransfer });
    const folder = screen.getByTestId('api-mock-folder-fld-1');
    fireEvent.dragOver(folder, { dataTransfer });
    fireEvent.drop(folder, { dataTransfer });
    expect(onMoveRoute).toHaveBeenCalledWith('r1', 'fld-1');

    onMoveRoute.mockClear();
    fireEvent.dragStart(screen.getByTestId('api-mock-route-r2'), { dataTransfer: { ...dataTransfer, getData: vi.fn(() => 'r2') } });
    fireEvent.drop(screen.getByTestId('api-mock-ungrouped-zone'), {
      dataTransfer: { ...dataTransfer, getData: vi.fn(() => 'r2') },
    });
    expect(onMoveRoute).toHaveBeenCalledWith('r2', undefined);
  });

  it('selects and toggles routes and renders the footer summary', () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    const onAnalyze = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[route(), route({ id: 'r2', enabled: false, priority: 20, path: { kind: 'exact', value: '' } })]}
        onSelect={onSelect}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={onToggle}
        onAnalyze={onAnalyze}
      />,
    );

    const first = screen.getByTestId('api-mock-route-r1');
    const second = screen.getByTestId('api-mock-route-r2');
    expect(first).toHaveClass('is-live');
    expect(second).toHaveClass('disabled', 'is-draft');
    expect(second).toHaveAttribute('title', 'Draft — not matching');
    expect(second).toHaveAttribute('data-enabled', 'false');
    expect(screen.getByTestId('api-mock-route-state-r1')).toHaveTextContent('On');
    expect(screen.getByTestId('api-mock-route-state-r2')).toHaveTextContent('Draft');
    expect(within(second).getByText('/')).toBeInTheDocument();
    expect(screen.getByText('1 enabled · 1 draft')).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-routes-footer')).toHaveTextContent('1 enabled · 1 draft');
    expect(screen.getByTestId('api-mock-routes-enabled')).toHaveClass('is-live');
    expect(screen.getByTestId('api-mock-routes-draft')).toHaveClass('is-draft');
    expect(screen.getByTestId('api-mock-routes-enabled')).toHaveTextContent('1Enabled');
    expect(screen.getByTestId('api-mock-routes-draft')).toHaveTextContent('1Draft');
    expect(screen.getByTestId('api-mock-cli-simulate')).toHaveTextContent('redfireforge mock simulate workspace.json');
    expect(screen.getByTestId('api-mock-cli-verify')).toHaveTextContent('redfireforge mock verify workspace.json');

    fireEvent.click(first);
    fireEvent.doubleClick(second);
    fireEvent.click(screen.getByTestId('api-mock-route-state-r2'));
    fireEvent.click(screen.getByTestId('api-mock-analyze'));
    expect(onSelect).toHaveBeenCalledWith('r1');
    expect(onToggle).toHaveBeenCalledWith('r2', true);
    expect(onAnalyze).toHaveBeenCalled();
  });

  it('styles the footer chips for a draft-only library', () => {
    render(
      <ApiMockRouteExplorer
        routes={[route({ enabled: false })]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByTestId('api-mock-routes-footer')).toHaveTextContent('0 enabled · 1 draft');
    expect(screen.getByTestId('api-mock-routes-enabled')).toHaveClass('is-empty');
    expect(screen.getByTestId('api-mock-routes-draft')).toHaveClass('is-draft');
    expect(screen.getByTestId('api-mock-routes-draft')).toHaveTextContent('1Draft');
  });

  it('supports tree roving keyboard navigation and no-op branches', () => {
    const onToggleFolder = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[
          route({ id: 'r1', folderId: 'f1', tags: ['users'], operationId: 'listUsers' }),
          route({ id: 'r2', name: 'Orders Route', method: 'POST', path: { kind: 'exact', value: '/orders' } }),
        ]}
        folders={[{ id: 'f1', name: 'Core', sortOrder: 1, expanded: true } as any]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onToggleFolder={onToggleFolder}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-folder-f1').querySelector('.am-tree-folder')!);
    expect(onToggleFolder).toHaveBeenCalledWith('f1');

    fireEvent.change(screen.getByTestId('api-mock-route-search'), { target: { value: 'users' } });
    expect(screen.getByTestId('api-mock-route-r1')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('api-mock-route-search'), { target: { value: 'listusers' } });
    expect(screen.getByTestId('api-mock-route-r1')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('api-mock-route-search'), { target: { value: '' } });

    const tree = screen.getByRole('tree', { name: 'Rule list' });
    const items = within(tree).getAllByRole('treeitem');

    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(items[0]).not.toHaveFocus();

    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'Home' });
    expect(items[0]).toHaveFocus();

    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();

    fireEvent.keyDown(items[1], { key: 'ArrowDown' });
    expect(items[0]).toHaveFocus();

    fireEvent.keyDown(items[0], { key: 'x' });
    expect(items[0]).toHaveFocus();
  });
});

describe('ApiMockRouteExplorer — per-rule delete', () => {
  it('deletes the rule it belongs to, without selecting it', () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    render(
      <ApiMockRouteExplorer
        routes={[route(), route({ id: 'r2', name: 'Orders', path: { kind: 'exact', value: '/orders' } })]}
        onSelect={onSelect}
        onCreate={vi.fn()}
        onDelete={onDelete}
        onToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('api-mock-route-delete-r2'));
    expect(onDelete).toHaveBeenCalledWith('r2');
    expect(onDelete).toHaveBeenCalledTimes(1);
    // The trash sits beside the row button, so it must not also select the rule.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('labels each delete control with its rule name', () => {
    render(
      <ApiMockRouteExplorer
        routes={[route()]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Delete rule Users Route')).toBeTruthy();
  });

  it('keeps rule rows as the only treeitems so arrow-key nav is unaffected', () => {
    render(
      <ApiMockRouteExplorer
        routes={[route(), route({ id: 'r2' })]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(document.querySelectorAll('[role="treeitem"]')).toHaveLength(2);
  });

  it('marks copy-imported rows and copies the CLI handoff', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
    render(
      <ApiMockRouteExplorer
        routes={[route({ id: 'r-copy', name: 'Users Route (copy)', enabled: false })]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-route-r-copy')).toHaveAttribute('data-copied', 'true');
    expect(screen.getByTestId('api-mock-route-r-copy')).toHaveAttribute('data-route-name', 'Users Route (copy)');
    fireEvent.click(screen.getByTestId('api-mock-cli-simulate-copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('redfireforge mock simulate workspace.json');
    fireEvent.click(screen.getByTestId('api-mock-cli-verify-copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('redfireforge mock verify workspace.json');
  });
});
