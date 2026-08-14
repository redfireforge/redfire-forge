/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
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
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

function mockSimulateModule(singleFn: () => unknown, batchFn?: () => unknown[]) {
  vi.doMock('../../../shared/api-mock/simulation', () => ({
    simulateSingle: singleFn,
    simulateBatch: batchFn ?? (() => []),
  }));
}

describe('ApiMockSimulateModal coverage gaps', () => {
  it('exports trace JSON when results exist', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:trace');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClick = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args) => {
      const el = origCreate(tag, ...args);
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(anchorClick);
      return el;
    });

    mockSimulateModule(() => ({
      outcome: 'matched',
      trace: {
        normalizedRequest: { method: 'GET', path: '/x', decodedPath: '/x', pathSegments: ['x'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
        candidates: [{ routeId: 'r1', routeName: 'R', priority: 1, enabled: true, methodMatch: true, pathMatch: true, predicateResults: [], overallMatch: true }],
        policyDecision: { matchedCount: 1, selectedRouteId: 'r1', policy: 'highest_priority', equalPriorityPolicy: 'reject', highestPriority: 1, tiedAtHighest: 1, outcome: 'matched' },
        nearMisses: [],
      },
      preview: { fault: 'none', virtualDelayMs: 0, baseDelayMs: 0, jitterAppliedMs: 0, httpCompleted: true, faultTimeline: [{ atMs: 0, label: 'Write status + body' }] },
      renderedResponse: { status: 200, body: '{}', contentType: 'application/json', headers: {} },
    }));

    const { ApiMockSimulateModal } = await import('./ApiMockSimulateModal');
    render(<ApiMockSimulateModal server={makeServer()} onClose={vi.fn()} />);
    expect(screen.getByTestId('api-mock-simulate-export')).toBeDisabled();
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    fireEvent.click(screen.getByTestId('api-mock-simulate-export'));
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:trace');
  });

  it('selects a non-adhoc sample and shows FAIL badge when expectations mismatch', async () => {
    const server = makeServer();
    server.samples = [{
      id: 'sample-1',
      name: 'Expected match',
      routeId: 'r1',
      request: {
        method: 'GET',
        path: '/users',
        rawPath: '/users',
        query: {},
        cookies: {},
        headers: { 'X-Tenant': 'acme' },
        body: '{"id":1}',
        bodyTruncated: false,
        receivedAt: ts,
      },
      expected: { outcome: 'matched', routeId: 'r1', status: 404 },
    }];

    mockSimulateModule(() => ({
      outcome: 'matched',
      trace: {
        normalizedRequest: { method: 'GET', path: '/users', decodedPath: '/users', pathSegments: ['users'], query: {}, headerKeys: ['x-tenant'], cookieKeys: [], bodySizeBytes: 4 },
        candidates: [{ routeId: 'r1', routeName: 'Users exact', priority: 20, enabled: true, methodMatch: true, pathMatch: true, predicateResults: [], overallMatch: true }],
        policyDecision: { matchedCount: 1, selectedRouteId: 'r1', policy: 'highest_priority', equalPriorityPolicy: 'reject', highestPriority: 20, tiedAtHighest: 1, outcome: 'matched' },
        nearMisses: [],
      },
      preview: { fault: 'none', virtualDelayMs: 0, baseDelayMs: 0, jitterAppliedMs: 0, selectedResponseId: 'resp-1', httpCompleted: true, faultTimeline: [] },
      renderedResponse: { status: 200, body: '{}', contentType: 'application/json', headers: {} },
    }));

    const { ApiMockSimulateModal } = await import('./ApiMockSimulateModal');
    render(<ApiMockSimulateModal server={server} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-sample-1').querySelector('.am-sim-sample-btn') as HTMLElement);
    expect(screen.getByTestId('api-mock-sim-sample-sample-1')).toHaveClass('active');
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveValue('/users');
    expect(screen.getByTestId('api-mock-simulate-path')).toHaveProperty('readOnly', true);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-sample-sample-1').textContent).toContain('FAIL');
    fireEvent.click(screen.getByRole('tab', { name: 'Assertions' }));
    expect(screen.getByText('Fail')).toBeTruthy();
  });

  it('renders candidate failure badges, predicate rows, fault timeline, and state hints', async () => {
    mockSimulateModule(() => ({
      outcome: 'fault',
      trace: {
        normalizedRequest: { method: 'GET', path: '/users/admin', decodedPath: '/users/admin', pathSegments: ['users', 'admin'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
        candidates: [
          { routeId: 'r1', routeName: 'A', priority: 10, enabled: true, methodMatch: true, pathMatch: true, predicateResults: [{ predicateId: 'p1', source: 'header', operator: 'present', passed: true, reason: 'ok' }], overallMatch: true },
          { routeId: 'r2', routeName: 'B', priority: 10, enabled: true, methodMatch: false, pathMatch: true, predicateResults: [], overallMatch: false },
          { routeId: 'r3', routeName: 'C', priority: 5, enabled: true, methodMatch: true, pathMatch: false, predicateResults: [], overallMatch: false },
          { routeId: 'r4', routeName: 'D', priority: 1, enabled: true, methodMatch: true, pathMatch: true, predicateResults: [{ predicateId: 'p2', source: 'body', operator: 'contains', passed: false, reason: 'missing token' }], overallMatch: false },
        ],
        policyDecision: { matchedCount: 1, selectedRouteId: 'r1', policy: 'highest_priority', equalPriorityPolicy: 'reject', highestPriority: 10, tiedAtHighest: 1, outcome: 'fault' },
        nearMisses: [{ routeName: 'Near 1' }, { routeName: 'Near 2' }],
      },
      preview: {
        fault: 'reset',
        virtualDelayMs: 12,
        baseDelayMs: 10,
        jitterAppliedMs: 2,
        selectedResponseId: 'resp-1',
        selectedResponseName: 'Default',
        responseMode: 'state',
        sequenceIndex: 2,
        eligibilityFallback: true,
        eligibilityReason: 'state mismatch',
        transitionApplied: true,
        stateBefore: 'idle',
        stateAfter: 'open',
        httpCompleted: false,
        faultTimeline: [{ atMs: 0, label: 'Socket destroy (TCP reset)' }],
      },
      renderedResponse: { status: 500, body: null, contentType: 'application/json', headers: {} },
    }));

    const { ApiMockSimulateModal } = await import('./ApiMockSimulateModal');
    render(<ApiMockSimulateModal server={makeServer()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));

    expect(screen.getByTestId('api-mock-simulate-result').textContent).toContain('FAULT');
    expect(screen.getByTestId('api-mock-sim-fault-badge').textContent).toContain('reset');
    expect(screen.getByText('Near misses')).toBeTruthy();
    expect(screen.getByText(/Near 1, Near 2 matched method\/path but failed conditions/)).toBeTruthy();
    expect(screen.getByText('Path failed')).toBeTruthy();
    expect(screen.getByText('Method failed')).toBeTruthy();
    expect(screen.getByText('Conditions failed')).toBeTruthy();
    expect(screen.getByText('missing token')).toBeTruthy();
    expect(screen.getByTestId('api-mock-sim-timeline-6').textContent).toMatch(/Socket destroy/i);

    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));
    expect(screen.getByText(/No HTTP body would reach the client/)).toBeTruthy();
    expect(screen.getByText(/Fault timeline \(virtual\)/)).toBeTruthy();
    expect(screen.getByText(/t\+0ms — Socket destroy/)).toBeTruthy();
  });

  it('shows no-winner timeline hints and empty rendered response', async () => {
    mockSimulateModule(() => ({
      outcome: 'unmatched',
      trace: {
        normalizedRequest: { method: 'GET', path: '/nope', decodedPath: '/nope', pathSegments: ['nope'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
        candidates: [],
        policyDecision: { matchedCount: 0, selectedRouteId: undefined, policy: 'highest_priority', equalPriorityPolicy: 'reject', highestPriority: 0, tiedAtHighest: 0, outcome: 'unmatched' },
        nearMisses: [],
      },
      preview: undefined,
      renderedResponse: undefined,
    }));

    const { ApiMockSimulateModal } = await import('./ApiMockSimulateModal');
    render(<ApiMockSimulateModal server={makeServer()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-timeline-4').textContent).toContain('No winning rule');
    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));
    expect(screen.getByText('No response rendered for this outcome.')).toBeTruthy();
  });

  it('runAll annotates batch results via simulateBatch', async () => {
    const server = makeServer();
    server.routes = [
      { id: 'r1', name: 'A', enabled: true, method: 'GET', path: { kind: 'exact', value: '/a' }, priority: 1, predicates: { id: 'p1', combinator: 'all', children: [] }, responseMode: 'rules', responses: [], tags: [], createdAt: ts, updatedAt: ts },
      { id: 'r2', name: 'B', enabled: true, method: 'GET', path: { kind: 'exact', value: '/b' }, priority: 1, predicates: { id: 'p2', combinator: 'all', children: [] }, responseMode: 'rules', responses: [], tags: [], createdAt: ts, updatedAt: ts },
    ];
    mockSimulateModule(
      () => ({ outcome: 'matched', trace: { normalizedRequest: {}, candidates: [], policyDecision: { matchedCount: 0, outcome: 'matched' }, nearMisses: [] } }),
      () => [
        { outcome: 'matched', trace: { normalizedRequest: {}, candidates: [], policyDecision: { matchedCount: 1, outcome: 'matched' }, nearMisses: [] }, preview: { fault: 'none', virtualDelayMs: 0, httpCompleted: true, faultTimeline: [] }, renderedResponse: { status: 200, body: '', headers: {} } },
        { outcome: 'ambiguous', trace: { normalizedRequest: {}, candidates: [], policyDecision: { matchedCount: 2, outcome: 'ambiguous' }, nearMisses: [] } },
        { outcome: 'ambiguous', trace: { normalizedRequest: {}, candidates: [], policyDecision: { matchedCount: 2, outcome: 'ambiguous' }, nearMisses: [] } },
      ],
    );

    const { ApiMockSimulateModal } = await import('./ApiMockSimulateModal');
    render(<ApiMockSimulateModal server={server} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run-all'));
    expect(screen.getByTestId('api-mock-simulate-summary').textContent).toMatch(/2 conflicts/);
  });

  it('updates hidden adhoc controls while a saved sample is selected', async () => {
    const server = makeServer();
    server.samples = [{
      id: 'sample-2',
      name: 'Saved',
      routeId: 'r1',
      request: {
        method: 'GET', path: '/saved', rawPath: '/saved', query: {}, cookies: {},
        headers: { Accept: ['application/json', 'text/plain'] }, body: 'payload', bodyTruncated: false, receivedAt: ts,
      },
      expected: { outcome: 'matched', routeId: 'r1', responseId: 'resp-x' },
    }];

    mockSimulateModule(() => ({
      outcome: 'ambiguous',
      trace: {
        normalizedRequest: { method: 'POST', path: '/saved', decodedPath: '/saved', pathSegments: ['saved'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
        candidates: [
          { routeId: 'unknown-id', routeName: 'Ghost', priority: 1, enabled: true, methodMatch: true, pathMatch: true, predicateResults: [], overallMatch: true },
        ],
        policyDecision: { matchedCount: 2, selectedRouteId: undefined, policy: 'highest_priority', equalPriorityPolicy: 'reject', highestPriority: 1, tiedAtHighest: 2, outcome: 'ambiguous' },
        nearMisses: [],
      },
      preview: { fault: 'reset', virtualDelayMs: 5, httpCompleted: false, faultTimeline: [] },
    }));

    const { ApiMockSimulateModal } = await import('./ApiMockSimulateModal');
    render(<ApiMockSimulateModal server={server} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-sample-2').querySelector('.am-sim-sample-btn') as HTMLElement);
    expect(screen.getByTestId('api-mock-simulate-headers')).toHaveValue('Accept: application/json, text/plain');
    const paths = screen.getAllByTestId('api-mock-simulate-path');
    fireEvent.change(paths[paths.length - 1], { target: { value: '/edited' } });
    fireEvent.change(screen.getAllByTestId('api-mock-simulate-headers')[0], { target: { value: 'X-Edit: 1' } });
    fireEvent.change(screen.getAllByTestId('api-mock-simulate-body')[0], { target: { value: 'edited-body' } });
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-sample-sample-2').textContent).toContain('CONFLICT');
    fireEvent.click(screen.getByRole('tab', { name: 'Assertions' }));
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-remove-sample-2'));
    expect(screen.queryByTestId('api-mock-sim-sample-sample-2')).not.toBeInTheDocument();
  });

  it('shows dribble fault with HTTP body and content-type from headers', async () => {
    mockSimulateModule(() => ({
      outcome: 'fault',
      trace: {
        normalizedRequest: { method: 'GET', path: '/dribble', decodedPath: '/dribble', pathSegments: ['dribble'], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
        candidates: [{ routeId: 'r1', routeName: 'R', priority: 1, enabled: true, methodMatch: true, pathMatch: true, predicateResults: [], overallMatch: true }],
        policyDecision: { matchedCount: 1, selectedRouteId: 'r1', policy: 'highest_priority', equalPriorityPolicy: 'reject', highestPriority: 1, tiedAtHighest: 1, outcome: 'fault' },
        nearMisses: [],
      },
      preview: {
        fault: 'dribble',
        virtualDelayMs: 0,
        baseDelayMs: 0,
        jitterAppliedMs: 0,
        httpCompleted: true,
        faultTimeline: [{ atMs: 0, label: 'Write headers' }, { atMs: 20, label: 'Chunk "hi"' }],
        responseMode: 'state',
        stateBefore: 'idle',
        transitionApplied: false,
      },
      renderedResponse: { status: 200, body: 'partial', contentType: undefined, headers: { 'content-type': ['text/plain'] } },
    }));

    const { ApiMockSimulateModal } = await import('./ApiMockSimulateModal');
    render(<ApiMockSimulateModal server={makeServer()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    expect(screen.getByTestId('api-mock-sim-timeline-7').textContent).toMatch(/State guard on "idle"/);
    fireEvent.click(screen.getByRole('tab', { name: 'Rendered response' }));
    expect(screen.getByTestId('api-mock-sim-rendered-body').textContent).toContain('partial');
    expect(screen.getByText('text/plain')).toBeTruthy();
  });
});
