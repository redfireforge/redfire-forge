/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlWorkflowMutationLesson } from './graphql-workflow-mutation';
import { makeCtx } from './ws-test-utils';
import { GQL, WF } from '@shared/selectors';
import {
  LESSON18_WF_NAME,
  LESSON18_TEST_NAME,
  LESSON18_TEST_NAME_VAR,
  LESSON18_CREATED_USER_ID_VAR,
  LESSON18_FETCHED_USER_VAR,
  LESSON18_CREATE_MUTATION,
  LESSON18_MUTATION_VARS,
  LESSON18_GET_USER_QUERY,
  LESSON18_QUERY_VARS,
  LESSON18_DELETE_MUTATION,
  LESSON18_EXTRACTION_JSONPATH,
  LESSON18_NODE_CREATE,
  LESSON18_NODE_FETCH,
  LESSON18_NODE_ASSERT,
  LESSON18_NODE_DELETE,
  LESSON18_NODE_END,
  GQL_DEMO_HTTP,
  isLesson18FetchNodeReady,
  resolveLesson18DeleteNodeId,
  isLesson18DeleteNodeReady,
  resetGqlLesson18SessionFlags,
  createGqlMutationBlankWorkflow,
  createGqlMutationDemoWorkflow,
  gqlWorkflowMutationLessonSetup,
  gqlWorkflowMutationLessonCleanup,
  ensureLesson18WorkflowCreated,
  ensureLesson18WorkflowLoaded,
  ensureLesson18MutationConfigured,
  ensureLesson18QueryConfigured,
  ensureLesson18AssertConfigured,
  ensureLesson18DeleteNodeAdded,
  demonstrateLesson18DeleteNodeAdded,
} from './graphql-lesson-helpers';
import {
  handleGraphqlQueryNode,
  handleGraphqlAssertNode,
} from '@workflow/engine/graphRunnerGraphqlNodeHandlers';
import {
  makeNode,
  makeCallbacks,
  makeHandlerContext,
  makePassedFlag,
} from '@workflow/engine/graphRunnerNodeHandlers.test-utils';

vi.mock('@graphql/utils/graphqlProxyTransports', () => ({
  getProxyBase: vi.fn(() => 'http://localhost:4000'),
  createWsProxyTransport: vi.fn(),
  createSseProxyTransport: vi.fn(),
}));

vi.mock('@graphql/utils/authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({})),
}));

