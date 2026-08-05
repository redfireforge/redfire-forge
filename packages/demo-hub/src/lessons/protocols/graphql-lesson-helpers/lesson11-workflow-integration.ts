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
  holdWfSpotlight,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  resetWfPaletteToBlocks,
  saveAndCloseWfConfigModal,
  saveWfConfigModal,
  selectWfConfigOption,
  setWfConfigDemoTiming,
  startWfDebugRun,
  waitForWfConfigPanel,
  WF_CONFIG_DEMO_TIMING_GUIDED,
} from '../../wf-demo-helpers';
import { fillControlledInput } from '../../setup-helpers';

/** Outcome / canvas hold — long enough to read, not a flash. */
const LESSON11_OUTCOME_HOLD_MS = 950;
/** Palette search for GraphQL Query (Actions) — surfaces all GraphQL action blocks. */
const LESSON11_PALETTE_SEARCH_QUERY = 'Graph';
/**
 * Palette search for GraphQL Assert only — avoids `.wf-palette-match` purple marks
 * on Query / Mutation / Subscription / Introspect while spotlighting Assert.
 */
const LESSON11_PALETTE_SEARCH_ASSERT = 'Assert';

export const LESSON11_WF_NAME = 'GraphQL Latency Demo';
export const LESSON11_LATENCY_VAR = 'gqlLatency';
export const LESSON11_GRAPHQL_URL_VAR = 'graphqlUrl';
export const LESSON11_HEALTH_QUERY = 'query { health }';
/** Pass threshold — includes proxy + dev-server overhead (often 500–1500ms locally). */
export const LESSON11_PASS_THRESHOLD_MS = '2000';

let _lesson11Created = false;
let _lesson11VariablesConfigured = false;
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
  _lesson11VariablesConfigured = false;
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

function lesson11DefaultsModalHasGraphqlUrlRow(): boolean {
  const rows = document.querySelectorAll(`${WF.DEFAULTS_MODAL} .wf-config-kv-row-vars:not(:last-child)`);
  for (const row of rows) {
    const keyInput = row.querySelector<HTMLInputElement>('.wf-var-key-input');
    if (keyInput?.value.trim() === LESSON11_GRAPHQL_URL_VAR) return true;
  }
  return false;
}

async function closeWfDefaultsModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.DEFAULTS_MODAL)) return;
  const cancel = document.querySelector<HTMLElement>(`${WF.DEFAULTS_MODAL} .btn-ghost`);
  cancel?.click();
  await ctx.delay(300);
}

async function syncLesson11QueryConfigured(ctx: DemoActionContext): Promise<boolean> {
  await ctx.delay(200);
  if (isLesson11QueryConfiguredInWorkflow()) {
    _lesson11QueryConfigured = true;
    return true;
  }
  let patched = false;
  if (patchLesson11QueryNodeQuiet()) patched = true;
  if (!isLesson11WorkflowVariablesConfigured() && patchLesson11WorkflowVariablesQuiet()) patched = true;
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
  await ctx.delay(400);
  await collapseWfDemoAppSidebar(ctx);
  _lesson11Created = true;
  await holdWfSpotlight(ctx, WF.CANVAS, LESSON11_OUTCOME_HOLD_MS);
}

