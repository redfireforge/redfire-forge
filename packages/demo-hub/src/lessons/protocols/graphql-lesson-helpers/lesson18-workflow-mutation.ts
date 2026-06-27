// ── Lesson 18: GraphQL Mutation Node in Workflow ─────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL, WF } from '@shared/selectors';
import { GQL_DEMO_HTTP } from './core';
import {
  clickWfConfigAddRow,
  clickWfConfigTab,
  closeWfConfigModalIfOpen,
  collapseWfDemoAppSidebar,
  cleanupWorkflowDemoRunUi,
  closeWfConsoleIfOpen,
  dismissWorkflowExecSummary,
  expandWfDemoAppSidebar,
  fillWfConfigField,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  selectWorkflowFromAppSidebar,
  openWfConsoleIfClosed,
  waitForWfConfigPanel,
} from '../../wf-demo-helpers';
import {
  addWorkflowNodeWithPreset,
  connectWorkflowNodes,
  deleteWorkflowByName,
  getWorkflowByName,
  patchWorkflowByName,
  patchWorkflowNodeDataById,
  removeWorkflowEdge,
} from '../../../adapters';

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
const LESSON18_DELETE_NODE_SELECTOR = `.react-flow__node[data-id="${LESSON18_NODE_DELETE}"], ${GQL.WF_CANVAS_MUTATION_NODE}`;

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

let _lesson18Created = false;
let _lesson18SidebarCollapsed = false;
let _lesson18MutationAdded = false;
let _lesson18MutationConfigured = false;
let _lesson18OutputBound = false;
let _lesson18QueryAdded = false;
let _lesson18QueryOpConfigured = false;
let _lesson18QueryOutputBound = false;
let _lesson18AssertAdded = false;
let _lesson18AssertSourceConfigured = false;
let _lesson18AssertRuleConfigured = false;
let _lesson18QuickTestRun = false;
let _lesson18DeleteAdded = false;
let _lesson18DeleteConfigured = false;
let _lesson18FinalQuickTestRun = false;

export function resetGqlLesson18SessionFlags(): void {
  _lesson18Created = false;
  _lesson18SidebarCollapsed = false;
  _lesson18MutationAdded = false;
  _lesson18MutationConfigured = false;
  _lesson18OutputBound = false;
  _lesson18QueryAdded = false;
  _lesson18QueryOpConfigured = false;
  _lesson18QueryOutputBound = false;
  _lesson18AssertAdded = false;
  _lesson18AssertSourceConfigured = false;
  _lesson18AssertRuleConfigured = false;
  _lesson18QuickTestRun = false;
  _lesson18DeleteAdded = false;
  _lesson18DeleteConfigured = false;
  _lesson18FinalQuickTestRun = false;
}

// ── Workflow factories ────────────────────────────────────────────────────────

type Lesson18NodeSnapshot = { id: string; type: string; data: Record<string, unknown> };
type Lesson18EdgeSnapshot = { source: string; target: string };
type Lesson18WorkflowSnapshot = {
  nodes?: Lesson18NodeSnapshot[];
  edges?: Lesson18EdgeSnapshot[];
};

function readLesson18Workflow(): Lesson18WorkflowSnapshot | null {
  return getWorkflowByName<Lesson18WorkflowSnapshot>(LESSON18_WF_NAME);
}

function readLesson18WorkflowNodes(): Lesson18NodeSnapshot[] | null {
  return readLesson18Workflow()?.nodes ?? null;
}

function readLesson18WorkflowEdges(): Lesson18EdgeSnapshot[] {
  return readLesson18Workflow()?.edges ?? [];
}

function lesson18NodeIdExists(nodeId: string): boolean {
  return readLesson18WorkflowNodes()?.some((n) => n.id === nodeId) ?? false;
}

function resolveLesson18StartNodeId(): string | null {
  return readLesson18WorkflowNodes()?.find((n) => n.type === 'start')?.id ?? null;
}

function resolveLesson18EndNodeId(): string | null {
  return readLesson18WorkflowNodes()?.find((n) => n.type === 'end')?.id ?? null;
}

function lesson18EdgeExists(sourceId: string, targetId: string): boolean {
  return readLesson18WorkflowEdges().some((e) => e.source === sourceId && e.target === targetId);
}

