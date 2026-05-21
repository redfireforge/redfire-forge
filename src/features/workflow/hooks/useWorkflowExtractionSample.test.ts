/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, type MutableRefObject } from 'react';
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
      configModalNode: undefined,
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
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('HTTP step') }),
    );
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('errors when selected node is null', async () => {
    const { setters, opts } = makeOpts({ selectedNode: null as never });
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('HTTP step') }),
    );
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('resets sample and error when selectedId changes', () => {
    const ref: MutableRefObject<Record<string, Record<string, string>>> = { current: {} };
    const setters = {
      setExtractionSampleJson: vi.fn(),
      setExtractionFetching: vi.fn(),
      setExtractionFetchError: vi.fn(),
    };
    const shared = {
      selectedNode: makeHttpNode(),
      selectedNodeId: 'h1',
      nodes: [makeHttpNode()],
      workflowVariables: {} as Record<string, string>,
      runVariableSnapshot: null,
      microservices: [] as never[],
      workflowHostProfiles: [] as never[],
      workflowServices: [] as never[],
      selectedEnvId: 'dev',
      resolvedBaseUrl: 'https://api.example.com',
      ...setters,
      nodeInitialVarsRef: ref,
    };
    const { rerender } = renderHook(
      ({ sid }: { sid: string }) =>
        useWorkflowExtractionSample({ ...shared, selectedId: sid }),
      { initialProps: { sid: 'wf-a' } },
    );
    setters.setExtractionSampleJson.mockClear();
    setters.setExtractionFetchError.mockClear();
    rerender({ sid: 'wf-b' });
    expect(setters.setExtractionSampleJson).toHaveBeenCalledWith('');
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith(null);
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

  it('skips inputVariables merge when start/schedule nodes omit them', async () => {
    mockedFetch.mockResolvedValue({ ok: true, body: '{}', status: 200 } as never);
    const { opts } = makeOpts({
      nodes: [
        { id: 's1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } } as never,
        { id: 'sc1', type: 'schedule', position: { x: 0, y: 0 }, data: { label: 'Sched' } } as never,
        makeHttpNode(),
      ],
    });
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    const mergedVars = mockedFetch.mock.calls[0][1] as Record<string, string>;
    expect(Object.keys(mergedVars)).toHaveLength(0);
  });

  it('merges runVariableSnapshot into live variables', async () => {
    mockedFetch.mockResolvedValue({ ok: true, body: '{}', status: 200 } as never);
    const { opts } = makeOpts({
      runVariableSnapshot: { fromRun: 'yes' },
    });
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    const mergedVars = mockedFetch.mock.calls[0][1] as Record<string, string>;
    expect(mergedVars.fromRun).toBe('yes');
  });

  it('pretty-prints JSON error body when fetch returns ok:false', async () => {
    mockedFetch.mockResolvedValue({ ok: false, error: 'HTTP 500', body: '{"err":"boom"}', httpStatus: 500 } as never);
    const { opts, setters } = makeOpts();
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'HTTP 500', status: 500, body: '{"err":"boom"}' }),
    );
    expect(setters.setExtractionSampleJson).toHaveBeenCalledWith('{\n  "err": "boom"\n}');
  });

  it('ignores non-JSON error body without throwing', async () => {
    mockedFetch.mockResolvedValue({ ok: false, error: 'connection refused', body: 'plain text', httpStatus: 0 } as never);
    const { opts, setters } = makeOpts();
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'connection refused' }),
    );
    // setExtractionSampleJson is only called once during mount (reset to '') — not for non-JSON body
    expect(setters.setExtractionSampleJson).toHaveBeenCalledTimes(1);
    expect(setters.setExtractionSampleJson).toHaveBeenCalledWith('');
  });

  it('uses nodeInitialVarsRef for merge when an entry exists for the node', async () => {
    mockedFetch.mockResolvedValue({ ok: true, body: '{}', status: 200 } as never);
    const ref: MutableRefObject<Record<string, Record<string, string>>> = {
      current: { h1: { fromRef: 'R' } },
    };
    const node = makeHttpNode({ initialVariables: { fromHttp: 'H' } });
    const { result } = renderHook(() =>
      useWorkflowExtractionSample({
        ...makeOpts({
          selectedNode: node,
          nodes: [node],
        }).opts,
        nodeInitialVarsRef: ref,
      }),
    );
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    const mergedVars = mockedFetch.mock.calls[0][1] as Record<string, string>;
    expect(mergedVars.fromRef).toBe('R');
    expect(mergedVars.fromHttp).toBeUndefined();
  });

  it('falls back to http initialVariables when ref has no entry for the node', async () => {
    mockedFetch.mockResolvedValue({ ok: true, body: '{}', status: 200 } as never);
    const ref: MutableRefObject<Record<string, Record<string, string>>> = { current: {} };
    const node = makeHttpNode({ initialVariables: { fromHttp: 'H' } });
    const { result } = renderHook(() =>
      useWorkflowExtractionSample({
        ...makeOpts({
          selectedNode: node,
          nodes: [node],
        }).opts,
        nodeInitialVarsRef: ref,
      }),
    );
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    const mergedVars = mockedFetch.mock.calls[0][1] as Record<string, string>;
    expect(mergedVars.fromHttp).toBe('H');
  });

  it('passes fetch host flags to fetchScenarioSample', async () => {
    mockedFetch.mockResolvedValue({ ok: true, body: '{}', status: 200 } as never);
    const scenario = {
      method: 'GET',
      url: '/x',
      headers: [],
      queryParams: [],
      fetchHostEnabled: true,
      fetchHostOverride: 'https://override.example',
    };
    const node = makeHttpNode({ scenario });
    const { opts } = makeOpts({ selectedNode: node as never, nodes: [node] as never });
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(mockedFetch.mock.calls[0][3]).toEqual({
      fetchHostEnabled: true,
      fetchHostOverride: 'https://override.example',
    });
  });

  it('falls back to configModalNode when selectedNode is null', async () => {
    mockedFetch.mockResolvedValue({ ok: true, body: '{"ok":true}', status: 200 } as never);
    const httpNode = makeHttpNode({ id: 'cfg1' });
    const configNode = { id: 'cfg1', type: 'http' as const, position: { x: 0, y: 0 }, data: httpNode.data };
    const { opts, setters } = makeOpts({
      selectedNode: null as never,
      configModalNode: configNode as never,
      nodes: [httpNode],
    });
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(setters.setExtractionSampleJson).toHaveBeenCalledWith('{"ok":true}');
  });

  it('prefers configModalNode over selectedNode when both are HTTP nodes', async () => {
    mockedFetch.mockResolvedValue({ ok: true, body: '{"src":"config"}', status: 200 } as never);
    const selectedHttp = makeHttpNode({ id: 'sel1', scenario: { method: 'GET', url: '/selected', headers: [], queryParams: [] } });
    const configHttp = makeHttpNode({ id: 'cfg2', scenario: { method: 'POST', url: '/config', headers: [], queryParams: [] } });
    const configNode = { id: 'cfg2', type: 'http' as const, position: { x: 0, y: 0 }, data: configHttp.data };
    const { opts } = makeOpts({
      selectedNode: selectedHttp as never,
      configModalNode: configNode as never,
      nodes: [selectedHttp, configHttp],
    });
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    const scenario = mockedFetch.mock.calls[0][0] as Record<string, unknown>;
    expect(scenario.url).toBe('/config');
  });

  it('treats failed fetch without body like non-JSON (no extra sample set)', async () => {
    mockedFetch.mockResolvedValue({ ok: false, error: 'err', httpStatus: 500 } as never);
    const { opts, setters } = makeOpts();
    const { result } = renderExtraction(opts);
    await act(async () => { await result.current.handleExtractionFetchSample(); });
    expect(setters.setExtractionFetchError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'err' }),
    );
    expect(setters.setExtractionSampleJson).toHaveBeenCalledTimes(1);
  });
});