/** Open Workflow Variables and define graphqlUrl default for {{graphqlUrl}} placeholders. */
export async function ensureLesson11WorkflowVariablesConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowCreated(ctx);
  if (_lesson11VariablesConfigured && isLesson11WorkflowVariablesConfigured()) {
    await closeWfDefaultsModalIfOpen(ctx);
    return;
  }
  _lesson11VariablesConfigured = false;

  await ctx.click(WF.VARIABLES_BTN);
  await ctx.waitFor(WF.DEFAULTS_MODAL, 5000);
  await holdWfSpotlight(ctx, WF.DEFAULTS_MODAL, 700);

  if (!lesson11DefaultsModalHasGraphqlUrlRow()) {
    await holdWfSpotlight(ctx, WF.DEFAULTS_NEW_KEY, 500);
    await ctx.fill(WF.DEFAULTS_NEW_KEY, LESSON11_GRAPHQL_URL_VAR);
    await ctx.delay(450);
    await holdWfSpotlight(ctx, WF.DEFAULTS_NEW_VAL, 500);
    await ctx.fill(WF.DEFAULTS_NEW_VAL, GQL_DEMO_HTTP);
    await ctx.delay(450);
    await ctx.click(WF.DEFAULTS_ADD_BTN);
    await ctx.delay(550);
  } else {
    await holdWfSpotlight(ctx, WF.DEFAULTS_EXISTING_VALUE, 500);
    await ctx.fill(WF.DEFAULTS_EXISTING_VALUE, GQL_DEMO_HTTP);
    await ctx.delay(450);
  }

  await holdWfSpotlight(ctx, WF.DEFAULTS_SAVE_BTN, 450);
  await ctx.click(WF.DEFAULTS_SAVE_BTN);
  // Save closes the modal immediately — do not waitFor DEFAULTS_MODAL (polls full timeout).
  await ctx.delay(500);
  await closeWfDefaultsModalIfOpen(ctx);

  if (!isLesson11WorkflowVariablesConfigured()) {
    patchLesson11WorkflowVariablesQuiet();
    await ctx.delay(200);
  }
  _lesson11VariablesConfigured = true;
}

/** Type a Blocks palette search term and wait for the filtered list to settle. */
async function ensureLesson11PaletteFilter(
  ctx: DemoActionContext,
  search: string,
  opts?: { spotlightSearch?: boolean },
): Promise<void> {
  resetWfPaletteToBlocks();
  await ctx.waitFor(WF.PAL_SEARCH, 5000);
  const input = document.querySelector<HTMLInputElement>(WF.PAL_SEARCH);
  if (input && input.value === search) {
    if (opts?.spotlightSearch) await holdWfSpotlight(ctx, WF.PAL_SEARCH, 450);
    return;
  }
  // Default: fill quietly — reading-phase DemoSpotlight owns the focal ring
  // (palette block), so a second ring on the search field is noise.
  if (opts?.spotlightSearch) await holdWfSpotlight(ctx, WF.PAL_SEARCH, 550);
  if (input) {
    fillControlledInput(input, search);
  } else {
    await ctx.fill(WF.PAL_SEARCH, search);
  }
  await ctx.delay(opts?.spotlightSearch ? 700 : 450);
}

/**
 * Type **Graph** in the Blocks palette search so GraphQL Query appears
 * in the filtered Actions list.
 */
export async function ensureLesson11PaletteGraphFilter(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11PaletteFilter(ctx, LESSON11_PALETTE_SEARCH_QUERY);
}

/** Type **Assert** so GraphQL Assert is the focal match (no Action-block match noise). */
export async function ensureLesson11PaletteAssertFilter(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11PaletteFilter(ctx, LESSON11_PALETTE_SEARCH_ASSERT);
}

/** Clear palette search so leftover `.wf-palette-match` marks disappear. */
async function clearLesson11PaletteSearch(ctx: DemoActionContext): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(WF.PAL_SEARCH);
  if (!input || !input.value) return;
  fillControlledInput(input, '');
  await ctx.delay(250);
}

/** Filter palette, then click a GraphQL block from the results. */
async function clickLesson11PaletteBlock(
  ctx: DemoActionContext,
  blockSelector: string,
  search: string,
): Promise<void> {
  await ensureLesson11PaletteFilter(ctx, search);
  await ctx.waitFor(blockSelector, 5000);
  await holdWfSpotlight(ctx, blockSelector, 750);
  await ctx.click(blockSelector);
  await ctx.delay(600);
}

/**
 * Variables ready + palette filtered to Graph so reading spotlight can land on
 * GraphQL Query (not the search field).
 */
