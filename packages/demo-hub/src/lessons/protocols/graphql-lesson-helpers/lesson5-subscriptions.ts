// ── Lesson 5: Subscriptions ─────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  ensureDemoEndpoint,
  ensureEditorMode,
  ensureIntrospected,
  fillGqlEditor,
  fillGqlVariables,
  getGqlEditorQuery,
  responseBodyText,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import {
  GQL_CREATE_ORDER_MUTATION,
  GQL_CREATE_ORDER_VARS,
  resetGqlLesson3SessionFlags,
} from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

/** orderStatus subscription — requires `$orderId` from a prior createOrder. */
export const GQL_ORDER_STATUS_SUBSCRIPTION = `subscription OrderUpdates($orderId: ID!) {
  orderStatus(orderId: $orderId) {
    status
    updatedAt
  }
}`;

let _lesson5OrderId = '';
let _lesson5OrderCreated = false;
let _lesson5SubscriptionWritten = false;
let _lesson5Subscribed = false;
let _lesson5PauseDemoDone = false;
let _lesson5FilterDemoDone = false;
let _lesson5AssertionAdded = false;

/** Reset Lesson 5 session flags. */
export function resetGqlLesson5SessionFlags(): void {
  _lesson5OrderId = '';
  _lesson5OrderCreated = false;
  _lesson5SubscriptionWritten = false;
  _lesson5Subscribed = false;
  _lesson5PauseDemoDone = false;
  _lesson5FilterDemoDone = false;
  _lesson5AssertionAdded = false;
}

export function getLesson5OrderId(): string {
  return _lesson5OrderId;
}

function orderVarsJson(orderId: string): string {
  return JSON.stringify({ orderId }, null, 2);
}

function subscriptionRowCount(): number {
  return document.querySelectorAll(GQL.SUBSCRIPTION_ROW).length;
}

function subscriptionLogText(): string {
  return document.querySelector(GQL.SUBSCRIPTION_MSG_LIST)?.textContent ?? '';
}

/** Parse createOrder.id from the response body JSON text. */
export function parseCreatedOrderIdFromResponse(): string | null {
  const text = responseBodyText();
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as { data?: { createOrder?: { id?: string } } };
    const id = parsed.data?.createOrder?.id;
    if (id) return id;
  } catch {
    // fall through to regex
  }
  const idMatch = text.match(/"createOrder"\s*:\s*\{[\s\S]*?"id"\s*:\s*"([^"]+)"/);
  return idMatch?.[1] ?? null;
}

/** Capture createOrder id from the latest response. */
export function storeCreatedOrderIdFromResponse(): void {
  const id = parseCreatedOrderIdFromResponse();
  if (id) {
    _lesson5OrderId = id;
    _lesson5OrderCreated = true;
  }
}

/** Create an order on the test server for orderStatus subscription demos. */
export async function createDemoOrder(): Promise<string> {
  if (_lesson5OrderId) return _lesson5OrderId;

  const resp = await fetch(GQL_DEMO_HTTP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation CreateDemoOrder($input: OrderInput!) { createOrder(input: $input) { id status } }',
      variables: {
        input: { customerId: 'cust-lesson5', items: ['lesson5-widget'] },
      },
    }),
  });
  const body = (await resp.json()) as {
    data?: { createOrder?: { id: string } };
    errors?: unknown[];
  };
  const id = body.data?.createOrder?.id;
  if (!id || body.errors) {
    throw new Error('Failed to create demo order for subscription lesson');
  }
  _lesson5OrderId = id;
  _lesson5OrderCreated = true;
  return id;
}

async function clickSubscribeAndWait(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  const subscribeBtn = document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN);
  if (subscribeBtn && !subscribeBtn.disabled) {
    await ctx.click(GQL.SUBSCRIBE_BTN);
  }
  await ctx.waitFor(GQL.SUBSCRIPTION_LOG, 15000);
  await ctx.delay(500);
}

async function clickExecuteAndWait(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await ctx.delay(500);
}

async function waitForSubscriptionComplete(ctx: DemoActionContext, minRows = 3): Promise<void> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const rows = subscriptionRowCount();
    const text = subscriptionLogText();
    if (rows >= minRows && text.includes('COMPLETE')) return;
    await ctx.delay(300);
  }
}

