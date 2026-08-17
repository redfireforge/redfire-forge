import { describe, expect, it } from 'vitest';
import { deriveScenarioModel, httpStatusTone, timeOf } from './apiMockDockHelpers';
import type { ApiMockRouteV1 } from '../../../shared/api-mock/contracts';

describe('apiMockDockHelpers', () => {
  it('maps HTTP status bands and missing status', () => {
    expect(httpStatusTone(undefined)).toBe('');
    expect(httpStatusTone(199)).toBe('info');
    expect(httpStatusTone(200)).toBe('success');
    expect(httpStatusTone(301)).toBe('info');
    expect(httpStatusTone(404)).toBe('warning');
    expect(httpStatusTone(500)).toBe('danger');
  });

  it('formats valid times and falls back for invalid ISO', () => {
    expect(timeOf('not-a-date')).toBe('—');
    expect(timeOf('2026-08-12T00:00:00.000Z')).not.toBe('—');
  });

  it('collects scenario states and counters from transitions', () => {
    expect(deriveScenarioModel([])).toEqual({ states: [], counters: [] });
    const routes = [
      {
        responses: [
          { transition: undefined },
          {
            transition: {
              currentState: 'idle',
              targetState: 'busy',
              counterUpdates: [{ key: 'hits' }, { key: 'hits' }],
            },
          },
        ],
      },
    ] as unknown as ApiMockRouteV1[];
    expect(deriveScenarioModel(routes)).toEqual({
      states: ['idle', 'busy'],
      counters: ['hits'],
    });
    expect(deriveScenarioModel([
      { responses: [{ transition: { currentState: 'only' } }] },
      { responses: [{ transition: { targetState: 'next' } }] },
    ] as unknown as ApiMockRouteV1[])).toEqual({
      states: ['only', 'next'],
      counters: [],
    });
  });
});
