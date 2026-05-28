/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowKeyboardShortcuts } from './useWorkflowKeyboardShortcuts';
import { useWorkflowDesignerControllerPartA } from './useWorkflowDesignerControllerPartA';
import type { WorkflowDesignerProps } from '../utils/workflowDesignerShellTypes';
import type { Workflow, WorkflowVersion, WorkflowNode, WorkflowService } from '../types/workflow';
import type { WorkflowRFNode } from '../utils/workflowNodeFactory';

const {
  mockRf, persistFn, undoRedoApi, undoRedoCaptured, clipboardCaptured,
  mockLayout, nodesSeed, versioningCb, consoleOpts, onboardingMock,
} = vi.hoisted(() => {
  const persistFn = vi.fn();
  const undoRedoApi = { takeSnapshot: vi.fn(), clear: vi.fn() };
  const undoRedoCaptured = {
    getNodes: undefined as (() => unknown) | undefined,
    getEdges: undefined as (() => unknown) | undefined,
    setNodes: undefined as ((nodes: unknown) => void) | undefined,
    setEdges: undefined as ((edges: unknown) => void) | undefined,
  };
  const clipboardCaptured = {
    getNodes: undefined as (() => unknown) | undefined,
  };
  const mockRf = {
    fitView: vi.fn(),
    getNodes: vi.fn(() => []),
  };
  const mockLayout = vi.fn((_a: unknown, _b: unknown) => [{ id: 'laid', type: 'start', position: { x: 1, y: 2 }, data: {} }]);
  const nodesSeed = { current: null as WorkflowRFNode[] | null };
  const versioningCb = {
    applyToCanvas: undefined as ((v: WorkflowVersion) => void) | undefined,
    persistRestore: undefined as ((v: WorkflowVersion) => void) | undefined,
    takeSnapshot: undefined as ((label?: string) => void) | undefined,
    closeServicePanel: undefined as (() => void) | undefined,
    deselectNode: undefined as (() => void) | undefined,
    versionUpdate: undefined as ((id: string, patch: Record<string, unknown>) => void) | undefined,
  };
  const consoleOpts = { lastHasWebhook: undefined as boolean | undefined };
  const onboardingMock = {
    showNextHint: vi.fn(() => false),
    isComplete: false,
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    resetHints: vi.fn(),
    showHint: vi.fn(),
    hideHint: vi.fn(),
    getNextHint: vi.fn(),
    activeHint: null,
  };
  return {
    mockRf, persistFn, undoRedoApi, undoRedoCaptured, clipboardCaptured,
    mockLayout, nodesSeed, versioningCb, consoleOpts, onboardingMock,
  };
});

vi.mock('@xyflow/react', async () => {
  const R = await import('react');
  return {
    useNodesState: (initial: unknown) => {
      const seed = nodesSeed.current;
      const [n, setN] = R.useState(seed ?? initial);
      return [n, setN, vi.fn()];
    },
    useEdgesState: (initial: unknown) => {
      const [e, setE] = R.useState(initial);
      return [e, setE, vi.fn()];
    },
    useReactFlow: () => mockRf,
  };
});

vi.mock('../utils/workflowAutoLayout', () => ({
  getAutoLayoutNodes: (a: unknown, b: unknown) => mockLayout(a, b),
}));

vi.mock('./useWorkflowKeyboardShortcuts', () => ({
  useWorkflowKeyboardShortcuts: vi.fn(),
}));

vi.mock('./useWorkflowPersistence', () => ({
  useWorkflowPersistence: () => ({
    serializeNodes: (n: unknown[]) => n,
    serializeEdges: (e: unknown[]) => e,
    persistWorkflow: persistFn,
    insertNodeAndPersist: vi.fn(),
    saveAcknowledged: false,
    handleCopyNode: vi.fn(),
    handlePasteNode: vi.fn(),
    handleDuplicateNode: vi.fn(),
    handleUndoAction: vi.fn(),
    handleRedoAction: vi.fn(),
    handleSave: vi.fn(),
    handleUpdateWorkflowVariables: vi.fn(),
  }),
}));