export async function ensureWsTransport(ctx: DemoActionContext): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>(GQL.TRANSPORT_SELECT);
  if (select && select.value !== 'graphql-transport-ws') {
    await ctx.selectOption(GQL.TRANSPORT_SELECT, 'graphql-transport-ws');
    await ctx.delay(400);
  }
}

/** Step 1 reading — demo endpoint ready; connection bar visible. */
export async function prepareGql5IntroReading(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
}

/** Step 2 reading — subscription query in editor so Subscribe button appears on connection bar. */
export async function prepareGql5ConnectionBarReading(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (!current.includes('subscription')) {
    await fillGqlEditor(ctx, GQL_ORDER_STATUS_SUBSCRIPTION, { focus: false });
  }
}

/** Step 3 reading — endpoint field ready for literal URL. */
export async function prepareGql5EndpointReading(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
}

async function ensureCreateOrderMutationReady(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
  const current = getGqlEditorQuery();
  if (!current.includes('createOrder')) {
    await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION, { focus: false });
  }
  await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS, { focus: false, openPanel: true });
}

/** Step 4 reading — createOrder mutation + vars loaded, not yet executed. */
export async function prepareGql5ExecCreateOrderReading(ctx: DemoActionContext): Promise<void> {
  await ensureCreateOrderMutationReady(ctx);
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(200);
}

/** Step 4b reading — createOrder response with captured order id. */
export async function prepareGql5ObserveCreateOrderReading(ctx: DemoActionContext): Promise<void> {
  await ensureDemoOrderCreated(ctx);
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.waitFor(GQL.RESPONSE_BODY, 5000);
}

/** Ensure createOrder mutation ran and order id is stored. */
export async function ensureDemoOrderCreated(ctx: DemoActionContext): Promise<void> {
  await ensureIntrospected(ctx);
  await ensureEditorMode(ctx);
  if (_lesson5OrderCreated && _lesson5OrderId) return;

  try {
    await createDemoOrder();
    return;
  } catch {
    // Fall through to visible mutation in UI when setup fetch failed.
  }

  const current = getGqlEditorQuery();
  if (!current.includes('createOrder')) {
    await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION, { focus: false });
  }
  await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS, { focus: false });
  await clickExecuteAndWait(ctx);
  const id = parseCreatedOrderIdFromResponse();
  if (id) {
    _lesson5OrderId = id;
    _lesson5OrderCreated = true;
  }
}

/** Ensure orderStatus subscription query is in the editor. */
export async function ensureSubscriptionQueryWritten(ctx: DemoActionContext): Promise<void> {
  await ensureDemoOrderCreated(ctx);
  const current = getGqlEditorQuery();
  if (_lesson5SubscriptionWritten && current.includes('orderStatus')) return;
  await fillGqlEditor(ctx, GQL_ORDER_STATUS_SUBSCRIPTION, { focus: false });
  _lesson5SubscriptionWritten = true;
}

/** Ensure subscription variables are set to the demo order id. */
export async function ensureSubscriptionVars(ctx: DemoActionContext): Promise<void> {
  await ensureSubscriptionQueryWritten(ctx);
  if (!_lesson5OrderId) {
    try {
      await createDemoOrder();
    } catch {
      const id = parseCreatedOrderIdFromResponse();
      if (id) _lesson5OrderId = id;
    }
  }
  if (_lesson5OrderId) {
    await fillGqlVariables(ctx, orderVarsJson(_lesson5OrderId), { focus: false });
  }
}

/** Subscribe and wait until PENDING → COMPLETE messages appear in the log. */
export async function ensureSubscribedWithMessages(ctx: DemoActionContext): Promise<void> {
  await ensureSubscriptionVars(ctx);
  await ensureWsTransport(ctx);
  if (_lesson5Subscribed && subscriptionRowCount() >= 3 && subscriptionLogText().includes('COMPLETE')) {
    return;
  }
  await clickSubscribeAndWait(ctx);
  await waitForSubscriptionComplete(ctx);
  _lesson5Subscribed = true;
}