function connectWfNodesById(sourceId: string, targetId: string, sourceHandle: string | null = null): boolean {
  if (!lesson18NodeIdExists(sourceId) || !lesson18NodeIdExists(targetId)) {
    return false;
  }
  return connectWorkflowNodes(sourceId, targetId, sourceHandle, null);
}

function connectWfNodesBySelector(
  sourceSelector: string,
  targetSelector: string,
  sourceHandle: string | null = null,
): boolean {
  const sourceEl = document.querySelector(sourceSelector);
  const targetEl = document.querySelector(targetSelector);
  const sourceId = sourceEl?.getAttribute('data-id') ?? sourceEl?.closest('.react-flow__node')?.getAttribute('data-id');
  const targetId = targetEl?.getAttribute('data-id') ?? targetEl?.closest('.react-flow__node')?.getAttribute('data-id');
  if (sourceId && targetId) {
    return connectWorkflowNodes(sourceId, targetId, sourceHandle, null);
  }
  return false;
}

/** Connect by stored node id when available; fall back to canvas selectors (UI-created Start id). */
function connectLesson18Edge(
  sourceId: string | null,
  targetId: string | null,
  sourceSelector: string,
  targetSelector: string,
  sourceHandle: string | null = null,
): boolean {
  if (sourceId && targetId && connectWfNodesById(sourceId, targetId, sourceHandle)) {
    return true;
  }
  return connectWfNodesBySelector(sourceSelector, targetSelector, sourceHandle);
}

function lesson18NodeData(nodeId: string): Record<string, unknown> | null {
  const node = readLesson18WorkflowNodes()?.find((n) => n.id === nodeId);
  return node?.data ?? null;
}

function isLesson18NodeOnCanvas(nodeId: string, type?: string): boolean {
  const nodes = readLesson18WorkflowNodes();
  if (nodes?.some((n) => n.id === nodeId && (!type || n.type === type))) return true;
  return !!document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
}

export function isLesson18CreateNodeReady(): boolean {
  const data = lesson18NodeData(LESSON18_NODE_CREATE);
  const endpoint = String(data?.endpoint ?? '').trim();
  const query = String(data?.query ?? '').trim();
  const rules = data?.extractionRules as Array<{ variableName?: string }> | undefined;
  return !!(endpoint && query.includes('createUser') && rules?.some((r) => r.variableName === LESSON18_CREATED_USER_ID_VAR));
}

