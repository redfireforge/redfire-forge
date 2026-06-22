// ── Lesson 11: Workflow Integration ───────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL, WF } from '../../../../../shared/selectors';
import { GQL_DEMO_HTTP } from './core';

export const LESSON11_WF_NAME = 'GraphQL Latency Demo';
export const LESSON11_LATENCY_VAR = 'gqlLatency';
export const LESSON11_HEALTH_QUERY = 'query { health }';

let _lesson11Created = false;
let _lesson11QueryAdded = false;
let _lesson11QueryConfigured = false;
let _lesson11AssertAdded = false;
let _lesson11AssertConfigured = false;
let _lesson11AssertThreshold = '';
let _lesson11PassRun = false;
let _lesson11FailRun = false;
let _lesson11ConsoleOpen = false;
let _lesson11DebugRun = false;

export function resetGqlLesson11SessionFlags(): void {
  _lesson11Created = false;
  _lesson11QueryAdded = false;
  _lesson11QueryConfigured = false;
  _lesson11AssertAdded = false;
  _lesson11AssertConfigured = false;
  _lesson11AssertThreshold = '';
  _lesson11PassRun = false;
  _lesson11FailRun = false;
  _lesson11ConsoleOpen = false;
  _lesson11DebugRun = false;
}

async function dismissWorkflowOnboarding(ctx: DemoActionContext): Promise<void> {
  const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
  if (skipBtn) {
    skipBtn.click();
    await ctx.delay(300);
  }
}

function wfNodeIdFromTestId(testIdSelector: string): string | null {
  const inner = document.querySelector(testIdSelector);
  const rfNode = inner?.closest('.react-flow__node');
  return rfNode?.getAttribute('data-id') ?? null;
}

async function openWfNodeConfig(ctx: DemoActionContext, testIdSelector: string): Promise<void> {
  const nodeId = wfNodeIdFromTestId(testIdSelector);
  const openConfig = (window as unknown as Record<string, unknown>).__wfOpenNodeConfig as
    | ((id: string) => void)
    | undefined;
  if (nodeId && openConfig) {
    openConfig(nodeId);
  } else {
    const deselectAll = (window as unknown as Record<string, unknown>).__wfDeselectAll as (() => void) | undefined;
    deselectAll?.();
    const node = document.querySelector<HTMLElement>(testIdSelector);
    node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  }
  await ctx.delay(400);
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
  const wfConnect = (window as unknown as Record<string, unknown>).__wfConnect as
    | ((s: string, t: string, sh: string | null, th: string | null) => void)
    | undefined;
  if (sourceId && targetId && wfConnect) {
    wfConnect(sourceId, targetId, sourceHandle, null);
    return true;
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

/** Create a blank workflow for Lesson 11. */
export async function ensureLesson11WorkflowCreated(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await dismissWorkflowOnboarding(ctx);

  if (_lesson11Created && document.querySelector(WF.CANVAS)) return;

  await ctx.click(WF.SIDEBAR_NEW_BTN);
  await ctx.delay(400);
  await ctx.click(WF.NEW_BLANK_ITEM);
  await ctx.delay(400);
  await ctx.fill(WF.CREATE_INPUT, LESSON11_WF_NAME);
  await ctx.delay(200);
  await ctx.click(WF.CREATE_OK);
  await ctx.waitFor(WF.CANVAS, 8000);
  await ctx.delay(800);
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
  if (_lesson11QueryConfigured) return;

  await openWfNodeConfig(ctx, GQL.WF_CANVAS_QUERY_NODE);
  await ctx.waitFor(GQL.WF_QUERY_PANEL, 5000);
  await ctx.fill(WF.WF_GQL_ENDPOINT, GQL_DEMO_HTTP);
  await ctx.delay(300);
  await ctx.fill(GQL.WF_QUERY_EDITOR, LESSON11_HEALTH_QUERY);
  await ctx.delay(300);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await ctx.click(GQL.WF_OUTPUT_ADD_BTN);
    await ctx.delay(300);
  }
  await ctx.selectOption(GQL.WF_OUTPUT_FIELD_SELECT, 'latencyMs');
  await ctx.delay(200);
  await ctx.fill(GQL.WF_OUTPUT_VARNAME, LESSON11_LATENCY_VAR);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson11QueryConfigured = true;
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

  await openWfNodeConfig(ctx, GQL.WF_CANVAS_ASSERT_NODE);
  await ctx.waitFor(GQL.WF_ASSERT_PANEL, 5000);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
  await ctx.fill(WF.WF_GQL_ASSERT_SOURCE, LESSON11_LATENCY_VAR);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
}

/** Configure latency assertion (jsonPath `$`, operator `less_than`, threshold ms). */
export async function ensureLesson11AssertRuleConfigured(
  ctx: DemoActionContext,
  thresholdMs = '500',
): Promise<void> {
  await ensureLesson11AssertSourceConfigured(ctx);
  if (_lesson11AssertConfigured && _lesson11AssertThreshold === thresholdMs) return;

  await openWfNodeConfig(ctx, GQL.WF_CANVAS_ASSERT_NODE);
  await ctx.waitFor(GQL.WF_ASSERT_PANEL, 5000);
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Assertions');
  if (!document.querySelector(GQL.WF_ASSERT_ROW)) {
    await ctx.click(GQL.WF_ASSERT_ADD_BTN);
    await ctx.delay(300);
  }
  await ctx.fill(GQL.WF_ASSERT_JSONPATH, '$');
  await ctx.delay(200);
  await ctx.selectOption(GQL.WF_ASSERT_OPERATOR, 'less_than');
  await ctx.delay(200);
  await ctx.fill(GQL.WF_ASSERT_EXPECTED, thresholdMs);
  await ctx.delay(200);
  await ctx.fill(GQL.WF_ASSERT_DESCRIPTION, `Latency under ${thresholdMs}ms`);
  await ctx.delay(300);
  await saveWfConfigModal(ctx);
  _lesson11AssertThreshold = thresholdMs;
  _lesson11AssertConfigured = true;
  if (thresholdMs !== '500') {
    _lesson11PassRun = false;
    _lesson11FailRun = false;
  }
}

/** Run Quick Test and wait for execution summary. */
export async function ensureLesson11WorkflowPassRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertRuleConfigured(ctx, '500');
  if (_lesson11PassRun && document.querySelector(`${GQL.WF_CANVAS_QUERY_NODE}.wf-node-pass`)) return;

  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(300);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  await ctx.delay(800);
  _lesson11PassRun = true;
}