export async function prepareGql11QueryNodeReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowVariablesConfigured(ctx);
  await ensureLesson11PaletteGraphFilter(ctx);
  await ctx.waitFor(WF.PAL_GQL_QUERY, 5000);
  await holdWfSpotlight(ctx, WF.PAL_GQL_QUERY, 700);
}

/** Add a GraphQL Query node and wire Start → Query. */
export async function ensureLesson11QueryNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11WorkflowVariablesConfigured(ctx);
  if (_lesson11QueryAdded && document.querySelector(GQL.WF_CANVAS_QUERY_NODE)) {
    await holdWfSpotlight(ctx, GQL.WF_CANVAS_QUERY_NODE, 700);
    return;
  }

  await clickLesson11PaletteBlock(ctx, WF.PAL_GQL_QUERY, LESSON11_PALETTE_SEARCH_QUERY);
  connectWfNodes(WF.NODE_START, WF.NODE_GQL_QUERY, 'out');
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson11QueryAdded = true;
  await clearLesson11PaletteSearch(ctx);
  await holdWfSpotlight(ctx, GQL.WF_CANVAS_QUERY_NODE, LESSON11_OUTCOME_HOLD_MS);
}

/** Open Query config so the reading-phase highlight has a live Endpoint target. */
export async function prepareGql11QueryConfigReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11QueryNodeAdded(ctx);
  await closeWfDefaultsModalIfOpen(ctx);
  if (!document.querySelector(GQL.WF_QUERY_PANEL)) {
    await openWfNodeConfigModal(ctx, { canvasTestId: GQL.WF_CANVAS_QUERY_NODE });
    await waitForWfConfigPanel(ctx, GQL.WF_QUERY_PANEL);
  }
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Operation');
  await ctx.waitFor(GQL.WF_ENDPOINT_INPUT, 5000);
  await ctx.delay(350);
}

async function fillLesson11QueryConfigFields(ctx: DemoActionContext): Promise<void> {
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Operation');
  await ctx.waitFor(GQL.WF_ENDPOINT_INPUT, 5000);
  await fillWfConfigField(ctx, GQL.WF_ENDPOINT_INPUT, GQL_DEMO_VAR);
  // No spotlight on the Query textarea — a ring on empty editor chrome looks like
  // a background highlight (see gql11-config-query reading feedback).
  await fillWfConfigField(ctx, GQL.WF_QUERY_EDITOR, LESSON11_HEALTH_QUERY, { spotlight: false });
  await pauseWfConfigSection(ctx);
  await clickWfConfigTab(ctx, GQL.WF_QUERY_PANEL, 'Output');
  if (!document.querySelector(GQL.WF_OUTPUT_FIELD_SELECT)) {
    await clickWfConfigAddRow(ctx, GQL.WF_OUTPUT_ADD_BTN, GQL.WF_OUTPUT_FIELD_SELECT);
  }
  await selectWfConfigOption(ctx, GQL.WF_OUTPUT_FIELD_SELECT, 'latencyMs');
  await fillWfConfigField(ctx, GQL.WF_OUTPUT_VARNAME, LESSON11_LATENCY_VAR);
  await pauseWfConfigSection(ctx);
}

/** Visible Query config tour — assumes panel is open from {@link prepareGql11QueryConfigReading}. */
export async function demonstrateLesson11QueryConfigured(ctx: DemoActionContext): Promise<void> {
  if (_lesson11QueryConfigured && isLesson11QueryConfiguredInWorkflow()) {
    await closeWfConfigModalIfOpen(ctx);
    await holdWfSpotlight(ctx, GQL.WF_CANVAS_QUERY_NODE, LESSON11_OUTCOME_HOLD_MS);
    return;
  }
  _lesson11QueryConfigured = false;
  if (!document.querySelector(GQL.WF_QUERY_PANEL)) {
    await prepareGql11QueryConfigReading(ctx);
  }
  await fillLesson11QueryConfigFields(ctx);
  const saved = await saveAndCloseWfConfigModal(ctx);
  if (!saved) {
    await closeWfConfigModalIfOpen(ctx);
  }
  await syncLesson11QueryConfigured(ctx);
  await holdWfSpotlight(ctx, GQL.WF_CANVAS_QUERY_NODE, LESSON11_OUTCOME_HOLD_MS);
}

