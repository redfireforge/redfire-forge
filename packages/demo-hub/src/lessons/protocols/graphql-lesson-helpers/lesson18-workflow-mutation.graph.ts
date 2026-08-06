import { GQL, WF } from '@shared/selectors';
import {
  connectWorkflowNodes,
  getWorkflowByName,
  patchWorkflowByName,
  patchWorkflowNodeDataById,
  removeWorkflowEdge,
} from '../../../adapters';
import {
  GQL_DEMO_HTTP,
  LESSON18_CREATED_USER_ID_VAR,
  LESSON18_CREATE_MUTATION,
  LESSON18_EXTRACTION_JSONPATH,
  LESSON18_FETCHED_USER_VAR,
  LESSON18_GET_USER_QUERY,
  LESSON18_MUTATION_VARS,
  LESSON18_NODE_ASSERT,
  LESSON18_NODE_CREATE,
  LESSON18_NODE_DELETE,
  LESSON18_NODE_END,
  LESSON18_NODE_FETCH,
  LESSON18_NODE_START,
  LESSON18_QUERY_VARS,
  LESSON18_TEST_NAME,
  LESSON18_TEST_NAME_VAR,
  LESSON18_WF_NAME,
} from './lesson18-workflow-mutation.constants';

export type Lesson18NodeSnapshot = { id: string; type: string; data: Record<string, unknown> };
export type Lesson18EdgeSnapshot = { source: string; target: string };
export type Lesson18WorkflowSnapshot = {
  nodes?: Lesson18NodeSnapshot[];
  edges?: Lesson18EdgeSnapshot[];
};

export const lesson18Session = {
  created: false,
  sidebarCollapsed: false,
  variablesConfigured: false,
  mutationAdded: false,
  mutationConfigured: false,
  outputBound: false,
  queryAdded: false,
  queryOpConfigured: false,
  queryOutputBound: false,
  assertAdded: false,
  assertSourceConfigured: false,
  assertRuleConfigured: false,
  quickTestRun: false,
  deleteAdded: false,
  deleteConfigured: false,
  finalQuickTestRun: false,
};

export function resetGqlLesson18SessionFlags(): void {
  lesson18Session.created = false;
  lesson18Session.sidebarCollapsed = false;
  lesson18Session.variablesConfigured = false;
  lesson18Session.mutationAdded = false;
  lesson18Session.mutationConfigured = false;
  lesson18Session.outputBound = false;
  lesson18Session.queryAdded = false;
  lesson18Session.queryOpConfigured = false;
  lesson18Session.queryOutputBound = false;
  lesson18Session.assertAdded = false;
  lesson18Session.assertSourceConfigured = false;
  lesson18Session.assertRuleConfigured = false;
  lesson18Session.quickTestRun = false;
  lesson18Session.deleteAdded = false;
  lesson18Session.deleteConfigured = false;
  lesson18Session.finalQuickTestRun = false;
}

/** True when workflow store has testName = Demo User (CRUD seed variable). */
export function isLesson18WorkflowVariablesConfigured(): boolean {
  const wf = readLesson18Workflow() as { variables?: Record<string, unknown> } | null;
  const vars = wf?.variables ?? {};
  return String(vars[LESSON18_TEST_NAME_VAR] ?? '').trim() === LESSON18_TEST_NAME;
}

export function readLesson18Workflow(): Lesson18WorkflowSnapshot | null {
  return getWorkflowByName<Lesson18WorkflowSnapshot>(LESSON18_WF_NAME);
}

export function readLesson18WorkflowNodes(): Lesson18NodeSnapshot[] | null {
  return readLesson18Workflow()?.nodes ?? null;
}

export function readLesson18WorkflowEdges(): Lesson18EdgeSnapshot[] {
  return readLesson18Workflow()?.edges ?? [];
}

export function lesson18NodeIdExists(nodeId: string): boolean {
  return readLesson18WorkflowNodes()?.some((n) => n.id === nodeId) ?? false;
}

export function resolveLesson18StartNodeId(): string | null {
  return readLesson18WorkflowNodes()?.find((n) => n.type === 'start')?.id ?? null;
}

export function resolveLesson18EndNodeId(): string | null {
  return readLesson18WorkflowNodes()?.find((n) => n.type === 'end')?.id ?? null;
}

export function lesson18EdgeExists(sourceId: string, targetId: string): boolean {
  return readLesson18WorkflowEdges().some((e) => e.source === sourceId && e.target === targetId);
}

export function connectWfNodesById(
  sourceId: string,
  targetId: string,
  sourceHandle: string | null = null,
): boolean {
  if (!lesson18NodeIdExists(sourceId) || !lesson18NodeIdExists(targetId)) {
    return false;
  }
  return connectWorkflowNodes(sourceId, targetId, sourceHandle, null);
}

export function connectWfNodesBySelector(
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
export function connectLesson18Edge(
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

export function lesson18NodeData(nodeId: string): Record<string, unknown> | null {
  const node = readLesson18WorkflowNodes()?.find((n) => n.id === nodeId);
  return node?.data ?? null;
}

export function isLesson18NodeOnCanvas(nodeId: string, type?: string): boolean {
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

export function isLesson18DeleteOnCanvas(): boolean {
  const nodes = readLesson18WorkflowNodes();
  if (nodes) {
    return nodes.some((n) => n.type === 'graphqlMutation' && n.id !== LESSON18_NODE_CREATE);
  }
  return !!document.querySelector(`[data-id="${LESSON18_NODE_DELETE}"]`);
}

export function isLesson18QuickTestPassVisible(): boolean {
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

export function patchLesson18WorkflowVariablesQuiet(): boolean {
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

export function renameLesson18DeleteNodeLabel(deleteNodeId: string): void {
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

export function wireLesson18DeleteNode(): void {
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
