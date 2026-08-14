// ── Lesson 19: GraphQL Subscription Node in Workflow ───────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL, WF } from '@shared/selectors';
import { GQL_DEMO_HTTP } from './core';
import { spotlightAndPause } from './gql-demo-spotlight';
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
  saveAndCloseWfConfigModal,
  saveWfConfigModal,
  selectWfConfigOption,
  selectWorkflowFromAppSidebar,
  setWfConfigDemoTiming,
  WF_CONFIG_DEMO_TIMING_BRISK,
} from '../../wf-demo-helpers';
import {
  deleteWorkflowByName,
  getWorkflowByName,
  seedNamedWorkflow,
} from '../../../adapters';

/** Field hold during Create Order tour — readable but not sluggish at 1×. */
const CREATE_TOUR_HOLD_MS = 650;

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
let _lesson19SubscriptionVariables = false;
let _lesson19SubscriptionTimeout = false;
let _lesson19SubscriptionCorrelation = false;
let _lesson19SubscriptionOutput = false;
let _lesson19QuickTestRun = false;

export function resetGqlLesson19SessionFlags(): void {
  _lesson19Loaded = false;
  _lesson19SubscriptionConfigured = false;
  _lesson19SubscriptionVariables = false;
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

/** Endpoint + subscription query filled (Variables may still be empty). */
export function isLesson19SubOperationReady(): boolean {
  const data = lesson19NodeData(LESSON19_NODE_SUB);
  const endpoint = String(data?.endpoint ?? '').trim();
  const subQuery = String(data?.subscriptionQuery ?? '').trim();
  return !!(endpoint && subQuery.includes('orderStatus'));
}

/** Correlation Variables JSON references {{orderId}} without extra quotes. */
export function isLesson19SubVariablesReady(): boolean {
  const variables = String(lesson19NodeData(LESSON19_NODE_SUB)?.variables ?? '').trim();
  return variables.includes(`{{${LESSON19_ORDER_ID_VAR}}}`);
}

/** Full Subscription-tab readiness (operation + Variables correlation). */
export function isLesson19SubQueryReady(): boolean {
  return isLesson19SubOperationReady() && isLesson19SubVariablesReady();
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

/**
 * Pre-wired canvas: mutation + assert ready.
 * Subscription query / Variables / Stop / Output are filled during the lesson
 * so each beat teaches one concept.
 */
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
          // Empty until the Variables step — teaches correlation visibly.
          variables: '{}',
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
    await ctx.delay(300);
  }
}

/** Open the subscription node config on the tab the narration describes — without redundant close/reopen. */
async function ensureLesson19SubConfigTabOpen(ctx: DemoActionContext, tab: SubConfigTab): Promise<void> {
  await ensureLesson19WorkflowLoaded(ctx);
  // canvasTestId lets openWfNodeConfigModal spotlight Watch Order Status on the
  // canvas before the panel opens — viewers see which node is being configured.
  await ensureWfNodeConfigModalOpen(ctx, {
    nodeId: LESSON19_NODE_SUB,
    canvasTestId: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
    panelSelector: GQL.WF_SUBSCRIPTION_PANEL,
  });
  if (!isWfConfigTabActive(GQL.WF_SUBSCRIPTION_PANEL, tab)) {
    await clickWfConfigTab(ctx, GQL.WF_SUBSCRIPTION_PANEL, tab);
  }
}

async function ensureLesson19CreateConfigTabOpen(
  ctx: DemoActionContext,
  tab: 'Operation' | 'Variables' | 'Extraction',
): Promise<void> {
  await ensureLesson19WorkflowLoaded(ctx);
  await ensureWfNodeConfigModalOpen(ctx, {
    nodeId: LESSON19_NODE_CREATE,
    canvasTestId: GQL.WF_CANVAS_MUTATION_NODE,
    panelSelector: GQL.WF_MUTATION_PANEL,
  });
  if (!isWfConfigTabActive(GQL.WF_MUTATION_PANEL, tab)) {
    await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, tab);
  }
}

export async function selectGqlOrderFlowDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  await selectWorkflowFromAppSidebar(ctx, LESSON19_WF_NAME);
  _lesson19Loaded = true;
}

// ── Reading-phase spotlight prep (opens the panel the narration describes) ─────

export async function prepareLesson19CreateOrderSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19CreateConfigTabOpen(ctx, 'Operation');
}

export async function prepareLesson19SubscriptionSpotlight(ctx: DemoActionContext): Promise<void> {
  // Only dismiss another node's config — closing and reopening the subscription
  // panel makes the spotlight flicker for no reason.
  if (!document.querySelector(GQL.WF_SUBSCRIPTION_PANEL)) {
    await closeWfConfigModalIfOpen(ctx);
  }
  await ensureLesson19SubConfigTabOpen(ctx, 'Subscription');
}

export async function prepareLesson19VariablesSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Subscription');
  // Scroll Variables into view so the reading spotlight lands on the field.
  const vars = document.querySelector<HTMLElement>(GQL.WF_SUB_VARIABLES_EDITOR);
  vars?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  await ctx.delay(250);
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

