// ── Lesson 18: GraphQL Mutation Node in Workflow ─────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL, WF } from '../../../../../shared/selectors';
import { GQL_DEMO_HTTP } from './core';
import {
  clickWfConfigAddRow,
  clickWfConfigTab,
  closeWfConfigModalIfOpen,
  collapseWfDemoAppSidebar,
  fillWfConfigField,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  selectWorkflowFromAppSidebar,
  waitForWfConfigPanel,
} from '../../wf-demo-helpers';

export { GQL_DEMO_HTTP };

export const LESSON18_WF_NAME = 'GraphQL User CRUD Demo';
export const LESSON18_TEST_NAME = 'Demo User';
export const LESSON18_TEST_NAME_VAR = 'testName';
export const LESSON18_CREATED_USER_ID_VAR = 'createdUserId';
export const LESSON18_FETCHED_USER_VAR = 'fetchedUser';

export const LESSON18_NODE_START = 'gql18-start';
export const LESSON18_NODE_CREATE = 'gql18-create';
export const LESSON18_NODE_FETCH = 'gql18-fetch';
export const LESSON18_NODE_ASSERT = 'gql18-assert';
export const LESSON18_NODE_DELETE = 'gql18-delete';
export const LESSON18_NODE_END = 'gql18-end';

export const LESSON18_CREATE_MUTATION =
  'mutation CreateUser($name: String!, $email: String!) {\n' +
  '  createUser(name: $name, email: $email) {\n' +
  '    id\n' +
  '    name\n' +
  '  }\n' +
  '}';

export const LESSON18_MUTATION_VARS =
  '{\n  "name": "{{testName}}",\n  "email": "demo@example.com"\n}';

export const LESSON18_GET_USER_QUERY =
  'query GetUser($id: ID!) {\n' +
  '  user(id: $id) {\n' +
  '    id\n' +
  '    name\n' +
  '  }\n' +
  '}';

/** No quotes around {{createdUserId}} — extraction stores JSON-serialized scalars. */
export const LESSON18_QUERY_VARS = '{\n  "id": {{createdUserId}}\n}';

export const LESSON18_DELETE_MUTATION =
  'mutation DeleteUser($id: ID!) {\n' +
  '  deleteUser(id: $id) {\n' +
  '    success\n' +
  '  }\n' +
  '}';

export const LESSON18_DELETE_VARS = '{\n  "id": {{createdUserId}}\n}';

export const LESSON18_EXTRACTION_JSONPATH = '$.createUser.id';

// ── Session flags ─────────────────────────────────────────────────────────────

let _lesson18Loaded = false;
let _lesson18MutationConfigured = false;
let _lesson18OutputBound = false;
let _lesson18QueryConfigured = false;
let _lesson18AssertConfigured = false;
let _lesson18QuickTestRun = false;
let _lesson18DeleteAdded = false;

export function resetGqlLesson18SessionFlags(): void {
  _lesson18Loaded = false;
  _lesson18MutationConfigured = false;
  _lesson18OutputBound = false;
  _lesson18QueryConfigured = false;
  _lesson18AssertConfigured = false;
  _lesson18QuickTestRun = false;
  _lesson18DeleteAdded = false;
}

// ── Workflow factory ──────────────────────────────────────────────────────────

type Lesson18NodeSnapshot = { id: string; type: string; data: Record<string, unknown> };

function readLesson18WorkflowNodes(): Lesson18NodeSnapshot[] | null {
  const get = (window as unknown as Record<string, unknown>).__wfGetWorkflowByName as
    | ((name: string) => { nodes?: Lesson18NodeSnapshot[] } | null)
    | undefined;
  return get?.(LESSON18_WF_NAME)?.nodes ?? null;
}

function lesson18NodeData(nodeId: string): Record<string, unknown> | null {
  const node = readLesson18WorkflowNodes()?.find((n) => n.id === nodeId);
  return node?.data ?? null;
}