export function isLesson18CreateMutationOpReady(): boolean {
  const data = lesson18NodeData(LESSON18_NODE_CREATE);
  const endpoint = String(data?.endpoint ?? '').trim();
  const query = String(data?.query ?? '').trim();
  const variables = String(data?.variables ?? '').trim();
  return !!(endpoint && query.includes('createUser') && variables.includes(LESSON18_TEST_NAME_VAR));
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

export function isLesson18FetchQueryOpReady(): boolean {
  const data = lesson18NodeData(LESSON18_NODE_FETCH);
  const endpoint = String(data?.endpoint ?? '').trim();
  const query = String(data?.query ?? '').trim();
  const variables = String(data?.variables ?? '').trim();
  return !!(endpoint && query.includes('user(id:') && variables.includes(LESSON18_CREATED_USER_ID_VAR));
}

export function isLesson18AssertNodeReady(): boolean {
  const data = lesson18NodeData(LESSON18_NODE_ASSERT);
  const source = String(data?.sourceVariable ?? '').trim();
  const assertions = data?.assertions as Array<{ jsonPath?: string }> | undefined;
  return !!(source === LESSON18_FETCHED_USER_VAR && assertions?.some((a) => a.jsonPath === '$.user.name'));
}

export function isLesson18AssertSourceReady(): boolean {
  const data = lesson18NodeData(LESSON18_NODE_ASSERT);
  return String(data?.sourceVariable ?? '').trim() === LESSON18_FETCHED_USER_VAR;
}

export function isLesson18DeleteNodeReady(): boolean {
  const data = lesson18NodeData(resolveLesson18DeleteNodeId());
  const endpoint = String(data?.endpoint ?? '').trim();
  const query = String(data?.query ?? '').trim();
  const variables = String(data?.variables ?? '').trim();
  return !!(endpoint && query.includes('deleteUser') && variables.includes(LESSON18_CREATED_USER_ID_VAR));
}

/** Resolve the teardown mutation node id (preset id or palette-added fallback). */
export function resolveLesson18DeleteNodeId(
  nodes: Lesson18NodeSnapshot[] | null = readLesson18WorkflowNodes(),
): string {
  if (nodes?.some((n) => n.id === LESSON18_NODE_DELETE)) {
    return LESSON18_NODE_DELETE;
  }
  const extraMutation = [...(nodes ?? [])]
    .reverse()
    .find((n) => n.type === 'graphqlMutation' && n.id !== LESSON18_NODE_CREATE);
  if (extraMutation) return extraMutation.id;

  const domExtra = [...document.querySelectorAll('.react-flow__node')].filter((el) => {
    const id = el.getAttribute('data-id');
    return id && id !== LESSON18_NODE_CREATE && el.querySelector(GQL.WF_CANVAS_MUTATION_NODE);
  });
  return domExtra.at(-1)?.getAttribute('data-id') ?? LESSON18_NODE_DELETE;
}

function isLesson18DeleteOnCanvas(): boolean {
  const nodes = readLesson18WorkflowNodes();
  if (nodes) {
    return nodes.some((n) => n.type === 'graphqlMutation' && n.id !== LESSON18_NODE_CREATE);
  }
  return !!document.querySelector(`[data-id="${LESSON18_NODE_DELETE}"]`);
}

function isLesson18QuickTestPassVisible(): boolean {
  return !!document.querySelector('.wf-exec-strip-pass');
}

/** Blank canvas — Start + End only (lesson builds nodes step by step). */
export function createGqlMutationBlankWorkflow(): Record<string, unknown> {
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
        data: { label: 'Start', inputVariables: { [LESSON18_TEST_NAME_VAR]: LESSON18_TEST_NAME } },
      },
      {
        id: LESSON18_NODE_END,
        type: 'end',
        position: { x: 880, y: 150 },
        data: { label: 'End' },
      },
    ],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Fully wired reference workflow (unit tests + quiet patch guards). */
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
        data: { label: 'Start', inputVariables: { [LESSON18_TEST_NAME_VAR]: LESSON18_TEST_NAME } },
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

/** Close console + exec strip without re-centering the canvas. */
async function prepareLesson18CanvasUiOnly(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(300);
  await dismissWorkflowExecSummary(ctx);
  await closeWfConsoleIfOpen(ctx);
}

/** Close console + exec strip so canvas/node palette steps are unobstructed. */
async function prepareLesson18CanvasForBuilding(ctx: DemoActionContext): Promise<void> {
  await prepareLesson18CanvasUiOnly(ctx);
  await clickWfFitView(ctx);
}

/** Reading phase before Quick Test — assert chain ready, canvas clear, console closed until run. */
export async function prepareLesson18BeforeQuickTest(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertRuleConfigured(ctx);
  await prepareLesson18CanvasForBuilding(ctx);
}

/** Reading phase before teardown Quick Test — delete node configured, canvas clear. */
export async function prepareLesson18BeforeFinalQuickTest(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18DeleteConfigured(ctx);
  await prepareLesson18CanvasUiOnly(ctx);
}

/** Reading phase before adding Delete User — no Quick Test re-run, console closed. */
export async function prepareLesson18BeforeDeleteNode(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertRuleConfigured(ctx);
  await prepareLesson18CanvasForBuilding(ctx);
}

/** Collapse the workflows list once after create — never toggle again mid-lesson. */
async function collapseLesson18SidebarOnce(ctx: DemoActionContext): Promise<void> {
  if (_lesson18SidebarCollapsed) return;
  await collapseWfDemoAppSidebar(ctx);
  _lesson18SidebarCollapsed = true;
}

async function addLesson18PaletteNode(
  ctx: DemoActionContext,
  type: string,
  nodeId: string,
  label: string,
  position: { x: number; y: number },
  paletteSelector: string,
): Promise<void> {
  const pal = document.querySelector<HTMLElement>(paletteSelector);
  pal?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  await ctx.delay(400);
  if (!addWorkflowNodeWithPreset(type, nodeId, label, position)) {
    await ctx.click(paletteSelector);
  }
  await ctx.delay(600);
}

