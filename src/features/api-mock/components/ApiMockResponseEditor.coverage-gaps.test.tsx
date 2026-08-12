/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseEditor } from './ApiMockResponseEditor';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'route-1',
    name: 'Route 1',
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

function openTab(id: 'content' | 'headers' | 'timing') {
  fireEvent.click(screen.getByTestId(`api-mock-response-tab-${id}`));
}

describe('ApiMockResponseEditor coverage gaps', () => {
  it('covers preview formatting branches and missing-active-variant reset', () => {
    const onUpdateRoute = vi.fn();
    const okJson = {
      ...createDefaultResponse('resp-1'),
      status: 500,
      body: { kind: 'json', contentType: 'application/json', content: '{"ok":true}' },
      behavior: { delayMs: 10, jitterMs: 5 },
    };
    const { rerender } = render(
      <ApiMockResponseEditor route={makeRoute({ responses: [okJson] })} onUpdateRoute={onUpdateRoute} />,
    );
    expect(screen.getByTestId('api-mock-response-preview').textContent).toContain('"ok": true');
    expect(screen.getByTestId('api-mock-response-preview').textContent).toContain('10±5 ms');

    const badJson = { ...okJson, body: { ...okJson.body, content: '{bad' } };
    rerender(<ApiMockResponseEditor route={makeRoute({ responses: [badJson] })} onUpdateRoute={onUpdateRoute} />);
    expect(screen.getByTestId('api-mock-response-preview').textContent).toContain('{bad');

    const plain = { ...okJson, body: { ...okJson.body, contentType: 'text/plain', content: 'hello' }, behavior: { delayMs: 0, jitterMs: 0 } };
    rerender(<ApiMockResponseEditor route={makeRoute({ responses: [plain] })} onUpdateRoute={onUpdateRoute} />);
    expect(screen.getByTestId('api-mock-response-preview').textContent).toContain('hello');

    rerender(<ApiMockResponseEditor route={makeRoute({ responses: [] })} onUpdateRoute={onUpdateRoute} />);
    expect(screen.queryByTestId('api-mock-response-preview')).toBeNull();
  });

  it('covers response mode change, variant selection, and header add/update/remove paths', () => {
    const onUpdateRoute = vi.fn();
    const first = {
      ...createDefaultResponse('resp-1'),
      headers: [{ id: 'h1', key: 'X-A', value: '1', enabled: true }],
    };
    const second = { ...createDefaultResponse('resp-2'), name: 'Second', isDefault: false };
    render(
      <ApiMockResponseEditor route={makeRoute({ responses: [first, second] })} onUpdateRoute={onUpdateRoute} />,
    );

    const mode = screen.getByTestId('api-mock-response-mode');
    fireEvent.click(mode.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="weighted"]') as HTMLElement);
    expect(onUpdateRoute).toHaveBeenCalledWith({ responseMode: 'weighted' });

    fireEvent.click(screen.getByTestId('api-mock-variant-tab-resp-2'));
    fireEvent.click(screen.getByTestId('api-mock-variant-tab-resp-1'));
    fireEvent.change(screen.getByTestId('api-mock-variant-name'), { target: { value: 'Primary variant' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].name).toBe('Primary variant');
    openTab('headers');

    fireEvent.click(screen.getByTestId('api-mock-add-header'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].headers.length).toBe(2);

    fireEvent.change(screen.getAllByLabelText('Header name')[0], { target: { value: 'X-Tenant' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].headers[0].key).toBe('X-Tenant');

    fireEvent.change(screen.getAllByLabelText('Header value')[0], { target: { value: 'acme' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].headers[0].value).toBe('acme');

    fireEvent.click(screen.getByLabelText('Remove header'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].headers).toEqual([]);
  });
});
