/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVerifyEngine, executeRowFetch } from './useVerifyEngine';
import { UseVerifyEngineOptions } from './useVerifyEngine';
import { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '@shared/types';
import { HttpResponse } from '@shared/utils/httpClient';
import { validate } from '@engine/core/validator';
import { expandPatternFromResponse, extractJsonPath } from '../utils/dataSourceImport';

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
    resetAllMocks();
    draft = makeDraft();
    onDraftChange = vi.fn();
    mockFetch = vi.fn();
    (validate as ReturnType<typeof vi.fn>).mockReturnValue([]);
    vi.mocked(expandPatternFromResponse).mockReturnValue([]);
    vi.mocked(extractJsonPath).mockImplementation((obj: unknown, path: string) => {
      if (path === '$.name') return 'Alice';
      if (path === '$.age') return '30';
      return '';
    });
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

    it('uses dataTable argument when scenario dataSource is undefined', () => {
      const full = makeDraft();
      const ds = full.dataSource!;
      draft = makeDraft({ dataSource: undefined });
      const { result } = renderHook(() =>
        useVerifyEngine(draft, ds, onDraftChange, mockFetch),
      );

      expect(result.current.enabledRows).toHaveLength(2);
      expect(result.current.requestCols).toEqual(ds.columns.filter(c => c.type !== 'validate'));
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

    it('stringifies non-Error thrown during fetch', async () => {
      mockFetch.mockRejectedValue('not-an-error-instance');
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.status).toBe('error');
      expect(result.current.results.get('r1')?.error).toBe('not-an-error-instance');
    });

    it('passes unorderedArrays when arrayValidationMode has unordered', async () => {
      draft.dataSource!.arrayValidationMode = { arr: 'unordered' };
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(validate).toHaveBeenCalled();
      const call = (validate as ReturnType<typeof vi.fn>).mock.calls.find(
        c => c[0]?.unorderedArrays === true,
      );
      expect(call).toBeDefined();
    });

    it('maps validation failures to failedCells and row status fail', async () => {
      (validate as ReturnType<typeof vi.fn>).mockReturnValueOnce([
        { path: '$.name', expected: '"Alice"', actual: '"wrong"' },
      ]);
      mockFetch.mockResolvedValue(makeOkResponse('{"name":"wrong"}'));
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.status).toBe('fail');
      expect(result.current.results.get('r1')?.failedCells.v1).toBeDefined();
    });

    it('uses sentHeaders from response when present', async () => {
      const sent = { 'x-sent': '1' };
      mockFetch.mockResolvedValue({ ...makeNetworkError(), sentHeaders: sent });
      const { result } = renderEngine({ trackRequestDetails: true });

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.requestHeaders).toEqual(sent);
    });

    it('records request details on HTTP error including when body is undefined', async () => {
      mockFetch.mockResolvedValue({
        status: 502,
        statusText: 'Bad Gateway',
        headers: {},
        body: undefined as unknown as string,
      });
      const { result } = renderEngine({ trackRequestDetails: true });

      await act(async () => {
        await result.current.runVerification();
      });

      const vr = result.current.results.get('r1');
      expect(vr?.resolvedUrl).toBeDefined();
      expect(vr?.responseBody).toBeUndefined();
    });

    it('skips actualCells entry when extractJsonPath returns empty', async () => {
      draft.dataSource!.columns.push({
        id: 'v2',
        name: 'age',
        type: 'validate',
        mapping: '$.age',
      });
      draft.dataSource!.rows.forEach(r => {
        r.values.v2 = 'ignored';
      });
      vi.mocked(extractJsonPath).mockImplementation((_o, path: string) => (path === '$.name' ? 'Alice' : ''));
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine({ trackActualCells: true });

      await act(async () => {
        await result.current.runVerification();
      });

      const vr = result.current.results.get('r1');
      expect(vr?.actualCells).toEqual({ v1: 'Alice' });
    });

    it('ignores validation failures whose path does not match a validate column', async () => {
      (validate as ReturnType<typeof vi.fn>).mockReturnValueOnce([
        { path: '$.name', expected: '"x"', actual: '"y"' },
        { path: '$.orphan', expected: '"a"', actual: '"b"' },
      ]);
      mockFetch.mockResolvedValue(makeOkResponse('{"name":"y"}'));
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.failedCells).toEqual({ v1: '"y"' });
    });

    it('uses (missing) when validator omits actual on a matched column', async () => {
      (validate as ReturnType<typeof vi.fn>).mockReturnValueOnce([
        { path: '$.name', expected: '"x"', actual: undefined as unknown as string },
      ]);
      mockFetch.mockResolvedValue(makeOkResponse('{"name":"y"}'));
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.failedCells.v1).toBe('(missing)');
    });

    it('treats JSON null body as no object for validation', async () => {
      mockFetch.mockResolvedValue(makeOkResponse('null'));
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      expect(result.current.results.get('r1')?.status).toBe('pass');
      expect(result.current.results.get('r1')?.failedCells).toEqual({});
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

    it('uses neutral summaryClass while verifying with partial results', async () => {
      let finishSecond!: (v: HttpResponse) => void;
      const holdSecond = new Promise<HttpResponse>(res => {
        finishSecond = res;
      });
      mockFetch.mockResolvedValueOnce(makeOkResponse()).mockImplementationOnce(() => holdSecond);

      const { result } = renderEngine();

      let verifyDone: Promise<void>;
      await act(async () => {
        verifyDone = result.current.runVerification();
        await new Promise<void>(r => setTimeout(r, 0));
      });

      await vi.waitFor(() => {
        expect(result.current.results.size).toBe(1);
        expect(result.current.verifying).toBe(true);
        expect(result.current.summary.summaryClass).toBe('verify-summary-neutral');
      });

      await act(async () => {
        finishSecond(makeOkResponse());
        await verifyDone!;
      });
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

    it('returns early when draft has no dataSource', async () => {
      draft = makeDraft({ dataSource: undefined });
      const emptyDs: DataSource = { id: 'empty', columns: [], rows: [], source: { type: 'inline' } };
      const { result } = renderHook(() =>
        useVerifyEngine(draft, emptyDs, onDraftChange, mockFetch),
      );

      await act(async () => {
        result.current.setResults(
          new Map([['r1', { rowId: 'r1', status: 'error', failedCells: {}, actualCells: {} }]]),
        );
        await result.current.refetchFailedRows();
      });

      expect(onDraftChange).not.toHaveBeenCalled();
    });

    it('skips row ids that are not present in dataSource rows', async () => {
      mockFetch.mockResolvedValue(makeOkResponse());
      const { result } = renderEngine();

      await act(() => {
        result.current.setResults(
          new Map([['missing', { rowId: 'missing', status: 'error', failedCells: {}, actualCells: {} }]]),
        );
      });

      mockFetch.mockClear();
      onDraftChange.mockClear();
      await act(async () => {
        await result.current.refetchFailedRows();
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(onDraftChange).toHaveBeenCalledTimes(1);
    });

    it('skips refetch update when response has error', async () => {
      mockFetch.mockResolvedValueOnce(makeNetworkError());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      mockFetch.mockResolvedValueOnce(makeNetworkError());
      await act(async () => {
        await result.current.refetchFailedRows();
      });

      expect(onDraftChange).toHaveBeenCalledTimes(1);
      const payload = onDraftChange.mock.calls[0][0] as Scenario;
      expect(payload.dataSource?.rows[0].values).toEqual(draft.dataSource!.rows[0].values);
    });

    it('skips refetch update when HTTP status is 400+', async () => {
      mockFetch.mockResolvedValueOnce(makeNetworkError());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      mockFetch.mockResolvedValueOnce(makeErrorResponse(502));
      await act(async () => {
        await result.current.refetchFailedRows();
      });

      expect(onDraftChange).toHaveBeenCalled();
    });

    it('skips refetch value merge when body is not JSON', async () => {
      mockFetch.mockResolvedValueOnce(makeNetworkError());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      mockFetch.mockResolvedValueOnce(makeOkResponse('not-json'));
      await act(async () => {
        await result.current.refetchFailedRows();
      });

      expect(onDraftChange).toHaveBeenCalled();
    });

    it('expands validationContract paths, clears dynamic cells, and adds new validate columns', async () => {
      const ds: DataSource = {
        id: 'ds-dyn',
        validationContract: ['items[*].x'],
        columns: [
          { id: 'c1', name: 'id', type: 'path', mapping: 'id' },
          { id: 'v1', name: 'name', type: 'validate', mapping: '$.name' },
          { id: 'v2', name: 'dyn0', type: 'validate', mapping: 'items[0].x' },
        ],
        rows: [{ id: 'r1', values: { c1: '1', v1: 'old', v2: 'keep' }, enabled: true }],
        source: { type: 'inline' },
      };
      draft = makeDraft({ dataSource: ds });

      vi.mocked(expandPatternFromResponse).mockReturnValue(['items[1].x']);
      vi.mocked(extractJsonPath).mockImplementation((obj: unknown, path: string) => {
        const o = obj as { name?: string; items?: { x: string }[] };
        if (path === '$.name') return o.name ?? '';
        if (path === 'items[0].x') return '';
        if (path === 'items[1].x') return 'from-api';
        return '';
      });

      mockFetch.mockResolvedValueOnce(makeNetworkError());
      const { result } = renderHook(() =>
        useVerifyEngine(draft, ds, onDraftChange, mockFetch),
      );

      await act(async () => {
        await result.current.runVerification();
      });

      const body = JSON.stringify({ name: 'N', items: [{ x: 'a' }, { x: 'b' }] });
      mockFetch.mockResolvedValueOnce(makeOkResponse(body));

      await act(async () => {
        await result.current.refetchFailedRows();
      });

      expect(expandPatternFromResponse).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      const cols = updated.dataSource!.columns;
      expect(cols.some(c => c.mapping === 'items[1].x' && c.type === 'validate')).toBe(true);
      const row = updated.dataSource!.rows.find(r => r.id === 'r1');
      expect(row?.values.v2).toBe('');
      const newCol = cols.find(c => c.mapping === 'items[1].x');
      expect(newCol && row?.values[newCol.id]).toBe('from-api');
    });

    it('uses proxyFetch in refetchFailedRows when onFetchRow is undefined', async () => {
      const { proxyFetch: pf } = await import('../../../engine/executor');
      (pf as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(makeNetworkError())
        .mockResolvedValueOnce(makeNetworkError())
        .mockResolvedValueOnce(makeOkResponse())
        .mockResolvedValueOnce(makeOkResponse());

      draft = makeDraft();
      const { result } = renderHook(() =>
        useVerifyEngine(draft, draft.dataSource!, onDraftChange, undefined),
      );

      await act(async () => {
        await result.current.runVerification();
      });

      await act(async () => {
        await result.current.refetchFailedRows();
      });

      expect(pf.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('does not add validate column when expanded path already exists', async () => {
      const ds: DataSource = {
        id: 'ds-exists',
        validationContract: ['items[*].x'],
        columns: [
          { id: 'c1', name: 'id', type: 'path', mapping: 'id' },
          { id: 'v1', name: 'name', type: 'validate', mapping: '$.name' },
          { id: 'v2', name: 'i0', type: 'validate', mapping: 'items[0].x' },
          { id: 'v3', name: 'i1', type: 'validate', mapping: 'items[1].x' },
        ],
        rows: [{ id: 'r1', values: { c1: '1', v1: '', v2: '', v3: '' }, enabled: true }],
        source: { type: 'inline' },
      };
      draft = makeDraft({ dataSource: ds });

      vi.mocked(expandPatternFromResponse).mockReturnValue(['items[1].x']);
      vi.mocked(extractJsonPath).mockImplementation((obj: unknown, path: string) => {
        const o = obj as { name?: string; items?: { x: string }[] };
        if (path === '$.name') return o.name ?? '';
        if (path === 'items[0].x') return o.items?.[0]?.x ?? '';
        if (path === 'items[1].x') return o.items?.[1]?.x ?? '';
        return '';
      });

      mockFetch.mockResolvedValueOnce(makeNetworkError());
      const { result } = renderHook(() => useVerifyEngine(draft, ds, onDraftChange, mockFetch));

      await act(async () => {
        await result.current.runVerification();
      });

      mockFetch.mockResolvedValueOnce(
        makeOkResponse(JSON.stringify({ name: 'N', items: [{ x: 'a' }, { x: 'b' }] })),
      );

      await act(async () => {
        await result.current.refetchFailedRows();
      });

      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.columns.filter(c => c.type === 'validate')).toHaveLength(3);
    });

    it('leaves validate value unchanged when empty extract does not match dynamic pattern', async () => {
      const ds: DataSource = {
        id: 'ds-nomatch',
        validationContract: ['items[*].x'],
        columns: [
          { id: 'c1', name: 'id', type: 'path', mapping: 'id' },
          { id: 'v1', name: 'name', type: 'validate', mapping: '$.name' },
          { id: 'v2', name: 'side', type: 'validate', mapping: '$.side' },
        ],
        rows: [{ id: 'r1', values: { c1: '1', v1: '', v2: 'keep-me' }, enabled: true }],
        source: { type: 'inline' },
      };
      draft = makeDraft({ dataSource: ds });

      vi.mocked(expandPatternFromResponse).mockReturnValue([]);
      vi.mocked(extractJsonPath).mockImplementation((obj: unknown, path: string) => {
        const o = obj as { name?: string };
        if (path === '$.name') return o.name ?? '';
        return '';
      });

      mockFetch.mockResolvedValueOnce(makeNetworkError());
      const { result } = renderHook(() => useVerifyEngine(draft, ds, onDraftChange, mockFetch));

      await act(async () => {
        await result.current.runVerification();
      });

      mockFetch.mockResolvedValueOnce(makeOkResponse(JSON.stringify({ name: 'N' })));

      await act(async () => {
        await result.current.refetchFailedRows();
      });

      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      const row = updated.dataSource!.rows.find(r => r.id === 'r1');
      expect(row?.values.v2).toBe('keep-me');
    });

    it('ignores errors inside refetch loop per row', async () => {
      mockFetch.mockResolvedValueOnce(makeNetworkError());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      mockFetch.mockRejectedValueOnce(new Error('refetch boom'));
      await act(async () => {
        await result.current.refetchFailedRows();
      });

      expect(onDraftChange).toHaveBeenCalled();
    });

    it('runs scheduled re-verification after refetch when using fake timers', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockFetch.mockResolvedValueOnce(makeNetworkError());
      const { result } = renderEngine();

      await act(async () => {
        await result.current.runVerification();
      });

      mockFetch.mockResolvedValue(makeOkResponse());
      await act(async () => {
        await result.current.refetchFailedRows();
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      vi.useRealTimers();
      expect(mockFetch.mock.calls.length).toBeGreaterThan(2);
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
