// ── Lesson 11: Workflow Integration ───────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import type { GraphqlAssertNodeData, GraphqlQueryNodeData } from '@workflow/types/workflow';
import { GQL, WF } from '@shared/selectors';
import { GQL_DEMO_HTTP, GQL_DEMO_VAR } from './core';
import {
  connectWorkflowNodes,
  deleteWorkflowByName,
  getWorkflowByName,
  patchDemoWorkflowNodeDataByType,
  patchWorkflowByName,
} from '../../../adapters';
import {
  clickWfConfigAddRow,
  clickWfConfigTab,
  clickWfDebugStepButtons,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  cleanupWorkflowDemoRunUi,
  collapseWfDemoAppSidebar,
  expandWfDemoAppSidebar,
  fillWfConfigField,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  startWfDebugRun,
  waitForWfConfigPanel,
} from '../../wf-demo-helpers';

export const LESSON11_WF_NAME = 'GraphQL Latency Demo';
export const LESSON11_LATENCY_VAR = 'gqlLatency';
export const LESSON11_GRAPHQL_URL_VAR = 'graphqlUrl';
export const LESSON11_HEALTH_QUERY = 'query { health }';
/** Pass threshold — includes proxy + dev-server overhead (often 500–1500ms locally). */
export const LESSON11_PASS_THRESHOLD_MS = '2000';

let _lesson11Created = false;
let _lesson11QueryAdded = false;
let _lesson11QueryConfigured = false;
let _lesson11AssertAdded = false;
let _lesson11AssertSourceConfigured = false;
let _lesson11AssertConfigured = false;
let _lesson11AssertThreshold = '';
let _lesson11PassRun = false;
let _lesson11FailRun = false;
let _lesson11DebugRun = false;

export function resetGqlLesson11SessionFlags(): void {
  _lesson11Created = false;
  _lesson11QueryAdded = false;
  _lesson11QueryConfigured = false;
  _lesson11AssertAdded = false;
  _lesson11AssertSourceConfigured = false;
  _lesson11AssertConfigured = false;
  _lesson11AssertThreshold = '';
  _lesson11PassRun = false;
  _lesson11FailRun = false;
  _lesson11DebugRun = false;
}

async function dismissWorkflowOnboarding(ctx: DemoActionContext): Promise<void> {
  const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (skipBtn) {
    skipBtn.click();
    await ctx.delay(300);
  }
}

