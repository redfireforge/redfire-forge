/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { WF } from '@shared/selectors';
import {
  LESSON18_WF_NAME,
  LESSON18_NODE_CREATE,
  LESSON18_NODE_DELETE,
  LESSON18_DELETE_MUTATION,
  LESSON18_DELETE_VARS,
  GQL_DEMO_HTTP,
  createGqlMutationDemoWorkflow,
  createGqlMutationBlankWorkflow,
  resetGqlLesson18SessionFlags,
  gqlWorkflowMutationLessonSetup,
  gqlWorkflowMutationLessonCleanup,
  ensureLesson18WorkflowCreated,
  ensureLesson18WorkflowLoaded,
  isLesson18WorkflowActive,
  ensureLesson18MutationNodeAdded,
  ensureLesson18MutationConfigured,
  ensureLesson18MutationOutputBound,
  ensureLesson18QueryConfigured,
  ensureLesson18AssertConfigured,
  ensureLesson18QuickTestRun,
  ensureLesson18DeleteNodeAdded,
  prepareLesson18BeforeDeleteNode,
  prepareLesson18BeforeFinalQuickTest,
  ensureLesson18FinalQuickTestRun,
  ensureLesson18DeleteConfigured,
  resolveLesson18CreateNodeId,
  resolveLesson18DeleteNodeId,
  isLesson18DeleteNodeReady,
  selectGqlMutationDemoWorkflow,
} from './lesson18-workflow-mutation';
import {
  getWfConfigDemoTiming,
  setWfConfigDemoTiming,
  WF_CONFIG_DEMO_TIMING,
  WF_CONFIG_DEMO_TIMING_BRISK,
} from '../../wf-demo-helpers';

