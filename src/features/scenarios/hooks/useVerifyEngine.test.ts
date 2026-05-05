/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVerifyEngine, executeRowFetch } from './useVerifyEngine';
import type { UseVerifyEngineOptions } from './useVerifyEngine';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';

// ─── Mocks ────────────────────────────────────────────────────

vi.mock('../../../engine/dataSourceExpander', () => ({
  resolveScenarioFromDataRow: vi.fn((draft: Scenario, _cols: DataSourceColumn[], row: DataSourceRow) => ({
    ...draft,
    url: draft.url.replace('{{id}}', row.values.c1 ?? ''),
  })),
}));

vi.mock('../../../engine/executor', () => ({
  proxyFetch: vi.fn(),
  buildHeaders: vi.fn((s: Scenario) => ({ 'content-type': 'application/json', 'x-url': s.url })),
}));

vi.mock('../../../engine/validator', () => ({
  validate: vi.fn(() => []),
}));

vi.mock('../utils/dataSourceImport', () => ({
  extractJsonPath: vi.fn((_obj: unknown, path: string) => {
    if (path === '$.name') return 'Alice';
    if (path === '$.age') return '30';
    return '';
  }),
  expandPatternFromResponse: vi.fn(() => []),
}));

// ─── Helpers ──────────────────────────────────────────────────

function makeDraft(overrides: Partial<Scenario> = {}): Scenario {
  const ds: DataSource = {
    id: 'ds1',
    columns: [
      { id: 'c1', name: 'id', type: 'path', mapping: 'id' },
      { id: 'v1', name: 'name', type: 'validate', mapping: '$.name' },
    ],
    rows: [
      { id: 'r1', values: { c1: '1', v1: 'Alice' }, enabled: true },
      { id: 'r2', values: { c1: '2', v1: 'Bob' }, enabled: true },
      { id: 'r3', values: { c1: '3', v1: '' }, enabled: false },
    ],
    source: { type: 'inline' },
  };

  return {
    id: 'sc1',
    name: 'Test',
    url: 'https://api.example.com/users/{{id}}',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    dataSource: ds,
    ...overrides,
  } as Scenario;
}

function makeOkResponse(body: string = '{"name":"Alice","age":30}'): HttpResponse {
  return { status: 200, statusText: 'OK', headers: {}, body };
}

function makeErrorResponse(status = 500): HttpResponse {
  return { status, statusText: 'Internal Server Error', headers: {}, body: 'error' };
}

function makeNetworkError(): HttpResponse {
  return { status: 0, statusText: '', headers: {}, body: '', error: 'Network error' };
}

// ─── Tests ────────────────────────────────────────────────────