/**
 * Open Create Order and spotlight the seeded Operation → Variables → Extraction
 * fields so viewers see how orderId is produced (not narration-only).
 */
export async function performLesson19CreateOrderTour(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19CreateConfigTabOpen(ctx, 'Operation');
  await spotlightAndPause(ctx, GQL.WF_ENDPOINT_INPUT, CREATE_TOUR_HOLD_MS);
  await spotlightAndPause(ctx, GQL.WF_QUERY_EDITOR, CREATE_TOUR_HOLD_MS);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Variables');
  await spotlightAndPause(ctx, GQL.WF_VARIABLES_EDITOR, CREATE_TOUR_HOLD_MS);
  await clickWfConfigTab(ctx, GQL.WF_MUTATION_PANEL, 'Extraction');
  await spotlightAndPause(ctx, GQL.WF_EXTRACTION_JSONPATH, CREATE_TOUR_HOLD_MS);
  await spotlightAndPause(ctx, GQL.WF_EXTRACTION_VARNAME, CREATE_TOUR_HOLD_MS);
  await closeWfConfigModalIfOpen(ctx);
}

/** Endpoint + subscription query only — Variables are a separate teaching beat. */
export async function performLesson19SubscriptionConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Subscription');
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_HTTP);
  await fillWfConfigField(ctx, GQL.WF_SUBSCRIPTION_QUERY_EDITOR, LESSON19_SUBSCRIPTION_QUERY);
  // Keep modal open for Variables / Stop / Output — avoids reopen dead air.
  await saveWfConfigModal(ctx);
  _lesson19SubscriptionConfigured = true;
}

/** Correlation Variables — scope the WebSocket to this run's {{orderId}}. */
export async function performLesson19SubscriptionVariables(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Subscription');
  await fillWfConfigField(ctx, GQL.WF_SUB_VARIABLES_EDITOR, LESSON19_SUBSCRIPTION_VARS);
  await saveWfConfigModal(ctx);
  _lesson19SubscriptionVariables = true;
}

export async function performLesson19SubscriptionTimeout(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Stop');
  await fillWfConfigField(ctx, GQL.WF_STOP_SECS_INPUT, LESSON19_STOP_AFTER_SECS);
  await saveWfConfigModal(ctx);
  _lesson19SubscriptionTimeout = true;
}

/** Stop after N messages — collect the full PENDING → PROCESSING → COMPLETE stream. */
export async function performLesson19SubscriptionCorrelation(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Stop');
  await fillWfConfigField(ctx, GQL.WF_STOP_MESSAGES_INPUT, LESSON19_STOP_AFTER_MESSAGES);
  await saveWfConfigModal(ctx);
  _lesson19SubscriptionCorrelation = true;
}

export async function performLesson19SubscriptionOutputBound(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubConfigTabOpen(ctx, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await clickWfConfigAddRow(ctx, GQL.WF_OUTPUT_ADD_BTN, GQL.WF_OUTPUT_FIELD_SELECT);
  }
  await selectWfConfigOption(ctx, GQL.WF_OUTPUT_FIELD_SELECT, 'lastMessage');
  await fillWfConfigField(ctx, GQL.WF_OUTPUT_VARNAME, LESSON19_FINAL_STATUS_VAR);
  await saveAndCloseWfConfigModal(ctx);
  _lesson19SubscriptionOutput = true;
}

export async function performLesson19QuickTestRun(ctx: DemoActionContext): Promise<void> {
  await prepareLesson19QuickTestSpotlight(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(200);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 45000);
  await ctx.delay(500);
  _lesson19QuickTestRun = true;
}

// ── Quiet ensure wrappers (preAction recovery when user skips ahead) ──────────

export async function ensureLesson19SubscriptionConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19WorkflowLoaded(ctx);
  if (_lesson19SubscriptionConfigured && isLesson19SubOperationReady()) return;
  await performLesson19SubscriptionConfigured(ctx);
}

export async function ensureLesson19SubscriptionVariables(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionConfigured(ctx);
  if (_lesson19SubscriptionVariables && isLesson19SubVariablesReady()) return;
  await performLesson19SubscriptionVariables(ctx);
}

export async function ensureLesson19SubscriptionTimeout(ctx: DemoActionContext): Promise<void> {
  await ensureLesson19SubscriptionVariables(ctx);
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
  // Dense Create tour + multi-tab Watch config — skip default 2s modalOpen dead air.
  setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
  resetGqlLesson19SessionFlags();
  await cleanupWorkflowDemoRunUi(ctx);
  await seedNamedWorkflow(ctx, LESSON19_WF_NAME, createGqlOrderFlowDemoWorkflow(), {
    deleteDelayMs: 100,
    insertDelayMs: 200,
  });
  await closeWfConfigModalIfOpen(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(300);
  await dismissWorkflowOnboarding(ctx);
  await selectGqlOrderFlowDemoWorkflow(ctx);
  await clickWfFitView(ctx);
}

export async function gqlWorkflowSubscriptionLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  await cleanupWorkflowDemoRunUi(ctx);
  deleteWorkflowByName(LESSON19_WF_NAME);
  resetGqlLesson19SessionFlags();
  setWfConfigDemoTiming(null);
  await ctx.delay(100);
}
