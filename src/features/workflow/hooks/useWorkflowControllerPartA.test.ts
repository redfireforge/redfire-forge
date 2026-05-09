/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowKeyboardShortcuts } from './useWorkflowKeyboardShortcuts';
import { useWorkflowDesignerControllerPartA } from './useWorkflowDesignerControllerPartA';
import type { WorkflowDesignerProps } from '../utils/workflowDesignerShellTypes';
import type { Workflow, WorkflowVersion, WorkflowNode } from '../types/workflow';
import type { WorkflowRFNode } from '../utils/workflowNodeFactory';

const { mockRf, persistFn, undoRedoApi, mockLayout, nodesSeed, versioningCb, consoleOpts } = vi.hoisted(() => {
  const persistFn = vi.fn();
  const undoRedoApi = { takeSnapshot: vi.fn(), clear: vi.fn() };
  const mockRf = {
    fitView: vi.fn(),
    getNodes: vi.fn(() => []),
  };
  const mockLayout = vi.fn((_a: unknown, _b: unknown) => [{ id: 'laid', type: 'start', position: { x: 1, y: 2 }, data: {} }]);
  const nodesSeed = { current: null as WorkflowRFNode[] | null };
  const versioningCb = {
    applyToCanvas: undefined as ((v: WorkflowVersion) => void) | undefined,
    persistRestore: undefined as ((v: WorkflowVersion) => void) | undefined,
  };
  const consoleOpts = { lastHasWebhook: undefined as boolean | undefined };
  return { mockRf, persistFn, undoRedoApi, mockLayout, nodesSeed, versioningCb, consoleOpts };
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
    applyToCanvas: (v: WorkflowVersion) => void;
    persistRestore: (v: WorkflowVersion) => void;
  }) => {
    versioningCb.applyToCanvas = params.applyToCanvas;
    versioningCb.persistRestore = params.persistRestore;
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
  useUndoRedo: () => undoRedoApi,
}));

vi.mock('./useNodeClipboard', () => ({
  useNodeClipboard: () => ({}),
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
    consoleOpts.lastHasWebhook = undefined;
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
});