function seedLesson18WorkflowBridge(): void {
  (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
    name === LESSON18_WF_NAME ? createGqlMutationDemoWorkflow() : null;
}

describe('lesson18-workflow-mutation helpers (direct)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson18SessionFlags();
  });

  afterEach(() => {
    setWfConfigDemoTiming(null);
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
    delete (window as unknown as Record<string, unknown>).__wfGetWorkflowByName;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
    delete (window as unknown as Record<string, unknown>).__wfConnect;
    delete (window as unknown as Record<string, unknown>).__wfAddNode;
    delete (window as unknown as Record<string, unknown>).__wfPatchNodeDataById;
  });

  it('selectGqlMutationDemoWorkflow no-ops click when sidebar has no match', async () => {
    document.body.innerHTML = '<div class="wf-sidebar-item">Other Workflow</div>';
    const ctx = makeCtx();
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectGqlMutationDemoWorkflow(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('isLesson18WorkflowActive is false when canvas shows a different workflow', () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item active"><span class="wf-sidebar-item-name">Other Workflow</span></div>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON18_WF_NAME ? createGqlMutationBlankWorkflow() : null;
    expect(isLesson18WorkflowActive()).toBe(false);
  });

  it('isLesson18WorkflowActive is true when lesson workflow is selected in sidebar', () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item active"><span class="wf-sidebar-item-name">${LESSON18_WF_NAME}</span></div>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON18_WF_NAME ? createGqlMutationBlankWorkflow() : null;
    expect(isLesson18WorkflowActive()).toBe(true);
  });

  it('ensureLesson18WorkflowCreated opens New dialog when another workflow canvas is visible', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item active"><span class="wf-sidebar-item-name">Other Workflow</span></div>
      <button data-testid="wf-sidebar-new-btn" title="New workflow"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item" class="wf-new-dropdown-item"></button>
      <input data-testid="wf-create-input" class="req-confirm-input" />
      <button data-testid="wf-create-ok" class="req-confirm-ok"></button>
      <button title="Fit view"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => null;
    const ctx = makeCtx();
    await ensureLesson18WorkflowCreated(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.SIDEBAR_NEW_BTN);
  });

  it('ensureLesson18WorkflowLoaded skips recreate when lesson workflow is already active', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item active"><span class="wf-sidebar-item-name">${LESSON18_WF_NAME}</span></div>
      <button title="Fit view"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON18_WF_NAME ? createGqlMutationBlankWorkflow() : null;
    const ctx = makeCtx();
    await ensureLesson18WorkflowLoaded(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson18WorkflowLoaded(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.SIDEBAR_NEW_BTN);
  });

  it('ensureLesson18MutationNodeAdded wires Start using UI-generated start node id', async () => {
    const uiStartId = 'ui-start-abc';
    const wf = createGqlMutationBlankWorkflow();
    wf.nodes = [
      {
        id: uiStartId,
        type: 'start',
        position: { x: 100, y: 150 },
        data: { label: 'Start', inputVariables: {} },
      },
      ...(wf.nodes as Array<{ id: string; type: string }>).filter((n) => n.type === 'end'),
    ];
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON18_WF_NAME ? wf : null;
    const connectSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = connectSpy;
    (window as unknown as Record<string, unknown>).__wfAddNode = vi.fn(() => LESSON18_NODE_CREATE);

    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item active"><span class="wf-sidebar-item-name">${LESSON18_WF_NAME}</span></div>
      <div class="react-flow__node-start" data-id="${uiStartId}"></div>
      <div class="react-flow__node-graphqlMutation" data-id="${LESSON18_NODE_CREATE}"></div>
      <button class="wf-palette-block-graphqlMutation"></button>
      <button title="Fit view"></button>
    `;
    const ctx = makeCtx();
    await ensureLesson18MutationNodeAdded(ctx);
    expect(connectSpy).toHaveBeenCalledWith(uiStartId, LESSON18_NODE_CREATE, 'out', null);
  });

  it('ensureLesson18MutationNodeAdded does not preset-add after palette click places a node', async () => {
    const uiStartId = 'ui-start-abc';
    const paletteMutationId = 'ui-mutation-xyz';
    const wf = createGqlMutationBlankWorkflow();
    wf.nodes = [
      {
        id: uiStartId,
        type: 'start',
        position: { x: 100, y: 150 },
        data: { label: 'Start', inputVariables: {} },
      },
      ...(wf.nodes as Array<{ id: string; type: string }>).filter((n) => n.type === 'end'),
    ];
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON18_WF_NAME ? wf : null;
    const connectSpy = vi.fn();
    const addSpy = vi.fn(() => LESSON18_NODE_CREATE);
    const patchSpy = vi.fn((id: string, patch: Record<string, unknown>) => {
      const node = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === id);
      if (node) node.data = { ...node.data, ...patch };
      return true;
    });
    (window as unknown as Record<string, unknown>).__wfConnect = connectSpy;
    (window as unknown as Record<string, unknown>).__wfAddNode = addSpy;
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataById = patchSpy;

    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item active"><span class="wf-sidebar-item-name">${LESSON18_WF_NAME}</span></div>
      <div class="react-flow__node-start" data-id="${uiStartId}"></div>
      <input class="wf-palette-search" />
      <button class="wf-palette-block-graphqlMutation"></button>
      <button title="Fit view"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (String(sel).includes('graphqlMutation')) {
        (wf.nodes as Array<Record<string, unknown>>).push({
          id: paletteMutationId,
          type: 'graphqlMutation',
          position: { x: 280, y: 150 },
          data: { label: 'GraphQL Mutation' },
        });
        document.body.insertAdjacentHTML(
          'beforeend',
          `<div class="react-flow__node-graphqlMutation" data-id="${paletteMutationId}">GraphQL Mutation</div>`,
        );
      }
    });

    await ensureLesson18MutationNodeAdded(ctx);

    expect(addSpy).not.toHaveBeenCalled();
    expect(patchSpy).toHaveBeenCalledWith(paletteMutationId, { label: 'Create User' });
    expect(connectSpy).toHaveBeenCalledWith(uiStartId, paletteMutationId, 'out', null);
    expect(document.querySelectorAll('.react-flow__node-graphqlMutation')).toHaveLength(1);
  });

  it('ensureLesson18MutationConfigured skips on second call', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div data-testid="gql-wf-mutation-panel">
        <button class="wf-config-tab">Variables</button>
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    const ctx = makeCtx();
    await ensureLesson18MutationConfigured(ctx);
    seedLesson18WorkflowBridge();
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson18MutationConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson18MutationOutputBound skips when flag already set', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div data-testid="gql-wf-mutation-panel">
        <button class="wf-config-tab">Extraction</button>
        <input data-testid="gql-wf-extraction-jsonpath" />
        <input data-testid="gql-wf-extraction-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    const ctx = makeCtx();
    await ensureLesson18MutationConfigured(ctx);
    await ensureLesson18MutationOutputBound(ctx);
    seedLesson18WorkflowBridge();
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson18MutationOutputBound(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson18QueryConfigured skips when flag already set', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div data-testid="gql-wf-mutation-panel">
        <button class="wf-config-tab">Extraction</button>
        <input data-testid="gql-wf-extraction-jsonpath" />
        <input data-testid="gql-wf-extraction-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-query-panel">
        <button class="wf-config-tab">Output</button>
        <select data-testid="gql-wf-output-field-select"></select>
        <input data-testid="gql-wf-output-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    const ctx = makeCtx();
    await ensureLesson18MutationOutputBound(ctx);
    await ensureLesson18QueryConfigured(ctx);
    seedLesson18WorkflowBridge();
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson18QueryConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson18AssertConfigured skips when flag already set', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div data-testid="gql-wf-mutation-panel">
        <button class="wf-config-tab">Extraction</button>
        <input data-testid="gql-wf-extraction-jsonpath" />
        <input data-testid="gql-wf-extraction-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-query-panel">
        <button class="wf-config-tab">Output</button>
        <select data-testid="gql-wf-output-field-select"></select>
        <input data-testid="gql-wf-output-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-assert-panel">
        <button class="wf-config-tab">Assertions</button>
        <div data-testid="gql-wf-assert-row">
          <input data-testid="gql-wf-assert-jsonpath" />
          <select data-testid="gql-wf-assert-operator"></select>
        </div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    const ctx = makeCtx();
    await ensureLesson18QueryConfigured(ctx);
    await ensureLesson18AssertConfigured(ctx);
    seedLesson18WorkflowBridge();
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson18AssertConfigured(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureLesson18QuickTestRun skips when prior quick test passed', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div data-testid="gql-wf-assert-panel">
        <button class="wf-config-tab">Assertions</button>
        <div data-testid="gql-wf-assert-row"></div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-query-panel">
        <button class="wf-config-tab">Output</button>
        <select data-testid="gql-wf-output-field-select"></select>
        <input data-testid="gql-wf-output-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-mutation-panel">
        <button class="wf-config-tab">Extraction</button>
        <input data-testid="gql-wf-extraction-jsonpath" />
        <input data-testid="gql-wf-extraction-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="exec-summary" class="wf-exec-strip wf-exec-strip-pass"></div>
      <button class="wf-quick-test-btn"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => createGqlMutationDemoWorkflow();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    const ctx = makeCtx();
    await ensureLesson18AssertConfigured(ctx);
    await ensureLesson18QuickTestRun(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson18QuickTestRun(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('ensureLesson18DeleteNodeAdded uses palette fallback when __wfAddNode missing', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div data-testid="exec-summary"></div>
      <button class="wf-quick-test-btn"></button>
      <button class="wf-palette-block-graphqlMutation"></button>
      <div data-testid="gql-wf-mutation-panel">
        <button class="wf-config-tab">Variables</button>
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-query-panel">
        <button class="wf-config-tab">Output</button>
        <select data-testid="gql-wf-output-field-select"></select>
        <input data-testid="gql-wf-output-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-assert-panel">
        <button class="wf-config-tab">Assertions</button>
        <div data-testid="gql-wf-assert-row"></div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => createGqlMutationDemoWorkflow();
    await ensureLesson18AssertConfigured(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson18DeleteNodeAdded(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_MUTATION);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('ensureLesson18DeleteNodeAdded does not run Quick Test', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div data-testid="exec-summary" class="wf-exec-strip wf-exec-strip-pass"></div>
      <button class="wf-quick-test-btn"></button>
      <button class="wf-palette-block-graphqlMutation"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => createGqlMutationDemoWorkflow();
    (window as unknown as Record<string, unknown>).__wfAddNode = vi.fn(() => true);
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson18DeleteNodeAdded(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('resolveLesson18DeleteNodeId prefers preset id then extra mutation node', () => {
    const wf = createGqlMutationDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown> }>;
    expect(resolveLesson18DeleteNodeId(nodes)).toBe(LESSON18_NODE_DELETE);

    nodes.push({
      id: LESSON18_NODE_DELETE,
      type: 'graphqlMutation',
      data: { label: 'Delete User', query: LESSON18_DELETE_MUTATION },
    });
    expect(resolveLesson18DeleteNodeId(nodes)).toBe(LESSON18_NODE_DELETE);

    nodes.push({
      id: 'palette-delete',
      type: 'graphqlMutation',
      data: { label: 'Delete User', query: LESSON18_DELETE_MUTATION },
    });
    expect(resolveLesson18DeleteNodeId(nodes)).toBe(LESSON18_NODE_DELETE);

    const withoutPreset = nodes.filter((n) => n.id !== LESSON18_NODE_DELETE);
    expect(resolveLesson18DeleteNodeId(withoutPreset)).toBe('palette-delete');
  });

  it('resolveLesson18CreateNodeId adopts palette-added create mutation id', () => {
    const nodes = [
      { id: 'ui-start', type: 'start', data: { label: 'Start' } },
      { id: 'ui-create', type: 'graphqlMutation', data: { label: 'Create User' } },
      { id: 'ui-end', type: 'end', data: { label: 'End' } },
    ];
    expect(resolveLesson18CreateNodeId(nodes)).toBe('ui-create');
    expect(resolveLesson18DeleteNodeId(nodes)).toBe(LESSON18_NODE_DELETE);
  });

  it('isLesson18DeleteNodeReady reads delete node by resolved id', () => {
    const wf = createGqlMutationDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown> }>;
    nodes.push({
      id: 'palette-delete',
      type: 'graphqlMutation',
      data: {
        endpoint: GQL_DEMO_HTTP,
        query: LESSON18_DELETE_MUTATION,
        variables: LESSON18_DELETE_VARS,
      },
    });
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => ({ ...wf, nodes });
    expect(isLesson18DeleteNodeReady()).toBe(true);
  });

  it('ensureLesson18DeleteNodeAdded skips when delete node ready and final quick test already ran', async () => {
    const wf = createGqlMutationDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown>; position: { x: number; y: number } }>;
    nodes.push({
      id: LESSON18_NODE_DELETE,
      type: 'graphqlMutation',
      position: { x: 780, y: 280 },
      data: {
        label: 'Delete User',
        endpoint: GQL_DEMO_HTTP,
        query: LESSON18_DELETE_MUTATION,
        variables: LESSON18_DELETE_VARS,
      },
    });
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="react-flow__node" data-id="${LESSON18_NODE_DELETE}"></div>
      <div data-testid="exec-summary" class="wf-exec-strip wf-exec-strip-pass"></div>
      <button class="wf-quick-test-btn"></button>
    `;
    const addNode = vi.fn();
    (window as unknown as Record<string, unknown>).__wfAddNode = addNode;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON18_WF_NAME ? wf : null;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson18DeleteNodeAdded(ctx);
    addNode.mockClear();
    vi.mocked(ctx.click).mockClear();
    await ensureLesson18DeleteNodeAdded(ctx);
    expect(addNode).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('prepareLesson18BeforeDeleteNode does not click Quick Test', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div data-testid="exec-summary" class="wf-exec-strip wf-exec-strip-pass"></div>
      <button class="wf-quick-test-btn"></button>
      <div data-testid="gql-wf-assert-panel">
        <button class="wf-config-tab">Assertions</button>
        <div data-testid="gql-wf-assert-row"></div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => createGqlMutationDemoWorkflow();
    const ctx = makeCtx();
    await prepareLesson18BeforeDeleteNode(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('prepareLesson18BeforeFinalQuickTest does not fit view (runLesson18QuickTest centers once)', async () => {
    const wf = createGqlMutationDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown>; position: { x: number; y: number } }>;
    nodes.push({
      id: LESSON18_NODE_DELETE,
      type: 'graphqlMutation',
      position: { x: 780, y: 280 },
      data: {
        label: 'Delete User',
        endpoint: GQL_DEMO_HTTP,
        query: LESSON18_DELETE_MUTATION,
        variables: LESSON18_DELETE_VARS,
      },
    });
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="react-flow__node" data-id="${LESSON18_NODE_DELETE}"></div>
      <div data-testid="exec-summary"></div>
      <button title="Fit view"></button>
      <button class="wf-quick-test-btn"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    const fitBtn = document.querySelector('button[title="Fit view"]')!;
    const fitSpy = vi.spyOn(fitBtn, 'click');
    const ctx = makeCtx();
    await ensureLesson18DeleteConfigured(ctx);
    fitSpy.mockClear();
    await prepareLesson18BeforeFinalQuickTest(ctx);
    expect(fitSpy).not.toHaveBeenCalled();
  });

  it('ensureLesson18FinalQuickTestRun fits view once before Quick Test', async () => {
    const wf = createGqlMutationDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown>; position: { x: number; y: number } }>;
    nodes.push({
      id: LESSON18_NODE_DELETE,
      type: 'graphqlMutation',
      position: { x: 780, y: 280 },
      data: {
        label: 'Delete User',
        endpoint: GQL_DEMO_HTTP,
        query: LESSON18_DELETE_MUTATION,
        variables: LESSON18_DELETE_VARS,
      },
    });
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="react-flow__node" data-id="${LESSON18_NODE_DELETE}"></div>
      <div data-testid="exec-summary"></div>
      <button title="Fit view"></button>
      <button class="wf-quick-test-btn"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    const fitBtn = document.querySelector('button[title="Fit view"]')!;
    const fitSpy = vi.spyOn(fitBtn, 'click');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson18FinalQuickTestRun(ctx);
    expect(fitSpy).toHaveBeenCalledTimes(1);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('gqlWorkflowMutationLessonSetup runs without workflow bridges', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item">${LESSON18_WF_NAME}</div>
      <button title="Fit view"></button>
    `;
    const ctx = makeCtx();
    await gqlWorkflowMutationLessonSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
    expect(getWfConfigDemoTiming()).toEqual(WF_CONFIG_DEMO_TIMING_BRISK);
  });

  it('gqlWorkflowMutationLessonCleanup restores default config timing', async () => {
    setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
    const ctx = makeCtx();
    await gqlWorkflowMutationLessonCleanup(ctx);
    expect(getWfConfigDemoTiming()).toEqual(WF_CONFIG_DEMO_TIMING);
  });

  it('openWfNodeConfigModal falls back to dblclick on data-id node when bridge missing', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="react-flow__node" data-id="${LESSON18_NODE_CREATE}"></div>
      <div data-testid="gql-wf-mutation-panel">
        <button class="wf-config-tab">Variables</button>
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
    `;
    const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${LESSON18_NODE_CREATE}"]`)!;
    const dispatchSpy = vi.spyOn(node, 'dispatchEvent');
    const ctx = makeCtx();
    await ensureLesson18WorkflowLoaded(ctx);
    await ensureLesson18MutationConfigured(ctx);
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
