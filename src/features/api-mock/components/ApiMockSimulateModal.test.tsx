/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockSimulateModal } from './ApiMockSimulateModal';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Mock Server',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS, selection: { ...DEFAULT_SETTINGS.selection, equalPriorityPolicy: 'specificity_then_id' } },
    routes: [
      {
        id: 'r1', name: 'Users exact', enabled: true, method: 'GET', path: { kind: 'exact', value: '/users' }, priority: 20,
        predicates: { id: 'pg1', combinator: 'all', children: [] }, responseMode: 'rules', responses: [createDefaultResponse('resp-1')], tags: [], createdAt: ts, updatedAt: ts,
      },
      {
        id: 'r2', name: 'Users parameter', enabled: true, method: 'GET', path: { kind: 'parameterized', value: '/users/:id' }, priority: 10,
        predicates: { id: 'pg2', combinator: 'all', children: [] }, responseMode: 'rules', responses: [createDefaultResponse('resp-2')], tags: [], createdAt: ts, updatedAt: ts,
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('ApiMockSimulateModal', () => {
  it('runs a matched simulation and shows the winner and candidate table', () => {
    render(<ApiMockSimulateModal server={makeServer()} initialPath="/users" initialMethod="GET" onClose={vi.fn()} />);

    expect(screen.getByTestId('api-mock-simulate-body-expand')).toBeTruthy();
    expect(screen.getByTestId('api-mock-simulate-headers-expand')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    const result = screen.getByTestId('api-mock-simulate-result');
    expect(result.textContent).toContain('MATCHED');
    expect(result.textContent).toContain('Users exact');
    expect(screen.getByTestId('api-mock-sim-winner').textContent).toBe('Winner');
    expect(screen.getByText('Candidates evaluated (2)')).toBeTruthy();
    expect(screen.getByTestId('api-mock-sim-timeline-5').textContent).toMatch(/Virtual delay/i);
  });

  it('picks the higher-priority catalog rule only when the request carries its headers', () => {
    const server = makeServer();
    server.routes = [
      {
        id: 'route-regional', name: 'Regional catalog', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/catalog' }, priority: 20,
        predicates: {
          id: 'pg-regional', combinator: 'all',
          children: [{
            id: 'pred-ver', source: 'header', selector: 'x-api-version',
            operator: 'exact', expected: '2024-11',
          }],
        },
        responseMode: 'rules', responses: [createDefaultResponse('resp-regional')],
        tags: [], createdAt: ts, updatedAt: ts,
      },
      {
        id: 'route-default', name: 'Default catalog', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/catalog' }, priority: 10,
        predicates: { id: 'pg-default', combinator: 'all', children: [] },
        responseMode: 'rules', responses: [createDefaultResponse('resp-default')],
        tags: [], createdAt: ts, updatedAt: ts,
      },
    ];
    render(<ApiMockSimulateModal server={server} initialPath="/catalog" initialMethod="GET" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-simulate-result').textContent).toContain('MATCHED');
    expect(screen.getByTestId('api-mock-sim-candidate-route-default').textContent).toContain('Winner');
    expect(screen.getByTestId('api-mock-sim-candidate-route-regional').textContent).toMatch(/Conditions failed/);

    cleanup();
    render(<ApiMockSimulateModal server={server} initialPath="/catalog" initialMethod="GET" onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), {
      target: { value: 'X-Api-Version: 2024-11\nX-Tenant: acme-eu' },
    });
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-candidate-route-regional').textContent).toContain('Winner');
    expect(screen.getByTestId('api-mock-simulate-result').textContent).toContain('MATCHED');
  });

  it('shows the None-of reason when every leaf passed but the guard rejected the request', () => {
    const server = makeServer();
    server.routes = [{
      id: 'r-reports', name: 'List Reports', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/reports' }, priority: 10,
      predicates: {
        id: 'pg', combinator: 'all', children: [
          { id: 'p-page', source: 'query', selector: 'page', operator: 'exact', expected: '2' },
          {
            id: 'guard', combinator: 'not', children: [
              { id: 'p-debug', source: 'header', selector: 'x-debug', operator: 'present' },
            ],
          },
        ],
      },
      responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
      tags: [], createdAt: ts, updatedAt: ts,
    }];
    render(<ApiMockSimulateModal server={server} initialPath="/reports?page=2" initialMethod="GET" onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), { target: { value: 'x-debug: 1' } });
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    const result = screen.getByTestId('api-mock-simulate-result');
    expect(result.textContent).toContain('UNMATCHED');
    expect(result.textContent).toContain('Conditions failed');
    expect(result.textContent).toContain('None of');
    expect(result.textContent).toMatch(/rejected/);
    expect(result.textContent).toContain('x-debug');
    expect(screen.getByTestId('api-mock-sim-predicate-group:guard').textContent).toMatch(/None of/);
  });

  it('reject-all-multiple-matches returns 409 before priority, including mixed-case saved headers', () => {
    const server = makeServer();
    server.settings.selection.multipleMatchPolicy = 'reject_multiple';
    server.settings.selection.equalPriorityPolicy = 'reject';
    server.routes = [
      {
        id: 'route-regional', name: 'Regional catalog', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/catalog' }, priority: 20,
        predicates: {
          id: 'pg-regional', combinator: 'all',
          children: [{
            id: 'pred-ver', source: 'header', selector: 'x-api-version',
            operator: 'exact', expected: '2024-11',
          }],
        },
        responseMode: 'rules', responses: [createDefaultResponse('resp-regional')],
        tags: [], createdAt: ts, updatedAt: ts,
      },
      {
        id: 'route-default', name: 'Default catalog', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/catalog' }, priority: 10,
        predicates: { id: 'pg-default', combinator: 'all', children: [] },
        responseMode: 'rules', responses: [createDefaultResponse('resp-default')],
        tags: [], createdAt: ts, updatedAt: ts,
      },
    ];
    server.samples = [{
      id: 's-catalog',
      name: 'GET /catalog',
      request: {
        method: 'GET', path: '/catalog', rawPath: '/catalog', query: {},
        headers: { 'X-Api-Version': ['2024-11'] }, cookies: {},
        body: null, bodyTruncated: false, receivedAt: ts,
      },
    }];

    render(<ApiMockSimulateModal server={server} initialPath="/catalog" initialMethod="GET" onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), {
      target: { value: 'X-Api-Version: 2024-11' },
    });
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-outcome').textContent).toBe('AMBIGUOUS');
    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));
    expect(screen.getByTestId('api-mock-sim-rendered').textContent).toContain('409');

    cleanup();
    render(<ApiMockSimulateModal server={server} initialSampleId="s-catalog" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-outcome').textContent).toBe('AMBIGUOUS');
    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));
    expect(screen.getByTestId('api-mock-sim-rendered').textContent).toContain('409');
  });

  it('shows a specificity breakdown when two equal-priority rules tie', () => {
    const server = makeServer();
    server.routes[0].priority = 10;
    server.routes[0].path = { kind: 'exact', value: '/users' };
    server.routes[1].priority = 10;
    server.routes[1].path = { kind: 'glob', value: '/users*' };
    render(<ApiMockSimulateModal server={server} initialPath="/users" initialMethod="GET" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-specificity')).toBeTruthy();
    expect(screen.getByTestId('api-mock-sim-specificity-r1').textContent).toMatch(/GET \/users/);
    expect(screen.getByTestId('api-mock-sim-winner').textContent).toBe('Winner');
  });

  it('matches an ad-hoc request that carries a client certificate subject', () => {
    const server = makeServer();
    server.routes[0].predicates = {
      id: 'pg1',
      combinator: 'all',
      children: [{ id: 'p-cert', source: 'security', selector: 'certSubject', operator: 'exact', expected: 'CN=acme-client' }],
    } as never;
    render(<ApiMockSimulateModal server={server} initialPath="/users" initialMethod="GET" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-simulate-result').textContent).toContain('UNMATCHED');
    fireEvent.change(screen.getByTestId('api-mock-simulate-cert-subject'), { target: { value: 'CN=acme-client' } });
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-simulate-result').textContent).toContain('MATCHED');
  });

  it('shows rendered response with virtual delay badge', () => {
    const server = makeServer();
    server.routes[0].responses[0].body = { kind: 'json', content: '{"user":1}', contentType: 'application/json' };
    server.routes[0].responses[0].behavior.delayMs = 25;
    render(<ApiMockSimulateModal server={server} initialPath="/users" initialMethod="GET" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));
    expect(screen.getByTestId('api-mock-sim-virtual-delay').textContent).toContain('25');
    expect(screen.getByTestId('api-mock-sim-rendered-body').textContent).toContain('user');
  });

  it('pretty-prints the rendered JSON body when Format is clicked', () => {
    const server = makeServer();
    server.routes[0].responses[0].body = {
      kind: 'json',
      content: '{"id":42,"name":"Espresso"}',
      contentType: 'application/json',
    };
    render(<ApiMockSimulateModal server={server} initialPath="/users" initialMethod="GET" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));

    const body = screen.getByTestId('api-mock-sim-rendered-body');
    expect(body.textContent).toBe('{"id":42,"name":"Espresso"}');
    const format = screen.getByTestId('api-mock-sim-rendered-format');
    expect(format).not.toBeDisabled();
    fireEvent.click(format);
    expect(body.textContent).toBe('{\n  "id": 42,\n  "name": "Espresso"\n}');
    expect(format).toBeDisabled();
  });

  it('parses headers/body input and shows an unmatched danger state with an empty path fallback', () => {
    render(<ApiMockSimulateModal server={makeServer()} initialPath="" initialMethod="POST" onClose={vi.fn()} />);

    const method = screen.getByTestId('api-mock-simulate-method');
    fireEvent.click(method.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="POST"]') as HTMLElement);
    fireEvent.change(screen.getByTestId('api-mock-simulate-path'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), { target: { value: 'X-Tenant: acme\nInvalidHeader\nX-Trace: a:b:c' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-body'), { target: { value: '{"name":"Alice"}' } });
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));

    const result = screen.getByTestId('api-mock-simulate-result');
    expect(result.textContent).toContain('UNMATCHED');
    expect(result.querySelector('.danger')).toBeTruthy();
  });

  it('shows near misses and can close', () => {
    const onClose = vi.fn();
    render(<ApiMockSimulateModal server={makeServer()} initialPath="/users/42" initialMethod="POST" onClose={onClose} />);
    fireEvent.change(screen.getByTestId('api-mock-simulate-path'), { target: { value: '/users/43' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), { target: { value: 'X-Tenant: acme' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-body'), { target: { value: 'payload' } });
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByText('Near misses')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-simulate-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('runs all samples, filters list, removes auto sample, and exports trace', () => {
    const server = makeServer();
    server.routes = [];
    for (let i = 0; i < 6; i++) {
      server.routes.push({
        id: `r${i}`,
        name: `Route ${i}`,
        enabled: true,
        method: 'GET',
        path: { kind: 'exact', value: `/path-${i}` },
        priority: 10,
        predicates: { id: 'pg', combinator: 'all', children: [] },
        responseMode: 'rules',
        responses: [createDefaultResponse(`resp-${i}`)],
        tags: [],
        createdAt: ts,
        updatedAt: ts,
      });
    }
    render(<ApiMockSimulateModal server={server} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Filter samples'), { target: { value: 'Route 1' } });
    expect(screen.getByTestId('api-mock-sim-sample-auto-r1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('api-mock-simulate-run-all'));
    expect(screen.getByTestId('api-mock-simulate-summary')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter samples'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-remove-auto-r0'));
    expect(screen.queryByTestId('api-mock-sim-sample-auto-r0')).not.toBeInTheDocument();
  });

  it('shows request and assertions tabs after a matched run', () => {
    render(<ApiMockSimulateModal server={makeServer()} initialPath="/users" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    fireEvent.click(screen.getByRole('tab', { name: 'Normalized request' }));
    expect(document.body.textContent).toContain('"method"');
    fireEvent.click(screen.getByRole('tab', { name: 'Assertions' }));
    expect(screen.getByText('Virtual delay')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('api-mock-simulate-seed'), { target: { value: '' } });
    expect(screen.getByTestId('api-mock-simulate-seed')).toHaveValue('0');
  });

  it('shows fault delivery, state timeline, and selecting auto sample', () => {
    const server = makeServer();
    const resp = createDefaultResponse('resp-fault');
    resp.behavior.fault = 'reset';
    server.routes = [{
      id: 'r-fault', name: 'Fault route', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/fault' }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'state', responses: [resp], tags: [], createdAt: ts, updatedAt: ts,
    }];
    render(<ApiMockSimulateModal server={server} initialPath="/fault" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-fault-badge')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));
    expect(screen.getByText(/No HTTP body would reach the client/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('api-mock-sim-sample-auto-r-fault'));
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveValue('/fault');
  });

  it('marks adhoc ambiguous runs as conflict without expectations', () => {
    const server = makeServer();
    server.settings.selection.equalPriorityPolicy = 'reject';
    server.routes = [
      {
        id: 'r1', name: 'Dup A', enabled: true, method: 'GET', path: { kind: 'exact', value: '/dup' }, priority: 10,
        predicates: { id: 'pg1', combinator: 'all', children: [] }, responseMode: 'rules',
        responses: [createDefaultResponse('resp-a')], tags: [], createdAt: ts, updatedAt: ts,
      },
      {
        id: 'r2', name: 'Dup B', enabled: true, method: 'GET', path: { kind: 'exact', value: '/dup' }, priority: 10,
        predicates: { id: 'pg2', combinator: 'all', children: [] }, responseMode: 'rules',
        responses: [createDefaultResponse('resp-b')], tags: [], createdAt: ts, updatedAt: ts,
      },
    ];
    render(<ApiMockSimulateModal server={server} initialPath="/dup" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-sample-adhoc').textContent).toContain('CONFLICT');
  });

  it('shows warning status badge for 4xx rendered responses', () => {
    const server = makeServer();
    const resp = createDefaultResponse('resp-err');
    resp.status = 404;
    server.routes = [{
      id: 'r404', name: 'Not found', enabled: true, method: 'GET', path: { kind: 'exact', value: '/missing' }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] }, responseMode: 'rules', responses: [resp], tags: [], createdAt: ts, updatedAt: ts,
    }];
    render(<ApiMockSimulateModal server={server} initialPath="/missing" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));
    expect(screen.getByTestId('api-mock-sim-rendered').querySelector('.warning')).toBeTruthy();
  });

  it('exports trace after run with mocked download anchor', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sim');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClick = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args) => {
      const el = origCreate(tag, ...args);
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(anchorClick);
      return el;
    });

    render(<ApiMockSimulateModal server={makeServer()} initialPath="/users" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    fireEvent.click(screen.getByTestId('api-mock-simulate-export'));
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:sim');
    expect(screen.getByTestId('api-mock-sim-export-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-sim-export-filename').textContent).toMatch(/api-mock-sim-trace-/);
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('selects the seeded example when opened from the Examples tab', () => {
    const server = makeServer();
    server.samples = [{
      id: 's-health',
      name: 'GET /users',
      routeId: 'r1',
      request: {
        method: 'GET', path: '/users', rawPath: '/users', query: { active: ['true'] },
        headers: { 'X-Tenant': 'acme' }, cookies: {},
        body: '{"n":1}', bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched', status: 200 },
    }];
    render(
      <ApiMockSimulateModal
        server={server}
        initialPath="/users?active=true"
        initialMethod="GET"
        initialSampleId="s-health"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-sim-sample-s-health').className).toContain('active');
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveValue('/users?active=true');
    expect(screen.getByTestId('api-mock-simulate-headers')).toHaveValue('X-Tenant: acme');
    expect(screen.getByTestId('api-mock-simulate-body')).toHaveValue('{"n":1}');

    fireEvent.click(screen.getByTestId('api-mock-sim-sample-s-health').querySelector('.am-sim-sample-btn') as HTMLElement);
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveValue('/users?active=true');
  });

  it('fails a saved example when bodyContains does not match the rendered body', () => {
    const server = makeServer();
    server.samples = [{
      id: 's-body',
      name: 'GET /users',
      routeId: 'r1',
      request: {
        method: 'GET', path: '/users', rawPath: '/users', query: {},
        headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched', bodyContains: 'definitely-missing' },
    }];
    render(<ApiMockSimulateModal server={server} initialSampleId="s-body" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-sample-s-body').textContent).toContain('FAIL');
    fireEvent.click(screen.getByRole('tab', { name: 'Assertions' }));
    expect(screen.getByText('Body contains')).toBeTruthy();
    expect(screen.getAllByText('Fail').length).toBeGreaterThan(0);
  });

  it('fails a saved example when bodyExact does not match and shows the assertion row', () => {
    const server = makeServer();
    server.samples = [{
      id: 's-exact',
      name: 'GET /users',
      routeId: 'r1',
      request: {
        method: 'GET', path: '/users', rawPath: '/users', query: {},
        headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched', bodyExact: '{"nope":true}' },
    }];
    render(<ApiMockSimulateModal server={server} initialSampleId="s-exact" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-sample-s-exact').textContent).toContain('FAIL');
    fireEvent.click(screen.getByRole('tab', { name: 'Assertions' }));
    expect(screen.getByText('Body exact')).toBeTruthy();
    expect(screen.getAllByText('Fail').length).toBeGreaterThan(0);
  });

  it('marks an expected-ambiguous example as PASS instead of CONFLICT', () => {
    const server = makeServer();
    server.settings.selection.equalPriorityPolicy = 'reject';
    server.routes = [
      {
        id: 'r1', name: 'Dup A', enabled: true, method: 'GET', path: { kind: 'exact', value: '/dup' }, priority: 10,
        predicates: { id: 'pg1', combinator: 'all', children: [] }, responseMode: 'rules',
        responses: [createDefaultResponse('resp-a')], tags: [], createdAt: ts, updatedAt: ts,
      },
      {
        id: 'r2', name: 'Dup B', enabled: true, method: 'GET', path: { kind: 'exact', value: '/dup' }, priority: 10,
        predicates: { id: 'pg2', combinator: 'all', children: [] }, responseMode: 'rules',
        responses: [createDefaultResponse('resp-b')], tags: [], createdAt: ts, updatedAt: ts,
      },
    ];
    server.samples = [{
      id: 's-amb',
      name: 'dup conflict',
      request: {
        method: 'GET', path: '/dup', rawPath: '/dup', query: {},
        headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'ambiguous' },
    }];
    render(<ApiMockSimulateModal server={server} initialSampleId="s-amb" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-sample-s-amb').textContent).toContain('PASS');
    expect(screen.getByTestId('api-mock-simulate-summary').textContent).toMatch(/1 passed/);
  });

  it('filters saved samples by query string', () => {
    const server = makeServer();
    server.samples = [{
      id: 's-q',
      name: 'Users',
      request: {
        method: 'GET', path: '/users', rawPath: '/users', query: { active: ['true'] },
        headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
      },
    }];
    render(<ApiMockSimulateModal server={server} onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-sim-sample-s-q').textContent).toContain('/users?active=true');
    fireEvent.change(screen.getByLabelText('Filter samples'), { target: { value: 'active=true' } });
    expect(screen.getByTestId('api-mock-sim-sample-s-q')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter samples'), { target: { value: 'no-such-sample' } });
    expect(screen.queryByTestId('api-mock-sim-sample-s-q')).toBeNull();
  });

  it('labels auto route stubs as From rules and hides the expand control', () => {
    render(<ApiMockSimulateModal server={makeServer()} initialPath="/users" onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-sim-section-from-rules')).toHaveTextContent('From rules');
    expect(screen.getByTestId('api-mock-sim-section-from-rules')).toHaveTextContent('not saved');
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-auto-r1').querySelector('.am-sim-sample-btn') as HTMLElement);
    expect(screen.getByTestId('api-mock-sim-readonly-hint').textContent).toMatch(/never saved/);
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveValue('/users');
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveProperty('readOnly', true);
    expect(screen.queryByTestId('api-mock-simulate-save-sample')).toBeNull();
    fireEvent.click(screen.getByTestId('api-mock-sim-edit-adhoc'));
    expect(screen.getByTestId('api-mock-sim-sample-adhoc').className).toContain('active');
    expect(screen.getByTestId('api-mock-simulate-save-sample')).toBeTruthy();
    expect(screen.getByTestId('api-mock-sim-section-from-rules')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-sim-section-saved')).toBeNull();
    expect(document.querySelector('.modal-expand-btn')).toBeNull();
    expect(screen.getByLabelText('Replay seed').getAttribute('title')).toMatch(/random choices/);
    expect(screen.getByLabelText('Replay seed').closest('.am-form-row')).toHaveClass('am-form-row--tall');
    expect(screen.getByTestId('api-mock-simulate-save-sample')).toHaveClass('primary');
    expect(screen.queryByTestId('api-mock-simulate-sample-name')).toBeNull();
    fireEvent.click(screen.getByTestId('api-mock-simulate-save-sample'));
    expect(screen.getByTestId('api-mock-sim-section-saved')).toHaveTextContent('Saved samples');
    expect(screen.getByTestId('api-mock-simulate-sample-name')).toHaveValue('GET /users');
    expect(screen.queryByTestId('api-mock-sim-section-from-rules')).toBeNull();
  });

  it('saves the ad-hoc request then names it, and toggles Request / Results after a run', () => {
    const onSaveSample = vi.fn();
    const onUpdateSample = vi.fn();
    render(
      <ApiMockSimulateModal
        server={makeServer()}
        initialPath="/users"
        initialMethod="GET"
        onSaveSample={onSaveSample}
        onUpdateSample={onUpdateSample}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('api-mock-sim-view-request')).toBeNull();
    expect(screen.getByTestId('api-mock-sim-main').className).toContain('am-sim-main--request');
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-main').className).toContain('am-sim-main--results');
    expect(screen.getByTestId('api-mock-simulate-result')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-sim-view-request'));
    expect(screen.getByTestId('api-mock-sim-main').className).toContain('am-sim-main--request');
    expect(screen.queryByTestId('api-mock-simulate-result')).toBeNull();
    fireEvent.click(screen.getByTestId('api-mock-simulate-save-sample'));
    expect(onSaveSample).toHaveBeenCalledWith(expect.objectContaining({
      name: 'GET /users',
      request: expect.objectContaining({ method: 'GET', path: '/users' }),
    }));
    expect(screen.getByTestId('api-mock-sim-section-saved')).toHaveTextContent('Saved samples');
    expect(screen.queryByTestId('api-mock-sim-section-from-rules')).toBeNull();
    fireEvent.change(screen.getByTestId('api-mock-simulate-sample-name'), { target: { value: 'Nightly health' } });
    expect(onUpdateSample).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nightly health' }));
    expect(screen.getByTestId('api-mock-simulate-sample-name')).toHaveValue('Nightly health');
    fireEvent.click(screen.getByTestId('api-mock-sim-view-results'));
    expect(screen.getByTestId('api-mock-simulate-result')).toBeTruthy();
  });

  it('restores the full saved request when reopening a sample from the sidebar', () => {
    const onSaveSample = vi.fn();
    render(
      <ApiMockSimulateModal
        server={makeServer()}
        initialPath="/users"
        initialMethod="GET"
        onSaveSample={onSaveSample}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-simulate-path'), { target: { value: '/firmware' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), { target: { value: 'X-Tenant: acme' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-body'), { target: { value: '{"sha":"abc"}' } });
    fireEvent.click(screen.getByTestId('api-mock-simulate-save-sample'));
    const savedId = onSaveSample.mock.calls[0][0].id as string;
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-adhoc').querySelector('.am-sim-sample-btn') as HTMLElement);
    fireEvent.change(screen.getByTestId('api-mock-simulate-path'), { target: { value: '/other' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-body'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId(`api-mock-sim-sample-${savedId}`).querySelector('.am-sim-sample-btn') as HTMLElement);
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveValue('/firmware');
    expect(screen.getByTestId('api-mock-simulate-headers')).toHaveValue('x-tenant: acme');
    expect(screen.getByTestId('api-mock-simulate-body')).toHaveValue('{"sha":"abc"}');
  });

  it('restores the ad-hoc draft after clicking a From rules probe', () => {
    render(<ApiMockSimulateModal server={makeServer()} initialPath="/users" onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('api-mock-simulate-path'), { target: { value: '/firmware' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), { target: { value: 'X-Tenant: acme' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-body'), { target: { value: '{"sha":"abc"}' } });
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-auto-r1').querySelector('.am-sim-sample-btn') as HTMLElement);
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveValue('/users');
    expect(screen.getByTestId('api-mock-simulate-headers')).toHaveValue('');
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-adhoc').querySelector('.am-sim-sample-btn') as HTMLElement);
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveValue('/firmware');
    expect(screen.getByTestId('api-mock-simulate-headers')).toHaveValue('X-Tenant: acme');
    expect(screen.getByTestId('api-mock-simulate-body')).toHaveValue('{"sha":"abc"}');
  });

  it('shows a per-sample state chip after a sequential run-all', () => {
    const server = makeServer();
    const empty = createDefaultResponse('resp-empty');
    empty.name = 'In cart';
    empty.transition = { currentState: 'EMPTY', targetState: 'HAS_ITEMS', counterUpdates: [{ key: 'items', delta: 1 }] };
    const hasItems = createDefaultResponse('resp-items');
    hasItems.name = 'Has items';
    hasItems.isDefault = false;
    hasItems.transition = { currentState: 'HAS_ITEMS', targetState: 'CHECKED_OUT' };
    server.routes = [{
      id: 'r-cart', name: 'Add to cart', enabled: true, method: 'POST',
      path: { kind: 'exact', value: '/cart' }, priority: 10,
      predicates: { id: 'pg-cart', combinator: 'all', children: [] },
      responseMode: 'state', responses: [empty, hasItems], tags: [], createdAt: ts, updatedAt: ts,
    }];
    render(<ApiMockSimulateModal server={server} initialPath="/cart" initialMethod="POST" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run-all'));
    const chips = screen.getAllByTestId('api-mock-sim-sample-state');
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].textContent).toMatch(/HAS_ITEMS|\(empty\)/);
  });

  it('edits expected status on the assertions table for a saved sample', () => {
    const onUpdateSample = vi.fn();
    const server = makeServer();
    server.samples = [{
      id: 's-health',
      name: 'GET /users',
      routeId: 'r1',
      request: {
        method: 'GET', path: '/users', rawPath: '/users', query: {},
        headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched', status: 200 },
    }];
    render(<ApiMockSimulateModal server={server} initialSampleId="s-health" onUpdateSample={onUpdateSample} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    fireEvent.click(screen.getByRole('tab', { name: 'Assertions' }));
    fireEvent.change(screen.getByTestId('api-mock-sim-assert-status'), { target: { value: '201' } });
    expect(onUpdateSample).toHaveBeenCalledWith(expect.objectContaining({
      id: 's-health',
      expected: expect.objectContaining({ status: 201 }),
    }));
    fireEvent.change(screen.getByTestId('api-mock-sim-assert-status'), { target: { value: '' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.status).toBeUndefined();
    fireEvent.change(screen.getByTestId('api-mock-sim-assert-body'), { target: { value: 'ok' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.bodyContains).toBe('ok');
  });

  it('turns the sidebar badge to FAIL when expected status no longer matches the last run', () => {
    const server = makeServer();
    server.samples = [{
      id: 's-health',
      name: 'GET /users',
      routeId: 'r1',
      request: {
        method: 'GET', path: '/users', rawPath: '/users', query: {},
        headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched', status: 200 },
    }];
    render(<ApiMockSimulateModal server={server} initialSampleId="s-health" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByText('PASS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Assertions' }));
    fireEvent.change(screen.getByTestId('api-mock-sim-assert-status'), { target: { value: '201' } });
    expect(screen.getByTestId('api-mock-sim-sample-fail')).toHaveTextContent('FAIL');
  });
});