function patchLesson18WorkflowVariablesQuiet(): boolean {
  const nodes = readLesson18WorkflowNodes();
  const startNode = nodes?.find((n) => n.type === 'start');
  const startInputVariables = {
    ...((startNode?.data?.inputVariables as Record<string, string> | undefined) ?? {}),
    [LESSON18_TEST_NAME_VAR]: LESSON18_TEST_NAME,
  };
  const patch: Record<string, unknown> = {
    variables: {
      [LESSON18_TEST_NAME_VAR]: LESSON18_TEST_NAME,
      [LESSON18_CREATED_USER_ID_VAR]: '',
      [LESSON18_FETCHED_USER_VAR]: '',
    },
  };

  if (nodes && startNode) {
    patch.nodes = nodes.map((n) =>
      n.id === startNode.id
        ? {
            ...n,
            data: {
              ...n.data,
              inputVariables: startInputVariables,
            },
          }
        : n,
    );
  }

  return patchWorkflowByName(LESSON18_WF_NAME, patch);
}

function findLesson18SidebarItem(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>('.wf-sidebar-item-name, .wf-sidebar-item')) {
    const name = el.classList.contains('wf-sidebar-item-name')
      ? el.textContent?.trim()
      : el.querySelector('.wf-sidebar-item-name')?.textContent?.trim() ?? el.textContent?.trim();
    if (name !== LESSON18_WF_NAME) continue;
    return el.classList.contains('wf-sidebar-item')
      ? el
      : el.closest<HTMLElement>('.wf-sidebar-item') ?? el;
  }
  return null;
}

/** True when the lesson workflow exists in store and is the one shown on the canvas. */
export function isLesson18WorkflowActive(): boolean {
  if (!document.querySelector(WF.CANVAS)) return false;
  if (!getWorkflowByName(LESSON18_WF_NAME)) return false;
  const toolbar = document.querySelector(WF.TOOLBAR_SELECT);
  if (toolbar?.textContent?.includes(LESSON18_WF_NAME)) return true;
  const sidebarItem = findLesson18SidebarItem();
  if (sidebarItem?.classList.contains('active')) return true;
  return !!document.querySelector(`.react-flow__node[data-id="${LESSON18_NODE_START}"]`);
}

async function ensureLesson18WorkflowSelected(ctx: DemoActionContext): Promise<void> {
  if (isLesson18WorkflowActive()) return;
  await selectGqlMutationDemoWorkflow(ctx);
  await ctx.waitFor(WF.CANVAS, 8000);
  await ctx.delay(400);
}

/** Select the demo workflow from the sidebar. */
export async function selectGqlMutationDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  const ok = await selectWorkflowFromAppSidebar(ctx, LESSON18_WF_NAME);
  if (ok) _lesson18Created = true;
}

// ── Step guards (build canvas + configure) ───────────────────────────────────

/** Create a blank workflow named GraphQL User CRUD Demo. */
export async function ensureLesson18WorkflowCreated(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);

  if (_lesson18Created && getWorkflowByName(LESSON18_WF_NAME)) {
    await ensureLesson18WorkflowSelected(ctx);
    patchLesson18WorkflowVariablesQuiet();
    return;
  }

  if (getWorkflowByName(LESSON18_WF_NAME)) {
    await ensureLesson18WorkflowSelected(ctx);
    patchLesson18WorkflowVariablesQuiet();
    _lesson18Created = true;
    return;
  }

  await expandWfDemoAppSidebar(ctx);
  await ctx.click(WF.SIDEBAR_NEW_BTN);
  await ctx.delay(400);
  await ctx.click(WF.NEW_BLANK_ITEM);
  await ctx.delay(400);
  await ctx.fill(WF.CREATE_INPUT, LESSON18_WF_NAME);
  await ctx.delay(200);
  await ctx.click(WF.CREATE_OK);
  await ctx.waitFor(WF.CANVAS, 8000);
  await ctx.delay(800);
  patchLesson18WorkflowVariablesQuiet();
  await collapseLesson18SidebarOnce(ctx);
  await clickWfFitView(ctx);
  _lesson18Created = true;
}

/** @deprecated Use ensureLesson18WorkflowCreated — kept for tests/guards. */
export async function ensureLesson18WorkflowLoaded(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WF.CANVAS)) {
    _lesson18Created = true;
    return;
  }
  await ensureLesson18WorkflowCreated(ctx);
}

