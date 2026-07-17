/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataTableVerifyModal from './DataTableVerifyModal';
import type { Scenario, DataSource } from '../../../shared/types';

vi.mock('../../../shared/components/AppModalFrame', () => ({
  default: ({ title, children, footer, headerActions }: {
    title: string; children: React.ReactNode; footer?: React.ReactNode; headerActions?: React.ReactNode;
  }) => (
    <div data-testid="modal-frame">
      <div data-testid="modal-title">{title}</div>
      {headerActions && <div data-testid="modal-header-actions">{headerActions}</div>}
      <div data-testid="modal-body">{children}</div>
      {footer && <div data-testid="modal-footer">{footer}</div>}
    </div>
  ),
}));

vi.mock('./VerifyRowCard', () => ({
  default: ({ idx, collapsed }: { idx: number; collapsed: boolean }) => (
    <div data-testid={`verify-row-card-${idx}`} data-collapsed={String(collapsed)} />
  ),
}));

const mockRunVerification = vi.fn();
const mockRefetchFailedRows = vi.fn();

interface EngineState {
  results: Map<string, unknown>;
  verifying: boolean;
  progress: { current: number; total: number };
  enabledRows: Array<{ id: string }>;
  requestCols: Array<{ id: string }>;
  validateCols: Array<{ id: string }>;
  summary: {
    passCount: number; failCount: number; errorCount: number;
    allDone: boolean; allPassed: boolean; summaryClass: string;
  };
  runVerification: () => void;
  refetchFailedRows: () => void;
}

let mockEngineState: EngineState;

vi.mock('../hooks/useVerifyEngine', () => ({
  useVerifyEngine: () => mockEngineState,
}));

function baseState(over: Partial<EngineState> = {}): EngineState {
  return {
    results: new Map(),
    verifying: false,
    progress: { current: 0, total: 2 },
    enabledRows: [{ id: 'r1' }, { id: 'r2' }],
    requestCols: [{ id: 'c1' }],
    validateCols: [{ id: 'c2' }],
    summary: { passCount: 0, failCount: 0, errorCount: 0, allDone: false, allPassed: false, summaryClass: '' },
    runVerification: mockRunVerification,
    refetchFailedRows: mockRefetchFailedRows,
    ...over,
  };
}

const draft = { id: 't1', name: 'T' } as unknown as Scenario;
const dataTable = { columns: [], rows: [] } as unknown as DataSource;

function renderModal(onClose = vi.fn()) {
  return render(
    <DataTableVerifyModal draft={draft} dataTable={dataTable} onDraftChange={vi.fn()} onClose={onClose} />,
  );
}

describe('DataTableVerifyModal', () => {
  beforeEach(() => {
    resetAllMocks();
    mockEngineState = baseState();
  });

  it('renders the title and subtitle', () => {
    renderModal();
    expect(screen.getByText('Data Table — Verify & Inspect')).toBeInTheDocument();
    expect(screen.getByText(/2 enabled rows • 2 columns \(1 request, 1 validate\)/)).toBeInTheDocument();
  });

  it('renders a row card per enabled row', () => {
    renderModal();
    expect(screen.getByTestId('verify-row-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('verify-row-card-1')).toBeInTheDocument();
  });

  it('shows the verify-all hint when no results and idle', () => {
    renderModal();
    expect(screen.getByText(/Click "▶ Verify All" to validate rows against the API/)).toBeInTheDocument();
    expect(screen.getByText('▶ Verify All')).toBeInTheDocument();
  });

  it('runs verification when Verify All clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('▶ Verify All'));
    expect(mockRunVerification).toHaveBeenCalled();
  });

  it('shows verifying state with no results', () => {
    mockEngineState = baseState({ verifying: true, progress: { current: 1, total: 2 } });
    renderModal();
    expect(screen.getByText('Verifying rows...')).toBeInTheDocument();
    expect(screen.getByText('⏳ Verifying 1/2...')).toBeInTheDocument();
  });

  it('shows progress bar and stats while verifying with results', () => {
    mockEngineState = baseState({
      verifying: true,
      results: new Map([['r1', {}]]),
      progress: { current: 1, total: 2 },
      summary: { passCount: 1, failCount: 0, errorCount: 0, allDone: false, allPassed: false, summaryClass: 'ok' },
    });
    renderModal();
    expect(screen.getByText('✓ 1 passed')).toBeInTheDocument();
    expect(screen.getByText('1 rows')).toBeInTheDocument();
  });

  it('shows Re-verify and all-passed info when done', () => {
    mockEngineState = baseState({
      results: new Map([['r1', {}], ['r2', {}]]),
      summary: { passCount: 2, failCount: 0, errorCount: 0, allDone: true, allPassed: true, summaryClass: 'ok' },
    });
    renderModal();
    expect(screen.getByText('▶ Re-verify')).toBeInTheDocument();
    expect(screen.getByText('All 2 rows passed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('▶ Re-verify'));
    expect(mockRunVerification).toHaveBeenCalled();
  });

  it('shows re-fetch failed and breakdown info when there are failures', () => {
    mockEngineState = baseState({
      results: new Map([['r1', {}], ['r2', {}]]),
      summary: { passCount: 0, failCount: 1, errorCount: 1, allDone: true, allPassed: false, summaryClass: 'fail' },
    });
    renderModal();
    expect(screen.getByText('↻ Re-fetch Failed (2)')).toBeInTheDocument();
    expect(screen.getByText('0 passed, 1 failed, 1 errors')).toBeInTheDocument();
    fireEvent.click(screen.getByText('↻ Re-fetch Failed (2)'));
    expect(mockRefetchFailedRows).toHaveBeenCalled();
  });

  it('toggles the validation collapse button', () => {
    renderModal();
    expect(screen.getByText('▾ Hide Validation')).toBeInTheDocument();
    fireEvent.click(screen.getByText('▾ Hide Validation'));
    expect(screen.getByText('▸ Show Validation')).toBeInTheDocument();
    expect(screen.getByTestId('verify-row-card-0').getAttribute('data-collapsed')).toBe('true');
  });

  it('closes when Close clicked', () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