/** Configure query endpoint, health query, and latencyMs output binding. */
export async function ensureLesson11QueryConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11QueryNodeAdded(ctx);
  if (_lesson11QueryConfigured && isLesson11QueryConfiguredInWorkflow()) {
    await closeWfConfigModalIfOpen(ctx);
    return;
  }
  await prepareGql11QueryConfigReading(ctx);
  await demonstrateLesson11QueryConfigured(ctx);
}

/**
 * Ensure Query is configured and palette is filtered to **Assert** so the
 * reading-phase spotlight lands on GraphQL Assert without Action-block match noise.
 */
export async function prepareGql11AssertNodeReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11QueryConfigured(ctx);
  await ensureLesson11PaletteAssertFilter(ctx);
  await ctx.waitFor(WF.PAL_GQL_ASSERT, 5000);
  await holdWfSpotlight(ctx, WF.PAL_GQL_ASSERT, 700);
}

/** Add GraphQL Assert node and wire Query → Assert → End. */
export async function ensureLesson11AssertNodeAdded(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11QueryConfigured(ctx);
  if (_lesson11AssertAdded && document.querySelector(GQL.WF_CANVAS_ASSERT_NODE)) {
    await clearLesson11PaletteSearch(ctx);
    await holdWfSpotlight(ctx, GQL.WF_CANVAS_ASSERT_NODE, 700);
    return;
  }

  await clickLesson11PaletteBlock(ctx, WF.PAL_GQL_ASSERT, LESSON11_PALETTE_SEARCH_ASSERT);
  connectWfNodes(WF.NODE_GQL_QUERY, WF.NODE_GQL_ASSERT);
  connectWfNodes(WF.NODE_GQL_ASSERT, WF.NODE_END);
  await ctx.delay(400);
  await clickWfFitView(ctx);
  _lesson11AssertAdded = true;
  await clearLesson11PaletteSearch(ctx);
  await holdWfSpotlight(ctx, GQL.WF_CANVAS_ASSERT_NODE, LESSON11_OUTCOME_HOLD_MS);
}

/** Open Assert Source tab so reading highlight targets a visible control. */
export async function prepareGql11AssertSourceReading(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertNodeAdded(ctx);
  if (!document.querySelector(GQL.WF_ASSERT_PANEL)) {
    await openWfNodeConfigModal(ctx, { canvasTestId: GQL.WF_CANVAS_ASSERT_NODE });
    await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
  }
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
  await ctx.waitFor(WF.WF_GQL_ASSERT_SOURCE, 5000);
  await ctx.delay(350);
}

/** Fill Source variable and keep the modal open for the Assertions step. */
export async function demonstrateLesson11AssertSourceConfigured(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.WF_ASSERT_PANEL)) {
    await prepareGql11AssertSourceReading(ctx);
  }
  if (!_lesson11AssertSourceConfigured || !isLesson11AssertSourceConfiguredInWorkflow()) {
    _lesson11AssertSourceConfigured = false;
    await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Source');
    await fillWfConfigField(ctx, WF.WF_GQL_ASSERT_SOURCE, LESSON11_LATENCY_VAR);
    await saveWfConfigModal(ctx);
    let patched = false;
    if (!isLesson11AssertSourceConfiguredInWorkflow()) {
      patched = patchLesson11AssertSourceQuiet();
      await ctx.delay(200);
    }
    if (isLesson11AssertSourceConfiguredInWorkflow() || patched) {
      _lesson11AssertSourceConfigured = true;
    }
  }
  await holdWfSpotlight(ctx, WF.WF_GQL_ASSERT_SOURCE, LESSON11_OUTCOME_HOLD_MS);
}