export function isLesson18CreateNodeReady(): boolean {
  const data = lesson18NodeData(LESSON18_NODE_CREATE);
  const endpoint = String(data?.endpoint ?? '').trim();
  const query = String(data?.query ?? '').trim();
  const rules = data?.extractionRules as Array<{ variableName?: string }> | undefined;
  return !!(endpoint && query.includes('createUser') && rules?.some((r) => r.variableName === LESSON18_CREATED_USER_ID_VAR));
}

export function isLesson18FetchNodeReady(): boolean {
  const data = lesson18NodeData(LESSON18_NODE_FETCH);
  const endpoint = String(data?.endpoint ?? '').trim();
  const query = String(data?.query ?? '').trim();
  const bindings = data?.outputBindings as Array<{ field?: string; variableName?: string; enabled?: boolean }> | undefined;
  return !!(
    endpoint
    && query.includes('user(id:')
    && bindings?.some((b) => b.field === 'data' && b.variableName === LESSON18_FETCHED_USER_VAR && b.enabled !== false)
  );
}

export function isLesson18AssertNodeReady(): boolean {
  const data = lesson18NodeData(LESSON18_NODE_ASSERT);
  const source = String(data?.sourceVariable ?? '').trim();
  const assertions = data?.assertions as Array<{ jsonPath?: string }> | undefined;
  return !!(source === LESSON18_FETCHED_USER_VAR && assertions?.some((a) => a.jsonPath === '$.user.name'));
}

function isLesson18QuickTestPassVisible(): boolean {
  return !!document.querySelector('.wf-exec-strip-pass');
}

/** Pre-wired canvas: Start → Mutation → Query → Assert → End (lesson-ready defaults). */
export function createGqlMutationDemoWorkflow(): Record<string, unknown> {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: LESSON18_WF_NAME,
    schemaVersion: 6,
    variables: {
      [LESSON18_TEST_NAME_VAR]: LESSON18_TEST_NAME,
      [LESSON18_CREATED_USER_ID_VAR]: '',
      [LESSON18_FETCHED_USER_VAR]: '',
    },
    services: [],
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      {
        id: LESSON18_NODE_START,
        type: 'start',
        position: { x: 100, y: 150 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: LESSON18_NODE_CREATE,
        type: 'graphqlMutation',
        position: { x: 280, y: 150 },
        data: {
          label: 'Create User',
          endpoint: GQL_DEMO_HTTP,
          query: LESSON18_CREATE_MUTATION,
          variables: LESSON18_MUTATION_VARS,
          headers: [],
          timeoutMs: 30000,
          extractionRules: [
            { variableName: LESSON18_CREATED_USER_ID_VAR, jsonPath: LESSON18_EXTRACTION_JSONPATH },
          ],
          outputBindings: [],
        },
      },
      {
        id: LESSON18_NODE_FETCH,
        type: 'graphqlQuery',
        position: { x: 480, y: 150 },
        data: {
          label: 'Fetch User',
          endpoint: GQL_DEMO_HTTP,
          query: LESSON18_GET_USER_QUERY,
          variables: LESSON18_QUERY_VARS,
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [
            { field: 'data', variableName: LESSON18_FETCHED_USER_VAR, enabled: true },
          ],
        },
      },
      {
        id: LESSON18_NODE_ASSERT,
        type: 'graphqlAssert',
        position: { x: 680, y: 150 },
        data: {
          label: 'Verify User',
          sourceVariable: LESSON18_FETCHED_USER_VAR,
          assertions: [{
            id: 'gql18-name-assert',
            jsonPath: '$.user.name',
            operator: 'equals',
            expectedValue: `{{${LESSON18_TEST_NAME_VAR}}}`,
            description: 'Fetched user name matches testName',
          }],
          failBehavior: 'error',
        },
      },
      {
        id: LESSON18_NODE_END,
        type: 'end',
        position: { x: 880, y: 150 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: crypto.randomUUID(), source: LESSON18_NODE_START, target: LESSON18_NODE_CREATE },
      { id: crypto.randomUUID(), source: LESSON18_NODE_CREATE, target: LESSON18_NODE_FETCH },
      { id: crypto.randomUUID(), source: LESSON18_NODE_FETCH, target: LESSON18_NODE_ASSERT },
      { id: crypto.randomUUID(), source: LESSON18_NODE_ASSERT, target: LESSON18_NODE_END },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function dismissWorkflowOnboarding(ctx: DemoActionContext): Promise<void> {
  const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (skipBtn) {
    skipBtn.click();
    await ctx.delay(300);
  }
}

async function clickWfFitView(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector<HTMLElement>('button[title="Fit view"]');
  if (btn) {
    btn.click();
    await ctx.delay(500);
  }
}

function connectWfNodesById(sourceId: string, targetId: string, sourceHandle: string | null = null): boolean {
  const wfConnect = (window as unknown as Record<string, unknown>).__wfConnect as
    | ((s: string, t: string, sh: string | null, th: string | null) => void)
    | undefined;
  if (wfConnect) {
    wfConnect(sourceId, targetId, sourceHandle, null);
    return true;
  }
  return false;
}

/** Select the seeded workflow from the sidebar. */
export async function selectGqlMutationDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  await selectWorkflowFromAppSidebar(ctx, LESSON18_WF_NAME);
  _lesson18Loaded = true;
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

/** Load the pre-seeded CRUD workflow onto the canvas. */
export async function ensureLesson18WorkflowLoaded(ctx: DemoActionContext): Promise<void> {
  if (_lesson18Loaded && document.querySelector(WF.CANVAS)) {
    await collapseWfDemoAppSidebar(ctx);
    return;
  }
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);
  await selectGqlMutationDemoWorkflow(ctx);
  await clickWfFitView(ctx);
}

/** Configure the createUser mutation node. */
export async function ensureLesson18MutationConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18WorkflowLoaded(ctx);
  if (_lesson18MutationConfigured && isLesson18CreateNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_CREATE });
  await waitForWfConfigPanel(ctx, GQL.WF_MUTATION_PANEL);
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON18_CREATE_MUTATION);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Variables');
  await fillWfConfigField(ctx, GQL.WF_VARIABLES_EDITOR, LESSON18_MUTATION_VARS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson18MutationConfigured = true;
}

