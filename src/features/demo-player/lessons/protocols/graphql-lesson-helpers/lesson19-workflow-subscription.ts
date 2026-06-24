// ── Lesson 19: GraphQL Subscription Node in Workflow ───────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL, WF } from '../../../../../shared/selectors';
import { GQL_DEMO_HTTP } from './core';

export { GQL_DEMO_HTTP };

export const LESSON19_WF_NAME = 'GraphQL Order Flow Demo';
export const LESSON19_CUSTOMER_ID = 'CUST-001';
export const LESSON19_ORDER_ID_VAR = 'orderId';
export const LESSON19_FINAL_STATUS_VAR = 'finalStatus';

export const LESSON19_NODE_START = 'gql19-start';
export const LESSON19_NODE_CREATE = 'gql19-create-order';
export const LESSON19_NODE_SUB = 'gql19-watch-status';
export const LESSON19_NODE_ASSERT = 'gql19-assert';
export const LESSON19_NODE_END = 'gql19-end';

export const LESSON19_CREATE_ORDER_MUTATION =
  'mutation CreateOrder($input: OrderInput!) {\n' +
  '  createOrder(input: $input) {\n' +
  '    id\n' +
  '    status\n' +
  '  }\n' +
  '}';

export const LESSON19_CREATE_ORDER_VARS =
  '{\n  "input": {\n    "customerId": "{{customerId}}",\n    "items": []\n  }\n}';

export const LESSON19_ORDER_ID_JSONPATH = '$.createOrder.id';

export const LESSON19_SUBSCRIPTION_QUERY =
  'subscription WatchOrder($orderId: ID!) {\n' +
  '  orderStatus(orderId: $orderId) {\n' +
  '    status\n' +
  '    updatedAt\n' +
  '  }\n' +
  '}';

/** No quotes around {{orderId}} — extraction stores JSON-serialized scalars. */
export const LESSON19_SUBSCRIPTION_VARS = '{\n  "orderId": {{orderId}}\n}';

/** Wall-clock safety cap (seconds) on the Stop tab — analogous to Kafka maxWaitMs. */
export const LESSON19_STOP_AFTER_SECS = '5';

/** Collect all three status events (PENDING → PROCESSING → COMPLETE). */
export const LESSON19_STOP_AFTER_MESSAGES = '3';

// ── Session flags ─────────────────────────────────────────────────────────────

let _lesson19Loaded = false;
let _lesson19MutationConfigured = false;
let _lesson19SubscriptionConfigured = false;
let _lesson19SubscriptionTimeout = false;
let _lesson19SubscriptionCorrelation = false;
let _lesson19SubscriptionOutput = false;
let _lesson19AssertConfigured = false;
let _lesson19QuickTestRun = false;

export function resetGqlLesson19SessionFlags(): void {
  _lesson19Loaded = false;
  _lesson19MutationConfigured = false;
  _lesson19SubscriptionConfigured = false;
  _lesson19SubscriptionTimeout = false;
  _lesson19SubscriptionCorrelation = false;
  _lesson19SubscriptionOutput = false;
  _lesson19AssertConfigured = false;
  _lesson19QuickTestRun = false;
}

// ── Workflow readiness ────────────────────────────────────────────────────────

type Lesson19NodeSnapshot = { id: string; type: string; data: Record<string, unknown> };

function readLesson19WorkflowNodes(): Lesson19NodeSnapshot[] | null {
  const get = (window as unknown as Record<string, unknown>).__wfGetWorkflowByName as
    | ((name: string) => { nodes?: Lesson19NodeSnapshot[] } | null)
    | undefined;
  return get?.(LESSON19_WF_NAME)?.nodes ?? null;
}

function lesson19NodeData(nodeId: string): Record<string, unknown> | null {
  const node = readLesson19WorkflowNodes()?.find((n) => n.id === nodeId);
  return node?.data ?? null;
}

export function isLesson19CreateNodeReady(): boolean {
  const data = lesson19NodeData(LESSON19_NODE_CREATE);
  const endpoint = String(data?.endpoint ?? '').trim();
  const query = String(data?.query ?? '').trim();
  const rules = data?.extractionRules as Array<{ variableName?: string }> | undefined;
  return !!(endpoint && query.includes('createOrder') && rules?.some((r) => r.variableName === LESSON19_ORDER_ID_VAR));
}

