/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceVerifyModal from './DataSourceVerifyModal';
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
  default: ({ row, idx, vr, onUpdateExpectedCell, onAcceptAllForRow }: {
    row: { id: string; label?: string };
    idx: number;
    vr?: { status: string; rowId: string };
    onUpdateExpectedCell: (rowId: string, colId: string, val: string) => void;
    onAcceptAllForRow: (rowId: string) => void;
  }) => (
    <div data-testid={`verify-row-card-${idx}`}>
      <span data-testid={`row-label-${idx}`}>{row.label || `Row ${idx + 1}`}</span>
      {vr && <span data-testid={`row-status-${idx}`}>{vr.status}</span>}
      <button data-testid={`accept-row-${idx}`} onClick={() => onAcceptAllForRow(row.id)}>Accept</button>
      <button data-testid={`update-cell-${idx}`} onClick={() => onUpdateExpectedCell(row.id, 'c2', 'new-val')}>Update</button>
    </div>
  ),
}));

const mockRunVerification = vi.fn();
const mockRefetchFailedRows = vi.fn();
const mockSetResults = vi.fn((updater) => {
  if (typeof updater === 'function') {
    updater(mockEngineState.results);
  }
});

let mockEngineState = {
  results: new Map(),
  verifying: false,
  progress: { current: 0, total: 0 },
  enabledRows: [
    { id: 'r1', values: { c1: '1', c2: 'active' }, enabled: true, label: 'Row 1' },
    { id: 'r2', values: { c1: '2', c2: 'inactive' }, enabled: true, label: 'Row 2' },
  ],
  requestCols: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
  validateCols: [{ id: 'c2', name: 'status', type: 'validate', mapping: '$.status' }],
  summary: {
    passCount: 0, warnCount: 0, failCount: 0, errorCount: 0,
    allDone: false, allPassed: false, summaryClass: '',
  },
  draftRef: { current: { dataSource: null as DataSource | null | undefined } },
  setResults: mockSetResults,
  runVerification: mockRunVerification,
  refetchFailedRows: mockRefetchFailedRows,
};

const mockExecuteRowFetch = vi.fn();

vi.mock('../hooks/useVerifyEngine', () => ({
  useVerifyEngine: () => mockEngineState,
  executeRowFetch: (...args: unknown[]) => mockExecuteRowFetch(...args),
}));

const mockProxyFetch = vi.fn();
vi.mock('../../../engine/executor', () => ({
  proxyFetch: (...args: unknown[]) => mockProxyFetch(...args),
}));

const mockExtractJsonPath = vi.fn(() => '');
const mockExpandPatternFromResponse = vi.fn(() => []);
vi.mock('../utils/dataSourceImport', () => ({
  extractJsonPath: (...args: unknown[]) => mockExtractJsonPath(...args),
  expandPatternFromResponse: (...args: unknown[]) => mockExpandPatternFromResponse(...args),
}));