/** Click GraphQL Mutation in the palette and wire Start → Create User. */
export async function ensureLesson18MutationNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18WorkflowCreated(ctx);
  const startId = resolveLesson18StartNodeId();
  const createPresent = isLesson18NodeOnCanvas(LESSON18_NODE_CREATE, 'graphqlMutation');
  const startWired = Boolean(startId && lesson18EdgeExists(startId, LESSON18_NODE_CREATE));
  if (_lesson18MutationAdded && createPresent && startWired) {
    return;
  }

  if (!createPresent) {
    await addLesson18PaletteNode(
      ctx,
      'graphqlMutation',
      LESSON18_NODE_CREATE,
      'Create User',
      { x: 280, y: 150 },
      WF.PAL_GQL_MUTATION,
    );
  }

  connectLesson18Edge(
    startId ?? resolveLesson18StartNodeId(),
    LESSON18_NODE_CREATE,
    WF.NODE_START,
    WF.NODE_GQL_MUTATION,
    'out',
  );
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson18MutationAdded = true;
}

/** Configure createUser operation + variables (Extraction tab is a separate step). */
export async function ensureLesson18MutationConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18MutationNodeAdded(ctx);
  if (_lesson18MutationConfigured && isLesson18CreateMutationOpReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_CREATE });
  await waitForWfConfigPanel(ctx, GQL.WF_MUTATION_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Operation');
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

/** Add Fetch User query node and wire Create → Query. */
export async function ensureLesson18QueryNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18MutationOutputBound(ctx);
  const fetchPresent = isLesson18NodeOnCanvas(LESSON18_NODE_FETCH, 'graphqlQuery');
  const createToFetchWired = lesson18EdgeExists(LESSON18_NODE_CREATE, LESSON18_NODE_FETCH);
  if (_lesson18QueryAdded && fetchPresent && createToFetchWired) {
    return;
  }

  if (!fetchPresent) {
    await addLesson18PaletteNode(
      ctx,
      'graphqlQuery',
      LESSON18_NODE_FETCH,
      'Fetch User',
      { x: 480, y: 150 },
      WF.PAL_GQL_QUERY,
    );
  }
  connectLesson18Edge(
    LESSON18_NODE_CREATE,
    LESSON18_NODE_FETCH,
    WF.NODE_GQL_MUTATION,
    WF.NODE_GQL_QUERY,
  );
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson18QueryAdded = true;
}

/** Configure read-back query operation + variables. */
export async function ensureLesson18QueryOperationConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryNodeAdded(ctx);
  if (_lesson18QueryOpConfigured && isLesson18FetchQueryOpReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_FETCH });
  await waitForWfConfigPanel(ctx, GQL.WF_QUERY_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Operation');
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON18_GET_USER_QUERY);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Variables');
  await fillWfConfigField(ctx, GQL.WF_VARIABLES_EDITOR, LESSON18_QUERY_VARS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson18QueryOpConfigured = true;
}

/** Bind query response data → fetchedUser on the Output tab. */
export async function ensureLesson18QueryOutputBound(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryOperationConfigured(ctx);
  if (_lesson18QueryOutputBound && isLesson18FetchNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_FETCH });
  await waitForWfConfigPanel(ctx, GQL.WF_QUERY_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await clickWfConfigAddRow(ctx, GQL.WF_OUTPUT_ADD_BTN, GQL.WF_OUTPUT_FIELD_SELECT);
  }
  await selectWfConfigOption(ctx, GQL.WF_OUTPUT_FIELD_SELECT, 'data');
  await fillWfConfigField(ctx, GQL.WF_OUTPUT_VARNAME, LESSON18_FETCHED_USER_VAR);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson18QueryOutputBound = true;
}

/** Full query node configure (operation + output) — used by quick-test guards. */
export async function ensureLesson18QueryConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryOutputBound(ctx);
}