/** Tighten assertion to fail, re-run Quick Test. */
export async function ensureLesson11WorkflowFailRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowPassRun(ctx);
  if (_lesson11FailRun && document.querySelector(`${GQL.WF_CANVAS_ASSERT_NODE}.wf-node-fail`)) return;

  await ensureLesson11AssertRuleConfigured(ctx, '1');
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  await ctx.delay(800);
  _lesson11FailRun = true;
}

/** Open the Workflow Console panel before running Quick Test. */
export async function ensureLesson11ConsoleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertRuleConfigured(ctx, '500');
  if (_lesson11ConsoleOpen && document.querySelector(WF.CONSOLE)) return;

  const panel = document.querySelector<HTMLElement>(WF.CONSOLE);
  if (!panel) {
    const badge = document.querySelector<HTMLElement>(WF.CONSOLE_BADGE);
    if (badge) {
      badge.click();
      await ctx.delay(500);
    }
  }
  _lesson11ConsoleOpen = true;
}

/** Start a step-through Debug run to observe node-by-node execution. */
export async function ensureLesson11DebugRun(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowFailRun(ctx);
  if (_lesson11DebugRun) return;

  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await ctx.click(WF.DEBUG_BTN);
  await ctx.delay(1200);
  _lesson11DebugRun = true;
}

/** Setup for Lesson 11 — remove stale demo workflow. */
export async function gqlWorkflowIntegrationLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLesson11SessionFlags();
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  if (wfDelete) {
    wfDelete(LESSON11_WF_NAME);
    await ctx.delay(300);
  }
  await closeWfConfigModalQuiet(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(300);
}

/** Cleanup for Lesson 11. */
export async function gqlWorkflowIntegrationLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalQuiet(ctx);
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as
    | ((name: string) => void)
    | undefined;
  wfDelete?.(LESSON11_WF_NAME);
  resetGqlLesson11SessionFlags();
  await ctx.delay(100);
}

