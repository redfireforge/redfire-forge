/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));
    const result = screen.getByTestId('api-mock-simulate-result');
    expect(result.textContent).toContain('MATCHED');
    expect(result.textContent).toContain('Users exact');
    expect(screen.getByText('Candidates evaluated (2)')).toBeTruthy();
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
});