describe('gql-workflow-mutation lesson', () => {
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

  // ── Lesson structure ──────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlWorkflowMutationLesson.id).toBe('gql-workflow-mutation');
    expect(gqlWorkflowMutationLesson.category).toBe('graphql');
    expect(gqlWorkflowMutationLesson.name).toBe('Mutation Node in Workflow');
    expect(gqlWorkflowMutationLesson.steps.length).toBe(15);
    expect(gqlWorkflowMutationLesson.estimatedMinutes).toBe(8);
  });

  it('starts at workflow tab', () => {
    expect(gqlWorkflowMutationLesson.initialTab).toBe('workflow');
    expect(gqlWorkflowMutationLesson.allowedTabs).toContain('workflow');
  });

  it('has correct step IDs in order', () => {
    expect(gqlWorkflowMutationLesson.steps.map((s) => s.id)).toEqual([
      'gql18-intro',
      'gql18-create',
      'gql18-add-mutation',
      'gql18-config-mutation',
      'gql18-bind-extraction',
      'gql18-add-query',
      'gql18-config-query',
      'gql18-bind-query-output',
      'gql18-add-assert',
      'gql18-assert-source',
      'gql18-assert-rule',
      'gql18-quick-test',
      'gql18-add-delete',
      'gql18-config-delete',
      'gql18-final-run',
    ]);
  });

  it('all 15 steps have pauseAfter: true', () => {
    gqlWorkflowMutationLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('uses Docker GraphQL test server', () => {
    expect(gqlWorkflowMutationLesson.dockerEndpoint).toContain('4010');
    expect(gqlWorkflowMutationLesson.dockerCommand).toContain('docker/graphql');
    expect(gqlWorkflowMutationLesson.tag).toBe('🐳 Docker');
  });

  // ── Concept content ───────────────────────────────────────────────────────

  it('concept title frames mutation write-bind-verify-teardown pattern', () => {
    expect(gqlWorkflowMutationLesson.concept.title).toContain('Mutation');
    expect(gqlWorkflowMutationLesson.concept.title).toContain('Teardown');
  });

  it('concept body explains WHY dedicated Mutation node', () => {
    expect(gqlWorkflowMutationLesson.concept.body).toContain('Mutation node');
    expect(gqlWorkflowMutationLesson.concept.body).toContain('amber');
  });

  it('concept body explains WHY bind returned ID', () => {
    expect(gqlWorkflowMutationLesson.concept.body).toContain(LESSON18_CREATED_USER_ID_VAR);
    expect(gqlWorkflowMutationLesson.concept.body).toContain('Extraction');
  });

  it('concept body explains WHY read-back query', () => {
    expect(gqlWorkflowMutationLesson.concept.body).toContain('persisted');
  });

  it('concept body explains WHY teardown', () => {
    expect(gqlWorkflowMutationLesson.concept.body).toContain('deleteUser');
    expect(gqlWorkflowMutationLesson.concept.body).toContain('clean');
  });

  it('has 5 key terms including Teardown mutation', () => {
    expect(gqlWorkflowMutationLesson.concept.keyTerms.length).toBe(5);
    const terms = gqlWorkflowMutationLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('GraphQL Mutation node');
    expect(terms).toContain('Extraction rule');
    expect(terms).toContain('Read-back query');
    expect(terms).toContain('Variable flow');
    expect(terms).toContain('Teardown mutation');
  });

  // ── Diagram ───────────────────────────────────────────────────────────────

  it('concept diagram is a 700x430 SVG', () => {
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram shows GraphQL Mutation palette block highlighted', () => {
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('GraphQL Mutation');
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('Write operations');
  });

  it('diagram shows all four workflow nodes on canvas', () => {
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('Create User');
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('Fetch User');
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('Verify User');
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('Delete User');
  });

  it('diagram shows variable flow annotation', () => {
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('Variable flow');
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('createdUserId');
  });

  it('diagram shows Quick Test button and Console log', () => {
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('Quick Test');
    expect(gqlWorkflowMutationLesson.concept.diagram).toContain('Console');
  });

  // ── Step spotlights & verify selectors ───────────────────────────────────

  it('gql18-intro highlights mutation palette block', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-intro')!;
    expect(step.highlight).toBe(WF.PAL_GQL_MUTATION);
  });

  it('gql18-create highlights new workflow button', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-create')!;
    expect(step.highlight).toBe(WF.SIDEBAR_NEW_BTN);
  });

  it('gql18-add-mutation highlights mutation palette and verifies mutation node', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-add-mutation')!;
    expect(step.highlight).toBe(WF.PAL_GQL_MUTATION);
    expect(step.verify).toBe(GQL.WF_CANVAS_MUTATION_NODE);
  });

  it('gql18-config-mutation highlights mutation panel', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-mutation')!;
    expect(step.highlight).toBe(GQL.WF_MUTATION_PANEL);
  });

  it('gql18-bind-extraction highlights extraction table', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-bind-extraction')!;
    expect(step.highlight).toBe(GQL.WF_EXTRACTION_TABLE);
  });

  it('gql18-add-query highlights query palette', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-add-query')!;
    expect(step.highlight).toBe(WF.PAL_GQL_QUERY);
  });

  it('gql18-config-query highlights query panel', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-query')!;
    expect(step.highlight).toBe(GQL.WF_QUERY_PANEL);
  });

  it('gql18-bind-query-output highlights output table', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-bind-query-output')!;
    expect(step.highlight).toBe(GQL.WF_OUTPUT_TABLE);
  });

  it('gql18-add-assert highlights assert palette', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-add-assert')!;
    expect(step.highlight).toBe(WF.PAL_GQL_ASSERT);
  });

  it('gql18-assert-source highlights assert panel', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-assert-source')!;
    expect(step.highlight).toBe(GQL.WF_ASSERT_PANEL);
  });

  it('gql18-assert-rule highlights assert row', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-assert-rule')!;
    expect(step.highlight).toBe(GQL.WF_ASSERT_ROW);
  });

  it('gql18-quick-test highlights Quick Test button and verifies exec summary', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-quick-test')!;
    expect(step.highlight).toBe(WF.QUICK_TEST_BTN);
    expect(step.verify).toBe(WF.EXEC_SUMMARY);
  });

  it('gql18-add-delete highlights mutation palette for teardown node', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-add-delete')!;
    expect(step.highlight).toBe(WF.PAL_GQL_MUTATION);
    expect(step.verify).toBe(`.react-flow__node[data-id="${LESSON18_NODE_DELETE}"]`);
  });

  it('gql18-config-delete highlights mutation panel for delete config', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-delete')!;
    expect(step.highlight).toBe(GQL.WF_MUTATION_PANEL);
    expect(step.verify).toBe(GQL.WF_MUTATION_PANEL);
  });

  it('gql18-final-run highlights Quick Test for teardown run', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-final-run')!;
    expect(step.highlight).toBe(WF.QUICK_TEST_BTN);
    expect(step.verify).toBe(WF.EXEC_SUMMARY);
  });

  // ── Step descriptions — WHY framing ──────────────────────────────────────

  it('gql18-intro description explains blank-canvas build and GQL-16 prerequisite', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-intro')!;
    expect(step.description).toContain('Mutation node');
    expect(step.description).toContain('GQL-16');
    expect(step.description).toContain('blank canvas');
  });

  it('gql18-create description explains blank workflow', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-create')!;
    expect(step.description).toContain('Blank Workflow');
    expect(step.description).toContain(LESSON18_WF_NAME);
  });

  it('gql18-add-mutation description explains palette add and wiring', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-add-mutation')!;
    expect(step.description).toContain('GraphQL Mutation');
    expect(step.description).toContain('Start');
  });

  it('gql18-config-mutation description explains testName template variable', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-mutation')!;
    expect(step.description).toContain('createUser');
    expect(step.description).toContain(LESSON18_TEST_NAME_VAR);
  });

  it('gql18-bind-extraction description explains extraction binding analogy', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-bind-extraction')!;
    expect(step.description).toContain('Extraction');
    expect(step.description).toContain(LESSON18_CREATED_USER_ID_VAR);
    expect(step.description).toContain('Kafka');
  });

  it('gql18-config-query description explains read-back query wiring', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-query')!;
    expect(step.description).toContain('Fetch User');
    expect(step.description).toContain(LESSON18_CREATED_USER_ID_VAR);
  });

  it('gql18-assert-rule description explains variable chain', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-assert-rule')!;
    expect(step.description).toContain('$.user.name');
    expect(step.description).toContain(LESSON18_TEST_NAME_VAR);
  });

  it('gql18-quick-test description explains three-node pass sequence', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-quick-test')!;
    expect(step.description).toContain('Quick Test');
    expect(step.description).toContain('Create User');
    expect(step.description).toContain('Verify User');
  });

  it('gql18-config-delete description explains teardown pattern', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-delete')!;
    expect(step.description).toContain('deleteUser');
  });

  it('gql18-final-run description explains four-node pass sequence', () => {
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-final-run')!;
    expect(step.description).toContain('Delete User');
    expect(step.description).toContain('Quick Test');
  });

  // ── Action tests ──────────────────────────────────────────────────────────

  it('gql18-create action creates blank workflow', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildWorkflowCreateDom();
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-create')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.SIDEBAR_NEW_BTN);
  });

  it('gql18-add-mutation action adds mutation node to canvas', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    stubLesson18BlankWorkflowInStore();
    document.body.innerHTML = `${buildWorkflowDom()}<button class="wf-palette-block-graphqlMutation"></button>`;
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-add-mutation')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_MUTATION);
  });

  it('gql18-config-mutation action fills mutation endpoint and query', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = buildMutationPanelDom();
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-mutation')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(WF.WF_GQL_MUTATION_ENDPOINT, expect.stringContaining('4010'));
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_QUERY_EDITOR, LESSON18_CREATE_MUTATION);
  });

  it('gql18-bind-extraction action configures extraction rule', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = buildMutationPanelDom(true);
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-bind-extraction')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_EXTRACTION_JSONPATH, LESSON18_EXTRACTION_JSONPATH);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_EXTRACTION_VARNAME, LESSON18_CREATED_USER_ID_VAR);
  });

  it('gql18-quick-test action clicks Quick Test and waits for summary', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildWorkflowDom()}<div data-testid="exec-summary"></div>`;
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-quick-test')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('gql18-config-query action configures read-back query node', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildMutationPanelDom(true)}${buildQueryPanelDom()}`;
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-query')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_QUERY_EDITOR, LESSON18_GET_USER_QUERY);
  });

  it('gql18-assert-rule action configures assert node on fetched user name', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildMutationPanelDom(true)}${buildQueryPanelDom(true)}${buildAssertPanelDom()}`;
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-assert-rule')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_ASSERT_JSONPATH, '$.user.name');
  });

  it('gql18-config-delete action configures delete mutation', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    (window as unknown as Record<string, unknown>).__wfAddNode = vi.fn();
    document.body.innerHTML = `${buildWorkflowDom()}<div data-testid="exec-summary"></div>${buildMutationPanelDom()}<div class="react-flow__node" data-id="${LESSON18_NODE_DELETE}"></div>`;
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-config-delete')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_QUERY_EDITOR, LESSON18_DELETE_MUTATION);
  });

  it('gql18-add-delete action clicks palette to add delete node', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildWorkflowDom()}<div data-testid="exec-summary"></div><button class="wf-palette-block-graphqlMutation"></button>`;
    const step = gqlWorkflowMutationLesson.steps.find((s) => s.id === 'gql18-add-delete')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_MUTATION);
  });

  it('demonstrateLesson18DeleteNodeAdded always clicks mutation palette', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildWorkflowDom()}<button class="wf-palette-block-graphqlMutation"></button>`;
    await demonstrateLesson18DeleteNodeAdded(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_GQL_MUTATION);
  });

  // ── Guard / setup tests ───────────────────────────────────────────────────

  it('setup deletes stale workflow and navigates to designer', async () => {
    const ctx = makeCtx();
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    await gqlWorkflowMutationLessonSetup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON18_WF_NAME);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });

  it('ensureLesson18WorkflowCreated creates lesson workflow when another canvas is open', async () => {
    const ctx = makeCtx();
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
    await ensureLesson18WorkflowCreated(ctx);
    expect(ctx.click).toHaveBeenCalledWith(WF.SIDEBAR_NEW_BTN);
    expect(ctx.fill).toHaveBeenCalledWith(WF.CREATE_INPUT, LESSON18_WF_NAME);
  });

  it('ensureLesson18WorkflowLoaded skips recreate when lesson workflow is already active', async () => {
    const ctx = makeCtx();
    stubLesson18WorkflowInStore();
    document.body.innerHTML = buildWorkflowDom();
    await ensureLesson18WorkflowLoaded(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson18WorkflowLoaded(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.SIDEBAR_NEW_BTN);
  });

  it('ensureLesson18MutationConfigured opens create node config', async () => {
    const ctx = makeCtx();
    const openSpy = vi.fn();
    stubNodeConfigBridge(openSpy);
    document.body.innerHTML = buildMutationPanelDom();
    await ensureLesson18MutationConfigured(ctx);
    expect(openSpy).toHaveBeenCalledWith(LESSON18_NODE_CREATE);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_VARIABLES_EDITOR, LESSON18_MUTATION_VARS);
  });

  it('ensureLesson18DeleteNodeAdded closes console and rewires assert to delete', async () => {
    const ctx = makeCtx();
    const addSpy = vi.fn();
    const removeEdgeSpy = vi.fn();
    stubNodeConfigBridge();
    stubLesson18WorkflowInStore();
    (window as unknown as Record<string, unknown>).__wfAddNode = addSpy;
    (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
    (window as unknown as Record<string, unknown>).__wfRemoveEdge = removeEdgeSpy;
    document.body.innerHTML = `${buildWorkflowDom()}<div data-testid="exec-summary"></div><div class="wf-console-panel"></div><button class="wf-console-badge"></button><button class="wf-quick-test-btn"></button>${buildMutationPanelDom()}`;
    const badgeClickSpy = vi.fn();
    document.querySelector<HTMLElement>('.wf-console-badge')!.addEventListener('click', badgeClickSpy);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson18DeleteNodeAdded(ctx);
    expect(badgeClickSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
    expect(removeEdgeSpy).toHaveBeenCalledWith(LESSON18_NODE_ASSERT, LESSON18_NODE_END);
    expect(addSpy).toHaveBeenCalled();
  });

  // ── Helper unit tests ─────────────────────────────────────────────────────

  it('createGqlMutationDemoWorkflow has 5 nodes and 4 edges', () => {
    const wf = createGqlMutationDemoWorkflow();
    expect(wf.name).toBe(LESSON18_WF_NAME);
    expect((wf.nodes as unknown[]).length).toBe(5);
    expect((wf.edges as unknown[]).length).toBe(4);
    expect(wf.variables).toMatchObject({ [LESSON18_TEST_NAME_VAR]: LESSON18_TEST_NAME });
    const start = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === 'gql18-start');
    expect((start?.data?.inputVariables as Record<string, string> | undefined)?.[LESSON18_TEST_NAME_VAR]).toBe(LESSON18_TEST_NAME);
  });

  it('createGqlMutationBlankWorkflow seeds testName on start inputVariables', () => {
    const wf = createGqlMutationBlankWorkflow();
    const start = (wf.nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === 'gql18-start');
    expect((start?.data?.inputVariables as Record<string, string> | undefined)?.[LESSON18_TEST_NAME_VAR]).toBe(LESSON18_TEST_NAME);
  });

  it('createGqlMutationDemoWorkflow includes mutation, query, and assert nodes', () => {
    const wf = createGqlMutationDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown> }>;
    expect(nodes.find((n) => n.id === LESSON18_NODE_CREATE)?.type).toBe('graphqlMutation');
    expect(nodes.find((n) => n.id === 'gql18-fetch')?.type).toBe('graphqlQuery');
    expect(nodes.find((n) => n.id === 'gql18-assert')?.type).toBe('graphqlAssert');
    const fetch = nodes.find((n) => n.id === LESSON18_NODE_FETCH)!;
    expect(fetch.data.endpoint).toBe(GQL_DEMO_HTTP);
    expect(fetch.data.variables).toBe(LESSON18_QUERY_VARS);
    expect(isLesson18FetchNodeReady()).toBe(false);
  });

  it('isLesson18FetchNodeReady reads live workflow via __wfGetWorkflowByName', () => {
    const wf = createGqlMutationDemoWorkflow();
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === LESSON18_WF_NAME ? wf : null;
    expect(isLesson18FetchNodeReady()).toBe(true);
  });

  it('resolveLesson18DeleteNodeId returns preset delete node when seeded', () => {
    const wf = createGqlMutationDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string }>;
    nodes.push({ id: LESSON18_NODE_DELETE, type: 'graphqlMutation' });
    expect(resolveLesson18DeleteNodeId(nodes as never)).toBe(LESSON18_NODE_DELETE);
  });

  it('isLesson18DeleteNodeReady is false until delete mutation is configured', () => {
    const wf = createGqlMutationDemoWorkflow();
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => wf;
    expect(isLesson18DeleteNodeReady()).toBe(false);
  });

  it('LESSON18 constants define create and read-back operations', () => {
    expect(LESSON18_CREATE_MUTATION).toContain('createUser');
    expect(LESSON18_GET_USER_QUERY).toContain('user(id:');
    expect(LESSON18_DELETE_MUTATION).toContain('deleteUser');
    expect(LESSON18_MUTATION_VARS).toContain(`{{${LESSON18_TEST_NAME_VAR}}}`);
    expect(LESSON18_QUERY_VARS).toContain(`{{${LESSON18_CREATED_USER_ID_VAR}}}`);
    expect(LESSON18_QUERY_VARS).not.toContain(`"{{${LESSON18_CREATED_USER_ID_VAR}}}"`);
  });

  it('LESSON18_QUERY_VARS parses after createdUserId extraction substitute', () => {
    const extractedId = JSON.stringify('usr-1');
    const resolved = LESSON18_QUERY_VARS.replace(
      `{{${LESSON18_CREATED_USER_ID_VAR}}}`,
      extractedId,
    );
    expect(JSON.parse(resolved)).toEqual({ id: 'usr-1' });
  });

  it('createGqlMutationDemoWorkflow fetch + assert nodes execute after mutation extraction', async () => {
    const wf = createGqlMutationDemoWorkflow();
    const nodes = wf.nodes as Array<{ id: string; type: string; data: Record<string, unknown> }>;
    const fetchRaw = nodes.find((n) => n.id === LESSON18_NODE_FETCH)!;
    const assertRaw = nodes.find((n) => n.id === LESSON18_NODE_ASSERT)!;
    const fetchNode = makeNode(fetchRaw.id, 'graphqlQuery', fetchRaw.data);
    const assertNode = makeNode(assertRaw.id, 'graphqlAssert', assertRaw.data);

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: { user: { id: 'usr-1', name: LESSON18_TEST_NAME } },
      }),
    })));

    const cbResult = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks: cbResult.callbacks,
      initialVariables: { [LESSON18_TEST_NAME_VAR]: LESSON18_TEST_NAME },
    });
    hCtx.ctx.set(LESSON18_CREATED_USER_ID_VAR, JSON.stringify('usr-1'));

    const queryPassed = makePassedFlag();
    await handleGraphqlQueryNode(fetchRaw.id, fetchNode, hCtx, queryPassed);
    expect(queryPassed.value).toBe(true);

    const assertPassed = makePassedFlag();
    await handleGraphqlAssertNode(assertRaw.id, assertNode, hCtx, assertPassed);
    expect(assertPassed.value).toBe(true);
    expect(cbResult.states[assertRaw.id]?.state).toBe('pass');
  });

  it('ensureLesson18QueryConfigured binds fetchedUser output', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildMutationPanelDom(true)}${buildQueryPanelDom()}`;
    await ensureLesson18QueryConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_QUERY_EDITOR, LESSON18_GET_USER_QUERY);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_VARIABLES_EDITOR, LESSON18_QUERY_VARS);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_OUTPUT_VARNAME, LESSON18_FETCHED_USER_VAR);
  });

  it('ensureLesson18AssertConfigured sets equals assertion on user name', async () => {
    const ctx = makeCtx();
    stubNodeConfigBridge();
    document.body.innerHTML = `${buildMutationPanelDom(true)}${buildQueryPanelDom(true)}${buildAssertPanelDom()}`;
    await ensureLesson18AssertConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(WF.WF_GQL_ASSERT_SOURCE, LESSON18_FETCHED_USER_VAR);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.WF_ASSERT_JSONPATH, '$.user.name');
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.WF_ASSERT_OPERATOR, 'equals');
  });

  it('gqlWorkflowMutationLessonCleanup deletes seeded workflow', async () => {
    const ctx = makeCtx();
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    await gqlWorkflowMutationLessonCleanup(ctx);
    expect(deleteSpy).toHaveBeenCalledWith(LESSON18_WF_NAME);
  });
});

