/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockExamplesPanel } from './ApiMockExamplesPanel';
import type { ApiMockSimulationSampleV1 } from '../../../shared/api-mock/contracts';
import { CUSTOM_SELECT_SET_VALUE_EVENT } from '../../../shared/components/CustomSelect';

const ts = '2026-08-13T00:00:00.000Z';

function sample(overrides: Partial<ApiMockSimulationSampleV1> = {}): ApiMockSimulationSampleV1 {
  return {
    id: 's1',
    name: 'GET /users',
    routeId: 'r1',
    request: {
      method: 'GET', path: '/users', rawPath: '/users', query: {}, headers: {}, cookies: {},
      body: null, bodyTruncated: false, receivedAt: ts,
    },
    expected: { outcome: 'matched', status: 200 },
    ...overrides,
  };
}

describe('ApiMockExamplesPanel', () => {
  it('shows the empty notice when there are no samples', () => {
    render(<ApiMockExamplesPanel samples={[]} />);
    expect(screen.getByTestId('api-mock-examples-empty').textContent).toMatch(/Save as sample/);
    expect(screen.getByTestId('api-mock-examples-empty').textContent).toMatch(/Save as example/);
  });

  it('renders without optional action callbacks and clears optional expected fields', () => {
    const onUpdateSample = vi.fn();
    render(
      <ApiMockExamplesPanel
        samples={[sample({ expected: { outcome: 'matched', status: 200, bodyContains: 'ok', bodyExact: '{"ok":true}' } })]}
        onUpdateSample={onUpdateSample}
      />,
    );
    expect(screen.queryByTestId('api-mock-example-simulate-s1')).toBeNull();
    expect(screen.queryByTestId('api-mock-example-try-s1')).toBeNull();
    expect(screen.queryByTestId('api-mock-example-delete-s1')).toBeNull();

    fireEvent.change(screen.getByTestId('api-mock-example-body-s1'), { target: { value: '' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.bodyContains).toBeUndefined();

    fireEvent.change(screen.getByTestId('api-mock-example-body-exact-s1'), { target: { value: '' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.bodyExact).toBeUndefined();

    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: 'not-a-number' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.status).toBeUndefined();
    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: '201.5' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.status).toBeUndefined();
  });

  it('does not throw when expected fields change without an update handler', () => {
    render(<ApiMockExamplesPanel samples={[sample({ expected: undefined })]} />);
    fireEvent.change(screen.getByTestId('api-mock-example-name-s1'), { target: { value: 'Renamed' } });
    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: '204' } });
    fireEvent.change(screen.getByTestId('api-mock-example-body-s1'), { target: { value: 'x' } });
    fireEvent.change(screen.getByTestId('api-mock-example-body-exact-s1'), { target: { value: '{}' } });
    fireEvent(screen.getByTestId('api-mock-example-outcome-s1'), new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'fault' } }));
  });

  it('edits expected fields, tries in Requests, simulates, and deletes', () => {
    const onUpdateSample = vi.fn();
    const onDeleteSample = vi.fn();
    const onTryInRequests = vi.fn();
    const onSimulate = vi.fn();
    render(
      <ApiMockExamplesPanel
        samples={[sample({ expected: { outcome: 'matched', status: 200 } })]}
        onUpdateSample={onUpdateSample}
        onDeleteSample={onDeleteSample}
        onTryInRequests={onTryInRequests}
        onSimulate={onSimulate}
      />,
    );

    fireEvent.change(screen.getByTestId('api-mock-example-name-s1'), { target: { value: 'Happy path' } });
    expect(onUpdateSample.mock.calls[0][0].name).toBe('Happy path');

    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: '201' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.status).toBe(201);
    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: '0' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.status).toBe(0);
    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: '600' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.status).toBeUndefined();
    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: '-1' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.status).toBeUndefined();
    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: '' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.status).toBeUndefined();

    fireEvent.change(screen.getByTestId('api-mock-example-body-s1'), { target: { value: 'ok' } });
    fireEvent.change(screen.getByTestId('api-mock-example-body-exact-s1'), { target: { value: '{"ok":true}' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.bodyExact).toBe('{"ok":true}');

    fireEvent(screen.getByTestId('api-mock-example-outcome-s1'), new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'unmatched' } }));
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.outcome).toBe('unmatched');

    fireEvent.click(screen.getByTestId('api-mock-example-simulate-s1'));
    fireEvent.click(screen.getByTestId('api-mock-example-try-s1'));
    fireEvent.click(screen.getByTestId('api-mock-example-delete-s1'));
    expect(onSimulate).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    expect(onTryInRequests).toHaveBeenCalled();
    expect(onDeleteSample).toHaveBeenCalledWith('s1');
  });

  it('attaches an unassociated example to the current rule', () => {
    const onUpdateSample = vi.fn();
    render(
      <ApiMockExamplesPanel
        samples={[sample({ routeId: undefined })]}
        attachRouteId="r1"
        onUpdateSample={onUpdateSample}
      />,
    );
    expect(screen.getAllByText('Unassociated').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByTestId('api-mock-example-attach-s1'));
    expect(onUpdateSample.mock.calls[0][0].routeId).toBe('r1');
    expect(onUpdateSample.mock.calls[0][0].expected.routeId).toBe('r1');
  });

  it('shows the captured path including query string', () => {
    render(
      <ApiMockExamplesPanel
        samples={[sample({
          request: {
            method: 'GET', path: '/users', rawPath: '/users', query: { q: ['ada'] }, headers: {}, cookies: {},
            body: null, bodyTruncated: false, receivedAt: ts,
          },
        })]}
      />,
    );
    const pathEls = screen.getAllByText('/users?q=ada');
    expect(pathEls.length).toBeGreaterThanOrEqual(1);
  });

  it('defaults expected outcome to matched when it was omitted', () => {
    const onUpdateSample = vi.fn();
    render(
      <ApiMockExamplesPanel
        samples={[sample({ routeId: undefined, expected: { status: 201, bodyContains: 'x', bodyExact: '{}' } })]}
        attachRouteId="r1"
        onUpdateSample={onUpdateSample}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-example-status-s1'), { target: { value: '204' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.outcome).toBe('matched');
    fireEvent.change(screen.getByTestId('api-mock-example-body-s1'), { target: { value: 'ok' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.outcome).toBe('matched');
    fireEvent.change(screen.getByTestId('api-mock-example-body-exact-s1'), { target: { value: '{"ok":true}' } });
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.outcome).toBe('matched');
    fireEvent.click(screen.getByTestId('api-mock-example-attach-s1'));
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.outcome).toBe('matched');
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.routeId).toBe('r1');
  });

  it('pretty-formats a compact JSON body exact', () => {
    const onUpdateSample = vi.fn();
    render(
      <ApiMockExamplesPanel
        samples={[sample({ expected: { outcome: 'unmatched', bodyExact: '{"error":"not_found","mode":"closest_match_debug"}' } })]}
        onUpdateSample={onUpdateSample}
      />,
    );
    const pretty = screen.getByTestId('api-mock-example-body-pretty-s1');
    expect(pretty).toBeEnabled();
    fireEvent.click(pretty);
    expect(onUpdateSample.mock.calls.at(-1)?.[0].expected.bodyExact).toBe(
      '{\n  "error": "not_found",\n  "mode": "closest_match_debug"\n}',
    );
  });

  it('shows an error when Pretty format is clicked on invalid JSON and clears it on edit', () => {
    const onUpdateSample = vi.fn();
    render(
      <ApiMockExamplesPanel
        samples={[sample({ expected: { bodyExact: '{not-json' } })]}
        onUpdateSample={onUpdateSample}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-example-body-pretty-s1'));
    expect(screen.getByTestId('api-mock-example-body-pretty-error-s1')).toHaveTextContent(/JSON/i);
    expect(onUpdateSample).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('api-mock-example-body-exact-s1'), { target: { value: '{}' } });
    expect(screen.queryByTestId('api-mock-example-body-pretty-error-s1')).toBeNull();
  });

  it('disables Pretty format when body exact is empty', () => {
    render(<ApiMockExamplesPanel samples={[sample()]} />);
    expect(screen.getByTestId('api-mock-example-body-pretty-s1')).toBeDisabled();
  });
});