/** Bind createUser.id → createdUserId via the Extraction tab. */
export async function ensureLesson18MutationOutputBound(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18MutationConfigured(ctx);
  if (_lesson18OutputBound && isLesson18CreateNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_CREATE });
  await waitForWfConfigPanel(ctx, GQL.WF_MUTATION_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Extraction');
  if (!document.querySelector(GQL.WF_EXTRACTION_JSONPATH)) {
    await clickWfConfigAddRow(ctx, GQL.WF_EXTRACTION_ADD_BTN, GQL.WF_EXTRACTION_JSONPATH);
  }
  await fillWfConfigField(ctx, GQL.WF_EXTRACTION_JSONPATH, LESSON18_EXTRACTION_JSONPATH);
  await fillWfConfigField(ctx, GQL.WF_EXTRACTION_VARNAME, LESSON18_CREATED_USER_ID_VAR);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson18OutputBound = true;
}

/** Configure the read-back query node. */
export async function ensureLesson18QueryConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18MutationOutputBound(ctx);
  if (_lesson18QueryConfigured && isLesson18FetchNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_FETCH });
  await waitForWfConfigPanel(ctx, GQL.WF_QUERY_PANEL);
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON18_GET_USER_QUERY);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Variables');
  await fillWfConfigField(ctx, GQL.WF_VARIABLES_EDITOR, LESSON18_QUERY_VARS);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await clickWfConfigAddRow(ctx, GQL.WF_OUTPUT_ADD_BTN, GQL.WF_OUTPUT_FIELD_SELECT);
  }
  await selectWfConfigOption(ctx, GQL.WF_OUTPUT_FIELD_SELECT, 'data');
  await fillWfConfigField(ctx, GQL.WF_OUTPUT_VARNAME, LESSON18_FETCHED_USER_VAR);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson18QueryConfigured = true;
}