vi.mock('./useWorkflowVersioning', () => ({
  useWorkflowVersioning: (params: {
    update: (id: string, patch: Record<string, unknown>) => void;
    takeSnapshot: (label?: string) => void;
    applyToCanvas: (v: WorkflowVersion) => void;
    persistRestore: (v: WorkflowVersion) => void;
    closeServicePanel: () => void;
    deselectNode: () => void;
  }) => {
    versioningCb.versionUpdate = params.update;
    versioningCb.applyToCanvas = params.applyToCanvas;
    versioningCb.persistRestore = params.persistRestore;
    versioningCb.takeSnapshot = params.takeSnapshot;
    versioningCb.closeServicePanel = params.closeServicePanel;
    versioningCb.deselectNode = params.deselectNode;
    return {
      versionPanelOpen: false,
      versionDiffState: null,
      versionCount: 0,
      handleVersionRestore: vi.fn(),
      handleVersionDelete: vi.fn(),
      handleVersionRename: vi.fn(),
      handleVersionCompare: vi.fn(),
      openVersionPanel: vi.fn(),
      closeVersionPanel: vi.fn(),
      closeVersionDiff: vi.fn(),
    };
  },
}));

vi.mock('./useWorkflowRunCache', () => ({
  useWorkflowRunCache: () => ({
    nodeStatuses: {},
    setNodeStatuses: vi.fn(),
    lastRunStatus: 'idle' as const,
    setLastRunStatus: vi.fn(),
    lastRunTime: undefined,
    setLastRunTime: vi.fn(),
    lastRunError: null,
    setLastRunError: vi.fn(),
    runVariableSnapshot: null,
    setRunVariableSnapshot: vi.fn(),
    history: [],
    pushRunHistory: vi.fn(),
    restoreRunFromHistory: vi.fn(),
    deleteRunHistoryEntry: vi.fn(),
    clearRunHistory: vi.fn(),
    consoleLines: [],
    pushConsoleLine: vi.fn(),
    clearConsole: vi.fn(),
  }),
}));

vi.mock('./useWorkflowConsole', () => ({
  useWorkflowConsole: (opts: { hasWebhookNode: boolean }) => {
    consoleOpts.lastHasWebhook = opts.hasWebhookNode;
    return {
      consoleOpen: false,
      consoleOpenRef: { current: false },
      consoleRunBehavior: 'continue',
      consoleRunBehaviorRef: { current: 'continue' },
      setConsoleRunBehavior: vi.fn(),
      handleToggleConsole: vi.fn(),
      handleCloseConsole: vi.fn(),
    };
  },
}));

vi.mock('../../../shared/hooks/useResizablePanels', () => ({
  useResizablePanels: () => ({ paletteWidth: 300, startDrag: vi.fn() }),
}));

vi.mock('../../../shared/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock('./useUndoRedo', () => ({
  useUndoRedo: (
    getNodes: () => unknown,
    getEdges: () => unknown,
    setNodes: (nodes: unknown) => void,
    setEdges: (edges: unknown) => void,
    _workflowId?: unknown,
  ) => {
    undoRedoCaptured.getNodes = getNodes;
    undoRedoCaptured.getEdges = getEdges;
    undoRedoCaptured.setNodes = setNodes;
    undoRedoCaptured.setEdges = setEdges;
    return undoRedoApi;
  },
}));

vi.mock('./useNodeClipboard', () => ({
  useNodeClipboard: (opts: { getNodes: () => unknown }) => {
    clipboardCaptured.getNodes = opts.getNodes;
    return {};
  },
}));

vi.mock('./useOnboardingHints', () => ({
  useOnboardingHints: () => onboardingMock,
}));

const wf = (): Workflow => ({
  id: 'wf-main',
  name: 'Main',
  schemaVersion: 6,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [],
  edges: [],
  createdAt: 0,
  updatedAt: 0,
});