const createMockScenario = (): Scenario => ({
  id: 'test-1',
  name: 'Test',
  url: 'https://api.example.com/users/{{userId}}',
  method: 'GET',
  headers: [],
  auth: { type: 'none' },
  validation: { mode: 'none' },
  dataSource: {
    columns: [
      { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
      { id: 'c2', name: 'status', type: 'validate', mapping: '$.status' },
    ],
    rows: [
      { id: 'r1', values: { c1: '1', c2: 'active' }, enabled: true, label: 'Row 1' },
      { id: 'r2', values: { c1: '2', c2: 'inactive' }, enabled: true, label: 'Row 2' },
    ],
    source: { type: 'inline' },
  },
});

const createMockDataTable = (): DataSource => ({
  columns: [
    { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
    { id: 'c2', name: 'status', type: 'validate', mapping: '$.status' },
  ],
  rows: [
    { id: 'r1', values: { c1: '1', c2: 'active' }, enabled: true, label: 'Row 1' },
    { id: 'r2', values: { c1: '2', c2: 'inactive' }, enabled: true, label: 'Row 2' },
  ],
  source: { type: 'inline' },
});

describe('DataSourceVerifyModal', () => {
  const defaultProps = {
    draft: createMockScenario(),
    dataTable: createMockDataTable(),
    onDraftChange: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngineState = {
      results: new Map(),
      verifying: false,
      progress: { current: 0, total: 0 },
      enabledRows: [
        { id: 'r1', values: { c1: '1', c2: 'active' }, enabled: true, label: 'Row 1' },
        { id: 'r2', values: { c1: '2', c2: 'inactive' }, enabled: true, label: 'Row 2' },
      ],
      requestCols: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
      validateCols: [{ id: 'c2', name: 'status', type: 'validate', mapping: '$.status' }],
      summary: {
        passCount: 0, warnCount: 0, failCount: 0, errorCount: 0,
        allDone: false, allPassed: false, summaryClass: '',
      },
      draftRef: { current: { dataSource: createMockDataTable() } },
      setResults: mockSetResults,
      runVerification: mockRunVerification,
      refetchFailedRows: mockRefetchFailedRows,
    };
  });

  describe('Initial render', () => {
    it('renders modal frame with title', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Data Source — Verify & Inspect');
    });

    it('renders row info in header', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/2 enabled rows/)).toBeInTheDocument();
      expect(screen.getByText(/1 request, 1 validate/)).toBeInTheDocument();
    });

    it('renders verify row cards', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByTestId('verify-row-card-0')).toBeInTheDocument();
      expect(screen.getByTestId('verify-row-card-1')).toBeInTheDocument();
    });

    it('shows hint to verify', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/Click "▶ Verify All"/)).toBeInTheDocument();
    });

    it('shows Verify All button', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('▶ Verify All')).toBeInTheDocument();
    });

    it('shows Run & Capture button', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/Run .* Capture/)).toBeInTheDocument();
    });

    it('shows Close button', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('calls onClose when Close clicked', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Close'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('shows collapse button', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('▾ Hide Validation')).toBeInTheDocument();
    });

    it('toggles collapse state', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      fireEvent.click(screen.getByText('▾ Hide Validation'));
      expect(screen.getByText('▸ Show Validation')).toBeInTheDocument();
    });
  });

  describe('Verify All button', () => {
    it('calls runVerification when clicked', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      fireEvent.click(screen.getByText('▶ Verify All'));
      expect(mockRunVerification).toHaveBeenCalled();
    });
  });

  describe('Verifying state', () => {
    it('shows progress during verification', () => {
      mockEngineState.verifying = true;
      mockEngineState.progress = { current: 1, total: 2 };
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/Verifying 1\/2/)).toBeInTheDocument();
    });

    it('shows progress bar during verification with results', () => {
      mockEngineState.verifying = true;
      mockEngineState.progress = { current: 1, total: 2 };
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'pass', failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = { ...mockEngineState.summary, passCount: 1 };
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('✓ 1 passed')).toBeInTheDocument();
    });

    it('hides Verify/Capture buttons during verification', () => {
      mockEngineState.verifying = true;
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.queryByText('▶ Verify All')).not.toBeInTheDocument();
    });
  });

  describe('After verification - all passed', () => {
    beforeEach(() => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
        ['r2', { rowId: 'r2', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = {
        passCount: 2, warnCount: 0, failCount: 0, errorCount: 0,
        allDone: true, allPassed: true, summaryClass: 'verify-all-pass',
      };
    });

    it('shows all passed message', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('All 2 rows passed')).toBeInTheDocument();
    });

    it('shows Re-verify button', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('▶ Re-verify')).toBeInTheDocument();
    });

    it('shows pass count in summary', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('✓ 2 passed')).toBeInTheDocument();
    });
  });

  describe('After verification - with failures', () => {
    beforeEach(() => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
        ['r2', { rowId: 'r2', status: 'fail', httpStatus: 200, failedCells: { c2: 'error' }, actualCells: { c2: 'error' } }],
      ]);
      mockEngineState.summary = {
        passCount: 1, warnCount: 0, failCount: 1, errorCount: 0,
        allDone: true, allPassed: false, summaryClass: 'verify-has-fails',
      };
    });

    it('shows pass and fail counts', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('✓ 1 passed')).toBeInTheDocument();
      expect(screen.getByText('✗ 1 failed')).toBeInTheDocument();
    });

    it('shows Re-fetch Failed button', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/Re-fetch Failed/)).toBeInTheDocument();
    });

    it('shows Accept All Changes button', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/Accept All Changes/)).toBeInTheDocument();
    });

    it('calls refetchFailedRows when button clicked', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      fireEvent.click(screen.getByText(/Re-fetch Failed/));
      expect(mockRefetchFailedRows).toHaveBeenCalled();
    });

    it('calls acceptAllChanges when button clicked', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      fireEvent.click(screen.getByText(/Accept All Changes/));
      // This invokes the local acceptAllChanges which calls onDraftChange
      expect(defaultProps.onDraftChange).toHaveBeenCalled();
    });
  });

  describe('After verification - with errors', () => {
    beforeEach(() => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'error', httpStatus: 500, error: 'Server Error', failedCells: {}, actualCells: {} }],
        ['r2', { rowId: 'r2', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = {
        passCount: 1, warnCount: 0, failCount: 0, errorCount: 1,
        allDone: true, allPassed: false, summaryClass: 'verify-has-errors',
      };
    });

    it('shows error count in summary', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('⚠ 1 errors')).toBeInTheDocument();
    });

    it('shows Re-fetch Failed button for errors', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/Re-fetch Failed/)).toBeInTheDocument();
    });
  });

  describe('Failure patterns', () => {
    it('shows failure patterns when multiple rows fail same way', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'fail', httpStatus: 200, failedCells: { c2: 'wrong' }, actualCells: { c2: 'wrong' } }],
        ['r2', { rowId: 'r2', status: 'fail', httpStatus: 200, failedCells: { c2: 'wrong' }, actualCells: { c2: 'wrong' } }],
      ]);
      mockEngineState.summary = {
        passCount: 0, warnCount: 0, failCount: 2, errorCount: 0,
        allDone: true, allPassed: false, summaryClass: 'verify-has-fails',
      };
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/failure pattern/)).toBeInTheDocument();
    });

    it('toggles pattern details on click', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'fail', httpStatus: 200, failedCells: { c2: 'wrong' }, actualCells: { c2: 'wrong' } }],
        ['r2', { rowId: 'r2', status: 'fail', httpStatus: 200, failedCells: { c2: 'wrong' }, actualCells: { c2: 'wrong' } }],
      ]);
      mockEngineState.summary = {
        passCount: 0, warnCount: 0, failCount: 2, errorCount: 0,
        allDone: true, allPassed: false, summaryClass: 'verify-has-fails',
      };
      render(<DataSourceVerifyModal {...defaultProps} />);
      fireEvent.click(screen.getByText(/failure pattern/));
      const patternList = document.querySelector('.verify-pattern-list');
      expect(patternList).toBeInTheDocument();
    });
  });

  describe('Row actions', () => {
    beforeEach(() => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'fail', httpStatus: 200, failedCells: { c2: 'wrong' }, actualCells: { c2: 'wrong' } }],
        ['r2', { rowId: 'r2', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = {
        passCount: 1, warnCount: 0, failCount: 1, errorCount: 0,
        allDone: true, allPassed: false, summaryClass: 'verify-has-fails',
      };
    });

    it('calls onDraftChange when accepting all for a row', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('accept-row-0'));
      expect(defaultProps.onDraftChange).toHaveBeenCalled();
    });

    it('calls onDraftChange when updating expected cell', () => {
      render(<DataSourceVerifyModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('update-cell-0'));
      expect(defaultProps.onDraftChange).toHaveBeenCalled();
    });
  });

  describe('Warn state', () => {
    it('shows warn count', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'warn', httpStatus: 200, failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = {
        passCount: 0, warnCount: 1, failCount: 0, errorCount: 0,
        allDone: true, allPassed: false, summaryClass: '',
      };
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText('🟡 1 warn')).toBeInTheDocument();
    });
  });

  describe('updateExpectedCell', () => {
    it('updates draft when cell value changed', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'fail', httpStatus: 200, failedCells: { c2: 'wrong' }, actualCells: { c2: 'wrong' } }],
      ]);
      mockEngineState.summary = {
        passCount: 0, warnCount: 0, failCount: 1, errorCount: 0,
        allDone: true, allPassed: false, summaryClass: '',
      };
      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);
      fireEvent.click(screen.getByTestId('update-cell-0'));
      expect(onDraftChange).toHaveBeenCalled();
      expect(mockSetResults).toHaveBeenCalled();
    });
  });

  describe('acceptAllChangesForRow', () => {
    it('accepts all failed cells for a specific row', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'fail', httpStatus: 200, failedCells: { c2: 'actual' }, actualCells: { c2: 'actual' } }],
      ]);
      mockEngineState.summary = {
        passCount: 0, warnCount: 0, failCount: 1, errorCount: 0,
        allDone: true, allPassed: false, summaryClass: '',
      };
      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);
      fireEvent.click(screen.getByTestId('accept-row-0'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dataSource: expect.objectContaining({
            rows: expect.arrayContaining([
              expect.objectContaining({ id: 'r1', values: expect.objectContaining({ c2: 'actual' }) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('acceptAllChanges (global)', () => {
    it('accepts all failed cells across all rows', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'fail', httpStatus: 200, failedCells: { c2: 'new1' }, actualCells: { c2: 'new1' } }],
        ['r2', { rowId: 'r2', status: 'fail', httpStatus: 200, failedCells: { c2: 'new2' }, actualCells: { c2: 'new2' } }],
      ]);
      mockEngineState.summary = {
        passCount: 0, warnCount: 0, failCount: 2, errorCount: 0,
        allDone: true, allPassed: false, summaryClass: 'verify-has-fails',
      };
      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);
      fireEvent.click(screen.getByText(/Accept All Changes/));
      expect(onDraftChange).toHaveBeenCalled();
      expect(mockSetResults).toHaveBeenCalled();
    });

    it('does nothing if no failed results', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = {
        passCount: 1, warnCount: 0, failCount: 0, errorCount: 0,
        allDone: true, allPassed: true, summaryClass: '',
      };
      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);
      // No "Accept All Changes" button should be visible
      expect(screen.queryByText(/Accept All Changes/)).not.toBeInTheDocument();
    });
  });

  describe('Re-capture button (allDone state)', () => {
    it('shows Re-capture button when all done', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
        ['r2', { rowId: 'r2', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = {
        passCount: 2, warnCount: 0, failCount: 0, errorCount: 0,
        allDone: true, allPassed: true, summaryClass: 'verify-all-pass',
      };
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/Re-capture/)).toBeInTheDocument();
    });

    it('triggers runCapture when Re-capture is clicked', async () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
        ['r2', { rowId: 'r2', status: 'pass', httpStatus: 200, failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = {
        passCount: 2, warnCount: 0, failCount: 0, errorCount: 0,
        allDone: true, allPassed: true, summaryClass: 'verify-all-pass',
      };
      mockExecuteRowFetch.mockImplementation(() => ({
        resolved: { url: 'https://api.example.com/users/1' },
        fetchPromise: Promise.resolve({
          status: 200, statusText: 'OK',
          body: JSON.stringify({ status: 'active' }), headers: {},
        }),
      }));
      mockExtractJsonPath.mockReturnValue('active');

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);
      await act(async () => {
        fireEvent.click(screen.getByText(/Re-capture/));
      });
      await waitFor(() => {
        expect(onDraftChange).toHaveBeenCalled();
      });
    });
  });

  describe('Error patterns grouped', () => {
    it('groups error rows with same HTTP status', () => {
      mockEngineState.results = new Map([
        ['r1', { rowId: 'r1', status: 'error', httpStatus: 404, error: 'Not Found', failedCells: {}, actualCells: {} }],
        ['r2', { rowId: 'r2', status: 'error', httpStatus: 404, error: 'Not Found', failedCells: {}, actualCells: {} }],
      ]);
      mockEngineState.summary = {
        passCount: 0, warnCount: 0, failCount: 0, errorCount: 2,
        allDone: true, allPassed: false, summaryClass: 'verify-has-errors',
      };
      render(<DataSourceVerifyModal {...defaultProps} />);
      expect(screen.getByText(/failure pattern/)).toBeInTheDocument();
    });
  });

  describe('runCapture', () => {
    it('calls executeRowFetch for each enabled row and updates draft', async () => {
      mockExecuteRowFetch.mockImplementation(() => ({
        resolved: { url: 'https://api.example.com/users/1' },
        fetchPromise: Promise.resolve({
          status: 200,
          statusText: 'OK',
          body: JSON.stringify({ status: 'active' }),
          headers: {},
        }),
      }));
      mockExtractJsonPath.mockReturnValue('active');

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      await waitFor(() => {
        expect(mockExecuteRowFetch).toHaveBeenCalledTimes(2);
      });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('handles HTTP error responses during capture', async () => {
      mockExecuteRowFetch.mockImplementation(() => ({
        resolved: { url: 'https://api.example.com/users/1' },
        fetchPromise: Promise.resolve({
          status: 500,
          statusText: 'Internal Server Error',
          body: 'Error',
          headers: {},
        }),
      }));

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      await waitFor(() => {
        expect(onDraftChange).toHaveBeenCalled();
      });
    });

    it('handles exceptions during capture', async () => {
      mockExecuteRowFetch.mockImplementation(() => ({
        resolved: { url: 'https://api.example.com/users/1' },
        fetchPromise: Promise.reject(new Error('Network failure')),
      }));

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      await waitFor(() => {
        expect(mockSetResults).toHaveBeenCalled();
      });
    });

    it('handles non-JSON response bodies', async () => {
      mockExecuteRowFetch.mockImplementation(() => ({
        resolved: { url: 'https://api.example.com/users/1' },
        fetchPromise: Promise.resolve({
          status: 200,
          statusText: 'OK',
          body: 'not-json-content',
          headers: {},
        }),
      }));

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      await waitFor(() => {
        expect(onDraftChange).toHaveBeenCalled();
      });
    });

    it('uses onFetchRow when provided', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK',
        body: JSON.stringify({ status: 'ok' }), headers: {},
      });
      mockExecuteRowFetch.mockImplementation((_draft: unknown, _cols: unknown, _row: unknown, _idx: unknown, doFetch: Function) => ({
        resolved: { url: 'https://api.example.com/users/1' },
        fetchPromise: doFetch('https://api.example.com/users/1', { method: 'GET', headers: {} }),
      }));
      mockExtractJsonPath.mockReturnValue('ok');

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} onFetchRow={customFetch} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      await waitFor(() => {
        expect(customFetch).toHaveBeenCalled();
      });
    });

    it('skips capture if dataSource is null', async () => {
      mockEngineState.draftRef = { current: { dataSource: null } };
      render(<DataSourceVerifyModal {...defaultProps} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      expect(mockExecuteRowFetch).not.toHaveBeenCalled();
    });

    it('skips capture if no enabled rows', async () => {
      mockEngineState.draftRef = {
        current: {
          dataSource: {
            ...createMockDataTable(),
            rows: [
              { id: 'r1', values: { c1: '1' }, enabled: false, label: 'Row 1' },
            ],
          },
        },
      };
      render(<DataSourceVerifyModal {...defaultProps} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      expect(mockExecuteRowFetch).not.toHaveBeenCalled();
    });

    it('handles dynamic validation contract expansion', async () => {
      mockEngineState.draftRef = {
        current: {
          dataSource: {
            ...createMockDataTable(),
            validationContract: ['items[*].name'],
          },
        },
      };
      mockExpandPatternFromResponse.mockReturnValue(['items[0].name', 'items[1].name']);
      mockExtractJsonPath.mockImplementation((_obj: unknown, path: string) => {
        if (path === 'items[0].name') return 'Product A';
        if (path === 'items[1].name') return 'Product B';
        return '';
      });
      mockExecuteRowFetch.mockImplementation(() => ({
        resolved: { url: 'https://api.example.com/items' },
        fetchPromise: Promise.resolve({
          status: 200, statusText: 'OK',
          body: JSON.stringify({ items: [{ name: 'Product A' }, { name: 'Product B' }] }),
          headers: {},
        }),
      }));

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      await waitFor(() => {
        expect(onDraftChange).toHaveBeenCalled();
      });
      expect(mockExpandPatternFromResponse).toHaveBeenCalled();
    });

    it('clears validate cell when it matches a dynamic pattern but extraction is empty', async () => {
      mockEngineState.draftRef = {
        current: {
          dataSource: {
            columns: [
              { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
              { id: 'c2', name: 'items_0_name', type: 'validate', mapping: 'items[0].name' },
            ],
            rows: [
              { id: 'r1', values: { c1: '1', c2: 'old' }, enabled: true, label: 'Row 1' },
            ],
            source: { type: 'inline' },
            validationContract: ['items[*].name'],
          },
        },
      };
      mockEngineState.enabledRows = [
        { id: 'r1', values: { c1: '1', c2: 'old' }, enabled: true, label: 'Row 1' },
      ];
      mockExpandPatternFromResponse.mockReturnValue([]);
      mockExtractJsonPath.mockReturnValue('');
      mockExecuteRowFetch.mockImplementation(() => ({
        resolved: { url: 'https://api.example.com/items' },
        fetchPromise: Promise.resolve({
          status: 200, statusText: 'OK',
          body: JSON.stringify({ items: [] }),
          headers: {},
        }),
      }));

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      await waitFor(() => {
        expect(onDraftChange).toHaveBeenCalled();
      });
    });

    it('handles error field in HTTP response', async () => {
      mockExecuteRowFetch.mockImplementation(() => ({
        resolved: { url: 'https://api.example.com/users/1' },
        fetchPromise: Promise.resolve({
          status: 200,
          statusText: 'OK',
          body: '{}',
          headers: {},
          error: 'Connection reset',
        }),
      }));

      const onDraftChange = vi.fn();
      render(<DataSourceVerifyModal {...defaultProps} onDraftChange={onDraftChange} />);

      const captureBtn = screen.getByText(/Capture/);
      await act(async () => {
        fireEvent.click(captureBtn);
      });
      await waitFor(() => {
        expect(onDraftChange).toHaveBeenCalled();
      });
    });
  });
});