/** Set assert source variable to the query latency output binding. */
export async function ensureLesson11AssertSourceConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11AssertNodeAdded(ctx);
  if (_lesson11AssertSourceConfigured && isLesson11AssertSourceConfiguredInWorkflow()) {
    await closeWfConfigModalIfOpen(ctx);
    return;
  }
  await prepareGql11AssertSourceReading(ctx);
  await demonstrateLesson11AssertSourceConfigured(ctx);
  await closeWfConfigModalIfOpen(ctx);
}

/** Open Assertions tab + row so reading highlight is not an empty flash. */
export async function prepareGql11AssertRuleReading(ctx: DemoActionContext): Promise<void> {
  if (!_lesson11AssertSourceConfigured || !isLesson11AssertSourceConfiguredInWorkflow()) {
    await prepareGql11AssertSourceReading(ctx);
    await demonstrateLesson11AssertSourceConfigured(ctx);
  } else if (!document.querySelector(GQL.WF_ASSERT_PANEL)) {
    await openWfNodeConfigModal(ctx, { canvasTestId: GQL.WF_CANVAS_ASSERT_NODE });
    await waitForWfConfigPanel(ctx, GQL.WF_ASSERT_PANEL);
  }
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Assertions');
  if (!document.querySelector(GQL.WF_ASSERT_ROW)) {
    await clickWfConfigAddRow(ctx, GQL.WF_ASSERT_ADD_BTN, GQL.WF_ASSERT_JSONPATH);
  }
  await holdWfSpotlight(ctx, GQL.WF_ASSERT_ROW, 700);
}

async function fillLesson11AssertRuleFields(
  ctx: DemoActionContext,
  thresholdMs: string,
): Promise<void> {
  await clickWfConfigTab(ctx, GQL.WF_ASSERT_PANEL, 'Assertions');
  if (!document.querySelector(GQL.WF_ASSERT_ROW)) {
    await clickWfConfigAddRow(ctx, GQL.WF_ASSERT_ADD_BTN, GQL.WF_ASSERT_JSONPATH);
  }
  await fillWfConfigField(ctx, GQL.WF_ASSERT_JSONPATH, '$');
  await selectWfConfigOption(ctx, GQL.WF_ASSERT_OPERATOR, 'less_than');
  await fillWfConfigField(ctx, GQL.WF_ASSERT_EXPECTED, thresholdMs);
  await fillWfConfigField(ctx, GQL.WF_ASSERT_DESCRIPTION, `Latency under ${thresholdMs}ms`);
  await pauseWfConfigSection(ctx);
}

function markLesson11AssertRuleConfigured(thresholdMs: string, patched: boolean): void {
  if (isLesson11AssertRuleConfiguredInWorkflow(thresholdMs) || patched) {
    _lesson11AssertThreshold = thresholdMs;
    _lesson11AssertConfigured = true;
    if (thresholdMs !== LESSON11_PASS_THRESHOLD_MS) {
      _lesson11PassRun = false;
      _lesson11FailRun = false;
    }
  }
}

/** Visible assert-rule tour — closes modal and holds the canvas assert node. */
export async function demonstrateLesson11AssertRuleConfigured(
  ctx: DemoActionContext,
  thresholdMs = LESSON11_PASS_THRESHOLD_MS,
): Promise<void> {
  if (
    _lesson11AssertConfigured
    && _lesson11AssertThreshold === thresholdMs
    && isLesson11AssertRuleConfiguredInWorkflow(thresholdMs)
  ) {
    await closeWfConfigModalIfOpen(ctx);
    await holdWfSpotlight(ctx, GQL.WF_CANVAS_ASSERT_NODE, LESSON11_OUTCOME_HOLD_MS);
    return;
  }
  if (!document.querySelector(GQL.WF_ASSERT_PANEL)) {
    await prepareGql11AssertRuleReading(ctx);
  }
  await fillLesson11AssertRuleFields(ctx, thresholdMs);
  const saved = await saveAndCloseWfConfigModal(ctx);
  if (!saved) {
    await closeWfConfigModalIfOpen(ctx);
  }
  let patched = false;
  if (!isLesson11AssertRuleConfiguredInWorkflow(thresholdMs)) {
    patched = patchLesson11AssertRuleQuiet(thresholdMs);
    await ctx.delay(200);
  }
  markLesson11AssertRuleConfigured(thresholdMs, patched);
  await holdWfSpotlight(ctx, GQL.WF_CANVAS_ASSERT_NODE, LESSON11_OUTCOME_HOLD_MS);
}