/** Add Verify User assert node; wire Query → Assert → End. */
export async function ensureLesson18AssertNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18QueryOutputBound(ctx);
  const assertPresent = isLesson18NodeOnCanvas(LESSON18_NODE_ASSERT, 'graphqlAssert');
  const endId = resolveLesson18EndNodeId();
  const fetchToAssertWired = lesson18EdgeExists(LESSON18_NODE_FETCH, LESSON18_NODE_ASSERT);
  const assertToEndWired = Boolean(endId && lesson18EdgeExists(LESSON18_NODE_ASSERT, endId));
  if (_lesson18AssertAdded && assertPresent && fetchToAssertWired && (!endId || assertToEndWired)) {
    return;
  }

  if (!assertPresent) {
    await addLesson18PaletteNode(
      ctx,
      'graphqlAssert',
      LESSON18_NODE_ASSERT,
      'Verify User',
      { x: 680, y: 150 },
      WF.PAL_GQL_ASSERT,
    );
  }
  connectLesson18Edge(
    LESSON18_NODE_FETCH,
    LESSON18_NODE_ASSERT,
    WF.NODE_GQL_QUERY,
    WF.NODE_GQL_ASSERT,
  );
  if (endId) {
    connectLesson18Edge(
      LESSON18_NODE_ASSERT,
      endId,
      WF.NODE_GQL_ASSERT,
      WF.NODE_END,
    );
  } else {
    connectWfNodesBySelector(WF.NODE_GQL_ASSERT, WF.NODE_END);
  }
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson18AssertAdded = true;
}

/** Set assert source variable to fetchedUser. */
export async function ensureLesson18AssertSourceConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertNodeAdded(ctx);
  if (_lesson18AssertSourceConfigured && isLesson18AssertSourceReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_ASSERT });
  await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
  await fillWfConfigField(ctx, WF.WF_GQL_ASSERT_SOURCE, LESSON18_FETCHED_USER_VAR);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson18AssertSourceConfigured = true;
}

/** Add equals assertion on $.user.name. */
export async function ensureLesson18AssertRuleConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertSourceConfigured(ctx);
  if (_lesson18AssertRuleConfigured && isLesson18AssertNodeReady()) return;

  await openWfNodeConfigModal(ctx, { nodeId: LESSON18_NODE_ASSERT });
  await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
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
  _lesson18AssertRuleConfigured = true;
}

/** Configure assert source + rule (quick-test guard). */
export async function ensureLesson18AssertConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertRuleConfigured(ctx);
}

async function runLesson18QuickTest(
  ctx: DemoActionContext,
  opts?: { requirePass?: boolean },
): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  patchLesson18WorkflowVariablesQuiet();
  await openWfConsoleIfClosed(ctx);
  await clickWfFitView(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(300);
  await ctx.click(WF.QUICK_TEST_BTN);
  if (opts?.requirePass) {
    await ctx.waitFor('.wf-exec-strip-pass', 60000);
  } else {
    await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  }
  await ctx.delay(800);
}

/** Run Quick Test on the create → fetch → assert chain. */
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

  await runLesson18QuickTest(ctx);
  _lesson18QuickTestRun = true;
}

/** Add Delete User node from palette and rewire Assert → Delete → End (quiet guard). */
export async function ensureLesson18DeleteNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18AssertRuleConfigured(ctx);

  if (_lesson18DeleteAdded && isLesson18DeleteOnCanvas()) {
    return;
  }

  await prepareLesson18CanvasForBuilding(ctx);

  if (!isLesson18DeleteOnCanvas()) {
    if (!addWorkflowNodeWithPreset('graphqlMutation', LESSON18_NODE_DELETE, 'Delete User', { x: 780, y: 280 })) {
      await ctx.click(WF.PAL_GQL_MUTATION);
      await ctx.delay(600);
    }
  }

  wireLesson18DeleteNode();
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson18DeleteAdded = true;
}

/** Visible demo: click GraphQL Mutation palette to add Delete User and rewire the chain. */
export async function demonstrateLesson18DeleteNodeAdded(ctx: DemoActionContext): Promise<void> {
  await prepareLesson18CanvasForBuilding(ctx);

  if (_lesson18DeleteAdded && isLesson18DeleteOnCanvas()) {
    await clickWfFitView(ctx);
    return;
  }

  const pal = document.querySelector<HTMLElement>(WF.PAL_GQL_MUTATION);
  pal?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  await ctx.delay(400);
  await ctx.click(WF.PAL_GQL_MUTATION);
  await ctx.waitFor(LESSON18_DELETE_NODE_SELECTOR);
  await ctx.delay(400);

  if (!isLesson18DeleteOnCanvas()) {
    addWorkflowNodeWithPreset('graphqlMutation', LESSON18_NODE_DELETE, 'Delete User', { x: 780, y: 280 });
  }

  wireLesson18DeleteNode();
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson18DeleteAdded = true;
}

