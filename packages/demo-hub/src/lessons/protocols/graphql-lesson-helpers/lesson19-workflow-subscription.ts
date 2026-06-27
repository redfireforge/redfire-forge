// ── Lesson 19: GraphQL Subscription Node in Workflow ───────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL, WF } from '@shared/selectors';
import { GQL_DEMO_HTTP } from './core';
import {
  clickWfConfigAddRow,
  clickWfConfigTab,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  cleanupWorkflowDemoRunUi,
  collapseWfDemoAppSidebar,
  ensureWfNodeConfigModalOpen,
  fillWfConfigField,
  isWfConfigTabActive,
  openWfConsoleIfClosed,
  pauseWfConfigSection,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  selectWorkflowFromAppSidebar,
} from '../../wf-demo-helpers';
import {
  deleteWorkflowByName,
  getWorkflowByName,
  seedNamedWorkflow,
} from '../../../adapters';

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
export const LESSON19_STOP_AFTER_SECS = '10';

/** Collect all three status events (PENDING → PROCESSING → COMPLETE). */
export const LESSON19_STOP_AFTER_MESSAGES = '3';

type SubConfigTab = 'Subscription' | 'Stop' | 'Output';

// ── Session flags ─────────────────────────────────────────────────────────────

let _lesson19Loaded = false;
let _lesson19SubscriptionConfigured = false;
let _lesson19SubscriptionTimeout = false;
let _lesson19SubscriptionCorrelation = false;
let _lesson19SubscriptionOutput = false;
let _lesson19QuickTestRun = false;

export function resetGqlLesson19SessionFlags(): void {
  _lesson19Loaded = false;
  _lesson19SubscriptionConfigured = false;
  _lesson19SubscriptionTimeout = false;
  _lesson19SubscriptionCorrelation = false;
  _lesson19SubscriptionOutput = false;
  _lesson19QuickTestRun = false;
}

// ── Workflow readiness ────────────────────────────────────────────────────────

type Lesson19NodeSnapshot = { id: string; type: string; data: Record<string, unknown> };

function readLesson19WorkflowNodes(): Lesson19NodeSnapshot[] | null {
  return getWorkflowByName<{ nodes?: Lesson19NodeSnapshot[] }>(LESSON19_WF_NAME)?.nodes ?? null;
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

export function isLesson19SubQueryReady(): boolean {
  const data = lesson19NodeData(LESSON19_NODE_SUB);
  const endpoint = String(data?.endpoint ?? '').trim();
  const subQuery = String(data?.subscriptionQuery ?? '').trim();
  const variables = String(data?.variables ?? '').trim();
  return !!(endpoint && subQuery.includes('orderStatus') && variables.includes(`{{${LESSON19_ORDER_ID_VAR}}}`));
}

export function isLesson19SubNodeReady(): boolean {
  const data = lesson19NodeData(LESSON19_NODE_SUB);
  const bindings = data?.outputBindings as Array<{ field?: string; variableName?: string; enabled?: boolean }> | undefined;
  return !!(
    isLesson19SubQueryReady()
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

/** Pre-wired canvas: mutation + assert ready; subscription stop/output filled during the lesson. */
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
          subscriptionQuery: '',
          variables: LESSON19_SUBSCRIPTION_VARS,
          headers: [],
          subscriptionTransport: 'auto',
          extractionRules: [],
          outputBindings: [],
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

/** Open the subscription node config on the tab the narration describes — without redundant close/reopen. */
async function ensureLesson19SubConfigTabOpen(ctx: DemoActionContext, tab: SubConfigTab): Promise<void> {
  await ensureLesson19WorkflowLoaded(ctx);
  await ensureWfNodeConfigModalOpen(ctx, {
    nodeId: LESSON19_NODE_SUB,
    panelSelector: GQL.WF_SUBSCRIPTION_PANEL,
  });
  if (!isWfConfigTabActive(GQL.WF_SUBSCRIPTION_PANEL, tab)) {
    await clickWfConfigTab(ctx, GQL.WF_SUBSCRIPTION_PANEL, tab);
  }
  await ctx.delay(800);
}

export async function selectGqlOrderFlowDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  await selectWorkflowFromAppSidebar(ctx, LESSON19_WF_NAME);
  _lesson19Loaded = true;
}

// ── Reading-phase spotlight prep (opens the panel the narration describes) ─────

export async function prepareLesson19SubscriptionSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Subscription');
}

export async function prepareLesson19StopTimeoutSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Stop');
}

export async function prepareLesson19StopMessagesSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Stop');
}

export async function prepareLesson19OutputSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Output');
}

export async function prepareLesson19QuickTestSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19WorkflowLoaded(ctx);
  await closeWfConfigModalIfOpen(ctx);
  await openWfConsoleIfClosed(ctx);
  await clickWfFitView(ctx);
}

