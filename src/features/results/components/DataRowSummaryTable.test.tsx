/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataRowSummaryTable } from './DataRowSummaryTable';
import type { RequestResult } from '../../../shared/types';

function makeResult(id: string, passed: boolean, dataRowId?: string): RequestResult {
  return {
    id,
    scenarioId: 'sc1',
    scenarioName: 'Test',
    url: '/api',
    method: 'GET',
    requestHeaders: [],
    httpStatus: passed ? 200 : 500,
    responseTimeMs: 100,
    passed,
    failureDetails: [],
    responseHeaders: [],
    requestTimestamp: Date.now(),
    dataRowId,
    dataRowLabel: dataRowId ? `Row ${dataRowId}` : undefined,
    validationMode: 'none',
  } as RequestResult;
}

describe('DataRowSummaryTable', () => {
  it('renders nothing when no data row results', () => {
    const { container } = render(
      <DataRowSummaryTable results={[makeResult('r1', true)]} scenarioName="Test" onResultClick={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows row count in header', () => {
    const results = [
      makeResult('r1', true, 'row-1'),
      makeResult('r2', true, 'row-2'),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Login" onResultClick={vi.fn()} />);
    expect(screen.getByText(/Login — 2 rows/)).toBeInTheDocument();
  });

  it('shows executed vs expected when counts differ', () => {
    const results = [makeResult('r1', true, 'row-1')];
    render(
      <DataRowSummaryTable results={results} scenarioName="Login" onResultClick={vi.fn()} expectedRowCount={5} />
    );
    expect(screen.getByText(/Login — 1 \/ 5 rows/)).toBeInTheDocument();
  });

  it('does not show fraction when counts match', () => {
    const results = [
      makeResult('r1', true, 'row-1'),
      makeResult('r2', true, 'row-2'),
    ];
    render(
      <DataRowSummaryTable results={results} scenarioName="Login" onResultClick={vi.fn()} expectedRowCount={2} />
    );
    const title = screen.getByText(/Login — .* rows/);
    expect(title.textContent).toContain('Login — 2 rows');
    expect(title.textContent).not.toContain('/');
  });

  it('shows pass rate stats', () => {
    const results = [
      makeResult('r1', true, 'row-1'),
      makeResult('r2', false, 'row-2'),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText(/Pass 1\/2 \(50%\)/)).toBeInTheDocument();
  });

  it('renders table rows and calls onResultClick on click', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const onClick = vi.fn();
    const results = [
      makeResult('r1', true, 'row-1'),
      makeResult('r2', false, 'row-2'),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={onClick} />);
    const rows = screen.getAllByRole('row');
    const dataRows = rows.filter(r => r.classList.contains('data-row-summary-row'));
    expect(dataRows.length).toBeGreaterThan(0);
    await user.click(dataRows[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('switches between split, flat, and failures view modes', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const results = [
      makeResult('r1', true, 'row-1'),
      makeResult('r2', false, 'row-2'),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);

    const flatBtn = screen.getByText('Flat');
    await user.click(flatBtn);
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);

    const failuresBtn = screen.getByText('Failures Only');
    await user.click(failuresBtn);

    const splitBtn = screen.getByText('Split');
    await user.click(splitBtn);
  });

  it('shows failed batch in split mode when failures exist', () => {
    const results = [
      makeResult('r1', false, 'row-1'),
      makeResult('r2', true, 'row-2'),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('shows error snippet for failed rows with failure details', () => {
    const result = makeResult('r1', false, 'row-1');
    result.failureDetails = [{ field: 'status', expected: '200', actual: '500', passed: false }];
    render(<DataRowSummaryTable results={[result]} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText(/1 validation failure/)).toBeInTheDocument();
  });

  it('collapses and expands passed batch', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const results = [
      makeResult('r1', true, 'row-1'),
      makeResult('r2', false, 'row-2'),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    const passedHeader = screen.getByText(/1 passed/);
    await user.click(passedHeader);
    await user.click(passedHeader);
  });
});