describe('useVerifyEngine', () => {
  let draft: Scenario;
  let onDraftChange: ReturnType<typeof vi.fn>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    draft = makeDraft();
    onDraftChange = vi.fn();
    mockFetch = vi.fn();
  });

  function renderEngine(opts: UseVerifyEngineOptions = {}) {
    return renderHook(() =>
      useVerifyEngine(draft, draft.dataSource!, onDraftChange, mockFetch, opts),
    );
  }

  // ─── Initial state ──────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty results and not verifying', () => {
      const { result } = renderEngine();
      expect(result.current.results.size).toBe(0);
      expect(result.current.verifying).toBe(false);
      expect(result.current.progress).toEqual({ current: 0, total: 0 });
    });

    it('computes enabledRows, requestCols, validateCols', () => {
      const { result } = renderEngine();
      expect(result.current.enabledRows).toHaveLength(2); // r1, r2 (r3 is disabled)
      expect(result.current.requestCols).toHaveLength(1); // c1 (path)
      expect(result.current.validateCols).toHaveLength(1); // v1 (validate)
    });

    it('summary starts as neutral', () => {
      const { result } = renderEngine();
      const s = result.current.summary;
      expect(s.passCount).toBe(0);
      expect(s.failCount).toBe(0);
      expect(s.errorCount).toBe(0);
      expect(s.allDone).toBe(false);
      expect(s.allPassed).toBe(false);
      expect(s.summaryClass).toBe('verify-summary-neutral');
    });
  });

  // ─── runVerification ───────────────────────────────────────

  describe('runVerification', () => {
    it('verifies all enabled rows and sets pass results', async () => {
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.size).toBe(2);
      expect(result.current.results.get('r1')?.status).toBe('pass');
      expect(result.current.results.get('r2')?.status).toBe('pass');
      expect(result.current.verifying).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('sets error result on network failure', async () => {
      mockFetch.mockResolvedValue(makeNetworkError());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.status).toBe('error');
      expect(result.current.results.get('r1')?.error).toBe('Network error');
    });

    it('sets error result on HTTP 500', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500));
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.status).toBe('error');
      expect(result.current.results.get('r1')?.httpStatus).toBe(500);
      expect(result.current.results.get('r1')?.error).toContain('HTTP 500');
    });

    it('uses proxyFetch fallback when no fetchFn provided', async () => {
      const { proxyFetch: pf } = await import('../../../engine/executor');
      (pf as ReturnType<typeof vi.fn>).mockResolvedValue(makeOkResponse());

      const { result } = renderHook(() =>
        useVerifyEngine(draft, draft.dataSource!, onDraftChange, undefined),
      );

      await act(async () => {
        await result.current.runVerification();
      });

      expect(pf).toHaveBeenCalledTimes(2);
    });

    it('handles exception during fetch', async () => {
      mockFetch.mockRejectedValue(new Error('Timeout'));
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.status).toBe('error');
      expect(result.current.results.get('r1')?.error).toBe('Timeout');
    });

    it('does nothing when no data source', async () => {
      draft = makeDraft({ dataSource: undefined });
      const emptyDs: DataSource = { id: 'empty', columns: [], rows: [], source: { type: 'inline' } };
      const { result } = renderHook(() =>
        useVerifyEngine(draft, emptyDs, onDraftChange, mockFetch),
      );

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.size).toBe(0);
    });

    it('does nothing when all rows disabled', async () => {
      draft = makeDraft();
      draft.dataSource!.rows = draft.dataSource!.rows.map(r => ({ ...r, enabled: false }));
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.size).toBe(0);
    });
  });

  // ─── trackActualCells option ───────────────────────────────

  describe('trackActualCells', () => {
    it('does not populate actualCells by default', async () => {
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine({ trackActualCells: false });

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.actualCells).toEqual({});
    });

    it('populates actualCells when trackActualCells is true', async () => {
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine({ trackActualCells: true });

      await act(async () => {
        await result.current.runVerification();
      });

      const vr = result.current.results.get('r1');
      expect(vr?.actualCells).toHaveProperty('v1', 'Alice');
    });

    it('sets warn status for rows without validate values when tracking', async () => {
      // r2 has v1='Bob' but our mock extractJsonPath returns 'Alice' for $.name
      // Let's make a row with empty validate values
      draft.dataSource!.rows[1] = { ...draft.dataSource!.rows[1], values: { c1: '2', v1: '' } };
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine({ trackActualCells: true });

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r2')?.status).toBe('warn');
    });
  });

  // ─── trackRequestDetails option ────────────────────────────

  describe('trackRequestDetails', () => {
    it('does not record request details by default', async () => {
      mockFetch.mockResolvedValue(makeNetworkError());
      const { result } = renderEngine({ trackRequestDetails: false });

      await act(async () => {
        await result.current.runVerification();
      });

      const vr = result.current.results.get('r1');
      expect(vr?.resolvedUrl).toBeUndefined();
      expect(vr?.responseBody).toBeUndefined();
      expect(vr?.requestHeaders).toBeUndefined();
    });

    it('records request details when trackRequestDetails is true', async () => {
      mockFetch.mockResolvedValue(makeNetworkError());
      const { result } = renderEngine({ trackRequestDetails: true });

      await act(async () => {
        await result.current.runVerification();
      });

      const vr = result.current.results.get('r1');
      expect(vr?.resolvedUrl).toBeDefined();
    });
  });

  // ─── summary computation ──────────────────────────────────

  describe('summary', () => {
    it('computes pass summary', async () => {
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      const s = result.current.summary;
      expect(s.passCount).toBe(2);
      expect(s.failCount).toBe(0);
      expect(s.errorCount).toBe(0);
      expect(s.allDone).toBe(true);
      expect(s.allPassed).toBe(true);
      expect(s.summaryClass).toBe('verify-summary-pass');
    });

    it('computes fail summary', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOkResponse())
        .mockResolvedValueOnce(makeErrorResponse());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      const s = result.current.summary;
      expect(s.passCount).toBe(1);
      expect(s.errorCount).toBe(1);
      expect(s.allPassed).toBe(false);
      expect(s.summaryClass).toBe('verify-summary-fail');
    });
  });

  // ─── refetchFailedRows ────────────────────────────────────

  describe('refetchFailedRows', () => {
    it('re-fetches only failed rows and triggers re-verification', async () => {
      // First run: r1 passes, r2 errors
      mockFetch
        .mockResolvedValueOnce(makeOkResponse())
        .mockResolvedValueOnce(makeErrorResponse());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.status).toBe('pass');
      expect(result.current.results.get('r2')?.status).toBe('error');

      // Re-fetch: now r2 succeeds
      mockFetch.mockResolvedValue(makeOkResponse());

      await act(async () => {
        await result.current.refetchFailedRows();
      });

      // Should have called onDraftChange with updated data
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('does nothing when no failed rows', async () => {
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      mockFetch.mockClear();
      await act(async () => {
        await result.current.refetchFailedRows();
      });

      // No additional fetch calls since all passed
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

// ─── executeRowFetch ─────────────────────────────────────────

describe('executeRowFetch', () => {
  it('returns resolved scenario, headers, and fetch promise', async () => {
    const draft = {
      id: 'sc1', name: 'Test',
      url: 'https://api.example.com/users/{{id}}',
      method: 'GET' as const,
      headers: [], body: '',
      auth: { type: 'none' as const },
      validation: { mode: 'none' as const },
    } as Scenario;

    const columns: DataSourceColumn[] = [
      { id: 'c1', name: 'id', type: 'path', mapping: 'id' },
    ];
    const row: DataSourceRow = { id: 'r1', values: { c1: '42' }, enabled: true };
    const fetchFn = vi.fn().mockResolvedValue(makeOkResponse());

    const { resolved, reqHeaders, fetchPromise } = executeRowFetch(draft, columns, row, 0, fetchFn);

    expect(resolved.url).toBe('https://api.example.com/users/42');
    expect(reqHeaders).toBeDefined();

    const result = await fetchPromise;
    expect(result.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