export function isLesson19SubNodeReady(): boolean {
  const data = lesson19NodeData(LESSON19_NODE_SUB);
  const endpoint = String(data?.endpoint ?? '').trim();
  const subQuery = String(data?.subscriptionQuery ?? '').trim();
  const bindings = data?.outputBindings as Array<{ field?: string; variableName?: string; enabled?: boolean }> | undefined;
  return !!(
    endpoint
    && subQuery.includes('orderStatus')
    && data?.stopAfterMessages === Number(LESSON19_STOP_AFTER_MESSAGES)
    && data?.stopAfterMs === Number(LESSON19_STOP_AFTER_SECS) * 1000
    && bindings?.some((b) => b.field === 'lastMessage' && b.variableName === LESSON19_FINAL_STATUS_VAR && b.enabled !== false)
  );
}

export function isLesson19AssertNodeReady(): boolean {
  const data = lesson19NodeData(LESSON19_NODE_ASSERT);
  const source = String(data?.sourceVariable ?? '').trim();
  const assertions = data?.assertions as Array<{ jsonPath?: string; expectedValue?: string }> | undefined;
  return !!(source === LESSON19_FINAL_STATUS_VAR && assertions?.some((a) => a.jsonPath === '$.orderStatus.status' && a.expectedValue === 'COMPLETE'));
}

function isLesson19QuickTestPassVisible(): boolean {
  return !!document.querySelector('.wf-exec-strip-pass');
}

// ── Workflow factory ──────────────────────────────────────────────────────────