/** Re-subscribe, pause while active, then resume (pause/resume demo). */
export async function ensurePauseResumeDemo(ctx: DemoActionContext): Promise<void> {
  await ensureSubscribedWithMessages(ctx);
  if (_lesson5PauseDemoDone) return;

  const subscribeBtn = document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN);
  if (subscribeBtn && !subscribeBtn.disabled) {
    await ctx.click(GQL.SUBSCRIBE_BTN);
    await ctx.waitFor(GQL.SUBSCRIPTION_LOG, 15000);
    await ctx.delay(200);
  }

  const pauseBtn = document.querySelector(GQL.SUBSCRIPTION_PAUSE_BTN);
  if (pauseBtn) {
    await ctx.click(GQL.SUBSCRIPTION_PAUSE_BTN);
    await ctx.delay(1200);
    const resumeBtn = document.querySelector(GQL.SUBSCRIPTION_RESUME_BTN);
    if (resumeBtn) {
      await ctx.click(GQL.SUBSCRIPTION_RESUME_BTN);
      await ctx.delay(800);
    }
  }
  _lesson5PauseDemoDone = true;
}

/** Open log filter and type a filter term. */
export async function ensureFilterDemo(ctx: DemoActionContext): Promise<void> {
  await ensureSubscribedWithMessages(ctx);
  if (_lesson5FilterDemoDone && document.querySelector(GQL.SUBSCRIPTION_FILTER_BAR)) return;

  if (!document.querySelector(GQL.SUBSCRIPTION_FILTER_BAR)) {
    await ctx.click(GQL.SUBSCRIPTION_FILTER_BTN);
    await ctx.waitFor(GQL.SUBSCRIPTION_FILTER_BAR, 5000);
    await ctx.delay(400);
  }
  await ctx.fill(GQL.SUBSCRIPTION_FILTER_INPUT, 'COMPLETE');
  await ctx.delay(600);
  _lesson5FilterDemoDone = true;
}

/** Add a JSONPath assertion on orderStatus.status. */
export async function ensureAssertionAdded(ctx: DemoActionContext): Promise<void> {
  await ensureSubscriptionQueryWritten(ctx);
  if (_lesson5AssertionAdded && document.querySelector(GQL.ASSERTION_ROW)) return;

  const panel = document.querySelector(GQL.ASSERTION_PANEL);
  if (!panel) return;

  const toggle = document.querySelector<HTMLElement>(GQL.ASSERTION_TOGGLE);
  if (toggle?.getAttribute('aria-expanded') === 'false') {
    await ctx.click(GQL.ASSERTION_TOGGLE);
    await ctx.delay(400);
  }

  if (!document.querySelector(GQL.ASSERTION_ROW)) {
    await ctx.click(GQL.ASSERTION_ADD_BTN);
    await ctx.waitFor(GQL.ASSERTION_ROW, 5000);
    await ctx.delay(400);
  }

  await ctx.fill(GQL.ASSERTION_JSONPATH, '$.orderStatus.status');
  await ctx.delay(400);
  await ctx.selectOption(GQL.ASSERTION_OPERATOR, 'equals');
  await ctx.delay(300);
  await ctx.fill(GQL.ASSERTION_EXPECTED, 'COMPLETE');
  await ctx.delay(500);
  _lesson5AssertionAdded = true;
}

/** Setup for Lesson 5 (GQL-7) — demo tab; seed order quietly when Docker is up. */
export async function gqlSubscriptionsLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();

  const editorBtn = document.querySelector<HTMLElement>(GQL.MODE_EDITOR);
  if (editorBtn && !editorBtn.classList.contains('gql-mode-btn--active')) {
    editorBtn.click();
  }
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
  }
  await ctx.delay(200);

  const historyBtn = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY);
  if (historyBtn?.classList.contains('gql-activity-tab--active')) {
    historyBtn.click();
    await ctx.delay(200);
  }

  await ensureGqlDemoTab(ctx, 'gql-subscriptions', 'Subscriptions — Real-Time Data');
  await fillGqlEditor(ctx, 'subscription { }', { focus: false });
  await fillGqlVariables(ctx, '{\n  \n}', { focus: false, openPanel: false });

  try {
    await createDemoOrder();
  } catch {
    // PrerequisiteGate blocks play when Docker is down; order created in lesson step 3.
  }
}

/** Cleanup for Lesson 5 (GQL-7) — close demo tab and reset session flags. */
export async function gqlSubscriptionsLessonCleanup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson5SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-subscriptions');
}

