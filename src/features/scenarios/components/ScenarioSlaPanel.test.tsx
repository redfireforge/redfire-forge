/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScenarioSlaPanel from './ScenarioSlaPanel';
import type { Scenario, SlaTarget } from '@shared/types';

function makeTest(id: string, name: string, method: Scenario['method'], slaTargets?: SlaTarget[]): Scenario {
  return {
    id,
    name,
    url: 'http://x',
    method,
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'status' } as Scenario['validation'],
    slaTargets,
  };
}

describe('ScenarioSlaPanel', () => {
  it('renders nothing when no SLA targets', () => {
    const { container } = render(<ScenarioSlaPanel tests={[makeTest('t1', 'A', 'GET')]} onEditTest={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders summary header with count and singular test wording', () => {
    const tests = [
      makeTest('t1', 'Login', 'POST', [
        { id: 's1', metric: 'p95', operator: 'lte', value: 800 },
      ]),
    ];
    render(<ScenarioSlaPanel tests={tests} onEditTest={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/1 test with SLA targets/)).toBeInTheDocument();
  });

  it('uses plural wording for multiple tests', () => {
    const tests = [
      makeTest('t1', 'A', 'GET', [{ id: 's1', metric: 'tps', operator: 'gte', value: 50 }]),
      makeTest('t2', 'B', 'GET', [{ id: 's2', metric: 'p99', operator: 'lte', value: 900 }]),
    ];
    render(<ScenarioSlaPanel tests={tests} onEditTest={vi.fn()} />);
    expect(screen.getByText(/2 tests with SLA targets/)).toBeInTheDocument();
  });

  it('expands and renders the table with row details', () => {
    const tests = [
      makeTest('t1', 'Checkout', 'POST', [
        { id: 's1', metric: 'p95', operator: 'lte', value: 800, warnAt: 600, label: 'Cart SLA' },
        { id: 's2', metric: 'tps', operator: 'gte', value: 50 },
      ]),
    ];
    render(<ScenarioSlaPanel tests={tests} onEditTest={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /SLA Summary/ }));
    expect(screen.getByText('Checkout')).toBeInTheDocument();
    expect(screen.getByText('P95 Response Time')).toBeInTheDocument();
    expect(screen.getByText('800ms')).toBeInTheDocument();
    expect(screen.getByText('600ms')).toBeInTheDocument();
    expect(screen.getByText('Cart SLA')).toBeInTheDocument();
    // second target: gte operator, no warnAt → —, no label → —
    expect(screen.getByText('TPS')).toBeInTheDocument();
    expect(screen.getByText('≥')).toBeInTheDocument();
    expect(screen.getByText('≤')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('collapses again on second header click', () => {
    const tests = [makeTest('t1', 'A', 'GET', [{ id: 's1', metric: 'p95', operator: 'lte', value: 800 }])];
    render(<ScenarioSlaPanel tests={tests} onEditTest={vi.fn()} />);
    const header = screen.getByRole('button', { name: /SLA Summary/ });
    fireEvent.click(header);
    expect(screen.getByText('P95 Response Time')).toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.queryByText('P95 Response Time')).not.toBeInTheDocument();
  });

  it('calls onEditTest when a row is clicked', () => {
    const onEditTest = vi.fn();
    const test = makeTest('t1', 'A', 'GET', [{ id: 's1', metric: 'p95', operator: 'lte', value: 800 }]);
    render(<ScenarioSlaPanel tests={[test]} onEditTest={onEditTest} />);
    fireEvent.click(screen.getByRole('button', { name: /SLA Summary/ }));
    fireEvent.click(screen.getByText('P95 Response Time').closest('tr')!);
    expect(onEditTest).toHaveBeenCalledWith(test);
  });
});