function renameLesson18DeleteNodeLabel(deleteNodeId: string): void {
  if (patchWorkflowNodeDataById(deleteNodeId, { label: 'Delete User' })) {
    return;
  }

  const nodes = readLesson18WorkflowNodes();
  if (!nodes?.length) return;

  const targetId =
    nodes.some((n) => n.id === deleteNodeId)
      ? deleteNodeId
      : nodes.find((n) => n.type === 'graphqlMutation' && n.id !== LESSON18_NODE_CREATE)?.id;
  if (!targetId) return;

  patchWorkflowByName(LESSON18_WF_NAME, {
    nodes: nodes.map((n) =>
      n.id === targetId
        ? { ...n, data: { ...n.data, label: 'Delete User' } }
        : n,
    ),
  });
}

function wireLesson18DeleteNode(): void {
  const deleteNodeId = resolveLesson18DeleteNodeId();
  const endId = resolveLesson18EndNodeId();
  if (endId) {
    removeWorkflowEdge(LESSON18_NODE_ASSERT, endId);
  }
  connectLesson18Edge(
    LESSON18_NODE_ASSERT,
    deleteNodeId,
    WF.NODE_GQL_ASSERT,
    WF.NODE_GQL_MUTATION,
  );
  if (endId) {
    connectLesson18Edge(deleteNodeId, endId, WF.NODE_GQL_MUTATION, WF.NODE_END);
  } else {
    connectWfNodesBySelector(WF.NODE_GQL_MUTATION, WF.NODE_END);
  }
  renameLesson18DeleteNodeLabel(deleteNodeId);
}

/** Configure deleteUser teardown mutation (quiet guard). */
export async function ensureLesson18DeleteConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson18DeleteNodeAdded(ctx);
  if (_lesson18DeleteConfigured && isLesson18DeleteNodeReady()) return;

  await configureLesson18DeleteNode(ctx);
  _lesson18DeleteConfigured = true;
}

/** Visible demo: open Delete User config and fill deleteUser operation + variables. */
export async function demonstrateLesson18DeleteConfigured(ctx: DemoActionContext): Promise<void> {
  if (_lesson18DeleteConfigured && isLesson18DeleteNodeReady()) return;

  await configureLesson18DeleteNode(ctx);
  _lesson18DeleteConfigured = true;
}

async function configureLesson18DeleteNode(ctx: DemoActionContext): Promise<void> {
  const deleteNodeId = resolveLesson18DeleteNodeId();
  await openWfNodeConfigModal(ctx, { nodeId: deleteNodeId });
  await waitForWfConfigPanel(ctx, GQL.WF_MUTATION_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Operation');
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON18_DELETE_MUTATION);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Variables');
  await fillWfConfigField(ctx, GQL.WF_VARIABLES_EDITOR, LESSON18_DELETE_VARS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  await clickWfFitView(ctx);
}

/** Re-run Quick Test with teardown node — all four action nodes should pass. */
export async function ensureLesson18FinalQuickTestRun(ctx: DemoActionContext): Promise<void> {
  if (!isLesson18DeleteNodeReady()) {
    await ensureLesson18DeleteConfigured(ctx);
  }
  if (_lesson18FinalQuickTestRun && isLesson18QuickTestPassVisible() && isLesson18DeleteNodeReady()) {
    return;
  }

  await dismissWorkflowExecSummary(ctx);
  await runLesson18QuickTest(ctx, { requirePass: true });
  _lesson18FinalQuickTestRun = true;
}

// ── Setup / Cleanup ───────────────────────────────────────────────────────────

export async function gqlWorkflowMutationLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson18SessionFlags();
  if (deleteWorkflowByName(LESSON18_WF_NAME)) {
    await ctx.delay(300);
  }
  await cleanupWorkflowDemoRunUi(ctx);
  await closeWfConfigModalIfOpen(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);
}

export async function gqlWorkflowMutationLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  await cleanupWorkflowDemoRunUi(ctx);
  deleteWorkflowByName(LESSON18_WF_NAME);
  resetGqlLesson18SessionFlags();
  await ctx.delay(100);
}
