/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ApiMockSimulationResultV1, ApiMockSimulationSampleV1 } from '../../../shared/api-mock/contracts';
import { simulateSampleBadge } from './apiMockSimulateModalHelpers';
import { ApiMockSimulateSampleList } from './ApiMockSimulateSampleList';

const adhoc: ApiMockSimulationSampleV1 = {
  id: 'adhoc',
  name: 'Ad-hoc request',
  request: {
    method: 'GET', path: '/', rawPath: '/', query: {}, cookies: {}, headers: {},
    body: null, bodyTruncated: false, receivedAt: '2026-08-12T00:00:00.000Z',
  },
};
const saved: ApiMockSimulationSampleV1 = {
  ...adhoc, id: 's1', name: 'Saved GET', request: { ...adhoc.request, path: '/saved', rawPath: '/saved' },
};
const fromRules: ApiMockSimulationSampleV1 = {
  ...adhoc, id: 'auto-r1', name: 'From rule', request: { ...adhoc.request, path: '/auto', rawPath: '/auto' },
};

function result(partial: Partial<ApiMockSimulationResultV1>): ApiMockSimulationResultV1 {
  return { outcome: 'matched', passed: true, ...partial } as ApiMockSimulationResultV1;
}

describe('simulateSampleBadge', () => {
  it('classifies pass, conflict, fail, and default pass', () => {
    expect(simulateSampleBadge(undefined)).toBeNull();
    expect(simulateSampleBadge(result({ passed: true }))).toBe('PASS');
    expect(simulateSampleBadge(result({ passed: false, outcome: 'ambiguous' }))).toBe('CONFLICT');
    expect(simulateSampleBadge(result({ passed: false, outcome: 'unmatched' }))).toBe('FAIL');
    expect(simulateSampleBadge(result({ passed: undefined, outcome: 'matched' }))).toBe('PASS');
  });
});

describe('ApiMockSimulateSampleList', () => {
  it('renders sections, badges, state chip, and remove/select actions', () => {
    const onSelectSample = vi.fn();
    const onRemoveSample = vi.fn();
    render(
      <ApiMockSimulateSampleList
        adHocId="adhoc"
        samples={[adhoc, saved, fromRules]}
        filteredSamples={[adhoc, saved, fromRules]}
        firstPersistedIdx={1}
        firstAutoIdx={2}
        selectedSampleId="s1"
        resultBySample={{
          s1: result({
            passed: false,
            outcome: 'unmatched',
            preview: { responseMode: 'state', stateBefore: 'idle', stateAfter: 'busy' },
          } as Partial<ApiMockSimulationResultV1>),
          'auto-r1': result({ passed: false, outcome: 'ambiguous' }),
        }}
        filter=""
        setFilter={vi.fn()}
        passedCount={0}
        conflictCount={1}
        onSelectSample={onSelectSample}
        onRemoveSample={onRemoveSample}
      />,
    );
    expect(screen.getByTestId('api-mock-sim-section-scratch')).toBeTruthy();
    expect(screen.getByTestId('api-mock-sim-section-saved')).toBeTruthy();
    expect(screen.getByTestId('api-mock-sim-section-from-rules')).toBeTruthy();
    expect(screen.getByTestId('api-mock-sim-sample-fail')).toHaveTextContent('FAIL');
    expect(screen.getByTestId('api-mock-sim-sample-state')).toHaveTextContent('idle → busy');
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-adhoc').querySelector('button')!);
    expect(onSelectSample).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('api-mock-sim-sample-remove-s1'));
    expect(onRemoveSample).toHaveBeenCalledWith('s1');
  });

  it('filters through the search box', () => {
    const setFilter = vi.fn();
    render(
      <ApiMockSimulateSampleList
        adHocId="adhoc"
        samples={[adhoc]}
        filteredSamples={[adhoc]}
        firstPersistedIdx={-1}
        firstAutoIdx={-1}
        selectedSampleId="adhoc"
        resultBySample={{}}
        filter="users"
        setFilter={setFilter}
        passedCount={0}
        conflictCount={0}
        onSelectSample={vi.fn()}
        onRemoveSample={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Filter samples'), { target: { value: 'x' } });
    expect(setFilter).toHaveBeenCalledWith('x');
  });
});
