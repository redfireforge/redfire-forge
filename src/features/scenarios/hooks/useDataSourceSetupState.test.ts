/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scenario, FeatureGroup } from '../../../shared/types';
import { useDataSourceSetupState, type DataSourceSetupProps } from './useDataSourceSetupState';

const generateExcelTemplateMock = vi.fn(() => ({ sheet: 'mock' }));
const downloadExcelMock = vi.fn(async () => {});

vi.mock('../utils/csvTemplate', async () => {
  const actual = await vi.importActual<typeof import('../utils/csvTemplate')>('../utils/csvTemplate');
  return {
    ...actual,
    generateExcelTemplate: (...args: unknown[]) => generateExcelTemplateMock(...args),
    downloadExcel: (...args: unknown[]) => downloadExcelMock(...args),
  };
});

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 't1',
    name: 'Scenario A',
    method: 'GET',
    url: 'https://api.example.com/users/123?q=search',
    headers: [
      { key: '', value: 'ignored' },
      { key: 'X-Trace', value: 'abc' },
    ],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'status', expectedFields: [] },
    ...overrides,
  } as Scenario;
}

function makeFeatureGroups(): FeatureGroup[] {
  return [
    {
      id: 'fg1',
      name: 'FG1',
      scenarios: [
        { id: 'sc1', name: 'SC1', kind: 'standard', tests: [] },
        { id: 'sc2', name: 'SC2', kind: 'parameterized', tests: [] },
      ],
    },
  ];
}

function makeProps(overrides: Partial<DataSourceSetupProps> = {}): DataSourceSetupProps {
  return {
    test: makeScenario(),
    mode: 'parameterize',
    onApply: vi.fn(),
    onClose: vi.fn(),
    onFetchRow: vi.fn(async () => ({ status: 200, statusText: 'OK', headers: {}, body: '{"ok":true}' })),
    featureGroups: makeFeatureGroups(),
    editingTest: { fgId: 'fg1', scenarioId: 'sc1', testId: 't1' },
    sourceName: 'Source',
    ...overrides,
  };
}

beforeEach(() => {
  generateExcelTemplateMock.mockClear();
  downloadExcelMock.mockClear();
});

describe('useDataSourceSetupState coverage branches', () => {
  it('persists changed contract patterns on close when existing dataSource is present', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const test = makeScenario({
      dataSource: {
        id: 'ds1',
        source: { type: 'inline' },
        columns: [],
        rows: [],
        urlTemplate: 'https://api.example.com/users/{{id}}',
        validationContract: ['a[*].b'],
      },
    });

    const { result } = renderHook(() => useDataSourceSetupState(makeProps({ test, onApply, onClose })));

    act(() => {
      result.current.setContractPatterns(new Set(['a[*].b', 'c[*].d']));
    });

    act(() => {
      result.current.handleClose();
    });

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        validationContract: ['a[*].b', 'c[*].d'],
      }),
      'https://api.example.com/users/{{id}}',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('handles fetch error and HTTP status branches in validate fetch flow', async () => {
    const onFetchRow = vi
      .fn()
      .mockResolvedValueOnce({
        status: 500,
        statusText: 'ERR',
        headers: {},
        body: 'x',
        error: 'network-fail',
      })
      .mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        headers: {},
        body: 'missing',
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{"ok":true}',
      });

    const { result } = renderHook(() =>
      useDataSourceSetupState(
        makeProps({
          onFetchRow,
        }),
      ),
    );

    await act(async () => {
      await result.current.handleFetchForValidate();
    });
    expect(result.current.fetchError?.message).toBe('network-fail');

    await act(async () => {
      await result.current.handleFetchForValidate();
    });
    expect(result.current.fetchError?.message).toContain('HTTP 404');

    await act(async () => {
      await result.current.handleFetchForValidate();
    });
    expect(result.current.fetchError).toBeNull();
    expect(result.current.sampleJson).toBe('{"ok":true}');
    expect(onFetchRow).toHaveBeenCalledWith(
      expect.any(String),
      'GET',
      { 'X-Trace': 'abc' },
      undefined,
      expect.any(Object),
    );
  });

  it('applies parameterize payload and uses default new scenario name when blank', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() => useDataSourceSetupState(makeProps({ onApply, onClose })));

    act(() => {
      result.current.setColumnDefs([
        {
          type: 'param',
          fullKey: 'param:q',
          mapping: 'q',
          autoName: 'q',
          customName: 'q',
        },
      ]);
      result.current.setTargetScenarioId('__new__');
      result.current.setNewScenarioName('   ');
      result.current.setCopyName('Copy A');
    });

    act(() => {
      result.current.handleApply();
    });

    expect(onApply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        copyName: 'Copy A',
        targetScenarioId: undefined,
        newScenarioName: 'Parameterized Tests',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('exports using existing rows and name-column mapping branch', async () => {
    const onClose = vi.fn();
    const test = makeScenario({
      dataSource: {
        id: 'ds2',
        source: { type: 'inline' },
        urlTemplate: 'https://api.example.com/users/{{id}}?q={{q}}',
        columns: [
          { id: 'c1', name: 'q', type: 'param', mapping: 'q' },
        ],
        rows: [
          { id: 'r1', label: 'Row Label', enabled: true, values: { c1: 'hello' } },
        ],
      },
    });

    const { result } = renderHook(() => useDataSourceSetupState(makeProps({ test, mode: 'export', onClose })));

    act(() => {
      result.current.setColumnDefs([
        {
          type: 'name',
          fullKey: 'name:name',
          mapping: 'name',
          autoName: 'name',
          customName: 'scenario_name',
        },
        {
          type: 'param',
          fullKey: 'param:q',
          mapping: 'q',
          autoName: 'q',
          customName: 'q',
        },
      ]);
    });

    await act(async () => {
      await result.current.handleExport();
    });

    expect(generateExcelTemplateMock).toHaveBeenCalled();
    expect(downloadExcelMock).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('_template.xlsx'));
    expect(onClose).toHaveBeenCalled();
  });
});