/** Configure latency assertion (jsonPath `$`, operator `less_than`, threshold ms). */
export async function ensureLesson11AssertRuleConfigured(
  ctx: DemoActionContext,
  thresholdMs = LESSON11_PASS_THRESHOLD_MS,
): Promise<void> {
  await ensureLesson11AssertSourceConfigured(ctx);
  if (
    _lesson11AssertConfigured
    && _lesson11AssertThreshold === thresholdMs
    && isLesson11AssertRuleConfiguredInWorkflow(thresholdMs)
  ) {
    await closeWfConfigModalIfOpen(ctx);
    return;
  }
  await prepareGql11AssertRuleReading(ctx);
  await demonstrateLesson11AssertRuleConfigured(ctx, thresholdMs);
}

/** Open Assert config for the tighten-threshold reading pause. */
export async function prepareGql11TightenThresholdModal(ctx: DemoActionContext): Promise<void> {
  await prepareGql11TightenThresholdReading(ctx);
  await prepareGql11AssertRuleReading(ctx);
  await holdWfSpotlight(ctx, GQL.WF_ASSERT_EXPECTED, 750);
}

/** Change expected threshold to fail and hold the outcome. */
export async function demonstrateLesson11TightenThreshold(ctx: DemoActionContext): Promise<void> {
  await demonstrateLesson11AssertRuleConfigured(ctx, '1');
}

/** Walk green pass badges on Query then Assert. */
export async function demonstrateLesson11ObservePass(ctx: DemoActionContext): Promise<void> {
  await holdWfSpotlight(ctx, GQL.WF_CANVAS_QUERY_NODE, LESSON11_OUTCOME_HOLD_MS);
  await holdWfSpotlight(ctx, GQL.WF_CANVAS_ASSERT_NODE, LESSON11_OUTCOME_HOLD_MS);
}

/** Hold the failed Assert node, then the console failure detail if open. */
export async function demonstrateLesson11ObserveFailure(ctx: DemoActionContext): Promise<void> {
  await holdWfSpotlight(ctx, GQL.WF_CANVAS_ASSERT_NODE, 1100);
  if (document.querySelector(WF.CONSOLE)) {
    await holdWfSpotlight(ctx, WF.CONSOLE, 900);
  }
  await closeLesson11Console(ctx);
}

/**
 * Quiet graph patches before Quick Test — never open config modals here.
 * Modal tours belong in the configure steps; Acting on Quick Test should only run.
 */
export async function ensureLesson11GraphReadyForQuickTest(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  if (!isLesson11QueryConfiguredInWorkflow()) {
    patchLesson11QueryNodeQuiet();
    _lesson11QueryConfigured = true;
  }
  if (!isLesson11WorkflowVariablesConfigured()) {
    patchLesson11WorkflowVariablesQuiet();
    _lesson11VariablesConfigured = true;
  }
  if (!isLesson11AssertSourceConfiguredInWorkflow()) {
    patchLesson11AssertSourceQuiet();
    _lesson11AssertSourceConfigured = true;
  }
  if (!isLesson11AssertRuleConfiguredInWorkflow(LESSON11_PASS_THRESHOLD_MS)) {
    patchLesson11AssertRuleQuiet(LESSON11_PASS_THRESHOLD_MS);
    _lesson11AssertThreshold = LESSON11_PASS_THRESHOLD_MS;
    _lesson11AssertConfigured = true;
  }
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(200);
}

