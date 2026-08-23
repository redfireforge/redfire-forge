/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExecutionPlanPreview from './ExecutionPlanPreview';
import type { AllocationSummary } from '@engine/core/allocationEngine';

function makeSummary(overrides: Partial<AllocationSummary> = {}): AllocationSummary {
  return {
    items: [],
    totalRequests: 0,
    kind: 'standard',
    ...overrides,
  };
}

describe('ExecutionPlanPreview', () => {
  it('renders nothing when allocation has no items', () => {
    const { container } = render(
      <ExecutionPlanPreview allocation={makeSummary()} concurrency={1} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows compact format for standard tests', () => {
    const allocation = makeSummary({
      items: [
        { testId: 't1', testName: 'A', iterations: 10, rowCount: 0, totalRequests: 10 },
        { testId: 't2', testName: 'B', iterations: 10, rowCount: 0, totalRequests: 10 },
      ],
      totalRequests: 20,
      kind: 'standard',
    });
    render(<ExecutionPlanPreview allocation={allocation} concurrency={5} />);

    expect(screen.getByText(/10 iterations × 2 tests/)).toBeTruthy();
    expect(screen.getByText(/= 20 requests/)).toBeTruthy();
    expect(screen.getByText(/Concurrency: 5/)).toBeTruthy();
  });

  it('shows per-test breakdown for parameterized tests', () => {
    const allocation = makeSummary({
      items: [
        { testId: 't1', testName: 'Login', iterations: 3, rowCount: 5, totalRequests: 15 },
        { testId: 't2', testName: 'Logout', iterations: 3, rowCount: 8, totalRequests: 24 },
      ],
      totalRequests: 39,
      kind: 'parameterized',
    });
    render(<ExecutionPlanPreview allocation={allocation} concurrency={1} />);

    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Logout')).toBeTruthy();
    expect(screen.getByText(/3 × 5 = 15/)).toBeTruthy();
    expect(screen.getByText(/3 × 8 = 24/)).toBeTruthy();
    expect(screen.getByText(/Total: 39 requests/)).toBeTruthy();
  });

  it('shows fallback for parameterized test with no rows', () => {
    const allocation = makeSummary({
      items: [
        { testId: 't1', testName: 'Bare', iterations: 5, rowCount: 0, totalRequests: 5 },
      ],
      totalRequests: 5,
      kind: 'parameterized',
    });
    render(<ExecutionPlanPreview allocation={allocation} concurrency={1} />);

    expect(screen.getByText(/5 × 1 = 5/)).toBeTruthy();
  });

  it('hides concurrency note when concurrency is 1', () => {
    const allocation = makeSummary({
      items: [
        { testId: 't1', testName: 'A', iterations: 1, rowCount: 0, totalRequests: 1 },
      ],
      totalRequests: 1,
      kind: 'standard',
    });
    render(<ExecutionPlanPreview allocation={allocation} concurrency={1} />);

    expect(screen.queryByText(/Concurrency/)).toBeNull();
  });

  it('shows singular form for 1 iteration and 1 test', () => {
    const allocation = makeSummary({
      items: [
        { testId: 't1', testName: 'A', iterations: 1, rowCount: 0, totalRequests: 1 },
      ],
      totalRequests: 1,
      kind: 'standard',
    });
    render(<ExecutionPlanPreview allocation={allocation} concurrency={1} />);

    expect(screen.getByText(/1 iteration × 1 test/)).toBeTruthy();
    expect(screen.getByText(/Total: 1 request$/)).toBeTruthy();
  });

  it('shows row count badges for parameterized tests', () => {
    const allocation = makeSummary({
      items: [
        { testId: 't1', testName: 'WithRows', iterations: 2, rowCount: 10, totalRequests: 20 },
      ],
      totalRequests: 20,
      kind: 'parameterized',
    });
    render(<ExecutionPlanPreview allocation={allocation} concurrency={1} />);

    expect(screen.getByText('10 rows')).toBeTruthy();
  });
});
