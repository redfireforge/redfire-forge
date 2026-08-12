/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';

vi.mock('./ApiMockResponseEditor', () => ({
  ApiMockResponseEditor: ({ route }: { route: ApiMockRouteV1 }) => (
    <div data-testid="mock-response-editor">Response editor for {route.name}</div>
  ),
}));

vi.mock('./ApiMockPatternToolboxModal', () => ({
  ApiMockPatternToolboxModal: ({ onApply, onClose }: { onApply: (m: ApiMockRouteV1['path']) => void; onClose: () => void }) => (
    <div data-testid="mock-pattern-toolbox">
      <button data-testid="mock-pattern-apply" onClick={() => onApply({ kind: 'glob', value: '/api/**' })}>apply</button>
      <button data-testid="mock-pattern-close" onClick={onClose}>close</button>
    </div>
  ),
}));

import { ApiMockRouteEditor } from './ApiMockRouteEditor';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'route-1',
    name: 'New Route 1',
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

function openTab(label: string) {
  const list = screen.getByRole('tablist', { name: 'Route editor sections' });
  fireEvent.click(within(list).getAllByRole('tab').find(t => t.textContent?.trim().startsWith(label))!);
}

describe('ApiMockRouteEditor', () => {
  it('edits header fields and empty match conditions state', () => {
    const onUpdate = vi.fn();
    const onSimulate = vi.fn();
    const onDelete = vi.fn();
    render(<ApiMockRouteEditor route={makeRoute()} onUpdate={onUpdate} hasConflict onSimulate={onSimulate} onDelete={onDelete} />);

    expect(screen.getByTestId('api-mock-editor-conflict')).toBeTruthy();
    expect(screen.getByTestId('api-mock-conditions-empty')).toBeTruthy();

    fireEvent.change(screen.getByTestId('api-mock-route-name'), { target: { value: 'Users route' } });
    expect(onUpdate).toHaveBeenCalledWith({ name: 'Users route' });

    const method = screen.getByTestId('api-mock-method-select');
    fireEvent.click(method.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="POST"]') as HTMLElement);
    expect(onUpdate).toHaveBeenCalledWith({ method: 'POST' });

    fireEvent.change(screen.getByTestId('api-mock-path-input'), { target: { value: '/orders' } });
    expect(onUpdate).toHaveBeenCalledWith({ path: { kind: 'exact', value: '/orders' } });

    fireEvent.click(screen.getByTestId('api-mock-route-enabled'));
    expect(onUpdate).toHaveBeenCalledWith({ enabled: false });

    fireEvent.click(screen.getByTestId('api-mock-simulate'));
    fireEvent.click(screen.getByTestId('api-mock-delete-route'));
    expect(onSimulate).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it('adds, edits, and removes a match condition', () => {
    const onUpdate = vi.fn();
    render(<ApiMockRouteEditor route={makeRoute()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('api-mock-add-condition'));
    const addCall = onUpdate.mock.calls.at(-1)?.[0];
    expect(addCall.predicates.children).toHaveLength(1);

    const routeWithCondition = makeRoute({
      predicates: {
        id: 'pg',
        combinator: 'any',
        children: [{ id: 'pred-1', source: 'header', selector: 'name', operator: 'exact', expected: 'alice' }],
      } as any,
    });
    onUpdate.mockClear();
    render(<ApiMockRouteEditor route={routeWithCondition} onUpdate={onUpdate} />);

    expect(screen.getByText(/Any of 1/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Condition selector'), { target: { value: 'x-tenant' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].selector).toBe('x-tenant');

    const source = screen.getByTestId('api-mock-condition-source-pred-1');
    fireEvent.click(source.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="query"]') as HTMLElement);
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].source).toBe('query');

    const operator = screen.getByTestId('api-mock-condition-operator-pred-1');
    fireEvent.click(operator.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="present"]') as HTMLElement);
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].operator).toBe('present');

    fireEvent.click(screen.getByTestId('api-mock-condition-remove-pred-1'));
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children).toHaveLength(0);
  });

  it('covers nested predicate groups, not-combinator label, disabled value field, and priority fallback', () => {
    const onUpdate = vi.fn();
    const route = makeRoute({
      predicates: {
        id: 'pg',
        combinator: 'not',
        children: [
          { id: 'nested', combinator: 'all', children: [] },
          { id: 'pred-2', source: 'query', selector: 'q', operator: 'absent', expected: '' },
        ],
      } as any,
    });
    render(<ApiMockRouteEditor route={route} onUpdate={onUpdate} />);

    expect(screen.getByText(/None of 1/i)).toBeTruthy();
    expect(screen.getByLabelText('Condition value')).toBeDisabled();

    fireEvent.change(screen.getByTestId('api-mock-priority-input'), { target: { value: '' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]).toEqual({ priority: 0 });

    fireEvent.change(screen.getByLabelText('Condition value'), { target: { value: 'ignored' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[1].expected).toBe('ignored');
  });

  it('opens the response tab and toolbox modal', () => {
    const onUpdate = vi.fn();
    render(<ApiMockRouteEditor route={makeRoute()} onUpdate={onUpdate} />);

    openTab('Response');
    expect(screen.getByTestId('mock-response-editor')).toHaveTextContent('New Route 1');

    openTab('Match');
    fireEvent.click(screen.getByTestId('api-mock-path-toolbox'));
    expect(screen.getByTestId('mock-pattern-toolbox')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mock-pattern-close'));
    expect(screen.queryByTestId('mock-pattern-toolbox')).toBeNull();
    fireEvent.click(screen.getByTestId('api-mock-path-toolbox'));
    fireEvent.click(screen.getByTestId('mock-pattern-apply'));
    expect(onUpdate).toHaveBeenCalledWith({ path: { kind: 'glob', value: '/api/**' } });
  });

  it('covers behavior, examples, and docs tabs', () => {
    const onUpdate = vi.fn();
    const route = makeRoute({
      responseMode: 'state',
      tags: ['users'],
      operationId: 'getUsers',
      responses: [{ ...createDefaultResponse('resp-1'), behavior: { delayMs: 50, jitterMs: 5, fault: 'timeout' } }],
    });
    render(<ApiMockRouteEditor route={route} onUpdate={onUpdate} />);

    openTab('Behavior');
    expect(screen.getByText(/Fault “timeout”/)).toBeTruthy();

    const fault = screen.getByTestId('api-mock-fault-select');
    fireEvent.click(fault.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="none"]') as HTMLElement);
    expect(onUpdate.mock.calls.at(-1)?.[0].responses[0].behavior.fault).toBe('none');

    fireEvent.change(screen.getByTestId('api-mock-behavior-delay'), { target: { value: '' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].responses[0].behavior.delayMs).toBe(0);
    fireEvent.change(screen.getByTestId('api-mock-behavior-jitter'), { target: { value: '' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].responses[0].behavior.jitterMs).toBe(0);

    openTab('Examples');
    expect(screen.getByText(/Captured transactions can be promoted/i)).toBeTruthy();

    openTab('Documentation');
    fireEvent.change(screen.getByTestId('api-mock-docs-operation-id'), { target: { value: '' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]).toEqual({ operationId: undefined });
    fireEvent.change(screen.getByTestId('api-mock-docs-tags'), { target: { value: 'users, public,  ,' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].tags).toEqual(['users', 'public']);
  });

  it('renders blank docs fields when operationId is absent', () => {
    render(<ApiMockRouteEditor route={makeRoute({ operationId: undefined, tags: [] })} onUpdate={vi.fn()} />);
    openTab('Documentation');
    expect((screen.getByTestId('api-mock-docs-operation-id') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('api-mock-docs-tags') as HTMLInputElement).value).toBe('');
  });

  it('handles behavior tab when there is no default variant to update', () => {
    const onUpdate = vi.fn();
    const route = makeRoute({ responses: [] });
    render(<ApiMockRouteEditor route={route} onUpdate={onUpdate} />);

    openTab('Behavior');
    fireEvent.change(screen.getByTestId('api-mock-behavior-delay'), { target: { value: '15' } });
    fireEvent.change(screen.getByTestId('api-mock-behavior-jitter'), { target: { value: '2' } });
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
