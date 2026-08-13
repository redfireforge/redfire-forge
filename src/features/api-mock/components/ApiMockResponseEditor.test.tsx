/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseEditor } from './ApiMockResponseEditor';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';
import { CUSTOM_SELECT_SET_VALUE_EVENT } from '../../../shared/components/CustomSelect';

vi.mock('./ApiMockBodyEditor', () => ({
  ApiMockBodyEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="api-mock-variant-body" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));
const { createAdapter } = vi.hoisted(() => ({
  createAdapter: vi.fn(() => ({ contextId: 'api-mock-body' })),
}));
vi.mock('../../../shared/components/data-mapper/DataMapperModal', () => ({
  default: ({ onSave, onCancel }: { onSave: (v: string) => void; onCancel: () => void }) => (
    <div data-testid="api-mock-body-mapper">
      <button type="button" data-testid="api-mock-body-mapper-save" onClick={() => onSave('{"mapped":true}')}>save</button>
      <button type="button" data-testid="api-mock-body-mapper-cancel" onClick={onCancel}>cancel</button>
    </div>
  ),
}));
vi.mock('../../../shared/components/data-mapper/adapters/apiMockBodyAdapter', () => ({
  createApiMockBodyAdapter: (...args: unknown[]) => createAdapter(...args),
}));

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
  it('edits dribble chunk schedule, match limit, and state counters', () => {
    const onUpdateRoute = vi.fn();
    const resp = createDefaultResponse('resp-1');
    resp.behavior.fault = 'dribble';
    resp.behavior.chunkSchedule = [{ afterMs: 10, body: 'a' }];
    resp.transition = { currentState: '', targetState: 'open', counterUpdates: [{ key: 'hits', delta: 1 }] };
    render(
      <ApiMockResponseEditor
        route={makeRoute({ responseMode: 'state', responses: [resp] })}
        onUpdateRoute={onUpdateRoute}
        sequencePosition={2}
      />,
    );

    openResponseTab('faults');
    expect(screen.getByTestId('api-mock-chunk-schedule')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-chunk-add'));
    expect(onUpdateRoute).toHaveBeenCalled();

    openResponseTab('timing');
    fireEvent.change(screen.getByTestId('api-mock-variant-max-matches'), { target: { value: '3' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({
      responses: [expect.objectContaining({ behavior: expect.objectContaining({ maxMatches: 3 }) })],
    }));

    openResponseTab('selection');
    fireEvent.click(screen.getByTestId('api-mock-counter-add'));
    expect(onUpdateRoute).toHaveBeenCalled();
  });

  it('updates status, content type, body, delay, and jitter', () => {
    const onUpdateRoute = vi.fn();
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={onUpdateRoute} />);

    fireEvent.change(screen.getByTestId('api-mock-variant-status'), { target: { value: '204' } });
    expect(onUpdateRoute).toHaveBeenCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ status: 204 })] }));

    const ct = screen.getByTestId('api-mock-variant-content-type-select');
    fireEvent.click(ct.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="text/plain"]') as HTMLElement);
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ body: expect.objectContaining({ contentType: 'text/plain' }) })] }));

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
    // Choosing "Custom…" reveals a free-text content type field.
    const ct = screen.getByTestId('api-mock-variant-content-type-select');
    fireEvent.click(ct.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="__custom__"]') as HTMLElement);
    fireEvent.change(screen.getByTestId('api-mock-variant-content-type'), { target: { value: 'application/vnd.acme+json' } });
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ body: expect.objectContaining({ contentType: 'application/vnd.acme+json' }) })] }));
  });

  it('adds and deletes response variants when multiple variants exist', () => {
    const onUpdateRoute = vi.fn();
    const second = { ...createDefaultResponse('resp-2'), name: 'Variant 2', isDefault: false };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [createDefaultResponse('resp-1'), second] })} onUpdateRoute={onUpdateRoute} />);

    fireEvent.click(screen.getByTestId('api-mock-add-variant'));
    expect(onUpdateRoute).toHaveBeenCalledWith(expect.objectContaining({ responses: expect.arrayContaining([expect.objectContaining({ name: 'Variant 3' })]) }));

    fireEvent.click(screen.getByTestId('api-mock-delete-variant-resp-1'));
    expect(onUpdateRoute).toHaveBeenLastCalledWith(expect.objectContaining({ responses: [expect.objectContaining({ id: 'resp-2' })] }));
  });

  it('does not render a delete button when there is only one variant', () => {
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={vi.fn()} />);
    expect(document.querySelector('[data-testid^="api-mock-delete-variant-"]')).toBeNull();
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
    expect(screen.getByTestId('api-mock-cookie-httpOnly-c1')).toBeChecked();
  });

  it('adds editable cookies and selects fault cards', () => {
    const onUpdateRoute = vi.fn();
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={onUpdateRoute} />);
    openResponseTab('headers');
    fireEvent.click(screen.getByTestId('api-mock-add-cookie'));
    expect(onUpdateRoute).toHaveBeenCalled();
    const withCookie = onUpdateRoute.mock.calls.at(-1)?.[0];
    expect(withCookie.responses[0].cookies).toHaveLength(1);

    openResponseTab('faults');
    fireEvent.click(screen.getByTestId('api-mock-fault-reset'));
    const withFault = onUpdateRoute.mock.calls.at(-1)?.[0];
    expect(withFault.responses[0].behavior.fault).toBe('reset');
  });

  it('edits selection mode, weight, and scenario states', () => {
    const onUpdateRoute = vi.fn();
    const { rerender } = render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={onUpdateRoute} />);
    openResponseTab('selection');
    expect(screen.getByTestId('api-mock-selection-condition').textContent).toMatch(/Default variant/i);

    fireEvent.click(screen.getByTestId('api-mock-selection-default'));
    expect(onUpdateRoute).toHaveBeenCalled();

    // CustomSelect menu needs real layout; drive mode via its set-value event in jsdom.
    fireEvent(
      screen.getByTestId('api-mock-response-mode'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'weighted' }, bubbles: true }),
    );
    expect(onUpdateRoute.mock.calls.some(c => c[0].responseMode === 'weighted')).toBe(true);

    rerender(<ApiMockResponseEditor route={makeRoute({ responseMode: 'weighted' })} onUpdateRoute={onUpdateRoute} />);
    openResponseTab('selection');
    fireEvent.change(screen.getByTestId('api-mock-variant-weight'), { target: { value: '3' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].weight).toBe(3);

    rerender(<ApiMockResponseEditor route={makeRoute({ responseMode: 'state' })} onUpdateRoute={onUpdateRoute} />);
    openResponseTab('selection');
    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: 'Started' } });
    fireEvent.change(screen.getByTestId('api-mock-variant-next-state'), { target: { value: 'Active' } });
    const last = onUpdateRoute.mock.calls.at(-1)?.[0];
    expect(last.responses[0].transition.targetState).toBe('Active');
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

  it('opens the body mapper and applies the mapped template', () => {
    const onUpdateRoute = vi.fn();
    createAdapter.mockClear();
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={onUpdateRoute} />);
    fireEvent.click(screen.getByTestId('api-mock-body-map'));
    fireEvent.click(screen.getByTestId('api-mock-body-mapper-save'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].body.content).toBe('{"mapped":true}');
  });

  it('cancels the body mapper without writing', () => {
    const onUpdateRoute = vi.fn();
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={onUpdateRoute} />);
    fireEvent.click(screen.getByTestId('api-mock-body-map'));
    fireEvent.click(screen.getByTestId('api-mock-body-mapper-cancel'));
    expect(screen.queryByTestId('api-mock-body-mapper')).toBeNull();
    expect(onUpdateRoute).not.toHaveBeenCalled();
  });

  it('freezes the mapper adapter across parent rerenders and closes it when switching variants', () => {
    createAdapter.mockClear();
    const second = { ...createDefaultResponse('resp-2'), name: 'Variant 2', isDefault: false };
    const route = makeRoute({ responses: [createDefaultResponse('resp-1'), second] });
    const { rerender } = render(<ApiMockResponseEditor route={route} onUpdateRoute={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-body-map'));
    expect(screen.getByTestId('api-mock-body-mapper')).toBeTruthy();
    expect(createAdapter).toHaveBeenCalledTimes(1);
    rerender(<ApiMockResponseEditor route={{ ...route }} onUpdateRoute={vi.fn()} />);
    expect(screen.getByTestId('api-mock-body-mapper')).toBeTruthy();
    expect(createAdapter).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('api-mock-variant-tab-resp-2'));
    expect(screen.queryByTestId('api-mock-body-mapper')).toBeNull();
  });

  it('disables Map body for non-object JSON payloads', () => {
    const xml = {
      ...createDefaultResponse('resp-1'),
      body: { kind: 'xml' as const, contentType: 'application/xml', content: '<Order/>' },
    };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [xml] })} onUpdateRoute={vi.fn()} />);
    expect(screen.getByTestId('api-mock-body-map')).toBeDisabled();
  });
});