/** Configure assert: $.user.name equals {{testName}}. */
export async function ensureLesson18AssertConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryConfigured(ctx);
  if (_lesson18AssertConfigured && isLesson18AssertNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_ASSERT });
  await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
  await fillWfConfigField(ctx, WF.WF_GQL_ASSERT_SOURCE, LESSON18_FETCHED_USER_VAR);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Assertions');
  if (!document.querySelector(GQL.WF_ASSERT_ROW)) {
    await clickWfConfigAddRow(ctx, GQL.WF_ASSERT_ADD_BTN, GQL.WF_ASSERT_JSONPATH);
  }
  await fillWfConfigField(ctx, GQL.WF_ASSERT_JSONPATH, '$.user.name');
  await selectWfConfigOption(ctx, GQL.WF_ASSERT_OPERATOR, 'equals');
  await pauseWfConfigSection(ctx);
  await fillWfConfigField(ctx, GQL.WF_ASSERT_EXPECTED, `{{${LESSON18_TEST_NAME_VAR}}}`);
  await fillWfConfigField(ctx, GQL.WF_ASSERT_DESCRIPTION, 'Fetched user name matches testName');
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson18AssertConfigured = true;
}

/** Run Quick Test and wait for execution summary. */
export async function ensureLesson18QuickTestRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertConfigured(ctx);
  if (
    _lesson18QuickTestRun
    && isLesson18QuickTestPassVisible()
    && isLesson18FetchNodeReady()
    && isLesson18AssertNodeReady()
  ) {
    return;
  }

  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(300);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  await ctx.delay(800);
  _lesson18QuickTestRun = true;
}

/** Add deleteUser mutation node and rewire Assert → Delete → End. */
export async function ensureLesson18DeleteNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QuickTestRun(ctx);
  if (_lesson18DeleteAdded && document.querySelector(`[data-id="${LESSON18_NODE_DELETE}"]`)) return;

  const wfAddNode = (window as unknown as Record<string, unknown>).__wfAddNode as
    | ((type: string, id: string, label: string, position: { x: number; y: number }) => void)
    | undefined;
  if (wfAddNode) {
    wfAddNode('graphqlMutation', LESSON18_NODE_DELETE, 'Delete User', { x: 780, y: 280 });
    await ctx.delay(400);
  } else {
    const pal = document.querySelector<HTMLElement>(WF.PAL_GQL_MUTATION);
    pal?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    await ctx.click(WF.PAL_GQL_MUTATION);
    await ctx.delay(600);
  }

  connectWfNodesById(LESSON18_NODE_ASSERT, LESSON18_NODE_DELETE);
  connectWfNodesById(LESSON18_NODE_DELETE, LESSON18_NODE_END);
  await ctx.delay(400);

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_DELETE });
  await waitForWfConfigPanel(ctx, GQL.WF_MUTATION_PANEL);
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON18_DELETE_MUTATION);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Variables');
  await fillWfConfigField(ctx, GQL.WF_VARIABLES_EDITOR, LESSON18_DELETE_VARS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  await clickWfFitView(ctx);
  _lesson18DeleteAdded = true;
}

// ── Setup / Cleanup ───────────────────────────────────────────────────────────

export async function gqlWorkflowMutationLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson18SessionFlags();
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  const wfInsert = (window as unknown as Record<string, unknown>).__wfInsertWorkflow as
    | ((wf: Record<string, unknown>) => void)
    | undefined;
  if (wfDelete) {
    wfDelete(LESSON18_WF_NAME);
    await ctx.delay(100);
  }
  if (wfInsert) {
    wfInsert(createGqlMutationDemoWorkflow());
    await ctx.delay(300);
  }
  await closeWfConfigModalIfOpen(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);
  await selectGqlMutationDemoWorkflow(ctx);
  await clickWfFitView(ctx);
}

export async function gqlWorkflowMutationLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  wfDelete?.(LESSON18_WF_NAME);
  resetGqlLesson18SessionFlags();
  await ctx.delay(100);
}