const makeProps = (over: Partial<WorkflowDesignerProps> = {}): WorkflowDesignerProps => ({
  collections: [],
  catalogEntries: [],
  wfHook: {
    workflows: [wf()],
    selected: wf(),
    create: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
  environments: [],
  microservices: [],
  globalAuthProfiles: [],
  selectedEnvId: 'env-1',
  selectedSvcId: 'svc-1',
  onEnvSelect: vi.fn(),
  onSvcSelect: vi.fn(),
  resolvedBaseUrl: 'http://localhost',
  previewWorkflow: null,
  onClearPreview: vi.fn(),
  onUseAsTemplate: vi.fn(),
  ...over,
});

describe('useWorkflowDesignerControllerPartA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nodesSeed.current = null;
    versioningCb.applyToCanvas = undefined;
    versioningCb.persistRestore = undefined;
    versioningCb.takeSnapshot = undefined;
    versioningCb.closeServicePanel = undefined;
    versioningCb.deselectNode = undefined;
    versioningCb.versionUpdate = undefined;
    consoleOpts.lastHasWebhook = undefined;
    undoRedoCaptured.getNodes = undefined;
    undoRedoCaptured.getEdges = undefined;
    undoRedoCaptured.setNodes = undefined;
    undoRedoCaptured.setEdges = undefined;
    clipboardCaptured.getNodes = undefined;
    onboardingMock.showNextHint.mockReset();
    onboardingMock.showNextHint.mockReturnValue(false);
    onboardingMock.isComplete = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes workflow selection and palette sizing', () => {
    const props = makeProps();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(props));
    expect(result.current.paletteWidth).toBe(300);
    expect(result.current.selected?.id).toBe('wf-main');
    expect(typeof result.current.persistWorkflow).toBe('function');
  });

  it('uses preview workflow as selected when provided', () => {
    const pv = { ...wf(), id: 'preview-1', name: 'Pv' };
    const props = makeProps({ previewWorkflow: pv });
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(props));
    expect(result.current.selected?.id).toBe('preview-1');
  });

  it('clears undo stack when active workflow id changes', () => {
    const props = makeProps();
    const { rerender } = renderHook(
      (p: WorkflowDesignerProps) => useWorkflowDesignerControllerPartA(p),
      { initialProps: props },
    );
    expect(undoRedoApi.clear).toHaveBeenCalled();
    undoRedoApi.clear.mockClear();
    const wf2 = { ...wf(), id: 'wf-2' };
    rerender(makeProps({
      wfHook: {
        workflows: [wf2],
        selected: wf2,
        create: vi.fn(),
        update: vi.fn(),
        select: vi.fn(),
      },
    }));
    expect(undoRedoApi.clear).toHaveBeenCalled();
  });

  it('handleAutoLayout lays out nodes and persists when not in preview', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const props = makeProps();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(props));

    act(() => {
      void result.current.handleAutoLayout();
      vi.advanceTimersByTime(150);
    });

    expect(mockLayout).toHaveBeenCalled();
    expect(persistFn).toHaveBeenCalled();
    expect(result.current.layoutVersion).toBe(1);
  });

  it('handleAutoLayout skips persist in preview mode', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const pv = { ...wf(), id: 'pv', name: 'Pv' };
    const props = makeProps({ previewWorkflow: pv });
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(props));
    persistFn.mockClear();

    act(() => {
      void result.current.handleAutoLayout();
      vi.advanceTimersByTime(150);
    });

    expect(persistFn).not.toHaveBeenCalled();
  });

  it('wires keyboard shortcuts with the same controller surface', () => {
    const props = makeProps();
    renderHook(() => useWorkflowDesignerControllerPartA(props));
    expect(useWorkflowKeyboardShortcuts).toHaveBeenCalled();
    const call = vi.mocked(useWorkflowKeyboardShortcuts).mock.calls[0][0];
    expect(call.persistWorkflow).toBe(persistFn);
    expect(call.handleAutoLayout).toBeDefined();
  });

  it('passes hasWebhookNode to the console hook when a webhook node exists', () => {
    nodesSeed.current = [{
      id: 'wh',
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: { label: 'WH' } as WorkflowRFNode['data'],
    }];
    const props = makeProps();
    renderHook(() => useWorkflowDesignerControllerPartA(props));
    expect(consoleOpts.lastHasWebhook).toBe(true);
  });

  it('invokes versioning applyToCanvas and persistRestore hooks', () => {
    const update = vi.fn();
    const base = wf();
    const props = makeProps({
      wfHook: {
        workflows: [base],
        selected: base,
        create: vi.fn(),
        update,
        select: vi.fn(),
      },
    });

    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(props));

    const version: WorkflowVersion = {
      id: 'ver-1',
      timestamp: Date.now(),
      fingerprint: 'fp',
      nodeCount: 1,
      edgeCount: 0,
      nodes: [{ id: 's', type: 'start', data: { label: 'S' } as never, position: { x: 0, y: 0 } } as WorkflowNode],
      edges: [],
      variables: { k: 'v' },
      services: [],
    };

    act(() => {
      versioningCb.applyToCanvas?.(version);
    });
    expect(result.current.workflowVariables).toEqual({ k: 'v' });

    act(() => {
      versioningCb.persistRestore?.(version);
    });
    expect(update).toHaveBeenCalledWith(base.id, expect.objectContaining({
      nodes: version.nodes,
      variables: version.variables,
    }));
  });

  it('takeSnapshot forwards undefined label as Snapshot to undo/redo', () => {
    const props = makeProps();
    renderHook(() => useWorkflowDesignerControllerPartA(props));
    act(() => {
      versioningCb.takeSnapshot?.();
    });
    expect(undoRedoApi.takeSnapshot).toHaveBeenCalledWith('Snapshot');
  });

  it('takeSnapshot forwards explicit label to undo/redo', () => {
    const props = makeProps();
    renderHook(() => useWorkflowDesignerControllerPartA(props));
    act(() => {
      versioningCb.takeSnapshot?.('Restore version');
    });
    expect(undoRedoApi.takeSnapshot).toHaveBeenCalledWith('Restore version');
  });

  it('takeSnapshot forwards empty string labels without coercing to Snapshot', () => {
    const props = makeProps();
    renderHook(() => useWorkflowDesignerControllerPartA(props));
    act(() => {
      versioningCb.takeSnapshot?.('');
    });
    expect(undoRedoApi.takeSnapshot).toHaveBeenCalledWith('');
  });

  it('versionUpdate wrapper delegates to wfHook.update', () => {
    const update = vi.fn();
    const base = wf();
    const props = makeProps({
      wfHook: {
        workflows: [base],
        selected: base,
        create: vi.fn(),
        update,
        select: vi.fn(),
      },
    });
    renderHook(() => useWorkflowDesignerControllerPartA(props));

    act(() => {
      versioningCb.versionUpdate?.(base.id, { name: 'Renamed' });
    });

    expect(update).toHaveBeenCalledWith(base.id, { name: 'Renamed' });
  });

  it('useNodeClipboard receives live nodesRef snapshot accessor', () => {
    renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));
    expect(clipboardCaptured.getNodes?.()).toEqual([]);
  });

  it('applyToCanvas omits services when version has none', () => {
    const props = makeProps();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(props));
    expect(result.current.workflowServices).toEqual([]);
    const version: WorkflowVersion = {
      id: 'v-ns',
      timestamp: Date.now(),
      fingerprint: 'fp',
      nodeCount: 0,
      edgeCount: 0,
      nodes: [],
      edges: [],
      variables: {},
    };
    act(() => {
      versioningCb.applyToCanvas?.(version);
    });
    expect(result.current.workflowServices).toEqual([]);
  });

  it('applyToCanvas applies workflow services when present', () => {
    const props = makeProps();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(props));
    const svcs: WorkflowService[] = [{ id: 's1', name: 'S', endpoints: [] }];
    const version: WorkflowVersion = {
      id: 'v-s',
      timestamp: Date.now(),
      fingerprint: 'fp',
      nodeCount: 0,
      edgeCount: 0,
      nodes: [],
      edges: [],
      variables: {},
      services: svcs,
    };
    act(() => {
      versioningCb.applyToCanvas?.(version);
    });
    expect(result.current.workflowServices).toEqual(svcs);
  });

  it('persistRestore is a no-op when no workflow is selected', () => {
    const update = vi.fn();
    const props = makeProps({
      wfHook: {
        workflows: [wf()],
        selected: null,
        create: vi.fn(),
        update,
        select: vi.fn(),
      },
    });
    renderHook(() => useWorkflowDesignerControllerPartA(props));
    const version: WorkflowVersion = {
      id: 'v-x',
      timestamp: Date.now(),
      fingerprint: 'fp',
      nodeCount: 0,
      edgeCount: 0,
      nodes: [],
      edges: [],
      variables: {},
    };
    act(() => {
      versioningCb.persistRestore?.(version);
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('persistRestore falls back workflow services when version omits services', () => {
    const update = vi.fn();
    const base = wf();
    const baseSvcs: WorkflowService[] = [{ id: 'keep', name: 'K', endpoints: [] }];
    const stored = { ...base, services: baseSvcs };
    const props = makeProps({
      wfHook: {
        workflows: [stored],
        selected: stored,
        create: vi.fn(),
        update,
        select: vi.fn(),
      },
    });
    renderHook(() => useWorkflowDesignerControllerPartA(props));
    const version: WorkflowVersion = {
      id: 'v-nosvc',
      timestamp: Date.now(),
      fingerprint: 'fp',
      nodeCount: 0,
      edgeCount: 0,
      nodes: [],
      edges: [],
      variables: {},
    };
    act(() => {
      versioningCb.persistRestore?.(version);
    });
    expect(update).toHaveBeenCalledWith(stored.id, expect.objectContaining({
      services: baseSvcs,
    }));
  });

  it('quick-test refs are callable before Part B wires execution handlers', () => {
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));

    act(() => {
      result.current.handleQuickTestRef.current();
      result.current.handleDebugQuickTestRef.current();
    });
  });

  it('exposes getter/setter callbacks to undo/redo so graph state hooks stay wired', () => {
    const rfNode: WorkflowRFNode = {
      id: 'u1',
      type: 'start',
      position: { x: 0, y: 0 },
      data: { label: 'S' } as WorkflowRFNode['data'],
    };
    renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));

    expect(undoRedoCaptured.getNodes?.()).toEqual([]);
    expect(undoRedoCaptured.getEdges?.()).toEqual([]);

    act(() => {
      undoRedoCaptured.setNodes?.([rfNode]);
      undoRedoCaptured.setEdges?.([]);
    });

    expect(undoRedoCaptured.getNodes?.()).toEqual([rfNode]);
    expect(undoRedoCaptured.setNodes).toBeDefined();
    expect(undoRedoCaptured.setEdges).toBeDefined();
  });

  it('closeServicePanel and deselectNode from versioning params update UI state', () => {
    const props = makeProps();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(props));

    act(() => {
      result.current.setServiceRegistryMode('panel');
      result.current.setSelectedNodeId('nx');
    });

    act(() => {
      versioningCb.closeServicePanel?.();
      versioningCb.deselectNode?.();
    });

    expect(result.current.serviceRegistryMode).toBe('closed');
    expect(result.current.selectedNodeId).toBe(null);
  });

  it('persists workflow when node drag stops', async () => {
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));
    persistFn.mockClear();

    act(() => {
      result.current.onNodesChange([
        { type: 'position', id: 'n1', dragging: false, position: { x: 10, y: 20 } },
      ]);
    });

    await vi.waitFor(() => {
      expect(persistFn).toHaveBeenCalledWith({ rfNodes: expect.any(Array) });
    });
  });

  it('does not persist while node is still dragging', async () => {
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));
    persistFn.mockClear();

    act(() => {
      result.current.onNodesChange([
        { type: 'position', id: 'n1', dragging: true, position: { x: 5, y: 5 } },
      ]);
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(persistFn).not.toHaveBeenCalled();
  });

  it('persists workflow when a node is removed', async () => {
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));
    persistFn.mockClear();

    act(() => {
      result.current.onNodesChange([{ type: 'remove', id: 'n1' }]);
    });

    await vi.waitFor(() => expect(persistFn).toHaveBeenCalled());
  });

  it('skips node-change persist in preview mode', async () => {
    const pv = { ...wf(), id: 'pv', name: 'Preview' };
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(makeProps({ previewWorkflow: pv })));
    persistFn.mockClear();

    act(() => {
      result.current.onNodesChange([
        { type: 'position', id: 'n1', dragging: false, position: { x: 0, y: 0 } },
        { type: 'remove', id: 'n2' },
      ]);
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(persistFn).not.toHaveBeenCalled();
  });

  it('persists workflow when an edge is removed', async () => {
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));
    persistFn.mockClear();

    act(() => {
      result.current.onEdgesChange([{ type: 'remove', id: 'e1' }]);
    });

    await vi.waitFor(() => expect(persistFn).toHaveBeenCalled());
  });

  it('skips edge-change persist in preview mode', async () => {
    const pv = { ...wf(), id: 'pv', name: 'Preview' };
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(makeProps({ previewWorkflow: pv })));
    persistFn.mockClear();

    act(() => {
      result.current.onEdgesChange([{ type: 'remove', id: 'e1' }]);
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(persistFn).not.toHaveBeenCalled();
  });

  it('shows first-node onboarding hint when nodes are added', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));

    act(() => {
      result.current.setNodes([{
        id: 'n1',
        type: 'start',
        position: { x: 0, y: 0 },
        data: { label: 'Start' } as WorkflowRFNode['data'],
      }]);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onboardingMock.showNextHint).toHaveBeenCalledWith('first-node');
  });

  it('shows mount onboarding hint on empty canvas after delay', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onboardingMock.showNextHint.mockReturnValueOnce(true);
    renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(onboardingMock.showNextHint).toHaveBeenCalledWith('mount');
  });

  it('falls back to empty-canvas hint when mount hint is unavailable', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onboardingMock.showNextHint
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(onboardingMock.showNextHint).toHaveBeenCalledWith('mount');
    expect(onboardingMock.showNextHint).toHaveBeenCalledWith('empty-canvas');
  });

  it('skips onboarding hints in preview mode', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const pv = { ...wf(), id: 'pv', name: 'Preview' };
    renderHook(() => useWorkflowDesignerControllerPartA(makeProps({ previewWorkflow: pv })));

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(onboardingMock.showNextHint).not.toHaveBeenCalled();
  });

  it('skips empty-canvas onboarding when hints are complete', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onboardingMock.isComplete = true;
    renderHook(() => useWorkflowDesignerControllerPartA(makeProps()));

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(onboardingMock.showNextHint).not.toHaveBeenCalled();
  });
});