/** Pre-wired: Start → createOrder → orderStatus subscription → assert → End (lesson-ready defaults). */
export function createGqlOrderFlowDemoWorkflow(): Record<string, unknown> {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: LESSON19_WF_NAME,
    schemaVersion: 6,
    variables: {
      customerId: LESSON19_CUSTOMER_ID,
      [LESSON19_ORDER_ID_VAR]: '',
      [LESSON19_FINAL_STATUS_VAR]: '',
    },
    services: [],
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      {
        id: LESSON19_NODE_START,
        type: 'start',
        position: { x: 100, y: 150 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: LESSON19_NODE_CREATE,
        type: 'graphqlMutation',
        position: { x: 280, y: 150 },
        data: {
          label: 'Create Order',
          endpoint: GQL_DEMO_HTTP,
          query: LESSON19_CREATE_ORDER_MUTATION,
          variables: LESSON19_CREATE_ORDER_VARS,
          headers: [],
          timeoutMs: 30000,
          extractionRules: [
            { variableName: LESSON19_ORDER_ID_VAR, jsonPath: LESSON19_ORDER_ID_JSONPATH },
          ],
          outputBindings: [],
        },
      },
      {
        id: LESSON19_NODE_SUB,
        type: 'graphqlSubscription',
        position: { x: 480, y: 150 },
        data: {
          label: 'Watch Order Status',
          endpoint: GQL_DEMO_HTTP,
          subscriptionQuery: LESSON19_SUBSCRIPTION_QUERY,
          variables: LESSON19_SUBSCRIPTION_VARS,
          headers: [],
          subscriptionTransport: 'auto',
          stopAfterMs: Number(LESSON19_STOP_AFTER_SECS) * 1000,
          stopAfterMessages: Number(LESSON19_STOP_AFTER_MESSAGES),
          extractionRules: [],
          outputBindings: [
            { field: 'lastMessage', variableName: LESSON19_FINAL_STATUS_VAR, enabled: true },
          ],
        },
      },
      {
        id: LESSON19_NODE_ASSERT,
        type: 'graphqlAssert',
        position: { x: 680, y: 150 },
        data: {
          label: 'Assert Complete',
          sourceVariable: LESSON19_FINAL_STATUS_VAR,
          assertions: [{
            id: 'gql19-status-assert',
            jsonPath: '$.orderStatus.status',
            operator: 'equals',
            expectedValue: 'COMPLETE',
            description: 'Order reached COMPLETE status',
          }],
          failBehavior: 'error',
        },
      },
      {
        id: LESSON19_NODE_END,
        type: 'end',
        position: { x: 880, y: 150 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: crypto.randomUUID(), source: LESSON19_NODE_START, target: LESSON19_NODE_CREATE },
      { id: crypto.randomUUID(), source: LESSON19_NODE_CREATE, target: LESSON19_NODE_SUB },
      { id: crypto.randomUUID(), source: LESSON19_NODE_SUB, target: LESSON19_NODE_ASSERT },
      { id: crypto.randomUUID(), source: LESSON19_NODE_ASSERT, target: LESSON19_NODE_END },
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

async function openWfNodeConfigById(ctx: DemoActionContext, nodeId: string): Promise<void> {
  const openConfig = (window as unknown as Record<string, unknown>).__wfOpenNodeConfig as
    | ((id: string) => void)
    | undefined;
  if (openConfig) {
    openConfig(nodeId);
  } else {
    const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`);
    node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  }
  await ctx.delay(400);
}

async function clickWfConfigTab(
  ctx: DemoActionContext,
  panelSelector: string,
  tabLabel: string,
): Promise<void> {
  const panel = document.querySelector(panelSelector);
  const tab = Array.from(panel?.querySelectorAll<HTMLElement>('.wf-config-tab') ?? [])
    .find((b) => b.textContent?.trim().startsWith(tabLabel));
  if (tab) tab.click();
  await ctx.delay(400);
}

async function saveWfConfigModal(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WF.CFG_SAVE);
  await ctx.delay(400);
}

async function closeWfConfigModalQuiet(ctx: DemoActionContext): Promise<void> {
  const close = document.querySelector<HTMLElement>(WF.CFG_CLOSE);
  if (close) {
    close.click();
    await ctx.delay(200);
  }
}

async function fillNumericInput(selector: string, value: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (input) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export async function selectGqlOrderFlowDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  const items = Array.from(
    document.querySelectorAll('.wf-sidebar-item, [data-testid="wf-sidebar-item"], .wf-workflow-item'),
  );
  const target = items.find((el) => el.textContent?.includes(LESSON19_WF_NAME)) as HTMLElement | undefined;
  if (target) {
    target.click();
    await ctx.delay(700);
  }
  _lesson19Loaded = true;
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

export async function ensureLesson19WorkflowLoaded(ctx: DemoActionContext): Promise<void> {
  if (_lesson19Loaded && document.querySelector(WF.CANVAS)) return;
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);
  await selectGqlOrderFlowDemoWorkflow(ctx);
  await clickWfFitView(ctx);
}

export async function ensureLesson19MutationConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19WorkflowLoaded(ctx);
  if (_lesson19MutationConfigured && isLesson19CreateNodeReady()) return;

  await openWfNodeConfigById(ctx, LESSON19_NODE_CREATE);
  await ctx.waitFor(GQL.WF_MUTATION_PANEL, 5000);
  await ctx.fill(WF.WF_GQL_MUTATION_ENDPOINT, GQL_DEMO_HTTP);
  await ctx.delay(300);
  await ctx.fill(GQL.WF_QUERY_EDITOR, LESSON19_CREATE_ORDER_MUTATION);
  await ctx.delay(300);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Variables');
  await ctx.fill(GQL.WF_VARIABLES_EDITOR, LESSON19_CREATE_ORDER_VARS);
  await ctx.delay(300);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Extraction');
  if (!document.querySelector(GQL.WF_EXTRACTION_JSONPATH)) {
    await ctx.click(GQL.WF_EXTRACTION_ADD_BTN);
    await ctx.delay(300);
  }
  await ctx.fill(GQL.WF_EXTRACTION_JSONPATH, LESSON19_ORDER_ID_JSONPATH);
  await ctx.delay(200);
  await ctx.fill(GQL.WF_EXTRACTION_VARNAME, LESSON19_ORDER_ID_VAR);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson19MutationConfigured = true;
}

export async function ensureLesson19SubscriptionConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19MutationConfigured(ctx);
  const subEndpoint = String(lesson19NodeData(LESSON19_NODE_SUB)?.endpoint ?? '').trim();
  const subQuery = String(lesson19NodeData(LESSON19_NODE_SUB)?.subscriptionQuery ?? '').trim();
  if (_lesson19SubscriptionConfigured && subEndpoint && subQuery.includes('orderStatus')) return;

  await openWfNodeConfigById(ctx, LESSON19_NODE_SUB);
  await ctx.waitFor(GQL.WF_SUBSCRIPTION_PANEL, 5000);
  await ctx.fill(WF.WF_GQL_SUBSCRIPTION_ENDPOINT, GQL_DEMO_HTTP);
  await ctx.delay(300);
  await ctx.fill(GQL.WF_SUBSCRIPTION_QUERY_EDITOR, LESSON19_SUBSCRIPTION_QUERY);
  await ctx.delay(300);
  await ctx.fill(GQL.WF_SUB_VARIABLES_EDITOR, LESSON19_SUBSCRIPTION_VARS);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson19SubscriptionConfigured = true;
}

export async function ensureLesson19SubscriptionTimeout(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionConfigured(ctx);
  const stopMs = lesson19NodeData(LESSON19_NODE_SUB)?.stopAfterMs;
  if (_lesson19SubscriptionTimeout && stopMs === Number(LESSON19_STOP_AFTER_SECS) * 1000) return;

  await openWfNodeConfigById(ctx, LESSON19_NODE_SUB);
  await ctx.waitFor(GQL.WF_SUBSCRIPTION_PANEL, 5000);
  await clickWfConfigTab(ctx, GQL.WF_SUBSCRIPTION_PANEL, 'Stop');
  await fillNumericInput(GQL.WF_STOP_SECS_INPUT, LESSON19_STOP_AFTER_SECS);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson19SubscriptionTimeout = true;
}

export async function ensureLesson19SubscriptionCorrelation(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionTimeout(ctx);
  const stopMsgs = lesson19NodeData(LESSON19_NODE_SUB)?.stopAfterMessages;
  if (_lesson19SubscriptionCorrelation && stopMsgs === Number(LESSON19_STOP_AFTER_MESSAGES)) return;

  await openWfNodeConfigById(ctx, LESSON19_NODE_SUB);
  await ctx.waitFor(GQL.WF_SUBSCRIPTION_PANEL, 5000);
  await clickWfConfigTab(ctx, GQL.WF_SUBSCRIPTION_PANEL, 'Stop');
  await fillNumericInput(GQL.WF_STOP_MESSAGES_INPUT, LESSON19_STOP_AFTER_MESSAGES);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson19SubscriptionCorrelation = true;
}

export async function ensureLesson19SubscriptionOutputBound(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionCorrelation(ctx);
  if (_lesson19SubscriptionOutput && isLesson19SubNodeReady()) return;

  await openWfNodeConfigById(ctx, LESSON19_NODE_SUB);
  await ctx.waitFor(GQL.WF_SUBSCRIPTION_PANEL, 5000);
  await clickWfConfigTab(ctx, GQL.WF_SUBSCRIPTION_PANEL, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await ctx.click(GQL.WF_OUTPUT_ADD_BTN);
    await ctx.delay(300);
  }
  await ctx.selectOption(GQL.WF_OUTPUT_FIELD_SELECT, 'lastMessage');
  await ctx.delay(200);
  await ctx.fill(GQL.WF_OUTPUT_VARNAME, LESSON19_FINAL_STATUS_VAR);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson19SubscriptionOutput = true;
}

export async function ensureLesson19AssertConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionOutputBound(ctx);
  if (_lesson19AssertConfigured && isLesson19AssertNodeReady()) return;

  await openWfNodeConfigById(ctx, LESSON19_NODE_ASSERT);
  await ctx.waitFor(GQL.WF_ASSERT_PANEL, 5000);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
  await ctx.fill(WF.WF_GQL_ASSERT_SOURCE, LESSON19_FINAL_STATUS_VAR);
  await ctx.delay(300);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Assertions');
  if (!document.querySelector(GQL.WF_ASSERT_ROW)) {
    await ctx.click(GQL.WF_ASSERT_ADD_BTN);
    await ctx.delay(300);
  }
  await ctx.fill(GQL.WF_ASSERT_JSONPATH, '$.orderStatus.status');
  await ctx.delay(200);
  await ctx.selectOption(GQL.WF_ASSERT_OPERATOR, 'equals');
  await ctx.delay(200);
  await ctx.fill(GQL.WF_ASSERT_EXPECTED, 'COMPLETE');
  await ctx.delay(200);
  await ctx.fill(GQL.WF_ASSERT_DESCRIPTION, 'Order reached COMPLETE status');
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson19AssertConfigured = true;
}

export async function ensureLesson19ConsoleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19AssertConfigured(ctx);
  if (document.querySelector(WF.CONSOLE)) return;
  const badge = document.querySelector<HTMLElement>(WF.CONSOLE_BADGE);
  if (badge) {
    badge.click();
    await ctx.delay(500);
  }
}

export async function ensureLesson19QuickTestRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19ConsoleOpen(ctx);
  if (
    _lesson19QuickTestRun
    && isLesson19QuickTestPassVisible()
    && isLesson19SubNodeReady()
    && isLesson19AssertNodeReady()
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
  await ctx.waitFor(WF.EXEC_SUMMARY, 45000);
  await ctx.delay(800);
  _lesson19QuickTestRun = true;
}

export async function gqlWorkflowSubscriptionLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson19SessionFlags();
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  const wfInsert = (window as unknown as Record<string, unknown>).__wfInsertWorkflow as
    | ((wf: Record<string, unknown>) => void)
    | undefined;
  if (wfDelete) {
    wfDelete(LESSON19_WF_NAME);
    await ctx.delay(100);
  }
  if (wfInsert) {
    wfInsert(createGqlOrderFlowDemoWorkflow());
    await ctx.delay(300);
  }
  await closeWfConfigModalQuiet(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);
  await selectGqlOrderFlowDemoWorkflow(ctx);
  await clickWfFitView(ctx);
}

export async function gqlWorkflowSubscriptionLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalQuiet(ctx);
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  wfDelete?.(LESSON19_WF_NAME);
  resetGqlLesson19SessionFlags();
  await ctx.delay(100);
}
