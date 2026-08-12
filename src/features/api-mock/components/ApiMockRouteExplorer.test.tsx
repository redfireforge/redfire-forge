/**
 * @vitest-environment jsdom
 */
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
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    fireEvent.click(screen.getByTestId('api-mock-add-folder'));
    expect(onCreate).toHaveBeenCalled();
    expect(onAddFolder).toHaveBeenCalled();
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
    expect(second).toHaveAttribute('title', 'Users Route');
    expect(within(second).getByText('/')).toBeInTheDocument();
    expect(screen.getByText('1 enabled · 1 draft')).toBeInTheDocument();

    fireEvent.click(first);
    fireEvent.doubleClick(second);
    fireEvent.click(screen.getByTestId('api-mock-analyze'));
    expect(onSelect).toHaveBeenCalledWith('r1');
    expect(onToggle).toHaveBeenCalledWith('r2', true);
    expect(onAnalyze).toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole('button', { name: /Core/ }));
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