export async function prepareLesson19SummarySpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19WorkflowLoaded(ctx);
  await closeWfConfigModalIfOpen(ctx);
  await closeWfConsoleIfOpen(ctx);
  await clickWfFitView(ctx);
}

// ── Guard helpers (quiet state recovery) ──────────────────────────────────────

export async function ensureLesson19WorkflowLoaded(ctx: DemoActionContext): Promise<void> {
  if (_lesson19Loaded && document.querySelector(WF.CANVAS)) {
    await collapseWfDemoAppSidebar(ctx);
    return;
  }
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);
  await selectGqlOrderFlowDemoWorkflow(ctx);
  await clickWfFitView(ctx);
}

// ── Visible demo actions (always walk through UI — never skip on session flags) ─

export async function performLesson19SubscriptionConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Subscription');
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_SUBSCRIPTION_QUERY_EDITOR, LESSON19_SUBSCRIPTION_QUERY);
  await fillWfConfigField(ctx, GQL.WF_SUB_VARIABLES_EDITOR, LESSON19_SUBSCRIPTION_VARS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson19SubscriptionConfigured = true;
}

export async function performLesson19SubscriptionTimeout(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Stop');
  await fillWfConfigField(ctx, GQL.WF_STOP_SECS_INPUT, LESSON19_STOP_AFTER_SECS);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson19SubscriptionTimeout = true;
}

export async function performLesson19SubscriptionCorrelation(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Stop');
  await fillWfConfigField(ctx, GQL.WF_STOP_MESSAGES_INPUT, LESSON19_STOP_AFTER_MESSAGES);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson19SubscriptionCorrelation = true;
}

export async function performLesson19SubscriptionOutputBound(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await clickWfConfigAddRow(ctx, GQL.WF_OUTPUT_ADD_BTN, GQL.WF_OUTPUT_FIELD_SELECT);
  }
  await selectWfConfigOption(ctx, GQL.WF_OUTPUT_FIELD_SELECT, 'lastMessage');
  await fillWfConfigField(ctx, GQL.WF_OUTPUT_VARNAME, LESSON19_FINAL_STATUS_VAR);
  await pauseWfConfigSection(ctx);
  await saveAndCloseWfConfigModal(ctx);
  _lesson19SubscriptionOutput = true;
}

export async function performLesson19QuickTestRun(ctx: DemoActionContext): Promise<void> {
  await prepareLesson19QuickTestSpotlight(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(300);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 45000);
  await ctx.delay(800);
  _lesson19QuickTestRun = true;
}

// ── Quiet ensure wrappers (preAction recovery when user skips ahead) ──────────

export async function ensureLesson19SubscriptionConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19WorkflowLoaded(ctx);
  if (_lesson19SubscriptionConfigured && isLesson19SubQueryReady()) return;
  await performLesson19SubscriptionConfigured(ctx);
}

export async function ensureLesson19SubscriptionTimeout(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionConfigured(ctx);
  const stopMs = lesson19NodeData(LESSON19_NODE_SUB)?.stopAfterMs;
  if (_lesson19SubscriptionTimeout && stopMs === Number(LESSON19_STOP_AFTER_SECS) * 1000) return;
  await performLesson19SubscriptionTimeout(ctx);
}

export async function ensureLesson19SubscriptionCorrelation(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionTimeout(ctx);
  const stopMsgs = lesson19NodeData(LESSON19_NODE_SUB)?.stopAfterMessages;
  if (_lesson19SubscriptionCorrelation && stopMsgs === Number(LESSON19_STOP_AFTER_MESSAGES)) return;
  await performLesson19SubscriptionCorrelation(ctx);
}

export async function ensureLesson19SubscriptionOutputBound(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionCorrelation(ctx);
  if (_lesson19SubscriptionOutput && isLesson19SubNodeReady()) return;
  await performLesson19SubscriptionOutputBound(ctx);
}

export async function ensureLesson19QuickTestRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionOutputBound(ctx);
  if (_lesson19QuickTestRun && isLesson19QuickTestPassVisible() && isLesson19SubNodeReady()) return;
  await performLesson19QuickTestRun(ctx);
}

export async function gqlWorkflowSubscriptionLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson19SessionFlags();
  await cleanupWorkflowDemoRunUi(ctx);
  await seedNamedWorkflow(ctx, LESSON19_WF_NAME, createGqlOrderFlowDemoWorkflow(), {
    deleteDelayMs: 100,
    insertDelayMs: 300,
  });
  await closeWfConfigModalIfOpen(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);
  await selectGqlOrderFlowDemoWorkflow(ctx);
  await clickWfFitView(ctx);
}

export async function gqlWorkflowSubscriptionLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  await cleanupWorkflowDemoRunUi(ctx);
  deleteWorkflowByName(LESSON19_WF_NAME);
  resetGqlLesson19SessionFlags();
  await ctx.delay(100);
}
