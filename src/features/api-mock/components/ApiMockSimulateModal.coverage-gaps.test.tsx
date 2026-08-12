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

describe('ApiMockSimulateModal coverage gaps', () => {
  it('renders a mocked trace with multiple near misses and all table display branches', async () => {
    vi.doMock('../../../shared/api-mock/simulation', () => ({
      simulateSingle: () => ({
        outcome: 'ambiguous',
        trace: {
          candidates: [
            { routeId: 'r1', routeName: 'A', priority: 10, enabled: true, methodMatch: true, pathMatch: true, predicateResults: [], overallMatch: true },
            { routeId: 'r2', routeName: 'B', priority: 10, enabled: true, methodMatch: false, pathMatch: false, predicateResults: [], overallMatch: false },
          ],
          policyDecision: { matchedCount: 2, selectedRouteId: undefined },
          nearMisses: [{ routeName: 'Near 1' }, { routeName: 'Near 2' }],
        },
      }),
    }));

    const { ApiMockSimulateModal } = await import('./ApiMockSimulateModal');
    render(<ApiMockSimulateModal server={makeServer()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-simulate-run'));

    expect(screen.getByTestId('api-mock-simulate-result').textContent).toContain('AMBIGUOUS');
    expect(screen.getByText('Near misses')).toBeTruthy();
    expect(screen.getByText(/Near 1, Near 2 matched method\/path but failed conditions/)).toBeTruthy();
    expect(screen.getAllByText('✕').length).toBeGreaterThan(0);
    expect(screen.getByText('no')).toBeTruthy();
  });
});