function connectWfNodes(
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

async function clickWfFitView(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector<HTMLElement>('button[title="Fit view"]');
  if (btn) {
    btn.click();
    await ctx.delay(500);
  }
}

function readLesson11WorkflowNode(type: string): Record<string, unknown> | null {
  const wf = getWorkflowByName<{ nodes?: Array<{ type: string; data: Record<string, unknown> }> }>(
    LESSON11_WF_NAME,
  );
  const node = wf?.nodes?.find((n) => n.type === type);
  return node?.data ?? null;
}

function isLesson11EndpointConfigured(endpoint?: string): boolean {
  const e = endpoint?.trim() ?? '';
  return e.includes(LESSON11_GRAPHQL_URL_VAR);
}

function isLesson11WorkflowVariablesConfigured(): boolean {
  const wf = getWorkflowByName<{ variables?: Record<string, string> }>(LESSON11_WF_NAME);
  return wf?.variables?.[LESSON11_GRAPHQL_URL_VAR] === GQL_DEMO_HTTP;
}

function isLesson11QueryConfiguredInWorkflow(): boolean {
  const data = readLesson11WorkflowNode('graphqlQuery') as GraphqlQueryNodeData | null;
  if (!data) return false;
  const bindings = data.outputBindings ?? [];
  return !!(
    isLesson11EndpointConfigured(data.endpoint)
    && data.query?.includes('health')
    && bindings.some((b) => b.field === 'latencyMs' && b.variableName === LESSON11_LATENCY_VAR && b.enabled !== false)
    && isLesson11WorkflowVariablesConfigured()
  );
}

function isLesson11AssertSourceConfiguredInWorkflow(): boolean {
  const data = readLesson11WorkflowNode('graphqlAssert') as GraphqlAssertNodeData | null;
  return data?.sourceVariable?.trim() === LESSON11_LATENCY_VAR;
}

function isLesson11AssertRuleConfiguredInWorkflow(thresholdMs: string): boolean {
  const data = readLesson11WorkflowNode('graphqlAssert') as GraphqlAssertNodeData | null;
  const assertions = data?.assertions ?? [];
  return assertions.some(
    (a) => a.jsonPath === '$' && a.operator === 'less_than' && String(a.expectedValue) === thresholdMs,
  );
}

function patchLesson11QueryNodeQuiet(): boolean {
  return patchDemoWorkflowNodeDataByType('graphqlQuery', {
    endpoint: GQL_DEMO_VAR,
    query: LESSON11_HEALTH_QUERY,
    outputBindings: [{ field: 'latencyMs', variableName: LESSON11_LATENCY_VAR, enabled: true }],
  });
}

function patchLesson11WorkflowVariablesQuiet(): boolean {
  return patchWorkflowByName(LESSON11_WF_NAME, {
    variables: { [LESSON11_GRAPHQL_URL_VAR]: GQL_DEMO_HTTP },
  });
}

function patchLesson11AssertSourceQuiet(): boolean {
  return patchDemoWorkflowNodeDataByType('graphqlAssert', {
    sourceVariable: LESSON11_LATENCY_VAR,
  });
}

function patchLesson11AssertRuleQuiet(thresholdMs: string): boolean {
  return patchDemoWorkflowNodeDataByType('graphqlAssert', {
    sourceVariable: LESSON11_LATENCY_VAR,
    assertions: [{
      id: 'gql11-latency-assert',
      jsonPath: '$',
      operator: 'less_than',
      expectedValue: thresholdMs,
      description: `Latency under ${thresholdMs}ms`,
    }],
    failBehavior: 'error',
  });
}

async function syncLesson11QueryConfigured(ctx: DemoActionContext): Promise<boolean> {
  await ctx.delay(200);
  if (isLesson11QueryConfiguredInWorkflow()) {
    _lesson11QueryConfigured = true;
    return true;
  }
  let patched = false;
  if (patchLesson11QueryNodeQuiet()) patched = true;
  if (patchLesson11WorkflowVariablesQuiet()) patched = true;
  if (patched) {
    await ctx.delay(200);
    _lesson11QueryConfigured = true;
    return true;
  }
  return false;
}

function lesson11BothNodesPassed(): boolean {
  return !!(
    document.querySelector(`${GQL.WF_CANVAS_QUERY_NODE}.wf-node-pass`)
    && document.querySelector(`${GQL.WF_CANVAS_ASSERT_NODE}.wf-node-pass`)
  );
}

export { closeWfConsoleIfOpen, openWfConsoleIfClosed } from '../../wf-demo-helpers';

/** Create a blank workflow for Lesson 11. */
export async function ensureLesson11WorkflowCreated(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);

  if (_lesson11Created && document.querySelector(WF.CANVAS)) {
    await collapseWfDemoAppSidebar(ctx);
    return;
  }

  await expandWfDemoAppSidebar(ctx);
  await ctx.click(WF.SIDEBAR_NEW_BTN);
  await ctx.delay(400);
  await ctx.click(WF.NEW_BLANK_ITEM);
  await ctx.delay(400);
  await ctx.fill(WF.CREATE_INPUT, LESSON11_WF_NAME);
  await ctx.delay(200);
  await ctx.click(WF.CREATE_OK);
  await ctx.waitFor(WF.CANVAS, 8000);
  await ctx.delay(800);
  await collapseWfDemoAppSidebar(ctx);
  _lesson11Created = true;
}

/** Add a GraphQL Query node and wire Start → Query. */
export async function ensureLesson11QueryNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowCreated(ctx);
  if (_lesson11QueryAdded && document.querySelector(GQL.WF_CANVAS_QUERY_NODE)) return;

  const pal = document.querySelector<HTMLElement>(WF.PAL_GQL_QUERY);
  pal?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  await ctx.click(WF.PAL_GQL_QUERY);
  await ctx.delay(600);
  connectWfNodes(WF.NODE_START, WF.NODE_GQL_QUERY, 'out');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson11QueryAdded = true;
}

/** Configure query endpoint, health query, and latencyMs output binding. */
export async function ensureLesson11QueryConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11QueryNodeAdded(ctx);
  if (_lesson11QueryConfigured && isLesson11QueryConfiguredInWorkflow()) {
    await closeWfConfigModalIfOpen(ctx);
    return;
  }
  _lesson11QueryConfigured = false;

  await openWfNodeConfigModal(ctx, { canvasTestId: GQL.WF_CANVAS_QUERY_NODE });
  await waitForWfConfigPanel(ctx, GQL.WF_QUERY_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Operation');
  await ctx.waitFor(GQL.WF_ENDPOINT_INPUT, 5000);
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_VAR);
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON11_HEALTH_QUERY);
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await clickWfConfigAddRow(ctx, GQL.WF_OUTPUT_ADD_BTN, GQL.WF_OUTPUT_FIELD_SELECT);
  }
  await selectWfConfigOption(ctx, GQL.WF_OUTPUT_FIELD_SELECT, 'latencyMs');
  await fillWfConfigField(ctx, GQL.WF_OUTPUT_VARNAME, LESSON11_LATENCY_VAR);
  await pauseWfConfigSection(ctx);
  const saved = await saveAndCloseWfConfigModal(ctx);
  if (!saved) {
    await closeWfConfigModalIfOpen(ctx);
  }
  await syncLesson11QueryConfigured(ctx);
}

