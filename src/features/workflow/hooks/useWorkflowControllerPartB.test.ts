/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SetStateAction } from 'react';
import { useWorkflowDesignerControllerPartB } from './useWorkflowDesignerControllerPartB';
import { WorkflowDesignerProps } from '../utils/workflowDesignerShellTypes';
import { Workflow } from '../types/workflow';
import { enrichNodeData, type WorkflowRFNode } from '../utils/workflowNodeFactory';
import { WorkflowDesignerControllerPartA } from './useWorkflowDesignerControllerPartA';
import * as workflowRunErrors from '../utils/workflowRunErrors';

// Mock harToWorkflow so controller tests don't trigger real chain detection
vi.mock('../utils/harToWorkflow', () => ({
  harToWorkflow: vi.fn(() => ({
    nodes: [{ id: 'start-1', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Start', inputVariables: {} } }],
    edges: [],
    variables: {},
    extractionSummary: [],
  })),
}));

type ServiceRegistryMode = 'closed' | 'panel' | 'fullscreen';

const {
  reactFlowInitStub,
  dragDropStub,
  partBMutable,
  navMocks,
  resolveHttpNodeBaseUrlSpy,
} = vi.hoisted(() => ({
  reactFlowInitStub: vi.fn(() => vi.fn()),
  dragDropStub: vi.fn(() => ({
    isDragOver: false,
    dropTargetEdgeId: null,
    canvasAreaRef: { current: null },
    handleCanvasDragOver: vi.fn(),
    handleCanvasDragLeave: vi.fn(),
    handleCanvasDrop: vi.fn(),
  })),
  partBMutable: {
    configModalNodeId: null as string | null,
    selectedHintNode: null as WorkflowRFNode | null,
  },
  navMocks: {
    setNavStack: vi.fn(),
    navigateToWorkflow: vi.fn(),
    handleBreadcrumbNavigate: vi.fn(),
  },
  resolveHttpNodeBaseUrlSpy: vi.fn(),
}));

vi.mock('../utils/workflowHostResolve', () => ({
  resolveHttpNodeBaseUrl: (...args: unknown[]) => resolveHttpNodeBaseUrlSpy(...args),
}));

vi.mock('./useWorkflowPreviewReactFlowInit', () => ({
  useWorkflowPreviewReactFlowInit: (...args: unknown[]) => reactFlowInitStub(...args),
}));

vi.mock('./useWorkflowDragDrop', () => ({
  useWorkflowDragDrop: (...args: unknown[]) => dragDropStub(...args),
}));

vi.mock('./useWorkflowNodeActions', () => ({
  useWorkflowNodeActions: () => ({
    addNodeToCanvas: vi.fn(),
    handleAddNode: vi.fn(),
    handleAddFromRequest: vi.fn(),
    handleAddFromCatalog: vi.fn(),
    handleUpdateNode: vi.fn(),
    handleDeleteNode: vi.fn(),
    handleExtractToSubWorkflow: vi.fn(),
  }),
}));

vi.mock('./useWorkflowResolvers', () => ({
  useWorkflowResolvers: () => ({
    handleEnvSelect: vi.fn(),
    resolveHttpBaseUrlForGraph: vi.fn(),
    resolveHttpAuthForGraph: vi.fn(),
  }),
}));

vi.mock('./useWorkflowExecution', () => ({
  useWorkflowExecution: () => ({
    isRunning: false,
    setIsRunning: vi.fn(),
    isDebugMode: false,
    setIsDebugMode: vi.fn(),
    debugControllerRef: { current: null },
    abortRef: { current: null },
    runProgress: null,
    failedStepLabel: null,
    lastQuickTestRequestUrl: null,
    handleQuickTest: vi.fn(),
    handleDebugQuickTest: vi.fn(),
    handleDebugStep: vi.fn(),
    handleDebugStop: vi.fn(),
    handleResetRunStatus: vi.fn(),
  }),
}));

vi.mock('./useWorkflowCanvasSync', () => ({
  useWorkflowCanvasSync: vi.fn(),
  useWorkflowVariableHints: () => ({
    selectedNode: partBMutable.selectedHintNode,
    conditionVariableHints: [],
    httpVariableHints: [],
  }),
}));

vi.mock('./useWorkflowDetailModal', () => ({
  useWorkflowDetailModal: () => ({
    detailModal: null,
    setDetailModal: vi.fn(),
    variableDetailDraft: null,
    setVariableDetailDraft: vi.fn(),
    get configModalNodeId() {
      return partBMutable.configModalNodeId;
    },
    setConfigModalNodeId: vi.fn(),
    extractionSampleJson: null,
    setExtractionSampleJson: vi.fn(),
    extractionFetching: false,
    setExtractionFetching: vi.fn(),
    extractionFetchError: null,
    setExtractionFetchError: vi.fn(),
    openStepDetail: vi.fn(),
    openVariableDetail: vi.fn(),
    openRunErrorDetail: vi.fn(),
    openNodeConfig: vi.fn(),
    handleApplyVariableDetail: vi.fn(),
    stepDetailMeta: null,
  }),
}));

vi.mock('./useWorkflowExtractionSample', () => ({
  useWorkflowExtractionSample: () => ({
    handleExtractionFetchSample: vi.fn(),
  }),
}));

vi.mock('./useWorkflowNavigation', () => ({
  useWorkflowNavigation: () => ({
    navStack: [],
    setNavStack: navMocks.setNavStack,
    navigateToWorkflow: navMocks.navigateToWorkflow,
    handleBreadcrumbNavigate: navMocks.handleBreadcrumbNavigate,
  }),
}));

vi.mock('./useWorkflowDesignerInspectActions', () => ({
  useWorkflowDesignerInspectActions: () => ({}),
}));

vi.mock('./useWorkflowEdgeOps', () => ({
  useWorkflowEdgeOps: () => ({
    onConnect: vi.fn(),
    onReconnect: vi.fn(),
  }),
}));

const wf = (): Workflow => ({
  id: 'wf-b',
  name: 'B',
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

const httpNode: WorkflowRFNode = {
  id: 'n1',
  type: 'http',
  position: { x: 0, y: 0 },
  data: { label: 'API', scenario: {} as never, sourceType: 'requests', sourceId: 'x' },
};

const makeDesignerProps = (): WorkflowDesignerProps => ({
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
  selectedEnvId: 'e1',
  selectedSvcId: 's1',
  onEnvSelect: vi.fn(),
  onSvcSelect: vi.fn(),
  resolvedBaseUrl: 'http://localhost',
  previewWorkflow: null,
  onClearPreview: vi.fn(),
  onUseAsTemplate: vi.fn(),
});

const makePartA = (): WorkflowDesignerControllerPartA => {
  const w = wf();
  return {
    workflows: [w],
    selectedWorkflow: w,
    selected: w,
    create: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    previewWorkflow: null,
    onClearPreview: vi.fn(),
    onUseAsTemplate: vi.fn(),
    onRunInHarness: vi.fn(),
    paletteWidth: 200,
    startDrag: vi.fn(),
    nodes: [httpNode],
    setNodes: vi.fn(),
    edges: [],
    setEdges: vi.fn(),
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    layoutVersion: 0,
    setLayoutVersion: vi.fn(),
    laidOutId: null,
    setLaidOutId: vi.fn(),
    nodesRef: { current: [httpNode] },
    edgesRef: { current: [] },
    selectedNodeId: 'n1',
    setSelectedNodeId: vi.fn(),
    showDefaultsModal: false,
    setShowDefaultsModal: vi.fn(),
    nodeStatuses: {},
    setNodeStatuses: vi.fn(),
    lastRunStatus: 'idle',
    setLastRunStatus: vi.fn(),
    lastRunTime: undefined,
    setLastRunTime: vi.fn(),
    lastRunError: null,
    setLastRunError: vi.fn(),
    runVariableSnapshot: null,
    setRunVariableSnapshot: vi.fn(),
    runHistory: [{ stepSummaries: [{ nodeId: 'n1', label: 's', state: 'pass' }] } as never],
    pushRunHistory: vi.fn(),
    restoreRunFromHistory: vi.fn(),
    deleteRunHistoryEntry: vi.fn(),
    clearRunHistory: vi.fn(),
    consoleLines: [],
    pushConsoleLine: vi.fn(),
    clearConsole: vi.fn(),
    consoleOpen: false,
    consoleOpenRef: { current: false },
    consoleRunBehavior: 'continue',
    consoleRunBehaviorRef: { current: 'continue' },
    setConsoleRunBehavior: vi.fn(),
    handleToggleConsole: vi.fn(),
    handleCloseConsole: vi.fn(),
    consoleLinesRef: { current: [] },
    nodeInitialVars: {},
    setNodeInitialVars: vi.fn(),
    nodeInitialVarsRef: { current: {} },
    workflowVariables: { A: '1' },
    setWorkflowVariables: vi.fn(),
    workflowHostProfiles: [],
    setWorkflowHostProfiles: vi.fn(),
    workflowAuthProfiles: [],
    setWorkflowAuthProfiles: vi.fn(),
    workflowServices: [],
    setWorkflowServices: vi.fn(),
    workflowErrorConfig: undefined,
    setWorkflowErrorConfig: vi.fn(),
    serviceRegistryMode: 'closed',
    setServiceRegistryMode: vi.fn(),
    workflowVariablesRef: { current: {} },
    activeRunHistoryId: null,
    setActiveRunHistoryId: vi.fn(),
    nodeCtxMenu: null,
    setNodeCtxMenu: vi.fn(),
    showMinimap: true,
    setShowMinimap: vi.fn(),
    nextNodeYRef: { current: 100 },
    toast: { show: vi.fn(), dismiss: vi.fn() },
    showShortcuts: false,
    setShowShortcuts: vi.fn(),
    showCommandPalette: false,
    setShowCommandPalette: vi.fn(),
    rfInstance: { fitView: vi.fn() } as never,
    undoRedo: { takeSnapshot: vi.fn(), clear: vi.fn() },
    handleQuickTestRef: { current: vi.fn() },
    handleDebugQuickTestRef: { current: vi.fn() },
    serializeNodes: (n) => n as never,
    serializeEdges: (e) => e as never,
    persistWorkflow: vi.fn(),
    insertNodeAndPersist: vi.fn(),
    saveAcknowledged: false,
    handleCopyNode: vi.fn(),
    handlePasteNode: vi.fn(),
    handleDuplicateNode: vi.fn(),
    handleUndoAction: vi.fn(),
    handleRedoAction: vi.fn(),
    handleSave: vi.fn(),
    handleUpdateWorkflowVariables: vi.fn(),
    versioning: { closeVersionPanel: vi.fn() } as WorkflowDesignerControllerPartA['versioning'] & { closeVersionPanel: ReturnType<typeof vi.fn> },
    handleAutoLayout: vi.fn(),
    clipboard: {} as never,
  } as WorkflowDesignerControllerPartA;
};

/** Track functional `setServiceRegistryMode` updates the way React does. */
function makePartATracked(initial: ServiceRegistryMode): {
  tracked: WorkflowDesignerControllerPartA;
  getSrvMode: () => ServiceRegistryMode;
} {
  let srvMode: ServiceRegistryMode = initial;
  const base = makePartA();
  return {
    tracked: {
      ...base,
      serviceRegistryMode: initial,
      setServiceRegistryMode: vi.fn((u: SetStateAction<ServiceRegistryMode>) => {
        srvMode = typeof u === 'function' ? u(srvMode) : u;
      }) as WorkflowDesignerControllerPartA['setServiceRegistryMode'],
    },
    getSrvMode: () => srvMode,
  };
}

describe('useWorkflowDesignerControllerPartB', () => {
  beforeEach(() => {
    resetAllMocks();
    partBMutable.configModalNodeId = null;
    partBMutable.selectedHintNode = null;
  });

  it('creates a new workflow when handleNew receives a name', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    act(() => result.current.handleNew('  My Flow  '));

    expect(a.create).toHaveBeenCalledWith('My Flow');
    expect(props.onClearPreview).toHaveBeenCalled();
  });

  it('handleNew skips create when trimmed name empty', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    act(() => result.current.handleNew('   '));

    expect(a.create).not.toHaveBeenCalled();
  });

  it('handleSelect clears preview and navigates', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    act(() => result.current.handleSelect('wf-b'));

    expect(props.onClearPreview).toHaveBeenCalled();
    expect(navMocks.setNavStack).toHaveBeenCalledWith([]);
    expect(a.select).toHaveBeenCalledWith('wf-b');
  });

  it('handleNodeClick selects node and closes version panel', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    act(() => result.current.handleNodeClick({} as never, httpNode));

    expect(a.setSelectedNodeId).toHaveBeenCalledWith('n1');
    expect(a.versioning.closeVersionPanel).toHaveBeenCalled();
    expect(a.setServiceRegistryMode).toHaveBeenCalled();
  });

  it('handleNodeClick closes service registry panel when it is panel mode', () => {
    const props = makeDesignerProps();
    const { tracked, getSrvMode } = makePartATracked('panel');
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, tracked));

    act(() => result.current.handleNodeClick({} as never, httpNode));

    expect(getSrvMode()).toBe('closed');
  });

  it('handleNodeClick preserves fullscreen service registry mode', () => {
    const props = makeDesignerProps();
    const { tracked, getSrvMode } = makePartATracked('fullscreen');
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, tracked));

    act(() => result.current.handleNodeClick({} as never, httpNode));

    expect(getSrvMode()).toBe('fullscreen');
  });

  it('handlePaneClick clears selection and context menu', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    act(() => result.current.handlePaneClick());

    expect(a.setSelectedNodeId).toHaveBeenCalledWith(null);
    expect(a.setNodeCtxMenu).toHaveBeenCalledWith(null);
  });

  it('handleNodeContextMenu positions menu and selects node', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));
    const ev = { preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 12, clientY: 34 } as unknown as React.MouseEvent;

    act(() => result.current.handleNodeContextMenu(ev, httpNode));

    expect(ev.preventDefault).toHaveBeenCalled();
    expect(a.setSelectedNodeId).toHaveBeenCalledWith('n1');
    expect(a.setNodeCtxMenu).toHaveBeenCalledWith({ x: 12, y: 34, nodeId: 'n1' });
  });

  it('handleServiceRegistryApply syncs labels and persists', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));
    const svc = [{ id: 'svc', label: 'API', baseUrlKey: '', authProfileId: '', microserviceId: '' } as never];

    act(() => result.current.handleServiceRegistryApply(svc));

    expect(a.setWorkflowServices).toHaveBeenCalledWith(svc);
    expect(a.setNodes).toHaveBeenCalled();
    expect(a.persistWorkflow).toHaveBeenCalled();
  });

  it('exposes drag/drop and react-flow init from delegated hooks', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(dragDropStub).toHaveBeenCalled();
    expect(reactFlowInitStub).toHaveBeenCalledWith(null, a.setLaidOutId);
    expect(result.current.handleCanvasDragOver).toBeDefined();
    expect(result.current.handleReactFlowInit).toBeDefined();
  });

  it('computes variableCount and latestStepSummaries', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(result.current.latestStepSummaries.length).toBeGreaterThan(0);
    expect(result.current.variableCount).toBeGreaterThanOrEqual(0);
  });

  it('effectiveQuickTestBaseUrl prefers resolver value for HTTP selections', () => {
    partBMutable.selectedHintNode = httpNode;
    resolveHttpNodeBaseUrlSpy.mockReturnValue('https://custom-http');
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(result.current.effectiveQuickTestBaseUrl).toBe('https://custom-http');
    expect(resolveHttpNodeBaseUrlSpy).toHaveBeenCalled();
  });

  it('effectiveQuickTestBaseUrl falls back when resolver yields no URL', () => {
    partBMutable.selectedHintNode = httpNode;
    resolveHttpNodeBaseUrlSpy.mockReturnValue(undefined);
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(result.current.effectiveQuickTestBaseUrl).toBe('http://localhost');
  });

  it('effectiveQuickTestBaseUrl uses harness resolved URL without HTTP hints', () => {
    partBMutable.selectedHintNode = null;
    resolveHttpNodeBaseUrlSpy.mockClear();
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(result.current.effectiveQuickTestBaseUrl).toBe(props.resolvedBaseUrl);
    expect(resolveHttpNodeBaseUrlSpy).not.toHaveBeenCalled();
  });

  it('latestStepSummaries is empty without run history', () => {
    const props = makeDesignerProps();
    const a = { ...makePartA(), runHistory: [] satisfies WorkflowDesignerControllerPartA['runHistory'] };
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(result.current.latestStepSummaries).toEqual([]);
  });

  it('latestStepSummaries falls back when head entry has no summaries', () => {
    type H = WorkflowDesignerControllerPartA['runHistory'];
    const props = makeDesignerProps();
    const blankHead = {} as H extends Array<infer E> ? E : never;
    const a = { ...makePartA(), runHistory: [blankHead] };
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(result.current.latestStepSummaries).toEqual([]);
  });

  it('returns null configModalNode when modal id misses canvas nodes', () => {
    partBMutable.configModalNodeId = 'missing-id';
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(result.current.configModalNode).toBe(null);
  });

  it('resolves configModalNode by enriching the modal target node', () => {
    partBMutable.configModalNodeId = httpNode.id;
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(result.current.configModalNode).toEqual(enrichNodeData(httpNode, a.nodeInitialVars));
  });

  it('builds failure report when last run failed', () => {
    const reportSpy = vi.spyOn(workflowRunErrors, 'buildQuickTestFailureReport');
    const props = makeDesignerProps();
    const runEntry = {
      stepSummaries: [{ nodeId: 'n1', label: 'HTTP', state: 'fail' as const, error: '500' }],
      variableSnapshot: { token: 'abc' },
      durationMs: 1200,
      error: 'HTTP 500',
    };
    const a = {
      ...makePartA(),
      lastRunStatus: 'fail' as const,
      lastRunError: 'HTTP 500',
      runHistory: [runEntry],
    };
    renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    expect(reportSpy).toHaveBeenCalledWith(
      undefined,
      runEntry.stepSummaries,
      expect.any(Object),
      runEntry.durationMs,
      runEntry.error,
    );
    reportSpy.mockRestore();
  });

  // ── HAR import handlers ───────────────────────────────────────────────────

  it('handleHarFileParsed stores parse result and file name, opening the modal', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    const fakeResult = { entries: [], globalWarnings: [], filteredCount: 0, trackingFilteredCount: 0, dedupedCount: 0 };

    act(() => result.current.handleHarFileParsed(fakeResult as never, 'test.har'));

    expect(result.current.harParseResult).toEqual(fakeResult);
    expect(result.current.harFileName).toBe('test.har');
  });

  it('handleHarImportClose clears parse result and file name', () => {
    const props = makeDesignerProps();
    const a = makePartA();
    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    const fakeResult = { entries: [], globalWarnings: [], filteredCount: 0, trackingFilteredCount: 0, dedupedCount: 0 };

    act(() => result.current.handleHarFileParsed(fakeResult as never, 'test.har'));
    expect(result.current.harParseResult).not.toBeNull();

    act(() => result.current.handleHarImportClose());

    expect(result.current.harParseResult).toBeNull();
    expect(result.current.harFileName).toBe('');
  });

  it('handleHarImport creates and updates a new workflow with HAR nodes', () => {
    vi.useFakeTimers();
    const props = makeDesignerProps();
    const a = makePartA();
    const mockCreate = vi.fn(() => ({ id: 'new-wf', name: 'test', nodes: [], edges: [], variables: {}, schemaVersion: 6, services: [], hostProfiles: [], authProfiles: [], createdAt: 0, updatedAt: 0 }));
    a.create = mockCreate;
    const fitView = vi.fn();
    a.rfInstance = { fitView } as never;

    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    act(() => result.current.handleHarImport([], 'My HAR Workflow'));

    expect(mockCreate).toHaveBeenCalledWith('My HAR Workflow');
    expect(a.update).toHaveBeenCalledWith('new-wf', expect.objectContaining({ nodes: expect.any(Array), edges: expect.any(Array), variables: expect.any(Object) }));
    expect(a.select).toHaveBeenCalledWith('new-wf');
    expect(result.current.harParseResult).toBeNull();
    act(() => { vi.advanceTimersByTime(180); });
    expect(fitView).toHaveBeenCalledWith({ padding: 0.15, maxZoom: 1, minZoom: 0.4, duration: 300 });
    vi.useRealTimers();
  });

  it('handleHarImport updates an existing workflow with the same name instead of duplicating', () => {
    vi.useFakeTimers();
    const props = makeDesignerProps();
    const a = makePartA();
    a.workflows = [{
      id: 'existing-har',
      name: 'My HAR Workflow',
      nodes: [],
      edges: [],
      variables: {},
      schemaVersion: 6,
      services: [],
      hostProfiles: [],
      authProfiles: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    const mockCreate = vi.fn();
    a.create = mockCreate;

    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    act(() => result.current.handleHarImport([], 'My HAR Workflow'));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(a.update).toHaveBeenCalledWith('existing-har', expect.objectContaining({
      nodes: expect.any(Array),
      edges: expect.any(Array),
      variables: expect.any(Object),
    }));
    expect(a.select).toHaveBeenCalledWith('existing-har');
    act(() => { vi.runAllTimers(); });
    vi.useRealTimers();
  });

  it('handleHarImport falls back to "HAR import" when workflowName is whitespace', () => {
    vi.useFakeTimers();
    const props = makeDesignerProps();
    const a = makePartA();
    const mockCreate = vi.fn(() => ({ id: 'new-wf', name: 'HAR import', nodes: [], edges: [], variables: {}, schemaVersion: 6, services: [], hostProfiles: [], authProfiles: [], createdAt: 0, updatedAt: 0 }));
    a.create = mockCreate;

    const { result } = renderHook(() => useWorkflowDesignerControllerPartB(props, a));

    act(() => result.current.handleHarImport([], '   '));

    expect(mockCreate).toHaveBeenCalledWith('HAR import');
    act(() => { vi.runAllTimers(); });
    vi.useRealTimers();
  });
});
