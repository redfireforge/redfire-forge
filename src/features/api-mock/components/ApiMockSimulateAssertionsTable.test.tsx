/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockSimulateAssertionsTable } from './ApiMockSimulateAssertionsTable';
import type { ApiMockSimulationResultV1 } from '@shared/api-mock/contracts';

function result(overrides: Partial<ApiMockSimulationResultV1> = {}): ApiMockSimulationResultV1 {
  return {
    sampleId: 's1',
    generation: 'draft',
    outcome: 'matched',
    trace: {
      normalizedRequest: {
        method: 'GET', path: '/health', decodedPath: '/health', pathSegments: ['health'],
        query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0,
      },
      candidates: [],
      policyDecision: {
        matchedCount: 1, selectedRouteId: 'r1', policy: 'highest_priority',
        equalPriorityPolicy: 'reject', highestPriority: 10, tiedAtHighest: 1, outcome: 'matched',
      },
      nearMisses: [],
    },
    preview: { fault: 'none', virtualDelayMs: 0, baseDelayMs: 0, jitterAppliedMs: 0, httpCompleted: true, selectedResponseId: 'resp-1' },
    renderedResponse: { status: 200, body: '{"ok":true}', contentType: 'application/json', headers: {} },
    ...overrides,
  } as ApiMockSimulationResultV1;
}

describe('ApiMockSimulateAssertionsTable', () => {
  it('renders dashes when nothing is expected and stays read-only', () => {
    render(<ApiMockSimulateAssertionsTable result={result()} canEdit={false} />);
    expect(screen.getByTestId('api-mock-sim-assert-row-outcome').textContent).toContain('matched');
    expect(screen.queryByTestId('api-mock-sim-assert-status')).toBeNull();
    expect(screen.queryByTestId('api-mock-sim-assert-fail')).toBeNull();
    expect(screen.getByTestId('api-mock-sim-assert-hint').textContent).toMatch(/saved sample/i);
  });

  it('marks mismatched status and body-contains as Fail', () => {
    render(
      <ApiMockSimulateAssertionsTable
        result={result()}
        expected={{ outcome: 'matched', routeId: 'r-other', responseId: 'resp-other', status: 201, bodyContains: 'nope', bodyExact: '{}' }}
        winnerId="r1"
        canEdit={false}
      />,
    );
    expect(screen.getAllByTestId('api-mock-sim-assert-fail').length).toBeGreaterThan(0);
  });

  it('passes matching expected fields including body exact', () => {
    render(
      <ApiMockSimulateAssertionsTable
        result={result()}
        expected={{ outcome: 'matched', routeId: 'r1', responseId: 'resp-1', status: 200, bodyContains: 'ok', bodyExact: '{"ok":true}' }}
        winnerId="r1"
        canEdit={false}
      />,
    );
    expect(screen.queryByTestId('api-mock-sim-assert-fail')).toBeNull();
    expect(screen.getByTestId('api-mock-sim-assert-row-body').textContent).toContain('yes');
  });

  it('treats incomplete HTTP as having no actual status', () => {
    render(
      <ApiMockSimulateAssertionsTable
        result={result({ preview: { fault: 'reset', virtualDelayMs: 0, baseDelayMs: 0, jitterAppliedMs: 0, httpCompleted: false, faultTimeline: [] } })}
        expected={{ outcome: 'fault', status: 200 }}
        canEdit={false}
      />,
    );
    expect(screen.getByTestId('api-mock-sim-assert-row-status').textContent).toContain('—');
  });

  it('edits status and body-contains, ignoring invalid status text', () => {
    const onPatchExpected = vi.fn();
    render(
      <ApiMockSimulateAssertionsTable
        result={result()}
        expected={{ outcome: 'matched', status: 200 }}
        canEdit
        onPatchExpected={onPatchExpected}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-sim-assert-status'), { target: { value: '201' } });
    expect(onPatchExpected).toHaveBeenCalledWith(expect.objectContaining({ status: 201 }));
    fireEvent.change(screen.getByTestId('api-mock-sim-assert-status'), { target: { value: 'nope' } });
    expect(onPatchExpected.mock.calls.at(-1)?.[0].status).toBeUndefined();
    fireEvent.change(screen.getByTestId('api-mock-sim-assert-body'), { target: { value: 'ok' } });
    expect(onPatchExpected.mock.calls.at(-1)?.[0].bodyContains).toBe('ok');
    expect(screen.getByTestId('api-mock-sim-assert-hint').textContent).toMatch(/Status and Body contains/i);
  });
});
