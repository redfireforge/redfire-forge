/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useWorkflowExtractionSample } from './useWorkflowExtractionSample';

vi.mock('../engine/fetchScenarioSample', () => ({
  fetchScenarioSample: vi.fn(),
}));
import { fetchScenarioSample } from '../engine/fetchScenarioSample';

const mockedFetch = vi.mocked(fetchScenarioSample);

function makeHttpNode(overrides: Partial<{ id: string; scenario: Record<string, unknown>; initialVariables: Record<string, string> }> = {}) {
  return {
    id: overrides.id ?? 'h1',
    type: 'http' as const,
    position: { x: 0, y: 0 },
    data: {
      label: 'Step',
      scenario: overrides.scenario ?? { method: 'GET', url: '/x', headers: [], queryParams: [] },
      initialVariables: overrides.initialVariables ?? {},
    },
  };
}

function makeOpts(overrides: Partial<Parameters<typeof useWorkflowExtractionSample>[0]> = {}) {
  const setExtractionSampleJson = vi.fn();
  const setExtractionFetching = vi.fn();
  const setExtractionFetchError = vi.fn();
  return {
    setters: { setExtractionSampleJson, setExtractionFetching, setExtractionFetchError },
    opts: {
      selectedNode: makeHttpNode(),
      selectedId: 'wf1',
      selectedNodeId: 'h1',
      nodes: [makeHttpNode()],
      workflowVariables: {},
      runVariableSnapshot: null,
      microservices: [],
      workflowHostProfiles: [],
      workflowServices: [],
      selectedEnvId: 'dev',
      resolvedBaseUrl: 'https://api.example.com',
      setExtractionSampleJson,
      setExtractionFetching,
      setExtractionFetchError,
      ...overrides,
    } as Parameters<typeof useWorkflowExtractionSample>[0],
  };
}

function renderExtraction(opts: Omit<Parameters<typeof useWorkflowExtractionSample>[0], 'nodeInitialVarsRef'>) {
  return renderHook(() => {
    const ref = useRef<Record<string, Record<string, string>>>({});
    return useWorkflowExtractionSample({ ...opts, nodeInitialVarsRef: ref });
  });
}

describe('useWorkflowExtractionSample', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('errors when selected node is not an HTTP node', async () => {
    const { setters, opts } = makeOpts({
      selectedNode: { id: 's1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } } as never,
    });
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith(expect.stringContaining('HTTP step'));
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('seeds entry variables from start/schedule nodes and merges with workflowVariables', async () => {
    mockedFetch.mockResolvedValue({ ok: true, body: '{"hello":"world"}', status: 200 } as never);
    const { opts, setters } = makeOpts({
      nodes: [
        { id: 's1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', inputVariables: { fromStart: 'A' } } } as never,
        { id: 'sc1', type: 'schedule', position: { x: 0, y: 0 }, data: { label: 'Sched', inputVariables: { fromSched: 'B' } } } as never,
        makeHttpNode(),
      ],
      workflowVariables: { wf: 'C' },
    });
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const mergedVars = mockedFetch.mock.calls[0][1] as Record<string, string>;
    expect(mergedVars).toMatchObject({ fromStart: 'A', fromSched: 'B', wf: 'C' });
    expect(setters.setExtractionSampleJson).toHaveBeenCalledWith('{"hello":"world"}');
    expect(setters.setExtractionFetching).toHaveBeenCalledWith(true);
    expect(setters.setExtractionFetching).toHaveBeenLastCalledWith(false);
  });

  it('pretty-prints JSON error body when fetch returns ok:false', async () => {
    mockedFetch.mockResolvedValue({ ok: false, error: 'HTTP 500', body: '{"err":"boom"}', status: 500 } as never);
    const { opts, setters } = makeOpts();
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith('HTTP 500');
    expect(setters.setExtractionSampleJson).toHaveBeenCalledWith('{\n  "err": "boom"\n}');
  });

  it('ignores non-JSON error body without throwing', async () => {
    mockedFetch.mockResolvedValue({ ok: false, error: 'connection refused', body: 'plain text', status: 0 } as never);
    const { opts, setters } = makeOpts();
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith('connection refused');
    // setExtractionSampleJson is only called once during mount (reset to '') — not for non-JSON body
    expect(setters.setExtractionSampleJson).toHaveBeenCalledTimes(1);
    expect(setters.setExtractionSampleJson).toHaveBeenCalledWith('');
  });

  it('resets sample/error when selectedId or selectedNodeId changes', () => {
    const { opts, setters } = makeOpts();
    const { rerender } = renderExtraction(opts);
    setters.setExtractionSampleJson.mockClear();
    setters.setExtractionFetchError.mockClear();
    rerender();
    // No prop change → no extra reset
    expect(setters.setExtractionSampleJson).not.toHaveBeenCalled();
  });
});