function stubNodeConfigBridge(openSpy = vi.fn()): void {
  (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
  (window as unknown as Record<string, unknown>).__wfConnect = vi.fn();
  (window as unknown as Record<string, unknown>).__wfRemoveEdge = vi.fn();
}

function buildWorkflowCreateDom(): string {
  return `
    <button data-testid="wf-sidebar-new-btn"></button>
    <div class="wf-new-dropdown"></div>
    <button data-testid="wf-new-blank-item"></button>
    <input data-testid="wf-create-input" />
    <button data-testid="wf-create-ok"></button>
    <button title="Fit view"></button>
  `;
}

function buildWorkflowDom(): string {
  return `
    <div class="wf-canvas-area"></div>
    <div class="wf-sidebar-item active"><span class="wf-sidebar-item-name">${LESSON18_WF_NAME}</span></div>
    <div data-testid="gql-canvas-mutation-node"></div>
    <div data-testid="gql-canvas-query-node"></div>
    <div data-testid="gql-canvas-assert-node"></div>
    <button title="Fit view"></button>
  `;
}

function stubLesson18WorkflowInStore(): void {
  (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
    name === LESSON18_WF_NAME ? createGqlMutationDemoWorkflow() : null;
}

function stubLesson18BlankWorkflowInStore(): void {
  (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
    name === LESSON18_WF_NAME ? createGqlMutationBlankWorkflow() : null;
}

function buildMutationPanelDom(withExtraction = false): string {
  return `
    <div data-testid="gql-wf-mutation-panel">
      <button class="wf-config-tab">Operation</button>
      <button class="wf-config-tab">Variables</button>
      <button class="wf-config-tab">Extraction</button>
      <input data-testid="gql-wf-endpoint-input" />
      <textarea data-testid="gql-wf-query-editor"></textarea>
      <textarea data-testid="gql-wf-variables-editor"></textarea>
      <div data-testid="gql-wf-extraction-table">
        ${withExtraction ? '<input data-testid="gql-wf-extraction-jsonpath" />' : ''}
        <button data-testid="gql-wf-extraction-add-btn">+ Add</button>
        <input data-testid="gql-wf-extraction-jsonpath" />
        <input data-testid="gql-wf-extraction-varname" />
      </div>
      <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
    </div>
  `;
}

function buildQueryPanelDom(withOutput = false): string {
  return `
    <div data-testid="gql-wf-query-panel">
      <button class="wf-config-tab">Operation</button>
      <button class="wf-config-tab">Variables</button>
      <button class="wf-config-tab">Output</button>
      <input data-testid="gql-wf-endpoint-input" />
      <textarea data-testid="gql-wf-query-editor"></textarea>
      <textarea data-testid="gql-wf-variables-editor"></textarea>
      <div data-testid="gql-wf-output-table">
        ${withOutput ? '<select data-testid="gql-wf-output-field-select"></select>' : ''}
        <button data-testid="gql-wf-output-add-btn">+ Add</button>
        <select data-testid="gql-wf-output-field-select"></select>
        <input data-testid="gql-wf-output-varname" />
      </div>
      <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
    </div>
  `;
}

function buildAssertPanelDom(): string {
  return `
    <div data-testid="gql-wf-assert-panel">
      <button class="wf-config-tab">Source</button>
      <button class="wf-config-tab">Assertions</button>
      <div class="wf-config-field"><div class="expr-input-wrapper"><input /></div></div>
      <div data-testid="gql-wf-assert-row">
        <input data-testid="gql-wf-assert-jsonpath" />
        <select data-testid="gql-wf-assert-operator"></select>
        <input data-testid="gql-wf-assert-expected" />
        <input data-testid="gql-wf-assert-description" />
      </div>
      <button data-testid="gql-wf-assert-add-btn">+ Add</button>
      <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
    </div>
  `;
}
