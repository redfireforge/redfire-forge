/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseEditor } from './ApiMockResponseEditor';
import { ApiMockResponseFaultsPanel } from './ApiMockResponseFaultsPanel';
import { ApiMockResponseSelectionPanel } from './ApiMockResponseSelectionPanel';
import { ApiMockResponseTimingPanel } from './ApiMockResponseTimingPanel';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockResponseVariantV1 } from '../../../shared/api-mock/contracts';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';
import { CUSTOM_SELECT_SET_VALUE_EVENT } from '../../../shared/components/CustomSelect';

vi.mock('./ApiMockBodyEditor', () => ({
  ApiMockBodyEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="api-mock-variant-body" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));
vi.mock('../../../shared/components/data-mapper/DataMapperModal', () => ({
  default: () => null,
}));
vi.mock('../../../shared/components/data-mapper/adapters/apiMockBodyAdapter', () => ({
  createApiMockBodyAdapter: () => ({ contextId: 'api-mock-body' }),
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

type TabId = 'content' | 'headers' | 'timing' | 'faults' | 'selection' | 'outbound';

function openTab(id: TabId) {
  fireEvent.click(screen.getByTestId(`api-mock-response-tab-${id}`));
}

function StatefulEditor({
  initial,
  sequencePosition,
}: {
  initial: ApiMockRouteV1;
  sequencePosition?: number;
}) {
  const [route, setRoute] = useState(initial);
  return (
    <ApiMockResponseEditor
      route={route}
      onUpdateRoute={patch => setRoute(r => ({ ...r, ...patch, responses: patch.responses ?? r.responses }))}
      sequencePosition={sequencePosition}
    />
  );
}

function pickSelect(testId: string, value: string) {
  fireEvent(
    screen.getByTestId(testId),
    new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value }, bubbles: true }),
  );
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

    openTab('selection');
    fireEvent(
      screen.getByTestId('api-mock-response-mode'),
      new CustomEvent('custom-select:set-value', { detail: { value: 'weighted' }, bubbles: true }),
    );
    expect(onUpdateRoute).toHaveBeenCalledWith(expect.objectContaining({
      responseMode: 'weighted',
      responses: expect.arrayContaining([expect.objectContaining({ weight: 1 })]),
    }));

    fireEvent.click(screen.getByTestId('api-mock-variant-tab-resp-2'));
    fireEvent.click(screen.getByTestId('api-mock-variant-tab-resp-1'));
    openTab('content');
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

  it('covers format body, template badge, status chips, and body clear', () => {
    render(<StatefulEditor initial={makeRoute({
      responses: [{
        ...createDefaultResponse('resp-1'),
        body: { kind: 'json', contentType: 'application/json', content: '{"a":1}' },
      }],
    })} />);

    fireEvent.click(screen.getByTestId('api-mock-body-format'));
    expect(screen.getByTestId('api-mock-variant-body').value).toContain('"a": 1');

    fireEvent.change(screen.getByTestId('api-mock-variant-body'), { target: { value: '{{uuid}}' } });
    expect(screen.getByTestId('api-mock-body-template-badge')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-body-format'));
    expect(screen.getByTestId('api-mock-body-format-error')).toHaveTextContent(/template expressions/i);

    fireEvent.change(screen.getByTestId('api-mock-variant-body'), { target: { value: '{bad json' } });
    fireEvent.click(screen.getByTestId('api-mock-body-format'));
    expect(screen.getByTestId('api-mock-body-format-error')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('api-mock-variant-status-quick-404'));
    expect(screen.getByTestId('api-mock-variant-status-reason')).toHaveValue('Not Found');

    fireEvent.click(screen.getByTestId('api-mock-body-clear'));
    expect(screen.getByTestId('api-mock-variant-body')).toHaveValue('');
  });

  it('covers expires picker editing, relative shortcuts, and clear', () => {
    render(<StatefulEditor initial={makeRoute()} />);
    openTab('timing');

    fireEvent.click(screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-display')!);
    const input = screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-12-25T10:30' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.click(screen.getByTitle('1 hour from now'));
    fireEvent.click(screen.getByTitle('24 hours from now'));
    fireEvent.click(screen.getByTitle('7 days from now'));
    fireEvent.click(screen.getByTitle('Clear expiry'));
  });

  it('covers expires picker escape, empty commit, and invalid draft', () => {
    const onUpdateRoute = vi.fn();
    const resp = {
      ...createDefaultResponse('resp-1'),
      behavior: { delayMs: 0, jitterMs: 0, expiresAt: '2026-06-01T12:00:00.000Z' },
    };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [resp] })} onUpdateRoute={onUpdateRoute} />);
    openTab('timing');

    fireEvent.click(screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-display')!);
    const input = screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByClassName?.('am-expires-input') ?? document.querySelector('.am-expires-input')).toBeNull();

    fireEvent.click(screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-display')!);
    const input2 = screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-input') as HTMLInputElement;
    fireEvent.change(input2, { target: { value: 'not-a-date' } });
    fireEvent.blur(input2);
  });

  it('covers timing probability, max matches clear, and cookie CRUD', () => {
    const onUpdateRoute = vi.fn();
    const resp = {
      ...createDefaultResponse('resp-1'),
      cookies: [{
        id: 'c1', name: 'sid', value: 'v', enabled: true, httpOnly: false, secure: false,
        sameSite: 'Lax' as const, path: '/',
      }],
    };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [resp] })} onUpdateRoute={onUpdateRoute} />);

    openTab('timing');
    fireEvent.change(screen.getByTestId('api-mock-variant-max-matches'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('api-mock-variant-probability'), { target: { value: '0.5' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].behavior.probability).toBe(0.5);

    openTab('headers');
    fireEvent.change(screen.getByTestId('api-mock-cookie-name'), { target: { value: 'token' } });
    fireEvent.change(screen.getByTestId('api-mock-cookie-value'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('api-mock-cookie-httpOnly'));
    fireEvent.click(screen.getByTestId('api-mock-cookie-secure-c1'));
    pickSelect('api-mock-cookie-samesite-c1', 'Strict');
    fireEvent.click(screen.getByTestId('api-mock-cookie-delete-c1'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].cookies).toEqual([]);
  });

  it('covers fault cards, dribble schedule edit/remove, and empty chunks', () => {
    render(<StatefulEditor initial={makeRoute({
      responses: [{
        ...createDefaultResponse('resp-1'),
        body: { kind: 'json', contentType: 'application/json', content: 'hello-world' },
      }],
    })} />);
    openTab('faults');

    fireEvent.click(screen.getByTestId('api-mock-fault-dribble'));
    expect(screen.getByTestId('api-mock-chunk-schedule')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Chunk 1 delay ms'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Chunk 1 body'), { target: { value: 'chunk-data' } });
    fireEvent.click(screen.getByTestId('api-mock-chunk-remove-0'));
    fireEvent.click(screen.getByTestId('api-mock-chunk-remove-0'));
    expect(screen.getByText(/No chunks defined/i)).toBeInTheDocument();

    for (const fault of ['timeout', 'close', 'malformed'] as const) {
      fireEvent.click(screen.getByTestId(`api-mock-fault-${fault}`));
    }
    fireEvent.click(screen.getByTestId('api-mock-fault-none'));
  });

  it('covers mode bar, variant summaries, delete via keyboard, and sequence badge', () => {
    const onUpdateRoute = vi.fn();
    const v1 = { ...createDefaultResponse('resp-1'), conditions: { id: 'c', combinator: 'all' as const, children: [{ id: 'x', kind: 'header' as const, header: 'X-A', operator: 'equals' as const, value: '1' }] } };
    const v2 = { ...createDefaultResponse('resp-2'), name: 'Second', isDefault: false, status: 500 };
    const { rerender } = render(
      <ApiMockResponseEditor
        route={makeRoute({ responseMode: 'sequence', responses: [v1, v2] })}
        onUpdateRoute={onUpdateRoute}
        sequencePosition={1}
      />,
    );

    expect(screen.getByText(/2 variants/)).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-variant-tab-resp-1').textContent).toMatch(/Step 1/);

    fireEvent.click(screen.getByTestId('api-mock-response-mode-weighted'));
    fireEvent.click(screen.getByTestId('api-mock-response-mode-state'));
    fireEvent.click(screen.getByTestId('api-mock-response-mode-rules'));

    const del = screen.getByTestId('api-mock-delete-variant-resp-2');
    fireEvent.keyDown(del, { key: 'Enter' });
    expect(onUpdateRoute).toHaveBeenCalled();

    rerender(
      <ApiMockResponseEditor
        route={makeRoute({ responseMode: 'sequence', responses: [v1] })}
        onUpdateRoute={onUpdateRoute}
        sequencePosition={1}
      />,
    );
    openTab('selection');
    expect(screen.getByTestId('api-mock-sequence-position')).toHaveTextContent(/Position 1/);
    expect(screen.getByText(/mode is active on the live listener/i)).toBeInTheDocument();
  });

  it('covers state mode counters edit/remove and condition labels', () => {
    const onUpdateRoute = vi.fn();
    const resp = {
      ...createDefaultResponse('resp-1'),
      isDefault: false,
      weight: 2,
      transition: {
        currentState: 'Idle',
        targetState: 'Active',
        counterUpdates: [{ key: 'hits', delta: 1 }],
      },
    };
    render(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'state', responses: [resp] })} onUpdateRoute={onUpdateRoute} />,
    );
    openTab('selection');

    expect(screen.getByTestId('api-mock-selection-condition')).toHaveTextContent('state = Idle');

    fireEvent.change(screen.getByLabelText('Counter 1 key'), { target: { value: 'views' } });
    fireEvent.change(screen.getByLabelText('Counter 1 delta'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('api-mock-counter-remove-0'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].transition?.counterUpdates).toBeUndefined();

    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: '' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].transition?.currentState).toBeUndefined();
  });

  it('covers weighted condition label and preview badges', () => {
    const onUpdateRoute = vi.fn();
    const resp = {
      ...createDefaultResponse('resp-1'),
      isDefault: false,
      weight: 3,
      status: 503,
      headers: [{ id: 'h1', key: 'X-A', value: '1', enabled: true }],
      cookies: [{ id: 'c1', name: 's', value: 'v', enabled: true, httpOnly: true, secure: true, sameSite: 'Lax' as const, path: '/' }],
      behavior: { delayMs: 0, jitterMs: 0, fault: 'reset' as const },
    };
    render(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'weighted', responses: [resp] })} onUpdateRoute={onUpdateRoute} />,
    );
    openTab('selection');
    expect(screen.getByTestId('api-mock-selection-condition')).toHaveTextContent('weight 3');

    expect(screen.getByTestId('api-mock-preview-headers')).toHaveTextContent('1 header');
    expect(screen.getByTestId('api-mock-preview-cookies')).toHaveTextContent('1 cookie');
    expect(screen.getByText(/fault: reset/)).toBeInTheDocument();
  });

  it('covers outbound tab and blocks deleting the only variant', () => {
    render(<StatefulEditor initial={makeRoute()} />);
    openTab('outbound');
    expect(screen.getByTestId('api-mock-variant-outbound')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-transform-add'));
    expect(document.querySelector('[data-testid^="api-mock-delete-variant-"]')).toBeNull();
  });

  it('covers remaining branch labels, preview plurals, and edge inputs', () => {
    const onUpdateRoute = vi.fn();
    const resp = {
      ...createDefaultResponse('resp-1'),
      isDefault: false,
      status: 418,
      conditions: {
        id: 'pg',
        combinator: 'all' as const,
        children: [
          { id: 'c1', kind: 'header' as const, header: 'X-A', operator: 'equals' as const, value: '1' },
          { id: 'c2', kind: 'header' as const, header: 'X-B', operator: 'equals' as const, value: '2' },
        ],
      },
      headers: [
        { id: 'h1', key: 'A', value: '1', enabled: true },
        { id: 'h2', key: 'B', value: '2', enabled: true },
      ],
      cookies: [
        { id: 'c1', name: 'a', value: '1', enabled: true, httpOnly: true, secure: true, sameSite: 'Lax' as const, path: '/' },
        { id: 'c2', name: 'b', value: '2', enabled: true, httpOnly: true, secure: true, sameSite: 'Lax' as const, path: '/' },
      ],
    };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [resp] })} onUpdateRoute={onUpdateRoute} />);

    expect(screen.getByTestId('api-mock-variant-tab-resp-1').textContent).toMatch(/2 condition/);
    expect(screen.getByTestId('api-mock-variant-status-reason')).toHaveValue('');
    expect(screen.getByTestId('api-mock-variant-status-reason')).toHaveAttribute('placeholder', 'Custom status');
    expect(screen.getByTestId('api-mock-preview-headers')).toHaveTextContent('2 headers');
    expect(screen.getByTestId('api-mock-preview-cookies')).toHaveTextContent('2 cookies');

    openTab('selection');
    expect(screen.getByTestId('api-mock-selection-condition')).toHaveTextContent('No extra condition');

    openTab('timing');
    fireEvent.change(screen.getByTestId('api-mock-variant-probability'), { target: { value: '2' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].behavior.probability).toBe(1);

    openTab('content');
    const ct = screen.getByTestId('api-mock-variant-content-type-select');
    fireEvent(
      ct,
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: '' }, bubbles: true }),
    );
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].body.contentType).toBeUndefined();
  });

  it('covers sequence position with disabled responses', () => {
    const disabled = { ...createDefaultResponse('resp-2'), enabled: false, isDefault: false };
    const plain = { ...createDefaultResponse('resp-1'), isDefault: false };
    render(
      <ApiMockResponseEditor
        route={makeRoute({ responseMode: 'sequence', responses: [plain, disabled] })}
        onUpdateRoute={vi.fn()}
        sequencePosition={0}
      />,
    );
    openTab('selection');
    expect(screen.getByTestId('api-mock-sequence-position')).toHaveTextContent(/of 1/);
    expect(screen.getByTestId('api-mock-variant-tab-resp-1').textContent).toMatch(/Step 1/);
  });

  it('covers variant summary branches for weighted and state without currentState', () => {
    const weighted = { ...createDefaultResponse('resp-1'), weight: 5, isDefault: false };
    const { rerender } = render(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'weighted', responses: [weighted] })} onUpdateRoute={vi.fn()} />,
    );
    expect(screen.getByTestId('api-mock-variant-tab-resp-1').textContent).toMatch(/Weight 5/);

    const stateVar = { ...createDefaultResponse('resp-2'), isDefault: false, transition: { targetState: 'Open' } };
    rerender(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'state', responses: [stateVar] })} onUpdateRoute={vi.fn()} />,
    );
    expect(screen.getByTestId('api-mock-variant-tab-resp-2').textContent).toMatch(/Any state/);
  });

  it('covers expires invalid draft, empty commit, and preset content type display', () => {
    render(<StatefulEditor initial={makeRoute({
      responses: [{
        ...createDefaultResponse('resp-1'),
        body: { kind: 'json', contentType: 'application/vnd.custom+json', content: '{}' },
        behavior: { delayMs: 0, jitterMs: 0, expiresAt: 'not-a-date' },
      }],
    })} />);
    openTab('timing');

    fireEvent.click(screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-display')!);
    const input = screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);

    openTab('content');
    expect(screen.getByTestId('api-mock-variant-content-type')).toBeInTheDocument();
  });

  it('covers sequence with zero enabled responses', () => {
    const allDisabled = [
      { ...createDefaultResponse('resp-1'), enabled: false, isDefault: false },
      { ...createDefaultResponse('resp-2'), enabled: false, isDefault: false },
    ];
    render(
      <ApiMockResponseEditor
        route={makeRoute({ responseMode: 'sequence', responses: allDisabled })}
        onUpdateRoute={vi.fn()}
        sequencePosition={0}
      />,
    );
    openTab('selection');
    expect(screen.getByTestId('api-mock-sequence-position')).toHaveTextContent(/of 1/);
  });

  it('covers dribble fault when chunk schedule already exists', () => {
    const onUpdateRoute = vi.fn();
    const resp = {
      ...createDefaultResponse('resp-1'),
      behavior: {
        delayMs: 0,
        jitterMs: 0,
        fault: 'dribble' as const,
        chunkSchedule: [{ afterMs: 10, body: 'x' }],
      },
    };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [resp] })} onUpdateRoute={onUpdateRoute} />);
    openTab('faults');
    fireEvent.click(screen.getByTestId('api-mock-fault-dribble'));
    expect(onUpdateRoute).toHaveBeenCalled();
  });

  it('covers variant delete click and weighted notice', () => {
    const onUpdateRoute = vi.fn();
    const v2 = { ...createDefaultResponse('resp-2'), name: 'Alt', isDefault: false };
    render(
      <ApiMockResponseEditor
        route={makeRoute({ responseMode: 'weighted', responses: [createDefaultResponse('resp-1'), v2] })}
        onUpdateRoute={onUpdateRoute}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-delete-variant-resp-2'));
    expect(onUpdateRoute).toHaveBeenCalled();
    openTab('selection');
    expect(screen.getByText(/mode is active on the live listener/i)).toBeInTheDocument();
  });

  it('covers probability clamping, state transition defaults, and rules mode switch', () => {
    const onUpdateRoute = vi.fn();
    const resp = {
      ...createDefaultResponse('resp-1'),
      isDefault: false,
      weight: undefined,
      transition: { targetState: 'Done' },
    };
    render(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'weighted', responses: [resp] })} onUpdateRoute={onUpdateRoute} />,
    );
    openTab('selection');
    expect(screen.getByTestId('api-mock-selection-condition')).toHaveTextContent('No extra condition');

    openTab('timing');
    fireEvent.change(screen.getByTestId('api-mock-variant-probability'), { target: { value: '-1' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].behavior.probability).toBe(0);

    fireEvent.click(screen.getByTestId('api-mock-response-mode-rules'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responseMode).toBe('rules');
  });

  it('covers state transition targetState fallback when cleared', () => {
    const onUpdateRoute = vi.fn();
    const stateResp = { ...createDefaultResponse('resp-1'), transition: { targetState: 'Active' } };
    render(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'state', responses: [stateResp] })} onUpdateRoute={onUpdateRoute} />,
    );
    openTab('selection');
    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: 'New' } });
    fireEvent.change(screen.getByTestId('api-mock-variant-next-state'), { target: { value: '' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].transition?.targetState).toBe('Started');
  });

  it('covers valid expires display and preview without delay badge', () => {
    render(<StatefulEditor initial={makeRoute({
      responses: [{
        ...createDefaultResponse('resp-1'),
        behavior: { delayMs: 0, jitterMs: 0, expiresAt: '2026-06-15T14:30:00.000Z' },
      }],
    })} />);
    openTab('timing');
    expect(screen.getByTestId('api-mock-variant-expires-at').textContent).toMatch(/Jun/);
    const previewMeta = screen.getByTestId('api-mock-response-preview').querySelector('.am-preview-meta');
    expect(previewMeta?.textContent ?? '').not.toMatch(/±/);
  });

  it('covers expires not-set display', () => {
    render(<StatefulEditor initial={makeRoute()} />);
    openTab('timing');
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('covers state mode notice and sequencePosition default', () => {
    render(
      <ApiMockResponseEditor
        route={makeRoute({ responseMode: 'state', responses: [createDefaultResponse('resp-1')] })}
        onUpdateRoute={vi.fn()}
      />,
    );
    openTab('selection');
    expect(screen.getByText(/mode is active on the live listener/i)).toBeInTheDocument();

    cleanup();
    render(
      <ApiMockResponseEditor
        route={makeRoute({
          responseMode: 'sequence',
          responses: [createDefaultResponse('resp-1'), { ...createDefaultResponse('resp-2'), isDefault: false }],
        })}
        onUpdateRoute={vi.fn()}
      />,
    );
    openTab('selection');
    expect(screen.getByTestId('api-mock-sequence-position')).toHaveTextContent(/Position 0/);
  });

  it('covers counter row edits and state required-state target fallback', () => {
    const onUpdateRoute = vi.fn();
    const resp = {
      ...createDefaultResponse('resp-1'),
      transition: {
        currentState: 'A',
        targetState: 'B',
        counterUpdates: [{ key: 'n', delta: 2 }, { key: 'm', delta: 3 }],
      },
    };
    render(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'state', responses: [resp] })} onUpdateRoute={onUpdateRoute} />,
    );
    openTab('selection');
    fireEvent.change(screen.getByLabelText('Counter 1 key'), { target: { value: 'hits' } });
    fireEvent.change(screen.getByLabelText('Counter 2 delta'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('api-mock-counter-remove-1'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].transition?.counterUpdates).toHaveLength(1);

    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: 'Only' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].transition?.targetState).toBe('B');
  });

  it('covers mode bar sequence/state switches clearing weights', () => {
    const onUpdateRoute = vi.fn();
    const weightedResp = { ...createDefaultResponse('resp-1'), weight: 4, isDefault: false };
    render(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'weighted', responses: [weightedResp] })} onUpdateRoute={onUpdateRoute} />,
    );
    fireEvent.click(screen.getByTestId('api-mock-response-mode-sequence'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].weight).toBeUndefined();
    fireEvent.click(screen.getByTestId('api-mock-response-mode-state'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responseMode).toBe('state');
  });

  it('covers non-default variant summary and expires escape plus invalid commit', () => {
    const onUpdateRoute = vi.fn();
    const alt = { ...createDefaultResponse('resp-1'), isDefault: false, name: 'Alt' };
    render(<ApiMockResponseEditor route={makeRoute({ responses: [alt] })} onUpdateRoute={onUpdateRoute} />);
    expect(screen.getByTestId('api-mock-variant-tab-resp-1').textContent).toMatch(/No extra condition/);

    cleanup();
    render(<StatefulEditor initial={makeRoute()} />);
    openTab('timing');
    fireEvent.click(screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-display')!);
    const input = screen.getByTestId('api-mock-variant-expires-at').querySelector('.am-expires-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bad-date' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByClassName?.('am-expires-input') ?? document.querySelector('.am-expires-input')).toBeNull();
  });

  it('covers counter add from scratch and remove last counter', () => {
    render(<StatefulEditor initial={makeRoute({ responseMode: 'state', responses: [createDefaultResponse('resp-1')] })} />);
    openTab('selection');
    fireEvent.click(screen.getByTestId('api-mock-counter-add'));
    fireEvent.change(screen.getByLabelText('Counter 1 key'), { target: { value: 'attempts' } });
    fireEvent.change(screen.getByLabelText('Counter 1 delta'), { target: { value: '2' } });
    expect(screen.getByLabelText('Counter 1 key')).toHaveValue('attempts');
    fireEvent.click(screen.getByTestId('api-mock-counter-remove-0'));
    expect(screen.queryByTestId('api-mock-counter-row-0')).toBeNull();
  });

  it('covers clearing probability and next-state edit with existing currentState', () => {
    render(<StatefulEditor initial={makeRoute({
      responseMode: 'state',
      responses: [{
        ...createDefaultResponse('resp-1'),
        transition: { currentState: 'Idle', targetState: 'Run' },
      }],
    })} />);
    openTab('timing');
    fireEvent.change(screen.getByTestId('api-mock-variant-probability'), { target: { value: '' } });
    openTab('selection');
    fireEvent.change(screen.getByTestId('api-mock-variant-next-state'), { target: { value: 'Done' } });
    expect(screen.getByTestId('api-mock-variant-next-state')).toHaveValue('Done');
  });

  it('covers invalid weight input falling back to zero', () => {
    render(<StatefulEditor initial={makeRoute({
      responseMode: 'weighted',
      responses: [{ ...createDefaultResponse('resp-1'), isDefault: false, weight: 5 }],
    })} />);
    openTab('selection');
    fireEvent.change(screen.getByTestId('api-mock-variant-weight'), { target: { value: 'abc' } });
    expect(screen.getByTestId('api-mock-variant-weight')).toHaveValue(0);
  });

  it('covers required state when transition object is initially undefined', () => {
    const onUpdateRoute = vi.fn();
    render(
      <ApiMockResponseEditor route={makeRoute({ responseMode: 'state', responses: [createDefaultResponse('resp-1')] })} onUpdateRoute={onUpdateRoute} />,
    );
    openTab('selection');
    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: 'Boot' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].transition?.targetState).toBe('Boot');
  });

  it('covers extracted panel edge branches directly', () => {
    const base = createDefaultResponse('resp-1');
    const onUpdateVariant = vi.fn();

    render(
      <ApiMockResponseTimingPanel
        variant={{ ...base, behavior: { ...base.behavior, maxMatches: 2, probability: 0.5 } }}
        onUpdateVariant={onUpdateVariant}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-variant-max-matches'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByTestId('api-mock-variant-probability'), { target: { value: '' } });
    expect(onUpdateVariant).toHaveBeenCalled();

    const emptyBodyVariant: ApiMockResponseVariantV1 = {
      ...base,
      body: { kind: 'json', contentType: 'application/json', content: '' },
      behavior: { ...base.behavior, fault: undefined, chunkSchedule: undefined },
    };
    const onFaultUpdate = vi.fn();
    const { rerender } = render(<ApiMockResponseFaultsPanel variant={emptyBodyVariant} onUpdateVariant={onFaultUpdate} />);
    fireEvent.click(screen.getByTestId('api-mock-fault-dribble'));
    expect(onFaultUpdate).toHaveBeenCalledWith(expect.objectContaining({
      behavior: expect.objectContaining({ chunkSchedule: expect.any(Array) }),
    }));

    const dribbleVariant: ApiMockResponseVariantV1 = {
      ...emptyBodyVariant,
      behavior: { ...emptyBodyVariant.behavior, fault: 'dribble', chunkSchedule: [{ afterMs: 1, body: 'x' }] },
    };
    rerender(<ApiMockResponseFaultsPanel variant={dribbleVariant} onUpdateVariant={onFaultUpdate} />);
    fireEvent.click(screen.getByTestId('api-mock-chunk-add'));
    fireEvent.change(screen.getByLabelText('Chunk 1 delay ms'), { target: { value: 'bad' } });
    fireEvent.change(screen.getByLabelText('Chunk 1 body'), { target: { value: 'payload' } });
    fireEvent.click(screen.getByTestId('api-mock-chunk-remove-0'));
    fireEvent.click(screen.getByTestId('api-mock-fault-reset'));
    expect(onFaultUpdate).toHaveBeenCalled();

    rerender(
      <ApiMockResponseFaultsPanel
        variant={{ ...dribbleVariant, behavior: { ...dribbleVariant.behavior, chunkSchedule: [] } }}
        onUpdateVariant={onFaultUpdate}
      />,
    );
    expect(screen.getByText(/No chunks defined/i)).toBeInTheDocument();

    const stateVariant: ApiMockResponseVariantV1 = {
      ...base,
      transition: { targetState: 'Next', counterUpdates: [{ key: 'n', delta: 2 }] },
    };
    const onSelectUpdate = vi.fn();
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'state', responses: [stateVariant] })}
        activeVariant={stateVariant}
        conditionLabel="Any state"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={onSelectUpdate}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('api-mock-variant-next-state'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Counter 1 key'), { target: { value: 'hits' } });
    fireEvent.change(screen.getByLabelText('Counter 1 delta'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('api-mock-counter-remove-0'));
    fireEvent.click(screen.getByTestId('api-mock-counter-add'));
    expect(onSelectUpdate).toHaveBeenCalled();
  });

  it('edits the reason phrase, maps Content-Type to body kind, and shows a binary hint', () => {
    const onUpdateRoute = vi.fn();
    render(<ApiMockResponseEditor route={makeRoute()} onUpdateRoute={onUpdateRoute} />);

    fireEvent.change(screen.getByTestId('api-mock-variant-status'), { target: { value: '400' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0]).toMatchObject({
      status: 400,
      reasonPhrase: 'Bad Request',
    });

    fireEvent.click(screen.getByTestId('api-mock-variant-status-quick-201'));
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0]).toMatchObject({
      status: 201,
      reasonPhrase: 'Created',
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-status-reason'), { target: { value: 'Resource created' } });
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].reasonPhrase).toBe('Resource created');

    pickSelect('api-mock-variant-content-type-select', 'text/html');
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].body).toMatchObject({
      contentType: 'text/html',
      kind: 'html',
    });

    pickSelect('api-mock-variant-content-type-select', 'application/octet-stream');
    expect(onUpdateRoute.mock.calls.at(-1)?.[0].responses[0].body.kind).toBe('binary_base64');

    cleanup();
    const customReason = {
      ...createDefaultResponse('resp-1'),
      status: 201,
      reasonPhrase: 'Resource created',
    };
    const onStatus = vi.fn();
    render(<ApiMockResponseEditor route={makeRoute({ responses: [customReason] })} onUpdateRoute={onStatus} />);
    fireEvent.change(screen.getByTestId('api-mock-variant-status'), { target: { value: '202' } });
    expect(onStatus.mock.calls.at(-1)?.[0].responses[0]).toMatchObject({
      status: 202,
      reasonPhrase: 'Resource created',
    });

    const binary = {
      ...createDefaultResponse('resp-1'),
      status: 201,
      reasonPhrase: 'Resource created',
      body: { kind: 'binary_base64' as const, content: 'AAECAwQ=', contentType: 'application/octet-stream' },
      headers: [{ id: 'h1', key: 'x-request-id', value: 'req-1', enabled: true }],
    };
    cleanup();
    render(<ApiMockResponseEditor route={makeRoute({ responses: [binary] })} onUpdateRoute={vi.fn()} />);
    expect(screen.getByTestId('api-mock-body-binary-hint')).toHaveTextContent(/base64/i);
    expect(screen.getByTestId('api-mock-preview-status')).toHaveTextContent('201 Resource created');
    expect(screen.getByTestId('api-mock-preview-body')).toHaveTextContent('AAECAwQ=');
    openTab('headers');
    expect(screen.getByTestId('api-mock-header-list')).toBeInTheDocument();
  });
});
