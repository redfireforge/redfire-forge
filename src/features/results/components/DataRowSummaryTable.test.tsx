/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataRowSummaryTable } from './DataRowSummaryTable';
import type { RequestResult } from '../../../shared/types';
import { makeResult as _makeResult } from '../../../test-utils/factories';

function makeResult(
  id: string,
  passed: boolean,
  dataRowId?: string,
  overrides: Partial<Omit<RequestResult, 'id'>> = {},
): RequestResult {
  return _makeResult({
    id,
    scenarioId: 'sc1',
    scenarioName: 'Test',
    url: '/api',
    httpStatus: passed ? 200 : 500,
    passed,
    requestHeaders: [],
    responseHeaders: [],
    requestTimestamp: Date.now(),
    dataRowId,
    dataRowLabel: dataRowId ? `Row ${dataRowId}` : undefined,
    ...overrides,
  }) as RequestResult;
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

  it('shows All rows passed in failures-only mode when there are no failures', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const results = [makeResult('r1', true, 'row-1')];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Failures Only' }));
    expect(screen.getByText('All rows passed')).toBeInTheDocument();
  });

  it('uses errorMessage for the failure cell when present', () => {
    const results = [
      makeResult('r1', false, 'row-1', {
        errorMessage: 'Connection reset',
        failureDetails: [{ field: 'x', expected: '1', actual: '2', passed: false }],
      }),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText('Connection reset')).toBeInTheDocument();
    expect(screen.queryByText(/validation failure/)).not.toBeInTheDocument();
  });

  it('pluralizes validation failure text when multiple details exist', () => {
    const results = [
      makeResult('r1', false, 'row-1', {
        failureDetails: [
          { field: 'a', expected: '1', actual: '2', passed: false },
          { field: 'b', expected: '3', actual: '4', passed: false },
        ],
      }),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText(/2 validation failures/)).toBeInTheDocument();
  });

  it('falls back to dataRowId in the row label when dataRowLabel is absent', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const results = [makeResult('r1', true, 'only-id', { dataRowLabel: undefined })];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    await user.click(screen.getByText(/1 passed/));
    expect(screen.getByText('only-id')).toBeInTheDocument();
  });

  it('shows ERR in the status column when httpStatus is falsy', () => {
    const results = [makeResult('r1', false, 'row-1', { httpStatus: 0 })];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText('ERR')).toBeInTheDocument();
  });

  it('shows validated tag when validationMode is not none', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const results = [makeResult('r1', true, 'row-1', { validationMode: 'full' })];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    await user.click(screen.getByText(/1 passed/));
    const tag = document.querySelector('.data-row-table .tag-info');
    expect(tag?.textContent).toContain('Yes');
  });

  it('omits failed batch in split mode when every row passed', () => {
    const results = [
      makeResult('r1', true, 'row-1'),
      makeResult('r2', true, 'row-2'),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 passed/)).toBeInTheDocument();
  });

  it('omits passed batch in split mode when every row failed', () => {
    const results = [
      makeResult('r1', false, 'row-1'),
      makeResult('r2', false, 'row-2'),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.queryByText(/passed/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 failed/)).toBeInTheDocument();
  });

  it('shows PRODUCE in status column for Kafka produce results', () => {
    const results = [
      makeResult('r1', false, 'row-1', { transportType: 'kafkaProduce', httpStatus: undefined as unknown as number }),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText('PRODUCE')).toBeInTheDocument();
  });

  it('shows CONSUME in status column for Kafka consume results', () => {
    const results = [
      makeResult('r1', false, 'row-1', { transportType: 'kafkaConsume', httpStatus: undefined as unknown as number }),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText('CONSUME')).toBeInTheDocument();
  });

  it('shows CONNECT in status column for WS connect results', () => {
    const results = [
      makeResult('r1', false, 'row-1', { transportType: 'wsConnect', httpStatus: undefined as unknown as number }),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText('CONNECT')).toBeInTheDocument();
  });

  it('shows SEND in status column for WS send results', () => {
    const results = [
      makeResult('r1', false, 'row-1', { transportType: 'wsSend', httpStatus: undefined as unknown as number }),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText('SEND')).toBeInTheDocument();
  });

  it('shows RECEIVE in status column for WS receive results', () => {
    const results = [
      makeResult('r1', false, 'row-1', { transportType: 'wsReceive', httpStatus: undefined as unknown as number }),
    ];
    render(<DataRowSummaryTable results={results} scenarioName="Test" onResultClick={vi.fn()} />);
    expect(screen.getByText('RECEIVE')).toBeInTheDocument();
  });
});