/** Add GraphQL Assert node and wire Query → Assert → End. */
export async function ensureLesson11AssertNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11QueryConfigured(ctx);
  if (_lesson11AssertAdded && document.querySelector(GQL.WF_CANVAS_ASSERT_NODE)) return;

  const pal = document.querySelector<HTMLElement>(WF.PAL_GQL_ASSERT);
  pal?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  await ctx.click(WF.PAL_GQL_ASSERT);
  await ctx.delay(600);
  connectWfNodes(WF.NODE_GQL_QUERY, WF.NODE_GQL_ASSERT);
  connectWfNodes(WF.NODE_GQL_ASSERT, WF.NODE_END);
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson11AssertAdded = true;
}

/** Set assert source variable to the query latency output binding. */
export async function ensureLesson11AssertSourceConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertNodeAdded(ctx);
  if (_lesson11AssertSourceConfigured && isLesson11AssertSourceConfiguredInWorkflow()) {
    await closeWfConfigModalIfOpen(ctx);
    return;
  }
  _lesson11AssertSourceConfigured = false;

  await openWfNodeConfigModal(ctx, { canvasTestId: GQL.WF_CANVAS_ASSERT_NODE });
  await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
  await fillWfConfigField(ctx, WF.WF_GQL_ASSERT_SOURCE, LESSON11_LATENCY_VAR);
  const saved = await saveAndCloseWfConfigModal(ctx);
  if (!saved) {
    await closeWfConfigModalIfOpen(ctx);
  }
  await ctx.delay(200);
  let patched = false;
  if (!isLesson11AssertSourceConfiguredInWorkflow()) {
    patched = patchLesson11AssertSourceQuiet();
    await ctx.delay(200);
  }
  if (isLesson11AssertSourceConfiguredInWorkflow() || patched) {
    _lesson11AssertSourceConfigured = true;
  }
}

/** Configure latency assertion (jsonPath `$`, operator `less_than`, threshold ms). */
export async function ensureLesson11AssertRuleConfigured(
  ctx: DemoActionContext,
  thresholdMs = LESSON11_PASS_THRESHOLD_MS,
): Promise<void> {
  await ensureLesson11AssertSourceConfigured(ctx);
  if (_lesson11AssertConfigured && _lesson11AssertThreshold === thresholdMs && isLesson11AssertRuleConfiguredInWorkflow(thresholdMs)) {
    await closeWfConfigModalIfOpen(ctx);
    return;
  }
  if (!isLesson11AssertRuleConfiguredInWorkflow(thresholdMs)) {
    _lesson11AssertConfigured = false;
  }

  await openWfNodeConfigModal(ctx, { canvasTestId: GQL.WF_CANVAS_ASSERT_NODE });
  await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Assertions');
  if (!document.querySelector(GQL.WF_ASSERT_ROW)) {
    await clickWfConfigAddRow(ctx, GQL.WF_ASSERT_ADD_BTN, GQL.WF_ASSERT_JSONPATH);
  }
  await fillWfConfigField(ctx, GQL.WF_ASSERT_JSONPATH, '$');
  await selectWfConfigOption(ctx, GQL.WF_ASSERT_OPERATOR, 'less_than');
  await pauseWfConfigSection(ctx);
  await fillWfConfigField(ctx, GQL.WF_ASSERT_EXPECTED, thresholdMs);
  await fillWfConfigField(ctx, GQL.WF_ASSERT_DESCRIPTION, `Latency under ${thresholdMs}ms`);
  await pauseWfConfigSection(ctx);
  const saved = await saveAndCloseWfConfigModal(ctx);
  if (!saved) {
    await closeWfConfigModalIfOpen(ctx);
  }
  await ctx.delay(200);
  let patched = false;
  if (!isLesson11AssertRuleConfiguredInWorkflow(thresholdMs)) {
    patched = patchLesson11AssertRuleQuiet(thresholdMs);
    await ctx.delay(200);
  }
  if (isLesson11AssertRuleConfiguredInWorkflow(thresholdMs) || patched) {
    _lesson11AssertThreshold = thresholdMs;
    _lesson11AssertConfigured = true;
    if (thresholdMs !== LESSON11_PASS_THRESHOLD_MS) {
      _lesson11PassRun = false;
      _lesson11FailRun = false;
    }
  }
}

