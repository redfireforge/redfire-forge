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
  resetGqlLesson18SessionFlags,
  gqlWorkflowMutationLessonSetup,
  ensureLesson18WorkflowLoaded,
  ensureLesson18MutationConfigured,
  ensureLesson18MutationOutputBound,
  ensureLesson18QueryConfigured,
  ensureLesson18AssertConfigured,
  ensureLesson18QuickTestRun,
  ensureLesson18DeleteNodeAdded,
  resolveLesson18DeleteNodeId,
  isLesson18DeleteNodeReady,
  selectGqlMutationDemoWorkflow,
} from './lesson18-workflow-mutation';

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
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
    delete (window as unknown as Record<string, unknown>).__wfGetWorkflowByName;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
    delete (window as unknown as Record<string, unknown>).__wfConnect;
    delete (window as unknown as Record<string, unknown>).__wfAddNode;
  });

  it('selectGqlMutationDemoWorkflow no-ops click when sidebar has no match', async () => {
    document.body.innerHTML = '<div class="wf-sidebar-item">Other Workflow</div>';
    const ctx = makeCtx();
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectGqlMutationDemoWorkflow(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureLesson18WorkflowLoaded skips navigation when canvas already present', async () => {
    document.body.innerHTML = '<div class="wf-canvas-area"></div>';
    const ctx = makeCtx();
    await ensureLesson18WorkflowLoaded(ctx);
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson18WorkflowLoaded(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
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
    await ensureLesson18QuickTestRun(ctx);
    await ensureLesson18DeleteNodeAdded(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_MUTATION);
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

  it('gqlWorkflowMutationLessonSetup runs without workflow bridges', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item">${LESSON18_WF_NAME}</div>
      <button title="Fit view"></button>
    `;
    const ctx = makeCtx();
    await gqlWorkflowMutationLessonSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
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
