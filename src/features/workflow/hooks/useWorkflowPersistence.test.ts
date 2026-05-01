/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import {
  serializeRFNodes,
  serializeRFEdges,
  useWorkflowPersistence,
} from './useWorkflowPersistence';

const fetchMock = vi.fn().mockResolvedValue({ ok: true });
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

function makeHttpRFNode(id = 'h1', data: Record<string, unknown> = {}) {
  return {
    id,
    type: 'http' as const,
    position: { x: 0, y: 0 },
    data: { label: 'GET', scenario: { method: 'GET', url: '/x' }, initialVariables: { a: '1' }, ...data },
  };
}

function makeOpts(overrides: Partial<Parameters<typeof useWorkflowPersistence>[0]> = {}) {
  const update = vi.fn();
  const toast = { show: vi.fn() };
  const setNodes = vi.fn();
  const setWorkflowVariables = vi.fn();
  const clipboard = {
    copyNode: vi.fn(),
    buildPasteNode: vi.fn(() => ({ id: 'new', type: 'http', position: { x: 340, y: 100 }, data: { label: 'Pasted' } })),
    buildDuplicateNode: vi.fn(() => ({ id: 'dup', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Dup' } })),
  } as never;
  const undoRedo = {
    takeSnapshot: vi.fn(),
    undo: vi.fn(() => 'Snapshot A'),
    redo: vi.fn(() => 'Snapshot B'),
    clear: vi.fn(),
  } as never;

  return {
    handles: { update, toast, setNodes, setWorkflowVariables, clipboard, undoRedo },
    opts: {
      selected: { id: 'wf1', name: 'WF', nodes: [], edges: [] } as never,
      previewWorkflow: null,
      nodes: [makeHttpRFNode('h1')],
      edges: [{ id: 'e1', source: 'h1', target: 'h2' }],
      workflowVariables: { x: '1' },
      workflowHostProfiles: [],
      workflowAuthProfiles: [],
      workflowServices: [],
      workflowErrorConfig: undefined,
      selectedNodeId: 'h1',
      setNodes,
      setWorkflowVariables,
      update,
      clipboard,
      undoRedo,
      toast,
      ...overrides,
    } as Omit<Parameters<typeof useWorkflowPersistence>[0], 'nodeInitialVarsRef' | 'nodesRef' | 'nextNodeY' | 'workflowVariablesRef'>,
  };
}

function renderPersistence(opts: ReturnType<typeof makeOpts>['opts'], initialVars: Record<string, Record<string, string>> = {}) {
  return renderHook(() => {
    const nodeInitialVarsRef = useRef(initialVars);
    const nodesRef = useRef(opts.nodes);
    const nextNodeY = useRef(100);
    const workflowVariablesRef = useRef(opts.workflowVariables);
    return useWorkflowPersistence({
      ...opts,
      nodeInitialVarsRef,
      nodesRef,
      nextNodeY,
      workflowVariablesRef,
    });
  });
}

describe('serializeRFNodes', () => {
  it('overlays nodeInitialVars onto http node data', () => {
    const out = serializeRFNodes([makeHttpRFNode('h1')], { h1: { override: 'OK' } });
    expect((out[0].data as { initialVariables: Record<string, string> }).initialVariables).toEqual({ override: 'OK' });
  });
  it('falls back to existing initialVariables when no override', () => {
    const out = serializeRFNodes([makeHttpRFNode('h1')], {});
    expect((out[0].data as { initialVariables: Record<string, string> }).initialVariables).toEqual({ a: '1' });
  });
  it('passes through non-http nodes untouched', () => {
    const startNode = { id: 's1', type: 'start' as const, position: { x: 0, y: 0 }, data: { label: 'Start', inputVariables: { foo: 'bar' } } };
    const out = serializeRFNodes([startNode as never], {});
    expect(out[0].type).toBe('start');
    expect((out[0].data as { inputVariables: Record<string, string> }).inputVariables).toEqual({ foo: 'bar' });
  });
});

describe('serializeRFEdges', () => {
  it('strips reactflow runtime fields and normalizes label', () => {
    const out = serializeRFEdges([
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'h', label: 'L', selected: true } as never,
      { id: 'e2', source: 'a', target: 'c', label: undefined, sourceHandle: null } as never,
    ]);
    expect(out[0]).toEqual({ id: 'e1', source: 'a', target: 'b', sourceHandle: 'h', label: 'L' });
    expect(out[1]).toEqual({ id: 'e2', source: 'a', target: 'c', sourceHandle: undefined, label: undefined });
  });
});

describe('useWorkflowPersistence hook', () => {
  it('persistWorkflow calls update with serialized nodes/edges and webhook PUTs when webhook trigger present', () => {
    const webhookNode = { id: 'wb1', type: 'webhook' as const, position: { x: 0, y: 0 }, data: { label: 'WB' } };
    const { handles, opts } = makeOpts({ nodes: [webhookNode as never, makeHttpRFNode('h1')] });
    const { result } = renderPersistence(opts);
    act(() => { result.current.persistWorkflow(); });
    expect(handles.update).toHaveBeenCalledWith('wf1', expect.objectContaining({ schemaVersion: 3 }));
    expect(fetchMock).toHaveBeenCalledWith('/api/workflows/wf1', expect.objectContaining({ method: 'PUT' }));
  });

  it('persistWorkflow does NOT PUT when no webhook trigger', () => {
    const { handles, opts } = makeOpts();
    const { result } = renderPersistence(opts);
    act(() => { result.current.persistWorkflow(); });
    expect(handles.update).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persistWorkflow honors variable & errorConfig overrides', () => {
    const { handles, opts } = makeOpts();
    const { result } = renderPersistence(opts);
    act(() => {
      result.current.persistWorkflow({ variables: { only: 'this' }, errorConfig: { stopOnError: true } as never });
    });
    expect(handles.update).toHaveBeenCalledWith('wf1', expect.objectContaining({
      variables: { only: 'this' },
      errorConfig: { stopOnError: true },
    }));
  });

  it('handlePasteNode advances nextNodeY and pushes snapshot', () => {
    const { handles, opts } = makeOpts();
    const { result } = renderPersistence(opts);
    act(() => { result.current.handlePasteNode(); });
    expect(handles.undoRedo.takeSnapshot).toHaveBeenCalledWith('Paste node');
    expect(handles.toast.show).toHaveBeenCalledWith('info', 'Node pasted', expect.any(String));
  });

  it('handleDuplicateNode shows duplicated toast', () => {
    const { handles, opts } = makeOpts();
    const { result } = renderPersistence(opts);
    act(() => { result.current.handleDuplicateNode(); });
    expect(handles.undoRedo.takeSnapshot).toHaveBeenCalledWith('Duplicate node');
    expect(handles.toast.show).toHaveBeenCalledWith('info', 'Node duplicated', expect.any(String));
  });

  it('handleUndoAction / handleRedoAction surface labels via toast', () => {
    const { handles, opts } = makeOpts();
    const { result } = renderPersistence(opts);
    act(() => { result.current.handleUndoAction(); });
    expect(handles.toast.show).toHaveBeenCalledWith('info', 'Undo: Snapshot A');
    act(() => { result.current.handleRedoAction(); });
    expect(handles.toast.show).toHaveBeenCalledWith('info', 'Redo: Snapshot B');
  });

  it('handleSave skips when previewWorkflow is set', () => {
    const { handles, opts } = makeOpts({ previewWorkflow: { id: 'preview' } as never });
    const { result } = renderPersistence(opts);
    act(() => { result.current.handleSave(); });
    expect(handles.update).not.toHaveBeenCalled();
    expect(handles.toast.show).not.toHaveBeenCalled();
  });

  it('handleSave persists and shows success toast otherwise', () => {
    const { handles, opts } = makeOpts();
    const { result } = renderPersistence(opts);
    act(() => { result.current.handleSave(); });
    expect(handles.update).toHaveBeenCalled();
    expect(handles.toast.show).toHaveBeenCalledWith('success', 'Workflow saved', expect.any(String));
  });

  it('handleUpdateWorkflowVariables updates ref, state, and persists with override', () => {
    const { handles, opts } = makeOpts();
    const { result } = renderPersistence(opts);
    act(() => { result.current.handleUpdateWorkflowVariables({ next: 'val' }); });
    expect(handles.setWorkflowVariables).toHaveBeenCalledWith({ next: 'val' });
    expect(handles.update).toHaveBeenCalledWith('wf1', expect.objectContaining({ variables: { next: 'val' } }));
  });
});