/** Run Quick Test only — observe pass state on the next step. */
export async function runLesson11WorkflowPassExecOnly(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11GraphReadyForQuickTest(ctx);
  if (_lesson11PassRun && lesson11BothNodesPassed()) return;

  ctx.navigateToTab('workflow');
  await ctx.delay(300);
  await clickWfFitView(ctx);
  const saveBtn = document.querySelector<HTMLElement>('.wf-toolbar-save-wrap button');
  saveBtn?.click();
  await ctx.delay(200);
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

/** Quietly ensure fail threshold without re-opening the assert config modal. */
function ensureLesson11FailThresholdQuiet(): void {
  if (isLesson11AssertRuleConfiguredInWorkflow('1')) {
    _lesson11AssertThreshold = '1';
    _lesson11AssertConfigured = true;
    return;
  }
  if (patchLesson11AssertRuleQuiet('1')) {
    _lesson11AssertThreshold = '1';
    _lesson11AssertConfigured = true;
    _lesson11PassRun = false;
    _lesson11FailRun = false;
  }
}

/** Run Quick Test with tightened threshold (assert rule must already be set to fail). */
export async function ensureLesson11WorkflowFailRunOnly(ctx: DemoActionContext): Promise<void> {
  ensureLesson11FailThresholdQuiet();
  await closeWfConfigModalIfOpen(ctx);
  if (_lesson11FailRun && document.querySelector(`${GQL.WF_CANVAS_ASSERT_NODE}.wf-node-fail`)) return;

  await ensureLesson11ConsoleOpen(ctx);
  ctx.navigateToTab('workflow');
  await ctx.delay(300);
  await clickWfFitView(ctx);
  await ctx.click(WF.QUICK_TEST_BTN);
  await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
  await ctx.delay(500);
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

/** Open Console and hold a steady spotlight so the panel is readable. */
export async function demonstrateLesson11ConsoleOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson11ConsoleOpen(ctx);
  await holdWfSpotlight(ctx, WF.CONSOLE, LESSON11_OUTCOME_HOLD_MS);
}

/** Quick Test + hold the execution summary (console still open for logs). */
export async function demonstrateLesson11PassExec(ctx: DemoActionContext): Promise<void> {
  await runLesson11WorkflowPassExecOnly(ctx);
  await holdWfSpotlight(ctx, WF.EXEC_SUMMARY, 1000);
  await closeLesson11Console(ctx);
}

/** Debug Mode with a steady hold on the Debug control, then the canvas outcome. */
export async function demonstrateLesson11DebugRun(ctx: DemoActionContext): Promise<void> {
  await holdWfSpotlight(ctx, WF.DEBUG_BTN, 750);
  await ensureLesson11DebugRun(ctx);
  await holdWfSpotlight(ctx, WF.CANVAS, LESSON11_OUTCOME_HOLD_MS);
  await closeLesson11Console(ctx);
}

/** Close the Workflow Console panel (e.g. before canvas-only steps). */
export async function closeLesson11Console(ctx: DemoActionContext): Promise<void> {
  await closeWfConsoleIfOpen(ctx);
}

/** Reading pause before Debug Mode (threshold tightened; no Quick Test re-run). */
export async function prepareGql11DebugReading(ctx: DemoActionContext): Promise<void> {
  ensureLesson11FailThresholdQuiet();
  await closeWfConfigModalIfOpen(ctx);
}

/** Start a step-through Debug run and click Step on each paused node. */
export async function ensureLesson11DebugRun(ctx: DemoActionContext): Promise<void> {
  ensureLesson11FailThresholdQuiet();
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
  setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_GUIDED);
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
  setWfConfigDemoTiming(null);
  await ctx.delay(100);
}

