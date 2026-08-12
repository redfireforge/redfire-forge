/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

function openResponseTab(label: string) {
  fireEvent.click(screen.getByTestId(`api-mock-response-tab-${label}`));
}

describe('ApiMockResponseEditor', () => {
  it('updates status, content type, body, delay, and jitter', () => {
    const onUpdateRoute = vi.fn();
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={onUpdateRoute} />);

    fireEvent.change(screen.getByTestId('api-mock-variant-status'), { target: { value: '204' } });
    expect(onUpdateRoute).toHaveBeenCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ status: 204 })] }));

    fireEvent.change(screen.getByTestId('api-mock-variant-content-type'), { target: { value: 'application/json' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ body: expect.objectContaining({ contentType: 'application/json' }) })] }));

    fireEvent.change(screen.getByTestId('api-mock-variant-body'), { target: { value: '{"ok":true}' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ body: expect.objectContaining({ content: '{"ok":true}' }) })] }));

    openResponseTab('timing');
    fireEvent.change(screen.getByTestId('api-mock-variant-delay'), { target: { value: '150' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ behavior: expect.objectContaining({ delayMs: 150 }) })] }));

    fireEvent.change(screen.getByTestId('api-mock-variant-jitter'), { target: { value: '25' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ behavior: expect.objectContaining({ jitterMs: 25 }) })] }));
  });

  it('falls back to defaults for invalid numeric input and clears empty content type', () => {
    const onUpdateRoute = vi.fn();
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={onUpdateRoute} />);

    fireEvent.change(screen.getByTestId('api-mock-variant-status'), { target: { value: '' } });
    expect(onUpdateRoute).toHaveBeenCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ status: 200 })] }));

    openResponseTab('timing');
    fireEvent.change(screen.getByTestId('api-mock-variant-delay'), { target: { value: '' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ behavior: expect.objectContaining({ delayMs: 0 }) })] }));

    fireEvent.change(screen.getByTestId('api-mock-variant-jitter'), { target: { value: '' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ behavior: expect.objectContaining({ jitterMs: 0 }) })] }));

    openResponseTab('content');
    fireEvent.change(screen.getByTestId('api-mock-variant-content-type'), { target: { value: '' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ body: expect.objectContaining({ kind: 'none', content: '' }) })] }));
  });

  it('adds and deletes response variants when multiple variants exist', () => {
    const onUpdateRoute = vi.fn();
    const second = { ...createDefaultResponse('resp-2'), name: 'Variant 2', isDefault: false };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [createDefaultResponse('resp-1'), second] })} onUpdateRoute={onUpdateRoute} />);

    fireEvent.click(screen.getByTestId('api-mock-add-variant'));
    expect(onUpdateRoute).toHaveBeenCalledWith(expect.objectContaining({ responses: expect.arrayContaining([expect.objectContaining({ name: 'Variant 3' })]) }));

    fireEvent.click(screen.getByTestId('api-mock-delete-variant'));
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ id: 'resp-2' })] }));
  });

  it('does not render a delete button when there is only one variant', () => {
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={vi.fn()} />);
    expect(screen.queryByTestId('api-mock-delete-variant')).toBeNull();
  });

  it('renders populated headers and cookies on the headers tab', () => {
    const variant = {
      ...createDefaultResponse('resp-1'),
      headers: [
        { id: 'h1', key: 'X-Tenant', value: 'acme', enabled: true },
        { id: 'h2', key: 'X-Debug', value: '0', enabled: false },
      ],
      cookies: [
        { id: 'c1', name: 'sid', value: 'abc', httpOnly: true, secure: true, sameSite: 'Lax', path: '/', domain: undefined, expiresAt: undefined },
        { id: 'c2', name: 'mode', value: 'debug', httpOnly: false, secure: false, sameSite: undefined, path: '/', domain: undefined, expiresAt: undefined },
      ],
    };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [variant] })} onUpdateRoute={vi.fn()} />);
    openResponseTab('headers');

    expect(screen.queryByText('No custom headers.')).toBeNull();
    expect(screen.queryByText('No cookies.')).toBeNull();
    expect(screen.getByDisplayValue('X-Tenant')).toBeTruthy();
    expect(screen.getByDisplayValue('X-Debug')).toBeTruthy();
    expect(screen.getByDisplayValue('sid')).toBeTruthy();
    expect(screen.getByDisplayValue('mode')).toBeTruthy();
    expect(screen.getByText(/HttpOnly Secure Lax/)).toBeTruthy();
  });

  it('renders preview pane, empty placeholders, and helper notice', () => {
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={vi.fn()} />);
    expect(screen.getByTestId('api-mock-response-preview')).toBeTruthy();
    openResponseTab('headers');
    expect(screen.getByText('No custom headers.')).toBeTruthy();
    expect(screen.getByText('No cookies.')).toBeTruthy();
    expect(screen.getByText(/Template helpers:/i)).toBeTruthy();
    expect(screen.getByTestId('api-mock-variant-tab-resp-1').textContent).toMatch(/Default/i);
  });
});