/** Patch workflow graph data when UI save did not persist (quiet guards). */
export async function ensureLesson11GraphReadyForQuickTest(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertRuleConfigured(ctx, LESSON11_PASS_THRESHOLD_MS);
  await closeWfConfigModalIfOpen(ctx);
  if (!isLesson11QueryConfiguredInWorkflow()) {
    patchLesson11QueryNodeQuiet();
    await ctx.delay(200);
  }
  if (!isLesson11AssertSourceConfiguredInWorkflow()) {
    patchLesson11AssertSourceQuiet();
    await ctx.delay(200);
  }
  if (!isLesson11AssertRuleConfiguredInWorkflow(LESSON11_PASS_THRESHOLD_MS)) {
    patchLesson11AssertRuleQuiet(LESSON11_PASS_THRESHOLD_MS);
    await ctx.delay(200);
  }
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(300);
}

/** Run Quick Test only — observe pass state on the next step. */
export async function runLesson11WorkflowPassExecOnly(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11GraphReadyForQuickTest(ctx);
  if (_lesson11PassRun && lesson11BothNodesPassed()) return;

  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(300);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  await ctx.delay(400);
  if (lesson11BothNodesPassed()) {
    _lesson11PassRun = true;
  }
}

/** Run Quick Test and wait for execution summary. */
export async function ensureLesson11WorkflowPassRun(ctx: DemoActionContext): Promise<void> {
  await runLesson11WorkflowPassExecOnly(ctx);
  await ctx.delay(400);
}

/** Reading pause before observing green pass nodes (Quick Test must have run). */
export async function prepareGql11ObservePassReading(ctx: DemoActionContext): Promise<void> {
  await runLesson11WorkflowPassExecOnly(ctx);
}

/** Run Quick Test with tightened threshold (assert rule must already be set to fail). */
export async function ensureLesson11WorkflowFailRunOnly(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertRuleConfigured(ctx, '1');
  await closeWfConfigModalIfOpen(ctx);
  if (_lesson11FailRun && document.querySelector(`${GQL.WF_CANVAS_ASSERT_NODE}.wf-node-fail`)) return;

  await ensureLesson11ConsoleOpen(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  await ctx.delay(800);
  _lesson11FailRun = true;
}

/** Tighten assertion to fail, re-run Quick Test. */
export async function ensureLesson11WorkflowFailRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowPassRun(ctx);
  await ensureLesson11WorkflowFailRunOnly(ctx);
}

/** Reading pause before tightening the assert threshold (pass run must exist). */
export async function prepareGql11TightenThresholdReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowPassRun(ctx);
}

/** Reading pause before observing the failed assert node (fail Quick Test must have run). */
export async function prepareGql11ObserveFailureReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowFailRunOnly(ctx);
}

/** Open the Workflow Console panel (does not change assert configuration). */
export async function ensureLesson11ConsoleOpen(ctx: DemoActionContext): Promise<void> {
  await openWfConsoleIfClosed(ctx);
}

/** Close the Workflow Console panel (e.g. before canvas-only steps). */
export async function closeLesson11Console(ctx: DemoActionContext): Promise<void> {
  await closeWfConsoleIfOpen(ctx);
}

/** Reading pause before Debug Mode (threshold tightened; no Quick Test re-run). */
export async function prepareGql11DebugReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertRuleConfigured(ctx, '1');
  await closeWfConfigModalIfOpen(ctx);
}

/** Start a step-through Debug run and click Step on each paused node. */
export async function ensureLesson11DebugRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertRuleConfigured(ctx, '1');
  await closeWfConfigModalIfOpen(ctx);

  if (document.querySelector(WF.DEBUG_STEP_BTN)) {
    await clickWfDebugStepButtons(ctx);
    _lesson11DebugRun = true;
    return;
  }

  if (_lesson11DebugRun) return;

  await startWfDebugRun(ctx);
  await clickWfDebugStepButtons(ctx);
  _lesson11DebugRun = true;
}

/** Setup for Lesson 11 — remove stale demo workflow. */
export async function gqlWorkflowIntegrationLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson11SessionFlags();
  if (deleteWorkflowByName(LESSON11_WF_NAME)) {
    await ctx.delay(300);
  }
  await cleanupWorkflowDemoRunUi(ctx);
  await closeWfConfigModalIfOpen(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(300);
}

/** Cleanup for Lesson 11. */
export async function gqlWorkflowIntegrationLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  await cleanupWorkflowDemoRunUi(ctx);
  deleteWorkflowByName(LESSON11_WF_NAME);
  resetGqlLesson11SessionFlags();
  await ctx.delay(100);
}

