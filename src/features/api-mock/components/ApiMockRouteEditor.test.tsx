/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { CUSTOM_SELECT_SET_VALUE_EVENT } from '../../../shared/components/CustomSelect';

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
    render(<ApiMockRouteEditor route={makeRoute()} onUpdate={onUpdate} hasConflict onSimulate={onSimulate} />);

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
    expect(onSimulate).toHaveBeenCalled();
    // Deletion lives on the rule row in the explorer, not the editor header.
    expect(screen.queryByTestId('api-mock-delete-route')).toBeNull();
  });

  it('adds, edits, and removes a match condition', () => {
    const onUpdate = vi.fn();
    const first = render(<ApiMockRouteEditor route={makeRoute()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('api-mock-add-condition'));
    const addCall = onUpdate.mock.calls.at(-1)?.[0];
    expect(addCall.predicates.children).toHaveLength(1);
    first.unmount();

    const routeWithCondition = makeRoute({
      predicates: {
        id: 'pg',
        combinator: 'any',
        children: [{ id: 'pred-1', source: 'header', selector: 'name', operator: 'exact', expected: 'alice' }],
      } as any,
    });
    onUpdate.mockClear();
    render(<ApiMockRouteEditor route={routeWithCondition} onUpdate={onUpdate} />);

    expect(screen.getByTestId('api-mock-group-combinator-pg').textContent).toContain('Any of');
    expect(screen.getByText(/1 condition/i)).toBeTruthy();
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

  it('uses a security selector picker and shows JSON Schema in the operator list', () => {
    const onUpdate = vi.fn();
    render(
      <ApiMockRouteEditor
        route={makeRoute({
          predicates: {
            id: 'pg',
            combinator: 'all',
            children: [
              { id: 'pred-sec', source: 'security', selector: 'certSubject', operator: 'exact', expected: 'CN=acme' },
              { id: 'pred-schema', source: 'body', selector: '', operator: 'jsonSchema', expected: { type: 'object' } },
            ],
          } as any,
        })}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByTestId('api-mock-condition-selector-pred-sec').textContent).toContain('Certificate subject');
    fireEvent(
      screen.getByTestId('api-mock-condition-selector-pred-sec'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'scheme' }, bubbles: true }),
    );
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].selector).toBe('scheme');

    const source = screen.getByTestId('api-mock-condition-source-pred-schema');
    fireEvent.click(source.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="security"]') as HTMLElement);
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[1].source).toBe('security');
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[1].selector).toBe('scheme');

    expect(screen.getByTestId('api-mock-condition-schema-pred-schema')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-condition-unavailable-pred-schema')).toBeNull();
    expect(screen.getByTestId('api-mock-condition-operator-pred-schema').textContent).toMatch(/JSON Schema/);
    expect(screen.getByTestId('api-mock-condition-toolbox-pred-schema')).toBeTruthy();
    expect(screen.getByDisplayValue('CN=acme')).toHaveAttribute('placeholder', 'CN=client-name');
  });

  it('does not pretend an empty security selector is scheme', () => {
    render(
      <ApiMockRouteEditor
        route={makeRoute({
          predicates: {
            id: 'pg',
            combinator: 'all',
            children: [{ id: 'pred-empty', source: 'security', selector: '', operator: 'exact', expected: 'Bearer' }],
          } as any,
        })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-condition-selector-pred-empty').textContent).not.toContain('Scheme');
    expect(screen.getByTestId('api-mock-condition-selector-pred-empty').textContent).toMatch(/Selector/i);
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

    expect(screen.getByTestId('api-mock-group-combinator-pg').textContent).toContain('None of');
    // The nested group is rendered and editable, with its own empty-state hint.
    expect(screen.getByTestId('api-mock-group-nested')).toBeTruthy();
    expect(screen.getByTestId('api-mock-group-empty-nested')).toBeTruthy();
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

  it('toggles matchStyle from subset back to exact when rerendered', () => {
    const onUpdate = vi.fn();
    const route = makeRoute({
      predicates: {
        id: 'pg',
        combinator: 'all',
        children: [{
          id: 'pred-jp',
          source: 'body',
          selector: '',
          operator: 'jsonPath_equals',
          expected: ['$.a', 'b'],
          options: { matchStyle: 'subset' },
        }],
      } as any,
    });
    const { rerender } = render(<ApiMockRouteEditor route={route} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId('api-mock-condition-matchstyle-pred-jp'));
    expect(onUpdate.mock.calls.at(-1)?.[0].predicates.children[0].options.matchStyle).toBe('exact');

    const updated = {
      ...route,
      predicates: {
        ...route.predicates,
        children: [{ ...route.predicates.children[0], options: { matchStyle: 'exact' as const } }],
      },
    };
    rerender(<ApiMockRouteEditor route={updated} onUpdate={onUpdate} />);
    expect(screen.getByTestId('api-mock-condition-matchstyle-pred-jp').textContent).toBe('equals');
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

  it('preserves regex path kind when editing path value', () => {
    const onUpdate = vi.fn();
    render(<ApiMockRouteEditor route={makeRoute({ path: { kind: 'regex', value: '^/users/\\d+$' } })} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByTestId('api-mock-path-input'), { target: { value: '^/orders/\\d+$' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].path.kind).toBe('regex');
  });
});
